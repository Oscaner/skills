# Docs Fix — CLI session

Document: {{DOC}}
Findings: {{FINDINGS}}
Handoff path: {{HANDOFF}}

## Instructions

1. Read open-findings at **`{{FINDINGS}}`** (the review handoff for this round); fix ALL findings (blocker + warn + nit), removing fixed findings from `findings[]`. Apply fixes directly to `{{DOC}}`.
2. **Commit the fixed document (commit contract):**
   - If the doc changed this round → create **one** conventional commit (`fix:` primary), subject aligned to the fix scope; no attribution / co-author / AI-generation trailers.
   - No doc diff this round (no findings required a change) → no commit.
   - Uncommitted changes at return → `status: BLOCKED` (the `cdd` runner enforces the commit contract — dirty tree at exit → BLOCKED).
   - Only commit the document under fix. If you encounter uncommitted changes belonging to other work — do NOT stage, commit, or revert them; leave as-is. If out-of-scope uncommitted changes exist at return, write status: BLOCKED + `blocker:` listing the out-of-scope paths, so the orchestrator decides.
3. Write the handoff JSON to `{{HANDOFF}}` per `## Handoff` below (the same schema ships at `templates/schema/docs-handoff-schema.json`).

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
