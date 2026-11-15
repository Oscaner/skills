// packages/cdd-engine/src-next/session/round-artifacts.ts
// P36 T1 — the artifact matrix: WHO owns an artifact name (the identity domain) ×
// WHICH file belongs to that identity (the artifact kind). One closed registration
// table answers both directions of the naming fact:
//
//   · `render(identity, kind)` — the ONE name rule of a rendered row (the engine
//     mints the name from an identity, never from another name);
//   · `attribute(name)` — the reverse: which identity + kind one on-disk name belongs
//     to, or `null` for a name no row renders (an unknown name is an OBSERVATION, not
//     a refusal).
//
// Registered domains — three, each ONE class owning its rows; the registry is their
// aggregate, and a domain the matrix never registered answers loudly rather than
// inventing a name:
//   · the ROUND domain — draft / final / report / log / crash / evidence / the
//     orchestrator's rulings sidecar (every row rendered from a round coordinate);
//   · the WORKSPACE domain — `progress` · `base` · `in-flight` (the three
//     coordinate-less literals) and `brief`, the one workspace kind carrying a
//     coordinate;
//   · the DOC domain — the four DECLARED rows (`overall` · `phase-spec` ·
//     `single-spec` · `plan`), identity from the front-matter `slug:` and no `render`
//     at all. Its `read` is where a slug naming ≥2 documents of one declared type is
//     judged: `invalid(found)` with every path listed, never a first pick.
//
// Three facts this file is the single home of:
//   · the workspace name SPELLINGS (`progress.json` · `base.json` · `in-flight.json` ·
//     `tasks-{tasks}-brief.md`) — every read face asks the matrix for the answer
//     instead of spelling a literal, so a moved name is one edit and a second spelling
//     cannot be smuggled back in;
//   · the matrix's construction (the composition root's command preamble) — zero
//     module-level default instance, so "every read face holds the SAME instance" is a
//     wiring fact rather than a hope;
//   · the matrix's own scope — a row table is naming and policy KNOWLEDGE, so it binds
//     no directory. The workspace a name resolves inside is a read-time coordinate
//     (`locate(identity, kind, base)`): one board renders several node workspaces, and
//     an instance bound to one of them would resolve another node's names against this
//     node's directory — a legal-looking name that belongs to a different coordinate,
//     which is the very defect this matrix exists to retire.
//
// Module-level exports are types / the registry and its domain — zero behavior-carrying
// bare functions.

import { accessSync, constants, statSync } from "node:fs";
import { basename } from "node:path";
import { DOC_KEYS, type DocKey } from "../contract/project.ts";
import { type DocEntry, SlugIndex } from "../infra/slug-index.ts";
import type { Workspace } from "../infra/workspace.ts";
import { targetFaces } from "./faces.ts";
import type { OpType } from "./ledger.ts";

// ---------------------------------------------------------------------------
// the value types (spec §2.1 · §2.2 · §2.3)
// ---------------------------------------------------------------------------

/** The artifact kinds the matrix knows — the closed set. A new kind must add a row
 *  and answer its author / sealed / identity-source / attribution questions. */
export type Kind =
  | "draft"
  | "final"
  | "report"
  | "log"
  | "crash"
  | "evidence"
  | "rulings"
  | "progress"
  | "base"
  | "in-flight"
  | "brief"
  | "overall"
  | "phase-spec"
  | "single-spec"
  | "plan";

/** The round domain's seven kinds — a round's carrier pair, its report, log, crash
 *  record and test-evidence file, plus the orchestrator's rulings sidecar. */
export type RoundKind = "draft" | "final" | "report" | "log" | "crash" | "evidence" | "rulings";

/** The workspace domain's four kinds. */
export type WorkspaceKind = "progress" | "base" | "in-flight" | "brief";

/** Where an artifact's identity comes from — the one source of its name. A rendered
 *  identity is DERIVED (a frame's line / op / cycle / attempt, or a workspace
 *  constant); a declared identity is SELF-REPORTED by the document (`slug:`). */
export type Identity =
  /** A round's identity — the line word, the op, the cycle and the attempt. The two
   *  coordinates stay optional: a cycle-less spelling is a legal value, not an
   *  exception to be cleaned up. */
  | {
      readonly domain: "round";
      readonly line: string;
      readonly op: OpType;
      readonly cycle?: number | string;
      readonly attempt?: number;
    }
  /** A document's identity — the declared `slug:` and its declared doc type. */
  | { readonly domain: "doc"; readonly slug: string; readonly docType: DocKey }
  /** The workspace domain — `tasks` is the brief's name coordinate and `null` for the
   *  three coordinate-less literals (`progress` · `base` · `in-flight`). */
  | { readonly domain: "workspace"; readonly tasks: string | null };

