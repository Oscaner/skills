---
title: 'P42 · 评审面的两档收口：档位、承载面与任务块判据'
doc-type: plan
version: v0.3
date: 2026-11-20
slug: 2026-11-20-engine-doc-tooling-p42-design
base: develop
---

## Constraints

- 三条新规则行先以告警档上线，Task 8 的末步把它们的档位抬到阻断；那条「没有一条规则停在告警档」的断言到那时成立，此前不成立是登记在案的过渡态。
- **波次即依赖层**：每个无依赖的任务各占一层，层宽不超过三个；当前分层是 `{1,4}` → `{2,3}` → `{5,6}` → `{7,9}` → `{8}`。
- **一处定义**：档位词表只住 `contract/review-criteria.ts#CRITERIA_ROWS` 与 `session/ledger.ts#FindingSeverity` 各一处；`Files` 行的文法只住 `contract/task-blocks.ts`；`face/` 不新起第二份清单。
- **读侧与写侧分开**：写入面收两档，读回面对存量载体的 `nit` 保持可读（投影成三值联合，见 spec §1.1）。这不是豁免层——它是一条边界归一，由成对用例钉住两个方向。
- **对外字节**：这一刀的破坏面被 spec §1.1 逐处点名，每一处都走 changeset minor；`next:` 行与退出码这两样不在其中，改动它们需要单独的理由。
- **引擎只拒不改**：任何拒绝都不移动、不改写、不删除文档；恢复归编排器。
- 这份计划自己也要过它正在立的那道门：坐标、读数、时序词三样都不写进判据面，工作项行不算散文。
- **实现前窗口的预期红**：本 plan 是语料的一行。三条新规则行起步 `warn`，故窗口内它们对语料零拒绝；但 `contract/__tests__/rules-severity.test.ts` 的 pin「declares no `warn` row in the shipped registry」（`RULE_REGISTRY.filter((row) => row.severity === "warn")` 为空）读的正是已发注册表，**第一条新行落地（Task 4）就把它判红**，Task 8 的翻位才把它恢复绿。同一窗口里 `contract/__tests__/rules.test.ts` 的行数断言也随行数走：Task 4 的 `single-create` 落地即红，Task 5 同批把注释与数字改到批后总分值（33 doc-scope + 2 ledger-scope = 35）才转绿。故 `pnpm run validate` 在 Task 4–7 之间预期红、Task 8 闭合后转绿——这两条红都是登记在案的过渡态，不是实现者的回归，实现者不得为「保住绿」提前翻位或跳门。语料规模常量随本文件上调（Task 1 持有该步）。

### Task 1: 档位词表与判决面

#### Objective
把**写侧**档位词表收成两档，并让判决面按档位判而不是按「有没有 finding」判。写入面（载体的 `severity` 枚举）收两档；读回面对存量载体保持可读——这一对不对称是 spec §1.1 的核心，不是过渡补丁。既有 `warn` 的行为逐字节不变。

`rollup` 不是本任务的改动面而是**守恒条件**：它的判法本就按档位（`blockers > 0 ? CHANGES_REQUESTED : findings.length > 0 ? REVIEW_FIX : APPROVED`），本任务只把它钉成四臂验收，源码一格不动。**读侧不收窄**：`findingsOf` 的取值集照旧是 `blocker` / `warn` / `nit`，装它的是投影面自己声明的三值联合（与写侧 `FindingSeverity` 分开声明，不复用），`RoundFinding.severity` 与 `#tierRankOf` 的入参都挂这三值。`#tierRankOf` 的三级排名 2 / 1 / 0 逐字节保留——把 `nit` 并进 `warn` 会静默丢掉存量 `warn → nit` 的降级标记。改变的只有写侧词表。

#### Files
- Modify: `packages/cdd-engine/src-next/session/ledger.ts`（写侧 `FindingSeverity` 收成两值；投影面另立 `"blocker" | "warn" | "nit"` 联合给 `RoundFinding.severity`，与写侧词表分开声明）
- Modify: `packages/cdd-engine/src-next/session/handoff-schema.ts`（`CARRIER` 的 `findings.items.severity` enum 收两档；`findingsOf` 与 `#tierRankOf` 一字不动；`rollup` 一字不动）
- Modify: `packages/cdd-engine/src-next/face/capsule.ts`（档位计数随投影走，不读三值字面）
- Create: `packages/cdd-engine/src-next/session/__tests__/tier-vocabulary.test.ts`

#### Consumes
- `session/handoff-schema.ts#HandoffSchema.rollup` 与它周边两个判据（P41 的证据面判据 · 改档判据）——同一处投影的既有住户
- `session/handoff-schema.ts#CARRIER` 的 `findings.items.severity` 与 `#HandoffSchema.schemaText` 的 `#writable(plane)` 过滤——写侧 enum 的唯一来源
- `session/ledger.ts#Ledger#round` → `session/next.ts#NextStepRouter.next` 的 review 臂（按投影条数分流）
- `packages/cdd-engine/src-next/contract/pins.ts#corpusOf` 的语料根声明——扫描覆盖由夹具证明，不靠手写计数

