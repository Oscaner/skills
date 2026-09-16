# Docs Fix — CLI session

Document: {{DOC}}
Findings: {{FINDINGS}}
Handoff path: {{HANDOFF}}

Fix ALL findings listed in the findings file (blocker + warn + nit).
Apply fixes directly to `{{DOC}}`.

## Handoff Output

Write the JSON to `{{HANDOFF}}`:

{{HANDOFF_STUB}}

The stub above is JSONC — the `//` lines are illustrative; write **valid JSON without comments** to `{{HANDOFF}}`.

Rules:
- `status`: APPROVED (all findings fixed) or BLOCKED (cannot proceed — explain in `blocker`)
- `findings`: list any remaining issues you could not fix
- `artifacts`: record the doc path (`{"doc": "{{DOC}}"}`)
- `doc_path`: must be the exact path `{{DOC}}`
