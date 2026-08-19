---
"@oscaner-skills/osuperpowers": patch
"@oscaner-skills/osuperpowers-router": patch
---

osuperpowers P2 — `os-*` orchestrator family extraction (core-set audit, 8 skills).

- 8 standalone flow-orchestration skills: `os-brainstorming` / `os-writing-plans` / `os-executing-plans` (three-mode master orchestrator: in-session → upstream executing-plans / subagent → subagent-driven-development / cli → `cli-driven-development`) / `os-finishing` (with worktree refusal) / `os-verification` / `os-debugging` / `os-code-review` / `os-report-issue`.
- Deliberately non-1:1 mappings: tdd maps directly to mattpocock (seam gate folded into cdd implement), executing-plans maps to os-executing-plans, p0-fallback deleted.
- Cross-cutting docs (`spor-subagent-lifecycle`, `spor-token-efficient-review-dispatch`) demoted to plugin docs; overall + phase templates moved in.
- Gate mode-awareness: `pending.mode` (in-session / subagent / cli — cli strictly gated, others allow repo edits).