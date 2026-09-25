# 消费者面一致性（Consumer Parity）— P4.3 cdd 多 task + task groups 裁定 + I4 语义修复 Implementation Plan

**Spec:** [2026-09-21-consumer-parity-p4.3-design.md](docs/osuperpowers/specs/2026-09-21-consumer-parity-p4.3-design.md)
- **Parent program**: [consumer-parity overall v1.32](docs/osuperpowers/specs/2026-09-21-consumer-parity-overall.md)
- **Version**: v1.5 · 2026-09-25（mid-flight 用户裁决：Skill 骨架结构从文本指导迁移为 canonical JSON Schema 单源——新增 **Task 11**（skill-anatomy schema + validate 严格 allowlist 机器校验 + 06-skill-authoring/CLAUDE.md 文本指导清理），plan 自 complete reopen 为 in-flight 继续展开；**章节统一**——全件四公共节 Flow Digraph / Node Definitions / Invariants / Failure Modes + 两条件节 Skeleton deltas（spec-writer trio 必携）· Pending Acceptance Patch（writing-plans 承载，去 `(cross-task findings consolidation)` 后缀变体统一单标题）；**Engine Semantics 内容并入 Invariants 表**（ddl->cdd 径 `## Engine Semantics` 独立节删除——其 four 事实是编排者契约，并入 Invariants 行承载）；**Flow Digraph 节仅 mermaid 块、零后随 prose**（report-issues 的 digraph 后节点陈述行随 Task 11 清理）；**Session Context 顶层章节崩溃入 `explore-current-session` 节点内联**）
- **Base**: develop
- **Depends on**: P4.1（shipped · [p4.1-design v1.5](docs/osuperpowers/specs/2026-09-21-consumer-parity-p4.1-design.md)）

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

- **Do**: `parse.ts` 三 SUBCOMMAND_USAGE（implement/review/fix）改 `--tasks <n|n,n,…>`；三个 arg 声明 `task` → `tasks`（`valueHint: "n|n,n,…"`，citty type 仍 string）；dispatch 调用点 `intTask(args.task)` → `parseTaskList(args.tasks)`。`shared.ts` 新增 `parseTaskList`（split(`,`).map(trim) → 逐 token 整数校验 + 去重（`1,1` → `1`）+ 空 slice 拒绝；非整数 exit 2，Bug-A 消息升级 `--tasks must be comma-separated integers: <token>`）；`intTask` 内核复用于逐 token 校验、单值入口删除。`review.ts:190` / `fix.ts:41` 缺失必填错误串 `--task` → `--tasks`。`bin.ts:9` 头注释。`templates/engine-config.json` `channels.argv.task {flag: "--task", type: "int"}` → `"tasks" {flag: "--tasks", type: "int-list"}`——与 parse.ts 同改同提（residue Row-9/10 守卫从它派生 CANONICAL_ARGV_FLAGS）。

- **验收**:
  - `cdd implement --tasks 1` 与 `--tasks 1,2` 走同一 dispatch 路径、解析正确（engine 测试绿 + 实证）
  - `--tasks 1, 2` 容忍空格（trim）· `--tasks 1,1` 去重 · `--tasks 1,`（尾逗号空 slice）exit 2 拒绝 · `--tasks abc` 非整数 exit 2（Bug-A 升级消息 `must be comma-separated integers`）
  - engine 既有 `--task` T1 面全量迁 `--tasks`（parse/usage 声明 · review.ts:190 / fix.ts:41 必填错误串 · engine 用例随迁面），该面 grep `--task` 零命中（frozen 除外）；`packages/cdd-engine/src` 全量零命中在 Task 2 验收（re-dispatch 串迁移后可达）
  - residue Row-9/10 守卫绿（parse.ts ↔ engine-config argv `tasks` 通道锁步）

### Task 2: dispatch 组载体（TaskLifecycle 组 · handoff 组键 · 超界 · re-dispatch 串）

