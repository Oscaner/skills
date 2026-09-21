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
//               11/12/13: return block four-line parse, agent-failure exit, implement materialization.
//               commitPostCheck — step 13.5 + review writeback: the exit gate (skipped on
//               finished rounds / dry-run; failed gate → maybeExhaust + BLOCKED return block), then the
//               APPROVED-review ensure-row writeback + round increment (post-gate only —
//               a dirty failure round never marks complete; the complete verdict is derived by
//               deriveTaskState, never stored — Task 30 ②).
//
// P6 T24: the return-block text plane (returnFourLines / returnFromHandoff / dry-run block) is
// owned by src/artifacts/return-block.ts (its single point) — this file imports + re-exports the
// task-facing read-back atoms; the failure-carrier writes route through the writeBlockedCarrier
// single terminal in finalize.ts; materializeWorkspace lives in naming.ts (workspace derivation
// single point alongside resolveWorkspace). runTask keeps the legacy { exitCode, returnBlock }
// surface ({ noExit } seam) and delegates to the lifecycle.
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
import { writeOwnHandoff, readJson } from "../artifacts/handoff/write.ts";
import { validateCommitContract } from "../rules/commit.ts";
import { generateBrief } from "../render/brief.ts";
import { handoffName, prevHandoffPath as hnPreHandoffPath, materializeWorkspace, workspaceSlug } from "../artifacts/handoff/naming.ts";
import { finalizeHandoff, persistFinalized, normalizeHandoffStatus, recoverHandoff, writeBlockedCarrier, taskBaseFromBrief } from "../artifacts/handoff/finalize.ts";
import { hashFile } from "../artifacts/hash.ts";
import { CddExitError, ExitRequested, exitWithCode } from "../infra/exit.ts";
import { invokeCli, invokeCliWithRetry, resolveTerminationConfig } from "../infra/invoke.ts";
import { withLifecycle, type TerminationConfig, type TerminationCause } from "../infra/proc.ts";
import { getRoot, resolveDocArg } from "../infra/root.ts";
import { readProgressJSON, writeProgressJSON, getRound, incrementRound, incrementRecovery, taskScopeBase, SHA40_RE } from "../artifacts/progress.ts";
import { briefPath } from "../artifacts/base-branch.ts";
import {
  settleResidue,
  readDeadCarrier,
  findResumeResidue,
  resumeFromResidue,
  appendixFromRecovery,
  type ResidueAppendixInput,
} from "../artifacts/residue.ts";
import { validateHandoffSchema } from "../rules/schema.ts";
import { extractPlanConstraints, taskNumbersFromPlan } from "../rules/documents.ts";
export { extractPlanConstraints, taskNumbersFromPlan } from "../rules/documents.ts";
import { DOC_TOKENS } from "../documents/tokens.ts";
import { deriveTaskState, derivePlanVerdict, formatTaskStateLine, formatPlanVerdict } from "../rules/status.ts";
import { returnFourLines, returnFromHandoff, dryRunBlock } from "../artifacts/return-block.ts";
import { FAILURE_CATEGORIES, incrementFailureCounter, exhaustedBlocker, maybeExhaust, timeoutBlocker } from "../rules/failure.ts";
export { returnFourLines, returnFromHandoff } from "../artifacts/return-block.ts";

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

// Local orchestration error — P6 T24 E family: a recoverable run failure throws CddExitError with
// exitCode 1 + kind "run-blocked" (naming.ts materializeWorkspace throws the same kind, so the
// resolveContext catch matches ONE kind for both). No local subclass: the catch discriminates on
// the kind, not the class (the former RunBlocked subclass is gone).
//
// ---- failure-category dispatch (T6) ----
// Six category names declared once by engine-config.json#failureCategories; every "category
// identity" reference here loads through src/rules/failure.ts (FAILURE_CATEGORIES / counters()) —
// a category deleted from the canonical blows up the entry reference at runtime (AC14
// load-bearing, not decorative).
// P6 T24 B/D4: the counter family (incrementFailureCounter / exhaustedBlocker / maybeExhaust) has
// ONE owner — src/rules/failure.ts. The former inline copies are deleted; this file imports the
// canonical three (zero double implementations — the two ownership lines exist only in failure.ts).

// ---- workspace / ctx ----

/** Workspace derivation is purely plan-derived (P4 §2.4.1): root comes from the injected single
 * root authority (src/infra/root.mjs — the engine's only cwd conversion point), the effective
 * plan from the explicit `--plan` argument. P6 T24 C: the materializeWorkspace implementation
 * (plan → <repoRoot>/<workspaceRoot>/<slug>/ + `.gitignore`, errors → CddExitError kind
 * "run-blocked") converges in naming.ts — the workspace derivation single point alongside
 * resolveWorkspace; this file only imports + exercises it. */

