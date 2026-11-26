// packages/cdd-engine/src/run/advance/next.ts
// The next-hop assembly and the ONE reason table — the whole `next:` / `reason:`
// vocabulary of the advance segment.
//
// INVARIANT — every name a hop is reported by has ONE spelling, declared in the table in
// this file: the structure leg reuses the pre-flight row ids, the line leg is the wave
// gate's five rows plus the doc/branch refusals, and the station leg is the sign a `next:`
// hop is named by. A second spelling anywhere else is a drift, not a view — the wave gate
// reads its five tokens through `WAVE_GATE_REASON`, the hop's `reason:` reads its own
// through `NEXT_HOP_REASON`, and neither carries a literal.
//
// The six hop cells are derived once (`NextRoutes#nextOf`): the count route is the ONE
// judgment, the hop and the pipeline station are READ OUT of it, and the reason names the
// fact that selected it. Nothing here re-judges a route a caller already holds — the face
// axis is read out of the injected doc-class verdict, and the drift cells are INPUTS.
//
// Module-level exports are types, the declared tables and the class — zero
// behaviour-carrying bare functions.

import type { RoundFinding } from "../dispatch/handoff.ts";
import type { RoundOp } from "../ledger/identity.ts";
import type { RouteTarget, TargetType } from "./target-faces.ts";

/** The pipeline's row keys — every declared target type is one, because a closed document
 *  hands off exactly like any other closed face. */
export type PipelineKey = TargetType;

/** The doc-class verdict of a render target: the pipeline key a closed face hands off to,
 *  or one of the two the pipeline cannot route (`blocked` = the declaration is missing,
 *  `terminal` = no target at all). */
export type DocClassVerdict = PipelineKey | "blocked" | "terminal";

/** The local alias the members below read. */
type DocClass = DocClassVerdict;

/** One pipeline-next row: a skill ref, a literal command, or the pipeline terminal. */
export type PipelineEntry =
  | { readonly kind: "ref"; readonly ref: string }
  | { readonly kind: "literal"; readonly literal: string }
  | { readonly kind: "done" };

/** THE face-to-face table — the one place a closed line's next entry is declared. The
 *  program's only terminal row is the charter; a standalone specification hands off like
 *  any other spec line. */
export const PIPELINE_NEXT: Readonly<Record<TargetType, PipelineEntry>> = {
  "phase-spec": { kind: "ref", ref: "kairos:cdd-plan" },
  overall: { kind: "done" },
  plan: { kind: "ref", ref: "kairos:cdd-dev" },
  "single-spec": { kind: "ref", ref: "kairos:cdd-plan" },
  wave: { kind: "literal", literal: "review --type branch --plan <plan>" },
  branch: { kind: "ref", ref: "kairos:cdd-close" },
};

/** The pipeline's phase-level faces — the walk order, declared once. The charter is the
 *  terminus (never walked) and a standalone specification is a spec line, so neither is a
 *  face of the traversal. */
export type PhaseFaceKey = Exclude<PipelineKey, "overall" | "single-spec">;

/** THE phase-level face order. The frontier iterates this tuple, so no consumer declares
 *  an order of its own. */
export const PIPELINE_FACES: readonly PhaseFaceKey[] = ["phase-spec", "plan", "wave", "branch"];

/** One pipeline face's observed facts — readings, never judgments. */
export interface PipelineFaceState {
  /** Whether the face's line is closed (its latest route lies on the closure side). */
  readonly closed: boolean;
  /** The face's active hop, or null when it holds none. */
  readonly active: Route | null;
  /** The face's render target, or null when the document is absent or the face's own
   *  entry predicate never held. */
  readonly target: RouteTarget | null;
}

/** The verdict one route describes — the route, the render target it belongs to, and the
 *  face the route belongs to (null under the two exchange rules, where the anchor is read
 *  back off the target). */
export interface PipelineVerdict {
  readonly face: PhaseFaceKey | null;
  readonly route: Route;
  readonly target: RouteTarget | null;
}

/** The `next:` decision — the ONE "next step" concept: the line-internal hop and the
 *  face-to-face handoff are the same union, so no consumer consults a second table. */
export type Route =
  /** closure — the run is exhausted. */
  | { readonly kind: "done" }
  /** closure — another wave is ready; the value is its task-group key. */
  | { readonly kind: "next-wave"; readonly tasks: string }
  /** a review hop (the live tree — no commit identity). */
  | { readonly kind: "review" }
  /** the one-way fix hop, carrying the requesting carrier the fix reads. */
  | {
      readonly kind: "fix";
      readonly reviews?: string;
      readonly rulings?: string;
    }
  /** the review-cycle soft cap — the hop defers to user adjudication. */
  | { readonly kind: "soft-cap"; readonly message: string }
  /** the face-to-face handoff. */
  | { readonly kind: "handoff"; readonly entry: PipelineEntry };

