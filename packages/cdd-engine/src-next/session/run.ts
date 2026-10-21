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
import type { DispatchPhase, ReviewLead, RouteTarget, TargetFace, TargetType } from "./faces.ts";
import {
  type HandoffParams,
  Ledger,
  type LedgerKey,
  type OpType,
  type RoundFinding,
  type RoundStatus,
  type Termination,
} from "./ledger.ts";
import type { Route } from "./next.ts";
import { NextStepRouter } from "./next.ts";
import type { PreFlightVerdict } from "./preflight.ts";
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

/** The audit target of one dispatch step — what the round audits. */
export type AuditTarget =
  /** wave (T26 · the wave-unitary model): the frontier's open wave — the whole ready
   *  batch is ONE dispatch unit (one brief · one child · one commit · one round). */
  | { kind: "wave"; tasks: readonly number[] }
  /** branch: the branch line itself (no commit identity — the review's scope anchor
   *  rides the engine-injected BASE_BRANCH, never a stored range). */
  | { kind: "branch" }
  /** plan: the audit plan document path. */
  | { kind: "plan"; doc: string }
  /** spec: the audit spec document path. */
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
   *  (`status · blocker · handoff` on success; `status` plus the crash `handoff` on
   *  TIMEOUT/BLOCKED) via the face's word table. The additive optional RouteTarget
   *  supplies the dispatch frame's own type + id for the dispatch-ready `next:`
   *  literal (v1.25 — the 4-param call stays valid: the target is an optional 5th).
   *  `withHandoff` is the round's crash-record fact (the failure handoff cell). */
  emit(
    status: string,
    blocker: string,
    handoff: string,
    next?: Route | string | null,
    target?: RouteTarget | null,
    withHandoff?: boolean,
  ): string[];
}

/** One advance step's result — the facts the caller drives on. */
export interface StepResult {
  /** The frame the step dispatched. */
  frame: OpenFrame;
  /** The round count on record after bookkeeping. */
  round: number;
  /** The C5 next-hop route after this step (consumed per the face's next
   *  semantics: a next-wave advances the task batch — batch faces only). */
  route: Route | null;
  /** The capsule lines rendered at the interaction point (empty when no capsule is
   *  attached — the seam is non-hard). */
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
   *  arg (P4.1 T4 — the task face's implement-consuming fact). */
  readonly #planPath: string | null;

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
    /** The workspace plan path (P4.1 T4 — the implement `next:` literal's `--plan`). */
    planPath?: string | null;
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
   *  phase's round in the same invocation). Null = the run is exhausted / capped. */
  peekNext(): OpenFrame | null {
    return this.#openFrame();
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
          round: this.#ledger.roundCount(frame.key, frame.phase),
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
    return {
      frame,
      round,
      route,
      capsuleLines: this.#capsuleLines(frame, outcome, route),
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
    return {
      type: "wave",
      phase,
      round,
      target,
      params: this.#paramsOf({ type: "wave", phase, target, round }),
      key,
    };
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
    return {
      type: this.#face.type,
      phase,
      round,
      target,
      params: this.#paramsOf({ type: this.#face.type, phase, target, round }),
      key,
    };
  }

  /** The next phase of a single-target line — the doc-revision gate (lifecycle-side:
   *  its reviewGate needs the target doc path) then the ledger's SINGLE rounds/routes
   *  judge (`Ledger#linePhase`, D40 — the retired lifecycle twin). A CLOSED doc line
   *  reopens through the identity verdict (T7): a drifted doc opens the review lead
   *  whatever the round/route state says (the fix-awaited route never freezes a
   *  revised doc); an unchanged doc with the pending fix derived opens the fix; the
   *  unbound / same-without-pending faces fall through to the shared rounds/routes
   *  walk (a completed-fix line reopens review through the fix round's route). */
  #nextLinePhase(
    key: LedgerKey,
    target: AuditTarget,
    reviewLead: ReviewLead,
  ): DispatchPhase | null {
    if (target.kind === "plan" || target.kind === "spec") {
      const verdict = this.#ledger.reviewGate(key, target.doc, this.#face.type);
      if (verdict.kind === "open") return reviewLead;
      if (verdict.kind === "same" && verdict.pending) return "fix";
    }
    return this.#ledger.linePhase(key, this.#face.type);
  }

  /** The round number one phase dispatches under: implement = the fixed family (1);
   *  the review-lead = the next increment; fix = the source review-lead round. */
  #roundFor(phase: DispatchPhase, key: LedgerKey): number {
    if (phase === "implement") return 1;
    if (phase === "fix") {
      const reviews = this.#reviewCount(key);
      return reviews > 0 ? reviews : 1;
    }
    return this.#reviewCount(key) + 1;
  }

