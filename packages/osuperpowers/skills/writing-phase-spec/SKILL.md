---
name: writing-phase-spec
description: Independent phase-spec writer -- Node-anchored flow with digraph as single control-flow source of truth. Consumes the /superpowers:brainstorming (writing-spec) design flow inline as this session's baseline, reads the phase-spec template, syncs scope changes to the parent overall before writing, runs the cdd spec review-fix loop, commits on approval, and hands off to writing-plans. Callable standalone.
---

# Osuperpowers Phase-Spec Writing

Writes a single phase's spec document (increment only) from the writing-spec import, reviews it under the cdd spec contract, commits it on approval, and hands it off to writing-plans. If the phase scope changed, the change is synced to the parent overall **before** the phase spec is written (overall v1.4 ordering).

## Flow Digraph

```mermaid
flowchart TD
  A[run-writing-spec-session] -->|landed| B[read-template]
  A -->|missing| Z1((BLOCKED: install superpowers))
  B --> B2{scope changed?}
  B2 -->|yes| G[sync-overall]
  B2 -->|no| C[author-spec]
  G --> C[author-spec]
  C --> D[spec-review]
  D --> E{blocker=0?}
  E -->|no| F[fix-spec]
  E -->|yes| F
  F -->|entered via blocker>0| D
  F -->|entered via blocker=0| H[commit-spec]
  H --> I[handoff-writing-plans]
```

## Skeleton deltas

| skeleton node | writing-phase-spec |
|---|---|
| read-template | `docs/phase-spec-template.md` |
| scope changed? | present — first decision node, positioned between `read-template` and `author-spec` |
| sync-overall | present — only when phase scope changed: `B2 --yes--> G --> C` (sync to the parent overall first, then write the phase spec — overall v1.4 ordering) |
| review loop (D/E/F) | shared shape — no delta (only the `--spec <path>` target differs: this skill's own product) |
| handoff-spec | `handoff-writing-plans` — prepare the handoff to `/osuperpowers:writing-plans` (plan authoring) |

## Node Definitions

### `run-writing-spec-session`

- **Do**: Import `/superpowers:brainstorming` (writing-spec import) — its flow is consumed inline as this session's baseline; it lands the design decisions (including grilling output: root cause / fix direction / technical decisions) this phase spec will capture. The grilling that produced them ran enumerate-then-grill: the requirements registered for this phase in the parent overall were enumerated item by item (each requirement's status — `[Pending]` / `Done` / dropped — cross-referenced from the phase's Phase inventory `[Pending]`/Done cells and the change-history dropped claims) and user-confirmed complete before the grilling frontier
- **Read**: nothing before the import; the import lands the design
- **Exit**: Import landed → `read-template`; upstream missing → BLOCKED (install superpowers)
- **Fail**: Upstream superpowers plugin missing → BLOCKED: install superpowers (no downgrade, no skip, no inline restatement)

### `read-template`

- **Do**: Read this skill's `docs/phase-spec-template.md` — the single-phase spec structure (increment only; the template carries the GATE: a phase spec is produced by a full brainstorm → plan → dev cycle)
- **Read**: `docs/phase-spec-template.md`
- **Exit**: Template loaded → `scope changed?`; missing → BLOCKED
- **Fail**: Template missing/unreadable → BLOCKED (missing template)

### `scope changed?`

- **Do**: Decide whether the phase scope changed since the parent overall was last synced (new issues, scope shift, or dependency changes surfaced during the session)
- **Read**: Parent overall (`docs/osuperpowers/specs/*-overall.md`) + session output
- **Exit**: Changed → `sync-overall` → `author-spec`; unchanged → `author-spec`
- **Fail**: Writing the phase spec against a stale overall when scope changed → violates the sync-before-write ordering (overall v1.4)

### `sync-overall`

- **Do**: Import `/osuperpowers:writing-overall-spec` — its flow is consumed inline as this session's baseline; it lands the scope change synced into the parent overall (issue inventory / phase inventory / dependency graph / version bump + change history), then return here to write the phase spec
- **Read**: The parent overall
- **Exit**: Sync landed → `author-spec`
- **Fail**: Parent overall unparseable / four-table sync inconsistent → BLOCKED (overall-sync-failed)

### `author-spec`

- **Do**: Write the phase spec to `docs/osuperpowers/specs/YYYY-MM-DD-<feature>-<phase-id>-design.md` from the session output — increment only (this phase's approaches / architecture / components / data flow / errors / testing / acceptance criteria); cross-phase conventions live in the parent overall (overall wins on conflict)
- **Read**: Session output + `docs/phase-spec-template.md`
- **Exit**: File written → `spec-review`
- **Fail**: Template missing → BLOCKED (missing template)

### `spec-review`

- **Do**: Execute one review per cycle — one dispatch: `cdd review --type spec --spec <path>` (the phase spec document under review). Self-review, manual checks, or any other substitute for cdd review CLI invocation is forbidden. Review Stopping (I1): after a blocker=0 review, fixing all captured findings finishes the cycle — no re-run. Ensure the working tree is clean before entering review (engine entry gate: dirty → BLOCKED; the orchestrator writes no tree during dispatch)
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

- **Do**: Prepare the handoff to `/osuperpowers:writing-plans` — the plan-authoring flow takes over to plan the implementation of the approved phase spec (flow import, consumed inline as this session's baseline; not a session spawn)
- **Read**: The committed phase spec file
- **Exit**: Handoff executed → flow ends for this skill
- **Fail**: Target skill missing → BLOCKED (install osuperpowers)

## Invariants

| # | Invariant |
|---|---|
| I1 | **Review Stopping** — blocker=0 → fix all findings via `cdd fix`, then stop; do not re-run (for task/branch the review ref moves with the fix commit — the engine cannot intercept it, so this discipline is the only guard). Fixes always dispatch via `cdd fix`; the orchestrator must not edit in place as a substitute |
| I2 | **Spec commit discipline** — spec approved = commit immediately; do not wait for dev merge |
| I3 | **Sync before write** — a phase scope change is synced to the parent overall BEFORE the phase spec is authored (overall v1.4 ordering); never write a phase spec against a stale overall |

## Failure Modes

| failure | behavior | reason |
|---|---|---|
| Upstream superpowers plugin missing | BLOCKED (install superpowers) | Block policy: no silent fallback |
| Template missing/unreadable | BLOCKED (missing template) | Cannot determine phase spec structure |
| Parent overall unparseable / sync inconsistent | BLOCKED (overall-sync-failed) | Refuse to write a phase spec against a stale overall |
| spec-review re-run after blocker=0 | Violates I1 (Review Stopping) — stop + report to user | Agent declares blocker=0 after fixing without re-running cdd review on that pass |
| Git commit error | report + fail-open | Do not block user spec review |
