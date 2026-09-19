#!/usr/bin/env node
// scripts/validate/pre-commit.ts — G4 (P6 Task 17): the tree-independent pre-commit subset.
// The pre-commit hook used to run the full 12-block validate against a working tree that is
// dirty by definition (you commit staged changes). That is structurally impossible for the
// engine black-box surface: the 5b1 cdd-engine Vitest suite's cwd=REPO_ROOT cases dispatch
// against the real tree, and the entry gate (rules/commit.ts entryGateCleanTree) treats a
// dirty tree as BLOCKED for real dispatches (dry-run downgrades to a WARN, E2②). The fix
// aligns the gate boundaries: this subset — the blocks that only READ the tree and never
// dispatch through the entry gate (emit-check / residue / consistency / unit) — runs locally
// at pre-commit; the tree-dependent surface stays in CI full validate (`.github/actions/
// validate` on a clean checkout) and in the development-time full suite (E2② dirty-tree WARN
// precondition documented in CLAUDE.md). The entry gate itself keeps its real boundary.
//
// Composition mirrors scripts/validate/index.ts minus the engine steps 5b0/5b1 (stub
// materialization + Vitest suite) — the only blocks coupled to working-tree cleanliness.
// Standalone (`node scripts/validate/pre-commit.ts`) or via `pnpm run precommit` (run.ts
// subcommand, same lazy-load contract as validate). The 12-block full suite stays intact in
// index.ts; this subset is pinned by scripts/validate/__tests__/pre-commit.test.ts.

import { steps as emitCheckSteps } from "./emit-check.ts";
import { steps as osuperpowersSteps } from "./osuperpowers.ts";
import { steps as residueSteps } from "./residue.ts";
import { steps as marketplaceSteps } from "./marketplace.ts";
import { steps as libTestsSteps } from "./lib-tests.ts";
import { steps as versionSyncSteps } from "./version-sync.ts";
import { steps as overallConsistencySteps } from "./overall-consistency.ts";

import { main as runSteps, runIfMain } from "./runner.ts";

export const steps = [
  ...emitCheckSteps,              // 0. emit freshness (regenerate + diff, no dispatch)
  ...osuperpowersSteps,           // 5b. osuperpowers plugin validation (node:test trees + wiring guard)
  ...residueSteps,                // 5c. engine zero-residue + channel-audit grep
  ...marketplaceSteps,            // 6. marketplace validate
  ...libTestsSteps,               // 7. scripts unit tests (vitest)
  ...versionSyncSteps,            // 8-10. version sync
  ...overallConsistencySteps,     // 12. overall consistency
];

export function main(stepsArg = steps) {
  return runSteps(stepsArg);
}

runIfMain(import.meta.url, steps);