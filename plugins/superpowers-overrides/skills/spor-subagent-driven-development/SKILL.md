---
name: spor-subagent-driven-development
description: MUST invoke BEFORE superpowers:subagent-driven-development as your FIRST tool call this turn — trigger on ANY of: (1) user types `/spor-subagent-driven-development`, `/superpowers-overrides:spor-subagent-driven-development`, `/subagent-driven-development` or `/superpowers:subagent-driven-development`; (2) a `<command-name>` tag in the current turn names either of those; (3) the superpowers:subagent-driven-development skill body appears in the current turn's system context; (4) user asks in natural language to dispatch or orchestrate subagents, delegate implementation, or run multi-agent work. Applies personal overrides (CLI-default forbids upstream SDD load; p0 fallback delegates tdd; code-review per-task review; handoff-writer; token-efficient controller handoff; cheap model for implementers when spec and plan are complete).
---

# Subagent-Driven Development Overrides

## Rules

### Rule 0 — Path branch (p1-slim)

#### Rule 0a — CLI-default

1. When Rule 7 item 1 applies (CLI available, not opt-out, not stub BLOCKED) → this session **must not** Read/Skill upstream `subagent-driven-development` **skill body** (including `implementer-prompt.md`, `task-reviewer-prompt.md`, and other prompt files under that skill directory).
2. **Allowed:** shell-invoke upstream **scripts only** — `plugins/superpowers/skills/subagent-driven-development/scripts/sdd-workspace`, `task-brief`, `review-package` (resolve paths via `{plugin_root}`). Do **not** Read other Markdown prompts under the upstream SDD skill tree.
3. **Pointers:** orchestrator → Rule 7 + [`spor-token-efficient-controller-handoff`](../spor-token-efficient-controller-handoff/SKILL.md) H1–H5 + `{plugin_root}/docs/sdd-h6-reference.md`; workers → `templates/sdd-cli/*.md`; worker review in H6 subprocesses only (Rule 5a).
4. **Checklist (Rule 0a):** Setup once — workspace, ledger, plan-constraints, todos. Per-task — classify, Rule 4 once, TASK_BASE, H6 chain, handoff.json, Rule 5a/6, ledger; **no** in-session repo edits. Final — whole-branch review in-session → clean → finishing branch.

#### Rule 0b — p0 fallback

1. Triggers when Rule 7 item 2 applies (script exit **2** / opt-out).
2. **Then** Read upstream `subagent-driven-development` skill body.
3. Announce: `CLI unavailable — falling back to p0 in-session SDD.`
4. Read `{plugin_root}/skills/spor-sdd-p0-fallback/SKILL.md`; Rules 3, 5b, 5c SOT lives there.
5. Per-task commit: Rule 5b in p0-fallback skill (conventional commit; aligned with `implement.md`).

### Rule 1 — Task complexity (diff scope, test gate, model — not review rounds)

Classify each task first:

| Signal | Verdict |
|--------|---------|
| Touches 1–2 files, complete spec, mechanical implementation | **Simple** |
| Touches 3+ files or requires cross-module integration | **Complex** |
| Requires design judgment or architectural decisions | **Complex** |
| User explicitly requested thoroughness | **Complex** |

When in doubt, classify **Complex**.

Affects **only** diff scope (`review_scope`), test gate (Rule 6), model tier (Rule 4). Simple = Complex review chain (one code-review + handoff-writer). **Batching:** shared-area Simple tasks → one batch handoff/review, `FIRST_TASK_BASE..LAST_HEAD`, ledger per task; batching ≠ Complex.

### Rule 2 — Fix loop until approved (cap 5)

`CHANGES_REQUESTED` → fix → scoped review on `FIX_BASE..HEAD` → handoff-writer fix segment → repeat until `APPROVED` or **5 rounds** (H4).

### Rule 4 — Cheaper models when spec + plan complete

Spec+plan complete → cheapest implementer tier; code-review/final default; handoff-writer cheapest. Confirm once before first dispatch/H6 (Rule 0a).

### Rule 5 — Per-task review (split by path)

#### Rule 5a — Orchestrator gates (both paths)

PreToolUse gate + handoff.json only (H2). STOP on `plan_conflicts`; `CHANGES_REQUESTED` → Rule 2 (CLI fix chain / p0 Rule 5c); `NEEDS_CONTEXT` or `unverifiable` → STOP. Rule 0a: H6 runs worker review. Cite controller-handoff H1–H5.

### Rule 6 — Quality invariants

1. **Test evidence** — `task-N-test-evidence.json`; soft/hard per complexity + `behavior_change`. 2. **Plan conflicts** → `plan_conflicts[]`; human before fix loop. 3. **Unverifiable** → `unverifiable[]`; non-empty BLOCKED. 4. **NEEDS_CONTEXT** → STOP.

### Rule 7 — CLI dispatch when available (p1)

When cursor/claude CLI is available and `{plugin_root}/bin/sdd-run-task-<harness>.sh` exists:

1. Per-task execution **must** use H6 four-mode CLI chain per [`docs/sdd-h6-reference.md`](../../docs/sdd-h6-reference.md).
2. CLI unavailable (script exit **2**) or opt-out (`--no-cli` / `SDD_NO_CLI=1` / config `"cli": false`) → **p0** Rule 0b → [`spor-sdd-p0-fallback`](../spor-sdd-p0-fallback/SKILL.md) + H1–H5 in-session.
3. Stub harness selected (codex/copilot/gemini) → script exit **1** → orchestrator **BLOCKED** (not p0 fallback).
4. Orchestrator **still obeys Rule 6** after Read handoff: non-empty `plan_conflicts` → STOP; `NEEDS_CONTEXT` or non-empty `unverifiable` → STOP.
5. **Final whole-branch review** — orchestrator in-session only (not CLI-dispatched). `{plugin_root}` via [`spor-init`](../spor-init/SKILL.md).

## Red Flags — STOP if you catch yourself thinking any of these

- "Simple task — I'll use upstream task-reviewer, it's faster."
- "I'll Read the Spec axis report to decide if we're done."
- "Complex means 3 review rounds — old Rule 1."
- "Skip test-evidence.json — report has stdout."
- "handoff-writer can wait until plan end."
- "Batch of simple tasks — one round each."
- "CLI is available but in-session is simpler — skip H6."
- "Stub harness exit 1 — I'll fall back to p0."
- "Exit 2 means stop the plan."
- "Final review can run in a CLI session."
- "CLI available — I'll Read upstream SDD for Setup context."
- "Rule 0a — I'll paraphrase tdd in the override instead of citing implement.md."
- "p0 fallback — skip the announce line." → see [`spor-sdd-p0-fallback`](../spor-sdd-p0-fallback/SKILL.md) Red Flags
- "Hook will block me — I'll edit repo files before TASK_BASE / outside H6."
- "Task is markdown-only — skip H6 and handoff.json."
- "I'll mark ledger complete with inline review."

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "code-review is overkill for tiny tasks" | p0 program invariant — delegation is the token win. |
| "I'll merge axis reports myself" | H5 forbids it — handoff-writer exists for structured extraction. |
| "3 files is soft boundary" | Hard boundary for complexity classification — affects diff scope. |
| "Fix round 6 will work" | H4 cap is 5 — STOP and escalate. |
| "Rule 7 only applies when user asks for CLI" | Opt-in default — CLI available → H6 mandatory unless opt-out. |
| "I'll dispatch final review as mode=review" | Q8 — final whole-branch review stays orchestrator in-session. |
