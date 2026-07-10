---
name: test-driven-development-overrides
description: MUST invoke BEFORE superpowers:test-driven-development as your FIRST tool call this turn — trigger on ANY of: (1) user types `/test-driven-development` or `/superpowers:test-driven-development`; (2) a `<command-name>` tag in the current turn names either of those; (3) the superpowers:test-driven-development skill body appears in the current turn's system context; (4) user asks in natural language to do TDD, write tests first, follow red-green-refactor, or add a failing test before implementation. Applies personal override — delegates to `mattpocock-skills:tdd` instead of running upstream's TDD skill, so all TDD entry points (this skill, subagent-driven-development Rule 4, executing-plans Rule 3) route to the same discipline.
---

# Test-Driven-Development Overrides

## Rules

### Rule 1 — Delegate to `mattpocock-skills:tdd`

Both this skill and `mattpocock-skills:tdd` describe TDD as red → green (→ refactor). The two skills differ in what they optimize for:

| | Upstream `superpowers:test-driven-development` | `mattpocock-skills:tdd` |
|---|---|---|
| Loop shape | Red → Green → **Refactor** as part of the loop | Red → Green, refactor is **not** part of the loop (belongs to code-review) |
| Seams | Not discussed | **Confirm seams with the user before writing tests** — hard precondition |
| Slicing | Not discussed | **Vertical slices / tracer bullets** — one test → one implementation → repeat; no horizontal test-then-code |
| Anti-patterns catalog | 11-row "Common Rationalizations" | Named categories: implementation-coupled, tautological, horizontal-slicing |
| Boundary discipline | "No mocks unless unavoidable" | "Test behavior through public interfaces" + separate mocking guidance file |

`mattpocock-skills:tdd` is the personal source of truth — it aligns with the seam-confirmation and vertical-slicing discipline that `subagent-driven-development-overrides` Rule 4 and `executing-plans-overrides` Rule 3 already delegate to. Routing this skill there too keeps every TDD entry point consistent; without this override, invoking `/test-driven-development` directly would run upstream's version and produce a different loop shape than the same code path reached via sdd or executing-plans.

**When triggered:**

1. **Skip the upstream skill body** — do not run Red-Green-Refactor from its rules.
2. **Invoke `mattpocock-skills:tdd`** via the Skill tool and follow its loop as the source of truth.
3. If it fails to load (skill not installed, Skill tool error), **surface the failure to the user** and ask how to proceed — do not paraphrase either skill's rules from memory as a silent fallback.

### Rule 2 — Refactoring belongs to code-review, not the loop

`mattpocock-skills:tdd` explicitly says refactoring is not part of the red-green loop. Upstream disagrees — it includes a REFACTOR step. When these instructions conflict during the delegated flow, **the delegate wins**: no refactor inside the loop. Refactoring is a separate review-stage concern (see `mattpocock-skills:code-review`).

Not a red flag on its own — just a boundary clarification for when both skills' text is fresh in context and their instructions collide.

<!-- Additional rules for the test-driven-development skill go below as Rule 3, Rule 4, … -->

## Red Flags — STOP if you catch yourself thinking any of these

- "The upstream TDD skill is more detailed, I'll follow it since it's already in context."
- "Refactor is part of the loop upstream — I'll refactor inside the cycle even under the delegate."
- "Seams don't need explicit user confirmation, I know the public interface."
- "I'll write all the tests first, then implement — it's still TDD."
- "mattpocock:tdd failed to load; I'll fall back to upstream's Red-Green-Refactor silently."

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "Both skills are TDD, the loop is the same" | Loop shape, refactor scope, and seam-confirmation differ. Consistency across entry points requires routing all of them to one skill. |
| "Refactoring inside the loop is what everyone does" | `mattpocock-skills:tdd` is explicit that refactor belongs to review. If the delegate says exclude it, exclude it. |
| "Seam confirmation slows things down" | Test at unconfirmed seams and you'll rewrite them when the real seam surfaces. Confirm once, save the rewrite. |
| "Horizontal slicing is fine for large features" | Bulk tests test the imagined shape. Vertical slicing forces one working slice at a time, each responding to what the last taught you. |