/** resolvePlanWorkspace({ planFile, root }) — the plan → workspace UNIQUE derivation point:
 * `--plan` normalizes to the repo-root coordinate system via resolveDocArg (missing → exit-1
 * diagnostic), then derives the workspace. The "missing plan → CddExitError kind run-blocked"
 * guard text lives only here — runTask step 2 and the buildCtx direct-entry share this function. */
export function resolvePlanWorkspace({ planFile, root }: { planFile?: string; root: string }): { plan: string; workspace: string } {
  const plan = planFile ? resolveDocArg(planFile, root, "plan") : "";
  if (!plan) throw new CddExitError("cannot resolve repo root: provide --plan", { exitCode: 1, kind: "run-blocked" });
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
    // Canonical slug slot (Task 20 ⑦): workspaceSlug strips a single -design/-plan layer so a plan and
    // its paired spec converge to the same slug, e.g. osuperpowers-overhaul-p6.
    WORKSPACE_SLUG: workspaceSlug(ctx.plan),
    TASK_BRIEF: ctx.briefPath,
    HANDOFF_TARGET: ctx.handoffPath,
    TASK_FINDINGS: ctx.findingsPath ?? "",
    TASK_CONSTRAINTS: ctx.constraintsPath,
    TASK_FIXED_POINT: ctx.fixedPoint ?? "",  // empty string if the cross-phase read returned nothing
    TASK_NUMBER: String(taskNum),
    REVIEW_PLAN_LINE: ctx.plan ? `**Plan:** ${ctx.plan}` : "",
  };
}

// ---- return block output (P6 T24 C) ----

