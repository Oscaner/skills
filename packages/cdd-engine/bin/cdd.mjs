#!/usr/bin/env node
// bin/cdd.mjs — thin entry (spec §2.3): all command definitions live in lib/cli/parse.mjs
// (review/fix/research actions + shared harness/Stopping guards in lib/cli/*). Zero command
// definitions here — this file only boots the registered program and normalizes Commander errors.
//   cdd implement --task <n> [--plan <path>]
//   cdd review --type <task|branch|spec|plan> [...]
//   cdd fix --type <task|spec|plan> [...]
//   cdd research --brief <path> --output <path>
//   cdd brief --task <n> --plan <path> [--output <path>]
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { realpathSync } from "node:fs";

import { program, usageError } from "../lib/cli/parse.mjs";
import { exitOk, exitCliMissing } from "../lib/exit.mjs";

// Only parse argv when executed as the main entry (imports from tests must be inert).
const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;
if (isMain) {
  program.parseAsync(process.argv).catch((e) => {
    if (e.code === "commander.helpDisplayed") {
      exitOk();
    }
    // Commander parse/usage errors (missing required option, unknown option, unknown command, ...) → usage + exit 2.
    if (typeof e.code === "string" && e.code.startsWith("commander.")) {
      usageError(process.argv[2]);
    } else {
      // Action errors → error message + exit 2.
      process.stderr.write(`${e.message}\n`);
    }
    exitCliMissing();
  });
}