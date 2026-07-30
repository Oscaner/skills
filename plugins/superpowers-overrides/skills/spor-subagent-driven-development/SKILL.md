---
name: spor-subagent-driven-development
description: MUST invoke BEFORE superpowers:subagent-driven-development as your FIRST tool call this turn — trigger on ANY of: (1) user types `/spor-subagent-driven-development`, `/superpowers-overrides:spor-subagent-driven-development`, `/subagent-driven-development` or `/superpowers:subagent-driven-development`; (2) a `<command-name>` tag in the current turn names either of those; (3) the superpowers:subagent-driven-development skill body appears in the current turn's system context; (4) user asks in natural language to dispatch or orchestrate subagents, delegate implementation, or run multi-agent work. Applies personal overrides (complexity-based review rounds; token-efficient dispatch; implementer subagents delegate to mattpocock-skills:tdd; cheap model for implementers when spec and plan are complete).
---

# Subagent-Driven Development Overrides

## Rules

### Rule 1 — Review rounds scale with task complexity

Classify each task first:

| Signal | Verdict |
|--------|---------|
| Touches 1–2 files, complete spec, mechanical implementation | **Simple** |
| Touches 3+ files or requires cross-module integration | **Complex** |
| Requires design judgment or architectural decisions | **Complex** |
| User explicitly requested thoroughness | **Complex** |

When in doubt, classify **Complex**. Every reviewer dispatch is a **fresh** subagent — see [`spor-subagent-lifecycle`](../spor-subagent-lifecycle/SKILL.md) Rule 2.

**Simple tasks — 1 round each:** spec-compliance (all requirements met, nothing extra) + code-quality (basic correctness & maintainability). Both approve → proceed.

**Complex tasks — up to 3 rounds each, distinct focus per round:**

| Round | Spec compliance | Code quality |
|-------|-----------------|--------------|
| 1 | Completeness — every requirement covered | Correctness & bugs |
| 2 (delta) | Extra work & over-engineering | Security & reliability |
| 3 (full diff) | Misunderstandings — semantic mismatches | Maintainability & readability |

Dispatch discipline (D1 escalate-on-finding, D2 delta review, D3 findings-only output) governed by [`spor-token-efficient-review-dispatch`](../spor-token-efficient-review-dispatch/SKILL.md). D1 applies **per axis** — spec-compliance and code-quality skip independently.

**Batching:** When multiple simple tasks share the same feature area or shared files, batch them as a single **Complex** block (up to 3 rounds each, subject to D1).

### Rule 2 — Rounds iterate until approved before advancing

A round that finds issues → implementer fixes → **same round's** reviewer re-reviews until approved → only then advance (subject to D1). Do not proceed past a round with unresolved findings.

### Rule 3 — Implementer subagents delegate to `mattpocock-skills:tdd`

When dispatching an **implementer** subagent to write code, delegate implementation discipline to [`mattpocock-skills:tdd`](https://github.com/mattpocock/skills/blob/main/skills/engineering/tdd/SKILL.md). This fills the gap where the upstream skill specifies *how to review* but leaves *how to implement* unopinionated. Its rules live in that skill — do not re-implement here.

1. Instruct each implementer dispatch to invoke `mattpocock-skills:tdd` via the Skill tool and follow its red-green-refactor loop.
2. Confirm the seams under test with the user before the implementer writes tests (the skill's own precondition).
3. Exemption: pure-mechanical edits with **no behavioral change and no schema/config change** — renames, whitespace, comment reflow. Config files (route tables, feature flags, DB migrations, dependency versions, build configuration) are NOT exempt — they can silently change behavior. When in doubt, use TDD.
4. If `mattpocock-skills:tdd` fails to load (Skill tool error — i.e. plugin is installed but skill fails to load): surface the exact error to the user and ask whether to proceed manually per that skill's discipline or wait for the plugin to be repaired. Do not paraphrase `tdd`'s rules from memory. If `mattpocock-skills` is not installed, degrade silently — implementer subagents proceed without invoking the skill.

### Rule 4 — Use cheaper models for implementers when spec and plan are complete

When both a spec doc and an implementation plan exist and satisfy ALL of:

1. No TBD / "to be decided" items in the spec.
2. Plan steps are concrete enough to execute without inferring intent.
3. No open design questions (auth, data models, API shapes all resolved).

…then implementer subagents MUST use the cheapest capable model available in the current environment:

- **Claude Code** — check environment variables or session config for the available model tier; pick the lowest tier that can follow the plan.
- **Cursor** — use Composer (it is already a cheaper-model interface by default).

Reviewer subagents stay on the default model — review requires judgment.

**Before first dispatch in each session:** confirm — "Spec and plan look complete — I'll use a cheaper model for implementers. OK?"

<!-- Additional rules for subagent-driven-development go below as Rule 5, Rule 6, … -->

## Red Flags — STOP if you catch yourself thinking any of these

- "It's basically simple, I'll do 1 round even though it touches 3 files."
- "Batched simple tasks are still simple, 1 round is fine."
- "The implementer can just write the code directly; TDD is overhead."
- "I'll skip confirming seams — pick reasonable ones silently."
- "The spec has a TBD section but it's minor — use the cheaper model anyway."
- "Reviewers are just checking output; they can use the cheap model too."

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "3 files is a soft boundary" | Hard boundary — 3+ files means Complex, no exceptions. |
| "Writing tests first is slower" | Slower to write, faster to verify. `mattpocock-skills:tdd` closes the executor's feedback loop. |
| "Seams are obvious, skip the confirmation" | Silent seams = tests against the wrong interface. Confirm them. |
| "The plan looks complete to me" | All three criteria (Rule 4) must pass — if one is missing, keep the default model. |
| "Reviewers just read output; cheaper is fine" | Reviewers make judgment calls (security, maintainability) — keep them on the default. |
