---
title: 'P42 · 评审面的两档收口：档位、承载面与任务块判据'
doc-type: plan
version: v0.5
date: 2026-11-20
slug: 2026-11-20-engine-doc-tooling-p42-design
base: develop
---

## Constraints

- 三条新规则行先以告警档上线，Task 8 的末步把它们的档位抬到阻断；那条「没有一条规则停在告警档」的断言到那时成立，此前不成立是登记在案的过渡态。
- **波次即依赖层**：每一层是声明的 `DependsOn` 边的闭包——无依赖的任务在第 1 层，其余每个任务的依赖全部落在前面某层，层宽不超过三个；按声明的边当前分层是 `{1,4}` → `{2,3,5}` → `{6,8,9}` → `{7}`（Task 8 的边只到 Task 5，故它与 Task 6 · Task 9 同层；Task 7 等 Task 6，落在末层）。末层是 Task 7，全量门的收口因此归它。
- **一处定义**：档位词表只住 `contract/review-criteria.ts#CRITERIA_ROWS` 与 `session/ledger.ts#FindingSeverity` 各一处；`Files` 行的文法只住 `contract/task-blocks.ts`；`face/` 不新起第二份清单。
- **读侧与写侧分开**：写入面收两档，读回面对存量载体的 `nit` 保持可读（投影成三值联合，见 spec §1.1）。这不是豁免层——它是一条边界归一，由成对用例钉住两个方向。
- **对外字节**：这一刀的破坏面被 spec §1.1 逐处点名，每一处都走 changeset minor；`next:` 行与退出码这两样不在其中，改动它们需要单独的理由。
- **引擎只拒不改**：任何拒绝都不移动、不改写、不删除文档；恢复归编排器。
- 这份计划自己也要过它正在立的那道门：坐标、读数、时序词三样都不写进判据面，工作项行不算散文。
- **实现前窗口的预期红**：本 plan 是语料的一行。三条新规则行起步 `warn`，故窗口内它们对语料零拒绝；但 `contract/__tests__/rules-severity.test.ts` 的 pin「declares no `warn` row in the shipped registry」（`RULE_REGISTRY.filter((row) => row.severity === "warn")` 为空）读的正是已发注册表，**第一条新行落地（Task 4）就把它判红**，Task 8 的翻位才把它恢复绿。同一窗口里 `contract/__tests__/rules.test.ts` 的行数断言也随行数走：Task 4 的 `single-create` 落地即红，Task 5 同批把注释与数字改到批后总分值（33 doc-scope + 2 ledger-scope = 35）才转绿。故 `pnpm run validate` 的红窗口两端是 **Task 4 落地**与 **Task 8 翻位**，不是 Task 4–7：按上面那条波次，Task 9 与 Task 8 同层（`{6,8,9}`）、Task 7 在末层（`{7}`），两者都在这条边界之后收口，故 Task 9 与 Task 7 头上的树必须已经是绿的——Task 8 的本层门与 Task 7 的末步各自这么要求。这两条红都是登记在案的过渡态，不是实现者的回归，实现者不得为「保住绿」提前翻位或跳门。语料规模常量不由任何任务上调——它在 Task 9 连同第二处手写读数一并删除。

### Task 1: 档位词表与判决面

#### Objective
把**写侧**档位词表收成两档，并让判决面按档位判而不是按「有没有 finding」判。写入面（载体的 `severity` 枚举）收两档；读回面对存量载体保持可读——这一对不对称是 spec §1.1 的核心，不是过渡补丁。既有 `warn` 的行为逐字节不变。

`rollup` 不是本任务的改动面而是**守恒条件**：它的判法本就按档位（`blockers > 0 ? CHANGES_REQUESTED : findings.length > 0 ? REVIEW_FIX : APPROVED`），本任务只把它钉成四臂验收，源码一格不动。**读侧不收窄**：`findingsOf` 的取值集照旧是 `blocker` / `warn` / `nit`，装它的是投影面自己声明的三值联合（与写侧 `FindingSeverity` 分开声明，不复用），`RoundFinding.severity` 与 `#tierRankOf` 的入参都挂这三值。`#tierRankOf` 的三级排名 2 / 1 / 0 逐字节保留——把 `nit` 并进 `warn` 会静默丢掉存量 `warn → nit` 的降级标记。改变的只有写侧词表。

