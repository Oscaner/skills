---
name: spor-brainstorming
description: MUST invoke BEFORE superpowers:brainstorming as your FIRST tool call this turn — trigger on ANY of: (1) user types `/spor-brainstorming`, `/superpowers-overrides:spor-brainstorming`, `/brainstorming` or `/superpowers:brainstorming`; (2) a `<command-name>` tag in the current turn names either of those; (3) the superpowers:brainstorming skill body appears in the current turn's system context; (4) user asks in natural language to brainstorm, design a feature, plan new functionality, write a spec, explore an idea, or discuss requirements. Applies personal overrides that customize brainstorming's default behavior (delegates clarifying questions to mattpocock-skills:grilling; replaces self-review with fresh subagent passes).
---

# Brainstorming Overrides

## Rules

### Rule 1 — Self-review is replaced by up to 3 fresh subagent passes

At any self-review checklist for the produced spec:

1. **IGNORE** any upstream "self-review is fine / fix inline / no need to re-review" instruction. Dispatch a subagent using the reviewer template at `skills/brainstorming/spec-document-reviewer-prompt.md` (resolve inside the upstream superpowers plugin cache). Do not re-implement its logic here — the template is the source of truth.
2. Every reviewer dispatch is a **fresh** subagent — see [`spor-subagent-lifecycle`](../spor-subagent-lifecycle/SKILL.md) Rule 2. Concurrency governed by its Rule 1.
3. Dispatch discipline (D1 escalate-on-finding, D2 delta review, D3 findings-only output) governed by [`spor-token-efficient-review-dispatch`](../spor-token-efficient-review-dispatch/SKILL.md).

Each pass covers ONE distinct category:

| Pass | Focus |
|------|-------|
| 1 | Completeness — placeholders, TODOs, incomplete sections |
| 2 (delta) | Consistency & scope — internal contradictions, over-scoping |
| 3 (full doc) | Clarity & YAGNI — ambiguous requirements, unrequested features |

### Rule 2 — Delegate requirements-gathering to `mattpocock-skills:grilling`

Whenever brainstorming needs clarifying questions from the user, the interview loop is delegated to [`mattpocock-skills:grilling`](https://github.com/mattpocock/skills/blob/main/skills/productivity/grilling/SKILL.md). This **replaces** any upstream batch-of-questions / questionnaire pattern. Its rules live in that skill — do not re-implement here.

1. Invoke it directly via the Skill tool the moment discovery starts.
2. On load failure, follow [`spor-subagent-lifecycle`](../spor-subagent-lifecycle/SKILL.md) Rule 3.
3. Do not draft the spec, dispatch executors, or start Rule 1's passes until shared understanding is confirmed.

### Rule 3 — Large requirements: overall spec first, then phased brainstorming

Before producing an overall or phase spec, Read `plugins/superpowers-overrides/skills/spor-brainstorming/overall-phase-spec-template.md` — it is the source of truth for document structure, serial execution rules, completion signals, and dynamic decomposition. Do not re-implement its conventions from memory.

**Escape hatch:** If the user has explicitly stated the scope is small before `grilling` begins — e.g. "这是小改动 / 就这一处 / scope 很小 / it's a minor change" — Rule 3 does NOT trigger. Proceed directly with a single-phase spec.

When the request is a **large / multi-phase requirement** (any of: touches ≥3 distinct subsystems; spans multiple user-facing capabilities; the user says "整个系统 / 大功能 / 一整套 / overhaul / redesign / 分几期 / roadmap"; or Rule 2's `grilling` interview reveals ≥2 independent capability clusters), follow the overall-phase-spec-template:

1. **Produce an overall spec first.** Scope-only — no per-feature requirements, no acceptance criteria.
2. **Run Rule 1's review passes on the overall** before any phase brainstorming starts.
3. **Get explicit user approval on the phase decomposition.** Silence is not approval.
4. **Take one phase at a time: spec → plan → development → shipped** before starting the next phase's brainstorming. Never pre-draft phase N+1 while N is in flight.
5. **Recursive decomposition in-place.** Never create a sub-overall file. Expand the too-large phase in the overall's table into sub-phases, re-run Step 3.

<!-- Additional rules for the brainstorming skill go below as Rule 4, Rule 5, … -->

## Red Flags — STOP if you catch yourself thinking any of these

- "I'll ask the clarifying questions inline instead of invoking `mattpocock-skills:grilling`."
- "grilling failed to load, I'll paraphrase its one-question-at-a-time rule from memory and keep going."
- "This large requirement is clear enough — I'll skip the overall and go straight to per-feature specs."
- "I'll write the overall AND phase 1 spec in one pass to save a round-trip."
- "User didn't reply to the decomposition-approval question, but silence probably means yes."
- "Phase N is in executing-plans, I can start drafting phase N+1's spec in parallel to save wall time."

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "I can gather requirements faster myself than through grilling" | Faster for you, not the user. Invoke the skill. |
| "grilling feels synchronous and slow" | One-question-at-a-time aligns understanding before drafting. The alternative is rework. |
| "Requirement is large but I already see the phases, overall is ceremony" | The overall isn't for you — it's the artifact the user approves before per-phase drafting starts. Skipping it means phase 2's `grilling` may invalidate phase 1's spec. |
| "Phases look independent so I'll brainstorm them concurrently" | "Look independent" ≠ are independent. Phase N's spec routinely reveals a constraint that reshapes phase N+1's scope. Serial is the point. |
| "User is technical, they'll infer approval from my continuing" | Silence is not approval for a scope-shaping decision. Ask, wait for an affirmative answer. |
| "Phase N revealed a scope shift for N+1, I'll remember it" | Memory across a multi-week phased program is not reliable. Write it to N+1's `Notes` immediately; if the decomposition itself moved, re-run Step 3. |
| "Phase N is shipping, I can pre-draft N+1's spec now for speed" | The whole reason to phase is that shipped outcomes reshape later scope. Pre-drafting freezes assumptions before the evidence lands. |
| "Phase turned out too big but I've already started — pushing through is faster than restarting" | A too-large phase produces a diffuse spec, a diffuse plan, and rework. Stop, decompose under Step 5. Sunk cost isn't a reason to keep going. |
| "A sub-overall file is cleaner than editing the overall in place" | Cleaner for the writer, worse for every future reader. Deep overall trees hide the source of truth and split status across files. One program = one overall. |
| "Batching Phase Status / Change History at end of day is cleaner" | The overall is the source of truth *while* the program is in flight, and the log captures reasons while they're fresh. Batching loses both. Update per-transition. |
| "This edit is trivial, Change History would be noise" | Status transitions and decomposition edits are never trivial — they change the plan of record. Only pure prose typo fixes skip the log. |
| "Change History is messy, I'll clean it up" | Append-only. If an entry was wrong, append a correction — don't edit the old one. |
