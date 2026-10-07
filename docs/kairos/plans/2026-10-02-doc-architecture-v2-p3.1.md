# 文档架构方法论 v2 —— P3.1 实施计划

**Spec:** [2026-10-02-doc-architecture-v2-p3.1-design.md](docs/kairos/specs/2026-10-02-doc-architecture-v2-p3.1-design.md)（spec v1.9）

- **Parent program**: [doc-architecture-v2-overall.md v1.14](docs/kairos/specs/2026-10-02-doc-architecture-v2-overall.md)
- **Version**: v1.11 · 2026-10-07（分支终审 r1 措辞收敛——编排方 per S2/S4，实现零改动：T1 不变式计数 七→十 · T3 波次验收 6→5 对齐 shipped 5 波次 wave pin · T2 迁移面措辞收敛至实际缝——content-rule 面归零 vs doc-type 上下文残留；前置 v1.10 · 2026-10-07（T7/T8 缩域：原 T7 编排状态机面（frontier/next/ExecutionState/skills 编排精简）并入 P3.2——用户拍板「T7/T8 并入 P3.2」避免在结构收敛前先实现一遍；原 T8 收尾（changesets + 终验 + wave pin 同步 5 波次）重编号 T7；overall v1.16））
- **Depends on**: P3（shipped · [p3-design v1.1](docs/kairos/specs/2026-10-02-doc-architecture-v2-p3-design.md)）
- **Base**: develop

## Constraints

- 每任务保持树全绿：规则迁移、其对应文档迁移、pin 更新三件同任务落地（中间态零红——引擎 `missing-edge`/designItems/charter 规则一经挂上即执法，全树必须已 conformant 或同任务迁完）
- 本 P3.1 plan 自证新政：所有任务块单边 `- **DependsOn**:` 行已在位（真实依赖或 `none`）；P3.1 design 已是 `####` 秩——全树迁移任务（T3/T4/T5）的存量面不含本家族文档，但 tree-migration pin 覆盖之
- 引擎规则一律经 body 叶规则数据 + `rules/structure.ts` 单解释器；手写文本遍历零新增（spec 约束「统一引擎边界」继承适用，graph 科学留 TaskGraph、跨文档链留 P5）
- 风险钉（全树绿 · 负例单轴 · 词法边界 · 伪标题无误伤 · lint 噪音）归任务：
  - 规则引擎挂载后存量树未迁移即红——T3/T4/T5 各自「规则 + 全树迁移 + pin」同任务落地（首条），T7 终验断言全树绿
  - 负例夹具单轴失败语义——`orphan-task-block-plan` / `form-b-anchor-plan` / `section-1-spec-design.md` 仅 legacy/孤块轴失败；T3/T4 补 conformant 面保持单轴
  - `none`/空与 integer gate 边界——`none`/空 → `[]`；`abc`、`1;2` 等非法 token 保持 NaN 拒绝，绝不静默吞；T3 负例集
  - 伪标题 pattern 误伤面——独立 bold 行唯一定义；行内 lead-in bold / code span 不误判；T4 对 2 份零独立文件（cp-p4.1 / doc-arch-p3）断言零命中
  - 引用 lint 噪音面——`files`/`steps`/code span 不计（逐 field 扫描面界定）；前向引用（ref ≥ 自身）与 `T7.1` spec-item 词形豁免（反依赖门不可声明 ≠ 缺边嫌疑）；越界 N 豁免；已声明边不重复告警；每块至多一条聚合 WARN；树套件 BLOCK-only 口径（WARN 由单测断言，不进树绿）；T6 负例集
  - 反依赖门误伤面——编号单调断言只拦 `DependsOn` 引用 ≥ 自身；`none`/空/越界（> taskCount）不触发反依赖；T3 负例集
