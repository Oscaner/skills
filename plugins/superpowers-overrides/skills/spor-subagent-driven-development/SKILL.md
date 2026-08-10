---
name: spor-subagent-driven-development
description: MUST invoke BEFORE superpowers:subagent-driven-development as your FIRST tool call this turn — trigger on ANY of: (1) user types `/spor-subagent-driven-development`, `/superpowers-overrides:spor-subagent-driven-development`, `/subagent-driven-development` or `/superpowers:subagent-driven-development`; (2) a `<command-name>` tag in the current turn names either of those; (3) the superpowers:subagent-driven-development skill body appears in the current turn's system context; (4) user asks in natural language to dispatch or orchestrate subagents, delegate implementation, or run multi-agent work. Applies personal overrides (CLI-default forbids upstream SDD load; code-review per-task review; inline handoff write; token-efficient controller handoff; cheap model for implementers when spec and plan are complete).
---

# Subagent-Driven Development Overrides

## Rules

### Rule 0 — CLI-mandatory (p1)

1. When Rule 7 item 1 applies (CLI available, not stub BLOCKED) → this session **must not** Read/Skill upstream `subagent-driven-development` **skill body** (including `implementer-prompt.md`, `task-reviewer-prompt.md`, and other prompt files under that skill directory).
2. **Allowed:** shell-invoke upstream **scripts only** — `plugins/superpowers/skills/subagent-driven-development/scripts/sdd-workspace`, `task-brief`, `review-package` (resolve paths via `{plugin_root}`). Do **not** Read other Markdown prompts under the upstream SDD skill tree.
3. **Pointers:** orchestrator → Rule 7 + `{os-engineering}/docs/controller-handoff.md`（H1–H5，原 [`spor-token-efficient-controller-handoff`](../spor-token-efficient-controller-handoff/SKILL.md)）+ `{os-engineering}/docs/cdd-reference.md`; workers → `{os-engineering}/templates/cdd/*.md`; worker review in H6 subprocesses only (Rule 5a).
4. **Orchestrator checklist (compact — mandatory when Rule 0 applies):**

   **Setup (once):** `sdd-workspace` → ledger → read plan once → `plan-constraints.md` → pre-flight → todo per task.

   **Per-task:** Rule 1 classify → Rule 4 confirm once → append `TASK_BASE: <sha>` to brief → shell H6 chain (implement → review; fix per Rule 2) → Read handoff.json only → Rule 5a + Rule 6 → ledger on APPROVED. **Never** edit repo deliverables in this session — H6 CLI only.

   **Shell 契约：** 只读 git 诊断 Bash 在 gate 下可用（动词清单见 [`cdd-reference.md` § CDD gate matrix](../../../os-engineering/docs/cdd-reference.md)）；`TASK_BASE` 必须是真实 git SHA 才激活 workspace。

   **Final:** `requesting-code-review` whole-branch in-session → clean → `finishing-a-development-branch`.

### Rule 1 — Task complexity (diff scope, test gate, model — not review rounds)

Classify each task first:

| Signal | Verdict |
|--------|---------|
| Touches 1–2 files, complete spec, mechanical implementation | **Simple** |
| Touches 3+ files or requires cross-module integration | **Complex** |
| Requires design judgment or architectural decisions | **Complex** |
| User explicitly requested thoroughness | **Complex** |

When in doubt, classify **Complex**.

Affects **only** diff scope (`review_scope`), test gate (Rule 6), model tier (Rule 4). Simple = Complex review chain (one code-review + inline handoff write). **Batching:** shared-area Simple tasks → one batch handoff/review, `FIRST_TASK_BASE..LAST_HEAD`, ledger per task; batching ≠ Complex.

### Rule 2 — Fix loop until approved (cap 5)

`CHANGES_REQUESTED` → fix → scoped review on `FIX_BASE..HEAD` → inline handoff write → repeat until `APPROVED` or **5 rounds** (H4).

### Rule 4 — Cheaper models when spec + plan complete

Spec+plan complete → cheapest implementer tier; code-review/final default; handoff is inline (no separate model). Confirm once before first dispatch/H6 (Rule 0).

### Rule 5 — Per-task review (split by path)

#### Rule 5a — Orchestrator gates (both paths)

PreToolUse gate + handoff.json only (H2). STOP on `plan_conflicts`; `CHANGES_REQUESTED` → Rule 2 (CLI fix chain); `NEEDS_CONTEXT` or `unverifiable` → STOP. Rule 0: H6 runs worker review. Cite [`spor-token-efficient-controller-handoff`](../spor-token-efficient-controller-handoff/SKILL.md) H1–H5.

