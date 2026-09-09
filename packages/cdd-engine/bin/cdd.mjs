#!/usr/bin/env node
// bin/cdd.mjs — the single CDD engine CLI (URC merge surface). Commander.js v15.
// Subcommands = operation × (type | no type). The five legacy bins (cdd-task / docs-task /
// branch-review / cdd-select / cdd-research) are gone — this binary is the only entry point.
//   cdd implement --harness <name> --task <n> [--plan <path>]
//   cdd review --type <task|branch|spec|plan> --harness <name> [...]
//   cdd fix --type <task|spec|plan> --harness <name> [...]
//   cdd select | cdd research --harness <name> --brief <path> --output <path>
//   cdd brief --task <n> --plan <path> [--output <path>]
import { Command } from "commander";
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { loadRegistry, checkHarness, CddBlockedError } from "./lib/registry.mjs";
import { renderTemplate, reviewTypeConfig, reviewArtifactConfig, REVIEW_H1_BLOCK, reviewHardGate } from "./lib/templates.mjs";
// handoff 命名/workspace 的唯一派生层（canonical handoff-namespace.json）。docs 侧（spec/plan/branch）
// 的命名、轮次、Stopping prev、workspace 全部走这里 —— 不再有第二处命名字面量 / 第二处 workspace 推导。
import * as handoffNaming from "./lib/handoff-naming.mjs";
import { validateHandoffSchema } from "./lib/schema-utils.mjs";
import { reviewStoppedError } from "./lib/review-loop.mjs";
import { writeHandoff, gitToplevel, writeOwnHandoff } from "./lib/contract.mjs";
import { finalizeHandoff } from "./lib/handoff-finalize.mjs";
import { invokeCliWithRetry, resolveTimeoutMs, spawnCapture } from "./lib/cli-shared.mjs";
import { buildResearchPrompt, writeFindings } from "./lib/research.mjs";
import { runBriefCli } from "./lib/brief.mjs";
import { detectInstalledHarnesses } from "./utils/harness-detect.mjs";
import { config } from "./utils/skills-probe.config.mjs";
import { exitOk, exitBlocked, exitCliMissing, exitWithCode } from "./utils/exit.mjs";

const REG_PATH = fileURLToPath(new URL("./harness-registry.json", import.meta.url));
const DRY_RUN = () => process.env.CDD_DRY_RUN === "1";

// Per-subcommand usage lines (print on parse/usage errors in place of Commander's own output).
const SUBCOMMAND_USAGE = {
  implement: "usage: cdd implement --harness <name> --task <n> [--plan <path>]",
  review: "usage: cdd review --type <task|branch|spec|plan> --harness <name> [--task <n>] [--doc <path>] [--plan <path>] [--base <sha> --head <sha>] [--round <n>] [--spec <path>]",
  fix: "usage: cdd fix --type <task|spec|plan> --harness <name> [--task <n>] [--findings <path>] [--doc <path>] [--plan <path>]",
  select: "usage: cdd select",
  research: "usage: cdd research --harness <name> --brief <path> --output <path>",
  brief: "usage: cdd brief --task <n> --plan <path> [--output <path>]",
};

function usageError(command) {
  process.stderr.write((SUBCOMMAND_USAGE[command] ?? "usage: cdd <command> [options]") + "\n");
}

// ---- review/fix shared helpers ----

// Bug A (legacy cdd-task contract): --task must parse as an integer. Rejects NaN at parse
// time (exit 2 + message) instead of letting parseInt leak NaN into runTask and fabricate
// task-NaN-* artifacts with a false APPROVED H1 (STD-3).
function intTask(v) {
  const n = parseInt(v, 10);
  if (isNaN(n)) throw new Error(`--task must be an integer, got: ${v}`);
  return n;
}

// Docs workspace 全走 handoff-naming.resolveWorkspace(doc)（.superpowers/cdd/<slug>/，slug 经 slugRule
// 派生；Phase-0 flat root 已废弃，engine 代码零引用）。

function existingRoundHandoff(ws, type, round) {
  if (round < 1) return null;
  const p = path.join(ws, handoffNaming.handoffName("review", type, { round }));
  return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null;
}

function blockerCount(handoff) {
  return (handoff?.findings ?? []).filter((f) => f?.severity === "blocker").length;
}

