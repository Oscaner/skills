# CDD CLI Orchestrator Reference (H6–H8)

> Worker discipline SOT: `../templates/cdd/{implement,task-review,fix}.md` + `_handoff-write-fragment.md`
> Orchestrator gate discipline: [`docs/controller-handoff.md`](controller-handoff.md) H1–H5
> **Rule 0 checklist 语义契约:** Rule 0 的三阶段 phase 标记与关键 token 不是 line-budget 瘦身目标 — 瘦身不得删除/压缩 checklist 的 phase 结构或关键 token；`bin/engine/tests/templates.test.mjs` 会断言（issue #52 Guard 1）。

## H6 — CLI dispatch (p1)

Per-task execution uses **plugin-bundled** Node CLI entry scripts (`bin/engine/*.mjs`) — one CLI agent invocation per mode; process exit destroys context.

1. **Detect harness** → 经 [cli-select](../skills/cli-select/SKILL.md) 选定 harness → `{plugin_root}/bin/engine/cdd-run.mjs --harness <name>`（orchestrator 选一次；**无** runtime 重新检测）。
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
cdd-run.mjs --harness <name> --task N --mode implement
cdd-run.mjs --harness <name> --task N --mode task-review
```

Orchestrator / plan script sets `CDD_WORKSPACE` and path env vars before each CLI invocation; CLI **does not** Read the full plan file.

**Workspace path contract (§2.2a):**

| Path | Purpose |
|------|---------|
| `<workspace>/progress.md` | ledger (`CDD_LEDGER`) |
| `<workspace>/task-N-brief.md` | task brief (`CDD_TASK_BRIEF`) |
| `<workspace>/task-N-handoff.json` | handoff (single task) |
| `<workspace>/batch-<first>-<last>-handoff.json` | handoff (batch) |
| `<workspace>/plan-constraints.md` | orchestrator excerpt from plan Global Constraints (`CDD_PLAN_CONSTRAINTS`) |

**Batching (§2.2b — inherits p0 §2.3):**

Batch blocks still run **one** 3-mode CLI chain; filenames use batch prefix:

| Item | Convention |
|------|------------|
| Handoff | `batch-<first>-<last>-handoff.json` |
| open-findings | `batch-<first>-<last>-open-findings.json` |
| Review reports | `batch-*-review-standards.md` / `batch-*-review-spec.md` |
| Diff scope | `FIRST_TASK_BASE..LAST_HEAD` |

**Exit codes:** `0` = OK; `1` = BLOCKED / not-supported harness (`CDD_BLOCKED:` on stderr); `2` = CLI missing → orchestrator **BLOCKED** (no p0 fallback); `3` = skills-missing → install-and-use channel 缺上游插件 → `CDD_BLOCKED: missing skills: <plugins>` on stderr + per-plugin install hint，orchestrator **BLOCKED**（区别于 2 = harness CLI 不存在；exit 3 = CLI 存在但 skills 插件未安装）。Nested CLI failure with no handoff → exit **1** (bash `cdd_exit_blocked` parity) + stderr `CDD_BLOCKED:` diagnostic; Node additionally writes a BLOCKED handoff with the CLI stderr in `blocker` — the only sanctioned divergence (spec §2.1 stderr-surfacing).

**Skills-missing gate** (runTask step 2.5, `bin/utils/skills-probe.mjs` + `skills-probe.config.mjs`): 全 mode（implement/task-review/fix）进入嵌套 CLI 前，per-harness 探测 required plugins（`superpowers` + `mattpocock-skills` + `osuperpowers` + `osuperpowers-router`，配置驱动）：

| 通道 | Harnesses | 缺失行为 |
|------|-----------|----------|
| install-and-use | claude / cursor-agent / droid / grok / qoder / codex / gemini / pi | **exit 3** + stderr per-plugin install hint（不进入嵌套 CLI） |
| init | opencode / trae / vibe / kiro | stderr 提示 `init harness <name>`（非 exit 3），任务照跑 |

探测路径按 harness：plugin-list（claude/grok）、skill-dir（cursor-agent/droid/qoder/codex/gemini）、package-list（pi）。探测本身失败（CLI 查询错/无权限）→ **fail-open allow**（exit 0 + warn）。`skills-probe.config.mjs` 的 `harnesses` 集合 = 12 个，MUST 与 P6b §2.5 通道分类逐一一致。

**Post-run commit gate** (Node module `bin/engine/lib/contract.mjs` — `validateCommitContract`, spec §4.2): modes **implement** and **fix** are validated on return; **task-review** is a no-op. Signal is `git status --porcelain` against the repo resolved from the workspace — a **dirty working tree** (untracked files count as dirty, D3b strictness) rewrites the handoff to `status: BLOCKED` (`rewriteHandoffBlocked`), prints `CDD_BLOCKED:` on stderr, and exits non-zero; H1 then reads the rewritten handoff (`h1FromHandoff`), so `status: BLOCKED` reaches the orchestrator even when the agent reported DONE.

- **Fail-open:** non-git workspace or `git` error → validation passes (return 0) — the gate never blocks on tooling failure.
- **Precondition:** `.superpowers/cdd/` is `*`-gitignored (repo `.gitignore` line `.superpowers`), so the workspace never trips the dirty check itself.
- **Ordering (spec v3):** commit-contract validation runs **before** H1 output — H1 must read the possibly-rewritten handoff, not the agent's stdout.

**Ledger:** orchestrator (mode A) or plan script (mode B) appends ledger line after handoff `APPROVED`. CLI subprocesses **do not** write ledger.

## H7 — No consumer-repo CLI scripts

Orchestrator / skill **must not** create `cdd-run*` or `scripts/cdd-*` in the consumer repo.

All CLI entry scripts live in `packages/osuperpowers/bin/engine/` (`cdd-run.mjs` / `cdd-exec.mjs` / `cdd-select.mjs` / `cdd-session-activate.mjs`); templates in `packages/osuperpowers/templates/cdd/`. Version syncs with plugin release. `{plugin_root}` resolution via `pluginRoot()`（`bin/gate/cdd-gate-core.mjs`）/ [cli-select](../skills/cli-select/SKILL.md).

## H8 — CLI opt-in / opt-out

**Opt-in (default):** selected harness CLI in PATH and registry `ship: full` → CDD H6 three-mode chain is **mandated**.

**Opt-out priority (high → low):**

1. Orchestrator explicit `--no-cli`
2. Env `CDD_NO_CLI=1`
3. (Optional) project `.superpowers/cdd/config.json` `"cli": false`

Any opt-out hit → **p0** in-session (Rule 5/6 + H1–H5).

**Harness registry:** `{plugin_root}/bin/engine/harness-registry.json` 声明每 harness 的 `cli` / `invoke` / `output` / `task_review_prefix` / `ship`，engine 经 `{plugin_root}/bin/engine/cdd-run.mjs` 读取（不再有 per-harness 脚本）。

| Ship | Harnesses |
|------|-----------|
| **Full** | claude, cursor-agent, droid, pi |
| **Not-supported** | codex, copilot, gemini |

not-supported harness selected → exit 1 → orchestrator **BLOCKED** (no p0 fallback). Selected harness CLI not in PATH → exit 2 → orchestrator **BLOCKED**.

## Mode B (opt-in / AFK)

**Mode B (opt-in / AFK):** `{plugin_root}/bin/engine/cdd-run.mjs --harness <name> --plan <path>` reads plan + ledger; for each **pending task** runs the same 3-mode chain. Pending = no `Task N: complete` ledger line and handoff not `APPROVED` (or handoff missing). Batch blocks dispatch the entire batch's 3-mode chain once.

## CDD gate matrix

The orchestrator PreToolUse gate（Node core `packages/osuperpowers/bin/gate/cdd-gate-core.mjs`，P4b 迁 Node）blocks direct repo edits while a task is active. Judgment is one decision point — `gateDecide` resolves the active workspace **once** (`pending.workspace` bound first, `findActiveWorkspace` scan only when unbound) and threads that same workspace through both phase and write checks.

The gate is fail-open until an active task resolves (spec 安全属性 / data-flow step 1):

| Tool | Condition | Decision |
|------|-----------|----------|
| any | adapter exception — adapter catches and returns allow (stderr recorded) | **allow** (fail-open) |
| any | no pending file for the session | **allow** (fail-open) |
| any | pending expired (>24h) → pending cleared | **allow** (fail-open) |
| Write/Edit | path under `active_ws` | **allow** |
| Write/Edit | path under `.superpowers/cdd/**`, phase `orchestrating` | **allow** |
| Write/Edit | phase `inactive` / `task_complete` | **allow** |
| Write/Edit | any other repo path | **deny** |
| Bash/Shell | allowlist（`cdd-run.mjs --harness <name>` / `task-brief` / `review-package`） | **allow** |
| Bash/Shell | read-only git verb (allowlist below) | **allow** |
| Bash/Shell | anything else — mutating git, `ls`/`echo`, heredoc writes, compound commands | **deny** |
| Bash/Shell | phase `inactive` / `task_complete` | **allow** |
| other tools | — | allow |

**Shell contract:**

- Read-only git diagnostics are allowed in every phase: `git status` / `git diff` / `git log` / `git show` / `git rev-parse` / `git branch` (read-only flags only `-a|-r|-v|--show-current`) / `git remote` (read-only flags only) / `git ls-files` / `git diff-tree`. Accepted forms: `git <verb> …`, `git -C <path> <verb> …`, `git --git-dir=<path> <verb> …`. Anything else — compound commands (`` && | ; > < $( ` ``), `git -C <path> -c k=v <verb>`, unknown flags, or a quote in the verb token or a branch/remote argument — fails verb extraction → **deny** (fail-closed).
- Repo changes flow **only** through the H6 implement shell (`cdd-run.mjs --harness <name> --task N --mode implement`) or Write under the bound workspace — never via Bash (heredocs are rejected).
- Non-git read-only commands (`ls`, `echo`, …) are intentionally still denied (slim read-only set decision; see spec §Non-goals).

**Anti-hijack (stale workspace):** a task brief activates only when its `TASK_BASE` is a real git object — `git -C <repo> cat-file -e <sha>` (CWD-independent). Stub SHAs (`TASK_BASE: abc`) never activate a workspace. When the session is bound (`pending.workspace`), the bound workspace wins and the gate never scans unrelated workspaces.

**Test override:** `CDD_GATE_FIXTURES_ROOT` replaces `.superpowers/cdd` resolution in `findActiveWorkspace` / `gateDecide` — the Node gate tests point it at temp copies of `tests/fixtures/cdd-gate/` (git-init'ed, brief `<SHA>` placeholders injected) and never touch the real tree. See `packages/osuperpowers/bin/gate/tests/cdd-gate-core.test.mjs`.
