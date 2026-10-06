# 文档架构方法论 v2 —— P3.1 实施计划

**Spec:** [2026-10-02-doc-architecture-v2-p3.1-design.md](docs/kairos/specs/2026-10-02-doc-architecture-v2-p3.1-design.md)

- **Parent program**: [doc-architecture-v2-overall.md v1.9](docs/kairos/specs/2026-10-02-doc-architecture-v2-overall.md)
- **Version**: v1.4 · 2026-10-06
- **Depends on**: P3（shipped · [p3-design v1.1](docs/kairos/specs/2026-10-02-doc-architecture-v2-p3-design.md)）
- **Base**: develop

## Constraints

- 每任务保持树全绿：规则迁移、其对应文档迁移、pin 更新三件同任务落地（中间态零红——引擎 `missing-edge`/designItems/charter 规则一经挂上即执法，全树必须已 conformant 或同任务迁完）
- 本 P3.1 plan 自证新政：所有任务块单边 `- **DependsOn**:` 行已在位（真实依赖或 `none`）；P3.1 design 已是 `####` 秩——全树迁移任务（T3/T4/T5）的存量面不含本家族文档，但 tree-migration pin 覆盖之
- 引擎规则一律经 body 叶规则数据 + `rules/structure.ts` 单解释器；手写文本遍历零新增（spec 约束「统一引擎边界」继承适用，graph 科学留 TaskGraph、跨文档链留 P5）
- 风险钉（全树绿 · 负例单轴 · 词法边界 · 伪标题无误伤 · lint 噪音）归任务：
  - 规则引擎挂载后存量树未迁移即红——T3/T4/T5 各自「规则 + 全树迁移 + pin」同任务落地（首条），T8 终验断言全树绿
  - 负例夹具单轴失败语义——`orphan-task-block-plan` / `form-b-anchor-plan` / `section-1-spec-design.md` 仅 legacy/孤块轴失败；T3/T4 补 conformant 面保持单轴
  - `none`/空与 integer gate 边界——`none`/空 → `[]`；`abc`、`1;2` 等非法 token 保持 NaN 拒绝，绝不静默吞；T3 负例集
  - 伪标题 pattern 误伤面——独立 bold 行唯一定义；行内 lead-in bold / code span 不误判；T4 对 2 份零独立文件（cp-p4.1 / doc-arch-p3）断言零命中
  - 引用 lint 噪音面——`files`/`steps`/code span 不计；越界 N 豁免；已声明边不重复告警；每块至多一条聚合 WARN；T6 负例集
  - 反依赖门误伤面——编号单调断言只拦 `DependsOn` 引用 ≥ 自身；`none`/空/越界（> taskCount）不触发反依赖；T3 负例集
- 死代码/空壳全平面清理（P3.1 补充条例 2026-10-06 用户）：各迁移/引擎任务先删后验——退役符号/废弃夹具/空壳叶零残留；存量 plan 未解析 steps 面（`- [ ]` 散文行）在 T3 一并规范化 `N. … — checkable:`（每步含 checkable）
- **编排状态机一体重建（spec v1.4 · 用户 2026-10-06 拍板）**：边模型单边化（`DependsOn` 唯一 · `AtomicWith`/`taskGroups` 退役）+ 反依赖门 + TaskGraph `batches()`/`frontier(done)` 两面 + `next:` 组间推荐 + skills 编排精简一体落地本 phase（group-next 从 P5 摘回）；同行变更经 overall v1.12 / spec v1.4 登记

---

### Task 1: StructureRule 引擎核心（解释器 + 接线缝）

- **Objective**: 建立 `rules/structure.ts` 单解释器（StructureRule 类型 + 七不变式 + `runStructureRules`）+ DocBody 规则数据缝 + docContractValidate 挂钩——本任务零行为变化（规则集为空时与现状等价），为全部结构判定迁移提供唯一通道
- **Consumes**: `DocBody` / `SlicePatternSet`（doc-body.ts）· `DocType`（doctype.ts）· `docTypeRegistry`（registry.ts）
- **Produces**: `StructureRule` / `StructurePlane` / `StructureInvariant` / `StructureFinding` / `runStructureRules(content, rules): StructureFinding[]`——T2–T6 规则集与 T8 终验依赖此签名
- **DependsOn**: none
- **Files**:
  - Create: `packages/cdd-engine/src/rules/structure.ts`
  - Modify: `packages/cdd-engine/src/documents/doctypes/body/doc-body.ts`（DocBody 增 `structureRules(): StructureRule[]`，默认 `[]`）
  - Modify: `packages/cdd-engine/src/rules/documents.ts`（`structureFindings(kind, content)` 公开 + docContractValidate 每 doc type 调一次 `runStructureRules`）
  - Test: `packages/cdd-engine/src/rules/__tests__/structure.test.ts`
