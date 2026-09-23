# oscaner-skills

[English](README.md) | [Simplified Chinese](README.zh-CN.md)

[![PR Validate](https://github.com/Oscaner/skills/actions/workflows/pr-validate.yml/badge.svg)](https://github.com/Oscaner/skills/actions/workflows/pr-validate.yml)
[![npm](https://img.shields.io/npm/v/@oscaner-skills/osuperpowers?label=osuperpowers)](https://www.npmjs.com/package/@oscaner-skills/osuperpowers)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Personal AI coding skills marketplace. First-party plugins + upstream integrations, one pipeline — consumable across multiple AI coding harnesses (verified on **Claude Code** and **Cursor Agent**).

## What this is

A marketplace that packages personal AI coding skills as installable plugins consumed by multiple AI coding harnesses. First-party plugins live in this repository under `packages/` and are published by us to npm under the `@oscaner-skills/*` scope; upstream plugins are **not** packaged here — they install from their own publishers, and osuperpowers orchestrators read them through `/`-prefixed `plugin:skill` references (e.g. `/superpowers:brainstorming`).

## Plugins

| Plugin | Version | Source |
|--------|---------|--------|
| **osuperpowers** | 0.1.1 | First-party — [this repo](https://github.com/Oscaner/skills), [`packages/osuperpowers/`](packages/osuperpowers/), published as [`@oscaner-skills/osuperpowers`](https://www.npmjs.com/package/@oscaner-skills/osuperpowers). Skills (osuperpowers orchestrators, `cli-*` family) plus the CDD engine |
| **superpowers** | — | Upstream — [obra/superpowers](https://github.com/obra/superpowers). Workflow skills: brainstorming, writing plans, verification, branch finish |
| **mattpocock-skills** | — | Upstream — [mattpocock/skills](https://github.com/mattpocock/skills). Precision tools: `grilling`, `tdd` |
| **impeccable** | — | Upstream — [pbakaus/impeccable](https://github.com/pbakaus/impeccable). Frontend design skills |

Upstream plugin versions follow their own release schedules and are not tracked in this marketplace — always install them from their own publishers (see [Installation](#installation)).

## Installation

### From the marketplace (recommended)

```bash
# Claude Code
/plugin marketplace add oscaner/skills
/plugin install osuperpowers@oscaner-skills
```

### From npm

```bash
npm install @oscaner-skills/osuperpowers
```

### Upstream plugins

Upstream plugins (superpowers / mattpocock-skills / impeccable) are not packaged here — install each from its own publisher via its official command (marked **Upstream** in the [Plugins](#plugins) table, linked to their GitHub home repos).

### Per-harness install

| Harness | Install method |
|---------|---------------|
| Claude Code | Marketplace install |
| Cursor Agent | Marketplace install |

osuperpowers installs through each harness's own plugin marketplace; neither Claude Code nor Cursor Agent needs a per-harness config file.

## Quick start

1. Install the plugins from the marketplace or npm (see [Installation](#installation)).
2. Make sure the `cdd` engine CLI is on `PATH` (`command -v cdd`); if it is missing, run `npm i -g @oscaner-skills/cdd-engine`. `cli-driven-development`'s `detect-engine` node re-checks this at dispatch.
3. Invoke the superpowers workflow as you normally would — osuperpowers skills intercept upstream triggers and route to the matching target automatically.

## Architecture

### Package layout

```
packages/
├── osuperpowers/   # first-party plugin: osuperpowers orchestration + cli-* family + CDD engine skills
└── cdd-engine/     # @oscaner-skills/cdd-engine — the CDD engine CLI package (dependency of osuperpowers)
```

### Package-as-source, one emit chain

The marketplace is **package-as-source** — metadata lives in each first-party `package.json`'s `oscaner-plugin` field. The build step `pnpm run emit` derives everything from that:

```
package.json#oscaner-plugin --> emit --> marketplace/source.json
                                     --> .claude-plugin/marketplace.json
                                     --> .cursor-plugin/marketplace.json
                                     --> per-plugin .claude-plugin/plugin.json
```

No hand-registration is needed for first-party plugins — `pnpm run emit` auto-discovers them.

Full architecture: [CLAUDE.md](CLAUDE.md).

## Per-package docs

- [`packages/osuperpowers/`](packages/osuperpowers/README.md) — the plugin's own guide: skill inventory, install, quick start, the `cdd` CLI harness table
- [`packages/cdd-engine/`](packages/cdd-engine/) — the CDD engine package source (maintained from this repo)
- [`docs/maintainers/`](docs/maintainers/README.md) — maintainer-only documentation index for this repository's developers

## Development

### Common operations

```bash
# After editing any plugin manifest or skills
pnpm run emit && pnpm run validate
```

### Adding a new first-party plugin

1. Create `packages/<name>/package.json` with the `oscaner-plugin` field.
2. Run `pnpm run emit` — it auto-discovers the plugin and regenerates all manifests.
3. Add a changeset naming it — it is released as `@oscaner-skills/<name>`.

No hand registration needed. See [CLAUDE.md](CLAUDE.md) for full details.

### Branch flow

`develop` is the integration branch — day-to-day PRs merge there. Production releases go through `develop --> main`. Version PRs, git tags, and GitHub Releases run on `main` only.

Release process: [`.changeset/README.md`](.changeset/README.md).

## License

First-party code (`osuperpowers`, marketplace tooling): [MIT](LICENSE).