- **Do**: `dispatch/task.ts` `TaskLifecycle.#taskNum` 标量 → TaskGroup 组载体（tasks 列表，组即单位）；`buildCtx` brief/handoff 组级键。`render/brief.ts:33-36` 超界检查升组级（读盘后任务数可得：超界整体 BLOCK + 逐项列示缺失，保留 `/task N not found/` 契约）。`templates/engine-config.json` `handoffNamespace.families`（implement.task / review.task / fix.task）命名 `task-{task}-*.json` → 组键 `tasks-{a}-{b}-*`（完整 list 串无 range 缩写：`--tasks 1` → `tasks-1` · `--tasks 1,2` → `tasks-1-2`）；同文件 derived 派生网格（L106-135）handoffPath/briefPath/findingsPath 的输入 from 引用（L109-111 / L115-118 / L130-134 标量 `task`）随组键同面落迁 `tasks`（组语义下该三通道读组键命名空间，与 `tasks-{a}-{b}-*` 一致）；`templates/schema/task-handoff-schema.json` 补组引用（tasks 列表 · required 迁 tasks · **删顶层 `task` 标量字段**——单数据模型：handoff 载体面无单/多双面，`findings[].task` per-task 归因保留）。`rules/failure.ts:117-121` 与 `dispatch/task.ts:760-761` re-dispatch 建议串改整组面（`cdd fix --tasks 1,2` 形态，无子集派发）。

- **验收**:
  - `--tasks 1` 与 `--tasks 1,2` 同一 dispatch 路径行为实证（成功 · 超界 BLOCK + 缺失列示 · round/handoff/进度/残差按组一份）
  - `cdd review --type task --tasks 1,2` 一轮审整组（round/blocker/findings 组级归因）；`cdd fix --type task --tasks 1,2 --findings <handoff>` 整组修（agent 自判归因）
  - re-dispatch 建议串为整组面（`cdd fix --tasks 1,2` 形态，无子集）
  - `packages/cdd-engine/src` grep `--task` 全量零命中（frozen 除外；T1 面 + 本任务 re-dispatch 两处 failure.ts:117-121 / dispatch/task.ts:760-761 迁移后可达）
  - handoff 命名 `tasks-{a}-{b}-*` 落地（engine 测试断言 artifact 名）；task-handoff-schema 组引用字段落位、顶层 `task` 字段零存在（grep `"task"` top-level 面零命中，required 面 = `tasks` 组引用；`findings[].task` 归因保留）

### Task 3: plan schema `taskGroups` + effectiveGroups 单处派生（空默认）

- **Do**: `src/documents/schema/plan.json` 加 `taskGroups` 属性（`optional` · `default: []` · `items: {tasks: number[]}` 且 `minItems ≥ 2`，长度 1 组为冗余、单组态只存在于空默认）+ description（写入「空默认 ⇒ 每 task 一组 = per-task 现状等价」语义）。`rules/documents.ts` / `dispatch/base.ts`：`effectiveGroups = taskGroups.length ? taskGroups : singletons(taskNumbersFromPlan(plan))` 单处派生，迭代随组（`derivePlanVerdict` / 进度跟踪面同构）。

- **验收**:
  - plan 无 taskGroups 节（空默认）时 loop 逐 `--tasks 1`、`--tasks 2` 推进且与 P4.3 前现状等价（实证）；非空 taskGroups 按声明组 dispatch
  - `plan.json` schema 含 `taskGroups`（`optional` · `default: []` · item `minItems ≥ 2`）；`effectiveGroups` 单处派生、无第二实现（grep）
  - taskGroups 写盘判定：长度 1 组不落盘（合并组字典 minItems ≥ 2 与裁定节点写盘一致）

### Task 4: cli-driven-development digraph 改造（task-groups 裁定节点 + --tasks 调用串）

- **Do**: `packages/osuperpowers/skills/cli-driven-development/SKILL.md`：digraph 于 `C --> D` 边插 `T{task groups 裁定}`（task groups 界定 → 用户确认 → 才进 implement→review→fix loop；拒答 BLOCKED，门控镜像 `determine-base` AskUserQuestion 模板）；`H{more-tasks?}` → `H{more-groups?}`；节点定义补 task-groups 裁定（读 plan taskGroups → 界定 → 确认 → 组列表流入 D 的 `--tasks`；非平凡合并组 → 写 plan taskGroups 节 → 独立 commit → 干净树 → 才进 loop（树脏 BLOCK），写盘 commit 复用 I4 独立 commit 纪律——Task 6 五面文本）；implement-task / run-task-review / fix-task 三节点调用串 `--task <n>` → `--tasks <组列表>`；「One task at a time」子句改写为组语义（默认全单组 = 逐 task 现状等价）。