- 死代码/空壳全平面清理（P3.1 补充条例 2026-10-06 用户）：各迁移/引擎任务先删后验——退役符号/废弃夹具/空壳叶零残留；存量 plan 未解析 steps 面（`- [ ]` 散文行）在 T3 一并规范化 `N. … — checkable:`（每步含 checkable）
- **编排状态机一体重建（spec v1.6 · 用户 2026-10-06 拍板 · v1.10 缩域 2026-10-07）**：边模型单边化（`DependsOn` 唯一 · `AtomicWith`/`taskGroups` 退役）+ 反依赖门 + TaskGraph `batches()` 波次推导一体落地本 phase（`frontier(done)` 动态面 + `next:` 组间推荐 + skills 编排精简随 **P3.2** 实现——用户 2026-10-07 拍板「T7/T8 并入 P3.2」：避免在即将重构的统一面上先实现一遍再重构，P3.1 只落地 batches 静态面）；同行变更经 overall v1.16 / spec v1.9 登记
- **父面消解待办登记（交编排方随父面下轮修订落位 · 本 plan 冻结期不并改冻结父面）**：(a) 父 overall v1.14（本 plan 锚定面）P3.1 执行序行「统一引擎落地（F9）」与 F1–F7 清单不符（F6 = 统一结构规则引擎）——修订为 F6 或删除；(b) 父 overall v1.12 change-history ②「`DependsOn` 不用 `none`（缺行 = 无边）」与本 phase 词法（none/空均合法，见本 plan「全树每块单边绑定」）字面矛盾——none/留空词法已随本 plan 定例（实施按 spec §2.3 执行：none 与空均合法 → `[]`，撰作面 `none` 显式，不做评价前置、不 gate 撰作面），剩余消解 = 父 overall v1.12 change-history ② 历史文字修订（交编排方随父面下轮修订落位）；（a)/(b) 均纳入 T7 终验 / branch-review 检查面复核在位，防待办随阶段丢失

---

### Task 1: StructureRule 引擎核心（解释器 + 接线缝）——已落地

- **Objective**: **已落地（engine 面现役，无新增实施量）**——`rules/structure.ts` 单解释器（StructureRule 类型 + 十不变式 + `runStructureRules`）+ DocBody 规则数据缝 + docContractValidate 挂钩已全部在位（规则集为空时零行为变化、与现状等价的契约经 tree-migration/dual-read 保持）；剩余 = 验证-only 面（T7 终验承接），本任务不再派发实施
- **Consumes**: `DocBody` / `SlicePatternSet`（doc-body.ts）· `DocType`（doctype.ts）· `docTypeRegistry`（registry.ts）——读面已就位
- **Produces**: `StructureRule` / `StructurePlane` / `StructureInvariant` / `StructureFinding` / `runStructureRules(content, rules): StructureFinding[]`——已产出，T4–T7 规则集与终验以其为消费底座
- **DependsOn**: none
- **Files**:
  - 已就位: `packages/cdd-engine/src/rules/structure.ts`（单解释器——5c055a59 挂钩接 docContractValidate · c16b09d9 起随 T2 演进）
  - 已就位: `packages/cdd-engine/src/documents/doctypes/body/doc-body.ts`（`structureRules(): StructureRule[]` 默认 `[]`）
  - 已就位: `packages/cdd-engine/src/rules/documents.ts`（`structureFindings(kind, content)` + docContractValidate 每 doc type 调一次 `runStructureRules`）
  - 验证: `packages/cdd-engine/src/rules/__tests__/structure.test.ts`（全绿保持）
- **Steps**:
  - 1. 现役面核查——checkable: `rules/structure.ts` 存在且三锚型 + 十不变式类型化实例在规则数据中；docContractValidate 对每 doc type 调一次 `runStructureRules`（grep `runStructureRules` 于 `documents.ts`）
  - 2. 空规则集零行为验证——checkable: 空规则集下 `structureFindings` 零新增 finding；50 文件树套件 validate 结果与基线逐字节相同（tree-migration/dual-read 保持全绿）
  - 3. 回归——checkable: `pnpm --filter @oscaner-skills/cdd-engine test` 全绿；本任务面零改动（引擎面已落地，不重做）
- **Acceptance**:
  - `- ` `runStructureRules` 契约可用：三锚型 + 十不变式全部可判（`structure.test.ts` 断言保持）
  - `- ` 空规则集零行为变化：docContractValidate 结果与基线一致，tree-migration/dual-read 套件绿
  - `- ` body 缝就位且 load-order 安全：bodies 零解释器反向 import（grep 断言 `structure.ts` 不被 bodies 引用）

### Task 2: 既有结构判定规则化（checks/walks 归零）——已落地

