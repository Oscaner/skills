# P12 Design Spec: cli-timeout

- **Version**: v1.0 · 2026-08-29
- **Status**: Approved
- **Author**: [human] · Claude Opus 4.8 (osuperpowers:brainstorming dogfood session)

---

## §1 目标

统一所有 engine CLI spawn 的 timeout 管理，timeout 时保留 partial artifacts，orchestrator 可根据 timeout 状态决策 retry / 降级。

## §2 架构决策

### 2.1 spawnCapture 层 timeout（核心）

**选择 A**：timeout 在 `cli-shared.mjs` 的 `spawnCapture` 层实现。SIGTERM 后等待 5s（硬编码常量 `SIGKILL_DELAY_MS`；经验默认值，不配置），若仍无响应则 SIGKILL。极端情况（SIGKILL 仍无法终止，如 zombie 进程）：spawnCapture 返回 `{ ok: false, code: -1, timedOut: true, unkillable: true }`，runner.mjs 写 BLOCKED handoff + `blocker: "process unkillable"`（注意：此为独立 edge case，非 timeout 正常路径，走 BLOCKED 恢复路径而非 timeout-decision 节点）。

### 2.2 TIMEOUT status（handoff JSON 扩展）

新增 `status: TIMEOUT`。语义独立——可重试 ≠ 需人工。属于 backward-compatible JSON 枚举扩展（旧消费者遇新值 fallback 为 unknown status，不 break 现有流程）。

扩展层级：
1. `cli-shared.mjs` — spawnCapture timeoutMs 参数 + SIGTERM → SIGKILL fallback；timeout 时 resolve `{ ok: false, code: -1, stdout, stderr, timedOut: true }`（`code: -1` 为统一 timeout exit code）
2. `contract.mjs` — normalizeHandoffStatus 新增 `TIMEOUT` 为合法 status（TIMEOUT 透传，无需映射——现有 normalizeHandoffStatus 对未知值直接 passthrough）
3. `runner.mjs` — timeout 路径写 partial handoff（已完成 findings 保留 + `status: TIMEOUT` + `blocker` 字段）；runner.mjs 已有 fallback handoff-write 逻辑（runner.mjs:489-510），timeout 走同一路径；**特殊**：SIGKILL 仍无法终止（zombie 进程）→ 写 `status: BLOCKED` + `blocker: "process unkillable"`（独立 edge case，非 timeout 正常路径）
4. `cli-driven-development` SKILL.md — handoff-status 节点新增 TIMEOUT 出口 → `timeout-decision` 决策节点。timeout-count 存于 progress.md（复用 engine-recovery-count 模式），runner.mjs timeout 时递增。路由规则：**timeoutCount < 2 + CLI 有 stdout 输出** → 重 dispatch（回到 dispatch-mode）；**timeoutCount ≥ 2 或 CLI 被 SIGKILL / 零输出** → BLOCKED: timeout-exhausted（新增终端节点，与 Z4 fix-loop-exhausted 独立）。**优先级**：timeoutCount ≥ 2 优先于 stdout 判定，直接降级
5. `cli-research` SKILL.md — dispatch-research TIMEOUT 出口：始终 fail-open（第一次 timeout 即 fail-open，读 partial findings → 继续 flow，不递增 timeout-count——research 为可选增强，无需 retry 语义）。拆分现有「CLI error / timeout」边为「CLI error」→ BLOCKED 和「TIMEOUT」→ report（fail-open）

### 2.3 per-mode 默认值 + 全局 env 覆盖

**timeout 步进规则**：所有默认值必须是 30 分钟的整数倍（30min 步进）。env 覆盖值同样遵守此步进（用户传入非步进值时向上取整到最近的 30min 倍数）。

- `spawnCapture` 接受 `timeoutMs` 参数
- 各 CLI 入口传 mode 以获取默认值：
  - cdd-task: 1800s（30min）
  - cdd-review: 1800s（30min）
  - cdd-research: 1800s（30min）
- 全局覆盖：`CDD_CLI_TIMEOUT` env var 覆盖所有默认值（例：`CDD_CLI_TIMEOUT=3600` = 60min）
- 各 CLI 独立 env：`CDD_TASK_TIMEOUT` / `CDD_REVIEW_TIMEOUT` / `CDD_RESEARCH_TIMEOUT`（均为新增；`RESEARCH_TIMEOUT` 重命名为 `CDD_RESEARCH_TIMEOUT`）。优先级：独立 env > 全局 env > 默认值。同样遵守 30min 步进

### 2.4 cdd-research.mjs 统一

删除 ad-hoc watchdog（RESEARCH_TIMEOUT + setTimeout + SIGTERM），复用 spawnCapture timeout。cdd-research.mjs 产出 handoff-like artifact（`findings` 文件 + status 字段）。

## §3 partial handoff 契约

timeout 触发时：
1. `spawnCapture` 发送 SIGTERM，等待 5s，仍无响应则 SIGKILL
2. runner.mjs 写 handoff `status: TIMEOUT` + `blocker: "timeout after Nms"` + partial artifacts（已完成部分保留）
3. cdd-research.mjs：writeFindings 保留已产出内容 + 新增 status 字段写入

**Partial artifacts 范围**（按 CLI mode）：
- cdd-task：`task-N-handoff.json` 写入 `status: TIMEOUT` + `blocker` 字段 + 已完成的 `findings[]`（fix.md 已产出的部分）
- cdd-review：handoff 写入 `status: TIMEOUT` + 已完成的 findings
- cdd-research：`findings` 文件保留已产出内容 + 新增 YAML frontmatter `status: TIMEOUT`

orchestrator 读到 TIMEOUT 后：
- 读 partial handoff / findings
- 决策：retry（重 dispatch）或 降级（跳过 / report）

## §4 偏离

1. Overall P12 scope：原描述"runner.mjs spawnCapture 加 timeout" → 实际 timeout 在 cli-shared.mjs 层（更彻底）
2. per-mode 默认值：原描述无具体值 → 30min 步进（用户决策）

## §5 验收

1. spawnCapture timeoutMs 参数 + SIGTERM→SIGKILL fallback 实现
2. runner.mjs validator 新增 TIMEOUT 为合法 status + partial handoff 写入
3. cdd-research.mjs ad-hoc watchdog 删除，复用 spawnCapture timeout + findings 保留
4. cli-driven-development SKILL.md handoff-status TIMEOUT 出口入图（retry 决策 + 连续 timeout ≥ 2 降级）
5. cli-research SKILL.md dispatch-research TIMEOUT 出口（fail-open）
6. `CDD_CLI_TIMEOUT` 全局 env 覆盖 + per-mode env 优先级
7. 30min 步进约束
8. zh-CN 同步
9. emit + validate 绿
10. CDD execution: timeout 集成 smoke test（自动化：设置 `CDD_TASK_TIMEOUT=1`、dispatch 一个预计 >1s 的任务，验证 handoff `status: TIMEOUT` + `timedOut: true` + partial artifacts 存在）
