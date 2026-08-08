# SDD CLI Orchestrator Reference (H6–H8)

> Worker discipline SOT: `templates/sdd-cli/{implement,handoff,review,fix}.md`
> Orchestrator gate discipline: `spor-token-efficient-controller-handoff` H1–H5

## H6 — CLI dispatch (p1)

Per-task execution uses **plugin-bundled** shell scripts — one CLI agent invocation per mode; process exit destroys context.

1. **Detect harness** → `{plugin_root}/bin/sdd-run-task-<harness>.sh` (orchestrator resolves harness once; **no** runtime facade re-detecting CLI).
2. **Four modes** — one invocation each:

| `SDD_MODE` | Responsibility |
|------------|----------------|
| `implement` | implementer + `mattpocock-skills:tdd` → report + test-evidence.json + H1 four-line contract |
| `handoff` | [`spor-handoff-writer`](../skills/spor-handoff-writer/SKILL.md); `SDD_HANDOFF_SEGMENT=implement\|review\|fix` |
| `review` | `review-package` shell (archive diff); `code-review` variant (D4; axis files; Step 5 override) |
| `fix` | fix implementer; reads open-findings |

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
6. **Session traceability:** CLI agents use one-shot print mode (`--print` / `--output-format text`), which does NOT register sessions in the `/resume` list or `~/.claude/sessions/`.

   | Concern | Approach |
   |---------|----------|
   | Audit trail | ledger (`progress.md`) + handoff files (`task-N-handoff.json`) + per-task reports (`task-N-report.md`) |
   | Recovery | re-run the orchestrator shell for that task+mode |
   | Rejected alternatives | `--session-id` (resume-only), `--name` (no session write in print mode), `--background` (daemon, incompatible with one-shot dispatch) |

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

## H7 — No consumer-repo CLI scripts

Orchestrator / skill **must not** create `sdd-run-*.sh` or `scripts/sdd-*` in the consumer repo.

All CLI scripts live in `plugins/superpowers-overrides/bin/`; templates in `plugins/superpowers-overrides/templates/sdd-cli/`. Version syncs with plugin release. `{plugin_root}` resolution matches [`spor-init`](../skills/spor-init/SKILL.md).

## H8 — CLI opt-in / opt-out

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

## Mode B (opt-in / AFK)

**Mode B (opt-in / AFK):** `{plugin_root}/bin/sdd-run-plan-<harness>.sh --plan <path>` reads plan + ledger; for each **pending task** runs the same 4-mode chain. Pending = no `Task N: complete` ledger line and handoff not `APPROVED` (or handoff missing). Batch blocks dispatch the entire batch's 4-mode chain once.

## SDD gate matrix

The orchestrator PreToolUse gate (`bin/lib/sdd-orchestrator-gate.sh`, p1-slim.2) blocks direct repo edits while a task is active. Judgment is one decision point — `sdd_gate_decide` resolves `active_ws` **once** (bound-ws first, scan only when unbound) and threads that same workspace through both phase and write checks.

The gate is fail-open until an active task resolves (spec 安全属性 / data-flow step 1):

| Tool | Condition | Decision |
|------|-----------|----------|
| any | `jq` missing — `sdd_gate_decide` returns allow before any check | **allow** (fail-open) |
| any | no pending file for the session | **allow** (fail-open) |
| any | pending expired (>24h) → pending cleared | **allow** (fail-open) |
| Write/Edit | path under `active_ws` | **allow** |
| Write/Edit | path under `.superpowers/sdd/**`, phase `orchestrating` | **allow** |
| Write/Edit | phase `inactive` / `task_complete` | **allow** |
| Write/Edit | any other repo path | **deny** |
| Bash/Shell | allowlist (`sdd-run-task-*` / `sdd-workspace` / `task-brief` / `review-package`) | **allow** |
| Bash/Shell | read-only git verb (allowlist below) | **allow** |
| Bash/Shell | anything else — mutating git, `ls`/`echo`, heredoc writes, compound commands | **deny** |
| Bash/Shell | phase `inactive` / `task_complete` | **allow** |
| other tools | — | allow |

**Shell contract:**

- Read-only git diagnostics are allowed in every phase: `git status` / `git diff` / `git log` / `git show` / `git rev-parse` / `git branch` (read-only flags only `-a|-r|-v|--show-current`) / `git remote` (read-only flags only) / `git ls-files` / `git diff-tree`. Accepted forms: `git <verb> …`, `git -C <path> <verb> …`, `git --git-dir=<path> <verb> …`. Anything else — compound commands (`` && | ; > < $( ` ``), `git -C <path> -c k=v <verb>`, unknown flags, or a quote in the verb token or a branch/remote argument — fails verb extraction → **deny** (fail-closed).
- Repo changes flow **only** through the H6 implement shell (`sdd-run-task-<harness>.sh --task N --mode implement`) or Write under the bound workspace — never via Bash (heredocs are rejected).
- Non-git read-only commands (`ls`, `echo`, …) are intentionally still denied (slim read-only set decision; see spec §Non-goals).

**Anti-hijack (stale workspace):** a task brief activates only when its `TASK_BASE` is a real git object — `git -C <repo> cat-file -e <sha>` (CWD-independent). Stub SHAs (`TASK_BASE: abc`) never activate a workspace. When the session is bound (`pending.workspace`), `sdd_resolve_workspace` wins and the gate never scans unrelated workspaces.

**Test override:** `SDD_GATE_FIXTURES_ROOT` replaces `.superpowers/sdd` resolution in `sdd_find_active_workspace` / `sdd_gate_decide` — gate tests point it at temp copies of `tests/fixtures/sdd-gate/` (git-init'ed, brief `<SHA>` placeholders injected) and never touch the real tree. See `tests/sdd-gate-allow-deny-smoke.sh`.
