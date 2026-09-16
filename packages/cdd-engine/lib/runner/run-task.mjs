// packages/cdd-engine/lib/runner/run-task.mjs — CDD per-task runner (Node port of cdd_run_task).
// H1 four-line output is exclusive (spec v3): this module is responsible for formatting status/commits/artifacts/blocker.
// runTask ordered contract: registry ship gate → CLI preflight → plan/workspace/ctx
//（plan 由 `--plan` 显式参数唯一提供；root 经 `opts.root` 注入，缺省 `getRoot()`）→ brief self-provision
//（effective plan 定稿后 generateBrief；BLOCKED on failure）→ review fixed-point → require ctx →
// renderModePrompt → nested CLI spawn (captures stderr, not swallowed via 2>/dev/null) → commit-contract
// → H1 four lines → handoff processing.
// noExit=true returns { exitCode, h1 } instead of exit helpers — the unit-test seam.
// Final exit delegated to lib/exit.mjs (unified exit point, no inline process.exit).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { loadRegistry, checkHarness, CddBlockedError, REG_PATH } from "../registry.mjs";
import { renderModePrompt, pluginRoot } from "../templates.mjs";
import { writeHandoff, writeOwnHandoff, readJson } from "../handoff/write.mjs";
import { validateCommitContract } from "../contract/commit.mjs";
import { generateBrief } from "../brief.mjs";
import { handoffName, prevHandoffPath as hnPreHandoffPath, workspaceSlug, workspaceRoot } from "../handoff/naming.mjs";
import { finalizeHandoff, persistFinalized, normalizeHandoffStatus } from "../handoff/finalize.mjs";
import { exitOk, exitBlocked, exitCliMissing, exitWithCode, ExitRequested } from "../exit.mjs";
import { invokeCli, invokeCliWithRetry, resolveTimeoutMs } from "../lifecycle/cli.mjs";
import { withLifecycle } from "../lifecycle/proc.mjs";
import { getRoot, resolveDocArg } from "../root.mjs";
import { readProgressJSON, writeProgressJSON, migrateIfNeeded, getRound, incrementRound, incrementRecovery, h1CountersLine } from "../state/progress.mjs";
import { briefPath } from "../state/workspace-artifacts.mjs";
import { validateHandoffSchema, recoverHandoff } from "../handoff/schema.mjs";
import { FAILURE_CATEGORIES, counterFor } from "../failure.mjs";

// Re-export for backward compatibility (existing tests and consumers import from run-task.mjs).
export { invokeCli };

const VALID_MODES = ["implement", "review", "fix"];

// mode → invokeCli (op, type?) 注入参数。
//   review → ("review","task")；fix → ("fix","task")；implement → ("implement", null)。
//   prefix 值经 registry resolveInjection（entry.prefix[op][type?]）解析（见 lib/lifecycle/cli.mjs）。
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

// ---- 失败类目分派（T6）----
// 六类名的唯一声明点 = templates/failure-categories.json；本模块所有以「类目身份」出现的引用
//（failure_category 赋值点 / 计数器 increment 落点）一律经 lib/failure.mjs 承重取值 ——
// 类目若被 canonical 删除，入口引用（FAILURE_CATEGORIES.X）运行期立即炸出（AC14 承重，非装饰）。
// 计数器 increment 落点单点：字段名经 canonical 的 counterFor 派生，本文件零手写计数器字面量。
export function incrementFailureCounter(progressDir, category) {
  const field = counterFor(category);
  if (!field) return -1; // 无计数器类目（UNVERIFIABLE / PLAN_CONFLICT）：只记结局，不记计数
  // T7: 本读保持单参（timeout 分支的计数落点也走这里）—— 失败分支执行时 progress.json 已由
  // 初始化点建立（plan 已入档），plan 不再参与 createEmptyProgress 派生；单参是有意为之，非漏改。
  const data = readProgressJSON(progressDir);
  data[field] = (data[field] ?? 0) + 1;
  writeProgressJSON(progressDir, data);
  return data[field];
}

