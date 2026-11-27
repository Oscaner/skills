// packages/cdd-engine/src/run/advance/lifecycle.ts
// One dispatch step: frontier → gate → dispatch → read-back → bookkeeping → next routing.
//
// INVARIANT — one `advance` call is ONE step of ONE dispatch: it consumes at most one
// attempt, books at most one round, and advances the frontier by at most one cell. The
// target type's difference never appears here as a branch — it is the `target-faces` row the
// step reads.
//
// Four anchor points this file owns, and no other caller may move them:
//
//   · THE SETTLE POINT. `PreFlight#settle` is called exactly once per step, AFTER `vet`
//     returns and BEFORE the takeover authorization is consulted. The order is the whole
//     point: a dispatch that cleared the structural leg has invalidated every structural
//     refusal the tree was carrying (the facts the record stated no longer hold), so the
//     approved dispatch clears the door's fact and a refused one lands the record its own
//     verdict carries. Moving the settle after the authorization would let a `tree-clean`
//     record outlive its fact through a dispatch that never refused on the structural leg.
//     `previewOf` never comes here — a preview calls `vet` and stops, which is why
//     `--dry-run` writes nothing.
//
//   · THE BRIEF LANDS BEFORE THE DISPATCH, ONCE, ON THE TASK FACE ALONE. The rendered
//     brief's bytes reach the dispatch's workspace through the injected write face, and the
//     returned repository coordinate is what `INPUT_WAVE_BRIEF` prints. The artifact is the
//     target row's batch cell, so a doc or branch dispatch lands nothing — no brief on disk
//     that no cell reads, and a preview names none. A failed write is the SAME shape as a
//     failed skeleton landing: no child starts, no cycle and no attempt moves, and the
//     declared value goes back untouched (its bytes belong to the render face).
//
//   · THE DISPATCH BASELINE IS MEASURED ONCE, AND WRITTEN TWICE. The HEAD the dispatch
//     starts from is read at one point in the step (after the last refusal, before the
//     in-flight record exists) and recorded on BOTH writes — the in-flight record and the
//     round record — because two facts are read off it: the round's own range (`touchedDoc`)
//     and the group baseline a completion judgment names. A step that read it twice, or wrote
//     it to one record and not the other, would leave the judgment and the postmortem talking
//     about two different HEADs.
//
//   · THE EVIDENCE READ HAS ONE PRODUCER AND TWO CONSUMERS. The test-evidence file is read
//     once, in the booking, and its verdict fills the completion criterion's `evidenceOk` cell
//     and the round's hard entry — a round never pays for two reads of one file, and a round
//     can never be refused on evidence the criterion called green.
//
//   · THE CARRIER READ-BACK IS CHECKED. The round's findings and work status arrive through
//     the dispatch segment's checked read (a digest mismatch throws there), so a tampered
//     carrier is never judged as if the round had produced those bytes.
//
//   · THE REVIEWED VERSION IS BOUND TO ITS OWN LINE, ON A COMPLETED ROUND. A round's input
//     is bound at the booking, under the LINE's word (never the document path — the ledger keys
//     a row by the line, and a path-keyed row would answer a line that is not a target type at
//     all), and only when the booked verdict holds its target action. Each line kind has ONE
//     cell: a document line records `doc_hash`, a wave line records the task-only `brief`
//     projection that landed for that dispatch. `review` and `branch-review` bind the version
//     they judged; `fix` binds the version it PRODUCED, so its own edits cannot reopen the line
//     it just closed — which is why a fix binds only when its own commits touched the input it
//     judges: a fix that edited nothing produced no version, and recording the bytes some
//     out-of-round movement left behind would launder them as reviewed; an implement round binds
//     nothing. An UNMEASURABLE range is not that case — nothing was measured, so the binding
//     stands and the round books `WRITE_BACK_UNMEASURED`.
//
//   · THE LINE LEG RUNS BEFORE THE LANDING. The wave gate is the task face's own pre-flight:
//     a request its five rows refuse is never dispatched, and the refusal rides the same
//     read-only `checked` rows a preview reports for the same tree. The applicability is the
//     target row's audit cell, never a type word, so a doc or branch face is not judged by a
//     task gate at all.
//
// Failure values are declared and nothing here spells a sentence: a refusal is the gate's
// verdict, a hold is the in-flight record's state, and a usage is the frame's own union.
//
// Module-level exports are types and the class — zero behaviour-carrying bare functions.

/** The write-back gate's own observation — a round that could not MEASURE whether its own
 *  commits touched the input it binds keeps the previous binding and books this fact, so the
 *  blindness is on record instead of passing as "untouched". The old tree's sentence, byte
 *  for byte: an operator reading a ledger row should not have to learn a second wording for
 *  the same blindness. */
