---
"@oscaner-skills/cdd-engine": major
"@oscaner-skills/osuperpowers": major
---

feat: extract @oscaner-skills/cdd-engine as independent package

- Migrate all 6 CLIs (cdd-task, docs-task, branch-review, cdd-select,
  cdd-research, init) to @oscaner-skills/cdd-engine
- Commander.js v15 for all CLIs; execa v9 replaces spawnCapture; ajv v8
  for schema validation; Vitest v3 replaces node:test
- Bug A fix: --task parseInt coercion; Bug B/D: branch-review.mjs new
  standalone CLI; Bug C: task-review.md node order; Bug K/L: docs-task
  workspace + subprocess cwd; #137/#139/#109: subprocess security + retry
- Enh F: detect-engine gate in cli-driven-development SKILL.md
- Enh G: init single command (no harness subcommand, auto-detects harness)