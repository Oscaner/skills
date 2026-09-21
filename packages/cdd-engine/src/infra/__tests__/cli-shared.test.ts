// packages/cdd-engine/src/infra/__tests__/cli-shared.test.ts
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import { resolveTerminationConfig } from '../invoke.ts';

vi.mock('execa', () => ({
  execa: vi.fn(),
}));

import { execa } from 'execa';

describe('resolveTerminationConfig', () => {
  it('default task budget is 3h (canonical timeouts.defaults.task)', () => {
    expect(resolveTerminationConfig('task').budgetMs).toBe(10_800_000);
  });
  it('default review budget is 60min (canonical timeouts.defaults.review)', () => {
    expect(resolveTerminationConfig('review').budgetMs).toBe(3_600_000);
  });
  it('seam override wins over the canonical default (env-zero resolver)', () => {
    expect(resolveTerminationConfig('task', { budgetMs: 60_000 }).budgetMs).toBe(60_000);
  });
  it('stall cadence reads canonical timeouts.liveness (60s sample / 15min idle window)', () => {
    const cfg = resolveTerminationConfig('task');
    expect(cfg.sampleIntervalMs).toBe(60_000);
    expect(cfg.idleWindowMs).toBe(900_000);
  });
  it('unknown mode returns undefined budget (canonical defaults only for declared modes)', () => {
    expect(resolveTerminationConfig('unknown').budgetMs).toBeUndefined();
  });
});

describe('extractStreamJsonFinal via invokeCli', () => {
  beforeEach(() => vi.clearAllMocks());

  it('picks last completion.finalText from NDJSON stream', async () => {
    execa.mockResolvedValue({
      exitCode: 0,
      stdout: '{"type":"text","text":"hello"}\n{"type":"completion","finalText":"done"}\n',
      stderr: '', timedOut: false,
    });
    const { invokeCli } = await import('../invoke.ts');
    const entry = { cli: 'claude', invoke: '-p --output-format stream-json', output: 'stream-json' };
    const res = await invokeCli(entry, 'prompt', { op: 'implement' }, {}, '/tmp', undefined);
    expect(res.ok).toBe(true);
    expect(res.stdout).toBe('done');
  });
});

describe('invokeCli prefix/suffix injection (operation×type)', () => {
  beforeEach(() => vi.clearAllMocks());

  // Registry set (Task 5): implement/fix → tdd; review×task/branch → code-review; review×spec/plan → empty.
  const prefix = {
    implement: '/mattpocock-skills:tdd',
    review: { task: '/mattpocock-skills:code-review', branch: '/mattpocock-skills:code-review', spec: '', plan: '' },
    fix: '/mattpocock-skills:tdd',
  };

  it('implement → prompt first line is /mattpocock-skills:tdd, template follows', async () => {
    execa.mockResolvedValue({ exitCode: 0, stdout: 'status: APPROVED', stderr: '', timedOut: false });
    const { invokeCli } = await import('../invoke.ts');
    const entry = { cli: 'claude', invoke: '-p', output: 'text', prefix, suffix: {} };
    await invokeCli(entry, 'line one\nline two', { op: 'implement' }, {}, '/tmp', undefined);
    const promptArg = execa.mock.calls[0][1].at(-1);
    expect(promptArg.split('\n')[0]).toBe('/mattpocock-skills:tdd');
    expect(promptArg.split('\n').slice(1).join('\n')).toBe('line one\nline two');
  });

  it('review×task → prompt first line is /mattpocock-skills:code-review', async () => {
    execa.mockResolvedValue({ exitCode: 0, stdout: 'status: APPROVED', stderr: '', timedOut: false });
    const { invokeCli } = await import('../invoke.ts');
    const entry = { cli: 'claude', invoke: '-p', output: 'text', prefix, suffix: {} };
    await invokeCli(entry, 'review prompt', { op: 'review', type: 'task' }, {}, '/tmp', undefined);
    const promptArg = execa.mock.calls[0][1].at(-1);
    expect(promptArg.split('\n')[0]).toBe('/mattpocock-skills:code-review');
    expect(promptArg.split('\n')[1]).toBe('review prompt');
  });

  it('review×spec（docs 族共享壳，无注入）→ prompt unchanged', async () => {
    execa.mockResolvedValue({ exitCode: 0, stdout: 'ok', stderr: '', timedOut: false });
    const { invokeCli } = await import('../invoke.ts');
    const entry = { cli: 'claude', invoke: '-p', output: 'text', prefix, suffix: {} };
    await invokeCli(entry, 'spec prompt', { op: 'review', type: 'spec' }, {}, '/tmp', undefined);
    const promptArg = execa.mock.calls[0][1].at(-1);
    expect(promptArg).toBe('spec prompt');
  });

  it('fix → prompt first line is /mattpocock-skills:tdd', async () => {
    execa.mockResolvedValue({ exitCode: 0, stdout: 'status: APPROVED', stderr: '', timedOut: false });
    const { invokeCli } = await import('../invoke.ts');
    const entry = { cli: 'claude', invoke: '-p', output: 'text', prefix, suffix: {} };
    await invokeCli(entry, 'fix prompt', { op: 'fix', type: 'task' }, {}, '/tmp', undefined);
    const promptArg = execa.mock.calls[0][1].at(-1);
    expect(promptArg.split('\n')[0]).toBe('/mattpocock-skills:tdd');
  });

  it('legacy 扁平 mode 键兜底：op=扁平米键 → 直接命 prefix 同键（未迁移 registry）', async () => {
    execa.mockResolvedValue({ exitCode: 0, stdout: 'ok', stderr: '', timedOut: false });
    const { invokeCli } = await import('../invoke.ts');
    const entry = { cli: 'claude', invoke: '-p', output: 'text', prefix: { 'legacy-review': '/legacy-review' }, suffix: {} };
    await invokeCli(entry, 'legacy prompt', { op: 'legacy-review' }, {}, '/tmp', undefined);
    const promptArg = execa.mock.calls[0][1].at(-1);
    expect(promptArg.split('\n')[0]).toBe('/legacy-review');
    // 旧位置 mode 字符串参数也归一 → 同走扁平键兜底
    execa.mockClear();
    await invokeCli(entry, 'legacy prompt', 'legacy-review', {}, '/tmp', undefined);
    expect(execa.mock.calls[0][1].at(-1).split('\n')[0]).toBe('/legacy-review');
  });

  it('entry without prefix/suffix → prompt unchanged', async () => {
    execa.mockResolvedValue({ exitCode: 0, stdout: 'ok', stderr: '', timedOut: false });
    const { invokeCli } = await import('../invoke.ts');
    const entry = { cli: 'claude', invoke: '-p', output: 'text' };
    await invokeCli(entry, 'plain prompt', { op: 'implement' }, {}, '/tmp', undefined);
    const promptArg = execa.mock.calls[0][1].at(-1);
    expect(promptArg).toBe('plain prompt');
  });

  it('suffix appended after prompt (newline separated)', async () => {
    execa.mockResolvedValue({ exitCode: 0, stdout: 'ok', stderr: '', timedOut: false });
    const { invokeCli } = await import('../invoke.ts');
    const entry = { cli: 'claude', invoke: '-p', output: 'text', prefix: {}, suffix: { implement: '[END]' } };
    await invokeCli(entry, 'middle', { op: 'implement' }, {}, '/tmp', undefined);
    const promptArg = execa.mock.calls[0][1].at(-1);
    expect(promptArg).toBe('middle\n[END]');
  });

  it('prefix+suffix together → `<prefix>\\n<prompt>\\n<suffix>`', async () => {
    execa.mockResolvedValue({ exitCode: 0, stdout: 'ok', stderr: '', timedOut: false });
    const { invokeCli } = await import('../invoke.ts');
    const entry = { cli: 'claude', invoke: '-p', output: 'text', prefix: { implement: '[P]' }, suffix: { implement: '[S]' } };
    await invokeCli(entry, 'mid', { op: 'implement' }, {}, '/tmp', undefined);
    const promptArg = execa.mock.calls[0][1].at(-1);
    expect(promptArg).toBe('[P]\nmid\n[S]');
  });
});

