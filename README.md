# oscaner-skills

[English](README.md) | [中文](README.zh-CN.md)

[![PR Validate](https://github.com/Oscaner/skills/actions/workflows/pr-validate.yml/badge.svg)](https://github.com/Oscaner/skills/actions/workflows/pr-validate.yml)
[![npm](https://img.shields.io/npm/v/@oscaner-skills/kairos?label=kairos)](https://www.npmjs.com/package/@oscaner-skills/kairos)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**A cdd-first methodology: continuously-discovered development as the core discipline, AI coding skills as the distribution vehicle.**

This repository is both the home of that methodology and the vehicle that distributes it. The discipline is encoded as skills and released as installable plugins, consumable across multiple AI coding harnesses (verified on **Claude Code** and **Pi**). First-party packages live under `packages/` and publish to npm as `@oscaner-skills/*`; the `cdd` engine drives the flow.

## The cdd philosophy

**cdd (continuously-discovered development)** treats planning as an ongoing discovery process, not a front-loaded document. Requirements are discovered in small, verifiable increments: each task is planned against the plan, executed by the host harness, and reviewed against shared convergence rules — so the next increment is planned from what the previous one actually learned.

### Why cdd is designed this way

- **Discover, don't predict.** Review findings become the next round's input; no requirement is taken on faith.
- **Small, verifiable increments.** Every task has a plan, a brief, and an explicit status.
- **Single sources, derived products.** Facts live once; shipped artifacts are derived, so paper and practice cannot drift.
- **Deterministic execution.** Same plan, same brief, same commands, same outcome.

### The three-mode chain

The core loop is a chain: `implement` executes the brief, `review` judges the result against fixed criteria, and `fix` applies the findings. A blocked review routes back through `fix` and is re-reviewed; a converged review advances to the next group. A final branch review closes the change.

### Convergence discipline

Every finding carries a severity — **blocker**, **warn**, or **nit** — and a lens. **Review Convergence** is the single closure rule: blockers route to `fix` and a re-review; warn/nit-only closes as `REVIEW_FIX`; zero findings closes outright. The same rule closes task, branch, spec, and plan reviews.

## What this is

A marketplace that packages AI coding skills as installable plugins for multiple harnesses. First-party plugins are built here and published by us; upstream plugins are installed from their own publishers and referenced by kairos orchestrators as `/plugin:skill` (for example `/superpowers:brainstorming`).

## Plugins

| Plugin | Source |
|--------|--------|
| **kairos** | First-party — [`packages/kairos/`](packages/kairos/), published as [`@oscaner-skills/kairos`](https://www.npmjs.com/package/@oscaner-skills/kairos). Six `cdd-*` skills plus the CDD engine |
| **superpowers** | Upstream — [obra/superpowers](https://github.com/obra/superpowers). Workflow skills |
| **mattpocock-skills** | Upstream — [mattpocock/skills](https://github.com/mattpocock/skills). Precision tools: `grilling`, `tdd` |

Upstream versions follow their own release schedules — `cdd init` installs whatever each publisher currently publishes.

## Installation

```bash
npx -y @oscaner-skills/cdd-engine@latest init --harness=claude
npx -y @oscaner-skills/cdd-engine@latest init --harness=pi
```

`cdd init` installs `kairos` and its upstream packages in order, through the harness's own command channel — drop the `npx -y @oscaner-skills/cdd-engine@latest` prefix when `cdd` is installed globally. Manual, per-harness install commands live in the [`packages/kairos/README.md`](packages/kairos/README.md) installation table.

## Quick start

1. Install `kairos` and its upstream packages with `cdd init --harness=<claude|pi>` (see [Installation](#installation)).
2. No install prerequisite — every kairos skill fetches the engine on demand with `npx -y @oscaner-skills/cdd-engine@latest <subcommand>`.
3. Invoke an orchestrator by name: `/kairos:cdd-design`, `/kairos:cdd-plan`, `/kairos:cdd-dev`, `/kairos:cdd-close`.
4. No `.gitignore` setup — the engine keeps run state under `.kairos/cdd/` and publishes `.kairos/.gitignore` (`*`) at first dispatch.

## Architecture

```
packages/
├── kairos/       # plugin: six cdd-* skills (design, spec-writer, plan, dev, close, report)
└── cdd-engine/   # @oscaner-skills/cdd-engine: cdd CLI + templates
```

The marketplace is **package-as-source**. Metadata lives in each first-party `package.json#oscaner`; one emit step derives every product:

```
package.json#oscaner → pnpm emit → marketplace/source.json
                                → .claude-plugin/ manifests
```

Architecture and the developer/engine journey are maintained as bilingual, checked diagrams — open the [diagram index](docs/diagrams/index.html) and switch language in the header:

- [Architecture (EN)](docs/diagrams/architecture.en.html) · [架构（中文）](docs/diagrams/architecture.zh-CN.html)
- [Developer & engine journey (EN)](docs/diagrams/journey.en.html) · [开发者与引擎旅程（中文）](docs/diagrams/journey.zh-CN.html)
- [NEXT-loop & findings judgment (EN)](docs/diagrams/next-loop.en.html) · [NEXT 循环与 findings 判定（中文）](docs/diagrams/next-loop.zh-CN.html)

Full repository conventions: [CLAUDE.md](CLAUDE.md).

## Per-package docs

- [`packages/kairos/README.md`](packages/kairos/README.md) — skills, install, quick start, harness table
- [`packages/cdd-engine/README.md`](packages/cdd-engine/README.md) — the `cdd` CLI reference
- [`.changeset/README.md`](.changeset/README.md) — versioning and release flow

## Development

```bash
pnpm run emit       # regenerate manifests from package.json#oscaner
pnpm run validate   # emit freshness + tests + typecheck + version sync
```

Adding a first-party plugin: create `packages/<name>/package.json` with an `oscaner` field, run `pnpm run emit`, and add a changeset.

`develop` is the integration branch; production releases flow `develop → main`. Version PRs, tags, and GitHub Releases run on `main` only.

## License

First-party code (`kairos`, marketplace tooling): [MIT](LICENSE).