### Rule 6 — Quality invariants

1. **Test evidence gate** — data from `task-N-test-evidence.json`; soft vs hard per Rule 1 complexity + `behavior_change`.
2. **Plan-mandated conflicts** — deliberate plan/brief violations → `plan_conflicts[]`; human adjudication before fix loop (Rule 5a).
3. **Unverifiable** — axis reports flag unverifiable items → `unverifiable[]`; non-empty → BLOCKED.
4. **NEEDS_CONTEXT** — handoff status → STOP.

### Rule 7 — CLI dispatch when available (p1)

When cursor/claude CLI is available and `{os-engineering}/bin/cdd-run.sh` exists:

1. Per-task execution **must** use the H6 three-mode CLI chain — `{os-engineering}/bin/cdd-run.sh --harness <name> --task N --mode implement|review|fix [--plan PATH]`; Mode B (plan driver): `{os-engineering}/bin/cdd-run.sh --harness <name> --plan PATH` — per [`{os-engineering}/docs/cdd-reference.md`](../../../os-engineering/docs/cdd-reference.md).
2. CLI unavailable (exit **2**) or engine script not found → orchestrator **BLOCKED**. Report: script path attempted, harness, exit code. Do not fall back to in-session execution.
3. Not-supported harness selected (codex/copilot/gemini) → exit **1** → orchestrator **BLOCKED** (not p0 fallback).
4. Orchestrator **still obeys Rule 6** after Read handoff: non-empty `plan_conflicts` → STOP; `NEEDS_CONTEXT` or non-empty `unverifiable` → STOP.
5. **Final whole-branch review** — orchestrator in-session only (not CLI-dispatched). `{plugin_root}` via [`spor-init`](../spor-init/SKILL.md).

### Rule 8 — 终盘聚合 + 用户决策门 (D6)

All tasks APPROVED → before the final whole-branch review (Rule 0 **Final:**):

1. **聚合** — orchestrator reads the ledger and aggregates every deferred minor: grep `deferred` lines (match the `deferred` substring, not a colon-anchored pattern, so the no-jq degraded line `deferred not enumerated — jq missing` with no colon is also caught) → **呈现给用户**.
2. **用户决策门** — user either defers all (run ends) or names items to fix.
3. **要修 → 有界 final fix 波（一次）** — one **fix agent** takes the full list + one **scoped re-review** (fixed point = last final head; reuse `code-review`). End semantics:
   - re-review clean → done: deferred items fixed, handoff `status` stays `APPROVED` (**不重写**), ledger keeps its `complete` line (optionally append one line noting K items fixed).
   - re-review exposes a new `blocker` → still one fix wave, then **unconditionally report to the user** (clean or not) — **no cross-task fix loop**; remaining items are not silently dropped, the report ends it.
   - **round cap 5 仅适用单任务 fix loop，不适用跨任务 final fix 波.**
4. **Mode B** — user reads the ledger after the run ends to aggregate deferred; **no new shell end-of-run print** (`os-engineering/bin/lib/cdd-common.sh` has no such path).

## Red Flags — STOP if you catch yourself thinking any of these

- "Simple task — I'll use upstream task-reviewer, it's faster."
- "I'll Read the Spec axis report to decide if we're done."
- "Complex means 3 review rounds — old Rule 1."
- "Skip test-evidence.json — report has stdout."
- "handoff-writer can wait until plan end." → handoff is inline — remove
- "Batch of simple tasks — one round each."
- "CLI is available but in-session is simpler — skip H6."
- "Stub harness exit 1 — I'll fall back to p0." → exit 1 means BLOCKED, not p0 fallback.
- "Final review can run in a CLI session."
- "CLI available — I'll Read upstream SDD for Setup context."
- "Rule 0 — I'll paraphrase tdd in the override instead of citing implement.md."
- "Hook will block me — I'll edit repo files before TASK_BASE / outside H6."
- "Task is markdown-only — skip H6 and handoff.json."
- "I'll mark ledger complete with inline review."

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "code-review is overkill for tiny tasks" | p0 program invariant — delegation is the token win. |
| "I'll merge axis reports myself" | H5 forbids it — handoff write is inline in each mode per template instructions. |
| "3 files is soft boundary" | Hard boundary for complexity classification — affects diff scope. |
| "Fix round 6 will work" | H4 cap is 5 — STOP and escalate. |
| "I'll dispatch final review as mode=review" | Q8 — final whole-branch review stays orchestrator in-session. |
