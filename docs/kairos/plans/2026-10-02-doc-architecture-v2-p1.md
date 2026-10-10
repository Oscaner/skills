# Doc Architecture v2 P1 实施计划（Doc Architecture v2 P1 Implementation Plan）

**Spec:** [2026-10-02-doc-architecture-v2-p1-design.md](docs/kairos/specs/2026-10-02-doc-architecture-v2-p1-design.md)

- **Parent program**: [2026-10-02-doc-architecture-v2-overall.md v1.2](docs/kairos/specs/2026-10-02-doc-architecture-v2-overall.md)
- **Version**: v1.1 · 2026-10-04
- **Depends on**: P1 design v1.1 Approved（spec-review r1 七 finding 全落地，committed）
- **开线 GATE**: pi-harness P5 closeout 未完成前不起 P1 执行线（与整体 Boundary rules 同步——overall Boundary rules 与 p1-design Section 1 均明确该 GATE 生效点）
- **Base**: develop

- **Interface 转录注记**: 各任务 `- **Consumes**: 刻意留空（树迁移 B 转录决策）——源 Do 散文未承载独立具名输入事实，consumes（Task 记录 interface 可选项）不填充；任务输入由 DependsOn/AtomicWith 声明边与 objective/steps 承载，consumer-parity p1–p4.1 因承接具名输入事实而全量填充。

## Constraints

### 口径

- **字节保真口径（Q1/Q2）**：`SchemaFactory` 派生产物 = `config/schema/{phase-spec,plan,overall}.json` 与回填前**逐字节一致**（diff 钉 ×3）；`DocType.words` 渲染产物 = `config/contract-lexicon.json` **字节等价**。产物面自 P1 起为**派生面**——改内容走 `DocType.shape` / `.words` 描述，手动编辑 = 下一工厂/守卫覆盖
- **shape 同构口径（spec v1.1 finding #2 落定）**：shape 域 = 与产出 schema **同构的完整内容**（全部 `properties`/`pattern`/`const`/`enum`/`description` 以原值落位、零抽象损耗）；工厂 = **字节保真确定性投影**（key 序 + 格式 = 唯一自由度）
- **words 单源口径（Q5）**：词表单源 = `DocType.words`（engine lexicon 翼 `_doc` / `command.{status,capsule,route}` / `schema.anatomy`）；`config/contract-lexicon.json` = 派生产物；`infra/word-table.ts` **零改动**（消费路径不变，构造 Ajv 自校验防回归——infra↔documents 零反向依赖红线）
- **分型面口径（Q5）**：`reviews.{spec,plan}`（axesGuide/lensEnum）+ `DOCS_FORMATS` 判别迁入 `DocType.bodyView`；`config/template-contract.json` 保留 shell/tokens/clauses/round-context 与 `reviews.{task,branch}`；`TemplateLoader` 渲染输出等价（templates 测试全绿 = 断言，非文件字节 diff——reviews 块迁出是预期结构变更）
- **消费者零回归口径**：`cdd schema get`（`DOC_SCHEMA_NAMES` 五型门不变）· `deriveDocTokens`（DOC_TOKENS 生产单例值不变）· `DocumentsValidator` 对外行为 · scripts `ContractLexiconGuard#checkAnatomy`（skill-anatomy 不在工厂面，读原文件）全部零回归
- **超纲线零越界（Q6）**：add-phase-protocol / skill-anatomy 手写 JSON 原样保留 + schema.test 全绿；P2 样板 / P3 TaskGraph / P5 DispatchPacket 正文（instructions/refKind 接缝内容）零实现

### commit 边界机制

- 实现提交按任务粒度（conventional commits，无 attribution trailers）；spec/plan 文档仅由 orchestrator（Plan Sole Writer）与 cdd fix-agent 修改；implement agent 零文档修改权
- 每个任务闭合前该任务面测试 + 相关 validate 面全绿；`pnpm run emit:check` fresh 保持（P1 不触碰 emit 产物面）
- **changeset 义务**：P1 终验任务（Task 7）建 changeset——`@oscaner-skills/cdd-engine`（内部重构、字节等价、消费者零变更；bump 类型按 `.changeset/README.md` version scheme 判定，先读再判）

### Flow Atomicity

