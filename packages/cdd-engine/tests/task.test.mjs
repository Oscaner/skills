// packages/cdd-engine/tests/task.test.mjs — Vitest port of the legacy cdd-task CLI contract tests, now
// exercised through the merged single CLI (bin/cdd.mjs). Invocations map:
//   cdd-task --mode implement    → cdd implement
//   (legacy review mode)         → cdd review --type task (mode 名归一后 runner CDD_MODE=review)
//   cdd-task --mode fix          → cdd fix --type task
// CDD_DRY_RUN=1 skips real CLI invocation; runTask still walks registry ship gate /
// template render / workspace resolution / commit-contract. Asserts H1 four-line
// output + exit codes.
// Commander.js v15 migration notes:
//   - parse/usage errors are mapped to exit 2 + `usage:` on stderr (exitOverride);
//   - Bug A: --task <n> parseInt coercion rejects non-integers with exit 2.
import { describe, it, expect } from 'vitest';
import { spawnSync, execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gitCommit, gitInit, forkLifecyclePath } from './helpers.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)); // packages/cdd-engine/tests
const REPO_ROOT = path.resolve(HERE, '..', '..', '..');
const CDD_MJS = path.join(REPO_ROOT, 'packages/cdd-engine/bin/cdd.mjs');
// Task 3 fork 隔离（spec §2.2 A / §2.6）：bin 启动 reapStale 读写 lifecycle 盘文件 —— 每 fork 注入
// 唯一 tmp 路径，避免并发 fork 共享 <cwd>/.superpowers/cdd/lifecycle.json 时启动 reapStale 误杀
// 另一 fork in-flight 组（ownerPid 异判为 orphan）。
const LIFECYCLE_PATH = forkLifecyclePath("task");

// Test env: strip any CDD_* inherited from an orchestrator session, then overlay test extras.
function cleanEnv(extra) {
  const env = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (!k.startsWith('CDD_')) env[k] = v;
  }
  return { ...env, ...extra, CDD_LIFECYCLE_PATH: LIFECYCLE_PATH };
}

// Spawn the CLI as a subprocess (cwd = repo root); returns { status, stdout, stderr }.
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

// F11: 纯 CDD_WORKSPACE 直设分支 fixture（非 git，plan 缺省）—— progress/plan-constraints 最小集，
// brief 由用例自写（读既有兼容断言）或留空（不生成断言）。
function setupPlainWorkspace() {
  const ws = mkdtempSync(path.join(tmpdir(), `cdd-task-ws-${Date.now()}-${Math.random().toString(36).slice(2)}`));
  writeFileSync(path.join(ws, 'progress.json'), JSON.stringify({ plan: '', timeoutCount: 0, engineRecoveryCount: 0, tasks: [] }));
  writeFileSync(path.join(ws, 'plan-constraints.md'), 'constraints\n');
  return ws;
}

