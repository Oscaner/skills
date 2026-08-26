# Subagent Lifecycle

Cross-cutting reference: cited by review-pass rules in osuperpowers skills.

## Rules

### Rule: Fresh Subagent Per Pass

Each review pass dispatches a fresh subagent; no reuse of a prior pass's agent. Reason: prevents the reviewer from being anchored by the previous round's output.

### Rule: Concurrent iff Independent

Multiple passes run concurrently only when mutually independent (no data dependency — i.e., they do not read a prior pass's output). When dependencies exist, run serially.

### Rule: Delegate Load Failure

When delegating to a sub-skill (`mattpocock-skills:*` or any skill referenced in Read Sub-Skills) fails: target skill cannot be resolved/loaded → report the error to the user and ask for next steps. All failure scenarios behave identically — no silent degradation. The user can decide to skip the delegation or abort the flow. Cited by delegation rules in receiving-code-review (→ grilling/tdd), writing-plans (→ to-tickets), brainstorming (→ grilling).

## Red Flags

- "Reuse the previous reviewer, context is warm" → a fresh subagent is the balance between token efficiency and objectivity (Rule: Fresh Subagent Per Pass)
