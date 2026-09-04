#!/usr/bin/env node
// branch-review.mjs — Whole-branch code review. Commander.js v15.
// Enh D: independent CLI for git-diff-level review (not docs-task pipeline).
// Uses CDD handoff schema (status/commits/findings/artifacts/blocker, no doc_path).
import { Command } from 'commander';
import path from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import { loadRegistry, checkHarness, CddBlockedError } from './lib/registry.mjs';
import { renderTemplate } from './lib/templates.mjs';
import { loadHandoffSchema } from './lib/schema-utils.mjs';
import { renderHandoffStub, PKG_ROOT } from './lib/templates.mjs';
import { invokeCliWithRetry, resolveTimeoutMs } from './lib/cli-shared.mjs';
import { gitToplevel, writeHandoff } from './lib/contract.mjs';
import { exitOk, exitBlocked, exitCliMissing, exitWithCode } from './utils/exit.mjs';
import { fileURLToPath } from 'node:url';

const REG_PATH = fileURLToPath(new URL('./harness-registry.json', import.meta.url));
const DRY_RUN = process.env.CDD_DRY_RUN === '1';

const program = new Command();
program
  .name('branch-review')
  .description('Whole-branch code review against a plan (CDD handoff schema)')
  .requiredOption('--harness <name>', 'harness name')
  .requiredOption('--plan <path>',   'path to plan file (used for workspace slug + context)')
  .requiredOption('--base <sha>',    'base commit SHA')
  .requiredOption('--head <sha>',    'head commit SHA')
  .option('--round <n>', 'review round number', (v) => parseInt(v, 10), 1)
  .action(async (opts) => {
    const { harness, plan, base, head, round } = opts;

    // Harness registry gate
    let entry;
    try {
      entry = checkHarness(loadRegistry(REG_PATH), harness, { dryRun: DRY_RUN });
    } catch (e) {
      if (e instanceof CddBlockedError) {
        process.stderr.write(`${e.message}\n`);
        e.kind === 'cli-missing' ? exitCliMissing() : exitBlocked();
      }
      throw e;
    }

    // Derive workspace + handoff path
    const repoRoot = gitToplevel(process.cwd());
    if (!repoRoot) { process.stderr.write('branch-review: not in a git repo\n'); exitBlocked(); }
    const slug   = path.basename(plan, '.md');
    const base7  = String(base).slice(0, 7);
    const head7  = String(head).slice(0, 7);
    const workspace  = path.join(repoRoot, '.superpowers', 'cdd', slug);
    // Per-round handoff filename: round 1 → ..._r1.json (branch-fix-loop re-reviews reuse distinct files)
    const handoffFile = `branch-review-${base7}..${head7}-r${round}.json`;
    const handoffPath = path.join(workspace, handoffFile);
    mkdirSync(workspace, { recursive: true });

    if (DRY_RUN) {
      writeHandoff(handoffPath, {
        task: 0, phase: 'branch-review', status: 'APPROVED',
        commits: { base, head }, findings: [], artifacts: {}, blocker: 'dry-run',
      });
      process.stdout.write(`status: APPROVED\ncommits: base=${base} head=${head}\nartifacts: \nblocker: dry-run\n`);
      exitOk();
      return;
    }

    // Render branch-review template
    const schema = loadHandoffSchema();
    const handoffStub = renderHandoffStub(schema, 'branch-review', 0);
    const prompt = renderTemplate('branch-review', {
      BASE: base, HEAD: head, PLAN: plan,
      HANDOFF: handoffPath, HANDOFF_STUB: handoffStub,
    }, 'branch-review');

    // Invoke harness CLI
    const timeoutMs = resolveTimeoutMs(process.env, 'review');
    const res = await invokeCliWithRetry(entry, prompt, 'branch-review', process.env, repoRoot, timeoutMs);

    if (!res.ok) {
      if (!existsSync(handoffPath)) {
        writeHandoff(handoffPath, {
          task: 0, phase: 'branch-review', status: 'BLOCKED',
          commits: { base, head }, findings: [], artifacts: {},
          blocker: `cli exited ${res.code} without writing handoff`,
        });
      }
      process.stderr.write(`CDD_BLOCKED: branch-review failed (exit ${res.code})\n`);
      exitWithCode(1);
    }

    exitOk();
  });

program.parseAsync().catch((e) => {
  process.stderr.write(`${e.message}\n`);
  exitCliMissing();
});