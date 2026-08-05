# Cross-Harness Skill Overrides

Portable convention for marketplace plugins that ship **override skills** alongside an upstream plugin.

Naming evolved across releases: v1 emit model → v2 `-overrides` suffix → v3 `spor-*` prefix (current). See [CHANGELOG.md](../CHANGELOG.md) entries `6.2.0-overrides.3` through `6.2.0-overrides.6`.

## Problem

| Harness class | Identity | Same `name` from two plugins |
|---------------|----------|------------------------------|
| Claude Code / Grok (plugin mode) | `plugin:skill` namespace | Both visible |
| Flat namespace (Cursor, Codex, Copilot, …) | Folder + frontmatter `name` | **Dedup** — one hidden |

Override plugins that reuse upstream skill names work in Claude Code but break in Cursor when both plugins are installed. The `-overrides` suffix (v2) was insufficient — Cursor still deduplicated against upstream names. v3 uses a plugin-level `spor-` prefix on every skill id.

## Solution (v3 — `spor-` prefix)

One canonical tree under `skills/` serves Claude Code, Cursor marketplace, and manual copy:

1. **Canonical source** — all skills live in `skills/spor-<slug>/` (e.g. `spor-brainstorming`). Directory basename equals frontmatter `name`.
2. **Manifest** — declare targets in `overrides.manifest.json` with explicit `name`, `overrides`, and `source` fields.
3. **Generators** — manifest-driven scripts write committed hook + self-check artifacts (`build/generated/*`, `bin/override-prompt-expansion.sh`).
4. **Enforcement** — harness-specific hooks + project self-check rules (see [Enforcement](#enforcement) below).

No `.cursor/skills/` emit duplicate. No frontmatter rewrite at build time.

**CI:** `pnpm run validate:overrides` checks generator drift; `tests/validate-overrides-build.sh` validates the canonical tree.

Claude Code interception: `Skill(superpowers-overrides:spor-brainstorming)` (manifest `name` field).

## Enforcement

Override-first is enforced by **plugin-bundled hooks** plus project self-check rules. Hooks ship with the plugin — **never** copy hook files into consumer projects.

### Cursor — detect + enforce (plugin-bundled)

**File:** `hooks/hooks-cursor.json` (declared in plugin-root `.cursor-plugin/plugin.json` → `"hooks": "./hooks/hooks-cursor.json"`).

| Hook | Handler | Role |
|------|---------|------|
| `beforeSubmitPrompt` (`UserPromptSubmit`) | `bin/override-cursor-detect.sh` | Match bare `/brainstorming`, `/spor-*`, `superpowers:*`, upstream SKILL attach paths → write pending state |
| `preToolUse` (no matcher) | `bin/override-cursor-enforce.sh` | If pending exists: **allow** first `Read` (spor SKILL path via `tool_input.path` or `tool_input.file_path`) or `Skill` (`superpowers-overrides:spor-*`); **deny** all other first tools |

Cursor cannot inject context on submit (no `additional_context` on `beforeSubmitPrompt`). Detect writes pending; enforce blocks wrong first tools.

**Pending state contract** (detect writes, enforce reads):

- Path: `$TMPDIR/oscaner-superpowers-overrides/pending/<session_key>.json`
- `session_key` = `conversation_id` ?? `session_id` ?? first 16 hex of `sha256(prompt)`
- Schema: `{"override":"spor-<slug>","detected_at":<unix>,"trigger":"bare-slash|prefixed|attach|spor-slash"}`
- TTL: **300s** — expired pending → enforce allows and deletes file
- Cleared when enforce allows a valid first tool

**`spor-init` does not install hooks** — only refreshes `.cursor/rules/superpowers-overrides.mdc`. Consumer `git status` must show **no** new `.cursor/hooks.json`.

### Claude Code — triple matcher + expansion

**File:** `hooks/hooks.json` — three `UserPromptExpansion` matchers (manifest-generated):

1. `^superpowers:` — prefixed upstream slash commands
2. Bare `/<upstream-slug>` — e.g. `/brainstorming`
3. `^/spor-<upstream-slug>` — e.g. `/spor-brainstorming`

All invoke `bin/override-prompt-expansion.sh`, which injects `additionalContext` containing **MANDATORY OVERRIDE** and the required `Skill(superpowers-overrides:spor-*)` first call.

Project `CLAUDE.md` self-check (from `/spor-init`) is fallback when hooks are unavailable.

### Self-check rules (both harnesses)

`/spor-init` writes committed generator output into the project:

- Cursor → `.cursor/rules/superpowers-overrides.mdc`
- Claude Code → `CLAUDE.md` override trigger table

Rules are **fallback only** on Cursor (hooks enforce). On both harnesses:

- **Anti-pattern:** manually attach upstream `superpowers/*/SKILL.md` body — attach **`spor-*`** or use slash commands instead; upstream SKILL full text in context still requires Read/Skill `spor-*` first.

Manual smoke: [CURSOR-SMOKE.md](./CURSOR-SMOKE.md).

## Manifest schema

**File:** `overrides.manifest.json`

```json
{
  "$schema": "./build/overrides-manifest.schema.json",
  "plugin": "superpowers-overrides",
  "targets": [
    {
      "name": "spor-brainstorming",
      "overrides": "superpowers:brainstorming",
      "source": "./skills/spor-brainstorming"
    }
  ]
}
```

| Field | Description |
|-------|-------------|
| `plugin` | Override plugin namespace name |
| `name` | Canonical skill id in all harnesses (starts with `spor-`) |
| `overrides` | Upstream `plugin:skill` id to intercept |
| `source` | Path to canonical skill directory |

**Upstream slug for trigger tables:** parse from `overrides` (`superpowers:brainstorming` → `brainstorming`).

## Naming rule

All skills in this plugin use the `spor-` prefix in directory name and frontmatter `name`:

- Override targets: `spor-{upstream-slug}` (e.g. `spor-brainstorming` overrides `superpowers:brainstorming`)
- Cross-cutting: `spor-init`, `spor-subagent-lifecycle`, `spor-token-efficient-review-dispatch`

Init entry point: `/spor-init` (Claude Code: `/superpowers-overrides:spor-init`).

## Build commands

```bash
pnpm run generate:overrides    # write committed generator outputs
pnpm run validate:overrides    # --check drift
./plugins/superpowers-overrides/tests/validate-overrides-build.sh
```

Regenerate after editing `overrides.manifest.json` or generator templates.

## Plugin discovery fallback (Cursor)

Skills ship under `plugins/superpowers-overrides/skills/` in the plugin tree. After marketplace install, verify all 13 `spor-*` skills appear in the agent skills list.

If override skills are missing (Team Marketplace blocked or third-party import disabled):

```bash
mkdir -p .cursor/skills
cp -R path/to/plugins/superpowers-overrides/skills/* .cursor/skills/
cp -R path/to/plugins/superpowers/skills/* .cursor/skills/   # upstream, separate plugin
```

Then run init for `.cursor/rules/superpowers-overrides.mdc`.

## Cursor setup

1. Install `superpowers` + `superpowers-overrides` from the marketplace.
2. Run `/spor-init` in Cursor (copies or refreshes `build/generated/cursor-self-check.mdc` → `.cursor/rules/superpowers-overrides.mdc`; re-run after plugin upgrade if rules are stale).
3. Invoke `/spor-brainstorming` directly, or use upstream slash commands — plugin hooks detect and enforce override-first; project rules are fallback only.

Manual verification: [CURSOR-SMOKE.md](./CURSOR-SMOKE.md).

## Deferred harnesses (documented, not built)

| Harness | Rules output (future) |
|---------|----------------------|
| Codex / Copilot / Mistral Vibe | `AGENTS.md` section |
| Gemini CLI | `.gemini/GEMINI.md` |
| OpenCode / Pi / Qoder / Rovo / Kiro | Per harness config file |

See [impeccable/docs/HARNESSES.md](../../impeccable/docs/HARNESSES.md) for directory mappings.

## Adoption guide (third-party marketplaces)

1. **Manifest** — add `overrides.manifest.json` with `name`, upstream `overrides` id, and `source` path per target.
2. **Naming** — use a plugin-level prefix on all skill ids to avoid flat-namespace dedup with upstream (e.g. `spor-*`, `terreno-*`, `cds-*`).
3. **Generators** — share `manifest_targets.py`; commit hook + self-check outputs; CI `--check` on drift.
4. **Init** — copy or refresh committed `build/generated/*` at runtime; never run generators in init. Generated self-check files embed `superpowers-overrides-version` (Cursor frontmatter / Claude HTML comment) stamped from `.claude-plugin/plugin.json`; `/spor-init` compares project rules against installed version and overwrites when missing or stale.

Copy JSON schema, generator scripts, and `validate-overrides-build.sh` from this plugin as a starting point.

## Phase 2 (not v1)

- NL keyword interception in rules self-check
- Emit rules for Codex / Copilot / Gemini from the same manifest
- Agent Skills spec proposal for `overrides` / `extends` frontmatter
- Cursor product request for native `plugin:skill` namespace
