# Overall + Phase Spec Organization Template

Reference doc for `brainstorming` Rule 3. Read this when producing an overall or phase spec — do not re-implement these conventions from memory.

---

## Language

**Write every produced spec in the user's language** — headings, field labels, table headers, status text, blockquotes, and completion markers included. Match the language the user uses in conversation (or their explicit preference if they state one).

- Do **not** default to Chinese (or any fixed locale) because this template or prior examples used it.
- Structural placeholders below are shown in English for readability; **localize them** when drafting.
- Keep technical identifiers locale-neutral: phase IDs (`P0`, `P1`), git tags (`<slug>-complete`), SHAs, file paths, API names.

---

## File paths and naming

All artifacts live under `docs/superpowers/`, sibling to existing single-phase conventions. Use one **program date** + **feature slug** across the whole program (same rule as `docs/superpowers/specs/`, `plans/`, `tickets/` in CLAUDE.md).

| Artifact | Path pattern | Example |
|---|---|---|
| Overall spec | `docs/superpowers/specs/YYYY-MM-DD-<feature>-overall.md` | `…/2026-07-31-auth-overall.md` |
| Phase N design spec | `docs/superpowers/specs/YYYY-MM-DD-<feature>-<phase-id>-design.md` | `…/2026-07-31-auth-p0-design.md` |
| Phase N implementation plan | `docs/superpowers/plans/YYYY-MM-DD-<feature>-<phase-id>.md` | `…/2026-07-31-auth-p0.md` |
| Phase N tickets (if published) | `docs/superpowers/tickets/YYYY-MM-DD-<feature>-<phase-id>-tickets.md` | `…/2026-07-31-auth-p0-tickets.md` |

- `<phase-id>` is lowercase phase label from the inventory table (`p0`, `p1`, `p2a`, …).
- User preference for spec location overrides these defaults (same as upstream brainstorming).
- The overall inventory table **Design spec** and **Implementation plan** columns link to these paths once files exist.

---

## Overall Spec — Required Structure

### 1. Version header

At the top of the file, before any section:

```
- **Version**: v1.0 · YYYY-MM-DD
- **Status**: [see Status lifecycle below]
- **Author**: [human name or team] · [harness and model at time of writing]
- **Constraints**: [key project-level constraints, one per line]
```

Localize the field labels (`Version`, `Status`, etc.) and status prose to the user's language. For **Author**, record who you are collaborating with and the harness + model actually in use (e.g. Cursor + model name) — never hardcode a product or model version.

**Status lifecycle (overall):**

| Status | Meaning |
|---|---|
| Draft | Written, not yet user-approved |
| Approved | User approved decomposition; phase specs may start |
| In progress | At least one phase spec/plan/dev started; not all phases shipped |
| Complete | Every phase in the inventory is shipped |

Update header **Status** on each transition; append a change-history row (status-only transitions count).

**Version bumps:** increment minor version (`v1.0` → `v1.1`) on decomposition, scope shift, or phase completion; increment major (`v1.x` → `v2.0`) only on program-level goal or constraint rewrite. Pure typo fixes do not bump version.

### 2. `## 0 · Document scope` section

Immediately after the version header. Localize the section title and bullets; must convey:

- This is the program charter — no implementation detail. Each phase has its own design spec + implementation plan.
- **Overall brainstorming does not substitute for phase brainstorming.** The inventory paragraph for a phase is decomposition context only — each phase still runs the full discovery → grilling → approaches → design approval → spec → review cycle on its own.
- Before starting a new phase, confirm here: placement, upstream dependencies, and cross-cutting constraints are still current.
- Any decision that deviates from this document must update this document first before downstream specs/plans change.

### 3. Program charter content (scope-only)

After section 0, before the inventory table. **Include** (localized):

- **Program goal** — 1–3 sentences: what the whole program delivers and why.
- **Non-goals** — explicit out-of-scope items for the full program.
- **Cross-cutting constraints** — tech stack limits, compatibility, security, i18n, performance floors, etc. (the header `Constraints` field summarizes; this section expands).

