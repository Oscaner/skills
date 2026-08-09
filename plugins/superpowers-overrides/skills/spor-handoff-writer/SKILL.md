---
name: spor-handoff-writer
description: Schema reference doc — handoff write is now inline in implement/review/fix templates per H6 p1. This skill is no longer independently dispatched. Referenced by templates for handoff schema and segment I/O rules.
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
2. On `CHANGES_REQUESTED`: write open-findings file from handoff `findings[]` **blocker（非 deferred）only**
3. Return H1 four-line contract to orchestrator (no review prose)

## Schema

Read field definitions and examples from [`templates/sdd-handoff-schema.md`](../../templates/sdd-handoff-schema.md) — do not paraphrase.

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

Merge into handoff `findings[]` (keep prior `deferred: true` items; never replace wholesale). **Mark every `warn`/`nit` finding `deferred: true` at parse time** — unconditionally, whether or not the round also contains a `blocker` (deferred marking and status decision are independent steps). Scan report text for "cannot verify" / "unverifiable" → `unverifiable[]` (non-empty → set `status: BLOCKED`).

**plan_conflicts:** deliberate plan/brief violations (not ordinary bugs) → `{plan_section, finding_summary}` entries; orchestrator STOPs before fix loop.

**status** follows the schema SOT severity→status table in [`templates/sdd-handoff-schema.md`](../../templates/sdd-handoff-schema.md) — do not redefine here: any `blocker` → `CHANGES_REQUESTED`; only `warn`/`nit` → `APPROVED`; `unverifiable[]`/`plan_conflicts[]` → `BLOCKED`. On `CHANGES_REQUESTED`, write open-findings with **blocker（非 deferred）findings only** — deferred items never enter the fix loop.

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
