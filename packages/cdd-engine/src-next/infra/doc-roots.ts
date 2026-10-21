// packages/cdd-engine/src-next/infra/doc-roots.ts
// The doc-root leaf (P9 T5 §2.8) — the doc-tree root segments as their OWN
// dependency-free constant so the CLI declaration surface (face/declare.ts — the
// help `example` rows) can derive its doc-root literals from the SAME single
// source the runtime exposes as `ENGINE_RUNTIME.docRoots`, without the module
// cycle the direct `declare.ts → runtime.ts` import would form (runtime.ts reads
// ARGV_CHANNEL from declare.ts, so declare.ts must stay import-clean toward it).
//
// `ENGINE_RUNTIME.docRoots` IS this object (runtime.ts references it, never
// re-declares a copy) — the doc-root segments live here once, and every reader
// (the runtime, the CLI examples, the invariant messages, the board scan) derives
// from this one value. Module-level export is the declared constant + its type —
// zero behavior-carrying bare functions.

/** The doc-root segments — the slug → doc-tree reverse derivation's root paths
 *  (relative to the repo root; the board's scan reads them, never re-declares). */
export interface DocRoots {
  /** The program-charter directory segment. */
  overalls: string;
  /** The design-spec directory segment. */
  specs: string;
  /** The plan directory segment. */
  plans: string;
}

/** The doc-tree root segments — the ONE value of the doc-root fact (the runtime's
 *  `docRoots` and every derived literal read THIS constant). */
export const ENGINE_DOC_ROOTS = {
  overalls: "docs/kairos/overalls",
  specs: "docs/kairos/specs",
  plans: "docs/kairos/plans",
} as const satisfies DocRoots;
