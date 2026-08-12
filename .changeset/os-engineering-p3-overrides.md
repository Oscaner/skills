---
"superpowers-overrides": patch
---

os-engineering P3 — trigger-router consolidation. superpowers-overrides shrinks to a pure trigger router: all 14 `spor-*` skill bodies deleted, `overrides.manifest.json` targets retargeted to `os-engineering:*` / `mattpocock-skills:tdd`, generated hooks / self-check tables point at the target skills, cursor-plugins wrapper emit removed (plugin-root emit via unified `scripts/emit.mjs`), and the CDD orchestrator gate hooks moved to os-engineering (overrides hooks keep only `UserPromptExpansion`).
