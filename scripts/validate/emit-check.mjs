#!/usr/bin/env node
// scripts/validate/emit-check.mjs — block 0: unified emit freshness (emit-check).
// Subprocess step: runs the canonical `node scripts/run.mjs emit-check` (writes
// nothing; exits 1 on drift between committed products and a fresh generation).
// The subprocess target is run.mjs, not this module, so standalone execution
// (`node scripts/validate/emit-check.mjs`) cannot recurse.

import { execaSync } from "execa";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { runIfMain } from "./runner.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

export const steps = [
  {
    name: "0. unified emit freshness (emit-check)",
    cmd: "node",
    args: ["scripts/run.mjs", "emit-check"],
    run: () => execaSync("node", ["scripts/run.mjs", "emit-check"], { cwd: ROOT, stdio: "inherit" }),
  },
];

runIfMain(import.meta.url, steps);