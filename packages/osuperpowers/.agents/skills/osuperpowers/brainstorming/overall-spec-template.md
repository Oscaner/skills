# Overall Spec Template

**Document structure only** — what an overall (program-level) spec contains. Per-phase increment lives in [phase-spec-template.md](./phase-spec-template.md). Read both before drafting a multi-phase program.

---

## Language

Write in the user's language (headings, labels, status, blockquotes). Do not default to any fixed locale. Keep phase IDs, tags, SHAs, paths locale-neutral.

---

## Header

```
- **Version**: vX.Y · YYYY-MM-DD
- **Status**: Draft | Approved | In progress | Complete
- **Author**: [human] · [harness + model at writing time]
- **Constraints**: [project-level, one per line]
```

Minor version bump: decomposition, scope shift, phase complete. Major: program goal/constraint rewrite.

---

## Document scope

Charter only — no implementation detail.
- **Overall approval is not equivalent to any phase started** (GATE).
- Deviations update here first, then sync to overall.

---

## File paths

One program date + feature slug under `docs/superpowers/`:

| Artifact | Path |
|---|---|
| Overall | `specs/YYYY-MM-DD-<feature>-overall.md` |
| Phase spec | `specs/YYYY-MM-DD-<feature>-<phase-id>-design.md` |
| Phase plan | `plans/YYYY-MM-DD-<feature>-<phase-id>.md` |
| Phase tickets | `tickets/YYYY-MM-DD-<feature>-<phase-id>-tickets.md` |

`<phase-id>` lowercase (`p1`, `p2a`, ...). Inventory columns link here once files exist.

---

## Program charter

Goal (1-3 sentences), non-goals, cross-cutting constraints. **Exclude:** acceptance criteria, API shapes, component design, tasks.

---

## Issue inventory

Every known issue / discovered requirement, mapped to the phase that resolves it:

| Phase | Issue (ref) | Title summary |
|---|---|---|
| P1 | [#NNN](url) | one-line summary |
| P2 | none (dogfood session YYYY-MM-DD discovery) | one-line summary |

---

## Phase inventory

| # | Phase | Scope | Design spec | Implementation plan | Acceptance criteria | Dependency |
|---|---|---|---|---|---|---|
| P1 | [one-paragraph scope] | [Pending]/link | [Pending]/link | [verifiable completion condition] | [hard block or soft suggestion, ref graph] |

- Scope column: decomposition context only.
- **Split:** replace parent row with Na, Nb before sub-phase work continues.
- Cells: Pending → link; on ship, completion marker on **plan** cell only.
- **Acceptance criteria**: verifiable condition for the phase (not "done when code exists").
- **Dependency**: cite the graph node + whether hard (`->`) or soft (`-> (soft)`).

---

## Dependency graph (ASCII)

```
P1 -> P2        (hard block: P2 needs P1 rules)
P1 ->(soft) P5  (soft suggestion: P5 easier after P1 ships)
```

Legend:
- `->` = hard block (dependent must not start until predecessor ships)
- `-> (soft)` = suggestion only (non-blocking ordering convenience)

Sync with inventory on add/split/reorder.

---

## Boundary rules

> Each phase: full brainstorm -> plan -> dev. Shipped before dependents start.
> Requirement changes arising during a phase (new needs, new issues, new constraints discovered in the dev stage) MUST feed back to this overall spec before implementation proceeds — version bump + change-history entry + sync affected phase acceptance/dependency. Do not implement a mid-phase change whose feedback is not yet synced.

---

## Maintenance

- Update links + change history per phase; no task lists.
- Master spec for cross-phase conventions; phase specs incremental.
- Strategy shifts and splits feed back **immediately** (sync to overall). A mid-phase requirement change is a strategy shift — apply the same immediacy (see Boundary rules).

---

## Change history

Append-only: completion, decomposition, scope shift, status transition, mid-phase feedback.
