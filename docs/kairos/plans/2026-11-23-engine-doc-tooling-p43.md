---
title: 'P43 · 引擎自证面退役：pin 按符号退、语料臂退、生成物归 emit:check、board 折叠'
doc-type: plan
version: v0.2
date: 2026-11-23
slug: '2026-11-23-engine-doc-tooling-p43-design'
base: develop
---

## Constraints

- **判据只撤语料臂，不改语义**：doc-contract / `single-create` / P41 形状规则 / `CensusGate.referencesOf` 的判定语义一字不动；本相位动的是「拿什么物料去跑」，不是「跑什么」。
- **边界按消费者划，不按路径划**：`docs/kairos/**` 不再被任何测试断言；README family · `AGENTS.md` · `marketplace/source.json` · `packages/kairos/skills/` · 生成物继续被探针判。
- **下线按符号判，不按文件判**：形状规则依赖的栅栏读者与路径文法搬去规则面而不退役；`Contract.validate` 的闭合实参必须仍由生产供给。
- **不写测试来证明自己的文档干净**：任何一门若在文档上断言零，它就该是夹具而不是语料臂。
- **禁止为了消红改文档**：出现「门报错 → 改文档」的处置，按缺陷处理。
- **对已闭合文档只动随门退役的读数**：删 `census:pin.*` 引用、把 `census:criteria.rows` 改成删除后的行数；不动任何结论、裁定或交付记录（D22 窄反转）。
- **一对夹具优先于一次全语料扫描**：每条保留的规则付出的是违规/邻合/零候选三条臂，不是语料。
- **折叠只改打印，不改口径**：`notes +M` 的 M 与今天同源；board 不新增第三态。
- **changeset 记 `cdd-engine` minor**（D74）。

### Task 1: 三条生产腿搬出 `pins.ts`

#### Objective
把 `contract/pins.ts` 从混合模块拆成三块规则面资产，一步不动它们的判定语义：

- 栅栏读者：`PinSpans` 的四个公开成员 `tokensOf` · `proseEntriesOf` · `proseOf` · `blankedOf` 整类搬进 `contract/markdown-spans.ts`，类名 `ProseSpans`；搬后 `tokensOf` 若无类外调用者则降为私有（由编译器判定，不手删行为）。
- 路径文法：`PinVocabulary.pathOf` 连它读到的 `isPattern` 占位符判读与扩展名词表一起搬进新模块 `contract/shape-rules.ts`（类名 `PathShape`）；它服务的形状规则类仍住 `contract/invariants.ts`，本相位不搬那些类。
- 闭合读数：`PinAudit#provenClosed` → `ForwardPaths#provenClosed` 的整条委派链（`#namedCellsOf` · `#resolveCell` · `#namesDoc` · `DONE_CELL`）搬进 `contract/closed-document.ts`，类名 `ClosedDocument`，方法 `closed(rel: string): boolean`；文档枚举改走 `infra/slug-index.ts#SlugIndex` 的文档读面，不再经 `PinIndex.entries()`。极性逐字保留：零命中与多命中都不闭合，只有唯一命中且那份文档就是被审文档才闭合。

生产接线改名不改形：`face/lifecycle.ts` 的 `#pinAudit` 面成为 `#closedDocument` 面（`#pinAuditFactory` · 构造选项 `pinAudit` 同步改名），`face/cli.ts` 的 `#auditOf` 只保留闭合读数这一用，`session/preflight.ts` 的 `provenClosed` 选项名不动（它是缝的名字，不是门的名）。

#### Files
- Create: `packages/cdd-engine/src-next/contract/markdown-spans.ts`
- Create: `packages/cdd-engine/src-next/contract/shape-rules.ts`
- Create: `packages/cdd-engine/src-next/contract/closed-document.ts`
- Create: `packages/cdd-engine/src-next/contract/__tests__/closed-document.test.ts`
- Create: `packages/cdd-engine/src-next/contract/__tests__/markdown-spans.test.ts`
- Modify: `packages/cdd-engine/src-next/contract/invariants.ts`
- Modify: `packages/cdd-engine/src-next/face/lifecycle.ts`
- Modify: `packages/cdd-engine/src-next/face/cli.ts`
- Modify: `packages/cdd-engine/src-next/contract/__tests__/shape-rules.test.ts`
- Modify: `packages/cdd-engine/src-next/contract/__tests__/single-create.test.ts`
- Modify: `packages/cdd-engine/src-next/session/__tests__/preflight-rows.test.ts`
- Modify: `packages/cdd-engine/src-next/session/__tests__/fix-round-gate.test.ts`

