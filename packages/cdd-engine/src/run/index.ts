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
// nothing and spells nothing. Three dependencies are the narrow exceptions that keep a fact
// value factual: `env/`'s `RepoPath` brand, the criteria slice's ONE downgrade-note composer
// (the same one the capsule's summary line calls — a board token that re-composed it would be
// the second home), and the `Handoff` findings projection (the round read-back's own). The
// board's own value assembly lives here too: it turns the ledger's reads into the cells a
// render face connects, and it reaches a document's declared facts and a charter's phases
// through the INJECTED `BoardReads` seam, never by reading a file itself.

import { regradeNote } from "../docs/judging/criteria.ts";
import type { RepoPath } from "../env/paths/root.ts";
import type {
  BoardMiss,
  DocFacts,
  Frame,
  FrameFacts,
  FrameRequest,
  FrameScene,
  ReadFailure,
  Usage,
} from "./advance/frame.ts";
import { type AdvanceOutcome, Lifecycle, type LifecycleReads } from "./advance/lifecycle.ts";
import type { LinePhase, LineState } from "./advance/line-phase.ts";
import type { NextHop } from "./advance/next.ts";

import type { Pipeline } from "./advance/pipeline.ts";
import { TargetFaces, type TargetType } from "./advance/target-faces.ts";
import type { WaveBoard, WaveVerdict } from "./advance/wave.ts";
import type { Child } from "./dispatch/child.ts";
import { Handoff, type RoundFinding } from "./dispatch/handoff.ts";
import type { InFlight, InFlightState } from "./dispatch/inflight.ts";
import type { CheckedRow, PreFlight, PreFlightVerdict } from "./gate/preflight.ts";
import type { Refusal, RefusalState } from "./gate/refusal.ts";
import { Artifacts } from "./ledger/artifacts.ts";
import { CarrierLine } from "./ledger/carrier-line.ts";
import { RoundIdentity } from "./ledger/identity.ts";
import type { ArtifactObservation, RoundRecordInit, RoundWrite } from "./ledger/ledger.ts";
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
  type FrameScene,
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

/** One round, as a board line's token reads it: the record's own identity and judgement
 *  plus the three cells the token appends — the graded findings count (`+N`), the downgrade
 *  note, and the child's own notes. Every cell is a READ VALUE the ledger produced; the
 *  token's bytes belong to the render face. */
export interface BoardRound {
  readonly op: RoundRecord["op"];
  readonly cycle: number;
  readonly attempt: number;
  /** Whether the round completed its target action — the judgement glyph's pick. */
  readonly passed: boolean;
  /** The graded findings the round's carrier carries (never its contract violations). */
  readonly findings: number;
  /** The downgrade note this round owes, composed by the criteria slice's ONE composer. */
  readonly regrade?: string;
  /** The child's own notes, as the carrier declared them. */
  readonly notes: readonly string[];
}

/** One document line's header facts — the cells the row prints beside its label. */
export interface BoardDoc {
  /** The document's name (its path's last segment). */
  readonly name: string;
  /** The declared `version:`, or null when the document states none. */
  readonly version: string | null;
  /** The declared `status:`, or null when the document states none. */
  readonly status: string | null;
  /** The declared `title:`, or null — the program board's phase annotation. */
  readonly title: string | null;
}

/** One program-board cell — a key word and that line's rounds. */
export interface BoardPhaseCell {
  /** The cell's key word (`spec` · `plan` · `branch`) — the line it summarises. */
  readonly key: "spec" | "plan" | "branch";
  readonly rounds: readonly BoardRound[];
}

/** One phase specification's program-board row. */
export interface BoardPhase {
  /** The phase's declared slug. */
  readonly slug: string;
  /** The phase document's declared status, or null. */
  readonly status: string | null;
  /** The phase document's declared title, or null. */
  readonly title: string | null;
  /** The phase's first derived wave label (`W1`), or null when it derives none. */
  readonly wave: string | null;
  /** The phase's own line cells, in the board's key order. */
  readonly cells: readonly BoardPhaseCell[];
}

/** The board's reads the round layer cannot answer from ITS OWN ledger: one document's
 *  declared header cells, and the phase specifications a charter groups (a phase is its own
 *  workspace, so its rounds live in its own ledger read). The composition root supplies
 *  both; a `Run` wired with neither answers no header cell and no phase row, never a
 *  fabricated one. */
