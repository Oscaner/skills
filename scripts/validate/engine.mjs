#!/usr/bin/env node
// scripts/validate/engine.mjs — block 5b1: cdd-engine Vitest engine suite
// (engine code moved out of bin/engine; `pnpm -C packages/cdd-engine test`).

import { execaSync } from "execa";
import { realpathSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

export const steps = [
  {
    name: "5b1. cdd-engine Vitest engine suite",
    cmd: "pnpm",
    args: ["-C", "packages/cdd-engine", "test"],
    run: () => execaSync("pnpm", ["-C", "packages/cdd-engine", "test"], { cwd: ROOT, stdio: "inherit" }),
  },
];

function main(stepsArg = steps) {
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