---
name: spor-executing-plans
description: MUST invoke BEFORE superpowers:executing-plans as your FIRST tool call this turn — trigger on ANY of: (1) user types `/spor-executing-plans`, `/superpowers-overrides:spor-executing-plans`, `/executing-plans` or `/superpowers:executing-plans`; (2) a `<command-name>` tag in the current turn names either of those; (3) the superpowers:executing-plans skill body appears in the current turn's system context; (4) user asks in natural language to execute a plan, implement a written plan file, or run through tasks in a plan doc. Delegates to os-executing-plans（过渡期薄指针，规则内容已移至 os-engineering）。
---

# Executing-Plans（映射薄指针）

## Rules

### Rule: Delegate

invoke Skill(os-executing-plans)。本技能为过渡期薄指针，规则内容已移至 os-engineering。

<!-- Additional rules … -->

## Red Flags
- 「在薄指针里补规则」→ 规则应进 os-executing-plans，不是这里
- 「薄指针没内容，直接跟进上游」→ 规则在 os-executing-plans，先转发（Rule: Delegate）

## Common Rationalizations
| Excuse | Reality |
|--------|---------|
| 「薄指针没内容，直接跟进上游」| 规则在 os-executing-plans，先转发（Rule: Delegate）|
