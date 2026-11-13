// packages/cdd-engine/src-next/session/run.ts
// T8 — the parameterized single lifecycle (design spec §3.3): the three old
// near-isomorphic lifecycles converge into ONE class whose per-type variance is the
// faces table (faces.ts). advance() runs one dispatch step — one dispatch, one
// advance:
//
//   frontier → dispatch → result → bookkeeping → next routing
//
// The lifecycle composes the T6 execution state (the frontier dynamic face + the
// done-set), the T7 NextStepRouter (the C5 next-generation single point) and the T9
// ledger (progress · handoff · round — the on-disk record of every round). The
// capsule interaction point (face/capsule — T10) is a seam: the CapsuleFace
// interface declared here is satisfied by T10's Capsule, and the lifecycle advances
// without a capsule (non-hard consumption — T8 builds no hard dependency toward
// T10); the attachCapsule seam only renders the step's round facts when a capsule is
// connected.
//
// Module-level exports are types / the class / one empty-state data const — zero
// behavior-carrying bare functions (the plan's zero-bare-function discipline).

import { readFileSync } from "node:fs";
import { PlanDocType } from "../contract/doc.ts";
import { PlanTaskBlocksReader } from "../contract/task-blocks.ts";
import { CarrierSeal } from "../infra/carrier-seal.ts";
import type { DispatchPhase, ReviewLead, RouteTarget, TargetFace, TargetType } from "./faces.ts";
import type { TaskGraph } from "./graph.ts";
import {
  type HandoffParams,
  Ledger,
  type LedgerKey,
  type OpType,
  type RoundFinding,
  type RoundStatus,
  type RoundVerdict,
  RoundViolation,
  type Termination,
} from "./ledger.ts";
import type { DocClassVerdict, NextHop, Route } from "./next.ts";
import { NextStepRouter } from "./next.ts";
import { PipelineFrontier, type PipelineFrontierInput } from "./pipeline.ts";
import type { PreFlightVerdict } from "./preflight.ts";
import { ReviewedIdentity } from "./reviewed-identity.ts";
import { RoundNaming } from "./round-naming.ts";
import type { ExecutionState, Frontier } from "./state.ts";

/** The pre-flight dispatch-entry gate — the lifecycle's hard "no child on a refused
 *  frame" wiring (P4.1 T1): the CLI computes the seam verdict ONCE and hands it to
 *  the lifecycle as the gate, so a refused dispatch is structurally never passed to
 *  the child. Null = no gate wired (a gate-less lifecycle advances unguarded — the
 *  seam-less callers keep their existing behavior). */
export interface PreFlightGate {
  /** The pre-flight verdict for one dispatch frame (null = no verdict for the frame
   *  — the dispatch proceeds; a refused verdict blocks the dispatch). */
  gate(frame: OpenFrame): PreFlightVerdict | null;
}

/** The run-state the lifecycle drives — the T6 query surfaces (frontier dynamic
 *  face + the done-set) plus the done marking. TaskGraph implements the whole face;
 *  the branch/spec/plan lines pass EMPTY_RUN_STATE. */
export interface RunState extends ExecutionState, Frontier {
  /** Record a completed task — the frontier only advances past marked tasks. */
  markDone(id: number): void;
}

/** The empty run state — a target line with no task frontier (branch/spec/plan):
 *  the frontier query faces are always empty (a single-target line never continues
 *  a batch) and markDone is a no-op. */
export const EMPTY_RUN_STATE: RunState = {
  doneTasks: () => new Set(),
  readyBatch: () => [],
  frontier: () => [],
  markDone: () => undefined,
};

/** The P31 §2.7 write-back observation — the round could not tell whether it touched
 *  the reviewed document (no dispatch baseline, or git unreadable). The bind keeps
 *  today's behaviour and this entry records the blindness; it is SOFT, so it never
 *  flips the verdict or blocks the next dispatch. */
const WRITE_BACK_UNMEASURED =
  "the reviewed-revision write-back could not measure whether this round touched the document (no dispatch baseline or an unreadable repository) — the current bytes were bound";

/** The audit target of one dispatch step — what the round audits. */
export type AuditTarget =
  /** wave (T26 · the wave-unitary model): the frontier's open wave — the whole ready
   *  batch is ONE dispatch unit (one brief · one child · one commit · one round). */
  | { kind: "wave"; tasks: readonly number[] }
  /** branch: the branch line itself (no commit identity — the review's scope anchor
   *  rides the engine-injected BASE_BRANCH, never a stored range). */
  | { kind: "branch" }
  /** The audit plan document path. */
  | { kind: "plan"; doc: string }
  /** The `--spec` channel's document path (the doc shapes: phase-spec · overall ·
   *  single-spec). The `kind` names the flag channel, never a target type — the
   *  frame's `type` carries the vocabulary word. */
  | { kind: "spec"; doc: string };

/** One dispatch step's full identity — what the lifecycle dispatches. */
export interface OpenFrame {
  /** The target face the step runs on. */
  type: TargetType;
  /** The round's dispatch phase. */
  phase: DispatchPhase;
  /** The round number (the handoff increment: review rounds count up; fix rounds
   *  source their source review's number). */
  round: number;
  /** The audit target the round audits. */
  target: AuditTarget;
  /** The handoff params the round writes under. */
  params: HandoffParams;
  /** The progress ledger key the round records under (a wave key string / a
   *  line-type constant — branch · spec · plan). */
  key: LedgerKey;
  /** The attempt number of this dispatch (1 = the first attempt of the op/cycle).
   *  Allocated ONCE by the frame builder (`RoundNaming#attemptOf` over the row's
   *  records) and shared by the round record and the log name; absent reads 1. */
  attempt?: number;
  /** The plan's STRUCTURE baseline of this round (design spec §7.3) — the dispatch-time
   *  snapshot the close re-reads and compares. Held on the frame alone: it never lands
   *  in `progress.json`, in the round carrier or in the in-flight record, and an absent
   *  value (no plan fact) judges nothing. */
  structure?: PlanStructure | null;
}

/** One plan-structure read's outcome — the three cases stay distinct so a caller never
 *  confuses a line with no plan document (`absent`) with a document that exists but
 *  could not be read (`unreadable`, carrying its reason). */
export type PlanStructureRead =
  | { readonly kind: "absent" }
  | { readonly kind: "ok"; readonly structure: PlanStructure }
  | { readonly kind: "unreadable"; readonly reason: string };

