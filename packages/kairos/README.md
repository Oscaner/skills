# @oscaner-skills/kairos

[English](README.md) | [中文](README.zh-CN.md)

Personal AI coding skills — kairos orchestration, the `cdd-*` CDD engine family, and the cdd-report repo utility — packaged as an installable plugin for AI coding harnesses (verified on **Claude Code**, **Cursor Agent**, and **Pi**).

## The kairos philosophy

kairos is the distribution vehicle for a cdd-first methodology: it packages the practice of **continuously-discovered development** as installable skills and puts the deterministic `cdd` engine behind the whole flow (see the repository [README](../README.md) for the full methodology).

- **cdd as the core discipline.** Development runs through the three-mode chain — implement → review → fix — driven by the plan, and every phase closes under the same convergence rule.
- **Orchestration as the flow layer.** The orchestrator skills carry the flow: clarifying questions, spec and plan writing with structured review, and branch close-out — each phase closed by a review rather than by assumption.
- **The engine as the execution layer.** The `cdd` CLI makes the chain deterministic — same plan, same brief, same commands, same outcome. The engine dispatches each phase to the host harness and writes the handoff artifacts; skills never re-implement its mechanics.

## What it does

Six `cdd-*` skills across three families:

- **kairos orchestration** — flow orchestrators that read upstream `superpowers` baselines and apply this plugin's personal rules (clarifying questions via `grilling`, the spec review-fix rhythm under the engine's `next:` route facts, and so on): `cdd-design` (brainstorm routing + a parameterized spec-writer dispatch), `cdd-plan` (plan authoring), `cdd-close` (branch finish)
- **`cdd-spec-writer`** — the parameterized spec-writer (single / phase-spec / overall under one merged flow): authors, reviews, and commits the target spec
- **`cdd-dev`** — the plan executor: the `cdd` engine CLI (`@oscaner-skills/cdd-engine`) implements / reviews / fixes each wave, driven by the engine's `next:` route facts
- **cdd-report** — repository development utility that files one aggregate GitHub issue for CDD-session bugs and enhancement opportunities (gh CLI, dedup-aware, manual trigger, one-shot chain)

## Skills

| Skill | Type | Description |
|-------|------|-------------|
| `cdd-design` | Orchestrator | Brainstorm routing (mode/register/size gates); dispatches the parameterized spec-writer (single / phase-spec / overall charter) |
| `cdd-spec-writer` | Spec-writer | The merged single / phase-spec / overall writer: authors, reviews, and commits the target spec under one parameterized flow |
| `cdd-plan` | Orchestrator | Plan authoring (backfill-design gate · Plan Sole Writer); plan review-fix rhythm; hands off to `cdd-dev` |
| `cdd-dev` | Orchestrator + Engine | Plan executor (CLI-only); dispatches the implement / review / fix chain + the `cdd base` artifact; final branch review |
| `cdd-close` | Orchestrator | Branch finish / PR; ends at the finish gate + terminal; no worktrees; conventional commits |
| `cdd-report` | Utility | Files one aggregate GitHub issue for CDD-session bugs and enhancement opportunities (gh CLI, dedup-aware); one-shot chain; manual trigger |

## Installation

Install from the oscaner-skills Claude Code marketplace:

```bash
claude plugin marketplace add oscaner/skills
claude plugin install kairos@oscaner-skills
```

### From pi

```bash
pi install npm:@oscaner-skills/kairos
```

Installs the latest release and writes pi's project settings. The six `cdd-*` skills are then visible under their bare names in pi's flat namespace — `cdd-design`, `cdd-plan`, and the rest.

## Quick start

1. Install `superpowers`, `kairos`, and `mattpocock-skills` from the marketplace (see the repository README for per-harness install).
2. No install prerequisite — every kairos skill invokes the engine on demand via `npx -y @oscaner-skills/cdd-engine@latest <subcommand>` (zero global-install precondition; the retired `detect-engine` gate is gone).
3. Add `.kairos` to your project's `.gitignore` — the engine keeps its per-dispatch run state (round handoffs, ledgers, briefs) under `.kairos/cdd/` in the repo root. The clean-tree dispatch gate already ignores its own workspace (the engine's run artifacts never read as uncommitted user work), but keeping them untracked keeps them out of your commits and branch diffs.
4. Invoke kairos skills — the `/kairos:<skill>` slash form in Claude Code and Cursor Agent:

```bash
# Claude Code
/kairos:cdd-design    # → cdd-design
/kairos:cdd-plan    # → cdd-plan

# Cursor Agent
/kairos:cdd-design    # → cdd-design
/kairos:cdd-plan    # → cdd-plan
```

## CDD engine CLI

The CDD engine ships as the standalone `@oscaner-skills/cdd-engine` package; its single CLI runner is `cdd` (implement / review / fix / base / schema / issue). It dispatches each phase to the host harness CLI via the engine's embedded harness registry (per-harness invocation and output contract):

| Identifier | CLI binary | Host marker | Ship |
|------------|------------|-------------|------|
| claude | `claude` | `CLAUDE_CODE_SESSION_ID` | full |
| cursor | `cursor-agent` | `CURSOR_TRACE_ID` | full |
| pi | `pi` | `AI_AGENT=pi` | full |

`cdd schema get <type>` prints the engine's canonical doc-structure schema straight to stdout (discovery-only, byte-identical to the shipped schema), and `cdd issue render` builds an aggregate issue body from stdin findings (pure rendering, zero enforcement). See [the cdd-engine README](../cdd-engine/README.md) for the full CLI reference.

## Co-existing with upstream plugins

kairos ships every skill as `cdd-*`, so the family coexists with upstream plugins without conflict by construction: pi's flat namespace has no namespace-qualification syntax, and the unique `cdd-*` bare names keep every kairos skill unambiguous alongside any upstream plugin. Inline skill references are harness-conditional — Claude Code and Cursor Agent support plugin-qualified imports like `/superpowers:*`, which always resolve to the owning package, while pi invokes bare `/skill:<name>` only, where `cdd-*` uniqueness guarantees an unambiguous target.

### Upstream dependency install

The orchestrator skills import upstream flows as their session baseline (superpowers / mattpocock-skills / impeccable). Install them per harness from their own publishers — kairos installs through each harness's own channel:

| Package | Claude Code | Cursor Agent | Pi |
|---------|-------------|--------------|-----|
| kairos | `claude plugin marketplace add oscaner/skills；claude plugin install kairos@oscaner-skills` | pending | `pi install npm:@oscaner-skills/kairos` |
| superpowers | `claude plugin marketplace add obra/superpowers-marketplace；claude plugin install superpowers@superpowers-marketplace` | pending | `pi install git:github.com/obra/superpowers` |
| mattpocock-skills | `claude plugin marketplace add mattpocock/skills；claude plugin install mattpocock-skills@mattpocock` | pending | `pi install git:github.com/mattpocock/skills` |
| impeccable | `claude plugin marketplace add pbakaus/impeccable；claude plugin install impeccable@impeccable` | pending | `npx impeccable install --providers=pi --scope=global -y` |

The Cursor Agent column is `pending` — install each plugin from its official channel (see the repository [Plugins](../README.md#plugins) table — each plugin links its GitHub home, where the current install command is published).

## Docs for maintainers

Repository-internal maintenance docs for this monorepo's developers (not shipped with the plugin). The [docs/maintainers index](../../docs/maintainers/README.md) links the numbered family — e.g. [program experience](../../docs/maintainers/04-program-experience.md) and the [template doctrine](../../docs/maintainers/01-template-doctrine.md) that governs emit-generated products.

## License

MIT
