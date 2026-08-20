---
name: cli-select
description: 列出系统已安装的 harness CLI 并询问用哪个执行任务。推荐优先级 droid > pi > 当前 harness。被 cli-driven-development / cli-task / cli-code-review / executing-plans 引用。
---

# CLI Select

选择执行任务的 harness CLI：检测、列出、推荐、询问。

## Rules

### Rule: Detect

运行 `{plugin_root}/bin/engine/cdd-select.mjs`，解析三行输出：

- `available:` —— ship=full 且已安装的 harness（逗号分隔）
- `unsupported_installed:` —— ship=not-supported 但已安装（提示性，不参与推荐）
- `recommended:` —— 推荐默认（droid > pi > 当前 harness > 字母序第一个）

### Rule: Ask

用 `AskUserQuestion` 列出 `available` 各项，在推荐项标注「(Recommended)」并放第一位，请用户选择。

### Rule: Empty list

`available:` 为空（cdd-select.mjs exit 1）→ **BLOCKED**，报告注册的 full harness 清单与缺失提示。不静默 fallback。

### Rule: Propagate

把所选 harness 以**显式** `--harness <name>` 传给调用方（`cdd-task.mjs --harness <name> …`）。不设隐式环境变量。

## Red Flags

- 「当前 harness 不在 available 里，就强制用它」→ 当前非 full/未检测则跳过回退（Rule: Empty list）
- 「available 为空但 codex 在 PATH，凑合推 codex」→ not-supported 不参与推荐（Rule: Detect）