// Review Stopping: reject a re-dispatch of a (type, ref) whose previous round reached
// APPROVED with blocker=0. A failure round (status BLOCKED/TIMEOUT) is NOT "done" — it
// must be re-dispatchable, so the gate requires status === "APPROVED" in addition to
// blockerCount === 0 (SP-4): runner 8.5/8.8/10/10.5 and docs-runner failure paths write
// status:BLOCKED|TIMEOUT with findings:[] → blockerCount alone would misjudge them as passed.
function stoppedExit3(type, round, ref, blocker) {
  const e = reviewStoppedError(type, round, ref);   // structured error + message, single authority
  process.stderr.write(`${e.message}\n` + (blocker ? `last blocker: ${blocker}\n` : ""));
  process.exit(3);
}

// Unified Stopping gate: only APPROVED + blocker=0 stops a re-run; a BLOCKED/TIMEOUT failure
// round (findings:[]) must stay re-dispatchable (SP-4). ref is the type's target signature.
function reviewStoppingGuard(prev, type, round, ref) {
  if (prev && prev.status === "APPROVED" && blockerCount(prev) === 0) stoppedExit3(type, round, ref, prev?.blocker);
}

function writeBranchBlocked(handoffPath, { base, head, code, reason }) {
  writeHandoff(handoffPath, {
    task: 1, phase: "branch-review", status: "BLOCKED",
    commits: { base, head }, findings: [], artifacts: {},
    blocker: reason ?? `cli exited ${code} without writing handoff`,
  });
}

// ---- review dispatch ----

