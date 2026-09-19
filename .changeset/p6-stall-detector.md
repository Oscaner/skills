---
"@oscaner-skills/cdd-engine": minor
---

Dispatch-phase liveness monitor (spec E3): `spawnManaged` now samples the child process group's cumulative CPU and the newest workspace-file mtime while a dispatch is in flight, and kills + TIMEOUTs a group that shows neither signal for the idle window (default 15 min) — recovering from hung tool calls long before the overall budget. Adds the canonical `timeouts.liveness` config surface (`sampleIntervalMs` / `idleWindowMs`), a `stalled` flag on the spawn result, a stall-specific TIMEOUT blocker carrying the uncommitted-changes cleanup contract (discard or commit, then re-dispatch over a clean tree), and a fail-open guard (an unavailable signal never causes a kill). CPU growth is judged against the previous sample rather than the all-time group max, so an exited heavy tool call cannot leave a stale baseline that falsely stalls a busy group.

> **Semver note**: the new capability (liveness monitor + new config surface) is an additive feature, not a patch bugfix — released as a minor.
