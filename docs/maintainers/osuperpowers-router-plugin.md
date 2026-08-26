# osuperpowers-router plugin — maintainer guide

> **Reader positioning:** this document is for developers of this monorepo (Oscaner/skills) — it describes plugin development, the emit chain, hooks, and releasing. **It does not apply to the consumer environment** — users who install the plugin need not read this.

## How it works

Three mechanisms enforce routing:

### 1. overrides.manifest.json (single source of truth)

`packages/osuperpowers-router/overrides.manifest.json` lists every upstream trigger and its target. All hook scripts and self-check tables are derived from this manifest by `pnpm run emit`. Never hand-edit the hook scripts — edit the manifest and re-emit.

### 2. Hooks (plugin-bundled)

**Claude Code** — `packages/osuperpowers-router/hooks/hooks.json`:
- Hook type: `UserPromptExpansion`
- Two matchers: `^superpowers:` (namespaced slash) and a combined regex for bare `/slug` forms
- Handler: `packages/osuperpowers-router/bin/prompt-expansion.mjs` — reads stdin JSON, looks up the command in a hard-coded MAP, injects `additionalContext` telling the model its first tool call MUST be `Skill(<target>)`

**Cursor** — `packages/osuperpowers-router/hooks/hooks-cursor.json`:
- `beforeSubmitPrompt` → `packages/osuperpowers-router/bin/cursor-detect.mjs` — detects upstream skill file attachments, writes a pending-state file
- `preToolUse` → `packages/osuperpowers-router/bin/cursor-enforce.mjs` — if a pending state exists, blocks non-override tool calls (Read of upstream SKILL.md, etc.) and injects a mandatory override message
- Fail-open: if anything is unparseable or the pending file is stale (TTL 300s), the hook allows the action

### 3. Project-level self-check

`init router` (from osuperpowers) writes an override trigger table into the project's `CLAUDE.md` (Claude Code) or `.cursor/rules/osuperpowers-router.mdc` (Cursor). This is the primary enforcement mechanism — it fires before any skill body loads into context.

## Trigger mapping table

| Upstream trigger | Target | Description |
|---|---|---|
| `superpowers:brainstorming` | `osuperpowers:brainstorming` | Discovery via `grilling`; subagent spec review |
| `superpowers:writing-plans` | `osuperpowers:writing-plans` | Section-by-section plan writes + review; tickets to `docs/superpowers/tickets/` |
| `superpowers:subagent-driven-development` | `osuperpowers:cli-driven-development` | CDD engine — harness CLI three-mode chain |
| `superpowers:finishing-a-development-branch` | `osuperpowers:finishing` | Branch finish / PR; no worktrees; conventional commits |
| `superpowers:test-driven-development` | `mattpocock-skills:tdd` | Red-green loop; direct delegate |
| `superpowers:using-git-worktrees` | `osuperpowers:finishing` | Refuses worktree creation (user policy) |

The same mapping is used for bare `/slug` forms (e.g. `/brainstorming` maps to `osuperpowers:brainstorming`).

## Convention: no skill bodies

This plugin ships **zero SKILL.md files**. All skill bodies live under `packages/osuperpowers/skills/`. The overrides plugin's `packages/osuperpowers-router/skills/` directory must be empty (or absent). This is enforced by the validation scripts — a non-empty skills directory in a trigger-router plugin causes `pnpm run validate` to fail.

## Related files

- `packages/osuperpowers-router/overrides.manifest.json` — trigger-to-target mapping (source of truth)
- `packages/osuperpowers-router/hooks/hooks.json` — Claude Code hooks (UserPromptExpansion)
- `packages/osuperpowers-router/hooks/hooks-cursor.json` — Cursor hooks (beforeSubmitPrompt + preToolUse)
- `packages/osuperpowers-router/bin/prompt-expansion.mjs` — Claude Code hook handler
- `packages/osuperpowers-router/bin/cursor-detect.mjs` — Cursor detect hook handler
- `packages/osuperpowers-router/bin/cursor-enforce.mjs` — Cursor enforce hook handler
- `packages/osuperpowers/skills/` — where all target skill bodies live
