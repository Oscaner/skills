// engine/lib/review-loop.mjs — shared review→fix loop (CDD + docs).
// runReview(round) → Promise<handoff>
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

import { readdirSync } from "node:fs";
import { roundPattern, resolveNextRound as hnResolveNextRound } from "./handoff-naming.mjs";

// Round helpers — T3 后命名单一真相移交 handoff-naming（canonical handoff-namespace.json）。
// 本模块仅保留 runReviewLoop（URC 引用实现）；round 模式委托给 handoff-naming.roundPattern —
// 不再有第二处命名字面量（task 分支统一 task-{N}-review-{R} 命名）。
export function reviewRoundPattern(type, opts = {}) {
  if (type === "task" && opts.task == null) return /$^/; // 两参形式（无 task）不得造幻影模式
  return roundPattern("review", type, opts);
}

export function resolveNextRound(workspace, type, opts = {}) {
  return hnResolveNextRound(workspace, "review", type, opts);
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
