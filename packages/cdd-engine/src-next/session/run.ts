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

import type { DispatchPhase, ReviewLead, TargetFace, TargetType } from "./faces.ts";
import type { HandoffParams, Ledger, LedgerKey, RoundFinding, RoundStatus } from "./ledger.ts";
import type { Route } from "./next.ts";
import { NextStepRouter } from "./next.ts";
import type { ExecutionState, Frontier } from "./state.ts";

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
  /** task: the frontier's next ready task id. */
  | { kind: "task"; task: number }
  /** branch: the branch diff range (full shas — the {base7}/{head7} tokens derive). */
  | { kind: "branch"; base: string; head: string }
  /** spec/plan: the audit document path. */
  | { kind: "doc"; doc: string };

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
  /** The progress ledger key the round records under (a task id / a range key /
   *  a doc path). */
  key: LedgerKey;
}

/** One round's dispatch outcome — what the lifecycle records and routes on. */
export interface DispatchOutcome {
  /** The round's concluding status. */
  status: RoundStatus;
  /** The round's findings (review: this round's own; fix: the source review's
   *  input findings, C5-1). */
  findings?: readonly RoundFinding[];
  /** The commit range the round concluded (implement/fix). */
  commits?: { base: string; head?: string };
  /** The artifact paths the round produced (brief/report/…). */
  artifacts?: Record<string, string>;
}

/** The dispatch instruction — runs one round's actual work (the harness call in
 *  production; a stub in tests). The lifecycle never inspects how the work runs. */
export type DispatchStep = (frame: OpenFrame) => DispatchOutcome;

/** The capsule interaction seam — the face/capsule contact. T10's Capsule satisfies
 *  this shape; the lifecycle advances without a capsule (non-hard consumption) and
 *  attachCapsule only renders the step's round facts when a capsule is connected. */
export interface CapsuleFace {
  /** Render the capsule lines for one round's facts — byte-stable `status · blocker
   *  · handoff` plus the optional `next:` line (the words ride the face's word table). */
  emit(status: string, blocker: string, handoff: string, next?: Route | string | null): string[];
}

/** One advance step's result — the facts the caller drives on. */
export interface StepResult {
  /** The frame the step dispatched. */
  frame: OpenFrame;
  /** The round count on record after bookkeeping. */
  round: number;
  /** The C5 next-hop route after this step (consumed per the face's next
   *  semantics: a next-group advances the task batch — batch faces only). */
  route: Route | null;
  /** The capsule lines rendered at the interaction point (empty when no capsule is
   *  attached — the seam is non-hard). */
  capsuleLines: readonly string[];
}

