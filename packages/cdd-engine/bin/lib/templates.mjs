// packages/cdd-engine/bin/lib/templates.mjs
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadHandoffSchema } from './schema-utils.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// From bin/lib/ → packages/cdd-engine/ (2 levels up).
// Replaces pluginRoot() walk — cdd-engine is self-contained.
export const PKG_ROOT = path.resolve(__dirname, '..', '..');

// template → 分组映射（Task 4: review 模板数据化 — 六旧 review/fix 模板删除，
// 共享壳 review.md + doc-fix.md 由 reviews.json 配置驱动）。
// task/             cdd 按 mode 渲染（implement/fix 子命令消费）
// review/           review 共享壳 + docs fix 壳（cdd review --type task|branch|spec|plan / cdd fix --type spec|plan）
// schema/           handoff JSON schemas
const MODE_GROUPS = {
  implement: 'task',
  fix: 'task',
  review: 'review',
  'doc-fix': 'review',
};

// template 名 → 绝对路径（group-aware）。未知模板名 → throw。
export function templatePath(name) {
  const group = MODE_GROUPS[name];
  if (!group) throw new Error(`unknown template: ${name}`);
  return path.join(PKG_ROOT, 'templates', group, `${name}.md`);
}

export const LINE_BUDGETS = Object.freeze({
  sdd: 210, ctrl: 50, tier1: 260, tier2: 331,
});

const PLACEHOLDERS = ['WORKSPACE', 'BRIEF', 'HANDOFF', 'FINDINGS', 'CONSTRAINTS',
                      'FIXED_POINT', 'TASK'];

export function lineBudget(tier) {
  if (!(tier in LINE_BUDGETS)) throw new Error(`unknown line budget tier: ${tier}`);
  return LINE_BUDGETS[tier];
}

// pluginRoot() removed — callers use PKG_ROOT constant instead.
// Backward-compat: export an alias for callers that passed pluginRoot as DI.
export function pluginRoot() { return PKG_ROOT; }

export function renderHandoffStub(schema, mode, taskNum, { docPath } = {}) {
  const stub = {};
  for (const field of schema.required ?? []) {
    switch (field) {
      case 'task':     stub.task = typeof taskNum === 'number' ? taskNum : 0; break;
      case 'phase':    stub.phase = mode; break;
      case 'status':   stub.status = 'APPROVED'; break;
      case 'findings': stub.findings = []; break;
      case 'artifacts':stub.artifacts = {}; break;
      case 'doc_path': stub.doc_path = docPath ?? ''; break;
    }
  }
  return '```json\n' + JSON.stringify(stub, null, 2) + '\n```';
}

// ---- Task 4: review 模板数据化（reviews.json per-type 配置 + review.md 共享壳） ----

export function loadReviews() {
  return JSON.parse(readFileSync(path.join(PKG_ROOT, 'templates', 'review', 'reviews.json'), 'utf8'));
}

// reviews.json[type] → { lensEnum, ref, axesGuide, returnMode, handoffType, fixTemplate }。
// task/branch 的 ref 是 git-range 符号（TASK_BASE..HEAD / BASE..HEAD，调用方具体化注入）；
// spec/plan 的 ref 是关系描述（doc vs spec），实际 doc 路径由调用方落到 REFERENCE。
export function reviewTypeConfig(type) {
  const cfg = loadReviews()[type];
  if (!cfg) throw new Error(`unknown review type: ${type}`);
  return cfg;
}

// returnMode=h1 类型（task/branch）注入 {{H1_BLOCK}} 的四行 H1 合同；spec/plan 不渲染（空串）。
// 前置空行：模板的 {{H1_BLOCK}} 紧跟 Handoff 段末行，补一行才与 ## Return 标题分隔。
export const REVIEW_H1_BLOCK = `\n## Return (H1 — stdout only)

Return **exactly 4 lines** to stdout; make this block the **final** output — nothing may follow it (stream-json harnesses parse the last block):

\`\`\`
status: <APPROVED|BLOCKED>
commits: base=<sha> head=<sha>
artifacts: brief=<path> report=<path> test_evidence=<path>
blocker: <none|one-line>
\`\`\``;

export function renderModePrompt(mode, env = {}) {
  // task-review 改经 reviews.json type=task 路由（不再读旧 task-review.md）；
  // REFERENCE 具体化为 FIXED_POINT..HEAD。fix/implement 保持旧 task/ 模板。
  if (mode === 'task-review') {
    const cfg = reviewTypeConfig('task');
    let prompt = renderTemplate('review', {
      TYPE: 'task',
      WORKSPACE: env.WORKSPACE ?? '',
      LENS_GUIDE: cfg.lensEnum.join(' · '),
      REFERENCE: env.FIXED_POINT ? `${env.FIXED_POINT}..HEAD` : cfg.ref,
      AXES: cfg.axesGuide,
      HANDOFF: env.HANDOFF ?? '',
      HANDOFF_TYPE: cfg.handoffType,
      RETURN_MODE: cfg.returnMode,
      H1_BLOCK: REVIEW_H1_BLOCK,
      PLAN_LINE: env.PLAN_FILE ? `**Plan:** ${env.PLAN_FILE}` : '',
    });
    // HANDOFF_STUB：共享壳槽位在 task-review 早退路径须显式替换（与 generic 路径 line 118 一致）。
    const schema = loadHandoffSchema();
    const stub = renderHandoffStub(schema, 'task-review', parseInt(env.TASK) || 0);
    return prompt.replace(/\{\{HANDOFF_STUB\}\}/g, stub);
  }
  const modePath = templatePath(mode);
  if (!existsSync(modePath)) throw new Error(`missing template: ${modePath}`);
  let content = readFileSync(modePath, 'utf8');
  for (const key of PLACEHOLDERS) {
    content = content.split(`{{${key}}}`).join(env[key] ?? '');
  }
  const schema = loadHandoffSchema();
  const taskNumInt = parseInt(env.TASK) || 0;
  const stub = renderHandoffStub(schema, mode, taskNumInt);
  content = content.replace(/\{\{HANDOFF_STUB\}\}/g, stub);
  return content;
}

export function renderTemplate(name, params, programName) {
  const templatePath_ = templatePath(name);
  if (!existsSync(templatePath_)) {
    throw new Error(`${programName}: template not found: ${templatePath_}`);
  }
  let content = readFileSync(templatePath_, 'utf8');
  for (const [key, value] of Object.entries(params)) {
    content = content.split(`{{${key}}}`).join(value);
  }
  const missing = [...content.matchAll(/\{\{(\w+)\}\}/g)].find(m => m[1] !== 'HANDOFF_STUB');
  if (missing) {
    throw new Error(`${programName}: template ${name}: missing param ${missing[0]}`);
  }
  return content;
}