/**
 * PlanStructure — one plan document's STRUCTURE face: the task-id set and each task's
 * declared `DependsOn` set (design spec §7.3).
 *
 * It is a per-round DISPATCH baseline, not a stored fact: the lifecycle snapshots it
 * right before the spawn and re-reads it at the round's close, so only the round's OWN
 * structure edit is judged — a content-only amendment (facts, file lists, steps,
 * acceptance detail, cited line numbers) stays legal. The judgment has ONE presentation
 * face (the round's graded `violations`): no doc-contract rule row is registered for it,
 * because the engine's single doc-contract evaluation point is the pre-dispatch gate.
 */
export class PlanStructure {
  /** The registered task ids, ascending. */
  readonly #taskIds: readonly number[];
  /** Each task's declared dependency set, keyed by task id. */
  readonly #dependsOn: ReadonlyMap<number, readonly number[]>;

  private constructor(
    taskIds: readonly number[],
    dependsOn: ReadonlyMap<number, readonly number[]>,
  ) {
    this.#taskIds = taskIds;
    this.#dependsOn = dependsOn;
  }

  /** Read a plan document's two structure faces. `absent` when there is no plan fact
   *  (no path, or a path whose document does not exist); `unreadable` when the path
   *  exists but the document cannot be read (the reason rides the read result); `ok`
   *  with the snapshot otherwise. The three cases stay apart so a caller can tell "there
   *  is no plan" from "the plan is damaged" — the two carry different judgments. */
  static of(planPath: string | null): PlanStructureRead {
    if (planPath === null) return { kind: "absent" };
    try {
      return { kind: "ok", structure: PlanStructure.parse(readFileSync(planPath, "utf8")) };
    } catch (error) {
      // A path with no document is the absent case, never a read failure; every other
      // error is the damaged-document case, its reason carried into the caller's message.
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return { kind: "absent" };
      return { kind: "unreadable", reason: error instanceof Error ? error.message : String(error) };
    }
  }

  /** Parse one plan document into its structure face — the ONE task-block read face. */
  static parse(content: string): PlanStructure {
    const reader = new PlanTaskBlocksReader();
    const blocks = reader.parse(content);
    const dependsOn = new Map<number, readonly number[]>();
    for (const block of blocks) dependsOn.set(block.id, reader.dependsOn(block));
    const taskIds = blocks.map((block) => block.id).sort((left, right) => left - right);
    return new PlanStructure(taskIds, dependsOn);
  }

  /** The task-id set, ascending. */
  get taskIds(): readonly number[] {
    return this.#taskIds;
  }

  /** One task's declared dependency set ([] when it declares none). */
  dependsOnOf(taskId: number): readonly number[] {
    return this.#dependsOn.get(taskId) ?? [];
  }

  /** Whether the two snapshots differ on either structure face — SET equality over the
   *  task-id set and over every task's dependency set (a task added, removed or rewired
   *  differs; a prose edit does not; declaration order is prose, the edge set is the
   *  structure). */
  differsFrom(other: PlanStructure): boolean {
    if (this.#taskIds.length !== other.#taskIds.length) return true;
    if (!this.#taskIds.every((id, index) => id === other.#taskIds[index])) return true;
    return this.#taskIds.some(
      (id) => !PlanStructure.#sameIds(this.dependsOnOf(id), other.dependsOnOf(id)),
    );
  }

  /** Set equality of two id lists (order-insensitive). */
  static #sameIds(left: readonly number[], right: readonly number[]): boolean {
    if (left.length !== right.length) return false;
    const sortedLeft = [...left].sort((a, b) => a - b);
    const sortedRight = [...right].sort((a, b) => a - b);
    return sortedLeft.every((id, index) => id === sortedRight[index]);
  }
}

/** One round's dispatch outcome — what the lifecycle records and routes on. */
export interface DispatchOutcome {
  /** The round's concluding status. */
  status: RoundStatus;
  /** The round's findings (review: this round's own; fix: the source review's
   *  input findings, C5-1). */
  findings?: readonly RoundFinding[];
  /** The materialized final carrier (the production dispatch's read-back
   *  reconstruct — §3.6: the child draft validated and built into the carrier the
   *  bookkeep persists verbatim, full-replace at the SAME path; agent draft →
   *  finalized, the engine stays the single author). Absent for the hermetic /
   *  injected dispatchers — the bookkeep builds the carrier from the outcome fields. */
  carrier?: Record<string, unknown>;
  /** The termination fact — present iff the round was cut short; a fact orthogonal to
   *  the conclusion (the status still derives from the handoff). */
  termination?: Termination;
  /** The HEAD the dispatch started from — the round record's `dispatchBase`. */
  dispatchBase?: string | null;
  /** The dispatch-after working-tree observation — the round record's `treeClean`
   *  (an observation, never a gate). */
  treeClean?: boolean;
  /** The round's TERMINAL VERDICT (P22 · design spec §3.1): `targetAction` is the
   *  completion judgment (the verb's criterion holds and no hard violation was
   *  graded) and `treeClean` the dispatch-after observation. The bookkeep records it
   *  verbatim; its readers ask `verdict.targetAction`, never the exit code. Absent
   *  from the hermetic / injected dispatchers — the bookkeep falls back to the
   *  status-derived verdict. Its presence is also the PRODUCTION-face marker: a round
   *  carrying a verdict actually ran, so the bookkeep never synthesizes a carrier for
   *  it (a production round that wrote no draft is booked with a null carrier path). */
  verdict?: RoundVerdict;
  /** Whether this round touched the document its write-back binds (P31 §2.7) — the
   *  `dispatchBase..HEAD` path set's judgment. Three states plus the unmeasured one:
   *  `true` the round's commits touched it, `false` a READABLE range touched it not at
   *  all, `null` the range could not be read (no dispatch baseline / git unreadable),
   *  `undefined` never measured (hermetic / injected dispatchers). `false` and `null`
   *  never collapse: only `false` may skip the bind. */
  touchedDoc?: boolean | null;
  /** The round's GRADED violations — hard entries failed the round, soft entries are
   *  bookkeeping only (design spec §3.3). Recorded verbatim on the round's record. */
  violations?: readonly RoundViolation[];
  /** The fix round's ONE summary line (`fixed N · rejected M`, design spec §3.4) —
   *  computed at the round's finish from the persisted dispositions and the
   *  requesting carrier's input set. A face fact only: it rides the capsule render
   *  between the status line and the `next:` row (P22 §10), and is
   *  never stored on the record or the carrier. Absent off the fix face. */
  dispositionsSummary?: string;
}

