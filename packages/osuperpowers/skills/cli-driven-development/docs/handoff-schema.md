# Handoff Schema

Single source of truth for the CDD handoff JSON family — cited by the engine handoff write path (`packages/cdd-engine/lib/handoff/write.mjs`) and each segment of the CDD mode templates shipped with the engine (`packages/cdd-engine/templates/task/implement.md`, `packages/cdd-engine/templates/task/fix.md`, `packages/cdd-engine/templates/review/review.md`).

**Source of truth:** handoff naming and workspace rules → `packages/cdd-engine/templates/handoff-namespace.json`; JSON schema → `packages/cdd-engine/templates/schema/cdd-handoff-schema.json` (task/branch) and `packages/cdd-engine/templates/schema/docs-handoff-schema.json` (spec/plan).

## Naming

Handoff filenames follow the naming families in `handoff-namespace.json`; review/fix rounds append the round number:

| Family | File pattern |
|--------|--------------|
| implement | `task-N-implement.json` |
| task-review (round R) | `task-N-review-R.json` |
| fix (round R) | `task-N-fix-R.json` |

The workspace ledger is `progress.json` (engine `lib/state/progress.mjs`); the legacy `progress.md` name is obsolete.

## Status by segment

| Segment | Sets `phase` | Allowed `status` |
|---------|-------------|------------------|
| implement | `implement` | `APPROVED`, `BLOCKED` |
| task-review / fix | `task-review` or `fix` | `APPROVED`, `CHANGES_REQUESTED`, `NEEDS_CONTEXT`, `BLOCKED` |

## Severity -> status mapping

`findings[]` content → handoff `status`:

| `findings[]` content | handoff `status` |
|---|---|
| Empty | `APPROVED` (review clean) |
| Only `warn`/`nit` | `APPROVED` (fixed in the subsequent fix round) |
| Contains `blocker` (regardless of accompanying `warn`/`nit`) | `CHANGES_REQUESTED` |
| `unverifiable[]` non-empty | `BLOCKED` (unchanged) |
| `plan_conflicts[]` non-empty | `BLOCKED` (orchestrator STOP, unchanged) |

**All findings — `blocker`, `warn`, and `nit` — are fixed in full during the fix round (always-fix-all); there is no exemption channel.** The status decision and the fix set are independent: any `blocker` → `CHANGES_REQUESTED`; only `warn`/`nit` (or empty) → `APPROVED`, with warn/nit fixes still applied by the subsequent fix round.

`notes`: optional string — fix-phase evidence clarification (why this fix / test-evidence re-record note).

## Handoff object

`task` field — the owning CDD task number:

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

Example — review segment with only a warn/nit finding (→ APPROVED):

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
      "fix": "..."
    }
  ],
  "unverifiable": [],
  "plan_conflicts": []
}
```

## `commits.base` alignment

| review_scope | commits.base |
|--------------|--------------|
| `task` | `TASK_BASE` |
| `plan` | `PLAN_BASE` |

## `commits.head`

Full 40-char SHA from `git rev-parse HEAD`. Never use `--short`, `git log --format=%h`, or any truncated form. The engine validates `commits.head` with strict-equal primary and prefix fallback for legacy 7-char handoffs.

## Review arrays

**`findings[]`** — review findings: `[{lens, severity, section|file, line?, summary, fix}]`. Parsed from the axis report findings JSON block; merged on review/fix segments. Same shape as `task-N-open-findings.json`.

Findings carry no exemption flag — minor findings are no longer exempt from the fix loop (see the review contract §Eliminated). All findings (`blocker` + `warn` + `nit`) enter the fix loop and are fixed in full; the severity → status decision is made by the mapping table above.

**`unverifiable[]`** — string list of items axis reports flag as "cannot verify" / "unverifiable". Non-empty → set `status: BLOCKED`.

**`plan_conflicts[]`** — deliberate plan/brief violations (not ordinary bugs): `[{plan_section, finding_summary}]`. Non-empty → orchestrator STOPs before fix loop.
