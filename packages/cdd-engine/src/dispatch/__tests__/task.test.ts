// packages/cdd-engine/src/dispatch/__tests__/task.test.ts
// exercised through the merged single CLI (dist/cli.mjs). Invocations map:
//   cdd-task --mode implement    → cdd implement
//   (legacy review mode)         → cdd review --type task (mode 名归一后 runner CDD_MODE=review)
//   cdd-task --mode fix          → cdd fix --type task
// The program-level `--dry-run` flag leads the argv and skips real CLI invocation; runTask still walks
// registry ship gate / template render / workspace resolution / commit-contract. Asserts return block four-line
// output + exit codes.
// P4 §2.3.1 根注入契约（黑盒形）：root = bin preAction 的 initRoot() = cwd 的 git toplevel —— 故每条
// 用例用 `cwd: <tmp repo>` 把 root 落在自己的真仓里，plan 经 `--plan`（仓根相对）提供。
// citty (Task 9) migration notes:
//   - parse/usage errors are normalized to exit 2 + a `usage:` line on stderr (bin wrapper);
//   - Bug A (P4.3 list model): --tasks <n|n,n,…> per-token integer validation rejects
//     non-integers / empty slices with exit 2 (`--tasks must be comma-separated integers: <token>`).
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gitCommit, gitInit } from "../../infra/__tests__/helpers.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url)); 
const REPO_ROOT = path.resolve(HERE, '..', '..', '..', '..', '..');
const CDD_MJS = path.join(REPO_ROOT, 'packages/cdd-engine/dist/cli.mjs');

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
  // Host detection is ambient-env driven — a test needing a truly host-free env must
  // explicitly delete the host markers (parent session may carry CLAUDE_CODE_SESSION_ID/AI_AGENT) (T3).
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
// P4.3: the plan carries Task 1 + Task 2 — single-task (--tasks 1 / --tasks 2) and whole-group
// (--tasks 1,2) share the same dispatch path; the out-of-bounds face (--tasks 9) stays BLOCK.
function setupWorkspace() {
  const repo = realpathSync(mkdtempSync(path.join(tmpdir(), `cdd-task-cli-${Date.now()}-${Math.random().toString(36).slice(2)}`)));
  gitInit(repo);
  const plans = path.join(repo, 'docs', 'osuperpowers', 'plans');
  mkdirSync(plans, { recursive: true });
  writeFileSync(path.join(plans, 'plan.md'), '# Plan\n\n### Task 1: test\n\n### Task 2: test\n');
  gitCommit(repo);
  return { repo, plan: path.join('docs', 'osuperpowers', 'plans', 'plan.md'), ws: path.join(repo, '.osuperpowers', 'cdd', 'plan') };
}

const HOST = { CLAUDE_CODE_SESSION_ID: '1' };

