// packages/cdd-engine/src/dispatch/base.ts — DispatchLifecycle abstract base class (Task 7;
// spec §2.12「抽象基类继承覆写」— abstract-base inheritance point). The lifecycle template method
// plus default hook implementations: run() walks pre-flight → dispatch → post-flight (phase labels
// from the phases.ts table), and the commit double gates (双门) hang on the base's DEFAULT hooks —
// commitPreCheck (入口门, pre-commit clean tree, dry-run-downgraded since P6 T10/E2②) and
// commitPostCheck (出口门, validateCommitContract).
// Concrete subclasses (task.ts / docs.ts) inherit and override the hook they care about; they never
// touch the hookable registry — engine-internal variants override via inheritance (§2.13), never
// through this module.
//
//   Timeline (template steps + phase boundaries, observable via .timeline): phase labels are typed
//   PhaseId — a compile-time anchor to the phases.ts table; reordering the table is a reordering of
//   the lifecycle, and the ordering test asserts the walk contract.
//
// Construction contract: hooks + ctx injected (构造注 hooks/ctx). hooks defaults to a fresh
// per-lifecycle factory instance (hooks.ts: factory, not a module singleton); the base then MOUNTS
// its default gates at the fixed points commit:enter / commit:exit (hooks.ts fixed-point
// enumeration) — subclass overrides of commitPreCheck / commitPostCheck replace the judgment at the
// fixed point via poly-dispatch (this binding), registry untouched.

import { resolveWorkspace } from "../artifacts/handoff/naming.ts";
import { preserveAndAnnounceResidue } from "../artifacts/residue.ts";
import { CddExitError } from "../infra/exit.ts";
import {
  type CloseoutResult,
  deriveCloseoutMismatches,
  formatCloseoutDebtFailures,
  formatCloseoutDebtHighlight,
} from "../rules/closeout.ts";
import { entryGateCleanTree, validateCommitContract } from "../rules/commit.ts";
import { effectiveGroups, formatDocFailures, taskNumbersFromPlan } from "../rules/documents.ts";
import {
  derivePlanVerdict,
  deriveTaskState,
  formatPlanVerdict,
  formatTaskStateLine,
} from "../rules/status.ts";
import { reconcileChangedSurface } from "../rules/write-boundary.ts";
import { createDispatchHooks, type DispatchHookContext, type DispatchHooks } from "./hooks.ts";
import type { PhaseId } from "./phases.ts";

// Consumer re-export: the override hooks (commitPreCheck / dispatch / …) all take this context;
// subclasses import the signature from the lifecycle's home module, not from the registry.
export type { DispatchHookContext } from "./hooks.ts";

/** Dispatch engine context — base consumes mode / repoRoot / handoffPath (the gate surface);
 * subclasses extend with their own keys (--plan workspace / progressDir / …). */
export interface DispatchContext {
  /** dispatch mode id — gates branch on it (implement / review / fix as the CLI face emits; docs variants included) */
  mode: string;
  /** git workspace root the gates resolve against (mirrors `git -C`, rules/commit.ts fail-open); non-git / null → gates fail-open ok */
  repoRoot: string | null;
  /** exit-gate commit-contract handoff path (optional — absent → exit gate runs the dirty judgment only) */
  handoffPath?: string;
  /** dry-run simulation (E2②): the entry gate downgrades a dirty-tree BLOCK to a stderr CDD_WARN
   * and lets the simulation finish (real dispatch keeps the hard BLOCKED). Threaded by the
   * concrete runners (runTask / runDocsTask) from their opts.dryRun — never read from env. */
  dryRun?: boolean;
  /** subclass context extension (task.ts / docs.ts decide their own keys) */
  [key: string]: unknown;
}

export interface DispatchLifecycleOptions {
  /** hookable registration surface; default: a fresh per-lifecycle instance (factory, not singleton) */
  hooks?: DispatchHooks;
  /** engine context — mode / repoRoot / handoffPath are what the base gates need */
  ctx: DispatchContext;
}

/** Commit-boundary BLOCKED signal — thrown by the default gates (message = the rules-layer blocker
 * text). Task 8's CLI face maps it to exit 1; the exit gate's handoff rewrite lives in rules/commit.ts.
 * P6 T24 (F error consolidation): DispatchBlocked extends the exit.ts CddExitError family (exitCode 1 / kind
 * "blocked") — a gate block that escapes an override unwinds to bin.ts's family catch and lands the
 * correct exit code (0/1/2/3 table unchanged). */
