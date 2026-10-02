#!/usr/bin/env node

// scripts/validate/engine.ts — block 5b: cdd-engine Vitest suite (T7: the zero-build dev face).
// The suite's black-box cases spawn `node packages/cdd-engine/src/bin.ts` directly (Node ≥22.18
// native type stripping) — no dist materialization exists and none is needed: the dev entry IS
// the source entry. The old stub-materialization step (the CI face of the retired dev-stub
// chain) is deleted with the chain itself.

import { SubprocessBlock, validateRunner } from "./runner.ts";

export const steps = [
  new SubprocessBlock({
    name: "cdd-engine engine test suite (vitest)",
    cmd: "pnpm",
    args: ["-C", "packages/cdd-engine", "test"],
  }),
];

validateRunner.runIfMain(import.meta.url, steps);
