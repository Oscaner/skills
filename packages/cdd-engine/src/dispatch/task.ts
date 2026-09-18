// packages/cdd-engine/src/dispatch/task.ts — TaskLifecycle (Task 8; ex dispatch/task.mjs / legacy
// lib/runner/run-task.mjs): the task-function lifecycle for `cdd implement/review/fix --type task`.
// Extends DispatchLifecycle (dispatch/base.ts) and inherits BOTH commit gates — the pre-flight
// entry gate (pre-commit clean tree) and the post-flight exit gate (validateCommitContract) are
// the base's default hooks; this file only overrides the virtual hooks it cares about (spec §2.12
//「抽象基类继承覆写」; never touches the hookable registry).
//
//   pre-flight  resolveContext — steps 1/2/2.5/4/5: registry ship gate → plan → workspace → ctx
//               (brief self-provision at plan finalization, F11) → template existence → progressDir
//               → review/fix fixed-point (prior-handoff reads). validateMode — step 6.
//   dispatch    steps 7/8/8.5: prompt render → spawn the agent CLI (dry-run simulation) → the
//               timeout path (partial handoff + counters).
//   post-flight schemaValidate — steps 8.8/10/10.5: handoff schema recovery (CONTRACT_VIOLATION
//               keeps findings) + failure-without-handoff BLOCKED writes. normalizeResult — steps
//               11/12/13: H1 four-line parse, agent-failure exit, implement materialization.
//               commitPostCheck — step 13.5 + review writeback: the exit gate (skipped on
//               finished rounds / dry-run; failed gate → maybeExhaust + BLOCKED H1), then the
//               APPROVED-review task.status=complete writeback + round increment (post-gate only —
//               a dirty failure round never marks complete).
//
// H1 four-line output stays exclusive to this file (spec v3): status/commits/artifacts/blocker +
// the counters line. runTask keeps the legacy { exitCode, h1 } surface ({ noExit } seam) and
// delegates to the lifecycle.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  DispatchLifecycle,
  type DispatchContext,
  type DispatchHookContext,
  DispatchBlocked,
} from "./base.ts";
import { loadRegistry, checkHarness, CddBlockedError, REG_PATH } from "../infra/registry.ts";
import { renderModePrompt, pluginRoot } from "../render/templates.ts";
import { writeHandoff, writeOwnHandoff, readJson } from "../artifacts/handoff/write.ts";
import { validateCommitContract } from "../rules/commit.ts";
import { generateBrief } from "../render/brief.ts";
import { handoffName, prevHandoffPath as hnPreHandoffPath, workspaceSlug, workspaceRoot } from "../artifacts/handoff/naming.ts";
import { finalizeHandoff, persistFinalized, normalizeHandoffStatus } from "../artifacts/handoff/finalize.ts";
import { exitWithCode, ExitRequested } from "../infra/exit.ts";
import { invokeCli, invokeCliWithRetry, resolveTimeoutMs } from "../infra/invoke.ts";
import { withLifecycle } from "../infra/proc.ts";
import { getRoot, resolveDocArg } from "../infra/root.ts";
import { readProgressJSON, writeProgressJSON, getRound, incrementRound, incrementRecovery, h1CountersLine } from "../artifacts/progress.ts";
import { briefPath } from "../artifacts/base-branch.ts";
import { validateHandoffSchema, recoverHandoff } from "../rules/schema.ts";
import { FAILURE_CATEGORIES, counterFor } from "../rules/failure.ts";

// Re-export for backward compatibility (existing tests and consumers import from run-task.mjs
// via this module's re-pointed surface).
export { invokeCli };

const VALID_MODES = ["implement", "review", "fix"];

// mode → invokeCli (op, type?) injection params.
//   review → ("review","task"); fix → ("fix","task"); implement → ("implement", null).
//   The prefix value resolves via registry resolveInjection (entry.prefix[op][type?]).
const INVOKE_PARAMS: Record<string, { op: string; type?: string }> = {
  review: { op: "review", type: "task" },
  fix: { op: "fix", type: "task" },
  implement: { op: "implement" },
};

// Local orchestration error: carries an exit code; caught by resolveContext then finish.
class RunBlocked extends Error {}

// ---- failure-category dispatch (T6) ----
// Six category names declared once by engine-config.json#failureCategories; every "category
// identity" reference here loads through src/rules/failure.ts (FAILURE_CATEGORIES / counterFor) —
// a category deleted from the canonical blows up the entry reference at runtime (AC14
// load-bearing, not decorative). The counter increment single point: fields derive via the
// canonical's counterFor, zero hand-written counter literals in this file.
export function incrementFailureCounter(progressDir: string, category: string): number {
  const field = counterFor(category);
  if (!field) return -1; // no-counter category (UNVERIFIABLE / PLAN_CONFLICT): record the outcome only, no count
  // T7: this read stays single-arg (the timeout branch's count also lands here) — progress.json
  // is already established by the init point when failure branches execute (plan recorded;
  // single arg intentional, not a missed change).
  const data = readProgressJSON(progressDir);
  const prev: number = typeof data[field] === "number" ? ((data[field] as number) ?? 0) : 0;
  data[field] = prev + 1;
  writeProgressJSON(progressDir, data);
  return data[field] as number;
}