/** The return-block text plane converges in src/artifacts/return-block.ts — its single point. This
 * file imports returnFourLines / returnFromHandoff (parsing + handoff read-back) and dryRunBlock
 * (the dry-run agentOut) from there, and re-exports the two task-facing read-back atoms so legacy
 * importers (tests importing from this module) resolve through the same single implementation —
 * no shape re-definition lives here. */

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
 * surface via .result ({ exitCode, returnBlock }) + .diagnostic (stderr message) after run(). */
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
  #returnBlock: string[] = [];
  #exitCode = -1;
  #diagnostic: TaskDiagnostic | null = null;
  #finished = false;
  /** The dead-round carrier's recovery.scope_base captured at the resume pre-flight (T27,
   *  spec T7.6), handed to implement materialization (finalizeImplement pulls the scope ledger
   *  strictly earlier along it). null = no earlier anchor was riding the carrier. */
  #resumeScopeBase: string | null = null;

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
      // Plan-constraints existence gate (T22, §T7.1) — implement pre-flight, dry-run exempt. Runs
      // BEFORE the F11 brief generation below (the brief does not feed extraction): a
      // source-undeclared BLOCK aborts pre-dispatch with zero workspace residue, rather than
      // leaving a partial brief artifact on disk (findings 6).
      // Missing → materialize once from the plan's declared Constraints source (workitem same
      // class as the brief; the anchor records the source plan hash for stale detection); a plan
      // declaring no Constraints source → BLOCK (constraints source undeclared). The BLOCK is explicit — never a
      // silent fallback to "brief as sole authority" (E27: source-less fallback was the recurring
      // root cause this gate kills). dry-run keeps zero constraints side effects: no materialize,
      // no gate (T10 dry-run gate-family semantics). Generate-once: materialize writes or throws —
      // no post-call existsSync re-check (dead in the write-or-throw contract, findings 5).
      if (!dryRun && mode === "implement") {
        if (!existsSync(ctx.constraintsPath)) {
          try {
            materializePlanConstraints(planWorkspace.plan, ctx.workspace);
          } catch (e) {
            throw new CddExitError(
              e instanceof ConstraintsSourceUndeclared
                ? e.message
                : `${PLAN_CONSTRAINTS_MISSING_BLOCKER} (${(e as Error).message})`,
              { exitCode: 1, kind: "run-blocked" },
            );
          }
        }
      }
      // F11: self-provision the task brief at plan finalization (--plan takes effect on
      // generation). Failure → CddExitError kind run-blocked → exit 1 — never a silent fallback to
      // an existing brief. Parent-dir bootstrap before writing (same workspace-bootstrap
      // convention as writeBaseBranch).
      let residueAppendix: ResidueAppendixInput | null = null; // resume-from-residue (T26, spec T7.5)
      if (!dryRun && mode === "implement") {
        try {
          // Resume pre-flight runs AFTER the entry gate (base.run(): commitPreCheck → resolveContext)
          // verified a clean tree — the restore may land without conflict. Reads the PRIOR implement
          // carrier: a dead round (TIMEOUT / EXECUTION_FAILURE) → find the salvage
          // (recovery.residue_ref primary — settleResidue output ≡ resume input; standardized
          // stash-message scan fallback for pre-schema carriers) → `git stash apply` → the
          // regenerated brief appends the data-driven residue appendix so the next agent audits the
          // restored WIP and continues, not rewrites. Fail-open: a resume failure never blocks the
          // dispatch (CDD_WARN diagnostic; the brief regenerates without the appendix and the
          // pre-resume clean baseline stands).
          const carrier = readDeadCarrier(ctx.handoffPath);
          if (carrier) {
            // The dead round's settled scope rides the resume (T27): recovery.scope_base — ledger
            // value / fallback dead-round brief TASK_BASE — is the same task-level anchor, so
            // re-materialization pulls the ledger strictly earlier along it (finalizeImplement).
            const recoveryScope = (carrier.recovery as Record<string, unknown> | undefined)?.scope_base;
            if (typeof recoveryScope === "string" && SHA40_RE.test(recoveryScope)) {
              this.#resumeScopeBase = recoveryScope;
            }
            const found = await findResumeResidue(this.#root, carrier, this.#taskNum);
            if (found) {
              if (await resumeFromResidue(this.#root, found.ref)) {
                residueAppendix = appendixFromRecovery(carrier, found);
              } else {
                process.stderr.write(`CDD_WARN: residue stash apply failed (${found.ref}) — dispatch continues from the clean baseline\n`);
              }
            }
          }
        } catch {
          // resume is best-effort — never blocks the dispatch
        }
      }
      try {
        mkdirSync(path.dirname(ctx.briefPath), { recursive: true });
        await generateBrief(planWorkspace.plan, this.#taskNum, ctx.briefPath, this.#root, residueAppendix);
      } catch (e) {
        throw new CddExitError(`brief generation failed: ${(e as Error).message}`, { exitCode: 1, kind: "run-blocked" });
      }
    } catch (e) {
      // The kind discriminates (both the former RunBlocked sites and naming.ts materializeWorkspace
      // throw CddExitError kind "run-blocked") → one recoverable-orchestration exit face.
      if (e instanceof CddExitError && e.kind === "run-blocked") { this.#done(1, [], e.message); return; }
      // resolveDocArg's missing-path diagnostic goes through exitWithCode (throws ExitRequested) —
      // normalized to the same exit so the noExit=true in-process caller still gets
      // { exitCode: 1 } rather than an exception piercing.
      if (e instanceof ExitRequested) { this.#done(e.code, [], ""); return; }
      throw e;
    }
    this.#tcx = ctx;

    // Post-flight wiring: the inherited writeBoundary step reads the handoff path from the public
    // ctx (which runTask constructs with an empty handoffPath — the canonical path is derived here
    // by buildCtx). Sync it so the changed-surface reconcile sees the real carrier (the T25 gap:
    // task-family carriers never carried the ledger-origin note because the step was reading "").
    // Idempotence is preserved: the base settleResidue step, which reads the same path, is a no-op
    // for task rounds (resume-class failures already preserved inline — recovery.preserved guard).
    this.ctx = { ...this.ctx, handoffPath: ctx.handoffPath };

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

    // 5. Task-review / fix fixed-point — derive from the scope ledger (T27, spec T7.6) first, the
    // legacy prior-handoff chain second. The ledger's scope_base is the TASK's true contribution
    // start (round-1 implement brief TASK_BASE seeded earliest-wins; resume-declared bases pulled
    // strictly earlier) — review/fix range against the ledger is the real deliverable range, never
    // the T26 collapse (re-dispatch TASK_BASE == dead head → legacy chain reads an empty range).
    // Ledger missing → fall back to the legacy prev.commits.base chain (normal tasks unchanged).
    if (mode === "review" || mode === "fix") {
      if (!ctx.fixedPoint) {
        const ledgerBase = taskScopeBase(progressDir, this.#taskNum);
        if (ledgerBase) {
          ctx.fixedPoint = ledgerBase;
        } else {
          const prev = prevHandoffPath(ctx.workspace, this.#taskNum, mode, ctx.round ?? 1);
          if (prev) {
            const prevCommitsBase = readJsonField(prev, ["commits", "base"]);
            if (prevCommitsBase && prevCommitsBase !== "unknown") {
              ctx.fixedPoint = prevCommitsBase;
            }
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

  /** BLOCK face override (Task 3 ④): the task channel's non-throwing #done terminal — exit 1 +
   * the CDD_BLOCKED diagnostic; no carrier is written (the doc-invalid round stays
   * re-dispatchable the moment the docs are repaired — matching the pre-T3 face exactly). */
  protected override docContractBlocked(guidance: string): void {
    this.#done(1, [], `doc contract validation failed — fix the docs below, then re-dispatch task ${this.#taskNum}:\n${guidance}`);
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
    let cause: TerminationCause | undefined; // unified termination cause (stalled/over-budget/signal; T26)
    let idleWindowMs: number | undefined; // stall blocker detail (monitor idle window)
    if (dryRun) {
      // Dry-run simulation block (return-block.ts single point): the 4-line APPROVED dry-run
      // payload; the post-flight parse re-appends the counters line (returnFourLines).
      agentOut = dryRunBlock({
        commits: "base=dry-run",
        artifacts: `brief=${ctx.briefPath} report=${ctx.workspace}/task-${this.#taskNum}-report.md test_evidence=${ctx.workspace}/task-${this.#taskNum}-test-evidence.json`,
      });
    } else {
      // Unified termination config (T26): single resolver (resolveTerminationConfig) replaces the
      // (resolveTimeoutMs + resolveLivenessConfig) pair — budget from canonical mode defaults with
      // the opts.termination seam on top, stall cadence from canonical timeouts.liveness. The
      // progress path is ALWAYS the dispatch workspace (engine artifacts live there); a missing
      // one reads 'unknown' forever — fail loud so a broken workspace can never quietly neuter
      // the tree signal.
      const terminationCfg = resolveTerminationConfig("task", this.#opts.termination, ctx.workspace);
      // #timeoutMs = the EFFECTIVE budget — the blockers/diagnostics report the budget the monitor
      // actually enforced, not the canonical default.
      this.#timeoutMs = terminationCfg.budgetMs;
      if (!existsSync(ctx.workspace)) {
        process.stderr.write(`CDD_WARN: termination progress path missing (${ctx.workspace}) — tree signal unavailable, stall detection relies on CPU alone\n`);
      }
      // Subprocess cwd = the injected root (the single root authority; this function never reads
      // the startup cwd and has no second injection seam). Subprocess env = the host env (zero
      // CDD_* injection — engine-internal state passes via ctx, never across the env boundary).
      const res = (await invokeCliWithRetry(
        this.#entry as { cli: string; invoke: string; output?: string; prefix?: unknown; suffix?: unknown },
        prompt,
        INVOKE_PARAMS[mode] ?? { op: mode },
        this.#hostEnv(),
        this.#root,
        terminationCfg,
      )) as TaskSpawnResult;
      agentOut = res.ok ? res.stdout : "";
      timedOut = res.timedOut === true;
      unkillable = res.unkillable === true;
      cause = res.cause;
      idleWindowMs = terminationCfg.idleWindowMs;
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
        writeBlockedCarrier(ctx.handoffPath, {
          task: this.#taskNum,
          phase: mode,
          failure_category: FAILURE_CATEGORIES.ENGINE_SELF_WRITTEN.id,
          blocker: `cli process unkillable after timeout → manually kill the process (check ps), then re-dispatch task ${this.#taskNum}`,
        });
        if (!dryRun) {
          incrementRound(progressDir, this.#taskNum, mode);
          maybeExhaust(progressDir, FAILURE_CATEGORIES.ENGINE_SELF_WRITTEN.id, ctx.handoffPath); // engine-self-written → engineSelfWrittenCount (not recovery quota)
        }
        this.#done(1, returnFromHandoff(ctx.handoffPath, ctx.workspace), "process unkillable");
        return;
      }
      // Normal timeout (budget exceeded OR liveness stall OR external SIGTERM): TIMEOUT partial
      // handoff. The blocker comes from the single rules/failure.ts timeoutBlocker point keyed on
      // the unified cause — the stall/signal variants carry the resume-or-discard contract on the
      // implement lane. T26 salvage: the round's uncommitted work is stashed FIRST (settleResidue
      // — recovery.residue_ref rides the carrier; spec T7.5 settleResidue output ≡ resume input),
      // so the re-dispatch pre-flight can restore it. T25: the review/fix lanes now carry the death
      // diagnosis too (recovery.cause = the TIMEOUT category id — the base settleResidue template
      // step auto-preserves their dirty-tree WIP right after this lane returns; #done returns, it
      // does not throw). A clean tree → nothing to preserve, and the termination sub-cause is
      // archived via `notes` instead.
      const timeoutMs = this.#timeoutMs;
      const recovery = mode === "implement"
        ? await settleResidue(this.#root, {
            op: mode,
            type: "task",
            task: this.#taskNum,
            round: ctx.round ?? 1,
            cause: cause ?? "over-budget",
            // The salvage captures the task-level scope anchor (ledger priority / fallback the
            // dead-round brief TASK_BASE; T27) so the resume restores the same scope.
            scopeBase: taskScopeBase(progressDir, this.#taskNum) ?? taskBaseFromBrief(ctx.briefPath),
          })
        : { cause: FAILURE_CATEGORIES.TIMEOUT.id };
      writeBlockedCarrier(ctx.handoffPath, {
        task: this.#taskNum,
        phase: mode,
        status: "TIMEOUT",
        failure_category: FAILURE_CATEGORIES.TIMEOUT.id,
        recovery: recovery ?? undefined,
        // no salvage / review-fix lane → the termination sub-cause rides `notes` (the only archival
        // channel when recovery.cause is the category id) so a dead round stays replayable by cause
        notes: mode === "implement" ? undefined : `termination cause: ${cause ?? "unknown"}`,
        blocker: timeoutBlocker({ cause, taskNum: this.#taskNum, timeoutMs, idleWindowMs, op: mode, residue: recovery?.residue_ref ?? null }),
      });
      if (!dryRun) incrementRound(progressDir, this.#taskNum, mode);
      // TIMEOUT counter increment: field via canonical counterFor, category identity via
      // FAILURE_CATEGORIES (replaces the legacy timeoutCount++ three-liner, T6 zero hand-written
      // counter literals).
      maybeExhaust(progressDir, FAILURE_CATEGORIES.TIMEOUT.id, ctx.handoffPath);
      this.#done(1, returnFromHandoff(ctx.handoffPath, ctx.workspace), `cli terminated (cause: ${cause ?? "unknown"})`);
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
    // handoff; step 13 materializes it from return block + TASK_BASE + HEAD). review/fix keep the read +
    // validation (the agent is the content author; findings content contract).
    if (mode !== "implement") {
      const existingHandoff = readJson(ctx.handoffPath);
      if (existingHandoff) {
        const sv = validateHandoffSchema(existingHandoff);
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
              task: this.#taskNum,
              phase: mode,
              failure_category: FAILURE_CATEGORIES.CONTRACT_VIOLATION.id,
              findings: rec.preservedFindings,
              blocker: `handoff schema invalid${rec.reason} → fix the handoff JSON at ${ctx.handoffPath} and re-dispatch task ${this.#taskNum}`,
              fullReplace: true,
            });
            if (!dryRun) {
              incrementRound(progressDir, this.#taskNum, mode);
              maybeExhaust(progressDir, FAILURE_CATEGORIES.CONTRACT_VIOLATION.id, ctx.handoffPath); // format error on the producing side
            }
            this.#done(1, returnFromHandoff(ctx.handoffPath, ctx.workspace), `schema validation failed${rec.reason}`);
            return;
          }
        }
      }
    }

    // 10. Nested CLI failed with no handoff → write BLOCKED handoff (stderr into blocker) + return block +
    //     the CDD_BLOCKED diagnostic + exit 1. T26: like TIMEOUT, this is a resumable dead round —
    //     settleResidue salvages whatever partial WIP the failed agent left before the carrier writes
    //     (implement lane only — the resume lane; a clean tree → no recovery record). The upgrade
    //     text keeps the legacy `cli exited N without writing handoff` prefix the black-box suite
    //     matches, with the resume-or-discard contract on implement and the stash-workflow text on
    //     review/fix (T25 — the base settleResidue step preserves their WIP right after this lane
    //     returns, so the operator retrieves it via `git stash list` instead of pre-destroying it).
    if (this.#agentRc !== 0 && !existsSync(ctx.handoffPath)) {
      const recovery = mode === "implement"
        ? await settleResidue(this.#root, {
            op: mode,
            type: "task",
            task: this.#taskNum,
            round: ctx.round ?? 1,
            cause: "exec-failure",
            // Same scope-anchor capture as the TIMEOUT salvage lane (T27).
            scopeBase: taskScopeBase(progressDir, this.#taskNum) ?? taskBaseFromBrief(ctx.briefPath),
          })
        // Review/fix EXECUTION_FAILURE death diagnosis rides the carrier (T25): cause = the category
        // id — the preserve eligibility key + exit code distinguishing exit 1 vs 143. The base
        // settleResidue step stashes the dirty-tree WIP afterwards, filling residue_ref/wip_stat/
        // preserved.
        : { cause: FAILURE_CATEGORIES.EXECUTION_FAILURE.id, exit_code: this.#agentRc };
      writeBlockedCarrier(ctx.handoffPath, {
        task: this.#taskNum,
        phase: mode,
        failure_category: FAILURE_CATEGORIES.EXECUTION_FAILURE.id,
        commits: { base: "unknown" }, // no real head at failure time — the "unknown" sentinel is the EXECUTION_FAILURE ground (T23)
        recovery: recovery ?? undefined,
        blocker:
          `cli exited ${this.#agentRc}${this.#agentRc === 143 ? " (SIGTERM — externally killed)" : ""} without writing handoff → check stderr above for errors; ` +
          (`residue_ref` in (recovery ?? {}) ? `WIP salvaged (recovery.residue_ref=${(recovery as { residue_ref: string }).residue_ref}) — ` : "") +
          (mode === "implement"
            ? `resume or discard: cdd implement --task ${this.#taskNum} re-dispatch auto-resumes (recovery.residue_ref), or git stash drop to abandon`
            : `worktree residue (if any) is preserved as a stash — \`git stash list\` to find the snapshot, \`git stash apply <ref>\` + review to salvage (then commit) or \`git stash drop\` to discard, then re-dispatch cdd ${mode} --task ${this.#taskNum}`),
      });
      if (!dryRun) {
        incrementRound(progressDir, this.#taskNum, mode);
        incrementRecovery(progressDir); // REAL execution failure (not timeout / not engine-written) → EXECUTION_FAILURE — the only recovery-quota consumer (AC7)
      }
      this.#done(1, returnFromHandoff(ctx.handoffPath, ctx.workspace), `cli exited ${this.#agentRc} and handoff missing`);
      return;
    }

    // 10.5. CLI succeeded but no handoff → BLOCKED (file-existence check, not phase-mismatch
    // fallback). Agent exits 0 without writing a handoff = error. dry-run excluded (no handoff
    // invariant — bash dry-run writes none, neither does Node). implement excluded (T6): the
    // runner materializes in step 13's OK path — implement agents write no handoff and this check
    // would falsely BLOCK every successful implement.
    if (this.#agentRc === 0 && !dryRun && mode !== "implement" && !existsSync(ctx.handoffPath)) {
      writeBlockedCarrier(ctx.handoffPath, {
        task: this.#taskNum,
        phase: mode,
        failure_category: FAILURE_CATEGORIES.ENGINE_SELF_WRITTEN.id,
        blocker: `${path.basename(ctx.handoffPath)} not written after exit 0 → re-run ${mode} and ensure handoff is written to ${ctx.handoffPath} before exit`,
      });
      incrementRound(progressDir, this.#taskNum, mode);
      maybeExhaust(progressDir, FAILURE_CATEGORIES.ENGINE_SELF_WRITTEN.id, ctx.handoffPath); // engine-written BLOCKED (exit 0 without handoff)
      this.#done(1, returnFromHandoff(ctx.handoffPath, ctx.workspace), `${mode} agent did not write handoff`);
      return;
    }
  }

  /** Steps 11/12/13: return block four-line parse → agent-failure exit → implement materialization
   * (dry-run writes no handoff — aligned with bash). */
  protected override async normalizeResult(_hookCtx: DispatchHookContext): Promise<void> {
    if (this.#finished) return;
    const mode = this.#mode();
    const dryRun = this.#opts.dryRun === true;
    const ctx = this.#tcx!;
    const progressDir = path.dirname(ctx.ledgerPath);

    // 11. return block four lines (from the agent stdout / dry-run block)
    let returnBlock = returnFourLines(this.#agentOut, ctx.workspace);

    // 12. Agent failed but handoff exists → exit agent_rc (raw return block stays from agent stdout).
    if (this.#agentRc !== 0) {
      this.#done(this.#agentRc, returnBlock, "");
      return;
    }

    // 13. OK — implement materialization (dry-run does not write a handoff — aligned with bash).
    //     T5: status single authority — the review-type handoff is derived/overwritten by the
    //     engine at finalization (SP-4 exempts failure rounds). T6: implement materializes — the
    //     agent writes no handoff (implement.md dropped the Handoff Output section), the runner
    //     builds task-N-implement.json from the return block four lines + brief TASK_BASE + git HEAD;
    //     evidence-gate read-back (behavior_change:true → hard; else soft WARN). T7: the carrier
    //     comes home to the engine — implement/review finalize through finalizeHandoff,
    //     writeOwnHandoff full-replace, return block always re-emits from returnFromHandoff.
    if (!dryRun && mode === "implement") {
      const finalized = await finalizeHandoff({
        mode,
        returnBlock,
        brief: ctx.briefPath,
        repoRoot: this.#root,
        workspace: ctx.workspace,
        taskNum: this.#taskNum,
        resumeScopeBase: this.#resumeScopeBase,
      });
      if (finalized.handoff) {
        writeOwnHandoff(ctx.handoffPath, finalized.handoff);
        returnBlock = returnFromHandoff(ctx.handoffPath, ctx.workspace);
        // Materialized return block and handoff/exit align: hard gate or an agent-declared BLOCKED → exit 1.
        if (finalized.exitCode !== 0) {
          maybeExhaust(progressDir, FAILURE_CATEGORIES.ENGINE_SELF_WRITTEN.id, ctx.handoffPath);
          this.#done(finalized.exitCode, returnBlock, "");
          return;
        }
      }
      // Degradation exception (T6 nit2, documented): missing brief / no TASK_BASE line →
      // finalizeHandoff materializes nothing (handoff:null + stderr CDD_WARN; the agent's original
      // return block stays). dry-run and smoke chains both land here — an ENOENT must never crash the runner.
    }
    this.#returnBlock = returnBlock;
  }

  /** Step 13.5 + post-gate writeback: the exit gate (validateCommitContract) runs for every
   * non-finished non-dry-run round; after it passes, the APPROVED-review ensure-row writeback +
   * non-implement round increment land (a dirty failure round never touches the row; the complete
   * verdict is deriveTaskState's — the row keeps only facts). */
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
        this.#done(1, returnFromHandoff(ctx.handoffPath, ctx.workspace), cv.blocker);
        return;
      }
    }

    // Status single authority (T5/T7): the review-type handoff is finalized by the engine
    // (finalizeHandoff rollup overwrites the agent-declared status, SP-4 exempts failure rounds);
    // the success path reads the finalized handoff and persists it (writeOwnHandoff full-replace),
    // and re-emits return block from returnFromHandoff.
    // Review + fix both finalize here and take the round conclusion → exit (Task 23 ③):
    // (BLOCKED → 1 on any channel, APPROVED/CHANGES_REQUESTED → 0). finalizeHandoff review derives
    // status + the BLOCKED carrier; fix passes the work-type's declared status through. The
    // implement mode normalized its own exit in normalizeResult (materialization).
    let finalized: { handoff: Record<string, unknown> | null; exitCode: number } | null = null;
    if (!dryRun && (mode === "review" || mode === "fix")) {
      const handoff = readJson(ctx.handoffPath);
      if (handoff) {
        finalized = await finalizeHandoff({ mode, agentHandoff: handoff });
        // persistFinalized: derivation unchanged (same reference) → skip the write (no no-op
        // overwrite); changed → full-replace + sync.
        persistFinalized(ctx.handoffPath, handoff, finalized);
        this.#returnBlock = returnFromHandoff(ctx.handoffPath, ctx.workspace);
        if (mode === "review" && normalizeHandoffStatus(handoff.status as string) === "APPROVED") {
          // This read stays single-arg (T7): at review-success execution progress.json already
          // exists (plan recorded at the init point); plan no longer participates in
          // createEmptyProgress derivation.
          // The APPROVED-review writeback is downgraded to ensure-the-row-exists (Task 30 ②) —
          // the complete verdict is deriveTaskState's sole authority (rules/status.ts), never a
          // stored field. The row creation still matters: incrementRound below finds it.
          const progressData2 = readProgressJSON(progressDir);
          let taskEntry = progressData2.tasks.find((t) => t.task === this.#taskNum);
          if (!taskEntry) {
            taskEntry = { task: this.#taskNum, rounds: {} };
            progressData2.tasks.push(taskEntry);
          }
          writeProgressJSON(progressDir, progressData2);
        }
      }
    }
    if (!dryRun && mode !== "implement") incrementRound(progressDir, this.#taskNum, mode);
    // exit mastered by finalizeHandoff's round conclusion — the T14「exit 0 + status BLOCKED」
    // inversion dies here (a BLOCKED-derived review or a fix declaring BLOCKED → 1).
    this.#done(finalized?.exitCode ?? 0, this.#returnBlock, "");
  }

  /** statusValidate template-step override (post-flight, after the exit gate; Task 29, spec T7.8):
   * reports the round's CURRENT task state (six-state convergence, rules/status.ts) + the plan
   * completion verdict as CDD_INFO — the "plan Done" terminal declaration is exactly this
   * all-complete verdict (closeout consumes it; no more manual tallying). Deliberately runs
   * WITHOUT the #finished guard: the round just ended (commitPostCheck #done'd) and its resulting
   * state is precisely what the report describes; the walk has already passed every exit gate, so
   * this step is informational and never exit-changing. Read-only — derives from on-disk
   * progress/carriers; unreadable progress/plan → skip silently (fail-open). */
  protected override async statusValidate(_hookCtx: DispatchHookContext): Promise<void> {
    const ctx = this.#tcx; // null when resolveContext died early (e.g. cli-missing) — nothing to reconcile
    if (!ctx || !ctx.workspace || !ctx.plan) return;
    try {
      const state = deriveTaskState(ctx.workspace, this.#taskNum);
      const verdict = derivePlanVerdict(ctx.plan, ctx.workspace, taskNumbersFromPlan);
      process.stderr.write(`CDD_INFO: ${formatTaskStateLine(this.#taskNum, state)}\n`);
      process.stderr.write(`CDD_INFO: ${formatPlanVerdict(verdict)}\n`);
    } catch {
      // fail-open: no report when progress/plan cannot be read
    }
  }
}

/** runTask — legacy surface kept ({ exitCode, returnBlock }; noExit=true suppresses the stdout/stderr +
 * exit-throw: the unit-test seam). Builds the injected ctx, runs TaskLifecycle, converts an
 * entry-gate DispatchBlocked into a CDD_BLOCKED stderr + exit 1 (or a { exitCode: 1, returnBlock: [] } in
 * noExit mode); on the normal path writes the diagnostic + return block lines + exits via exitWithCode when
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
      ctx: { mode: opts.mode ?? "", repoRoot: root, handoffPath: "", dryRun: opts.dryRun === true },
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

// ---- plan building blocks (pure functions, unit-test seam) ----

// taskNumbersFromPlan + extractPlanConstraints are canonical in rules/documents.ts (T3 ③ — the
// base default docContractValidate consumes them without a dispatch-layer import); this module
// re-exports the same identities and materializePlanConstraints consumes the canonical extractor.
// A change to either extraction lands in documents.ts once.

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

// ---- plan-constraints materialization (T22/§T7.1; pure functions, unit-test seam) ----

// The workspace-derived constraints artifact name (derive-only until T22 — the recurring
//「plan-constraints.md 不存在 → brief 唯一权威」note root cause: derived but never generated).
const PLAN_CONSTRAINTS_FILE = "plan-constraints.md";
// The actionable BLOCK face for an un-materializable constraints file — single module const for
// the materializer catch fallback (findings 5: the generate-once post-check is gone because
// materializePlanConstraints either writes the file or throws, never returns with it absent).
const PLAN_CONSTRAINTS_MISSING_BLOCKER = "plan-constraints.md missing — run materializer or declare a plan Constraints source";
// Plan-hash anchor token embedded in the artifact header (stale anchor; parsed by
// isPlanConstraintsStale). The anchor is the ONLY path token in the file — the header embeds
// the plan basename + content hash, never the absolute root — so equal plans produce equal
// artifact bytes on any machine (recomputable test baseline).
const PLAN_HASH_RE = /plan hash: ([0-9a-f]{64})/;
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
function constraintsHeader(planPath: string, hash: string): string {
  return [
    `<!-- ${PLAN_CONSTRAINTS_FILE} — CDD workspace artifact derived from the plan's declared Constraints source. Do not edit. -->`,
    `<!-- source plan: ${path.basename(planPath)} · plan hash: ${hash} -->`,
    "",
  ].join("\n");
}

/** Materialize plan-constraints.md in the workspace from the plan's declared Constraints source
 * (T22/§T7.1). Generate-once: an existing file is left untouched (the anchor surfaces staleness
 * via isPlanConstraintsStale). A plan declaring no Constraints source throws
 * ConstraintsSourceUndeclared — never a silent fallback (the derived artifact's existence gate is
 * the implement pre-flight's non-negotiable input). */
export function materializePlanConstraints(plan: string, workspace: string): { path: string; generated: boolean } {
  const outPath = path.join(workspace, PLAN_CONSTRAINTS_FILE);
  if (existsSync(outPath)) return { path: outPath, generated: false };
  const content = extractPlanConstraints(readFileSync(plan, "utf8"));
  if (content === null) {
    throw new ConstraintsSourceUndeclared(
      `plan Constraints source undeclared — declare a literal “${DOC_TOKENS.constraintsHeading}” section (canonical) or the prose pointer headings (${PROSE_ANCHORS.join(" / ")}) so cdd implement can materialize ${PLAN_CONSTRAINTS_FILE}`,
    );
  }
  writeFileSync(outPath, constraintsHeader(plan, hashFile(plan)) + content, "utf8");
  return { path: outPath, generated: true };
}

/** Stale detection (T22 ④): compare the plan-hash anchor in an existing plan-constraints.md
 * against the current plan. Unreadable / un-anchored / sha mismatch → stale (true) — an
 * anchor-less file cannot be confirmed fresh. Recomputable baseline: same plan bytes → same hash. */
export function isPlanConstraintsStale(constraintsFile: string, planPath: string): boolean {
  try {
    const m = readFileSync(constraintsFile, "utf8").match(PLAN_HASH_RE);
    if (!m) return true;
    return m[1] !== hashFile(planPath);
  } catch {
    return true;
  }
}
