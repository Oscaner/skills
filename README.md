# oscaner-skills

[English](README.md) | [中文](README.zh-CN.md)

[![CI](https://github.com/Oscaner/skills/actions/workflows/ci.yml/badge.svg)](https://github.com/Oscaner/skills/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@oscaner-skills/osuperpowers?label=osuperpowers)](https://www.npmjs.com/package/@oscaner-skills/osuperpowers)
[![npm](https://img.shields.io/npm/v/@oscaner-skills/osuperpowers-router?label=osuperpowers-router)](https://www.npmjs.com/package/@oscaner-skills/osuperpowers-router)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Personal AI coding skills marketplace. Five plugins, one pipeline -- works across **Claude Code**, **Cursor**, **Droid**, **Pi**, **Grok**, **Qoder**, **Codex**, and **Gemini**.

## What this is

A plugin marketplace that packages personal skills as installable plugins consumed by multiple AI coding harnesses. Content is Markdown + JSON, discovered at runtime via the marketplace/plugin manifest chain. First-party plugins under `packages/` form a pnpm workspace (changesets, CI, unified `pnpm run emit` build).

The pipeline flow:

```
Spec --> Plan --> SDD/TDD --> Verify --> Ship
```

## Plugins

| Plugin | Type | Description |
|--------|------|-------------|
| **[osuperpowers](packages/osuperpowers/)** | First-party | Skills (`os-*` orchestrators, `cli-*` family), CDD engine, cross-harness gate (11 adapters) |
| **[osuperpowers-router](packages/osuperpowers-router/)** | First-party | Trigger router -- intercepts upstream triggers and routes to osuperpowers / mattpocock targets |
| **[superpowers](vendors/superpowers/)** | Vendored | Upstream workflow skills -- brainstorming, writing plans, SDD, verification, branch finish |
| **[mattpocock-skills](vendors/mattpocock-skills/)** | Vendored | Precision tools -- `grilling`, `tdd`, `to-tickets` |
| **[impeccable](vendors/impeccable/)** | Vendored | Frontend design skills |

All plugins are published as scoped npm packages under `@oscaner-skills/*`.

## Installation

### From marketplace (recommended)

```bash
# Claude Code
/plugin marketplace add oscaner/skills
/plugin install osuperpowers@oscaner
/plugin install osuperpowers-router@oscaner
/plugin install superpowers@oscaner
/plugin install mattpocock-skills@oscaner
```

### From npm

```bash
npm install @oscaner-skills/osuperpowers @oscaner-skills/osuperpowers-router
npm install @oscaner-skills/superpowers @oscaner-skills/mattpocock-skills @oscaner-skills/impeccable
```

### Per-harness install

| Harness | Channel | Install method |
|---------|---------|---------------|
| Claude Code | install-and-use | marketplace install |
| Cursor Agent | install-and-use | marketplace install |
| Droid | install-and-use | copy skills to `.agents/skills/` |
| Grok | install-and-use | marketplace install (Claude compat) |
| Qoder | install-and-use | install plugin |
| Codex | install-and-use | install plugin + `/hooks` trust |
| Gemini | install-and-use | `gemini extensions install <repo-url>` |
| Pi | install-and-use | `pi install npm:@oscaner-skills/osuperpowers` |
| Trae | init | `init harness trae` |
| Vibe | init | `init harness vibe` |
| Kiro | init | `init harness kiro` |
| OpenCode | init | `init harness opencode` |

Full per-harness details: [docs/gate-install.md](docs/gate-install.md).

## Quick start

1. Install plugins from the marketplace or npm (see above).
2. Run **`init router`** once per project -- re-run after plugin upgrades. This initializes the override trigger table in your project's CLAUDE.md / Cursor rules.
3. Invoke the superpowers workflow as you normally would -- the router routes to the matching osuperpowers / mattpocock target automatically.

## Architecture

The marketplace is **package-as-source** -- metadata lives in each `package.json`'s `oscaner-plugin` field. The build step `pnpm run emit` derives everything from that:

```
package.json#oscaner-plugin --> emit --> marketplace/source.json
                                     --> .claude-plugin/marketplace.json
                                     --> .cursor-plugin/marketplace.json
                                     --> per-plugin .claude-plugin/plugin.json
                                     --> hooks files (per harness)
```

No hand-registration needed for first-party plugins. Vendored plugins are assembled from `vendors/` submodules via `scripts/lib/publish-vendor.mjs`.

Full architecture: [CLAUDE.md](CLAUDE.md).

## Per-package docs

- [packages/osuperpowers/](packages/osuperpowers/) -- skills, CDD engine, gate
- [packages/osuperpowers-router/](packages/osuperpowers-router/) -- router targets, enforcement layers
- [docs/gate-install.md](docs/gate-install.md) -- per-harness gate installation

## Development

### Common operations

```bash
# After editing any plugin manifest or skills
pnpm run emit && pnpm run validate

# Fresh clone -- init submodules
git submodule update --init

# Bump a vendored submodule
git -C vendors/mattpocock-skills fetch --tags origin
git -C vendors/mattpocock-skills checkout v1.1.0
git add vendors/mattpocock-skills
git commit -m "chore: bump mattpocock-skills submodule"
```

### Adding a new first-party plugin

1. Create `packages/<name>/package.json` with the `oscaner-plugin` field.
2. Run `pnpm run emit` -- it auto-discovers the plugin and regenerates all manifests.
3. Add a changeset naming it -- released as `@oscaner-skills/<name>`.

No hand registration needed. See [CLAUDE.md](CLAUDE.md) for full details.

### Branch flow

`develop` is the integration branch. Day-to-day PRs merge there. Production releases go through `develop --> main`. Version PRs, git tags, and GitHub Releases run on `main` only.

Release process: [`.changeset/README.md`](.changeset/README.md).

## License

First-party code (`osuperpowers`, `osuperpowers-router`, marketplace tooling): [MIT](LICENSE).

Vendored plugins keep their own licenses -- see each plugin directory.
