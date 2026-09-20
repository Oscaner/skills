---
"@oscaner-skills/cdd-engine": patch
---

Changed-surface reconcile wiring + residue annotation fixes (P6 T25 fix round, review-1 findings): the inherited `writeBoundary` step now sees the task face's canonical handoff path (buildCtx-derived `ctx.handoffPath` synced into the lifecycle ctx), so an implement round's materialized carrier actually carries the `changed-surface ledger origin` notes record — the reconcile previously read an empty path and the record never landed. The docs no-handoff BLOCKED carrier omits `recovery.exit_code` when the agent exited 0 (exit_code stays a strict death code: 1 = run failure, 143 = SIGTERM). Residue stash announcements append the round marker for round-slot-less implement carriers (`cdd residue: <cause> <basename> r1`; round-bearing names already encode it, so they stay unmodified).
