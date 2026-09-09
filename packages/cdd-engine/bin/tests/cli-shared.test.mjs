// packages/cdd-engine/bin/tests/cli-shared.test.mjs
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import { resolveTimeoutMs } from '../lib/cli-shared.mjs';

vi.mock('execa', () => ({
  execa: vi.fn(),
}));

import { execa } from 'execa';

describe('resolveTimeoutMs', () => {
  it('per-mode env takes priority', () => {
    expect(resolveTimeoutMs({ CDD_TASK_TIMEOUT: '60' }, 'task')).toBe(60_000);
  });
  it('CDD_CLI_TIMEOUT is stepped to 30-min boundary', () => {
    // 1801s → ceil to 3600s
    expect(resolveTimeoutMs({ CDD_CLI_TIMEOUT: '1801' }, 'task')).toBe(3_600_000);
  });
  it('default task timeout is 30min', () => {
    expect(resolveTimeoutMs({}, 'task')).toBe(1_800_000);
  });
  it('per-mode 巨大秒值 → 钳到安全天花板（T8 回归：setTimeout 32 位溢出 → ~1ms 瞬时 SIGTERM）', () => {
    // 2700000s × 1000 = 2.7e9 ms > 2^31-1（2147483647 ms）；溢出触发 V8 TimeoutOverflowWarning
    // 把 timeout 钳到 ~1ms → 一次正常 dispatch 变成瞬时 kill（CDD_REVIEW_TIMEOUT 泄漏时序回归）。
    expect(resolveTimeoutMs({ CDD_REVIEW_TIMEOUT: '2700000' }, 'review')).toBeLessThanOrEqual(2_000_000_000);
    expect(resolveTimeoutMs({ CDD_REVIEW_TIMEOUT: '2700000' }, 'review')).toBeGreaterThan(0);
  });
  it('CDD_CLI_TIMEOUT 巨大秒值同样钳制（全局路径同溢出面）', () => {
    expect(resolveTimeoutMs({ CDD_CLI_TIMEOUT: '2700000' }, 'task')).toBeLessThanOrEqual(2_000_000_000);
  });
  it('unknown mode returns undefined', () => {
    expect(resolveTimeoutMs({}, 'unknown')).toBeUndefined();
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
    const { invokeCli } = await import('../lib/cli-shared.mjs');
    const entry = { cli: 'claude', invoke: '-p --output-format stream-json', output: 'stream-json' };
    const res = await invokeCli(entry, 'prompt', { op: 'implement' }, {}, '/tmp', undefined);
    expect(res.ok).toBe(true);
    expect(res.stdout).toBe('done');
  });
});

describe('invokeCli prefix/suffix injection (operation×type)', () => {
  beforeEach(() => vi.clearAllMocks());

  // Task 5 registry set: implement/fix → tdd；review×task/branch → code-review；review×spec/plan → 空。
  const prefix = {
    implement: '/mattpocock-skills:tdd',
    review: { task: '/mattpocock-skills:code-review', branch: '/mattpocock-skills:code-review', spec: '', plan: '' },
    fix: '/mattpocock-skills:tdd',
  };

  it('implement → prompt first line is /mattpocock-skills:tdd, template follows', async () => {
    execa.mockResolvedValue({ exitCode: 0, stdout: 'status: APPROVED', stderr: '', timedOut: false });
    const { invokeCli } = await import('../lib/cli-shared.mjs');
    const entry = { cli: 'claude', invoke: '-p', output: 'text', prefix, suffix: {} };
    await invokeCli(entry, 'line one\nline two', { op: 'implement' }, {}, '/tmp', undefined);
    const promptArg = execa.mock.calls[0][1].at(-1);
    expect(promptArg.split('\n')[0]).toBe('/mattpocock-skills:tdd');
    expect(promptArg.split('\n').slice(1).join('\n')).toBe('line one\nline two');
  });

  it('review×task → prompt first line is /mattpocock-skills:code-review', async () => {
    execa.mockResolvedValue({ exitCode: 0, stdout: 'status: APPROVED', stderr: '', timedOut: false });
    const { invokeCli } = await import('../lib/cli-shared.mjs');
    const entry = { cli: 'claude', invoke: '-p', output: 'text', prefix, suffix: {} };
    await invokeCli(entry, 'review prompt', { op: 'review', type: 'task' }, {}, '/tmp', undefined);
    const promptArg = execa.mock.calls[0][1].at(-1);
    expect(promptArg.split('\n')[0]).toBe('/mattpocock-skills:code-review');
    expect(promptArg.split('\n')[1]).toBe('review prompt');
  });

  it('review×spec（共享 review.md，无注入）→ prompt unchanged', async () => {
    execa.mockResolvedValue({ exitCode: 0, stdout: 'ok', stderr: '', timedOut: false });
    const { invokeCli } = await import('../lib/cli-shared.mjs');
    const entry = { cli: 'claude', invoke: '-p', output: 'text', prefix, suffix: {} };
    await invokeCli(entry, 'spec prompt', { op: 'review', type: 'spec' }, {}, '/tmp', undefined);
    const promptArg = execa.mock.calls[0][1].at(-1);
    expect(promptArg).toBe('spec prompt');
  });

  it('fix → prompt first line is /mattpocock-skills:tdd', async () => {
    execa.mockResolvedValue({ exitCode: 0, stdout: 'status: APPROVED', stderr: '', timedOut: false });
    const { invokeCli } = await import('../lib/cli-shared.mjs');
    const entry = { cli: 'claude', invoke: '-p', output: 'text', prefix, suffix: {} };
    await invokeCli(entry, 'fix prompt', { op: 'fix', type: 'task' }, {}, '/tmp', undefined);
    const promptArg = execa.mock.calls[0][1].at(-1);
    expect(promptArg.split('\n')[0]).toBe('/mattpocock-skills:tdd');
  });

  it('legacy 扁平 mode 键兜底：op=扁平米键 → 直接命 prefix 同键（未迁移 registry）', async () => {
    execa.mockResolvedValue({ exitCode: 0, stdout: 'ok', stderr: '', timedOut: false });
    const { invokeCli } = await import('../lib/cli-shared.mjs');
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
    const { invokeCli } = await import('../lib/cli-shared.mjs');
    const entry = { cli: 'claude', invoke: '-p', output: 'text' };
    await invokeCli(entry, 'plain prompt', { op: 'implement' }, {}, '/tmp', undefined);
    const promptArg = execa.mock.calls[0][1].at(-1);
    expect(promptArg).toBe('plain prompt');
  });

  it('suffix appended after prompt (newline separated)', async () => {
    execa.mockResolvedValue({ exitCode: 0, stdout: 'ok', stderr: '', timedOut: false });
    const { invokeCli } = await import('../lib/cli-shared.mjs');
    const entry = { cli: 'claude', invoke: '-p', output: 'text', prefix: {}, suffix: { implement: '[END]' } };
    await invokeCli(entry, 'middle', { op: 'implement' }, {}, '/tmp', undefined);
    const promptArg = execa.mock.calls[0][1].at(-1);
    expect(promptArg).toBe('middle\n[END]');
  });

  it('prefix+suffix together → `<prefix>\\n<prompt>\\n<suffix>`', async () => {
    execa.mockResolvedValue({ exitCode: 0, stdout: 'ok', stderr: '', timedOut: false });
    const { invokeCli } = await import('../lib/cli-shared.mjs');
    const entry = { cli: 'claude', invoke: '-p', output: 'text', prefix: { implement: '[P]' }, suffix: { implement: '[S]' } };
    await invokeCli(entry, 'mid', { op: 'implement' }, {}, '/tmp', undefined);
    const promptArg = execa.mock.calls[0][1].at(-1);
    expect(promptArg).toBe('[P]\nmid\n[S]');
  });
});

