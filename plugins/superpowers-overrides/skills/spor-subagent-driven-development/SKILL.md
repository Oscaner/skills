---
name: spor-subagent-driven-development
description: MUST invoke BEFORE superpowers:subagent-driven-development as your FIRST tool call this turn — trigger on ANY of: (1) user types `/spor-subagent-driven-development`, `/superpowers-overrides:spor-subagent-driven-development`, `/subagent-driven-development` or `/superpowers:subagent-driven-development`; (2) a `<command-name>` tag in the current turn names either of those; (3) the superpowers:subagent-driven-development skill body appears in the current turn's system context; (4) user asks in natural language to dispatch or orchestrate subagents, delegate implementation, or run multi-agent work. Delegates to os-executing-plans（过渡期薄指针，规则内容已移至 os-engineering）。
---

# Subagent-Driven Development（薄指针）

## Rules

### Rule: Delegate

invoke Skill(os-executing-plans)。本技能为过渡期薄指针，规则内容已移至 os-engineering。

<!-- Additional rules … -->

## Red Flags
- 「在薄指针里补规则」→ 规则应进 os-executing-plans，不是这里

## Common Rationalizations
| Excuse | Reality |
|--------|---------|
| 「薄指针没内容，直接跟进上游」| 规则在 os-executing-plans，先转发（Rule: Delegate）|