  /** The review-lead round count of a key (branch counts its branch-review mode,
   *  the others the review mode — the face row's single source). */
  #reviewCount(key: LedgerKey): number {
    return this.#ledger.roundCount(key, this.#face.product.reviewLead);
  }

  /** The progress key of a single-target line — the line's STABLE key (find #9 ·
   *  spec §6.5/§3.7 — `"branch"` per workspace for the branch line, accumulating
   *  across re-reviews; the doc line keys by its line-type constant `"spec"`/`"plan"`
   *  — the argv path copy never resets the round: a moved argv string (absolute vs
   *  relative) must not fork the same line into two ledger rows). The task face
   *  never routes here — frames key by the wave key. */
  #lineKey(target: AuditTarget): LedgerKey {
    if (target.kind === "plan" || target.kind === "spec") return this.#face.type;
    return "branch";
  }

  // -------------------------------------------------------------------------
  // the frame → handoff params shaping
  // -------------------------------------------------------------------------

  /** The handoff params one frame fills — the type's placeholders from the target
   *  and round. The round rides the increment families (review / fix / branch-review
   *  — the family name carries it); the fixed implement family stays round-less. */
  #paramsOf(frame: {
    type: TargetType;
    phase: DispatchPhase;
    target: AuditTarget;
    round: number;
  }): HandoffParams {
    switch (frame.type) {
      case "wave": {
        const waveTarget = frame.target as { kind: "wave"; tasks: readonly number[] };
        const params: HandoffParams = { tasks: waveTarget.tasks.join(",") };
        if (frame.phase !== "implement") params.round = frame.round;
        return params;
      }
      case "branch":
        return { round: frame.round };
      case "spec":
      case "plan":
        return { round: frame.round };
    }
  }

  // -------------------------------------------------------------------------
  // dispatch → result → bookkeeping
  // -------------------------------------------------------------------------

  /** Bookkeeping — persist the round's handoff carrier and record the progress round.
   *  The persisted carrier is either the dispatch's materialized form (the production
   *  read-back reconstruct — outcome.carrier, full-replace at the SAME path, so the
   *  child's draft becomes the finalized carrier — the two-state single file, the engine is the single
   *  author) or the engine-built fallback from the outcome fields (the hermetic /
   *  injected dispatchers). A BLOCKED/TIMEOUT round WITHOUT a carrier is neither persisted nor
   *  recorded — the child's draft (if any) stays untouched (no-overwrite on failure) and the
   *  frontier re-offers the same round (resume = re-run the same command); a BLOCKED
   *  round WITH a carrier (e.g. the evidence-contract override — the child's work is
   *  preserved as the BLOCKED carrier) is persisted but not counted as a completed
   *  round, so the frontier still re-dispatches it. Returns the round count on record
   *  (the task done-marking rides the step's C5 route — #markTerminal, after
   *  #routeNext). */
  #bookkeep(frame: OpenFrame, outcome: DispatchOutcome): number {
    const blocked = outcome.status === "BLOCKED" || outcome.status === "TIMEOUT";
    if (outcome.carrier !== undefined || !blocked) {
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
      this.#ledger.persistHandoff(op, frame.type, frame.params, carrier);
    }
    if (!blocked) {
      // The recorded CYCLE is the frame's own round — its identity (fix-K ⟷ review-K ·
      // D28): a skipped cycle records its own number, never a flattened ordinal.
      const count = this.#ledger.recordRound(frame.key, frame.phase, frame.round);
      // The completed-review revision write-back — the doc line and the wave line
      // each bind their OWN reviewed revision (T7 doc · T11 wave / D16 / D30): a
      // completed review binds the CURRENT revision of the reviewed input — read at
      // bookkeep, the clean-tree dispatch gate keeps the read-only review's input
      // stable across the round. For a doc line that input is the target doc (the
      // whole-content doc-revision). For a wave line it is the RENDERED BRIEF —
      // `#recordReviewedWaveBrief` → `recordReviewedBrief(String(frame.key),
      // #planPath)` hashes the brief the plan renders to, holding #planPath only as
      // the plan the brief renders FROM (the render-from POINTER, not the hashed
      // identity; the wave gate derives the plan path FROM this record, so
      // cli.ts/preflight.ts stay untouched). The two legs do NOT share one gate —
      // each ref kind carries its own reviewed identity. An unreadable input records
      // nothing (present facts only); a null plan path (no plan fact) leaves a legacy
      // wave row — null stays backward compatible.
      if (frame.phase === "review") {
        if (frame.target.kind === "plan" || frame.target.kind === "spec")
          this.#recordReviewedDocRevision(frame);
        else if (frame.target.kind === "wave") this.#recordReviewedWaveBrief(frame);
      }
      return count;
    }
    return this.#ledger.roundCount(frame.key, frame.phase);
  }

  /** The reviewed-revision write-back — bind the reviewed input's revision to the
   *  line record (the T7 doc + D30 wave identity gates' reopen-compare basis). The
   *  doc face binds its target doc's whole-content revision; the wave face binds its
   *  RENDERED BRIEF's revision (D30 — the wave's true judgment input is the brief,
   *  never the whole plan: transcript edits outside the wave's task sections must not
   *  void a reviewed wave). An unreadable input records nothing — the line keeps the
   *  legacy closed face (only present facts land, never an invented identity). */
  #recordReviewedDocRevision(frame: OpenFrame): void {
    if (frame.target.kind !== "plan" && frame.target.kind !== "spec") return;
    try {
      const content = readFileSync(frame.target.doc, "utf8");
      this.#ledger.recordReviewedRevision(
        frame.key,
        this.#ledger.refs().docRevision(frame.target.doc, content),
      );
    } catch {
      // unreadable input — no reviewed identity recorded (present facts only)
    }
  }

  /** The wave line's reviewed-brief write-back (D30) — bind the RENDERED brief's
   *  revision for the wave's tasks to the row (the D30 wave-gate reopen basis). Null
   *  plan path / underivable brief records nothing (present facts only). */
  #recordReviewedWaveBrief(frame: OpenFrame): void {
    if (frame.target.kind !== "wave" || this.#planPath === null) return;
    this.#ledger.recordReviewedBrief(String(frame.key), this.#planPath);
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
  }

  /** The handoff-family op of a phase — branch-review rides the review family. */
  #opOf(phase: DispatchPhase): OpType {
    return phase === "branch-review" ? "review" : phase;
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

  /** The capsule lines of one step — empty unless a capsule is attached (the non-hard
   *  interaction point). A success round carries the real blocker count and the
   *  handoff carrier path. A failure round (TIMEOUT / BLOCKED) carries no blocker
   *  cell (its count would be a filler); its handoff cell is the crash record and is
   *  emitted only when that record exists (a no-host BLOCKED writes none). The
   *  dispatch-ready `next:` literal rides the frame's own RouteTarget identity
   *  (type + id — the v1.25 combination point: frame.type + params.tasks + route
   *  are all present here). */
  #capsuleLines(
    frame: OpenFrame,
    outcome: DispatchOutcome,
    route: Route | null,
  ): readonly string[] {
    if (this.#capsule === null) return [];
    const op = this.#opOf(frame.phase);
    const failure = outcome.status === "BLOCKED" || outcome.status === "TIMEOUT";
    const lane = `${op}.${frame.type}`;
    // The failure face's handoff is the crash record — the engine's own postmortem
    // artifact, its existence the emission condition; the success face keeps the
    // round's handoff carrier path.
    const crash = failure ? this.#ledger.readCrash(lane, frame.round) : null;
    const blockers = (outcome.findings ?? []).filter(
      (finding) => finding.severity === "blocker",
    ).length;
    const handoff =
      crash !== null
        ? this.#ledger.crashPath(lane, frame.round)
        : this.#ledger.handoffPath(op, frame.type, frame.params);
    return this.#capsule.emit(
      outcome.status,
      String(blockers),
      handoff,
      route,
      this.#routeTarget(frame),
      crash !== null,
    );
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
      case "spec":
      case "plan":
        return {
          type: frame.type,
          id: (frame.target as { kind: "plan" | "spec"; doc: string }).doc,
        };
    }
  }
}
