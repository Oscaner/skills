---
"@oscaner-skills/cdd-engine": minor
---

Dispatch-phase liveness monitor (spec E3): `spawnManaged` now samples the child process group's cumulative CPU and the newest workspace-file mtime while a dispatch is in flight, and kills + TIMEOUTs a group that shows neither signal for the idle window (default 15 min) — recovering from hung tool calls long before the overall budget. Adds the canonical `timeouts.liveness` config surface (`sampleIntervalMs` / `idleWindowMs`), a `stalled` flag on the spawn result, a stall-specific TIMEOUT blocker carrying the uncommitted-changes cleanup contract (discard or commit, then re-dispatch over a clean tree), and a fail-open guard (an unavailable signal never causes a kill). CPU growth is judged against the previous sample rather than the all-time group max, so an exited heavy tool call cannot leave a stale baseline that falsely stalls a busy group.

> **semver 说明**：新增能力（liveness monitor + 新 config 面）为 additive feature，非修 patch bug——按 minor 发布。