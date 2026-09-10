// packages/cdd-engine/bin/lib/runner.mjs — CDD per-task runner (Node port of cdd_run_task).
// H1 four-line output is exclusive (spec v3): this module is responsible for formatting status/commits/artifacts/blocker.
// runTask ordered contract: registry ship gate → CLI preflight → workspace/env → ledger PLAN_FILE
// backfill → review fixed-point → require env → renderModePrompt → nested CLI spawn (captures stderr,
// not swallowed via 2>/dev/null) → commit-contract → H1 four lines → handoff processing.
// noExit=true returns { exitCode, h1 } instead of exit helpers — the unit-test seam.
// Final exit delegated to utils/exit.mjs (unified exit point, no inline process.exit).
import { accessSync, constants, existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import semver from "semver";

import { loadRegistry, checkHarness, CddBlockedError } from "./registry.mjs";
import { renderModePrompt, pluginRoot } from "./templates.mjs";
import { writeHandoff, writeOwnHandoff, readJson, gitToplevel, normalizeHandoffStatus, validateCommitContract } from "./contract.mjs";
import { handoffName, prevHandoffPath as hnPreHandoffPath } from "./handoff-naming.mjs";
import { finalizeHandoff, persistFinalized } from "./handoff-finalize.mjs";
import { exitOk, exitBlocked, exitCliMissing, exitWithCode } from "../utils/exit.mjs";
import { spawnCapture, invokeCli, invokeCliWithRetry, resolveTimeoutMs } from "./cli-shared.mjs";
import { readProgressJSON, writeProgressJSON, migrateIfNeeded, getRound, incrementRound, incrementRecovery } from "./progress.mjs";
import { validateHandoffSchema } from "./schema-utils.mjs";

// Re-export for backward compatibility (existing tests and consumers import from runner.mjs).
export { spawnCapture, invokeCli };

const REG_PATH = fileURLToPath(new URL("../harness-registry.json", import.meta.url));
const VALID_MODES = ["implement", "review", "fix"];

// mode → invokeCli (op, type?) 注入参数。
//   review → ("review","task")；fix → ("fix","task")；implement → ("implement", null)。
//   prefix 值经 registry resolveInjection（entry.prefix[op][type?]）解析（见 cli-shared.mjs）。
const INVOKE_PARAMS = {
  review: { op: "review", type: "task" },
  fix: { op: "fix", type: "task" },
  implement: { op: "implement" },
};

// Local orchestration error: carries exit code; caught by runTask/runPlan then finish().
class RunBlocked extends Error {
  constructor(message, exitCode = 1) {
    super(message);
    this.exitCode = exitCode;
  }
}

// Final exit: noExit=false → write H1 lines (if non-empty) to stdout + stderr message + exitWithCode;
// noExit=true → return { exitCode, h1 } only (runPlan composition / unit tests).
function finish(exitCode, h1, msg, noExit, { stderrPrefix = "CDD_BLOCKED" } = {}) {
  if (msg) process.stderr.write(`${stderrPrefix}: ${msg}\n`);
  if (!noExit) {
    for (const line of h1) process.stdout.write(`${line}\n`);
    exitWithCode(exitCode);
  }
  return { exitCode, h1 };
}

// ---- workspace / env ----

// Effective plan is resolved from three sources (opt ‖ env.PLAN_FILE ‖ ledger backfill).
// resolveRepoRoot branch logic and error messages are all based on this effective plan (#173: never fall back to cwd).
// Branch rules:
//   plan exists → plan-derived branch: existsSync pre-check ("plan file not found") →
//     repoRoot = gitToplevel(dirname(plan)), failure → "not in a git repo";
//     workspace = <repoRoot>/.superpowers/cdd/<slug>/
//   no plan + CDD_WORKSPACE present → direct-set branch (current behavior): workspace = env value as-is;
//     repoRoot = gitToplevel(workspace), null allowed (tolerated downstream)
//   neither → RunBlocked "cannot resolve repo root: provide --plan or CDD_WORKSPACE"
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
    // repoRoot may be null (tolerated downstream: scripts-dir skips submodule probe / relpath falls back to absolute path).
    return { plan: "", repoRoot: gitToplevel(env.CDD_WORKSPACE) };
  }
  throw new RunBlocked("cannot resolve repo root: provide --plan or CDD_WORKSPACE");
}

