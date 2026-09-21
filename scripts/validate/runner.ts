#!/usr/bin/env node
// scripts/validate/runner.ts — single copy of the ~30-line step-runner loop +
// realpathSync isMain guard that every validate block module (and index.ts) used
// to embed inline. A leaf module (imports nothing from validate/), so importing it
// from the block modules creates no ESM cycle — importing index.ts's main would,
// because index composes this suite's steps at top level.
//
// main() prints `== <step> ==` + OK per step, `== FAIL: <step> ==` + message and
// returns 1 on error, and `ALL PASS` + 0 when green (run.ts turns the numeric
// return into process.exitCode).
//
// runIfMain(metaUrl, steps) wires standalone execution (design-spec Acceptance §4):
// a module calls it with its own import.meta.url — never runner's — and only the
// directly-run module's guard fires.

import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";

/** Step descriptor: name + run(); optional meta (subprocess steps carry cmd/args, the 5c step carries grep/channel targets for the wiring guard). */
type StepDescriptor = {
  name: string;
  run: () => unknown;
  cmd?: string;
  args?: string[];
  grepTargets?: string[];
  channelTargets?: string[];
};

export async function main(stepsArg: Array<StepDescriptor>): Promise<number> {
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

export function isMain(metaUrl: string): boolean {
  return Boolean(
    process.argv[1] &&
      metaUrl === pathToFileURL(realpathSync(process.argv[1])).href,
  );
}

export function runIfMain(metaUrl: string, stepsArg: Array<StepDescriptor>): void {
  if (!isMain(metaUrl)) return;
  Promise.resolve(main(stepsArg))
    .then((code) => process.exit(code != null ? code : 1))
    .catch(() => process.exit(1));
}