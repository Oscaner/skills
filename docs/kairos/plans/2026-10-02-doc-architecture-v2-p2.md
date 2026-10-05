# Doc Architecture v2 P2 实施计划（Doc Architecture v2 P2 Implementation Plan）

**Spec:** [2026-10-02-doc-architecture-v2-p2-design.md](docs/kairos/specs/2026-10-02-doc-architecture-v2-p2-design.md)

- **Parent program**: [2026-10-02-doc-architecture-v2-overall.md v1.3](docs/kairos/specs/2026-10-02-doc-architecture-v2-overall.md)
- **Version**: v1.0 · 2026-10-05
- **Depends on**: P2 design v1.1 Approved（spec-review-1 七 finding 全落地，committed e1014b55）
- **Base**: develop

## Constraints

### 口径

- **DocBody 投影派生口径（spec C1）**：唯一契约链 = `DocBody.projectSchemaShape() → DocType.shape 重派生 → SchemaFactory → config/schema/{phase-spec,plan}.json`；deriveDocTokens 续接 `DocType.shape` live 派生——**机制收窄定义 = 纯函数 `deriveDocTokens(shapes)` 签名不变**（P1 S8/T7 功能面）；DOC_TOKENS 模块求值的 shape 输入随 shapes 常量退役在 T2/T3 改从 **DocType 实例面**取得（`docTypeRegistry.resolve(kind).shape`——spec C1 唯一契约链终点），tokens.ts 随之卸下 plan/phase-spec 常量 import（tokens.ts 结构面仅限此接线更新）；overall 型 shape 常量（`shapes/overall.ts`）本体不动（P6 宪法层面，P2 零触碰）。**deliberate update 口径（spec 2.6 / P1 Q1「先钉后退役」）**：任一 diff 钉 / DOC_TOKENS 生产值随 shape 域内容变更而变 = P2 意向变更——**变更登记放行，非意向漂移拦截**；历史 P1 golden（diff 钉 tokens.test/schema.test）以新 golden 替换并登记
- **双读口径（spec C5/C6）**：legacy 六段 / Form B 的 validate + parse 必须双接受保持——既有文档树零改动（**计数基底 = 本 program 自身 doc-architecture-v2 p1/p2 两平面之外**：18 design + 19 plan；P1 plan `2026-10-02-doc-architecture-v2-p1.md`（Form A 已对齐 slug）属本 program 消费面、不在既有树计数内，仍须双读可消费）；新形 fixture 与 legacy fixture 同存
- **零越界口径（spec 2.1）**：P3 边模型（`depends_on`/`atomic_with` 仅 `dependsOn?`/`atomicWith?` 字段面声明、**零读写零消费**）/ `## Task Groups` 字面段删除 / P5 DispatchPacket join·子集过滤·InstructionUnit / P4 acceptance 机械化 全部零实现；约束继承机器面止于「读整体 + delta 合并呈现」
- **自身 doc 旧形口径（spec Q6）**：P2 自身 spec/plan 按当前规范形（六段 Section 0–5 / Form A）书写——本 plan 即例；新骨架实证 = engine fixtures + tests，首个真实采用 = P3 起文档
- **消费者零回归口径**：`cdd schema get`（五型门不变）· `deriveDocTokens`（纯函数签名不变，生产值重 pin）· `DocumentsValidator` 对外行为 · scripts `ContractLexiconGuard` 全部零回归

### commit 边界机制

- 实现提交按任务粒度（conventional commits，无 attribution trailers）；spec/plan 文档仅由 orchestrator（Plan Sole Writer）与 cdd fix-agent 修改；implement agent 零文档修改权
- 每个任务闭合前该任务面测试 + 相关 validate 面全绿；`pnpm run emit:check` fresh 保持（SKILL 文案变面在 T7 统一重生成）
- **changeset 义务**：P2 终验任务（Task 7）建 changeset——`@oscaner-skills/cdd-engine`（重构面：DocBody 模型 + shape 域重派生 + parse/brief 重接）与 `kairos`（SKILL 文案面视变）各按 `.changeset/README.md` version scheme 判定，先读再判

