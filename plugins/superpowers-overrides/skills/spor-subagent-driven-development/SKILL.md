---
name: spor-subagent-driven-development
description: MUST invoke BEFORE superpowers:subagent-driven-development as your FIRST tool call this turn — trigger on ANY of: (1) user types `/spor-subagent-driven-development`, `/superpowers-overrides:spor-subagent-driven-development`, `/subagent-driven-development` or `/superpowers:subagent-driven-development`; (2) a `<command-name>` tag in the current turn names either of those; (3) the superpowers:subagent-driven-development skill body appears in the current turn's system context; (4) user asks in natural language to dispatch or orchestrate subagents, delegate implementation, or run multi-agent work. Applies personal overrides (code-review per-task review; handoff-writer; token-efficient controller handoff; implementer subagents delegate to mattpocock-skills:tdd; cheap model for implementers when spec and plan are complete).
---

# Subagent-Driven Development Overrides

## Rules

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

- code-review diff scope (`review_scope`: task vs plan — see Rule 5)
- test evidence gate hardness (Rule 6)
- implementer model tier (Rule 4)

**Per-task review chain is identical for Simple and Complex:** one `mattpocock-skills:code-review` invocation + handoff-writer implement segment + handoff-writer review segment (no multi-pass spor reviewers).

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
4. Repeat until `APPROVED` or **5 fix rounds** — then STOP (H4)

Do not advance to next plan task with open blocker findings.

### Rule 3 — Implementer subagents delegate to `mattpocock-skills:tdd`

When dispatching an **implementer** subagent to write code, delegate implementation discipline to [`mattpocock-skills:tdd`](https://github.com/mattpocock/skills/blob/main/skills/engineering/tdd/SKILL.md). This fills the gap where the upstream skill specifies *how to review* but leaves *how to implement* unopinionated. Its rules live in that skill — do not re-implement here.

1. Instruct each implementer dispatch to invoke `mattpocock-skills:tdd` via the Skill tool and follow its red-green-refactor loop.
2. Confirm the seams under test with the user before the implementer writes tests (the skill's own precondition).
3. Exemption: pure-mechanical edits with **no behavioral change and no schema/config change** — renames, whitespace, comment reflow, **Markdown skill docs with no runtime behavior**. Config files (route tables, feature flags, DB migrations, dependency versions, build configuration) are NOT exempt — they can silently change behavior. When in doubt, use TDD.
4. If `mattpocock-skills:tdd` fails to load (Skill tool error — i.e. plugin is installed but skill fails to load): surface the exact error to the user and ask whether to proceed manually per that skill's discipline or wait for the plugin to be repaired. Do not paraphrase `tdd`'s rules from memory. If `mattpocock-skills` is not installed, degrade silently — implementer subagents proceed without invoking the skill.

Implementers must write `<workspace>/task-N-test-evidence.json` and report.md before returning H1 contract (Rule 5 step 1).

### Rule 4 — Use cheaper models for implementers when spec and plan are complete

When both a spec doc and an implementation plan exist and satisfy ALL of:

1. No TBD / "to be decided" items in the spec.
2. Plan steps are concrete enough to execute without inferring intent.
3. No open design questions (auth, data models, API shapes all resolved).

…then implementer subagents MUST use the cheapest capable model available in the current environment:

- **Claude Code** — check environment variables or session config for the available model tier; pick the lowest tier that can follow the plan.
- **Cursor** — use Composer (it is already a cheaper-model interface by default).

**code-review** dual-axis subagents and upstream final whole-branch review stay on the default model. **handoff-writer** uses the cheapest capable tier (structured extraction).

**Before first dispatch in each session:** confirm — "Spec and plan look complete — I'll use a cheaper model for implementers. OK?"

### Rule 5 — Per-task review via code-review + handoff-writer

Per-task review **replaces** upstream task-reviewer multi-pass flow. Controller discipline: [`spor-token-efficient-controller-handoff`](../spor-token-efficient-controller-handoff/SKILL.md) H1–H5.

**Sequence:**

1. **Implementer** completes → writes `task-N-report.md` + `task-N-test-evidence.json` → returns H1 four-line contract.
2. **handoff-writer** (implement segment) → writes/updates handoff.json (`phase: implement`).
3. **review-package** shell → stdout one line only; orchestrator does not Read diff.
4. **code-review** — dispatch [`mattpocock-skills:code-review`](https://github.com/mattpocock/skills/blob/main/skills/engineering/code-review/SKILL.md) with brief override:
   - fixed point: Simple → `TASK_BASE`; Complex → `PLAN_BASE`; batch → `FIRST_TASK_BASE`
   - spec: task brief + plan Global Constraints paths
   - standards: repo standards + plan constraints
   - **Override Step 5:** axes write `<workspace>/task-N-review-standards.md` and `task-N-review-spec.md`; stdout `WRITTEN: <path>` only; append `## Findings (D3)` JSON block per [`spor-token-efficient-review-dispatch`](../spor-token-efficient-review-dispatch/SKILL.md) D4
5. **handoff-writer** (review segment) → updates findings/status; writes open-findings if `CHANGES_REQUESTED`.
6. Orchestrator **Read handoff.json only**.
7. `plan_conflicts` non-empty → **STOP** — present to human before fix loop.
8. `CHANGES_REQUESTED` → Rule 2 fix loop.

Every handoff-writer and code-review dispatch is a **fresh** subagent — [`spor-subagent-lifecycle`](../spor-subagent-lifecycle/SKILL.md) Rule 2.

**Degradation** (`mattpocock-skills` not installed):

- H1, H3, H5 discipline still apply where possible
- Per-task review falls back to upstream `task-reviewer-prompt.md`
- **No** handoff-writer; H2 relaxed for task-reviewer output only
- H4 scoped code-review variant not available
- Warn once before first per-task review

If plugin installed but `code-review` load fails → ask user: wait / manual degrade / pause.

### Rule 6 — Quality invariants

1. **Test evidence gate** — data from `task-N-test-evidence.json`; soft vs hard per Rule 1 complexity + behavior_change signals (see handoff-writer skill).
2. **Plan-mandated conflicts** — deliberate plan/brief violations → `plan_conflicts[]`; human adjudication before fix loop (Rule 5 step 7).
3. **Unverifiable** — axis reports flag unverifiable items → `unverifiable[]`; **non-empty → BLOCKED** until user confirms or writer re-run clears list.
4. **NEEDS_CONTEXT** — handoff status → orchestrator STOP; request user context before resuming review/fix.

## Red Flags — STOP if you catch yourself thinking any of these

- "Simple task — I'll use upstream task-reviewer, it's faster."
- "I'll Read the Spec axis report to decide if we're done."
- "Complex means 3 review rounds — old Rule 1."
- "Skip test-evidence.json — report has stdout."
- "handoff-writer can wait until plan end."
- "Batch of simple tasks — one round each."

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "code-review is overkill for tiny tasks" | p0 program invariant — delegation is the token win. |
| "I'll merge axis reports myself" | H5 forbids it — handoff-writer exists for structured extraction. |
| "3 files is soft boundary" | Hard boundary for complexity classification — affects diff scope. |
| "Degradation path is the main path" | Degrade only when mattpocock-skills absent; warn once. |
| "Fix round 6 will work" | H4 cap is 5 — STOP and escalate. |
