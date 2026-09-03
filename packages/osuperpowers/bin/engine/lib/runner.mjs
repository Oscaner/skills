// engine/lib/runner.mjs — CDD per-task runner (Node port of cdd_run_task).
// H1 四行输出独占（spec v3）：本模块负责格式化 status/commits/artifacts/blocker。
// runTask 有序契约：registry ship gate → CLI preflight → workspace/env → ledger PLAN_FILE
// backfill → review fixed-point → require env → renderModePrompt → 嵌套 CLI spawn（捕获 stderr，
// 非 2>/dev/null 吞）→ commit-contract → H1 四行 → handoff 处理。
// noExit=true 时返回 { exitCode, h1 } 而非 exit helpers —— 单测的 seam。
// 落地退出委托 utils/exit.mjs（统一出口，无 inline process.exit）。
import { accessSync, constants, existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadRegistry, checkHarness, CddBlockedError } from "./registry.mjs";
import { renderModePrompt, pluginRoot } from "./templates.mjs";
import { appendLedger } from "./ledger.mjs";
import { writeHandoff, gitToplevel, normalizeHandoffStatus } from "./contract.mjs";
import { exitOk, exitBlocked, exitCliMissing, exitWithCode } from "../../utils/exit.mjs";
import { config as probeConfig } from "../../utils/skills-probe.config.mjs";
import { spawnCapture, invokeCli, resolveTimeoutMs } from "./cli-shared.mjs";
import { readProgressJSON, writeProgressJSON, migrateIfNeeded, getRound, incrementRound } from "./progress.mjs";
import { validateHandoffSchema } from "./schema-utils.mjs";

// Re-export for backward compatibility (existing tests and consumers import from runner.mjs).
export { spawnCapture, invokeCli };

const REG_PATH = fileURLToPath(new URL("../harness-registry.json", import.meta.url));
const VALID_MODES = ["implement", "task-review", "fix"];

// 本地编排错误：携带退出码；runTask/runPlan 捕获后 finish。
class RunBlocked extends Error {
  constructor(message, exitCode = 1) {
    super(message);
    this.exitCode = exitCode;
  }
}

// 落地退出：noExit=false → 写 H1（若 h1 非空）到 stdout + stderr 消息 + exitWithCode；
// noExit=true → 仅返回 { exitCode, h1 }（runPlan 组合 / 单测）。
function finish(exitCode, h1, msg, noExit, { stderrPrefix = "CDD_BLOCKED" } = {}) {
  if (msg) process.stderr.write(`${stderrPrefix}: ${msg}\n`);
  if (!noExit) {
    for (const line of h1) process.stdout.write(`${line}\n`);
    exitWithCode(exitCode);
  }
  return { exitCode, h1 };
}

// ---- workspace / env ----

// 有效 plan 三来源合成（opt ‖ env.PLAN_FILE ‖ ledger backfill）。
// resolveRepoRoot 的分支判断与错误信息均基于该有效 plan（#173：永不回退 cwd）。
// 分支规则：
//   有有效 plan → plan 派生分支：existsSync 前置（"plan file not found"）→
//     repoRoot = gitToplevel(dirname(plan))，失败 → "not in a git repo"；
//     workspace = <repoRoot>/.superpowers/cdd/<slug>/
//   无有效 plan 且有 CDD_WORKSPACE → 直设分支（现行为）：workspace = env 原值；
//     repoRoot = gitToplevel(workspace)，允许 null（下游容忍）
//   两者皆无 → RunBlocked "cannot resolve repo root: provide --plan or CDD_WORKSPACE"
export function resolveRepoRoot({ planFile, env, ledgerPath }) {
  let plan = planFile || env.PLAN_FILE || "";
  if (!plan && ledgerPath) plan = backfillPlanFromLedger(ledgerPath);
  if (plan) {
    if (!existsSync(plan)) throw new RunBlocked(`plan file not found: ${plan}`);
    const root = gitToplevel(path.dirname(plan));
    if (!root) throw new RunBlocked("not in a git repo");
    return { plan, repoRoot: root };
  }
  if (env.CDD_WORKSPACE) {
    // repoRoot 允许为 null（下游容忍：scripts-dir 跳过 submodule 探测 / relpath 回退绝对路径）。
    return { plan: "", repoRoot: gitToplevel(env.CDD_WORKSPACE) };
  }
  throw new RunBlocked("cannot resolve repo root: provide --plan or CDD_WORKSPACE");
}

