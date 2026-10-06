# 消费者面一致性（Consumer Parity）— P4.3 cdd 多 task + task groups 裁定 + I4 语义修复 Implementation Plan

**Spec:** [2026-09-21-consumer-parity-p4.3-design.md](docs/kairos/specs/2026-09-21-consumer-parity-p4.3-design.md)
- **Parent program**: [consumer-parity overall v1.32](docs/kairos/specs/2026-09-21-consumer-parity-overall.md)
- **Version**: v1.5 · 2026-09-25（mid-flight 用户裁决：Skill 骨架结构从文本指导迁移为 canonical JSON Schema 单源——新增 **Task 11**（skill-anatomy schema + validate 严格 allowlist 机器校验 + 06-skill-authoring/CLAUDE.md 文本指导清理），plan 自 complete reopen 为 in-flight 继续展开；**章节统一**——全件四公共节 Flow Digraph / Node Definitions / Invariants / Failure Modes + 两条件节 Skeleton deltas（spec-writer trio 必携）· Pending Acceptance Patch（writing-plans 承载，去 `(cross-task findings consolidation)` 后缀变体统一单标题）；**Engine Semantics 内容并入 Invariants 表**（ddl->cdd 径 `## Engine Semantics` 独立节删除——其 four 事实是编排者契约，并入 Invariants 行承载）；**Flow Digraph 节仅 mermaid 块、零后随 prose**（report-issues 的 digraph 后节点陈述行随 Task 11 清理）；**Session Context 顶层章节崩溃入 `explore-current-session` 节点内联**）
- **Base**: develop
- **Depends on**: P4.1（shipped · [p4.1-design v1.5](docs/kairos/specs/2026-09-21-consumer-parity-p4.1-design.md)）

