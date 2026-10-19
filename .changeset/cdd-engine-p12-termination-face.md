---
"@oscaner-skills/cdd-engine": minor
---

feat: child-dispatch termination face (P12 · issue #346):

- **Async dispatch** — `DispatchStep` is now asynchronous (internal type seam, not part of the package contract); the old synchronous signature is dropped with no compatibility shim. Process-group creation, group kill, SIGTERM→SIGKILL escalation, parent-exit cleanup and the wall-clock cap are all delegated to execa.
- **Stall judge and dual-signal sampler** — a stateful, zero-I/O `StallJudge` plus a two-leg I/O `Sampler`; an unreadable leg fails open (never kills).
- **Sampling loop with heartbeat** — immediate first sample, then an unref'd 60s tick; the heartbeat file is overwritten each sample, deleted on normal completion and kept on termination.
- **Stall kill trigger** — the sampling loop's first `stalled` verdict fires the terminator's group kill (`subprocess.kill()` via execa; zero engine signal logic, `detached` never set).
- **Three-cause derivation + fallback** — `over-budget` (execa `timedOut`), `stalled` (the engine's own kill, judged ahead of the signal leg), `signal` (any external signal, by semantic never the literal), `unknown` (the unattributable fallback).
- **Terminated rounds conclude `TIMEOUT`** — the lifecycle judges the termination fact BEFORE the child-exit branch (a killed child's code is null), the reason rides the CDD_BLOCKED channel, and the failure face is unchanged: no `next:` line, no auto-retry.
- **Crash record for terminated rounds** — the death-facts object gains the `termination` fact: derived cause, the in-memory last sample (`lastSample`), and an honest `exitCode: number | null`.
- **`timeoutCount` increments** — the progress counter's first real writer: one TIMEOUT round lands, the count goes up by one.
- **Known boundary** — execa's `killDescendants` is best-effort and does not reach descendants that created their own process group or session (e.g. `setsid` daemons).
