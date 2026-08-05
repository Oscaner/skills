# Tickets: SDD slim orchestrator (p1-slim)

Thin SDD orchestrator — Rule 0 CLI/p0 path branch, Rule 5 split, executing-plans router-only, implement.md commit contract. Parent plan: [../plans/2026-08-05-sdd-slim-orchestrator.md](../plans/2026-08-05-sdd-slim-orchestrator.md). Spec: [../specs/2026-08-05-sdd-slim-orchestrator-design.md](../specs/2026-08-05-sdd-slim-orchestrator-design.md).

Work the **frontier**: any ticket whose blockers are all done.

## T1 — SDD Rule 0 + Rule 3/5 split

**What to build:** CLI-default orchestrator sessions no longer load upstream SDD; new Rule 0a/0b path branch; Rule 3 guarded p0-only; Rule 5 split into 5a orchestrator gates, 5b p0 implementer dispatch, 5c p0 review chain; TASK_BASE in Rule 0a; cross-refs and Red Flags updated.

**Blocked by:** None — can start immediately.

**Plan tasks covered:** Task 1

- [ ] Rule 0 (0a/0b) present with inline Setup / Per-task / Final checklists in English
- [ ] Rule 3 and 5b/5c have `When Rule 0a applies, skip` guards
- [ ] `rg TASK_BASE` and `rg "When Rule 0a"` pass on spor-SDD skill
- [ ] All `Rule 5` cross-refs updated to 5a/5b/5c

## T2 — executing-plans router-only

**What to build:** `spor-executing-plans` retains redirect + worktree refusal + inline-only commit; Rules 3 and 5 deleted; frontmatter no longer claims tdd delegate.

**Blocked by:** T1 (redirect target must expose Rule 0)

**Plan tasks covered:** Task 2

- [ ] Only Rules 1, 2, 4 remain
- [ ] Rule 4 has redirect guard as first line
- [ ] No `mattpocock-skills:tdd` in executing-plans skill

## T3 — implement.md commit + controller-handoff SOT

**What to build:** CLI implement template includes base/head commit contract; controller-handoff H6 cites templates as worker discipline SOT.

**Blocked by:** T1 (TASK_BASE contract defined in Rule 0a)

**Plan tasks covered:** Task 3

- [ ] `implement.md` steps 5–7 include commit block with TASK_BASE / BLOCKED rules
- [ ] controller-handoff H6 table documents worker SOT
- [ ] `rg TASK_BASE` passes on implement template

## T4 — overall inventory + validate + smoke

**What to build:** overall spec inventory row for p1-slim; full `pnpm run validate` green; grep smokes; optional human dogfood results table appended to design spec § Smoke results.

**Blocked by:** T1, T2, T3

**Plan tasks covered:** Task 4

- [ ] overall Decomposition + 交付物摘要 rows added; version bumped
- [ ] `pnpm run validate` exit 0
- [ ] grep smokes pass (no tdd in executing-plans; Rule 0 exists)
- [ ] Smoke results table appended to design spec (human fill OK)
