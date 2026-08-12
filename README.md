# oscaner

[English](README.md) | [简体中文](README.zh-CN.md)

[![CI](https://github.com/Oscaner/skills/actions/workflows/ci.yml/badge.svg)](https://github.com/Oscaner/skills/actions/workflows/ci.yml)

*Combine superpowers' full workflow with mattpocock's precision — engineered via superpowers-overrides + os-engineering.*

Personal [Claude Code](https://claude.com/claude-code) plugin marketplace. Four plugins work together as one pipeline: brainstorm, plan, build, ship.

## Why this exists

**[Superpowers](https://github.com/obra/superpowers)** is the full stack — brainstorming, writing plans, subagent-driven development, verification, branch finish. One library, end to end.

**[mattpocock-skills](plugins/mattpocock-skills/)** is the precision layer — `grilling` for hard questions, `tdd` for implementation, `to-tickets` for slicing work. Small surface, sharp tools.

Neither alone told me *when* to delegate, *how* to review specs, or *how to phase* a large feature. **superpowers-overrides** is the **trigger router** — it ships no skill bodies. It intercepts upstream superpowers triggers (slash commands, SKILL attach) and routes them to the matching **os-engineering** orchestrator (`os-*`) or a **mattpocock-skills** delegate (`tdd`, `grilling`). The `os-*` orchestrators add personal rules on top of the upstream baseline — grilling for clarification, fresh-subagent spec review, and **overall + phase** decomposition for large scope.

**[os-engineering](plugins/os-engineering/)** is the **skill + engine + gate** layer — the `os-*` orchestrators (`os-brainstorming`, `os-writing-plans`, `os-executing-plans`, …) and `cli-*` family (`cli-select`, `cli-task`, `cli-driven-development`, `cli-code-review`) running on the cdd engine with per-harness registry detection, plus the cross-harness CDD orchestrator gate.

## The pipeline

```
Overall spec → Phase spec → Plan → SDD/TDD → Verify → Ship
```

Overrides add grilling and subagent review at design time; mattpocock handles grilling, tdd, and to-tickets via delegation.

Skill mapping and harness setup → [superpowers-overrides README](plugins/superpowers-overrides/README.md).

## Installation

```bash
# In Claude Code
/plugin marketplace add oscaner/skills
/plugin install mattpocock-skills@oscaner
/plugin install superpowers@oscaner
/plugin install superpowers-overrides@oscaner
```

Clone this repo (submodule required for local development):

```bash
git clone https://github.com/Oscaner/skills.git
cd skills
git submodule update --init
```

## Quick start

1. Install `superpowers`, `superpowers-overrides`, and `mattpocock-skills` from the marketplace.
2. Run **`os-init spor`** once per project — re-run after plugin upgrades. Slash command depends on your harness → [Usage](plugins/superpowers-overrides/README.md#usage).
3. Invoke the superpowers workflow as you normally would — the router routes to the matching os-engineering / mattpocock target first.

## Learn more

[superpowers-overrides README](plugins/superpowers-overrides/README.md) — router targets, Claude Code vs Cursor, enforcement layers.

## Maintainers

After editing overrides (or any first-party plugin manifest): `pnpm run emit && pnpm run validate`.

**Branch flow:** `develop` is the default integration branch — day-to-day PRs merge here and accumulate changesets. Production releases land on `main` only via a `develop → main` PR (enforced by CI and GitHub Rulesets). Version PRs, git tags, and GitHub Releases run on **`main`** only; an automated **`main → develop`** sync PR keeps `develop` aligned after release.

Release: [`.changeset/README.md`](.changeset/README.md). Contributor pattern: [`CLAUDE.md`](CLAUDE.md).

## License

First-party code (`superpowers-overrides`, marketplace tooling) is [MIT](LICENSE).

Vendored plugins keep their own licenses — see each plugin directory (e.g. `plugins/mattpocock-skills/LICENSE`).
