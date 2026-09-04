#!/usr/bin/env node
// bin/cdd-task.mjs — CDD per-task runner. Commander.js v15.
//   cdd-task --harness <name> --task N --mode implement|task-review|fix [--plan PATH] [--scope SCOPE]
// --plan optional: sets PLAN_FILE env for workspace resolution. --scope optional
// (fix mode only): blocker-only (default) | deferred-sweep. CDD_DRY_RUN=1 skips the
// harness CLI (argument parsing / orchestration smoke tests).
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Command } from 'commander';
import { runTask } from './lib/runner.mjs';
import { exitOk, exitCliMissing } from './utils/exit.mjs';

const USAGE = 'usage: cdd-task --harness <name> --task N --mode implement|task-review|fix [--plan PATH] [--scope SCOPE]';

const program = new Command();
program
  .name('cdd-task')
  .description('CDD per-task runner: implement | task-review | fix')
  .requiredOption('--harness <name>', 'harness name (e.g. claude, cursor-agent)')
  // Bug A fix: parseInt coercion converts the --task string into a number.
  .requiredOption('--task <n>', 'task number', (v) => {
    const n = parseInt(v, 10);
    if (isNaN(n)) throw new Error(`--task must be an integer, got: ${v}`);
    return n;
  })
  .requiredOption('--mode <mode>', 'implement|task-review|fix')
  .option('--plan <path>', 'plan file path (sets PLAN_FILE for workspace resolution)')
  .option('--scope <scope>', 'fix mode scope: blocker-only (default) | deferred-sweep')
  .action(async (opts) => {
    const env = { ...process.env };
    if (opts.plan) env.PLAN_FILE = opts.plan;
    await runTask(opts.harness, opts.task, {
      mode: opts.mode,
      dryRun: process.env.CDD_DRY_RUN === '1',
      env,
      scope: opts.scope,
    });
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
      // Action errors (e.g. Bug A parseInt coercion) → error message + exit 2.
      process.stderr.write(`${e.message}\n`);
    }
    exitCliMissing();
  });
}