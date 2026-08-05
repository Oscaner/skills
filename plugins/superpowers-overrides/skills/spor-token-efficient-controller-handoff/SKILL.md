---
name: spor-token-efficient-controller-handoff
description: Cross-cutting SDD orchestrator handoff discipline (H1–H8). Invoked by reference from spor-subagent-driven-development and spor-executing-plans, not directly by the user. No slash command. Governs file-only subagent returns, orchestrator Read bans, ledger-only memory, fix-loop scoping, mandatory handoff-writer dispatch, CLI per-invocation dispatch (p1), and plugin-bundled script constraints.
---

# Token-Efficient Controller Handoff

Cross-cutting policy for SDD / executing-plans orchestrators. Not user-triggered — referencing overrides cite H1–H8 here instead of paraphrasing.

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

### Rule H6 — CLI dispatch (p1)

Per-task execution uses **plugin-bundled** shell scripts — one CLI agent invocation per mode; process exit destroys context.

1. **Detect harness** → `{plugin_root}/bin/sdd-run-task-<harness>.sh` (orchestrator resolves harness once; **no** runtime facade re-detecting CLI).
2. **Four modes** — one invocation each:

| `SDD_MODE` | Responsibility |
|------------|----------------|
| `implement` | implementer + `mattpocock-skills:tdd` → report + test-evidence.json + H1 four-line contract |
| `handoff` | [`spor-handoff-writer`](../spor-handoff-writer/SKILL.md); `SDD_HANDOFF_SEGMENT=implement\|review\|fix` |
| `review` | `review-package` shell (archive diff); `code-review` variant (D4; axis files; Step 5 override) |
| `fix` | fix implementer; reads open-findings |

**Worker discipline SOT:** `templates/sdd-cli/{implement,handoff,review,fix}.md` — orchestrator must not paraphrase implement/review/fix delegation; cite templates only.

3. **Env contract** (paths only — **never** paste full plan into CLI env):

| Variable | Purpose |
|----------|---------|
| `SDD_WORKSPACE` | workspace root |
| `SDD_TASK_BRIEF` | brief path |
| `SDD_LEDGER` | progress.md |
| `SDD_MODE` | `implement` \| `handoff` \| `review` \| `fix` |
| `SDD_HANDOFF_SEGMENT` | when `handoff` mode: `implement` \| `review` \| `fix` |
| `SDD_FINDINGS` | fix mode: open-findings.json |
| `SDD_PLAN_CONSTRAINTS` | `<workspace>/plan-constraints.md` (orchestrator prewrites) |
| `SDD_HANDOFF_PATH` | target handoff.json path |
| `SDD_REVIEW_FIXED_POINT` | review: initial from handoff `commits.base`; fix-loop review: `FIX_BASE` |

4. **Output:** before exit, write/update `SDD_HANDOFF_PATH` (default `task-N-handoff.json` or batch variant); stdout ≤ H1 four lines; non-zero exit with no handoff → **BLOCKED**.
5. **Forbidden:** `--resume` or any CLI invocation that carries prior session history.

**Typical per-task shell sequence (mode A — thin orchestrator):**

```bash
sdd-run-task-<harness>.sh --task N --mode implement
sdd-run-task-<harness>.sh --task N --mode handoff --segment implement
sdd-run-task-<harness>.sh --task N --mode review
sdd-run-task-<harness>.sh --task N --mode handoff --segment review
```

Orchestrator / plan script sets `SDD_WORKSPACE` and path env vars before each shell; CLI **does not** Read the full plan file.

**Workspace path contract (§2.2a):**

| Path | Purpose |
|------|---------|
| `<workspace>/progress.md` | ledger (`SDD_LEDGER`) |
| `<workspace>/task-N-brief.md` | task brief (`SDD_TASK_BRIEF`) |
| `<workspace>/task-N-handoff.json` | handoff (single task) |
| `<workspace>/batch-<first>-<last>-handoff.json` | handoff (batch) |
| `<workspace>/plan-constraints.md` | orchestrator excerpt from plan Global Constraints (`SDD_PLAN_CONSTRAINTS`) |

**Batching (§2.2b — inherits p0 §2.3):**

Batch blocks still run **one** 4-mode CLI chain; filenames use batch prefix:

| Item | Convention |
|------|------------|
| Handoff | `batch-<first>-<last>-handoff.json` |
| open-findings | `batch-<first>-<last>-open-findings.json` |
| Review reports | `batch-*-review-standards.md` / `batch-*-review-spec.md` |
| Diff scope | `FIRST_TASK_BASE..LAST_HEAD` |

**Exit codes:** `0` = OK; `1` = BLOCKED / stub harness (`HARNESS_STUB:` on stderr); `2` = CLI missing → orchestrator silently falls back to p0 in-session (H1–H5).

**Ledger:** orchestrator (mode A) or plan script (mode B) appends ledger line after handoff `APPROVED`. CLI subprocesses **do not** write ledger.

### Rule H7 — No consumer-repo CLI scripts

Orchestrator / skill **must not** create `sdd-run-*.sh` or `scripts/sdd-*` in the consumer repo.

All CLI scripts live in `plugins/superpowers-overrides/bin/`; templates in `plugins/superpowers-overrides/templates/sdd-cli/`. Version syncs with plugin release. `{plugin_root}` resolution matches [`spor-init`](../spor-init/SKILL.md).

### Rule H8 — CLI opt-in / opt-out

**Opt-in (default):** cursor/claude CLI in PATH and harness script exists → SDD Rule 7 **mandates** H6 four-mode chain.

**Opt-out priority (high → low):**

1. Orchestrator explicit `--no-cli`
2. Env `SDD_NO_CLI=1`
3. (Optional) project `.superpowers/sdd/config.json` `"cli": false`

Any opt-out hit → **p0** in-session (Rule 5/6 + H1–H5).

**Harness mapping:**

| Harness | Task script | Plan script | Ship level |
|---------|-------------|-------------|------------|
| **cursor** | `sdd-run-task-cursor.sh` | `sdd-run-plan-cursor.sh` | **Full** — `cursor agent` |
| **claude** | `sdd-run-task-claude.sh` | `sdd-run-plan-claude.sh` | **Full** — `claude` |
| **codex** | `sdd-run-task-codex.sh` | `sdd-run-plan-codex.sh` | **Stub** |
| **copilot** | `sdd-run-task-copilot.sh` | `sdd-run-plan-copilot.sh` | **Stub** |
| **gemini** | `sdd-run-task-gemini.sh` | `sdd-run-plan-gemini.sh` | **Stub** |

Stub harness selected → exit 1 → orchestrator **BLOCKED** (not p0 fallback). cursor/claude CLI not in PATH → exit 2 → p0 fallback.

**Mode B (opt-in / AFK):** `{plugin_root}/bin/sdd-run-plan-<harness>.sh --plan <path>` reads plan + ledger; for each **pending task** runs the same 4-mode chain. Pending = no `Task N: complete` ledger line and handoff not `APPROVED` (or handoff missing). Batch blocks dispatch the entire batch's 4-mode chain once.

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
| "I'll paste the plan into CLI env for context" | H6 env is paths only — CLI reads brief/constraints files, not full plan. |
| "Exit 2 means BLOCKED" | Exit 2 = CLI missing → silent p0 fallback; exit 1 = BLOCKED or stub. |
| "One long CLI session beats four invocations" | p1 exists to destroy context each invocation — no --resume. |
