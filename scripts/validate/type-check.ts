#!/usr/bin/env node

// scripts/validate/type-check.ts — type-check block (T4): the three-project tsc --noEmit gate
// (engine / scripts / kairos-tests; the root `pnpm run typecheck` script is the single command).
// The engine project mirrors the Node strip runtime via erasableSyntaxOnly; the compose points
// (index.ts full validate + pre-commit.ts subset) both carry this block — the gate closes the
// config-plane blind spot (vitest esbuild/lint-staged native loads do not typecheck).

import { SubprocessBlock, validateRunner } from "./runner.ts";

export const steps = [
  new SubprocessBlock({
    name: "type-check (tsc --noEmit × 3 projects)",
    cmd: "pnpm",
    args: ["run", "typecheck"],
  }),
];

validateRunner.runIfMain(import.meta.url, steps);
