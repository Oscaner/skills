# Doc Architecture v2 P1 — DocType 抽象 + schema 工厂（Doc Architecture v2 P1: DocType Abstraction + Schema Factory）— Phase Spec

- **Version**: v1.1 · 2026-10-04（v1.0 起草；**v1.1 spec-review r1 fix 全落地（warn ×5 + nit ×2）**：`lifecycle` 抽象成员钉 S4 · shape 域 = 产物同构完整内容 → SchemaFactory 字节保真确定性投影 · S8 收敛断言入 A3 · D6 未注册锚统一改标 Q6 · route 移出五域子列表 · Q5(i) 子引用消去 · Section 1 补开线 GATE 指针）
- **Status**: Draft
- **Author**: [human] · Claude Opus 5 (1M context)（kairos:cdd-design → grilling → cdd-phase）
- **Parent program**: [2026-10-02-doc-architecture-v2-overall.md v1.2](2026-10-02-doc-architecture-v2-overall.md)
- **Depends on**: 无（program 起点）

## Section 0: Incremental warning

本 spec 承诺恰好一个 phase（P1 DocType 抽象 + schema 工厂）。若实施中发现需要拆分 / 重排 P1 的工作，不是本文件的局部编辑——phase inventory 行、依赖边、change-history 行必须先回填 parent overall（backfill-as-version）再继续。P1 之后的 phase（P2 文档平面瘦身 / P3 TaskGraph / P4 cdd-doc-review / P5 DispatchContract / P6 宪法与档案分层）各归其 spec；本 phase 只打五域形状接缝（Q3），下游内容（refKind 四型 / bodyView 分型 / InstructionUnit 结构化）由 P2/P3/P5 填，不越界实现。

## Section 1: Constraints pointer

跨 phase 约定以 parent overall v1.2 为准（overall wins on conflict），本 phase 不重复表述，仅指针：
- **破坏性变更授权 + 空壳死代码即删（overall Constraints，2026-10-02 用户拍板）**：允许重写代码 / 重组目录；空壳、死代码、已废面即删不留残壳
- **Criterion ②（零裸函数）延续**：所有新抽象以类 + 构造注入落地；本 phase 的收敛落点 = DocumentsValidator 等模块中 per-type 私有裸函数收编为 DocType 子类实例方法
- **对象 word = ref word（DocContract 同契约面）**：doc 身份、ref 身份、技能引用、正文视图同一契约面，零手写重复映射
- **尽量复用上游规则（fit 判定）**：本 phase 收编的是文档内容组织平面，非上游方法论平面；不引上游 skill
- **消费者链渐进兼容 + 历史零 retro-rename**：schema 产物路径零迁移（`config/schema/` 原位），消费者（`deriveDocTokens` / `cdd schema get` / `DocumentValidator` 审计 / scripts `ContractLexiconGuard`）零回归
- 方法论文档 = 中文（Strategy B）；消费面 skill 文本 = 英文主源（Strategy A）——本 phase 产出全部为引擎内部面，无消费面文本
- 开发期引擎直调 `node packages/cdd-engine/src/bin.ts`（零构建 dev face）；changeset/commit 纪律不因本 phase 变更
- **开线 GATE（overall Boundary rules）**：本整体批准 ≠ P1 已启动——pi-harness P5 必须先 closeout、任一 phase 才能开线，P1 启动即该 GATE 生效点（「Depends on: 无」仅指 phase 依赖结构，非即刻可启动）

## Section 2: Design body

#### 2.1 目标与范围

P1 把 doc-type 处理面的「三平面异构 + per-type 分支散点」归零为一个 DocType 对象模型 + schema 工厂：doc-structure schema（`config/schema/{phase-spec,plan,overall}.json`）、lexicon engine 翼（`config/contract-lexicon.json`）、template-contract 分型面（`config/template-contract.json` 的 `reviews.spec/plan` + `DOCS_FORMATS` 判别）收编为 DocType 五域字段；engine 面 per-type 手写分支收敛为 DocType 实例方法。