// 纯派生（根由 resolveRepoRoot 解析后经第 3 参注入）：有 plan → <repoRoot>/.superpowers/cdd/<slug>/；
// 无 plan + CDD_WORKSPACE → env 原值；两者皆无 → RunBlocked。
// workspace 解析（#173 后为纯派生，repoRoot 由 resolveRepoRoot 给出）：
//   有 plan（planFile 参数 = 有效 plan，含 env.PLAN_FILE/backfill 来源）→ 派生分支
//     <repoRoot>/.superpowers/cdd/<slug>/；
//   无 plan 且 env.CDD_WORKSPACE → 直设分支（现行为）：workspace = env 原值。
// 分支选择由 planSource 显式声明（"plan" | "workspace"）——调用方据 resolveRepoRoot
// 结果决定，消除「伪造空 env 驱动内部分支」的控制耦合。
export function resolveWorkspace({ plan, planSource, env, repoRoot }) {
  if (planSource === "plan") {
    if (!repoRoot) throw new RunBlocked("not in a git repo");
    const slug = path.basename(plan, ".md");
    if (!slug || slug === "." || slug === "..") throw new RunBlocked(`cannot derive workspace name from: ${plan}`);
    const base = path.join(repoRoot, ".superpowers", "cdd");
    mkdirSync(path.join(base, slug), { recursive: true });
    writeFileSync(path.join(base, ".gitignore"), "*\n");
    return path.join(base, slug);
  }
  if (env.CDD_WORKSPACE) return env.CDD_WORKSPACE;
  throw new RunBlocked("CDD_WORKSPACE unset and --plan not provided");
}

// 对齐 _cdd_set_task_env：workspace 派生路径，未设置才默认（`${VAR:-default}` 语义）；
// CDD_WORKSPACE / CDD_MODE / CDD_HARNESS 强制。返回新 env 对象（不改 baseEnv）。
// round：task-review/fix mode 时派生 per-round handoff 路径；implement 固定为 task-N-implement.json。
export function buildTaskEnv(baseEnv, workspace, task, mode, harness, { round = 1 } = {}) {
  const env = { ...baseEnv };
  env.CDD_WORKSPACE = workspace;
  env.CDD_HARNESS = harness;
  env.CDD_LEDGER ||= path.join(workspace, "progress.json");
  env.CDD_TASK_BRIEF ||= path.join(workspace, `task-${task}-brief.md`);
  // Per-phase per-round handoff path (unconditional — always derive from round):
  const handoffFile = mode === "implement"
    ? `task-${task}-implement.json`
    : `task-${task}-${mode}-${round}.json`;
  env.CDD_HANDOFF_PATH = path.join(workspace, handoffFile); // unconditional assignment
  env.CDD_PLAN_CONSTRAINTS ||= path.join(workspace, "plan-constraints.md");
  env.CDD_MODE = mode;
  if (mode !== "fix") {
    env.CDD_FINDINGS ||= path.join(workspace, `task-${task}-open-findings.json`);
  }
  if (mode === "fix") {
    // CDD_FINDINGS: path to task-review-R.json for this fix round (runner-derived, no scope filter)
    env.CDD_FINDINGS = prevHandoffPath(workspace, task, mode, round);
  }
  return env;
}