// Pure derivation (root resolved by resolveRepoRoot, injected as the third param): plan → <repoRoot>/.superpowers/cdd/<slug>/;
// no plan + CDD_WORKSPACE → env value as-is; neither → RunBlocked.
// Workspace resolution (purely derived after #173, repoRoot provided by resolveRepoRoot):
//   plan present (planFile = effective plan, including env.PLAN_FILE/backfill sources) → plan-derived branch
//     <repoRoot>/.superpowers/cdd/<slug>/;
//   no plan + env.CDD_WORKSPACE → direct-set branch (current behavior): workspace = env value as-is.
// Branch selection explicitly declared via planSource ("plan" | "workspace") — caller decides based on resolveRepoRoot
// result, eliminating the control coupling of "faking an empty env to drive internal branching".
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

// Aligns _cdd_set_task_env: workspace-derived paths, defaulted only when unset (`${VAR:-default}` semantics);
// CDD_WORKSPACE / CDD_MODE / CDD_HARNESS are forced. Returns a new env object (does not mutate baseEnv).
// round: derives per-round handoff path for review/fix modes; implement always produces task-N-implement.json.
// findingsPath (cdd fix --findings): explicit handoff path for this fix round — takes precedence over the
//   runner-derived prev-phase path (otherwise the fix CLI's --findings would be dead code).
export function buildTaskEnv(baseEnv, workspace, task, mode, harness, { round = 1, findingsPath } = {}) {
  const env = { ...baseEnv };
  env.CDD_WORKSPACE = workspace;
  env.CDD_HARNESS = harness;
  env.CDD_LEDGER ||= path.join(workspace, "progress.json");
  env.CDD_TASK_BRIEF ||= path.join(workspace, `task-${task}-brief.md`);
  // Per-phase per-round handoff path (unconditional — canonical handoff-naming 派生):
  // implement 用 fixed 族（无 round）；review/fix 用 round 族。非法 mode 回落旧拼字
  // （派生层只认 canonical 族名，未知族 throw 会打乱后续 validateMode 的拒绝路径）。
  let handoffFile;
  if (mode === "implement") {
    handoffFile = handoffName("implement", "task", { task });
  } else if (mode === "review" || mode === "fix") {
    handoffFile = handoffName(mode, "task", { task, round });
  } else {
    handoffFile = `task-${task}-${mode}-${round}.json`;
  }
  env.CDD_HANDOFF_PATH = path.join(workspace, handoffFile); // unconditional assignment
  env.CDD_PLAN_CONSTRAINTS ||= path.join(workspace, "plan-constraints.md");
  env.CDD_MODE = mode;
  if (mode !== "fix") {
    env.CDD_FINDINGS ||= path.join(workspace, `task-${task}-open-findings.json`);
  }
  if (mode === "fix") {
    // CDD_FINDINGS: cdd fix --findings opt wins when provided; otherwise the runner-derived
    // review-R.json path for this fix round (no scope filter).
    env.CDD_FINDINGS = findingsPath ?? prevHandoffPath(workspace, task, mode, round);
  }
  return env;
}

