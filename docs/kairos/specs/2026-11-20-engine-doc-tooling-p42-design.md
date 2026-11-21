---
title: '评审面的两档收口 — Phase Spec'
doc-type: phase-spec
version: v0.5
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
- 退休档的读法写在这里，不留空：存量 `nit` 行没有迁移，也不需要迁移——`session/ledger.ts#Ledger` 的每轮结论经 `session/handoff-schema.ts#HandoffSchema` 的 `conclusionOf` → `rollup` 派生，故一份 findings 全为 `nit` 的载体 ⇒ `REVIEW_FIX`，与收缩前逐字节相同。同一投影面必须分开写侧与读侧。**写侧收窄**：`session/handoff-schema.ts#CARRIER` 的 `findings.items.severity` 枚举只留 `blocker` / `warn`，新草稿的 `nit` 在形状面上被拒，报文点名取值集。**读侧不收窄**：`session/handoff-schema.ts#HandoffSchema.findingsOf` 的取值集照旧是 `blocker` / `warn` / `nit`——装它的是投影面自己的三值联合（`"blocker" | "warn" | "nit"`，在 `session/ledger.ts` 与写侧词表分开声明，不复用 `FindingSeverity`）：`session/ledger.ts#RoundFinding.severity` 与 `session/handoff-schema.ts#HandoffSchema.#tierRankOf` 的入参都挂这三值，写侧词表 `FindingSeverity` 只表达两档。理由不是「只读磁盘」——`findingsOf` 同一条路径也投影本轮自己的 `draft.findings`（`face/lifecycle.ts#reconstruct` 在 read-back 之后把它交给这个投影）；真正的理由是写侧枚举在 read-back 先拒掉新 `nit`，投影面因此只会从存量载体读到第三值。`#tierRankOf` 的三级排名 2 / 1 / 0 逐字节保留：把 `nit` 并进 `warn` 会静默丢掉存量 `warn → nit` 的降级标记，那是登记表外的展示字节变化。未知档位的丢弃本来就是投影的规则。这条不是装饰：`session/ledger.ts#Ledger` 的 `#findingsOf` → `Round.findings` → `session/next.ts#NextStepRouter.next` 的 review 臂按投影条数分流（`findings.length > 0` ⇒ `#fixRoute`，零条 ⇒ `#close`），读侧若跟着收窄，一份 findings 全为 `nit` 的存量载体就会在结论为 `REVIEW_FIX` 时被直接关线——正是「`next:` 字面逐字节不变」要拦的那一处。
- 改变的只有词表：`session/ledger.ts#FindingSeverity` 与 `contract/review-criteria.ts#CriteriaTier` 都收成 `blocker` / `warn`，载体的 `severity` 枚举同批收缩。存量载体与侧车不在迁移面——`nit` 的写者只有 review 的 child，本相位之后不再有写者。
- 破坏性字节登记五处，一律随 changeset 走 minor（D74）：① `severity: "nit"` 的载体被拒（`contract-violation`，报文点名取值集）· ② `contract/review-criteria.ts#TIER_ORDER` 的取值集 · ③ `render/templates.ts#REVIEW_ITEM_HEAD` 里 `blocker → CHANGES_REQUESTED · warn/nit → REVIEW_FIX · none → APPROVED` 那一句（这句不住 `REVIEWS` 里，`REVIEWS` 只载 `lensEnum` / `pinLens` / `axesGuide`）· ④ 同一文件 `SEVERITY_RUBRIC` 的整张表——它由 `CRITERIA.renderRubric()` 渲染、每一条 review 指令都带着它，故 §1.2 两行正文的改写落在每条 prompt 上 · ⑤ `render/templates.ts#FIX_SHELL` 的 `Fix ALL findings (blocker/warn/nit)`。①② 是形状面与判据面，③④⑤ 是 prompt 字节面；登记到此为止，没有第六处。

#### 1.2 删档不删行

- `contract/review-criteria.ts#CRITERIA_ROWS` 保持 `census:criteria.rows = 6` 行——删的是档，不是行。两条 `nit` 行改判 `warn`，正文重写成「这条观察该去哪」：
  - `expression-only`：从「pure expression 是 nit」改写为「纯表达的观察进 `notes`，留在 findings 里的必须点名它改变了哪一项判断」。`duty` 从「欠一句为什么不是 warn」改为两半：它改变的那项判断，**以及这一档的代价——欠一个 fix 轮，且不对它复评**。代价写在这一行而不是新起一行：这一行本就在教「轻的东西去哪」，而代价正是同一条分界的另一半；新起一行要动 `census:criteria.rows` 与两份已闭合 P37 文档的四处引用，为一个句子付两次账。改名（把 `warn` 换成 `fix`）同样不做：那会把判档从「它是什么」改成「它要多少」，且让存量载体的读侧欠第二张映射表。
  - `regrade-mark`：教学保留（降档要写理由），结论不变——标记是展示事实（`face/board-view.ts#LineCarriers` 的 `regradeNoteOf` 与 capsule 那一行），不是一条 finding。
