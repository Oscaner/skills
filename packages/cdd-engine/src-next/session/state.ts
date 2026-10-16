// packages/cdd-engine/src-next/session/state.ts
// T6 — the execution-state query surface (design spec §3.1): the frontier dynamic
// face + the ExecutionState query surface. Both are contracts the run carrier
// implements — TaskGraph today, the round ledger's ProgressLedger later — and the
// query methods (doneTasks() / readyBatch()) are METHODS on the carrier, never
// standalone state classes. Module-level exports are interfaces only — zero
// behavior-carrying bare functions (the plan's zero-bare-function discipline).

/**
 * The frontier contract — the pure dynamic readiness face of a task run: given
 * the set of completed task ids, which tasks are ready to execute next.
 */
export interface Frontier {
  /** The ready task ids — every not-yet-done task whose declared dependencies are
   *  all done, in ascending id order. */
  frontier(done: ReadonlySet<number>): readonly number[];
}

/**
 * The execution-state query surface — a carrier's projection of the running
 * session. Implemented as methods on TaskGraph (this task) / ProgressLedger (the
 * round ledger), never a separate state class.
 */
export interface ExecutionState {
  /** The completed task ids — a snapshot copy, never a live handle into the run state. */
  doneTasks(): Set<number>;
  /** The current ready batch — the not-yet-done tasks whose dependencies are all
   *  done, in ascending id order (the frontier over the carrier's done set). */
  readyBatch(): number[];
}
