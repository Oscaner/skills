---
"@oscaner-skills/cdd-engine": minor
---

Child prompt Bash discipline: the shared clause set now (a) requires a `timeout` on every Bash command with a hard per-invocation ceiling sourced from `TerminationPolicy.CHILD_BASH_TIMEOUT_MS` (a discipline constant, not a phase budget), and (b) forbids unbounded loops (`while True: pass`, spin-waits) — every wait must carry its own terminating condition. Template contract `$version` 12.