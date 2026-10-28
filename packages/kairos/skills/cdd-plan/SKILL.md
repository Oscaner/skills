---
name: cdd-plan
description: Independent plan-writing orchestrator -- Node-anchored flow with digraph as single control-flow source of truth. Consumes the /superpowers:writing-plans（pi：/skill:writing-plans） flow inline as this session's baseline, backfills the design spec on substantive drift before authoring, commits the authored plan before the review-fix loop, and runs the loop following the engine's next face — the engine's next directive carries the pipeline continuation. Callable standalone; invoke as kairos:cdd-plan（pi：/skill:cdd-plan）.
---

# Kairos CDD-Plan

Writes a plan document from an approved spec, backfills the design when planning surfaces substantive drift, commits the plan before reviewing under the cdd plan contract; on closure the engine's `next:` face carries the pipeline continuation.

**Invocation discipline** — every engine command runs as a background dispatch: launch it in the background and await the completion notification — never poll — then read the full output (stdout/stderr). Output filtering is forbidden — no piping to `tail`/`head`, no `2>&1 |`, no `EXIT=$?` capture. **Round rhythm** — one review pass per dispatch; a fix round re-enters the review while the route is not done; commit the authored plan before the first review round; ensure the working tree is clean before entering review (dirty → BLOCKED; the orchestrator writes no tree during dispatch). **Failure face** — cross-node failure handling lives in the Failure Modes table below (the single source); node `Fail` entries keep only local behavior.

## Flow Digraph

