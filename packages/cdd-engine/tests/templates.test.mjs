// packages/cdd-engine/tests/templates.test.mjs
import { describe, it, expect, vi } from 'vitest';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadHandoffSchema } from '../lib/handoff/schema.mjs';
import { renderHandoffStub } from '../lib/templates.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENGINE = path.join(__dirname, '..');
const TEMPLATES = path.join(ENGINE, 'templates');

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    existsSync: vi.fn((p) => String(p).endsWith('.md') || String(p).endsWith('.json')),
    readFileSync: vi.fn((p, enc) => {
      // Task 18：schema / canonical JSON / 模板 一律透传真实文件（不内联副本 → 消除 drift）。
      // 旧 fabricated schema 副本与 canned implement.md 字符串已删 ——
      // schema 原样注入断言需读写的是**真身**（模板真身另由 templates.content.test.mjs 锚定）。
      if (String(p).includes('task-handoff-schema.json')) return actual.readFileSync(p, 'utf8');
      if (String(p).includes('docs-handoff-schema.json')) return actual.readFileSync(p, 'utf8');
      if (String(p).includes('handoff-namespace.json')) return actual.readFileSync(p, 'utf8');
      if (String(p).includes('reviews.json')) return actual.readFileSync(p, 'utf8');
      if (String(p).includes('review.md')) return actual.readFileSync(p, 'utf8');
      if (String(p).includes('templates') && String(p).endsWith('.md')) return actual.readFileSync(p, 'utf8');
      return '';
    }),
  };
});

describe('PKG_ROOT', () => {
  it('resolves to the templates resource dir under packages/cdd-engine', async () => {
    const { PKG_ROOT } = await import('../lib/templates.mjs');
    // re-org Step 5：PKG_ROOT 语义收敛为模板资源目录本身（fileURLToPath(new URL("../templates", …))）。
    expect(PKG_ROOT).toMatch(/packages\/cdd-engine\/templates$/);
  });
});

describe('review type config (Task 4: 模板数据化)', () => {
  it('loadReviews returns the four review types', async () => {
    vi.resetModules();
    const { loadReviews } = await import('../lib/templates.mjs');
    expect(Object.keys(loadReviews())).toEqual(['task', 'branch', 'spec', 'plan']);
  });

  it('reviews.json 纯内容契约：无 artifact 字段（T2 裁轴）', () => {
    // 直接读真实 reviews.json（经 fs mock 透传）：returnMode/handoffType/fixTemplate
    // 已迁 canonical（review.{type} 族 schema/return + fix 族 fixTemplate），reviews.json 只剩内容轴。
    const REVIEWS = JSON.parse(readFileSync(new URL('../templates/review/reviews.json', import.meta.url), 'utf8'));
    for (const cfg of Object.values(REVIEWS)) {
      expect(cfg).not.toHaveProperty('returnMode');
      expect(cfg).not.toHaveProperty('handoffType');
      expect(cfg).not.toHaveProperty('fixTemplate');
    }
  });

  it('reviewTypeConfig: known type → content-only config; unknown → throw', async () => {
    vi.resetModules();
    const { reviewTypeConfig } = await import('../lib/templates.mjs');
    expect(reviewTypeConfig('task').lensEnum).toEqual(['standards', 'spec']);
    expect(reviewTypeConfig('task')).not.toHaveProperty('returnMode');
    expect(reviewTypeConfig('task')).not.toHaveProperty('fixTemplate');
    expect(() => reviewTypeConfig('nope')).toThrow('unknown review type: nope');
  });

  it('reviewArtifactConfig: canonical review.{type} 族 → { schema, return }（T2 裁轴；fixFamily 已删——runFix 直读 fix 族）', async () => {
    vi.resetModules();
    const { reviewArtifactConfig } = await import('../lib/templates.mjs');
    expect(reviewArtifactConfig('task')).toEqual({ schema: 'task', return: 'h1' });
    expect(reviewArtifactConfig('branch')).toEqual({ schema: 'task', return: 'h1' });
    expect(reviewArtifactConfig('spec')).toEqual({ schema: 'docs', return: 'json' });
    expect(reviewArtifactConfig('plan')).toEqual({ schema: 'docs', return: 'json' });
    expect(() => reviewArtifactConfig('nope')).toThrow(/unknown handoff family/);
  });

  it('renderModePrompt(review) routes via review.md + reviews.json type=task (code-review focus)', async () => {
    vi.resetModules();
    const { renderModePrompt } = await import('../lib/templates.mjs');
    const out = renderModePrompt('review', {
      WORKSPACE: '/ws', HANDOFF: '/ws/task-1-review-1.json', FIXED_POINT: '7a7327b',
    });
    expect(out).toContain('# CDD review — task');
    expect(out).toContain('standards · spec');            // lensEnum joined
    expect(out).toContain('7a7327b..HEAD');               // ref 具体化为 FIXED_POINT..HEAD
    expect(out).toContain('code-review smell baseline');   // axesGuide → code-review 焦点
    expect(out).toContain('/ws/task-1-review-1.json');
    expect(out.indexOf('## Handoff')).toBeLessThan(out.indexOf('## Return')); // Bug C 排序保持（T18 后为共享 ## Return 壳）
    expect(out).not.toContain('{{HANDOFF_STUB}}'); // r2-r3 泄漏回归：共享壳 stub 槽必须被替换
  });
});

