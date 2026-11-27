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
// Module-level exports are types and the class — zero behaviour-carrying bare functions.

import type { LinePhase } from "./line-phase.ts";
import { DISPATCH_REASON, type DispatchReason, type PhaseFaceKey, PIPELINE_FACES } from "./next.ts";
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
 * DriftRefusal — the line leg's `doc-drift` verdict. Invariant: it carries the diagnosis the
 * reason names (see the file's header), so a refusal can never print a token without its two
 * ends. A value, not a judgment: the station below produces it, and nothing re-derives it.
 */
export interface DriftRefusal {
  readonly ok: false;
  /** The ONE table's token — never a second spelling of the fact. */
  readonly reason: DispatchReason;
  readonly drift: DriftDiagnosis;
}

/** What one station read needs: the request's target type and its pipeline cells. The frame
 *  assembly and the dispatch entry both hand in exactly this, so the refusal's cause is one
 *  reading whichever face asks. */
export interface DriftRequest {
  readonly type: TargetType;
  readonly pipeline: PipelineInput;
}

/** One document face as a station reads it: the target type, the ledger key and the record. */
interface StationLine {
  readonly type: TargetType;
  readonly key: string;
  readonly doc: string;
}

/**
 * DriftStation — the doc-drift refusal producer. Invariant: the first face that MOVED owns the
 * refusal (upstream first, in the pipeline's own order), and every answer carries that face's
 * own diagnosis (see the file's header).
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
  refusalOf(request: DriftRequest): DriftRefusal | null {
    const index = DriftStation.faceIndexOf(request.type);
    if (index <= 0) return null;
    for (const face of PIPELINE_FACES.slice(0, index)) {
      const line = DriftStation.stationOf(face, request.pipeline);
      if (line === null) continue;
      const refusal = this.#refusalOfLine(line);
      if (refusal !== null) return refusal;
    }
    return null;
  }

  /** One station line's refusal — the two cells this row judges: it was WORKED, and its
   *  document moved. */
  #refusalOfLine(line: StationLine): DriftRefusal | null {
    if (!this.#lines.enteredAt(line.key, line.type)) return null;
    const pair = this.#lines.driftPairOf(line.key, line.doc);
    if (pair === null) return null;
    return {
      ok: false,
      reason: DISPATCH_REASON.docDrift.token,
      drift: { layer: "doc", line: line.doc, recorded: pair.recorded, current: pair.current },
    };
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