#### Produces
- 写侧 `FindingSeverity` 的取值集恰为 `blocker` 与 `warn`
- 投影面 `"blocker" | "warn" | "nit"` 三值联合与写侧词表分开声明
- `CARRIER` 的 `severity` enum 两值；`schemaText("judge", false)` 的围栏同批两值，`schemaText("work", …)` 的围栏不含 `severity`
- `HandoffSchema.rollup` 的四臂守恒（源码不动）：含 blocker ⇒ `CHANGES_REQUESTED`；任一非 blocker 的 finding（含存量 `nit`）⇒ `REVIEW_FIX`；零 finding ⇒ `APPROVED`

#### Steps
- 收写侧 `FindingSeverity` 为两值，投影面另立三值联合 — checkable: `tier-vocabulary.test.ts` 断言写侧拒 `nit`（报文点名两值）、读侧把 `nit` 原样读回三值联合（成对：同一份载体改 `warn` ⇒ 同一读数）
- `CARRIER` 的 enum 与 `schemaText` 围栏 — checkable: `schemaText("judge", false)` 里 `severity` 的 `enum` 恰为 `blocker` 与 `warn`；`schemaText("work", …)` 的围栏 `severity` 零命中（成对：只改那一处 enum ⇒ 两处同时变）
- `rollup` 四臂守恒 — checkable: 空 findings ⇒ `APPROVED`；仅 `warn` ⇒ `REVIEW_FIX`；仅 `nit` ⇒ `REVIEW_FIX`；含 `blocker` ⇒ `CHANGES_REQUESTED`；`warn` 与 `nit` 两臂的结论逐字节等于批前同一夹具的输出
- 存量载体的跳转成对臂 — checkable: 一份 findings 全为 `nit` 的存量载体过 `Ledger#round` ⇒ 结论 `REVIEW_FIX` 且 `next:` 走 fix 臂（不关线）；同一份把该档改 `warn` ⇒ 与批前逐字节同一跳；零条 findings ⇒ `APPROVED` 且走关线臂
- 降级标记成对臂 — checkable: 上一轮 `warn`、本轮同一条降为 `nit` 的存量载体 ⇒ `#tierRankOf` 判降级、`regradeNote` 给标记，与批前同一份 fixture 逐字节相同（成对：本轮那一档写成 `warn` ⇒ 无标记）
- `capsule` 的档位计数改读投影 — checkable: 三值字面在该文件零命中
- 提交 — checkable: `git log -1 --format=%s` 以 `feat(p42):` 起头

#### Acceptance
写侧两档、读侧容错的成对对读同时成立：一份老载体带 `nit` 能读回并保持 `REVIEW_FIX` 与 fix 臂，一份新载体带 `nit` 被拒。`rollup` 四臂成立且 `warn` / `nit` 两臂与批前逐字节相等；`#tierRankOf` 的三级排名与降级标记一字不动，`schemaText` 的两面围栏随同一份 `CARRIER` 走。

#### DependsOn
none

### Task 2: 判据表的两条行改判

#### Objective
判据表**删档不删行**：两条原 `nit` 行改判 `warn`，`expression-only` 的正文重写成「这条观察该去哪」，`regrade-mark` 的三格一个字节不动。同一批给 `renderRubric` 加第二条守卫——落在 `TIER_ORDER` 之外的行被静默跳过，正文消失而不报。

表内带 `nit` 字面的格恰五格，逐格点名，不留一格给实现者补。**替换字节按英文原样钉死**（这张表经 `CRITERIA.renderRubric()` 渲进每一条 review 指令，是英文散文；零命中扫面只找 `\bnit\b`，换成哪种语言它都看不见）：

- `evidence-missing`（`blocker`）的 `counterExample`：`` A warn or a nit may leave `evidence` out — nobody adopts its conclusion on its word — so the absence is legal there, while the same absence on a blocker ships a decision nobody can check. `` ⇒ `` A warn may leave `evidence` out — nobody adopts its conclusion on its word — so the absence is legal there, while the same absence on a blocker ships a decision nobody can check. ``
- `debt-consequence`（`warn`）的 `counterExample`：`` Dead code that nothing calls today and no output depends on is a warn, not a nit: it changes what the next reader believes, which is the warn / nit boundary itself. `` ⇒ `` Dead code that nothing calls today and no output depends on is a warn: it changes what the next reader believes, which is the warn boundary itself. ``——**整句两端都换**：`nit` 在这句里出现两次，只换尾半句就是让实现者自己发明开头换成什么。
- `expression-only` 的 `body`：`` A finding is a nit when it is pure expression: naming, line-wrapping, comment wording, ordering inside one file — it changes neither behaviour nor anyone's judgment. `` ⇒ `` Pure expression — naming, line-wrapping, comment wording, ordering inside one file — is a `notes` line, not a finding: it changes neither behaviour nor anyone's judgment, and a finding that stays must name the judgment it changes. ``
- 同一行的 `duty`：`` A nit owes why it is not a warn: one sentence saying which judgment it leaves untouched. `` ⇒ `` A warn here owes two halves: the judgment it changes, and this tier's price — a fix round owed, and no re-grade of that round. ``
- 同一行的 `counterExample`：`` A naming inconsistency that stays self-consistent inside one file is a nit, not a warn: no cross-surface reader is misled. `` ⇒ `` A naming inconsistency that stays self-consistent inside one file is a `notes` line, not a finding: no cross-surface reader is misled. ``——它正是回答「这类观察现在去哪」的那一格，而验收的零命中扫面读的是整张 `SEVERITY_RUBRIC`。

