# superpowers-overrides — Claude Code Session Guide

## What this plugin does

`superpowers-overrides` is a **trigger router**. It ships **no skill bodies** — its sole job is to intercept upstream `superpowers:*` triggers and route them to the correct target:

- `engineering:os-*` / `cli-*` — personal orchestrator skills in `packages/engineering/skills/`
- `mattpocock-skills:tdd` — direct delegate (no engineering wrapper)

When you type `/brainstorming`, `/writing-plans`, or any other upstream superpowers command, the router fires first and the matching target skill loads instead.

## How it works

Three mechanisms enforce routing:

### 1. overrides.manifest.json (single source of truth)

`overrides.manifest.json` lists every upstream trigger and its target. All hook scripts and self-check tables are derived from this manifest by `pnpm run emit`. Never hand-edit the hook scripts — edit the manifest and re-emit.

### 2. Hooks (plugin-bundled)

**Claude Code** — `hooks/hooks.json`:
- Hook type: `UserPromptExpansion`
- Two matchers: `^superpowers:` (namespaced slash) and a combined regex for bare `/slug` forms
- Handler: `bin/prompt-expansion.mjs` — reads stdin JSON, looks up the command in a hard-coded MAP, injects `additionalContext` telling the model its first tool call MUST be `Skill(<target>)`

**Cursor** — `hooks/hooks-cursor.json`:
- `beforeSubmitPrompt` → `bin/cursor-detect.mjs` — detects upstream skill file attachments, writes a pending-state file
- `preToolUse` → `bin/cursor-enforce.mjs` — if a pending state exists, blocks non-override tool calls (Read of upstream SKILL.md, etc.) and injects a mandatory override message
- Fail-open: if anything is unparseable or the pending file is stale (TTL 300s), the hook allows the action

### 3. Project-level self-check

`os-init spor` (from engineering) writes an override trigger table into the project's `CLAUDE.md` (Claude Code) or `.cursor/rules/superpowers-overrides.mdc` (Cursor). This is the primary enforcement mechanism — it fires before any skill body loads into context.

## Trigger mapping table

| Upstream trigger | Target | Description |
|---|---|---|
| `superpowers:brainstorming` | `engineering:os-brainstorming` | Discovery via `grilling`; subagent spec review |
| `superpowers:writing-plans` | `engineering:os-writing-plans` | Section-by-section plan writes + review; tickets to `docs/superpowers/tickets/` |
| `superpowers:subagent-driven-development` | `engineering:cli-driven-development` | CDD engine — harness CLI three-mode chain |
| `superpowers:executing-plans` | `engineering:os-executing-plans` | Three-mode orchestrator (in-session / subagent / cli) |
| `superpowers:finishing-a-development-branch` | `engineering:os-finishing` | Branch finish / PR; no worktrees; conventional commits |
| `superpowers:systematic-debugging` | `engineering:os-debugging` | Evidence before fixes; delegates to `diagnosing-bugs` |
| `superpowers:test-driven-development` | `mattpocock-skills:tdd` | Red-green loop; direct delegate |
| `superpowers:verification-before-completion` | `engineering:os-verification` | No completion claims without verification evidence |
| `superpowers:receiving-code-review` | `engineering:os-code-review` | Unclear feedback goes to `grilling`; fixes go to `tdd` |
| `superpowers:using-git-worktrees` | `engineering:os-finishing` | Refuses worktree creation (user policy) |

The same mapping is used for bare `/slug` forms (e.g. `/brainstorming` maps to `engineering:os-brainstorming`).

## Convention: no skill bodies

This plugin ships **zero SKILL.md files**. All skill bodies live under `packages/engineering/skills/`. The overrides plugin's `skills/` directory must be empty (or absent). This is enforced by the validation scripts — a non-empty skills directory in a trigger-router plugin causes `pnpm run validate` to fail.

## Related files

- `overrides.manifest.json` — trigger-to-target mapping (source of truth)
- `hooks/hooks.json` — Claude Code hooks (UserPromptExpansion)
- `hooks/hooks-cursor.json` — Cursor hooks (beforeSubmitPrompt + preToolUse)
- `bin/prompt-expansion.mjs` — Claude Code hook handler
- `bin/cursor-detect.mjs` — Cursor detect hook handler
- `bin/cursor-enforce.mjs` — Cursor enforce hook handler
- `../engineering/skills/` — where all target skill bodies live
