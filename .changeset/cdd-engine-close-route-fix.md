---
"@oscaner-skills/cdd-engine": patch
---

cdd review / cdd fix: a closed wave now routes the next wave (`next: implement wave …`) until the terminal wave — `next: done` renders only when the run is actually exhausted. The closure router judges the ledger's cross-invocation closed set (`closedWaves()`), not the per-invocation in-memory cursor; the CLI dispatch loop peeks the next frame before advancing, so a mismatch never spends the next phase's round.