- **Interface 转录注记**: 各任务 `- **Consumes**: 刻意留空（树迁移 B 转录决策）——源 Do 散文未承载独立具名输入事实，consumes（Task 记录 interface 可选项）不填充；任务输入由 DependsOn/AtomicWith 声明边与 objective/steps 承载，consumer-parity p1–p4.1 因承接具名输入事实而全量填充。

## Constraints

### 破坏性变更窗口（breaking allowed）
cdd-engine 0.1.0 基准，P4.2 1.0.0 首次稳定开版前为破口窗口；`--task` → `--tasks` 全替换零别名、`[In-flight]` 状态、schema get 均属 breaking/新增面，随 P4.2 收 changelog。

### 四表纪律
回填 = branch-review 前置义务（backfill-overall 由 orchestration 于 branch-review 前执行）；结构性 mismatch → BLOCK；本 plan 终结态（plan complete）落地后 P4.3 行 Design-spec / Implementation plan 列按 closeout 规则回填。

### 语言政策
本 plan 中文主源（Strategy B）；SKILL.md / docs 英文主源（Strategy A）——I4 文本重写为英文原文面；值 token（phase id / tag / SHA / 路径）中立。

### engine 直调与零过滤
`node packages/cdd-engine/dist/cli.mjs`（dev:stub 材料化；不走 global register）；skills 调用 cdd 输出零过滤（禁 `tail`/`head`/`2>&1 |`/`EXIT=$?`）。

### emit 输入面
skills/ 改动（Task 4/6）后必须 `pnpm run emit` + `emit:check` 无 drift + 产物重生成。

### 零产物 fixture
engine 测试不得以本仓产物为 fixture（P3 裁决）——#274/#276 回归用 mkdtemp 自造链（smoke-overall 行形）。

### 死代码即删
空壳、死代码随拆即删（无过渡 shim · 无别名 · 无历史叙述豁免）；frozen 历史 docs（overhaul 族 / p3-p6 历史行）不动。


### Task 1: engine CLI `--tasks` 单数据模型（parse 层 + canonical argv 锁步）

- **Objective**: engine CLI `--tasks` 单数据模型（parse 层 + canonical argv 锁步）：`--task` → `--tasks` + parseTaskList 边界 + residue 锁步
- **DependsOn**: none
- **AtomicWith**: none

- **Produces**: `parseTaskList`（split/map trim/逐 token 整数校验 + 去重 + 空 slice 拒绝；Bug-A 消息升级）；parse.ts 三 SUBCOMMAND_USAGE + 三个 arg 声明；engine-config argv `tasks` int-list 通道；`--task` 零命中（面）

- **Files**: packages/cdd-engine/src/cli/parse.ts, packages/cdd-engine/src/cli/shared.ts, packages/cdd-engine/src/cli/review.ts, packages/cdd-engine/src/cli/fix.ts, packages/cdd-engine/src/cli/bin.ts, packages/cdd-engine/templates/engine-config.json

- **Steps**:
  1. `parse.ts` 三 SUBCOMMAND_USAGE（implement/review/fix）改 `--tasks <n|n,n,…>`；三个 arg 声明 `task` → `tasks`（`valueHint: "n|n,n,…"`，citty type 仍 string）；dispatch 调用点 `intTask(args.task)` → `parseTaskList(args.tasks)` — checkable: `cdd implement --tasks 1` 与 `--tasks 1,2` 走同一 dispatch 路径、解析正确（engine 测试绿 + 实证）
  2. `shared.ts` 新增 `parseTaskList`（split(`,`).map(trim) → 逐 token 整数校验 + 去重（`1,1` → `1`）+ 空 slice 拒绝；非整数 exit 2，Bug-A 消息升级 `--tasks must be comma-separated integers: <token>`）；`intTask` 内核复用于逐 token 校验、单值入口删除 — checkable: `--tasks 1, 2` 容忍空格（trim）· `--tasks 1,1` 去重 · `--tasks 1,`（尾逗号空 slice）exit 2 拒绝 · `--tasks abc` 非整数 exit 2（Bug-A 升级消息）
  3. `review.ts:190` / `fix.ts:41` 缺失必填错误串 `--task` → `--tasks`；`bin.ts:9` 头注释；`templates/engine-config.json` `channels.argv.task {flag: "--task", type: "int"}` → `"tasks" {flag: "--tasks", type: "int-list"}`——与 parse.ts 同改同提（residue Row-9/10 守卫从它派生 CANONICAL_ARGV_FLAGS） — checkable: engine 既有 `--task` T1 面全量迁 `--tasks`，该面 grep `--task` 零命中（frozen 除外）；residue Row-9/10 守卫绿（parse.ts ↔ engine-config argv `tasks` 通道锁步）

- **Acceptance**:
  - `cdd implement --tasks 1` 与 `--tasks 1,2` 走同一 dispatch 路径、解析正确（engine 测试绿 + 实证）
  - `--tasks 1, 2` 容忍空格（trim）· `--tasks 1,1` 去重 · `--tasks 1,`（尾逗号空 slice）exit 2 拒绝 · `--tasks abc` 非整数 exit 2（Bug-A 升级消息 `must be comma-separated integers`）
  - engine 既有 `--task` T1 面全量迁 `--tasks`（parse/usage 声明 · review.ts:190 / fix.ts:41 必填错误串 · engine 用例随迁面），该面 grep `--task` 零命中（frozen 除外）；`packages/cdd-engine/src` 全量零命中在 Task 2 验收（re-dispatch 串迁移后可达）
  - residue Row-9/10 守卫绿（parse.ts ↔ engine-config argv `tasks` 通道锁步）


### Task 2: dispatch 组载体（TaskLifecycle 组 · handoff 组键 · 超界 · re-dispatch 串）

- **Objective**: dispatch 组载体（TaskLifecycle 组 · handoff 组键 · 超界 · re-dispatch 串）：组语义化 + tasks-{a}-{b} 命名 + schema 组引用
- **DependsOn**: none
- **AtomicWith**: none

- **Produces**: TaskLifecycle 组载体（tasks 列表）；brief/handoff 组级键（`tasks-{a}-{b}-*`）；超界检查升组级；handoff schema 组引用（删顶层 task 标量）；re-dispatch 建议串整组面

- **Files**: packages/cdd-engine/src/dispatch/task.ts, packages/cdd-engine/src/render/brief.ts, packages/cdd-engine/templates/engine-config.json, packages/cdd-engine/templates/schema/task-handoff-schema.json, packages/cdd-engine/src/rules/failure.ts

- **Steps**:
  1. `dispatch/task.ts` `TaskLifecycle.#taskNum` 标量 → TaskGroup 组载体（tasks 列表，组即单位）；`buildCtx` brief/handoff 组级键；`render/brief.ts:33-36` 超界检查升组级（读盘后任务数可得：超界整体 BLOCK + 逐项列示缺失，保留 `/task N not found/` 契约） — checkable: `--tasks 1` 与 `--tasks 1,2` 同一 dispatch 路径行为实证（成功 · 超界 BLOCK + 缺失列示 · round/handoff/进度/残差按组一份）
  2. `templates/engine-config.json` `handoffNamespace.families` 命名 `task-{task}-*.json` → 组键 `tasks-{a}-{b}-*`（完整 list 串无 range 缩写）；同文件 derived 派生网格（handoffPath/briefPath/findingsPath）from 引用随组键同面落迁 `tasks` — checkable: handoff 命名 `tasks-{a}-{b}-*` 落地（engine 测试断言 artifact 名）
  3. `templates/schema/task-handoff-schema.json` 补组引用（tasks 列表 · required 迁 tasks · **删顶层 `task` 标量字段**——单数据模型，`findings[].task` per-task 归因保留）；`rules/failure.ts:117-121` 与 `dispatch/task.ts:760-761` re-dispatch 建议串改整组面（`cdd fix --tasks 1,2` 形态，无子集派发） — checkable: task-handoff-schema 组引用字段落位、顶层 `task` 字段零存在（grep）+ `findings[].task` 归因保留；re-dispatch 建议串为整组面；`packages/cdd-engine/src` grep `--task` 全量零命中（frozen 除外）