- **验收**:
  - flow digraph 含 task-groups 裁定节点（`C --> T{task groups 裁定}` 边）、`{more-groups?}` 判定、loop 入口以用户确认门控（拒答 BLOCKED）；组列表流入 `cdd implement --tasks a,b`
  - task-groups 裁定节点职责链齐备（非平凡合并组 → 写 plan taskGroups 节 → 独立 commit → 干净树 → 才进 loop；树脏 BLOCK；写盘 commit 复用 I4 独立 commit 纪律）
  - 三节点调用串 `--tasks`（`packages/osuperpowers/skills/cli-driven-development/SKILL.md` grep `--task` 零命中）
  - 节点定义与 digraph 一一对应（无 dangling / 无 orphan）；`pnpm run emit` 后 `emit:check` 无 drift

### Task 5: `cdd schema get` 命令（发现型 · 零执法）

- **Do**: 新增 `cli/schema.ts`：`cdd schema get <type>` 子命令组——type 枚举四件全量（overall / plan / phase-spec / add-phase-protocol，对齐 engine `DOC_SCHEMA_NAMES` 注册表，`loadDocSchema` 按名加载）；stdout 直出 canonical schema JSON 原文；未知 doc-type → exit 2 + 可用名枚举（四件同源）；出口走 `exit.ts` 出口族（无裸 return）、stdout 结果面。`parse.ts` 声明 `schema` 子命令（无新 flag → canonical argv 通道/residue 无涉）。

- **验收**:
  - `cdd schema get phase-spec` stdout 与 `dist/documents/schema/phase-spec.json` 同字节（engine 测试断言）；四件枚举均可用
  - 未知 doc-type → usage exit 2 + 可用名枚举（四件、与注册表同源）
  - 零执法逻辑（黑盒断言无校验面）；`cli/schema.ts` 无裸 return、exit.ts 出口族
  - `cdd help` 功能不回归（本 task 后仍三行目录面——Task 7 简化为两行）

### Task 6: skills 五件收口（I4 五面重写 · read-schema 直取 · 残留定位串清扫）

- **Do**: 五件 skills（writing-single-spec **I3** · writing-overall-spec **I3** · writing-phase-spec **I4** · writing-plans **I4** · cli-driven-development **I7**）的 Mid-Flight Backfill 文本重写——四点 + 显式顺序：任何 dispatch（implement/review/fix）返回 → 立地落地 backfill → 独立 commit → 循环暂停至树净 → 恢复后下一轮 review in-band 审计（changed-surface booking，非 block；pending-acceptance sole-writer 路径保留）；**五面行体逐字节一致**（编号差异保留不统一）。三件 schema-bearing 技能（writing-overall-spec / writing-phase-spec / writing-plans）read-schema 指令从「run `cdd help` → `schemas:` 目录 → Read `<type>.json`」改「run `cdd schema get <type>` 直取成文」；writing-single-spec read-schema 节点显式 N/A；残留 `cdd help` 定位串清扫（writing-overall-spec role-note「(`cdd help` → `overall.json`)」/「(via `cdd help`)」、writing-plans pending-patch zone「`cdd help` → `plan.json`」）；改后 `pnpm run emit` + `emit:check` 无 drift + 产物重生成。

- **验收**:
  - I4 文本五面同文（grep 五面逐字节一致断言）+ 四点顺序语义齐备（措辞核对）
  - 三件 schema-bearing read-schema 改 `cdd schema get <type>`（grep 三件命中）；writing-single-spec read-schema N/A 入文
  - `cdd help` → `schemas:` 目录 / `cdd help` → `overall.json` / `phase-spec.json` / `plan.json` 定位串零残留
  - `pnpm run emit` 后 `emit:check` 无 drift

### Task 7: `cdd help` 子命令整体移除（--help 旗标保留）

