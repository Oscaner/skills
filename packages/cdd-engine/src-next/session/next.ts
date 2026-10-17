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
// so a consumer never consults a second table. `NextStepRouter.resolve` is the ONE
// "one line → next" resolver: an active C5 hop passes through, a drained line yields
// the face-to-face handoff. Both the board (its per-line walk) and the capsule
// (the round's own line) call it — single resolver, single renderer.
//
// Module-level exports are types / constants / the class — zero behavior-carrying
// bare functions (the plan's zero-bare-function discipline).

import type { RouteTarget } from "./faces.ts";
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
  /** the one-way fix hop — findingsPath = the review handoff the fix reads (`--findings`). */
  | { kind: "fix"; findings?: string }
  /** the review-cycle soft cap — the suggestion defers to user adjudication. */
  | { kind: "soft-cap"; message: string }
  /** the face-to-face handoff (D40) — the line's C5 frontier exhausted, so the next
   *  step is the next pipeline face's entry (`PIPELINE_NEXT[doc-class]`): the face
   *  to face transition is ONE Route kind, never a second table a consumer reads. */
  | { kind: "handoff"; entry: PipelineEntry };

/** The review-cycle soft cap — the consecutive-S1 run length at which the fix face
 *  defers the next hop to user adjudication (soft by nature: a default suggestion,
 *  never a hard stop — the user / Plan Sole Writer override it). */
export const REVIEW_CYCLE_CAP = 20;

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

/** The doc-class keys of the unified next face — one row per pipeline seam a face
 *  `done` can land on (the capsule's doc-class lookup reads them). */
export type PipelineKey = "phase-spec" | "overall-spec" | "plan" | "wave" | "branch";

/** One pipeline-next row — the skill ref to dispatch (`ref`), a literal command
 *  (`literal`, the wave→branch transition — the wiring literal with its `<plan>`
 *  slot), or the pipeline terminal (`done`). */
export type PipelineEntry =
  | { kind: "ref"; ref: string }
  | { kind: "literal"; literal: string }
  | { kind: "done" };

/** The pipeline next table — the ONE face-indirection source (D33 · single-addressed
 *  at session/next.ts):
 *  the doc-class key → the next pipeline entrypoint. The skill refs ride REFS
 *  (face/host.ts) resolved per host at the render — never a hard-coded plugin
 *  spelling; the wave literal's `<plan>` slot is filled by the capsule with the
 *  frame's plan fact. */
export const PIPELINE_NEXT: Readonly<Record<PipelineKey, PipelineEntry>> = {
  "phase-spec": { kind: "ref", ref: "kairos:cdd-plan" },
  "overall-spec": { kind: "done" },
  plan: { kind: "ref", ref: "kairos:cdd-dev" },
  wave: { kind: "literal", literal: "review --type branch --plan <plan>" },
  branch: { kind: "ref", ref: "kairos:cdd-close" },
};

/** The pipeline's phase-level face keys (D40) — `PipelineKey` minus the program-level
 *  `overall-spec` (whose closure is the pipeline terminus, rendered by the capsule,
 *  never walked). */
export type PhaseFaceKey = Exclude<PipelineKey, "overall-spec">;

/** The pipeline's phase-level face order (D40) — the face-to-face traversal
 *  `spec → plan → wave → branch`, the ONE order declaration; `NextStepRouter.walk`
 *  iterates it, so a consumer maps key → facts and declares NO order of its own. */
export const PIPELINE_FACES: readonly PhaseFaceKey[] = ["phase-spec", "plan", "wave", "branch"];

/** One pipeline face's OBSERVED state — the per-face facts a consumer reads off
 *  disk and the ledger (never a judgment): whether the face is closed, its ACTIVE
 *  C5 hop (null when the face never started), and the render target the literal
 *  needs. The walk (`NextStepRouter.walk`) is the ONE decider over these
 *  observations — a consumer reports facts, the router resolves the next step. */
export interface PipelineFaceState {
  /** Whether the face's line is closed (its latest C5 route lies on the closure
   *  side) — a face holding no open work (an empty wave segment) is closed. */
  closed: boolean;
  /** The face's active C5 hop — null when the face holds no open hop (not started). */
  active: Route | null;
  /** The face's render target (the literal's type + id + plan), or null when absent. */
  target: RouteTarget | null;
}

/** The consumer's face report — one observation per phase face, keyed by its
 *  `PIPELINE_FACES` key (the order stays the router's; the consumer names faces). */
export type PipelineFaceReport = Readonly<Record<PhaseFaceKey, PipelineFaceState>>;

/** The walk's verdict — the ONE next Route + the render target it belongs to (the
 *  frontier face's own target; the last face's on the all-closed terminal). */
export interface PipelineNext {
  route: Route;
  target: RouteTarget | null;
}

/** The review-cycle soft-cap suggestion (the C5-0 suggestion face — user adjudicates). */
export const SOFT_CAP_SUGGESTION = "BLOCKED: review-cycle-cap — user adjudicates";

