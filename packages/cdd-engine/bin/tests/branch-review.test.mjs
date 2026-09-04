// packages/cdd-engine/bin/tests/branch-review.test.mjs
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..'); // bin/tests → packages/cdd-engine → packages → repo

describe('branch-review dry-run', () => {
  it('writes CDD handoff to .superpowers/cdd/<slug>/ with CDD schema fields', () => {
    const planPath = path.join(REPO_ROOT, 'docs', 'superpowers', 'plans', 'test-plan-br.md');
    const slug = 'test-plan-br';
    const handoffPath = path.join(REPO_ROOT, '.superpowers', 'cdd', slug,
                                  'branch-review-abc1234..def5678.json');

    if (existsSync(handoffPath)) unlinkSync(handoffPath);

    const out = execFileSync('node', [
      path.join(REPO_ROOT, 'packages', 'cdd-engine', 'bin', 'branch-review.mjs'),
      '--harness', 'claude',
      '--plan', planPath,
      '--base', 'abc1234',
      '--head', 'def5678',
    ], { env: { ...process.env, CDD_DRY_RUN: '1' }, encoding: 'utf8' });

    expect(out).toContain('status: APPROVED');
    expect(out).toContain('commits: base=abc1234 head=def5678');
    expect(existsSync(handoffPath)).toBe(true);

    const handoff = JSON.parse(readFileSync(handoffPath, 'utf8'));
    expect(handoff).toHaveProperty('status');
    expect(handoff).toHaveProperty('commits');
    expect(handoff.commits).toHaveProperty('base', 'abc1234');
    expect(handoff.commits).toHaveProperty('head', 'def5678');
    expect(handoff).toHaveProperty('findings');
    expect(handoff).toHaveProperty('blocker');
    expect(handoff).not.toHaveProperty('doc_path');
  });
});