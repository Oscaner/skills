#!/usr/bin/env node
// bin/cdd-research.mjs — standalone research runner (independent of cdd-task).
// Commander.js v15 port of the legacy cdd-research CLI:
//   cdd-research --harness <name> --brief <path> --output <path>
// Spawns the harness CLI directly (spawnCapture, NOT invokeCli) with the research
// prompt. CDD_DRY_RUN=1 skips harness invocation (argument parsing / smoke tests).
// RESEARCH_TIMEOUT env overrides the research timeout (default 1800000ms).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Command } from 'commander';
import { loadRegistry, checkHarness, CddBlockedError } from './lib/registry.mjs';
import { spawnCapture, resolveTimeoutMs } from './lib/cli-shared.mjs';
import { buildResearchPrompt, writeFindings } from './lib/research.mjs';
import { exitOk, exitCliMissing, exitBlocked, exitWithCode } from './utils/exit.mjs';

const NAME = path.basename(fileURLToPath(import.meta.url));
const REG_PATH = process.env.CDD_REGISTRY_PATH
  || fileURLToPath(new URL('./harness-registry.json', import.meta.url));
const DRY_RUN = process.env.CDD_DRY_RUN === '1';

const USAGE = `usage: ${NAME} --harness <name> --brief <path> --output <path> [-h/--help]`;

const program = new Command();
program
  .name('cdd-research')
  .description('Standalone research runner (independent of cdd-task)')
  .requiredOption('--harness <name>', 'harness name')
  .requiredOption('--brief <path>', 'path to research brief markdown')
  .requiredOption('--output <path>', 'path to write findings markdown')
  .action(async (opts) => {
    // Brief validation (before harness gate — pure file check, no PATH dependency).
    let briefContent;
    try {
      briefContent = readFileSync(opts.brief, 'utf8');
    } catch (err) {
      process.stderr.write(`${NAME}: cannot read brief: ${err.message}\n`);
      exitBlocked();
    }

    // Harness registry gate.
    let entry;
    try {
      const reg = loadRegistry(REG_PATH);
      entry = checkHarness(reg, opts.harness, { dryRun: DRY_RUN });
    } catch (err) {
      if (err instanceof CddBlockedError) {
        if (err.kind === 'cli-missing') exitCliMissing(err.message);
        exitBlocked(err.message);
      }
      process.stderr.write(`${NAME}: ${err.message}\n`);
      exitWithCode(err.exitCode ?? 1);
    }

    const prompt = buildResearchPrompt(briefContent);

    // Dry-run short-circuit (argument parsing / smoke tests only).
    if (DRY_RUN) {
      exitOk();
    }

    // Spawn harness CLI directly (spawnCapture — research output is written verbatim,
    // no stream-json finalText extraction).
    const cli = entry.cli;
    const cliArgs = [...entry.invoke.split(/\s+/).filter(Boolean), prompt];
    const timeoutMs = resolveTimeoutMs(process.env, 'research');

    let result;
    try {
      result = await spawnCapture(cli, cliArgs, {
        cwd: process.cwd(),
        env: process.env,
        timeoutMs,
      });
    } catch (err) {
      process.stderr.write(`${NAME}: spawn error: ${err.message}\n`);
      exitWithCode(1);
    }

    // Timeout path: write partial findings (keep produced content) + TIMEOUT frontmatter + exit 1.
    if (result.timedOut) {
      process.stderr.write(`${NAME}: timeout after ${timeoutMs}ms\n`);
      writeFindings(opts.output, `${result.stdout}\n---\nstatus: TIMEOUT\n`);
      exitWithCode(1);
    }

    if (!result.ok) {
      process.stderr.write(`${NAME}: harness failed (exit ${result.code})\n`);
      if (result.stderr) process.stderr.write(result.stderr);
      exitWithCode(1);
    }

    writeFindings(opts.output, result.stdout);
    exitOk();
  });

// Only parse argv when executed as the main entry (imports from tests must be inert).
const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  program.exitOverride();
  // Silence Commander's own error lines — this CLI prints its own usage/message below.
  program.configureOutput({ outputError: () => {} });
  program.parseAsync(process.argv).catch((e) => {
    if (e.code === 'commander.helpDisplayed') {
      exitOk();
    }
    // Commander parse/usage errors (missing required option, unknown option, ...) → usage + exit 2.
    if (typeof e.code === 'string' && e.code.startsWith('commander.')) {
      process.stderr.write(`${USAGE}\n`);
    } else {
      // Action errors → error message + exit 2.
      process.stderr.write(`${e.message}\n`);
    }
    exitCliMissing();
  });
}