- 单任务原子：每任务闭合前该任务面测试全绿 + 相关 validate 面（schema.test / tokens.test / rules/__tests__ / cli/__tests__）零回归
- **字节 pin = 漂移信号（T3/T4）**：任一 diff 钉 / 字节断言破 = 设计漂移（shape 描述与共识偏离），报告 orchestrator 判定而非带伤闭合
- 串行 dispatch：T1→T2→T3→T4→T5→T6→T7，全 singleton 组（无 `## Task Groups` 合并——各任务独立验收面）

### 顺序原则

- T1（框架核心：abstract DocType 五域 + route/lifecycle 骨架 + registry + singleton）→ T2（三子类 + per-type validate/parse 收编 + S2/S3 收敛）→ T3（shape 域 + SchemaFactory + diff 钉 ×3）→ T4（words 域 + contract-lexicon.json 派生化）→ T5（bodyView 分型面 + TemplateLoader 消费重接 + S7）→ T6（收敛接线 S1/S4/S5/S6：detect / CLI --type / resolveTargetDoc / next-step）→ T7（S8 tokens shape 域 + 死牵引 + 终验 + changeset）
- 依赖：T2/T3/T4/T5/T6/T7 均依赖 T1（DocType 骨架）；T6 依赖 T2（detect/validate/lifecycle 在位）；T7 依赖 T1+T3（shape 域访问器）
- 每任务 end-to-end：实现 → 该任务面测试绿 → `pnpm run emit:check` fresh → precommit 面绿

### 仓库纪律

- node：`fnm use`（.nvmrc v24）；引擎调用 `node packages/cdd-engine/src/bin.ts` 直调（零构建 dev face），不走 global cdd
- language policy：代码/测试 English-primary（本计划为 internal docs，中文豁免 Strategy B）；无 attribution trailers
- **引擎 `.mjs` plane zero**：新增测试用 colocated `__tests__/*.test.ts`（vitest）；src 不落 `.mjs`
- **Criterion ②**：新抽象 = 类 + 构造注入，export 面无裸函数（`abstract DocType` / 三子类 / `DocTypeRegistry` / `SchemaFactory` 全部类形态）


### Task 1: DocType 框架核心（doctype.ts + registry.ts）

- **Objective**: DocType 框架核心（doctype.ts + registry.ts）：abstract DocType 五域 + route + 抽象骨架 + DocTypeRegistry 单例，零接线
- **DependsOn**: none

- **Produces**: `src/documents/doctype.ts`（abstract DocType：五域字段 + route 元数据 + detect/validate/parse/lifecycle 抽象 + parentChain 骨架）；`src/documents/registry.ts`（DocTypeRegistry + docTypeRegistry 单例，resolve 未知 throw · all() 序 [overall, plan, spec]）；colocated 测试

- **Files**: packages/cdd-engine/src/documents/doctype.ts, packages/cdd-engine/src/documents/registry.ts, packages/cdd-engine/src/documents/__tests__/doctype.test.ts, packages/cdd-engine/src/documents/__tests__/registry.test.ts

- **Steps**:
  1. 新建 `packages/cdd-engine/src/documents/doctype.ts`——`abstract class DocType`（构造注入只读字段）：五域字段（shape · words · instructions（接缝）· refKind（接缝）· bodyView）+ `route` 路由元数据面（reviewType / argKey / targetFlag）+ 公共骨架（detect / validate / parse / lifecycle / parentChain）+ 类型（DocKind = "overall" | "plan" | "spec"） — checkable: `doctype.ts` 含 abstract DocType 全契约面（unimplemented 即 TS 编译期失败）
  2. 新建 `packages/cdd-engine/src/documents/registry.ts`——`class DocTypeRegistry`：构造收 `DocType[]`；`resolve(kind)` 未知 → throw（含 kind 文本）；`all()` 固定迭代序 `[overall, plan, spec]`；`export const docTypeRegistry` 单例 — checkable: `registry.ts` 含 DocTypeRegistry + 单例；colocated 测试绿（all() 序 / resolve throw / abstract 契约存在性）
  3. T1 零接线：detect 不接 `docKindOf`（归 T6）、validate 不接 `DocumentsValidator`（归 T2）；既有树零改动（T1 纯新模块）；`pnpm run emit:check` fresh — checkable: 既有树零改动；`pnpm run emit:check` fresh（注：五域中 shape/words/bodyView 具体型由 T3/T4/T5 落位；export 面 = 类 + 单例 const，Criterion ② 零裸函数）

