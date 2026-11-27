// packages/cdd-engine/src/run/advance/line-rows.ts
// The line leg's DOC rows: a line holding no dispatchable round names WHY, and a line sitting
// at another phase names the round it actually owes.
//
// INVARIANT — two rows, two questions, one shape:
//   · ELSEWHERE — the request asks for a verb the line is not at, and the line's document moved
//     past the version its review bound. The row is not a closure (the line is not closed) and
//     not a drift table of its own: it prints the frontier hop's own reason and, when that
//     reason names a movement, the hop target's diagnosis — the SAME two cells the drift station
//     reads, from the SAME read. A line refuted here owes the round the hop names, so a caller
//     that took the closure row instead would be told "nothing here" about work that is owed.
//   · CLOSED — the line's rounds lie on the closure side with nothing owed: `unchanged` for a
//     document shape whose reviewed version is still the document's (the anti-spin row: the
//     requested round would re-judge bytes a review already judged), `face-closed` for every
//     other line (a branch, a wave, or a document no review ever bound).
//
// Both rows are VALUES: the tokens and the diagnosis are data, the sentence belongs to the
// render face, and the hop is the pipeline's own object — so a refusal and the board's `next:`
// can never name two rounds.
//
// Module-level exports are types and the class — zero behaviour-carrying bare functions.

import type { DriftStation, LineRowRefusal } from "./drift-station.ts";
import type { LinePhase } from "./line-phase.ts";
import { DISPATCH_REASON, type NextHop } from "./next.ts";
import { TargetFaces, type TargetType } from "./target-faces.ts";

/** What a row reads: the request's own line identity (the ledger key, the judged document and
 *  the target type, all already spelled by the frame's assembly). */
export interface LineRowRequest {
  readonly type: TargetType;
  readonly key: string;
  readonly doc: string | null;
}

/**
 * LineRows — the line leg's two document rows. Invariant: one call answers one row, and each
 * row follows its own two facts alone (see the file's header).
 */
export class LineRows {
  readonly #lines: LinePhase;
  readonly #drifts: DriftStation;

  constructor(opts: { readonly lines: LinePhase; readonly drifts: DriftStation }) {
    this.#lines = opts.lines;
    this.#drifts = opts.drifts;
  }

  /** The row a line that moved owes a verb it is not at — the frontier hop's reason plus the
   *  hop target's diagnosis. `hop` is the pipeline's own object (the very one the outcome and
   *  the board render); when a caller wired none, the row keeps the declared closure token
   *  rather than inventing a reason. */
  elsewhereOf(hop: NextHop | null): LineRowRefusal {
    const drift = hop === null ? null : this.#drifts.diagnosisOf(hop);
    return {
      ok: false,
      leg: "line",
      reason: hop === null ? DISPATCH_REASON.closedLine.token : hop.reason,
      ...(drift === null ? {} : { drift }),
    };
  }

  /** The row a closed line owes: `unchanged` when the requested face is a document shape whose
   *  reviewed version is still the document's, `face-closed` otherwise. */
  closedOf(request: LineRowRequest): LineRowRefusal {
    const unchanged =
      TargetFaces.isDocShape(request.type) && this.#lines.unchangedAt(request.key, request.doc);
    return {
      ok: false,
      leg: "line",
      reason: unchanged ? DISPATCH_REASON.unchanged.token : DISPATCH_REASON.faceClosed.token,
    };
  }
}
