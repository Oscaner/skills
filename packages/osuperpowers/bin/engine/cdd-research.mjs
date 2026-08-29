#!/usr/bin/env node
// cdd-research.mjs — osuperpowers standalone research runner (independent of cdd-task).
//
//   cdd-research.mjs --harness <name> --brief <path> --output <path> [-h/--help]
//
// Spawns harness CLI directly (spawnCapture, NOT invokeCli) with research prompt.
// RESEARCH_TIMEOUT env overrides timeout (default 600000ms = 10 min).
// CDD_DRY_RUN=1 skips harness invocation (argument parsing / smoke tests).
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadRegistry, checkHarness, CddBlockedError } from "./lib/registry.mjs";
import { spawnCapture } from "./lib/cli-shared.mjs";
import { buildResearchPrompt, writeFindings } from "./lib/research.mjs";
import { exitOk, exitCliMissing, exitBlocked } from "../utils/exit.mjs";

const NAME = path.basename(fileURLToPath(import.meta.url));
const REG_PATH = process.env.CDD_REGISTRY_PATH
  || fileURLToPath(new URL("./harness-registry.json", import.meta.url));
const DRY_RUN = process.env.CDD_DRY_RUN === "1";
const RESEARCH_TIMEOUT = Number(process.env.RESEARCH_TIMEOUT) || 600_000;

const USAGE = `usage: ${NAME} --harness <name> --brief <path> --output <path> [-h/--help]`;

// usage → stderr + exit 2 (arg-parsing error); help → stdout + exit 0。
function usage() {
  process.stderr.write(USAGE + "\n");
  exitCliMissing();
}

function help() {
  process.stdout.write(USAGE + "\n");
  exitOk();
}

// ---- arg parse ----

const args = process.argv.slice(2);
let harness = "";
let briefPath = "";
let outputPath = "";

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case "--harness":
      if (i + 1 >= args.length) usage();
      harness = args[++i];
      break;
    case "--brief":
      if (i + 1 >= args.length) usage();
      briefPath = args[++i];
      break;
    case "--output":
      if (i + 1 >= args.length) usage();
      outputPath = args[++i];
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

if (!harness || !briefPath || !outputPath) usage();

// ---- brief validation (before harness gate — brief is pure file check, no PATH dependency) ----

let briefContent;
try {
  briefContent = readFileSync(briefPath, "utf8");
} catch (err) {
  process.stderr.write(`${NAME}: cannot read brief: ${err.message}\n`);
  exitBlocked();
}

// ---- harness registry gate ----

let entry;
try {
  const reg = loadRegistry(REG_PATH);
  entry = checkHarness(reg, harness, { dryRun: DRY_RUN });
} catch (err) {
  if (err instanceof CddBlockedError) {
    if (err.kind === "cli-missing") exitCliMissing(err.message);
    exitBlocked(err.message);
  }
  process.stderr.write(`${NAME}: ${err.message}\n`);
  process.exit(err.exitCode ?? 1);
}

const prompt = buildResearchPrompt(briefContent);

// ---- dry-run short-circuit ----

if (DRY_RUN) {
  exitOk();
}

// ---- spawn harness CLI ----

const cli = entry.cli;
const cliArgs = [...entry.invoke.split(/\s+/).filter(Boolean), prompt];

// timeout watchdog: kill child + exit 1
let childProc = null;
const timer = setTimeout(() => {
  process.stderr.write(`${NAME}: RESEARCH_TIMEOUT after ${RESEARCH_TIMEOUT}ms\n`);
  if (childProc) childProc.kill("SIGTERM");
  process.exit(1);
}, RESEARCH_TIMEOUT);
timer.unref?.();

let result;
try {
  result = await spawnCapture(cli, cliArgs, {
    cwd: process.cwd(),
    env: process.env,
    onSpawn(proc) { childProc = proc; },
  });
} finally {
  clearTimeout(timer);
}

if (!result.ok) {
  process.stderr.write(`${NAME}: harness failed (exit ${result.code})\n`);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exit(1);
}

writeFindings(outputPath, result.stdout);
exitOk();
