---
title: 'P42 · 评审面的两档收口：档位、承载面与任务块判据'
doc-type: plan
version: v0.41
date: 2026-11-20
slug: 2026-11-20-engine-doc-tooling-p42-design
base: develop
---

## Constraints

- 四条新规则行（`single-create` · `dangling-task-ref` · `depends-on-cycle` · `change-history-newest-last`）先以告警档上线，Task 8 的末步把它们的档位抬到阻断；那条「没有一条规则停在告警档」的断言到那时成立，此前不成立是登记在案的过渡态。
- **波次即依赖层**：每一层是声明的 `DependsOn` 边的闭包——无依赖的任务在第 1 层，其余每个任务的依赖全部落在前面某层，层宽不超过三个；按声明的边当前分层是 `{1,4,10}` → `{2,3,5}` → `{6,8,9}` → `{7,11}`（Task 8 的边只到 Task 5，故它与 Task 6 · Task 9 同层；Task 7 等 Task 6；Task 11 等 Task 9——两笔改同一份守卫文件，先后有序）。末层是 Task 7 与 Task 11，全量门的收口归 Task 7——两个任务改同一份章程文件，层内次序写定在这里：Task 11 的语料迁移先落，Task 7 的收口门读的是迁移之后的树；Task 10 无依赖——它只要既有的 `doc-contract` 腿与门自己测得的 findings 那一格，与档位词表的落法无关。
- **一处定义**：档位词表只住 `contract/review-criteria.ts#CRITERIA_ROWS` 与 `session/ledger.ts#FindingSeverity` 各一处；`Files` 行的文法只住 `contract/task-blocks.ts`；`face/` 不新起第二份清单。
- **读侧与写侧分开**：写入面收两档，读回面对存量载体的 `nit` 保持可读（投影成三值联合，见 spec §1.1）。这不是豁免层——它是一条边界归一，由成对用例钉住两个方向。
- **对外字节**：这一刀的破坏面被 spec §1.1 逐处点名，每一处都走 changeset minor；`next:` 行与退出码这两样不在其中，改动它们需要单独的理由。
- **引擎只拒不改**：任何拒绝都不移动、不改写、不删除文档；恢复归编排器。
- 这份计划自己也要过它正在立的那道门：坐标、读数、时序词三样都不写进判据面，工作项行不算散文。
- **实现窗口的预期红（已闭合的记账）**：本 plan 是语料的一行。四条新规则行起步 `warn`，故窗口内它们对语料零拒绝；**翻位之后同样零拒绝**，对账写在 Task 5 的顺序行里（`skipWhenClosed: true` 豁免已闭合的历史表：81 份带 `## Change history` 表的文档里 71 份单调、10 份非单调，那 10 份全部由章程 `## Phase inventory` 的 `` ✔ Done（`file` · date） `` 单元格证明已闭合，故豁免；在飞的三份文档正是 `PinAudit.provenClosed` 在三个 doc 根上读假的全部——本 plan（新行走表头）与本 spec 逐行降，章程逐行升，三张表都单调（各表的端点不写进判据面——端点随本表的下一次新行陈旧，条件是判据）；顺序行声明 `docKeys: "all"`，章程那个 `overall` 键因此也在判域内，`charter-self-repair.test.ts#reports nothing on the real charter — both families at zero` 就是它在该键上的读数面——那条用例的 `new Contract().validate({…})` 不交 `closed`，`skipWhenClosed` 在那里不生效），Task 8 的绿收口与这一句读同一份对账；但 `contract/__tests__/rules-severity.test.ts` 的 pin「declares no `warn` row in the shipped registry」（`RULE_REGISTRY.filter((row) => row.severity === "warn")` 为空）读的正是已发注册表，**第一条新行落地（Task 4）就把它判红**，Task 8 的翻位才把它恢复绿。同一窗口里 `contract/__tests__/rules.test.ts` 的行数断言**不红**：它在波 1 回填里已按当时的注册表重基（`doc` 面三十 + `ledger` 面二 = 三十二），Task 5 欠的只是把同一份注释与那条标题再基到交付态（`doc` 面三十三 + `ledger` 面二 = 三十五），不是把一条已经关掉的红重开一遍。故 `pnpm run validate` 的红窗口由 **`single-create` 落地**打开（那是 `0a31b228`）、只有 **Task 8 的翻位**能关它，不是 Task 4–7 的整段。两端都已交付：窗口在 Task 4 的落地处打开、在 Task 8 的翻位处闭合，四条新规则行在注册表里读 `block`，`contract/__tests__/rules-severity.test.ts` 的 pin 在本 plan 头上是绿的。这一段此后只作历史记账——窗口内被读的那一处是那条 pin，不是行数断言；日后它或全量门转红，那是要查的回归，不再是这条已闭合的窗口。层内次序是这条窗口读得准的前提：`{6,8,9}` 里 Task 8 的翻位先落、Task 9 的删除后落，故窗口在 Task 8 自己的末步闭合——它的 `本层全量门` 读的是本层收口态，不是本层起点；Task 9 与 Task 7 头上的树因此必须已经是绿的（Task 9 排在翻位之后、Task 7 在末层）。`packages/kairos` 腿在窗口里不多出一条红，因为 `packages/kairos/tests/claim-shapes.test.ts` 的期望面逐字节钉住两个 skill 的 narrative 子弹：撤掉那两行里对 `temporal-indicator` 的点名与该常量同一次编辑落地（Task 4 的步），Task 9 只把那份常量换成结构断言。波次只给层，层内次序由这一句写定。那一处红当时是登记在案的过渡态，不是实现者的回归，实现者当时不得为「保住绿」提前翻位或跳门。Task 1 自己的夹具改写在 Task 1 内落地（读回报文的一处 pin 加五份假孩子草稿），故它当时落在红窗口**之内**、不是窗口之前：Task 1 头上的树当时带着窗口的那一处红（`contract/__tests__/rules-severity.test.ts` 的「无一规则声明 `warn`」pin——`contract/__tests__/rules.test.ts` 的行数断言在它头上读绿），Task 1 的交付当时因此只要求它自己那六条断言绿——章程最新一条版本行落在历史表末行且与 front matter 同版，`charter-self-repair.test.ts` 的那条顺序断言因此不红；那六条断言不属于这条窗口。语料规模常量不由任何任务上调——它在 Task 9 连同第二处手写读数一并删除。

### Task 1: 档位词表与判决面

#### Objective
把**写侧**档位词表收成两档，并让判决面按档位判而不是按「有没有 finding」判。写入面（载体的 `severity` 枚举）收两档；读回面对存量载体保持可读——这一对不对称是 spec §1.1 的核心，不是过渡补丁。既有 `warn` 的行为逐字节不变。

`rollup` 不是本任务的改动面而是**守恒条件**：它的判法本就按档位（`blockers > 0 ? CHANGES_REQUESTED : findings.length > 0 ? REVIEW_FIX : APPROVED`），本任务只把它钉成四臂验收，源码一格不动。**读侧不收窄**：`findingsOf` 的取值集照旧是 `blocker` / `warn` / `nit`，装它的是投影面自己声明的三值联合（与写侧 `FindingSeverity` 分开声明，不复用），`RoundFinding.severity` 与 `#tierRankOf` 的入参都挂这三值。`#tierRankOf` 的三级排名 2 / 1 / 0 逐字节保留——把 `nit` 并进 `warn` 会静默丢掉存量 `warn → nit` 的降级标记。改变的只有写侧词表。

#### Files
- Modify: `packages/cdd-engine/src-next/session/ledger.ts`（写侧 `FindingSeverity` 收成两值；投影面另立 `"blocker" | "warn" | "nit"` 联合给 `RoundFinding.severity` 与 `#tierRankOf` 的入参，与写侧词表分开声明；该联合的声明处与 `RoundFinding.severity` 那一格各带一条文档注释，写明读侧为何保留第三值——存量 `nit` 行保留自己的格）
- Modify: `packages/cdd-engine/src-next/session/handoff-schema.ts`（`CARRIER` 的 `findings.items.severity` enum 收两档；`#tierRankOf` 的三级排名 2 / 1 / 0 与函数体逐字节不动，但它的**入参类型**要从写侧 `FindingSeverity` 挪到投影面的三值联合——它按 `row.severity` 比档，而那一格挂三值，留着两值就是类型错，用 `as` 兜住等于把读侧在类型上又收窄一遍；`CarrierValue.findings[].severity` 那一格从手写的三值字面改挂写侧 `FindingSeverity`——写侧词表因此有一个真读它的面；`findingsOf` 的投影行改挂三值联合、函数体里那句 `as FindingSeverity` 同批删掉（它不是「一字不动」的那一类：三值联合装得下它收窄后的取值，兜住它等于把读侧在类型上再收窄一遍）；`rollup` 一字不动）
- Create: `packages/cdd-engine/src-next/session/__tests__/tier-vocabulary.test.ts`
- Test: `packages/cdd-engine/src-next/session/__tests__/handoff-schema.test.ts`（读回报文的那一处 pin 改两值）
- Test: `packages/cdd-engine/src-next/face/__tests__/lifecycle.test.ts`（四处假孩子草稿的 `nit` 改 `warn`，一处 `.toBe("nit")` 的读数同批改）
- Test: `packages/cdd-engine/src-next/face/__tests__/cli.test.ts`（一处假孩子草稿的 `nit` 改 `warn`）

#### Consumes
- `session/handoff-schema.ts#HandoffSchema.rollup` 与它周边两个判据（P41 的证据面判据 · 改档判据）——同一处投影的既有住户
- `session/handoff-schema.ts#CARRIER` 的 `findings.items.severity` 与 `#HandoffSchema.schemaText` 的 `#writable(plane)` 过滤——写侧 enum 的唯一来源
- `session/ledger.ts#Ledger#round` → `session/next.ts#NextStepRouter.next` 的 review 臂（按投影条数分流）

#### Produces
- 写侧 `FindingSeverity` 的取值集恰为 `blocker` 与 `warn`，且它有一个消费者：载体写侧的类型孪生 `session/handoff-schema.ts#CarrierValue.findings[].severity` 挂它，不另写三值字面
- 投影面 `"blocker" | "warn" | "nit"` 三值联合与写侧词表分开声明，装 `RoundFinding.severity`、`#tierRankOf` 的入参与 `findingsOf` 的投影行；后者不再用 `as FindingSeverity` 兜底；联合的声明处与 `RoundFinding.severity` 那一格各带一条文档注释（读面三值、写面两值，存量 `nit` 行保留自己的格），这两处是 Task 6 发布门的豁免项
- `CARRIER` 的 `severity` enum 两值；`schemaText("judge", false)` 的围栏同批两值，`schemaText("work", …)` 的围栏不含 `severity`
- `HandoffSchema.rollup` 的四臂守恒（源码不动）：含 blocker ⇒ `CHANGES_REQUESTED`；任一非 blocker 的 finding（含存量 `nit`）⇒ `REVIEW_FIX`；零 finding ⇒ `APPROVED`

#### Steps
- 收写侧 `FindingSeverity` 为两值，投影面另立三值联合 — checkable: `tier-vocabulary.test.ts` 断言写侧拒 `nit`（报文点名两值）、读侧把 `nit` 原样读回三值联合（成对：同一份载体改 `warn` ⇒ 同一读数）；同批 `grep -rnw FindingSeverity --include=*.ts packages/cdd-engine/src-next | grep -v __tests__` 只余三处——`session/ledger.ts` 的声明、`session/handoff-schema.ts` 的 import 与 `CarrierValue.findings[].severity` 那一格（`-w` 挡掉读侧那个 `RoundFindingSeverity` 的子串命中，`grep -v __tests__` 挡掉本任务自己新建的 `tier-vocabulary.test.ts`——那份夹具引这个类型两行，带测试面的读数比 shipped source 多，臂按 shipped source 读）（成对：`findingsOf` 留着那句 `as FindingSeverity` ⇒ 多出一处，读侧在类型上又被收窄一遍；`CarrierValue` 那格留着三值字面 ⇒ 写侧词表无人读，`nit` 分支的下一位读者删掉它时没有一道门会红）；同一步给那枚联合的声明处与 `RoundFinding.severity` 那一格各写一条文档注释，读法是「读面三值、写面两值，存量 `nit` 行保留自己的格」——这两处不是装饰：交付树上的 `\bnit\b` 发布门允许的恰是它们与 `#tierRankOf` 的排名注释（成对：把这两条注释写成「两值」⇒ 读面为何保留第三值没有读者）
- `CARRIER` 的 enum 与 `schemaText` 围栏 — checkable: `schemaText("judge", false)` 里 `severity` 的 `enum` 恰为 `blocker` 与 `warn`；`schemaText("work", …)` 的围栏 `severity` 零命中（成对：只改那一处 enum ⇒ 两处同时变）
- 夹具跟随写侧两值 — checkable: `handoff-schema.test.ts` 的 `refuses a judge draft with a missing findings array or a bad severity` 报文改读 `must be one of blocker | warn`；`lifecycle.test.ts` 的四份假孩子草稿（`a resolvable contract.path adds nothing — a dead one adds one warn and no refusal` 里两处、`carries the task face's lens on a wave round` 一处、喂 `injects nothing …` 与 `injects one warn on a wave round …` 的那份共享 `FINDING` 常量一处）与 `cli.test.ts` 的 `§8.7 — a findings-face draft carrying a stray status …` 一处一律改写 `warn`，同批把 `a resolvable …` 里 `.toBe("nit")` 的读数改 `warn`。成对：五份草稿留着 `nit` ⇒ 三份文件六条断言红，且红法是「轮被拒」——`severity` 在 `FINDING` 的 `required` 里，读回拒整份草稿（BLOCKED、`outcome.findings` 为空），不是无声丢格。读侧的两处 `nit` 夹具同批**不动**：`lifecycle.test.ts` 的 `CARRIER_BODY` 与 `cli.test.ts` 里 `ledger.persistHandoff` 直写的那份载体是存量载体的读面，改它们等于把读侧的容错臂删掉
- `rollup` 四臂守恒 — checkable: 空 findings ⇒ `APPROVED`；仅 `warn` ⇒ `REVIEW_FIX`；仅 `nit` ⇒ `REVIEW_FIX`；含 `blocker` ⇒ `CHANGES_REQUESTED`；`warn` 与 `nit` 两臂的结论逐字节等于批前同一夹具的输出
- 存量载体的跳转成对臂 — checkable: 一份 findings 全为 `nit` 的存量载体过 `Ledger#round` ⇒ 结论 `REVIEW_FIX` 且 `next:` 走 fix 臂（不关线）；同一份把该档改 `warn` ⇒ 与批前逐字节同一跳；零条 findings ⇒ `APPROVED` 且走关线臂
- 降级标记成对臂 — checkable: 上一轮 `warn`、本轮同一条降为 `nit` 的存量载体 ⇒ `#tierRankOf` 判降级、`regradeNote` 给标记，与批前同一份 fixture 逐字节相同（成对：本轮那一档写成 `warn` ⇒ 无标记）
- 注入面 — checkable: 判据平面零 `../session/` import（`rules.test.ts` 的 structure pin 照旧绿）；`graphIssues` 缺省 ⇒ `depends-on-cycle` 零 finding（成对：带环夹具填上它 ⇒ 恰一条）——这一对臂跑在 `Contract` 的直读面上（本相位的环夹具 `contract/__tests__/task-graph.test.ts`，归 Task 5），那里的一次注入就是这一行的活落点。`session/preflight.ts` 的 `doc-contract` 腿那一格是防御缝、不是第二条活载体：`graph` 门在它之前就带着 `details` 拒绝并返回，故那一格在可运行态里永远收到空集 ⇒ 复核实测后已删掉那一格（`ContractInput.graphIssues` 留在判据直读面作程序化注入）——故不得据此声称门把环交给了判据，两面各读同一个 `TaskGraph.detailLine` 的字节而互不传递（成对：门那一臂读拒绝报文里的 `details`，判据那一臂读直读面上的 finding，改那个拼装点两面同时变）
- 提交 — checkable: `git log -1 --format=%s` 以 `feat(p42):` 起头

#### Acceptance
写侧两档、读侧容错的成对对读同时成立：一份老载体带 `nit` 能读回并保持 `REVIEW_FIX` 与 fix 臂，一份新载体带 `nit` 被拒。`rollup` 四臂成立且 `warn` / `nit` 两臂与批前逐字节相等；`#tierRankOf` 的三级排名与降级标记一字不动，`schemaText` 的两面围栏随同一份 `CARRIER` 走。写侧词表有一个真读它的面，读侧的第三值仍由三值联合装着；两份夹具的六条断言同批改，本任务头上的树保持绿。

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
- 三处注释去掉逐档计数、只留「每档至少一行」与六条边界名（`blocker` 两条：functional impact · reproduction gate；`warn` 四条：the debt · the pin parseability gate · the expression boundary · the downgrade mark）；`CRITERIA_ROWS` 的 doc comment 另带一句「新 finding 的降级只剩 `blocker` → `warn` 这一档」（The one remaining tier）——写侧只剩两档之后，这句是那张表对「降档还能降到哪」的唯一教诲，它住这张表而不是 `#tierRankOf`、也不住 `regrade-mark` 的任何一格

#### Steps
- 收 `CriteriaTier` 与 `TIER_ORDER` 为两档 — checkable: `review-criteria.test.ts` 断言取值集恰两值
- 两条原 `nit` 行改判 `warn`；五格按上列字节替换 — checkable: 行数不变；整张 `CRITERIA.renderRubric()` 的渲染结果按 `\bnit\b` 扫零命中（成对：只把 `regrade-mark` 的 `tier` 改回 `nit` ⇒ 第三档落表外、`renderRubric` 的第二条守卫同时红）。同批把两处 counterexample 的 `toContain` pin 改读替换句的句尾——`debt-consequence` 的 `is a warn, not a nit` 改 `is a warn:`、`expression-only` 的 `is a nit, not a warn` 改 `` is a `notes` line, not a finding ``（两条旧串正是替换删掉的那半句，留着 ⇒ 两条 `toContain` 红，而替换本身是对的）
- `expression-only` 的 `duty` 写进档位代价 — checkable: 断言该格的字符串含 fix 轮与「不复评」两处；删掉那句 ⇒ 该用例红
- `renderRubric` 增表外档守卫 — checkable: 一份带 `nit` 行的注册表 ⇒ 抛错（成对：删掉那一行 ⇒ 正常渲染）；同批把 `covers every tier — a tier with no row throws at assembly` 的 `missingNit` 臂从「缺一档」改成「表外一档」——一条 `tier` 被断言成 `"nit"` 的行（`as` 越过收窄后的 `CriteriaTier`）⇒ `renderRubric` 抛表外档（成对：删掉那一行 ⇒ 正常渲染）。旧臂的 `CRITERIA_ROWS.filter((row) => row.tier !== "nit")` 在两值 `TIER_ORDER` 下返回整张表，永远不抛，故它必须跟着守卫换读法而不是留着
- 三处注释改写 — checkable: `CRITERIA_ROWS` 的表注释与 `CriteriaRegistry` 的两处档序注释都不带逐档计数，六条边界名逐条可断言（成对：删掉任一条边界名 ⇒ 该条断言红；把 `regrade-mark` 的 `tier` 改回 `nit` ⇒ 该档落表外、`renderRubric` 的第二条守卫抛错，而六名断言不动——六条名住的是静态表注释，没有一行的 `tier` 移动它的字节）；同一步把「新 finding 的降级只剩 `blocker` → `warn` 这一档」写进 `CRITERIA_ROWS` 的 doc comment（成对：删掉那句 ⇒ 该条注释断言红；把它写进 `#tierRankOf` 或 `regrade-mark` 的任一格 ⇒ 前者动到三级排名那一行、后者动到逐字节不动的那三格，两边都不行）
- 提交 — checkable: `git log -1 --format=%s` 以 `feat(p42):` 起头

#### Acceptance
表仍旧是那些行、档只剩两档，而表外档从「静默消失」变成「抛错」。代价那一句住在判据行里，可被断言读；整张渲染表的 `nit` 零命中，注释不再按档计数而按边界命名。

#### DependsOn
1

### Task 3: `notes` 的承载面

#### Objective
把载体已有的 `notes` 槽从「声明但无人读」升为承载面：板面行 token 给它一个位置，wave 线的下一轮 brief 给它一段。转正的是「可读」，不是「可判」——它不进 `rollup`、不欠 `dispositions`、不跨线。引擎自己那几串不进 `notes`，而**盘上已有的载体由读面前缀谓词挡掉**，不等写侧的承诺。

#### Files
- Modify: `packages/cdd-engine/src-next/face/board-view.ts`（`#readFresh` 的早退放宽成「无 `findings` 且无 `notes` ⇒ 空」；`notesOf(record)` 的读回投影与读侧逐字节前缀谓词（三族全收：两条装饰族字面 `dropped decorative draft field(s)` 与 `dropped non-declared draft field(s)`，加 artifact 族的句形 `artifact <slot>: declared path `，`<slot>` 取 `report` 与 `test_evidence`——谓词只写 artifact 那一族就漏掉另两族）；行 token 追加 note 计数与逐条）
- Modify: `packages/cdd-engine/src-next/face/gate.ts`（wave 线的 brief 渲染从 `DispatchScene` 的 `ledger` 经 `notesOf(record)` 取 notes：只读本线 `(line, key)` 上最后一条已完成的 **review 载体**（`(cycle, attempt)` 最大），不新起裸读）
- Modify: `packages/cdd-engine/src-next/render/brief.ts`（notes 段逐条原样列出，不附加动作要求；段标题是 `## Notes`（`BriefRenderer#notesSection` 拼出的那一行），段落在 `## Constraints` 镜像之后，`#taskBody` 的字节一字不动）
- Modify: `packages/cdd-engine/src-next/face/lifecycle.ts`（引擎自写的三串移出 `carrier.notes`，落到 soft violation；`#materialize` 的文档注释与 family 注释同批改到新落法——`AT MOST ONE WARN on the carrier's notes` 与行内片段 `silent on the warn` 两处不再存活）
- Modify: `packages/cdd-engine/src-next/contract/review-criteria.ts`（`displayReason` 从模块私有升为导出——降级标记与板面 note 共读这一个 fold，不复制第二份）
- Create: `packages/cdd-engine/src-next/session/__tests__/notes-channel.test.ts`
- Test: `packages/cdd-engine/src-next/face/__tests__/lifecycle.test.ts`（一条旧 `notes` 落点的 pin 与用例标题改到 soft 通道）
- Test: `packages/cdd-engine/src-next/face/__tests__/cli.test.ts`（7 条旧落点的 pin 改到 soft 通道）