- `render/templates.ts#SEVERITY_RUBRIC` 就是 `CRITERIA.renderRubric()` 的整张表渲染，每一条 review 指令都带着它——「词表收两档」因此是**整张表**的正文改写，不是两条退休行的改写：`evidence-missing`（`blocker`）的 counterExample 现写「A warn or a nit may leave `evidence` out」，`debt-consequence`（`warn`）的现写「is a warn, not a nit … the warn / nit boundary itself」，两处都改成两档措辞（「a warn may leave `evidence` out」·「the warn boundary itself」）；同表的 doc comment（「the `nit` tier carries two …」）与 `contract/review-criteria.ts#CriteriaRegistry` 的两处档序注释（类注释与 `renderRubric` 的文档注释，各一句「the tiers run blocker → warn → nit」）同批改。漏一行的代价不是措辞不美：评审照着 prompt 判 `nit`，收缩后的枚举在 read-back 硬拒整份草稿（`contract-violation`），这一轮就白跑。
- 路线与章程注册的「删掉两条 `nit` 行、回填 `census:criteria.rows`」不同，理由在同一句里：两条行的教学价值（一条教「什么不该进 findings」，一条教「降档要写理由」）删行后无处可去，而保留行既不移动 census 也不动 `contract/__tests__/census.guard.test.ts` 的既有对账。章程那几格的回填见 §5。
- `contract/review-criteria.ts#TIER_ORDER` 收成 `blocker` → `warn`；`contract/review-criteria.ts#CriteriaRegistry.renderRubric` 的「每档至少一行」保持抛错语义，**同批新增第二条守卫**：任何一行的 `tier` 落在 `TIER_ORDER` 之外 ⇒ 抛错。既有装配只遍历 `TIER_ORDER`，落在表外的行被静默跳过、正文消失而不报，故「出现第三档即抛」是新守卫，不是既有行为。成对臂：一份带 `nit` 行的注册表必红，删掉那一行 ⇒ 正常渲染。
- `session/handoff-schema.ts#HandoffSchema.#tierRankOf` 不动：它排名的是投影面的三值联合（§1.1），三级 2 / 1 / 0 逐字节保留。写侧只剩两档，新 finding 的降级因此只有「`blocker` → `warn`」这一档——「唯一的一档」这句写进判据行的教学，不写进排名函数。`regradeNote` 的两个调用点（`face/lifecycle.ts` · `face/board-view.ts#LineCarriers`）不动。

### 2. `notes` 转正

#### 2.1 承载面：wave 线下一轮的 brief 与每条线的板面 token