#### Files
- Modify: `packages/cdd-engine/src-next/session/ledger.ts`（写侧 `FindingSeverity` 收成两值；投影面另立 `"blocker" | "warn" | "nit"` 联合给 `RoundFinding.severity` 与 `#tierRankOf` 的入参，与写侧词表分开声明）
- Modify: `packages/cdd-engine/src-next/session/handoff-schema.ts`（`CARRIER` 的 `findings.items.severity` enum 收两档；`#tierRankOf` 的三级排名 2 / 1 / 0 与函数体逐字节不动，但它的**入参类型**要从写侧 `FindingSeverity` 挪到投影面的三值联合——它按 `row.severity` 比档，而那一格挂三值，留着两值就是类型错，用 `as` 兜住等于把读侧在类型上又收窄一遍；`findingsOf` 与 `rollup` 一字不动）
- Create: `packages/cdd-engine/src-next/session/__tests__/tier-vocabulary.test.ts`

#### Consumes
- `session/handoff-schema.ts#HandoffSchema.rollup` 与它周边两个判据（P41 的证据面判据 · 改档判据）——同一处投影的既有住户
- `session/handoff-schema.ts#CARRIER` 的 `findings.items.severity` 与 `#HandoffSchema.schemaText` 的 `#writable(plane)` 过滤——写侧 enum 的唯一来源
- `session/ledger.ts#Ledger#round` → `session/next.ts#NextStepRouter.next` 的 review 臂（按投影条数分流）

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
- Modify: `packages/cdd-engine/src-next/face/board-view.ts`（`#readFresh` 的早退放宽成「无 `findings` 且无 `notes` ⇒ 空」；`notesOf(record)` 的读回投影与读侧逐字节前缀谓词；行 token 追加 note 计数与逐条）
- Modify: `packages/cdd-engine/src-next/face/gate.ts`（wave 线的 brief 渲染从 `DispatchScene` 的 `ledger` 经 `notesOf(record)` 取 notes：只读本线 `(line, key)` 上最后一条已完成的 **review 载体**（`(cycle, attempt)` 最大），不新起裸读）
- Modify: `packages/cdd-engine/src-next/render/brief.ts`（notes 段逐条原样列出，不附加动作要求；落在 `## Constraints` 镜像之后，`#taskBody` 的字节一字不动）
- Modify: `packages/cdd-engine/src-next/face/lifecycle.ts`（引擎自写的三串移出 `carrier.notes`，落到 soft violation；`#materialize` 的文档注释与 family 注释同批改到新落法——`AT MOST ONE WARN on the carrier's notes` 与 `silent on the warn channel` 两句不再存活）
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
- 板面 notes 的读回投影（`notesOf(record)`）— checkable: 把该投影对 `notes` 的读摘掉 ⇒ 板面 token 与 brief 段同时读零、用例红；恢复 ⇒ 一条 note 读 `notes +1`（成对：同一份载体删掉那条 note ⇒ 同一读数）
- `#readFresh` 早退放宽 — checkable: 一份 work 轮载体（无 `findings`，只有一条 `notes`）⇒ 板面该 token 读 `notes +1`（成对：同一载体换成评审轮、note 一条 ⇒ 同一读数）
- 读侧逐字节前缀谓词 — checkable: 一份手搭载体、`notes` 恰装那条 artifact 偏移句 ⇒ 板面不印 `notes` 段、下一轮 brief 无 notes 节（成对：删掉那条 note ⇒ 两处都空）；一份载体带一条 child note 与一条引擎句 ⇒ 两个面只印 child 那条；一份 `notes` 是两条引擎 artifact 句（`report` + `test_evidence`）加三条 child note 的载体 ⇒ 两个面读三条
- 板面行 token 追加 note 形态 — checkable: 夹具里一份双 note 载体 ⇒ 行 token 出现在既有 findings 计数之后，逐条紧随；同一条线上 review 载体与 fix 载体各带一条 note ⇒ 两个 token 各读 `notes +1`（成对：两条 note 挪进同一份载体 ⇒ 那一个 token 读 `notes +2`）
- 展示折叠 — checkable: 一条带换行与 ` · ` 的 note ⇒ 板面单行单段（`; ` 与单空格），`carrier.notes` 存原文（成对：同一条 note 不带 break ⇒ 同一读数）
- wave 线的 brief 段 — checkable: 同一份载体走 wave 线 ⇒ brief 出现该段；走 doc 线 ⇒ 不出现（成对：只改线）
- brief 的三处字节 pin（spec §2.1）— checkable: ① 来源——本线最后一条已完成的 **review** 载体带一条 note、其后一条已完成的 fix 载体也带一条 ⇒ brief 只印 review 那条（成对：把 fix 那条挪进 review 载体 ⇒ 两处都印）；② 位置——notes 段落在 `## Constraints` 镜像之后，且 `#taskBody` 的字节与它无涉（成对：把 notes 拼进 `#taskBody` ⇒ `Ledger#briefDrifted` 读真）；③ 板面 token 顺序——降级标记与 `notes +M` 同时在场时标记在前（成对：两者都在、只改拼接序 ⇒ 读数变）
- 引擎三串移出 `carrier.notes` — checkable: 重跑一轮 review 的载体里 `notes` 逐字节等于 child 的 `draft.notes`；同一内容出现在 soft violation
- 软通道的两笔后果（spec §2.2）— checkable: 同一份带非声明键的草稿 ⇒ stderr 恰一行 `CDD_WARN:`（报文 `dropped non-declared draft field(s): … — engine-reserved, never written`）且该行派生 `contractViolationCount` 抬一；成对：删掉那个非声明键 ⇒ stderr 静默、计数回到原值，而两份草稿的 `next:` 与退出码逐字节相同
- `#materialize` 的两句反话同批改 — checkable: 该函数的两处注释里 `AT MOST ONE WARN on the carrier's notes` 与 `silent on the warn channel` 零命中，改后的读法点名 soft 通道与它的两笔后果（成对：把任一句写回 ⇒ 红）；这两句都不带 `nit` 字面，§4 的登记-扫面门到不了它们，只能由本条钉住
- 不跨线 — checkable: 同一份载体进入下一条线的首轮 ⇒ 板面与 brief 都不读它
- 提交 — checkable: `git log -1 --format=%s` 以 `feat(p42):` 起头