#### Consumes
- `session/handoff-schema.ts#CARRIER` 的 `notes` 槽与 `#writable` 的两平面表
- `face/board-view.ts#LineCarriers` 的载体读与解析缓存（note 投影与计数共用同一次读）
- `contract/review-criteria.ts#displayReason`——`regradeNote` 已在用的同一道展示折叠
- `render/brief.ts#BriefRenderer.render` 的既有入参（plan 文本 · 解析 · 任务号）

#### Produces
- 板面行 token 里的 note 计数与逐条（`notes +M`，按 token 的 `run` 求和；追加在 `#summaryToken` 交付那串的末尾、即降级注记之后）
- wave 线 brief 的 notes 段（doc 线不带该段）
- 载体 `notes` 只剩 child 自己写的内容
- 一条 note 不改变任何轮的结论
- 板面的展示字节过 `displayReason` 这一道 fold；brief 的 notes 段印载体里存的原文（spec §2.1 的 brief 半句：逐条原样列出，不改写、不附加动作要求）

#### Steps
- 板面 notes 的读回投影（`notesOf(record)`）— checkable: 把该投影对 `notes` 的读摘掉 ⇒ 板面 token 与 brief 段同时读零、用例红；恢复 ⇒ 一条 note 读 `notes +1`（成对：同一份载体删掉那条 note ⇒ 同一读数）
- `#readFresh` 早退放宽 — checkable: 一份 work 轮载体（无 `findings`，只有一条 `notes`）⇒ 板面该 token 读 `notes +1`（成对：同一载体换成评审轮、note 一条 ⇒ 同一读数）
- 读侧逐字节前缀谓词 — checkable: 一份手搭载体、`notes` 恰装那条 artifact 偏移句 ⇒ 板面不印 `notes` 段、下一轮 brief 无 notes 节（成对：删掉那条 note ⇒ 两处都空）；一份载体带一条 child note 与一条引擎句 ⇒ 两个面只印 child 那条；一份 `notes` 是两条引擎 artifact 句（`report` + `test_evidence`）加三条 child note 的载体 ⇒ 两个面读三条；一份手搭载体、`notes` 装两条装饰族各一条（`dropped decorative draft field(s) outside their declared shape: dispositions — never written` 与 `dropped non-declared draft field(s): findings — engine-reserved, never written`）⇒ 板面不印那两条、下一轮 brief 的 notes 节同样空（成对：把其中任一条的前缀挪到句中而不是行首 ⇒ 该条照印——谓词是逐字节前缀，不是子串）
- 板面行 token 追加 note 形态 — checkable: 夹具里一份双 note 载体 ⇒ 行 token 读 `notes +2`，那一段追加在 `#summaryToken` 交付那串的**末尾**——拼接序 `verb · body · mark · +N · regrade note` 一位不动，新段接在降级注记之后（降级标记住在 `regradeNote` 交出的那一段的段首，故它自然排在 `notes +M` 之前）；同一条线上 review 载体与 fix 载体各带一条 note ⇒ 两个 token 各读 `notes +1`（成对：两条 note 挪进同一份载体 ⇒ 那一个 token 读 `notes +2`；两者都在、只把新段插到 `+N` 之后 ⇒ 降级注记被挤到后面，读数变——与 ③ 的字节 pin 同一条臂）
- 展示折叠 — checkable: 一条带换行与 ` · ` 的 note ⇒ 板面单行单段（`; ` 与单空格），`carrier.notes` 存原文（成对：同一条 note 不带 break ⇒ 同一读数）
- wave 线的 brief 段 — checkable: 同一份载体走 wave 线 ⇒ brief 出现该段；走 doc 线 ⇒ 不出现（成对：只改线）
- brief 的三处字节 pin（spec §2.1）— checkable: ① 来源——本线最后一条已完成的 **review** 载体带一条 note、其后一条已完成的 fix 载体也带一条 ⇒ brief 只印 review 那条（成对：把 fix 那条挪进 review 载体 ⇒ 两处都印）；② 位置——notes 段落在 `## Constraints` 镜像之后，且 `#taskBody` 的字节与它无涉（成对：把 notes 拼进 `#taskBody` ⇒ `Ledger#briefDrifted` 读真）；③ 板面 token 顺序——降级标记与 `notes +M` 同时在场时标记在前（成对：两者都在、只改拼接序 ⇒ 读数变）
- 引擎三串移出 `carrier.notes` — checkable: 重跑一轮 review 的载体里 `notes` 逐字节等于 child 的 `draft.notes`；同一内容出现在 soft violation
- 软通道的两笔后果（spec §2.2）— checkable: 同一份带非声明键的草稿 ⇒ stderr 恰一行 `CDD_WARN:`（报文 `dropped non-declared draft field(s): … — engine-reserved, never written`）且该行派生 `contractViolationCount` 抬一；成对：删掉那个非声明键 ⇒ stderr 静默、计数回到原值，而两份草稿的 `next:` 与退出码逐字节相同
- `#materialize` 的两句反话同批改 — checkable: 该函数的两处注释里 `AT MOST ONE WARN on the carrier's notes` 与 `silent on the warn` 零命中——两句都按**行内片段**读：前者的原句整句落在一行上，后者在盘上被折成两句（`… the drop is silent on the warn` / `channel — it cost …`），拿整句 `silent on the warn channel` 作断言是改写前后都绿的假臂（成对：把任一句写回 ⇒ 红；把 `silent on the warn` 读成整句 ⇒ 那条臂在未改的树上就读零，接不住它要接的反话）；改后的读法点名 soft 通道与它的两笔后果；这两句都不带 `nit` 字面，§4 的登记-扫面门到不了它们，只能由本条钉住
- 不跨线 — checkable: 同一份载体进入下一条线的首轮 ⇒ 板面与 brief 都不读它
- 既有 pin 跟随新落点 — checkable: 两份夹具重跑绿，逐处读新落点：① `a free-named declared artifact path is corrected to the canonical OUTPUT_* path + surfaced on the notes (find #5 self-derivation)`——载体 `toEqual` 里那两条 `artifact …` note 改到 soft violation，派生计数 `contractViolationCount` 仍读 0——该夹具只走 `dispatch.step()`，记录由 CLI 的 bookkeep 落地，派生面因此还没有可求和的行；两笔后果的读数臂住 `notes-channel.test.ts` 的 Lifecycle 臂（软项入记录后 `counterOf` 读 1）；② `§8.7 — a non-declared / engine-reserved draft field is dropped with a single WARN, never a BLOCK …`——`carrier.notes` 长度 1 的 pin 改读 child 的 notes（本例空 ⇒ 该键缺席），而同一条的 `stderrText` 由空改读恰一行 `CDD_WARN:`；③ `§8.7 — a findings-face draft carrying a stray status …`——后两处同上；④ `D62 — a docs-fix round writes a WORK carrier with status`——键集由 `artifacts · dispositions · notes · status` 改 `artifacts · dispositions · status`（child 不写 notes 时载体不取该键），同用例那句 `((outcome.carrier?.notes ?? []) as string[]).join("\n")` 的 `toContain` 改读 soft 项——该键缺席后 `join` 读空串，故那句断言改写 `outcome.violations` 里那条 `dropped non-declared draft field(s): findings — engine-reserved, never written`（成对：载体 `notes` 留着引擎那串 ⇒ 该断言红）；⑤ `a decorative slot outside its declared shape is DROPPED, never a BLOCK (P34 T6 §2.1)`——`carrier.notes` 的 `toContain` 改读 soft violation（同一用例已有的 soft 断言就是它的新落点）；⑥ `a missing test-evidence file is a HARD violation of the round — the carrier keeps its declared status` 与 ⑦ `a MALFORMED test-evidence file → BLOCKED reporting the true cause (malformed JSON), never the misleading 'missing' (D27)`——`outcome.violations` 的长度与下标 pin 改读 hard 项的内容：软项排在 hard 项之前，故长度由 1 变 3、`[0]` 不再是 hard，读法改成按 `grade` 取那一条；同一用例的另外两处同批跟随——载体 `toEqual` 去掉 `notes` 键（两条 `artifact report` / `artifact test_evidence` 句改读 soft 项），派生计数 `contractViolationCount` 同上仍读 0（同一条只走 `dispatch.step()`；两笔后果的读数臂在 `notes-channel.test.ts`）；⑧ `lifecycle.test.ts` 的 `drops a judge-plane artifacts / notes outside its declared shape — two losses, ONE soft entry, a conforming carrier`——标题逐字节保留（它读的正是实测读数），断言读**恰一条** soft 项（装饰族那一句 `dropped decorative draft field(s) outside their declared shape: artifacts, notes — never written`），`carrier.notes` 缺席。该夹具的两格坏值都落在**声明**槽上（`{ artifacts: "nope", notes: 7 }`），`HandoffSchema.droppedKeys` 只收非声明键，故保留族不触发；要凑成两条 soft 项得另加一份带非声明键的夹具，那不在本任务的改动面。成对：上述任一 pin 留旧落点 ⇒ 该用例红
- 提交 — checkable: `git log -1 --format=%s` 以 `feat(p42):` 起头

#### Acceptance
`notes` 在两处可读、在结论里不可见、在下一条线里不继承；引擎自己的三串不再冒充 child 的观察，盘上的存量载体由读侧同一处谓词挡掉。三族改骑软通道的两笔后果可读：每个受影响的轮恰一行 `CDD_WARN:`、派生 `contractViolationCount` 抬一，而判决、`next:` 与退出码逐字节不动。

#### DependsOn
1

### Task 4: `Create:` 的声明集与唯一性

#### Objective
立 `single-create`：同一路径的 `Create:` 声明恰一条，且它的任务号**不晚于**认领该路径的任何其他声明行所在的任务号——只有严格更早的任务算「已认领」，同一任务里先写 `Create:`、再写 `Modify:` 同一路径是正常增量，不判。判据的前提是**两个面分开答**——**词表**答「这一段带什么动词」（五值：`create` / `modify` / `test` / `delete` + `other` 兜底），**声明集**答「这条路径有没有被认领」，而认领面**覆盖整张五值词表**（spec §3.1 ①）：四词表动词各按自己的拼法认领——`Test:` 与 `Delete:` 也认领，故任务 3 写 `- Delete: b.ts` 而任务 5 写 `- Create: b.ts`，与把那一行写成 `- Modify:` 同一判决，只有把那一行写成表外的散文标签才零拒绝。`other` 那一格再由**两张闭集**判、不靠语义：**建集**恰 `add` · `新建`，**改集**恰 `修改` · `modified`，两集都**算认领**——两张闭集只**加宽** `other` 桶，不顶替四词表动词；比较前先取标签首词、小写化、剥掉一个末尾冒号（`:` 与 `：` 都剥——这一步属认领面，动词面照旧只剥 ASCII 冒号，故 `- 修改：` 的动词记 `other`、认领落改集）；**其余一律不算认领**——免责标签（`Not in this task:` · `Not in this phase:`）· 核对与改名标签（`Confirm:` · `Verify:` · `Remove:` · `Rename:`）· 不在两集里的散文标签（`Script：` 一类）· 括号里的 span，四类都落在同一个默认上。判据因此是形态判断（词在不在集里），不是内容判断「首词在说建或改」：表外的新拼法不自动进集，要它算就加一个词加一条臂。两个面分开，同一个缺陷的两种拼法才只有一个判决。

判据的路径 token 面同样要收全：`fileTokensOf` 的既有规则只给反引号 span，没有引号时余量整体算一个 token，而 `PinVocabulary.pathOf` 会把 `Create: a.ts、b.ts、c.ts` 那一段合成 token 当**一条**路径收下（带已知扩展名 `.ts`、段内没有分隔符，故读作路径形状，实测不是 `null`）——三个真文件因此一条声明都没有、还多出一条不存在的合成路径。故切分落在 `fileTokensOf` 内部（一处 tokenizer，验收波那一面与判据面同吃），同批改 `filePathsOf` 的文档注释。

#### Files
- Modify: `packages/cdd-engine/src-next/contract/task-blocks.ts`（`Files` 行的文法与方言投影：动词闭集 · 行内多动词的分段点 · 集外动词落 `other` 桶 · 无引号余量按分隔符再切 · `filePathsOf` 的文档注释同批改；同批把认领面收全——`FileClaim` 不再把 `test` / `delete` 折成 `none`，`claimOf` 对四词表动词各给出自己的认领，两条注释同批改到同一读法：`FileClaim` 的类注释此刻说 `test` / `delete` 不认领，`claimOf` 的文档注释说四词表动词各按拼法认领，判据该读的是后者）
- Modify: `packages/cdd-engine/src-next/contract/invariants.ts`（新增一条策略类，接 `contract/invariants.ts#Invariant`；同批把 `MEASURE_UNITS` 收窄到英文五值、删掉 `MEASURE_LITERAL` 的 `第` 后顾与它那句「`行` is in the unit set」的理由，并把 `temporal-indicator` 的类 · 闭集 · 分句文法 · 模块头清单一条同批删除）
- Modify: `packages/cdd-engine/src-next/contract/rules.ts`（`single-create` 行，起步 `warn`）
- Create: `packages/cdd-engine/src-next/contract/__tests__/single-create.test.ts`
- Test: `packages/cdd-engine/src-next/contract/__tests__/shape-rules.test.ts`（比值臂的家：`P41 T2 — line-coordinate: the three declared shapes` 家族里加 `4.5:1` · `2.25:1` · `1.5:1` 三条比值与两条真 `path:line` 的反例——`line-coordinate` 的判据住这一份，`single-create.test.ts` 判的是声明集）
- Test: `packages/cdd-engine/src-next/contract/__tests__/pins.guard.test.ts`（pin 表极性臂的家：同一份未落地路径在 `- Modify:` 下被报、在 `- Create:` 下被豁免；这一对住在该文件里，本任务只按既有对补动词那一侧的读数）
- Test: `packages/cdd-engine/src-next/render/__tests__/templates.test.ts`（`temporal-indicator` 的夹具逐处删，标题与断言不留旧点名）
- Test: `packages/cdd-engine/src-next/contract/__tests__/charter-self-repair.test.ts`（`temporal-indicator` 的夹具删；两条标题按 spec §6 改名：`#reports nothing on the real charter — both families at zero` 与 `#reports the original wording: one bare measurement`）
- Test: `packages/kairos/tests/claim-shapes.test.ts`（期望面里 narrative 那一行与它的规则名映射随两个 skill 的子弹同一次编辑落地；结构断言与 `narrative` 映射的重定向归 Task 9，本任务只按「交付态上零命中」读它）
- Modify: `packages/kairos/skills/cdd-spec-writer/SKILL.md`（narrative 子弹删掉对 `temporal-indicator` 的点名，只留 `line-coordinate`）
- Modify: `packages/kairos/skills/cdd-plan/SKILL.md`（同一句同批删）

#### Consumes
- `contract/task-blocks.ts#TaskBlock.fields` 的 `Files` 字段与 `#PlanTaskBlocksReader` 的块解析、`#fileTokensOf` 的既有 tokenizer
- `contract/pins.ts#PinVocabulary.pathOf`——路径形状的既有判定面（`null` 即不是路径形状）
- `contract/invariants.ts#Invariant` 的策略基类与 `Contract.stamped` 的盖章点

#### Produces
- `Files` 行的（任务号 · 动词 · 路径）三元组投影，四类方言各给出读法
- 五值词表与认领白名单两个面分开落地——认领面覆盖四词表动词（`test` / `delete` 也认领），两张闭集只加宽 `other` 桶
- `single-create` 规则行（`warn` 起步）

#### Steps
- 落 `Files` 行文法与方言投影 — checkable: 四类方言各一条断言——`- Create:` 读 `create` · `- Modify (diagram evidence):` 读 `modify` · 行内 `- **Files**: Create …; Modify …` 读两段 · 第四类 `- **Files**: Modify: <p>；Create: <p>、<p>；Test: <p>` 读三段；`- 修改：` 与 `- Modified <p>` 读 `other`；行内 `;` / `；` / `、` / `·` 分段各段带自己的动词，无动词的段继承前一段；**集外首词也是标签**——段首的裸词（无冒号、无引号、无路径分隔符、无点，且后有空白）就是该段的标签，动词记 `other`、认领走两张闭集的默认，故散文式引子不继承前一段的动词与认领（成对：无标签的续段仍继承）；**语料臂**——`docs/kairos/plans/*.md` 整份读面零 `single-create` finding（语料是本判据的验收条件，一条误报就是判据读错了方言，本 plan 自己也在这一面上）
- 分隔符切分 — checkable: `Create: a.ts、b.ts、c.ts` 切出三条 token（成对：同一份 plan 里同一组声明写成第四类与写成行内反引号形 ⇒ 同一组 token、同一判决）；`filePathsOf` 的文档注释不再说「an unrecognized remainder is returned as one token」
- 路径形状过滤 — checkable: `PinVocabulary.pathOf(token) === null` 的 token（`<slug>` · 裸词 · 带 `#` 的成员）不进计数；两个任务各建一份不同的 `.changeset` 文件 ⇒ 零拒绝（成对：两行写同一条 `.changeset/p42-a.md` ⇒ 报）
- 行内去重 — checkable: 一行里同一条路径写两遍 ⇒ 一条声明（成对：第二遍挪进任务 5 ⇒ 报）
- 认领白名单 — checkable: 任务 3 `- Add:` 而任务 5 `- Create:` 同一路径 ⇒ 报（成对：两个任务都写 `- Add:` 同一路径 ⇒ 零拒绝；第三对：任务 3 `- Add:` 而任务 5 `- Modify:` ⇒ 零拒绝）；任务 3 `- 修改：` 而任务 5 `- Create:` ⇒ 报，任务 3 `- Modified <路径>` ⇒ 同一判决（成对：只改拼法，任务号与路径不动）；建集的第二个词单列一臂——任务 3 `- 新建：<路径>` 而任务 5 `- Create:` 同一路径 ⇒ 报（成对：同一任务 3 的 `- 修改：<路径>` ⇒ 零拒绝；`- Add:` 那几臂只认那一个词，故 `新建：` 不单列就无人判，而 spec 的验收臂点的正是它）；四词表动词那一半单列一臂——任务 3 `- Test: b.ts` 而任务 5 `- Create: b.ts` 同一路径 ⇒ 报，同一对里的 `- Test:` 换成 `- Delete:` ⇒ 同一判决（成对：把任务 5 的 `- Create:` 换成 `- Modify:` ⇒ 零拒绝；把任务 3 的那一行换成 `- Confirm: b.ts` ⇒ 零拒绝——`Confirm:` 不在四词表、也不在两张闭集里）
- 认领面收全四词表动词 — checkable: `single-create.test.ts` 的两任务夹具（任务 3 `- Delete: b.ts`、任务 5 `- Create: b.ts`）报一条 finding，报文点名任务 5 的 `Create:` 落在任务 3 之后；把任务 3 那一行写成 `- Test: b.ts` ⇒ 同一读数（成对：把任务 3 那一行写成 `- Modify:` ⇒ 报文同一条，而任务 5 那一行写成 `- Modify:` ⇒ 零拒绝）；`claimOf` 的取值不再把 `test` / `delete` 折成 `none`（成对：留着那个折叠 ⇒ 前两条读零，`- Modify:` 那一形照报——同一个缺陷换出两个判决，正是 spec §3.1 ① 要收的那一格）
- 三条静默臂 — checkable: 任务 3 的 `- Modify: a.ts` 行在括号里引另一个同级文件名作范例、任务 7 `- Create: b.ts` ⇒ 零拒绝；任务 3 的 `- Not in this task: b.ts` 行指向同一份文件、任务 7 `- Create: b.ts` ⇒ 零拒绝；任务 3 `- Modify: a.ts`、任务 7 `- Create: b.ts` ⇒ 零拒绝（成对：任务 3 与任务 7 都写 `- Create: b.ts` ⇒ 报）
- 写判据本体 — checkable: 任务 3 `- Create:` 而任务 5 `- Modify:` ⇒ 零拒绝；两个任务都 `- Create:` ⇒ 报；任务 3 `- Modify:` 而任务 5 `- Create:` ⇒ 报（三条夹具只改任务号与动词）；同一任务块里先写 `- Create: a.ts`、再写 `- Modify: a.ts` ⇒ 零拒绝（同一任务的两次认领是正常增量，判据比的是「不晚于」而不是「严格早于」；成对：把那条 `- Create:` 挪到任务 5、`- Modify:` 留在任务 3 ⇒ 报）
- 坐标文法的比值误判 — checkable: `4.5:1` · `2.25:1` · `1.5:1` 三种比值各一条用例全过，而 `cli.ts:41` 与 `contract/declare.ts:12` 照报（成对：两侧只差冒号前有无字母；三枚探针都带小数点、修前各报一条，故同向，而 `3:1` 不带点、修前就已通过，作探针两态同绿故不取，见 spec §8）。这一步改的是一个输入类的退出码（`line-coordinate` 是 `block` 行，故 `4.5:1` 一类由非零转零），而 Constraints 要求这类改动带单独理由，理由就记在这里：`path:line` 那一形要求冒号前至少含一个字母（文件名的必要条件），小数比值没有，故那一类是误报而不是判据——它是 §8 的 ⑨ **收回**，不是新增，`next:` 与既有拒绝报文一字不动。读数落在 `shape-rules.test.ts` 的 `P41 T2 — line-coordinate: the three declared shapes` 家族，不在本任务创建的 `single-create.test.ts` 里
- 词法代理退出 — checkable: `temporal-indicator` 在 `packages/cdd-engine/src-next` 上零命中——注册表那一行 · `contract/invariants.ts` 的类与闭集与分句文法与模块头清单 · `render/templates.ts#DOCS_FIX_SHAPE_RULES` 那一行（Task 10 在那里落三个名字，`temporal-indicator` 这一处是撤回的名字唯一不许存活的地方） · 三份夹具（`contract/__tests__/shape-rules.test.ts` · `render/__tests__/templates.test.ts` · `contract/__tests__/charter-self-repair.test.ts`）同批删净（第四处 `session/__tests__/fix-round-gate.test.ts` 由 Task 10 新建，那一行的写约束里本来就只有三个名字，故本任务不碰它——本任务若先声明它，那条 `Create:` 就落在本任务之后）；`MEASURE_UNITS` 只余英文五值（`passed` · `failed` · `tests` · `files` · `rows`），`MEASURE_LITERAL` 的 `第` 后顾与那句「`行` is in the unit set」的理由同批删——注释不再从一枚已离集的成员引理，`第 N 行` 由 `line-coordinate` 那一形独自持有，且留在它的三条形状里；带 `仍` 与 `今天` 的决策面夹具零拒绝（成对：英文闭集单位配数字照报）；同批把两条标题按 spec §6 改名——`#reports nothing on the real charter — all three families at zero` 改 `#reports nothing on the real charter — both families at zero`、`#reports the original wording: seven temporal indicators and one bare measurement` 改 `#reports the original wording: one bare measurement`，本 plan 对第一条标题的四处坐标同批改读新拼写；两个 skill 的 narrative 子弹与 `claim-shapes.test.ts` 的措辞常量同一次编辑落地（那份常量逐字节钉住那两行，先改一侧就让该文件的两条等式断言红，而那份常量住在 `packages/kairos` 腿上、不在本步的零命中扫面里），那份文件的结构断言与 `narrative` 映射归 Task 9（成对：留一处旧点名 ⇒ 该用例红；标题改名而四处坐标不改 ⇒ 四处坐标解析不到）
- pin 表极性 — checkable: 一条 `- Modify: <未落地路径>` 的声明 ⇒ pin 审计照旧报那条未落地 pin；同一行换成 `- Create:` ⇒ 被豁免（成对：只改动词）。读数落在 `pins.guard.test.ts`（该文件已有这一对的 `Create:` 夹具），`single-create.test.ts` 不接这一臂。spec §3.1 的**块外臂**未落成用例：`- Create: <未落地路径>` 写在任何 `### Task N:` 块之外 ⇒ pin 照旧豁免（`contract/pins.ts#ForwardPaths#declaredPathsOf` 保持全身扫面），且同一行不参与 `single-create` 的唯一性与顺序计数（它没有任务号可比）——本计划上 `块外` 与 `全身扫面` 两词零命中，两份夹具的 `Create:` 一律落在 `### Task N:` 块内（`pins.guard.test.ts` 的 `planBody` · `single-create.test.ts` 的 `planDoc`），语料里也不存在块外的 bullet `Create:`。这一臂的两半行为实测合规（手搭一份块外 `- Create:` 加一个只 `Modify:` 该路径的任务，直读 `Contract().validate` 读零条 finding），缺的是把这条结构决定钉住的那一臂；本任务已闭，该臂按残留登记、归下一个带 `may.amend` 的轮
- 提交 — checkable: `git log -1 --format=%s` 以 `feat(p42):` 起头

