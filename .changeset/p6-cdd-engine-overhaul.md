---
"@oscaner-skills/cdd-engine": major
"@oscaner-skills/osuperpowers": minor
---

feat(cdd-engine): P6 overhaul — handoff contract unification + review mode normalization + stale-lexicon guard

- **Handoff naming canonical single-source** (`templates/handoff-namespace.json`): `{type}-{op}[-{round}]` — `spec-review-{R}` / `spec-fix-{R}` / `plan-review-{R}` / `plan-fix-{R}` / `task-{N}-implement` / `task-{N}-review-{R}` / `task-{N}-fix-{R}` / `branch-review-{base7}..{head7}-r{R}`; all literal naming sites + workspace derivation route through the derived `handoff-naming` layer (no second literal / second workspace derivation).
- **workspace single-root**: all handoffs collect under `.superpowers/cdd/<slug>/`; the flat `.superpowers/docs-review/` root is retired.
- **mode normalization**: `task-review` mode → `review` (CDD_MODE / VALID_MODES / progress `rounds["review"]` / handoff `phase:"review"`; `cdd-handoff-schema.json` phase enum → `["implement","review","fix","branch-review"]`).
- **status single-authority**: review-type handoff status derived from `rollupStatus(findings)` (SP-4 failure-round exemptions); implement handoffs runner-materialized from H1 + brief `TASK_BASE` + git HEAD (commits single-authority); `cdd contract` subcommand removed.
- **finalizeHandoff 定稿统一**: `writeOwnHandoff` full-overwrite; implement/review/fix converge on one finalize path; post-run commit-contract enforced.
- **stale-lexicon zero-residue guard**: `scripts/validate/residue.mjs` — `RESIDUE_TARGETS` extended to cdd-engine `bin`+`templates`; new `STALE_LEXICON_CHECKS` (zero-exemption) merged into the 5c step (13 blocks unchanged); canonical vocabulary (`dogfood (CDD session)` dropdown, `spec-review-1.json`, contract `spec D1/D4/D5a` comments) must not false-positive.
- osuperpowers: cli-select failure-mode recovery drops "same labels as above" — explicit no-manual-labels (only the session master carries `session, osuperpowers`).