export interface BoardReads {
  /** One document's declared facts; null when the document cannot be read. */
  readonly docFacts: (target: RepoPath) => DocFacts | null;
  /** Every phase specification the charter groups, each with its OWN board read. The read is
   *  asynchronous because a phase's board reads that phase's occupancy — the same one read
   *  every other board entry takes. */
  readonly phases: (
    charterSlug: string,
  ) => Promise<readonly { readonly slug: string; readonly board: BoardOutcome }[]>;
}

/** One board row, as a VALUE — the render face connects it, so no byte is spelled here. */
export type BoardRow =
  /** The tree's occupancy. */
  | { readonly kind: "in-flight"; readonly state: InFlightState }
  /** The `next:` consumption — the ONE hop both the capsule and the board read. */
  | { readonly kind: "next"; readonly hop: NextHop }
  /** One document line — its label word, the document's header cells and its rounds. */
  | {
      readonly kind: "doc";
      readonly line: string;
      /** The document's header cells; null when the document cannot be read. */
      readonly doc: BoardDoc | null;
      readonly rounds: readonly BoardRound[];
    }
  /** One wave line. */
  | {
      readonly kind: "wave";
      readonly line: string;
      readonly tasks: readonly number[];
      /** Whether this line is the tree's FRONTIER — the first wave still holding an open
       *  task. Exactly one wave answers true (none when every wave closed), and the board's
       *  `▶` marks this cell alone. */
      readonly frontier: boolean;
      readonly closed: boolean;
      readonly rounds: readonly BoardRound[];
    }
  /** The branch line — its state word and its rounds. */
  | { readonly kind: "branch"; readonly state: LineState; readonly rounds: readonly BoardRound[] };

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
      /** The tree's workspace identity — the board header's one value. */
      readonly slug: string;
      readonly rows: readonly BoardRow[];
      readonly facts: BoardFacts;
      readonly observed: readonly ArtifactObservation[];
      /** The charter's phase rows — a PROGRAM board's rows, empty on a node board. */
      readonly phases: readonly BoardPhase[];
    }
  | Usage;