export type CommitGate = "entry" | "exit";
export class DispatchBlocked extends CddExitError {
  readonly gate: CommitGate;
  constructor(message: string, gate: CommitGate) {
    super(message, { exitCode: 1, kind: "blocked" });
    this.name = "DispatchBlocked";
    this.gate = gate;
  }
}

export abstract class DispatchLifecycle {
  /** hookable instance (mounted with the default gates at run-time fixed points; external plugins share it) */
  public readonly hooks: DispatchHooks;

  #ctx: DispatchContext;
  #timeline: string[] = [];

  constructor(options: DispatchLifecycleOptions) {
    this.hooks = options.hooks ?? createDispatchHooks();
    this.#ctx = options.ctx;
    // Fixed-point gate mounts (hooks.ts commit:enter/commit:exit). Arrows poly-dispatch to `this`,
    // so a subclass override of commitPreCheck / commitPostCheck replaces the judgment at the fixed
    // point WITHOUT touching the registry — engine-internal variants never do.
    this.hooks.hook("commit:enter", (hookCtx) => this.commitPreCheck(hookCtx));
    this.hooks.hook("commit:exit", (hookCtx) => this.commitPostCheck(hookCtx));
  }

  /** injected engine context — subclasses may replace it via the protected setter; the base reads
   * it for the gate judgments */
  get ctx(): DispatchContext {
    return this.#ctx;
  }
  protected set ctx(value: DispatchContext) {
    this.#ctx = value;
  }