#### Acceptance
`notes` 在两处可读、在结论里不可见、在下一条线里不继承；引擎自己的三串不再冒充 child 的观察，盘上的存量载体由读侧同一处谓词挡掉。三族改骑软通道的两笔后果可读：每个受影响的轮恰一行 `CDD_WARN:`、派生 `contractViolationCount` 抬一，而判决、`next:` 与退出码逐字节不动。

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
- Create: `packages/cdd-engine/src-next/contract/__tests__/single-create.test.ts`

#### Consumes
- `contract/task-blocks.ts#TaskBlock.fields` 的 `Files` 字段与 `#PlanTaskBlocksReader` 的块解析、`#fileTokensOf` 的既有 tokenizer
- `contract/pins.ts#PinVocabulary.pathOf`——路径形状的既有判定面（`null` 即不是路径形状）
- `contract/invariants.ts#Invariant` 的策略基类与 `Contract.stamped` 的盖章点

#### Produces
- `Files` 行的（任务号 · 动词 · 路径）三元组投影，四类方言各给出读法
- 五值词表与认领白名单两个面分开落地
- `single-create` 规则行（`warn` 起步）

#### Steps
- 落 `Files` 行文法与方言投影 — checkable: 四类方言各一条断言——`- Create:` 读 `create` · `- Modify (diagram evidence):` 读 `modify` · 行内 `- **Files**: Create …; Modify …` 读两段 · 第四类 `- **Files**: Modify: <p>；Create: <p>、<p>；Test: <p>` 读三段；`- 修改：` 与 `- Modified <p>` 读 `other`；行内 `;` / `；` / `、` / `·` 分段各段带自己的动词，无动词的段继承前一段
- 分隔符切分 — checkable: `Create: a.ts、b.ts、c.ts` 切出三条 token（成对：同一份 plan 里同一组声明写成第四类与写成行内反引号形 ⇒ 同一组 token、同一判决）；`filePathsOf` 的文档注释不再说「an unrecognized remainder is returned as one token」
- 路径形状过滤 — checkable: `PinVocabulary.pathOf(token) === null` 的 token（`<slug>` · 裸词 · 带 `#` 的成员）不进计数；两个任务各建一份不同的 `.changeset` 文件 ⇒ 零拒绝（成对：两行写同一条 `.changeset/p42-a.md` ⇒ 报）
- 行内去重 — checkable: 一行里同一条路径写两遍 ⇒ 一条声明（成对：第二遍挪进任务 5 ⇒ 报）
- 认领白名单 — checkable: 任务 3 `- Add:` 而任务 5 `- Create:` 同一路径 ⇒ 报（成对：两个任务都写 `- Add:` 同一路径 ⇒ 零拒绝；第三对：任务 3 `- Add:` 而任务 5 `- Modify:` ⇒ 零拒绝）；任务 3 `- 修改：` 而任务 5 `- Create:` ⇒ 报，任务 3 `- Modified <路径>` ⇒ 同一判决（成对：只改拼法，任务号与路径不动）
- 三条静默臂 — checkable: 任务 3 的 `- Modify: a.ts` 行在括号里引另一个同级文件名作范例、任务 7 `- Create: b.ts` ⇒ 零拒绝；任务 3 的 `- Not in this task: b.ts` 行指向同一份文件、任务 7 `- Create: b.ts` ⇒ 零拒绝；任务 3 `- Modify: a.ts`、任务 7 `- Create: b.ts` ⇒ 零拒绝（成对：任务 3 与任务 7 都写 `- Create: b.ts` ⇒ 报）
- 写判据本体 — checkable: 任务 3 `- Create:` 而任务 5 `- Modify:` ⇒ 零拒绝；两个任务都 `- Create:` ⇒ 报；任务 3 `- Modify:` 而任务 5 `- Create:` ⇒ 报（三条夹具只改任务号与动词）
- pin 表极性 — checkable: 一条 `- Modify: <未落地路径>` 的声明 ⇒ pin 审计照旧报那条未落地 pin；同一行换成 `- Create:` ⇒ 被豁免（成对：只改动词）
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
- Create: `packages/cdd-engine/src-next/contract/__tests__/task-graph.test.ts`
- Test: `packages/cdd-engine/src-next/contract/__tests__/rules.test.ts`（行数断言随三条新行改到 33 doc-scope + 2 ledger-scope = 35）

