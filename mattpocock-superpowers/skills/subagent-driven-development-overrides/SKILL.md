---
name: subagent-driven-development-overrides
description: Use whenever the superpowers:subagent-driven-development skill is active — applies personal overrides and additional rules that customize its default behavior.
---

# Subagent-Driven Development Overrides

## Rules

### Rule 1 — Review rounds scale with task complexity

Classify each task first:

| Signal | Verdict |
|--------|---------|
| Touches 1–2 files, complete spec, mechanical implementation | **Simple** |
| Touches 3+ files or requires cross-module integration | **Complex** |
| Requires design judgment or architectural decisions | **Complex** |
| User explicitly requested thoroughness | **Complex** |

When in doubt, classify **Complex**. Every reviewer dispatch is a **fresh** subagent per [`subagent-lifecycle`](../subagent-lifecycle/SKILL.md) — never reuse across rounds.

**Simple tasks — 1 round each:** spec-compliance (all requirements met, nothing extra) + code-quality (basic correctness & maintainability). Both approve → proceed.

**Complex tasks — up to 3 rounds each, distinct focus per round:**

| Round | Spec compliance | Code quality |
|-------|-----------------|--------------|
| 1 | Completeness — every requirement covered | Correctness & bugs |
| 2 | Extra work & over-engineering | Security & reliability |
| 3 | Misunderstandings — semantic mismatches | Maintainability & readability |

**Token-efficient dispatch for Complex tasks — always apply:**

- **Escalate-on-finding (D1).** Round 1 runs standalone first. If it returns **zero findings** AND its output enumerates every checklist item it actually scanned, rounds 2 & 3 are **skipped for that axis**. Otherwise fix and run 2 & 3 concurrently.
- **Delta review (D2).** Round 2 receives only the files/hunks changed after Round 1's fix plus a diff summary — its lens fires locally. Round 3 receives the **full diff** — Misunderstandings / Maintainability need global visibility.
- **Findings-only output (D3).** Reviewer prompts must specify: no summaries, no positive commentary, no meta. Output schema `{findings: [{lens, severity, file, line, summary, fix}]}` — an empty array means approve.

### Rule 2 — Related simple tasks are batched and upgraded to Complex

When multiple **simple** tasks share the same feature area or shared files: batch into a single spec-review + single code-quality-review sequence, and treat the batch as **Complex** (up to 3 rounds each, subject to D1).

### Rule 3 — Rounds iterate until approved before advancing

A round that finds issues → implementer fixes → **same round's** reviewer re-reviews until approved → only then advance (subject to D1). Do not proceed past a round with unresolved findings.

### Rule 4 — Implementer subagents delegate to `mattpocock-skills:tdd`

When dispatching an **implementer** subagent to write code, delegate implementation discipline to [`mattpocock-skills:tdd`](https://github.com/mattpocock/skills/blob/main/skills/engineering/tdd/SKILL.md). This fills the gap where the upstream skill specifies *how to review* but leaves *how to implement* unopinionated. Its rules live in that skill — do not re-implement here.

1. Instruct each implementer dispatch to invoke `mattpocock-skills:tdd` via the Skill tool and follow its red-green-refactor loop.
2. Confirm the seams under test with the user before the implementer writes tests (the skill's own precondition).
3. Exemption: pure-mechanical edits with no behavioral change (renames, formatting, config-only tweaks) may skip it. When in doubt, use it.

<!-- Additional rules for subagent-driven-development go below as Rule 5, Rule 6, … -->

## Red Flags — STOP if you catch yourself thinking any of these

- "It's basically simple, I'll do 1 round even though it touches 3 files."
- "Round 1 was clean but I'll run 2 & 3 anyway to be safe."
- "Skipping a round to save time."
- "Batched simple tasks are still simple, 1 round is fine."
- "Round 2 needs to reread every file."
- "The reviewer's positive commentary is signal, keep it."
- "The implementer can just write the code directly; TDD is overhead."
- "I'll skip confirming seams — pick reasonable ones silently."

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "Rounds are wasteful" | Each round catches a distinct class of defect — but only runs when D1 says needed. |
| "3 files is a soft boundary" | Hard boundary. Complex = up to 3 rounds. |
| "Rounds 2 and 3 always find something" | If they do, D1 correctly runs them. If they don't, they cost 4N tokens for nothing. |
| "Writing tests first is slower" | Slower to write, faster to verify. `mattpocock-skills:tdd` closes the executor's feedback loop. |
| "Seams are obvious, skip the confirmation" | Silent seams = tests against the wrong interface. Confirm them. |
