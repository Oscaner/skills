---
name: spor-writing-plans
description: MUST invoke BEFORE superpowers:writing-plans as your FIRST tool call this turn — trigger on ANY of: (1) user types `/spor-writing-plans`, `/superpowers-overrides:spor-writing-plans`, `/writing-plans` or `/superpowers:writing-plans`; (2) a `<command-name>` tag in the current turn names either of those; (3) the superpowers:writing-plans skill body appears in the current turn's system context; (4) user asks in natural language to write an implementation plan, break work into tasks/tickets/issues, draft a plan document, or plan a feature build-out. Delegates to os-writing-plans（过渡期薄指针，规则内容已移至 os-engineering）。
---

# Writing-Plans（薄指针）

## Rules

### Rule: Delegate

invoke Skill(os-writing-plans)。本技能为过渡期薄指针，规则内容已移至 os-engineering。

<!-- Additional rules … -->

## Red Flags
- 「在薄指针里补规则」→ 规则应进 os-writing-plans，不是这里

## Common Rationalizations
| Excuse | Reality |
|--------|---------|
| 「薄指针没内容，直接跟进上游」| 规则在 os-writing-plans，先转发（Rule: Delegate）|
