// packages/cdd-engine/src/render/__tests__/templates.content.test.ts
// Task 4 (模板数据化): review prompts are data-driven via template-contract.json#reviews +
// the shared templates/docs/review.md shell; the six legacy templates are deleted.
// This file reads the REAL template files (no fs mock) to pin the shipped-review-prompt
// contract. (Task 5: 文件布局归一 review/review.md → docs/review.md, fix/docs.md → docs/fix.md;
// token registry 新命名全收敛 —— 旧态名零断言覆盖在 templates.test.ts.)
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.resolve(__dirname, '..', '..', '..');   // tests → packages/cdd-engine（tests 移顶层，深度 −1）

describe('docs/review.md shared shell (Task 4 + Task 5 token registry)', () => {
  const review = readFileSync(path.join(PKG_ROOT, 'templates', 'docs', 'review.md'), 'utf8');

  it('carries the review shell placeholders (Task 5 命名: REVIEW_*/TASK_WORKSPACE/RETURN_*/HANDOFF_*)', () => {
    for (const p of ['REVIEW_TYPE', 'REVIEW_LENS_GUIDE', 'TASK_WORKSPACE', 'REVIEW_REFERENCE', 'REVIEW_AXES',
      'HANDOFF_TARGET', 'RETURN_FORMAT', 'RETURN_STDOUT_BLOCK', 'HANDOFF_WRITE_GATE', 'HANDOFF_SCHEMA_JSON']) {
      expect(review, p).toContain(`{{${p}}}`);
    }
  });

  it('places the Handoff section before the Return section (+ RETRUN_STDOUT_BLOCK 槽在 Return 段内)', () => {
    const handoffIdx = review.indexOf('## Handoff');
    const retIdx = review.indexOf('## Return');
    const h1Idx = review.indexOf('{{RETURN_STDOUT_BLOCK}}');
    expect(handoffIdx).toBeGreaterThan(-1);
    expect(retIdx).toBeGreaterThan(handoffIdx);
    expect(h1Idx).toBeGreaterThan(retIdx);
  });
});

describe('template-contract reviews per-type config (Task 4 + Task 5)', () => {
  it('loadReviews exposes four types with content fields (artifact axis removed in T2)', async () => {
    const { loadReviews, reviewTypeConfig, reviewArtifactConfig } = await import('../templates.ts');
    const { familyConfig } = await import('../../artifacts/handoff/naming.ts');
    const reviews = loadReviews();
    expect(Object.keys(reviews)).toEqual(['task', 'branch', 'spec', 'plan']);
    for (const [type, cfg] of Object.entries(reviews)) {
      // 内容轴（#reviews）：lensEnum/ref/axesGuide；artifact 词退位 → canonical 读取
      expect(Array.isArray(cfg.lensEnum)).toBe(true);
      expect(typeof cfg.ref).toBe('string');
      expect(typeof cfg.axesGuide).toBe('string');
      expect(cfg).not.toHaveProperty('returnMode');
      expect(cfg).not.toHaveProperty('handoffType');
      expect(cfg).not.toHaveProperty('fixTemplate');
      // artifact 轴（canonical review.{type} 族）：schema/return 从 canonical 派生
      const art = reviewArtifactConfig(type);
      expect(['RETURN_STDOUT_BLOCK', 'RETURN_JSON']).toContain(art.returnFormat);
      expect(['task', 'docs']).toContain(art.schema);
    }
    // type-specific truth pinned by the plan (TASK_BASE..HEAD / BASE..HEAD 供具体化注入)
    expect(reviewTypeConfig('task').ref).toBe('TASK_BASE..HEAD');
    expect(reviewArtifactConfig('task')).toEqual({ schema: 'task', returnFormat: 'RETURN_STDOUT_BLOCK' });
    expect(reviewArtifactConfig('branch')).toEqual({ schema: 'task', returnFormat: 'RETURN_STDOUT_BLOCK' }); // branch 无 fix 族
    expect(reviewArtifactConfig('plan')).toEqual({ schema: 'docs', returnFormat: 'RETURN_JSON' });
    expect(reviewTypeConfig('spec').lensEnum).toEqual(['completeness', 'consistency', 'clarity']);
    // fixTemplate 仅在 fix 族定义（fixTemplate 从 canonical fix.{type} 尾解）
    expect(familyConfig('fix', 'spec').fixTemplate).toBe('docs');
    expect(familyConfig('fix', 'task').fixTemplate).toBe('fix');
    expect(() => reviewTypeConfig('nope')).toThrow(/unknown review type/);
  });

  it('renderModePrompt(review) renders docs/review.md via the type=task config (Task 5 tokens)', async () => {
    const { renderModePrompt } = await import('../templates.ts');
    const out = renderModePrompt('review', {
      TASK_WORKSPACE: '/ws', HANDOFF_TARGET: '/ws/task-1-review-1.json', TASK_FIXED_POINT: '7a7327b',
    });
    expect(out).toContain('# CDD review — task');
    expect(out).toContain('standards · spec');
    expect(out).not.toContain('{{HANDOFF_SCHEMA_JSON}}');
    expect(out).toContain('blocker: <none|one-line>'); // H1 四行合同在渲染输出内
    expect(out.indexOf('## Handoff')).toBeLessThan(out.indexOf('## Return')); // Bug C 回归（T18 后共享 ## Return 壳）
  });
});

