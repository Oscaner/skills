// packages/cdd-engine/src/env/paths/slug-index.ts
// The slug index: the slug → document-path relation of the doc roots, built from a
// caller-supplied reading of one document's declared slug.
//
// The index is a PATH-surface relation, not a document judgment: what a slug IS
// belongs to `docs/`. So the scan lists the doc roots and hands each candidate's
// text to an injected `slugOf` reader; `env/` never parses front matter.
//
// The index answers a SET and never picks a first: one declaration is a path, two or
// more declarations are `invalid` — an ambiguous identity must not silently resolve
// to whichever file the directory listing happened to return first.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { DOC_ROOT_KEYS, type DocRoots } from "./doc-roots.ts";
import type { RepoPath, RepoRoot } from "./root.ts";

/**
 * The one directory read the scan needs: the entry names directly inside one repo-relative
 * directory. Injected, so "which documents exist" has ONE spelling in `env/` — the scan, the
 * document world's listing and the ledger's workspace names all read through it, and none of
 * them opens a directory of its own.
 */
export interface DirectoryListing {
  /** The entry names directly inside one repo-relative directory; [] when it holds none. */
  names(directory: RepoPath): readonly string[];
}

/** The node-backed listing — the engine's ONE directory enumeration, over ONE path basis.
 *  The basis is the constructor's because the interface speaks repo-relative coordinates: a
 *  raw `readdir` of a relative path would answer against the process' working directory, which
 *  is the repository root only when the engine happens to be invoked from it. */
export class NodeDirectoryListing implements DirectoryListing {
  readonly #root: RepoRoot;

  constructor(root: RepoRoot) {
    this.#root = root;
  }

  /** The entry names under one repo-relative directory, unsorted as the OS answers them. A
   *  directory that does not exist holds nothing; any other failure rethrows, because an
   *  unreadable root is never an empty one. */
  names(directory: RepoPath): readonly string[] {
    try {
      return readdirSync(this.#root.resolve(directory));
    } catch (raw) {
      if ((raw as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw raw;
    }
  }
}

/** A slug's answer over one scan — exactly one document, an ambiguous set, or none. */
export type SlugEntry =
  | { readonly kind: "unique"; readonly slug: string; readonly rel: RepoPath }
  | { readonly kind: "invalid"; readonly slug: string; readonly rels: readonly RepoPath[] }
  | { readonly kind: "absent"; readonly slug: string };

/** The one reading the scan needs from the document world: a document's declared
 *  slug, or null when it declares none. */
export type SlugReader = (text: string) => string | null;

/**
 * SlugIndex — the slug → path relation over the doc roots. Invariant: a slug answers
 * a unique path only while exactly one document declares it; a second declaration
 * makes the slug `invalid` rather than choosing. Immutable after construction.
 */
export class SlugIndex {
  readonly #bySlug: ReadonlyMap<string, readonly RepoPath[]>;

  private constructor(bySlug: ReadonlyMap<string, readonly RepoPath[]>) {
    this.#bySlug = bySlug;
  }

  /** Scan the doc roots once. A missing root is empty; a candidate that reads but
   *  declares no slug is not indexed (identity is the declared value, never the file
   *  name). Rows come back in path order, so one scan reads the same twice. The directory
   *  read is the injected listing — this class never enumerates a directory itself. */
  static scan(
    root: RepoRoot,
    docs: DocRoots,
    slugOf: SlugReader,
    listing: DirectoryListing,
  ): SlugIndex {
    const bySlug = new Map<string, RepoPath[]>();
    for (const key of DOC_ROOT_KEYS) {
      const rel = docs.at(key);
      for (const name of listing.names(rel)) {
        if (!name.endsWith(".md")) continue;
        const docRel = `${rel}/${name}` as RepoPath;
        const text = SlugIndex.#read(root.resolve(docRel));
        if (text === null) continue;
        const slug = slugOf(text);
        if (slug === null || slug.length === 0) continue;
        const group = bySlug.get(slug);
        if (group === undefined) bySlug.set(slug, [docRel]);
        else group.push(docRel);
      }
    }
    for (const group of bySlug.values()) group.sort();
    return new SlugIndex(bySlug);
  }

  /** Every indexed slug, sorted — the scan's own surface. */
  slugs(): readonly string[] {
    return [...this.#bySlug.keys()].sort();
  }

  /** One slug's answer: its single path, its ambiguous set, or absence. */
  lookup(slug: string): SlugEntry {
    const rels = this.#bySlug.get(slug);
    if (rels === undefined) return { kind: "absent", slug };
    if (rels.length === 1) return { kind: "unique", slug, rel: rels[0]! };
    return { kind: "invalid", slug, rels };
  }

  /** One candidate's text, or null when it is not a readable regular file — a
   *  directory or a broken symlink named `*.md` is not a document. */
  static #read(absolute: string): string | null {
    try {
      return statSync(absolute).isFile() ? readFileSync(absolute, "utf8") : null;
    } catch {
      return null;
    }
  }
}
