// packages/cdd-engine/src-next/session/next.ts
// T7 — NextStepRouter single point (design spec §3.2): the ONLY `next:` generation
// face of the new tree. The C5 decision table (the spec's pinned semantics, v1.20:
// the closure single-verdict — close() is the one closure point every review/fix
// approval shares):
//   review   zero findings  → close(state) — the ready batch decides next-wave | done
//   review   findings       → fix (one-way — a review never previews what a fix will do)
//   fix      blocker>0      → a re-review hop (the live tree, no commit identity)
//   fix      blocker==0     → close(state) — the warn/nit-only / clean closure (#278,
//                             no APPROVED-mandated re-review)
//   fix      soft cap       → the "BLOCKED: review-cycle-cap" suggestion (user adjudicates)
//   BLOCKED/TIMEOUT         → null (no next line — the CDD_BLOCKED channel owns the face)
//
// close(state) — the v1.20 unified closure terminal: every closure point (a review
// with zero findings / a fix whose source blockers cleared) renders the SAME route
// family — `next-wave` when another wave is ready, `done` when the run is exhausted.
// The `none` word is RETIRED (closure is `done`, never "no suggestion"), and a
// completed non-failed round producing null is now a hard error on the dispatch face
// (no next line = abnormal) — never a silent approved-without-next.
//
// The table judges the round carrier (ledger.ts — the fix round's own findings are
// the source review's input, C5-1) against the execution state (state.ts — the
// ready batch decides next-wave vs done). The Route output carries the structured
// facts the capsule face renders into the `next:` line — including the fix-route
// readback copy, authored here once as FIX_READBACK_SUFFIX (the declared wording
// the capsule renders verbatim, never a literal restate).
//
// D40 — ONE "next step" concept: the face-INTERNAL C5 hop and the face-TO-face
// handoff are the SAME `Route` union (a `handoff` kind carries the pipeline entry),
// so a consumer never consults a second table. The face-to-face station selection
// rides the ONE derivation (`nextHop`): a `done` route's `to` cell is
// `PIPELINE_NEXT`'s row for the judged doc class, a `handoff` route carries its own
// entry, and the pipeline traversal itself belongs to the session plane's
// `PipelineFrontier` — no second resolver.
//
// Module-level exports are types / constants / the class — zero behavior-carrying
// bare functions (the plan's zero-bare-function discipline).

import type { RouteTarget, TargetType } from "./faces.ts";
import type { Round } from "./ledger.ts";
import type { ExecutionState } from "./state.ts";

/** The next-hop suggestion — the decision table's output (null = no next line). The
 *  ONE "next step" concept (D40): the face-internal C5 hops AND the face-to-face
 *  handoff are the same union, so a consumer never consults a second table. */
export type Route =
  /** closure — the run is exhausted (`next: done`, the v1.20 terminal word). */
  | { kind: "done" }
  /** closure — another wave is ready: the next dispatch wave's task ids. */
  | { kind: "next-wave"; tasks: string }
  /** a review hop — a review judges the live tree, carrying no commit identity. */
  | { kind: "review" }
  /** the one-way fix hop — reviewsPath = the review handoff the fix reads (`--reviews`). */
  | { kind: "fix"; reviews?: string }
  /** the review-cycle soft cap — the suggestion defers to user adjudication. */
  | { kind: "soft-cap"; message: string }
  /** the face-to-face handoff (D40) — the line's C5 frontier exhausted, so the next
   *  step is the next pipeline face's entry (`PIPELINE_NEXT[doc-class]`): the face
   *  to face transition is ONE Route kind, never a second table a consumer reads. */
  | { kind: "handoff"; entry: PipelineEntry };

/** The review-cycle soft cap — the consecutive-S1 run length at which the fix face
 *  defers the next hop to user adjudication (soft by nature: a default suggestion,
 *  never a hard stop — the user / the plan write authority override it). */
export const REVIEW_CYCLE_CAP = 50;

/** The wave-width ceiling (design spec §6) — at most this many tasks per dispatch wave.
 *  Declared once on the contract plane (`contract/wave-width.ts`), so the plan-scope
 *  rule reads it without importing this session plane, and re-exported here as the
 *  dispatch face's constant beside `REVIEW_CYCLE_CAP`. Three readers share the one
 *  value: the plan rule, the wave gate's two rejections and their wording. */