- **Acceptance**:
  - `--tasks 1` 与 `--tasks 1,2` 同一 dispatch 路径行为实证（成功 · 超界 BLOCK + 缺失列示 · round/handoff/进度/残差按组一份）
  - `cdd review --type task --tasks 1,2` 一轮审整组（round/blocker/findings 组级归因）；`cdd fix --type task --tasks 1,2 --findings <handoff>` 整组修（agent 自判归因）
  - re-dispatch 建议串为整组面（`cdd fix --tasks 1,2` 形态，无子集）
  - `packages/cdd-engine/src` grep `--task` 全量零命中（frozen 除外；T1 面 + 本任务 re-dispatch 两处 failure.ts:117-121 / dispatch/task.ts:760-761 迁移后可达）
  - handoff 命名 `tasks-{a}-{b}-*` 落地（engine 测试断言 artifact 名）；task-handoff-schema 组引用字段落位、顶层 `task` 字段零存在（grep `"task"` top-level 面零命中，required 面 = `tasks` 组引用；`findings[].task` 归因保留）


### Task 3: plan schema `taskGroups` + effectiveGroups 单处派生（空默认）

- **Objective**: plan schema `taskGroups` + effectiveGroups 单处派生（空默认）= 每 task 一组等价
- **DependsOn**: none
- **AtomicWith**: none

- **Produces**: `plan.json` `taskGroups` 属性（optional · default [] · items minItems ≥ 2）；`effectiveGroups = taskGroups.length ? taskGroups : singletons(...)` 单处派生

- **Files**: packages/cdd-engine/src/documents/schema/plan.json, packages/cdd-engine/src/rules/documents.ts, packages/cdd-engine/src/dispatch/base.ts

- **Steps**:
  1. `src/documents/schema/plan.json` 加 `taskGroups` 属性（`optional` · `default: []` · `items: {tasks: number[]}` 且 `minItems ≥ 2`，长度 1 组为冗余、单组态只存在于空默认）+ description（「空默认 ⇒ 每 task 一组 = per-task 现状等价」语义） — checkable: `plan.json` schema 含 `taskGroups`（optional · default [] · item minItems ≥ 2）
  2. `rules/documents.ts` / `dispatch/base.ts`：`effectiveGroups = taskGroups.length ? taskGroups : singletons(taskNumbersFromPlan(plan))` 单处派生，迭代随组（`derivePlanVerdict` / 进度跟踪面同构） — checkable: plan 无 taskGroups 节（空默认）时 loop 逐 `--tasks 1`、`--tasks 2` 推进且与 P4.3 前现状等价（实证）；非空 taskGroups 按声明组 dispatch；`effectiveGroups` 单处派生、无第二实现（grep）

- **Acceptance**:
  - plan 无 taskGroups 节（空默认）时 loop 逐 `--tasks 1`、`--tasks 2` 推进且与 P4.3 前现状等价（实证）；非空 taskGroups 按声明组 dispatch
  - `plan.json` schema 含 `taskGroups`（`optional` · `default: []` · item `minItems ≥ 2`）；`effectiveGroups` 单处派生、无第二实现（grep）
  - taskGroups 写盘判定：长度 1 组不落盘（合并组字典 minItems ≥ 2 与裁定节点写盘一致）


### Task 4: cli-driven-development digraph 改造（task-groups 裁定节点 + --tasks 调用串）

- **Objective**: cli-driven-development digraph 改造（task-groups 裁定节点 + --tasks 调用串）
- **DependsOn**: none
- **AtomicWith**: none

- **Produces**: digraph `C --> T{task groups 裁定}` 边 + `H{more-groups?}` + loop 用户确认门控；节点定义补 task-groups 裁定职责链；implement/run-task-review/fix-task 三节点调用串 `--tasks` 组列表

