# Tickets: SDD slim orchestrator v2 (p1-slim.1)

Shrink `spor-subagent-driven-development/SKILL.md` to ≤160 lines via pointer-only Rule 0a/5b/5c. Parent plan: [../plans/2026-08-05-sdd-slim-orchestrator-v2.md](../plans/2026-08-05-sdd-slim-orchestrator-v2.md). Spec: [../specs/2026-08-05-sdd-slim-orchestrator-v2-design.md](../specs/2026-08-05-sdd-slim-orchestrator-v2-design.md).

Work the **frontier**: any ticket whose blockers are all done.

## T1 — spor-SDD pointer-only slim

**What to build:** Replace Rule 0a nested checklists with a 3-item pointer block; Rule 5b/5c pointer-only with guards; trim Rule 3; fix Rule 6 cross-ref and Rule 3 stale `Rule 5b step 1` ref; line count ≤160.

**Blocked by:** None — can start immediately.

**Plan tasks covered:** Task 1

**Demo:** `wc -l` ≤160; three `When Rule 0a applies, skip` guards; no `Override Step 5` in 5c.

- [ ] Rule 0a has exactly 3 numbered items (no nested Setup/Per-task/Final)
- [ ] Rule 5b/5c are pointer-only; guards on 3, 5b, 5c
- [ ] Rule 6 item 2 cites Rule 5a only
- [ ] `wc -l plugins/superpowers-overrides/skills/spor-subagent-driven-development/SKILL.md` ≤ 160
- [ ] Commit: `refactor: slim spor-SDD to pointer-only rules (p1-slim.1)`

## T2 — overall inventory + validate

**What to build:** Add p1-slim.1 row to overall spec Decomposition + charter; mark v2 spec §3 deviation synced; full validate green.

**Blocked by:** T1

**Plan tasks covered:** Task 2

**Demo:** `pnpm run validate` exit 0; overall table shows p1-slim.1.

- [ ] overall Decomposition + 交付物摘要 rows for p1-slim.1
- [ ] v2 spec §3 `Overall updated?` → Yes
- [ ] `CI=true pnpm run validate` exit 0
- [ ] Commit: `docs: add p1-slim.1 inventory row and mark overall sync`