describe('invokeCli gate env propagation (Bug O Step 5b)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('env.CDD_WORKSPACE set → spawn env adds CDD_GATE_WORKSPACE + CDD_GATE_MODE default subagent', async () => {
    execa.mockResolvedValue({ exitCode: 0, stdout: 'status: APPROVED', stderr: '', timedOut: false });
    const { invokeCli } = await import('../lib/cli-shared.mjs');
    const entry = { cli: 'claude', invoke: '-p', output: 'text' };
    await invokeCli(entry, 'prompt', { op: 'implement' }, { CDD_WORKSPACE: '/ws' }, '/tmp', undefined);
    const spawnEnv = execa.mock.calls[0][2].env;
    expect(spawnEnv.CDD_GATE_WORKSPACE).toBe('/ws');
    expect(spawnEnv.CDD_GATE_MODE).toBe('subagent');
  });

  it('env missing CDD_WORKSPACE → no gate env injected', async () => {
    execa.mockResolvedValue({ exitCode: 0, stdout: 'ok', stderr: '', timedOut: false });
    const { invokeCli } = await import('../lib/cli-shared.mjs');
    const entry = { cli: 'claude', invoke: '-p', output: 'text' };
    await invokeCli(entry, 'prompt', { op: 'implement' }, {}, '/tmp', undefined);
    const spawnEnv = execa.mock.calls[0][2].env;
    expect(spawnEnv.CDD_GATE_WORKSPACE).toBeUndefined();
    expect(spawnEnv.CDD_GATE_MODE).toBeUndefined();
  });

  it('CDD_SESSION_MODE env overrides CDD_GATE_MODE default', async () => {
    execa.mockResolvedValue({ exitCode: 0, stdout: 'ok', stderr: '', timedOut: false });
    const prev = process.env.CDD_SESSION_MODE;
    process.env.CDD_SESSION_MODE = 'in-session';
    try {
      const { invokeCli } = await import('../lib/cli-shared.mjs');
      const entry = { cli: 'claude', invoke: '-p', output: 'text' };
      await invokeCli(entry, 'prompt', { op: 'implement' }, { CDD_WORKSPACE: '/ws' }, '/tmp', undefined);
      const spawnEnv = execa.mock.calls[0][2].env;
      expect(spawnEnv.CDD_GATE_MODE).toBe('in-session');
    } finally {
      if (prev === undefined) delete process.env.CDD_SESSION_MODE;
      else process.env.CDD_SESSION_MODE = prev;
    }
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
    const { invokeCliWithRetry } = await import('../lib/cli-shared.mjs');
    const entry = { cli: 'claude', invoke: '-p', output: 'text' };
    // Start the call, advance fake timers past the retry delay, then collect.
    const promise = invokeCliWithRetry(entry, 'prompt', { op: 'implement' }, {}, '/tmp', undefined);
    await vi.runAllTimersAsync();
    const res = await promise;
    expect(res.ok).toBe(true);
    expect(execa).toHaveBeenCalledTimes(2);
  });

  it('does not retry on timeout', async () => {
    execa.mockResolvedValue({ exitCode: -1, stdout: '', stderr: '', timedOut: true });
    const { invokeCliWithRetry } = await import('../lib/cli-shared.mjs');
    const entry = { cli: 'claude', invoke: '-p', output: 'text' };
    const res = await invokeCliWithRetry(entry, 'prompt', { op: 'implement' }, {}, '/tmp', undefined);
    expect(res.timedOut).toBe(true);
    expect(execa).toHaveBeenCalledTimes(1);
  });
});
