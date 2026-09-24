---
name: cli-driven-development
description: Independent cli-driven-development orchestrator -- Node-anchored flow with digraph as single control-flow source of truth. Determines base via shared doc, dispatches CDD three-mode chain (implement / review / fix), runs the engine-closed branch review→fix loop, hands off to finishing. Callable standalone; referenced by no other skill.
---

# CLI-Driven Development (cdd)

Execute planned tasks with the host harness CLI (ambient detection — no selection step) via a three-mode chain. This skill is both orchestrator and engine: it executes AND makes orchestrator decisions (mode chain, final review).

## Flow Digraph

```mermaid
flowchart TD
  A[detect-engine] -->|found| B[determine-base]
  A -->|missing| Z0((BLOCKED: cdd-engine-not-installed))
  B --> C[set-base-branch]
  C --> T{adjudicate-task-groups}
  T -->|confirmed| D[implement-task]
  T -->|refused| Z1((BLOCKED: task-groups-undecided))
  D --> E[run-task-review]
  E --> F{blocker=0?}
  F -->|no| G[fix-task]
  F -->|yes| G
  G -->|entered via blocker>0| E
  G -->|entered via blocker=0| H{more-groups?}
  H -->|yes| D
  H -->|no| K[branch-review]
  K --> I{blocker=0?}
  I -->|no| J[branch-fix]
  I -->|yes| J
  J -->|entered via blocker>0| K
  J -->|entered via blocker=0| L[handoff-finishing]
```

The branch loop is node-for-node isomorphic with the dispatch-group loop above it and with the spec/plan/task-family loops of the `writing-*` orchestrators: a review lane, a `{blocker=0?}` decision that routes both arms through the fix lane, a blocker>0 back-edge (re-review on the moved ref) and a blocker=0 forward-edge (finishing). `K ─ I ─ J ─ L` is the same skeleton as `D[review] → {blocker=0?} → F[fix] → …`. `adjudicate-task-groups` sits between `set-base-branch` and the loop: it settles the dispatch-group list and gates the loop entry on the user's confirmation — a refusal stops the flow before any dispatch.

## Full Flow Refactor Rationale

The digraph crosses the growth boundary (15 nodes · 19 edges — limit 15 / 17) for the P4.3 whole-group dispatch semantics: the loop's dispatch unit is now the dispatch group (`--tasks <n|n,n,…>` — one surface for a singleton and a merged group), and the task-groups adjudication gate lands between `set-base-branch` and the loop.

- **What the flow gained** — `adjudicate-task-groups` (T) settles the group list from the plan's `## Task Groups` section (declared groups verbatim; an absent section → per-task singleton groups — the pre-group dispatch, exactly) and gates the loop entry on the user's confirmation; a refusal terminates before any dispatch touches the tree. `{more-groups?}` replaces `{more-tasks?}` to name the group iterate. The gate's shape mirrors `determine-base`'s AskUserQuestion template.
- **Why subdivision was rejected** — the gate is one narrow decision on the `C → D` seam; splitting it into finer nodes would add ceremony to a flow whose loop body is unchanged. One decision node plus its refusal terminal is the smallest shape that carries the confirmation gate.
- **Why a rewrite was rejected** — the loop skeleton (review lane → `{blocker=0?}` → fix lane → convergence exit) is shared with the writing-* orchestrators (skeleton-isomorphism family); a rewrite would break the family shape for no behavioral gain.
- **Why the sibling-uniform option was rejected** — no sibling orchestrator dispatches task groups: the writing-* loops review documents, not `--tasks` units, so there is no sibling shape to clone — the adjudication is this skill's own entry surface.

## Node Definitions

### `detect-engine`

- **Do**: Verify the engine is installed: `command -v cdd`. Found → `determine-base`; missing → BLOCKED: cdd-engine-not-installed — run `npm i -g @oscaner-skills/cdd-engine`, then retry. Direct invocation — read the full output (stdout/stderr); cdd truncates its own output. Output filtering is forbidden — no piping to `tail`/`head`, no `2>&1 |`, no `EXIT=$?` capture.
- **Read**: PATH environment variable
- **Exit**: Found → `determine-base`; missing → BLOCKED: cdd-engine-not-installed (soft exit with install guidance)
- **Fail**: PATH check errors → fail-open, proceed with a warning

### `determine-base`

- **Do**: Follow the [base-branch.md](./docs/base-branch.md) methodology — inference sources in order: plan `base` field → branch upstream (`git rev-parse --abbrev-ref @{u}`) → conversation context. If none yields a definitive base, AskUserQuestion — do not guess. Base may already be present in the artifact (skip inference).
- **Read**: plan document + git upstream + conversation context + `cdd base-branch get --plan <path>` (skip inference when the artifact is present) — direct invocation: read the full output (stdout/stderr); cdd truncates its own output. Output filtering is forbidden — no piping to `tail`/`head`, no `2>&1 |`, no `EXIT=$?` capture.
- **Exit**: base resolved → `set-base-branch`
- **Fail**: user refuses to confirm → BLOCKED: base-undecided