// 对齐 _cdd_plan_from_ledger：legacy fallback — 仅对迁移前的 progress.md（首行
// `# CDD ledger — plan: <path>`）生效；progress.json 不含该行，正则不匹配时返回 ""。
function backfillPlanFromLedger(ledgerPath) {
  if (!ledgerPath || !existsSync(ledgerPath)) return "";
  const first = readFileSync(ledgerPath, "utf8").split("\n", 1)[0] ?? "";
  const m = first.match(/^# CDD ledger — plan: (.+)$/);
  return m ? m[1].trim() : "";
}

// 读 JSON 嵌套字段（commits.base / commits.head）；缺失/损坏 → ""。
function readJsonField(filePath, keys) {
  if (!filePath || !existsSync(filePath)) return "";
  try {
    let v = JSON.parse(readFileSync(filePath, "utf8"));
    for (const k of keys) v = v?.[k];
    return typeof v === "string" ? v : "";
  } catch {
    return "";
  }
}

function readJson(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

// Returns the path of the handoff written by the previous phase for this task.
// task-review round 1: reads task-N-implement.json
// task-review round R>1: reads task-N-fix-(R-1).json
// fix round R: reads task-N-task-review-R.json
function prevHandoffPath(workspace, task, mode, round) {
  if (mode === "task-review") {
    return round === 1
      ? path.join(workspace, `task-${task}-implement.json`)
      : path.join(workspace, `task-${task}-fix-${round - 1}.json`);
  }
  if (mode === "fix") {
    return path.join(workspace, `task-${task}-task-review-${round}.json`);
  }
  return null; // implement has no prior phase
}

// 对齐 cdd_require_env 的 mode 有效性检查。
function validateMode(mode) {
  if (!VALID_MODES.includes(mode)) return `CDD_MODE must be implement|task-review|fix (got: ${mode})`;
  return null;
}

// 对齐 cdd_require_env：必需 CDD_* + mode 特例（task-review → CDD_TASK_REVIEW_FIXED_POINT；fix → CDD_FINDINGS）。
function requireEnv(env, mode) {
  const missing = [];
  for (const v of ["CDD_WORKSPACE", "CDD_TASK_BRIEF", "CDD_LEDGER", "CDD_MODE", "CDD_HANDOFF_PATH", "CDD_PLAN_CONSTRAINTS"]) {
    if (!env[v]) missing.push(v);
  }
  if (mode === "fix" && !env.CDD_FINDINGS) missing.push("CDD_FINDINGS");
  return missing.length > 0 ? `Missing required env: ${missing.join(" ")}` : null;
}

// renderModePrompt 的 {{PLACEHOLDER}} env 映射（bash 6 键 + TASK 超集键）。
function promptEnv(env, taskNum) {
  return {
    WORKSPACE: env.CDD_WORKSPACE,
    BRIEF: env.CDD_TASK_BRIEF,
    HANDOFF: env.CDD_HANDOFF_PATH,
    FINDINGS: env.CDD_FINDINGS,
    CONSTRAINTS: env.CDD_PLAN_CONSTRAINTS,
    FIXED_POINT: env.CDD_TASK_REVIEW_FIXED_POINT ?? "",  // empty string if cross-phase read returned nothing
    TASK: String(taskNum),
  };
}

// ---- review-package（非 dry-run review 模式）----

// 对齐 cdd_superpowers_scripts_dir：repo submodule → Claude/Cursor plugin cache（版本目录升序）。
// 第 1 参数为 repoRoot（#173：submodule 探测从项目仓库找 vendors，与调用方 cwd 解耦）。
// 导出供单测（T7 补回：findSuperpowersScriptsDir / byVersion）。
export function findSuperpowersScriptsDir(repoRoot) {
  if (repoRoot) {
    const probe = path.join(repoRoot, "vendors", "superpowers", "skills", "subagent-driven-development", "scripts");
    if (existsSync(path.join(probe, "sdd-workspace"))) return probe;
  }
  const cacheRoots = [
    path.join(os.homedir(), ".claude", "plugins", "cache", "oscaner", "superpowers"),
    path.join(os.homedir(), ".cursor", "plugins", "cache", "oscaner", "superpowers"),
  ];
  for (const cache of cacheRoots) {
    if (!existsSync(cache)) continue;
    const versions = readdirSync(cache).sort(byVersion);
    for (const ver of versions) {
      const scripts = path.join(cache, ver, "skills", "subagent-driven-development", "scripts");
      if (existsSync(path.join(scripts, "sdd-workspace"))) return scripts;
    }
  }
  return null;
}

// 简易版本排序（对齐 bash `sort -V` 升序）：数字段逐段比较，缓存探测取 oldest-first。
export function byVersion(a, b) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na !== nb) return na - nb;
  }
  return 0;
}

