---
name: writing-plans
description: Independent plan-writing orchestrator -- Node-anchored flow with digraph as single control-flow source of truth. Delegates to a /superpowers:writing-plans session, backfills the design spec on substantive drift before authoring, runs the cdd plan review-fix loop, commits on approval, and hands off to cli-driven-development. Callable standalone; triggered by /writing-plans via overrides router.
---

# Osuperpowers Writing-Plans

Writes a plan document from an approved spec, backfills the design when planning surfaces substantive drift, reviews under the cdd plan contract, commits on approval, and hands off to cli-driven-development.

## Flow Digraph

```mermaid
flowchart TD
  A[run-writing-plans-session] -->|loaded| B[backfill-design]
  A -->|missing| Z1((BLOCKED: install superpowers))
  B --> C[author-plan]
  C --> D[plan-review]
  D --> E{blocker=0?}
  E -->|no| F[fix-plan]
  E -->|yes| F
  F -->|entered via blocker>0| D
  F -->|entered via blocker=0| H[commit-plan]
  H --> I[handoff-cli-driven-development]
```

## Node Definitions

### `run-writing-plans-session`

- **Do**: Run a /superpowers:writing-plans session — the harness loads the upstream skill and runs its flow to plan the approved spec (session-call; the upstream document is not read)
- **Read**: nothing before the session; the session plans from the approved spec
- **Exit**: Session loaded → `backfill-design`; upstream missing → BLOCKED (install superpowers)
- **Fail**: Upstream superpowers plugin missing → BLOCKED: install superpowers (no downgrade, no skip, no inline restatement)

### `backfill-design`

- **Do**: Check the session's plan against the approved design. Substantive drift (factual error / missing constraint / a new implementation step the design does not cover) → **backfill the design spec first** — revise the spec + record the drift — so spec and plan agree before plan-review (overall v1.6 rule). Cross-phase matters still backfill to the parent overall per Boundary rules
- **Read**: approved spec + session output
- **Exit**: spec ↔ plan consistent → `author-plan`
- **Fail**: Entering plan-review with an un-backfilled drift → violates the design-backfill rule (overall v1.6)

### `author-plan`

- **Do**: Write the complete plan document to `docs/osuperpowers/plans/YYYY-MM-DD-<feature>.md`. Plan header MUST carry the approved design link as **`**Spec:**` on line 2** (immediately after the `# Title`): `**Spec:** [<name>-design.md](docs/osuperpowers/specs/<name>-design.md)` — the same source as `plan-review`'s `--spec` pointer; `report-issues` resolves program attribution through this header (workspace plan record → **`**Spec:**`** → overall → Related), the plan record being the first hop of its program chain. Task headings MUST use `### Task N:` colon format — matching brief.mjs extraction (`/^### Task \d+:/`); em dash / Chinese colon / any other delimiter fails brief extraction at dispatch time. The plan's constraint surface MUST be declared for `cdd implement` to materialize `plan-constraints.md` (engine §T7.1): declare a first-class top-level `## Constraints` section — canonical, preferred — with the constraint body under it (`###` sub-sections stay inside; the section is bounded by the next `##`/`#` heading, a `### Task` heading, or a `---` rule); a plan without the literal section falls back to the legacy prose-pointer headings in the preamble (`**口径**` / `**commit 边界机制**` / `**Flow Atomicity**` / `**顺序原则**` bold paragraphs). A plan declaring neither blocks `cdd implement` pre-flight with `plan Constraints source undeclared` (no silent fallback). The plan MAY carry a **pending-acceptance-patch zone** — a top-level `##` section recording cross-task review findings that a review round tagged for a LATER task (`### Task N:`, N later than the current task): one `- **Task N (patch)**: …` entry per pending patch (task-ref + patch description), present only while a patch is pending. It is a document convention, not a command-line contract — the entries ride the plan's standard wording, and the later task's `- **验收**:` carries the patch as an acceptance bullet. The orchestrator is the zone's sole writer; fix/implement agents hold zero plan-modification authority (I3). Full definition + samples: **Pending Acceptance Patch (cross-task findings consolidation)** below. Includes self-review (spec coverage + placeholder scan + type consistency) — issues found are fixed inline, not looped or passed to plan-review
- **Read**: approved spec + `backfill-design` output
- **Exit**: Plan written + self-review passed → `plan-review`
- **Fail**: Write error or self-review finds an unfixable defect → report + fail-open (do not block plan review)

### `plan-review`

- **Do**: Execute one review per cycle — one dispatch: `cdd review --type plan --plan <path> --spec <spec-path>` (completeness / decomposition / buildability in one run; findings are lens-tagged; round auto-increments in the engine). Self-review, manual checks, or any other substitute for cdd review CLI invocation is forbidden. All findings are fixed from the captured handoff; `blocker=0` → no re-run. Ensure the working tree is clean before entering review (engine entry gate: dirty → BLOCKED; the orchestrator writes no tree during dispatch)
- **Read**: plan document + spec document
- **Exit**: Blockers routed via `blocker=0?` → `fix-plan` (both branches; the edge inherits the re-run routing)
- **Fail**: Re-running the review after blocker=0 → violates the review-stopping discipline

