// packages/cdd-engine/bin/tests/templates.content.test.mjs
// Task 4 (模板数据化): review prompts are data-driven via templates/review/reviews.json +
// the shared templates/review/review.md shell; the six legacy templates are deleted.
// This file reads the REAL template files (no fs mock) to pin the shipped-review-prompt
// contract. (The Task 5 后续断言注入点 for review params lives here too.)
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.resolve(__dirname, '..', '..');

describe('review.md shared shell (Task 4)', () => {
  const review = readFileSync(path.join(PKG_ROOT, 'templates', 'review', 'review.md'), 'utf8');

  it('carries the review shell placeholders', () => {
    for (const p of ['TYPE', 'LENS_GUIDE', 'WORKSPACE', 'REFERENCE', 'AXES', 'HANDOFF', 'HANDOFF_TYPE', 'RETURN_MODE', 'H1_BLOCK', 'HARD_GATE']) {
      expect(review).toContain(`{{${p}}}`);
    }
  });

  it('places the Handoff section before the H1 block slot', () => {
    const handoffIdx = review.indexOf('## Handoff');
    const h1Idx = review.indexOf('{{H1_BLOCK}}');
    expect(handoffIdx).toBeGreaterThan(-1);
    expect(h1Idx).toBeGreaterThan(handoffIdx);
  });
});

describe('reviews.json per-type config (Task 4)', () => {
  it('loadReviews exposes four types with content fields (artifact axis removed in T2)', async () => {
    const { loadReviews, reviewTypeConfig, reviewArtifactConfig } = await import('../lib/templates.mjs');
    const { familyConfig } = await import('../lib/handoff-naming.mjs');
    const reviews = loadReviews();
    expect(Object.keys(reviews)).toEqual(['task', 'branch', 'spec', 'plan']);
    for (const [type, cfg] of Object.entries(reviews)) {
      // 内容轴（reviews.json）：lensEnum/ref/axesGuide；artifact 词退位 → canonical 读取
      expect(Array.isArray(cfg.lensEnum)).toBe(true);
      expect(typeof cfg.ref).toBe('string');
      expect(typeof cfg.axesGuide).toBe('string');
      expect(cfg).not.toHaveProperty('returnMode');
      expect(cfg).not.toHaveProperty('handoffType');
      expect(cfg).not.toHaveProperty('fixTemplate');
      // artifact 轴（canonical review.{type} 族）：schema/return 从 canonical 派生
      const art = reviewArtifactConfig(type);
      expect(['h1', 'json']).toContain(art.return);
      expect(['cdd', 'docs']).toContain(art.schema);
    }
    // type-specific truth pinned by the plan (TASK_BASE..HEAD / BASE..HEAD 供具体化注入)
    expect(reviewTypeConfig('task').ref).toBe('TASK_BASE..HEAD');
    expect(reviewArtifactConfig('task')).toEqual({ schema: 'cdd', return: 'h1', fixFamily: 'fix.task' });
    expect(reviewArtifactConfig('branch')).toEqual({ schema: 'cdd', return: 'h1' }); // branch 无 fix 族
    expect(reviewArtifactConfig('plan')).toEqual({ schema: 'docs', return: 'json', fixFamily: 'fix.plan' });
    expect(reviewTypeConfig('spec').lensEnum).toEqual(['completeness', 'consistency', 'clarity']);
    // fixTemplate 仅在 fix 族定义（fixTemplate 从 canonical fix.{type} 尾解）
    expect(familyConfig('fix', 'spec').fixTemplate).toBe('doc-fix');
    expect(familyConfig('fix', 'task').fixTemplate).toBe('fix');
    expect(() => reviewTypeConfig('nope')).toThrow(/unknown review type/);
  });

  it('renderModePrompt(review) renders review.md via the type=task config', async () => {
    const { renderModePrompt } = await import('../lib/templates.mjs');
    const out = renderModePrompt('review', {
      WORKSPACE: '/ws', HANDOFF: '/ws/task-1-review-1.json', FIXED_POINT: '7a7327b',
    });
    expect(out).toContain('# CDD review — task');
    expect(out).toContain('standards · spec');
    expect(out).not.toContain('{{HANDOFF_STUB}}');
    expect(out).toContain('blocker: <none|one-line>'); // H1 四行合同在渲染输出内
    expect(out.indexOf('## Handoff')).toBeLessThan(out.indexOf('## Return (H1')); // Bug C 回归
  });
});

