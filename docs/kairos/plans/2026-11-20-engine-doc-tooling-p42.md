---
title: 'P42 · 评审面的两档收口：档位、承载面与任务块判据'
doc-type: plan
version: v0.1
date: 2026-11-20
slug: 2026-11-20-engine-doc-tooling-p42-design
base: develop
---

## Constraints

- 三条新规则行一律 **warn 起步**，翻位是 Task 8 的最后一个动作；pin 断言「无一规则声明 warn」在翻位后为真。
- **一处定义**：档位词表只住 `contract/review-criteria.ts#CRITERIA_ROWS` 与 `session/ledger.ts#FindingSeverity` 各一处；`Files` 行的文法只住 `contract/task-blocks.ts`；`face/` 不新起第二份清单。
- **读侧与写侧分开**：写入面收两档，读回面对存量载体的 `nit` 保持可读（投影成三值联合，见 spec §1.1）。这不是豁免层——它是一条边界归一，由成对用例钉住两个方向。
- **消费面守恒**：`next:` 字面 · 退出码 · `CDD_BLOCKED` 通道 · 既有拒绝报文逐字节不变。破坏性字节只有 spec §1.1 登记的那几处，一律 changeset minor。
- **引擎只拒不改**：任何拒绝都不移动、不改写、不删除文档；恢复归编排器。
- 本文件的正文按本相位自己在建的规则书写：无行号坐标 · 无裸测量字面（计数写成中文数词或 `census:<id> = <n>`）· 无挂符号的时序指示词 · 工作项行不进重复句的域。
- **实现前窗口的预期红**：本 plan 是语料的一行。三条新规则行起步 `warn`，故窗口内它们对语料零拒绝；翻位在 Task 8，那之前 `pnpm run validate` 的引擎腿不因新行而红。语料规模常量随本文件上调（Task 1 持有该步）。

### Task 1: 档位词表与判决面

#### Objective
把档位词表收成两档，并让判决面按档位判而不是按「有没有 finding」判。写入面（载体的 `severity` 枚举）收两档；读回面对存量载体保持可读——这一对不对称是 spec §1.1 的核心，不是过渡补丁。既有 `warn` 的行为逐字节不变。

#### Files
- Modify: `packages/cdd-engine/src-next/session/ledger.ts`（`FindingSeverity` 收成两值；读回投影另立三值联合，与写侧词表分开）
- Modify: `packages/cdd-engine/src-next/session/handoff-schema.ts`（`rollup` 按档位判三臂；载体 `severity` 的 enum 收两档；读回把存量 `nit` 投影成 `warn`）
- Modify: `packages/cdd-engine/src-next/face/capsule.ts`（档位计数随投影走，不读三值字面）
- Create: `packages/cdd-engine/src-next/session/__tests__/tier-vocabulary.test.ts`

#### Consumes
- `session/handoff-schema.ts#HandoffSchema.rollup` 与它周边两个判据（P41 的证据面判据 · 改档判据）——同一处投影的既有住户
- `packages/cdd-engine/src-next/contract/__tests__/pins.guard.test.ts` 的语料规模常量——本 plan 是本语料的一行

#### Produces
- `FindingSeverity` 的取值集恰为 `blocker` 与 `warn`
- `HandoffSchema.rollup` 的三臂：空 findings ⇒ `APPROVED`；仅 warn ⇒ `REVIEW_FIX`；含 blocker ⇒ `CHANGES_REQUESTED`
- 读回投影：存量 `nit` 读作 `warn`，写侧仍拒 `nit`
- 语料规模常量等于批后实测值

#### Steps
- 收 `FindingSeverity` 为两值，并把读回面另立一个三值联合；载体的 schema enum 收两档 — checkable: `tier-vocabulary.test.ts` 断言写侧拒 `nit`（报文点名两值）、读侧把 `nit` 读成 `warn`（成对：同一份载体改 `warn` ⇒ 接受）
- `rollup` 改成按档位判 — checkable: 三臂各一条断言，且 `warn` 那一臂的报文逐字节等于批前同一夹具的输出
- 复位语料规模常量 — checkable: 该常量的期望值等于 `PinAudit.filesOf(corpusOf(root)).length` 的实测值
- `capsule` 的档位计数改读投影 — checkable: 三值字面在该文件零命中
- 提交 — checkable: `git log -1 --format=%s` 以 `feat(p42):` 起头

