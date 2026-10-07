# 文档架构方法论 v2 — P3.2 Design Spec v1.4（全系统从零重建 · 判定单家 · 工作流归一）

- **Version**: v1.4 · 2026-10-07（前置 v1.3 = P7 提前承接 backfill——翻译系统全量核心入 §1.3 · CLI 命令面 `base-branch`→`base` · capsule 机面英文恒定 · 渲染器归位 render；**v1.4 = P4/P5/P6/P7 全吸收 + 数据面归位 backfill**——用户 2026-10-07 拍板「config-next 完成以后删除 config」升华：**数据面归位**（三稳态 JSON → typed 平面 infra/runtime · face/host · render/templates · P4 review 准则/P5 M1+禁文 承接净入 §6.4 · skill-anatomy 归守卫 T14 · `config/` 整目录随 cutover 删除零重建 · 新树零 JSON/零 config/ 路径）· **P6 宪法化承接**（宪法/档案双层 · 版本行散文消解 · Standing rules 成典 · 全树 4 overalls）入 §6.5——plan v1.4 · overall v1.23 随）
- **Status**: Draft
- **Author**: [human] · Claude Opus 5（kairos:cdd-phase · 决策源 = kairos:cdd-design grilling 收敛 + 用户 2026-10-07 greenfield 拍板）
- **Parent program**: [doc-architecture-v2-overall.md v1.23](docs/kairos/specs/2026-10-02-doc-architecture-v2-overall.md)
- **Depends on**: P3.1（Done · [p3.1-design v1.10](docs/kairos/specs/2026-10-02-doc-architecture-v2-p3.1-design.md) · [p3.1-plan v1.11](docs/kairos/plans/2026-10-02-doc-architecture-v2-p3.1.md) —— serial-phase GATE 满足，P3.2 可开线）

## Design

用户 2026-10-07 拍板：**可完全不用在意兼容现有代码；可在新目录从零写、随后删除现有代码；方法论/体系已清晰，零老版本兼容义务，只要求最佳实践**。P3.2 从「引擎剥壳 + 五链重写」升为**全系统从零重建**：以既定架构（三大职责 + 两服务 = 5 平面拓扑 + 单一数据真相 + next: 单环路）为目标架构，在并行新平面建齐 → 入口切换 → 删除旧树 → validate 全绿。绿色构建不背负旧补丁层、旧目录形状、旧技能重复体。

### 1. 数据面：元素登记表 = 唯一声明源

#### 1.1 三 doc 类型登记表

每 doc 类型（overall / plan / phase-spec）新建 typed **元素登记表**（element registry）：平铺声明数据，每个元素一条（锚 token · presence · value pattern · ref kind · 归属面）。登记表 = 规则判定数据 + 派生源单一真相；~955 行 shape 散文不继承（新树直接以声明数据起建），五表达面（shape/schema/slices/reference/tokens）全部成为登记表投影，schema 派生字节 pin 从新树首版即钉。

#### 1.2 词汇单源

doc 结构词（DOC_TOKENS 面）+ 胶囊词（`status`/`next:`/`CDD_BLOCKED:` 站）+ 守卫词（residue/escape/gate ban 词）并入**单一词汇表**（一词表一派生链），终结 lexicon 五家（words.ts → contract-lexicon.json → schema shape → word-table.ts accessor → guard-lexicon.json）的分散面。词表 English-primary，词汇面稳态（此非兼容义务，而是消费词面本来就是方法论机器面）。

#### 1.3 翻译层（P7 提前承接 · 用户 2026-10-07「langs 升级为翻译系统，P7 提前」）

单词表加 **locale 面**（每条词挂 `{ en: 规范型, zh?: 中文别名 }`——doc 结构锚 · capsule 站词 · 守卫 ban 词 · issue body 段标签同一张表）+ 单一**双向翻译层 `Translator`**（词表驱动 · 零裸函数 · 零 switch 分发）：`normalize(输入) → 规范 token`（中文别名 ↔ 英文规范型双向识别 · doc parse/判定消费）· `localize(token, locale) → 输出词`（人类可读渲染面——issue body/brief/模板——locale-normalized 消费）。**`langs` 投影派生**：`["en","zh"]` 硬编码归零，语言键集 = 词表 locale 键集投影，校验 = 投影包含。