- **Files**: packages/osuperpowers/skills/cli-driven-development/SKILL.md

- **Steps**:
  1. `packages/osuperpowers/skills/cli-driven-development/SKILL.md`：digraph 于 `C --> D` 边插 `T{task groups 裁定}`（task groups 界定 → 用户确认 → 才进 implement→review→fix loop；拒答 BLOCKED，门控镜像 determine-base）；`H{more-tasks?}` → `H{more-groups?}` — checkable: flow digraph 含 task-groups 裁定节点（`C --> T` 边）、`{more-groups?}` 判定、loop 入口以用户确认门控（拒答 BLOCKED）；组列表流入 `cdd implement --tasks a,b`
  2. 节点定义补 task-groups 裁定（读 plan taskGroups → 界定 → 确认 → 组列表流入 D 的 `--tasks`；非平凡合并组 → 写 plan taskGroups 节 → 独立 commit → 干净树 → 才进 loop（树脏 BLOCK），写盘 commit 复用 I4 独立 commit 纪律） — checkable: task-groups 裁定节点职责链齐备（非平凡合并组 → 写节 → 独立 commit → 干净树 → 才进 loop）
  3. implement-task / run-task-review / fix-task 三节点调用串 `--task <n>` → `--tasks <组列表>`；「One task at a time」子句改写为组语义（默认全单组 = 逐 task 现状等价） — checkable: 三节点调用串 `--tasks`（grep `--task` 零命中）；节点定义与 digraph 一一对应；`pnpm run emit` 后 `emit:check` 无 drift

- **Acceptance**:
  - flow digraph 含 task-groups 裁定节点（`C --> T{task groups 裁定}` 边）、`{more-groups?}` 判定、loop 入口以用户确认门控（拒答 BLOCKED）；组列表流入 `cdd implement --tasks a,b`
  - task-groups 裁定节点职责链齐备（非平凡合并组 → 写 plan taskGroups 节 → 独立 commit → 干净树 → 才进 loop；树脏 BLOCK；写盘 commit 复用 I4 独立 commit 纪律）
  - 三节点调用串 `--tasks`（`packages/osuperpowers/skills/cli-driven-development/SKILL.md` grep `--task` 零命中）
  - 节点定义与 digraph 一一对应（无 dangling / 无 orphan）；`pnpm run emit` 后 `emit:check` 无 drift


### Task 5: `cdd schema get` 命令（发现型 · 零执法）

- **Objective**: `cdd schema get` 命令（发现型 · 零执法）：type 四件枚举 + stdout 直出 canonical + 未知 exit 2
- **DependsOn**: none
- **AtomicWith**: none

- **Produces**: `cli/schema.ts`（`cdd schema get <type>` 子命令组，四件枚举对齐 DOC_SCHEMA_NAMES，stdout 直出 schema JSON；未知 doc-type → exit 2 + 可用名枚举）；parse.ts 声明 + exit.ts 出口族

- **Files**: packages/cdd-engine/src/cli/schema.ts, packages/cdd-engine/src/cli/parse.ts

- **Steps**:
  1. 新增 `cli/schema.ts`：`cdd schema get <type>` 子命令组——type 枚举四件全量（overall / plan / phase-spec / add-phase-protocol，对齐 DOC_SCHEMA_NAMES 注册表，`loadDocSchema` 按名加载）；stdout 直出 canonical schema JSON 原文；未知 doc-type → exit 2 + 可用名枚举（四件同源）；出口走 `exit.ts` 出口族（无裸 return） — checkable: `cdd schema get phase-spec` stdout 与 canonical schema 同字节（engine 测试断言）；四件枚举均可用；未知 doc-type → usage exit 2 + 可用名枚举
  2. `parse.ts` 声明 `schema` 子命令（无新 flag → canonical argv 通道/residue 无涉） — checkable: 零执法逻辑（黑盒断言无校验面）；`cli/schema.ts` 无裸 return、exit.ts 出口族；`cdd help` 功能不回归

- **Acceptance**:
  - `cdd schema get phase-spec` stdout 与 `dist/documents/schema/phase-spec.json` 同字节（engine 测试断言）；四件枚举均可用
  - 未知 doc-type → usage exit 2 + 可用名枚举（四件、与注册表同源）
  - 零执法逻辑（黑盒断言无校验面）；`cli/schema.ts` 无裸 return、exit.ts 出口族
  - `cdd help` 功能不回归（本 task 后仍三行目录面——Task 7 简化为两行）


### Task 6: skills 五件收口（I4 五面重写 · read-schema 直取 · 残留定位串清扫）