describe('docs/fix.md shared docs fix shell (Task 18: doc-fix.md 迁出 review/; Task 5: fix/docs.md → docs/fix.md)', () => {
  it('carries the doc fix placeholders spec/plan share', () => {
    const content = readFileSync(path.join(PKG_ROOT, 'templates', 'docs', 'fix.md'), 'utf8');
    expect(content).toContain('{{DOCS_DOC}}');
    expect(content).toContain('{{DOCS_FINDINGS}}');
    expect(content).toContain('{{HANDOFF_TARGET}}');
    expect(content).toContain('{{HANDOFF_SCHEMA_JSON}}');
    expect(content).toContain('{{HANDOFF_WRITE_GATE}}'); // 共享 Handoff 壳（T18）
  });

  it('carries the docs-fix commit contract (Task 10, task-family isomorphic: fix agent commits the fixed doc)', () => {
    const content = readFileSync(path.join(PKG_ROOT, 'templates', 'docs', 'fix.md'), 'utf8');
    expect(content).toMatch(/conventional commit/);          // conventional commit
    expect(content).toMatch(/attribution/);                  // no attribution / co-author trailers
    expect(content).toMatch(/no commit/);                    // no doc diff → skip commit
    expect(content).toMatch(/out-of-scope/);                 // out-of-scope changes untouched
    expect(content).toMatch(/BLOCKED/);                      // uncommitted at return → exit gate BLOCKED
  });
});

describe('fix-family status decision rule (T5 fix round 2)', () => {
  it('fix 族模板都承载 status 决策句（同一判据不得三份模板三处置）', () => {
    for (const rel of [['task', 'fix.md'], ['docs', 'fix.md']]) {
      const content = readFileSync(path.join(PKG_ROOT, 'templates', ...rel), 'utf8');
      expect(content, rel.join('/')).toMatch(/^- `status`: APPROVED .*or BLOCKED/m);
    }
  });
});

describe('legacy review/fix templates removed (Task 4)', () => {
  it('the legacy review/fix template names are unmapped in TEMPLATE_FILES', async () => {
    const { templatePath } = await import('../templates.ts');
    for (const name of ['spec-review', 'plan-review', 'branch-review', 'spec-fix', 'plan-fix']) {
      expect(() => templatePath(name)).toThrow(/unknown template/);
    }
  });
});