### `fix-plan`

- **Do**: Fix ALL findings (blocker + warn + nit) via `cdd fix --type plan --plan <path> --findings <workspace>/plan-review-{R}.json`. No new review invocation — work from the findings already captured in the current cycle. A finding tagged `targets later task` belongs to the plan's pending-acceptance-patch zone, not this fix round — it is reported and collected by the orchestrator as sole writer (I3); the fix agent holds zero plan-modification authority
- **Read**: captured plan-review handoff (current cycle findings)
- **Exit**: entered via blocker>0 → `plan-review` (re-run); entered via blocker=0 → `commit-plan` (no re-run)
- **Fail**: Invoking a new review instead of fixing from captured findings → violates the review-stopping discipline

### `commit-plan`

- **Do**: `git add` the plan + conventional commit. Plan approved = commit immediately (I2); do not wait for dev merge
- **Read**: Plan file path
- **Exit**: Commit complete → `handoff-cli-driven-development`
- **Fail**: Git error → report + fail-open (do not block user plan review)

### `handoff-cli-driven-development`

- **Do**: Run a /osuperpowers:cli-driven-development session to implement the approved plan
- **Read**: The committed plan file
- **Exit**: Handoff session loaded → flow ends for this skill
- **Fail**: Target skill missing → BLOCKED (install osuperpowers)

## Pending Acceptance Patch (cross-task findings consolidation)

The plan's cross-task findings surface: how a review finding whose remedy belongs to a LATER task is tagged, consolidated by the orchestrator, and carried into the later task's acceptance.

- **Finding tag (convention, zero schema change)** — a review finding that targets a later task marks the target in the finding text with a `targets later task` tag plus the target heading reference (`### Task N:`, N later than the current task). The tag is plain free text in the existing findings payload (the handoff schema is untouched — no new field, no engine contract).
- **Zone shape** — a top-level `##` heading (conventionally `## Pending Acceptance Patch`) with one `- **Task N (patch)**: …` bullet per pending patch; each entry is a **task-ref + patch description**. The zone exists only while a patch is pending — the plan convention reserves it, the plan text realizes it.
- **Sole writer** — the pending-acceptance-patch zone is written by the orchestrator alone (I3).
- **Carry-through (mechanically assertable)** — the later task's `- **验收**:` line carries the patch as an acceptance bullet, so the patch rides the standard brief-extraction surface (`/^### Task \d+:/` task headings + `- **验收**:` acceptance lines) into the later task's dispatch. The patch is therefore assertable by the same mechanical means as any acceptance line — no special parser, no schema change.

Sample — the zone entries (task-ref + patch description) and the later task's acceptance carry-through:

```md
## Pending Acceptance Patch

- **Task 14 (patch)**: the Task 13 review round tagged a `targets later task` finding — Task 14 must accept a guard that untagged cross-task findings cannot pass a review round (task-ref + patch description).

### Task 14: …

- **Do**: …
- **验收**: existing Task 14 acceptance · **accepts pending-acceptance-patch** (task-ref `### Task 14:` · patch: untagged cross-task findings fail the review round) — the patch is a first-class bullet of this acceptance and rides into the Task 14 brief unchanged.
```

## Invariants

| # | Invariant |
|---|---|
| I1 | **Review Stopping** — blocker=0 → fix all findings via `cdd fix`, then stop; do not re-run the same ref (for spec/plan the engine binds the ref to `(doc_path, doc_hash)` and rejects a same-ref re-run; editing the plan opens a new review round legitimately). Fixes always dispatch via `cdd fix`; the orchestrator must not edit in place as a substitute |
| I2 | **Plan commit discipline** — plan approved = commit immediately; do not wait for dev merge |
| I3 | **Plan Sole Writer (Pending Acceptance)** — the plan's pending-acceptance-patch zone is written by the orchestrator alone. A review finding tagged `targets later task` (`### Task N:`, N later than the current task) is reported and consolidated by the orchestrator — never fixed in-place by the round that found it — and the later task's `- **验收**:` carries the patch bullet so the deferred requirement rides into its brief. Fix/implement agents hold zero plan-modification authority (v1.31). |

## Failure Modes

| failure | behavior | reason |
|---|---|---|
| Upstream superpowers plugin missing | BLOCKED (install superpowers) | Block policy: no silent fallback |
| Design drift not backfilled before plan-review | BLOCKED (design-backfill violation) | spec and plan must agree before review |
| Git commit error | report + fail-open | Do not block user plan review |