- **Steps**:
  - 1. 实现 `rules/structure.ts` 类型与解释器——`StructureRule{id, plane:{kind:"headingLeads"|"tableRows"|"records", anchor}, invariants[], severity:"BLOCK"|"WARN", message}` · 七不变式类型化实例 · `runStructureRules` 单遍扫描 —— checkable: 解释器对三锚型 + presence/unique/domain/crosslink/order/continuity/residue 各至少一个可判定实例；`StructureFinding{id,severity,message}` 的 message 为固定文案（零外部拼接）
  - 2. DocBody 规则数据缝——checkable: `DocBody` 增 `structureRules(): StructureRule[]`（默认 `[]`）；plan-body / phase-spec-body 两既有 body 暂不覆写（T2 落地）
  - 3. docContractValidate 挂钩——checkable: `DocumentsValidator` 增 `structureFindings(docKind, content): StructureFinding[]`；docContractValidate 对 resolved doc type 调 `runStructureRules(content, type.body.structureRules())`；空规则集时零新增 finding（50 文件树套件 validate 结果与迁移前逐字节相同——tree-migration/dual-read 套件保持全绿）
  - 4. 单元测试 `structure.test.ts`——checkable: 每不变式因子（presence 缺失命中 / unique 双现 / domain 非法值 / crosslink 悬空锚 / order 逆序 / continuity 断号 / residue 禁面命中）至少一正一负；severity 映射 BLOCK/WARN；engine suite 该文件全绿
  - 5. 提交——checkable: `git commit` conventional（engine 域改动），pre-commit 钩子通过
- **Acceptance**:
  - `- ` `runStructureRules` 契约可用：三锚型 + 七不变式全部可判（structure.test.ts 断言）
  - `- ` 空规则集零行为变化：docContractValidate 结果与 T0 基线一致，tree-migration 与 dual-read 套件保持绿
  - `- ` body 缝就位且 load-order 安全：bodies 零解释器反向 import（grep 断言 `structure.ts` 不被 bodies 引用）

### Task 2: 既有结构判定规则化（checks/walks 归零）

- **Objective**: 把现存三手写判定面（`#skeletonFailures` · overall 四表审计 ①–⑥ · plan 契约文本断言）迁移为规则集数据，`tree-migration`/`dual-read` 全树行走重构为消费同一引擎——行为等价、树全绿，手写遍历面归零（Criterion ②）
- **Consumes**: T1 的 `runStructureRules` / `StructureRule` / DocBody 缝
- **Produces**: 三类型 `structureRules()` 全量规则集（行为等价于 T0 手写面）· `DocumentsValidator.structureFindings` 成为树套件唯一判定入口——T3–T6 的新规则（边完备/designItems/charter/引用 lint）以其为挂载点
- **DependsOn**: 1
- **Files**:
  - Create: `packages/cdd-engine/src/documents/doctypes/body/overall-body.ts`（OVERALL_SHAPE 归位 + slices + 四表规则）
  - Modify: `packages/cdd-engine/src/documents/doctypes/phase-spec.ts`（`#skeletonFailures` → body 规则）
  - Modify: `packages/cdd-engine/src/documents/doctypes/body/phase-spec-body.ts`（`structureRules()` 覆写：三真骨架 + deviations 行锚 Yes = `#skeletonFailures` 现行为）
  - Modify: `packages/cdd-engine/src/documents/doctypes/body/plan-body.ts`（`structureRules()` 覆写：task continuity / record presence / constraints source / legacy residue）
  - Modify: `packages/cdd-engine/src/documents/doctypes/overall.ts`（四表审计手写遍历 → overall-body 规则）· `packages/cdd-engine/src/documents/doctypes/shapes/overall.ts`（退役）· `packages/cdd-engine/src/documents/doctypes/tokens.ts`（OVERALL_SHAPE import 重指）
  - Modify: `packages/cdd-engine/src/documents/doctypes/__tests__/tree-migration.test.ts` + `__tests__/dual-read.test.ts`（全树行走改跑 `structureFindings`，内容保真 pin 保留）
  - Test: `packages/cdd-engine/src/documents/doctypes/body/__tests__/phase-spec-body.test.ts`（规则化后行为保持）