/** One judgment-time read of an artifact — the ONE discriminated value (spec §2.3).
 *  `absent` never blocks: absence is a read fact, not a row policy. `misplaced` names
 *  a name that attributes to the identity but is not its rendered name. An artifact
 *  that IS there but cannot be read is `invalid`, never `absent` (spec §4.5): "cannot
 *  read" never authorizes "is not there". */
export type ArtifactRead =
  | { readonly kind: "absent" }
  | { readonly kind: "ok"; readonly path: string }
  | {
      readonly kind: "invalid";
      readonly path: string;
      readonly found?: readonly string[];
      readonly reason: string;
    }
  | {
      readonly kind: "misplaced";
      readonly derived: string;
      readonly found: readonly string[];
      readonly identity: Identity;
    };

/** A name's owning identity + kind — `attribute`'s answer (no third state: a name
 *  either attributes or it is unknown). */
export type Attributed = { readonly identity: Identity; readonly kind: Kind };

/** The identifier vocabulary a row declares for its payload's entry keys — the ONE
 *  declaration site of "the same identifier is spelled differently in two adjacent
 *  artifacts" (read faces normalize internally; never a third enumeration). */
export type IdentifierVocabulary = {
  readonly canonical: string;
  readonly accepts: readonly string[];
};

/** One matrix row (spec §2.1, verbatim shape). A rendered row owns its name rule
 *  (`render`) and pairs it with `misplaced: "block"`; a declared row has NO name rule
 *  (that is the fact, not a failed render). The attribution grammar deliberately does
 *  not ride the type: it is a set of judgment rules plus an enumerated pin, and a field
 *  would grow a second table to keep in sync. */
export type ArtifactRow = {
  readonly domain: "round" | "doc" | "workspace";
  readonly author: "engine" | "orchestrator" | "human";
  readonly sealed: boolean;
  readonly identifier?: IdentifierVocabulary;
  readonly policy?: string;
} & (
  | {
      readonly identityFrom: "rendered";
      readonly render: (identity: Identity, kind: Kind) => string;
      readonly misplaced: "block";
    }
  | { readonly identityFrom: "declared" }
);

/** One matrix entry — a row bound to the kind it names. The binding lives beside the
 *  row so `rowOf(kind)` never has to re-derive a kind from a row's shape, and a read
 *  face that walks the closed set reads the kind and the row as one fact. */
export type MatrixEntry = { readonly kind: Kind; readonly row: ArtifactRow };

/** One identity domain's read port — the matrix dispatches on `identity.domain`, and
 *  every domain answers the same four questions. The workspace a path resolves inside
 *  is a parameter, never a construction binding: a domain describes names, a command
 *  observes many workspaces. */
export interface IdentityDomain {
  readonly domain: "round" | "doc" | "workspace";
  kinds(): readonly Kind[];
  /** The domain's own row table (`kind` ↔ `row`) — the registry's aggregate input. */
  entries(): readonly MatrixEntry[];
  /** The name → (identity, kind) reverse port. `null` = unknown (never a third state). */
  attribute(name: string): Attributed | null;
  /** Where the artifact sits inside `base` — a rendered row renders its name, a
   *  declared row takes the index entry's `rel`. The RETURN SHAPE follows the row's
   *  `identityFrom`: a rendered row answers `base.resolve(<rendered name>)` — the
   *  absolute syscall form — while a declared row answers the index entry's repo-
   *  relative `rel`. A caller must not compare paths across domains: the same
   *  `(identity, kind)` question answers two different bases by construction.
   *  `null` = the domain holds no such kind / no such entry; a foreign identity or
   *  an unregistered kind is a caller bug and answers loudly, exactly as `render`
   *  does. */
  locate(identity: Identity, kind: Kind, base: Workspace): string | null;
  /** One read of the artifact as the discriminated value. */
  read(identity: Identity, kind: Kind, base: Workspace): ArtifactRead;
}

/** One artifact's presence read — the ONE existence/readability judgment every
 *  rendered domain delegates to. Existence and readability are two questions:
 *  `stat` answers the first even when the file cannot be opened, so the arm asks the
 *  second explicitly (a file that is there but unreadable is `invalid`, never
 *  `absent`, §4.5). */
const readArtifactAt = (path: string): ArtifactRead => {
  try {
    if (!statSync(path).isFile()) return { kind: "invalid", path, reason: "not a regular file" };
    accessSync(path, constants.R_OK);
    return { kind: "ok", path };
  } catch (raw) {
    if ((raw as NodeJS.ErrnoException).code === "ENOENT") return { kind: "absent" };
    return { kind: "invalid", path, reason: "unreadable" };
  }
};

