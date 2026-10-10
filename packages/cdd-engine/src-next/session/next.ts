// packages/cdd-engine/src-next/session/next.ts
// T7 — NextStepRouter single point (design spec §3.2): the ONLY `next:` generation
// face of the new tree. The C5 decision table (the spec's pinned semantics, v1.20:
// the closure single-verdict — close() is the one closure point every review/fix
// approval shares):
//   review   zero findings  → close(state) — the ready batch decides next-wave | done
//   review   findings       → fix (one-way — a review never previews what a fix will do)
//   fix      blocker>0      → review at a new ref (base = the fix round's head)
//   fix      blocker==0     → close(state) — the warn/nit-only / clean closure (#278,
//                             no APPROVED-mandated re-review)
//   fix      soft cap       → the "BLOCKED: review-cycle-cap" suggestion (user adjudicates)
//   BLOCKED/TIMEOUT         → null (no next line — the CDD_BLOCKED channel owns the face)
//   missing base            → null (only present facts land — a next hop never carries a
//                             synthetic empty base: absent commits degrade the line to null)
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
// the capsule renders verbatim, never a literal restate). Module-level exports are
// types / constants / the class — zero behavior-carrying bare functions (the
// plan's zero-bare-function discipline).

import type { Round } from "./ledger.ts";
import type { ExecutionState } from "./state.ts";

/** The next-hop suggestion — the decision table's output (null = no next line). */
export type Route =
  /** closure — the run is exhausted (`next: done`, the v1.20 terminal word). */
  | { kind: "done" }
  /** closure — another wave is ready: the next dispatch wave's task ids. */
  | { kind: "next-wave"; tasks: string }
  /** re-review at a new ref — base/head = the reviewed range's new span (the round
   *  carrier's commits; the branch re-review literal needs the FULL range — the
   *  runtime gate refuses a --base-only literal). head rides only when the carrier
   *  carries it (only present facts land). */
  | { kind: "review"; base: string; head?: string }
  /** the one-way fix hop — findingsPath = the review handoff the fix reads (`--findings`). */
  | { kind: "fix"; findings?: string }
  /** the review-cycle soft cap — the suggestion defers to user adjudication. */
  | { kind: "soft-cap"; message: string };

/** The review-cycle soft cap — the consecutive-S1 run length at which the fix face
 *  defers the next hop to user adjudication (soft by nature: a default suggestion,
 *  never a hard stop — the user / Plan Sole Writer override it). */
export const REVIEW_CYCLE_CAP = 3;

/** The review-cycle soft-cap suggestion (the C5-0 suggestion face — user adjudicates). */
export const SOFT_CAP_SUGGESTION = "BLOCKED: review-cycle-cap — user adjudicates";

/** The fix-route readback suffix — appended verbatim to the fix findings path on the
 *  route's `next:` render (`(read file back to confirm)`), a pure wording prompt: the
 *  anti-blind-fix mechanical guard is the ledger round / C5-1, the suffix only asks
 *  the orchestrator to read the captured findings handoff back (non-binding). */
export const FIX_READBACK_SUFFIX = "(read file back to confirm)";

/** The failure face — a BLOCKED/TIMEOUT round goes the stderr CDD_BLOCKED channel and
 *  produces no `next:` line on any op. */
const FAILED_STATUS = new Set(["BLOCKED", "TIMEOUT"]);

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
      case "implement": {
        // The implement round completes → the group's review is the next hop (the reviewed
        // range = the implement round's commits). Only present facts land: a missing
        // base never invents a next line (an implement round without commits is abnormal) —
        // an empty base would be indistinguishable from a real one in the rendered next:.
        // The range's terminal (head) rides the carrier when present — the branch
        // re-review literal's `--head` composes only from real facts, never invented.
        const commits = ref.commits;
        if (commits?.base === undefined) return null;
        return commits.head === undefined
          ? { kind: "review", base: commits.base }
          : { kind: "review", base: commits.base, head: commits.head };
      }
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
          // Blockers remain in the input findings → re-review THE FIX'S DELTA: the branch
          // re-review literal needs the FULL range — the runtime missing-refs gate refuses
          // a --base-only literal (`missing required --base <sha> --head <sha>`), so the
          // route composes base (the fix's base — the previously reviewed head the fix
          // built on) + head (the fix's head — the new branch tip): the re-review covers
          // exactly the fix's commits. Only present facts land: a fix carrier missing
          // either leg never invents the re-review.
          const commits = ref.commits;
          if (commits?.base === undefined || commits.head === undefined) return null;
          return { kind: "review", base: commits.base, head: commits.head };
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
}