#### Consumes
- `contract/pins.ts#PinSpans` 的四个公开成员与 `#PinVocabulary.pathOf` 的路径文法（搬迁源）
- `contract/pins.ts#ForwardPaths#provenClosed` 的委派链（搬迁源）
- `infra/slug-index.ts#SlugIndex` 的文档读面（闭合读数的新枚举源）
- `contract/judge.ts#Contract.validate` 的第二实参（闭合实参的消费者，签名不动）

#### Produces
- `contract/markdown-spans.ts#ProseSpans`——四个成员的公开面，`invariants.ts` 的五处调用点改指它
- `contract/shape-rules.ts#PathShape`——`pathOf` 与 `isPattern` 的公开面，`invariants.ts#SingleCreateInvariant` 的 `#claimSets` 与 `contract/__tests__/single-create.test.ts` 的路径筛都改指它；同模块收下路径归一化，闭合读数链开头的归一化改指它
- `contract/closed-document.ts#ClosedDocument`——`closed(rel): boolean`，`face/lifecycle.ts` · `face/cli.ts` · `session/preflight.ts` 的闭合实参唯一来源；链内对 `PinIndex` 的静态调用零命中
- `contract/__tests__/closed-document.test.ts`——从 `pins-guard-closure.test.ts` 接过的成对夹具（两格各自闭合 · 零命中不闭合 · 多命中不闭合 · 唯一命中且同 slug 才闭合）
- `pins.ts` 在本任务后仍编译通过（退役是 Task 4 的事）

#### Steps
- 建 `markdown-spans.ts`，把 `PinSpans` 整类搬入并改名 `ProseSpans` — checkable: `pnpm exec tsc --noEmit -p packages/cdd-engine` exit 0，且 `invariants.ts` 的栅栏读全部改指新类、`PinSpans` 在该文件零命中
- 建 `shape-rules.ts`，把 `pathOf` · `isPattern` 与扩展名词表搬入并命名 `PathShape` — checkable: `invariants.ts#SingleCreateInvariant` 的 `#claimSets` 只经 `PathShape.pathOf` 判 `declaration.path`；`shape-rules.test.ts` 的既有断言全绿
- 建 `closed-document.ts`，把委派链搬入，枚举改走 `SlugIndex`；链开头的归一化函数随路径文法一起搬（搬走二的同一处），链内改指新名 — checkable: `closed-document.test.ts` 的四臂全红/全绿成对成立（两格各自闭合 · 零命中不闭合 · 多命中不闭合 · 唯一同 slug 闭合）；把归一化留在 `PinIndex` 上 ⇒ `pnpm exec tsc --noEmit -p packages/cdd-engine` 在 Task 4 删 `pins.ts` 时红，且本任务里 `closed-document.ts` 上 `PinIndex` 零命中
- 改三处生产接线名 — checkable: `face/lifecycle.ts` 与 `face/cli.ts` 上 `pinAudit` / `#auditOf` 的闭合法为零命中（改名后只余闭合面）；`session/preflight.ts` 的 `provenClosed` 选项名逐字未变
- 两份 session 测试与 `single-create.test.ts` 改指 `ClosedDocument` / `PathShape` — checkable: `session/__tests__/preflight-rows.test.ts` 与 `fix-round-gate.test.ts` 不再构造 `PinAudit`；`single-create.test.ts` 的 `pathOf` 调用改指 `PathShape.pathOf` 而上 `PinVocabulary` 零命中；三个文件全绿
- 提交 — checkable: `git log -1 --format=%s` 以 `refactor(p43):` 起头

#### Acceptance
`pins.ts` 仍在树上，但形状规则与闭合读数已不依赖它的公开面；`tsc` 与引擎套件全绿；`ClosedDocument` 的唯一性证明由 `SlugIndex` 供给，树上不存在第二处目录走读。

#### DependsOn
none

### Task 2: `AGENTS.md` 立规范