/** The fix-route readback suffix — appended verbatim to the fix findings path on the
 *  route's `next:` render (`(confirm the findings · if a finding needs a ruling,
 *  record the ruling in the findings file)`), a pure wording prompt: the
 *  anti-blind-fix mechanical guard is the ledger round / C5-1, the suffix only
 *  reminds the orchestrator to confirm the captured findings and, when a finding
 *  needs a user ruling, record that ruling back into the findings file the fix
 *  round consumes. `annotate` names the carrier action alone — distinct from
 *  `backfill` (a durable fact landed into its owning doc), which stays the
 *  ruling's destination when it asserts a project-level fact. */
export const FIX_READBACK_SUFFIX =
  "(confirm the findings · if a finding needs a ruling, record the ruling in the findings file)";

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
        if (ref.findings.length > 0) return { kind: "fix", findings: ref.findingsPath };
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
          ? { kind: "fix", findings: ref.findingsPath }
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

  /** The face-to-face handoff route for a pipeline doc-class (D40) — the next-face
   *  entry (`PIPELINE_NEXT[key]`). One of the two ways the ONE "next step" concept
   *  is produced (the C5 hop is the other), so a consumer never consults a second
   *  table. */
  static handoff(key: PipelineKey): Route {
    return { kind: "handoff", entry: PIPELINE_NEXT[key] };
  }

  /** Resolve a line's next step (D40) — the capsule's "one line → next" point for the
   *  round's OWN line: an ACTIVE C5 hop (`review` / `fix` / `implement` / `next-wave` /
   *  `soft-cap`) passes through as the line's next step; a drained / not-yet-started
   *  line (the C5 `done` / no active round) yields the face-to-face handoff carrying
   *  the pipeline entry. A null doc-class (no face seam — the overall line / a bare
   *  terminal) renders the bare `done` word. A whole-slug walk is `walk` (the board's
   *  face-to-face traversal); this is the single-line form the capsule holds. Pure. */
  static resolve(active: Route | null, key: PipelineKey | null): Route {
    if (active !== null && active.kind !== "done") return active;
    return key === null ? { kind: "done" } : NextStepRouter.handoff(key);
  }

  /** Walk(face report) → the ONE next step (D40 · the board's face-to-face traversal
   *  as a single router method). The caller REPORTS each face's facts keyed by its
   *  `PIPELINE_FACES` key; the router iterates the ONE order and DECIDES the next step
   *  — so no consumer re-derives the order OR the face-transition rule (the retired
   *  board fork handed off via the frontier LINE's own key, so a slug whose spec just
   *  closed but whose plan was not yet authored rendered `plan`'s exit `cdd-dev`
   *  instead of the spec's exit `cdd-plan` — a face-boundary off-by-one the ONE walk
   *  eliminates). The rule:
   *    · the FRONTIER face (first not-closed) with an active C5 hop → render that hop
   *      (the in-flight work — `review` / `fix` / `implement` / `next-wave`);
   *    · the frontier has no active hop but IS entered (`target` present — an empty
   *      wave segment, a drained-but-reached face) → its OWN pipeline exit entry;
   *    · the frontier is NOT entered (no target — an absent doc, e.g. no plan yet) →
   *      the transition INTO it, i.e. the PRECEDING entered face's exit entry (so a
   *      just-closed spec hands off to the spec's exit `cdd-plan`, never the absent
   *      plan's exit); no preceding entered face → the FIRST face's exit entry;
   *    · every face closed → the LAST entered face's exit entry (the pipeline
   *      terminus — `cdd-close` for a phase slug). */
  static walk(report: PipelineFaceReport): PipelineNext {
    const states = PIPELINE_FACES.map((key) => report[key]);
    const frontierIndex = states.findIndex((face) => !face.closed);
    if (frontierIndex === -1) {
      const terminalIndex = NextStepRouter.#lastEnteredIndex(states);
      const terminal = terminalIndex === -1 ? null : states[terminalIndex]!;
      return terminal === null
        ? { route: { kind: "done" }, target: null }
        : {
            route: NextStepRouter.handoff(PIPELINE_FACES[terminalIndex]!),
            target: terminal.target,
          };
    }
    const frontier = states[frontierIndex]!;
    if (frontier.active !== null) return { route: frontier.active, target: frontier.target };
    const anchorIndex =
      frontier.target !== null
        ? frontierIndex
        : Math.max(0, NextStepRouter.#lastEnteredIndex(states.slice(0, frontierIndex)));
    const anchor = states[anchorIndex]!;
    return {
      route: NextStepRouter.handoff(PIPELINE_FACES[anchorIndex]!),
      target: anchor.target,
    };
  }

  /** The index of the last OBSERVED face carrying a render target — the last face the
   *  pipeline has REACHED (a face with no target was never entered). -1 when none is. */
  static #lastEnteredIndex(states: readonly PipelineFaceState[]): number {
    for (let i = states.length - 1; i >= 0; i--) {
      if (states[i]!.target !== null) return i;
    }
    return -1;
  }
}