- **Steps**:
  - 1. spec 骨架规则化——checkable: `#skeletonFailures` 五个断言（Design 在 / Acceptance 唯一二重 / Constraints 在 / Deviations 行锚 Yes）转 phase-spec-body `structureRules()`；对现行 21 份 `-design.md` 运行结果与 T0 `#skeletonFailures` 输出逐条等价（树套件 delta 零）
  - 2. overall-body 落地 + 四表审计规则化——checkable: `overall-body.ts` 承载 OVERALL_SHAPE（schema 派生字节不变，diff pin 绿）+ slices + 四表规则（kernel / ①–⑥）；`overall.ts` 手写遍历删除（grep 旧符号零残留）；`tokens.ts` 重指后 DOC_TOKENS 派生结果字节不变
  - 3. plan 契约规则化——checkable: `validatePlanContract` 文本断言面（task headings 连续性 / Constraints source / placeholders / 数据形 task records + checkable / 未知顶层 `##` 节）转 plan-body `structureRules()` 四项（task continuity / record presence / constraints source / legacy residue，与 Files 列表逐项对应）；行为等价——Class-A `**Spec:**` 不属文本断言面：`#resolveSpecOf`（plan→spec→overall Phase inventory，需 ctx.root）为跨文档链，留 validate/builders 不动（P5 边界）
  - 4. 树套件重构消费同一引擎——checkable: `tree-migration` / `dual-read` 的 50 文件树套件行走（23 plans + 22 design specs + 4 overalls + 1 one-off）改调 `structureFindings`（命中集断言 = 0 或 pin）；内容保真逐字 pin 保留为 pin；迁移队列闭合断言照旧；tree-migration + dual-read 绿
  - 5. engine suite 全量回归——checkable: `pnpm --filter @oscaner-skills/cdd-engine test` 全绿（行为等价零漂移）
  - 6. 提交——checkable: 提交（engine 域），pre-commit 通过
- **Acceptance**:
  - `- ` 三手写遍历面零残留：`#skeletonFailures` / overall 四表手写 walker / plan 契约断言符号 grep 零命中（旧方法/旧路径不存活）
  - `- ` 行为等价：树套件迁移前 delta 零；engine suite 全绿
  - `- ` 树套件 50 文件行走（23 plans + 22 design specs + 4 overalls + 1 one-off）唯一入口 = `structureFindings`（grep 断言行走不再自写循环）

### Task 3: plan 边完备（missing-edge 第六类 + 全树 plans 边行迁移）

- **Objective**: TaskGraph 静态面重建（边模型单边化 + validate 重建 + 波次推导 + 全树 plans 单边化迁移）——`- **AtomicWith**:`/`taskGroups` 声明面退役（死壳即删：读取面/对称闭包/矛盾边检查/schema 字段/夹具/pins/SKILL 双边描述零残留）· `- **DependsOn**:` 唯一有向边（`none`/空/真实值 · 缺行 = 第六 failure class missing-edge BLOCK）· **反依赖门**（仅可引用更小编号 · 引用 ≥ 自身 = BLOCK——编号序 = 拓扑线性化锚）· `batches()` 波次推导（编号升序就绪层）· `effectiveGroups` 切波次消费 + 全树 22 份存量 plans 单边化迁移 + tree-migration pin——分组 = 波次（分 groups 初衷 = 减 implement 轮次），声明分组退役；补充条例面：存量 plans 未解析 steps 面（`- [ ]` 散文行 → `N. … — checkable:`）一并规范化（死壳清理）
- **Consumes**: T1 引擎 + T2 plan 规则集
- **Produces**: `validate()` 重建（crisp 集 + missing-edge + 反依赖门）· `batches()` 波次推导 · `effectiveGroups` 波次消费 · 全树单边化状态（`AtomicWith` 全树零残留 grep）——T6 引用 lint 与 T7 frontier/next 路由器依赖
- **DependsOn**: 2
- **Files**:
  - Modify: `packages/cdd-engine/src/documents/doctypes/body/task-graph.ts`（`validate` 重建：P3 crisp 集 + missing-edge + 反依赖门；`batches(): TaskBatch[]` 波次；atomicWith 读取面/对称传递闭包/矛盾边检查删除）
  - Modify: `packages/cdd-engine/src/documents/doctypes/plan.ts`（`parseTaskBlock` 单边扫描 `DependsOn` · `none`/空 → `[]` · integer gate 保留 · missingEdge 记录）
  - Modify: `packages/cdd-engine/src/documents/doctypes/body/task.ts`（`TaskOpts.dependsOn` 非可选缺省 `[]` · `atomicWith` 字段删除）
  - Modify: `packages/cdd-engine/src/documents/doctypes/body/plan-body.ts`（PLAN_BODY_SHAPE task `required` += `dependsOn` · description 更新 · `structureRules()` += 边完备 + 反依赖规则）
  - Modify: `packages/cdd-engine/config/schema/plan.json`（SchemaFactory 派生产物字节保真更新——单边面，非手写）
  - Modify: `packages/cdd-engine/src/dispatch/base.ts` + `dispatch/task.ts` + `rules/closeout.ts` + `rules/status.ts`（`effectiveGroups` 改消费 `batches()` 波次 · taskGroups record 退役）
  - Modify: `packages/cdd-engine/src/documents/doctypes/__tests__/tree-migration.test.ts`（pin：每块单边行 + 波次拆分断言）· `__tests__/dual-read.test.ts`（50 文件行走单边边行面）
  - Modify: `packages/cdd-engine/src/documents/doctypes/body/__tests__/task.test.ts`（absent-default pin 退役）· `body/__tests__/plan-body.test.ts`（单边词法 + 反依赖用例）· `body/__tests__/task-graph.test.ts`（validate 重建 + batches）
  - Modify: `body/__tests__/fixtures/` + `dispatch/__tests__/fixtures/`（原子分量类夹具按波次核对）+ 新增 `forward-edge-plan` 负例夹具
  - 迁移: `docs/kairos/plans/*.md`（22 份存量，214 块——`AtomicWith` 行全树删除 · `DependsOn` 单行保留/补全）