- **P7 原「doc 结构 token English-primary 化」两半处理**：转换半（旧中文结构标记→英文）随 greenfield 旧树删除天然消解（新树首版锚即英文，零转换工作量）；识别半（中文别名↔英文规范型）由翻译层承接。**「legacy 中文标记保持可解析」随旧树删除消解**——双读/兼容层不进新树。
- **capsule 机器面英文恒定**：`status`/`next:`/`CDD_BLOCKED:` 是状态机消费的 token 非人类文本——不 locale 化；locale 面只服务人类可读面（issue body/brief/模板）。
- **渲染器归位**：`IssueBodyRenderer` 从 face/cli（组合根）移出 → **render/ 面**；`langs` 语言键 = 词表 locale 投影（零 `["en","zh"]` 硬编码）；段标签数据表驱动。

### 2. 判定面：单一解释器 + 上下文缝不变式

#### 2.1 解释器为唯一判定器 + 策略类族（零裸函数）

新解释器 = 全部结构判定唯一入口（docContractValidate 单调用）。判定多态以**不变式策略类族**落地（`abstract class Invariant { evaluate(ctx): Finding[] }`；presence/uniqueness/domain/crosslink/order/continuity/residue/hollow/selfBounded + **file-existence / sibling-scan / cross-doc-chain / section-scoped-domain** 各成一类），`Contract.validate()` 是**协调器**——按登记表组配策略集运行，无手写 switch-case 判定分发。**零裸函数**：行为/判定/派生全为类成员，模块级导出仅类型/常量数据/类/组合根（旧 `runStructureRules` 函数解释器 + 游离 extract/compare helper 不复现）。上下文缝四不变式吸收旧 doctype 类上 ~485 行判定（fourTableAudit 280 · deviations 65 · Class-A/B 跨文档链 105 · effectiveGroups 边门 35 —— 四分量合计 485）。

#### 2.2 doctype 类瘦身为 parse+投影

overall/plan/phase-spec 的 DocType 类只留：parse（四表/任务块/骨架抽取）+ 派生投影（登记表派生链消费点）+ 跨文档链根（Class-A/B 解析留给上下文缝规则）。类上零判定方法、零手写结构断言。

#### 2.3 reference lint 独立面

reference 词汇随一声明派生；`referenceLint` 作为独立 WARN-only lint pass（非判决定义的一部分），在 dispatch 门面执行。`InvariantVerdict` 双通道 / `declared` 缓冲 / `CompiledSurface` 等旧壳机制不继承，greenfield 无此概念。

### 3. 编排面：TaskGraph + frontier + next 单点

#### 3.1 TaskGraph + 编排状态机

TaskGraph（六类 validate：missing-edge / duplicate / missing-id / self-loop / contradiction / cycle + `batches()` 波次 + 反依赖门）为执行序单家；`frontier(done)` 动态面 + `ExecutionState` 查询面（`doneTasks(): Set<number>` / `readyBatch()` 为 TaskGraph/ProgressLedger 方法，不新增独立类）。缺边/反依赖唯一家在 TaskGraph，doc-contract gate parse 建图早拦、dispatch 复用同一实例。

#### 3.2 NextStepRouter 单点

`next:` 生成收敛为 `NextStepRouter` 单点（C5 决策表）。语义钉死：review 零 findings → `next: none | next-group` · fix 面 blocker>0 → `next: <review>`（新 ref）· warn/nit → `next: none`（闭合 · exit 0 · 无 APPROVED 强制重审）· BLOCKED/TIMEOUT 无 next 行（`CDD_BLOCKED:` 拥有）。胶囊单面（`status · blocker · handoff · next:`）稳态。

#### 3.3 dispatch 三 lifecycle 合一

task/branch/docs 三个 near-同构 lifecycle（旧 3.6k 行）收敛为**参数化单 lifecycle**（目标类型 task|branch|spec|plan 数据表驱动：review/fix/implement 流程同构，差异 = 审计目标/产物面/next 语义参数）。CLI 子命令面（implement / review / fix / schema / issue / base——`base set|get` 承 `base-branch set|get`，用户 2026-10-07 拍板收敛）保持。

### 4. 编排面（技能）：工作流归一

#### 4.1 技能集合 8 → 6

