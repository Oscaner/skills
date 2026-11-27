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
// Invariant: the hash is a pure function of the bytes read and the recorded basis — the
// same text twice on the same basis is the same identity, and a changed text is never a
// `same`. A round with no record lands no judgment at all (`driftOf` answers null), because
// only present facts land: absence is the legacy closed face, never a fabricated drift.
//
// The recorded cell is FROZEN, so its algorithm is the contract, not this tree's taste: the
// engine that shipped before this tree digested with sha1 and every consumer workspace
// holds 40-hex cells, while a cell this tree may meet is 64 hex. The basis is therefore read
// off the cell — its hex width — and one fold in this file answers it for the writer and the
// reader alike. Comparing a recorded digest against a digest of another basis would answer
// `drift` for every version the shipped engine reviewed.

import { createHash } from "node:crypto";

/** The two inputs a round can review — a document's body or a wave's task-only brief. */
export type ReviewedKind = "document" | "brief";

/** The declared kinds, in the order a refusal names them — the runtime companion. */
export const REVIEWED_KINDS = ["document", "brief"] as const satisfies readonly ReviewedKind[];

/** The digest bases a recorded revision cell may carry. A digest's basis is its ALGORITHM,
 *  never a preference: it is read off the cell's hex width, so a cell recorded by another
 *  engine still compares. */
export type DigestBasis = "sha1" | "sha256";

/** The basis a NEW record is written on — the frozen cell's own, so the engine that shipped
 *  before this tree compares this tree's records against its own digest of the same bytes. */
export const RECORDED_BASIS: DigestBasis = "sha1";

/** The recorded digest shapes, one entry per basis — the ONE table both the classification
 *  and the constructor's validation read, so a cell is never accepted on one basis and
 *  classified on another. */
const DIGEST_HEX: readonly (readonly [DigestBasis, RegExp])[] = [
  ["sha1", /^[0-9a-f]{40}$/],
  ["sha256", /^[0-9a-f]{64}$/],
];

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
 * ReviewedIdentity — the version a round reviewed. Invariant: the hash is derived from the
 * bytes alone on the record's own basis, so two records of the same text are the same
 * identity and a changed text can never compare equal.
 */
export class ReviewedIdentity {
  readonly kind: ReviewedKind;
  readonly path: string;
  readonly hash: string;
  /** The digest's own algorithm, read off the recorded hex's width. */
  readonly basis: DigestBasis;

  constructor(facts: ReviewedFacts) {
    if (!REVIEWED_KINDS.includes(facts.kind)) {
      throw new Error(`ReviewedIdentity: "${String(facts.kind)}" is not a reviewed input kind`);
    }
    if (facts.path.trim().length === 0) {
      throw new Error("ReviewedIdentity: a reviewed version names no input path");
    }
    const basis = ReviewedIdentity.basisOf(facts.hash);
    if (basis === null) {
      throw new Error(`ReviewedIdentity: "${facts.hash}" is not a recorded digest`);
    }
    this.kind = facts.kind;
    this.path = facts.path;
    this.hash = facts.hash;
    this.basis = basis;
  }

  /** The digest's basis, read off the cell's width — null when the cell is not a digest this
   *  read can compare (a placeholder, a truncated prefix, a non-hex value). */
  static basisOf(hash: string): DigestBasis | null {
    return DIGEST_HEX.find(([, shape]) => shape.test(hash))?.[0] ?? null;
  }

  /** Record one input's identity from the bytes this round read — on the frozen cell's basis,
   *  which is what a record written by this tree must carry. */
  static record(kind: ReviewedKind, path: string, content: string): ReviewedIdentity {
    return new ReviewedIdentity({ kind, path, hash: ReviewedIdentity.hashOf(content) });
  }

  /** The ONE content digest per basis — the same text answers the same hash on both sides of
   *  the comparison, and a recorded cell is digested on its OWN basis. */
  static hashOf(content: string, basis: DigestBasis = RECORDED_BASIS): string {
    return createHash(basis).update(content, "utf8").digest("hex");
  }

  /** Whether two records describe the same version of the same input. A different kind, a
   *  different path or a different basis is a drift even when the digests read alike: the
   *  identity is the whole triple, never the hash alone. */
  sameAs(other: ReviewedIdentity): boolean {
    return (
      this.kind === other.kind &&
      this.path === other.path &&
      this.basis === other.basis &&
      this.hash === other.hash
    );
  }

  /** Judge this record against the input's CURRENT bytes — `same` when the version has
   *  not moved, `drift` when it has. The current bytes are digested on the recorded basis:
   *  a sha1 cell is compared against a sha1, never against a digest of another shape. */
  driftFrom(content: string): Drift {
    return this.hash === ReviewedIdentity.hashOf(content, this.basis) ? "same" : "drift";
  }
}
