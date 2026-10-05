# Doc Architecture v2 P3 实施计划（TaskGraph 分组派生 + 文档形态单一化）

**Spec:** [2026-10-02-doc-architecture-v2-p3-design.md](docs/kairos/specs/2026-10-02-doc-architecture-v2-p3-design.md)

- **Parent program**: [2026-10-02-doc-architecture-v2-overall.md v1.6](docs/kairos/specs/2026-10-02-doc-architecture-v2-overall.md)
- **Version**: v1.2 · 2026-10-05（plan-fix-2 四 finding 落地，待 re-review）
- **Depends on**: P3 design v1.1 Approved（spec-review-1 九 finding 全落地 · committed a502d31d）
- **Base**: develop

## Constraints

### 口径

- **文档形态单一化适用范围**：engine 只认一种 grammar——T3 删 runtime 读面、T4 删 shape/token 面；双读面退役后，新文档携带 legacy 面（`- **Do**:` 任务块 / Form B 锚 / `## Task Groups` 段 / spec `## Section 1`）= `docContractValidate` BLOCK
- **rank := 任务编号 1..N**：`dependsOn` 声明边只许指向**更小编号**（任务 N 的 `dependsOn` 项必须 < N）——边方向定义与 spec §1 公式 rank(源)<rank(目标) 取齐：**边源 = 被引依赖项（更小编号端）→ 边目标 = 依赖方任务（更高编号端）**，即「依赖边只许指向更高编号任务」指向的正是依赖方；故「任务 N 的 dependsOn 项必须 < N」与 spec 措辞同式非镜像——逆序边归 ③ 矛盾边 crisp BLOCK（「先清底再上闸」编号前向，plan 级判定非属性测试）
- **TaskGraph 契约**：`validate(): GraphVerdict | null`（null = valid；GraphVerdict = 失败聚合 `{ failures: { class, field, id, description }[] }`，首个违规不短路）→ `groups(): TaskGroup[]`（先 validate 后 groups，非空即 throw `GraphViolationError`，不静默出序）；构造注入 `Task[]`（按 `### Task N:` 升序，下标 i+1 = 任务 id）
- **树迁移保真**：任务编号 `1..N` 连续逐字 · Do 形验收原文逐字入 `acceptance[]` · 约束原文逐字（含 `## Global Constraints` → `## Constraints` 换壳）——三者 machine-pin；**4 散文期无验收原文** → acceptance 按正文/文件面推导补全 + tree-migration 显式断言补全产物（不落入逐字 pin 隐式缺省）
- **迁移队列红窗口**：红窗口自本 spec/plan 提交起即开（p3-design 令 21 design 计数移位但 SPEC_GOLDEN 缺失、本 p3-plan 令 22 plan 计数移位但 PLAN_GOLDEN 缺失——树套件红早于 T3），由 T3 首步重基动作统一收口为「迁移队列期望态」声明（legacy 文档标 pending-migration（BLOCK），canonical / 零迁移对象绿），T5–T7 逐家族翻绿、T8 全绿零排除（47 校验文件 + one-off 容忍）——红窗口是单形态破产的显式过渡态，非隐式静默
- **one-off 排除**：`2026-09-28-cdd-review-contract-fix.md`（独立 single-spec，无 parent overall / canonical schema，引擎已不识别）为历史 one-off——walk 容忍不迁移、不纳入 41

### commit 边界机制

- 实现提交按任务粒度（conventional，无 attribution）；迁移文档按文档/家族独立 `docs(kairos):` 提交；spec/plan 文档仅 orchestrator（Plan Sole Writer）与 cdd fix-agent 修改，implement agent 零文档修改权
- 每任务闭合前该任务面测试 + 相关 validate 面全绿；`pnpm run emit:check` fresh 保持（T9 统一重生成）
- **changeset 义务（T9）**：`@oscaner-skills/cdd-engine`（TaskGraph + 单形态退役 + 迁移守卫）+ `kairos`（SKILL 文案视面）——先读 `.changeset/README.md` 判定再建

### Flow Atomicity

- 单任务原子：每任务闭合前该任务面 vitest 全绿 + 相关 validate 面零回归（schema.test / tokens.test / plan-body.test / phase-spec-body.test / constraints-inheritance.test / doctypes.test / factory.test / rules/__tests__ / dispatch/__tests__）
- **red-free 纪律**：engine colocated suite 每任务末全绿；树套件红仅限显式声明的迁移队列窗口（自本 spec/plan 入树起至 T8——所指即 口径·迁移队列红窗口，T3 首步重基收口）；任何 diff pin 破 → deliberate update 登记（T4 golden 重 pin 即登记）
- 串行 dispatch：T1→T2→T3→T4→T5→T6→T7→T8→T9，全 singleton 组（边声明仅前向 → 派生组 = 单例拓扑序 = 序号序，零 dispatch 行为变化，dogfood 图模型）

