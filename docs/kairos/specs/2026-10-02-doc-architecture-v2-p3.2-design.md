# 文档架构方法论 v2 — P3.2 Design Spec（引擎全面剥壳复盘 · skills next-loop 折叠 · P3.1 T7 摘入）

- **Version**: v1.0 · 2026-10-07
- **Status**: Draft
- **Author**: [human] · Claude Opus 5（kairos:cdd-phase · 决策源 = kairos:cdd-design grilling 收敛）
- **Parent program**: [doc-architecture-v2-overall.md v1.20](docs/kairos/specs/2026-10-02-doc-architecture-v2-overall.md)
- **Depends on**: P3.1（Done · [p3.1-design v1.10](docs/kairos/specs/2026-10-02-doc-architecture-v2-p3.1-design.md) · [p3.1-plan v1.11](docs/kairos/plans/2026-10-02-doc-architecture-v2-p3.1.md) —— serial-phase GATE 满足，P3.2 可开线）

## Design

设计决策来自 cdd-design grilling 收敛（R2/R3 + 用户 2026-10-07「引擎全面重整瘦身，所有 OOP 契约复盘」拍板），四面向：(a) 引擎全面剥壳 + OOP 契约全量复盘（含 scripts/）· (b) skills 五链 next-loop 折叠重写 · (c) P3.1 T7 摘入 · (d) review-fix loop 节点锚定零残留。本 spec 为增量设计，parent overall 约定自动适用。

### 1. 引擎剥壳复盘：元素登记表「一声明」+ OOP 契约全量复盘

#### 1.1 元素登记表为根（一声明）

每 doc 类型（plan / phase-spec / overall）落地一份**声明式元素登记**（element registry）——平铺 typed 数据，每个元素一条声明：锚 token · presence · value pattern · ref kind · 归属面。该登记表**同时是规则判定数据与派生源**：九不变式解释器遍历登记表跑判定；shape/schema/slices/DOC_TOKENS 全由登记表投影（schema 派生链现状保留，schema 字节 pin 不变）。~955 行 shape 散文（`PHASE_SPEC_BODY_SHAPE` / `PLAN_BODY_SHAPE` / `OVERALL_SHAPE`）归位为结构化声明，散文堆清零、无第二数据家。

#### 1.2 edge 单家前移

structure 面 `plan.edge`（missing-edge）/ `plan.antiDependency`（selfBounded 反依赖）两条规则**退役删除**（plan-body.ts:408-430）；`TaskGraph.validate()` 成为缺边/反依赖**唯一定义**。doc-contract gate 在 plan parse 时**建 TaskGraph 跑 validate()**（lifecycle pre-flight 早拦），dispatch 侧 `effectiveGroups`/波次复用同一实例。structure 规则集 plan 9 → 7，连带调用点（rules/status · closeout · dispatch/base）收敛审计。

#### 1.3 referenceLint 独立 lint pass

referenceLint 全副机制（`REFERENCE_TOKEN_RE` · `owningFieldLine` · `stripCodeSpans` · `referenceNumbers` · `evaluateReferenceLint` · per-run 聚合）从解释器**迁出为独立 lint 模块**（doc-contract gate 上的独立 WARN pass）。十不变式 → **九**（referenceLint 出列），解释器 case 开关 10 → 9。`InvariantVerdict` 双通道 / `declared` 缓冲 / `CompiledSurface` / referenceSurface 专用机制删除（reference 词汇随一声明派生，lint 模块消费派生词汇而非自带）。WARN-only 语义保持（P3.1 引用 lint 口径不回退）；测试随之分裂（structure.test.ts 瘦身 + 独立 reference-lint 测试）。

#### 1.4 死壳清零 + 解释器瘦身（全平面）

`PlanBody.renderBrief`（零生产调用、仅测试消费）**删除**。全平面空壳/死壳零残留（退役符号 · 废弃夹具 · 空壳叶 · 未解析面 grep 断言，P3.1 Standing 铁律执行面延续）。**基线 → 复盘后**的 engine+scripts src 行数/类数/文件数净减账入验收（方向证据，无硬数字）。

#### 1.5 scripts/ 纳入 OOP 契约复盘（引擎为真相 scripts 消费）

