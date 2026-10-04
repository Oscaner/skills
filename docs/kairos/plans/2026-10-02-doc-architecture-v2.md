# Doc Architecture v2 P1 实施计划（Doc Architecture v2 P1 Implementation Plan）

**Spec:** [2026-10-02-doc-architecture-v2-p1-design.md](docs/kairos/specs/2026-10-02-doc-architecture-v2-p1-design.md)

- **Parent program**: [2026-10-02-doc-architecture-v2-overall.md v1.2](docs/kairos/specs/2026-10-02-doc-architecture-v2-overall.md)
- **Version**: v1.0 · 2026-10-04
- **Depends on**: P1 design v1.1 Approved（spec-review r1 七 finding 全落地，committed）
- **Base**: develop

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

- **Do**: 新建 `packages/cdd-engine/src/documents/doctype.ts`——`abstract class DocType`（构造注入只读字段）：
  - 五域字段：`shape: SchemaShape`（T3 落具体型，T1 立字段+接口契约）· `words: DocWords`（T4 落，共享词表引用）· `instructions`（**接缝**：InstructionUnit 前瞻接口——P5 填，P1 立类型接口）· `refKind`（**接缝**：RefKindSpec 判别槽接口——P5 填，P1 立占位型）· `bodyView: BodyViewSpec`（T5 落具体型，T1 立接口契约）
  - `route` 路由元数据面（独立于五域字段）：`reviewType: "spec" | "plan" | null` · `argKey`（`spec`/`plan`——resolveTargetDoc 参数取回）· `targetFlag`（`--spec`/`--plan`——next-step #targetArg）
  - 公共骨架：`abstract detect(fileName: string, content: string): boolean` · `abstract validate(entry, ctx): …` · `abstract parse(entry, ctx): …` · `abstract lifecycle(entry, ctx): …`（review/fix `--type` 路由的型特定生命周期处理，S4 落点）· `parentChain(entry, root)`（S3 骨架，子类实现链走）
  - 类型：`export type DocKind = "overall" | "plan" | "spec"`
- 新建 `packages/cdd-engine/src/documents/registry.ts`——`class DocTypeRegistry`：构造收 `DocType[]`；`resolve(kind: DocKind): DocType` 未知 → throw（含 kind 文本）· `all(): DocType[]` **固定迭代序 `[overall, plan, spec]`**（工厂派生 + 审计遍历确定性面）；`export const docTypeRegistry` 单例（与 `wordTable()` / `templateCache` 同级模式）
- 新建 colocated `__tests__/doctype.test.ts` + `registry.test.ts`（vitest）：`docTypeRegistry.all()` 迭代序 `[overall, plan, spec]` · `resolve("bogus" as DocKind)` throw（含 kind 文本）· abstract 契约存在性（五域字段 + route + detect/validate/parse/lifecycle 抽象面——unimplemented 即 TS 编译期失败）
- T1 零接线：detect 不接 `docKindOf`（归 T6）、validate 不接 `DocumentsValidator`（归 T2）
- **验收**: `src/documents/doctype.ts` 含 `abstract DocType`（五域字段 + route 元数据 + detect/validate/parse/lifecycle 抽象 + parentChain 骨架）；`src/documents/registry.ts` 含 `DocTypeRegistry` + `docTypeRegistry` 单例（resolve 未知即 throw · all() 迭代序 `[overall, plan, spec]`）；colocated 测试全绿（vitest）；既有树零改动（T1 纯新模块）；`pnpm run emit:check` fresh。
- **注**: 五域中 shape/words/bodyView 的具体内容型由 T3/T4/T5 落位——T1 先立字段与接口契约（占位型亦合法），instructions/refKind 为 P5 接缝只立类型接口；本模块 export 面 = 类 + `docTypeRegistry` 单例 const（Criterion ② 零裸函数）。

### Task 2: 三子类 + per-type validate/parse 收编（S2/S3 收敛）

