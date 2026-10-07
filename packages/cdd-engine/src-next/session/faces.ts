// packages/cdd-engine/src-next/session/faces.ts
// T8 — the target-type faces data table (design spec §3.3: the parameterized single
// lifecycle). The three old near-isomorphic lifecycles (task / branch / docs)
// converge into ONE lifecycle class whose per-type variance lives in this table:
// each target type (task | branch | spec | plan) carries its audit target, the
// product face (the phases it drives + the review-lead round mode) and the next-hop
// consumption semantics. The lifecycle reads the row through the same class — a new
// target type is a table row, never a lifecycle edit.
//
// Module-level exports are types / the table const — zero behavior-carrying bare
// functions (the plan's zero-bare-function discipline).

import type { RoundPhase } from "./ledger.ts";

/** The target types the parameterized lifecycle serves (the CLI `--type` vocabulary). */
export type TargetType = "task" | "branch" | "spec" | "plan";

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
  /** The product face — the phases the type's lifecycle drives and the review-lead
   *  mode its rounds count under. */
  product: {
    /** The line's dispatch phases, in drive order. */
    phases: readonly DispatchPhase[];
    /** The review-lead round mode — the review-family increment whose count the
     *  fix round sources its number from (branch runs branch-review; the others
     *  review). */
    reviewLead: ReviewLead;
  };
  /** The next consumption semantics — how a C5 Route is consumed on this face. */
  nextSemantics: {
    /** Whether a `next-group` route advances the task batch (task only — the
     *  branch/spec/plan lines are single-target with an empty ready batch). */
    batch: boolean;
  };
}

/** The four target-type faces — one row per CLI `--type` value (the single table). */
export const targetFaces: Record<TargetType, TargetFace> = {
  task: {
    type: "task",
    audit: { kind: "task-graph" },
    product: { phases: ["implement", "review", "fix"], reviewLead: "review" },
    nextSemantics: { batch: true },
  },
  branch: {
    type: "branch",
    audit: { kind: "branch-range" },
    product: { phases: ["branch-review", "fix"], reviewLead: "branch-review" },
    nextSemantics: { batch: false },
  },
  spec: {
    type: "spec",
    audit: { kind: "doc-path" },
    product: { phases: ["review", "fix"], reviewLead: "review" },
    nextSemantics: { batch: false },
  },
  plan: {
    type: "plan",
    audit: { kind: "doc-path" },
    product: { phases: ["review", "fix"], reviewLead: "review" },
    nextSemantics: { batch: false },
  },
};
