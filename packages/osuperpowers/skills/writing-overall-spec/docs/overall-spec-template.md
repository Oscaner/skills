# Overall Spec Template

Program-level spec structure for `writing-overall-spec` (`read-template` → `author-spec`). **Charter only** — no implementation detail. Per-phase increment lives in the [phase spec template](../../writing-phase-spec/docs/phase-spec-template.md); read both before drafting a multi-phase program.

> **GATE:** overall approval is not equivalent to any phase started.

## Header

Doc metadata — not an artifact section:

- **Class**: artifact-spec-template
- **Consumers**: `writing-overall-spec` (read-template · author-spec); the four-table mechanical guard `scripts/validate/overall-consistency.ts` reads artifacts built from this template (§2.6 A6)
- **Skeleton**: `Header` + `Section 0–11` fixed order — `Section 0–9` artifact body (Language → Document scope → File paths → Program charter → Issue inventory → Phase inventory → Dependency graph → Boundary rules → Maintenance → Change history) + `Section 10–11` template tails
- **Canonical**: single source of truth for the whole program — every mid-phase change returns here before implementation continues (§2.6 A5)
- **Experience**: baked from the P6 design spec §2.6 list, condensed in `docs/maintainers/program-experience.md` (repo-internal pointer, maintainer-side). Citations inline as `§2.6 <item>`

**Artifact header block** (metadata at the top of the artifact — a bullet block, not a `##` section):

```
- **Version**: vX.Y · YYYY-MM-DD
- **Status**: Draft | Approved | In progress | Complete
- **Author**: [human] · [harness + model at writing time]
- **Constraints**: [project-level, one per line]
```

Minor version bump: decomposition, scope shift, phase complete. Major: program goal / constraint rewrite. Every bump lands a change-history row (§2.6 A4 backfill-as-version): a change without a row did not happen.

> Each artifact section below is authored under its **literal heading** (validator-keyed); the `Section N` numbers here are the template's frame index only.

---

## Section 0: Language

Write in the user's language (headings, labels, status, blockquotes). Do not default to a fixed locale. Keep phase IDs, tags, SHAs and paths locale-neutral.

Content prose is free; the artifact's headings are the mechanical guard's vocabulary, not yours to rename (§2.6 E34 — doc word, code word and guard token must match; see Sections 4/5/9).

## Section 1: Document scope

Artifact heading: `## Document scope`

Charter only — no implementation detail.
- **Overall approval is not equivalent to any phase started** (GATE).
- Deviations update here first, then sync to overall (§2.6 A4 backfill-as-version — the overall is where a mid-phase change is recorded before implementation continues).

## Section 2: File paths

Artifact heading: `## File paths`

One program date + feature slug under `docs/osuperpowers/`:

| Artifact | Path |
|---|---|
| Overall | `specs/YYYY-MM-DD-<feature>-overall.md` |
| Phase spec | `specs/YYYY-MM-DD-<feature>-<phase-id>-design.md` |
| Phase plan | `plans/YYYY-MM-DD-<feature>-<phase-id>.md` |

`<phase-id>` lowercase (`p1`, `p2a`, ...). File naming groups by scope then date — the family layout principle (§2.6 D24: the slug, not history, decides the path). Inventory columns link here once files exist.

## Section 3: Program charter

Artifact heading: `## Program charter`

Goal (1–3 sentences), non-goals, cross-cutting constraints. **Exclude:** acceptance criteria, API shapes, component design, tasks.

Claims shrink, they do not inflate (§2.6 A7): what the program cannot prove it will not claim; what it defers is marked a non-goal, not left to happenstance.

## Section 4: Issue inventory

Artifact heading: `## Issue inventory` (validator-keyed — the guard counts rows under this literal heading)

Every known issue / discovered requirement, mapped to the phase that resolves it:

| Phase | Issue (ref) | Title summary |
|---|---|---|
| P1 | `#NNN` → link | one-line summary |
| P2 | none (dogfood session YYYY-MM-DD discovery) | one-line summary |

Referenced clause, not inlined prose: registration-domain semantics (new-discovery / pre-consume / re-assign triggers + anchored-syntax levels) live in [add-phase-protocol.md](./add-phase-protocol.md) — the four-table sync and the anchored `#NNN#issuecomment-<digits>` syntax are defined there once (§2.6 A4/A6). Renaming this heading silently unhooks the guard; the row count is a verified number, not prose (§2.6 E27).

