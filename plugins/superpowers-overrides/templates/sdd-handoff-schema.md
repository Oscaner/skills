Single source of truth for task-N-handoff.json — cited by handoff-writer and controller-handoff H4/H5.

## Status by segment

| Segment | Set `phase` | Allowed `status` |
|---------|-------------|------------------|
| implement | `implement` | `DONE`, `BLOCKED` |
| review / fix | `review` or `fix` | `APPROVED`, `CHANGES_REQUESTED`, `NEEDS_CONTEXT`, `BLOCKED` |

## Single task

`task` field — mutually exclusive with `tasks[]`:

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

## Batch

`tasks[]` — no `task` field:

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

## `commits.base` alignment

| review_scope | commits.base |
|--------------|--------------|
| `task` | `TASK_BASE` |
| `plan` | `PLAN_BASE` |
| `batch` | `FIRST_TASK_BASE` |

## Review arrays

**`findings[]`** — D3 review findings: `[{lens, severity, section|file, line?, summary, fix}]`. Parsed from axis report `## Findings (D3)` JSON block; merged on review/fix segments. Same shape as `task-N-open-findings.json`.

**`unverifiable[]`** — string list of items axis reports flag as "cannot verify" / "unverifiable". Non-empty → set `status: BLOCKED`.

**`plan_conflicts[]`** — deliberate plan/brief violations (not ordinary bugs): `[{plan_section, finding_summary}]`. Non-empty → orchestrator STOPs before fix loop.