- **Objective**: skills 五件收口（I4 五面重写 · read-schema 直取 · 残留定位串清扫）
- **DependsOn**: none
- **AtomicWith**: none

- **Produces**: 五件 SKILL.md Mid-Flight Backfill 文本重写（四点 + 显式顺序，行体逐字节一致）；三件 schema-bearing 技能 read-schema 改 `cdd schema get <type>`；writing-single-spec read-schema 显式 N/A；`cdd help` 定位串清扫；emit 重生成

- **Files**: packages/osuperpowers/skills/writing-single-spec/SKILL.md, packages/osuperpowers/skills/writing-overall-spec/SKILL.md, packages/osuperpowers/skills/writing-phase-spec/SKILL.md, packages/osuperpowers/skills/writing-plans/SKILL.md, packages/osuperpowers/skills/cli-driven-development/SKILL.md

- **Steps**:
  1. 五件 skills 的 Mid-Flight Backfill 文本重写——四点 + 显式顺序：任何 dispatch 返回 → 立地落地 backfill → 独立 commit → 循环暂停至树净 → 恢复后下一轮 review in-band 审计；**五面行体逐字节一致**（编号差异保留不统一） — checkable: I4 文本五面同文（grep 五面逐字节一致断言）+ 四点顺序语义齐备
  2. 三件 schema-bearing 技能（writing-overall-spec / writing-phase-spec / writing-plans）read-schema 指令改「run `cdd schema get <type>` 直取成文」；writing-single-spec read-schema 节点显式 N/A；残留 `cdd help` 定位串清扫；改后 `pnpm run emit` + `emit:check` 无 drift — checkable: 三件 schema-bearing read-schema 改 `cdd schema get <type>`（grep 三件命中）；`cdd help` 定位串零残留；`pnpm run emit` 后零 drift

- **Acceptance**:
  - I4 文本五面同文（grep 五面逐字节一致断言）+ 四点顺序语义齐备（措辞核对）
  - 三件 schema-bearing read-schema 改 `cdd schema get <type>`（grep 三件命中）；writing-single-spec read-schema N/A 入文
  - `cdd help` → `schemas:` 目录 / `cdd help` → `overall.json` / `phase-spec.json` / `plan.json` 定位串零残留
  - `pnpm run emit` 后 `emit:check` 无 drift


### Task 7: `cdd help` 子命令整体移除（--help 旗标保留）

- **Objective**: `cdd help` 子命令整体移除（--help 旗标保留）：help.ts 删除 + smokes-cdd 改锚 schema get
- **DependsOn**: none
- **AtomicWith**: none

- **Produces**: `cli/help.ts` 整删 + bin.ts pre-boot 拦截块删 + parse.ts helpCmd 删 + help.test.ts 删；smoke-cdd 三行断言改锚 `cdd schema get plan`；Non-goal #1 双发现型缩为单 `cdd schema get`

- **Files**: packages/cdd-engine/src/cli/help.ts, packages/cdd-engine/src/cli/bin.ts, packages/cdd-engine/src/cli/parse.ts, packages/cdd-engine/src/cli/__tests__/help.test.ts, scripts/validate/smoke-cdd.ts, docs/maintainers/02-template-doctrine.md, packages/cdd-engine/src/documents/schema.ts

- **Steps**:
  1. **整体移除 `cdd help` 子命令**：删 `cli/help.ts` 整文件（runHelp / renderHelpText / cliDirectory / templatesDirectory / schemaDirectory）；`cli/bin.ts` 删 `cdd help` pre-boot 拦截块（`--help` / `-h` pre-screen 保留）；`cli/parse.ts` 删 helpCmd 声明 + `usage: cdd help` + 根描述 `schema/help` → `schema`；`cli/__tests__/help.test.ts` 删除 — checkable: `cdd help` 子命令零存在（四面删除，`cdd help` 引擎面 grep 零命中）；`--help` 旗标面不回归（usage 渲染绿）
  2. `scripts/validate/smoke-cdd.ts` consumer-sim 三行断言（cli/schemas/templates realpath）改锚 `cdd schema get plan`；`docs/maintainers/02-template-doctrine.md` 改述；`documents/schema.ts:19` 注释同步；Non-goal #1 单发现型修订落地 — checkable: smoke-cdd consumer-sim 改锚后 AC6 安装面 addressability 实测通过；`docs/maintainers/` / `schema.ts` 注释零 `cdd help` 残留；`pnpm run validate` 11 块全绿