export { MAX_TASKS_PER_WAVE } from "../contract/wave-width.ts";

/** The decision-edge words of the Route union — the C5 hop kinds that a review/fix
 *  closure decision edge renders as a `next:` label (`done` · `next-wave` · `review`
 *  · `fix` · `soft-cap`). The pure face-to-face `handoff` kind is EXCLUDED: it carries
 *  no decision word (it renders the pipeline entry ref/literal, never a branch label).
 *  The skill-anatomy contract's `edgeConditionWords` derives from this tuple — the
 *  runtime Route lexicon is the ONE source, never a second hand-written list. */
export const ROUTE_DECISION_WORDS = ["done", "next-wave", "review", "fix", "soft-cap"] as const;

// ---------------------------------------------------------------------------
// the face indirection line — the pipeline's face-to-face `done` routing table (D33)
// ---------------------------------------------------------------------------

/** The doc-class keys of the unified next face — DERIVED from the target vocabulary:
 *  EVERY declared target class is a pipeline key. A closed standalone `single-spec`
 *  hands off to `cdd-plan` exactly as a closed `phase-spec` does (the spec face's
 *  chain continues); the only program-level terminal is the charter (`overall`). */
export type PipelineKey = TargetType;

/** One pipeline-next row — the skill ref to dispatch (`ref`), a literal command
 *  (`literal`, the wave→branch transition — the wiring literal with its `<plan>`
 *  slot), or the pipeline terminal (`done`). */
export type PipelineEntry =
  | { kind: "ref"; ref: string }
  | { kind: "literal"; literal: string }
  | { kind: "done" };

/** The pipeline next table — the ONE face-indirection source (D33 · single-addressed
 *  at session/next.ts), keyed by the SAME TargetType the CLI declares: the target
 *  type → the next pipeline entrypoint. The ONE program-level terminal row is
 *  `overall` — nothing follows a closed charter line; a closed `single-spec` is a
 *  spec line like any other, so it hands off to `cdd-plan`. The skill refs ride REFS
 *  (face/host.ts) resolved per host at the render — never a hard-coded plugin
 *  spelling; the wave literal's `<plan>` slot is filled by the capsule with the
 *  frame's plan fact. */
export const PIPELINE_NEXT: Readonly<Record<TargetType, PipelineEntry>> = {
  "phase-spec": { kind: "ref", ref: "kairos:cdd-plan" },
  overall: { kind: "done" },
  plan: { kind: "ref", ref: "kairos:cdd-dev" },
  "single-spec": { kind: "ref", ref: "kairos:cdd-plan" },
  wave: { kind: "literal", literal: "review --type branch --plan <plan>" },
  branch: { kind: "ref", ref: "kairos:cdd-close" },
};

/** The pipeline's phase-level face keys (D40) — `PipelineKey` minus the two
 *  program-level rows (the charter's closure is the pipeline terminus, rendered by the
 *  capsule never walked; the standalone `single-spec` is a spec line whose handoff
 *  target lives in the table, not a face of the traversal). */
export type PhaseFaceKey = Exclude<PipelineKey, "overall" | "single-spec">;

/** The pipeline's phase-level face order (D40) — the face-to-face traversal
 *  `spec → plan → wave → branch`, the ONE order declaration: the session plane's
 *  `PipelineFrontier` iterates it, so a consumer maps key → facts and declares NO
 *  order of its own. */
export const PIPELINE_FACES: readonly PhaseFaceKey[] = ["phase-spec", "plan", "wave", "branch"];

/** One pipeline face's OBSERVED state — the per-face facts a consumer reads off
 *  disk and the ledger (never a judgment): whether the face is closed, its ACTIVE
 *  C5 hop (null when the face never started), and the render target the literal
 *  needs. The session plane's `PipelineFrontier` is the ONE decider over these
 *  observations — the board reports facts, the frontier resolves the next step. */
export interface PipelineFaceState {
  /** Whether the face's line is closed (its latest C5 route lies on the closure
   *  side) — a face with no wave set at all (an empty wave segment) is NOT closed
   *  (nothing was closed), so it stays the frontier and hands off. */
  closed: boolean;
  /** The face's active C5 hop — null when the face holds no open hop (not started). */
  active: Route | null;
  /** The face's render target (the literal's type + id + plan), or null when absent. */
  target: RouteTarget | null;
}

