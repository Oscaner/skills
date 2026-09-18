# Docs Fix — CLI session

Document: {{DOCS_DOC}}
Findings: {{DOCS_FINDINGS}}
Handoff path: {{HANDOFF_TARGET}}

## Instructions

1. Read open-findings at **`{{DOCS_FINDINGS}}`** (the review handoff for this round); fix ALL findings (blocker + warn + nit), removing fixed findings from `findings[]`. Apply fixes directly to `{{DOCS_DOC}}`.
2. **Commit the fixed document (commit contract):**
   - If the doc changed this round → create **one** conventional commit (`fix:` primary), subject aligned to the fix scope; no attribution / co-author / AI-generation trailers.
   - No doc diff this round (no findings required a change) → no commit.
   - Uncommitted changes at return → `status: BLOCKED` (the `cdd` runner enforces the commit contract — dirty tree at exit → BLOCKED).
   - Only commit the document under fix. If you encounter uncommitted changes belonging to other work — do NOT stage, commit, or revert them; leave as-is. If out-of-scope uncommitted changes exist at return, write status: BLOCKED + `blocker:` listing the out-of-scope paths, so the orchestrator decides.
3. Write the handoff JSON to `{{HANDOFF_TARGET}}` per `## Handoff` below (the same schema ships at `templates/schema/docs-handoff-schema.json`).

Rules:
- `status`: APPROVED (all findings fixed) or BLOCKED (cannot proceed — explain in `blocker`)
- `findings`: list any remaining issues you could not fix
- `artifacts`: record the doc path (`{"doc": "{{DOCS_DOC}}"}`)
- `doc_path`: must be the exact path `{{DOCS_DOC}}`

## Handoff

{{HANDOFF_WRITE_GATE}}

Write/update `{{HANDOFF_TARGET}}` per the schema above:

{{HANDOFF_SCHEMA_JSON}}

## Return

Your return IS the handoff written to `{{HANDOFF_TARGET}}` — the engine reads the file, not your stdout. Return **no additional prose**; empty `findings` array = all findings fixed.