- **Objective**: **已落地（engine 面现役，无新增实施量）**——三手写判定面（`#skeletonFailures` · overall 四表审计 ①–⑥ · plan 契约文本断言）已迁移为三类型 `structureRules()` 规则集数据（plan-body / phase-spec-body / overall-body 覆写均现役），`tree-migration`/`dual-read` 全树行走已重构为消费同一引擎（`structureFindings` 唯一入口）——手写遍历面归零于迁移面（content-rule 面：`#skeletonFailures` · 四表 facet ①–⑥ · plan 契约文本断言 → 规则数据；四表 irreducible contextual residue——行 shape 守卫 · merge 版本行世系 · file-existence kernel 面 · backfill-claim/doc-existence/registration/anchor/issue-row 面——按设计保留为 doc-type 代码，模块 Rule-scope 注释记录该缝 · **S2 措辞收敛**）；剩余 = 验证-only 面（旧符号零残留 grep + 行为等价套件保持，T7 终验承接）
- **Consumes**: T1 的 `runStructureRules` / `StructureRule` / DocBody 缝——已落地
- **Produces**: 三类型 `structureRules()` 全量规则集（行为等价于 T0 手写面）· `DocumentsValidator.structureFindings` 为树套件唯一判定入口——已产出，T4–T6 新规则（边完备/designItems/charter/引用 lint）以其为挂载点
- **DependsOn**: 1
- **Files**:
  - 已就位: `packages/cdd-engine/src/documents/doctypes/body/plan-body.ts`（`structureRules()` 覆写：task continuity / record presence / constraints source / legacy residue）
  - 已就位: `packages/cdd-engine/src/documents/doctypes/body/phase-spec-body.ts` + `doctypes/phase-spec.ts`（`#skeletonFailures` → body 规则：三真骨架 + deviations 行锚 Yes）
  - 已就位: `packages/cdd-engine/src/documents/doctypes/body/overall-body.ts`（OVERALL_SHAPE 归位 + slices + 四表规则）+ `doctypes/overall.ts`（四表手写遍历删除）+ `doctypes/shapes/overall.ts`（退役）+ `doctypes/tokens.ts`（OVERALL_SHAPE import 重指，DOC_TOKENS 派生字节不变）
  - 已就位: `doctypes/__tests__/tree-migration.test.ts` + `__tests__/dual-read.test.ts`（全树行走改跑 `structureFindings`，内容保真 pin 保留）
  - 验证: `doctypes/body/__tests__/phase-spec-body.test.ts`（规则化后行为保持全绿）
- **Steps**:
  - 1. 现役面核查——checkable: 三 body `structureRules()` 覆写均在位（grep 三 body 命中覆写签名）；`#skeletonFailures` / overall 四表手写 walker / plan 契约断言符号 grep 零命中（旧方法/旧路径不存活）
  - 2. 树套件唯一入口验证——checkable: tree-migration / dual-read 的 50 文件树套件行走（23 plans + 22 design specs + 4 overalls + 1 one-off）唯一入口 = `structureFindings`（grep 断言行走不再自写循环）；tree-migration + dual-read 全绿
  - 3. 回归——checkable: `pnpm --filter @oscaner-skills/cdd-engine test` 全绿（行为等价零漂移）；本任务面零改动（引擎面已落地，不重做）
- **Acceptance**:
  - `- ` 三手写遍历面零残留：`#skeletonFailures` / overall 四表手写 walker / plan 契约断言符号 grep 零命中（旧方法/旧路径不存活）
  - `- ` 行为等价：树套件迁移前 delta 零；engine suite 全绿
  - `- ` 树套件 50 文件行走（23 plans + 22 design specs + 4 overalls + 1 one-off）唯一入口 = `structureFindings`（grep 断言行走不再自写循环）

### Task 3: plan 边完备（missing-edge 第六类 + 全树 plans 边行迁移）——已落地 + 剩余验证

