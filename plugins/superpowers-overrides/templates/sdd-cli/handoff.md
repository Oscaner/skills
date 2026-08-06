# SDD handoff — CLI session

**Workspace:** {{WORKSPACE}}

**Segment:** {{SEGMENT}}

**Handoff path:** {{HANDOFF}}

**Task brief:** {{BRIEF}}

## Instructions

1. Invoke **`spor-handoff-writer`** (Read the skill via `agent_skills` fullPath).
2. Segment **`{{SEGMENT}}`** — read inputs per handoff-writer SKILL.md for this segment (paths only; no report bodies for test stdout).
3. Write or update **`{{HANDOFF}}`** per the handoff-writer schema.
4. When segment is **review** and status is **CHANGES_REQUESTED**, also write the open-findings JSON beside the handoff (handoff-writer owns the path).
5. Do **not** write ledger — orchestrator-only.

Handoff JSON shape: see `templates/sdd-handoff-schema.md` in plugin root.

## Return (H1 — stdout only)

Return **exactly 4 lines** to stdout:

```
status: <DONE|APPROVED|CHANGES_REQUESTED|NEEDS_CONTEXT|BLOCKED>
commits: base=<sha> head=<sha>
artifacts: brief=<path> report=<path> test_evidence=<path>
blocker: <none|one-line>
```

No review prose or findings narration in the return — handoff.json holds structured state.
