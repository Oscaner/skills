---
name: spor-systematic-debugging
description: MUST invoke BEFORE superpowers:systematic-debugging as your FIRST tool call this turn — trigger on ANY of: (1) user types `/spor-systematic-debugging`, `/superpowers-overrides:spor-systematic-debugging`, `/systematic-debugging` or `/superpowers:systematic-debugging`; (2) a `<command-name>` tag in the current turn names either of those; (3) the superpowers:systematic-debugging skill body appears in the current turn's system context; (4) user asks in natural language to debug, diagnose a bug, investigate a failure, fix a test failure, or troubleshoot unexpected behavior. Delegates to os-debugging（过渡期薄指针，规则内容已移至 os-engineering）。
---

# Systematic-Debugging（薄指针）

## Rules

### Rule: Delegate

invoke Skill(os-debugging)。本技能为过渡期薄指针，规则内容已移至 os-engineering。

<!-- Additional rules … -->

## Red Flags
- 「在薄指针里补规则」→ 规则应进 os-debugging，不是这里

## Common Rationalizations
| Excuse | Reality |
|--------|---------|
| 「薄指针没内容，直接跟进上游」| 规则在 os-debugging，先转发（Rule: Delegate）|