- **Objective**: **已落地（62af8b4d 单边化重建 + 8f6256a3 收口）**——TaskGraph 静态面重建完成：边模型单边化（`- **DependsOn**:` 唯一有向边 · `none`/空/真实值 · 缺行 = 第六 failure class missing-edge BLOCK）、**反依赖门**（仅可引用更小编号 · 引用 ≥ 自身 = BLOCK——编号序 = 拓扑线性化锚；selfBounded 越界豁免按 maxBound）、`batches()` 波次推导（编号升序就绪层）+ `effectiveGroups` 切波次消费、全树存量 plans 单边化迁移（`- **AtomicWith**:`/`taskGroups` 声明面全树退役——原真实值面 4 plan 共 23 行清零，对称分量随波次推导天然同层覆盖）、tree-migration 边行 + 波次 pin、dispatch pre-flight 负例（缺边 plan → BLOCK）；**剩余动作收紧为验证**（与 spec §3.1 口径一致）：反依赖全树核查（现有边全编号升序零违规）+ 死壳清理断言（grep 零残留）+ 存量 plans steps 规范化复验（`- [ ]` 未解析行零残留）
- **Consumes**: T1 引擎 + T2 plan 规则集——已落地
- **Produces**: `validate()` 重建（crisp 集 + missing-edge + 反依赖门）· `batches()` 波次推导 · `effectiveGroups` 波次消费 · 全树单边化状态——已产出，T6 引用 lint 与 P3.2 编排状态机（frontier/next 路由器）以之为消费底座
- **DependsOn**: 2
- **Files**:
  - 已就位: `packages/cdd-engine/src/documents/doctypes/body/task-graph.ts`（validate 重建：crisp 集 + 反依赖门 + `batches()` 波次 · atomicWith 读取面/对称闭包/矛盾边检查删除）
  - 已就位: `packages/cdd-engine/src/documents/doctypes/plan.ts`（`parseTaskBlock` 单边扫描 `DependsOn` · `none`/空 → `[]` · integer gate 保留 · missingEdge 记录）
  - 已就位: `packages/cdd-engine/src/documents/doctypes/body/task.ts`（`TaskOpts.dependsOn` 非可选缺省 `[]` · `atomicWith` 字段删除）· `body/plan-body.ts`（PLAN_BODY_SHAPE task required += dependsOn + 边完备/反依赖 rule）
  - 已就位: `packages/cdd-engine/config/schema/plan.json`（SchemaFactory 派生产物字节保真——单边面）+ `dispatch/base.ts` + `dispatch/task.ts` + `rules/closeout.ts` + `rules/status.ts`（`effectiveGroups` 消费 `batches()` · taskGroups record 退役）
  - 已就位: `doctypes/__tests__/tree-migration.test.ts`（边行 + 波次拆分 pin）· `dual-read.test.ts`（50 文件行走单边边行面）· `body/__tests__/task.test.ts`（absent-default pin 退役）· `plan-body.test.ts`（单边词法 + 反依赖）· `task-graph.test.ts`（validate 重建 + batches）· fixtures + 新增 `forward-edge-plan` 负例夹具
  - 已就位: 全树存量 plans 边行迁移面（每块单边行 · steps 规范化——存量 plans `- [ ]` 未解析行零残留）
  - 验证: 反依赖全树核查（零违规）· 死壳清理断言 grep · steps 规范化复验
- **Steps**:
  - 1. 单边词法 + 缺行现役核查——checkable: `parseTaskBlock` 单边扫描面在位（grep 断言记录面只读 `- **DependsOn**:`）；缺行 → missing-edge（第六类）负例夹具绿；`none`/空 → `[]` · `1, 2` 走 Number 门 · 非法 token（`abc`/`1;2`）NaN 拒绝——用例在 suite
  - 2. 反依赖门 + 越界豁免现役核查——checkable: `validate()` 反依赖断言（引用目标编号 < 源编号）在位；`forward-edge-plan` 负例（T5 依赖 T10）→ BLOCK 断言绿；越界 N（> taskCount）/`none`/空不触发反依赖 · selfBounded maxBound 越界豁免用例在 suite；**反依赖全树核查**：全树 plans（22 份存量 + P3.1 自身）现有边引用全部编号升序、零违规（tree-migration pin 断言）
  - 3. 波次推导 + effectiveGroups 消费现役核查——checkable: `batches()` 对 P3.1 自身 DependsOn（T1→T2→{T3,T4,T5}→T6→T7）产出 5 波次拆分断言（tree-migration wave pin——v1.10 缩域后 P3.1 任务图为 7 任务 5 波次）；`effectiveGroups` 调 `batches()`（taskGroups record 退役 grep）
  - 4. dispatch pre-flight 负例现役核查——checkable: dry-run 负例（缺边 plan → `cdd implement`/`cdd review` pre-flight 经 docContractValidate BLOCK）在 dispatch/lifecycle-validation suite（8f6256a3 落地面）全绿
  - 5. 单边化迁移面复验——checkable: 存量 plans 任务块 `- **AtomicWith**:` 声明行零残留（62af8b4d 已删：原真实值面 4 plan——consumer-parity-p4.2 · consumer-parity-p4.4 · pi-harness-p4 · pi-harness-p5——共 23 行；计划散文/历史正文提及除外，P3 已 shipped 历史正文不 retro-rename）；`DependsOn` 单行每块在位（迁移面 = 22 份存量 214 块齐备 pin）；steps 规范化复验：存量 plans `- [ ]` 未解析行零残留（每步 `N. … — checkable:` 全解析，grep 于 22 份存量 plans 零命中）
  - 6. 死壳清理断言——checkable: atomicWith/taskGroups 读取面 · 对称闭包 · 矛盾边检查 · schema 字段 · 夹具 · pins · SKILL 双边描述 grep 零命中（engine 非测试 src + SKILL 面）；tree-migration 套件全绿
  - 7. 回归——checkable: `pnpm --filter @oscaner-skills/cdd-engine test` 全绿；本任务引擎面零新增改动（不重做）