// 导出（测试 seam）：cdd.test.mjs 注入 docs-runner mock 断言 runDocsTask 参数。
export async function runReview(opts) {
  // type=branch: independent git-diff-level path (former branch-review bin action + AC15 wiring).
  if (opts.type === "branch") {
    if (!opts.plan) {
      process.stderr.write("cdd review --type branch: missing required --plan <path>\n");
      process.exit(2);
    }
    // --base/--head were requiredOption in the old branch-review bin; the inline keeps
    // that contract — missing values would otherwise render garbage ("undefin" file slugs  + undefined in H1).
    if (!opts.base || !opts.head) {
      process.stderr.write("cdd review --type branch: missing required --base <sha> and --head <sha>\n");
      process.exit(2);
    }
    return await runBranchReview(opts);
  }

  if (opts.type === "spec" || opts.type === "plan") {
    if (!opts.doc) {
      process.stderr.write(`cdd review --type ${opts.type}: missing required --doc <path>\n`);
      process.exit(2);
    }
    const { runDocsTask } = await import("./lib/docs-runner.mjs");
    // spec/plan: round = engine auto-increment（canonical review.{type} 族模式扫描）；--round only
    // validates backfill (conflict → exit 2).
    const ws = handoffNaming.resolveWorkspace(opts.doc);
    const round = handoffNaming.resolveNextRound(ws, "review", opts.type);
    if (opts.round && Number(opts.round) !== round) {
      process.stderr.write(`--round ${opts.round} ≠ engine round ${round}\n`);
      process.exit(2);
    }
    const prev = existingRoundHandoff(ws, opts.type, round - 1);
    // Stopping only rejects a re-run of the SAME ref (doc) whose previous round is APPROVED
    // with blocker=0; a changed ref = a new review, and a BLOCKED/TIMEOUT round = re-dispatchable (SP-4).
    if (prev && (prev.doc_path ?? "") === opts.doc) reviewStoppingGuard(prev, opts.type, round, opts.doc);
    // review 模板数据化 — spec/plan 走共享壳 review.md（reviews.json type=spec|plan 配置）。
    // REFERENCE 注入具体 doc 路径（cfg.ref "doc vs spec" 是关系概念，类比 task/branch 的 git-range
    // 符号经具体化注入）；内容占位（lensEnum/axesGuide）由 reviews.json 配置注入，artifact 参数
    // （HANDOFF_TYPE/RETURN_MODE）读 canonical review.{type} 族（renderTemplate 缺参即抛）。
    const cfg = reviewTypeConfig(opts.type);
    const art = reviewArtifactConfig(opts.type);
    const handoffPath = path.join(ws, handoffNaming.handoffName("review", opts.type, { round }));
    await runDocsTask({
      harness: opts.harness, mode: "review", template: "review", type: opts.type, doc: opts.doc,
      handoffPath,
      params: {
        TYPE: opts.type,
        LENS_GUIDE: cfg.lensEnum.join(" · "),
        WORKSPACE: ws,
        REFERENCE: opts.doc,
        AXES: cfg.axesGuide,
        RETURN_MODE: art.return,
        HANDOFF_TYPE: art.schema,
        H1_BLOCK: "",
        PLAN_LINE: opts.spec ? `**Spec:** ${opts.spec}` : "",
        HARD_GATE: reviewHardGate(art.return, handoffPath),
      },
      workspace: ws, repoRoot: gitToplevel(process.cwd()),
      dryRun: DRY_RUN(),
    });
    return;
  }

  // type=task: task review (runner internally tracks task-N-review-{R}.json round sequence).
  if (opts.type !== "task") {
    process.stderr.write(`unknown review --type: ${opts.type}\n`);
    process.exit(2);
  }
  if (!opts.plan) {
    process.stderr.write("cdd review --type task: missing required --plan <path> (workspace slug + Stopping)\n");
    process.exit(2);
  }
  if (opts.task == null) {
    process.stderr.write("cdd review --type task: missing required --task <n>\n");
    process.exit(2);
  }
  // Workspace slug derives from the plan filename; task Stopping reads the latest
  // task-{N}-review-{R}.json and rejects when its blockers = 0.
  const slug = path.basename(opts.plan, ".md");
  const taskWs = path.join(gitToplevel(process.cwd()), ".superpowers", "cdd", slug);
  // task round 经 canonical 派生层 type-aware resolveNextRound 推导（op/type 四参签名；
  // 显式透传 {task} pin → 防 scan 形态 {task}→\d+ 跨 task 混计 rounds）。
  const nextTaskRound = handoffNaming.resolveNextRound(taskWs, "review", "task", { task: opts.task });
  // --round 校验回填（task 侧：next round 推导值；冲突 exit 2，对齐 spec/plan/branch）。
  if (opts.round && Number(opts.round) !== nextTaskRound) {
    process.stderr.write(`--round ${opts.round} ≠ engine round ${nextTaskRound}\n`);
    process.exit(2);
  }
  if (nextTaskRound > 1) {
    const prevR = nextTaskRound - 1;
    // Stopping prev 读同族 round-1 算术（canonical review.task 名 → task-{N}-review-{prevR}.json）。
    // 不得用 prevHandoffPath：该函数对此族解析跨族 prev 表（round1=implement / fix:R-1），
    // 会读到实体化 implement 的 APPROVED+[] → Stopping 误锁。
    const th = JSON.parse(readFileSync(path.join(taskWs, handoffNaming.handoffName("review", "task", { task: opts.task, round: prevR })), "utf8"));
    reviewStoppingGuard(th, "task", prevR, opts.plan);   // only APPROVED+blocker=0 stops (SP-4)
  }
  const { runTask } = await import("./lib/runner.mjs");
  await runTask(opts.harness, opts.task, {
    mode: "review", dryRun: DRY_RUN(),
    env: { ...process.env, ...(opts.plan ? { PLAN_FILE: opts.plan } : {}) },
  });
}