#### Files
- Modify: `packages/cdd-engine/src-next/contract/review-criteria.ts`（`CriteriaTier` 与 `TIER_ORDER` 收两档；两条行改判 `warn`；上列五格按英文原样替换；`renderRubric` 增表外档守卫；`warn` 档的代价写进 `expression-only` 的 `duty`；`CRITERIA_ROWS` 的表注释与 `CriteriaRegistry` 的两处档序注释同批改写）
- Test: `packages/cdd-engine/src-next/contract/__tests__/review-criteria.test.ts`

#### Consumes
- `contract/review-criteria.ts#CriteriaRegistry.renderRubric`——`SEVERITY_RUBRIC` 的唯一拼装点
- `contract/review-criteria.ts#regradeNote` 的两个调用点（`face/lifecycle.ts` · `face/board-view.ts#LineCarriers`）——`#tierRankOf` 收缩后它们不改
- `contract/review-criteria.ts#CRITERIA_ROWS` 的表注释与 `CriteriaRegistry` 类的文档注释 · `renderRubric` 的文档注释——按档数行的三处散文

#### Produces
- `CriteriaTier` 与 `TIER_ORDER` 收两档；`CRITERIA_ROWS` 行数不变（`census:criteria.rows = 6`）
- 五格的替换字节落地；`regrade-mark` 的三格一个字节不动
- `renderRubric` 对表外档抛错（新守卫，不是既有行为）
- `expression-only` 的 `duty` 点名「欠一个 fix 轮，且不对它复评」
- 三处注释去掉逐档计数、只留「每档至少一行」与六条边界名（`blocker` 两条：functional impact · reproduction gate；`warn` 四条：the debt · the pin parseability gate · the expression boundary · the downgrade mark）

#### Steps
- 收 `CriteriaTier` 与 `TIER_ORDER` 为两档 — checkable: `review-criteria.test.ts` 断言取值集恰两值
- 两条原 `nit` 行改判 `warn`；五格按上列字节替换 — checkable: 行数不变；整张 `CRITERIA.renderRubric()` 的渲染结果按 `\bnit\b` 扫零命中（成对：只把 `regrade-mark` 的 `tier` 改回 `nit` ⇒ 第三档落表外、`renderRubric` 的第二条守卫同时红）
- `expression-only` 的 `duty` 写进档位代价 — checkable: 断言该格的字符串含 fix 轮与「不复评」两处；删掉那句 ⇒ 该用例红
- `renderRubric` 增表外档守卫 — checkable: 一份带 `nit` 行的注册表 ⇒ 抛错（成对：删掉那一行 ⇒ 正常渲染）
- 三处注释改写 — checkable: `CRITERIA_ROWS` 的表注释与 `CriteriaRegistry` 的两处档序注释都不带逐档计数，六条边界名逐条可断言（成对：把 `regrade-mark` 的 `tier` 改回 `nit` ⇒ 第三条守卫与六名断言一起红）
- 提交 — checkable: `git log -1 --format=%s` 以 `feat(p42):` 起头

#### Acceptance
表仍旧是那些行、档只剩两档，而表外档从「静默消失」变成「抛错」。代价那一句住在判据行里，可被断言读；整张渲染表的 `nit` 零命中，注释不再按档计数而按边界命名。

#### DependsOn
1

### Task 3: `notes` 的承载面

#### Objective
把载体已有的 `notes` 槽从「声明但无人读」升为承载面：板面行 token 给它一个位置，wave 线的下一轮 brief 给它一段。转正的是「可读」，不是「可判」——它不进 `rollup`、不欠 `dispositions`、不跨线。引擎自己那几串不进 `notes`，而**盘上已有的载体由读面前缀谓词挡掉**，不等写侧的承诺。

#### Files
- Modify: `packages/cdd-engine/src-next/session/handoff-schema.ts`（`notes` 的读写面：读回投影与可写槽表）
- Modify: `packages/cdd-engine/src-next/face/board-view.ts`（`#readFresh` 的早退放宽成「无 `findings` 且无 `notes` ⇒ 空」；`notesOf(record)` 的读侧逐字节前缀谓词；行 token 追加 note 计数与逐条）
- Modify: `packages/cdd-engine/src-next/face/gate.ts`（wave 线的 brief 渲染把上一条本线载体的 `notes` 交给渲染器）
- Modify: `packages/cdd-engine/src-next/render/brief.ts`（brief 的 notes 段：逐条原样列出，不附加动作要求）
- Modify: `packages/cdd-engine/src-next/face/lifecycle.ts`（引擎自写的三串移出 `carrier.notes`，落到 soft violation）
- Modify: `packages/cdd-engine/src-next/contract/review-criteria.ts`（`displayReason` 从模块私有升为导出——降级标记与板面 note 共读这一个 fold，不复制第二份）
- Create: `packages/cdd-engine/src-next/session/__tests__/notes-channel.test.ts`