### 顺序原则

- 先 engine（T1/T2 additive 树绿 → T3/T4 退役）后迁移（T5 specs → T6 Do plans → T7 散文期）→ 收口（T8 全树绿）→ 消费面 + 终验（T9）
- 依赖：T2 依赖 T1（解析边 + TaskGraph）；T3 依赖 T2（先切派生源再删字面读面）；T4 依赖 T3（shape/token 面随 runtime 面删除并集）；T5–T7 依赖 T3/T4（单形态 engine 就位）；T8 依赖 T5–T7；T9 依赖全量
- 每任务 end-to-end：实现 → 该任务面测试绿 → `pnpm run emit:check` fresh（如涉消费面）→ 提交

### 仓库纪律

- node：`fnm use`（.nvmrc）；引擎调用 `node packages/cdd-engine/src/bin.ts <subcommand>` 直调（零构建 dev face），不走 global cdd
- language policy：代码/测试 English-primary（本计划为 internal docs，中文豁免 Strategy B）；无 attribution trailers
- engine 测试 colocated `__tests__/*.test.ts`（vitest，在 engine 包内执行：`pnpm --filter @oscaner-skills/cdd-engine test`）；新增测试不进根配置
- **Criterion ②**：新抽象 `TaskGraph` / `GraphVerdict` 全类形态 + 构造注入只读；`GraphFailure` 为类型化联合面；export 面无裸函数；**空壳死代码即删**——双读面删除即删净不留壳
- **dist 镜像**：`dist/` gitignored（build 产物）；T4 改 source `config/schema/plan.json` 后跑 `pnpm --filter @oscaner-skills/cdd-engine build` 刷新 dist 镜像，`cdd schema get plan` 所见即新形（published-first 解析）

### Notes for downstream（回填待办登记）

> **overall 回填待办（backfill-as-version）**：overall v1.6 [P3 行](docs/kairos/specs/2026-10-02-doc-architecture-v2-overall.md) acceptance 列七项旧措辞（无环断言 / union==task set / 原子闭包 / 越界 / 自引 / 矛盾边 / 重复）与其自身 F1 决策五类（越界 / 自引 / 矛盾边 / 环 / 重复，overall:59）不一致——**overall 下一版本改版时**将该列收敛为五类措辞；五类 ↔ 七项映射见 P3 design §1 一致性注记（原子闭包 = 组派生语义 · union==task set = 构造恒满足，均非 BLOCK 类）。本 plan 不代笔 frozen overall——此登记保证回填待办不随 P3 收口丢失。

### Task 1: 边声明读写面激活 + TaskGraph 类（原子闭包分量 + 五负例 BLOCK + 拓扑序组序）

- **Objective**: 将 P2 声明的 `dependsOn?`/`atomicWith?` 扩展位激活为读写面，新增 `TaskGraph` 类落地唯一分组派生（组件 = 原子闭包分量 · 组序 = 分量 DAG 拓扑序）
- **Consumes**: `Task` 类字段（`body/task.ts`，P2 已声明 dependsOn?/atomicWith?）；`TaskGroup`（`domain/task-group.ts`，类已存在）
- **Produces**: `class TaskGraph`（`body/task-graph.ts`）：`constructor(tasks: Task[])`（tasks 按 `### Task N:` 升序、下标 i+1 = 任务 id）· `validate(): GraphVerdict | null` · `groups(): TaskGroup[]`；`GraphFailure { class: "missing-id"|"self-loop"|"contradiction"|"cycle"|"duplicate"; field: "dependsOn"|"atomicWith"; id: number; description: string }`；`GraphVerdict { failures: GraphFailure[] }`（类 + 构造注入）
- **Files**:
  - Create: `packages/cdd-engine/src/documents/doctypes/body/task-graph.ts`
  - Modify: `packages/cdd-engine/src/documents/doctypes/body/task.ts`（注释面：declared → active read/write，移除 "zero read/write at P2" 措辞；字段不变）
  - Modify: `packages/cdd-engine/src/documents/doctypes/body/plan-body.ts`（`PLAN_SLICE_PATTERNS` 增 `dependsOn: /^- \*\*DependsOn\*\*:[ \t]*/` `atomicWith: /^- \*\*AtomicWith\*\*:[ \t]*/`；schema tasks items 的 dependsOn/atomicWith description 改 declared → read/write）
  - Modify: `packages/cdd-engine/src/documents/doctypes/plan.ts`（`parseTaskBlock` plan.ts:126 增边字段读取——`- **DependsOn**: 3, 5` / `- **AtomicWith**: 4, 5` 逗号表 → `number[]`，接 Task opts；legacy Do 块仍返回 null，不建立新块）
  - Test: `packages/cdd-engine/src/documents/doctypes/body/__tests__/task-graph.test.ts`
