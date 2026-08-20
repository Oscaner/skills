---
name: writing-plans
description: Independent plan-writing orchestrator -- Reads upstream superpowers:writing-plans as baseline, layers personal rules (section-by-section writing / cli review passes / to-tickets publish redirect).
---

# Osuperpowers Writing-Plans

Full plan-writing flow orchestration, callable standalone.

## Rules

### Rule: Read Upstream

Read upstream `superpowers:writing-plans` SKILL.md as the process baseline **when available** (resolution priority + unavailability fallback same as [Rule: Read Upstream](../brainstorming/SKILL.md#rule-read-upstream)). **Read, not Skill-invoke**.

### Rule: Read Sub-Skills

On demand, Read `mattpocock-skills` `skills/engineering/to-tickets/SKILL.md` (ticket splitting Steps 1-4). Load failure protocol: see [subagent-lifecycle.md](../docs/subagent-lifecycle.md#rule-delegate-load-failure).

### Rule: Section-by-Section

Write/Edit the plan section by section (one tool call per section), not as a single bulk generation.

### Rule: Plan Review via CLI

Plan review has 3 pass types (completeness & spec alignment / task decomposition / buildability & type consistency), each pass dispatches a fresh `cdd-review`:
  cdd-review --harness claude --template plan-review --param PASS=<completeness|decomposition|buildability> --param DOC=<plan-path> --param SPEC=<spec-path>
**Template resolution reuses** [Rule: Read Upstream](#rule-read-upstream) path rules (`{plugin-root}` = osuperpowers root). Dispatch discipline: see [review-dispatch.md](../docs/review-dispatch.md) (D1/D2/D3 + fresh-pass, mapped verbatim to cli).

### Rule: Tickets Publish Redirect

After ticket splitting, publish to a single local file `docs/superpowers/tickets/YYYY-MM-DD-<feature>-tickets.md` (do not publish to remote tracker).

### Rule: Next-Step Routing

After plan review passes, invoke **`osuperpowers:executing-plans`** (not upstream `superpowers:subagent-driven-development` or `superpowers:executing-plans`). `osuperpowers:executing-plans` is the single entry point — it handles mode selection (in-session / subagent / cli) internally, applies osuperpowers-specific rules (Task Complexity, Confirm Once, Fix Loop, Confirm Seams, Per-Task Review, Quality Invariants, D6 Aggregation, Ledger), and routes to the correct execution path.

**Execution handoff text:**

> "Plan complete and saved to `docs/superpowers/plans/<filename>.md`. Ready to execute — I'll hand off to `osuperpowers:executing-plans` for mode selection and execution."

Do NOT offer a subagent-vs-inline choice — `osuperpowers:executing-plans` does that.

## Red Flags

- "Write the whole thing at once" -> section-by-section writing (Rule: Section-by-Section)
- "Publish tickets to GitHub" -> single local file (Rule: Tickets Publish Redirect)
- "Invoke superpowers:subagent-driven-development / superpowers:executing-plans" -> invoke **`osuperpowers:executing-plans`** (Rule: Next-Step Routing)
- "Offer subagent vs inline choice" -> `osuperpowers:executing-plans` handles mode selection (Rule: Next-Step Routing)
