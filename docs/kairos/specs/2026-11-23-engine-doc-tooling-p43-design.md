---
title: '引擎自证面退役 — Phase Spec'
doc-type: phase-spec
version: v0.9
date: 2026-11-23
slug: '2026-11-23-engine-doc-tooling-p43-design'
program: 2026-10-10-engine-doc-tooling
author: '[human] · Claude Opus 5（kairos:cdd-design · 用户裁定「tests 衡量引擎，不规训我们自己的文档」）'
---

## Design

本相位撤掉引擎仓库的**自证面**：pin 可解析性门整条退役，规训本仓文档的测试语料臂退役，生成物一致收归既有 CLI 门，并把判据写进 `AGENTS.md`；同批收掉它的输出面镜像——board 把每轮实现叙述原样内联进进度格（github#518）。判据只有一条——**tests 衡量引擎，不规训我们自己的文档**——而另一件事是同一族的另一面：**状态面只给状态，不替读者预付散文的成本**。

### 1. 判据：为什么「用测试规训自己的文档」是缺陷来源

#### 1.1 缺陷链路：引擎的误判被静默修复在文档里

- D98 已把「引擎判物料，物料不判自己」立住，但它只约束了引擎**生产物料**的那一面。仓库仍在用**测试**判我们的物料：`docs/kairos/**` 的每份 spec / plan / overall 都被拿全量 doc-contract 跑一遍并断言零，pin 门与 census 门同在这一面上。
- 后果不是文档变干净，而是**引擎的误判被静默修复在文档里**：门报「符号不存在」，人改文档，缺陷原封不动发到消费者。
- 这条链路在 github#517 上有账本：一个相位产出的 pin finding 里，真设计错误只占极少数，其余分别是「裸符号在只认 ts/js/json 的索引里找不到」、「本阶段正要退役的符号」、「内建名与配置键」；而消息把它们一律说成「树上的 sources 里没有这个名字」。
- 本相位交付后必须成立的条件：测试里不存在任何以本仓 `docs/kairos/**` 为语料并断言其状态的断言。它们可以断言引擎**对一个夹具**做了什么，夹具的答案由作者自己选定。
- 判内的是消费者最终拿到的字节：README family · `AGENTS.md` · `marketplace/source.json` · `packages/kairos/skills/` 与其探针 · 生成物。它们的探针照旧断言状态，本相位一格不动。
- 这条条件的执行面在本仓自己的测试树上：交付后引擎与 kairos 两套探针全部合规，而 `docs/kairos/**` 不再被任何一条断言读到（§7.2）。

#### 1.2 边界：按「谁消费这份物料」划，而不是按文件放在哪

- 退役面——本仓写作过程的产物：`docs/kairos/**`。它是引擎在一次真实 CDD 运行里消费的物料，它的误判必须在轮里作为 finding 浮出，而不是在文档里被改掉。
- 保留面——消费者最终拿到的字节：README family · `AGENTS.md` · `marketplace/source.json` · `packages/kairos/skills/` 与其守消费面契约的探针——`skill-anatomy` · `words` · `presentation-surface` · `grep-sweep-regression` · 生成物（`.claude-plugin/`、`marketplace/source.json`、`docs/diagrams/` 的渲染产物、ISSUE_TEMPLATE）。skills 是发布物，守的是消费者拿到的字节，不是我们的写作习惯。
- 分水岭是「谁消费这份物料」：断言的对象是本仓写作过程的产物 ⇒ 退役；断言的对象是消费者最终拿到的东西 ⇒ 保留，哪怕它读的是本仓的文件。
- 同一条线切在扫描面上：`grep-sweep-regression` 的扫描根去掉 `docs/`，发布面（`packages/` · README 家族 · `marketplace/source.json`）保留（§3.1）。

#### 1.3 语料臂与判据的分界

- 撤的是「拿本仓文档跑一遍」那一臂，**判据本体连同它的成对夹具留下**。
- 每条被撤语料臂按 D98 ① 的三条臂验收：违规必报 · 邻居沉默 · 零候选即红。
- 语料臂只提供「今天恰好干净」这一个读数，而它对正确实现与没跑的实现同时成立——这是它不足以替代夹具的原因，也是本相位存在的理由。

### 2. pin 门整条退役

#### 2.1 下线面：全批同一次提交，逐符号判

