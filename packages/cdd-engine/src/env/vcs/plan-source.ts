// packages/cdd-engine/src/env/vcs/plan-source.ts
// The plan source: a plan document's BYTES, located by identity.
//
// Two entries, two bases:
//   · `readFor(slug)` — the derived face. The plan is found by the slug its document
//     DECLARES, never by a `<slug>.md` name: the slug index answers one path, an
//     ambiguous set, or absence, and only the paths under the plans root count (a
//     slug whose single document is a spec has no plan). A second plan declaring the
//     same slug is `ambiguous` — it carries the found set, because answering "no plan"
//     about a set of two is the one licence an identity read does not hold.
//   · `readPath(target)` — the argv face. The caller already spelled the path; it is
//     read verbatim, so a mistyped path is a read failure at that exact coordinate.
//
// This file reads FILES. Whether the bytes are a plan — the front-matter head, the task
// blocks, the graph — is the document slice's judgment (`docs/`), and it stays there:
// `env/` may not reach into `docs/`, so the seam between them is plain text plus the
// coordinate it came from. That is also the one behaviour worth keeping from the old
// plan reader: the identity question is answered here, the parse is answered above.
//
// Module-level exports are types, the class and its factory — zero behaviour-carrying
// bare functions.

import { readFileSync } from "node:fs";
import path from "node:path";
import type { DocRoots } from "../paths/doc-roots.ts";
import type { RepoPath, RepoRoot } from "../paths/root.ts";
import type { SlugEntry, SlugIndex } from "../paths/slug-index.ts";

/** One plan read: the bytes and their coordinate, or the declared reason there are none. */
export type PlanText =
  /** The plan's text, at the coordinate it was read from. */
  | { readonly kind: "text"; readonly target: RepoPath; readonly value: string }
  /** No document under the plans root declares this slug. */
  | { readonly kind: "absent"; readonly slug: string }
  /** Two or more plan documents declare this slug — no single document answers. */
  | {
      readonly kind: "ambiguous";
      readonly slug: string;
      readonly found: readonly RepoPath[];
    }
  /** The named coordinate did not read — the declared failure, carrying it. */
  | { readonly kind: "read-failure"; readonly target: RepoPath };

/**
 * PlanSource — the plan text seam. Invariant: a plan is answered by the slug a document
 * declares (never by a derived file name), and a set of two answers the set rather than
 * a first pick.
 */
export class PlanSource {
  readonly #root: RepoRoot;
  readonly #index: SlugIndex;
  readonly #plansRoot: string;

  constructor(opts: { root: RepoRoot; docs: DocRoots; index: SlugIndex }) {
    this.#root = opts.root;
    this.#index = opts.index;
    this.#plansRoot = path.normalize(opts.docs.at("plans"));
  }

  /** The plans root — the one coordinate prefix a plan may live under. */
  get plansRoot(): string {
    return this.#plansRoot;
  }

  /** The plan of one slug, by the identity its document declares. */
  readFor(slug: string): PlanText {
    const entry = this.#index.lookup(slug);
    const candidates = this.#planPathsOf(entry);
    if (candidates.length === 0) return { kind: "absent", slug };
    if (candidates.length > 1) return { kind: "ambiguous", slug, found: candidates };
    return this.readPath(candidates[0]!);
  }

  /** The argv face — read the coordinate the caller spelled, verbatim. */
  readPath(target: RepoPath): PlanText {
    try {
      return {
        kind: "text",
        target,
        value: readFileSync(this.#root.resolve(target), "utf8"),
      };
    } catch {
      return { kind: "read-failure", target };
    }
  }

  /** The indexed paths of one slug that sit under the plans root — absence and
   *  ambiguity both fall out of this list, so neither is a special case. */
  #planPathsOf(entry: SlugEntry): readonly RepoPath[] {
    if (entry.kind === "absent") return [];
    const rels = entry.kind === "unique" ? [entry.rel] : entry.rels;
    return rels.filter((rel) => this.#underPlans(rel));
  }

  /** Whether a repo-relative path lives under the plans root — path grammar only. */
  #underPlans(rel: RepoPath): boolean {
    const normalized = path.normalize(rel);
    return normalized.startsWith(`${this.#plansRoot}${path.sep}`);
  }
}

/** The plan source over one environment's path faces — the member the `vcs` segment
 *  exposes. The index must be the SAME index the command's other readers use (two
 *  snapshots of the doc roots would let one read answer from a stale scan). */
export const planSourceOf = (opts: {
  root: RepoRoot;
  docs: DocRoots;
  index: SlugIndex;
}): PlanSource => new PlanSource(opts);
