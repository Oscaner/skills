<!-- penf ship smoke: pending manual run -->

# Cursor Manual Smoke Checklist

Run after installing plugins from the `oscaner` marketplace.

Reference: [cross-harness-overrides.md](./cross-harness-overrides.md) · Install path: [MIGRATION-pack-single-layer.md](./MIGRATION-pack-single-layer.md)

**Install topology (pack):** Cursor reads hooks from `plugins/superpowers-overrides/.cursor-plugin/plugin.json` at plugin root (single-layer contentRoot). No `cursor-plugins/superpowers-overrides/` wrapper.

## Blocking — penf ship gate (D2 / D4)

All items must pass before penf is considered shipped. Check tool trace in agent panel **and** Settings → Hooks → Execution Log.

- [ ] Settings → Hooks shows `superpowers-overrides` **`beforeSubmitPrompt`** + **`preToolUse`**
- [ ] `/brainstorming` → wrong first tool **denied**; `Read` (spor SKILL path) or `Skill` (`superpowers-overrides:spor-brainstorming`) **allowed**
- [ ] `/spor-brainstorming` → detect + enforce path works (pending written; valid first tool clears it)
- [ ] Prompt containing `superpowers:brainstorming` → detect fires (check Execution Log / pending file under `$TMPDIR/oscaner-superpowers-overrides/pending/`)
- [ ] Attach upstream `brainstorming/SKILL.md` — repo path `plugins/superpowers/skills/brainstorming/SKILL.md` **or** plugin cache path (e.g. `~/.cursor/plugins/cache/.../superpowers/.../skills/brainstorming/SKILL.md`) → detect fires
- [ ] Attach via `.cursor/skills/brainstorming/SKILL.md` → detect fires
- [ ] **`git status`** in consumer project shows **no** new `.cursor/hooks.json` (hooks are plugin-bundled only)
- [ ] Claude Code `/brainstorming` expansion contains **`MANDATORY OVERRIDE`**

### First-tool contract

Valid first tool after detect: **`Read`** with path ending in `/spor-<slug>/SKILL.md`, or **`Skill`** with `superpowers-overrides:spor-<slug>`. Any other first tool (Grep, Shell, Write, Read upstream SKILL, etc.) must be **denied** with MANDATORY OVERRIDE message.

> **Cursor payload note:** `preToolUse` Read input uses `tool_input.file_path` (not `.path`). Enforce accepts either field.

### `conversation_id` note (deferred finding)

Detect and enforce resolve pending via the **same** `session_key`: `conversation_id` ?? `session_id` ?? `sha256(prompt)[:16]`. When smoke-testing, confirm in Hook Execution Log that **both** hooks receive the same `conversation_id` on the same turn. If `preToolUse` stdin lacks `conversation_id` (and no `session_id` fallback), enforce will not find the pending file written by detect → enforcement silently allows. File a Cursor bug if observed; rules self-check remains fallback.

After completing this blocking run, replace the HTML comment at the top with: `<!-- penf ship smoke: YYYY-MM-DD by <name> -->`.

## Blocking — pack topology (after marketplace refresh)

Lightweight checklist after pack single-layer migration. Full penf scenarios unchanged above.

- [ ] Settings → Hooks still shows `superpowers-overrides` **`beforeSubmitPrompt`** + **`preToolUse`** after marketplace refresh
- [ ] Sample `/brainstorming` → detect/enforce still works
- [ ] Claude Code plugin cache tree includes `.cursor-plugin/` + `.codex-plugin/` under overrides

Record in [MIGRATION-pack-single-layer.md](./MIGRATION-pack-single-layer.md) footer when done.

## Known limitation (marketplace co-install)

When `superpowers` + `superpowers-overrides` are co-installed from marketplace **without** project `.cursor/skills/` copy, Cursor shows **Skills 3** (cross-cutting only). Override targets are deduped. **Opaque id / description changes do not fix this.** Use project copy (below) or `/spor-init` (when auto-copy ships).

## Team Marketplace install (primary)

- [ ] Admin imports `https://github.com/Oscaner/skills` in Dashboard → Settings → Plugins → Team Marketplaces
- [ ] Member installs all needed plugins from Customize → Plugins (`superpowers`, `superpowers-overrides`, etc.)
- [ ] Cursor Dashboard lists four plugins after import
- [ ] With project `.cursor/skills/` copy: agent skills list shows **13** `spor-*` skills
- [ ] `/spor-brainstorming` attaches override skill
- [ ] Run `/spor-init` → `.cursor/rules/superpowers-overrides.mdc` exists
- [ ] `/superpowers:brainstorming` or attached upstream → agent invokes `spor-brainstorming` first (check tool trace)

## Discovery fallback (required for co-install today)

Copy override skills into the project:

- [ ] Copy from `plugins/superpowers-overrides/skills/*` into project `.cursor/skills/`
- [ ] Copy upstream from `plugins/superpowers/skills/*` into project `.cursor/skills/` (if needed)
- [ ] Repeat skill list and `/spor-brainstorming` checks above

## Claude Code regression

- [ ] `/superpowers:brainstorming` → `Skill(superpowers-overrides:spor-brainstorming)` first
- [ ] `/brainstorming` (bare) → expansion contains `MANDATORY OVERRIDE`

After editing override skills, manifest, or generators:

```bash
pnpm run generate:overrides   # when manifest or templates change
pnpm run emit
pnpm run validate
```

## Post-release smoke

After merging a Version PR:

- [ ] Git tag exists: `superpowers-overrides@{version}` (e.g. `superpowers-overrides@6.2.0-overrides.6`)
- [ ] `marketplace/source.json` and emitted `.claude-plugin/marketplace.json` `superpowers-overrides.version` match the tag version
- [ ] `plugins/superpowers-overrides/CHANGELOG.md` entry exists for that version
