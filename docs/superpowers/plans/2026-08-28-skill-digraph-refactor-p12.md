# P12 cli-timeout 实施计划

- **Spec**: `docs/superpowers/specs/2026-08-28-skill-digraph-refactor-p12-design.md` v1.0
- **Base**: `develop`（P11 已合并）
- **Branch**: `skill-digraph-refactor-p12`
- **CLI 调用**: background 模式

---

### Task 1: spawnCapture timeout + timeout defaults

**目标**：`cli-shared.mjs` 新增 timeoutMs 参数 + SIGTERM→SIGKILL fallback + timeout 返回结构。

### 修改文件

- `packages/osuperpowers/bin/engine/lib/cli-shared.mjs`

### 步骤

1. `spawnCapture` 新增可选参数 `timeoutMs`（默认 undefined = 无 timeout，向后兼容）
2. spawn 后启动 watchdog：setTimeout `timeoutMs` → 发送 SIGTERM
3. SIGTERM 后启动 `SIGKILL_DELAY_MS = 5000` timer → child.kill("SIGKILL")
4. child 退出后 clearTimeout + resolve
5. timeout 触发时：resolve `{ ok: false, code: -1, stdout: capturedSoFar, stderr: capturedSoFar, timedOut: true }`
6. SIGKILL 后仍无退出事件 → resolve `{ ok: false, code: -1, stdout, stderr, timedOut: true, unkillable: true }`
7. 正常退出时 resolve 结构不变（`{ ok, code, stdout, stderr }`）+ 新增 `timedOut: false`（可选，不破坏现有消费者）
8. 新增 `resolveTimeoutMs(env, mode)` 辅助函数：读取 per-mode env > 全局 env > 默认值，应用 30min 步进约束（非步进值向上取整）
9. 默认值常量：`DEFAULT_TIMEOUTS = { task: 1800_000, review: 1800_000, research: 1800_000 }`（均为 30min）
10. env 优先级：`CDD_TASK_TIMEOUT` / `CDD_REVIEW_TIMEOUT` / `CDD_RESEARCH_TIMEOUT`（per-mode）> `CDD_CLI_TIMEOUT`（全局）> DEFAULT_TIMEOUTS[mode]
11. `invokeCli` 透传 `timeoutMs` 到 `spawnCapture`（新增可选参数）

### 测试

- 新增 `tests/cli-shared.test.mjs` 测试用例：
  - `resolveTimeoutMs`: 无 env → 默认 1800s
  - `resolveTimeoutMs`: `CDD_CLI_TIMEOUT=3600` → 3600s
  - `resolveTimeoutMs`: `CDD_TASK_TIMEOUT=900` + `CDD_CLI_TIMEOUT=3600` → 900s（per-mode 优先）
  - `resolveTimeoutMs`: `CDD_CLI_TIMEOUT=60` → 1800s（30min 步进：60s 向上取整到 1800s）
  - `resolveTimeoutMs`: `CDD_CLI_TIMEOUT=1800` → 1800s（精确边界，无需取整）
  - `resolveTimeoutMs`: `CDD_CLI_TIMEOUT=1801` → 3600s（超过 30min 一步，向上取整到 3600s）
  - `resolveTimeoutMs`: mode 不在 defaults → 使用全局或 undefined
  - spawnCapture timeoutMs=100 + sleep 500 → timedOut: true, code: -1

### Commit

`fix(cli-shared): add timeout support to spawnCapture + resolveTimeoutMs helper (30min stepping)`

---

### Task 2: contract.mjs TIMEOUT status + runner.mjs partial handoff

**目标**：contract.mjs 接受 TIMEOUT status + runner.mjs timeout 路径写 partial handoff。

### 修改文件

- `packages/osuperpowers/bin/engine/lib/contract.mjs`
- `packages/osuperpowers/bin/engine/lib/runner.mjs`

### 步骤