#### Objective
把判据写进 `AGENTS.md` 的「Conventions not enforced by the formatter」节（英文，与宪章 D101 互为指针），三条要点各一行：测试只断言引擎对夹具做了什么；以本仓 `docs/kairos/**` 为语料并断言其状态是禁止的，并写出原因（误判会在文档里被静默修复，缺陷照发消费者）；每条规则保留三条臂（违规必报 · 邻居沉默 · 零候选即红），生成物一致只归 `emit:check`。同批把边界写明：README family · `AGENTS.md` · `marketplace/source.json` · `packages/kairos/skills/` · 生成物仍由探针守。

#### Files
- Modify: `AGENTS.md`

#### Consumes
- 宪章 D101 的裁定正文（本规范的裁定与实测账，住 `docs/kairos/overalls/2026-10-10-engine-doc-tooling-overall.md`）

#### Produces
- `AGENTS.md` 的一节规范，含三条要点与边界；与 D101 双向指认

#### Steps
- 在新节写下三条要点与边界 — checkable: 该节含「docs/kairos」字样与三条臂的枚举，且不含版本号与计数
- 与 D101 互指 — checkable: `docs/kairos/overalls/2026-10-10-engine-doc-tooling-overall.md` 的 D101 行与 `AGENTS.md` 该节各含对方的名字
- 提交 — checkable: `git log -1 --format=%s` 以 `docs(p43):` 起头

#### Acceptance
规范在册、可指认，且它描述的三条臂在 Task 6 之后可由树上判例读出（本节不自行立门）。

#### DependsOn
none

### Task 3: board 的 notes 默认折叠

#### Objective
给 `cdd board` 加一个 `--notes` bool 通道行（与 `--artifacts` 同格，不设带量变体），并让 `BoardView#summaryToken` 默认只留 `notes +M` 计数：折叠时不起正文，展开时按今天的字节追加。P42 §2.1 的 token 段序 `verb · body · mark · +N · 降档注 · notes +M` 逐字不变，折叠只是最后一段不起正文。

#### Files
- Modify: `packages/cdd-engine/src-next/face/declare.ts`
- Modify: `packages/cdd-engine/src-next/face/board-view.ts`
- Modify: `packages/cdd-engine/src-next/face/cli.ts`
- Modify: `packages/cdd-engine/src-next/face/__tests__/board-view.test.ts`

#### Consumes
- `face/declare.ts#ChannelArgRow` 的 `artifacts` 行（bool 折叠的既有先例，本任务照抄形态）
- `face/board-view.ts#BoardView` 的 `#summaryToken`（notes 正文唯一的投影点）
- `contract/review-criteria.ts#REGRADE_NOTE_SEPARATOR` 与 `displayReason`（折叠函数，展开面同样走它）

#### Produces
- `--notes` 通道行（board 命令）；缺省 = 折叠
- `BoardView#summaryToken` 的折叠分支：`notes +M` 在，正文不在；`--notes` 打开时字节与改动前逐字相同
- `board-view.test.ts` 的成对臂：默认无正文 · `--notes` 展开逐字节相等 · 段序不变 · 展开面仍是一行（` · ` 与换行都不出现）

#### Steps
- 加 `--notes` 通道行并接到 board — checkable: `cdd board --help` 出现 `--notes`，且不写 `--notes` 时不把正文打进输出
- 改 `#summaryToken` 的 notes 段为折叠/展开两支 — checkable: `board-view.test.ts` 三臂（默认零正文 · `--notes` 逐字节相等 · 段序逐字同序）各自可红：把展开支删掉 ⇒ 第二臂红；把计数挪出 token ⇒ 第三臂红
- 展开面仍走 `displayReason` 的一行折叠 — checkable: 一条含换行与 ` · ` 的 note 在 `--notes` 下仍是一行（成对：改用裸 `join` ⇒ 该臂红）
- 提交 — checkable: `git log -1 --format=%s` 以 `feat(p43):` 起头

#### Acceptance
board 默认输出零 note 正文而计数在；`--notes` 展开的字节与改动前逐字相同；胶囊面零改动。

#### DependsOn
none

### Task 4: pin 门退役

#### Objective
在 Task 1 把生产腿搬走之后，把 pin 门本体整批删掉：`contract/pins.ts` 余下部分（`PinAudit` 的扫描与登记两半 · `PinIndex` · `PinSource` · `PinDeclarations` · `ForwardPaths` · `corpusOf` · `PinVocabulary` 的 pin 定义，含 `isPin` · `#isProduct` · 模板词表 · `testOf` · `memberOf` · `isSymbol`）· `pin-parseability` 判据行（连 `CriteriaFace` 的 `test` 取值）· `pinLensOf` 与 `ReviewGuides.pinLens` 字段及其六个取值 · 三个测试文件 · 受影响测试的 pin 面。文件 `pins.ts` 在此任务后不存在。

