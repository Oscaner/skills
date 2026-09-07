// bin/tests/task.test.mjs — Vitest port of the legacy cdd-task CLI contract tests, now
// exercised through the merged single CLI (bin/cdd.mjs). Invocations map:
//   cdd-task --mode implement    → cdd implement
//   cdd-task --mode task-review  → cdd review --type task
//   cdd-task --mode fix          → cdd fix --type task
// CDD_DRY_RUN=1 skips real CLI invocation; runTask still walks registry ship gate /
// template render / workspace resolution / commit-contract. Asserts H1 four-line
// output + exit codes.
// Commander.js v15 migration notes:
//   - parse/usage errors are mapped to exit 2 + `usage:` on stderr (exitOverride);
//   - Bug A: --task <n> parseInt coercion rejects non-integers with exit 2.
import { describe, it, expect } from 'vitest';
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gitCommit, gitInit } from './helpers.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)); // packages/cdd-engine/bin/tests
const REPO_ROOT = path.resolve(HERE, '..', '..', '..', '..');
const CDD_MJS = path.join(REPO_ROOT, 'packages/cdd-engine/bin/cdd.mjs');

// Test env: strip any CDD_* inherited from an orchestrator session, then overlay test extras.
function cleanEnv(extra) {
  const env = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (!k.startsWith('CDD_')) env[k] = v;
  }
  return { ...env, ...extra };
}

// Spawn the CLI as a subprocess (cwd = repo root); returns { status, stdout, stderr }.
function run(args, extraEnv = {}, opts = {}) {
  const res = spawnSync('node', [CDD_MJS, ...args], {
    cwd: opts.cwd ?? REPO_ROOT,
    env: cleanEnv(extraEnv),
    encoding: 'utf8',
  });
  return { status: res.status, stdout: res.stdout ?? '', stderr: res.stderr ?? '' };
}

// #173: plan must live inside a git repo (repoRoot = gitToplevel(dirname(plan)) —
// never falls back to caller cwd). gitCommit keeps the working tree clean
// (commit-contract validation).
function setupWorkspace() {
  const dir = path.join(tmpdir(), `cdd-task-cli-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const real = mkdtempSync(dir);
  gitInit(real);
  writeFileSync(path.join(real, 'plan.md'), '# Plan\n### Task 1: test\n');
  gitCommit(real);
  return real;
}

describe('cdd implement/review/fix CLI contract', () => {
  it('dry-run implement → H1 four lines APPROVED + exit 0', () => {
    const ws = setupWorkspace();
    const res = run(
      ['implement', '--harness', 'claude', '--task', '1', '--plan', path.join(ws, 'plan.md')],
      { CDD_DRY_RUN: '1', CDD_WORKSPACE: ws },
    );
    expect(res.status).toBe(0);
    const lines = res.stdout.trim().split('\n');
    expect(lines.length).toBe(4);
    expect(lines[0]).toBe('status: APPROVED');
    expect(lines[1]).toBe('commits: base=dry-run');
    expect(lines[2]).toMatch(/^artifacts: brief=/);
    expect(lines[3]).toBe('blocker: none');
  });

  it('dry-run review/fix (type task) → status APPROVED + exit 0', () => {
    const cases = [
      ['review', '--type', 'task'],
      ['fix', '--type', 'task'],
    ];
    for (const [sub, , type] of cases) {
      const ws = setupWorkspace();
      const res = run(
        [sub, '--type', type, '--harness', 'claude', '--task', '1', '--plan', path.join(ws, 'plan.md')],
        { CDD_DRY_RUN: '1', CDD_WORKSPACE: ws },
      );
      expect(res.status, `cdd ${sub} --type task`).toBe(0);
      expect(res.stdout).toMatch(/^status: APPROVED$/m);
    }
  });

  it('-h/--help → Commander help on stdout + exit 0', () => {
    for (const flag of ['-h', '--help']) {
      const res = run([flag]);
      expect(res.status, `flag ${flag}`).toBe(0);
      expect(res.stdout).toMatch(/^Usage: cdd/);
    }
  });

  it('missing --harness → usage stderr + exit 2', () => {
    const res = run(['implement', '--task', '1']);
    expect(res.status).toBe(2);
    expect(res.stderr).toMatch(/^usage: /);
  });

  it('unknown subcommand → usage stderr + exit 2', () => {
    const res = run(['frobnicate']);
    expect(res.status).toBe(2);
    expect(res.stderr).toMatch(/^usage: /);
  });

  it('implement --plan without --task → usage stderr + exit 2', () => {
    const ws = setupWorkspace();
    const res = run(
      ['implement', '--harness', 'claude', '--plan', path.join(ws, 'plan.md')],
      { CDD_DRY_RUN: '1', CDD_WORKSPACE: ws },
    );
    expect(res.status).toBe(2);
    expect(res.stderr).toMatch(/^usage: /);
  });

  it('unknown option → usage stderr + exit 2', () => {
    const res = run(['implement', '--harness', 'claude', '--task', '1', '--bogus', 'x']);
    expect(res.status).toBe(2);
    expect(res.stderr).toMatch(/^usage: /);
  });

  it('review unknown --type → error stderr + exit 2 (runReview type validation)', () => {
    const ws = setupWorkspace();
    const res = run(
      ['review', '--type', 'handoff', '--harness', 'claude', '--task', '1', '--plan', path.join(ws, 'plan.md')],
      { CDD_DRY_RUN: '1', CDD_WORKSPACE: ws },
    );
    expect(res.status).toBe(2);
    expect(res.stderr).toMatch(/unknown review --type: handoff/);
  });

  it('Bug A regression: --task with non-integer string exits with error', async () => {
    expect(() => execFileSync('node', [
      CDD_MJS,
      'implement', '--harness', 'claude', '--task', 'abc',
    ], { encoding: 'utf8', stdio: 'pipe' })).toThrow();
  });
});