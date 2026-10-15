---
name: cdd-dev
description: Independent cdd-dev orchestrator -- Node-anchored flow with digraph as single control-flow source of truth. Determines base via the engine artifact, dispatches the CDD implement / review / fix chain following the engine's next: line, runs the branch final review, and hands off to cdd-close. Callable standalone; referenced by no other skill.
---

# Kairos CDD-Dev

Executes planned tasks through the engine's implement / review / fix chain — its own orchestrator decisions (mode chain, final review) following the engine's next: line, with no installed-engine precondition (npx pulls the engine on demand).

**Invocation discipline** — every engine command runs via `npx -y @oscaner-skills/cdd-engine@latest <subcommand>` as a background dispatch: launch it in the background and await the completion notification — never poll — then read the full output (stdout/stderr). Output filtering is forbidden — no piping to `tail`/`head`, no `2>&1 |`, no `EXIT=$?` capture. **Round rhythm** — one review pass per dispatch; a fix round re-enters the review while the route is not done; the implement child commits its own work; ensure the working tree is clean before entering review (dirty → BLOCKED); the orchestrator writes no tree during dispatch. **Failure face** — cross-node failure handling lives in the Failure Modes table below (the single source); node `Fail` entries keep only local behavior.

## Flow Digraph

```mermaid
flowchart TD
  A[determine-base] --> B[set-base]
  B --> C[implement-wave]
  C --> L[NEXT-LOOP]
  L -->|until next=done| L
  L -->|next=done| K[branch-review]
  L -->|no next| Z1((BLOCKED))
  K -->|fix| F[branch-fix]
  F -->|until next=done| K
  F -->|next=done| H[handoff-cdd-close]
  K -->|next=done| H[handoff-cdd-close]
```

## Node Definitions

### `determine-base`

- **Do**: Resolve the base branch — inference sources in order: plan `base` field → branch upstream (`git rev-parse --abbrev-ref @{u}`) → conversation context; if none yields a definitive base, ask the user — do not guess. The base may already be present in the artifact (`npx -y @oscaner-skills/cdd-engine@latest base get --plan <path>`); skip inference when the artifact is present.
- **Read**: plan document + git upstream + conversation context + `npx -y @oscaner-skills/cdd-engine@latest base get --plan <path>`
- **Exit**: base resolved → `set-base`
- **Fail**: user refuses to confirm → BLOCKED: base-undecided

### `set-base`

- **Do**: Persist the base via the engine CLI — `npx -y @oscaner-skills/cdd-engine@latest base set --plan <path> --base <branch> --source <enum>`, where `source` is `plan-field` | `branch-upstream` | `conversation-context` | `user-confirmed`. The engine is the sole write/read path for the artifact — never hand-write it; `set` is idempotent, refusals and validation errors are engine-handled.
- **Read**: `npx -y @oscaner-skills/cdd-engine@latest base get --plan <path>` (the artifact on stdout)
- **Exit**: artifact written (or already present) → `implement-wave`
- **Fail**: engine refusal / validation error → report to user; user decides (no hand-written artifact)

### `implement-wave`

- **Do**: Dispatch `npx -y @oscaner-skills/cdd-engine@latest implement --tasks <n|n,n,…> --plan <path>` — one dispatch wave per iteration; dispatch each wave as the engine returns it, never a hand-picked subset.
- **Read**: the engine output — its conclusion and the dispatch-ready `next:` line (the literal next step); a BLOCKED round carries no `next:` line and rides its reason on stderr
- **Exit**: dispatch complete → `NEXT-LOOP`
- **Fail**: nested CLI exits with no output → BLOCKED: engine-error (report via `kairos:cdd-report`（pi：/skill:cdd-report）)

### `NEXT-LOOP`

- **Do**: Run the wave review-fix rhythm through the engine — one review pass per dispatch. Dispatch the wave review (`npx -y @oscaner-skills/cdd-engine@latest review --type wave --tasks <n|n,n,…> --plan <path>`); dispatch the output's `next:` line as written — the literal is the route: a fix dispatch consumes the findings handoff, a next-wave dispatch runs through `implement-wave`, a closure routes to `branch-review`; a BLOCKED/TIMEOUT round carries no `next:` line — its reason rides stderr for reporting.
- **Read**: the full stdout — the review conclusion and the `next:` line (the dispatch-ready literal — fix / the next wave / done)
- **Exit**: the `next:` line reads `done` → `branch-review`; each fix / next-wave pass re-enters this hub while the route is not done (the `until next=done` self-loop)
- **Fail**: review exits with no output → BLOCKED: engine-error

