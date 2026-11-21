---
title: '评审面的两档收口 — Phase Spec'
doc-type: phase-spec
version: v0.3
date: 2026-11-20
slug: '2026-11-20-engine-doc-tooling-p42-design'
program: 2026-10-10-engine-doc-tooling
author: "[human] · Claude Opus 5（kairos:cdd-design · grilling Q1–Q3 落定）"
---

## Design

`nit` 跨过两个相位，却从未有过权力：`session/handoff-schema.ts#rollup` 只数 blocker，`warn` 与 `nit` 到达同一个结论。第三档唯一在场的语义是跨轮降级记账（`session/handoff-schema.ts#HandoffSchema.#tierRankOf` 的三级阶梯），而它在两档下同样成立——`blocker` 降到 `warn` 就是一次降级。故词表收两档，`nit` 承载过的观察改走载体已有的 `notes` 槽；同批把任务块的两条结构判据立为门。

### 1. 档位收口

#### 1.1 `rollup` 数档位，结论对 warn 与存量 `nit` 逐字节不变

- `session/handoff-schema.ts#rollup` 从「findings 非空」改为按档位判：`blocker` 命中 ⇒ `CHANGES_REQUESTED`；**任一非 `blocker` 的 finding** ⇒ `REVIEW_FIX`；零 finding ⇒ `APPROVED`。非 blocker 臂的取值集是「非空且不含 blocker」，不是「`warn` 计数」——这条臂就是守恒臂，`warn` 与存量载体里已退休的 `nit` 都落在它上面。
- 退休档的读法写在这里，不留空：存量 `nit` 行没有迁移，也不需要迁移——`session/ledger.ts#Ledger` 的每轮结论经 `session/handoff-schema.ts#HandoffSchema` 的 `conclusionOf` → `rollup` 派生，故一份 findings 全为 `nit` 的载体 ⇒ `REVIEW_FIX`，与收缩前逐字节相同。同一投影面的 `HandoffSchema` `findingsOf` 对未知档位照旧丢弃，但那是 capsule 计数与降级判定，不是判决面。
- 改变的只有词表：`session/ledger.ts#FindingSeverity` 与 `contract/review-criteria.ts#CriteriaTier` 都收成 `blocker` / `warn`，载体的 `severity` 枚举同批收缩。存量载体与侧车不在迁移面——`nit` 的写者只有 review 的 child，本相位之后不再有写者。
- 破坏性字节登记三处：`severity: "nit"` 的载体被拒（`contract-violation`，报文点名取值集）· `contract/review-criteria.ts#TIER_ORDER` 的取值集 · review 指令里 `blocker → CHANGES_REQUESTED · warn/nit → REVIEW_FIX · none → APPROVED` 那一句。三处随 changeset 走 minor（D74）。

#### 1.2 删档不删行

- `contract/review-criteria.ts#CRITERIA_ROWS` 保持 `census:criteria.rows = 6` 行——删的是档，不是行。两条 `nit` 行改判 `warn`，正文重写成「这条观察该去哪」：
  - `expression-only`：从「pure expression 是 nit」改写为「纯表达的观察进 `notes`，留在 findings 里的必须点名它改变了哪一项判断」。`duty` 从「欠一句为什么不是 warn」改为两半：它改变的那项判断，**以及这一档的代价——欠一个 fix 轮，且不对它复评**。代价写在这一行而不是新起一行：这一行本就在教「轻的东西去哪」，而代价正是同一条分界的另一半；新起一行要动 `census:criteria.rows` 与两份已闭合 P37 文档的四处引用，为一个句子付两次账。改名（把 `warn` 换成 `fix`）同样不做：那会把判档从「它是什么」改成「它要多少」，且让存量载体的读侧欠第二张映射表。
  - `regrade-mark`：教学保留（降档要写理由），结论不变——标记是展示事实（`face/board-view.ts#LineCarriers` 的 `regradeNoteOf` 与 capsule 那一行），不是一条 finding。