// 对齐 _cdd_relpath_from_repo：repo 内路径 → 相对 repo；否则绝对路径。
// 第 2 参数为 repoRoot（#173：由调用方 resolveRepoRoot 下传；无根 → 回退绝对路径）。
function relpathFromRepo(abs, repoRoot) {
  const resolved = path.resolve(abs);
  if (repoRoot && resolved.startsWith(`${repoRoot}/`)) return resolved.slice(repoRoot.length + 1);
  return resolved;
}

// 对齐 cdd_run_review_package：diff 文件名用 base/head 前 7 位。
function shortSha(sha) {
  return String(sha).slice(0, 7);
}

// 对齐 _cdd_run_review_package：spawn 上游 review-package 脚本，解析末行 `wrote <diff>:`，
// 把 diff 相对路径写进 handoff artifacts（Node 无 jq —— 直接 JSON 读写）。
// bash 对齐：`[[ -x review-package ]]` 可执行检查（spawn 前 accessSync X_OK）+ `wrote <diff>:`
// progress 行落到 stdout（operator 可见）。
// scriptsDir DI：单测可 override findSuperpowersScriptsDir（避免触达 repo/cache 真实路径）。
// cwd 选项语义 = 子进程执行目录（#173：调用方传 repoRoot —— review-package 在 plan 仓库内跑）。
// repoRoot 选项：#173 后调用方传入项目仓库根（bash 子进程 cwd 与 relpath 基准均基于它）；
// 键名沿用 `cwd`（历史直测 source-compatible），语义即「子进程工作目录 = repoRoot」。
export async function runReviewPackage(plan, base, head, handoffPath, { cwd: repoRoot, env, scriptsDir: scriptsDirOverride }) {
  const scriptsDir = scriptsDirOverride ?? findSuperpowersScriptsDir(repoRoot);
  if (!scriptsDir) throw new RunBlocked("upstream review-package script not found");
  const reviewPkg = path.join(scriptsDir, "review-package");
  try {
    accessSync(reviewPkg, constants.X_OK);
  } catch {
    throw new RunBlocked(`review-package not executable: ${reviewPkg}`);
  }
  const wsDir = path.dirname(handoffPath);
  const outFile = path.join(wsDir, `review-${shortSha(base)}..${shortSha(head)}.diff`);
  const res = await spawnCapture("bash", [reviewPkg, plan, base, head, outFile], { cwd: repoRoot, env });
  const outLine = res.stdout.trim().split("\n").filter(Boolean).pop() ?? "";
  const diffPath = outLine.match(/^wrote ([^:]+):/)?.[1] ?? "";
  if (!diffPath || !existsSync(diffPath)) {
    throw new RunBlocked(`review-package did not produce diff file (output: ${outLine})`);
  }
  process.stdout.write(`${outLine}\n`); // 对齐 bash：`wrote <diff>:` progress 行（stdout）
  const h = readJson(handoffPath) ?? {};
  writeHandoff(handoffPath, { artifacts: { ...(h.artifacts ?? {}), diff: relpathFromRepo(diffPath, repoRoot) } });
}

// ---- H1 输出 ----

// 对齐 _cdd_emit_h1_four_lines：从 agent stdout 文本取最后一个 ^key: 行；缺 → "<missing>"。
export function h1FourLines(raw) {
  const lines = String(raw).split("\n");
  const keys = ["status", "commits", "artifacts", "blocker"];
  const out = [];
  for (const key of keys) {
    let found = null;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].startsWith(`${key}:`)) {
        found = lines[i];
        break;
      }
    }
    out.push(found ?? `${key}: <missing>`);
  }
  return out;
}

