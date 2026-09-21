#!/usr/bin/env node
// scripts/validate/index.ts — validate orchestration (`node scripts/run.ts
// validate` / standalone `node scripts/validate/index.ts`). Composes the 12
// per-block step descriptors from scripts/validate/*.ts into the original run
// order and exposes `steps` + `main()` so the wiring guard
// (packages/osuperpowers/tests/ci-validate.test.mjs) can assert osuperpowers
// coverage is not dropped. The runner loop + isMain guard live in runner.ts.
//
// Failure is structured: `console.error("== FAIL: <step> ==")` + message, and
// main() returns 1 (run.ts turns a numeric return into process.exitCode).

import { steps as emitCheckSteps } from "./emit-check.ts";
import { steps as osuperpowersSteps } from "./osuperpowers.ts";
import { steps as engineSteps } from "./engine.ts";
import { steps as residueSteps } from "./residue.ts";
import { steps as marketplaceSteps } from "./marketplace.ts";
import { steps as libTestsSteps } from "./lib-tests.ts";
import { steps as versionSyncSteps } from "./version-sync.ts";
import { steps as overallConsistencySteps } from "./overall-consistency.ts";

import { main as runSteps, runIfMain } from "./runner.ts";

// Original step order: the 5b1 engine suite sits between the 5b node:test tree
// (osuperpowers steps 0-3) and the 5b wiring guard (osuperpowers step 4) —
// interleave engine between the two osuperpowers slices to keep the 12 names
// and their order literal. The submodule self-maintenance block (13th) was
// removed with the vendors surface (P6 Task 2 / B3, submodule.mjs deleted).
export const steps = [
  ...emitCheckSteps,
  ...osuperpowersSteps.slice(0, 4),
  ...engineSteps,
  ...osuperpowersSteps.slice(4),
  ...residueSteps,
  ...marketplaceSteps,
  ...libTestsSteps,
  ...versionSyncSteps,
  ...overallConsistencySteps,
];

export function main(stepsArg = steps) {
  return runSteps(stepsArg);
}

runIfMain(import.meta.url, steps);