describe('cdd implement/review/fix CLI contract', () => {
  it('dry-run implement → H1 four lines APPROVED + exit 0', () => {
    const ws = setupWorkspace();
    const res = run(
      ['implement', '--task', '1', '--plan', path.join(ws, 'plan.md')],
      { CDD_DRY_RUN: '1', CDD_WORKSPACE: ws, CLAUDE_CODE_SESSION_ID: '1' },
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
  // 产物 = <plan-derived ws>/task-N-brief.md + TASK_BASE: <HEAD>。
  it('implement --plan without a pre-existing brief → self-provisions task-N-brief.md with TASK_BASE:', () => {
    const ws = setupWorkspace();
    const res = run(
      ['implement', '--task', '1', '--plan', path.join(ws, 'plan.md')],
      { CDD_DRY_RUN: '1', CDD_WORKSPACE: ws, CLAUDE_CODE_SESSION_ID: '1' },
    );
    expect(res.status).toBe(0);
    const brief = path.join(ws, '.superpowers', 'cdd', 'plan', 'task-1-brief.md');
    expect(existsSync(brief)).toBe(true);
    expect(readFileSync(brief, 'utf8')).toMatch(/^TASK_BASE: [0-9a-f]{40}$/m);
  });

  // F11 override 对齐（branch-review r1 nit）：写侧 `CDD_TASK_BRIEF || briefPath` 与读侧
  // buildTaskEnv `CDD_TASK_BRIEF ||= <派生>` 同一解析 —— override set 时 self-provision 落 override
  // 路径（非缺省派生），杜绝 fresh-brief/read 分叉。dry-run 下 brief 生成照常执行（同 L94 变体）。
  it('implement --plan with CDD_TASK_BRIEF override → self-provisions to the override path (b/read parity)', () => {
    const ws = setupWorkspace();
    const override = path.join(ws, 'alt', 'task-1-brief.md');
    const res = run(
      ['implement', '--task', '1', '--plan', path.join(ws, 'plan.md')],
      {
        CDD_DRY_RUN: '1',
        CDD_WORKSPACE: ws,
        CDD_TASK_BRIEF: override,
        CLAUDE_CODE_SESSION_ID: '1',
      },
    );
    expect(res.status).toBe(0);
    expect(readFileSync(override, 'utf8')).toMatch(/^TASK_BASE: [0-9a-f]{40}$/m);
    // 缺省派生路径保持未生成（写侧已 honor override，未双写）
    expect(existsSync(path.join(ws, '.superpowers', 'cdd', 'plan', 'task-1-brief.md'))).toBe(false);
  });

  // F11 越界保护：plan 有 Task 1 无 Task 9 → BLOCKED + exit 1（不静默降级为「读既有/空 brief 放行」）。
  it('implement --plan with task missing from plan (out of bounds) → BLOCKED + exit 1 (no silent degradation)', () => {
    const ws = setupWorkspace();
    const res = run(
      ['implement', '--task', '9', '--plan', path.join(ws, 'plan.md')],
      { CDD_DRY_RUN: '1', CDD_WORKSPACE: ws, CLAUDE_CODE_SESSION_ID: '1' },
    );
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/CDD_BLOCKED/);
    expect(res.stderr).toMatch(/task 9 not found/);
  });

  // F11 兼容分支：纯 CDD_WORKSPACE（无 plan）→ 不生成，读既有 brief（直设分支语义不变）。
  it('pure CDD_WORKSPACE without plan → no auto-generation, pre-existing brief read as-is (compat)', () => {
    const ws = setupPlainWorkspace();
    writeFileSync(path.join(ws, 'task-1-brief.md'), '# task 1\nTASK_BASE: abc123\n');
    const res = run(
      ['implement', '--task', '1'],
      { CDD_DRY_RUN: '1', CDD_WORKSPACE: ws, CLAUDE_CODE_SESSION_ID: '1' },
    );
    expect(res.status).toBe(0);
    expect(readFileSync(path.join(ws, 'task-1-brief.md'), 'utf8')).toContain('TASK_BASE: abc123');
    expect(existsSync(path.join(ws, 'task-2-brief.md'))).toBe(false);
  });

  it('pure CDD_WORKSPACE without plan + no brief → exit 0, no brief auto-created', () => {
    const ws = setupPlainWorkspace();
    const res = run(
      ['implement', '--task', '1'],
      { CDD_DRY_RUN: '1', CDD_WORKSPACE: ws, CLAUDE_CODE_SESSION_ID: '1' },
    );
    expect(res.status).toBe(0);
    expect(existsSync(path.join(ws, 'task-1-brief.md'))).toBe(false);
  });

  it('dry-run review/fix (type task) → status APPROVED + exit 0', () => {
    const cases = [
      ['review', '--type', 'task'],
      ['fix', '--type', 'task'],
    ];
    for (const [sub, , type] of cases) {
      const ws = setupWorkspace();
      const res = run(
        [sub, '--type', type, '--task', '1', '--plan', path.join(ws, 'plan.md')],
        { CDD_DRY_RUN: '1', CDD_WORKSPACE: ws, CLAUDE_CODE_SESSION_ID: '1' },
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
    const ws = setupWorkspace();
    const res = run(
      ['implement', '--plan', path.join(ws, 'plan.md')],
      { CDD_DRY_RUN: '1', CDD_WORKSPACE: ws, CLAUDE_CODE_SESSION_ID: '1' },
    );
    expect(res.status).toBe(2);
    expect(res.stderr).toMatch(/^usage: /);
  });

  it('unknown option → usage stderr + exit 2', () => {
    const res = run(['implement', '--task', '1', '--bogus', 'x'], { CLAUDE_CODE_SESSION_ID: '1' });
    expect(res.status).toBe(2);
    expect(res.stderr).toMatch(/^usage: /);
  });

  it('review unknown --type → error stderr + exit 2 (runReview type validation)', () => {
    const ws = setupWorkspace();
    const res = run(
      ['review', '--type', 'handoff', '--task', '1', '--plan', path.join(ws, 'plan.md')],
      { CDD_DRY_RUN: '1', CDD_WORKSPACE: ws, CLAUDE_CODE_SESSION_ID: '1' },
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