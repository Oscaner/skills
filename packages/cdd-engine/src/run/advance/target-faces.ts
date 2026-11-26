// packages/cdd-engine/src/run/advance/target-faces.ts
// The target-type table — one row per dispatch target, and the only place a target type's
// behaviour difference is declared.
//
// INVARIANT — a target type's difference lives in a ROW, never in a branch of the
// lifecycle: the audit target (how the open item resolves), the product face (the
// review-lead round mode the line's rounds count under) and the next-hop consumption
// semantics. A seventh target type is a new row plus its own declaration upstream; the
// lifecycle that reads this table does not change.
//
// The phase ORDER is not a row: opening work → review lead → fix → re-review is the one
// shape every type shares, so a row that tried to declare an order would be the second
// judgment this table exists to prevent.
//
// Module-level exports are types, the one table and its read face — zero behaviour-carrying
// bare functions.

import { TARGET_TYPE_VALUES, type TargetType } from "../../docs/identity/types.ts";
import type { RoundPhase } from "../dispatch/child.ts";

/** The target vocabulary this table keys — re-exported so a reader of `advance/` names the
 *  word set from the table that consumes it, never from a second import site. */
export type { TargetType };

/** The review-lead round mode a line's rounds count under: the branch line counts
 *  `branch-review`, every other line counts `review`. */
export type ReviewLead = "review" | "branch-review";

/** How a face's lifecycle resolves the open item. */
export type AuditFace =
  /** The open item is the task graph's frontier (a whole ready batch — one wave). */
  | { readonly kind: "task-graph" }
  /** The open item is the branch line itself (the live tree — no diff range). */
  | { readonly kind: "branch-tree" }
  /** The open item is the audited document's path. */
  | { readonly kind: "doc-path" };

/** One render target — the frame's own facts (type · id · plan), never a route judgment.
 *  A wave target's id is its task-group key, a doc target's its path, the branch's
 *  `branch`. */
export interface RouteTarget {
  /** The target-type word. */
  readonly type: TargetType;
  /** The target id — the wave key `1,2` · the branch word · the document path. */
  readonly id: string;
  /** The plan path the wave face's implement literal needs; absent off the wave face. */
  readonly plan?: string;
}

/** One target-type row — the lifecycle's whole per-type variance. */
export interface TargetFace {
  /** The target type this row answers. */
  readonly type: TargetType;
  /** How the open dispatch item resolves on this face. */
  readonly audit: AuditFace;
  /** The product face: the review-lead round mode this line counts under. */
  readonly product: { readonly reviewLead: ReviewLead };
  /** How a next hop is consumed on this face. */
  readonly nextSemantics: {
    /** Whether a `next-wave` hop advances a task batch (the wave face alone). */
    readonly batch: boolean;
  };
}

/** THE table — one row per declared target type, and the runtime companion of the type
 *  vocabulary is the key set, so a new type fails to compile here until it has a row. */
export const TARGET_FACES: Readonly<Record<TargetType, TargetFace>> = {
  "phase-spec": {
    type: "phase-spec",
    audit: { kind: "doc-path" },
    product: { reviewLead: "review" },
    nextSemantics: { batch: false },
  },
  overall: {
    type: "overall",
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
  "single-spec": {
    type: "single-spec",
    audit: { kind: "doc-path" },
    product: { reviewLead: "review" },
    nextSemantics: { batch: false },
  },
  wave: {
    type: "wave",
    audit: { kind: "task-graph" },
    product: { reviewLead: "review" },
    nextSemantics: { batch: true },
  },
  branch: {
    type: "branch",
    audit: { kind: "branch-tree" },
    product: { reviewLead: "branch-review" },
    nextSemantics: { batch: false },
  },
};

/**
 * TargetFaces — the table's read face. Invariant: every reader asks THIS class for a row,
 * so no call site re-spells the type set or the review-lead mode.
 */
// biome-ignore lint/complexity/noStaticOnlyClass: the table's one read face — the zero-bare-function discipline admits no standalone lookup.
export class TargetFaces {
  /** One type's row. The vocabulary's own values are the only legal keys. */
  static rowOf(type: TargetType): TargetFace {
    if (!(TARGET_TYPE_VALUES as readonly string[]).includes(type)) {
      throw new Error(`TargetFaces: "${String(type)}" is not a declared target type`);
    }
    return TARGET_FACES[type];
  }

  /** Every row, in the vocabulary's canonical order. */
  static rows(): readonly TargetFace[] {
    return TARGET_TYPE_VALUES.map((type) => TARGET_FACES[type]);
  }

  /** Whether a target type audits a DOCUMENT PATH — the one predicate the lifecycle and the
   *  gate share, derived from the audit cell rather than from a re-typed type set. */
  static isDocShape(type: TargetType): boolean {
    return TargetFaces.rowOf(type).audit.kind === "doc-path";
  }

  /** Whether a target type audits the TASK GRAPH — the row cell the wave gate's
   *  applicability is read off, so no call site re-spells `type === "wave"`. */
  static isTaskGraph(type: TargetType): boolean {
    return TargetFaces.rowOf(type).audit.kind === "task-graph";
  }

  /** Whether a `next-wave` hop advances a task batch on this face — the lifecycle's
   *  wave-close cell and its dispatch record read this, never the type word. */
  static advancesBatch(type: TargetType): boolean {
    return TargetFaces.rowOf(type).nextSemantics.batch;
  }

  /** The review-lead round mode of a type's line. */
  static reviewLeadOf(type: TargetType): ReviewLead {
    return TargetFaces.rowOf(type).product.reviewLead;
  }

  /** The round phase one active hop names on this face — the mode word the fix/review
   *  rounds record under. */
  static phaseOfHop(type: TargetType, hop: "review" | "fix"): RoundPhase {
    return hop === "review" ? TargetFaces.reviewLeadOf(type) : "fix";
  }
}