### `set-base-branch`

- **Do**: Persist the base via the engine CLI — `cdd base-branch set --plan <path> --base <branch> --source <enum>`, where `source` is `plan-field` | `branch-upstream` | `conversation-context` | `user-confirmed`. The engine is the sole write/read path for the artifact — never hand-write it; `set` is idempotent, refusals and validation errors are engine-handled (exit 2). Direct invocation — read the full output (stdout/stderr); cdd truncates its own output. Output filtering is forbidden — no piping to `tail`/`head`, no `2>&1 |`, no `EXIT=$?` capture.
- **Read**: `cdd base-branch get --plan <path>` (artifact JSON on stdout)
- **Exit**: artifact written (or already present) → `adjudicate-task-groups`
- **Fail**: engine refusal / validation error → report to user; user decides (no hand-written artifact)

### `adjudicate-task-groups`

- **Do**: Settle the dispatch-group list before the loop and gate the loop entry on user confirmation. Read the plan's `## Task Groups` section — the declared groups win verbatim (the `taskGroups` plan record); an absent section is the empty default → every `### Task N:` is its own singleton group (the all-singleton default equals the pre-group per-task dispatch). Present the resulting group list via AskUserQuestion — the same confirmation template as `determine-base`. A non-trivial merged group the user adjudicates (2+ tasks dispatched together as one group) lands in the plan: write the `## Task Groups` section (the section is written ONLY when a non-trivial merged group exists — no groups → no section → zero plan churn), then commit the write as its own independent conventional commit (the Mid-Flight Backfill independent-commit discipline, I7: committed as its own change, never mixed with implementation commits), and the tree must be clean before the loop starts — an uncommitted or foreign dirty tree → BLOCKED. The confirmed group list flows into `implement-task`, one group per `--tasks` argument (`--tasks <n>` singleton-default · `--tasks <a,b>` merged group).
- **Read**: plan `## Task Groups` section (declared groups or the empty default) + user confirmation
- **Exit**: confirmed → `implement-task` (group list flows in via `--tasks`)
- **Fail**: user refuses to confirm → BLOCKED: task-groups-undecided

### `implement-task`

- **Do**: Dispatch `cdd implement --tasks <n|n,n,…> --plan <path>` — background execution (harness `run_in_background` when supported; timeout + poll otherwise). One dispatch group at a time: `<n>` dispatches a singleton-default group (each `### Task N:` is its own group unless the plan's `## Task Groups` section merges it — the all-singleton default equals the pre-group per-task dispatch); `<a,b>` dispatches a merged group from the adjudicated section (`adjudicate-task-groups`). Every nested `cdd` dispatch in this skill forbids historical session flags (`--resume` / `-c`) — one-shot print mode only. Direct invocation — read the full output (stdout/stderr); cdd truncates its own output. Output filtering is forbidden — no piping to `tail`/`head`, no `2>&1 |`, no `EXIT=$?` capture.
- **Read**: output contract — `status` / `blocker` / `artifacts` (absolute paths) / `counters`
- **Exit**: dispatch complete → `run-task-review`
- **Fail**: nested CLI exits with no output → BLOCKED: engine-error (report via `osuperpowers:report-issues`)

### `run-task-review`

- **Do**: Dispatch `cdd review --type task --tasks <n|n,n,…> --plan <path>` — background execution. Every dispatch group goes through implement → review → (fix if blockers); review is unskippable — a group never goes straight from implement to completion. Ensure the working tree is clean before entering review (engine entry gate: dirty → BLOCKED; the orchestrator writes no tree during dispatch). Direct invocation — read the full output (stdout/stderr); cdd truncates its own output. Output filtering is forbidden — no piping to `tail`/`head`, no `2>&1 |`, no `EXIT=$?` capture.
- **Read**: the full stdout — the result line (`status` / `blocker` count); findings full text lives in the handoff (`artifacts`) and is consumed inside `cdd fix` via `--findings`, never by the orchestrator
- **Exit**: `blocker=0?` routes to `fix-task` (both branches; the re-run path is determined by the entry edge)
- **Fail**: review exits with no output → BLOCKED: engine-error

### `fix-task`

- **Do**: Fix ALL review findings (blocker + warn + nit) via `cdd fix --type task --tasks <n|n,n,…> --plan <path> --findings <handoff>` — `<handoff>` is the current cycle's handoff path from `artifacts`. No new review invocation — work from the findings already captured in this cycle. A finding tagged to a LATER task (`Task N:`, later than the current dispatch group's tasks) belongs to the plan's pending-acceptance zone, not this fix: the orchestrator collects it there (I6) — the fix agent holds zero plan-modification authority. Direct invocation — read the full output (stdout/stderr); cdd truncates its own output. Output filtering is forbidden — no piping to `tail`/`head`, no `2>&1 |`, no `EXIT=$?` capture. After the review, the orchestrator reads only the `status` / `blocker` count from the stdout result line; findings full text is consumed by `cdd fix`'s fix-agent via `--findings <handoff>` — the orchestrator must not self-apply findings as inline edits.
- **Read**: captured review handoff `findings[]` (path from `artifacts`)
- **Exit**: entered via blocker>0 → `run-task-review` (re-run); entered via blocker=0 → `more-groups?` (no re-run after blocker=0)
- **Fail**: invoking a new review instead of fixing from captured findings → violates the convergence discipline

