# @oscaner-skills/osuperpowers

[English](README.md) | [中文](README.zh-CN.md)

Personal AI coding skills — osuperpowers orchestration, the `cli-*` CDD engine family, and the report-issues repo utility — packaged as an installable plugin for AI coding harnesses (verified on **Claude Code** and **Cursor Agent**).

## What it does

Three skill families:

- **osuperpowers orchestration** — flow orchestrators that read upstream `superpowers` baselines and apply this plugin's personal rules (clarifying questions via `grilling`, spec review via fresh subagent passes, and so on)
- **`cli-*` CDD engine family** — plan executor plus the `cdd` engine CLI (`@oscaner-skills/cdd-engine`): the implement / review / fix chain and the base-branch artifact, dispatching each phase to the host harness CLI
- **report-issues** — repository development utility that files one aggregate GitHub issue for CDD-session bugs and enhancement opportunities (gh CLI, dedup-aware, manual trigger)

## Skills

| Skill | Type | Description |
|-------|------|-------------|
| `brainstorming` | Orchestrator | Delegates discovery to `grilling`; subagent spec review; routes to the overall/phase spec writers |
| `writing-overall-spec` | Orchestrator | Writes the program charter (overall spec) from a design session; cdd spec review-fix; hands off to the next phase |
| `writing-phase-spec` | Orchestrator | Writes a phase spec increment; syncs scope changes to the parent overall first; cdd spec review-fix; hands off to `writing-plans` |
| `writing-single-spec` | Orchestrator | Writes a single (non-phase) spec free-form; cdd spec review-fix; hands off to `writing-plans` |
| `writing-plans` | Orchestrator | Section-by-section plan writes + review |
| `cli-driven-development` | Orchestrator + Engine | Plan executor (CLI-only); dispatches the three-mode chain (`cdd implement` / `cdd review` / `cdd fix`) + `cdd base-branch` artifact; final branch review |
| `finishing` | Orchestrator | Branch finish / PR; no worktrees; conventional commits |
| `report-issues` | Utility | Files one aggregate GitHub issue for CDD-session bugs and enhancement opportunities (gh CLI, dedup-aware); manual trigger |

## Installation

```bash
npm install @oscaner-skills/osuperpowers
```

Or install from the oscaner-skills Claude Code marketplace:

```bash
/plugin marketplace add oscaner/skills
/plugin install osuperpowers@oscaner-skills
```

## Quick start

1. Install `superpowers`, `osuperpowers`, and `mattpocock-skills` from the marketplace (see the repository README for per-harness install).
2. Ensure the `cdd` engine CLI is on `PATH` (`command -v cdd`); if missing, run `npm i -g @oscaner-skills/cdd-engine`. The `cli-driven-development` skill's `detect-engine` node re-checks this at dispatch.
3. Invoke osuperpowers skills — `/osuperpowers:<skill>` in Claude Code, or bare slash commands in Cursor:

```bash
# Claude Code
/osuperpowers:brainstorming    # → brainstorming
/osuperpowers:writing-plans    # → writing-plans

# Cursor
/brainstorming    # → brainstorming (bare upstream slash)
/writing-plans    # → writing-plans
```

## CDD engine CLI

The CDD engine ships as the standalone `@oscaner-skills/cdd-engine` package; its single CLI runner is `cdd` (implement / review / fix / base-branch / help). It dispatches each phase to the host harness CLI via the engine's embedded harness registry (per-harness invocation and output contract):

| Harness | CLI binary | Ship status |
|---------|------------|-------------|
| claude | `claude` | Full |
| cursor-agent | `cursor-agent` | Full |

`cdd help` prints the engine's resource-discovery paths (CLI directory, document schemas, templates). See [the cdd-engine README](../cdd-engine/README.md) for the full CLI reference.

## Docs for maintainers

- [docs/maintainers/07-osuperpowers-plugin.md](../../docs/maintainers/07-osuperpowers-plugin.md) — osuperpowers plugin internals (overrides pattern, emit chain, verification, releasing)

## License

MIT