/**
 * Lifecycle — the parameterized single lifecycle over one target-type face. One
 * instance drives one target line. advance() runs one dispatch step:
 *
 *   frontier  — resolve the open frame from the face's audit descriptor;
 *   dispatch  — run the injected dispatch instruction, capture the outcome;
 *   bookkeep  — persist the handoff carrier + record the progress round (+ mark
 *               the task done when the round concludes its line);
 *   route     — read the recorded round back through the ledger and derive the C5
 *               next-hop Route.
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
  /** The fixed audit target of a branch-range / doc-path face (the task face
   *  resolves it from the frontier). */
  readonly #target: AuditTarget | null;
  /** The attached capsule face — null = the step advances output-less. */
  #capsule: CapsuleFace | null;

  constructor(opts: {
    face: TargetFace;
    state: RunState;
    ledger: Ledger;
    dispatch: DispatchStep;
    router?: NextStepRouter;
    /** The fixed audit target for a branch-range / doc-path face. */
    target?: AuditTarget;
    /** The capsule face to attach at construction (optional — the seam is non-hard). */
    capsule?: CapsuleFace | null;
  }) {
    this.#face = opts.face;
    this.#state = opts.state;
    this.#ledger = opts.ledger;
    this.#dispatch = opts.dispatch;
    this.#router = opts.router ?? new NextStepRouter();
    this.#target = opts.target ?? null;
    this.#capsule = opts.capsule ?? null;
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

  /** advance() — one dispatch step: frontier → dispatch → result → bookkeeping →
   *  next routing. Null when the line holds no open frame (the run is exhausted or
   *  a capped line defers to the user). */
  advance(): StepResult | null {
    const frame = this.#openFrame();
    if (frame === null) return null;
    const outcome = this.#dispatch(frame);
    const round = this.#bookkeep(frame, outcome);
    const route = this.#routeNext(frame);
    return {
      frame,
      round,
      route,
      capsuleLines: this.#capsuleLines(frame, outcome, route),
    };
  }

  // -------------------------------------------------------------------------
  // frontier — the open dispatch frame
  // -------------------------------------------------------------------------

  /** Resolve the line's next open frame — null when the line is exhausted. */
  #openFrame(): OpenFrame | null {
    if (this.#face.audit.kind === "task-graph") return this.#openTaskFrame();
    const target = this.#target;
    if (target === null) return null; // a fixed-target face without its target holds
    return this.#openLineFrame(target);
  }

  /** The task face's next open frame — the smallest ready-and-not-done task whose
   *  line still has a phase to run; null when the frontier holds only closed lines. */
  #openTaskFrame(): OpenFrame | null {
    const done = this.#state.doneTasks();
    for (const task of this.#state.frontier(done)) {
      const phase = this.#nextTaskPhase(task);
      if (phase === null) continue;
      const target = { kind: "task", task } as const;
      const round = this.#roundFor(phase, task);
      return {
        type: "task",
        phase,
        round,
        target,
        params: this.#paramsOf({ type: "task", phase, target, round }),
        key: task,
      };
    }
    return null;
  }

  /** The next phase of one task line — driven by the ledger progress + the C5 route
   *  of the latest recorded round (implement → review → fix → re-review → closure).
   *  Null when the line is closed (its latest round's route is none / next-group /
   *  soft-cap — the soft cap defers to the user). */
  #nextTaskPhase(task: number): DispatchPhase | null {
    const implemented = this.#ledger.roundCount(task, "implement");
    const reviews = this.#ledger.roundCount(task, "review");
    const fixes = this.#ledger.roundCount(task, "fix");
    if (implemented === 0) return "implement";
    if (reviews === 0) return "review";
    if (fixes < reviews) return "fix";
    // The round pair (review r + fix r) is complete — the fix round's C5 route
    // decides the re-review or the closure (an unreadable round holds the line:
    // only present facts land).
    const carried = this.#ledger.round("fix", "task", { tasks: String(task) }, reviews);
    if (carried === null) return null;
    const route = this.#router.next(this.#state, carried);
    return route?.kind === "review" ? "review" : null;
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

  /** The next phase of a single-target line — the round sequence driven by the C5
   *  routes of the recorded rounds. A review-lead awaiting its fix opens the fix
   *  only when the review routed one (findings); a clean review closes the line
   *  (no markDone on the task-less faces — the route IS the closure gate). The
   *  completed pair re-keys on the fix round's route (re-review vs closure). */
  #nextLinePhase(
    key: LedgerKey,
    target: AuditTarget,
    reviewLead: ReviewLead,
  ): DispatchPhase | null {
    const reviews = this.#ledger.roundCount(key, reviewLead);
    const fixes = this.#ledger.roundCount(key, "fix");
    if (reviews === 0) return reviewLead;
    if (fixes < reviews) {
      const route = this.#roundRoute(target, reviews);
      return route?.kind === "fix" ? "fix" : null;
    }
    const route = this.#lineRoute(target, reviews);
    return route?.kind === "review" ? reviewLead : null;
  }

  /** The C5 route of a single-target line's review-lead round — the fix-awaits /
   *  closure decision when its fix has not yet run (null when the round is
   *  unreadable). */
  #roundRoute(target: AuditTarget, round: number): Route | null {
    const params = this.#paramsOf({
      type: this.#face.type,
      phase: this.#face.product.reviewLead,
      target,
      round,
    });
    const carried = this.#ledger.round("review", this.#face.type, params, round);
    if (carried === null) return null;
    return this.#router.next(this.#routeState(), carried);
  }

  /** The C5 route of a single-target line's latest fix round — the re-review/closure
   *  decision the next open frame keys on (null when the round is unreadable). */
  #lineRoute(target: AuditTarget, fixRound: number): Route | null {
    const params = this.#paramsOf({
      type: this.#face.type,
      phase: "fix",
      target,
      round: fixRound,
    });
    const carried = this.#ledger.round("fix", this.#face.type, params, fixRound);
    if (carried === null) return null;
    return this.#router.next(EMPTY_RUN_STATE, carried);
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

  /** The progress key of a single-target line — the branch range token or the doc
   *  path (the task face never routes here — its frames key by task id). */
  #lineKey(target: AuditTarget): LedgerKey {
    if (target.kind === "branch") return `${target.base.slice(0, 7)}..${target.head.slice(0, 7)}`;
    return (target as { kind: "doc"; doc: string }).doc;
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
      case "task": {
        const taskTarget = frame.target as { kind: "task"; task: number };
        const params: HandoffParams = { tasks: String(taskTarget.task) };
        if (frame.phase !== "implement") params.round = frame.round;
        return params;
      }
      case "branch": {
        const { base, head } = frame.target as { kind: "branch"; base: string; head: string };
        return { base7: base.slice(0, 7), head7: head.slice(0, 7), round: frame.round };
      }
      case "spec":
      case "plan":
        return { round: frame.round };
    }
  }

  // -------------------------------------------------------------------------
  // dispatch → result → bookkeeping
  // -------------------------------------------------------------------------

  /** Bookkeeping — persist the round's handoff carrier, record the progress round
   *  and, for the task face, mark the task done when the round concludes its line
   *  (so the frontier's ready batch excludes the closed task before the next route).
   *  Returns the round count on record. */
  #bookkeep(frame: OpenFrame, outcome: DispatchOutcome): number {
    const op = this.#opOf(frame.phase);
    const carrier = this.#ledger.buildHandoff(op, frame.type, frame.params, {
      findings: outcome.findings === undefined ? undefined : [...outcome.findings],
      commits: outcome.commits,
      artifacts: outcome.artifacts,
    });
    if (outcome.status !== undefined) carrier.status = outcome.status;
    this.#ledger.persistHandoff(op, frame.type, frame.params, carrier);
    const round = this.#ledger.recordRound(frame.key, frame.phase);
    if (this.#terminal(frame)) {
      const taskTarget = frame.target as { kind: "task"; task: number };
      this.#state.markDone(taskTarget.task);
    }
    return round;
  }

  /** Whether one round concludes its task line — a review with zero findings, or a
   *  fix whose SOURCE review carried no blockers (C5-1: the recorded fix round's
   *  findings ARE the source review's). A review with findings — any severity —
   *  routes the fix and never closes the line; an implement round is never terminal
   *  (the review awaits). */
  #terminal(frame: OpenFrame): boolean {
    if (frame.type !== "task" || frame.phase === "implement") return false;
    const op = this.#opOf(frame.phase);
    const carried = this.#ledger.round(op, frame.type, frame.params, frame.round);
    if (carried === null) return false;
    if (frame.phase === "review") return carried.findings.length === 0;
    return !carried.findings.some((finding) => finding.severity === "blocker");
  }

  /** The handoff-family op of a phase — branch-review rides the review family. */
  #opOf(phase: DispatchPhase): "implement" | "review" | "fix" {
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
   *  interaction point). The blocker cell carries the round's blocker count. */
  #capsuleLines(
    frame: OpenFrame,
    outcome: DispatchOutcome,
    route: Route | null,
  ): readonly string[] {
    if (this.#capsule === null) return [];
    const op = this.#opOf(frame.phase);
    const blockers = (outcome.findings ?? []).filter(
      (finding) => finding.severity === "blocker",
    ).length;
    const handoff = this.#ledger.handoffPath(op, frame.type, frame.params);
    return this.#capsule.emit(outcome.status, String(blockers), handoff, route);
  }
}