- **Do**: 新建 `src/documents/doctypes/overall.ts` / `plan.ts` / `phase-spec.ts`：
  - `class OverallDocType extends DocType`——detect = basename endsWith `-overall.md` ∨ 内容含 `**Version**` 行特征；`parse` = 现 `parseOverall` 语义（kernelOk/shapeDrift/versionProblems/ids/rows/dupIds/historyRows）；`validate` = 现 `validateOverallContract` 语义（kernel 行形 + 版本 lineage）+ `fourTableAudit`（face ①-⑥）；`parentChain` = 自身即 root
  - `class PlanDocType extends DocType`——detect = `### Task N:` 连续标题特征（`DOC_TOKENS.taskNumberRe`）；`parse` = `phaseIdFromPlan`/`phaseIdForDispatch` 语义（basename `-p<digits>` 规范 id）+ `taskNumbersFromPlan`/`taskGroupsFromPlan`；`validate` = 现 `validatePlanContract` 语义（任务连续性 / `**Spec:**` Class-A 解析 / Form A|B 约束可提取 / 模板占位符零残留）；`parentChain` = `resolveSpecFromPlan` → `resolveParentOverall` 链走
  - `class PhaseSpecDocType extends DocType`——detect = basename endsWith `-design.md` + `**Version**` 行契约特征；无专用 parse（Version 行检查）；`validate` = 现 `validatePhaseSpecContract` 语义（Version STRICTLY 行 + Class-B Parent program → 父 overall `validateOverallContract` + 四表）；`parentChain` = `resolveParentOverall` 链走
  - 三子类 `route`/`lifecycle` 元数据：overall→null（非 CLI review-type）· plan→(`"plan"`,`plan`,`--plan`) · phase-spec→(`"spec"`,`spec`,`--spec`)
  - `DocumentsValidator`（`src/rules/documents.ts:1114`）改委托：`validateDispatchDocuments` 入口 → `docTypeRegistry.resolve(kind).validate(...)`（S2 收敛）；per-type 私有裸函数（`fourTableAudit` / `resolveParentOverall` / `resolveSpecFromPlan` / plan/overall 契约助手）迁出为子类实例方法；跨型通用助手（如 `splitCells`/`sectionRange`）留模块私有；对外公开方法签名与行为不变
  - `docKindOf`（:798）**暂留**（delegate 仍用）——其删除归 T6
  - Tests：colocated `__tests__/doctypes.test.ts`——detect 判定（overall/plan/phase-spec 各正/负例 + fallback 序）、`validate` 对现文档树实测（spec/plan/overall 各抽现存 doc 如 `2026-09-27-pi-harness-overall.md`/`-p5-design.md`/`-p5.md` 全绿）、`phaseIdFromPlan` 行为保持；`rules/__tests__`（doc-contract / contract）零回归
- **验收**: 三子类交付（detect 判定特征+fallback 序 · validate/parse/lifecycle/parentChain 实现 · route 元数据）；`validateDispatchDocuments` 现经注册表 `resolve(kind).validate`（S2 收敛，grep 实证）；per-type 私有裸函数迁出子类实例方法（grep 实证——`DocumentsValidator` 内零 per-type 大函数体）；`rules/__tests__` 全绿（对外行为零回归）；现存文档树 sample validate 全绿；`pnpm run emit:check` fresh。
- **注**: 迁移 = 行为等价搬运（既有立测试钉回归，禁顺手改语义）；`docKindOf` 未删——S1 收敛归 T6；overall 为 chain root（`parentChain` 即自身），plan/spec 链经 spec→overall 解析。

### Task 3: shape 域 + SchemaFactory + diff 钉 ×3（Q1/Q2 主面）

- **Do**: `src/documents/doctype.ts` shape 域具体型落位——`SchemaShape` = 现 `config/schema/{phase-spec,plan,overall}.json` **解析内容**（同构完整：全部 properties/pattern/const/enum/description 原值落位、形状不变、零抽象损耗）；三子类构造传入各自 schema 内容
  - 新建 `src/documents/factory.ts`——`class SchemaFactory`：遍历 `docTypeRegistry.all()`，以 `docType.shape` **字节保真确定性投影**渲染 JSON Schema 产物（key 序 + 2-space 缩进 + 尾换行与现状文件完全一致——`JSON.stringify(shape, null, 2) + "\n"`，若与现状字节不符则序列化器微调至逐字节相等）；落 `config/schema/{phase-spec,plan,overall}.json` **原位**（路径零迁移）
  - 新建 colocated `__tests__/factory.test.ts`：**diff 钉 ×3**——渲染产物 vs 回填前 `config/schema/{phase-spec,plan,overall}.json` 逐字节 `Buffer.equals` 断言（golden = 现状文件全量读取）；`all()` 迭代序驱动锁定产物集 = 三活动型（add-phase-protocol / skill-anatomy **零产出**——Q6 闭包列守）；确定性（同源两次渲染字节恒等）
  - `deriveDocTokens` **暂不重路**（S8 归 T7——T3 期间 tokens 仍直读配置面，保证 diff 钉纯净）