- **Acceptance**:
  - `cdd help` 子命令零存在（`cli/help.ts` / `bin.ts` help 拦截块 / `parse.ts` helpCmd / `help.test.ts` 四面删除，`cdd help` 引擎面 grep 零命中）
  - `--help` 旗标面不回归（usage 渲染绿）；`pnpm run validate` 11 块全绿（smoke-cdd consumer-sim 改锚 `cdd schema get plan` 后 AC6 安装面 addressability 实测通过）
  - Non-goal #1 单发现型修订落地（`cdd schema get` 唯一豁免）；`docs/maintainers/` / `documents/schema.ts` 注释零 `cdd help` 残留


### Task 8: #274 — doc-contract plan 列中间态 + claim 等值 + 诊断

- **Objective**: #274 — doc-contract plan 列中间态 + claim 等值 + 诊断（isInflightText · link 等值放宽 · 判别精确）
- **DependsOn**: none
- **AtomicWith**: none

- **Produces**: `[Pending]` → `[In-flight]` → `**Done**` 三态（in-flight 无 reverse claim 义务）；claim 双向等值放宽（link 指向同一 plan 文档即等）；claim 解析只认显式结构；overall.json 描述同步

- **Files**: packages/cdd-engine/src/rules/documents.ts, packages/cdd-engine/src/documents/schema/overall.json

- **Steps**:
  1. `rules/documents.ts`：`isPendingText` 旁新增 `isInflightText`；plan 列三态语义 `[Pending]`（未开工）→ `[In-flight]`（已开工 · **无 reverse claim 义务**）→ `**Done**`（+ closeout claim）；in-flight 列不触发 reverse claim（非缺失 cell、不计 mismatch，closeout carve-out） — checkable: `[In-flight]` 计划列状态合法（isInflightText · 无 reverse claim 义务 · 非 mismatch cell）；`[Pending]` → `[In-flight]` → `**Done**` 三态 + claim 只在 closeout 出现（engine 测试自造链 + P3.8 现场回归）
  2. claim 双向等值放宽：link 形态 plan cell 对齐 design 列 ownDesignToken 提取（「link 指向同一 plan 文档即等」弃逐字符严格相等）；诊断改进：claim 解析不再整子句扫 phase（prose 提及 phase 误作 target），只认显式 claim 结构（`Pending → **Done**`）；多 phase 命中报错附提示 — checkable: Link 形态 plan cell 与 claim 双向等值（ownDesignToken 对齐）；子句 prose 提及 phase 不再整体作 claim 目标（诊断提示到位）
  3. `documents/schema/overall.json` claimPatterns / plan cell completion marker 描述同步 — checkable: overall.json claimPatterns / plan cell 描述与 enforcement 同形（对拍断言）

- **Acceptance**:
  - `[In-flight]` 计划列状态合法（`isInflightText` · 无 reverse claim 义务 · 非 mismatch cell）；`[Pending]` → `[In-flight]` → `**Done**` 三态 + claim 只在 closeout 出现（engine 测试自造链 + P3.8 触发现场回归形态）
  - Link 形态 plan cell 与 claim 双向等值（ownDesignToken 对齐，link 指向同一 plan 文档即等）；子句 prose 提及 phase 不再整体作 claim 目标（诊断提示到位）
  - overall.json claimPatterns / plan cell 描述与 enforcement 同形（对拍断言）


### Task 9: #276 — overall.json 描述↔enforcement 对齐 + 报错 UX

- **Objective**: #276 — overall.json 描述↔enforcement 对齐 + 报错 UX（三处描述改向实读形态 + should look like 提示）
- **DependsOn**: none
- **AtomicWith**: none

- **Produces**: overall.json 三处描述改向 enforcement 实读形态（changeHistory header 首格 version · issueRef 合法枚举 · 6 内容列行形一致）；三处报错附 `should look like:` 正确形态 + 误导 7 列提示移除

- **Files**: packages/cdd-engine/src/documents/schema/overall.json, packages/cdd-engine/src/rules/documents.ts, packages/cdd-engine/src/documents/tokens.ts

- **Steps**:
  1. `documents/schema/overall.json` 三处描述改向 enforcement 实读形态（enforcement 按位置读、语义正确，不反向改 engine 读法、不加 Scope 列）：`changeHistory.header.columns` enum → 描述统一首格 `version` 判定；`issueInventory.row.issueRef` 字面形式 → 合法枚举（none / `#NNN` / `[#NNN]` / `#NNN#issuecomment-<digits>` / 整格括号）；`phaseInventory.rowShape.cellCount` / `columnNames.header` → 6 内容列、与 smoke-overall 行形一致（弃自相矛盾的 7+2/7 列） — checkable: overall.json 描述与 documents.ts / tokens.ts enforcement 三处同形（对拍断言）；照 schema 描述所写形态不再被 doc-contract gate 拒绝（回归用例）
  2. 报错 UX：`bad/empty version` · `unrecognized issue ref` · `not a Phase-inventory id` 三处附 `should look like:` 正确形态行；移除误导的「use the canonical 7-column Phase inventory header」提示 — checkable: 三处报错附 `should look like:` 正确形态；误导的 7 列 header 提示移除（live 面 grep 零命中，frozen 豁免）

