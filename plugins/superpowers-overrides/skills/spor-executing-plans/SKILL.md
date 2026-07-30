---
name: spor-executing-plans
description: MUST invoke BEFORE superpowers:executing-plans as your FIRST tool call this turn — trigger on ANY of: (1) user types `/spor-executing-plans`, `/superpowers-overrides:spor-executing-plans`, `/executing-plans` or `/superpowers:executing-plans`; (2) a `<command-name>` tag in the current turn names either of those; (3) the superpowers:executing-plans skill body appears in the current turn's system context; (4) user asks in natural language to execute a plan, implement a written plan file, or run through tasks in a plan doc. Applies personal overrides — refuses upstream's `using-git-worktrees` sub-step (per user policy), redirects to `superpowers:subagent-driven-development` when subagents available, delegates task implementation to `mattpocock-skills:tdd`, enforces commit-after-each-task from user global CLAUDE.md.
---

# Executing-Plans Overrides

## Rules

### Rule 1 — Prefer subagent-driven-development when subagents are available

Upstream Step 3's note (L14) already says "If subagents are available, use `superpowers:subagent-driven-development` instead of this skill." Elevate that from a soft note to a **hard branch at the top**:

1. Check: does this environment support the Agent/subagent tool? (Claude Code, Codex — yes. Some minimal environments — no.)
2. If yes → **STOP `executing-plans` immediately**, announce the redirect, hand off to `superpowers:subagent-driven-development` (which triggers `subagent-driven-development`). Do not run Steps 1–3.
3. If no → proceed with Rule 2+ below (fallback: inline execution with these overrides applied).

The upstream skill's own author considers `subagent-driven-development` strictly better when available; there's no reason to keep the inline path around when it's opt-out.

### Rule 2 — Refuse worktree setup (Integration section override)

Upstream's Integration section (L67-68) lists `superpowers:using-git-worktrees` as a **required workflow skill**. Delegate that requirement to [`spor-using-git-worktrees`](../spor-using-git-worktrees/SKILL.md) — which refuses worktree creation per user policy and offers branch-based isolation instead.

Practical effect: when this skill would normally set up a worktree before Step 1, invoke `Skill(superpowers-overrides:spor-using-git-worktrees)` first. The user picks a branch (or stays on current); no worktree is created. Then proceed to Step 1 (Load and Review Plan) with the branch chosen.

### Rule 3 — Implementer discipline delegates to `mattpocock-skills:tdd`

Same delegation, exemption, and failure handling as [`subagent-driven-development`](../subagent-driven-development/SKILL.md) Rule 3 — follow that rule verbatim. Both entry points route to the same implementation discipline.

### Rule 4 — Commit after each completed task

User's global `~/.claude/CLAUDE.md` states:

> Commit after each completed task when using the executing-plans skill.

Enforce this literally: after each task's Step 2.4 "Mark as completed", **before** advancing TodoWrite to the next task's `in_progress`, produce a conventional commit (`feat:` / `fix:` / `refactor:` / etc.) with a subject line matching the plan task and no attribution trailer / co-author / AI-generation line. If the commit would fail (lint hook, uncommitted unrelated changes), surface the failure to the user, don't force-add and don't rebase.

<!-- Additional rules for the executing-plans skill go below as Rule 5, Rule 6, … -->

## Red Flags — STOP if you catch yourself thinking any of these

- "Subagents are available, but the user typed `/executing-plans` specifically — I should honor the exact command."
- "I'll run `using-git-worktrees` anyway since upstream marks it required."
- "The plan step doesn't say TDD, so I'll write code first and add tests after."
- "Committing after each task fragments history — I'll squash into one at the end."

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "User invoked executing-plans explicitly, they want the inline path" | Upstream's own author says sdd is strictly better when available. The slash command is a legacy affordance. Redirect. |
| "`using-git-worktrees` is marked REQUIRED in Integration" | CLAUDE.md forbids that skill entirely — see using-git-worktrees. Required by upstream ≠ required by user. |
| "Each plan step is small, TDD adds overhead" | mattpocock-skills:tdd handles that — small steps still get seams + red-green. The overhead is the discipline that keeps small steps from silently drifting. |
| "One squashed commit is cleaner history" | User's CLAUDE.md picked per-task commits. Cleanliness is their call, not the model's. |