#### Consumes
- `session/handoff-schema.ts#CARRIER` 的 `notes` 槽与 `#writable` 的两平面表
- `face/board-view.ts#LineCarriers` 的载体读与解析缓存（note 投影与计数共用同一次读）
- `contract/review-criteria.ts#displayReason`——`regradeNote` 已在用的同一道展示折叠
- `render/brief.ts#BriefRenderer.render` 的既有入参（plan 文本 · 解析 · 任务号）

#### Produces
- 板面行 token 里的 note 计数与逐条（`notes +M`，按 token 的 `run` 求和）
- wave 线 brief 的 notes 段（doc 线不带该段）
- 载体 `notes` 只剩 child 自己写的内容
- 一条 note 不改变任何轮的结论
- 两个面的展示字节都过 `displayReason` 这一道 fold

#### Steps
- 读回投影与可写槽表按 spec §2.2 落 — checkable: 一条 note 的载体读出空 findings ⇒ 结论 `APPROVED`
- `#readFresh` 早退放宽 — checkable: 一份 work 轮载体（无 `findings`，只有一条 `notes`）⇒ 板面该 token 读 `notes +1`（成对：同一载体换成评审轮、note 一条 ⇒ 同一读数）
- 读侧逐字节前缀谓词 — checkable: 一份手搭载体、`notes` 恰装那条 artifact 偏移句 ⇒ 板面不印 `notes` 段、下一轮 brief 无 notes 节（成对：删掉那条 note ⇒ 两处都空）；一份载体带一条 child note 与一条引擎句 ⇒ 两个面只印 child 那条；一份 `notes` 是两条引擎 artifact 句（`report` + `test_evidence`）加三条 child note 的载体 ⇒ 两个面读三条
- 板面行 token 追加 note 形态 — checkable: 夹具里一份双 note 载体 ⇒ 行 token 出现在既有 findings 计数之后，逐条紧随；同一条线上 review 载体与 fix 载体各带一条 note ⇒ 两个 token 各读 `notes +1`（成对：两条 note 挪进同一份载体 ⇒ 那一个 token 读 `notes +2`）
- 展示折叠 — checkable: 一条带换行与 ` · ` 的 note ⇒ 板面单行单段（`; ` 与单空格），`carrier.notes` 存原文（成对：同一条 note 不带 break ⇒ 同一读数）
- wave 线的 brief 段 — checkable: 同一份载体走 wave 线 ⇒ brief 出现该段；走 doc 线 ⇒ 不出现（成对：只改线）
- 引擎三串移出 `carrier.notes` — checkable: 重跑一轮 review 的载体里 `notes` 不含引擎串；同一内容出现在 soft violation
- 不跨线 — checkable: 同一份载体进入下一条线的首轮 ⇒ 板面与 brief 都不读它
- 提交 — checkable: `git log -1 --format=%s` 以 `feat(p42):` 起头

#### Acceptance
`notes` 在两处可读、在结论里不可见、在下一条线里不继承；引擎自己的三串不再冒充 child 的观察，盘上的存量载体由读侧同一处谓词挡掉。

#### DependsOn
1

### Task 4: `Create:` 的声明集与唯一性

#### Objective
立 `single-create`：同一路径的 `Create:` 声明恰一条，且它的任务号小于该路径任何其他声明行所在的任务号。判据的前提是**两个面分开答**——**词表**答「这一段带什么动词」（五值：`create` / `modify` / `test` / `delete` + `other` 兜底），**声明集**答「这条路径有没有被认领」。`other` 那一格按首词语义再分两半：建（`Add:` · `新建：`）与改（`修改：` · `Modified`）**算认领**；免责标签（`Not in this task:` · `Not in this phase:`）· 核对与改名标签（`Confirm:` · `Verify:` · `Remove:` · `Rename:`）· 散文余量 · 括号里的 span **不算**。两个面分开，同一个缺陷的两种拼法才只有一个判决。

判据的路径 token 面同样要收全：`fileTokensOf` 的既有规则只给反引号 span，没有引号时余量整体算一个 token，而 `PinVocabulary.pathOf` 会把 `Create: a.ts、b.ts、c.ts` 那一段合成 token 当**一条**路径收下（带 `/` 且以 `.ts` 结尾，实测不是 `null`）——三个真文件因此一条声明都没有、还多出一条不存在的合成路径。故切分落在 `fileTokensOf` 内部（一处 tokenizer，验收波那一面与判据面同吃），同批改 `filePathsOf` 的文档注释。

#### Files
- Modify: `packages/cdd-engine/src-next/contract/task-blocks.ts`（`Files` 行的文法与方言投影：动词闭集 · 行内多动词的分段点 · 集外动词落 `other` 桶 · 无引号余量按分隔符再切 · `filePathsOf` 的文档注释同批改）
- Modify: `packages/cdd-engine/src-next/contract/invariants.ts`（新增一条策略类，接 `contract/invariants.ts#Invariant`）
- Modify: `packages/cdd-engine/src-next/contract/rules.ts`（`single-create` 行，起步 `warn`）
- Modify: `packages/cdd-engine/src-next/contract/declare.ts`（面图把该行的判面登记成 `decision`，不留缺口）
- Create: `packages/cdd-engine/src-next/contract/__tests__/single-create.test.ts`