- **Acceptance**:
  - `- ` 每 plan 任务块单边 `DependsOn` 行存在（`none`/空/真实值合法）；缺行 = plan validate BLOCK（missing-edge 第六类负例断言）
  - `- ` 反依赖门：引用目标 ≥ 源编号 = BLOCK（`forward-edge-plan` 负例）· 全树现有边零违规（反依赖全树核查）
  - `- ` `batches()` 波次拆分断言（P3.1 自身 5 波次）· `effectiveGroups` 切波次消费（taskGroups/atomicWith 声明面退役）· `AtomicWith` 全树零残留（grep 断言）
  - `- ` `Task.dependsOn` 非可选（缺省 `[]`）；`plan.json` 派生字节保真
  - `- ` dispatch pre-flight（`cdd implement`/`cdd review`）覆盖边完备（dry-run 负例）；engine suite + 树套件全绿
  - `- ` 存量 plans steps 面规范化：未解析步骤行零残留（每步 `N. … — checkable:` 全解析）· 补充条例死壳清理断言

### Task 4: designItems 结构面（统一大纲模型 —— 全树 specs 双层迁移）

- **Objective**: **双层登记叶**（`### N.` 分组头 + `#### N.M` 项叶 · `### Acceptance criteria` 锚唯一）+ **`###` 契约升级（作用平面 = spec design body）**：「`###` 全类唯一」退役，design body 内 `###` 现合法形态 = 分组头（`^### \d+\. ` allowlist）+ 唯一 `### Acceptance criteria` 锚——plan `### Task N:` 与 overall charter `###`/`####` 不在该 allowlist 内但合法，由各自 body 规则集执法（物理 shape 不归一）+ designItems 规则（分组头连续性/项归属/计数/空体/hollow/伪标题残留 BLOCK）+ 全树 21 份 specs 中 19 份 171 处独立 bold 伪标题 → `#### N.M` 逐字（含 `§`）**并按 N 归组补 `### N.` 分组头** + tree-migration 双层层级 pin——design body 从无登记叶平面变机器可见，作者以大纲心智撰写（消费导向）
- **Consumes**: T2 spec 骨架规则集（`structureRules()` + SlicePatternSet 基础切片）
- **Produces**: 双层切片（`groupHeading`/`designItemHeading`——Step1 创建）· 双层层级判定（连续性/归属/count/空体/hollow/伪标题残留）· 全树 0 伪标题全状态——P3.2 消费面（SKILL 撰作指导）依赖 + T7 树套件 pin 断言
- **DependsOn**: 2
- **Files**:
  - Modify: `packages/cdd-engine/src/documents/doctypes/body/phase-spec-body.ts`（SlicePatternSet += `groupHeading: /^### \d+\. /m` · `designItemHeading: /^#### \d+\.\d+ /m` · `structureRules()` += 双层层级规则（分组头连续性 presence/order · 项归属 crosslink · 空体/hollow · 伪标题残留）· PHASE_SPEC_BODY_SHAPE description 更新——`###` 契约升级（作用平面 = spec design body）：从「全类唯一」升「`### N.` 分组头 + `### Acceptance criteria` 唯一锚」；plan `### Task N:` 与 overall charter `###`/`####` 不在该 allowlist 内但合法，由各自 body 规则集执法）
  - Modify: `packages/cdd-engine/config/schema/phase-spec.json`（派生产物字节保真更新）
  - Modify: `packages/cdd-engine/src/documents/doctypes/__tests__/tree-migration.test.ts`（双层 pin）· `__tests__/dual-read.test.ts`
  - Modify: `packages/cdd-engine/src/documents/doctypes/body/__tests__/phase-spec-body.test.ts`（双层用例）· `__tests__/fixtures/`（spec fixtures 核查）
  - 迁移: `docs/kairos/specs/*-design.md`（19 份，171 处 + 补分组头）
