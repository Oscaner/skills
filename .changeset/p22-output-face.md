---
"@oscaner-skills/cdd-engine": minor
---

**The output face closes: a two-key capsule and a trailing `next:` (P22 §10).** A round's capsule line is now `status: <status> · handoff: <handoff>` — the `blocker` cell is gone. Its whole information content was the blocker count, and the count is already decided by the status above it (any blocker ⇒ `CHANGES_REQUESTED`, warn/nit-only ⇒ `REVIEW_FIX`, none ⇒ `APPROVED`), so the cell made every consumer read a number it could derive. The failure face (`BLOCKED` / `TIMEOUT`) is byte-identical to before: it never printed that cell, and its `handoff` cell still appears only when the round wrote a crash record.

The fix round's disposition line moved too. `fixed N · rejected M` used to print after the capsule's `next:` suggestion; it now prints between the status line and `next:` — the consumer's output ends on the one line it executes.

```
status: APPROVED · handoff: .kairos/cdd/p3/tasks-1-fix-1.json
fixed 1 · rejected 1
next: review --type wave --tasks 1 --plan docs/kairos/plans/p3.md
```

Nothing else changed: the `next:` literal, the failure stderr channel, the round records and the disposition accounting are untouched. The blocker count still drives convergence in `NextStepRouter.next` — only its rendering was retired.
