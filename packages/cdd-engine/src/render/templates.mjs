// packages/cdd-engine/src/render/templates.mjs（ex lib/templates.mjs）
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadHandoffSchema } from '../rules/schema.ts';
import { familyConfig } from '../artifacts/handoff/naming.ts';

// PKG_ROOT = <pkg>/templates（re-org Step 5）：以 import.meta.url 相对 ../templates/ 重写，
// 消除 path.resolve(__dirname, …) 计数链；语义收敛为该模板资源目录本身（消费方不再拼 'templates' 段）。
export const PKG_ROOT = fileURLToPath(new URL('../../templates', import.meta.url));

// template 名 → 分组映射（URC: review 模板数据化 — 六旧 review/fix 模板删除，
// 共享壳 review.md + fix/docs.md 由 canonical 配置驱动；Task 18: doc-fix.md → fix/docs.md 迁出 review/）。
// task/             cdd 按 mode 渲染（implement/fix 子命令消费）
// review/           review 共享壳（cdd review --type task|branch|spec|plan）
// fix/              docs 族 fix 壳（cdd fix --type spec|plan —— canonical fix.{type}.fixTemplate = "docs"）
// schema/           handoff JSON schemas（task-handoff-schema.json / docs-handoff-schema.json）
const MODE_GROUPS = {
  implement: 'task',
  fix: 'task',
  review: 'review',
  docs: 'fix',
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

// ---- Handoff 契约注入（Task 18：schema 原样注入）----
// 契约唯一（schema）→ 注入唯一（它的字符串形式）。零 render：不解释、不简化、不预填、
// 不缩骨架、不写枚举示例 —— 规则全部由 schema 的 description 承载（写协议规则已迁入
// semantics：status「写 findings 不写 status」/ findings「{lens,severity,…}」/
// artifacts「point at files」/ commits.head「40 位全形」/ blocker「无阻塞省略」）。
export function renderHandoffStub(schema) {
  return '```json\n' + JSON.stringify(schema, null, 2) + '\n```';
}

// ---- Review 模板数据化（reviews.json per-type 配置 + review.md 共享壳）----

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
// handoffType 字段名退位 → canonical 的 schema（"task"/"docs"），returnMode → canonical 的
// return（"h1"/"json"）。fixTemplate 不被此层返回（runFix 直读 fix 族，无第二读取点）。
// Task 18：schema 前缀统一 —— canonical 值随文件名 cdd- → task- 改名。
export function reviewArtifactConfig(type) {
  const cfg = familyConfig('review', type);
  return { schema: cfg.schema, return: cfg.return };
}

// returnMode=h1 类型（task/branch）注入 {{H1_BLOCK}} 的四行 H1 合同；spec/plan 不渲染（空串）。
// Task 18：本块随共享 `## Return` 壳放置（不再自带 `## Return (H1 — stdout only)` 标题 ——
// 模板的 Return 段标题已统一，标题重复会破坏「4 模板同骨架」的段序断言）。
export const REVIEW_H1_BLOCK = `Return **exactly 4 lines** to stdout; make this block the **final** output — nothing may follow it (stream-json harnesses parse the last block):

\`\`\`
status: <APPROVED|BLOCKED>
commits: base=<sha> head=<sha>
artifacts: brief=<path> report=<path> test_evidence=<path>
blocker: <none|one-line>
\`\`\``;

// review.md HARD GATE（T6）：returnMode 分写 — h1 → "BEFORE outputting H1"；json → "BEFORE outputting
// the JSON return"。注入实际 handoff 路径。returnMode 非法 → 按 h1 缺省（未知族不崩渲染）。
export function reviewHardGate(returnMode, handoffPath) {
  const before = returnMode === "json" ? "BEFORE outputting the JSON return." : "BEFORE outputting H1.";
  const target = handoffPath ?? "{{HANDOFF}}";
  return `> ⚠️ HARD GATE — Write \`${target}\` ${before}\n> Returning without a written handoff file = BLOCKED (runner exit 1).`;
}

// docs 族 fix（cdd fix --type spec|plan）的 HARD GATE（Task 18 review-1 finding 2）：fix 的 return = 写盘
// 本身（fix/docs.md ## Return「Your return IS the handoff written to … — the engine reads the file, not
// your stdout」；stdout 无 JSON return）。不得复用 reviewHardGate("json")——「BEFORE outputting the JSON
// return」对 fix 代理自相矛盾。门语义 = 写完盘再退出。
export function docsFixHardGate(handoffPath) {
  const target = handoffPath ?? "{{HANDOFF}}";
  return `> ⚠️ HARD GATE — Write \`${target}\` BEFORE exiting: the engine reads the file, not your stdout. Returning without a written handoff file = BLOCKED (runner exit 1).`;
}

// implement 的 HARD GATE：本模式不写 handoff（runner 从 H1 四行 + TASK_BASE + git HEAD 实体化），
// 与 fix/review 的「写盘先于 return」同构但语义相反 —— 共享 Handoff 壳的槽位注入值，非模板差异。
// 产物（report + test evidence）先行：实体化 handoff 的 artifacts 全来自它们，缺席即 BLOCKED。
function implementHardGate(handoffPath, taskNum) {
  const target = handoffPath || `task-${taskNum}-implement.json`;
  return `> ⚠️ HARD GATE — This mode does not write \`${target}\`: the runner materializes it from your H1 four lines + the brief's \`TASK_BASE\` + \`git HEAD\`. Write the implementer report + test evidence BEFORE outputting H1 — returning without them = BLOCKED (runner exit 1).`;
}

// params = promptParams（buildPromptParams 产出）：模板插值键 + PLAN_LINE。
// PLAN_LINE 由调用方从**显式 plan 路径**派生后经 params 传入 —— 本层零 env 读取，
// 且不引入以 plan 路径为值的 env 键名（该键名是「派生值不得借道 env」守卫的命中面）。
export function renderModePrompt(mode, params = {}) {
  // review mode 走 review.md 共享壳（reviews.json type=task 配置）；旧拼装模板已删除。
  // REFERENCE 具体化为 FIXED_POINT..HEAD。fix/implement 保持 task/ 模板。
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
    // HANDOFF_STUB：共享壳槽位 = schema 原样注入（Task 18，零 render；无 values 注入面）。
    const stub = renderHandoffStub(loadHandoffSchema('task'));
    return prompt.replace(/\{\{HANDOFF_STUB\}\}/g, stub);
  }
  const modePath = templatePath(mode);
  if (!existsSync(modePath)) throw new Error(`missing template: ${modePath}`);
  let content = readFileSync(modePath, 'utf8');
  for (const key of PLACEHOLDERS) {
    content = content.split(`{{${key}}}`).join(params[key] ?? '');
  }
  // 共享 Handoff / Return 壳槽位（task 族 = implement/fix）：HARD_GATE 按 mode 注入
  //（fix = 写盘先于 return；implement = 不写 handoff，runner 实体化），H1_BLOCK = 共享四行合同。
  content = content.replace(/\{\{HARD_GATE\}\}/g,
    mode === 'fix' ? reviewHardGate('h1', params.HANDOFF) : implementHardGate(params.HANDOFF, params.TASK));
  content = content.replace(/\{\{H1_BLOCK\}\}/g, REVIEW_H1_BLOCK);
  const stub = renderHandoffStub(loadHandoffSchema('task'));
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