/** `previewOf`'s declared answer — the `--dry-run` face's whole value set. */
export type PreviewOutcome =
  /** The one dispatch that WOULD run: its frame, the host fact, the read input and the write
   *  facts, on the repo-relative basis, plus the same read-only `checked` rows the real
   *  dispatch will carry. Every name here is a fact the read produced — the render face joins
   *  them and spells none of them. */
  | {
      readonly kind: "pass";
      readonly frame: FrameFacts;
      readonly host: string;
      readonly brief: string;
      readonly writes: readonly string[];
      readonly ledger: RoundWrite;
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
  /** The line leg refused — the wave gate's five rows, with the wave board its `split` cause
   *  prints. */
  | {
      readonly kind: "refused";
      readonly verdict: WaveVerdict;
      readonly checked: readonly CheckedRow[];
      readonly tree: WaveBoard | null;
      readonly hop: NextHop | null;
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
  /** The board's document reads — one document's header cells and the phase specifications a
   *  charter groups. Absent leaves the board's header cells and phase rows out; it never
   *  fabricates one. */
  readonly board?: BoardReads;
}

/** One carrier's content cells — the facts a board token appends: the graded findings (the
 *  `+N` count and the downgrade input) and the child's own notes. */
interface CarrierContent {
  readonly findings: readonly RoundFinding[];
  readonly notes: readonly string[];
}

/** The content-free carrier — one shared frozen value, so an unreadable or overwritten
 *  carrier allocates nothing. */
const NO_CARRIER: CarrierContent = { findings: [], notes: [] };

/** The engine's own note families — dropped by BYTE PREFIX at this read face (never a
 *  substring: the same words mid-sentence are the child's own note), so a carrier the
 *  engine itself wrote can never pose as the child's observation. */
const ENGINE_NOTE_PREFIXES: readonly string[] = [
  "dropped decorative draft field(s)",
  "dropped non-declared draft field(s)",
  "artifact report: declared path ",
  "artifact test_evidence: declared path ",
];

/** One carrier's `notes` slot as the CHILD's observations — string rows only, blanks and the
 *  engine's own families dropped. The author's bytes are kept verbatim: folding belongs to
 *  the display site. */
const childNotesOf = (value: unknown): readonly string[] =>
  (Array.isArray(value) ? value : [])
    .filter((note): note is string => typeof note === "string")
    .filter((note) => note.trim().length > 0)
    .filter((note) => !ENGINE_NOTE_PREFIXES.some((prefix) => note.startsWith(prefix)));

/**
 * BoardCarriers — one line's carrier reads. Invariant: one record answers one content value,
 * read at most once, through the ledger's ONE path accessor, the ONE ownership judgment and
 * the ONE digest-checked read, so a token's `+N`, its notes segment and its downgrade input
 * can never come from three different reads.
 */
class BoardCarriers {
  readonly #records: readonly RoundRecord[];
  readonly #identities: readonly RoundIdentity[];
  readonly #pathOf: (record: RoundRecord) => RepoPath | "";
  readonly #text: (target: RepoPath) => string | null;
  readonly #cache = new Map<RoundRecord, CarrierContent>();

  constructor(opts: {
    readonly records: readonly RoundRecord[];
    readonly line: string;
    readonly pathOf: (record: RoundRecord) => RepoPath | "";
    readonly text: (target: RepoPath) => string | null;
  }) {
    this.#records = opts.records;
    this.#identities = opts.records.map(
      (record) =>
        new RoundIdentity({
          line: opts.line,
          op: record.op,
          cycle: record.cycle,
          attempt: record.attempt,
        }),
    );
    this.#pathOf = opts.pathOf;
    this.#text = opts.text;
  }

  /** One record's content cells. */
  contentOf(record: RoundRecord): CarrierContent {
    const cached = this.#cache.get(record);
    if (cached !== undefined) return cached;
    const content = this.#freshOf(record);
    this.#cache.set(record, content);
    return content;
  }

  /** One record's downgrade note — its findings judged against the nearest EARLIER record on
   *  the line whose findings are non-empty (a clean neighbour never resets the reference), and
   *  composed by the criteria slice's ONE note composer. */
  regradeOf(record: RoundRecord): string | undefined {
    const current = this.contentOf(record).findings;
    const prior = this.#priorOf(record);
    const owing = Handoff.downgrades(prior, current).length;
    return regradeNote(owing, Handoff.regradeReasons(prior, current));
  }

  /** The nearest earlier record's non-empty findings, newest first. */
  #priorOf(record: RoundRecord): readonly RoundFinding[] {
    const earlier = this.#records
      .filter((other) => BoardCarriers.#earlier(other, record))
      .sort((left, right) =>
        left.cycle === right.cycle ? right.attempt - left.attempt : right.cycle - left.cycle,
      );
    for (const other of earlier) {
      const findings = this.contentOf(other).findings;
      if (findings.length > 0) return findings;
    }
    return [];
  }

  /** Whether `other` precedes `record` on the line. */
  static #earlier(other: RoundRecord, record: RoundRecord): boolean {
    return other.cycle === record.cycle
      ? other.attempt < record.attempt
      : other.cycle < record.cycle;
  }

  /** The read behind `contentOf` — zero cells for a record that resolves no path, whose path a
   *  later round overwrote, or whose bytes hold neither findings nor notes. The digest check is
   *  the ONE checked seam: a tampered carrier throws there, never here. */
  #freshOf(record: RoundRecord): CarrierContent {
    const index = this.#records.indexOf(record);
    const path = this.#pathOf(record);
    if (path === "" || !this.#owned(index)) return NO_CARRIER;
    const checked = CarrierLine.read(this.#text(path), path, record.carrierDigest);
    if (checked === null) return NO_CARRIER;
    let value: unknown;
    try {
      value = JSON.parse(checked);
    } catch {
      return NO_CARRIER;
    }
    const findings = Handoff.findingsOf(value);
    const notes = childNotesOf((value as { notes?: unknown } | null)?.notes);
    if (findings.length === 0 && notes.length === 0) return NO_CARRIER;
    return { findings, notes };
  }

  /** Whether this record still owns its carrier path — the ONE ownership judgment, over the
   *  line's own records, so a legacy record a later round overwrote counts zero. The path is
   *  the caller's: the judgment re-reads it through the same accessor for every candidate. */
  #owned(index: number): boolean {
    const self = this.#identities[index];
    if (self === undefined) return false;
    return Artifacts.ownerOf(this.#identities, self, (identity) => {
      const at = this.#identities.indexOf(identity);
      const candidate = this.#records[at];
      return candidate === undefined ? "" : this.#pathOf(candidate);
    });
  }
}

