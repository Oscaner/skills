# CDD review — {{REVIEW_TYPE}} ({{REVIEW_LENS_GUIDE}})

**Workspace:** {{TASK_WORKSPACE}}

**Reference:** {{REVIEW_REFERENCE}}

{{REVIEW_PLAN_LINE}}

## Instructions

**Review focus ({{REVIEW_TYPE}}):** {{REVIEW_AXES}}

Every finding MUST carry its `lens` label (prevents axis mixing); empty `findings` array = approved.

## Handoff

{{HANDOFF_WRITE_GATE}}

Write/update `{{HANDOFF_TARGET}}` per the schema above:

{{HANDOFF_SCHEMA_JSON}}

The block above is the full contract — write **valid JSON** (no comments) to `{{HANDOFF_TARGET}}`.

Self-validate before returning: `{{HANDOFF_TARGET}}` → `phase`/`artifacts`/`findings` non-null (RETURN_STDOUT_BLOCK mode additionally requires `commits.base`/`commits.head`); fail → `status: BLOCKED`. Write findings, not status — the engine derives status from findings.

## Return

This review's `returnFormat` is **{{RETURN_FORMAT}}**:

- `RETURN_JSON` (spec/plan): return findings ONLY as a JSON object `{"findings":[{ "lens": "<one of {{REVIEW_LENS_GUIDE}}>", "severity": "blocker|warn|nit", "section": "...", "line": 0, "summary": "...", "fix": "..." }]}`. Every finding MUST carry its `lens` label (prevents axis mixing); empty `findings` array = approved. No additional prose.
- `RETURN_STDOUT_BLOCK` (task/branch): collect findings into `{{HANDOFF_TARGET}}` `findings[]` (do not print them), then output the return block below to stdout; the four-line return contract is the ONLY stdout content.

{{RETURN_STDOUT_BLOCK}}
