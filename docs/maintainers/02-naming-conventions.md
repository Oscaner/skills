# Naming Conventions

Maintainer-only guidance for naming across the repository's authorable surfaces (English-primary; not shipped to consumers). Serves as the conformance baseline for the monorepo structural-consistency acceptance ("全仓命名/结构零冲突").

## 1. Principles

1. **Scoped semantic names** — `<scope>_<semantic>` (snake_case): `issue-body.json`, `RETURN_STDOUT_BLOCK`, `src-next/face/cli.ts`.
2. **Full words, no historical abbreviations** — one name, one meaning; a name that needs a glossary entry to decode is a debt. Historical lesson: `H1_BLOCK` was the "stdout return block" and had to be renamed `RETURN_STDOUT_BLOCK`.
3. **One word one meaning — no multi-sense collisions** — `HANDOFF` / `HANDOFF_TYPE` / `HANDOFF_STUB` coexisting named one concept three ways; a concept has exactly one name, synonyms are merged.
4. **Canonical ordering for serializable data** — JSON key order is fixed by the canonical file (schema injection must stay byte-stable); never re-serialize with environment-dependent ordering.
5. **Family layout over historical location** — files live under the family they belong to, not where history left them.

## 2. Application surfaces

| Surface | Convention | Example |
|---|---|---|
| Source files (cdd-engine `src-next/`) | directories by plane (contract · face · infra · render · session) + `bin.ts`; files role-named | `src-next/face/cli.ts` `src-next/contract/project.ts` |
| Schemas | the typed handoff-schema declaration (`src-next/session/handoff-schema.ts`) — one source, two projections | `schemaText` · the read-back validator |
| Prompt template tokens | `<DOMAIN>_<SEMANTIC>`; merged synonyms; scope prefix for variants | `HANDOFF_TARGET` · `HANDOFF_WRITE_GATE` · `REVIEW_TYPE` |
| Template constants | same naming as their injected token | `RETURN_STDOUT_BLOCK` |
| Template layout | skeleton sections declared canonically (`src-next/render/templates.ts`); named by role, not history | the per-mode shells · `tokens` zone rows |
| Registry data | per-entry capability fields, no prose claims | `harness.cache` profile |
| Dispatch group identity | `--tasks <n,n,…>` — the CLI parse surface for `TaskGroup`; handoff carriers / progress rows group-keyed (`tasks-{a},{b}-*` merged · `tasks-{N}-*` singleton) | `--tasks 1` → `[1]` · `--tasks 1,2` → `[1,2]` · `{group}` progress row |
| Issue surface | `issue` — the pure-rendering CLI row (`cdd issue render`: stdin JSON → aggregate body → stdout, Non-goal #1 exception) + emit issue form yml from the same `formFieldDefs` | `IssueReportRenderer` · `issue-body.json` · `.github/ISSUE_TEMPLATE/*.yml` · `renderIssueYml` |
| Command-contract wording | single-sourced in the single word table (`src-next/face/words.ts`) | the `checkWords` word-face audit (`scripts/lib/guard.ts`) |

**Return-block constants are not injection slots.** `RETURN_STDOUT_BLOCK` is the ONE return contract (`src-next/render/templates.ts`) — a literal label, never a moustache, never a registry token (the `RETURN_FORMAT`/`RETURN_JSON`/`DOCS_FIX` discrimination retired). Only `round-context` slots are injected. The handoff status enum (`APPROVED`/`BLOCKED`/`CHANGES_REQUESTED`/`REVIEW_FIX`/`TIMEOUT`) is the same constant class (schema values).

## 3. Terminology registry

Single registration point for the repo's governing terms. A term is in force from the moment it is registered here **and** its mechanism surfaces agree with it.

### 3.1 Arbitration rule (术语第一 / terminology-first)

1. **Terminology wins over mechanism names** — when a term and a mechanism name drift apart semantically, rename the code and docs to reach the term. Registration here defines the mechanism's contract.
2. **Registration is the exit** — a term lands only when both hold: registered below, and its mechanism surfaces renamed to agree. Registration without rename (or vice versa) is a half-landed term.
3. **Banned names are composed-form in this table** (underscore-joined), so the registry itself never trips the word-face audit (`GUARD_BAN_WORDS` in `src-next/face/words.ts`; `checkWords` scan, `scripts/lib/guard.ts`); a reintroduced token lands as a ban row, never a code carve-out.

### 3.2 Active terms

| Term | Definition | Mechanism names |
|---|---|---|
| **Review Convergence** | Single-cycle review discipline: only a previous round that reached `APPROVED` with blocker=0 converges (stops) a re-dispatch; a failure round (BLOCKED/TIMEOUT, findings:[]) stays re-dispatchable (SP-4). | the `Review Convergence` skill-invariant entries · the wording + closure faces (`src-next/contract/skill-anatomy.ts` · `src-next/session/{next,handoff-schema}.ts`) |
| **REVIEW_FIX** | Closure state (收口态): a review closed on warn/nit-only findings routes through its fix round to complete — no re-review, no re-dispatch (`#278`). | the REVIEW_FIX derivation + status enum (`src-next/session/handoff-schema.ts`) · warn/nit severity rollup |
| **group-identity (TaskGroup family)** | The dispatch group as one identity: `--tasks <n,n,…>` normalizes to the `TaskGroup` value object; carriers + progress rows are group-keyed; a grouped review attributes findings per-task. | `TaskGroup` · `toTaskGroup` · `groupKey()` · `effectiveGroups` · `tasks-{a},{b}-*` · `{group}` progress row |
| **review-cycle-cap** | Terminal marker for a fix loop that exhausted its consecutive review cycles → the orchestrator stops retrying (replaces the `fix_loop_exhausted` literal). | `review-cycle-cap` wording on the orchestrator failure surface |
| **dispatch-timeout-cap** | Terminal marker for a TIMEOUT category hitting its counter threshold (≥ 2): `BLOCKED: dispatch-timeout-cap` — the orchestrator's stop-retrying signal. | the BLOCKED/TIMEOUT failure face (`src-next/session/next.ts` — `CDD_BLOCKED:`, zero `next:`) |
| **engine-error** | Retained terminal marker for EXECUTION_FAILURE — explicitly **not** renamed by F8. | the BLOCKED/TIMEOUT failure face (`src-next/session/next.ts`) · `BLOCKED: engine-error` |
| **blocker** | Bounded mapping (one word, one meaning): `blocker` = review finding severity only (M1); `BLOCKED` = round status (M4); handoff `blocker` field (docs face) = BLOCKED reason string (task/branch face vacant — reasons via stderr `CDD_BLOCKED:`); every op's status capsule carries the M1 count (review = own findings, fix = the `--findings` input review, implement = 0). | severity enum `blocker` · handoff-schema `blocker` field (docs) · `CDD_BLOCKED:` · the all-op capsule `blocker: <n>` (`src-next/face/capsule.ts`) |

### 3.3 mechanismNames migration list

| Canonical term | Legacy mechanism surface(s) renamed | Current mechanism surface(s) |
|---|---|---|
| Review Convergence | `src/rules/stopping.ts` · `reviewStoppingGuard` · `stoppedExit3` · `reviewStoppedError` · `countsTowardStopping` · `## review_stopping` invariant · `review_stopping:` message prefix · `stopping` field | the 3.2 `Review Convergence` row's Mechanism names (live) |
| review-cycle-cap | `fix_loop_exhausted` (registered, not renamed) | `review-cycle-cap` |
| dispatch-timeout-cap | `timeout_exhausted` terminal literal `BLOCKED: timeout_exhausted` | `BLOCKED: dispatch-timeout-cap` wording — the BLOCKED/TIMEOUT failure face (`src-next/session/next.ts`) |
| engine-error | — (retained, registered) | `BLOCKED: engine-error` |
| blocker | stdout return-block `blocker:` column · `blockerDefaultFor` | — (retired; `blockerDefaultFor` deleted) |

### 3.4 Banned legacy names (aligned with the word-face audit — `GUARD_BAN_WORDS` in `src-next/face/words.ts` · `checkWords` in `scripts/lib/guard.ts`)

| Legacy name | Canonical term | Guard |
|---|---|---|
| `review_stopping` (term & identifiers) | Review Convergence | registered deletion record — reintroduction = a `GUARD_BAN_WORDS` row, never a code carve-out |
| `fix_loop_exhausted` | review-cycle-cap | registered deletion record — reintroduction = a `GUARD_BAN_WORDS` row + `checkWords` scan |
| `timeout_exhausted` | dispatch-timeout-cap | registered deletion record — reintroduction = a `GUARD_BAN_WORDS` row + `checkWords` scan |

### 3.5 Retained terms (no term-to-mechanism mapping)

Terminology-free mechanism names keep their names — *accurate over elegant* — and register here so the retention list is exhaustive:

`handoff` · `dispatch` · `backfill` · `stale-lexicon` · `residue` · engine-internal function names without a user-facing term.

### 3.6 Zh translation glosses

Zh-surface translation register (specs/plans + README family, Strategy B surfaces): one English term → one fixed Zh translation. (Ruling: first-party → 第一方.)

| English term | Zh translation | Status |
|---|---|---|
| first-party | 第一方 | Active —「一方」is banned as the first-party translation |

## 4. Enforcement

- Residue/structure guards assert "no historical-name residue" (zero `H1_BLOCK`, zero legacy `HANDOFF` triad).
- New surfaces follow the convention at birth; the naming doc is the single conformance source.