// Inline of the former branch-review bin action body, wired with AC15 round sequence +
// Review Stopping (previous-round lookup filtered by base7..head7 embedded in the filename;
// a ref change = a new review, never falsely rejected).
async function runBranchReview(opts) {
  const { harness, plan, base, head } = opts;

  // Harness registry gate.
  let entry;
  try {
    entry = checkHarness(loadRegistry(REG_PATH), harness, { dryRun: DRY_RUN() });
  } catch (e) {
    if (e instanceof CddBlockedError) {
      process.stderr.write(`${e.message}\n`);
      e.kind === "cli-missing" ? exitCliMissing() : exitBlocked();
    }
    throw e;
  }

  const repoRoot = gitToplevel(process.cwd());
  if (!repoRoot) { process.stderr.write("cdd review: not in a git repo\n"); exitBlocked(); }
  const base7 = String(base).slice(0, 7);
  const head7 = String(head).slice(0, 7);
  // workspace 与其他 review 型同源：resolveWorkspace(plan)（.superpowers/cdd/<slug>/）。
  const workspace = handoffNaming.resolveWorkspace(plan);

  // AC15 wiring: per-ref round seq（ref 内嵌文件名 → resolveNextRound 传 concrete base7/head7
  // 做 per-ref 轮次，他 ref 的轮次不干扰本 ref）+ --round backfill 校验（conflict → exit 2）+
  // Stopping 读上一轮（prevHandoffPath concrete 匹配同一 ref）。
  const round = handoffNaming.resolveNextRound(workspace, "review", "branch", { base7, head7 });
  if (opts.round && Number(opts.round) !== round) {
    process.stderr.write(`--round ${opts.round} ≠ engine round ${round}\n`);
    process.exit(2);
  }
  const prevPath = handoffNaming.prevHandoffPath(workspace, "review", "branch", round, { base7, head7 });
  const prev = prevPath && existsSync(prevPath) ? JSON.parse(readFileSync(prevPath, "utf8")) : null;
  // Stop only on an APPROVED round with blocker=0 (SP-4) — a BLOCKED/TIMEOUT branch review
  // round with findings:[] must be re-dispatchable, not rejected as "already done".
  if (prev) reviewStoppingGuard(prev, "branch", round, `${base7}..${head7}`);

  // Per-round handoff filename（canonical review.branch 族；branch-fix-loop re-reviews reuse distinct files）。
  const handoffPath = path.join(workspace, handoffNaming.handoffName("review", "branch", { base7, head7, round }));
  mkdirSync(workspace, { recursive: true });

  if (DRY_RUN()) {
    writeHandoff(handoffPath, {
      task: 1, phase: "branch-review", status: "APPROVED",
      commits: { base, head }, findings: [], artifacts: {}, blocker: "dry-run",
    });
    process.stdout.write(`status: APPROVED\ncommits: base=${base} head=${head}\nartifacts: \nblocker: dry-run\n`);
    exitOk();
    return;
  }

  // branch review 走共享壳 review.md（reviews.json type=branch 内容配置 + canonical branch 族 artifact 参数）+ H1 四行合同。
  const cfg = reviewTypeConfig("branch");
  const art = reviewArtifactConfig("branch");
  const { renderHandoffStub, REVIEW_H1_BLOCK } = await import("./lib/templates.mjs");
  const { loadHandoffSchema } = await import("./lib/schema-utils.mjs");
  let prompt = renderTemplate("review", {
    TYPE: "branch",
    WORKSPACE: workspace,
    LENS_GUIDE: cfg.lensEnum.join(" · "),
    REFERENCE: `${base}..${head}`,
    AXES: cfg.axesGuide,
    HANDOFF: handoffPath,
    HANDOFF_TYPE: art.schema,
    RETURN_MODE: art.return,
    H1_BLOCK: REVIEW_H1_BLOCK,
    PLAN_LINE: opts.plan ? `**Plan:** ${opts.plan}` : "",
    HARD_GATE: reviewHardGate(art.return, handoffPath),
  }, "cdd review");
  // HANDOFF_STUB：共享壳槽位在此路径须显式替换（docs 路径 runDocsTask 自理、runner 路径 renderModePrompt 自理）。
  prompt = prompt.replace(/\{\{HANDOFF_STUB\}\}/g,
    renderHandoffStub(loadHandoffSchema("cdd"), "review", 1, {}));

  // Invoke harness CLI. (op,type) 注入解析到 prefix.review.branch（旧 branch-review 独立 bin 已删除，逻辑内联于此）。
  const timeoutMs = resolveTimeoutMs(process.env, "review");
  const res = await invokeCliWithRetry(entry, prompt, { op: "review", type: "branch" }, process.env, repoRoot, timeoutMs);

  if (!res.ok) {
    if (!existsSync(handoffPath)) {
      writeBranchBlocked(handoffPath, { base, head, code: res.code });
    }
    process.stderr.write(`CDD_BLOCKED: branch-review failed (exit ${res.code})\n`);
    exitWithCode(1);
  }

  // Agent exited 0 but never wrote the handoff — BLOCKED (mirrors runner step 10.5).
  if (!existsSync(handoffPath)) {
    writeBranchBlocked(handoffPath, { base, head, code: 0, reason: `${path.basename(handoffPath)} not written after exit 0 → re-run branch-review` });
    process.stderr.write(`CDD_BLOCKED: branch-review handoff not written\n`);
    exitWithCode(1);
  }

  // Agent wrote handoff — validate against the CDD schema (mirrors runner step 8.8).
  if (existsSync(handoffPath)) {
    const agentHandoff = JSON.parse(readFileSync(handoffPath, "utf8"));
    const sv = validateHandoffSchema(agentHandoff, "cdd");
    if (!sv.valid) {
      writeBranchBlocked(handoffPath, { base, head, code: 0, reason: `branch-review handoff schema invalid: ${sv.reason} → fix and re-run branch-review` });
      process.stderr.write(`CDD_BLOCKED: branch-review handoff schema invalid\n`);
      exitWithCode(1);
    }
    // T5/T7: status 单一权威 — branch review（review 族）读回经 finalizeHandoff 定稿（rollup 派生
    // 覆写，SP-4 豁免失败轮次）；定稿写盘用 writeOwnHandoff（engine 载体唯一作者，全量覆盖替换）。
    // 三消费方（runner/docs-runner/cdd）共享同一 finalizeHandoff 单点，非各自接线。
    const finalized = finalizeHandoff({ mode: "review", agentHandoff });
    if (finalized.handoff && finalized.handoff !== agentHandoff) writeOwnHandoff(handoffPath, finalized.handoff);
  }

  exitOk();
}