/** The walk's verdict — the ONE next Route + the render target it belongs to (the
 *  frontier face's own target; the last face's on the all-closed terminal). */
export interface PipelineNext {
  route: Route;
  target: RouteTarget | null;
}

/** The next hop's face-internal verb — the four dispatch verbs a line can hop to
 *  (`branch-review` keeps the existing `ReviewLead` spelling, §5.2's naming rule). */
export type Hop = "implement" | "review" | "branch-review" | "fix";

/** The doc-class verdict of a render target — the pipeline key a closed face hands
 *  off to, or one of the two the pipeline cannot route (`blocked` = the declaration
 *  is missing · `terminal` = no target at all). */
export type DocClassVerdict = PipelineKey | "blocked" | "terminal";

/** The reason table's leg partition (§2.5) — the pre-flight structure gates, the
 *  line's own refusals, and the station signs a `next:` hop is named by. NOT the
 *  dispatch verdict's leg (`structure | upstream | line`): that is a different axis,
 *  so the table holds no `upstream` row — an upstream refusal reuses a line/station
 *  token and names its leg on the verdict, never in this table. */
export type DispatchReasonLeg = "structure" | "line" | "station";

/** One reason row — the token's ONE spelling and the leg it is partitioned into. */
export interface DispatchReasonRow {
  readonly token: string;
  readonly leg: DispatchReasonLeg;
}

/** The single reason table (§2.5) — every refusal row and every `NextHop.reason`
 *  value names a fact by ONE spelling from here (a hyphenated fact name, never a
 *  sentence). The structure rows reuse the pre-flight gate ids as their tokens (no
 *  newly minted token); the line rows are the wave gate's five plus the doc/branch
 *  refusals (including the same-revision `unchanged` row); the station rows are the
 *  signs a `next:` hop is named by. */
export const DISPATCH_REASON = {
  // structure — the pre-flight gate ids, reused as tokens
  treeClean: { token: "tree-clean", leg: "structure" },
  inFlight: { token: "in-flight", leg: "structure" },
  graph: { token: "graph", leg: "structure" },
  planLedger: { token: "plan-ledger", leg: "structure" },
  docContract: { token: "doc-contract", leg: "structure" },
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
  /** A wave line's TASK-ONLY projection moved past the one its review bound. */
  briefDrift: { token: "brief-drift", leg: "station" },
  /** A document's revision moved past the one its review bound. */
  docDrift: { token: "doc-drift", leg: "station" },
  softCap: { token: "soft-cap", leg: "station" },
  taskOpen: { token: "task-open", leg: "station" },
  docClassBlocked: { token: "doc-class-blocked", leg: "station" },
} as const satisfies Record<string, DispatchReasonRow>;

/** Every token the table declares — the one domain a refusal reason is drawn from. */
export type DispatchReason = (typeof DISPATCH_REASON)[keyof typeof DISPATCH_REASON]["token"];

/** The wave gate's five rows — the table's `leg: "line"` wave rows as a typed view
 *  (the token spellings live in the table ONLY; `wave.ts` carries no second copy). */
export const WAVE_GATE_REASON = {
  mixedBatch: DISPATCH_REASON.mixedBatch.token,
  waveTooWide: DISPATCH_REASON.waveTooWide.token,
  tooManyTasks: DISPATCH_REASON.tooManyTasks.token,
  split: DISPATCH_REASON.split.token,
  wrongPhase: DISPATCH_REASON.wrongPhase.token,
} as const;

/** The wave gate's refusal rows — the five-token view of the shared table. */
export type WaveGateReason = (typeof WAVE_GATE_REASON)[keyof typeof WAVE_GATE_REASON];

/** The named accessors for `NextHop.reason` — every value is the table's own token
 *  (one spelling source; the hop reason domain spans both the line and station legs).
 *  `briefDrift` and `docDrift` are TWO facts, never one: a wave brief's task-only
 *  projection vs a document's revision (§2.3), so a reader never has to guess which
 *  identity moved from the token alone. */
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

/** One line's next hop (§5.2) — the ONE object every read face renders.
 *
 *  `route` is the render PAYLOAD, never a second judgment: the `next:` literal renders
 *  from this Route through `face/route-render.ts` (`next-wave`'s `--tasks` and `fix`'s
 *  `--reviews` ride it), so the payload is never copied into `hop`. `hop` and `to` are
 *  mutually exclusive (the face-internal hop vs the face-to-face handoff) — the two
 *  axes are never flattened. `target` is the ONE cell the station lookup and the
 *  renderer both read (the declaration read and the plan/type/id literal).
 *
 *  `face` / `target` / `route` are nullable: the failure face (BLOCKED / TIMEOUT ⇒
 *  `next` returns null) and the doc-class `terminal` row hold no route. */
