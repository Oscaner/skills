---
"@oscaner-skills/cdd-engine": major
"@oscaner-skills/kairos": minor
---

P15: document identity moves to the declared front-matter `slug:` key, and the file-name-derived identity retires — a **major breaking** change with **zero dual-read**. The board command takes document paths (`cdd board --plan <path>` / `cdd board --spec <path>`) instead of a positional slug, per-run workspaces are keyed by `slug:` (`.kairos/cdd/<slug>/`, the same key the board renders from), and the retired path keys (`spec:` / `parent-program:` / `parent-version:`) are refused. The kairos skills follow the same key: the authoring nodes land `slug:` on every document (a phase-spec also lands `program:`), the plan header inherits its `slug:` from the approved spec it plans, and cdd-report resolves program attribution through `progress.json#plan` → the plan's `slug:` → the spec of that slug → the spec's `program:` → the overall.