describe('cdd implement/review/fix CLI contract', () => {
  it('dry-run implement → return block four lines APPROVED + exit 0', () => {
    const { repo, plan } = setupWorkspace();
    const res = run(
      ['--dry-run', 'implement', '--tasks', '1', '--plan', plan],
      HOST,
      { cwd: repo },
    );
    expect(res.status).toBe(0);
    const lines = res.stdout.trim().split('\n');
    expect(lines.length).toBe(5);
    // 可区分形态：五行各自是一键行（防退化回恒真行数断言），第 5 行 counters 逐键断言
    expect(lines.filter(l => /^(status|commits|artifacts|blocker|counters):/.test(l)).length).toBe(5);
    expect(lines[0]).toBe('status: APPROVED');
    expect(lines[1]).toBe('commits: base=dry-run');
    expect(lines[2]).toMatch(/^artifacts: brief=/);
    expect(lines[3]).toBe('blocker: none');
    expect(lines[4]).toMatch(/^counters: timeout=\d+ contract-violation=\d+ engine-self-written=\d+ recovery=\d+$/);
  });

  // F11: implement --plan 无前置 brief → runTask 自供应（plan 定稿处 generateBrief）；
  // Artifacts = plan-derived ws/tasks-{a}-{b}-brief.md + TASK_BASE: <HEAD> (P4.3 group naming).
  it('implement --plan without a pre-existing brief → self-provisions tasks-N-brief.md with TASK_BASE:', () => {
    const { repo, plan, ws } = setupWorkspace();
    const res = run(
      ['--dry-run', 'implement', '--tasks', '1', '--plan', plan],
      HOST,
      { cwd: repo },
    );
    expect(res.status).toBe(0);
    const brief = path.join(ws, 'tasks-1-brief.md');
    expect(existsSync(brief)).toBe(true);
    expect(readFileSync(brief, 'utf8')).toMatch(/^TASK_BASE: [0-9a-f]{40}$/m);
  });

  // F11 越界保护：plan 有 Task 1 无 Task 9 → BLOCKED + exit 1（不静默降级为「读既有/空 brief 放行」）。
  it('implement --plan with task missing from plan (out of bounds) → BLOCKED + exit 1 (no silent degradation)', () => {
    const { repo, plan } = setupWorkspace();
    const res = run(
      ['--dry-run', 'implement', '--tasks', '9', '--plan', plan],
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
        ['--dry-run', sub, '--type', type, '--tasks', '1', '--plan', plan],
        HOST,
        { cwd: repo },
      );
      expect(res.status, `cdd ${sub} --type task`).toBe(0);
      expect(res.stdout).toMatch(/^status: APPROVED$/m);
    }
  });

  it('-h/--help → citty help on stdout + exit 0', () => {
    for (const flag of ['-h', '--help']) {
      const res = run([flag]);
      expect(res.status, `flag ${flag}`).toBe(0);
      expect(res.stdout).toMatch(/USAGE cdd/);
    }
  });

  // Program-level `--dry-run` stays position-independent — the bin wrapper resolves it from the
  // FULL argv, so it works after the subcommand name too (commander parity) (Task 9, citty).
  it('program 级 --dry-run 位置无关：子命令名之后也生效', () => {
    const { repo, plan } = setupWorkspace();
    const res = run(
      ['implement', '--tasks', '1', '--dry-run', '--plan', plan],
      HOST,
      { cwd: repo },
    );
    expect(res.status).toBe(0);
    expect(res.stdout).toMatch(/^status: APPROVED$/m);
    expect(res.stdout).toMatch(/^commits: base=dry-run$/m);
  });

  it('no host env → CDD_BLOCKED + exit 1 (harness resolved from ambient host, no flag)', () => {
    const res = run(['implement', '--tasks', '1'], {}, { noHost: true });
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/no host harness detected|CDD_BLOCKED/);
  });

  it('unknown subcommand → usage stderr + exit 2', () => {
    const res = run(['frobnicate']);
    expect(res.status).toBe(2);
    expect(res.stderr).toMatch(/^usage: /);
  });

  it('implement --plan without --tasks → usage stderr + exit 2', () => {
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
    const res = run(['implement', '--tasks', '1', '--bogus', 'x'], HOST);
    expect(res.status).toBe(2);
    expect(res.stderr).toMatch(/^usage: /);
  });

  it('review unknown --type → error stderr + exit 2 (runReview type validation)', () => {
    const { repo, plan } = setupWorkspace();
    const res = run(
      ['--dry-run', 'review', '--type', 'handoff', '--tasks', '1', '--plan', plan],
      HOST,
      { cwd: repo },
    );
    expect(res.status).toBe(2);
    expect(res.stderr).toMatch(/unknown review --type: handoff/);
  });

  it('Bug A regression: --tasks non-integer token → usage + upgraded message + exit 2', () => {
    // parseInt NaN must not leak into runTask (task-NaN-* garbage + a fake APPROVED return block);
    // the parse layer rejects at parse time → exit 2 (legacy cdd-task contract, P4.3 单数据模型).
    const res = run(['--dry-run', 'implement', '--tasks', 'abc'], HOST);
    expect(res.status).toBe(2);
    expect(res.stderr).toMatch(/^usage: /);
    expect(res.stderr).toMatch(/--tasks must be comma-separated integers: abc/);
  });
});

