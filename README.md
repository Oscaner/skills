# oscaner

[English](README.md) | [简体中文](README.zh-CN.md)

[![CI](https://github.com/Oscaner/skills/actions/workflows/ci.yml/badge.svg)](https://github.com/Oscaner/skills/actions/workflows/ci.yml)

*Combine superpowers' full workflow with mattpocock's precision — engineered via superpowers-overrides + engineering.*

Personal [Claude Code](https://claude.com/claude-code) plugin marketplace. Four plugins work together as one pipeline: brainstorm, plan, build, ship.

## Why this exists

**[Superpowers](https://github.com/obra/superpowers)** is the full stack — brainstorming, writing plans, subagent-driven development, verification, branch finish. One library, end to end.

**[mattpocock-skills](vendors/mattpocock-skills/)** is the precision layer — `grilling` for hard questions, `tdd` for implementation, `to-tickets` for slicing work. Small surface, sharp tools.

Neither alone told me *when* to delegate, *how* to review specs, or *how to phase* a large feature. **superpowers-overrides** is the **trigger router** — it ships no skill bodies. It intercepts upstream superpowers triggers (slash commands, SKILL attach) and routes them to the matching **engineering** orchestrator (`os-*`) or a **mattpocock-skills** delegate (`tdd`, `grilling`). The `os-*` orchestrators add personal rules on top of the upstream baseline — grilling for clarification, fresh-subagent spec review, and **overall + phase** decomposition for large scope.

**[engineering](packages/engineering/)** is the **skill + engine + gate** layer — the `os-*` orchestrators (`os-brainstorming`, `os-writing-plans`, `os-executing-plans`, …) and `cli-*` family (`cli-select`, `cli-task`, `cli-driven-development`, `cli-code-review`) running on the cdd engine with per-harness registry detection, plus the cross-harness CDD orchestrator gate (Node core + 11 harness adapters — per-harness install → [docs/gate-install.md](docs/gate-install.md)).

## Plugins

Five plugins are registered in the marketplace. Two are **first-party** (edited in-tree under `packages/`); three are **vendored** upstream submodules (never edited in-tree, pinned under `vendors/`):

| Plugin | Directory | npm package | Kind |
|--------|-----------|-------------|------|
| **superpowers-overrides** | [packages/superpowers-overrides/](packages/superpowers-overrides/) | `@oscaner-skills/superpowers-overrides` | First-party — trigger router |
| **engineering** | [packages/engineering/](packages/engineering/) | `@oscaner-skills/engineering` | First-party — skills + cdd engine + Node gate (11 adapters) |
| **superpowers** | [vendors/superpowers/](vendors/superpowers/) | `@oscaner-skills/superpowers` | Vendored upstream submodule |
| **mattpocock-skills** | [vendors/mattpocock-skills/](vendors/mattpocock-skills/) | `@oscaner-skills/mattpocock-skills` | Vendored upstream submodule |
| **impeccable** | [vendors/impeccable/](vendors/impeccable/) | `@oscaner-skills/impeccable` | Vendored upstream submodule |

First-party metadata lives in each `package.json`'s `oscaner-plugin` field (**package-as-source**): `pnpm run emit` derives `marketplace/source.json` from `packages/` + `vendors/` and regenerates every per-harness manifest. Vendored plugins are assembled by [`scripts/lib/publish-vendor.mjs`](scripts/lib/publish-vendor.mjs) — which owns `listVendors` (the `vendors/` dir scan) and the `ASSEMBLY_TEMPLATE` — plus the marketplace cursor blocks in [`scripts/lib/emit/source.mjs`](scripts/lib/emit/source.mjs) (`VENDOR_PLUGINS`). Adding a new first-party plugin is automatic — see [Adding a new first-party plugin](#adding-a-new-first-party-plugin).

### Hooks matrix

Hooks ship inside each plugin and activate only when the plugin is installed via the Claude Code / Cursor marketplace. The harness → path mapping is declared in `oscaner-plugin.hooks`; `pnpm run emit` writes each hooks file at the declared path.

| Plugin | Harness | Hooks file | Handlers |
|--------|---------|------------|----------|
| superpowers-overrides | Claude Code | `hooks/hooks.json` | `UserPromptExpansion` (2 matchers: `^superpowers:`, bare `/<slug>` combined regex) → `bin/prompt-expansion.mjs` |
| superpowers-overrides | Cursor | `hooks/hooks-cursor.json` | `beforeSubmitPrompt` → `bin/cursor-detect.mjs`; `preToolUse` → `bin/cursor-enforce.mjs` |
| engineering | Claude Code | `hooks/hooks.json` | `PreToolUse` (`Write`/`Edit`, `Bash`) → `bin/gate/adapters/claude.mjs` |
| engineering | Cursor | `hooks/hooks-cursor.json` | `preToolUse` → `bin/gate/adapters/cursor.mjs` |

Full enforcement model (detect/enforce, pending state, fail-open, shell allowlist) → [cross-harness-overrides.md](packages/superpowers-overrides/docs/cross-harness-overrides.md).

## The pipeline

```
Overall spec → Phase spec → Plan → SDD/TDD → Verify → Ship
```

Overrides add grilling and subagent review at design time; mattpocock handles grilling, tdd, and to-tickets via delegation.

Skill mapping and harness setup → [superpowers-overrides README](packages/superpowers-overrides/README.md).

## Installation

```bash
# In Claude Code
/plugin marketplace add oscaner/skills
/plugin install mattpocock-skills@oscaner
/plugin install superpowers@oscaner
/plugin install superpowers-overrides@oscaner
/plugin install engineering@oscaner
```

Clone this repo (submodule required for local development):

```bash
git clone https://github.com/Oscaner/skills.git
cd skills
git submodule update --init
```

### npm packages

Every plugin is also published as a scoped npm package under `@oscaner-skills/*` — first-party packages via changesets, vendored plugins republished by [`scripts/publish-vendor.mjs`](scripts/publish-vendor.mjs) (upstream LICENSE preserved). The packages carry the same `oscaner-plugin` metadata; hooks activate when the plugin is installed through the Claude Code / Cursor marketplace.

```bash
# First-party
npm install @oscaner-skills/superpowers-overrides @oscaner-skills/engineering
# Vendored republishes (upstream content)
npm install @oscaner-skills/superpowers @oscaner-skills/mattpocock-skills @oscaner-skills/impeccable
```

## Quick start

1. Install `superpowers`, `superpowers-overrides`, `engineering`, and `mattpocock-skills` from the marketplace.
2. Run **`os-init spor`** once per project — re-run after plugin upgrades. Slash command depends on your harness → [Usage](packages/superpowers-overrides/README.md#usage).
3. For the cross-harness CDD gate, install per-harness — **verified channels** (claude / cursor / grok / qoder / gemini via marketplace, trae / vibe / kiro via `os-init gates` native config) are install-and-go or native config; **experimental (manual steps)** (pi / opencode) are wired to their documented formats but need manual steps — pi ships as a manual extension copy; **codex** is wired to its documented plugin format but unverified against a live install. Per-harness install → [docs/gate-install.md](docs/gate-install.md).
4. Invoke the superpowers workflow as you normally would — the router routes to the matching engineering / mattpocock target first.

## Learn more

[superpowers-overrides README](packages/superpowers-overrides/README.md) — router targets, Claude Code vs Cursor, enforcement layers.

## Adding a new first-party plugin

The marketplace is **package-as-source** — a new first-party plugin auto-wires into the derivation, workspace, and release flow with no hand registration:

1. Create `packages/<name>/package.json` with the `oscaner-plugin` field (`contentRoot`, `harnesses`, optional `hooks`) — the single metadata source.
2. `pnpm run emit` derives `marketplace/source.json` from it ([`deriveFirstPartyNames`](scripts/lib/emit/manifests.mjs) scans `packages/*` for the field) and regenerates the marketplace documents.
3. `pnpm-workspace.yaml` (`packages/*`) picks it up automatically; a changeset naming it releases it as `@oscaner-skills/<name>` via [`scripts/version-packages.mjs`](scripts/version-packages.mjs).

Per-harness hooks: add the harness → path mapping under `oscaner-plugin.hooks`; emit writes the hooks file. `oscaner-plugin.harnesses` is **declarative-only / informational** — no script consumes it, and emit hardcodes the per-plugin manifest set. Adding a genuinely new harness manifest requires an emitter in [`scripts/emit.mjs`](scripts/emit.mjs) (see the caveat below). The per-plugin harness emission in [`scripts/emit.mjs`](scripts/emit.mjs) is currently bespoke for `engineering` and `superpowers-overrides` — a new plugin type needs its emitter added there (or its manifests committed so the cursor path assertions pass).

Vendoring an upstream plugin is the opposite path: add a `vendors/<name>` submodule — the vendor set is derived from the `vendors/` dir by `listVendors` — and wire the vendor's constants: `ASSEMBLY_TEMPLATE` in [`scripts/lib/publish-vendor.mjs`](scripts/lib/publish-vendor.mjs) (the assembly owner; `ASSEMBLY_TEMPLATE.contentRoot` is load-bearing — `deriveVendor`/`resolveVendorVersion` dereference it, so omitting it throws), `SUBMODULE_PATHS`/`TAG_PATTERNS` in [`scripts/lib/submodule-tags.mjs`](scripts/lib/submodule-tags.mjs), and `VENDOR_PLUGINS` in [`scripts/lib/emit/source.mjs`](scripts/lib/emit/source.mjs) (the marketplace cursor block). [`scripts/publish-vendor.mjs`](scripts/publish-vendor.mjs) assembles and republishes it.

## Maintainers

After editing overrides (or any first-party plugin manifest): `pnpm run emit && pnpm run validate`.

**Branch flow:** `develop` is the default integration branch — day-to-day PRs merge here and accumulate changesets. Production releases land on `main` only via a `develop → main` PR (enforced by CI and GitHub Rulesets). Version PRs, git tags, and GitHub Releases run on **`main`** only; an automated **`main → develop`** sync PR keeps `develop` aligned after release.

Release: [`.changeset/README.md`](.changeset/README.md). Contributor pattern: [`CLAUDE.md`](CLAUDE.md).

## License

First-party code (`superpowers-overrides`, `engineering`, marketplace tooling) is [MIT](LICENSE).

Vendored plugins keep their own licenses — see each plugin directory (e.g. `vendors/mattpocock-skills/LICENSE`).
