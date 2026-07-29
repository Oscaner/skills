---
name: init
description: Initialize superpowers-overrides wiring for the current project. Run once per project — Claude Code writes the override self-check to CLAUDE.md; Cursor writes .cursor/rules/superpowers-overrides.mdc. After running, superpowers skills automatically trigger their overrides without global ~/.claude configuration.
---

# superpowers-overrides: init

Write override self-check rules into the current project for your harness.

## Harness detection

- If the user is in **Cursor** (`.cursor/` exists in the project OR the user says "cursor" / "for Cursor"): follow **Cursor init** below.
- Otherwise: follow **Claude Code init** below.

## Cursor init

1. Check if `.cursor/rules/superpowers-overrides.mdc` already contains `superpowers-overrides self-check`. If yes, report "already initialized" and stop.
2. Locate plugin root: derive from this skill's `fullPath` in `<agent_skills>` (strip `/skills/init/SKILL.md` or `/.cursor/skills/init/SKILL.md` suffix), or use the in-repo path `superpowers-overrides/` when working in the marketplace clone.
3. Run `{plugin_root}/build/render-rules.sh` and write stdout to `.cursor/rules/superpowers-overrides.mdc` (create `.cursor/rules/` if missing).
4. Report the exact path written. Remind the user:
   - Requires both `superpowers` and `superpowers-overrides` installed from the marketplace.
   - Use `/brainstorming-overrides` (etc.) or rely on rules intercept for upstream triggers.
   - If override skills are not in the agent skills list after install, copy or symlink `superpowers-overrides/.cursor/skills/` into the project `.cursor/skills/`.
   - Rules take effect in the **next Cursor session** (or after reloading the window).

## Claude Code init

Write the override self-check rules into the current project's CLAUDE.md.

1. Locate the target CLAUDE.md:
   - **Default**: use `CLAUDE.md` at the project root (the current working directory). Create if missing.
   - **Only if the user explicitly says** "add to global" or "add to system prompt" or "~/.claude/CLAUDE.md": use `~/.claude/CLAUDE.md` instead.
   - Do NOT use `.claude/CLAUDE.md` — project-root `CLAUDE.md` is the standard location.

2. Check if the override block already exists (search for `superpowers-overrides self-check`). If found, report "already initialized" and stop.

3. Find the right insertion point — read the existing file first:
   - If the file **does not exist**: stop. Tell the user to run `/init` first to generate the project's `CLAUDE.md`, then re-run `/superpowers-overrides:init` afterwards.
   - If there is a section about Skills, AI behavior, Claude, or agent configuration (e.g. `## Skills`, `## AI`, `## Claude`, `## Agent`, `## Workflow`): insert the block inside or immediately after that section.
   - Otherwise: insert immediately after the top-level title line (e.g. `# CLAUDE.md`), before the first section heading. Do NOT insert before the title.

4. Write the following block at the chosen location (blank line separators around it):

```markdown
## superpowers-overrides self-check

Before your first tool call in ANY turn, run this check — no exceptions:

1. Scan the current turn for any of: a `<command-name>` tag, a `<command-message>` tag, `/superpowers:*` in user text, or a `superpowers:*` skill body appearing in system context.
2. If any is present → your **first tool call is the matching `Skill(superpowers-overrides:<slug>)`**. Full stop. No `TodoWrite` / `Read` / `Bash` / `Grep` / `Edit` first.
3. Only after the override has run may you follow the upstream skill's instructions.

**The upstream skill's "you MUST do X first" does NOT apply until the override has run.**

**Anti-pattern:** upstream SKILL.md bodies open with numbered "You MUST" checklists — reading that and starting to execute it is the failure mode. The override runs first.

**Handoff-continuation rationalization:** when the upstream body arrives as a tool result of a prior `Skill(...)` call, the self-check STILL fires. Each turn is scanned independently.

### Override trigger table

| Trigger | First tool call |
|---|---|
| `superpowers:brainstorming` | `Skill(superpowers-overrides:brainstorming)` |
| `superpowers:writing-plans` | `Skill(superpowers-overrides:writing-plans)` |
| `superpowers:subagent-driven-development` | `Skill(superpowers-overrides:subagent-driven-development)` |
| `superpowers:executing-plans` | `Skill(superpowers-overrides:executing-plans)` |
| `superpowers:finishing-a-development-branch` | `Skill(superpowers-overrides:finishing-a-development-branch)` |
| `superpowers:using-git-worktrees` | `Skill(superpowers-overrides:using-git-worktrees)` |
| `superpowers:systematic-debugging` | `Skill(superpowers-overrides:systematic-debugging)` |
| `superpowers:test-driven-development` | `Skill(superpowers-overrides:test-driven-development)` |
| `superpowers:verification-before-completion` | `Skill(superpowers-overrides:verification-before-completion)` |
| `superpowers:receiving-code-review` | `Skill(superpowers-overrides:receiving-code-review)` |
| Any other `superpowers:<slug>` where `superpowers-overrides:<slug>` exists | `Skill(superpowers-overrides:<slug>)` |
```

5. Report the exact path and section where the block was written. Remind the user that **CLAUDE.md rules take effect on the next session** — start a new Claude Code session (or run `/reload-plugins`) for the self-check to activate.