**Do NOT include** in the overall: per-feature acceptance criteria, API shapes, component-level design, or task lists. Those belong in phase specs.

### 4. Phase inventory table (4 columns)

```markdown
| # | Phase | Design spec | Implementation plan |
|---|---|---|---|
| P0 | [one-paragraph scope] | [Pending] | [Pending] |
| P1 | [one-paragraph scope] | [Pending] | [Pending] |
```

- **Phase column**: one paragraph max — enough to approve decomposition, not a mini design spec.
- Localize column headers and `[Pending]` to the user's language.
- **When spec is written**: replace `[Pending]` with a markdown link to the phase design spec path.
- **When plan is written**: replace plan `[Pending]` with a link to the plan path.
- **When phase is shipped**: keep both links; append a localized completion marker to the **plan** cell only, e.g. `✅ Complete (tag \`<slug>-complete\` @ <sha>)`.
- Do NOT add a separate Status column — completion is encoded in the plan cell.

### 5. Dependency graph (ASCII)

```
P0 → P1 → P2a → P2b
              ↘ P2c
```

Phase IDs stay as shown; optional caption may be localized. **Keep in sync** with the inventory table whenever phases are added, split, or reordered.

### 6. Explicit boundary rules section

Must include, verbatim or equivalent in the user's language:

> Each phase runs its own **full** brainstorming → writing-plans → development cycle independently — not a shortened pass derived from the overall. Do not "while you're at it" start the next phase. A phase's spec → plan → development must all be shipped before brainstorming begins for any phase that depends on it.

### 7. Document maintenance rules section

Must include (localized):

- After each phase completes: update the inventory links; record deviations in change history; this document does not hold task checklists.
- This document is the master spec: cross-phase convention changes must land here before phase specs change.
- Phase specs are incremental only: do not repeat conventions already stated here; on conflict, this document wins.

### 8. Change history table

```markdown
| Date | Version | Change |
|---|---|---|
| YYYY-MM-DD | v1.0 | Initial version |
| YYYY-MM-DD | v1.1 | Pn complete (tag `xxx` @ sha) · deliverables summary |
```

- Localize column headers and row prose.
- One row per meaningful change (new phase completion, decomposition, scope shift, status transition)
- Completion row format: `Pn complete (tag \`xxx\` @ sha) · [deliverables: endpoints, tests, key decisions]` — localized as needed
- Append-only — never edit or delete rows

---

## Phase Spec — Required Structure

### 1. Version header

```
- **Version**: v1.0 · YYYY-MM-DD
- **Status**: [see Status lifecycle below]
- **Author**: [human name or team] · [harness and model at time of writing]
- **Parent program**: [overall title and link, including overall version number]
- **Depends on**: [upstream phase IDs and completion refs, e.g. P0 (tag `auth-p0-complete` @ abc1234)]
```

Localize field labels and status prose. For **Author**, use the human partner and the harness + model actually in use — do not hardcode a product or model version.

**Status lifecycle (phase spec):**

| Status | Meaning |
|---|---|
| Draft | Written, not yet user-approved |
| Approved | User approved design; writing-plans may start |
| Plan pending | Approved but plan not yet written |
| Shipped | Plan executed and phase completion signal recorded in overall |

### 2. Incremental warning

Immediately after the header (localized):

```
> ⚠️ This spec covers Phase N increment only. Cross-phase technical conventions live in the [overall master spec](link); on conflict, the overall spec wins.
```

### 3. Cross-cutting constraints

Do NOT duplicate constraints from the overall. Instead (localized):

> This spec does not repeat the overall's cross-cutting conventions. On conflict, the overall wins.

### 4. Design body (upstream brainstorming — full cycle required)

Each phase brainstorming is a **fresh, independent run** of the upstream `brainstorming` checklist for that phase's increment only. The overall spec is **input context**, not a substitute for discovery.

