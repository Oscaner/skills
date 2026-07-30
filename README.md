# oscaner

[![CI](https://github.com/Oscaner/skills/actions/workflows/ci.yml/badge.svg)](https://github.com/Oscaner/skills/actions/workflows/ci.yml)

Personal [Claude Code](https://claude.com/claude-code) plugin marketplace. Packages skills as installable plugins — Markdown + JSON manifests, plus pnpm/changesets for `superpowers-overrides` releases and CI validation.

## Installation

```bash
# In Claude Code
/plugin marketplace add oscaner/skills
/plugin install mattpocock-skills@oscaner
/plugin install superpowers@oscaner
/plugin install superpowers-overrides@oscaner
```

Cloning this repo requires initializing the `mattpocock-skills` submodule:

```bash
git clone https://github.com/Oscaner/skills.git
cd skills
git submodule update --init
```

Bump submodule later: `git submodule update --remote mattpocock-skills` and commit with `chore:`.

## Plugins

### [mattpocock-skills](plugins/mattpocock-skills/)

Vendored submodule tracking [`mattpocock/skills`](https://github.com/mattpocock/skills). Re-exported so overrides can delegate to `mattpocock-skills:grilling`, `tdd`, `to-tickets`.

### [superpowers-overrides](plugins/superpowers-overrides/)

Personal overrides for upstream [`superpowers`](https://github.com/obra/superpowers). Each `spor-*` skill intercepts a matching `superpowers:*` skill and runs **first** — replacing or delegating behavior. See [CLAUDE.md](CLAUDE.md) for the full override table and contributor pattern.

## Quick start

1. Install `superpowers` + `superpowers-overrides` from the marketplace (see [Installation](#installation)).
2. Run **`/spor-init`** once per project (Claude Code: `/superpowers-overrides:spor-init`) — writes override self-check rules to the project.
3. Use upstream commands as normal — overrides fire automatically:
   - Claude Code: `/superpowers:brainstorming`, `/superpowers:writing-plans`, …
   - Cursor: `/spor-brainstorming`, `/spor-writing-plans`, …

**Cursor:** Team Marketplace import + discovery fallback — [cross-harness-overrides.md](plugins/superpowers-overrides/docs/cross-harness-overrides.md). Smoke checklist: [CURSOR-SMOKE.md](plugins/superpowers-overrides/docs/CURSOR-SMOKE.md).

## Common override skills

| Skill | Overrides | Notes |
|---|---|---|
| `spor-init` | — | Project wiring via `/spor-init` |
| `spor-brainstorming` | `superpowers:brainstorming` | Grilling + subagent spec review |
| `spor-writing-plans` | `superpowers:writing-plans` | Section writes + local tickets |
| `spor-subagent-driven-development` | `superpowers:subagent-driven-development` | Complexity-based review rounds |

Full list: [CLAUDE.md](CLAUDE.md) and [cross-harness-overrides.md](plugins/superpowers-overrides/docs/cross-harness-overrides.md).

## Repository layout

```
marketplace/source.json              # canonical registry (human-edited)
.claude-plugin/marketplace.json    # generated — Claude Code
.cursor-plugin/marketplace.json    # generated — Cursor Team Marketplace
cursor-plugins/                    # generated Cursor wrappers
plugins/<plugin>/                  # plugin trees
```

Edit [marketplace/source.json](marketplace/source.json), then `pnpm run emit && pnpm run validate`.

## Enforcement

Overrides are enforced by three layers: each skill's four-trigger `description`, a `UserPromptExpansion` hook on `/superpowers:*` slash commands, and project rules written by **`/spor-init`** (`.cursor/rules/superpowers-overrides.mdc` in Cursor; `CLAUDE.md` self-check in Claude Code). Re-run init after plugin upgrades to refresh version stamps.

Harness details: [cross-harness-overrides.md](plugins/superpowers-overrides/docs/cross-harness-overrides.md).

## Maintainers

After editing override skills, manifest, or generators:

```bash
pnpm run generate:overrides
pnpm run emit
pnpm run validate
```

Release workflow: [.changeset/README.md](.changeset/README.md).

## Releasing

Only `superpowers-overrides` is versioned. Tags: `superpowers-overrides@{superpowers-version}-overrides.{N}`.

| Change | What to do |
|--------|------------|
| Overrides skill / manifest / build | `pnpm changeset` → PR → merge Version PR → tag |
| Superpowers submodule bump | Update pointer + `marketplace/source.json` → `pnpm run emit` → PR |

Changelog: [plugins/superpowers-overrides/CHANGELOG.md](plugins/superpowers-overrides/CHANGELOG.md).

## Contributing

New override rules go inside the override skill as `Rule N`. New override skills follow the pattern in [CLAUDE.md#the-overrides-pattern-superpowers-overrides](CLAUDE.md#the-overrides-pattern-superpowers-overrides).

## License

Personal use. No warranty. Adapt freely for your own setup.
