// packages/cdd-engine/src/render/__tests__/templates.test.ts — Task 20 (模板系统化终态): the
// four template .md files are gone; rendering is contract-driven (template-contract.json#sections
// zone plane + token registry with zone 归属). Structural assertions move from per-file sweeps to
// the single shipped contract + the zone validator (validateTemplateStructure).
import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadHandoffSchema } from '../../rules/schema.ts';
import { renderHandoffSchemaJson } from '../templates.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENGINE = path.join(__dirname, '..', '..', '..');
const TEMPLATES = path.join(ENGINE, 'templates');

// Second-level heading position via line-anchored match — the shell prose names `## Return` /
// `## Round context` inline (backtick quotes in Instructions), so a plain indexOf would anchor on
// the prose mention, not the real section heading.
const heading = (prompt: string, name: string): number => prompt.search(new RegExp(`^## ${name}$`, 'm'));

describe('PKG_ROOT', () => {
  it('resolves to the templates resource dir under packages/cdd-engine', async () => {
    const { PKG_ROOT } = await import('../templates.ts');
    // re-org Step 5：PKG_ROOT 语义收敛为模板资源目录本身（fileURLToPath(new URL("../templates", …))）。
    expect(PKG_ROOT).toMatch(/packages\/cdd-engine\/templates$/);
  });
});

// ---- Task 20 ④：zone-tagged token registry 单点消费（渲染数据平面单文件） ----

// Synthetic zone-plan fixture: minimal contract exercising every validator branch (sample-ok
// baseline unless overridden). Round zone renders MODE / ALPHA / HANDOFF_WRITE_GATE; return zone
// carries the RETURN_* literal labels; shell is slot-free prose.
// T12 (D1.2/E2⑤) — the eight discipline clauses (v1.29–v1.31 + the changed-surface ledger clause) land in #clauses single-source.
// The brief's `cl:` prefix is the clause-family namespace (clauses register as `{{> cl:xxx}}`
// partials); this list is the D1.2 fall-order and the single point the T12 tests assert against.
const CLAUSE_KEYS = [
  'cl:english-comments',
  'cl:eof-newline',
  'cl:no-full-tree-find',
  'cl:bash-stall-limit',
  'cl:plan-freeze',
  'cl:atomic-commit',
  'cl:self-validate',
  'cl:changed-surface',
];

function zoneFixture(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    "$version": 2,
    skeleton: {
      sections: ['Instructions', 'Handoff', 'Return', 'Round context'],
      segments: { shell: ['Instructions', 'Handoff'], return: ['Return'], 'round-context': ['Round context'] },
      order: ['shell', 'return', 'round-context'],
    },
    sections: {
      shell: ['# CDD dispatch — CLI session', '## Instructions', 'scope lock prose', '## Handoff', 'handoff prose'],
      return: { RETURN_STDOUT_BLOCK: ['## Return', 'this return literal labels RETURN_STDOUT_BLOCK'] },
      'round-context': ['## Round context', '- `MODE`: {{MODE}}', '- `ALPHA`: {{ALPHA}}', '### HANDOFF_WRITE_GATE', '{{{HANDOFF_WRITE_GATE}}}'],
    },
    tokens: [
      { name: 'MODE', zone: 'round-context' },
      { name: 'ALPHA', zone: 'round-context' },
      { name: 'HANDOFF_WRITE_GATE', zone: 'round-context' },
      { name: 'RETURN_STDOUT_BLOCK', zone: 'return' },
      { name: 'RETURN_FORMAT', zone: 'return' },
    ],
    clauses: {},
    reviews: {},
    ...overrides,
  };
}