// ---- fix dispatch ----

// 导出（测试 seam）：cdd.test.mjs 注入 docs-runner mock 断言 runDocsTask 参数。
export async function runFix(opts) {
  const { runTask } = await import("./lib/runner.mjs");
  // type=task fix: --findings is plumbed through runTask's `findingsPath` opt — the runner
  // overrides env.CDD_FINDINGS with the previous-phase handoff in fix mode, so the opt takes
  // precedence inside buildTaskEnv (otherwise --findings would be dead code).
  if (opts.type === "task") {
    if (!opts.plan) {
      process.stderr.write("cdd fix --type task: missing required --plan <path>\n");
      process.exit(2);
    }
    if (opts.task == null) {
      process.stderr.write("cdd fix --type task: missing required --task <n>\n");
      process.exit(2);
    }
    await runTask(opts.harness, opts.task, {
      mode: "fix", dryRun: DRY_RUN(),
      findingsPath: opts.findings,
      env: { ...process.env, ...(opts.plan ? { PLAN_FILE: opts.plan } : {}) },
    });
    return;
  }
  // spec/plan: fix 模板从 canonical fix.{type} 族读 fixTemplate（T2 裁轴后 reviews.json 不再承载 artifact）。
  if (opts.type !== "spec" && opts.type !== "plan") {
    process.stderr.write(`unknown fix --type: ${opts.type}\n`);
    process.exit(2);
  }
  if (!opts.doc) {
    process.stderr.write(`cdd fix --type ${opts.type}: missing required --doc <path>\n`);
    process.exit(2);
  }
  // fix round 从 --findings 源解析：roundPattern("review", type) 匹配 findings 文件名
  // （<type>-review-{R}.json）→ 提取 R 作为 fix 轮次（fix 输出 <type>-fix-{R}.json）。
  // findings 缺失或文件名不匹配 → 提示 + exit 2（无源不可推导轮次）。
  const findingsBase = opts.findings ? path.basename(opts.findings) : null;
  const roundMatch = findingsBase ? findingsBase.match(handoffNaming.roundPattern("review", opts.type)) : null;
  if (!roundMatch) {
    process.stderr.write(`cdd fix --type ${opts.type}: --findings must name a ${opts.type}-review-{R}.json file (round derived from the source review); got: ${opts.findings ?? "(missing)"}\n`);
    process.exit(2);
  }
  const fixRound = Number(roundMatch[1]);
  if (!Number.isInteger(fixRound) || fixRound < 1) {
    process.stderr.write(`cdd fix --type ${opts.type}: --findings round must be >= 1 (round derived from the source review); got: ${opts.findings}\n`);
    process.exit(2);
  }
  // fix 模板统一走 canonical fix.{type} 族 fixTemplate（spec/plan → "doc-fix" 共享壳）；
  // workspace 与 review 同源 resolveWorkspace(doc)；handoffPath 显式传 canonical fix.{type} 名。
  const template = handoffNaming.familyConfig("fix", opts.type).fixTemplate;
  const ws = handoffNaming.resolveWorkspace(opts.doc);
  const { runDocsTask } = await import("./lib/docs-runner.mjs");
  await runDocsTask({
    harness: opts.harness, mode: "fix", template, type: opts.type, doc: opts.doc,
    findingsPath: opts.findings, repoRoot: gitToplevel(process.cwd()), dryRun: DRY_RUN(),
    handoffPath: path.join(ws, handoffNaming.handoffName("fix", opts.type, { round: fixRound })),
  });
}

