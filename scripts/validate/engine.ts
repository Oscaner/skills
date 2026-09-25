#!/usr/bin/env node

// scripts/validate/engine.ts — block 5b: cdd-engine (Vitest suite + stub materialization).
// 5b0 materializes the dev stub (`pnpm -C packages/cdd-engine dev:stub`) before the suite:
// `dist/cli.mjs` is gitignored (P5 TS + unbuild) and nothing else regenerates it on a fresh
// checkout. Since P3 T7 the engine's `prepare` hook (`dev:stub` on install) was REMOVED — the
// install-time auto-stub is gone, so this step is the CI-face materialization (the standalone
// `pnpm --filter @oscaner-skills/cdd-engine test` face is self-sufficient via the vitest
// globalSetup — see vitest.config.mjs / vitest.global-setup.ts, D4).
// 5b1 runs the engine Vitest suite (engine code moved out of bin/engine; `pnpm -C packages/cdd-engine test`).

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execaSync } from "execa";

import { runIfMain } from "./runner.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

export const steps = [
  {
    name: "cdd-engine dev stub materialization",
    cmd: "pnpm",
    args: ["-C", "packages/cdd-engine", "dev:stub"],
    run: () =>
      execaSync("pnpm", ["-C", "packages/cdd-engine", "dev:stub"], { cwd: ROOT, stdio: "inherit" }),
  },
  {
    name: "cdd-engine engine test suite (vitest)",
    cmd: "pnpm",
    args: ["-C", "packages/cdd-engine", "test"],
    run: () =>
      execaSync("pnpm", ["-C", "packages/cdd-engine", "test"], { cwd: ROOT, stdio: "inherit" }),
  },
];

runIfMain(import.meta.url, steps);