/** The identity key of one round identity — the coordinate with the renderer's two
 *  defaults applied (a missing cycle renders as no segment; a missing attempt renders
 *  as attempt 1). Two identities with the same key render the same names, so the
 *  attribution set of one (identity, kind) is well defined.
 *
 *  The two defaults are NOT symmetric, and the asymmetry is the point: a missing
 *  `attempt` is attempt 1 (the renderer never mints `-a1`, so attempt 1 and an absent
 *  attempt ARE one identity), while a missing `cycle` is its own coordinate (it renders
 *  no cycle segment at all, so `tasks-1-implement.json` and `tasks-1-implement-1.json`
 *  are two identities — spec §2.2 keeps the cycle-less spelling a legal value). Every
 *  identity comparison reads through this ONE key, never a private re-derivation. */
export const roundIdentityKey = (identity: Extract<Identity, { domain: "round" }>): string =>
  `${identity.line}\u0000${identity.op}\u0000${identity.cycle ?? ""}\u0000${identity.attempt ?? 1}`;

/** The workspace identity key — `tasks` is the whole coordinate. */
const workspaceIdentityKey = (identity: { readonly tasks: string | null }): string =>
  identity.tasks ?? "";

/** One rendered-row read's request — the coordinate plus the workspace it resolves in,
 *  and the DOMAIN's `attribute` / `keyOf` pair that decides which names belong to it.
 *  The request's own key is derived from that pair inside `readRendered`, never passed
 *  in: a caller-supplied key would be the same coordinate spelled a second time, which
 *  is exactly what the identity key exists to forbid. */
type RenderedRead = {
  readonly identity: Identity;
  readonly kind: Kind;
  readonly base: Workspace;
  readonly derived: string;
  readonly attribute: (name: string) => Attributed | null;
  readonly keyOf: (candidate: Attributed) => string;
};

/** A candidate that attributes into ANOTHER domain never compares equal to this
 *  domain's key — the ONE spelling of "not my identity", shared by both domains. */
const FOREIGN_KEY = "\u0000foreign";

/** The round domain's identity key for one attributed name. */
const roundKeyOf = (candidate: Attributed): string =>
  candidate.identity.domain === "round" ? roundIdentityKey(candidate.identity) : FOREIGN_KEY;

/** The workspace domain's identity key for one attributed name. */
const workspaceKeyOf = (candidate: Attributed): string =>
  candidate.identity.domain === "workspace"
    ? workspaceIdentityKey(candidate.identity)
    : FOREIGN_KEY;

/**
 * The ONE read of a rendered row (spec §2.3 · §2.5) — the SET-based judgment, not a
 * count:
 *
 *   · `found` = every name in `base` that attributes to this (identity, kind);
 *   · `found` with any name other than the rendered one ⇒ `misplaced(derived, found)`
 *     — the rendered name is the only legal spelling, and a same-identity variant
 *     beside it is a name the engine did not mint (never a first pick between them);
 *   · `found` exactly the rendered name ⇒ the presence read (`ok` / `invalid`);
 *   · `found` empty ⇒ the presence read at the rendered path, whose answer is the
 *     honest one: `absent` when nothing is there, `invalid` when something is (a
 *     directory named like the artifact is not "missing").
 *
 * The two-name case is the largest instance of the rule, never its definition: a stem
 * variant alone (the derived name never landed) is the same `misplaced` answer, which
 * is why a count-based predicate could not answer it.
 */
const readRendered = (request: RenderedRead): ArtifactRead => {
  const { identity, kind, base, derived, attribute, keyOf } = request;
  const key = keyOf({ identity, kind });
  const found = base.names().filter((name) => {
    const attributed = attribute(name);
    return attributed !== null && attributed.kind === kind && keyOf(attributed) === key;
  });
  if (found.length === 0) return readArtifactAt(base.resolve(derived));
  if (found.some((name) => name !== derived))
    return { kind: "misplaced", derived, found, identity };
  return readArtifactAt(base.resolve(derived));
};

// ---------------------------------------------------------------------------
// the round domain — the seven rows a round identity renders
// ---------------------------------------------------------------------------

/** Every round kind, in the matrix's row order. */
const ROUND_KINDS: readonly RoundKind[] = [
  "draft",
  "final",
  "report",
  "log",
  "crash",
  "evidence",
  "rulings",
];

/** The round LINE words — every target-type word renders a round line except `wave`,
 *  whose line word is the `tasks-<group>` spine instead. */
const ROUND_LINE_WORDS: readonly string[] = Object.keys(targetFaces).filter(
  (word) => word !== "wave",
);

/** The wave line's spine — the task group rides it. */
const WAVE_LINE = "tasks-";

/** The ops a non-wave line word can carry: `implement` belongs to the wave family
 *  alone, so a branch/doc line never mints it. */
const LINE_OPS = "review|fix";

/** One line-word stem — the line, the op, the optional cycle and the optional
 *  attempt. Both spellings of the round grammar are parsed back by ONE pair of
 *  patterns. */