/** The review-cycle soft cap — the consecutive-blocker run length at which the fix face
 *  defers the next hop to user adjudication. Soft by nature: a default suggestion the user
 *  or the plan's write authority overrides. THE one literal in `src/**`. */
export const REVIEW_CYCLE_CAP = 80;

/** The soft-cap suggestion's bytes. */
export const SOFT_CAP_SUGGESTION = "BLOCKED: review-cycle-cap — user adjudicates";

/** The the face-internal verb a line can hop to. */
export type Hop = "implement" | "review" | "branch-review" | "fix";

/** The reason table's leg partition: the pre-flight structure gates, the line's own
 *  refusals, and the station signs a `next:` hop is named by. */
export type DispatchReasonLeg = "structure" | "line" | "station";

/** One reason row: the token and its leg. */
export interface DispatchReasonRow {
  readonly token: string;
  readonly leg: DispatchReasonLeg;
}

/** THE reason table. Every refusal row and every `NextHop.reason` value names a fact by one
 *  spelling from here — a hyphenated fact name, never a sentence. */
export const DISPATCH_REASON = {
  // structure — the pre-flight gate ids, reused as tokens
  treeClean: { token: "tree-clean", leg: "structure" },
  inFlight: { token: "in-flight", leg: "structure" },
  graph: { token: "graph", leg: "structure" },
  planLedger: { token: "plan-ledger", leg: "structure" },
  docContract: { token: "doc-contract", leg: "structure" },
  // structure — the four pre-dispatch stations (their token IS the station word)
  noHost: { token: "no-host", leg: "structure" },
  carrier: { token: "carrier", leg: "structure" },
  dispatchInput: { token: "dispatch-input", leg: "structure" },
  artifact: { token: "artifact", leg: "structure" },
  // line — the wave gate's five rows
  mixedBatch: { token: "mixed-batch", leg: "line" },
  waveTooWide: { token: "wave-too-wide", leg: "line" },
  tooManyTasks: { token: "too-many-tasks", leg: "line" },
  split: { token: "split", leg: "line" },
  wrongPhase: { token: "wrong-phase", leg: "line" },
  // line — the doc/branch refusals
  pendingFix: { token: "pending-fix", leg: "line" },
  unchanged: { token: "unchanged", leg: "line" },
  closedLine: { token: "closed-line", leg: "line" },
  faceClosed: { token: "face-closed", leg: "line" },
  // station — the signs a `next:` hop is named by
  briefDrift: { token: "brief-drift", leg: "station" },
  docDrift: { token: "doc-drift", leg: "station" },
  softCap: { token: "soft-cap", leg: "station" },
  taskOpen: { token: "task-open", leg: "station" },
  docClassBlocked: { token: "doc-class-blocked", leg: "station" },
} as const satisfies Record<string, DispatchReasonRow>;

/** Every token the table declares — the one domain a refusal reason is drawn from. */
export type DispatchReason = (typeof DISPATCH_REASON)[keyof typeof DISPATCH_REASON]["token"];

/** The single-target line's two decision hops — the phases a route can name. */
export type RouteHop = "review" | "fix";

/** The requesting review's two carrier coordinates — what a `fix` hop hands the next round
 *  (the carrier the dispositions read and the rulings sidecar it consumed). Read off the
 *  review record's own identity by the caller, never re-spelled here. */
export interface FixRequest {
  /** The requesting carrier's path (the `--reviews` input). */
  readonly reviews?: string;
  /** The rulings sidecar the ledger resolved for that record. */
  readonly rulings?: string;
}

/** The wave gate's five rows as a TYPED VIEW of the shared table's line leg. The token
 *  spellings live in the table only, so `wave.ts` carries no second copy. */
export const WAVE_GATE_REASON = {
  mixedBatch: DISPATCH_REASON.mixedBatch.token,
  waveTooWide: DISPATCH_REASON.waveTooWide.token,
  tooManyTasks: DISPATCH_REASON.tooManyTasks.token,
  split: DISPATCH_REASON.split.token,
  wrongPhase: DISPATCH_REASON.wrongPhase.token,
} as const;

/** The wave gate's verdict reasons. */
export type WaveGateReason = (typeof WAVE_GATE_REASON)[keyof typeof WAVE_GATE_REASON];

/** The hop's `reason:` view — every value is the table's own token. `briefDrift` and
 *  `docDrift` are TWO facts, never one: a wave's task-only projection versus a document's
 *  revision. */