- `session/handoff-schema.ts#CARRIER` 的 `notes` 槽从「声明但无人读」升为承载面，两个面各有一个名字：
  - **板面（每一条线）**：`face/board-view.ts#LineCarriers` 增一个 `notesOf(record)` 投影，与 `countOf` / `findingsOf` 共用同一次载体读与解析（`#contentOf` 缓存），读 `CARRIER` 的 `notes` 槽。这个投影覆盖**两种 plane** 的载体（`judge` 与 `work` 都算）：M 是该行各轮 note 的条数，不是判官面的条数——`face/board-view.ts#LineCarriers.#readFresh` 现有的「无 `findings` 数组 ⇒ `EMPTY_CARRIER_CONTENT`」早退必须同批放宽成「无 `findings` 且无 `notes` ⇒ 空」，否则 work 轮的 note（引擎自己在 `render/templates.ts#DOCS_FIX_SHELL` 里让 child 写进 `notes` 的那一条：`else BLOCKED + the reason in notes`）永远读成零。`face/board-view.ts#BoardView` 的行 token 在既有 findings 的 `+N` 之后追加 `notes +M`：M 是该行各轮 note 的条数，逐条以 `REGRADE_NOTE_SEPARATOR` 同一分隔符紧随其后——与降级标记同一处、同一行，不新起行、不新起段；两者同时在场时**降级标记在前、`notes +M` 在后**（`#summaryToken` 先拼 `+N` 再拼标记，notes 段接在标记之后）。**每条 note 上板前先过降级理由同一道展示折叠**：`contract/review-criteria.ts` 的 `displayReason` 从模块私有升为导出（`regradeNote` 与板面共读这一个 fold，不复制第二份），` · ` 折成 `; `、连续空白（含换行）折成单空格——`notes` 是无约束字符串数组，原样上板的一条带换行或 ` · ` 的 note 会把板面的一行拆成两行、把一条 note 读成两格。折叠只发生在展示面，不落回载体：`carrier.notes` 存的是 child 的原文。
  - **brief（只 wave 线）**：`render/brief.ts#BriefRenderer.render` 与 `face/gate.ts#CliGate.renderBrief` 的入参是 plan 文本、那一份 plan 解析与任务号，不含任何载体，**故 brief 读 `notes` 是一条新读**。三处各钉一句：**读哪一条**——本线（同一 `(line, key)`）上最后一条已完成的 **review 载体**（`(cycle, attempt)` 最大）；**经哪个读面**——`face/gate.ts#CliGate.renderBrief` 从 `face/lifecycle.ts#DispatchScene` 的 `ledger` 取，经 `face/board-view.ts#LineCarriers` 的 `notesOf(record)`（归属判定 + `CarrierIntegrity.read` 摘要校验，与板面同一次读）拿到投影，随文本与解析一起交给渲染器——不新起裸 `readFileSync`（那是「单事实单份」禁止的第二台读机）；**落在哪**——`BriefRenderer.render` 在 `## Constraints` 镜像**之后**拼 notes 段，`#taskBody` 的字节一字不动（`session/ledger.ts#Ledger#briefDrifted` 两侧都哈希 `taskBody`，notes 落进 `taskBody` 会让散列投影与 child 实际读到的 brief 字节分家）。brief 的 notes 段逐条原样列出——不改写、不附加动作要求。doc 线（phase-spec / plan / overall）的评审轮没有 brief 段可承载，note 在那些线上只走板面。
- 不进 `rollup`：一条 note 不改变结论、不产生 fix 需求、不欠 `dispositions`。转正的是「可读」，不是「可判」。
- **不跨线**：note 不继承到下一条线，因为它的引文指向本线那份文档的具体一句。
- 派发输入表零新增行：`notes` 走 brief 渲染器的入参，不新起 `INPUT_*` token，P38 的必填表不动。这是范围收窄不是遗漏——新 token 会让每条派发线都欠一个值。

#### 2.2 引擎自己不搬进 notes

- 降档标记（`contract/review-criteria.ts#regradeNote`）保持展示事实；`face/lifecycle.ts` 注入的 pin 违约 finding 保持 `warn`。两条都不搬进 `notes`——一个是标记、一个是真断言，搬任一都会把「可判」与「可读」再混一次。
- 引擎自己写进 `notes` 的**三串**（`face/lifecycle.ts` 的 `#materialize`：`observations`——落在声明形状外的装饰槽——· `reserved`——被丢弃的非声明键——· `#canonicalArtifacts` 压进同一个数组的 artifact 偏移句「artifact report: declared path … deviates from the prescribed …」）**不进两个面**。落法一条：`carrier.notes` 只装 child 的 `draft.notes`，三串全改骑已有的软违规通道（`observations` 本就落在 `RoundViolation.soft` 上；`reserved` 与 artifact 偏移句同批并进同一条通道，偏移因此仍是可审计的 record 事实，只是不再冒充 child 的观察）。两个面因此读到的就是 child 写的 note 逐条原文——brief 与板面 token 同一个过滤、同一份来源；否则下一轮 brief 会把「dropped non-declared draft field(s): … — engine-reserved, never written」当 note 印出来，板面会把一条 artifact 偏移读成 child 写的 note。

### 3. 任务块判据

#### 3.1 `Create:` 唯一且最早

- 读面分两处，极性不许合并：
  - **pin 表保持 Create-only**：`contract/pins.ts#ForwardPaths` 的 `#declaredPathsOf` / `#pendingOf` / `skips` 只认 `- Create:` 声明，因为只有 `Create:` 声明可以豁免一条尚未落地的 pin（`PinAudit` 的三处判定点读的都是 `skips`）。把 `Modify:` / `Test:` / `Delete:` 喂进这张表，会让 `- Modify: <未落地路径>` 成为待落地声明，pin 审计就此静默。
  - **判据自己的投影是新增的**：`contract/task-blocks.ts#TaskBlock.fields` 的 `Files` 行按 `### Task N:` 块关联，给出（任务号 · 动词 · 路径）三元组；判据读这份投影，不新起第二个扫描器，也不把新增动词喂进 pin 表。