/** The dispatch instruction — runs one round's actual work (the harness call in
 *  production; a stub in tests). The lifecycle never inspects how the work runs.
 *  Asynchronous by necessity: the child's process lifecycle (group kill · wall-clock
 *  ceiling · parent-exit cleanup) lives on execa's asynchronous face alone — the
 *  synchronous face forbids every one of those options. */
export type DispatchStep = (frame: OpenFrame) => Promise<DispatchOutcome>;

/** The capsule interaction seam — the face/capsule contact. T10's Capsule satisfies
 *  this shape; the lifecycle advances without a capsule (non-hard consumption) and
 *  attachCapsule only renders the step's round facts when a capsule is connected. */
export interface CapsuleFace {
  /** Render the capsule lines for one round's facts — the status-class key set
   *  (`status · handoff` on success; `status` plus the crash `handoff` on
   *  TIMEOUT/BLOCKED) via the face's word table. `hop` is the ONE `NextHop` object the
   *  round renders — the PIPELINE frontier's assembly (`PipelineFrontier#hopOf`, the
   *  same object the board's `next:` row renders) when the node holds a spec document,
   *  this line's own frame-keyed assembly otherwise. Its ABSENCE (`null`: the failure
   *  face) prints no `next:` row and no `reason:` row; the capsule itself judges
   *  nothing. `withHandoff` is the round's crash-record fact (the failure handoff
   *  cell). `summary` is the fix round's ONE disposition line, rendered between the
   *  status line and the `next:` row (P22 §10 — the dispatchable literal keeps its
   *  bytes, the reason rides the line after it). */
  emit(
    status: string,
    handoff: string,
    hop?: NextHop | null,
    withHandoff?: boolean,
    summary?: string,
  ): string[];
}

/** One advance step's result — the facts the caller drives on. */
export interface StepResult {
  /** The frame the step dispatched. */
  frame: OpenFrame;
  /** The line's round number after bookkeeping — the count of DISTINCT recorded
   *  cycles (a cycle re-dispatched as a new attempt stays one round number). */
  round: number;
  /** The C5 next-hop route after this step (consumed per the face's next
   *  semantics: a next-wave advances the task batch — batch faces only). */
  route: Route | null;
  /** The capsule lines rendered at the interaction point (empty when no capsule is
   *  attached — the seam is non-hard). The `next:` / `reason:` rows come from the
   *  pipeline frontier's ONE assembly (`PipelineFrontier#hopOf`), the object the
   *  board renders too. */
  capsuleLines: readonly string[];
  /** The pre-flight verdict of a refused dispatch — the lifecycle's dispatch-entry
   *  gate blocked the frame before ANY child dispatch (absent on ordinary steps).
   *  The refused frame is NOT recorded — the frontier re-offers it (resume). */
  preflight?: PreFlightVerdict;
  /** The step's termination fact, passed through from the dispatch outcome (absent
   *  when the round ended by itself). */
  termination?: DispatchOutcome["termination"];
}

/**
 * Lifecycle — the parameterized single lifecycle over one target-type face. One
 * instance drives one target line. advance() runs one dispatch step:
 *
 *   frontier  — resolve the open frame from the face's audit descriptor;
 *   dispatch  — run the injected dispatch instruction, capture the outcome;
 *   bookkeep  — persist the handoff carrier + record the progress round;
 *   close     — the recorded round's C5 route is the single closure verdict: the
 *               lifecycle marks the task done when the route kind closes the line
 *               (terminal ⇔ route.kind ∈ {done, next-wave} — desync-proof, the
 *               router's point, never a folded table);
 *   route     — the delivered C5 next-hop Route, re-judged with the closed task out
 *               of the ready batch (a closing review routes `done`, not a phantom
 *               next-wave of the just-closed task).
 */
export class Lifecycle {
  /** The target face this instance drives — the row of the faces table. */
  readonly #face: TargetFace;
  /** The run state the lifecycle reads and marks. */
  readonly #state: RunState;
  /** The session ledger — the round + progress single author. */
  readonly #ledger: Ledger;
  /** The C5 next router — the next-hop single point. */
  readonly #router: NextStepRouter;
  /** The dispatch instruction — the round's actual work, injected. */
  readonly #dispatch: DispatchStep;
  /** The fixed audit target of a branch-tree / doc-path face (the task face
   *  resolves it from the frontier). */
  readonly #target: AuditTarget | null;
  /** The attached capsule face — null = the step advances output-less. */
  #capsule: CapsuleFace | null;
  /** The dispatch-entry pre-flight gate — null = unguarded (the seam-less callers
   *  keep their existing behavior). */
  readonly #preflight: PreFlightGate | null;
  /** The workspace plan path — the `next:` implement literal's required `--plan`
   *  arg (P4.1 T4 — the task face's implement-consuming fact), and the plan cell of
   *  the pipeline frontier's input. A `--spec` round fills it from the document index
   *  (the same-slug plan the argv does not name); the plan / branch lines carry their
   *  argv value. */
  readonly #planPath: string | null;
  /** The pipeline frontier's declared identity — the spec line's DECLARED word (the
   *  `doc-type:` head key) and its document path. A node with no spec document
   *  (`#specPath === null`) keeps this line's own hop assembly: the frontier's rules
   *  anchor on an absent identity face, which would print a passed phase's transition. */
  readonly #specType: TargetType | null;
  readonly #specPath: string | null;
  /** The plan's task graph — the pipeline frontier's guarded plan read, injected by
   *  the composition root (the session plane reads no file). */
  readonly #planGraph: TaskGraph | null;
  /** The pipeline frontier — the ONE hop assembly this lifecycle's capsule renders
   *  (the same object the board renders). */
  readonly #frontier: PipelineFrontier;
  /** The pipeline-station discrimination the hop derivation injects (P22 §5.2) —
   *  the SAME face read the capsule/board use (`BoardView.docClassOf`). The
   *  composition root passes it; the session-plane default keys by target type
   *  (the CLI is the seam that reads a spec's DECLARED class). */
  readonly #docClassOf: (target: RouteTarget) => DocClassVerdict;

