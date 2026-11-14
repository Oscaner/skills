---
"@oscaner-skills/cdd-engine": minor
---

Read a command's plan once: the work scene, the pre-flight seam, the brief, the ledger and the lifecycle now share one `PlanRead` value instead of re-reading and re-parsing the plan at each face.

- `BriefRenderer`'s three faces take `(text, doc, tasks)` — the renderer owns no parser and the brief's blocks come from the caller's parsed document.
- `WorkScene.plan` replaces `planText`; `PreFlightContext.plan` replaces `planText`; the lifecycle's plan path becomes a read value, and the dispatch scene carries it.
- `PlanSource` is constructed once per command in the command preamble and threaded to the scene, the board chain and the ledger; a non-ready plan degrades to the empty run state instead of throwing.
- A plan the argv names but cannot read still stops at the usage face (`cannot read file: <path>`, exit 2).
- A plan the GRAMMAR refuses no longer aborts the round when the dispatch measures its verification cell: the document reads as "declares no empty `Files` row", the same shape an absent or unreadable plan already had.
- Every plan-carrying dispatch face (`wave` / `plan` / `branch`) now refuses a plan the read cannot turn into a document: the `doc-contract` gate and reason token are reused (no new token), the message names the plan path and, for a grammar break, the offending field. The refusal runs before the graph gate and before the wave brief, so a broken plan never reaches a renderer.
- A plan whose `slug:` names no `<slug>-design.md` is refused the same way on those three faces: a plan is written for one phase, so an orphan is an identity break rather than a look-ahead gap. `--dry-run` refuses with it.
- The pipeline frontier takes the command's plan READ instead of a separately injected graph, so its wave face and its `next:` cells read one document through one parse; the lifecycle no longer carries a second plan-graph field.