describe('invokeCliWithRetry', () => {
  // Use fake timers so the 5 s / 15 s retry delays don't slow down the suite.
  beforeAll(() => vi.useFakeTimers());
  afterAll(() => vi.useRealTimers());
  // resetAllMocks clears both calls AND queued once-values, preventing bleed-over.
  beforeEach(() => vi.resetAllMocks());

  it('retries on overloaded stderr, succeeds on 2nd attempt', async () => {
    execa
      .mockResolvedValueOnce({ exitCode: 1, stdout: '', stderr: 'overloaded', timedOut: false })
      .mockResolvedValueOnce({ exitCode: 0, stdout: 'status: APPROVED\ncommits: base=abc head=def\nartifacts: \nblocker: none', stderr: '', timedOut: false });
    const { invokeCliWithRetry } = await import('../invoke.ts');
    const entry = { cli: 'claude', invoke: '-p', output: 'text' };
    // Start the call, advance fake timers past the retry delay, then collect.
    const promise = invokeCliWithRetry(entry, 'prompt', { op: 'implement' }, {}, '/tmp', undefined);
    await vi.runAllTimersAsync();
    const res = await promise;
    expect(res.ok).toBe(true);
    expect(execa).toHaveBeenCalledTimes(2);
  });

  it('does not retry on timeout', async () => {
    // external-SIGTERM exit shape — the T26 cause derivation reads signal === "SIGTERM" (execa's
    // timedOut flag alone was dropped with the monitor takeover; the monitor always kills via SIGTERM)
    execa.mockResolvedValue({ exitCode: -1, stdout: '', stderr: '', signal: 'SIGTERM' });
    const { invokeCliWithRetry } = await import('../invoke.ts');
    const entry = { cli: 'claude', invoke: '-p', output: 'text' };
    const res = await invokeCliWithRetry(entry, 'prompt', { op: 'implement' }, {}, '/tmp', undefined);
    expect(res.timedOut).toBe(true);
    expect(res.cause).toBe('signal');
    expect(execa).toHaveBeenCalledTimes(1);
  });
});

describe('review.mjs task 派生点（taskReviewWorkspace — workspaceSlug 收敛）', () => {
  // review --type task 的 task workspace 路径派生 = <repoRoot>/.osuperpowers/cdd/<slug>，
  // slug 经 handoff-naming.workspaceSlug 收敛（-design/-plan 单层 strip）。
  // run-task 侧派生点（resolveWorkspace）由 runner.test.mjs 回归 —— 两派生点同源防分叉。
  it('--plan xxx-p5-plan.md → task workspace .osuperpowers/cdd/xxx-p5（Convergence prev 命中）', async () => {
    const { taskReviewWorkspace } = await import('../../cli/review.ts');
    expect(taskReviewWorkspace('xxx-p5-plan.md', '/repo')).toBe(path.join('/repo', '.osuperpowers', 'cdd', 'xxx-p5'));
  });
  it('--plan xxx-p5.md → 与 -plan.md 变体收敛同 workspace', async () => {
    const { taskReviewWorkspace } = await import('../../cli/review.ts');
    expect(taskReviewWorkspace('xxx-p5.md', '/repo')).toBe(path.join('/repo', '.osuperpowers', 'cdd', 'xxx-p5'));
  });
});
