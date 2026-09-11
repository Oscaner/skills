// packages/cdd-engine/tests/schema-utils.test.mjs
// Validates against the REAL cdd-handoff-schema.json (no fabricated fs mock —
// a fabricated schema would pass even if the shipped schema were corrupted).
import { describe, it, expect } from 'vitest';
import { validateHandoffSchema } from '../lib/handoff/schema.mjs';

// Handoffs must satisfy the real shipped schema (task/phase/status/findings/
// artifacts required; blocker optional; additionalProperties: false).
const VALID_HANDOFF = {
  task: 1,
  phase: 'implement',
  status: 'APPROVED',
  commits: { base: 'a'.repeat(40), head: 'b'.repeat(40) },
  findings: [],
  artifacts: { brief: '/ws/task-1-brief.md' },
  blocker: 'none',
};

describe('validateHandoffSchema (real schema)', () => {
  it('valid handoff passes', () => {
    expect(validateHandoffSchema(VALID_HANDOFF)).toEqual({ valid: true });
  });

  it('missing required field (task) fails', () => {
    const { task, ...missingTask } = VALID_HANDOFF;
    const res = validateHandoffSchema(missingTask);
    expect(res.valid).toBe(false);
    expect(res.reason).toContain('task');
  });

  it('task as string fails (must be integer)', () => {
    const res = validateHandoffSchema({ ...VALID_HANDOFF, task: '1' });
    expect(res.valid).toBe(false);
  });

  it('blocker is optional (not required by real schema)', () => {
    const { blocker, ...noBlocker } = VALID_HANDOFF;
    expect(validateHandoffSchema(noBlocker)).toEqual({ valid: true });
  });

  it('invalid status enum fails', () => {
    const res = validateHandoffSchema({ ...VALID_HANDOFF, status: 'DONE' });
    expect(res.valid).toBe(false);
  });

  it('unknown property rejected (additionalProperties: false)', () => {
    const res = validateHandoffSchema({ ...VALID_HANDOFF, doc_path: '/x/y.md' });
    expect(res.valid).toBe(false);
  });
});

describe('status conditional — review 族可缺省 / implement·fix required（T5 status 单一权威）', () => {
  it('review phase: status 缺省 → valid（engine 从 findings 派生，缺省合法）', () => {
    const { status, ...noStatus } = { ...VALID_HANDOFF, phase: 'review' };
    expect(validateHandoffSchema(noStatus)).toEqual({ valid: true });
  });

  it('branch-review phase: status 缺省 → valid', () => {
    const { status, ...noStatus } = { ...VALID_HANDOFF, phase: 'branch-review' };
    expect(validateHandoffSchema(noStatus)).toEqual({ valid: true });
  });

  it('review phase: status 显式提供 → valid', () => {
    expect(validateHandoffSchema({ ...VALID_HANDOFF, phase: 'review' })).toEqual({ valid: true });
  });

  it('implement / fix phase: status 缺省 → invalid（work 型 status 必需）', () => {
    const { status, ...noStatus } = { ...VALID_HANDOFF, phase: 'implement' };
    expect(validateHandoffSchema(noStatus).valid).toBe(false);
    expect(validateHandoffSchema({ ...noStatus, phase: 'fix' }).valid).toBe(false);
  });
});
