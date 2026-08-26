# osuperpowers-router

[English](README.md) | [简体中文](README.zh-CN.md)

**Trigger router** for [superpowers](https://github.com/obra/superpowers) + [osuperpowers](../osuperpowers/). This plugin ships **no skill bodies** — it intercepts upstream `superpowers:*` triggers and routes them to the matching **osuperpowers** orchestrator (`osuperpowers:*` / `cli-*`) or a **mattpocock-skills** delegate (`tdd`).

## What it does

When you invoke `/brainstorming`, `/writing-plans`, or any other superpowers skill, the router fires first and the matching target loads:

- `osuperpowers:*` — flow orchestrators that read upstream and apply personal rules
- `osuperpowers:cli-driven-development` — CDD engine skills
- `mattpocock-skills:tdd` — implementation delegate for `/test-driven-development`

Three layers keep the route from being skipped:

1. **Trigger table** — every upstream entry point maps to its target in `overrides.manifest.json` (single source of truth)
2. **Hooks (plugin-bundled)** — Claude Code: `UserPromptExpansion` matchers; Cursor: `beforeSubmitPrompt` detect + `preToolUse` enforce
3. **Project rules** — `init router` writes self-check rules into your project (`CLAUDE.md` or `.cursor/rules/osuperpowers-router.mdc`)

## Router targets

| Trigger | Target | What it does |
|---------|--------|--------------|
| `/brainstorming` | `osuperpowers:brainstorming` | Delegates discovery to `grilling`; subagent spec review |
| `/writing-plans` | `osuperpowers:writing-plans` | Section-by-section plan writes + review; tickets to `docs/superpowers/tickets/` |
| `/subagent-driven-development` | `osuperpowers:cli-driven-development` | CDD engine — harness CLI three-mode chain |
| `/finishing-a-development-branch` | `osuperpowers:finishing` | Branch finish / PR; no worktrees; conventional commits |
| `/test-driven-development` | `mattpocock-skills:tdd` | Red-green loop; seam confirmation gate |
| `/using-git-worktrees` | `osuperpowers:finishing` | Refuses worktree creation (user policy) |

## Installation

```bash
npm install @oscaner-skills/osuperpowers-router
```

Or install from the oscaner-skills marketplace alongside the companion plugins (`superpowers`, `osuperpowers`, `mattpocock-skills`).

## Quick start

1. Install `superpowers`, `osuperpowers-router`, `osuperpowers`, and `mattpocock-skills` from the marketplace.
2. Run **`init router`** in each project (re-run after plugin upgrades).
3. Invoke upstream superpowers skills — the router routes automatically.

### Claude Code

- Workflow: `/superpowers:brainstorming`, `/superpowers:writing-plans`, ...
- Init: `/init router` writes self-check block to project `CLAUDE.md`.

### Cursor

- Workflow: bare upstream slash (`/brainstorming`) or rules-based intercept.
- Init: `init router` writes `.cursor/rules/osuperpowers-router.mdc`.
- Hooks ship with the plugin; **do not** add project `.cursor/hooks.json`.

## License

[MIT](LICENSE)