#### Consumes
- `contract/task-blocks.ts#TaskBlock.fields` 的 `DependsOn` · `Consumes` · `Produces`
- `session/graph.ts#TaskGraph.validate` 的既有逐节点判法与它交出的 `GraphIssue` 形状（`task` 的取值是 Kahn 残值最小，不是环上成员）
- `session/preflight.ts#PreFlight` 的 `graph` 门与 `doc-contract` 腿的既有顺序

#### Produces
- `dangling-task-ref` 与 `depends-on-cycle` 两行（`warn` 起步），各占一个不变量类、一个 `name`、一条报文
- `validate()` 的 `cycle` issue 的 `task` 与 `message` 两半被逐字节复用，判据报出的渲染形是 `cycle@T{task}: {message}`——与 `graph` 门 `details` 那一行同一个字节面
- 两处 `graph.ts` 注释改成残值最小值，`message` 字节不动
- `RULE_REGISTRY` 的类注释与 `rules.test.ts` 的行数断言同读一个新分值

#### Steps
- 悬挂臂 — checkable: `（Task 42）` 指向不存在的任务 ⇒ 报；同一行去掉标记 ⇒ 零拒绝；括号里带多个任务时逐个体判（其一不存在即报）；裸续写臂 `（Task 4 · 42）` 而 42 未声明 ⇒ 同一判决（成对：只改第二个 id 的 `Task` 前缀）
- 成环臂 — checkable: `DependsOn 3, 7` 且环从 7 闭合（夹具声明任务 1 · 2 · 3 · 7，1 与 2 无依赖先被 Kahn 摘掉，环上只剩 3 与 7，故残值恰为 `{3, 7}`）⇒ 在 `Contract().validate` 面上报 `depends-on-cycle`，报文逐字节等于 `cycle@T3: a directed dependency cycle closes over task 3: task dependencies must form a DAG`——两半各有出处：`message` 与 `task` 逐字节复用 `TaskGraph.validate()` 那条 `GraphIssue` 的两格，`cycle@T{task}: ` 前缀由 `session/preflight.ts` 的 graph 门 `details` 拼出、**不在** `validate()` 的 `message` 里，故这一臂与 graph 门读同一个字节面，而不是给判据另编一句；无环链 ⇒ 零拒绝
- 残值臂 — checkable: 环是 3 ↔ 7 而任务 1 经 9 依赖 3 ⇒ 报文逐字节等于 `cycle@T1: a directed dependency cycle closes over task 1: task dependencies must form a DAG`（`1` 是残值最小、不在环上；渲染形同 `graph` 门的 `details` 那一行）；判据不另判环成员、不改 `#cycleMember` 的报文
- 两条注释对齐残值 — checkable: `GraphIssue.task` 的括注与 `#cycleMember` 的类注释都读「Kahn 残值里的最小任务号」，两处都不再声称「inside the cycle」（成对：残值臂就是它们的反例）
- 两个类两个名字 — checkable: 两条声明的 `create().name` 分别等于各自的 `id`（`rules.test.ts` 的 name 断言绿），两条报文互不相同
- 行数注释与新分值 — checkable: `contract/rules.ts` 里 `30 doc-scope` 零命中，`rules.test.ts` 的行数断言读 35（33 doc + 2 ledger）
- 提交 — checkable: `git log -1 --format=%s` 以 `feat(p42):` 起头

