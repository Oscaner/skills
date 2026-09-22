---
name: writing-single-spec
description: Independent single-spec writer -- Node-anchored flow with digraph as single control-flow source of truth. Consumes the /superpowers:brainstorming (writing-spec) design flow inline as this session's baseline, then authors the single spec free-form, runs the cdd spec review-fix loop, commits on approval, and hands off to writing-plans. Callable standalone.
---

# Osuperpowers Single-Spec Writing

Writes a single (non-phase) spec from the writing-spec import, reviews it under the cdd spec contract, commits it on approval, and hands it off to writing-plans. Single specs have no canonical structure schema and no parent overall to sync — the docs-lane doc-contract gate still asserts the minimal spec face: a `- **Version**: vX.Y · <date>` header line.

## Flow Digraph

```mermaid
flowchart TD
  A[run-writing-spec-session] -->|landed| C[author-spec]
  A -->|missing| Z1((BLOCKED: install superpowers))
  C --> D[spec-review]
  D --> E{blocker=0?}
  E -->|no| F[fix-spec]
  E -->|yes| F
  F -->|entered via blocker>0| D
  F -->|entered via blocker=0| H[commit-spec]
  H --> I[handoff-writing-plans]
```

## Skeleton deltas

| skeleton node | writing-single-spec |
|---|---|
| read-schema | N/A — no canonical structure schema (single specs are authored free-form; the `- **Version**: vX.Y · <date>` header line the docs-lane gate asserts is the only structural constant) |
| scope changed? | N/A |
| sync-overall | N/A |
| review loop (D/E/F) | shared shape — no delta (only the `--spec <path>` target differs: this skill's own product) |
| handoff-spec | `handoff-writing-plans` — prepare the handoff to `/osuperpowers:writing-plans` (plan authoring) |

## Node Definitions

### `run-writing-spec-session`

- **Do**: Import `/superpowers:brainstorming` (writing-spec import) — its flow is consumed inline as this session's baseline; it lands the design decisions this single spec will capture
- **Read**: nothing before the import; the import lands the design
- **Exit**: Import landed → `author-spec`; upstream missing → BLOCKED (install superpowers)
- **Fail**: Upstream superpowers plugin missing → BLOCKED: install superpowers (no downgrade, no skip, no inline restatement)

### `author-spec`

- **Do**: Write the spec document to `docs/osuperpowers/specs/` from the session output. **No canonical structure schema (single variant) — free-form authoring** (no Section 0–5 skeleton), but carry the `- **Version**: vX.Y · <date>` header line at the document head — the docs-lane doc-contract gate asserts it on every reviewed spec (a Version-less single spec is BLOCKED at review)
- **Read**: Session output
- **Exit**: File written → `spec-review`
- **Fail**: Session output unusable or write error → BLOCKED (missing design input)

### `spec-review`

- **Do**: Execute one review per cycle — one dispatch: `cdd review --type spec --spec <path>` (the single spec document under review). Self-review, manual checks, or any other substitute for cdd review CLI invocation is forbidden. Review Convergence (I1): after a blocker=0 review, fixing all captured findings finishes the cycle — no re-run. Ensure the working tree is clean before entering review (engine entry gate: dirty → BLOCKED; the orchestrator writes no tree during dispatch). Direct invocation — read the full output (stdout/stderr); cdd truncates its own output. Output filtering is forbidden — no piping to `tail`/`head`, no `2>&1 |`, no `EXIT=$?` capture.
- **Read**: The authored spec document
- **Exit**: Blockers routed via `blocker=0?` → `fix-spec` (both branches; the edge inherits the re-run routing)
- **Fail**: Re-run review after blocker=0 → violates I1 (Review Convergence)

### `fix-spec`

- **Do**: Fix ALL findings (blocker + warn + nit) via `cdd fix --type spec --spec <path> --findings <workspace>/spec-review-{R}.json`. No new review invocation — work from the findings already captured in the current cycle. Direct invocation — read the full output (stdout/stderr); cdd truncates its own output. Output filtering is forbidden — no piping to `tail`/`head`, no `2>&1 |`, no `EXIT=$?` capture. After the review, the orchestrator reads only the `status` / `blocker` count from the stdout result line; findings full text is consumed by `cdd fix`'s fix-agent via `--findings <handoff>` — the orchestrator must not self-apply findings as inline edits.
- **Read**: The captured spec-review handoff (current cycle findings)
- **Exit**: entered via blocker>0 → `spec-review` (re-run); entered via blocker=0 → `commit-spec` (no re-run)
- **Fail**: Invoking a new review instead of fixing from captured findings → violates I1 (Review Convergence)

### `commit-spec`

- **Do**: `git add` the spec + conventional commit. Spec approved = commit immediately (I2); do not wait for dev merge
- **Read**: Spec file path
- **Exit**: Commit complete → `handoff-writing-plans`
- **Fail**: Git error → report + fail-open (do not block user spec review)

### `handoff-writing-plans`

- **Do**: Prepare the handoff to `/osuperpowers:writing-plans` — the plan-authoring flow takes over to plan the implementation of the approved spec (flow import, consumed inline as this session's baseline; not a session spawn)
- **Read**: The committed spec file
- **Exit**: Handoff executed → flow ends for this skill
- **Fail**: Target skill missing → BLOCKED (install osuperpowers)

## Invariants

| # | Invariant |
|---|---|
| I1 | **Review Convergence** — blocker=0 → fix all findings via `cdd fix`, then stop; do not re-run (for task/branch the review ref moves with the fix commit — the engine cannot intercept it, so this discipline is the only guard). Fixes always dispatch via `cdd fix`; the orchestrator must not edit in place as a substitute |
| I2 | **Spec commit discipline** — spec approved = commit immediately; do not wait for dev merge |
| I3 | **Mid-Flight Backfill** — a user-raised backfill of overall/spec/plan docs surfaced while a dispatch is in flight lands immediately when the current `cdd` call returns (hot context; no deferral to cycle close — deferral risks losing the decision), committed as its own change; the tree must be clean (backfill committed) before the next dispatch: an uncommitted backfill trips the next review's entry gate (dirty → BLOCKED). A backfill rewriting the current task's own plan/spec text routes per Pending Acceptance (sole-writer); otherwise it rides the moving ref and the next review audits it in-band (changed-surface booking, not a block). |

## Failure Modes

| failure | behavior | reason |
|---|---|---|
| Upstream superpowers plugin missing | BLOCKED (install superpowers) | Block policy: no silent fallback |
| spec-review re-run after blocker=0 | Violates I1 (Review Convergence) — stop + report to user | Agent declares blocker=0 after fixing without re-running cdd review on that pass |
| Git commit error | report + fail-open | Do not block user spec review |