- **Steps**:
  - 1. 单边词法 + 缺行——checkable: `parseTaskBlock` 对每块扫描 `- **DependsOn**:` 单行；缺行 → `missingEdge` 记录（第六 failure class）；`none`/空 → `[]`；`1, 2` 走 Number 门；非法 token（`abc`/`1;2`）NaN 拒绝保持
  - 2. 反依赖门——checkable: `validate()` 断言每条边引用目标编号 < 源编号；新增负例夹具 `forward-edge-plan`（T5 依赖 T10）→ BLOCK；越界 N（> taskCount）/`none`/空不触发反依赖；P3.1 自身树核查零违规
  - 3. 波次推导 + effectiveGroups 切波次——checkable: `batches()` 对 P3.1 自身 DependsOn（T1→T2→{T3,T4,T5}→T6→T7→T8）产出 6 波次拆分断言；`effectiveGroups` 改调 `batches()`（taskGroups record 退役）；atomicWith 读取面/对称闭包/矛盾边检查删除（grep 零残留）
  - 4. 负例/正例测试 + dispatch pre-flight 负例——checkable: 缺边 → `missing-edge` BLOCK 负例；`none` → `[]`；空 → `[]`；非法 token NaN 拒绝；task.test.ts absent-default pin 退役；dry-run 负例（缺边 plan → `cdd implement`/`cdd review` pre-flight 经 docContractValidate BLOCK）
  - 5. 全树 22 plans 单边化迁移——checkable: `- **AtomicWith**:` 行全树删除（4 份真实值 plan——consumer-parity-p4.2 · consumer-parity-p4.4 · pi-harness-p4 · pi-harness-p5，共 23 行——的对称分量随波次推导天然同层覆盖）；`DependsOn` 单行保留/补全（真实值或 `none`）——214 块单边行齐备；全树反依赖核查零违规；同批次 steps 规范化（`N. … — checkable:` 每步含 checkable，零未解析行）
  - 6. 死壳清理 + tree-migration pin——checkable: atomicWith/taskGroups 读取面 · 对称闭包 · 矛盾边检查 · schema 字段 · 夹具 · pins · SKILL 双边描述 grep 零命中；每 plan 任务块单边行存在 + 各 plan 波次拆分 pin；tree-migration 套件全绿
  - 7. 提交——checkable: 提交（engine + 树），pre-commit 通过
- **Acceptance**:
  - `- ` 每 plan 任务块单边 `DependsOn` 行存在（`none`/空/真实值合法）；缺行 = plan validate BLOCK（missing-edge 第六类负例断言）
  - `- ` 反依赖门：引用目标 ≥ 源编号 = BLOCK（`forward-edge-plan` 负例）· 全树现有边零违规
  - `- ` `batches()` 波次拆分断言（P3.1 自身 6 波次）· `effectiveGroups` 切波次消费（taskGroups/atomicWith 声明面退役）· `AtomicWith` 全树零残留（grep 断言）
  - `- ` `Task.dependsOn` 非可选（缺省 `[]`）；`plan.json` 派生字节保真
  - `- ` dispatch pre-flight（`cdd implement`/`cdd review`）覆盖边完备（dry-run 负例）；engine suite + 树套件全绿
  - `- ` 存量 plans steps 面规范化：未解析步骤行零残留（每步 `N. … — checkable:` 全解析）· 补充条例死壳清理断言

### Task 4: designItems 结构面（spec 骨架 + 全树 specs 结构秩迁移）