// 终态门（T6 / AC7）：类目计数 ≥ 2 → 终态 blocker「BLOCKED: <category>-exhausted」，orchestrator
// 据此停止重试（失败类目表的 *-exhausted 终态）。分支 review 发现只 increment 不消费的缺口后补
// （branch-review finding）：原散落调用点一律经本函数完成「increment + 阈值判定」，不重排各分支。
export function exhaustedBlocker(category, n) {
  if (n < 2) return null;
  return `BLOCKED: ${category}-exhausted (${n} consecutive ${category.replace(/_/g, " ").toLowerCase()} failures) — stop and fix the underlying cause, then re-dispatch a fresh task`;
}

// drop-in 替换 incrementFailureCounter：increment 后若触发终态，覆盖刚写的失败 handoff 的
// blocker 为终态形（H1/status 由 h1FromHandoff 读回，orchestrator 见到的即终态信号）。
export function maybeExhaust(progressDir, category, handoffPath) {
  const n = incrementFailureCounter(progressDir, category);
  const ex = exhaustedBlocker(category, n);
  if (ex) {
    const obj = readJson(handoffPath);
    obj.blocker = ex;
    writeHandoff(handoffPath, obj);
  }
  return n;
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

// ---- workspace / ctx ----

// Workspace derivation is purely plan-derived (P4 §2.4.1): root comes from the injected single
// root authority (lib/root.mjs — the engine's only cwd conversion point), the effective plan from
// the explicit `--plan` argument. The former direct-set branch (a second coordinate system keyed
// off a workspace env var) is gone: there is exactly one way to name a workspace.
//   plan → <repoRoot>/<workspaceRoot>/<slug>/
// —— 与 handoff/naming.mjs#resolveWorkspace(doc, root)（纯路径派生）重名消解：本函数含
// mkdirSync/writeFileSync 副作用，是**物化**而非派生 —— 改名 materializeWorkspace（branch-review
// finding [4]）。纯派生取 naming 版；消费方只需落盘路径物化时用本版。
export function materializeWorkspace({ plan, repoRoot }) {
  if (!repoRoot) throw new RunBlocked("not in a git repo");
  const slug = workspaceSlug(plan);
  if (!slug || slug === "." || slug === "..") throw new RunBlocked(`cannot derive workspace name from: ${plan}`);
  const base = path.join(repoRoot, workspaceRoot);
  mkdirSync(path.join(base, slug), { recursive: true });
  writeFileSync(path.join(base, ".gitignore"), "*\n");
  return path.join(base, slug);
}

// resolvePlanWorkspace({ planFile, root }) — plan → workspace 的**唯一**派生点：
// `--plan` 显式参数经 resolveDocArg 归一到仓根坐标系（不存在 → exit 1 三行诊断），随后派生 workspace。
// 「缺 plan → RunBlocked」守卫文案只此一处 —— runTask step 2 与 buildCtx 直调入口共用本函数，
// 两条入口不再各写一份派生（同形逻辑双份即漂移源）。
export function resolvePlanWorkspace({ planFile, root }) {
  const plan = planFile ? resolveDocArg(planFile, root, "plan") : "";
  if (!plan) throw new RunBlocked("cannot resolve repo root: provide --plan");
  return { plan, workspace: materializeWorkspace({ plan, repoRoot: root }) };
}

// buildCtx(root, taskNum, opts) — 引擎内部状态（ctx）的唯一构造点。ctx 一律经返回值传递，
// **不得借道 env**：workspace / handoff / brief / ledger / constraints / findings 全部在此一次派生。
// root 由调用方注入（runTask 传 `opts.root ?? getRoot()`，测试直接传真仓根；无 reset / env / ForTest 缝）。
// plan/workspace 由 opts.planWorkspace（resolvePlanWorkspace 的返回值）注入 —— runTask 已为算 round
// 派生过一次，二次调用会白做 mkdirSync/writeFileSync 副作用；缺省则本函数自派（测试直调入口），
// 两条路径同一函数、同一守卫文案。
// round: derives per-round handoff path for review/fix modes; implement always produces task-N-implement.json.
// findingsPath (cdd fix --findings): explicit handoff path for this fix round — takes precedence over the
//   runner-derived prev-phase path (otherwise the fix CLI's --findings would be dead code).
export function buildCtx(root, taskNum, opts = {}) {
  const { mode, harness, round = 1, findingsPath } = opts;
  const { plan, workspace } = opts.planWorkspace ?? resolvePlanWorkspace({ planFile: opts.planFile, root });
  // Per-phase per-round handoff path (unconditional — canonical handoff-naming 派生):
  // implement 用 fixed 族（无 round）；review/fix 用 round 族。非法 mode 回落旧拼字
  //（派生层只认 canonical 族名，未知族 throw 会打乱后续 validateMode 的拒绝路径）。
  let handoffFile;
  if (mode === "implement") {
    handoffFile = handoffName("implement", "task", { task: taskNum });
  } else if (mode === "review" || mode === "fix") {
    handoffFile = handoffName(mode, "task", { task: taskNum, round });
  } else {
    handoffFile = `task-${taskNum}-${mode}-${round}.json`;
  }
  return {
    plan,
    round,
    workspace,
    handoffPath: path.join(workspace, handoffFile),          // unconditional derivation
    briefPath: briefPath({ workspace, task: taskNum }),
    ledgerPath: path.join(workspace, "progress.json"),
    constraintsPath: path.join(workspace, "plan-constraints.md"),
    // fix: cdd fix --findings opt wins when provided; otherwise the runner-derived review-R.json
    // path for this fix round (no scope filter). implement/review: the open-findings path.
    findingsPath: mode === "fix"
      ? (findingsPath ?? prevHandoffPath(workspace, taskNum, mode, round))
      : path.join(workspace, `task-${taskNum}-open-findings.json`),
    mode,
    harness,
    fixedPoint: "",
  };
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

// Aligns cdd_require_env mode validation（mode 已非 env 通道 —— 文案不再指向已删的 CDD_MODE）。
function validateMode(mode) {
  if (!VALID_MODES.includes(mode)) return `mode must be implement|review|fix (got: ${mode})`;
  return null;
}

// Aligns cdd_require_env: required ctx fields + mode-specific extras (fix → findingsPath).
function requireCtx(ctx, mode) {
  const missing = [];
  for (const k of ["workspace", "briefPath", "ledgerPath", "mode", "handoffPath", "constraintsPath"]) {
    if (!ctx[k]) missing.push(k);
  }
  if (mode === "fix" && !ctx.findingsPath) missing.push("findingsPath");
  return missing.length > 0 ? `Missing required ctx fields: ${missing.join(" ")}` : null;
}

// {{PLACEHOLDER}} template params (6 keys + TASK superset key). PLAN_LINE is derived from the
// explicit plan path held by ctx — the template receives no env-sourced plan key.
export function buildPromptParams(ctx, taskNum) {
  return {
    WORKSPACE: ctx.workspace,
    BRIEF: ctx.briefPath,
    HANDOFF: ctx.handoffPath,
    FINDINGS: ctx.findingsPath ?? "",
    CONSTRAINTS: ctx.constraintsPath,
    FIXED_POINT: ctx.fixedPoint ?? "",  // empty string if cross-phase read returned nothing
    TASK: String(taskNum),
    PLAN_LINE: ctx.plan ? `**Plan:** ${ctx.plan}` : "",
  };
}

// ---- H1 output ----

// Aligns _cdd_emit_h1_four_lines: picks the last ^key: line from agent stdout; missing → "<missing>".
// T7: 追加 workspace 入参 —— 末尾经 h1CountersLine(workspace) 追加第 5 行 counters（stdout 面 +
// res.h1 面同源于本函数，两侧同为 5 行）。agent 不产出 counters（canonical 裁定计数是引擎自持状态）。
export function h1FourLines(raw, workspace) {
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
  out.push(h1CountersLine(workspace));
  return out;
}

// Aligns _cdd_emit_h1_from_handoff (no jq dependency): reads handoff JSON, missing/corrupt → BLOCKED fallback.
// artifacts only emitted when present (consistent with bash).
// blocker 缺省单点（T6 nit4）：review 成功/无阻断语义 → none；其余 → commit-contract 缺省文案。
// h1FromHandoff 缺省与 h1Blocker 折叠共用此映射（两处不再各写一份）。
// T7: 追加 workspace 入参 —— 末尾经 h1CountersLine(workspace) 追加第 5 行 counters（回读重发面）。
function defaultBlockerFor(status) {
  return status === "APPROVED" || status === "CHANGES_REQUESTED"
    ? "none"
    : "uncommitted changes at return";
}

export function h1FromHandoff(handoffPath, workspace) {
  if (!handoffPath || !existsSync(handoffPath)) {
    return h1FourLines("status: BLOCKED\nblocker: handoff missing after commit-contract interception → re-dispatch task after checking commit-contract errors", workspace);
  }
  const h = readJson(handoffPath);
  if (!h) {
    return h1FourLines("status: BLOCKED\nblocker: handoff JSON unparseable after commit-contract interception → delete the corrupted handoff file and re-dispatch", workspace);
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
  out.push(h1CountersLine(workspace));
  return out;
}

// ---- dry-run simulation ----

// Aligns bash dry-run branch hardcoded H1 block (the dry-run flag short-circuits the dispatch).
function dryRunH1Block(ctx, taskNum) {
  return [
    "status: APPROVED",
    "commits: base=dry-run",
    `artifacts: brief=${ctx.briefPath} report=${ctx.workspace}/task-${taskNum}-report.md test_evidence=${ctx.workspace}/task-${taskNum}-test-evidence.json`,
    "blocker: none",
  ].join("\n");
}

// ---- runTask / runPlan ----

// Aligns cdd_run_task. opts: { mode, planFile, root, dryRun, env, noExit, registryPath,
//   findingsPath, pluginRoot } — 签名外的键一律不用（T7 新增用例同此约束）。
// root 经参数注入（缺省 getRoot()）：进程内测试不注入即 throw（该 throw 即正确失败面，不得兜底）。
// env = 宿主环境（spawnManaged 已做凭证剥离）；引擎自身零 env 派生值读取。
// findingsPath: explicit findings path for fix mode (cdd fix --findings) — wins over the
//   buildCtx runner-derived prev-phase handoff path.
// Returns { exitCode, h1 } (does not call exitWithCode when noExit=true).
export async function runTask(harness, taskNum, opts = {}) {
  return withLifecycle(async () => {
  const { mode, planFile, dryRun = false, noExit = false } = opts;
  const pluginRootFn = opts.pluginRoot ?? pluginRoot;
  const hostEnv = opts.env ?? process.env;
  const root = opts.root ?? getRoot();
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

  // 2. Plan → workspace → ctx (#173: unified entry; single root authority, never falls back to cwd)
  let ctx;
  try {
    // round 需 workspace 定位 progress.json，而 handoffPath 需 round —— 先派生 workspace，再算 round，
    // 最后落入 ctx（ctx 是 round/handoff 派生值的唯一承载体）。
    const planWorkspace = resolvePlanWorkspace({ planFile, root });
    // 初始化点（T7）：恒以 `--plan` 入参（绝对路径）落一次 readProgressJSON —— 首跳创建经
    // createEmptyProgress(plan) 把 plan 入档（T7 的 progress.json#plan 断言落点即此处）。**不得**
    // 挂在 getRound 分支上短路：implement 的 round 恒 1，若把读折叠进 getRound 参数，implement
    // 首次派发就走不到创建路径，progress.json 永不落盘。
    const progressData = readProgressJSON(planWorkspace.workspace, planWorkspace.plan);
    const round = mode === "implement" ? 1 : getRound(progressData, taskNum, mode);
    ctx = buildCtx(root, taskNum, { mode, harness, planWorkspace, round, findingsPath: opts.findingsPath });
    // F11: self-provision the task brief at plan finalization（--plan 生效即生成）。
    //   产物 = workspace-artifacts.briefPath（与 ctx.briefPath 同源）；生成失败（task 越界/
    //   plan 缺失/HEAD 不可取）→ RunBlocked → BLOCKED exit 1 —— 不静默降级读既有/放行。
    //   写前 dirname bootstrap（同 writeBaseBranch 的 workspace bootstrap 惯例）。
    try {
      mkdirSync(path.dirname(ctx.briefPath), { recursive: true });
      generateBrief(planWorkspace.plan, taskNum, ctx.briefPath, root);
    } catch (e) {
      throw new RunBlocked(`brief generation failed: ${e.message}`);
    }
  } catch (e) {
    if (e instanceof RunBlocked) return finish(1, [], e.message, noExit);
    // resolveDocArg 的路径不存在诊断走 exitWithCode（THROW ExitRequested）—— 归一到同一出口，
    // 使 noExit=true 的进程内调用方仍拿到 { exitCode:1 } 而非异常穿透。
    if (e instanceof ExitRequested) return finish(e.code, [], "", noExit);
    throw e;
  }

  // 2.5 Templates existence check — BLOCKED exit 1 if missing (not exit 3).
  // cdd-engine is self-contained: pluginRoot() = lib/templates.mjs PKG_ROOT =
  // <pkg>/templates（re-org Step 5：PKG_ROOT 语义收敛为该资源目录本身）→ 直接校验该目录。
  {
    try {
      const tplDir = pluginRootFn();
      if (!existsSync(tplDir)) {
        return finish(1, [], `templates missing: ${tplDir}`, noExit);
      }
    } catch {
      return finish(1, [], "templates missing: cdd-engine package root not found", noExit);
    }
  }

  // 4. ctx → progressDir（ledgerPath 的目录即 workspace；原 "Set env" 步随 buildTaskEnv 拆分删除）
  const progressDir = path.dirname(ctx.ledgerPath);

  // 5. Task-review / fix fixed-point — derive from prior-phase handoff (cross-phase read).
  if (mode === "review" || mode === "fix") {
    if (!ctx.fixedPoint) {
      const prev = prevHandoffPath(ctx.workspace, taskNum, mode, ctx.round ?? 1);
      if (prev) {
        const prevCommitsBase = readJsonField(prev, ["commits", "base"]);
        if (prevCommitsBase && prevCommitsBase !== "unknown") {
          ctx.fixedPoint = prevCommitsBase;
        }
      }
    }
    if (dryRun && !ctx.fixedPoint) ctx.fixedPoint = "HEAD~1";
  }

  // 6. require ctx / mode validation
  const modeErr = validateMode(mode);
  if (modeErr) return finish(1, [], modeErr, noExit);
  const missing = requireCtx(ctx, mode);
  if (missing) return finish(1, [], missing, noExit);

  // 7. Render prompt
  let prompt;
  try {
    prompt = renderModePrompt(mode, buildPromptParams(ctx, taskNum));
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
    agentOut = dryRunH1Block(ctx, taskNum);
  } else {
    const timeoutMs = resolveTimeoutMs(hostEnv, "task");
    // 子进程 cwd = 注入的 root（唯一 root 权威 lib/root.mjs；本函数不直读启动 cwd，也无第二注入缝）。
    // 子进程 env = 宿主 env（零 CDD_* 注入 —— 引擎内部状态经 ctx 传递，不过 env 边界）。
    const res = await invokeCliWithRetry(entry, prompt, INVOKE_PARAMS[mode], hostEnv, root, timeoutMs);
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
    const existingHandoff = readJson(ctx.handoffPath);
    if (unkillable) {
      writeHandoff(ctx.handoffPath, {
        task: taskNum,
        phase: mode,
        status: "BLOCKED",
        failure_category: FAILURE_CATEGORIES.ENGINE_SELF_WRITTEN.id,
        findings: [],
        artifacts: {},
        blocker: `cli process unkillable after timeout → manually kill the process (check ps), then re-dispatch task ${taskNum}`,
      });
      if (!dryRun) {
        incrementRound(progressDir, taskNum, mode);
        maybeExhaust(progressDir, FAILURE_CATEGORIES.ENGINE_SELF_WRITTEN.id, ctx.handoffPath); // T6: 引擎自写 BLOCKED → engineSelfWrittenCount（不再消耗 recovery 额度）
      }
      return finish(1, h1FromHandoff(ctx.handoffPath, ctx.workspace), "process unkillable", noExit);
    }
    // Normal timeout: TIMEOUT partial handoff
    const timeoutMs = resolveTimeoutMs(hostEnv, "task");
    writeHandoff(ctx.handoffPath, {
      task: taskNum,
      phase: mode,
      status: "TIMEOUT",
      failure_category: FAILURE_CATEGORIES.TIMEOUT.id,
      findings: [],
      artifacts: {},
      blocker: `cli timed out after ${timeoutMs}ms → simplify task ${taskNum} scope or increase timeout, then re-dispatch`,
    });
    if (!dryRun) incrementRound(progressDir, taskNum, mode);
    // TIMEOUT 计数器 increment 落点：字段名经 canonical counterFor 派生，类目身份经
    // FAILURE_CATEGORIES 承重引用（取代原 timeoutCount++ 三板，T6 零手写计数器字面量）。
    maybeExhaust(progressDir, FAILURE_CATEGORIES.TIMEOUT.id, ctx.handoffPath);
    return finish(1, h1FromHandoff(ctx.handoffPath, ctx.workspace), `cli timed out after ${timeoutMs}ms`, noExit);
  }

  // 8.8 Handoff JSON Schema validation — reject malformed handoffs before downstream processing.
  // T7: implement 门控（mode !== "implement"）—— HANDOFF 路径对 implement 不是输入通道，engine 不去读
  //（engine 是载体唯一作者，implement agent 经 implement.md 不写 handoff，13 步由 finalizeHandoff 实体化）。
  // review/fix 保留读取校验（agent 是内容作者，findings 内容契约）。
  if (mode !== "implement") {
    const existingHandoff = readJson(ctx.handoffPath);
    if (existingHandoff) {
      const sv = validateHandoffSchema(existingHandoff);
      if (!sv.valid) {
        // T5 CONTRACT_VIOLATION 恢复（spec §2.5.2，AC7 类目级：不区分 dispatch 类型）：
        // 归一化 → 重校验（最多一轮，不循环）——恢复单点是 lib/handoff/schema.mjs#recoverHandoff
        // （三路 runner 同源消费：违规键名后缀 + findings 数组守卫只在那里写一次）。
        // 两条子分支都以**归一化对象**为准（违规键无论如何不留盘），故写盘一律 writeOwnHandoff
        // 全量覆盖 —— 浅合并会让磁盘上的违规键经 existing 回灌，把刚剥掉的键又写回去。
        const rec = recoverHandoff(existingHandoff, "task");
        if (rec.valid) {
          // ① 归一化命中 → 写侧同源落盘 →「正常继续」（后续 13 步 finalize / h1FromHandoff
          //    读回的都是归一化形态）。
          writeOwnHandoff(ctx.handoffPath, rec.handoff);
        } else {
          // ② 归一化不可救（缺 required / 类型或枚举不符）→ 仍 BLOCKED，但 findings 全额保留：
          //    解析出的原 findings 原样进载体，不再整份改写为 []（A4 缺陷面）。数组守卫在
          //    recoverHandoff 内（agent 写的 findings 可能是非数组——那正是本节曾经的崩溃面）。
          // review-3 finding 1（warn）：BLOCKED 载荷 = **engine 自写字面量 + 仅保留 findings**，
          //    不再 `{...rec.handoff}` spread——已声明键的 agent 原值（`notes: 5` / commits.base 短形 /
          //    `artifacts: "x"` 一类类型/枚举违规，normalize 无权改其值）若经 spread 进载体，三处消费方
          //    对它们不做类型/枚举守卫 → engine 亲手写出违反自家 schema 的 BLOCKED handoff（正是本任务
          //    要消灭的 CONTRACT_VIOLATION 类目）。writeOwnHandoff 全量覆盖仍必要：浅合并会把磁盘上的
          //    违规键经 existing 回灌。
          writeOwnHandoff(ctx.handoffPath, {
            task: taskNum,
            phase: mode,
            status: "BLOCKED",
            failure_category: FAILURE_CATEGORIES.CONTRACT_VIOLATION.id,
            findings: rec.preservedFindings,
            artifacts: {},
            blocker: `handoff schema invalid${rec.reason} → fix the handoff JSON at ${ctx.handoffPath} and re-dispatch task ${taskNum}`,
          });
          if (!dryRun) {
            incrementRound(progressDir, taskNum, mode);
            maybeExhaust(progressDir, FAILURE_CATEGORIES.CONTRACT_VIOLATION.id, ctx.handoffPath); // T6: 生成侧格式错误 → contractViolationCount（不再消耗 recovery 额度）
          }
          return finish(1, h1FromHandoff(ctx.handoffPath, ctx.workspace), `schema validation failed${rec.reason}`, noExit);
        }
      }
    }
  }

  // 10. Nested CLI failed with no handoff → write BLOCKED handoff (stderr into blocker) + H1-from-handoff +
  //     stderr CDD_BLOCKED diagnostic + exit 1 (aligns bash cdd_exit_blocked). Only sanctioned divergence:
  //     Node additionally writes handoff (§spec 2.1 stderr-surfacing) — bash emits raw agent H1 + exit 1.
  if (agentRc !== 0 && !existsSync(ctx.handoffPath)) {
    writeHandoff(ctx.handoffPath, {
      task: taskNum,
      phase: mode,
      status: "BLOCKED",
      failure_category: FAILURE_CATEGORIES.EXECUTION_FAILURE.id,
      commits: { base: "unknown" },
      findings: [],
      artifacts: {},
      blocker: `cli exited ${agentRc} without writing handoff → check stderr above for errors, fix, then re-dispatch task ${taskNum}`,
    });
    if (!dryRun) {
      incrementRound(progressDir, taskNum, mode);
      incrementRecovery(progressDir); // T6: 真实执行失败（非超时、非引擎自写）→ EXECUTION_FAILURE —— 唯一消耗 recovery 额度的类目（AC7）
    }
    return finish(1, h1FromHandoff(ctx.handoffPath, ctx.workspace), `cli exited ${agentRc} and handoff missing`, noExit);
  }

  // 10.5. CLI succeeded but no handoff → BLOCKED (file-existence check, not phase-mismatch fallback).
  // Agent exits 0 without writing handoff = error, not success — write BLOCKED and return exit 1.
  // dry-run excluded: bash dry-run does not write handoff, Node does not either.
  // implement excluded (T6): runner 实体化写盘在 13 步 OK 路径 —— implement 分支本检查不触发
  //（实现链 agent 经 implement.md 不再写 handoff，残留检查会误 BLOCKED 每次成功实现）。
  if (agentRc === 0 && !dryRun && mode !== "implement" && !existsSync(ctx.handoffPath)) {
    writeHandoff(ctx.handoffPath, {
      task: taskNum,
      phase: mode,
      status: "BLOCKED",
      failure_category: FAILURE_CATEGORIES.ENGINE_SELF_WRITTEN.id,
      findings: [],
      artifacts: {},
      blocker: `${path.basename(ctx.handoffPath)} not written after exit 0 → re-run ${mode} and ensure handoff is written to ${ctx.handoffPath} before exit`,
    });
    incrementRound(progressDir, taskNum, mode);
    maybeExhaust(progressDir, FAILURE_CATEGORIES.ENGINE_SELF_WRITTEN.id, ctx.handoffPath); // T6: 引擎自写 BLOCKED（exit 0 未写 handoff）→ engineSelfWrittenCount
    return finish(1, h1FromHandoff(ctx.handoffPath, ctx.workspace), `${mode} agent did not write handoff`, noExit);
  }

  // 11. H1 four lines (from agent stdout / dry-run block)
  let h1 = h1FourLines(agentOut, ctx.workspace);

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
      brief: ctx.briefPath,
      repoRoot: root,
      workspace: ctx.workspace,
      taskNum,
    });
    if (finalized.handoff) {
      // 定稿写盘全量覆盖：agent 写残留进不了载体（无残留兼容层）。
      writeOwnHandoff(ctx.handoffPath, finalized.handoff);
      h1 = h1FromHandoff(ctx.handoffPath, ctx.workspace);
      // 实体化后 H1 与 handoff/exit 一致：hard gate 或 agent 声明 BLOCKED → exit 1。
      if (finalized.exitCode !== 0) {
        maybeExhaust(progressDir, FAILURE_CATEGORIES.ENGINE_SELF_WRITTEN.id, ctx.handoffPath); // T6: implement 实体化 BLOCKED = 引擎自写 BLOCKED → engineSelfWrittenCount（T9 N② 落点迁移，不再消耗 recovery 额度）
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
    const cv = validateCommitContract(mode, root ?? "", { handoffPath: ctx.handoffPath });
    if (!cv.ok) {
      maybeExhaust(progressDir, FAILURE_CATEGORIES.ENGINE_SELF_WRITTEN.id, ctx.handoffPath); // T6: commit-contract 重写 = 引擎自写 BLOCKED → engineSelfWrittenCount（不再消耗 recovery 额度）
      return finish(1, h1FromHandoff(ctx.handoffPath, ctx.workspace), cv.blocker, noExit);
    }
  }

  // T5/T7: status 单一权威 — review 型 handoff 由 engine 定稿（finalizeHandoff rollup 派生覆写，
  // SP-4 豁免失败轮次）；成功路径读回定稿并持久化（writeOwnHandoff 全量覆盖），H1 同步用 h1FromHandoff。
  // T8: APPROVED review 回写 progress task.status=complete（读回握手 finalizeHandoff 之后，
  // 且在 post-run validate 通过之后 —— dirty 失败轮不误标 complete）。
  if (!dryRun && mode === "review") {
    const reviewHandoff = readJson(ctx.handoffPath);
    if (reviewHandoff) {
      const finalized = finalizeHandoff({ mode, agentHandoff: reviewHandoff });
      // persistFinalized：派生无变化（同引用）→ skip 写盘（不产生 no-op 覆盖）；有变化 → 全量覆盖 + sync。
      persistFinalized(ctx.handoffPath, reviewHandoff, finalized);
      h1 = h1FromHandoff(ctx.handoffPath, ctx.workspace);
      if (normalizeHandoffStatus(reviewHandoff.status) === "APPROVED") {
        // T7: 本读保持单参 —— review 成功路径执行时 progress.json 已由初始化点建立（plan 已入档），
        // plan 不再参与 createEmptyProgress 派生；单参是有意为之，非漏改。
        const progressData2 = readProgressJSON(progressDir);
        let taskEntry = progressData2.tasks.find((t) => t.task === taskNum);
        if (!taskEntry) {
          taskEntry = { task: taskNum, status: "pending", rounds: {} };
          progressData2.tasks.push(taskEntry);
        }
        taskEntry.status = "complete";
        writeProgressJSON(progressDir, progressData2);
      }
    }
  }
  if (!dryRun && mode !== "implement") incrementRound(progressDir, taskNum, mode);
  return finish(0, h1, "", noExit);
  });
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