- 下线按**符号**判，不按文件判：`packages/cdd-engine/src-next/contract/pins.ts` 是混合模块——pin 门与两条生产读者同居一处，整文件删除会把形状规则依赖的读者一起拔掉，`pnpm exec tsc --noEmit -p packages/cdd-engine` 当场红在 `contract/invariants.ts` 的 import 上。
- 尚未落树的名字在本文里不加代码跨度（新模块路径与新类名都是）：它们还不在树上，写成代码跨度就是 pin 门读到的一条死引用——正是 §1.1 描述的那类误判，而这正是本相位要撤的门。
- 搬走一 —— 栅栏读者：`PinSpans` 整个搬走，不挑入口——`tokensOf` · `proseEntriesOf` · `proseOf` · `blankedOf` 四个公开成员一起落新模块 contract/markdown-spans.ts 的 ProseSpans 类，生产调用点改指新名，**不退役**。`proseOf` 不只是内部步：`contract/__tests__/shape-rules.test.ts` 导入并调用它（栅栏的唯一判读，`contract/invariants.ts` 的形状行、`ProseLines` 与句子索引都走在它上面），只搬 `proseEntriesOf` 与 `blankedOf` 就会让这份留下的夹具编不过；`tokensOf` 是其余成员脚下的跨度层，搬走后若类外无读者，实现侧把它收为私有——可见性由编译器裁定，行为不删。
- 搬走二 —— 路径文法：`PinVocabulary.pathOf` 连它读到的 `isPattern` 占位符判读（形状谓词，不是 pin 定义）与扩展名词表一起落 contract/shape-rules.ts，供 `contract/invariants.ts#SingleCreateInvariant` 的 `#claimSets` 筛 `declaration.path`；pin 侧的分类谓词 `testOf` · `memberOf` · `isSymbol` 没有第二个读者，随它们分类的 pin 定义一起退役（`memberOf` 对 `pathOf` 的那次读也随之消失）。落点因此写死：路径文法（`pathOf` 连 `isPattern` 与扩展名词表，加上搬走三要用的路径归一化）就是 contract/shape-rules.ts 的全部内容，而 `packages/cdd-engine/src-next/contract/pins.ts` 在栅栏读者 · 路径文法 · 闭合读数三处搬走落地后不再有读者，随 pin 定义整文件删除。
- 搬走三 —— 闭合读数：落 contract/closed-document.ts 的 ClosedDocument 类，读宪章 Phase inventory 的 `Design spec` / `Implementation plan` 两格，极性逐字保留——零命中与多命中都不证明闭合，只有唯一命中且那份文档就是被审文档才闭合。它是 `Contract.validate` 第二实参在生产里唯一的产出者（`face/lifecycle.ts` 的判据注入 · `face/cli.ts` 的 `#auditOf` · `session/preflight.ts` 的 `provenClosed` 选项），退役就等于让形状行在已闭合文档上照跑。
- 搬走三的深一层 —— 搬的不是两格读取，是整条读链：`ForwardPaths#provenClosed` 连 `#namedCellsOf` · `#resolveCell` · `#namesDoc` · `DONE_CELL` 一起搬，因为成对夹具守的正是「格里的文件名解析到几份在册文档」这条唯一性证明。它脚下的文档枚举今天由 `PinIndex.entries()` 供给，而 `PinIndex` 在本批退役，所以搬迁必须点明替代：枚举改走 `infra/slug-index.ts#SlugIndex`（`entries` 答「枚举哪些文档」· `entryAt` 答「这一份在不在册」），宪章正文从在册路径读，**不新起一次目录走读**；`#inDocRoots` 也不抄第二份路径谓词，改指 `SlugIndex.insideDocRoots`。这条链自己的两处读也要点名落地：开头的路径归一化是 `PinIndex.normalize(rel)`，`PinIndex` 退役后它随路径文法搬进 contract/shape-rules.ts（与 `pathOf` 同处），搬过去的读链从那一处调它，不就地手写第二份归一；枚举的来源只能由调用点注入——`face/cli.ts` 的备忘索引或判据上下文的索引槽——自己新起一次构造不是选项，`face/__tests__/cli.test.ts` 的 P36 T3 把 `SlugIndex.build` 的生产构造点锁成一份固定清单，多一处即红。最短的错误发明——拿格里的文件名直接比被审文档的 basename、跳过唯一性证明——正好让零命中与多命中的登记闭合一份文档，那是一种本相位不接受的静默豁免，所以搬过去的夹具必须带这两臂。
- 搬走三的接线：`face/lifecycle.ts` 的 pin 面在该站点退役——`#pinIndex` 的 `PinAudit | null` · `#pinAuditFactory` · 构造选项 `pinAudit?: () => PinAudit` · `#pinAudit()` 成为闭合读数的同名面（#closedDocument · #closedDocumentFactory · 构造选项 closedDocument · #closedDocument()）；`face/cli.ts` 的 `#audit` 由 `RootMemo<PinAudit>` 改承 ClosedDocument，`#auditOf` 改名为 #closedOf，注入行由 `pinAudit: () => this.#auditOf(…)` 改为 closedDocument: () => this.#closedOf(…)。树上不留任何一处 `() => PinAudit` 类型的悬空注入；`session/preflight.ts` 的 `provenClosed` 选项形态不变，只换产出者。
- 随门退役：`PinAudit` 的扫描与登记两半 · `PinIndex` · `PinSource` · `PinDeclarations` · `ForwardPaths` · `corpusOf`，以及 `PinVocabulary` 的 pin 定义（`isPin` · `#isProduct` · 模板词表）。
- `contract/review-criteria.ts#CRITERIA_ROWS` 的 `pin-parseability` 判据行整行删除（含 `body` / `duty` / `counterExample`）；`CriteriaFace` 的 `test` 取值只剩这一行接线，随之退出。
- `render/templates.ts#pinLensOf` 及其注入行：被审文档的 pin 回读不再注入 review prompt；`ReviewGuides.pinLens` 字段与 `REVIEWS` 每一行的取值一并删除——注入是它们唯一的读者，留着就是死数据。
- `contract/census.ts` 的 `pin.*` 四行登记（`pin.symbol` · `pin.path` · `pin.total` · `pin.files`）与其 `PinAudit` 依赖。
- 同一批：`contract/census.ts#censusTableOf` · `CensusTable` · `CensusDeps` · `CensusGate#report` 随比较机器一同消失；`CensusGate.referencesOf` 留作文法，供 `contract/invariants.ts#MeasureLiteralInvariant` 的跨度读（§4.1）。幸存者的形态因此要写明：`CensusGate` 只剩这一个静态方法，落地时按树上既有做法带一行 biome-ignore 注释（规则 noStaticOnlyClass）加一句理由（理由就是 §4.1 的调用点不动），不导出模块级箭头；落地形态上 `pnpm run biome` 必须 exit 0——这是本相位的门，不是 hook 的偶然。
- `face/lifecycle.ts` 的三处调用面退役：被审文档正文的 pin 回读 · 交接单 `contract.path` 的解析腿 · 判据注入；判据注入的那一处改为把 contract/closed-document.ts 的闭合读数交给 `Contract.validate`。
- `face/cli.ts`：census 面随 `#auditOf` 一起走；`#auditOf` 由审计构造点改为闭合读数的构造点。
- 测试文件整文件退役：`contract/__tests__/pins.guard.test.ts` · `contract/__tests__/scan-coverage.test.ts`（后者的证明对象就是 pin 扫描的覆盖）。
- 测试文件按面拆：`contract/__tests__/pins-guard-closure.test.ts` 的闭合成对夹具改名落 contract/__tests__/closed-document.test.ts——极性必须留证据；构造点那一段改写为「每 dispatch 一个闭合读数」，`contract.path` 回读的提问点随该腿退役。
- 测试文件只退 pin 面，其余留且必绿：`contract/__tests__/review-criteria.test.ts`（行名册收为删除后的 id 集 · 弃掉 `test` 面的断言 · 去掉 `pin-parseability` 的层级与 `P28` / `PinAudit` 反例句格子）与 `render/__tests__/templates.test.ts`（`pinLensOf` 的类型派生 · 漂移抛错 · `REVIEWS[key].pinLens` 三格删）。
- 测试文件只退 pin 面（续）：`face/__tests__/lifecycle.test.ts` 里有两段 describe 只为断言本批删掉的面而存在——pin 回读语料注入真实 warn finding 的那段（P37 T6）与 pin 时间面在调用点读被审身份的那段（P37 T7）——两段整段退役；文件里其余的臂（评分门 · 载体完整性 · 胶囊标记 · dispatch 面）一字不动且必绿。
- 测试文件改指不退役：`session/__tests__/preflight-rows.test.ts` 与 `session/__tests__/fix-round-gate.test.ts` 只借 `PinAudit` 拿闭合事实，改指 contract/closed-document.ts——它们判的是这条缝，不是门；`contract/__tests__/shape-rules.test.ts` 的 `PinSpans` import 由 `../pins.ts` 改指 contract/markdown-spans.ts；`contract/__tests__/single-create.test.ts` 的 `PinVocabulary` import 随 `pathOf` 改指 contract/shape-rules.ts——它的 P42 T4 路径形态臂调的正是 `pathOf`。改指后这几份留下的夹具仍编得过、绿得了。

