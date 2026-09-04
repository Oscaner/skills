---
"@oscaner-skills/cdd-engine": major
"@oscaner-skills/osuperpowers": major
---

feat: extract @oscaner-skills/cdd-engine as independent package

- New package `@oscaner-skills/cdd-engine` (v1.0.0): 5 CLIs (cdd-task, docs-task,
  branch-review, cdd-select, cdd-research) + lib/ + templates/, published separately.
- osuperpowers: removed `bin/engine/`; depends on `@oscaner-skills/cdd-engine` (workspace:* → npm on publish).
- Commander.js v15 for all CLIs; execa v9 replaces hand-written subprocess; ajv v8 for
  schema validation; semver for version sort; Vitest v3 replaces node:test.
- Bug A fix: `--task` parseInt coercion. Bug B/D: new standalone `branch-review` CLI
  (CDD handoff schema, per-round files). Bug C: task-review template node order
  (Handoff Output before H1) + HARD GATE. Bug K/L: docs-task workspace → `.superpowers/docs-review/`,
  subprocess cwd = git toplevel. #137: subprocess env strips ANTHROPIC_API_KEY; execa timeout.
  #139: NDJSON line parser replaces hand-written stream-json scanner. #109: invokeCliWithRetry.
  Bug O: delete cdd-session-activate; gate activation via CDD_GATE_WORKSPACE/MODE env.
  Bug M/N: cli-driven-development SKILL.md removes deferred/ledger nodes, aligns
  handoff-status with Review Stopping. Enh F: detect-engine gate. Enh G: init single command.
  Enh P: per-mode prefix/suffix template injection (newline separated).
- Templates restructured: `templates/{task,review,schema}/`.
