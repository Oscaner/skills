// packages/cdd-engine/tests/task.test.mjs — Vitest port of the legacy cdd-task CLI contract tests, now
// exercised through the merged single CLI (bin/cdd.mjs). Invocations map:
//   cdd-task --mode implement    → cdd implement
//   (legacy review mode)         → cdd review --type task (mode 名归一后 runner CDD_MODE=review)
//   cdd-task --mode fix          → cdd fix --type task
// The program-level `--dry-run` flag leads the argv and skips real CLI invocation; runTask still walks
// registry ship gate / template render / workspace resolution / commit-contract. Asserts H1 four-line
// output + exit codes.
// P4 §2.3.1 根注入契约（黑盒形）：root = bin preAction 的 initRoot() = cwd 的 git toplevel —— 故每条
// 用例用 `cwd: <tmp repo>` 把 root 落在自己的真仓里，plan 经 `--plan`（仓根相对）提供。
// Commander.js v15 migration notes:
//   - parse/usage errors are mapped to exit 2 + `usage:` on stderr (exitOverride);
//   - Bug A: --task <n> parseInt coercion rejects non-integers with exit 2.
import { describe, it, expect } from 'vitest';
import { spawnSync, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gitCommit, gitInit } from './helpers.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)); // packages/cdd-engine/tests
const REPO_ROOT = path.resolve(HERE, '..', '..', '..');
const CDD_MJS = path.join(REPO_ROOT, 'packages/cdd-engine/bin/cdd.mjs');

// Test env: strip any CDD_* inherited from an orchestrator session, then overlay test extras.
function cleanEnv(extra) {
  const env = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (!k.startsWith('CDD_')) env[k] = v;
  }
  return { ...env, ...extra };
}

// Spawn the CLI as a subprocess; returns { status, stdout, stderr }.
function run(args, extraEnv = {}, opts = {}) {
  const env = cleanEnv(extraEnv);
  // T3: host detection is ambient-env driven — a test that needs a truly host-free env must
  // explicitly delete the host markers (parent session may carry CLAUDE_CODE_SESSION_ID/AI_AGENT).
  if (opts.noHost) {
    delete env.CLAUDE_CODE_SESSION_ID;
    delete env.CURSOR_TRACE_ID;
    delete env.AI_AGENT;
  }
  const res = spawnSync('node', [CDD_MJS, ...args], {
    cwd: opts.cwd ?? REPO_ROOT,
    env,
    encoding: 'utf8',
  });
  return { status: res.status, stdout: res.stdout ?? '', stderr: res.stderr ?? '' };
}

// 真仓 fixture：mkdtemp + gitInit + 仓根内 plan（`--plan` 的仓根相对路径）+ 干净工作树
//（commit-contract 前提）。workspace 由 engine 纯派生：<repo>/.osuperpowers/cdd/plan。
function setupWorkspace() {
  const repo = realpathSync(mkdtempSync(path.join(tmpdir(), `cdd-task-cli-${Date.now()}-${Math.random().toString(36).slice(2)}`)));
  gitInit(repo);
  const plans = path.join(repo, 'docs', 'osuperpowers', 'plans');
  mkdirSync(plans, { recursive: true });
  writeFileSync(path.join(plans, 'plan.md'), '# Plan\n\n### Task 1: test\n');
  gitCommit(repo);
  return { repo, plan: path.join('docs', 'osuperpowers', 'plans', 'plan.md'), ws: path.join(repo, '.osuperpowers', 'cdd', 'plan') };
}

const HOST = { CLAUDE_CODE_SESSION_ID: '1' };

