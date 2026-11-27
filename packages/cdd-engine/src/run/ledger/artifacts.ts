// packages/cdd-engine/src/run/ledger/artifacts.ts
// The artifact identity: which file belongs to which round, and what it is called.
//
// One round identity (`run/ledger/identity.ts`) renders every artifact name that round
// can land: the child's draft, the engine's finalized carrier, the round's report, its
// log, its crash record, its test-evidence file and the orchestrator's rulings sidecar.
// The name is DERIVED from the four cells — never stored, never hand-spelled — so a
// record's carrier path is a function of the record alone.
//
// Invariant: one `(round identity, kind)` owns exactly one name, and one name belongs to
// exactly one artifact. The index refuses a second registration of the same pair: two
// registrations of one artifact mean two writers believe they own one name, which is the
// shape of a name collision that no later check would catch.
//
// The reverse direction (name → identity) is this file's `attribute`, and it is the ONLY
// place a carrier name is parsed. A second grammar kept beside the renderer would be the
// second spelling the ledger's invariant forbids.
//
// Not every artifact is a round's. The tree-level records — the refusal fact and the
// in-flight record, other workspace-domain names as they land — belong to no coordinate, so
// they live in their own table (`WORKSPACE_ARTIFACTS`) rather than as a kind rendered from a
// fabricated round: one table, one spelling per name, and every tree-level reader derives
// its path from it.

import {
  RoundIdentity as Identity,
  ROUND_OPS,
  type RoundIdentity,
  type RoundOp,
} from "./identity.ts";

/** The artifact kinds one round identity renders — the closed set. */
export type ArtifactKind = "draft" | "final" | "report" | "log" | "crash" | "evidence" | "rulings";

/** The declared kinds, in the order a refusal names them — the runtime companion. */
export const ARTIFACT_KINDS = [
  "draft",
  "final",
  "report",
  "log",
  "crash",
  "evidence",
  "rulings",
] as const satisfies readonly ArtifactKind[];

/** The tree-level artifacts — the engine's own workspace-domain files, which no round
 *  identity renders. Invariant: one name here, one home; a reader that spells the name
 *  itself has taken a second home. */
export const WORKSPACE_ARTIFACTS = {
  /** The tree's one standing refusal fact (`run/gate/refusal.ts#Refusal`). */
  refusal: "refusal.json",
  /** The tree's one occupancy record (`run/dispatch/inflight.ts#InFlight`). */
  inFlight: "in-flight.json",
} as const;

/** The workspace-level artifact names, as a closed set. */
export type WorkspaceArtifact = keyof typeof WORKSPACE_ARTIFACTS;

/** The line words the name grammar reads back — the waves' spine and the five fixed
 *  words. The document words come before nothing else that could swallow them, so
 *  `single-spec` never reads as `spec` and `phase-spec` keeps its tail. */
const LINE_WORDS = "tasks-[\\d,]+|single-spec|phase-spec|overall|plan|branch";

/** The round stem's parse — line, op, cycle and the optional attempt segment. */
const STEM = new RegExp(
  `^(?<line>${LINE_WORDS})-(?<op>${ROUND_OPS.join("|")})-(?<cycle>\\d+)(?:-a(?<attempt>\\d+))?$`,
);

/** The `.c<cycle>` closing tag a `final` / `rulings` name carries. */
const CYCLE_TAG = /^(?<stem>.+)\.c(?<cycle>\d+)$/;

/** The name tails the reverse parse tries after the `crash-` prefix — the longest
 *  suffixes first, so `.rulings.json` never reads as a draft. */
const TAILS: readonly { readonly suffix: string; readonly kind: ArtifactKind }[] = [
  { suffix: "-test-evidence.json", kind: "evidence" },
  { suffix: ".rulings.json", kind: "rulings" },
  { suffix: "-report.md", kind: "report" },
  { suffix: ".log", kind: "log" },
];

/** One parsed name: the kind, the stem to read the identity off, and the cycle tag. */
interface SplitName {
  readonly kind: ArtifactKind;
  readonly stem: string;
  readonly cycleTag?: number;
}

/**
 * ArtifactIdentity — one artifact: the round it belongs to and the kind it is.
 * Invariant: `name` is a pure function of the pair, so two identities render two names
 * and one identity can never render two.
 */
export class ArtifactIdentity {
  readonly round: RoundIdentity;
  readonly kind: ArtifactKind;

  constructor(round: RoundIdentity, kind: ArtifactKind) {
    if (!ARTIFACT_KINDS.includes(kind)) {
      throw new Error(`ArtifactIdentity: "${String(kind)}" is not a declared artifact kind`);
    }
    this.round = round;
    this.kind = kind;
  }

  /** The index key — the round's own key plus the kind. */
  get key(): string {
    return `${this.round.key}\u0000${this.kind}`;
  }

  /** The rendered name — the ONE spelling of this artifact. */
  get name(): string {
    return ArtifactIdentity.nameOf(this.round, this.kind);
  }

  /** THE name rule: `line-op-cycle[-a<attempt>]`, with each kind's own prefix/suffix.
   *  The first attempt carries no `-a1` segment (one round, one name); a later attempt
   *  keeps its own, so a re-dispatch never overwrites its predecessor. */
  static nameOf(round: RoundIdentity, kind: ArtifactKind): string {
    const stem = `${round.line}-${round.op}-${round.cycle}${round.attempt > 1 ? `-a${round.attempt}` : ""}`;
    switch (kind) {
      case "draft":
        return `${stem}.json`;
      case "final":
        return `${stem}.c${round.cycle}.json`;
      case "report":
        return `${stem}-report.md`;
      case "log":
        return `${stem}.log`;
      case "crash":
        return `crash-${stem}.json`;
      case "evidence":
        return `${stem}-test-evidence.json`;
      case "rulings":
        return `${stem}.c${round.cycle}.rulings.json`;
    }
  }

