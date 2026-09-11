// packages/cdd-engine/lib/cli/review.mjs — `cdd review`（task/branch/spec/plan 四型派发）+ 共享守卫助手。
// spec §2.3 拆分（原 bin/cdd.mjs 合并面）：review 分发 + requireHostHarness/detectCurrentHarness/
// resolveTargetDoc/intTask/Stopping 守卫簇全部顶部导出，供 fix/research/parse 复用（单一 host 事实源）。
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { loadRegistry, checkHarness, CddBlockedError, REG_PATH } from "../registry.mjs";
import { renderTemplate, reviewTypeConfig, reviewArtifactConfig, reviewHardGate } from "../templates.mjs";
import * as handoffNaming from "../handoff/naming.mjs";
import { reviewStoppedError } from "../runner/review-loop.mjs";
import { gitToplevel } from "../contract/commit.mjs";
import { exitWithCode } from "../exit.mjs";
import { stopIdleMonitor, teardownAll } from "../lifecycle/proc.mjs";

export const DRY_RUN = () => process.env.CDD_DRY_RUN === "1";

// ---- host harness detection ----

// detect_current_harness: CURSOR_TRACE_ID → cursor-agent; CLAUDE_CODE_SESSION_ID → claude;
// AI_AGENT=claude-code* → claude; otherwise empty. T3 扩展：唯一 host 事实源（空 → BLOCK）。
// Exported (test seam) — the CLI resolves the harness here and no longer accepts a harness flag.
export function detectCurrentHarness(env) {
  if (env.CURSOR_TRACE_ID) return "cursor-agent";
  if (env.CLAUDE_CODE_SESSION_ID) return "claude";
  if ((env.AI_AGENT ?? "").startsWith("claude-code")) return "claude";
  return "";
}

// Host harness gate: 全部子命令 action 的唯一 harness 来源（CLI 负责解析，runner 签名不动）。
// 空 host → CDD_BLOCKED + exit 1 —— cdd 必须从受支持的 harness 会话内运行，registry 由该 host 键查找。
export function requireHostHarness() {
  const harness = detectCurrentHarness(process.env);
  if (!harness) {
    process.stderr.write("CDD_BLOCKED: no host harness detected (run cdd from within a supported harness)\n");
    exitWithCode(1);
  }
  return harness;
}

// ---- review/fix shared helpers ----

// D11（review/fix 共享）：被审目标解析 + 缺参守卫单点。type=spec → --spec（被审文档本身）；
// type=plan → --plan（被审 plan，可选 --spec 携带上游参照）；缺参 → `cdd <verb> --type <type>:
// missing required --<type> <path>` + exit 2。runReview / runFix 双调用点共用，禁止重复。
export function resolveTargetDoc(opts, verb) {
  const doc = opts.type === "spec" ? opts.spec : opts.plan;
  if (!doc) {
    process.stderr.write(`cdd ${verb} --type ${opts.type}: missing required --${opts.type} <path>\n`);
    process.exit(2);
  }
  return doc;
}

// Bug A (legacy cdd-task contract): --task must parse as an integer. Rejects NaN at parse
// time (exit 2 + message) instead of letting parseInt leak NaN into runTask and fabricate
// task-NaN-* artifacts with a false APPROVED H1 (STD-3).
export function intTask(v) {
  const n = parseInt(v, 10);
  if (isNaN(n)) throw new Error(`--task must be an integer, got: ${v}`);
  return n;
}

// Docs workspace 全走 handoff-naming.resolveWorkspace(doc)（.superpowers/cdd/<slug>/，slug 经 slugRule
// 派生；Phase-0 flat root 已废弃，engine 代码零引用）。

export function existingRoundHandoff(ws, type, round) {
  if (round < 1) return null;
  const p = path.join(ws, handoffNaming.handoffName("review", type, { round }));
  return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null;
}

export function blockerCount(handoff) {
  return (handoff?.findings ?? []).filter((f) => f?.severity === "blocker").length;
}

// Review Stopping: reject a re-dispatch of a (type, ref) whose previous round reached
// APPROVED with blocker=0. A failure round (status BLOCKED/TIMEOUT) is NOT "done" — it
// must be re-dispatchable, so the gate requires status === "APPROVED" in addition to
// blockerCount === 0 (SP-4): runner 8.5/8.8/10/10.5 and docs-runner failure paths write
// status:BLOCKED|TIMEOUT with findings:[] → blockerCount alone would misjudge them as passed.
export function stoppedExit3(type, round, ref, blocker) {
  const e = reviewStoppedError(type, round, ref);   // structured error + message, single authority
  process.stderr.write(`${e.message}\n` + (blocker ? `last blocker: ${blocker}\n` : ""));
  process.exit(3);
}

