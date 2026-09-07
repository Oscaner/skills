// packages/cdd-engine/bin/tests/branch-review.test.mjs
// Branch-review dry-run through the merged single CLI:
//   (legacy standalone branch-review bin) --harness <h> --plan <p> --base <b> --head <h>
//   → cdd review --type branch --harness <h> --plan <p> --base <b> --head <h>
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..'); // bin/tests → packages/cdd-engine → packages → repo
const PLAN_FILE = path.join(REPO_ROOT, '.superpowers', 'cdd', '.test-fixtures', 'test-plan-br.md');

describe('branch-review dry-run', () => {
  it('writes CDD handoff to .superpowers/cdd/<slug>/ with CDD schema fields', () => {
    const planPath = PLAN_FILE;
    const slug = 'test-plan-br';
    const handoffPath = path.join(REPO_ROOT, '.superpowers', 'cdd', slug,
                                  'branch-review-abc1234..def5678-r1.json');

    if (existsSync(handoffPath)) unlinkSync(handoffPath);
    mkdirSync(path.dirname(PLAN_FILE), { recursive: true });
    writeFileSync(PLAN_FILE, '# Test branch review plan\n\n### Task 1: n/a (branch-level smoke)\n');

    const out = execFileSync('node', [
      path.join(REPO_ROOT, 'packages', 'cdd-engine', 'bin', 'cdd.mjs'),
      'review', '--type', 'branch',
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