#### Acceptance
两条判据各有一对成对臂，且各占一个不变量类；悬挂的判域只覆盖带标记的行，散文不因形似而被判。环的报文逐字节复用 `TaskGraph.validate()` 的 `task` 与 `message` 两半、渲染形与 graph 门同一句，残值臂成立而判据不另算成员。注册表的行数注释与断言同读一个新分值。

#### DependsOn
4

### Task 6: 消费面与发布孪生

#### Objective
把档位词表从所有**已发**的字面里收走。渲染面是两处 prompt 字面（`REVIEW_ITEM_HEAD` 的判词句 · `FIX_SHELL` 的修轮义务清单）加整张 rubric（`SEVERITY_RUBRIC` = `CRITERIA.renderRubric()` 的渲染，判据表那半随 Task 2 自动跟随；它的 `RUBRIC_PREAMBLE` / `CALIBRATION_TAIL` 不带档位词，本任务不动）· 发布面（四个图表源与 README 家族）· 源码注释面。发布面有孪生 pin 在读它，改完才绿；源码注释面按 spec §4 的两条断言分开扫两个树态。

#### Files
- Modify: `packages/cdd-engine/src-next/render/templates.ts`（`REVIEW_ITEM_HEAD` 的判词句 · `FIX_SHELL` 里 `Fix ALL findings (blocker/warn/nit)` 那一句；`FIX_TYPED_INSTRUCTIONS` 被 `FIX_SHELL` 展开引用、自身不带档位词，`RUBRIC_PREAMBLE` / `CALIBRATION_TAIL` 同理不动）
- Modify: `packages/cdd-engine/src-next/contract/review-criteria.ts`（模块头注释由本任务改写；`CRITERIA_ROWS` 的表注释与 `CriteriaRegistry` 的两处档序注释归 Task 2，本任务只按 §4 的登记面复核它们已零命中）
- Modify: `packages/cdd-engine/src-next/session/handoff-schema.ts`（`impact` · `evidence` · `gradingViolations` 三处注释）
- Modify: `packages/cdd-engine/src-next/session/ledger.ts`（`FindingSeverity` 注释）
- Modify: `packages/cdd-engine/src-next/face/capsule.ts`（结论注释 `any blocker ⇒ CHANGES_REQUESTED, warn/nit-only ⇒ REVIEW_FIX` 改两档措辞；该文件没有第二处档位字面，行内不重复此文件）
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
- `render/templates.ts#REVIEW_ITEM_HEAD` · `#FIX_SHELL`（第五处破坏性字节 `Fix ALL findings (blocker/warn/nit)` 就在它里面）· `#SEVERITY_RUBRIC` 的三处已发字面
- spec §4 的十二处源码注释登记表与它的唯一豁免行（`session/handoff-schema.ts#HandoffSchema.#tierRankOf` 的「blocker 2 · warn 1 · nit 0」）
- `scripts/__tests__/next-loop-twin.test.ts#warnNitReviewFix`——发布面的孪生 pin
- `docs/diagrams/README.md` 的重生成方式（HTML 不手改）

#### Produces
- 两处 prompt 字面与整张 rubric 两档化
- 四个图表源与 README 家族的档位措辞两档化，孪生 pin 转绿
- 十二处源码注释面同批改写；`#tierRankOf` 排名注释是唯一保留的命中行

#### Steps
- 渲染面改两档 — checkable: 对渲染出的字节 `REVIEW_ITEM_HEAD` · `FIX_SHELL` · `SEVERITY_RUBRIC` 按 `\bnit\b` 词边界扫零命中（`init` / `definition` 不算）；测试标题里的 `warn / nit` 不是断言，不在此臂的改动面
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
- 收口全量门 — checkable: 本任务落在末层（Constraints 的波次），故 `pnpm run validate` 在本任务头上退出码为零；章程最新一条历史行的日期沿用 `2026-11-20`（与本 plan 的 front matter 同日）是**约定，不是门**——读那格日期值的是 `charter-self-repair.test.ts` 的 `registration face: …` 用例，而那条用例归 Task 9（上一层 `{6,8,9}`）整条删除；本任务头上的树里没有判据钉日期值（`change-history-latest-matches-front-matter` 只判版本号，`change-history-date-shape` 只判 ISO 形状），故写别的日期不会红，本条不写成红
- 提交 — checkable: `git log -1 --format=%s` 以 `docs(p42):` 起头

