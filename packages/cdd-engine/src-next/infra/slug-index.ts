// packages/cdd-engine/src-next/infra/slug-index.ts
// The identity index (spec §2.1/§2.2): ONE scan over the doc roots
// (`ENGINE_RUNTIME.docRoots`) groups every document by its front-matter facts.
// The index is the single judgment surface for document identity:
//   · lookups — `docsOf` / `hasIdentity` / `phaseSpecsOf` / `overallOf` / `entryAt`;
//     the slug lookups answer the SET (0 / 1 / n) and never pick a first: ambiguity is
//     the read face's judgment, not the index's choice;
//   · violations — duplicate identity document · duplicate plan · missing `slug:` ·
//     illegal `slug:` value · `program:` target with no overall document.
// Identity is the `slug:` value, never the file name; a document's class is its
// declared `doc-type:`, never the directory it happens to live in. Both the board
// and the dispatch pre-flight read THIS judgment — zero second implementation.
//
// One directory listing per doc root (`#entryNames`) plus one content read per
// candidate (`#readDoc`) — the ONE document predicate both scan legs share: a
// `*.md` name whose content reads is a document, whatever produced the name list.
// Zero filename derivation, zero `existsSync` path guessing.
// Module-level exports are types / the class — zero behavior-carrying bare
// functions (the plan's zero-bare-function discipline).

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { SLUG_VALUE_PATTERN } from "../contract/declare.ts";
import { FrontMatterExtractor } from "../contract/frontmatter.ts";
import { DOC_KEYS, type DocKey } from "../contract/project.ts";
import { ENGINE_RUNTIME } from "./runtime.ts";

/** The scan seam `SlugIndex.build` reads through — the identity index's two
 *  filesystem facts (list one directory's entries, read one document's content).
 *  The judgment plane injects its own `DocFs` seam (structurally compatible), so a
 *  contract judgment over an in-memory repository never touches the real disk;
 *  absent, the node:fs scan is the production default. */
export interface SlugScanFs {
  /** The entry names of a directory; [] when it does not exist (ENOENT). Any other
   *  failure is a real break and rethrows — an unreadable root never indexes as an
   *  empty one. */
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
  /** The residual `status:` head key — no registry declares it any more; carried
   *  so an existing document degrades to a shorter line instead of erroring. */
  readonly status: string | null;
  /** The declared `title:` line. */
  readonly title: string | null;
}

/** One doc root's DISCARDED candidates — the scan's dirty surface (spec §2.7). The
 *  scan silently drops a candidate whose bytes do not read ("an unreadable candidate
 *  is not a document") and indexes a candidate that reads but declares no registered
 *  `doc-type:`. Both facts are counted per ROOT, because "the index holds nothing"
 *  and "the disk held nothing" are different facts: a non-zero count means the root
 *  cannot answer an absence. */
export interface RootDiscard {
  /** Candidates whose content did not read (permissions, a directory named `*.md`, a
   *  broken symlink). */
  readonly unreadable: number;
  /** Candidates that read but declared no `doc-type:` in the registry's set — they are
   *  indexed (a slug still answers) but they are no identity document. */
  readonly unregistered: number;
}

/** The three doc roots' discarded counts, one pair each — the six values the plan
 *  read's tri-state and the cross-doc chain read (spec §2.7). */
export interface DiscardedCandidates {
  readonly overalls: RootDiscard;
  readonly specs: RootDiscard;
  readonly plans: RootDiscard;
}

/** The doc roots in scan order — the ONE order `build` scans and `discarded` reports. */
const DOC_ROOT_KEYS = ["overalls", "specs", "plans"] as const;

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

/** The identity gate's verdict for one document (spec §2.1): the declared `slug:`
 *  is present, legal, indexed and unique — otherwise the violating fact. */
export type SlugVerdict =
  | { readonly kind: "accepted"; readonly slug: string }
  | { readonly kind: "missing" }
  | { readonly kind: "illegal"; readonly slug: string }
  | { readonly kind: "duplicated"; readonly slug: string };

/** The refused half of `SlugVerdict` — the gate's three refusal kinds (every kind
 *  a carrier renders as the matching word row). */