- **验收**: `SchemaFactory` 渲染产物与 `config/schema/{phase-spec,plan,overall}.json` **逐字节相等**（diff 钉 ×3 全绿）；确定性投影（同源渲染字节恒等）；工厂闭包 = 三活动型（add-phase-protocol / skill-anatomy 零产出 + schema.test 仍绿）；`pnpm run validate` 的 engine 测试块绿（schema.test / tokens.test 零回归）。
- **注**: 本任务是「schema 工厂原子化派生」语义钉——shape = 同构内容全量收编（非抽象生成），工厂 = 字节保真投影（Q1「先钉」面）；diff-pin 破 = 设计漂移信号（Flow Atomicity 上报 orchestrator 判定）。

### Task 4: words 域 + contract-lexicon.json 派生化

- **Do**: `src/documents/doctype.ts` words 域具体型落位——`DocWords` = engine lexicon 翼内容（`config/contract-lexicon.json` 解析：`_doc` / `command.{status,vocab,capsule,route}` / `schema.anatomy`）收编为单字段；**共享单例**（三实例 words 域引用同一 `DocWords` 对象——词表单源，不复制）
  - 新建 `src/documents/words.ts`（或并入 factory.ts）——words 渲染器：`DocWords` → `config/contract-lexicon.json` **字节等价**派生（key 序 + 格式与现状一致）
  - Tests：colocated `__tests__/words.test.ts`——渲染产物 vs 现状 `config/contract-lexicon.json` 字节断言；`infra/word-table.ts` **零改动**（grep 实证）+ WordTable 构造 Ajv 自校验 + 访问器行为测试全绿（word-table 既有测试）；更新 `registry.all()` 迭代序下 words 渲染覆盖三实例同源引用断言
- **验收**: `DocType.words` 承载 engine lexicon 翼全内容（单字段单源、三实例同对象）；words 渲染产物 = `config/contract-lexicon.json` **字节等价**；`infra/word-table.ts` 零改动（git diff 实证）+ WordTable 既有测试全绿（消费路径不变 → infra↔documents 零反向依赖）；`pnpm run emit:check` fresh。
- **注**: guard 翼（`scripts/lib/guard-lexicon.json`）不在本任务范围（引擎包零 guard 词，spec 显式列守）；防循环红线 = documents/ 不 import infra/word-table.ts（words 内容自身承载，infra 侧消费产物文件不变）。

### Task 5: bodyView 分型面（template-contract 迁移 + TemplateLoader 消费重接，S7）

- **Do**: `src/documents/doctype.ts` bodyView 域具体型落位——`BodyViewSpec`：`docFamily` 判别接口（现 `DOCS_FORMATS = ["RETURN_JSON","DOCS_FIX"]` 判别集迁入）· per-type reviews 配置面（现 `config/template-contract.json` `reviews.{spec,plan}` 的 `axesGuide`/`lensEnum` 值迁入）
  - `config/template-contract.json`：**reviews.spec / reviews.plan 块迁出**（值迁 DocType.bodyView）；**DOCS_FORMATS 定义迁出**；保留 `$version`/skeleton/sections(shell,return,round-context)/tokens/clauses + `reviews.{task,branch}`
  - `src/render/templates.ts`：`TemplateLoader` per-type review 配置改经 `docTypeRegistry` 读取（spec/plan → `resolve(type).bodyView`；task/branch → template-contract 保留面）；`familyFor`/`DOCS_FORMATS` 判别改经 bodyView 判别集（S7 收敛落点）；shell/return/round-context 装配逻辑不动
  - Tests：templates 现有测试（`templates.test` / `templates.cache.test` / `templates.content.test`）**全绿 = 渲染输出等价断言**（spec/plan review 配置值经 DocType 等价注入）；新增 bodyView 判别测试（DOCS_FORMATS 成员判定正向/负向 + spec/plan axesGuide 读回）
- **验收**: bodyView 域含 reviews.{spec,plan} 配置 + DOCS_FORMATS 判别集；`config/template-contract.json` reviews.{spec,plan} 块迁出、shell/tokens/clauses/reviews.{task,branch} 保留起来（`validateTemplateStructure` 仍绿——zone 规则不变）；`TemplateLoader` 渲染输出等价（templates 测试全绿）；`familyFor` 判别经 DocType.bodyView（S7 收敛，grep 实证 + 测试）。
- **注**: 分型面边界 = reviews 分型值迁 DocType，shell/tokens/clauses 是流程 prompt 面（与 doc type 正交）保留渲染数据面（Q5 定案，spec C6）；等价断言 = 渲染输出等价非 template-contract.json 文件字节（reviews 块迁出 = 预期结构变更）。

