---
name: spor-report-issue
description: Analyse the current spor session for bugs and enhancement opportunities, then offer to file GitHub issues via gh CLI against Oscaner/skills. Trigger on `/spor-report-issue` or `/superpowers-overrides:spor-report-issue`. Run after finishing a development session — reads conversation context, .superpowers/sdd/*/progress.md ledgers, and git log to surface findings.
---

# Report Issue（薄指针）

## Rules

### Rule: Delegate

invoke Skill(os-report-issue)。本技能为过渡期薄指针，规则内容已移至 os-engineering。

<!-- Additional rules … -->

## Red Flags
- 「在薄指针里补规则」→ 规则应进 os-report-issue，不是这里

## Common Rationalizations
| Excuse | Reality |
|--------|---------|
| 「薄指针没内容，直接跟进上游」| 规则在 os-report-issue，先转发（Rule: Delegate）|
