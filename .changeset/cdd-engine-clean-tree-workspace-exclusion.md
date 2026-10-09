---
"@oscaner-skills/cdd-engine": patch
---

cdd implement / review / fix: the clean-tree dispatch gate now ignores the engine's own workspace (`<repoRoot>/.kairos/cdd/` — the per-dispatch run state the engine writes itself), so consumer repos without a `.kairos` gitignore no longer self-BLOCK with the CDD_BLOCKED dirty-tree refusal once a dispatch lands its own artifacts. Uncommitted user work still refuses the gate (dirty → BLOCKED untouched). The kairos README documents the `.gitignore` recommendation so the run artifacts stay out of commits and branch diffs.
