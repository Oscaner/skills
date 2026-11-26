// packages/cdd-engine/src/docs/judging/closure.ts
// The document index and the PROVEN-closure reading over it.
//
//   `DocumentWorld`  — the text-only seam the judging engine reads the repository through:
//                      the documents an identity scan indexed, one read face, an existence
//                      probe, one directory listing and the three doc roots. It carries no
//                      filesystem: `docs/` owns no descriptor, so a judgment reproduces over
//                      a fabricated repository exactly as over the one on disk.
//   `DocumentIndex`  — the slug → document relation read off that seam, plus the two reads
//                      the chain rules ask it (an overall by program slug, whether ANY
//                      identity document carries a slug). It answers a SET and never picks.
//   `ClosedDocument` — the one POSITIVE closure reading: a charter's `## Phase inventory`
//                      rows name a file in two cells (`Design spec` · `Implementation
//                      plan`), and a phase spec and its plan are two faces of ONE
//                      registration. A cell's file name is resolved against the indexed
//                      documents' basenames, and only a UNIQUE hit on the judged document
//                      proves closure: zero hits and several hits prove nothing, because a
//                      registration that no longer identifies one document cannot establish
//                      that anything is closed.
//
// The polarity is deliberate and is the opposite of the retired pin face's `#closedBy`
// (which read zero / several hits as CLOSED so a dead `✔ Done` row could not buy a silent
// skip). The shape gate never inherits that tolerance: it closes only on positive
// identification.
//
// Module-level exports are the types, the two path-fact readers and the two classes — zero
// behaviour-carrying bare functions.

import path from "node:path";
import type { RepoPath } from "../../env/paths/root.ts";
import { frontmatterOf } from "../grammar/frontmatter.ts";
import { MarkdownTree } from "../grammar/markdown-tree.ts";
import { type ChainPhase, docTypeParsers, type OverallParsed } from "../identity/doc-parse.ts";
import { PathShape } from "./shape-rules.ts";

/** One document an identity scan indexed: the coordinate, its declared `slug:` and its
 *  declared `doc-type:` ("" when it declares none). A document with no declared slug is
 *  not indexed — identity is the declared value, never the file name. */
export interface IndexedDocument {
  /** The repo-relative coordinate. */
  readonly rel: RepoPath;
  /** The declared slug. */
  readonly slug: string;
  /** The declared `doc-type:` value, "" when the document declares none. */
  readonly docType: string;
}

/** The three program-document directories, repo-relative — the document world's own path
 *  fact, so a judgment's message names the same roots the index scanned. */
export interface DocRootPaths {
  readonly overalls: RepoPath;
  readonly specs: RepoPath;
  readonly plans: RepoPath;
}

/**
 * DocumentWorld — the repository as the judging engine reads it. Invariant: every answer is
 * a text read of an already-resolved coordinate, so a judgment can never reach the
 * filesystem on its own.
 */
export interface DocumentWorld {
  /** Every indexed document, in path order. */
  documents(): readonly IndexedDocument[];
  /** One document's text, or null when it is unreadable. */
  read(rel: RepoPath): string | null;
  /** Whether a repo-relative target names a readable file. */
  exists(rel: RepoPath): boolean;
  /** The entry names of one repo-relative directory; [] when it holds none. */
  list(directory: RepoPath): readonly string[];
  /** The three doc roots the index scans, by key. */
  roots(): DocRootPaths;
}

/** The document types that identify a program — every declared type except a plan, whose
 *  chain is the identity document sharing its slug. */
const IDENTITY_DOC_TYPES: ReadonlySet<string> = new Set(["overall", "phase-spec", "single-spec"]);

/** The namespace a repo-root form is written under (`docs/kairos`) — the common parent of
 *  the spec root, derived from the injected doc roots rather than a second literal. */
export const docNamespaceOf = (roots: DocRootPaths): string =>
  path.posix.dirname(PathShape.normalize(roots.specs));

/** The `<segments>` form a sibling-scan message names (`overalls/specs/plans`) — the doc
 *  roots' own base names, never a hand-written copy of them. */
export const docRootNamesOf = (roots: DocRootPaths): string =>
  [roots.overalls, roots.specs, roots.plans]
    .map((root) => path.posix.basename(PathShape.normalize(root)))
    .join("/");

/**
 * DocumentIndex — the slug → document relation over one identity scan. Invariant: a slug
 * answers a SET, and a caller that needs one document asks for the class it wants; nothing
 * here picks a first match on the caller's behalf.
 */
export class DocumentIndex {
  readonly #documents: readonly IndexedDocument[];

  constructor(documents: readonly IndexedDocument[]) {
    this.#documents = [...documents];
  }

  /** Every indexed document, in the scan's order. */
  documents(): readonly IndexedDocument[] {
    return this.#documents;
  }

  /** Every document declaring one slug — 0, 1 or n. */
  withSlug(slug: string): readonly IndexedDocument[] {
    return this.#documents.filter((entry) => entry.slug === slug);
  }

