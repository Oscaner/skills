#!/usr/bin/env node
// bin/docs-task.mjs — docs review/fix runner. Commander.js v15.
// Bug K fix: workspace = <repoRoot>/.superpowers/docs-review/ (not dirname(doc)).
//   docs-task --harness <name> --mode review|fix --template <name> --doc <path> [--param KEY=VALUE]
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Command } from 'commander';
import { runDocsTask } from './lib/docs-runner.mjs';
import { gitToplevel } from './lib/contract.mjs';
import { exitOk, exitCliMissing } from './utils/exit.mjs';

const USAGE = 'usage: docs-task --harness <name> --mode review|fix --template <name> --doc <path> [--param KEY=VALUE]';

const program = new Command();
program
  .name('docs-task')
  .description('Docs review/fix runner for spec and plan documents')
  .requiredOption('--harness <name>', 'harness name')
  .requiredOption('--mode <mode>', 'review|fix')
  .requiredOption('--template <name>', 'template name (e.g. spec-review, plan-review)')
  .requiredOption('--doc <path>', 'path to document being reviewed')
  .option('--param <kv>', 'template parameter KEY=VALUE (repeatable)', (v, prev) => {
    const [k, ...rest] = v.split('=');
    return { ...(prev || {}), [k]: rest.join('=') };
  }, {})
  .action(async (opts) => {
    await docsTaskAction(opts);
  });

// Exported so Bug K tests can call the action directly (no subprocess, mockable imports).
export async function docsTaskAction(opts) {
  const repoRoot = gitToplevel(process.cwd());
  if (!repoRoot) {
    process.stderr.write('docs-task: not in a git repo\n');
    exitCliMissing();
  }
  // Bug K fix: workspace = <repoRoot>/.superpowers/docs-review/
  const workspace = path.join(repoRoot, '.superpowers', 'docs-review');
  await runDocsTask({
    harness: opts.harness,
    mode: opts.mode,
    template: opts.template,
    doc: opts.doc,
    params: opts.param,
    workspace,
    repoRoot,
    dryRun: process.env.CDD_DRY_RUN === '1',
  });
}

// Only parse argv when executed as the main entry (imports from tests must be inert).
const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  program.exitOverride();
  program.configureOutput({ outputError: () => {} });
  program.parseAsync(process.argv).catch((e) => {
    if (e.code === 'commander.helpDisplayed') {
      exitOk();
    }
    if (typeof e.code === 'string' && e.code.startsWith('commander.')) {
      process.stderr.write(`${USAGE}\n`);
    } else {
      process.stderr.write(`${e.message}\n`);
    }
    exitCliMissing();
  });
}