#### 2.2 活着的引用：随门退役的删，量树上的改

- 留下的是写作形态而不是门（§4.1 只退比较机器），所以引用分两类处置：量 pin 门的删，量树上行数的留。
- 门的文法（`census:<id> = <n>`，点分小写 id · 十进制整数）只认真正的引用：P37 的 spec 与 plan 各带 `census:pin.* = <n>` 引用；P41 的 spec 与 plan 只有散文提及，文法从不解析它们。
- `census:pin.*` 引用同批删除，理由与「否则会抛错」无关——登记面从未接进 doc-contract 腿（§4.1）。留一句 `= 0` 就是断言一个不再存在的门，`pin.total` 的数字更是墓碑读数。
- P41 的散文提及也删：那句话描述的读数，其登记行正在退役，留下它就是一句指向空处的句子——记录卫生，不是消费者安全。
- 三条非 pin 行（`criteria.rows` · `questions.rows` · `questions.cells`）随比较机器一起退役，但它们的引用不删：它们量的是树上的行数与格子数，不是被撤的门。
- 删掉 `pin-parseability` 行让 `CRITERIA_ROWS` 少一行，于是每一处 `census:criteria.rows` 声明在同一个提交里变假：P37 的 spec 与 plan、P42 的 spec 与 plan 带它，同批改成删除后的 `CRITERIA_ROWS` 行数。改的是数字，不是结论。
- `census:questions.rows` 与 `census:questions.cells` 的登记行没有变更，它们的引用原样不动。
- 删引用与改数字改的都是**记录面**，不是结论面——这是 D22 的窄反转，形态同 D100 的 `temporal-indicator` 整条退出。

#### 2.3 非目标

- 不发明替代解析器：路径 / 符号 / 测试题三形都不再有机械面。
- 不保留 `pin.total` 的墓碑行——回报一个恒零的数是说谎。
- 不追改 D93 ⑥ 的历史记录：那条裁定留在本程序宪章的决策表里，是历史，不是树上状态。
- 不并入 issue 提议的「plan 的 `Create/Modify/Delete` 三行对账」——用户 2026-11-23 选择整条撤；将来要做，是新相位与新判据。

### 3. 语料臂退役

#### 3.1 逐文件的撤与留