  /** Whether ANY identity document declares the slug — an identity question, never a first
   *  pick: two of them are the duplicate-identity judgment's, so the chain never claims
   *  "no identity document" over an ambiguous set. */
  hasIdentity(slug: string): boolean {
    return this.withSlug(slug).some((entry) => IDENTITY_DOC_TYPES.has(entry.docType));
  }

  /** The overall document declaring one program slug, or null. */
  overallOf(slug: string): IndexedDocument | null {
    return this.withSlug(slug).find((entry) => entry.docType === "overall") ?? null;
  }
}

/** One charter's parsed Phase-inventory rows — the document plus the cells its rows name,
 *  read once per closure scan. */
interface CharterRows {
  readonly rel: RepoPath;
  readonly phases: readonly ChainPhase[];
}

/** The `✔ Done（`file` · date）` grammar — the registration form both named cells of a
 *  Phase-inventory row write, read here ONCE so a later change to the form moves one regex
 *  rather than two readers. */
const DONE_CELL = /✔ Done（`(?<file>[^`]+)`/;

/**
 * ClosedDocument — the closure reading over one index. Invariant: the answer is PROVEN
 * closure only — a unique identification of the judged document by a phase registration's
 * named cell — so no absent or ambiguous cell ever exempts a document from a shape rule.
 */
export class ClosedDocument {
  readonly #index: DocumentIndex;
  readonly #read: (rel: RepoPath) => string | null;
  #charters: readonly CharterRows[] | null = null;

  /** `read` is the world's text face, not a filesystem: the charter parse reads the same
   *  seam every other judgment reads. */
  constructor(opts: { index: DocumentIndex; read: (rel: RepoPath) => string | null }) {
    this.#index = opts.index;
    this.#read = opts.read;
  }

  /** Whether the judged document is PROVEN closed by a phase inventory's named cells.
   *  `rel` is the judged document's repo-relative path; a cell's file name is compared
   *  against the indexed documents' basenames, and a cell that resolves to zero or several
   *  documents proves nothing. */
  closed(rel: RepoPath): boolean {
    // The one path normalization of the rule plane, not a second spelling of it: the judged
    // path and every indexed entry meet on the same form, so two writings of one location
    // never read as two locations.
    const judged = PathShape.normalize(rel);
    for (const charter of this.#chartersOf()) {
      for (const phase of charter.phases) {
        const cells = [phase.designCell, phase.planCell];
        if (cells.some((cell) => this.#namesDoc(ClosedDocument.fileOf(cell), judged))) return true;
      }
    }
    return false;
  }

  /** The file name one `✔ Done（`file` · date）` cell writes, or null when the cell is not
   *  a registration at all (`[Pending]`, a bare scope note). The ONE spelling of the
   *  registration grammar: the closure reading above is its reader, so a change to the form
   *  moves one regex. */
  static fileOf(cell: string): string | null {
    return DONE_CELL.exec(cell)?.groups?.file ?? null;
  }

  /** Whether one cell's named file identifies the judged document — a UNIQUE hit whose
   *  `rel` IS the judged document. Zero hits and several hits prove nothing, which is the
   *  whole polarity: the shape gate closes only on positive identification. */
  #namesDoc(named: string | null, judged: string): boolean {
    if (named === null) return false;
    const hits = this.#index
      .documents()
      .filter((entry) => path.posix.basename(PathShape.normalize(entry.rel)) === named);
    const [only] = hits;
    return hits.length === 1 && only !== undefined && PathShape.normalize(only.rel) === judged;
  }

  /** Every charter's Phase-inventory rows, read once. A document that declares another
   *  type, or carries no such section, registers nothing; an unreadable one cannot prove
   *  anything and is skipped — this reader is a positive reading, never a qualification. */
  #chartersOf(): readonly CharterRows[] {
    if (this.#charters !== null) return this.#charters;
    const charters: CharterRows[] = [];
    for (const entry of this.#index.documents()) {
      if (entry.docType !== "overall") continue;
      const text = this.#read(entry.rel);
      if (text === null) continue;
      const phases = ClosedDocument.#phaseRowsOf(text);
      if (phases.length > 0) charters.push({ rel: entry.rel, phases });
    }
    this.#charters = charters;
    return this.#charters;
  }

  /** One charter's Phase-inventory rows, parsed through the registry's own overall parser —
   *  the tree holds no second table grammar. */
  static #phaseRowsOf(text: string): readonly ChainPhase[] {
    let body: string;
    let head: ReturnType<typeof frontmatterOf>["head"];
    try {
      const split = frontmatterOf(text);
      body = split.body;
      head = split.head;
    } catch {
      return [];
    }
    const parsed = docTypeParsers.overall.parse(MarkdownTree.parse(body), head) as OverallParsed;
    if (parsed.tables["Phase inventory"].headerRow === null) return [];
    return parsed.chain.phases;
  }
}