// Aligns _cdd_plan_from_ledger: legacy fallback — only effective for pre-migration progress.md (first line
// `# CDD ledger — plan: <path>`); progress.json does not contain that line, returns "" when regex does not match.
function backfillPlanFromLedger(ledgerPath) {
  if (!ledgerPath || !existsSync(ledgerPath)) return "";
  const first = readFileSync(ledgerPath, "utf8").split("\n", 1)[0] ?? "";
  const m = first.match(/^# CDD ledger — plan: (.+)$/);
  return m ? m[1].trim() : "";
}

// Read nested JSON field (commits.base / commits.head); missing/corrupt → "".
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

// readJson 收口 contract.mjs（T7 nit2：三处私有副本统一单点；本文件历史私有 readJson 已删）。

// Returns the path of the handoff written by the previous phase for this task
//（文件名经 canonical handoff-naming 派生；跨族 prev 表语义保留）。
// runner 的 prev 依赖收口到 handoff-naming（canonical prev 表）：
// mode "review" → review.task，mode "fix" → fix.task（跨族 prev 语义在 canonical 表内）。
// 返回路径或 null（implement 无 prior）。task-mode 三合一（review/filexce）。
function prevHandoffPath(workspace, task, mode, round) {
  if (mode !== "review" && mode !== "fix") return null; // implement has no prior phase
  return hnPreHandoffPath(workspace, mode, "task", round, { task });
}

// Aligns cdd_require_env mode validation.
function validateMode(mode) {
  if (!VALID_MODES.includes(mode)) return `CDD_MODE must be implement|review|fix (got: ${mode})`;
  return null;
}

// Aligns cdd_require_env: required CDD_* vars + mode-specific extras (review → CDD_TASK_REVIEW_FIXED_POINT; fix → CDD_FINDINGS).
function requireEnv(env, mode) {
  const missing = [];
  for (const v of ["CDD_WORKSPACE", "CDD_TASK_BRIEF", "CDD_LEDGER", "CDD_MODE", "CDD_HANDOFF_PATH", "CDD_PLAN_CONSTRAINTS"]) {
    if (!env[v]) missing.push(v);
  }
  if (mode === "fix" && !env.CDD_FINDINGS) missing.push("CDD_FINDINGS");
  return missing.length > 0 ? `Missing required env: ${missing.join(" ")}` : null;
}

// {{PLACEHOLDER}} env mapping for renderModePrompt (bash 6 keys + TASK superset key).
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

// ---- review-package (non-dry-run review mode) ----

// Aligns cdd_superpowers_scripts_dir: repo submodule → Claude/Cursor plugin cache (version dirs in ascending order).
// First arg is repoRoot (#173: submodule probe finds vendors under the project repo, decoupled from caller cwd).
// Exported for unit tests. semver ascending sort (replaces hand-written byVersion — aligns with bash sort -V).
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
    const versions = readdirSync(cache)
      .filter(v => semver.valid(v))   // filter out non-valid semver directory names
      .sort(semver.compare);           // semver.compare(a,b) returns -1|0|1 (ascending order)
    for (const ver of versions) {
      const scripts = path.join(cache, ver, "skills", "subagent-driven-development", "scripts");
      if (existsSync(path.join(scripts, "sdd-workspace"))) return scripts;
    }
  }
  return null;
}

// Aligns _cdd_relpath_from_repo: path inside repo → relative to repo; otherwise absolute path.
// Second arg is repoRoot (#173: passed down from caller resolveRepoRoot; no root → falls back to absolute path).
function relpathFromRepo(abs, repoRoot) {
  const resolved = path.resolve(abs);
  if (repoRoot && resolved.startsWith(`${repoRoot}/`)) return resolved.slice(repoRoot.length + 1);
  return resolved;
}

// Aligns cdd_run_review_package: diff filename uses first 7 chars of base/head.
function shortSha(sha) {
  return String(sha).slice(0, 7);
}

// Aligns _cdd_run_review_package: spawns upstream review-package script, parses the last `wrote <diff>:` line,
// writes the diff relative path into handoff artifacts (no jq in Node — reads/writes JSON directly).
// bash alignment: `[[ -x review-package ]]` executability check (accessSync X_OK before spawn) + `wrote <diff>:`
// progress line printed to stdout (visible to operator).
// scriptsDir DI: unit tests can override findSuperpowersScriptsDir (avoids touching real repo/cache paths).
// cwd option semantics = subprocess working directory (#173: caller passes repoRoot — review-package runs inside the plan repo).
// repoRoot option: after #173 caller passes project repo root (bash subprocess cwd and relpath base both derived from it);
// key name kept as `cwd` (historically source-compatible), semantics: subprocess working directory = repoRoot.
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
  process.stdout.write(`${outLine}\n`); // aligns bash: `wrote <diff>:` progress line (stdout)
  const h = readJson(handoffPath) ?? {};
  writeHandoff(handoffPath, { artifacts: { ...(h.artifacts ?? {}), diff: relpathFromRepo(diffPath, repoRoot) } });
}

