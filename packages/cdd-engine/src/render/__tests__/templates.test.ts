// packages/cdd-engine/src/render/__tests__/templates.test.ts
import { describe, it, expect, vi } from 'vitest';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadHandoffSchema } from '../../rules/schema.ts';
import { renderHandoffSchemaJson } from '../templates.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENGINE = path.join(__dirname, '..', '..', '..');
const TEMPLATES = path.join(ENGINE, 'templates');

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    existsSync: vi.fn((p) => String(p).endsWith('.md') || String(p).endsWith('.json')),
    readFileSync: vi.fn((p, enc) => {
      // Task 18：schema / canonical JSON / 模板 一律透传真实文件（不内联副本 → 消除 drift）。
      // 旧 fabricated schema 副本与 canned implement.md 字符串已删 ——
      // schema 原样注入断言需读写的是**真身**（模板真身另由 templates.content.test 锚定）。
      // Task 5：渲染数据面单文件 —— template-contract.json + engine-config.json 均透传真身。
      if (String(p).includes('task-handoff-schema.json')) return actual.readFileSync(p, 'utf8');
      if (String(p).includes('docs-handoff-schema.json')) return actual.readFileSync(p, 'utf8');
      if (String(p).includes('engine-config.json')) return actual.readFileSync(p, 'utf8');
      if (String(p).includes('template-contract.json')) return actual.readFileSync(p, 'utf8');
      if (String(p).includes('reviews.json')) return actual.readFileSync(p, 'utf8');
      if (String(p).includes('review.md')) return actual.readFileSync(p, 'utf8');
      if (String(p).includes('templates') && String(p).endsWith('.md')) return actual.readFileSync(p, 'utf8');
      return '';
    }),
  };
});

describe('PKG_ROOT', () => {
  it('resolves to the templates resource dir under packages/cdd-engine', async () => {
    const { PKG_ROOT } = await import('../templates.ts');
    // re-org Step 5：PKG_ROOT 语义收敛为模板资源目录本身（fileURLToPath(new URL("../templates", …))）。
    expect(PKG_ROOT).toMatch(/packages\/cdd-engine\/templates$/);
  });
});

// ---- Task 5 D1.5 ⑤：template-contract 单点消费 + token registry 全收敛 ----

