#!/usr/bin/env node
// scripts/validate/runner.mjs — single copy of the ~30-line step-runner loop +
// realpathSync isMain guard that every validate block module (and index.mjs) used
// to embed inline. A leaf module (imports nothing from validate/), so importing it
// from the block modules creates no ESM cycle — importing index.mjs's main would,
// because index composes this suite's steps at top level.
//
// main() prints `== <step> ==` + OK per step, `== FAIL: <step> ==` + message and
// returns 1 on error, and `ALL PASS` + 0 when green (run.mjs turns the numeric
// return into process.exitCode).
//
// runIfMain(metaUrl, steps) wires standalone execution (design-spec Acceptance §4):
// a module calls it with its own import.meta.url — never runner's — and only the
// directly-run module's guard fires.

import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";

export async function main(stepsArg) {
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

export function isMain(metaUrl) {
  return Boolean(
    process.argv[1] &&
      metaUrl === pathToFileURL(realpathSync(process.argv[1])).href,
  );
}

export function runIfMain(metaUrl, stepsArg) {
  if (!isMain(metaUrl)) return;
  Promise.resolve(main(stepsArg))
    .then((code) => process.exit(code != null ? code : 1))
    .catch(() => process.exit(1));
}