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
    const res = await invokeCli(entry, 'prompt', 'implement', {}, '/tmp', undefined);
    expect(res.ok).toBe(true);
    expect(res.stdout).toBe('done');
  });
});

describe('invokeCli prefix/suffix injection (Enh P)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('claude implement → prompt 首行为 Skill(mattpocock-skills:tdd)，次行起为模板 prompt', async () => {
    execa.mockResolvedValue({ exitCode: 0, stdout: 'status: APPROVED', stderr: '', timedOut: false });
    const { invokeCli } = await import('../lib/cli-shared.mjs');
    const entry = {
      cli: 'claude', invoke: '-p', output: 'text',
      prefix: { implement: 'Skill(mattpocock-skills:tdd)', 'task-review': 'Skill(mattpocock-skills:code-review)', fix: '' },
      suffix: {},
    };
    await invokeCli(entry, 'line one\nline two', 'implement', {}, '/tmp', undefined);
    const promptArg = execa.mock.calls[0][1].at(-1);
    expect(promptArg.split('\n')[0]).toBe('Skill(mattpocock-skills:tdd)');
    expect(promptArg.split('\n').slice(1).join('\n')).toBe('line one\nline two');
  });

  it('claude task-review → prompt 首行为 Skill(mattpocock-skills:code-review)', async () => {
    execa.mockResolvedValue({ exitCode: 0, stdout: 'status: APPROVED', stderr: '', timedOut: false });
    const { invokeCli } = await import('../lib/cli-shared.mjs');
    const entry = {
      cli: 'claude', invoke: '-p', output: 'text',
      prefix: { implement: 'Skill(mattpocock-skills:tdd)', 'task-review': 'Skill(mattpocock-skills:code-review)', fix: '' },
      suffix: {},
    };
    await invokeCli(entry, 'review prompt', 'task-review', {}, '/tmp', undefined);
    const promptArg = execa.mock.calls[0][1].at(-1);
    expect(promptArg.split('\n')[0]).toBe('Skill(mattpocock-skills:code-review)');
    expect(promptArg.split('\n')[1]).toBe('review prompt');
  });

  it('无 prefix/suffix 的 entry → prompt 原样', async () => {
    execa.mockResolvedValue({ exitCode: 0, stdout: 'ok', stderr: '', timedOut: false });
    const { invokeCli } = await import('../lib/cli-shared.mjs');
    const entry = { cli: 'claude', invoke: '-p', output: 'text' };
    await invokeCli(entry, 'plain prompt', 'implement', {}, '/tmp', undefined);
    const promptArg = execa.mock.calls[0][1].at(-1);
    expect(promptArg).toBe('plain prompt');
  });

  it('suffix 追加到 prompt 末尾（`\\n` 分隔）', async () => {
    execa.mockResolvedValue({ exitCode: 0, stdout: 'ok', stderr: '', timedOut: false });
    const { invokeCli } = await import('../lib/cli-shared.mjs');
    const entry = { cli: 'claude', invoke: '-p', output: 'text', prefix: {}, suffix: { implement: '[END]' } };
    await invokeCli(entry, 'middle', 'implement', {}, '/tmp', undefined);
    const promptArg = execa.mock.calls[0][1].at(-1);
    expect(promptArg).toBe('middle\n[END]');
  });

  it('prefix 与 suffix 同存 → `<prefix>\\n<prompt>\\n<suffix>`', async () => {
    execa.mockResolvedValue({ exitCode: 0, stdout: 'ok', stderr: '', timedOut: false });
    const { invokeCli } = await import('../lib/cli-shared.mjs');
    const entry = { cli: 'claude', invoke: '-p', output: 'text', prefix: { implement: '[P]' }, suffix: { implement: '[S]' } };
    await invokeCli(entry, 'mid', 'implement', {}, '/tmp', undefined);
    const promptArg = execa.mock.calls[0][1].at(-1);
    expect(promptArg).toBe('[P]\nmid\n[S]');
  });
});

describe('invokeCli gate env propagation (Bug O Step 5b)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('env.CDD_WORKSPACE 存在 → spawn env 增加 CDD_GATE_WORKSPACE + CDD_GATE_MODE 默认 cli', async () => {
    execa.mockResolvedValue({ exitCode: 0, stdout: 'status: APPROVED', stderr: '', timedOut: false });
    const { invokeCli } = await import('../lib/cli-shared.mjs');
    const entry = { cli: 'claude', invoke: '-p', output: 'text' };
    await invokeCli(entry, 'prompt', 'implement', { CDD_WORKSPACE: '/ws' }, '/tmp', undefined);
    const spawnEnv = execa.mock.calls[0][2].env;
    expect(spawnEnv.CDD_GATE_WORKSPACE).toBe('/ws');
    expect(spawnEnv.CDD_GATE_MODE).toBe('cli');
  });

  it('env 无 CDD_WORKSPACE → 不注入 gate env', async () => {
    execa.mockResolvedValue({ exitCode: 0, stdout: 'ok', stderr: '', timedOut: false });
    const { invokeCli } = await import('../lib/cli-shared.mjs');
    const entry = { cli: 'claude', invoke: '-p', output: 'text' };
    await invokeCli(entry, 'prompt', 'implement', {}, '/tmp', undefined);
    const spawnEnv = execa.mock.calls[0][2].env;
    expect(spawnEnv.CDD_GATE_WORKSPACE).toBeUndefined();
    expect(spawnEnv.CDD_GATE_MODE).toBeUndefined();
  });

  it('CDD_SESSION_MODE env 覆盖 CDD_GATE_MODE 默认值', async () => {
    execa.mockResolvedValue({ exitCode: 0, stdout: 'ok', stderr: '', timedOut: false });
    const prev = process.env.CDD_SESSION_MODE;
    process.env.CDD_SESSION_MODE = 'in-session';
    try {
      const { invokeCli } = await import('../lib/cli-shared.mjs');
      const entry = { cli: 'claude', invoke: '-p', output: 'text' };
      await invokeCli(entry, 'prompt', 'implement', { CDD_WORKSPACE: '/ws' }, '/tmp', undefined);
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
    const promise = invokeCliWithRetry(entry, 'prompt', 'implement', {}, '/tmp', undefined);
    await vi.runAllTimersAsync();
    const res = await promise;
    expect(res.ok).toBe(true);
    expect(execa).toHaveBeenCalledTimes(2);
  });

  it('does not retry on timeout', async () => {
    execa.mockResolvedValue({ exitCode: -1, stdout: '', stderr: '', timedOut: true });
    const { invokeCliWithRetry } = await import('../lib/cli-shared.mjs');
    const entry = { cli: 'claude', invoke: '-p', output: 'text' };
    const res = await invokeCliWithRetry(entry, 'prompt', 'implement', {}, '/tmp', undefined);
    expect(res.timedOut).toBe(true);
    expect(execa).toHaveBeenCalledTimes(1);
  });
});