- **Objective**: `####` 登记叶切片 + designItems 规则（计数/空体/hollow/伪标题残留 BLOCK）+ 全树 21 份 specs 中 19 份 171 处独立 bold 伪标题 → `####` 逐字（含 `§`）+ tree-migration 结构秩 pin——design body 从无登记叶平面变机器可见
- **Consumes**: T2 spec 骨架规则集 · `designItemHeading` 切片
- **Produces**: designItems 判定（计数/空体/hollow/伪标题残留）· 全树 0 伪标题全状态——T7 消费面（SKILL 撰作指导）依赖
- **DependsOn**: 2
- **Files**:
  - Modify: `packages/cdd-engine/src/documents/doctypes/body/phase-spec-body.ts`（SlicePatternSet += `designItemHeading: /^#### /m` · `structureRules()` += designItems 规则 · PHASE_SPEC_BODY_SHAPE description 更新）
  - Modify: `packages/cdd-engine/config/schema/phase-spec.json`（派生产物字节保真更新）
  - Modify: `packages/cdd-engine/src/documents/doctypes/__tests__/tree-migration.test.ts`（结构秩 pin）· `__tests__/dual-read.test.ts`
  - Modify: `packages/cdd-engine/src/documents/doctypes/body/__tests__/phase-spec-body.test.ts`（designItems 用例）· `__tests__/fixtures/`（spec fixtures 核查）
  - 迁移: `docs/kairos/specs/*-design.md`（19 份，171 处）
- **Steps**:
  - 1. 切片 + 规则——checkable: `designItemHeading: /^#### /m` 进 slices（与 `### Acceptance criteria`/`## Design` exact-anchor 零碰撞——既有唯一性断言保持）；designItems 规则 = 空体 BLOCK / hollow 叶 BLOCK / 独立 bold 行残留 BLOCK（严格 pattern 命中且 ∉ 显式豁免清单——2 条豁免散文流水逐行 pin、不迁移）/ 计数可枚举
  - 2. 伪标题 pattern 负例保护——checkable: 2 份零独立文件（cp-p4.1 / doc-arch-p3）在 pattern 下零命中（全 lead-in 合法）——pattern 无误伤断言；行内 lead-in bold / code span `**` 零误判
  - 3. 全树 19 份 specs 迁移——checkable: 迁移对象 = 严格 pattern 命中 173 中除 2 条豁免散文外的 171 处独立 bold（编号式 78 · § 式 87 · 其他式 6）→ `#### <原文本逐字>`（含 `§` 原文保留）；2 条豁免散文（osuperpowers-overhaul-p1 L113 核对清单断言「All Overall updated? = Yes before review.」 · osuperpowers-overhaul-p5 L88 删除面 bold-bookend）逐行 pin、不迁移；文件可混式逐字处理；2 份零独立文件不动
  - 4. fixtures 核查——checkable: 正例 spec fixtures（`new-shape-phase-spec-design` / `zero-residue-phase-spec-design`）在 rules 下零命中；负例夹具 `section-1-spec-design.md`（Constraints 第 3 条规范名）仅原失败轴（伪标题残留面若命中 → 回填 conformant 面保持单轴语义，不改原命中面）
  - 5. designItems 开枪负例 + pre-flight 可达范围——checkable: 新增负例夹具 `pseudo-heading-design.md`（一条独立 bold 行 → 伪标题残留 BLOCK）与 `hollow-item-design.md`（`####` 叶空体/hollow → 空体/hollow BLOCK），落 `packages/cdd-engine/src/documents/doctypes/body/__tests__/fixtures/`，经 docContractValidate 断言 BLOCK finding；dispatch pre-flight 可达范围显式注明：`cdd implement`/`cdd review` 解析 plan 型，spec/overall 型规则经 docContractValidate 各 doc type 挂载（T1 步骤3 已挂钩），其 firing 负例落于验证器/树套件层——spec 验收第 7 条「pre-flight 覆盖全部新规则」据此覆盖全规则，不缩水为仅 edges
  - 6. 结构秩 pin——checkable: 19 份文件 `####` 计数 + 标题逐字 pin；迁移后 pin = specs 面严格 pattern 命中且仅 2 条豁免散文（逐行 pin）· 全树（50 文件）= 且仅 3 条豁免（增 cdd-review-contract-fix L22 bold-bookend 流水），法外零残留；空体/hollow 零；tree-migration 套件全绿
  - 7. 提交——checkable: 提交，pre-commit 通过
- **Acceptance**:
  - `- ` design spec `####` items 计数 + 标题逐字 pin；空体/hollow 零；独立 bold 行伪标题零残留（pattern grep 命中 = 且仅 2 条豁免散文逐行 pin · 法外零残留）
  - `- ` pattern 无误伤：2 份零独立文件 + lead-in/code-span 负例零命中
  - `- ` `phase-spec.json` 派生字节保真；engine suite + 树套件全绿

### Task 5: overall charter 结构秩（OverallDocBody + 全树 4 overalls 迁移）

