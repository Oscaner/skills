# cursor-agent CLI 重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 删除 spor-subagent-driven-development 中的 p0 fallback 降级路径，并将所有 Cursor CLI 调用从 `cursor agent` 迁移到 `cursor-agent` 独立 CLI。

**Architecture:** 两个独立变更串行执行。Task 1 修改单个 Markdown SKILL.md（文本编辑，无运行时副作用）。Task 2 修改三个脚本文件（bash + JS），均为字面量替换，无逻辑变更。

**Tech Stack:** Markdown、Bash、Node.js ESM；验证命令 `pnpm run validate`

## Global Constraints

- 不得修改 `spor-sdd-p0-fallback/SKILL.md` 本身
- 不得修改 `spor-executing-plans` SKILL.md
- 不得修改 `live-copy-edit-agent.mjs`
- `pnpm run validate` 必须全部通过
- 提交信息使用 conventional commits，无 attribution/co-author trailer

---

## File Map

| 文件 | 操作 | Task |
|------|------|------|
| `plugins/superpowers-overrides/skills/spor-subagent-driven-development/SKILL.md` | Modify | 1 |
| `plugins/impeccable/scripts/smoke-provider-hooks.mjs` | Modify | 2 |
| `plugins/superpowers-overrides/bin/sdd-run-task-cursor.sh` | Modify | 2 |
| `plugins/superpowers-overrides/bin/sdd-run-plan-cursor.sh` | Modify | 2 |

---

### Task 1: 精简 spor-subagent-driven-development SKILL.md

**Files:**
- Modify: `plugins/superpowers-overrides/skills/spor-subagent-driven-development/SKILL.md`

**Interfaces:**
- Consumes: 无前置任务依赖
- Produces: 更新后的 SKILL.md，供 Task 2 之后的 `pnpm run validate` 验证

- [ ] **Step 1: 删除 Rule 0b 整块**

  打开 `plugins/superpowers-overrides/skills/spor-subagent-driven-development/SKILL.md`，找到并删除以下完整段落（`#### Rule 0b — p0 fallback` 标题到段落结束）：

  ```
  #### Rule 0b — p0 fallback

  1. Triggers when Rule 7 item 2 applies (script exit **2** / opt-out).
  2. **Then** Read upstream `subagent-driven-development` skill body.
  3. Announce: `CLI unavailable — falling back to p0 in-session SDD.`
  4. Read `{plugin_root}/skills/spor-sdd-p0-fallback/SKILL.md`; Rules 3, 5b, 5c SOT lives there.
  5. Per-task commit: Rule 5b in p0-fallback skill (conventional commit; aligned with `implement.md`).
  ```

- [ ] **Step 2: 将 Rule 0a 标题改为 Rule 0，移除父标题**

  当前文件结构：
  ```
  ### Rule 0 — Path branch (p1-slim)

  #### Rule 0a — CLI-default
  ```

  修改为：
  ```
  ### Rule 0 — CLI-mandatory (p1)
  ```

  即：删除 `### Rule 0 — Path branch (p1-slim)` 行，将 `#### Rule 0a — CLI-default` 替换为 `### Rule 0 — CLI-mandatory (p1)`。

- [ ] **Step 3: 更新 Rule 7 item 2**

  找到 Rule 7 中的 item 2：
  ```
  2. CLI unavailable (script exit **2**) or opt-out (`--no-cli` / `SDD_NO_CLI=1` / config `"cli": false`) → **p0** Rule 0b → [`spor-sdd-p0-fallback`](../spor-sdd-p0-fallback/SKILL.md) + H1–H5 in-session.
  ```
  替换为：
  ```
  2. CLI unavailable (script exit **2**) or script not found → orchestrator **BLOCKED**. Report: script path attempted, harness, exit code. Do not fall back to in-session execution.
  ```

- [ ] **Step 4: 清理 Rule 5a 中的 p0 引用**

  找到 Rule 5a 中：
  ```
  STOP on `plan_conflicts`; `CHANGES_REQUESTED` → Rule 2 (CLI fix chain / p0 Rule 5c); `NEEDS_CONTEXT` or `unverifiable` → STOP.
  ```
  替换为：
  ```
  STOP on `plan_conflicts`; `CHANGES_REQUESTED` → Rule 2 (CLI fix chain); `NEEDS_CONTEXT` or `unverifiable` → STOP.
  ```

