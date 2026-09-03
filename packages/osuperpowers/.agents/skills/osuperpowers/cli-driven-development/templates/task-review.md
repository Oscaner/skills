# CDD task-review — CLI session

**Workspace:** {{WORKSPACE}}

**Task brief:** {{BRIEF}}

**Handoff path:** {{HANDOFF}}

**Review fixed point:** {{FIXED_POINT}}

**Plan constraints:** {{CONSTRAINTS}}

## Instructions

1. Use the archived review-package diff when the harness provides it (review mode runs review-package before this session).
2. Invoke **`mattpocock-skills:code-review`** (Read via `agent_skills` fullPath) with fixed point **`{{FIXED_POINT}}`** (D4 scoped review — `git diff {{FIXED_POINT}}...HEAD`).
3. Write axis report files under the workspace (paths from brief / handoff artifacts):
   - `task-N-review-standards.md` (Standards axis)
   - `task-N-review-spec.md` (Spec axis)
4. Each axis file **must** end with a `## Findings (D3)` section containing a JSON block `{"findings": [...]}` (D3 findings-only discipline).
5. Write handoff per `## Handoff Output` below. After axes complete, parse D3 findings and set status per `## Handoff Output` review segment (spec D1: blocker → CHANGES_REQUESTED; warn/nit → APPROVED + deferred).
6. Do **not** write ledger.
7. **Findings output:** Review findings MUST be written to `{{HANDOFF}}` (the JSON handoff file). Do not return findings via stdout alone. If the handoff `findings[]` is empty or missing at return, the runner treats this as no findings found.

## Return (H1 — stdout only)

Return **exactly 4 lines** to stdout; make this block the **final** output — nothing may follow it (stream-json harnesses parse the last block):

```
status: <APPROVED|BLOCKED>
commits: base=<sha> head=<sha>
artifacts: brief=<path> report=<path> test_evidence=<path>
blocker: <none|one-line>
```

Axis report bodies stay in files only — not in the return.

## Handoff Output

Write/update `{{HANDOFF}}` per [`handoff-schema.md`](../docs/handoff-schema.md) from file paths only (per [`controller-handoff.md`](../docs/controller-handoff.md) H1–H2 file-only discipline).

### Segment: task-review

1. Read handoff.json + axis reports (`task-N-review-standards.md`, `task-N-review-spec.md`).
2. Parse `## Findings (D3)` JSON block from each axis → **merge** into prior handoff `findings[]`
   (keep `deferred: true` items; never replace wholesale).
3. **Mark every `warn`/`nit` finding `deferred: true`** — unconditionally, whether or not
   the round also contains a `blocker` (D1: mixing must not re-enter deferred items in the fix loop).
4. Scan for "cannot verify"/"unverifiable" → `unverifiable[]`; non-empty → BLOCKED.
5. Plan/brief violations → `plan_conflicts[]` (orchestrator STOPs).
6. Set status by severity: any `blocker` → `CHANGES_REQUESTED`; otherwise → `APPROVED`.
7. On CHANGES_REQUESTED: write open-findings JSON (non-deferred = blocker findings only) beside handoff.
8. `commits.base` = `TASK_BASE`; `commits.head` = `git rev-parse HEAD` (full 40-char SHA; never `--short`).

Write the following JSON stub to `{{HANDOFF}}` (fill in your actual values):

{{HANDOFF_STUB}}

Rules:
- `task` must be a JSON integer (no quotes)
- `phase`: "task-review"
- `status`: APPROVED (no blockers) or CHANGES_REQUESTED (blocker findings found) or BLOCKED
- `findings`: array of finding objects (include deferred items)
- `artifacts`: record file paths produced (e.g. `{"brief": "...", "report": "..."}`)

### Self-validate

Before H1: `jq . {{HANDOFF}}` → check status/commits.base/commits.head non-null. Fail → `status: BLOCKED`.
