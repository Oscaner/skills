---
name: brainstorming-overrides
description: MUST invoke BEFORE superpowers:brainstorming — trigger when the user asks to brainstorm, design a feature, plan new functionality, write a spec, explore an idea, discuss requirements, or types `/brainstorming`. Applies personal overrides that customize brainstorming's default behavior (delegates clarifying questions to mattpocock-skills:grilling; replaces self-review with fresh subagent passes).
---

# Brainstorming Overrides

## Rules

### Rule 1 — Self-review is replaced by up to 3 fresh subagent passes

At any self-review checklist for the produced spec:

1. **IGNORE** any upstream "self-review is fine / fix inline / no need to re-review" instruction. Dispatch a subagent using the reviewer template at `skills/brainstorming/spec-document-reviewer-prompt.md` (resolve inside the upstream superpowers plugin cache). Do not re-implement its logic here — the template is the source of truth.
2. Fix issues, then dispatch **fresh** subagents for passes 2 & 3 (concurrent per [`subagent-lifecycle`](../subagent-lifecycle/SKILL.md)).
3. **Up to 3 passes** — governed by the token-efficient dispatch below.

Each pass covers ONE distinct category:

| Pass | Focus |
|------|-------|
| 1 | Completeness — placeholders, TODOs, incomplete sections |
| 2 | Consistency & scope — internal contradictions, over-scoping |
| 3 | Clarity & YAGNI — ambiguous requirements, unrequested features |

**Token-efficient dispatch — always apply:**

- **Escalate-on-finding (D1).** Pass 1 runs standalone first. If it returns **zero findings** AND its output enumerates every checklist item it actually scanned, passes 2 & 3 are **skipped**. Otherwise fix and run 2 & 3 concurrently.
- **Delta review (D2).** Pass 2 receives only the sections changed after Pass 1's fix plus a diff summary — Consistency & scope fires locally. Pass 3 receives the **full document** — Clarity & YAGNI needs global coherence.
- **Findings-only output (D3).** Reviewer prompts must specify: no summaries, no positive commentary, no meta. Output schema `{findings: [{lens, severity, section, summary, fix}]}` — an empty array means approve.

### Rule 2 — Delegate requirements-gathering to `mattpocock-skills:grilling`

Whenever brainstorming needs clarifying questions from the user, the interview loop is delegated to [`mattpocock-skills:grilling`](https://github.com/mattpocock/skills/blob/main/skills/productivity/grilling/SKILL.md). This **replaces** any upstream batch-of-questions / questionnaire pattern. Its rules live in that skill — do not re-implement here.

1. Invoke it directly via the Skill tool the moment discovery starts.
2. If it fails to load, fall back to executing its discipline inline: one question per turn, each with a recommended answer, walk the decision tree, look up facts in the codebase rather than asking. Never batch questions under any fallback.
3. Do not draft the spec, dispatch executors, or start Rule 1's passes until shared understanding is confirmed.

<!-- Additional rules for the brainstorming skill go below as Rule 3, Rule 4, … -->

## Red Flags — STOP if you catch yourself thinking any of these

- "Pass 1 was clean but I'll run 2 & 3 anyway to be safe."
- "Skipping a pass to save time."
- "Pass 2 needs to reread the whole doc."
- "The reviewer's positive commentary is signal, keep it."
- "I'll ask the clarifying questions inline instead of invoking `mattpocock-skills:grilling`."
- "I'll batch questions in the fallback — the user won't notice."

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "Spec is trivial" | Trivial specs still hide placeholders. Pass 1 catches them; if clean, done. |
| "Passes 2 and 3 always find something" | If they do, D1 correctly runs them. If they don't, they cost 4N tokens for nothing. |
| "I can gather requirements faster myself than through grilling" | Faster for you, not the user. Invoke the skill. |