### Flow Atomicity

- 单任务原子：每任务闭合前该任务面测试全绿 + 相关 validate 面（schema.test / tokens.test / doctypes.test / factory.test / rules/__tests__ / dispatch/__tests__）零回归
- **字节 pin = 漂移信号（T2/T3/T6）**：任一 diff 钉 / DOC_TOKENS 字节断言破且无 deliberate update 登记 = 设计漂移，报告 orchestrator 判定而非带伤闭合；P2 变更为**意向变更登记**（T2/T3/T6 各自带的 golden 更新即登记）
- 串行 dispatch：T1→T2→T3→T4→T5→T6→T7，全 singleton 组（无 `## Task Groups` 合并——各任务独立验收面）

### 顺序原则

- T1（DocBody 框架核心 + Task 模型，零接线）→ T2（PhaseSpecBody 具体化：三真骨架 + 条件段 + phase-spec shape 投影切换 + diff 钉 deliberate update）→ T3（PlanBody 具体化：Task 数据化 + brief 数据渲染 + plan shape 投影切换 + step checkable + bodyView 同步 + diff 钉 deliberate update）→ T4（约束继承 delta-only 机器面双侧）→ T5（双读契约 + extractor 重接 + 树零回归）→ T6（DOC_TOKENS 重 pin + schema.test 对齐 + 死牵引清理）→ T7（SKILL 文案 + skill-anatomy + emit + 终验 + changesets）
- 依赖：T2/T3 依赖 T1（DocBody 抽象 + Task 模型）；T4 依赖 T3（plan/spec 新骨架派生面）；T5 依赖 T2–T4（新形 + 约束面 + 双读对照）；T6 依赖 T2/T3（shape 域变更的 token 派生面）；T7 依赖全量
- 每任务 end-to-end：实现 → 该任务面测试绿 → `pnpm run emit:check` fresh → precommit 面绿

### 仓库纪律

- node：`fnm use`（.nvmrc v24）；引擎调用 `node packages/cdd-engine/src/bin.ts` 直调（零构建 dev face），不走 global cdd
- language policy：代码/测试 English-primary（本计划为 internal docs，中文豁免 Strategy B）；无 attribution trailers
- **引擎 `.mjs` plane zero**：新增测试用 colocated `__tests__/*.test.ts`（vitest）；src 不落 `.mjs`
- **Criterion ②**：新抽象（`abstract DocBody` / `PhaseSpecBody` / `PlanBody` / `Task` / `SlicePatternSet`）全部类形态 + 构造注入只读；export 面无裸函数；**空壳死代码即删**（`shapes/phase-spec.ts`/`shapes/plan.ts` 常量退役 = 删除，不留壳）

### Task 1: DocBody 框架核心 + Task 模型（body/ 目录，零接线）

- **Do**: 新建 `packages/cdd-engine/src/documents/doctypes/body/doc-body.ts`——`abstract class DocBody`（构造注入只读字段）：
  - 三投影契约面：`projectSchemaShape(): SchemaShape`（shape 域派生源——T2/T3 具体型实现；tokens/SchemaFactory 读 `DocType.shape` 面不变）· `projectSlicePatterns(): SlicePatternSet`（parse 切片正则面单源）· `renderBrief(task: Task): string`（brief/task-handoff 渲染面契约定名——renders objective + steps{action,checkable} + acceptance，handoff materialize 经此渲染，T3 实现落测试）
  - 字段契约：`kind: "phase-spec" | "plan"` · `description`（样板散文单源——消费方读 DocBody 即读法）
  - 类型：`export type SlicePatternSet = { taskHeadingRe: RegExp; ... }`（切片面契约类型，具体投影填充）
