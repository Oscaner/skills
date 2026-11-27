// packages/cdd-engine/src/run/advance/drift-station.ts
// The line leg's doc-drift rows: a document that moved past the version its review bound.
//
// INVARIANT — the drift refusal is ONE value with ONE diagnosis, and it names only facts this
// segment read: the layer the moved identity belongs to, its coordinate, and the two digest
// ends the review did and does judge. The row is the shipped authority's UPSTREAM station: a
// face ABOVE the request moved, so the work the request would do builds on bytes nobody
// reviewed. That precedence is the whole point — a split batch is what the wave gate would
// report, and it is not the actionable cause while a document above it is unreviewed.
//
// The station reads the LINE's facts, never a second walk: `enteredAt` decides whether a face
// was ever worked (an unentered face holds no station), and `driftPairOf` is the ONE drift read
// both this row and the pipeline's reopen share — a second comparison would let the board's
// `next:` and the refusal's diagnosis disagree about one document.
//
// THE CAUSE AND THE DIAGNOSIS ARE TWO CELLS. The CAUSE is the first face above the request
// that moved; the DIAGNOSIS is read off the hop the refusal's `next:` will print, exactly as
// the shipped composer reads it. They are not the same face: a request whose PLAN moved is
// refused by the plan face while the frontier's hop names the SPEC review, and printing that
// plan's digests beside a command naming the spec would diagnose one document and prescribe a
// round on another. A hop target holding no movement prints the bare token (no cells) — a
// diagnosis never invents a fact.
//
// Module-level exports are types and the class — zero behaviour-carrying bare functions.

import type { LinePhase } from "./line-phase.ts";
import {
  DISPATCH_REASON,
  type DispatchReason,
  type NextHop,
  type PhaseFaceKey,
  PIPELINE_FACES,
} from "./next.ts";
import type { PipelineInput } from "./pipeline.ts";
import type { TargetType } from "./target-faces.ts";

/** One document's movement, as a refusal prints it: the layer, the line's coordinate and the
 *  two digest ends. The prefix width is the render face's (the diagnosis is DATA here). */
export interface DriftDiagnosis {
  /** The layer the moved identity belongs to — a document (`brief` is the wave face's). */
  readonly layer: "doc";
  /** The moved document's coordinate, on the one repo-relative basis. */
  readonly line: string;
  /** The version the completed review bound. */
  readonly recorded: string;
  /** The version the document holds now. */
  readonly current: string;
}

/**
 * LineRowRefusal — the line leg's DOC rows: the drift station's `doc-drift`, the row a line
 * sitting at another phase owes, and the closure's own token. Invariant: the token names the
 * cause, and the diagnosis (when the token names a MOVEMENT) is the hop target's — absent,
 * never invented, when that target recorded none. A value, not a judgment: the producers in
 * this file and `line-rows.ts` build it, and nothing re-derives it.
 */
export interface LineRowRefusal {
  readonly ok: false;
  /** The line leg's discriminant — the wave gate's `open` cell is the other shape
   *  (`RouteRenderer#isLine` reads both). */
  readonly leg: "line";
  /** The ONE table's token — never a second spelling of the fact. */
  readonly reason: DispatchReason;
  /** The hop target's two digest ends; absent when that target moved nowhere (or the caller
   *  asked only whether a cause holds). */
  readonly drift?: DriftDiagnosis;
}

/** What one station read needs: the request's target type, its pipeline cells and the hop the
 *  refusal's `next:` will print. The frame assembly asks the cause alone (it has no hop yet),
 *  the dispatch entry hands both in — so the refusal's cause is one reading whichever face
 *  asks. */
export interface DriftRequest {
  readonly type: TargetType;
  readonly pipeline: PipelineInput;
  /** The hop the refusal prints; absent/null when the caller only asks whether a cause holds. */
  readonly hop?: NextHop | null;
}

/** One document face as a station reads it: the target type, the ledger key and the record. */
interface StationLine {
  readonly type: TargetType;
  readonly key: string;
  readonly doc: string;
}

