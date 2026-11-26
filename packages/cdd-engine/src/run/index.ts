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
//   gate/     — refusal and authorization (a refusal is a fact about the TREE, never about
//               a round; at most one at a time). Lands in a later wave.
//   dispatch/ — the child: its input contract, the handoff read-back, the budget, the
//               in-flight record (zero records before the child exists; no residue after).
//               Lands in a later wave.
//   advance/  — the frontier and `next:`: the pipeline and wave frontiers, the closure
//               judgment, the `next:` / `reason:` assembly (the frontier is the ledger's
//               projection, never a second judgment). Lands in a later wave.
//
// `run/index.ts` is the slice's ONE entrance, and this wave exposes the fact layer's READ
// face only — the round verbs, the gates and the frontier arrive with their own segments.
// The class knows no path spelling (`env/`), no markdown (`docs/`) and no byte
// (`surface/`); it holds the fact layer and nothing else.

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

/** `Run`'s construction facts — the workspace every fact lands in, the workspace listing
 *  the orphan judgment scans, and the artifact index when the caller wired one. */
export type RunOptions = LedgerOptions;

/**
 * Run — one phase's run. Invariant: facts first, and every advance is derived from them
 * (see the file's header). This wave's surface is the fact layer's read face; the round
 * verbs arrive with the segments that own them.
 */
export class Run {
  /** The fact layer's read face. */
  readonly facts: FactReads;

  readonly #ledger: Ledger;

  constructor(opts: RunOptions) {
    this.#ledger = new Ledger(opts);
    this.facts = this.#ledger;
  }
}
