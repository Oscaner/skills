---
name: spor-finishing-a-development-branch
description: MUST invoke BEFORE superpowers:finishing-a-development-branch as your FIRST tool call this turn — trigger on ANY of: (1) user types `/spor-finishing-a-development-branch`, `/superpowers-overrides:spor-finishing-a-development-branch`, `/finishing-a-development-branch` or `/superpowers:finishing-a-development-branch`; (2) a `<command-name>` tag in the current turn names either of those; (3) the superpowers:finishing-a-development-branch skill body appears in the current turn's system context; (4) another skill (executing-plans, subagent-driven-development) hands off to it as a sub-step; (5) user asks in natural language to finish a branch, merge/PR the work, wrap up implementation, or complete development. Delegates to os-finishing（过渡期薄指针，规则内容已移至 os-engineering）。
---

# Finishing-a-Development-Branch（薄指针）

## Rules

### Rule: Delegate

invoke Skill(os-finishing)。本技能为过渡期薄指针，规则内容已移至 os-engineering。

<!-- Additional rules … -->

## Red Flags
- 「在薄指针里补规则」→ 规则应进 os-finishing，不是这里

## Common Rationalizations
| Excuse | Reality |
|--------|---------|
| 「薄指针没内容，直接跟进上游」| 规则在 os-finishing，先转发（Rule: Delegate）|