  /** The artifact kinds one round PRESCRIBES, in the order a consumer names them: the
   *  draft the child writes, the round's report and — where the naming rule prescribes
   *  one — the test-evidence file. Two conditions decide the evidence slot, and both read
   *  the identity's own cells: the round must be a WORK round (a review prescribes no
   *  evidence) and its line must not be a document shape (the four document words never
   *  prescribe one). A caller holding the round therefore never restates the condition. */
  static prescribedOf(round: RoundIdentity): readonly ArtifactKind[] {
    const evidence = round.op !== "review" && round.lineKind !== "doc";
    return evidence ? ["draft", "report", "evidence"] : ["draft", "report"];
  }

  /** The reverse direction: the artifact one on-disk name belongs to, or null for a name
   *  no kind renders (an unknown name is an OBSERVATION, never a refusal). The
   *  `.c<cycle>` tag must agree with the stem's own cycle, or the name belongs to no
   *  identity at all. */
  static attribute(name: string): ArtifactIdentity | null {
    const parts = ArtifactIdentity.#splitName(name);
    if (parts === null) return null;
    const match = STEM.exec(parts.stem);
    if (match?.groups === undefined) return null;
    const cycle = Number(match.groups.cycle);
    if (parts.cycleTag !== undefined && parts.cycleTag !== cycle) return null;
    try {
      const round = new Identity({
        line: match.groups.line,
        op: match.groups.op as RoundOp,
        cycle,
        attempt: match.groups.attempt === undefined ? 1 : Number(match.groups.attempt),
      });
      return new ArtifactIdentity(round, parts.kind);
    } catch {
      return null;
    }
  }

  /** One name split into its kind, stem and optional `.c<cycle>` tag — the `crash-`
   *  prefix first (a whole-name fact), then the tail table, then the two `.json` forms. */
  static #splitName(name: string): SplitName | null {
    if (name.startsWith("crash-") && name.endsWith(".json")) {
      return { kind: "crash", stem: name.slice("crash-".length, -".json".length) };
    }
    for (const { suffix, kind } of TAILS) {
      if (!name.endsWith(suffix)) continue;
      const rest = name.slice(0, -suffix.length);
      if (kind !== "rulings") return { kind, stem: rest };
      return ArtifactIdentity.#tagged(rest, kind);
    }
    if (!name.endsWith(".json")) return null;
    const rest = name.slice(0, -".json".length);
    const tagged = ArtifactIdentity.#tagged(rest, "final");
    return tagged.cycleTag === undefined ? { kind: "draft", stem: rest } : tagged;
  }

  /** A name body with its optional `.c<cycle>` tag read off. */
  static #tagged(body: string, kind: ArtifactKind): SplitName {
    const tag = CYCLE_TAG.exec(body);
    if (tag?.groups === undefined) return { kind, stem: body };
    return { kind, stem: tag.groups.stem, cycleTag: Number(tag.groups.cycle) };
  }
}

/**
 * Artifacts — the artifact index of one workspace. Invariant: one artifact is registered
 * once, and one name belongs to one artifact — a second registration of the same pair is
 * refused, because two owners of one name is a collision nothing downstream would catch.
 */
export class Artifacts {
  /** Artifact key → the name it owns. */
  readonly #names = new Map<string, string>();
  /** Name → the artifact key that owns it. */
  readonly #owners = new Map<string, string>();

  /** Register one artifact and answer its identity. A repeat of the same
   *  `(round identity, kind)` throws: the name is already owned. */
  register(round: RoundIdentity, kind: ArtifactKind): ArtifactIdentity {
    const identity = new ArtifactIdentity(round, kind);
    const held = this.#names.get(identity.key);
    if (held !== undefined) {
      throw new Error(`artifact ${identity.key} is already registered as ${held}`);
    }
    const owner = this.#owners.get(identity.name);
    if (owner !== undefined) {
      throw new Error(`the name ${identity.name} already belongs to ${owner}`);
    }
    this.#names.set(identity.key, identity.name);
    this.#owners.set(identity.name, identity.key);
    return identity;
  }

  /** The artifact one name belongs to, by the name grammar — independent of what has
   *  been registered (a file on disk attributes whether or not this run registered it). */
  attribute(name: string): ArtifactIdentity | null {
    return ArtifactIdentity.attribute(name);
  }

  /** The registered names, in registration order. */
  names(): readonly string[] {
    return [...this.#names.values()];
  }

  /** Whether one record still OWNS its carrier path: no other record of the same line
   *  sits on that path with a larger `(cycle, attempt)`. New records are each their own
   *  owner (their names are unique by identity), so the judgment discriminates a
   *  RECORDED path that a later round overwrote — present facts, never a tamper call.
   *  The path arrives as a projection, so the index needs no workspace. */
  static ownerOf(
    records: readonly RoundIdentity[],
    record: RoundIdentity,
    pathOf: (candidate: RoundIdentity) => string,
  ): boolean {
    const path = pathOf(record);
    if (path === "") return false;
    return !records.some((other) => Identity.later(other, record) && pathOf(other) === path);
  }
}
