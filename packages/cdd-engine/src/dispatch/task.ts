// packages/cdd-engine/src/dispatch/task.ts — TaskLifecycle (Task 8; ex dispatch/task.mjs / legacy
// lib/runner/run-task.mjs): the task-function lifecycle for `cdd implement/review/fix --type task`.
// Extends DispatchLifecycle (dispatch/base.ts) and inherits BOTH commit gates — the pre-flight
// entry gate (pre-commit clean tree) and the post-flight exit gate (validateCommitContract) are
// the base's default hooks; this file only overrides the virtual hooks it cares about (spec §2.12
// "abstract-base-class inheritance override"; never touches the hookable registry).
//
//   pre-flight  resolveContext — steps 1/2/2.5/4/5: registry ship gate → plan → workspace → ctx
//               (brief self-provision at plan finalization, F11) → template existence → progressDir
//               → review/fix fixed-point (prior-handoff reads). validateMode — step 6.
//   dispatch    steps 7/8/8.5: prompt render → spawn the agent CLI (dry-run simulation) → the
//               timeout path (partial handoff + counters).
//   post-flight schemaValidate — steps 8.8/10/10.5: handoff schema recovery (CONTRACT_VIOLATION
//               keeps findings) + failure-without-handoff BLOCKED writes. normalizeResult — steps
//               11/12/13: return block three-line parse, agent-failure exit, implement materialization.
//               commitPostCheck — step 13.5 + review writeback: the exit gate (skipped on
//               finished rounds / dry-run; failed gate → maybeExhaust + BLOCKED return block), then the
//               APPROVED-review ensure-row writeback + round increment (post-gate only —
//               a dirty failure round never marks complete; the complete verdict is derived by
//               deriveTaskState, never stored — Task 30 ②).
//
// P6 T24: the return-block text plane (returnFourLines parse / dryRunBlock serialize /
// returnCountersLine counters) is owned by src/artifacts/return-block.ts (its single point) — this
// file imports + re-exports the task-facing read-back atoms; engine stdout now emits via the
// ResultFace status capsule (rules/result-face.ts), never a return-block atom; the failure-carrier
// writes route through the writeBlockedCarrier single terminal in finalize.ts; the workspace
// derivation + materialization live in infra/workspace.ts (WorkspaceRoot/Workspace — the slug-
// derivation single entry is WorkspaceRoot#for). runTask keeps the legacy { exitCode, returnBlock }
// surface ({ noExit } seam) as the static TaskLifecycle.run entry (Task 6/7 export-surface reshuffle:
// `runTask` → `TaskLifecycle.run` — no bare forwarding shell).
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { CrashTeardown, crashCauseFor, resumeCommandFor } from "../artifacts/crash.ts";
import {
  normalizeHandoffStatus,
  persistFinalized,
  recoverHandoff,
  writeBlockedCarrier,
} from "../artifacts/handoff/finalize.ts";
import { readJson, writeOwnHandoff } from "../artifacts/handoff/write.ts";
import { Handoff } from "../artifacts/handoff.ts";
import { hashFile } from "../artifacts/hash.ts";
import { ProgressLedger } from "../artifacts/progress.ts";
import { ReturnBlockParser } from "../artifacts/return-block.ts";
import { RoundContext } from "../artifacts/round-context.ts";
import { DOC_TOKENS } from "../documents/tokens.ts";
import { type TaskGroup, toTaskGroup } from "../domain/task-group.ts";
import { CddExitError, ExitRequested, exitWithCode, invariant } from "../infra/exit.ts";
import { type DispatchOp, EngineInvoker } from "../infra/invoke.ts";
import type { TerminationCause, TerminationConfig } from "../infra/proc.ts";
import { CddBlockedError, REG_PATH, Registry } from "../infra/registry.ts";
import { resolveDocArg } from "../infra/root.ts";
import { type CddRuntimeLike, runtime } from "../infra/runtime.ts";
import { type Workspace, WorkspaceRoot } from "../infra/workspace.ts";
import { BriefRenderer } from "../render/brief.ts";
import { TemplateLoader } from "../render/templates.ts";
import { CommitChecker } from "../rules/commit.ts";
import { DocumentsValidator } from "../rules/documents.ts";
import { FAILURE_CATEGORIES, FailureResolver } from "../rules/failure.ts";
import {
  CRASH_RECOVERY_CAP_ROUNDS,
  type NextStepArgs,
  NextStepRouter,
  SOFT_CAP_S1_ROUNDS,
} from "../rules/next-step.ts";
import { maxConsecutiveS1Rounds } from "../rules/ref-sequence.ts";
import { ResultFace } from "../rules/result-face.ts";
import { HandoffSchemaValidator } from "../rules/schema.ts";
import {
  DispatchBlocked,
  type DispatchContext,
  type DispatchHookContext,
  DispatchLifecycle,
} from "./base.ts";

const VALID_MODES = ["implement", "review", "fix"];

// mode → invokeCli (op, type?) injection params.
//   review → ("review","task"); fix → ("fix","task"); implement → ("implement", null).
//   The prefix value resolves via registry resolveInjection (entry.prefix[op][type?]).
const INVOKE_PARAMS: Record<string, { op: string; type?: string }> = {
  review: { op: "review", type: "task" },
  fix: { op: "fix", type: "task" },
  implement: { op: "implement" },
};

// ---- workspace / ctx ----

/** resolvePlanWorkspace({ planFile, root }) — the plan → workspace UNIQUE derivation point:
 * `--plan` normalizes to the repo-root coordinate system via resolveDocArg (missing → exit-1
 * diagnostic), then derives the workspace (WorkspaceRoot.for — the slug-derivation single entry) and
 * MATERIALIZES it (root-level bootstrap guard + the slug dir; the former materializeWorkspace
 * semantics). The "missing plan → CddExitError kind run-blocked" guard text lives only here — runTask
 * step 2 and the buildContext direct-entry share this function. */
export function resolvePlanWorkspace({ planFile, root }: { planFile?: string; root: string }): {
  plan: string;
  workspace: Workspace;
} {
  const plan = planFile ? resolveDocArg(planFile, root, "plan") : "";
  if (!plan)
    throw new CddExitError("cannot resolve repo root: provide --plan", {
      exitCode: 1,
      kind: "run-blocked",
    });
  const workspaceRoot = WorkspaceRoot.from(root);
  workspaceRoot.ensure();
  const workspace = workspaceRoot.for(plan);
  workspace.ensure();
  return { plan, workspace };
}

/** TaskDispatchContext — the task dispatch's derived engine state (buildContext output). Typed carrier
 * (P4.4 Task 5): every field is a declared member — no bare `Record<…>` / index-signature
 * surface travels the domain; the handoff schema validation stays the engine's schema face,
 * there is no second enforcement implementation. `workspace` is the canonical Workspace object
 * (T6 injection rework — path derivation is owned by the workspace class). */