// Terminal gate (T6 / AC7): category count ≥ 2 → the terminal blocker「BLOCKED: <category>-exhausted」,
// on which the orchestrator stops retrying (the failure-category table's *-exhausted terminal state).
export function exhaustedBlocker(category: string, n: number): string | null {
  if (n < 2) return null;
  return `BLOCKED: ${category}-exhausted (${n} consecutive ${category.replace(/_/g, " ").toLowerCase()} failures) — stop and fix the underlying cause, then re-dispatch a fresh task`;
}

// drop-in increment: after incrementing, if the category hit its terminal threshold, overwrite the
// just-written failure handoff's blocker with the terminal shape (H1/status re-read via
// h1FromHandoff, so the orchestrator sees the terminal signal).
export function maybeExhaust(progressDir: string, category: string, handoffPath: string): number {
  const n = incrementFailureCounter(progressDir, category);
  const ex = exhaustedBlocker(category, n);
  if (ex) {
    const obj = readJson(handoffPath) ?? {};
    obj.blocker = ex;
    writeHandoff(handoffPath, obj);
  }
  return n;
}

// ---- workspace / ctx ----

/** Workspace derivation is purely plan-derived (P4 §2.4.1): root comes from the injected single
 * root authority (src/infra/root.mjs — the engine's only cwd conversion point), the effective
 * plan from the explicit `--plan` argument. The former direct-set branch (a second coordinate
 * system keyed off a workspace env var) is gone: plan → <repoRoot>/<workspaceRoot>/<slug>/. */
export function materializeWorkspace({ plan, repoRoot }: { plan: string; repoRoot: string }): string {
  if (!repoRoot) throw new RunBlocked("not in a git repo");
  const slug = workspaceSlug(plan);
  if (!slug || slug === "." || slug === "..") throw new RunBlocked(`cannot derive workspace name from: ${plan}`);
  const base = path.join(repoRoot, workspaceRoot);
  mkdirSync(path.join(base, slug), { recursive: true });
  writeFileSync(path.join(base, ".gitignore"), "*\n");
  return path.join(base, slug);
}

/** resolvePlanWorkspace({ planFile, root }) — the plan → workspace UNIQUE derivation point:
 * `--plan` normalizes to the repo-root coordinate system via resolveDocArg (missing → exit-1
 * diagnostic), then derives the workspace. The "missing plan → RunBlocked" guard text lives only
 * here — runTask step 2 and the buildCtx direct-entry share this function. */
export function resolvePlanWorkspace({ planFile, root }: { planFile?: string; root: string }): { plan: string; workspace: string } {
  const plan = planFile ? resolveDocArg(planFile, root, "plan") : "";
  if (!plan) throw new RunBlocked("cannot resolve repo root: provide --plan");
  return { plan, workspace: materializeWorkspace({ plan, repoRoot: root }) };
}

/** buildCtx(root, taskNum, opts) — the engine-internal state (ctx) UNIQUE construction point. ctx
 * always passes by return value, never through env: workspace / handoff / brief / ledger /
 * constraints / findings all derive here in one pass. root is injected by the caller (runTask
 * passes `opts.root ?? getRoot()`, tests pass a real fixture root). */
export function buildCtx(root: string, taskNum: number, opts: Record<string, unknown> = {}): TaskDispatchContext {
  const { mode, harness, round = 1, findingsPath } = opts as { mode: string; harness?: string; round?: number; findingsPath?: string };
  const planWorkspace = opts.planWorkspace as { plan: string; workspace: string } | undefined
    ?? resolvePlanWorkspace({ planFile: opts.planFile as string | undefined, root });
  const { plan, workspace } = planWorkspace;
  // Per-phase per-round handoff path (canonical handoff-naming derivation): implement uses the
  // fixed family (no round); review/fix the round family. Illegal mode falls back to a legacy
  // spelling (the derivation layer only knows canonical family names — an unknown family throw
  // would pre-empt validateMode's rejection path).
  let handoffFile: string;
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
    // path for this fix round. implement/review: the open-findings path.
    findingsPath: mode === "fix"
      ? (findingsPath ?? prevHandoffPath(workspace, taskNum, mode, round))
      : path.join(workspace, `task-${taskNum}-open-findings.json`),
    mode,
    harness,
    fixedPoint: "",
  };
}

/** TaskDispatchContext — the task dispatch's derived engine state (buildCtx output). */
export interface TaskDispatchContext {
  plan: string;
  round: number;
  workspace: string;
  handoffPath: string;
  briefPath: string;
  ledgerPath: string;
  constraintsPath: string;
  findingsPath: string | null;
  mode: string;
  harness?: string;
  fixedPoint: string;
  [key: string]: unknown;
}

// Read a nested JSON field (commits.base / commits.head); missing/corrupt → "".
function readJsonField(filePath: string | null, keys: string[]): string {
  if (!filePath || !existsSync(filePath)) return "";
  try {
    let v: unknown = JSON.parse(readFileSync(filePath, "utf8"));
    for (const k of keys) v = (v as Record<string, unknown> | null)?.[k];
    return typeof v === "string" ? v : "";
  } catch {
    return "";
  }
}

// Returns the path of the handoff written by the previous phase for this task (file name derived
// via canonical handoff-naming; cross-family prev-table semantics preserved). Returns a path or
// null (implement has no prior). task-mode three-in-one (review/fix share the family table).
function prevHandoffPath(workspace: string, task: number, mode: string, round: number): string | null {
  if (mode !== "review" && mode !== "fix") return null; // implement has no prior phase
  return hnPreHandoffPath(workspace, mode, "task", round, { task });
}

