---
name: report-issue
description: Analyzes the current SDD/CDD session for bugs and enhancement opportunities, files GitHub issues against Oscaner/skills via gh CLI. Component labels classify findings into osuperpowers / osuperpowers-router (rule #136). Repo development tool, not a regular workflow skill. Manual trigger only, never automatic.
---

# Osuperpowers Report Issue

Analyze SDD/CDD sessions (`.superpowers/sdd/*/progress.md` + `.superpowers/cdd/*/progress.md` + git log) to find bugs and enhancements, then file issues against `Oscaner/skills` via `gh`. The flow is a digraph: `analyze → classify → confirm → dedup → {resolve-hit} → file → report`. Component labels classify each finding's affected package (`osuperpowers` / `osuperpowers-router`, rule #136). Manual trigger only.

## Flow Digraph

```mermaid
flowchart TD
  A[analyze] --> B[classify]
  B --> C[confirm]
  C -->|confirmed| E[dedup]
  C -->|rejected| Z1((BLOCKED: user-reject))
  E -->|hit| F{resolve-hit}
  E -->|no-hit| G[file]
  F -->|new| G
  F -->|comment| G
  F -->|skip| H((APPROVED: skipped))
  G --> I[report]
  I --> J((APPROVED: report))
```

6 steps / 7 nodes: `analyze` · `classify` · `confirm` · `dedup` · `resolve-hit` (dedup-hit diamond) · `file` · `report`.

## Node Definitions

### analyze

- **Do**: Read three sources in priority order — ① session context (primary): tool-call records / errors / handoff / review findings visible in this session; ② ledger: all files under `{repo}/.superpowers/sdd/*/progress.md` and `{repo}/.superpowers/cdd/*/progress.md`, extracting lines containing `fix round` / `BLOCKED` / `parked` / `deferred` / `CHANGES_REQUESTED`; ③ git log: `git log $(git merge-base HEAD origin/main)..HEAD --oneline`, falling back to `git log -20 --oneline` when `origin/main` is unavailable. Identify repeated fix-round patterns.
- **Read**: session context; `{repo}/.superpowers/{sdd,cdd}/*/progress.md`; git log
- **Exit**: extracted findings → `classify`
- **Fail**: ledger / git log unavailable → use session context only (fail-open, never block)

### classify

- **Do**: Classify each finding as `bug` (tool/script behavior does not match spec — timeouts, wrong exit codes, gate misjudgment, handoff schema errors) or `enhancement` (process can be improved but not broken — DX gaps, missing docs, insufficient CI coverage, template gaps). Each finding includes **Title** (short, usable as issue title directly), **one-line description**, **affected component** (skill name / script path / command), and **evidence** (specific error output or ledger entry). Apply the **#136 component-label classification** to the affected component (see below). When component is ambiguous (cross-plugin or undeterminable), default to `osuperpowers` — do not add an interactive prompt; the user can correct the classification at the `confirm` node.

  **#136 Component-label classification** (which package owns the affected component):
  - ① Affected component ∈ `packages/osuperpowers/` (cdd-task.mjs / runner.mjs / cli-select / orchestration skills / gate) → label `osuperpowers`.
  - ② Affected component ∈ `packages/osuperpowers-router/` (hooks / overrides manifest / prompt-expansion / cursor hooks) → label `osuperpowers-router`.
  - ③ Cross-plugin or undeterminable → default `osuperpowers` (no interactive prompt; user can correct at `confirm`).
  - **CDD dimension**: if the finding involves CDD / cdd-task.mjs / orchestrator / handoff, append `cdd` to the label set.

- **Read**: findings output by `analyze`
- **Exit**: classification complete → `confirm`
- **Fail**: type undeterminable → default `enhancement` (conservative)

### confirm

- **Do**: Present the findings as a numbered list and ask: "Is this accurate overall? Any additions or removals?" Do **not** pre-create any gh issue before explicit confirmation. If the user believes a component classification (`osuperpowers` / `osuperpowers-router` / `cdd`) is wrong, let them correct it here before filing.
- **Read**: classified findings
- **Exit**: user confirms → `dedup`; user rejects → BLOCKED (user-reject)
- **Fail**: no response / explicit rejection → BLOCKED (user-reject, flow terminates)

### dedup

- **Do**: For each confirmed finding, check for duplicates: `gh issue list --repo Oscaner/skills --state open --limit 100 --json number,title,body`. Match keywords — the **affected component name** (e.g. `cdd-task.mjs`, `handoff-writer`, `gate`) plus **core behavior words** (e.g. `timeout`, `CHANGES_REQUESTED`, `exit 137`) — case-insensitively against existing issue titles and bodies.
- **Read**: `gh issue list` output; confirmed findings
- **Exit**: hit → `resolve-hit`; no-hit → `file`
- **Fail**: `gh` unavailable / network failure → fail-open (report, skip filing, suggest manual)

### resolve-hit

- **Do**: When an existing issue matches, show the match and let the user choose three ways: **Create new issue / Add comment to existing / Skip**.
- **Read**: matched issue (number + title + body)
- **Exit**: new → `file`; comment → `file` (comment path); skip → APPROVED (skipped)
- **Fail**: no response → default skip (no duplicate filing)

### file

- **Do**: Run `gh issue create --repo Oscaner/skills` with labels computed per the #136 component classification (`<type>,dogfood,<component>[,cdd]`). On a dedup hit via the comment path, run `gh issue comment --repo Oscaner/skills`. Use the `## Issue Body Templates` prose for the body, chosen by session language × bug/enhancement. Keyword examples must use current tool names (e.g. `cdd-task.mjs`), not deleted legacy tool names.
- **Read**: classified label set; `## Issue Body Templates` prose; finding evidence
- **Exit**: filing complete → `report`
- **Fail**: `gh issue create` fails → fail-open (report stderr, keep finding for manual retry)

### report

- **Do**: Print all results: new issue → URL; appended comment → URL; Skip → list reason.
- **Read**: final action for each finding
- **Exit**: summary → APPROVED (report)
- **Fail**: none (display only)

## Failure Modes

| failure | behavior | reason | recovery |
|---|---|---|---|
| User rejects filing (confirm rejected) | BLOCKED (user-reject) | no issue pre-created without confirmation | flow terminates, no issue created |
| `gh` CLI unavailable / network failure | fail-open (report + suggest manual) | external tool dependency | keep findings for retry |
| dedup hit, user no response | default skip | avoid duplicate filing | no duplicate issue created |
| `gh issue create` fails | fail-open (report stderr) | external API error | keep finding for manual retry |

## Invariants

| # | Invariant |
|---|---|
| I1 | **Confirm Gate** — no gh issue is pre-created before explicit user confirmation (hard gate at `confirm`) |
| I2 | **Component-Label** — label classifies by the affected package (`osuperpowers` / `osuperpowers-router`), never hardcodes `osuperpowers-router` (#136) |
| I3 | **Manual Trigger Only** — report-issue runs only on manual trigger, never automatically |

## Issue Body Templates

Choose the template by session language (detect from the user's most recent messages; default English) and finding type (bug / enhancement). These are prose payloads kept verbatim from the prior version, not node-ized.

### Bug — English

```markdown
## Context

<!-- dogfood session context: branch, date, osuperpowers skills in use -->

## Problem

<!-- what happened, with exact error messages or tool output -->

## Impact

<!-- what this blocked or degraded -- token cost, extra rounds, incorrect state -->

## Suggested fix

<!-- concrete suggestion, or "Under investigation" -->

## Related

<!-- links to related issues or commits, if known -->
```

### Bug — Chinese

```markdown
## 背景

<!-- Dogfood session 上下文：分支、日期、使用了哪些 osuperpowers skill -->

## 问题

<!-- 发生了什么，尽量附上具体报错信息或工具输出 -->

## 影响

<!-- 阻塞或降级了什么——token 消耗、额外轮次、状态错误等 -->

## 建议修复

<!-- 具体建议；若暂不清楚则写"待排查" -->

## 相关

<!-- 相关 issue 链接或 commit，如有 -->
```

### Enhancement — English

```markdown
## Context

<!-- dogfood session context: branch, date, osuperpowers skills in use -->

## Current behavior

<!-- what happens today -->

## Desired behavior

<!-- what should happen instead -->

## Suggested approach

<!-- concrete suggestion, or "Open for discussion" -->

## Related

<!-- links to related issues or commits, if known -->
```

### Enhancement — Chinese

```markdown
## 背景

<!-- Dogfood session 上下文：分支、日期、使用了哪些 osuperpowers skill -->

## 当前行为

<!-- 目前的实际表现 -->

## 期望行为

<!-- 应该是什么表现 -->

## 建议方案

<!-- 具体建议；若暂不清楚则写"欢迎讨论" -->

## 相关

<!-- 相关 issue 链接或 commit，如有 -->
```
