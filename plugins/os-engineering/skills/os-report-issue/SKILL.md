---
name: os-report-issue
description: 分析当前 spor/os 会话的 bug 与增强机会，经 gh CLI 对 Oscaner/skills 提 GitHub issue（spor-report-issue 规则迁移于此）。repo 开发工具，非常规工作流技能。
---

# OS Report Issue

分析 SDD 会话（.superpowers/sdd/*/progress.md + git log）找出 bug 与增强，提 issue。

## Rules

### Rule: Analyze Session
读 `.superpowers/sdd/*/progress.md` ledger + git log，找 bug（deferred 残留、validate 缺口）与增强机会。

### Rule: Offer Issues
用 AskUserQuestion 列出候选，用户选择要提的；经 `gh issue create` 提交（针对 Oscaner/skills）。

### Rule: Keyword Examples
issue 关键字示例用当前工具名（`cdd-run.sh` 而非已删的 `sdd-run-task-*.sh`）。