#### Acceptance
同一个缺陷的两种合法拼法给出同一个判决；`Create:` 之后 `Modify:` 是正常增量，不被判（判据是「不晚于」：只有严格更早的任务算已认领）。词表之外的动词落 `other` 桶，四词表动词各按自己的拼法在声明集里认领（`Test:` 与 `Delete:` 与 `Modify:` 同一判决），两张闭集只加宽 `other` 桶——两个面分开答，一个格才不同时回答两个问题。

#### DependsOn
none

### Task 5: 任务图的悬挂与成环

#### Objective
立 `dangling-task-ref` 与 `depends-on-cycle` 两行。前者判 `Consumes` · `Produces` 里 `（Task N）` 标记指向不存在的任务；后者判 `DependsOn` 构成的**一般有向图**（不是函数图）里的环。两条都不动字段的取值域——判的是图的性质，不是形状。

两条判词**各占一个不变量类**：`Invariant.name` 是字面量，`contract/__tests__/rules.test.ts` 逐行断言 `name === declaration.id`，一类只能载一个名字。两条共用一个类，第二条的报文就会带上第一条的判词——两条各一个类、两个名字、两条报文。共享的读面（`TaskGraph.validate()` · `TaskBlock.fields`）是 `Consumes`，不是共享策略。

环的读面写准：`#cycleMember` 返回的是 **Kahn 残值里的最小任务号**（`Math.min(...remaining)`），而残值既含环上成员也含传递地依赖环的任务，故它**不承诺是环上成员**。判据不建在旧注释的承诺上，也不新起第二个成员判定——它逐字节复用 `validate()` 那条 `GraphIssue` 的 `task` 与 `message`。同批把两处承诺过头的注释改成它读到的值：`GraphIssue.task` 的括注（「for a cycle — the lowest task inside the cycle」）与 `#cycleMember` 的类注释（「the lowest task closing a directed cycle」），`message` 与 `fix` 的字节一字不动。

同一次编辑收下另外两笔，因为行数面把它们绑在一处（spec §3.2 的「四条行同一次编辑落地」）：§6 的顺序行 `change-history-newest-last` 与 §8 的 `seat` 列。顺序行 `doc` 档、起步 `warn`、`skipWhenClosed: true`、自占一个策略类，判的是**单调**而不是「末行最新」：读面是 `contract/invariants.ts#Invariant.historyVersions` 的**行序相邻对**（逐对按 `versionRank` 比大小，任一对反号即一条），全升与全降都合法，一份没有 `## Change history` 表的文档它是零候选。**语料同批对账**（spec §6）：实测 81 份带表的文档里 71 份单调、10 份非单调，那 10 份全部由章程 `## Phase inventory` 的 `` ✔ Done（`file` · date） `` 单元格证明已闭合（`contract/pins.ts#PinAudit.provenClosed` 读的正是那两格），故 `skipWhenClosed` 把已闭合的历史表整类豁免；在飞的三份文档正是 `provenClosed` 读假的那三份：本 plan（新行走表头）与本 spec 逐行降，章程逐行升，三张表都单调，故本相位自己的派发与章程自己的判定都不被这一行拒。判域面因此写定：本行 `docKeys: "all"`（与五条既有历史行同形），章程那个 `overall` 键在判域内——`charter-self-repair.test.ts#reports nothing on the real charter — both families at zero` 以 `new Contract().validate({ docKey: "overall", … })` 跑整份契约、不交 `closed`，故 `skipWhenClosed` 在那里不生效，章程历史表的单调正是那条用例对本行的读数面。语料守卫不钉这一条：`doc-corpus.guard.test.ts` 的 `JudgedCorpus.load` 不交 `closed`，把这一条搭进 `PINNED_KINDS` 会让 10 份冻结的历史表一次性变红——那正是该文件头部写明的「spec 禁止迁移」，故它的臂住 Task 9 的合成表，语料那一半只留本段的对账。它的成对臂与候选臂住在 Task 9 的 `judge.test.ts` 合成表上（一处反号 ⇒ 恰一条；全升与全降各一态 ⇒ 零 finding），本任务只落这一行与注册表。`seat` 列落在 `contract/rules.ts#RuleDeclarationBase`：闭集 `dispatch` · `close` · `corpus` · `ledger` 的非空子集，doc 面三十三条各写前三值、ledger 面两条各写 `ledger`；读它的是 `contract/__tests__/rules.test.ts` 的逐 id 字面表（三十五条）与三条断言。两笔都必须落在 Task 8 之前——它翻的是四条行，而它的 `DependsOn` 只到本任务。

#### Files
- Modify: `packages/cdd-engine/src-next/contract/invariants.ts`（新增**三个**策略类，各占一条规则行，各接 `contract/invariants.ts#Invariant`——两条任务图判词加顺序行 `change-history-newest-last`）
- Modify: `packages/cdd-engine/src-next/contract/judge.ts`（`ContractInput` 加一个可选 `graphIssues` 格，`Contract.validate` 把它透传进 `JudgeContext` 那一格——两个声明各在各的家：`ContractInput` 住本文件，`JudgeContext` 与注入形状 `InjectedGraphIssue` 住 `contract/invariants.ts`（那一行已在本任务的文件集里，故不新增文件），本文件只 import 它们。判据平面不 import `session/`（`contract/__tests__/rules.test.ts` 的 structure pin 守着这条边），图的判词因此以注入面到达，与既有的 `taskLayers` 同形；填它的只有直读判据的那一面（`Contract.validate` 的调用方，如本相位的环夹具）；派发门的两条腿都不填——带环的 plan 在 `graph` 门就被拒、`doc-contract` 腿走不到，收口腿 `face/lifecycle.ts` 的 `#contract.validate` 同样观察不到一条 `graphIssues`，缺省即零候选）
- Modify: `packages/cdd-engine/src-next/contract/rules.ts`（三行规则，起步 `warn`——两条任务图判词加 §6 的顺序行；`RuleDeclarationBase` 加 `seat` 列（§8）；`RULE_REGISTRY` 的类注释按交付态写准三个数（`doc` 面三十三条 + `ledger` 面两条 = 三十五条，逐 scope 计数保留——spec §3.2 的唯一写法），形状面那句在波 1 回填里已读五条形状行与三个变量类（本任务按交付态复核，不改它）；`RuleDeclarationBase.skipWhenClosed` 的列注释**不在本任务的交付面上**：交付树仍读「the five shape rules do, the long-standing structural rules do not」，而同表上声明 `skipWhenClosed: true` 的行里含本任务落的 `change-history-newest-last` 这条非形状行，故那句与它索引的名册相反——spec §3.2 的重写项按残留登记、归下一个带 `may.amend` 的轮；头部「Version ORDER stays presentation, not data integrity」改成顺序腿有判据之后的读法）
- Modify: `packages/cdd-engine/src-next/session/graph.ts`（环的读面：`GraphIssue.task` 的括注与 `#cycleMember` 的类注释同批对齐 Kahn 残值最小值，`message` / `fix` 字节不动；环详情行的唯一拼装点落在本文件的一个 `TaskGraph` 静态方法上——`${issue.kind}@T${issue.task}: ${issue.message}` 现只住在 `session/preflight.ts` 的 `graph` 门里，判据要同一句就得有第二个作者，故把它挪进本文件、由两处共读）
- Modify: `packages/cdd-engine/src-next/session/preflight.ts`（`graph` 门的 `details` 改读那个拼装点；该门的报文、`gates` 与顺序逐字节不动）
- Create: `packages/cdd-engine/src-next/contract/__tests__/task-graph.test.ts`
- Test: `packages/cdd-engine/src-next/contract/__tests__/rules.test.ts`（行数断言改读 35 / 33 / 2——`doc` 面三十三条 · `ledger` 面两条；用例标题同批改读 `declares 35 rows: 33 doc-scope + 2 ledger-scope`（标题此刻读 32 / 30，只改断言不改标题就是让标题与它自己的断言打架，而 spec §3.2 引的正是这一形）；`seat` 的逐 id 字面表与三条断言也住这份文件）
- Test: `packages/cdd-engine/src-next/contract/__tests__/rules-severity.test.ts`（`probeDeclaration` 的 `DocRuleDeclaration` 字面补 `seat` 一格）
- Test: `packages/cdd-engine/src-next/session/__tests__/preflight-rows.test.ts`（`markerRow` 的 `DocRuleDeclaration` 字面补 `seat` 一格；`shapeRegistryOf` 经它构造，不另写字面）

#### Consumes
- `contract/task-blocks.ts#TaskBlock.fields` 的 `DependsOn` · `Consumes` · `Produces`
- `contract/invariants.ts#Invariant.historyVersions` 与 `#versionRank`——顺序行的读面（行序相邻对的大小比较，不挑「全表最大版本那一行」；一份没有 `## Change history` 表的文档是零候选）
- `contract/rules.ts#RuleDeclarationBase` 的四格与它的两个子接口——`seat` 列落在这里，读它的是 `contract/__tests__/rules.test.ts`
- `session/graph.ts#TaskGraph.validate` 的既有逐节点判法与它交出的 `GraphIssue` 形状（`task` 的取值是 Kahn 残值最小，不是环上成员）
- `session/preflight.ts#PreFlight` 的 `graph` 门与 `doc-contract` 腿的既有顺序

#### Produces
- `dangling-task-ref` 与 `depends-on-cycle` 两行（`warn` 起步），各占一个不变量类、一个 `name`、一条报文
- `validate()` 的 `cycle` issue 的 `task` 与 `message` 两半被逐字节复用，判据报出的渲染形是 `cycle@T{task}: {message}`——与 `graph` 门 `details` 那一行同一个字节面，而这一句的拼装只有一处（`session/graph.ts` 导出的那个方法），`details` 与判据同读它，不是两处各拼一遍同一个模板
- 两处 `graph.ts` 注释改成残值最小值，`message` 字节不动
- `RULE_REGISTRY` 的类注释与 `rules.test.ts` 的行数断言同读 `doc` 面三十三条 + `ledger` 面两条 = 三十五条；类注释里形状面那句仍是波 1 交付的五条（本任务只复核、不改字节）；`skipWhenClosed` 的列注释**不在交付面上**：交付树仍读「the five shape rules do」，而同表上声明 `skipWhenClosed: true` 的行里含一条非形状行，spec §3.2 的重写项按残留登记、归下一个带 `may.amend` 的轮
- `change-history-newest-last` 一行（`scope: "doc"` · `docKeys: "all"` · `warn` 起步 · `skipWhenClosed: true` · 自占一个不变量类），判的是单调：读 `contract/invariants.ts#Invariant.historyVersions` 的行序相邻对（逐对按 `versionRank` 比大小，方向不进判据），无 `## Change history` 表时零候选；它的成对臂与候选臂归 Task 9 的 `judge.test.ts` 合成表
- `contract/rules.ts#RuleDeclarationBase.seat`：闭集 `dispatch` · `close` · `corpus` · `ledger` 的非空子集，doc 面三十三条各写 `dispatch` · `close` · `corpus` 三格、ledger 面两条各写 `ledger` 一格；`contract/__tests__/rules.test.ts` 的逐 id 字面表三十五条与三条断言（表外值即红 · doc 行三格齐而 ledger 行恰一格 `ledger` · 注册表与字面表逐 id 逐格相等）

#### Steps
- 悬挂臂 — checkable: `（Task 42）` 指向不存在的任务 ⇒ 报；同一行去掉标记 ⇒ 零拒绝；括号里带多个任务时逐个体判（其一不存在即报）；裸续写臂 `（Task 4 · 42）` 而 42 未声明 ⇒ 同一判决（成对：只改第二个 id 的 `Task` 前缀）
- 成环臂 — checkable: `DependsOn 3, 7` 且环从 7 闭合（夹具声明任务 1 · 2 · 3 · 7，1 与 2 无依赖先被 Kahn 摘掉，环上只剩 3 与 7，故残值恰为 `{3, 7}`）⇒ 在 `Contract().validate` 面上报 `depends-on-cycle`，报文逐字节等于 `cycle@T3: a directed dependency cycle closes over task 3: task dependencies must form a DAG`——两半各有出处：`message` 与 `task` 逐字节复用 `TaskGraph.validate()` 那条 `GraphIssue` 的两格，`cycle@T{task}: ` 前缀由 `session/graph.ts` 那个拼装点给出（`graph` 门的 `details` 与判据报文同读它）、**不在** `validate()` 的 `message` 里，故这一臂与 graph 门读同一个字节面，而不是给判据另编一句；无环链 ⇒ 零拒绝
- 残值臂 — checkable: 环是 3 ↔ 7 而任务 1 经 9 依赖 3 ⇒ 报文逐字节等于 `cycle@T1: a directed dependency cycle closes over task 1: task dependencies must form a DAG`（`1` 是残值最小、不在环上；渲染形同 `graph` 门的 `details` 那一行）；判据不另判环成员、不改 `#cycleMember` 的报文
- 详情行的唯一拼装点 — checkable: `@T${` 在 `packages/cdd-engine/src-next` 下恰一处（`session/graph.ts`），`session/preflight.ts` 零命中；同一份带环夹具上，判据报文逐字节等于 `PreFlight` 的 `graph` 门 `details` 里同一条（成对：只改那个拼装点的模板 ⇒ 两面同时变而 arm 保持绿；把模板抄回 `preflight.ts` ⇒ 上面那条扫面读两处；两面各写一句 ⇒ 同夹具上两串不再相等）
- 两条注释对齐残值 — checkable: `GraphIssue.task` 的括注与 `#cycleMember` 的类注释都读「Kahn 残值里的最小任务号」，两处都不再声称「inside the cycle」（成对：残值臂就是它们的反例）
- 两个类两个名字 — checkable: 两条声明的 `create().name` 分别等于各自的 `id`（`rules.test.ts` 的 name 断言绿），两条报文互不相同
- 顺序行与注册表同批 — checkable: `RULE_REGISTRY` 收下 `change-history-newest-last`（`scope: "doc"` · `docKeys: "all"` · `severity: "warn"` · `create().name === "change-history-newest-last"`），四条新行同批落地；`contract/rules.ts` 头部 `Version ORDER stays presentation` 零命中，改后的读法点名「版本序列单调」这一条顺序腿、并写明方向不进判据（成对：把那句写回 ⇒ 红）。同一步登记语料对账的读数与它的出处：`skipWhenClosed: true` 落在这一行的声明上（`contract/rules.ts#RuleDeclarationBase.skipWhenClosed`），本 plan 的历史表逐行降（新行落表头）故单调，本相位自己的派发不被这一行拒；章程的表逐行升故同样单调，它的 `overall` 键在 `docKeys: "all"` 的判域内、读面是 `charter-self-repair.test.ts` 那条不交 `closed` 的全量契约用例。这一行先于 Task 8 落地：Task 8 的翻位读四条行，而它的 `DependsOn` 只到本任务
- `seat` 列的逐 id 字面表 — checkable: `rules.test.ts` 的字面表恰三十五条（`doc` 面三十三条各 `dispatch` · `close` · `corpus`，`ledger` 面两条各 `ledger`）；三条断言各有一条红向：表外取值 ⇒ 红（成对：把一条 doc 行的 `corpus` 换成 `gate` ⇒ 红）；doc 行缺一格或 ledger 行多一格 ⇒ 红（成对：把一条 ledger 行的 `dispatch` 补上 ⇒ 第二条与第三条同时红）；注册表与字面表逐 id 逐格漂移 ⇒ 红（成对：只改字面表的一行 ⇒ 红；只改注册表的一行 ⇒ 同一条也红）。表从注册表抄一次，不每次现算
- 两处夹具字面补格 — checkable: `rules-severity.test.ts#probeDeclaration` 与 `packages/cdd-engine/src-next/session/__tests__/preflight-rows.test.ts#markerRow` 两处 `DocRuleDeclaration` 字面各补 `seat: ["dispatch", "close", "corpus"]`（doc 面探针与注册表 doc 行同三格），`pnpm exec tsc --noEmit -p packages/cdd-engine` 退出码为零（成对：只把 `seat` 设成必需而不补这两处字面 ⇒ `packages/cdd-engine/tsconfig.json` 的 `include: ["src-next", …]` 让两处 `Property 'seat' is missing` 当场红，而本任务的 `seat` 断言照旧读绿——故 Files 行点名的文件集必须带上这两份）；两份文件里对**真注册表**的读数**不在本任务的交付面上**——交付树仍读六条（`packages/cdd-engine/src-next/session/__tests__/preflight-rows.test.ts` 的 `SHAPE_ROW_IDS` 括注「the real registry carries six, and the arms below read all of them」与 `packages/cdd-engine/src-next/contract/__tests__/rules-severity.test.ts` 的模块头两句、`PRE_GATE_DOC_IDS` 那段名册注释与末尾那个 `describe` 上的一句都未改），而夹具自己的六个合成 id 与叙述它们的那两句（`The six shape rows never ran` 与 `Closure exempts those six and ONLY those`）本来就不该动——它们数的是夹具的合成名册。spec §3.2 把这五处列为同批改写项，这一段因此按残留登记、归下一个带 `may.amend` 的轮；两份文件改前改后都绿、门与扫面都沉默，故它不构成一条会红的臂，也不挡本任务的交付
- 行数注释与新分值 — checkable: 本步按这棵树重基，不按改写前的旧分值——基线是 `contract/rules.ts#RULE_REGISTRY` 的类注释报的 `doc` 面三十 + `ledger` 面二 = 三十二（`single-create` 的注册行与 `temporal-indicator` 的撤离都已随波 1 回填落在其中，不再计入增量），本任务的两条任务图判词与 §6 的顺序行各加一条 ⇒ 交付态是 `doc` 面三十三 + `ledger` 面二 = 三十五，与 spec §3.2 的末值同值。写法取 spec §3.2 的唯一一种、不是「去掉逐 scope 计数」：注释按 scope 报行数与总数，逐 scope 计数保留，`contract/__tests__/rules.test.ts` 的三条断言同批读 35 / 33 / 2，同批把那条用例的标题改成 `declares 35 rows: 33 doc-scope + 2 ledger-scope`（标题此刻读 32 / 30，只改断言不改标题就留下一条自相矛盾的用例，而 spec §3.2 引的正是这个标题拼法——spec 本体归下一个带 `may.amend` 的轮，本条只登记它随标题同批走）（成对：把注释的合计改成任何一个别的值 ⇒ 该用例红；把注释写成去掉计数的形状 ⇒ 验收那条「三个数与注册表逐格相等」当场没有主语）。同一份类注释里那句形状面的话与同文件 `RuleDeclarationBase.skipWhenClosed` 的列注释分两半处置：前一句是波 1 交付的五条形状行与三个变量类，本步只按交付态复核；后一句**不在本步的交付面上**——交付树仍读「the five shape rules do」，而那张表上声明 `skipWhenClosed: true` 的除五条形状行外还有本任务落的非形状行 `change-history-newest-last`，故那句与它索引的名册相反；spec §3.2 的重写项按残留登记、归下一个带 `may.amend` 的轮。这两句都**没有断言读它们**：`contract/__tests__/rules.test.ts` 对该文件源码唯一的计算比较是类注释里那三个数（`keeps the class comment's counts equal to the table's own lengths — computed, never grepped`），形状面那句与列注释不在它的读数面上——把「六」或第四个变量类写回前一句、把列注释写成「只有形状行豁免」，都不会让任何用例变红（spec §3.2 同批登记了这一事实）。故本步的判据是逐句与表对齐，不是一条会红的臂：这两处打不出红，写成「写回即红」就是给一个永远不会失败的检查记一份通过
- 提交 — checkable: `git log -1 --format=%s` 以 `feat(p42):` 起头

#### Acceptance
两条判据各有一对成对臂，且各占一个不变量类；悬挂的判域只覆盖带标记的行，散文不因形似而被判。环的报文逐字节复用 `TaskGraph.validate()` 的 `task` 与 `message` 两半、渲染形与 graph 门同一句且这一句只有一处拼装（`details` 与判据报文同读它，改一侧两面同时变），残值臂成立而判据不另算成员。注册表的行数注释与断言同读一份新分值（`doc` 面三十三条 + `ledger` 面两条 = 三十五条），形状面的计数句读五条与三个（波 1 交付的读数），而 `skipWhenClosed` 的列注释仍读「只有形状行豁免」、两份测试文件的头部仍读六条——这几处没有断言，spec §3.2 的重写项因此按残留登记、归下一个带 `may.amend` 的轮，不在本任务的交付面上。同批收下的两笔各有读面：顺序行的判域是单调（方向不进判据），已闭合的历史表由 `skipWhenClosed` 豁免，而 `docKeys: "all"` 让章程的 `overall` 键也在判域内（它的表逐行升、同样单调），故翻位后语料零拒绝；它的臂住 Task 9 的合成表，`seat` 的三条断言住 `rules.test.ts` 的逐 id 字面表，另有 `rules-severity.test.ts` 与 `packages/cdd-engine/src-next/session/__tests__/preflight-rows.test.ts` 两处字面同批补格——`tsc` 在本任务头上退出码为零。