export interface NextHop {
  /** The face axis — the pipeline key of the line (null = no registered line). */
  readonly face: PipelineKey | null;
  /** The render target — the frame's own type / id / plan facts. */
  readonly target: RouteTarget | null;
  /** The line axis — the face-internal next verb (null = no in-line hop). */
  readonly hop: Hop | null;
  /** The pipeline axis — the face-to-face handoff station (null = none). */
  readonly to: PipelineEntry | null;
  /** The named fact that selected this hop — one token of the ONE table (§2.5), so
   *  a dispatch refusal can carry it as its verdict's `reason` without a re-typing. */
  readonly reason: DispatchReason;
  /** The render payload — the count table's own Route (null = no route). */
  readonly route: Route | null;
}

/** One next-hop derivation's input face (§5.2) — the line's OWN facts, filled by the
 *  ONE assembly entry (`Ledger#nextHopOf`: the drift gate + the injected doc-class
 *  discrimination) and read by the derivation, never re-judged. `route` is the count
 *  table's product (`NextStepRouter.next`). The face axis is NOT an input cell: the
 *  `verdict` below is the single judgment, and the face is read out of it — so no read
 *  face re-assembles `verdict → face` and the declaration read happens once per
 *  derivation. */
export interface NextHopInput {
  /** The line's render target (null = the face was never entered / a bare terminal). */
  readonly target: RouteTarget | null;
  /** The drift-aware gate's TWO verdict cells, kept apart on purpose (§2.3):
   *  `docDrift` = a DOCUMENT moved past the revision its review bound (`reviewGate`
   *  → open, so a closed doc line reopens); `briefDrift` = a WAVE's task-only brief
   *  projection moved past the one its review bound. Only `docDrift` SUBSTITUTES a
   *  route (the doc lines' exit-side routes); the brief cell names the reason alone,
   *  the route staying the caller's. Neither boolean may ever stand in for the other:
   *  the two movements call for different re-reviews, so they name different tokens. */
  readonly gate: { readonly docDrift: boolean; readonly briefDrift: boolean };
  /** The count table's route for the line (null = the failure face). */
  readonly route: Route | null;
  /** The doc-class discrimination's own verdict on the `target` cell — the ONE
   *  judgment the face axis and the station rows read (`blocked` / `terminal` carry no
   *  face, every pipeline key is its own face). */
  readonly verdict: DocClassVerdict;
  /** The NEXT pipeline line's dispatchable-open fact — the wave line's closure is the
   *  only reader (P21 §4.2): `false` lands the wave station on the branch face's own
   *  exit instead of the branch-review literal its own gate would refuse. An INPUT
   *  cell of the derivation (the ledger-holding side computes it), never a render-side
   *  parameter — the retired `resolve` patch argument's fact, kept without the patch. */
  readonly nextLineOpen?: boolean;
}

/** The review-cycle soft-cap suggestion (the C5-0 suggestion face — user adjudicates). */
export const SOFT_CAP_SUGGESTION = "BLOCKED: review-cycle-cap — user adjudicates";

/** The fix-route readback suffix — appended verbatim to the fix findings path on the
 *  route's `next:` render (`(confirm the reviews handoff · if a finding needs a
 *  ruling, record the ruling in the handoff file)`), a pure wording prompt: the
 *  anti-blind-fix mechanical guard is the ledger round / C5-1, the suffix only
 *  reminds the orchestrator to confirm the captured findings and, when a finding
 *  needs a user ruling, record that ruling back into the reviews handoff the fix
 *  round consumes. `annotate` names the carrier action alone — distinct from
 *  `backfill` (a durable fact landed into its owning doc), which stays the
 *  ruling's destination when it asserts a project-level fact. */
export const FIX_READBACK_SUFFIX =
  "(confirm the reviews handoff · if a finding needs a ruling, record the ruling in the handoff file)";