describe('renderTemplate', () => {
  it('replaces all params (review shell)', async () => {
    vi.resetModules();
    const { renderTemplate } = await import('../lib/templates.mjs');
    const out = renderTemplate('review', {
      TYPE: 'spec', WORKSPACE: '/ws', LENS_GUIDE: 'completeness · consistency · clarity',
      REFERENCE: '/tmp/spec.md', AXES: 'URC 规则指针', HANDOFF: '/tmp/spec-review-1.json',
      HANDOFF_TYPE: 'docs', RETURN_MODE: 'json', H1_BLOCK: '', PLAN_LINE: '',
      HARD_GATE: '> ⚠️ HARD GATE — Write `/tmp/spec-review-1.json` BEFORE outputting the JSON return.',
    }, 'test');
    expect(out).toContain('/tmp/spec.md');
    expect(out).toContain('completeness · consistency · clarity');
    expect(out).toContain('/tmp/spec-review-1.json');
    expect(out).toContain('HARD GATE');
  });

  it('throws on missing param', async () => {
    vi.resetModules();
    const { renderTemplate } = await import('../lib/templates.mjs');
    expect(() => renderTemplate('review', { TYPE: 'spec', WORKSPACE: '/ws' }, 'test')).toThrow('missing param');
  });

  it('模板名映射（Task 18）：`fix/docs.md` 经 name=docs 解析；doc-fix 名已删', async () => {
    vi.resetModules();
    const { templatePath } = await import('../lib/templates.mjs');
    expect(templatePath('docs')).toMatch(/templates\/fix\/docs\.md$/);
    expect(templatePath('fix')).toMatch(/templates\/task\/fix\.md$/);
    expect(() => templatePath('doc-fix')).toThrow(/unknown template/);
  });
});

// ---- Task 18：templates 结构与命名单源 — 4 模板同骨架 + schema 原样注入 + 零手写 render ----

describe('templates 结构命名单源（Task 18：schema 原样注入 + 共享 Handoff/Return 壳）', () => {
  const TEMPLATE_FILES = ['task/implement.md', 'task/fix.md', 'review/review.md', 'fix/docs.md'];

  it('4 模板同一骨架：每份含且仅含 Instructions / Handoff / Return 三个二级段', () => {
    for (const f of TEMPLATE_FILES) {
      const src = readFileSync(path.join(TEMPLATES, f), 'utf8');
      const secs = [...src.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
      expect(secs, f).toEqual(['Instructions', 'Handoff', 'Return']);
    }
  });

  it('Handoff 段为 schema 原样注入（含 description，零手写 render）', () => {
    const schema = loadHandoffSchema('task');
    const stub = renderHandoffStub(schema);
    expect(JSON.parse(stub.replace(/^```json\n/, '').replace(/\n```$/, ''))).toEqual(schema);
  });

  it('零手写 render 符号', () => {
    const src = readFileSync(path.join(ENGINE, 'lib/templates.mjs'), 'utf8');
    for (const gone of ['stubAnnotation', 'satisfiesProp', 'patternSample', 'requiredKeys', 'stubScalar', 'renderAllOfConditions']) {
      expect(src, gone).not.toMatch(new RegExp(`\\b${gone}\\b`));
    }
  });

  it('共享壳骨架：每份 Handoff 段 HARD_GATE → 写入句 → HANDOFF_STUB 顺位；Return 段带 task/docs return 壳', () => {
    for (const f of TEMPLATE_FILES) {
      const src = readFileSync(path.join(TEMPLATES, f), 'utf8');
      const handoff = src.slice(src.indexOf('## Handoff'), src.indexOf('## Return'));
      expect(handoff, f).toContain('{{HARD_GATE}}');
      expect(handoff, f).toContain('{{HANDOFF_STUB}}');
      expect(handoff, f).toMatch(/Write\/update `\{\{HANDOFF\}\}` per the schema above/);
      expect(handoff.indexOf('{{HARD_GATE}}'), f).toBeLessThan(handoff.indexOf('{{HANDOFF_STUB}}'));
      const ret = src.slice(src.indexOf('## Return'));
      if (f === 'fix/docs.md') {
        expect(ret, f).not.toContain('{{H1_BLOCK}}');           // docs 族 return = JSON 说明
      } else {
        expect(ret, f).toContain('{{H1_BLOCK}}');               // task 族 return = 共享 H1 壳
      }
    }
  });
});