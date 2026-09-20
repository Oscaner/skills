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
import { createDispatchHooks, type DispatchHookContext, type DispatchHooks } from "./hooks.ts";
import type { PhaseId } from "./phases.ts";
import { entryGateCleanTree, validateCommitContract } from "../rules/commit.ts";
import { preserveAndAnnounceResidue } from "../artifacts/residue.ts";
import { reconcileChangedSurface } from "../rules/write-boundary.ts";
import { CddExitError } from "../infra/exit.ts";

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
    await preserveAndAnnounceResidue(this.ctx.repoRoot ?? "", this.ctx.handoffPath, this.ctx.repoRoot);
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
