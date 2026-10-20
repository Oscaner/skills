---
"@oscaner-skills/cdd-engine": minor
---

Bash discipline: the shared prompt clause now requires a `timeout` on every Bash command with a hard 15-minute per-invocation ceiling, sourced from `TerminationPolicy.CHILD_BASH_TIMEOUT_MS` (a discipline constant, not a phase budget) — template contract `$version` 11.
