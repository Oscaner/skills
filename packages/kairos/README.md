# @oscaner-skills/kairos

[English](README.md) | [中文](README.zh-CN.md)

Six `cdd-*` skills that carry a change from design to close, plus the engine that judges every round they dispatch. Packaged as an installable plugin for AI coding harnesses (verified on **Claude Code** and **Pi**).

## The kairos philosophy

kairos is the distribution vehicle for a cdd-first methodology: it packages **continuously-discovered development** as installable skills and puts the deterministic `cdd` engine behind the whole flow. The methodology itself — the reasoning, the convergence rule, the diagrams — lives in the repository [README](../README.md).

- **cdd as the core discipline.** Work runs through the three-mode chain — implement → review → fix — and every phase closes under one convergence rule instead of a deadline.
- **Orchestration as the flow layer.** The skills carry the conversation and the documents: the clarifying questions, the spec and the plan written under structured review, the branch close-out. A phase ends with a review, never with an assumption.
- **The engine as the execution layer.** The `cdd` CLI makes the chain deterministic — same plan, same brief, same commands, same outcome. It dispatches each round, judges the terminal verdict and derives the next hop, so no skill re-implements its mechanics.

## Skills

Six skills share the `cdd-*` family name. Five carry a phase of the chain; `cdd-report` stands outside it.

| Skill | Type | Description |
|-------|------|-------------|
| `cdd-design` | Orchestrator | Brainstorm routing (mode/register/size gates); dispatches the parameterized spec-writer (single-spec / phase-spec / overall charter) |
| `cdd-spec-writer` | Spec-writer | The merged single-spec / phase-spec / overall writer: authors, reviews, and commits the target spec under one parameterized flow |
| `cdd-plan` | Orchestrator | Plan authoring (backfill-design gate · plan write authority); plan review-fix rhythm; hands off to `cdd-dev` |
| `cdd-dev` | Orchestrator + Engine | Plan executor (CLI-only); dispatches the implement / review / fix chain + the `cdd base` artifact; final branch review |
| `cdd-close` | Orchestrator | Branch finish / PR; ends at the finish gate + terminal; no worktrees; conventional commits |
| `cdd-report` | Utility | Files one aggregate GitHub issue for CDD-session bugs and enhancement opportunities (gh CLI, dedup-aware); one-shot chain; manual trigger |

Every orchestrator presents its artifact — together with the self-check conclusion that approved it — and stops for your explicit approval before its first dispatch.

## Installation

```bash
npx -y @oscaner-skills/cdd-engine@latest init --harness=claude
npx -y @oscaner-skills/cdd-engine@latest init --harness=pi
```

`cdd init` installs `kairos` and its two upstream packages (superpowers, mattpocock-skills) in order, through the harness's own command channel — the first three rows below are that install contract. The six rows after them are the recommended tier: pi capability packages that Claude Code already carries natively, installed only when you pass `--include-recommends`. Add `--update` to refresh an installed set rather than installing one, and drop the `npx -y @oscaner-skills/cdd-engine@latest` prefix once `cdd` is installed globally.

For manual installation without the engine, run the commands in one cell one at a time — `；` separates them for display and is not a shell separator. `—` marks a package the harness does not need:

| Package | Claude Code | Pi |
|---------|-------------|-----|
| superpowers | `claude plugin marketplace add obra/superpowers-marketplace；claude plugin install superpowers@superpowers-marketplace` | `pi install git:github.com/obra/superpowers` |
| mattpocock-skills | `claude plugin marketplace add mattpocock/skills；claude plugin install mattpocock-skills@mattpocock` | `pi install git:github.com/mattpocock/skills` |
| kairos | `claude plugin marketplace add oscaner/skills；claude plugin install kairos@oscaner-skills` | `pi install npm:@oscaner-skills/kairos` |
| pi-fff | — | `pi install npm:@ff-labs/pi-fff` |
| rpiv-todo | — | `pi install npm:@juicesharp/rpiv-todo` |
| rpiv-ask-user-question | — | `pi install npm:@juicesharp/rpiv-ask-user-question` |
| pi-web-access | — | `pi install npm:pi-web-access` |
| pi-background-tasks | — | `pi install npm:pi-background-tasks` |
| pi-agentsmd | — | `pi install npm:pi-agentsmd` |

### The recommended tier

Claude Code ships six capabilities natively that pi needs a package for — file search, todo tracking, structured questioning, web access, background tasks and `AGENTS.md` injection:

- `pi-fff` — file search
- `rpiv-todo` — todo tracking
- `rpiv-ask-user-question` — structured questioning
- `pi-web-access` — web access
- `pi-background-tasks` — background tasks
- `pi-agentsmd` — the `AGENTS.md` project-instruction injection the workflow assumes

They are opt-in: `cdd init --harness=pi --include-recommends` installs them beside the core three, and `cdd init --harness=pi --update --include-recommends` refreshes them. Claude Code needs neither the flag nor the packages.

## Quick start

1. Install the plugin set with `cdd init --harness=<claude|pi>` — see [Installation](#installation).
2. Invoke the first orchestrator. It hands off to `cdd-spec-writer`, `cdd-plan`, `cdd-dev` and `cdd-close` in turn, each one following the engine's `next:` line.
3. Watch the same judgment as a board with `cdd board --plan <path>`.

In Claude Code, a skill is invoked by its qualified name; pi uses the bare form:

```bash
# Claude Code
/kairos:cdd-design    # start a phase: design conversation
/kairos:cdd-plan      # or re-enter at the plan

# pi
/skill:cdd-design
```

Nothing else needs setting up. Every skill fetches the engine on demand, and run state lives under `.kairos/cdd/` — the workspace publishes `.kairos/.gitignore` (content `*`) at first dispatch, so run artifacts stay out of your commits and out of the clean-tree gate the engine reads.

## CDD engine CLI

The engine ships as the standalone `@oscaner-skills/cdd-engine` package; its single CLI runner is `cdd` (implement / review / fix / base / schema / issue / board / init). It dispatches each phase to the host harness CLI through its embedded harness registry — the per-harness invocation and output contract:

| Identifier | CLI binary | Host marker | Ship |
|------------|------------|-------------|------|
| claude | `claude` | `CLAUDE_CODE_SESSION_ID` | full |
| pi | `pi` | `AI_AGENT=pi` | full |

`cdd schema get <type>` prints the engine's canonical doc-structure schema straight to stdout (discovery-only, byte-identical to the shipped schema), and `cdd issue render` builds an aggregate issue body from stdin findings (pure rendering, zero enforcement). The full reference is [the cdd-engine README](../cdd-engine/README.md).

## Co-existing with upstream plugins

kairos ships every skill under the `cdd-*` family name, so coexistence is structural rather than a convention: pi's flat namespace has no qualification syntax, and the unique bare names keep every kairos skill unambiguous beside any upstream plugin. Inline references are harness-conditional — Claude Code resolves a plugin-qualified import such as `/superpowers:*` to the owning package, while pi invokes the bare `/skill:<name>`, where `cdd-*` uniqueness does the same job.

Repository architecture and the developer/engine journey are drawn in the bilingual [diagram set](../../docs/diagrams/index.html).

## License

MIT