- **Steps**:
  - [ ] 1. 写失败测试（task-graph.test.ts）：① 闭包正例——T2 atomicWith[1]、T3 atomicWith[2] → `groups() === [[1,2,3]]`；② 无边三任务 → `[[1],[2],[3]]`；③ 链 T1→(dependsOn[])T2 dependsOn[1]、T3 dependsOn[2] → `groups() === [[1],[2],[3]]`（组序 = 拓扑序）；④ 扇出 T2 dependsOn[1]、T3 dependsOn[1] → 组序并列按最小任务编号升序稳定 `[[1],[2],[3]]`；⑤ BLOCK ×5，各 fixture 精确命中唯一目标 class（判定优先级：目标越界与 target==源 自引先于编号逆序判定——逆序判定只作用于有界且异号的边）——越界 `T2 dependsOn[99]` → 仅 `missing-id` · 自引 `T2 dependsOn[2]` → 仅 `self-loop` · 矛盾 `T1 atomicWith[2]+dependsOn[2]`（同对 atomic∧depends）→ 仅 `contradiction` · 环改为不触发逆序边的分量间 DAG——T1 atomicWith[4] ∧ T2 atomicWith[3] ∧ T3 dependsOn[1] ∧ T4 dependsOn[2]（分量 {1,4}↔{2,3} 互指，无逆序边 / 分量内 dependsOn）→ 仅 `cycle` · 重复 `T1 atomicWith[2,2]` → 仅 `duplicate`——各 `validate()` 非 null 且**精确 class 集合 = 目标 class**
  - [ ] 2. 运行确认红（`pnpm --filter @oscaner-skills/cdd-engine test -- task-graph`）——module 不存在即红
  - [ ] 3. 实现 `task-graph.ts`：原子闭包（atomicWith 无向单侧 → 对称+传递闭包 → 连通分量）→ 分量 DAG（dependsOn 边 = 分量间）→ 拓扑序（并列按最小任务编号升序）+ 五负例 validate（越界/自引/矛盾（同对 atomic∧depends · 闭包分量内 dependsOn · 编号逆序 rank(目标)<rank(源)）/环（收缩后 DAG）/重复）；`parseTaskBlock` 边字段解析 + `PLAN_SLICE_PATTERNS` 两切片（plan-body.ts）
  - [ ] 4. 运行全绿（task-graph.test.ts 全过 + 既有 dual-read/doctypes 套件零回归——additive）
  - [ ] 5. 提交（`feat(engine): TaskGraph 原子闭包分组 + 边读写面激活`）
- **Acceptance**:
  - task-graph.test.ts 全绿：闭包对称/传递 · 连通分量 = 组 · 无边 → 全单例 · 拓扑序组序（并列最小编号升序）· BLOCK 五负例精确 class 断言（各 fixture 仅命中目标 class）
  - `parseTaskBlock` 读 `- **DependsOn**:`/`- **AtomicWith**:` → Task 数据记录字段；legacy Do 块仍 null（dual-read 未变）
  - 既有 engine 套件零回归（树未动——additive 任务）

### Task 2: effectiveGroups 派生源切换（graph 派生 · rank 前向 plan 级 BLOCK · dispatch 零回归）

- **Objective**: `effectiveGroups(planPath)` 派生源自字面 `taskGroupsFromPlan` 切换为 `TaskGraph.groups()`（先 validate 后 groups）；dispatch 四处消费点零改
- **Consumes**: Task 1 的 `TaskGraph` / `parseTaskBlock` 边读；`taskNumbersFromPlan`（既有序号扫描）
- **Produces**: `effectiveGroups` 新语义 = 图派生组（`taskGroupsFromPlan` 暂存，T3 删）；`GraphViolationError`（carry `GraphVerdict.failures`）
- **Files**:
  - Modify: `packages/cdd-engine/src/documents/doctypes/plan.ts`（`effectiveGroups` plan.ts:354 重实现）
  - Test Create: `packages/cdd-engine/src/documents/doctypes/__tests__/effective-groups.test.ts` + 新形 fixture（带边）
- **Steps**:
  - [ ] 1. 写失败测试：新形边 fixture（T2 dependsOn[1]、T3 dependsOn[2]）→ `effectiveGroups === [[1],[2],[3]]`（派生序）；无边新形 fixture → `[[1]..[N]]`（与旧序字节一致）；逆序边 fixture（T1 dependsOn[3]）→ `effectiveGroups` throw `GraphViolationError`
  - [ ] 2. 运行确认红
  - [ ] 3. 实现：`effectiveGroups` = `taskNumbersFromPlan`（序）→ `tasksFromPlan`（数据记录，按下标 = id）→ `new TaskGraph(tasks)` → `validate()` 非 null → throw `GraphViolationError`（失败聚合入 message）→ `groups()`；无边/无记录 plan → 全单例（任务编号升序，与旧行为一致）
  - [ ] 4. 运行全绿：effective-groups.test.ts 全过 + `dispatch/__tests__/runner.test.ts` 零回归（dispatch/base·task·closeout·status 消费零 diff）
  - [ ] 5. 提交（`feat(engine): effectiveGroups 图派生 + rank 前向 crisp BLOCK`）