- [ ] **Step 5: 删除过时的 Red Flags 条目**

  在 Red Flags 列表中，找到并删除以下两行：
  ```
  - "Exit 2 means stop the plan."
  ```
  ```
  - "p0 fallback — skip the announce line." → see [`spor-sdd-p0-fallback`](../spor-sdd-p0-fallback/SKILL.md) Red Flags
  ```

- [ ] **Step 6: 删除过时的 Common Rationalizations 条目**

  在 Common Rationalizations 表格中，找到并删除以下行：
  ```
  | "Rule 7 only applies when user asks for CLI" | Opt-in default — CLI available → H6 mandatory unless opt-out. |
  ```

- [ ] **Step 6b: 更新 frontmatter description — 删除 `p0 fallback delegates tdd`**

  SKILL.md 第 3 行（frontmatter `description:` 字段末尾）含有 `p0 fallback delegates tdd;`。
  找到 description 字段中的以下片段：
  ```
  Applies personal overrides (CLI-default forbids upstream SDD load; p0 fallback delegates tdd; code-review per-task review; handoff-writer; token-efficient controller handoff; cheap model for implementers when spec and plan are complete).
  ```
  替换为（删除 `p0 fallback delegates tdd;` 短语）：
  ```
  Applies personal overrides (CLI-default forbids upstream SDD load; code-review per-task review; handoff-writer; token-efficient controller handoff; cheap model for implementers when spec and plan are complete).
  ```

- [ ] **Step 6c: 清理 Rule 0 item 1 中的 `not opt-out` 短语**

  找到 Rule 0（原 Rule 0a）的第 1 条：
  ```
  1. When Rule 7 item 1 applies (CLI available, not opt-out, not stub BLOCKED) → this session **must not** Read/Skill upstream `subagent-driven-development` **skill body** ...
  ```
  替换为（删除 `not opt-out,` 短语）：
  ```
  1. When Rule 7 item 1 applies (CLI available, not stub BLOCKED) → this session **must not** Read/Skill upstream `subagent-driven-development` **skill body** ...
  ```

- [ ] **Step 6d: 清理 Red Flags 中 `p0` 的另一处悬空引用**

  找到 Red Flags 列表中：
  ```
  - "Stub harness exit 1 — I'll fall back to p0."
  ```
  替换为（删除 `to p0` 部分，改为 BLOCKED）：
  ```
  - "Stub harness exit 1 — I'll fall back to p0." → exit 1 means BLOCKED, not p0 fallback.
  ```
  > 注：此条目改为带注释形式而非删除，因为它仍然是有效的 Red Flag（exit 1 → BLOCKED 是保留逻辑），只是措辞需要与删除 p0 概念保持一致。

- [ ] **Step 7: 运行 validate 并确认通过**

  ```bash
  cd /path/to/oscaner-skills  # 替换为实际仓库根路径，即 SKILL.md 所在仓库
  pnpm run validate
  ```

  预期：`ALL PASS`。如有失败，查看具体错误输出，修复后重跑。

- [ ] **Step 8: 验证无 p0 残留**

  运行以下命令，预期每一行均无输出：

  ```bash
  # 检查 Rule 0b 是否已删除
  grep -n "Rule 0b\|spor-sdd-p0-fallback\|SDD_NO_CLI" \
    plugins/superpowers-overrides/skills/spor-subagent-driven-development/SKILL.md
  # 预期：无输出

  # 检查 opt-out 是否已从 Rule 0 item 1 和 Rule 7 item 2 中删除
  grep -n "not opt-out\|opt-out.*SDD_NO_CLI\|p0.*Rule 0b\|p0.*fallback.*SKILL" \
    plugins/superpowers-overrides/skills/spor-subagent-driven-development/SKILL.md
  # 预期：无输出（注：Common Rationalizations 表格中 "unless opt-out" 已随 Rule 7 那行一起删除）
  ```

  > **注：** L75（`not p0 fallback`）、L102（`p0 program invariant`）是保留文本，不在删除范围内，无需担心。

