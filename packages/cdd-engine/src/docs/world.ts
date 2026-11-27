// packages/cdd-engine/src/docs/world.ts
// The document world's PRODUCTION adapter: the repository as the judging engine reads it.
//
// INVARIANT — one scan, one answer set: the documents an identity scan indexed and the
// scan's own completeness fact come from the SAME pass, so a negative identity answer and
// the documents it was read from can never describe two different repositories. Every read
// here goes through an injected face (the listing and the text read `env/` publishes), so
// this file carries no `node:fs`: a judgment is reproducible over a fabricated repository
// exactly as over the one on disk.
//
// `Documents#judge` refuses with `no-world` when no world is injected, and the reader-only
// default indexes nothing, so the `checked:` face cannot be compared byte for byte without
// this adapter. The two cells it answers that the default cannot:
//   · `documents()` — the slug and the recognized `doc-type:` of every readable candidate,
//     which is what the slug rules, the chain rules and the closure reading walk;
//   · `complete()` — whether the scan DISCARDED a candidate (one that could not be read, or
//     one that declares no recognized `doc-type:`). An incomplete scan cannot answer an
//     absence, so the chain's "no identity document" arm stays silent over it.
//
// `exists` is derived from the same listing read, and `list` IS that read: neither opens a
// second opinion about which names the directory holds.
//
// Module-level exports are the reads type and the class — zero behaviour-carrying bare
// functions.

import type { RepoPath } from "../env/paths/root.ts";
import type { DirectoryListing } from "../env/paths/slug-index.ts";
import { frontmatterOf } from "./grammar/frontmatter.ts";
import { DOC_TYPE_VALUES } from "./identity/types.ts";
import type { DocRootPaths, DocumentWorld, IndexedDocument } from "./judging/closure.ts";

/** The faces this adapter reads the repository through — `env/` supplies all three. */
export interface DocWorldReads {
  /** The three doc roots the scan walks, repo-relative. */
  readonly docs: DocRootPaths;
  /** The one directory enumeration. */
  readonly listing: DirectoryListing;
  /** One repo-relative file's text, or null when it cannot be read. */
  readonly readText: (rel: RepoPath) => string | null;
}

/** One candidate's declared head, read without throwing: an unparseable front matter is a
 *  candidate the scan cannot read, never a crash inside a judgment. */
const headOf = (
  text: string,
): { readonly slug: string | null; readonly docType: string | null } => {
  try {
    const { head } = frontmatterOf(text);
    return { slug: head.slug, docType: head.docType };
  } catch {
    return { slug: null, docType: null };
  }
};

/**
 * DocWorld — the repository as the judging engine reads it. Invariant: one scan answers the
 * document set AND its completeness fact (see the file's header).
 */
export class DocWorld implements DocumentWorld {
  readonly #documents: readonly IndexedDocument[];
  readonly #roots: DocRootPaths;
  readonly #listing: DirectoryListing;
  readonly #readText: (rel: RepoPath) => string | null;
  /** Candidates the scan discarded — unreadable, or declaring no recognized `doc-type:`. */
  readonly #discarded: number;

  constructor(reads: DocWorldReads) {
    this.#roots = reads.docs;
    this.#listing = reads.listing;
    this.#readText = reads.readText;
    const scan = this.#scan();
    this.#documents = scan.documents;
    this.#discarded = scan.discarded;
  }

  /** Every indexed document, in path order. */
  documents(): readonly IndexedDocument[] {
    return this.#documents;
  }

  /** One document's text, or null when it cannot be read. */
  read(rel: RepoPath): string | null {
    return this.#readText(rel);
  }

  /** Whether a repo-relative target names an entry of its own directory. Derived from the
   *  listing read, so this probe opens no second file: the same names the scan walked are
   *  the names an existence answer comes from. */
  exists(rel: RepoPath): boolean {
    const segments = rel.split("/");
    const name = segments.pop() ?? "";
    if (name.length === 0) return false;
    const directory = segments.join("/");
    return this.#names(directory as RepoPath).includes(name);
  }

  /** The entry names of one repo-relative directory; [] when it holds none. */
  list(directory: RepoPath): readonly string[] {
    return this.#names(directory);
  }

  /** The three doc roots this scan walked. */
  roots(): DocRootPaths {
    return this.#roots;
  }

  /** Whether the scan that produced `documents()` discarded nothing — the fact a negative
   *  identity answer depends on. */
  complete(): boolean {
    return this.#discarded === 0;
  }

  /** ONE pass over the three doc roots: every `*.md` candidate's declared slug and
   *  `doc-type:`, plus the count of candidates the pass could not index. */
  #scan(): { readonly documents: readonly IndexedDocument[]; readonly discarded: number } {
    const documents: IndexedDocument[] = [];
    let discarded = 0;
    for (const root of [this.#roots.overalls, this.#roots.specs, this.#roots.plans]) {
      for (const name of this.#names(root)) {
        if (!name.endsWith(".md")) continue;
        const rel = `${root}/${name}` as RepoPath;
        const text = this.#readText(rel);
        if (text === null) {
          discarded += 1;
          continue;
        }
        const head = headOf(text);
        if (
          head.docType === null ||
          !(DOC_TYPE_VALUES as readonly string[]).includes(head.docType)
        ) {
          discarded += 1;
          continue;
        }
        if (head.slug === null || head.slug.length === 0) continue;
        documents.push({ rel, slug: head.slug, docType: head.docType });
      }
    }
    return {
      documents: documents.sort((left, right) => (left.rel < right.rel ? -1 : 1)),
      discarded,
    };
  }

  /** One directory's entry names, through the injected listing (a nonexistent directory is
   *  the listing's own empty answer). */
  #names(directory: RepoPath): readonly string[] {
    return directory === "" ? [] : this.#listing.names(directory);
  }
}
