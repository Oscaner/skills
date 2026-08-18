# superpowers-overrides

[English](README.md) | [简体中文](README.zh-CN.md)

**Trigger router** for [superpowers](https://github.com/obra/superpowers) + [engineering](../engineering/). This plugin ships **no skill bodies** — it intercepts upstream `superpowers:*` triggers and routes them to the matching **engineering** orchestrator (`os-*` / `cli-*`) or a **mattpocock-skills** delegate (`tdd`).

## What it does

When you invoke `/brainstorming`, `/writing-plans`, or any other superpowers skill, the router fires first and the matching target loads:

- `engineering:os-*` — flow orchestrators that read upstream and apply personal rules
- `engineering:cli-driven-development` — CDD engine skills
- `mattpocock-skills:tdd` — implementation delegate for `/test-driven-development`

Three layers keep the route from being skipped:

1. **Trigger table** — every upstream entry point maps to its target in `overrides.manifest.json` (single source of truth)
2. **Hooks (plugin-bundled)** — Claude Code: `UserPromptExpansion` matchers; Cursor: `beforeSubmitPrompt` detect + `preToolUse` enforce
3. **Project rules** — `os-init spor` writes self-check rules into your project (`CLAUDE.md` or `.cursor/rules/superpowers-overrides.mdc`)

## Router targets

| Trigger | Target | What it does |
|---------|--------|--------------|
| `/brainstorming` | `engineering:os-brainstorming` | Delegates discovery to `grilling`; subagent spec review |
| `/writing-plans` | `engineering:os-writing-plans` | Section-by-section plan writes + review; tickets to `docs/superpowers/tickets/` |
| `/subagent-driven-development` | `engineering:cli-driven-development` | CDD engine — harness CLI three-mode chain |
| `/executing-plans` | `engineering:os-executing-plans` | Three-mode orchestrator (in-session / subagent / cli) |
| `/finishing-a-development-branch` | `engineering:os-finishing` | Branch finish / PR; no worktrees; conventional commits |
| `/systematic-debugging` | `engineering:os-debugging` | Evidence before fixes; delegates to `diagnosing-bugs` |
| `/test-driven-development` | `mattpocock-skills:tdd` | Red-green loop; seam confirmation gate |
| `/verification-before-completion` | `engineering:os-verification` | No completion claims without verification evidence |
| `/receiving-code-review` | `engineering:os-code-review` | Unclear feedback goes to `grilling`; fixes go to `tdd` |
| `/using-git-worktrees` | `engineering:os-finishing` | Refuses worktree creation (user policy) |

## Installation

```bash
npm install @oscaner-skills/superpowers-overrides
```

Or install from the oscaner-skills marketplace alongside the companion plugins (`superpowers`, `engineering`, `mattpocock-skills`).

## Quick start

1. Install `superpowers`, `superpowers-overrides`, `engineering`, and `mattpocock-skills` from the marketplace.
2. Run **`os-init spor`** in each project (re-run after plugin upgrades).
3. Invoke upstream superpowers skills — the router routes automatically.

### Claude Code

- Workflow: `/superpowers:brainstorming`, `/superpowers:writing-plans`, ...
- Init: `/os-init spor` writes self-check block to project `CLAUDE.md`.

### Cursor

- Workflow: bare upstream slash (`/brainstorming`) or rules-based intercept.
- Init: `os-init spor` writes `.cursor/rules/superpowers-overrides.mdc`.
- Hooks ship with the plugin; **do not** add project `.cursor/hooks.json`.

## License

[MIT](LICENSE)
