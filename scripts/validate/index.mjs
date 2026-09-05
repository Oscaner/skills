#!/usr/bin/env node
// scripts/validate/index.mjs — validate orchestration (`node scripts/run.mjs
// validate` / standalone `node scripts/validate/index.mjs`). Composes the 13
// per-block step descriptors from scripts/validate/*.mjs into the original run
// order and exposes `steps` + `main()` so the wiring guard
// (packages/osuperpowers/tests/ci-validate.test.mjs) can assert osuperpowers
// coverage is not dropped. The runner loop + isMain guard live in runner.mjs.
//
// Failure is structured: `console.error("== FAIL: <step> ==")` + message, and
// main() returns 1 (run.mjs turns a numeric return into process.exitCode).

import { steps as emitCheckSteps } from "./emit-check.mjs";
import { steps as osuperpowersSteps } from "./osuperpowers.mjs";
import { steps as engineSteps } from "./engine.mjs";
import { steps as gateHooksSteps } from "./gate-hooks.mjs";
import { steps as residueSteps } from "./residue.mjs";
import { steps as marketplaceSteps } from "./marketplace.mjs";
import { steps as libTestsSteps } from "./lib-tests.mjs";
import { steps as versionSyncSteps } from "./version-sync.mjs";
import { steps as submoduleSteps } from "./submodule.mjs";

import { main as runSteps, runIfMain } from "./runner.mjs";

// Original step order: the 5b1 engine suite sits between the 5b node:test tree
// (osuperpowers steps 0-3) and the 5b wiring guard (osuperpowers step 4) —
// interleave engine between the two osuperpowers slices to keep the 13 names
// and their order literal.
export const steps = [
  ...emitCheckSteps,
  ...osuperpowersSteps.slice(0, 4),
  ...engineSteps,
  ...osuperpowersSteps.slice(4),
  ...gateHooksSteps,
  ...residueSteps,
  ...marketplaceSteps,
  ...libTestsSteps,
  ...versionSyncSteps,
  ...submoduleSteps,
];

export function main(stepsArg = steps) {
  return runSteps(stepsArg);
}

runIfMain(import.meta.url, steps);