// ---- select / research (inline of the former cdd-select / cdd-research bin action logic) ----

// detect_current_harness: CURSOR_TRACE_ID → cursor-agent; CLAUDE_CODE_SESSION_ID → claude;
// AI_AGENT=claude-code* → claude; otherwise empty.
function detectCurrentHarness(env) {
  if (env.CURSOR_TRACE_ID) return "cursor-agent";
  if (env.CLAUDE_CODE_SESSION_ID) return "claude";
  if ((env.AI_AGENT ?? "").startsWith("claude-code")) return "claude";
  return "";
}

function runSelect() {
  const detected = detectInstalledHarnesses(config, { env: process.env });
  const available = detected.filter((h) => h.installed && h.channel === "install-and-use").map((h) => h.name);
  const unsupported = detected.filter((h) => h.installed && h.channel !== "install-and-use").map((h) => h.name);

  if (available.length === 0) {
    process.stdout.write("available:\n");
    process.stdout.write(`unsupported_installed:${unsupported.join(",")}\n`);
    process.stdout.write("recommended:\n");
    process.stderr.write(`BLOCKED: no full harness installed (registry: ${detected.map((h) => h.name).join(" ")} )\n`);
    exitBlocked();
  }

  // Recommendation priority: droid > pi > current harness (full) > first alphabetic available.
  let recommended = "";
  if (available.includes("droid")) {
    recommended = "droid";
  } else if (available.includes("pi")) {
    recommended = "pi";
  } else {
    const current = detectCurrentHarness(process.env);
    if (current && available.includes(current)) recommended = current;
    else recommended = available[0];
  }

  process.stdout.write(`available:${available.join(",")}\n`);
  process.stdout.write(`unsupported_installed:${unsupported.join(",")}\n`);
  process.stdout.write(`recommended:${recommended}\n`);
}

// Standalone research runner (spawnCapture, not invokeCli — research output is written verbatim).
async function runResearch(opts) {
  const NAME = "cdd research";

  // Brief validation (before the harness gate — pure file check, no PATH dependency).
  let briefContent;
  try {
    briefContent = readFileSync(opts.brief, "utf8");
  } catch (err) {
    process.stderr.write(`${NAME}: cannot read brief: ${err.message}\n`);
    exitBlocked();
  }

  // Harness registry gate.
  let entry;
  try {
    const reg = loadRegistry(process.env.CDD_REGISTRY_PATH || REG_PATH);
    entry = checkHarness(reg, opts.harness, { dryRun: DRY_RUN() });
  } catch (err) {
    if (err instanceof CddBlockedError) {
      if (err.kind === "cli-missing") exitCliMissing(err.message);
      exitBlocked(err.message);
    }
    process.stderr.write(`${NAME}: ${err.message}\n`);
    exitWithCode(err.exitCode ?? 1);
  }

  const prompt = buildResearchPrompt(briefContent);

  // Dry-run short-circuit (argument parsing / smoke tests only).
  if (DRY_RUN()) exitOk();

  const cli = entry.cli;
  const cliArgs = [...entry.invoke.split(/\s+/).filter(Boolean), prompt];
  const timeoutMs = resolveTimeoutMs(process.env, "research");

  let result;
  try {
    // #137 subprocess-security posture: strip credentials from the harness env.
    const secureEnv = { ...process.env };
    delete secureEnv.ANTHROPIC_API_KEY;
    delete secureEnv.CLAUDE_CODE_SUBAGENT_MODEL;
    result = await spawnCapture(cli, cliArgs, { cwd: process.cwd(), env: secureEnv, timeoutMs });
  } catch (err) {
    process.stderr.write(`${NAME}: spawn error: ${err.message}\n`);
    exitWithCode(1);
  }

  // Timeout path: write partial findings + TIMEOUT frontmatter + exit 1.
  if (result.timedOut) {
    process.stderr.write(`${NAME}: timeout after ${timeoutMs}ms\n`);
    writeFindings(opts.output, `${result.stdout}\n---\nstatus: TIMEOUT\n`);
    exitWithCode(1);
  }

  if (!result.ok) {
    process.stderr.write(`${NAME}: harness failed (exit ${result.code})\n`);
    if (result.stderr) process.stderr.write(result.stderr);
    exitWithCode(1);
  }

  writeFindings(opts.output, result.stdout);
  exitOk();
}

