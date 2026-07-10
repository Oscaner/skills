---
name: subagent-lifecycle
description: Cross-cutting policy invoked by reference from other override skills (brainstorming-overrides, writing-plans-overrides, subagent-driven-development-overrides), not directly by the user. No slash command. Governs concurrent-vs-serial dispatch of Agent/subagent calls, and forbids reusing a subagent across tasks or review passes. Referencing overrides cite this skill's Rule 1 and Rule 2 rather than repeating them.
---

# Subagent Lifecycle

## Rules

### Rule 1 — Concurrent vs serial dispatch

When dispatching multiple review or worker subagents (e.g. 3-pass reviews):

| Situation | Mode |
|-----------|------|
| Passes are independent (different categories, no shared state, no ordering dependency on prior fixes) | **Concurrent** |
| Pass N depends on findings/fixes from pass N-1, or reads the output of pass N-1 as input | **Serial** |

Default to concurrent when in doubt about independence — but only if the passes truly don't share state. "Independent categories" alone is not enough; check whether Pass N would look at Pass N-1's fixed version.

### Rule 2 — Never reuse a subagent

Every task, every review pass, every round within a stage = a **fresh** subagent. Never reuse across any of those boundaries.

<!-- Additional lifecycle rules go below as Rule 3, Rule 4, … -->

## Red Flags — STOP if you catch yourself thinking any of these

- "Let me ask the same reviewer to also check X."
- "Pass 2 builds on pass 1's mindset, reuse the same agent."
- "Both passes are review passes so they're independent — dispatch concurrent."
- "Pass 2 reviews the fix from Pass 1, but I'll still dispatch concurrent since the categories differ."

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "Fresh dispatches lose context" | That's the point. Fresh eyes catch what stale eyes miss. |
| "Reusing saves tokens" | False economy — a stale subagent misses defects. |
| "Concurrent is always faster" | Only when passes are independent. Otherwise serial. |
| "Independent = different categories" | Independent = no data dependency. Pass 2 reading Pass 1's fixed output is a data dependency, regardless of what category each covers. |