#### Acceptance
章程的 P42 两行与 D 表两格、以及历史行同读一条路线；章程自己过自己那道门；本任务在末层收口，`pnpm run validate` 在它头上转绿。

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
- changeset — checkable: 文件只列 `cdd-engine` 一个包，且是 minor（`kairos` 无消费面改动，不成 changeset——无任何任务改 `packages/kairos/` 的消费面；Task 9 只动那一个测试面 `packages/kairos/tests/claim-shapes.test.ts`）
- 本层全量门 — checkable: `pnpm run validate` 退出码为零（本条只闭本层；末层的收口门归 Task 7，见 Constraints 的波次）
- 提交 — checkable: `git log -1 --format=%s` 以 `feat(p42):` 起头

#### Acceptance
门在闭合态是 `block`，自毁面可核；`cdd-engine` 那一条 minor 的发布声明在册，`kairos` 不被带进一次无字节变化的版本移动。

#### DependsOn
5

### Task 9: 验证面追溯

#### Objective
把「物料判自己」这一类收掉。章程的 D98 立了三条：规则行为由夹具判，打包物只经 `emit:check`，语料读数不进测试。本任务处置本仓现存的三族：章程字面断言 · 三处「对真实语料断言零 finding」 · 两处手写读数。

#### Files
- Modify: `packages/cdd-engine/src-next/contract/__tests__/charter-self-repair.test.ts`（删章程正文的字符串比对，只留引擎臂；补一条候选读数臂；头部 `Four pairs, each with its counter-arm` 改三对）
- Modify: `packages/cdd-engine/src-next/contract/__tests__/doc-corpus.guard.test.ts`（补惰性臂：`change-history-row-shape` 的候选读数）
- Modify: `packages/cdd-engine/src-next/contract/__tests__/pins.guard.test.ts`（语料规模常量删除；扫描覆盖由小树夹具证明；补惰性臂：`PinAudit.census` 的候选读数——临时语料上非零、空根上全零；头部两处「file count is a constant …」与「the file list is a pinned constant」、加 `CORPUS_SIZE` 的文档注释，改成「覆盖由已知小树夹具证明」的读法）
- Modify: `packages/kairos/tests/claim-shapes.test.ts`（措辞常量改成结构断言；`Two legs, both byte-level` 块与 `CLAIM_SHAPES` 的文档注释改成「措辞自由 · shape→规则 id 映射固定 · 两节点仍逐字节相同」的读法）
- Create: `packages/cdd-engine/src-next/contract/__tests__/scan-coverage.test.ts`

#### Consumes
- 章程的两条裁定正文与它点名的正反例
- 本相位 Task 4 与 Task 5 落地的三条规则行（惰性臂要有规则可失效）
- `contract/pins.ts#corpusOf` 的语料根声明

#### Produces
- 三处候选读数臂：`change-history-row-shape` 的临时根 · `PinAudit.census` 的临时语料（一条死 symbol pin 加一条死 path pin）与空根 · `measure-literal` 的面缺口，每处要求那条「零 finding」是测得的零
- 三份头部注释同步改到新落法（覆盖由已知小树证明 · 措辞自由而映射固定、两节点仍同措辞 · 三对）
- 语料规模常量从测试里消失，覆盖由一棵已知小树证明
- `claim-shapes` 只判结构，不判措辞；shape 前缀 → 规则 id 的映射常量（`pin` → `line-coordinate`；`count` → `measure-literal` · `live-arithmetic`；`narrative` → `temporal-indicator` · `line-coordinate`）

