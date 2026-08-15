# SDD CLI Orchestrator Reference (H6–H8)

> **SUPERSEDED:** this doc is the transition copy. The live reference is
> [`engineering/docs/cdd-reference.md`](../../engineering/docs/cdd-reference.md)
> (single runner `cdd-run.sh --harness <name>`); kept here for in-flight plans
> until the migration completes (P2).

> Worker discipline SOT: `{engineering}/templates/cdd/{implement,review,fix}.md` + `_handoff-write-fragment.md`
> Orchestrator gate discipline: `os-executing-plans`（H1–H5，见 [`engineering/docs/controller-handoff.md`](../../engineering/docs/controller-handoff.md)）
> **Rule 0 checklist 语义契约:** Rule 0 的三阶段 phase 标记与关键 token 不是 line-budget 瘦身目标 — 瘦身不得删除/压缩 checklist 的 phase 结构或关键 token；`cdd-orchestrator-line-budget.test.sh` 会断言（issue #52 Guard 1）。

## H6 — CLI dispatch (p1)

Per-task execution uses **plugin-bundled** shell scripts — one CLI agent invocation per mode; process exit destroys context.

1. **Detect harness** → `{engineering}/bin/engine/cdd-run.sh --harness <name>` (orchestrator resolves harness once; **no** runtime facade re-detecting CLI).
2. **Three modes** — one invocation each:

| `SDD_MODE` | Responsibility |
|------------|----------------|
| `implement` | implementer + `mattpocock-skills:tdd` → report + test-evidence.json + handoff write + H1 four-line contract |
| `review` | `review-package` shell (archive diff); `code-review` variant (D4; axis files; Step 5 override) + handoff write |
| `fix` | fix implementer + handoff write; reads open-findings; **+ commit contract** (post-run gate, see below) |

3. **Env contract** (paths only — **never** paste full plan into CLI env):

| Variable | Purpose |
|----------|---------|
| `SDD_WORKSPACE` | workspace root |
| `SDD_TASK_BRIEF` | brief path |
| `SDD_LEDGER` | progress.md |
| `SDD_MODE` | `implement` \| `review` \| `fix` |
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
{engineering}/bin/engine/cdd-run.sh --harness <name> --task N --mode implement
{engineering}/bin/engine/cdd-run.sh --harness <name> --task N --mode review
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

Batch blocks still run **one** 3-mode CLI chain; filenames use batch prefix:

| Item | Convention |
|------|------------|
| Handoff | `batch-<first>-<last>-handoff.json` |
| open-findings | `batch-<first>-<last>-open-findings.json` |
| Review reports | `batch-*-review-standards.md` / `batch-*-review-spec.md` |
| Diff scope | `FIRST_TASK_BASE..LAST_HEAD` |

**Exit codes:** `0` = OK; `1` = BLOCKED / not-supported harness (`CDD_BLOCKED:` on stderr); `2` = CLI missing → orchestrator **BLOCKED** (no p0 fallback).

**Post-run commit gate** (shared lib `engineering/bin/engine/lib/cdd-common.sh` — `cdd_validate_commit_contract`, spec §4.2): modes **implement** and **fix** are validated on return; **review** is a no-op. Signal is `git status --porcelain` against the repo resolved from the workspace — a **dirty working tree** (untracked files count as dirty, D3b strictness) rewrites the handoff to `status: BLOCKED` (jq; failed rewrite → still authoritative BLOCKED via `CDD_HANDOFF_UNWRITABLE`), prints `CDD_BLOCKED:` on stderr, and exits non-zero; H1 then reads the rewritten handoff (`_cdd_emit_h1_from_handoff`), so `status: BLOCKED` reaches the orchestrator even when the agent reported DONE.

- **Fail-open:** non-git workspace or `git` error → validation passes (return 0) — the gate never blocks on tooling failure.
- **Precondition:** `.superpowers/sdd/` is `*`-gitignored (repo `.gitignore` line `.superpowers`), so the workspace never trips the dirty check itself.
- **Ordering (spec v3):** commit-contract validation runs **before** H1 output — H1 must read the possibly-rewritten handoff, not the agent's stdout.

**Ledger:** orchestrator (mode A) or plan script (mode B) appends ledger line after handoff `APPROVED`. CLI subprocesses **do not** write ledger.

## H7 — No consumer-repo CLI scripts

Orchestrator / skill **must not** create `sdd-run-*.sh` or `scripts/sdd-*` in the consumer repo.

All CLI scripts live in `packages/engineering/bin/` (`cdd-run.sh` / `cdd-exec.sh` / `cdd-select.sh`); templates in `packages/engineering/templates/cdd/`. Version syncs with plugin release.

## H8 — CLI opt-in / opt-out