- **Objective**: charter facets 规则（Goal/Non-goals/Cross-cutting presence 恒在 · 决策留存/决策组「存在才执法」· 伪标题残留 BLOCK）+ 全树 4 份 overalls 既有 bold-flat 标记升秩（doc-arch 全量 10 标记 · 另三份仅三 facets）+ pin——program 级最后一个散文平面机器可见
- **Consumes**: T2 overall-body（shape/slices/四表规则）· T1 引擎
- **Produces**: charter facet 规则 + 全树 overalls 升秩状态——T7 消费面依赖
- **DependsOn**: 2
- **Files**:
  - Modify: `packages/cdd-engine/src/documents/doctypes/body/overall-body.ts`（`structureRules()` += charter facet 规则；`projectSlicePatterns()` += charter facet 切片）
  - Modify: `packages/cdd-engine/config/schema/overall.json`（派生产物字节保真更新——charter facet 域/描述）
  - Modify: `packages/cdd-engine/src/documents/doctypes/__tests__/tree-migration.test.ts`（charter pin）
  - Modify: `packages/cdd-engine/src/documents/doctypes/body/__tests__/fixtures/`（charter 负例夹具 `pseudo-heading-overall.md`）
  - 迁移: `docs/kairos/specs/*-overall.md`（4 份）
- **Steps**:
  - 1. charter 规则——checkable: facets presence 恒为不变式，锚名按家族参数化（doc-arch：`Goal`/`Non-goals`/`Cross-cutting`；pi-harness：`Goal`/`Non-goals`/`Cross-cutting`（行尾后缀注解原文保留）；consumer-parity：`Goal`/`Non-goals`/`Cross-cutting constraints`；osuperpowers-overhaul：goal 锚 = charter 开篇散文 +「cdd-engine 服务化主线（2026-09-13 用户升维）」标记、`Non-goals`、`Cross-cutting constraints`）——升秩后以各自原文为 `###` 锚、presence 按之执法；overall-body slice 的 anchor pattern 允许行尾后缀注解（避免把「**Cross-cutting**（…）」误判）；决策留存/决策组/背书「存在才执法」（doc-arch 全量枚举 · 另三份无此面不枚举）；伪标题残留 BLOCK（与 T4 同 pattern，overall 侧）
  - 2. 全树 4 overalls 迁移——checkable: doc-arch overall 10 标记升秩（facets `###` · 决策留存 `###` · 决策组/背书 `####`，逐字含 `§` 类原文）；另三份三 facets → `###`（逐字，锚名按步骤1 家族表原样升秩——pi-harness「Cross-cutting（后缀注解）」原文保留 · consumer-parity/osuperpowers「Cross-cutting constraints」原样 · osuperpowers-overhaul goal 以开篇散文 + 服务化主线标记锚定）；`## Boundary rules`/`## Maintenance` 不动
  - 3. pin + schema 派生——checkable: tree-migration 增 charter 升秩在位断言（各 overall 既有标记按家族锚名升秩后逐字在校）；全树严格 pattern 命中 = 且仅 3 条豁免散文（逐行 pin，见 spec §2.4），法外零残留；`overall.json` 派生字节保真（factory diff pin 绿）
  - 4. overall 侧开枪负例 + pre-flight 可达范围——checkable: 新增 overall 负例夹具 `pseudo-heading-overall.md`（一条独立 bold 行 → charter 伪标题残留 BLOCK）落 `packages/cdd-engine/src/documents/doctypes/body/__tests__/fixtures/`，经 docContractValidate 断言 BLOCK finding；「存在才执法」负例由三份 legacy overall 无决策面零命中覆盖（树套件）；dispatch pre-flight 可达范围同 T4：`cdd implement`/`cdd review` 解析 plan 型，overall 型规则经 docContractValidate 各 doc type 挂载（T1 步骤3），firing 负例落验证器/树套件层——spec 验收第 7 条据此不缩水为仅 edges
  - 5. 提交——checkable: 提交，pre-commit 通过
- **Acceptance**:
  - `- ` 全树 4 overalls 既有 charter 标记升秩在位（逐字）；法外独立 bold 零残留
  - `- ` Goal/Non-goals/Cross-cutting presence 断言 + 「存在才执法」负例（三份 legacy overall 无决策面零命中）
  - `- ` `overall.json` 派生字节保真；engine suite + 树套件全绿

### Task 6: 引用 lint WARN（pattern 定稿）

- **Objective**: task 记录文本 `Task N`/`T<N>` 显式引用无边声明 → WARN「疑似缺边」（窄化 pattern 按 spec §2.3 定稿）+ 断言/负例——「忘写边」的可观测触发
- **Consumes**: T3 边模型（声明集）· T1 `StructureFinding` severity
- **Produces**: WARN 级引用 lint 判定 + 断言
- **DependsOn**: 3
- **Files**:
  - Modify: `packages/cdd-engine/src/documents/doctypes/body/plan-body.ts`（`structureRules()` += 引用 lint WARN 规则）
  - Test: `packages/cdd-engine/src/documents/doctypes/body/__tests__/plan-body.test.ts`（或专属 lint 测试文件）
  - Modify: `packages/cdd-engine/src/dispatch/__tests__/lifecycle-validation.test.ts`（dispatch 呈现 WARN）——如适用