const WRITE_BACK_UNMEASURED =
  "the reviewed-revision write-back could not measure whether this round touched the document (no dispatch baseline or an unreadable repository) — the current bytes were bound";

import { CompletionCriteria, type CompletionFacts } from "../../docs/judging/completion.ts";
import { regradeNote } from "../../docs/judging/criteria.ts";
import type { Finding } from "../../docs/judging/invariants.ts";
import type { WriteOutcome } from "../../env/workspace/workspace.ts";
import type { Child, DispatchFrame, TerminationCause } from "../dispatch/child.ts";
import {
  CONTRACT_VIOLATION,
  type EvidenceRead,
  Handoff,
  type RoundFinding,
} from "../dispatch/handoff.ts";
import type { InFlight, InFlightState } from "../dispatch/inflight.ts";
import type { Authority } from "../gate/authority.ts";
import type {
  CheckedRow,
  PreFlight,
  PreFlightContext,
  PreFlightVerdict,
} from "../gate/preflight.ts";
import type { RoundRecord, RoundRecordInit, RoundViolation } from "../ledger/ledger.ts";
import { ReviewedIdentity } from "../ledger/reviewed.ts";
import type { FrameFacts, UsageReason } from "./frame.ts";
import type { CarriedFacts } from "./line-phase.ts";
import { NextRoutes, type RoundFacts, type Route } from "./next.ts";
import { TargetFaces } from "./target-faces.ts";
import type { WaveGate, WaveInput, WaveVerdict } from "./wave.ts";

/** The dispatch's own result, as the step reports it — the child's exit, the log's
 *  coordinate and how the round ended. */
export interface StepResult {
  /** The child's exit code; null when it never spawned. */
  readonly code: number | null;
  /** The round log's repository coordinate. */
  readonly log: string;
  /** The termination cause, or null when the round ended by itself. */
  readonly termination: string | null;
  /** The brief's landed repository coordinate — the value `INPUT_WAVE_BRIEF` prints; empty
   *  off the task face, where no brief lands. */
  readonly brief: string;
  /** The round this step booked. */
  readonly round: RoundRecord;
  /** The route the booked round selects. */
  readonly route: Route | null;
}

/** The capsule's summary facts — the ONE regrade note a judge round contributes. An absent
 *  `summary` means the cell is not rendered at all (zero empty slot, zero shifted slot). */
export interface CapsuleFacts {
  /** The composed note (`docs/judging/criteria.ts#regradeNote`'s own value). */
  readonly summary?: string;
}

/** One step's answer — the closed set the facade hands the shell. */
export type AdvanceOutcome =
  | {
      readonly kind: "dispatch";
      readonly result: StepResult;
      readonly capsule: CapsuleFacts;
      readonly checked: readonly CheckedRow[];
    }
  /** The structural leg refused before the dispatch. */
  | {
      readonly kind: "blocked";
      readonly leg: "structure";
      readonly verdict: PreFlightVerdict;
      readonly checked: readonly CheckedRow[];
    }
  /** The wave gate refused before the dispatch — the task face's own line leg. */
  | {
      readonly kind: "blocked";
      readonly leg: "line";
      readonly verdict: WaveVerdict;
      readonly checked: readonly CheckedRow[];
    }
  /** The in-flight gate holds the tree — the record's own state value rides along. */
  | {
      readonly kind: "held";
      readonly state: InFlightState;
      readonly checked: readonly CheckedRow[];
    }
  | { readonly kind: "usage"; readonly reason: UsageReason }
  | { readonly kind: "read-failure"; readonly target: string }
  | { readonly kind: "write-failure"; readonly target: string };

/** The brief landing: the workspace-relative name, the bytes the injected renderer produced
 *  (one render, zero second spelling of the name here) and the task-only PROJECTION those
 *  bytes were rendered from. */
export interface BriefLanding {
  readonly name: string;
  readonly content: string;
  /** The task-only projection the brief was rendered from — the stable version a wave round
   *  binds. The landed bytes also carry the round-context section, which changes with every
   *  dispatch, so hashing THEM would read drift for every wave line after its next round.
   *  Absent when the projection cannot be derived: present facts only, so the binding then
   *  records nothing rather than a version no later round could match. */
  readonly reviewed?: string;
}

/** The landed brief — the repository coordinate the write face answered and the projection the
 *  round binds. A review round binds that projection as the version it reviewed, so the landing
 *  is handed to the booking rather than re-rendered there; the landed BYTES are not a cell, so a
 *  later round compares the projection instead of the round-context section that moved. */