- **投影的行语法一句话**：`Files` 的每一行先剥 bullet（`-` / `*` / `+`），行首 ASCII 标签（`contract/task-blocks.ts#PlanTaskBlocksReader.FILE_ROW_LABEL` 的既有规则）的**第一个词小写化**就是动词；标签剥不出（`- 新建：` 这类全角冒号加中文动词）或第一个词不在四词表（`create` / `modify` / `test` / `delete`）里的行，动词记 `other`，但它命名的路径**仍是该路径的声明行**；路径 token 沿用 `PlanTaskBlocksReader#fileTokensOf` 的既有规则（反引号内的 span，没有引号时整行余量算一个 token），不另立。语料的两种方言落在「`other` 也是声明行」这一臂：`- 修改：` 与 `- Modify (diagram evidence):` 都声明它们写的路径；只有 `create` 进唯一性与顺序的计数，`新建：` 因此不冒充 `Create:`——一条路径先被 `新建：` 声明、后来的任务再写 `Create:`，那个 `Create:` 就是晚的。
- 判：对**至少带一条 `Create:` 声明**的路径，其 `Create:` 声明恰一条，且其任务号小于该路径任何其他声明行所在的任务号。**无 `Create:` 的路径不判**——改既有文件是常态，按「每条路径恰一条 `Create:`」判会把整份语料判红。
- 为什么不是「同一路径出现两次」：`Create:` 之后 `Modify:` 是正常增量结构（一个任务建文件、后一个任务加功能），判死它会让模板本身成为违例。判据因此是**唯一性与顺序**，不是重复次数。
- 两类违约共用一条判据行的两个臂：双 `Create`（两个任务都声称建它）与 `Modify→Create`（后一个任务建一个前一任务已改的文件）。报文点名两个任务号与那条路径。

#### 3.2 悬挂与成环

- 读面：`contract/task-blocks.ts#TaskBlock.fields` 的 `DependsOn` · `Consumes` · `Produces`。
- 悬挂：`Consumes` / `Produces` 的行带 `（Task N）` 标记而 N 不在已声明任务号集 ⇒ 报 `dangling-task-ref`。一个括号里可以点多个任务（语料里 `（Task 4 · Task 6）` 是常态），判的是括号内**每一个** `Task N`：任一个不在已声明任务号集就报，报文点名那一个。**无标记的行跳过**——与 `temporal-indicator` 同一纪律：无候选即不裁决，散文不因形似而被判。
- 成环：`DependsOn` 的值是声明的 id 列表（`contract/task-blocks.ts#PlanTaskBlocksReader.dependsOn` 返回 `readonly number[]`：逗号 / 空白分隔、去重排序），任务是这张一般有向图上的节点——**不是函数图**（单后继）：`DependsOn 3, 7` 是两条边，环可以从第二条边闭合。读面复用树里现成的图判断，取的是它的**公开面**：`session/graph.ts#TaskGraph` 的 `validate()` 已把环判成一条 `GraphIssue`（`kind: "cycle"`，`task` 是环上最小的任务号），判据读这条 issue；`#cycleMember` 是私有成员，不开公开副本。出现环 ⇒ 报 `depends-on-cycle`。
- **站位与可达面写清**：`session/preflight.ts` 的 `graph` 门排在 `doc-contract` 门之前，而 `TaskGraph` 读的正是 `DependsOn` 边——一条 `DependsOn` 成环的 plan 在 wave / plan 线上先被 `graph` 门以 `cycle@T{n}` 拒掉，`doc-contract` 走不到这条新规则行。`depends-on-cycle` 因此是**同一判断的文档面表达**，不是抢在 `graph` 门前面的第二道拒绝：它的活站位是直接跑判据的那一面（`contract/judge.ts#Contract` 的 `validate` 判一份 doc key 为 `plan` 的文档），报文逐字节复用那条 `GraphIssue` 的 `task` 与 `message`（`cycle@T{n}: …`），与 `graph` 门的 `details` 同一句。验收因此在 `Contract` 面造环，dispatch 面的拒绝归 `graph` 门——两级对同一个 defect 给同一句。
- 两条判词各占一条规则行（档位可各自不同），**并各占一个不变量类**：`contract/rules.ts` 的契约是 one rule = one strategy，`Invariant.name` 是字面量、`contract/__tests__/rules.test.ts` 逐行断言 `name === declaration.id`，一类只能载一个名字。两条共用一个类，第二条的报文就会带上第一条的判词。两条都不动 `contract/declare.ts` 的 `#### DependsOn` 取值域——本相位判的是图的性质，不是字段的形状。

