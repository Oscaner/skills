# Cross-Harness Skill Overrides

Portable convention for marketplace plugins that ship **override skills** alongside an upstream plugin.

Design specs:

- v2 (current): [docs/superpowers/specs/2026-07-30-unified-skill-naming-design.md](../../docs/superpowers/specs/2026-07-30-unified-skill-naming-design.md)
- v1 (superseded emit model): [docs/superpowers/specs/2026-07-29-cross-harness-skill-overrides-design.md](../../docs/superpowers/specs/2026-07-29-cross-harness-skill-overrides-design.md)

## Problem

| Harness class | Identity | Same `name` from two plugins |
|---------------|----------|------------------------------|
| Claude Code / Grok (plugin mode) | `plugin:skill` namespace | Both visible |
| Flat namespace (Cursor, Codex, Copilot, …) | Folder + frontmatter `name` | **Dedup** — one hidden |

Override plugins that reuse upstream skill names work in Claude Code but break in Cursor when both plugins are installed.

## Solution (v2 — unified tree)

One canonical tree under `skills/` serves Claude Code, Cursor marketplace, and manual copy:

1. **Canonical source** — override targets live in `skills/<name>/` where `<name>` ends with `-overrides` (e.g. `brainstorming-overrides`). Directory basename equals frontmatter `name`.
2. **Manifest** — declare targets in `overrides.manifest.json` with explicit `name`, `overrides`, and `source` fields.
3. **Generators** — manifest-driven scripts write committed hook + self-check artifacts (`build/generated/*`, `bin/override-prompt-expansion.sh`).
4. **Enforcement** — Claude hooks + project `CLAUDE.md` self-check; Cursor project rules from init + `/brainstorming-overrides` slash commands.

No `.cursor/skills/` emit duplicate. No frontmatter rewrite at build time.

**CI:** `pnpm run validate:overrides` checks generator drift; `tests/validate-overrides-build.sh` validates the canonical tree.

Claude Code interception: `Skill(superpowers-overrides:brainstorming-overrides)` (manifest `name` field).

## Manifest schema

**File:** `overrides.manifest.json`

```json
{
  "$schema": "./build/overrides-manifest.schema.json",
  "plugin": "superpowers-overrides",
  "targets": [
    {
      "name": "brainstorming-overrides",
      "overrides": "superpowers:brainstorming",
      "source": "./skills/brainstorming-overrides"
    }
  ]
}
```

| Field | Description |
|-------|-------------|
| `plugin` | Override plugin namespace name |
| `name` | Canonical skill id in all harnesses (ends with `-overrides` for override targets) |
| `overrides` | Upstream `plugin:skill` id to intercept |
| `source` | Path to canonical skill directory |

**Upstream slug for trigger tables:** parse from `overrides` (`superpowers:brainstorming` → `brainstorming`).

## Naming rule

Override targets **always** use the `-overrides` suffix in directory name and frontmatter `name`. Cross-cutting skills with no upstream collision (`init`, `subagent-lifecycle`, `token-efficient-review-dispatch`) keep original names.

## Build commands

```bash
pnpm run generate:overrides    # write committed generator outputs
pnpm run validate:overrides    # --check drift
./plugins/superpowers-overrides/tests/validate-overrides-build.sh
```

Regenerate after editing `overrides.manifest.json` or generator templates.

## Plugin discovery fallback (Cursor)

Skills ship under `plugins/superpowers-overrides/skills/` in the plugin tree. After marketplace install, verify both upstream and override skills appear in the agent skills list (e.g. `brainstorming` and `brainstorming-overrides`).

If override skills are missing (Team Marketplace blocked or third-party import disabled):

```bash
mkdir -p .cursor/skills
cp -R path/to/plugins/superpowers-overrides/skills/* .cursor/skills/
cp -R path/to/plugins/superpowers/skills/* .cursor/skills/   # upstream, separate plugin
```

Then run init for `.cursor/rules/superpowers-overrides.mdc`.

## Cursor setup

1. Install `superpowers` + `superpowers-overrides` from the marketplace.
2. Run init in Cursor (copies `build/generated/cursor-self-check.mdc` → `.cursor/rules/superpowers-overrides.mdc`).
3. Invoke `/brainstorming-overrides` directly, or use upstream slash commands and rely on rules intercept.

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
2. **Naming** — use explicit `-overrides` suffix on conflict targets; one tree for all harnesses.
3. **Generators** — share `manifest_targets.py`; commit hook + self-check outputs; CI `--check` on drift.
4. **Init** — copy committed `build/generated/*` at runtime; never run generators in init.

Copy JSON schema, generator scripts, and `validate-overrides-build.sh` from this plugin as a starting point.

## Phase 2 (not v1)

- NL keyword interception in rules self-check
- Emit rules for Codex / Copilot / Gemini from the same manifest
- Agent Skills spec proposal for `overrides` / `extends` frontmatter
- Cursor product request for native `plugin:skill` namespace
