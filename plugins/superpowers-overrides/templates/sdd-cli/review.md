# SDD review — CLI session

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
5. Do **not** write or update handoff.json — a separate `mode=handoff --segment review` invocation runs `spor-handoff-writer`.
6. Do **not** write ledger.

## Return (H1 — stdout only)

Return **exactly 4 lines** to stdout:

```
status: <DONE|BLOCKED>
commits: base=<sha> head=<sha>
artifacts: brief=<path> report=<path> test_evidence=<path>
blocker: <none|one-line>
```

Axis report bodies stay in files only — not in the return.
