// packages/cdd-engine/src/run/advance/drift-station.ts
// The line leg's UPSTREAM stations: the faces above the request that still hold it.
//
// INVARIANT — the FIRST upstream face that holds the request owns the refusal, and the two
// faces hold it in two different ways:
//   · a DOCUMENT face holds it when it was WORKED and its document moved past the version
//     its review bound — the `doc-drift` row, with both digest ends;
//   · the WAVE face holds it in two rows, the brief's movement FIRST: an OPEN batch whose
//     task-only projection moved past the version its review bound owns the `brief-drift` row
//     and the review that batch owes (never the frontier's round — a batch that is not the
//     frontier would otherwise be told to run somebody else's review); with no open batch
//     moved, an entered and unexhausted wave face owns the round above the request, so the
//     refusal prints the frontier hop's reason (`task-open` · `pending-fix` · …) and the
//     command that would run it.
// The order is the pipeline's own face order, so the most upstream cause wins: a moved
// document above the wave face is never reported as an open batch.
//
// THE REFUSAL IS ONE VALUE with ONE diagnosis, and it names only facts this segment read: the
// layer the moved identity belongs to, its coordinate and the two digest ends the review did
// and does judge — never a sentence. Two layers, two tokens: a wave line's movement is its
// BRIEF's projection, a document line's is the document's revision. The upstream-face
// precedence is the whole point: a split batch is what the wave gate would report, and it is
// not the actionable cause while a round above the request is still owed.
//
// The stations read the LINE's facts, never a second walk: `enteredAt` decides whether a
// document face was ever worked (an unentered face holds no station) and `driftPairOf` is the
// ONE drift read both this row and the pipeline's reopen share, while the wave face's entry and
// exhaustion cells are the pipeline's own — a second comparison would let the board's `next:`
// and the refusal's diagnosis disagree about one line.
//
// THE CAUSE AND THE DIAGNOSIS ARE TWO CELLS. The CAUSE is the first face above the request
// that holds it; the DIAGNOSIS is read off the hop the refusal's `next:` will print, exactly
// as the shipped composer reads it. They are not the same face: a request whose PLAN moved is
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
  /** The layer the moved identity belongs to — a document (`doc`), or the wave line's
   *  task-only brief projection (`brief`, a separate layer with a separate token). */
  readonly layer: "doc" | "brief";
  /** The moved identity's coordinate, on the one repo-relative basis — a document path, or
   *  the wave line's batch key. */
  readonly line: string;
  /** The version the completed review bound. */
  readonly recorded: string;
  /** The version the identity holds now. */
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
  /** The hop this row PRESCRIBES, when it prescribes one of its own — the brief's movement
   *  names the drifted batch's review, which is not the frontier's hop the caller hands in.
   *  Absent on every row whose `next:` is the caller's own hop. */
  readonly hop?: NextHop;
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

/** The wave face's station read — the ONE pipeline cell this file asks for ("was the face
 *  entered, and are its waves still open?", then "did an open batch's brief move?").
 *  Injected, so this file never walks the plan or the ledger a second time. */
export interface WaveFaceStation {
  /** Whether the wave face was entered and has not exhausted its derived waves. */
  readonly wavesHoldRequest: (pipeline: PipelineInput) => boolean;
  /** The FIRST drifted OPEN batch's review hop, or null when no open batch's brief moved
   *  (and when the face was never entered — an unentered face has no brief on record). */
  readonly briefDriftHopOf: (pipeline: PipelineInput) => NextHop | null;
}

/**
 * DriftStation — the line leg's upstream stations. Invariant: the first upstream face that
 * HOLDS the request owns the refusal (upstream first, in the pipeline's own order), while the
 * diagnosis it carries is the HOP's own target (see the file's header) — so a cause and a
 * prescription can never name two different rounds.
 *
 * Rule zero note: the class is a few short rows over one line walk and one pipeline cell, so it
 * holds no state beyond those two reads — the alternative (a caller composing "is a face above
 * me holding this request" itself) is the second upstream judgment this segment exists to
 * prevent.
 */
