# CDD review — {{TYPE}} ({{LENS_GUIDE}})

**Workspace:** {{WORKSPACE}}

**Reference:** {{REFERENCE}}

{{PLAN_LINE}}

## Instructions

**Review focus ({{TYPE}}):** {{AXES}}

Every finding MUST carry its `lens` label (prevents axis mixing); empty `findings` array = approved.

## Handoff

{{HARD_GATE}}

Write/update `{{HANDOFF}}` per the schema above (schema family: {{HANDOFF_TYPE}}):

{{HANDOFF_STUB}}

The block above is the full contract — write **valid JSON** (no comments) to `{{HANDOFF}}`.

Self-validate before returning: `{{HANDOFF}}` → `phase`/`artifacts`/`findings` non-null (h1 mode additionally requires `commits.base`/`commits.head`); fail → `status: BLOCKED`. Write findings, not status — the engine derives status from findings.

## Return

This review's `returnMode` is **{{RETURN_MODE}}**:

- `json` (spec/plan): return findings ONLY as a JSON object `{"findings":[{ "lens": "<one of {{LENS_GUIDE}}>", "severity": "blocker|warn|nit", "section": "...", "line": 0, "summary": "...", "fix": "..." }]}`. Every finding MUST carry its `lens` label (prevents axis mixing); empty `findings` array = approved. No additional prose.
- `h1` (task/branch): collect findings into `{{HANDOFF}}` `findings[]` (do not print them), then output the H1 block below to stdout; the H1 four-line contract is the ONLY stdout content.

{{H1_BLOCK}}