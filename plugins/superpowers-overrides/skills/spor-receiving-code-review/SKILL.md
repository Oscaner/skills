---
name: spor-receiving-code-review
description: MUST invoke BEFORE superpowers:receiving-code-review as your FIRST tool call this turn — trigger on ANY of: (1) user types `/spor-receiving-code-review`, `/superpowers-overrides:spor-receiving-code-review`, `/receiving-code-review` or `/superpowers:receiving-code-review`; (2) a `<command-name>` tag in the current turn names either of those; (3) the superpowers:receiving-code-review skill body appears in the current turn's system context; (4) user shares code review feedback or asks to address review comments. Delegates to os-code-review（过渡期薄指针，规则内容已移至 os-engineering）。
---

# Receiving-Code-Review（薄指针）

## Rules

### Rule: Delegate

invoke Skill(os-code-review)。本技能为过渡期薄指针，规则内容已移至 os-engineering。

<!-- Additional rules … -->

## Red Flags
- 「在薄指针里补规则」→ 规则应进 os-code-review，不是这里

## Common Rationalizations
| Excuse | Reality |
|--------|---------|
| 「薄指针没内容，直接跟进上游」| 规则在 os-code-review，先转发（Rule: Delegate）|