describe('template-contract 单点消费 + token registry（Task 5 D1.4/⑤）', () => {
  it('loadTemplateContract 加载 template-contract.json 真身（skeleton{segments} + tokens(18) + clauses + reviews）', async () => {
    vi.resetModules();
    const { loadTemplateContract } = await import('../templates.ts');
    const contract = loadTemplateContract();
    expect(contract.skeleton.sections).toEqual(['Instructions', 'Handoff', 'Return']);
    expect(contract.skeleton.segments.static).toEqual(['title', 'context', 'instructions', 'handoff']);
    expect(contract.skeleton.segments.variant).toEqual(['return']);
    expect(contract.tokens).toHaveLength(18);
    expect(contract.clauses).toEqual({}); // T12 条款本体入库前为容器
    expect(Object.keys(contract.reviews)).toEqual(['task', 'branch', 'spec', 'plan']);
    // 与磁盘真身一致（单点）
    const onDisk = JSON.parse(readFileSync(path.join(TEMPLATES, 'template-contract.json'), 'utf8'));
    expect(contract).toEqual(onDisk);
  });

  it('18 令牌全收敛（新命名规范；零遗留旧态名）—— 4 模板使用的令牌 ⊆ registry', async () => {
    vi.resetModules();
    const { scanTemplateTokens, validateTemplateTokens, TEMPLATE_FILES, loadTemplateContract } = await import('../templates.ts');
    const contract = loadTemplateContract();
    for (const rel of Object.values(TEMPLATE_FILES)) {
      const src = readFileSync(path.join(TEMPLATES, rel), 'utf8');
      const used = scanTemplateTokens(src);
      expect(used.length).toBeGreaterThan(0);
      for (const tok of used) {
        expect(contract.tokens, `${rel}: {{${tok}}}`).toContain(tok); // 非 registry 令牌 → 总数对不上即炸
      }
      expect(() => validateTemplateTokens(src, contract)).not.toThrow();
    }
    // 旧态名零遗留：模板全文 + 渲染层源码禁现旧词（H1_BLOCK / HANDOFF_STUB / HANDOFF_TYPE /
    // TYPE / LENS_GUIDE / AXES / HARD_GATE / RETURN_MODE / WORKSPACE / REFERENCE / PLAN_LINE /
    // FINDINGS / BRIEF / TASK / CONSTRAINTS / FIXED_POINT / DOC）
    const LEGACY = ['{{H1_BLOCK}}', '{{HANDOFF_STUB}}', '{{HANDOFF_TYPE}}', '{{HANDOFF}}', '{{TYPE}}',
      '{{LENS_GUIDE}}', '{{AXES}}', '{{HARD_GATE}}', '{{RETURN_MODE}}', '{{WORKSPACE}}', '{{REFERENCE}}',
      '{{PLAN_LINE}}', '{{FINDINGS}}', '{{BRIEF}}', '{{TASK}}', '{{CONSTRAINTS}}', '{{FIXED_POINT}}', '{{DOC}}'];
    for (const rel of Object.values(TEMPLATE_FILES)) {
      const src = readFileSync(path.join(TEMPLATES, rel), 'utf8');
      for (const legacy of LEGACY) {
        expect(src, `${rel} 残留 ${legacy}`).not.toContain(legacy);
      }
    }
  });

  it('validateTemplateTokens: 非 registry 令牌（含旧态名）→ throw', async () => {
    vi.resetModules();
    const { validateTemplateTokens, loadTemplateContract } = await import('../templates.ts');
    const contract = loadTemplateContract();
    expect(() => validateTemplateTokens('# t\n{{H1_BLOCK}}', contract)).toThrow(/not in registry: H1_BLOCK/);
    expect(() => validateTemplateTokens('# t\n{{HANDOFF_STUB}}', contract)).toThrow(/not in registry/);
    expect(() => validateTemplateTokens('# t\n{{BOGUS_NEW}}', contract)).toThrow(/not in registry: BOGUS_NEW/);
  });

  it('skeleton: variant 令牌（RETURN_STDOUT_BLOCK / RETURN_FORMAT）只许在 ## Return 段内', async () => {
    vi.resetModules();
    const { validateTemplateStructure } = await import('../templates.ts');
    expect(() => validateTemplateStructure('## Instructions\n{{RETURN_FORMAT}}\n## Handoff\n## Return')).toThrow(/variant token/);
    expect(() => validateTemplateStructure('## Instructions\n## Handoff\n## Return\n{{RETURN_STDOUT_BLOCK}}')).not.toThrow();
  });

  it('validateShippedTemplates: 4 模板逐一对骨架/token 校验通过 → 返回 TEMPLATE_FILES 清单', async () => {
    vi.resetModules();
    const { validateShippedTemplates, TEMPLATE_FILES } = await import('../templates.ts');
    expect(validateShippedTemplates()).toEqual(Object.values(TEMPLATE_FILES));
    expect(Object.values(TEMPLATE_FILES)).toEqual(['task/implement.md', 'task/fix.md', 'docs/review.md', 'docs/fix.md']);
  });
});

