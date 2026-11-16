// packages/cdd-engine/src-next/__tests__/support/plan-source.ts
// The test-side composition root of the plan read seam. `PlanSource` takes the
// command's ONE identity index (it builds none of its own — two snapshots of the doc
// roots would let one read answer from a stale scan), so every fixture constructs it
// through this ONE helper instead of re-deriving the wiring at ~150 call sites.
//
// Production constructs the pair in `Cli`: the same index the board, the scene and the
// ledger read. This module is the fixture's stand-in, and it holds zero behavior of its
// own — the index scans the root the case handed in.
//
// Module-level export is the arrow const — zero behavior-carrying bare functions.

import type { DocFs } from "../../contract/invariants.ts";
import { PlanSource } from "../../infra/plan-source.ts";
import type { RepoRoot } from "../../infra/root.ts";
import { SlugIndex } from "../../infra/slug-index.ts";

/** A `PlanSource` over `root`, wired to the index the SAME root scans. */
export const planSourceOf = (root: RepoRoot, fs?: DocFs): PlanSource =>
  new PlanSource(root, SlugIndex.build(root.absolute), fs);