export interface TaskDispatchContext {
  plan: string;
  round: number;
  workspace: Workspace;
  handoffPath: string;
  briefPath: string;
  ledgerPath: string;
  constraintsPath: string;
  findingsPath: string | null;
  mode: string;
  harness?: string;
  fixedPoint: string;
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

// Returns the path of the handoff written by the previous phase for this group (file name derived
// via the Handoff canonical naming; cross-family prev-table semantics preserved). Returns a path or
// null (implement has no prior). task-mode three-in-one (review/fix share the family table).
// P4.3/4.4: the key is the group key string (`tasks-1,2` — the group is the dispatch unit).
function prevHandoffPath(
  workspace: Workspace,
  groupKey: string,
  mode: string,
  round: number,
): string | null {
  if (mode !== "review" && mode !== "fix") return null; // implement has no prior phase
  return Handoff.prevHandoffPath(workspace.path, mode, "task", round, { tasks: groupKey });
}

// Aligns cdd_require_env mode validation (mode is no longer an env channel).
function validateModeMsg(mode: string): string | null {
  if (!VALID_MODES.includes(mode)) return `mode must be implement|review|fix (got: ${mode})`;
  return null;
}

// Aligns cdd_require_env: required ctx fields + mode-specific extras (fix → findingsPath).
function requireCtx(ctx: TaskDispatchContext | null, mode: string): string | null {
  const missing: string[] = [];
  const required: Array<keyof TaskDispatchContext> = [
    "workspace",
    "briefPath",
    "ledgerPath",
    "mode",
    "handoffPath",
    "constraintsPath",
  ];
  for (const k of required) {
    if (!ctx?.[k]) missing.push(k);
  }
  if (mode === "fix" && !ctx?.findingsPath) missing.push("findingsPath");
  return missing.length > 0 ? `Missing required ctx fields: ${missing.join(" ")}` : null;
}

/** {{PLACEHOLDER}} template params (P4.4 Task 3 ④ contract-token surface: the collapsed
 * round-context set — DISPATCH_UNIT (the group key) / BRIEF / FINDINGS / FIXED_POINT / CONSTRAINTS /
 * WORKSPACE / DOC + WORKSPACE_SLUG / HANDOFF_TARGET + REVIEW_PLAN_LINE — derived from the explicit
 * plan path; no env-sourced plan key). */
export function buildPromptParams(
  ctx: TaskDispatchContext,
  group: TaskGroup,
): Record<string, string> {
  return {
    WORKSPACE: ctx.workspace.path,
    // Canonical slug slot (Task 20 ⑦): the workspace slug strips a single -design/-plan layer so a
    // plan and its paired spec converge to the same slug, e.g. kairos-overhaul-p6.
    WORKSPACE_SLUG: ctx.workspace.slug,
    BRIEF: ctx.briefPath,
    HANDOFF_TARGET: ctx.handoffPath,
    FINDINGS: ctx.findingsPath ?? "",
    CONSTRAINTS: ctx.constraintsPath,
    FIXED_POINT: ctx.fixedPoint ?? "", // empty string if the cross-phase read returned nothing
    DISPATCH_UNIT: group.key(),
    REVIEW_PLAN_LINE: ctx.plan ? `**Plan:** ${ctx.plan}` : "",
  };
}

/** TaskRunOptions — runTask's public opts (signature keys only; anything else unused). */
export interface TaskRunOptions {
  /** The dispatch op — the legal trio (the only values the CLI faces pass: implement / review /
   * fix literal modes). A persisted invalid value is rejected at pre-flight validateMode. */
  mode?: DispatchOp;
  planFile?: string;
  root?: string;
  dryRun?: boolean;
  noExit?: boolean;
  env?: NodeJS.ProcessEnv;
  registryPath?: string;
  findingsPath?: string;
  pluginRoot?: () => string;
  /** Constructor-injected CddRuntime stand-in (P4.4 Task 4 ②): substitutes the singleton for the
   * dispatch's mutable-state reads/writes (dryRun / root / proc lifecycle). Tests inject a stub to
   * prove dryRun/root/proc flow through the class face; production callers leave it unset. */
  runtime?: CddRuntimeLike;
  /** Test/override seam (non-env, mirrors registryPath; T26): shorten the termination monitor's
   * timing for deterministic timeout/stall tests. Production callers leave it unset — canonical
   * defaults apply. */
  termination?: Partial<TerminationConfig>;
}

interface TaskResult {
  exitCode: number;
  returnBlock: string[];
}

interface TaskDiagnostic {
  prefix: string;
  msg: string;
}

// The spawn result as the legacy runner read it: the inflight result carries no `unkillable` field
// (the legacy `res.unkillable === true` always read undefined → false); typed for parity so the
// timeout-unkillable branch keeps its exact legacy shape. `cause` is the T26 unified termination
// cause — surfaced by spawnManaged when the termination monitor killed the group (stalled /
// over-budget) or an external SIGTERM ended it (signal).
interface TaskSpawnResult {
  ok: boolean;
  code: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  unkillable?: boolean;
  cause?: TerminationCause;
}

/** TaskLifecycle — the task-function lifecycle class. All 13.5 steps of the legacy run-task.mjs
 * relocate into the hook overrides; the entry/exit gates are inherited from the base. Results
 * surface via .result ({ exitCode, returnBlock }) + .diagnostic (stderr message) after run(). The
 * ctx assembly is the class's own public face (buildContext — the bare function buildCtx moved into the class public face, Task 6 ①);
 * the static TaskLifecycle.run is the legacy runTask surface.
 * P4.3/P4.4: the dispatch unit is the task GROUP value object (TaskGroup) — handoff/brief/findings/
 * progress all key off the group (`tasks-{key}-*`; the scalar task number enters only where a
 * per-task primitive is required — the carrier `task` field / scope-brief seed). */
export class TaskLifecycle extends DispatchLifecycle {
  readonly #harness: string;
  readonly #group: TaskGroup;
  readonly #groupKey: string;
  readonly #opts: TaskRunOptions;
  readonly #root: string;
  /** The injected CddRuntime stand-in (P4.4 Task 4 ②) — the singleton by default. All
   * mutable-state reads (dryRun) and lifecycle ops route through this instance. */
  readonly #runtime: CddRuntimeLike;
  // Service seams (constructible, stateless or injected): the ctx round anchor + carrier, the
  // rule/service classes the lifecycle delegates to (Task 6/7 seams).
  readonly #registry: Registry;
  readonly #invoker: EngineInvoker;
  /** The progress ledger (T6 injection rework): Workspace-injected — constructed in resolveContext once the
   * plan workspace derives (this.#ledger stays null until then). */
  #ledger: ProgressLedger | null = null;
  /** Crash recovery — the lane-shared teardown wrapper (crash-only snapshot + crash record). */
  readonly #crash: CrashTeardown;
  readonly #templates: TemplateLoader;
  readonly #briefRenderer: BriefRenderer;
  readonly #commit: CommitChecker;
  readonly #failure: FailureResolver;
  readonly #schema: HandoffSchemaValidator;
  readonly #returnBlockParser: ReturnBlockParser;
  /** C5 (T3) — the single stdout capsule face + its injected router (constructor injection; the
   *  task-family 4-line return block is retired in favor of the capsule — status/blocker/handoff +
   *  the derived `next:` line). */
  readonly #nextRouter: NextStepRouter;
  readonly #resultFace: ResultFace;

  #entry: unknown = null;
  #tcx: TaskDispatchContext | null = null;
  #handoff: Handoff | null = null;
  /** the child's return-block stdout — the parse input for returnFourLines (gated on res.ok:
   *  a failed child's stdout is arbitrary trace output, never a return block). */
  #agentOut = "";
  /** the child's raw stdout (T7 — preserved for the crash teardown's stdout tail; captured
   *  unconditionally so the HARNESS_ABORT/TIMEOUT crash record carries the real stdout trace,
   *  never the empty-on-failure return-block gate). */
  #agentStdout = "";
  /** the child's raw stderr (T7 — preserved for the crash teardown's stderr tail; keep the failed
   *  dispatch's "403 / model abort" trace, not the legacy discard-on-failure). */
  #agentErr = "";
  #agentRc = 0;
  #timeoutMs: number | undefined;
  #returnBlock: string[] = [];
  #exitCode = -1;
  #diagnostic: TaskDiagnostic | null = null;
  #finished = false;

  constructor(options: {
    harness: string;
    group: TaskGroup;
    opts: TaskRunOptions;
    ctx: DispatchContext;
  }) {
    super({ ctx: options.ctx });
    this.#harness = options.harness;
    this.#group = options.group;
    this.#groupKey = options.group.key();
    this.#opts = options.opts;
    // Root single authority (branch lane's dual-root design, mirror): the engine ctx.repoRoot is
    // authoritative for the base gates (doc-contract missing-root lane reads THE SAME field — a
    // null ctx root must reach that C3-a BLOCK/WARN lane, never silently starve resolution); #root
    // falls back to the injected opts.root so an in-process caller seeding a root-less ctx still
    // resolves its workspace and the task face's non-throwing #done terminal properly BLOCKs on the
    // missing-root condition. runTask always injects a non-null ctx.repoRoot → production behavior
    // is unchanged by the fallback (it only fires where resolution previously died unhelpfully).
    this.#root = (options.ctx.repoRoot as string) ?? options.opts.root ?? "";
    this.#runtime = options.opts.runtime ?? runtime;
    this.#registry = new Registry();
    this.#invoker = new EngineInvoker();
    this.#crash = new CrashTeardown();
    this.#templates = new TemplateLoader();
    this.#briefRenderer = new BriefRenderer();
    this.#commit = new CommitChecker();
    this.#failure = new FailureResolver();
    this.#schema = new HandoffSchemaValidator();
    this.#returnBlockParser = new ReturnBlockParser();
    this.#nextRouter = new NextStepRouter();
    this.#resultFace = new ResultFace({ nextRouter: this.#nextRouter });
  }

  /** The dispatch group's task list (readonly view — the scalar list the agent-facing
   * carriers/progress rows are keyed by; the group key stays TaskGroup-derived, no second form). */
  get #tasks(): number[] {
    return [...this.#group.numbers];
  }

  /** dry-run — the injected runtime's isDryRun() feeds the dispatch (P4.4 Task 4 ②): the CLI
   * threads DRY_RUN() via opts.dryRun (same singleton state), and an injected stand-in substitutes
   * its own flag; the OR keeps both seams honest without double state. */
  get #dryRun(): boolean {
    return this.#opts.dryRun === true || this.#runtime.isDryRun();
  }