#### Acceptance
写侧两档、读侧容错的成对对读同时成立：一份老载体带 `nit` 能读回并折算成 `warn`，一份新载体带 `nit` 被拒。`rollup` 的三臂与批前对 `warn` 的输出逐字节相等。

#### DependsOn
none

### Task 2: 判据表的两条行改判

#### Objective
判据表**删档不删行**：两条原 `nit` 行改判 `warn`，正文重写成「这条观察该去哪」。同一批给 `renderRubric` 加第二条守卫——落在 `TIER_ORDER` 之外的行今天被静默跳过，正文消失而不报。

#### Files
- Modify: `packages/cdd-engine/src-next/contract/review-criteria.ts`（`CriteriaTier` 与 `TIER_ORDER` 收两档；两条行改判并重写正文；`renderRubric` 增表外档守卫；`warn` 档的代价写进 `expression-only` 的 `duty`）
- Test: `packages/cdd-engine/src-next/contract/__tests__/review-criteria.test.ts`

#### Consumes
- `contract/review-criteria.ts#CriteriaRegistry.renderRubric`——`SEVERITY_RUBRIC` 的唯一拼装点
- `contract/review-criteria.ts#regradeNote` 的两个调用点（`face/lifecycle.ts` · `face/brief` 之外的板面）——`#tierRankOf` 收缩后它们不改

#### Produces
- `CriteriaTier` 与 `TIER_ORDER` 收两档；`CRITERIA_ROWS` 行数不变
- `renderRubric` 对表外档抛错（新守卫，不是既有行为）
- `expression-only` 的 `duty` 点名「欠一个 fix 轮，且不对它复评」

#### Steps
- 收 `CriteriaTier` 与 `TIER_ORDER` 为两档 — checkable: `review-criteria.test.ts` 断言取值集恰两值
- 两条原 `nit` 行改判 `warn` 并重写三个格 — checkable: 行数不变；`warn` 档两行外再多一行即红
- `expression-only` 的 `duty` 写进档位代价 — checkable: 断言该格的字符串含 fix 轮与「不复评」两处；删掉那句 ⇒ 该用例红
- `renderRubric` 增表外档守卫 — checkable: 一份带 `nit` 行的注册表 ⇒ 抛错（成对：删掉那一行 ⇒ 正常渲染）
- 提交 — checkable: `git log -1 --format=%s` 以 `feat(p42):` 起头

#### Acceptance
表仍旧是那些行、档只剩两档，而表外档从「静默消失」变成「抛错」。代价那一句住在判据行里，可被断言读。

#### DependsOn
none

### Task 3: `notes` 的承载面

#### Objective
把载体已有的 `notes` 槽从「声明但无人读」升为承载面：板面行 token 给它一个位置，wave 线的下一轮 brief 给它一段。转正的是「可读」，不是「可判」——它不进 `rollup`、不欠 `dispositions`、不跨线。引擎自己那几串不进 `notes`。

#### Files
- Modify: `packages/cdd-engine/src-next/session/handoff-schema.ts`（`notes` 的读写面：读回投影与可写槽表）
- Modify: `packages/cdd-engine/src-next/face/board-view.ts`（行 token 追加 note 计数与逐条，与降级标记共用同一道展示折叠）
- Modify: `packages/cdd-engine/src-next/face/gate.ts`（wave 线的 brief 渲染把上一条本线载体的 `notes` 交给渲染器）
- Modify: `packages/cdd-engine/src-next/render/brief.ts`（brief 的 notes 段：逐条原样列出，不附加动作要求）
- Modify: `packages/cdd-engine/src-next/face/lifecycle.ts`（引擎自写的三串移出 `carrier.notes`，落到 soft violation）
- Create: `packages/cdd-engine/src-next/session/__tests__/notes-channel.test.ts`