**范围**：五域 DocType 框架（abstract 基类 + 三子类）· SchemaFactory（shape 域 → schema 产物确定性派生）· 三平面收编 · per-type 分支收敛清单（8 散点 + DocumentsValidator per-type 私有裸函数）· 死牵引清理。

**范围外（超纲线）**：P2 样板 schema 化 / plan Task=数据不动；P3 TaskGraph 不实现（空间仅限 seam）；P5 DispatchContract / DispatchPacket / InstructionUnit 正文 / refKind 四型内容不实现；add-phase-protocol / skill-anatomy 不入工厂、不删（Q6，留手写 JSON + schema.test 校验）；scripts 侧 guard 词表（`scripts/lib/guard-lexicon.json`）与 `ContractLexiconGuard` 不动。

#### 2.2 锚点图例

Q/R = grilling 定案轮次锚点（Q1–Q6 对应本会话六个前沿轮次裁决）；锚点仅供本 spec 内部溯源：

| 锚点 | 定案内容 |
|---|---|
| Q1 | **等价验收硬度**：schema-diff 钉测试（工厂渲染产物 vs 回填前 schema 字节断言）「先钉后退役」——P2 迁移启动时退役该测试 |
| Q2 | **派生落库**：schema 工厂派生产物 commit 入库 + 防漂移守卫（diff 钉测试即守卫；validate 全绿含新面） |
| Q3 | **演进接缝**：refKind / bodyView / instructions 域在 P1 落「字段存在 + 类型接口」形状接缝，内容 P2/P3/P5 填；五域字段现时存在，下游扩展不破壳 |
| Q4 | **类层次**：`abstract DocType` 基类 + `PhaseSpecDocType / PlanDocType / OverallDocType` 三子类（多态承载各型 validate/parse/route） |
| Q5 | **收编映射**：doc-structure schema → `shape` 域 · lexicon engine 翼 → `words` 域 · template-contract 分型面（reviews.spec/plan + DOCS_FORMATS）→ bodyView/review 面；shell/tokens/clauses 留渲染数据面；guard 翼不动 |
| Q6 | **工厂覆盖**：三活动型（phase-spec/plan/overall）入厂；add-phase-protocol/skill-anatomy 非 doc 结构留手写 JSON（overall v1.2 登记） |

#### 2.3 现状与收敛面（A3 归零清单）

per-type 手写分支持平（agent 实测锚点，收敛对象）：

| # | 散点 | 位置 | 收敛方向 |
|---|---|---|---|
| S1 | `docKindOf` 嗅探（plan/spec/overall 三判） | `src/rules/documents.ts:798` | `DocType.detect` 实例方法（filename + 内容特征，各子类实现） |
| S2 | `validateDispatchDocuments` 入口分发 | `src/rules/documents.ts:1576-1594` | 注册表 `resolve(kind).validate` |
| S3 | `parentOverallOf` 链走 | `src/rules/documents.ts:1561-1567` | 注册表 `resolve(kind).parentChain(path)` |
| S4 | CLI review/fix `--type` 路由 | `src/cli/review.ts:103,140,253` + `fix.ts` 同形 | 注册表 `resolve(type).lifecycle`（C1 公共骨架定义，型特定生命周期面；`route` 元数据供 `--type` 名） |
| S5 | `resolveTargetDoc` | `src/cli/shared.ts:62-74` | `DocType.route`（spec→`opt.spec` / plan→`opt.plan` 字段归类型元数据） |
| S6 | NextStep 建议表（targetArg + 三路） | `src/rules/next-step.ts:158,220-257` | `DocType.route` 元数据（`--spec`/`--plan` 标志 + 后续建议表） |
| S7 | render 家判别 | `src/render/templates.ts:91,271-275` | `DocType.bodyView` 分型面（DOCS_FORMATS 判别迁入衍生） |
| S8 | tokens 派生 | `src/documents/tokens.ts` `deriveDocTokens` | `DocType.shape` 域访问器（path 导航 live 派生语义保留） |

