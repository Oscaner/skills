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
import { spawnCapture, resolveTimeoutMs } from "./lib/cli-shared.mjs";
import { buildResearchPrompt, writeFindings } from "./lib/research.mjs";
import { exitOk, exitCliMissing, exitBlocked, exitWithCode } from "../utils/exit.mjs";

const NAME = path.basename(fileURLToPath(import.meta.url));
const REG_PATH = process.env.CDD_REGISTRY_PATH
  || fileURLToPath(new URL("./harness-registry.json", import.meta.url));
const DRY_RUN = process.env.CDD_DRY_RUN === "1";

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

const timeoutMs = resolveTimeoutMs(process.env, "research");

let result;
try {
  result = await spawnCapture(cli, cliArgs, {
    cwd: process.cwd(),
    env: process.env,
    timeoutMs,
    // onSpawn retained for spawnCapture internal timeout kill; no ad-hoc watchdog here.
    onSpawn() {},
  });
} catch (err) {
  process.stderr.write(`${NAME}: spawn error: ${err.message}\n`);
  exitWithCode(1);
}

// Timeout path: 写 partial findings（保留已产出内容）+ 追加 TIMEOUT frontmatter + exit 1。
if (result.timedOut) {
  process.stderr.write(`${NAME}: timeout after ${timeoutMs}ms\n`);
  writeFindings(outputPath, `${result.stdout}\n---\nstatus: TIMEOUT\n`);
  exitWithCode(1);
}

if (!result.ok) {
  process.stderr.write(`${NAME}: harness failed (exit ${result.code})\n`);
  if (result.stderr) process.stderr.write(result.stderr);
  exitWithCode(1);
}

writeFindings(outputPath, result.stdout);
exitOk();
