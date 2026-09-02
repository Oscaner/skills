# Pδ Design Spec — CDD Engine 重构

- **Version**: v1.0 · 2026-09-01
- **Status**: Draft
- **Author**: [human] · Claude Opus 4.8 (osuperpowers:brainstorming dogfood session)
- **Parent program**: [Post-Dogfood Bugfixes + Anti-Pattern Elimination — Overall Spec](./2026-08-31-post-dogfood-bugfixes-overall.md) v1.12
- **Depends on**: Pγ (anti-patterns + brainstorming restructure) — Design spec = Done ✓

---

## Section 0: Incremental warning

> Pδ increment only. Cross-phase conventions in [overall](./2026-08-31-post-dogfood-bugfixes-overall.md); overall wins on conflict.

---

## Section 1: Constraints pointer

- vendored 子模块不可改（overall Constraints）
- 仓库语言政策：SKILL.md / docs 英文主源 + zh-CN 镜像（overall Constraints）
- 三模式链不简化，所有任务强制执行 implement → task-review → fix（overall Constraints v1.7）

---

## Section 2: Design body

### Issues in scope

| Issue | 问题本质 | 修改目标 |
|---|---|---|
| [#207](https://github.com/Oscaner/skills/issues/207) | CDD 执行流程完全未遵守：跳过 select-harness/determine-base/dispatch-mode，直接手写代码 | 三模式链强制校验 + brief 范围锁定 |
| [#210](https://github.com/Oscaner/skills/issues/210) | deferred-sweep 被 commit-contract F1 误拦：sweep 运行时 HEAD 已前进导致 handoff commits.head mismatch | handoff schema 移除 commits.head + commit-contract 上移到 orchestrator |
| [#211](https://github.com/Oscaner/skills/issues/211) | cli-driven-development 重构：engine 契约修复 + agent 文件定向加固 + degradation 标准化 | 三层架构重划分 + runner.mjs 薄层化 |

### Root cause

三个 issue 指向同一个结构性缺陷：CDD engine（`bin/engine/lib/runner.mjs`，~650行）同时承担了**CLI 调度**和**业务逻辑**两种职责。contract.mjs、brief.mjs 等模块当前已存在为独立文件，但作为 runner.mjs 的内部依赖被调用。commit-contract 校验、deferred-sweep closure、head 校验等业务判断嵌入 engine 层，导致：

1. orchestrator（SKILL.md digraph）无法完全掌控业务决策，出现 I7 degradation 的 workaround
2. engine 的 handoff 校验与自身产生的 handoff 自相矛盾（写 head → 校验 head）
3. agent 绕过三模式链时，engine 没有校验机制

**Pδ 核心动作**：将 contract.mjs / brief.mjs 从 engine 内部依赖改为 orchestrator CLI 直接调用，runner.mjs 退化为纯调度器。

### Architecture — 三层职责重划分

将 CDD 从"调度+业务逻辑混合体"彻底变成"纯 CLI 调度器"，所有业务判断上移到 orchestrator 层。

#### 三层职责对照

| 层 | 职责 | 绝不负责 |
|---|---|---|
| **CLI Agent**（模板驱动） | 接收 brief → 执行 → 写 handoff JSON → H1 输出 | 业务路由决策 |
| **Engine**（runner.mjs 重构） | CLI 调度 + timeout + handoff JSON Schema 校验 + open-findings.json 预生成 | commit-contract、head 校验、dirty tree 判断、deferred-sweep closure、brief 生成、review-package diff 生成 |
| **Orchestrator**（SKILL.md digraph + 辅助脚本） | handoff status 路由 + commit-contract 校验 + deferred-sweep closure + progress 管理 + brief 生成 + review-package diff 生成 | CLI 调度 |

#### Data flow

```
Orchestrator                          Engine                          CLI Agent
    │                                    │                                │
    │ 1. 生成 brief                      │                                │
    │ 2. 生成 review diff                │                                │
    │ 2.5 记录 dispatch-time HEAD        │                                │
    │    → progress.json.lastDispatchHead│                                │
    │ 3. dispatch(cdd-task.mjs)          │                                │
    │───────────────────────────────────>│                                │
    │                                    │ 4. Schema 校验 handoff          │
    │                                    │ 5. 预生成 open-findings.json    │
    │                                    │ 6. spawn CLI agent             │
    │                                    │───────────────────────────────>│
    │                                    │                                │ 7. 执行
    │                                    │                                │ 8. 写 handoff.json
    │                                    │                                │ 9. H1 输出
    │                                    │<───────────────────────────────│
    │                                    │ 10. Schema 校验                │
    │<───────────────────────────────────│ 11. H1 输出                    │
    │                                    │                                │
    │ [TIMEOUT 分支]                     │                                │
    │                                    │ 超时检测 → engine.writeHandoff │
    │                                    │ ({status:'TIMEOUT'}) → exit 1  │
    │<───────────────────────────────────│                                │
    │ 12. TIMEOUT → timeout-decision     │                                │
    │ 12. 读 handoff status              │                                │
    │ 13. 业务判断                       │                                │
    │   - commit-contract 校验           │                                │
    │   - deferred-sweep closure         │                                │
    │   - route to next node             │                                │
```

### Handoff Schema 重构

**重构前：**
```json
{
  "task": N,
  "phase": "implement|task-review|fix",
  "status": "APPROVED|BLOCKED|CHANGES_REQUESTED|DONE",
  "commits": { "base": "sha", "head": "sha" },
  "complexity": "simple|moderate|complex",
  "review_scope": "task|branch",
  "artifacts": { ... },
  "findings": [...],
  "unverifiable": [...],
  "plan_conflicts": [...],
  "blocker": "..."
}
```

**重构后：**
```json
{
  "task": N,                          // required, number
  "phase": "implement|task-review|fix",  // required, enum
  "status": "APPROVED|BLOCKED|CHANGES_REQUESTED|TIMEOUT",  // required, enum (DONE 移除)
  "commits": { "base": "sha" },       // commits.head 移除
  "complexity": "simple|moderate|complex",  // optional, enum
  "review_scope": "task|branch",      // optional, enum
  "artifacts": { ... },               // required, object
  "findings": [...],                  // required, array
  "unverifiable": [...],              // optional, array
  "plan_conflicts": [...],            // optional, array
  "blocker": "..."                    // optional, string (BLOCKED 时 required)
}
```

> **TIMEOUT 状态说明**：`TIMEOUT` 包含在 handoff-schema.json 的 status 枚举中。Engine 在 CLI 超时时写入 `TIMEOUT` handoff（通过 `writeHandoff()`），然后立即退出（exit 1）。Orchestrator 从 `progress.json` `timeoutCount` 判断重试逻辑（timeout-decision 节点）。

**关键变化：**
1. `commits.head` **移除** — head mismatch 根因消除（#210）
2. `status` 枚举中 `DONE` **移除** — 统一为 `APPROVED|BLOCKED|CHANGES_REQUESTED|TIMEOUT`
3. `handoff-schema.json` 定义 required/optional/enum — engine 层 JSON Schema 校验（含 TIMEOUT）。顶层字段（task/phase/status/commits/artifacts/findings）强制校验；`artifacts`/`findings`/`unverifiable`/`plan_conflicts` 子字段采用宽松 schema（仅校验类型，不校验子结构），`additionalProperties: false` 仅作用于顶层
4. `cdd-review.mjs` status 字段 `DONE` → `APPROVED`（与 handoff schema 对齐）

**handoff-schema.json 定义（JSON Schema draft-07）：**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["task", "phase", "status", "artifacts", "findings"],
  "properties": {
    "task": { "type": "integer", "minimum": 1 },
    "phase": { "type": "string", "enum": ["implement", "task-review", "fix"] },
    "status": { "type": "string", "enum": ["APPROVED", "BLOCKED", "CHANGES_REQUESTED", "TIMEOUT"] },
    "commits": {
      "type": "object",
      "required": ["base"],
      "properties": {
        "base": { "type": "string", "pattern": "^[0-9a-f]{40}$" }
      }
    },
    "complexity": { "type": "string", "enum": ["simple", "moderate", "complex"] },
    "review_scope": { "type": "string", "enum": ["task", "branch"] },
    "artifacts": { "type": "object" },
    "findings": { "type": "array" },
    "unverifiable": { "type": "array" },
    "plan_conflicts": { "type": "array" },
    "blocker": { "type": "string" }
  },
  "additionalProperties": false
}
```

### Template directory restructuring

**重构前：**
```
packages/osuperpowers/templates/cdd/
├── implement.md
├── fix.md
├── task-review.md
├── branch-review.md
├── spec-review.md
├── plan-review.md
└── _handoff-write-fragment.md
```

**重构后：**
```
packages/osuperpowers/skills/
├── _templates/                                # 跨 skill 共享模板
│   ├── spec-review.md                         # brainstorming spec-review? 使用
│   ├── plan-review.md                         # writing-plans plan-review 使用
│   ├── branch-review.md                       # cli-driven-development branch-review 使用
│   └── handoff-schema.json                    # handoff JSON Schema
├── cli-driven-development/
│   ├── SKILL.md
│   ├── docs/
│   └── templates/                             # CDD 独占模式模板
│       ├── implement.md
│       ├── fix.md
│       └── task-review.md
└── brainstorming/
    ├── SKILL.md
    └── docs/
```

**templates.mjs 路径解析重构：**
- `renderModePrompt(mode)` → 基于 `import.meta.url` 相对路径解析：从 `bin/engine/lib/templates.mjs` 向上到 `packages/osuperpowers/`，再进入 `skills/cli-driven-development/templates/{mode}.md`
- `renderTemplate(name)` → 同理，从 `packages/osuperpowers/` 进入 `skills/_templates/{name}.md`
- 移除 `pluginRoot()` 向上遍历逻辑（路径锚点固定为 `packages/osuperpowers/`，通过 `import.meta.url` 相对路径推导）

**模板内容重构：**
- `_handoff-write-fragment.md` 废弃。Handoff 写入指令不再通过字符串拼接注入，而是作为 `## Handoff Output` section 内联到每个 mode 模板末尾。每个模板包含该 mode 特有的 handoff 写入逻辑（status 判定、findings 合并、字段赋值），而非共享一个通用 fragment
- Handoff 结构约束由 `handoff-schema.json` + engine JSON Schema 校验强制（结构合法性验证）
- `task-review.md` status 字段统一为 `APPROVED`（消除 DONE vs APPROVED 不一致）

### Progress file structuring

**重构后：**
```
.superpowers/cdd/<slug>/
├── progress.json                        # 结构化数据
└── progress.md                          # 可读摘要（派生）
```

**progress.json Schema：**

| 字段 | 类型 | 说明 |
|---|---|---|
| `plan` | string | plan 文件路径 |
| `timeoutCount` | number | 超时重试次数 |
| `engineRecoveryCount` | number | engine 恢复次数 |
| `lastDispatchHead` | string (40-char SHA) | orchestrator dispatch 前记录的 HEAD |
| `tasks[].task` | number | task 编号 |
| `tasks[].status` | `"pending" \| "complete"` | task 状态 |
| `tasks[].completedAt` | string (ISO timestamp) | 完成时间（仅 complete 时有值） |
| `degradationLog[].task` | number | 关联的 task 编号（required） |
| `degradationLog[].mode` | string | `"implement" \| "task-review" \| "fix"` （required） |
| `degradationLog[].scope` | string | `"deferred-sweep" \| "blocker-only"` （fix 模式时 required） |
| `degradationLog[].severity` | string | `"head-mismatch" \| "engine-error" \| "timeout" \| "dirty-tree"` （required） |
| `degradationLog[].summary` | string | 降级摘要（required） |
| `degradationLog[].reason` | string | 原因说明（required） |
| `degradationLog[].timestamp` | string (ISO timestamp) | 降级发生时间（required） |

```json
{
  "plan": "docs/superpowers/plans/...",
  "timeoutCount": 0,
  "engineRecoveryCount": 0,
  "lastDispatchHead": "abc123...",
  "tasks": [
    { "task": 1, "status": "complete", "completedAt": "2026-09-01T..." },
    { "task": 2, "status": "pending" }
  ],
  "degradationLog": [
    {
      "task": 2,
      "mode": "fix",
      "scope": "deferred-sweep",
      "severity": "head-mismatch",
      "summary": "Findings already cleared before head check",
      "reason": "#210 known issue",
      "timestamp": "2026-09-01T..."
    }
  ]
}
```

**分工：**
- Engine 层（runner.mjs）：读写 `timeoutCount` + `tasks[].status`（结构化 JSON）
- Orchestrator 层（SKILL.md digraph）：write `lastDispatchHead`（dispatch 前）+ read/increment/write `engineRecoveryCount`（engine-recovery 节点每次重试时）+ append `tasks[].completedAt` + append `degradationLog[]` + 派生 `progress.md`（可读摘要）

**与现有 progress.md 的关系：**
- `progress.json` **替代** progress.md 的结构化数据部分（timeoutCount / engineRecoveryCount / tasks ledger）
- `progress.md` 保留为**派生可读摘要**（orchestrator 在每次 dispatch-cycle 完成后重写——即 task 状态变更或降级事件后），供人类阅读和 git diff
- 现有 runner.mjs 中的 `readTimeoutCount` / `writeTimeoutCount` / `ledgerComplete` 函数迁移为读写 progress.json（JSON.parse/JSON.stringify），`CDD_LEDGER` 环境变量指向改为 progress.json 路径
- I7 degradation log 从 freeform prose 迁移为 `degradationLog[]` 结构化数组
- 迁移策略：首次 orchestrator 运行时，如果 progress.json 不存在但 progress.md 存在，从 progress.md 解析现有数据并生成 progress.json（一次性迁移）。如果都不存在，创建新的 progress.json

### Runner.mjs thinning

**重构后 runner.mjs 流程（~150行）：**

1. 接收参数（harness, task, mode, scope, plan, brief_path, diff_path）
2. 校验 handoff-schema.json（读取 handoff → JSON Schema 校验；TIMEOUT handoff 通过 schema 校验但 orchestrator 路由到 timeout-decision 节点）
3. 预生成 open-findings.json（fix 模式：按 scope 过滤 findings）
4. 调度 CLI agent（spawn + timeout）
5. H1 输出

> **head SHA 来源**：orchestrator 在 dispatch 前通过 `git rev-parse HEAD` 获取当前 HEAD（不从 handoff 读取），传给 review-package 作为 diff 基准。这与 handoff 不再包含 commits.head 的设计一致。

**移除的职责（上移到 orchestrator）：**
- commit-contract 校验 → CDD SKILL.md `handoff-status` 决策节点：读取 handoff 后调用 `node bin/engine/lib/contract.mjs --check-head --check-dirty` CLI 执行 head 校验 + dirty tree 检查
- deferred-sweep closure → CDD SKILL.md `deferred-sweep-loop` 节点：CLI 返回后根据 mode=fix + scope=deferred-sweep + agent exit code = 0 判断是否调用 `node bin/engine/lib/contract.mjs --clear-findings` 清空 findings[]
- brief 生成 → CDD SKILL.md `dispatch-mode` 节点：dispatch 前调用 `node bin/engine/lib/brief.mjs --task N --plan <path>` CLI 生成 brief
- review-package diff 生成 → CDD SKILL.md `dispatch-mode` 节点：dispatch 前调用 review-package 脚本生成 diff
- phase consistency guard → CDD SKILL.md `dispatch-mode` 节点：dispatch 前校验 handoff.phase 匹配 CDD_MODE

> **调用方式**：orchestrator 通过 `node` CLI 子进程调用 engine lib 模块。每个 lib 模块（contract.mjs、brief.mjs）需新增 CLI 入口（arg parsing + 函数调用），使 orchestrator 可通过 `node lib/contract.mjs --check-head` 方式调用。这是 Pδ 重构的一部分——为上移的职责创建 CLI 包装器。保持 orchestrator（skill 层）和 engine（lib 层）的进程隔离。

**CLI 包装器接口规范：**

| 模块 | CLI 调用 | 参数 | 输出（stdout） | Exit code | 备注 |
|---|---|---|---|---|---|
| `contract.mjs` | `--check-head --handoff <path> --progress <path>` | handoff JSON 路径 + progress.json 路径 | `{ "valid": true }` 或 `{ "valid": false, "reason": "..." }` | 0=valid, 1=invalid | `--progress` 读取 `lastDispatchHead`（dispatch 前 orchestrator 写入的 HEAD），与 `git rev-parse HEAD` 对比；`--handoff` 读取 handoff 文件校验 JSON Schema 结构完整性；两者任一失败 → valid=false |
| `contract.mjs` | `--check-dirty` | 无 | `{ "dirty": false }` 或 `{ "dirty": true, "files": [...] }` | 0=clean, 1=dirty |
| `contract.mjs` | `--clear-findings --handoff <path>` | handoff JSON 路径 | `{ "cleared": true }` | 0 | 新增；原地修改 handoff 文件（清空 findings[]），orchestrator 调用后无需额外写回 |
| `brief.mjs` | `--task N --plan <path> --output <path>` | task 编号 + plan 文件路径 + 输出路径 | `{ "brief": "<path>" }` | 0=success, 1=error | brief 写入 `--output` 指定的路径（如 `.superpowers/cdd/<slug>/task-N-brief.md`），stdout 返回 JSON 含文件路径 |

**新增职责：**
- handoff JSON Schema 校验（结构合法性）
- open-findings.json 预生成（按 scope 过滤 findings[]）

### Behavior reinforcement (#207)

通过模板重构和 engine 校验约束 agent 行为：

1. **三模式链强制**：orchestrator 在 dispatch fix 模式前，校验对应 task 的 task-review handoff 已存在且 status = APPROVED。跳过 task-review 直接进 fix 时 orchestrator 拒绝
2. **Brief 范围锁定**：implement 模板中明确指令 "只修改 brief 中 `### Task N:` 覆盖的文件"

### Acceptance criteria

1. `handoff-schema.json` 存在于 `skills/_templates/handoff-schema.json`，包含 required/optional/enum 定义
2. `runner.mjs` 不再包含 commit-contract 校验、deferred-sweep closure、brief 生成、review-package diff 生成
3. `runner.mjs` 包含 handoff JSON Schema 校验逻辑
4. `templates/cdd/` 目录已移除，模板迁移到 `skills/_templates/` + `skills/cli-driven-development/templates/`
5. `templates.mjs` 路径解析基于 `import.meta.url` 相对路径推导，不再使用 `pluginRoot()` 向上遍历
6. `_handoff-write-fragment.md` 已废弃，每个 mode 模板内含 `## Handoff Output` section
7. `progress.json` Schema 定义存在
8. `task-review.md` 模板 H1 status 使用 `APPROVED`（非 `DONE`）— agent 输出统一为 APPROVED|BLOCKED|CHANGES_REQUESTED
9. 三模式链强制：orchestrator 校验 task-review 完成后才允许 fix dispatch
10. `implement.md` 模板包含 brief 范围锁定指令
11. Orchestrator 承接 commit-contract 校验：CDD SKILL.md `handoff-status` 节点包含 head 校验 + dirty tree 检查逻辑
12. Orchestrator 承接 deferred-sweep closure：CDD SKILL.md `deferred-sweep-loop` 节点包含 findings 清空逻辑
13. Orchestrator 承接 brief 生成：`dispatch-mode` 节点在 dispatch 前通过 CLI 调用 `node bin/engine/lib/brief.mjs --task N --plan <path>`
14. 所有引擎测试通过（`node packages/osuperpowers/bin/engine/tests/*.test.mjs`）
15. `pnpm run emit` 无 drift
16. Progress.json 迁移逻辑存在：首次 orchestrator 运行时，若 progress.json 不存在但 progress.md 存在，从 progress.md 解析 timeoutCount/tasks 数据并生成 progress.json

---

## Section 3: Deviations from overall

| Overall assumption | Phase decision | Overall updated? |
|---|---|---|
| Overall 未约束 progress 文件格式 | 引入 progress.json 作为结构化进度文件，progress.md 降级为派生可读摘要 | No — overall 未覆盖此细节 |

---

## Section 4: Notes for downstream

- Pδ 重构后，orchestrator 层（SKILL.md digraph）承担所有业务决策，engine 层成为纯 CLI 调度器
- handoff JSON 结构新增 engine 侧 schema 校验约束（新建 handoff-schema.json），现有 handoff 写入逻辑需适配 schema 要求
- progress.json 为新增结构化文件，需清理旧 progress.md 格式
- CDD skill 的 SKILL.md 需要同步更新（handoff-status 决策节点增加 commit-contract 校验）
- `_docs/docs-review.md` 无需变化（spec-review/plan-review 的 3-pass 规则不变）

---

## Section 5: Review

Pδ spec review 遵循 `packages/osuperpowers/skills/_docs/docs-review.md` Review Stopping 规则（I5）。