## Section 5: Phase inventory

Artifact heading: `## Phase inventory` (canonical-form marker — the guard's "canonical file" test is the `Implementation plan` column)

| # | Phase | Scope | Design spec | Implementation plan | Acceptance criteria | Dependency |
|---|---|---|---|---|---|---|
| P1 | one-paragraph scope | [Pending]/link | [Pending]/link | verifiable completion condition | hard block or soft suggestion, ref graph |

- **Scope** column: decomposition context only.
- **Split:** replace the parent row with `Na`, `Nb` before sub-phase work continues (§2.6 A4).
- **Cells:** `Pending` -> link; on ship, completion marker on the **plan** cell only (the backfill-claim ↔ column bidirectional check, §2.6 A6).
- **Acceptance criteria**: verifiable condition for the phase — not "done when code exists" (§2.6 A6, A7).
- **Dependency**: cite the graph node + hard (`->`) or soft (`-> (soft)`).

## Section 6: Dependency graph

Artifact heading: `## Dependency graph` (a `(ASCII)` suffix is tolerated by the guard)

```
P1 -> P2        (hard block: P2 needs P1 rules)
P1 ->(soft) P5  (soft suggestion: P5 easier after P1 ships)
```

Legend:
- `->` = hard block (dependent must not start until predecessor ships)
- `-> (soft)` = suggestion only (non-blocking ordering convenience)

Sync with the inventory tables on add / split / reorder — the four tables move together (four-table sync, `add-phase-protocol.md` — Four-table sync checklist). Every `P<n>` token here must exist in the Phase inventory or the guard fails (§2.6 A6).

## Section 7: Boundary rules

Artifact heading: `## Boundary rules`

> Each phase: full brainstorm -> plan -> dev. Shipped before dependents start.
> Requirement changes arising during a phase (new needs, new issues, new constraints discovered in the dev stage) MUST feed back to this overall before implementation proceeds — version bump + change-history entry + sync affected phase acceptance/dependency. Do not implement a mid-phase change whose feedback is not yet synced.

The boundary rule is the backfill fast-path (§2.6 A4): the overall is the one authority that records, and the mechanical guard is what verifies (§2.6 A5, A6).

## Section 8: Maintenance

Artifact heading: `## Maintenance`

- Update links + change history per phase; no task lists — the phase spec carries the detail (Charter only).
- Master spec for cross-phase conventions; phase specs incremental (§2.6 A5).
- Strategy shifts and splits feed back **immediately** (sync to overall). A mid-phase requirement change is a strategy shift — apply the same immediacy (see Section 7).

## Section 9: Change history

Artifact heading: `## Change history` (validator-keyed — versions strictly ascending `v<major>.<minor>`, no duplicates)

Append-only: completion, decomposition, scope shift, status transition, mid-phase feedback. Every entry is a backfill record (§2.6 A4) — the row is the audit trail a reviewer reproduces. Version / date / row-count claims are verified numbers (§2.6 E27).

---

## Section 10: Naming & placeholders

Placeholder vocabulary per the D1.4 naming plane (`docs/maintainers/naming-conventions.md`):

| Placeholder | Meaning |
|---|---|
| `<feature>` | program feature slug — one word, lowercase |
| `<phase-id>` | `p1` / `p2a` — lowercase, matches the schema token shape |
| `#NNN` | issue number — spell the numeric literal, never `#` + prose |
| `vX.Y` · `YYYY-MM-DD` | version + date for the header / change-history rows |

The artifact headings are the guard's vocabulary (the four-table guard greps them literally) — rename a heading and rename the validator together (§2.6 E34: doc word = code word = guard token). `## Issue inventory` is canonical even where an older artifact says `Requirement inventory`; do not copy the drift into new artifacts.

## Section 11: Template change history

Template-level, append-only — do not reproduce in the artifact (the artifact keeps its own rows at Section 9).

- 2026-09-18 — D-2 systematization: unified `Header + Section 0–9` family skeleton + `Section 10–11` template tails; clause-referencing style (four-table sync + registration domain delegated to `add-phase-protocol.md`); §2.6 experience baking; placeholder vocabulary per D1.4.
