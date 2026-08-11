---
name: spor-verification-before-completion
description: MUST invoke BEFORE superpowers:verification-before-completion as your FIRST tool call this turn — trigger on ANY of: (1) user types `/spor-verification-before-completion`, `/superpowers-overrides:spor-verification-before-completion`, `/verification-before-completion` or `/superpowers:verification-before-completion`; (2) a `<command-name>` tag in the current turn names either of those; (3) the superpowers:verification-before-completion skill body appears in the current turn's system context; (4) about to claim work is complete, fixed, passing, or done in any workflow (sdd, executing-plans, or standalone). Delegates to os-verification（过渡期薄指针，规则内容已移至 os-engineering）。
---

# Verification-Before-Completion（薄指针）

## Rules

### Rule: Delegate

invoke Skill(os-verification)。本技能为过渡期薄指针，规则内容已移至 os-engineering。

<!-- Additional rules … -->

## Red Flags
- 「在薄指针里补规则」→ 规则应进 os-verification，不是这里

## Common Rationalizations
| Excuse | Reality |
|--------|---------|
| 「薄指针没内容，直接跟进上游」| 规则在 os-verification，先转发（Rule: Delegate）|
