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

// 骨架值必须**自身满足 schema**：逐字复制骨架（去注释 + 补键名引号后的机械还原）得到的 handoff
// 仍须过校验。若占位值违规（如 `base: ""` 违反 `pattern`、`task: 0` 违反 `minimum: 1`），agent
// 只补自己的值、留下占位即 CONTRACT_VIOLATION（R6 / #250[1] 形态），而 pattern/minimum 违规
// 不可归一化剥除 → 白烧一轮 BLOCKED。
// 本函数只保证**骨架文本**的值合法，不是第二校验器（handoff 校验仍归 ajv / validateHandoffSchema）；
// 它同时收掉调用方注入值的垃圾面（`FIXED_POINT` 在测试/降级链上可能是 7 位短形或 "unknown"）。
function satisfiesProp(prop, value) {
  if (Array.isArray(prop.enum)) return prop.enum.includes(value);
  if (prop.const !== undefined) return value === prop.const;
  if (prop.pattern !== undefined) return typeof value === "string" && new RegExp(prop.pattern).test(value);
  if (prop.minimum !== undefined) return typeof value === "number" && value >= prop.minimum;
  if (prop.type === "array") return Array.isArray(value);
  if (prop.type === "object") return value !== null && typeof value === "object" && !Array.isArray(value);
  if (prop.type === "integer") return Number.isInteger(value);
  if (prop.type === "number") return typeof value === "number";
  if (prop.type === "boolean") return typeof value === "boolean";
  if (prop.type === "string") return typeof value === "string";
  return true;
}

// `pattern` 声明的键 → 满足该约束的骨架示例：只机械展开 shipped schema 实际使用的形态
// `^[<char-class>]{n}$`（cdd 的 `commits.base` = `^[0-9a-f]{40}$`）。无法展开 → null（该键从骨架省略）。
function patternSample(pattern) {
  const m = /^\^\[([^\]]+)\]\{(\d+)\}\$$/.exec(String(pattern ?? ''));
  if (!m) return null;
  const n = Number(m[2]);
  const ch = m[1].includes('0-9') ? '0' : m[1].includes('a-f') ? 'a' : null;
  return ch && n > 0 ? ch.repeat(n) : null;
}

// `allOf` 分支声明的**条件必需键**（cdd/docs 的 `status`）：它们在顶层 `required` 之外，但在某些
// phase 下必需。骨架必须保留这类键（否则 work 型 agent 照骨架写完即缺 `status`）。
// 求值自 `then`/`else.required`（不抄 schema）；`required` 并入顶层必需集。
function requiredKeys(schema) {
  const keys = new Set(schema.required ?? []);
  for (const branch of schema.allOf ?? []) {
    for (const k of [...(branch?.then?.required ?? []), ...(branch?.else?.required ?? [])]) keys.add(k);
  }
  return keys;
}

// 骨架标量值：调用方真值（`ctx.values[key]`，须自身满足 schema）> schema 派生示例 > 省略（null）。
// 原有键名特判（`key === 'task' | 'phase' | 'status' | 'doc_path'`，且把 status 硬编码成 "APPROVED"）
// 已删 —— 那是 engine 内的第二份 schema 字段清单（T8 ⑦ / AC6 命中面）；真值只由调用方经 `values`
// 注入，其余一律求值自 schema 的 `type` / `enum` / `const` / `pattern` / `minimum`。
// 可选枚举（`complexity` / `review_scope` 一类）无调用方真值 → 从骨架省略：枚举值按
// cdd-handoff-schema.json（docs 族 docs-handoff-schema.json）是 agent 据实声明的字段，engine 不得代为预填 `enum[0]`。
// `review_scope` 由派发类型决定，故由调用方注入；`complexity` 无机械来源（plan 无档位标注），
// 只能省略。骨架的可区分性由注释行的 `enum:` / `pattern:` / `min:` 标注承载，不靠示例值。
function stubScalar(prop, ctx, key, optional) {
  const injected = ctx.values[key];
  if (injected !== undefined && satisfiesProp(prop, injected)) return JSON.stringify(injected);
  if (Array.isArray(prop.enum)) {
    if (optional || prop.enum.length === 0) return null;
    return JSON.stringify(prop.enum[0]);
  }
  if (prop.const !== undefined) return JSON.stringify(prop.const);
  if (prop.pattern !== undefined) {
    const sample = patternSample(prop.pattern);
    return sample === null ? null : JSON.stringify(sample);
  }
  if (prop.type === 'array') return '[]';
  if (prop.type === 'object') return '{}';
  if (prop.type === 'integer' || prop.type === 'number') return String(prop.minimum ?? 0);
  if (prop.type === 'boolean') return 'true';
  return '""';
}

