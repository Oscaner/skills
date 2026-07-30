---
name: spor-finishing-a-development-branch
description: MUST invoke BEFORE superpowers:finishing-a-development-branch as your FIRST tool call this turn — trigger on ANY of: (1) user types `/spor-finishing-a-development-branch`, `/superpowers-overrides:spor-finishing-a-development-branch`, `/finishing-a-development-branch` or `/superpowers:finishing-a-development-branch`; (2) a `<command-name>` tag in the current turn names either of those; (3) the superpowers:finishing-a-development-branch skill body appears in the current turn's system context; (4) another skill (executing-plans, subagent-driven-development) hands off to it as a sub-step; (5) user asks in natural language to finish a branch, merge/PR the work, wrap up implementation, or complete development. Applies personal overrides — collapses worktree branches to normal-repo only (per user's git-worktree ban), enforces conventional commits, forbids attribution trailers in commits AND PR bodies, drops upstream Step 6 (Cleanup Workspace) entirely.
---

# Finishing-a-Development-Branch Overrides

## Rules

### Rule 1 — Skip worktree detection and cleanup entirely

Under user policy ([spor-using-git-worktrees](../spor-using-git-worktrees/SKILL.md)), no worktrees exist.

1. Skip the `GIT_DIR` / `GIT_COMMON` detection block (upstream Step 2). Use the **Standard 4 options menu** (Step 4's normal-repo variant) unconditionally. Never present the "detached HEAD (3 options)" variant.
2. Skip upstream Step 6 (`git worktree remove` / `git worktree prune`) unconditionally. Options 1 and 4's branch deletion (`git branch -d` / `-D`) still applies — only the worktree-removal block is gone.
3. If detection unexpectedly returns `GIT_DIR != GIT_COMMON` (worktree ban was bypassed upstream), **stop and alert the user** before proceeding.

### Rule 2 — Conventional commit + no attribution, applies to merge commits and PR bodies

User's global `~/.claude/CLAUDE.md`:

> Conventional commits (`feat:`, `fix:`, `docs:`, …).
> **Forbidden:** any attribution/authorship/AI-generation line in commit messages (trailers, footers, inline mentions — none).

Enforce on both surfaces this skill produces:

1. **Merge commit** (Option 1): `git merge <feature-branch>` uses the branch's own commits. Ensure those commits were conventional to begin with (executing-plans Rule 4). If `--no-ff` produces a merge commit, its subject follows conventional-commit shape too. Never add `Co-Authored-By:` / `Generated with:` / any similar trailer.
2. **PR body** (Option 2): upstream's template (L128-135) has just `## Summary` and `## Test Plan`. Keep those two sections; **do NOT append any attribution paragraph** (`🤖 Generated with Claude Code`, `Co-Authored-By: Claude`, etc.). If the `gh` CLI or a hook adds one automatically, strip it and re-post.
3. **PR title**: conventional-commit shape (`feat: <summary>`, `fix: <summary>`, …), not free-form prose.

### Rule 3 — Option 4 (Discard) confirmation stays typed, not multiple-choice

Upstream Step 5 Option 4 requires the user to type "discard" literally. Do NOT convert this to `AskUserQuestion` — the typed-string requirement is intentional friction against accidental data loss. Present the confirmation block verbatim as upstream specifies, wait for exact-string input.

<!-- Additional rules for the finishing-a-development-branch skill go below as Rule 4, Rule 5, … -->

## Red Flags — STOP if you catch yourself thinking any of these

- "Step 2's detection is harmless, I'll run it and let the outcome branch itself."
- "Step 6's `git worktree remove` will just no-op on a normal repo, safe to keep."
- "The PR body template I know includes a Claude attribution — I'll add it since it's standard."
- "`gh pr create` added a co-author trailer automatically, that's fine."
- "Option 4 confirmation is annoying — I'll offer 'yes/no' via AskUserQuestion instead."

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "Running the detection block is passive, no worktree gets touched" | Passive checks still fork the menu logic. Collapse the branch at the source. |
| "Step 6 no-ops on a normal repo" | It also runs `git worktree prune`, which touches the worktree registry. Skip the step, don't rely on empty side effects. |
| "Attribution trailers are standard practice from git tooling" | CLAUDE.md says none, trailers/footers/inline mentions all forbidden. Strip whatever the tooling added. |
| "Typed 'discard' is user-hostile" | It's user-protective. Friction is the point when the action is permanent. |