- `contract/__tests__/doc-corpus.guard.test.ts`：撤全语料 doc-contract 扫描与四腿血缘回读；无留（判据本体在引擎，语料臂是它唯一的断言对象）。
- `contract/__tests__/phase-inventory.guard.test.ts`：撤对宪章 Phase inventory 的逐行七格判；无留。
- `contract/__tests__/census.guard.test.ts`：按面拆，不整文件退役。语料臂（拿本仓文档跟登记表比对）与登记机器臂（七行登记表 · 未登记 id 抛错 · 一位数字改动即红）随比较机器退役；引用文法臂留下，搬进新夹具文件 contract/__tests__/census-grammar.test.ts——占位符读作散文 · 小数与带后缀的值读作散文（终止符规则）· 只读右值这三臂。它们是 `CensusGate.referencesOf` 在树上唯一的断言：`measure-literal` 自己的夹具（`contract/__tests__/shape-rules.test.ts`）只守合法引用形态与那条规则自己的数字守卫，并不带非法形态臂（§4.2）。留下后的读法只调 `CensusGate.referencesOf`，不调已退役的 `report()`。
- `contract/__tests__/charter-self-repair.test.ts`：撤宪章五节零 finding 那一臂；无留。
- `contract/__tests__/single-create.test.ts`：撤读 `docs/kairos/plans` 目录的那一段；留 VERB / CLAIM 两面的成对夹具。
- `__tests__/floor.guard.test.ts`：不动——README 安装行与 `engines` 的一致性臂、类型剥离臂都留在树上。它读的是消费者拿到的 README 字节（§1.2），不是本仓 `docs/kairos/**`。
- `packages/kairos/tests/grep-sweep-regression.test.ts`：只收窄语料面——扫描根去掉 `docs/`，发布面（`packages/` · README 家族 · `marketplace/source.json`）的扫描原样保留。
- `packages/kairos/tests/presentation-surface.test.ts`：不动——它断言的 README 家族与 zh 镜像集合是发布面。
- `face/__tests__/plugins.guard.test.ts`：不动——它的六个臂都读 README 字节（安装表的核心段与推荐段 · 每行宿主列对 `HOST_IDS` · 表头标签 · 表体守恒 · 四份 README 上的 `cdd init` 声明面），是发布面探针而不是生成物比较。
- `seat` 面随语料臂一起收：`contract/rules.ts#RuleSeat` 的闭集里 `corpus` 就是「拿本仓文档跑一遍」这一面，本相位交付后树上没有这个执行面，所以 `corpus` 从词表与每一条 doc 行的席位列里一并删除（doc 行只剩 `dispatch` · `close` 两面，`ledger` 行不动），`contract/__tests__/rules.test.ts` 的字面席位表在同一次提交里对齐。留下一个指向已删守卫的席位，正是本相位要消灭的墓碑声明。

#### 3.2 判据不随之消失

- `doc-corpus.guard` 与 `charter-self-repair` 撤掉的是**语料**臂，它们跑的规则（doc-contract 各腿 · P41 的五条形状规则 · `single-create`）必须有夹具对覆盖。
- 逐条核对的判据：每条规则的违规夹具必报、邻居夹具必沉默、零候选即红。
- `single-create` 与 `shape-rules` 已有这类夹具，本相位不重写它们，只删语料臂并核对缺口；发现缺口就在本相位补，不留后续相位的债务。

### 4. 语法留下，登记机器随行退役

#### 4.1 登记面从未接进 doc-contract 腿：退比较机器，留写作形态

- 留下的是文法：消费者文档里的测量数字以 `census:<id> = <n>` 引用，形态由 `contract/census.ts#CensusGate.referencesOf` 解析，`contract/invariants.ts#MeasureLiteralInvariant` 用它做跨度读。
- 事实是：没有生产代码构造登记表。`censusTableOf` · `CensusTable` · `CensusDeps` · `CensusGate#report` 只在 `contract/__tests__/census.guard.test.ts` 里被构造，`contract/invariants.ts` 只用 `referencesOf` 这一个静态读。
- 登记表不是只服务 pin：`contract/census.ts#censusTableOf` 登记 `pin.*` 四行，旁边还有 `criteria.rows`（读 `CRITERIA_ROWS`）· `questions.rows` · `questions.cells`，后三条的 id 在本仓记录里有活的 `census:<id>` 引用。所以「四行 `pin.*` 是它唯一的读者」不成立，退役理由得换一个。
- 真理由是执行面而不是读者数：`contract/__tests__/census.guard.test.ts` 拿本仓文档跟登记表比对，而这一臂正是本相位撤的语料臂。比较机器与这个文件一起退役，写作形态与引用留下。
- 留下的三条登记行也不是「照旧在比」：没有比较就没有对照，它们的声明只靠自己与树上的定义对齐——`criteria.rows` 的度量是 `CRITERIA_ROWS.length`，删了一行这个数就小一，所以带它的四份文档按删除后的行数自洽（§2.2）。
- `contract/invariants.ts` 的 `MeasureLiteralInvariant` 调用点不动。

#### 4.2 收敛后的夹具面

- 文法面（contract/__tests__/census-grammar.test.ts，从 `census.guard` 的引用文法臂搬来）：点分小写 id · 十进制整数 · 终止符不是数字 / 字母 / 点；合法引用被解析；占位符 `census:<id> = <n>` 与它自己的 grep 形态读作散文；小数与带后缀的值（`3.5` · `3abc` · `0x10`）读作散文——截成前导整数就会判一句文法之外的句子；只读右值，引用旁的邻居数字不产生第二次读。
- 判据面（`measure-literal`）：裸测量的违规夹具必报 · 带合规引用的邻居夹具必沉默 · 零候选即红。
- 登记面的三条（未登记 id 抛 · 数字与登记值不符即红 · 登记表零候选即红）随登记机器一起退役：没有登记表就没有这三条，本相位不新造一个。