另：`DocumentsValidator`（`src/rules/documents.ts:1114`）stateless 类 + ~40 私有裸函数——per-type 者（`fourTableAudit` / `resolveParentOverall` / `resolveSpecFromPlan` / plan/overall 契约助手）收编进对应子类实例方法；跨型通用者对留（如 `leaf()`/`nodeAt()` 路径导航助手归 shape 域工具）。

**既有健康面（不拆不改，维持）**：`src/documents/schema.ts`（逻辑名定位器 + 惰性缓存读取）、`infra/resource.ts`（单一路径定位真源）、`cdd schema get` CLI（type gate + raw bytes）。`src/lib/` 已退休（注释残留 `ex lib/…` = 死牵引）。

#### 2.4 DocType 框架

**C1 `abstract class DocType`**（`src/documents/doctype.ts`，类 + 构造注入）——五域为一身，本 phase 自持契约：

- **五域字段（shape / words / instructions / refKind / bodyView）**：
  - `shape`：该型 doc 结构的完整 schema 内容——现 `config/schema/{phase-spec,plan,overall}.json` facets 收编为与产出 JSON Schema **同构**的结构化字段（全部约束/描述覆盖，零抽象损耗，形状以原值落位）——SchemaFactory 以此为源做**字节保真确定性投影**渲染产物（Q2/Q6；key 序 + 格式 = 唯一自由度，diff 钉测试断言）
  - `words`：engine lexicon 翼词表（vocab / capsule tokens / route stations，`config/contract-lexicon.json` 内容收编为单字段）——词表单源进 DocType（Q5）
  - `instructions`：**接缝**——InstructionUnit（B1）前瞻类型接口，内容 P5 填（Q3）
  - `refKind`：**接缝**——doc-revision 身份判别槽（R2 类型接口占位），四型内容 P5 填（Q3）
  - `bodyView`：**接缝 + 分型面**——body 形态（spec/plan/…）判别接口 + template-contract `reviews.{spec,plan}`（axesGuide/lens）+ `DOCS_FORMATS` 判别迁入（Q5/R3）
- **route 路由元数据面**（独立于五域字段，S4/S5/S6 收敛载体）：CLI/建议表路由元数据（`--spec`/`--plan` 标志、`--type` 名、next-step 后续掩码）
- **公共骨架**：`detect(fileName, content): boolean`（各子类判定特征）+ `parentChain(entry, root)`（S3）+ `lifecycle(entry, ctx)`（review/fix `--type` 路由的型特定生命周期处理，S4 落点）+ `validate(entry, ctx)` 与 `parse(entry, ctx)` 抽象面
- **生命周期**：实例构造即「三 doc type 以 DocType 实例落地」（A1）

**C2 三子类**（每型自持散点逻辑内聚）：

- `PhaseSpecDocType`：detect = `*-design.md` 命名 + `**Version**` 契约特征；validate = 现 `validatePhaseSpecContract`（Version STRICTLY 行 + Class-B Parent program → 父 overall 四表）；per-type 私有裸函数（resolveParentOverall 相关）收编
- `PlanDocType`：detect = `### Task N:` 连续标题特征；validate = 现 `validatePlanContract`（任务连续性 / `**Spec:**` Class-A 解析 / Form A|B 约束可提取 / 无 `{{…}}` 占位符）；TaskGraph/`## Task Groups` 面为 P3 接缝，P1 不动
- `OverallDocType`：detect = `*-overall.md` 命名 + 四表特征；validate = 现 `validateOverallContract`（kernel 行形 + 版本 lineage）+ `fourTableAudit`（face ①-⑥）；`parseOverall` 收编为实例 parse

**C3 `DocTypeRegistry`**（`src/documents/registry.ts`）——三实例注册表：`resolve(kind)` 未知即 throw（S2/S4 调度入口，fail-fast）；迭代序固定（工厂派生 / 审计遍历的确定性面）；模块导出面仅类 + 单例，无裸函数。

**C4 `SchemaFactory`**（`src/documents/factory.ts`）——遍历注册表三实例，将 `shape` 域（与产物同构的完整内容，零抽象损耗）**确定性投影**为 JSON Schema 产物：落 `config/schema/{phase-spec,plan,overall}.json` **原位**（路径零迁移）；字节保真（key 序 + 格式与现状字节一致，diff 钉测试断言）；闭包 = 三活动型（Q6 显式列守）。

