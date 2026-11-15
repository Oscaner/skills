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
// This wave registers the WORKSPACE domain alone: `progress` · `base` · `in-flight`
// (the three coordinate-less literals) and `brief` (the one workspace kind carrying a
// coordinate — its task group). The round domain (draft / final / report / log /
// crash / evidence / rulings) and the declared doc domain are registered into the same
// table by their own tasks; `Identity`'s discriminated union is written out in full
// here so neither later task has to widen a public type.
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
import type { DocKey } from "../contract/project.ts";
import type { Workspace } from "../infra/workspace.ts";
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
  | "brief";

/** The workspace domain's four kinds — the rows this wave registers. */
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
   *  declared row takes the index entry's `rel`. `null` = the domain holds no such
   *  kind / no such entry; a foreign identity or an unregistered kind is a caller bug
   *  and answers loudly, exactly as `render` does. */
  locate(identity: Identity, kind: Kind, base: Workspace): string | null;
  /** One read of the artifact as the discriminated value. */
  read(identity: Identity, kind: Kind, base: Workspace): ArtifactRead;
}

// ---------------------------------------------------------------------------
// the workspace domain — the four rows this wave registers
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
    const path = this.locate(identity, kind, base);
    try {
      // Existence and readability are two questions: `stat` answers the first even
      // when the file cannot be opened, so the read arm asks the second explicitly
      // (a file that is there but unreadable is `invalid`, never `absent`, §4.5).
      if (!statSync(path).isFile()) return { kind: "invalid", path, reason: "not a regular file" };
      accessSync(path, constants.R_OK);
      return { kind: "ok", path };
    } catch (raw) {
      if ((raw as NodeJS.ErrnoException).code === "ENOENT") return { kind: "absent" };
      return { kind: "invalid", path, reason: "unreadable" };
    }
  }
}

// ---------------------------------------------------------------------------
// the registry — the matrix's public port
// ---------------------------------------------------------------------------

/**
 * ArtifactRegistry — the matrix as one object: the closed row table plus the two
 * ports over it (`render` · `attribute`) and the read face. The instance is built ONCE
 * per invocation by the composition root and handed down; a face that mints its own
 * has already left the single source. It holds no directory: the same instance serves
 * every workspace one command observes.
 */
export class ArtifactRegistry {
  /** The registered domains, in registration order. */
  readonly #domains: readonly IdentityDomain[];

  constructor(domains: readonly IdentityDomain[] = [new WorkspaceDomain()]) {
    this.#domains = domains;
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