- 新建 `packages/cdd-engine/src/documents/doctypes/body/task.ts`——`class Task`（构造注入只读）：`objective: string` · `files: string[]` · `interface: { consumes: string[]; produces: string[] }` · `steps: { action: string; checkable: string }[]`（**step.checkable 类型约束**——schema 校验面，T3 接）· `acceptance: string[]` · `dependsOn?: number[]` · `atomicWith?: number[]`（P3 扩展位字段面，**零读写零消费**）
- 新建 colocated `__tests__/doc-body.test.ts` + `__tests__/task.test.ts`（vitest）：`DocBody` 契约存在性（三投影面 + kind + description——unimplemented 即 TS 编译期失败）· `Task` 字段面（objective/files/interface/steps{action,checkable}/acceptance + dependsOn?/atomicWith?）· step 缺 checkable → 构造期 type-level 约束（TS 编译失败）
- T1 零接线：`docTypeRegistry`/SchemaFactory/tokens/doctypes 全部不动（shape 常量原位，diff 钉/tokens 零变化）
- **验收**: `body/doc-body.ts` 含 `abstract DocBody`（三投影契约 + kind + description）；`body/task.ts` 含 `Task`（全字段 + checkable 类型约束 + dependsOn?/atomicWith? 扩展位）；colocated 测试全绿（vitest）；既有树零改动（T1 纯新模块）；`pnpm run emit:check` fresh；引擎 suite 零回归
- **注**: T1 不落空壳——`PhaseSpecBody`/`PlanBody` 具体型留 T2/T3 全量落地（死壳即删纪律：不建空类占位）

### Task 2: PhaseSpecBody 具体化（三真骨架 + 条件段 + shape 投影切换）

- **Do**: 新建 `packages/cdd-engine/src/documents/doctypes/body/phase-spec-body.ts`——`PhaseSpecBody extends DocBody`（构造注入只读）：
  - `projectSchemaShape()`：投影新 phase-spec schema 内容——**元数据头五元**（`version`——`**Version**` 行保留：detect 特征 / backfill-as-version / R2 versionToken 锚行 · `status` · `author` · `parentProgram`（Class-B）· `dependsOn`）+ **三真骨架**：`design`（Section `## Design`，含唯一 `### Acceptance criteria` 子节——unique 约束保持）· `acceptance`（`- `code-span` 条件句 entry）· `constraints`（`## Constraints` 继承点；约束指针语义并入——非条件段）；**条件字段** `deviations?`（`Overall updated?` 必 `Yes`，`dependentRequired`）· `incrementalWarning?` · `downstreamNotes?` · `reviewRecord?`（各 description 载人话判据；schema `if-then` 结构性后果锚）
  - `projectSlicePatterns()`：新骨架 heading 切片（`## Design` / `### Acceptance criteria` / `## Constraints`）
- 修改 `packages/cdd-engine/src/documents/doctypes/phase-spec.ts`——`shape` 字段改经 `PhaseSpecBody.projectSchemaShape()`（`registry` 构造注入：`phaseSpecBody` 单例传 DocType）；**删除** `shapes/phase-spec.ts`（死壳即删——内容已收编 DocBody 投影）
- 修改 `packages/cdd-engine/src/documents/tokens.ts`——DOC_TOKENS 初始化的 phase-spec shape 输入改从 DocType 实例面取得（`docTypeRegistry.resolve('phase-spec').shape`），随 `shapes/phase-spec.ts` 删除同步卸下其 import（纯函数 `deriveDocTokens(shapes)` 签名不动）
- 修改 validate（phase-spec.ts 内 docContractValidate 面）——**结构性断言**：装饰段落盘 ⇒ 结构必带标记（`Deviations` 段存在而 `Overall updated?` ≠ `Yes` → fail）；condition=false 零残留段 → 绿（段落存在性断言）；「语义性 condition 为假却落段」不机器判（description 人话判据）
- 新建 colocated `__tests__/phase-spec-body.test.ts` + fixtures：$fixtures/ 新形 phase-spec fixture（三真骨架 + 条件段正反例 ×2：condition=true 落盘 ✓ / condition=false 零残留段 ✓）过 docContractValidate
- **SchemaFactory deliberate update**：`config/schema/phase-spec.json` 经投影重派生（新骨架内容）——factory.test diff 钉 golden 更新（deliberate update 登记：新 golden 断言 · 字节保真渲染面保持）
- **验收**: `PhaseSpecBody` 全字段投影（元数据头五元 + 三真骨架 + 四条件字段 dependentRequired）；`DocType.shape` 经投影（`shapes/phase-spec.ts` 零存在·grep 零命中含注释）；新形 fixture 过 validate（条件段正反例）；factory.test 新 golden 绿；装饰段结构性断言（缺 `Overall updated?` → fail）；schema.test 零回归（plan/overall shape 未动）；tokens.test phase-spec 派生面 **deliberate update 重 pin**（新 golden 断言）或字节未变实证——视 shape 域实际变更而定，不以「零回归」硬性断言；tokens.ts phase-spec 接线改经 DocType 实例面（`shapes/phase-spec.ts` import 零残存）；`pnpm run emit:check` fresh
- **注**: 若 DOC_TOKENS 有 phase-spec 派生面 → 本任务随投影重 pin（deliberate update 登记，新 golden 断言）；字节未变面登记「不变实证」；统一收口留 T6 复审