- **Acceptance**:
  - `src/documents/doctype.ts` 含 `abstract DocType`（五域字段 + route 元数据 + detect/validate/parse/lifecycle 抽象 + parentChain 骨架）；`src/documents/registry.ts` 含 `DocTypeRegistry` + `docTypeRegistry` 单例（resolve 未知即 throw · all() 迭代序 `[overall, plan, spec]`）；colocated 测试全绿（vitest）；既有树零改动（T1 纯新模块）；`pnpm run emit:check` fresh。


### Task 2: 三子类 + per-type validate/parse 收编（S2/S3 收敛）

- **Objective**: 三子类 + per-type validate/parse 收编（Overall/Plan/PhaseSpecDocType + DocumentsValidator 委托注册表，S2/S3 收敛）
- **DependsOn**: 1

- **Produces**: `overall.ts` / `plan.ts` / `phase-spec.ts` 三子类（detect 特征 + validate/parse/lifecycle/parentChain + route 元数据）；`validateDispatchDocuments` 经注册表 resolve(kind).validate；per-type 私有裸函数迁子类实例方法

- **Files**: packages/cdd-engine/src/documents/doctypes/overall.ts, packages/cdd-engine/src/documents/doctypes/plan.ts, packages/cdd-engine/src/documents/doctypes/phase-spec.ts, packages/cdd-engine/src/rules/documents.ts, packages/cdd-engine/src/documents/doctypes/__tests__/doctypes.test.ts

- **Steps**:
  1. 新建三子类——`OverallDocType`（detect = basename endsWith `-overall.md` ∨ 四表表头特征；parse/validate = 现语义 + fourTableAudit；parentChain 自身即 root）；`PlanDocType`（detect = `### Task N:` 特征；parse = phaseId/phaseIdForDispatch + taskNumbers/taskGroups；validate = validatePlanContract；parentChain = resolveSpecFromPlan → resolveParentOverall）；`PhaseSpecDocType`（detect = `-design.md` + `**Version**`；validate = validatePhaseSpecContract；parentChain = resolveParentOverall）；三子类 route 元数据：overall→null · plan→(`"plan"`,`plan`,`--plan`) · phase-spec→(`"spec"`,`spec`,`--spec`) — checkable: 三子类交付（detect 判定特征 + fallback 序 · validate/parse/lifecycle/parentChain · route 元数据）；现存文档树 sample validate 全绿
  2. `DocumentsValidator` 改委托：`validateDispatchDocuments` 入口 → `docTypeRegistry.resolve(kind).validate(...)`（S2 收敛）；per-type 私有裸函数迁出为子类实例方法；跨型通用助手留模块私有；对外公开方法签名与行为不变；`docKindOf` 暂留（删除归 T6） — checkable: `validateDispatchDocuments` 现经注册表 resolve(kind).validate（grep 实证）；DocumentsValidator 内零 per-type 大函数体；`rules/__tests__` 全绿（对外行为零回归）
  3. Tests：colocated `doctypes.test.ts`——detect 判定（正/负例 + fallback 序；反例含「plan/spec doc 具 `**Version**` 行但无四表表头 → 不判 overall」）+ validate 对现文档树 sample 全绿 + phaseIdFromPlan 行为保持 — checkable: `doctypes.test.ts` 全绿；`pnpm run emit:check` fresh（注：迁移 = 行为等价搬运，禁顺手改语义）

- **Acceptance**:
  - 三子类交付（detect 判定特征+fallback 序 · validate/parse/lifecycle/parentChain 实现 · route 元数据）；`validateDispatchDocuments` 现经注册表 `resolve(kind).validate`（S2 收敛，grep 实证）；per-type 私有裸函数迁出子类实例方法（grep 实证——`DocumentsValidator` 内零 per-type 大函数体）；`rules/__tests__` 全绿（对外行为零回归）；现存文档树 sample validate 全绿；`pnpm run emit:check` fresh。


### Task 3: shape 域 + SchemaFactory + diff 钉 ×3（Q1/Q2 主面）

- **Objective**: shape 域 + SchemaFactory + diff 钉 ×3（Q1/Q2 主面）：SchemaShape 同构完整内容 + 字节保真确定性投影
- **DependsOn**: 2

- **Produces**: `doctype.ts` shape 域具体型（三型同构内容）；`src/documents/factory.ts`（SchemaFactory：字节保真投影 → config/schema 原位）；factory.test diff 钉 ×3

