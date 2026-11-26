// packages/cdd-engine/src/env/paths/doc-roots.ts
// The doc-root leaf: the three program-document directories as their OWN declared
// constant, so the runtime roots, the CLI's example literals and every invariant
// message derive from one value instead of re-spelling the segments.
//
// `DocRoots` is the resolved view of that constant over one path basis: it answers
// the three roots as `RepoPath`s and whether a repo-relative path lives inside one.
// Immutable after construction; zero filesystem reads (existence is a document
// question, never a path question).

import path from "node:path";
import type { RepoPath, RepoRoot } from "./root.ts";

/** The declared doc-root segments, repo-relative — the ONE value of the doc-root
 *  fact. A second spelling anywhere is a drift, not a second implementation. */
export const DOC_ROOT_SEGMENTS = {
  overalls: "docs/kairos/overalls",
  specs: "docs/kairos/specs",
  plans: "docs/kairos/plans",
} as const;

/** The three doc-root keys, in scan order. */
export const DOC_ROOT_KEYS = ["overalls", "specs", "plans"] as const;

/** One doc-root key. */
export type DocRootKey = (typeof DOC_ROOT_KEYS)[number];

/** The resolved doc roots — the declared segments taken over one path basis. */
export class DocRoots {
  readonly #byKey: Readonly<Record<DocRootKey, RepoPath>>;

  constructor(root: RepoRoot) {
    const resolved = {} as Record<DocRootKey, RepoPath>;
    for (const key of DOC_ROOT_KEYS) resolved[key] = root.relativize(DOC_ROOT_SEGMENTS[key]);
    this.#byKey = resolved;
  }

  /** One root by key. */
  at(key: DocRootKey): RepoPath {
    return this.#byKey[key];
  }

  /** Every root, in scan order. */
  all(): readonly RepoPath[] {
    return DOC_ROOT_KEYS.map((key) => this.#byKey[key]);
  }

  /** Whether a repo-relative path lies inside any doc root — pure path grammar,
   *  zero document reads. A root's own path counts as inside it. */
  contains(rel: RepoPath): boolean {
    const normalized = path.normalize(rel);
    return this.all().some((root) => {
      const prefix = path.normalize(root);
      return normalized === prefix || normalized.startsWith(`${prefix}${path.sep}`);
    });
  }
}

/** The doc roots over one basis — the member the `paths` segment exposes. */
export const docRootsOf = (root: RepoRoot): DocRoots => new DocRoots(root);