export type SlugRefusal = Exclude<SlugVerdict, { kind: "accepted" }>;

/**
 * SlugIndex — the identity index over the doc roots. Construct it through
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

  /** Whether a repo-relative path lies inside any doc root — pure path
   *  grammar, zero document reads. The board's not-found face uses this (plus an
   *  existence probe) to refuse an outside-root or absent path BEFORE the identity
   *  scan opens a single document (spec §3.1). */
  static insideDocRoots(rel: string): boolean {
    const normalized = path.normalize(rel);
    return Object.values(ENGINE_RUNTIME.docRoots).some((root) => {
      const prefix = path.normalize(root);
      return normalized === prefix || normalized.startsWith(`${prefix}${path.sep}`);
    });
  }

  /** Every indexed document, ordered by repo-relative path. */
  readonly entries: readonly DocEntry[];
  /** The rel → entry lookup. */
  readonly #byRel: ReadonlyMap<string, DocEntry>;
  /** The valid-slug → entries lookup (an illegal value never groups). */
  readonly #bySlug: ReadonlyMap<string, readonly DocEntry[]>;
  /** The materialized judgment over this scan. */
  readonly #violations: readonly SlugViolation[];
  /** The per-root discarded candidates, produced by the SAME scan as `entries`. */
  readonly #discarded: DiscardedCandidates;

  private constructor(entries: readonly DocEntry[], discarded: DiscardedCandidates) {
    this.entries = entries;
    this.#discarded = discarded;
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

  /** Scan every doc root once and index every `.md` document under them. The
   *  optional `fs` is the caller's scan seam (the judgment plane's in-memory
   *  `DocFs`); absent, the node:fs scan is the production default. */
  static build(repoRoot: string, fs?: SlugScanFs): SlugIndex {
    const scanned = DOC_ROOT_KEYS.map((key) =>
      SlugIndex.#scanRoot(repoRoot, ENGINE_RUNTIME.docRoots[key], fs),
    );
    const entries = scanned
      .flatMap((root) => root.entries)
      .sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));
    return new SlugIndex(entries, {
      overalls: scanned[0]!.discard,
      specs: scanned[1]!.discard,
      plans: scanned[2]!.discard,
    });
  }

  /** The candidates each doc root dropped or indexed without a registered doc type —
   *  the fact "this root cannot answer an absence" (spec §2.7). Produced by the same
   *  scan as `entries`, so a read that asks both never sees two snapshots. */
  discarded(): DiscardedCandidates {
    return this.#discarded;
  }

  /** Whether every doc root's scan surface is clean — the whole-doc-roots absence
   *  question the identity reverse lookup asks (a clean miss is `spec-absent`; a
   *  dirty surface is an UNDECIDED read, never an absence). */
  docRootsClean(): boolean {
    return DOC_ROOT_KEYS.every((key) => {
      const discard = this.#discarded[key];
      return discard.unreadable === 0 && discard.unregistered === 0;
    });
  }

  /** The entry at one repo-root-relative path, or null when the path is not indexed. */
  entryAt(rel: string): DocEntry | null {
    return this.#byRel.get(rel) ?? null;
  }

  /** Every indexed document declaring the slug, in scan order — 0, 1 or n. The index
   *  answers the SET and NEVER selects: "the first one" is the defect this member
   *  retires, so a caller that needs one path reads it through the doc domain
   *  (`read({domain: "doc", …})`), which refuses an ambiguous set instead of choosing. */
  docsOf(slug: string): readonly DocEntry[] {
    return this.#bySlug.get(slug) ?? [];
  }

  /** Whether any IDENTITY document (overall / phase-spec / single-spec) declares the
   *  slug — the identity question the cross-doc chain asks. n ≥ 1 is true: a duplicated
   *  identity is still an identity (its ambiguity is `duplicatedRolesOf`'s judgment),
   *  so this member never lets a caller say "the slug names no identity document". */
  hasIdentity(slug: string): boolean {
    return this.docsOf(slug).some((entry) => SlugIndex.#isIdentity(entry));
  }

  /** The phase-spec documents whose `program:` names the program slug, in program
   *  order: the slugs' `-p<major>[.<minor>…]` tail numerically (p2 before p10,
   *  `p4.1` after `p4`), then the slugs without that tail in rel order. */
  phaseSpecsOf(programSlug: string): readonly DocEntry[] {
    return this.entries
      .filter((entry) => entry.docType === "phase-spec" && entry.program === programSlug)
      .sort(SlugIndex.#phaseCompare);
  }

  /** The overall document carrying the program slug, or null. */
  overallOf(programSlug: string): DocEntry | null {
    for (const entry of this.#bySlug.get(programSlug) ?? []) {
      if (entry.docType === "overall") return entry;
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

  /** The identity gate for one document's declared `slug:` — the ONE four-way
   *  judgment the dispatch pre-flight and the dispatch carrier share (spec §2.1):
   *  present · legal · indexed · unique. The `entryAt` guard keeps a content read
   *  the scan did not re-index from judging a stale value. */
  slugVerdict(rel: string, slug: string | null): SlugVerdict {
    if (slug === null) return { kind: "missing" };
    if (!SlugIndex.isLegalSlug(slug)) return { kind: "illegal", slug };
    const entry = this.entryAt(rel);
    const duplicated =
      entry !== null && entry.slug === slug && this.duplicatedRolesOf(slug).length > 0;
    return duplicated ? { kind: "duplicated", slug } : { kind: "accepted", slug };
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

  /** Scan one doc root — the names come from `#entryNames`, the document judgment
   *  from the shared `#readDoc` predicate (a `*.md` name whose content reads). An
   *  unreadable candidate is not a document, and a candidate that reads without a
   *  registered `doc-type:` is no identity document — BOTH are counted here, per root,
   *  so the absence question of §2.7 can be told apart from an undecided surface. */
  static #scanRoot(
    repoRoot: string,
    root: string,
    fs?: SlugScanFs,
  ): { readonly entries: DocEntry[]; readonly discard: RootDiscard } {
    const entries: DocEntry[] = [];
    let unreadable = 0;
    let unregistered = 0;
    for (const name of SlugIndex.#entryNames(path.join(repoRoot, root), fs)) {
      if (!name.endsWith(".md")) continue;
      const rel = path.join(root, name);
      const abs = path.join(repoRoot, rel);
      const content = SlugIndex.#readDoc(abs, fs);
      if (content === null) {
        unreadable++;
        continue;
      }
      const { head } = FrontMatterExtractor.split(content);
      const docType = SlugIndex.#docTypeOf(head.docType);
      if (docType === null) unregistered++;
      entries.push({
        path: abs,
        rel,
        docType,
        slug: head.slug,
        program: head.program,
        version: head.version,
        status: head.status,
        title: head.title,
      });
    }
    return { entries, discard: { unreadable, unregistered } };
  }

  /** The entry names of one doc root — the ONE `readdirSync` call site (the
   *  injected seam's `list` otherwise). Names only: the document judgment is
   *  `#readDoc`'s, so both legs classify the same set (a symlinked document is a
   *  document, a directory named `*.md` is not). A missing root lists nothing
   *  (ENOENT only); a permission or shape failure of an existing root is a real
   *  break — both legs rethrow it rather than index an empty root. */
  static #entryNames(root: string, fs?: SlugScanFs): readonly string[] {
    if (fs !== undefined) return fs.list(root);
    try {
      return readdirSync(root);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw err;
    }
  }

  /** One candidate's content, or null when it is not a readable regular file —
   *  the ONE document predicate (read-through = document). The node:fs leg owns the
   *  regular-file guard here (a directory, device or broken symlink named `*.md`
   *  never reads); the injected leg's `read` answers the same question for its own
   *  store. */
  static #readDoc(abs: string, fs?: SlugScanFs): string | null {
    if (fs !== undefined) return fs.read(abs);
    try {
      return statSync(abs).isFile() ? readFileSync(abs, "utf8") : null;
    } catch {
      return null;
    }
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
      if (entry.docType === "overall" && entry.slug !== null) overallSlugs.add(entry.slug);
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