- **Steps**:
  - 1. 双层切片 + 规则——checkable: `groupHeading: /^### \d+\. /m` + `designItemHeading: /^#### \d+\.\d+ /m` 进 slices（与 `### Acceptance criteria`/`## Design` exact-anchor 零碰撞——锚唯一断言保持）；规则 = 分组头连续性（`### N.` 单调）BLOCK / 项归属（`#### N.M` 的 N ∈ 已声明分组）BLOCK / 空体 BLOCK / hollow 叶 BLOCK / 独立 bold 行残留 BLOCK（严格 pattern 命中且 ∉ 显式豁免清单——2 条豁免散文流水逐行 pin、不迁移）/ 计数可枚举
  - 2. 伪标题 pattern 负例保护——checkable: 2 份零独立文件（cp-p4.1 / doc-arch-p3）在 pattern 下零命中（全 lead-in 合法）——pattern 无误伤断言；行内 lead-in bold / code span `**` 零误判
  - 3. 全树 19 份 specs 迁移（双层）——checkable: 迁移对象 = 严格 pattern 命中 173 中除 2 条豁免散文外的 171 处独立 bold（编号式 78 · § 式 87 · 其他式 6）→ `#### N.M <原文本逐字>`（含 `§` 原文保留），**并按 N 归组在其前补 `### N.` 分组头**（组名取该 § 主题，源自各 spec 段落）；2 条豁免散文（osuperpowers-overhaul-p1 L113 核对清单断言 · osuperpowers-overhaul-p5 L88 删除面 bold-bookend）逐行 pin、不迁移；文件可混式逐字处理；2 份零独立文件不动
  - 4. fixtures 核查——checkable: 正例 spec fixtures（`new-shape-phase-spec-design` / `zero-residue-phase-spec-design`）在 rules 下零命中；负例夹具 `section-1-spec-design.md` 仅原失败轴
  - 5. designItems 开枪负例 + pre-flight 可达范围——checkable: 新增负例夹具 `pseudo-heading-design.md`（一条独立 bold 行 → 伪标题残留 BLOCK）与 `hollow-item-design.md`（分组头/项叶空体→ BLOCK）与 `misbound-item-design.md`（`#### N.M` 归属未声明分组 → 归属 BLOCK），落 `body/__tests__/fixtures/`，经 docContractValidate 断言 BLOCK finding；dispatch pre-flight 可达范围同 spec（plan 型 dispatch · spec 型规则落验证器/树套件层）
  - 6. 双层层级 pin——checkable: 19 份文件 `### N.` 分组头连续性 + `#### N.M` 归属 + 标题逐字 pin；迁移后残留 = specs 面严格 pattern 命中且仅 2 条豁免散文（逐行 pin）· 全树（50 文件）= 且仅 3 条豁免散文（逐行 pin，增 cdd-review-contract-fix L22 bold-bookend 流水），法外零残留；空体/hollow 零；tree-migration 套件全绿
  - 7. 提交——checkable: 提交，pre-commit 通过
- **Acceptance**:
  - `- ` design spec 双层层级：`### N.` 分组头连续性 + `#### N.M` 归属断言 + 计数 + 标题逐字 pin；空体/hollow 零；独立 bold 行伪标题零残留（pattern grep 命中 = 且仅 3 条豁免散文逐行 pin · 法外零残留——第三条 = cdd-review-contract-fix L22 bold-bookend 流水，spec §2.4 计数对账）
  - `- ` `###` 契约升级在位：Acceptance 唯一锚 + 分组头 allowlist（双层层级负例/misbound-fixture 断言）
  - `- ` pattern 无误伤：2 份零独立文件 + lead-in/code-span 负例零命中
  - `- ` `phase-spec.json` 派生字节保真；engine suite + 树套件全绿

