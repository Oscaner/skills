# Plan Review

Review the plan document at **{{DOC}}** against spec at **{{SPEC}}** with lens: **{{PASS}}**.

## Context

You are a plan document reviewer. Verify this plan is complete and ready for implementation.

## Review Focus

| PASS | What to Check |
|---|---|
| completeness | TODOs, placeholders, incomplete tasks, missing steps, spec requirements with no corresponding task |
| decomposition | Task boundaries are clear, steps are actionable, dependencies between tasks are correct |
| buildability | Could an engineer follow this plan without getting stuck? Task granularity reasonable? |

## Calibration

**Only flag issues that would cause real problems during implementation.**
An implementer building the wrong thing or getting stuck is an issue.
Minor wording, stylistic preferences, and "nice to have" suggestions are not.

## Output Format

Return **only** a JSON object in the following format — no prose, no summary, no positive comments:

```json
{
  "findings": [
    {
      "lens": "completeness|decomposition|buildability",
      "severity": "blocker|warn|nit",
      "section": "Task N or section name",
      "summary": "one-line description of the issue",
      "fix": "one-line suggested fix"
    }
  ]
}
```

Empty findings array = approved. No other output.

## Handoff Output

Write the following JSON exactly to `{{HANDOFF}}`:

{{HANDOFF_STUB}}

Rules:
- `status`: APPROVED (no blockers) or CHANGES_REQUESTED (blockers found)
- `findings`: all review findings (blocker/warn/nit)
- `doc_path`: must be the exact path `{{DOC}}`