describe('cdd implement/review/fix CLI contract', () => {
  it('dry-run implement → H1 four lines APPROVED + exit 0', () => {
    const { repo, plan } = setupWorkspace();
    const res = run(
      ['--dry-run', 'implement', '--task', '1', '--plan', plan],
      HOST,
      { cwd: repo },
    );
    expect(res.status).toBe(0);
    const lines = res.stdout.trim().split('\n');
    expect(lines.length).toBe(4);
    expect(lines[0]).toBe('status: APPROVED');
    expect(lines[1]).toBe('commits: base=dry-run');
    expect(lines[2]).toMatch(/^artifacts: brief=/);
    expect(lines[3]).toBe('blocker: none');
  });

  // F11: implement --plan 无前置 brief → runTask 自供应（plan 定稿处 generateBrief）；
  // 产物 = plan-derived ws/task-N-brief.md + TASK_BASE: <HEAD>。
  it('implement --plan without a pre-existing brief → self-provisions task-N-brief.md with TASK_BASE:', () => {
    const { repo, plan, ws } = setupWorkspace();
    const res = run(
      ['--dry-run', 'implement', '--task', '1', '--plan', plan],
      HOST,
      { cwd: repo },
    );
    expect(res.status).toBe(0);
    const brief = path.join(ws, 'task-1-brief.md');
    expect(existsSync(brief)).toBe(true);
    expect(readFileSync(brief, 'utf8')).toMatch(/^TASK_BASE: [0-9a-f]{40}$/m);
  });

  // F11 越界保护：plan 有 Task 1 无 Task 9 → BLOCKED + exit 1（不静默降级为「读既有/空 brief 放行」）。
  it('implement --plan with task missing from plan (out of bounds) → BLOCKED + exit 1 (no silent degradation)', () => {
    const { repo, plan } = setupWorkspace();
    const res = run(
      ['--dry-run', 'implement', '--task', '9', '--plan', plan],
      HOST,
      { cwd: repo },
    );
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/CDD_BLOCKED/);
    expect(res.stderr).toMatch(/task 9 not found/);
  });

  it('dry-run review/fix (type task) → status APPROVED + exit 0', () => {
    const cases = [
      ['review', '--type', 'task'],
      ['fix', '--type', 'task'],
    ];
    for (const [sub, , type] of cases) {
      const { repo, plan } = setupWorkspace();
      const res = run(
        ['--dry-run', sub, '--type', type, '--task', '1', '--plan', plan],
        HOST,
        { cwd: repo },
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

  it('no host env → CDD_BLOCKED + exit 1 (harness resolved from ambient host, no flag)', () => {
    const res = run(['implement', '--task', '1'], {}, { noHost: true });
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/no host harness detected|CDD_BLOCKED/);
  });

  it('unknown subcommand → usage stderr + exit 2', () => {
    const res = run(['frobnicate']);
    expect(res.status).toBe(2);
    expect(res.stderr).toMatch(/^usage: /);
  });

  it('implement --plan without --task → usage stderr + exit 2', () => {
    const { repo, plan } = setupWorkspace();
    const res = run(
      ['--dry-run', 'implement', '--plan', plan],
      HOST,
      { cwd: repo },
    );
    expect(res.status).toBe(2);
    expect(res.stderr).toMatch(/^usage: /);
  });

  it('unknown option → usage stderr + exit 2', () => {
    const res = run(['implement', '--task', '1', '--bogus', 'x'], HOST);
    expect(res.status).toBe(2);
    expect(res.stderr).toMatch(/^usage: /);
  });

  it('review unknown --type → error stderr + exit 2 (runReview type validation)', () => {
    const { repo, plan } = setupWorkspace();
    const res = run(
      ['--dry-run', 'review', '--type', 'handoff', '--task', '1', '--plan', plan],
      HOST,
      { cwd: repo },
    );
    expect(res.status).toBe(2);
    expect(res.stderr).toMatch(/unknown review --type: handoff/);
  });

  it('Bug A regression: --task with non-integer string exits with error', async () => {
    expect(() => execFileSync('node', [
      CDD_MJS,
      'implement', '--task', 'abc',
    ], { encoding: 'utf8', stdio: 'pipe', env: cleanEnv() })).toThrow();
  });
});