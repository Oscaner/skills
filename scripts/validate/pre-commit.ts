#!/usr/bin/env node
// scripts/validate/pre-commit.ts — G4 (P6 Task 17): the tree-independent pre-commit subset.
// The pre-commit hook used to run the full 12-block validate against a working tree that is
// dirty by definition (you commit staged changes). That is structurally impossible for the
// engine black-box surface: the cdd-engine engine Vitest suite's cwd=REPO_ROOT cases dispatch
// against the real tree, and the entry gate (rules/commit.ts entryGateCleanTree) treats a
// dirty tree as BLOCKED for real dispatches (dry-run downgrades to a WARN, E2②). The fix
// aligns the gate boundaries: this subset — the blocks that only READ the tree and never
// dispatch through the entry gate (emit-check / osuperpowers / residue / marketplace /
// scripts-unit / version-sync) — runs locally at pre-commit; the tree-dependent surface
// stays in CI full validate (`.github/actions/validate` on a clean checkout) and in the
// development-time full suite (E2② dirty-tree WARN precondition documented in CLAUDE.md).
// The entry gate itself keeps its real boundary.
//
// Composition mirrors scripts/validate/index.ts minus the engine steps (cdd-engine dev stub
// materialization / engine test suite (vitest)) — the only blocks coupled to working-tree
// cleanliness. Standalone (`node scripts/validate/pre-commit.ts`) or via `pnpm run precommit`
// (run.ts subcommand, same lazy-load contract as validate). The 11-block full suite stays
// intact in index.ts; this subset is pinned by scripts/validate/__tests__/pre-commit.test.ts.

import { steps as emitCheckSteps } from "./emit-check.ts";
import { steps as libTestsSteps } from "./lib-tests.ts";
import { steps as marketplaceSteps } from "./marketplace.ts";
import { steps as osuperpowersSteps } from "./osuperpowers.ts";
import { steps as residueSteps } from "./residue.ts";
import { validateRunner } from "./runner.ts";
import { steps as versionSyncSteps } from "./version-sync.ts";

export const steps = [
  ...emitCheckSteps, // emit freshness (checked against regenerated products)
  ...osuperpowersSteps, // osuperpowers: plugin resolution / skills inventory / node:test behavior tree + wiring guard
  ...residueSteps, // engine zero residue + channel audit
  ...marketplaceSteps, // marketplace manifests validate
  ...libTestsSteps, // scripts unit tests (vitest)
  ...versionSyncSteps, // package version sync
];

export function main(stepsArg = steps) {
  return validateRunner.run(stepsArg);
}

validateRunner.runIfMain(import.meta.url, steps);
