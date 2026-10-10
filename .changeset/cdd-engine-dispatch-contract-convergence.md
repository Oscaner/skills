---
"@oscaner-skills/cdd-engine": patch
---

The dispatch contract converges on the two live channels — the fix face is de-referenced and the dead data planes are deleted:

1. **fix face no ref** — `DISPATCH.fix` and `DispatchTable.fix` are deleted, `#skillRef(fix)` returns null (mirroring spec/plan review), and `REFS` drops its `mattpocock-skills:tdd` key; the guard's `checkChannels` fix `pushRef` is removed so a fix-less dispatch table no longer raises.
2. **CHAINS/graph-node deleted** — the `CHAINS` ordered-chain data plane (`chains`/`ChainKey`/`CHAINS` on `HostContract`) and the `graph-node` ref kind (`RefKind` 4→3) are removed; `REFS` keeps per-host rendering, and the wave-atomic model never reviews a single node.
3. **FIX_SHELL typed** — the fix fixed body gains two typed instructions: **verify-then-apply** (each finding checked against the codebase before changing; unsound findings are kept as notes, never blindly applied) and **conditional TDD** (a behavior-changing fix without a test opens red→green first).