// 对齐 _cdd_emit_h1_from_handoff（无 jq 依赖）：读 handoff JSON，缺失/损坏 → BLOCKED 兜底。
// artifacts 仅当存在时输出（与 bash 一致）。
export function h1FromHandoff(handoffPath) {
  if (!handoffPath || !existsSync(handoffPath)) {
    return h1FourLines("status: BLOCKED\nblocker: handoff missing after commit-contract interception → re-dispatch task after checking commit-contract errors");
  }
  const h = readJson(handoffPath);
  if (!h) {
    return h1FourLines("status: BLOCKED\nblocker: handoff JSON unparseable after commit-contract interception → delete the corrupted handoff file and re-dispatch");
  }
  const out = [
    `status: ${h.status ?? "BLOCKED"}`,
    `commits: base=${h.commits?.base ?? ""} head=${h.commits?.head ?? ""}`,
  ];
  const arts = [];
  for (const key of ["brief", "report", "test_evidence"]) {
    if (h.artifacts?.[key]) arts.push(`${key}=${h.artifacts[key]}`);
  }
  if (arts.length > 0) out.push(`artifacts: ${arts.join(" ")}`);
  out.push(`blocker: ${h.blocker ?? "uncommitted changes at return"}`);
  return out;
}

// ---- dry-run 仿真 ----

// 对齐 bash dry-run 分支的硬编码 H1 块（CDD_DRY_RUN=1）。
function dryRunH1Block(env, taskNum) {
  const ws = env.CDD_WORKSPACE;
  return [
    "status: APPROVED",
    "commits: base=dry-run",
    `artifacts: brief=${env.CDD_TASK_BRIEF} report=${ws}/task-${taskNum}-report.md test_evidence=${ws}/task-${taskNum}-test-evidence.json`,
    "blocker: none",
  ].join("\n");
}

// ---- runTask / runPlan ----

