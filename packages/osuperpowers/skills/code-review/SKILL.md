---
name: code-review
description: Independent review feedback orchestrator -- Reads upstream superpowers:receiving-code-review as baseline, layers personal rules (grilling clarification / tdd delegation). Optionally invokes cli-code-review to dispatch reviews.
---

# Osuperpowers Code Review

Process review feedback: verify evidence, reject performative agreement.

## Rules

### Rule: Read Upstream

Read upstream `superpowers:receiving-code-review` SKILL.md as the process baseline **when available** (resolution priority + unavailability fallback same as [Rule: Read Upstream](../brainstorming/SKILL.md#rule-read-upstream)). **Read, not Skill-invoke**.

### Rule: Understand

Upstream RESPONSE mode's UNDERSTAND step: feedback items unclear -> delegate to `mattpocock-skills:grilling` for clarification, all items must reach consensus before entering VERIFY. Load failure protocol: see [subagent-lifecycle.md](../docs/subagent-lifecycle.md#rule-delegate-load-failure).

### Rule: Implement

IMPLEMENT step: each fix delegates to `mattpocock-skills:tdd` (red-green cycle). Exemption: purely mechanical edits (no behavior/schema/config changes -- renaming, whitespace, comment rearrangement). When in doubt, use TDD. Load failure protocol: see [subagent-lifecycle.md](../docs/subagent-lifecycle.md#rule-delegate-load-failure).

### Rule: Optional CLI Review

When dispatching a review is needed, invoke [cli-code-review](../cli-code-review/SKILL.md) (any diff through the selected harness CLI).

## Red Flags

- "Unclear feedback, guess" -> grilling clarification (Rule: Understand)