// Unified Stopping gate: only APPROVED + blocker=0 stops a re-run; a BLOCKED/TIMEOUT failure
// round (findings:[]) must stay re-dispatchable (SP-4). ref is the type's target signature.
export function reviewStoppingGuard(prev, type, round, ref) {
  if (prev && prev.status === "APPROVED" && blockerCount(prev) === 0) stoppedExit3(type, round, ref, prev?.blocker);
}

// ---- review dispatch ----

// 导出（测试 seam）：cdd.test.mjs 注入 docs-runner mock 断言 runDocsTask 参数。
export async function runReview(opts) {
  try {
  // Host harness gate — harness 不再由 CLI 参数传入（T3），由环境 host 判定并向下传入。
  const harness = requireHostHarness();
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
    const { runBranchReview } = await import("./branch-review.mjs");   // lazy: breaks review↔branch-review import cycle
    return await runBranchReview({ ...opts, harness });
  }

  if (opts.type === "spec" || opts.type === "plan") {
    // D11: type-self-describing target param — type=spec reviews the --spec doc;
    // type=plan reviews the --plan doc (optional --spec carries the upstream reference).
    const doc = resolveTargetDoc(opts, "review");
    const { runDocsTask } = await import("../runner/run-docs.mjs");
    // spec/plan: round = engine auto-increment（canonical review.{type} 族模式扫描）；--round only
    // validates backfill (conflict → exit 2).
    const ws = handoffNaming.resolveWorkspace(doc);
    const round = handoffNaming.resolveNextRound(ws, "review", opts.type);
    if (opts.round && Number(opts.round) !== round) {
      process.stderr.write(`--round ${opts.round} ≠ engine round ${round}\n`);
      process.exit(2);
    }
    const prev = existingRoundHandoff(ws, opts.type, round - 1);
    // Stopping only rejects a re-run of the SAME ref (doc) whose previous round is APPROVED
    // with blocker=0; a changed ref = a new review, and a BLOCKED/TIMEOUT round = re-dispatchable (SP-4).
    if (prev && (prev.doc_path ?? "") === doc) reviewStoppingGuard(prev, opts.type, round, doc);
    // review 模板数据化 — spec/plan 走共享壳 review.md（reviews.json type=spec|plan 配置）。
    // REFERENCE 注入具体 doc 路径（cfg.ref "doc vs spec" 是关系概念，类比 task/branch 的 git-range
    // 符号经具体化注入）；内容占位（lensEnum/axesGuide）由 reviews.json 配置注入，artifact 参数
    // （HANDOFF_TYPE/RETURN_MODE）读 canonical review.{type} 族（renderTemplate 缺参即抛）。
    const cfg = reviewTypeConfig(opts.type);
    const art = reviewArtifactConfig(opts.type);
    const handoffPath = path.join(ws, handoffNaming.handoffName("review", opts.type, { round }));
    await runDocsTask({
      harness, mode: "review", template: "review", type: opts.type, doc,
      handoffPath,
      params: {
        TYPE: opts.type,
        LENS_GUIDE: cfg.lensEnum.join(" · "),
        WORKSPACE: ws,
        REFERENCE: doc,
        AXES: cfg.axesGuide,
        RETURN_MODE: art.return,
        HANDOFF_TYPE: art.schema,
        H1_BLOCK: "",
        // type=plan: PLAN_LINE 注入上游 spec 参照；type=spec 无 plan 参照，保持空串。
        PLAN_LINE: opts.type === "plan" && opts.spec ? `**Spec:** ${opts.spec}` : "",
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
  const { runTask } = await import("../runner/run-task.mjs");
  await runTask(harness, opts.task, {
    mode: "review", dryRun: DRY_RUN(),
    env: { ...process.env, ...(opts.plan ? { PLAN_FILE: opts.plan } : {}) },
  });
  } finally {
    stopIdleMonitor();
    await teardownAll({ graceMs: 5000 });   // review 出口兜底（幂等）——task/branch 支路本层兜一层
  }
}