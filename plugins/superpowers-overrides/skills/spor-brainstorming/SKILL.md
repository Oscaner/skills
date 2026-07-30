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

Before producing an overall or phase spec, Read `plugins/superpowers-overrides/skills/spor-brainstorming/overall-phase-spec-template.md` for **document structure**, file paths, and language. Process discipline is Rule 3 steps and sub-rules 3a–3e below. Do not re-implement from memory.

**Escape hatch:** If the user has explicitly stated the scope is small before `grilling` begins — e.g. "这是小改动 / 就这一处 / scope 很小 / it's a minor change" — Rule 3 does NOT trigger. Proceed directly with a single-phase spec.

When the request is a **large / multi-phase requirement** (any of: touches ≥3 distinct subsystems; spans multiple user-facing capabilities; the user says "整个系统 / 大功能 / 一整套 / overhaul / redesign / 分几期 / roadmap"; or Rule 2's `grilling` interview reveals ≥2 independent capability clusters):

1. **Produce an overall spec first** (template Overall sections). Scope-only — no per-feature requirements, no acceptance criteria.
2. **Run Rule 1's review passes on the overall** before any phase brainstorming. Same passes on **each phase spec** before writing-plans.
3. **Get explicit user approval on the phase decomposition.** Silence is not approval.
4. **For each phase, run Rule 3a** (independent cycle) and **Rule 3b** (feed back deviations) before finalizing that phase's spec.
5. **Follow Rule 3c** for serial/parallel boundaries. Never pre-draft a dependent phase while upstream is in flight.
6. **Rule 3d** if a phase is too large; **Rule 3e** when a phase ships.

#### Rule 3a — Independent phase brainstorming

Each phase is a **new session** — overall inventory text is decomposition context, not a substitute for discovery.

| Step | Requirement |
|---|---|
| Context | Re-read overall + inspect shipped upstream deliverables |
| Discovery | Phase-scoped `grilling` — mandatory even if overall covered related topics |
| Approaches | Fresh 2–3 options for this phase |
| Design approval | Explicit user approval before writing the phase spec |
| Spec + review | Write per template → Rule 1 → user review → writing-plans |

**Forbidden:** copying the inventory paragraph into the spec; skipping grilling; drafting multiple phase specs in one pass; inferring phase approval from overall approval.

#### Rule 3b — Feed back deviations to overall

When phase brainstorming changes cross-cutting constraints, non-goals, inventory scope text, dependency graph, or later-phase assumptions:

1. **Pause** phase spec finalization.
2. **Edit the overall** + bump version; **append change history** (phase ID, what, why).
3. **User approval** for material strategy/scope shifts (same bar as step 3). Local-only choices skip overall edit.
4. **Resume** — record in phase spec **Deviations from overall** with updated overall version link.
5. **Then** Rule 1 and user review on the phase spec.

Do not bury cross-phase strategy shifts only in the phase spec.

#### Rule 3c — Serial execution and parallel phases

**Serial:** Phase N spec → plan → dev must **all ship** before brainstorming any phase that depends on N.

**Parallel:** Phases sharing the same upstream and with **no dependency on each other** may run in parallel once upstream is shipped (dependency graph is source of truth).

Do not pre-draft a phase spec while an upstream dependency is still in development.

#### Rule 3d — Dynamic in-place decomposition

When a phase is too large: split the row into Na, Nb, … in the overall table; update the dependency graph; re-run step 3 approval; record in change history. Never create a sub-overall. Each sub-phase: ≤1 new tech stack; independently demo-able.

#### Rule 3e — Completion signal

**Preferred:** git tag `<slug>-complete` (e.g. `auth-p0-complete`). **If tags forbidden:** immutable ref (release SHA, milestone issue) in change history.

Then: localized completion marker on overall inventory **plan** cell; change-history row with deliverables; bump overall version if applicable.

<!-- Additional rules for the brainstorming skill go below as Rule 4, Rule 5, … -->

## Red Flags — STOP if you catch yourself thinking any of these

- "I'll ask the clarifying questions inline instead of invoking `mattpocock-skills:grilling`."
- "grilling failed to load, I'll paraphrase its one-question-at-a-time rule from memory and keep going."
- "This large requirement is clear enough — I'll skip the overall and go straight to per-feature specs."
- "I'll write the overall AND phase 1 spec in one pass to save a round-trip."
- "User didn't reply to the decomposition-approval question, but silence probably means yes."
- "Phase N is in executing-plans, I can start drafting phase N+1's spec in parallel to save wall time."
- "The overall already covered phase N — I'll skip grilling and expand the inventory paragraph into the spec."
- "Phase N picked a different architecture — I'll document it in the phase spec only; overall can stay as-is."

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "I can gather requirements faster myself than through grilling" | Faster for you, not the user. Invoke the skill. |
| "grilling feels synchronous and slow" | One-question-at-a-time aligns understanding before drafting. The alternative is rework. |
| "Requirement is large but I already see the phases, overall is ceremony" | The overall isn't for you — it's the artifact the user approves before per-phase drafting starts. Skipping it means phase 2's `grilling` may invalidate phase 1's spec. |
| "Phases look independent so I'll brainstorm them concurrently" | Check the dependency graph. Parallel is allowed only when phases share upstream and don't depend on each other — not because they "look" independent. |
| "User is technical, they'll infer approval from my continuing" | Silence is not approval for a scope-shaping decision. Ask, wait for an affirmative answer. |
| "Phase N revealed a scope shift for N+1, I'll remember it" | Write it to the phase spec's **Notes for downstream phases** immediately; if decomposition moved, re-run step 3. |
| "Phase N is shipping, I can pre-draft N+1's spec now for speed" | Shipped outcomes reshape later scope. Pre-drafting freezes assumptions before evidence lands. |
| "Phase turned out too big but I've already started — pushing through is faster than restarting" | Stop, decompose under Rule 3d. Sunk cost isn't a reason to keep going. |
| "A sub-overall file is cleaner than editing the overall in place" | One program = one overall. Deep trees hide the source of truth. |
| "Batching Phase Status / Change History at end of day is cleaner" | Update per-transition while reasons are fresh. |
| "This edit is trivial, Change History would be noise" | Status transitions and decomposition edits are never trivial. Only pure typo fixes skip the log. |
| "Change History is messy, I'll clean it up" | Append-only. Append a correction — don't edit old rows. |
| "Overall grilling already asked about phase N" | Overall decomposes; it does not design phase N. Each phase needs its own grilling, approaches, and approval. |
| "Updating overall mid-program is churn" | Stale overall misleads every later phase. Feed back under Rule 3b; change history captures why. |
