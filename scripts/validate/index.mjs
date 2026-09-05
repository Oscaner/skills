#!/usr/bin/env node
// scripts/validate/index.mjs — validate orchestration (`node scripts/run.mjs
// validate` / standalone `node scripts/validate/index.mjs`). Composes the 13
// per-block step descriptors from scripts/validate/*.mjs into the original run
// order and exposes `steps` + `main()` so the wiring guard
// (packages/osuperpowers/tests/ci-validate.test.mjs) can assert osuperpowers
// coverage is not dropped.
//
// Failure is structured: `console.error("== FAIL: <step> ==")` + message, and
// main() returns 1 (run.mjs turns a numeric return into process.exitCode).

import { realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { steps as emitCheckSteps } from "./emit-check.mjs";
import { steps as osuperpowersSteps } from "./osuperpowers.mjs";
import { steps as engineSteps } from "./engine.mjs";
import { steps as gateHooksSteps } from "./gate-hooks.mjs";
import { steps as residueSteps } from "./residue.mjs";
import { steps as marketplaceSteps } from "./marketplace.mjs";
import { steps as libTestsSteps } from "./lib-tests.mjs";
import { steps as versionSyncSteps } from "./version-sync.mjs";
import { steps as submoduleSteps } from "./submodule.mjs";

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

export async function main(stepsArg = steps) {
  for (const s of stepsArg) {
    try {
      console.log(`== ${s.name} ==`);
      s.run();
      console.log("OK");
    } catch (e) {
      console.error(`== FAIL: ${s.name} ==`);
      console.error(e?.message ?? String(e));
      return 1;
    }
  }
  console.log("ALL PASS");
  return 0;
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;
if (isMain) {
  Promise.resolve(main())
    .then((code) => process.exit(code != null ? code : 1))
    .catch(() => process.exit(1));
}