- 路线与章程注册的「删掉两条 `nit` 行、回填 `census:criteria.rows`」不同，理由在同一句里：两条行的教学价值（一条教「什么不该进 findings」，一条教「降档要写理由」）删行后无处可去，而保留行既不移动 census 也不动 `contract/__tests__/census.guard.test.ts` 的既有对账。章程那几格的回填见 §5。
- `contract/review-criteria.ts#TIER_ORDER` 收成 `blocker` → `warn`；`contract/review-criteria.ts#CriteriaRegistry.renderRubric` 的「每档至少一行」保持抛错语义，**同批新增第二条守卫**：任何一行的 `tier` 落在 `TIER_ORDER` 之外 ⇒ 抛错。既有装配只遍历 `TIER_ORDER`，落在表外的行被静默跳过、正文消失而不报，故「出现第三档即抛」是新守卫，不是既有行为。成对臂：一份带 `nit` 行的注册表必红，删掉那一行 ⇒ 正常渲染。
- `session/handoff-schema.ts#HandoffSchema.#tierRankOf` 收成两端，降级检测的判词从「低一档」变成「低一档——唯一的一档」，`regradeNote` 的两个调用点（`face/lifecycle.ts` · `face/board-view.ts#LineCarriers`）不动。

### 2. `notes` 转正

#### 2.1 承载面：wave 线下一轮的 brief 与每条线的板面 token

- `session/handoff-schema.ts#CARRIER` 的 `notes` 槽从「声明但无人读」升为承载面，两个面各有一个名字：
  - **板面（每一条线）**：`face/board-view.ts#LineCarriers` 增一个 `notesOf(record)` 投影，与 `countOf` / `findingsOf` 共用同一次载体读与解析（`#contentOf` 缓存），读 `CARRIER` 的 `notes` 槽。`face/board-view.ts#BoardView` 的行 token 在既有 findings 的 `+N` 之后追加 `notes +M`：M 是该行各轮 note 的条数，逐条以 `REGRADE_NOTE_SEPARATOR` 同一分隔符紧随其后——与降级标记同一处、同一行，不新起行、不新起段。
  - **brief（只 wave 线）**：`render/brief.ts#BriefRenderer.render` 与 `face/gate.ts#CliGate.renderBrief` 的入参是 plan 文本、那一份 plan 解析与任务号，不含任何载体，**故 brief 读 `notes` 是一条新读**：`face/gate.ts#CliGate.renderBrief` 把本线上一条载体（或它的 `notes` 投影）随文本与解析一起交给渲染器，brief 的 notes 段逐条原样列出——不改写、不附加动作要求。doc 线（phase-spec / plan / overall）的评审轮没有 brief 段可承载，note 在那些线上只走板面。
- 不进 `rollup`：一条 note 不改变结论、不产生 fix 需求、不欠 `dispositions`。转正的是「可读」，不是「可判」。
- **不跨线**：note 不继承到下一条线，因为它的引文指向本线那份文档的具体一句。
- 派发输入表零新增行：`notes` 走 brief 渲染器的入参，不新起 `INPUT_*` token，P38 的必填表不动。这是范围收窄不是遗漏——新 token 会让每条派发线都欠一个值。

#### 2.2 引擎自己不搬进 notes

- 降档标记（`contract/review-criteria.ts#regradeNote`）保持展示事实；`face/lifecycle.ts` 注入的 pin 违约 finding 保持 `warn`。两条都不搬进 `notes`——一个是标记、一个是真断言，搬任一都会把「可判」与「可读」再混一次。

### 3. 任务块判据

#### 3.1 `Create:` 唯一且最早