#### Files
- Delete: `packages/cdd-engine/src-next/contract/pins.ts`
- Delete: `packages/cdd-engine/src-next/contract/__tests__/pins.guard.test.ts`
- Delete: `packages/cdd-engine/src-next/contract/__tests__/pins-guard-closure.test.ts`
- Delete: `packages/cdd-engine/src-next/contract/__tests__/scan-coverage.test.ts`
- Modify: `packages/cdd-engine/src-next/contract/review-criteria.ts`
- Modify: `packages/cdd-engine/src-next/render/templates.ts`
- Modify: `packages/cdd-engine/src-next/face/lifecycle.ts`
- Modify: `packages/cdd-engine/src-next/face/cli.ts`
- Modify: `packages/cdd-engine/src-next/contract/__tests__/review-criteria.test.ts`
- Modify: `packages/cdd-engine/src-next/render/__tests__/templates.test.ts`
- Modify: `packages/cdd-engine/src-next/face/__tests__/lifecycle.test.ts`

#### Consumes
- `contract/markdown-spans.ts#ProseSpans` · `contract/shape-rules.ts#PathShape` · `contract/closed-document.ts#ClosedDocument`（Task 1 已接走的三条腿）
- `contract/judge.ts#Contract.validate` 的第二实参（由 `ClosedDocument` 供给）

#### Produces
- `pins.ts` 及其三个测试文件从树上消失；`Contract` / `invariants` / `lifecycle` / `cli` 零 pin 引用
- `CRITERIA_ROWS` 少一行（`pin-parseability`），`CriteriaFace` 的 `test` 取值随之无人使用并删除
- `ReviewGuides.pinLens` 与 `REVIEWS` 六行的该取值删除
- `review-criteria.test.ts` 的 id 名册收为删除后的集合、去掉 `test` 面断言、`pin-parseability` 的层级与反例句格子删；`templates.test.ts` 的 `pinLensOf` 三格删，其余留

#### Steps
- 删 `pins.ts` 并清 `Contract` / `invariants` / `lifecycle` / `cli` 的引用 — checkable: 全树 `grep -rn "contract/pins" packages/cdd-engine/src-next` 零命中，`pnpm exec tsc --noEmit -p packages/cdd-engine` exit 0
- 删判据行与 `CriteriaFace` 的 `test` 取值 — checkable: `CRITERIA_ROWS` 的行名册不再含 `pin-parseability`；`review-criteria.test.ts` 按删除后的 id 集断言（成对：把该行加回 ⇒ 名册臂红）
- 删 `pinLensOf` 与 `ReviewGuides.pinLens` — checkable: `render/templates.ts` 上 `pinLens` 零命中，`templates.test.ts` 只余非 pin 臂且全绿
- 删三个测试文件；`lifecycle.test.ts` 只退 pin 回读面 — checkable: 三个路径不存在；`face/__tests__/lifecycle.test.ts` 上「pin 回读语料注入」与「交接单 `contract.path` 解析」两个 describe 退役、其余全绿
- 提交 — checkable: `git log -1 --format=%s` 以 `refactor(p43):` 起头

#### Acceptance
pin 门的每一符号都已不在树上，而形状规则与闭合读数仍在生产（Task 1 的三条腿），`tsc` 与套件全绿。

#### DependsOn
Task 1

### Task 5: census 比较机器退役，文法夹具分家

#### Objective
`contract/census.ts` 只留 `CensusGate.referencesOf` 这一个静态文法面（收成单静态类，按仓库既有十个先例带一行 `biome-ignore` 与理由），`censusTableOf` · `CensusTable` · `CensusDeps` · `CensusGate#report` 与四行 `pin.*` 登记一并删除。`contract/__tests__/census.guard.test.ts` 按面拆：语料臂与登记机器臂退役，引用文法臂搬进 `contract/__tests__/census-grammar.test.ts` 继续断言（占位符读作散文 · 小数与带后缀值读作散文 · 只读右值）。

#### Files
- Modify: `packages/cdd-engine/src-next/contract/census.ts`
- Delete: `packages/cdd-engine/src-next/contract/__tests__/census.guard.test.ts`
- Create: `packages/cdd-engine/src-next/contract/__tests__/census-grammar.test.ts`
- Modify: `packages/cdd-engine/src-next/contract/invariants.ts`

