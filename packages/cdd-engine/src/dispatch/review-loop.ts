import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

// engine/src/dispatch/review-loop.ts (ex lib/runner/review-loop.mjs) — shared review→fix loop (CDD + docs).
// runReviewLoop → Promise<handoff>
// runFix(round, findings) → Promise<handoff>
// getBlockers(handoff) → finding[]
// onRoundDone(round, findings) → void (optional)

// Wiring model:
// - CDD orchestrator (AI following CDD SKILL.md): calls `cdd review --type task`
//   then `cdd fix --type task` directly, following the Review Convergence digraph.
//   runReviewLoop is available for test harnesses and future CLI wrappers.
// - Docs orchestrator (AI following brainstorming/writing-plans SKILL.md): calls
//   `cdd review --type spec|plan` then `cdd fix --type spec|plan`.
// Production wiring is via the AI orchestrator making tool calls, not via Node imports.
// This module provides: (a) a testable reference implementation, (b) a shared abstraction
//   for future cdd-run-review.mjs / docs-run-review.mjs CLI wrappers.

// T9 branch nit④: round-pattern derivation was moved to handoff-naming (production now routes
// solely through `handoff-naming.roundPattern/resolveNextRound`; the thin
// reviewRoundPattern/resolveNextRound delegates are deleted — no second naming surface).

// Review Convergence error single point (per-reason messages, §2.5 item 7/8):
// - "legacy" — pre-existing handoff without doc_hash: content state unknown → conservative
//   hard stop, no "edit the doc" guidance (unreachable).
// - "unchanged" — same path + same doc_hash: content unchanged → same ref, suggest editing
//   the content or opening a new doc.
// - default — no content-dimension context (task/branch-family call surfaces): keep the
//   current message unchanged.
// Keep the `/blocker=0/` prefix + `Review Convergence:` invariant (existing assertions depend on it).
export function reviewConvergedError(
  type: string,
  round: number,
  ref: string,
  { reason }: { reason?: "legacy" | "unchanged" } = {},
): Error {
  const prev = Math.max(round - 1, 1);
  const tail = reason === "legacy"
    ? `Review Convergence: do not re-run — pre-content-hash review handoff (no doc_hash) at round ${prev}; content state unknown: open a new doc or remove the stale round-${prev} review handoff to re-review`
    : reason === "unchanged"
      ? `Review Convergence: do not re-run — doc content unchanged since round ${prev} clean review: edit the doc content or open a new doc to start a new review`
      : "Review Convergence: do not re-run; change ref to open a new review";
  return new Error(`round ${round} (${type}, ${ref}) already blocker=0 — ${tail}`);
}

// Content-state token (§2.1/§2.3.1): full-byte sha256 hex of the reviewed document.
// Scale choice (§2.2 bullet 1): no normalization — whitespace / line-ending drift opens one
// new round; a single review dispatch per round is a benign cost.
// Missing/unreadable → "" sentinel (never equal to a real hex): the gate passes on "ref
// changed" and the downstream runDocsTask fails naturally on the ghost doc.
export function hashFile(doc: string): string {
  try {
    return createHash("sha256").update(readFileSync(doc)).digest("hex");
  } catch {
    return "";
  }
}

export interface ReviewHandoff {
  findings?: Array<{ severity?: string }>;
}

export type BlockingFinding = { severity?: string };

export interface ReviewLoopHooks {
  runReview: (round: number) => Promise<ReviewHandoff>;
  runFix: (round: number, findings: BlockingFinding[]) => Promise<unknown>;
  getBlockers: (handoff: ReviewHandoff) => BlockingFinding[];
  onRoundDone?: (round: number, findings: Array<unknown>) => void;
}

export async function runReviewLoop({ runReview, runFix, getBlockers, onRoundDone }: ReviewLoopHooks): Promise<void> {
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