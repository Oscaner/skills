---
name: dispatching-parallel-agents-overrides
description: MUST invoke BEFORE superpowers:dispatching-parallel-agents as your FIRST tool call this turn — trigger on ANY of: (1) user types `/dispatching-parallel-agents` or `/superpowers:dispatching-parallel-agents`; (2) a `<command-name>` tag in the current turn names either of those; (3) the superpowers:dispatching-parallel-agents skill body appears in the current turn's system context; (4) user asks in natural language to dispatch multiple agents in parallel, fan out concurrent subagents, or parallelize independent investigations. Applies personal override — routes concurrency + freshness discipline to `subagent-lifecycle` and `token-efficient-review-dispatch` (both cross-cutting), so the same invariants govern every subagent dispatch regardless of entry point.
---

# Dispatching-Parallel-Agents Overrides

## Rules

### Rule 1 — Delegate concurrency + freshness discipline to cross-cutting skills

Upstream describes the pattern (identify independent domains → craft focused prompts → dispatch in parallel → review and integrate). That's a good process framing. The **discipline** it leaves unopinionated — when concurrency is legal, when to reuse vs re-dispatch a subagent, how output should be structured — is covered by two cross-cutting skills already in this plugin.

**Route to:**

- [`subagent-lifecycle`](../subagent-lifecycle/SKILL.md) — Rule 1 (concurrent iff independent, where independent = **no data dependency**, not merely "different categories") and Rule 2 (**fresh** subagent per task / pass / round, never reuse).
- [`token-efficient-review-dispatch`](../token-efficient-review-dispatch/SKILL.md) — for any dispatch that's a **review** rather than an implementation/investigation, apply D1 escalate-on-finding, D2 delta review, D3 findings-only output.

Upstream's L20-33 decision graph ("Are they independent? → Can they work in parallel?") is compatible with `subagent-lifecycle` Rule 1 but weaker on what "independent" means. When both are in context, `subagent-lifecycle`'s definition wins — it names the failure mode ("independent = different categories" is the bug being guarded against).

### Rule 2 — Upstream's prompt-crafting guidance still applies

`subagent-lifecycle` covers lifecycle (fresh/concurrent). It does NOT cover prompt content. Upstream's Section "Agent Prompt Structure" (L84-110) — focused scope, self-contained context, specific output expectation, explicit constraints — remains the source of truth for **what to put in the prompt**. Do not skip that section under the delegation.

Practical form: follow upstream L84-110 for prompt content, follow `subagent-lifecycle` for dispatch discipline, follow `token-efficient-review-dispatch` for review-specific output schema.

<!-- Additional rules for the dispatching-parallel-agents skill go below as Rule 3, Rule 4, … -->

## Red Flags — STOP if you catch yourself thinking any of these

- "Upstream says 'independent = different problem domains', so I can dispatch concurrently even if agent 2 reads agent 1's output."
- "Reusing the same subagent across two related tasks saves tokens."
- "Two agents are dispatching to different files — clearly independent, no need to check for shared state."
- "This is a review dispatch, but D1/D2/D3 apply only inside review-pass overrides, not here."

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "Upstream's decision graph already says 'independent → parallel'" | `subagent-lifecycle` refines the definition of independent: no data dependency, not merely different categories. When both are in context, the refinement wins. |
| "Prompt structure and dispatch discipline are the same thing" | Different concerns. Prompt structure = what goes in. Dispatch discipline = how many, in what order, reused or fresh. Upstream owns the first; the cross-cutting skills own the second. |
| "Review dispatches aren't 'parallel-agents' cases" | They are. A 3-pass review with two dispatched concurrently IS a parallel-agent scenario. D1/D2/D3 apply. |