- 读面分两处，极性不许合并：
  - **pin 表保持 Create-only**：`contract/pins.ts#ForwardPaths` 的 `#declaredPathsOf` / `#pendingOf` / `skips` 只认 `- Create:` 声明，因为只有 `Create:` 声明可以豁免一条尚未落地的 pin（`PinAudit` 的三处判定点读的都是 `skips`）。把 `Modify:` / `Test:` / `Delete:` 喂进这张表，会让 `- Modify: <未落地路径>` 成为待落地声明，pin 审计就此静默。
  - **判据自己的投影是新增的**：`contract/task-blocks.ts#TaskBlock.fields` 的 `Files` 行按 `### Task N:` 块关联，给出（任务号 · 动词 · 路径）三元组；判据读这份投影，不新起第二个扫描器，也不把新增动词喂进 pin 表。
- 判：对**至少带一条 `Create:` 声明**的路径，其 `Create:` 声明恰一条，且其任务号小于该路径任何其他声明行所在的任务号。**无 `Create:` 的路径不判**——改既有文件是常态，按「每条路径恰一条 `Create:`」判会把整份语料判红。
- 为什么不是「同一路径出现两次」：`Create:` 之后 `Modify:` 是正常增量结构（一个任务建文件、后一个任务加功能），判死它会让模板本身成为违例。判据因此是**唯一性与顺序**，不是重复次数。
- 两类违约共用一条判据行的两个臂：双 `Create`（两个任务都声称建它）与 `Modify→Create`（后一个任务建一个前一任务已改的文件）。报文点名两个任务号与那条路径。

#### 3.2 悬挂与成环

- 读面：`contract/task-blocks.ts#TaskBlock.fields` 的 `DependsOn` · `Consumes` · `Produces`。
- 悬挂：`Consumes` / `Produces` 的行带 `（Task N）` 标记而 N 不在已声明任务号集 ⇒ 报 `dangling-task-ref`。**无标记的行跳过**——与 `temporal-indicator` 同一纪律：无候选即不裁决，散文不因形似而被判。
- 成环：`DependsOn` 是声明的单号，构成函数图；出现环 ⇒ 报 `depends-on-cycle`，报文给环的路径。
- 两条判词各占一条规则行（档位可各自不同），**并各占一个不变量类**：`contract/rules.ts` 的契约是 one rule = one strategy，`Invariant.name` 是字面量、`contract/__tests__/rules.test.ts` 逐行断言 `name === declaration.id`，一类只能载一个名字。两条共用一个类，第二条的报文就会带上第一条的判词。两条都不动 `contract/declare.ts` 的 `#### DependsOn` 取值域——本相位判的是图的性质，不是字段的形状。

### 4. 消费面

- 已发面同批改写，`nit` 零命中，两个面各一列：
  - **渲染面**：`render/templates.ts#REVIEWS` 的 review 指令（现写死 `blocker → CHANGES_REQUESTED · warn/nit → REVIEW_FIX · none → APPROVED`）与同一文件的 fix 壳（`FIX_SHELL`，现写死 `Fix ALL findings (blocker/warn/nit)`）——两处都收成两档。
  - **发布面**：`docs/diagrams/src/next-loop.en.json` · `docs/diagrams/src/next-loop.zh-CN.json` · `docs/diagrams/src/architecture.en.json` · `docs/diagrams/src/architecture.zh-CN.json`（档位轴的 `blocker · warn/nit · none`、严重级说明、`style and naming are a nit` 一类教学句、`warn/nit only` 收口句）与 README 家族四处（`README.md` · `README.zh-CN.md` · `packages/cdd-engine/README.md` · `packages/cdd-engine/README.zh-CN.md` 的 Review Convergence 段）。D70 要求发布面与判据孪生：`scripts/__tests__/next-loop-twin.test.ts` 的 `warnNitReviewFix` 断言同批改成两档措辞——它读的正是这四个图表源，改完才绿。图表 HTML 不手改，由 `pnpm run emit` 从图表源重生成。