- **Steps**:
  - 1. 实现规则——checkable: 扫描面 = `objective`/`acceptance` 明文；token `\bTask\s+([1-9]\d*)\b` / `\bT([1-9]\d*)\b`（词边界）；越界 N（0 / > taskCount）豁免；判定 = 逐块对在界 N 去重，N ≠ i 且 ∉ 本块边声明 → 一条聚合 WARN（每块至多一条）
  - 2. 断言 + 负例——checkable: `Task 3`/`T3` 明文无边 → WARN；code span 内 `T3`、`files` 面参照、越界 N、已声明边 → 零 WARN；聚合（多嫌疑 N → 一条）
  - 3. 提交——checkable: 提交，pre-commit 通过
- **Acceptance**:
  - `- ` 引用 lint WARN 有断言 + 负例（spec §2.3 pattern 全项）；engine suite 全绿

### Task 7: 编排动态面 + next 路由器 + ExecutionState + skills 精简（消费面同步）

- **Objective**: TaskGraph 动态面 `frontier(done)` + `next:` 路由器单点 `nextStep(state, ref)`（同环优先 ∧ closure→frontier）+ ExecutionState 查询面（ProgressLedger 升 `doneTasks()`/`readyBatch()`）+ skills 编排精简（cdd-dev loop 判定 → next 消费 · cdd-spec/plan/phase/charter 三态循环同路由——cdd-spec/phase/charter 零文案改动，收敛全在 engine 侧 `nextStep`）+ 撰作面（单边 · 反依赖指导 · designItems/charter）+ 三 schema description 终核（零程序历史）+ shipped grep pin 扩展 + emit——engine 成为「计划自执行状态机」，skills 收薄为「入口 + 异常面」
- **Consumes**: T3 `validate`/`batches` · T4/T5 迁移 · T6 lint · 现有 ProgressLedger / dispatch next 拼装面
- **Produces**: `frontier(done): TaskBatch` 动态面 · `nextStep(state, ref)` 路由器（同环优先 + closure→frontier）· ExecutionState 查询面（`doneTasks()`/`readyBatch()`）· skills 编排精简面——P5 graph-node ref 消费底座
- **DependsOn**: 3, 4, 5, 6
- **Files**:
  - Modify: `packages/cdd-engine/src/documents/doctypes/body/task-graph.ts`（`frontier(done: DoneSet): TaskBatch`——最小编号未完成且 DependsOn ⊆ done 的任务集 = 下一就绪波次）
  - Modify: `packages/cdd-engine/src/dispatch/task.ts` + `dispatch/docs.ts` + `dispatch/branch.ts` + `cli/review.ts` + `cli/fix.ts` + `rules/result-face.ts`（`next:` 拼装 6+ 处 → `nextStep` 路由器单点；旧拼装符号 grep 零残留）
  - Modify: `packages/cdd-engine/src/artifacts/progress.ts`（ProgressLedger 升图友好查询面：`doneTasks(): Set<number>` 每轮 handoff 结论收敛 · `readyBatch(): TaskBatch` = frontier 直接来源；`base-branch`/`crash`/`handoff` 三 artifact 面不动）
  - Modify: `packages/kairos/skills/cdd-dev/SKILL.md`（flow 精简：loop 判定 → next 消费 · 异常/人工面保留——HARNESS_ABORT 恢复 · backfill 暂停 · adjudication 覆盖 · Plan Sole Writer）
  - Modify: `packages/kairos/skills/cdd-plan/SKILL.md`（author-plan 撰作面：`DependsOn` 单边行必带 · `none` 显式 · 反依赖指导 · designItems `####` 撰作 · charter facets 指导 · plan-review 必答问题「所有边已声明」）
  - 零文案改动声明: cdd-spec / cdd-phase / cdd-charter 三 SKILL 不在编辑清单——本任务零改动（既有 `next:` 消费已就位，路由收敛全在 engine 侧 `nextStep`，无文案面需动）
  - Modify: `packages/kairos/tests/grep-sweep-regression.test.ts`（shipped 零程序历史 pin 扩展新 token）
  - Modify: `packages/cdd-engine/src/documents/doctypes/body/*.ts`（三 schema description 终核）
  - 运行: `pnpm run emit`（SKILL.md 变更后必跑）