// Aligns cdd_require_env mode validation (mode is no longer an env channel).
function validateModeMsg(mode: string): string | null {
  if (!VALID_MODES.includes(mode)) return `mode must be implement|review|fix (got: ${mode})`;
  return null;
}

// Aligns cdd_require_env: required ctx fields + mode-specific extras (fix → findingsPath).
function requireCtx(ctx: TaskDispatchContext | null, mode: string): string | null {
  const missing = [];
  for (const k of ["workspace", "briefPath", "ledgerPath", "mode", "handoffPath", "constraintsPath"]) {
    if (!ctx?.[k]) missing.push(k);
  }
  if (mode === "fix" && !ctx?.findingsPath) missing.push("findingsPath");
  return missing.length > 0 ? `Missing required ctx fields: ${missing.join(" ")}` : null;
}

/** {{PLACEHOLDER}} template params (Task 5 token registry: task-* scope prefixes + HANDOFF_TARGET
 * merge + REVIEW_PLAN_LINE derived from the explicit plan path — no env-sourced plan key). */
export function buildPromptParams(ctx: TaskDispatchContext, taskNum: number): Record<string, string> {
  return {
    TASK_WORKSPACE: ctx.workspace,
    TASK_BRIEF: ctx.briefPath,
    HANDOFF_TARGET: ctx.handoffPath,
    TASK_FINDINGS: ctx.findingsPath ?? "",
    TASK_CONSTRAINTS: ctx.constraintsPath,
    TASK_FIXED_POINT: ctx.fixedPoint ?? "",  // empty string if the cross-phase read returned nothing
    TASK_NUMBER: String(taskNum),
    REVIEW_PLAN_LINE: ctx.plan ? `**Plan:** ${ctx.plan}` : "",
  };
}

// ---- H1 output ----

/** Aligns _cdd_emit_h1_four_lines: picks the last ^key: line from agent stdout; missing →
 * "<missing>". T7: a workspace arg was added — the 5th counters line appends via
 * h1CountersLine(workspace) (stdout + res.h1 share this one source; agent never produces
 * counters — canonical: the engine owns the count). */