  #mode(): string {
    // Mode comes from the injected opts (never env). resolveContext/validateMode handle the
    // semantics; the empty fallback renders "got: " in the mode-must-be diagnostic (the legacy
    // undefined-got message, same rejection face).
    return this.#opts.mode ?? "";
  }

  /** The typed dispatch op (the op derivation point — the type-narrowed sibling of #mode()); the
   *  valid trio is guaranteed post-validateMode (pre-flight step 6 rejects persisted invalids);
   *  the raw possibly-empty value for that diagnostic stays on #mode() — read directly at its
   *  single pre-validation consumer (validateMode). */
  #op(): DispatchOp {
    const mode = this.#mode();
    invariant(
      mode === "implement" || mode === "review" || mode === "fix",
      `task: invalid dispatch op (got: ${mode})`,
    );
    return mode;
  }

  /** Read the `--findings` INPUT findings (fix face, C5-1 — the fix next-hop judges on the input
   *  content, never the fix's own carrier). Missing/unreadable input → [] (the conservative 0-blocker
   *  baseline — the suggestion is a default, never a throw). */
  #inputFindings(path: string | null | undefined): Array<{ severity?: string }> {
    if (!path) return [];
    const h = readJson(path) as { findings?: Array<{ severity?: string }> } | null;
    return Array.isArray(h?.findings) ? h.findings : [];
  }

  /** C5 (T8) — the task capsule's `next:` derivation input (rules/next-step.ts NextStepRouter pure
   *  derivation; zero new CLI args C5-2). Suggestion semantics (C5-0): a default next-hop, overridable
   *  by mid-backfill / user adjudication. The failure lanes pass no args → the capsule carries no
   *  `next:` (BLOCKED rounds — the stderr CDD_BLOCKED face owns them; the router also nulls any
   *  BLOCKED/TIMEOUT status). Review zero-findings: the remaining-group / all-done facts derive from
   *  the plan's effective dispatch groups (serial in-order default — the "no mid-stream change" path);
   *  an unreadable plan degrades to the conservative `none`. */
  #nextArgs(deps: {
    mode: string;
    status?: string | null;
    findings?: ReadonlyArray<{ severity?: string }>;
    findingsPath?: string | null;
  }): NextStepArgs {
    const ctx = this.#tcx;
    const args: NextStepArgs = {
      op: deps.mode as NextStepArgs["op"],
      type: "task",
      group: this.#groupKey,
      plan: ctx?.plan,
      status: deps.status ?? undefined,
      findings: deps.findings,
      findingsPath: deps.findingsPath ?? undefined,
    };
    // C5-1 soft cap (T8 fix): the FIX face judges BEYOND the source round's own severity — the next
    // hop defers to user adjudication when the ref sequence (the 'ref-sequence round counting' basis)
    // has reached SOFT_CAP_S1_ROUNDS consecutive S1 rounds. The walk anchors at the `--findings`
    // source review handoff and counts backward through this group's rounds — missing history
    // degrades, never throws (a dry-run/fresh fix has no older rounds → no cap).
    if (deps.mode === "fix" && ctx?.findingsPath) {
      args.softCap =
        maxConsecutiveS1Rounds(
          {
            type: "task",
            sourcePath: ctx.findingsPath,
            tasks: this.#groupKey,
          },
          this.#nextRouter,
        ) >= SOFT_CAP_S1_ROUNDS;
    }
    if (args.op === "review" && (deps.findings ?? []).length === 0) {
      let groups: TaskGroup[] = [];
      try {
        groups = ctx?.plan ? new DocumentsValidator().effectiveGroups(ctx.plan) : [];
      } catch {
        groups = [];
      }
      const idx = groups.findIndex((g) => g.key() === this.#groupKey);
      if (idx >= 0 && idx < groups.length - 1) args.nextGroup = groups[idx + 1]!.key();
      else if (idx >= 0) args.allGroupsDone = true;
    }
    return args;
  }

  /** C5 (T3) — the task round's stdout capsule (StatusDeriver/NextStepRouter/Convergence via the
   *  injected ResultFace): review → the judgment axis + its own findings blocker; implement/fix →
   *  the work axis + the decision-source blocker (fix = the `--findings` input count; implement = 0).
   *  `next` = the C5 derivation args (absent → no `next:` line). */
  #face(
    status: string | undefined,
    findings?: ReadonlyArray<{ severity?: string }>,
    next?: NextStepArgs,
  ): string[] {
    return this.#resultFace.emit({
      op: this.#op(),
      handoffPath: this.#tcx?.handoffPath ?? "",
      status,
      findings,
      next,
    });
  }

  /** The crash-recovery soft-cap bump (T8 fold D): one crash-teardown event increments the group's
   *  recovery count (progress.json tasks[N].recovery_count — the per-task persistence point) and
   *  returns whether the soft cap (CRASH_RECOVERY_CAP_ROUNDS) is now reached. Soft by nature
   *  (C5-0): the failure capsule's `next:` then defers to user adjudication (`BLOCKED:
   *  crash-recovery-cap`), never a hard block. External incidents (403 / OOM / over-budget) are not
   *  task defects — the FailureResolver category caps stay untouched. The count tracks the
   *  CONSECUTIVE streak — a normal-face round resets it (#clearResolvedCrashState), so the cap
   *  never sticks a task whose latest round terminated normally. */
  #bumpRecovery(): boolean {
    if (this.#dryRun) return false;
    return this.#ledger!.incrementRecoveryCount(this.#groupKey) >= CRASH_RECOVERY_CAP_ROUNDS;
  }

  /** The normal-face crash-state teardown (T8): a round terminating at the NORMAL face leaves the
   *  crash-recovery surface — ① its abnormal-face crash record no longer owns the round (removed
   *  here, so crashed-then-resumed rounds never leave presence-derived resume-pending sticky) and
   *  ② the group's consecutive recovery_count resets to 0 (incrementRecoveryCount's counterpart —
   *  the soft cap measures consecutive failure cycles, symmetric with the S1 soft cap; a round
   *  terminating normally ends the streak). Fail-open for both ops (missing ctx / unusual
   *  workspace → no-op). */
  #clearResolvedCrashState(): void {
    const ctx = this.#tcx;
    if (!ctx) return;
    try {
      ctx.workspace.removeCrashRecord(this.#mode(), ctx.round ?? 1);
    } catch {
      // fail-open: never blocks the normal-face exit.
    }
    try {
      this.#ledger!.resetRecoveryCount(this.#groupKey);
    } catch {
      // fail-open: never blocks the normal-face exit.
    }
  }

  /** runTask-compat result surface — { exitCode, returnBlock } read after run(). */
  get result(): TaskResult {
    return { exitCode: this.#exitCode, returnBlock: [...this.#returnBlock] };
  }

  /** stderr diagnostic ({ prefix, msg }) for the wrapper to emit before the return block lines; null for
   * silent exits (OK / agent-failed-with-handoff). */
  get diagnostic(): TaskDiagnostic | null {
    return this.#diagnostic;
  }

  #done(exitCode: number, returnBlock: string[], msg = "", prefix = "CDD_BLOCKED"): void {
    this.#exitCode = exitCode;
    this.#returnBlock = returnBlock;
    this.#diagnostic = msg ? { prefix, msg } : null;
    this.#finished = true;
  }

  /** buildContext(root, group, opts) — the engine-internal state (ctx) UNIQUE construction point
   *  (Task 6 ①: the bare function buildCtx moved into TaskLifecycle's public face — ctx assembly is owned via injection with the class construction). ctx
   *  always passes by return value, never through env: workspace / handoff / brief / ledger /
   *  constraints / findings all derive here in one pass. root is injected by the caller (TaskLifecycle.run
   *  passes `opts.root ?? getRoot()`, tests pass a real fixture root); the round anchor derives via
   *  RoundContext (the review/fix round's unique context — round anchor) and the handoff path via the
   *  Handoff typed carrier (Task 6 ②④). P4.3/P4.4: `group` is the dispatch GROUP value object
   *  (TaskGroup — the CLI `--tasks` string IS its key, no second form) — every task artifact is
   *  group-keyed (`tasks-{key}-*` with key `"1"` / `"1,2"`), per the canonical derived-grid channels. */
  static buildContext(
    root: string,
    group: TaskGroup,
    opts: Record<string, unknown> = {},
  ): TaskDispatchContext {
    const {
      mode,
      harness,
      round = 1,
      findingsPath,
    } = opts as { mode: string; harness?: string; round?: number; findingsPath?: string };
    const planWorkspace =
      (opts.planWorkspace as { plan: string; workspace: Workspace } | undefined) ??
      resolvePlanWorkspace({ planFile: opts.planFile as string | undefined, root });
    const { plan, workspace } = planWorkspace;
    const groupKey = group.key();
    // Per-phase per-round handoff path (canonical handoff-naming derivation): implement uses the
    // fixed family (no round); review/fix the round family — derived through the round's Handoff
    // carrier (Task 6 ④). Illegal mode falls back to a legacy spelling (the derivation layer only
    // knows canonical family names — an unknown family throw would pre-empt validateMode's
    // rejection path).
    let handoffFile: string;
    if (mode === "implement") {
      handoffFile = new Handoff({
        workspace,
        phase: "implement",
        type: "task",
        params: { tasks: groupKey },
      }).name;
    } else if (mode === "review" || mode === "fix") {
      handoffFile = new RoundContext({
        workspace: workspace.path,
        op: mode,
        type: "task",
        round,
        params: { tasks: groupKey },
      }).name;
    } else {
      handoffFile = `tasks-${groupKey}-${mode}-${round}.json`;
    }
    return {
      plan,
      round,
      workspace,
      handoffPath: path.join(workspace.path, handoffFile), // unconditional derivation
      briefPath: workspace.briefPath(groupKey),
      ledgerPath: workspace.progressPath,
      constraintsPath: path.join(workspace.path, "plan-constraints.md"),
      // fix: cdd fix --findings opt wins when provided; otherwise the runner-derived review-R.json
      // path for this fix round. implement/review: the open-findings path.
      findingsPath:
        mode === "fix"
          ? (findingsPath ?? prevHandoffPath(workspace, groupKey, mode, round))
          : path.join(workspace.path, `tasks-${groupKey}-open-findings.json`),
      mode,
      harness,
      fixedPoint: "",
    };
  }

  // ---- pre-flight ----

  /** Steps 1/2/2.5/4/5: registry ship gate → plan → workspace → ctx (brief self-provision, F11),
   * template existence, progressDir, review/fix fixed-point derivation. */
  protected override async resolveContext(_hookCtx: DispatchHookContext): Promise<void> {
    if (this.#finished) return;
    const mode = this.#mode();
    const { registryPath = REG_PATH, pluginRoot: pluginRootFn } = this.#opts;

    // 1. Registry ship gate + CLI preflight
    let entry: unknown;
    try {
      entry = this.#registry.checkHarness(this.#registry.load(registryPath), this.#harness, {
        dryRun: this.#dryRun,
      });
    } catch (e) {
      if (e instanceof CddBlockedError) {
        this.#done(
          e.exitCode,
          [],
          e.message,
          e.kind === "cli-missing" ? "CDD_CLI_MISSING" : "CDD_BLOCKED",
        );
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
      const planWorkspace = resolvePlanWorkspace({
        planFile: this.#opts.planFile,
        root: this.#root,
      });
      // The workspace-scoped progress ledger + the process-lifecycle registry binding derive here
      // (registration lands in THIS slug's lifecycle.json — never the repo-level single file; T6).
      this.#ledger = new ProgressLedger(planWorkspace.workspace);
      this.#runtime.initProcLifecycle({ diskPath: planWorkspace.workspace.lifecyclePath });
      // Init point (T7): always land one readProgressJSON with the `--plan` arg (absolute path) —
      // first dispatch creates progress.json via createEmptyProgress(plan) (the progress.json#plan
      // assertion's landing point). MUST NOT short-circuit on the getRound branch: implement's
      // round is always 1; folding the read into getRound params would skip the create path on the
      // first implement dispatch and progress.json would never land.
      const progressData = this.#ledger.read(planWorkspace.plan);
      const round =
        mode === "implement" ? 1 : this.#ledger.getRound(progressData, this.#groupKey, mode);
      ctx = TaskLifecycle.buildContext(this.#root, this.#group, {
        mode,
        harness: this.#harness,
        planWorkspace,
        round,
        findingsPath: this.#opts.findingsPath,
      });
      // Plan-constraints regeneration (T22, §T7.1) — implement pre-flight, dry-run exempt. Runs
      // BEFORE the F11 brief generation below (the brief does not feed extraction): a
      // source-undeclared BLOCK aborts pre-dispatch with zero workspace residue, rather than
      // leaving a partial brief artifact on disk (findings 6).
      // Every implement dispatch (each task-group start) unconditionally regenerates
      // plan-constraints.md from the plan's declared Constraints source, overwriting any existing
      // file — a mid-backfill edit to the plan's Constraints lands on disk at the next TG start
      // (no generate-once existence skip; equal plans rewrite equal bytes, the header keeps the
      // source plan hash as provenance). A plan declaring no Constraints source → BLOCK
      // (constraints source undeclared). The BLOCK is explicit — never a silent fallback to "brief
      // as sole authority" (E27: source-less fallback was the recurring root cause this gate
      // kills). dry-run keeps zero constraints side effects: no materialize, no gate (T10 dry-run
      // gate-family semantics).
      if (!this.#dryRun && mode === "implement") {
        try {
          materializePlanConstraints(planWorkspace.plan, ctx.workspace.path);
        } catch (e) {
          throw new CddExitError(
            e instanceof ConstraintsSourceUndeclared
              ? e.message
              : `${PLAN_CONSTRAINTS_MISSING_BLOCKER} (${(e as Error).message})`,
            { exitCode: 1, kind: "run-blocked" },
          );
        }
      }
      // F11: self-provision the task brief at plan finalization (--plan takes effect on
      // generation). Failure → CddExitError kind run-blocked → exit 1 — never a silent fallback to
      // an existing brief. Parent-dir bootstrap before writing (same workspace-bootstrap
      // convention as writeBaseBranch). T7: the resume-from-residue pre-flight is deleted with the
      // stash plane — resume is same-command re-dispatch from the crash-only snapshot commit (the
      // crash record + next: guidance), never a stash restore.
      try {
        ctx.workspace.ensure(); // the brief writes through the single Workspace.ensure point (T6)
        await this.#briefRenderer.render(
          planWorkspace.plan,
          this.#tasks,
          ctx.briefPath,
          this.#root,
        );
      } catch (e) {
        throw new CddExitError(`brief generation failed: ${(e as Error).message}`, {
          exitCode: 1,
          kind: "run-blocked",
        });
      }
    } catch (e) {
      // The kind discriminates (both the former RunBlocked sites and WorkspaceRoot.for's cannot-
      // derive-workspace throw CddExitError kind "run-blocked") → one recoverable-orchestration
      // exit face.
      if (e instanceof CddExitError && e.kind === "run-blocked") {
        this.#done(1, [], e.message);
        return;
      }
      // resolveDocArg's missing-path diagnostic goes through exitWithCode (throws ExitRequested) —
      // normalized to the same exit so the noExit=true in-process caller still gets
      // { exitCode: 1 } rather than an exception piercing.
      if (e instanceof ExitRequested) {
        this.#done(e.code, [], "");
        return;
      }
      throw e;
    }
    this.#tcx = ctx;
    this.#handoff = new Handoff({
      workspace: ctx.workspace,
      phase: mode,
      type: "task",
      round: mode === "implement" ? undefined : ctx.round,
      params: { tasks: this.#groupKey },
    });

    // Post-flight wiring: the inherited writeBoundary step reads the handoff path from the public
    // ctx (which runTask constructs with an empty handoffPath — the canonical path is derived here
    // by buildContext). Sync it so the changed-surface reconcile sees the real carrier (the T25 gap:
    // task-family carriers never carried the ledger-origin note because the step was reading "").
    this.ctx = { ...this.ctx, handoffPath: ctx.handoffPath };

    // 2.5 Templates existence check — BLOCKED exit 1 if missing. pluginRoot() =
    // src/render/templates.ts PKG_ROOT = <pkg>/templates (re-org Step 5 semantics converged to
    // that resource directory itself).
    try {
      const tplDir = (pluginRootFn ?? this.#templates.pluginRoot)();
      if (!existsSync(tplDir)) {
        this.#done(1, [], `templates missing: ${tplDir}`);
        return;
      }
    } catch {
      this.#done(1, [], "templates missing: cdd-engine package root not found");
      return;
    }

    // 4. ctx → the workspace-scoped progress ledger (the legacy "Set env" step died with
    // buildTaskEnv's split; the ledger is Workspace-injected — T6, no path-chopping left).
    const ledger = this.#ledger!;

    // 5. Task-review / fix fixed-point — derive from the scope ledger (T27, spec T7.6) first, the
    // legacy prior-handoff chain second. The ledger's scope_base is the TASK's true contribution
    // start (round-1 implement brief TASK_BASE seeded earliest-wins; resume-declared bases pulled
    // strictly earlier) — review/fix range against the ledger is the real deliverable range, never
    // the T26 collapse (re-dispatch TASK_BASE == dead head → legacy chain reads an empty range).
    // Ledger missing → fall back to the legacy prev.commits.base chain (normal tasks unchanged).
    if (mode === "review" || mode === "fix") {
      if (!ctx.fixedPoint) {
        const ledgerBase = ledger.taskScopeBase(this.#groupKey);
        if (ledgerBase) {
          ctx.fixedPoint = ledgerBase;
        } else {
          const prev = prevHandoffPath(ctx.workspace, this.#groupKey, mode, ctx.round ?? 1);
          if (prev) {
            const prevCommitsBase = readJsonField(prev, ["commits", "base"]);
            if (prevCommitsBase && prevCommitsBase !== "unknown") {
              ctx.fixedPoint = prevCommitsBase;
            }
          }
        }
      }
      if (this.#dryRun && !ctx.fixedPoint) ctx.fixedPoint = "HEAD~1";
    }
  }

  /** Step 6: mode validation (implement / review / fix legal trio) + required-ctx completeness. */
  protected override async validateMode(_hookCtx: DispatchHookContext): Promise<void> {
    if (this.#finished) return;
    const modeErr = validateModeMsg(this.#mode());
    if (modeErr) {
      this.#done(1, [], modeErr);
      return;
    }
    const missing = requireCtx(this.#tcx, this.#mode());
    if (missing) {
      this.#done(1, [], missing);
      return;
    }
  }

  /** Lane-declared doc-audit target (Task 3 ④): the task channel audits ITS dispatch plan — the
   * base default docContractValidate walks the plan → `**Spec:**` → Parent program → overall chain,
   * runs the necessary subset (plan 契約 + Class A) plus the overall 契約 + four tables when a
   * parent overall resolves. null when the round already terminated pre-flight (a mode/cli/entry
   * block that #done'd before the doc step wins its diagnostic — the audit never overrides a
   * terminal). */
  protected override docAuditTarget(): string | null {
    if (this.#finished) return null;
    return this.#tcx?.plan ?? null;
  }

  /** Plan-bearing declaration (P2 T4): the task lane is ALWAYS plan-bearing — the closeout
   * terminal-debt hard gate and the base-default statusValidate key off the dispatch plan. NOT
   * #finished-gated: the pre-flight-terminated case is already handled by docAuditTarget's guard
   * (the gate waives early on a finished round), while statusValidate runs AFTER the round
   * #done'd — the report describes the tree the round just landed. */
  protected override dispatchPlanPath(): string | null {
    return this.#tcx?.plan ?? null;
  }

  /** BLOCK face override (Task 3 ④): the task channel's non-throwing #done terminal — exit 1 +
   * the CDD_BLOCKED diagnostic; no carrier is written (the doc-invalid round stays
   * re-dispatchable the moment the docs are repaired — matching the pre-T3 face exactly). */
  protected override docContractBlocked(guidance: string): void {
    this.#done(
      1,
      [],
      `doc contract validation failed — fix the docs below, then re-dispatch --tasks ${this.#groupKey}:\n${guidance}`,
    );
  }

  // ---- dispatch ----

  /** Steps 7/8/8.5: prompt render → agent CLI spawn (or dry-run simulation) → the timeout path
   * (partial handoff + canonical counters). */
  protected override async dispatch(_hookCtx: DispatchHookContext): Promise<void> {
    if (this.#finished) return;
    const mode = this.#mode();
    const dryRun = this.#dryRun;
    const ctx = this.#tcx!;

    // 7. Render prompt
    let prompt: string;
    try {
      prompt = this.#templates.renderModePrompt(mode, buildPromptParams(ctx, this.#group));
    } catch (e) {
      this.#done(1, [], `template render failed: ${(e as Error).message}`);
      return;
    }

    // 7.5 Stale-carrier rotation (T7 crash-resume hygiene, repeat-abort): the current round's
    // handoff path may already hold a terminal carrier from a PRIOR crashed dispatch of this same
    // round — implement's handoff name is round-stable (round always 1), so a first crash leaves a
    // BLOCKED HARNESS_ABORT carrier at the path the resume re-dispatches. Rotate it away before the
    // child runs: a second consecutive abort must re-fire the crash teardown (fresh crash record +
    // crash-only snapshot of the RESUME session's WIP) instead of being suppressed by the stale
    // carrier (teardown guard `!existsSync(handoffPath)` would read true). Only an engine-terminal
    // carrier is rotated — writeBlockedCarrier always writes failure_category, the discriminator
    // vs an agent-written handoff; the carrier is untracked (.kairos is gitignored), so the
    // rotation is a pure on-disk hygiene op with zero git-tree impact. dry-run keeps zero side
    // effects (no rotation).
    if (!dryRun) {
      const stale = readJson(ctx.handoffPath) as { failure_category?: unknown } | null;
      if (stale && typeof stale.failure_category === "string") {
        rmSync(ctx.handoffPath);
      }
    }

    // 8. Invoke CLI (or dry-run simulation)
    let agentOut = "";
    let agentRc = 0;
    let resStderr = ""; // the child's raw stderr (T7 — preserved for the crash teardown's tail)
    let resStdout = ""; // the child's raw stdout (T7 — preserved for the crash teardown's tail)
    let timedOut = false;
    let unkillable = false;
    let cause: TerminationCause | undefined; // unified termination cause (stalled/over-budget/signal; T26)
    let idleWindowMs: number | undefined; // stall blocker detail (monitor idle window)
    if (dryRun) {
      // Dry-run simulation block (return-block.ts single point): the 3-line APPROVED dry-run
      // payload (status/commits/artifacts — the agent output contract, no blocker column); the
      // post-flight parse re-appends the counters line (returnFourLines).
      agentOut = this.#returnBlockParser.dryRunBlock({
        commits: "base=dry-run",
        artifacts: `brief=${ctx.briefPath} report=${ctx.workspace.path}/tasks-${this.#groupKey}-report.md test_evidence=${ctx.workspace.path}/tasks-${this.#groupKey}-test-evidence.json`,
      });
    } else {
      // Unified termination config (T26): single resolver (resolveTerminationConfig) replaces the
      // (resolveTimeoutMs + resolveLivenessConfig) pair — budget from canonical op defaults with
      // the opts.termination seam on top, stall cadence from canonical timeouts.liveness. T9: the
      // budget is keyed by the DISPATCHED OP (`mode` — the validated implement|review|fix trio) —
      // the legacy hardcoded "task" key made `cdd review --type task` read the implement budget
      // (the T7 review-not-capped accident this wiring pins). The progress path is ALWAYS the
      // dispatch workspace (engine artifacts live there); a missing one reads 'unknown' forever —
      // fail loud so a broken workspace can never quietly neuter the tree signal.
      const terminationCfg = this.#invoker.resolveTerminationConfig(
        mode as DispatchOp,
        this.#opts.termination,
        ctx.workspace.path,
      );
      // #timeoutMs = the EFFECTIVE budget — the blockers/diagnostics report the budget the monitor
      // actually enforced, not the canonical default.
      this.#timeoutMs = terminationCfg.budgetMs;
      if (!existsSync(ctx.workspace.path)) {
        process.stderr.write(
          `CDD_WARN: termination progress path missing (${ctx.workspace.path}) — tree signal unavailable, stall detection relies on CPU alone\n`,
        );
      }
      // Subprocess cwd = the injected root (the single root authority; this function never reads
      // the startup cwd and has no second injection seam). Subprocess env = the host env (zero
      // CDD_* injection — engine-internal state passes via ctx, never across the env boundary).
      const res = (await this.#invoker.invokeCliWithRetry(
        this.#entry as {
          cli: string;
          invoke: string;
          output?: string;
          prefix?: unknown;
          suffix?: unknown;
        },
        prompt,
        INVOKE_PARAMS[mode] ?? { op: mode },
        this.#hostEnv(),
        this.#root,
        terminationCfg,
      )) as TaskSpawnResult;
      agentOut = res.ok ? res.stdout : "";
      resStderr = res.stderr;
      resStdout = res.stdout; // raw, unconditional — the crash teardown's stdout tail (never the empty-on-failure gate)
      timedOut = res.timedOut === true;
      unkillable = res.unkillable === true;
      cause = res.cause;
      idleWindowMs = terminationCfg.idleWindowMs;
      if (!res.ok && !timedOut) agentRc = res.code;
    }
    this.#agentOut = agentOut;
    // Preserve the child's raw streams (the failed dispatch's trace — the harness-abort teardown
    // captures BOTH tails; never discard them on the failure path).
    this.#agentStdout = resStdout;
    this.#agentErr = resStderr;
    this.#agentRc = agentRc;

    // 8.5 Timeout path — write the partial handoff before commit-contract validation.
    //   timedOut && !unkillable → TIMEOUT partial handoff (status=TIMEOUT + blocker + existing findings);
    //   timedOut && unkillable  → BLOCKED handoff (process unkillable).
    //   Progress: increment the canonical timeout/engineSelfWritten counter.
    if (timedOut) {
      if (unkillable) {
        writeBlockedCarrier(ctx.handoffPath, {
          tasks: this.#tasks,
          phase: mode,
          failure_category: FAILURE_CATEGORIES.ENGINE_SELF_WRITTEN.id,
          blocker: `cli process unkillable after timeout → manually kill the process (check ps), then re-dispatch --tasks ${this.#groupKey}`,
        });
        if (!dryRun) {
          this.#ledger!.incrementRound(this.#groupKey, mode);
          this.#failure.maybeExhaust(
            ctx.workspace,
            FAILURE_CATEGORIES.ENGINE_SELF_WRITTEN.id,
            ctx.handoffPath,
          ); // engine-self-written → engineSelfWrittenCount (not recovery quota)
        }
        this.#done(1, this.#face("BLOCKED"), "process unkillable");
        return;
      }
      // Normal timeout (budget exceeded OR liveness stall OR external SIGTERM): TIMEOUT partial
      // handoff. T7 crash recovery: the round's WIP is normalized into the commit ledger via the
      // crash teardown (crash-only snapshot + crash record — the crashed dispatch's trailing output
      // and its tree survive as a recovery record; the snapshot also clears the tree so the
      // re-dispatch's entry gate passes) BEFORE the carrier writes. The blocker's stalled/signal
      // resume sentence points at the crash record; the termination sub-cause rides `notes` so a
      // dead round stays replayable by cause.
      const timeoutMs = this.#timeoutMs;
      const crashNext = resumeCommandFor({
        op: mode,
        type: "task",
        group: this.#groupKey,
        plan: ctx.plan,
        ...(mode === "fix" ? { findingsPath: ctx.findingsPath ?? undefined } : {}),
      });
      // The unified teardown (T8) — the same mechanism as the child-exit lane: tail capture → crash-only
      // snapshot → crash record, classified by the unified cause (engine-over-budget / engine-timeout
      // / child-signal — the monitor's verdict, zero second teardown implementation). The cause lands
      // in the record + the carrier notes; resume never forks on it (postmortem only).
      const crashCause = crashCauseFor({
        timedOut: true,
        monitorCause: cause,
        exitCode: cause === "signal" ? 143 : 1,
      });
      const crashRecord = await this.#crash.run({
        lane: mode,
        round: ctx.round ?? 1,
        exitCode: cause === "signal" ? 143 : 1,
        cause: crashCause,
        stdout: this.#agentStdout,
        stderr: this.#agentErr,
        attemptedHandoff: ctx.handoffPath,
        next: crashNext,
        workspace: ctx.workspace,
        repoRoot: this.#root,
      });
      // The crash-recovery soft cap (T8 fold D) — this teardown bumps the group's recovery count; at
      // the cap the capsule's resume advice defers to user adjudication (crash-recovery-cap).
      const crashCap = this.#bumpRecovery();
      writeBlockedCarrier(ctx.handoffPath, {
        tasks: this.#tasks,
        phase: mode,
        status: "TIMEOUT",
        failure_category: FAILURE_CATEGORIES.TIMEOUT.id,
        notes: `termination cause: ${crashCause}${crashRecord.snapshotSha ? `; crash snapshot ${crashRecord.snapshotSha.slice(0, 7)}` : ""}`,
        blocker: this.#failure.timeoutBlocker({
          cause,
          tasks: this.#groupKey,
          timeoutMs,
          idleWindowMs,
          op: mode,
        }),
      });
      if (!dryRun) this.#ledger!.incrementRound(this.#groupKey, mode);
      // TIMEOUT counter increment: field via canonical counterFor, category identity via
      // FAILURE_CATEGORIES (replaces the legacy timeoutCount++ three-liner, T6 zero hand-written
      // counter literals).
      this.#failure.maybeExhaust(ctx.workspace, FAILURE_CATEGORIES.TIMEOUT.id, ctx.handoffPath);
      // The TIMEOUT failure capsule carries the same-command resume `next:` (T8 — the crash-recovery
      // row now covers BLOCKED/TIMEOUT — the teardown matrix: same path, same record, same resume).
      this.#done(
        1,
        this.#face("TIMEOUT", undefined, {
          op: this.#op(),
          type: "task",
          group: this.#groupKey,
          plan: ctx.plan,
          ...(mode === "fix" ? { findingsPath: ctx.findingsPath ?? undefined } : {}),
          status: "TIMEOUT",
          recovery: { snapshotSha: crashRecord.snapshotSha, resumeCommand: crashNext },
          ...(crashCap ? { crashSoftCap: true } : {}),
        }),
        `cli terminated (cause: ${crashCause})`,
      );
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
    const dryRun = this.#dryRun;
    const ctx = this.#tcx!;

    // 8.8 Handoff JSON Schema validation — reject malformed handoffs before downstream processing.
    // T7: implement-gated (mode !== "implement") — the HANDOFF path is not an implement input
    // channel (the engine is the implement carrier's sole author; the implement agent writes no
    // handoff; step 13 materializes it from return block + TASK_BASE + HEAD). review/fix keep the read +
    // validation (the agent is the content author; findings content contract).
    if (mode !== "implement") {
      const existingHandoff = readJson(ctx.handoffPath);
      if (existingHandoff) {
        const sv = this.#schema.validateHandoffSchema(existingHandoff);
        if (!sv.valid) {
          // CONTRACT_VIOLATION recovery (T5, spec §2.5.2, AC7 category-level): normalize → re-validate
          // (at most one round) — the recovery single point is finalize.ts#recoverHandoff (T24 B:
          // the recovery unit moved from rules/schema.ts with its applyDerivedStatus caller),
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
            writeBlockedCarrier(ctx.handoffPath, {
              tasks: this.#tasks,
              phase: mode,
              failure_category: FAILURE_CATEGORIES.CONTRACT_VIOLATION.id,
              findings: rec.preservedFindings,
              blocker: `handoff schema invalid${rec.reason} → fix the handoff JSON at ${ctx.handoffPath} and re-dispatch --tasks ${this.#groupKey}`,
              fullReplace: true,
            });
            if (!dryRun) {
              this.#ledger!.incrementRound(this.#groupKey, mode);
              this.#failure.maybeExhaust(
                ctx.workspace,
                FAILURE_CATEGORIES.CONTRACT_VIOLATION.id,
                ctx.handoffPath,
              ); // format error on the producing side
            }
            this.#done(1, this.#face("BLOCKED"), `schema validation failed${rec.reason}`);
            return;
          }
        }
      }
    }

    // 10. Nested CLI failed with no handoff → the T7 HARNESS_ABORT teardown + write BLOCKED handoff
    //     (stderr into blocker) + return block + the CDD_BLOCKED diagnostic + exit 1. The legacy
    //     EXECUTION_FAILURE child-failure lane is RECLASSIFIED: an external retreat (harness/model
    //     403 — the failed child leaves no handoff) is a different mechanism — deterministically
    //     recoverable via the crash-only snapshot + crash record — and the BLOCKED capsule carries
    //     the same-command resume `next:` (the NextStepRouter recovery row; crash record = the
    //     decision source, never a handoff recovery field). The legacy `cli exited N without writing
    //     handoff` prefix the black-box suite matches stays; the resume-or-discard / stash-workflow
    //     wording is gone with the stash plane.
    if (this.#agentRc !== 0 && !existsSync(ctx.handoffPath)) {
      const crashNext = resumeCommandFor({
        op: mode,
        type: "task",
        group: this.#groupKey,
        plan: ctx.plan,
        ...(mode === "fix" ? { findingsPath: ctx.findingsPath ?? undefined } : {}),
      });
      // The unified teardown (T8) — the same mechanism as the engine-terminated lane: the child's exit
      // shape classifies the death (child-exit / child-signal for the 128+signo shell convention);
      // the HARNESS_ABORT category identity stays, the mechanism is single-path.
      const crashRecord = await this.#crash.run({
        lane: mode,
        round: ctx.round ?? 1,
        exitCode: this.#agentRc,
        cause: crashCauseFor({ exitCode: this.#agentRc }),
        stdout: this.#agentStdout,
        stderr: this.#agentErr,
        attemptedHandoff: ctx.handoffPath,
        next: crashNext,
        workspace: ctx.workspace,
        repoRoot: this.#root,
      });
      // The crash-recovery soft cap (T8 fold D) — shared with the engine-terminated lane.
      const crashCap = this.#bumpRecovery();
      writeBlockedCarrier(ctx.handoffPath, {
        tasks: this.#tasks,
        phase: mode,
        failure_category: FAILURE_CATEGORIES.HARNESS_ABORT.id,
        commits: { base: "unknown" }, // no real head at failure time — the "unknown" sentinel is the dead-round ground (T23)
        notes: crashRecord.snapshotSha
          ? `crash snapshot ${crashRecord.snapshotSha.slice(0, 7)}`
          : undefined,
        blocker: `cli exited ${this.#agentRc}${this.#agentRc === 143 ? " (SIGTERM — externally killed)" : ""} without writing handoff → the harness aborted before the handoff; the dispatch's output tail + crash-only snapshot are recorded — resume by re-running the same command (\`${crashNext}\`), no redo, no residue loss`,
      });
      if (!dryRun) {
        this.#ledger!.incrementRound(this.#groupKey, mode);
        this.#failure.maybeExhaust(
          ctx.workspace,
          FAILURE_CATEGORIES.HARNESS_ABORT.id,
          ctx.handoffPath,
        ); // harness abort → harnessAbortCount (per-category independent quota)
      }
      this.#done(
        1,
        this.#face("BLOCKED", undefined, {
          op: this.#op(),
          type: "task",
          group: this.#groupKey,
          plan: ctx.plan,
          ...(mode === "fix" ? { findingsPath: ctx.findingsPath ?? undefined } : {}),
          status: "BLOCKED",
          recovery: { snapshotSha: crashRecord.snapshotSha, resumeCommand: crashNext },
          ...(crashCap ? { crashSoftCap: true } : {}),
        }),
        `cli exited ${this.#agentRc} and handoff missing`,
      );
      return;
    }

    // 10.5. CLI succeeded but no handoff → BLOCKED (file-existence check, not phase-mismatch
    // fallback). Agent exits 0 without writing a handoff = error. dry-run excluded (no handoff
    // invariant — bash dry-run writes none, neither does Node). implement excluded (T6): the
    // runner materializes in step 13's OK path — implement agents write no handoff and this check
    // would falsely BLOCK every successful implement.
    if (this.#agentRc === 0 && !dryRun && mode !== "implement" && !existsSync(ctx.handoffPath)) {
      writeBlockedCarrier(ctx.handoffPath, {
        tasks: this.#tasks,
        phase: mode,
        failure_category: FAILURE_CATEGORIES.ENGINE_SELF_WRITTEN.id,
        blocker: `${path.basename(ctx.handoffPath)} not written after exit 0 → re-run ${mode} and ensure handoff is written to ${ctx.handoffPath} before exit`,
      });
      this.#ledger!.incrementRound(this.#groupKey, mode);
      this.#failure.maybeExhaust(
        ctx.workspace,
        FAILURE_CATEGORIES.ENGINE_SELF_WRITTEN.id,
        ctx.handoffPath,
      ); // engine-written BLOCKED (exit 0 without handoff)
      this.#done(1, this.#face("BLOCKED"), `${mode} agent did not write handoff`);
      return;
    }
  }

  /** Steps 11/12/13: return block three-line parse → agent-failure exit → implement materialization
   * (dry-run writes no handoff — aligned with bash). */
  protected override async normalizeResult(_hookCtx: DispatchHookContext): Promise<void> {
    if (this.#finished) return;
    const mode = this.#mode();
    const dryRun = this.#dryRun;
    const ctx = this.#tcx!;

    // 11. return-block parse (the internal carrier feeding implement materialization — the agent's
    //     3-line output contract is unchanged; the parse atoms stay in return-block.ts). C5 (T3):
    //     the ENGINE stdout becomes the single status capsule (ResultFace) — dry-run rounds carry
    //     the capsule + the derived `next:` line; real rounds re-emit the capsule after finalization
    //     (step 13 implement / commitPostCheck review+fix); the failure lanes emit the capsule with
    //     no `next:` (BLOCKED face, no `next:` line).
    const parsedReturnBlock = this.#returnBlockParser.returnFourLines(
      this.#agentOut,
      ctx.workspace.path,
    );

    // 12. Agent failed but handoff exists → exit agent_rc (the capsule shows the round's BLOCKED
    //     conclusion; the agent's return text stays in its stdout history).
    if (this.#agentRc !== 0) {
      this.#done(this.#agentRc, this.#face("BLOCKED"), "");
      return;
    }

    // 13. OK — implement materialization (dry-run does not write a handoff — aligned with bash).
    //     T5: status single authority — the review-type handoff is derived/overwritten by the
    //     engine at finalization (SP-4 exempts failure rounds). T6: implement materializes — the
    //     agent writes no handoff (implement.md dropped the Handoff Output section), the runner
    //     builds tasks-{key}-implement.json from the return block three lines + brief TASK_BASE + git HEAD;
    //     evidence-gate read-back (behavior_change:true → hard; else soft WARN). T7: the carrier
    //     comes home to the engine — implement/review finalize through finalizeHandoff,
    //     writeOwnHandoff full-replace, and the stdout capsule always re-emits from the finalized carrier.
    if (dryRun) {
      // The dry-run capsule: the simulator's APPROVED conclusion on the round's axis (review → the
      // judgment APPROVED; implement/fix → the work COMPLETED) + the fix decision-source blocker +
      // the derived `next:` line (C5-1 — the fix judges on the `--findings` INPUT content).
      const dryRunFindings = mode === "fix" ? this.#inputFindings(ctx.findingsPath) : [];
      this.#returnBlock = this.#face(
        "APPROVED",
        dryRunFindings,
        this.#nextArgs({
          mode,
          status: "APPROVED",
          findings: dryRunFindings,
          findingsPath: ctx.findingsPath,
        }),
      );
    } else if (mode === "implement") {
      const finalized = await this.#handoff!.finalize({
        mode,
        returnBlock: parsedReturnBlock,
        brief: ctx.briefPath,
        repoRoot: this.#root,
        tasks: this.#tasks,
      });
      if (finalized.handoff) {
        this.#handoff!.persist(finalized.handoff);
        // C5 (T8/T3): the materialized implement capsule carries the `next:` line (→ the group's
        // review); a BLOCKED materialization (finalized.exitCode ≠ 0) stays next-less — the
        // failure-mode stderr face owns it.
        const nextArgs =
          finalized.exitCode === 0
            ? this.#nextArgs({
                mode,
                status: finalized.handoff.status as string | undefined,
                findings: finalized.handoff.findings as Array<{ severity?: string }> | undefined,
                findingsPath: ctx.handoffPath,
              })
            : undefined;
        this.#returnBlock = this.#face(
          finalized.handoff.status as string | undefined,
          undefined,
          nextArgs,
        );
        // The dual-artifact invariant on the normal face (T8): a materialized implement round no
        // longer owns its abnormal-face crash record (a prior crashed attempt of this same round was
        // resolved — presence-derived resume-pending must not stay sticky).
        if (finalized.exitCode === 0) this.#clearResolvedCrashState();
        // Materialized capsule and handoff/exit align: hard gate or an agent-declared BLOCKED → exit 1.
        if (finalized.exitCode !== 0) {
          this.#failure.maybeExhaust(
            ctx.workspace,
            FAILURE_CATEGORIES.ENGINE_SELF_WRITTEN.id,
            ctx.handoffPath,
          );
          this.#done(finalized.exitCode, this.#returnBlock, "");
          return;
        }
      }
      // Degradation exception (T6 nit2, documented): missing brief / no TASK_BASE line →
      // finalizeHandoff materializes nothing (handoff:null + stderr CDD_WARN; the agent's capsule
      // stays at the parse interim — the dry-run and smoke chains both land here, an ENOENT must
      // never crash the runner). The provisional capsule derives from the agent-written handoff.
      if (!this.#returnBlock.length) {
        const existing = readJson(ctx.handoffPath) as {
          status?: string;
          findings?: Array<{ severity?: string }>;
        } | null;
        this.#returnBlock = this.#face(
          existing?.status,
          undefined,
          this.#nextArgs({
            mode,
            status: existing?.status,
            findings: [],
            findingsPath: ctx.handoffPath,
          }),
        );
      }
    } else {
      // review/fix: the provisional capsule from the agent-written handoff (the finalized capsule
      // lands in commitPostCheck — step 13.5's finalize; this assignment covers the unreadable-
      // finalize degradation).
      const existing = readJson(ctx.handoffPath) as {
        status?: string;
        findings?: Array<{ severity?: string }>;
      } | null;
      const existingFindings =
        mode === "fix" ? this.#inputFindings(ctx.findingsPath) : existing?.findings;
      this.#returnBlock = this.#face(
        existing?.status,
        existingFindings,
        this.#nextArgs({
          mode,
          status: existing?.status,
          findings: existingFindings ?? [],
          findingsPath: mode === "review" ? ctx.handoffPath : ctx.findingsPath,
        }),
      );
    }
  }

  /** Step 13.5 + post-gate writeback: the exit gate (validateCommitContract) runs for every
   * non-finished non-dry-run round; after it passes, the APPROVED-review ensure-row writeback +
   * non-implement round increment land (a dirty failure round never touches the row; the complete
   * verdict is deriveTaskState's — the row keeps only facts). */
  protected override async commitPostCheck(_hookCtx: DispatchHookContext): Promise<void> {
    if (this.#finished) return;
    const mode = this.#mode();
    const dryRun = this.#dryRun;
    const ctx = this.#tcx!;

    // 13.5 T8: post-run commit-contract — all task modes (implement/fix/review).
    //   implement/fix: dirty + head validation (validateCommitContract embeds rewriteHandoffBlocked);
    //   review: dirty-only (a review handoff's commits describe the reviewed commit, head skipped).
    //   !dryRun guard: dry-run writes no handoff invariant — a dirty smoke tree must not trigger a
    //   real BLOCKED rewrite and pollute dry-run semantics.
    if (!dryRun) {
      const cv = await this.#commit.validateCommitContract(mode, this.#root, {
        handoffPath: ctx.handoffPath,
      });
      if (!cv.ok) {
        this.#failure.maybeExhaust(
          ctx.workspace,
          FAILURE_CATEGORIES.ENGINE_SELF_WRITTEN.id,
          ctx.handoffPath,
        ); // commit-contract rewrite → engineSelfWrittenCount
        this.#done(1, this.#face("BLOCKED"), cv.blocker);
        return;
      }
    }

    // Status single authority (T5/T7): the review-type handoff is finalized by the engine
    // (finalizeHandoff rollup overwrites the agent-declared status, SP-4 exempts failure rounds);
    // the success path reads the finalized handoff and persists it (writeOwnHandoff full-replace),
    // and re-emits the stdout capsule from finalizeHandoff.
    // Review + fix both finalize here and take the round conclusion → exit (Task 23 ③):
    // (BLOCKED → 1 on any channel, APPROVED/CHANGES_REQUESTED → 0). finalizeHandoff review derives
    // status + the BLOCKED carrier; fix passes the work-type's declared status through. The
    // implement mode normalized its own exit in normalizeResult (materialization).
    let finalized: { handoff: Record<string, unknown> | null; exitCode: number } | null = null;
    if (!dryRun && (mode === "review" || mode === "fix")) {
      const handoff = readJson(ctx.handoffPath);
      if (handoff) {
        finalized = await this.#handoff!.finalize({ mode, agentHandoff: handoff });
        // persistFinalized: derivation unchanged (same reference) → skip the write (no no-op
        // overwrite); changed → full-replace + sync.
        persistFinalized(ctx.handoffPath, handoff, finalized);
        // C5 (T8/T3): the capsule's `next:` derivation args ride the same single face. review — the
        // finalized handoff's own findings (one-way → fix) + own blocker; fix — the `--findings`
        // INPUT findings (C5-1 single decision point + the decision-source blocker: blockers →
        // re-review, warn/nit-only → closure).
        const finalizedH = finalized.handoff as {
          status?: string;
          findings?: Array<{ severity?: string }>;
        } | null;
        const capsuleFindings =
          mode === "fix" ? this.#inputFindings(ctx.findingsPath) : (finalizedH?.findings ?? []);
        this.#returnBlock = this.#face(
          finalizedH?.status,
          capsuleFindings,
          this.#nextArgs({
            mode,
            status: finalizedH?.status,
            findings: capsuleFindings,
            findingsPath: mode === "review" ? ctx.handoffPath : null,
          }),
        );
        if (mode === "review" && normalizeHandoffStatus(handoff.status as string) === "APPROVED") {
          // This read stays single-arg (T7): at review-success execution progress.json already
          // exists (plan recorded at the init point); plan no longer participates in
          // createEmptyProgress derivation.
          // The APPROVED-review writeback is downgraded to ensure-the-row-exists (Task 30 ②) —
          // the complete verdict is deriveTaskState's sole authority (rules/status.ts), never a
          // stored field. The row creation still matters: incrementRound below finds it.
          const progressData2 = this.#ledger!.read();
          // Group-key row lookup (P4.3): single-group keys resolve the per-task row (backward
          // compatible), multi-task groups the `{ group }` row — the group is the dispatch unit.
          // Shared with progress.ts rowFor/entryFor — the single/group row dichotomy is single-source.
          let taskEntry = this.#ledger!.rowFor(progressData2, this.#groupKey);
          if (!taskEntry) {
            taskEntry = this.#ledger!.entryFor(this.#groupKey);
            progressData2.tasks.push(taskEntry);
          }
          this.#ledger!.write(progressData2);
        }
        // The dual-artifact invariant on the normal face (T8): a concluded review/fix round no
        // longer owns its abnormal-face crash record (a resumed round terminating normally is
        // resolved — presence-derived resume-pending must not stay sticky).
        if (finalized.exitCode === 0) this.#clearResolvedCrashState();
      }
    }
    if (!dryRun && mode !== "implement") this.#ledger!.incrementRound(this.#groupKey, mode);
    // exit mastered by finalizeHandoff's round conclusion — the T14「exit 0 + status BLOCKED」
    // inversion dies here (a BLOCKED-derived review or a fix declaring BLOCKED → 1).
    this.#done(finalized?.exitCode ?? 0, this.#returnBlock, "");
  }

  /** runTask — legacy surface kept ({ exitCode, returnBlock }; noExit=true suppresses the stdout/stderr +
   * exit-throw: the unit-test seam) as the class's STATIC entry (Task 6/7 export-surface reshuffle:
   * `runTask` → `TaskLifecycle.run` — the class public face, no bare forwarding shell). Builds the
   * injected ctx via buildContext, runs the lifecycle, converts an entry-gate DispatchBlocked into a
   * CDD_BLOCKED stderr + exit 1 (or a { exitCode: 1, returnBlock: [] } in noExit mode); on the normal
   * path writes the diagnostic + return block lines + exits via exitWithCode when noExit=false.
   * P4.3/P4.4: `tasks` is the dispatch GROUP (scalar task number / list normalized to a TaskGroup
   * at this boundary) — the group is the dispatch unit, never a per-task iteration. */
  static async run(
    harness: string,
    tasks: number | readonly number[] | TaskGroup,
    opts: TaskRunOptions = {},
  ): Promise<TaskResult> {
    // The injected runtime stand-in (P4.4 Task 4 ②) governs the proc lifecycle + the dry-run/root
    // reads — the singleton by default; the constructor-injection seam is what engine tests probe.
    const rt = opts.runtime ?? runtime;
    return rt.withLifecycle(async () => {
      // root is injected (default getRoot() via the runtime); in-process tests without an injection
      // throw — the correct failure face, never a graceful fallback.
      const root = opts.root ?? rt.getRoot();
      const group = toTaskGroup(tasks);
      const lc = new TaskLifecycle({
        harness,
        group,
        opts,
        ctx: {
          mode: opts.mode ?? "",
          repoRoot: root,
          handoffPath: "",
          dryRun: opts.dryRun === true || rt.isDryRun(),
        },
      });
      try {
        await lc.run();
      } catch (e) {
        // Entry gate (pre-flight): no handoff exists yet — the CLI face maps it to exit 1 (base.ts
        // contract); noExit=... preserves the in-process seam.
        if (e instanceof DispatchBlocked && e.gate === "entry") {
          if (opts.noExit) return { exitCode: 1, returnBlock: [] };
          process.stderr.write(`CDD_BLOCKED: ${e.message}\n`);
          exitWithCode(1);
        }
        throw e;
      }
      const { exitCode, returnBlock } = lc.result;
      const diag = lc.diagnostic;
      if (!opts.noExit) {
        if (diag) process.stderr.write(`${diag.prefix}: ${diag.msg}\n`);
        for (const line of returnBlock) process.stdout.write(`${line}\n`);
        exitWithCode(exitCode);
      }
      return { exitCode, returnBlock };
    });
  }
}