export const NEXT_HOP_REASON = {
  briefDrift: DISPATCH_REASON.briefDrift.token,
  docDrift: DISPATCH_REASON.docDrift.token,
  pendingFix: DISPATCH_REASON.pendingFix.token,
  closedLine: DISPATCH_REASON.closedLine.token,
  faceClosed: DISPATCH_REASON.faceClosed.token,
  softCap: DISPATCH_REASON.softCap.token,
  taskOpen: DISPATCH_REASON.taskOpen.token,
  docClassBlocked: DISPATCH_REASON.docClassBlocked.token,
} as const;

/** One line's next hop — the ONE object every read face renders. `hop` and `to` are
 *  mutually exclusive (the line-internal hop versus the face-to-face handoff), `route` is
 *  the render PAYLOAD, and `target` is the one cell the station lookup and the renderer
 *  both read. */
export interface NextHop {
  /** The face axis — the pipeline key of the line (null = no registered line). */
  readonly face: PipelineKey | null;
  /** The render target the hop belongs to. */
  readonly target: RouteTarget | null;
  /** The line axis — the line-internal next verb (null = no in-line hop). */
  readonly hop: Hop | null;
  /** The pipeline axis — the face-to-face handoff station (null = none). */
  readonly to: PipelineEntry | null;
  /** The named fact that selected this hop — one token of the ONE table. */
  readonly reason: DispatchReason;
  /** The render payload (null = no route: the failure face). */
  readonly route: Route | null;
}

/** One decision's facts — the round the table judges, as VALUES. Nothing here is a second
 *  judgment: the findings and the status are the carrier's own, and the ready batch is the
 *  caller's frontier read. */
export interface RoundFacts {
  /** The requesting carrier a `fix` hop carries; absent when the round wrote none. */
  readonly requesting?: FixRequest;
  /** The phase the round ran. A branch review reads as `branch-review`. */
  readonly phase: RoundOp | "branch-review";
  /** The work-plane conclusion carried by a work round (null on a judge round). */
  readonly status: "APPROVED" | "BLOCKED" | null;
  /** The judge carrier's findings; null when the round wrote none. */
  readonly findings: readonly RoundFinding[] | null;
  /** The consecutive-blocker run length this fix round closes (the soft cap's cell). */
  readonly consecutiveBlockers: number;
  /** The ready task batch — a closure reads it to tell `next-wave` from `done`. */
  readonly readyBatch: readonly number[];
}

/** One hop derivation's input — the count route plus the facts the cells are read from. */
export interface HopInput {
  /** The render target (null = the face was never entered, or a bare terminal). */
  readonly target: RouteTarget | null;
  /** The count table's route (null = the failure face). */
  readonly route: Route | null;
  /** The doc-class discrimination's verdict on `target`. */
  readonly verdict: DocClass;
  /** The drift-aware gate's two cells, kept apart on purpose. */
  readonly gate: { readonly docDrift: boolean; readonly briefDrift: boolean };
  /** The next pipeline line's dispatchable-open fact — the wave face's one reader. */
  readonly nextLineOpen?: boolean;
}

/**
 * NextRoutes — the decision table and the ONE hop derivation. Invariant: a route is judged
 * once by `routeOf` and every cell of a hop is read out of the result (see the file's
 * header); the class keeps no state, so two derivations over the same facts agree.
 */