- **Acceptance**:
  - effectiveGroups = 图派生组序（拓扑序）；无边 plan 组序字节一致（既有 dispatch 测试绿）
  - 逆序边 / 越界 / 环 → `GraphViolationError`（effectiveGroups 不静默出序）
  - dispatch 消费面零 diff（`DocumentsValidator.effectiveGroups` facade 不变）

### Task 3: 双读面 runtime 退役（Form B 锚 · 约束双读 · taskGroupsFromPlan · Do 面 · 六段 legacy 路径）

- **Objective**: 删除全部 legacy runtime 读面；首步重基树套件为单形态迁移队列；legacy fixtures 删除；孤儿任务块 BLOCK
- **Consumes**: T2 的 `effectiveGroups` 图派生（violate 已 throw）；删除对象——`taskGroupsFromPlan` / `PLAN_FORM_B_ANCHOR_TOKENS` + formBAnchor 锚读 / `extractProseConstraints` + `specConstraintsOf` Section-1 读 / 六段豁免路径 / `parseTaskBlock` Do 分支
- **Produces**: 单形态 grammar（runtime 读面全删净）；迁移队列树套件（dual-read 单形态重资 + **Create `tree-migration.test.ts`**）；孤儿任务块 / Form B 约束未声明 / spec `## Section 1` BLOCK 语义；legacy fixtures 零存在
- **Files**:
  - Modify: `packages/cdd-engine/src/documents/doctypes/body/plan-body.ts`（删 `PLAN_FORM_B_ANCHOR_TOKENS` · `formBAnchorHeadingRe` · `formBAnchorSlices`）
  - Modify: `packages/cdd-engine/src/documents/doctypes/plan.ts`（删 `taskGroupsFromPlan` · `PlanParse.taskGroups` · `extractProseConstraints` 调用（extractPlanConstraints Form B 回退，plan.ts:377）· `parseTaskBlock` Do 分支——孤儿任务块 = validate FAIL）
  - Modify: `packages/cdd-engine/src/documents/doctypes/body/constraints.ts`（删 `extractProseConstraints` · `specConstraintsOf` Section-1 读路径（constraints.ts:80）——spec 约束单源 = 字面 `## Constraints`）
  - Modify: `packages/cdd-engine/src/documents/doctypes/phase-spec.ts`（删六段 legacy 豁免路径：no `## Design` → P1 acceptance path（:176）· `## Constraints` legacy no-op（:143）——三真骨架 = 唯一断言面）
  - Modify: `packages/cdd-engine/src/documents/doctype.ts`（taskGroups schema-leaf accessor 注释）
  - Modify: `packages/cdd-engine/src/documents/doctypes/__tests__/dual-read.test.ts`（**首步**：重资为单形态树套件——compositions 改全树 48 walk set（22 plan + 21 design + 4 overall + 1 one-off，plans/ 含本 p3-plan）· `SPEC_GOLDEN` / `PLAN_GOLDEN` 一并退役 · 每文档期望态委派 `tree-migration.test.ts` = canonical 绿（含本 p3-plan 数据形，零迁移对象）/ legacy pending-migration / one-off 容忍）
  - **Test Create**: `documents/doctypes/__tests__/tree-migration.test.ts`（迁移队列期望态表 + 基础断言骨架；T5–T7 逐家族扩展 · T8 转全绿终态）
  - Delete fixtures: `documents/doctypes/__tests__/fixtures/legacy-six-section-spec-design.md` · `.../fixtures/form-b-plan.md`
  - Test: 新形 fixture——含 `- **Do**:` 任务块 / Form B 锚 / spec `## Section 1` → validate fail（orphan / 约束未声明 BLOCK）
  - Modify/pin: `documents/doctypes/body/__tests__/plan-body.test.ts` · `phase-spec-body.test.ts` · `constraints-inheritance.test.ts`（审计对删除符号——Form B 锚切片 / 六段豁免路径 / extractProseConstraints / Section-1 读——的引用，随删随 pin，并入 deliberate update 登记）
