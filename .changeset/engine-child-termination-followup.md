---
"@oscaner-skills/cdd-engine": minor
---

Child dispatch hardening for terminated rounds: the child's stdin is closed and its process group is reclaimed when it exits, so an open stdin or a grandchild holding the output pipes no longer hangs a round. A terminated review round whose handoff draft is valid and carries at least one finding is promoted — read back normally, recorded, exit 0 with a single `CDD_WARN`, and its crash record is marked `promoted: true`; every other terminated round keeps the TIMEOUT failure face. TIMEOUT and BLOCKED summary lines no longer print a placeholder `blocker:` value. A terminated round now reports its idle time and last sample verdict on its single `CDD_BLOCKED` stderr line, and its crash record carries `idleMs` and `lastSample`.