/**
 * DriftStation — the doc-drift refusal producer. Invariant: the first face that MOVED owns the
 * refusal (upstream first, in the pipeline's own order), while the diagnosis it carries is the
 * HOP's own target (see the file's header) — so a cause and a prescription can never name two
 * different documents.
 *
 * Rule zero note: the class is two short rows over one line walk, so it holds no state beyond
 * that walk — the alternative (a caller composing "is the upstream drifted" itself) is the
 * second drift judgment this segment exists to prevent.
 */
export class DriftStation {
  readonly #lines: LinePhase;

  constructor(lines: LinePhase) {
    this.#lines = lines;
  }

  /** The refusal this request owes — the first UPSTREAM document face that moved past what
   *  its review bound, or null when every face above it is where its review left it. The faces
   *  above the request are the pipeline's own prefix, so the order here is the order the board
   *  walks, and a face the pipeline never entered reports nothing. It reads only the request's
   *  target type and its pipeline cells, so the frame assembly asks the same question about a
   *  CLOSED line it never assembled a round for. */
  refusalOf(request: DriftRequest): LineRowRefusal | null {
    const index = DriftStation.faceIndexOf(request.type);
    if (index <= 0) return null;
    for (const face of PIPELINE_FACES.slice(0, index)) {
      const line = DriftStation.stationOf(face, request.pipeline);
      if (line === null) continue;
      if (!this.#movedAt(line)) continue;
      const drift = this.diagnosisOf(request.hop ?? null);
      return {
        ok: false,
        leg: "line",
        reason: DISPATCH_REASON.docDrift.token,
        ...(drift === null ? {} : { drift }),
      };
    }
    return null;
  }

  /** One station line's CAUSE — the two cells this row judges: it was WORKED, and its
   *  document moved. */
  #movedAt(line: StationLine): boolean {
    if (!this.#lines.enteredAt(line.key, line.type)) return false;
    return this.#lines.driftPairOf(line.key, line.doc) !== null;
  }

  /** The DIAGNOSIS of the hop's own render target — the shipped composer's one rule, shared
   *  with the row a line at another phase owes (`line-rows.ts`), so one hop target has one
   *  reading whichever row prints it. The
   *  target's own type is the ledger key of the line it renders, and a branch target carries
   *  its document in `plan` while every other doc shape carries it in `id`. Null when the
   *  target names no document (a wave target's movement is the BRIEF's, a different layer this
   *  station never diagnoses) or that document recorded no movement. */
  diagnosisOf(hop: NextHop | null): DriftDiagnosis | null {
    const target = hop === null ? null : hop.target;
    if (target === null) return null;
    const identity = this.#lines.identityOf({
      type: target.type,
      doc: target.type === "branch" ? null : target.id,
      plan: target.plan ?? null,
    });
    const doc = identity.doc;
    if (doc === null) return null;
    const pair = this.#lines.driftPairOf(identity.key, doc);
    if (pair === null) return null;
    return { layer: "doc", line: doc, recorded: pair.recorded, current: pair.current };
  }

  /** The document face one pipeline face is judged at — the specification face reads the
   *  identity document, the plan and branch faces the plan. Null when that document is
   *  absent or the face judges no document at all (the wave face's movement is the BRIEF's,
   *  a separate layer with a separate token). */
  static stationOf(face: PhaseFaceKey, pipeline: PipelineInput): StationLine | null {
    if (face === "wave") return null;
    if (face === "plan" || face === "branch") {
      return pipeline.planPath === null ? null : { type: face, key: face, doc: pipeline.planPath };
    }
    if (pipeline.specType === "overall") return null;
    const type = pipeline.specType ?? "phase-spec";
    return pipeline.specPath === null ? null : { type, key: type, doc: pipeline.specPath };
  }

  /** The pipeline position of one target type — the request face's own index, so the upstream
   *  prefix is the faces ABOVE it. A standalone specification is the specification face; a
   *  type the pipeline never walks (the charter) answers -1 and has no upstream at all. */
  static faceIndexOf(type: TargetType): number {
    const face = type === "single-spec" ? "phase-spec" : type;
    return (PIPELINE_FACES as readonly string[]).includes(face)
      ? PIPELINE_FACES.indexOf(face as PhaseFaceKey)
      : -1;
  }
}
