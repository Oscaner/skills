// packages/cdd-engine/src-next/session/reviewed-identity.ts
// P25 — the reviewed-revision write-back judgment's ONE home. Two faces state the
// same write-back: the lifecycle's `#bookkeep` (the record a real run appends) and
// the preview renderer's `#recordsOf` (the `would record:` forecast). Both ask this
// file which reviewed input a completed round binds: the phase whitelist is declared
// here once and the kind → leg mapping is decided here once, so one face can no
// longer drift from the other.
//
// The leg vocabulary is 1:1 with the lifecycle's three write-back methods: `doc` →
// `#recordReviewedDocRevision` (the plan and spec targets share it — the doc path
// rides the frame's target), `brief` → `#recordReviewedWaveBrief` (the RENDERED
// brief, D30), `branch` → `#recordReviewedBranchRevision` (the branch line's plan
// document).
//
// Three same-site facts that are INPUTS, never part of this judgment:
//   1. `targetAction` — the round verdict's completion flag, held by a real run alone;
//      a dry run never has it, so each face applies it on its own side.
//   2. the plan path — the branch leg's identity SOURCE (the record method reads it;
//      the preview states it from the scene). Because that path is an input, the
//      branch target carries a leg name of its own instead of folding into `doc`.
//   3. the wave leg's asymmetry — when the line carries no plan path the real run
//      records nothing while the preview still states the brief leg. Kept as it was:
//      a face-side input difference, not a second judgment.
//
// Zero module-level bare functions — this module is one type, one const and the class.

import type { RoundPhase } from "./ledger.ts";
import type { AuditTarget } from "./run.ts";

/** The three write-back legs — 1:1 with the lifecycle's three `#record…` methods. */
export type ReviewedLeg = "doc" | "brief" | "branch";

/** The phases whose completed round binds a reviewed revision — the whitelist's ONE
 *  declaration: a completed review binds the revision it judged, a completed fix the
 *  revision it produced (so a warn-only fix cannot leave the line adrift in its own
 *  delta), and a branch-review rides the review family. `implement` binds nothing. */
export const REVIEWED_WRITE_PHASES: readonly RoundPhase[] = ["review", "branch-review", "fix"];

/** The reviewed-revision write-back judgment — which leg (if any) one round writes.
 *
 *  A class rather than an arrow-constant object: the repo's zero-bare-function
 *  discipline admits no standalone judgment function, and a static-only class is the
 *  established shape for one pure read face (precedent: `TargetFaceTable`). */
// biome-ignore lint/complexity/noStaticOnlyClass: the judgment's one pure read face — the zero-bare-function discipline admits no standalone judgment function.
export class ReviewedIdentity {
  /** The leg one round binds — null when the phase is outside the whitelist or the
   *  target kind has no write-back. An unlisted kind answers null on BOTH faces: a
   *  target union that ever grows writes nothing, never a silent doc write-back.
   *  Pure: it reads (phase, kind) and nothing else — no ledger, no file, no verdict,
   *  no plan path. */
  static legOf(phase: RoundPhase, kind: AuditTarget["kind"]): ReviewedLeg | null {
    if (!REVIEWED_WRITE_PHASES.includes(phase)) return null;
    if (kind === "wave") return "brief";
    if (kind === "plan" || kind === "spec") return "doc";
    if (kind === "branch") return "branch";
    return null;
  }
}