// `schema.properties` 全形递归 → JSONC 骨架行（键不带引号：注释行只作形状说明，不得被字面复制）。
// 给不出合法值的键从骨架省略；父对象若因此缺 required 子键 → 整棵省略（返回 null 上抛，由调用方
// 决定省略还是上抛）。嵌套面只认 `required`（`allOf` 只在顶层——shipped 两份 schema 均如此）。
// `items` 有意未处理：shipped 两份 schema 均无数组元素形状，无消费方不加码（扩展点待 P6）。
function stubSkeletonLines(properties, required, ctx, indent) {
  const entries = [];
  for (const key of Object.keys(properties)) {
    const prop = properties[key] ?? {};
    const optional = !required.has(key);
    if (prop.type === 'object' && prop.properties) {
      const inner = stubSkeletonLines(prop.properties, new Set(prop.required ?? []),
                                      { ...ctx, values: ctx.values[key] ?? {} }, `${indent}  `);
      if (inner === null) { if (optional) continue; return null; }
      entries.push({ text: `${indent}${key}: {\n${inner}\n${indent}}`, note: '' });
      continue;
    }
    const value = stubScalar(prop, ctx, key, optional);
    if (value === null) { if (optional) continue; return null; }
    entries.push({ text: `${indent}${key}: ${value}`, note: stubAnnotation(prop) });
  }
  // 逗号在注释**之前**（原布局）：`key: value,  // 标注`
  return entries
    .map((e, i) => `${e.text}${i < entries.length - 1 ? ',' : ''}${e.note ? `  // ${e.note}` : ''}`)
    .join('\n');
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

// TASK 模板参数 → 骨架用的任务号：缺省 / 非正整数 → undefined（渲染器按 schema 的 `minimum`
// 取缺省值）。原 `parseInt(params.TASK) || 0` 的 0 兜底与 schema `minimum: 1` 相悖——逐字复制即
// 校验失败，故不再兜底 0。
function taskNumParam(params = {}) {
  const n = Number.parseInt(params.TASK ?? '', 10);
  return Number.isInteger(n) && n >= 1 ? n : undefined;
}

// HANDOFF_STUB 单点：形状唯一来源 = schema（`properties` 全形派生，非仅 `required`）。
// 原有硬编码 switch（手写 schema 字段清单，T8 ⑦ 命中面）已删 —— 键集/类型/枚举/嵌套/allOf 全部求值自 schema。
// `values` = 调用方真值（engine 侧零键名特判）：task/phase/doc_path 由 mode/taskNum/docPath 桥入，
// 派发相关真值（如 branch 派发的 `phase: "branch-review"`、`review_scope`、`commits.base`）
// 由调用方在 `values` 里显式给出；未给 / 给得不合法 → 回退 schema 示例值（见 stubScalar）。
// 载体是 ```jsonc（注释行落在 fence 之内）：带 // 的 json 块被字面复制即非法 JSON，正是 R6 / #250[1]
// 的 CONTRACT_VIOLATION 形态；三份模板随之补「不得复制注释」的载体指令。
export function renderHandoffStub(schema, mode, taskNum, { docPath, values } = {}) {
  const ctx = { values: { task: taskNum, phase: mode, doc_path: docPath, ...values } };
  const conditions = renderAllOfConditions(schema.allOf ?? []);
  const body = stubSkeletonLines(schema.properties ?? {}, requiredKeys(schema), ctx, '  ');
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
    // 调用方真值：review 派发的 `review_scope` = "task"（branch 派发在 branch-review.mjs 传 "branch"）；
    // `commits.base` = 被评审区间的 base（FIXED_POINT）——短形/空值由渲染器筛掉并回退示例值。
    const schema = loadHandoffSchema();
    const stub = renderHandoffStub(schema, 'review', taskNumParam(params), {
      values: { review_scope: 'task', commits: { base: params.FIXED_POINT } },
    });
    return prompt.replace(/\{\{HANDOFF_STUB\}\}/g, stub);
  }
  const modePath = templatePath(mode);
  if (!existsSync(modePath)) throw new Error(`missing template: ${modePath}`);
  let content = readFileSync(modePath, 'utf8');
  for (const key of PLACEHOLDERS) {
    content = content.split(`{{${key}}}`).join(params[key] ?? '');
  }
  const schema = loadHandoffSchema();
  const stub = renderHandoffStub(schema, mode, taskNumParam(params), {
    // fix 派发：`commits.base` = FIXED_POINT（与 fix.md 的 commit 契约同一真值；implement 无 stub 槽位）。
    values: { commits: { base: params.FIXED_POINT } },
  });
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
