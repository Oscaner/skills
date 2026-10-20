// packages/cdd-engine/src-next/infra/slug-index.ts
// The identity index (spec §2.1/§2.2): ONE scan over the two doc roots
// (`ENGINE_RUNTIME.docRoots`) groups every document by its front-matter facts.
// The index is the single judgment surface for document identity:
//   · lookups — `identityDoc` / `planOf` / `phaseSpecsOf` / `overallOf` / `entryAt`;
//   · violations — duplicate identity document · duplicate plan · missing `slug:` ·
//     illegal `slug:` value · `program:` target with no overall document.
// Identity is the `slug:` value, never the file name; a document's class is its
// declared `doc-type:`, never the directory it happens to live in. Both the board
// and the dispatch pre-flight read THIS judgment — zero second implementation.
//
// One `readdirSync` call site (`#scanRoot`, invoked once per doc root), one head
// read per document, zero filename derivation, zero `existsSync` path guessing.
// Module-level exports are types / the class — zero behavior-carrying bare
// functions (the plan's zero-bare-function discipline).

import { type Dirent, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { SLUG_VALUE_PATTERN } from "../contract/declare.ts";
import { FrontMatterExtractor } from "../contract/frontmatter.ts";
import { DOC_KEYS, type DocKey } from "../contract/project.ts";
import { ENGINE_RUNTIME } from "./runtime.ts";

/** One indexed document — the front-matter identity facts plus its two path forms. */
export interface DocEntry {
  /** The absolute on-disk path (the syscall form). */
  readonly path: string;
  /** The repo-root-relative path (the identity the callers pass to `entryAt`). */
  readonly rel: string;
  /** The declared `doc-type:` — null when absent or outside the declared domain. */
  readonly docType: DocKey | null;
  /** The declared `slug:` — null when absent. */
  readonly slug: string | null;
  /** The declared `program:` slug reference — null when absent (only phase-specs carry one). */
  readonly program: string | null;
  /** The declared `version:` token. */
  readonly version: string | null;
  /** The declared `status:` literal. */
  readonly status: string | null;
  /** The declared `title:` line. */
  readonly title: string | null;
}

/** The five identity violation kinds (spec §2.1/§2.2) — the closed judgment set. */
export type SlugViolationKind =
  | "duplicate-identity"
  | "duplicate-plan"
  | "missing-slug"
  | "invalid-slug"
  | "missing-program-target";

/** One identity violation — the offending document plus the fact that broke. */
export interface SlugViolation {
  /** The violation class. */
  readonly kind: SlugViolationKind;
  /** The offending document's repo-root-relative path. */
  readonly rel: string;
  /** The document's own `slug:` (null for a missing slug, the raw value for an illegal one). */
  readonly slug: string | null;
  /** The document's `program:` reference (null when it carries none). */
  readonly program: string | null;
  /** The one-line human-facing reason. */
  readonly message: string;
}

/**
 * SlugIndex — the identity index over the two doc roots. Construct it through
 * `build` (the one scanning entry point); every lookup and the violation list
 * read the single materialized scan.
 */
export class SlugIndex {
  /** The legal `slug:` value form (spec §2.1): 1–128 characters, an alphanumeric
   *  first character, then alphanumerics / `.` / `_` / `-`. The slug doubles as a
   *  workspace directory name, so path separators and whitespace are rejected at
   *  the value surface. Compiled from the registry declaration's own source string
   *  (`SLUG_VALUE_PATTERN`) — one grammar, zero second spelling. */
  static readonly SLUG_PATTERN = new RegExp(SLUG_VALUE_PATTERN);

  /** Every indexed document, ordered by repo-relative path. */
  readonly entries: readonly DocEntry[];
  /** The rel → entry lookup. */
  readonly #byRel: ReadonlyMap<string, DocEntry>;
  /** The valid-slug → entries lookup (an illegal value never groups). */
  readonly #bySlug: ReadonlyMap<string, readonly DocEntry[]>;
  /** The materialized judgment over this scan. */
  readonly #violations: readonly SlugViolation[];

  private constructor(entries: readonly DocEntry[]) {
    this.entries = entries;
    const byRel = new Map<string, DocEntry>();
    const bySlug = new Map<string, DocEntry[]>();
    for (const entry of entries) {
      byRel.set(entry.rel, entry);
      if (entry.slug === null || !SlugIndex.SLUG_PATTERN.test(entry.slug)) continue;
      const group = bySlug.get(entry.slug);
      if (group === undefined) bySlug.set(entry.slug, [entry]);
      else group.push(entry);
    }
    this.#byRel = byRel;
    this.#bySlug = bySlug;
    this.#violations = SlugIndex.#judge(entries, bySlug);
  }

  /** Scan both doc roots once and index every `.md` document under them. */
  static build(repoRoot: string): SlugIndex {
    const entries = [
      ...SlugIndex.#scanRoot(repoRoot, ENGINE_RUNTIME.docRoots.specs),
      ...SlugIndex.#scanRoot(repoRoot, ENGINE_RUNTIME.docRoots.plans),
    ].sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));
    return new SlugIndex(entries);
  }

  /** The entry at one repo-root-relative path, or null when the path is not indexed. */
  entryAt(rel: string): DocEntry | null {
    return this.#byRel.get(rel) ?? null;
  }

  /** The identity document (overall-spec / phase-spec / single-spec) carrying the
   *  slug, or null when no identity document does. */
  identityDoc(slug: string): DocEntry | null {
    for (const entry of this.#bySlug.get(slug) ?? []) {
      if (SlugIndex.#isIdentity(entry)) return entry;
    }
    return null;
  }

  /** The plan document carrying the slug, or null when no plan does. */
  planOf(slug: string): DocEntry | null {
    for (const entry of this.#bySlug.get(slug) ?? []) {
      if (entry.docType === "plan") return entry;
    }
    return null;
  }

  /** The phase-spec documents whose `program:` names the program slug, in rel order. */
  phaseSpecsOf(programSlug: string): readonly DocEntry[] {
    return this.entries.filter(
      (entry) => entry.docType === "phase-spec" && entry.program === programSlug,
    );
  }

  /** The overall-spec document carrying the program slug, or null. */
  overallOf(programSlug: string): DocEntry | null {
    for (const entry of this.#bySlug.get(programSlug) ?? []) {
      if (entry.docType === "overall-spec") return entry;
    }
    return null;
  }

  /** The materialized violation list (deterministic over the rel-ordered scan). */
  violations(): readonly SlugViolation[] {
    return this.#violations;
  }

  /** Scan one doc root — the ONE `readdirSync` call site. A missing root indexes
   *  nothing (ENOENT only: a permission or shape failure of an existing root is a
   *  real break and rethrows); a non-regular or non-`.md` entry is not a document. */
  static #scanRoot(repoRoot: string, root: string): DocEntry[] {
    let dirents: Dirent[];
    try {
      dirents = readdirSync(path.join(repoRoot, root), { withFileTypes: true });
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw err;
    }
    const entries: DocEntry[] = [];
    for (const dirent of dirents) {
      const name = dirent.name;
      if (!dirent.isFile() || !name.endsWith(".md")) continue;
      const rel = path.join(root, name);
      const abs = path.join(repoRoot, rel);
      const { head } = FrontMatterExtractor.split(readFileSync(abs, "utf8"));
      entries.push({
        path: abs,
        rel,
        docType: SlugIndex.#docTypeOf(head.docType),
        slug: head.slug,
        program: head.program,
        version: head.version,
        status: head.status,
        title: head.title,
      });
    }
    return entries;
  }

  /** Narrow a raw `doc-type:` value to the declared domain (the ONE `DOC_KEYS`
   *  declaration) — anything else reads null. */
  static #docTypeOf(raw: string | null): DocKey | null {
    if (raw === null) return null;
    return (DOC_KEYS as readonly string[]).includes(raw) ? (raw as DocKey) : null;
  }

  /** An identity document is any declared spec class — every key except `plan`. */
  static #isIdentity(entry: DocEntry): boolean {
    return entry.docType !== null && entry.docType !== "plan";
  }

  /** Materialize the five violation classes over the scan and its slug groups. */
  static #judge(
    entries: readonly DocEntry[],
    bySlug: ReadonlyMap<string, readonly DocEntry[]>,
  ): SlugViolation[] {
    const violations: SlugViolation[] = [];
    for (const entry of entries) {
      if (entry.slug === null) {
        violations.push({
          kind: "missing-slug",
          rel: entry.rel,
          slug: null,
          program: entry.program,
          message: `missing slug: in ${entry.rel}`,
        });
      } else if (!SlugIndex.SLUG_PATTERN.test(entry.slug)) {
        violations.push({
          kind: "invalid-slug",
          rel: entry.rel,
          slug: entry.slug,
          program: entry.program,
          message: `invalid slug value "${entry.slug}" in ${entry.rel}`,
        });
      }
    }
    for (const [slug, group] of bySlug) {
      const identities = group.filter((entry) => SlugIndex.#isIdentity(entry));
      for (const duplicate of identities.slice(1)) {
        violations.push({
          kind: "duplicate-identity",
          rel: duplicate.rel,
          slug,
          program: duplicate.program,
          message: `duplicate identity document for slug "${slug}" (first: ${identities[0]?.rel})`,
        });
      }
      const plans = group.filter((entry) => entry.docType === "plan");
      for (const duplicate of plans.slice(1)) {
        violations.push({
          kind: "duplicate-plan",
          rel: duplicate.rel,
          slug,
          program: duplicate.program,
          message: `duplicate plan document for slug "${slug}" (first: ${plans[0]?.rel})`,
        });
      }
    }
    const overallSlugs = new Set<string>();
    for (const entry of entries) {
      if (entry.docType === "overall-spec" && entry.slug !== null) overallSlugs.add(entry.slug);
    }
    for (const entry of entries) {
      if (entry.docType !== "phase-spec" || entry.program === null) continue;
      if (overallSlugs.has(entry.program)) continue;
      violations.push({
        kind: "missing-program-target",
        rel: entry.rel,
        slug: entry.slug,
        program: entry.program,
        message: `program "${entry.program}" has no overall document (${entry.rel})`,
      });
    }
    return violations;
  }
}
