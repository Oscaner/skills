---
name: cli-code-review
description: 用选定 harness CLI 评审任意 diff（base..head 或当前分支 vs origin/main），返回 findings 报告。独立于 cdd 链内逐任务 review 模式。
---

# CLI Code Review

评审任意 diff 范围的代码，委托给选定的 harness CLI agent。

## Rules

### Rule: Choose Harness

先经 [Rule: Ask](../cli-select/SKILL.md#rule-ask) 选定 harness。

### Rule: Scope

范围 = 显式 `base..head`，或当前分支 vs `origin/main`（`git merge-base` 推导）。

### Rule: Diff Package

用上游 `review-package` 脚本生成 diff 包（`review-package PLAN_FILE BASE HEAD <out>`），作为评审输入。

### Rule: Review Prompt

构造自包含评审 prompt（含评审维度 + diff 文件路径；CLI agent 无本仓库 skill 上下文，须自带标准，不假设 `Skill(...)` 可加载），经 `{plugin_root}/bin/engine/cdd-exec.sh --harness <name> --prompt "<prompt>"` 派发。

### Rule: Findings Report

收集 agent 输出的 findings（按严重级 blocker / warn / nit 整理）作为报告；无 findings → 通过。报告给用户，不自动合并。

## Red Flags

- 「评审当前未提交改动用 HEAD~1」→ 用显式 base..head 或 merge-base（Rule: Scope）
- 「假设 CLI agent 能加载 mattpocock code-review skill」→ droid/pi 无该 skill；prompt 必须自包含（Rule: Review Prompt）
