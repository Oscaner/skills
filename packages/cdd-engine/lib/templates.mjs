// packages/cdd-engine/lib/templates.mjs
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadHandoffSchema } from './handoff/schema.mjs';
import { familyConfig } from './handoff/naming.mjs';

// PKG_ROOT = <pkg>/templates（re-org Step 5）：以 import.meta.url 相对 ../templates/ 重写，
// 消除 path.resolve(__dirname, …) 计数链；语义收敛为该模板资源目录本身（消费方不再拼 'templates' 段）。
export const PKG_ROOT = fileURLToPath(new URL('../templates', import.meta.url));

// template → 分组映射（URC: review 模板数据化 — 六旧 review/fix 模板删除，
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
  return path.join(PKG_ROOT, group, `${name}.md`);
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
// re-org Step 5：PKG_ROOT 语义 = 模板资源目录 → pluginRoot() 亦返回该目录
// （run-task step 2.5 存在性检查直接以 pluginRootFn() 为目标，不再拼接 'templates' 段）。
export function pluginRoot() { return PKG_ROOT; }

// schema 属性 → 注释标注（键名不在标注里重复：行首键名即契约键）。
function stubAnnotation(prop) {
  const bits = [];
  if (Array.isArray(prop.enum)) bits.push(`enum: ${prop.enum.join(' | ')}`);
  else if (prop.const !== undefined) bits.push(`= ${JSON.stringify(prop.const)}`);
  else if (prop.type) bits.push(prop.type);
  if (prop.pattern) bits.push(`pattern: ${prop.pattern}`);
  if (prop.minimum !== undefined) bits.push(`min: ${prop.minimum}`);
  return bits.join(', ');
}

// 标量骨架值：按语义角色填（task/phase/status/doc_path 有调用方真值），其余按 schema `type` 取空值。
function stubScalar(key, prop, { mode, taskNum, docPath }) {
  if (key === 'task') return String(typeof taskNum === 'number' && Number.isFinite(taskNum) ? taskNum : 0);
  if (key === 'phase') return JSON.stringify(mode);
  if (key === 'status') return '"APPROVED"';
  if (key === 'doc_path') return JSON.stringify(docPath ?? '');
  if (Array.isArray(prop.enum) && prop.enum.length > 0) return JSON.stringify(prop.enum[0]);
  if (prop.const !== undefined) return JSON.stringify(prop.const);
  if (prop.type === 'array') return '[]';
  if (prop.type === 'object') return '{}';
  if (prop.type === 'integer' || prop.type === 'number') return '0';
  if (prop.type === 'boolean') return 'true';
  return '""';
}

// `schema.properties` 全形递归 → JSONC 骨架行（键不带引号：注释行只作形状说明，不得被字面复制）。
function stubSkeletonLines(properties, ctx, indent) {
  const keys = Object.keys(properties);
  const lines = [];
  keys.forEach((key, i) => {
    const prop = properties[key] ?? {};
    const tail = i < keys.length - 1 ? ',' : '';
    const nested = prop.type === 'object' && prop.properties;
    const note = nested ? '' : stubAnnotation(prop);
    const suffix = note ? `  // ${note}` : '';
    if (nested) {
      lines.push(`${indent}${key}: {`);
      lines.push(stubSkeletonLines(prop.properties, ctx, `${indent}  `));
      lines.push(`${indent}}${tail}`);
    } else {
      lines.push(`${indent}${key}: ${stubScalar(key, prop, ctx)}${tail}${suffix}`);
    }
  });
  return lines.join('\n');
}

// `allOf` 每条条件分支 → 固定措辞注释行。求值自 if.properties / then.required / else.required，
// 不逐字抄 schema；`if.properties.<k>` 两形并存（磁盘实测：cdd 用 enum、docs 用 const）——
// 只认 enum 会让 docs 形（spec/plan 评审注入的那一份）得到 undefined。
export function renderAllOfConditions(allOf = []) {
  const lines = [];
  for (const branch of allOf) {
    const conds = branch?.if?.properties ?? {};
    const parts = Object.keys(conds).map((k) => {
      const c = conds[k] ?? {};
      if (Array.isArray(c.enum)) return `when ${k} ∈ [${c.enum.join(', ')}]`;
      if (c.const !== undefined) return `when ${k} = ${c.const}`;
      return null;
    }).filter(Boolean);
    if (parts.length === 0) continue;
    const thenReq = branch?.then?.required ?? [];
    const elseReq = branch?.else?.required ?? [];
    for (const key of elseReq) {
      if (thenReq.includes(key)) continue;   // 两分支同要求 → 无「可省」语义可述
      lines.push(`// ${parts.join(' and ')} → ${key} may be omitted; otherwise ${key} is required`);
    }
  }
  return lines;
}

