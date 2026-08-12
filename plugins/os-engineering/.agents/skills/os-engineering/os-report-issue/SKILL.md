---
name: os-report-issue
description: 分析当前 SDD/CDD 会话的 bug 与增强机会，经 gh CLI 对 Oscaner/skills 提 GitHub issue（规则自旧版 report-issue 迁移）。repo 开发工具，非常规工作流技能。手动触发，从不自动。
---

# OS Report Issue

分析 SDD/CDD 会话（`.superpowers/sdd/*/progress.md` + `.superpowers/cdd/*/progress.md` + git log）找出 bug 与增强，提 issue。目标仓库 `Oscaner/skills`。

## Rules

### Rule: Analyze Session

按优先级读三来源：
1. **会话上下文**（主）：本会话可见的工具调用记录、报错、handoff 状态、评审发现。
2. **ledger**：repo 根下 `.superpowers/sdd/*/progress.md` 与 `.superpowers/cdd/*/progress.md` 全读；抽取含 `fix round`、`BLOCKED`、`parked`、`deferred`、`CHANGES_REQUESTED` 的行。
3. **git log**：`git log $(git merge-base HEAD origin/main)..HEAD --oneline`；`origin/main` 不可用则回退 `git log -20 --oneline`。识别 `fix:` 前缀 commit 与重复 fix-round 模式。

### Rule: Classify Findings

每条发现归入两类：

| 类型 | 判据 | 标签 |
|------|------|------|
| `bug` | 工具/脚本行为与 spec 不符——超时、错误退出码、gate 误判、handoff schema 错误 | `bug` |
| `enhancement` | 流程可改进但未坏——DX 缺口、文档缺失、CI 覆盖不足、模板缺口 | `enhancement` |

每条含：**Title**（短，可直接作 issue 标题）、**一句话描述**、**受影响组件**（技能名 / 脚本路径 / 命令）、**证据**（具体报错或 ledger 条目）。

### Rule: Confirm Before Filing

把发现列为编号清单呈现给用户，问：整体是否准确？有无删改？**显式确认后才进入提交流程**，不预先 gh issue create。

### Rule: Dedup Check

每条已确认的 finding 先查重：
1. `gh issue list --repo Oscaner/skills --state open --limit 100 --json number,title,body`
2. 取关键字：**受影响组件名**（如 `cdd-run.sh`、`handoff-writer`、`gate`）+ **核心行为词**（如 `timeout`、`CHANGES_REQUESTED`、`exit 137`），对既有 issue 标题与正文做大小写不敏感子串匹配。
3. **命中** → 展示匹配 issue，用户三选：**Create new issue / Add comment to existing / Skip**
4. **未命中** → 用户二选：**Create new issue / Skip**
5. 执行所选动作。

### Rule: Session Language

从用户最近消息检测会话语言，issue 标题与正文用该语言；无信号回退英文。模板见 [Issue Body Templates](#issue-body-templates)。

### Rule: Automatic Labels

`gh issue create` 自动打标：

| Label | When |
|-------|------|
| `bug` / `enhancement` | 总是 —— 匹配 finding 类型 |
| `dogfood` | 总是 —— 本技能发现即 dogfood |
| `superpowers-overrides` | 总是 |
| `cdd` | finding 涉及 CDD、cdd-run.sh、orchestrator 或 handoff |

```bash
# <type> 为 "bug" 或 "enhancement"；CDD 相关追加 ",cdd"
gh issue create --repo Oscaner/skills --title "<title>" \
  --label "<type>,dogfood,superpowers-overrides[,cdd]" \
  --body "<按模板渲染的正文>"

# 命中既有 issue 时追加评论
gh issue comment <number> --repo Oscaner/skills --body "<按模板渲染的正文>"
```

### Rule: Keyword Examples

issue 关键字示例用当前工具名（如 `cdd-run.sh`），不用已删除的旧工具名。

### Rule: Final Report

收尾打印全部结果：新建 issue → URL；追加评论 → URL；Skip → 列出原因。

## Issue Body Templates

按会话语言（Rule: Session Language）选模板。

### Bug — English

```markdown
## Context

<!-- dogfood session context: branch, date, os-* skills in use -->

## Problem

<!-- what happened, with exact error messages or tool output -->

## Impact

<!-- what this blocked or degraded — token cost, extra rounds, incorrect state -->

## Suggested fix

<!-- concrete suggestion, or "Under investigation" -->

## Related

<!-- links to related issues or commits, if known -->
```

### Bug — 中文

```markdown
## 背景

<!-- Dogfood session 上下文：分支、日期、使用了哪些 os-* skill -->

## 问题

<!-- 发生了什么，尽量附上具体报错信息或工具输出 -->

## 影响

<!-- 阻塞或降级了什么——token 消耗、额外轮次、状态错误等 -->

## 建议修复

<!-- 具体建议；若暂不清楚则写"待排查" -->

## 相关

<!-- 相关 issue 链接或 commit，如有 -->
```

### Enhancement — English

```markdown
## Context

<!-- dogfood session context: branch, date, os-* skills in use -->

## Current behavior

<!-- what happens today -->

## Desired behavior

<!-- what should happen instead -->

## Suggested approach

<!-- concrete suggestion, or "Open for discussion" -->

## Related

<!-- links to related issues or commits, if known -->
```

### Enhancement — 中文

```markdown
## 背景

<!-- Dogfood session 上下文：分支、日期、使用了哪些 os-* skill -->

## 当前行为

<!-- 目前的实际表现 -->

## 期望行为

<!-- 应该是什么表现 -->

## 建议方案

<!-- 具体建议；若暂不清楚则写"欢迎讨论" -->

## 相关

<!-- 相关 issue 链接或 commit，如有 -->
```