### Task 6: 收敛接线 S1/S4/S5/S6（detect / CLI --type / resolveTargetDoc / next-step）

- **Do**: S1——`docKindOf`（`src/rules/documents.ts:798`）**删除**：判定改经 `docTypeRegistry.all()` 按序迭代 `detect(fileName, content)`（overall→plan→spec 判定序）；`validateDispatchDocuments`/`parentOverallOf` 内部改经注册表 + `resolve(kind).parentChain`
  - S4——CLI review/fix `--type` 路由（`src/cli/review.ts:103,140,253` + `fix.ts` 同形）：spec/plan 面改经 `docTypeRegistry.resolve(type).lifecycle(entry, ctx)`（型特定生命周期处理）；task/branch 面保持现路由（非 doc-type，不纳入注册表）
  - S5——`resolveTargetDoc`（`src/cli/shared.ts:62-74`）：spec/plan 参数取回改经 `docType.route` 元数据（`argKey` `spec`/`plan`）
  - S6——NextStep 建议表（`src/rules/next-step.ts:158,220-257`）：`#targetArg`（`--spec`/`--plan`）+ 三路建议改经 `docType.route`（`targetFlag`）+ 注册表类型门
  - Tests：`cli/__tests__` + `rules/__tests__`（review/fix/next-step 面）全绿；detect 判定序测试（overall/plan/spec 正负例 + 二义显式报错——spec 2.6 不静默选型）；**A3 grep 实证**：S1/S4/S5/S6 面零 per-type 手写分支（`docKindOf` 零存在 · `opts.type === "spec"` 式散点归零，仅经注册表调度）
- **验收**: `docKindOf` 删除（grep 零命中）；detect 判定经 `docTypeRegistry`（overall→plan→spec 序 + 二义显式报错）；CLI review/fix `--type` spec/plan 面经 `resolve(type).lifecycle`（task/branch 现路由保持）；`resolveTargetDoc` / NextStep 建议表经 `DocType.route` 元数据；`cli`/`rules`/`next-step` 测试全绿；validate 全块绿（spike 展示：分支归零后 docs-review 行为与前一致）。
- **注**: task/branch 是派发类型非 doc type——不纳入 DocType 注册表（spec 调）；S2/S3/S7 已于 T2/T5 收敛，本任务闭合剩余 4 散点即 A3「8 散点全口径」收敛完成（S8 归 T7）。

### Task 7: S8 tokens shape 域 + 死牵引 + 终验（A4 + changeset）

- **Do**: S8——`src/documents/tokens.ts` `deriveDocTokens`：live 派生语义保留（path 导航 `leaf()`/`nodeAt()`），源改经 `docTypeRegistry` 的 shape 域访问器（不再 `loadDocSchema` 重读配置面——三 schema 同构内容经 DocType.shape 取）；DOC_TOKENS 生产单例值不变；tokens.test live 测试保留（doctored shape → derived token 变化实证）+ 等价回归全绿
  - 死牵引清理：CLAUDE.md `packages/cdd-engine/src/documents/schema/skill-anatomy.json` 引用改指 `packages/cdd-engine/config/schema/skill-anatomy.json`；`tokens.ts` 陈旧注释（`src/documents/schema/` 指代）改指 `config/schema/`；`ex lib/…` 残留注释清理
  - 终验：`pnpm run validate` 全块全绿（emit fresh / kairos 树 + wiring / engine 测试 / residue + channel / marketplace / scripts unit / version sync）——A4 residue/lexicon guard 零回归；超纲线复查（add-phase-protocol / skill-anatomy 原样 + schema.test 绿 · P2/P3/P5 内容零越界 grep）
  - changeset：读 `.changeset/README.md` version scheme 判 bump 类型（cdd-engine 内部重构、字节等价、消费者零变更）→ 落 `.changeset/<slug>.md`
- **验收**: `deriveDocTokens` live 派生经 `DocType.shape` 域访问器承载（tokens.test 等价回归 + doctored-shape live 测试全绿）；DOC_TOKENS 值不变；死牵引零残留（grep `src/documents/schema/` 在 CLAUDE.md + src/ 注释面零命中 · `ex lib/` 残留清理）；`pnpm run validate` 全块全绿；changeset 已建（cdd-engine）。
- **注**: 终验是 A2/A4 的最终闸——任何 validate 块红 = 任务未闭合（带红不提交）；changeset bump 类型判定先读 `.changeset/README.md` 再判（0.x 下规则按 scheme）；本计划全 singleton 组——不落 `## Task Groups` 段（每 `### Task N:` 自带验收面独立派发）。