**C5 words 面防循环**——words 收编后，`config/contract-lexicon.json` 转为**派生产物**（`DocType.words` → 渲染，字节等价）；`infra/word-table.ts`（WordTable）**消费路径不变**（仍读 `config/contract-lexicon.json`，构造时 Ajv 自校验）→ infra↔documents 零反向依赖、guard 零回归（A4）。

**C6 template-contract 分型面**——`reviews.{spec,plan}`（axesGuide/lens）+ `DOCS_FORMATS` 判别迁入 `DocType.bodyView`；`config/template-contract.json` 保留 shell/tokens/clauses/round-context（流程 prompt 面，与 doc type 正交，收编它 = 增生抽象）；`TemplateLoader` per-type review 配置改经 `DocType` 读取——**渲染输出等价**（templates 测试全绿为等价断言，非文件字节 diff；template-contract.json reviews 块迁出 = 预期结构变更，Q5）。

#### 2.5 数据流（三收编路径 + 消费面）

```
shape 源(五域字段) ---> SchemaFactory ---> config/schema/{phase-spec,plan,overall}.json（派生·入库·diff 钉守卫）
                                              └── 消费者零回归：deriveDocTokens(路径导航) / cdd schema get / DocumentsValidator 审计 / scripts ContractLexiconGuard（skill-anatomy 不在工厂面，读原文件）
words 源(DocType.words) ---> 渲染 ---> config/contract-lexicon.json（派生·字节等价）
                                              └── WordTable(infra) 原路径消费（Ajv 自校验不变）
分型面(DocType.bodyView) ---> TemplateLoader per-type review 配置（渲染输出等价，templates 测试绿）
```

#### 2.6 错误处理

- 注册表 `resolve(kind)` 未知 → throw（emit/review 时即 fail，不留静默分支）
- 工厂渲染与回填前 schema 偏离 → diff 钉测试 fail（等价断言即守卫，block 0 拦截）
- `detect` 多型命中（命名/内容交叠）→ 判定序固定（overall → plan → phase-spec）+ 二义显式报错，不静默选型
- 消费者路径零变更 → 无新增错误面；既有 invariants/exit 纪律不变

#### 2.7 测试

- **diff 钉测试**：`SchemaFactory` 渲染产物 vs 回填前 `config/schema/{phase-spec,plan,overall}.json` 字节断言 ×3（Q1「先钉」面；P2 迁移启动退役）
- **words 等价**：`DocType.words` 渲染 vs `config/contract-lexicon.json` 字节断言
- **渲染等价**：templates 测试全绿（分型面迁入后 per-type review 配置仍注入等价）
- **回归**：`schema.test` / `tokens.test` / `rules/__tests__`（contract/documents）全绿——documents/ 层语义不变 + A2 validate 全绿
- **A3 归零实证**：grep 断言散点 S1–S7 面零 per-type 手写分支（经注册表调度）；子类实例方法替代（DocumentsValidator per-type 私有裸函数）；S8 = `deriveDocTokens` live 派生语义经 `DocType.shape` 域访问器承载——散点 S1–S8 全口径收敛断言（tokens.test 等价回归全绿）
- **A4**：residue / lexicon guard 零回归（validate 全块）

### Acceptance criteria

