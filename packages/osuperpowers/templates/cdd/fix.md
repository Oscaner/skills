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
6. Write handoff per `_handoff-write-fragment.md` fix segment.
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