- **Do**: **整体移除 `cdd help` 子命令**（2026-09-24 mid-flight 用户裁决「感觉没什么用」——Task 5 `cdd schema get` + Task 6 skills read-schema 直取后，help 三行发现面全空消费者：`schemas:` 行唯消费者 read-schema 已切 schema get、`cli:` / `templates:` 两行全仓零 agent 消费，dead surface 即删）：删 `cli/help.ts` 整文件（`runHelp` / `renderHelpText` / `cliDirectory` / `templatesDirectory` / `schemaDirectory`——schema 目录面不走 engine `loadDocSchema` 文档注册面、属死代码）；`cli/bin.ts` 删 `cdd help` pre-boot 拦截块（`--help` / `-h` pre-screen 保留——citty usage 渲染面，usage error 仍消费，**旗标面不回归**）；`cli/parse.ts` 删 helpCmd 声明 + `usage: cdd help` + 根描述 `schema/help` → `schema`（help 不注册即 unknown command，exit 2 + 子命令清单，可接受）；`cli/__tests__/help.test.ts` 删除。`scripts/validate/smoke-cdd.ts` consumer-sim 三行断言（cli/schemas/templates realpath）改锚 `cdd schema get plan`（AC6 安装面 schema-dir addressability 字节同形替换）+ `DOC_SCHEMA_FILES` existsSync 保留（templates addressability 由消费者链全流程隐式证）。`docs/maintainers/02-template-doctrine.md` "(surface: `cdd help` → `schemas:` dir)" 改述 `cdd schema get`；`documents/schema.ts:19` 注释 "(face a consumer install ships and `cdd help` prints)" 同步改述。Non-goal #1 双发现型豁免缩为单发现型 `cdd schema get`（charter v1.32）。

- **验收**:
  - `cdd help` 子命令零存在（`cli/help.ts` / `bin.ts` help 拦截块 / `parse.ts` helpCmd / `help.test.ts` 四面删除，`cdd help` 引擎面 grep 零命中）
  - `--help` 旗标面不回归（usage 渲染绿）；`pnpm run validate` 11 块全绿（smoke-cdd consumer-sim 改锚 `cdd schema get plan` 后 AC6 安装面 addressability 实测通过）
  - Non-goal #1 单发现型修订落地（`cdd schema get` 唯一豁免）；`docs/maintainers/` / `documents/schema.ts` 注释零 `cdd help` 残留

### Task 8: #274 — doc-contract plan 列中间态 + claim 等值 + 诊断

- **Do**: `rules/documents.ts`：`isPendingText` 旁新增 `isInflightText`；plan 列三态语义 `[Pending]`（未开工）→ `[In-flight]`（已开工 · **无 reverse claim 义务**）→ `**Done**`（+ closeout claim）；in-flight 列不触发 reverse claim（非缺失 cell、不计 mismatch，closeout 规则 carve-out）。claim 双向等值放宽：link 形态 plan cell 对齐 design 列 `ownDesignToken` 提取——双向校验从逐字符严格相等（`stripCellMarkup === claim_target`）改为「link 指向同一 plan 文档即等」。诊断改进：claim 解析不再整子句扫 phase（prose 提及的 phase 误作 claim target），只认显式 claim 结构（`Pending → **Done**`）；多 phase 命中报错附「同子句 prose 提及 phase 亦成 target」提示。`documents/schema/overall.json` claimPatterns / plan cell completion marker 描述同步。

- **验收**:
  - `[In-flight]` 计划列状态合法（`isInflightText` · 无 reverse claim 义务 · 非 mismatch cell）；`[Pending]` → `[In-flight]` → `**Done**` 三态 + claim 只在 closeout 出现（engine 测试自造链 + P3.8 触发现场回归形态）
  - Link 形态 plan cell 与 claim 双向等值（ownDesignToken 对齐，link 指向同一 plan 文档即等）；子句 prose 提及 phase 不再整体作 claim 目标（诊断提示到位）
  - overall.json claimPatterns / plan cell 描述与 enforcement 同形（对拍断言）

### Task 9: #276 — overall.json 描述↔enforcement 对齐 + 报错 UX

- **Do**: `documents/schema/overall.json` 三处描述改向 enforcement 实读形态（enforcement 按位置读、语义正确，不反向改 engine 读法、不加 Scope 列）：`changeHistory.header.columns` enum → 描述统一首格 `version` 判定；`issueInventory.row.issueRef` 字面形式 → 合法枚举 none / `#NNN` / `[#NNN]` / `#NNN#issuecomment-<digits>` / 整格括号（`^[（(][^）)]*[）)]$`）；`phaseInventory.rowShape.cellCount` / `columnNames.header` → 6 内容列（c1=id / c3=Design / c4=plan / c6=dependency）、与 smoke-overall.md 行形一致（弃自相矛盾的 7+2 计数与 7 列 header）。报错 UX：`bad/empty version` · `unrecognized issue ref` · `not a Phase-inventory id` 三处附 `should look like:` 正确形态行；移除误导的「use the canonical 7-column Phase inventory header」提示（引擎不按该列序读取）。

