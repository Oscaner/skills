// engine/lib/templates.mjs — CDD mode 模板渲染 + 行预算（Node port of
// cdd_render_mode_prompt / cdd_render_template；行预算 port
// cdd-orchestrator-line-budget.test.sh 的真实阈值）。
// renderModePrompt 读 templates/cdd/<mode>.md + _handoff-write-fragment.md 并做
// {{PLACEHOLDER}} env 替换。TASK 不在 bash `_cdd_template_value` 的 6 键内 —— 片段内联后
// 需它才能渲染完整，故为超集键（fragment 头部声明 {{TASK}} 是其合法占位符）。
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

// 渲染 mode 提示词：mode 模板 + handoff-write 片段，env 变量替换 {{KEY}}。
// 缺失 mode 模板 → 抛错（对齐 cdd_render_template 的 missing template 分支）。
export function renderModePrompt(mode, env = {}) {
  const root = pluginRoot();
  const modePath = path.join(root, "templates", "cdd", `${mode}.md`);
  const fragmentPath = path.join(root, "templates", "cdd", "_handoff-write-fragment.md");
  if (!existsSync(modePath)) throw new Error(`missing template: ${modePath}`);
  let content = readFileSync(modePath, "utf8");
  if (existsSync(fragmentPath)) {
    content += "\n" + readFileSync(fragmentPath, "utf8");
  }
  for (const key of PLACEHOLDERS) {
    const value = env[key] ?? "";
    content = content.split(`{{${key}}}`).join(value);
  }
  return content;
}
