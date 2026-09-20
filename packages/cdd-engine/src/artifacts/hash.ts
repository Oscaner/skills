// packages/cdd-engine/src/artifacts/hash.ts — content-state token single point (P6 T24 C:
// hashFile re-homed from dispatch/review-loop.ts). A content-state token is an artifacts-layer
// fact, not a dispatch concern — the move also removes the cli→dispatch reverse dependency the
// old location forced on hash consumers (cli/review.ts imported dispatch/review-loop only for this).
//
// Full-byte sha256 hex of the reviewed document (§2.1/§2.3.1). Scale choice (§2.2 bullet 1): no
// normalization — whitespace / line-ending drift opens one new review round; a single review
// dispatch per round is a benign cost.
// Missing/unreadable → "" sentinel (never equal to a real hex): the gate passes on "ref
// changed" and the downstream runner fails naturally on the ghost doc.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export function hashFile(doc: string): string {
  try {
    return createHash("sha256").update(readFileSync(doc)).digest("hex");
  } catch {
    return "";
  }
}