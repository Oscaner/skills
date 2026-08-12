---
name: spor-test-driven-development
description: MUST invoke BEFORE superpowers:test-driven-development as your FIRST tool call this turn — trigger on ANY of: (1) user types `/spor-test-driven-development`, `/superpowers-overrides:spor-test-driven-development`, `/test-driven-development` or `/superpowers:test-driven-development` or `/tdd`; (2) a `<command-name>` tag in the current turn names any of those; (3) the superpowers:test-driven-development skill body appears in the current turn's system context; (4) user asks in natural language to do TDD, write tests first, follow red-green-refactor, or implement a feature test-first. Delegates to mattpocock-skills:tdd; seam confirmation gate lives in templates/cdd/implement.md
---

# Test-Driven Development（映射薄指针）

## Rules

### Rule: Delegate

invoke Skill(mattpocock-skills:tdd)。本技能为过渡期薄指针，规则内容已移至 mattpocock-skills:tdd；seam 确认门见 templates/cdd/implement.md。

<!-- Additional rules … -->

## Red Flags
- 「在薄指针里补规则」→ 规则应进 mattpocock-skills:tdd，不是这里
- 「薄指针没内容，直接跟进上游」→ 规则在 mattpocock-skills:tdd，先转发（Rule: Delegate）

## Common Rationalizations
| Excuse | Reality |
|--------|---------|
| 「薄指针没内容，直接跟进上游」| 规则在 mattpocock-skills:tdd，先转发（Rule: Delegate）|
