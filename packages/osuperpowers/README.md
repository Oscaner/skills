# @oscaner-skills/engineering

[English](README.md) | [简体中文](README.zh-CN.md)

Engineering skills for Claude Code — os-* orchestration family, cli-* CDD engine skills, and the CDD orchestrator gate.

## What it does

This plugin provides two skill families:

- **os-\* orchestration** — flow orchestrators that read upstream `superpowers` baselines and apply personal rules (clarifying questions via `grilling`, spec review via fresh subagent passes, ticket publish redirection, etc.)
- **cli-\* CDD engine** — harness CLI three-mode chain (implement / review / fix) that dispatches coding tasks to external AI CLIs (`claude`, `cursor-agent`, `droid`, `pi`)
- **CDD gate** — hooks that enforce pending-state contracts on `Write`/`Edit` and `Bash` tool calls

## Skills

| Skill | Type | Description |
|-------|------|-------------|
| `os-brainstorming` | Orchestrator | Delegates discovery to `grilling`; subagent spec review; overall/phase for large scope |
| `os-writing-plans` | Orchestrator | Section-by-section plan writes + review; tickets to `docs/superpowers/tickets/` |
| `os-executing-plans` | Orchestrator | Three-mode executor (in-session / subagent / cli) |
| `os-finishing` | Orchestrator | Branch finish / PR; no worktrees; conventional commits |
| `os-debugging` | Orchestrator | Evidence before fixes; delegates to `diagnosing-bugs` |
| `os-verification` | Orchestrator | No completion claims without verification evidence |
| `os-code-review` | Orchestrator | Unclear feedback → `grilling`; fixes → `tdd` |
| `os-init` | Utility | Project initialization (`os-init spor` writes self-check rules) |
| `os-report-issue` | Utility | Structured issue reporting |
| `cli-driven-development` | CDD Engine | Harness CLI three-mode chain dispatcher |
| `cli-select` | CDD Engine | Interactive harness selection |
| `cli-task` | CDD Engine | Single-task CDD execution |
| `cli-code-review` | CDD Engine | CDD-driven code review |

## Installation

```bash
npm install @oscaner-skills/engineering
```

Or install from the oscaner-skills Claude Code marketplace.

## Quick start

1. Install `superpowers`, `superpowers-overrides`, `engineering`, and `mattpocock-skills` from the marketplace.
2. Run **`/os-init spor`** in each project to write self-check rules.
3. Use upstream superpowers skills — the router routes automatically to engineering orchestrators.

### Claude Code

```bash
/osuperpowers:brainstorming    # → os-brainstorming
/osuperpowers:writing-plans    # → os-writing-plans
/osuperpowers:executing-plans  # → os-executing-plans
```

### Cursor

```bash
/brainstorming    # → os-brainstorming (bare upstream slash)
/writing-plans    # → os-writing-plans
```

## CDD CLI harness scripts

The CDD engine dispatches via plugin-bundled scripts. The single CLI runner is `bin/engine/cdd-run.mjs`.

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

- [CLAUDE.md](CLAUDE.md) — engineering plugin internals (hooks, overrides pattern, emit, verification, releasing)

## License

MIT
