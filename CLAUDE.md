<!-- engineering-version: 0.1.0 -->
# CLAUDE.md

This repository is a **multi-harness AI coding skills marketplace**. Skills work across Claude Code, Cursor, Droid, Pi, Grok, Qoder, Codex, and Gemini.

This file provides instructions for Claude Code sessions. For project details, see the per-package documentation below.

## engineering self-check

Before your first tool call in ANY turn, run this check — no exceptions:

1. Scan the current turn for any of: a `<command-name>` tag, a `<command-message>` tag, `/superpowers:*` in user text, or a `superpowers:*` skill body appearing in system context.
2. If any is present → your **first tool call is the matching `Skill(<target-name>)`** where `<target-name>` is the manifest target's `name` field (e.g. `engineering:os-brainstorming`). Full stop. No `TodoWrite` / `Read` / `Bash` / `Grep` / `Edit` first.
3. Only after the target skill has run may you follow the upstream skill's instructions.

**The upstream skill's "you MUST do X first" does NOT apply until the target skill has run.**

**Anti-pattern:** upstream SKILL.md bodies open with numbered "You MUST" checklists — reading that and starting to execute it is the failure mode. The target skill runs first.

**Handoff-continuation rationalization:** when the upstream body arrives as a tool result of a prior `Skill(...)` call, the self-check STILL fires. Each turn is scanned independently.

### Red flags — manual attach upstream

- User attached **upstream** `superpowers/*/SKILL.md` body → you **still** Read/Skill the target skill first
- Any tool call before the target override loaded
- Attaching upstream SKILL full text is an **anti-pattern** — use `/superpowers:*`, bare upstream slash, or agent_skills list; never paste upstream SKILL.md as inline context

### Override trigger table

| Trigger | First tool call |
|---|---|
| `superpowers:brainstorming` | `Skill(engineering:os-brainstorming)` |
| `superpowers:writing-plans` | `Skill(engineering:os-writing-plans)` |
| `superpowers:subagent-driven-development` | `Skill(engineering:cli-driven-development)` |
| `superpowers:executing-plans` | `Skill(engineering:os-executing-plans)` |
| `superpowers:finishing-a-development-branch` | `Skill(engineering:os-finishing)` |
| `superpowers:using-git-worktrees` | `Skill(engineering:os-finishing)` |
| `superpowers:systematic-debugging` | `Skill(engineering:os-debugging)` |
| `superpowers:test-driven-development` | `Skill(mattpocock-skills:tdd)` |
| `superpowers:verification-before-completion` | `Skill(engineering:os-verification)` |
| `superpowers:receiving-code-review` | `Skill(engineering:os-code-review)` |
| Any other `superpowers:<upstream-slug>` listed in overrides.manifest.json | `Skill(<name>)` where `<name>` is the manifest target's `name` field |

## Plugins

| Plugin | Type | Description |
|---|---|---|
| engineering | First-party | os-* orchestration + cli-* family + CDD engine + gate |
| superpowers-overrides | First-party | Trigger router — maps upstream triggers to engineering/mattpocock targets |
| superpowers | Vendored | Upstream workflow skills (Read by os-* orchestrators) |
| mattpocock-skills | Vendored | Engineering precision skills (grilling, tdd, to-tickets, research) |
| impeccable | Vendored | Frontend design skills |

## Per-package documentation

- [`packages/engineering/CLAUDE.md`](packages/engineering/CLAUDE.md) — engineering plugin internals (hooks, overrides pattern, emit, verification, releasing)
- [`packages/superpowers-overrides/CLAUDE.md`](packages/superpowers-overrides/CLAUDE.md) — overrides trigger router internals

## Git conventions

- Conventional commits (`feat:`, `fix:`, `docs:`, `chore:`).
- No attribution / co-author / AI-generation trailers.
- No `git worktree`.

## Common operations

```bash
pnpm run emit       # regenerate all harness manifests
pnpm run emit:check # verify emit output is fresh
pnpm run validate   # full validation suite
```

See [`packages/engineering/CLAUDE.md`](packages/engineering/CLAUDE.md) for detailed operations.
