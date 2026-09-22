---
name: writing-overall-spec
description: Independent overall-spec writer -- Node-anchored flow with digraph as single control-flow source of truth. Consumes the /superpowers:brainstorming (writing-spec) design flow inline as this session's baseline, reads the canonical overall spec schema, authors the program charter to docs/osuperpowers/specs/, runs the cdd spec review-fix loop, commits on approval, and hands off to /compact or brainstorming [Px]. Callable standalone.
---

# Osuperpowers Overall-Spec Writing

Writes the program-level (overall) spec from the writing-spec import, reviews it under the cdd spec contract, commits it on approval, and hands off to the next phase's brainstorming. The overall spec is charter-only and carries the four tables (issue inventory / phase inventory / dependency graph / change history); per-phase increment lives in writing-phase-spec.

## Flow Digraph

```mermaid
flowchart TD
  A[run-writing-spec-session] -->|landed| B[read-schema]
  A -->|missing| Z1((BLOCKED: install superpowers))
  B --> C[author-spec]
  C --> D[spec-review]
  D --> E{blocker=0?}
  E -->|no| F[fix-spec]
  E -->|yes| F
  F -->|entered via blocker>0| D
  F -->|entered via blocker=0| H[commit-spec]
  H --> I[handoff-compact-or-brainstorming]
```

## Skeleton deltas

| skeleton node | writing-overall-spec |
|---|---|
| read-schema | run `cdd help` → read the canonical `overall.json` doc-structure schema (the schema is the single structure fact; the retired md template is gone) |
| scope changed? | N/A |
| sync-overall | N/A — this skill is the overall writer; no parent overall to sync |
| review loop (D/E/F) | shared shape — no delta (only the `--spec <path>` target differs: this skill's own product) |
| handoff-spec | `handoff-compact-or-brainstorming` — /compact, or prepare the handoff to `/osuperpowers:brainstorming [Px program]` |

## Node Definitions

### `run-writing-spec-session`

- **Do**: Import `/superpowers:brainstorming` (writing-spec import) — its flow is consumed inline as this session's baseline; it lands the design decisions (including the program charter and phase decomposition) this overall spec will capture
- **Read**: nothing before the import; the import lands the design
- **Exit**: Import landed → `read-schema`; upstream missing → BLOCKED (install superpowers)
- **Fail**: Upstream superpowers plugin missing → BLOCKED: install superpowers (no downgrade, no skip, no inline restatement)

### `read-schema`

- **Do**: Run `cdd help` to locate the canonical doc-structure schema directory (the consumer/install surface, never a hardcoded repo path) → read the canonical `overall.json` schema for the overall document type — the single structure fact its `properties` + `description` carry (charter only — no implementation detail; the schema carries the GATE: overall approval is not equivalent to any phase started). Direct invocation — read the full output (stdout/stderr); cdd truncates its own output. Output filtering is forbidden — no piping to `tail`/`head`, no `2>&1 |`, no `EXIT=$?` capture.
- **Read**: run `cdd help` → `schemas:` directory → `overall.json` (the canonical overall spec schema)
- **Exit**: Schema read → `author-spec`; `cdd help` unavailable or schema missing → BLOCKED
- **Fail**: Schema missing/unreadable → BLOCKED (missing schema — cannot determine overall spec structure)

### `author-spec`

- **Do**: Write the overall spec to `docs/osuperpowers/specs/YYYY-MM-DD-<feature>-overall.md` from the session output — charter only (scope decomposition + issue inventory + phase inventory + dependency graph + acceptance criteria); no phase-level implementation detail. Role note: the enforcement position for the overall's structure is the **engine lifecycle** — the same canonical doc-structure schema (`cdd help` → `overall.json`) that `read-schema` consumed is what `docContractValidate` uses at dispatch to check the four-table vocabulary and row shapes (doc word = code word = engine token: rename a heading and you rename the validator with it). A repo-local `scripts/validate` guard is maintainer-mode dogfood only, not a consumer surface — consumers have the engine lifecycle, not the repo toolchain. Direct invocation — read the full output (stdout/stderr); cdd truncates its own output. Output filtering is forbidden — no piping to `tail`/`head`, no `2>&1 |`, no `EXIT=$?` capture.
- **Read**: Session output + the canonical overall spec schema (via `cdd help`)
- **Exit**: File written → `spec-review`
- **Fail**: Schema missing → BLOCKED (missing schema)

### `spec-review`

- **Do**: Execute one review per cycle — one dispatch: `cdd review --type spec --spec <path>` (the overall spec document under review). Self-review, manual checks, or any other substitute for cdd review CLI invocation is forbidden. Review Convergence (I1): after a blocker=0 review, fixing all captured findings finishes the cycle — no re-run. Ensure the working tree is clean before entering review (engine entry gate: dirty → BLOCKED; the orchestrator writes no tree during dispatch). Direct invocation — read the full output (stdout/stderr); cdd truncates its own output. Output filtering is forbidden — no piping to `tail`/`head`, no `2>&1 |`, no `EXIT=$?` capture.
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
- **Exit**: Commit complete → `handoff-compact-or-brainstorming`
- **Fail**: Git error → report + fail-open (do not block user spec review)

### `handoff-compact-or-brainstorming`

- **Do**: Run /compact to collapse the completed overall session, or prepare the handoff to `/osuperpowers:brainstorming [Px program]` — its flow is consumed inline as this session's baseline to start the next phase's full brainstorm → plan → dev cycle
- **Read**: The committed overall spec
- **Exit**: Handoff executed → flow ends for this skill
- **Fail**: Handing a phase decided by the overall straight to writing-plans (skipping phase-level brainstorming) → violates the overall boundary rule

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
| Schema missing/unreadable | BLOCKED (missing schema) | Cannot determine overall spec structure |
| spec-review re-run after blocker=0 | Violates I1 (Review Convergence) — stop + report to user | Agent declares blocker=0 after fixing without re-running cdd review on that pass |
| Git commit error | report + fail-open | Do not block user spec review |
