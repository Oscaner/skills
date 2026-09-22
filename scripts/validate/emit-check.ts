#!/usr/bin/env node
// scripts/validate/emit-check.ts — block 0: unified emit freshness (emit-check).
// Subprocess step: runs the canonical `node scripts/run.ts emit-check` (writes
// nothing; exits 1 on drift between committed products and a fresh generation).
// The subprocess target is run.ts, not this module, so standalone execution
// (`node scripts/validate/emit-check.ts`) cannot recurse.

import { execaSync } from "execa";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { runIfMain } from "./runner.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

export const steps = [
  {
    name: "emit freshness (checked against regenerated products)",
    cmd: "node",
    args: ["scripts/run.ts", "emit-check"],
    run: () => execaSync("node", ["scripts/run.ts", "emit-check"], { cwd: ROOT, stdio: "inherit" }),
  },
];

runIfMain(import.meta.url, steps);