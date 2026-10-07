# Doc Architecture v2 P2 实施计划（Doc Architecture v2 P2 Implementation Plan）

**Spec:** [2026-10-02-doc-architecture-v2-p2-design.md](docs/kairos/specs/2026-10-02-doc-architecture-v2-p2-design.md)

- **Parent program**: [2026-10-02-doc-architecture-v2-overall.md v1.3](docs/kairos/specs/2026-10-02-doc-architecture-v2-overall.md)
- **Version**: v1.1 · 2026-10-05（v1.0 起草；**plan-review-1/2/3 三轮 review-fix 全落地**——r1 四 finding · r2 六 finding · r3 六 finding：tokens.test 符号面换源归位 T2/T3 · DOC_TOKENS 派生叶不变量 · T4 spec 侧合并读接口定名 · registry 接线显式化 · T6 词表平面不变实证 · 版本行按 P1 惯例回补）
- **Depends on**: P2 design v1.1 Approved（spec-review-1 七 finding 全落地，committed e1014b55）
- **Base**: develop

- **Interface 转录注记**: 各任务 `- **Consumes**: 刻意留空（树迁移 B 转录决策）——源 Do 散文未承载独立具名输入事实，consumes（Task 记录 interface 可选项）不填充；任务输入由 DependsOn/AtomicWith 声明边与 objective/steps 承载，consumer-parity p1–p4.1 因承接具名输入事实而全量填充。

## Constraints

### 口径

- **DocBody 投影派生口径（spec C1）**：唯一契约链 = `DocBody.projectSchemaShape() → DocType.shape 重派生 → SchemaFactory → config/schema/{phase-spec,plan}.json`；deriveDocTokens 续接 `DocType.shape` live 派生——**机制收窄定义 = 纯函数 `deriveDocTokens(shapes)` 签名不变**（P1 S8/T7 功能面）；DOC_TOKENS 模块求值的 shape 输入随 shapes 常量退役在 T2/T3 改经**环安全叶子绑定**（spec C1 只要求续接 DocType.shape 内容、未指定 registry 顶层求值路径，机制为计划侧裁决）：投影 shape 值在 `body/plan-body.ts` / `body/phase-spec-body.ts` 叶子面直接导出（叶子模块零 import tokens/registry，见 T1 零接线），tokens.ts 顶层 `DOC_TOKENS` 初始化授自叶子投影（内容与 `DocType.shape` 同源同值）——**不 import `docTypeRegistry`**：模块期 `docTypeRegistry.resolve(kind).shape` 会与 doctypes 顶层解引用 `DOC_TOKENS`（plan.ts/phase-spec.ts/overall.ts 模块顶层常量）互撞 TDZ（tokens→registry→doctypes→tokens 两加载序均断）；叶子绑定把 import 环拆成单向链（tokens → body 叶子；registry → doctypes → tokens，无回边）；tokens.ts 随之卸下 plan/phase-spec 常量 import（tokens.ts 结构面仅限此接线更新）；overall 型 shape 常量（`shapes/overall.ts`）本体不动（P6 宪法层面，P2 零触碰）；**加载序回归测试**：`registry` 先加载 / `tokens` 先加载两序均解析 DOC_TOKENS + docTypeRegistry（T2 布测试、T6 收口）。**deliberate update 口径（spec 2.6 / P1 Q1「先钉后退役」）**：任一 diff 钉 / DOC_TOKENS 生产值随 shape 域内容变更而变 = P2 意向变更——**变更登记放行，非意向漂移拦截**；历史 P1 golden（diff 钉 tokens.test/schema.test）以新 golden 替换并登记
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
- 依赖：T2/T3 依赖 T1（DocBody 抽象 + Task 模型）；T4 依赖 T2/T3（spec 侧 PhaseSpecBody = T2 · plan 侧 PlanBody = T3 的新骨架派生面）；T5 依赖 T2–T4（新形 + 约束面 + 双读对照）；T6 依赖 T2/T3（shape 域变更的 token 派生面）；T7 依赖全量
- 每任务 end-to-end：实现 → 该任务面测试绿 → `pnpm run emit:check` fresh → precommit 面绿

### 仓库纪律

- node：`fnm use`（.nvmrc v24）；引擎调用 `node packages/cdd-engine/src/bin.ts` 直调（零构建 dev face），不走 global cdd
- language policy：代码/测试 English-primary（本计划为 internal docs，中文豁免 Strategy B）；无 attribution trailers
- **引擎 `.mjs` plane zero**：新增测试用 colocated `__tests__/*.test.ts`（vitest）；src 不落 `.mjs`
- **Criterion ②**：新抽象类（`abstract DocBody` / `PhaseSpecBody` / `PlanBody` / `Task`）全部类形态 + 构造注入只读；`SlicePatternSet` 为类型化投影契约（索引形映射，非类）；export 面无裸函数；**空壳死代码即删**（`shapes/phase-spec.ts`/`shapes/plan.ts` 常量退役 = 删除，不留壳）


### Task 1: DocBody 框架核心 + Task 模型（body/ 目录，零接线）

- **Objective**: DocBody 框架核心 + Task 模型（body/ 目录，零接线）：abstract DocBody 二投影 + renderBrief 契约定名 + Task 类全字段
- **DependsOn**: none

- **Produces**: `body/doc-body.ts`（abstract DocBody：projectSchemaShape/projectSlicePatterns + kind + description；renderBrief 为 PlanBody 侧非基类契约）；`body/task.ts`（Task 全字段 + checkable 类型约束 + dependsOn?/atomicWith? 扩展位）；colocated 测试；既有树零改动

- **Files**: packages/cdd-engine/src/documents/doctypes/body/doc-body.ts, packages/cdd-engine/src/documents/doctypes/body/task.ts, packages/cdd-engine/src/documents/doctypes/body/__tests__/doc-body.test.ts, packages/cdd-engine/src/documents/doctypes/body/__tests__/task.test.ts

- **Steps**:
  1. 新建 `body/doc-body.ts`——`abstract class DocBody`（构造注入只读字段）：抽象契约面（二投影）`projectSchemaShape(): SchemaShape` + `projectSlicePatterns(): SlicePatternSet`；字段契约（kind: "phase-spec" | "plan" · description 样板散文单源）；类型 `SlicePatternSet`（索引形映射契约）；**renderBrief(task) 为 PlanBody 侧成员、不列 abstract 基类契约**（PhaseSpecBody 无任务 brief 渲染面，基类不声明即不强制） — checkable: `body/doc-body.ts` 含 abstract DocBody（二投影契约面 + kind + description；renderBrief 不列 abstract 基类契约）
  2. 新建 `body/task.ts`——`class Task`（构造注入只读）：objective · files · interface{consumes,produces} · steps{action,checkable}（**step.checkable 类型约束**，schema 校验面 T3 接）· acceptance · dependsOn? · atomicWith?（P3 扩展位字段面，**零读写零消费**） — checkable: `body/task.ts` 含 Task（全字段 + checkable 类型约束 + dependsOn?/atomicWith? 扩展位）
  3. 新建 colocated 测试（doc-body.test / task.test）：DocBody 契约存在性（二投影 + kind + description）+ Task 字段面 + step 缺 checkable → 构造期 type-level 约束（TS 编译失败） — checkable: colocated 测试全绿（vitest）；既有树零改动（T1 纯新模块）；`pnpm run emit:check` fresh；引擎 suite 零回归（注：T1 不落空壳——PhaseSpecBody/PlanBody 具体型留 T2/T3 全量落地）

- **Acceptance**:
  - `body/doc-body.ts` 含 `abstract DocBody`（二投影契约面 + kind + description；renderBrief 不列 abstract 基类契约）；`body/task.ts` 含 `Task`（全字段 + checkable 类型约束 + dependsOn?/atomicWith? 扩展位）；colocated 测试全绿（vitest）；既有树零改动（T1 纯新模块）；`pnpm run emit:check` fresh；引擎 suite 零回归


### Task 2: PhaseSpecBody 具体化（三真骨架 + 条件段 + shape 投影切换）

- **Objective**: PhaseSpecBody 具体化（三真骨架 + 条件段 + shape 投影切换 + SchemaFactory deliberate update）
- **DependsOn**: 1

- **Produces**: `PhaseSpecBody extends DocBody`（元数据头五元 + 三真骨架 + 四条件字段 dependentRequired + 叶子投影导出）；phase-spec.ts shape 经 body 投影（构造注入）；`shapes/phase-spec.ts` 删除；tokens.ts 授自叶子；factory.test 新 golden

- **Files**: packages/cdd-engine/src/documents/doctypes/body/phase-spec-body.ts, packages/cdd-engine/src/documents/doctypes/phase-spec.ts, packages/cdd-engine/src/documents/registry.ts, packages/cdd-engine/src/documents/tokens.ts, packages/cdd-engine/src/documents/shapes/phase-spec.ts, packages/cdd-engine/config/schema/phase-spec.json, packages/cdd-engine/src/documents/__tests__/tokens.test.ts, packages/cdd-engine/src/documents/__tests__/factory.test.ts

- **Steps**:
  1. 新建 `PhaseSpecBody extends DocBody`——`projectSchemaShape()`：元数据头五元（version · status · author · parentProgram · dependsOn）+ **三真骨架**（design「## Design」含唯一 `### Acceptance criteria` 子节 · acceptance「`- ` code-span 条件句 entry」· constraints「## Constraints」继承点）+ **条件字段**（deviations? `Overall updated?` 必 `Yes` dependentRequired · incrementalWarning? · downstreamNotes? · reviewRecord?）；`projectSlicePatterns()` 新骨架 heading 切片；**叶子投影导出** — checkable: `PhaseSpecBody` 全字段投影（元数据头五元 + 三真骨架 + 四条件字段 dependentRequired）；Deriver 绿色
  2. phase-spec.ts shape 改经 `PhaseSpecBody.projectSchemaShape()`（构造签名收 `body: PhaseSpecBody` 只读单例——默认参数化构造禁用）；**删除** `shapes/phase-spec.ts`；registry.ts `new PhaseSpecDocType(phaseSpecBody)` 显式传单例；tokens.ts DOC_TOKENS phase-spec shape 输入授自 body 叶子投影（不 import registry——TDZ 环安全）+ 新建加载序回归测试 — checkable: `DocType.shape` 经投影（`shapes/phase-spec.ts` 零存在·grep 零命中含注释）；fragment「加载序回归两序绿」
  3. validate 结构性断言（装饰段落盘 ⇒ 结构必带标记：Deviations 段存在而 `Overall updated?` ≠ `Yes` → fail；condition=false 零残留段 → 绿）；新建 phase-spec-body.test + fixtures（条件段正反例 ×2 过 docContractValidate） — checkable: 新形 fixture 过 validate（条件段正反例）；装饰段结构性断言绿
  4. **SchemaFactory deliberate update**：`config/schema/phase-spec.json` 经投影重派生（factory.test diff 钉 golden 更新，deliberate update 登记）；tokens.test phase-spec 派生面符号面换源（`PHASE_SPEC_SHAPE` 引用改授 DocType.shape / 叶子，L128 身份钉改叶子绑定断言） — checkable: factory.test 新 golden 绿；tokens.test 符号面换源绿；`pnpm run emit:check` fresh

- **Acceptance**:
  - `PhaseSpecBody` 全字段投影（元数据头五元 + 三真骨架 + 四条件字段 dependentRequired）；`DocType.shape` 经投影（`shapes/phase-spec.ts` 零存在·grep 零命中含注释）；新形 fixture 过 validate（条件段正反例）；factory.test 新 golden 绿；装饰段结构性断言（缺 `Overall updated?` → fail）；schema.test 零回归（plan/overall shape 未动）；tokens.test phase-spec 派生面 **deliberate update 重 pin**（新 golden 断言）或字节未变实证——视 shape 域实际变更而定、**样本值级 golden 终裁留 T6 收口**，不以「零回归」硬性断言；tokens.ts phase-spec 接线改经 body 叶子投影面（`shapes/phase-spec.ts` import 零残存 + 加载序回归测试两序绿）；tokens.test.ts 符号面换源绿（`PHASE_SPEC_SHAPE` 符号引用零残存 + L128 身份钉改叶子绑定断言）；registry.ts 接线（`new PhaseSpecDocType(phaseSpecBody)`）；`pnpm run emit:check` fresh


### Task 3: PlanBody + Task 数据化（brief 数据渲染 + bodyView 同步 + shape 投影切换）

- **Objective**: PlanBody + Task 数据化（brief 数据渲染 + bodyView 同步 + shape 投影切换 + DOC_TOKENS 派生叶不变量）
- **DependsOn**: 2

- **Produces**: `PlanBody extends DocBody`（元数据头五元 + delta-only constraints + tasks[] Task 数据形 + 叶子投影导出 + renderBrief 数据渲染）；plan.ts shape 经投影 + task 切片重接 + step checkable 约束；`shapes/plan.ts` 删除；bodyView decomposition 轴吃 interface；factory.test deliberate update

- **Files**: packages/cdd-engine/src/documents/doctypes/body/plan-body.ts, packages/cdd-engine/src/documents/doctypes/plan.ts, packages/cdd-engine/src/documents/registry.ts, packages/cdd-engine/src/documents/tokens.ts, packages/cdd-engine/src/documents/shapes/plan.ts, packages/cdd-engine/src/documents/doctypes/body-views.ts, packages/cdd-engine/config/schema/plan.json, packages/cdd-engine/src/documents/__tests__/tokens.test.ts, packages/cdd-engine/src/documents/__tests__/factory.test.ts, packages/cdd-engine/src/documents/doctypes/body/__tests__/plan-body.test.ts

- **Steps**:
  1. 新建 `PlanBody extends DocBody`——`projectSchemaShape()`：元数据头五元 + `constraints`（`## Constraints` 仅 delta）+ `tasks[]: Task`（objective/files/interface{consumes,produces}/steps[]{action,checkable}/acceptance[] + dependsOn?/atomicWith?）+ `taskGroups?`（P3 扩展位，零实现）；**DOC_TOKENS 派生叶不变量**（taskHeadings.format · constraints.formACanonical.heading · formBProseAnchors 四锚 · taskGroups 布局节点——任一叶丢失即 deriveDocTokens 模块期 throw）；`projectSlicePatterns()` `### Task N:` 渲染面 + task 块切片；**叶子投影导出**；**brief 数据渲染** `renderBrief(task)`（零散文雕刻 `- **Do**:` 面消除） — checkable: `PlanBody` 全字段投影 + brief = Task 数据渲染零 `- **Do**:` 面；DOC_TOKENS 派生叶不变量保持（四条叶路径/值断言绿）
  2. plan.ts shape 经 `PlanBody.projectSchemaShape()`（构造注入 `new PlanDocType(planBody)`）；task 切片提取重接（Do→objective/steps/checkable：任务块数据解析）；step checkable schema 约束（缺 checkable → validate fail）；**删除** `shapes/plan.ts`；tokens.ts plan shape 输入授自 body 叶子投影（TF token 独立）；registry.ts 显式传 planBody 单例 — checkable: D-deletion `shapes/plan.ts` 零存在（grep 含注释）；step checkable 缺失 fail；registry 接线 `new PlanDocType(planBody)`
  3. body-views.ts `PLAN_BODY_VIEW.reviews.axesGuide` decomposition 轴引用 `interface{consumes,produces}` 新字段；**SchemaFactory deliberate update**：`config/schema/plan.json` 重派生（factory.test golden 更新）；新建 plan-body.test + fixtures（新形 plan fixture parse 全绿 · brief 渲染断言 · 缺 checkable step → validate fail） — checkable: bodyView decomposition 轴断言吃 interface 字段；factory.test 新 golden 绿；plan-body.test 新形 fixture parse/brief/checkable 断言全绿；`### Task N:` 连续编号语义不变；`pnpm run emit:check` fresh

- **Acceptance**:
  - `PlanBody` 全字段投影（元数据头五元 + delta-only constraints + tasks[] Task 数据形 + taskGroups?）；brief = Task 数据渲染零 `- **Do**:` 面（新形 fixture 断言）；step checkable 缺失 fail；bodyView decomposition 轴断言吃 interface 字段；`shapes/plan.ts` 零存在（grep 含注释）；factory.test 新 golden 绿；`### Task N:` 连续编号语义不变（`taskNumbersFromPlan` 既有测试——dispatch/__tests__/runner.test.ts——保持绿）；DOC_TOKENS 派生叶不变量保持（deriveDocTokens 模块期无 throw，四条叶路径/值断言绿）；tokens.test.ts plan 符号面换源绿（`PLAN_SHAPE` 符号引用零残存 + L126 身份钉改叶子绑定断言）；registry.ts 接线（`new PlanDocType(planBody)`）；DOC_TOKENS plan 派生面接线改经 body 叶子投影面（叶子接线实证）+ 样本值级 golden 重 pin（deliberate update，T6 收口终裁兜底）；`pnpm run emit:check` fresh


### Task 4: 约束继承 delta-only 机器面（plan/spec 双侧读+合并）

- **Objective**: 约束继承 delta-only 机器面（plan/spec 双侧读+合并）：mergeParentConstraints + specConstraintsOf + resolveParentOverall 共享抽取
- **DependsOn**: 3

- **Produces**: `body/constraints.ts`（`mergeParentConstraints({ownDelta, parentConstraints})` 共享纯函数 + spec 侧 `specConstraintsOf(entry, root)`）；`resolveParentOverall` 抽取 doctypes/shared.ts 共享导出；plan-parse 读整体+delta 合并呈现；Form B 禁（新 doc）+ legacy 双读豁免；继承点断言；constraints-inheritance.test

- **Files**: packages/cdd-engine/src/documents/doctypes/body/constraints.ts, packages/cdd-engine/src/documents/doctypes/shared.ts, packages/cdd-engine/src/documents/doctypes/plan.ts, packages/cdd-engine/src/documents/doctypes/phase-spec.ts, packages/cdd-engine/src/documents/doctypes/body/__tests__/constraints-inheritance.test.ts

- **Steps**:
  1. plan-parse 读 + 合并——`extractPlanConstraints` Form A 路径升级：读到 plan 的 delta `## Constraints` 后 **join parent overall 约束**（宪法 auto-applies；`resolveParentOverall` 链复用）→ `plan-constraints.md` materialize 内容 = 宪法 + delta 合并呈现 — checkable: plan-constraints.md materialize = 合并内容（宪法 auto-applies 实证）
  2. spec-parse 读 + 合并——沿 Class-B `**Parent program**` 链读父整体约束 + delta 合并；**合并机器接口落点定名**：新建 `body/constraints.ts` `mergeParentConstraints({ownDelta, parentConstraints})` + spec 侧 `specConstraintsOf(entry, root)`；**`#resolveParentOverall` 抽取**（phase-spec.ts 私有 → doctypes/shared.ts 共享导出）；**仅新形 spec 生效**（legacy 六段保持旧读路径、双读豁免） — checkable: 医双面读+合并机器面全绿（fixtures 断言）；`body/constraints.ts` + `shared.ts` 导出存在（grep）+ phase-spec.ts `#` 私有零残存
  3. **Form B 禁（新 doc）**：validate 断言新 doc 不得用 Form B 散文指针（legacy 双读豁免旧文档）；**继承点断言**：`## Constraints` 存在 ⇒ Class-B Parent program 指针目标可解析为父 overall；新建 colocated constraints-inheritance.test + fixtures — checkable: Form B 禁断言 + legacy 豁免；继承点解析断言；既有 plan/spec 文档树 validate 零回归；`pnpm run emit:check` fresh

- **Acceptance**:
  - 双侧读+合并机器面全绿（fixtures 断言）；`plan-constraints.md` materialize = 合并内容（宪法 auto-applies 实证）；spec 侧接口落点存在（`body/constraints.ts` 的 `mergeParentConstraints` + `specConstraintsOf`，grep 断言）+ `resolveParentOverall` 共享抽取（`shared.ts` 导出、phase-spec.ts `#` 私有零残存）；Form B 禁断言 + legacy 豁免；继承点解析断言；既有 plan/spec 文档树 validate 零回归；`pnpm run emit:check` fresh


### Task 5: 双读契约 + extractor 重接 + 树零回归

- **Objective**: 双读契约 + extractor 重接 + 树零回归（legacy 六段/Form B fixture 双接受 + DocBody 投影单源）
- **DependsOn**: 4

- **Produces**: 双读契约实证（legacy 六段 spec / Form B plan fixture 过 validate + parse）；extractor 重接 DocBody.projectSlicePatterns() 投影单源；树零回归实测（docs/kairos 全量）

- **Files**: packages/cdd-engine/src/documents/doctypes/plan.ts, packages/cdd-engine/src/documents/doctypes/__tests__/dual-read.test.ts, packages/cdd-engine/src/documents/doctypes/body/__tests__/fixtures/

- **Steps**:
  1. **双读契约实证**：legacy 六段 spec / Form B plan fixture 仍过 validate + parse（taskNumbersFromPlan / brief 提取 / Form B 约束提取双路径保持）；legacy 六段 spec 约束读取双保持（`## Section 1: Constraints pointer` 旧读路径） — checkable: 双读契约全绿（legacy 六段 / Form B fixtures）
  2. **extractor 重接**：`taskNumbersFromPlan` / brief 提取 / 约束提取全部改经 `DocBody.projectSlicePatterns()` 投影单源（`### Task N:` / `## Constraints` / Form B anchors 模式自 DocBody 派生，零手写重复） — checkable: extractor 零手写重复（投影单源 grep 断言）
  3. **树零回归实测**：既有文档树**全量**（docs/kairos/specs|plans/*——含本 program p1/p2 自身旧形）过 docContractValidate 全绿（零改动、零排除实证） — checkable: 既有文档树 validate 全绿零改动（全量树）；residue/lexicon guard 连续（A4）；`pnpm run emit:check` fresh

- **Acceptance**:
  - 双读契约全绿（legacy 六段 / Form B fixtures）；既有文档树 validate 全绿零改动——**全量树 = `docs/kairos/specs|plans/*` 全部**（含本 program p1/p2 自身旧形，实计 20 design + 21 plan，以实际全量树为准）；18/19 仅为双读口径的对比基线、不构成 validate 范围限定；extractor 零手写重复（投影单源 grep 断言）；`pnpm run emit:check` fresh；residue/lexicon guard 连续（A4）


### Task 6: DOC_TOKENS 重 pin + schema.test 对齐 + 死牵引清理

- **Objective**: DOC_TOKENS 重 pin + schema.test 对齐 + 死牵引清理（T2/T3 已按口径重接，本任务收口校验 + deliberate update 重 pin）
- **DependsOn**: 5

- **Produces**: DOC_TOKENS 生产值 = 新 golden（deliberate update 登记）；tokens.test 更新（金值断言 + 派生链钉断言）；词表平面不变实证；死牵引 grep 零命中

- **Files**: packages/cdd-engine/src/documents/tokens.ts, packages/cdd-engine/src/documents/__tests__/tokens.test.ts, packages/cdd-engine/src/documents/__tests__/schema.test.ts, packages/cdd-engine/src/documents/__tests__/doctypes.test.ts

- **Steps**:
  1. `deriveDocTokens` 的 shape 输入续接 `DocType.shape`（机制 = 纯函数 `deriveDocTokens(shapes)` 签名不变；接线面保持 body 叶子投影绑定；加载序回归测试收口）——**DOC_TOKENS 生产值**随 shape 域内容变更 **deliberate update 重 pin**（新 gold 值登记） — checkable: DOC_TOKENS 生产值 = 新 golden（deliberate update 登记）；deriveDocTokens 纯函数签名不变（diff 断言）；加载序回归两序绿
  2. colocated `tokens.test.ts` 更新：新 DOC_TOKENS 金值断言 + 派生链钉断言（DocType.shape → tokens）；**词表平面不变实证**（`DOC_WORDS` / words.ts → contract-lexicon.json 零改动、零重 pin——与 shape 域无派生关系）；`schema.test.ts` / `doctypes.test.ts` 对齐新 shape 面 — checkable: tokens.test / schema.test / doctypes.test 全绿；词表平面不变实证（零改动零重 pin）
  3. **死牵引清理**：`shapes/phase-spec.ts` / `shapes/plan.ts` 残引用 grep 零命中（含注释）；`loadDocSchema` / documents-schema 文本守卫零变化（P1 面） — checkable: grep 死牵引零命中；validate 全块绿；`pnpm run emit:check` fresh

- **Acceptance**:
  - DOC_TOKENS 生产值 = 新 golden（deliberate update 登记）；tokens.test / schema.test 全绿；grep 死牵引零命中；词表平面不变实证（`DOC_WORDS` / words.ts → contract-lexicon.json 零改动、零重 pin——与 shape 域无派生关系）；`deriveDocTokens` 纯函数签名不变（diff 断言：签名面零 diff，DOC_TOKENS 初始化输入面 = body 叶子投影面，同源同值 `DocType.shape`，加载序回归测试收口绿）；validate 全块绿；`pnpm run emit:check` fresh


### Task 7: 消费面同步 + skill-anatomy + 终验 + changesets

- **Objective**: 消费面同步 + skill-anatomy + 终验 + changesets（cdd-spec/cdd-phase SKILL 骨架指导语 + template-doctrine + emit/typecheck/biome + changesets）
- **DependsOn**: 6

- **Produces**: cdd-spec/cdd-phase SKILL.md 三真骨架指导语（English 零程序历史）；skill-anatomy 校验绿；`docs/maintainers/01-template-doctrine.md` 随行；`pnpm run emit` 重生成 fresh；validate ALL PASS + typecheck ×3 + biome；changesets（cdd-engine + kairos）

- **Files**: packages/kairos/skills/cdd-spec/SKILL.md, packages/kairos/skills/cdd-phase/SKILL.md, packages/cdd-engine/config/schema/skill-anatomy.json, docs/maintainers/01-template-doctrine.md

- **Steps**:
  1. 修改 `packages/kairos/skills/cdd-spec/SKILL.md` + `cdd-phase/SKILL.md`——骨架指导语随新骨架同步（**English-primary**：Section 0–5 六段描述 → 三真骨架 `## Design` + `### Acceptance criteria` + `## Constraints` + 条件元数据；Review Convergence 入口保持；消费面文本零程序历史） — checkable: SKILL.md 骨架指导语 = 三真骨架 + 条件元数据（English，零程序历史）
  2. 修改 `config/schema/skill-anatomy.json`（若 anatomy 引 section-heading 则登记新段 heading；`ContractLexiconGuard#checkAnatomy` 校验通过）；修改 `docs/maintainers/01-template-doctrine.md`（doc 结构面随行：DocBody 模型单源 → 三派生面） — checkable: skill-anatomy registry 校验绿
  3. `pnpm run emit`（重生成 `.claude-plugin/`/`.cursor-plugin/`/`marketplace/` 产物）· `pnpm run emit:check` fresh；**终验**：`pnpm run validate` 全块 ALL PASS + typecheck 三项目绿 + biome clean；**changeset**：先读 `.changeset/README.md` 判定，再建（cdd-engine + kairos 视变） — checkable: emit 重生成 fresh；`pnpm run validate` ALL PASS · typecheck ×3 绿 · biome clean；changesets 已建（cdd-engine + kairos 视变）

- **Acceptance**:
  - SKILL.md 骨架指导语 = 三真骨架 + 条件元数据（English，零程序历史）；skill-anatomy registry 校验绿；emit 重生成 fresh；`pnpm run validate` ALL PASS · typecheck ×3 绿 · biome clean；changesets 已建（cdd-engine + kairos 视变）；residue/lexicon guard 零回归
