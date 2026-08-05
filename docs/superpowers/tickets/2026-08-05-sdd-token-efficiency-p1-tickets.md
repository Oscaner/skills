# Tickets: SDD Token 效率 — Phase p1 (CLI 物理清空)

Parent plan: [2026-08-05-sdd-token-efficiency-p1.md](../plans/2026-08-05-sdd-token-efficiency-p1.md) · Spec: [p1 design v1.2.1](../specs/2026-08-05-sdd-token-efficiency-p1-design.md)

**Hard gate:** Do not start T1 until **p0 release tag** exists.

Work the **frontier**: any ticket whose blockers are all done.

---

## T0 — Preflight p0 release gate

**What to build:** Confirm p0 release tag shipped, validate green, p0 skills (handoff-writer, Rule 5) present.

**Blocked by:** None — can start immediately (but impl stops if tag missing).

- [ ] p0 release tag exists
- [ ] `pnpm run validate` exit 0
- [ ] p0 artifacts verified

---

## T1 — sdd-common.sh + CLI templates

**What to build:** Shared bash lib + 4 prompt templates with placeholders and skill instruct text.

**Blocked by:** T0

- [ ] `bin/lib/sdd-common.sh` with env validation + exit 0/1/2
- [ ] `templates/sdd-cli/{implement,handoff,review,fix}.md`
- [ ] Committed

---

## T2 — H6–H8 + SDD Rule 7

**What to build:** Extend controller-handoff, SDD Rule 7, executing-plans cite for CLI path.

**Blocked by:** T0

- [ ] H6–H8 in controller-handoff skill
- [ ] Rule 7 + Red Flags in SDD
- [ ] executing-plans H6–H8 cite
- [ ] Committed

---

## T3 — Cursor harness (task + plan)

**What to build:** Full `sdd-run-task-cursor.sh` + `sdd-run-plan-cursor.sh` with 4-mode chain.

**Blocked by:** T1, T2

- [ ] Task script 4 modes + review-package
- [ ] Plan script pending loop + ledger append
- [ ] Committed

---

## T4 — Claude harness (task + plan)

**What to build:** Full claude scripts mirroring cursor.

**Blocked by:** T1, T2

- [ ] Task + plan scripts executable
- [ ] Committed

---

## T5 — Stub harness scripts

**What to build:** 6 stub scripts (codex/copilot/gemini × task/plan) exit 1 HARNESS_STUB.

**Blocked by:** T1

- [ ] All 6 stubs `-x`
- [ ] Committed

---

## T6 — Validate + docs

**What to build:** validate-overrides-build checks + README/cross-harness docs.

**Blocked by:** T3, T4, T5

- [ ] 10 scripts + common in validate script
- [ ] README harness table
- [ ] `pnpm run validate` green
- [ ] Committed

---

## T7 — Ship gate

**What to build:** Manual smoke, changeset, spec status update.

**Blocked by:** T6

- [ ] Smoke checklist documented
- [ ] changeset minor
- [ ] Committed

---

**Execution:** Subagent-Driven — after p0 release tag, say **「开始 p1」** from T0.