- **验收**:
  - overall.json 描述与 `documents.ts` / `tokens.ts` enforcement 三处同形（对拍断言）；照 schema 描述所写形态不再被 doc-contract gate 拒绝（回归用例）
  - 三处报错附 `should look like:` 正确形态（bad/empty version · unrecognized issue ref · not a Phase-inventory id）
  - 误导的 7 列 header 提示移除（live 面 grep 零命中，frozen 豁免）

### Task 10: 宣讲面 · 守卫 fixture · smoke-cdd · changeset · validate 收口

- **Do**: cdd-engine 包 README `--task` 示例 ×4 行 → `--tasks`（`packages/cdd-engine/README.md:31,37` implement 表行 · review `--task` 选项列举 + `README.zh-CN.md:33,39` mirror 同步；osuperpowers 包同旗零命中无改）。`scripts/validate/__tests__/residue.test.ts:1149` + `:121` 合成 fixture 字面量迁 `--tasks`（`:121` retired-`brief` 守卫 `cdd brief --task 1 …` argv 迁 `--tasks`、anti-reintroduce 断言保留——与 `cli-shape.test.ts:108` 同构，非死码）。`scripts/validate/smoke-cdd.ts:320-323` consumer-sim 链 `--task 1` → `--tasks 1`；fix 链 `--findings` 路径字面量 `task-1-review-1.json`（L323）随 Task 2 组命名（`tasks-{a}-{b}-*`）同迁 `tasks-1-review-1.json`。changeset 逐 phase 建（cdd-engine breaking → major；osuperpowers skills 文本更新 → minor）。提交后全量 `pnpm run validate` 11 块全绿。

- **验收**:
  - 两包 README live 面 `--task` 零命中（`packages/cdd-engine/README.md` / `README.zh-CN.md` grep；frozen 豁免）且 zh-CN mirror 与 EN 同步
  - residue.test.ts fixture 迁移完成、retired-`brief` anti-reintroduce 守卫断言保留（行为断言不删）
  - smoke-cdd consumer-sim 链 `--tasks 1` 跑通（黑盒消费者等效输出）
  - `.changeset/` 新 changeset 文件就位（`pnpm run changeset` 生成，两包条目）；`pnpm run validate` 11 块全绿
  - 本 plan 终结态落地后 P4.3 四表由 orchestration backfill-overall（branch-review 前置义务，plan complete → v-bump + 列回填）

### Task 11: skill-anatomy 骨架 schema（canonical 单源）+ validate 机器校验 + 文本指导清理

