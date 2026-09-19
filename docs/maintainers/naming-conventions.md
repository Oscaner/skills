# Naming Conventions

Maintainer-only guidance for naming across the repository's authorable surfaces (English-primary; not shipped to consumers). Serves as the conformance baseline for the monorepo structural-consistency acceptance ("全仓命名/结构零冲突").

## Principles

1. **Scoped semantic names** — `<scope>_<semantic>` (snake_case): `task-handoff-schema.json`, `HANDOFF_SCHEMA_JSON`, `rules/commit.ts`. Prefix the scope first so related names group lexicographically.
2. **Full words, no historical abbreviations** — one name, one meaning; a name that needs a glossary entry to decode is a debt. Historical lesson: `H1_BLOCK` was the "stdout return block" (a legacy from the old `## Return (H1 — stdout only)` heading); it had nothing to do with Markdown `# ` headings and had to be renamed `RETURN_STDOUT_BLOCK`. If a name's meaning is not recoverable from the name itself, rename it.
3. **One word one meaning — no multi-sense collisions** — `HANDOFF` / `HANDOFF_TYPE` / `HANDOFF_STUB` coexisting meant the same concept was named three ways. A concept has exactly one name; synonyms are merged.
4. **Canonical ordering for serializable data** — JSON key order is fixed by the canonical file (schema injection must stay byte-stable); never re-serialize with environment-dependent ordering.
5. **Family layout over historical location** — files live under the family they belong to, not where history left them (`review/review.md` → `docs/review.md`, `fix/docs.md` → `docs/fix.md`).

## Application surfaces

| Surface | Convention | Example |
|---|---|---|
| Source files (cdd-engine `src/`) | directories by dependency axis (cli → dispatch → {rules, artifacts, render} → infra); files singular-verb | `src/dispatch/` `src/rules/commit.ts` |
| Schemas | `docs-` / `task-` domain prefix + `handoff-schema` | `schema/task-handoff-schema.json` |
| Prompt template tokens | `<DOMAIN>_<SEMANTIC>`; merged synonyms; scope prefix for variants | `HANDOFF_SCHEMA_JSON` · `HANDOFF_WRITE_GATE` · `REVIEW_TYPE` |
| Template constants | same naming as their injected token | `RETURN_STDOUT_BLOCK` |
| Template layout | family dirs `task/` `docs/`, role file names | `docs/review.md` |
| Registry data | per-entry capability fields, no prose claims | `harness.cache` profile |

## Terminology registry

Single registration point for the repo's governing terms (established by the P6 Task 18 / spec F8 Review Convergence rename). The registry is the serialization exit of terminology arbitration: a term is in force from the moment it is registered here **and** its mechanism surfaces agree with it.

### Arbitration rule (术语第一 / terminology-first)

1. **Terminology wins over mechanism names.** When a term and a mechanism name drift apart semantically, rename the code and docs to reach the term — never stretch a legacy mechanism name back over a landed term. A term's registration here is the definition of the mechanism's contract.
2. **Registration is the exit.** A term has landed only when both hold: it is registered below, and its mechanism surfaces (source identifiers, file names, prompt/invariant text, terminal markers) have been renamed to agree. Registration without rename, or rename without registration, is a half-landed term.
3. **Banned names are composed-form in this table** (underscore-joined), so the registry itself never trips the residue guards — the same convention that lets `H1_BLOCK` appear under the `\bH1\b` guard in `scripts/validate/residue.ts`.

### Active terms

| Term | Definition | Mechanism names |
|---|---|---|
| **Review Convergence** | Single-cycle review discipline: only a previous round that reached `APPROVED` with blocker=0 converges (stops) a re-dispatch; a failure round (BLOCKED/TIMEOUT, findings:[]) stays re-dispatchable (SP-4). | `reviewConvergenceGuard` · `reviewConvergedError` · `convergedExit3` · `rules/convergence.ts` · `countsTowardConvergence` · exit code 3 |
| **review-cycle-cap** | Terminal marker for a fix loop that exhausted its consecutive review cycles → the orchestrator stops retrying (replaces the `fix_loop_exhausted` literal). | `review-cycle-cap` wording on the orchestrator failure surface |
| **dispatch-timeout-cap** | Terminal marker for a TIMEOUT category hitting its counter threshold (≥ 2): `BLOCKED: dispatch-timeout-cap` — the orchestrator's stop-retrying signal. | `terminalFor("TIMEOUT")` · `templates/engine-config.json#failureCategories[].terminal` |
| **engine-error** | Retained terminal marker for EXECUTION_FAILURE — explicitly **not** renamed by F8. | `templates/engine-config.json#failureCategories[].terminal` · `BLOCKED: engine-error` |

### mechanismNames migration list

| Canonical term | Legacy mechanism surface(s) renamed | Current mechanism surface(s) |
|---|---|---|
| Review Convergence | `src/rules/stopping.ts` · `reviewStoppingGuard` · `stoppedExit3` · `reviewStoppedError` · `countsTowardStopping` · `## review_stopping` invariant · `review_stopping:` message prefix · `stopping` field on branch stages | `src/rules/convergence.ts` · `reviewConvergenceGuard` · `convergedExit3` · `reviewConvergedError` · `countsTowardConvergence` · `## Review Convergence` · `Review Convergence:` messages · `convergence` field on branch stages |
| review-cycle-cap | `fix_loop_exhausted` (zero live occurrences at rename time — registered, not renamed) | `review-cycle-cap` |
| dispatch-timeout-cap | `timeout_exhausted` terminal literal `BLOCKED: timeout_exhausted` | `BLOCKED: dispatch-timeout-cap` (canonical `terminal` column + `terminalFor` read point) |
| engine-error | — (retained, registered) | `BLOCKED: engine-error` |

### Banned legacy names (aligned with `scripts/validate/residue.ts` guards)

| Legacy name | Canonical term | Guard |
|---|---|---|
| `review_stopping` (term & identifiers) | Review Convergence | term guard on ALL_MECH_POSITIONS + DOC_SURFACE_TARGETS; identifier guard on engine faces |
| `fix_loop_exhausted` | review-cycle-cap | failed-terminology guard on ALL_MECH_POSITIONS + DOC_SURFACE_TARGETS |
| `timeout_exhausted` | dispatch-timeout-cap | failed-terminology guard on ALL_MECH_POSITIONS + DOC_SURFACE_TARGETS |

### Retained terms (no term-to-mechanism mapping)

Terminology-free mechanism names keep their names — *accurate over elegant* — and register here so the F8 audit's retention list is exhaustive:

`blocker` · `handoff` · `dispatch` · `backfill` · `stale-lexicon` · `residue` · engine-internal function names without a user-facing term.

## Enforcement

- Residue/structure guards assert "no historical-name residue" (e.g. zero `H1_BLOCK`, zero legacy `HANDOFF` triad) — the acceptance criterion "zero legacy names" is a mechanical check, not a review nicety.
- New surfaces follow the convention at birth; the naming doc is the single conformance source.