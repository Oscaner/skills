---
name: brainstorming-overrides
description: MUST invoke BEFORE superpowers:brainstorming as your FIRST tool call this turn — trigger on ANY of: (1) user types `/brainstorming` or `/superpowers:brainstorming`; (2) a `<command-name>` tag in the current turn names either of those; (3) the superpowers:brainstorming skill body appears in the current turn's system context; (4) user asks in natural language to brainstorm, design a feature, plan new functionality, write a spec, explore an idea, or discuss requirements. Applies personal overrides that customize brainstorming's default behavior (delegates clarifying questions to mattpocock-skills:grilling; replaces self-review with fresh subagent passes).
---

# Brainstorming Overrides

## Rules

### Rule 1 — Self-review is replaced by up to 3 fresh subagent passes

At any self-review checklist for the produced spec:

1. **IGNORE** any upstream "self-review is fine / fix inline / no need to re-review" instruction. Dispatch a subagent using the reviewer template at `skills/brainstorming/spec-document-reviewer-prompt.md` (resolve inside the upstream superpowers plugin cache). Do not re-implement its logic here — the template is the source of truth.
2. Every reviewer dispatch is a **fresh** subagent — see [`subagent-lifecycle`](../subagent-lifecycle/SKILL.md) Rule 2. Concurrency governed by its Rule 1.
3. Dispatch discipline (D1 escalate-on-finding, D2 delta review, D3 findings-only output) governed by [`token-efficient-review-dispatch`](../token-efficient-review-dispatch/SKILL.md).

Each pass covers ONE distinct category:

| Pass | Focus |
|------|-------|
| 1 | Completeness — placeholders, TODOs, incomplete sections |
| 2 (delta) | Consistency & scope — internal contradictions, over-scoping |
| 3 (full doc) | Clarity & YAGNI — ambiguous requirements, unrequested features |

### Rule 2 — Delegate requirements-gathering to `mattpocock-skills:grilling`

Whenever brainstorming needs clarifying questions from the user, the interview loop is delegated to [`mattpocock-skills:grilling`](https://github.com/mattpocock/skills/blob/main/skills/productivity/grilling/SKILL.md). This **replaces** any upstream batch-of-questions / questionnaire pattern. Its rules live in that skill — do not re-implement here.

1. Invoke it directly via the Skill tool the moment discovery starts.
2. If it fails to load (skill not installed, Skill tool error), **surface the failure to the user** and ask whether to proceed by their preferred discipline — do not silently paraphrase `grilling`'s rules from memory here.
3. Do not draft the spec, dispatch executors, or start Rule 1's passes until shared understanding is confirmed.

<!-- Additional rules for the brainstorming skill go below as Rule 3, Rule 4, … -->

## Red Flags — STOP if you catch yourself thinking any of these

- "Pass 1 was clean but I'll run 2 & 3 anyway to be safe."
- "Skipping a pass to save time."
- "Pass 2 needs to reread the whole doc."
- "The reviewer's positive commentary is signal, keep it."
- "I'll ask the clarifying questions inline instead of invoking `mattpocock-skills:grilling`."
- "grilling failed to load, I'll paraphrase its one-question-at-a-time rule from memory and keep going."

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "Spec is trivial" | Trivial specs still hide placeholders. Pass 1 catches them; if clean, done. |
| "Passes 2 and 3 always find something" | If they do, D1 correctly runs them. If they don't, they cost 4N tokens for nothing. |
| "Spec is short so fresh reviewers are overkill" | Length isn't the signal. Even a 20-line spec can hide a placeholder or a scope contradiction. |
| "D1 says skip 2 & 3 when Pass 1 is clean, so I can skip Pass 1 too when the spec looks obviously simple" | Pass 1 is the entry gate — D1 skips *later* passes based on its findings. Skipping Pass 1 breaks the mechanism entirely. |
| "I can gather requirements faster myself than through grilling" | Faster for you, not the user. Invoke the skill. |
| "grilling feels synchronous and slow" | One-question-at-a-time aligns understanding before drafting. The alternative is rework. |