// ---- plan building blocks (pure functions, unit-test seam) ----

/** Read the status of the latest review handoff (progressData.rounds["review"] round).
 * reviewRound=0 → no review completion record → "MISSING"; corrupt → "UNKNOWN". Per-task helper:
 * the group-handoff naming only requires the canonical `tasks-{tasks}-*` shape for the group of
 * one. */
export function handoffStatus(
  taskNum: number,
  workspace: string,
  progressData: { tasks?: Array<{ task: number; rounds?: Record<string, number> }> } | undefined,
): string {
  const reviewRound = progressData?.tasks?.find((t) => t.task === taskNum)?.rounds?.review ?? 0;
  if (reviewRound === 0) return "MISSING";
  const handoffPath = path.join(
    workspace,
    Handoff.handoffName("review", "task", { tasks: String(taskNum), round: reviewRound }),
  );
  if (!existsSync(handoffPath)) return "MISSING";
  try {
    return (
      normalizeHandoffStatus(
        (JSON.parse(readFileSync(handoffPath, "utf8")).status ?? "UNKNOWN") as string,
      ) ?? "UNKNOWN"
    );
  } catch {
    return "UNKNOWN";
  }
}

/** review round=0 → review never completed → pending; otherwise read the latest review handoff
 * status. */
export function isTaskPending(
  taskNum: number,
  workspace: string,
  progressData: { tasks?: Array<{ task: number; rounds?: Record<string, number> }> } | undefined,
): boolean {
  const reviewRound = progressData?.tasks?.find((t) => t.task === taskNum)?.rounds?.review ?? 0;
  if (reviewRound === 0) return true; // no review ever completed
  return handoffStatus(taskNum, workspace, progressData) !== "APPROVED";
}