### 4. 消费面

- 已发面同批改写，`nit` 零命中，三面各一列：
  - **渲染面**：`render/templates.ts#REVIEW_ITEM_HEAD` 的 review 指令行（现写死 `blocker → CHANGES_REQUESTED · warn/nit → REVIEW_FIX · none → APPROVED`；`REVIEWS` 只载 `lensEnum` / `pinLens` / `axesGuide`，这句不在它里面）与同一文件的 fix 壳（`FIX_SHELL`，现写死 `Fix ALL findings (blocker/warn/nit)`）——两处都收成两档。同一 `SEVERITY_RUBRIC` 的字面不在此列：它是 `CRITERIA.renderRubric()` 的渲染，逐行改写归 §1.2。
  - **发布面**：`docs/diagrams/src/next-loop.en.json` · `docs/diagrams/src/next-loop.zh-CN.json` · `docs/diagrams/src/architecture.en.json` · `docs/diagrams/src/architecture.zh-CN.json`（档位轴的 `blocker · warn/nit · none`、严重级说明、`style and naming are a nit` 一类教学句、`warn/nit only` 收口句）与 README 家族四处（`README.md` · `README.zh-CN.md` · `packages/cdd-engine/README.md` · `packages/cdd-engine/README.zh-CN.md` 的 severity-convergence 段：root 两份写作 `**Review Convergence**`，`packages/cdd-engine/` 两份把同一条规则写作 `Convergence itself is decided by the findings' grades alone …`，没有这个标题——按段定位，不按标题）。D70 要求发布面与判据孪生：`scripts/__tests__/next-loop-twin.test.ts` 的 `warnNitReviewFix` 断言同批改成两档措辞——它读的正是这四个图表源，改完才绿。图表 HTML 不手改，由 `pnpm run emit` 从图表源重生成。
  - **源码注释面**：档位词表所在的三个文件的注释同批改写，不留给下一个作者读旧梯子——共八处，逐处点名（三文件之外没有第九处）：`render/templates.ts` 的 `SEVERITY_RUBRIC` 注释（「tiers in blocker → warn → nit order」）· `contract/review-criteria.ts` 的模块头注释（「the nit tier's prose」）· 同文件 `CRITERIA_ROWS` 表注释（「the `nit` tier carries two …」）· 同文件 `CriteriaRegistry` 类的文档注释与 `renderRubric` 的文档注释（各一句「the tiers run blocker → warn → nit」）· `session/handoff-schema.ts` 的 `impact` 注释（「warn / nit findings owe no scenario」）· 同文件 `evidence` 注释（「warn / nit owe nothing」）· 同文件 `gradingViolations` 注释（「Warn / nit findings owe nothing here」）。八处都是「打开这文件学梯子」的人先读到的那一句，验收按这八处扫。
- 两个 skill 文件（`packages/kairos/skills/cdd-spec-writer/SKILL.md` · `packages/kairos/skills/cdd-plan/SKILL.md`）不进这张表：它们的 review 节点只跟引擎的 `next:` 行，全文没有一个档位词，写进来是一条零字节的工作项配一条永远绿的验收臂。章程 P42 行的消费面清单同批收缩（§5）。
- brief 的 notes 段在 wave 线上逐条列出上一轮的 `notes` 原文（§2.1）；板面用行 token `notes +M` 给计数与逐条。两个面共读一条载体，不各建一份。
- changeset 一包 minor：`cdd-engine`。`kairos` 无消费面改动，故不成 changeset。

### 5. 章程回填

本相位收口时同批改写章程的下列四组（第三条是两个格子），使章程与本节同读一条路线：

- **Phase inventory 的 P42 行**：① 的路线从「删两条 `nit` 行 + 回填 `census:criteria.rows`」改为「两条行保留并改判 `warn`，census 不动」（理由见 §1.2）；④ 的消费面清单换成 §4 的渲染面 · 发布面 · 源码注释面；验收 ① 的「删掉两条行后不抛」换成 §1.2 的两档守卫臂。
- **Issue inventory 的 P42 行**：`double-owned` / `consume-cycle` 两个规则 id 换成 grilling 落定的 `single-create` / `dangling-task-ref` / `depends-on-cycle`。
- **D70 的两格**：这条轴在章程里出现两次——顶部的跨切条目「分级判收敛（severity-graded convergence）为程序方法论主轴」与裁定表的 `| D70 |` 行（「仅有 warn/nit → `REVIEW_FIX` 收敛」）。两格同批改成「无 blocker 时以 `REVIEW_FIX` 收敛」，不留一格在三档上：D70 自己的 ① 规则「口径 ⇄ 计数同批」要求两格同读一份口径。
- **验收的 notes 臂**：「板面轮次块出现它一次」换成板面行 token `notes +M`（§2.1）。

