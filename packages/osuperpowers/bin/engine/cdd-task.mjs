#!/usr/bin/env node
// cdd-task.mjs — osuperpowers single task runner: one mode per invocation.
//
//   cdd-task.mjs --harness <name> --task N --mode implement|task-review|fix [--plan PATH] [--scope SCOPE]
//
// --plan optional: sets PLAN_FILE env for workspace resolution (task-review review-package).
// --scope optional (fix mode only): blocker-only (default) | deferred-sweep (#168 dual-channel).
// CDD_DRY_RUN=1 skips the CLI (argument parsing / orchestration smoke tests).
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runTask } from "./lib/runner.mjs";
import { exitOk, exitCliMissing } from "../utils/exit.mjs";

const NAME = path.basename(fileURLToPath(import.meta.url));
const DRY_RUN = process.env.CDD_DRY_RUN === "1";

// usage → stderr + exit 2 (arg-parsing error); help → stdout + exit 0 (explicit -h/--help)。
function usage() {
  process.stderr.write(
    `usage: ${NAME} --harness <name> --task N --mode implement|task-review|fix [--plan PATH] [--scope SCOPE]\n`,
  );
  exitCliMissing();
}

function help() {
  process.stdout.write(
    `usage: ${NAME} --harness <name> --task N --mode implement|task-review|fix [--plan PATH] [--scope SCOPE]\n`,
  );
  exitOk();
}

const args = process.argv.slice(2);
let harness = "";
let taskNum = "";
let modeArg = "";
let planFile = "";
let scopeArg = "";

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case "--harness":
      if (i + 1 >= args.length) usage();
      harness = args[++i];
      break;
    case "--task":
      if (i + 1 >= args.length) usage();
      taskNum = args[++i];
      break;
    case "--mode":
      if (i + 1 >= args.length) usage();
      modeArg = args[++i];
      break;
    case "--plan":
      if (i + 1 >= args.length) usage();
      planFile = args[++i];
      break;
    case "--scope":
      if (i + 1 >= args.length) usage();
      scopeArg = args[++i];
      break;
    case "-h":
    case "--help":
      help();
      break;
    default:
      process.stderr.write(`unknown argument: ${args[i]}\n`);
      usage();
  }
}

if (!harness) usage();

// Mode A (per-task only; --plan is optional — sets PLAN_FILE for workspace resolution)
if (!taskNum || !modeArg) usage();
const env = { ...process.env };
if (planFile) env.PLAN_FILE = planFile;
await runTask(harness, taskNum, { mode: modeArg, dryRun: DRY_RUN, env, scope: scopeArg || undefined });