/** The failure face — a BLOCKED/TIMEOUT round goes the stderr CDD_BLOCKED channel and
 *  produces no `next:` line on any op. Exported as the ONE failure-status set: the
 *  skill-anatomy contract's `edgeConditionWords` derivation reads it to exclude the
 *  failure statuses from the decision-edge status words (a failure round carries no
 *  closure edge — the reason rides the CDD_BLOCKED channel). */
export const FAILED_STATUS = new Set(["BLOCKED", "TIMEOUT"]);

/**
 * NextStepRouter — the C5 decision table as one instance method. The router keeps
 * no hidden state: every judgment reads the execution state + the round carrier.
 */
export class NextStepRouter {
  /** next(state, ref) — the C5 derivation: the next-hop Route, or null when the round
   *  produces no next line (the BLOCKED/TIMEOUT failure-mode face). */
  next(state: ExecutionState, ref: Round): Route | null {
    // The failure face first — a BLOCKED/TIMEOUT round never gets a next suggestion.
    if (ref.status !== undefined && FAILED_STATUS.has(ref.status)) return null;

    switch (ref.phase) {
      case "implement":
        // The implement round completes → the group's review is the next hop. A
        // review judges the live tree, so the hop carries no commit identity.
        return { kind: "review" };
      case "review":
        // One-way: any findings (any severity) → the fix round — a review never previews
        // what the fix will do (C5-1). Zero findings (approved) → the unified closure: the
        // ready batch decides whether the next wave continues or the run is exhausted.
        if (ref.findings.length > 0) return { kind: "fix", reviews: ref.reviewsPath };
        return this.#close(state);
      case "fix": {
        // C5-1: the fix face is the re-review / closure decision point. The soft cap
        // outranks the blocker row — a capped run defers to the user, never auto-loops.
        if (ref.consecutiveS1 >= REVIEW_CYCLE_CAP) {
          return { kind: "soft-cap", message: SOFT_CAP_SUGGESTION };
        }
        if (this.#blockerCount(ref) > 0) {
          // Blockers remain in the input findings → the fix delta is re-reviewed. A
          // review judges the live tree, so the hop carries no commit identity.
          return { kind: "review" };
        }
        // No blockers → the unified closure: the ready batch decides next-wave | done
        // (a warn/nit-only fix closes — the #278 REVIEW_FIX state, no re-review preview).
        return this.#close(state);
      }
      case "branch-review":
        // The branch terminal face — findings route the fix; zero findings close the line
        // through the same unified closure terminal.
        return ref.findings.length > 0
          ? { kind: "fix", reviews: ref.reviewsPath }
          : this.#close(state);
    }
  }

