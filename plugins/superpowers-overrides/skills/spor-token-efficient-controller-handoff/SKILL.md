---
name: spor-token-efficient-controller-handoff
description: Cross-cutting SDD orchestrator handoff discipline (H1–H5). Invoked by reference from spor-subagent-driven-development and spor-executing-plans, not directly by the user. No slash command. Governs file-only subagent returns, orchestrator Read bans, ledger-only memory, fix-loop scoping, and mandatory handoff-writer dispatch.
---

# Token-Efficient Controller Handoff

Cross-cutting policy for SDD / executing-plans orchestrators. Not user-triggered — referencing overrides cite H1–H5 here instead of paraphrasing.

**Workspace:** `<repo-root>/.superpowers/sdd/<plan-basename>/` (upstream `scripts/sdd-workspace`).

## Rules

### Rule H1 — File-only return contract

Subagents return the orchestrator **exactly 4 lines** (fixed keys, one key per line):

```
status: <DONE|BLOCKED>
commits: base=<sha> head=<sha>
artifacts: brief=<path> report=<path> test_evidence=<path>
blocker: <none|one-line>
```

Report bodies, review prose, diff full text, and test stdout **live in files only** — never in the dispatch return.

Implementers also write `<workspace>/task-N-test-evidence.json` before returning (see handoff-writer skill).

### Rule H2 — Orchestrator must not read full artifacts

The orchestrator **must not** Read:

- implementer report bodies (except via structured handoff.json)
- review-package diff contents
- code-review axis report bodies (`task-N-review-standards.md`, `task-N-review-spec.md`)

The orchestrator **may**:

- Read `task-N-handoff.json` or `batch-<first>-<last>-handoff.json` (JSON only)
- Run shell scripts and retain **one line** of stdout (e.g. review-package path, `WRITTEN: <path>`)

**Degradation:** when `mattpocock-skills` is not installed and review falls back to upstream `task-reviewer`, H2 is **relaxed** for that path only — orchestrator may Read task-reviewer output. H1 and H3 still apply.

### Rule H3 — Ledger-only memory

After a task completes, the orchestrator may reference:

- one ledger line in `<workspace>/progress.md`
- the next task's brief path

**Forbidden:** paste prior-task summaries, report excerpts, or review findings into later dispatch prompts (upstream SDD L223 hard enforce).

### Rule H4 — Fix loop is incremental

Re-review scope: `FIX_BASE..HEAD` only.

- `FIX_BASE` = `HEAD` recorded immediately before fix dispatch (usually prior handoff `commits.head`)
- Round cap: **5 fix rounds per task** (including post-review fix cycles); exceed → STOP and ask human

**open-findings files** (written by handoff-writer when `status: CHANGES_REQUESTED`):

| Scope | Path |
|-------|------|
| Single task | `<workspace>/task-N-open-findings.json` |
| Batch | `<workspace>/batch-<first>-<last>-open-findings.json` |

Full D3 findings schema — same shape as handoff `findings[]`. Fix-loop handoff-writer reads open-findings as input.

Orchestrator must not Read fix implementer prose — only updated handoff.json.

### Rule H5 — Handoff-writer subagent mandatory

After code-review axes complete, the orchestrator **must not** merge Standards/Spec prose itself.

Dispatch a **fresh** [`spor-handoff-writer`](../spor-handoff-writer/SKILL.md) subagent per [`spor-subagent-lifecycle`](../spor-subagent-lifecycle/SKILL.md) Rule 2:

- **Implement segment:** after implementer returns H1 contract
- **Review segment:** after code-review writes axis files
- **Fix segment:** after scoped re-review (fix loop)

Input: file paths only. Template: `templates/sdd-handoff-writer-prompt.md`. Model: cheapest capable tier (Composer / lowest Claude tier) — structured extraction only.

## Red Flags — STOP

- "I'll Read the review report to decide APPROVED — it's just one file."
- "I'll paste Task 2 summary into Task 5 dispatch for context."
- "Handoff-writer is overhead — I'll update handoff.json myself."
- "Fix round 6 is fine — one more try."
- "Batch review prose is short enough to Read inline."

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "H2 slows me down" | Reading prose is how orchestrator context bloats — the whole p0 program exists to prevent this. |
| "Four lines is too strict" | Fixed keys make parser behavior deterministic at dispatch boundaries. |
| "I'll skip implement-segment writer" | Implement segment seeds handoff.json; skipping breaks review segment inputs. |
| "Degradation means H2 never applies" | Degradation relaxes H2 **only** on task-reviewer fallback — not when code-review is available. |
