---
name: report-issue
description: Analyzes the current SDD/CDD session for bugs and enhancement opportunities, files GitHub issues against Oscaner/skills via gh CLI (rules migrated from legacy report-issue). Repo development tool, not a regular workflow skill. Manual trigger only, never automatic.
---

# Osuperpowers Report Issue

Analyze SDD/CDD sessions (`.superpowers/sdd/*/progress.md` + `.superpowers/cdd/*/progress.md` + git log) to find bugs and enhancements, file issues. Target repo: `Oscaner/skills`.

## Rules

### Rule: Analyze Session

Read three sources in priority order:
1. **Session context** (primary): tool call records visible in this session, errors, handoff state, review findings.
2. **Ledger**: read all files under repo root `.superpowers/sdd/*/progress.md` and `.superpowers/cdd/*/progress.md`; extract lines containing `fix round`, `BLOCKED`, `parked`, `deferred`, `CHANGES_REQUESTED`.
3. **Git log**: `git log $(git merge-base HEAD origin/main)..HEAD --oneline`; if `origin/main` is unavailable, fall back to `git log -20 --oneline`. Identify `fix:` prefix commits and repeated fix-round patterns.

### Rule: Classify Findings

Each finding is classified into one of two categories:

| Type | Criteria | Label |
|------|----------|-------|
| `bug` | Tool/script behavior does not match spec -- timeouts, wrong exit codes, gate misjudgment, handoff schema errors | `bug` |
| `enhancement` | Process can be improved but is not broken -- DX gaps, missing docs, insufficient CI coverage, template gaps | `enhancement` |

Each finding includes: **Title** (short, usable as issue title directly), **one-line description**, **affected component** (skill name / script path / command), **evidence** (specific error output or ledger entry).

### Rule: Confirm Before Filing

Present findings as a numbered list to the user, asking: is this accurate overall? Any additions or removals? **Only proceed to filing after explicit confirmation**, do not pre-create gh issue.

### Rule: Dedup Check

Before filing, check each confirmed finding for duplicates:
1. `gh issue list --repo Oscaner/skills --state open --limit 100 --json number,title,body`
2. Extract keywords: **affected component name** (e.g. `cdd-task.mjs`, `handoff-writer`, `gate`) + **core behavior words** (e.g. `timeout`, `CHANGES_REQUESTED`, `exit 137`), do case-insensitive substring matching against existing issue titles and bodies.
3. **Hit** -> show matching issue, user chooses from three options: **Create new issue / Add comment to existing / Skip**
4. **No hit** -> user chooses from two options: **Create new issue / Skip**
5. Execute the selected action.

### Rule: Session Language

Detect session language from the user's most recent messages; issue title and body use that language; no signal defaults to English. Templates: see [Issue Body Templates](#issue-body-templates).

### Rule: Automatic Labels

`gh issue create` auto-applies labels:

| Label | When |
|-------|------|
| `bug` / `enhancement` | Always -- matches finding type |
| `dogfood` | Always -- this skill's findings are dogfood |
| `osuperpowers-router` | Always |
| `cdd` | Finding involves CDD, cdd-task.mjs, orchestrator, or handoff |

```bash
# <type> is "bug" or "enhancement"; append ",cdd" if CDD-related
gh issue create --repo Oscaner/skills --title "<title>" \
  --label "<type>,dogfood,osuperpowers-router[,cdd]" \
  --body "<template-rendered body>"

# When matching an existing issue, append a comment
gh issue comment <number> --repo Oscaner/skills --body "<template-rendered body>"
```

### Rule: Keyword Examples

Issue keyword examples use current tool names (e.g. `cdd-task.mjs`), not deleted legacy tool names.

### Rule: Final Report

Print all results at completion: new issue -> URL; appended comment -> URL; Skip -> list reason.

## Issue Body Templates

Choose template based on session language (Rule: Session Language).

### Bug -- English

```markdown
## Context

<!-- dogfood session context: branch, date, osuperpowers skills in use -->

## Problem

<!-- what happened, with exact error messages or tool output -->

## Impact

<!-- what this blocked or degraded -- token cost, extra rounds, incorrect state -->

## Suggested fix

<!-- concrete suggestion, or "Under investigation" -->

## Related

<!-- links to related issues or commits, if known -->
```

### Bug -- Chinese

```markdown
## 背景

<!-- Dogfood session 上下文：分支、日期、使用了哪些 osuperpowers skill -->

## 问题

<!-- 发生了什么，尽量附上具体报错信息或工具输出 -->

## 影响

<!-- 阻塞或降级了什么——token 消耗、额外轮次、状态错误等 -->

## 建议修复

<!-- 具体建议；若暂不清楚则写"待排查" -->

## 相关

<!-- 相关 issue 链接或 commit，如有 -->
```

### Enhancement -- English

```markdown
## Context

<!-- dogfood session context: branch, date, osuperpowers skills in use -->

## Current behavior

<!-- what happens today -->

## Desired behavior

<!-- what should happen instead -->

## Suggested approach

<!-- concrete suggestion, or "Open for discussion" -->

## Related

<!-- links to related issues or commits, if known -->
```

### Enhancement -- Chinese

```markdown
## 背景

<!-- Dogfood session 上下文：分支、日期、使用了哪些 osuperpowers skill -->

## 当前行为

<!-- 目前的实际表现 -->

## 期望行为

<!-- 应该是什么表现 -->

## 建议方案

<!-- 具体建议；若暂不清楚则写"欢迎讨论" -->

## 相关

<!-- 相关 issue 链接或 commit，如有 -->
```