- 两个 skill 文件（`packages/kairos/skills/cdd-spec-writer/SKILL.md` · `packages/kairos/skills/cdd-plan/SKILL.md`）不进这张表：它们的 review 节点只跟引擎的 `next:` 行，全文没有一个档位词，写进来是一条零字节的工作项配一条永远绿的验收臂。章程 P42 行的消费面清单同批收缩（§5）。
- brief 的 notes 段在 wave 线上逐条列出上一轮的 `notes` 原文（§2.1）；板面用行 token `notes +M` 给计数与逐条。两个面共读一条载体，不各建一份。
- changeset 一包 minor：`cdd-engine`。`kairos` 无消费面改动，故不成 changeset。

### 5. 章程回填

本相位收口时同批改写章程的下列四格，使章程与本节同读一条路线：

- **Phase inventory 的 P42 行**：① 的路线从「删两条 `nit` 行 + 回填 `census:criteria.rows`」改为「两条行保留并改判 `warn`，census 不动」（理由见 §1.2）；④ 的消费面清单换成 §4 的渲染面与发布面；验收 ① 的「删掉两条行后不抛」换成 §1.2 的两档守卫臂。
- **Issue inventory 的 P42 行**：`double-owned` / `consume-cycle` 两个规则 id 换成 grilling 落定的 `single-create` / `dangling-task-ref` / `depends-on-cycle`。
- **D70 的跨切轴**：「只有 warn/nit 时以 `REVIEW_FIX` 收敛」换成「无 blocker 时以 `REVIEW_FIX` 收敛」。
- **验收的 notes 臂**：「板面轮次块出现它一次」换成板面行 token `notes +M`（§2.1）。

### Acceptance criteria

- `session/ledger.ts#FindingSeverity` 与 `contract/review-criteria.ts#CriteriaTier` 的取值集恰为 `blocker` 与 `warn`；一份 `severity: "nit"` 的载体被拒，报文点名这两个取值——成对：同一份载体把该值改 `warn` ⇒ 接受。
- `session/handoff-schema.ts#rollup` 四臂：空 findings ⇒ `APPROVED`；仅 `warn` ⇒ `REVIEW_FIX`；仅 `nit`（存量载体的形状）⇒ `REVIEW_FIX`；含 `blocker` ⇒ `CHANGES_REQUESTED`。四条共用一份夹具的四种填法，且 `warn` 与 `nit` 两臂的结论逐字节等于本相位之前同一份夹具的输出。
- `contract/review-criteria.ts#CRITERIA_ROWS` 的行数等于 `census:criteria.rows = 6`，两条原 `nit` 行读 `warn` 档；`contract/__tests__/census.guard.test.ts` 对这条 id 零失配（这是核对，不是改动面）。
- `contract/review-criteria.ts#CriteriaRegistry.renderRubric` 两条守卫：一份注册表带着 `nit` 行（`tier` 落在 `TIER_ORDER` 之外）⇒ 抛错；同一份注册表删掉那一行 ⇒ 正常渲染（成对臂只改这一行）。计数面读 `contract/review-criteria.ts#CriteriaRegistry` 的 `rows`：每行的 `tier` 落在 `TIER_ORDER` 内、每档至少一行、按档分组后的行数之和等于 `census:criteria.rows`。
- `contract/review-criteria.ts#regradeNote` 在上一轮 `blocker`、本轮同一条 `warn` 时给出标记；上一轮 `warn`、本轮 `warn` 时不给（成对：只改本轮那一档）。
- `contract/review-criteria.ts#CRITERIA_ROWS` 的 `expression-only` 行 `duty` 点名 fix 轮与「不复评」两件事；删掉那句代价 ⇒ 该用例红（成对：只删这一句，行仍在、`census:criteria.rows` 不变）。
- `session/handoff-schema.ts#CARRIER` 的 `notes` 一条进载体后结论不变（空 findings ⇒ `APPROVED`）：wave 线下一轮 brief 出现它的原文一次，板面该行 token 读 `notes +1`；删掉该条 ⇒ 两处都不出现（成对臂只改这一条 note）。
- 一条 phase-spec 评审轮的载体带 note ⇒ 板面行 token 计数它，且该线下一轮没有 brief 段可承载（成对：同一条 note 放进 wave 线 ⇒ brief 出现它一次）——note 的 brief 面只在 wave 线。
- 同一份载体进入下一条线的首轮 ⇒ brief 与板面都不读它的 `notes`；同一份内容放进本线下一轮 ⇒ 两处都读（成对：只改线）。
- `contract/pins.ts#ForwardPaths` 的 `Create:` 判据：任务 3 `- Create:` 而任务 5 `- Modify:` ⇒ 零拒绝；两个任务都 `- Create:` ⇒ 报；任务 3 `- Modify:` 而任务 5 `- Create:` ⇒ 报。三条夹具只有任务号与动词不同。
- pin 表的极性不变：一条 `- Modify: <未落地路径>` 的声明 ⇒ pin 审计照旧报那条未落地 pin；同一行换成 `- Create:` ⇒ 被豁免（成对：只改动词）。
- `contract/task-blocks.ts#TaskBlock` 的任务图：`（Task 42）` 指向不存在的任务 ⇒ 报 `dangling-task-ref`；同一行去掉标记 ⇒ 零拒绝；`DependsOn` 成环 ⇒ 报 `depends-on-cycle`；无环链 ⇒ 零拒绝。
- 已发面零残留：`render/templates.ts#REVIEWS` 的 review 指令与 fix 壳、四个图表源、README 家族四处，`nit` 与 `warn/nit` 均零命中；`scripts/__tests__/next-loop-twin.test.ts` 的 `warnNitReviewFix` 从这四个图表源读出两档措辞并通过。
- 章程四格读本相位的路线：P42 相位行的路线与验收臂、P42 Issue 行的三个规则 id、D70 跨切轴的两档措辞、notes 验收臂的 `notes +M`（§5）。
- `pnpm run validate` 退出码为零。

