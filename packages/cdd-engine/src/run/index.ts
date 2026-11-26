// packages/cdd-engine/src/run/index.ts
// `run/` — one phase's run, and its entry.
//
// INVARIANT (the slice's one sentence, from the phase spec): facts first, and every
// advance is derived from them — what the ledger records is the only thing `next:` can be,
// and at any instant the tree holds at most one round in flight and at most one refusal.
//
// Four segments carry that invariant, each with its own:
//   ledger/   — the facts and the identity: a round's coordinate, the wave lines, the
//               document review lines, the branch line, the version a round reviewed, the
//               artifact identities, the rulings and re-grades. Its sentence: one fact,
//               one home — one record written from one place.
//   gate/     — refusal and authorization: the one closed gate row set (the structural
//               legs and the four pre-dispatch stations), the tree-level refusal fact with
//               its two expiry triggers, and the takeover's three legs. Its sentence: a
//               refusal is a fact about the TREE, never about a round, and at most one
//               stands at a time.
//   dispatch/ — the child: the dispatch's input contract and its pre-frame value
//               assembly, the handoff contract and its read-back, the liveness judge, the
//               budget and the three termination causes, and the tree's in-flight record
//               (zero records before the child exists; no residue after). Its sentence:
//               the engine authorises and attributes, it never signals.
//   advance/  — the frontier and `next:`: the pipeline and wave frontiers, the closure
//               judgment, the `next:` / `reason:` assembly (the frontier is the ledger's
//               projection, never a second judgment). Lands in a later wave.
//
// `run/index.ts` is the slice's ONE entrance. It exposes the fact layer's READ face, the
// gate the round machinery consults before a child exists, and the dispatch segment's
// faces (the child, the value assembly, the handoff and the in-flight record); the round
// verbs and the frontier arrive with `advance/`. The class knows no path spelling (`env/`),
// no markdown (`docs/`) and no byte (`surface/`): the gate, the refusal record, the lock and
// the in-flight record arrive CONSTRUCTED by the composition root, so this file composes
// nothing and spells nothing.

import type {
  BoardMiss,
  Frame,
  FrameFacts,
  FrameRequest,
  ReadFailure,
  Usage,
} from "./advance/frame.ts";
import type { AdvanceOutcome, Lifecycle, LifecycleReads } from "./advance/lifecycle.ts";
import type { LinePhase, LineState } from "./advance/line-phase.ts";
import type { NextHop } from "./advance/next.ts";
import type { Pipeline } from "./advance/pipeline.ts";
import type { TargetType } from "./advance/target-faces.ts";
import type { WaveVerdict } from "./advance/wave.ts";
import type { Child, RoundPhase } from "./dispatch/child.ts";
import type { InFlight, InFlightState } from "./dispatch/inflight.ts";
import type { CheckedRow, PreFlight, PreFlightVerdict } from "./gate/preflight.ts";
import type { Refusal, RefusalState } from "./gate/refusal.ts";
import { RoundIdentity } from "./ledger/identity.ts";
import type { ArtifactObservation, RoundRecordInit } from "./ledger/ledger.ts";
import {
  type BranchLine,
  type CrashedRound,
  type DocLine,
  Ledger,
  type LedgerDocument,
  type LedgerOptions,
  type RoundRecord,
  type WaveLine,
} from "./ledger/ledger.ts";
import type { Drift, ReviewedIdentity } from "./ledger/reviewed.ts";
import type { Rulings } from "./ledger/rulings.ts";

