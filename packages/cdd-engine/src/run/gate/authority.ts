// packages/cdd-engine/src/run/gate/authority.ts
// The takeover authority — the three legs a `--recover` dispatch may stand on, each with
// its OWN authorization condition.
//
// INVARIANT — no leg is authorized by a fact it does not rest on: leg ① rests on the
// in-flight gate's own pass plus a stale record, while legs ② and ③ rest on the structural
// leg. The difference is deliberate and it is the whole point of this file: a takeover of a
// DEAD HOLDER's record is a fact about the TREE, so a document gate refusing afterwards must
// not cancel it; the reopen (leg ②) and the double-gap BLOCK (leg ③) write the DOCUMENT's
// line, so a refusing structural leg must hold them back.
//
// The three legs, and what each rests on (`face/cli.ts#Cli.#recoverRun` is the behaviour
// this file re-derives):
//   ① the ABORT takeover — a stale in-flight record is taken over and, when it still names
//      the killed round, folded into the ledger. Authorized by the in-flight gate having
//      PASSED (`order` carries the row and it is not the refusing row) AND the record
//      reading out stale. The `--recover` flag is not an input here: it can never cross a
//      live holder, because a live holder makes the gate refuse that row.
//   ② the REOPEN — the drifted line's review round is stamped and re-dispatched. Its own
//      factual preconditions (drift ∧ pending fix ∧ no round in flight) are the ledger's
//      judgment; this file adds the AUTHORIZATION: the structural leg passed.
//   ③ neither — the double-gap BLOCK, which also requires the structural leg to have passed
//      (a structural refusal is the tree's own verdict and the takeover never overrides the
//      first refuser with its own message).
//
// `takeover` composes the three into ONE answer, in that order, so a caller never re-derives
// the ordering at its own call site. The legs may STACK: an abort and a reopen in the same
// dispatch are two actions, one answer.
//
// Module-level exports are types / the class — zero behaviour-carrying bare functions.

import type { PreFlightVerdict } from "./preflight.ts";

/** The takeover flags one dispatch earned — the legs that hold, and whether the dispatch may
 *  proceed. `aborted` and `reopened` may both be true (the legs stack). */
export interface Takeover {
  /** Leg ① — the stale record is taken over (and folded when it names the killed round). */
  readonly aborted: boolean;
  /** Leg ② — the drifted line's review round is reopened. */
  readonly reopened: boolean;
}

/** The takeover answer — the legs, or why no takeover happened. */
export type TakeoverAnswer =
  | ({ readonly kind: "allowed" } & Takeover)
  /** Neither leg holds and the structural leg PASSED — the double-gap BLOCK. */
  | { readonly kind: "blocked" }
  /** The structural leg refused: its verdict rules, and the takeover adds no message. */
  | { readonly kind: "structure" };

/**
 * Authority — the takeover's three legs. Invariant: each leg answers only from the facts it
 * rests on (see the file's header), and `takeover` is the ONE composition of the three.
 */
export class Authority {
  /** Leg ① — the abort takeover. Two facts, both required: the in-flight gate PASSED (the
   *  row ran and is not the refusing row — a dirty tree's refusal stops BEFORE that row, so
   *  a stale record on a dirty tree is never folded) and the record read out stale (a live
   *  holder answers `false`, which is why this leg never crosses "alive"). Neither cell is a
   *  restatement of the other: the row alone cannot say the record is stale, and staleness
   *  alone cannot say the gate judged this tree. */
  abortAllowed(facts: { readonly verdict: PreFlightVerdict; readonly stale: boolean }): boolean {
    if (!facts.stale) return false;
    return facts.verdict.order.includes("in-flight") && facts.verdict.gate !== "in-flight";
  }

  /** Legs ② and ③ — the structural leg passed, so no gate holds this tree back. */
  structureCleared(verdict: PreFlightVerdict): boolean {
    return verdict.ok;
  }

  /** The ONE composition: the legs in priority order (abort, reopen, gap). `reopenRequested`
   *  is the reopen leg's own factual judgment (the ledger's `reviewGate` / `pendingFix` /
   *  occupancy read), handed in so this file judges no ledger fact; the authorization it adds
   *  is the structural leg's pass. */
  takeover(facts: {
    readonly verdict: PreFlightVerdict;
    readonly stale: boolean;
    readonly reopenRequested: boolean;
  }): TakeoverAnswer {
    const aborted = this.abortAllowed(facts);
    const reopened = facts.reopenRequested && this.structureCleared(facts.verdict);
    if (aborted || reopened) return { kind: "allowed", aborted, reopened };
    return this.structureCleared(facts.verdict) ? { kind: "blocked" } : { kind: "structure" };
  }
}
