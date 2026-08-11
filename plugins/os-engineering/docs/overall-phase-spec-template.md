# Overall + Phase Spec Organization Template

**Document structure only** — what produced specs contain. Process: `SKILL.md` Rule 3 (flow + invariants + steps 3a–3e). Read both before drafting.

---

## Language

Write in the **user's language** (headings, labels, status, blockquotes). Do not default to any fixed locale. Localize placeholders below; keep phase IDs, tags, SHAs, paths locale-neutral.

---

## File paths

One **program date** + **feature slug** under `docs/superpowers/`:

| Artifact | Path |
|---|---|
| Overall | `specs/YYYY-MM-DD-<feature>-overall.md` |
| Phase spec | `specs/YYYY-MM-DD-<feature>-<phase-id>-design.md` |
| Phase plan | `plans/YYYY-MM-DD-<feature>-<phase-id>.md` |
| Phase tickets | `tickets/YYYY-MM-DD-<feature>-<phase-id>-tickets.md` |

`<phase-id>` lowercase (`p0`, `p2a`, …). Inventory columns link here once files exist.

---

## Overall Spec

### Header

```
- **Version**: v1.0 · YYYY-MM-DD
- **Status**: Draft | Approved | In progress | Complete
- **Author**: [human] · [harness + model at writing time]
- **Constraints**: [project-level, one per line]
```

Minor version bump: decomposition, scope shift, phase complete. Major: program goal/constraint rewrite.

### §0 Document scope

- Charter only — no implementation detail.
- **Overall approval ≠ phase started** (SKILL step 4 gate).
- Deviations update here first (Rule 3b).

### §1 Program charter

Goal (1–3 sentences), non-goals, cross-cutting constraints. **Exclude:** acceptance criteria, API shapes, component design, tasks.

### §2 Phase inventory

```markdown
| # | Phase | Design spec | Implementation plan |
|---|---|---|---|
| P0 | [one paragraph scope] | [Pending] | [Pending] |
```

- Scope column: decomposition context only.
- **Split:** replace parent row with Na, Nb **before** sub-phase work continues (Rule 3b/3d).
- Cells: Pending → link; on ship, completion marker on **plan** cell only.

### §3 Dependency graph (ASCII)

Sync with inventory on add/split/reorder.

### §4 Boundary rules (blockquote)

> Each phase: full brainstorming → plan → dev. Shipped before dependents start.

### §5 Maintenance

- Update links + change history per phase; no task lists.
- Master spec for cross-phase conventions; phase specs incremental.
- Strategy shifts and splits feed back **immediately** (Rule 3b).

### §6 Change history

Append-only: completion, decomposition, scope shift, status transition.

---

## Phase Spec

### Header

```
- **Version**, **Status** (Draft | Approved | Plan pending | Shipped)
- **Author**, **Parent program** (link + version), **Depends on** (upstream + tags)
```

### §0 Incremental warning

> Phase N increment only. Cross-phase conventions in [overall](link); overall wins on conflict.

### §1 Constraints pointer

> Does not repeat overall conventions. Overall wins on conflict.

### §2 Design body

This phase's increment: approaches, architecture, components, data flow, errors, testing, **acceptance criteria**. Discovery cycle: Rule 3a before writing.

### §3 Deviations from overall (if cross-phase drift)

| Overall assumption | Phase decision | Overall updated? |
|---|---|---|
| … | … | Yes — v1.x · date |

Required when phase diverges on cross-phase matters. **Overall updated?** must be Yes before review.

### §4 Notes for downstream (optional)

Later-phase scope shifts. Decomposition changes → update overall + re-run step 3 approval.

### §5 Review

Rule 1 passes before user review and writing-plans.
