# Doc Architecture v2 P3 Design（TaskGraph 分组派生 + 文档形态单一化）

- **Version**: v1.0 · 2026-10-05
- **Status**: Draft
- **Author**: [human] · Claude Opus 5 (1M context)（kairos:cdd-design → grilling → cdd-phase）
- **Parent program**: [2026-10-02-doc-architecture-v2-overall.md v1.6](docs/kairos/specs/2026-10-02-doc-architecture-v2-overall.md)
- **Depends on**: P1（shipped · [p1-design v1.1](docs/kairos/specs/2026-10-02-doc-architecture-v2-p1-design.md)）

## Design

**1. TaskGraph 边模型（组 = 原子闭包分量）**。P2 已留 `dependsOn?`/`atomicWith?` 声明面（`body/task.ts` 字段 + plan.json tasks items，零读写零消费）；本 phase 激活为读/写面，并落地唯一分组派生：

- 新类 `TaskGraph`（`documents/doctypes/body/task-graph.ts`，类 + 构造注入，Criterion ② 零裸函数；构造注入 `Task[]`）：
  - `validate(): GraphVerdict | null` —— crisp BLOCK 五类，零容错：① `dependsOn`/`atomicWith` 引用不存在的 task id（越界）② 自引用（T→T）③ 矛盾边（同对 (a,b) 同时 atomicWith 且 dependsOn；同一原子闭包分量内出现 dependsOn）④ 环（atomic 收缩后的分量 DAG 有向环）⑤ 重复声明（同 id 在同一字段重复）
  - `groups(): TaskGroup[]` —— atomicWith 无向单侧声明（T1 列 T2 即可，不要求双方认账）→ 对称 + 传递闭包 → 连通分量 = 组（复用 `TaskGroup` 类）；分量 DAG 拓扑序 = 组执行序；无边 plan → 全单例组 `[[1],[2],…,[N]]`（拓扑序对无边 DAG 即序号序——与既有 per-task dispatch 逐位一致，零迁移底线态保留）
- 接入：`effectiveGroups(planPath)`（dispatch/base·task·closeout·status 四处唯一消费点）派生源自字面 `taskGroupsFromPlan` 切换为 `TaskGraph.groups()`——消费者零改；「先清底再上闸」= 图性质：每条边 `rank(源) < rank(目标)` 断言（属性测试钉）
- 新形 plan 边声明格式：任务记录数据字段 `- **DependsOn**: 3, 5` / `- **AtomicWith**: 4, 5`（接 `- **Acceptance**:` 之后；slice patterns `dependsOn`/`atomicWith` 入 `PLAN_SLICE_PATTERNS`，`parseTaskBlock` 读取；schema items `minimum: 1` 既有）

**2. 双读面全量退役（engine 文档形态单一化）**。legacy 读面是纯兼容死壳（仅服务旧树绿）；全删，新文档带 legacy 面 = BLOCK。硬删除清单（机 pin `grep` 零命中含注释）：

| 面 | 删除符号 | 位置 |
|---|---|---|
| Form B 锚 | `PLAN_FORM_B_ANCHOR_TOKENS` · `formBAnchorHeadingRe` · `formBAnchorSlices()` · schema `constraints.formBProseAnchors` 节点 | `body/plan-body.ts` |
| 约束双读 | `extractProseConstraints`（legacy Form B / `## Section 1: Constraints pointer` 读路径）→ 约束单一来源 = Form A `## Constraints` | `body/constraints.ts` |
| 字面段 | `taskGroupsFromPlan` · `PlanParse.taskGroups` · schema `taskGroups` 节点（`$defs.section` / `items` / `default`）· `doctype.ts` taskGroups accessor 注释 | `doctypes/plan.ts` · `body/plan-body.ts` · `doctype.ts` |
| token 面 | `taskGroupsHeading` / `taskGroupsHeadingRe` / `taskGroupsLineRe` / `taskGroupsMinItems`（+ derive 块）· Form B `proseAnchors` 派生叶 | `documents/tokens.ts` |
| 六段 spec | legacy acceptance 豁免路径（no `## Design` → P1 acceptance path）· `## Constraints` legacy no-op · spec `## Section 1: Constraints pointer` 读 | `doctypes/phase-spec.ts` · `body/constraints.ts` |
| 任务解析 | Do 面 `parseTaskBlock`（`- **Do**:` 散文载体）→ 删；新任务块零数据字段 = validate FAIL（orphan block，非静默容忍） | `doctypes/plan.ts` |
| 产物 schema | `config/schema/plan.json`（emit 重派生）taskGroups / Form B 面零存在 | `config/schema/` |
| 消费面 | `smoke-cdd.ts` `deriveFixture` 改派生新数据形（Objective / Steps{action,checkable} / Acceptance + 边声明）· `taskBlock.do`/`验收` schema token 读删 | `scripts/validate/smoke-cdd.ts` |
| fixtures | `legacy-six-section-spec-design.md` · `form-b-plan.md` 删除；`dual-read.test.ts:264` 全树零回归测试重基为单形态树测试 | `doctypes/__tests__/` |

- 单形态 BLOCK 面：新文档出现任务块 `- **Do**:`、Form B 锚、`## Task Groups` 段、spec `## Section 1` → `docContractValidate` fail（unknown/decomissioned surface，非忽略）——代码注释、检索行为、消费者简况共面

**3. 全树形迁移（41 文档，内容保真转录）**。现存树 = 20 design（六段）+ 21 plan（Do 形），0 新形（P2「首个真实采用 = P3 起文档」）；本 phase 将全树转录至规范形（Y 裁决：零历史兼容、一次落地、验证无死角）：

