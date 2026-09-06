// engine/lib/review-loop.mjs — shared review→fix loop (CDD + docs).
// runReview(round) → Promise<handoff>
// runFix(round, findings) → Promise<handoff>
// getBlockers(handoff) → finding[]
// onRoundDone(round, findings) → void (optional)

// Wiring model:
// - CDD orchestrator (AI following CDD SKILL.md): calls cdd-task.mjs --mode task-review
//   then cdd-task.mjs --mode fix directly, following the Review Stopping digraph.
//   runReviewLoop is available for test harnesses and future CLI wrappers.
// - Docs orchestrator (AI following brainstorming/writing-plans SKILL.md): calls
//   docs-task.mjs --mode review then docs-task.mjs --mode fix.
// Production wiring is via the AI orchestrator making tool calls, not via Node imports.
// This module provides: (a) a testable reference implementation, (b) a shared abstraction
//   for future cdd-run-review.mjs / docs-run-review.mjs CLI wrappers.

import { readdirSync } from "node:fs";

// Round helpers — type-aware naming pattern so each artifact type keeps its own
// monotonically increasing round sequence:
//   spec / plan : `<workspace>/<type>-<round>.json` (AC15: spec-1.json, spec-2.json)
//   task         : `<workspace>/task-<taskN>-task-review-<round>.json` (the runner's
//                  existing round naming; task-N-handoff.json is untouched)
//   branch       : `<workspace>/branch-review-<base7>..<head7>-r<round>.json` (branch-review naming)
export function reviewRoundPattern(type, opts = {}) {
  if (type === "task") return new RegExp(`^task-${opts.task}-task-review-(\\d+)\\.json$`);
  if (type === "branch") return /^branch-review-.*-r(\d+)\.json$/;
  return new RegExp(`^${type}-(\\d+)\\.json$`);
}

export function resolveNextRound(workspace, type, opts = {}) {
  let max = 0;
  try {
    for (const f of readdirSync(workspace)) {
      const m = f.match(reviewRoundPattern(type, opts));
      if (m) max = Math.max(max, Number(m[1]));
    }
  } catch { /* workspace missing → round 1 */ }
  return max + 1;
}

// Review Stopping: a second dispatch for the same (type, ref) after its previous
// round reached blocker=0 is rejected. ref is the review target signature
// (e.g. base..head or a doc path) so the engine can tell whether the target changed.
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