// ---- plan-constraints materialization (T22/§T7.1; pure functions, unit-test seam) ----

// The workspace-derived constraints artifact name (derive-only until T22 — the recurring
// "plan-constraints.md missing → brief is the sole authority" note root cause: derived but never
// generated; regenerated unconditionally at every implement dispatch, see the resolveContext
// pre-flight).
const PLAN_CONSTRAINTS_FILE = "plan-constraints.md";
// The actionable BLOCK face for an un-materializable constraints file — single module const for
// the materializer catch fallback (materializePlanConstraints either writes the file or throws,
// never returns with it absent).
const PLAN_CONSTRAINTS_MISSING_BLOCKER =
  "plan-constraints.md missing — run materializer or declare a plan Constraints source";
// Legacy prose-pointer anchors, canonical order — extraction order is this constant, never plan
// line order (byte-determinism). The bare names derive from the canonical plan schema's Form-B
// anchor tokens (tokens.ts; `**口径**：` → `口径`); the canonical form (literal `## Constraints`)
// wins over this.
const PROSE_ANCHORS = DOC_TOKENS.proseAnchors as readonly string[];

/** Plan declares no Constraints source (neither a literal `## Constraints` section nor any
 * prose-pointer anchor) — the materializer must BLOCK, never fall back silently. P6 T24 E: the
 * recoverable run failure rides the CddExitError family (exitCode 1 + kind "run-blocked") — the
 * resolveContext kind-catch recovers it, with the class identity kept so its special-cased
 * message extraction survives. */
