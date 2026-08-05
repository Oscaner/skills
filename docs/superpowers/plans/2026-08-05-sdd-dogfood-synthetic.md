# SDD Dogfood Synthetic Plan (p1-slim.2)

> Manual E2E only — run in Cursor and Claude Code; fill §Smoke table in p1-slim.2 spec after pass.

**Goal:** Verify H6 four-mode chain + PreToolUse gate deny; workspace-only deliverables.

## Global Constraints

- Deliverables live only under `.superpowers/sdd/2026-08-05-sdd-dogfood-synthetic/`
- Each task requires `task-N-handoff.json` (`status: APPROVED`), `task-N-test-evidence.json`, `task-N-report.md`
- Ledger must not contain `inline review`
- Orchestrator must use H6 only for repo changes outside workspace

---

### Task 1: Write dogfood marker (task 1)

**Files:**
- Create: `.superpowers/sdd/2026-08-05-sdd-dogfood-synthetic/dogfood-marker.txt` (content: `task-1-done`)

**Steps:** H6 implement → handoff/implement → review → handoff/review. Commit if needed.

---

### Task 2: Append marker line (task 2)

**Files:**
- Modify: `.superpowers/sdd/2026-08-05-sdd-dogfood-synthetic/dogfood-marker.txt` (append `task-2-done`)

**Steps:** Same H6 chain as Task 1.

---

## Manual E2E checklist (AC#8)

- [ ] Cursor: full H6 × 2 tasks; hook denied ≥1 direct Write to `plugins/**`
- [ ] Claude Code: full H6 × 2 tasks; hook denied ≥1 Write or Bash
- [ ] Both: handoff APPROVED, test-evidence, report per task; ledger clean