#### Consumes
- `contract/task-blocks.ts#TaskBlock.fields` 的 `Files` 字段与 `#PlanTaskBlocksReader` 的块解析、`#fileTokensOf` 的既有 tokenizer
- `contract/pins.ts#PinVocabulary.pathOf`——路径形状的既有判定面（`null` 即不是路径形状）
- `contract/invariants.ts#Invariant` 的策略基类与 `Contract.stamped` 的盖章点
- `contract/declare.ts#ElementRegistry` 的面图行（P41 的 `FaceMap`）

#### Produces
- `Files` 行的（任务号 · 动词 · 路径）三元组投影，四类方言各给出读法
- 五值词表与认领白名单两个面分开落地
- `single-create` 规则行（`warn` 起步）
- 面图里 `#### Files` 与 `single-create` 的角色登记

#### Steps
- 落 `Files` 行文法与方言投影 — checkable: 四类方言各一条断言——`- Create:` 读 `create` · `- Modify (diagram evidence):` 读 `modify` · 行内 `- **Files**: Create …; Modify …` 读两段 · 第四类 `- **Files**: Modify: <p>；Create: <p>、<p>；Test: <p>` 读三段；`- 修改：` 与 `- Modified <p>` 读 `other`；行内 `;` / `；` / `、` / `·` 分段各段带自己的动词，无动词的段继承前一段
- 分隔符切分 — checkable: `Create: a.ts、b.ts、c.ts` 切出三条 token（成对：同一份 plan 里同一组声明写成第四类与写成行内反引号形 ⇒ 同一组 token、同一判决）；`filePathsOf` 的文档注释不再说「an unrecognized remainder is returned as one token」
- 路径形状过滤 — checkable: `PinVocabulary.pathOf(token) === null` 的 token（`<slug>` · 裸词 · 带 `#` 的成员）不进计数；两个任务各建一份不同的 `.changeset` 文件 ⇒ 零拒绝（成对：两行写同一条 `.changeset/p42-a.md` ⇒ 报）
- 行内去重 — checkable: 一行里同一条路径写两遍 ⇒ 一条声明（成对：第二遍挪进任务 5 ⇒ 报）
- 认领白名单 — checkable: 任务 3 `- Add:` 而任务 5 `- Create:` 同一路径 ⇒ 报（成对：两个任务都写 `- Add:` 同一路径 ⇒ 零拒绝；第三对：任务 3 `- Add:` 而任务 5 `- Modify:` ⇒ 零拒绝）；任务 3 `- 修改：` 而任务 5 `- Create:` ⇒ 报，任务 3 `- Modified <路径>` ⇒ 同一判决（成对：只改拼法，任务号与路径不动）
- 三条静默臂 — checkable: 任务 3 的 `- Modify: a.ts` 行在括号里引另一个同级文件名作范例、任务 7 `- Create: b.ts` ⇒ 零拒绝；任务 3 的 `- Not in this task: b.ts` 行指向同一份文件、任务 7 `- Create: b.ts` ⇒ 零拒绝；任务 3 `- Modify: a.ts`、任务 7 `- Create: b.ts` ⇒ 零拒绝（成对：任务 3 与任务 7 都写 `- Create: b.ts` ⇒ 报）
- 写判据本体 — checkable: 任务 3 `- Create:` 而任务 5 `- Modify:` ⇒ 零拒绝；两个任务都 `- Create:` ⇒ 报；任务 3 `- Modify:` 而任务 5 `- Create:` ⇒ 报（三条夹具只改任务号与动词）
- pin 表极性 — checkable: 一条 `- Modify: <未落地路径>` 的声明 ⇒ pin 审计照旧报那条未落地 pin；同一行换成 `- Create:` ⇒ 被豁免（成对：只改动词）
- 面图登记 — checkable: `FaceMap.gaps()` 在 plan 面为空（成对：拿掉该行的角色 ⇒ 非空）
- 提交 — checkable: `git log -1 --format=%s` 以 `feat(p42):` 起头

#### Acceptance
同一个缺陷的两种合法拼法给出同一个判决；`Create:` 之后 `Modify:` 是正常增量，不被判。词表之外的动词落 `other` 桶，而建与改的拼法在声明集里照样认领——两个面分开答，一个格才不同时回答两个问题。

#### DependsOn
none

### Task 5: 任务图的悬挂与成环

#### Objective
立 `dangling-task-ref` 与 `depends-on-cycle` 两行。前者判 `Consumes` · `Produces` 里 `（Task N）` 标记指向不存在的任务；后者判 `DependsOn` 构成的**一般有向图**（不是函数图）里的环。两条都不动字段的取值域——判的是图的性质，不是形状。

两条判词**各占一个不变量类**：`Invariant.name` 是字面量，`contract/__tests__/rules.test.ts` 逐行断言 `name === declaration.id`，一类只能载一个名字。两条共用一个类，第二条的报文就会带上第一条的判词——两条各一个类、两个名字、两条报文。共享的读面（`TaskGraph.validate()` · `TaskBlock.fields`）是 `Consumes`，不是共享策略。