### 5. `selector-coverage` 的物料替换

#### 5.1 唯一要新写物料处

- `contract/__tests__/selector-coverage.test.ts` 今天是「四条登记表全部 selector 的解析证明，夹具就是我们自己的文档」——这是本相位唯一**要新写物料**而不是纯删的地方。
- 判定与格题一字不改，物料换成按四种 doc-type 各一份的合成合规文档，住 `contract/__tests__/fixtures/`。
- 物料的字段名与结构由四种类型的骨架派生，不手写重复结构；合成的合规文档必须能过 doc-contract——它们与消费者文档同判，不享受豁免。

#### 5.2 成对臂

- 删掉任一 selector 的表达面即红（原红腿保留）。
- 新增一条 selector 而不给表达面即红。
- 把任一份合成文档的字段名改错即红（证明物料本身在判据之下，而不是被豁免的旁路）。

### 6. 生成物一致收归 `emit:check`

#### 6.1 搬过去的

- `face/__tests__/diagrams.guard.test.ts` 里唯一读渲染产物的那一格——HTML 带本相位的 tag 且不带退役的旧 tag（`regenerates the artifact …`）——搬到 `emit:check`。该文件**没有**「`docs/diagrams/src/*.json` 与 HTML 对应」这一臂：源↔产物的逐字节对应只在 `emit:check`（经 `scripts/lib/diagrams.ts#DiagramProducts.emit` 重新渲染后比对），所以搬的是一格 tag 读取，不是一条不存在的对应腿。
- `face/__tests__/diagram-twin.guard.test.ts` 里读真实产物的格子：源与它自己的 HTML 成对比较——覆盖与图型根 · 产物命名 · 两侧修订一致 · 引用多重集 · 文案逐格——搬到 `emit:check`。
- 落点是 `scripts/` 的 `emit:check` 路径——消费者也会跑的同一条 CLI 门，也是 D98 ② 指定的唯一路径。
- 这是一轮删除：`emit:check` 已经逐字节比对每一份生成物，本相位不新建第二份比较。

#### 6.2 留下的

- `face/__tests__/plugins.guard.test.ts` 的 README 臂留在树上（§3.1）：它们守的是发布面字节，不是生成物比较。
- `face/__tests__/diagrams.guard.test.ts` 的五条语义臂全部留下，因为它们读的是 `docs/diagrams/src/*.json` 这一**作者写作的源**，与 README 内容探针同类：引擎节点 tag · 执行卡首行的八命令面 · 退役拼写的零残留 · 引用跨度落在它命名的声明内 · 修订自洽（经 `git show` 回读）。P28 T2 那一格（语义门不带重生成提示）同理留下——它断言的是门自己的消息，不读任何产物。
- 该文件**没有**清单一致臂：`.claude-plugin/` · `marketplace/source.json` · 各 package 的 `#oscaner` 行三方对齐是一条派生——`scripts/emit.ts#EmitService.deriveSourceDoc`——由 `emit:check` 逐字节比对，今天已经跑在树上（`OK — emit fresh`）。所以本相位不搬一条不存在的臂，只认证 `emit:check` 覆盖了三个生成物面。
- 孪生判据的夹具臂留在测试里，按它真正的机制命名：在内存里篡改源与篡改证据块的反向注入。那是判据，不是生成物比较。
- 「真实产物」在本相位指**渲染出的 HTML**，不指作者写的源：搬完之后，测试文件不得再读 `docs/diagrams` 的 HTML 做断言——真实产物比较只有 `emit:check` 一处；源内容臂照旧在判。

### 7. `AGENTS.md` 规范

#### 7.1 落点与三条要点

- 落点：「Conventions not enforced by the formatter」节，英文，与宪章 D101 互为指针（一处规范、一处裁定与实测账）。
- 要点一：测试只断言引擎对**夹具**做了什么。
- 要点二：以本仓 `docs/kairos/**` 为语料并断言其状态是禁止的，并写出为什么——误判会被静默修复在文档里，缺陷照发消费者；README family · `AGENTS.md` · `marketplace/source.json` · `packages/kairos/skills/` · 生成物是消费者拿到的字节，仍由探针守。
- 要点三：每条规则保留三条臂（违规必报 · 邻居沉默 · 零候选即红），生成物一致只归 `emit:check`。

#### 7.2 执行面

- 新规范第一次出场由本仓自己的判例承担：本相位交付后，发布面探针（README family · skills · 生成物）全部合规，而 `docs/kairos/**` 在引擎与 kairos 两套测试面不再被任何一条断言读到。
- 这是规范唯一的机械读法，不另立门。

### 8. 失败面与接受的代价

#### 8.1 我们自己的文档不再被机械判

- doc-contract 的规则在我们全部已存文档上不再有零断言。这是判据的本意，不是疏漏——真实 CDD 运行本身是执行面，误判会在轮里被看见，而不是被改文档消掉。

#### 8.2 活着的引用迁移

- `census:pin.*` 的引用删除后不可回滚成数字——它们描述的门已经不在树上。
- 逐文件读数：P37 的 spec 与 plan 的 `census:pin.*` 引用各归零；P41 的两份文档本来就没有引用，只有被同批删掉的散文提及。
- 另一面是改数字：`pin-parseability` 行一删，带 `census:criteria.rows` 声明的四份文档（P37 与 P42 各一份 spec 与 plan）就在同一个提交里变得不自洽，同批改成删除后的 `CRITERIA_ROWS` 行数。
- 这不是一条消费者安全腿：登记面从未接进 doc-contract 腿（§4.1），所以没有「跑一次 `cdd review`」这回事，本相位也不拿它当验收。

