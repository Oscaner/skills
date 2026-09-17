// packages/cdd-engine/src/rules/stopping.ts — Review Stopping guard cluster (Task 5 rules-layer
// rebuild; ex the cluster that cli/shared.mjs hosted). Self-contained per the closure-completeness
// ownership rule: reviewStoppingGuard calls stoppedExit3 + blockerCount + reviewStoppedError, so
// all four move together (no rules → dispatch cli reverse dependency).
// Semantics (SP-4): only a previous round that reached APPROVED with blocker=0 stops a re-dispatch;
// a failure round (BLOCKED/TIMEOUT, often written with findings:[]) must stay re-dispatchable —
// the gate requires status === "APPROVED" in addition to blockerCount === 0.
// B3: ENGINE_SELF_WRITTEN / CONTRACT_VIOLATION = the dispatch did not complete → not a Stopping
// basis (「计入 Review Stopping = no」). The judgment derives from the canonical
// (isIncompleteDispatch), never a hand-written category name — a canonically deleted category
// turns this reference red.
import { exitWithCode } from "../infra/exit.ts";
import { isIncompleteDispatch } from "./failure.ts";

export interface HandoffLike {
  status?: string;
  findings?: Array<{ severity?: string }>;
  blocker?: string;
  failure_category?: string;
}

export function blockerCount(handoff: HandoffLike | null | undefined): number {
  return (handoff?.findings ?? []).filter((f) => f?.severity === "blocker").length;
}

// Review Stopping error single point (reason-scoped messages, spec §2.5 item 7/8):
// - "legacy" — pre-content-hash review handoff: content state unknown → hard stop, no edit-guide
//   (unreachable in practice).
// - "unchanged" — same path + same doc_hash: content unchanged → same ref, edit content or open
//   a new doc.
// - default — no content-dimension context (task/branch family): current wording unchanged.
// Keeps the `/blocker=0/` prefix + `Review Stopping:` invariant (existing assertions depend on it).
export function reviewStoppedError(
  type: string,
  round: number,
  ref: string,
  opts: { reason?: string } = {},
): Error {
  const prev = Math.max(round - 1, 1);
  const tail =
    opts.reason === "legacy"
      ? `Review Stopping: do not re-run — pre-content-hash review handoff (no doc_hash) at round ${prev}; content state unknown: open a new doc or remove the stale round-${prev} review handoff to re-review`
      : opts.reason === "unchanged"
        ? `Review Stopping: do not re-run — doc content unchanged since round ${prev} clean review: edit the doc content or open a new doc to start a new review`
        : "Review Stopping: do not re-run; change ref to open a new review";
  return new Error(`round ${round} (${type}, ${ref}) already blocker=0 — ${tail}`);
}

// stoppedExit3: structured error + message are the single authority; stderr prints the message
// (and the last blocker when present), then exits 3 via the unified exit point (throws).
export function stoppedExit3(
  type: string,
  round: number,
  ref: string,
  blocker: string | null | undefined,
  opts?: { reason?: string },
): never {
  const e = reviewStoppedError(type, round, ref, opts);
  process.stderr.write(`${e.message}\n` + (blocker ? `last blocker: ${blocker}\n` : ""));
  exitWithCode(3);
}

// Unified Stopping gate: only APPROVED + blocker=0 stops a re-run; a BLOCKED/TIMEOUT failure
// round (findings:[]) must stay re-dispatchable (SP-4). ref is the type's target signature.
// opts passes the reviewStoppedError reason (legacy/unchanged) — task/branch call sites pass no
// opts → default wording unchanged. prev null/undefined → no stop (first dispatch).
export function reviewStoppingGuard(
  prev: HandoffLike | null | undefined,
  type: string,
  round: number,
  ref: string,
  opts?: { reason?: string },
): void {
  const incomplete = isIncompleteDispatch(prev?.failure_category);
  if (!incomplete && prev && prev.status === "APPROVED" && blockerCount(prev) === 0) {
    stoppedExit3(type, round, ref, prev?.blocker, opts);
  }
}