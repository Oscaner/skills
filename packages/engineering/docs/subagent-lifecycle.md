# Subagent Lifecycle

Cross-cutting reference: cited by review-pass rules in os-* skills.

## Rules

### Rule: Fresh Subagent Per Pass

Each review pass dispatches a fresh subagent; no reuse of a prior pass's agent. Reason: prevents the reviewer from being anchored by the previous round's output.

### Rule: Concurrent iff Independent

Multiple passes run concurrently only when mutually independent (no data dependency — i.e., they do not read a prior pass's output). When dependencies exist, run serially.

### Rule: Delegate Load Failure

When delegating to `mattpocock-skills:*` fails: target skill cannot be resolved/loaded → report the error to the user and ask for next steps (do not silently skip the delegation); entire plugin is missing → silent degradation (that delegation step is skipped, the flow continues, the result is annotated as "not delegated"). Cited by delegation rules in os-debugging (→ diagnosing-bugs), os-code-review (→ grilling/tdd), os-writing-plans (→ to-tickets), os-brainstorming (→ grilling).

## Red Flags

- "Reuse the previous reviewer, context is warm" → a fresh subagent is the balance between token efficiency and objectivity (Rule: Fresh Subagent Per Pass)