export class NextRoutes {
  /** The C5 decision table — the one-way hop chain and the unified closure terminal:
   *  implement → review · review with findings → fix · review approved → close · fix with
   *  blockers → review · fix clean → close · the soft cap → the adjudication row. A
   *  failure status produces no next line at all. */
  routeOf(round: RoundFacts): Route | null {
    if (round.status === "BLOCKED") return null;
    if (round.phase === "implement") return { kind: "review" };
    const findings = round.findings ?? [];
    if (round.phase === "review" || round.phase === "branch-review") {
      return findings.length > 0 ? NextRoutes.#fixRoute(round) : this.#close(round.readyBatch);
    }
    if (NextRoutes.atSoftCap(round.consecutiveBlockers)) {
      return { kind: "soft-cap", message: SOFT_CAP_SUGGESTION };
    }
    if (findings.some(NextRoutes.#blocker)) return { kind: "review" };
    return this.#close(round.readyBatch);
  }

  /** Whether a fix round's consecutive-blocker run has reached the soft cap — the ONE
   *  threshold read, so the cap's literal has one home. */
  static atSoftCap(consecutiveBlockers: number): boolean {
    return consecutiveBlockers >= REVIEW_CYCLE_CAP;
  }

  /** The constant route → hop map. It reads the face because a `review` route carries no
   *  face of its own: the branch face's review is the branch-review skill. The closure
   *  kinds are not hops. */
  hopOf(route: Route, face: PipelineKey | null): Hop | null {
    if (route.kind === "next-wave") return "implement";
    if (route.kind === "review") return face === "branch" ? "branch-review" : "review";
    if (route.kind === "fix") return "fix";
    return null;
  }

  /** The ONE hop assembly — the six cells, every one read out of the route or the injected
   *  verdict, never re-derived. */
  nextOf(input: HopInput): NextHop {
    const route = input.route;
    const face = NextRoutes.#faceOf(input.verdict);
    return {
      face,
      target: input.target,
      hop: route === null ? null : this.hopOf(route, face),
      to: this.#entryOf(input, route, input.verdict),
      reason: this.reasonOf(input),
      route,
    };
  }

  /** The named fact behind the hop, in the table's own order: the soft cap · a pending fix
   *  · a drift-reopened line (the brief's movement and a document's revision are two
   *  tokens) · an open line advancing · an unjudgeable doc class · a closed face · the
   *  closed line's handoff. */
  reasonOf(input: HopInput): DispatchReason {
    const route = input.route;
    if (route?.kind === "soft-cap") return NEXT_HOP_REASON.softCap;
    if (route?.kind === "fix") return NEXT_HOP_REASON.pendingFix;
    if (route?.kind === "review" && input.gate.briefDrift) return NEXT_HOP_REASON.briefDrift;
    if (route?.kind === "review" && input.gate.docDrift) return NEXT_HOP_REASON.docDrift;
    if (route !== null && this.hopOf(route, NextRoutes.#faceOf(input.verdict)) !== null) {
      return NEXT_HOP_REASON.taskOpen;
    }
    if (input.verdict === "blocked") return NEXT_HOP_REASON.docClassBlocked;
    if (route === null || input.verdict === "terminal") return NEXT_HOP_REASON.faceClosed;
    return NEXT_HOP_REASON.closedLine;
  }

  /** Whether a route lies on the closure side — the ONE terminal predicate, read by the
   *  lifecycle's terminal marking and by every closure consumer. */
  static routeClosed(route: Route | null): boolean {
    return route !== null && (route.kind === "done" || route.kind === "next-wave");
  }

  /** Whether a route sits on the line's EXIT side — a closure, the face-to-face station, or
   *  no route at all. This is the drift reopen's ONE override scope: only an exit-side
   *  route predates the movement of the bytes the line reviewed. */
  static onExitSide(route: Route | null): boolean {
    return route === null || route.kind === "handoff" || NextRoutes.routeClosed(route);
  }

  /** The face-to-face handoff route for one doc class — one of the two ways the ONE "next
   *  step" concept is produced. */
  static handoff(key: PipelineKey): Route {
    return { kind: "handoff", entry: PIPELINE_NEXT[key] };
  }

  /** The unified closure terminal: the ready batch decides whether another wave continues
   *  the run or the run is exhausted. */
  #close(ready: readonly number[]): Route {
    return ready.length > 0 ? { kind: "next-wave", tasks: ready.join(",") } : { kind: "done" };
  }

  /** The pipeline station of a closure route. A `handoff` carries its own entry, `done`
   *  derives it from the doc class, and an unroutable class has no station. The wave face
   *  is the ONE class whose row depends on the NEXT line: a closed branch line hands the
   *  wave line to the branch face's own exit rather than a literal its gate would refuse. */
  #entryOf(input: HopInput, route: Route | null, verdict: DocClass): PipelineEntry | null {
    if (route === null) return null;
    if (route.kind === "handoff") return route.entry;
    if (route.kind !== "done") return null;
    if (verdict === "blocked" || verdict === "terminal") return null;
    if (verdict === "wave" && input.nextLineOpen === false) return PIPELINE_NEXT.branch;
    return PIPELINE_NEXT[verdict];
  }

  /** The face axis of one verdict — the two unroutable classes carry no face, every
   *  pipeline key is its own face. */
  static #faceOf(verdict: DocClass): PipelineKey | null {
    return verdict === "blocked" || verdict === "terminal" ? null : verdict;
  }

  /** The one-way fix hop. The payload arrives from the caller's record read (the requesting
   *  review's own carrier coordinates); this table renders no name of its own, and a cell the
   *  caller could not resolve stays absent rather than invented. */
  static #fixRoute(round: RoundFacts): Route {
    const reviews = round.requesting?.reviews;
    const rulings = round.requesting?.rulings;
    return {
      kind: "fix",
      ...(reviews === undefined ? {} : { reviews }),
      ...(rulings === undefined ? {} : { rulings }),
    };
  }

  /** Whether one finding is a blocker — the C5-1 severity cell. */
  static #blocker(finding: RoundFinding): boolean {
    return finding.severity === "blocker";
  }
}