export {
  type BoardMiss,
  type DocFacts,
  Frame,
  type FrameFacts,
  type FrameLines,
  type FrameOptions,
  type FrameOutcome,
  type FrameReads,
  type FrameRequest,
  type ReadFailure,
  type Usage,
  type UsageReason,
  type WorkVerb,
} from "./advance/frame.ts";
export {
  type AdvanceOutcome,
  type BriefLanding,
  type CapsuleFacts,
  Lifecycle,
  type LifecycleLedger,
  type LifecycleOptions,
  type LifecycleReads,
  type StepResult,
} from "./advance/lifecycle.ts";
export {
  type CarriedFacts,
  type CarriedRead,
  type DocumentText,
  type LineIdentity,
  LinePhase,
  type LinePhaseOptions,
  type LineReads,
  type LineState,
} from "./advance/line-phase.ts";
export type { PipelineFaceState, PipelineVerdict } from "./advance/next.ts";
export {
  DISPATCH_REASON,
  type DispatchReason,
  type DispatchReasonLeg,
  type DispatchReasonRow,
  type DocClassVerdict,
  type Hop,
  type HopInput,
  NEXT_HOP_REASON,
  type NextHop,
  NextRoutes,
  type PhaseFaceKey,
  PIPELINE_FACES,
  PIPELINE_NEXT,
  type PipelineEntry,
  type PipelineKey,
  REVIEW_CYCLE_CAP,
  type RoundFacts,
  type Route,
  type RouteHop,
  SOFT_CAP_SUGGESTION,
  WAVE_GATE_REASON,
  type WaveGateReason,
} from "./advance/next.ts";
export {
  type DocClassRead,
  Pipeline,
  type PipelineInput,
  type PipelineOptions,
} from "./advance/pipeline.ts";
export {
  type AuditFace,
  type ReviewLead,
  type RouteTarget,
  TARGET_FACES,
  type TargetFace,
  TargetFaces,
} from "./advance/target-faces.ts";
export {
  WaveGate,
  type WaveInput,
  type WavePhaseRow,
  type WaveVerb,
  type WaveVerdict,
} from "./advance/wave.ts";
export {
  BUDGET,
  Child,
  type ChildOptions,
  type DispatchFrame,
  type DispatchLog,
  type DispatchOutcome,
  ROUND_PHASES,
  type RoundPhase,
  type TerminationCause,
} from "./dispatch/child.ts";
export {
  CONTRACT_VIOLATION,
  HANDOFF_KEYS,
  Handoff,
  type HandoffConclusion,
  type HandoffKey,
  type HandoffPlane,
  type HandoffRead,
  type JudgedRecord,
  PLANE_REQUIRED,
  PLANE_SLOTS,
  type RoundFinding,
  type RoundSeverity,
  WORK_STATUSES,
} from "./dispatch/handoff.ts";
export {
  type AcquireOutcome,
  InFlight,
  type InFlightBody,
  type InFlightOptions,
  type InFlightRecord,
  type InFlightState,
  type LivenessRead,
  type Occupancy,
  type StartRead,
  TARGET_FACTS,
  type TargetFact,
} from "./dispatch/inflight.ts";
export {
  CpuAdvance,
  LIVENESS_READS,
  LIVENESS_SIGNALS,
  type LivenessContext,
  LivenessJudge,
  type LivenessLeg,
  type LivenessReads,
  type LivenessSignal,
  type LivenessSignalEntry,
  type LivenessVerdict,
  LogGrowth,
  type Sample,
  Sampler,
  type SignalReading,
  type TickReadings,
  Watch,
  type WatchOptions,
} from "./dispatch/liveness.ts";
export {
  type ArtifactSnapshot,
  type DispatchIdentity,
  type DispatchSceneFacts,
  DispatchValues,
} from "./dispatch/values.ts";
export type { Takeover, TakeoverAnswer } from "./gate/authority.ts";
export { Authority } from "./gate/authority.ts";
export {
  type CheckedReading,
  type CheckedRow,
  type DispatchRowReading,
  type DocJudgment,
  type InFlightReading,
  type InFlightWord,
  type PlanLedgerTarget,
  PRE_FLIGHT_GATE_NAMES,
  PRE_FLIGHT_REASONS,
  PreFlight,
  type PreFlightContext,
  type PreFlightGateName,
  type PreFlightOptions,
  type PreFlightReason,
  type PreFlightVerdict,
  ROW_STATIONS,
  type RowStation,
  type SkipReason,
  STRUCTURE_ROWS,
  type StructureRow,
  type TreeRead,
} from "./gate/preflight.ts";
export {
  Refusal,
  type RefusalBody,
  type RefusalFacts,
  type RefusalPublish,
  type RefusalState,
} from "./gate/refusal.ts";
export type {
  ArtifactObservation,
  BranchLine,
  CrashedRound,
  DocLine,
  Drift,
  LedgerDocument,
  ReviewedIdentity,
  RoundRecord,
  Rulings,
  WaveLine,
};