### Task 5: overall charter 结构秩（OverallDocBody + 全树 4 overalls 迁移）

- **Objective**: charter facets 规则（Goal/Non-goals/Cross-cutting presence 恒在 · 决策留存/决策组「存在才执法」· 伪标题残留 BLOCK）+ 全树 4 份 overalls 既有 bold-flat 标记升秩（doc-arch 全量 10 标记 · 另三份仅三 facets）+ pin——program 级最后一个散文平面机器可见
- **Consumes**: T2 overall-body（shape/slices/四表规则）· T1 引擎
- **Produces**: charter facet 规则 + 全树 overalls 升秩状态——P3.2 消费面依赖 + T7 树套件 pin 断言
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
  - 3. pin + schema 派生——checkable: tree-migration 增 charter 升秩在位断言（各 overall 既有标记按家族锚名升秩后逐字在校）；全树严格 pattern 命中 = 且仅 3 条豁免散文（逐行 pin，增 cdd-review-contract-fix L22 bold-bookend 流水——spec §2.4 计数对账），法外零残留；`overall.json` 派生字节保真（factory diff pin 绿）
  - 4. overall 侧开枪负例 + pre-flight 可达范围——checkable: 新增 overall 负例夹具 `pseudo-heading-overall.md`（一条独立 bold 行 → charter 伪标题残留 BLOCK）落 `packages/cdd-engine/src/documents/doctypes/body/__tests__/fixtures/`，经 docContractValidate 断言 BLOCK finding；「存在才执法」负例由三份 legacy overall 无决策面零命中覆盖（树套件）；dispatch pre-flight 可达范围同 T4：`cdd implement`/`cdd review` 解析 plan 型，overall 型规则经 docContractValidate 各 doc type 挂载（T1 步骤3），firing 负例落验证器/树套件层——spec 验收第 7 条据此不缩水为仅 edges
  - 5. 提交——checkable: 提交，pre-commit 通过
- **Acceptance**:
  - `- ` 全树 4 overalls 既有 charter 标记升秩在位（逐字）；法外独立 bold 零残留
  - `- ` Goal/Non-goals/Cross-cutting presence 断言 + 「存在才执法」负例（三份 legacy overall 无决策面零命中）
  - `- ` `overall.json` 派生字节保真；engine suite + 树套件全绿

### Task 6: 引用 lint WARN（宽松观测面 · pattern 定稿）

- **Objective**: task 记录文本后向 `Task N`/`T<N>` 显式引用无边声明 → WARN「疑似缺边」——**宽松观测面非门面**（必要信息 = task 块/边声明/锚 · prose 引用属作者自由面）：扫描面逐 field 界定（`Objective` marker + `Acceptance` marker + acceptance 条目，steps/files 排除）+ spec-item 词形（`T7.1`）排除 + 前向/越界/已声明/code-span 豁免 + 断言/负例——「忘写边」（后向可声明遗漏）的可观测触发；树套件 BLOCK-only 口径
- **Consumes**: T3 边模型（声明集）· T1 `StructureFinding` severity
- **Produces**: WARN 级引用 lint 判定 + 断言
- **DependsOn**: 3
- **Files**:
  - Modify: `packages/cdd-engine/src/documents/doctypes/body/plan-body.ts`（`structureRules()` += 引用 lint WARN 规则）
  - Modify: `packages/cdd-engine/src/rules/structure.ts`（`declaredReferences` 判定 + 词形/前向/字段面豁免）
  - Test: `packages/cdd-engine/src/documents/doctypes/body/__tests__/plan-body.test.ts`（或专属 lint 测试文件）
  - Modify: `packages/cdd-engine/src/documents/doctypes/__tests__/tree-migration.test.ts` + `dual-read.test.ts`（树套件 BLOCK-only 口径——structureFindings 零残留断言只按 BLOCK 级过滤，WARN 由 lint 单测断言）
  - Modify: `packages/cdd-engine/src/dispatch/__tests__/lifecycle-validation.test.ts`（dispatch 呈现 WARN）——如适用
