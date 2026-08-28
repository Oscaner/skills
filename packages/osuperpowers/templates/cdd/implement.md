# CDD implement — CLI session

**Workspace:** {{WORKSPACE}}

**Task brief:** {{BRIEF}}

**Handoff path (write at end of this mode):** {{HANDOFF}}

**Plan constraints:** {{CONSTRAINTS}}

## Instructions

1. Read **only** the task brief and plan constraints at the paths above. Do **not** read the full plan file or ledger.
2. **Confirm seams first:** If the task brief includes `CONFIRMED_SEAMS` (test boundaries already confirmed by the orchestrator with the user), apply those seams when invoking tdd — no re-negotiation. Otherwise, propose the test boundaries in the report ("I'll test at these seams: [X, Y]. Not testing: [Z]") and proceed (non-blocking; the orchestrator owns seam confirmation). Then invoke **`mattpocock-skills:tdd`** (Read the skill via `agent_skills` fullPath) to implement per the brief.
3. Write a full implementer report to the path named in the brief (typically `<workspace>/task-N-report.md`).
4. Write `<workspace>/task-N-test-evidence.json` with at least `command`, `exit_code`, `passed`, and `warnings_count` (include `behavior_change` when applicable).
5. **Commit (base/head contract):**
   - `base` = SHA in the task brief as `TASK_BASE` (orchestrator writes this immediately before the H6 implement shell — `git rev-parse HEAD` at chain start). Batch blocks: use `FIRST_TASK_BASE` from brief.
   - After tests pass: if TDD already created **one or more** conventional commits covering this task's changes, set `head` = `git rev-parse HEAD` (do not create duplicate commits).
   - Otherwise: create **one** conventional commit (`feat:` / `fix:` / `refactor:` / …) with subject aligned to the task brief; no attribution / co-author / AI-generation trailers; then `head` = `git rev-parse HEAD`.
   - Uncommitted changes at return → `status: BLOCKED`.
6. Write handoff per `_handoff-write-fragment.md` implement segment. Do **not** write ledger.

## Return (H1 — stdout only)

Return **exactly 4 lines** to stdout (no other prose); make this block the **final** output — nothing may follow it (stream-json harnesses parse the last block):

```
status: <APPROVED|BLOCKED|NEEDS_CONTEXT>
commits: base=<sha> head=<sha>
artifacts: brief=<path> report=<path> test_evidence=<path>
blocker: <none|one-line>
```

Report bodies, test stdout, and diff text live in files only — never in the return.
