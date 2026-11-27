// packages/cdd-engine/src/run/ledger/artifact-reads.ts
// The artifact read seam: the matrix's judgment and the sidecar's strict schema read as
// ONE value.
//
// Two levels belong together here. The first is the NAME judgment — which on-disk names
// attribute to the artifact asked for, whether the rendered name is the only one, and
// whether anything is actually readable at it. The second is the SIDEcar judgment — a
// rulings file either conforms to the strict schema or the whole read is refused; there is
// no half value, because a gate acting on three of four rulings is a gate that lost one.
//
// Four states, one source: `ok` (the rendered name, readable, schema-conforming) ·
// `misplaced` (a second name attributes to the same artifact — the rendered name is the
// only legal spelling) · `absent` (nothing there) · `invalid` (there, and refused: an
// unreadable file, a schema violation, or a carrier whose bytes no longer digest to the
// record).
//
// The carrier's integrity is composed in, not re-implemented: this class hands the bytes
// and the recorded digest to `CarrierLine#read` and folds the thrown mismatch into
// `invalid`. A caller therefore never sees a tampered carrier judged as ordinary bytes,
// and never has to know the digest rule to get that behavior.
//
// No filesystem: the workspace's names and text arrive through `ArtifactSource`, so a pin
// can read a fabricated workspace without touching disk.

import type { RepoPath } from "../../env/paths/root.ts";
import { ArtifactIdentity, type ArtifactKind, type Artifacts } from "./artifacts.ts";
import { CarrierLine, CarrierMismatchError } from "./carrier-line.ts";
import type { RoundIdentity } from "./identity.ts";
import { type RulingRecord, Rulings } from "./rulings.ts";

/** The workspace read faces the artifact reads are taken over — `env.workspace` supplies
 *  them in production (`names` through the composed root, `readText`/`relOf` directly), a
 *  fabricated triple in a pin. */
export interface ArtifactSource {
  /** Every name directly inside the one workspace this read is taken over. */
  names(): readonly string[];
  /** Read one repo-relative file; null when nothing is there. */
  readText(target: RepoPath): string | null;
  /** The repo-relative coordinate of one workspace child name. */
  relOf(name: string): RepoPath;
}

/** One artifact read — the four states above. */
export type ArtifactRead =
  | {
      readonly kind: "ok";
      readonly path: RepoPath;
      readonly rulings: readonly RulingRecord[];
    }
  /** `names` are repo-relative, the same basis as `path` — every on-disk spelling that
   *  attributes to this artifact, the rendered one included when it is there. */
  | { readonly kind: "misplaced"; readonly path: RepoPath; readonly names: readonly RepoPath[] }
  | { readonly kind: "absent" }
  | { readonly kind: "invalid"; readonly path: RepoPath; readonly reason: string };

/** The carrier a sidecar answers — its path and the digest the round's record carries. A
 *  null digest is a record written before the column existed: a present-facts read with
 *  zero comparison. */
export interface CarrierRef {
  /** The carrier's repo-relative path. */
  readonly path: RepoPath;
  /** The digest the record remembers, or null. */
  readonly digest: string | null;
}

/**
 * ArtifactReads — one workspace's artifact read seam. Invariant: a read answers exactly one
 * of the four states, and the two levels (name judgment, schema judgment) compose in one
 * place, so a caller can never see a matrix verdict without its schema verdict.
 */
export class ArtifactReads {
  readonly #artifacts: Artifacts;
  readonly #source: ArtifactSource;

  constructor(opts: { artifacts: Artifacts; source: ArtifactSource }) {
    this.#artifacts = opts.artifacts;
    this.#source = opts.source;
  }

  /** Read one artifact of one round. `carrier` is the artifact's own carrier reference —
   *  the bytes whose digest the record remembers — and is REQUIRED to judge a `rulings`
   *  sidecar, because a ruling's finding ids come from the carrier it answers. */
  read(round: RoundIdentity, kind: ArtifactKind, carrier: CarrierRef | null = null): ArtifactRead {
    const identity = new ArtifactIdentity(round, kind);
    const rendered = this.#source.relOf(identity.name);
    const found = this.#foundNames(identity);
    if (found.some((name) => name !== rendered)) {
      return { kind: "misplaced", path: rendered, names: found };
    }
    const text = this.#source.readText(rendered);
    if (text === null) return { kind: "absent" };
    if (kind !== "rulings") return { kind: "ok", path: rendered, rulings: [] };
    return this.#judgeSidecar(rendered, text, carrier);
  }

  /** The sidecar's strict read — a schema violation is `invalid` with the reason verbatim,
   *  never a partially accepted set of rulings. A carrier mismatch leaves before the
   *  schema is consulted: the ids a ruling names would come from bytes nobody can trust. */
  #judgeSidecar(rendered: RepoPath, text: string, carrier: CarrierRef | null): ArtifactRead {
    if (carrier === null) {
      return { kind: "invalid", path: rendered, reason: "the sidecar answers no carrier" };
    }
    const carrierText = this.#source.readText(carrier.path);
    try {
      CarrierLine.read(carrierText, carrier.path, carrier.digest);
    } catch (raw) {
      if (!(raw instanceof CarrierMismatchError)) throw raw;
      return { kind: "invalid", path: rendered, reason: raw.message };
    }
    const verdict = Rulings.read(
      text,
      ArtifactReads.baseNameOf(carrier.path),
      ArtifactReads.findingIdsOf(carrierText),
    );
    switch (verdict.kind) {
      case "ok":
        return { kind: "ok", path: rendered, rulings: verdict.rulings };
      case "invalid":
        return { kind: "invalid", path: rendered, reason: verdict.reason };
      case "absent":
        // The file was there a moment ago and is gone now: a read race, never "there is no
        // sidecar" — the ordinary absence already answered above, before this branch.
        return { kind: "invalid", path: rendered, reason: "unreadable" };
    }
  }

  /** Every name in the workspace that attributes to this exact artifact, in the read
   *  value's OWN coordinate basis: `path` is repo-relative, so the spellings that answer
   *  "which names are on disk" are too — a caller never has to know the workspace's
   *  directory to print one. (`orphanHandoffs` answers bare workspace names instead: that
   *  face names files no record claims, not an artifact's coordinates.) */
  #foundNames(identity: ArtifactIdentity): readonly RepoPath[] {
    const found: RepoPath[] = [];
    for (const name of this.#source.names()) {
      const attributed = this.#artifacts.attribute(name);
      if (attributed !== null && attributed.key === identity.key) {
        found.push(this.#source.relOf(name));
      }
    }
    return found.sort();
  }

  /** The base name of one repo-relative path — the `carrier` key's comparison. */
  static baseNameOf(path: RepoPath): string {
    return path.split("/").pop() ?? path;
  }

  /** The carrier's engine-written finding ids (`F1`, `F2` …) — the id set a ruling must
   *  name. An absent or unparseable carrier declares no ids, so any ruling beside it is
   *  refused rather than accepted against an empty set. */
  static findingIdsOf(carrierText: string | null): ReadonlySet<string> {
    const ids = new Set<string>();
    if (carrierText === null) return ids;
    let parsed: unknown;
    try {
      parsed = JSON.parse(carrierText);
    } catch {
      return ids;
    }
    const findings = (parsed as { findings?: unknown } | null)?.findings;
    if (!Array.isArray(findings)) return ids;
    for (const finding of findings) {
      const id = (finding as { id?: unknown } | null)?.id;
      if (typeof id === "string") ids.add(id);
    }
    return ids;
  }
}