#### DependsOn
4

### Task 6: 消费面与发布孪生

#### Objective
把档位词表从所有**已发**的字面里收走。渲染面是两处 prompt 字面（`REVIEW_ITEM_HEAD` 的判词句 · `FIX_SHELL` 的修轮义务清单）加整张 rubric（`SEVERITY_RUBRIC` = `CRITERIA.renderRubric()` 的渲染，判据表那半随 Task 2 自动跟随；它的 `RUBRIC_PREAMBLE` / `CALIBRATION_TAIL` 不带档位词，本任务不动）· 发布面（四个图表源与 README 家族）· 源码注释面。发布面有孪生 pin 在读它，改完才绿；源码注释面按 spec §4 的两条断言分开扫两个树态。

#### Files
- Modify: `packages/cdd-engine/src-next/render/templates.ts`（`REVIEW_ITEM_HEAD` 的判词句 · `FIX_SHELL` 里 `Fix ALL findings (blocker/warn/nit)` 那一句 · `SEVERITY_RUBRIC` 的注释（`tiers in blocker → warn → nit order`，§4 登记表的第 ① 处）；`FIX_TYPED_INSTRUCTIONS` 被 `FIX_SHELL` 展开引用、自身不带档位词，`RUBRIC_PREAMBLE` / `CALIBRATION_TAIL` 同理不动；同批**保留 notes 分句**——`IMPLEMENT_SHELL` · `FIX_SHELL` · `REVIEW_ITEM_HEAD` 三处 prompt 里点名上一轮 `## Notes` 的那半句逐字不动，改档位词只动它左边的半句）
- Modify: `packages/cdd-engine/src-next/contract/review-criteria.ts`（模块头注释由本任务改写；`CRITERIA_ROWS` 的表注释与 `CriteriaRegistry` 的两处档序注释归 Task 2，本任务只按 §4 的登记面复核它们已零命中）
- Modify: `packages/cdd-engine/src-next/session/handoff-schema.ts`（`impact` · `evidence` · `gradingViolations` 三处注释）
- Modify: `packages/cdd-engine/src-next/session/ledger.ts`（`FindingSeverity` 注释；读侧那条三值联合的声明处与 `RoundFinding.severity` 那一格的两条文档注释归 Task 1，本任务只按 §4 复核它们已在其位）
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
- Test: `packages/cdd-engine/src-next/render/__tests__/render.test.ts`（`P42 §2.1 — every prompt that names the wave brief names its notes section` 是那三处 notes 分句的读数面——本任务只改它们左边的档位句，三条 `toContain` 逐字不动，故这三串有一个归属而不只是变更历史里的一句；成对：把任一处 notes 分句删掉 ⇒ 该用例红）
- Test: `scripts/__tests__/next-loop-twin.test.ts`（`STATEMENTS.warnNitReviewFix` 的 pattern 与四源那十二处同批改，**键名原样保留**——它是这份测试里的一个字面声明，换名会让本 plan 与 spec 里引这枚键的坐标同时落成死 pin，而两份文档都不在本任务的 Files 行里；新 pattern 单串点名 `warn` 与 `REVIEW_FIX` 并以负向前瞻排除退役拼写 `/nit`——`/warn(?!\s*\/\s*nit)[\s\S]*REVIEW_FIX/i`；`DiagramSource.carrying` 逐串测，故退役拼写那一串在改前与写回后都读零、写成「只 warn」的整句读一，孪生 pin 的成对臂才落得下来；弱成 `/warn/i` 不算达成，松成 `/warn[\s\S]*REVIEW_FIX/i` 同样不算——那形对退役拼写照命中，它的成对臂无处落）

#### Consumes
- `render/templates.ts#REVIEW_ITEM_HEAD` · `#FIX_SHELL`（第五处破坏性字节 `Fix ALL findings (blocker/warn/nit)` 就在它里面）· `#SEVERITY_RUBRIC` 的三处已发字面
- spec §4 的十二处源码注释登记表与它的三处豁免注释（`session/handoff-schema.ts#HandoffSchema.#tierRankOf` 的「blocker 2 · warn 1 · nit 0」· `session/ledger.ts` 的 `RoundFindingSeverity` 文档注释 · 同文件 `RoundFinding.severity` 的文档注释）
- `scripts/__tests__/next-loop-twin.test.ts#warnNitReviewFix`——发布面的孪生 pin（改的是它的 pattern，键名作为语料里被引的坐标保留）
- `docs/diagrams/README.md` 的重生成方式（HTML 不手改）

#### Produces
- 两处 prompt 字面与整张 rubric 两档化
- 四个图表源与 README 家族的档位措辞两档化，孪生 pin 转绿
- 十二处源码注释面同批改写；交付树的命中集恰为三处豁免注释——`session/handoff-schema.ts#HandoffSchema.#tierRankOf` 的排名注释 · `session/ledger.ts` 的 `RoundFindingSeverity` 文档注释 · 同文件 `RoundFinding.severity` 的文档注释（后两处是 Task 1 的交付；计数单位是注释处，不是行）

#### Steps
- 渲染面改两档 — checkable: 对渲染出的字节 `REVIEW_ITEM_HEAD` · `FIX_SHELL` · `SEVERITY_RUBRIC` 按 `\bnit\b` 词边界扫零命中（`init` / `definition` 不算）；测试标题里的 `warn / nit` 不是断言，不在此臂的改动面
- 发布面改两档 — checkable: 四个图表源与 README 家族里 `\bnit\b` 零命中（README 四处各给替换字节，按段定位——两份根 README 住 `**Review Convergence**` 段，两份包 README 住 `Convergence itself is decided by the findings' grades alone` / `收敛本身只由 findings 的档位决定` 段，两份包 README 无该标题，按标题定位会读零）：`README.md` 的严重级枚举 `**blocker**, **warn**, or **nit**` 改 `**blocker** or **warn**`、同段的 `` warn/nit-only closes as `REVIEW_FIX` `` 改 `` warn-only closes as `REVIEW_FIX` `` · `README.zh-CN.md` 同段 `**blocker**、**warn** 或 **nit**` 改 `**blocker** 或 **warn**`、`` 仅 warn/nit 时以 `REVIEW_FIX` 收敛 `` 改 `` 仅 warn 时以 `REVIEW_FIX` 收敛 `` · `packages/cdd-engine/README.md` 的 `warn/nit-only findings are fixed and close without a re-review` 改 `warn-only findings are fixed and close without a re-review` · `packages/cdd-engine/README.zh-CN.md` 的 `只有 warn/nit 则修完即收口` 改 `只有 warn 则修完即收口`；成对：任一处写回 ⇒ 该扫面红）；且孪生 pin 在同一批编辑里换读法——`STATEMENTS.warnNitReviewFix` 的 pattern 换成 `/warn(?!\s*\/\s*nit)[\s\S]*REVIEW_FIX/i`，**键名原样保留**（单串同时点名 `warn` 与 `REVIEW_FIX`，负向前瞻要求那个 `warn` 之后不接 `/nit`；`DiagramSource.carrying` 逐串测，故退役拼写 `warn/nit` 那一串读零、写成「只 warn」的整句读一，而松成 `/warn[\s\S]*REVIEW_FIX/i` 时退役拼写照命中——那一形没有成对臂，本任务不取；弱成 `/warn/i` 那一形与本条不符；那枚键是语料里被引的字面声明，换名会让本 plan 与 spec 里引它的坐标一并落成死 pin，而两份文档都不在本任务的 Files 行里），同批把十二处 `nit` 逐处给替换字节——四处是严重级枚举与教学句：`next-loop.en.json:247` 的 `A finding carries severity (blocker · warn · nit), a lens and a summary; section, line and fix are optional` 改 `A finding carries severity (blocker · warn), a lens and a summary; section, line and fix are optional` · `next-loop.en.json:249` 的 `Debt inside the contract is a warn — a duplicated policy, a stale docstring, a missing coverage case; style and naming are a nit` 改 `` Debt inside the contract is a warn — a duplicated policy, a stale docstring, a missing coverage case; style and naming are a `notes` line, not a finding ``（教学句改成改写后的 `expression-only` 行现在教的 `notes` 行，不得另造一句无人 pin 的措辞）· `next-loop.zh-CN.json:247` 的 `一条发现带严重级（blocker · warn · nit）、一个 lens 与一句摘要；段落、行号与修复建议是可选项` 改 `一条发现带严重级（blocker · warn）、一个 lens 与一句摘要；段落、行号与修复建议是可选项` · `next-loop.zh-CN.json:249` 的 `契约内部的债务是 warn——重复的策略、过期的文档注释、缺失的覆盖用例；风格与命名是 nit` 改 `` 契约内部的债务是 warn——重复的策略、过期的文档注释、缺失的覆盖用例；风格与命名是一条 `notes` 行，不是一条发现 ``；另八处是档位轴与收口句：`next-loop.en.json` 的 transition 行 → `After the fix: a blocker left → re-review; warn only → REVIEW_FIX closure, no re-review`、sublabel → `blocker · warn · none`；`next-loop.zh-CN.json` 对应两处 → `修复后仍有 blocker → 重新评审；仅 warn → 以 REVIEW_FIX 收口，不再重新评审` 与 `blocker · warn · 无`；`architecture.en.json` 的两条 → `Review findings carry blocker / warn; any blocker routes to fix and a re-review, a one-way hop` 与 `A fix that leaves warn only closes as REVIEW_FIX without a re-review; zero findings closes outright`；`architecture.zh-CN.json` 的两条 → `评审发现带 blocker / warn；任何 blocker 都进入 fix 并重新评审，单向一跳` 与 `仅剩 warn 的修复以 REVIEW_FIX 收口，不再重新评审；零发现直接关闭`。成对：把 transition 那行写回 `warn/nit only → REVIEW_FIX` ⇒ 新 pattern 零命中、该用例红（两侧互为对方的零命中：旧 pattern 读不到改写后的「只 warn」整句，新 pattern 读不到退役拼写，故只能同批；`\bnit\b` 那条扫面同向）
- 重生成图表 HTML — checkable: 先跑 `pnpm run emit` 重生成，再跑 `pnpm run emit:check` 报 fresh（只跑 check 不会重生成，而手改 HTML 会红）
- 源码注释面：登记完整性 — checkable: 读改写前的树（本相位起始提交），`packages/cdd-engine/src-next` 下非测试 `.ts` 的注释行按 `\bnit\b` 扫，命中集恰为 §4 点名的十二处加 `#tierRankOf` 那一行（共十三行），登记外多一行即红（一次性核对，不在交付树上复跑）
- 源码注释面：发布门 — checkable: 读交付树，命中集恰为**三处注释**——`session/handoff-schema.ts#HandoffSchema.#tierRankOf` 的排名注释（`blocker 2 · warn 1 · nit 0`）· `session/ledger.ts` 的 `RoundFindingSeverity` 文档注释（`nit` 与 `warn → nit` 写在相邻两行上）· 同文件 `RoundFinding.severity` 的文档注释（读面三值、写面两值）——**计数单位是注释处，不是行**（按行读，这棵树是四条而三处那条等式永远对不上），其余零命中（成对：把任一处登记项的 `nit` 字面留在交付树 ⇒ 红；反向成对：抹掉任一处豁免注释里的 `nit` ⇒ 命中集比那三处少一处、同一条等式同样红）；后两处不是本任务新增的散文，而是 Task 1 的交付项（§1.1 的三值联合与它的第一处使用），故把交付树数成一处的写法永远转不绿；同一步多一条计数臂——`contract/review-criteria.ts` 的模块头改写后不再声称三档，`the three tier` 在该文件里零命中（成对：把那一句写回 ⇒ 红）。这一条不是 `\bnit\b` 能看见的：它的陈旧处在计数词上（盘上那句折成 `… : the three tier` / `boundaries with their evidence duty …` 两行，故整句 `the three tier boundaries` 零命中、拿它作断言是改写前后都绿的假臂；按行内可见片段读），而同头的另两个数字（`three executable cells` · `Two distinct validation contracts`）正确，横扫数字也不是可用的替身
- 提交 — checkable: `git log -1 --format=%s` 以 `feat(p42):` 起头

#### Acceptance
已发字面里两档一处不留，而判据表那半个 rubric 自动跟随、不需要手改。源码注释面的两条断言各钉一个树态：登记完整性数十三处，发布门只容那三处豁免注释（单位是注释处，不是行）；模块头的三档计数另由一条读片段的臂钉住（它落在 `\bnit\b` 扫面之外，与那两条不同树态）。

#### DependsOn
2

### Task 7: 章程回填

#### Objective
把章程与本 spec 读到的路线对齐。要改的**十组**由 spec §5 点名——已有五组（`Phase inventory` · `Issue inventory / D97` · `D70 的两格` · `验收 ⑧ 的括注与 D98 ① 的收窄注` · `被本相位反转的七处`）之外，spec §5 还落了五组：`P42 行的形状面收口登记（scope ⑧ · 验收 ⑮）`（⑮ 落比值臂与 `seat` 的守卫臂，同批把 scope ⑦ 的 `验收 ⑬` 改写成两具载体与两条红半——⑬ 那一格的 `两种写法` 措辞被两具载体的描述替换，而三段的 `path#Class.member` 拼写作废、不作零命中断言：章程从未写过它）· `P42 行的顺序判据登记（scope ⑨ · 验收 ⑯）`（顺序行的成对臂落 ⑯，同批把 scope ⑤ 的「删」收窄成「措辞比对删除、顺序那一条搬进引擎，见 ⑨」）· `验收的 notes 臂`（`notes +M` 与 brief 那半句的两条限定，三格落满：P42 行 ② · P42 验收 ⑥ · D97 那句）· `变更历史的归位`（条件而不是一处待搬的行：该表的版本序列单调——方向由那张表自己定，章程逐行升故新行落表尾——且 front matter 的版本等于表内最大版本，位置的红由 §6 的顺序行报，本组只核条件）· `P42 行的形状规则撤离登记（scope ⑩ · 验收 ⑰）`（scope 格加 ⑩——注册表去掉 `temporal-indicator` 一行，同批去掉它的类与闭集与分句文法、逐处点名的夹具与两个 skill 的 narrative 点名，`MEASURE_UNITS` 收窄到英文五值；验收格加 ⑰——`packages/cdd-engine/src-next` 与 `packages/kairos/tests/claim-shapes.test.ts` 上 `temporal-indicator` 零命中、`contract/rules.ts#RULE_REGISTRY` 的行数注释与实际行数相等、`MEASURE_UNITS` 的取值集恰英文五值；同批在裁定表加一行决策记录 D100（编号接 D99：`D99` 那行已是「判据上线前的语料实测」，故续号而不是复用、也不是覆盖它），正文引 §8 的两段理由——两段会话里零个真问题，而真正腐坏的读数一句都不含它，`## Change history` 的同一字放行说明判据判的是字形；并把 P42 验收 ⑪ 的「四条形状规则」改成三条，与 §7 同一次编辑）。其中一组是**反转**：本相位起初登记的「三处说明书」里有两个 skill 文件其实是零档位词的，它们退出该表。组清单之外还有一格：章程 `## Dependency graph (ASCII)` 之后 `执行序` 段里的 P42 括注——它念的正是同一对旧 id，而 spec §5 的组清单没有点到它，故并进组二同批改写（不改它，收口后的章程仍留着一条活路线，点名两条注册表里没有的规则）；历史表里记录这两个旧名的两行不在改动面内，理由写在组九。

#### Files
- Modify: `docs/kairos/overalls/2026-10-10-engine-doc-tooling-overall.md`

#### Consumes
- 章程的 Phase inventory · Issue inventory · D 表的两格 · 历史表
- spec §5 的十组清单
- `contract/judge.ts#Contract` 的 `doc-contract` 腿——判定章程那个 doc key 的面

#### Produces
- 章程十组回填落地（含 `执行序` 段的 P42 括注、scope ⑩ 与验收 ⑰、裁定表新加的 D100 行（编号接 D99，不复用 `D99` 那行）、验收 ⑪ 的四条改三条），版本与前缀同步

#### Steps
- 按 spec §5 逐组改 — checkable: spec §5 的每一组各有一条可点的落点（十组逐组点名：第 1 组 `Phase inventory` 的 P42 行 ① ③ ④ 与验收 ① ⑤ ⑦；第 2 组 `Issue inventory` 的 P42 行、`执行序` 段里 P42 那一格与 D97 正文的三条规则 id（含附录 ④ 的 `Consumes` · `Produces` 读面）——`Issue inventory` 与 D97 两处的 `double-owned` / `consume-cycle` 换成交付的三条，`执行序` 那一小段「任务块 `double-owned` 与 `consume-cycle` 两条判据」同批换成「任务块 `single-create` · `dangling-task-ref` · `depends-on-cycle` 三条判据」，三处读同一份新名；第 3 组 `D70` 的跨切条目与 `| D70 |` 行；第 4 组验收 ⑧ 的括注（候选读数形）与 D98 ① 的收窄注；第 5 组 scope ⑧ 与验收 ⑮——比值臂加 `seat` 的三条断言的读数，同批把 scope ⑦ 的 `验收 ⑬` 改写成两具载体（`path#member` 与裸类名载体）与两条红半，`两种写法` 在 P42 行的验收 ⑬ 那一格上零命中（那一格的措辞被两具载体的描述替换，这正是要量的改写）；全章另有一处命中，是 `## Change history` 的 v4.25 那一行记的 P40 派发措辞，不是这条臂的域，历史行原样保留；三段的 `path#Class.member` 拼写**不作断言**——章程从未写过它（`Class\.` 在章程上零命中），拿它当零命中臂是改写前后都绿的假臂，本条只把那一形从 ⑬ 的登记里删掉；第 6 组 scope ⑨ 与验收 ⑯——顺序行，同批收窄 scope ⑤ 那句为「删章程的措辞断言（顺序那一条搬进引擎，见 ⑨）」；第 7 组 `notes +M` 的三格；第 8 组被本相位反转的七处；第 9 组变更历史的归位——该表的版本序列单调、且 front matter 的版本等于表内最大版本，不写版本号：树上是哪一行就核哪一行（章程逐行升，故新行的落点就是末行；方向不进判据）；v4.51 与 v4.52 两行原样保留——历史行记录当时被相信的字节（同表 v4.12 与 v4.19 两行的先例），把旧 id 洗成新名就是让历史行说出它当日没说过的话，故 `double-owned` / `consume-cycle` 在收口后的章程上只剩历史表里那两处，而活着点名它们的格子只剩 `Issue inventory` · `执行序` · D97 三处，一律读新名 · 第 10 组 scope ⑩ 与验收 ⑰——撤离的登记，同批在裁定表加 D100 一行（编号接 D99：`| D99 |` 已属于「判据上线前的语料实测」，新行续号，两行不共一个 id）、把验收 ⑪ 的「四条形状规则」改成三条（`四条形状规则` 在章程上零命中，正是要量的改写；成对：只加 ⑩ 不加 ⑰ ⇒ 一条无臂的登记；只加 ⑰ 不加 ⑩ ⇒ 一条在 scope 格里找不到出处的收口））
- 版本与血缘行同批 — checkable: `change-history-latest-matches-front-matter` 绿
- 章程的判定输出由夹具钉住 — checkable: 一份带违例的章程夹具 ⇒ 对应规则行读 `failed`；同一份夹具改成合规 ⇒ 读 `passed`。**本仓章程同在这一面上**：`charter-self-repair.test.ts` 的 `reports nothing on the real charter — both families at zero` 对真实章程跑整份 `Contract` 并要求 `[]`，Task 9 删的是 `registration face: …` 那一条、留的正是这一条；`### Cross-cutting` 是它读的五个面之一，故本任务写进去的 D70 跨切条目与 D97 的规则 id 是被判的散文，不是自由的描述——写之前先重跑 `pnpm -C packages/cdd-engine exec vitest run src-next/contract/__tests__/charter-self-repair.test.ts`，语法错句当场定位到本轮那一句
- 收口全量门 — checkable: 本任务与 Task 11 同在末层（Constraints 的波次），两个任务改同一份章程文件，故本任务的收口门读的是 Task 11 的语料迁移之后的树（次序见 Constraints 那一行）；重跑 `charter-self-repair.test.ts`（章程散文的红先在这一条上露出、定位到本轮改的那句）与 `pnpm run validate` 两条，各自在本任务头上退出码为零；章程最新一条历史行的日期沿用 `2026-11-20`（与本 plan 的 front matter 同日）是**约定，不是门**——读那格日期值的是 `charter-self-repair.test.ts` 的 `registration face: …` 用例，而那条用例归 Task 9（上一层 `{6,8,9}`）整条删除；本任务头上的树里没有判据钉日期值（`change-history-latest-matches-front-matter` 只判版本号，`change-history-date-shape` 只判 ISO 形状），故写别的日期不会红，本条不写成红
- 提交 — checkable: `git log -1 --format=%s` 以 `docs(p42):` 起头

#### Acceptance
章程的 P42 两行（含 scope ⑧ 与 ⑨ 与 ⑩、验收 ⑮ 与 ⑯ 与 ⑰，以及验收 ⑬ 的两具载体与两条红半、验收 ⑪ 的四条改三条）、`执行序` 段里的 P42 括注（两条旧 id 换成交付的三条）与 D 表的两格加 D100 那一行（编号接 D99，`D99` 那行不覆盖、不改写）、以及历史行同读一条路线；历史表里 v4.51 与 v4.52 两行按当时的字节保留，`两种写法` 那一处域外命中同理；`notes +M` 同批落，历史表的版本序列单调且 front matter 与表内最大版本同版（归位是条件，本组只核对；章程逐行升，故最新一条落在末行，而这是那张表自己的方向，不是判据）；章程自己过自己那道门；末层的收口门归本任务，且它读的是 Task 11 的语料迁移之后的树（Constraints 的波次），`pnpm run validate` 在它头上转绿。

#### DependsOn
6

### Task 8: 翻位与交付

#### Objective
四条新规则行从 `warn` 翻到 `block`，自毁面烧掉；changeset 两包 minor（`cdd-engine` 与 `kairos`，D74）；全量门。

#### Files
- Modify: `packages/cdd-engine/src-next/contract/rules.ts`（四行翻位）
- Test: `packages/cdd-engine/src-next/contract/__tests__/rules-severity.test.ts`
- Create: `.changeset/p42-two-ranks.md`

#### Consumes
- `contract/rules.ts#RULE_REGISTRY` 的四条新行
- `contract/review-criteria.ts#CRITERIA_ROWS`（changeset 描述引它的两档）
- spec §8 的 ⑨ 登记与 spec Constraints 的例外清单——changeset 的措辞要盖住「收回」那一类（一份此前被拒的 decision-face 文档现在通过）