### Task 3: PlanBody + Task 数据化（brief 数据渲染 + bodyView 同步 + shape 投影切换）

- **Do**: 新建 `packages/cdd-engine/src/documents/doctypes/body/plan-body.ts`——`PlanBody extends DocBody`（构造注入只读）：
  - `projectSchemaShape()`：元数据头五元（`specRef`（Class-A `**Spec:**` label==basename 保持）· `parentProgram` · `version` · `dependsOn` · `base`）+ `constraints`（`## Constraints` 仅 delta——Form B 新 doc 禁入 description）+ `tasks[]: Task`（C3 数据形：objective/files/interface{consumes,produces}/steps[]{action,checkable}/acceptance[] + dependsOn?/atomicWith?）+ `taskGroups?`（P3 扩展位，零实现）
  - `projectSlicePatterns()`：`### Task N:` 渲染面（连续编号契约 `extractTaskNumbers` 语义 `1..N` 不变）+ task 块切片（objective/steps/acceptance 字段单源）
  - **brief 数据渲染**：`renderBrief(task): string`（objective + steps[action+checkable] + acceptance → task-handoff brief 内容，零散文雕刻——`- **Do**:` 面消除）
- 修改 `packages/cdd-engine/src/documents/doctypes/plan.ts`——`shape` 经 `PlanBody.projectSchemaShape()`；task 切片提取重接（Do→objective/steps/checkable：brief/handoff materialize 改经 `renderBrief`）；step checkable schema 约束（缺 checkable → validate fail，非作者自觉）；**删除** `shapes/plan.ts`（死壳即删）
- 修改 `packages/cdd-engine/src/documents/tokens.ts`——DOC_TOKENS 初始化的 plan shape 输入改从 DocType 实例面取得（`docTypeRegistry.resolve('plan').shape`），随 `shapes/plan.ts` 删除同步卸下其 import（纯函数 `deriveDocTokens(shapes)` 签名不动）
- 修改 `packages/cdd-engine/src/documents/doctypes/body-views.ts`——`PLAN_BODY_VIEW.reviews.axesGuide` decomposition 轴引用 `interface{consumes,produces}` 新字段（类型化 task boundaries + interfaces）
- **SchemaFactory deliberate update**：`config/schema/plan.json` 重派生——factory.test golden 更新（deliberate update 登记）
- 新建 colocated `__tests__/plan-body.test.ts` + fixtures：新形 plan fixture parse 全绿 · brief 渲染断言（objective/steps/checkable/acceptance 字段 → 渲染内容）· **缺 checkable step → validate fail 断言**
- **验收**: `PlanBody` 全字段投影（元数据头五元 + delta-only constraints + tasks[] Task 数据形 + taskGroups?）；brief = Task 数据渲染零 `- **Do**:` 面（新形 fixture 断言）；step checkable 缺失 fail；bodyView decomposition 轴断言吃 interface 字段；`shapes/plan.ts` 零存在（grep 含注释）；factory.test 新 golden 绿；`### Task N:` 连续编号语义不变（extractTaskNumbers 既有测试绿）；DOC_TOKENS plan 派生面接线改经 DocType 实例面（实例面重接实证）；变更面重 pin（deliberate update，T6 复审兜底）；`pnpm run emit:check` fresh
- **注**: 本任务后新形 plan 的 `## Constraints` 语义 = delta-only（仅 delta 落盘）；宪法合并呈现的读路径见 T4

