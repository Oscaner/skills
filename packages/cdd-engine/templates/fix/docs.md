# Docs Fix — CLI session

Document: {{DOC}}
Findings: {{FINDINGS}}
Handoff path: {{HANDOFF}}

## Instructions

1. Read open-findings at **`{{FINDINGS}}`** (the review handoff for this round); fix ALL findings (blocker + warn + nit), removing fixed findings from `findings[]`. Apply fixes directly to `{{DOC}}`.
2. Write the handoff JSON to `{{HANDOFF}}` per `## Handoff` below (the same schema ships at `templates/schema/docs-handoff-schema.json`).

Rules:
- `status`: APPROVED (all findings fixed) or BLOCKED (cannot proceed — explain in `blocker`)
- `findings`: list any remaining issues you could not fix
- `artifacts`: record the doc path (`{"doc": "{{DOC}}"}`)
- `doc_path`: must be the exact path `{{DOC}}`

## Handoff

{{HARD_GATE}}

Write/update `{{HANDOFF}}` per the schema above:

{{HANDOFF_STUB}}

## Return

Your return IS the handoff written to `{{HANDOFF}}` — the engine reads the file, not your stdout. Return **no additional prose**; empty `findings` array = all findings fixed.