- **Steps**:
  - [ ] 1. **首步重资树套件**（红窗口恢复声明动作 · 收口自本 spec/plan 提交起的红窗口）：dual-read.test.ts 改单形态——compositions 断言全树 48 文件（22 plan + 21 design + 4 overall + 1 one-off，plans/ 含本 p3-plan）、`SPEC_GOLDEN` 与 `PLAN_GOLDEN`（每文件 {count,src,merged} 表 :54-79 + 「every plan」golden 断言 :277-314）**一并退役**——「every plan」golden 期望委派 `tree-migration.test.ts` 期望态表；**显式 Create `tree-migration.test.ts`**，迁入「迁移队列期望态」表（p3-design 新形 / 本 p3-plan 数据形 = canonical 绿（零迁移对象）· 20 六段 + 21 plan = pending-migration · one-off 容忍）+ 基础断言骨架——本步使树套件在**删除前**对全树 48 文件构成一致期望，T5–T7 逐家族扩展、T8 转全绿终态
  - [ ] 2. 删除 runtime 面（plan-body/plan/constraints/phase-spec/doctype 上述符号）+ legacy fixture 删除；新增孤儿/BLOCK fixture + 断言（`- **Do**:` 任务块 validate fail · Form B 锚约束未声明 BLOCK · spec `## Section 1` fail——三真骨架断言缺失）
  - [ ] 3. engine colocated suite 绿（树套件红窗口 = 迁移队列期望，符合）
  - [ ] 4. 提交（`refactor(engine): 双读面 runtime 退役——单形态 grammar（树迁移队列开窗）`）
- **Acceptance**:
  - runtime 面 grep 零命中（engine src 含注释）：`PLAN_FORM_B_ANCHOR_TOKENS` / `formBAnchorHeadingRe` / `formBAnchorSlices` / `formBProseAnchors` / `taskGroupsFromPlan` / `extractProseConstraints` / `specConstraintsOf` Section-1 读 / 六段 legacy 豁免路径 / `parseTaskBlock` Do 分支
  - `SPEC_GOLDEN` 与 `PLAN_GOLDEN` 一并退役零存在（「every plan」golden 断言委派 `tree-migration.test.ts` 期望态表）
  - 新文档携带 legacy 面 = validate fail（孤儿任务块 · Form B 约束未声明 · spec `## Section 1`）
  - 树套件 = 单形态迁移队列（48 期望态一致，`tree-migration.test.ts` 建置）；legacy fixtures 零存在

### Task 4: schema/token/product 重基（shape 节点删除 · DOC_TOKENS · plan.json 新 golden · smoke-cdd 新数据形 · 删除集并集 grep 零命中）

- **Objective**: 删除 shape/token 面（taskGroups + Form B schema 节点 / 四 token），重派生 plan.json + tokens golden，刷新发布面（smoke-cdd + dist）；落地 spec 的「硬删除 grep 零命中」并集验收
- **Consumes**: T3 删除集（runtime 面符号——formBAnchors / taskGroupsFromPlan / Section-1 读，作为删除集**并集** grep 的 T3 侧）；T3 树套件基线（48 walk set）；P2 SchemaFactory 重派生机制
- **Produces**: `plan.json` 新 golden（taskGroups / Form-B 面零存在）· `DOC_TOKENS` 四 token + proseAnchors 裁剪 · `dist/` 镜像刷新 · 删除集并集 grep 零命中断言（T3+T4 全符号集）；body/spec 三测试文件重 pin 绿
- **Files**:
  - Modify: `packages/cdd-engine/src/documents/doctypes/body/plan-body.ts`（`PLAN_BODY_SHAPE` 删 `taskGroups` 节点（`$defs.section`/`items`/`default`）· `constraints.formBProseAnchors` 节点 · 相关 description 收口单形态）
  - Modify: `packages/cdd-engine/src/documents/tokens.ts`（删 `taskGroupsHeading`/`taskGroupsHeadingRe`/`taskGroupsLineRe`/`taskGroupsMinItems` + derive 块 + 字符面守卫（tokens.ts:281-290）· Form B `proseAnchors` 派生叶 + `DOC_TOKENS` 接口字段）
  - Modify: `packages/cdd-engine/config/schema/plan.json`（重派生——P2 同机制 SchemaFactory 产物；`taskGroups`/Form-B 面零存在）
  - Modify: `scripts/validate/smoke-cdd.ts`（`deriveFixture` 改新数据形 fixture（Objective / Steps{action,checkable} / Acceptance + 边声明）· 删 taskBlock.do/验收 schema token 读）
  - Test: `documents/__tests__/schema.test.ts` · `tokens.test.ts` · `documents/doctypes/body/__tests__/plan-body.test.ts` 重 pin（plan-body 现断言 T4 将删的 taskGroups/Form-B schema 节点——deliberate update 登记；phase-spec-body/constraints-inheritance 已在 T3 随删随 pin）· 新形 fixture：`## Task Groups` 段在新文档 → validate fail（shape 面无 → unknown section）
  - Test Create: 删除集 grep 零命中断言（vitest 或 scripts 单测——engine src 含注释扫描）
