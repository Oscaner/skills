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

/** The scan seam `SlugIndex.build` reads through — the identity index's two
 *  filesystem facts (list one directory's entries, read one document's content).
 *  The judgment plane injects its own `DocFs` seam (structurally compatible), so a
 *  contract judgment over an in-memory repository never touches the real disk;
 *  absent, the node:fs dirent scan is the production default. */
export interface SlugScanFs {
  /** The entry names of a directory, or [] when unreadable. */
  list(p: string): readonly string[];
  /** The UTF-8 content of a path, or null when unreadable. */
  read(p: string): string | null;
}

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

/** The role a `slug:`-carrying document plays in the identity model: the identity
 *  documents (overall / phase / single spec) and the plan — the two classes the
 *  uniqueness rule judges separately (spec §2.1). */
export type SlugRole = "identity" | "plan";

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
  static readonly #SLUG_PATTERN = new RegExp(SLUG_VALUE_PATTERN);

  /** Whether a raw `slug:` value is a legal identity value (spec §2.1) — the ONE
   *  spelling of the value judgment the board marker, the dispatch carrier and the
   *  pre-flight gate all read. Narrows a nullable raw value to a legal slug. */
  static isLegalSlug(value: string | null): value is string {
    return value !== null && SlugIndex.#SLUG_PATTERN.test(value);
  }

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
      if (!SlugIndex.isLegalSlug(entry.slug)) continue;
      const group = bySlug.get(entry.slug);
      if (group === undefined) bySlug.set(entry.slug, [entry]);
      else group.push(entry);
    }
    this.#byRel = byRel;
    this.#bySlug = bySlug;
    this.#violations = SlugIndex.#judge(entries, bySlug);
  }

  /** Scan both doc roots once and index every `.md` document under them. The
   *  optional `fs` is the caller's scan seam (the judgment plane's in-memory
   *  `DocFs`); absent, the node:fs dirent scan is the production default. */
  static build(repoRoot: string, fs?: SlugScanFs): SlugIndex {
    const entries = [
      ...SlugIndex.#scanRoot(repoRoot, ENGINE_RUNTIME.docRoots.specs, fs),
      ...SlugIndex.#scanRoot(repoRoot, ENGINE_RUNTIME.docRoots.plans, fs),
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

  /** The phase-spec documents whose `program:` names the program slug, in program
   *  order: the slugs' `-p<major>[.<minor>…]` tail numerically (p2 before p10,
   *  `p4.1` after `p4`), then the slugs without that tail in rel order. */
  phaseSpecsOf(programSlug: string): readonly DocEntry[] {
    return this.entries
      .filter((entry) => entry.docType === "phase-spec" && entry.program === programSlug)
      .sort(SlugIndex.#phaseCompare);
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

  /** The duplicate roles the slug carries in this scan — empty when the slug is
   *  unique, `identity` when a second identity document declares it, `plan` when a
   *  second plan does (spec §2.1's uniqueness rule). The ONE duplicate judgment the
   *  board's row marker, the dispatch carrier and the pre-flight gate share. */
  duplicatedRolesOf(slug: string): readonly SlugRole[] {
    const roles: SlugRole[] = [];
    for (const violation of this.#violations) {
      if (violation.slug !== slug) continue;
      const role =
        violation.kind === "duplicate-identity"
          ? "identity"
          : violation.kind === "duplicate-plan"
            ? "plan"
            : null;
      if (role !== null && !roles.includes(role)) roles.push(role);
    }
    return roles;
  }

  /** The phase ordinal a slug carries in its `-p<major>[.<minor>…]` tail — the
   *  numeric segments in order, or null when the slug carries no such tail. The
   *  segment is read off the IDENTITY value (never the file name). */
  static #phaseOrdinal(slug: string | null): readonly number[] | null {
    if (slug === null) return null;
    const match = /-p(\d+(?:\.\d+)*)$/.exec(slug);
    return match === null ? null : match[1]!.split(".").map(Number);
  }

  /** Program order for phase rows: numbered slugs numerically (p2 before p10,
   *  `p4.1` after `p4`), then the unnumbered ones; rel path is the final tie-break
   *  so the order stays deterministic over one scan. */
  static #phaseCompare(left: DocEntry, right: DocEntry): number {
    const leftOrdinal = SlugIndex.#phaseOrdinal(left.slug);
    const rightOrdinal = SlugIndex.#phaseOrdinal(right.slug);
    if (leftOrdinal !== null && rightOrdinal !== null) {
      const width = Math.max(leftOrdinal.length, rightOrdinal.length);
      for (let index = 0; index < width; index++) {
        const delta = (leftOrdinal[index] ?? 0) - (rightOrdinal[index] ?? 0);
        if (delta !== 0) return delta;
      }
    } else if (leftOrdinal !== null) {
      return -1;
    } else if (rightOrdinal !== null) {
      return 1;
    }
    return left.rel < right.rel ? -1 : left.rel > right.rel ? 1 : 0;
  }

  /** Scan one doc root — the ONE `readdirSync` call site (the injected seam's
   *  `list` otherwise). A missing root indexes nothing (ENOENT only: a permission
   *  or shape failure of an existing root is a real break and rethrows); a
   *  non-regular or non-`.md` entry is not a document. */
  static #scanRoot(repoRoot: string, root: string, fs?: SlugScanFs): DocEntry[] {
    const entries: DocEntry[] = [];
    for (const name of SlugIndex.#entryNames(path.join(repoRoot, root), fs)) {
      if (!name.endsWith(".md")) continue;
      const rel = path.join(root, name);
      const abs = path.join(repoRoot, rel);
      const content = fs === undefined ? readFileSync(abs, "utf8") : fs.read(abs);
      if (content === null) continue;
      const { head } = FrontMatterExtractor.split(content);
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

  /** The regular-file names of one doc root — the dirent scan (the production
   *  default) or the injected seam's flat entry list. A non-regular entry is never
   *  a document, so the injected form's names are filtered through the same
   *  existence-shaped reading: a name whose content is unreadable is skipped by the
   *  caller (the `read === null` leg). */
  static #entryNames(root: string, fs?: SlugScanFs): readonly string[] {
    if (fs !== undefined) return fs.list(root);
    let dirents: Dirent[];
    try {
      dirents = readdirSync(root, { withFileTypes: true });
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw err;
    }
    return dirents.filter((dirent) => dirent.isFile()).map((dirent) => dirent.name);
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
        });
      } else if (!SlugIndex.isLegalSlug(entry.slug)) {
        violations.push({
          kind: "invalid-slug",
          rel: entry.rel,
          slug: entry.slug,
          program: entry.program,
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
        });
      }
      const plans = group.filter((entry) => entry.docType === "plan");
      for (const duplicate of plans.slice(1)) {
        violations.push({
          kind: "duplicate-plan",
          rel: duplicate.rel,
          slug,
          program: duplicate.program,
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
      });
    }
    return violations;
  }
}