- **Steps**:
  - 1. frontier 动态面——checkable: `TaskGraph.frontier(done)` 返回下一就绪波次（最小编号未完成 + DependsOn ⊆ done）；推进序列断言（P3.1 自身：∅ → {T1} → {T2} → {T3,T4,T5} → {T6} → {T7} → {T8}）；行为 = `batches()` 流式版（done 全完跑 = batches 全序列）
  - 2. next 路由器单点——checkable: `nextStep(state, ref)` 统一推导；同环优先（review CHANGES_REQUESTED/REVIEW_FIX → fix · fix 后 blocker>0 → re-review · closure → frontier）；spec/plan（docHash ref）与 task/branch（commit-range ref）同一路由器；旧拼装面删除（grep 零残留）
  - 3. ExecutionState 查询面——checkable: ProgressLedger 增 `doneTasks()`/`readyBatch()`（APPROVED/COMPLETED 闭合组计入 DoneSet）；三 artifact 面（base-branch/crash/handoff）确认零改动（已是单所有权，无重复）
  - 4. skills 编排精简——checkable: cdd-dev flow 的 loop 判定（`more-groups?`/下一组选择）改为 `next:` 消费；异常/人工面保留（HARNESS_ABORT 恢复 · backfill 暂停 · adjudication 覆盖 · Plan Sole Writer）；cdd-spec/phase/charter 零文案改动（消费端已就位，既有 `next:` 已指 fix/commit）· cdd-dev/cdd-plan 文案按 Files 清单更新——三态循环同路由收敛全在 engine 侧 `nextStep`；文本 English-primary、零程序历史
  - 5. 撰作面 + schema 终核——checkable: author-plan 指导含「每任务块必带 `- **DependsOn**:` 单行（`none` 显式）· 反依赖（仅可引用更小编号）· design body 以 `#### N.M` item 叶撰作 · charter facets 撰作（facets/决策留存 `###` · 决策组/背书 `####`）」；plan-review 必答问题「所有边已声明」在「尚未答复」态不可放行；`grep-sweep-regression.test.ts` 新 token（P3.1 面叙事 / 伪标题指导）零命中；三 schema description 与 body 派生一致（factory diff pin 绿）
  - 6. emit + 回归——checkable: `pnpm run emit` 后 `pnpm run emit:check` 干净（无 drift）；precommit 过
  - 7. 提交——checkable: 提交，pre-commit 通过
- **Acceptance**:
  - `- ` `frontier(done)` 动态面断言（P3.1 推进序列）· `nextStep` 路由器单点（旧拼装符号 grep 零残留）
  - `- ` ExecutionState 查询面（`doneTasks()`/`readyBatch()`）落地 · 三 artifact 面零改动
  - `- ` skills 编排精简：cdd-dev loop 判定 → next 消费 · 异常/人工面保留 · cdd-spec/phase/charter 零文案改动（同路由 next 消费已就位）· cdd-dev/cdd-plan 文案按清单更新 · English-primary 零程序历史
  - `- ` cdd-plan/cdd-dev SKILL 撰作面更新（单边行 + 反依赖 + designItems `####` + charter facets + plan-review 必答）· English-primary
  - `- ` shipped 零程序历史 grep pin（扩展面）零命中；emit 干净；三 schema 派生一致（字节保真）

### Task 8: changesets + 终验

- **Objective**: changesets（cdd-engine minor + kairos patch）+ 终验全绿（engine suite · validate ALL PASS · typecheck ×3 · biome · emit freshness）——P3.1 交付门
- **Consumes**: T1–T7 全部产物
- **Produces**: P3.1 交付记录（changesets + 全绿证据）——branch-review/closeout 依据
- **DependsOn**: 1, 2, 3, 4, 5, 6, 7
- **Files**:
  - Create: `.changeset/cdd-engine-structure-rules.md` + `.changeset/kairos-edge-authoring.md`（`pnpm run changeset`）
  - 终验: `pnpm run validate` · `pnpm --filter @oscaner-skills/cdd-engine test` · typecheck ×3 · `pnpm exec biome check` · `pnpm run emit:check`
- **Steps**:
  - 1. changesets——checkable: `cdd-engine` minor（new rules + schema 语义 + validate 面扩展）· `kairos` patch（SKILL 撰作面）——两 changeset 文件落 `.changeset/`，内容 zero 程序历史
  - 2. engine suite 全绿——checkable: `pnpm --filter @oscaner-skills/cdd-engine test` 全绿（含新增用例）
  - 3. 全量 validate——checkable: `pnpm run validate` ALL PASS（emit freshness · plugin resolution · 行为测试 · engine 零 residue + channel audit · marketplace · scripts unit · version sync）
  - 4. typecheck/biome/emit——checkable: 三项目 typecheck 绿 · biome 绿 · `emit:check` 无 drift
  - 5. 提交——checkable: 提交 changesets（若有前任务残留则合并），pre-commit 通过
- **Acceptance**:
  - `- ` changesets（cdd-engine minor + kairos patch）在位 · zero 程序历史
  - `- ` validate ALL PASS · engine suite 全绿 · typecheck ×3 · biome · emit:check 干净——全部证据随提交落库
