# Cross-Harness Skill Overrides

Portable convention for marketplace plugins that ship **override skills** with the same canonical name as an upstream plugin.

Design spec: [docs/superpowers/specs/2026-07-29-cross-harness-skill-overrides-design.md](../../docs/superpowers/specs/2026-07-29-cross-harness-skill-overrides-design.md) (in-repo clone path; adjust if your marketplace layout differs).

## Problem

| Harness class | Identity | Same `name` from two plugins |
|---------------|----------|------------------------------|
| Claude Code / Grok (plugin mode) | `plugin:skill` namespace | Both visible |
| Flat namespace (Cursor, Codex, Copilot, …) | Folder + frontmatter `name` | **Dedup** — one hidden |

Override plugins that reuse upstream skill names work in Claude Code but break in Cursor when both plugins are installed.

## Solution (v1 — Cursor)

1. **Canonical source** — keep override content in `skills/<slug>/` with upstream-matching `name` (Claude Code semantic).
2. **Manifest** — declare override targets in `overrides.manifest.json`.
3. **Build emit** — generate `.cursor/skills/{slug}-overrides/` with rewritten frontmatter.
4. **Enforcement** — slash `/brainstorming-overrides` + project rules from `init` (`render-rules.sh` → `.cursor/rules/superpowers-overrides.mdc`).

**CI / release emit:** PR CI runs `ENABLE_EMIT_FRESH_CHECK=1` (regenerates `.cursor/skills/` and fails if committed output is stale). The release workflow runs `emit-overrides.sh` again during version bump. Contributors should run emit locally before opening a PR.

Claude Code path is unchanged: hooks + project `CLAUDE.md` self-check + `Skill(superpowers-overrides:<slug>)`.

## Manifest schema

**File:** `overrides.manifest.json`

```json
{
  "$schema": "./build/overrides-manifest.schema.json",
  "plugin": "superpowers-overrides",
  "targets": [
    {
      "slug": "brainstorming",
      "overrides": "superpowers:brainstorming",
      "source": "./skills/brainstorming"
    }
  ]
}
```

| Field | Description |
|-------|-------------|
| `plugin` | Override plugin namespace name |
| `slug` | Canonical skill directory name |
| `overrides` | Upstream `plugin:skill` id |
| `source` | Path to canonical `SKILL.md` directory |

**Derived at build time:** flat name = `{slug}-overrides`.

## Naming rule

Flat-namespace output **always** uses `{slug}-overrides` for conflict targets. Cross-cutting skills with no upstream name collision keep their original names.

## Build commands

```bash
./superpowers-overrides/build/emit-overrides.sh
./superpowers-overrides/tests/validate-overrides-build.sh
```

Regenerate after editing canonical `skills/<slug>/SKILL.md` files.

## Plugin discovery fallback (Cursor)

Skills ship under `superpowers-overrides/.cursor/skills/` in the plugin tree. After marketplace install, verify both upstream and override skills appear in the agent skills list (e.g. `brainstorming` and `brainstorming-overrides`).

If override skills are missing:

1. Disable **Include third-party Plugins, Skills, and other configs** if `.claude/skills/` scanning causes dedup, or
2. Copy or symlink plugin `.cursor/skills/*` into the project `.cursor/skills/`:

```bash
mkdir -p .cursor/skills
cp -R path/to/superpowers-overrides/.cursor/skills/* .cursor/skills/
```

## Cursor setup

1. Install `superpowers` + `superpowers-overrides` from the marketplace.
2. Run init in Cursor (writes `.cursor/rules/superpowers-overrides.mdc`).
3. Invoke `/brainstorming-overrides` directly, or use upstream slash commands and rely on rules intercept.

Manual verification: [CURSOR-SMOKE.md](./CURSOR-SMOKE.md).

## Deferred harnesses (documented, not built in v1)

| Harness | Rules output (future) |
|---------|----------------------|
| Codex / Copilot / Mistral Vibe | `AGENTS.md` section |
| Gemini CLI | `.gemini/GEMINI.md` |
| OpenCode / Pi / Qoder / Rovo / Kiro | Per harness config file |

See [impeccable/docs/HARNESSES.md](../../impeccable/docs/HARNESSES.md) for directory mappings.

## Adoption guide (third-party marketplaces)

1. **Manifest** — add `overrides.manifest.json` listing each `slug`, upstream `overrides` id, and `source` path.
2. **Build emit** — copy canonical skills to flat-namespace dirs; rewrite frontmatter `name` to `{slug}-overrides`; commit generated output.
3. **Rules / init** — render a self-check rules file from the manifest; teach `init` to write it per harness.

Copy JSON schema, `emit-overrides.sh`, and `validate-overrides-build.sh` from this plugin as a starting point.

## Phase 2 (not v1)

- NL keyword interception in rules self-check
- Emit rules for Codex / Copilot / Gemini from the same manifest
- Agent Skills spec proposal for `overrides` / `extends` frontmatter
- Cursor product request for native `plugin:skill` namespace
