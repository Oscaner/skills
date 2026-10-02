#!/usr/bin/env node

// scripts/validate/index.ts — validate orchestration entry (`node scripts/run.ts
// validate` / standalone `node scripts/validate/index.ts`). The composed steps and
// main() live in orchestrate.ts — a named non-index entry the wiring guard
// (packages/kairos/tests/ci-validate.test.ts) and the pre-commit subset test import
// without a directory-index specifier (explicit `./index.ts` imports are TS2307 under
// the T4 nodenext typecheck). This file re-exports the composition and wires the
// standalone-execution guard (only the directly-run module's guard fires).

import { main, steps } from "./orchestrate.ts";
import { validateRunner } from "./runner.ts";

export { main, steps };

validateRunner.runIfMain(import.meta.url, steps);
