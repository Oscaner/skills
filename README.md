# oscaner-skills

[English](README.md) | [中文](README.zh-CN.md)

[![PR Validate](https://github.com/Oscaner/skills/actions/workflows/pr-validate.yml/badge.svg)](https://github.com/Oscaner/skills/actions/workflows/pr-validate.yml)
[![npm](https://img.shields.io/npm/v/@oscaner-skills/kairos?label=kairos)](https://www.npmjs.com/package/@oscaner-skills/kairos)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**A cdd-first methodology: continuously-discovered development as the core discipline, AI coding skills as the distribution vehicle.**

This repository is both the home of that methodology and the vehicle that distributes it. The discipline is encoded as skills, released as installable plugins, consumable across multiple AI coding harnesses (verified on **Claude Code** and **Pi**), and driven by the `cdd` engine.

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

Every finding carries a severity — **blocker**, **warn**, or **nit** — and a lens. **Review Convergence** is the single closure rule: blockers route to `fix` and a re-review; warn/nit-only closes as `REVIEW_FIX`; zero findings closes outright. The same rule closes wave, branch, phase-spec, overall, plan, and single-spec reviews, so no face invents a stopping condition of its own.

## What this is

A marketplace that packages AI coding skills as installable plugins, plus the engine those skills run on. Three things ship together:

- **Six `cdd-*` skills** — orchestrators that carry a change from design to close, plus `cdd-report` for filing what the session itself got wrong.
- **The `cdd` CLI** — `implement` · `review` · `fix` · `base` · `schema` · `issue` · `board` · `init`. It owns the pre-flight gates, the plan ledger, the round records, and the progress board.
- **Marketplace packaging** — first-party plugins are built here and published by us; upstream plugins are installed from their own publishers and referenced by orchestrators as `/plugin:skill` (for example `/superpowers:brainstorming`).

## The flow

A change moves through five stages. Each stage is an orchestrator that dispatches engine rounds, and each hands off to the next only when its artifact has converged:

| Stage | Orchestrator | What it hands you |
|---|---|---|
| Design | `cdd-design` | the design conversation, routed to one spec shape — single-spec, phase-spec, or overall charter |
| Spec | `cdd-spec-writer` | the spec, reviewed to convergence and committed |
| Plan | `cdd-plan` | the task waves — at most three tasks per wave, a limit the engine enforces rather than splits around |
| Dev | `cdd-dev` | implement / review / fix rounds per wave, then the branch review that closes the change |
| Close | `cdd-close` | the finish decision, then the linked issues |

`cdd-report` stands outside the chain: it files one aggregate issue for the bugs and improvements a session discovered in its own tooling.

### How a round is judged

The engine, not the orchestrator, decides what happens next, and it decides from evidence:

- **Every dispatch closes with a verdict.** A round books a record even when it is blocked or times out, so "the round did nothing" is never a silent absence.
- **Completion is a criterion per verb, never the child's exit code.** `implement` must leave a commit, `review` must leave a findings carrier that validates, `fix` must answer every finding of the request.
- **The next hop is derived, then printed with its reason.** Each run ends with its `next:` line and the reason line that follows it, and `cdd board --plan <path>` renders that same judgment as a progress board — the line and the board cannot disagree.
- **You are the stop point.** Every orchestrator presents its artifact and stops for your explicit approval before dispatching its first round.

## Get started

Requires Node ≥ 24 — the engine's floor, since it runs its TypeScript entry through native type stripping — and the harness CLI on `PATH`.

### What gets installed

`cdd init` installs three plugins **in order**, through the harness's own command channel (`claude plugin *` / `pi *`), so nothing bypasses the harness it is installing into:

| Plugin | Source |
|--------|--------|
| **kairos** | First-party — [`packages/kairos/`](packages/kairos/), published as [`@oscaner-skills/kairos`](https://www.npmjs.com/package/@oscaner-skills/kairos). Six `cdd-*` skills plus the CDD engine |
| **superpowers** | Upstream — [obra/superpowers](https://github.com/obra/superpowers). Workflow skills |
| **mattpocock-skills** | Upstream — [mattpocock/skills](https://github.com/mattpocock/skills). Precision tools: `grilling`, `tdd` |

Upstream versions follow their own release schedules — `cdd init` installs whatever each publisher currently publishes.

### First run

```bash
npx -y @oscaner-skills/cdd-engine@latest init --harness=claude
npx -y @oscaner-skills/cdd-engine@latest init --harness=pi
```

Re-run with `--update` to refresh an existing install, add `--include-recommends` to bring in the six pi capability packages beside the core set, or install `cdd` globally (`npm i -g @oscaner-skills/cdd-engine`) to drop the prefix. Manual per-harness commands live in the [`packages/kairos/README.md`](packages/kairos/README.md) installation table.

Then invoke the first orchestrator — `/kairos:cdd-design` — and follow the engine's `next:` line from there. Nothing else to set up: skills fetch the engine on demand with `npx -y @oscaner-skills/cdd-engine@latest <subcommand>`, and the engine keeps run state under `.kairos/cdd/`, publishing `.kairos/.gitignore` (`*`) at first dispatch.

## How it is built

```
packages/
├── kairos/        # plugin: six cdd-* skills (orchestrators, spec writer, report)
│   ├── skills/    # SKILL.md per skill — the shipped consumer surface
│   └── tests/     # anatomy, word-face and behaviour-tree probes
└── cdd-engine/    # @oscaner-skills/cdd-engine — the cdd CLI
    ├── src-next/  # five planes: contract · face · infra · render · session
    └── templates/ # shipped report and issue-body templates
```

The marketplace is **package-as-source**. Metadata lives in each first-party `package.json#oscaner`; one emit step derives every product, so a manifest can never disagree with the package it describes:

```
package.json#oscaner → pnpm run emit → marketplace/source.json
                                    → .claude-plugin/ manifests
                                    → .github/ISSUE_TEMPLATE/
```

Architecture and the developer/engine journey are maintained as bilingual, checked diagrams — open the [diagram index](docs/diagrams/index.html) and switch language in the header:

- [Architecture (EN)](docs/diagrams/architecture.en.html) · [架构（中文）](docs/diagrams/architecture.zh-CN.html)
- [Developer & engine journey (EN)](docs/diagrams/journey.en.html) · [开发者与引擎旅程（中文）](docs/diagrams/journey.zh-CN.html)
- [NEXT-loop & round judgment (EN)](docs/diagrams/next-loop.en.html) · [NEXT 循环与轮次判定（中文）](docs/diagrams/next-loop.zh-CN.html)

## Documentation

- [`packages/kairos/README.md`](packages/kairos/README.md) — skills, install, quick start, harness table
- [`packages/cdd-engine/README.md`](packages/cdd-engine/README.md) — the `cdd` CLI reference
- [`.changeset/README.md`](.changeset/README.md) — versioning and release flow
- [`docs/diagrams/README.md`](docs/diagrams/README.md) — the diagrams and how to regenerate them
- [`AGENTS.md`](AGENTS.md) — repository conventions for coding agents (`CLAUDE.md` is a symlink to it)

## Contributing

Node 26 (`.nvmrc`) and pnpm 12.18.0 (`packageManager`) — run `fnm use` first if you use fnm.

```bash
pnpm install
pnpm run emit       # regenerate the derived products from package.json#oscaner
pnpm run validate   # the full gate
```

`pnpm run validate` holds the whole assertion surface: emit freshness · the root, kairos and engine test suites · typecheck ×3 · a built-`dist` import and one live command · package version sync · zero module-level bare functions. Changing behaviour in either package also owes a changeset — the version tracks the methodology contract, so a consumer-visible byte change is still a minor, and `major` is machine-banned. Adding a first-party plugin means creating `packages/<name>/package.json` with an `oscaner` field, running `pnpm run emit`, and adding a changeset.

Engine work calls the local source rather than the published release: `node packages/cdd-engine/src-next/bin.ts <subcommand>`. Focused commands, the generated-file inventory and the commit conventions are in [`AGENTS.md`](AGENTS.md).

`develop` is the integration branch; production releases flow `develop → main`. Version PRs, tags, and GitHub Releases run on `main` only.

## License

First-party code (`kairos`, marketplace tooling): [MIT](LICENSE).