const WAVE_STEM = new RegExp(
  `^(${WAVE_LINE}.+?)-(implement|${LINE_OPS})(?:-(\\d+))?(?:-a(\\d+))?$`,
);
const DOC_STEM = new RegExp(
  `^(${ROUND_LINE_WORDS.join("|")})-(${LINE_OPS})(?:-(\\d+))?(?:-a(\\d+))?$`,
);

/** The final/rulings cycle tag — `.c<cycle>`, the segment that closes a cycle. */
const CYCLE_TAG = /^(.*)\.c(\d+)$/;

/** The round suffixes whose kind the tail alone decides. */
const ROUND_SUFFIXES: readonly { readonly suffix: string; readonly kind: RoundKind }[] = [
  { suffix: ".rulings.json", kind: "rulings" },
  { suffix: "-test-evidence.json", kind: "evidence" },
  { suffix: "-report.md", kind: "report" },
  { suffix: ".log", kind: "log" },
];

/** One on-disk round name split into its kind and the coordinate body it carries. */
type RoundNameParts = {
  readonly kind: RoundKind;
  /** The body before the kind's own tail — the stem plus, for `final` / `rulings`, the
   *  `.c<cycle>` tag stripped off. */
  readonly body: string;
  /** The `.c<cycle>` tag a `final` / `rulings` name carries, when it carries one. */
  readonly cycleTag?: number;
};

/** The round stem of one identity — `line-op[-cycle][-a<n>]`, the shared body every
 *  kind hangs its own prefix/suffix on. A cycle-less identity omits the cycle segment
 *  (never a `-undefined` token); the first attempt omits the `-a` segment. */
const roundStem = (identity: Extract<Identity, { domain: "round" }>): string => {
  const { cycle, attempt } = identity;
  const cycleSegment = cycle === undefined || cycle === "" ? "" : `-${cycle}`;
  const attemptSegment = attempt === undefined || attempt <= 1 ? "" : `-a${attempt}`;
  return `${identity.line}-${identity.op}${cycleSegment}${attemptSegment}`;
};

/** The round name rule — the ONE rendered name of one round identity, for every
 *  round kind. The `rulings` sidecar shares the `final`'s stem deliberately: it is an
 *  attachment OF the reviewed carrier's round, so the spelling of the carrier the
 *  orchestrator handed in (`draft` or `final`) can no longer move it. */
export const renderRound = (identity: Identity, kind: Kind): string => {
  if (identity.domain !== "round")
    throw new Error(`the round matrix renders no ${identity.domain} identity`);
  if (!isRoundKind(kind)) throw new Error(`the matrix holds no round row for ${kind}`);
  const stem = roundStem(identity);
  const closing =
    identity.cycle === undefined || identity.cycle === "" ? "" : `.c${identity.cycle}`;
  switch (kind) {
    case "draft":
      return `${stem}.json`;
    case "final":
      return `${stem}${closing}.json`;
    case "report":
      return `${stem}-report.md`;
    case "log":
      return `${stem}.log`;
    case "crash":
      return `crash-${stem}.json`;
    case "evidence":
      return `${stem}-test-evidence.json`;
    case "rulings":
      return `${stem}${closing}.rulings.json`;
  }
};

/** Whether a kind belongs to the round domain's registered set. */
const isRoundKind = (kind: Kind): kind is RoundKind =>
  (ROUND_KINDS as readonly Kind[]).includes(kind);

/** Split one on-disk round name into its kind and body — `null` for a name whose
 *  tail no round kind renders. */
const splitRoundName = (name: string): RoundNameParts | null => {
  if (name.startsWith("crash-") && name.endsWith(".json")) {
    return { kind: "crash", body: name.slice("crash-".length, -".json".length) };
  }
  for (const { suffix, kind: tailKind } of ROUND_SUFFIXES) {
    if (!name.endsWith(suffix)) continue;
    const rest = name.slice(0, -suffix.length);
    if (tailKind !== "rulings") return { kind: tailKind, body: rest };
    const tag = CYCLE_TAG.exec(rest);
    return tag === null
      ? { kind: tailKind, body: rest }
      : { kind: tailKind, body: tag[1]!, cycleTag: Number(tag[2]) };
  }
  if (!name.endsWith(".json")) return null;
  const rest = name.slice(0, -".json".length);
  const tag = CYCLE_TAG.exec(rest);
  if (tag === null) return { kind: "draft", body: rest };
  return { kind: "final", body: tag[1]!, cycleTag: Number(tag[2]) };
};

/** Parse a round stem back into its identity — `null` when the body is no line word
 *  this matrix renders. */
const roundIdentityOfStem = (body: string): Extract<Identity, { domain: "round" }> | null => {
  const match = WAVE_STEM.exec(body) ?? DOC_STEM.exec(body);
  if (match === null) return null;
  const [, line, op, cycle, attempt] = match;
  return {
    domain: "round",
    line: line!,
    op: op as OpType,
    ...(cycle === undefined ? {} : { cycle: Number(cycle) }),
    ...(attempt === undefined ? {} : { attempt: Number(attempt) }),
  };
};

