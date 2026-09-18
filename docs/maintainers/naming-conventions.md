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

## Enforcement

- Residue/structure guards assert "no historical-name residue" (e.g. zero `H1_BLOCK`, zero legacy `HANDOFF` triad) — the acceptance criterion "zero legacy names" is a mechanical check, not a review nicety.
- New surfaces follow the convention at birth; the naming doc is the single conformance source.