| skill | 角色 | 说明 |
|---|---|---|
| cdd-design | 编排 | brainstorm 路由（mode/register/size 语义门显式）· 内部 run-cdd-charter · sync / run-cdd-charter 两 charter 节点 + run-cdd-spec / run-cdd-phase 两近同 dispatch 节点收敛为参数化单模板 |
| **cdd-spec-writer** | spec-writer | **single / phase-spec / overall 合一参数化**流（schema 目标 + scope-gates + author + handoff 参数）——旧 cdd-spec/phase/charter 三文件并入，重复体（review-loop 子图 · fix-spec 逐字节相同 · Invariants 表）单源 |
| cdd-plan | 编排 | plan writer（backfill-design 门 · Plan Sole Writer）· review loop 接入共享 spec-writer 循环体 |
| cdd-dev | 执行链 | implement/review/fix 三态 + branch 终面；全由 next: 驱动；`more-groups?` 退役 |
| cdd-close | 编排 | 分支收尾（upstream finish flow + 4 选项门）· 终面 = finish 编排语义门 + 终端（人工决策面，非 next 驱动 · 无 review 自环）· typed-discard 门不变 |
| cdd-report | 工具 | 聚合 issue 上报（gh CLI · dedup · 确认门）· 独立无重叠 · 一次性上报链路（无 NEXT-LOOP 自环）|

#### 4.2 全链 digraph = 执行节点 + 单 next-loop 自环

五链 digraph（cdd-design / cdd-spec-writer / cdd-plan / cdd-dev / cdd-close）统一骨架为：一次性动作节点 + `NEXT-LOOP` ⇄（自环，`next:` 单条件派发）+ 终端（commit/handoff）——`NEXT-LOOP` 自环覆盖 review→fix 循环链（cdd-design 编排回收 · cdd-spec-writer · cdd-plan · cdd-dev 三态），**cdd-close 止于 finish 编排语义门 + 终端、cdd-report 为一次性上报工具链（均无自环）**；digraph 边**零状态标签**。显式节点三类：一次性动作 / 终端 / 编排语义门（design mode/register/size · close finish——人工决策面，非 next 驱动）。Review Convergence（review-unskippable · 新 ref 即新 review · CLI 评审替代禁令）等纪律全数归 Invariants 段，digraph 与 Node Definitions 零路由自述；**digraph 节点名 ↔ Node Definitions heading ↔ 文本引用一致断言钉住（多链共享节点名不漂移）**。上游 import 面保持（superpowers:brainstorming / writing-plans / finishing-a-development-branch / mattpocock-skills:grilling，M 组 fit 映射不动）。

### 5. 工具链（scripts/）：守卫消费引擎元数据

#### 5.1 守卫单源

scripts 全重写：guard **consumes engine metadata**（通道审计 / 词汇面 / 结构断言全部走引擎导出或词表单源派生），并行正则世界关闭。residue 词 ban 表（STALE/GATE）→ 词表单源数据行；channel-audit 字面（env/argv/解析文件名）→ 引擎导出。checkAnatomy 语义**保留**（技能结构契约 = 方法论机器化，Q6 判例），实现随技能 6 集重写；**skill-anatomy 契约随守卫归位引擎契约面**（v1.4：`config/schema/skill-anatomy.json` → typed 导出 · guard 消费导出非 JSON 路径 · config 旧址随 T15 cutover 删除）——守卫的数据/契约消费 = 引擎导出，零 JSON 路径。

#### 5.2 emit/validate 单一编排

emit 四碎（all/check/compare 面）+ 双 Orchestrator → 单一 emit 编排器；5 个 16-45 行 validate 薄 wrapper 折叠进 runner 数据表；清单/版本同步/pi-package 校验随 6 集技能重写（EXPECTED 计数等旧 pin 删除，换新断言）。

### 6. 两代过渡与交付

#### 6.1 目录拓扑（同包并行 + 5 职责平面）

**过渡放置**：新引擎建于 `packages/cdd-engine/src-next/`（**同包并行**——包名/README/workspace 依赖零 churn，优于新包 `cdd-engine-next` 的包级 churn：改名/依赖换向/README mirror 政策/emit 发现面重排）；工具链同构 `scripts-next/` → cutover 后 `scripts-next` → `scripts`；技能 8→6 在 cutover 点于 `packages/kairos/skills/` 原子 swap（6 文件级 swap + emit 再生，无需并行目录）。

