// packages/cdd-engine/src/run/index.ts
// `run/` — one phase's run, and its entry.
//
// INVARIANT (the slice's one sentence, from the phase spec): facts first, and every
// advance is derived from them — what the ledger records is the only thing `next:` can be,
// and at any instant the tree holds at most one round in flight and at most one refusal.
//
// Four segments carry that invariant, each with its own:
//   ledger/   — the facts and the identity: a round's coordinate, the wave lines, the
//               document review lines, the branch line, the version a round reviewed, the
//               artifact identities, the rulings and re-grades. Its sentence: one fact,
//               one home — one record written from one place.
//   gate/     — refusal and authorization: the one closed gate row set (the structural
//               legs and the four pre-dispatch stations), the tree-level refusal fact with
//               its two expiry triggers, and the takeover's three legs. Its sentence: a
//               refusal is a fact about the TREE, never about a round, and at most one
//               stands at a time.
//   dispatch/ — the child: its input contract, the handoff read-back, the budget, the
//               in-flight record (zero records before the child exists; no residue after).
//               Lands in a later wave.
//   advance/  — the frontier and `next:`: the pipeline and wave frontiers, the closure
//               judgment, the `next:` / `reason:` assembly (the frontier is the ledger's
//               projection, never a second judgment). Lands in a later wave.
//
// `run/index.ts` is the slice's ONE entrance. This wave exposes the fact layer's READ face
// and the gate the round machinery consults before a child exists; the round verbs and the
// frontier arrive with their own segments. The class knows no path spelling (`env/`), no
// markdown (`docs/`) and no byte (`surface/`): the gate and the refusal record arrive
// CONSTRUCTED by the composition root, so this file composes nothing and spells nothing.

import type { PreFlight } from "./gate/preflight.ts";
import type { Refusal, RefusalState } from "./gate/refusal.ts";
import type { ArtifactObservation } from "./ledger/ledger.ts";
import {
  type BranchLine,
  type CrashedRound,
  type DocLine,
  Ledger,
  type LedgerDocument,
  type LedgerOptions,
  type RoundRecord,
  type WaveLine,
} from "./ledger/ledger.ts";
import type { Drift, ReviewedIdentity } from "./ledger/reviewed.ts";
import type { Rulings } from "./ledger/rulings.ts";

export type { Takeover, TakeoverAnswer } from "./gate/authority.ts";
export { Authority } from "./gate/authority.ts";
export {
  type CheckedReading,
  type CheckedRow,
  type DispatchRowReading,
  type DocJudgment,
  type InFlightReading,
  type InFlightWord,
  type PlanLedgerTarget,
  PRE_FLIGHT_GATE_NAMES,
  PRE_FLIGHT_REASONS,
  PreFlight,
  type PreFlightContext,
  type PreFlightGateName,
  type PreFlightOptions,
  type PreFlightReason,
  type PreFlightVerdict,
  ROW_STATIONS,
  type RowStation,
  type SkipReason,
  STRUCTURE_ROWS,
  type StructureRow,
  type TreeRead,
} from "./gate/preflight.ts";
export {
  Refusal,
  type RefusalBody,
  type RefusalFacts,
  type RefusalPublish,
  type RefusalState,
} from "./gate/refusal.ts";
export type {
  ArtifactObservation,
  BranchLine,
  CrashedRound,
  DocLine,
  Drift,
  LedgerDocument,
  ReviewedIdentity,
  RoundRecord,
  Rulings,
  WaveLine,
};

/** The fact layer's READ half — what a renderer or a gate may ask. The write half
 *  (recording a round, closing a wave, recording a ruling) belongs to the round machinery
 *  that lands with the dispatch segment, so this type is the boundary that keeps a reader
 *  from writing. */
export type FactReads = Pick<
  Ledger,
  | "read"
  | "rounds"
  | "nodeRecordsOf"
  | "crashedOf"
  | "waveLines"
  | "docLines"
  | "branchLine"
  | "planTasksOf"
  | "reviewedOf"
  | "docHashOf"
  | "docDriftOf"
  | "rulingsOf"
  | "carrierPathOf"
  | "observedArtifacts"
  | "orphanHandoffs"
>;

/** `Run`'s construction facts — the workspace every fact lands in, the workspace listing the
 *  orphan judgment scans, the artifact index when the caller wired one, and the two objects
 *  the composition root builds for the gate (the gate itself and the tree-level refusal
 *  record, which the release point clears through the same instance). */
export interface RunOptions extends LedgerOptions {
  /** The work tree's gate. */
  readonly gate: PreFlight;
  /** The tree's one refusal record — the same instance the gate writes. */
  readonly refusal: Refusal;
}

/**
 * Run — one phase's run. Invariant: facts first, and every advance is derived from them
 * (see the file's header). This wave's surface is the fact layer's read face plus the gate
 * the round machinery consults; the round verbs arrive with the segments that own them.
 */
export class Run {
  /** The fact layer's read face. */
  readonly facts: FactReads;

  /** The work tree's gate. */
  readonly gate: PreFlight;

  readonly #ledger: Ledger;
  readonly #refusal: Refusal;

  constructor(opts: RunOptions) {
    this.#ledger = new Ledger(opts);
    this.#refusal = opts.refusal;
    this.facts = this.#ledger;
    this.gate = opts.gate;
  }

  /** The tree's refusal as THIS workspace sees it — the phase's own standing refusal, or
   *  `absent` when another slug's record stands (that one is the other phase's fact). The
   *  unfiltered read (`Refusal#readRaw`) belongs to the release point, which clears the
   *  tree's fact rather than one workspace's view of it. */
  refusalOf(slug: string): RefusalState {
    return this.#refusal.read(slug);
  }
}