export class ConstraintsSourceUndeclared extends CddExitError {
  constructor(message: string) {
    super(message, { exitCode: 1, kind: "run-blocked" });
  }
}

// Byte-deterministic artifact header: provenance + the plan-hash anchor (never the absolute path).
// The anchor is provenance only — regeneration is unconditional, no stale detection. It is the
// ONLY path token in the file — the header embeds the plan basename + content hash, never the
// absolute root — so equal plans produce equal artifact bytes on any machine (recomputable test
// baseline).
function constraintsHeader(planPath: string, hash: string): string {
  return [
    `<!-- ${PLAN_CONSTRAINTS_FILE} — CDD workspace artifact derived from the plan's declared Constraints source. Do not edit. -->`,
    `<!-- source plan: ${path.basename(planPath)} · plan hash: ${hash} -->`,
    "",
  ].join("\n");
}

/** Regenerate plan-constraints.md in the workspace from the plan's declared Constraints source
 * (T22/§T7.1). Unconditional: every call overwrites the file with the fresh extraction — equal
 * plans rewrite equal bytes (the deterministic header keeps the source-plan hash as provenance),
 * so the implement pre-flight can call this at every task-group start to land mid-backfill edits
 * to the plan's Constraints on disk; no generate-once existence skip. A plan declaring no
 * Constraints source throws ConstraintsSourceUndeclared — never a silent fallback (the derived
 * artifact is the implement pre-flight's non-negotiable input). Returns the artifact path. */
export function materializePlanConstraints(plan: string, workspace: string): string {
  const outPath = path.join(workspace, PLAN_CONSTRAINTS_FILE);
  const content = new DocumentsValidator().extractPlanConstraints(readFileSync(plan, "utf8"));
  if (content === null) {
    throw new ConstraintsSourceUndeclared(
      `plan Constraints source undeclared — declare a literal “${DOC_TOKENS.constraintsHeading}” section (canonical) or the prose pointer headings (${PROSE_ANCHORS.join(" / ")}) so cdd implement can materialize ${PLAN_CONSTRAINTS_FILE}`,
    );
  }
  writeFileSync(outPath, constraintsHeader(plan, hashFile(plan)) + content, "utf8");
  return outPath;
}