环的读面写准：`#cycleMember` 返回的是 **Kahn 残值里的最小任务号**（`Math.min(...remaining)`），而残值既含环上成员也含传递地依赖环的任务，故它**不承诺是环上成员**。判据不建在旧注释的承诺上，也不新起第二个成员判定——它逐字节复用 `validate()` 那条 `GraphIssue` 的 `task` 与 `message`。同批把两处承诺过头的注释改成它读到的值：`GraphIssue.task` 的括注（「for a cycle — the lowest task inside the cycle」）与 `#cycleMember` 的类注释（「the lowest task closing a directed cycle」），`message` 与 `fix` 的字节一字不动。

#### Files
- Modify: `packages/cdd-engine/src-next/contract/invariants.ts`（新增**两个**策略类，各占一条规则行，各接 `contract/invariants.ts#Invariant`）
- Modify: `packages/cdd-engine/src-next/contract/rules.ts`（两行规则，起步 `warn`；`RULE_REGISTRY` 的类注释去掉逐 scope 计数，只留恒真的那一句）
- Modify: `packages/cdd-engine/src-next/session/graph.ts`（环的读面：`GraphIssue.task` 的括注与 `#cycleMember` 的类注释同批对齐 Kahn 残值最小值，`message` / `fix` 字节不动）
- Modify: `packages/cdd-engine/src-next/session/preflight.ts`（两行的判词站点与既有 `graph` 门的前后关系）
- Create: `packages/cdd-engine/src-next/contract/__tests__/task-graph.test.ts`
- Test: `packages/cdd-engine/src-next/contract/__tests__/rules.test.ts`（行数断言随三条新行改到 33 doc-scope + 2 ledger-scope = 35）

#### Consumes
- `contract/task-blocks.ts#TaskBlock.fields` 的 `DependsOn` · `Consumes` · `Produces`
- `session/graph.ts#TaskGraph.validate` 的既有逐节点判法与它交出的 `GraphIssue` 形状（`task` 的取值是 Kahn 残值最小，不是环上成员）
- `session/preflight.ts#PreFlight` 的 `graph` 门与 `doc-contract` 腿的既有顺序

#### Produces
- `dangling-task-ref` 与 `depends-on-cycle` 两行（`warn` 起步），各占一个不变量类、一个 `name`、一条报文
- `validate()` 的 `cycle` issue 被逐字节复用（`cycle@T{residue-min}: …`）
- 两处 `graph.ts` 注释改成残值最小值，`message` 字节不动
- `RULE_REGISTRY` 的类注释与 `rules.test.ts` 的行数断言同读一个新分值

#### Steps
- 悬挂臂 — checkable: `（Task 42）` 指向不存在的任务 ⇒ 报；同一行去掉标记 ⇒ 零拒绝；括号里带多个任务时逐个体判（其一不存在即报）；裸续写臂 `（Task 4 · 42）` 而 42 未声明 ⇒ 同一判决（成对：只改第二个 id 的 `Task` 前缀）
- 成环臂 — checkable: `DependsOn 3, 7` 且环从 7 闭合 ⇒ 在 `Contract().validate` 面上报 `depends-on-cycle`，报文逐字节等于 `TaskGraph.validate()` 那条 `cycle@T{n}: …`；无环链 ⇒ 零拒绝
- 残值臂 — checkable: 环是 3 ↔ 7 而任务 1 经 9 依赖 3 ⇒ 报文逐字节等于 `TaskGraph.validate()` 的 `cycle@T1: …`（`1` 是残值最小、不在环上）；判据不另判环成员、不改 `#cycleMember` 的报文
- 两条注释对齐残值 — checkable: `GraphIssue.task` 的括注与 `#cycleMember` 的类注释都读「Kahn 残值里的最小任务号」，两处都不再声称「inside the cycle」（成对：残值臂就是它们的反例）
- 两个类两个名字 — checkable: 两条声明的 `create().name` 分别等于各自的 `id`（`rules.test.ts` 的 name 断言绿），两条报文互不相同
- 判词站点 — checkable: 两条命中都出现在 `graph` 门之后的那一段，不抢既有门的结论
- 行数注释与新分值 — checkable: `contract/rules.ts` 里 `30 doc-scope` 零命中，`rules.test.ts` 的行数断言读 35（33 doc + 2 ledger）
- 提交 — checkable: `git log -1 --format=%s` 以 `feat(p42):` 起头

#### Acceptance
两条判据各有一对成对臂，且各占一个不变量类；悬挂的判域只覆盖带标记的行，散文不因形似而被判。环的报文逐字节复用 `TaskGraph.validate()`，残值臂成立而判据不另算成员。注册表的行数注释与断言同读一个新分值。

#### DependsOn
4

### Task 6: 消费面与发布孪生

#### Objective
把档位词表从所有**已发**的字面里收走。渲染面三处（判词句 · 修轮的义务清单 · 严重度 rubric 的 preamble/tail，其判据表那半自动跟随）· 发布面（四个图表源与 README 家族）· 源码注释面。发布面有孪生 pin 在读它，改完才绿；源码注释面按 spec §4 的两条断言分开扫两个树态。

