# CDD implement — CLI session

**Workspace:** {{WORKSPACE}}

**Task brief:** {{BRIEF}}

**Handoff path (write at end of this mode):** {{HANDOFF}}

**Plan constraints:** {{CONSTRAINTS}}

## Instructions

1. Read **only** the task brief and plan constraints at the paths above. Do **not** read the full plan file or ledger. **Scope lock:** implement exactly what the brief specifies — no extra features, no tangential refactors, no scope creep beyond the brief's Files/Interfaces/Steps.
2. **Confirm seams first:** If the task brief includes `CONFIRMED_SEAMS` (test boundaries already confirmed by the orchestrator with the user), apply those seams when invoking tdd — no re-negotiation. Otherwise, propose the test boundaries in the report ("I'll test at these seams: [X, Y]. Not testing: [Z]") and proceed (non-blocking; the orchestrator owns seam confirmation). Then invoke **`mattpocock-skills:tdd`** (Read the skill via `agent_skills` fullPath) to implement per the brief.
3. Write a full implementer report to the path named in the brief (typically `<workspace>/task-N-report.md`).
4. Write `<workspace>/task-N-test-evidence.json` with at least `command`, `exit_code`, `passed`, and `warnings_count` (include `behavior_change` when applicable).
5. **Commit (base/head contract):**
   - `base` = SHA in the task brief as `TASK_BASE` (orchestrator writes this immediately before the H6 implement shell — `git rev-parse HEAD` at chain start). Batch blocks: use `FIRST_TASK_BASE` from brief.
   - After tests pass: if TDD already created **one or more** conventional commits covering this task's changes, set `head` = `git rev-parse HEAD` (do not create duplicate commits).
   - Otherwise: create **one** conventional commit (`feat:` / `fix:` / `refactor:` / …) with subject aligned to the task brief; no attribution / co-author / AI-generation trailers; then `head` = `git rev-parse HEAD`.
   - Uncommitted changes at return → `status: BLOCKED`.
   - Only commit changes within this task brief scope. If you encounter uncommitted changes belonging to other tasks — do NOT stage, commit, or revert them; leave as-is. If out-of-scope uncommitted changes exist at return, write status: BLOCKED + `blocker:` listing the out-of-scope paths, so the orchestrator decides.
6. Write handoff per `## Handoff Output` below. Do **not** write ledger.

## Handoff Output

Write/update `{{HANDOFF}}` per [`handoff-schema.md`](../docs/handoff-schema.md) from file paths only (per [`controller-handoff.md`](../docs/controller-handoff.md) H1–H2 file-only discipline).

### Segment: implement

1. Read `{{WORKSPACE}}/task-{{TASK}}-test-evidence.json` (omit `behavior_change` in handoff).
2. Gate: Complex/`behavior_change:true` → hard (require command/passed/exit_code); Simple → soft (WARN).
3. Set `status: APPROVED` on success; blocker finding → `status: BLOCKED`.
4. `commits.base` = `TASK_BASE`; `commits.head` = `git rev-parse HEAD` (full 40-char SHA; never `--short`).

Write the following JSON stub to `{{HANDOFF}}` (fill in your actual values):

{{HANDOFF_STUB}}

Rules:
- `task` must be a JSON integer (no quotes)
- `status`: APPROVED (implementation complete) or BLOCKED (cannot proceed — explain in blocker field)
- `findings`: empty array [] for implement mode
- `artifacts`: record file paths produced (e.g. `{"brief": "{{BRIEF}}", "report": "...", "test_evidence": "..."}`)

### Self-validate

Before H1: `jq . {{HANDOFF}}` → check status/commits.base/commits.head non-null. Fail → `status: BLOCKED`.

### Atomicity

Implement+handoff in one process. Handoff write fails → H1 `status: BLOCKED`. Retry → full mode re-run (idempotent).

## Return (H1 — stdout only)

Return **exactly 4 lines** to stdout (no other prose); make this block the **final** output — nothing may follow it (stream-json harnesses parse the last block):

```
status: <APPROVED|BLOCKED|NEEDS_CONTEXT>
commits: base=<sha> head=<sha>
artifacts: brief=<path> report=<path> test_evidence=<path>
blocker: <none|one-line>
```

Report bodies, test stdout, and diff text live in files only — never in the return.
