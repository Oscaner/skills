// packages/cdd-engine/src/rules/ref-sequence.ts — the fix face's C5-1 soft-cap judgment basis (the
// 'ref-sequence round counting' rule): a workspace walk of the review-round sequence anchored at the
// fix round's `--findings` source handoff, feeding the shared pure leading-run count
// (rules/next-step.ts consecutiveS1Count) — newest round first. Kept apart from rules/next-step.ts
// so the pure decision table stays I/O-free (C5-2 "pure read" face); this module is the
// dispatch-side bridge that feeds next-step's `softCap` flag (the fix faces compare its result
// against SOFT_CAP_S1_ROUNDS; the count itself is never a caller-authored literal). The walk is
// I/O only (collect the walked review-round findings newest-first), the counting judgment lives in
// the one shared basis.
//
// Fail-open discipline (same as #inputFindings / ConvergenceChecker blockerCount): a missing,
// unreadable or non-matching round degrades the count to the conservative baseline — never a throw.
import path from "node:path";
import { handoffName, roundPattern } from "../artifacts/handoff/naming.ts";
import { readJson } from "../artifacts/handoff/write.ts";
import { consecutiveS1Count } from "./next-step.ts";

export interface RefSeqSource {
  /** review-family type the source handoff belongs to (task | spec | plan). */
  type: string;
  /** the source review handoff path (the fix round's `--findings`) — its round R anchors the walk. */
  sourcePath: string;
  /** task-family group key pin (REQUIRED for type=task — the `{tasks}` name segment must be pinned
   *  to construct the family's round files; an unpinned task walk degrades to 0). The pin also
   *  isolates this group's rounds: a cross-group missing round must not end the run early, and a
   *  cross-group round must not extend it. */
  tasks?: string;
}

/** maxConsecutiveS1Rounds(src) → the consecutive-S1 run length ENDING at the source review round.
 *  Walk: R (the source) → R-1 → … → 1, reading the family's canonical `{type}-review-{round}.json`
 *  files newest-first into the walked sequence; the run stops at the first round without a blocker
 *  finding (or missing/unreadable). The leading-run count is the shared pure basis of
 *  rules/next-step.ts (consecutiveS1Count over the collected findings — the walk feeds it, it never
 *  maintains a second counting loop). 0 when the source file name does not match the family (round
 *  underivable) or the source has no blockers. Non-array `findings` in a round (a documented
 *  agent-written shape) reads as no blockers — guarded the same way as the task fix face's
 *  #inputFindings. */
export function maxConsecutiveS1Rounds(src: RefSeqSource): number {
  const pin = src.tasks ? { tasks: src.tasks } : {};
  const re = roundPattern("review", src.type, pin);
  const m = path.basename(src.sourcePath).match(re);
  if (!m) return 0;
  const roundR = Number(m[1]);
  if (!Number.isInteger(roundR) || roundR < 1) return 0;
  const dir = path.dirname(src.sourcePath);
  const seq: Array<Array<{ severity?: string }> | null> = [];
  for (let k = roundR; k >= 1; k -= 1) {
    const candidate = path.join(dir, handoffName("review", src.type, { ...pin, round: k }));
    const h = readJson(candidate) as { findings?: Array<{ severity?: string }> } | null;
    // Array guard (repo doctrine): an agent-written non-array `findings` reads as zero blockers.
    // null/absence ends the walked sequence (consecutiveS1Count's fail-open lane — the count can
    // never extend across a hole).
    seq.push(h ? (Array.isArray(h.findings) ? h.findings : []) : null);
  }
  return consecutiveS1Count(seq);
}
