# @oscaner-skills/kairos

[English](README.md) | [中文](README.zh-CN.md)

Personal AI coding skills — kairos orchestration, the `cdd-*` CDD engine family, and the cdd-report repo utility — packaged as an installable plugin for AI coding harnesses (verified on **Claude Code** and **Cursor Agent**).

## The kairos philosophy

kairos is the distribution vehicle for a cdd-first methodology: it packages the practice of **continuously-discovered development** as installable skills and puts the deterministic `cdd` engine behind the whole flow (see the repository [README](../README.md) for the full methodology).

- **cdd as the core discipline.** Development runs through the three-mode chain — implement → review → fix — driven by the plan, and every phase closes under the same convergence rule.
- **Orchestration as the flow layer.** The orchestrator skills carry the flow: clarifying questions, spec and plan writing with structured review, and branch close-out — each phase closed by a review rather than by assumption.
- **The engine as the execution layer.** The `cdd` CLI makes the chain deterministic — same plan, same brief, same commands, same outcome. The engine dispatches each phase to the host harness and writes the handoff artifacts; skills never re-implement its mechanics.

## What it does

Three skill families:

- **kairos orchestration** — flow orchestrators that read upstream `superpowers` baselines and apply this plugin's personal rules (clarifying questions via `grilling`, spec review via fresh subagent passes, and so on)
- **`cdd-*` CDD engine family** — plan executor plus the `cdd` engine CLI (`@oscaner-skills/cdd-engine`): the implement / review / fix chain and the base-branch artifact, dispatching each phase to the host harness CLI
- **cdd-report** — repository development utility that files one aggregate GitHub issue for CDD-session bugs and enhancement opportunities (gh CLI, dedup-aware, manual trigger)

## Skills

| Skill | Type | Description |
|-------|------|-------------|
| `cdd-design` | Orchestrator | Delegates discovery to `grilling`; subagent spec review; routes to the overall/phase spec writers |
| `cdd-charter` | Orchestrator | Writes the program charter (overall spec) from a design session; cdd spec review-fix; hands off to the next phase |
| `cdd-phase` | Orchestrator | Writes a phase spec increment; syncs scope changes to the parent overall first; cdd spec review-fix; hands off to `cdd-plan` |
| `cdd-spec` | Orchestrator | Writes a single (non-phase) spec free-form; cdd spec review-fix; hands off to `cdd-plan` |
| `cdd-plan` | Orchestrator | Section-by-section plan writes + review |
| `cdd-dev` | Orchestrator + Engine | Plan executor (CLI-only); dispatches the three-mode chain (`cdd implement` / `cdd review` / `cdd fix`) + `cdd base-branch` artifact; final branch review |
| `cdd-close` | Orchestrator | Branch finish / PR; no worktrees; conventional commits |
| `cdd-report` | Utility | Files one aggregate GitHub issue for CDD-session bugs and enhancement opportunities (gh CLI, dedup-aware); manual trigger |

## Installation

```bash
npm install @oscaner-skills/kairos
```

Or install from the oscaner-skills Claude Code marketplace:

```bash
/plugin marketplace add oscaner/skills
/plugin install kairos@oscaner-skills
```

## Quick start

1. Install `superpowers`, `kairos`, and `mattpocock-skills` from the marketplace (see the repository README for per-harness install).
2. Ensure the `cdd` engine CLI is on `PATH` (`command -v cdd`); if missing, run `npm i -g @oscaner-skills/cdd-engine`. The `cdd-dev` skill's `detect-engine` node re-checks this at dispatch.
3. Invoke kairos skills — `/kairos:<skill>` in Claude Code, or bare slash commands in Cursor:

```bash
# Claude Code
/kairos:cdd-design    # → cdd-design
/kairos:cdd-plan    # → cdd-plan

# Cursor
/cdd-design    # → cdd-design (bare upstream slash)
/cdd-plan    # → cdd-plan
```

## CDD engine CLI

The CDD engine ships as the standalone `@oscaner-skills/cdd-engine` package; its single CLI runner is `cdd` (implement / review / fix / base-branch / schema / issue). It dispatches each phase to the host harness CLI via the engine's embedded harness registry (per-harness invocation and output contract):

| Harness | CLI binary | Ship status |
|---------|------------|-------------|
| claude | `claude` | Full |
| cursor-agent | `cursor-agent` | Full |

`cdd schema get <type>` prints the engine's canonical doc-structure schema straight to stdout (discovery-only, byte-identical to the shipped schema), and `cdd issue render` builds an aggregate issue body from stdin findings (pure rendering, zero enforcement). See [the cdd-engine README](../cdd-engine/README.md) for the full CLI reference.

## Docs for maintainers

Repository-internal maintenance docs for this monorepo's developers (not shipped with the plugin). The [docs/maintainers index](../../docs/maintainers/README.md) links the numbered family — e.g. [program experience](../../docs/maintainers/04-program-experience.md) and the [template doctrine](../../docs/maintainers/01-template-doctrine.md) that governs emit-generated products.

## License

MIT
