# Naming Conventions

Maintainer-only guidance for naming across the repository's authorable surfaces (English-primary; not shipped to consumers). Serves as the conformance baseline for the monorepo structural-consistency acceptance ("全仓命名/结构零冲突"). The code is the sample — this document carries the governing principles and the terminology registry, not a mechanism map.

## 1. Principles

1. **Scoped semantic names** — `<scope>_<semantic>` (snake_case): `issue-body.json`, `RETURN_STDOUT_BLOCK`, `src-next/face/cli.ts`.
2. **Full words, no historical abbreviations** — one name, one meaning; a name that needs a glossary entry to decode is a debt (historical lesson: `H1_BLOCK` → `RETURN_STDOUT_BLOCK`).
3. **One word one meaning — no multi-sense collisions** — a concept has exactly one name; synonyms are merged.
4. **Canonical ordering for serializable data** — JSON key order is fixed by the canonical file (schema injection stays byte-stable); never re-serialize with environment-dependent ordering.
5. **Family layout over historical location** — files live under the family they belong to, not where history left them.
6. **Retained terms keep their names** — terminology-free mechanism names stay as-is (*accurate over elegant*): `handoff` · `dispatch` · `backfill` · `stale-lexicon` · `residue` · engine-internal function names without a user-facing term.

## 2. Terminology registry

Single registration point for the repo's governing terms. A term is in force from the moment it is registered here **and** its mechanism surfaces agree with it.

### 2.1 Arbitration rule (术语第一 / terminology-first)

1. **Terminology wins over mechanism names** — when a term and a mechanism name drift apart semantically, rename the code and docs to reach the term. Registration here defines the mechanism's contract.
2. **Registration is the exit** — a term lands only when both hold: registered below, and its mechanism surfaces renamed to agree. Registration without rename (or vice versa) is a half-landed term.
3. **Banned names are composed-form in this table** (underscore-joined), so the registry itself never trips the word-face audit (`GUARD_BAN_WORDS` in `src-next/face/words.ts`); a reintroduced token lands as a ban row, never a code carve-out.

### 2.2 Active terms

| Term | Definition | Mechanism names |
|---|---|---|
| **Review Convergence** | Single-cycle review discipline: only a previous round that reached `APPROVED` with blocker=0 converges (stops) a re-dispatch; a failure round (BLOCKED/TIMEOUT, findings:[]) stays re-dispatchable. | the `Review Convergence` skill-invariant entries · the wording + closure faces (`src-next/contract/skill-anatomy.ts` · `src-next/session/{next,handoff-schema}.ts`) |
| **REVIEW_FIX** | Closure state (收口态): a review closed on warn/nit-only findings routes through its fix round to complete — no re-review, no re-dispatch. | the REVIEW_FIX derivation + status enum (`src-next/session/handoff-schema.ts`) · warn/nit severity rollup |
| **group-identity (TaskGroup family)** | The dispatch group as one identity: `--tasks <n,n,…>` normalizes to the `TaskGroup` value object; carriers + progress rows are group-keyed; a grouped review attributes findings per-task. | `TaskGroup` · `toTaskGroup` · `groupKey()` · `effectiveGroups` · `tasks-{a},{b}-*` · `{group}` progress row |
| **review-cycle-cap** | Terminal marker for a fix loop that exhausted its consecutive review cycles → the orchestrator stops retrying. | `review-cycle-cap` wording on the orchestrator failure surface |
| **dispatch-timeout-cap** | Terminal marker for a TIMEOUT category hitting its counter threshold (≥ 2): `BLOCKED: dispatch-timeout-cap`. | the BLOCKED/TIMEOUT failure face (`src-next/session/next.ts` — `CDD_BLOCKED:`, zero `next:`) |
| **engine-error** | Retained terminal marker for EXECUTION_FAILURE — explicitly **not** renamed. | the BLOCKED/TIMEOUT failure face (`src-next/session/next.ts`) · `BLOCKED: engine-error` |
| **blocker** | Bounded mapping (one word, one meaning): `blocker` = review finding severity only; `BLOCKED` = round status; handoff `blocker` field (docs face) = BLOCKED reason string. Every op's status capsule carries the count (review = own findings, fix = the `--findings` input review, implement = 0). | severity enum `blocker` · handoff-schema `blocker` field (docs) · `CDD_BLOCKED:` · the all-op capsule `blocker: <n>` (`src-next/face/capsule.ts`) |
| **Issue surface** | `issue` — the pure-rendering CLI row (`cdd issue render`: stdin JSON → aggregate body → stdout) + emit issue form yml from the same `formFieldDefs`. | `IssueReportRenderer` · `issue-body.json` · `.github/ISSUE_TEMPLATE/*.yml` · `renderIssueYml` |
| **Command-contract wording** | Command-contract vocabulary is single-sourced in the single word table. | `src-next/face/words.ts` · the word-face audit (`src-next/face/__tests__/words.guard.test.ts` · `packages/kairos/tests/words.test.ts`) |

**Return-block constants are not injection slots.** `RETURN_STDOUT_BLOCK` is the ONE return contract (`src-next/render/templates.ts`) — a literal label, never a moustache, never a registry token. Only `round-context` slots are injected. The handoff status enum (`APPROVED`/`BLOCKED`/`CHANGES_REQUESTED`/`REVIEW_FIX`/`TIMEOUT`) is the same constant class (schema values).

### 2.3 Banned legacy names (aligned with the word-face audit — `GUARD_BAN_WORDS` in `src-next/face/words.ts`)

| Legacy name | Canonical term | Guard |
|---|---|---|
| `review_stopping` (term & identifiers) | Review Convergence | reintroduction = a `GUARD_BAN_WORDS` row, never a code carve-out |
| `fix_loop_exhausted` | review-cycle-cap | reintroduction = a `GUARD_BAN_WORDS` row + the word-face audit scan |
| `timeout_exhausted` | dispatch-timeout-cap | reintroduction = a `GUARD_BAN_WORDS` row + the word-face audit scan |

## 3. Zh translation glosses

Zh-surface translation register (specs/plans + README family): one English term → one fixed Zh translation. (Ruling: first-party → 第一方.)

| English term | Zh translation | Status |
|---|---|---|
| first-party | 第一方 | Active —「一方」is banned as the first-party translation |

## 4. Enforcement

- Residue/structure guards assert "no historical-name residue" (zero legacy identifiers); new surfaces follow the convention at birth, and this doc is the single conformance source.
- Where a naming rule becomes mechanically checkable it becomes an assertion — only genuinely uncheckable rules live here as prose.