#### 8.3 P39 的审计理由作废

- pin 门不再能审计搬家。P39 改为冻结 `src-next/` + 新开 `src/` 重建（用户 2026-11-23 裁定），宪章的对应行已在本相位注册时补句作废，P39 自己的会话重写它。

#### 8.4 实现窗口的预期红：本相位的文档自己会读成「符号不存在」

- 本相位的 spec 与 plan 声明了一批**尚未落树**的新符号：栅栏读者 · 路径文法 · 闭合读数 · lifecycle 面上改名的闭合读数访问器。这几处名字的落点是 §2.1 的三处搬走，本文只按描述指认、不写成代码跨度。窗口不专属于本相位：任何一份声明了未落树符号的文档都一样，因为 pin 的时间面只跳过 `Create:` 行声明的**路径**，不跳过符号名，所以从本相位的文档落树到 §2.1 删掉那一臂之间，`pins.guard` 的语料例题恒红。
- 这就是 github#517 那句假话的形态复现：不是「符号不存在」，是「还不存在，而文档声明了要建」。它不构成回归，也不属于任何任务的改动面。
- 窗口的撤销方式是交付 §2.1，不是改文档：任何一轮若出现「把新符号从文档里拿掉以消红」，按缺陷处理（同 Constraints 的「禁止为了消红改文档」）。

#### 8.5 读实现理由的人要多打一个旗标

- 这是 §9 的附带代价，不是疏漏——正文的权威载体在轮次 handoff 与 `logs/`，board 不再做第三份副本。

### 9. board 的 notes 默认折叠（github#518）

#### 9.1 现象与条件

- board 的消费者是要看进度的人或 agent，不是要读实现理由的人。今天 `BoardView` 的 token 把该轮 `notes` 的全部正文用分号连进进度格，于是一个「不需要读」的面板成了一份散文集。
- 同一份散文的权威载体已经存在（轮次 handoff 与 `.kairos/cdd/<slug>/logs/`），board 成了第三份副本，且只有这一份会被反复整篇打印。
- 条件：默认输出里不出现 note 正文；`notes +M` 的计数留痕（P42 §2.1 已把它挂在 token 尾部）；正文只在显式旗标之后展开，且展开不改变 token 的段序。

#### 9.2 旗标形态：单键 `--notes`

- 形态：`--notes` 写在 board 的通道行上（bool，展全部），不设带量变体——`--artifacts` 占的是同一格。
- 理由一：没有任何通道行能表达「值可选」——`packages/cdd-engine/src-next/face/projection.ts#Projection.#valueToken` 只按 `row.type` 渲染 `<…>` 或枚举域，没有可选值形态，issue 提的 `--notes [n]` 今天表达不出来。
- 理由二：带量变体本身多余——折叠是默认，展开就是「我要全部」，一个 bool 与 `--artifacts` 同形。
- 没有第二个键，就没有优先级表，也没有「两者同给」的拒绝面。

#### 9.3 不变量

- P42 §2.1 的 token 形态不变：段序仍是 `verb · body · mark · +N · 降档注 · notes +M`。折叠意味着最后一段不起正文，而不是搬走这一段。
- 胶囊面不涉及：notes 正文今天只由 `packages/cdd-engine/src-next/face/board-view.ts#BoardView` 投影，胶囊不印它，本相位不改胶囊。
- 折叠只改打印，不改口径：`notes +M` 的 M 与今天同源（同一个 run 的 note 行数）。

#### 9.4 反向臂：展开仍走同一个折叠函数

- 展开面仍走同一个折叠函数（一行、无换行、无 ` · `），否则一个大回合的 note 就能把一行进度拆成多行——展开是「多给正文」，不是「允许拆行」。
- board 不新增第三态（如「展开但截断」）：两种形态就两种。

### Acceptance criteria