describe('docs/review.md HANDOFF_WRITE_GATE（T6 + Task 5: HARD_GATE → HANDOFF_WRITE_GATE）', () => {
  it('共享壳带 {{HANDOFF_WRITE_GATE}} 槽（Handoff 段内、Return 段之前）', () => {
    const review = readFileSync(path.join(PKG_ROOT, 'templates', 'docs', 'review.md'), 'utf8');
    const handoffIdx = review.indexOf('## Handoff');
    const gateIdx = review.indexOf('{{HANDOFF_WRITE_GATE}}');
    expect(gateIdx).toBeGreaterThan(handoffIdx);
    expect(gateIdx).toBeLessThan(review.indexOf('## Return'));
  });

  it('renderModePrompt(review) → "BEFORE outputting the RETURN_STDOUT_BLOCK"（injects actual handoff path）', async () => {
    const { renderModePrompt } = await import('../templates.ts');
    const out = renderModePrompt('review', {
      TASK_WORKSPACE: '/ws', HANDOFF_TARGET: '/ws/task-1-review-1.json', TASK_FIXED_POINT: '7a7327b',
    });
    expect(out).toMatch(/HARD GATE[^\n]*BEFORE outputting the RETURN_STDOUT_BLOCK/);
    expect(out).not.toContain('BEFORE outputting the JSON return');
    expect(out).toContain('/ws/task-1-review-1.json'); // 注入实际 handoff 路径
  });

  it('renderTemplate(spec, returnFormat=RETURN_JSON) → "BEFORE outputting the JSON return"', async () => {
    const { renderTemplate, reviewHardGate } = await import('../templates.ts');
    const out = renderTemplate('review', {
      REVIEW_TYPE: 'spec', TASK_WORKSPACE: '/ws', REVIEW_LENS_GUIDE: 'completeness · consistency · clarity',
      REVIEW_REFERENCE: '/tmp/spec.md', REVIEW_AXES: 'URC', HANDOFF_TARGET: '/tmp/spec-review-1.json',
      RETURN_FORMAT: 'RETURN_JSON', RETURN_STDOUT_BLOCK: '', REVIEW_PLAN_LINE: '',
      HANDOFF_WRITE_GATE: reviewHardGate('RETURN_JSON', '/tmp/spec-review-1.json'),
    });
    expect(out).toMatch(/HARD GATE[\s\S]*BEFORE outputting the JSON return/);
    expect(out).not.toContain('BEFORE outputting the RETURN_STDOUT_BLOCK');
    expect(out).toContain('/tmp/spec-review-1.json');
  });
});

describe('docs/fix.md HANDOFF_WRITE_GATE（Task 18 review-1 finding 2: fix return = 写盘，非 stdout JSON return）', () => {
  it('docsFixHardGate 渲染文本与 fix return 语义一致（“BEFORE exiting” 而非 “BEFORE outputting the JSON return”）', async () => {
    const { docsFixHardGate } = await import('../templates.ts');
    const gate = docsFixHardGate('/ws/spec-fix-2.json');
    expect(gate).toMatch(/HARD GATE[^\n]*BEFORE exiting/);
    expect(gate).not.toContain('JSON return');                                  // fix stdout 无 JSON return —— 门不得谈「输出 JSON return」
    expect(gate).toContain('the engine reads the file, not your stdout');        // 与 docs/fix.md ## Return 互文（写盘即 return）
    expect(gate).toContain('/ws/spec-fix-2.json');
    expect(gate).toContain('BLOCKED (runner exit 1)');
  });
});

describe('implement.md（T6: 实体化 + 无 Handoff Output 段 + evidence-gate 指引）', () => {
  const impl = readFileSync(path.join(PKG_ROOT, 'templates', 'task', 'implement.md'), 'utf8');

  it('删除了 Handoff Output 段（T18：共享 Handoff 壳 — schema 原样注入槽，agent 不手写 handoff / jq self-validate）', () => {
    expect(impl).not.toContain('## Handoff Output');
    expect(impl).not.toContain('jq .');
    expect(impl).toContain('## Handoff');        // T18：共享 Handoff 段存在
    expect(impl).toContain('{{HANDOFF_SCHEMA_JSON}}');  // schema 原样注入槽（模板级占位）
    expect(impl).toContain('{{HANDOFF_WRITE_GATE}}');   // HARD GATE 槽（implement 注入值为 runner 实体化语义）
  });

  it('头部行声明本模式不写 handoff（runner 从 H1 + TASK_BASE + git HEAD 实体化）', () => {
    expect(impl).toMatch(/does not write a handoff/i);
    expect(impl).toContain('task-{{TASK_NUMBER}}-implement.json');
    expect(impl).toContain('TASK_BASE');
    expect(impl).toContain('{{TASK_NUMBER}}');
  });

  it('evidence-gate 指引说明 engine 读回校验（hard: command/passed/exit_code；soft: WARN）', () => {
    expect(impl).toContain('behavior_change');
    expect(impl).toContain('command');
    expect(impl).toContain('passed');
    expect(impl).toContain('exit_code');
  });

  it('Return 段 = 共享壳（T18：标题统一 ## Return + {{RETURN_STDOUT_BLOCK}} 四行合同槽）', () => {
    expect(impl).toContain('## Return');
    expect(impl).toContain('{{RETURN_STDOUT_BLOCK}}');
    expect(impl).not.toContain('## Return (H1 — stdout only)'); // 标题随共享 ## Return 统一
  });
});
