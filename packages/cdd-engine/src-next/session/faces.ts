// packages/cdd-engine/src-next/session/faces.ts
// T8 — the target-type faces data table (design spec §3.3: the parameterized single
// lifecycle). The three old near-isomorphic lifecycles (task / branch / docs)
// converge into ONE lifecycle class whose per-type variance lives in this table:
// each target type (task | branch | spec | plan) carries its audit target, the
// product face (the review-lead round mode) and the next-hop consumption semantics.
// The lifecycle reads the row through the same class — a new target type is a table
// row, never a lifecycle edit.
//
// Module-level exports are types / the table const — zero behavior-carrying bare
// functions (the plan's zero-bare-function discipline).

import type { RoundPhase } from "./ledger.ts";

/** The target types the parameterized lifecycle serves (the CLI `--type` vocabulary).
 *  `wave` (T26 · the wave-unitary model): the task-graph face whose dispatch unit
 *  is the derived wave — the type name is the UNIT, not the graph's node granularity
 *  (the audit source stays "task-graph" · the plan's task nodes keep the task name). */
export type TargetType = "wave" | "branch" | "spec" | "plan";

/** The dispatch phases a lifecycle drives — the round-carrier phase vocabulary,
 *  single-typed against the ledger's RoundPhase (no second phase union). */
export type DispatchPhase = RoundPhase;

/** The review-lead round modes — the review-family increments whose rounds carry
 *  the fix round's source number. */
export type ReviewLead = "review" | "branch-review";

/** The audit-target descriptor — how a face's lifecycle resolves the open item. */
export type AuditFace =
  /** task: the open item resolves from the TaskGraph frontier (a task id). */
  | { kind: "task-graph" }
  /** branch: the open item is the branch diff range (base..head shas). */
  | { kind: "branch-range" }
  /** spec/plan: the open item is the audit document path. */
  | { kind: "doc-path" };

/** The target identity a dispatch-ready `next:` literal renders (v1.25 · P4.1 T4) —
 *  the frame's OWN facts (verb + target-type + id), never a router judgment: the wave
 *  task key · the branch range token · the doc path. The optional `plan` carries the
 *  plan path the implement literal's required `--plan` fills (the wave/task-face
 *  frame's only implement-consuming fact). */
export interface RouteTarget {
  /** The target-type word of the literal (`wave` / `branch` / `spec` / `plan`). */
  type: TargetType;
  /** The target id — the wave key `"1,2"` · the range `base7..head7` · the doc path. */
  id: string;
  /** The plan path (the implement literal's required `--plan` arg) — present only
   *  on the task face (the doc faces carry their own id path). */
  plan?: string;
}

/**
 * One row of the faces table — the parameterized lifecycle's per-type variance
 * (the design spec §3.3 divergence parameters: audit target / product face / next
 * semantics). The row is data the lifecycle consumes; a fourth target type lands
 * as a new row, never a lifecycle branch.
 */
export interface TargetFace {
  /** The target-type identity (one row per CLI `--type` value). */
  type: TargetType;
  /** The audit target — how the open dispatch item resolves. */
  audit: AuditFace;
  /** The product face — the review-lead round mode the line's rounds count under.
   *  The phase progression itself is the universal three-role shape (opening work →
   *  review lead → fix → re-review) every type shares — the parameterized
   *  lifecycle's variance is the audit descriptor + this mode + the next semantics,
   *  never the phase order (design spec §3.3: the review/fix/implement process is
   *  homogeneous). */
  product: {
    /** The review-lead round mode — the review-family increment whose count the
     *  fix round sources its number from (branch runs branch-review; the others
     *  review). */
    reviewLead: ReviewLead;
  };
  /** The next consumption semantics — how a C5 Route is consumed on this face. */
  nextSemantics: {
    /** Whether a `next-wave` route advances the task batch (task only — the
     *  branch/spec/plan lines are single-target with an empty ready batch). */
    batch: boolean;
  };
}

/** The four target-type faces — one row per CLI `--type` value (the single table). */
export const targetFaces: Record<TargetType, TargetFace> = {
  wave: {
    type: "wave",
    audit: { kind: "task-graph" },
    product: { reviewLead: "review" },
    nextSemantics: { batch: true },
  },
  branch: {
    type: "branch",
    audit: { kind: "branch-range" },
    product: { reviewLead: "branch-review" },
    nextSemantics: { batch: false },
  },
  spec: {
    type: "spec",
    audit: { kind: "doc-path" },
    product: { reviewLead: "review" },
    nextSemantics: { batch: false },
  },
  plan: {
    type: "plan",
    audit: { kind: "doc-path" },
    product: { reviewLead: "review" },
    nextSemantics: { batch: false },
  },
};