### Acceptance criteria

- `session/ledger.ts#FindingSeverity` 与 `contract/review-criteria.ts#CriteriaTier` 的取值集恰为 `blocker` 与 `warn`；一份 `severity: "nit"` 的载体被拒，报文点名这两个取值——成对：同一份载体把该值改 `warn` ⇒ 接受。
- `session/handoff-schema.ts#rollup` 四臂：空 findings ⇒ `APPROVED`；仅 `warn` ⇒ `REVIEW_FIX`；仅 `nit`（存量载体的形状）⇒ `REVIEW_FIX`；含 `blocker` ⇒ `CHANGES_REQUESTED`。四条共用一份夹具的四种填法，且 `warn` 与 `nit` 两臂的结论逐字节等于本相位之前同一份夹具的输出。
- 存量载体的跳转成对臂（读真链 `session/ledger.ts#Ledger` 的 `#round` → `session/next.ts#NextStepRouter.next`，不是只读 `rollup`）：一份 findings 全为 `nit` 的存量评审载体 ⇒ 结论 `REVIEW_FIX` 且 `next:` 走 fix 臂（不关线）；同一份载体把那一档改写成 `warn` ⇒ 与相位前逐字节同一跳。零条 findings 的载体 ⇒ `APPROVED` 且走关线臂（成对：只改 findings 条数）。
- 读侧投影的三值成对臂：一份上一轮 `warn`、本轮同一条降为 `nit` 的存量载体 ⇒ `#tierRankOf` 判降级、`regradeNote` 给标记，与本相位之前的同一份 fixture 逐字节相同（成对：本轮那一档写成 `warn` ⇒ 无标记）；同一份新草稿里的 `nit` 在 read-back 被拒，而同一份存量载体（磁盘上已存在）被投影面的三值联合接受（成对只改「存量载体 / 新草稿」这一面）。
- `contract/review-criteria.ts#CRITERIA_ROWS` 的行数等于 `census:criteria.rows = 6`，两条原 `nit` 行读 `warn` 档；`contract/__tests__/census.guard.test.ts` 对这条 id 零失配（这是核对，不是改动面）。
- `contract/review-criteria.ts#CriteriaRegistry.renderRubric` 两条守卫：一份注册表带着 `nit` 行（`tier` 落在 `TIER_ORDER` 之外）⇒ 抛错；同一份注册表删掉那一行 ⇒ 正常渲染（成对臂只改这一行）。计数面读 `contract/review-criteria.ts#CriteriaRegistry` 的 `rows`：每行的 `tier` 落在 `TIER_ORDER` 内、每档至少一行、按档分组后的行数之和等于 `census:criteria.rows`。
- `contract/review-criteria.ts#regradeNote` 在上一轮 `blocker`、本轮同一条 `warn` 时给出标记；上一轮 `warn`、本轮 `warn` 时不给（成对：只改本轮那一档）。
- `contract/review-criteria.ts#CRITERIA_ROWS` 的 `expression-only` 行 `duty` 点名 fix 轮与「不复评」两件事；删掉那句代价 ⇒ 该用例红（成对：只删这一句，判据行与 `census:criteria.rows` 两处都不动）。
- `session/handoff-schema.ts#CARRIER` 的 `notes` 一条进载体后结论不变（空 findings ⇒ `APPROVED`）：wave 线下一轮 brief 出现它的原文一次，板面该行 token 读 `notes +1`（同一行也带降级标记时，标记在前、`notes +M` 在后）；删掉该条 ⇒ 两处都不出现（成对臂只改这一条 note）。一条 note 里带换行与 ` · ` ⇒ 板面单行单段（折成 `; ` 与单空格），`carrier.notes` 存原文（成对：同一条 note 不带 break ⇒ 同一读数）。work 轮的载体（无 `findings`，只有 `notes`）带一条 note ⇒ 板面同样读 `notes +1`（成对：同一载体换成评审轮、note 一条 ⇒ 同一读数）。
- 一份发生了丢弃的轮（装饰槽落在声明形状外 · 非声明键被丢 · 声明的 prescribed artifact 路径非规范）⇒ 板面 token 与下一轮 brief 的 notes 段都不含引擎那三串（`dropped decorative draft field(s)` · `dropped non-declared draft field(s)` · `artifact report: declared path … deviates from the prescribed …`），三串都落在该轮的 soft violation 上，且 carrier 的 `notes` 等于 child 的 `draft.notes` 逐字节；成对：同一份草稿把 artifact 路径改回规范路径 ⇒ 同一读数，只有 soft 串少一条。
- 一条 phase-spec 评审轮的载体带 note ⇒ 板面行 token 计数它，且该线下一轮没有 brief 段可承载（成对：同一条 note 放进 wave 线 ⇒ brief 出现它一次）——note 的 brief 面只在 wave 线。
- 同一份载体进入下一条线的首轮 ⇒ brief 与板面都不读它的 `notes`；同一份内容放进本线下一轮 ⇒ 两处都读（成对：只改线）。
- `contract/task-blocks.ts#PlanTaskBlocksReader` 新增的（任务号 · 动词 · 路径）投影（`Files` 行按 `### Task N:` 关联）：任务 3 `- Create:` 而任务 5 `- Modify:` ⇒ 零拒绝；两个任务都 `- Create:` ⇒ 报；任务 3 `- Modify:` 而任务 5 `- Create:` ⇒ 报；任务 3 `- 新建：`（非词表标签，动词 `other`）而任务 5 `- Create:` ⇒ 报；任务 3 `- 修改：` 而任务 5 `- Create:` ⇒ 报（同一条声明行臂）。夹具只有任务号与动词标签不同。
- pin 表的极性不变：一条 `- Modify: <未落地路径>` 的声明 ⇒ pin 审计照旧报那条未落地 pin；同一行换成 `- Create:` ⇒ 被豁免（成对：只改动词）。
- `contract/task-blocks.ts#TaskBlock` 的任务图：`（Task 42）` 指向不存在的任务 ⇒ 报 `dangling-task-ref`；同一行去掉标记 ⇒ 零拒绝；`（Task 4 · Task 42）` 而 42 未声明 ⇒ 报（多 id 括号臂）；`DependsOn 3, 7` 且环从 7 闭合 ⇒ 在 `Contract().validate` 面上报 `depends-on-cycle`，报文逐字节等于 `TaskGraph.validate()` 那条 `cycle@T{n}: …`（多 id 边臂；`graph` 门对同一份 fixture 的拒绝走它自己的 `cycle@T{n}` detail，两级同一句）；无环链 ⇒ 零拒绝。
- 已发面零残留：`render/templates.ts#REVIEW_ITEM_HEAD` 的 review 指令与 `FIX_SHELL`、`render/templates.ts#SEVERITY_RUBRIC`（= `CRITERIA.renderRubric()` 的整张表渲染，含 `evidence-missing` 与 `debt-consequence` 两行）、四个图表源、README 家族的 severity-convergence 段、以及 §4 逐处点名的八处源码档位注释，`\bnit\b` 与 `warn/nit` 均零命中（词边界扫，不是子串：`init` / `definition` 不算命中）；成对：一份 `severity: "nit"` 的草稿在 read-back 被拒（报文点名 `blocker | warn`）。`scripts/__tests__/next-loop-twin.test.ts` 的 `warnNitReviewFix` 从这四个图表源读出两档措辞并通过。
- 章程四组读本相位的路线：P42 相位行的路线与验收臂、P42 Issue 行的三个规则 id、D70 两格（跨切条目 + `| D70 |` 行）的两档措辞、notes 验收臂的 `notes +M`（§5）。
- `pnpm run validate` 退出码为零。