// ---- commander program ----

const program = new Command();
// Configure BEFORE registering subcommands: Commander copies exitOverride / output
// configuration to each subcommand at creation time (copyInheritedSettings), so a
// subcommand's parse error would otherwise fall through to Commander's own
// process.exit(1) instead of our usage + exit 2.
program.exitOverride();
program.configureOutput({ outputError: () => {} });
program
  .name("cdd")
  .description("CDD engine CLI — implement/review/fix/select/research/brief")
  .helpOption("-h, --help", "display help for command");

// --- implement (formerly cdd-task --mode implement) ---
program
  .command("implement")
  .requiredOption("--harness <name>", "harness name")
  .requiredOption("--task <n>", "task number", intTask)
  .option("--plan <path>", "plan file path")
  .action(async (opts) => {
    const { runTask } = await import("./lib/runner.mjs");
    await runTask(opts.harness, opts.task, {
      mode: "implement",
      dryRun: DRY_RUN(),
      env: { ...process.env, ...(opts.plan ? { PLAN_FILE: opts.plan } : {}) },
    });
  });

// --- review (formerly cdd-task --mode task-review / docs-task review / branch-review) ---
program
  .command("review")
  .requiredOption("--type <t>", "task|branch|spec|plan")
  .requiredOption("--harness <name>", "harness name")
  .option("--task <n>", "task number (type=task)", intTask)
  .option("--doc <path>", "document path (type=spec|plan)")
  .option("--plan <path>", "plan path")
  .option("--base <sha>", "base commit (type=task|branch)")
  .option("--head <sha>", "head commit (type=task|branch)")
  .option("--round <n>", "round backfill (validate against engine auto-increment)")
  .option("--spec <path>", "spec document path (type=plan; plan axis references spec coverage via reviews.json axesGuide; kept as a compatibility param, value is not inlined into the doc)")
  .action(async (opts) => {
    await runReview(opts);
  });

// --- fix (formerly cdd-task --mode fix / docs-task fix) ---
program
  .command("fix")
  .requiredOption("--type <t>", "task|spec|plan")
  .requiredOption("--harness <name>", "harness name")
  .option("--task <n>", "task number (type=task)", intTask)
  .option("--findings <path>", "findings handoff path for this fix round")
  .option("--doc <path>", "document path (type=spec|plan)")
  .option("--plan <path>", "plan path")
  .action(async (opts) => {
    await runFix(opts);
  });

// --- select / research (inline action logic; no library module) ---
program
  .command("select")
  .description("Detect installed harness CLIs and recommend default")
  .action(() => { runSelect(); });

program
  .command("research")
  .description("Standalone research runner (independent of implement/review)")
  .requiredOption("--harness <name>", "harness name")
  .requiredOption("--brief <path>", "path to research brief markdown")
  .requiredOption("--output <path>", "path to write findings markdown")
  .action(async (opts) => {
    await runResearch(opts);
  });

// --- brief (delegated to lib module CLI entry; Commander opts → 结构化 argv，不二次解析 process.argv) ---
program
  .command("brief")
  .requiredOption("--task <n>", "task number")
  .requiredOption("--plan <path>", "plan path")
  .option("--output <path>", "brief output path")
  .action((opts) => runBriefCli([
    "--task", String(opts.task),
    "--plan", opts.plan,
    ...(opts.output ? ["--output", opts.output] : []),
  ]));

// Only parse argv when executed as the main entry (imports from tests must be inert).
const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;
if (isMain) {
  program.parseAsync(process.argv).catch((e) => {
    if (e.code === "commander.helpDisplayed") {
      exitOk();
    }
    // Commander parse/usage errors (missing required option, unknown option, unknown command, ...) → usage + exit 2.
    if (typeof e.code === "string" && e.code.startsWith("commander.")) {
      usageError(process.argv[2]);
    } else {
      // Action errors → error message + exit 2.
      process.stderr.write(`${e.message}\n`);
    }
    exitCliMissing();
  });
}
