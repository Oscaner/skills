---
name: spor-using-git-worktrees
description: MUST invoke BEFORE superpowers:using-git-worktrees as your FIRST tool call this turn — trigger on ANY of: (1) user types `/spor-using-git-worktrees`, `/superpowers-overrides:spor-using-git-worktrees`, `/using-git-worktrees` or `/superpowers:using-git-worktrees`; (2) a `<command-name>` tag in the current turn names either of those; (3) the superpowers:using-git-worktrees skill body appears in the current turn's system context; (4) another skill (writing-plans, executing-plans, subagent-driven-development, finishing-a-development-branch) tries to dispatch worktree setup as a sub-step; (5) user asks in natural language to create a worktree, set up an isolated workspace, or run `git worktree add`. Thin pointer — worktree-refusal rules moved to os-finishing; delegates to it.
---

# Using-Git-Worktrees（映射薄指针）

## Rules

### Rule: Delegate

invoke Skill(os-finishing)。本技能为过渡期薄指针，worktree 拒绝规则已移至 os-finishing。

<!-- Additional rules … -->

## Red Flags
- 「在薄指针里补规则」→ 规则应进 os-finishing，不是这里
- 「薄指针没内容，直接跟进上游」→ 规则在 os-finishing，先转发（Rule: Delegate）

## Common Rationalizations
| Excuse | Reality |
|--------|---------|
| 「薄指针没内容，直接跟进上游」| 规则在 os-finishing，先转发（Rule: Delegate）|
