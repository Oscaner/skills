#!/usr/bin/env node

// scripts/validate/lib-tests.ts — block 7: scripts unit tests (vitest).
// vitest.config.mjs include: scripts/**/__tests__/**/*.test.ts (colocation, Task 21).

import { SubprocessBlock, validateRunner } from "./runner.ts";

export const steps = [
  new SubprocessBlock({
    name: "scripts unit tests (vitest)",
    cmd: "pnpm",
    args: ["exec", "vitest", "run"],
  }),
];

validateRunner.runIfMain(import.meta.url, steps);
