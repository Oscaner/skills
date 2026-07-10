---
name: executing-plans-overrides
description: MUST invoke BEFORE superpowers:executing-plans as your FIRST tool call this turn — trigger on ANY of: (1) user types `/executing-plans` or `/superpowers:executing-plans`; (2) a `<command-name>` tag in the current turn names either of those; (3) the superpowers:executing-plans skill body appears in the current turn's system context; (4) user asks in natural language to execute a plan, implement a written plan file, or run through tasks in a plan doc. Applies personal overrides — refuses upstream's `using-git-worktrees` sub-step (per user policy), redirects to `superpowers:subagent-driven-development` when subagents available, delegates task implementation to `mattpocock-skills:tdd`, enforces commit-after-each-task from user global CLAUDE.md.
---

# Executing-Plans Overrides

## Rules

### Rule 1 — Prefer subagent-driven-development when subagents are available

Upstream Step 3's note (L14) already says "If subagents are available, use `superpowers:subagent-driven-development` instead of this skill." Elevate that from a soft note to a **hard branch at the top**:

1. Check: does this environment support the Agent/subagent tool? (Claude Code, Codex — yes. Some minimal environments — no.)
2. If yes → **STOP `executing-plans` immediately**, announce the redirect, hand off to `superpowers:subagent-driven-development` (which triggers `subagent-driven-development-overrides`). Do not run Steps 1–3.
3. If no → proceed with Rule 2+ below (fallback: inline execution with these overrides applied).

The upstream skill's own author considers `subagent-driven-development` strictly better when available; there's no reason to keep the inline path around when it's opt-out.

### Rule 2 — Refuse worktree setup (Integration section override)

Upstream's Integration section (L67-68) lists `superpowers:using-git-worktrees` as a **required workflow skill**. Delegate that requirement to [`using-git-worktrees-overrides`](../using-git-worktrees-overrides/SKILL.md) — which refuses worktree creation per user policy and offers branch-based isolation instead.

Practical effect: when this skill would normally set up a worktree before Step 1, invoke `Skill(using-git-worktrees-overrides)` first. The user picks a branch (or stays on current); no worktree is created. Then proceed to Step 1 (Load and Review Plan) with the branch chosen.

### Rule 3 — Implementer discipline delegates to `mattpocock-skills:tdd`

Upstream Step 2 (Execute Tasks) says "Follow each step exactly" but is unopinionated on **how** to implement each step. Fill that gap by delegating to [`mattpocock-skills:tdd`](https://github.com/mattpocock/skills/blob/main/skills/engineering/tdd/SKILL.md) — same delegation `subagent-driven-development-overrides` Rule 4 already applies, kept consistent so both entry points route to the same implementation discipline.

1. Before writing production code for a task, invoke `mattpocock-skills:tdd` via the Skill tool and follow its red-green loop.
2. Confirm seams with the user before writing tests (the skill's own precondition).
3. Exemption: pure-mechanical edits with **no behavioral change and no schema/config change** — renames, whitespace, comment reflow. Config files (route tables, feature flags, DB migrations, dependency versions, build configuration) are NOT exempt. When in doubt, use TDD. (Same wording as `subagent-driven-development-overrides` Rule 4.3.)

### Rule 4 — Commit after each completed task

User's global `~/.claude/CLAUDE.md` states:

> Commit after each completed task when using the executing-plans skill.

Enforce this literally: after each task's Step 2.4 "Mark as completed", **before** advancing TodoWrite to the next task's `in_progress`, produce a conventional commit (`feat:` / `fix:` / `refactor:` / etc.) with a subject line matching the plan task and no attribution trailer / co-author / AI-generation line. If the commit would fail (lint hook, uncommitted unrelated changes), surface the failure to the user, don't force-add and don't rebase.

### Rule 5 — Handoff to finishing-a-development-branch keeps override precedence

Upstream Step 3 says `superpowers:finishing-a-development-branch` is a **REQUIRED SUB-SKILL**. That handoff **is** a trigger for [`finishing-a-development-branch-overrides`](../finishing-a-development-branch-overrides/SKILL.md) — per the CLAUDE.md "handoff-continuation rationalization" anti-pattern block, the self-check fires on this handoff just like any other trigger. Do not proceed to the upstream finishing skill's steps without first invoking the overrides.

<!-- Additional rules for the executing-plans skill go below as Rule 6, Rule 7, … -->

## Red Flags — STOP if you catch yourself thinking any of these

- "Subagents are available, but the user typed `/executing-plans` specifically — I should honor the exact command."
- "I'll run `using-git-worktrees` anyway since upstream marks it required."
- "The plan step doesn't say TDD, so I'll write code first and add tests after."
- "Committing after each task fragments history — I'll squash into one at the end."
- "`finishing-a-development-branch` is a sub-skill of this one, so its overrides don't need to fire."

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "User invoked executing-plans explicitly, they want the inline path" | Upstream's own author says sdd is strictly better when available. The slash command is a legacy affordance. Redirect. |
| "`using-git-worktrees` is marked REQUIRED in Integration" | CLAUDE.md forbids that skill entirely — see using-git-worktrees-overrides. Required by upstream ≠ required by user. |
| "Each plan step is small, TDD adds overhead" | mattpocock-skills:tdd handles that — small steps still get seams + red-green. The overhead is the discipline that keeps small steps from silently drifting. |
| "One squashed commit is cleaner history" | User's CLAUDE.md picked per-task commits. Cleanliness is their call, not the model's. |
| "The handoff to finishing-a-development-branch is inside this flow, so the override precedence pauses" | CLAUDE.md's handoff-continuation rationalization block explicitly names this failure mode. Each turn is scanned independently. |