```
packages/cdd-engine/src-next/
  bin.ts                      # CLI 入口（薄）
  contract/                   # 文档契约 = 一份数据的四种消费
    declare.ts                #   三 doc 类型元素登记表（typed 声明数据）
    project.ts                #   派生投影（shape · schema · slices · tokens · reference 五面）
    judge.ts                  #   Contract.validate() 协调器 + 不变式策略类族
    lint.ts                   #   reference lint（WARN pass）
  session/                    # 会话机 = 状态机 + 账本
    graph.ts                  #   TaskGraph（边 · 波次 · 反依赖）
    state.ts                  #   frontier + ExecutionState 查询面
    next.ts                   #   NextStepRouter 单点
    run.ts                    #   参数化单 lifecycle（task/branch/spec/plan faces 数据表）
    ledger.ts                 #   progress · handoff · crash · round（一会话一账本）
  face/                       # 操作面 = 词表 + 胶囊 + 命令
    words.ts                  #   词汇表单源（doc 词 + 胶囊词 + 守卫词 一家）
    capsule.ts                #   status · blocker · handoff · next 单胶囊面
    cli.ts                    #   implement · review · fix · schema · issue · base（base set|get）
    host.ts                   #   harness-contract typed 面（dispatch.review 行 · P4 评审准则数据）
  render/                     # templates + brief（活则留）
  infra/                      # 真基建（runtime（config 面 · 前 resource.ts）· git · process · workspace，≤5 文件）
```

**新旧零依赖（硬规则）**：新树自包含——`src-next/**` 零 import 旧树（双向：旧树亦零 import 新树；grep 断言钉死），新树连基建（infra/）、词表（face/words）、派生（contract/project）全部**重新实现**，不借用任何旧符号/旧分组/旧 helper；**数据面归位（v1.4 承接）**——外部契约 JSON（engine-config / harness-contract / template-contract）**不作为外部文件读取**，收敛为新树 **typed 平面成员**（`infra/runtime.ts` · `face/host.ts` · `render/templates.ts` · §6.4），新树零 JSON 读取、零读旧 `config/` 路径（grep 断言）——「按同址读取」旧妥协取消（引擎外零外部 JSON 消费者：仅本 repo 自有 kairos tests + 将删旧 scripts，全由 P3.2 接管）；schema / lexicon / tokens 等**派生产物由新树自派生**——并行期新树测试只用自派生数据，不读旧派生产物。两树共存的唯一共同物 = 方法论本身（消费规范与词面土层），代码级互为透明。

组织原则从「按文件类型归档」（旧 cli/dispatch/artifacts/documents/domain/rules/render/infra 八目录 + bin.ts 入口面——doctypes/body 为 documents/ 下的嵌套层，非顶面）改为「按职责语义聚合」：**contract / session / face 三大职责 + render/infra 两服务**。跨面碎片归位——胶囊散在 rules/result-face+next-step、词表散在 documents/words+infra/word-table、账本散在 artifacts/×9 → 各归其家。文件数 **72 → ~30-38**，顶平面 **8 → 5**。

#### 6.2 过渡纪律

新平面（新目录/新文件）**并行建齐** → 引擎 vitest 全绿 → 入口切换（package.json/bin imports 指向新树）→ **旧树/旧技能文件删除** → `pnpm run validate` ALL PASS · typecheck ×3 · biome · emit 新鲜。两代并存期以「新树全绿前旧树不删」为唯一闸（best practice：并行可回退，切完即删）。

#### 6.3 净减与验收账

生产面基线 ≈ 29k 行（engine 18.7k · scripts 7.0k · kairos 0.84k · config 2.5k）→ 目标 **−20% 内左右**（工作流重复体 + 双判定面 + 五家词表 + 三 lifecycle 合一的最大来源）；净减行为入验收；**数据面归位入净减账（v1.4）**——`config/` 整目录（13 文件 ~150K）随 cutover 删除零重建；旧树/旧符号/旧技能文件**零残留 grep**；消费面（capsule 词面 · 三真骨架 schema 语义 · cdd CLI 命令面）保持稳态。changesets cdd-engine major + kairos major · README 与消费面文档随 6 集重写。

#### 6.4 承接 P4/P5——数据面归位（v1.4）

