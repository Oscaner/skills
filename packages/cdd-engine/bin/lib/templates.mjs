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

// template → 分组映射（Step 2b: flat → task/review/schema 目录）。
// task/             cdd-task 按 mode 渲染（cdd-task.mjs 消费）
// review/           docs 审查模板（docs-task / branch-review 消费）
// schema/           handoff JSON schemas
const MODE_GROUPS = {
  implement: 'task',
  'task-review': 'task',
  fix: 'task',
  'spec-review': 'review',
  'plan-review': 'review',
  'branch-review': 'review',
  'spec-fix': 'review',
  'plan-fix': 'review',
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

export function renderModePrompt(mode, env = {}) {
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
