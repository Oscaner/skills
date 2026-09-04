// packages/cdd-engine/bin/tests/schema-utils.test.mjs
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fs to provide schema without actual file
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    readFileSync: vi.fn((p, enc) => {
      if (String(p).endsWith('cdd-handoff-schema.json')) {
        return JSON.stringify({
          type: 'object',
          required: ['task', 'phase', 'status', 'findings', 'artifacts', 'blocker'],
          properties: {
            task:      { type: 'integer' },
            phase:     { type: 'string' },
            status:    { type: 'string' },
            findings:  { type: 'array' },
            artifacts: { type: 'object' },
            blocker:   { type: 'string' },
          },
        });
      }
      return actual.readFileSync(p, enc);
    }),
  };
});

describe('validateHandoffSchema', () => {
  beforeEach(() => vi.resetModules());

  it('valid handoff passes', async () => {
    const { validateHandoffSchema } = await import('../lib/schema-utils.mjs');
    const obj = { task: 1, phase: 'implement', status: 'APPROVED',
                  findings: [], artifacts: {}, blocker: 'none' };
    expect(validateHandoffSchema(obj)).toEqual({ valid: true });
  });

  it('missing required field fails', async () => {
    const { validateHandoffSchema } = await import('../lib/schema-utils.mjs');
    const obj = { task: 1, phase: 'implement', status: 'APPROVED', findings: [], artifacts: {} };
    const res = validateHandoffSchema(obj);
    expect(res.valid).toBe(false);
    expect(res.reason).toContain('blocker');
  });

  it('task as string fails (must be integer)', async () => {
    const { validateHandoffSchema } = await import('../lib/schema-utils.mjs');
    const obj = { task: '1', phase: 'implement', status: 'APPROVED',
                  findings: [], artifacts: {}, blocker: 'none' };
    const res = validateHandoffSchema(obj);
    expect(res.valid).toBe(false);
  });
});