共享合约单源化：`CommandLexiconData`（contract-lexicon.ts:117）→ **import 引擎 `CommandLexicon`**（word-table.ts:27）· `ANSI_RE`/`plain` 单份共享（注释式同步退役）· env-whitelist（contract-lexicon:859 vs residue:467 双派生）→ 单点 pin · `isPluginRoot`（marketplace.ts:51 与 lib:74 双写）合并。**契约 verdict 表**（run/runner/contract-lexicon/residue/harness-registry/marketplace-utils/emit 逐类 verdict：保留/吸收/合并/删除）作复盘清单入档。守卫保持单文件（审计面非产品面，不按 face 拆）；源码头程序史散文（T#/§ 溯源）剥离 → git / docs/maintainers，留一行职责；死壳删（`"dry-run"` InvocationKind · `noSkills` 参数 · version-sync 死注释，契约测试同步修）。`checkAnatomy` 保持全仓唯一 SKILL 解析器（Q6 判例：skill-anatomy 不进 engine doctype 工厂）。CLAUDE.md 路径引用修正（`src/infra/contract-lexicon.json` → `config/`）。

### 2. P3.1 T7 摘入：frontier + ExecutionState 查询面 + next 单点

#### 2.1 frontier(done) 动态面

`frontier(done): TaskBatch`——就绪 = 所有 `DependsOn ⊆ done` 的未完成 wave；与 P3.1 已落的 `batches()` 静态面合成 group-next 唯一实现（`next:` 组间 default：同环优先 ∧ closure 后转下一波）。

#### 2.2 ExecutionState 并入查询面

`doneTasks(): Set<number>` + `readyBatch()` **生为 TaskGraph / ProgressLedger 的查询方法**（P3.1 §2.6 原义「ProgressLedger → TaskGraph queryable」），**不新增独立 ExecutionState 类**（前提 6 重构整合 · OOP 契约不加座）。今日「done」面（StatusJudge.derivePlanVerdict().done）收敛进该查询面。

#### 2.3 nextStep 单点收敛

next 生成 **6+ 处**（dispatch/task `#nextArgs` · branch `#fixNextArgs` · cli/review · cli/fix · docs · result-face 等）逻辑**内聚进既有 `NextStepRouter`**（rules/next-step.ts C5 决策表增强），不新增第二 router 层。语义钉住：review 零 findings → `next: none | next-group` · fix 面 blocker>0 → `next: <review>`（新 ref）· warn/nit → `next: none`（闭合 · exit 0）· BLOCKED/TIMEOUT 无 next 行（`CDD_BLOCKED:` 拥有）。容量胶囊面（`next:` 站）随单点收敛保持字节稳定。

#### 2.4 skills 编排精简

五链消费 `next:` 单环路（配合 §3 折叠）；**编排语义门显式声明**——cdd-design mode/register/size · cdd-close finish 为人工决策面，digraph 不动（非 next 推荐域）。

### 3. skills 五链 next-loop 折叠重写

#### 3.1 五链 digraph 折叠为单 next-loop 自环

四 spec 链（cdd-spec/plan/phase/charter）折叠为：`run-*-session` → 前置一次性节点（backfill-design / read-schema+sync-overall）→ `author` → **`NEXT-LOOP` ⇄（自环）** → `commit` → `handoff-*`；cdd-dev 折叠为：`detect-engine` → `determine-base` → `set-base-branch` → **`NEXT-LOOP` ⇄（自环，覆盖 implement/review/fix/group/branch 面）** → `handoff-cdd-close`。**`next-loop` 为五链共享节点名**（同构同节点 · 同一 Node Definition）。自环边无条件；digraph 边**零状态标签**（不再出现 `-->|entered via CHANGES_REQUESTED|` 类自述路由边）。cdd-dev `more-groups?` 钻石退役；cdd-plan「dispatch-grouping adjudication」退役声明（已内化 Plan Sole Writer）。

#### 3.2 显式节点三类 + 纪律全数归 Invariants

折叠后 digraph 仅保留三类显式节点：**一次性动作**（author / backfill-design / read-schema / sync-overall）· **终端**（commit / handoff）· **编排语义门**（cdd-design mode/register/size · cdd-close finish）。Review Convergence（review-unskippable · 新 ref 即新 review · CLI 评审替代禁令）等纪律**全数归 Invariants 段**表述，digraph 与 Node Definitions 不载路由散文、不做状态→路由映射。

#### 3.3 一致断言 + 注册 + 零残留

digraph 节点名 ↔ Node Definitions heading ↔ 文本引用**一致断言**（checkAnatomy 承载，Q6 判例）。skill-anatomy 注册（共享 `next-loop` 节点名 · 4-section allowlist · nodeLimit/edgeLimit 余量随节点数下降增大）· 目录扫描守卫 · `pnpm run emit` 再生（.claude-plugin/.cursor-plugin/marketplace）· **零程序历史 grep pin**。review-fix loop 节点锚定零残留：digraph 边零状态标签 + fix 面 `next: none` = 闭合（与引擎 NextStepRouter 语义一致断言）+ Node Definitions 不载 review→fix→re-review 路由散文（grep pin）。