### `branch-review`

- **Do**: Dispatch the branch final review (`npx -y @oscaner-skills/cdd-engine@latest review --type branch --plan <path>`) — the review judges the live tree against the resolved base branch.
- **Read**: the base artifact + the review output contract (the `next:` line)
- **Exit**: the `next:` line reads `fix …` → `branch-fix`; `done` → `handoff-cdd-close`
- **Fail**: review exits with no output → BLOCKED: engine-error

### `branch-fix`

- **Do**: Dispatch the branch fix (`npx -y @oscaner-skills/cdd-engine@latest fix --type branch --plan <path> --findings <path>`) — the findings handoff is the current cycle's source branch review; this is the ONLY fix channel for branch findings — the orchestrator never hand-applies a finding as an editor edit. The branch loop is its OWN closure — the fix round's `next:` line re-enters `branch-review` while the route is not done and closes to `handoff-cdd-close` on `done`.
- **Read**: the captured branch-review handoff findings (path from the review output)
- **Exit**: the fix output's `next:` line routes the next hop — a re-review (re-enter `branch-review`, the independent loop) or a `done` closure (`handoff-cdd-close`)
- **Fail**: blockers persist after multiple rounds → implicit fail-open (stop + report; branch preserved; user decides)

### `handoff-cdd-close`

- **Do**: Hand off to `/kairos:cdd-close`（pi：/skill:cdd-close）
- **Read**: the base artifact output + final branch-review state
- **Exit**: handoff complete → APPROVED: cdd-close
- **Fail**: cdd-close takeover fails → implicit fail-open (branch preserved; user finishes manually)

## Invariants

| # | Invariant |
|---|---|
| I1 | **Host Harness Autodetection** — the engine resolves the host harness itself; the orchestrator never passes a harness name down to the CLI |
| I2 | **Review Convergence (next: is the dispatch)** — a review closes by its conclusion (APPROVED / CHANGES_REQUESTED / REVIEW_FIX), and the output's `next:` line carries the engine's default next step as a complete executable command; read the `next:` line and dispatch it as written — the literal is the dispatch, no kind→command mapping layer. A mid-backfill or a user adjudication that lands governs over the suggestion (current world state wins). Fixes always dispatch via the fix round, consuming the findings handoff; the orchestrator must not edit in place as a substitute; a fix commit makes the next review a new review |
| I3 | **Wave-Chain Completeness** — every dispatch wave (a singleton task or a merged wave) goes through the full implement → review → (fix if findings) chain; review is unskippable, and a fix dispatch requires a prior review handoff for that wave |
| I4 | **No Controller Bypass** — the orchestrator must not hand-write control-flow bypasses; all task execution / review / fix dispatch go through engine CLI calls, and the engine's `next:` line decides the order — never orchestrator guesswork |
| I5 | **Mid-Flight Backfill** — a user-raised backfill of overall/spec/plan docs surfaced while a dispatch is in flight lands through four ordered steps on the current call's return: (1) **land immediately** — hot context, no deferral; (2) **commit on its own** — a standalone change, never mixed with implementation commits; (3) **pause the loop until clean** — an uncommitted backfill trips the next review's entry gate (dirty → BLOCKED); (4) **audit in-band on resume** — the next review audits the backfill in-band; a backfill rewriting the current task's own plan/spec text routes through the orchestrator as Plan Sole Writer |

## Failure Modes

Cross-node failure handling (complements node Fail fields):

| category | handling |
|---|---|
| TIMEOUT | a round that timed out; retry within the handoff's counters cap, then terminal per the output contract |
| BLOCKED | a round the engine refused to advance (no `next:` line); report the carried reason to the user and let them decide — never silently override the plan |
| HARD_ERROR | a completed round with no `next:` line that is not BLOCKED/TIMEOUT — report the carried reason; re-run the same command to continue |

**Fail-open vs BLOCKED convention**:

- **BLOCKED**: explicit terminal state; requires user intervention to recover.
- **implicit fail-open**: node-level failure (not in digraph); flow stops + reports to user.