export class DriftStation {
  readonly #lines: LinePhase;
  readonly #waves: WaveFaceStation;

  constructor(opts: { readonly lines: LinePhase; readonly waves: WaveFaceStation }) {
    this.#lines = opts.lines;
    this.#waves = opts.waves;
  }

  /** The refusal this request owes — the first UPSTREAM face that holds it: a document face
   *  that moved past what its review bound, or the wave face with a wave still open. Null
   *  when every face above it is where its review left it. The faces above the request are
   *  the pipeline's own prefix, so the order here is the order the board walks, and a face the
   *  pipeline never entered reports nothing. It reads only the request's target type and its
   *  pipeline cells, so the frame assembly asks the same question about a CLOSED line it never
   *  assembled a round for. */
  refusalOf(request: DriftRequest): LineRowRefusal | null {
    const index = DriftStation.faceIndexOf(request.type);
    if (index <= 0) return null;
    for (const face of PIPELINE_FACES.slice(0, index)) {
      if (face === "wave") {
        // The brief's movement first — the batch that owes its own review, whose hop is the
        // drifted batch's and NOT the frontier's the caller handed in; then the frontier's
        // open round, whose `next:` is that hop.
        const drifted = this.#waves.briefDriftHopOf(request.pipeline);
        if (drifted !== null) return this.elsewhereOf(drifted);
        if (!this.#waves.wavesHoldRequest(request.pipeline)) continue;
        return this.elsewhereOf(request.hop ?? null);
      }
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

  /** The row a line that owes another round names — the hop's OWN reason and the hop target's
   *  diagnosis, in ONE construction: the wave face's two rows above (`refusalOf`) and the
   *  line leg's own lookahead row (`line-rows.ts#elsewhereOf`, which delegates here) print the
   *  same value, so neither can name a round the other refuses. The hop rides the value, so
   *  the row that prescribes a round other than the caller's (`brief-drift`) prints THAT round.
   *  A caller that wired no hop keeps the declared closure token rather than inventing a
   *  reason. */
  elsewhereOf(hop: NextHop | null): LineRowRefusal {
    const drift = hop === null ? null : this.diagnosisOf(hop);
    return {
      ok: false,
      leg: "line",
      reason: hop === null ? DISPATCH_REASON.closedLine.token : hop.reason,
      ...(drift === null ? {} : { drift }),
      ...(hop === null ? {} : { hop }),
    };
  }

  /** One station line's CAUSE — the two cells this row judges: it was WORKED, and its
   *  document moved. */
  #movedAt(line: StationLine): boolean {
    if (!this.#lines.enteredAt(line.key, line.type)) return false;
    return this.#lines.driftPairOf(line.key, line.doc) !== null;
  }

  /** The DIAGNOSIS of the hop's own render target — the shipped composer's one rule, shared
   *  with the row a line at another phase owes (`line-rows.ts`), so one hop target has one
   *  reading whichever row prints it. A wave target's movement is its BRIEF's task-only
   *  projection (`LinePhase#briefDriftPairOf`, the same read its reopen uses); every other
   *  target's is the document's revision, whose ledger key is the target's own type (a branch
   *  target carries its document in `plan` while every other doc shape carries it in `id`).
   *  Null when the target names no identity (a bare terminal) or that identity recorded no
   *  movement. */
  diagnosisOf(hop: NextHop | null): DriftDiagnosis | null {
    const target = hop === null ? null : hop.target;
    if (target === null) return null;
    if (target.type === "wave") {
      const key = String(target.id);
      const pair = this.#lines.briefDriftPairOf(key);
      return pair === null ? null : { layer: "brief", line: key, ...pair };
    }
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
   *  a separate layer with a separate token, and its station is `WaveFaceStation`). */
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
