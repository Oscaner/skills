// packages/cdd-engine/src/run/ledger/reviewed.ts
// Which version of its input a round reviewed.
//
// A review round concludes about bytes; the line it concluded about reopens when those
// bytes move. That requires one recorded fact — the identity of the version this round
// read — and one comparison against what the input holds now. Both live here: the record
// is a value (kind · path · hash), and the read face answers `same` / `drift` / no fact.
//
// Two kinds, one class: a document line reviews a DOCUMENT (its body text), a wave line
// reviews its task-only BRIEF projection. The kind rides the record because a wave line
// and a document line answer different questions about different inputs — a `brief`
// recorded where a `document` is judged is a drift, never a match.
//
// Invariant: the hash is a pure function of the bytes read — the same text twice is the
// same identity, and a changed text is never a `same`. A round with no record lands no
// judgment at all (`driftOf` answers null), because only present facts land: absence is
// the legacy closed face, never a fabricated drift.

import { createHash } from "node:crypto";

/** The two inputs a round can review — a document's body or a wave's task-only brief. */
export type ReviewedKind = "document" | "brief";

/** The declared kinds, in the order a refusal names them — the runtime companion. */
export const REVIEWED_KINDS = ["document", "brief"] as const satisfies readonly ReviewedKind[];

/** The three-value drift face: `same` · `drift` · no record (null). */
export type Drift = "same" | "drift";

/** One reviewed version — the input's identity as the round read it. */
export interface ReviewedFacts {
  /** Which input the identity describes. */
  readonly kind: ReviewedKind;
  /** The input's path, on the one repo-relative basis. */
  readonly path: string;
  /** The content digest, hex. */
  readonly hash: string;
}

/**
 * ReviewedIdentity — the version a round reviewed. Invariant: the hash is derived from
 * the bytes alone, so two records of the same text are the same identity and a changed
 * text can never compare equal.
 */
export class ReviewedIdentity {
  readonly kind: ReviewedKind;
  readonly path: string;
  readonly hash: string;

  constructor(facts: ReviewedFacts) {
    if (!REVIEWED_KINDS.includes(facts.kind)) {
      throw new Error(`ReviewedIdentity: "${String(facts.kind)}" is not a reviewed input kind`);
    }
    if (facts.path.trim().length === 0) {
      throw new Error("ReviewedIdentity: a reviewed version names no input path");
    }
    if (!/^[0-9a-f]{64}$/.test(facts.hash)) {
      throw new Error(`ReviewedIdentity: "${facts.hash}" is not a sha256 hex digest`);
    }
    this.kind = facts.kind;
    this.path = facts.path;
    this.hash = facts.hash;
  }

  /** Record one input's identity from the bytes this round read. */
  static record(kind: ReviewedKind, path: string, content: string): ReviewedIdentity {
    return new ReviewedIdentity({ kind, path, hash: ReviewedIdentity.hashOf(content) });
  }

  /** The ONE content digest — the same text answers the same hash on both sides of the
   *  comparison. */
  static hashOf(content: string): string {
    return createHash("sha256").update(content, "utf8").digest("hex");
  }

  /** Whether two records describe the same version of the same input. A different kind or
   *  a different path is a drift even when the digests collide: the identity is the whole
   *  triple, never the hash alone. */
  sameAs(other: ReviewedIdentity): boolean {
    return this.kind === other.kind && this.path === other.path && this.hash === other.hash;
  }

  /** Judge this record against the input's CURRENT bytes — `same` when the version has
   *  not moved, `drift` when it has. */
  driftFrom(content: string): Drift {
    return this.hash === ReviewedIdentity.hashOf(content) ? "same" : "drift";
  }
}