/** The NAME → identity reverse port of the round domain: the render-name parse. It
 *  answers `null` for a name no round line renders, and the SAME `(identity, kind)`
 *  for every spelling that still attributes — an explicit `-a1`, a `rulings` name
 *  written without its `.c<cycle>` tag. No third state: the `misplaced` judgment needs
 *  the read-time workspace and belongs to `read`. */
const attributeRound = (name: string): Attributed | null => {
  const parts = splitRoundName(name);
  if (parts === null) return null;
  const identity = roundIdentityOfStem(parts.body);
  if (identity === null) return null;
  if (parts.cycleTag !== undefined) {
    // A `.c<cycle>` tag is the `final`/`rulings` face of a CYCLE-BEARING identity: the
    // tag and the stem's own cycle must agree, or the name belongs to no identity.
    if (identity.cycle === undefined || Number(identity.cycle) !== parts.cycleTag) return null;
  }
  return { identity, kind: parts.kind };
};

/** The identifier vocabulary the `rulings` row declares — the ONE declaration site of
 *  "the same identifier is spelled differently in two adjacent artifacts". */
const RULINGS_IDENTIFIER: IdentifierVocabulary = {
  canonical: "finding",
  accepts: ["finding", "id"],
};

/** The `rulings` row's policy — absence is legal: a ruling not yet recorded is not a
 *  defect (the read face stays silent; nothing is invented in its place). */
const RULINGS_POLICY = "absence is legal — a ruling not yet recorded is not a defect";

/** One round row. `sealed` is written out on every row (the matrix leaves no blank for
 *  an implementation to invent a default); the carrier pair is the engine's sealed set,
 *  and the sidecar is the orchestrator's — hence its own author, identifier and
 *  absence policy. */
const roundRow = (kind: RoundKind): ArtifactRow => ({
  domain: "round",
  author: kind === "rulings" ? "orchestrator" : "engine",
  sealed: kind === "draft" || kind === "final",
  identityFrom: "rendered",
  render: renderRound,
  misplaced: "block",
  ...(kind === "rulings" ? { identifier: RULINGS_IDENTIFIER, policy: RULINGS_POLICY } : {}),
});

/** The seven round rows, in row order. */
const ROUND_ENTRIES: readonly MatrixEntry[] = ROUND_KINDS.map((kind) => ({
  kind,
  row: roundRow(kind),
}));

/**
 * RoundDomain — the round identity domain: one (line, op, cycle, attempt) renders the
 * carrier pair, the round's report / log / crash / evidence files and the
 * orchestrator's rulings sidecar. Stateless: the workspace a path resolves inside
 * arrives with each `locate` / `read` call, so one instance serves every node a board
 * renders.
 */
export class RoundDomain implements IdentityDomain {
  readonly domain = "round" as const;

  kinds(): readonly Kind[] {
    return ROUND_KINDS;
  }

  entries(): readonly MatrixEntry[] {
    return ROUND_ENTRIES;
  }

  attribute(name: string): Attributed | null {
    return attributeRound(name);
  }

  locate(identity: Identity, kind: Kind, base: Workspace): string {
    return base.resolve(renderRound(identity, kind));
  }

  read(identity: Identity, kind: Kind, base: Workspace): ArtifactRead {
    return readRendered({
      identity,
      kind,
      base,
      derived: renderRound(identity, kind),
      attribute: attributeRound,
      keyOf: roundKeyOf,
    });
  }
}

// ---------------------------------------------------------------------------
// the doc domain — the four declared rows (no name rule)
// ---------------------------------------------------------------------------

/** The four document kinds — the declared `doc-type:` values. A document's identity is
 *  SELF-REPORTED (`slug:` + `doc-type:`), so these rows have no `render`: "no name
 *  rule" is the fact, not a failed render. */
export type DocKind = DocKey;

/** Every doc kind — the declaration root's OWN tuple (`DOC_KEYS`), never a second
 *  runtime copy: a value added there can not silently skip a row here. */
const DOC_KINDS: readonly DocKind[] = DOC_KEYS;

/** Whether a kind belongs to the doc domain's declared set. */
const isDocKind = (kind: Kind): kind is DocKind => (DOC_KINDS as readonly Kind[]).includes(kind);

/** The four declared rows — human-authored documents, never sealed, no `misplaced`
 *  (there is no rendered name to sit beside). */
const DOC_ENTRIES: readonly MatrixEntry[] = DOC_KINDS.map((kind) => ({
  kind,
  row: { domain: "doc", author: "human", sealed: false, identityFrom: "declared" },
}));

/** One indexed document's DECLARED identity — `null` when the document declares no
 *  legal `slug:` or no declared `doc-type:`. The file name plays no part. */
