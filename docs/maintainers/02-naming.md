# Naming Conventions

Maintainer-only guidance for naming across the repo's authorable surfaces (English-primary; not shipped to consumers); the conformance baseline for the structural-consistency acceptance ("全仓命名/结构零冲突").

## 1. Principles

1. **Scoped semantic names** — `<scope>_<semantic>` (snake_case): `issue-body.json`, `RETURN_STDOUT_BLOCK`.
2. **Full words, no historical abbreviations** — one name one meaning; a name needing a glossary to decode is a debt.
3. **One word one meaning** — one name per concept; synonyms merge.
4. **Canonical ordering for serializable data** — JSON key order fixed by the canonical file.
5. **Family layout over historical location** — files live under their owning family.
6. **Retained terms keep their names** — mechanism names without a user-facing term stay: `handoff` · `dispatch` · `backfill` · `stale-lexicon` · `residue`.

## 2. Terminology registry

Single registration point for the repo's governing terms; a term is in force when registered here **and** its mechanism surfaces agree.

### 2.1 Arbitration rule (术语第一 / terminology-first)

1. **Terminology wins over mechanism names** — on drift, rename the mechanism to reach the term.
2. **Registration is the exit** — a term lands only when registered below **and** its surfaces renamed to agree.
3. **Banned names are underscore-joined here**, so the registry never trips the word-face audit (`GUARD_BAN_WORDS`, `face/words.ts`); a reintroduced token lands as a ban row, never a code carve-out.

### 2.2 Active terms

| Term | Definition | Mechanism names |
|---|---|---|
| **Review Convergence** | Only a prior `APPROVED`/blocker=0 round converges a re-dispatch; a failure round (BLOCKED/TIMEOUT, findings:[]) stays re-dispatchable. | `skill-anatomy.ts` · `session/{next,handoff-schema}.ts` |
| **REVIEW_FIX** | Closure state (收口态): a review closed on warn/nit-only findings completes through its fix round — no re-review, no re-dispatch. | `session/handoff-schema.ts` |
| **group-identity (TaskGroup family)** | The dispatch group as one identity: `--tasks <n,n,…>` normalizes to `TaskGroup`; carriers + progress rows are group-keyed; a grouped review attributes findings per-task. | `TaskGroup` · `toTaskGroup` · `groupKey()` · `effectiveGroups` · `tasks-{a},{b}-*` |
| **review-cycle-cap** | A fix loop that exhausted its consecutive review cycles stops retrying. | the orchestrator failure surface |
| **dispatch-timeout-cap** | A TIMEOUT category hitting its counter (≥ 2): `BLOCKED: dispatch-timeout-cap`. | `session/next.ts` (BLOCKED/TIMEOUT face) |
| **engine-error** | Retained terminal marker for EXECUTION_FAILURE — explicitly **not** renamed. | `session/next.ts` · `BLOCKED: engine-error` |
| **blocker** | `blocker` = review finding severity only; `BLOCKED` = round status; handoff `blocker` field = BLOCKED reason. Every op's capsule carries the count (review = own, fix = the `--findings` review, implement = 0). | `blocker` enum · `CDD_BLOCKED:` · `blocker: <n>` |
| **Issue surface** | `issue` — the pure-rendering CLI row (`cdd issue render`: stdin JSON → body → stdout) + emit issue form yml from `formFieldDefs`. | `IssueReportRenderer` · `.github/ISSUE_TEMPLATE/*.yml` |
| **Command-contract wording** | Command-contract vocabulary is single-sourced in the word table. | `face/words.ts` · `words.guard.test.ts` |
| **backfill** | Land a durable fact into its owning doc (overall / spec / plan) — the destination of a ruling that asserts a project-level fact. Distinct from the per-round carrier action. | `cdd-plan` (backfill-design) · `cdd-close` (closeout-backfill) · cdd-dev I6 |
| **annotate** | The per-round carrier action: when a finding needs a user ruling, record the ruling in the round's findings file (the fix child's input), never a durable doc. The one carrier write the `next:` fix suffix names. | `session/next.ts` (`FIX_READBACK_SUFFIX`) · `face/capsule.ts` |

**Return-block constants are not injection slots.** `RETURN_STDOUT_BLOCK` is the ONE return contract (`render/templates.ts`) — a literal label, never a moustache, never a registry token; only `round-context` slots are injected. The status enum (`APPROVED`/`BLOCKED`/`CHANGES_REQUESTED`/`REVIEW_FIX`/`TIMEOUT`) is the same class.

### 2.3 Banned legacy names (aligned with `GUARD_BAN_WORDS`)

| Legacy name | Canonical term |
|---|---|
| `review_stopping` (term & identifiers) | Review Convergence |
| `fix_loop_exhausted` | review-cycle-cap |
| `timeout_exhausted` | dispatch-timeout-cap |

Reintroduction = a `GUARD_BAN_WORDS` row + the word-face audit scan, never a code carve-out.

## 3. Zh translation glosses

Zh-surface translation register (specs/plans + README family): one English term → one fixed Zh translation. (Ruling: first-party → 第一方)

| English term | Zh translation | Status |
|---|---|---|
| first-party | 第一方 | Active —「一方」is banned as the first-party translation |

## 4. Enforcement

Residue/structure guards assert "no historical-name residue"; new surfaces follow the convention at birth, and this doc is the single conformance source. Mechanically checkable rules become assertions; uncheckable ones live here as prose.
