---
name: cdd-plan
description: Independent plan-writing orchestrator -- Node-anchored flow with digraph as single control-flow source of truth. Consumes the /superpowers:writing-plans（pi：/skill:writing-plans） flow inline as this session's baseline, backfills the design spec on substantive drift before authoring, commits the authored plan before the review-fix loop, runs the loop following the engine's next: line, and hands off to cdd-dev. Callable standalone; invoke as kairos:cdd-plan（pi：/skill:cdd-plan）.
---

# Kairos CDD-Plan

Writes a plan document from an approved spec, backfills the design when planning surfaces substantive drift, commits the plan before reviewing under the cdd plan contract, and hands off to cdd-dev.

**Invocation discipline** — every engine command runs as a background dispatch: launch it in the background and await the completion notification — never poll — then read the full output (stdout/stderr). Output filtering is forbidden — no piping to `tail`/`head`, no `2>&1 |`, no `EXIT=$?` capture. **Round rhythm** — one review pass per dispatch; a fix round re-enters the review while the route is not done; commit the authored plan before the first review round; ensure the working tree is clean before entering review (dirty → BLOCKED; the orchestrator writes no tree during dispatch). **Failure face** — cross-node failure handling lives in the Failure Modes table below (the single source); node `Fail` entries keep only local behavior.

## Flow Digraph

```mermaid
flowchart TD
  A[run-cdd-plan-session] --> B[backfill-design]
  A --> Z1((BLOCKED: upstream plugin missing))
  B --> C[author-plan]
  C --> K[commit-plan]
  K --> L[NEXT-LOOP]
  L -->|until next=done| L
  L -->|next=done| H[handoff-cdd-dev]
  L -->|no next| Z2((BLOCKED))
```

## Node Definitions

### `run-cdd-plan-session`

- **Do**: Import `/superpowers:writing-plans`（pi：/skill:writing-plans） to plan the approved spec; it lands the draft plan (session-call; the upstream document is not read)
- **Read**: nothing before the import; the import plans from the approved spec and lands the draft plan
- **Exit**: Import landed → `backfill-design`
- **Fail**: Upstream superpowers plugin missing → BLOCKED (no downgrade, no skip, no inline restatement)

### `backfill-design`

- **Do**: Check the drafted plan against the approved design. Substantive drift (factual error / missing constraint / a new implementation step the design does not cover) → **backfill the design spec first** — revise the spec + record the drift — so spec and plan agree before plan-review (the design-backfill rule). Cross-phase matters still backfill to the parent overall per Boundary rules
- **Read**: approved spec + landed plan draft
- **Exit**: spec ↔ plan consistent → `author-plan`
- **Fail**: Entering plan-review with an un-backfilled drift → violates the design-backfill rule

### `author-plan`

- **Do**: Write the complete plan document to `docs/kairos/plans/YYYY-MM-DD-<feature>.md`. Plan header MUST carry the approved design link as **`**Spec:**` on line 2** (immediately after the `# Title`): `**Spec:** [<name>-design.md](docs/kairos/specs/<name>-design.md)` — the same source as the review's `--spec` pointer; `cdd-report` resolves program attribution through this header (workspace plan record → **Spec:** → overall → Related), the plan record being the first hop of its program chain.
  - **Structure** — the plan carries the task-heading colon form, a `## Constraints` section, `### Task N:` task blocks and a `## Change history` table; each task block carries its data fields (`- **Objective**:` · `- **Steps**:` · `- **Acceptance**:` · `- **DependsOn**:`).
  - **Constraints** — the `## Constraints` section declares the constraint surface the implement child reads — zero separately materialized constraints file; declaring no constraint rows never blocks a dispatch — no silent fallback, no phantom rules file.
  - **Dependencies** — declare each task's dependencies as the single directed edge on its task record — `- **DependsOn**: <n, n, …>` (any existing task id; forward references are legal; `none`/empty = the explicit no-dependency declaration); the declared edges group the tasks into dispatch waves.
  - **Sole writer** — cross-task adjudication surfaced later (user adjudication / phase-level re-scope) is handled by the orchestrator as Plan Sole Writer: it amends the target task's `- **Objective**:` / `- **Steps**:` / `- **Acceptance**:` data fields directly; fix/implement agents hold zero plan-modification authority.
  - **Self-review** — before committing, check spec coverage + type consistency + zero leftover `:::fill` markers + zero angle-bracket literals outside link-anchor slots; issues found are fixed inline, not looped or passed to review.