### `branch-review`

- **Do**: Dispatch `cdd review --type branch --plan <path> --base <merge-base> --head <head>` — `<merge-base>` = `git merge-base HEAD origin/<base>`; `<head>` = `git rev-parse HEAD`; `<base>` from `cdd base-branch get --plan <path>`; background execution. Persist the diff to the workspace (`git diff <base>..<head> --stat`). Ensure the working tree is clean before entering review (engine entry gate: dirty → BLOCKED; the orchestrator writes no tree during dispatch). Direct invocation — read the full output (stdout/stderr); cdd truncates its own output. Output filtering is forbidden — no piping to `tail`/`head`, no `2>&1 |`, no `EXIT=$?` capture.
- **Read**: `cdd base-branch get` output + branch HEAD + review output contract
- **Exit**: `blocker=0?` routes to `branch-fix` (both branches; the re-run path is determined by the entry edge)
- **Fail**: review exits with no output → BLOCKED: engine-error

### `branch-fix`

- **Do**: Dispatch `cdd fix --type branch --plan <path> --findings <handoff>` — `<handoff>` is the current cycle's source review handoff (`branch-review-{base7}..{head7}-r{R}.json` from `artifacts`); this is the ONLY fix channel for branch findings — an engine-closed `branch-review → branch-fix → re-review` loop with zero inline orchestration (the orchestrator never hand-applies a finding as an editor edit — I5). The fix lands real commits (the engine's exit gate requires a clean tree + `commits.head` match); the ref embedded in the file name (BASE..HEAD commit range) moves with the fix commit → a re-review of the NEW ref is a new review (Review Convergence law, I3). Rounds are a soft cap only (recommended ≤ 3; beyond that the user decides) — a rigid hard cap would deadlock the terminal gate with a persistent blocker, a deliberate symmetry exception to the hard media ceilings (reason recorded, not patched). Direct invocation — read the full output (stdout/stderr); cdd truncates its own output. Output filtering is forbidden — no piping to `tail`/`head`, no `2>&1 |`, no `EXIT=$?` capture. After the review, the orchestrator reads only the `status` / `blocker` count from the stdout result line; findings full text is consumed by `cdd fix`'s fix-agent via `--findings <handoff>` — the orchestrator must not self-apply findings as inline edits.
- **Read**: captured branch-review handoff `findings[]` (path from `artifacts`)
- **Exit**: entered via blocker>0 → `branch-review` (re-run on the moved ref); entered via blocker=0 → `handoff-finishing` (no re-review after blocker=0)
- **Fail**: blockers persist after multiple rounds → implicit fail-open (stop + report; branch preserved; user decides)

### `handoff-finishing`

- **Do**: Prepare the handoff to `osuperpowers:finishing`: ensure the base-branch artifact is written (finishing reads the same artifact inside its `run-finishing-session` merge/PR flow); summarize branch state (commits count / base); invoke `osuperpowers:finishing` to take over (merge / PR / keep / discard).
- **Read**: `cdd base-branch get --plan <path>` output + final branch-review state — direct invocation: read the full output (stdout/stderr); cdd truncates its own output. Output filtering is forbidden — no piping to `tail`/`head`, no `2>&1 |`, no `EXIT=$?` capture.
- **Exit**: handoff complete → APPROVED: finishing
- **Fail**: finishing takeover fails → implicit fail-open (branch preserved; user finishes manually)

## Invariants

