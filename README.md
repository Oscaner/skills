# oscaner-skills

[English](README.md) | [中文](README.zh-CN.md)

[![PR Validate](https://github.com/Oscaner/skills/actions/workflows/pr-validate.yml/badge.svg)](https://github.com/Oscaner/skills/actions/workflows/pr-validate.yml)
[![npm](https://img.shields.io/npm/v/@oscaner-skills/kairos?label=kairos)](https://www.npmjs.com/package/@oscaner-skills/kairos)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**A cdd-first methodology: continuously-discovered development as the core discipline, AI coding skills as the distribution vehicle.**

This repository is the home of that methodology and the vehicle that distributes it. The core discipline — **cdd**, continuously-discovered development — is encoded as skills and released as installable plugins, consumable across multiple AI coding harnesses (verified on **Claude Code**, **Cursor Agent**, and **Pi**). First-party plugins are built here under `packages/` and published to npm under the `@oscaner-skills/*` scope; the `cdd` engine drives the whole flow.

## The cdd philosophy

**cdd (continuously-discovered development)** is a development discipline that treats planning as an ongoing discovery process instead of a front-loaded artifact. Requirements are discovered by working in small, verifiable increments: each task is planned against the plan, executed against a task brief by the host harness CLI, and reviewed against shared convergence rules — so the next increment is always planned from what the previous one actually learned.

Instead of writing the plan once and hoping it survives contact with reality, cdd keeps planning live across the whole development process and makes every step provable ("did it converge?") rather than assumed ("it should be fine").

### Why cdd is designed this way

- **Discover, don't predict.** Requirements are discovered through implementation and review, not guessed up front. Every round's review findings become the input to the next round's brief — no requirement is taken on faith.
- **Small, verifiable increments.** Each task is scoped by a plan, carried by a brief, and concluded by an explicit status. The process stays legible and every change is provable.
- **Single sources, derived products.** Facts live once — in the plan, the schema, or the manifest — and everything that ships is derived from them, so paper and practice cannot drift apart.
- **Deterministic execution.** The `cdd` engine drives the chain as commands: same plan, same brief, same commands, same outcome. The human and the harness follow the same contract.

### The three-mode chain

The core loop is a chain of three modes:

| Mode | Role |
|------|------|
| `implement` | Execute the task brief for a group of tasks against the plan's constraints |
| `review` | Review the implementer's result against a fixed review reference and lens guide |
| `fix` | Apply the review findings — blockers, warnings, and nits — and converge the round |

The chain is a closure: implement → review → fix, then the next group's implement. A review that blocks routes back through `fix` and is re-reviewed until it passes; a review that passes converges and the loop advances. When all groups have converged, a final branch review closes the change and hands it off to cdd-close. The `cdd` engine runs the whole chain deterministically — dispatching each phase to the host harness and writing the handoff artifacts.

### Convergence discipline

Reviews are structured, not impressionistic. Every finding carries a severity — blocker, warn, or nit — and a lens, and a round only concludes when its findings converge:

- **blocker** findings route the round back to `fix` and a re-review, until none remain;
- **warn / nit** findings are applied by a fix round that converges and completes without a re-review, with the findings recorded;
- **zero findings** close the review outright.

**Review Convergence** is the shared closure rule behind all of this — a review never passes silently, and a fix round never re-opens settled decisions. The same rule closes task reviews, branch reviews, spec reviews, and plan reviews alike, so the whole methodology converges under one discipline instead of a pile of ad hoc checklists.

## What this is

A marketplace that packages personal AI coding skills as installable plugins consumed by multiple AI coding harnesses. First-party plugins live in this repository under `packages/` and are published by us to npm under the `@oscaner-skills/*` scope; upstream plugins are **not** packaged here — they install from their own publishers, and kairos orchestrators read them through `/`-prefixed `plugin:skill` references (e.g. `/superpowers:brainstorming`).

## Plugins

| Plugin | Source |
|--------|--------|
| **kairos** | First-party — [this repo](https://github.com/Oscaner/skills), [`packages/kairos/`](packages/kairos/), published as [`@oscaner-skills/kairos`](https://www.npmjs.com/package/@oscaner-skills/kairos). Skills (kairos orchestrators, `cdd-*` family) plus the CDD engine |
| **superpowers** | Upstream — [obra/superpowers](https://github.com/obra/superpowers). Workflow skills: brainstorming, writing plans, verification, branch finish |
| **mattpocock-skills** | Upstream — [mattpocock/skills](https://github.com/mattpocock/skills). Precision tools: `grilling`, `tdd` |
| **impeccable** | Upstream — [pbakaus/impeccable](https://github.com/pbakaus/impeccable). Frontend design skills |

Upstream plugin versions follow their own release schedules and are not tracked in this marketplace — always install them from their own publishers (see [Installation](#installation)).

## Installation

### From the marketplace (recommended)

```bash
# Claude Code
claude plugin marketplace add oscaner/skills
claude plugin install kairos@oscaner-skills
```

### From pi

```bash
pi install npm:@oscaner-skills/kairos
```

Installs the latest release into the pi harness: the eight `cdd-*` skills land under their bare names and pi's project settings are written on install. kairos ships every skill as `cdd-*` because pi has a flat skill namespace with no namespace-qualification syntax — the unique `cdd-*` bare names are what keep each skill unambiguous when invoked.

### Upstream plugins

Upstream plugins (superpowers / mattpocock-skills / impeccable) are not packaged here — install each from its own publisher via its official command (marked **Upstream** in the [Plugins](#plugins) table, linked to their GitHub home repos).

### Per-harness install

| Harness | Install method |
|---------|---------------|
| Claude Code | Marketplace install |
| Cursor Agent | Marketplace install |
| Pi | `pi install npm:@oscaner-skills/kairos` |

kairos installs through each harness's own channel — the plugin marketplace for Claude Code and Cursor Agent, `pi install npm:@oscaner-skills/kairos` for Pi. pi's install writes its project settings; Claude Code and Cursor Agent need no per-harness config file.

## Quick start

1. Install the plugins from the marketplace or npm (see [Installation](#installation)).
2. No install prerequisite — every kairos skill invokes the engine on demand via `npx -y @oscaner-skills/cdd-engine@latest <subcommand>` (zero global-install precondition; the retired `detect-engine` gate is gone; the engine ships only as a source entry + `templates/`).
3. Invoke the kairos orchestrator by name — `kairos:cdd-design`,
   `kairos:cdd-plan`, and the rest of the family. Each skill imports the matching
   upstream flow as its session baseline and runs its own orchestration digraph; kairos
   skills do not intercept or auto-route upstream `/superpowers:*` invocations — call the
   vanilla skill directly for the unlayered variant.

## Architecture

### Package layout

```
packages/
├── kairos/   # first-party plugin: kairos orchestration + cdd-* family + CDD engine skills
└── cdd-engine/     # @oscaner-skills/cdd-engine — the CDD engine CLI package (dependency of kairos)
```

### Package-as-source, one emit chain

The marketplace is **package-as-source** — metadata lives in each first-party `package.json`'s `oscaner` field. The build step `pnpm run emit` derives everything from that:

```
package.json#oscaner --> emit --> marketplace/source.json
                                     --> .claude-plugin/marketplace.json
                                     --> .cursor-plugin/marketplace.json
                                     --> per-plugin .claude-plugin/plugin.json
```

No hand-registration is needed for first-party plugins — `pnpm run emit` auto-discovers them.

Full architecture: [CLAUDE.md](CLAUDE.md).

## Per-package docs

- [`packages/kairos/`](packages/kairos/README.md) — the plugin's own guide: skill inventory, install, quick start, the `cdd` CLI harness table
- [`packages/cdd-engine/`](packages/cdd-engine/) — the CDD engine package source (maintained from this repo)
- [`docs/maintainers/`](docs/maintainers/README.md) — maintainer-only documentation index for this repository's developers

## Development

### Common operations

```bash
# After editing any plugin manifest or skills
pnpm run emit && pnpm run validate
```

### Adding a new first-party plugin

1. Create `packages/<name>/package.json` with the `oscaner` field.
2. Run `pnpm run emit` — it auto-discovers the plugin and regenerates all manifests.
3. Add a changeset naming it — it is released as `@oscaner-skills/<name>`.

No hand registration needed. See [CLAUDE.md](CLAUDE.md) for full details.

### Branch flow

`develop` is the integration branch — day-to-day PRs merge there. Production releases go through `develop --> main`. Version PRs, git tags, and GitHub Releases run on `main` only.

Release process: [`.changeset/README.md`](.changeset/README.md).

## License

First-party code (`kairos`, marketplace tooling): [MIT](LICENSE).