#### Steps
- 删章程正文的字符串比对 — checkable: 该文件里针对章程正文的字符串断言零命中（成对：把章程正文改回旧措辞 ⇒ 该用例不红，引擎臂仍绿）
- 补三处候选读数臂 — checkable: ① `doc-corpus.guard.test.ts#keeps change-history-row-shape within its recorded ceiling`：一棵只放一份文档的临时根、标题写成 `## Change history (archived)` ⇒ 那张表读出 `null`、候选 0、规则零 finding（成对：同一份文档用 `## Change history` 并写一行参差行 ⇒ 恰一条 finding）；② `pins.guard.test.ts#declares the whole corpus, pins its size, and holds it at zero findings`：`PinAudit.census` 的 `symbol` · `path` · `total` 三项是 **finding 计数**（同一次 `scan` 的分解），交付语料上三项恒为零（同文件那条零扫描 pin 说的就是这件事），故非空半边落在一棵临时语料上——`fixture()` 建的根里写一份文档、带一条死 symbol pin 与一条死 path pin（`#reports the seeded dead pins and stops reporting them after the repair` 的两个形状）⇒ `census.symbol > 0` · `census.path > 0` · `census.total > 0`；成对：空根 `census([])` 上三项各为 0，同臂补 `empty.symbol` 与 `empty.path` 两条断言（语料 ONE way 用例现只读 `files` 与 `total`，`symbol` 与 `path` 在空根上无处断言）。这一臂量的是 finding 条数，不是 `files`——`files` 是语料体量，两者不互替，交付语料那一半只留体量读数；③ `charter-self-repair.test.ts#reports nothing on the real charter — all three families at zero`：把已登记标题换成一个面表放不进的名字 ⇒ 标题下每一行落 `unmapped`、`measure-literal` 报 `this line sits under a heading with no declared face`（成对：保留标题 ⇒ 缺口 finding 消失）
- 删语料规模常量并写小树夹具 — checkable: 该常量在测试里零命中；删掉夹具里一个语料根 ⇒ coverage 用例红
- 三份头部注释同批改 — checkable: `pins.guard.test.ts` 那一份按**在场**读、三处各一条断言——`file count is a constant`（行内可见的片段：原句在盘上折成 `… and its` / `//     file count is a constant: …` 两行，整句 `its file count is a constant` 零命中，拿它当断言是改写前后都绿的假臂）· 头部的第二句 `the file list is a pinned constant` · `CORPUS_SIZE` 的文档注释 `pinned HERE, as a literal`——三处随常量一起改成「覆盖由已知小树夹具证明」的读法，漏一处即红；`claim-shapes.test.ts` 的 `Two legs, both byte-level` 与 `charter-self-repair.test.ts` 的 `Four pairs, each with its counter-arm` 两句按**零命中**读，且各自读新落法。成对：把任一处写回 ⇒ 红
- `claim-shapes` 改结构断言 — checkable: 三条臂——存在臂：删掉某个 claim shape 的子弹行 ⇒ 红；孪生臂：只改一个节点的某一个措辞词、两节点不再一致 ⇒ 红（成对：同一处措辞两个节点一起改 ⇒ 绿）；映射臂：把某个 shape 点名的规则 id 在两个节点上一起换成映射常量外的 id（两节点仍一致）⇒ 红（成对：只改措辞词 ⇒ 绿）
- 提交 — checkable: `git log -1 --format=%s` 以 `test(p42):` 起头

#### Acceptance
三类各有一对成对臂，且「零 finding」从此能区分「干净」与「没跑」。

#### DependsOn
5

## Change history

