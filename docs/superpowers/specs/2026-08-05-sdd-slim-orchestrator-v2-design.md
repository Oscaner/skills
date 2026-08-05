# SDD Token 效率 — Phase p1-slim.1：spor-SDD 文件瘦身

- **Version**: v1.0 · 2026-08-05
- **Status**: Approved (design review 2026-08-05)
- **Author**: oscaner · Cursor Agent
- **Program**: [overall v2.2](2026-08-05-sdd-token-efficiency-overall.md) (p1-slim.1 inventory row added at impl — see §3)
- **Phase ID**: p1-slim.1
- **Depends on**: [p1-slim](2026-08-05-sdd-slim-orchestrator-design.md) @ `64d8ea7`

## §0 Incremental warning

> Phase p1-slim.1 increment only. Fixes p1-slim on-disk bloat; does not change CLI/H6 behavior or templates.

## §1 Problem

p1-slim achieved **runtime** savings (CLI-default forbids loading upstream SDD ~500 lines) but **`spor-subagent-driven-development/SKILL.md` grew 156 → 232 lines (+76)** because:

1. Rule 0a **inlined** upstream Setup/Per-task/Final checklists (~25 lines).
2. Rule 5c **retained full** review-chain steps 2–8 (~35 lines) alongside `templates/sdd-cli/` SOT.
3. `When Rule 0a applies, skip` guards **do not reduce loaded context** — skipped text is still in the file.

## Goal

Reduce `spor-SDD/SKILL.md` to **≤160 lines** by replacing duplicated prose with **pointers (cite)**, while preserving p0 fallback behavior (Rule 0b still Read upstream SDD + invoke 5b/5c pointers).

## Constraints

- **Single file** primary change: `plugins/superpowers-overrides/skills/spor-subagent-driven-development/SKILL.md`
- **No** new skills; **no** `overrides.manifest.json` changes
- **No** changes to `templates/sdd-cli/`, `bin/`, or `spor-executing-plans`
- p0 fallback behavior unchanged at the semantic level

## Design

### Rule 0a — Replace inline checklist with pointers

**Final Rule 0a item list (after edit):**

| # | Action | Content |
|---|--------|---------|
| 1 | **keep** | Forbid Read/Skill upstream SDD skill body |
| 2 | **keep** | Allowed: upstream scripts only (`sdd-workspace`, `task-brief`, `review-package`) |
| 3 | **replace** | Merge old items 3+4+5 into one **Orchestrator duties (pointers only)** block + worker SOT (below) |
| — | **delete** | Old nested Setup / Per-task / Final checklists |
| — | **delete** | Old standalone item 5 (`Per-task review steps 2–8 do not run…`) — absorbed by Rule 5a |

**Replacement text for new item 3:**

```markdown
3. **Orchestrator + worker (pointers only):**
   - Orchestrator: Setup/ledger/plan-constraints via upstream scripts + Rule 7 + controller-handoff H6–H8; per-task Rule 1 → Rule 4 (once) → TASK_BASE in brief → H6 → Rule 5a → Rule 6; final whole-branch review orchestrator in-session (no CLI final)
   - Worker discipline SOT: `templates/sdd-cli/{implement,handoff,review,fix}.md` — do not paraphrase Rule 3/5b/5c
   - CLI worker review steps run in H6 subprocesses only — see Rule 5a (orchestrator does NOT dispatch handoff-writer/code-review in-session)
```

Items 1–2 and Rule 0b unchanged from p1-slim.

### Rule 5b — Pointer-only (p0 fallback)

**Replace** current implementer dispatch + commit paragraph with:

```markdown
#### Rule 5b — In-session implementer dispatch (p0 fallback only)

When Rule 0a applies, skip — `templates/sdd-cli/implement.md` is SOT.

p0 path: dispatch implementer per upstream SDD Task Loop §1 (`implementer-prompt.md`); filenames brief → report + test-evidence; commit/H1 per `implement.md`.
```

### Rule 5c — Pointer-only (p0 fallback)

**Remove** steps 2–8 full text and Degradation block.

**Replace** with:

```markdown
#### Rule 5c — In-session per-task review (p0 fallback only)

When Rule 0a applies, skip — H6 + `templates/sdd-cli/` is SOT.

p0 path: handoff-writer + code-review per `templates/sdd-cli/{handoff,review,fix}.md`, `spor-handoff-writer`, and controller-handoff H1–H5; degradation per controller-handoff H2 degradation note + handoff-writer skill.
```

### Rule 5a — Trim cross-reference

Keep 4 orchestrator gate bullets. **Keep** opening guard: `When Rule 0a applies, review-chain steps run inside H6 CLI subprocesses per templates/sdd-cli/ — orchestrator does NOT dispatch handoff-writer or code-review in-session.` Shorten only the redundant tail if any; do not remove the Rule 0a guard.

### Rule 3 — Trim (required if post-edit `wc -l` > 160)

Keep: p0-only label, Rule 0a skip guard, link to `mattpocock-skills:tdd`, one-line exemption (Markdown skill docs), load-failure one line.

Remove: numbered list items 1–3 (tdd skill body is SOT when invoked).

### Rule 6 — Patch cross-ref

Change item 2 from `Rule 5a / Rule 5c step 7` to `Rule 5a` only (plan_conflicts STOP before fix loop).

### Unchanged

Rules 1, 2, 4, 7; Red Flags; Common Rationalizations (p1-slim additions retained). Rule 6 except item 2 cross-ref (see above).

## Line budget

| Section | Current (approx) | After (approx) | Δ |
|---------|------------------|----------------|---------|
| Rule 0a inline | ~30 | ~6 | −24 |
| Rule 5b | ~12 | ~4 | −8 |
| Rule 5c | ~35 | ~5 | −30 |
| Rule 3 trim | ~12 | ~6 | −6 |
| Rule 6 one line | — | — | −0 |
| **Total** | **232** | **~158** | **−74** |

Hard cap: **≤160 lines** (`wc -l`). If post-edit > 160, additionally condense Rule 4 CLI-default note to one line before failing AC.

## Acceptance criteria

1. `wc -l plugins/superpowers-overrides/skills/spor-subagent-driven-development/SKILL.md` ≤ 160
2. No nested Setup/Per-task/Final checklist under Rule 0a (pointer block only)
3. Rule 5c contains **no** code-review Step 5 override enumeration
4. Guards present: `When Rule 0a applies, skip` on Rules 3, 5b, 5c
5. `pnpm run validate` exit 0
6. Grep: no duplicate `mattpocock-skills:code-review` dispatch prose block (single cite in 5c pointer)
7. Rule 0a has **exactly 3 numbered items**; no nested Setup/Per-task/Final checklist; no duplicate worker-discipline bullet

## §3 Deviations from overall

| Overall assumption | Phase decision | Overall updated? |
|---|---|---|
| p1-slim complete @ 232 lines | p1-slim.1 shaves to ≤160 | **Yes** — overall inventory row added |

## Non-goals

- Lazy-load p0 to separate skill (deferred — would need manifest)
- Runtime token measurement
- Changing p1-slim spec retroactively (this phase supersedes on-disk requirements)

## Grilling record

| # | Decision | Choice |
|---|----------|--------|
| 1 | Success metric | A — ≤160 lines, no new skill |
| 2 | Rule 0 | A — pointer-only |
| 3 | Rule 5b/5c | A — pointer-only; p0 relies on upstream + templates |

User design approval: 2026-08-05.
