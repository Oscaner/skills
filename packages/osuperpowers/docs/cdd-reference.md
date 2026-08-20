# CDD CLI Orchestrator Reference (H6-H8)

> Worker discipline SOT: `../templates/cdd/{implement,task-review,fix}.md` + `_handoff-write-fragment.md`
> Orchestrator gate discipline: [`docs/controller-handoff.md`](controller-handoff.md) H1-H5
> **Rule 0 checklist semantic contract:** The three-phase phase markers and key tokens in Rule 0 are not line-budget trimming targets — trimming must not delete/compress the checklist's phase structure or key tokens; `bin/engine/tests/templates.test.mjs` asserts this (issue #52 Guard 1).

## H6 — CLI dispatch (p1)

Per-task execution uses **plugin-bundled** Node CLI entry scripts (`bin/engine/*.mjs`) — one CLI agent invocation per mode; process exit destroys context.

1. **Detect harness** → via [cli-select](../skills/cli-select/SKILL.md) to select harness → `{plugin_root}/bin/engine/cdd-task.mjs --harness <name>` (orchestrator selects once; **no** runtime re-detection).
2. **Three modes** — one invocation each:

| `CDD_MODE` | Responsibility |
|------------|----------------|
| `implement` | implementer + `mattpocock-skills:tdd` → report + test-evidence.json + handoff write + H1 four-line contract |
| `task-review` | `review-package` shell (archive diff); `code-review` variant (D4; axis files; Step 5 override) + handoff write |
| `fix` | fix implementer + handoff write; reads open-findings; **+ commit contract** (post-run gate, see below) |

3. **Env contract** (paths only — **never** paste full plan into CLI env):

| Variable | Purpose |
|----------|---------|
| `CDD_WORKSPACE` | workspace root |
| `CDD_TASK_BRIEF` | brief path |
| `CDD_LEDGER` | progress.md |
| `CDD_MODE` | `implement` \| `task-review` \| `fix` |
| `CDD_FINDINGS` | fix mode: open-findings.json |
| `CDD_PLAN_CONSTRAINTS` | `<workspace>/plan-constraints.md` (orchestrator prewrites) |
| `CDD_HANDOFF_PATH` | target handoff.json path |
| `CDD_TASK_REVIEW_FIXED_POINT` | task-review: initial from handoff `commits.base`; fix-loop task-review: `FIX_BASE` |

4. **Output:** before exit, write/update `CDD_HANDOFF_PATH` (default `task-N-handoff.json` or batch variant); stdout = H1 four lines as the final block (task-review mode may precede them with the review-package `wrote <diff>:` progress line — the last block is still the H1); non-zero exit with no handoff → **BLOCKED**.
5. **Forbidden:** `--resume` or any CLI invocation that carries prior session history.
6. **Session traceability:** CLI agents use one-shot print mode (`--print` / `--output-format text`), which does NOT register sessions in the `/resume` list or `~/.claude/sessions/`.

   | Concern | Approach |
   |---------|----------|
   | Audit trail | ledger (`progress.md`) + handoff files (`task-N-handoff.json`) + per-task reports (`task-N-report.md`) |
   | Recovery | re-run the orchestrator shell for that task+mode |
   | Rejected alternatives | `--session-id` (resume-only), `--name` (no session write in print mode), `--background` (daemon, incompatible with one-shot dispatch) |

**Typical per-task CLI sequence (mode A — thin orchestrator):**

```bash
cdd-task.mjs --harness <name> --task N --mode implement
cdd-task.mjs --harness <name> --task N --mode task-review
```

Orchestrator / plan script sets `CDD_WORKSPACE` and path env vars before each CLI invocation; CLI **does not** Read the full plan file.

**Workspace path contract (section 2.2a):**

| Path | Purpose |
|------|---------|
| `<workspace>/progress.md` | ledger (`CDD_LEDGER`) |
| `<workspace>/task-N-brief.md` | task brief (`CDD_TASK_BRIEF`) |
| `<workspace>/task-N-handoff.json` | handoff (single task) |
| `<workspace>/batch-<first>-<last>-handoff.json` | handoff (batch) |
| `<workspace>/plan-constraints.md` | orchestrator excerpt from plan Global Constraints (`CDD_PLAN_CONSTRAINTS`) |

**Batching (section 2.2b — inherits p0 section 2.3):**

Batch blocks still run **one** 3-mode CLI chain; filenames use batch prefix:

