// bin/tests/docs-task.test.mjs — Vitest port of the docs review/fix CLI tests, now
// exercised through the merged single CLI (bin/cdd.mjs). Invocation map:
//   docs-task --mode review --template <t>  → cdd review --type spec|plan [--doc <path>]
//   docs-task --mode fix --template <t>     → cdd fix --type spec|plan [--doc <path>]
// Covers: Commander usage/help, dry-run review/fix, and Bug K regression
// (docs workspace = <repoRoot>/.superpowers/docs-review/) via the exported
// merged-surface helper.
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { docsReviewWorkspace } from '../cdd.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)); // packages/cdd-engine/bin/tests
const REPO_ROOT = path.resolve(HERE, '..', '..', '..', '..');
const CDD_MJS = path.join(REPO_ROOT, 'packages/cdd-engine/bin/cdd.mjs');

function run(args, extraEnv = {}) {
  const env = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (!k.startsWith('CDD_')) env[k] = v;
  }
  return spawnSync('node', [CDD_MJS, ...args], {
    cwd: REPO_ROOT,
    env: { ...env, ...extraEnv },
    encoding: 'utf8',
  });
}

describe('cdd review/fix --type spec|plan CLI contract', () => {
  it('-h → Commander help on stdout + exit 0', () => {
    const r = run(['-h']);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/^Usage: cdd/);
  });

  it('missing --harness → usage stderr + exit 2', () => {
    const r = run(['review', '--type', 'spec', '--doc', '/x.md']);
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/^usage: /);
  });

  it('missing --doc → stderr + exit 2', () => {
    const r = run(['review', '--type', 'spec', '--harness', 'claude']);
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/missing required --doc/);
  });

  it('dry-run review --type spec → exit 0', () => {
    const r = run(
      ['review', '--type', 'spec', '--harness', 'claude', '--doc', '/x.md'],
      { CDD_DRY_RUN: '1' },
    );
    expect(r.status, r.stderr).toBe(0);
  });

  it('dry-run review --type plan → exit 0', () => {
    const r = run(
      ['review', '--type', 'plan', '--harness', 'claude', '--doc', '/x.md'],
      { CDD_DRY_RUN: '1' },
    );
    expect(r.status, r.stderr).toBe(0);
  });

  it('dry-run fix --type spec → exit 0', () => {
    const r = run(
      ['fix', '--type', 'spec', '--harness', 'claude', '--doc', '/x.md'],
      { CDD_DRY_RUN: '1' },
    );
    expect(r.status, r.stderr).toBe(0);
  });

  it('dry-run fix --type plan → exit 0', () => {
    const r = run(
      ['fix', '--type', 'plan', '--harness', 'claude', '--doc', '/x.md'],
      { CDD_DRY_RUN: '1' },
    );
    expect(r.status, r.stderr).toBe(0);
  });
});

// ---- Bug K regression: docs workspace derives from repo root, not dirname(doc) ----

describe('Bug K: cdd docs review workspace', () => {
  it('resolves <repoRoot>/.superpowers/docs-review/ from the git toplevel', () => {
    // gitToplevel(process.cwd()) — vitest runs with cwd inside packages/cdd-engine,
    // which walks up to the repo root. dirname(doc)=/x would be /x/.superpowers/…
    // if the workspace wrongly derived from the doc path (Bug K).
    expect(docsReviewWorkspace()).toBe(path.join(REPO_ROOT, '.superpowers', 'docs-review'));
  });
});