```mermaid
flowchart TD
  A[run-cdd-plan-session] --> B[backfill-design]
  A --> Z1((BLOCKED: upstream plugin missing))
  B --> C[author-plan]
  C --> S[self-review]
  S --> K[commit-plan]
  K --> L[NEXT-LOOP]
  L -->|until next is terminal| L
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

- **Do**: Write the complete plan document to `docs/kairos/plans/YYYY-MM-DD-<feature>.md` — generate the canonical skeleton first (`npx -y @oscaner-skills/cdd-engine@latest schema get plan --output skeleton <target path>`) and fill its slots in place; the structure stays as generated. Plan header MUST carry the document identity in its front-matter `slug:` key, **inherited from the approved spec it plans** — the same value the spec carries, so spec and plan resolve as one run (the generated skeleton emits the `slug:` key for you to fill). The plan declares no attribution key of its own: its program chain is implied by the identity document of the same slug, so `cdd-report` resolves program attribution through that chain (workspace plan record → the plan's `slug:` → the identity document of that slug, read through its own attribution — a phase-spec's `program:`, or, for an overall / single-spec, its own inventory), the plan record being the first hop of its program chain.
  - **Constraints** — the `## Constraints` section declares the constraint surface the implement child reads — zero separately materialized constraints file; declaring no constraint rows never blocks a dispatch — no silent fallback, no phantom rules file.
  - **Dependencies** — declare each task's dependencies as the single directed edge on its task record — `- **DependsOn**: <n, n, …>` (any existing task id; forward references are legal; `none`/empty = the explicit no-dependency declaration); the declared edges group the tasks into dispatch waves.
  - **Appending work** — work that surfaces after the plan has been reviewed enters as new tasks whose `DependsOn` edges point only at already-closed tasks, so the engine derives a fresh dispatch wave for them; never rewrite the content of an already-closed task (a closed wave's content is history — later work enters as a new task); a user adjudication that re-scopes a closed task is the one exception and lands under Plan write authority (I3); an appended task declares its `Acceptance` exactly like any other.
  - **Write authority** — cross-task adjudication surfaced later (user adjudication / phase-level re-scope) is handled by the orchestrator under Plan write authority (I3): it amends the target task's `- **Objective**:` / `- **Steps**:` / `- **Acceptance**:` data fields directly.
- **Read**: approved spec + `backfill-design` output + the plan's structural contract (the same structure fact the review reads)
- **Exit**: File written → `self-review`
- **Fail**: Schema read fails or the draft plan is unusable → BLOCKED (missing plan input)

### `self-review`

- **Do**: Review the just-written plan before committing — run five checks, substance first: (1) **coverage** — every approved-spec requirement maps to a task; (2) **step decidability** — each step lets the implementer write exactly one reasonable thing (a line that decides nothing, or a signature-and-tests-determined transcript, is a defect); (3) **consistency** — task ids / `DependsOn` edges / naming agree; (4) **failure-mode coverage** — every failure mode the spec implies has a task whose checkable exercises it; (5) **proportion** — the plan is not many times the length of the spec it implements. Then the mechanical tail: zero leftover `:::fill` markers, zero angle-bracket literals outside link-anchor slots (cheap hygiene the doc-contract gate would otherwise flag). Issues found are fixed inline on the same file; this is a pre-commit self-check inside this flow, not a review round (no `next:` dispatch, no findings carrier).
- **Read**: the written plan document + the approved spec it implements
- **Exit**: Self-check clean (issues fixed inline) → `commit-plan`
- **Fail**: Unresolvable defect needing design input → BLOCKED (missing plan input)

### `commit-plan`

- **Do**: `git add` the plan + conventional commit.
- **Read**: The committed plan file path
- **Exit**: Commit complete → `NEXT-LOOP`
- **Fail**: Git error → report + fail-open (do not block user plan review)

### `NEXT-LOOP`

- **Do**: Run the review-fix rhythm for the authored plan — one review pass per dispatch. Dispatch the review round on the current ref (`npx -y @oscaner-skills/cdd-engine@latest review --type plan --plan <path>`); every later hop follows the engine's `next:` face. Fixes dispatch via the fix round — never an in-place edit as a substitute; a BLOCKED/TIMEOUT round's carried reason is reported, never overridden.
- **Read**: the full stdout — the review conclusion, the findings handoff path, and the engine's `next:` face
- **Exit**: each fix pass re-enters this hub while that route keeps the loop alive (the `until next is terminal` self-loop); a route that leaves the loop ends this skill's flow
- **Fail**: Re-running a review after a closure conclusion → violates Review Convergence (stop + report)

## Invariants

| # | Invariant |
|---|---|
| I1 | **Review Convergence** — a review closes by its conclusion (APPROVED / CHANGES_REQUESTED / REVIEW_FIX); the loop advances by the engine's `next:` face, never by orchestrator guesswork. A mid-backfill or a user adjudication that lands governs over the suggestion (current world state wins). Fixes always dispatch via the fix round; the orchestrator must not edit in place as a substitute; a fix commit opens a new review, never a re-run of a closed one |
| I2 | **Plan commit discipline** — the authored plan commits before the first review round; each fix round commits its own changes — approval closes the loop on a committed state; do not wait for dev merge |
| I3 | **Plan write authority** — the plan's writes discriminate by trigger: review findings land through the fix round dispatch only; a user adjudication or durable backfill lands through the orchestrator's own standalone commit, amending the target task's data fields directly; fix/implement agents hold zero plan-modification authority |
| I4 | **Mid-Flight Backfill** — a user-raised backfill of overall/spec/plan docs surfaced while a dispatch is in flight lands through four ordered steps on the current call's return: (1) **land immediately** — hot context, no deferral; (2) **commit on its own** — a standalone change, never mixed with implementation commits; (3) **pause the loop until clean** — an uncommitted backfill trips the next review's entry gate (dirty → BLOCKED); (4) **audit in-band on resume** — the next review audits the backfill in-band |

## Failure Modes

| failure | behavior | reason |
|---|---|---|
| Upstream superpowers plugin missing | BLOCKED (install superpowers — see the kairos README's installation table) | Block policy: no silent fallback |
| review re-run after a closure conclusion (REVIEW_FIX / APPROVED) | Violates I1 (Review Convergence) — stop + report to user | A fix commit opens a new review, never a re-run of a closed one |
| Entering review with an un-backfilled drift | Violates the design-backfill rule — stop + backfill first | Spec and plan must agree before review |
| Git commit error | report + fail-open | Do not block user plan review |
| Completed round with no `next:` line (not BLOCKED/TIMEOUT) | HARD_ERROR — report the carried reason, re-run the same command to continue | No dispatchable next |
