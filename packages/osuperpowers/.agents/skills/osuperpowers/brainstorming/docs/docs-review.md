# Docs Review

> **Scope:** Applies to 3-pass AI-orchestrated doc reviews (spec-review / plan-review) only.
> Task-review uses Fix Loop in `cli-driven-development/SKILL.md`. Branch-review uses `cli-driven-development` + `{pluginRoot}/bin/engine/cdd-review.mjs` (--template branch-review).

Cross-cutting reference: dispatch discipline for multi-pass reviews (D1/D2/D3). Cited by review-pass rules in brainstorming / writing-plans.

## Rules

### Rule: D1 Escalate-on-Finding

Pass 1 runs independently first. Zero findings + explicit scan checklist → subsequent passes are skipped; otherwise, fix first, then run subsequent passes concurrently.

**CLI review:** each pass is an independent `{pluginRoot}/bin/engine/cdd-review.mjs` invocation (stateless fresh nested session).

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

     AskUserQuestion with two options:
       "Proceed: <next-step>" (caller provides next-step label)
         → review complete, go to next step
       "Fix selected warns/nits"
         → fix selected items → review complete, go to next step

     Re-run is never offered after ③.

`<next-step>` label is provided by the calling skill (e.g., brainstorming → "User review of spec";
writing-plans → "Execution Handoff").

Re-run is never offered after all passes are blocker=0: re-running without changes produces
identical results; re-running after fixes adds no value. Step ② blocker re-run is the only re-run.

When presenting warn/nit: read from the already-captured output of the current
3-pass review cycle. Do not issue any new review call to obtain them.

### Rule: Handoff Output

**Scope:** spec-review and plan-review only. Task-review uses $CDD_HANDOFF_PATH
(unchanged). Branch-review: out of scope for this rule.

Path convention (enforced by P2 engine — `node {pluginRoot}/bin/engine/cdd-review.mjs --handoff PATH`):
  - spec-review: `<cdd-workspace>/spec-review-handoff.json`
  - plan-review: `<cdd-workspace>/plan-review-handoff.json`

`<cdd-workspace>` = `.superpowers/cdd/<plan-slug>/`

handoff.json schema: `{ "status": "APPROVED|CHANGES_REQUESTED", "findings": [...], "deferred": [...] }`