- **Steps**:
  - [ ] 1. plan-body.ts 删 shape 节点 + description 收口（单形态：## Constraints 唯一约束面 · taskGroups 零存在）
  - [ ] 2. tokens.ts 删四 token + proseAnchors 派生叶 + 守卫；`DOC_TOKENS` 接口裁剪
  - [ ] 3. 重派生 `config/schema/plan.json`（P2 SchemaFactory 重派生机制）→ `pnpm --filter @oscaner-skills/cdd-engine build` 刷新 dist 镜像 → `cdd schema get plan` = 新形（taskGroups/FormB 零存在）
  - [ ] 4. schema.test / tokens.test / plan-body.test 重 pin 绿（deliberate update 登记）+ deriveDocTokens 两加载序回归（tokens 先 / registry 先）
  - [ ] 5. smoke-cdd `deriveFixture` 新数据形改造 + 消费者链绿（`node scripts/run.ts smoke-cdd`）
  - [ ] 6. `## Task Groups` 新文档 BLOCK fixture + 断言；删除集**并集 grep 零命中**断言（T3+T4 全符号集）
  - [ ] 7. 提交（`refactor(engine): shape/token 单形态重基——plan.json 新 golden · smoke-cdd 新数据形`）
- **Acceptance**:
  - `config/schema/plan.json` taskGroups / Form-B 面零存在（grep + schema get 实证）；DOC_TOKENS 四 taskGroups token + proseAnchors 零存在
  - smoke-cdd consumer 链绿（新数据形 fixture 派生）；dist 镜像更新（本地 `schema get` 显示新形）
  - **删除集并集 grep 零命中（engine src 含注释）**：`PLAN_FORM_B_ANCHOR_TOKENS` · `formBAnchorHeadingRe` · `formBAnchorSlices` · `formBProseAnchors` · `taskGroupsFromPlan` · `taskGroupsHeading` · `taskGroupsHeadingRe` · `taskGroupsLineRe` · `taskGroupsMinItems` · `parseTaskBlock` Do 面 · `extractProseConstraints` · 六段 legacy 豁免路径 · `## Section 1` 读
  - `## Task Groups` 新文档 BLOCK；加载序两序回归绿

### Task 5: 全树迁移 A —— 20 六段 design → 三真骨架（内容保真）

- **Objective**: 20 份六段 spec 转录至规范形（`## Design` + 唯一 `### Acceptance criteria` + `## Constraints` + 条件段），验收原文/约束原文逐字；per-doc 单形态 validate 绿
- **Consumes**: T3/T4 单形态 engine（spec 三真骨架唯一断言）；T3 建置的 `tree-migration.test.ts` 骨架
- **Produces**: 20 份三真骨架 spec（canonical 绿）；tree-migration spec 家族断言（扩展）；pending-migration 集首度收窄（20 spec 断面翻绿）
- **Files**（迁移对象，Plan Sole Writer 全量编辑）:
  - `docs/kairos/specs/2026-09-13-osuperpowers-overhaul-p{1..6}-design.md`
  - `docs/kairos/specs/2026-09-21-consumer-parity-p{1,2,3,4.1,4.2,4.3,4.4}-design.md`
  - `docs/kairos/specs/2026-09-27-pi-harness-p{1,2,3,4,5}-design.md`
  - `docs/kairos/specs/2026-10-02-doc-architecture-v2-p{1,2}-design.md`
  - Test Modify: `documents/doctypes/__tests__/tree-migration.test.ts`（T3 建置 → 扩展 spec 家族断言）
- **Steps**:
  - [ ] 1. tree-migration.test.ts 增 spec 家族断言：每迁移 spec 含 `## Design` + 唯一 `### Acceptance criteria` + `## Constraints`；验收/测试段落原文 token 逐字 § `### Acceptance criteria` 条目（机 pin）；单形态 docContractValidate 绿
  - [ ] 2. 转录 20 份（六段映射：设计正文 → `## Design`；验收/测试段 → `### Acceptance criteria`（原文逐字）；`## Section 1: Constraints pointer` → `## Constraints`（引用/指针原文逐字换壳）；条件写面识别——deviations/incremental/downstream 按条件落/不落；header 五元保持 + `**Version**` 行保留；每份转录独立提交）
  - [ ] 3. 树套件家族断面翻绿（20 spec = canonical 绿；pending-migration 集同步收窄）
  - [ ] 4. 提交（`docs(kairos): p3 树迁移 A — 20 六段 specs → 三真骨架（内容保真转录）`）
- **Acceptance**:
  - 20 spec 全单形态 validate 绿（tree-migration spec 家族断言全过）
  - 验收/约束原文逐字机 pin（token 保真断言）；任务编号不适用（spec 无任务）

### Task 6: 全树迁移 B —— 17 Do 形 plan → 数据形（验收逐字 pin · Task Groups → 边）

