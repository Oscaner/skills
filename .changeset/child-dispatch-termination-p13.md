---
"@oscaner-skills/cdd-engine": patch
---

Child dispatch no longer hangs on an open stdin or on a grandchild holding the output pipes: the child's stdin is closed and its process group is reclaimed when it exits. The termination fact now rides `DispatchOutcome.termination` (cause, idle time, last sample), `timeoutCount` increments from that fact alone, and crash records gain `promoted` and `idleMs`.