1. `contract.mjs`：`normalizeHandoffStatus` 新增 `TIMEOUT` 到合法 status 集合（TIMEOUT 透传，无需映射）
2. `runner.mjs`（runTask 函数）：
   - 读取 `resolveTimeoutMs(env, "task")` 并传给 `invokeCli` 的 timeoutMs 参数
   - invokeCli 返回后检查 `result.timedOut`：
     - `timedOut === true && unkillable !== true` → timeout 正常路径：写 partial handoff（`status: TIMEOUT` + `blocker: "timeout after ${timeoutMs}ms"` + 已有 findings[] 保留）+ 递增 progress.md timeoutCount
     - `timedOut === true && unkillable === true` → BLOCKED 路径：写 BLOCKED handoff + `blocker: "process unkillable"`
     - `timedOut !== true` → 正常逻辑不变
3. runner.mjs 已有 fallback handoff-write 逻辑（runner.mjs:489-510），timeout 走同一路径但 status 字段为 TIMEOUT。**时序**：timeout partial handoff 须在 commit-contract 验证前写入（使 contract 验证 TIMEOUT status 而非 MISSING）
4. **timeoutCount 存储**：progress.md 新增 `# timeoutCount: N` header 行（plain-text 格式，非 JSON，与 progress.md 的 `Task N: complete` 行风格一致）。runner.mjs 新增辅助函数 `readTimeoutCount(progressPath)` / `writeTimeoutCount(progressPath, n)`：首次 timeout 时若 header 不存在则初始化为 0 再递增
5. `cdd-review.mjs`：读取 `resolveTimeoutMs(env, "review")` 传给 invokeCli；timeout 时若 `--handoff PATH` 参数存在则写 partial handoff（`status: TIMEOUT` + 已有 findings）到该路径；若 `--handoff` 不存在则 timeout 仅返回 `timedOut: true`（silent no-op，cdd-review 无 workspace 是预期行为，不 warning）
6. smoke test（本 Task 内）：设置 `CDD_TASK_TIMEOUT=1` + mock harness sleep >1s → dispatch → 验证 handoff status = TIMEOUT + timedOut: true + partial artifacts 存在

### 测试

- 新增/扩展 `tests/runner.test.mjs`：
  - TIMEOUT status 被 contract.mjs normalizeHandoffStatus 接受
  - runner.mjs timeout 路径：mock invokeCli 返回 timedOut:true → handoff status = TIMEOUT + partial findings 保留
  - runner.mjs unkillable 路径：mock invokeCli 返回 timedOut:true + unkillable:true → handoff status = BLOCKED
  - timeoutCount 初始化 + 递增（首次 timeout → timeoutCount: 1，第二次 → timeoutCount: 2）
- 新增 `tests/review.test.mjs` timeout 测试：mock invokeCli 返回 timedOut:true → review handoff status = TIMEOUT

### Commit

`fix(engine): add TIMEOUT status to contract.mjs + partial handoff write in runner.mjs`

---

### Task 3: cli-driven-development TIMEOUT exit + cli-research TIMEOUT exit + zh-CN

**目标**：SKILL.md 图和节点定义新增 TIMEOUT 路由。

### 修改文件

- `packages/osuperpowers/skills/cli-driven-development/SKILL.md`
- `packages/osuperpowers/skills/cli-driven-development/SKILL.zh-CN.md`
- `packages/osuperpowers/skills/cli-research/SKILL.md`
- `packages/osuperpowers/skills/cli-research/SKILL.zh-CN.md`

### 步骤

1. **cli-driven-development SKILL.md**：
   - Flow digraph：handoff-status 节点新增 `TIMEOUT` 边 → `timeout-decision` 决策节点
   - `timeout-decision` 节点：读 progress.md timeoutCount → `< 2` + CLI stdout 存在 → 回到 dispatch-mode（retry）；`≥ 2` 或 SIGKILL / 零输出 → `Z6((BLOCKED: timeout-exhausted))`（新增终端节点）
   - `dispatch-mode` Do 字段新增 timeout 处理：invokeCli 返回 timedOut → 根据 timeoutCount 路由
   - Failure Modes 表新增：timeout exhaustion → BLOCKED: timeout-exhausted（retry ≤ 2 次后降级）
   - Invariants 新增 I8：**Timeout 可重试但有上限** — timeoutCount ≥ 2 直接降级为 BLOCKED: timeout-exhausted

