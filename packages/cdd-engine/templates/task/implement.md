# CDD implement — CLI session

**Workspace:** {{WORKSPACE}}

**Task brief:** {{BRIEF}}

**This mode does not write a handoff.** The runner materializes `task-{{TASK}}-implement.json` from your H1 four lines + the brief's `TASK_BASE` + `git HEAD`. The runner is the single authority for `commits` and for re-emitting your H1.

**Plan constraints:** {{CONSTRAINTS}}

## Instructions

1. Read **only** the task brief and plan constraints at the paths above. Do **not** read the full plan file. **Scope lock:** implement exactly what the brief specifies — no extra features, no tangential refactors, no scope creep beyond the brief's Files/Interfaces/Steps.
2. **Confirm seams first:** If the task brief includes `CONFIRMED_SEAMS` (test boundaries already confirmed by the orchestrator with the user), apply those seams when invoking tdd — no re-negotiation. Otherwise, propose the test boundaries in the report ("I'll test at these seams: [X, Y]. Not testing: [Z]") and proceed (non-blocking; the orchestrator owns seam confirmation). Then invoke **`mattpocock-skills:tdd`** (Read the skill via `agent_skills` fullPath) to implement per the brief.
3. Write a full implementer report to the path named in the brief (typically `{{WORKSPACE}}/task-{{TASK}}-report.md`).
4. Write `{{WORKSPACE}}/task-{{TASK}}-test-evidence.json` with at least `command`, `exit_code`, `passed`, and `warnings_count` (include `behavior_change` when applicable).
5. **Commit (base/head contract):**
   - `base` = SHA in the task brief as `TASK_BASE` (orchestrator writes this immediately before the implement dispatch — `git rev-parse HEAD` at chain start). Batch blocks: use `FIRST_TASK_BASE` from brief.
   - After tests pass: if TDD already created **one or more** conventional commits covering this task's changes, set `head` = `git rev-parse HEAD` (do not create duplicate commits).
   - Otherwise: create **one** conventional commit (`feat:` / `fix:` / `refactor:` / …) with subject aligned to the task brief; no attribution / co-author / AI-generation trailers; then `head` = `git rev-parse HEAD`.
   - Uncommitted changes at return → `status: BLOCKED`.
   - Only commit changes within this task brief scope. If you encounter uncommitted changes belonging to other tasks — do NOT stage, commit, or revert them; leave as-is. If out-of-scope uncommitted changes exist at return, write status: BLOCKED + `blocker:` listing the out-of-scope paths, so the orchestrator decides.

## Evidence gate (the runner reads back)

After you exit, the runner reads `{{WORKSPACE}}/task-{{TASK}}-test-evidence.json`:

- **hard gate** — if your evidence records `behavior_change: true`, the runner requires `command`, `passed`, and `exit_code`. Missing any of the three → the materialized handoff is overridden to `status: BLOCKED` (exit 1).
- **soft gate** — otherwise (no `behavior_change`, or the evidence file is missing/unparseable) the runner only attaches a WARN note; your declared status stands.

## Return (H1 — stdout only)

Return **exactly 4 lines** to stdout (no other prose); make this block the **final** output — nothing may follow it (stream-json harnesses parse the last block):

```
status: <APPROVED|BLOCKED|NEEDS_CONTEXT>
commits: base=<sha> head=<sha>
artifacts: brief=<path> report=<path> test_evidence=<path>
blocker: <none|one-line>
```

The runner re-emits your H1 from the materialized handoff — `status`, `commits: base=<TASK_BASE> head=<git HEAD>`, and `blocker` are the runner's authority; anything you print on the `commits:`/`blocker:` lines that disagrees is overwritten.

Report bodies, test stdout, and diff text live in files only — never in the return.