- **Objective**: 17 份 Do 形 plan（含 4 份带 `## Task Groups`）转录至数据形（Objective/Files/Interface/Steps{checkable}/Acceptance + 边声明）；验收原文逐字
- **Consumes**: T1/T2 边模型（`- **DependsOn**:`/`- **AtomicWith**:` 数据字段已读）；T3/T4 单形态 engine；T3 建置 `tree-migration.test.ts` 骨架（plan-Do 家族扩展标的）
- **Produces**: 17 份数据形 plan（canonical 绿）；tree-migration plan-Do 家族断言；`## Task Groups` 段零存在达成（行锚定标题匹配）；pending-migration 集再收窄；组语义边转译（4 份组等势断言）
- **Files**（迁移对象）:
  - Do 形无 Task Groups: `osuperpowers-overhaul-p{5,6}.md` · `consumer-parity-p{1,2,3,4.1,4.3}.md` · `pi-harness-p{1,2,3}.md` · `cdd-review-contract-fix.md`(plans/) · `doc-architecture-v2-p{1,2}.md`
  - 带 Task Groups（4）: `consumer-parity-p{4.2,4.4}.md` · `pi-harness-p{4,5}.md`
  - Test Modify: `tree-migration.test.ts`（T3 建置 → 增 plan-Do 家族断言）
- **Steps**:
  - [ ] 1. tree-migration.test.ts 增 plan-Do 家族断言：每迁移 plan——任务编号 `1..N` 连续逐字 · 验收原文 token 逐字 `acceptance[]` · 约束原文逐字 · 单形态 docContractValidate 绿 · 边声明转译后的图派生组与原文 `## Task Groups` 段落合并语义一致（4 份断言）
  - [ ] 2. 转录 17 份（Do 散文 → objective + steps{action,checkable} + interface{consumes,produces} + acceptance（验收逐字）+ 边声明（Task Groups 段 → atomicWith/dependsOn 语义转译 · 无段 → 委托依赖序判断）；`## Section 1/2` 段删（内容并入数据面）；Form B 散文锚 → `## Constraints` 子节（原文逐字换壳）——每份转录独立提交）
  - [ ] 3. 树套件 plan-Do 家族断面翻绿（pending-migration 集再收窄）
  - [ ] 4. 提交（`docs(kairos): p3 树迁移 B — 17 Do 形 plans → 数据形（验收逐字 pin · 组转译边）`）
- **Acceptance**:
  - 17 plan 全单形态 validate 绿；验收逐字 pin 断言全过 · 任务编号连续性断言全过
  - 4 份 Task Groups 段零存在——零命中断言 = **行锚定标题匹配** `^## Task Groups\s*$`（与 engine heading token 同族）· 扫描范围 = 迁移目标 plan 文档集合（本 p3-plan 等非迁移文档的 prose 内联引用豁免）——且组语义 = 边转译（tree-migration 断言组等势）

### Task 7: 全树迁移 C —— 4 散文期 plan（osuperpowers p1–p4 · Global Constraints 换壳 · acceptance 推导补全）

- **Objective**: 4 份散文期 plan（osuperpowers p1–p4）转录至数据形；`## Global Constraints` → `## Constraints`（原文逐字换壳）；无验收原文 → acceptance 推导补全（显式断言补全产物）
- **Consumes**: T3/T4 单形态 engine；T6 数据形先例；T3 建置 `tree-migration.test.ts` 骨架（散文期家族扩展标的）
- **Produces**: 4 份数据形 plan（canonical 绿）；tree-migration 散文期家族断言；pending-migration 集清零（全部迁移对象绿）；`## Global Constraints` 行锚定零存在达成
- **Files**:
  - `docs/kairos/plans/2026-09-13-osuperpowers-overhaul-p{1,2,3,4}.md`
  - Test Modify: `tree-migration.test.ts`（T3 建置 → 增散文期家族断言）
- **Steps**:
  - [ ] 1. tree-migration.test.ts 增散文期断言：每迁移 plan——`### Task N:` 连续 · `## Global Constraints` 零存在（`## Constraints` 换壳）· 约束原文逐字 · acceptance 补全产物断言（非逐字 pin：断言 acceptance[] 非空、覆盖该任务正文声明的可验证成果、无占位符）
  - [ ] 2. 转录 4 份（任务体 `**Files:**`/`**Interfaces:**` → files/interface{consumes,produces} · 正文任务描述 → objective + steps{action,checkable} · acceptance 按正文/文件面推导补全 · `## Global Constraints` → `## Constraints`（子节壳形，原文逐字）· 每份独立提交）
  - [ ] 3. 树套件散文期家族翻绿（pending-migration 集空——全部迁移对象绿）
  - [ ] 4. 提交（`docs(kairos): p3 树迁移 C — 4 散文期 plans → 数据形（Global Constraints 换壳 · acceptance 推导补全）`）