// HANDOFF_STUB 单点：形状唯一来源 = schema（`properties` 全形派生，非仅 `required`）。
// 原有硬编码 switch（手写 schema 字段清单，T8 ⑦ 命中面）已删 —— 键集/类型/枚举/嵌套/allOf 全部求值自 schema。
// 载体是 ```jsonc（注释行落在 fence 之内）：带 // 的 json 块被字面复制即非法 JSON，正是 R6 / #250[1]
// 的 CONTRACT_VIOLATION 形态；三份模板随之补「不得复制注释」的载体指令。
export function renderHandoffStub(schema, mode, taskNum, { docPath } = {}) {
  const ctx = { mode, taskNum, docPath };
  const conditions = renderAllOfConditions(schema.allOf ?? []);
  const body = stubSkeletonLines(schema.properties ?? {}, ctx, '  ');
  const head = [...conditions, '{'].join('\n');
  return '```jsonc\n' + head + '\n' + body + '\n}\n```';
}

// ---- Review 模板数据化（reviews.json per-type 配置 + review.md 共享壳） ----

export function loadReviews() {
  return JSON.parse(readFileSync(path.join(PKG_ROOT, 'review', 'reviews.json'), 'utf8'));
}

// reviews.json[type] → 纯内容契约 { lensEnum, ref, axesGuide }（T2 裁轴：returnMode/handoffType/
// fixTemplate 已迁 canonical，artifact 读取走 reviewArtifactConfig）。
// task/branch 的 ref 是 git-range 符号（TASK_BASE..HEAD / BASE..HEAD，调用方具体化注入）；
// spec/plan 的 ref 是关系描述（doc vs spec），实际 doc 路径由调用方落到 REFERENCE。
export function reviewTypeConfig(type) {
  const cfg = loadReviews()[type];
  if (!cfg) throw new Error(`unknown review type: ${type}`);
  return cfg;
}

// reviewArtifactConfig(type) → 读 canonical handoff-namespace.json 的 review.{type} 族，
// 返回 { schema, return }——HANDOFF_TYPE / RETURN_MODE 模板参数的唯一来源：
// handoffType 字段名退位 → canonical 的 schema（"cdd"/"docs"），returnMode → canonical 的
// return（"h1"/"json"）。fixTemplate 不被此层返回（runFix 直读 fix 族，无第二读取点）。
export function reviewArtifactConfig(type) {
  const cfg = familyConfig('review', type);
  return { schema: cfg.schema, return: cfg.return };
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

// review.md HARD GATE（T6）：returnMode 分写 — h1 → "BEFORE outputting H1"；json → "BEFORE outputting
// the JSON return"。注入实际 handoff 路径（与 fix.md 渲染结果一致；值内不含 {{HANDOFF}} 占位，避免
// 渲染期占位嵌套依赖 param 遍历顺序）。returnMode 非法 → 按 h1 缺省（未知族不崩渲染）。
export function reviewHardGate(returnMode, handoffPath) {
  const before = returnMode === "json" ? "BEFORE outputting the JSON return." : "BEFORE outputting H1.";
  const target = handoffPath ?? "{{HANDOFF}}";
  return `> ⚠️ HARD GATE — Write \`${target}\` ${before}\n> Returning without a written handoff file = BLOCKED (runner exit 1).`;
}

// params = promptParams（buildPromptParams 产出）：模板插值键 + PLAN_LINE。
// PLAN_LINE 由调用方从**显式 plan 路径**派生后经 params 传入 —— 本层零 env 读取，
// 且不引入以 plan 路径为值的 env 键名（该键名是「派生值不得借道 env」守卫的命中面）。
export function renderModePrompt(mode, params = {}) {
  // review mode 走 review.md 共享壳（reviews.json type=task 配置）；旧拼装模板已删除。
  // REFERENCE 具体化为 FIXED_POINT..HEAD。fix/implement 保持旧 task/ 模板。
  if (mode === 'review') {
    const cfg = reviewTypeConfig('task');
    const art = reviewArtifactConfig('task');
    let prompt = renderTemplate('review', {
      TYPE: 'task',
      WORKSPACE: params.WORKSPACE ?? '',
      LENS_GUIDE: cfg.lensEnum.join(' · '),
      REFERENCE: params.FIXED_POINT ? `${params.FIXED_POINT}..HEAD` : cfg.ref,
      AXES: cfg.axesGuide,
      HANDOFF: params.HANDOFF ?? '',
      HANDOFF_TYPE: art.schema,
      RETURN_MODE: art.return,
      H1_BLOCK: REVIEW_H1_BLOCK,
      PLAN_LINE: params.PLAN_LINE ?? '',
      HARD_GATE: reviewHardGate(art.return, params.HANDOFF),
    });
    // HANDOFF_STUB：共享壳槽位在 review 早退路径须显式替换（与 generic 路径一致）。
    const schema = loadHandoffSchema();
    const stub = renderHandoffStub(schema, 'review', parseInt(params.TASK) || 0);
    return prompt.replace(/\{\{HANDOFF_STUB\}\}/g, stub);
  }
  const modePath = templatePath(mode);
  if (!existsSync(modePath)) throw new Error(`missing template: ${modePath}`);
  let content = readFileSync(modePath, 'utf8');
  for (const key of PLACEHOLDERS) {
    content = content.split(`{{${key}}}`).join(params[key] ?? '');
  }
  const schema = loadHandoffSchema();
  const taskNumInt = parseInt(params.TASK) || 0;
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