// ---- H1 output ----

// Aligns _cdd_emit_h1_four_lines: picks the last ^key: line from agent stdout; missing → "<missing>".
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

// Aligns _cdd_emit_h1_from_handoff (no jq dependency): reads handoff JSON, missing/corrupt → BLOCKED fallback.
// artifacts only emitted when present (consistent with bash).
// blocker 缺省单点（T6 nit4）：review 成功/无阻断语义 → none；其余 → commit-contract 缺省文案。
// h1FromHandoff 缺省与 h1Blocker 折叠共用此映射（两处不再各写一份）。
function defaultBlockerFor(status) {
  return status === "APPROVED" || status === "CHANGES_REQUESTED"
    ? "none"
    : "uncommitted changes at return";
}

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
  out.push(`blocker: ${h.blocker ?? defaultBlockerFor(h.status)}`);
  return out;
}

// ---- dry-run simulation ----

// Aligns bash dry-run branch hardcoded H1 block (CDD_DRY_RUN=1).
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

// Aligns cdd_run_task. opts: { mode, planFile, dryRun, env, cwd, registryPath,
//   noExit, pluginRoot, scriptsDir, findingsPath }.
// findingsPath: explicit CDD_FINDINGS path for fix mode (cdd fix --findings) — wins over
//   buildTaskEnv's runner-derived prev-phase handoff path.
// scriptsDir: DI passed through to runReviewPackage (test seam, does not change production behavior).
// Returns { exitCode, h1 } (does not call exitWithCode when noExit=true).
export async function runTask(harness, taskNum, opts = {}) {
  const { mode, planFile, dryRun = false, noExit = false } = opts;
  const pluginRootFn = opts.pluginRoot ?? pluginRoot;
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

  const scriptsDir = opts.scriptsDir; // DI passed through to runReviewPackage (test seam, does not change production behavior)

  // 2. Effective plan synthesis + repoRoot resolution (#173: unified entry, never falls back to cwd) + workspace
  let workspace;
  let repoRoot;
  let plan;
  try {
    const rr = resolveRepoRoot({ planFile, env: baseEnv, ledgerPath: baseEnv.CDD_LEDGER });
    plan = rr.plan;
    repoRoot = rr.repoRoot; // stored in scope — used by brief/review-package/scripts-dir call sites
    workspace = resolveWorkspace({
      plan: rr.plan,
      planSource: rr.plan ? "plan" : "workspace", // plan present → derived branch; otherwise direct-set branch reads baseEnv.CDD_WORKSPACE
      env: baseEnv,
      repoRoot,
    });
  } catch (e) {
    if (e instanceof RunBlocked) return finish(1, [], e.message, noExit);
    throw e;
  }

  // 2.5 Templates existence check — BLOCKED exit 1 if missing (not exit 3).
  // cdd-engine is self-contained: templates live at <pkg>/templates (migration task 7
  // removed the legacy skills/cli-driven-development/templates + skills/_templates layout).
  {
    try {
      const tplDir = path.join(pluginRootFn(), "templates");
      if (!existsSync(tplDir)) {
        return finish(1, [], `templates missing: ${tplDir}`, noExit);
      }
    } catch {
      return finish(1, [], "templates missing: cdd-engine package root not found", noExit);
    }
  }

  // 4. Set env
  const progressDir = path.dirname(baseEnv.CDD_LEDGER ?? path.join(workspace, "progress.json"));
  const progressData = readProgressJSON(progressDir);
  const round = mode === "implement" ? 1 : getRound(progressData, taskNum, mode);
  const env = buildTaskEnv(baseEnv, workspace, taskNum, mode, harness, {
    round,
    findingsPath: opts.findingsPath,
  });

  // (old step 4 ledger PLAN_FILE backfill removed — plan is finalized at the entry in resolveRepoRoot)

  // 5. Task-review / fix fixed-point — derive from prior-phase handoff (cross-phase read).
  if (mode === "review" || mode === "fix") {
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

  // 8. Invoke CLI (or dry-run simulation)
  let agentOut = "";
  let agentRc = 0;
  let cliStderr = "";
  let timedOut = false;
  let unkillable = false;
  if (dryRun) {
    agentOut = dryRunH1Block(env, taskNum);
  } else {
    const timeoutMs = resolveTimeoutMs(env, "task");
    const res = await invokeCliWithRetry(entry, prompt, INVOKE_PARAMS[mode], env, cwd, timeoutMs);
    agentOut = res.ok ? res.stdout : "";
    cliStderr = res.stderr;
    timedOut = res.timedOut === true;
    unkillable = res.unkillable === true;
    if (!res.ok && !timedOut) agentRc = res.code;
  }

  // 8.5 Timeout path — write partial handoff before commit-contract validation.
  //   timedOut && !unkillable → TIMEOUT partial handoff (status=TIMEOUT + blocker + existing findings);
  //   timedOut && unkillable  → BLOCKED handoff (process unkillable).
  //   Progress: increment progress.md timeoutCount.
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
      if (!dryRun) {
        incrementRound(path.dirname(env.CDD_LEDGER), taskNum, mode);
        incrementRecovery(progressDir); // D14: engine 自写 BLOCKED → engineRecoveryCount 自增（BLOCKED/engine-error 判定路径）
      }
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
    const timeoutProgressData = readProgressJSON(progressDir);
    timeoutProgressData.timeoutCount++;
    writeProgressJSON(progressDir, timeoutProgressData);
    return finish(1, h1FromHandoff(env.CDD_HANDOFF_PATH), `cli timed out after ${timeoutMs}ms`, noExit);
  }

  // 8.8 Handoff JSON Schema validation — reject malformed handoffs before downstream processing.
  // T7: implement 门控（mode !== "implement"）—— HANDOFF 路径对 implement 不是输入通道，engine 不去读
  //（engine 是载体唯一作者，implement agent 经 implement.md 不写 handoff，13 步由 finalizeHandoff 实体化）。
  // review/fix 保留读取校验（agent 是内容作者，findings 内容契约）。
  if (mode !== "implement") {
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
        if (!dryRun) {
          incrementRound(path.dirname(env.CDD_LEDGER), taskNum, mode);
          incrementRecovery(progressDir); // D14: engine 自写 BLOCKED → engineRecoveryCount 自增
        }
        return finish(1, h1FromHandoff(env.CDD_HANDOFF_PATH), `schema validation failed: ${sv.reason}`, noExit);
      }
    }
  }

  // 10. Nested CLI failed with no handoff → write BLOCKED handoff (stderr into blocker) + H1-from-handoff +
  //     stderr CDD_BLOCKED diagnostic + exit 1 (aligns bash cdd_exit_blocked). Only sanctioned divergence:
  //     Node additionally writes handoff (§spec 2.1 stderr-surfacing) — bash emits raw agent H1 + exit 1.
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
    if (!dryRun) {
      incrementRound(path.dirname(env.CDD_LEDGER), taskNum, mode);
      incrementRecovery(progressDir); // D14: engine 自写 BLOCKED → engineRecoveryCount 自增
    }
    return finish(1, h1FromHandoff(env.CDD_HANDOFF_PATH), `cli exited ${agentRc} and handoff missing`, noExit);
  }

  // 10.5. CLI succeeded but no handoff → BLOCKED (file-existence check, not phase-mismatch fallback).
  // Agent exits 0 without writing handoff = error, not success — write BLOCKED and return exit 1.
  // dry-run excluded: bash dry-run does not write handoff, Node does not either.
  // implement excluded (T6): runner 实体化写盘在 13 步 OK 路径 —— implement 分支本检查不触发
  //（实现链 agent 经 implement.md 不再写 handoff，残留检查会误 BLOCKED 每次成功实现）。
  if (agentRc === 0 && !dryRun && mode !== "implement" && !existsSync(env.CDD_HANDOFF_PATH)) {
    writeHandoff(env.CDD_HANDOFF_PATH, {
      task: taskNum,
      phase: mode,
      status: "BLOCKED",
      findings: [],
      artifacts: {},
      blocker: `${path.basename(env.CDD_HANDOFF_PATH)} not written after exit 0 → re-run ${mode} and ensure handoff is written to ${env.CDD_HANDOFF_PATH} before exit`,
    });
    incrementRound(path.dirname(env.CDD_LEDGER), taskNum, mode);
    incrementRecovery(progressDir); // D14: engine 自写 BLOCKED → engineRecoveryCount 自增（10.5 退出码 0 未写 handoff 判定路径）
    return finish(1, h1FromHandoff(env.CDD_HANDOFF_PATH), `${mode} agent did not write handoff`, noExit);
  }

  // 11. H1 four lines (from agent stdout / dry-run block)
  let h1 = h1FourLines(agentOut);

  // 12. agent failed but handoff exists → exit agent_rc
  if (agentRc !== 0) {
    return finish(agentRc, h1, "", noExit);
  }

  // 13. OK (dry-run does not write handoff — aligns bash: bash dry-run branch does not write, Node does not either).
  //     Advance the round counter on success too — rounds[mode] must reflect the last COMPLETED dispatch so
  //     handoffStatus/isTaskPending (rounds["review"] >= 1) see successful reviews as done (Bug N
  //     task-complete? contract). Previously only failure paths incremented, leaving successes at round 0.
  //     T5: status 单一权威 — review 型 handoff 由 engine 从 findings 派生覆写（SP-4 豁免失败轮次）；
  //     成功路径读回 handoff 覆写并持久化，H1 同步用 h1FromHandoff（T6 收敛 H1 单源）。
  //     T6: implement 实体化 — agent 不写 handoff（implement.md 已删 Handoff Output 段），runner 从
  //     H1 四行 + brief TASK_BASE + git HEAD 构造 task-N-implement.json（commits 单一权威），
  //     evidence-gate 回读校验（behavior_change:true → hard；其余 → soft WARN），H1 改 h1FromHandoff 重发。
  //     T7: handoff 载体 engine 归位 — implement/review 定稿统一走 finalizeHandoff（三消费方共享单点），
  //     定稿写盘用 writeOwnHandoff（engine 载体唯一作者，全量覆盖替换），H1 一律从定稿 h1FromHandoff 重发。
  //     T8: post-run commit-contract 全 mode 接线（13.5）+ APPROVED review 回写 task.status=complete。
  if (!dryRun && mode === "implement") {
    const finalized = finalizeHandoff({
      mode,
      h1,
      brief: env.CDD_TASK_BRIEF,
      repoRoot,
      workspace: env.CDD_WORKSPACE,
      taskNum,
    });
    if (finalized.handoff) {
      // 定稿写盘全量覆盖：agent 写残留进不了载体（无残留兼容层）。
      writeOwnHandoff(env.CDD_HANDOFF_PATH, finalized.handoff);
      h1 = h1FromHandoff(env.CDD_HANDOFF_PATH);
      // 实体化后 H1 与 handoff/exit 一致：hard gate 或 agent 声明 BLOCKED → exit 1。
      if (finalized.exitCode !== 0) {
        return finish(finalized.exitCode, h1, "", noExit);
      }
    }
    // 降级例外（T6 nit2，文档化）：brief 缺失 / 无 TASK_BASE 行 → finalizeHandoff 不实体化
    //（handoff:null + stderr CDD_WARN；保留 agent 原样 H1）。dry-run 与 smoke 链均走此处 ——
    // 绝不允许 ENOENT 崩溃 runner。「implement 后 handoff 必在」断言仅对正常实体化路径成立。
  }

  // 13.5 T8: post-run commit-contract —— 全 task mode 接线（implement/fix/review）。
  //   implement/fix：dirty + head 校验（validateCommitContract 已内建 rewriteHandoffBlocked）；
  //   review：仅 dirty（review handoff 的 commits 语义为被审 commit，跳过 head）。
  //   !dryRun 守卫：dry-run 不写任何 handoff 不变式 —— 否则 dirty 工作树（如未提交 emit 产物的
  //   smoke 链）会经 rewriteHandoffBlocked 真写 BLOCKED 文件、污染 dry-run 语义。
  //   必须先于 review 的 status=complete 回写：dirty 失败轮不误标 complete。
  if (!dryRun) {
    const cv = validateCommitContract(mode, repoRoot ?? "", { handoffPath: env.CDD_HANDOFF_PATH });
    if (!cv.ok) {
      incrementRecovery(progressDir); // D14: engine 自写 BLOCKED（commit-contract 重写）→ engineRecoveryCount 自增
      return finish(1, h1FromHandoff(env.CDD_HANDOFF_PATH), cv.blocker, noExit);
    }
  }

  // T5/T7: status 单一权威 — review 型 handoff 由 engine 定稿（finalizeHandoff rollup 派生覆写，
  // SP-4 豁免失败轮次）；成功路径读回定稿并持久化（writeOwnHandoff 全量覆盖），H1 同步用 h1FromHandoff。
  // T8: APPROVED review 回写 progress task.status=complete（读回握手 finalizeHandoff 之后，
  // 且在 post-run validate 通过之后 —— dirty 失败轮不标 complete）。
  if (!dryRun && mode === "review") {
    const reviewHandoff = readJson(env.CDD_HANDOFF_PATH);
    if (reviewHandoff) {
      const finalized = finalizeHandoff({ mode, agentHandoff: reviewHandoff });
      // persistFinalized：派生无变化（同引用）→ skip 写盘（不产生 no-op 覆盖）；有变化 → 全量覆盖 + sync。
      persistFinalized(env.CDD_HANDOFF_PATH, reviewHandoff, finalized);
      h1 = h1FromHandoff(env.CDD_HANDOFF_PATH);
      if (normalizeHandoffStatus(reviewHandoff.status) === "APPROVED") {
        const progressDir2 = path.dirname(env.CDD_LEDGER);
        const progressData2 = readProgressJSON(progressDir2);
        let taskEntry = progressData2.tasks.find((t) => t.task === taskNum);
        if (!taskEntry) {
          taskEntry = { task: taskNum, status: "pending", rounds: {} };
          progressData2.tasks.push(taskEntry);
        }
        taskEntry.status = "complete";
        writeProgressJSON(progressDir2, progressData2);
      }
    }
  }
  if (!dryRun && mode !== "implement") incrementRound(path.dirname(env.CDD_LEDGER), taskNum, mode);
  return finish(0, h1, "", noExit);
}