- **Acceptance**:
  - overall.json 描述与 `documents.ts` / `tokens.ts` enforcement 三处同形（对拍断言）；照 schema 描述所写形态不再被 doc-contract gate 拒绝（回归用例）
  - 三处报错附 `should look like:` 正确形态（bad/empty version · unrecognized issue ref · not a Phase-inventory id）
  - 误导的 7 列 header 提示移除（live 面 grep 零命中，frozen 豁免）


### Task 10: 宣讲面 · 守卫 fixture · smoke-cdd · changeset · validate 收口

- **Objective**: 宣讲面 · 守卫 fixture · smoke-cdd · changeset · validate 收口（--task → --tasks 全残留清扫）
- **DependsOn**: none
- **AtomicWith**: none

- **Produces**: 两包 README live `--task` 零命中 + zh mirror 同步；residue.test fixture 迁 `--tasks`（anti-reintroduce 保留）；smoke-cdd consumer-sim 链 `--tasks 1` + group 命名迁；changesets；validate 11 块全绿

- **Files**: packages/cdd-engine/README.md, packages/cdd-engine/README.zh-CN.md, scripts/validate/__tests__/residue.test.ts, scripts/validate/smoke-cdd.ts, .changeset/

- **Steps**:
  1. cdd-engine 包 README `--task` 示例 ×4 行 → `--tasks`（README.md implement/review 表行 + README.zh-CN.md mirror 同步；osuperpowers 包同旗零命中无改） — checkable: 两包 README live 面 `--task` 零命中（frozen 豁免）且 zh-CN mirror 与 EN 同步
  2. `residue.test.ts` 合成 fixture 字面量迁 `--tasks`（`:121` retired-`brief` 守卫 argv 迁、anti-reintroduce 断言保留）；`smoke-cdd.ts` consumer-sim 链 `--task 1` → `--tasks 1`；fix 链 `--findings` 路径字面量随组命名同迁 `tasks-1-review-1.json` — checkable: residue.test fixture 迁移完成、anti-reintroduce 守卫断言保留；smoke-cdd consumer-sim 链 `--tasks 1` 跑通（黑盒消费者等效输出）
  3. changeset 逐 phase 建（cdd-engine breaking → major；osuperpowers skills 文本更新 → minor）；提交后全量 `pnpm run validate` 11 块全绿 — checkable: `.changeset/` 新 changeset 文件就位（两包条目）；`pnpm run validate` 11 块全绿

- **Acceptance**:
  - 两包 README live 面 `--task` 零命中（`packages/cdd-engine/README.md` / `README.zh-CN.md` grep；frozen 豁免）且 zh-CN mirror 与 EN 同步
  - residue.test.ts fixture 迁移完成、retired-`brief` anti-reintroduce 守卫断言保留（行为断言不删）
  - smoke-cdd consumer-sim 链 `--tasks 1` 跑通（黑盒消费者等效输出）
  - `.changeset/` 新 changeset 文件就位（`pnpm run changeset` 生成，两包条目）；`pnpm run validate` 11 块全绿
  - 本 plan 终结态落地后 P4.3 四表由 orchestration backfill-overall（branch-review 前置义务，plan complete → v-bump + 列回填）


### Task 11: skill-anatomy 骨架 schema（canonical 单源）+ validate 机器校验 + 文本指导清理

- **Objective**: skill-anatomy 骨架 schema（canonical 单源）+ validate 机器校验 + 文本指导清理（06-skill-authoring 删除）
- **DependsOn**: none
- **AtomicWith**: none

- **Produces**: `skill-anatomy.json` 新增（结构契约：digraph/nodeDefinitions/四要素/Invariants/Failure Modes/BLOCKED/Skeleton deltas/growth 15/17 + 消费者 purity 禁 growth 叙述 heading）；DOC_SCHEMA_NAMES 五件；digraph-consistency 三断言 schema 驱动（严格 allowlist）；`## Engine Semantics`/`## Session Context` 章节改并入；`git rm 06-skill-authoring.md`