#### Files
- Modify: `packages/cdd-engine/src-next/render/templates.ts`（判词句 · 修轮义务清单 · rubric 的 preamble/tail）
- Modify: `packages/cdd-engine/src-next/contract/review-criteria.ts`（模块头注释由本任务改写；`CRITERIA_ROWS` 的表注释与 `CriteriaRegistry` 的两处档序注释归 Task 2，本任务只按 §4 的登记面复核它们已零命中）
- Modify: `packages/cdd-engine/src-next/session/handoff-schema.ts`（`impact` · `evidence` · `gradingViolations` 三处注释）
- Modify: `packages/cdd-engine/src-next/session/ledger.ts`（`FindingSeverity` 注释）
- Modify: `packages/cdd-engine/src-next/face/capsule.ts`（结论注释）
- Modify: `packages/cdd-engine/src-next/session/next.ts`（模块头与 fix 臂两处注释）
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
- spec §4 的十二处源码注释登记表与它的唯一豁免行（`session/handoff-schema.ts#HandoffSchema.#tierRankOf` 的「blocker 2 · warn 1 · nit 0」）
- `scripts/__tests__/next-loop-twin.test.ts#warnNitReviewFix`——发布面的孪生 pin
- `docs/diagrams/README.md` 的重生成方式（HTML 不手改）

#### Produces
- 三处渲染面两档化
- 四个图表源与 README 家族的档位措辞两档化，孪生 pin 转绿
- 十二处源码注释面同批改写；`#tierRankOf` 排名注释是唯一保留的命中行

#### Steps
- 渲染面三处改两档 — checkable: `templates` 的既有断言里 `nit` 零命中（`\bnit\b` 词边界，`init` / `definition` 不算）
- 发布面改两档 — checkable: `next-loop-twin.test.ts` 绿；四个图表源里 `nit` 零命中
- 重生成图表 HTML — checkable: `pnpm run emit:check` 报 fresh（手改 HTML 会红）
- 源码注释面：登记完整性 — checkable: 读改写前的树（本相位起始提交），`packages/cdd-engine/src-next` 下非测试 `.ts` 的注释行按 `\bnit\b` 扫，命中集恰为 §4 点名的十二处加 `#tierRankOf` 那一行（共十三行），登记外多一行即红（一次性核对，不在交付树上复跑）
- 源码注释面：发布门 — checkable: 读交付树，命中集恰为 `#tierRankOf` 那一行（`blocker 2 · warn 1 · nit 0`），其余零命中（成对：把任一处登记项的 `nit` 字面留在交付树 ⇒ 红）
- 提交 — checkable: `git log -1 --format=%s` 以 `feat(p42):` 起头

#### Acceptance
已发字面里两档一处不留，而判据表那半个 rubric 自动跟随、不需要手改。源码注释面的两条断言各钉一个树态：登记完整性数十三行，发布门只容那一行豁免。

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
- `contract/judge.ts#Contract` 的 `doc-contract` 腿——判定章程那个 doc key 的面

#### Produces
- 章程五组回填落地，版本与前缀同步

#### Steps
- 按 spec §5 逐组改 — checkable: 五组各有一条可点的落点
- 版本与血缘行同批 — checkable: `change-history-latest-matches-front-matter` 绿
- 章程的判定输出由夹具钉住 — checkable: 一份带违例的章程夹具 ⇒ 对应规则行读 `failed`；同一份夹具改成合规 ⇒ 读 `passed`。**不拿本仓章程当判据**：它此刻为零拒绝这件事由 CLI 级语料跑覆盖，不由用例断言——章程改措辞不该让测试红
- 提交 — checkable: `git log -1 --format=%s` 以 `docs(p42):` 起头

#### Acceptance
章程的 P42 两行与 D 表两格、以及历史行同读一条路线；章程自己过自己那道门。

#### DependsOn
6

### Task 8: 翻位与交付

#### Objective
三条新规则行从 `warn` 翻到 `block`，自毁面烧掉；changeset 一包 minor（`cdd-engine`，D74）；全量门。

#### Files
- Modify: `packages/cdd-engine/src-next/contract/rules.ts`（三行翻位）
- Test: `packages/cdd-engine/src-next/contract/__tests__/rules-severity.test.ts`
- Create: `.changeset/p42-two-ranks.md`

#### Consumes
- `contract/rules.ts#RULE_REGISTRY` 的三条新行
- `contract/review-criteria.ts#CRITERIA_ROWS`（changeset 描述引它的两档）

#### Produces
- 三条新行读 `block`
- 一包（`cdd-engine`）minor 的 changeset
- 全量门绿

#### Steps
- 翻位 — checkable: 断言「无一规则声明 `warn`」为真；把任一行改回 `warn` ⇒ 该用例红
- changeset — checkable: 文件只列 `cdd-engine` 一个包，且是 minor（`kairos` 无消费面改动，不成 changeset——Tasks 1–7 不触 `packages/kairos/`）
- 全量门 — checkable: `pnpm run validate` 退出码为零
- 提交 — checkable: `git log -1 --format=%s` 以 `feat(p42):` 起头

#### Acceptance
门在闭合态是 `block`，自毁面可核；`cdd-engine` 那一条 minor 的发布声明在册，`kairos` 不被带进一次无字节变化的版本移动。

#### DependsOn
5

### Task 9: 验证面追溯

#### Objective
把「物料判自己」这一类收掉。章程的 D98 立了三条：规则行为由夹具判，打包物只经 `emit:check`，语料读数不进测试。本任务处置本仓现存的三族：章程字面断言 · 三处「对真实语料断言零 finding」 · 两处手写读数。