| Item | Convention |
|------|------------|
| Handoff | `batch-<first>-<last>-handoff.json` |
| open-findings | `batch-<first>-<last>-open-findings.json` |
| Review reports | `batch-*-review-standards.md` / `batch-*-review-spec.md` |
| Diff scope | `FIRST_TASK_BASE..LAST_HEAD` |

**Exit codes:** `0` = OK; `1` = BLOCKED / not-supported harness (`CDD_BLOCKED:` on stderr); `2` = CLI missing → orchestrator **BLOCKED** (no p0 fallback); `3` = skills-missing → install-and-use channel missing upstream plugin → `CDD_BLOCKED: missing skills: <plugins>` on stderr + per-plugin install hint, orchestrator **BLOCKED** (distinguished from 2 = harness CLI does not exist; exit 3 = CLI exists but skills plugin is not installed). Nested CLI failure with no handoff → exit **1** (bash `cdd_exit_blocked` parity) + stderr `CDD_BLOCKED:` diagnostic; Node additionally writes a BLOCKED handoff with the CLI stderr in `blocker` — the only sanctioned divergence (spec section 2.1 stderr-surfacing).

**Skills-missing gate** (runTask step 2.5, `bin/utils/skills-probe.mjs` + `skills-probe.config.mjs`): across all modes (implement/task-review/fix), before entering nested CLI, per-harness probing of required plugins (`superpowers` + `mattpocock-skills` + `osuperpowers` + `osuperpowers-router`, config-driven):

| Channel | Harnesses | Missing behavior |
|------|-----------|----------|
| install-and-use | claude / cursor-agent / droid / grok / qoder / codex / gemini / pi | **exit 3** + stderr per-plugin install hint (does not enter nested CLI) |
| init | opencode / trae / vibe / kiro | stderr hint `init harness <name>` (not exit 3), task runs anyway |

Probe path varies by harness: plugin-list (claude/grok), skill-dir (cursor-agent/droid/qoder/codex/gemini), package-list (pi). Probe itself fails (CLI query error / no permission) → **fail-open allow** (exit 0 + warn). The `harnesses` set in `skills-probe.config.mjs` = 12, and MUST be one-to-one consistent with P6b section 2.5 channel classification.

**Post-run commit gate** (Node module `bin/engine/lib/contract.mjs` — `validateCommitContract`, spec section 4.2): modes **implement** and **fix** are validated on return; **task-review** is a no-op. Signal is `git status --porcelain` against the repo resolved from the workspace — a **dirty working tree** (untracked files count as dirty, D3b strictness) rewrites the handoff to `status: BLOCKED` (`rewriteHandoffBlocked`), prints `CDD_BLOCKED:` on stderr, and exits non-zero; H1 then reads the rewritten handoff (`h1FromHandoff`), so `status: BLOCKED` reaches the orchestrator even when the agent reported DONE.

- **Fail-open:** non-git workspace or `git` error → validation passes (return 0) — the gate never blocks on tooling failure.
- **Precondition:** `.superpowers/cdd/` is `*`-gitignored (repo `.gitignore` line `.superpowers`), so the workspace never trips the dirty check itself.
- **Ordering (spec v3):** commit-contract validation runs **before** H1 output — H1 must read the possibly-rewritten handoff, not the agent's stdout.

**Ledger:** orchestrator (mode A) or plan script (mode B) appends ledger line after handoff `APPROVED`. CLI subprocesses **do not** write ledger.

## H7 — No consumer-repo CLI scripts

Orchestrator / skill **must not** create `cdd-task*` or `scripts/cdd-*` in the consumer repo.

All CLI entry scripts live in `packages/osuperpowers/bin/engine/` (`cdd-task.mjs` / `cdd-review.mjs` / `cdd-select.mjs` / `cdd-session-activate.mjs`); templates in `packages/osuperpowers/templates/cdd/`. Version syncs with plugin release. `{plugin_root}` resolution via `pluginRoot()` (`bin/gate/cdd-gate-core.mjs`) / [cli-select](../skills/cli-select/SKILL.md).

## H8 — CLI opt-in / opt-out

**Opt-in (default):** selected harness CLI in PATH and registry `ship: full` → CDD H6 three-mode chain is **mandated**.

**Opt-out priority (high → low):**

1. Orchestrator explicit `--no-cli`
2. Env `CDD_NO_CLI=1`
3. (Optional) project `.superpowers/cdd/config.json` `"cli": false`

