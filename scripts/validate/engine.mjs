#!/usr/bin/env node
// scripts/validate/engine.mjs — block 5b1: cdd-engine Vitest engine suite
// (engine code moved out of bin/engine; `pnpm -C packages/cdd-engine test`).

import { execaSync } from "execa";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { runIfMain } from "./runner.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

export const steps = [
  {
    name: "5b1. cdd-engine Vitest engine suite",
    cmd: "pnpm",
    args: ["-C", "packages/cdd-engine", "test"],
    run: () => execaSync("pnpm", ["-C", "packages/cdd-engine", "test"], { cwd: ROOT, stdio: "inherit" }),
  },
];

runIfMain(import.meta.url, steps);