/**
 * Run — one phase's run. Invariant: facts first, and every advance is derived from them
 * (see the file's header). This wave's surface is the fact layer's read face plus the gate
 * the round machinery consults; the round verbs arrive with the segments that own them.
 *
 * Rule zero (over the 200-line class limit): the split considered is the board projection
 * (`#phasesOf` · `#rowsOf` · `#roundsOf` · `#docOf`) — the one block no caller composes with.
 * Moving it out would hand a second object the same ledger, in-flight and pipeline reads this
 * class's invariants bind, and the fact layer would then be assembled twice; the cohesion of
 * one assembly outweighs the line count.
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
  readonly #board: BoardReads | null;
  readonly #workspace: LedgerOptions["workspace"];

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
    this.#board = opts.board ?? null;
    this.#workspace = opts.workspace;
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
   *  input in, and the frame's usage / read-failure values go back unchanged. A line whose rounds
   *  lie on the closure side holds no dispatchable frame — that member is translated HERE,
   *  at the dispatch entry, so the board (a pure read) still reports the same tree. */
  async advance(request: FrameRequest): Promise<AdvanceOutcome> {
    const assembled = this.#frame.of(request);
    if (assembled.kind === "closed-line") return Run.#noFrame(request);
    if (assembled.kind === "usage") return assembled;
    if (assembled.kind === "read-failure") return assembled;
    return this.#lifecycle.advance(assembled);
  }

  /** The `--dry-run` face — the ONE producer of a preview. Three pure reads and nothing
   *  else: the frame assembly, the read-only pre-flight and the wave gate's own `vet`. No
   *  settle, no brief landing, no lock, no spawn, no ledger write. */
  async previewOf(request: FrameRequest): Promise<PreviewOutcome> {
    const assembled = this.#frame.of(request);
    if (assembled.kind === "closed-line") return Run.#noFrame(request);
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
    if (wave !== null && !wave.ok) {
      return {
        kind: "refused",
        verdict: wave,
        checked: verdict.checked,
        tree: this.#lifecycle.waveTreeOf(frame),
        hop: this.#stepReads.hopOf?.(frame) ?? null,
      };
    }
    return {
      kind: "pass",
      frame,
      host: this.#host(),
      // The brief's cell follows the SAME target-row cell the landing reads: off the task
      // face no brief lands, so a preview names none — and on it the cell is the read
      // input's repo-relative coordinate, the same basis every other name here takes.
      brief: TargetFaces.advancesBatch(frame.type)
        ? String(this.#workspace.relOf(this.#briefName(frame)))
        : "",
      writes: this.#ledger.writeSetOf(
        frame.key,
        Lifecycle.opOf(frame.phase),
        frame.round,
        frame.attempt,
      ),
      ledger: { row: Ledger.rowCoordinateOf(frame.key), op: Lifecycle.opOf(frame.phase) },
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
    // A closed line is a perfectly good board: the SCENE is all the board reads, and the
    // dispatch cells (phase, round, attempt) are the dispatch entry's own.
    const scene = assembled.kind === "closed-line" ? assembled.scene : assembled;
    const holding = await this.inflight.inspect();
    const documents = this.#ledger.read();
    return {
      kind: "board",
      slug: scene.slug,
      rows: this.#rowsOf(scene, holding),
      facts: {
        orphans: this.#ledger.orphanHandoffs(),
        crashed: this.#ledger.crashedOf(this.#ledger.nodeRecordsOf(documents)),
        refusal: this.#refusal.read(scene.slug),
      },
      observed: this.#ledger.observedArtifacts(),
      phases: await this.#phasesOf(scene),
    };
  }

  /** The charter's phase rows — a program board's own rows and nothing else. A phase is its
   *  own workspace, so each one arrives as its OWN board read; this class composes the row and
   *  the injected seam only says which phases exist. */
  async #phasesOf(scene: FrameScene): Promise<readonly BoardPhase[]> {
    if (scene.type !== "overall" || this.#board === null) return [];
    const phases: BoardPhase[] = [];
    for (const phase of await this.#board.phases(scene.slug)) {
      const row = Run.phaseOf(phase.slug, phase.board);
      if (row !== null) phases.push(row);
    }
    return phases;
  }

  /** One phase's program row, from that phase's OWN board read — the same facts a node board
   *  prints, read at the charter's altitude. Null when the phase's own read answered a usage
   *  value (a phase whose documents do not resolve is not a row). */
  static phaseOf(slug: string, own: BoardOutcome): BoardPhase | null {
    if (own.kind !== "board") return null;
    const docs = own.rows.filter(
      (row): row is Extract<BoardRow, { kind: "doc" }> => row.kind === "doc",
    );
    const spec = docs.find((row) => row.line === "phase-spec" || row.line === "single-spec");
    const plan = docs.find((row) => row.line === "plan");
    const branch = own.rows.find(
      (row): row is Extract<BoardRow, { kind: "branch" }> => row.kind === "branch",
    );
    const waves = own.rows.filter(
      (row): row is Extract<BoardRow, { kind: "wave" }> => row.kind === "wave",
    );
    const cells: BoardPhaseCell[] = [];
    if (spec !== undefined) cells.push({ key: "spec", rounds: spec.rounds });
    if (plan !== undefined) cells.push({ key: "plan", rounds: plan.rounds });
    if (branch !== undefined) cells.push({ key: "branch", rounds: branch.rounds });
    return {
      slug,
      status: spec?.doc?.status ?? null,
      title: spec?.doc?.title ?? null,
      wave: waves.length === 0 ? null : `W${Run.#waveIndexOf(own.rows, waves[0])}`,
      cells,
    };
  }

  /** The board's rows: the occupancy, the ONE next hop, every document line, every wave line
   *  and the branch line — each cell a fact, none a judgment. */
  #rowsOf(scene: FrameScene, holding: InFlightState): readonly BoardRow[] {
    const rows: BoardRow[] = [
      { kind: "in-flight", state: holding },
      { kind: "next", hop: this.#pipeline.hopOf(scene.pipeline) },
    ];
    for (const line of Run.#docLinesOf(scene)) {
      rows.push({
        kind: "doc",
        line: line.word,
        doc: this.#docOf(line.doc),
        rounds: this.#roundsOf(line.word, this.#ledger.rounds(line.word)),
      });
    }
    for (const row of this.#waveRowsOf(scene)) rows.push(row);
    // The branch line is a FIXED row of the node board — a branch that recorded no round is
    // still a line the board reports (its state word, and no tokens).
    const branch = this.#ledger.branchLine();
    rows.push({
      kind: "branch",
      state: this.#lines.stateOf("branch", "branch", scene.pipeline.planPath),
      rounds: branch === null ? [] : this.#roundsOf(branch.line, branch.rounds),
    });
    return rows;
  }

  /** The board's wave rows — the PLAN's own decomposition, each wave paired with the ledger
   *  row that recorded it (matched by its task set). The plan is what names a wave, so a wave
   *  nobody dispatched yet still prints its row (`○`), and a ledger row whose task set no
   *  longer appears in the plan is not a wave of this tree. Only when the plan reads nothing
   *  (no graph) does the ledger's own row set stand in — the board reports what it can see. */
  #waveRowsOf(scene: FrameScene): readonly BoardRow[] {
    const recorded = this.#ledger.waveLines();
    const byTasks = new Map<string, WaveLine>();
    for (const line of recorded) byTasks.set([...line.taskIds].sort(Run.#asc).join(","), line);
    const waves =
      scene.graph === null
        ? recorded.map((line) => ({ tasks: line.taskIds, line }))
        : scene.graph.batches().map((batch) => ({
            tasks: [...batch].sort(Run.#asc),
            line: byTasks.get([...batch].sort(Run.#asc).join(",")),
          }));
    const rows: BoardRow[] = [];
    let frontier = true;
    for (const wave of waves) {
      const lineWord = RoundIdentity.lineWordOf("wave", wave.tasks.join(","));
      const closed =
        wave.line === undefined ? false : this.#lines.waveClosedAt(wave.tasks.join(","));
      // Exactly one row carries `▶`: the FIRST wave still holding an open task.
      const isFrontier = frontier && !closed;
      if (isFrontier) frontier = false;
      rows.push({
        kind: "wave",
        line: lineWord,
        tasks: wave.tasks,
        frontier: isFrontier,
        closed,
        rounds: wave.line === undefined ? [] : this.#roundsOf(wave.line.line, wave.line.rounds),
      });
    }
    return rows;
  }

  /** The board's ordinal sort — numeric, so `{2, 10}` reads in task order. */
  static #asc(left: number, right: number): number {
    return left - right;
  }

  /** One line's rounds, as the board's tokens read them — the record's own cells plus the
   *  carrier content the ledger's ONE read answers. The downgrade note is composed by the
   *  criteria slice's one composer, never here. */
  #roundsOf(word: string, records: readonly RoundRecord[]): readonly BoardRound[] {
    const carriers = new BoardCarriers({
      records,
      line: word,
      pathOf: (record) => {
        const { type, key } = Run.#carrierTargetOf(word);
        const rel = this.#ledger.carrierPathOf(type, key, record);
        // The carrier's diagnostic line names the deck's OWN absolute coordinate (the file a
        // reader opens), never a workspace-relative spelling.
        return rel === "" ? "" : (this.#workspace.resolve(rel.split("/").pop() ?? "") as never);
      },
      text: (target) => {
        const read = this.#workspace.readText(target);
        return read.kind === "text" ? read.value : null;
      },
    });
    return records.map((record) => {
      const content = carriers.contentOf(record);
      const regrade = carriers.regradeOf(record);
      return {
        op: record.op,
        cycle: record.cycle,
        attempt: record.attempt,
        passed: record.verdict.targetAction,
        findings: content.findings.length,
        ...(regrade === undefined ? {} : { regrade }),
        notes: content.notes,
      };
    });
  }

  /** One document line's header cells — read through the injected document face, or null when
   *  that face is unwired or the document does not read. */
  #docOf(target: string | null): BoardDoc | null {
    if (target === null || this.#board === null) return null;
    const facts = this.#board.docFacts(target as RepoPath);
    if (facts === null) return null;
    return {
      name: target.split("/").pop() ?? target,
      version: facts.version,
      status: facts.status,
      title: facts.title,
    };
  }

  /** The `(type, key)` a line word's carriers resolve through — the wave line's ids are its
   *  own key, every other line word is both. */
  static #carrierTargetOf(word: string): { readonly type: string; readonly key: string } {
    const { kind, key } = RoundIdentity.splitLineWord(word);
    return { type: kind === "wave" ? "wave" : word, key };
  }

  /** A wave row's ordinal among the board's WAVE rows (1-based) — the label's own number. */
  static #waveIndexOf(rows: readonly BoardRow[], row: BoardRow | undefined): number {
    let index = 0;
    for (const entry of rows) {
      if (entry.kind !== "wave") continue;
      index += 1;
      if (entry === row) return index;
    }
    return index;
  }

  /** A document line's target type — the line word IS the type word for a document line, so
   *  no second table is needed. */
  static docTypeOf(line: string): TargetType {
    return line as TargetType;
  }

  /** The three document lines a node board prints, in the board's order — the charter row,
   *  the judged document's row (its declared type word) and the plan's row. A line whose
   *  document the scene never resolved still gets its row: the absence is a printed cell,
   *  never a missing row, so a board's row set is the same on every tree. */
  static #docLinesOf(
    scene: FrameScene,
  ): readonly { readonly word: string; readonly doc: string | null }[] {
    return [
      {
        word: "overall",
        doc: scene.type === "overall" ? scene.doc : scene.overall,
      },
      { word: scene.pipeline.specType ?? "phase-spec", doc: scene.pipeline.specPath },
      { word: "plan", doc: scene.pipeline.planPath },
    ];
  }

  /** The one usage member the DISPATCH entries answer for a line that holds no open round —
   *  the fill value is the command word the caller typed. */
  static #noFrame(request: FrameRequest): Usage {
    return { kind: "usage", reason: { kind: "no-frame", command: request.command } };
  }

  /** The tree's refusal as THIS workspace sees it — the phase's own standing refusal, or
   *  `absent` when another slug's record stands (that one is the other phase's fact). The
   *  unfiltered read (`Refusal#readRaw`) belongs to the release point, which clears the
   *  tree's fact rather than one workspace's view of it. */
  refusalOf(slug: string): RefusalState {
    return this.#refusal.read(slug);
  }
}