/** The fact layer's READ half — what a renderer or a gate may ask. The write half
 *  (recording a round, closing a wave, recording a ruling) belongs to the round machinery
 *  that lands with the dispatch segment, so this type is the boundary that keeps a reader
 *  from writing. */
export type FactReads = Pick<
  Ledger,
  | "read"
  | "rounds"
  | "nodeRecordsOf"
  | "crashedOf"
  | "waveLines"
  | "docLines"
  | "branchLine"
  | "planTasksOf"
  | "reviewedOf"
  | "docHashOf"
  | "docDriftOf"
  | "rulingsOf"
  | "carrierPathOf"
  | "observedArtifacts"
  | "orphanHandoffs"
>;

/** One board row, as a VALUE — the render face connects it, so no byte is spelled here. */
export type BoardRow =
  /** The tree's occupancy. */
  | { readonly kind: "in-flight"; readonly state: InFlightState }
  /** The `next:` consumption — the ONE hop both the capsule and the board read. */
  | { readonly kind: "next"; readonly hop: NextHop }
  /** One document line. */
  | {
      readonly kind: "doc";
      readonly line: string;
      readonly state: LineState;
      readonly rounds: number;
      readonly batch: number;
    }
  /** One wave line. */
  | {
      readonly kind: "wave";
      readonly line: string;
      readonly tasks: readonly number[];
      readonly phase: RoundPhase | null;
      readonly closed: boolean;
    };

/** The tree's fact block — the three families the board reports beside its rows. */
export interface BoardFacts {
  /** The workspace names no record claims. */
  readonly orphans: readonly string[];
  /** The crashed rounds, in `(cycle, attempt)` order. */
  readonly crashed: readonly CrashedRound[];
  /** The tree-level refusal as THIS workspace sees it (a tree fact, never a round's). */
  readonly refusal: RefusalState;
}

/** `boardOf`'s declared answer. */
export type BoardOutcome =
  | {
      readonly kind: "board";
      readonly rows: readonly BoardRow[];
      readonly facts: BoardFacts;
      readonly observed: readonly ArtifactObservation[];
    }
  | Usage;

/** `previewOf`'s declared answer — the `--dry-run` face's whole value set. */
export type PreviewOutcome =
  /** The one dispatch that WOULD run: its frame, the host fact, the brief's name and the
   *  same read-only `checked` rows the real dispatch will carry. */
  | {
      readonly kind: "pass";
      readonly frame: FrameFacts;
      readonly host: string;
      readonly brief: string;
      readonly checked: readonly CheckedRow[];
    }
  /** The in-flight gate holds the tree. */
  | {
      readonly kind: "held";
      readonly state: InFlightState;
      readonly checked: readonly CheckedRow[];
    }
  /** The structural leg refused. */
  | {
      readonly kind: "blocked";
      readonly verdict: PreFlightVerdict;
      readonly checked: readonly CheckedRow[];
    }
  /** The line leg refused — the wave gate's five rows. */
  | {
      readonly kind: "refused";
      readonly verdict: WaveVerdict;
      readonly checked: readonly CheckedRow[];
    }
  | Usage
  | ReadFailure;

/** `Run`'s construction facts — the workspace every fact lands in, the workspace listing the
 *  orphan judgment scans, the artifact index when the caller wired one, and the two objects
 *  the composition root builds for the gate (the gate itself and the tree-level refusal
 *  record, which the release point clears through the same instance). */