- `src/documents/` 交付：`abstract DocType`（五域字段 + route + 抽象 validate/parse + detect 骨架）+ `PhaseSpecDocType`/`PlanDocType`/`OverallDocType` 三子类 + `DocTypeRegistry`（三实例可构造 · `resolve` 未知即 throw）+ `SchemaFactory`（A1 落地）
- A3 收敛（8 散点全口径）：散点 S1–S7 面（docKindOf / validateDispatchDocuments 入口 / parentOverallOf 链 / CLI review+fix `--type` / resolveTargetDoc / next-step 建议表 / render 家判别）**零 per-type 手写分支**——grep 实证仅经注册表调度；DocumentsValidator 中 per-type 私有裸函数收编为子类实例方法（Criterion ② 类面无裸函数）；S8 = `deriveDocTokens` live 派生语义经 `DocType.shape` 域访问器承载（path 导航保留，tokens.test 等价回归全绿）
- `SchemaFactory` 渲染产物与回填前 `config/schema/{phase-spec,plan,overall}.json` **字节一致**（diff 钉测试 ×3 全绿）
- `config/contract-lexicon.json` 派生等价（字节断言绿）；`infra/word-table.ts` 零改动、WordTable 构造自校验仍绿
- template-contract 分型面迁入后 `TemplateLoader` 渲染输出等价（templates 测试全绿）；`config/template-contract.json` reviews 块迁出、shell/tokens/clauses 保留
- `pnpm run validate` 全块全绿（新守卫在内）；residue/lexicon guard 零回归（A4）
- 死牵引零残留：CLAUDE.md 与 `src/documents/tokens.ts` 注释引 `config/schema/`（零 `src/documents/schema/` 引用）；`ex lib/` 残留注释清理
- 超纲线零越界：add-phase-protocol / skill-anatomy 手写 JSON 原样保留 + schema.test 全绿（Q6 显式列守）；P2/P3/P5 内容（样板 / TaskGraph / DispatchContract 正文）零实现

## Section 3: Deviations from overall

| Overall assumption | Phase decision | Overall updated? |
|---|---|---|
| overall v1.1 P1「doc-structure schemas 以 schema 工厂原子化派生」（术语字面可读作 `DOC_SCHEMA_NAMES` 全五型入厂） | 语义收窄 = 三类书面 artifact 形状（phase-spec/plan/overall）入厂；add-phase-protocol（注册协议，P6 宪法层关注）/ skill-anatomy（kairos skill 文法注册表，消费面 scripts `ContractLexiconGuard`）非 doc 结构，留手写 JSON + schema.test 校验（对齐 A1「三 doc type 实例」） | Yes — v1.2 · 2026-10-04 |

无未回填偏差——其余 grilling 定案（Q1–Q5）为 P1 内部落形（等价硬度 / 落库 / 接缝 / 类层次 / 收编粒度），随本 spec 生效，不涉跨 phase 约定。

## Section 4: Notes for downstream

- **P2（文档平面瘦身）**：phase-spec 样板 schema 化 / plan Task=数据 的目标 schema = P1 工厂产物——修改走「先改 `DocType.shape` 描述 → 再工厂派生」链路；diff 钉测试在 P2 首个 schema 变更时退役（Q1「后退役」面，退役登记回填 P2 spec）
- **P3（TaskGraph 分组派生）**：依赖图 P1→P3——PlanDocType 的 `## Task Groups` / task 边模型在 P1 只留 shape 面（现 `plan.json` facets 承载），P3 填分组派生逻辑不破壳
- **P5（DispatchContract）**：refKind 四型内容 / DispatchPacket 正文（InstructionUnit·bodyView 分型）落 P1 的 instructions/refKind/bodyView 接缝槽（Q3）——P5 填槽不破壳；harness-contract dispatch 域重构与 P1 无接
- **P6（overall 宪法/档案分层）**：add-phase-protocol 归属 P6 宪法层关注（Q6 语义下保持手写 JSON 直至 P6 重组）；archive doc-revision ref 依赖 DocType refKind 接缝——P6 读 seam 不写壳
- **派生面纪律**：`config/schema/{phase-spec,plan,overall}.json` 与 `config/contract-lexicon.json` 自 P1 起为**派生产物**——任何手写编辑 = 下一工厂/守卫覆盖；改描述走 `DocType.shape/.words`（docs/maintainers/01-template-doctrine 模板数据化公约同源）

## Section 5: Review

Fresh-subagent review passes on the committed baseline, then user review, then writing-plans. Review Convergence（I1）：blocker > 0 → fix 全 findings 后 re-review；blocker = 0 → fix 全 findings → done（不再 re-review）。Entry 前树必须 clean（engine entry gate）。