  constructor(opts: {
    face: TargetFace;
    state: RunState;
    ledger: Ledger;
    dispatch: DispatchStep;
    router?: NextStepRouter;
    /** The fixed audit target for a branch-tree / doc-path face. */
    target?: AuditTarget;
    /** The capsule face to attach at construction (optional — the seam is non-hard). */
    capsule?: CapsuleFace | null;
    /** The dispatch-entry pre-flight gate (P4.1 T1 — the lifecycle's hard "no child
     *  on a refused frame" wiring; optional, null = unguarded). */
    preflight?: PreFlightGate | null;
    /** The workspace plan path (P4.1 T4 — the implement `next:` literal's `--plan`;
     *  also the pipeline frontier's plan cell). */
    planPath?: string | null;
    /** The spec line's DECLARED word and document path (the pipeline frontier's
     *  identity cells) — absent on a bare slug or a spec-less phase. */
    specType?: TargetType | null;
    specPath?: string | null;
    /** The plan's task graph (the pipeline frontier's guarded plan read). */
    planGraph?: TaskGraph | null;
    /** The pipeline-station discrimination (P22 §5.2) — injected by the composition
     *  root (the declaration-reading face); the type-keyed default covers the
     *  session-plane callers. */
    docClassOf?: (target: RouteTarget) => DocClassVerdict;
  }) {
    this.#face = opts.face;
    this.#state = opts.state;
    this.#ledger = opts.ledger;
    this.#dispatch = opts.dispatch;
    this.#router = opts.router ?? new NextStepRouter();
    this.#target = opts.target ?? null;
    this.#capsule = opts.capsule ?? null;
    this.#preflight = opts.preflight ?? null;
    this.#planPath = opts.planPath ?? null;
    this.#specType = opts.specType ?? null;
    this.#specPath = opts.specPath ?? null;
    this.#planGraph = opts.planGraph ?? null;
    this.#frontier = new PipelineFrontier(this.#ledger);
    this.#docClassOf = opts.docClassOf ?? Lifecycle.#docClassByType;
  }

