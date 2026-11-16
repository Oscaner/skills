// packages/cdd-engine/src-next/session/artifact-reads.ts
// P36 T7 — the artifact read SEAM: the ONE composition of the matrix's judgment
// (names · presence · `misplaced` · `absent`) with the strict sidecar schema
// (`CarrierRulings#verdict`). Design spec §2.3 puts the two levels in one function so
// the prompt cell and the dispatch gate read one value; this file is that function's
// home, and it holds NO frame: the workspace arrives with the construction, so the
// frame-holding lifecycle and the frame-free board are two consumers of ONE seam
// instead of two composers.
//
// The seam's other half is the coordinate: a `rulings` sidecar belongs to the REVIEWED
// round, so its identity is always `attribute(basename(carrier))` with `op` fixed to
// `review` — never this dispatch's own `(line, op)`. That second expression would mint
// a name no gate ever sees.
//
// Module-level exports are the value type, the absent value and the class — zero
// behavior-carrying bare functions (the plan's zero-bare-function discipline).

import path from "node:path";
import type { Workspace } from "../infra/workspace.ts";
import { CarrierIntegrity, CarrierMismatchError } from "./carrier-integrity.ts";
import { CarrierRulings, type Ruling } from "./carrier-rulings.ts";
import type { ArtifactRead, ArtifactRegistry, Identity, Kind } from "./round-artifacts.ts";

/** One artifact read of a round kind — the matrix's judgment composed with the strict
 *  sidecar schema (spec §2.3). `rulings` carries the schema's payload for the read
 *  face that quotes a ruling body; a gate reads `read` alone. */
export type ArtifactReadOf = {
  readonly read: ArtifactRead;
  readonly rulings: readonly Ruling[];
};

/** The no-sidecar read — nothing for the matrix to judge, nothing for the schema to
 *  parse. */
export const ABSENT_READ: ArtifactReadOf = { read: { kind: "absent" }, rulings: [] };

/**
 * ArtifactReads — the frame-free artifact read seam: one workspace, one matrix, one
 * method. `read(kind, carrier, digest)` answers the composed judgment for the kind a
 * caller resolved, with `carrier` the round's carrier path and `digest` the digest its
 * record remembered (`null` = a record that predates the column — a present-facts read,
 * never a second-grade judgment).
 *
 * A carrier that attributes to no round identity (a matrix-external spelling, a P34-era
 * legacy name) reads `absent`: the seam judges the kind it was asked for, and a name the
 * matrix cannot place is an observation, not a refusal. A carrier whose bytes no longer
 * digest to the recorded value THROWS (`CarrierMismatchError`) — a tampered carrier's id
 * set is not a fact any round may read.
 */
export class ArtifactReads {
  readonly #artifacts: ArtifactRegistry;
  readonly #base: Workspace;

  constructor(artifacts: ArtifactRegistry, base: Workspace) {
    this.#artifacts = artifacts;
    this.#base = base;
  }

  /** The ONE read of this `kind` — matrix `read` × schema `verdict`, composed once. */
  read(kind: Kind, carrier: string, digest: string | null): ArtifactReadOf {
    const identity = this.#identityOf(carrier);
    if (identity === null) return ABSENT_READ;
    const read = this.#artifacts.read(identity, kind, this.#base);
    if (read.kind !== "ok") return { read, rulings: [] };
    return this.#compose(read, carrier, digest);
  }

  /** The schema level over a matrix `ok` — `ok` carries the rulings, `invalid` the
   *  schema's own reason verbatim, and a second-level `absent` is a read RACE (the file
   *  left between the two levels), never "there is no sidecar" (spec §4.5). */
  #compose(
    read: ArtifactRead & { kind: "ok" },
    carrier: string,
    digest: string | null,
  ): ArtifactReadOf {
    const verdict = CarrierRulings.verdict(
      read.path,
      this.#carrierPathOf(carrier),
      this.#findingIdsOf(carrier, digest),
    );
    switch (verdict.kind) {
      case "ok":
        return { read, rulings: verdict.rulings };
      case "absent":
        return { read: { kind: "invalid", path: read.path, reason: "unreadable" }, rulings: [] };
      case "invalid":
        return { read: { kind: "invalid", path: read.path, reason: verdict.reason }, rulings: [] };
    }
  }

  /** The reviewed round's identity — delegated to the matrix's ONE entry
   *  (`ArtifactRegistry#reviewedIdentityOf`: `attribute(basename(carrier))` with `op`
   *  fixed to `review`), or null when the carrier attributes to no round coordinate at
   *  all. The seam owns the COMPOSITION, the matrix owns the identity: neither spelling
   *  is repeated here. */
  #identityOf(carrier: string): Identity | null {
    return this.#artifacts.reviewedIdentityOf(carrier);
  }

  /** The carrier's absolute path — the ONE erasure from the repo-relative carrier
   *  faces onto the syscall form both the sidecar judgment and the digest read use. */
  #carrierPathOf(carrier: string): string {
    return path.resolve(this.#base.root.repoRoot, carrier);
  }

  /** The carrier's engine-written finding ids (`F1`, `F2` …) — the id set a ruling must
   *  name, read through the ONE checked carrier read. An absent or unparseable carrier
   *  declares no ids, so any ruling beside it is refused by the strict schema rather
   *  than accepted against an empty set. */
  #findingIdsOf(carrier: string, digest: string | null): ReadonlySet<string> {
    const ids = new Set<string>();
    let carrierJson: unknown;
    try {
      const bytes = CarrierIntegrity.read(this.#carrierPathOf(carrier), digest);
      if (bytes === null) return ids;
      carrierJson = JSON.parse(bytes);
    } catch (raw) {
      if (raw instanceof CarrierMismatchError) throw raw;
      return ids;
    }
    const findings = (carrierJson as { findings?: unknown } | null)?.findings;
    if (!Array.isArray(findings)) return ids;
    for (const finding of findings) {
      const id = (finding as { id?: unknown } | null)?.id;
      if (typeof id === "string") ids.add(id);
    }
    return ids;
  }
}
