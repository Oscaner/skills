---
name: subagent-lifecycle
description: MUST invoke BEFORE dispatching any Agent/subagent — trigger when about to call the Agent tool, spawn reviewers, run parallel review passes, or coordinate multi-round subagent work. Governs concurrent-vs-serial dispatch and forbids reusing a subagent across tasks or review passes.
---

# Subagent Lifecycle

## Rules

### Rule 1 — Concurrent vs serial dispatch

When dispatching multiple review or worker subagents (e.g. 3-pass reviews):

| Situation | Mode |
|-----------|------|
| Passes are independent (different categories, no shared state) | **Concurrent** |
| Pass N depends on findings/fixes from pass N-1 | **Serial** |

Default to concurrent when in doubt about independence — but only if the passes truly don't share state.

### Rule 2 — Never reuse a subagent

Every task, every review pass, every round within a stage = a **fresh** subagent. Never reuse across any of those boundaries.

<!-- Additional lifecycle rules go below as Rule 3, Rule 4, … -->

## Red Flags — STOP if you catch yourself thinking any of these

- "Let me ask the same reviewer to also check X."
- "Pass 2 builds on pass 1's mindset, reuse the same agent."

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "Fresh dispatches lose context" | That's the point. Fresh eyes catch what stale eyes miss. |
| "Reusing saves tokens" | False economy — a stale subagent misses defects. |
| "Concurrent is always faster" | Only when passes are independent. Otherwise serial. |