- **Acceptance**:
  - 4 plan 单形态 validate 绿；约束原文逐字（Global Constraints 换壳）· 任务编号连续 · acceptance 补全产物断言过
  - `## Global Constraints` 零命中 = 同 T6 断言定义（**行锚定标题匹配** `^## Global Constraints\s*$` · 扫描范围 = 迁移目标 plan 文档集合），迁移后零命中

### Task 8: 全树单形态收口（47 校验文件零排除绿 · one-off 容忍）

- **Objective**: walk set 48 文件（22 plan + 21 design + 4 overall + 1 one-off）中 47 校验文件（22 plan + 21 design + 4 overall）单形态 validate 全绿（zero exclusion 作用于校验文件）——one-off 容忍关断、不参与绿/红断言——树套件全断面绿，红窗口闭合
- **Consumes**: T5–T7 迁移产物（41 个迁移对象——20 spec + 21 plan——全部 canonical）；T3 建置 `tree-migration.test.ts` 骨架（转全绿终态标的）
- **Produces**: 全树单形态全绿终态（47 校验文件零排除 + one-off 容忍）· 树套件终态断言（pending-migration 断面清零）· 红窗口闭合
- **Files**:
  - Modify: `documents/doctypes/__tests__/tree-migration.test.ts` / 单形态树套件（迁移队列期望态 → 全绿终态）
- **Steps**:
  - [ ] 1. 树套件终态断言：47 校验文件（22 plan + 21 design + 4 overall，plans/ 含本 p3-plan）单形态 docContractValidate 绿零排除 + one-off（specs/2026-09-28-cdd-review-contract-fix.md）容忍关断（不参与绿/红断言）——pending-migration 断面清零
  - [ ] 2. 运行全绿（引擎 suite 全量 + 树套件全绿）
  - [ ] 3. 提交（`test(engine): 全树单形态 47 校验文件零排除绿（one-off 容忍 · 迁移队列闭合）`）
- **Acceptance**:
  - 树套件全绿（47 校验文件零排除 + one-off 容忍）；`pnpm --filter @oscaner-skills/cdd-engine test` 全量绿

### Task 9: 消费面同步 + 终验 + changesets

- **Objective**: cdd-plan SKILL 撰作面改（Task Groups → 边声明指导）· skill-anatomy · emit fresh · 全量 validate · changesets
- **Consumes**: T1–T8 全部产物（engine 单形态 + 树全绿基线）；`.changeset/README.md`（changeset 判定前置读）
- **Produces**: cdd-plan SKILL 边声明撰作面（英文零程序历史）· skill-anatomy 更新 · `pnpm run emit` 再生成产物 · changeset 文件（cdd-engine + kairos 两包）· `pnpm run validate` / typecheck / biome 全绿证据
- **Files**:
  - Modify: `packages/kairos/skills/cdd-plan/SKILL.md`（`## Task Groups` 段撰作指导 → 边声明数据字段指导（`- **DependsOn**:`/`- **AtomicWith**:` · rank 前向纪律 · 全单例默认）——English-primary · 零程序历史）
  - Modify: `packages/cdd-engine/config/schema/skill-anatomy.json`（视面，`ContractLexiconGuard#checkAnatomy` 绿）
  - Modify: `docs/maintainers/01-template-doctrine.md`（doc 结构面随行：单形态 + 边模型 + 迁移队列）
  - Test: scripts 单测（charter guard 全绿）· `pnpm run emit` / `emit:check` fresh
- **Steps**:
  - [ ] 1. cdd-plan SKILL.md 撰作面改（英文 · 消费者文本零程序历史——Task Groups 撰作段替换为边声明指导；不叙述迁移历史）
  - [ ] 2. skill-anatomy 校验绿（如涉 section-heading registry）；`pnpm run emit` 重生成 + `emit:check` fresh
  - [ ] 3. 终验：`pnpm run validate` 全块 ALL PASS（emit 新鲜 / kairos 插件解析 / cdd-engine 引擎套件 / 零残留 residue + channel / marketplace / scripts / 版本同步）· `pnpm run typecheck` 绿（根级三 tsc 项目：packages/cdd-engine / scripts / packages/kairos/tests——cdd-engine 无独立 typecheck script，typecheck 归根脚本，与 acceptance「typecheck 三项目绿」一致）· biome clean
  - [ ] 4. changesets（先读 `.changeset/README.md` 判定）：`@oscaner-skills/cdd-engine`（TaskGraph + 单形态退役 + 树迁移守卫）+ `kairos`（SKILL 文案视面）
  - [ ] 5. 提交（`feat(engine)/docs(kairos): P3 消费面 + 终验 + changesets`）
- **Acceptance**:
  - cdd-plan SKILL 撰写面 = 边声明指导（英文零程序历史）；skill-anatomy 绿 · emit fresh
  - `pnpm run validate` ALL PASS · typecheck 三项目绿 · biome clean · residue/lexicon guard 连续
  - changesets 已建（cdd-engine + kairos 视面）