const docIdentityOf = (entry: DocEntry): Extract<Identity, { domain: "doc" }> | null => {
  if (entry.docType === null || !SlugIndex.isLegalSlug(entry.slug)) return null;
  return { domain: "doc", slug: entry.slug, docType: entry.docType };
};

/**
 * DocDomain — the declared identity domain: the four document rows, answered entirely
 * by the command's ONE identity index. `attribute` maps a repo-relative path to the
 * document's declared identity, never to a filename-derived one; `locate` / `read`
 * answer on the index entry's `rel` — the declared row's own home, and the basis every
 * doc consumer compares paths on. The domain never renders a name (documents name
 * themselves), so it holds no `render` and no orphan-by-name rule.
 */
export class DocDomain implements IdentityDomain {
  readonly domain = "doc" as const;
  readonly #index: SlugIndex;

  constructor(index: SlugIndex) {
    this.#index = index;
  }

  kinds(): readonly Kind[] {
    return DOC_KINDS;
  }

  entries(): readonly MatrixEntry[] {
    return DOC_ENTRIES;
  }

  attribute(name: string): Attributed | null {
    const entry = this.#index.entryAt(name);
    if (entry === null) return null;
    const identity = docIdentityOf(entry);
    return identity === null ? null : { identity, kind: identity.docType };
  }

  /** The sole matching document's path — `null` when the slug names none of the kind
   *  or names two of them. The path is the index entry's `rel` (its declared home on
   *  the ONE repo-root-relative basis every consumer compares on), never a rendered
   *  name and never the syscall form. */
  locate(identity: Identity, kind: Kind, _base: Workspace): string | null {
    const doc = this.#identityOf(identity, kind);
    const found = this.#documentsOf(doc);
    return found.length === 1 ? found[0]!.rel : null;
  }

  /** One read of the declared document — the ambiguity judgment's ONE home (spec §4.4):
   *  a slug naming two documents of the same declared type is `invalid(found)` and both
   *  paths are printed; the read never selects one. The `path` is the index entry's
   *  `rel`, the same basis `locate` answers on. */
  read(identity: Identity, kind: Kind, _base: Workspace): ArtifactRead {
    const doc = this.#identityOf(identity, kind);
    const found = this.#documentsOf(doc);
    if (found.length > 1) {
      return {
        kind: "invalid",
        path: found[0]!.rel,
        found: found.map((entry) => entry.rel),
        reason: "duplicate-identity",
      };
    }
    const only = found[0];
    if (only === undefined) return { kind: "absent" };
    // The existence probe takes the syscall form; the ANSWER speaks the declared
    // home, so a doc read and a doc locate never name one document two ways.
    const at = readArtifactAt(only.path);
    if (at.kind === "invalid") return { ...at, path: only.rel };
    return at.kind === "ok" ? { kind: "ok", path: only.rel } : at;
  }

  /** The documents declaring this slug at this declared type — 0, 1 or n. The set is
   *  the whole judgment: no arm of the doc domain ever picks a first document. */
  #documentsOf(doc: Extract<Identity, { domain: "doc" }>): readonly DocEntry[] {
    return this.#index.docsOf(doc.slug).filter((entry) => entry.docType === doc.docType);
  }

  /** The doc identity narrowed to this row — a foreign domain or a kind the identity
   *  does not declare is a caller bug (loud, as `render` is). */
  #identityOf(identity: Identity, kind: Kind): Extract<Identity, { domain: "doc" }> {
    if (identity.domain !== "doc")
      throw new Error(`the doc matrix reads no ${identity.domain} identity`);
    if (!isDocKind(kind) || kind !== identity.docType)
      throw new Error(`the doc matrix holds no ${kind} row for a ${identity.docType} identity`);
    return identity;
  }
}

// ---------------------------------------------------------------------------
// the workspace domain — the four workspace rows
// ---------------------------------------------------------------------------

/** The workspace kinds in the matrix's own row order. */
const WORKSPACE_KINDS: readonly WorkspaceKind[] = ["progress", "base", "in-flight", "brief"];

/** The three coordinate-less workspace names — the literals the conservation boundary
 *  pins byte for byte. */
const WORKSPACE_LITERALS = {
  progress: "progress.json",
  base: "base.json",
  "in-flight": "in-flight.json",
} as const;

/** The ONE workspace name rule — every rendered workspace row and every read face's
 *  literal ask delegate here. The coordinate is part of the identity, so an identity
 *  the kind does not carry is refused rather than rendered into a plausible-looking
 *  wrong name: the three literals take `tasks: null`, the brief a non-empty group. */
const workspaceName = (kind: WorkspaceKind, tasks: string | null): string => {
  if (kind === "brief") {
    if (tasks === null || tasks === "")
      throw new Error("the brief's name needs a non-empty tasks coordinate");
    return `tasks-${tasks}-brief.md`;
  }
  if (tasks !== null) throw new Error(`the ${kind} artifact carries no tasks coordinate`);
  return WORKSPACE_LITERALS[kind];
};

