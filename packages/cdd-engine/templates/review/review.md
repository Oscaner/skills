# CDD review — {{TYPE}} ({{LENS_GUIDE}})

**Workspace:** {{WORKSPACE}}

**Reference:** {{REFERENCE}}

## Review focus

{{AXES}}

## Findings output

Return findings only, JSON: `{"findings":[{ "lens": "'{{LENS_GUIDE}}'任一", "severity": "blocker|warn|nit", "section": "...", "line": 0, "summary": "...", "fix": "..." }]}`.
每条 finding 必须带 lens（防混排）；空数组 = approved。

## Handoff

Write handoff JSON to `{{HANDOFF}}`（schema: {{HANDOFF_TYPE}}; returnMode: {{RETURN_MODE}}）。
{{H1_BLOCK}}