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
