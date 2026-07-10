---
name: using-git-worktrees-overrides
description: MUST invoke BEFORE superpowers:using-git-worktrees as your FIRST tool call this turn — trigger on ANY of: (1) user types `/using-git-worktrees` or `/superpowers:using-git-worktrees`; (2) a `<command-name>` tag in the current turn names either of those; (3) the superpowers:using-git-worktrees skill body appears in the current turn's system context; (4) another skill (writing-plans, executing-plans, subagent-driven-development, finishing-a-development-branch) tries to dispatch worktree setup as a sub-step; (5) user asks in natural language to create a worktree, set up an isolated workspace, or run `git worktree add`. Refuses worktree creation entirely — user policy in `~/.claude/CLAUDE.md` forbids both `git worktree` and this skill.
---

# Using-Git-Worktrees Overrides

## Rules

### Rule 1 — Refuse worktree creation, offer branch-based isolation instead

User's global `~/.claude/CLAUDE.md` states verbatim:

> **Git worktrees are forbidden.** Never use `git worktree` or the `using-git-worktrees` skill.

This override's job is to **stop the upstream skill from running** and hand control back to the user with a concrete alternative. Do not paraphrase upstream Step 0/1/2/3/4, do not detect isolation, do not check `.worktrees/` — none of it applies.

**When triggered:**

1. **Announce the refusal** to the user, quoting the CLAUDE.md line so the reason is visible:

   > "This project's `~/.claude/CLAUDE.md` forbids `git worktree` and the `using-git-worktrees` skill. Not running upstream Steps 0–4."

2. **Offer branch-based isolation** as the substitute — same isolation goal, different mechanism:

   ```
   git checkout -b <feature-branch>
   ```

   Isolation comes from the branch + commits, not from a separate filesystem tree. Working-directory conflicts are handled by `git stash`, not by opening a second checkout.

3. **Ask the user** via `AskUserQuestion` how to proceed:
   - "Create a new branch `<name>` for this feature" (recommend if starting fresh work)
   - "Continue on the current branch" (recommend if the current branch is already the target)
   - "Stash current changes first, then branch" (if working tree is dirty)
   - Free-form option retained for edge cases

4. **Never invoke `EnterWorktree` / `WorktreeCreate` / native worktree tools either.** The CLAUDE.md line forbids the skill entirely — not just the `git worktree` command. Native harness tools that create isolated worktree state (even auto-managed) fall under the same ban.

### Rule 2 — Propagate the refusal upstream when a caller skill requested worktree setup

`writing-plans`, `executing-plans`, `subagent-driven-development`, and `finishing-a-development-branch` all reference `using-git-worktrees` as a sub-step ("set up an isolated workspace first"). When the trigger for this override came from one of those callers rather than a direct user request:

1. Complete Rule 1's refusal + branch offer as usual.
2. Return control to the caller skill / override with the outcome (which branch you're on, whether stash happened).
3. The caller MUST NOT retry worktree creation. If a caller's upstream body contains "You MUST create a worktree first," that MUST does not survive this override — same precedence logic as CLAUDE.md's anti-pattern block.

### Rule 3 — Ensure global CLAUDE.md registers this override

For the override to fire on triggers (1)–(3), the user's global `~/.claude/CLAUDE.md` override-trigger table needs a row:

| Trigger | First tool call |
|---|---|
| `superpowers:using-git-worktrees` | `Skill(using-git-worktrees-overrides)` |

If that row is missing when this skill is first invoked, notify the user once: "Consider adding `using-git-worktrees` to `~/.claude/CLAUDE.md`'s override-trigger table so this refusal fires automatically." Then proceed with Rule 1 for the current turn. Do not silently succeed — the `Any other superpowers:<X> where <X>-overrides exists` fallback row in CLAUDE.md already covers this case, but explicit is better than fallback for a hard ban.

<!-- Additional rules for the using-git-worktrees skill go below as Rule 4, Rule 5, … -->

## Red Flags — STOP if you catch yourself thinking any of these

- "The user just triggered `/using-git-worktrees`, they clearly want a worktree — CLAUDE.md doesn't override an explicit ask."
- "The upstream Step 0 says 'already in a worktree, skip creation' — I can just report that and proceed, no worktree gets created."
- "`EnterWorktree` is a native tool, not `git worktree` — the CLAUDE.md ban is only about the CLI command."
- "The caller skill (writing-plans / executing-plans) said 'set up isolation first' — I should honor its request over the global ban."
- "I'll paraphrase Step 0's detection logic just so the user knows where they stand."
- "Branch-based isolation is inferior, I should explain the trade-offs before offering it."

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "Explicit user command overrides the global ban" | It doesn't. The ban's phrasing is "Never use ... the `using-git-worktrees` skill" — invoking the slash command is exactly the case being forbidden. Ask what the user actually wants and offer a branch instead. |
| "`EnterWorktree` is different from `git worktree`" | The CLAUDE.md line names two forbidden things: the CLI command AND the skill. `EnterWorktree` implements the skill's Step 1a. Same ban. |
| "Detecting existing isolation is passive, not creating anything" | Reporting "you're in a worktree" still runs the upstream skill's flow. This override's job is to short-circuit the flow entirely. |
| "The caller skill asked for it, so the intent is inherited" | Inherited intent does not override a CLAUDE.md hard ban. Refuse and hand back — the caller's next step is whatever it does when isolation is declined. |
| "Branch + stash is worse than worktree" | Different trade-off, not worse. Worktree = two checkouts, more disk, harness surface area. Branch = one checkout, stash for uncommitted state, simpler recovery. User picked this trade-off. |
