# @oscaner-skills/osuperpowers

[English](README.md) | [简体中文](README.zh-CN.md)

osuperpowers skills for Claude Code — orchestration family and the cli-* CDD engine skills.

## What it does

This plugin provides two skill families:

- **osuperpowers orchestration** — flow orchestrators that read upstream `superpowers` baselines and apply personal rules (clarifying questions via `grilling`, spec review via fresh subagent passes, ticket publish redirection, etc.)
- **cli-\* CDD engine** — harness CLI three-mode chain (implement / review / fix) that dispatches coding tasks to external AI CLIs (`claude`, `cursor-agent`)

## Skills

| Skill | Type | Description |
|-------|------|-------------|
| `brainstorming` | Orchestrator | Delegates discovery to `grilling`; subagent spec review; overall/phase for large scope |
| `writing-plans` | Orchestrator | Section-by-section plan writes + review; tickets to `docs/superpowers/tickets/` |
| `cli-driven-development` | Orchestrator + Engine | Plan executor (cli-only); harness CLI three-mode chain dispatcher + final branch-review CLI |
| `finishing` | Orchestrator | Branch finish / PR; no worktrees; conventional commits |
| `init` | Utility | Marketplace installation guide — points to the harness's plugin marketplace; checks for the `cdd` engine CLI |
| `report-issue` | Utility | Structured issue reporting |

## Installation

```bash
npm install @oscaner-skills/osuperpowers
```

Or install from the oscaner-skills Claude Code marketplace.

## Quick start

1. Install `superpowers`, `osuperpowers`, and `mattpocock-skills` from the marketplace.
2. Run **`/init`** in each project to install osuperpowers from the harness's plugin marketplace.
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

## CDD CLI harness scripts

The CDD engine dispatches via plugin-bundled scripts. The single CLI runner is `cdd`.

| Harness | CLI binary | Status |
|---------|------------|--------|
| claude | `claude` | Full |
| cursor-agent | `cursor-agent` | Full |

## Docs for maintainers

- [docs/maintainers/osuperpowers-plugin.md](../../docs/maintainers/osuperpowers-plugin.md) — osuperpowers plugin internals (overrides pattern, emit, verification, releasing)

## License

MIT