### Task 4: 约束继承 delta-only 机器面（plan/spec 双侧读+合并）

- **Do**: 修改 `packages/cdd-engine/src/documents/doctypes/plan.ts` + `phase-spec.ts`（或共享 helper 入 body/）——
  - **plan-parse 读 + 合并**：`extractPlanConstraints` Form A 路径升级——读到 plan 的 delta `## Constraints` 后 **join parent overall 约束**（宪法 auto-applies；`resolveParentOverall` 链复用）→ `plan-constraints.md` materialize 内容 = 宪法 + delta 合并呈现
  - **spec-parse 读 + 合并**：沿 Class-B `**Parent program**` 链读父整体约束 + delta 合并（spec 自身 `## Constraints` delta-only 同规——约束指针语义并入继承点）；**仅新形（含 `## Constraints`）spec 生效**——legacy 六段 spec 保持旧读路径（约束源 = `## Section 1: Constraints pointer` 散文，无合并、双读豁免，与计划侧 Form B 保留旧行为同构）
  - **Form B 禁（新 doc）**：validate 断言新 doc 不得用 Form B 散文指针（legacy 双读豁免旧文档）
  - **继承点断言**：`## Constraints` 存在 ⇒ Class-B Parent program 指针目标可解析为父 overall（现 Class-B 断言升级为继承点联动）
- 新建 colocated `__tests__/constraints-inheritance.test.ts` + fixtures：plan 宪法+delta 合并断言（auto-applies）· spec 沿 Parent program 读整体 + delta 合并断言 · Form B 新 doc fail / legacy Form B 绿 · 继承点指针目标解析断言
- **验收**: 双侧读+合并机器面全绿（fixtures 断言）；`plan-constraints.md` materialize = 合并内容（宪法 auto-applies 实证）；Form B 禁断言 + legacy 豁免；继承点解析断言；既有 plan/spec 文档树 validate 零回归；`pnpm run emit:check` fresh
- **注**: join/子集过滤 = P5 零越界——本任务只【读整体 + delta 合并呈现】，不实现 DispatchPacket 携带/过滤

### Task 5: 双读契约 + extractor 重接 + 树零回归

