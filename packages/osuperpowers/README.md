# @oscaner-skills/osuperpowers

osuperpowers skills for Claude Code — orchestration family and the cli-* CDD engine skills.

## What it does

This plugin provides three skill families:

- **osuperpowers orchestration** — flow orchestrators that read upstream `superpowers` baselines and apply personal rules (clarifying questions via `grilling`, spec review via fresh subagent passes, etc.)
- **cli-\* CDD engine** — plan executor plus the `cdd` engine CLI (`@oscaner-skills/cdd-engine`): the three-mode chain (implement / review / fix) and the base-branch artifact, dispatching each phase to external AI CLIs (`claude`, `cursor-agent`)
- **report-issues** — repo development utility that files one aggregate GitHub issue for CDD-session bugs and enhancement opportunities (dedup-aware, manual trigger)

## Skills

| Skill | Type | Description |
|-------|------|-------------|
| `brainstorming` | Orchestrator | Delegates discovery to `grilling`; subagent spec review; overall/phase for large scope |
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

Or install from the oscaner-skills Claude Code marketplace.

## Quick start

1. Install `superpowers`, `osuperpowers`, and `mattpocock-skills` from the marketplace.
2. Ensure the `cdd` engine CLI is on PATH (`command -v cdd`); install with `npm i -g @oscaner-skills/cdd-engine` if missing. `cli-driven-development`'s `detect-engine` node re-checks this at dispatch.
3. Invoke osuperpowers skills — use `/osuperpowers:<skill>` in Claude Code, or bare slash commands in Cursor.

### Claude Code

```bash
/osuperpowers:brainstorming    # → brainstorming
/osuperpowers:writing-plans    # → writing-plans
```

### Cursor

```bash
/brainstorming    # → brainstorming (bare upstream slash)
/writing-plans    # → writing-plans
```

## CDD engine CLI (`cdd`)

The CDD engine is the standalone `@oscaner-skills/cdd-engine` package; its single CLI runner is `cdd` (implement / review / fix / base-branch). It dispatches each phase to the host harness CLI via the engine's embedded harness registry (invocation and output contract per harness):

| Harness | CLI binary | Status |
|---------|------------|--------|
| claude | `claude` | Full |
| cursor-agent | `cursor-agent` | Full |

## Docs for maintainers

- [docs/maintainers/osuperpowers-plugin.md](../../docs/maintainers/osuperpowers-plugin.md) — osuperpowers plugin internals (overrides pattern, emit, verification, releasing)

## License

MIT