- **Files**: packages/cdd-engine/src/documents/schema/skill-anatomy.json, packages/cdd-engine/src/documents/schema.ts, packages/osuperpowers/tests/digraph-consistency.test.mjs, docs/maintainers/06-skill-authoring.md, CLAUDE.md, packages/osuperpowers/skills/cli-driven-development/SKILL.md, packages/osuperpowers/skills/writing-plans/SKILL.md, packages/osuperpowers/skills/report-issues/SKILL.md

- **Steps**:
  1. **`skill-anatomy.json` 新增**——节点锚定式 SKILL.md 结构契约 canonical JSON Schema：properties 覆盖全部结构面（digraph mermaid · nodeDefinitions `### <node>` · 节点四要素 · `## Invariants` · `## Failure Modes` · BLOCKED 终态约定 · `## Skeleton deltas`（spec-writer trio 必携）· growth 边界 15/17 · **消费者 purity**（零 growth/refactor 叙述 heading）），descriptions 全量承载规则语义；`documents/schema.ts` `DOC_SCHEMA_NAMES` 扩五件 — checkable: `cdd schema get skill-anatomy` stdout 与 canonical 同字节；DOC_SCHEMA_NAMES 五件、未知 doc-type exit 2 枚举含 skill-anatomy
  2. **validate 消费——严格 allowlist**：`digraph-consistency.test.mjs` 三断言改 schema 驱动；`##` 标题 ∈ 注册表（四公共节 + 两条件节）且 `###` ∈ 两类，注册表外章节 → **BLOCK**；`cli-driven-development` `## Engine Semantics` 独立节删除（四内容并入 Invariants）；`writing-plans` Pending Acceptance Patch 变体统一单标题；`report-issues` `## Session Context` 顶层章节移除（并入节点定义）；digraph 节仅 mermaid 块零后随 prose — checkable: 8 件 SKILL.md 经 skill-anatomy schema 机器校验全过；注册表外标题（Flow size note 族）→ BLOCK；digraph 节仅 mermaid 块零 prose；`## Session Context`/`## Engine Semantics` 顶层章节 live 面 grep 零命中
  3. **06-skill-authoring.md 全清空**——结构面规则迁入 skill-anatomy descriptions 后 `git rm` 文件；CLAUDE.md 相关引用清理（治理面保留）；digraph-consistency.test.mjs 对 MAINTAINER_DOC 的引用面改指，grep 零残留 — checkable: `git rm docs/maintainers/06-skill-authoring.md` 落地；`06-skill-authoring` live 面 grep 零命中（frozen 豁免）；`pnpm run validate` 11 块全绿

- **Acceptance**:
  - `cdd schema get skill-anatomy` stdout 与 `dist/documents/schema/skill-anatomy.json` 同字节（engine 测试断言）；DOC_SCHEMA_NAMES 五件、未知 doc-type exit 2 枚举含 `skill-anatomy`
  - 8 件 SKILL.md 经 skill-anatomy schema 机器校验全过（validate 绿）；**严格 allowlist**——现有 8 件标题面全 ∈ 注册表（对照通过：4 公共 + 2 条件，`## Engine Semantics` 独立节已在 cdd 径并入 Invariants、`## Session Context` 顶层章节已在 report-issues 径并入 `explore-current-session` 节点内联、`Pending Acceptance Patch` 变体已统一单标题），注册表外标题（如演进叙述段 `Flow size note`/`Full Flow Refactor Rationale`）→ BLOCK；**digraph 节仅 mermaid 块零 prose**（8 件逐件断言 mermaid 后续行 = 空/下一 `##`；`report-issues` 节点陈述行已删，grep 零命中）；`## Session Context`/`Session Context (snapshot…`/`## Engine Semantics` 顶层章节 live 面 grep 零命中（并入节点/Invariants 后）（engine 测试 mkdtemp 自造链故意破坏用例：删节点/断四要素/加未注册章节/在 digraph 后加 prose → 全拦下，零本仓产物 fixture）
  - digraph-consistency.test.mjs 断言面 schema 驱动化（grep 手写断言面与 schema 单源对拍，growth 15/17 常量来自 schema 非测试字面量）；e2e anti-white-green 断言保留（行为断言不删）
  - `git rm docs/maintainers/06-skill-authoring.md` 落地；`06-skill-authoring` live 面 grep 零命中（frozen 豁免）；CLAUDE.md 清理后结构指导零残留、治理面（语言政策/purity 铁律/提交纪律）保留
  - `pnpm run validate` 11 块全绿；本 plan 二次终结态落地后 P4.3 四表由 orchestration 二次 backfill-overall（reopen → re-close，v-bump + 列回填 + change-history 二次 claim）