#### Produces
- 四条新行读 `block`
- 两包 minor 的 changeset（`cdd-engine` 与 `kairos`）
- 同一层的夹具侧改动登记（不另占 `Files` 行）：`packages/cdd-engine/src-next/session/__tests__/fix-round-gate.test.ts`——翻位之后闭合态的门在轮次之前就拒掉一份触发已发规则的行文档，故 CLI 喂入那条臂的夹具必须不触发任何规则、它读的那一格是「在场且为空」；承载一条非空读数的半边自此只由 stub 喂入的臂覆盖，生产轮不再证明内容携带。该路径的建行归 Task 10（层 1 先行建出），本任务的 `Files` 行若再声明它，`single-create` 会把 Task 10 的 `Create:` 判成落在一个更早声明过同一路径的任务之后——故这一处登记为散文而不是行。
- spec §4 的「changeset 一包 minor」与本任务相反，由本 plan 取代，就地登记：§8 与本章的验收都要求两个 skill 的 narrative 子弹改写（Task 4 的 `temporal-indicator` 撤离），那两处随插件发布，故 `kairos` 的消费面确有一处字节改动、两包同读 minor；改 spec 本体需要另一个带 `may.amend` 的轮，不在本 plan 的改动面
- 全量门绿

#### Steps
- 翻位 — checkable: 断言「无一规则声明 `warn`」为真；把任一行改回 `warn` ⇒ 该用例红
- changeset — checkable: 文件列 `cdd-engine` 与 `kairos` 两个包、都读 minor——`kairos` 的消费面确实有一处改动：本相位的 `temporal-indicator` 撤离把两个 skill 的 narrative 子弹里对它的点名删掉（Task 4 的步），那是随插件发布的命令面散文，不是测试面；只列 `cdd-engine` 一个包那条判据与本句相反，成对：把两处 skill 改动写回原文 ⇒ `kairos` 的那一格无改动、两包判据红。描述盖住 ⑨ 那一类收回：一份此前因小数比值被 `line-coordinate` 拒的 decision-face 文档现在通过（成对：把 Task 4 的比值修法退回、`4.5:1` 重新被 `line-coordinate` 拒 ⇒ 同一句里的比值臂当场红，而描述里那句不再成立）
- 本层全量门 — checkable: `pnpm run validate` 退出码为零（本条只闭本层；末层的收口门归 Task 7，见 Constraints 的波次）。翻位之后顺序行对语料零拒绝，读法与 Task 5 的对账同一份：`skipWhenClosed` 豁免 10 份已闭合的非单调历史表，在飞的三份文档（本 plan · 本 spec · 章程）都单调——前两份逐行降、章程逐行升，而 `docKeys: "all"` 让章程那个 `overall` 键也在判域内，它的绿由 `charter-self-repair.test.ts` 那条不交 `closed` 的全量契约用例读出
- 提交 — checkable: `git log -1 --format=%s` 以 `feat(p42):` 起头

#### Acceptance
门在闭合态是 `block`，自毁面可核；两包的 minor 发布声明都在册：`cdd-engine` 收档位与三条规则行，`kairos` 收两个 skill 子弹里撤掉的那个规则名——两包各有一处真实的消费面字节变化，故 `kairos` 不是一次无字节变化的版本移动。顺序行落 `block` 档时对语料零拒绝（已闭合的 10 份历史表由 `skipWhenClosed` 豁免、在飞的三份文档单调，含 `docKeys: "all"` 之下的章程），本相位自己的派发不被自己立的门拒。

#### DependsOn
5

### Task 9: 验证面追溯

#### Objective
把「物料判自己」这一类收掉。章程的 D98 立了三条：规则行为由夹具判，打包物只经 `emit:check`，语料读数不进测试。本任务处置本仓现存的三族：章程字面断言 · 三处「对真实语料断言零 finding」 · 两处手写读数。另接一条新规则（`change-history-newest-last`，行与注册表归 Task 5）的成对臂与候选臂——被删掉的那条位置断言搬进引擎之后，它的读数就落在本任务的合成表上。

#### Files
- Modify: `packages/cdd-engine/src-next/contract/__tests__/charter-self-repair.test.ts`（删章程正文的字符串比对，只留引擎臂；补一条候选读数臂；模块头的族清单同批改——`The delivery is three families at zero, not one` 那句读两族（`measure-literal` 一族与 `single-home` 一族），首条子弹只点名 `measure-literal` 一处（两个文法属同一族，不是两族），`## Phase inventory` 那条改成登记面的读法、不再数作一族；头部 `Four pairs, each with its counter-arm` 不写对数，改成按臂点名它引的那几句——原文复述 · 保留重复句的干净副本 · 指针本身 · 标注式复述 · 只留回填族的副本；那份计数引的是第一个 `describe` 的字面臂，`registration face: …` 那条住第二个 `describe`，故删除该条只把外层 `describe` 标题 `P41 T7 — the charter itself judges zero, and its registration face carries the narrowings` 改到删除之后的读法（那个标题是套件自己的索引、不是章程正文的断言），这一句点名的臂集一位不动；而 `catches the copy that keeps ONLY the backfill family` 是这句计数写成之后才加进第一个 `describe` 的臂，故「三对」在树上是陈旧读数、也与它自己点名的四个分句不符）
- Modify: `packages/cdd-engine/src-next/contract/__tests__/doc-corpus.guard.test.ts`（补惰性臂：`change-history-row-shape` 的候选读数）
- Modify: `packages/cdd-engine/src-next/contract/__tests__/pins.guard.test.ts`（语料规模常量删除、覆盖证明搬到新建的 `contract/__tests__/scan-coverage.test.ts`；补惰性臂：`PinAudit.census` 的候选读数——临时语料上非零、空根上全零；头部两处「file count is a constant …」与「the file list is a pinned constant」、加常量自己的文档注释，改成「覆盖由已知小树夹具证明」的读法）
- Modify: `packages/kairos/tests/claim-shapes.test.ts`（措辞常量改成结构断言；`Two legs, both byte-level` 块与那份措辞常量的文档注释改成「措辞自由 · shape→规则 id 映射固定 · 两节点逐字节相同」的读法；映射常量里 `narrative` 那一格改指 `line-coordinate` 一处，`temporal-indicator` 零命中）
- Modify: `docs/kairos/plans/2026-11-16-engine-doc-tooling-p37.md`（File 行那条「语料规模常量保留为本地字面量」的括注改成散文「语料规模常量」——被删的读数不再是一个声明，裸 symbol pin 随常量一起死）
- Modify: `docs/kairos/plans/2026-11-17-engine-doc-tooling-p38.md`（裸 symbol pin 改成散文：Files 行那条「已落地」的注 · 验收与 Step 2 那三句 · 两条变更历史行里的引用；Objective 那句把旧取值写成比较形的散文同批修掉——那个形不是 pin 语法（语料守卫只读内联代码段的 symbol 与 path 形），任何门都不读它，删除之后它会继续声称一个不存在的常量）
- Modify: `docs/kairos/plans/2026-11-19-engine-doc-tooling-p41.md`（裸 symbol pin 改成散文：Files 行 · 复位步与 Produces 那一句）
- Modify: `docs/kairos/specs/2026-11-19-engine-doc-tooling-p41-design.md`（裸 symbol pin 改成散文：实现前窗口那一段 · claim shape 那两段 · `v0.19` 行）
- Modify: `docs/kairos/overalls/2026-10-10-engine-doc-tooling-overall.md`（v4.16 变更历史行那一处裸 symbol pin）
- Modify: `packages/cdd-engine/src-next/contract/__tests__/judge.test.ts`（变更历史夹具族新增一条用例：一张合成的变更历史表，低位相邻两行对调、序列因此夹一处反号而表头版本等于表内最大版本 ⇒ `change-history-latest-matches-front-matter` 零 finding（行序对它无感，这一态就是它的替身）、`change-history-newest-last` 恰一条；成对一：把对调的两行复原 ⇒ 两条都零 finding（只改一行的位置）；成对二：同一张表整表翻成新在上（全降）⇒ 两条都零 finding——方向不进判据，这一臂是按「末行最新」的旧读必红的判别臂；成对三：同一张表把表头版本降到表内最大版本之下、行序不动 ⇒ 恰一条 `change-history-latest-matches-front-matter`）
- Create: `packages/cdd-engine/src-next/contract/__tests__/scan-coverage.test.ts`

#### Consumes
- 章程的两条裁定正文与它点名的正反例
- 三条惰性臂读的是树里已有的三个座位（`change-history-row-shape` · `PinAudit.census` · `measure-literal`），不是本相位新增的规则行（`DependsOn: 5` 是操作序：同层内先落规则再写追溯，不是数据依赖）
- `contract/pins.ts#corpusOf` 的语料根声明

#### Produces
- 三处候选读数臂：`change-history-row-shape` 的临时根 · `PinAudit.census` 的临时语料（一条死 symbol pin 加一条死 path pin）与空根 · `measure-literal` 的面缺口，每处要求那条「零 finding」是测得的零
- 顺序行的成对臂与候选臂（`judge.test.ts` 的变更历史夹具族）：低位相邻两行对调（序列夹一处反号）⇒ 版本腿零 finding、顺序腿恰一条；复原 ⇒ 两条都零 finding；整表全升与全降各一态 ⇒ 两条都零 finding（方向不进判据）；表头版本降到表内最大版本之下 ⇒ 恰一条版本腿
- spec 的三处读数由本 plan 取代，就地登记：`PinAudit.census` 的 `symbol` · `path` · `total` 是 **finding 计数**（同一次 `scan` 的分解），交付语料上三项恒为零，故非空半边落在一棵临时语料上、交付语料那一半只留 `files` 体量读数——这一句取代 spec §6 的「交付语料上三项各大于 0」与验收里的两条同读（共三处）；改 spec 本体需要另一个带 `may.amend` 的轮，不在本 plan 的改动面
- 三份头部注释同步改到新落法（覆盖由已知小树证明 · 措辞自由而映射固定、两节点措辞相同 · `charter-self-repair.test.ts` 的头部按臂点名而不写对数 · 两族——`three families at zero` 在 `charter-self-repair.test.ts` 上零命中）
- spec §6 的「`Four pairs, each with its counter-arm` 改成三对」由本 plan 取代，就地登记：那处算术把第二个 `describe` 的删除读成第一个 `describe` 的对数变化，而那句计数在 `catches the copy that keeps ONLY the backfill family` 落地后已陈旧；头部改按臂点名，外层 `describe` 标题单独改到删除之后的读法；改 spec 本体需要另一个带 `may.amend` 的轮，不在本 plan 的改动面
- 语料规模常量从测试里消失，覆盖由一棵已知小树证明，证明本身住 `packages/cdd-engine/src-next/contract/__tests__/scan-coverage.test.ts`
- 两个被删的手写读数在语料上也不再以裸 symbol pin 出现：五份程序文档（`p37` 的 File 行 · `p38` 的 Files 行与验收与 Step 2 · `p41` 的 Files 行与复位步 · `p41-design` 的实现前窗口与 claim shape 两段 · 章程 `v4.16` 行）的引用改成散文，`p38` Objective 那句比较形的残留同批修掉——那个形不是 pin 语法，语料守卫读不到它，故它只能由本任务的扫面收掉
- `claim-shapes` 只判结构，不判措辞；shape 前缀 → 规则 id 的映射常量（`pin` → `line-coordinate`；`count` → `measure-literal` · `live-arithmetic`；`narrative` → `line-coordinate` 一处——`temporal-indicator` 随 Task 4 整条退出，映射里同批不再点它）

#### Steps
- 顺序不变量搬家 — checkable: 新不变量（`change-history-newest-last`，行与注册表归 Task 5，本条只接它的臂）在「低位相邻两行对调、序列夹一处反号」的夹具上报一条，恢复原序 ⇒ 零拒绝（成对：只改一行的位置，方向不动）；`charter-self-repair` 里那条位置断言退休而引擎臂保留
- 删章程正文的字符串比对 — checkable: 该文件里针对章程正文的字符串断言零命中（成对：把章程正文改回旧措辞 ⇒ 该用例不红，引擎臂保持绿）
- 顺序面的合成表替身 — checkable: `judge.test.ts` 新增一条用例，落在既有的变更历史夹具族里（`P21 T2` 那两组与 `P30 T3` 那组，后者的标题行在 `judge.test.ts` 的 `P30 T3 — change-history-latest-matches-front-matter` 一带），不另起一份夹具：一张合成的变更历史表、低位相邻两行对调（序列夹一处反号）而表头版本等于表内最大版本 ⇒ `change-history-latest-matches-front-matter` 零 finding（行序对它无感，这一态就是它的替身）、`change-history-newest-last` 恰一条（单调就是它的判据）；成对一：把对调的两行复原 ⇒ 两条都零 finding（只改一行的位置，方向不动）；成对二：整表翻成新在上（全降）⇒ 两条都零 finding——方向不进判据，这一臂是「末行最新」旧读下的判别臂；成对三：同一张表把表头版本降到表内最大版本之下、行序不动 ⇒ 恰一条 `change-history-latest-matches-front-matter`（成对：只改表头版本）。候选臂同在这一族：一份没有 `## Change history` 表的文档 ⇒ 顺序行候选 0 且零 finding（成对：同一份文档写一张表、相邻两行反号 ⇒ 恰一条）
- 补三处候选读数臂 — checkable: ① `doc-corpus.guard.test.ts#PINNED_KINDS`：一棵只放一份文档的临时根、标题写成 `## Change history (archived)` ⇒ 那张表读出 `null`、候选 0、规则零 finding（成对：同一份文档用 `## Change history` 并写一行参差行 ⇒ 恰一条 finding）。坐标钉常量而不是上面打印的标题：那几条标题由文件尾的 `for (const kind of PINNED_KINDS)` 渲染成 `keeps ${kind} within its recorded ceiling`，字面标题不在文件字节里，钉它会落一条死 pin（spec §6 同批禁它）；新臂是与那个循环并列的一条用例，它自己的标题由本轮写定、不在本坐标上；② `pins.guard.test.ts#declares the whole corpus, pins its size, and holds it at zero findings`：`PinAudit.census` 的 `symbol` · `path` · `total` 三项是 **finding 计数**（同一次 `scan` 的分解），交付语料上三项恒为零（同文件那条零扫描 pin 说的就是这件事），故非空半边落在一棵临时语料上——`fixture()` 建的根里写一份文档、带一条死 symbol pin 与一条死 path pin（`#reports the seeded dead pins and stops reporting them after the repair` 的两个形状）⇒ `census.symbol > 0` · `census.path > 0` · `census.total > 0`；成对：空根 `census([])` 上三项各为 0，同臂补 `empty.symbol` 与 `empty.path` 两条断言（语料 ONE way 用例现只读 `files` 与 `total`，`symbol` 与 `path` 在空根上无处断言）。这一臂量的是 finding 条数，不是 `files`——`files` 是语料体量，两者不互替，交付语料那一半只留体量读数；③ `charter-self-repair.test.ts#reports nothing on the real charter — both families at zero`：把已登记标题换成一个面表放不进的名字 ⇒ 标题下每一行落 `unmapped`、`measure-literal` 报 `this line sits under a heading with no declared face`（成对：保留标题 ⇒ 缺口 finding 消失）
- 删语料规模常量并写小树夹具 — checkable: 该常量在测试里零命中；覆盖证明由本任务新建的 `packages/cdd-engine/src-next/contract/__tests__/scan-coverage.test.ts` 承载——一棵两文档、带一条死 pin 的小树 ⇒ `PinAudit.census` 的 `files` 等于该树的文件数、`scan` 恰一条 finding；删掉夹具里一个语料根 ⇒ 该用例红（成对：把那个根加回 ⇒ 同一个 `files` 读数回来）；同一步处置这两个读数的语料面——它们都是活 pin 目标，删除之后语料里每一处裸 symbol pin 都成了死 pin，故同批把五份程序文档里的引用改成散文（`p37` 的 File 行 · `p38` 的 Files 行与验收与 Step 2 · `p41` 的 Files 行与复位步 · `p41-design` 的实现前窗口与 claim shape 两段 · 章程 `v4.16` 行），其中 `p38` 的 Objective 曾留着一句把旧取值写成比较形的散文（`` 语料规模常量 === 81 ``）——那个形不是 pin 语法（语料守卫只读内联代码段的 symbol 与 path 形），故任何一道门都不读它，不修就在删除之后继续声称一个不存在的常量，本步改成与同文件另三句同形的散文（已落：该名字在两个根上零命中）。判据：两个已删读数的名字在 `docs/kairos` 与 `packages` 两个根上零命中（成对：把 `p38` Objective 那一句写回带旧符号名的比较形 ⇒ 该扫面红；只删测试里的常量、不迁移这五份文档 ⇒ `pins.guard.test.ts` 的零扫描 pin 报出它们的裸 symbol）
- 三份头部注释同批改 — checkable: `pins.guard.test.ts` 那一份**三处各一条断言**，其中前两处按**在场**读、第三处按**零命中**读——`file count is a constant`（行内可见的片段：原句在盘上折成 `… and its` / `//     file count is a constant: …` 两行，整句 `its file count is a constant` 零命中，拿它当断言是改写前后都绿的假臂）· 头部的第二句按同一形态读行内可见片段 `the file list is a pinned`（原句在盘上折成 `… the file list is a pinned` / `// constant, and a document …` 两行，整句 `the file list is a pinned constant` 零命中，拿它当断言同样是改写前后都绿的假臂） · 常量自己的文档注释——v0.40 轮随常量一并删除（那条读数已由模块头与 `scan-coverage.test.ts` 承担，注释没有声明可挂），故这一处不是改写而是移除：前两处按**在场**读、这一处按**零命中**读（`pinned HERE` 在 `packages/cdd-engine/src-next` 上零命中即绿，写回一段无声明可挂的注释才是红）；`claim-shapes.test.ts` 的 `Two legs, both byte-level` 与 `charter-self-repair.test.ts` 的 `Four pairs, each with its counter-arm` 两句按**零命中**读，且各自读新落法；同一个 `charter-self-repair.test.ts` 里那个 `describe` 标题的可见片段 `its registration face carries the narrowings` 同批按零命中读——标题不是章程正文的断言，`\bnit\b` 之外的这道扫面到不了它，故它只能与 `Four pairs` 同一批改。同一个 `charter-self-repair.test.ts` 的模块头族清单按**零命中**读 `three families at zero`，且首条子弹只点名 `measure-literal` 一处、`## Phase inventory` 那条读作登记面而不是一族——陈旧处是家族计数，`\bnit\b` 那道扫面到不了测试文件、`temporal-indicator` 那条只撤得掉第二个文法名，故它与 `Four pairs` 同一批改。成对：把 `three families at zero` 写回句子里 ⇒ 红；首条子弹若留着第二个文法名 ⇒ Task 4 的零命中扫面红
- `claim-shapes` 改结构断言 — checkable: 三条臂——存在臂：删掉某个 claim shape 的子弹行 ⇒ 红；孪生臂：只改一个节点的某一个措辞词、两节点不再一致 ⇒ 红（成对：同一处措辞两个节点一起改 ⇒ 绿）；映射臂：把某个 shape 点名的规则 id 在两个节点上一起换成映射常量外的 id（两节点一致）⇒ 红（成对：只改措辞词 ⇒ 绿）
- `claim-shapes` 的映射随撒退重定向 — checkable: 该文件的映射常量在 `narrative` 那一格只点名 `line-coordinate` 一处、`temporal-indicator` 在该文件上零命中（成对：把 `temporal-indicator` 写回映射 ⇒ 红）；同批复核两个 skill 的 narrative 子弹只剩 `line-coordinate`（那两处归 Task 4 的第一层，本任务只读交付态）——故 spec §8 的零命中扫面在两个根上同读零
- 提交 — checkable: `git log -1 --format=%s` 以 `feat(p42):` 起头——本层是一次轮域提交（Task 6 · Task 8 · Task 9 同一条），测试随特性提交落地，故本任务的步也读 `feat(p42):`；`test(p42):` 那形在一条提交上无处落

#### Acceptance
三类各有一对成对臂，且「零 finding」从此能区分「干净」与「没跑」；两个被删读数的名字在语料两个根上零命中，`p38` 那句比较形的残留也在本任务里修掉。

#### DependsOn
5

### Task 10: fix 轮的回合内判定

#### Objective
把 `doc-contract` 从「下一跳的拒绝」提前到**本回合的收口**——座位是 `face/lifecycle.ts#verdictOf` 的 graded entry 面，与 `#structureViolations` 同一处、同一趟判定（基线在 `#dispatch` 取，判定在 `#verdictOf` 做），不是 child 回合里的某一点、也不是提交之前：`cl:atomic-commit` 骑在 child 自己的每条壳上（`render/templates.ts` 的 `cl:atomic-commit`），提交在引擎拿回控制权之前就已落地，故「写回之后、提交之前」在引擎里没有位置。判据是**本轮新增的违例**，基准是门自己测得的 findings 本身——`contract/doc-body.ts#DocBodyProjection` 的投影与 `session/ledger.ts#ReviewRefs#docRevision` 的 sha1 只证明正文动过、说不出哪条 finding 是新的，且那份绑定在本轮收口之后才写（`session/run.ts#Lifecycle` 的 `#recordReviewedDocRevision` 读的是盘上此刻的字节）；绝对判定会让修复轮被自己接手时的历史残留卡死。拒绝的是**推进**：本轮落一条 hard entry（既有 `contract-violation` 因由），轮 `status` 读 BLOCKED、无 `next:` 行、退出码非零，同一命令重发同一轮。本任务不承诺「不出提交」，只承诺「不到下一跳」。

#### Files
- Modify: `packages/cdd-engine/src-next/face/lifecycle.ts`（收口腿：`#dispatch` 取基准、`#verdictOf` 与 `#structureViolations` 同一趟判；多重集差按 finding 的整个身份 `kind@field@message` 做；`CliLifecycle` 的构造多接一格 `Contract`——收口腿跑的那条 `Contract.validate` 与派发门是同一个实例，构造缝缺这一格就只剩「各建一份」）
- Modify: `packages/cdd-engine/src-next/session/preflight.ts`（`PreFlightVerdict` 增 findings 一格：`ok` 分支把本轮的 `docOutcome.findings` 随 `order` / `checked` 一起交出——内部接口，`checked` 行零字节变化，`--dry-run` 预览不读它；判定本身复用既有 `doc-contract` 腿，不新起第二份判法）
- Modify: `packages/cdd-engine/src-next/session/run.ts`（`#Lifecycle.advance()` 把 findings 那一格交给 `#dispatch`；`OpenFrame` 增一格承载基准，与 `frame.structure` 同一纪律——只住帧上，不进 `progress.json`、不进载体、不进 in-flight；同批改 `PlanStructure` 的类注释：结构面不登记 doc-contract 规则行，是因为引擎有**两个** doc-contract 判定点——派发门与这条收口腿）
- Modify: `packages/cdd-engine/src-next/render/templates.ts`（`DOCS_FIX_SHELL` 的写入约束点名三条形状规则，落在那份壳自己的写约束行 `render/templates.ts#DOCS_FIX_SHAPE_RULES` 上、不进共享的 `LICENSE_ITEMS`；那一行的文档注释同批改读三个名字）
- Modify: `packages/cdd-engine/src-next/face/cli.ts`（组合根的两处接线：`preflight: { gate }` 交出已批准的判决本身，不再把 `ok` 折成 `null`；`#lifecycleOf` 建 `CliLifecycle` 时把根上那一个 `Contract` 一并交出——派发门与收口腿因此读同一个实例。`checked` 行、`--dry-run` 预览与既有拒绝报文零字节变化）
- Create: `packages/cdd-engine/src-next/session/__tests__/fix-round-gate.test.ts`