#### Files
- Modify: `packages/cdd-engine/src-next/contract/__tests__/charter-self-repair.test.ts`（删章程正文的字符串比对，只留引擎臂；补一条惰性臂）
- Modify: `packages/cdd-engine/src-next/contract/__tests__/doc-corpus.guard.test.ts`（补惰性臂）
- Modify: `packages/cdd-engine/src-next/contract/__tests__/pins.guard.test.ts`（语料规模常量删除；扫描覆盖由小树夹具证明；补惰性臂）
- Modify: `packages/kairos/tests/claim-shapes.test.ts`（措辞常量改成结构断言）
- Create: `packages/cdd-engine/src-next/contract/__tests__/scan-coverage.test.ts`

#### Consumes
- 章程的两条裁定正文与它点名的正反例
- 本相位 Task 4 与 Task 5 落地的三条规则行（惰性臂要有规则可失效）
- `contract/pins.ts#corpusOf` 的语料根声明

#### Produces
- 三处惰性臂：选择器永不匹配 ⇒ 规则报零候选、用例红
- 语料规模常量从测试里消失，覆盖由一棵已知小树证明
- `claim-shapes` 只判结构，不判措辞

#### Steps
- 删章程正文的字符串比对 — checkable: 该文件里针对章程正文的字符串断言零命中（成对：把章程正文改回旧措辞 ⇒ 该用例不红，引擎臂仍绿）
- 补三处惰性臂 — checkable: 每处置一份选择器永不匹配的注册表 ⇒ 用例红；恢复 ⇒ 绿
- 删语料规模常量并写小树夹具 — checkable: 该常量在测试里零命中；删掉夹具里一个语料根 ⇒ coverage 用例红
- `claim-shapes` 改结构断言 — checkable: 删掉某个 claim shape 的子弹行 ⇒ 红；只改一个措辞词 ⇒ 不红
- 提交 — checkable: `git log -1 --format=%s` 以 `test(p42):` 起头

#### Acceptance
三类各有一对成对臂，且「零 finding」从此能区分「干净」与「没跑」。

#### DependsOn
5

## Change history

| Version | date | summary | author |
|---|---|---|---|
| v0.2 | 2026-11-20 | 编排者回填（用户裁定 · 章程 D98）：新增 Task 9 验证面追溯并接第五波；删 Task 1 的语料规模常量步；Task 7 的章程判据改成夹具钉住引擎输出（不拿本仓章程当判据）；Task 8 改等 Task 7 | Oscaner M. · Claude（kairos:cdd-plan） |
| v0.2 | 2026-11-21 | 评审第 1 轮回填（六条 blocker · 九条 warn 全数采纳）：Task 1 把 `rollup` 从「三臂改动」改回守恒条件（四臂验收、源码不动），读侧三值联合与 `#tierRankOf` 三级排名明确不收窄，只有写侧 enum 与 `schemaText` 围栏收两档，并补存量 `nit` 的 `Ledger#round` → `next:` 成对臂与降级标记成对臂 · Task 2 逐格钉死 §1.2 五格的英文替换字节（`regrade-mark` 三格不动），补整张 `SEVERITY_RUBRIC` 的零命中臂，并把 `CRITERIA_ROWS` 表注释与 `CriteriaRegistry` 两处档序注释同批改写（去逐档计数、六条边界名） · Task 3 补 `#readFresh` 早退放宽与 work 轮载体臂、读侧逐字节前缀谓词三臂，`displayReason` 的导出与 `contract/review-criteria.ts` 进 Files · Task 4 把词表与声明集拆成两个面（`Add:` · `新建：` · `修改：` · `Modified` 在词表里是 `other`、在声明集里是认领），补三条静默臂、`Add:` / `修改：` / `Modified` 三组成对臂，以及第四类方言 · 分隔符切分 · `pathOf` 过滤 · 行内去重四条规则 · Task 5 改为两个不变量类两个名字，环的读面改述为 Kahn 残值最小（残值臂 `cycle@T1`），两处 `graph.ts` 注释同批对齐，`RULE_REGISTRY` 行数注释与 `rules.test.ts` 的 35 同批 · Task 6 的文件集补上五处源码注释文件，源码扫面拆成登记完整性（十三行）与发布门（一行豁免）两条断言 · Task 7 的章程验收换成 `doc-contract` 腿 · Task 8 的 changeset 收成一包 minor · Constraints 的「预期红」改述为 `rules-severity` 的 warn pin 与 `rules.test` 行数两条过渡红 · 历史行的波次改成与依赖边一致的 `{1,4} → {2,3} → {5,6} → {7,8}` | Oscaner M. · Claude（kairos:cdd-fix） |
| v0.1 | 2026-11-20 | 首版：八任务四波 `{1,4} → {2,3} → {5,6} → {7,8}`。切分按 spec 的三笔交付走：档位词表与判决面 · 判据表改判 · `notes` 承载 · `Create:` 判据 · 任务图 · 消费面与发布孪生 · 章程回填 · 翻位。正文按本相位自己在建的规则书写：判据只引 spec 的节号，不复述内部方法名——本相位的 spec 线为此付了九轮 | Oscaner M. · Claude（kairos:cdd-plan） |
