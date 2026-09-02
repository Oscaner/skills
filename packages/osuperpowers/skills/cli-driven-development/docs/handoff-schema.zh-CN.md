# Handoff Schema（task-N-handoff.json）

Single source of truth for task-N-handoff.json — cited by [`controller-handoff.md`](controller-handoff.md)（H2 / H4 / H5）与各 CDD 模式模板（[`implement.md`](../templates/implement.md)、[`task-review.md`](../templates/task-review.md)、[`fix.md`](../templates/fix.md)）。

## Status by segment

| Segment | Set `phase` | Allowed `status` |
|---------|-------------|------------------|
| implement | `implement` | `APPROVED`, `BLOCKED` |
| task-review / fix | `task-review` or `fix` | `APPROVED`, `CHANGES_REQUESTED`, `NEEDS_CONTEXT`, `BLOCKED` |

## Severity → status mapping

`findings[]` 内容 → handoff `status`:

| `findings[]` 内容 | handoff `status` |
|---|---|
| 空 | `APPROVED`（review clean） |
| 仅 `warn`/`nit`（deferred） | `APPROVED`（带 deferred 明细） |
| 含 `blocker`（无论是否兼有 `warn`/`nit`） | `CHANGES_REQUESTED` |
| `unverifiable[]` 非空 | `BLOCKED`（不变） |
| `plan_conflicts[]` 非空 | `BLOCKED`（orchestrator STOP，不变） |

**任何 `warn`/`nit` finding 无条件标 `deferred: true`——无论同轮是否含 `blocker`（防止 minor 被错误拖入 fix loop）。** 混合轮次（blocker + warn/nit）里 warn/nit 仍标 deferred——deferred 标记与 status 决策是两个独立步骤。

## Single task

`task` field — mutually exclusive with `tasks[]`:

```json
{
  "task": 2,
  "phase": "implement",
  "status": "APPROVED",
  "commits": { "base": "<TASK_BASE>", "head": "<full 40-char SHA from git rev-parse HEAD>" },
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
  "commits": { "base": "<TASK_BASE>", "head": "<full 40-char SHA from git rev-parse HEAD>" },
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
  "commits": { "base": "<FIRST_TASK_BASE>", "head": "<full 40-char SHA from git rev-parse HEAD>" },
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

## `commits.head`

Full 40-char SHA from `git rev-parse HEAD`。禁止使用 `--short`、`git log --format=%h` 或任何截断形式。引擎以 strict-equal 为主校验 `commits.head`，并对 legacy 7-char handoff 提供 prefix fallback（#186）。

## Review arrays

**`findings[]`** — D3 review findings: `[{lens, severity, section|file, line?, summary, fix, deferred?}]`. Parsed from axis report `## Findings (D3)` JSON block; merged on review/fix segments. Same shape as `task-N-open-findings.json`.

`deferred` 可选字段：`blocker` finding 无此字段（或 `false`）；`warn`/`nit` finding 为 `deferred: true`。标记规则见上表「Severity → status mapping」附注。Roll-up 聚合用 `filter(.deferred == true)`；deferred 项不进 fix loop。

**`unverifiable[]`** — string list of items axis reports flag as "cannot verify" / "unverifiable". Non-empty → set `status: BLOCKED`.

**`plan_conflicts[]`** — deliberate plan/brief violations (not ordinary bugs): `[{plan_section, finding_summary}]`. Non-empty → orchestrator STOPs before fix loop.