#### Consumes
- `session/preflight.ts#PreFlight` 的 `doc-contract` 腿与它交出的 `checked:` 面
- `session/preflight.ts` 的 `docOutcome.findings`——门自己测得的读数，随 `PreFlightVerdict` 新增那一格交出（不是 `DocBodyProjection` 的摘要，也不是 `docRevision` 的 sha1）
- `face/lifecycle.ts#dispatch` 与 `#verdictOf` 的两段分工、`#structureViolations` 的既有一趟，以及 `contract/judge.ts#Contract.validate` 在派发门那一处的入参构造（`docKey` · 绝对路径 · 字节 · `root`，闭包事实同读 `contract/pins.ts#PinAudit.provenClosed`，`taskLayers` 同读 `session/graph.ts#TaskGraph` 的 `batches()`）——两处一个构造
- `face/dispatch-values.ts` 选 `docs-fix` 的 doc 形状目标（`TargetFaceTable.isDocShape`）——适用范围与派发门同一行：wave / branch 轮没有 doc 面，这条腿不跑
- `render/templates.ts#DOCS_FIX_SHELL` 的既有写入约束段与它同级的那条「禁止 `any`」
- `face/cli.ts#preflightOf` 与 `#lifecycleOf`——组合根那一处：`PreFlight` 拿到的 `Contract` 与 `CliLifecycle` 该拿的是同一个实例，而 `run.ts#Lifecycle.advance()` 只在判决非空时读它，故「已批准的判决」这一形必须先由 `gate` 交出

#### Produces
- 收口腿：`docs-fix` 轮在 `face/lifecycle.ts#verdictOf` 与 `#structureViolations` 同一趟跑同一条 `contract/judge.ts#Contract.validate`，入参构造沿用派发门那一处
- 基准的两截：`PreFlightVerdict` 的 findings 一格（内部接口：`checked` 行零字节变化）与 `OpenFrame` 上的那一格（只住帧上）
- 新增违例 ⇒ 一条 hard entry（既有 `contract-violation` 因由，零新枚举、零新通道），报文逐条列 `kind@field: message`；本轮 BLOCKED、无 `next:` 行、退出码非零，同一命令重发同一轮
- 多重集差按 finding 的整个身份比（`kind@field@message`；报文形 `kind@field: message` 只是格式，不是比较键）
- 修轮 prompt 的三条写入约束（落在 `render/templates.ts#DOCS_FIX_SHAPE_RULES` 那一行）；那一行的文档注释同批读三个名字
- `session/run.ts#PlanStructure` 的类注释读两个判定点
- 组合根交出两样：已批准的判决（`gate` 返回判决本身，`advance()` 的 `verdict !== null && !verdict.ok` 判法不动）与那一个 `Contract`（`CliLifecycle` 的构造接到根上实例）

#### Steps
- 组合根接线 — checkable: `face/cli.ts` 的 `gate` 在 `ok` 时返回判决本身，`advance()` 的 `verdict !== null && !verdict.ok` 测试保持既有语义；`CliLifecycle` 的构造与 `PreFlight` 拿到同一个 `Contract` 实例（不是各建一份）。成对：把 `gate` 写回 `ok ? null : preflight` ⇒ 基准恒空、下面那条生产形臂红；只给派发门 `Contract` ⇒ 收口腿的入参构造分叉，同一夹具上两面读数不再相等
- 生产形臂 — checkable: 经 `face/cli.ts#lifecycleOf` 建出的 `CliLifecycle`（不是测试里手搭的 stub gate）跑一轮已批准的 `docs-fix`，其帧上基准那一格等于派发门测得的那几条 findings 且非空。这一臂是接线那条的读数面：stub gate 直接给判决时组合根不参与，`gate` 折空也测不到，故它必须走生产构造
- 收口腿落位 — checkable: 一轮 `docs-fix` 在干净 phase-spec 上写进一条 `measure-literal` 违例 ⇒ 本轮落一条 hard entry、报文列出那条（`measure-literal@…`）、轮 `status` 读 BLOCKED、无 `next:` 行、退出码非零，同一命令重发同一轮（成对：同一句改回可写形态 ⇒ 本轮照常完成，`targetAction: true`、`next:` 按路由出现）。这一臂只钉「不到下一跳」：child 的 `cl:atomic-commit` 先落地，故不钉「不出提交」
- 适用范围与门同一行 — checkable: 同一份带违例的文档、同一句新写的违例，目标类型不是 doc 形状（`TargetFaceTable.isDocShape` 为假，wave / branch 轮）⇒ 收口腿零 hard entry（成对：只把目标类型换成 `docs-fix` ⇒ 报那一条）
- 差分基准 — checkable: 帧带着基准、文档带的那条与基准同 ⇒ 零新增、收口照常；成对：在基准之外再加一条 `measure-literal` ⇒ 只报新增的那一条
- 同标题替换臂 — checkable: 基准带一条 `measure-literal@## Design`，本轮基准那条已改好、而在同一标题下写出另一条 `measure-literal` ⇒ 报一条（按 `kind@field@message` 的整身份做多重集差；`kind@field` 集合差在这一态读成零新增）
- 基准非空的那一态 — checkable: 注入一条 `warn` 档 finding（`contract/judge.ts#Contract` 的构造缝只收注册表）⇒ 派发门放过它、本轮不把它读成新增；成对：同一行改判 `block` ⇒ 门当场拒、那一轮从未开始（这半边正是「闭合态基准恒空」的证据）
- 帧上的那一格 — checkable: 基准不进 `progress.json`、不进载体、不进 in-flight（三处零命中）；`--dry-run` 预览的字节与改动前逐字节相同
- 退出码的单独理由 — checkable: 一份把文档写坏的 `docs-fix` 轮由「照常收口、下一跳才拒」变成「本轮 BLOCKED、退出码非零」，理由就记在这一步：`doc-contract` 在收口处第一次有引擎的位置，拒绝的是推进而不是提交（`cl:atomic-commit` 已经落地），故它是 §7 的 ⑧ 新增而非破坏——既有报文与既有轮型的 `next:` / 退出码一字不改（成对：一份未把文档写坏的 `docs-fix` 轮 ⇒ 退出码与改动前逐字节相同）
- 收口腿的注释引对节号 — checkable: Files 行那几份文件里引这条腿权威的注释串 `P42 §1.3` 逐处改到 `P42 §7`——spec 的节号自 §1.1 · §1.2 直接跳到 §2，收口腿住 §7，§1.3 从未存在；这条腿的注释正是本任务落的，故读数按 Files 行那几份文件读。改后 `P42 §1.3` 在 `packages/cdd-engine/src-next` 上零命中（成对：留一处旧引 ⇒ 该扫面红；把节号改成 `§8` 或 `§6` ⇒ 引到的是别的腿，同一道扫面读不出来、故本条同时要求注释点名的是收口腿）
- prompt 写入约束 — checkable: `render/templates.ts#DOCS_FIX_SHAPE_RULES` 那一行里 `measure-literal` · `line-coordinate` · `live-arithmetic` 三条各出现一次、`temporal-indicator` 零命中（`DOCS_FIX_SHELL` 经它展开，故壳里的写约束就是那一行；删掉任一条 ⇒ 该用例红）；那一行的文档注释同批改读三个名字——它现写「the four shape rules the dispatch gate judges」与「One row, four names」，而这一行交付的是三个名字（成对：把注释写回「four」⇒ 红；把名字写进共享的 `LICENSE_ITEMS` ⇒ 同一次编辑落在实现、fix、review 三条 prompt 上，与本条的单行落点相反）
- `PlanStructure` 的注释读两个判定点 — checkable: 旧句「the engine's single doc-contract evaluation point is the pre-dispatch gate」在 `session/run.ts` 里零命中，改后的读法点名派发门与收口腿两处（成对：把旧句写回 ⇒ 红）
- 提交 — checkable: `git log -1 --format=%s` 以 `feat(p42):` 起头

#### Acceptance
修复轮在自己的回合收口处就知道自己写坏了——一条 hard entry、轮 BLOCKED、无 `next:` 行、退出码非零、同一命令重发同一轮；而接手一份带历史残留的文档不会因此永远收不了口：基准是门测得的 findings，不是绝对读数。比较键是整个身份，同一标题下换一条新的仍报。基准由组合根交出的那一个判决承载——`gate` 折空时它在测试里绿、在生产里恒空，故接线与生产形臂同批落。提交已经落地，故本任务只承诺「不到下一跳」，不承诺「不出提交」。

#### DependsOn
none

### Task 11: 符号 pin 的文件归位

#### Objective
让 `path#Symbol` 真的校验路径。符号表改成按文件分区，判据查解析到的那个文件的符号集；成员 pin 按三具写法分判——路径载体（`path#member`）与裸类名载体（`Class#member` · `Class.member`）都归位到载体解析到的那一份文件，裸 `symbol` 没有载体、判据不动。裸类名载体走同一张表的反查方向：落到**声明**它的那份文件，落不成恰一份（零份或多份）⇒ 恰一条 finding 点名该载体与它的候选，与路径第三层「不替文档挑一个候选」同一读法。**声明只在绑定处算，导入子句不算**：`import { type RoundRecord }` 一类导入子句点名的是一份既有绑定，它不造绑定，故不让 `RoundRecord` 在每一份导入它的文件里各添一处「声明」——否则裸类名载体的反查落成多份、按「落不成恰一份」报一条歧义 finding，而语料里每一枚 `RoundRecord.carrierPath` 都被判成歧义，本任务自己的语料迁移臂永远绿不了。成员「在那个文件里」由一处声明识别器判，吃 `contract/pins.ts#PinSource.codeOf` 的输出，并在它之上把字符串与模板字面量一并抹掉——字面量是一个值而不是一条绑定，`codeOf` 保留它们是给标识符索引那一面用的（读那一面的是 `contract/pins.ts#PinIndex.symbols()`，`contract/__tests__/pins.guard.test.ts` 的头部注释点名了同一条判读：字面量里的名字在那一面就是声明），成员面要的是绑定；不抹就出假歧义：`contract/__tests__/pins.guard.test.ts` 与 `session/__tests__/doc-revision-body.test.ts` 把 `export class HandoffSchema {` 与 `export class ReviewRefs` 写成夹具串，保留字面量时这两个类名各在两份文件里「声明」，裸类名载体的成员 pin 因此一律落成多份、按「落不成恰一份」报一条歧义 finding，而语料里成片的 `HandoffSchema` 与 `ReviewRefs` 成员 pin 都得跟着改。识别器认两栏：声明一栏（类 · 接口 · 类型 · 常量 · 函数 · 枚举）与成员一栏四形（类体 · 接口体 · 类型字面量 · 对象字面量属性键）。三段的 `path#Class.member` 不是一枚被读的 pin（成员半带点过不了 `PinVocabulary.isSymbol`），本任务不放松那道筛。改成严判之后语料里写错文件的 pin 会一次性变红，逐条改到正确的文件——门与语料同批，不留红着的中间态。裸类名载体落不成恰一份的那一类与它同批：成员住在别处的改路径，声明的类名不唯一的改指取代它的实现，已无对应实现的 claim 则删掉。成员面的判域写死在「解析到的那一份文件里的声明」上，故第三种落法要写明：载体解析到的那一份是数据文件（`package.json` 一类），成员面在那里没有槽——识别器吃的是抹掉字面量之后的代码正文，而数据文件的键本身就是字符串字面量，故那一类文件交不出成员声明；这一形判零条而不是报一条缺成员（`package.json#devDependencies` 就是它：被抹掉的是键、不是绑定——p28 plan 把它写在依赖步里，本 plan 没有依赖步，只在 Task 11 自己的散文里点到它，落到哪一处都判零条）。这个判零条是**判域收窄**、不是 spec §9 (b) 的「每一枚」，取代关系按 Task 9 的登记形写进 Produces，spec 本体不在本任务的改动面。历史阶段文档同批迁移、不新设冻结面：本任务已经在 p8 · p10 · p35 · p40-design 上按同一落法改过成员 pin，故其余带 class ① 成员的文档进 Files 行，不另立一条「这份历史文档豁免」的规则。

#### Files
- Modify: `packages/cdd-engine/src-next/contract/pins.ts`（`PinIndex` 的符号表按文件分区 + 裸类名载体的反查方向 + 吃 `PinSource.codeOf` 输出的声明识别器——改的是作用域：`Class.member` 的分段解析已经存在；路径形状判者与 `PlanTaskBlocksReader` 收成一处）
- Modify: `docs/kairos/overalls/2026-10-10-engine-doc-tooling-overall.md`（写错文件的 pin 改到正确的那份；D16 那一行的裸类名载体 `WaveGate` 在 `session/wave.ts` 只声明一份、`vet` 与 `#phaseOf` 两个成员都落在那份文件里，故它不需要迁移——判据上线后那几枚成员 pin 照旧绿，章程的迁移集由判据实测给出）
- Modify: `docs/kairos/plans/2026-10-10-engine-doc-tooling-p8.md`
- Modify: `docs/kairos/specs/2026-10-10-engine-doc-tooling-p8-design.md`
- Modify: `docs/kairos/plans/2026-10-10-engine-doc-tooling-p10.md`（`routeWords` 那一族载体在树里零份声明）
- Modify: `docs/kairos/specs/2026-10-10-engine-doc-tooling-p10-design.md`（`routeWords` 那一族载体在树里零份声明）
- Modify: `docs/kairos/plans/2026-10-10-engine-doc-tooling-p35.md`（`pipelineFacts` 零份声明 · `PlanSource.readFor` 是 class ② 的重指落点：`const planSource` 落在两份声明文件上（`face/cli.ts` 两处 · `session/__tests__/run.test.ts` 一处），故载体落不成恰一份，而成员 `readFor` 在 `infra/plan-source.ts` 里活着，故取 ② 的改指而不是删掉 claim）
- Modify: `docs/kairos/specs/2026-11-17-engine-doc-tooling-p40-design.md`（`inFlight` 被两处函数局部 `const` 声明）
- Modify: `docs/kairos/plans/2026-10-10-engine-doc-tooling-p1.md`（`declaredRegistries` 的成员 pin 随 kebab 改名退休：`phaseSpec` → `"phase-spec"` 键——该载体在 `contract/declare.ts` 只声明一份，故这一行归迁移步 ① 的退休半句，不归 ② 的歧义半句）
- Modify: `docs/kairos/plans/2026-10-10-engine-doc-tooling-p7.md`（`ProgressRow` 上那枚随 p7 改名退休的 doc-only 字段名：成员 pin 的载体仍解析到恰一份文件，成员名却已不在，故按活字段改到仍声明的成员）
- Modify: `docs/kairos/specs/2026-10-10-engine-doc-tooling-p7-design.md`（同一枚退休成员名，落法同上）
- Modify: `docs/kairos/plans/2026-10-10-engine-doc-tooling-p9.md`（`BoardView` · `RepoRoot` 的成员 pin，载体解析到的那份文件不提该成员）
- Modify: `docs/kairos/plans/2026-10-10-engine-doc-tooling-p15.md`（`ChainRoot` 的成员 pin）
- Modify: `docs/kairos/plans/2026-10-10-engine-doc-tooling-p22.md`（`NextHopInput` 的成员 pin）
- Modify: `docs/kairos/plans/2026-10-10-engine-doc-tooling-p24.md`（`SlugIndex` 的成员 pin）
- Modify: `docs/kairos/specs/2026-10-10-engine-doc-tooling-p26-design.md`（`SlugIndex` 的成员 pin）
- Modify: `docs/kairos/plans/2026-10-10-engine-doc-tooling-p31.md`（`CarrierIntegrity` · `RoundNaming` 的成员 pin）
- Modify: `docs/kairos/plans/2026-10-10-engine-doc-tooling-p33.md`（`CliLifecycle` 的成员 pin，成员住在另一份文件）
- Modify: `docs/kairos/plans/2026-10-10-engine-doc-tooling-p34.md`（`CarrierIntegrity` 的成员 pin）
- Modify: `docs/kairos/specs/2026-10-10-engine-doc-tooling-p34-design.md`（`RoundNaming` · `CarrierIntegrity` 的成员 pin）
- Modify: `docs/kairos/specs/2026-10-10-engine-doc-tooling-p35-design.md`（`SlugIndex` 的成员 pin）
- Modify: `docs/kairos/plans/2026-10-10-engine-doc-tooling-p36.md`（`SlugIndex` 的成员 pin）
- Modify: `docs/kairos/specs/2026-10-10-engine-doc-tooling-p36-design.md`（`SlugIndex` · `PlanOrphan` 的成员 pin）
- Modify: `docs/kairos/plans/2026-11-17-engine-doc-tooling-p38.md`（`CliLifecycle` 的成员 pin，成员住在 `session/carrier-rulings.ts`）
- Modify: `docs/kairos/plans/2026-11-17-engine-doc-tooling-p40.md`（`CliLifecycle` 的成员 pin）
- Modify: `docs/kairos/plans/2026-11-20-engine-doc-tooling-p42.md`（本 plan 自己带 class ② 的成员 pin：原写作 planSource.readFor 与 planSource.readFor(entry) 的两形按同一落法重指到 `PlanSource.readFor` · `infra/plan-source.ts#readFor`——不然判据上线后这两形当场红，而它们就在本任务要判的语料里，故这份文档在自己的 Files 行内）
- Modify: `docs/kairos/specs/2026-11-20-engine-doc-tooling-p42-design.md`
- Test: `packages/cdd-engine/src-next/contract/__tests__/pins.guard.test.ts`

#### Consumes
- `contract/pins.ts#PinIndex` 的既有解析面与 `PinAudit` 的三处判定点
- `contract/pins.ts#PinSource.codeOf`——声明识别器的输入（注释正文已抹掉）；识别器在它之上再抹字符串与模板字面量（字面量是值，不是绑定）；`PinVocabulary.memberOf` 已把两具载体的载体段与成员段分开
- Task 9 清完之后的那份 `pins.guard.test.ts`（语料规模常量已不在，惰性臂已在）
- 语料里现有的 `path#Symbol` pin

#### Produces
- 按文件分区的符号集
- 裸类名载体的反查方向，与零份 / 多份声明时的歧义拒绝（恰一条 finding 点名载体与候选）
- 吃 `PinSource.codeOf` 输出、并在其上抹掉字符串与模板字面量的声明识别器：声明一栏六形 + 成员一栏四形（字面量保留时 `HandoffSchema` 与 `ReviewRefs` 各在两份文件里「声明」，整片语料的裸类名载体都落成多份）
- 语料跑到零：本步不枚举要改哪些文档——判据上线后跑一遍 `pins.guard.test.ts`，红的那几处就是迁移集，改到它绿为止（零份与多份的裸类名载体同在这一面上）。清单因此由实测给出，而不是由本文件预先声明——预声明会在每一轮评审里被指出漏一份，而语料本身是最好的清单；成员面的判域外一形写明：载体解析到数据文件（`package.json` 一类）时判零条——识别器抹掉字面量之后，数据文件的键交不出成员声明
- spec §9 (b) 的成员面判域由本 plan 收窄一处，就地登记：数据文件载体的成员 pin 判零条——这一句取代 §9 (b) 的「每一枚成员 pin 都在它的载体解析到的那一份文件里判」里的「每一枚」，故 §9 (b) 在本相位读到的是「源文件载体上的每一枚」；改 spec 本体需要另一个带 `may.amend` 的轮，不在本 plan 的改动面，故取代关系以这一行登记，判零条的读数由 `pins.guard.test.ts` 的零命中臂在 p28 plan 与本 plan 上读出

