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
3. Per-task worker discipline cite `templates/sdd-cli/{implement,handoff,review,fix}.md` — do **not** paraphrase Rule 3 / Rule 5b / Rule 5c bodies in the orchestrator session.
4. **Orchestrator duties** (inline — do not load upstream SDD for these):

   **Setup (once per session):**
   1. Run `scripts/sdd-workspace PLAN_FILE` → workspace path
   2. Ledger check/create: first line `# SDD ledger — plan: <plan path>`
   3. Read plan once → write `<workspace>/plan-constraints.md`
   4. Pre-flight: batch one question for plan conflicts / Global Constraints contradictions
   5. Todo per task

   **Per-task loop:**
   1. Rule 1: Simple/Complex classification; optional batching
   2. Rule 4: cheap-model confirmation before first H6 shell (once per session)
   3. Write `TASK_BASE: <sha>` into `task-N-brief.md` (`git rev-parse HEAD`) immediately before the first H6 shell of the chain; batch blocks use `FIRST_TASK_BASE`
   4. Shell H6 four-mode chain (Rule 7)
   5. Read handoff.json only → Rule 5a gates + Rule 6
   6. `CHANGES_REQUESTED` → Rule 2 fix loop (H6 fix/review/handoff segments; cap 5)
   7. `APPROVED` → append ledger line
   8. Continuous execution — **do not** repeat Setup mid-plan

   **Final (orchestrator in-session):**
   1. Dispatch `superpowers:requesting-code-review` whole-branch — no ad-hoc review
   2. Clean = no blocking findings + Rule 6 test evidence satisfied
   3. Clean → `superpowers:finishing-a-development-branch` (or spor override)
   4. No CLI dispatch for final review (p1 Q8)

5. Per-task review steps 2–8 **do not run in the orchestrator** under Rule 0a — H6 CLI subprocesses + templates implement them (Rule 5a guard).

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

### Rule 3 — Implementer subagents delegate to `mattpocock-skills:tdd` **(p0 fallback only)**

When Rule 0a applies, skip this rule — see `templates/sdd-cli/implement.md`.

When dispatching an **implementer** subagent to write code (Rule 0b / p0 path), delegate implementation discipline to [`mattpocock-skills:tdd`](https://github.com/mattpocock/skills/blob/main/skills/engineering/tdd/SKILL.md). This fills the gap where the upstream skill specifies *how to review* but leaves *how to implement* unopinionated. Its rules live in that skill — do not re-implement here.

1. Instruct each implementer dispatch to invoke `mattpocock-skills:tdd` via the Skill tool and follow its red-green-refactor loop.
2. Confirm the seams under test with the user before the implementer writes tests (the skill's own precondition).
3. Exemption: pure-mechanical edits with **no behavioral change and no schema/config change** — renames, whitespace, comment reflow, **Markdown skill docs with no runtime behavior**. Config files (route tables, feature flags, DB migrations, dependency versions, build configuration) are NOT exempt — they can silently change behavior. When in doubt, use TDD.
4. If `mattpocock-skills:tdd` fails to load (Skill tool error — i.e. plugin is installed but skill fails to load): surface the exact error to the user and ask whether to proceed manually per that skill's discipline or wait for the plugin to be repaired. Do not paraphrase `tdd`'s rules from memory. If `mattpocock-skills` is not installed, degrade silently — implementer subagents proceed without invoking the skill.

Implementers must write `<workspace>/task-N-test-evidence.json` and report.md before returning H1 contract (Rule 5b step 1).

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

**CLI-default (Rule 0a):** cheap-model confirmation happens once before the first H6 shell. CLI implement sessions use the harness default cheap tier — do **not** duplicate model selection in `implement.md`.

### Rule 5 — Per-task review (split by path)

#### Rule 5a — Orchestrator gates (both paths)

When Rule 0a applies, review-chain steps 2–8 in Rule 5c run inside H6 CLI subprocesses per `templates/sdd-cli/` — the orchestrator does **NOT** dispatch handoff-writer or code-review in-session.

Orchestrator **always**:

1. Read handoff.json only (H2)
2. `plan_conflicts` non-empty → **STOP** — present to human before fix loop (Rule 6)
3. `CHANGES_REQUESTED` → Rule 2 fix loop (CLI: shell fix chain; p0: Rule 5c)
4. `NEEDS_CONTEXT` or non-empty `unverifiable` → STOP

Cite [`spor-token-efficient-controller-handoff`](../spor-token-efficient-controller-handoff/SKILL.md) H1–H8.

#### Rule 5b — In-session implementer dispatch (p0 fallback only)

When Rule 0a applies, skip — `templates/sdd-cli/implement.md` is SOT.

**Sequence (step 1 only — p0 path):**

1. **Implementer** completes → writes `task-N-report.md` + `task-N-test-evidence.json` → returns H1 four-line contract.
   - Task brief before dispatch: run upstream `scripts/task-brief PLAN_FILE N`; brief path is single source of requirements.
   - Report file: brief `…/task-N-brief.md` → report `…/task-N-report.md`.
   - **Commit (p0-only):** after tests pass, one conventional commit (`feat:` / `fix:` / `refactor:` / …) with subject aligned to the task brief; no attribution / co-author / AI-generation trailers; record `base`/`head` in H1 for handoff-writer.

#### Rule 5c — In-session per-task review dispatch (p0 fallback only)

When Rule 0a applies, skip — H6 + `templates/sdd-cli/{handoff,review,fix}.md` is SOT.

Per-task review **replaces** upstream task-reviewer multi-pass flow (p0 path only).

**Sequence (steps 2–8):**

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
2. **Plan-mandated conflicts** — deliberate plan/brief violations → `plan_conflicts[]`; human adjudication before fix loop (Rule 5a / Rule 5c step 7).
3. **Unverifiable** — axis reports flag unverifiable items → `unverifiable[]`; **non-empty → BLOCKED** until user confirms or writer re-run clears list.
4. **NEEDS_CONTEXT** — handoff status → orchestrator STOP; request user context before resuming review/fix.

### Rule 7 — CLI dispatch when available (p1)

When cursor/claude CLI is available and `{plugin_root}/bin/sdd-run-task-<harness>.sh` exists:

1. Per-task execution **must** use H6 four-mode CLI chain — [`spor-token-efficient-controller-handoff`](../spor-token-efficient-controller-handoff/SKILL.md) H6–H8.
2. CLI unavailable (script exit **2**) or opt-out (`--no-cli` / `SDD_NO_CLI=1` / config `"cli": false`) → **p0** Rule 5b/5c/6 + H1–H5 in-session.
3. Stub harness selected (codex/copilot/gemini) → script exit **1** → orchestrator **BLOCKED** (not p0 fallback).
4. Orchestrator **still obeys Rule 6** after Read handoff: non-empty `plan_conflicts` → STOP; `NEEDS_CONTEXT` or non-empty `unverifiable` → STOP.
5. **Final whole-branch review** — orchestrator in-session only (not CLI-dispatched).
6. `{plugin_root}` resolution matches [`spor-init`](../spor-init/SKILL.md).

**Impl gate:** p1 CLI code ships only after p0 release tag (see p1 spec Q10).

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