- **Do**: ① **`packages/cdd-engine/src/documents/schema/skill-anatomy.json` 新增**——节点锚定式 SKILL.md 结构契约 canonical JSON Schema：properties 覆盖全部结构面（`digraph` mermaid 段 · `nodeDefinitions` `### <node>` 标题 · 节点四要素 `**Do:**`/`**Read:**`/`**Exit:**/`**Fail:**` 字段 · `## Invariants` 表 · `## Failure Modes` 表 · BLOCKED 终态约定 · `## Skeleton deltas` 表（三件 spec-writer 必携 + deltas 表是校验输入）· growth 边界 15/17 · **消费者 purity**（SKILL.md 零 growth/refactor 叙述 heading——`Flow size note`/`Full Flow Refactor Rationale` 均禁）），descriptions 全量承载规则语义（"schema 唯一结构事实"，替代 06-skill-authoring 文本）。`documents/schema.ts` `DOC_SCHEMA_NAMES` 扩为五件 `["overall","plan","phase-spec","add-phase-protocol","skill-anatomy"]`——`cdd schema get skill-anatomy` 直出、未知 type 枚举含五件。② **validate 消费——严格 allowlist（用户裁决：skill = 消费者真实入口面 · 零不确定性）**：`packages/osuperpowers/tests/digraph-consistency.test.mjs` 三断言（双向完备/同构/growth + 消费者 purity）从手写改 **schema 驱动**：读 engine 包 skill-anatomy.json、按 schema 结构校验 8 件 SKILL.md，失败诊断措辞取自 schema descriptions；**`##` 标题 ∈ 注册表（**四公共节** Flow Digraph · Node Definitions · Invariants · Failure Modes + **两条件节** Skeleton deltas（spec-writer trio 必携）· Pending Acceptance Patch（writing-plans 承载））且 `###` 标题 ∈ 两类（backtick 节点名 / pending-patch 样例 `Task N: …`）——注册表外章节/标题 → **BLOCK**（未见定义即不确定性，skill 是消费者真实会用的入口面）**；**`cli-driven-development` 的 `## Engine Semantics` 独立节删除**（2026-09-25 用户裁决——其内容四项 = 编排者面 engine 事实（dry-run 纯模拟 / `cdd fix --type branch` 唯一通道 / 软性 review 上限 ≤3 / entry gate 读树不读 commit 范围），字段级并入 `## Invariants` 表行承载，allowlist 不放行独立节）；**`writing-plans` 的 Pending Acceptance Patch 变体统一**（`(cross-task findings consolidation)` 后缀删除 → 单标题 `## Pending Acceptance Patch`，zone 语义不变）；**`report-issues` 的 `## Session Context` 顶层章节移除**（2026-09-25 用户裁决：它是 `explore-current-session` 节点的 snapshot 细节——root/workspace/harness/program-owning-issue 四字段，非顶层结构面）→ 四字段细节并入该节点定义内（节点内联，顶层章节删除，allowlist 不放行）；**digraph 节内容约束：`## Flow Digraph` 下仅 mermaid 代码块、零后随 prose**（flow 介绍行 = 冗余叙述，Node Definitions 已足够详细；`report-issues` 的「7 process steps / 9 nodes: …」陈述行随本任务删除——其信息已由 digraph 与 Node Definitions 双载体冗余，属消费者面零价值叙述）；e2e anti-white-green 断言保留；validate 不新增块（并入 osuperpowers node:test 既有接线，pre-commit.test.ts 钉死 fullSteps=11 不动）。③ **06-skill-authoring.md 全清空**——结构面规则迁入 skill-anatomy descriptions 后 **`git rm` 文件**（223 行文本指导删除）；CLAUDE.md 相关引用清理/改述（`06-skill-authoring` 字样零残留，frozen 豁免），语言政策 · Consumer surface purity 铁律 · 提交纪律等治理面保留。④ 本 plan Task 10 收口面联动核对（changeset 两包条目已含，skill-anatomy 属 cdd-engine product 面同 major 收）。⑤ 显式检查：`digraph-consistency.test.mjs` 对 MAINTAINER_DOC 的引用面在 06 删除后改指（growth 注册表随文件删或迁 schema 描述），grep 零残留。

- **验收**:
  - `cdd schema get skill-anatomy` stdout 与 `dist/documents/schema/skill-anatomy.json` 同字节（engine 测试断言）；DOC_SCHEMA_NAMES 五件、未知 doc-type exit 2 枚举含 `skill-anatomy`
  - 8 件 SKILL.md 经 skill-anatomy schema 机器校验全过（validate 绿）；**严格 allowlist**——现有 8 件标题面全 ∈ 注册表（对照通过：4 公共 + 2 条件，`## Engine Semantics` 独立节已在 cdd 径并入 Invariants、`## Session Context` 顶层章节已在 report-issues 径并入 `explore-current-session` 节点内联、`Pending Acceptance Patch` 变体已统一单标题），注册表外标题（如演进叙述段 `Flow size note`/`Full Flow Refactor Rationale`）→ BLOCK；**digraph 节仅 mermaid 块零 prose**（8 件逐件断言 mermaid 后续行 = 空/下一 `##`；`report-issues` 节点陈述行已删，grep 零命中）；`## Session Context`/`Session Context (snapshot…`/`## Engine Semantics` 顶层章节 live 面 grep 零命中（并入节点/Invariants 后）（engine 测试 mkdtemp 自造链故意破坏用例：删节点/断四要素/加未注册章节/在 digraph 后加 prose → 全拦下，零本仓产物 fixture）
  - digraph-consistency.test.mjs 断言面 schema 驱动化（grep 手写断言面与 schema 单源对拍，growth 15/17 常量来自 schema 非测试字面量）；e2e anti-white-green 断言保留（行为断言不删）
  - `git rm docs/maintainers/06-skill-authoring.md` 落地；`06-skill-authoring` live 面 grep 零命中（frozen 豁免）；CLAUDE.md 清理后结构指导零残留、治理面（语言政策/purity 铁律/提交纪律）保留
  - `pnpm run validate` 11 块全绿；本 plan 二次终结态落地后 P4.3 四表由 orchestration 二次 backfill-overall（reopen → re-close，v-bump + 列回填 + change-history 二次 claim）
