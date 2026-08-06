# Tickets: p1-slim.3 Orchestrator load footprint 瘦身

Parent plan: [../plans/2026-08-05-sdd-slim-orchestrator-p1-slim-3.md](../plans/2026-08-05-sdd-slim-orchestrator-p1-slim-3.md) · Design: [../specs/2026-08-05-sdd-slim-orchestrator-p1-slim-3-design.md](../specs/2026-08-05-sdd-slim-orchestrator-p1-slim-3-design.md)

Work the **frontier**: any ticket whose blockers are all done.

## T1 — H6 reference doc + slim controller-handoff

**What to build:** CLI env/exit/harness tables live only in `docs/sdd-h6-reference.md`; orchestrator skill retains H1–H5 gate rules plus a one-block H6–H8 pointer. Tier 1 line budget starts dropping.

**Blocked by:** None — can start immediately.

**Plan tasks covered:** Task 1

- [ ] `docs/sdd-h6-reference.md` created with H6–H8 + Mode B content
- [ ] `controller-handoff/SKILL.md` ≤ 110 lines; no `SDD_WORKSPACE` in skill body
- [ ] H4/H5 cite `templates/sdd-handoff-schema.md` (path placeholder OK until T2)
- [ ] Commit: `feat: split SDD H6–H8 to reference doc and slim controller-handoff`

## T2 — Handoff schema SOT + slim handoff-writer

**What to build:** handoff.json shape defined once in `templates/sdd-handoff-schema.md`; handoff-writer and CLI handoff template cite it; no duplicate JSON examples in skills.

**Blocked by:** None — can start immediately (parallel with T1).

**Plan tasks covered:** Task 2

- [ ] `templates/sdd-handoff-schema.md` has single + batch JSON examples and field tables
- [ ] `spor-handoff-writer/SKILL.md` ≤ 90 lines; zero `"task":` JSON blocks inline
- [ ] `templates/sdd-cli/handoff.md` cites schema
- [ ] Commit: `feat: single-source handoff.json schema`

## T3 — p0-fallback skill + slim spor-SDD + D4 pointer

**What to build:** p0 worker rules lazy-loaded from `spor-sdd-p0-fallback` on Rule 0b only; spor-SDD drops Rules 3/5b/5c; review-dispatch D4 becomes pointer; manifest has no p0-fallback row.

**Blocked by:** T1 (Rule 7 / Rule 0a cite updates), T2 (schema path stable)

**Plan tasks covered:** Task 3

- [ ] `spor-sdd-p0-fallback/SKILL.md` exists with Rules 3/5b/5c + D4 appendix
- [ ] `spor-SDD/SKILL.md` ≤ 160 lines; no Rule 3/5b/5c bodies
- [ ] Rule 0a item 3 worker bullet no longer references deleted rules
- [ ] review-dispatch D4 is pointer-only
- [ ] Commit: `feat: lazy-load p0 SDD rules and slim spor-SDD`

## T4 — Line-budget CI + docs + smoke

**What to build:** Automated Tier 1/2 line caps in CI; overall inventory updated; cross-harness doc note; design spec smoke rows filled; full validate green.

**Blocked by:** T1, T2, T3

**Plan tasks covered:** Task 4

- [ ] `tests/sdd-orchestrator-line-budget.test.sh` passes (Tier 1 ≤225, Tier 2 ≤350)
- [ ] `validate-overrides-build.sh` asserts p0-fallback dir + not in manifest
- [ ] `pnpm run validate` exit 0
- [ ] AC 5/6 smoke checklist completed; design spec §Smoke updated
- [ ] overall v2.3 inventory row added
- [ ] Commit: `chore: SDD orchestrator line-budget CI and overall p1-slim.3 inventory`