#### Consumes
- `session/handoff-schema.ts#CARRIER` 的 `notes` 槽与 `#writable` 的两平面表
- `face/board-view.ts#LineCarriers` 的载体读与解析缓存（note 投影与计数共用同一次读）
- `render/brief.ts#BriefRenderer.render` 的既有入参（plan 文本 · 解析 · 任务号）

#### Produces
- 板面行 token 里的 note 计数与逐条
- wave 线 brief 的 notes 段（doc 线不带该段）
- 载体 `notes` 只剩 child 自己写的内容
- 一条 note 不改变任何轮的结论

#### Steps
- 读回投影与可写槽表按 spec §2.2 落 — checkable: 一条 note 的载体读出空 findings ⇒ 结论 `APPROVED`
- 板面行 token 追加 note 形态 — checkable: 夹具里一份双 note 载体 ⇒ 行 token 出现在既有 findings 计数之后，逐条紧随
- wave 线的 brief 段 — checkable: 同一份载体走 wave 线 ⇒ brief 出现该段；走 doc 线 ⇒ 不出现（成对：只改线）
- 引擎三串移出 `carrier.notes` — checkable: 重跑一轮 review 的载体里 `notes` 不含引擎串；同一内容出现在 soft violation
- 不跨线 — checkable: 同一份载体进入下一条线的首轮 ⇒ 板面与 brief 都不读它
- 提交 — checkable: `git log -1 --format=%s` 以 `feat(p42):` 起头

#### Acceptance
`notes` 在两处可读、在结论里不可见、在下一条线里不继承；引擎自己的三串不再冒充 child 的观察。

#### DependsOn
none

### Task 4: `Create:` 的声明集与唯一性

#### Objective
立 `single-create`：同一路径的 `Create:` 声明恰一条，且它的任务号小于该路径任何其他声明行所在的任务号。判据的前提是**声明集**——`Files` 行的文法与方言得先定义清楚，否则同一个缺陷的两种拼法会换出两个判决。

#### Files
- Modify: `packages/cdd-engine/src-next/contract/task-blocks.ts`（`Files` 行的文法与方言投影：动词闭集 · 行内多动词的分段点 · 集外动词落 `other` 桶）
- Modify: `packages/cdd-engine/src-next/contract/invariants.ts`（新增一条策略类，接 `contract/invariants.ts#Invariant`）
- Modify: `packages/cdd-engine/src-next/contract/rules.ts`（`single-create` 行，起步 `warn`）
- Modify: `packages/cdd-engine/src-next/contract/declare.ts`（面图把该行的判面登记成 `decision`，不留缺口）
- Create: `packages/cdd-engine/src-next/contract/__tests__/single-create.test.ts`

#### Consumes
- `contract/task-blocks.ts#TaskBlock.fields` 的 `Files` 字段与 `#PlanTaskBlocksReader` 的块解析
- `contract/invariants.ts#Invariant` 的策略基类与 `Contract.stamped` 的盖章点
- `contract/declare.ts#ElementRegistry` 的面图行（P41 的 `FaceMap`）

#### Produces
- `Files` 行的（任务号 · 动词 · 路径）三元组投影
- `single-create` 规则行（`warn` 起步）
- 面图里 `#### Files` 与 `single-create` 的角色登记

#### Steps
- 落 `Files` 行文法与方言投影 — checkable: 三类方言各一条断言——`- Create:` 读 `create` · 括注形态读 `modify` · 中文动词读 `other`；行内 `;` 分段各段带自己的动词
- 写判据本体 — checkable: 任务 3 `- Create:` 而任务 5 `- Modify:` ⇒ 零拒绝；两个任务都 `- Create:` ⇒ 报；任务 3 `- Modify:` 而任务 5 `- Create:` ⇒ 报（三条夹具只改任务号与动词）
- 行内方言同判 — checkable: 两个任务各自行内 `Create` 同一路径 ⇒ 与两行 `- Create:` 同一判决
- 面图登记 — checkable: `FaceMap.gaps()` 在 plan 面为空（成对：拿掉该行的角色 ⇒ 非空）
- 提交 — checkable: `git log -1 --format=%s` 以 `feat(p42):` 起头