/** A workspace row's render — the domain is the row's own, so a foreign identity is a
 *  caller bug and answers loudly rather than rendering a plausible wrong name. */
const renderWorkspace = (identity: Identity, kind: Kind): string => {
  if (identity.domain !== "workspace")
    throw new Error(`the workspace matrix renders no ${identity.domain} identity`);
  if (!isWorkspaceKind(kind)) throw new Error(`the matrix holds no workspace row for ${kind}`);
  return workspaceName(kind, identity.tasks);
};

/** Whether a kind belongs to the workspace domain's registered set. */
const isWorkspaceKind = (kind: Kind): kind is WorkspaceKind =>
  (WORKSPACE_KINDS as readonly Kind[]).includes(kind);

/** The brief's reverse pattern — `tasks-{tasks}-brief.md`, the ONE place the template
 *  is parsed back into its coordinate. */
const BRIEF_NAME = /^tasks-(.+)-brief\.md$/;

/** The four workspace rows — `sealed` is written out on every row (the matrix leaves no
 *  blank for an implementation to invent a default), and no row carries a `policy`:
 *  absence is a read fact, never a row rule — the workspace literals have no
 *  absence-charged face. */
const ENTRIES: readonly MatrixEntry[] = WORKSPACE_KINDS.map((kind) => ({
  kind,
  row: {
    domain: "workspace",
    author: "engine",
    sealed: false,
    identityFrom: "rendered",
    render: renderWorkspace,
    misplaced: "block",
  },
}));

/**
 * WorkspaceDomain — the workspace identity domain: four engine-authored files whose
 * names carry no round coordinate. `tasks: null` addresses the three literal names;
 * the brief's own coordinate addresses it. The domain is stateless: the workspace a
 * path resolves inside arrives with each `locate` / `read` call.
 */
export class WorkspaceDomain implements IdentityDomain {
  readonly domain = "workspace" as const;

  kinds(): readonly Kind[] {
    return WORKSPACE_KINDS;
  }

  entries(): readonly MatrixEntry[] {
    return ENTRIES;
  }

  attribute(name: string): Attributed | null {
    for (const kind of WORKSPACE_KINDS) {
      const literal = kind === "brief" ? null : WORKSPACE_LITERALS[kind];
      if (literal !== name) continue;
      return { identity: { domain: "workspace", tasks: null }, kind };
    }
    const tasks = BRIEF_NAME.exec(name)?.[1] ?? null;
    if (tasks === null || tasks === "") return null;
    return { identity: { domain: "workspace", tasks }, kind: "brief" };
  }

  locate(identity: Identity, kind: Kind, base: Workspace): string {
    return base.resolve(renderWorkspace(identity, kind));
  }

  read(identity: Identity, kind: Kind, base: Workspace): ArtifactRead {
    return readRendered({
      identity,
      kind,
      base,
      derived: renderWorkspace(identity, kind),
      attribute: (name) => this.attribute(name),
      keyOf: workspaceKeyOf,
    });
  }
}

// ---------------------------------------------------------------------------
// the registry — the matrix's public port
// ---------------------------------------------------------------------------

/** The default domain set — the registry's construction input and the module-level
 *  vocabulary read's scan surface, so the two entry forms answer over ONE table. */
const DEFAULT_DOMAINS: readonly IdentityDomain[] = [new RoundDomain(), new WorkspaceDomain()];

/**
 * ArtifactRegistry — the matrix as one object: the closed row table plus the two
 * ports over it (`render` · `attribute`) and the read face. The instance is built ONCE
 * per invocation by the composition root and handed down; a face that mints its own
 * has already left the single source. It holds no directory: the same instance serves
 * every workspace one command observes. The DECLARED domain is the one row set whose
 * answers need an index, so it is bound onto this SAME instance once the command's
 * index exists (`bindDocIndex`) — never built into a second registry.
 */
export class ArtifactRegistry {
  /** The registered domains, in registration order. Replaced only by `bindDocIndex`,
   *  which swaps the declared domain in place so every face holding this instance
   *  (the base face, the ledgers, the lifecycle, the board) keeps asking ONE table. */
  #domains: readonly IdentityDomain[];

  constructor(domains: readonly IdentityDomain[] = DEFAULT_DOMAINS) {
    this.#domains = domains;
  }

  /** One row's declared identifier vocabulary, WITHOUT an instance — the module-level
   *  entry for the read faces that hold no registry (a sidecar schema's acceptance set
   *  is a naming fact, not a directory fact). It reads the SAME domain instances the
   *  constructor's default does, so the declaration has one home and no caller can grow
   *  a second acceptance set. */
  static identifierOf(kind: Kind): IdentifierVocabulary | null {
    for (const domain of DEFAULT_DOMAINS) {
      const entry = domain.entries().find((candidate) => candidate.kind === kind);
      if (entry !== undefined) return entry.row.identifier ?? null;
    }
    return null;
  }