#### Consumes
- `contract/census.ts#CensusGate.referencesOf`（留下的文法面，`MeasureLiteralInvariant` 的跨度读在用）
- `contract/__tests__/census.guard.test.ts` 的引用文法臂（搬迁源）

#### Produces
- `contract/census.ts` 只剩 `referencesOf`（单静态类 + `biome-ignore` 行）；登记表与比较机器不存在
- `contract/__tests__/census-grammar.test.ts`——三臂各自可红（占位符 · 小数与带后缀值 · 只读右值）
- `invariants.ts#MeasureLiteralInvariant` 的调用点不动（仍只读文法）

#### Steps
- 删登记表与比较机器，收 `CensusGate` 为单静态类 — checkable: `pnpm run biome` exit 0（单静态类落在 `biome-ignore` 之下）；成对：删掉那行 ignore ⇒ `biome check` 非零退出
- 搬文法臂到新文件 — checkable: `census-grammar.test.ts` 三臂全绿；把 `REFERENCE` 的终止符规则去掉再跑 ⇒ `3.5` 那一臂红
- 提交 — checkable: `git log -1 --format=%s` 以 `refactor(p43):` 起头

#### Acceptance
文法面仍在判、且能红；登记机器与语料臂消失；`biome` 与套件全绿。

#### DependsOn
Task 1, Task 4

### Task 6: 语料臂退役与夹具补位

#### Objective
撤掉「拿本仓 `docs/kairos/**` 跑一遍并断言零」的那一臂，判据本体与夹具留下：`doc-corpus.guard.test.ts` 与 `phase-inventory.guard.test.ts` 整文件退役；`charter-self-repair.test.ts` 撤宪章零 finding 那一臂；`single-create.test.ts` 撤读 `docs/kairos/plans` 的那一段；`packages/kairos/tests/grep-sweep-regression.test.ts` 的扫描根去掉 `docs/`。同批核对每条被撤臂的判据是否仍有违规/邻合/零候选三条臂，缺则本任务补。

#### Files
- Delete: `packages/cdd-engine/src-next/contract/__tests__/doc-corpus.guard.test.ts`
- Delete: `packages/cdd-engine/src-next/contract/__tests__/phase-inventory.guard.test.ts`
- Modify: `packages/cdd-engine/src-next/contract/__tests__/charter-self-repair.test.ts`
- Modify: `packages/cdd-engine/src-next/contract/__tests__/single-create.test.ts`
- Modify: `packages/kairos/tests/grep-sweep-regression.test.ts`
- Modify: `packages/cdd-engine/src-next/contract/rules.ts`
- Modify: `packages/cdd-engine/src-next/contract/__tests__/rules.test.ts`

#### Consumes
- `contract/judge.ts#Contract`（doc-contract 各腿的夹具入口）
- `contract/invariants.ts` 的形状规则类（`single-create` 与五条 P41 规则的既有夹具所在面）

#### Produces
- 两文件退役；两份文件只余夹具面且全绿
- `grep-sweep-regression` 的扫面不含 `docs/`，发布面（`packages/` · README family · `marketplace/source.json`）照旧
- 缺口补位：任一被撤语料臂涉及的规则，若其夹具缺「违规必报 / 邻居沉默 / 零候选即红」中的一条，本任务补上

#### Steps
- 删两个语料文件，收两份文件到夹具面 — checkable: 两路径不存在；`charter-self-repair.test.ts` 与 `single-create.test.ts` 不再读 `docs/kairos`，且全绿
- `grep-sweep` 去掉 `docs/` 根 — checkable: 该文件的扫描根上 `docs/` 零命中；成对：把一个已删 token 写进 `docs/` 下的文件 ⇒ 不红（扫面不含它），写进 `packages/` ⇒ 红
- 把 `seat` 的 `corpus` 面从词表与每一行上拿掉 — checkable: `contract/rules.ts` 上 `corpus` 零命中；`contract/__tests__/rules.test.ts` 的字面表只余树上真实存在的两个面（成对：把 `corpus` 加回词表而不加行 ⇒ 词表臂红；把它加回某一行 ⇒ 行臂红）
- 逐规则核对三条臂并补缺 — checkable: 对每条被撤语料臂涉及的规则各跑一次「违规夹具必报 / 邻居夹具沉默 / 零候选即红」；缺的那条在本任务补出格
- 提交 — checkable: `git log -1 --format=%s` 以 `test(p43):` 起头