export function h1FourLines(raw: string, workspace: string): string[] {
  const lines = String(raw).split("\n");
  const keys = ["status", "commits", "artifacts", "blocker"];
  const out: string[] = [];
  for (const key of keys) {
    let found: string | null = null;
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

// Blocker default single point (T6 nit4): APPROVED / CHANGES_REQUESTED → "none"; otherwise the
// commit-contract default text.
function defaultBlockerFor(status: string | undefined): string {
  return status === "APPROVED" || status === "CHANGES_REQUESTED"
    ? "none"
    : "uncommitted changes at return";
}

/** Aligns _cdd_emit_h1_from_handoff (no jq dependency): reads the handoff JSON; missing/corrupt →
 * BLOCKED fallback. artifacts emitted only when present. T7: 5th counters line appended via
 * h1CountersLine(workspace). */
export function h1FromHandoff(handoffPath: string, workspace: string): string[] {
  if (!handoffPath || !existsSync(handoffPath)) {
    return h1FourLines("status: BLOCKED\nblocker: handoff missing after commit-contract interception → re-dispatch task after checking commit-contract errors", workspace);
  }
  const h = readJson(handoffPath);
  if (!h) {
    return h1FourLines("status: BLOCKED\nblocker: handoff JSON unparseable after commit-contract interception → delete the corrupted handoff file and re-dispatch", workspace);
  }
  const out = [
    `status: ${(h.status as string) ?? "BLOCKED"}`,
    `commits: base=${(h.commits as Record<string, unknown> | null)?.base ?? ""} head=${(h.commits as Record<string, unknown> | null)?.head ?? ""}`,
  ];
  const arts: string[] = [];
  const art = (h.artifacts as Record<string, unknown> | undefined) ?? {};
  for (const key of ["brief", "report", "test_evidence"] as const) {
    if (art[key]) arts.push(`${key}=${String(art[key])}`);
  }
  if (arts.length > 0) out.push(`artifacts: ${arts.join(" ")}`);
  out.push(`blocker: ${(h.blocker as string) ?? defaultBlockerFor(h.status as string)}`);
  out.push(h1CountersLine(workspace));
  return out;
}

// ---- dry-run simulation ----

// Aligns the bash dry-run branch's hardcoded H1 block (dry-run short-circuits the dispatch).
function dryRunH1Block(ctx: TaskDispatchContext, taskNum: number): string {
  return [
    "status: APPROVED",
    "commits: base=dry-run",
    `artifacts: brief=${ctx.briefPath} report=${ctx.workspace}/task-${taskNum}-report.md test_evidence=${ctx.workspace}/task-${taskNum}-test-evidence.json`,
    "blocker: none",
  ].join("\n");
}

/** TaskRunOptions — runTask's public opts (signature keys only; anything else unused). */
export interface TaskRunOptions {
  mode?: string;
  planFile?: string;
  root?: string;
  dryRun?: boolean;
  noExit?: boolean;
  env?: NodeJS.ProcessEnv;
  registryPath?: string;
  findingsPath?: string;
  pluginRoot?: () => string;
}

interface TaskResult {
  exitCode: number;
  h1: string[];
}

interface TaskDiagnostic {
  prefix: string;
  msg: string;
}

// The spawn result as the legacy runner read it: the inflight result carries no `unkillable` field
// (the legacy `res.unkillable === true` always read undefined → false); typed for parity so the
// timeout-unkillable branch keeps its exact legacy shape.
interface TaskSpawnResult {
  ok: boolean;
  code: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  unkillable?: boolean;
}

/** TaskLifecycle — the task-function lifecycle class. All 13.5 steps of the legacy run-task.mjs
 * relocate into the hook overrides; the entry/exit gates are inherited from the base. Results
 * surface via .result ({ exitCode, h1 }) + .diagnostic (stderr message) after run(). */
export class TaskLifecycle extends DispatchLifecycle {
  readonly #harness: string;
  readonly #taskNum: number;
  readonly #opts: TaskRunOptions;
  readonly #root: string;

  #entry: unknown = null;
  #tcx: TaskDispatchContext | null = null;
  #agentOut = "";
  #agentRc = 0;
  #timeoutMs: number | undefined;
  #h1: string[] = [];
  #exitCode = -1;
  #diagnostic: TaskDiagnostic | null = null;
  #finished = false;

  constructor(options: { harness: string; taskNum: number; opts: TaskRunOptions; ctx: DispatchContext }) {
    super({ ctx: options.ctx });
    this.#harness = options.harness;
    this.#taskNum = options.taskNum;
    this.#opts = options.opts;
    this.#root = (options.ctx.repoRoot as string) ?? "";
  }

  #mode(): string {
    // Mode comes from the injected opts (never env). resolveContext/validateMode handle the
    // semantics; the empty fallback renders "got: " in the mode-must-be diagnostic (the legacy
    // undefined-got message, same rejection face).
    return this.#opts.mode ?? "";
  }

  /** runTask-compat result surface — { exitCode, h1 } read after run(). */
  get result(): TaskResult {
    return { exitCode: this.#exitCode, h1: [...this.#h1] };
  }

  /** stderr diagnostic ({ prefix, msg }) for the wrapper to emit before the H1 lines; null for
   * silent exits (OK / agent-failed-with-handoff). */
  get diagnostic(): TaskDiagnostic | null {
    return this.#diagnostic;
  }

  #done(exitCode: number, h1: string[], msg = "", prefix = "CDD_BLOCKED"): void {
    this.#exitCode = exitCode;
    this.#h1 = h1;
    this.#diagnostic = msg ? { prefix, msg } : null;
    this.#finished = true;
  }

  // ---- pre-flight ----

  /** Steps 1/2/2.5/4/5: registry ship gate → plan → workspace → ctx (brief self-provision, F11),
   * template existence, progressDir, review/fix fixed-point derivation. */
  protected override async resolveContext(_hookCtx: DispatchHookContext): Promise<void> {
    if (this.#finished) return;
    const mode = this.#mode();
    const { dryRun = false, registryPath = REG_PATH, pluginRoot: pluginRootFn = pluginRoot } = this.#opts;

    // 1. Registry ship gate + CLI preflight
    let entry: unknown;
    try {
      entry = checkHarness(loadRegistry(registryPath), this.#harness, { dryRun });
    } catch (e) {
      if (e instanceof CddBlockedError) {
        this.#done(e.exitCode, [], e.message, e.kind === "cli-missing" ? "CDD_CLI_MISSING" : "CDD_BLOCKED");
        return;
      }
      throw e;
    }
    this.#entry = entry;

    // 2. Plan → workspace → ctx (#173 unified entry; single root authority, never falls back to cwd)
    let ctx: TaskDispatchContext;
    try {
      // round needs workspace for progress.json, handoffPath needs round — derive workspace first,
      // then round, then ctx (ctx is the sole carrier of the round/handoff derived values).
      const planWorkspace = resolvePlanWorkspace({ planFile: this.#opts.planFile, root: this.#root });
      // Init point (T7): always land one readProgressJSON with the `--plan` arg (absolute path) —
      // first dispatch creates progress.json via createEmptyProgress(plan) (the progress.json#plan
      // assertion's landing point). MUST NOT short-circuit on the getRound branch: implement's
      // round is always 1; folding the read into getRound params would skip the create path on the
      // first implement dispatch and progress.json would never land.
      const progressData = readProgressJSON(planWorkspace.workspace, planWorkspace.plan);
      const round = mode === "implement" ? 1 : getRound(progressData, this.#taskNum, mode);
      ctx = buildCtx(this.#root, this.#taskNum, { mode, harness: this.#harness, planWorkspace, round, findingsPath: this.#opts.findingsPath });
      // F11: self-provision the task brief at plan finalization (--plan takes effect on
      // generation). Failure → RunBlocked → exit 1 — never a silent fallback to an existing brief.
      // Parent-dir bootstrap before writing (same workspace-bootstrap convention as writeBaseBranch).
      try {
        mkdirSync(path.dirname(ctx.briefPath), { recursive: true });
        await generateBrief(planWorkspace.plan, this.#taskNum, ctx.briefPath, this.#root);
      } catch (e) {
        throw new RunBlocked(`brief generation failed: ${(e as Error).message}`);
      }
    } catch (e) {
      if (e instanceof RunBlocked) { this.#done(1, [], e.message); return; }
      // resolveDocArg's missing-path diagnostic goes through exitWithCode (throws ExitRequested) —
      // normalized to the same exit so the noExit=true in-process caller still gets
      // { exitCode: 1 } rather than an exception piercing.
      if (e instanceof ExitRequested) { this.#done(e.code, [], ""); return; }
      throw e;
    }
    this.#tcx = ctx;

    // 2.5 Templates existence check — BLOCKED exit 1 if missing. pluginRoot() =
    // src/render/templates.ts PKG_ROOT = <pkg>/templates (re-org Step 5 semantics converged to
    // that resource directory itself).
    try {
      const tplDir = pluginRootFn();
      if (!existsSync(tplDir)) {
        this.#done(1, [], `templates missing: ${tplDir}`);
        return;
      }
    } catch {
      this.#done(1, [], "templates missing: cdd-engine package root not found");
      return;
    }

    // 4. ctx → progressDir (ledgerPath's directory is the workspace; the legacy "Set env" step
    // died with buildTaskEnv's split).
    const progressDir = path.dirname(ctx.ledgerPath);

    // 5. Task-review / fix fixed-point — derive from the prior-phase handoff (cross-phase read).
    if (mode === "review" || mode === "fix") {
      if (!ctx.fixedPoint) {
        const prev = prevHandoffPath(ctx.workspace, this.#taskNum, mode, ctx.round ?? 1);
        if (prev) {
          const prevCommitsBase = readJsonField(prev, ["commits", "base"]);
          if (prevCommitsBase && prevCommitsBase !== "unknown") {
            ctx.fixedPoint = prevCommitsBase;
          }
        }
      }
      if (dryRun && !ctx.fixedPoint) ctx.fixedPoint = "HEAD~1";
    }
  }

  /** Step 6: mode validation (implement / review / fix legal trio) + required-ctx completeness. */
  protected override async validateMode(_hookCtx: DispatchHookContext): Promise<void> {
    if (this.#finished) return;
    const modeErr = validateModeMsg(this.#mode());
    if (modeErr) { this.#done(1, [], modeErr); return; }
    const missing = requireCtx(this.#tcx, this.#mode());
    if (missing) { this.#done(1, [], missing); return; }
  }

  // ---- dispatch ----

  /** Steps 7/8/8.5: prompt render → agent CLI spawn (or dry-run simulation) → the timeout path
   * (partial handoff + canonical counters). */
  protected override async dispatch(_hookCtx: DispatchHookContext): Promise<void> {
    if (this.#finished) return;
    const mode = this.#mode();
    const dryRun = this.#opts.dryRun === true;
    const ctx = this.#tcx!;
    const progressDir = path.dirname(ctx.ledgerPath);

    // 7. Render prompt
    let prompt: string;
    try {
      prompt = renderModePrompt(mode, buildPromptParams(ctx, this.#taskNum));
    } catch (e) {
      this.#done(1, [], `template render failed: ${(e as Error).message}`);
      return;
    }

    // 8. Invoke CLI (or dry-run simulation)
    let agentOut = "";
    let agentRc = 0;
    let timedOut = false;
    let unkillable = false;
    if (dryRun) {
      agentOut = dryRunH1Block(ctx, this.#taskNum);
    } else {
      const timeoutMs = resolveTimeoutMs(this.#hostEnv(), "task");
      this.#timeoutMs = timeoutMs;
      // Subprocess cwd = the injected root (the single root authority; this function never reads
      // the startup cwd and has no second injection seam). Subprocess env = the host env (zero
      // CDD_* injection — engine-internal state passes via ctx, never across the env boundary).
      const res = (await invokeCliWithRetry(
        this.#entry as { cli: string; invoke: string; output?: string; prefix?: unknown; suffix?: unknown },
        prompt,
        INVOKE_PARAMS[mode] ?? { op: mode },
        this.#hostEnv(),
        this.#root,
        timeoutMs,
      )) as TaskSpawnResult;
      agentOut = res.ok ? res.stdout : "";
      timedOut = res.timedOut === true;
      unkillable = res.unkillable === true;
      if (!res.ok && !timedOut) agentRc = res.code;
    }
    this.#agentOut = agentOut;
    this.#agentRc = agentRc;

    // 8.5 Timeout path — write the partial handoff before commit-contract validation.
    //   timedOut && !unkillable → TIMEOUT partial handoff (status=TIMEOUT + blocker + existing findings);
    //   timedOut && unkillable  → BLOCKED handoff (process unkillable).
    //   Progress: increment the canonical timeout/engineSelfWritten counter.
    if (timedOut) {
      if (unkillable) {
        writeHandoff(ctx.handoffPath, {
          task: this.#taskNum,
          phase: mode,
          status: "BLOCKED",
          failure_category: FAILURE_CATEGORIES.ENGINE_SELF_WRITTEN.id,
          findings: [],
          artifacts: {},
          blocker: `cli process unkillable after timeout → manually kill the process (check ps), then re-dispatch task ${this.#taskNum}`,
        });
        if (!dryRun) {
          incrementRound(progressDir, this.#taskNum, mode);
          maybeExhaust(progressDir, FAILURE_CATEGORIES.ENGINE_SELF_WRITTEN.id, ctx.handoffPath); // engine-self-written → engineSelfWrittenCount (not recovery quota)
        }
        this.#done(1, h1FromHandoff(ctx.handoffPath, ctx.workspace), "process unkillable");
        return;
      }
      // Normal timeout: TIMEOUT partial handoff
      const timeoutMs = this.#timeoutMs;
      writeHandoff(ctx.handoffPath, {
        task: this.#taskNum,
        phase: mode,
        status: "TIMEOUT",
        failure_category: FAILURE_CATEGORIES.TIMEOUT.id,
        findings: [],
        artifacts: {},
        blocker: `cli timed out after ${timeoutMs}ms → simplify task ${this.#taskNum} scope or increase timeout, then re-dispatch`,
      });
      if (!dryRun) incrementRound(progressDir, this.#taskNum, mode);
      // TIMEOUT counter increment: field via canonical counterFor, category identity via
      // FAILURE_CATEGORIES (replaces the legacy timeoutCount++ three-liner, T6 zero hand-written
      // counter literals).
      maybeExhaust(progressDir, FAILURE_CATEGORIES.TIMEOUT.id, ctx.handoffPath);
      this.#done(1, h1FromHandoff(ctx.handoffPath, ctx.workspace), `cli timed out after ${timeoutMs}ms`);
      return;
    }
  }

  #hostEnv(): NodeJS.ProcessEnv {
    // env = the host environment (spawnManaged strips credentials); the engine derives zero env
    // values itself. opts.env is the injectable override (no-reset / no-ForTest seam).
    return this.#opts.env ?? process.env;
  }

  // ---- post-flight ----

  /** Steps 8.8/10/10.5: handoff schema recovery (CONTRACT_VIOLATION keeps findings) +
   * failure-without-handoff BLOCKED writes. */
  protected override async schemaValidate(_hookCtx: DispatchHookContext): Promise<void> {
    if (this.#finished) return;
    const mode = this.#mode();
    const dryRun = this.#opts.dryRun === true;
    const ctx = this.#tcx!;
    const progressDir = path.dirname(ctx.ledgerPath);

    // 8.8 Handoff JSON Schema validation — reject malformed handoffs before downstream processing.
    // T7: implement-gated (mode !== "implement") — the HANDOFF path is not an implement input
    // channel (the engine is the implement carrier's sole author; the implement agent writes no
    // handoff; step 13 materializes it from H1 + TASK_BASE + HEAD). review/fix keep the read +
    // validation (the agent is the content author; findings content contract).
    if (mode !== "implement") {
      const existingHandoff = readJson(ctx.handoffPath);
      if (existingHandoff) {
        const sv = validateHandoffSchema(existingHandoff);
        if (!sv.valid) {
          // T5 CONTRACT_VIOLATION recovery (spec §2.5.2, AC7 category-level): normalize → re-validate
          // (at most one round) — the recovery single point is src/rules/schema.ts#recoverHandoff,
          // shared by all three runners. Both sub-branches write the NORMALIZED object (an invalid
          // key must never stay on disk) — full-replace writeOwnHandoff always, never a shallow
          // merge (a shallow merge would re-feed the offending keys from the existing file).
          const rec = recoverHandoff(existingHandoff, "task");
          if (rec.valid) {
            writeOwnHandoff(ctx.handoffPath, rec.handoff);
          } else {
            // Normalization unfixable (missing required / type-enum mismatch) → still BLOCKED, but
            // findings kept in full (A4 defect surface): the parsed findings enter the carrier
            // as-is instead of a wholesale rewrite to [].
            writeOwnHandoff(ctx.handoffPath, {
              task: this.#taskNum,
              phase: mode,
              status: "BLOCKED",
              failure_category: FAILURE_CATEGORIES.CONTRACT_VIOLATION.id,
              findings: rec.preservedFindings,
              artifacts: {},
              blocker: `handoff schema invalid${rec.reason} → fix the handoff JSON at ${ctx.handoffPath} and re-dispatch task ${this.#taskNum}`,
            });
            if (!dryRun) {
              incrementRound(progressDir, this.#taskNum, mode);
              maybeExhaust(progressDir, FAILURE_CATEGORIES.CONTRACT_VIOLATION.id, ctx.handoffPath); // format error on the producing side
            }
            this.#done(1, h1FromHandoff(ctx.handoffPath, ctx.workspace), `schema validation failed${rec.reason}`);
            return;
          }
        }
      }
    }

    // 10. Nested CLI failed with no handoff → write BLOCKED handoff (stderr into blocker) + H1 +
    //     the CDD_BLOCKED diagnostic + exit 1.
    if (this.#agentRc !== 0 && !existsSync(ctx.handoffPath)) {
      writeHandoff(ctx.handoffPath, {
        task: this.#taskNum,
        phase: mode,
        status: "BLOCKED",
        failure_category: FAILURE_CATEGORIES.EXECUTION_FAILURE.id,
        commits: { base: "unknown" },
        findings: [],
        artifacts: {},
        blocker: `cli exited ${this.#agentRc} without writing handoff → check stderr above for errors, fix, then re-dispatch task ${this.#taskNum}`,
      });
      if (!dryRun) {
        incrementRound(progressDir, this.#taskNum, mode);
        incrementRecovery(progressDir); // REAL execution failure (not timeout / not engine-written) → EXECUTION_FAILURE — the only recovery-quota consumer (AC7)
      }
      this.#done(1, h1FromHandoff(ctx.handoffPath, ctx.workspace), `cli exited ${this.#agentRc} and handoff missing`);
      return;
    }

    // 10.5. CLI succeeded but no handoff → BLOCKED (file-existence check, not phase-mismatch
    // fallback). Agent exits 0 without writing a handoff = error. dry-run excluded (no handoff
    // invariant — bash dry-run writes none, neither does Node). implement excluded (T6): the
    // runner materializes in step 13's OK path — implement agents write no handoff and this check
    // would falsely BLOCK every successful implement.
    if (this.#agentRc === 0 && !dryRun && mode !== "implement" && !existsSync(ctx.handoffPath)) {
      writeHandoff(ctx.handoffPath, {
        task: this.#taskNum,
        phase: mode,
        status: "BLOCKED",
        failure_category: FAILURE_CATEGORIES.ENGINE_SELF_WRITTEN.id,
        findings: [],
        artifacts: {},
        blocker: `${path.basename(ctx.handoffPath)} not written after exit 0 → re-run ${mode} and ensure handoff is written to ${ctx.handoffPath} before exit`,
      });
      incrementRound(progressDir, this.#taskNum, mode);
      maybeExhaust(progressDir, FAILURE_CATEGORIES.ENGINE_SELF_WRITTEN.id, ctx.handoffPath); // engine-written BLOCKED (exit 0 without handoff)
      this.#done(1, h1FromHandoff(ctx.handoffPath, ctx.workspace), `${mode} agent did not write handoff`);
      return;
    }
  }

  /** Steps 11/12/13: H1 four-line parse → agent-failure exit → implement materialization
   * (dry-run writes no handoff — aligned with bash). */
  protected override async normalizeResult(_hookCtx: DispatchHookContext): Promise<void> {
    if (this.#finished) return;
    const mode = this.#mode();
    const dryRun = this.#opts.dryRun === true;
    const ctx = this.#tcx!;
    const progressDir = path.dirname(ctx.ledgerPath);

    // 11. H1 four lines (from the agent stdout / dry-run block)
    let h1 = h1FourLines(this.#agentOut, ctx.workspace);

    // 12. Agent failed but handoff exists → exit agent_rc (raw H1 stays from agent stdout).
    if (this.#agentRc !== 0) {
      this.#done(this.#agentRc, h1, "");
      return;
    }

    // 13. OK — implement materialization (dry-run does not write a handoff — aligned with bash).
    //     T5: status single authority — the review-type handoff is derived/overwritten by the
    //     engine at finalization (SP-4 exempts failure rounds). T6: implement materializes — the
    //     agent writes no handoff (implement.md dropped the Handoff Output section), the runner
    //     builds task-N-implement.json from the H1 four lines + brief TASK_BASE + git HEAD;
    //     evidence-gate read-back (behavior_change:true → hard; else soft WARN). T7: the carrier
    //     comes home to the engine — implement/review finalize through finalizeHandoff,
    //     writeOwnHandoff full-replace, H1 always re-emits from h1FromHandoff.
    if (!dryRun && mode === "implement") {
      const finalized = await finalizeHandoff({
        mode,
        h1,
        brief: ctx.briefPath,
        repoRoot: this.#root,
        workspace: ctx.workspace,
        taskNum: this.#taskNum,
      });
      if (finalized.handoff) {
        writeOwnHandoff(ctx.handoffPath, finalized.handoff);
        h1 = h1FromHandoff(ctx.handoffPath, ctx.workspace);
        // Materialized H1 and handoff/exit align: hard gate or an agent-declared BLOCKED → exit 1.
        if (finalized.exitCode !== 0) {
          maybeExhaust(progressDir, FAILURE_CATEGORIES.ENGINE_SELF_WRITTEN.id, ctx.handoffPath);
          this.#done(finalized.exitCode, h1, "");
          return;
        }
      }
      // Degradation exception (T6 nit2, documented): missing brief / no TASK_BASE line →
      // finalizeHandoff materializes nothing (handoff:null + stderr CDD_WARN; the agent's original
      // H1 stays). dry-run and smoke chains both land here — an ENOENT must never crash the runner.
    }
    this.#h1 = h1;
  }

  /** Step 13.5 + post-gate writeback: the exit gate (validateCommitContract) runs for every
   * non-finished non-dry-run round; after it passes, the APPROVED-review task.status=complete
   * writeback + non-implement round increment land (a dirty failure round never marks complete). */
  protected override async commitPostCheck(_hookCtx: DispatchHookContext): Promise<void> {
    if (this.#finished) return;
    const mode = this.#mode();
    const dryRun = this.#opts.dryRun === true;
    const ctx = this.#tcx!;
    const progressDir = path.dirname(ctx.ledgerPath);

    // 13.5 T8: post-run commit-contract — all task modes (implement/fix/review).
    //   implement/fix: dirty + head validation (validateCommitContract embeds rewriteHandoffBlocked);
    //   review: dirty-only (a review handoff's commits describe the reviewed commit, head skipped).
    //   !dryRun guard: dry-run writes no handoff invariant — a dirty smoke tree must not trigger a
    //   real BLOCKED rewrite and pollute dry-run semantics.
    if (!dryRun) {
      const cv = await validateCommitContract(mode, this.#root, { handoffPath: ctx.handoffPath });
      if (!cv.ok) {
        maybeExhaust(progressDir, FAILURE_CATEGORIES.ENGINE_SELF_WRITTEN.id, ctx.handoffPath); // commit-contract rewrite → engineSelfWrittenCount
        this.#done(1, h1FromHandoff(ctx.handoffPath, ctx.workspace), cv.blocker);
        return;
      }
    }

    // T5/T7: status single authority — the review-type handoff is finalized by the engine
    // (finalizeHandoff rollup overwrites the agent-declared status, SP-4 exempts failure rounds);
    // the success path reads the finalized handoff and persists it (writeOwnHandoff full-replace),
    // and re-emits H1 from h1FromHandoff.
    // T8: APPROVED review writeback → progress task.status=complete (after the gate — a dirty
    // failure round never marks complete).
    if (!dryRun && mode === "review") {
      const reviewHandoff = readJson(ctx.handoffPath);
      if (reviewHandoff) {
        const finalized = await finalizeHandoff({ mode, agentHandoff: reviewHandoff });
        // persistFinalized: derivation unchanged (same reference) → skip the write (no no-op
        // overwrite); changed → full-replace + sync.
        persistFinalized(ctx.handoffPath, reviewHandoff, finalized);
        this.#h1 = h1FromHandoff(ctx.handoffPath, ctx.workspace);
        if (normalizeHandoffStatus(reviewHandoff.status as string) === "APPROVED") {
          // T7: this read stays single-arg — at review-success execution progress.json already
          // exists (plan recorded at the init point); plan no longer participates in
          // createEmptyProgress derivation.
          const progressData2 = readProgressJSON(progressDir);
          let taskEntry = progressData2.tasks.find((t) => t.task === this.#taskNum);
          if (!taskEntry) {
            taskEntry = { task: this.#taskNum, status: "pending", rounds: {} };
            progressData2.tasks.push(taskEntry);
          }
          taskEntry.status = "complete";
          writeProgressJSON(progressDir, progressData2);
        }
      }
    }
    if (!dryRun && mode !== "implement") incrementRound(progressDir, this.#taskNum, mode);
    this.#done(0, this.#h1, "");
  }
}

/** runTask — legacy surface kept ({ exitCode, h1 }; noExit=true suppresses the stdout/stderr +
 * exit-throw: the unit-test seam). Builds the injected ctx, runs TaskLifecycle, converts an
 * entry-gate DispatchBlocked into a CDD_BLOCKED stderr + exit 1 (or a { exitCode: 1, h1: [] } in
 * noExit mode); on the normal path writes the diagnostic + H1 lines + exits via exitWithCode when
 * noExit=false. */
export async function runTask(harness: string, taskNum: number, opts: TaskRunOptions = {}): Promise<TaskResult> {
  return withLifecycle(async () => {
    // root is injected (default getRoot()); in-process tests without an injection throw — the
    // correct failure face, never a graceful fallback.
    const root = opts.root ?? getRoot();
    const lc = new TaskLifecycle({
      harness,
      taskNum,
      opts,
      ctx: { mode: opts.mode ?? "", repoRoot: root, handoffPath: "" },
    });
    try {
      await lc.run();
    } catch (e) {
      // Entry gate (pre-flight): no handoff exists yet — the CLI face maps it to exit 1 (base.ts
      // contract); noExit=... preserves the in-process seam.
      if (e instanceof DispatchBlocked && e.gate === "entry") {
        if (opts.noExit) return { exitCode: 1, h1: [] };
        process.stderr.write(`CDD_BLOCKED: ${e.message}\n`);
        exitWithCode(1);
      }
      throw e;
    }
    const { exitCode, h1 } = lc.result;
    const diag = lc.diagnostic;
    if (!opts.noExit) {
      if (diag) process.stderr.write(`${diag.prefix}: ${diag.msg}\n`);
      for (const line of h1) process.stdout.write(`${line}\n`);
      exitWithCode(exitCode);
    }
    return { exitCode, h1 };
  });
}

// ---- plan building blocks (pure functions, unit-test seam) ----

/** Aligns _task_numbers_from_plan: `^### Task N:` → numeric sort. */
export function taskNumbersFromPlan(planFile: string): number[] {
  const nums: number[] = [];
  for (const line of readFileSync(planFile, "utf8").split("\n")) {
    const m = line.match(/^### Task (\d+):/);
    if (m) nums.push(Number(m[1]));
  }
  return nums.sort((a, b) => a - b);
}

/** Read the status of the latest review handoff (progressData.rounds["review"] round).
 * reviewRound=0 → no review completion record → "MISSING"; corrupt → "UNKNOWN". */
export function handoffStatus(taskNum: number, workspace: string, progressData: { tasks?: Array<{ task: number; rounds?: Record<string, number> }> } | undefined): string {
  const reviewRound = progressData?.tasks?.find((t) => t.task === taskNum)?.rounds?.["review"] ?? 0;
  if (reviewRound === 0) return "MISSING";
  const handoffPath = path.join(workspace, handoffName("review", "task", { task: taskNum, round: reviewRound }));
  if (!existsSync(handoffPath)) return "MISSING";
  try {
    return normalizeHandoffStatus((JSON.parse(readFileSync(handoffPath, "utf8")).status ?? "UNKNOWN") as string) ?? "UNKNOWN";
  } catch {
    return "UNKNOWN";
  }
}

/** review round=0 → review never completed → pending; otherwise read the latest review handoff
 * status. */
export function isTaskPending(taskNum: number, workspace: string, progressData: { tasks?: Array<{ task: number; rounds?: Record<string, number> }> } | undefined): boolean {
  const reviewRound = progressData?.tasks?.find((t) => t.task === taskNum)?.rounds?.["review"] ?? 0;
  if (reviewRound === 0) return true; // no review ever completed
  return handoffStatus(taskNum, workspace, progressData) !== "APPROVED";
}
