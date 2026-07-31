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

Read `plugins/superpowers-overrides/skills/spor-brainstorming/overall-phase-spec-template.md` for **document structure**, paths, and language. Process discipline is below. Do not re-implement from memory.

**Escape hatch:** User stated scope is small before `grilling` — e.g. "小改动 / scope 很小 / minor change" — skip Rule 3; single-phase spec.

**Triggers:** ≥3 subsystems; multiple user-facing capabilities; user says 整个系统 / 大功能 / overhaul / 分几期 / roadmap; or `grilling` reveals ≥2 independent capability clusters.

#### Program flow

```
Overall: grilling → decomposition → approval → write overall → Rule 1 → user review
         └─ GATE (step 4): stop; wait for explicit "start Pn" — do NOT propose phase spec in same plan

Per phase (after gate cleared for that phase):
  Rule 3a: independent grilling → approaches → design approval → write phase spec → Rule 1 → user review
  Rule 3b: if strategy/decomposition shifts → update overall FIRST (same turn), then resume
  → writing-plans → dev → Rule 3e ship → next phase
```

**Three invariants (dogfooding):**

| # | Invariant | Violation looks like |
|---|-----------|----------------------|
| 1 | **Overall gate** — decomposition approval ≠ phase brainstorming started | "Next: write overall → write P0 spec → review" in one plan |
| 2 | **Independent phase cycle** — inventory paragraph is context, not the spec | Skip phase grilling; expand inventory row into phase spec |
| 3 | **Overall = plan of record** — feed back before continuing | P0→P0a/P0b decided in chat; overall still shows P0; grilling continues under P0 |

#### Steps

1. Write **overall spec** (scope-only — no acceptance criteria). Template Overall sections.
2. **Rule 1** on overall. Same on each phase spec before writing-plans.
3. **Explicit approval** on decomposition. Silence ≠ approval.
4. **GATE — stop.** No phase brainstorming, no phase spec paths, no bundled next steps. Wait for user to start a phase.
5. **Per phase** (gate cleared): Rule 3a + 3b → Rule 3c boundaries → 3d if split needed → 3e on ship.

#### Rule 3a — Independent phase brainstorming

**Start only when:** overall reviewed, decomposition approved, user explicitly started **this** phase (e.g. "开始 P0").

| Step | Requirement |
|---|---|
| Context | Re-read overall + shipped upstream deliverables |
| Discovery | Phase-scoped `grilling` — mandatory even if overall covered the topic |
| Approaches | Fresh 2–3 options for this phase |
| Design approval | Explicit user approval before writing spec |
| Spec + review | Template → Rule 1 → user review → writing-plans |

#### Rule 3b — Feed back to overall (includes sub-phase splits)

**When:** cross-cutting constraints, non-goals, inventory scope, dependency graph, later-phase assumptions change — **or a phase splits** (P0 → P0a/P0b, including during grilling or approach selection).

**Same turn, before continuing phase work:**

1. **Stop** — no more grilling, approaches, spec paths, or sub-phase IDs until overall is updated.
2. **Edit overall** — inventory + dependency graph + version bump + change history (phase ID, what, why).
3. **User approval** on splits and material shifts (re-run step 3). Local-only choices skip overall edit.
4. **Resume** first sub-phase only (P0a, not P0) → Rule 3a → phase spec **Deviations from overall** if applicable → Rule 1.

Chat and phase specs are not substitutes for updating overall.

#### Rule 3c — Serial and parallel

- **Serial:** N must fully ship before brainstorming any phase depending on N.
- **Parallel:** same upstream, no mutual dependency → may run in parallel after upstream ships (graph is truth).
- Never pre-draft while upstream is in development.

#### Rule 3d — In-place decomposition

Subset of Rule 3b — never a sub-overall. Split parent row → Na, Nb; ≤1 new stack per sub-phase; each independently demo-able. **3b steps apply the moment the split is decided**, not when the spec is written.

#### Rule 3e — Completion

Git tag `<slug>-complete` (or immutable ref if tags forbidden) → completion marker on overall plan cell → change history → bump overall version.

<!-- Additional rules for the brainstorming skill go below as Rule 4, Rule 5, … -->

## Red Flags

- Skip `grilling` (inline questions, paraphrase on load failure, or "overall already covered this").
- Skip overall for large requirements, or bundle overall + phase spec in one pass/plan.
- Treat decomposition approval or overall § conversation as permission to start P0.
- Continue under parent phase ID after deciding P0→P0a/P0b; patch overall later.
- Record cross-phase strategy changes only in phase spec or chat — not in overall.
- Pre-draft dependent phases; infer approval from silence or user being technical.

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "Listing overall → P0 → review is just ordering" | Invariant 1: gate exists between overall and phase cycles. |
| "Overall grilling already asked about P0" | Invariant 2: overall decomposes; phase needs its own cycle. |
| "I'll sync P0a/P0b to overall when I write the spec" | Invariant 3: inventory updates in the same turn as the split decision. |
| "Updating overall mid-program is churn" | Stale overall misleads every later phase; change history captures why. |
| "Phases look independent — brainstorm concurrently" | Check dependency graph; parallel only when graph allows. |
| "Phase too big but I'm mid-grilling — push through" | Stop; Rule 3b/3d before the next question. |
| "Sub-overall file is cleaner" | One program = one overall. |
| "Batch change history later" | Append per-transition while reasons are fresh. |
