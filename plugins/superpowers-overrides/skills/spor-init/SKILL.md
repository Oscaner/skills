---
name: spor-init
description: Initialize or refresh superpowers-overrides wiring for the current project. Claude Code writes/replaces the override self-check block in CLAUDE.md; Cursor writes/replaces .cursor/rules/superpowers-overrides.mdc. Re-run after plugin upgrade to sync stale rules. Trigger on `/spor-init` or `/superpowers-overrides:spor-init`. After running, superpowers skills automatically trigger their overrides without global ~/.claude configuration.
---

# superpowers-overrides: init

Write override self-check rules into the current project for your harness.

## Harness detection

- If the user is in **Cursor** (`.cursor/` exists in the project OR the user says "cursor" / "for Cursor"): follow **Cursor init** below.
- Otherwise: follow **Claude Code init** below.

## Cursor init

1. Locate plugin root: derive from this skill's `fullPath` in `<agent_skills>` (strip `/skills/spor-init/SKILL.md` suffix), or use the in-repo path `plugins/superpowers-overrides/` when working in the marketplace clone.
2. Read **installed version** from `{plugin_root}/.claude-plugin/plugin.json` → field `version`.
3. Read `{plugin_root}/build/generated/cursor-self-check.mdc` as **canonical** (its frontmatter `superpowers-overrides-version` must match installed version). Do **not** run generators at init time.
4. Compare with `.cursor/rules/superpowers-overrides.mdc` (create `.cursor/rules/` if missing):
   - **Missing file** → write canonical; report **initialized** (`v{installed}`).
   - **Parse project version** from frontmatter `superpowers-overrides-version:` (missing = legacy/unversioned).
   - **project version missing** OR **project version ≠ installed version** → overwrite with canonical; report **updated** (`v{old or none}` → `v{installed}`).
   - **project version = installed version** → report **already up to date** (`v{installed}`) and stop.
5. Report the exact path written or confirmed. Remind the user:
   - Requires both `superpowers` and `superpowers-overrides` installed from the marketplace.
   - Use `/spor-brainstorming` (etc.) or bare upstream slash commands. Cursor: plugin-bundled hooks (`beforeSubmitPrompt` + `preToolUse`) enforce overrides; rules are fallback. Claude Code: UserPromptExpansion hooks. **Do not** install project `.cursor/hooks.json`.
   - If override skills are not in the agent skills list after install, copy from `{plugin_root}/skills/` into the project `.cursor/skills/` (see plugin README).
   - Rules take effect in the **next Cursor session** (or after reloading the window).

## Claude Code init

Write the override self-check rules into the current project's CLAUDE.md.

1. Locate plugin root: derive from this skill's `fullPath` in `<agent_skills>` (strip `/skills/spor-init/SKILL.md` suffix), or use the in-repo path `plugins/superpowers-overrides/` when working in the marketplace clone.

2. Locate the target CLAUDE.md:
   - **Default**: use `CLAUDE.md` at the project root (the current working directory). Create if missing.
   - **Only if the user explicitly says** "add to global" or "add to system prompt" or "~/.claude/CLAUDE.md": use `~/.claude/CLAUDE.md` instead.
   - Do NOT use `.claude/CLAUDE.md` — project-root `CLAUDE.md` is the standard location.

3. Read **installed version** from `{plugin_root}/.claude-plugin/plugin.json` → field `version`.

4. Read `{plugin_root}/build/generated/claude-self-check.md` as **canonical** (first line must be `<!-- superpowers-overrides-version: {installed} -->`). Do **not** run generators at init time.

5. If the target CLAUDE.md **does not exist**: stop. Tell the user to run the project's base `/init` first to generate `CLAUDE.md`, then re-run `/superpowers-overrides:spor-init`.

6. If an override block already exists (search for `## superpowers-overrides self-check`):
   - **Parse project version** from the HTML comment `<!-- superpowers-overrides-version: … -->` immediately above the block (missing = legacy/unversioned).
   - **project version missing** OR **project version ≠ installed version** → replace the entire block (from the version comment or `## superpowers-overrides self-check` through the line before the next top-level `# ` heading, or EOF) with canonical; report **updated** (`v{old or none}` → `v{installed}`).
   - **project version = installed version** → report **already up to date** (`v{installed}`) and stop.

7. If no block exists, find the insertion point — read the existing file first:
   - If there is a section about Skills, AI behavior, Claude, or agent configuration (e.g. `## Skills`, `## AI`, `## Claude`, `## Agent`, `## Workflow`): insert the block inside or immediately after that section.
   - Otherwise: insert immediately after the top-level title line (e.g. `# CLAUDE.md`), before the first section heading. Do NOT insert before the title.
   - Insert canonical contents with blank line separators around it; report **initialized** (`v{installed}`).

8. Report the exact path and section where the block was written or confirmed. Remind the user that **CLAUDE.md rules take effect on the next session** — start a new Claude Code session (or run `/reload-plugins`) for the self-check to activate.