## Constraints

- **引擎只拒不改**：任何拒绝都不移动、不改写、不删除文档；恢复归编排器。
- **单事实单份**：档位词表住 `contract/review-criteria.ts` 与 `session/ledger.ts` 各一处，`face/` 不新起第二份；任务图的读面沿用 `contract/task-blocks.ts` 与 `contract/pins.ts` 既有两处；`notes` 的两个面共读一条载体。
- **消费面守恒**：`next:` 字面 · 退出码 · `CDD_BLOCKED` 通道 · 既有拒绝报文逐字节不变。§1.1 登记的五处破坏性字节（形状面两处 + prompt 字节面三处）是引擎面的唯一例外，且一律 minor；发布面（图表源与 README）是措辞改写，不进引擎字节。
- **新判据 warn 起步且必须自毁**：`single-create` · `dangling-task-ref` · `depends-on-cycle` 三条规则行起步 `warn`，本相位末任务同批翻 `block`，pin 断言「无一规则声明 warn」在翻位后为真——该 pin 就是 `contract/__tests__/rules-severity.test.ts` 的「declares no `warn` row in the shipped registry」（`RULE_REGISTRY.filter((row) => row.severity === "warn")` 为空）。过渡值不留在闭合态。
- **不动的面**：P37 的判档本体（本相位改档数不改边界）· `contract/declare.ts` 的字段取值域 · 载体与侧车的存量迁移（退休档落在非 blocker 臂，存量结论逐字节不变）· 派发输入表的行集。
- **不做**：从散文抽宾语（`owner-less`）· 差分恒真 · `<!-- non-normative -->` 段落标记。三条都属于另一类缺陷——评审读不懂语义，而本相位只判形状。