- [ ] **Step 9: 提交**

  ```bash
  git add plugins/superpowers-overrides/skills/spor-subagent-driven-development/SKILL.md
  git commit -m "feat: remove p0 fallback from spor-sdd, make CLI mandatory"
  ```

---

### Task 2: 将所有 Cursor CLI 调用从 `cursor agent` 迁移到 `cursor-agent`

**Files:**
- Modify: `plugins/impeccable/scripts/smoke-provider-hooks.mjs`
- Modify: `plugins/superpowers-overrides/bin/sdd-run-task-cursor.sh`
- Modify: `plugins/superpowers-overrides/bin/sdd-run-plan-cursor.sh`

**Interfaces:**
- Consumes: Task 1 完成（validate 通过）
- Produces: 所有 Cursor CLI 调用使用 `cursor-agent`，`pnpm run validate` 通过

- [ ] **Step 1: 修改 `smoke-provider-hooks.mjs` — 四处 `run('agent'` 调用**

  打开 `plugins/impeccable/scripts/smoke-provider-hooks.mjs`，进行以下 4 处替换：

  **L652**（`runAgentChoiceCursor` 函数内）：
  ```js
  // 旧
  const res = run('agent', [
  // 新
  const res = run('cursor-agent', [
  ```

  **L828**（`runCursorProviderSmoke` 函数内）：
  ```js
  // 旧
  const res = run('agent', [
  // 新
  const res = run('cursor-agent', [
  ```

  **L875**（`ensureCursorAgent` 函数内，version check 第一次）：
  ```js
  // 旧
  const version = run('agent', ['--version'], {
  // 新
  const version = run('cursor-agent', ['--version'], {
  ```

  **L888**（`ensureCursorAgent` 函数内，安装后验证）：
  ```js
  // 旧
  run('agent', ['--version'], {
  // 新
  run('cursor-agent', ['--version'], {
  ```

- [ ] **Step 2: 修改 `smoke-provider-hooks.mjs` — 认证错误信息和正则（共 4 处）**

  **L667**（`runAgentChoiceCursor` 内的认证检测正则）：
  ```js
  // 旧
  if (/Authentication required|agent login|CURSOR_API_KEY/i.test(output)) {
  // 新
  if (/Authentication required|cursor-agent login|CURSOR_API_KEY/i.test(output)) {
  ```

  **L668**（`runAgentChoiceCursor` 内的错误信息）：
  ```js
  // 旧
  const err = new Error('Cursor CLI authentication required. Run `agent login` or set CURSOR_API_KEY, then rerun `bun run smoke:hooks -- --providers=cursor`.');
  // 新
  const err = new Error('Cursor CLI authentication required. Run `cursor-agent login` or set CURSOR_API_KEY, then rerun `bun run smoke:hooks -- --providers=cursor`.');
  ```

  **L844**（`runCursorProviderSmoke` 内的认证检测正则）：
  ```js
  // 旧
  if (/Authentication required|agent login|CURSOR_API_KEY/i.test(output)) {
  // 新
  if (/Authentication required|cursor-agent login|CURSOR_API_KEY/i.test(output)) {
  ```

  **L845**（`runCursorProviderSmoke` 内的错误信息）：
  ```js
  // 旧
  const err = new Error('Cursor CLI authentication required. Run `agent login` or set CURSOR_API_KEY, then rerun `bun run smoke:hooks -- --providers=cursor`.');
  // 新
  const err = new Error('Cursor CLI authentication required. Run `cursor-agent login` or set CURSOR_API_KEY, then rerun `bun run smoke:hooks -- --providers=cursor`.');
  ```