#### Acceptance
同一个缺陷的两种合法拼法给出同一个判决；`Create:` 之后 `Modify:` 是正常增量，不被判。声明集之外的动词落 `other` 桶，不冒充任何动词。

#### DependsOn
none

### Task 5: 任务图的悬挂与成环

#### Objective
立 `dangling-task-ref` 与 `depends-on-cycle` 两行。前者判 `Consumes` · `Produces` 里 `（Task N）` 标记指向不存在的任务；后者判 `DependsOn` 构成的函数图里的环。两条都不动字段的取值域——判的是图的性质，不是形状。

#### Files
- Modify: `packages/cdd-engine/src-next/contract/invariants.ts`（新增一条策略类的两臂，接 `contract/invariants.ts#Invariant`）
- Modify: `packages/cdd-engine/src-next/contract/rules.ts`（两行规则，起步 `warn`）
- Modify: `packages/cdd-engine/src-next/session/graph.ts`（环的读面：`validate()` 的 `cycle` issue 携带环上成员）
- Modify: `packages/cdd-engine/src-next/session/preflight.ts`（两行的判词站点与既有 `graph` 门的前后关系）
- Create: `packages/cdd-engine/src-next/contract/__tests__/task-graph.test.ts`

#### Consumes
- `contract/task-blocks.ts#TaskBlock.fields` 的 `DependsOn` · `Consumes` · `Produces`
- `session/graph.ts#TaskGraph.validate` 的既有逐节点判法与它交出的 issue 形状
- `session/preflight.ts#PreFlight` 的 `graph` 门与 `doc-contract` 腿的既有顺序

#### Produces
- `dangling-task-ref` 与 `depends-on-cycle` 两行（`warn` 起步）
- `validate()` 的 `cycle` issue 可被断言读出环上成员
- 两行的判词站点写进 spec §3.2 点名的位置

#### Steps
- 悬挂臂 — checkable: `（Task 42）` 指向不存在的任务 ⇒ 报；同一行去掉标记 ⇒ 零拒绝；括号里带多个任务时逐个体判（其一不存在即报）
- 成环臂 — checkable: `A → B → A` ⇒ 报且报文给出环上成员；无环链 ⇒ 零拒绝
- 判词站点 — checkable: 两条命中都出现在 `graph` 门之后的那一段，不抢既有门的结论
- 提交 — checkable: `git log -1 --format=%s` 以 `feat(p42):` 起头

#### Acceptance
两条判据各有一对成对臂；悬挂的判域只覆盖带标记的行，散文不因形似而被判。

#### DependsOn
4

### Task 6: 消费面与发布孪生

#### Objective
把档位词表从所有**已发**的字面里收走。渲染面三处（判词句 · 修轮的义务清单 · 严重度 rubric 的 preamble/tail，其判据表那半自动跟随）· 发布面（四个图表源与 README 家族）· 源码注释面。发布面有孪生 pin 在读它，改完才绿。

#### Files
- Modify: `packages/cdd-engine/src-next/render/templates.ts`（判词句 · 修轮义务清单 · rubric 的 preamble/tail）
- Modify: `packages/cdd-engine/README.md`
- Modify: `packages/cdd-engine/README.zh-CN.md`
- Modify: `README.md`
- Modify: `README.zh-CN.md`
- Modify: `docs/diagrams/src/next-loop.en.json`
- Modify: `docs/diagrams/src/next-loop.zh-CN.json`
- Modify: `docs/diagrams/src/architecture.en.json`
- Modify: `docs/diagrams/src/architecture.zh-CN.json`
- Test: `scripts/__tests__/next-loop-twin.test.ts`

#### Consumes
- `render/templates.ts#REVIEW_ITEM_HEAD` · `#FIX_TYPED_INSTRUCTIONS` · `#SEVERITY_RUBRIC` 的三个槽
- `scripts/__tests__/next-loop-twin.test.ts#warnNitReviewFix`——发布面的孪生 pin
- `docs/diagrams/README.md` 的重生成方式（HTML 不手改）

