---
"@oscaner-skills/cdd-engine": patch
---

cdd implement / review / fix: the clean-tree dispatch gate keeps pure git semantics — uncommitted user work still refuses it (dirty → BLOCKED) — while the engine's own run state never counts as user work: the engine workspace self-publishes a keep-out `.gitignore` (content `*`) at the `.kairos/` namespace root at ensure time, before the gate reads the tree. Consumer repos without a `.kairos` gitignore no longer self-BLOCK with the CDD_BLOCKED dirty-tree refusal once a dispatch lands its own artifacts, and those artifacts stay out of commits and branch diffs with zero consumer setup.
