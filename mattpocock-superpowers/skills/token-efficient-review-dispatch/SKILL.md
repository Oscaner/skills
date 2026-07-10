---
name: token-efficient-review-dispatch
description: Cross-cutting dispatch discipline for multi-pass review skills (brainstorming, writing-plans, subagent-driven-development). Defines the three token-efficiency mechanisms — D1 escalate-on-finding, D2 delta review, D3 findings-only output — shared verbatim across every review-pass override. Invoked by reference from those overrides, not directly by the user.
---

# Token-Efficient Review Dispatch

Cross-cutting policy referenced by every override that spawns multi-pass fresh-subagent reviews. Not user-triggered — there is no slash command, no `<command-name>` hook. The referencing override's Rule points here so the three mechanisms below stay in one place and cannot drift between overrides.

## The three mechanisms

Each override defines its own **pass focus** (what each pass looks for) and its own **pass count** (usually up to 3). This skill defines **how those passes are dispatched** — the token discipline that keeps a 3-pass review from costing 3× a 1-pass review when the extra passes turn up nothing.

### D1 — Escalate-on-finding

Pass 1 runs standalone first. If it returns **zero findings** AND its output enumerates every checklist item it actually scanned, later passes are **skipped**. Otherwise fix and run later passes concurrently.

The enumeration requirement is load-bearing: a zero-findings return without an explicit scan list is indistinguishable from a lazy reviewer. Reject the return and re-dispatch if the scan list is missing.

For skills with multiple independent review axes (e.g. subagent-driven-development's spec-compliance vs code-quality), apply D1 **per axis** — one axis skipping later passes does not force the other axis to skip.

### D2 — Delta review

Middle passes receive only the sections/files/hunks changed after the previous pass's fix, plus a diff summary. Their lens fires locally on what changed.

The **final pass** always receives the full document / diff — global-coherence checks (Clarity & YAGNI, type consistency, maintainability semantics) need visibility across untouched sections to catch inconsistencies the local diff can't see. Every override's Pass N (last) is a full-doc pass; every override's Pass 2..N-1 is a delta pass.

### D3 — Findings-only output

Reviewer prompts MUST specify: no summaries, no positive commentary, no meta-observations. Output schema:

```
{findings: [{lens, severity, section|file, line?, summary, fix}]}
```

- `lens` — the pass's focus label (e.g. "Completeness", "Consistency & scope")
- `severity` — one of `blocker` / `warn` / `nit`
- `section` or `file` — spec/plan section heading, or code file path
- `line` — optional; only when the finding anchors to a specific line
- `summary` — one sentence stating the defect
- `fix` — concrete suggestion, one sentence

An empty `findings` array means approve. No prose narration around the JSON.

## Why these three, together

D1 alone under-uses passes 2..N (they run when they shouldn't). D2 alone wastes global-coherence signal (final pass misses cross-section inconsistencies). D3 alone gives clean output but doesn't cut token count. Together they scale review cost to defect density: a clean pass 1 pays for one pass, a messy pass 1 pays for three deltas and one full-doc sweep. No override should paraphrase these — they reference this skill.

## Red Flags — STOP if you catch yourself thinking any of these

- "D1 says skip 2 & 3 but Pass 1 didn't list what it scanned — I'll accept the empty findings anyway."
- "The final pass is delta too, since Pass N-1 already covered globals."
- "I'll let the reviewer narrate its reasoning around the findings JSON — more context is better."
- "One axis found nothing so the other axis should skip too — save tokens."

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "Enumerating scanned items is bureaucratic" | Without it, zero-findings is indistinguishable from a lazy reviewer that read three sections and stopped. |
| "Delta review misses cross-section bugs" | That's what the final full-doc pass is for. Middle passes are supposed to fire locally. |
| "Findings-only feels curt to the reviewer" | The reviewer is a subagent, not a colleague. Positive commentary costs tokens and dilutes the findings signal. |
