# SDD fix — CLI session

**Workspace:** {{WORKSPACE}}

**Task brief:** {{BRIEF}}

**Open findings:** {{FINDINGS}}

**Handoff path (read for context; do not update — handoff-writer follows fix):** {{HANDOFF}}

**Plan constraints:** {{CONSTRAINTS}}

## Instructions

1. Read open-findings at **`{{FINDINGS}}`** and the task brief at **`{{BRIEF}}`** (paths only for handoff context — do not paste full review axis bodies into prompts).
2. Fix issues per open-findings; stay within fix-loop scope (H4 incremental re-review uses `FIX_BASE..HEAD`).
3. Update `<workspace>/task-N-test-evidence.json` after running verification commands.
4. Update the implementer report at the path from the brief (or as the brief specifies for fix rounds).
5. Do **not** write or update handoff.json — a separate `mode=handoff --segment fix` invocation runs after scoped re-review.
6. Do **not** write ledger.

## Return (H1 — stdout only)

Return **exactly 4 lines** to stdout:

```
status: <DONE|BLOCKED>
commits: base=<sha> head=<sha>
artifacts: brief=<path> report=<path> test_evidence=<path>
blocker: <none|one-line>
```

Fix prose and test output live in files only.
