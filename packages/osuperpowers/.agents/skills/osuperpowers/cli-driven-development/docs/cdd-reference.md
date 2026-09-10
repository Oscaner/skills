# CDD CLI Orchestrator Reference (H6-H8)

> Worker discipline SOT: `../templates/{implement,task-review,fix}.md`
> Orchestrator gate discipline: [`controller-handoff.md`](controller-handoff.md) H1-H5
> **Rule 0 checklist semantic contract:** The three-phase phase markers and key tokens in Rule 0 are not line-budget trimming targets — trimming must not delete/compress the checklist's phase structure or key tokens; `bin/tests/templates.test.mjs` asserts this.

## H6 — CLI dispatch (p1)

Per-task execution uses the **cdd-engine** single CLI bin (`cdd`) — one CLI agent invocation per mode; process exit destroys context.

1. **Host harness** → resolved by the engine from ambient environment markers (`CLAUDE_CODE_SESSION_ID` → claude, `CURSOR_TRACE_ID` → cursor-agent; empty → BLOCK) — there is no harness selection step and `cdd` accepts no `--harness` flag (T2/T3).
2. **Three modes** — one invocation each:

| `CDD_MODE` | Responsibility |
|------------|----------------|
| `implement` | implementer + `mattpocock-skills:tdd` → report + test-evidence.json + handoff write + H1 four-line contract |
| `task-review` | `review-package` shell (archive diff); axis review via `cdd review --type task` direct dispatch (D4; axis files; Step 5 override) + handoff write |
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

**Typical per-task CLI sequence (thin orchestrator):**

```bash
cdd implement --task N
cdd review --type task --task N
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

**Exit codes:** `0` = OK; `1` = BLOCKED (`CDD_BLOCKED:` on stderr); `2` = host harness CLI missing → orchestrator **BLOCKED** (no p0 fallback). Nested CLI failure with no handoff → exit **1** (bash `cdd_exit_blocked` parity) + stderr `CDD_BLOCKED:` diagnostic; Node additionally writes a BLOCKED handoff with the CLI stderr in `blocker` — the only sanctioned divergence (spec section 2.1 stderr-surfacing).

**Post-run commit gate** (Node module `lib/contract.mjs` — `validateCommitContract`, spec section 4.2): modes **implement**, **fix**, and **review** are validated on return (T7 wired review into the runner's post-run step). Signal is `git status --porcelain` against the repo resolved from the workspace — a **dirty working tree** (untracked files count as dirty — full strictness) rewrites the handoff to `status: BLOCKED` (`rewriteHandoffBlocked`), prints `CDD_BLOCKED:` on stderr, and exits non-zero; H1 then reads the rewritten handoff (`h1FromHandoff`), so `status: BLOCKED` reaches the orchestrator even when the agent reported DONE. On a clean tree, **implement/fix** additionally check `handoff.commits.head` against the live `HEAD` (F1); **review** skips the head check — its `commits` describe the reviewed commit, not this dispatch's product.

- **Fail-open:** no repo root / non-git workspace or `git` error → validation passes (return 0) — the gate never blocks on tooling failure.
- **Precondition:** `.superpowers/cdd/` is `*`-gitignored (repo `.gitignore` line `.superpowers`), so the workspace never trips the dirty check itself.
- **Ordering (spec v3):** commit-contract validation runs **before** H1 output — H1 must read the possibly-rewritten handoff, not the agent's stdout.

**Ledger:** orchestrator appends ledger line after handoff `APPROVED`. CLI subprocesses **do not** write ledger.

## H7 — No consumer-repo CLI scripts

Orchestrator / skill **must not** create `cdd-*` wrappers or `scripts/cdd-*` in the consumer repo.

All CLI entry scripts live in the `@oscaner-skills/cdd-engine` npm package (`cdd`, installed globally); runtime templates in `packages/cdd-engine/templates/` (`task/` / `review/` / `schema/`). Version syncs with plugin release. `{plugin_root}` resolution via `pluginRoot()` — the cdd-engine `lib/templates.mjs` `PKG_ROOT` constant (P6 migrated into the engine; engine is self-contained, no gate-core / cli-select resolution).

## H8 — CLI opt-in / opt-out

**Opt-in (default):** host harness CLI in PATH and registry `ship: full` → CDD H6 three-mode chain is **mandated**.

**Opt-out priority (high → low):**

1. Orchestrator explicit `--no-cli`
2. Env `CDD_NO_CLI=1`
3. (Optional) project `.superpowers/cdd/config.json` `"cli": false`

Any opt-out hit → **p0** in-session (Rule 5/6 + H1-H5).

**Harness registry:** `bin/harness-registry.json` (in the cdd-engine package) declares the host harness's `cli` / `invoke` / `output` / `prefix`/`suffix` (per-mode) / `ship`; the engine reads it via `cdd`. The registry is converged to the two host-detected harnesses (T2): **claude** and **cursor-agent** (both `ship: full`) — there are no not-supported entries.

Host harness CLI not in PATH → exit 2 → orchestrator **BLOCKED**.
