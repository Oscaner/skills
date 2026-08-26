---
name: brainstorming
description: Independent brainstorm orchestrator -- Reads upstream superpowers:brainstorming as baseline, layers personal rules (grilling clarification / overall+phase / cli review passes). Callable standalone; triggered by /brainstorming via overrides router.
---

# Osuperpowers Brainstorming

Full brainstorm flow orchestration, callable standalone.

<HARD-GATE>
After brainstorming is triggered, you MUST complete ALL of the following steps in order,
regardless of change size, whether input already contains a proposal, or whether an issue exists:

1. Read upstream superpowers:brainstorming SKILL.md (Rule: Read Upstream)
2. Read grilling SKILL.md (Rule: Read Sub-Skills)
3. Explore project context (files, docs, recent commits)
4. Grilling — ask one question at a time, wait for each answer before continuing
5. Propose 2-3 approaches with trade-offs and recommendation
6. Present design section by section; get user confirmation after each section
7. Write design doc
8. 3-pass Spec Review via CLI (Rule: Spec Review via CLI)
9. User reviews spec; iterate as needed
10. Hand off to osuperpowers:writing-plans (Rule: Next-Step Routing)

No implementation actions allowed until step 6 (design approved by user) is complete.
</HARD-GATE>

## Checklist

1. Read upstream superpowers:brainstorming SKILL.md (Rule: Read Upstream)
2. Read grilling SKILL.md (Rule: Read Sub-Skills)
3. Explore project context (files, docs, recent commits)
4. Grilling — ask one question at a time, wait for each answer before continuing
5. Propose 2-3 approaches with trade-offs and recommendation
6. Present design section by section; get user confirmation after each section
7. Write design doc
8. 3-pass Spec Review via CLI (Rule: Spec Review via CLI)
9. User reviews spec; iterate as needed
10. Hand off to osuperpowers:writing-plans (Rule: Next-Step Routing)

## Rules

### Rule: Read Upstream

Read upstream `superpowers:brainstorming` SKILL.md as the process baseline **when available** (claude / cursor has superpowers plugin installed). **Read, not Skill-invoke** (Skill-invoke triggers the router interception).

Resolve paths (`{plugin-root}` = this plugin's osuperpowers root):
1. **Sibling plugin root**: claude `$CLAUDE_PLUGIN_ROOT/../superpowers/skills/brainstorming/SKILL.md` (same for cursor)
2. **Fallback same-repo relative path**: `<repo-root>/vendors/superpowers/skills/brainstorming/SKILL.md`

The process baseline is the **SKILL.md file at the resolved path only**. Documents a harness auto-injects from vendored repos — `CLAUDE.md`, README, contributor guides under `vendors/<name>/` or any other source — are **not** the baseline, even when they load into context at session start. They describe repo contribution norms, not orchestrator flow.

Upstream unavailable (non-claude harness / superpowers plugin not installed) → **no error**: execute this skill's own Rules as the complete flow directly.

### Rule: Read Sub-Skills

**Must** read `mattpocock-skills` `skills/productivity/grilling/SKILL.md` (mandatory step — clarification question delegation).
On failure (file not found / read error) → **report error + ask the user for next steps**; user may skip grilling and continue, or abort the flow.
Load failure protocol: target skill cannot be resolved/loaded → report the error to the user and ask for next steps. No silent degradation. The user can decide to skip the delegation or abort the flow.
After reading the grilling SKILL.md, execute its instructions as the grilling framework verbatim — do not substitute with a self-organized interview format, option menus, or structured choice lists.

### Rule: Research Delegation

When the explore-context phase discovers questions requiring primary source research (upstream API behavior, harness CLI specs, package internals, cross-harness differences):

1. **Identify + ask the user**: list questions, ask "trigger research?" — user confirms → spawn; user declines → skip, normal flow continues
2. **Spawn background agent**: one mattpocock-skills:research agent per question (parallel). Prompt = question + cite sources instruction.
3. **Continue explore-context** (code exploration is not interrupted)
4. **Wait for completion** before entering grilling
5. **Output**: findings written to `docs/research/YYYY-MM-DD-<topic>.md`
6. **Consumption**: research findings referenced as primary sources in grilling + approach selection + design

Trigger failure (research agent error/timeout) → log stderr, do not block flow (fail-open).

### Rule: Overall-Phase

Large / multi-phase requirements (>=3 subsystems / multi-phase / overhaul) write an overall spec first, then phase out. Document structure: [overall-spec-template.md](./overall-spec-template.md) (+ [phase-spec-template.md](./phase-spec-template.md) per phase). GATE: overall approval != any phase started.

When drafting, the overall spec MUST carry: (1) issue inventory per phase; (2) path naming `specs/YYYY-MM-DD-<feature>-overall.md`, `specs/YYYY-MM-DD-<feature>-<phase-id>-design.md`, `plans/...-<phase-id>.md`, `tickets/...-<phase-id>-tickets.md` (`<phase-id>` lowercase); (3) per-phase Acceptance criteria; (4) soft vs hard dependency distinction (graph legend: `->` = hard block, `-> (soft)` = suggestion — full legend in the template); (5) requirement changes arising during a phase MUST feed back to the overall spec before implementation. Each phase spec is produced by a full brainstorm->plan->dev cycle; jumping to implementation after overall approval alone is a violation.

### Rule: Spec Review via CLI

Spec review has 3 pass types (completeness / consistency&scope / clarity&YAGNI), each pass dispatches a fresh `cdd-review`:
  cdd-review --harness claude --template spec-review --param PASS=<completeness|consistency|clarity> --param DOC=<path>
Dispatch discipline: see [docs-review.md](../writing-plans/docs/docs-review.md) (D1/D2/D3 + fresh-pass, mapped verbatim to cli; Review Stopping loop + Handoff Output).
Review Stopping next-step label for this skill: `"User review of spec"`.

### Rule: Next-Step Routing

After brainstorming completes, invoke **`osuperpowers:writing-plans`** (not upstream `superpowers:writing-plans`). The osuperpowers wrapper adds section-by-section writing, cli review passes, and ticket publish redirect on top of the upstream baseline.

### Rule: Write Design Doc

Spec saved to `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`, after user review → writing-plans.

## Red Flags

- "Skill-invoke upstream brainstorm" → Read instead of Skill-invoke (Rule: Read Upstream)
- "Skip design for simple projects" → every project goes through design (HARD-GATE flow Step 6)
- "Research auto-triggers without asking user" → user confirmation is a hard gate (Rule: Research Delegation)
- "Research blocks explore-context" → background parallel (Rule: Research Delegation)
- "Invoke writing-plans / superpowers:writing-plans" → invoke **`osuperpowers:writing-plans`** (Rule: Next-Step Routing)
- "Input already contains a proposal, skip grilling and go straight to design" → violates HARD-GATE flow Step 4
- "Change is simple, skip design and implement directly" → violates HARD-GATE flow Step 6
- "Overall approved, start implementation directly (skipping Phase brainstorming)" → violates HARD-GATE flow Steps 1-10 (entire flow)
- "Auto-fix warn/nit and re-run review after blocker=0" → violates Review Stopping (docs-review.md); present to user, re-run only if user requests
- "Issue new cdd-review call to obtain warn/nit content" → violates Review Stopping; read from already-captured output of current 3-pass cycle
- "Presents Option A / Option B choices instead of following grilling skill" → violates Rule: Read Sub-Skills (grilling delegation); apply grilling SKILL.md instructions verbatim
- "Treats injected vendor docs (CLAUDE.md / README) as the upstream baseline" → violates Rule: Read Upstream; the baseline is the SKILL.md file at the resolved path only