- **Steps**:
  - 1. 实现规则——checkable: 扫描面逐 field 界定（`Objective`/`Acceptance` marker 行 + acceptance 条目 bullet，steps/files/marker 构造性排除——不吞 steps）；token `\bTask\s+([1-9]\d*)\b` / `\bT([1-9]\d*)\b`（词边界）+ `(?!\.\d+)` spec-item 词形排除；越界 N（0 / > taskCount）豁免；**前向引用豁免**（ref ≥ 自身编号——反依赖门不可声明，非缺边嫌疑）；判定 = 逐块对在界、后向 N 去重，∉ 本块边声明 → 一条聚合 WARN（每块至多一条）
  - 2. 断言 + 负例——checkable: 后向 `Task 3`/`T3` 明文无边 → WARN；前向引用、`T7.1` spec-item、code span 内 `T3`、`files`/`steps` 面参照、越界 N、已声明边 → 零 WARN；聚合（多嫌疑 N → 一条）；树套件改 BLOCK-only 口径（referenceLint 不进全树零残留断言）
  - 3. 提交——checkable: 提交，pre-commit 通过
- **Acceptance**:
  - `- ` 引用 lint WARN 有断言 + 负例（spec §2.3 pattern 全项——宽松观测面口径）；engine suite 全绿（树套件 BLOCK-only：全树 WARN 呈现合法，不 gate 树绿）

### Task 7: changesets + 终验（P3.1 收尾——原 T8）

- **Objective**: P3.1 交付门：changesets（cdd-engine minor + kairos patch）+ 终验全绿（engine suite · validate ALL PASS · typecheck ×3 · biome · emit freshness）；**tree-migration/dual-read wave pin 同步**（原 T7 编排状态机面 v1.12/v1.14 规划并入 P3.2——用户 2026-10-07 拍板，P3.1 任务图从 8 任务收为 7 任务：原 T8 重编号 T7、DependsOn 1–6，P3.1 自身波次从 6 波次 → 5 波次）
- **Consumes**: T1–T6 全部产物
- **Produces**: P3.1 交付记录（changesets + 全绿证据）——branch-review/closeout 依据
- **DependsOn**: 1, 2, 3, 4, 5, 6
- **Files**:
  - Create: `.changeset/cdd-engine-structure-rules.md` + `.changeset/kairos-edge-authoring.md`（`pnpm run changeset`）
  - Modify: `packages/cdd-engine/src/documents/doctypes/__tests__/tree-migration.test.ts` + `dual-read.test.ts`（P3.1 自身 wave pin：6 波次 → 5 波次——TaskGraph 推进序列断言 `∅ → {T1} → {T2} → {T3,T4,T5} → {T6} → {T7}`）
  - 终验: `pnpm run validate` · `pnpm --filter @oscaner-skills/cdd-engine test` · typecheck ×3 · `pnpm exec biome check` · `pnpm run emit:check`
- **Steps**:
  - 1. wave pin 同步——checkable: tree-migration/dual-read 中 P3.1 自身 TaskGraph 推进序列断言改 5 波次（`∅ → {T1} → {T2} → {T3,T4,T5} → {T6} → {T7}`，DependsOn 1–6 与 plan 一致）；engine suite 全绿
  - 2. changesets——checkable: `cdd-engine` minor（new rules + schema 语义 + validate 面扩展）· `kairos` patch（SKILL 撰作面）——两 changeset 文件落 `.changeset/`，内容 zero 程序历史
  - 3. 全量 validate——checkable: `pnpm run validate` ALL PASS（emit freshness · plugin resolution · 行为测试 · engine 零 residue + channel audit · marketplace · scripts unit · version sync）
  - 4. typecheck/biome/emit——checkable: 三项目 typecheck 绿 · biome 绿 · `emit:check` 无 drift
  - 5. 提交——checkable: 提交 changesets + wave pin 同步，pre-commit 通过
- **Acceptance**:
  - `- ` changesets（cdd-engine minor + kairos patch）在位 · zero 程序历史
  - `- ` P3.1 自身 wave pin 已同步 5 波次（原 T7 编排面并入 P3.2 的验收面收缩一致）· validate ALL PASS · engine suite 全绿 · typecheck ×3 · biome · emit:check 干净

