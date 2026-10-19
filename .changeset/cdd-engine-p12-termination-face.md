---
"@oscaner-skills/cdd-engine": minor
---

feat: child-dispatch termination landing face (P12 C-group · issue #346):

- **Stall kill trigger** — the sampling loop's first `stalled` verdict fires the terminator's group kill (`subprocess.kill()` via execa; SIGTERM→SIGKILL escalation stays execa's — zero engine signal logic, `detached` never set).
- **Three-cause derivation + fallback** — `over-budget` (execa `timedOut`), `stalled` (the engine's own kill, judged ahead of the signal leg), `signal` (any external signal, by semantic never the literal), `unknown` (the unattributable fallback when the child was terminated none of those ways).
- **Terminated rounds conclude `TIMEOUT`** — the lifecycle judges the termination fact BEFORE the child-exit branch (a killed child's code is null; judging exit first would falsify the cause), the reason rides the CDD_BLOCKED channel, and the failure face is unchanged: no `next:` line, no auto-retry.
- **Crash record for terminated rounds** — the unified death-facts object extended with the `termination` fact: derived cause, the in-memory last sample (`lastSample`, zero heartbeat re-read), and an honest `exitCode: number | null` (a signalled or never-spawned child has no exit code).
- **`timeoutCount` increments** — the progress counter's first real writer: one TIMEOUT round lands, the count goes up by one.