**Before drafting sections 1–3 and the design body, complete for this phase:**

1. **Explore project context** — including shipped upstream phases, current codebase state, and the overall's constraints (re-read; do not rely on memory from overall drafting).
2. **`grilling`** — invoke `mattpocock-skills:grilling` for phase-scoped clarifying questions. Do not skip because the overall interview already happened.
3. **Propose 2–3 approaches** — trade-offs for *this phase's* increment.
4. **Present design** — get user approval section-by-section before writing the spec file.

**Then** write sections 1–3 (header, warning, cross-cutting pointer) and the design body (approaches chosen, architecture, components, data flow, error handling, testing) — **limited to this phase's increment only**.

- Do **not** expand the overall inventory paragraph into a phase spec and call it done.
- Do **not** reuse overall-level approach trade-offs without re-evaluating them for this phase's shipped context.
- Scale sections to complexity; include acceptance criteria and success criteria here (not in the overall).
- Do not design scope belonging to later phases; if discovered, record under **Notes for downstream phases** (section 5) and update the overall if decomposition must change.

### 5. Notes for downstream phases (optional)

When this phase's brainstorming reveals scope shifts, constraints, or open questions for a later phase, capture them here immediately — do not rely on session memory. If the shift changes decomposition, update the overall inventory + change history and re-run user approval (Rule 3 step 3) before drafting the affected phase spec.

### 6. Review

Run `spor-brainstorming` Rule 1 review passes on every phase spec (same as the overall) before user review and before invoking writing-plans.

---

## Execution Rules

### Independent phase brainstorming (core rule)

When a phase's turn arrives, start a **new brainstorming session** for that phase alone:

| Step | Requirement |
|---|---|
| Context | Re-read overall + inspect shipped upstream deliverables; do not assume overall drafting memory |
| Discovery | Full `grilling` interview scoped to this phase — mandatory even if overall covered related topics |
| Approaches | Fresh 2–3 options for this phase; upstream phases may change which option is viable |
| Design approval | Present phase design; get explicit user approval before writing the phase spec |
| Spec + review | Write phase spec → Rule 1 review passes → user review gate → writing-plans |

**Forbidden shortcuts:** copying the inventory paragraph into the spec; skipping grilling ("already discussed in overall"); drafting multiple phase specs in one pass; inferring phase design approval from overall approval.

### Serial execution and parallel phases

**Default (serial):** Phase N spec → plan → development must **all be shipped** before brainstorming begins for any phase that lists N as a dependency.

**Parallel branches:** Phases with the **same upstream dependency** and **no dependency on each other** may run brainstorming → plan → dev **in parallel** (e.g. P2a and P2c both after P1 is shipped). The dependency graph is the source of truth — if two phases are not connected by an arrow, they may proceed concurrently once shared upstream phases are shipped.

Do not pre-draft a phase's spec while an upstream dependency is still in development — shipped outcomes often change downstream scope.

### Dynamic in-place decomposition

When a phase's brainstorming reveals it is too large:

1. **Do NOT create a sub-overall.** One overall per program.
2. In the overall's phase table, split the row into Na, Nb, … with one-paragraph scope + dependencies each
3. Update the dependency graph to match
4. Re-run user approval (Rule 3 step 3) before drafting any sub-phase spec
5. Decomposition principle: each sub-phase introduces ≤1 new technology stack; each sub-phase is independently demo-able/verifiable
6. Record the decomposition as a change history entry (with reason)

### Completion signal

**Preferred:** create git tag (name: `<slug>-complete`, e.g. `auth-p0-complete`).

**If the project forbids tags:** use an equivalent immutable reference (release commit SHA, signed milestone issue, or tagged release URL) and record it in the change history.

Then: in the overall inventory's **plan** column, append a localized completion marker, e.g. `✅ Complete (tag \`xxx\` @ sha)`; append a change-history row (ref + sha + full deliverables summary); bump overall header version if applicable.
