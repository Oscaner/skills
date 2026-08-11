---
name: spor-using-git-worktrees
description: MUST invoke BEFORE superpowers:using-git-worktrees as your FIRST tool call this turn — trigger on ANY of: (1) user types `/spor-using-git-worktrees`, `/superpowers-overrides:spor-using-git-worktrees`, `/using-git-worktrees` or `/superpowers:using-git-worktrees`; (2) a `<command-name>` tag in the current turn names either of those; (3) the superpowers:using-git-worktrees skill body appears in the current turn's system context; (4) another skill (writing-plans, executing-plans, subagent-driven-development, finishing-a-development-branch) tries to dispatch worktree setup as a sub-step; (5) user asks in natural language to create a worktree, set up an isolated workspace, or run `git worktree add`. Refuses worktree creation entirely — user policy in `~/.claude/CLAUDE.md` forbids both `git worktree` and this skill.
---

# Using-Git-Worktrees（映射薄指针）

invoke Skill(os-finishing)
