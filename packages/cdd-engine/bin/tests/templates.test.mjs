// packages/cdd-engine/bin/tests/templates.test.mjs
import { describe, it, expect, vi } from 'vitest';
import path from 'node:path';

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    existsSync: vi.fn((p) => String(p).endsWith('.md') || String(p).endsWith('.json')),
    readFileSync: vi.fn((p) => {
      if (String(p).includes('cdd-handoff-schema.json')) {
        return JSON.stringify({ type: 'object', required: ['task', 'phase', 'status', 'findings', 'artifacts', 'blocker'], properties: { task: { type: 'integer' }, phase: { type: 'string' }, status: { type: 'string' }, findings: { type: 'array' }, artifacts: { type: 'object' }, blocker: { type: 'string' } } });
      }
      // reviews.json / review.md：透传真实文件（不内联副本 → 消除 drift；模板真身由 templates.content.test.mjs 锚定）。
      if (String(p).includes('reviews.json')) return actual.readFileSync(p, 'utf8');
      if (String(p).includes('review.md')) return actual.readFileSync(p, 'utf8');
      if (String(p).endsWith('implement.md')) return 'brief: {{BRIEF}}\nhandoff: {{HANDOFF}}\n{{HANDOFF_STUB}}';
      return '';
    }),
  };
});

describe('PKG_ROOT', () => {
  it('resolves to packages/cdd-engine root', async () => {
    const { PKG_ROOT } = await import('../lib/templates.mjs');
    expect(PKG_ROOT).toMatch(/packages\/cdd-engine$/);
  });
});

describe('review type config (Task 4: 模板数据化)', () => {
  it('loadReviews returns the four review types', async () => {
    vi.resetModules();
    const { loadReviews } = await import('../lib/templates.mjs');
    expect(Object.keys(loadReviews())).toEqual(['task', 'branch', 'spec', 'plan']);
  });

  it('reviewTypeConfig: known type → config; unknown → throw', async () => {
    vi.resetModules();
    const { reviewTypeConfig } = await import('../lib/templates.mjs');
    expect(reviewTypeConfig('task').returnMode).toBe('h1');
    expect(reviewTypeConfig('spec').fixTemplate).toBe('doc-fix');
    expect(() => reviewTypeConfig('nope')).toThrow('unknown review type: nope');
  });

  it('renderModePrompt(task-review) routes via review.md + reviews.json type=task (code-review focus)', async () => {
    vi.resetModules();
    const { renderModePrompt } = await import('../lib/templates.mjs');
    const out = renderModePrompt('task-review', {
      WORKSPACE: '/ws', HANDOFF: '/ws/task-1-task-review-1.json', FIXED_POINT: '7a7327b',
    });
    expect(out).toContain('# CDD review — task');
    expect(out).toContain('standards · spec');            // lensEnum joined
    expect(out).toContain('7a7327b..HEAD');               // ref 具体化为 FIXED_POINT..HEAD
    expect(out).toContain('code-review smell baseline');   // axesGuide → code-review 焦点
    expect(out).toContain('/ws/task-1-task-review-1.json');
    expect(out.indexOf('## Handoff')).toBeLessThan(out.indexOf('## Return (H1')); // Bug C 排序保持
    expect(out).not.toContain('{{HANDOFF_STUB}}'); // r2-r3 泄漏回归：共享壳 stub 槽必须被替换
  });
});

describe('renderTemplate', () => {
  it('replaces all params (review shell)', async () => {
    vi.resetModules();
    const { renderTemplate } = await import('../lib/templates.mjs');
    const out = renderTemplate('review', {
      TYPE: 'spec', WORKSPACE: '/ws', LENS_GUIDE: 'completeness · consistency · clarity',
      REFERENCE: '/tmp/spec.md', AXES: 'URC 规则指针', HANDOFF: '/tmp/spec-1.json',
      HANDOFF_TYPE: 'docs', RETURN_MODE: 'json', H1_BLOCK: '', PLAN_LINE: '',
    }, 'test');
    expect(out).toContain('/tmp/spec.md');
    expect(out).toContain('completeness · consistency · clarity');
    expect(out).toContain('/tmp/spec-1.json');
  });

  it('throws on missing param', async () => {
    vi.resetModules();
    const { renderTemplate } = await import('../lib/templates.mjs');
    expect(() => renderTemplate('review', { TYPE: 'spec', WORKSPACE: '/ws' }, 'test')).toThrow('missing param');
  });
});
