# Tickets: SDD Token 效率 — Phase p0 (Handoff + Lean Review)

Parent plan: [2026-08-05-sdd-token-efficiency-p0.md](../plans/2026-08-05-sdd-token-efficiency-p0.md) · Spec: [p0 design v1.3.1](../specs/2026-08-05-sdd-token-efficiency-p0-design.md)

Work the **frontier**: any ticket whose blockers are all done.

---

## T0 — Preflight baseline green

**What to build:** Confirm penf shipped, `pnpm run validate` green, capture pre-p0 SDD Rule 1 baseline before any skill edits.

**Blocked by:** None — can start immediately.

- [ ] `pnpm run validate` exit 0
- [ ] overrides version ≥ `6.2.0-overrides.12`; cursor hooks present
- [ ] multi-pass reviewer table still in SDD Rule 1 (baseline snapshot)

---

## T1 — spor-token-efficient-controller-handoff

**What to build:** New cross-cutting skill with H1–H5 orchestrator file-only handoff discipline (4-line contract, handoff.json allowlist, ledger-only memory, fix loop cap, handoff-writer cite).

**Blocked by:** T0

- [ ] `skills/spor-token-efficient-controller-handoff/SKILL.md` exists with H1–H5 + Red Flags
- [ ] H1 canonical 4-line format documented
- [ ] Committed `feat: add spor-token-efficient-controller-handoff cross-cutting skill (p0 H1–H5)`

---

## T2 — spor-handoff-writer + template

**What to build:** Independent handoff-writer skill + `templates/sdd-handoff-writer-prompt.md` — schema, lifecycle, test gate, D3 output.

**Blocked by:** T0

- [ ] `skills/spor-handoff-writer/SKILL.md` with single + batch schema examples
- [ ] Dispatch template with phase/path placeholders
- [ ] Committed `feat: add spor-handoff-writer skill and dispatch template (p0)`

---

## T3 — Review-dispatch D4

**What to build:** Add D4 code-review dual-axis gate to `spor-token-efficient-review-dispatch` (parallel axes, mandatory writer, D3 JSON appendix).

**Blocked by:** T0

- [ ] D4 section + Red Flags in review-dispatch SKILL.md
- [ ] Committed `feat: add D4 code-review dual-axis gate to review-dispatch (p0)`

---

## T4 — SDD Rule 1/2/5/6 rewrite

**What to build:** Replace multi-pass per-task reviewers with code-review + handoff-writer chain; adaptive diff batching; Rule 6 invariants; degradation path.

**Blocked by:** T1, T2, T3

- [ ] Rule 1: no 6-pass table; batching per spec §2.3
- [ ] Rule 5: full per-task sequence + §2.2 paths + Step 5 override + degradation
- [ ] Rule 6: test gate, plan_conflicts, unverifiable, NEEDS_CONTEXT→STOP
- [ ] Committed `feat: replace SDD per-task review with code-review + handoff-writer (p0)`

---

## T5 — executing-plans Rule 5

**What to build:** After SDD redirect, cite controller-handoff H1–H5 in executing-plans override.

**Blocked by:** T1, T4

- [ ] Rule 5 added to `spor-executing-plans/SKILL.md`
- [ ] Committed `feat: cite controller-handoff in executing-plans Rule 5 (p0)`

---

## T6 — Plugin README (EN + zh-CN)

**What to build:** Cross-cutting table rows for new skills in plugin README EN and zh-CN.

**Blocked by:** T4

- [ ] Both README files list controller-handoff + handoff-writer; D4 noted on review-dispatch row
- [ ] Committed `docs: document p0 handoff cross-cutting skills in plugin README (EN + zh-CN)`

---

## T7 — Validate + changeset + ship gate

**What to build:** Full validate green, changeset, spec AC walk, p0 ship-ready.

**Blocked by:** T4, T5, T6

- [ ] `pnpm run validate` exit 0
- [ ] Both new skill dirs resolve with SKILL.md
- [ ] Spec AC checklist complete (§4 metrics defer noted)
- [ ] `pnpm changeset` for superpowers-overrides
- [ ] Committed `chore: p0 ship gate changeset`

---

**Execution mode:** Subagent-Driven (`superpowers:subagent-driven-development`) — say **「开始 p0」** to start T0.