- `pin` 门零残座（按符号判，不按文件判）：`PinAudit` 的扫描与登记两半 · `PinIndex` · `PinSource` · `PinDeclarations` · `ForwardPaths` · `corpusOf` · `PinVocabulary` 的 pin 定义（含 `isPin` · `#isProduct` · 模板词表 · `testOf` · `memberOf` · `isSymbol`）与判据行 · `pinLensOf` 注入面 · `ReviewGuides.pinLens` 与其取值 · `pin.*` 四行登记与比较机器 · 整文件退役的测试，全树没有留存；同时 contract/markdown-spans.ts 的 ProseSpans 在籍且被生产读，`tokensOf` · `proseEntriesOf` · `proseOf` · `blankedOf` 都在它上面（`contract/__tests__/shape-rules.test.ts` 的 import 已改指新模块，夹具绿），contract/shape-rules.ts 的路径文法与 contract/closed-document.ts 的 ClosedDocument 同样在籍；`contract/census.ts` 不再 import `PinAudit`，`CensusGate.referencesOf` 留在文法面上，其类的幸存形态带一行 noStaticOnlyClass 的 biome-ignore 注释，且 `pnpm run biome` 在该形态上 exit 0。
- 形状行仍拿得到生产的闭合实参：`pnpm exec tsc --noEmit -p packages/cdd-engine` exit 0，且 contract/__tests__/closed-document.test.ts 的成对夹具证明两格各自闭合、零命中与多命中都不闭合；闭合读数的文档枚举走 `infra/slug-index.ts#SlugIndex`，路径归一化只在 contract/shape-rules.ts 一处实现（闭合读链与 `pathOf` 同源），索引由调用点注入而不新起构造（`face/__tests__/cli.test.ts` 的 P36 T3 保持绿），树上不存在第二处目录走读。
- pin 面的改指不留悬空 import：`session/__tests__/preflight-rows.test.ts` · `session/__tests__/fix-round-gate.test.ts` · `contract/__tests__/shape-rules.test.ts` · `contract/__tests__/single-create.test.ts` 都编得过、绿得了，`packages/cdd-engine/src-next/contract/pins.ts` 不再在树上。
- 被撤语料臂的判据仍可红：`single-create` 与 P41 的五条形状规则各有违规 / 邻合格夹具；`measure-literal` 的裸测量必报、带合规引用的邻居沉默、零候选即红；`CensusGate.referencesOf` 的文法臂（占位符 · 小数与带后缀的值 · 只读右值）在 contract/__tests__/census-grammar.test.ts 上各自可红；`selector-coverage` 删一条 selector 即红。
- `selector-coverage` 在合成物料上全绿，且把任一份合成文档的字段名改错即红。
- `emit:check` 接管原生成物断言：篡改 `.claude-plugin/` 一处、`docs/diagrams/src/*.json` 一处、ISSUE_TEMPLATE 一处，各使 `emit:check` 非零退出；`diagrams.guard` 那一格产物的 tag 读取与 EN↔zh-CN 孪生对的真实产物比较也在这一门上，两条各拿一份篡改去红。
- 测试面零语料臂：引擎与 kairos 两套测试里不存在以本仓 `docs/kairos/**` 为语料并断言其状态的断言；发布面探针（README family · `AGENTS.md` · `marketplace/source.json` · skills · 生成物）照旧断言其状态且全绿；孪生判据只对夹具；`diagrams.guard` 的源内容臂与 `diagram-twin` 的内存注入臂均保留并绿。
- `AGENTS.md` 规范行在册，与宪章 D101 互为指针，且本仓测试面无一违反（上一格即其证据）。
- `seat` 面零死声明：`contract/rules.ts#RuleSeat` 的闭集里不再有 `corpus`，每一条 doc 行的席位列也不再声明它，`contract/__tests__/rules.test.ts` 的字面席位表与登记表逐 id 对齐且绿。
- 引用迁移到位：`census:pin.*` 引用为零（P37 的 spec 与 plan 各归零，P41 的两份文档只带散文提及且同批消失）；存活的 `census:criteria.rows` 声明一律等于删除后的 `CRITERIA_ROWS` 行数（P37 与 P42 各自的 spec 与 plan）；`census:questions.rows` 与 `census:questions.cells` 的引用原样未动。
- board 默认输出零 note 正文：wave 行以 `notes +M` 收尾，M 与该 run 的 note 行数同源；`--notes` 展开后的字节与改动前逐字相同；token 段序与折叠时逐字同序。
- `pnpm run validate` exit 0；changeset 记 `cdd-engine` **minor**（D74：方法论契约不变，消费面字节破坏仍 minor）。

## Constraints

