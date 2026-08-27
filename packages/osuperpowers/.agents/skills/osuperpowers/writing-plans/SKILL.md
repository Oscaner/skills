---
name: writing-plans
description: Independent plan-writing orchestrator -- Reads upstream superpowers:writing-plans as baseline, layers personal rules (section-by-section writing / cli review passes / to-tickets publish redirect).
---

# Osuperpowers Writing-Plans

Full plan-writing flow orchestration, callable standalone.

## Checklist

1. Read upstream `superpowers:writing-plans` SKILL.md (Rule: Read Upstream)
2. Read spec file to understand design constraints
3. Write plan section by section — one tool call per section (Rule: Section-by-Section)
4. 3-pass Plan Review via CLI (completeness / decomposition / buildability)
5. Present completed plan to user in one message for confirmation
6. Execution Handoff → hand off to `osuperpowers:cli-driven-development`

## Rules

### Rule: Read Upstream

Read upstream `superpowers:writing-plans` SKILL.md as the process baseline **when available** (resolution priority + unavailability fallback same as [Read Upstream](../brainstorming/SKILL.md#read-upstream)). **Read, not Skill-invoke**.

The baseline is the SKILL.md file at the resolved path only — injected vendor docs are not the baseline (see [Read Upstream](../brainstorming/SKILL.md#read-upstream)).

### Rule: Read Sub-Skills

On demand, Read `mattpocock-skills` `skills/engineering/to-tickets/SKILL.md` (ticket splitting Steps 1-4). Load failure protocol: target skill cannot be resolved/loaded → report the error to the user and ask for next steps. No silent degradation. The user can decide to skip the delegation or abort the flow.

### Rule: Section-by-Section

Write/Edit the plan section by section (one tool call per section), not as a single bulk generation.

Writing granularity and confirmation timing are decoupled: each section is written in one independent tool call (writing granularity); after all sections are written, present to the user in one message (confirmation timing). **Prohibited**: pausing after each section to wait for user response.

### Rule: Plan Review via CLI

<HARD-GATE>
After the plan is written, you MUST execute three cdd-review CLI passes in order
(completeness / decomposition / buildability).
Inline self-check is NOT a substitute. All passes must complete before Execution Handoff.
</HARD-GATE>

Plan review has 3 pass types (completeness & spec alignment / task decomposition / buildability & type consistency), each pass dispatches a fresh `cdd-review`:
  cdd-review --harness claude --template plan-review --param PASS=<completeness|decomposition|buildability> --param DOC=<plan-path> --param SPEC=<spec-path>
**Template resolution reuses** [Rule: Read Upstream](#rule-read-upstream) path rules (`{plugin-root}` = osuperpowers root). Dispatch discipline: see [docs-review.md](../brainstorming/docs/docs-review.md) (D1/D2/D3 + fresh-pass, mapped verbatim to cli; Review Stopping loop + Handoff Output).
Review Stopping next-step label for this skill: `"Execution Handoff"`.

### Rule: Tickets Publish Redirect

After ticket splitting, publish to a single local file `docs/superpowers/tickets/YYYY-MM-DD-<feature>-tickets.md` (do not publish to remote tracker).

### Rule: Next-Step Routing

After plan review passes, invoke **`osuperpowers:cli-driven-development`** (not upstream `superpowers:subagent-driven-development`).

**Execution handoff text:**

> "Plan complete and saved to `docs/superpowers/plans/<filename>.md`. Ready to execute — I'll hand off to `osuperpowers:cli-driven-development` for CLI execution."

## Red Flags

- "Write the whole thing at once" → section-by-section writing (Rule: Section-by-Section)
- "Publish tickets to GitHub" → single local file (Rule: Tickets Publish Redirect)
- "Invoke superpowers:subagent-driven-development" → invoke **`osuperpowers:cli-driven-development`** (Rule: Next-Step Routing)
- "Offer mode choice" → `osuperpowers:cli-driven-development` handles execution (Rule: Next-Step Routing)
- "Ask user after each section whether to continue" → write all sections first, then confirm (Rule: Section-by-Section)
- "Replace Plan Review CLI with inline self-check" → violates HARD-GATE Plan Review; must call CLI three times
- "Display execution-mode choice" → use Execution Handoff text, hand off to `osuperpowers:cli-driven-development` (Rule: Next-Step Routing)
- "Auto-fix warn/nit and re-run review after blocker=0" → violates Review Stopping (docs-review.md); present to user, re-run only if user requests
- "Issue new cdd-review call to obtain warn/nit content" → violates Review Stopping; read from already-captured output of current 3-pass cycle
