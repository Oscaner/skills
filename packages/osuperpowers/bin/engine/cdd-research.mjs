#!/usr/bin/env node
// cdd-research.mjs — osuperpowers standalone research runner (independent of cdd-task).
//
//   cdd-research.mjs --harness <name> --brief <path> --output <path> [-h/--help]
//
// Spawns harness CLI directly (spawnCapture, NOT invokeCli) with research prompt.
// RESEARCH_TIMEOUT env overrides timeout (default 600000ms = 10 min).
// CDD_DRY_RUN=1 skips harness invocation (argument parsing / smoke tests).
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadRegistry, checkHarness } from "./lib/registry.mjs";
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

// ---- harness registry gate ----

let entry;
try {
  const reg = loadRegistry(REG_PATH);
  entry = checkHarness(reg, harness, { dryRun: DRY_RUN });
} catch (err) {
  process.stderr.write(`${NAME}: ${err.message}\n`);
  process.exit(err.exitCode ?? 1);
}

// ---- brief → prompt ----

let briefContent;
try {
  briefContent = readFileSync(briefPath, "utf8");
} catch (err) {
  process.stderr.write(`${NAME}: cannot read brief: ${err.message}\n`);
  exitBlocked();
}

const prompt = buildResearchPrompt(briefContent);

// ---- dry-run short-circuit ----

if (DRY_RUN) {
  exitOk();
}

// ---- spawn harness CLI ----

const cli = entry.cli;
const cliArgs = [...entry.invoke.split(/\s+/).filter(Boolean), prompt];

// Strip subagent model env vars to prevent leakage into nested sessions.
const cleanEnv = { ...process.env };
delete cleanEnv.CLAUDE_CODE_SUBAGENT_MODEL;

const child = spawn(cli, cliArgs, {
  cwd: process.cwd(),
  env: cleanEnv,
  stdio: ["ignore", "pipe", "pipe"],
});

// timeout watchdog: kill child + exit 1
const timer = setTimeout(() => {
  child.kill("SIGTERM");
  process.stderr.write(`${NAME}: RESEARCH_TIMEOUT after ${RESEARCH_TIMEOUT}ms\n`);
  process.exit(1);
}, RESEARCH_TIMEOUT);

// prevent timer from keeping event loop alive if process exits early
timer.unref?.();

// capture stdout/stderr from child (mirrors spawnCapture semantics)
let stdout = "";
let stderr = "";
child.stdout.on("data", (d) => { stdout += d; });
child.stderr.on("data", (d) => { stderr += d; });

const result = await new Promise((resolve) => {
  child.on("error", (err) => {
    resolve({ ok: false, code: 1, stdout, stderr: stderr || `spawn failed: ${err.message}` });
  });
  child.on("close", (code) => {
    resolve({ ok: code === 0, code: code ?? 1, stdout, stderr });
  });
});

clearTimeout(timer);

if (!result.ok) {
  process.stderr.write(`${NAME}: harness failed (exit ${result.code})\n`);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exit(1);
}

writeFindings(outputPath, result.stdout);
exitOk();
