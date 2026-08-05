# SDD implement — CLI session

**Workspace:** {{WORKSPACE}}

**Task brief:** {{BRIEF}}

**Handoff path (orchestrator sets; handoff-writer updates in a later invocation):** {{HANDOFF}}

**Plan constraints:** {{CONSTRAINTS}}

## Instructions

1. Read **only** the task brief and plan constraints at the paths above. Do **not** read the full plan file or ledger.
2. Invoke **`mattpocock-skills:tdd`** (Read the skill via `agent_skills` fullPath) to implement per the brief.
3. Write a full implementer report to the path named in the brief (typically `<workspace>/task-N-report.md`).
4. Write `<workspace>/task-N-test-evidence.json` with at least `command`, `exit_code`, `passed`, and `warnings_count` (include `behavior_change` when applicable).
5. Do **not** write or update handoff.json — a separate `mode=handoff` CLI invocation runs `spor-handoff-writer`.
6. Do **not** write ledger (`{{WORKSPACE}}/progress.md`) — orchestrator-only.

## Return (H1 — stdout only)

Return **exactly 4 lines** to stdout (no other prose):

```
status: <DONE|BLOCKED|NEEDS_CONTEXT>
commits: base=<sha> head=<sha>
artifacts: brief=<path> report=<path> test_evidence=<path>
blocker: <none|one-line>
```

Report bodies, test stdout, and diff text live in files only — never in the return.