  /** The workspace name rule WITHOUT an instance — the module-level entry to the SAME
   *  render the workspace rows carry (`renderWorkspace`), for the read faces that hold
   *  a workspace-relative name and no registry (a static constant, the naming face).
   *  One spelling, two entry forms: the pin `nameOf(kind, tasks)` equals
   *  `render({domain: "workspace", tasks}, kind)` holds by construction. Restricted to
   *  the workspace kinds — a round name needs a round identity. */
  static nameOf(kind: WorkspaceKind, tasks: string | null): string {
    return renderWorkspace({ domain: "workspace", tasks }, kind);
  }

  /** Every registered entry (`kind` ↔ row), in registration order. */
  entries(): readonly MatrixEntry[] {
    return this.#domains.flatMap((domain) => domain.entries());
  }

  /** Bind this command's identity index to the DECLARED domain — the ONE doc-domain
   *  construction point, and it edits THIS instance rather than replacing it. The
   *  binding is idempotent: a command that resolves its root twice swaps one declared
   *  domain for the one over the newer index, and every face already holding the
   *  registry sees the new answers (an injected registry included, so a hermetic
   *  caller's instance answers doc reads exactly as the preamble's does). */
  bindDocIndex(index: SlugIndex): void {
    this.#domains = [
      ...this.#domains.filter((domain) => domain.domain !== "doc"),
      new DocDomain(index),
    ];
  }

  /** Every registered row, in registration order. */
  rows(): readonly ArtifactRow[] {
    return this.entries().map((entry) => entry.row);
  }

  /** The row one kind registers — `null` for a kind no domain registered yet. */
  rowOf(kind: Kind): ArtifactRow | null {
    return this.entries().find((entry) => entry.kind === kind)?.row ?? null;
  }

  /** The name rule of one (identity, kind) — the rendered row's `render`. A declared
   *  row (no name rule) and an unregistered kind have no rendered name: both answer
   *  loudly rather than inventing one. */
  render(identity: Identity, kind: Kind): string {
    const row = this.rowOf(kind);
    if (row === null) throw new Error(`the matrix holds no row for ${kind}`);
    if (row.identityFrom !== "rendered") throw new Error(`the ${kind} row has no name rule`);
    return row.render(identity, kind);
  }

  /** The name → identity reverse port — the first domain that recognizes the name. */
  attribute(name: string): Attributed | null {
    for (const domain of this.#domains) {
      const attributed = domain.attribute(name);
      if (attributed !== null) return attributed;
    }
    return null;
  }

  /** The REVIEWED round's identity for one carrier name — the ONE source of every
   *  name derived from a `--reviews` carrier (spec §2.1: `rulings` coordinates are the
   *  reviewed round's, `op` fixed to `review`). The caller hands the carrier's own
   *  spelling; the identity comes from `attribute(basename(carrier))` with the carrier's
   *  `cycle` / `attempt`, so a draft spelling and a final spelling of one round answer
   *  ONE identity. `null` = the matrix cannot place the name (a legacy spelling, a
   *  foreign file) — the caller then derives no name at all rather than guessing one.
   *
   *  Two read faces ask this question — the sidecar read seam
   *  (`session/artifact-reads.ts`) and the router's readback value
   *  (`session/next.ts`) — and both call THIS entry, so the `op: "review"` construction
   *  has one production home (the door pins it). */
  reviewedIdentityOf(name: string): Identity | null {
    if (name === "") return null;
    const attributed = this.attribute(basename(name));
    if (attributed === null || attributed.identity.domain !== "round") return null;
    const { line, cycle, attempt } = attributed.identity;
    return {
      domain: "round",
      line,
      op: "review",
      ...(cycle === undefined ? {} : { cycle }),
      ...(attempt === undefined ? {} : { attempt }),
    };
  }

  /** Where one (identity, kind) sits inside `base` — dispatched by the identity's own
   *  domain. The base is the caller's workspace, never the registry's: a board reads
   *  several node workspaces through ONE matrix. */
  locate(identity: Identity, kind: Kind, base: Workspace): string | null {
    return this.#domainOf(identity).locate(identity, kind, base);
  }

  /** One read of one (identity, kind) inside `base` — the same domain dispatch, one
   *  judgment. */
  read(identity: Identity, kind: Kind, base: Workspace): ArtifactRead {
    return this.#domainOf(identity).read(identity, kind, base);
  }

  /** The domain that owns an identity — a domain the matrix never registered is a
   *  caller bug (its task has not landed), so it answers loudly. */
  #domainOf(identity: Identity): IdentityDomain {
    const domain = this.#domains.find((candidate) => candidate.domain === identity.domain);
    if (domain === undefined) throw new Error(`the matrix holds no ${identity.domain} domain`);
    return domain;
  }
}
