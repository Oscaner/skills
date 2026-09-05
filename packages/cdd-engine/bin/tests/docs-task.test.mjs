// bin/tests/docs-task.test.mjs — Vitest port of docs-task.mjs CLI tests.
// Covers: Commander usage/help, dry-run review/fix + --param passthrough (subprocess),
// and Bug K regression (workspace = <repoRoot>/.superpowers/docs-review/) via unit test.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)); // packages/cdd-engine/bin/tests
const REPO_ROOT = path.resolve(HERE, '..', '..', '..', '..');
const DOCS_TASK = path.join(REPO_ROOT, 'packages/cdd-engine/bin/docs-task.mjs');

function run(args, extraEnv = {}) {
  const env = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (!k.startsWith('CDD_')) env[k] = v;
  }
  return spawnSync('node', [DOCS_TASK, ...args], {
    cwd: REPO_ROOT,
    env: { ...env, ...extraEnv },
    encoding: 'utf8',
  });
}

describe('docs-task.mjs CLI contract', () => {
  it('-h → Commander help on stdout + exit 0', () => {
    const r = run(['-h']);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/^Usage: docs-task/);
  });

  it('missing --harness → usage stderr + exit 2', () => {
    const r = run(['--mode', 'review', '--template', 'spec-review', '--doc', '/x.md']);
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/^usage: docs-task/);
  });

  it('missing --doc → usage stderr + exit 2', () => {
    const r = run(['--harness', 'claude', '--mode', 'review', '--template', 'spec-review']);
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/^usage: docs-task/);
  });

  it('dry-run review → exit 0 (runDocsTask dry-run short-circuit)', () => {
    const r = run(
      ['--harness', 'claude', '--mode', 'review', '--template', 'spec-review', '--doc', '/x.md'],
      { CDD_DRY_RUN: '1' },
    );
    expect(r.status, r.stderr).toBe(0);
    expect(r.stderr).toBe('');
  });

  it('dry-run fix → exit 0', () => {
    const r = run(
      ['--harness', 'claude', '--mode', 'fix', '--template', 'spec-review', '--doc', '/x.md'],
      { CDD_DRY_RUN: '1' },
    );
    expect(r.status, r.stderr).toBe(0);
  });

  it('dry-run with --param KEY=VALUE → exit 0 (collect passthrough does not crash)', () => {
    const r = run(
      ['--harness', 'claude', '--mode', 'review', '--template', 'plan-review',
       '--doc', '/x.md', '--param', 'SPEC=/some/spec.md'],
      { CDD_DRY_RUN: '1' },
    );
    expect(r.status, r.stderr).toBe(0);
  });
});

// ---- Bug K regression: workspace derives from repoRoot, not dirname(doc) ----

vi.mock('../lib/docs-runner.mjs', () => ({
  runDocsTask: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../lib/contract.mjs', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, gitToplevel: vi.fn(() => '/repo/root') };
});

import { runDocsTask } from '../lib/docs-runner.mjs';
import { docsTaskAction } from '../docs-task.mjs';

beforeEach(() => vi.clearAllMocks());

describe('Bug K: docs-task workspace', () => {
  it('passes .superpowers/docs-review as workspace, not dirname(doc)', async () => {
    await docsTaskAction({
      harness: 'claude',
      mode: 'review',
      template: 'spec-review',
      doc: '/repo/root/docs/superpowers/specs/my-spec.md',
      param: { PASS: 'completeness' },
    });

    expect(runDocsTask).toHaveBeenCalledWith(
      expect.objectContaining({
        workspace: '/repo/root/.superpowers/docs-review',
        repoRoot: '/repo/root',
      })
    );
    expect(runDocsTask).not.toHaveBeenCalledWith(
      expect.objectContaining({
        workspace: expect.stringContaining('docs/superpowers'),
      })
    );
  });
});