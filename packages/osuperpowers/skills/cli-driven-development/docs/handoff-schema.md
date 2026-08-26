# Handoff Schema (task-N-handoff.json)

Single source of truth for task-N-handoff.json — cited by [`controller-handoff.md`](controller-handoff.md) (H2 / H4 / H5) and each segment of `templates/cdd/_handoff-write-fragment.md`.

## Status by segment

| Segment | Sets `phase` | Allowed `status` |
|---------|-------------|------------------|
| implement | `implement` | `DONE`, `BLOCKED` |
| task-review / fix | `task-review` or `fix` | `APPROVED`, `CHANGES_REQUESTED`, `NEEDS_CONTEXT`, `BLOCKED` |

## Severity -> status mapping

`findings[]` content → handoff `status`:

| `findings[]` content | handoff `status` |
|---|---|
| Empty | `APPROVED` (review clean) |
| Only `warn`/`nit` (deferred) | `APPROVED` (with deferred details) |
| Contains `blocker` (regardless of accompanying `warn`/`nit`) | `CHANGES_REQUESTED` |
| `unverifiable[]` non-empty | `BLOCKED` (unchanged) |
| `plan_conflicts[]` non-empty | `BLOCKED` (orchestrator STOP, unchanged) |

**Any `warn`/`nit` finding is unconditionally marked `deferred: true` — regardless of whether `blocker` is also present in the same round (prevents minor findings from being incorrectly dragged into the fix loop).** In mixed rounds (blocker + warn/nit), warn/nit are still marked deferred — the deferred flag and the status decision are two independent steps.

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
    "brief": ".superpowers/cdd/.../task-2-brief.md",
    "report": ".superpowers/cdd/.../task-2-report.md",
    "diff": ".superpowers/cdd/.../task-2-review-package.diff",
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

Example — review segment with a deferred minor (warn/nit → APPROVED):

```json
{
  "task": 2,
  "phase": "task-review",
  "status": "APPROVED",
  "commits": { "base": "<TASK_BASE>", "head": "<HEAD>" },
  "complexity": "simple",
  "review_scope": "task",
  "artifacts": {},
  "test_evidence": {},
  "findings": [
    {
      "lens": "Clarity",
      "severity": "nit",
      "section": "§4.1",
      "summary": "...",
      "fix": "...",
      "deferred": true
    }
  ],
  "unverifiable": [],
  "plan_conflicts": []
}
```

## Batch

`tasks[]` — no `task` field:

```json
{
  "tasks": [2, 3, 4],
  "phase": "task-review",
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

**`findings[]`** — D3 review findings: `[{lens, severity, section|file, line?, summary, fix, deferred?}]`. Parsed from axis report `## Findings (D3)` JSON block; merged on review/fix segments. Same shape as `task-N-open-findings.json`.

`deferred` is an optional field: `blocker` findings have no such field (or `false`); `warn`/`nit` findings are `deferred: true`. See the annotation in the "Severity -> status mapping" table above for marking rules. Roll-up aggregation uses `filter(.deferred == true)`; deferred items do not enter the fix loop.

**`unverifiable[]`** — string list of items axis reports flag as "cannot verify" / "unverifiable". Non-empty → set `status: BLOCKED`.

**`plan_conflicts[]`** — deliberate plan/brief violations (not ordinary bugs): `[{plan_section, finding_summary}]`. Non-empty → orchestrator STOPs before fix loop.