#### Acceptance
测试面不再有以本仓文档为语料的零断言，而每条规则的执行面仍在；发布面探针原样全绿。

#### DependsOn
Task 4

### Task 7: 记录面：引用删与数字改

#### Objective
把已闭合文档里随门退役的读数处理掉：`census:pin.*` 的引用与 P41 两份文档的散文提及删除；带 `census:criteria.rows` 的声明改读删除 `pin-parseability` 之后的行数。不动任何结论、裁定或交付记录。

#### Files
- Modify: `docs/kairos/specs/2026-11-16-engine-doc-tooling-p37-design.md`
- Modify: `docs/kairos/plans/2026-11-16-engine-doc-tooling-p37.md`
- Modify: `docs/kairos/specs/2026-11-19-engine-doc-tooling-p41-design.md`
- Modify: `docs/kairos/plans/2026-11-19-engine-doc-tooling-p41.md`
- Modify: `docs/kairos/specs/2026-11-20-engine-doc-tooling-p42-design.md`
- Modify: `docs/kairos/plans/2026-11-20-engine-doc-tooling-p42.md`

#### Consumes
- `contract/census.ts#CensusGate.referencesOf`（引用的文法，用来判定哪些字面是引用、哪些是散文）
- `contract/review-criteria.ts#CRITERIA_ROWS`（删除后的行数，作为数字改写的唯一来源）

#### Produces
- 语料上 `census:pin.*` 零命中（引用与散文提及都不留）
- 每处 `census:criteria.rows` 声明等于 `CRITERIA_ROWS` 删除后的行数
- `census:questions.rows` 与 `questions.cells` 原样未动

#### Steps
- 删 `census:pin.*` 的引用与 P41 的散文提及 — checkable: `grep -rn "census:pin" docs/` 零命中
- 改 `census:criteria.rows` 的声明数字 — checkable: 全库该 id 的声明值与 `CRITERIA_ROWS` 的实际行数相等（成对：把一处改回旧值 ⇒ 该断言红）
- 提交 — checkable: `git log -1 --format=%s` 以 `docs(p43):` 起头

#### Acceptance
记录面与树自洽：retired 的读数不再指向已撤的登记行，活着的行数声明读得出真值。

#### DependsOn
Task 4, Task 5

### Task 8: 生成物一致收归 `emit:check`

#### Objective
把两处读**渲染产物**的臂移出测试，交给 `emit:check`：`face/__tests__/diagrams.guard.test.ts` 里读 HTML 的那一格（tag 在场、退役 tag 不在场）与 `face/__tests__/diagram-twin.guard.test.ts` 里源↔产物的成对比较（覆盖与图型根 · 产物命名 · 两侧修订一致 · 引用多重集 · 文案逐格）。该文件的五条源内容臂与内存反向注入臂留下。

#### Files
- Modify: `packages/cdd-engine/src-next/face/__tests__/diagrams.guard.test.ts`
- Modify: `packages/cdd-engine/src-next/face/__tests__/diagram-twin.guard.test.ts`
- Modify: `scripts/lib/diagrams.ts`
- Modify: `scripts/run.ts`

#### Consumes
- `scripts/lib/diagrams.ts#DiagramProducts`（重渲染后比对，`emit:check` 的既有路径）
- `scripts/run.ts` 的 `emit:check` 分支（新断言落点）

#### Produces
- `emit:check` 覆盖三项生成物面：`.claude-plugin/` 与 marketplace 的派生、ISSUE_TEMPLATE、`docs/diagrams` 的源↔产物（含孪生对）
- `diagrams.guard.test.ts` 只余五条源内容臂 + P28 T2 那一格；`diagram-twin.guard.test.ts` 只余内存反向注入臂
- 两个测试文件不再读 HTML

#### Steps
- 把 HTML 读取与孪生比对搬进 `emit:check` — checkable: 篡改 `docs/diagrams` 任一份产物 ⇒ `pnpm run emit:check` 非零退出；篡改一份生成的 `.claude-plugin` 文件 ⇒ 同样非零
- 从两份测试里删去读产物的臂 — checkable: 两文件上 `docs/diagrams` 的 HTML 路径零命中，其余臂全绿
- 提交 — checkable: `git log -1 --format=%s` 以 `test(p43):` 起头

