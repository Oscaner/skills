# CDD fix — CLI session

**Workspace:** {{WORKSPACE}}

**Task brief:** {{BRIEF}}

**Open findings:** {{FINDINGS}}

**Handoff path (read for context, then update per fragment below):** {{HANDOFF}}

**Plan constraints:** {{CONSTRAINTS}}

## Instructions

1. Read open-findings at **`{{FINDINGS}}`** (the task-review handoff for this round) and the task brief at **`{{BRIEF}}`**
   (paths only for handoff context — do not paste full review axis bodies into prompts).
   Fix ALL findings listed in open-findings: blockers, warns, and nits.
2. Fix issues per open-findings; H4 incremental re-review uses `FIX_BASE..HEAD`.
3. Update `<workspace>/task-N-test-evidence.json` after running verification commands.
4. Update the implementer report at the path from the brief (or as the brief specifies for fix rounds).
5. **Commit (base/head contract):**
   - `base` = `{{FIXED_POINT}}` (the `FIX_BASE` of this fix dispatch — the prior handoff's `commits.head`).
   - After the fix verifies: if this round already produced **one or more** conventional commits covering the fix scope → set `head` = `git rev-parse HEAD` (do not create duplicate commits).
   - Otherwise: create **one** conventional commit (`fix:` primary, or a matching `feat:`/`refactor:`), subject aligned to the fix scope; no attribution / co-author / AI-generation trailers; then `head` = `git rev-parse HEAD`.
   - No fix-scope diff this round (relative to `FIX_BASE`) → no commit; keep `head` unchanged.
   - Uncommitted changes at return → `status: BLOCKED` (the `cdd-task` runner enforces the commit contract).
   - Only commit changes within this task brief scope. If you encounter uncommitted changes belonging to other tasks — do NOT stage, commit, or revert them; leave as-is. If out-of-scope uncommitted changes exist at return, write status: BLOCKED + `blocker:` listing the out-of-scope paths, so the orchestrator decides.
6. Write handoff per `## Handoff Output` below.
7. Do **not** write ledger.

> ⚠️ HARD GATE — Write `{{HANDOFF}}` BEFORE outputting H1.
> H1 output without a written handoff file = BLOCKED (runner exit 1).

## Handoff Output

Write/update `{{HANDOFF}}` with only JSON fields shown below (file-only; the same schema ships at templates/schema/cdd-handoff-schema.json). Do not embed report bodies in the handoff — point at files via `artifacts`.

### Segment: fix

1. Read handoff.json + open-findings.json (the task-review handoff).
2. Fix ALL findings (blocker + warn + nit); remove fixed findings from `findings[]`.
3. Update findings; set status per fix outcome (re-review decides final APPROVED/CHANGES_REQUESTED).
4. `commits.base` = `{{FIXED_POINT}}` (fix dispatch `FIX_BASE`); `commits.head` = `git rev-parse HEAD` (full 40-char SHA; never `--short`).

Write the following JSON stub to `{{HANDOFF}}` (fill in your actual values):

{{HANDOFF_STUB}}

Rules:
- `task` must be a JSON integer (no quotes)
- `phase`: "fix"
- `status`: APPROVED (fixes applied, pending re-review) or BLOCKED
- `findings`: array with remaining findings
- `artifacts`: record file paths produced (e.g. `{"brief": "...", "report": "..."}`)

### Self-validate

Before H1: `jq . {{HANDOFF}}` → check status/commits.base/commits.head non-null. Fail → `status: BLOCKED`.

### Atomicity

Implement+handoff in one process. Handoff write fails → H1 `status: BLOCKED`. Retry → full mode re-run (idempotent).

## Return (H1 — stdout only)

Return **exactly 4 lines** to stdout; make this block the **final** output — nothing may follow it (stream-json harnesses parse the last block):

```
status: <APPROVED|BLOCKED>
commits: base=<sha> head=<sha>
artifacts: brief=<path> report=<path> test_evidence=<path>
blocker: <none|one-line>
```

Fix prose and test output live in files only.