- **Read**: approved spec + `backfill-design` output + the plan's structural contract (the same structure fact the review reads)
- **Exit**: File written → `commit-plan`
- **Fail**: Schema read fails or the draft plan is unusable → BLOCKED (missing plan input)

### `commit-plan`

- **Do**: `git add` the plan + conventional commit.
- **Read**: The committed plan file path
- **Exit**: Commit complete → `NEXT-LOOP`
- **Fail**: Git error → report + fail-open (do not block user plan review)

### `NEXT-LOOP`

- **Do**: Run the review-fix rhythm for the authored plan — one review per pass. Dispatch the review round on the current ref (`npx -y @oscaner-skills/cdd-engine@latest review --type plan --plan <path>`); dispatch the output's `next:` line as written — the literal is the route: a fix dispatch consumes the findings handoff (confirm the findings · annotate the carrier with the adjudications), a closure routes to `handoff-cdd-dev`; a BLOCKED/TIMEOUT round carries no `next:` line — its reason rides stderr for reporting.
- **Read**: the review output — its conclusion and the `next:` line, plus the findings handoff path
- **Exit**: the `next:` line reads `done` → `handoff-cdd-dev`; each fix pass re-enters this hub while the route is not done (the `until next=done` self-loop)
- **Fail**: Re-running a review after a closure conclusion → violates Review Convergence (stop + report)

### `handoff-cdd-dev`

- **Do**: Hand off to `/kairos:cdd-dev`（pi：/skill:cdd-dev）
- **Read**: The committed plan file
- **Exit**: Handoff executed → flow ends for this skill
- **Fail**: Target skill missing → BLOCKED (install kairos — see the kairos README's 'Upstream dependency install' table)

## Invariants

| # | Invariant |
|---|---|
| I1 | **Review Convergence (next: is the dispatch)** — a review closes by its conclusion (APPROVED / CHANGES_REQUESTED / REVIEW_FIX), and the output's `next:` line carries the engine's default next step as a complete executable command; read the `next:` line and dispatch it as written — the literal is the dispatch, no kind→command mapping layer. A mid-backfill or a user adjudication that lands governs over the suggestion (current world state wins). Fixes always dispatch via the fix round, consuming the findings handoff (confirm the findings · annotate the carrier with the adjudications); the orchestrator must not edit in place as a substitute; a fix commit opens a new review, never a re-run of a closed one |
| I2 | **Plan commit discipline** — the authored plan commits before the first review round; each fix round commits its own changes — approval closes the loop on a committed state; do not wait for dev merge |
| I3 | **Plan Sole Writer** — the plan document is the orchestrator's sole-writer surface: the orchestrator amends the target task's data fields directly on adjudication; fix/implement agents hold zero plan-modification authority |
| I4 | **Mid-Flight Backfill** — a user-raised backfill of overall/spec/plan docs surfaced while a dispatch is in flight lands through four ordered steps on the current call's return: (1) **land immediately** — hot context, no deferral; (2) **commit on its own** — a standalone change, never mixed with implementation commits; (3) **pause the loop until clean** — an uncommitted backfill trips the next review's entry gate (dirty → BLOCKED); (4) **audit in-band on resume** — the next review audits the backfill in-band |

## Failure Modes

| failure | behavior | reason |
|---|---|---|
| Upstream superpowers plugin missing | BLOCKED (install superpowers — see the kairos README's 'Upstream dependency install' table) | Block policy: no silent fallback |
| review re-run after a closure conclusion (REVIEW_FIX / APPROVED) | Violates I1 (Review Convergence) — stop + report to user | A fix commit opens a new review, never a re-run of a closed one |
| Entering review with an un-backfilled drift | Violates the design-backfill rule — stop + backfill first | Spec and plan must agree before review |
| Git commit error | report + fail-open | Do not block user plan review |
| Completed round with no `next:` line (not BLOCKED/TIMEOUT) | HARD_ERROR — report the carried reason, re-run the same command to continue | No dispatchable next |
