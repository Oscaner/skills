#!/usr/bin/env node
// scripts/validate/lib-tests.mjs — block 7: scripts unit tests (vitest).
// vitest.config.mjs include: scripts/**/*.test.mjs.

import { execaSync } from "execa";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { runIfMain } from "./runner.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

export const steps = [
  {
    name: "7. scripts unit tests (vitest)",
    cmd: "pnpm",
    args: ["exec", "vitest", "run"],
    run: () => execaSync("pnpm", ["exec", "vitest", "run"], { cwd: ROOT, stdio: "inherit" }),
  },
];

runIfMain(import.meta.url, steps);