- **Files**: packages/cdd-engine/src/documents/doctype.ts, packages/cdd-engine/src/documents/factory.ts, packages/cdd-engine/src/documents/__tests__/factory.test.ts, packages/cdd-engine/config/schema/phase-spec.json, packages/cdd-engine/config/schema/plan.json, packages/cdd-engine/config/schema/overall.json

- **Steps**:
  1. `doctype.ts` shape 域具体型落位——`SchemaShape` = 现 `config/schema/{phase-spec,plan,overall}.json` **解析内容**（同构完整：全部 properties/pattern/const/enum/description 原值落位、形状不变、零抽象损耗）；三子类构造传入各自 schema 内容 — checkable: shape 域 = 同构完整内容（Q2）
  2. 新建 `src/documents/factory.ts`——`class SchemaFactory`：遍历 `docTypeRegistry.all()`，以 `docType.shape` **字节保真确定性投影**渲染 JSON Schema 产物（`JSON.stringify(shape, null, 2) + "\n"`，若与现状字节不符则序列化器微调至逐字节相等）；落 `config/schema/{phase-spec,plan,overall}.json` **原位**（路径零迁移） — checkable: `SchemaFactory` 渲染产物与现状文件**逐字节相等**（diff 钉 ×3 全绿）；确定性投影（同源两次渲染字节恒等）
  3. 新建 colocated `factory.test.ts`：diff 钉 ×3（渲染产物 vs 现状文件逐字节 `Buffer.equals`）+ `all()` 迭代序驱动锁定产物集 = 三活动型（add-phase-protocol / skill-anatomy **零产出**）+ 确定性断言 — checkable: factory.test 全绿（三活动型零产出闭包 + schema.test 零回归）；`pnpm run validate` engine 测试块绿

- **Acceptance**:
  - `SchemaFactory` 渲染产物与 `config/schema/{phase-spec,plan,overall}.json` **逐字节相等**（diff 钉 ×3 全绿）；确定性投影（同源渲染字节恒等）；工厂闭包 = 三活动型（add-phase-protocol / skill-anatomy 零产出 + schema.test 仍绿）；`pnpm run validate` 的 engine 测试块绿（schema.test / tokens.test 零回归）。


### Task 4: words 域 + contract-lexicon.json 派生化

- **Objective**: words 域 + contract-lexicon.json 派生化（DocWords 单字段单源 + words 渲染器字节等价）
- **DependsOn**: 3

- **Produces**: `DocType.words` 承载 engine lexicon 翼内容（共享单例）；`src/documents/words.ts` 渲染器（字节等价派生 config/contract-lexicon.json）；words.test

- **Files**: packages/cdd-engine/src/documents/doctype.ts, packages/cdd-engine/src/documents/words.ts, packages/cdd-engine/src/documents/__tests__/words.test.ts

- **Steps**:
  1. `doctype.ts` words 域具体型落位——`DocWords` = engine lexicon 翼内容（`config/contract-lexicon.json` 解析：`_doc` / `command.{status,capsule,route}` / `schema.anatomy`）收编为单字段；**共享单例**（三实例 words 域引用同一对象——词表单源不复制） — checkable: `DocType.words` 承载 engine lexicon 翼全内容（单字段单源、三实例同对象）
  2. 新建 `src/documents/words.ts`——words 渲染器：`DocWords` → `config/contract-lexicon.json` **字节等价**派生（key 序 + 格式与现状一致） — checkable: words 渲染产物 = contract-lexicon.json **字节等价**
  3. Tests：colocated `words.test.ts`——渲染产物 vs 现状字节断言；`infra/word-table.ts` **零改动**（grep 实证）+ WordTable 既有测试全绿；`pnpm run emit:check` fresh — checkable: `infra/word-table.ts` 零改动（git diff 实证）+ 既有测试全绿（消费路径不变 → infra↔documents 零反向依赖）；`pnpm run emit:check` fresh

- **Acceptance**:
  - `DocType.words` 承载 engine lexicon 翼全内容（单字段单源、三实例同对象）；words 渲染产物 = `config/contract-lexicon.json` **字节等价**；`infra/word-table.ts` 零改动（git diff 实证）+ WordTable 既有测试全绿（消费路径不变 → infra↔documents 零反向依赖）；`pnpm run emit:check` fresh。


### Task 5: bodyView 分型面（template-contract 迁移 + TemplateLoader 消费重接，S7）

- **Objective**: bodyView 分型面（template-contract 迁移 + TemplateLoader 消费重接，S7）：reviews.{spec,plan} + DOCS_FORMATS 迁入 DocType.bodyView
- **DependsOn**: 4

