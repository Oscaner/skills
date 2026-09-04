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
