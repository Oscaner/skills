---
name: init
description: Initialize superpowers-overrides wiring for the current project. Run once per project to write the override self-check rules into the project's CLAUDE.md. After running, /superpowers:brainstorming and other superpowers skills will automatically trigger their overrides without any global ~/.claude/CLAUDE.md configuration.
---

# superpowers-overrides: init

Write the override self-check rules into the current project's CLAUDE.md.

## Steps

1. Locate the target CLAUDE.md:
   - **Default**: use `CLAUDE.md` at the project root (the current working directory). Create if missing.
   - **Only if the user explicitly says** "add to global" or "add to system prompt" or "~/.claude/CLAUDE.md": use `~/.claude/CLAUDE.md` instead.
   - Do NOT use `.claude/CLAUDE.md` — project-root `CLAUDE.md` is the standard location.

2. Check if the override block already exists (search for `superpowers-overrides self-check`). If found, report "already initialized" and stop.

3. Write the block to the file:
   - If the file is **empty or does not exist**: write the block as the entire file content.
   - If the file **already has content**: prepend the block at the very top, followed by a blank line, then the existing content. Do NOT append to the end.

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

4. Report the path where the block was written and instruct the user to run `/reload-mcp` or restart the session for the rules to take effect.