#### Acceptance
生成物一致只有一个执行面（`emit:check`），且它可红；测试只剩作者源的判据与内存注入。

#### DependsOn
Task 6

### Task 9: `selector-coverage` 换合成物料

#### Objective
把 `contract/__tests__/selector-coverage.test.ts` 的夹具从本仓文档换成按四种 doc-type 各一份的合成合规文档（住 `contract/__tests__/fixtures/`），判定与格题一字不改。合成文档必须过 doc-contract（与消费者文档同判，无豁免），字段名与结构由四种类型的骨架派生。

#### Files
- Create: `packages/cdd-engine/src-next/contract/__tests__/fixtures/phase-spec.md`
- Create: `packages/cdd-engine/src-next/contract/__tests__/fixtures/overall.md`
- Create: `packages/cdd-engine/src-next/contract/__tests__/fixtures/plan.md`
- Create: `packages/cdd-engine/src-next/contract/__tests__/fixtures/single-spec.md`
- Modify: `packages/cdd-engine/src-next/contract/__tests__/selector-coverage.test.ts`

#### Consumes
- `render/skeleton.ts` 的四型骨架（合成物料的字段名与结构来源）
- `contract/judge.ts#Contract`（合成物料自证的 doc-contract 面）
- `contract/selector-engine.ts` 与四条登记表的 `selector` 声明（判定本体，不改）

#### Produces
- 四份合成合规文档，各过 doc-contract 零 finding
- `selector-coverage.test.ts` 读合成物料；三条成对臂成立（删一条 selector 即红 · 新增 selector 不给表达面即红 · 改错一份合成物料的字段名即红）

#### Steps
- 生成四份合成物料并自证 — checkable: 对四份各跑一次 doc-contract，零 finding
- 把 `selector-coverage` 的夹具指向它们 — checkable: 每表每 selector 在各自类型的物料上解析成功；把一份物料的字段名改错 ⇒ 该臂红
- 提交 — checkable: `git log -1 --format=%s` 以 `test(p43):` 起头

#### Acceptance
selector 的解析证明不再依赖本仓文档，且物料自己在判据之下；删一条 selector 仍能红。

#### DependsOn
Task 6

### Task 10: changeset 与全量门

#### Objective
收口：加 `cdd-engine` minor 的 changeset（消费面字节变化：判据行少一条、prompt 少一段 lens、`cdd board` 的默认输出变化、生成物比对归口变化），并跑全量门。

#### Files
- Create: `.changeset/p43-self-verification.md`
- Modify: `docs/kairos/plans/2026-11-23-engine-doc-tooling-p43.md`

#### Consumes
- 全量门的既有入口 `pnpm run validate`（本任务只跑不改）
- 变更史纪律（`.changeset/README.md` 的级别判据）

#### Produces
- 一份 minor changeset，摘要点名四处消费面变化
- 计划文档的变更史追加一行（本任务的收口读数）

#### Steps
- 写 changeset — checkable: 合 `changeset-levels.test.ts` 的级别判据（非 `major`），且摘要含四处消费面变化
- 跑全量门 — checkable: `pnpm run validate` exit 0
- 提交 — checkable: `git log -1 --format=%s` 以 `chore(p43):` 起头

#### Acceptance
`validate` 全绿；changeset 在册且级别为 minor；本相位的十项任务全部落地。

#### DependsOn
Task 1, Task 2, Task 3, Task 4, Task 5, Task 6, Task 7, Task 8, Task 9

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-11-23 | 初稿（cdd-plan 会话）：按 spec v0.7 的九节拆为十任务五波——三条生产腿搬家 · AGENTS.md 规范 · board 折叠 · pin 门退役 · census 文法分家 · 语料臂退役与夹具补位 · 记录面引用 · 生成物归 `emit:check` · selector 合成物料 · changeset 收口 | Oscaner M. · Claude（kairos:cdd-plan） |
| v0.2 | 2026-11-23 | **按 spec 评审轮四的 F1–F4 修正任务面（spec v0.9）**：Task 1 补 `single-create.test.ts` 的重指与路径归一化的归属（`PinIndex.normalize` 随路径文法搬）；Task 4 补 `lifecycle.test.ts` 的两个 pin 回读 describe；Task 6 收掉 `seat` 的 `corpus` 幻面（词表与 33 行 + `rules.test.ts` 字面表同批） | Oscaner M. · Claude（kairos:cdd-plan） |