// 对齐 cdd_run_task。opts: { mode, planFile, dryRun, env, cwd, registryPath, probeSkills, channelMap, noExit, pluginRoot, scriptsDir, invokeCliOverride }。
// scriptsDir：DI 透传至 runReviewPackage（测试 seam，不改生产行为）。
// invokeCliOverride：test seam — async (briefPath, workspace, env) => { rc, stdout, stderr }。
// 返回 { exitCode, h1 }（noExit=true 时不 exitWithCode）。
export async function runTask(harness, taskNum, opts = {}) {
  const { mode, planFile, dryRun = false, noExit = false, invokeCliOverride = null } = opts;
  const probeSkills = opts.probeSkills;
  const pluginRootFn = opts.pluginRoot ?? pluginRoot;
  const channelMap = opts.channelMap ?? probeConfig.channel;
  const cwd = opts.cwd ?? process.cwd();
  const baseEnv = opts.env ?? process.env;
  const registryPath = opts.registryPath ?? REG_PATH;

  // 1. Registry ship gate + CLI preflight
  let entry;
  try {
    entry = checkHarness(loadRegistry(registryPath), harness, { dryRun });
  } catch (e) {
    if (e instanceof CddBlockedError) {
      return finish(e.exitCode, [], e.message, noExit, {
        stderrPrefix: e.kind === "cli-missing" ? "CDD_CLI_MISSING" : "CDD_BLOCKED",
      });
    }
    throw e;
  }

  const scriptsDir = opts.scriptsDir; // DI 透传至 runReviewPackage（测试 seam，不改生产行为）

  // 2. 有效 plan 合成 + repoRoot 解析（#173：入口统一，永不回退 cwd）+ workspace
  let workspace;
  let repoRoot;
  let plan;
  try {
    const rr = resolveRepoRoot({ planFile, env: baseEnv, ledgerPath: baseEnv.CDD_LEDGER });
    plan = rr.plan;
    repoRoot = rr.repoRoot; // 存入作用域——brief/review-package/scripts-dir 调用点使用
    workspace = resolveWorkspace({
      plan: rr.plan,
      planSource: rr.plan ? "plan" : "workspace", // 有效 plan → 派生分支；否则直设分支读 baseEnv.CDD_WORKSPACE
      env: baseEnv,
      repoRoot,
    });
  } catch (e) {
    if (e instanceof RunBlocked) return finish(1, [], e.message, noExit);
    throw e;
  }

  // 2.5 Skills gate — probe for required skill plugins via DI seam.
  //   probeSkills(harness, { cwd, env }) → { missing: [{plugin, installHint}], probeFailed }.
  //   Channel classification: install-and-use → exit 3; init → stderr hint + continue;
  //   probeFailed → fail-open (exit 0, warn).
  if (probeSkills) {
    let probeResult;
    try {
      probeResult = await probeSkills(harness, { cwd, env: baseEnv });
    } catch {
      probeResult = { missing: [], probeFailed: true };
    }
    if (probeResult.probeFailed) {
      process.stderr.write(`skills-probe: probe failed for ${harness}, failing open\n`);
    } else if (probeResult.missing.length > 0) {
      if (channelMap["install-and-use"]?.includes(harness)) {
        for (const m of probeResult.missing) {
          process.stderr.write(`${m.plugin}: ${m.installHint}\n`);
        }
        return finish(3, [], `missing skills: ${probeResult.missing.map((m) => m.plugin).join(", ")}`, noExit);
      } else {
        // init channel or unknown — warn and continue
        for (const m of probeResult.missing) {
          process.stderr.write(`skills-probe: ${m.plugin}: ${m.installHint}\n`);
        }
      }
    }
  }

  // 2.55 Templates existence check — BLOCKED exit 1 if missing (not exit 3).
  {
    try {
      const modeDir = path.join(pluginRootFn(), "skills", "cli-driven-development", "templates");
      const sharedDir = path.join(pluginRootFn(), "skills", "_templates");
      if (!existsSync(modeDir) && !existsSync(sharedDir)) {
        return finish(1, [], `templates missing: ${modeDir}`, noExit);
      }
    } catch {
      return finish(1, [], "templates missing: osuperpowers plugin root not found", noExit);
    }
  }

  // 4. Set env
  const progressDir = path.dirname(baseEnv.CDD_LEDGER ?? path.join(workspace, "progress.json"));
  const progressData = readProgressJSON(progressDir);
  const round = mode === "implement" ? 1 : getRound(progressData, taskNum, mode);
  const env = buildTaskEnv(baseEnv, workspace, taskNum, mode, harness, {
    round,
  });

  // （旧步骤 4 ledger PLAN_FILE backfill 已删除——plan 已在入口 resolveRepoRoot 定稿）

  // 5. Task-review / fix fixed-point — derive from prior-phase handoff (cross-phase read).
  if (mode === "task-review" || mode === "fix") {
    if (!env.CDD_TASK_REVIEW_FIXED_POINT) {
      const prev = prevHandoffPath(workspace, taskNum, mode, round);
      if (prev) {
        const prevCommitsBase = readJsonField(prev, ["commits", "base"]);
        if (prevCommitsBase && prevCommitsBase !== "unknown") {
          env.CDD_TASK_REVIEW_FIXED_POINT = prevCommitsBase;
        }
      }
    }
    if (dryRun && !env.CDD_TASK_REVIEW_FIXED_POINT) env.CDD_TASK_REVIEW_FIXED_POINT = "HEAD~1";
  }

  // 6. require env / mode validation
  const modeErr = validateMode(mode);
  if (modeErr) return finish(1, [], modeErr, noExit);
  const missing = requireEnv(env, mode);
  if (missing) return finish(1, [], missing, noExit);

  // 7. Render prompt
  let prompt;
  try {
    prompt = renderModePrompt(mode, promptEnv(env, taskNum));
  } catch (e) {
    return finish(1, [], `template render failed: ${e.message}`, noExit);
  }

  // 8. Invoke CLI（或 dry-run 仿真）
  let agentOut = "";
  let agentRc = 0;
  let cliStderr = "";
  let timedOut = false;
  let unkillable = false;
  if (dryRun) {
    agentOut = dryRunH1Block(env, taskNum);
  } else if (invokeCliOverride) {
    // Test seam: invokeCliOverride(briefPath, workspace, env) → { rc, stdout, stderr }
    const { rc, stdout, stderr } = await invokeCliOverride(env.CDD_TASK_BRIEF, workspace, env);
    agentRc = rc !== 0 ? rc : 0;
    agentOut = rc === 0 ? stdout : "";
    cliStderr = stderr;
    timedOut = false;
    unkillable = false;
  } else {
    const timeoutMs = resolveTimeoutMs(env, "task");
    const res = await invokeCli(entry, prompt, mode, env, cwd, timeoutMs);
    agentOut = res.ok ? res.stdout : "";
    cliStderr = res.stderr;
    timedOut = res.timedOut === true;
    unkillable = res.unkillable === true;
    if (!res.ok && !timedOut) agentRc = res.code;
  }

  // 8.5 Timeout path — 在 commit-contract 验证前写入 partial handoff。
  //   timedOut && !unkillable → TIMEOUT partial handoff（status=TIMEOUT + blocker + 已有 findings）；
  //   timedOut && unkillable  → BLOCKED handoff（process unkillable）。
  //   进度：递增 progress.md timeoutCount。
  if (timedOut) {
    const existingHandoff = readJson(env.CDD_HANDOFF_PATH);
    if (unkillable) {
      writeHandoff(env.CDD_HANDOFF_PATH, {
        task: taskNum,
        phase: mode,
        status: "BLOCKED",
        findings: [],
        artifacts: {},
        blocker: `cli process unkillable after timeout → manually kill the process (check ps), then re-dispatch task ${taskNum}`,
      });
      if (!dryRun) incrementRound(path.dirname(env.CDD_LEDGER), taskNum, mode);
      return finish(1, h1FromHandoff(env.CDD_HANDOFF_PATH), "process unkillable", noExit);
    }
    // Normal timeout: TIMEOUT partial handoff
    const timeoutMs = resolveTimeoutMs(env, "task");
    writeHandoff(env.CDD_HANDOFF_PATH, {
      task: taskNum,
      phase: mode,
      status: "TIMEOUT",
      findings: [],
      artifacts: {},
      blocker: `cli timed out after ${timeoutMs}ms → simplify task ${taskNum} scope or increase timeout, then re-dispatch`,
    });
    if (!dryRun) incrementRound(path.dirname(env.CDD_LEDGER), taskNum, mode);
    // Increment timeoutCount in progress.json
    const timeoutProgressData = readProgressJSON(path.dirname(env.CDD_LEDGER));
    timeoutProgressData.timeoutCount++;
    writeProgressJSON(path.dirname(env.CDD_LEDGER), timeoutProgressData);
    return finish(1, h1FromHandoff(env.CDD_HANDOFF_PATH), `cli timed out after ${timeoutMs}ms`, noExit);
  }

  // 8.8 Handoff JSON Schema validation — reject malformed handoffs before downstream processing.
  {
    const existingHandoff = readJson(env.CDD_HANDOFF_PATH);
    if (existingHandoff) {
      const sv = validateHandoffSchema(existingHandoff);
      if (!sv.valid) {
        writeHandoff(env.CDD_HANDOFF_PATH, {
          task: taskNum,
          phase: mode,
          status: "BLOCKED",
          findings: [],
          artifacts: {},
          blocker: `handoff schema invalid: ${sv.reason} → fix the handoff JSON at ${env.CDD_HANDOFF_PATH} and re-dispatch task ${taskNum}`,
        });
        if (!dryRun) incrementRound(path.dirname(env.CDD_LEDGER), taskNum, mode);
        return finish(1, h1FromHandoff(env.CDD_HANDOFF_PATH), `schema validation failed: ${sv.reason}`, noExit);
      }
    }
  }

  // 10. 嵌套 CLI 失败且无 handoff → 写 BLOCKED handoff（stderr 进 blocker）+ H1-from-handoff +
  //     stderr CDD_BLOCKED 诊断 + exit 1（对齐 bash cdd_exit_blocked）。唯一 sanctioned divergence：
  //     Node 额外写 handoff（§spec 2.1 stderr-surfacing）—— bash 为 emit 原始 agent H1 + exit 1。
  if (agentRc !== 0 && !existsSync(env.CDD_HANDOFF_PATH)) {
    writeHandoff(env.CDD_HANDOFF_PATH, {
      task: taskNum,
      phase: mode,
      status: "BLOCKED",
      commits: { base: "unknown" },
      findings: [],
      artifacts: {},
      blocker: `cli exited ${agentRc} without writing handoff → check stderr above for errors, fix, then re-dispatch task ${taskNum}`,
    });
    if (!dryRun) incrementRound(path.dirname(env.CDD_LEDGER), taskNum, mode);
    return finish(1, h1FromHandoff(env.CDD_HANDOFF_PATH), `cli exited ${agentRc} and handoff missing`, noExit);
  }

  // 10.5. CLI succeeded but no handoff → BLOCKED (file-existence check, not phase-mismatch fallback).
  // Agent exits 0 without writing handoff = error, not success — write BLOCKED and return exit 1.
  // dry-run excluded: bash dry-run 不写 handoff, Node 亦不写.
  if (agentRc === 0 && !dryRun && !existsSync(env.CDD_HANDOFF_PATH)) {
    writeHandoff(env.CDD_HANDOFF_PATH, {
      task: taskNum,
      phase: mode,
      status: "BLOCKED",
      findings: [],
      artifacts: {},
      blocker: `${path.basename(env.CDD_HANDOFF_PATH)} not written after exit 0 → re-run ${mode} and ensure handoff is written to ${env.CDD_HANDOFF_PATH} before exit`,
    });
    incrementRound(path.dirname(env.CDD_LEDGER), taskNum, mode);
    return finish(1, h1FromHandoff(env.CDD_HANDOFF_PATH), `${mode} agent did not write handoff`, noExit);
  }

  // 11. H1 四行（来自 agent stdout / dry-run 块）
  const h1 = h1FourLines(agentOut);

  // 12. agent 失败但 handoff 存在 → exit agent_rc
  if (agentRc !== 0) {
    return finish(agentRc, h1, "", noExit);
  }

  // 13. OK（dry-run 不写 handoff —— 对齐 bash：bash dry-run 分支不写，Node 亦不写）
  return finish(0, h1, "", noExit);
}


