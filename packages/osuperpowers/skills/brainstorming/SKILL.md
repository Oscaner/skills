---
name: brainstorming
description: Independent brainstorm orchestrator -- Reads upstream superpowers:brainstorming as baseline, layers personal rules (grilling clarification / overall+phase / cli review passes). Callable standalone; triggered by /brainstorming via overrides router.
---

# Osuperpowers Brainstorming

Full brainstorm flow orchestration, callable standalone.

## Rules

### Rule: Read Upstream

Read upstream `superpowers:brainstorming` SKILL.md as the process baseline **when available** (claude / cursor has superpowers plugin installed). **Read, not Skill-invoke** (Skill-invoke triggers the router interception).

Resolve paths (`{plugin-root}` = this plugin's osuperpowers root):
1. **Sibling plugin root**: claude `$CLAUDE_PLUGIN_ROOT/../superpowers/skills/brainstorming/SKILL.md` (same for cursor)
2. **Fallback same-repo relative path**: `<repo-root>/vendors/superpowers/skills/brainstorming/SKILL.md`

Upstream unavailable (non-claude harness / superpowers plugin not installed) -> **no error**: execute this skill's own Rules as the complete flow directly. This skill's own Rules are the load-bearing flow; reading upstream is purely additive.

### Rule: Read Sub-Skills

**Must** read `mattpocock-skills` `skills/productivity/grilling/SKILL.md` (mandatory step — clarification question delegation).
On failure (file not found / read error) → **report error + ask the user for next steps**;
user may skip grilling and continue, or abort the flow. All failure scenarios behave identically.
Load failure protocol: see [subagent-lifecycle.md](../docs/subagent-lifecycle.md#rule-delegate-load-failure).

### Rule: Research Delegation

When the explore-context phase discovers questions requiring primary source research (questions the codebase cannot answer: upstream API behavior, harness CLI specs, package internals, cross-harness differences, etc.):

1. **Identify + ask the user**: list questions needing research, ask "trigger research?" (multiple questions can be batched)
   - User confirms -> spawn research agent (steps 2-6)
   - User declines -> skip that question, **normal flow continues** (explore-context -> grilling)
2. **Spawn background agent**: one mattpocock-skills:research agent per research question (parallel).
   Research agent prompt = question description + instruction to cite sources.
3. **Continue explore-context** (code exploration is not interrupted)
4. **Wait for completion**: before entering grilling, ensure all background research is done.
5. **Output**: findings written to `docs/research/YYYY-MM-DD-<topic>.md` (follow existing convention,
   see existing 3 files under `docs/research/`).
6. **Consumption**: research findings are referenced as primary sources in subsequent grilling + approach selection + design (not re-searched ad-hoc).

Trigger conditions (non-exhaustive, orchestrator judgment):
- User question involves external API / CLI behavioral specs (not findable in codebase)
- Upstream package internal structure or conventions (e.g. pi CLI discovery mechanism)
- Cross-harness differences requiring comparative verification

Non-trigger conditions:
- Question can be answered directly from codebase / docs / git history
- Pure design decisions (no external facts needed)

Trigger failure (research agent error/timeout) -> log stderr, do not block flow (fail-open).

### Rule: Overall-Phase

Large requirements (>=3 subsystems / multi-phase / overhaul) write an overall spec first, then phase out. Document structure: see [overall-phase-spec-template.md](../docs/overall-phase-spec-template.md). GATE: overall approval != phase started.

### Rule: Spec Review via CLI

Spec review has 3 pass types (completeness / consistency&scope / clarity&YAGNI), each pass dispatches a fresh `cdd-review`:
  cdd-review --harness claude --template spec-review --param PASS=<completeness|consistency|clarity> --param DOC=<path>
Dispatch discipline: see [review-dispatch.md](../docs/review-dispatch.md) (D1/D2/D3 + fresh-pass, mapped verbatim to cli).

### Rule: Next-Step Routing

After brainstorming completes, invoke **`osuperpowers:writing-plans`** (not upstream `superpowers:writing-plans`). The osuperpowers wrapper adds section-by-section writing, cli review passes, and ticket publish redirect on top of the upstream baseline.

### Rule: Write Design Doc

Spec saved to `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`, after user review -> writing-plans.

## Red Flags

- "Skill-invoke upstream brainstorm" -> Read instead of Skill-invoke (Rule: Read Upstream)
- "Skip design for simple projects" -> every project goes through design (upstream flow requirement)
- "Research auto-triggers without asking user" -> user confirmation is a hard gate
- "Research blocks explore-context" -> background parallel
- "Invoke writing-plans / superpowers:writing-plans" -> invoke **`osuperpowers:writing-plans`** (Rule: Next-Step Routing)
