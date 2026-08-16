#!/usr/bin/env node
// cdd-run.mjs — engineering single CLI runner: one mode per invocation (Mode A)
// or plan driver (Mode B). Node port of cdd-run.sh; thin shell delegating to
// runner.mjs runTask / runPlan.
//
//   Mode A:  cdd-run.mjs --harness <name> --task N --mode implement|review|fix [--plan PATH]
//   Mode B:  cdd-run.mjs --harness <name> --plan PATH
//
// Entry disambiguation: --task N present => Mode A (--plan optional);
// else --plan present => Mode B (required); neither => usage exit 2.
//
// CDD_DRY_RUN=1 skips the CLI (argument parsing / orchestration smoke tests).
// Mode A passes --plan via PLAN_FILE env (对齐 cdd-run.sh：cdd_run_task 无 plan-file
// 参数，_cdd_resolve_workspace 优先 CDD_WORKSPACE —— 只有 Mode B 恒从 plan 派生 workspace）。
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runTask, runPlan } from "./lib/runner.mjs";
import { exitOk, exitCliMissing } from "./utils/exit.mjs";

const NAME = path.basename(fileURLToPath(import.meta.url));
const DRY_RUN = process.env.CDD_DRY_RUN === "1";

// usage → stderr + exit 2 (arg-parsing error); help → stdout + exit 0 (explicit -h/--help)。
function usage() {
  process.stderr.write(
    `usage: ${NAME} --harness <name> (--task N --mode implement|review|fix [--plan PATH] | --plan PATH)\n`,
  );
  exitCliMissing();
}

function help() {
  process.stdout.write(
    `usage: ${NAME} --harness <name> (--task N --mode implement|review|fix [--plan PATH] | --plan PATH)\n`,
  );
  exitOk();
}

const args = process.argv.slice(2);
let harness = "";
let taskNum = "";
let modeArg = "";
let planFile = "";

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

if (taskNum !== "") {
  // Mode A
  if (!modeArg) usage();
  const env = { ...process.env };
  if (planFile) env.PLAN_FILE = planFile;
  // noExit=false：runTask 自行 exit helpers —— 薄壳无需落地退出码。
  await runTask(harness, taskNum, { mode: modeArg, dryRun: DRY_RUN, env });
} else {
  // Mode B
  if (!planFile) usage();
  await runPlan(planFile, harness, { dryRun: DRY_RUN });
}
