# Review Dispatch

Cross-cutting reference: dispatch discipline for multi-pass reviews (D1/D2/D3). Cited by review-pass rules in brainstorming / writing-plans.

## Rules

### Rule: D1 Escalate-on-Finding

Pass 1 runs independently first. Zero findings + explicit scan checklist → subsequent passes are skipped; otherwise, fix first, then run subsequent passes concurrently.

**CLI review:** each pass is an independent `cdd-review` invocation (stateless fresh nested session).

### Rule: D2 Delta Review

Middle passes receive only the delta changed after the previous pass's fix; the final pass receives the full document (global coherence checks require cross-section visibility).

**CLI review:** only Pass 2 is delta-scoped; Pass 3 is always full-doc.

### Rule: D3 Findings-Only Output

Review prompts must request findings-only (no summary, no positive comments). Output schema: `{findings: [{lens, severity, section|file, line?, summary, fix, deferred?}]}`. Empty array = approve.

**CLI review:** findings-only as-is, output schema unchanged.

**Severity behavioral anchors:**
- `blocker` — must fix before merge (correctness / contract violation)
- `warn` — deferrable minor (real issue but not blocking)
- `nit` — pure style
- warn/nit do not enter the fix loop — handoff records `APPROVED` + `deferred: true`; blocker → `CHANGES_REQUESTED`