#### Steps
- 符号表按文件分区 — checkable: 一枚路径可解析、符号住在别的文件里的 pin ⇒ 报一条；同一枚把路径改到符号真正所在的文件 ⇒ 零拒绝（成对：只改路径）
- 成员形态纳入判据 — checkable: `<tmp>/src/carrier.ts` 里按声明形态写 `export const DepthMap = …`、pin 写作 `<tmp>/src/carrier.ts#DepthMap` ⇒ 零拒绝；同一枚把那段声明删掉、名字只在字符串字面量里剩（`export const label = "DepthMap";`）⇒ 恰一条 finding（成对：只改声明形态）。注释里出现过的名字不算坐标（`codeOf` 已抹掉注释正文，那一态在相位之前就是绿的，不单独作臂）。接口载体那一臂同批：`<tmp>/src/carrier-body.ts` 写 `export interface CarrierBody { readonly DepthMap?: string }` ⇒ 零拒绝；同一枚把属性改写成 `readonly depthMap?: string`（pin 一字不动）⇒ 恰一条 finding（识别器只认类体时两态都读一条，第一态当场红）。覆盖面写进同一条：类体 · 接口体 · 类型字面量 · 对象字面量属性键（语料里成片的是 interface / type 载体）。夹具的成员名带内层大写或下划线（`isSymbol` 只认 `#` 前缀 · 下划线 · 内层大写）。三段的 `path#Class.member` 不进任何臂：成员半带点过不了 `isSymbol`，本任务不放松这道筛，写它等于让臂在零实现下也绿。字面量那一对同批：两个夹具串只在 `pins.guard.test.ts` 与 `session/__tests__/doc-revision-body.test.ts` 里出现，识别器抹掉字面量之后 `HandoffSchema` 与 `ReviewRefs` 各只落一份声明、零拒绝（成对：识别器保留字面量 ⇒ 两个类名各在两份文件里「声明」，裸类名载体的成员 pin 一律报一条歧义 finding）；数据文件那一形同批一条：载体解析到 `package.json` 这类数据文件 ⇒ 成员面判零条（成对：同一成员写成源文件载体、而那份文件不声明它 ⇒ 恰一条 finding）
- 裸类名载体的反查 — checkable: 一枚载体是裸类名、该类名在树里只被唯一一份文件声明、而它的成员不在那份文件里 ⇒ 恰一条 finding；同一枚把成员改成那份文件里声明过的名字 ⇒ 零拒绝（成对：只改成员）。歧义臂：类名被两份文件声明、或一份也没有 ⇒ 恰一条 finding 点名该载体与它的候选（与路径第三层同一读法）；同一枚把载体改写成路径载体 ⇒ 按路径载体那一臂判。两态在相位之前都读零（全树并集），故这一臂只在反查落地后才红。导入子句臂：`RoundRecord` 在 `session/ledger.ts` 里绑定、另几份文件把它写进导入表 ⇒ 反查落成那一份、`RoundRecord.carrierPath` 零 finding（成对：把导入子句读成声明 ⇒ 反查落成多份、该枚报一条歧义 finding，与上一条歧义臂同时红）
- 语料迁移 — checkable: `pins.guard.test.ts` 的零命中臂在这条判据下绿；迁移面按 spec §9 的两类分开走，不留一类没有落法：① 载体点了文件而成员住在别处的一类，两种载体拼法各给落法——路径载体把路径改到成员真正所在的那一份；裸类名载体先从声明反查到那一份文件，成员不在其中时把坐标写成成员真正所在那份文件的 `path#member`，或改指真正持有它的类；成员随改名退休的一形并入这一类——载体仍解析到恰一份文件（`ProgressRow` 只在 `session/ledger.ts` 声明一份），成员名却已不在其中，活字段是 `reviewedRevision`，而 `docs/kairos/plans/2026-10-10-engine-doc-tooling-p7.md` 与 `docs/kairos/specs/2026-10-10-engine-doc-tooling-p7-design.md` 里那几枚成员 pin 都是同一次改名留下的：句子是活坐标的改到仍声明的 `ProgressRow.reviewedRevision`，只记改名的那一句换成不点退休名的说法（例如「该字段由 `reviewedRevision` 取代」）——退休名以任何形态留在正文里都是一枚落不到声明的裸 symbol pin，故「删掉 claim」在这里的具体读法是换说法；② 载体落不成恰一份的一类（`routeWords` · `pipelineFacts` 在树里零份声明，`inFlight` 被 `face/board-view.ts` 与 `session/preflight.ts` 各一处函数局部 `const` 声明，`planSource` 被 `face/cli.ts` 两处与 `session/__tests__/run.test.ts` 一处的函数局部 `const` 声明——两份声明文件），把坐标改指取代它的那份实现、或删掉那条已无对应实现的 claim——绝不改到同名的测试 helper 上；`planSource` 取 ② 的第一支（改指）：成员 `readFor` 在 `infra/plan-source.ts` 里活着，故 planSource.readFor 与 planSource.readFor(entry) 两形写成 `PlanSource.readFor`（`PlanSource` 在 `infra/plan-source.ts` 只声明一份）或 `infra/plan-source.ts#readFor`；第二支（删 claim）在这里删掉的是一枚成员住在别处的活坐标。本 plan 散文里同一族（planSource.readFor 与它的 `(entry)` 形）是同一类、同一落法，故它也在自己的 Files 行内；③ 载体解析到数据文件的一类不迁移——成员面在那里没有槽、判零条，故它是判域外而不是遗留（p28 plan 的 `package.json#devDependencies` 就是它，故那份文档不进 Files 行）。带成员 pin 的文档因此一份也不落在 Files 行之外——class ①② 的每一份都在行内改（本 plan 也在：它的 planSource.readFor 一族归 ②）；class ③ 只有 p28 plan 的依赖步那一枚在判域之外、不需迁移，本 plan 散文里的 `package.json#devDependencies` 同样是 ③、同样判零条，但它不是本 plan 的成员 pin；迁移集不记计数（spec §9 (c) 的差集读法），本句只记这一条集合关系；历史阶段文档同批进 Files 行、不新设冻结面（本任务已经在 p8 · p10 · p35 · p40-design 上按同一落法改过），改完零命中臂在整份语料上绿（成对：把任一处改回错的路径，或把一条已无实现的 claim 写回 ⇒ 红；把一份历史文档从 Files 行摘掉 ⇒ 它上面的 class ① 成员 pin 当场红，因为那条臂读的是整份语料）
- 提交 — checkable: `git log -1 --format=%s` 以 `fix(p42):` 起头

#### Acceptance
一枚 pin 说「这个文件里的这个符号」，引擎就真的去那份文件里找；写成别的文件时它红，而报文形状与档位不变。成员 pin 的三具写法各有落法：路径载体与裸类名载体按声明文件判，裸 `symbol` 不动；裸类名落不成恰一份时恰一条 finding（导入子句不算声明，故 `RoundRecord` 落成一份），三段的 `path#Class.member` 与 `isSymbol` 的放松都不在交付面上。成员判据的输入是绑定而不是字面量——夹具串不造第二份声明；载体解析到数据文件时成员面判零条，而这一形是判域外、不是遗留——判域收窄取代 spec §9 (b) 的「每一枚」，取代关系登记在 Produces。

#### DependsOn
9


## Change history

