// engine/lib/templates.mjs — CDD mode 模板渲染 + renderTemplate + 行预算（Node port of
// cdd_render_mode_prompt / cdd_render_template；行预算 port
// cdd-orchestrator-line-budget.test.sh 的真实阈值）。
// renderModePrompt 读 skills/cli-driven-development/templates/<mode>.md 并做
// {{PLACEHOLDER}} env 替换。TASK 不在 bash `_cdd_template_value` 的 6 键内 —— 片段内联后
// 需它才能渲染完整，故为超集键（fragment 头部声明 {{TASK}} 是其合法占位符）。
// renderTemplate 读 skills/_templates/<name>.md 并做全参数替换（used by docs-task.mjs）。
// renderHandoffStub 由 loadHandoffSchema 驱动，生成 schema 合规的 handoff JSON 示例代码块。
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadHandoffSchema } from "./schema-utils.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// From bin/engine/lib/ → packages/osuperpowers/
export const PKG_ROOT = path.resolve(__dirname, "..", "..", "..");

// 真实行预算（P13 re-baseline ~120% of measured P4-P9 post-rewrite）：
// sdd = cli-driven-development/SKILL.md (measured 175 → budget 210)
// ctrl = controller-handoff.md (measured 42 → budget 50)
// tier1 = sdd+ctrl (217 → 260)
// tier2 = tier1+docs-review (260+71=331)
export const LINE_BUDGETS = Object.freeze({
  sdd: 210,
  ctrl: 50,
  tier1: 260,
  tier2: 331,
});

const PLACEHOLDERS = ["WORKSPACE", "BRIEF", "HANDOFF", "FINDINGS", "CONSTRAINTS", "FIXED_POINT", "TASK", "FINDINGS_SCOPE"];

// 行预算查询 —— tier 名 → 阈值。
export function lineBudget(tier) {
  if (!(tier in LINE_BUDGETS)) throw new Error(`unknown line budget tier: ${tier}`);
  return LINE_BUDGETS[tier];
}

// 插件根 —— 自模块路径上溯找 .claude-plugin/plugin.json（对齐 cdd_plugin_root）。
export function pluginRoot() {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (;;) {
    if (existsSync(path.join(dir, ".claude-plugin", "plugin.json"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error("osuperpowers plugin root not found");
    dir = parent;
  }
}

// 生成 schema 合规的 handoff JSON 示例代码块（供模板 {{HANDOFF_STUB}} 替换）。
// schema: loadHandoffSchema() 返回的 JSON Schema 对象。
// mode: "implement" | "task-review" | "fix" 等（写入 stub.phase）。
// taskNum: 整数（undefined 时回退 0；docs 任务传 undefined）。
// { docPath }: docs 任务专用；CDD 任务省略。
export function renderHandoffStub(schema, mode, taskNum, { docPath } = {}) {
  const stub = {};
  for (const field of schema.required ?? []) {
    switch (field) {
      case "task":     stub.task = typeof taskNum === "number" ? taskNum : 0; break;
      case "phase":    stub.phase = mode;                                      break;
      case "status":   stub.status = "APPROVED";                               break;
      case "findings": stub.findings = [];                                     break;
      case "artifacts":stub.artifacts = {};                                    break;
      case "doc_path": stub.doc_path = docPath ?? "";                          break;
    }
  }
  return "```json\n" + JSON.stringify(stub, null, 2) + "\n```";
}

// 渲染 mode 提示词：mode 模板 env 变量替换 {{KEY}}。
// 缺失 mode 模板 → 抛错（对齐 cdd_render_template 的 missing template 分支）。
// {{HANDOFF_STUB}} 由 renderHandoffStub 动态生成（schema 驱动），不经由 PLACEHOLDERS。
export function renderModePrompt(mode, env = {}) {
  const modePath = path.join(PKG_ROOT, "skills", "cli-driven-development", "templates", `${mode}.md`);
  if (!existsSync(modePath)) throw new Error(`missing template: ${modePath}`);
  let content = readFileSync(modePath, "utf8");
  for (const key of PLACEHOLDERS) {
    const value = env[key] ?? "";
    content = content.split(`{{${key}}}`).join(value);
  }
  // {{HANDOFF_STUB}} 动态替换：schema 合规 JSON 示例代码块。
  const schema = loadHandoffSchema();
  const taskNumInt = parseInt(env.TASK) || 0;
  const stub = renderHandoffStub(schema, mode, taskNumInt);
  content = content.replace(/\{\{HANDOFF_STUB\}\}/g, stub);
  return content;
}

// 渲染共享模板（_templates/）：全参数替换 + 缺失占位符报错（used by docs-task.mjs）。
export function renderTemplate(name, params, programName) {
  const templatePath = path.join(PKG_ROOT, "skills", "_templates", `${name}.md`);
  if (!existsSync(templatePath)) {
    throw new Error(`${programName}: template not found: _templates/${name}.md`);
  }
  let content = readFileSync(templatePath, "utf8");
  for (const [key, value] of Object.entries(params)) {
    content = content.split(`{{${key}}}`).join(value);
  }
  // 未传占位符 → 报错（{{HANDOFF_STUB}} 由二次传递处理，豁免）
  const missing = [...content.matchAll(/\{\{(\w+)\}\}/g)].find(m => m[1] !== "HANDOFF_STUB");
  if (missing) {
    throw new Error(`${programName}: template ${name}: missing param ${missing[0]}`);
  }
  return content;
}