## Constraints

- **引擎只拒不改**：任何拒绝都不移动、不改写、不删除文档；恢复归编排器。
- **单事实单份**：档位词表住 `contract/review-criteria.ts` 与 `session/ledger.ts` 各一处，`face/` 不新起第二份；任务图的读面沿用 `contract/task-blocks.ts` 与 `contract/pins.ts` 既有两处；`notes` 的两个面共读一条载体。
- **消费面守恒**：`next:` 字面 · 退出码 · `CDD_BLOCKED` 通道 · 既有拒绝报文逐字节不变。§1.1 登记的三处破坏性字节是引擎面的唯一例外，且一律 minor；发布面（图表源与 README）是措辞改写，不进引擎字节。
- **新判据 warn 起步且必须自毁**：`single-create` · `dangling-task-ref` · `depends-on-cycle` 三条规则行起步 `warn`，本相位末任务同批翻 `block`，pin 断言「无一规则声明 warn」在翻位后为真。过渡值不留在闭合态。
- **不动的面**：P37 的判档本体（本相位改档数不改边界）· `contract/declare.ts` 的字段取值域 · 载体与侧车的存量迁移（退休档落在非 blocker 臂，存量结论逐字节不变）· 派发输入表的行集。
- **不做**：从散文抽宾语（`owner-less`）· 差分恒真 · `<!-- non-normative -->` 段落标记。三条都属于另一类缺陷——评审读不懂语义，而本相位只判形状。

## Change history

| Version | date | summary | author |
|---|---|---|---|
| v0.1 | 2026-11-20 | 首版。三笔：档位收两档（词表与判据表同批）· `notes` 转正为承载面（brief 与板面）· 任务块两族判据（`Create:` 唯一且最早 · 悬挂与成环） | Oscaner M. · Claude（kairos:cdd-design） |
| v0.3 | 2026-11-20 | 编排者回填（grilling 追加裁定）：`warn` 档的代价写进 `expression-only` 的 `duty`——欠一个 fix 轮、不复评——并加一条成对臂钉住那句。不加第七行判据（省掉 `census:criteria.rows` 与两份 P37 文档的四处引用），不改名 `warn`（那会把判档从「它是什么」改成「它要多少」） | Oscaner M. · Claude（kairos:cdd-design） |
