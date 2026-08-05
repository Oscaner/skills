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
3. **Orchestrator + worker (pointers only):**
   - Orchestrator: Setup/ledger/plan-constraints via upstream scripts + Rule 7 + controller-handoff H6–H8; per-task Rule 1 → Rule 4 (once) → TASK_BASE in brief → H6 → Rule 5a → Rule 6; final whole-branch review orchestrator in-session (no CLI final)
   - Worker discipline SOT: `templates/sdd-cli/{implement,handoff,review,fix}.md` — do not paraphrase Rule 3/5b/5c
   - CLI worker review steps run in H6 subprocesses only — see Rule 5a (orchestrator does NOT dispatch handoff-writer/code-review in-session)

#### Rule 0b — p0 fallback

1. Triggers when Rule 7 item 2 applies (script exit **2** / opt-out).
2. **Then** Read upstream `subagent-driven-development`; Rules 3, 5b, 5c apply in full; in-session Task/subagent flow.
3. Announce: `CLI unavailable — falling back to p0 in-session SDD.`
4. Per-task commit: implementer subagent follows upstream + Rule 3 + Rule 5b commit paragraph (conventional commit; aligned with `templates/sdd-cli/implement.md` semantics).

### Rule 1 — Task complexity (diff scope, test gate, model — not review rounds)

Classify each task first:

| Signal | Verdict |
|--------|---------|
| Touches 1–2 files, complete spec, mechanical implementation | **Simple** |
| Touches 3+ files or requires cross-module integration | **Complex** |
| Requires design judgment or architectural decisions | **Complex** |
| User explicitly requested thoroughness | **Complex** |

When in doubt, classify **Complex**.

Simple/Complex affects **only**:

- code-review diff scope (`review_scope`: task vs plan — see Rule 5a/5c)
- test evidence gate hardness (Rule 6)
- implementer model tier (Rule 4)

**Per-task review chain (Simple = Complex):** one code-review + handoff-writer implement + review segments — no multi-pass spor reviewers.

**Batching:** When multiple Simple tasks share the same feature area or files, batch as one block:

| Item | Convention |
|------|------------|
| Handoff | one `batch-<first>-<last>-handoff.json` |
| Review | one code-review + one handoff-writer review segment |
| Diff | `FIRST_TASK_BASE..LAST_HEAD`, `review_scope: batch` |
| Ledger | still one complete line per task |
| Test gate | hard if **any** batched task triggers hard gate |

Do **not** reclassify a batch as Complex for extra review rounds — batching changes scope files only.

### Rule 2 — Fix loop until approved (cap 5)

When handoff `status: CHANGES_REQUESTED`:

1. Fix implementer addresses open findings
2. Scoped code-review on `FIX_BASE..HEAD` only
3. Fresh handoff-writer (fix segment)
4. Repeat until `APPROVED` or **5 fix rounds** — then STOP (H4). Do not advance with open blockers.

### Rule 3 — Implementer subagents delegate to `mattpocock-skills:tdd` **(p0 fallback only)**

When Rule 0a applies, skip this rule — see `templates/sdd-cli/implement.md`.

When dispatching an **implementer** subagent to write code (Rule 0b / p0 path), delegate implementation discipline to [`mattpocock-skills:tdd`](https://github.com/mattpocock/skills/blob/main/skills/engineering/tdd/SKILL.md). Its rules live in that skill — do not re-implement here.

Exemption: mechanical Markdown skill docs with no runtime behavior. TDD load failure → surface error or degrade silently if plugin absent.

Implementers write test-evidence.json + report.md before H1 contract per `implement.md`.

### Rule 4 — Cheaper models when spec + plan complete

Requires: no TBD in spec, concrete plan steps, no open design questions. Implementers use cheapest capable tier (Cursor → Composer; Claude Code → lowest tier). code-review + final review stay default; handoff-writer cheapest.

Confirm once before first p0 dispatch or first H6 shell (Rule 0a). Do not duplicate model selection in `implement.md`.

### Rule 5 — Per-task review (split by path)

#### Rule 5a — Orchestrator gates (both paths)

When Rule 0a applies, orchestrator gates only — H6 + templates run worker review.

Orchestrator **always**:

1. Read handoff.json only (H2)
2. `plan_conflicts` non-empty → **STOP** — present to human before fix loop (Rule 6)
3. `CHANGES_REQUESTED` → Rule 2 fix loop (CLI: shell fix chain; p0: Rule 5c)
4. `NEEDS_CONTEXT` or non-empty `unverifiable` → STOP

Cite [`spor-token-efficient-controller-handoff`](../spor-token-efficient-controller-handoff/SKILL.md) H1–H8.

#### Rule 5b — In-session implementer dispatch (p0 fallback only)

When Rule 0a applies, skip — `templates/sdd-cli/implement.md` is SOT.

p0 path: dispatch implementer per upstream SDD Task Loop §1 (`implementer-prompt.md`); filenames brief → report + test-evidence; commit/H1 per `implement.md`.

#### Rule 5c — In-session per-task review (p0 fallback only)

When Rule 0a applies, skip — H6 + `templates/sdd-cli/` is SOT.

p0 path: handoff-writer + code-review per `templates/sdd-cli/{handoff,review,fix}.md`, `spor-handoff-writer`, and controller-handoff H1–H5; degradation per controller-handoff H2 degradation note + handoff-writer skill.

### Rule 6 — Quality invariants

1. **Test evidence gate** — data from `task-N-test-evidence.json`; soft vs hard per Rule 1 complexity + behavior_change signals (see handoff-writer skill).
2. **Plan-mandated conflicts** — deliberate plan/brief violations → `plan_conflicts[]`; human adjudication before fix loop (Rule 5a).
3. **Unverifiable** — axis reports flag unverifiable items → `unverifiable[]`; **non-empty → BLOCKED** until user confirms or writer re-run clears list.
4. **NEEDS_CONTEXT** — handoff status → orchestrator STOP; request user context before resuming review/fix.

### Rule 7 — CLI dispatch when available (p1)

When cursor/claude CLI is available and `{plugin_root}/bin/sdd-run-task-<harness>.sh` exists:

1. Per-task execution **must** use H6 four-mode CLI chain — [`spor-token-efficient-controller-handoff`](../spor-token-efficient-controller-handoff/SKILL.md) H6–H8.
2. CLI unavailable (script exit **2**) or opt-out (`--no-cli` / `SDD_NO_CLI=1` / config `"cli": false`) → **p0** Rule 5b/5c/6 + H1–H5 in-session.
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
- "p0 fallback — skip the announce line."

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "code-review is overkill for tiny tasks" | p0 program invariant — delegation is the token win. |
| "I'll merge axis reports myself" | H5 forbids it — handoff-writer exists for structured extraction. |
| "3 files is soft boundary" | Hard boundary for complexity classification — affects diff scope. |
| "Degradation path is the main path" | Degrade only when mattpocock-skills absent; warn once. |
| "Fix round 6 will work" | H4 cap is 5 — STOP and escalate. |
| "Rule 7 only applies when user asks for CLI" | Opt-in default — CLI available → H6 mandatory unless opt-out. |
| "I'll dispatch final review as mode=review" | Q8 — final whole-branch review stays orchestrator in-session. |
| "Rule 5c is redundant when CLI works" | Rule 0b requires full p0 path; 5c is the only in-session review dispatch. |
