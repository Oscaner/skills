# oscaner-skills

[English](README.md) | [中文](README.zh-CN.md)

[![PR Validate](https://github.com/Oscaner/skills/actions/workflows/pr-validate.yml/badge.svg)](https://github.com/Oscaner/skills/actions/workflows/pr-validate.yml)
[![npm](https://img.shields.io/npm/v/@oscaner-skills/osuperpowers?label=osuperpowers)](https://www.npmjs.com/package/@oscaner-skills/osuperpowers)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Personal AI coding skills marketplace. First-party plugins + upstream integrations, one pipeline -- consumable across multiple AI coding harnesses (verified on **Claude Code** and **Cursor Agent**).

## What this is

A plugin marketplace that packages personal skills as installable plugins consumed by multiple AI coding harnesses. Content is Markdown + JSON, discovered at runtime via the marketplace/plugin manifest chain. First-party plugins under `packages/` form a pnpm workspace (changesets, CI, unified `pnpm run emit` build).

The pipeline flow:

```
Spec --> Plan --> SDD/TDD --> Verify --> Ship
```

## Plugins

| Plugin | Type | Description |
|--------|------|-------------|
| **[osuperpowers](packages/osuperpowers/)** | First-party | Skills (osuperpowers orchestrators, `cli-*` family), CDD engine |
| **superpowers** | Upstream ([GitHub](https://github.com/obra/superpowers)) | Workflow skills -- brainstorming, writing plans, SDD, verification, branch finish |
| **mattpocock-skills** | Upstream ([GitHub](https://github.com/mattpocock/skills)) | Precision tools -- `grilling`, `tdd` |
| **impeccable** | Upstream ([GitHub](https://github.com/pbakaus/impeccable)) | Frontend design skills |

osuperpowers is published as a scoped npm package under `@oscaner-skills/*`; upstream plugins install from their own publishers. osuperpowers orchestrators read upstream skills via `/`-prefixed `plugin:skill` references (e.g. `/superpowers:brainstorming`).

## Installation

### From marketplace (recommended)

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

Upstream plugins (superpowers / mattpocock-skills / impeccable) are not packaged here — install each from its own publisher via its official command (marked **Upstream** above, links to their GitHub home repos).

### Per-harness install

| Harness | Install method |
|---------|---------------|
| Claude Code | marketplace install |
| Cursor Agent | marketplace install |

osuperpowers installs through each harness's own plugin marketplace; claude and cursor-agent need no per-harness config file or trust ceremony.

## Quick start

1. Install plugins from the marketplace or npm (see above).
2. Ensure the `cdd` engine CLI is on PATH (`command -v cdd`); if missing, run `npm i -g @oscaner-skills/cdd-engine`. `cli-driven-development`'s `detect-engine` node re-checks this at dispatch.
3. Invoke the superpowers workflow as you normally would -- osuperpowers skills intercept upstream triggers and route to the matching target automatically.

## Architecture

The marketplace is **package-as-source** -- metadata lives in each `package.json`'s `oscaner-plugin` field. The build step `pnpm run emit` derives everything from that:

```
package.json#oscaner-plugin --> emit --> marketplace/source.json
                                     --> .claude-plugin/marketplace.json
                                     --> .cursor-plugin/marketplace.json
                                     --> per-plugin .claude-plugin/plugin.json
                                     --> hooks files (per harness)
```

No hand-registration needed for first-party plugins.

Full architecture: [CLAUDE.md](CLAUDE.md).

## Per-package docs

- [packages/osuperpowers/](packages/osuperpowers/) -- skills, CDD engine

## Development

### Common operations

```bash
# After editing any plugin manifest or skills
pnpm run emit && pnpm run validate
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

First-party code (`osuperpowers`, marketplace tooling): [MIT](LICENSE).