// ---- plan 构建块（纯函数，单测 seam）----

// 对齐 _task_numbers_from_plan：`^### Task N:` → 数字排序。
export function taskNumbersFromPlan(planFile) {
  const nums = [];
  for (const line of readFileSync(planFile, "utf8").split("\n")) {
    const m = line.match(/^### Task (\d+):/);
    if (m) nums.push(Number(m[1]));
  }
  return nums.sort((a, b) => a - b);
}

// 对齐 _ledger_complete：ledger 含 `^Task N: complete` 行。
function ledgerComplete(n, ledgerPath) {
  if (!ledgerPath || !existsSync(ledgerPath)) return false;
  return new RegExp(`^Task ${n}: complete`).test(readFileSync(ledgerPath, "utf8"));
}

// 读取最新 task-review handoff 的 status（progressData.rounds["task-review"] 轮次）。
// reviewRound=0 → 无 task-review 完成记录 → "MISSING"；损坏 → "UNKNOWN"。
export function handoffStatus(taskNum, workspace, progressData) {
  // For latest review: reads task-N-task-review-R.json where R = rounds["task-review"]
  const reviewRound = progressData?.tasks?.find(t => t.task === taskNum)?.rounds?.["task-review"] ?? 0;
  if (reviewRound === 0) return "MISSING";
  const handoffPath = path.join(workspace, `task-${taskNum}-task-review-${reviewRound}.json`);
  if (!existsSync(handoffPath)) return "MISSING";
  try {
    return normalizeHandoffStatus(JSON.parse(readFileSync(handoffPath, "utf8")).status ?? "UNKNOWN");
  } catch { return "UNKNOWN"; }
}

// task-review 轮次=0 → 从未完成 task-review → pending；否则读最新 task-review handoff status。
export function isTaskPending(taskNum, workspace, progressData) {
  const reviewRound = progressData?.tasks?.find(t => t.task === taskNum)?.rounds?.["task-review"] ?? 0;
  if (reviewRound === 0) return true; // no task-review ever completed
  return handoffStatus(taskNum, workspace, progressData) !== "APPROVED";
}