- **判据只撤语料臂，不改语义**：doc-contract / `single-create` / P41 形状规则 / `CensusGate.referencesOf` 的判定语义一字不动；本相位动的是「拿什么物料去跑」，不是「跑什么」。
- **边界按消费者划，不按路径划**：`docs/kairos/**` 是引擎在真实运行里消费的物料，不在测试面被判；README family · `AGENTS.md` · `marketplace/source.json` · skills · 生成物是消费者拿到的字节，照旧在判。
- **不写测试来证明自己的文档干净**：本相位的验收里没有任何一条要求本仓文档处于某状态。违反这一条就是相位失败，而不是验收漏项。
- **对已闭合文档只动随门退役的读数**：删 `census:pin.*` 引用、把 `census:criteria.rows` 改成删除后的行数，不动任何结论、裁定或交付记录；这是 D22 的窄反转，边界与 P37 的存量化迁移同款。
- **一对夹具优先于一次全语料扫描**：任一规则若要保住执行面，代价是夹具而不是语料。语料只提供「今天恰好干净」这个读数，而它对正确实现与没跑的实现同时成立（D98 的三条臂即为此立）。
- **禁止为了消红改文档**：本相位任何一轮若出现「门报错 → 改文档」的处置，按缺陷处理——那正是本相位要消灭的链路。
- **pin 判据的下线不用新解析器替代**：路径 / 符号 / 测试题三形不再有人判；issue 提议的 plan 三行对账不在本相位。
- **下线按符号判，不按文件判**：形状规则依赖的栅栏读者与路径文法搬去规则面而不退役，`Contract.validate` 的闭合实参必须仍由生产供给——“模块整文件消失”不是本相位能采纳的执行形态。
- **折叠只改打印，不改口径**：`notes +M` 的 M 与今天同源；board 不新增第三态。
- **被删模块在本 spec 里的引用是历史引用**：按构造不再有人判——判它们的门正是本相位撤掉的那一道。

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-11-23 | 初稿（cdd-design 会话落定）：判据「tests 衡量引擎，不规训我们自己的文档」· pin 门整条退役与已闭合文档引用同批删 · 语料臂退役而判据留 · `CensusGate` 本体保留 · `selector-coverage` 换合成物料 · 生成物一致收归 `emit:check` · `AGENTS.md` 立规范 · 失败面与接受的代价 | Oscaner M. · Claude（kairos:cdd-spec-writer） |
| v0.2 | 2026-11-23 | **github#518 并入（用户裁定）**：新增 §9——board 的 notes 默认折叠（`notes +M` 计数留痕 · `--notes` 展全部 · 不改 P42 的 token 形态）；验收补一腿、失败面补一条代价 | Oscaner M. · Claude（kairos:cdd-spec-writer） |
| v0.3 | 2026-11-23 | **旗标收为单键（用户裁定）**：去掉带量变体，只留 `--notes` bool——折叠是默认，展开就是「我要全部」；验收相应收窄 | Oscaner M. · Claude（kairos:cdd-spec-writer） |
| v0.4 | 2026-11-23 | **按 doc-contract 的 `presence` 重排结构**：九个 Design 组各补 `#### N.M` 条目、内容改为条目下的条目行，正文判定一字未改；评审轮一（`CDD_BLOCKED: doc-contract · presence`）的整改 | Oscaner M. · Claude（kairos:cdd-spec-writer） |
| v0.5 | 2026-11-23 | **评审轮一整改（F1–F5，用户裁定边界按消费者划）**：`docs/kairos/**` 退役而 README family · skills · 生成物仍在判内 · `floor.guard` 双臂与 `presentation-surface` 不动 · `grep-sweep-regression` 只去掉 `docs/` 扫描根 · `plugins.guard` 无清单臂（三方对齐是 `emit:check` 的 `deriveSourceDoc`）· 孪生对的 EN↔zh-CN 配对搬入 `emit:check` 而留下的夹具臂按内存反向注入命名 · 登记机器随四行退役、`referencesOf` 留作文法 · 已闭合文档的引用删除降级为记录卫生 · §9.2 的理由改指 `#valueToken` · 撤回 README 漂移代价且后续条目顺延 | Oscaner M. · Claude（kairos:cdd-spec-writer） |
| v0.6 | 2026-11-23 | **评审轮二整改（F1–F4，用户裁定）**：pin 下线改按符号判——栅栏读者搬 contract/markdown-spans.ts 的 ProseSpans、路径文法搬 contract/shape-rules.ts、闭合读数搬 contract/closed-document.ts 的 ClosedDocument，只退 pin 审计与 `PinVocabulary` 的 pin 定义；补入受影响测试文件的逐文件处置（`pins-guard-closure` 拆篇、`review-criteria` 与 `templates` 只退 pin 面、两份 session 测试改指闭合读数）；`CriteriaFace` 的 `test` 取值与 `ReviewGuides.pinLens` 及其取值一并退；登记表按七行记而退比较机器、留写作形态，`census:criteria.rows` 声明改读删除后的行数；§6 把 `diagrams.guard` 的一格产物读取与孪生对的真实产物格子搬入 `emit:check`，五条源内容臂与内存注入臂留下 | Oscaner M. · Claude（kairos:cdd-spec-writer） |
| v0.7 | 2026-11-23 | **评审轮三整改（F1–F4，用户裁定，含对轮二裁定的更正）**：`PinSpans` 整类搬入 ProseSpans，`tokensOf` · `proseEntriesOf` · `proseOf` · `blankedOf` 一并走，`contract/__tests__/shape-rules.test.ts` 的 import 改指新模块，`PinVocabulary` 的 `testOf` · `memberOf` · `isSymbol` 随 pin 定义退役；闭合读数搬整条读链（含 `DONE_CELL` 与唯一性证明），文档枚举改走 `SlugIndex` 而不另起目录走读，`face/lifecycle.ts` 与 `face/cli.ts` 的 pin 注入面改名换型；`census.guard` 按面拆——语料臂与登记机器臂退役，引用文法臂搬 contract/__tests__/census-grammar.test.ts；`CensusGate` 的单静态幸存形态写明 noStaticOnlyClass 的 biome-ignore 与 `pnpm run biome` exit 0 | Oscaner M. · Claude（kairos:cdd-spec-writer） |
| v0.8 | 2026-11-23 | **plan 起草时的 design 回填**：补 §8.4——本相位的 spec 与 plan 声明的新符号在落树前会被 pin 语料臂读成「树上不存在」（github#517 的假话形态），窗口自文档落树至 §2.1 删臂，不得以改文档消红；原 §8.4 顺延为 §8.5。 | Oscaner M. · Claude（kairos:cdd-plan） |
| v0.9 | 2026-11-23 | **评审轮四整改（F1–F6，用户裁定）**：§2.1 的改指清单补 `contract/__tests__/single-create.test.ts`（`PinVocabulary` 的 import 随 `pathOf` 走）、写明搬走二的落点是 contract/shape-rules.ts 且 `packages/cdd-engine/src-next/contract/pins.ts` 整文件删除；搬走三的深一层补路径归一化的新家与闭合读数的索引注入点（P36 T3 锁住构造点，不新起第二次构造）；§3.1 补 `face/__tests__/lifecycle.test.ts` 的 P37 T6 / P37 T7 两段退役，并把 `corpus` 席位从 `contract/rules.ts#RuleSeat` 与每一条 doc 行里删除、同批对齐 `contract/__tests__/rules.test.ts` 的字面表；§8.4 把四个未落树的名字改写成散文描述（F7–F10 的四条 pin 随之消失），v0.8 行的两个指针改回 §8.4 / §8.5。 | Oscaner M. · Claude（kairos:cdd-spec-writer） |
