---
"@oscaner-skills/cdd-engine": major
"@oscaner-skills/kairos": minor
---

P15: document identity moves to the declared front-matter `slug:` key, and the file-name-derived identity retires — a **major breaking** change with **zero dual-read**. The board command takes document paths (`cdd board --plan <path>` / `cdd board --spec <path>`) instead of a positional slug, per-run workspaces are keyed by `slug:` (`.kairos/cdd/<slug>/`, the same key the board renders from), and the retired path keys (`spec:` / `parent-program:`) are no longer read. The kairos skills follow the same key: the authoring nodes land `slug:` on every document (a phase-spec also lands `program:`), the plan header inherits its `slug:` from the approved spec it plans, and cdd-report resolves program attribution through `progress.json#plan` → the plan's `slug:` → the spec of that slug → the spec's `program:` → the overall.

The redundant `depends-on:` front-matter key retires in the same major. It was declared on three doc types (optional on a plan, required on a phase-spec / single-spec) but read by nothing: the phase-level dependency edge is the overall spec's **Dependency graph** plus its **Phase inventory**, and the task-level edge is the plan body's `DependsOn` field — the only dependency fact the engine enforces. `schema get <doc-type> --output skeleton` no longer emits the key, the `ChainRoot` parse no longer carries it, and the doc-contract gate accepts documents with or without it — deleting the line from an existing document is the migration, and leaving it in place changes nothing.