describe('review type config (Task 4: 模板数据化)', () => {
  it('loadReviews returns the four review types (from template-contract.json#reviews)', async () => {
    vi.resetModules();
    const { loadReviews } = await import('../templates.ts');
    expect(Object.keys(loadReviews())).toEqual(['task', 'branch', 'spec', 'plan']);
  });

  it('reviews 纯内容契约：无 artifact 字段（T2 裁轴；Task 5 单文件入 template-contract.json#reviews）', () => {
    // 直接读真身（经 fs mock 透传）：returnFormat/handoffType/fixTemplate
    // 已迁 canonical（review.{type} 族 schema/return + fix 族 fixTemplate），reviews 只剩内容轴。
    const CONTRACT = JSON.parse(readFileSync(new URL('../../../templates/template-contract.json', import.meta.url), 'utf8'));
    for (const cfg of Object.values(CONTRACT.reviews)) {
      expect(cfg).not.toHaveProperty('returnMode');
      expect(cfg).not.toHaveProperty('handoffType');
      expect(cfg).not.toHaveProperty('fixTemplate');
    }
  });

  it('reviewTypeConfig: known type → content-only config; unknown → throw', async () => {
    vi.resetModules();
    const { reviewTypeConfig } = await import('../templates.ts');
    expect(reviewTypeConfig('task').lensEnum).toEqual(['standards', 'spec']);
    expect(reviewTypeConfig('task')).not.toHaveProperty('returnMode');
    expect(reviewTypeConfig('task')).not.toHaveProperty('fixTemplate');
    expect(() => reviewTypeConfig('nope')).toThrow('unknown review type: nope');
  });

  it('reviewArtifactConfig: canonical review.{type} 族 → { schema, return }（T2 裁轴；fixFamily 已删——runFix 直读 fix 族）', async () => {
    vi.resetModules();
    const { reviewArtifactConfig } = await import('../templates.ts');
    expect(reviewArtifactConfig('task')).toEqual({ schema: 'task', return: 'h1' });
    expect(reviewArtifactConfig('branch')).toEqual({ schema: 'task', return: 'h1' });
    expect(reviewArtifactConfig('spec')).toEqual({ schema: 'docs', return: 'json' });
    expect(reviewArtifactConfig('plan')).toEqual({ schema: 'docs', return: 'json' });
    expect(() => reviewArtifactConfig('nope')).toThrow(/unknown handoff family/);
  });

  it('renderModePrompt(review) routes via docs/review.md + template-contract reviews type=task (code-review focus)', async () => {
    vi.resetModules();
    const { renderModePrompt } = await import('../templates.ts');
    const out = renderModePrompt('review', {
      TASK_WORKSPACE: '/ws', HANDOFF_TARGET: '/ws/task-1-review-1.json', TASK_FIXED_POINT: '7a7327b',
    });
    expect(out).toContain('# CDD review — task');
    expect(out).toContain('standards · spec');            // lensEnum joined
    expect(out).toContain('7a7327b..HEAD');               // ref 具体化为 FIXED_POINT..HEAD
    expect(out).toContain('code-review smell baseline');   // axesGuide → code-review 焦点
    expect(out).toContain('/ws/task-1-review-1.json');
    expect(out.indexOf('## Handoff')).toBeLessThan(out.indexOf('## Return')); // Bug C 排序保持（T18 后为共享 ## Return 壳）
    expect(out).not.toContain('{{HANDOFF_SCHEMA_JSON}}'); // r2-r3 泄漏回归：共享壳槽必须被替换
  });
});

describe('renderTemplate', () => {
  it('replaces all params (review shell, Task 5 tokens)', async () => {
    vi.resetModules();
    const { renderTemplate } = await import('../templates.ts');
    const out = renderTemplate('review', {
      REVIEW_TYPE: 'spec', TASK_WORKSPACE: '/ws', REVIEW_LENS_GUIDE: 'completeness · consistency · clarity',
      REVIEW_REFERENCE: '/tmp/spec.md', REVIEW_AXES: 'URC 规则指针', HANDOFF_TARGET: '/tmp/spec-review-1.json',
      RETURN_FORMAT: 'json', RETURN_STDOUT_BLOCK: '', REVIEW_PLAN_LINE: '',
      HANDOFF_WRITE_GATE: '> ⚠️ HARD GATE — Write `/tmp/spec-review-1.json` BEFORE outputting the JSON return.',
    }, 'test');
    expect(out).toContain('/tmp/spec.md');
    expect(out).toContain('completeness · consistency · clarity');
    expect(out).toContain('/tmp/spec-review-1.json');
    expect(out).toContain('HARD GATE');
  });

  it('throws on missing param', async () => {
    vi.resetModules();
    const { renderTemplate } = await import('../templates.ts');
    expect(() => renderTemplate('review', { REVIEW_TYPE: 'spec', TASK_WORKSPACE: '/ws' }, 'test')).toThrow('missing param');
  });

  it('模板名映射（Task 18/5）：`docs/review.md` 与 `docs/fix.md` 就位；doc-fix 名已删', async () => {
    vi.resetModules();
    const { templatePath } = await import('../templates.ts');
    expect(templatePath('docs')).toMatch(/templates\/docs\/fix\.md$/);
    expect(templatePath('fix')).toMatch(/templates\/task\/fix\.md$/);
    expect(templatePath('review')).toMatch(/templates\/docs\/review\.md$/);
    expect(() => templatePath('doc-fix')).toThrow(/unknown template/);
  });
});

// ---- Task 18：templates 结构与命名单源 — 4 模板同骨架 + schema 原样注入 + 零手写 render ----

