#!/usr/bin/env node
// scripts/validate/orchestrate.ts — the composed validate step set + shared main() entry.
// The full-suite composition lives here (not in index.ts) so dependency-free consumers can
// import it without a directory-index specifier: an explicit `./index.ts` import is TS2307
// under the T4 nodenext typecheck (runtime loads it fine; the typecheck does not — the
// task-wide rule the .mjs→.ts migration restates: no directory-index imports). The wiring
// guard (packages/kairos/tests/ci-validate.test.ts) and the pre-commit subset test import
// this named entry; index.ts re-exports steps/main and wires the standalone guard.
//
// Failure is structured: `console.error("== FAIL: <step> ==")` + message, and main()
// returns 1 (run.ts turns a numeric return into process.exitCode).

import { steps as emitCheckSteps } from "./emit-check.ts";
import { steps as engineSteps } from "./engine.ts";
import { steps as kairosSteps } from "./kairos.ts";
import { steps as libTestsSteps } from "./lib-tests.ts";
import { steps as marketplaceSteps } from "./marketplace.ts";
import { steps as residueSteps } from "./residue.ts";
import { validateRunner } from "./runner.ts";
import { steps as versionSyncSteps } from "./version-sync.ts";

// Original step order: the cdd-engine engine test suite follows the kairos
// step block (plugin resolution / skills inventory count / node:test behavior
// tree / validate wiring guard) — engine steps are spliced after the first four
// kairos steps; the pi-package well-formed check closes the block after the
// engine suite, keeping the composition literal. The
// submodule self-maintenance block (13th) was removed with the vendors surface
// (P6 Task 2 / B3, submodule.mjs deleted). The repo-side four-table guard block
// (12th) was retired with the S1/S2 guards (P3 T1).
export const steps = [
  ...emitCheckSteps,
  ...kairosSteps.slice(0, 4),
  ...engineSteps,
  ...kairosSteps.slice(4),
  ...residueSteps,
  ...marketplaceSteps,
  ...libTestsSteps,
  ...versionSyncSteps,
];

export function main(stepsArg = steps) {
  return validateRunner.run(stepsArg);
}