  /** The session-plane default discrimination — the target type's own pipeline key.
   *  Every declared target type IS a pipeline key (the `PipelineKey` derivation), so
   *  the map is the identity: a standalone `single-spec` reads as `single-spec` and its
   *  closure hands off to `cdd-plan` like any other spec line. The declaration-reading
   *  judgment (a doc's `doc-type:`) belongs to the face plane; the composition root
   *  injects it as `BoardView.docClassOf`. */
  static #docClassByType(target: RouteTarget): DocClassVerdict {
    return target.type;
  }

  /** The face row this instance drives. */
  face(): TargetFace {
    return this.#face;
  }

  /** Attach the capsule face — the interaction point (T10's Capsule plugs in; null
   *  detaches and the step advances output-less). Returns this for chaining. */
  attachCapsule(capsule: CapsuleFace | null): this {
    this.#capsule = capsule;
    return this;
  }

  /** Peek the line's next open frame WITHOUT dispatching — the CLI's per-invocation
   *  cursor pre-checks the next step against the requested verb before it advances
   *  (a mismatch must not consume the round: advance() dispatches on entry — the
   *  {16,22,24} bug's loop reordered lookahead-after-dispatch and spent the next
   *  phase's round in the same invocation). The returned `hop` is this line's own
   *  LINE FRONTIER assembly (`#hopOf`): the frame-keyed hop the CLI rejection message
   *  reads — never the pipeline frontier's assembly, which the capsule and the board
   *  share. Null = the run is exhausted / capped (no open frame → no line to name). */
  peekNext(): { frame: OpenFrame; hop: NextHop } | null {
    const frame = this.#openFrame();
    if (frame === null) return null;
    const route =
      frame.type === "wave"
        ? this.#ledger.waveLineRoute(String(frame.key))
        : this.#ledger.lineRoute(frame.key, frame.type);
    return { frame, hop: this.#hopOf(frame, route) };
  }

  /** advance() — one dispatch step: frontier → pre-flight gate → dispatch → result →
   *  bookkeeping → next routing. Null when the line holds no open frame (the run is
   *  exhausted or a capped line defers to the user). A refused pre-flight gate blocks
   *  the dispatch (child zero) and returns the frame as a preflight-blocked step —
   *  neither persisted nor recorded (the frontier re-offers it: resume). */
  async advance(): Promise<StepResult | null> {
    const frame = this.#openFrame();
    if (frame === null) return null;
    if (this.#preflight !== null) {
      const verdict = this.#preflight.gate(frame);
      if (verdict !== null && !verdict.ok) {
        return {
          frame,
          round: this.#ledger.roundCount(frame.key, frame.phase, frame.type),
          route: null,
          capsuleLines: [],
          preflight: verdict,
        };
      }
    }
    const outcome = await this.#dispatch(frame);
    const round = this.#bookkeep(frame, outcome);
    // The closure verdict rides the recorded round's C5 route — mark the task done
    // when the route kind says the line closed (the router's single point, never a
    // folded copy of the closure table).
    this.#markTerminal(frame, this.#routeNext(frame));
    // The delivered route re-judges the batch AFTER the done-marking: a closing
    // review empties the ready batch, so the step routes `done` (an exhausted run),
    // not a phantom next-wave of the just-closed task.
    const route = this.#routeNext(frame);
    // The failure face holds NO next object at all (the `next:` line's absence gate
    // is the NextHop's absence, never `hop: null` — that still renders `done` / the
    // soft-cap / the doc-class rows).
    const failed = outcome.status === "BLOCKED" || outcome.status === "TIMEOUT";
    return {
      frame,
      round,
      route,
      capsuleLines: this.#capsuleLines(
        frame,
        outcome,
        failed ? null : this.#roundHop(frame, route),
      ),
      termination: outcome.termination,
    };
  }

  // -------------------------------------------------------------------------
  // frontier — the open dispatch frame
  // -------------------------------------------------------------------------

  /** Resolve the line's next open frame — null when the line is exhausted. */
  #openFrame(): OpenFrame | null {
    if (this.#face.audit.kind === "task-graph") return this.#openWaveFrame();
    const target = this.#target;
    if (target === null) return null; // a fixed-target face without its target holds
    return this.#openLineFrame(target);
  }

  /** The task face's next open frame — THE OPEN WAVE as ONE dispatch step (the
   *  wave-unitary model · T26): the frontier's whole ready batch is the frame's
   *  target — one brief, one child, one commit, one round, one phase train. Null
   *  when the frontier holds no open wave. */
  #openWaveFrame(): OpenFrame | null {
    const done = this.#state.doneTasks();
    const ready = this.#state.frontier(done); // the open wave (the whole ready batch, ascending)
    if (ready.length === 0) return null;
    const key = ready.join(",");
    const phase = this.#nextWavePhase(key);
    if (phase === null) return null;
    const target = { kind: "wave", tasks: ready } as const;
    const round = this.#roundFor(phase, key);
    const attempt = this.#attemptFor(phase, key, round);
    return {
      type: "wave",
      phase,
      round,
      target,
      params: this.#paramsOf({ type: "wave", phase, target, round, attempt }),
      key,
      attempt,
    };
  }

  /** The attempt number one dispatch takes — allocated ONCE here from the row's
   *  records (`RoundNaming#attemptOf`, the naming single source) and shared by the
   *  round record and the round log's name. */
  #attemptFor(phase: DispatchPhase, key: LedgerKey, round: number): number {
    return this.#ledger
      .naming()
      .attemptOf(this.#ledger.recordsOf(key, this.#face.type), this.#opOf(phase), round);
  }

  /** The next phase of one wave line — the SAME single derivation the wave gate reads
   *  (`Ledger#waveLinePhase` · D26: one fact, one place). The lifecycle's frame
   *  frontier and the three-verb WaveGate must agree on the open wave's phase, or a
   *  drift-reopened wave deadlocks (the gate accepts `review` while the frontier
   *  demands `fix`). Null when the line is closed (its latest round's C5 route is
   *  done / next-wave / soft-cap — the soft cap defers to the user). */
  #nextWavePhase(key: string): DispatchPhase | null {
    return this.#ledger.waveLinePhase(key);
  }

  /** The branch/spec/plan line's next open frame — the fixed audit target's round
   *  sequence (review-lead → fix → re-review → closure). */
  #openLineFrame(target: AuditTarget): OpenFrame | null {
    const key = this.#lineKey(target);
    const reviewLead = this.#face.product.reviewLead;
    const phase = this.#nextLinePhase(key, target, reviewLead);
    if (phase === null) return null;
    const round = this.#roundFor(phase, key);
    const attempt = this.#attemptFor(phase, key, round);
    return {
      type: this.#face.type,
      phase,
      round,
      target,
      params: this.#paramsOf({ type: this.#face.type, phase, target, round, attempt }),
      key,
      attempt,
    };
  }

  /** The next phase of a single-target line — the doc-revision gate (lifecycle-side:
   *  its reviewGate needs the target doc path) then the ledger's SINGLE rounds/routes
   *  judge (`Ledger#linePhase`, D40 — the retired lifecycle twin). A CLOSED doc line
   *  reopens through the identity verdict (T7) — the ONE `Ledger#docReopens` judgment,
   *  the same one the dispatch gate reads, so an exit-side drift opens the review lead
   *  whatever the round/route state says while a still-pending fix keeps its round
   *  (drift never outranks it, §5.5 ② — the gate never names a round this frontier
   *  would not frame); an unchanged doc with the pending fix derived opens the fix;
   *  the unbound / same-without-pending faces fall through to the shared rounds/routes
   *  walk (a completed-fix line reopens review through the fix round's route). */
  #nextLinePhase(
    key: LedgerKey,
    target: AuditTarget,
    reviewLead: ReviewLead,
  ): DispatchPhase | null {
    if (target.kind === "plan" || target.kind === "spec") {
      const verdict = this.#ledger.reviewGate(key, target.doc, this.#face.type);
      if (this.#ledger.docReopens(key, this.#face.type, verdict)) return reviewLead;
      if (verdict.kind === "same" && verdict.pending) return "fix";
    }
    // The branch line's identity is its PLAN document (P21 §4.1): a plan revision
    // after the terminal branch review reopens the branch-review lead, an unchanged
    // plan keeps the line closed. Same gate, same judgment — only the doc path is
    // the line's plan (the audit target itself carries no doc).
    if (target.kind === "branch" && this.#planPath !== null) {
      const verdict = this.#ledger.reviewGate(key, this.#planPath, "branch");
      if (this.#ledger.docReopens(key, "branch", verdict)) return reviewLead;
      if (verdict.kind === "same" && verdict.pending) return "fix";
    }
    return this.#ledger.linePhase(key, this.#face.type);
  }

  /** The round number one phase dispatches under: implement = the fixed family (1);
   *  the review-lead = the next increment (every in-register cycle consumes a number);
   *  fix = the source review-lead's latest COMPLETED cycle (a failed fix never pushes
   *  it forward — a retry is fix-K's attempt + 1, never a phantom fix-(K+1)). */
  #roundFor(phase: DispatchPhase, key: LedgerKey): number {
    if (phase === "implement") return 1;
    if (phase === "fix") {
      const completed = this.#ledger.completedCycles(key, "review", this.#face.type);
      return completed.length > 0 ? Math.max(...completed) : 1;
    }
    return this.#reviewCount(key) + 1;
  }

  /** The review-lead round count of a key (branch counts its branch-review mode,
   *  the others the review mode — the face row's single source). */
  #reviewCount(key: LedgerKey): number {
    return this.#ledger.roundCount(key, this.#face.product.reviewLead, this.#face.type);
  }

  /** The progress key of a single-target line — the line's STABLE key (find #9 ·
   *  spec §6.5/§3.7 — `"branch"` per workspace for the branch line, accumulating
   *  across re-reviews; a doc line keys by its target-type word (`"phase-spec"` /
   *  `"overall"` / `"plan"` / `"single-spec"`) — the argv path copy never resets the
   *  round: a moved argv string (absolute vs
   *  relative) must not fork the same line into two ledger rows). The task face
   *  never routes here — frames key by the wave key. */
  #lineKey(target: AuditTarget): LedgerKey {
    if (target.kind === "plan" || target.kind === "spec") return this.#face.type;
    return "branch";
  }

  // -------------------------------------------------------------------------
  // the frame → handoff params shaping
  // -------------------------------------------------------------------------

  /** The handoff params one frame fills — the type's placeholders from the target,
   *  the round and the attempt. EVERY family carries its cycle now (P34 T1: the
   *  implement family included, so its draft and final are two names), and every
   *  family carries the attempt the naming face renders as `-a{n}`. */
  #paramsOf(frame: {
    type: TargetType;
    phase: DispatchPhase;
    target: AuditTarget;
    round: number;
    attempt: number;
  }): HandoffParams {
    switch (frame.type) {
      case "wave": {
        const waveTarget = frame.target as { kind: "wave"; tasks: readonly number[] };
        return { tasks: waveTarget.tasks.join(","), round: frame.round, attempt: frame.attempt };
      }
      case "branch":
      case "phase-spec":
      case "overall":
      case "plan":
      case "single-spec":
        return { round: frame.round, attempt: frame.attempt };
    }
  }

  // -------------------------------------------------------------------------
  // dispatch → result → bookkeeping
  // -------------------------------------------------------------------------

  /** Bookkeeping — persist the round's handoff carrier and record the round. The
   *  persisted carrier is either the dispatch's materialized form (the production
   *  read-back reconstruct — outcome.carrier) or — on the INJECTED face alone (an
   *  outcome carrying no verdict) — the engine-built fallback from the outcome fields.
   *  Either way it lands as the FINAL carrier beside the child's draft, never over it
   *  (P31 §2.3: the draft keeps the child's bytes, the final carries the engine's
   *  materialization, and the ledger DERIVES the record's path from its own identity —
   *  the record remembers the digest, never a path). A production round that wrote no
   *  carrier leaves no file at either name: the completion criterion owns the absence
   *  (§3.3), and a re-dispatch's draft read must see the child's own draft, never an
   *  engine synthesis of it. A failure round WITHOUT a carrier leaves the child's
   *  draft untouched (no-overwrite on failure) but is STILL recorded — every dispatched
   *  round lands; "completed" is the record's verdict, never a membership test. Returns the in-register round count (the task
   *  done-marking rides the step's C5 route — #markTerminal, after #routeNext). */
  #bookkeep(frame: OpenFrame, outcome: DispatchOutcome): number {
    const blocked = outcome.status === "BLOCKED" || outcome.status === "TIMEOUT";
    let carrierDigest: string | null = null;
    if (outcome.carrier !== undefined || (outcome.verdict === undefined && !blocked)) {
      const op = this.#opOf(frame.phase);
      // T2 — the engine-built fallback rides the FRAME's op-derived plane (never the
      // outcome's field presence): a judge-plane round (review) builds the findings
      // carrier — its schema-required findings key, empty on a conclusion-only round
      // (a review advances no new findings); a work-plane round (implement / fix,
      // docs-fix included) builds the findings-free work carrier — zero findings
      // injection. The review finding-severity route reads the round carrier's
      // findings; the conclusion rides only the work plane's declared status (the
      // judge plane derives its conclusion at judgment time).
      const plane = this.#ledger.planeOf(op);
      const carrier: Record<string, unknown> =
        outcome.carrier ??
        (plane === "judge"
          ? this.#ledger.buildHandoff("judge", {
              findings: [...(outcome.findings ?? [])],
            })
          : this.#ledger.buildHandoff("work", {}));
      // The work plane ALONE persists the conclusion (the child's declared status); the
      // judge carrier holds no status — its conclusion derives at judgment time
      // (`HandoffSchema.conclusionOf` → rollup(findings)), never a stored field (D27).
      if (plane === "work" && carrier.status === undefined && outcome.status !== undefined)
        carrier.status = outcome.status;
      // P31 §2.2/§2.3 — the persist hands the FINAL carrier path, the draft path it
      // landed beside and the payload digest, so the round record can name both
      // artifacts and replay the comparison on every later read of this carrier.
      // P31 §2.2/§2.3 — the persist seals the round's two names and hands back the
      // payload digest, so the record can replay the comparison on every later read of
      // this carrier. The PATHS stay out of the record: the ledger derives them from
      // the record's own identity.
      const persisted = this.#ledger.persistHandoff(op, frame.type, frame.params, carrier);
      carrierDigest = persisted.digest;
    } else {
      // P31 T5 §2.4 — a round that books NO carrier still owns its two names: the
      // draft the child may have written before the round failed must not stay
      // writable. The persistence seals its own pair above; this is the failure
      // face's leg (the lifecycle's terminals seal too — one invariant, two entry
      // points, so an injected dispatcher can never leave the window open).
      this.#sealRoundCarriers(frame);
    }
    // The recorded CYCLE is the frame's own round — its identity (fix-K ⟷ review-K ·
    // D28): a skipped cycle records its own number, never a flattened ordinal. The
    // attempt was allocated once by the frame builder and rides both the record and
    // the round log's name.
    //
    // P31 §2.7 — the write-back's three states become a graded entry HERE, before the
    // record is written: an UNMEASURABLE range (`null`) keeps today's bind and books
    // one soft observation (never a verdict flip); `true` / `false` / unmeasured ride
    // the write-back gate below.
    const violations: RoundViolation[] = [
      ...(outcome.violations ?? []),
      ...(outcome.touchedDoc === null ? [RoundViolation.soft(WRITE_BACK_UNMEASURED)] : []),
    ];
    const record = this.#ledger.recordRound(
      frame.key,
      {
        op: this.#opOf(frame.phase),
        cycle: frame.round,
        attempt: frame.attempt ?? 1,
        dispatchBase: outcome.dispatchBase ?? null,
        // The verdict is the dispatch's own judgment when it carries one (the
        // production lifecycle's `#verdictOf`); the injected dispatchers keep the
        // status-derived fallback.
        verdict: outcome.verdict ?? {
          treeClean: outcome.treeClean ?? true,
          targetAction: !blocked,
        },
        violations,
        // A round that persisted no carrier records no digest column at all — the
        // absence is the fact, never a null placeholder.
        ...(carrierDigest === null ? {} : { carrierDigest }),
      },
      frame.type,
    );
    // The completed-round revision write-back is gated on the round's VERDICT (a
    // hard-failed round must not bind the current revision — that would silently
    // close the drift identity the round never delivered). WHICH reviewed input the
    // round binds is ONE judgment, shared with the preview face:
    // `ReviewedIdentity.legOf(frame.phase, frame.target.kind)`. Its phases — review,
    // branch-review, fix — are declared there once, and its legs are 1:1 with this
    // class's three `#record…` methods (doc · brief · branch). Two facts stay this
    // face's OWN input, never the judgment: the verdict's `targetAction` (a real run
    // alone holds it) and the plan path (the branch leg's render-from pointer). One
    // asymmetry is preserved: on a wave round whose line carries no plan path the
    // real run records nothing while the preview still states the brief leg. The
    // record methods keep their own defensive narrowing; an unreadable input records
    // nothing (present facts only).
    //
    // P31 §2.7 — the bind is conditional on the round's OWN bytes, but ONLY where the
    // phase is expected to produce those bytes (P32 §2.1): a READABLE range that
    // touched the document not at all (`false`) keeps the OLD binding on a `fix` round,
    // so the existing drift / reopen face pushes the line back to review instead of
    // silently closing it on bytes the round never delivered. A `review` /
    // `branch-review` is not gated: its job is to conclude on bytes it does not write,
    // and a completed conclusion must bind them or the drift identity never closes.
    // WHICH phases are gated is the judgment's own cell
    // (`ReviewedIdentity.gatedByTouchedDoc`), beside the leg decision; `true`, `null`
    // (unmeasurable — its soft entry is booked above) and `undefined` (hermetic /
    // injected dispatchers) keep today's bind.
    const leg =
      record.verdict.targetAction &&
      (!ReviewedIdentity.gatedByTouchedDoc(frame.phase) || outcome.touchedDoc !== false)
        ? ReviewedIdentity.legOf(frame.phase, frame.target.kind)
        : null;
    if (leg !== null) {
      switch (leg) {
        case "doc":
          this.#recordReviewedDocRevision(frame);
          break;
        case "brief":
          this.#recordReviewedWaveBrief(frame);
          break;
        case "branch":
          this.#recordReviewedBranchRevision(frame);
          break;
      }
    }
    return this.#ledger.roundCount(frame.key, frame.phase, frame.type);
  }

  /** The reviewed-revision write-back — bind the completed round's input revision to
   *  the line record (the T7 doc + D30 wave identity gates' reopen-compare basis). The
   *  doc face binds its target doc's BODY revision (the front matter and
   *  `## Change history` projected away, P26 T1); the wave face binds its TASK-ONLY
   *  brief projection's revision (D30 · P29 §2.2 — the wave's true judgment input is
   *  the brief's task sections, never the whole plan and never the `## Constraints`
   *  dispatch input: transcript edits outside the wave's task sections must not void a
   *  reviewed wave). An unreadable input records nothing — the line keeps the
   *  legacy closed face (only present facts land, never an invented identity). */
  #recordReviewedDocRevision(frame: OpenFrame): void {
    if (frame.target.kind !== "plan" && frame.target.kind !== "spec") return;
    this.#recordDocRevisionOf(frame.key, frame.target.doc, frame.type);
  }

  /** The wave line's reviewed-brief write-back (D30 · P29 §2.2) — bind the wave's
   *  TASK-ONLY projection revision (`BriefRenderer#taskBody` — the same face the
   *  lifecycle hashes) to the row (the D30 wave-gate reopen basis) on a completed
   *  review or fix round. Null plan path / underivable brief records nothing (present
   *  facts only). */
  #recordReviewedWaveBrief(frame: OpenFrame): void {
    if (frame.target.kind !== "wave" || this.#planPath === null) return;
    this.#ledger.recordReviewedBrief(String(frame.key), this.#planPath);
  }

  /** The branch line's reviewed identity (P21 §4.1) — its PLAN document's
   *  `doc-revision`, the same ref kind the doc lines bind (no new ref kind, no commit
   *  sha). A later plan revision reopens the line; an unchanged plan keeps it closed.
   *  An unreadable plan / a null plan path records nothing (present facts only). */
  #recordReviewedBranchRevision(frame: OpenFrame): void {
    if (this.#planPath === null) return;
    this.#recordDocRevisionOf(frame.key, this.#planPath, frame.type);
  }

  /** The doc-revision write-back body — read the round's document and bind its
   *  current revision to the line row (the ONE read + hash + record path the doc and
   *  branch legs share; each passes its own path source). An unreadable input records
   *  nothing — the line keeps the legacy closed face (present facts only). */
  #recordDocRevisionOf(key: LedgerKey, path: string, identity: TargetType): void {
    try {
      const content = readFileSync(path, "utf8");
      this.#ledger.recordReviewedRevision(
        key,
        this.#ledger.refs().docRevision(path, content),
        identity,
      );
    } catch {
      // unreadable input — no reviewed identity recorded (present facts only)
    }
  }

  /** Mark the wave done when the concluding route says its line closed — the C5
   *  verdict is the single closure gate (terminal ⇔ route.kind ∈ {done, next-wave},
   *  the v1.20 closure side): a clean review or a blocker-free fix closes the wave
   *  (every member task), while a re-review / soft-cap / a null route (BLOCKED,
   *  TIMEOUT, a missing base) holds it. Marking the closed wave lets the next
   *  frontier pass exclude it. The task-less faces never mark — for them the route
   *  IS the gate. */
  #markTerminal(frame: OpenFrame, route: Route | null): void {
    if (frame.type !== "wave") return;
    if (!Ledger.routeClosed(route)) return;
    const waveTarget = frame.target as { kind: "wave"; tasks: readonly number[] };
    for (const id of waveTarget.tasks) this.#state.markDone(id);
    // The closure's OTHER historical fact (P21 §5.1): the plan's task set at the
    // instant this wave closed. It is the append-vs-stall basis the wave gate reads
    // later — recorded here, at the one point that knows the wave just closed, and
    // never re-derived (a later plan revision must not rewrite the history).
    this.#recordPlanSnapshot(frame);
  }

  /** Record the closing wave's plan-task snapshot — the plan's CURRENT task-id set
   *  read from the plan document (`#planPath`, the same source the brief renders
   *  from) through the contract parse face. An unreadable plan or a null plan path
   *  records nothing: the snapshot is a present fact only, never a fabricated `[]`
   *  (an absent snapshot reads conservatively as "stall" in the wave gate). */
  #recordPlanSnapshot(frame: OpenFrame): void {
    if (this.#planPath === null) return;
    try {
      const lines = readFileSync(this.#planPath, "utf8").split("\n");
      const parsed = new PlanDocType("plan").parse(lines);
      this.#ledger.recordPlanTasks(
        String(frame.key),
        parsed.taskBlocks.map((block) => block.id),
      );
    } catch {
      // unreadable plan — skip the snapshot (present facts only)
    }
  }

  /** The handoff-family op of a phase — branch-review rides the review family. */
  #opOf(phase: DispatchPhase): OpType {
    return phase === "branch-review" ? "review" : phase;
  }

  /** P31 §2.4 — seal one round's OWN carrier names (its draft and its final). The
   *  derivation is the same pair the lifecycle's preflight opens; a round-less family
   *  (implement) resolves both to one path, so the seal is idempotent by construction. */
  #sealRoundCarriers(frame: OpenFrame): void {
    const op = this.#opOf(frame.phase);
    const artifact = RoundNaming.artifactOf(op, frame.type, frame.params);
    CarrierSeal.seal(this.#ledger.naming().renderPath(artifact, "draft"));
    CarrierSeal.seal(this.#ledger.naming().renderPath(artifact, "final"));
  }

  // -------------------------------------------------------------------------
  // next routing + the capsule interaction
  // -------------------------------------------------------------------------

  /** The next-hop route — the recorded round read back through the ledger (the fix
   *  round carries the SOURCE review's findings, C5-1) and judged by the router.
   *  Null when the round is unreadable (no invented next hop from absent facts). */
  #routeNext(frame: OpenFrame): Route | null {
    const op = this.#opOf(frame.phase);
    const carried = this.#ledger.round(op, frame.type, frame.params, frame.round);
    if (carried === null) return null;
    return this.#router.next(this.#routeState(), carried);
  }

  /** The execution state the router judges next against — the real run state for
   *  the batch faces (task), the empty single-target state for the rest (their
   *  nextSemantics.batch is false — a review-approved closes the line, never a batch
   *  continuation). */
  #routeState(): ExecutionState {
    return this.#face.nextSemantics.batch ? this.#state : EMPTY_RUN_STATE;
  }

  /** The line's OWN next-hop object — the LINE FRONTIER assembly: this lifecycle's
   *  frame facts handed to the ONE derivation (`Ledger#nextHopOf`): the recorded
   *  round's route, the line's completed records, the drift-aware gate and the
   *  injected station discrimination. The nullable route is handed over UNJUDGED — the
   *  assembly owns the exit-side decision (a closed line's `null` route is where the
   *  drift reopen lands). Serves `peekNext` and the capsule's spec-less degradation
   *  only; the capsule's ordinary hop is the pipeline frontier's assembly
   *  (`#roundHop`). The failure face's absent hop is the CALLER's fact (`advance`
   *  passes null for a BLOCKED/TIMEOUT round), never a second short-circuit here. */
  #hopOf(frame: OpenFrame, route: Route | null): NextHop {
    const target = this.#routeTarget(frame);
    return this.#ledger.nextHopOf({
      type: frame.type,
      key: frame.key,
      route,
      target,
      doc: this.#docOf(frame),
      // The wave closure's NEXT-line fact (P21 §4.2) rides the derivation's input
      // face — the retired render-side patch parameter is gone, the fact is not.
      nextLineOpen: frame.type === "wave" ? this.#branchLineOpen() : undefined,
      // The wave line's OWN drift fact (D30): the reason cell's second source. Only
      // the wave face injects it — every doc line reads its gate verdict instead.
      briefDrift: frame.type === "wave" ? this.#ledger.briefDrifted(String(frame.key)) : undefined,
      docClassOf: (candidate) => this.#docClassOf(candidate),
    });
  }

  /** The line's judged document — the doc lines' own path, the branch line's plan
   *  (its identity document, P21 §4.1); null off the doc faces. */
  #docOf(frame: OpenFrame): string | null {
    if (frame.target.kind === "plan" || frame.target.kind === "spec") return frame.target.doc;
    if (frame.target.kind === "branch") return this.#planPath;
    return null;
  }

  /** The round's rendered hop — the PIPELINE frontier's ONE assembly when the node
   *  holds a spec document (the object the board's `next:` row renders, so the two
   *  faces state one hop), this line's own frame-keyed assembly otherwise. The
   *  degradation key is `#specPath === null` and nothing else: a plan-only phase is the
   *  ordinary spec-less shape, and there the frontier's rules anchor on an absent
   *  identity face (rule 3) — it would print a transition the line has already taken. */
  #roundHop(frame: OpenFrame, route: Route | null): NextHop {
    if (this.#specPath === null) return this.#hopOf(frame, route);
    return this.#frontier.hopOf(this.#pipelineInput(), { docClassOf: (c) => this.#docClassOf(c) });
  }

  /** The pipeline frontier's four declared cells — assembled once from the injected
   *  facts so no second judge is introduced here. */
  #pipelineInput(): PipelineFrontierInput {
    return {
      specType: this.#specType,
      specPath: this.#specPath,
      planPath: this.#planPath,
      planGraph: this.#planGraph,
    };
  }

  /** Whether the branch line has a dispatchable open round — the wave closure's
   *  NEXT-line fact (P21 §4.2), delegated to the pipeline frontier's ONE judge (the
   *  shared hop assembly's sixth cell). The lifecycle now holds no copy of the gate /
   *  route combination. */
  #branchLineOpen(): boolean | undefined {
    return this.#frontier.branchLineOpen(this.#planPath);
  }

  /** The capsule lines of one step — empty unless a capsule is attached (the non-hard
   *  interaction point). A success round carries the handoff carrier path; a failure
   *  round (TIMEOUT / BLOCKED) carries the crash record as its handoff cell, emitted
   *  only when that record exists (a no-host BLOCKED writes none). The fix round's
   *  disposition summary is handed to the capsule as its `summary` — the render places
   *  it between the status line and the `next:` row (P22 §10). */
  #capsuleLines(
    frame: OpenFrame,
    outcome: DispatchOutcome,
    hop: NextHop | null,
  ): readonly string[] {
    const summary = outcome.dispositionsSummary;
    if (this.#capsule === null) return summary === undefined ? [] : [summary];
    const op = this.#opOf(frame.phase);
    const failure = outcome.status === "BLOCKED" || outcome.status === "TIMEOUT";
    const naming = this.#ledger.naming();
    // The failure face's handoff is the crash record — the engine's own postmortem
    // artifact, its existence the emission condition; the success face keeps the
    // round's handoff carrier path — the FINAL carrier the round wrote (P31 §2.3),
    // resolved through the ledger's ONE read-name rule (the draft's family spelling is
    // the fallback, never the cell's own derivation). The crash name derives from the
    // frame through the ONE naming source (`RoundNaming`), the same name the lifecycle
    // wrote it under.
    const crash = failure ? this.#ledger.readCrash(naming.crashName(frame)) : null;
    const handoff =
      crash !== null
        ? naming.crashPath(frame)
        : this.#ledger.resolveHandoffPath(op, frame.type, frame.params);
    return this.#capsule.emit(outcome.status, handoff, hop, crash !== null, summary);
  }

  /** The frame's RouteTarget — the dispatch-ready literal's target identity (the
   *  frame's own facts: the wave task key · the branch line key · the doc path).
   *  `type` rides the wave target type; `id` the frame's parameters; `plan` the
   *  workspace plan path (the implement literal's required `--plan`). */
  #routeTarget(frame: OpenFrame): RouteTarget | null {
    switch (frame.type) {
      case "wave":
        return { type: "wave", id: frame.params.tasks ?? "", plan: this.#planPath ?? undefined };
      case "branch":
        // The branch line's stable id — the workspace plan path carries the
        // fix/re-review literals' `--plan` (a plan-less `#sceneOf` would resolve
        // to the empty directory · the workspace double identity · zero
        // orchestrator fallback).
        return {
          type: "branch",
          id: "branch",
          plan: this.#planPath ?? undefined,
        };
      case "phase-spec":
      case "overall":
      case "plan":
      case "single-spec":
        return {
          type: frame.type,
          id: (frame.target as { kind: "plan" | "spec"; doc: string }).doc,
        };
    }
  }
}