| # | Invariant |
|---|-----------|
| I1 | **Host Harness Autodetection** — the engine resolves the host harness internally from ambient environment markers; the orchestrator never passes a harness name down to `cdd`. |
| I2 | **CLI Background Execution** — all `cdd <subcommand>` calls run in background — harness `run_in_background` when supported; timeout + poll otherwise. |
| I3 | **Review Convergence** — blocker=0 → fix all findings (blocker + warn + nit) via `cdd fix`, then stop; do not re-run. Review refs are commit ranges with a double signature: task/branch ref = BASE..HEAD (the fix commit moves HEAD → a re-review of the NEW ref is a new review), plan/spec ref = doc_hash (content evolution → new ref) — the fix commit moves the ref and the engine cannot intercept it, so this discipline is the only guard. No re-review after a blocker=0 review; the cycle ends with the fix of all captured findings. |
| I4 | **Three-Mode Chain Completeness** — every dispatch group (a singleton task or a merged group) goes through the full implement → review → (fix if blockers) chain; review is unskippable, and fix dispatch requires a prior APPROVED review handoff for that group. |
| I5 | **No Controller Bypass** — when the engine is available, the orchestrator must not hand-write control-flow bypasses; all task execution / review / fix dispatch go through engine CLI calls. |
| I6 | **Pending Acceptance** — a finding that targets a LATER task tag (`### Task N:` with N later than the current dispatch group's tasks) is not fixed by this round's agent: the orchestrator collects it, as sole writer, into the plan's dedicated pending-acceptance-patch zone; fix/implement agents hold zero plan-modification authority. |
| I7 | **Mid-Flight Backfill** — a user-raised backfill of overall/spec/plan docs surfaced while a dispatch is in flight lands through four ordered steps on the current `cdd` call's return (any dispatch — implement/review/fix): (1) **land immediately** — hot context; no deferral to cycle close (deferral risks losing the decision); (2) **commit on its own** — committed as its own standalone change, never mixed with implementation commits; (3) **pause the loop until clean** — the loop pauses (tree clean, backfill committed) before the next dispatch; an uncommitted backfill trips the next review's entry gate (dirty → BLOCKED); (4) **audit in-band on resume** — after the loop resumes, the next review audits the backfill in-band (changed-surface booking, not a block); a backfill rewriting the current task's own plan/spec text routes per Pending Acceptance (sole-writer), otherwise it rides the moving ref. |

## Engine Semantics

Orchestrator-facing facts the engine guarantees — read and route on them, never re-derive:

- **Dry-run is pure simulation** — `cdd <subcommand> --dry-run` short-circuits dispatch: no agent spawn, no handoff reads, an APPROVED stub handoff plus the return block contract only (the engine writes the workspace stub regardless of tree state). It never blocks: a dirty working tree under dry-run lands a stderr WARN — never a BLOCK, exit stays 0 — and the exit gate's clean-tree discipline applies to real dispatches only. When verifying behavior with `--dry-run`, treat the stub handoff as simulation, not an acceptance record.
- **`cdd fix --type branch` closes the branch loop** — the only way back from `branch-review` findings to accepted commits is this engine channel (`--findings` = the source `branch-review-{base7}..{head7}-r{R}.json`); hand-applying findings as inline orchestrator edits is a controller bypass (I5).
- **Soft review cap** — branch-fix rounds are soft-limited (recommended ≤ 3) rather than hard-capped by design: a rigid cap between a persistent blocker and "cap exhausted" would deadlock the program's terminal gate. A deliberate symmetry exception to the hard media ceilings — the reason for the exception is recorded here, the cap is not patched; at the cap the user adjudicates (branch preserved, findings reported).
- **Entry gate reads the tree, not the committed range** — the review entry gate checks working-tree cleanliness only (dirty → BLOCKED; dry-run → WARN). It does not assert that HEAD holds exactly the task's canonical commits, so a committed mid-flight backfill clears the gate. The subsequent review audits the widened range — off-ledger changes surface as a changed-surface booking (an engine WARN, not a block) and the scope axis decides; visible, not a block.

## Failure Modes

Cross-node failure handling (complements node Fail fields):

| category | handling |
|---|---|
| TIMEOUT | routed from output contract `status`; retry within the counters cap, then terminal per the output contract |
| CONTRACT_VIOLATION | blocker from output contract; report via `osuperpowers:report-issues`; no re-dispatch |
| ENGINE_SELF_WRITTEN | blocker from output contract; report via `osuperpowers:report-issues`; orchestrator never rewrites handoff state |
| EXECUTION_FAILURE | blocker from output contract; fixable + retry available → re-dispatch; else BLOCKED: engine-error |
| UNVERIFIABLE | blocker from output contract; report to user; re-dispatch only on user confirmation |
| PLAN_CONFLICT | blocker from output contract; surface to the user — never silently override the plan |

**Fail-open vs BLOCKED convention**:

- **BLOCKED**: explicit terminal state; requires user intervention to recover.
- **implicit fail-open**: node-level failure (not in digraph); flow stops + reports to user.