describe('templates 结构命名单源（Task 18 + Task 5：schema 原样注入 + 共享 Handoff/Return 壳 + 骨架数据驱动）', () => {
  const TEMPLATE_FILES = ['task/implement.md', 'task/fix.md', 'docs/review.md', 'docs/fix.md'];

  it('4 模板同一骨架：每份含且仅含 Instructions / Handoff / Return 三个二级段（自 template-contract skeleton）', () => {
    const contract = JSON.parse(readFileSync(path.join(TEMPLATES, 'template-contract.json'), 'utf8'));
    for (const f of TEMPLATE_FILES) {
      const src = readFileSync(path.join(TEMPLATES, f), 'utf8');
      const secs = [...src.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
      expect(secs, f).toEqual(contract.skeleton.sections);
    }
  });

  it('Handoff 段为 schema 原样注入（含 description，零手写 render）', () => {
    const schema = loadHandoffSchema('task');
    const stub = renderHandoffSchemaJson(schema);
    expect(JSON.parse(stub.replace(/^```json\n/, '').replace(/\n```$/, ''))).toEqual(schema);
  });

  it('零手写 render 符号', () => {
    const src = readFileSync(path.join(ENGINE, 'src/render/templates.ts'), 'utf8');
    // 经拼接构造（residue.test 先例）：本文件不得成为被守卫语汇的载体 —— 否则 T18 Step 7 的
    // 机制面 grep（src/ + templates/）在含测试位的全扫下会命中自身（测试位由 walk 默认自豁免，此处仅为既有注释语义保持）。
    const GONE = [['stub', 'Annotation'], ['satis', 'fiesProp'], ['pattern', 'Sample'], ['required', 'Keys'], ['stub', 'Scalar'], ['renderAllOf', 'Conditions']]
      .map(([a, b]) => a + b);
    for (const gone of GONE) {
      expect(src, gone).not.toMatch(new RegExp(`\\b${gone}\\b`));
    }
  });

  it('共享壳骨架：每份 Handoff 段 HANDOFF_WRITE_GATE → 写入句 → HANDOFF_SCHEMA_JSON 顺位；Return 段带 task/docs return 壳', () => {
    for (const f of TEMPLATE_FILES) {
      const src = readFileSync(path.join(TEMPLATES, f), 'utf8');
      const handoff = src.slice(src.indexOf('## Handoff'), src.indexOf('## Return'));
      expect(handoff, f).toContain('{{HANDOFF_WRITE_GATE}}');
      expect(handoff, f).toContain('{{HANDOFF_SCHEMA_JSON}}');
      expect(handoff, f).toMatch(/Write\/update `\{\{HANDOFF_TARGET\}\}` per the schema above/);
      expect(handoff.indexOf('{{HANDOFF_WRITE_GATE}}'), f).toBeLessThan(handoff.indexOf('{{HANDOFF_SCHEMA_JSON}}'));
      const ret = src.slice(src.indexOf('## Return'));
      if (f === 'docs/fix.md') {
        expect(ret, f).not.toContain('{{RETURN_STDOUT_BLOCK}}');  // docs 族 return = JSON 说明
      } else {
        expect(ret, f).toContain('{{RETURN_STDOUT_BLOCK}}');      // task 族 return = 共享 H1 壳
      }
    }
  });
});

// ---- P5 Task 18（E-8）：handoff stub 紧凑注入 —— JSON.stringify(schema)（省 tok）----
// 注入面 = 提示词 prompt（非磁盘工件）：handoff JSON 落盘仍走 2-缩进（write.ts/progress 等）。
// 紧凑性来源 = JSON.stringify 无缩进 → 单行 body，无内嵌换行；2-缩进形态的 `\n  "` 模式即 drift。

describe('renderHandoffSchemaJson 紧凑注入（P5 E-8 省 tok + Task 5 rename: stub→schema-json）', () => {
  it('stub 无 2-缩进模式（`\\n  "` 模式）——格式 drift 守卫（spec §2.8）', () => {
    const stub = renderHandoffSchemaJson(loadHandoffSchema('task'));
    expect(stub).not.toMatch(/\n {2}"/);
  });

  it('紧凑 JSON 单行承载 + 契约保持：JSON.parse(stub) === schema（注入面压缩但不损内容）', () => {
    const schema = loadHandoffSchema('task');
    const body = renderHandoffSchemaJson(schema).replace(/^```json\n/, '').replace(/\n```$/, '');
    expect(body).not.toContain('\n');        // JSON.stringify 无缩进 → body 恰一行
    expect(JSON.parse(body)).toEqual(schema); // 既有 round-trip 断言在紧凑形态下保持
  });

  it('省 tok（R6）：紧凑 stub 短于同一 schema 的 2-缩进形态', () => {
    const schema = loadHandoffSchema('task');
    const pretty = '```json\n' + JSON.stringify(schema, null, 2) + '\n```';
    expect(renderHandoffSchemaJson(schema).length).toBeLessThan(pretty.length);
  });
});
