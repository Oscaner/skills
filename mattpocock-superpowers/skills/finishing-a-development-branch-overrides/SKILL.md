---
name: finishing-a-development-branch-overrides
description: MUST invoke BEFORE superpowers:finishing-a-development-branch as your FIRST tool call this turn — trigger on ANY of: (1) user types `/finishing-a-development-branch` or `/superpowers:finishing-a-development-branch`; (2) a `<command-name>` tag in the current turn names either of those; (3) the superpowers:finishing-a-development-branch skill body appears in the current turn's system context; (4) another skill (executing-plans, subagent-driven-development) hands off to it as a sub-step; (5) user asks in natural language to finish a branch, merge/PR the work, wrap up implementation, or complete development. Applies personal overrides — collapses worktree branches to normal-repo only (per user's git-worktree ban), enforces conventional commits, forbids attribution trailers in commits AND PR bodies, drops upstream Step 6 (Cleanup Workspace) entirely.
---

# Finishing-a-Development-Branch Overrides

## Rules

### Rule 1 — Environment detection collapses to normal-repo only

Upstream Step 2 detects `GIT_DIR != GIT_COMMON` to identify worktree environments and branches menu shape by that. Under user policy ([using-git-worktrees-overrides](../using-git-worktrees-overrides/SKILL.md)), no worktrees exist — every repo is treated as a normal repo.

1. Skip the `GIT_DIR` / `GIT_COMMON` detection block entirely. It has no branches to distinguish.
2. Use the **Standard 4 options menu** unconditionally (Step 4's normal-repo / named-branch-worktree variant). Never present the "detached HEAD (3 options)" variant.
3. If detection unexpectedly returns `GIT_DIR != GIT_COMMON` (i.e. the ban was bypassed and a worktree exists), **stop and alert the user** — the ban was violated somewhere upstream and needs their attention before finishing.

### Rule 2 — Drop Step 6 (Cleanup Workspace) entirely

Upstream Step 6 is dedicated to `git worktree remove` / `git worktree prune`. With no worktrees, it has nothing to do.

1. Skip Step 6 unconditionally, regardless of which Option (1/2/4) is chosen.
2. Options 1 and 4's branch deletion (`git branch -d` / `git branch -D`) still applies — do NOT skip that; only the worktree-removal block is gone.

### Rule 3 — Conventional commit + no attribution, applies to merge commits and PR bodies

User's global `~/.claude/CLAUDE.md`:

> Conventional commits (`feat:`, `fix:`, `docs:`, …).
> **Forbidden:** any attribution/authorship/AI-generation line in commit messages (trailers, footers, inline mentions — none).

Enforce on both surfaces this skill produces:

1. **Merge commit** (Option 1): `git merge <feature-branch>` uses the branch's own commits. Ensure those commits were conventional to begin with (executing-plans-overrides Rule 4). If `--no-ff` produces a merge commit, its subject follows conventional-commit shape too. Never add `Co-Authored-By:` / `Generated with:` / any similar trailer.
2. **PR body** (Option 2): upstream's template (L128-135) has just `## Summary` and `## Test Plan`. Keep those two sections; **do NOT append any attribution paragraph** (`🤖 Generated with Claude Code`, `Co-Authored-By: Claude`, etc.). If the `gh` CLI or a hook adds one automatically, strip it and re-post.
3. **PR title**: conventional-commit shape (`feat: <summary>`, `fix: <summary>`, …), not free-form prose.

### Rule 4 — Never force-push, never `-f`

Upstream Red Flags (L239) says "Force-push without explicit request" is forbidden. Restate here so it's local, not just inherited:

1. `git push` only. Never `git push -f` / `git push --force` / `git push --force-with-lease` unless the user explicitly requested it in the current turn.
2. If push is rejected (non-fast-forward), stop and hand back to the user with the reject reason. Don't silently rebase or force.

### Rule 5 — Option 4 (Discard) confirmation stays typed, not multiple-choice

Upstream Step 5 Option 4 requires the user to type "discard" literally. Do NOT convert this to `AskUserQuestion` — the typed-string requirement is intentional friction against accidental data loss. Present the confirmation block verbatim as upstream specifies, wait for exact-string input.

<!-- Additional rules for the finishing-a-development-branch skill go below as Rule 6, Rule 7, … -->

## Red Flags — STOP if you catch yourself thinking any of these

- "Step 2's detection is harmless, I'll run it and let the outcome branch itself."
- "Step 6's `git worktree remove` will just no-op on a normal repo, safe to keep."
- "The PR body template I know includes a Claude attribution — I'll add it since it's standard."
- "`gh pr create` added a co-author trailer automatically, that's fine."
- "Push was rejected, I'll --force-with-lease since it's safer than --force."
- "Option 4 confirmation is annoying — I'll offer 'yes/no' via AskUserQuestion instead."

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "Running the detection block is passive, no worktree gets touched" | Passive checks still fork the menu logic. Collapse the branch at the source. |
| "Step 6 no-ops on a normal repo" | It also runs `git worktree prune`, which touches the worktree registry. Skip the step, don't rely on empty side effects. |
| "Attribution trailers are standard practice from git tooling" | CLAUDE.md says none, trailers/footers/inline mentions all forbidden. Strip whatever the tooling added. |
| "Force-push-with-lease is safe" | The ban is on force in any form without explicit user ask. `--force-with-lease` is still force. |
| "Typed 'discard' is user-hostile" | It's user-protective. Friction is the point when the action is permanent. |
