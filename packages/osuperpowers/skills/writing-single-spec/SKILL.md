---
name: writing-single-spec
description: Independent single-spec writer -- Node-anchored flow with digraph as single control-flow source of truth. Delegates to a /superpowers:brainstorming (writing-spec) session for design, then authors the single spec free-form, runs the cdd spec review-fix loop, commits on approval, and hands off to writing-plans. Callable standalone.
---

# Osuperpowers Single-Spec Writing

Writes a single (non-phase) spec from a design session, reviews it under the cdd spec contract, commits it on approval, and hands it off to writing-plans. Single specs have no template and no parent overall to sync.

## Flow Digraph

```mermaid
flowchart TD
  A[run-writing-spec-session] -->|loaded| C[author-spec]
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
| read-template | N/A — no template (single specs are authored free-form) |
| scope changed? | N/A |
| sync-overall | N/A |
| review loop (D/E/F) | shared shape — no delta (only the `--spec <path>` target differs: this skill's own product) |
| handoff-spec | `handoff-writing-plans` — Run a /osuperpowers:writing-plans session |

## Node Definitions

### `run-writing-spec-session`

- **Do**: Run a /superpowers:brainstorming session (writing-spec session) — the harness loads the upstream skill and runs its flow to produce the design decisions this single spec will capture
- **Read**: nothing before the session; the session produces the design
- **Exit**: Session loaded → `author-spec`; upstream missing → BLOCKED (install superpowers)
- **Fail**: Upstream superpowers plugin missing → BLOCKED: install superpowers (no downgrade, no skip, no inline restatement)

### `author-spec`

- **Do**: Write the spec document to `docs/osuperpowers/specs/` from the session output. **No template (single variant) — free-form authoring**
- **Read**: Session output
- **Exit**: File written → `spec-review`
- **Fail**: Session output unusable or write error → BLOCKED (missing design input)

### `spec-review`

- **Do**: Execute one review per cycle — one dispatch: `cdd review --type spec --spec <path>` (the single spec document under review). Self-review, manual checks, or any other substitute for cdd review CLI invocation is forbidden. Review Stopping (I1): after a blocker=0 review, fixing all captured findings finishes the cycle — no re-run. Ensure the working tree is clean before entering review (engine entry gate: dirty → BLOCKED; the orchestrator writes no tree during dispatch)
- **Read**: The authored spec document
- **Exit**: Blockers routed via `blocker=0?` → `fix-spec` (both branches; the edge inherits the re-run routing)
- **Fail**: Re-run review after blocker=0 → violates I1 (Review Stopping)

### `fix-spec`

- **Do**: Fix ALL findings (blocker + warn + nit) via `cdd fix --type spec --spec <path> --findings <workspace>/spec-review-{R}.json`. No new review invocation — work from the findings already captured in the current cycle
- **Read**: The captured spec-review handoff (current cycle findings)
- **Exit**: entered via blocker>0 → `spec-review` (re-run); entered via blocker=0 → `commit-spec` (no re-run)
- **Fail**: Invoking a new review instead of fixing from captured findings → violates I1 (Review Stopping)

### `commit-spec`

- **Do**: `git add` the spec + conventional commit. Spec approved = commit immediately (I2); do not wait for dev merge
- **Read**: Spec file path
- **Exit**: Commit complete → `handoff-writing-plans`
- **Fail**: Git error → report + fail-open (do not block user spec review)

### `handoff-writing-plans`

- **Do**: Run a /osuperpowers:writing-plans session to plan the implementation of the approved spec
- **Read**: The committed spec file
- **Exit**: Handoff session loaded → flow ends for this skill
- **Fail**: Target skill missing → BLOCKED (install osuperpowers)

## Invariants

| # | Invariant |
|---|---|
| I1 | **Review Stopping** — blocker=0 → fix all findings via `cdd fix`, then stop; do not re-run (for task/branch the review ref moves with the fix commit — the engine cannot intercept it, so this discipline is the only guard). Fixes always dispatch via `cdd fix`; the orchestrator must not edit in place as a substitute |
| I2 | **Spec commit discipline** — spec approved = commit immediately; do not wait for dev merge |

## Failure Modes

| failure | behavior | reason |
|---|---|---|
| Upstream superpowers plugin missing | BLOCKED (install superpowers) | Block policy: no silent fallback |
| spec-review re-run after blocker=0 | Violates I1 (Review Stopping) — stop + report to user | Agent declares blocker=0 after fixing without re-running cdd review on that pass |
| Git commit error | report + fail-open | Do not block user spec review |
