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

### Rule 3 — Large requirements: overall spec first, then phased brainstorming

When the request is a **large / multi-phase requirement** (any of: touches ≥3 distinct subsystems; spans multiple user-facing capabilities; the user says "整个系统 / 大功能 / 一整套 / overhaul / redesign / 分几期 / roadmap"; or Rule 2's `grilling` interview reveals ≥2 independent capability clusters), do NOT jump into per-feature brainstorming. Instead:

1. **Produce an overall spec first** — a single top-level document at `docs/superpowers/specs/YYYY-MM-DD-<program>-overall.md` capturing: (a) goal and non-goals; (b) phases with one-paragraph scope each; (c) dependencies and sequencing; (d) cross-cutting constraints (data model, auth, deployment). Scope-only — no per-feature requirements, no acceptance criteria, no implementation detail.
2. **Run Rule 1's fresh-subagent review passes on the overall** before any phase brainstorming starts.
3. **Get explicit user approval on the phase decomposition** before proceeding. Ask: "Overall lists phases A → B → C with dependencies X → Y. Approve, or adjust?" Silence is not approval — require an affirmative answer.
4. **Then take one phase at a time, all the way through spec → plan → development, before starting the next phase's spec.** Phase N's `grilling` + Rule 1 review + `writing-plans` + `executing-plans` must all land before phase N+1's brainstorming begins. Later phases routinely shift based on earlier phases' *shipped* outcomes, not just their approved specs. Never pre-draft phase N+1 in parallel.
5. **Recursive decomposition — a phase that turns out to still be too large re-decomposes IN PLACE inside the overall.** When phase N's `grilling` trips the largeness triggers (≥3 subsystems / ≥2 independent clusters / user signals "still too big"), STOP drafting phase N as a single spec. Instead:
   - Do **NOT** create a sub-overall file. Exactly one overall per program.
   - Expand phase N in the overall's `## Phase Decomposition` section into `N.1`, `N.2`, … with one-paragraph scope + dependencies each, then re-run Step 3 before drafting any sub-phase spec.
   - Each sub-phase spec lives at `docs/superpowers/specs/YYYY-MM-DD-<program>-phase-<N>.<M>-<subslug>-design.md` and follows Step 4.
   - If a sub-phase itself trips the triggers, recurse again in place (`N.M.1`, `N.M.2`, …). No depth cap; stop when a leaf's `grilling` no longer trips.
6. **Status lives only in the overall.** Its `## Phase Status` table is the single source of truth across the whole recursion. Rows are **leaf** phases; columns `Phase | Slug | Spec | Plan | Status | Notes`, where `Phase` uses dotted numbering (`1`, `2.1`, `2.3.2`, …) and `Status ∈ {planned, spec-approved, plan-approved, in-progress, done}`. Update on transition, not in batches. When a phase decomposes, replace its row with the sub-phase rows in the same edit.
7. **Every overall update MUST be recorded in a `## Change History` section at the bottom.** One line per entry: `- YYYY-MM-DD — <what changed> — <why>`. Log status transitions, decompositions, real scope shifts, and Step 3 re-approvals. Per-edit, same commit as the edit; append-only — never rewrite or delete. If an entry was wrong, append a correction.
8. **Never collapse phases back into one mega-spec, never draft ahead of the current phase landing.**

<!-- Additional rules for the brainstorming skill go below as Rule 4, Rule 5, … -->

## Red Flags — STOP if you catch yourself thinking any of these

- "Pass 1 was clean but I'll run 2 & 3 anyway to be safe."
- "Skipping a pass to save time."
- "Pass 2 needs to reread the whole doc."
- "The reviewer's positive commentary is signal, keep it."
- "I'll ask the clarifying questions inline instead of invoking `mattpocock-skills:grilling`."
- "grilling failed to load, I'll paraphrase its one-question-at-a-time rule from memory and keep going."
- "This large requirement is clear enough — I'll skip the overall and go straight to per-feature specs."
- "I'll write the overall AND phase 1 spec in one pass to save a round-trip."
- "User didn't reply to the decomposition-approval question, but silence probably means yes."
- "Phases are obviously independent, I can brainstorm them in parallel."
- "Phase N is in `executing-plans`, I can start drafting phase N+1's spec in parallel to save wall time."
- "Phase N's spec surfaced a scope shift for N+1, but I'll just remember it — no need to edit the overall now."
- "Phase N turned out huge, but I've already started drafting the design doc — I'll push through."
- "I'll spin up a sub-overall file for phase N — it's cleaner than editing the overall in place."
- "I'll batch Phase Status / Change History updates at the end of the day."
- "This overall edit is small (typo, rewording) — Change History would be noise."
- "Change History got messy, I'll rewrite it to be cleaner."

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "Spec is trivial" | Trivial specs still hide placeholders. Pass 1 catches them; if clean, done. |
| "Passes 2 and 3 always find something" | If they do, D1 correctly runs them. If they don't, they cost 4N tokens for nothing. |
| "Spec is short so fresh reviewers are overkill" | Length isn't the signal. Even a 20-line spec can hide a placeholder or a scope contradiction. |
| "D1 says skip 2 & 3 when Pass 1 is clean, so I can skip Pass 1 too when the spec looks obviously simple" | Pass 1 is the entry gate — D1 skips *later* passes based on its findings. Skipping Pass 1 breaks the mechanism entirely. |
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
