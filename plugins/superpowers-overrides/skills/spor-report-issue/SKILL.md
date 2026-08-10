---
name: spor-report-issue
description: Analyse the current spor session for bugs and enhancement opportunities, then offer to file GitHub issues via gh CLI against Oscaner/skills. Trigger on `/spor-report-issue` or `/superpowers-overrides:spor-report-issue`. Run after finishing a development session — reads conversation context, .superpowers/sdd/*/progress.md ledgers, and git log to surface findings.
---

# spor-report-issue

Standalone skill — not an override. Reads the current session and summarises spor workflow problems and optimisation candidates, then offers to file them as GitHub issues.

## Trigger

`/spor-report-issue` or `/superpowers-overrides:spor-report-issue`. Manual only — never auto-triggered.

## Target repo

`Oscaner/skills` (the repository this plugin lives in). All `gh` commands target this repo.

## Process

### Phase 1 — Gather information

Read three sources in priority order:

1. **Conversation context** (primary): tool call records, error messages, handoff statuses, review findings visible in this session.
2. **Ledgers**: read every `.superpowers/sdd/*/progress.md` present in the repo root. Extract lines containing `fix round`, `BLOCKED`, `parked`, `deferred`, `CHANGES_REQUESTED`.
3. **Git log**: run `git log $(git merge-base HEAD origin/main)..HEAD --oneline`. Fall back to `git log -20 --oneline` if `origin/main` is unavailable. Identify `fix:` prefix commits and any repeated fix-round patterns.

### Phase 2 — Classify and summarise (Claude reasoning)

Classify each finding into one of two types:

| Type | Criteria | Label |
|------|----------|-------|
| `bug` | Tool/script behaved differently from spec — timeouts, wrong exit codes, gate misjudgements, handoff schema errors | `bug` |
| `enhancement` | Process could improve without being broken — DX gaps, missing docs, insufficient CI coverage, template gaps | `enhancement` |

Each finding must include:
- **Title** — short, usable as an issue title
- **One-line description**
- **Affected component** — skill name, script path, or command
- **Evidence** — specific error text or ledger entry

### Phase 3 — Show summary, get confirmation

Present findings as a numbered list. Ask the user:
- Is this accurate overall?
- Anything to remove or add?

Proceed to Phase 4 only after explicit confirmation.

### Phase 4 — Process each finding (dedup check + submit)

For each confirmed finding:

1. Run: `gh issue list --repo Oscaner/skills --state open --limit 100 --json number,title,body`
2. Extract keywords from the finding: **affected component name** (e.g. `cdd-run.sh`, `handoff-writer`, `gate`) and **core behaviour words** (e.g. `timeout`, `CHANGES_REQUESTED`, `exit 137`). Match case-insensitively as substrings against existing issue titles and bodies.
3. **Match found** → show matching issues, ask user: **Create new issue / Add comment to existing / Skip**
4. **No match** → ask user: **Create new issue / Skip**
5. Execute the chosen action.

**Language rule:** Detect session language from the user's most recent messages. Use that language for issue titles and bodies. Fall back to English.

**Labels applied automatically by this skill:**

| Label | When |
|-------|------|
| `bug` or `enhancement` | Always — matches finding type |
| `dogfood` | Always — all issues filed by this skill are found during dogfood |
| `superpowers-overrides` | Always — hardcoded to this plugin name |
| `sdd` | When finding mentions SDD, SDD CLI harness (cdd-run.sh), orchestrator, or handoff |

**`gh issue create` invocation pattern:**
```bash
# <type> is "bug" or "enhancement"; append ",sdd" when the finding is SDD-related
gh issue create \
  --repo Oscaner/skills \
  --title "<title>" \
  --label "<type>,dogfood,superpowers-overrides" \
  --body "<rendered body from template below>"
# SDD-related finding:
# --label "<type>,dogfood,superpowers-overrides,sdd"
```

**`gh issue comment` invocation pattern:**
```bash
gh issue comment <number> \
  --repo Oscaner/skills \
  --body "<rendered body from template below>"
```

### Phase 5 — Final report

Print all outcomes:
- Created issue → URL
- Added comment → URL
- Skipped → list with reason

## Issue Body Templates

Select the template matching the session language (detected in Phase 4).

### Bug — English

```markdown
## Context

<!-- dogfood session context: branch, date, spor skills in use -->

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

<!-- Dogfood session 上下文：分支、日期、使用了哪些 spor skill -->

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

<!-- dogfood session context: branch, date, spor skills in use -->

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

<!-- Dogfood session 上下文：分支、日期、使用了哪些 spor skill -->

## 当前行为

<!-- 目前的实际表现 -->

## 期望行为

<!-- 应该是什么表现 -->

## 建议方案

<!-- 具体建议；若暂不清楚则写"欢迎讨论" -->

## 相关

<!-- 相关 issue 链接或 commit，如有 -->
```
