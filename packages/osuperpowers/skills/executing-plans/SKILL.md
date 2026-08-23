---
name: executing-plans
description: Independent plan execution orchestrator -- User selects execution mode (in-session / subagent / cli), orchestrator controller rule set (11 semantic rules, shared across three modes). cli mode delegates to cli-driven-development; in-session/subagent mode Reads the corresponding upstream skill.
---

# Osuperpowers Executing-Plans

Master orchestrator for executing written plans. Three modes chosen by the user.

<HARD-GATE>
The FIRST action at startup MUST be AskUserQuestion to select mode (in-session | subagent | cli),
before any repo tool call. Do NOT accept a mode pre-selection from a prior skill's handoff — the orchestrator always asks directly.
</HARD-GATE>

## Checklist

1. AskUserQuestion to select mode (in-session / subagent / cli)
2. Read corresponding upstream SKILL.md (Rule: Read Upstream)
3. Setup (workspace / ledger / plan / plan-constraints / pre-flight)
4. Per-task loop: Task Complexity → Confirm Once → Confirm Seams → implement → **Per-Task Review** → ledger
5. D6 Aggregation (aggregate deferred items → user decision)
6. `osuperpowers:code-review` → `osuperpowers:finishing`

## Rules

### Rule: Read Upstream

Resolve upstream based on user-selected mode (resolution priority + unavailability fallback same as [Rule: Read Upstream](../brainstorming/SKILL.md#rule-read-upstream)):
- **in-session** → resolve `executing-plans` SKILL.md path, Read as baseline (when available)
- **subagent** → resolve `subagent-driven-development` SKILL.md path, Read as baseline (when available)
- **cli** → [cli-driven-development](../cli-driven-development/SKILL.md) (Skill-invoke delegation, do not Read upstream)

The baseline is the SKILL.md file at the resolved path only — injected vendor docs are not the baseline (see [Rule: Read Upstream](../brainstorming/SKILL.md#rule-read-upstream)).

### Rule: Mode Selection

<HARD-GATE>
At startup, BEFORE any other action (before reading plan, before setup, before ANY tool call that touches the repo), use `AskUserQuestion` to let the user choose a mode (in-session | subagent | cli). Do NOT accept a mode pre-selection from a prior skill's handoff — the orchestrator always asks directly. After selection, call `cdd-session-activate.mjs minimal <session_key> <repo_root> --mode <mode>` to write `pending.mode`.
</HARD-GATE>

<HARD-GATE>
After CLI mode is selected, this session is PROHIBITED from using Write/Edit tools to modify repository deliverables (all git-tracked files and skill artifacts).
All code changes must go through cdd-task.mjs H6 chain. Stop immediately and report to user if a violation is detected.
</HARD-GATE>

### Rule: Task Complexity

Classify each task first: touches 1-2 files + mechanical implementation → **Simple**; 3+ files / cross-module / requires design judgment / user requests thoroughness → **Complex**. Affects diff scope, test gate, model tier.

### Rule: Confirm Once

spec+plan complete → cheapest implementer tier; confirm once before first dispatch.

### Rule: Fix Loop

`CHANGES_REQUESTED` → fix → scoped review → repeat until `APPROVED` or **5 rounds** (exceeded → STOP + escalate).

### Rule: Confirm Seams

Before dispatching a tdd implement worker, the orchestrator confirms test boundaries (seam) with the user in-session, writing the confirmation result `CONFIRMED_SEAMS: <...>` into the task brief. cli mode is fire-and-forget print-mode CLI that cannot block — `templates/cdd/implement.md` applies non-blocking ("if brief contains `CONFIRMED_SEAMS`, apply it"), seam confirmation is exclusive to the orchestrator layer.

### Rule: Per-Task Review

<HARD-GATE>
After each task implementation completes, you MUST read `$CDD_HANDOFF_PATH` (handoff.json) to execute the Per-Task Review gate.
Only after APPROVED can you write to the ledger and advance to the next task.
Prohibited: skipping handoff read to proceed directly to the next task or compilation verification.
Applies to all modes: in-session / subagent / cli.
</HARD-GATE>

Per-task review gate: read handoff.json driven (plan_conflicts → STOP; CHANGES_REQUESTED → Fix Loop; NEEDS_CONTEXT/unverifiable → STOP). cli mode worker review runs inside the CLI subprocess; in-session/subagent mode review gate runs in-session. Discipline: see [controller-handoff.md](../../docs/controller-handoff.md) H1-H5.

### Rule: Quality Invariants

1. Test evidence gate (task-N-test-evidence.json)
2. plan_conflicts[] → human adjudication
3. unverifiable[] non-empty → BLOCKED
4. handoff NEEDS_CONTEXT → STOP

### Rule: Orchestrator Checklist

The orchestrator's three-phase loop per plan (shared skeleton across three modes; cli mode differences noted in Per-task parentheses):

**Setup (once):** in-session/subagent → `sdd-workspace`; cli → delegate workspace to [cli-driven-development](../cli-driven-development/SKILL.md) (built inside cdd-task.mjs H6 chain). Unified follow-up: ledger → read plan once → `plan-constraints.md` → pre-flight → todo per task.

**Per-task:** Rule: Task Complexity → Rule: Confirm Once → Rule: Confirm Seams (before tdd implement dispatch) → append `TASK_BASE: <sha>` to brief → execution chain (cli mode shell H6 chain: implement → review → fix per Rule: Fix Loop; in-session/subagent mode in-session implementation + review) → Read `handoff.json` only → Rule: Per-Task Review + Rule: Quality Invariants → `APPROVED` → ledger. cli mode **Never** edits repo deliverables in this session — H6 CLI only.

**Final:** [osuperpowers:code-review](../code-review/SKILL.md) whole-branch in-session → clean → [osuperpowers:finishing](../finishing/SKILL.md).

### Rule: D6 Aggregation

After all tasks APPROVED, aggregate deferred items (grep `deferred` substring, including no-jq fallback line `deferred not enumerated -- jq missing`) → **present to user** → **user decision gate** (all defer / name specific ones to fix) → if fix requested then **bounded final fix wave (one pass)**: one fix agent + scoped re-review.

End semantics:
- re-review clean → done, handoff `status` stays `APPROVED` (**not rewritten**), ledger keeps complete line (may append a line noting K items fixed)
- new blocker exposed → still one fix wave, then **unconditionally report to the user** (clean or not) -- **no cross-task fix loop**; remaining items are not silently dropped, report ends
- **round cap 5 applies only to single-task fix loop, not to cross-task final fix wave**

Mode B: user reads ledger after run ends to aggregate deferred; shell side has no extra end-of-run print.

### Rule: Ledger

Only `APPROVED` appends `Task N: complete` to `CDD_LEDGER`.

## Red Flags

- "CLI is available so skip mode selection" → all three modes must be asked (Rule: Mode Selection)
- "in-session also uses cdd-task.mjs" → in-session is in-session implementation, no CLI (Rule: Read Upstream)
- "Shove orchestrator decisions into cli-driven-development" → engine only handles execution (Rule: Read Upstream — cli branch)
- "User already chose subagent/inline in writing-plans handoff" → Mode Selection is a HARD-GATE, always ask directly (Rule: Mode Selection)
- "Start executing without calling AskUserQuestion" → Mode Selection must be the first action, before any repo tool call (Rule: Mode Selection)
- "Load from state with prior mode selection" → session restored with cached mode must still call AskUserQuestion (Rule: Mode Selection)
- "Use superpowers:subagent-driven-development / superpowers:executing-plans" → upstream references must be mapped to osuperpowers counterparts
- "Use Write/Edit to modify repository deliverables in CLI mode" → violates HARD-GATE Mode Selection (CLI prohibits inline editing); execute through cdd-task.mjs
- "Proceed directly to next task or compilation after implementation completes" → violates HARD-GATE Per-Task Review (gate); must first read `$CDD_HANDOFF_PATH`
- "Treat Per-Task Review as a 3-pass review to run" → Per-Task Review is a handoff.json read gate, not a 3-pass review from docs-review.md
- "Fix Loop must also follow docs-review.md stopping mechanism" → Fix Loop is task-review (APPROVED/CHANGES_REQUESTED); does not use docs-review.md
- "Treats injected vendor docs (CLAUDE.md / README) as the upstream baseline" → violates Rule: Read Upstream; the baseline is the SKILL.md file at the resolved path only