describe('template-contract 单点消费 + zone-tagged token registry（Task 20 ③④）', () => {
  it('loadTemplateContract 加载真身：skeleton 槽级三段制 + tokens(19 带 zone) + clauses + reviews', async () => {
    const { loadTemplateContract } = await import('../templates.ts');
    const contract = loadTemplateContract();
    expect(contract.skeleton.sections).toEqual(['Instructions', 'Handoff', 'Return', 'Round context']);
    expect(contract.skeleton.segments.shell).toEqual(['Instructions', 'Handoff']);   // 段级 → 槽级
    expect(contract.skeleton.segments.return).toEqual(['Return']);
    expect(contract.skeleton.segments['round-context']).toEqual(['Round context']);
    expect(contract.skeleton.order).toEqual(['shell', 'return', 'round-context']);   // 段序恒为 壳 → Return → Round context
    expect(contract.tokens).toHaveLength(19);
    // zone 归属：17 round-context + 2 return，壳零槽（不得有 shell 归属 token）
    expect(contract.tokens.filter((t) => t.zone === 'round-context')).toHaveLength(17);
    expect(contract.tokens.filter((t) => t.zone === 'return')).toHaveLength(2);
    expect(contract.tokens.some((t) => t.zone === 'shell')).toBe(false);
    // T12 (D1.2)：7 条纪律条款单源落库（v1.29–v1.31；`cl:` 前缀族；正文非空、零 moustache）
    expect(Object.keys(contract.clauses)).toEqual(CLAUSE_KEYS);
    for (const [key, body] of Object.entries(contract.clauses)) {
      expect(String(body).trim(), key).toBeTruthy();
      expect(String(body), key).not.toContain('{{'); // 条文零 moustache（strict 编译安全 + 装配原子）
    }
    expect(Object.keys(contract.reviews)).toEqual(['task', 'branch', 'spec', 'plan']);
    // 与磁盘真身一致（单点）
    const onDisk = JSON.parse(readFileSync(path.join(TEMPLATES, 'template-contract.json'), 'utf8'));
    expect(contract).toEqual(onDisk);
  });

  it('19 令牌全收敛（新命名规范；零遗留旧态名）—— 三段落实际使用的令牌 ⊆ registry', async () => {
    const { scanTemplateTokens, validateTemplateTokens, tokenNames, tokensInZone, loadTemplateContract } = await import('../templates.ts');
    const contract = loadTemplateContract();
    const zones = {
      shell: [contract.sections.shell, []],
      return: [Object.values(contract.sections.return), ['return']],
      'round-context': [contract.sections['round-context'], ['round-context']],
    };
    for (const [zone, [lines, allowedZone]] of Object.entries(zones)) {
      const src = (lines as string[][]).flat().join('\n');
      const used = scanTemplateTokens(src);
      for (const tok of used) {
        expect(tokenNames(contract), `${zone}: {{${tok}}}`).toContain(tok); // 非 registry 令牌 → 炸
      }
      expect(() => validateTemplateTokens(src, contract as never)).not.toThrow();
      // 槽仅现所属区：zone 实际使用的令牌 ∈ 该 zone 的 registry 归属
      for (const tok of used) {
        expect(tokensInZone((allowedZone as string[])[0] ?? '', contract as never), `${zone}: {{${tok}}}`).toContain(tok);
      }
    }
    // 壳零注入：shell 区零 token 槽（Task 20 ④ 壳禁槽 —— 单文件数据面自证）。T12 起
    // `{{> cl:…}}` 为条款装配标记（非 per-dispatch 槽）——壳禁槽改禁 token 槽形，不碰 partial refs。
    expect(contract.sections.shell.join('\n')).not.toMatch(/\{\{(?!>\s*)/);
    // 旧态名零遗留：三段落全文禁现旧词（H1_BLOCK / HANDOFF_STUB / HANDOFF_TYPE / TYPE /
    // LENS_GUIDE / AXES / HARD_GATE / RETURN_MODE / WORKSPACE / REFERENCE / PLAN_LINE /
    // FINDINGS / BRIEF / TASK / CONSTRAINTS / FIXED_POINT / DOC）
    const LEGACY = ['{{H1_BLOCK}}', '{{HANDOFF_STUB}}', '{{HANDOFF_TYPE}}', '{{HANDOFF}}', '{{TYPE}}',
      '{{LENS_GUIDE}}', '{{AXES}}', '{{HARD_GATE}}', '{{RETURN_MODE}}', '{{WORKSPACE}}', '{{REFERENCE}}',
      '{{PLAN_LINE}}', '{{FINDINGS}}', '{{BRIEF}}', '{{TASK}}', '{{CONSTRAINTS}}', '{{FIXED_POINT}}', '{{DOC}}'];
    const full = [
      ...contract.sections.shell,
      ...Object.values(contract.sections.return).flat(),
      ...contract.sections['round-context'],
    ].join('\n');
    for (const legacy of LEGACY) {
      expect(full, `contract 残留 ${legacy}`).not.toContain(legacy);
    }
  });

  it('validateTemplateTokens: 非 registry 令牌（含旧态名）→ throw', async () => {
    const { validateTemplateTokens, loadTemplateContract } = await import('../templates.ts');
    const contract = loadTemplateContract() as never;
    expect(() => validateTemplateTokens('# t\n{{H1_BLOCK}}', contract)).toThrow(/not in registry: H1_BLOCK/);
    expect(() => validateTemplateTokens('# t\n{{HANDOFF_STUB}}', contract)).toThrow(/not in registry/);
    expect(() => validateTemplateTokens('# t\n{{BOGUS_NEW}}', contract)).toThrow(/not in registry: BOGUS_NEW/);
  });

  it('validateTemplateStructure: 合法 zone 平面通过（壳零槽 + 槽仅现所属区 + 常数字节锁）', async () => {
    const { validateTemplateStructure } = await import('../templates.ts');
    expect(() => validateTemplateStructure(zoneFixture() as never)).not.toThrow();
  });

  it('validateTemplateStructure: 壳禁槽 —— token 不得归属 shell；壳内 moustache → throw', async () => {
    const { validateTemplateStructure } = await import('../templates.ts');
    const shellTok = zoneFixture({
      tokens: [
        { name: 'MODE', zone: 'shell' }, { name: 'ALPHA', zone: 'round-context' },
        { name: 'HANDOFF_WRITE_GATE', zone: 'round-context' },
        { name: 'RETURN_STDOUT_BLOCK', zone: 'return' }, { name: 'RETURN_FORMAT', zone: 'return' },
      ],
    });
    expect(() => validateTemplateStructure(shellTok as never)).toThrow(/shell is slot-free/);
    const shellSlot = zoneFixture({
      sections: { ...zoneFixture().sections, shell: ['# CDD dispatch', '## Instructions', 'mode is {{MODE}}'] },
    });
    expect(() => validateTemplateStructure(shellSlot as never)).toThrow(/slot-free/);
  });

  it('validateTemplateStructure: 槽仅现所属区 —— return token 不得 moustache；round token 不得缺席', async () => {
    const { validateTemplateStructure } = await import('../templates.ts');
    // return 常量内 moustache → throw（return 常数为字面常数，token 只以字面标签面世）
    const retStash = zoneFixture({
      sections: {
        ...zoneFixture().sections,
        return: { RETURN_STDOUT_BLOCK: ['## Return', 'label {{RETURN_FORMAT}}'] },
      },
    });
    expect(() => validateTemplateStructure(retStash as never)).toThrow(/must be a literal constant/);
    // round 区缺一个 round token → throw（唯一动态区须渲染全部 round tokens）
    const missingMode = zoneFixture({
      tokens: [
        { name: 'ALPHA', zone: 'round-context' },
        { name: 'HANDOFF_WRITE_GATE', zone: 'round-context' },
        { name: 'RETURN_STDOUT_BLOCK', zone: 'return' }, { name: 'RETURN_FORMAT', zone: 'return' },
      ],
    });
    expect(() => validateTemplateStructure(missingMode as never)).toThrow(/must be a round-context token/);
  });

  it('validateTemplateStructure: Return 常数字节锁 —— 必以 `## Return` 开头 + 零 moustache；段序锁定', async () => {
    const { validateTemplateStructure } = await import('../templates.ts');
    const noHeading = zoneFixture({
      sections: { ...zoneFixture().sections, return: { RETURN_STDOUT_BLOCK: ['Return literal (no heading)'] } },
    });
    expect(() => validateTemplateStructure(noHeading as never)).toThrow(/must open with #+ Return/);
    const wrongOrder = zoneFixture({ skeleton: { ...zoneFixture().skeleton, order: ['round-context', 'return', 'shell'] } });
    expect(() => validateTemplateStructure(wrongOrder as never)).toThrow(/skeleton\.order/);
  });

  it('Task 20 与 T12 衔接：{{> clause}} 引用须 resolve 到 #clauses（未注册 → throw；注册 → 通过 + 装配器注册 partial）', async () => {
    const { validateTemplateStructure, clauseNames, assembleClauses } = await import('../templates.ts');
    const hb = (await import('handlebars')).default;
    expect(clauseNames()).toEqual(CLAUSE_KEYS); // T12 落库后：8 条纪律条款（顺序 = D1.2/E2⑤ 命名序 + changes[] 记账）
    const ref = zoneFixture({
      sections: { ...zoneFixture().sections, 'round-context': ['## Round context', '- `MODE`: {{MODE}}', '- `ALPHA`: {{ALPHA}}', '### HANDOFF_WRITE_GATE', '{{HANDOFF_WRITE_GATE}}', '{{> discipline}}'] },
    });
    expect(() => validateTemplateStructure(ref as never)).toThrow(/unknown clause/);
    const okRef = zoneFixture({
      clauses: { discipline: 'FIND-ALL-FINDINGS' },
      sections: { ...zoneFixture().sections, 'round-context': ['## Round context', '- `MODE`: {{MODE}}', '- `ALPHA`: {{ALPHA}}', '### HANDOFF_WRITE_GATE', '{{HANDOFF_WRITE_GATE}}', '{{> discipline}}'] },
    });
    expect(() => validateTemplateStructure(okRef as never)).not.toThrow();
    assembleClauses(okRef as never);
    expect(hb.compile('{{> discipline}}')()).toBe('FIND-ALL-FINDINGS'); // 装配面：partial 已注册
  });

  it('validateShippedTemplates: 单文件数据面校验通过 → 返回 zone 键清单（原 TEMPLATE_FILES 逐文件扫退位）', async () => {
    const { validateShippedTemplates } = await import('../templates.ts');
    expect(validateShippedTemplates()).toEqual(['shell', 'return', 'round-context']);
  });
});

describe('D1.2/E2⑤ 纪律条款入库（Task 12）：clauses 单源 + 4 模板引用覆盖 + 行为变更单点', () => {
  it('validateTemplateStructure: shell 容许 `{{> clause}}` 装配标记；token 槽仍禁（壳禁槽 = 禁 per-dispatch 槽）', async () => {
    const { validateTemplateStructure } = await import('../templates.ts');
    const shellClauseRef = zoneFixture({
      clauses: { 'cl:test': 'TEXT' },
      sections: {
        ...zoneFixture().sections,
        shell: ['# CDD', '## Instructions', '9. **Discipline:**', '- {{> cl:test}}', '## Handoff', 'handoff'],
      },
    });
    expect(() => validateTemplateStructure(shellClauseRef as never)).not.toThrow();
    const shellTokenSlot = zoneFixture({
      sections: { ...zoneFixture().sections, shell: ['# CDD', '## Instructions', 'mode is {{MODE}}', '## Handoff', 'handoff'] },
    });
    expect(() => validateTemplateStructure(shellTokenSlot as never)).toThrow(/slot-free/);
  });

  it('4 模板正文零内联纪律散文：条款正文仅存于 #clauses（D1.2 单源）；shell 区全 7 条 {{> cl:…}} 引用覆盖（E2⑤）', async () => {
    const { loadTemplateContract } = await import('../templates.ts');
    const contract = loadTemplateContract();
    const zones = [
      ...contract.sections.shell,
      ...contract.sections['round-context'],
      ...Object.values(contract.sections.return).flat(),
    ].join('\n');
    for (const [key, body] of Object.entries(contract.clauses)) {
      expect(String(body).trim(), key).toBeTruthy();
      expect(zones, `${key}: 正文零内联（条款单源）`).not.toContain(String(body));
      expect(contract.sections.shell.join('\n'), `${key}: 引用覆盖`).toContain(`{{> ${key}}}`);
    }
  });

  it('行为变更一处生效（单点断言）：四个模板渲染均含纪律块 + 全 7 条条款正文；输出零 `{{` 残留（装配面生效）', async () => {
    const { renderModePrompt, renderTemplate, reviewHardGate, docsFixHardGate, resetTemplateCaches, loadTemplateContract } = await import('../templates.ts');
    resetTemplateCaches();
    const contract = loadTemplateContract();
    const shapes: Record<string, string> = {
      implement: renderModePrompt('implement', {
        TASK_WORKSPACE: '/ws', WORKSPACE_SLUG: 'ws', TASK_BRIEF: '/ws/task-1-brief.md',
        TASK_CONSTRAINTS: '/ws/plan-constraints.md', TASK_NUMBER: '1', HANDOFF_TARGET: '/ws/task-1-implement.json',
      }),
      fix: renderModePrompt('fix', {
        TASK_WORKSPACE: '/ws', WORKSPACE_SLUG: 'ws', TASK_BRIEF: '/ws/task-1-brief.md',
        TASK_CONSTRAINTS: '/ws/plan-constraints.md', TASK_FINDINGS: '/ws/task-1-review-1.json',
        TASK_FIXED_POINT: '7a7327b', TASK_NUMBER: '1', HANDOFF_TARGET: '/ws/task-1-fix-1.json',
      }),
      taskReview: renderModePrompt('review', {
        TASK_WORKSPACE: '/ws', WORKSPACE_SLUG: 'ws', HANDOFF_TARGET: '/ws/task-1-review-1.json', TASK_FIXED_POINT: '7a7327b',
      }),
      docsReview: renderTemplate('review', {
        MODE: 'review', REVIEW_TYPE: 'spec', TASK_WORKSPACE: '/ws', WORKSPACE_SLUG: 'ws',
        REVIEW_LENS_GUIDE: 'completeness · consistency · clarity', REVIEW_REFERENCE: '/ws/spec.md',
        REVIEW_AXES: 'x', REVIEW_PLAN_LINE: '', HANDOFF_TARGET: '/ws/spec-review-1.json',
        RETURN_FORMAT: 'RETURN_JSON', HANDOFF_WRITE_GATE: reviewHardGate('RETURN_JSON', '/ws/spec-review-1.json'),
      }),
      docsFix: renderTemplate('fix', {
        MODE: 'fix', TASK_WORKSPACE: '/ws', WORKSPACE_SLUG: 'ws', DOCS_DOC: '/ws/spec.md',
        DOCS_FINDINGS: '/ws/spec-review-1.json', HANDOFF_TARGET: '/ws/spec-fix-1.json',
        RETURN_FORMAT: 'DOCS_FIX', HANDOFF_WRITE_GATE: docsFixHardGate('/ws/spec-fix-1.json'),
      }),
    };
    for (const [mode, prompt] of Object.entries(shapes)) {
      expect(prompt, mode).toContain('Discipline clauses');
      for (const key of CLAUSE_KEYS) {
        expect(prompt, `${mode}: ${key} 条款正文落渲染`).toContain(String(contract.clauses[key]));
      }
      expect(prompt, mode).not.toContain('{{'); // 条款 refs 已 resolve —— 行为变更生效（零残留 moustache）
    }
  });
});

describe('review type config (Task 4: 模板数据化)', () => {
  it('loadReviews returns the four review types (from template-contract.json#reviews)', async () => {
    const { loadReviews } = await import('../templates.ts');
    expect(Object.keys(loadReviews())).toEqual(['task', 'branch', 'spec', 'plan']);
  });

  it('reviews 纯内容契约：无 artifact 字段（T2 裁轴；Task 5 单文件入 template-contract.json#reviews）', () => {
    // 直接读真身：returnFormat/handoffType/fixTemplate
    // 已迁 canonical（review.{type} 族 schema/return + fix 族 fixTemplate），reviews 只剩内容轴。
    const CONTRACT = JSON.parse(readFileSync(new URL('../../../templates/template-contract.json', import.meta.url), 'utf8'));
    for (const cfg of Object.values(CONTRACT.reviews)) {
      expect(cfg).not.toHaveProperty('returnMode');
      expect(cfg).not.toHaveProperty('handoffType');
      expect(cfg).not.toHaveProperty('fixTemplate');
    }
  });

  it('reviewTypeConfig: known type → content-only config; unknown → throw', async () => {
    const { reviewTypeConfig } = await import('../templates.ts');
    expect(reviewTypeConfig('task').lensEnum).toEqual(['standards', 'spec']);
    expect(reviewTypeConfig('task')).not.toHaveProperty('returnMode');
    expect(reviewTypeConfig('task')).not.toHaveProperty('fixTemplate');
    expect(() => reviewTypeConfig('nope')).toThrow('unknown review type: nope');
  });

  it('reviewArtifactConfig: canonical review.{type} 族 → { schema, returnFormat }（T2 裁轴；fixFamily 已删——runFix 直读 fix 族）', async () => {
    const { reviewArtifactConfig } = await import('../templates.ts');
    expect(reviewArtifactConfig('task')).toEqual({ schema: 'task', returnFormat: 'RETURN_STDOUT_BLOCK' });
    expect(reviewArtifactConfig('branch')).toEqual({ schema: 'task', returnFormat: 'RETURN_STDOUT_BLOCK' });
    expect(reviewArtifactConfig('spec')).toEqual({ schema: 'docs', returnFormat: 'RETURN_JSON' });
    expect(reviewArtifactConfig('plan')).toEqual({ schema: 'docs', returnFormat: 'RETURN_JSON' });
    expect(() => reviewArtifactConfig('nope')).toThrow(/unknown handoff family/);
  });

  it('renderModePrompt(review) routes via the unified constant shell + template-contract reviews type=task (code-review focus)', async () => {
    const { renderModePrompt, resetTemplateCaches } = await import('../templates.ts');
    resetTemplateCaches();
    const out = renderModePrompt('review', {
      TASK_WORKSPACE: '/ws', HANDOFF_TARGET: '/ws/task-1-review-1.json', TASK_FIXED_POINT: '7a7327b',
    });
    expect(out).toContain('# CDD dispatch — CLI session');   // 统一壳字面头（跨模板字节恒等）
    expect(out).toContain('standards · spec');                // lensEnum joined
    expect(out).toContain('7a7327b..HEAD');                   // ref 具体化为 FIXED_POINT..HEAD
    expect(out).toContain('code-review smell baseline');      // axesGuide → code-review 焦点
    expect(out).toContain('/ws/task-1-review-1.json');
    expect(out).toContain('WORKSPACE_SLUG');                  // ⑦ canonical slug 槽（fallback = basename(TASK_WORKSPACE)）
    expect(out).toContain('- `WORKSPACE_SLUG`: ws');
    // 段序恒为 壳 → ## Return → ## Round context
    const handoffIdx = heading(out, 'Handoff');
    const retIdx = heading(out, 'Return');
    const roundIdx = heading(out, 'Round context');
    expect(handoffIdx).toBeGreaterThan(-1);
    expect(retIdx).toBeGreaterThan(handoffIdx);
    expect(roundIdx).toBeGreaterThan(retIdx);
    expect(out).not.toContain('{{');                          // r2-r3 泄漏回归：渲染输出零残留 moustache
  });
});

describe('renderTemplate（唯一渲染器：壳 → Return 常数 → Round context 组装）', () => {
  it('replaces all params (docs family RETURN_JSON, Task 5 tokens)', async () => {
    const { renderTemplate, reviewHardGate, resetTemplateCaches } = await import('../templates.ts');
    resetTemplateCaches();
    const out = renderTemplate('review', {
      MODE: 'review',
      REVIEW_TYPE: 'spec', TASK_WORKSPACE: '/ws', REVIEW_LENS_GUIDE: 'completeness · consistency · clarity',
      REVIEW_REFERENCE: '/tmp/spec.md', REVIEW_AXES: 'URC 规则指针', HANDOFF_TARGET: '/tmp/spec-review-1.json',
      RETURN_FORMAT: 'RETURN_JSON', REVIEW_PLAN_LINE: '',
      HANDOFF_WRITE_GATE: reviewHardGate('RETURN_JSON', '/tmp/spec-review-1.json'),
    }, 'test');
    expect(out).toContain('/tmp/spec.md');
    expect(out).toContain('completeness · consistency · clarity');
    expect(out).toContain('/tmp/spec-review-1.json');
    expect(out).toContain('HARD GATE');
    // Return 常数前移：## Return 在动态区之前；Round context 绝对末尾
    expect(heading(out, 'Return')).toBeLessThan(heading(out, 'Round context'));
    expect(out).not.toContain('{{');
  });

  it('missing round params pre-fill "" (mode-union template; no missing-param throw)', async () => {
    const { renderTemplate, resetTemplateCaches } = await import('../templates.ts');
    resetTemplateCaches();
    const out = renderTemplate('review', { MODE: 'review', REVIEW_TYPE: 'spec' }, 'test');
    expect(out).toContain('- `REVIEW_REFERENCE`:'); // empty prefill, slot still rendered
    expect(out).toContain('- `HANDOFF_TARGET`:');   // empty prefill
  });

  it('name no longer selects a template file (formerly templatePath) — 渲染与 name 无关', async () => {
    const { renderTemplate, resetTemplateCaches } = await import('../templates.ts');
    resetTemplateCaches();
    const params = {
      MODE: 'fix', DOCS_DOC: '/d/spec.md', DOCS_FINDINGS: '/d/review-1.json', HANDOFF_TARGET: '/d/docs-fix-1.json',
      RETURN_FORMAT: 'DOCS_FIX', HANDOFF_WRITE_GATE: '> gate',
    };
    expect(renderTemplate('spec-fix', params)).toBe(renderTemplate('fix', params)); // 旧名回归面等价
    expect(renderTemplate('review', params)).toBe(renderTemplate('docs', params));  // 共享壳
  });
});

// ---- Task 20 ①/③：数据平面的空注入壳 + schema 原样注入 + 零手写 render 符号 ----

describe('unified constant shell（Task 20：四个 .md 并入 sections 的阅读理解）', () => {
  it('壳内零注入槽：sections.shell 零 token 槽（T12 起 `{{> cl:…}}` 条款 partial refs 为装配标记）；`## Round context` 唯一动态区宣言', () => {
    const contract = JSON.parse(readFileSync(path.join(TEMPLATES, 'template-contract.json'), 'utf8'));
    const shell = contract.sections.shell.join('\n');
    expect(shell).not.toMatch(/\{\{(?!>\s*)/);   // 壳零 token 槽（结构校验器同样断言；此处为数据面直读）
    expect(shell).toContain('# CDD dispatch — CLI session'); // 字面头字节恒等载体
    expect(shell).toMatch(/`## Round context` — the final section — is the only dynamic region/);
    expect(shell).toMatch(/byte-identical for every round and mode/); // C1-max 段序宣言
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
    // Task 20 ④：templates.ts 无 `switch(` / `readdirSync`（residue 守卫镜像）；staticShellKey 已消除
    expect(src).not.toMatch(/\bstaticShellKey\b/);
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

describe('T25: 四 review type 的 scope-composition 轴（changed-surface reasonableness，数据驱动 + 共享壳条款）', () => {
  it('reviewTypeConfig 四 type 全部携带 scope-composition 轴（prompt 零散文——内容全在 contract）', async () => {
    const { reviewTypeConfig, loadTemplateContract } = await import('../templates.ts');
    for (const type of ['task', 'branch', 'spec', 'plan']) {
      expect(reviewTypeConfig(type).axesGuide, type).toContain('changed-surface reasonableness');
    }
    // 共享壳 Instructions 的 changes[] 记账条款落在 clauses 单点（T12 机制面）
    const contract = loadTemplateContract();
    expect(contract.clauses).toHaveProperty('cl:changed-surface');
  });

  it('渲染出的 review prompt 同时携带 scope 轴与 changed-surface 条款（grep/渲染双断言）', async () => {
    const { renderModePrompt, resetTemplateCaches } = await import('../templates.ts');
    resetTemplateCaches();
    const out = renderModePrompt('review', {
      TASK_WORKSPACE: '/ws', HANDOFF_TARGET: '/ws/task-1-review-1.json', TASK_FIXED_POINT: '7a7327b',
    });
    expect(out).toContain('changed-surface reasonableness');
    expect(out).toContain('Changed-surface bookkeeping');
  });
});