export interface RunOptions extends LedgerOptions {
  /** The one line walk every phase cell is read off. */
  readonly lines: LinePhase;
  /** The scene assembly the three argv-side commands share. */
  readonly frame: Frame;
  /** The pipeline frontier and its one hop assembly. */
  readonly pipeline: Pipeline;
  /** The one dispatch step — it also OWNS the line leg (the wave gate), so a preview asks it
   *  for the verdict the real dispatch refuses on instead of wiring a second gate. */
  readonly lifecycle: Lifecycle;
  /** The step's reads and side-effect seams — the SAME wiring a preview reads through, so a
   *  dry run and a real dispatch judge with one pre-flight context. */
  readonly stepReads: LifecycleReads;
  /** The brief's workspace-relative name — the preview's brief cell, the same spelling the
   *  landing produces. */
  readonly briefName: (frame: FrameFacts) => string;
  /** The dispatch host fact. */
  readonly host: () => string;
  /** The work tree's gate. */
  readonly gate: PreFlight;
  /** The tree's one refusal record — the same instance the gate writes. */
  readonly refusal: Refusal;
  /** The tree's one in-flight record — the same instance the release point clears through. */
  readonly inflight: InFlight;
  /** The child seam — the ONE spawn point a round's dispatch takes. */
  readonly child: Child;
}

/**
 * Run — one phase's run. Invariant: facts first, and every advance is derived from them
 * (see the file's header). This wave's surface is the fact layer's read face plus the gate
 * the round machinery consults; the round verbs arrive with the segments that own them.
 */
export class Run {
  /** The fact layer's read face. */
  readonly facts: FactReads;

  /** The work tree's gate. */
  readonly gate: PreFlight;

  /** The tree's one in-flight record. */
  readonly inflight: InFlight;

  /** The child seam. */
  readonly child: Child;

  readonly #ledger: Ledger;
  readonly #refusal: Refusal;
  readonly #lines: LinePhase;
  readonly #frame: Frame;
  readonly #pipeline: Pipeline;
  readonly #lifecycle: Lifecycle;
  readonly #stepReads: LifecycleReads;
  readonly #briefName: (frame: FrameFacts) => string;
  readonly #host: () => string;

  constructor(opts: RunOptions) {
    this.#ledger = new Ledger(opts);
    this.#refusal = opts.refusal;
    this.facts = this.#ledger;
    this.gate = opts.gate;
    this.inflight = opts.inflight;
    this.child = opts.child;
    this.#lines = opts.lines;
    this.#frame = opts.frame;
    this.#pipeline = opts.pipeline;
    this.#lifecycle = opts.lifecycle;
    this.#stepReads = opts.stepReads;
    this.#briefName = opts.briefName;
    this.#host = opts.host;
  }

  /** Book one round — the round machinery's ONE write entry, so a caller outside the step
   *  (a recovery, a pin) books through the same writer the step uses. */
  recordRound(line: string, init: RoundRecordInit): RoundRecord {
    return this.#ledger.recordRound(line, init);
  }

  /** The tree's occupancy NOW — the three-state read every gate and report face shares. */
  async inflightOf(): Promise<InFlightState> {
    return this.inflight.inspect();
  }

  /** One dispatch step. The scene assembly happens ONCE here: the shell hands the argv-side
   *  input in, and the frame's two declared failures go back unchanged. */
  async advance(request: FrameRequest): Promise<AdvanceOutcome> {
    const assembled = this.#frame.of(request);
    if (assembled.kind === "usage") return assembled;
    if (assembled.kind === "read-failure") return assembled;
    return this.#lifecycle.advance(assembled);
  }