  /** The unified closure terminal (v1.20) — the single way a review/fix closure renders
   *  its next hop: the ready batch decides `next-wave` vs `done` (a closing review with
   *  another wave ready continues the run; an exhausted run reports `done`). */
  #close(state: ExecutionState): Route {
    const ready = state.readyBatch();
    return ready.length > 0 ? { kind: "next-wave", tasks: ready.join(",") } : { kind: "done" };
  }

  /** The blocker count of the round's findings — the C5-1 severity count. */
  #blockerCount(ref: Round): number {
    return ref.findings.filter((finding) => finding.severity === "blocker").length;
  }

  // ---------------------------------------------------------------------------
  // the ONE next-hop derivation (§5.2) — a presentation read of the count table
  // ---------------------------------------------------------------------------

  /** hopOf(route, face) — the ONE constant Route → Hop mapping. It reads the face
   *  because a `review` route carries NO face of its own: the branch face's review is
   *  the `branch-review` skill, every other face's is `review`. `done` / `handoff` /
   *  `soft-cap` are not hops — they close the line (the count table's judgment). */
  hopOf(route: Route, face: PipelineKey | null): Hop | null {
    switch (route.kind) {
      case "next-wave":
        return "implement";
      case "review":
        return face === "branch" ? "branch-review" : "review";
      case "fix":
        return "fix";
      case "soft-cap":
      case "done":
      case "handoff":
        return null;
    }
  }

  /** nextHop(input) — the ONE derivation of a line's next hop (§5.2), once per call
   *  and per line (never cached, never shared across calls).
   *
   *  The judgment stays the count table's: `hop` is READ OUT of the route the table
   *  produced (`hopOf`), never re-derived here, and `reason` names the fact that
   *  selected it (§5.1: any second criterion is the regression the phase names). The
   *  face axis is read out of the ONE verdict (`#faceOf`), so the three read faces
   *  fill facts and never re-assemble the chain. `to` follows the same path for
   *  `done` and `handoff`; the doc-class discrimination is injected at the assembly
   *  entry, so this module never imports a face class. */
  nextHop(input: NextHopInput): NextHop {
    const route = input.route;
    const verdict = input.verdict;
    const face = NextStepRouter.#faceOf(verdict);
    return {
      face,
      target: input.target,
      // No route (the failure face) is no hop; otherwise `hopOf` is the ONE answer to
      // "which route kinds are hops" — the closure kinds are not enumerated twice.
      hop: route === null ? null : this.hopOf(route, face),
      to: this.#entryOf(input, route, verdict),
      reason: this.#reasonOf(input, route, verdict),
      route,
    };
  }

  /** message(hop, station) — the ONE rejection-message shape (§5.2): a hop names the
   *  verb, a closed face names its handoff station (`station` renders the entry through
   *  the shared route renderer), and neither renders the bare reason — no invented
   *  verb slot. */
  message(hop: NextHop, station: (entry: PipelineEntry) => string): string {
    if (hop.hop !== null) return `${hop.reason} · the next round is ${hop.hop}`;
    if (hop.to !== null) return `${hop.reason} · next: ${station(hop.to)}`;
    return hop.reason;
  }

  /** The face axis of one verdict — the ONE `verdict → face` assembly (§5.2): the two
   *  unroutable classes carry no face, every pipeline key is its own face. */
  static #faceOf(verdict: DocClassVerdict): PipelineKey | null {
    return verdict === "blocked" || verdict === "terminal" ? null : verdict;
  }

  /** The pipeline station of a closure route — `handoff` carries its own entry, `done`
   *  derives it from the doc class (`PIPELINE_NEXT` is data, never a judgment), and a
   *  `blocked` / `terminal` class (or no route at all) has no station. The wave face is
   *  the ONE class whose row depends on the NEXT line (P21 §4.2): a closed branch line
   *  hands the wave line to the branch face's own exit, not a literal its gate refuses. */
  #entryOf(
    input: NextHopInput,
    route: Route | null,
    verdict: DocClassVerdict,
  ): PipelineEntry | null {
    if (route === null) return null;
    if (route.kind === "handoff") return route.entry;
    if (route.kind !== "done") return null;
    if (verdict === "blocked" || verdict === "terminal") return null;
    if (verdict === "wave" && input.nextLineOpen === false) return PIPELINE_NEXT.branch;
    return PIPELINE_NEXT[verdict];
  }

  /** The named fact behind the hop — one `NEXT_HOP_REASON` row, in this order: the
   *  soft cap · a pending fix · a drift-reopened line (its reviewed identity moved —
   *  the wave brief's task-only projection, or a document's revision) · an open line
   *  advancing · an unjudgeable doc class · a closed face · the closed line's handoff.
   *  Drift never outranks a pending fix (an unclosed line's blocker keeps the fix hop),
   *  and the two drift kinds never share a token: the wave brief's movement is
   *  `brief-drift`, a document revision's is `doc-drift` (§2.3). */
  #reasonOf(input: NextHopInput, route: Route | null, verdict: DocClassVerdict): DispatchReason {
    if (route?.kind === "soft-cap") return NEXT_HOP_REASON.softCap;
    if (route?.kind === "fix") return NEXT_HOP_REASON.pendingFix;
    if (route?.kind === "review" && input.gate.briefDrift) return NEXT_HOP_REASON.briefDrift;
    if (route?.kind === "review" && input.gate.docDrift) return NEXT_HOP_REASON.docDrift;
    if (route !== null && this.hopOf(route, NextStepRouter.#faceOf(verdict)) !== null)
      return NEXT_HOP_REASON.taskOpen;
    if (verdict === "blocked") return NEXT_HOP_REASON.docClassBlocked;
    if (route === null || verdict === "terminal") return NEXT_HOP_REASON.faceClosed;
    return NEXT_HOP_REASON.closedLine;
  }

  /** The face-to-face handoff route for a pipeline doc-class (D40) — the next-face
   *  entry (`PIPELINE_NEXT[key]`). One of the two ways the ONE "next step" concept
   *  is produced (the C5 hop is the other), so a consumer never consults a second
   *  table. */
  static handoff(key: PipelineKey): Route {
    return { kind: "handoff", entry: PIPELINE_NEXT[key] };
  }
}
