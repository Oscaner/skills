---
name: finishing
description: Independent finishing orchestrator -- Reads upstream superpowers:finishing-a-development-branch as baseline, layers personal rules (no worktree / conventional commits / no attribution / Option4 typed discard).
---

# Osuperpowers Finishing

Development branch finishing: merge / PR / keep / discard.

## Rules

### Rule: Read Upstream

Read upstream `superpowers:finishing-a-development-branch` SKILL.md as the process baseline **when available** (resolution priority + unavailability fallback same as [Rule: Read Upstream](../brainstorming/SKILL.md#rule-read-upstream)). **Read, not Skill-invoke**.

### Rule: No Worktrees

**No worktrees** (user policy). Skip the upstream worktree detection block, use Standard 4 options (normal-repo variant). If worktree state is accidentally detected -> STOP + report to user. Skip upstream Step 6 (worktree remove/prune).

### Rule: Conventional Commits

Merge commit / PR title follows conventional commits; **no attribution/co-author/AI-generation lines** (trailers, footers, inline -- none allowed). PR body uses only `## Summary` + `## Test Plan`, no attribution sections appended.

### Rule: Option4 Typed Discard

Option 4 (discard branch) requires the user to **type the literal "discard"** to confirm, not a multiple-choice menu. The friction prevents accidental deletion.

## Red Flags

- "Running worktree detection is harmless" -> no worktrees, skip detection block (Rule: No Worktrees)
- "Adding Claude attribution to PR body is standard practice" -> user policy forbids it (Rule: Conventional Commits)
