---
"@oscaner-skills/cdd-engine": patch
---

Child dispatch no longer hangs on an open stdin or on a grandchild holding the output pipes: the child's stdin is closed and its process group is reclaimed when it exits. The termination fact now rides `DispatchOutcome.termination` (cause, idle time, last sample), `timeoutCount` increments from that fact alone, and crash records gain `promoted` and `idleMs`. A terminated review round whose handoff draft is valid and carries at least one finding is promoted: it is read back normally, recorded, exits 0 with a single `CDD_WARN`, and its crash record is marked `promoted: true`; every other terminated round keeps the TIMEOUT failure face. TIMEOUT and BLOCKED summary lines no longer print a placeholder `blocker:` value, and `handoff:` appears only when the round wrote a crash record and then points at it.
