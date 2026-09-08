# CDD review — {{TYPE}} ({{LENS_GUIDE}})

**Workspace:** {{WORKSPACE}}

**Reference:** {{REFERENCE}}

{{PLAN_LINE}}

## Review focus

{{AXES}}

## Return contract

This review's `returnMode` is **{{RETURN_MODE}}**:

- `json` (spec/plan): return findings ONLY as a JSON object `{"findings":[{ "lens": "<one of {{LENS_GUIDE}}>", "severity": "blocker|warn|nit", "section": "...", "line": 0, "summary": "...", "fix": "..." }]}`. Every finding MUST carry its `lens` label (prevents axis mixing); empty `findings` array = approved. No additional prose.
- `h1` (task/branch): collect findings into `{{HANDOFF}}` `findings[]` (do not print them), then output the H1 block below to stdout; the H1 four-line contract is the ONLY stdout content.

## Handoff

Write/update `{{HANDOFF}}` JSON per the schema shown below (schema family: {{HANDOFF_TYPE}}).

{{HANDOFF_STUB}}

## Self-validate

`{{HANDOFF}}` → `phase`/`artifacts`/`findings` non-null (h1 mode additionally requires `commits.base`/`commits.head`); fail → `status: BLOCKED`. Write findings, not `status` — the engine derives `status` from `findings`.

{{H1_BLOCK}}