  /** The `--dry-run` face — the ONE producer of a preview. Three pure reads and nothing
   *  else: the frame assembly, the read-only pre-flight and the wave gate's own `vet`. No
   *  settle, no brief landing, no lock, no spawn, no ledger write. */
  async previewOf(request: FrameRequest): Promise<PreviewOutcome> {
    const assembled = this.#frame.of(request);
    if (assembled.kind === "usage") return assembled;
    if (assembled.kind === "read-failure") return assembled;
    const frame = assembled;
    const holding = await this.inflight.inspect();
    const verdict = await this.gate.vet(this.#stepReads.preflight(frame, holding));
    if (!verdict.ok) {
      return verdict.gate === "in-flight"
        ? { kind: "held", state: holding, checked: verdict.checked }
        : { kind: "blocked", verdict, checked: verdict.checked };
    }
    const wave = this.#lifecycle.waveVerdictOf(frame);
    if (wave !== null && !wave.ok)
      return { kind: "refused", verdict: wave, checked: verdict.checked };
    return {
      kind: "pass",
      frame,
      host: this.#host(),
      brief: this.#briefName(frame),
      checked: verdict.checked,
    };
  }

  /** The board's three declared cells, read off the fact layer alone. The four failure arms
   *  answer the argv-side miss first (a combination miss, then the ordered miss list), so a
   *  shell that hands in an unmatched coordinate gets a value rather than a judgment. */
  async boardOf(request: FrameRequest): Promise<BoardOutcome> {
    if (request.plan === undefined && request.spec === undefined) {
      return { kind: "usage", reason: { kind: "missing-plan-or-spec" } };
    }
    const misses: readonly BoardMiss[] = this.#frame.missesOf(request);
    if (misses.length > 0) return { kind: "usage", reason: { kind: "board-unmatched", misses } };
    const assembled = this.#frame.of(request);
    if (assembled.kind === "read-failure") {
      return {
        kind: "usage",
        reason: {
          kind: "board-unreadable",
          flag: request.plan === undefined ? "--spec" : "--plan",
          target: assembled.target,
        },
      };
    }
    if (assembled.kind === "usage") return assembled;
    const frame = assembled;
    const holding = await this.inflight.inspect();
    const documents = this.#ledger.read();
    return {
      kind: "board",
      rows: this.#rowsOf(frame, holding),
      facts: {
        orphans: this.#ledger.orphanHandoffs(),
        crashed: this.#ledger.crashedOf(this.#ledger.nodeRecordsOf(documents)),
        refusal: this.#refusal.read(frame.slug),
      },
      observed: this.#ledger.observedArtifacts(),
    };
  }

  /** The board's rows: the occupancy, the ONE next hop, every document line and every wave
   *  line — each cell a fact, none a judgment. */
  #rowsOf(frame: FrameFacts, holding: InFlightState): readonly BoardRow[] {
    const rows: BoardRow[] = [
      { kind: "in-flight", state: holding },
      { kind: "next", hop: this.#pipeline.hopOf(frame.pipeline) },
    ];
    for (const line of this.#ledger.docLines()) {
      rows.push({
        kind: "doc",
        line: line.line,
        state: this.#lines.stateOf(line.line, Run.#docTypeOf(line.line), null),
        rounds: line.rounds.length,
        batch: line.batch,
      });
    }
    for (const line of this.#ledger.waveLines()) {
      const key = RoundIdentity.splitLineWord(line.line).key;
      rows.push({
        kind: "wave",
        line: line.line,
        tasks: line.taskIds,
        phase: this.#lines.wavePhaseOf(key),
        closed: this.#lines.waveClosedAt(key),
      });
    }
    return rows;
  }

  /** A document line's target type — the line word IS the type word for a document line, so
   *  no second table is needed. */
  static #docTypeOf(line: string): TargetType {
    return line as TargetType;
  }

  /** The tree's refusal as THIS workspace sees it — the phase's own standing refusal, or
   *  `absent` when another slug's record stands (that one is the other phase's fact). The
   *  unfiltered read (`Refusal#readRaw`) belongs to the release point, which clears the
   *  tree's fact rather than one workspace's view of it. */
  refusalOf(slug: string): RefusalState {
    return this.#refusal.read(slug);
  }
}