P4（`cdd-doc-review` 一产化）/ P5（DispatchContract + DispatchPacket）**超前吸收**（用户 2026-10-07 拍板「都是一体的」）：两者在新机体中的形态 = **数据面内容**而非独立 phase——依赖图上原来 `P2→P4 · P3→P5 · P3.1→P5 · P4→P5（hard）` 全改 `P3.2 ->(承接)`，执行序后置 phase 移除。

- **P4 承接**：评审准则（URC spec/plan 三轴 · writing-plans 自检——spec 覆盖/占位扫/类型一致 · verification evidence）作为 **typed 数据**落 `face/host.ts`（dispatch.review 行）+ `render/templates.ts`（axesGuide），由 review 装配面引用；「kairos 第 9 席技能」前提随技能 6 集封闭集作废——准则归数据，评审归引擎装配
- **P5 承接**：DispatchPacket 概念被 capsule + handoff + 模板数据面**取代**（新树无 packet——提示词由模板面 + frame 值装配）；ref 机制由新 ledger + review ref（commit-range / doc_hash 双层）落地；残留三件 = **M1 supersede**（`dispatch.implement` tdd → `mattpocock-skills:implement` + `refs` 域登记）· **三处禁文删除**（review.task/branch note「parallel sub-agents forbidden」×2 + axesGuide「no parallel sub-agents」）· dispatch/refs 域收敛——全部为 typed 数据内容
- **数据面形态**：engine-config → `infra/runtime.ts`（contextContract · handoffNamespace · $version——failureCategories/slugRule 死字段剔除）· harness-contract → `face/host.ts` · template-contract → `render/templates.ts`；`resource.ts` 路径表/JSON 解析/`$schema`/`_doc` 散文面删除；新树零 JSON、零 `config/` 路径（grep）；**`config/` 整目录（13 文件 ~150K）随 cutover 删除零重建**；skill-anatomy 归 T14（引擎契约面 typed 导出）

#### 6.5 承接 P6——宪法/档案分层（v1.4）

P6（overall 宪法/档案分层）**吸收进 P3.2 尾部**（用户 2026-10-07 拍板「吸收进 P3.2 是明确的」）：新机制下 overall 结构 = **登记表行 + 投影**——宪法化 = 登记表行更新 + 文档迁移（零引擎结构代码）。依赖从 `P1→P6（hard）` 改为 `P3.2 ->(承接)`。

- overall 本体拆「**宪法**（Goal / Standing rules 规范化折叠 / Cross-cutting / Phase inventory / Dependency graph）+ **`*-archive.md`**（issue/history 结构化 record + doc-revision ref 机械化 backfill）」
- **版本行 lineage 散文消解** → 结构化修订记录（telescope 尾链断）；change-history 巨型 cell → 结构化 record
- **Standing rules「空壳、死代码即删」成典常态化**（P3.2 自身实证——T15 删旧树/旧数据面）
- archive 精确命名（v1.0「Archive 命名归 P6 定义」承诺通道）落地；全树 4 overalls 同口径迁移（内容逐字 · 容器改造 · 历史正文零 retro-rename）

### Acceptance criteria