2. **cli-research SKILL.md**：
   - Flow digraph：dispatch-research 节点拆分现有「CLI error / timeout」边为「CLI error」→ BLOCKED 和「TIMEOUT」→ report（fail-open）
   - dispatch-research Fail 字段：TIMEOUT → 读 partial findings → report（fail-open，不递增 timeout-count）
   - Failure Modes 表新增：TIMEOUT → fail-open（research 为可选增强，不 retry）

3. **zh-CN 同步**：两个 SKILL.zh-CN.md 对应更新

### 测试

- 无代码测试（SKILL.md 为文档）；emit + validate 确保同步

### Commit

`docs: add TIMEOUT exit to cli-driven-development and cli-research SKILL.md + zh-CN`

---

### Task 4: cdd-research.mjs unification + emit

**目标**：删除 ad-hoc watchdog + emit + validate 绿。

### 修改文件

- `packages/osuperpowers/bin/engine/cdd-research.mjs`
- `packages/osuperpowers/bin/engine/lib/cli-shared.mjs`（扩展 resolveTimeoutMs 支持 RESEARCH_TIMEOUT 向后兼容）
- `packages/osuperpowers/bin/engine/tests/cdd-research.test.mjs`

### 步骤

1. **cli-shared.mjs — resolveTimeoutMs 向后兼容**：`research` mode 的 env 优先级扩展为 `CDD_RESEARCH_TIMEOUT` > `CDD_CLI_TIMEOUT` > `RESEARCH_TIMEOUT`（旧 env 名，向后兼容）> 默认值

2. **cdd-research.mjs**：
   - 删除 `RESEARCH_TIMEOUT` 常量 + `setTimeout` watchdog + `timer.unref()` + `clearTimeout` + `let childProc = null`
   - 新增：读取 `resolveTimeoutMs(env, "research")` 传给 `spawnCapture` 的 timeoutMs 参数
   - spawnCapture 返回 `timedOut: true` → 写 partial findings（调用 writeFindings 保留已产出内容）+ 追加 YAML frontmatter `status: TIMEOUT` + `process.exit(1)`
   - `onSpawn` callback 保留（用于 spawnCapture 内部 timeout kill）

3. **cdd-research.test.mjs**：
   - 更新已有 timeout 测试：mock spawnCapture 返回 timedOut:true → findings 文件存在 + 含 "TIMEOUT"
   - 更新 `RESEARCH_TIMEOUT` env 测试：验证向后兼容（`RESEARCH_TIMEOUT=900` 仍生效）
   - 新增优先级测试：`CDD_RESEARCH_TIMEOUT=3600` + `RESEARCH_TIMEOUT=900` → 3600s（新名优先于旧名）

4. **emit + validate**：`pnpm run emit && pnpm run validate`

### Commit

`fix(cdd-research): remove ad-hoc watchdog, reuse spawnCapture timeout`

---

### 依赖关系

```
Task 1 (cli-shared.mjs timeout) → Task 2 (runner.mjs partial handoff)
Task 2 → Task 3 (SKILL.md TIMEOUT exit)
Task 1 + Task 2 → Task 4 (cdd-research unification)
```

串行执行：Task 1 → Task 2 → Task 3 → Task 4

> **Task 3/4 并行可行性**：Task 3（SKILL.md 文档）与 Task 4（cdd-research.mjs JS）无文件重叠，理论上可并行。串行为简化（Task 4 依赖 Task 2 的 resolveTimeoutMs 变更，Task 3 独立）。实际执行时若需加速，Task 3 可与 Task 4 并行。

> **Task 2/4 cdd-review 职责划分**：Task 2 处理 cdd-review.mjs timeout（核心 engine 路径，与 runner.mjs 同步）；Task 4 处理 cdd-research.mjs timeout（独立 CLI，需删除 ad-hoc watchdog）。两者为 peer CLI modes 但实现路径不同：cdd-review 走 runner.mjs invokeCli，cdd-research 直接调 spawnCapture。