- spec（20）：六段 → 三真骨架映射——设计正文 → `## Design`；验收/测试段落 → `### Acceptance criteria`；`## Section 1: Constraints pointer` → `## Constraints`（Form A 化）；条件书写面识别（deviations / incremental warning / notes for downstream 按条件落/不落）
- plan（21）：header 五元保留（已兼容）；`## Constraints` 子节（口径等）Form A 保持（子节标记 `###` + `-` 条目）；任务块 Do 散文 → objective + steps{action,checkable} + acceptance + interface{consumes,produces}（谓语/文件面推导，见 Constraints 迁移边界）；`## Section 1/2` 散文段删除（内容并入任务数据面）；`## Task Groups` 段 → 边声明转译
- **保真铁律**：任务编号 `1..N` 连续逐字；`acceptance` 原文逐字入 `acceptance[]`；约束原文逐字——三者机器 pin（tree-migration 测试逐文档断言：任务数 / 编号连续性 / 验收 token 保真 / 约束保真 + 单形态 docContractValidate 绿零排除）
- 验收态 = 全树新形单形态 validate 全绿（zero exclusions）——`dual-read.test.ts:264` 重基为新基线

**4. 派生产物与下游契约（P5）**。派生组 runtime-only，零写回（不引入新双写面）；P5 graph-node ref（R5）消费本 phase 图模型形状——组件 id（原子闭包分量）/ 派生组序 / 边集即 P5 DispatchContract 的 graph-node 数据面（本 phase 只产出模型与派生，不实施 P5 消费）。

### Acceptance criteria

- `engine vitest colocated 绿（body/__tests__/task-graph.test.ts + plan-body.test.ts）：原子闭包对称/传递/连通分量 = 组；无边 plan → 全单例 [[1]..[N]]；拓扑序组序断言（rank(源)<rank(目标) 属性钉——「先清底再上闸」图性质）；五负例 crisp BLOCK 全绿（越界 / 自引 / 矛盾边 / 环 / 重复）`
- `硬删除 grep 零命中（engine src 含注释）：PLAN_FORM_B_ANCHOR_TOKENS / formBAnchor· / formBProseAnchors / taskGroupsFromPlan / DOC_TOKENS.taskGroups· / parseTaskBlock Do 面 / extractProseConstraints / 六段 legacy 豁免路径 / ## Section 1 读`
- `新文档带 legacy 面 = validate BLOCK（docContractValidate fail）：任务块 `- **Do**:`（零数据字段） / Form B 锚 / `## Task Groups` 段 / spec `## Section 1` —— 各 fixture 断言`
- `effectiveGroups 派生源切换实证：dispatch/base·task·closeout·status 消费零改（TaskGroup 类复用，仅派生源变）；无边 plan 组序 = 序号序（既有 dispatch/__tests__/runner.test.ts 绿）`
- `smoke-cdd consumer 链绿：deriveFixture 生成新数据形 fixture（Objective / Steps{action,checkable} / Acceptance / 边声明），五命令 dry-run 状态胶囊断言全绿（CI）`
- `全树 41 文档单形态 validate 全绿（zero exclusion）：tree-migration.test.ts 逐文档断言任务数 1..N 连续逐字 / 验收原文 token 逐字入 acceptance[] / 约束原文逐字；dual-read.test.ts 重基收口（45 文档树新基线）`
- `config/schema/plan.json 新 golden（taskGroups / Form B 面零存在）· schema.test / tokens.test 重 pin 绿 · deriveDocTokens 派生链绿（tokens 先 / registry 先两加载序回归）`
- `cdd-plan SKILL.md 撰作面改：`## Task Groups` 段撰作指导 → 边声明数据字段指导（`- **DependsOn**:` / `- **AtomicWith**:`）· skill-anatomy registry 校验绿 · `pnpm run emit` / `emit:check` fresh`
- `pnpm run validate ALL PASS · typecheck ×3 绿 · biome clean · residue/lexicon guard 连续`
- `changesets 已建：cdd-engine（TaskGraph + 单形态退役 + 树迁移守卫，版本面按 .changeset/README 判定）+ kairos（SKILL 文案视面）`

## Constraints

- 迁移语义判断边界：objective / steps / interface{consumes,produces} 的补全允许按正文与文件面推导（Plan Sole Writer 语义判断）；**任务编号与 acceptance 原文零改动（机 pin）**——两者是迁移保真锚，任何推导均不得触碰
- 边声明转译源：`## Task Groups` 段 `- **Task a, b**: <note>` 合并语义 → `atomicWith`；跨任务依赖序（consumes/produces 重叠或执行序明示）→ `dependsOn`；转译为 Plan Sole Writer 迁移时判定，非机械映射（语义而非字面）
- smoke-cdd / consumer 链随形态单一化同步更新（deriveFixture 新数据形）——严禁把 legacy taskBlock 读面作为迁移期拐杖保留

## Deviations

| Overall assumption | Phase decision | Overall updated? |
|---|---|---|
| P2 双读契约：legacy 六段 / Form B validate + parse 双接受保持、既有文档树零改动（P2 plan 口径） | engine 文档形态单一化——双读面全量退役，旧文档全树形迁移（内容保真转录） | Yes — v1.6 · 2026-10-05 |
| Non-goal #2：旧文档渐进迁移 / 新老交割（P3/P2 定义读写面） | 全量形迁移一次落地（P3 内完成 41 文档，验证零死角） | Yes — v1.6 · 2026-10-05 |

## Notes for downstream

- P5：graph-node ref（R5）消费本 phase 图模型形状——组件（原子闭包分量）id / 派生组序 / 边集即 P5 DispatchContract 的 graph-node 数据面；P3 输出的 `TaskGraph` 类与派生产物为 P5 引用契约（本 phase 不实施 P5 消费面）