- 三 doc 类型元素登记表存在（每元素含锚 token · presence · value pattern · ref kind · 归属面）；shape/schema/slices/tokens/reference 五表达面全由登记表派生，schema 字节 pin 自首版钉住；shape 散文面（~955 行散文体）零残留（grep）
- 词表单源（doc 词 + 胶囊词 + 守卫词 · 一词表一派生链）：旧 lexicon 五家（words.ts/json/shape/word-table/guard-lexicon 分家）零残留（grep 断言）
- 解释器 = 唯一判定器：上下文缝不变式（file-existence / sibling-scan / cross-doc-chain / section-scoped-domain）落地有负例断言；doctype 类零判定方法（类面 grep 判定符号零残留）；`InvariantVerdict`/`declared`/`CompiledSurface` 概念零残留
- 不变式 = 策略类族（`abstract Invariant.evaluate()` 多态 · `Contract.validate()` 协调器零 switch-case 判定分发断言）· 零裸函数（新树行为面 grep 裸函数零残留 —— 模块级导出仅类型/常量/类/组合根）
- TaskGraph + frontier + ExecutionState 查询面（doneTasks()/readyBatch() 为方法，不新增独立类）；缺边/反依赖唯一家在 TaskGraph，doc-contract parse 早拦负例断言
- `NextStepRouter` 单点：next 生成单面（负例：warn/nit→`next: none` · blocker>0→re-review · BLOCKED 无 next 行）；胶囊 `status · blocker · handoff · next:` 词面字节 pin 稳态
- dispatch 单 lifecycle 参数化落地（task/branch/spec/plan 数据表驱动）；CLI 命令面（implement/review/fix/schema/issue/base——base set|get）保持
- 技能集 8 → 6 落地：cdd-spec-writer 合一（single/phase/overall 参数化）；四链 digraph（design/spec-writer/plan/dev）单 next-loop 自环 · cdd-close 止于 finish 编排语义门 + 终端 · cdd-report 一次性上报工具链例外 + 边零状态标签；digraph 节点名 ↔ Node Definitions heading ↔ 文本引用一致断言；节点锚定零残留；skill-anatomy 注册（6 集）+ 目录扫描守卫 + `pnpm run emit` 再生 + 零程序历史 pin；上游 import 面/编排语义门/Review Convergence 纪律保持
- scripts 重写：guard 消费引擎元数据（residue 正则 ban 表 → 词表数据行零残留 · channel 字面引擎导出）；单一 emit/validate 编排器；旧 wrapper/双 Orchestrator 零残留
- 两代过渡：新树 **5 平面拓扑**（contract/session/face/render/infra · 文件 72→~30-38 · 顶面 8→5）落地于 `src-next/` + `scripts-next/` → 入口切换 → **旧树/旧技能零残留（grep 断言）** → validate ALL PASS · typecheck ×3 · biome · emit 新鲜 · changesets（cdd-engine major / kairos major）· 净减账（29k → 目标 −20%±）入验收
- **新旧零依赖断言**：`src-next` ↔ `src` 双向零 import（grep）；新树自包含全量重写（无旧符号/旧 helper/旧分组索引）· **数据面归位（v1.4）**：三稳态 JSON → typed 平面成员（infra/runtime · face/host · render/templates）零残留（grep）；`src-next` 面 `config/` slash 路径零命中；派生产物自派生（并行期测试不读旧派生产物）
- **四 phase 承接全落（v1.4）**：P4/P5/P6/P7 四行 → Done（P3.2 承接）；grep：三 JSON 零残留 · review 禁文零残留 · `dispatch.implement` = `mattpocock-skills:implement` · `config/` 整目录零残留（`test ! -d`）· 版本行散文零残留 · 宪法/档案双层落地
- 历史文档零 retro-rename（docs/kairos 方法论记录不动）；消费面 SKILL.md/README 随 6 集重写

## Constraints

- **两代并存过渡闸**：新树测试全绿旧树才可删（并行构建 + 入口切换，切换后立即删旧）
- **新旧零依赖**：`src-next`/`scripts-next` 自包含，零 import 旧树（双向 grep 断言）；新树按新架构新思路全量重写，无旧符号/旧分组/旧 helper 复用；**数据面归位（v1.4）**——三稳态 JSON 收敛 typed 平面（零 JSON/零 `config/` 路径 grep），`config/` 整目录随 cutover 删除零重建，派生产物由新树自派生（并行期不读旧派生产物）
- **消费面稳态（非兼容义务）**：capsule 词面（`status`/`next:`/`CDD_BLOCKED:` 英文恒定）与 cdd CLI 命令面（含 `base set|get`）保持——既是方法论机器面也是消费词面，greenfield 不为其做旧面保留，但新树首版即同词面
- **单数据真相**：元素登记表 + 词汇表 = 唯一声明家；派生投影零手写副本
- **判定单家**：一切结构判定走上下文缝解释器；doctype 类只 parse+投影
- **零裸函数（Criterion ② 全平面正位）**：新树行为/判定/派生全为类成员——三大职责对象（Contract / Session / Face）+ 不变式策略类族；模块级导出仅类型/常量数据/类/组合根，无携带行为的裸函数（旧函数解释器 + 游离 helper 不复现）
- **工作流归一**：技能最小集（6）= 编排 + spec-writer + plan + dev + close + report；流体单源不重复
- **历史正文零 retro-rename**：docs/kairos 方法论记录为史实；重写只作用于引擎/工具链/消费面 SKILL.md
