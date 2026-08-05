---
name: spor-handoff-writer
description: Write or update task-N-handoff.json from file paths only. Fresh subagent per dispatch. Cheap model. Returns H1 4-line contract to orchestrator. Invoked by spor-subagent-driven-development Rule 5 and spor-token-efficient-controller-handoff H5.
---

# Handoff Writer

Structured extraction subagent — reads artifact **paths**, writes/updates `handoff.json`, returns H1 four-line contract. No slash command.

## Inputs (paths only)

| Segment | Read |
|---------|------|
| **implement** | implementer H1 contract lines, `<workspace>/task-N-test-evidence.json`, brief path |
| **review** | existing handoff.json, `<workspace>/task-N-review-standards.md`, `<workspace>/task-N-review-spec.md`, brief path |
| **fix** | above + open-findings path (`task-N-open-findings.json` or batch variant) |

**Do not** Read implementer report bodies for test stdout — use `task-N-test-evidence.json` only.

## Outputs

1. Write/update `<workspace>/task-N-handoff.json` (or `batch-<first>-<last>-handoff.json`)
2. On `CHANGES_REQUESTED`: write open-findings file from handoff `findings[]`
3. Return H1 four-line contract to orchestrator (no review prose)

### Status by segment

| Segment | Set `phase` | Allowed `status` |
|---------|-------------|------------------|
| implement | `implement` | `DONE`, `BLOCKED` |
| review / fix | `review` or `fix` | `APPROVED`, `CHANGES_REQUESTED`, `NEEDS_CONTEXT`, `BLOCKED` |

## handoff.json schema

**Single task** (`task` field — mutually exclusive with `tasks[]`):

```json
{
  "task": 2,
  "phase": "implement",
  "status": "DONE",
  "commits": { "base": "<TASK_BASE>", "head": "<HEAD>" },
  "complexity": "simple",
  "review_scope": "task",
  "artifacts": {
    "brief": ".superpowers/sdd/.../task-2-brief.md",
    "report": ".superpowers/sdd/.../task-2-report.md",
    "diff": ".superpowers/sdd/.../task-2-review-package.diff",
    "review_standards": ".../task-2-review-standards.md",
    "review_spec": ".../task-2-review-spec.md"
  },
  "test_evidence": {
    "command": "pnpm test ...",
    "passed": true,
    "exit_code": 0,
    "warnings_count": 0
  },
  "findings": [],
  "unverifiable": [],
  "plan_conflicts": []
}
```

**Batch** (`tasks[]` — no `task` field):

```json
{
  "tasks": [2, 3, 4],
  "phase": "review",
  "status": "APPROVED",
  "commits": { "base": "<FIRST_TASK_BASE>", "head": "<LAST_HEAD>" },
  "complexity": "batch",
  "review_scope": "batch",
  "artifacts": {},
  "test_evidence": {},
  "findings": [],
  "unverifiable": [],
  "plan_conflicts": []
}
```

**`commits.base` alignment:**

| review_scope | commits.base |
|--------------|--------------|
| `task` | `TASK_BASE` |
| `plan` | `PLAN_BASE` |
| `batch` | `FIRST_TASK_BASE` |

## Test evidence gate

Copy fields from `task-N-test-evidence.json` into handoff `test_evidence` (omit `behavior_change` in handoff).

| Gate | When | Action |
|------|------|--------|
| **Soft** | Simple task, no behavior change | Missing fields → WARN finding (non-blocker) |
| **Hard** | Complex, `behavior_change: true`, or TDD non-exempt | Require `command`, `passed`, `exit_code`; `passed: false` or `warnings_count > 0` → blocker finding |

Hard gate triggers: complexity Complex; brief frontmatter `behavior_change: true`; test-evidence `behavior_change: true`.

## Review segment parsing

Parse axis report trailing block:

```markdown
## Findings (D3)
{"findings": [...]}
```

Merge into handoff `findings[]`. Scan report text for "cannot verify" / "unverifiable" → `unverifiable[]` (non-empty → set `status: BLOCKED`).

**plan_conflicts:** deliberate plan/brief violations (not ordinary bugs) → `{plan_section, finding_summary}` entries; orchestrator STOPs before fix loop.

## D3 orchestrator return

After writing JSON, return **only** H1 four lines — no findings narration.

## Red Flags — STOP

- "I'll summarize the Standards report for the orchestrator."
- "I'll Read report.md to fill test_evidence."
- "Empty findings — skip writing handoff.json."
- "APPROVED without parsing both axis files."

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "JSON is enough in chat" | Orchestrator must not see prose — H1 lines only. |
| "WARN findings are optional" | Soft gate WARNs document gaps for code-review follow-up. |
| "plan_conflicts are just spec findings" | plan_conflicts are deliberate plan violations — human must adjudicate. |
