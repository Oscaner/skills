#!/usr/bin/env node
// scripts/validate/submodule.mjs — block 11: mattpocock-skills resolvable
// (bash-lenient: submodule missing → warn, not fail — a fresh clone before
// `git submodule update --init` skips; real resolution errors are caught by
// the version-sync block).

import { existsSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");

function checkSubmodule() {
  if (!existsSync(path.join(ROOT, "vendors/mattpocock-skills/skills"))) {
    console.warn("WARN — vendors/mattpocock-skills/skills missing (bash-lenient: skipped; fresh clone needs `git submodule update --init`)");
    return;
  }
  console.log("OK");
}

export const steps = [
  {
    name: "11. mattpocock-skills resolvable",
    run: checkSubmodule,
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