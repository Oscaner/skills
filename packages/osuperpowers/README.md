# @oscaner-skills/osuperpowers

[English](README.md) | [简体中文](README.zh-CN.md)

osuperpowers skills for Claude Code — orchestration family, cli-* CDD engine skills, and the CDD orchestrator gate.

## What it does

This plugin provides two skill families:

- **osuperpowers orchestration** — flow orchestrators that read upstream `superpowers` baselines and apply personal rules (clarifying questions via `grilling`, spec review via fresh subagent passes, ticket publish redirection, etc.)
- **cli-\* CDD engine** — harness CLI three-mode chain (implement / review / fix) that dispatches coding tasks to external AI CLIs (`claude`, `cursor-agent`, `droid`, `pi`)
- **CDD gate** — hooks that enforce pending-state contracts on `Write`/`Edit` and `Bash` tool calls

## Skills

| Skill | Type | Description |
|-------|------|-------------|
| `brainstorming` | Orchestrator | Delegates discovery to `grilling`; subagent spec review; overall/phase for large scope |
| `writing-plans` | Orchestrator | Section-by-section plan writes + review; tickets to `docs/superpowers/tickets/` |
| `cli-driven-development` | Orchestrator + Engine | Plan executor (cli-only); harness CLI three-mode chain dispatcher + final branch-review CLI |
| `finishing` | Orchestrator | Branch finish / PR; no worktrees; conventional commits |
| `debugging` | Orchestrator | Evidence before fixes; delegates to `diagnosing-bugs` |
| `verification` | Orchestrator | No completion claims without verification evidence |
| `init` | Utility | Project initialization (`init router` writes self-check rules) |
| `report-issue` | Utility | Structured issue reporting |
| `cli-select` | CDD Engine | Interactive harness selection |
| `cli-task` | CDD Engine | Single-task CDD execution |

## Installation

```bash
npm install @oscaner-skills/osuperpowers
```

Or install from the oscaner-skills Claude Code marketplace.

## Quick start

1. Install `superpowers`, `osuperpowers-router`, `osuperpowers`, and `mattpocock-skills` from the marketplace.
2. Run **`/init router`** in each project to write self-check rules.
3. Use upstream superpowers skills — the router routes automatically to osuperpowers orchestrators.

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

The CDD engine dispatches via plugin-bundled scripts. The single CLI runner is `bin/engine/cdd-task.mjs`.

| Harness | CLI binary | Status |
|---------|------------|--------|
| claude | `claude` | Full |
| cursor-agent | `cursor-agent` | Full |
| droid | `droid` | Full |
| pi | `pi` | Full |
| codex | `codex` | Not-supported |
| copilot | `copilot` | Not-supported |
| gemini | `gemini` | Not-supported |

## Docs for maintainers

- [CLAUDE.md](CLAUDE.md) — osuperpowers plugin internals (hooks, overrides pattern, emit, verification, releasing)

## License

MIT
