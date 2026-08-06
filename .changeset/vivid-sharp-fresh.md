---
"superpowers-overrides": patch
---

Remove p0 fallback from spor-subagent-driven-development; CLI is now mandatory. When the CLI is unavailable the orchestrator reports BLOCKED with the script path, harness, and exit code — no silent fallback to in-session execution.

Migrate all Cursor CLI calls from the editor-bundled `cursor agent` to the standalone `cursor-agent` binary across `sdd-run-task-cursor.sh`, `sdd-run-plan-cursor.sh`, and `scripts/smoke-provider-hooks.mjs`.