- **Produces**: `BodyViewSpec`（docFamily 判别接口 + per-type reviews 配置面）；`config/template-contract.json` reviews.spec/plan 块迁出；`TemplateLoader` 经 docTypeRegistry 读 per-type review 配置；templates 测试全绿（渲染输出等价）

- **Files**: packages/cdd-engine/src/documents/doctype.ts, packages/cdd-engine/config/template-contract.json, packages/cdd-engine/src/render/templates.ts

- **Steps**:
  1. `doctype.ts` bodyView 域具体型落位——`BodyViewSpec`：`docFamily` 判别接口（现 `DOCS_FORMATS = ["RETURN_JSON","DOCS_FIX"]` 判别集迁入）· per-type reviews 配置面（现 template-contract `reviews.{spec,plan}` 的 axesGuide/lensEnum 值迁入） — checkable: bodyView 域含 reviews.{spec,plan} 配置 + DOCS_FORMATS 判别集
  2. `config/template-contract.json`：reviews.spec / reviews.plan 块迁出（值迁 DocType.bodyView）；DOCS_FORMATS 定义迁出；保留 `$version`/skeleton/sections/tokens/clauses + `reviews.{task,branch}` — checkable: template-contract reviews.{spec,plan} 块迁出、shell/tokens/clauses/reviews.{task,branch} 保留（validateTemplateStructure 仍绿）
  3. `src/render/templates.ts`：`TemplateLoader` per-type review 配置改经 `docTypeRegistry` 读取（spec/plan → resolve(type).bodyView；task/branch → template-contract 保留面）；`familyFor`/DOCS_FORMATS 判别改经 bodyView；Tests：templates 测试全绿（渲染输出等价断言）+ 新增 bodyView 判别测试 — checkable: `TemplateLoader` 渲染输出等价（templates 测试全绿）；`familyFor` 判别经 DocType.bodyView（S7 收敛，grep 实证 + 测试）

- **Acceptance**:
  - bodyView 域含 reviews.{spec,plan} 配置 + DOCS_FORMATS 判别集；`config/template-contract.json` reviews.{spec,plan} 块迁出、shell/tokens/clauses/reviews.{task,branch} 保留起来（`validateTemplateStructure` 仍绿——zone 规则不变）；`TemplateLoader` 渲染输出等价（templates 测试全绿）；`familyFor` 判别经 DocType.bodyView（S7 收敛，grep 实证 + 测试）。


### Task 6: 收敛接线 S1/S4/S5/S6（detect / CLI --type / resolveTargetDoc / next-step）

- **Objective**: 收敛接线 S1/S4/S5/S6（detect 经注册表 + CLI --type 路由 + resolveTargetDoc + next-step，A3 8 散点收敛）
- **DependsOn**: 5

- **Produces**: `docKindOf` 删除（detect 经 docTypeRegistry.all() 迭代 + 零命中 fail-fast throw）；CLI review/fix --type 经 `resolve(type).lifecycle`；resolveTargetDoc / NextStep 建议表经 DocType.route

- **Files**: packages/cdd-engine/src/rules/documents.ts, packages/cdd-engine/src/cli/review.ts, packages/cdd-engine/src/cli/fix.ts, packages/cdd-engine/src/cli/shared.ts, packages/cdd-engine/src/rules/next-step.ts, packages/cdd-engine/src/dispatch/docs.ts

- **Steps**:
  1. S1——`docKindOf`（`src/rules/documents.ts:798`）**删除**：判定改经 `docTypeRegistry.all()` 按序迭代 `detect(fileName, content)`（overall→plan→spec 判定序；三型 detect 均零命中 → **fail-fast throw** unknown-doc-kind，不落 spec fallback）；validateDispatchDocuments / parentOverallOf 改经注册表 + resolve(kind).parentChain — checkable: `docKindOf` 删除（grep 零命中）；detect 判定经 docTypeRegistry（判定序 + 零命中 fail-fast throw）
  2. S4——CLI review/fix `--type` 路由：spec/plan 面经 `docTypeRegistry.resolve(type).lifecycle(entry, ctx)`（调用点 = `DocsLifecycle.run` 内按 CLI `--type` 调度）；task/branch 面保持现路由；S5——`resolveTargetDoc` spec/plan 参数取回经 `docType.route.argKey`；S6——NextStep 建议表 `#targetArg` + 三路建议经 `docType.route.targetFlag` + 注册表类型门 — checkable: CLI review/fix `--type` spec/plan 面经 resolve(type).lifecycle（task/branch 现路由保持）；resolveTargetDoc / NextStep 经 DocType.route 元数据
  3. Tests：`cli/__tests__` + `rules/__tests__`（review/fix/next-step 面）全绿；detect 判定序测试（正负例 + 二义显式报错 + 零命中负例）；**A3 grep 实证**：S1/S4/S5/S6 面零 per-type 手写分支（`docKindOf` 零存在 · `opts.type === "spec"` 式散点归零） — checkable: validate 全块绿（分支归零后 docs-review 行为与前一致）（注：task/branch 是派发类型非 doc type——不纳入注册表）

