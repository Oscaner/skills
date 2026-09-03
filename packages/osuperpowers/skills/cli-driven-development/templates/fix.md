# CDD fix — CLI session

**Workspace:** {{WORKSPACE}}

**Task brief:** {{BRIEF}}

**Open findings (scope: {{FINDINGS_SCOPE}}):** {{FINDINGS}}

**Handoff path (read for context, then update per fragment below):** {{HANDOFF}}

**Plan constraints:** {{CONSTRAINTS}}

## Instructions

1. Read open-findings at **`{{FINDINGS}}`** and the task brief at **`{{BRIEF}}`**
   (paths only for handoff context — do not paste full review axis bodies into prompts).
   **Scope `{{FINDINGS_SCOPE}}`**: `blocker-only` (default) → open-findings contains only
   non-deferred blocker findings; `deferred-sweep` → open-findings contains the deferred
   items selected by the user at deferred-disposition. open-findings covers only findings
   within the current scope; deferred items (in blocker-only scope) ride in handoff
   `findings[]` across rounds and do not enter the fix loop.
2. Fix issues per open-findings; stay within fix-loop scope (H4 incremental re-review uses `FIX_BASE..HEAD`).
3. Update `<workspace>/task-N-test-evidence.json` after running verification commands.
4. Update the implementer report at the path from the brief (or as the brief specifies for fix rounds).
5. **Commit (base/head contract):**
   - `base` = `{{FIXED_POINT}}`（fix 派发时的 `FIX_BASE`，即上次 handoff `commits.head`）。
   - 修复验证通过后：若本轮已产生**一个或多个**常规提交覆盖 fix 范围改动 → `head` = `git rev-parse HEAD`（不重复提交）。
   - 否则：创建**一个**常规提交（`fix:` 为主，或匹配改动的 `feat:`/`refactor:`），subject 对齐 fix 范围；无署名 / co-author / AI 生成尾注；然后 `head` = `git rev-parse HEAD`。
   - 本轮无 fix 范围改动（相对 `FIX_BASE` 无 diff）→ 不提交，`head` 保持原样。
   - 返回时仍有未提交改动 → `status: BLOCKED`（`cdd-task.mjs --harness <name>` 会强制校验）。
   - Only commit changes within this task brief scope. If you encounter uncommitted changes belonging to other tasks — do NOT stage, commit, or revert them; leave as-is. If out-of-scope uncommitted changes exist at return, write status: BLOCKED + `blocker:` listing the out-of-scope paths, so the orchestrator decides.
6. Write handoff per `## Handoff Output` below.
7. Do **not** write ledger.

## Return (H1 — stdout only)

Return **exactly 4 lines** to stdout; make this block the **final** output — nothing may follow it (stream-json harnesses parse the last block):

```
status: <APPROVED|BLOCKED>
commits: base=<sha> head=<sha>
artifacts: brief=<path> report=<path> test_evidence=<path>
blocker: <none|one-line>
```

Fix prose and test output live in files only.

## Handoff Output

Write/update `{{HANDOFF}}` per [`handoff-schema.md`](../docs/handoff-schema.md) from file paths only (per [`controller-handoff.md`](../docs/controller-handoff.md) H1–H2 file-only discipline).

### Segment: fix

1. Read handoff.json + open-findings.json.
2. Resolve non-deferred findings per fix outcome (remove fixed / update remaining).
3. **Preserve all `deferred: true` findings** from prior handoff `findings[]` — deferred
   items never enter the fix loop and never drop across rounds (blocker-only scope).
   **Exception: deferred-sweep scope** — sweep-resolved findings are removed from `findings[]`
   (fully resolved, not retained as deferred); unresolved findings remain `deferred: true`.
4. Update findings; set status per fix outcome (re-review decides final APPROVED/CHANGES_REQUESTED).
5. `commits.base` = `{{FIXED_POINT}}` (fix dispatch `FIX_BASE`); `commits.head` = `git rev-parse HEAD` (full 40-char SHA; never `--short`).
6. **`task` field is required and must be an integer** — write `"task": {{TASK}}` as a JSON integer (no quotes). Writing `"task": "{{TASK}}"` (string) causes schema validation failure.
7. **`phase` field is required** — always write `"phase": "fix"` in the handoff JSON. Missing `phase` causes schema validation failure on next dispatch.
8. **`findings` field is required** — always write `"findings": [...]` (or empty array) in the handoff JSON. Missing `findings` causes schema validation failure on next dispatch.
9. **`artifacts` field is required** — always write `"artifacts": { "brief": "...", "report": "..." }`. Missing `artifacts` causes schema validation failure.

### Self-validate

Before H1: `jq . {{HANDOFF}}` → check status/commits.base/commits.head non-null. Fail → `status: BLOCKED`.

### Atomicity

Implement+handoff in one process. Handoff write fails → H1 `status: BLOCKED`. Retry → full mode re-run (idempotent).
