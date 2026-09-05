#!/usr/bin/env node
// scripts/validate/submodule.mjs — block 11: mattpocock-skills resolvable
// (bash-lenient: submodule missing → warn, not fail — a fresh clone before
// `git submodule update --init` skips; real resolution errors are caught by
// the version-sync block).

import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runIfMain } from "./runner.mjs";

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

runIfMain(import.meta.url, steps);