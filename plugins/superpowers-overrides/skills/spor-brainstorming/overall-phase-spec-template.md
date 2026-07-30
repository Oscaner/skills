# Overall + Phase Spec Organization Template

Reference doc for `brainstorming` Rule 3. Read this when producing an overall or phase spec — do not re-implement these conventions from memory.

---

## Language

**Write every produced spec in the user's language** — headings, field labels, table headers, status text, blockquotes, and completion markers included. Match the language the user uses in conversation (or their explicit preference if they state one).

- Do **not** default to Chinese (or any fixed locale) because this template or prior examples used it.
- Structural placeholders below are shown in English for readability; **localize them** when drafting.
- Keep technical identifiers locale-neutral: phase IDs (`P0`, `P1`), git tags (`<slug>-complete`), SHAs, file paths, API names.

---

## Overall Spec — Required Structure

### 1. Version header

At the top of the file, before any section:

```
- **Version**: v1.0 · YYYY-MM-DD
- **Status**: [e.g. Overall approved; phase specs in progress]
- **Author**: [Name] · Claude Code (Opus 4.8)
- **Constraints**: [key project-level constraints, one per line]
```

Localize the field labels (`Version`, `Status`, etc.) and status prose to the user's language.

### 2. `## 0 · Document scope` section

Immediately after the version header. Localize the section title and bullets; must convey:

- This is the program charter — no implementation detail. Each phase has its own design spec + implementation plan.
- Before starting a new phase, confirm here: placement, upstream dependencies, and cross-cutting constraints are still current.
- Any decision that deviates from this document must update this document first before downstream specs/plans change.

### 3. Phase inventory table (4 columns)

```markdown
| # | Phase | Design spec | Implementation plan |
|---|---|---|---|
| P0 | [description] | [Pending] | [Pending] |
| P1 | [description] | [Pending] | [Pending] |
```

- Localize column headers and `[Pending]` to the user's language.
- On completion: append a localized completion marker to the plan cell, e.g. `✅ Complete (tag \`<slug>-complete\` @ <sha>)` — translate "Complete" if the spec is not in English.
- Do NOT add a separate Status column — completion is encoded in the plan cell

### 4. Dependency graph (ASCII)

```
P0 → P1 → P2a → P2b
              ↘ P2c
```

Phase IDs stay as shown; optional caption may be localized.

### 5. Explicit boundary rules section

Must include, verbatim or equivalent in the user's language:

> Each phase runs its own brainstorming → writing-plans → development cycle independently. Do not "while you're at it" start the next phase. Phase N's spec → plan → development must all be shipped (git tag) before Phase N+1 brainstorming begins.

### 6. Document maintenance rules section

Must include (localized):

- After each phase completes: update the inventory links; record deviations in change history; this document does not hold task checklists.
- This document is the master spec: cross-phase convention changes must land here before phase specs change.
- Phase specs are incremental only: do not repeat conventions already stated here; on conflict, this document wins.

### 7. Change history table

```markdown
| Date | Version | Change |
|---|---|---|
| YYYY-MM-DD | v1.0 | Initial version |
| YYYY-MM-DD | v1.1 | Pn complete (tag `xxx` @ sha) · deliverables summary |
```

- Localize column headers and row prose.
- One row per meaningful change (new phase completion, decomposition, scope shift)
- Completion row format: `Pn complete (tag \`xxx\` @ sha) · [deliverables: endpoints, tests, key decisions]` — localized as needed
- Append-only — never edit or delete rows

---

## Phase Spec — Required Structure

### 1. Version header

```
- **Version**: v1.0 · YYYY-MM-DD
- **Status**: [e.g. Design approved; plan pending]
- **Author**: [Name] · Claude Code (Opus 4.8)
- **Parent program**: [overall title and link, including overall version number]
- **Depends on**: Phase N (tag `<slug>-complete` @ <sha>)
```

Localize field labels and status prose.

### 2. Incremental warning

Immediately after the header (localized):

```
> ⚠️ This spec covers Phase N increment only. Cross-phase technical conventions live in the [overall master spec](link); on conflict, the overall spec wins.
```

### 3. Cross-cutting constraints

Do NOT duplicate constraints from the overall. Instead (localized):

> This spec does not repeat the overall's cross-cutting conventions. On conflict, the overall wins.

---

## Execution Rules

### Serial execution (core rule)

Phase N spec → plan → development must **all be shipped (git tag)** before Phase N+1 brainstorming begins.

Do not pre-draft Phase N+1's spec while Phase N is in development — shipped outcomes often change N+1's scope; early specs become stale or drive the wrong implementation.

### Dynamic in-place decomposition

When a phase's brainstorming reveals it is too large:

1. **Do NOT create a sub-overall.** One overall per program.
2. In the overall's phase table, split the row into Na, Nb, … with one-paragraph scope + dependencies each
3. Re-run user approval (Step 3) before drafting any sub-phase spec
4. Decomposition principle: each sub-phase introduces ≤1 new technology stack; each sub-phase is independently demo-able/verifiable
5. Record the decomposition as a change history entry (with reason)

### Completion signal

Create git tag (name: `<slug>-complete`); in the overall inventory's plan column add a localized completion marker, e.g. `✅ Complete (tag \`xxx\` @ sha)`; append a change-history row (tag + sha + full deliverables summary).