- **Do**: 修改 `packages/cdd-engine/src/documents/doctypes/plan.ts`（提取面收敛）——
  - **双读契约实证**：legacy 六段 spec / Form B plan fixture 仍过 validate + parse（extractTaskNumbers / brief 提取 / Form B 约束提取双路径保持）；**legacy 六段 spec 约束读取双保持**（`## Section 1: Constraints pointer` 散文面旧读路径不变——无合并读施加，约束呈现不因 spec 侧合并面而变）
  - **extractor 重接**：`extractTaskNumbers` / brief 提取 / 约束提取全部改经 `DocBody.projectSlicePatterns()` 投影单源（`### Task N:` / `## Constraints` / Form B anchors 模式自 DocBody 派生，零手写重复）
  - **树零回归实测**：既有文档树**全量**（docs/kairos/specs|plans/*——含本 program p1/p2 自身旧形文档，当前实计 20 design + 21 plan，以实际全量树为准）过 docContractValidate 全绿（零改动、零排除实证）
- 新建 colocated `__tests__/dual-read.test.ts` + fixtures：legacy 六段 spec fixture 过 validate + parse · **legacy 六段 spec 约束读取保持断言**（旧读路径、无合并读）· Form B plan fixture 过 validate + parse · extractor 投影单源断言（切片模式 == PlanBody.projectSlicePatterns() 产物）
- **验收**: 双读契约全绿（legacy 六段 / Form B fixtures）；既有文档树 validate 全绿零改动（全量树——计数基底・范围同「双读口径」）；extractor 零手写重复（投影单源 grep 断言）；`pnpm run emit:check` fresh；residue/lexicon guard 连续（A4）
- **注**: 本任务后新/旧两形并行可消费；P3 起新文档走新形（交割触发点定义见 spec C6）

### Task 6: DOC_TOKENS / 词表重 pin + schema.test 对齐 + 死牵引清理

- **Do**: 修改 `packages/cdd-engine/src/documents/tokens.ts`（T2/T3 已按口径重接 DOC_TOKENS 输入至 DocType 实例面——本任务收口校验；token 字节未变面登记「不变实证」而非强制改动）——
  - `deriveDocTokens` 的 shape 输入续接 `DocType.shape`（**机制 = 纯函数 `deriveDocTokens(shapes)` 签名不变**；接线面保持 T2/T3 重接后的 DocType 实例面）——**DOC_TOKENS 生产值**随 shape 域内容变更 **deliberate update 重 pin**（新 gold 值登记）
  - colocated `tokens.test.ts` 更新：新 DOC_TOKENS 金值断言 + 派生链钉断言（DocType.shape → tokens）
  - `schema.test.ts` / `doctypes.test.ts` 对齐新 shape 面（若 T2/T3 已更则校验）
  - **死牵引清理**：`shapes/phase-spec.ts` / `shapes/plan.ts` 残引用 grep 零命中（含注释）；`loadDocSchema` / `documents-schema` 文本守卫零变化（P1 面）
- **验收**: DOC_TOKENS 生产值 = 新 golden（deliberate update 登记）；tokens.test / schema.test 全绿；grep 死牵引零命中；`deriveDocTokens` 纯函数签名不变（diff 断言：签名面零 diff，DOC_TOKENS 初始化输入面 = DocType 实例面）；validate 全块绿；`pnpm run emit:check` fresh
- **注**: 若 token 面实际字节未变（双读保守面），登记「不变实证」而非强制变更——真实面为准，tokens.test 钉住

### Task 7: 消费面同步 + skill-anatomy + 终验 + changesets

- **Do**: 
  - 修改 `packages/kairos/skills/cdd-spec/SKILL.md` + `packages/kairos/skills/cdd-phase/SKILL.md`——骨架指导语随新骨架同步（**English-primary**：Section 0–5 六段描述 → 三真骨架 `## Design` + `### Acceptance criteria` + `## Constraints` + 条件元数据（deviation/incremental warning/downstream/review record 条件段）；Review Convergence 入口保持；消费面文本零程序历史）
  - 修改 `packages/cdd-engine/config/schema/skill-anatomy.json`（若 anatomy 引 section-heading 则登记新段 heading；`ContractLexiconGuard#checkAnatomy` 校验通过）
  - 修改 `docs/maintainers/01-template-doctrine.md`（doc 结构面随行：DocBody 模型单源 → 三派生面）
  - `pnpm run emit`（重生成 `.claude-plugin/``.cursor-plugin/`marketplace/` 产物）· `pnpm run emit:check` fresh
  - **终验**：`pnpm run validate` 全块 ALL PASS（emit 新鲜 / kairos 插件解析 / cdd-engine 引擎套件 / 零残留 residue + channel audit / marketplace / scripts 单元 / 版本同步）· typecheck 三项目绿 · biome clean
  - **changeset**：先读 `.changeset/README.md` 判定，再建——`@oscaner-skills/cdd-engine`（DocBody 模型 + shape 域投影重派生 + parse/brief 重接 + 双读）+ `kairos`（cdd-spec/cdd-phase SKILL 骨架指导语变更，视面）
- **验收**: SKILL.md 骨架指导语 = 三真骨架 + 条件元数据（English，零程序历史）；skill-anatomy registry 校验绿；emit 重生成 fresh；`pnpm run validate` ALL PASS · typecheck ×3 绿 · biome clean；changesets 已建（cdd-engine + kairos 视变）；residue/lexicon guard 零回归
- **注**: 消费面文本改动按整体 C7 口径——SKILL.md 为消费者指令文档，零程序历史叙述（consumer surface purity 铁律）