### 4. 消费面同步 + 测试验收

#### 4.1 消费面同步

三 schema JSON **字节 pin 不变**，但 description 与一声明派生源一致化；cdd-plan / cdd-dev SKILL 编作面（单边 `DependsOn` · 反依赖 · designItems · charter 秩）随引擎行为同步；shipped 消费面描述零程序历史（grep pin，P3.1 先例延续）。

#### 4.2 变化集 + 测试重 pin

engine vitest 重 pin：`structure.test.ts` 拆分（referenceLint 迁出）· 新增 `reference-lint` 独立测试 · `factory.test.ts` schema 字节 pin 保持 · tree-migration/dual-read 结构秩断言随九不变式更新 · P3.2 自身 plan 波次 self-pin。changesets：cdd-engine（破坏性按剥壳定级 major/minor）、kairos（skills 折叠 patch/minor）。终验：engine vitest 全绿 · `pnpm run validate` ALL PASS · typecheck ×3 · biome · emit 新鲜。

### Acceptance criteria

- 元素登记表一声明落地：plan/phase-spec/overall 三登记表存在（每元素含锚 presence value pattern ref kind 归属面）· shape/schema/slices/DOC_TOKENS 派生链投影字节 pin 全绿 · ~955 行 shape 散文（`PHASE_SPEC_BODY_SHAPE`/`PLAN_BODY_SHAPE`/`OVERALL_SHAPE`）归位零残留（grep）
- `plan.edge`/`plan.antiDependency` 源码/规则集零残留（grep 断言）· `TaskGraph.validate()` 为缺边/反依赖唯一定义 · doc-contract gate parse 建图早拦有断言（missing-edge/反依赖负例）
- `InvariantVerdict` / `declared` 缓冲 / `CompiledSurface` / referenceSurface 专用机制零残留 · 不变式词汇十→九（引擎 + 树套件断言更新）· 独立 reference-lint 模块 WARN-only 测试绿
- `PlanBody.renderBrief` 删除（零引用断言）· 全平面死壳/空壳 grep 零残留 · engine+scripts 基线→复盘后净减账记录入验收
- scripts：`CommandLexiconData` → import 引擎 `CommandLexicon` · `ANSI_RE`/`plain` 单份 · env-whitelist 单点 pin · `isPluginRoot` 合并（grep 断言）· `"dry-run"`/`noSkills`/死注释零残留 · 源码头程序史散文剥离（T#/§ 零残留）· CLAUDE.md 路径修正
- `frontier(done)` + `doneTasks()`/`readyBatch()` 查询面落地（不新增独立类）· next 生成 6+ 处 → `NextStepRouter` 单点收敛断言（语义表 + 负例：warn/nit→`next: none` · blocker>0→re-review · BLOCKED 无 next 行）· engine vitest 全绿
- 五链 digraph 折叠为单 `next-loop` 自环：digraph ↔ Node Definitions ↔ 文本引用一致断言绿 · `more-groups?`/`adjudication`/`entered via CHANGES_REQUESTED` 类残留零（grep）· digraph 边零状态标签 pin · skill-anatomy 注册 + 目录扫描守卫 + `pnpm run emit` 再生 + 零程序历史 pin
- 消费面同步（三 schema description · cdd-plan/cdd-dev 编作面 · 零程序历史）+ changesets（cdd-engine / kairos）+ `pnpm run validate` ALL PASS · typecheck ×3 · biome · emit 新鲜

## Constraints

- **元素登记表以 typed 数据落地**：一声明的登记表元素字段（锚 token · presence · value pattern · ref kind · 归属面）为数据声明，不新增长散文节（整体「不新增无限增生的散文面」的延续）
- **OOP 契约复盘判据 = 剥壳准则**：每契约「存在理由 = 不可约职责」；单一次性接口 / DTO-only 类 / 对称性基类 → 扁平、合并或删；Criterion ②（类 + 构造注入）保留
- **新增抽象与复盘后抽象同标准**：T7 面（frontier/ExecutionState 查询面/next 单点）落在复盘后的统一抽象上，不新增壳、不新增裸函数（v1.16「与剥壳重构同事务」原义）
- **scripts 守卫不按 face 拆分**：residue/contract-lexicon 保持单文件（审计面非产品面），内部方法簇内聚为准
- **净减账为方向证据**：无硬性减量数字；基线 → 复盘后净变化记录 + validate 全绿为账