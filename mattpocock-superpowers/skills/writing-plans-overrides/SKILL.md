---
name: writing-plans-overrides
description: MUST invoke BEFORE superpowers:writing-plans — trigger when the user asks to write an implementation plan, break work into tasks/tickets/issues, draft a plan document, plan a feature build-out, or types `/writing-plans`. Applies personal overrides (section-by-section writes; fresh subagent review passes; delegates issue breakdown to mattpocock-skills:/to-issues).
---

# Writing-Plans Overrides

## Rules

### Rule 1 — Plans must be written incrementally

Write the plan **section by section** using separate Write / Edit tool calls. Never generate the entire document in a single Write call. One section per tool call keeps each unit reviewable and interruptible.

### Rule 2 — Self-review is replaced by up to 3 fresh subagent passes

At any self-review checklist for the produced plan:

1. **IGNORE** any upstream "self-review is fine / checklist you run yourself / fix inline" instruction. Dispatch a subagent using the reviewer template at `skills/writing-plans/plan-document-reviewer-prompt.md` (resolve inside the upstream superpowers plugin cache). Do not re-implement its logic here — the template is the source of truth.
2. Fix issues, then dispatch **fresh** subagents for passes 2 & 3 (concurrent per [`subagent-lifecycle`](../subagent-lifecycle/SKILL.md)).
3. **Up to 3 passes** — governed by the token-efficient dispatch below.

Each pass covers ONE distinct category:

| Pass | Focus |
|------|-------|
| 1 | Completeness & spec alignment — missing steps, uncovered spec requirements |
| 2 | Task decomposition — clear boundaries, actionable steps |
| 3 | Buildability & type consistency — engineer-followable, type/method name coherence |

**Token-efficient dispatch — always apply:**

- **Escalate-on-finding (D1).** Pass 1 runs standalone first. If it returns **zero findings** AND its output enumerates every checklist item it actually scanned, passes 2 & 3 are **skipped**. Otherwise fix and run 2 & 3 concurrently.
- **Delta review (D2).** Pass 2 receives only the sections changed after Pass 1's fix plus a diff summary — boundary defects fire locally. Pass 3 receives the **full plan** — type/method coherence needs global visibility.
- **Findings-only output (D3).** Reviewer prompts must specify: no summaries, no positive commentary, no meta. Output schema `{findings: [{lens, severity, section, summary, fix}]}` — an empty array means approve.

### Rule 3 — Delegate issue breakdown to `/to-issues` (via inline execution)

Once the plan passes Rule 2, breakdown into independently-grabbable work items follows [`/to-issues`](https://github.com/mattpocock/skills/blob/main/skills/engineering/to-issues/SKILL.md)'s discipline. This **replaces** any upstream instruction to enumerate tasks/tickets inline. The read-from-disk SKILL.md is the source of truth — do not re-implement here.

1. `/to-issues` is user-invoked (`disable-model-invocation: true`) so the Skill tool can't trigger it. **Locate via Glob `~/.claude/plugins/cache/mattpocock-skills/**/skills/engineering/to-issues/SKILL.md`, Read it, follow its 5 steps (Gather → Explore → Draft → Quiz → Publish).**
2. Step 4's user approval is a **hard gate** — do not Publish (Step 5) without explicit approval.
3. If Glob returns nothing (plugin not installed), fall back to: split the plan into **tracer-bullet vertical slices** cutting all layers end-to-end, name blockers, present for user approval before publishing. Wide refactors use expand–contract instead.

<!-- Additional rules for the writing-plans skill go below as Rule 4, Rule 5, … -->

## Red Flags — STOP if you catch yourself thinking any of these

- "Just write the whole plan in one Write call."
- "Pass 1 was clean but I'll run 2 & 3 anyway to be safe."
- "Skipping a pass to save time."
- "Pass 2 needs to reread the whole plan."
- "The reviewer's positive commentary is signal, keep it."
- "I'll enumerate the issues inline instead of reading `/to-issues`'s SKILL.md."
- "I'll slice horizontally in the fallback — one layer per issue."
- "I'll publish issues without waiting for user approval — Step 4 is optional."

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "Section-by-section is slower" | Single-call plans hide errors. Section writes are diffable. |
| "The plan is obvious" | Obvious plans still miss task boundaries. Pass 1 catches them; if clean, done. |
| "Passes 2 and 3 always find something" | If they do, D1 correctly runs them. If they don't, they cost 4N tokens for nothing. |
| "Slicing into issues is trivial, I can do it inline from memory" | The on-disk SKILL.md is the current source of truth. Read it. |