// --tasks <n|n,n,…> list model (P4.3 group dispatch): acceptance covers the group-level dispatch
// path — `--tasks 1` and `--tasks 1,2` follow the same dispatch path (success · out-of-bounds BLOCK
// with per-item missing listing · round/handoff/progress/residue one copy per group, artifact names
// tasks-{a}-{b}-*) plus the parse layer's trim / dedupe / empty-slice / non-integer rejection.
describe('P4.3 --tasks list model (group dispatch acceptance)', () => {
  it('implement --tasks 1 → group-of-one dispatch: tasks-1-brief.md self-provisioned, APPROVED + exit 0', () => {
    const { repo, plan, ws } = setupWorkspace();
    const res = run(
      ['--dry-run', 'implement', '--tasks', '1', '--plan', plan],
      HOST,
      { cwd: repo },
    );
    expect(res.status).toBe(0);
    expect(res.stdout).toMatch(/^status: APPROVED$/m);
    expect(res.stdout).toMatch(/^commits: base=dry-run$/m);
    expect(existsSync(path.join(ws, 'tasks-1-brief.md'))).toBe(true);
    expect(readFileSync(path.join(ws, 'tasks-1-brief.md'), 'utf8')).toMatch(/^TASK_BASE: [0-9a-f]{40}$/m);
  });

  it('implement --tasks 1,2 → same dispatch path as --tasks 1: one group brief (tasks-1-2-brief.md with both sections)', () => {
    const { repo, plan, ws } = setupWorkspace();
    const res = run(
      ['--dry-run', 'implement', '--tasks', '1,2', '--plan', plan],
      HOST,
      { cwd: repo },
    );
    expect(res.status).toBe(0);
    expect(res.stdout).toMatch(/^status: APPROVED$/m);
    expect(res.stdout).toMatch(/^commits: base=dry-run$/m);
    // The group is the dispatch unit — the group-keyed brief (tasks-1-2-brief.md) holds both
    // Task 1 + Task 2 sections and the single TASK_BASE.
    const brief = readFileSync(path.join(ws, 'tasks-1-2-brief.md'), 'utf8');
    expect(brief).toMatch(/^### Task 1:/m);
    expect(brief).toMatch(/^### Task 2:/m);
    expect(brief.match(/^TASK_BASE: /gm)).toHaveLength(1);
    // No per-task artifacts — a task-1-brief.md single-task brief must not exist
    expect(existsSync(path.join(ws, 'task-1-brief.md'))).toBe(false);
  });

  it('implement --tasks 2,3 (Task 3 out of bounds) → whole-group BLOCK exit 1 + per-item missing listing (/task N not found/ contract)', () => {
    const { repo, plan } = setupWorkspace();
    const res = run(
      ['--dry-run', 'implement', '--tasks', '2,3', '--plan', plan],
      HOST,
      { cwd: repo },
    );
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/CDD_BLOCKED/);
    expect(res.stderr).toMatch(/task 3 not found/);
  });

  it('implement --tasks 8,9 (entire group out of bounds) → whole-group BLOCK + per-item tasks 8, 9 listing', () => {
    const { repo, plan } = setupWorkspace();
    const res = run(
      ['--dry-run', 'implement', '--tasks', '8,9', '--plan', plan],
      HOST,
      { cwd: repo },
    );
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/CDD_BLOCKED/);
    expect(res.stderr).toMatch(/tasks 8, 9 not found/);
  });

  it('review --type task --tasks 1,2 → same dispatch path (group round resolveNextRound → round 1 passes)', () => {
    const { repo, plan } = setupWorkspace();
    const res = run(
      ['--dry-run', 'review', '--type', 'task', '--tasks', '1,2', '--plan', plan],
      HOST,
      { cwd: repo },
    );
    expect(res.status).toBe(0);
    expect(res.stdout).toMatch(/^status: APPROVED$/m);
  });

  it('fix --type task --tasks 1,2 --findings <group review handoff> → whole-group fix (group findings path plumbed)', () => {
    const { repo, plan } = setupWorkspace();
    const findingsRel = path.posix.join('.osuperpowers', 'cdd', 'plan', 'tasks-1-2-review-1.json');
    const res = run(
      ['--dry-run', 'fix', '--type', 'task', '--tasks', '1,2', '--findings', findingsRel, '--plan', plan],
      HOST,
      { cwd: repo },
    );
    expect(res.status).toBe(0);
    expect(res.stdout).toMatch(/^status: APPROVED$/m);
  });

  it('--tasks with spaced token `1, 2` tolerated (trim) → same dispatch path', () => {
    const { repo, plan } = setupWorkspace();
    const res = run(
      ['--dry-run', 'review', '--type', 'task', '--tasks', '1, 2', '--plan', plan],
      HOST,
      { cwd: repo },
    );
    expect(res.status).toBe(0);
    expect(res.stdout).toMatch(/^status: APPROVED$/m);
  });

  it('--tasks 1,1 dedupes to [1] → group of one dispatched', () => {
    const { repo, plan } = setupWorkspace();
    const res = run(
      ['--dry-run', 'implement', '--tasks', '1,1', '--plan', plan],
      HOST,
      { cwd: repo },
    );
    expect(res.status).toBe(0);
    expect(res.stdout).toMatch(/^status: APPROVED$/m);
  });

  it('--tasks 1, (trailing comma empty slice) → exit 2', () => {
    const { repo, plan } = setupWorkspace();
    const res = run(
      ['--dry-run', 'implement', '--tasks', '1,', '--plan', plan],
      HOST,
      { cwd: repo },
    );
    expect(res.status).toBe(2);
    expect(res.stderr).toMatch(/--tasks must be comma-separated integers/);
  });

  it('--tasks abc (missing --plan preflight) → parse-layer rejection exit 2 + upgraded message (Bug A regression hardening)', () => {
    const res = run(['implement', '--tasks', 'abc'], HOST);
    expect(res.status).toBe(2);
    expect(res.stderr).toMatch(/--tasks must be comma-separated integers: abc/);
  });
});
