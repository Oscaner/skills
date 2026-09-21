# Phase Spec Template

Single-phase spec structure for `writing-phase-spec` (`read-template` → `author-spec`). **Increment only** — one phase's increment; the program-level charter lives in the [overall spec template](../../writing-overall-spec/docs/overall-spec-template.md). Whole-program conventions win on conflict.

> **GATE:** this phase spec is produced by a full **brainstorm -> plan -> dev** cycle. Jumping from overall approval straight into design is a violation of the overall flow.

## Header

Doc metadata — not an artifact section:

- **Class**: artifact-spec-template
- **Consumers**: `writing-phase-spec` (read-template · author-spec); every phase-spec artifact reproduces this skeleton
- **Skeleton**: `Header` + `Section 0–7` fixed order — `Section 0–5` artifact body (Incremental warning → Constraints pointer → Design body → Deviations → Notes for downstream → Review) + `Section 6–7` template tails
- **Canonical**: the parent overall (single source of truth); this document is its increment for one phase (§2.6 A5 single-root authority)
- **Experience**: baked from the P6 design spec §2.6 list, condensed in `docs/maintainers/program-experience.md` (repo-internal pointer, maintainer-side). Citations inline as `§2.6 <item>`

**Artifact header block** (metadata at the top of the produced spec — a bullet block, not a `##` section):

```
- **Version**, **Status** (Draft | Approved | Plan pending | Shipped)
- **Author**, **Parent program** (link + version), **Depends on** (upstream + tags)
```

---

## Section 0: Incremental warning

> Phase N increment only. Cross-phase conventions in the [overall](link); overall wins on conflict.

The spec commits to exactly one phase. Splitting or reordering a phase's work is not a local edit — the decomposition feeds back to the overall first (§2.6 A4 backfill-as-version): phase-inventory rows, dependency edges and a change-history row land in the overall before the next increment is written. Increment-only is what keeps many phase specs consistent with one overall instead of drifting into parallel programs (§2.6 A5).

## Section 1: Constraints pointer

> Does not repeat overall conventions. Overall wins on conflict.

A cross-phase assumption that appears here belongs in the overall. Reproducing a program-level rule in a phase spec creates a second copy that drifts; the reader of a program-level rule looks at the overall (§2.6 A5, E31). Reference the overall's section — do not re-state it.

## Section 2: Design body

This phase's increment: approaches, architecture, components, data flow, errors, testing, **Acceptance criteria**.

### Acceptance criteria

Verifiable completion conditions, each independently testable (§2.6 B18 test colocation — the check lives with what it verifies). Example shape:

- `artifact X exists at path Y with property Z`
- `command C exits 0 with output matching regex R`
- `no stale references to removed path P remain` (a residue guard — §2.6 A3: deleted things stay deleted)

An acceptance criterion is a claim: a claim that cannot be mechanically verified on the shipped tree is a paper claim. Specify the check, not the hope (§2.6 A6 mechanical guard beats verbal discipline · A7 shrink capability claims).

## Section 3: Deviations from overall

| Overall assumption | Phase decision | Overall updated? |
|---|---|---|
| ... | ... | Yes — vX.Y · YYYY-MM-DD |

Required when the phase diverges on a cross-phase matter. **`Overall updated?` must be `Yes` before review.** A divergence not fed back to the overall is a mid-phase change implemented without registration — exactly the backfill violation §2.6 A4 blocks.

## Section 4: Notes for downstream

Later-phase scope shifts. Decomposition changes → update the overall and re-run approval (GATE).

A "later phases will handle this" note that stays here alone is a dead end: downstream writers read the **overall**, not this spec (§2.6 E31 — registration is not the executing surface). Record the shift in the overall's issue / phase / dependency tables and history; keep the note as a pointer.

## Section 5: Review

Fresh-subagent review passes must all pass before user review and writing-plans.

- **Baseline = committed tree**: the review reads the tree as committed at dispatch entry — clean tree at entry, commits at exit (commit double-gate, §2.6 B12).
- **Convergence**: blocker > 0 → fix all findings → re-review; blocker = 0 → fix all findings (warn/nit included) → done, no re-review (Review Convergence rule, CLAUDE.md).

---

## Section 6: Naming & placeholders

Placeholder vocabulary per the D1.4 naming plane (`docs/maintainers/naming-conventions.md` — scoped semantic names, full words, one concept one name):

| Placeholder | Meaning |
|---|---|
| `<link>` | markdown link to the parent overall |
| `vX.Y` · `YYYY-MM-DD` | overall version + registration date of a deviation (Section 3) |
| `Phase N` → `P1` / `P2a` | the phase whose increment this is — write the actual id (`P1`, `P2a`), same spelling as the overall's Phase inventory; the all-lowercase `p1` / `p2a` form belongs to the filename plane only (overall §2 File paths) (§2.6 E34: doc word = registry row) |

Section numbering is part of the family skeleton (§2.6 E32 skeleton isomorphism): `Section 0–5` stays fixed — do not insert sections mid-sequence, each number is one semantic. `### Acceptance criteria` is the only subsection and it lives inside Section 2.

## Section 7: Change history

Template-level, append-only — do not reproduce in the artifact (the artifact is exactly `Header + Section 0–5`).

- 2026-09-18 — D-2 systematization: unified `Header + Section 0–5` family skeleton + `Section 6–7` template tails, clause-referencing style, §2.6 experience baking, placeholder vocabulary per D1.4.