describe('doc-fix.md shared docs fix shell (Task 4)', () => {
  it('carries the doc fix placeholders spec/plan share', () => {
    const content = readFileSync(path.join(PKG_ROOT, 'templates', 'review', 'doc-fix.md'), 'utf8');
    expect(content).toContain('{{DOC}}');
    expect(content).toContain('{{FINDINGS}}');
    expect(content).toContain('{{HANDOFF}}');
    expect(content).toContain('{{HANDOFF_STUB}}');
  });
});

describe('legacy review/fix templates removed (Task 4)', () => {
  it('the six legacy template names are unmapped in MODE_GROUPS', async () => {
    const { templatePath } = await import('../lib/templates.mjs');
    for (const name of ['task-review', 'spec-review', 'plan-review', 'branch-review', 'spec-fix', 'plan-fix']) {
      expect(() => templatePath(name)).toThrow(/unknown template/);
    }
  });
});

describe('review.md HARD GATE（T6: returnMode 分写 + engine 读回确认）', () => {
  it('共享壳带 {{HARD_GATE}} 槽（Handoff 段内、H1 block 之前）', () => {
    const review = readFileSync(path.join(PKG_ROOT, 'templates', 'review', 'review.md'), 'utf8');
    const handoffIdx = review.indexOf('## Handoff');
    const gateIdx = review.indexOf('{{HARD_GATE}}');
    expect(gateIdx).toBeGreaterThan(handoffIdx);
    expect(gateIdx).toBeLessThan(review.indexOf('{{H1_BLOCK}}'));
  });

  it('renderModePrompt(review, returnMode=h1) → "BEFORE outputting H1"', async () => {
    const { renderModePrompt } = await import('../lib/templates.mjs');
    const out = renderModePrompt('review', {
      WORKSPACE: '/ws', HANDOFF: '/ws/task-1-review-1.json', FIXED_POINT: '7a7327b',
    });
    expect(out).toMatch(/HARD GATE[^\n]*BEFORE outputting H1/);
    expect(out).not.toContain('BEFORE outputting the JSON return');
    expect(out).toContain('/ws/task-1-review-1.json'); // 注入实际 handoff 路径
  });

  it('renderTemplate(spec, returnMode=json) → "BEFORE outputting the JSON return"', async () => {
    const { renderTemplate, reviewHardGate } = await import('../lib/templates.mjs');
    const out = renderTemplate('review', {
      TYPE: 'spec', WORKSPACE: '/ws', LENS_GUIDE: 'completeness · consistency · clarity',
      REFERENCE: '/tmp/spec.md', AXES: 'URC', HANDOFF: '/tmp/spec-review-1.json',
      HANDOFF_TYPE: 'docs', RETURN_MODE: 'json', H1_BLOCK: '', PLAN_LINE: '',
      HARD_GATE: reviewHardGate('json', '/tmp/spec-review-1.json'),
    });
    expect(out).toMatch(/HARD GATE[\s\S]*BEFORE outputting the JSON return/);
    expect(out).not.toContain('BEFORE outputting H1');
    expect(out).toContain('/tmp/spec-review-1.json');
  });
});

describe('implement.md（T6: 实体化 + 无 Handoff Output 段 + evidence-gate 指引）', () => {
  const impl = readFileSync(path.join(PKG_ROOT, 'templates', 'task', 'implement.md'), 'utf8');

  it('删除了 Handoff Output 段（agent 不再手写 handoff / JSON stub / jq self-validate）', () => {
    expect(impl).not.toContain('## Handoff Output');
    expect(impl).not.toContain('{{HANDOFF_STUB}}');
    expect(impl).not.toContain('jq .');
  });

  it('头部行声明本模式不写 handoff（runner 从 H1 + TASK_BASE + git HEAD 实体化）', () => {
    expect(impl).toMatch(/does not write a handoff/i);
    expect(impl).toContain('task-{{TASK}}-implement.json');
    expect(impl).toContain('TASK_BASE');
    expect(impl).toContain('{{TASK}}');
  });

  it('evidence-gate 指引说明 engine 读回校验（hard: command/passed/exit_code；soft: WARN）', () => {
    expect(impl).toContain('behavior_change');
    expect(impl).toContain('command');
    expect(impl).toContain('passed');
    expect(impl).toContain('exit_code');
  });

  it('保留 Return (H1 — stdout only) 段 + H1 四行合同', () => {
    expect(impl).toContain('## Return (H1 — stdout only)');
    expect(impl).toContain('status: <APPROVED|BLOCKED>');
  });
});