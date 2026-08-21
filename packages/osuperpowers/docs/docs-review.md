# Docs Review

> **Scope:** Applies to 3-pass AI-orchestrated doc reviews (spec-review / plan-review) only.
> Task-review uses Fix Loop in `executing-plans/SKILL.md`. Branch-review uses `cli-code-review/SKILL.md`.

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
- warn/nit: see Rule: Review Stopping below

### Rule: Review Stopping

Applies to spec-review and plan-review (3-pass AI-orchestrated doc reviews):

Loop flow:
  ① Run 3-pass review
  ② blocker: must fix → re-run only the failing pass → blocker=0 → continue
  ③ All passes blocker=0 → present warn/nit list to user (per-item selection allowed):

     User says [don't fix]
       └─→ review complete, proceed to next step

     User says [fix some/all]
       └─→ fix selected items
       └─→ ask user: "Do you want to re-run 3-pass review?"
             User says [no]  → review complete, proceed to next step
             User says [yes] → go back to ①

When presenting warn/nit: read from the already-captured output of the current
3-pass review cycle. Do not issue any new review call to obtain them.

### Rule: Handoff Output

**Scope:** spec-review and plan-review only. Task-review uses $CDD_HANDOFF_PATH
(unchanged). Branch-review: out of scope for this rule. `[Engine pending P2]`

Path convention (enforced by P2 engine — `cdd-review.mjs --handoff PATH`):
  - spec-review: `<cdd-workspace>/spec-review-handoff.json`
  - plan-review: `<cdd-workspace>/plan-review-handoff.json`

`<cdd-workspace>` = `.superpowers/cdd/<plan-slug>/`

handoff.json schema: `{ "status": "APPROVED|CHANGES_REQUESTED", "findings": [...], "deferred": [...] }`
