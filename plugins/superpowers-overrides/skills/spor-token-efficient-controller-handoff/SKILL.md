---
name: spor-token-efficient-controller-handoff
description: Cross-cutting SDD orchestrator handoff discipline (H1–H5; H6–H8 in docs/sdd-h6-reference.md). Invoked by reference from spor-subagent-driven-development and spor-executing-plans, not directly by the user. No slash command. Governs file-only subagent returns, orchestrator Read bans, ledger-only memory, fix-loop scoping, mandatory handoff-writer dispatch, CLI per-invocation dispatch (p1), and plugin-bundled script constraints.
---

# Token-Efficient Controller Handoff

Cross-cutting policy for SDD / executing-plans orchestrators. Not user-triggered — referencing overrides cite **H1–H5** here instead of paraphrasing; **H6–H8** → Read `{plugin_root}/docs/sdd-h6-reference.md`.

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

**open-findings:** `task-N-open-findings.json` or `batch-*-open-findings.json` (D3 shape; schema SOT `templates/sdd-handoff-schema.md`). Orchestrator: handoff.json only — not fix prose.

### Rule H5 — Handoff-writer subagent mandatory

After code-review axes complete, the orchestrator **must not** merge Standards/Spec prose itself.

Fresh [`spor-handoff-writer`](../spor-handoff-writer/SKILL.md) per lifecycle Rule 2 — implement/review/fix segments; paths only; `templates/sdd-handoff-writer-prompt.md` + `templates/sdd-handoff-schema.md`; cheapest model.

### Rule H6–H8 — CLI dispatch (reference)

Orchestrator: shell `sdd-run-task-<harness>.sh` per spor-SDD Rule 7; **do not** paraphrase env/exit/harness details — Read `{plugin_root}/docs/sdd-h6-reference.md` once per session if needed.

Worker discipline SOT remains `templates/sdd-cli/{implement,handoff,review,fix}.md`.

## Red Flags — STOP

- "I'll Read the review report to decide APPROVED — it's just one file."
- "I'll paste Task 2 summary into Task 5 dispatch for context."
- "Handoff-writer is overhead — I'll update handoff.json myself."
- "Fix round 6 is fine — one more try."
- "Batch review prose is short enough to Read inline."
- "I'll Write an sdd-run script in the project — faster than finding plugin_root."
- "CLI failed — I'll resume the same session with --resume."
- "Stub harness is good enough — I'll proceed in-session."

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "H2 slows me down" | Reading prose is how orchestrator context bloats — the whole p0 program exists to prevent this. |
| "Four lines is too strict" | Fixed keys make parser behavior deterministic at dispatch boundaries. |
| "I'll skip implement-segment writer" | Implement segment seeds handoff.json; skipping breaks review segment inputs. |
| "Degradation means H2 never applies" | Degradation relaxes H2 **only** on task-reviewer fallback — not when code-review is available. |
| "I'll paste the plan into CLI env for context" | See `docs/sdd-h6-reference.md` H6 env contract — do not paraphrase. |
| "Exit 2 means BLOCKED" | See `docs/sdd-h6-reference.md` H6 exit codes — do not paraphrase. |
| "One long CLI session beats four invocations" | See `docs/sdd-h6-reference.md` H6 — p1 four invocations; no --resume. |