  /** template-step execution order of the last run(): phase boundaries (PhaseId) + hook step names */
  get timeline(): readonly string[] {
    return [...this.#timeline];
  }

  // ── Template method (模板方法): pre-flight → dispatch → post-flight skeleton ─────────────
  // The fixed hookable points (dispatch:before / commit:enter / commit:exit / dispatch:after) fire
  // around the template steps; the timeline records only template steps and phase boundaries (the
  // hookable-point order is Task 6's dispatch.sequence seam).
  async run(): Promise<void> {
    this.#timeline = [];
    const hookCtx: DispatchHookContext = { mode: this.ctx.mode, meta: {} };
    await this.hooks.callHook("dispatch:before", hookCtx);
    try {
      this.#phase("pre-flight");
      this.#step("commitPreCheck"); // entry gate — mounted at commit:enter (default constructor mount)
      await this.hooks.callHook("commit:enter", hookCtx);
      this.#step("resolveContext");
      await this.resolveContext(hookCtx);
      this.#step("validateMode");
      await this.validateMode(hookCtx);
      this.#step("docContractValidate"); // doc-contract gate (Task 29): plan + spec + parent overall contract check
      await this.docContractValidate(hookCtx);
      this.#phase("dispatch"); // dispatch phase — the only agent-semantics step is the abstract virtual method
      await this.dispatch(hookCtx);
      this.#phase("post-flight");
      this.#step("schemaValidate");
      await this.schemaValidate(hookCtx);
      this.#step("normalizeResult");
      await this.normalizeResult(hookCtx);
      this.#step("settleResidue"); // residue settlement — before the exit gate
      await this.settleResidue(hookCtx);
      this.#step("writeBoundary"); // changed-surface reconcile — after materialization, before the exit gate
      await this.writeBoundary(hookCtx);
      this.#step("commitPostCheck"); // exit gate — mounted at commit:exit (default constructor mount)
      await this.hooks.callHook("commit:exit", hookCtx);
      this.#step("statusValidate"); // status reconcile (Task 29): six-state + plan verdict after the exit gate
      await this.statusValidate(hookCtx);
    } finally {
      await this.hooks.callHook("dispatch:after", hookCtx);
    }
  }

  // ── Default hook implementations — a subclass overrides only the hooks it cares about ─────

  /** Entry gate (入口门, pre-commit / pre-flight): clean-tree judgment (rules/commit.ts
   * entryGateCleanTree). dirty → DispatchBlocked(gate="entry"); run aborts in pre-flight and
   * dispatch is never entered. dry-run downgrade (E2②): dirty + ctx.dryRun → the judgment
   * returns a warn instead of the BLOCKED signal — the warning is printed as a stderr CDD_WARN
   * and the simulation runs to completion (a zero-side-effect dry run cannot be corrupted by
   * uncommitted changes; the gate is downgraded, never skipped). */
  protected async commitPreCheck(_hookCtx: DispatchHookContext): Promise<void> {
    const result = await entryGateCleanTree(this.ctx.repoRoot, {
      dryRun: this.ctx.dryRun === true,
    });
    if (result.warn) {
      process.stderr.write(`CDD_WARN: ${result.warn}\n`);
    }
    if (!result.ok) throw new DispatchBlocked(result.blocker, "entry");
  }

  /** Context readiness (pre-flight): default — the constructor-injected ctx is authoritative
   * (single root); task.ts / docs.ts override for the --plan → workspace → ctx derivation
   * (spec step 2). */
  protected async resolveContext(_hookCtx: DispatchHookContext): Promise<void> {}

  /** Mode validation (pre-flight): default pass-through — the base does not judge the legal mode
   * set (the docs variant has its own); task.ts / docs.ts own the mode policy (spec step 6). */
  protected async validateMode(_hookCtx: DispatchHookContext): Promise<void> {}

  /** Lane-declared doc-audit target (Task 3 ④「lane 声明审计对象」): the dispatch's doc-chain
   * entry point the doc-contract gate audits. task/branch = the dispatch plan path; docs = the
   * reviewed doc path. null → the lane waived the audit (the gate is a no-op — the base's
   * fail-open default). Resolution happens inside the hook (the target may derive from state the
   * resolveContext step just produced). */
  protected docAuditTarget(): string | null {
    return null;
  }

  /** The dispatched round's plan path (the plan-bearing declaration, P2 T4): task/branch lanes
   * declare their dispatch plan; docs / lane-less rounds return null. The closeout terminal-debt
   * hard gate and the status reconcile key off this — null means the engine terminal-state
   * declaration source is absent (docs channel), so the terminal-debt member no-ops there
   * (absent-source semantic, NOT an exemption constant — a branch or task round is never exempt)
   * and the backfill edit path always passes the debt face. */
  protected dispatchPlanPath(): string | null {
    return null;
  }

  /** Doc-Contract validation (pre-flight, after resolveContext + validateMode, before dispatch —
   * the Task 29 docContractValidate template step, now the BASE default hook shared by every
   * dispatch channel): resolves the dispatch's doc chain from the lane-declared audit target, runs
   * the single closeout mismatch module (rules/closeout.ts — the structural audit + the
   * engine-terminal merge) and gates on BOTH surfaces — the structural face (any mismatch → the
   * round is blocked before the agent ever runs — exit 1 + the guidance on stderr; the 0/1/2/3 exit
   * table unchanged) and the terminal-debt face (P2 T4 v1.12: a plan-bearing round whose parent
   * overall has plan-complete-but-unbackfilled members is BLOCKED with the 先 backfill-overall
   * guidance — 回填 = branch-review 前置义务; the docs channel declares no plan workspace so the
   * member no-ops there). Dry-run runs the SAME check but lowers to the WARN lane (the E2②
   * entry-gate precedent: an invalid simulation still completes, never silent). Read-only: the
   * check never writes docs or carriers — an invalid round stays re-dispatchable the moment the
   * docs are repaired (no BLOCKED carrier to clear). The BLOCK face is docContractBlocked — the
   * default throws DispatchBlocked("entry") (runTask / runDocsTask already map that gate); the
   * task channel overrides with its non-throwing #done terminal, the branch channel with its
   * exitWithCode convention. */
  protected async docContractValidate(_hookCtx: DispatchHookContext): Promise<void> {
    const entry = this.docAuditTarget();
    if (!entry) return; // no lane-declared target → the gate is waived
    const root = typeof this.ctx.repoRoot === "string" ? this.ctx.repoRoot : "";
    if (!root) {
      process.stderr.write("CDD_WARN: doc contract validation skipped (no repo root)\n");
      return;
    }
    const dryRun = this.ctx.dryRun === true;
    let result: CloseoutResult;
    try {
      result = deriveCloseoutMismatches({ entry, root });
    } catch (e) {
      // fail-open: an unreadable doc chain must never crash the lifecycle (the plan existence
      // gate in resolveContext already surfaced the missing-plan case there) — but never silent:
      // surface a one-line diagnostic on the throw path (real and dry-run lanes alike).
      process.stderr.write(
        `CDD_WARN: doc contract validation skipped (unreadable doc chain): ${(e as Error).message}\n`,
      );
      return;
    }
    // Terminal-debt surface — plan-bearing rounds only (dispatchPlanPath non-null). The docs
    // channel's plan workspace is absent → the member no-ops (absent-source semantic, not an
    // exemption constant) and the backfill edit path always passes this face.
    const debtActive = this.dispatchPlanPath() !== null && result.terminalDebt.length > 0;
    if (dryRun) {
      if (result.structural.length > 0) {
        process.stderr.write(
          `CDD_WARN: doc contract invalid (dry-run) — fix the docs below, then re-dispatch:\n${formatDocFailures(result.structural)}\n`,
        );
      }
      if (debtActive) {
        process.stderr.write(
          `CDD_WARN: closeout terminal debt (dry-run) — backfill the parent overall first:\n${formatCloseoutDebtFailures(result.terminalDebt, result.overallPath ?? entry)}\n`,
        );
      }
      return;
    }
    if (result.structural.length === 0 && !debtActive) return;
    const guidance: string[] = [];
    if (result.structural.length > 0) guidance.push(formatDocFailures(result.structural));
    if (debtActive)
      guidance.push(formatCloseoutDebtFailures(result.terminalDebt, result.overallPath ?? entry));
    this.docContractBlocked(guidance.join("\n"));
  }

  /** The doc-contract BLOCK terminal face — default throws DispatchBlocked(gate "entry") (the
   * task/docs runners map that gate to CDD_BLOCKED + exit 1). Subclasses with a non-throwing
   * terminal (#done-family / exitWithCode) override this ONE seam; the judgment above stays the
   * shared base default for all channels. */
  protected docContractBlocked(guidance: string): void {
    throw new DispatchBlocked(
      `doc contract validation failed — fix the docs below:\n${guidance}`,
      "entry",
    );
  }

  /** Status reconcile / closeout highlight (post-flight, after the exit gate — the Task 29
   * statusValidate template step, raised to the BASE default so every plan-bearing lane shares one
   * implementation; task.ts's former per-lane override is retired): reports each plan task's
   * six-state line + the plan completion verdict as CDD_INFO, then — when the plan is complete AND
   * the single closeout module still infers terminal debt (P2 T4 v1.12) — prints a stdout highlight
   * with the next backfill step (the trigger window = plan-done up to the orchestration's
   * backfill-overall; exit unchanged — informational). Plan-less lanes (docs — no declared plan
   * workspace) no-op: the engine terminal-state source is absent there. Fail-open on unreadable
   * progress/plan, and deliberately runs without the #finished guard: the round just ended and its
   * resulting state is precisely what the report describes; the walk has already passed every exit
   * gate, so this step is never exit-changing. */
  protected async statusValidate(_hookCtx: DispatchHookContext): Promise<void> {
    const plan = this.dispatchPlanPath();
    if (!plan) return; // no plan context (docs / lane-less) → nothing to reconcile
    const root = typeof this.ctx.repoRoot === "string" ? this.ctx.repoRoot : "";
    if (!root) return;
    try {
      const workspace = resolveWorkspace(plan, root);
      // The progress-tracking iteration follows the SINGLE effectiveGroups derivation — per declared
      // group (empty default: each task its own singleton group → the six-state lines are
      // byte-identical to the pre-P4.3 per-task iteration); the verdict shares the same group
      // surface — isomorphic iteration, one derivation, no second implementation (§2.2, P4.3 Task 3).
      const groups = effectiveGroups(plan);
      const verdict = derivePlanVerdict(plan, workspace, taskNumbersFromPlan, effectiveGroups);
      for (const group of groups) {
        for (const n of group) {
          process.stderr.write(
            `CDD_INFO: ${formatTaskStateLine(n, deriveTaskState(workspace, n, groups))}\n`,
          );
        }
      }
      process.stderr.write(`CDD_INFO: ${formatPlanVerdict(verdict)}\n`);
      if (verdict.done) {
        const { terminalDebt, overallPath } = deriveCloseoutMismatches({ entry: plan, root });
        if (terminalDebt.length > 0 && overallPath) {
          process.stdout.write(`${formatCloseoutDebtHighlight(terminalDebt, overallPath)}\n`);
        }
      }
    } catch {
      // fail-open: no report when progress/plan cannot be read
    }
  }

  /** dispatch phase — the only agent-semantics black box (spec §2.12): abstract virtual method,
   * concrete subclasses MUST provide an implementation (TS virtual-method compile-time constraint). */
  protected abstract dispatch(hookCtx: DispatchHookContext): Promise<void>;

  /** Handoff schema validation (post-flight): default fail-open (the base has no handoff
   * contract); subclasses carrying a handoff override it (rules/schema.mjs validateHandoffSchema). */
  protected async schemaValidate(_hookCtx: DispatchHookContext): Promise<void> {}

  /** Result normalization (post-flight): default pass-through; subclasses produce the exit code /
   * return block surface. */
  protected async normalizeResult(_hookCtx: DispatchHookContext): Promise<void> {}

  /** Residue settlement (post-flight, before the exit gate): a failed round's recovery carrier —
   * an eligible cause (EXECUTION_FAILURE / TIMEOUT — artifacts/residue.ts single eligibility set) with
   * a dirty tree — gets its WIP auto-preserved (`git stash push -u`) and the carrier gains
   * residue_ref / stash_message / residue_scope / wip_stat / preserved (facts in the carrier, prose
   * stays in the blocker). T28 (spec T7.7): the step now goes through the settleFromCarrier adapter
   * (save family single owner = artifacts/residue.ts) — ONE standardized stash message contract
   * with the task lane; the preserved guard there makes coexisting lanes a no-op, never a double
   * stash. Runs AFTER the failure lanes' #done returned — the terminal decision already happened,
   * settlement is the last archival act before the exit gate. Success / no-recovery rounds → no-op;
   * CONTRACT_VIOLATION-class causes are deliberately not auto-swallowed. The branch channel aborts
   * via ExitRequested and calls preserveAndAnnounceResidue inline (dispatch/branch.ts) — the
   * template step is the task/docs path. Dry-run skip: a pure simulation must not mutate the git
   * object store. */
  protected async settleResidue(_hookCtx: DispatchHookContext): Promise<void> {
    if (this.ctx.dryRun === true) return; // dry-run: zero archive side effects
    if (!this.ctx.handoffPath) return;
    await preserveAndAnnounceResidue(
      this.ctx.repoRoot ?? "",
      this.ctx.handoffPath,
      this.ctx.repoRoot,
    );
  }

  /** Changed-surface reconciliation (writeBoundary, post-flight, before the exit gate): for
   * implement/fix rounds the round's `git diff <base>..HEAD` fileset is reconciled against the
   * handoff `changes[]` ledger — pure-soft accounting (2026-09-20 ruling): gaps are a stderr
   * CDD_WARN + a notes record, NEVER a block (the review scope axis judges). implement rounds
   * record the diff fileset as the ledger origin. review / no-handoff / unknown-base rounds skip
   * (the rules layer's own fail-open). Positioned after the failure lanes and after the implement
   * handoff materialization (normalizeResult) — the reconcile sees the final carrier. */
  protected async writeBoundary(_hookCtx: DispatchHookContext): Promise<void> {
    if (this.ctx.dryRun === true) return;
    if (!this.ctx.handoffPath) return;
    await reconcileChangedSurface(this.ctx.mode, this.ctx.repoRoot, this.ctx.handoffPath);
  }

  /** Exit gate (出口门, post-commit / post-flight): validateCommitContract (rules/commit.ts) —
   * dirty → DispatchBlocked(gate="exit"); the handoff rewrite already happened in the rules layer.
   * E2②/G4① (P6 T10): dry-run skips the exit-gate judgment entirely — a dry run does no agent
   * writes or commits, so its return-time tree state equals the entry state already downgraded to
   * a stderr CDD_WARN at the pre-flight gate; the return-time-dirty BLOCKED semantic (commit
   * contract) is real-dispatch-only. task.ts / docs.ts reach the same skip via #finished; the base
   * default makes the skip explicit (the base remains the single inherited point). */
  protected async commitPostCheck(_hookCtx: DispatchHookContext): Promise<void> {
    if (this.ctx.dryRun === true) return; // dry-run: no commit contract to validate (pure simulation)
    const result = await validateCommitContract(this.ctx.mode, this.ctx.repoRoot, {
      handoffPath: this.ctx.handoffPath,
    });
    if (!result.ok) throw new DispatchBlocked(result.blocker, "exit");
  }

  #phase(id: PhaseId): void {
    this.#timeline.push(id);
  }
  #step(name: string): void {
    this.#timeline.push(name);
  }
}
