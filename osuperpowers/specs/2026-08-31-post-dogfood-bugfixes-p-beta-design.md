# Pβ Skill Fixes Design Spec

- **Version**: v1.0
- **Status**: Approved
- **Author**: [human] · Claude Opus 4.8
- **Parent program**: [Post-Dogfood Bugfixes Overall](./2026-08-31-post-dogfood-bugfixes-overall.md) v1.7
- **Depends on**: Pα (engine-fixes, Done)

---

> **GATE:** This phase spec is produced by a **full brainstorm -> plan -> dev cycle**. Jumping straight to implementation after overall approval alone is a violation of the overall flow.

---

## Section 0: Incremental warning

Pβ increment only. Cross-phase conventions in [overall](./2026-08-31-post-dogfood-bugfixes-overall.md); overall wins on conflict.

---

## Section 1: Constraints pointer

Inherits overall constraints (§仓库语言政策 / §vendored 子模块不可改 / §不 commit 除非用户明确要求 / §changeset 逐 phase 建).

---

## Section 2: Design body

### Issue #198/#184: Task Heading H3 Constraint

**Problem:** `brief.mjs` (line 11) extracts tasks using `### Task N:` (H3). `writing-plans SKILL.md` doesn't enforce a heading level, leaving it to convention. If an agent generates H2, brief extraction silently fails at CDD dispatch time.

**Approach:** Add I5 invariant to writing-plans SKILL.md + add explicit constraint in write-plan Do field.

**Changes:**
- `writing-plans/SKILL.md`: New invariant I5: **Task Heading H3** — plan task headings MUST use H3 (`### Task N:`), matching brief.mjs extraction. H2 or any other level causes brief extraction failure.
- `writing-plans/SKILL.md`: write-plan Do field: add "Task headings must be H3 (`### Task N:`), matching brief.mjs extraction pattern."
- `writing-plans/SKILL.zh-CN.md`: mirror sync

---

### Issue #195/#196: Review Stopping Unification

**Problem:** Review Stopping rules are correct in text but agent skips re-run after blocker fixes. Root cause: rules are Do-field-inline text, not structural constraints (Invariant level). Also, `docs-review.md` lives in `brainstorming/docs/` but is shared with `writing-plans` — unclear document ownership.

**Approach (destructive refactor):**
1. Move `docs-review.md` (brainstorming-specific directory) to `_docs/` (shared cross-skill)
2. Both `brainstorming/spec-review` and `writing-plans/plan-review` reference `_docs/docs-review.md`
3. Review Stopping提升为 Invariant 级别约束（I5 in brainstorming, I4 in writing-plans）
4. Fail 字段明确引用 invariant 违反

**Changes:**
- `brainstorming/docs/docs-review.md` → `_docs/docs-review.md` (file move)
- `brainstorming/docs/docs-review.zh-CN.md` → `_docs/docs-review.zh-CN.md` (file move)
- `brainstorming/SKILL.md`: spec-review Do field references `_docs/docs-review.md`; Review Stopping → Invariant I5; Fail field references I5
- `brainstorming/SKILL.zh-CN.md`: mirror sync
- `writing-plans/SKILL.md`: plan-review Do field references `_docs/docs-review.md`; Review Stopping → Invariant I4; Fail field references I4
- `writing-plans/SKILL.zh-CN.md`: mirror sync

---

### Issue #194: report-issue Dedup Closed Issue Detection

**Problem:** dedup queries `--state open` only. Regression against closed issues silently creates duplicate.

**Approach (destructive refactor):**
1. dedup queries `--state all` with `state` field
2. resolve-hit differentiates open vs closed match
3. closed match → four options: Create new / Reopen+comment / Comment-only / Skip

**Changes:**
- `report-issue/SKILL.md`: dedup node (`--state all` + `state` field); resolve-hit node (open vs closed branches); new I4 invariant
- `report-issue/SKILL.zh-CN.md`: mirror sync

---

### Directory Restructuring

Move shared docs from skill-specific to cross-skill `_docs/`:

| File | From | To |
|------|------|----|
| `docs-review.md` | `brainstorming/docs/` | `_docs/` |
| `docs-review.zh-CN.md` | `brainstorming/docs/` | `_docs/` |

Remaining brainstorming-specific docs stay:
- `add-phase-protocol.md` → stays (brainstorming claim-phase/sync-overall only)
- `overall-spec-template.md` → stays (brainstorming write-spec only)
- `phase-spec-template.md` → stays (brainstorming write-spec only)

---

### Acceptance Criteria

- [ ] `brief.mjs` line 11 `### Task N:` matches writing-plans I5 constraint
- [ ] writing-plans SKILL.md has I5 (H3) invariant
- [ ] `_docs/docs-review.md` exists at new path
- [ ] brainstorming SKILL.md spec-review references `_docs/docs-review.md`
- [ ] writing-plans SKILL.md plan-review references `_docs/docs-review.md`
- [ ] Review Stopping is an Invariant (I5 brainstorming, I4 writing-plans)
- [ ] report-issue dedup queries `--state all`
- [ ] report-issue resolve-hit has closed-match branch
- [ ] All zh-CN mirrors updated
- [ ] `pnpm run validate` passes

---

## Section 3: Deviations from overall

None — Pβ follows overall scope exactly.

---

## Section 4: Notes for downstream

- Pγ (anti-patterns + brainstorming rewrite) depends on Pβ. Skill-authoring §10 and brainstorming anti-patterns are Pγ scope.
- Pδ (CDD refactoring) depends on Pγ. #210 commit-contract scope-aware and #211 engine contract are Pδ scope.

---

## Section 5: Review

Fresh-Subagent Review Passes: pending (after spec-review 3-pass).

---

## Change history

| Version | Date | Summary | Author |
|---|---|---|---|
| v1.0 | 2026-08-31 | Pβ design: #198 H3 + #195 Review Stopping + #194 dedup + directory restructure | [human] · Claude Opus 4.8 |