- **Acceptance**:
  - `docKindOf` 删除（grep 零命中）；detect 判定经 `docTypeRegistry`（overall→plan→spec 序 + 二义显式报错 + 零命中 fail-fast throw）；CLI review/fix `--type` spec/plan 面经 `resolve(type).lifecycle`（task/branch 现路由保持）；`resolveTargetDoc` / NextStep 建议表经 `DocType.route` 元数据；`cli`/`rules`/`next-step` 测试全绿；validate 全块绿（spike 展示：分支归零后 docs-review 行为与前一致）。


### Task 7: S8 tokens shape 域 + 死牵引 + 终验（A4 + changeset）

- **Objective**: S8 tokens shape 域 + 死牵引 + 终验（A4 + changeset）：deriveDocTokens 源改经 DocType.shape 访问器
- **DependsOn**: 6

- **Produces**: `deriveDocTokens` live 派生经 DocType.shape 域访问器（DOC_TOKENS 生产单例值不变）；死牵引清理（CLAUDE.md / tokens.ts 注释）；changeset（cdd-engine）

- **Files**: packages/cdd-engine/src/documents/tokens.ts, CLAUDE.md, packages/cdd-engine/src/documents/__tests__/tokens.test.ts

- **Steps**:
  1. S8——`src/documents/tokens.ts` `deriveDocTokens`：live 派生语义保留（path 导航 `leaf()`/`nodeAt()`），源改经 `docTypeRegistry` 的 shape 域访问器（三 schema 同构内容经 DocType.shape 取）；DOC_TOKENS 生产单例值不变；tokens.test live 测试保留（doctored shape → derived token 变化实证）+ 等价回归全绿 — checkable: `deriveDocTokens` live 派生经 DocType.shape 域访问器承载（tokens.test 等价回归 + doctored-shape live 测试全绿）；DOC_TOKENS 值不变
  2. 死牵引清理：CLAUDE.md `packages/cdd-engine/src/documents/schema/skill-anatomy.json` 引用改指 `config/schema/`；`tokens.ts` 陈旧注释改指；`ex lib/…` 残留注释清理 — checkable: 死牵引零残留（grep 双模式 `src/documents/schema/` ∪ `documents/schema/` 在 CLAUDE.md + src 注释面零命中）
  3. 终验：`pnpm run validate` 全块全绿（A4 residue/lexicon guard 零回归）；超纲线复查（add-phase-protocol / skill-anatomy 原样 + schema.test 绿 · P2/P3/P5 内容零越界 grep）；changeset：读 `.changeset/README.md` scheme 判 bump 类型 → 落 `.changeset/<slug>.md` — checkable: `pnpm run validate` 全块全绿；changeset 已建（cdd-engine）（注：本计划全 singleton 组——不落 `## Task Groups` 段）

- **Acceptance**:
  - `deriveDocTokens` live 派生经 `DocType.shape` 域访问器承载（tokens.test 等价回归 + doctored-shape live 测试全绿）；DOC_TOKENS 值不变；死牵引零残留（grep 双模式 `src/documents/schema/` ∪ `documents/schema/` 在 CLAUDE.md + src/ 注释面零命中 · `ex lib/` 残留清理）；`pnpm run validate` 全块全绿；changeset 已建（cdd-engine）。

## Change history

| Version | date | summary | author |
|---|---|---|---|
| v1.0 |  | 起草 | [human] |
| v1.1 | 2026-10-04 | plan-review r1 七 finding 全落地**：overall detect 改四表表头特征 + 反例 · detect 零命中 fail-fast throw · words 键集 `command.{status,capsule,route}` · 开线 GATE · words.ts 钉位 · lifecycle 调用点钉 `DocsLifecycle.run` · 死牵引 grep 双模式 | [human] |
