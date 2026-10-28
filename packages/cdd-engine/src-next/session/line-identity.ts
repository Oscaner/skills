// packages/cdd-engine/src-next/session/line-identity.ts
// T3 — LineIdentity: the ONE drift judgment of the three line kinds (P21 §4.1).
// Today's session carried two parallel comparisons (the doc line's doc-revision and
// the wave line's brief-revision); the branch line had none at all. This class is the
// single identity face all three read:
//   · spec / plan — the document's `doc-revision` (a hash of the whole content);
//   · wave        — the RENDERED brief's `brief-revision` (its task sections plus the
//                   plan's `## Constraints` — a plan edit elsewhere is not a drift);
//   · branch      — its plan document's `doc-revision` (the SAME kind, no new ref
//                   kind, no commit sha — the ledger keeps no second code identity).
//
// The judgment is deliberately two-valued + unknown: `same` (the recorded identity
// still describes the current input), `drift` (the input moved past it — the line
// reopens), `null` (no recorded identity, or an unreadable input — only PRESENT facts
// land a judgment, and a line with no record keeps the legacy closed face). The
// same-ref predicate itself stays where it already lived (`ReviewRefs.sameRef`,
// injected) so the identity kind comparison has exactly one definition.
//
// Module-level exports are types / the class — zero behavior-carrying bare functions.

import type { ReviewedRevisionRef, ReviewRefs } from "./ledger.ts";

/** The current revision of one line's judgment input. */
export interface CurrentRevision {
  /** The identity read NOW (doc content / rendered brief / plan document). */
  readonly ref: ReviewedRevisionRef;
}

/** The drift verdict — `same` / `drift` / `null` (no record or an unreadable input). */
export type LineDriftVerdict = "same" | "drift" | null;

/** LineIdentity — the one drift judgment of the three line kinds. */
export class LineIdentity {
  /** The same-ref predicate's home (`ReviewRefs`) — injected, never re-declared. */
  readonly #refs: ReviewRefs;

  constructor(refs: ReviewRefs) {
    this.#refs = refs;
  }

  /** Judge a line: the recorded reviewed identity against the current input. */
  verdict(recorded: ReviewedRevisionRef | null, current: CurrentRevision | null): LineDriftVerdict {
    if (recorded === null || current === null) return null;
    return this.#refs.sameRef(recorded, current.ref) ? "same" : "drift";
  }
}