## Change history

| Version | date | summary | author |
|---|---|---|---|
| v0.5 | 2026-11-20 | 评审第 3 轮回填（一条 blocker · 七条 warn · 一条 nit 全数采纳）：§2.2 把引擎三串（含 `#canonicalArtifacts` 的 artifact 偏移句）全数移出 `carrier.notes` 并落在 soft violation 上 · §1.1 破坏性字节登记扩成五处（含 `REVIEW_ITEM_HEAD` 的判词句、`SEVERITY_RUBRIC` 整表、`FIX_SHELL`）· 读侧投影改用与写侧词表分开的三值联合、`#tierRankOf` 三级不动 · §2.1 板面 note 走 `displayReason` 同一道展示折叠 · §3.1 定义 `Files` 行语法与方言臂 · §3.2 写清 `depends-on-cycle` 的站位（`graph` 门在前）与公开读面（`validate()` 的 `cycle` issue）· §4 判词句归 `REVIEW_ITEM_HEAD`、源码注释面点名八处 · 零命中扫改成 `\bnit\b` 词边界 | Oscaner M. · Claude（kairos:cdd-fix） |
| v0.4 | 2026-11-20 | 评审第 2 轮回填（三条 blocker · 八条 warn · 两条 nit 全数采纳）：`findingsOf` 分写侧与读侧，存量 `nit` 的下一跳经 `NextStepRouter` 与相位前同一跳 · 零命中簿扩到 `SEVERITY_RUBRIC` 整表与三处源码注释 · `DependsOn` 读成一般有向图并复用 `TaskGraph#cycleMember`、括号内多 id 逐个判 · brief 的 note 读注明取自哪一条载体、经 `LineCarriers` 的 `notesOf(record)`、落在 `## Constraints` 之后 · `notesOf(record)` 的读覆盖两种 plane 并放宽 findings 数组守卫 · 引擎自己的两串不进两个面 · 降级标记在前、`notes +M` 在后 · 验收臂改挂（任务号 · 动词 · 路径）投影 · 章程 D70 两格同批 · 版本行为 v0.2 补回后的连续谱 | Oscaner M. · Claude（kairos:cdd-fix） |
| v0.3 | 2026-11-20 | 编排者回填（grilling 追加裁定）：`warn` 档的代价写进 `expression-only` 的 `duty`——欠一个 fix 轮、不复评——并加一条成对臂钉住那句。不加第七行判据（省掉 `census:criteria.rows` 与两份 P37 文档的四处引用），不改名 `warn`（那会把判档从「它是什么」改成「它要多少」） | Oscaner M. · Claude（kairos:cdd-design） |
| v0.2 | 2026-11-20 | 评审第 1 轮回填：`rollup` 的非 blocker 臂写成「任一非 `blocker`」并补存量 `nit` 的读法 · pin 表保持 Create-only 而判据投影单列 · `Create:` 判据的候选集收窄到带声明的路径 · `notes` 的两个承载面各给名字（板面行 token `notes +M` · wave 线的 brief 段）· `renderRubric` 的第三档守卫标为新守卫并给出可数面 · 消费面换成渲染面 + 发布面（补 fix 壳与四个图表源、README 家族、孪生 pin）· 新增 §5 章程回填 | Oscaner M. · Claude（kairos:cdd-fix） |
| v0.1 | 2026-11-20 | 首版。三笔：档位收两档（词表与判据表同批）· `notes` 转正为承载面（brief 与板面）· 任务块两族判据（`Create:` 唯一且最早 · 悬挂与成环） | Oscaner M. · Claude（kairos:cdd-design） |