interface LandedBrief {
  readonly path: string;
  readonly reviewed?: string;
}

/** The evidence gate's input: the file's workspace coordinate (the artifact identity's own
 *  name) and its read-back. One read answers two consumers — the criterion's `evidenceOk` cell
 *  and the round's hard entry — so a round never pays for two reads of one file. */
export interface EvidenceFile {
  readonly target: string;
  readonly read: EvidenceRead;
}

/** The lifecycle's write face over the fact layer — the events one step lands, each through
 *  the ledger's ONE writer. */
export interface LifecycleLedger {
  recordRound(line: string, init: RoundRecordInit): RoundRecord;
  closeWave(line: string, planTasks: readonly number[]): void;
  recordDocReview(line: string, content: string): void;
  /** Record the version a FIX round produced — the same `doc_hash` cell a review writes, with
   *  the line's review-batch counter untouched: a fix moves the version it edited, but it opens
   *  no review batch. */
  recordReviewedDoc(line: string, content: string): void;
  /** Record the version a WAVE line reviewed — its task-only brief projection. Each line kind
   *  has ONE reviewed cell: a document line's version is the ledger's own `doc_hash`
   *  (`recordDocReview` / `recordReviewedDoc`), a wave line's is this `brief` identity, and no
   *  line writes both. */
  recordReviewed(line: string, reviewed: ReviewedIdentity): void;
}

/** The step's reads and side-effect seams — every one of them is a fact the composition root
 *  wires from `env/`, `docs/` or `surface/`, so this file assembles nothing itself. */
export interface LifecycleReads {
  /** The gate context of this dispatch (the plan graph, the ledger fact bundle, the document
   *  target and the four station rows). */
  readonly preflight: (frame: FrameFacts, holding: InFlightState) => PreFlightContext;
  /** The child's frame — the argv, the environment and the log's coordinate. */
  readonly dispatchFrame: (frame: FrameFacts, briefPath: string) => DispatchFrame;
  /** The brief's name, its bytes and the task-only projection the wave line's reviewed version
   *  hashes (one render, three cells). */
  readonly brief: (frame: FrameFacts) => BriefLanding;
  /** The workspace's text write face (workspace basis). */
  readonly writeText: (name: string, content: string) => WriteOutcome;
  /** The checked carrier read of the round this frame dispatched. */
  readonly carried: (frame: FrameFacts) => Promise<CarriedFacts>;
  /** The findings of the most recent judged record carrying a non-empty set — the regrade
   *  judgment's reference. */
  readonly priorFindings: (frame: FrameFacts) => readonly RoundFinding[];
  /** The plan's task set, read at the closure point (a wave row's historical snapshot). */
  readonly planTasks: () => readonly number[];
  /** The reviewed document's CURRENT bytes, for the review line's version binding; null when
   *  the frame has no document. */
  readonly docText: (frame: FrameFacts) => string | null;
  /** Whether a stale in-flight record names the round this frame dispatches (the abort
   *  takeover's own factual cell). */
  readonly stale: (frame: FrameFacts, holding: InFlightState) => boolean;
  /** Whether the drifted line asks for a reopen — the takeover's second leg's factual cell. */
  readonly reopenRequested: (frame: FrameFacts) => boolean;
  /** The requesting review's carrier, as a fix round reads it: the findings its dispositions
   *  must cover and the two coordinates the fix hop carries. Empty off the fix face. */
  readonly requesting: (frame: FrameFacts) => {
    readonly findings: readonly RoundFinding[];
    readonly reviews?: string;
    readonly rulings?: string;
  };
  /** The commits the round's group produced since its baseline. */
  readonly commits: (base: string) => number;
  /** The group's RECORDED dispatch baseline — the EARLIEST round record's `dispatchBase` on
   *  this line, and the HEAD a zero-commit refusal names. Null while no record carries one (a
   *  group's first dispatch, before this step writes its own record): the step then falls back
   *  to the HEAD it just measured, which IS the record the booking is about to write. */
  readonly groupBase: (frame: FrameFacts) => string | null;
  /** The HEAD this dispatch starts from — the round's own dispatch baseline, read ONCE per
   *  step (in `advance`, after the last refusal and before the in-flight record exists). Both
   *  records carry this one value and `touchedDoc` measures its range against it, so the step
   *  never invents a baseline a record does not hold. Null on a tree with no HEAD (a non-repo,
   *  or a branch with no commit yet). */
  readonly head: () => Promise<string | null>;
  /** Whether THIS round's own commits touched the input the round binds — a document line's
   *  document, a wave line's plan. The git read (`base..HEAD`'s path set) and the comparison
   *  against that coordinate are the seam's, because the repository basis is: this segment does
   *  no path work, so the fact arrives folded. THREE answers, and the third is the one that
   *  matters: `true` / `false` off a READABLE range, and `null` when the range cannot be read
   *  (no baseline, an unreadable repository). `null` is not `false` — nothing was measured, so
   *  the binding stands and the round books `WRITE_BACK_UNMEASURED`. */
  readonly touchedDoc: (frame: FrameFacts, base: string | null) => boolean | null;
  /** The round's test-evidence file as the evidence gate reads it. Read once in the booking;
   *  a face that owes no evidence file is never asked. */
  readonly evidence: (frame: FrameFacts) => EvidenceFile;
  /** The consecutive-blocker run the round at `frame.round` closes — the soft cap's ONE
   *  counter, read off the line's completed review rounds. */
  readonly blockerRun: (frame: FrameFacts) => number;
}