- [ ] **Step 3: 修改 `sdd-run-task-cursor.sh`**

  打开 `plugins/superpowers-overrides/bin/sdd-run-task-cursor.sh`，进行以下替换：

  **L4**（头部注释第一行）：
  ```bash
  # 旧
  # cursor agent invocation (source of truth for flags):
  # 新
  # cursor-agent invocation (source of truth for flags):
  ```

  **L5**（头部注释第二行）：
  ```bash
  # 旧
  #   cursor agent --print --output-format text --force "$prompt"
  # 新
  #   cursor-agent --print --output-format text --force "$prompt"
  ```

  **L8**（注释）：
  ```bash
  # 旧
  # SDD_DRY_RUN=1 skips cursor agent (argument parsing / orchestration smoke tests).
  # 新
  # SDD_DRY_RUN=1 skips cursor-agent (argument parsing / orchestration smoke tests).
  ```

  **L64**（CLI 存在性检测条件）：
  ```bash
  # 旧
  if [[ "${SDD_DRY_RUN:-}" != "1" ]] && ! command -v cursor >/dev/null 2>&1; then
  # 新
  if [[ "${SDD_DRY_RUN:-}" != "1" ]] && ! command -v cursor-agent >/dev/null 2>&1; then
  ```

  **L65**（CLI 缺失错误信息）：
  ```bash
  # 旧
    sdd_exit_cli_missing "cursor not found in PATH"
  # 新
    sdd_exit_cli_missing "cursor-agent not found in PATH"
  ```

  **L205**（实际 CLI 调用）：
  ```bash
  # 旧
  agent_out="$(cursor agent --print --output-format text --force "$prompt" 2>/dev/null)" || agent_rc=$?
  # 新
  agent_out="$(cursor-agent --print --output-format text --force "$prompt" 2>/dev/null)" || agent_rc=$?
  ```

  **L212**（退出错误信息）：
  ```bash
  # 旧
  sdd_exit_blocked "cursor agent exited ${agent_rc} and handoff missing"
  # 新
  sdd_exit_blocked "cursor-agent exited ${agent_rc} and handoff missing"
  ```

- [ ] **Step 4: 修改 `sdd-run-plan-cursor.sh`**

  打开 `plugins/superpowers-overrides/bin/sdd-run-plan-cursor.sh`，进行以下替换：

  **L5**（头部注释）：
  ```bash
  # 旧
  # SDD_DRY_RUN=1 propagates to task script (no live cursor agent).
  # 新
  # SDD_DRY_RUN=1 propagates to task script (no live cursor-agent).
  ```

  **L43**（CLI 存在性检测条件）：
  ```bash
  # 旧
  if [[ "${SDD_DRY_RUN:-}" != "1" ]] && ! command -v cursor >/dev/null 2>&1; then
  # 新
  if [[ "${SDD_DRY_RUN:-}" != "1" ]] && ! command -v cursor-agent >/dev/null 2>&1; then
  ```

  **L44**（CLI 缺失错误信息）：
  ```bash
  # 旧
    sdd_exit_cli_missing "cursor not found in PATH"
  # 新
    sdd_exit_cli_missing "cursor-agent not found in PATH"
  ```

- [ ] **Step 5: 运行 validate 并确认通过**

  ```bash
  pnpm run validate
  ```

  预期：`ALL PASS`。SDD CLI dry-run smoke 使用 `SDD_DRY_RUN=1` 跳过实际 cursor-agent 调用，无需真实安装 cursor-agent。

- [ ] **Step 6: 验证成功标准**

  ```bash
  # 确认 sdd-run 脚本中不再出现 cursor agent（空格版）
  grep -n "cursor agent" \
    plugins/superpowers-overrides/bin/sdd-run-task-cursor.sh \
    plugins/superpowers-overrides/bin/sdd-run-plan-cursor.sh
  # 预期：无输出

  # 确认 smoke 脚本中不再有 run('agent'
  grep -n "run('agent'" plugins/impeccable/scripts/smoke-provider-hooks.mjs
  # 预期：无输出
  ```

- [ ] **Step 7: 提交**

  ```bash
  git add \
    plugins/impeccable/scripts/smoke-provider-hooks.mjs \
    plugins/superpowers-overrides/bin/sdd-run-task-cursor.sh \
    plugins/superpowers-overrides/bin/sdd-run-plan-cursor.sh
  git commit -m "feat: migrate cursor CLI calls to cursor-agent independent CLI"
  ```
