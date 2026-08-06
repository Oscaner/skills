# superpowers-overrides

[English](README.md) | [简体中文](README.zh-CN.md)

Personal overrides for [superpowers](https://github.com/obra/superpowers). Each `spor-*` skill runs **before** its upstream target — replacing behavior or delegating to [mattpocock-skills](../mattpocock-skills/).

## What overrides do

When you invoke `/brainstorming`, `/writing-plans`, or any other superpowers skill, the matching `spor-*` override loads first. It either **replaces** upstream steps (e.g. self-review → fresh subagent passes) or **delegates** to mattpocock skills (e.g. clarifying questions → `grilling`, implementation → `tdd`).

Three layers keep overrides from being skipped:

1. **Skill description** — four-trigger frontmatter; override must be the first tool call.
2. **Hooks (plugin-bundled)** — Claude Code: `UserPromptExpansion` with triple matchers (`^superpowers:`, bare `/<slug>`, `^/spor-<slug>`). Cursor: `beforeSubmitPrompt` detect + `preToolUse` enforce via `hooks/hooks-cursor.json`. **No project hook files.**
3. **Project rules** — `/spor-init` writes self-check rules into your project (`CLAUDE.md` or `.cursor/rules/superpowers-overrides.mdc`); fallback on Cursor when hooks miss.

## Workflow

Simplified main-path diagram — not a complete skill inventory. Overall/phase, policy, cross-cutting skills, and `spor-receiving-code-review` are in the table below.

```mermaid
flowchart LR
  subgraph discover["Discover"]
    B[spor-brainstorming]
  end
  subgraph plan["Plan"]
    W[spor-writing-plans]
  end
  subgraph build["Build"]
    SDD[spor-subagent-driven-development]
    EP[spor-executing-plans]
    TDD[spor-test-driven-development]
    DBG[spor-systematic-debugging]
  end
  subgraph ship["Ship"]
    V[spor-verification-before-completion]
    F[spor-finishing-a-development-branch]
  end
  B --> W --> SDD --> V --> F
  EP -.-> SDD
  TDD -.-> SDD
  DBG -.-> SDD
```

**Overall + phase:** large scope → write an overall spec and get decomposition approval → explicit gate → per-phase discover→ship cycle. The main README ASCII pipeline includes Phase spec; this diagram shows the per-phase skill intercept chain from Discover onward.

## Skills by phase

| Phase | Skill | What it does |
|-------|-------|--------------|
| Setup | `spor-init` | Project wiring; run once after install |
| Discover | `spor-brainstorming` | Delegates discovery to `grilling`; subagent spec review; overall/phase for large scope |
| Plan | `spor-writing-plans` | Section-by-section plan writes + review; tickets to `docs/superpowers/tickets/` |
| Build | `spor-subagent-driven-development` | Complexity-based review rounds; implementers delegate to `tdd` |
| Build | `spor-executing-plans` | Plan execution; redirects to SDD when subagents available; per-task commits |
| Build | `spor-test-driven-development` | Confirms seams with user; delegates loop to mattpocock `tdd` |
| Build | `spor-systematic-debugging` | Evidence before fixes; delegates to `diagnosing-bugs` |
| Ship | `spor-verification-before-completion` | No completion claims without verification evidence |
| Ship | `spor-finishing-a-development-branch` | Branch finish / PR; no worktrees; conventional commits |
| Ship | `spor-receiving-code-review` | Unclear feedback → `grilling`; fixes → `tdd` (not in diagram — often mid-build or pre-ship) |
| Policy | `spor-using-git-worktrees` | Refuses worktree creation (user policy) |
| Cross-cutting | `spor-subagent-lifecycle` | Fresh subagent per pass; concurrency rules (referenced, no slash) |
| Cross-cutting | `spor-token-efficient-review-dispatch` | D1/D2/D3/D4 review dispatch (referenced, no slash) |
| Cross-cutting | `spor-token-efficient-controller-handoff` | H1–H5 SDD orchestrator file-only handoff (referenced, no slash) |
| Cross-cutting | `spor-handoff-writer` | handoff.json writer subagent (referenced, no slash) |
| Cross-cutting | `spor-report-issue` | Analyse spor session findings and file GitHub issues via gh CLI; manual only |

## Usage

### Common

1. Install `superpowers`, `superpowers-overrides`, and `mattpocock-skills` from the oscaner marketplace.
2. Run **`/spor-init`** in each project (re-run after plugin upgrades).
3. Invoke upstream superpowers skills — overrides intercept automatically.

### Claude Code

- Workflow: `/superpowers:brainstorming`, `/superpowers:writing-plans`, …
- Init: `/superpowers-overrides:spor-init` → writes self-check block to project `CLAUDE.md`.

### Cursor

- Workflow: `/spor-brainstorming`, `/spor-writing-plans`, … (or rules-based intercept).
- Init: `/spor-init` → writes `.cursor/rules/superpowers-overrides.mdc`.
- Hooks: install plugin from marketplace — detect/enforce ship with the plugin; **do not** add project `.cursor/hooks.json`.
- See [cross-harness-overrides.md](docs/cross-harness-overrides.md).

### Manual skill attach

**Do:**

- Use `/spor-brainstorming` (etc.) or bare upstream slash (`/brainstorming`) — hooks + rules intercept automatically.
- Attach **`spor-*`** skill files if you need inline context (e.g. `spor-brainstorming/SKILL.md`).

**Don't:**

- Attach upstream `superpowers/*/SKILL.md` body — inline upstream checklists override spor discipline even when hooks fire. If you must reference upstream, use slash commands or the agent skills list instead.

Hooks and enforcement scripts are **plugin-bundled** (same model as upstream `superpowers`). Consumer projects should never gain new hook files from `spor-init`.

## SDD CLI harness scripts

Token-efficient SDD orchestration (`spor-token-efficient-controller-handoff`) dispatches via plugin-bundled scripts under `bin/`. Orchestrator resolves harness once; scripts live in `{plugin_root}/bin/`.

| Harness | Task script | Plan script | Ship level |
|---------|-------------|-------------|------------|
| **cursor** | `sdd-run-task-cursor.sh` | `sdd-run-plan-cursor.sh` | **Full** — `cursor agent` |
| **claude** | `sdd-run-task-claude.sh` | `sdd-run-plan-claude.sh` | **Full** — `claude` |
| **codex** | `sdd-run-task-codex.sh` | `sdd-run-plan-codex.sh` | **Stub** — exit 1 BLOCKED |
| **copilot** | `sdd-run-task-copilot.sh` | `sdd-run-plan-copilot.sh` | **Stub** — exit 1 BLOCKED |
| **gemini** | `sdd-run-task-gemini.sh` | `sdd-run-plan-gemini.sh` | **Stub** — exit 1 BLOCKED |

Shared library: `bin/lib/sdd-common.sh` (workspace paths, plugin root resolution, exit codes).

**Mode A (per task):** `sdd-run-task-<harness>.sh --task N --mode implement|handoff|review|fix`

**Mode B (plan driver / AFK):** `sdd-run-plan-<harness>.sh --plan <path>` — pending tasks × 4-mode chain.

Stub harness → exit 1 → orchestrator **BLOCKED** (not in-session p0 fallback). CLI missing → exit 2 → p0 fallback. See [cross-harness-overrides.md](docs/cross-harness-overrides.md#sdd-cli-harness-scripts-p1).

## Docs for maintainers

- [cross-harness-overrides.md](docs/cross-harness-overrides.md)
- [CLAUDE.md](../../CLAUDE.md) — override pattern, contributor guide
- [CHANGELOG.md](CHANGELOG.md)

## License

[MIT](LICENSE)
