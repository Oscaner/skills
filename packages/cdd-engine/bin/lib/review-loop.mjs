// engine/lib/review-loop.mjs — shared review→fix loop (CDD + docs).
// runReviewLoop → Promise<handoff>
// runFix(round, findings) → Promise<handoff>
// getBlockers(handoff) → finding[]
// onRoundDone(round, findings) → void (optional)

// Wiring model:
// - CDD orchestrator (AI following CDD SKILL.md): calls `cdd review --type task`
//   then `cdd fix --type task` directly, following the Review Stopping digraph.
//   runReviewLoop is available for test harnesses and future CLI wrappers.
// - Docs orchestrator (AI following brainstorming/writing-plans SKILL.md): calls
//   `cdd review --type spec|plan` then `cdd fix --type spec|plan`.
// Production wiring is via the AI orchestrator making tool calls, not via Node imports.
// This module provides: (a) a testable reference implementation, (b) a shared abstraction
//   for future cdd-run-review.mjs / docs-run-review.mjs CLI wrappers.

// T9 branch nit④: round-pattern 派生已移交 handoff-naming（T3 后生产统一走
// `handoff-naming.roundPattern/resolveNextRound`；reviewRoundPattern/resolveNextRound
// 薄委托已删 — 不再保留第二命名面）。

export function reviewStoppedError(type, round, ref) {
  return new Error(
    `round ${round} (${type}, ${ref}) already blocker=0 — Review Stopping: do not re-run; change ref to open a new review`,
  );
}

export async function runReviewLoop({ runReview, runFix, getBlockers, onRoundDone }) {
  let round = 1;
  while (true) {
    const reviewHandoff = await runReview(round);
    const blockers = getBlockers(reviewHandoff);
    await runFix(round, reviewHandoff.findings ?? []);
    if (blockers.length === 0) {
      onRoundDone?.(round, reviewHandoff.findings ?? []);
      break;
    }
    round++;
  }
}
