#!/usr/bin/env node
// scripts/validate/lib-tests.mjs — block 7: scripts unit tests (vitest).
// vitest.config.mjs include: scripts/**/*.test.mjs.

import { execaSync } from "execa";
import { realpathSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

export const steps = [
  {
    name: "7. scripts unit tests (vitest)",
    cmd: "pnpm",
    args: ["exec", "vitest", "run"],
    run: () => execaSync("pnpm", ["exec", "vitest", "run"], { cwd: ROOT, stdio: "inherit" }),
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