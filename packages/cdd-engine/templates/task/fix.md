# CDD fix — CLI session

**Workspace:** {{TASK_WORKSPACE}}

**Task brief:** {{TASK_BRIEF}}

**Open findings:** {{TASK_FINDINGS}}

**Handoff path (read for context, then update per the schema below):** {{HANDOFF_TARGET}}

**Plan constraints:** {{TASK_CONSTRAINTS}}

## Instructions

1. Read open-findings at **`{{TASK_FINDINGS}}`** (the review handoff for this round) and the task brief at **`{{TASK_BRIEF}}`**
   (paths only for handoff context — do not paste full review axis bodies into prompts).
   Fix ALL findings listed in open-findings: blockers, warns, and nits.
2. Fix issues per open-findings; H4 incremental re-review uses `FIX_BASE..HEAD`.
3. Update `<workspace>/task-N-test-evidence.json` after running verification commands.
4. Update the implementer report at the path from the brief (or as the brief specifies for fix rounds).
5. **Commit (base/head contract):**
   - `base` = `{{TASK_FIXED_POINT}}` (the `FIX_BASE` of this fix dispatch — the prior handoff's `commits.head`).
   - After the fix verifies: if this round already produced **one or more** conventional commits covering the fix scope → set `head` = `git rev-parse HEAD` (do not create duplicate commits).
   - Otherwise: create **one** conventional commit (`fix:` primary, or a matching `feat:`/`refactor:`), subject aligned to the fix scope; no attribution / co-author / AI-generation trailers; then `head` = `git rev-parse HEAD`.
   - No fix-scope diff this round (relative to `FIX_BASE`) → no commit; keep `head` unchanged.
   - Uncommitted changes at return → `status: BLOCKED` (the `cdd` runner enforces the commit contract).
   - Only commit changes within this task brief scope. If you encounter uncommitted changes belonging to other tasks — do NOT stage, commit, or revert them; leave as-is. If out-of-scope uncommitted changes exist at return, write status: BLOCKED + `blocker:` listing the out-of-scope paths, so the orchestrator decides.
6. Write the handoff JSON to `{{HANDOFF_TARGET}}` per `## Handoff` below.

### Segment: fix

1. Read handoff.json + open-findings.json (the review handoff).
2. Fix ALL findings (blocker + warn + nit); remove fixed findings from `findings[]`.
3. Update findings; set status per fix outcome (re-review decides final APPROVED/CHANGES_REQUESTED).
4. `commits.base` = `{{TASK_FIXED_POINT}}` (fix dispatch `FIX_BASE`); `commits.head` = `git rev-parse HEAD` (full 40-char SHA; never `--short`).

Rules:
- `status`: APPROVED (fixes applied, pending re-review) or BLOCKED
- `findings`: array with remaining findings
- `artifacts`: record file paths produced (e.g. `{"brief": "...", "report": "..."}`)

Evidence notes (why this fix / why test-evidence was re-recorded) go in the `notes` field (optional string);
command output files are referenced via `test_evidence` / `artifacts` — never inline output bodies.

### Self-validate

Before H1: `jq . {{HANDOFF_TARGET}}` → check status/commits.base/commits.head non-null. Fail → `status: BLOCKED`.

### Atomicity

Implement+handoff in one process. Handoff write fails → H1 `status: BLOCKED`. Retry → full mode re-run (idempotent).

Fix prose and test output live in files only.

## Handoff

{{HANDOFF_WRITE_GATE}}

Write/update `{{HANDOFF_TARGET}}` per the schema above:

{{HANDOFF_SCHEMA_JSON}}

## Return

{{RETURN_STDOUT_BLOCK}}
