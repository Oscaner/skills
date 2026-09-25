#!/usr/bin/env node
// scripts/validate/index.ts — validate orchestration (`node scripts/run.ts
// validate` / standalone `node scripts/validate/index.ts`). Composes the 11
// per-block ValidateBlock instances from scripts/validate/*.ts into the original
// run order and exposes `steps` + `main()` so the wiring guard
// (packages/osuperpowers/tests/ci-validate.test.mjs) can assert osuperpowers
// coverage is not dropped. The runner loop + isMain guard live in ValidateRunner
// (runner.ts).
//
// Failure is structured: `console.error("== FAIL: <step> ==")` + message, and
// main() returns 1 (run.ts turns a numeric return into process.exitCode).

import { steps as emitCheckSteps } from "./emit-check.ts";
import { steps as engineSteps } from "./engine.ts";
import { steps as libTestsSteps } from "./lib-tests.ts";
import { steps as marketplaceSteps } from "./marketplace.ts";
import { steps as osuperpowersSteps } from "./osuperpowers.ts";
import { steps as residueSteps } from "./residue.ts";
import { validateRunner } from "./runner.ts";
import { steps as versionSyncSteps } from "./version-sync.ts";

// Original step order: the cdd-engine engine test suite follows the osuperpowers
// step block (plugin resolution / skills inventory count / node:test behavior
// tree / validate wiring guard) — engine steps are spliced after the four
// osuperpowers steps to keep the 11 names and their order literal. The
// submodule self-maintenance block (13th) was removed with the vendors surface
// (P6 Task 2 / B3, submodule.mjs deleted). The repo-side four-table guard block
// (12th) was retired with the S1/S2 guards (P3 T1).
export const steps = [
  ...emitCheckSteps,
  ...osuperpowersSteps.slice(0, 4),
  ...engineSteps,
  ...osuperpowersSteps.slice(4),
  ...residueSteps,
  ...marketplaceSteps,
  ...libTestsSteps,
  ...versionSyncSteps,
];

export function main(stepsArg = steps) {
  return validateRunner.run(stepsArg);
}

validateRunner.runIfMain(import.meta.url, steps);