Any opt-out hit → **p0** in-session (Rule 5/6 + H1-H5).

**Harness registry:** `{plugin_root}/bin/engine/harness-registry.json` declares each harness's `cli` / `invoke` / `output` / `task_review_prefix` / `ship`; the engine reads it via `{plugin_root}/bin/engine/cdd-task.mjs` (no more per-harness scripts).

| Ship | Harnesses |
|------|-----------|
| **Full** | claude, cursor-agent, droid, pi |
| **Not-supported** | codex, copilot, gemini |

Not-supported harness selected → exit 1 → orchestrator **BLOCKED** (no p0 fallback). Selected harness CLI not in PATH → exit 2 → orchestrator **BLOCKED**.

## Mode B (opt-in / AFK)

**Mode B (opt-in / AFK):** `{plugin_root}/bin/engine/cdd-task.mjs --harness <name> --plan <path>` reads plan + ledger; for each **pending task** runs the same 3-mode chain. Pending = no `Task N: complete` ledger line and handoff not `APPROVED` (or handoff missing). Batch blocks dispatch the entire batch's 3-mode chain once.

## CDD gate matrix

The orchestrator PreToolUse gate (Node core `packages/osuperpowers/bin/gate/cdd-gate-core.mjs`, P4b migrated to Node) blocks direct repo edits while a task is active. Judgment is one decision point — `gateDecide` resolves the active workspace **once** (`pending.workspace` bound first, `findActiveWorkspace` scan only when unbound) and threads that same workspace through both phase and write checks.

The gate is fail-open until an active task resolves (spec security property / data-flow step 1):

| Tool | Condition | Decision |
|------|-----------|----------|
| any | adapter exception — adapter catches and returns allow (stderr recorded) | **allow** (fail-open) |
| any | no pending file for the session | **allow** (fail-open) |
| any | pending expired (>24h) → pending cleared | **allow** (fail-open) |
| Write/Edit | path under `active_ws` | **allow** |
| Write/Edit | path under `.superpowers/cdd/**`, phase `orchestrating` | **allow** |
| Write/Edit | phase `inactive` / `task_complete` | **allow** |
| Write/Edit | any other repo path | **deny** |
| Bash/Shell | allowlist (`cdd-task.mjs --harness <name>` / `task-brief` / `review-package`) | **allow** |
| Bash/Shell | read-only git verb (allowlist below) | **allow** |
| Bash/Shell | anything else — mutating git, `ls`/`echo`, heredoc writes, compound commands | **deny** |
| Bash/Shell | phase `inactive` / `task_complete` | **allow** |
| other tools | — | allow |

**Shell contract:**

- Read-only git diagnostics are allowed in every phase: `git status` / `git diff` / `git log` / `git show` / `git rev-parse` / `git branch` (read-only flags only `-a|-r|-v|--show-current`) / `git remote` (read-only flags only) / `git ls-files` / `git diff-tree`. Accepted forms: `git <verb> ...`, `git -C <path> <verb> ...`, `git --git-dir=<path> <verb> ...`. Anything else — compound commands (`` && | ; > < $( ` ``), `git -C <path> -c k=v <verb>`, unknown flags, or a quote in the verb token or a branch/remote argument — fails verb extraction → **deny** (fail-closed).
- Repo changes flow **only** through the H6 implement shell (`cdd-task.mjs --harness <name> --task N --mode implement`) or Write under the bound workspace — never via Bash (heredocs are rejected).
- Non-git read-only commands (`ls`, `echo`, ...) are intentionally still denied (slim read-only set decision; see spec section Non-goals).

**Anti-hijack (stale workspace):** a task brief activates only when its `TASK_BASE` is a real git object — `git -C <repo> cat-file -e <sha>` (CWD-independent). Stub SHAs (`TASK_BASE: abc`) never activate a workspace. When the session is bound (`pending.workspace`), the bound workspace wins and the gate never scans unrelated workspaces.

**Test override:** `CDD_GATE_FIXTURES_ROOT` replaces `.superpowers/cdd` resolution in `findActiveWorkspace` / `gateDecide` — the Node gate tests point it at temp copies of `tests/fixtures/cdd-gate/` (git-init'ed, brief `<SHA>` placeholders injected) and never touch the real tree. See `packages/osuperpowers/bin/gate/tests/cdd-gate-core.test.mjs`.