| Version | date | summary | author |
|---|---|---|---|
| v0.41 | 2026-11-22 | 评审第 26 轮回填（三条 warn 全数采纳）：Task 4 的 pin 极性步登记 spec §3.1 的块外臂为残留——块外 `- Create: <未落地路径>` 照旧豁免且不参与 `single-create` 的计数，本计划与两份夹具上该臂零命中、两半行为实测合规，故归下一个带 `may.amend` 的轮 · Task 9 的三份头部注释步与交付态对齐：常量自己的文档注释已在 v0.40 轮随常量删除，那一处按零命中读而不是改写，模块头与 `scan-coverage.test.ts` 承担同一条读数 · Task 11 的 p1 那一行归回迁移步 ① 的退休半句：`declaredRegistries` 在 `contract/declare.ts` 只声明一份，成员随 kebab 改名退休，活形态是 `"phase-spec"` 键 | Oscaner M. · Claude（kairos:cdd-fix） |
| v0.40 | 2026-11-22 | 波 `{6,8,9}` 修复轮（五条 warn 全数处置）：`p38` Objective 那句把旧读数写成比较形的散文改成同文件另三句的散文形，那个已删符号名在 `docs/kairos` 与 `packages` 两个根上零命中，成对臂改读带旧符号名的比较形；Task 9 的步同步改成已落的读法 · `pins.guard.test.ts` 删掉常量留下的孤儿文档注释——那条读数已由模块头与 `scan-coverage.test.ts` 承担，注释无声明可挂 · changeset 补上缺失的 EOF 换行 · Task 8 的 Produces 登记 `fix-round-gate.test.ts` 的夹具改动（`Files` 行会触发 `single-create`，故登记为散文）· Task 9 的提交前缀改读 `feat(p42):`，与已落地的层提交一致 | Oscaner M. · Claude（kairos:cdd-fix） |
| v0.39 | 2026-11-22 | 评审第 25 轮回填（一条 warn 全数采纳）：Task 8 的 Produces 补一条 spec 取代登记——spec §4 写「changeset 一包 minor：`cdd-engine`」，而 §8 与 Task 8 的验收都要求两个 skill 的 narrative 子弹改写，那两处随插件发布，故 `kairos` 也成一次真实的版本移动、两包同读 minor；取代关系按 Task 9 · Task 11 的形就地登记，spec 本体归下一个带 `may.amend` 的轮，两包 bump 不撤回 | Oscaner M. · Claude（kairos:cdd-fix） |
| v0.38 | 2026-11-22 | 评审第 24 轮回填（一条 blocker · 两条 warn 全数采纳）：Task 7 补上章程 `执行序` 段里 P42 那一格——它念着 `double-owned` 与 `consume-cycle` 两条注册表里没有的规则，而十组没有一组改得到它，故并进组二同批换成交付的三条，Objective · 组二 · Produces · Acceptance 四处同批；v4.51 与 v4.52 两行按当时字节保留，理由落在组九 · 组五的 `两种写法` 零命中臂收窄到 P42 行的验收 ⑬ 那一格，并点名 v4.25 那一行是唯一的域外命中（原臂要求全章零命中，而那一行没有组改得到，臂因此永不成立）· Constraints 的窗口段改读已闭合的记账：Task 4 与 Task 8 两端都已交付，四条新规则行在注册表里读 `block`，pin 与全量门不再预期红 | Oscaner M. · Claude（kairos:docs-fix） |
| v0.37 | 2026-11-22 | 评审第 23 轮回填（一条 blocker · 三条 warn 全数采纳）：Task 11 的自指坐标收口——`planSource` 归回 class ②（`const planSource` 落在两份声明文件上：`face/cli.ts` 两处 · `session/__tests__/run.test.ts` 一处，成员 `readFor` 在 `infra/plan-source.ts` 里活着，故取改指而不取删 claim 那一支），Files 行 · 迁移步 ② · 集合关系句三处同批；本 plan 进 Task 11 的 Files 行——它的 planSource.readFor 一族在判据上线后当场红，而 `package.json#devDependencies` 那一枚是 class ③、判零条，两形不再混作一类 · Task 5 的闭合块改回交付态：`skipWhenClosed` 的列注释与两份测试文件对真注册表的读数**未交付**（交付树仍读「只有形状行豁免」与「六条」），spec §3.2 的重写项按残留登记、归下一个带 `may.amend` 的轮，Files 行 · Produces · 步 · Acceptance 四处同批 · 章程 D16 那一行不需要迁移（`WaveGate` 在 `session/wave.ts` 只声明一份、两个成员都落在那份文件里），Files 行与迁移步 ② 同批撤掉这条错类 | Oscaner M. · Claude（kairos:cdd-fix） |
| v0.36 | 2026-11-22 | 评审第 22 轮回填（一条 blocker · 三条 warn 全数采纳）：Task 5 的形状面／列注释那句的「写回即红」假成对臂撤掉——`contract/__tests__/rules.test.ts` 对该文件源码唯一的计算比较是类注释里那三个数，形状面那句与 `skipWhenClosed` 的列注释都不在它的读数面上（spec §3.2 同批登记），判据改成逐句与表对齐 · 同文件 `RuleDeclarationBase.skipWhenClosed` 的列注释改为按交付后的豁免名册**重写**（五条形状行连同顺序行 `change-history-newest-last`），Files 行 · Produces · 步 · Acceptance 四处同批，旧句「只有形状行豁免」被本任务自己落的那一行证伪 · Task 5 的两处夹具字面步收下两份测试文件对真注册表的读数（`packages/cdd-engine/src-next/session/__tests__/preflight-rows.test.ts` 的 `SHAPE_ROW_IDS` 括注与 `rules-severity.test.ts` 的三处），夹具自己的六个合成 id 与叙述它们的两句一字不动 · Task 9 的语料面按交付态补全：五份程序文档的裸 symbol pin 随两个手写读数的删除改成散文，`p38` Objective 那句比较形的残留（不是 pin 语法，门读不到）同批修掉，Files 行 · Produces · 步 · Acceptance 同批 | Oscaner M. · Claude（kairos:cdd-fix） |
| v0.35 | 2026-11-22 | 评审第 21 轮回填（三条 warn 全数采纳）：Task 9 的 `charter-self-repair.test.ts` 头部计数改成按臂点名——「改三对」把第二个 `describe` 的删除读成第一个 `describe` 的对数变化，而那句计数在 `catches the copy that keeps ONLY the backfill family` 落地后已经陈旧，外层 `describe` 标题的改动理由与臂集分开写，spec §6 的同句以 Produces 的取代登记处理 · Task 11 的 `planSource` 从 class ② 移到 class ① 并给出重指（两处 `const planSource` 同住 `face/cli.ts`，判据数的是声明文件，成员 `readFor` 在 `infra/plan-source.ts`），`inFlight` 留在 ②（`face/board-view.ts` 与 `session/preflight.ts` 各一处）· Task 3 的 `render/brief.ts` 行点名 `## Notes` 标题与落位，Task 6 的 `render/templates.ts` 行带上「保留 notes 分句」的约束、`render/__tests__/render.test.ts` 进 Files 行作为那三处 notes 分句的读数面 | Oscaner M. · Claude（kairos:cdd-fix） |
| v0.34 | 2026-11-22 | 波 `{2,3,5}` 评审第 1 轮回填（四条 warn 全数采纳）：Task 5 的注入面按实测落定——`session/preflight.ts` 的 `doc-contract` 腿那一格是死接线（`graph` 门先带着 `details` 拒绝返回，那一格永远收到空集），已删掉，`ContractInput.graphIssues` 留在判据直读面作程序化注入，Files 行的填充面同步改读这一处；臂的第二次调用读数改成零注入读数，臂本身仍在 `Contract` 直读面上 · 详情行唯一拼装点的扫面改成全树（`src-next/**/*.ts`，`__tests__` 除外），`session/preflight.ts` 零命中作为点名特例 · `RULE_REGISTRY` 类注释的三个数由算出比较守住（读注释、与 `doc` / `ledger` / 合计逐格相等；写成无逐 scope 计数的形状即无主语）· brief 的 `## Notes` 段在三处 prompt（`render/templates.ts`，Task 6 的文件面）与 `render/brief.ts` 模块头点名，pin 住 `render/__tests__/render.test.ts`（wave 评审读的正是同一份 brief，此前那一段无人描述） | Oscaner M. · Claude（kairos:cdd-fix） |
| v0.33 | 2026-11-22 | 评审第 20 轮回填（三条 warn 全数采纳）：Task 5 的 `contract/judge.ts` 行按树点名两个声明各自的家——`ContractInput` 住该文件，`JudgeContext` 与注入形状 `InjectedGraphIssue` 住 `contract/invariants.ts`（那一行本就在文件集里，故不缺文件），判据平面零 `session/` import 的理由原样保留 · 同一行的填充面收成单点：填 `graphIssues` 的只有派发门 `session/preflight.ts` 的 `doc-contract` 腿，收口腿 `face/lifecycle.ts` 的 `#contract.validate` 不填，理由随句写明（带环的 plan 在 `graph` 门就被拒，收口腿因此观察不到那条 issue） · 注入面那一步改读交付态——成对臂住在 `Contract` 的直读面上（环夹具归 Task 5），`preflight` 那一格是防御缝（`graph` 门先带着 `details` 拒绝返回，那一格在可运行态里永远收到空集，删掉它不让任何用例变红），删去「门把同一份 issue 交给判据」的活载体说法 | Oscaner M. · Claude（kairos:cdd-fix） |
| v0.32 | 2026-11-22 | 波 `{2,3,5}` 实施回填（三处以实测读数重述）：Task 3 的 ① 与 ⑥ 把派生 `contractViolationCount` 的读数从 0 改 2 撤回——两条夹具都只走 `dispatch.step()`，记录由 CLI 的 bookkeep 落地，派生面因此读 0，两笔后果的读数臂改挂 `notes-channel.test.ts` 的 Lifecycle 臂 · Task 5 的 Files 补进 `contract/judge.ts`：判据平面不 import `session/`，图的判词以 `ContractInput.graphIssues`（可选，与 `taskLayers` 同形）注入，`session/preflight.ts` 与判据调用方各填它，缺省即零候选，同批给这一步一条成对臂 | Oscaner M. · Claude（kairos:cdd-fix） |
| v0.31 | 2026-11-22 | 波 `{7,11}` 评审第 19 轮回填（一条 warn 全数采纳）：Task 11 的 Objective 里 class ③ 实例句按树重述——原句说「本 plan 与 p28 plan 的依赖步各载一枚」，而本 plan 没有依赖步，那三处 `package.json#devDependencies` 全落在 Task 11 自己的散文里（这一句 · 迁移步 · v0.28 行），读者照原句去找依赖步会找不到、并把那几处读成漏迁移；改后只点名两个真实的家（p28 plan 的依赖步 · 本 plan 的 Task 11 散文），不记计数，集合关系与 §9 (b) 取代登记一字不动 | Oscaner M. · Claude（kairos:cdd-fix） |
| v0.30 | 2026-11-22 | 波 `{7,11}` 评审第 18 轮回填（一条 blocker · 两条 warn 全数采纳）：Task 11 的迁移集补进 p7 plan 与 p7-design——`ProgressRow` 上那枚随改名退休的 doc-only 字段名在两份文档里各载几枚成员 pin，落法并入 class ①（活坐标改到仍声明的成员，只记改名的那一句换成不点退休名的说法，因为退休名以任何形态留在正文里都是一枚死裸 symbol pin），迁移步里「带成员 pin 的历史阶段文档共十六份 …」那句的计数改成集合关系（Files 行之外不余一份；class ③ 那一对是 p28 plan 与本 plan），按 spec §9 (c) 的差集读法不记计数 · 数据文件那一形的理由按树重述并登记为 spec 取代：被抹掉的是键、不是绑定，判零条收窄了 §9 (b) 的「每一枚」，取代关系按 Task 9 的形写进 Produces · 声明识别器保留字面量的理由改指真读到它的那一面（`PinIndex.symbols()` 与 `pins.guard.test.ts` 的头部注释），不再引不读文件的 `face/words.ts` | Oscaner M. · Claude（kairos:cdd-fix） |
| v0.29 | 2026-11-20 | 编排者回填（连续四轮同一族 ⇒ 换判据形态）：Task 11 的迁移集不再枚举，改成「判据上线后跑一遍、红的就是迁移集」——清单由实测给出 | Oscaner M. · Claude（kairos:cdd-plan） |
| v0.28 | 2026-11-22 | 波 `{7,11}` 评审第 17 轮回填（一条 blocker · 一条 warn 全数采纳）：Task 11 的迁移面按实测收全——Files 行补进十五份带 class ① 成员 pin 的历史阶段文档（p1 · p9 · p15 · p22 · p24 · p26-design · p31 · p33 · p34 plan+design · p35-design · p36 plan+design · p38 plan · p40 plan），Objective 与迁移步写开 class ① 的两种载体拼法（路径载体改路径 · 裸类名载体改写成成员真正所在那份文件的成员坐标），登记成员面的判域外一形（载体解析到数据文件时判零条；p28 plan 的 `package.json#devDependencies` 是这一形，故十六份带成员 pin 的文档里它不进 Files 行），并写明「历史阶段文档同批迁移、不新设冻结面」的理由 · 声明识别器的输入改成抹掉字符串与模板字面量之后的 `PinSource.codeOf` 输出——字面量是值不是绑定，保留它会让 `HandoffSchema` · `ReviewRefs` 各在两份文件里「声明」、整片语料的裸类名载体成员 pin 都落成多份，Consumes · Produces · 字面量成对臂 · Acceptance 同批 | Oscaner M. · Claude（kairos:cdd-fix） |
| v0.27 | 2026-11-22 | 波 `{2,3,5}` 评审第 16 轮回填（一条 blocker · 三条 warn 全数采纳）：Task 11 的迁移面按 spec §9 收全——Files 行补进 p10 plan · p10 design · p35 plan · p40 design 四份文档，迁移步分成两类（成员住在别处的改路径 · 载体落不成恰一份的改指取代它的实现或删掉已无对应实现的 claim），并点名 `routeWords` · `pipelineFacts` · `planSource` · `inFlight` 与章程 D16 那一行的裸类名载体，Objective 与 Produces 同批 · Constraints 的预期红按交付态重述：只剩 `rules-severity` 那条 pin，`rules.test.ts` 在波 1 回填里已重基到三十 + 二、Task 5 只欠到三十五的重基，两处红改一处 · Task 5 的行数步按其上方注册表重基（三十 + 二 = 三十二 ⇒ 三十三 + 二 = 三十五），去掉归属 Task 4 的撤离句，形状面那两句改读交付态 · Task 9 的 `scan-coverage.test.ts` 有了承载它的步与 Produces 落点（小树覆盖证明：`census.files` 等于该树文件数、`scan` 恰一条，删一个语料根即红），pins.guard 的 Files 行同批改读 | Oscaner M. · Claude（kairos:cdd-fix） |
| v0.26 | 2026-11-22 | 波 `{1,4,10}` 评审第 1 轮回填（五条 blocker · 三条 warn 全数采纳）：`temporal-indicator` 整条退出落到树上——类 · 闭集 · 分句文法 · 模块头一条 · 注册行 · 四份夹具同批删，两章程序题目按 spec §6 改名，形状行与变量类的计数同批读五与三，`RULE_REGISTRY` 的注释按它上方那张表读三十 + 二 = 三十二 · `MEASURE_UNITS` 收英文五值、`第` 后顾与它的理由同批删 · 认领面收全四词表动词（`FileClaim` 不再折 `test` / `delete`），行内首词落集外也记 `other` 而不继承前段 · `DOCS_FIX_SHAPE_RULES` 三个名字 · 两个 skill 的 narrative 子弹与那份措辞常量同一次编辑落地 · 收口腿的注释改读 §7 · 组合根补生产形臂（`Cli` 建出的 docs-fix 轮，帧上基准等于派发门的读数） · **本任务的文件表同批订正**：Task 4 不再 `Test:` Task 10 新建的那份夹具（认领面收全之后，那条 `Test:` 让本任务先认领一条更晚的 `Create:`——语料臂当场报出，故 Files 行删一处、步里四份夹具读三份并点名第四处归 Task 10） | Oscaner M. · Claude（kairos:cdd-fix） |
| v0.25 | 2026-11-21 | 评审第 15 轮回填（两条 warn 全数采纳）：Task 9 收下 `charter-self-repair.test.ts` 的模块头族清单——`The delivery is three families at zero` 一句读两族、首条子弹只点名 `measure-literal`、`## Phase inventory` 那条改读作登记面而不数作一族，Files 行 · Produces 与头部步各补一处，并给 `three families at zero` 的零命中成对臂（数词无人判：`temporal-indicator` 那条只撤得掉第二个文法名）· Task 6 的孪生 pin pattern 加负向前瞻，读作 `/warn(?!\s*\/\s*nit)[\s\S]*REVIEW_FIX/i`：`carrying` 逐串测，松口径对退役拼写照命中，原「写回 ⇒ 新 pattern 零命中」的成对臂本不成立；改后两侧互为对方的零命中，Files 行与那一步的括号同批改到这一读法 | Oscaner M. · Claude（kairos:cdd-fix） |
| v0.24 | 2026-11-21 | 评审第 14 轮回填（两条 blocker · 一条 warn 全数采纳）：Task 4 的认领面按 spec §3.1 ① 收全——四词表动词各按自己的拼法认领，`Test:` 与 `Delete:` 也认领，故任务 3 写 `- Test:` / `- Delete:` 而任务 5 写 `- Create:` 同一缺陷同一判决 · `FileClaim` 不再把这两词折成 `none`，`claimOf` 与类注释两条互相矛盾的散文同批对齐，两张闭集只加宽 `other` 桶，Objective · Files · Produces · Steps · Acceptance 同批 · Task 6 的孪生 pin 只换 pattern、键名保留：`STATEMENTS.warnNitReviewFix` 是语料里的活坐标，换名会让本 plan 与 spec 里引它的几处一并落成死 pin，而那两份文档都不在该任务的 Files 行里 · Constraints 的预期红登记补一句：两个 skill 的 narrative 子弹与 `claim-shapes.test.ts` 的措辞常量同一次编辑落地，故 `packages/kairos` 腿在窗口里不多出一条红 | Oscaner M. · Claude（kairos:cdd-fix） |
| v0.23 | 2026-11-21 | 评审第 13 轮回填（两条 blocker · 六条 warn 全数采纳）：Task 7 的撒回决策行改读 D100（编号接 D99——`D99` 那行已是「判据上线前的语料实测」，四处同批：Objective · Produces · Steps 第 10 组 · Acceptance）· Task 3 的 family 注释臂改读行内片段 `silent on the warn`（原句在盘上折成两行，整句零命中是改写前后都绿的假臂，与 `AT MOST ONE WARN on the carrier's notes` 那一句非对称）· Task 9 的语料臂坐标改钉 `doc-corpus.guard.test.ts#PINNED_KINDS`（渲染标题不在文件字节里，钉它落一条死 pin，spec §6 同批禁它）· Task 1 的 `FindingSeverity` 臂按 shipped source 读（`-w` 挡 `RoundFindingSeverity` 的子串命中、`grep -v __tests__` 挡本任务自己的夹具两行），读数由「三行」改「三处」 · Task 10 补一步：引收口腿权威的注释从 `P42 §1.3` 改到 `P42 §7`（spec 没有 §1.3）· Task 5 的行数步同批改用例标题（`declares 35 rows: 33 doc-scope + 2 ledger-scope`，spec §3.2 引的正是这一形）· Constraints 与 Task 5 删掉章程与本 plan 的版本端点（端点随本表的下一次新行陈旧，条件是判据）· Task 4 的认领白名单补建集第二个词 `- 新建：` 的成对臂 | Oscaner M. · Claude（kairos:cdd-fix） |
| v0.22 | 2026-11-21 | 评审第 12 轮回填（五条 blocker · 七条 warn 全数采纳）：Task 10 的修轮写入约束改读三条形状规则（`measure-literal` · `line-coordinate` · `live-arithmetic`），落点钉在 `render/templates.ts#DOCS_FIX_SHAPE_RULES` 那一行、不进 `LICENSE_ITEMS`，同一步把那一行的文档注释改读三个名字，Task 4 的撒离步点名这一行是撤回的名字不许存活的那一处 · `temporal-indicator` 的撒离补全整面（类 · 闭集 · 分句文法 · 模块头清单 · 四份 src-next 夹具 · 两个 skill 的 narrative 子弹），`narrative` 的映射归 Task 9 改指 `line-coordinate`，Task 8 的 changeset 改成两包 minor（`cdd-engine` 与 `kairos`）并写明 `kairos` 那一处消费面字节落两个 skill 子弹 · 判据从「严格早于」改成「不晚于」并补同一任务的成对臂 · 行数面按这棵树重基（基线 `doc` 面三十一条 + `ledger` 面两条 = 三十三条，交付态三十三条 + 两条 = 三十五条），注释保留逐 scope 计数、`rules.test.ts` 读 35 / 33 / 2、`seat` 字面表三十五条，窗口两句改成「已经打开」而不是「在 Task 1 之前」 · 发布门改成三处豁免注释（`#tierRankOf` 排名注释 · `RoundFindingSeverity` 文档注释 · `RoundFinding.severity` 文档注释，单位是注释处），两处读侧注释写进 Task 1 的交付项 · `CRITERIA_ROWS` 的 doc comment 补「降级只剩 `blocker` → `warn` 这一档」一句 · `rules.ts` 的形状面计数句同批读五条形状行与三个变量类，`skipWhenClosed` 的列注释读五条 · Task 3 的 note 追加位改成 `#summaryToken` 那串的末尾（降级注记之后） · Task 11 补「声明只在绑定处算、导入子句不算」与它的成对臂 · Task 4 的撒离步点名两条改名后的标题与四处坐标 · Task 7 的组数改成十组（scope ⑩ · 验收 ⑰ · D99 · 验收 ⑪ 四条改三条） | Oscaner M. · Claude（kairos:cdd-fix） |
| v0.21 | 2026-11-20 | 编排者回填（用户裁定）：Task 4 加一步——`temporal-indicator` 整条退出与 `MEASURE_UNITS` 收窄，连带四处夹具与「三族齐零」断言 | Oscaner M. · Claude（kairos:cdd-plan） |
| v0.20 | 2026-11-21 | 评审第 11 轮回填（三条 warn · 一条 nit 全数采纳）：顺序行的语料对账扩到第三份在飞文档——`PinAudit.provenClosed` 在 specs · plans · overalls 三个根上读假的三份里，章程的表逐行升（v1.0 → v4.55）故同样单调，而该行声明 `docKeys: "all"`（与五条既有历史行同形），故 `overall` 键在判域内、`charter-self-repair.test.ts` 那条不交 `closed` 的全量契约用例是它的读数面（Constraints · Task 5 · Task 8 同读）· Task 5 的 `seat` 列把两处 typechecked 字面接进 Files 行并补一条补格步（`rules-severity.test.ts#probeDeclaration` 与 `packages/cdd-engine/src-next/session/__tests__/preflight-rows.test.ts#markerRow` 各写 `dispatch` · `close` · `corpus`，`tsc` 为本任务头上的读数）· Task 9 把 `describe` 标题 `… its registration face carries the narrowings` 接进 Files 行与零命中读法（标题不是正文断言，`\bnit\b` 扫面见不到它）· Task 7 组五的 Objective 与它自己的步对齐（`两种写法` 的措辞被两具载体替换，三段的 `path#Class.member` 拼写作废、不是零命中臂） | Oscaner M. · Claude（kairos:cdd-fix） |
| v0.19 | 2026-11-21 | 评审第 10 轮回填（一条 blocker · 六条 warn · 两条 nit 全数采纳）：顺序行按 spec v0.34 §6 改成**单调**判据（读 `Invariant.historyVersions` 的**行序相邻对**、逐对按 `versionRank` 比大小、`skipWhenClosed: true`、方向不进判据），并同批登记语料对账——81 份带表的文档里 71 份单调、10 份非单调而全部由章程的 `` ✔ Done（`file` · date） `` 单元格证明已闭合故豁免，在飞的本 plan 与本 spec 都逐行降，翻位后零拒绝（Constraints · Task 5 · Task 7 · Task 8 · Task 9 同读一份对账），语料守卫不钉这一条的理由写明 · Task 4 的比值探针改成 `4.5:1` · `2.25:1` · `1.5:1`（`3:1` 两态同绿，spec 已不取）· Task 6 的发布面补 README 家族的可核扫面（四处 `\bnit\b` 各给替换字节、按段定位）并把图表源的替换字节补到十二处（`next-loop.en.json:247,249` 与 zh-CN 同两行逐处点名，教学句改成 `notes` 行）· Task 6 的重生成步补 `pnpm run emit` · Task 9 的第二处头部注释改读行内可见片段 `the file list is a pinned` · Task 4 的 `other` 桶改成两张闭集 + 比较规则 + 默认（`按首词语义` 退出）· Task 7 的第 5 组去掉死半句 `path#Class.member`（章程 `Class\.` 零命中）· Task 4 的合成 token 理由改成已知扩展名无数分隔符 | Oscaner M. · Claude（kairos:cdd-fix） |
| v0.18 | 2026-11-20 | 编排者回填（实测撤回）：删掉读数门加宽那一步——中文量词与散文不可区分 | Oscaner M. · Claude（kairos:cdd-plan） |
| v0.17 | 2026-11-20 | 编排者回填（用户裁定）：Task 4 加一步——读数门的域改成数词配量词，语料同批跑到零 | Oscaner M. · Claude（kairos:cdd-plan） |
| v0.16 | 2026-11-21 | 评审第 9 轮回填（三条 blocker · 三条 warn 全数采纳）：§6 的顺序行与 §8 的 `seat` 列落进 Task 5（顺序行 `doc` 档 · `warn` 起步 · 自占一个策略类 · 读 `Invariant.historyVersions` 的最后一行、无 `## Change history` 表时零候选；`seat` 闭集 `dispatch` · `close` · `corpus` · `ledger` 的非空子集 + 三十六行逐 id 字面表 + 三条断言），行数面随之读 34 doc + 2 ledger = 36，Constraints 的 warn 清单与 Task 8 的翻位改成四条 · Task 9 的顺序面合成表按 spec §6 重写（最新行在旧行之上 ⇒ 版本腿零 finding、顺序腿恰一条；移回表尾 ⇒ 两条零 finding；表头版本低于表内最大版本 ⇒ 恰一条版本腿），删掉「行序本身仍无判据」 · Task 11 的成员臂按 spec §9 重写（三具写法 · 裸类名反查与歧义拒绝 · 吃 `PinSource.codeOf` 的声明识别器 · 字符串字面量判别臂 · 接口载体那一臂），三段的 `path#Class.member` 与 `isSymbol` 的放松都排除在臂外 · Task 7 按 spec §5 的九组重写（补 ⑧/⑮ 与 ⑨/⑯ 两组、第 4 组改成收窄 scope ⑤），去掉章程历史行的具体版本号、改读「最新一条版本行是表尾且与 front matter 同版」这一条件 · Constraints 的末层写定 Task 7 与 Task 11 的层内次序 | Oscaner M. · Claude（kairos:cdd-fix） |
| v0.15 | 2026-11-20 | 编排者回填（用户裁定 · 抽象整理）：Task 4 改为「既有读面停止丢弃动词标签」+ `RuleDeclaration.seat` 一列（该列的实际落点见 v0.16：Task 5） · Task 10 改称收口座位 · Task 11 改称改作用域而非解析，路径形状判者收成一处。零新增任务 | Oscaner M. · Claude（kairos:cdd-plan） |
| v0.14 | 2026-11-20 | 编排者回填（用户裁定）：新增 Task 11「符号 pin 的文件归位」——`PinIndex` 按文件分区 + 成员形态 + 语料同批迁移；等 Task 9（同一份守卫文件） | Oscaner M. · Claude（kairos:cdd-plan） |
| v0.13 | 2026-11-20 | 编排者回填（D98 实施细则）：Task 9 加一步——把「末行是最新版本」这条自验断言搬成引擎的顺序不变量，而非删除 | Oscaner M. · Claude（kairos:cdd-plan） |
| v0.12 | 2026-11-21 | 评审第 8 轮回填（两条 blocker · 两条 warn 全数采纳）：Task 10 把组合根接线接进 Files 行并补两步——`face/cli.ts` 的 `preflight.gate` 交出已批准的判决（`ok ? null : preflight` 让基准在生产里恒空），`CliLifecycle` 的构造接到根上那一个 `Contract`，同批补一条走生产构造的基准臂 · Constraints 的窗口次序写定层内顺序（`{6,8,9}` 里 Task 8 翻位先落、Task 9 删除后落），故 Task 9 与 Task 7 头上的绿有据 · Task 4 把比值臂与 pin 极性臂的读数落点接进 Files 行（`shape-rules.test.ts` 的 `P41 T2 — line-coordinate` 家族 · `pins.guard.test.ts`）· Task 6 的发布面步钉住孪生 pin 的两侧（新 pattern 单串点名 `warn` 与 `REVIEW_FIX`，六处 `warn/nit` 换成点名「只 warn」的整句，弱成 `/warn/i` 不算达成） · Task 7 的第 8 组改成末行核对（`v4.54` 的移动已由既有提交落地） | Oscaner M. · Claude（kairos:cdd-fix） |
| v0.11 | 2026-11-21 | 评审第 7 轮回填（一条 blocker · 四条 warn 全数采纳）：Task 10 按 spec §7 重写——座位改到 `face/lifecycle.ts#verdictOf` 的 graded entry 面（与 `#structureViolations` 同一趟），基准改成门测得的 findings（`PreFlightVerdict` 增一格加 `OpenFrame` 一格），`不提交` / `不出提交` / `照常提交` 三处换成「不到下一跳」的读法，多重集差按 `kind@field@message` 的整身份并补同标题替换臂与基准非空臂，`session/run.ts` 进 Files 行（帧格加 `PlanStructure` 注释读两个判定点） · Task 9 收下 `judge.test.ts` 的合成表顺序臂（两种排法同读零 finding，成对臂是表头版本低于表内最大版本） · Task 7 的组数由五组改成 spec §5 的八组并逐组点名 · Task 8 的 changeset 步补 §8 的 ⑨ 收回那一句，Task 4 的比值步补退出码改动的单独理由 · Constraints 的 Task 10 基准读法同批改 | Oscaner M. · Claude（kairos:cdd-fix） |
| v0.10 | 2026-11-21 | 评审第 6 轮回填（一条 blocker · 三条 warn 全数采纳）：Task 3 的 ⑧ 改回实测读数——该夹具两格坏值都落在声明槽上，`droppedKeys` 返回空数组，故恰一条 soft 项、标题逐字节保留（两条 soft 项要另加带非声明键的夹具，不在本任务改动面）· Task 3 的 ④ 补 `carrier.notes` 的 `toContain` 改读 soft 项（键缺席后 `join` 读空串），⑥ 补载体 `toEqual` 去掉 `notes` 键与 `contractViolationCount` 由 0 改 2 · Task 2 补两处 counterexample pin 改读替换句句尾（`is a warn:` · `` is a `notes` line, not a finding ``），`missingNit` 臂改成表外一档（两值 `TIER_ORDER` 下旧臂永不抛） · Task 3 的 Produces 把 `displayReason` 折叠收在板面，brief 印载体原文（spec §2.1 的 brief 半句） | Oscaner M. · Claude（kairos:cdd-fix） |
| v0.9 | 2026-11-20 | 编排者回填（用户裁定）：Task 4 加一步——坐标文法的比值误判修复与成对臂（`4.5:1` 不再被读成 `path:line`） | Oscaner M. · Claude（kairos:cdd-plan） |
| v0.8 | 2026-11-20 | 编排者回填（用户裁定 · github#506 新评论）：新增 Task 10「fix 轮的回合内判定」——无依赖，落第一层；判据是差分（基准为本轮的已审身份），绝对判定会把修复轮卡死。分层行同批更新 | Oscaner M. · Claude（kairos:cdd-plan） |
| v0.7 | 2026-11-21 | 评审第 5 轮回填（两条 blocker · 三条 warn · 一条 nit 全数采纳）：Task 1 把三份夹具接进 Files 行并补一步——读回报文改两值、五份假孩子草稿的 `nit` 改 `warn`（`severity` 在 `FINDING` 的 `required` 里，留 `nit` 是被拒不是无声丢格），Constraints 的红窗口补一句「它落在窗口之前」，Acceptance 同批 · Task 3 把两份夹具接进 Files 行并补一步，逐处点名八条旧落点 pin（artifact 偏移那一条的 `contractViolationCount` 由 0 改 2、§8.7 两条的空 stderr 改恰一行 `CDD_WARN:`、docs-fix 键集去掉 `notes`、两条 evidence 用例的 `violations` 长度与下标改成按 `grade` 取 hard 项、decorative 用例与 lifecycle 那条的标题与 soft 读数）· Task 1 的写侧词表给了消费者——`CarrierValue.findings[].severity` 挂 `FindingSeverity`，`findingsOf` 的 `as FindingSeverity` 删掉，`grep FindingSeverity` 的读数写进判据步 · Task 5 把环详情行收成一处（`session/graph.ts` 的一个 `TaskGraph` 静态方法），`session/preflight.ts` 进 Files 行，`@T${` 的扫面与 cross-face 臂进 Steps · Task 6 的发布门补一条计数臂——模块头的 `the three tier` 零命中（整句在盘上折行，按行内片段读） · Task 9 的 Consumes 改成三条惰性臂读的是树里已有的三个座位，「同层先落规则」是操作序 | Oscaner M. · Claude（kairos:cdd-fix） |
| v0.6 | 2026-11-21 | 评审第 4 轮回填（一条 blocker · 四条 warn · 一条 nit 全数采纳）：Task 5 的行数注释臂改读那份注释自己的字节（`doc scope` / `ledger scope` 两形零命中），不再拿 `rules.test.ts` 标题的 `30 doc-scope` 形去扫 `rules.ts`（那个字串在该文件里本就不存在，是改写前后都绿的假臂）· Task 3 的 `face/board-view.ts` Files 行点名读侧谓词的**三族**（两条装饰族字面加 artifact 族句形），并补一条装饰族的成对臂 · Task 2 的注释臂去掉「六名断言一起红」（六条边界名住的是静态表注释，`tier` 变动不移动它的字节），只留 `renderRubric` 的第二条守卫一红，守卫编号改与 §1.2 一致 · Task 9 的 Produces 登记 `PinAudit.census` 三项是 finding 计数这一事实取代 spec §6 与验收的两条同读（共三处），spec 本体不在本 plan 的改动面 · Task 7 把「不由用例断言」改成树里的事实（真实章程的零拒绝由 `charter-self-repair.test.ts` 钉住，Task 9 只删 `registration face` 那条），并在收口步补一次局部重跑 · Task 6 的 `render/templates.ts` Files 行补上 `SEVERITY_RUBRIC` 注释（§4 登记表第 ① 处） | Oscaner M. · Claude（kairos:cdd-fix） |
| v0.5 | 2026-11-21 | 评审第 3 轮回填（一条 blocker · 六条 warn · 一条 nit 全数采纳）：Task 9 的 pins 非空臂改成临时语料（一条死 symbol pin 加一条死 path pin），交付语料只留体量读数，空根半边补 `symbol` / `path` 两条断言 · Task 9 的头部注释臂取行内可见的 `file count is a constant`（原句在盘上折行、整句零命中），并补第二句与常量自己的文档注释 · Task 1 的 `#tierRankOf` 改成排名与函数体不动、入参类型挪到三值联合，并删掉指向语料的 `corpusOf` 行 · Task 5 的两条成环臂改成 `task` 与 `message` 两半复用、`cycle@T` 前缀归 graph 门 `details`，残值臂同批 · Task 7 的日期从「写别的就红」改成约定（读它的用例归 Task 9 删除） · Constraints 的预期红窗口改成 Task 4 落地到 Task 8 翻位，并点明 Task 9 与 Task 7 都在绿树上收口 | Oscaner M. · Claude（kairos:cdd-fix） |
| v0.4 | 2026-11-21 | 评审第 2 轮回填（一条 blocker · 十条 warn · 一条 nit 全数采纳）：Task 9 的三处惰性臂从「选择器永不匹配」改成按规则自己读面的候选读数（`change-history-row-shape` 的临时根 · `PinAudit.census` 的交付语料与空根 · `measure-literal` 的面缺口），同批补三份头部注释的改写 · `claim-shapes` 补存在 / 孪生 / 映射三臂与 shape→规则 id 的映射常量 · Task 6 的 prompt 面改指 `FIX_SHELL`、删掉 rubric 的 preamble/tail，零命中扫面改读渲染字节 · Task 3 补软通道的两笔后果（一行 `CDD_WARN:` · 派生计数抬一）、`#materialize` 的两句反话与 brief 的三处字节 pin，并去掉无改动的 `session/handoff-schema.ts` 行 · Task 1 的 `face/capsule.ts` 行与步归 Task 6 的注释面 · Task 4 去掉 `contract/declare.ts` 行与面图步 · Task 5 去掉 `session/preflight.ts` 行 · 波次按声明的边重述为 `{1,4} → {2,3,5} → {6,8,9} → {7}`，末层 Task 7 收口全量门 · Constraints 删掉「语料常量随本文件上调」 · Task 8 的 changeset 括号写准 Task 9 是测试面 | Oscaner M. · Claude（kairos:cdd-fix） |
| v0.3 | 2026-11-20 | 编排者回填（用户裁定 · 章程 D98）：新增 Task 9 验证面追溯并接第五波；删 Task 1 的语料规模常量步；Task 7 的章程判据改成夹具钉住引擎输出（不拿本仓章程当判据）；Task 8 按声明的边只等 Task 5 | Oscaner M. · Claude（kairos:cdd-plan） |
| v0.2 | 2026-11-21 | 评审第 1 轮回填（六条 blocker · 九条 warn 全数采纳）：Task 1 把 `rollup` 从「三臂改动」改回守恒条件（四臂验收、源码不动），读侧三值联合与 `#tierRankOf` 三级排名明确不收窄，只有写侧 enum 与 `schemaText` 围栏收两档，并补存量 `nit` 的 `Ledger#round` → `next:` 成对臂与降级标记成对臂 · Task 2 逐格钉死 §1.2 五格的英文替换字节（`regrade-mark` 三格不动），补整张 `SEVERITY_RUBRIC` 的零命中臂，并把 `CRITERIA_ROWS` 表注释与 `CriteriaRegistry` 两处档序注释同批改写（去逐档计数、六条边界名） · Task 3 补 `#readFresh` 早退放宽与 work 轮载体臂、读侧逐字节前缀谓词三臂，`displayReason` 的导出与 `contract/review-criteria.ts` 进 Files · Task 4 把词表与声明集拆成两个面（`Add:` · `新建：` · `修改：` · `Modified` 在词表里是 `other`、在声明集里是认领），补三条静默臂、`Add:` / `修改：` / `Modified` 三组成对臂，以及第四类方言 · 分隔符切分 · `pathOf` 过滤 · 行内去重四条规则 · Task 5 改为两个不变量类两个名字，环的读面改述为 Kahn 残值最小（残值臂 `cycle@T1`），两处 `graph.ts` 注释同批对齐，`RULE_REGISTRY` 行数注释与 `rules.test.ts` 的 35 同批 · Task 6 的文件集补上五处源码注释文件，源码扫面拆成登记完整性（十三行）与发布门（一行豁免）两条断言 · Task 7 的章程验收换成 `doc-contract` 腿 · Task 8 的 changeset 收成一包 minor · Constraints 的「预期红」改述为 `rules-severity` 的 warn pin 与 `rules.test` 行数两条过渡红 · 历史行的波次记为 `{1,4} → {2,3} → {5,6} → {7,8}`（八任务时代的读数；v0.3 引入 Task 9 后由 v0.4 按声明的边重述为 `{1,4} → {2,3,5} → {6,8,9} → {7}`） | Oscaner M. · Claude（kairos:cdd-fix） |
| v0.1 | 2026-11-20 | 首版：八任务四波 `{1,4} → {2,3} → {5,6} → {7,8}`。切分按 spec 的三笔交付走：档位词表与判决面 · 判据表改判 · `notes` 承载 · `Create:` 判据 · 任务图 · 消费面与发布孪生 · 章程回填 · 翻位。正文按本相位自己在建的规则书写：判据只引 spec 的节号，不复述内部方法名——本相位的 spec 线为此付了九轮 | Oscaner M. · Claude（kairos:cdd-plan） |