#### Produces
- 三处渲染面两档化
- 四个图表源与 README 家族的档位措辞两档化，孪生 pin 转绿
- 源码注释面的档位词表同批改写

#### Steps
- 渲染面三处改两档 — checkable: `templates` 的既有断言里 `nit` 零命中（`\bnit\b` 词边界）
- 发布面改两档 — checkable: `next-loop-twin.test.ts` 绿；四个图表源里 `nit` 零命中
- 重生成图表 HTML — checkable: `pnpm run emit:check` 报 fresh（手改 HTML 会红）
- 源码注释面 — checkable: 非测试 `.ts` 的注释行按 `\bnit\b` 扫零命中
- 提交 — checkable: `git log -1 --format=%s` 以 `feat(p42):` 起头

#### Acceptance
已发字面里两档一处不留，而判据表那半个 rubric 自动跟随、不需要手改。

#### DependsOn
2

### Task 7: 章程回填

#### Objective
把章程与本 spec 读到的路线对齐。要改的五组由 spec §5 点名，其中一组是**反转**：本相位起初登记的「三处说明书」里有两个 skill 文件其实是零档位词的，它们退出该表。

#### Files
- Modify: `docs/kairos/overalls/2026-10-10-engine-doc-tooling-overall.md`

#### Consumes
- 章程的 Phase inventory · Issue inventory · D 表的两格 · 历史表
- spec §5 的五组清单

#### Produces
- 章程五组回填落地，版本与前缀同步

#### Steps
- 按 spec §5 逐组改 — checkable: 五组各有一条可点的落点
- 版本与血缘行同批 — checkable: `change-history-latest-matches-front-matter` 绿
- 段落与引用零拒绝 — checkable: `cdd review --dry-run --type overall` 对章程零拒绝
- 提交 — checkable: `git log -1 --format=%s` 以 `docs(p42):` 起头

#### Acceptance
章程的 P42 两行与 D 表两格、以及历史行同读一条路线；章程自己过自己那道门。

#### DependsOn
6

### Task 8: 翻位与交付

#### Objective
三条新规则行从 `warn` 翻到 `block`，自毁面烧掉；changeset 两包 minor；全量门。

#### Files
- Modify: `packages/cdd-engine/src-next/contract/rules.ts`（三行翻位）
- Test: `packages/cdd-engine/src-next/contract/__tests__/rules-severity.test.ts`
- Create: `.changeset/p42-two-ranks.md`

#### Consumes
- `contract/rules.ts#RULE_REGISTRY` 的三条新行
- `contract/review-criteria.ts#CRITERIA_ROWS`（changeset 描述引它的两档）

#### Produces
- 三条新行读 `block`
- 两包 minor 的 changeset
- 全量门绿

#### Steps
- 翻位 — checkable: 断言「无一规则声明 `warn`」为真；把任一行改回 `warn` ⇒ 该用例红
- changeset — checkable: 文件列出 `cdd-engine` 与 `kairos` 两个包且都是 minor
- 全量门 — checkable: `pnpm run validate` 退出码为零
- 提交 — checkable: `git log -1 --format=%s` 以 `feat(p42):` 起头

#### Acceptance
门在闭合态是 `block`，自毁面可核；两包各一条 minor 的发布声明在册。

#### DependsOn
5

## Change history

| Version | date | summary | author |
|---|---|---|---|
| v0.1 | 2026-11-20 | 首版：八任务四波 `{1,2} → {3,4} → {5,6} → {7,8}`。切分按 spec 的三笔交付走：档位词表与判决面 · 判据表改判 · `notes` 承载 · `Create:` 判据 · 任务图 · 消费面与发布孪生 · 章程回填 · 翻位。正文按本相位自己在建的规则书写：判据只引 spec 的节号，不复述内部方法名——本相位的 spec 线为此付了九轮 | Oscaner M. · Claude（kairos:cdd-plan） |