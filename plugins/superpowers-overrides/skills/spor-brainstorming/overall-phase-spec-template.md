# Overall + Phase Spec Organization Template

Reference doc for `brainstorming` Rule 3 **document structure** (what produced specs contain). Process discipline — independent phase cycles, feed-back to overall, serial/parallel execution, decomposition, completion — lives in `SKILL.md` Rule 3 and sub-rules 3a–3e. Read both; do not re-implement from memory.

---

## Language

**Write every produced spec in the user's language** — headings, field labels, table headers, status text, blockquotes, and completion markers included. Match the language the user uses in conversation (or their explicit preference if they state one).

- Do **not** default to Chinese (or any fixed locale) because this template or prior examples used it.
- Structural placeholders below are shown in English for readability; **localize them** when drafting.
- Keep technical identifiers locale-neutral: phase IDs (`P0`, `P1`), git tags (`<slug>-complete`), SHAs, file paths, API names.

---

## File paths and naming

All artifacts live under `docs/superpowers/`. Use one **program date** + **feature slug** across the whole program.

| Artifact | Path pattern | Example |
|---|---|---|
| Overall spec | `docs/superpowers/specs/YYYY-MM-DD-<feature>-overall.md` | `…/2026-07-31-auth-overall.md` |
| Phase N design spec | `docs/superpowers/specs/YYYY-MM-DD-<feature>-<phase-id>-design.md` | `…/2026-07-31-auth-p0-design.md` |
| Phase N implementation plan | `docs/superpowers/plans/YYYY-MM-DD-<feature>-<phase-id>.md` | `…/2026-07-31-auth-p0.md` |
| Phase N tickets (if published) | `docs/superpowers/tickets/YYYY-MM-DD-<feature>-<phase-id>-tickets.md` | `…/2026-07-31-auth-p0-tickets.md` |

- `<phase-id>` is lowercase (`p0`, `p1`, `p2a`, …). User preference for spec location overrides these defaults.
- Inventory **Design spec** / **Implementation plan** columns link to these paths once files exist.

---

## Overall Spec — Required Structure

### 1. Version header

```
- **Version**: v1.0 · YYYY-MM-DD
- **Status**: [see Status lifecycle below]
- **Author**: [human name or team] · [harness and model at time of writing]
- **Constraints**: [key project-level constraints, one per line]
```

Localize field labels and status prose. **Author**: human partner + harness/model in use — never hardcode a product or model version.

**Status lifecycle (overall):** Draft → Approved → In progress → Complete (update header on each transition; append change-history row).

**Version bumps:** minor on decomposition, scope shift, or phase completion; major only on program-level goal or constraint rewrite.

### 2. `## 0 · Document scope` section

Must convey (localized):

- Program charter — no implementation detail; each phase has its own design spec + plan.
- **Overall approval ≠ phase brainstorming started.** Inventory paragraphs are decomposition context; each phase begins its own discovery cycle only after the user explicitly starts that phase (SKILL Rule 3 step 4 gate).
- Before a new phase: confirm placement, upstream dependencies, and cross-cutting constraints are still current.
- Deviations from this document update here first (see SKILL Rule 3b).

### 3. Program charter content (scope-only)

- **Program goal** — 1–3 sentences.
- **Non-goals** — explicit out-of-scope for the full program.
- **Cross-cutting constraints** — tech stack, compatibility, security, i18n, etc. (header `Constraints` summarizes; this section expands).

**Do NOT include:** per-feature acceptance criteria, API shapes, component design, or task lists.

### 4. Phase inventory table (4 columns)

```markdown
| # | Phase | Design spec | Implementation plan |
|---|---|---|---|
| P0 | [one-paragraph scope] | [Pending] | [Pending] |
| P1 | [one-paragraph scope] | [Pending] | [Pending] |
```

- **Phase column**: one paragraph max — decomposition context, not a design spec.
- Spec/plan cells: `[Pending]` → markdown link when written; on ship, append completion marker to **plan** cell only (e.g. `✅ Complete (tag \`<slug>-complete\` @ <sha>)`).
- No separate Status column.

### 5. Dependency graph (ASCII)

Keep in sync with the inventory table when phases are added, split, or reordered.

### 6. Boundary rules (blockquote in produced doc)

> Each phase runs its own full brainstorming → writing-plans → development cycle. A phase must be shipped before brainstorming begins for any phase that depends on it.

### 7. Document maintenance rules

- After each phase: update inventory links; record deviations in change history; no task checklists here.
- Master spec for cross-phase conventions; phase specs are incremental; on conflict, this document wins.
- Phase-driven strategy changes feed back here before the phase spec is finalized (SKILL Rule 3b).

### 8. Change history table

Append-only. One row per meaningful change (completion, decomposition, scope shift, status transition).

---

## Phase Spec — Required Structure

### 1. Version header

```
- **Version**: v1.0 · YYYY-MM-DD
- **Status**: [Draft | Approved | Plan pending | Shipped]
- **Author**: [human name or team] · [harness and model at time of writing]
- **Parent program**: [overall title and link, including overall version]
- **Depends on**: [upstream phase IDs and completion refs]
```

### 2. Incremental warning

> ⚠️ This spec covers Phase N increment only. Cross-phase conventions live in the [overall master spec](link); on conflict, the overall wins.

### 3. Cross-cutting constraints pointer

> This spec does not repeat the overall's cross-cutting conventions. On conflict, the overall wins.

### 4. Design body

Phase-scoped design for **this increment only** — approaches chosen, architecture, components, data flow, error handling, testing, acceptance criteria. Follow upstream `brainstorming` content shape; follow SKILL Rule 3a for the discovery cycle before writing.

### 5. Deviations from overall (when applicable)

```markdown
## Deviations from overall

| Overall assumption | Phase decision | Overall updated? |
|---|---|---|
| [what overall said] | [what this phase chose and why] | Yes — v1.x · YYYY-MM-DD |
```

Required when phase decisions diverge from the overall on cross-phase matters. If **Overall updated?** is not Yes, finalize the overall first (SKILL Rule 3b).

### 6. Notes for downstream phases (optional)

Scope shifts, constraints, or open questions for later phases. If decomposition or overall-level strategy changes, update overall + re-run decomposition approval (SKILL Rule 3 step 3).

### 7. Review

Rule 1 review passes before user review and writing-plans (SKILL Rule 3 step 2).