| Version | date | summary | author |
|---|---|---|---|
| v0.5 | 2026-11-21 | 评审第 3 轮回填（一条 blocker · 六条 warn · 一条 nit 全数采纳）：Task 9 的 pins 非空臂改成临时语料（一条死 symbol pin 加一条死 path pin），交付语料只留体量读数，空根半边补 `symbol` / `path` 两条断言 · Task 9 的头部注释臂取行内可见的 `file count is a constant`（原句在盘上折行、整句零命中），并补第二句与 `CORPUS_SIZE` 的文档注释 · Task 1 的 `#tierRankOf` 改成排名与函数体不动、入参类型挪到三值联合，并删掉指向语料的 `corpusOf` 行 · Task 5 的两条成环臂改成 `task` 与 `message` 两半复用、`cycle@T` 前缀归 graph 门 `details`，残值臂同批 · Task 7 的日期从「写别的就红」改成约定（读它的用例归 Task 9 删除） · Constraints 的预期红窗口改成 Task 4 落地到 Task 8 翻位，并点明 Task 9 与 Task 7 都在绿树上收口 | Oscaner M. · Claude（kairos:cdd-fix） |
| v0.4 | 2026-11-21 | 评审第 2 轮回填（一条 blocker · 十条 warn · 一条 nit 全数采纳）：Task 9 的三处惰性臂从「选择器永不匹配」改成按规则自己读面的候选读数（`change-history-row-shape` 的临时根 · `PinAudit.census` 的交付语料与空根 · `measure-literal` 的面缺口），同批补三份头部注释的改写 · `claim-shapes` 补存在 / 孪生 / 映射三臂与 shape→规则 id 的映射常量 · Task 6 的 prompt 面改指 `FIX_SHELL`、删掉 rubric 的 preamble/tail，零命中扫面改读渲染字节 · Task 3 补软通道的两笔后果（一行 `CDD_WARN:` · 派生计数抬一）、`#materialize` 的两句反话与 brief 的三处字节 pin，并去掉无改动的 `session/handoff-schema.ts` 行 · Task 1 的 `face/capsule.ts` 行与步归 Task 6 的注释面 · Task 4 去掉 `contract/declare.ts` 行与面图步 · Task 5 去掉 `session/preflight.ts` 行 · 波次按声明的边重述为 `{1,4} → {2,3,5} → {6,8,9} → {7}`，末层 Task 7 收口全量门 · Constraints 删掉「语料常量随本文件上调」 · Task 8 的 changeset 括号写准 Task 9 是测试面 | Oscaner M. · Claude（kairos:cdd-fix） |
| v0.3 | 2026-11-20 | 编排者回填（用户裁定 · 章程 D98）：新增 Task 9 验证面追溯并接第五波；删 Task 1 的语料规模常量步；Task 7 的章程判据改成夹具钉住引擎输出（不拿本仓章程当判据）；Task 8 按声明的边只等 Task 5 | Oscaner M. · Claude（kairos:cdd-plan） |
| v0.2 | 2026-11-21 | 评审第 1 轮回填（六条 blocker · 九条 warn 全数采纳）：Task 1 把 `rollup` 从「三臂改动」改回守恒条件（四臂验收、源码不动），读侧三值联合与 `#tierRankOf` 三级排名明确不收窄，只有写侧 enum 与 `schemaText` 围栏收两档，并补存量 `nit` 的 `Ledger#round` → `next:` 成对臂与降级标记成对臂 · Task 2 逐格钉死 §1.2 五格的英文替换字节（`regrade-mark` 三格不动），补整张 `SEVERITY_RUBRIC` 的零命中臂，并把 `CRITERIA_ROWS` 表注释与 `CriteriaRegistry` 两处档序注释同批改写（去逐档计数、六条边界名） · Task 3 补 `#readFresh` 早退放宽与 work 轮载体臂、读侧逐字节前缀谓词三臂，`displayReason` 的导出与 `contract/review-criteria.ts` 进 Files · Task 4 把词表与声明集拆成两个面（`Add:` · `新建：` · `修改：` · `Modified` 在词表里是 `other`、在声明集里是认领），补三条静默臂、`Add:` / `修改：` / `Modified` 三组成对臂，以及第四类方言 · 分隔符切分 · `pathOf` 过滤 · 行内去重四条规则 · Task 5 改为两个不变量类两个名字，环的读面改述为 Kahn 残值最小（残值臂 `cycle@T1`），两处 `graph.ts` 注释同批对齐，`RULE_REGISTRY` 行数注释与 `rules.test.ts` 的 35 同批 · Task 6 的文件集补上五处源码注释文件，源码扫面拆成登记完整性（十三行）与发布门（一行豁免）两条断言 · Task 7 的章程验收换成 `doc-contract` 腿 · Task 8 的 changeset 收成一包 minor · Constraints 的「预期红」改述为 `rules-severity` 的 warn pin 与 `rules.test` 行数两条过渡红 · 历史行的波次记为 `{1,4} → {2,3} → {5,6} → {7,8}`（八任务时代的读数；v0.3 引入 Task 9 后由 v0.4 按声明的边重述为 `{1,4} → {2,3,5} → {6,8,9} → {7}`） | Oscaner M. · Claude（kairos:cdd-fix） |
| v0.1 | 2026-11-20 | 首版：八任务四波 `{1,4} → {2,3} → {5,6} → {7,8}`。切分按 spec 的三笔交付走：档位词表与判决面 · 判据表改判 · `notes` 承载 · `Create:` 判据 · 任务图 · 消费面与发布孪生 · 章程回填 · 翻位。正文按本相位自己在建的规则书写：判据只引 spec 的节号，不复述内部方法名——本相位的 spec 线为此付了九轮 | Oscaner M. · Claude（kairos:cdd-plan） |