/** The construction facts. */
export interface LifecycleOptions {
  readonly gate: PreFlight;
  readonly authority: Authority;
  readonly inflight: InFlight;
  readonly child: Child;
  readonly ledger: LifecycleLedger;
  readonly reads: LifecycleReads;
  /** The wave gate — the task face's line leg, judged by this step and reported by a
   *  preview from the SAME verdict. */
  readonly waveGate: WaveGate;
  /** The wave gate's input for one frame (the plan's graph, the closed set, the wave rows and
   *  the phase read). */
  readonly waveInput: (frame: FrameFacts) => WaveInput;
}

/**
 * Lifecycle — one dispatch step. Invariant: one call consumes at most one attempt, books at
 * most one round and moves the frontier at most one cell (see the file's header).
 *
 * Rule zero (over the 200-line class limit): the class stays whole because its members ARE
 * the one step's order — gate, settle, line leg, landing, dispatch, verdict, booking, route;
 * splitting it would let a caller run a prefix of the step and book a round it never judged.
 */
export class Lifecycle {
  readonly #gate: PreFlight;
  readonly #authority: Authority;
  readonly #inflight: InFlight;
  readonly #child: Child;
  readonly #ledger: LifecycleLedger;
  readonly #reads: LifecycleReads;
  readonly #waveGate: WaveGate;
  readonly #waveInput: (frame: FrameFacts) => WaveInput;
  readonly #routes = new NextRoutes();

  constructor(opts: LifecycleOptions) {
    this.#gate = opts.gate;
    this.#authority = opts.authority;
    this.#inflight = opts.inflight;
    this.#child = opts.child;
    this.#ledger = opts.ledger;
    this.#reads = opts.reads;
    this.#waveGate = opts.waveGate;
    this.#waveInput = opts.waveInput;
  }

