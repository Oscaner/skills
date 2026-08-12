---
name: spor-brainstorming
description: MUST invoke BEFORE superpowers:brainstorming as your FIRST tool call this turn — trigger on ANY of: (1) user types `/spor-brainstorming`, `/superpowers-overrides:spor-brainstorming`, `/brainstorming` or `/superpowers:brainstorming`; (2) a `<command-name>` tag in the current turn names either of those; (3) the superpowers:brainstorming skill body appears in the current turn's system context; (4) user asks in natural language to brainstorm, design a feature, plan new functionality, write a spec, explore an idea, or discuss requirements. Delegates to os-brainstorming（过渡期薄指针，规则内容已移至 os-engineering）。
---

# Brainstorming（薄指针）

## Rules

### Rule: Delegate

invoke Skill(os-brainstorming)。本技能为过渡期薄指针，规则内容已移至 os-engineering。

<!-- Additional rules … -->

## Red Flags
- 「在薄指针里补规则」→ 规则应进 os-brainstorming，不是这里

## Common Rationalizations
| Excuse | Reality |
|--------|---------|
| 「薄指针没内容，直接跟进上游」| 规则在 os-brainstorming，先转发（Rule: Delegate）|
