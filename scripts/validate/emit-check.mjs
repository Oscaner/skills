#!/usr/bin/env node
// scripts/validate/emit-check.mjs — block 0: unified emit freshness (emit-check).
// Subprocess step: runs the canonical `node scripts/run.mjs emit-check` (writes
// nothing; exits 1 on drift between committed products and a fresh generation).
// The subprocess target is run.mjs, not this module, so standalone execution
// (`node scripts/validate/emit-check.mjs`) cannot recurse.

import { execaSync } from "execa";
import { realpathSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

export const steps = [
  {
    name: "0. unified emit freshness (emit-check)",
    cmd: "node",
    args: ["scripts/run.mjs", "emit-check"],
    run: () => execaSync("node", ["scripts/run.mjs", "emit-check"], { cwd: ROOT, stdio: "inherit" }),
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