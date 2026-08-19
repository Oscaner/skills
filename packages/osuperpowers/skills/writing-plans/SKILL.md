---
name: writing-plans
description: Independent plan-writing orchestrator -- Reads upstream superpowers:writing-plans as baseline, layers personal rules (section-by-section writing / cli review passes / to-tickets publish redirect).
---

# OS Writing-Plans

Full plan-writing flow orchestration, callable standalone.

## Rules

### Rule: Read Upstream

Read upstream `superpowers:writing-plans` SKILL.md as the process baseline **when available** (resolution priority + unavailability fallback same as [Rule: Read Upstream](../brainstorming/SKILL.md#rule-read-upstream)). **Read, not Skill-invoke**.

### Rule: Read Sub-Skills

On demand, Read `mattpocock-skills` `skills/engineering/to-tickets/SKILL.md` (ticket splitting Steps 1-4). Load failure protocol: see [subagent-lifecycle.md](../docs/subagent-lifecycle.md#rule-delegate-load-failure).

### Rule: Section-by-Section

Write/Edit the plan section by section (one tool call per section), not as a single bulk generation.

### Rule: Plan Review via CLI

Plan review has 3 pass types (completeness & spec alignment / task decomposition / buildability & type consistency), each pass dispatches a fresh `cdd-exec`:
  cdd-exec --harness claude --prompt "<plan-document-reviewer template + pass category + document path>"
**Template resolution reuses** [Rule: Read Upstream](#rule-read-upstream) path rules (`{plugin-root}` = osuperpowers root). Dispatch discipline: see [review-dispatch.md](../docs/review-dispatch.md) (D1/D2/D3 + fresh-pass, mapped verbatim to cli).

### Rule: Tickets Publish Redirect

After ticket splitting, publish to a single local file `docs/superpowers/tickets/YYYY-MM-DD-<feature>-tickets.md` (do not publish to remote tracker).

## Red Flags

- "Write the whole thing at once" -> section-by-section writing (Rule: Section-by-Section)
- "Publish tickets to GitHub" -> single local file (Rule: Tickets Publish Redirect)
