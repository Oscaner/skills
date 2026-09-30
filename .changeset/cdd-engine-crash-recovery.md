---
"@oscaner-skills/cdd-engine": patch
---

feat: crash recovery robustness — HARNESS_ABORT failure category, crash-only snapshots, crash records, and the stash plane deleted.

- **HARNESS_ABORT** joins `engine-config.json#failureCategories` (`harnessAbortCount` / `harness-abort` / `BLOCKED: harness-abort-exhausted`, per-category independent convergence quota) — the deterministic-recovery classification for harness/model 403-style child aborts, resolved mechanically by the FailureResolver.
- **Crash teardown (lane-agnostic)** — a child that exits non-zero without writing its handoff now: ① preserves the child stdout/stderr tails (~40 lines), ② commits a crash-only snapshot (`git add -A && git commit --no-verify`, no-op on a clean tree), ③ writes a crash record to `Workspace.crashPath(lane, round)` (`{exitCode, stderrTail[], stdoutTail[], snapshotSha, attemptedHandoff, next}`), and ④ emits the BLOCKED capsule with the same-command resume `next:`. A repeated abort on the resumed round re-fires the teardown (stale engine-terminal carriers rotate before re-dispatch) instead of being suppressed.
- **`failure_category` schema enum pinned** to the canonical category set in both handoff schemas — a BLOCKED carrier with `HARNESS_ABORT` now passes its own machine contract.
- **Stash plane deleted** — `stashPush/stashApply/stashMessage`, the `recovery` handoff carrier, the settleResidue stash template step, and the residue stash vocabulary are gone; recovery primitives normalize onto the commit ledger and the crash record (zero program branch memory).
- **Ghost parameter removed** — the dead `resumeScopeBase` finalize anchor (its recovery-carrier feeder went with the stash plane) is deleted per the dead-shell-gets-deleted rule.