**Opt-in (default):** cursor/claude CLI in PATH and harness script exists → SDD Rule 7 **mandates** H6 three-mode chain.

**Opt-out priority (high → low):**

1. Orchestrator explicit `--no-cli`
2. Env `SDD_NO_CLI=1`
3. (Optional) project `.superpowers/sdd/config.json` `"cli": false`

Any opt-out hit → **p0** in-session (Rule 5/6 + H1–H5).

**Harness mapping (single runner `engineering/bin/engine/cdd-run.sh --harness <name>`):**

| Harness | CLI binary | Ship level |
|---------|------------|------------|
| **claude** | `claude` | **Full** |
| **cursor-agent** | `cursor-agent` | **Full** |
| **droid** | `droid` | **Full** |
| **pi** | `pi` | **Full** |
| **codex** | `codex` | **Not-supported** |
| **copilot** | `copilot` | **Not-supported** |
| **gemini** | `gemini` | **Not-supported** |

Not-supported harness selected → exit 1 → orchestrator **BLOCKED** (not p0 fallback). Full-harness CLI not in PATH → exit 2 → orchestrator **BLOCKED**.

## Mode B (opt-in / AFK)

**Mode B (opt-in / AFK):** `{engineering}/bin/engine/cdd-run.sh --harness <name> --plan <path>` reads plan + ledger; for each **pending task** runs the same 3-mode chain. Pending = no `Task N: complete` ledger line and handoff not `APPROVED` (or handoff missing). Batch blocks dispatch the entire batch's 3-mode chain once.

## SDD gate matrix

The orchestrator PreToolUse gate (`engineering/bin/lib/cdd-orchestrator-gate.sh`, p1-slim.2) blocks direct repo edits while a task is active. Judgment is one decision point — `cdd_gate_decide` resolves `active_ws` **once** (bound-ws first, scan only when unbound) and threads that same workspace through both phase and write checks.

The gate is fail-open until an active task resolves (spec 安全属性 / data-flow step 1):

| Tool | Condition | Decision |
|------|-----------|----------|
| any | `jq` missing — `cdd_gate_decide` returns allow before any check | **allow** (fail-open) |
| any | no pending file for the session | **allow** (fail-open) |
| any | pending expired (>24h) → pending cleared | **allow** (fail-open) |
| Write/Edit | path under `active_ws` | **allow** |
| Write/Edit | path under `.superpowers/sdd/**`, phase `orchestrating` | **allow** |
| Write/Edit | phase `inactive` / `task_complete` | **allow** |
| Write/Edit | any other repo path | **deny** |
| Bash/Shell | allowlist (`cdd-run.sh --harness <name>` / `sdd-workspace` / `task-brief` / `review-package`) | **allow** |
| Bash/Shell | read-only git verb (allowlist below) | **allow** |
| Bash/Shell | anything else — mutating git, `ls`/`echo`, heredoc writes, compound commands | **deny** |
| Bash/Shell | phase `inactive` / `task_complete` | **allow** |
| other tools | — | allow |

**Shell contract:**

- Read-only git diagnostics are allowed in every phase: `git status` / `git diff` / `git log` / `git show` / `git rev-parse` / `git branch` (read-only flags only `-a|-r|-v|--show-current`) / `git remote` (read-only flags only) / `git ls-files` / `git diff-tree`. Accepted forms: `git <verb> …`, `git -C <path> <verb> …`, `git --git-dir=<path> <verb> …`. Anything else — compound commands (`` && | ; > < $( ` ``), `git -C <path> -c k=v <verb>`, unknown flags, or a quote in the verb token or a branch/remote argument — fails verb extraction → **deny** (fail-closed).
- Repo changes flow **only** through the H6 implement shell (`cdd-run.sh --harness <name> --task N --mode implement`) or Write under the bound workspace — never via Bash (heredocs are rejected).
- Non-git read-only commands (`ls`, `echo`, …) are intentionally still denied (slim read-only set decision; see spec §Non-goals).

**Anti-hijack (stale workspace):** a task brief activates only when its `TASK_BASE` is a real git object — `git -C <repo> cat-file -e <sha>` (CWD-independent). Stub SHAs (`TASK_BASE: abc`) never activate a workspace. When the session is bound (`pending.workspace`), `cdd_resolve_workspace` wins and the gate never scans unrelated workspaces.

**Test override:** `CDD_GATE_FIXTURES_ROOT` replaces `.superpowers/cdd` resolution in `cdd_find_active_workspace` / `cdd_gate_decide` — gate tests point it at temp copies of `engineering/tests/fixtures/cdd-gate/` (git-init'ed, brief `<SHA>` placeholders injected) and never touch the real tree. See `engineering/tests/cdd-gate-allow-deny-smoke.sh`.