  /** The line leg's judgment for one frame, or null when the frame's row audits no task
   *  graph (the wave gate is the task face's own pre-flight). ONE producer: `advance` refuses
   *  on it and a preview reports the same verdict, so the two entries never give two
   *  conclusions for one tree. */
  waveVerdictOf(frame: FrameFacts): WaveVerdict | null {
    if (!TargetFaces.isTaskGraph(frame.type)) return null;
    return this.#waveGate.vet(
      new Set(frame.tasks),
      Lifecycle.#waveVerbOf(frame),
      this.#waveInput(frame),
    );
  }

  /** Run one step of one dispatch. */
  async advance(frame: FrameFacts): Promise<AdvanceOutcome> {
    const holding = await this.#inflight.inspect();
    const verdict = await this.#gate.vet(this.#reads.preflight(frame, holding));
    // THE settle point: after the judgment, before the takeover authorization.
    this.#gate.settle(verdict);
    if (!verdict.ok) return Lifecycle.#refused(verdict, holding);
    // The takeover is the EXPLICIT flag's path, and only its path: without `--recover` the
    // legs are not consulted at all, so an ordinary dispatch is never stopped by the
    // double-gap row (that row is what a takeover request earns when no leg holds).
    if (frame.recover) {
      const authorization = this.#authority.takeover({
        verdict,
        stale: this.#reads.stale(frame, holding),
        reopenRequested: this.#reads.reopenRequested(frame),
      });
      if (authorization.kind === "blocked") {
        return { kind: "blocked", leg: "structure", verdict, checked: verdict.checked };
      }
    }
    // The line leg, on the same read-only `checked` rows: a request the wave gate refuses is
    // never dispatched, and the response is the same refusal a preview answers.
    const wave = this.waveVerdictOf(frame);
    if (wave !== null && !wave.ok) {
      return { kind: "blocked", leg: "line", verdict: wave, checked: verdict.checked };
    }
    const landing = await this.#land(frame);
    if (landing.kind === "write-failure") return landing;
    // THE DISPATCH BASELINE — measured once, written twice. It anchors this round's own range
    // (`touchedDoc`) and, on a group's first round, is the group baseline its completion
    // judgment names, so it is taken HERE: after the last refusal and before the in-flight
    // record exists. Reading it anywhere else would let the record and the judgment disagree
    // about the HEAD this dispatch started from.
    const base = await this.#reads.head();
    return this.#dispatch(frame, landing.landed, verdict, base);
  }

  /** Land the brief, or answer its declared failure — the ONE write before the child exists.
   *  The brief is the TASK face's artifact (the target row's batch cell), so a doc or branch
   *  dispatch lands none: `INPUT_WAVE_BRIEF` stays empty there and a preview names no brief a
   *  real dispatch would never write. */
  async #land(
    frame: FrameFacts,
  ): Promise<{ kind: "landed"; landed: LandedBrief } | AdvanceOutcomeFail> {
    if (!TargetFaces.advancesBatch(frame.type)) {
      return { kind: "landed", landed: { path: "" } };
    }
    const brief = this.#reads.brief(frame);
    const outcome = this.#reads.writeText(brief.name, brief.content);
    if (outcome.kind === "write-failure") {
      return { kind: "write-failure", target: String(outcome.target) };
    }
    return {
      kind: "landed",
      landed: { path: String(outcome.target), reviewed: brief.reviewed },
    };
  }

  /** Dispatch inside the tree's occupancy, then book and route the round. */
  async #dispatch(
    frame: FrameFacts,
    landed: LandedBrief,
    verdict: PreFlightVerdict,
    base: string | null,
  ): Promise<AdvanceOutcome> {
    const record = await this.#inflight.recordOf({
      pid: process.pid,
      command: frame.command,
      slug: frame.slug,
      wave: TargetFaces.advancesBatch(frame.type) ? frame.tasks.join(",") : null,
      phase: frame.phase,
      cycle: frame.round,
      attempt: frame.attempt,
      plan: frame.planPath,
      // The same measured HEAD the booked round records: a crash postmortem reads this cell
      // to know where the dead round started, and a step that invented a second baseline here
      // would leave the two records disagreeing about one dispatch.
      dispatchBase: base,
    });
    const occupancy = await this.#inflight.occupy(
      record,
      () => this.#child.dispatch(this.#reads.dispatchFrame(frame, landed.path)),
      {
        ending: (outcome) =>
          outcome.code === 0 && outcome.termination === null ? "normal" : "abnormal",
      },
    );
    if (occupancy.kind === "held") {
      const state = await this.#inflight.inspect();
      return { kind: "held", state, checked: verdict.checked };
    }
    const carried = await this.#reads.carried(frame);
    const booked = this.#book(frame, carried, landed, {
      findings: Lifecycle.#baselineOf(verdict.findings ?? []),
      code: occupancy.value.code,
      termination: occupancy.value.termination,
      base,
    });
    const capsule = this.#capsuleOf(frame, carried);
    return {
      kind: "dispatch",
      result: {
        code: occupancy.value.code,
        log: String(occupancy.value.log),
        termination: occupancy.value.termination,
        brief: landed.path,
        round: booked.round,
        route: booked.route,
      },
      capsule,
      checked: verdict.checked,
    };
  }

  /** Book the round and its line's derived facts. The route is read AFTER the booking, so a
   *  closing round answers the closure the ledger now records rather than the state before
   *  it. The VERDICT is derived here, from the dispatch's own result and the round's graded
   *  entries — a round that withheld its target action is never booked as completed. */
  #book(
    frame: FrameFacts,
    carried: CarriedFacts,
    landed: LandedBrief,
    dispatch: {
      readonly findings: readonly RoundFinding[];
      readonly code: number | null;
      readonly termination: TerminationCause | null;
      /** The dispatch baseline this round records — the group's start when no earlier record
       *  carries one. */
      readonly base: string | null;
    },
  ): { round: RoundRecord; route: Route | null } {
    // The two reads the booking owns happen ONCE, before the record is written: the round's
    // own-bytes fact (the binding's gate, and the blindness it books) and the evidence read
    // (the criterion's `evidenceOk` cell AND the round's hard entry).
    const touched = this.#touchedOf(frame, dispatch.base);
    const evidence = Lifecycle.#owesEvidence(frame) ? this.#reads.evidence(frame) : null;
    const violations = [
      ...Lifecycle.#violationsOf(carried, dispatch.findings),
      ...Lifecycle.#dispatchViolationsOf(dispatch),
      ...this.#completionOf(frame, carried, dispatch.base, evidence),
      ...Lifecycle.#evidenceOf(evidence),
      ...Lifecycle.#writeBackOf(touched),
    ];
    const round = this.#ledger.recordRound(frame.key, {
      op: Lifecycle.#opOf(frame.phase),
      cycle: frame.round,
      attempt: frame.attempt,
      // The dispatch baseline belongs to the RECORD, not to a local: it is the group baseline
      // the completion judgment reads back on every later round of this line.
      dispatchBase: dispatch.base,
      verdict: {
        treeClean: true,
        targetAction: !violations.some((violation) => violation.grade === "hard"),
      },
      violations,
    });
    const route = this.#routes.routeOf(
      this.#roundFactsOf(frame, carried, this.#readyBatchOf(frame)),
    );
    if (
      NextRoutes.routeClosed(route) &&
      round.verdict.targetAction &&
      TargetFaces.advancesBatch(frame.type)
    ) {
      this.#ledger.closeWave(frame.key, this.#reads.planTasks());
    }
    this.#bindReviewed(frame, landed, round.verdict.targetAction, touched);
    return { round, route };
  }

  /** The round's own-bytes fact, measured only where a binding could read it: an implement
   *  round binds nothing, so it is not measured and books nothing. */
  #touchedOf(frame: FrameFacts, base: string | null): boolean | null | undefined {
    if (Lifecycle.#opOf(frame.phase) === "implement") return undefined;
    return this.#reads.touchedDoc(frame, base);
  }

  /** Bind the version this round reviewed to its OWN line — the one written fact a drift
   *  reopen reads back. The binding rides the BOOKED verdict (`targetAction`): a round that
   *  withheld its target action reviewed or produced nothing, so it binds nothing. Each line
   *  kind has ONE cell: a document line records `doc_hash`, a wave line records the task-only
   *  `brief` projection that landed for that dispatch, and no line writes both.
   *
   *  A `review` / `branch-review` binds the version it JUDGED. A `fix` is in the set because it
   *  EDITS the input it judges — without its own binding a completed fix would leave the pre-fix
   *  revision on record and its own bytes would read as an out-of-round drift the moment it
   *  closed its line — so it binds the version it PRODUCED, and only when its OWN commits
   *  touched that input: a fix that edited nothing produced no version, and binding the current
   *  bytes anyway would record an out-of-round movement as reviewed and close a line no round
   *  has read. An UNMEASURABLE range is not that case: nothing was measured, so the bind stands
   *  and the round has booked `WRITE_BACK_UNMEASURED`. Only a review OPENS a batch: a fix moves
   *  the recorded version and leaves the line's review-batch counter alone. */
  #bindReviewed(
    frame: FrameFacts,
    landed: LandedBrief,
    completed: boolean,
    touched: boolean | null | undefined,
  ): void {
    if (!completed) return;
    const op = Lifecycle.#opOf(frame.phase);
    if (op === "implement") return;
    if (op === "fix" && touched === false) return;
    if (TargetFaces.advancesBatch(frame.type)) {
      if (landed.reviewed === undefined) return;
      this.#ledger.recordReviewed(
        frame.key,
        ReviewedIdentity.record("brief", landed.path, landed.reviewed),
      );
      return;
    }
    const text = frame.doc === null ? null : this.#reads.docText(frame);
    if (frame.doc === null || text === null) return;
    if (op === "fix") this.#ledger.recordReviewedDoc(frame.key, text);
    else this.#ledger.recordDocReview(frame.key, text);
  }

  /** The ready batch a closure reads — the plan's next open wave once THIS round's wave is
   *  done: the wave gate's OWN frontier derivation over the closure set plus this round's
   *  tasks (no second decomposition, no second sort). Empty off the batch faces, where the
   *  closure answers `done` because no batch continues the run. */
  #readyBatchOf(frame: FrameFacts): readonly number[] {
    if (!TargetFaces.advancesBatch(frame.type) || frame.graph === null) return [];
    const closed = new Set(this.#waveInput(frame).closed);
    for (const task of frame.tasks) closed.add(task);
    return this.#waveGate.derivedWave(frame.graph, closed);
  }

  /** The judge round's capsule summary — the ONE composition of the downgrade note. A work
   *  round contributes nothing here; a judge round feeds the two partitions of the carrier's
   *  findings (each read from the dispatch segment's own judgment) to the criterion slice's
   *  `regradeNote`, and an absent note leaves the cell out entirely. */
  #capsuleOf(frame: FrameFacts, carried: CarriedFacts): CapsuleFacts {
    if (frame.phase !== "review" && frame.phase !== "branch-review") return {};
    const current = carried.findings ?? [];
    const prior = this.#reads.priorFindings(frame);
    const owing = Handoff.downgrades(prior, current).length;
    const note = regradeNote(owing, Handoff.regradeReasons(prior, current));
    return note === undefined ? {} : { summary: note };
  }

  /** The APPROVED gate's document findings as round findings — the baseline observation a
   *  round carries. The two severities are different vocabularies (`block` / `warn` versus
   *  `blocker` / `warn` / `nit`), so the fold happens here and nowhere else. */
  static #baselineOf(findings: readonly Finding[]): readonly RoundFinding[] {
    return findings.map((finding) => ({
      severity: finding.severity === "block" ? ("blocker" as const) : ("warn" as const),
      summary: finding.message,
    }));
  }

  /** The round's graded violations: a breaching carrier is the hard one, and every BLOCK
   *  finding the APPROVED gate already reported is a SOFT baseline observation (the round
   *  owns only what it added). A judge round's findings never become violations here — its
   *  conclusion is the carrier's own. */
  static #violationsOf(
    carried: CarriedFacts,
    gateFindings: readonly RoundFinding[],
  ): readonly RoundViolation[] {
    const violations: RoundViolation[] = [];
    for (const finding of gateFindings) {
      violations.push({ grade: "soft", cause: "doc-contract", message: finding.summary ?? "" });
    }
    if (carried.status === "BLOCKED") {
      violations.push({ grade: "hard", cause: "round-blocked", message: "" });
    }
    return violations;
  }

  /** The dispatch's own hard facts: a child that exited non-zero never produced its target
   *  action, and a round cut short by a termination cause carries that cause as its entry.
   *  Both withhold the completion verdict, so neither is a silent absence. */
  static #dispatchViolationsOf(dispatch: {
    readonly code: number | null;
    readonly termination: TerminationCause | null;
  }): readonly RoundViolation[] {
    const violations: RoundViolation[] = [];
    if (dispatch.code !== 0) {
      violations.push({ grade: "hard", cause: "child-exit", message: "" });
    }
    if (dispatch.termination !== null) {
      violations.push({ grade: "hard", cause: dispatch.termination, message: "" });
    }
    return violations;
  }

  /** The round's completion judgment — the frame's OWN verb, judged by that verb's criterion
   *  in `docs/judging/completion.ts` over the facts this segment assembles. A callback answers
   *  at most one refusal plus the soft observations, and the refusal is the hard entry that
   *  withholds the booking's `targetAction`: a review round that persisted no judge carrier and
   *  an implement round that committed nothing are refused here, never completed by omission. */
  #completionOf(
    frame: FrameFacts,
    carried: CarriedFacts,
    base: string | null,
    evidence: EvidenceFile | null,
  ): readonly RoundViolation[] {
    const verdict = CompletionCriteria.judge(
      Lifecycle.#opOf(frame.phase),
      this.#completionFactsOf(frame, carried, base, evidence),
    );
    if (verdict.kind === "violation") {
      return [{ grade: "hard", cause: CONTRACT_VIOLATION, message: verdict.message }];
    }
    return verdict.observations.map((observation) => ({
      grade: "soft" as const,
      cause: CONTRACT_VIOLATION,
      message: observation.message,
    }));
  }

  /** The facts the round's criterion reads — assembled HERE, the one place that holds the
   *  ledger, the carrier read and the git read. The verb-specific cells are filled for the
   *  verb that reads them: an implement round's commit and wave cells, a judge round's carrier
   *  findings, a fix round's disposition table and the request it must cover. */
  #completionFactsOf(
    frame: FrameFacts,
    carried: CarriedFacts,
    base: string | null,
    evidence: EvidenceFile | null,
  ): CompletionFacts {
    // ONE baseline for the whole bundle: the group's RECORDED baseline, else the HEAD this
    // dispatch just measured and the booking is about to write — a group's first round has no
    // record yet, and without the fallback every group would refuse on a baseline it never
    // lacked.
    const groupBase = this.#reads.groupBase(frame) ?? base;
    const facts: CompletionFacts = {
      // A group that measured no baseline counts nothing: the criterion refuses on `groupBase`
      // first (counting needs a HEAD to count from), so this cell is never consulted there.
      commits: groupBase === null ? 0 : this.#reads.commits(groupBase),
      groupBase,
      carrierWritten: carried.status !== null || carried.findings !== null,
      findings: carried.findings,
      waveTasks: frame.tasks,
      // The empty-`Files` cell is the PLAN's own declaration, read once at the frame assembly
      // (`FrameScene#emptyFileTasks`) and carried here: a wave whose every member declares no
      // file change IS the verification shape, so that shape stays reachable instead of reading
      // every such wave as "committed nothing".
      emptyFileTasks: frame.emptyFileTasks,
      // The evidence gate's OWN result, from the ONE read the booking performed: a face that
      // owes no evidence file has nothing to gate, and a file that is missing, malformed or
      // off-contract is NOT green — the same value also booked its hard entry, so the refusal
      // and this cell can never disagree about one file.
      evidenceOk: evidence === null || evidence.read.kind === "ok",
    };
    if (Lifecycle.#opOf(frame.phase) !== "fix") return facts;
    const requesting = this.#reads.requesting(frame);
    return {
      ...facts,
      dispositions: carried.dispositions ?? null,
      requested: requesting.findings,
      matchedBySummary: Lifecycle.#pairedBySummary(requesting.findings),
    };
  }

  /** The evidence gate's graded entry — the SAME read the criterion's `evidenceOk` cell
   *  consumed, mapped through the contract's own refusal builder so the bytes stay one
   *  spelling. A face that owes no evidence file books nothing. */
  static #evidenceOf(evidence: EvidenceFile | null): readonly RoundViolation[] {
    if (evidence === null) return [];
    const violation = Handoff.evidenceViolationOf(evidence.read, evidence.target);
    return violation === null ? [] : [violation];
  }

  /** Whether this round's face owes a test-evidence file: a WORK round (implement · fix) on a
   *  non-document target. Both cells come from a declaration — the verb's carrier plane and the
   *  target row's audit face — so no branch here re-spells the verb or the type. */
  static #owesEvidence(frame: FrameFacts): boolean {
    return (
      Handoff.planeOf(Lifecycle.#opOf(frame.phase)) === "work" &&
      !TargetFaces.isDocShape(frame.type)
    );
  }

  /** The write-back blindness as a graded entry — SOFT, because the round still concluded: it
   *  kept the previous binding and states why it could not measure its own bytes. */
  static #writeBackOf(touched: boolean | null | undefined): readonly RoundViolation[] {
    if (touched !== null) return [];
    return [{ grade: "soft", cause: CONTRACT_VIOLATION, message: WRITE_BACK_UNMEASURED }];
  }

  /** Whether the requesting carrier carried no finding id, so the dispositions pair by
   *  summary — a bookkeeping fact, never a gate. */
  static #pairedBySummary(requested: readonly RoundFinding[]): boolean {
    if (requested.length === 0) return false;
    return requested.every((finding) => (finding.id ?? "").trim().length === 0);
  }

  /** The round facts the count table reads. */
  #roundFactsOf(
    frame: FrameFacts,
    carried: CarriedFacts,
    readyBatch: readonly number[],
  ): RoundFacts {
    return {
      phase: frame.phase,
      status: carried.status,
      findings: this.#judgedFindingsOf(frame, carried),
      consecutiveBlockers: this.#reads.blockerRun(frame),
      readyBatch,
      ...(carried.requesting === undefined ? {} : { requesting: carried.requesting }),
    };
  }

  /** The findings the count table judges: a judge round's own carrier, or — on the FIX face —
   *  the SOURCE review's input findings (C5-1). A work carrier declares no `findings` slot, so
   *  reading the fix carrier's own field would judge an empty set and close a line whose
   *  blockers were never re-reviewed. */
  #judgedFindingsOf(frame: FrameFacts, carried: CarriedFacts): readonly RoundFinding[] | null {
    if (frame.phase !== "fix") return carried.findings;
    return this.#reads.requesting(frame).findings;
  }

  /** The wave gate's verb of one frame — the branch face's review rides `review`. */
  static #waveVerbOf(frame: FrameFacts): "implement" | "review" | "fix" {
    if (frame.phase === "branch-review") return "review";
    if (frame.phase === "implement" || frame.phase === "review" || frame.phase === "fix") {
      return frame.phase;
    }
    return "review";
  }

  /** The ledger op one phase word books under. */
  static #opOf(phase: FrameFacts["phase"]): "implement" | "review" | "fix" {
    return phase === "branch-review" ? "review" : phase;
  }

  /** A refused dispatch: the in-flight gate's refusal is a HOLD (the record's own state),
   *  every other row is a BLOCK. Both carry the same read-only `checked` rows — the same
   *  derivation an approved dispatch carries. */
  static #refused(verdict: PreFlightVerdict, holding: InFlightState): AdvanceOutcome {
    if (verdict.gate === "in-flight")
      return { kind: "held", state: holding, checked: verdict.checked };
    return { kind: "blocked", leg: "structure", verdict, checked: verdict.checked };
  }
}

/** The landing's failure arm — named so `#land`'s signature says which value it may answer. */
type AdvanceOutcomeFail = { readonly kind: "write-failure"; readonly target: string };
