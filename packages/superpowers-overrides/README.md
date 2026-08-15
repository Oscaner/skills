# superpowers-overrides

[English](README.md) | [简体中文](README.zh-CN.md)

**Trigger router** for [superpowers](https://github.com/obra/superpowers) + [engineering](../engineering/). This plugin ships **no skill bodies** — it intercepts upstream superpowers triggers and routes them to the matching **engineering** orchestrator (`os-*` / `cli-*`) or a **mattpocock-skills** delegate (`tdd`). Personal overrides live in engineering's `os-*` skills, which read the upstream baseline and apply personal rules.

## What the router does

When you invoke `/brainstorming`, `/writing-plans`, or any other superpowers skill, the router fires first and the matching target loads:

- `engineering:os-*` — flow orchestrators that read upstream and apply personal rules (e.g. clarifying questions → `grilling`, spec review → fresh subagent passes)
- `engineering:cli-driven-development` / `cli-*` — cdd engine skills
- `mattpocock-skills:tdd` — implementation delegate for `/test-driven-development`

Three layers keep the route from being skipped:

1. **Trigger table** — every upstream entry point maps to its target in `overrides.manifest.json` (single source of truth).
2. **Hooks (plugin-bundled)** — Claude Code: `UserPromptExpansion` matchers. Cursor: `beforeSubmitPrompt` detect + `preToolUse` enforce via `hooks/hooks-cursor.json`. **No project hook files.**
3. **Project rules** — `os-init spor` (from engineering) writes self-check rules into your project (`CLAUDE.md` or `.cursor/rules/superpowers-overrides.mdc`); fallback on Cursor when hooks miss.

## Router targets

| Trigger | Target | What it does |
|---------|--------|--------------|
| `/brainstorming` | `engineering:os-brainstorming` | Delegates discovery to `grilling`; subagent spec review; overall/phase for large scope |
| `/writing-plans` | `engineering:os-writing-plans` | Section-by-section plan writes + review; tickets to `docs/superpowers/tickets/` |
| `/subagent-driven-development` | `engineering:cli-driven-development` | cdd engine — harness CLI three-mode chain (implement/review/fix) |
| `/executing-plans` | `engineering:os-executing-plans` | Three-mode orchestrator (in-session / subagent / cli) |
| `/finishing-a-development-branch` | `engineering:os-finishing` | Branch finish / PR; no worktrees; conventional commits |
| `/systematic-debugging` | `engineering:os-debugging` | Evidence before fixes; delegates to `diagnosing-bugs` |
| `/test-driven-development` | `mattpocock-skills:tdd` | Red→green loop; seam confirmation gate in engineering templates |
| `/verification-before-completion` | `engineering:os-verification` | No completion claims without verification evidence |
| `/receiving-code-review` | `engineering:os-code-review` | Unclear feedback → `grilling`; fixes → `tdd` |
| `/using-git-worktrees` | `engineering:os-finishing` | Refuses worktree creation (user policy) |

## Usage

### Common

1. Install `superpowers`, `superpowers-overrides`, `engineering`, and `mattpocock-skills` from the oscaner marketplace.
2. Run **`os-init spor`** in each project (re-run after plugin upgrades).
3. Invoke upstream superpowers skills — the router routes automatically.

### Claude Code

- Workflow: `/superpowers:brainstorming`, `/superpowers:writing-plans`, …
- Init: `/os-init spor` → writes self-check block to project `CLAUDE.md`.

### Cursor

- Workflow: bare upstream slash (`/brainstorming`) or rules-based intercept.
- Init: `os-init spor` → writes `.cursor/rules/superpowers-overrides.mdc`.
- Hooks: install plugin from marketplace — detect/enforce ship with the plugin; **do not** add project `.cursor/hooks.json`.
- See [cross-harness-overrides.md](docs/cross-harness-overrides.md).

### Manual skill attach

**Do:**

- Use bare upstream slash (`/brainstorming`) — hooks + rules route automatically.
- Attach **engineering `os-*`** skill files if you need inline context (e.g. `os-brainstorming/SKILL.md`).

**Don't:**

- Attach upstream `superpowers/*/SKILL.md` body — inline upstream checklists override the router discipline even when hooks fire. If you must reference upstream, use slash commands or the agent skills list instead.

Hooks and enforcement scripts are **plugin-bundled** (same model as upstream `superpowers`). Consumer projects should never gain new hook files from the router.

## CDD CLI harness scripts

Token-efficient CDD orchestration dispatches via plugin-bundled scripts — `os-executing-plans` orchestrates, `cli-driven-development` drives the harness chain. The orchestrator resolves harness once; the single CLI runner is `engineering/bin/engine/cdd-run.sh`.

| Harness | CLI binary | Ship level |
|---------|------------|------------|
| **claude** | `claude` | **Full** — `claude -p … --output-format text --dangerously-skip-permissions` |
| **cursor-agent** | `cursor-agent` | **Full** — `cursor-agent --print --output-format text --force` |
| **droid** | `droid` | **Full** — `droid exec --auto medium --output-format stream-json` |
| **pi** | `pi` | **Full** — `pi -p --no-session --no-approve` |
| **codex** | `codex` | **Not-supported** — exit 1 BLOCKED |
| **copilot** | `copilot` | **Not-supported** — exit 1 BLOCKED |
| **gemini** | `gemini` | **Not-supported** — exit 1 BLOCKED |

Shared library: `engineering/bin/engine/lib/cdd-common.sh` (workspace paths, plugin root resolution, exit codes) carries the task/plan run-loop (`cdd_run_task` / `cdd_run_plan`); `engineering/bin/engine/cdd-run.sh` is the single CLI runner (`--harness <name> --task N --mode M` | `--plan <path>`).

**Mode A (per task):** `{engineering}/bin/engine/cdd-run.sh --harness <name> --task N --mode implement|review|fix`

**Mode B (plan driver / AFK):** `{engineering}/bin/engine/cdd-run.sh --harness <name> --plan <path>` — pending tasks × 3-mode chain.

Not-supported harness → exit 1 → orchestrator **BLOCKED** (not in-session p0 fallback). CLI missing → exit 2 → orchestrator **BLOCKED**. See [cross-harness-overrides.md](docs/cross-harness-overrides.md#cdd-cli-harness-scripts-p1).

## Docs for maintainers

- [cross-harness-overrides.md](docs/cross-harness-overrides.md)
- [CLAUDE.md](../../CLAUDE.md) — override pattern, contributor guide
- [CHANGELOG.md](CHANGELOG.md)

## License

[MIT](LICENSE)