// ---- plan building blocks (pure functions, unit-test seam) ----

// Aligns _task_numbers_from_plan: `^### Task N:` → numeric sort.
export function taskNumbersFromPlan(planFile) {
  const nums = [];
  for (const line of readFileSync(planFile, "utf8").split("\n")) {
    const m = line.match(/^### Task (\d+):/);
    if (m) nums.push(Number(m[1]));
  }
  return nums.sort((a, b) => a - b);
}

// Read the status of the latest review handoff (progressData.rounds["review"] round).
// reviewRound=0 → no review completion record → "MISSING"; corrupt → "UNKNOWN".
export function handoffStatus(taskNum, workspace, progressData) {
  // For latest review: reads task-N-review-R.json where R = rounds["review"]
  const reviewRound = progressData?.tasks?.find(t => t.task === taskNum)?.rounds?.["review"] ?? 0;
  if (reviewRound === 0) return "MISSING";
  const handoffPath = path.join(workspace, handoffName("review", "task", { task: taskNum, round: reviewRound }));
  if (!existsSync(handoffPath)) return "MISSING";
  try {
    return normalizeHandoffStatus(JSON.parse(readFileSync(handoffPath, "utf8")).status ?? "UNKNOWN");
  } catch { return "UNKNOWN"; }
}

// review round=0 → review never completed → pending; otherwise read latest review handoff status.
export function isTaskPending(taskNum, workspace, progressData) {
  const reviewRound = progressData?.tasks?.find(t => t.task === taskNum)?.rounds?.["review"] ?? 0;
  if (reviewRound === 0) return true; // no review ever completed
  return handoffStatus(taskNum, workspace, progressData) !== "APPROVED";
}
