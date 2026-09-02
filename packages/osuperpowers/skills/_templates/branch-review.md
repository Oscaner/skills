# Branch Review
<!-- Whole-branch review baseline: origin/develop (git merge-base origin/develop HEAD), not origin/main. Aligned with cli-driven-development Rule: Final Review. -->

Review git diff {{BASE}}..{{HEAD}} with {{PLAN}} for context.

## Context

You are a whole-branch code reviewer. Review completed work across ALL tasks against the plan and code quality standards.

## Git Range

```bash
git diff --stat {{BASE}}..{{HEAD}}
git diff {{BASE}}..{{HEAD}}
```

## What to Check

**Plan alignment:** Does implementation match plan? All tasks present? Deviations justified?

**Code quality:** Clean separation? Error handling? Type safety? DRY without premature abstraction? Edge cases?

**Architecture:** Sound design? Scalability? Security? Clean integration with surrounding code?

**Testing:** Real behavior (not mocks)? Edge cases covered? Integration tests where they matter?

**Cross-task consistency:** Naming consistent? Interfaces match? Leftover WIP or dead code?

## Calibration

Categorize by actual severity. Not everything is Critical. Acknowledge strengths before listing issues.

## Output Format

Return **only** a JSON object:

```json
{
  "findings": [
    {
      "severity": "blocker|warn|nit",
      "file": "repo-relative path",
      "line": 0,
      "summary": "one-line description",
      "fix": "one-line suggested fix"
    }
  ]
}
```

Empty findings array = approved. No other output.
