---
title: 'P43 · 引擎自证面退役：pin 按符号退、语料臂退、生成物归 emit:check、board 折叠'
doc-type: plan
version: v0.4
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
- **对已闭合文档只动随门退役的读数**：删 `census:pin.*` 的引用——文法判定的形态 `census:<id> = <n>`——把 `census:criteria.rows` 改成删除后的行数；不带等号与数字的散文提及留作退役记录；不动任何结论、裁定或交付记录（D22 窄反转）。
- **一对夹具优先于一次全语料扫描**：每条保留的规则付出的是违规/邻合/零候选三条臂，不是语料。
- **折叠只改打印，不改口径**：`notes +M` 的 M 与今天同源；board 不新增第三态。
- **除 Task 10 外，「套件全绿」按文件读**：本计划与自己的 spec 声明了尚未落树的符号，而 pin 的语料臂读的正是这两份文档，所以从本相位文档落树到 Task 4 删掉那一臂之间，`pins.guard` 的语料臂恒红——那就是 spec §8.4 的窗口，不是回归。故除 Task 10 外，每个任务的「套件全绿」指本任务 Files 涉及的文件加上 `pnpm exec tsc --noEmit -p packages/cdd-engine`；语料臂的红按该窗口处理，只能由 Task 4 的删除撤销，绝不以改冻结文档消红。
- **changeset 记 `cdd-engine` minor**（D74）。

### Task 1: 三条生产腿搬出 `pins.ts`

#### Objective
把 `contract/pins.ts` 从混合模块拆成三块规则面资产，一步不动它们的判定语义：

- 栅栏读者：`PinSpans` 的四个公开成员 `tokensOf` · `proseEntriesOf` · `proseOf` · `blankedOf` 整类搬进 `contract/markdown-spans.ts`，类名 `ProseSpans`；搬后 `tokensOf` 若无类外调用者则降为私有（由编译器判定，不手删行为）。
- 路径文法：`PinVocabulary.pathOf` 连它读到的 `isPattern` 占位符判读与扩展名词表一起搬进新模块 `contract/shape-rules.ts`（类名 `PathShape`）；它服务的形状规则类仍住 `contract/invariants.ts`，本相位不搬那些类。
- 闭合读数：`PinAudit#provenClosed` → `ForwardPaths#provenClosed` 的整条委派链（`#namedCellsOf` · `#resolveCell` · `#namesDoc` · `DONE_CELL`）搬进 `contract/closed-document.ts`，类名 `ClosedDocument`，方法 `closed(rel: string): boolean`；文档枚举改走 `infra/slug-index.ts#SlugIndex` 的文档读面，不再经 `PinIndex.entries()`。极性逐字保留：零命中与多命中都不闭合，只有唯一命中且那份文档就是被审文档才闭合。

生产接线是加法，不是改名：`face/lifecycle.ts` 新增 `#closedDocument` · `#closedDocumentFactory` · 构造选项 `closedDocument`，与既有的 `#pinIndex` · `#pinAuditFactory` · 构造选项 `pinAudit` · `#pinAudit()` 并列存在。理由是那两个 pin 读回语料（`face/lifecycle.ts#CliLifecycle` 的 `scanText` 与 `pathResolves` 各调一次 `#pinAudit()`）归 Task 4 连同 pin 门一起删，本任务不能先抽掉它们的访问者。`face/cli.ts` 同样只加：新增 `#closedOf` 与它自己的备忘，判决面的闭合实参注入改指 `#closedOf(root).closed(rel)`；`#audit` 备忘与 `#auditOf`（pin 访问者的注入源）原样留到 Task 4。两种拼写并存到 Task 4 收尾，`#pinAudit()` 与它的两个调用点一处不动。

惰性 fallback 是这条接线的写集之一：`#closedDocument()` 在调用点未注入访问者时自己组装闭合读数，索引取 `contract/invariants.ts` 导出的默认索引读——本任务把 `Invariant#indexOf` 里那处 `ctx.slugIndex ?? SlugIndex.build(ctx.root, ctx.fs)` 提成该文件导出的索引读，`indexOf` 改为委派它，实体仍是 `infra/slug-index.ts#SlugIndex.build(repoRoot, fs?)` 这个公开静态，于是该文件的 `SlugIndex.build` 字面仍只有一处，`face/cli.ts` 与 `session/preflight.ts` 两处不动，`face/__tests__/cli.test.ts` 的 P36 T3 构造点清单保持绿。`ClosedDocument` 的 fallback 走这个导出读，不碰受保护的 `indexOf(ctx)`，也不在 `face/lifecycle.ts` 新起 `SlugIndex.build`，且无需任何 `JudgeContext` 即可编译。`new CliLifecycle(` 的其余构造点一处都不欠改。`session/preflight.ts` 的 `provenClosed` 选项名不动（它是缝的名字，不是门的名）。

`contract/pins.ts` 在本任务是收缩而不是退役：`Modify` 行在下面，`Delete` 行在 Task 4。先收后删是合法的两步，形状门既不把它读成双重创造，也不把它读成提前删除；本任务收尾时它仍编译通过。

#### Files
- Create: `packages/cdd-engine/src-next/contract/markdown-spans.ts`
- Create: `packages/cdd-engine/src-next/contract/shape-rules.ts`
- Create: `packages/cdd-engine/src-next/contract/closed-document.ts`
- Create: `packages/cdd-engine/src-next/contract/__tests__/closed-document.test.ts`
- Create: `packages/cdd-engine/src-next/contract/__tests__/markdown-spans.test.ts`
- Modify: `packages/cdd-engine/src-next/contract/pins.ts`
- Modify: `packages/cdd-engine/src-next/contract/invariants.ts`
- Modify: `packages/cdd-engine/src-next/face/lifecycle.ts`
- Modify: `packages/cdd-engine/src-next/face/cli.ts`
- Modify: `packages/cdd-engine/src-next/contract/__tests__/shape-rules.test.ts`
- Modify: `packages/cdd-engine/src-next/contract/__tests__/pins.guard.test.ts`
- Modify: `packages/cdd-engine/src-next/contract/__tests__/single-create.test.ts`
- Delete: `packages/cdd-engine/src-next/contract/__tests__/pins-guard-closure.test.ts`
- Modify: `packages/cdd-engine/src-next/session/__tests__/preflight-rows.test.ts`
- Modify: `packages/cdd-engine/src-next/session/__tests__/fix-round-gate.test.ts`

#### Consumes
- `contract/pins.ts#PinSpans` 的四个公开成员与 `#PinVocabulary.pathOf` 的路径文法（搬迁源）
- `contract/pins.ts#ForwardPaths#provenClosed` 的委派链（搬迁源）
- `infra/slug-index.ts#SlugIndex` 的文档读面（闭合读数的新枚举源）
- `contract/judge.ts#Contract.validate` 的第二实参（闭合实参的消费者，签名不动）

#### Produces
- `contract/markdown-spans.ts#ProseSpans`——四个成员的公开面；`invariants.ts` 的形状行散文读、句子索引的空白化与形状臂的行级遮蔽一并改指它，import 行随之改指
- `contract/shape-rules.ts#PathShape`——`pathOf` 与 `isPattern` 的公开面，`invariants.ts#SingleCreateInvariant` 的 `#claimSets` 与 `contract/__tests__/single-create.test.ts` 的路径筛都改指它；同模块收下路径归一化，闭合读数链开头的归一化改指它
- `contract/closed-document.ts#ClosedDocument`——`closed(rel): boolean`，`face/lifecycle.ts` · `face/cli.ts` · `session/preflight.ts` 的闭合实参唯一来源；链内对 `PinIndex` 的静态调用零命中
- `face/lifecycle.ts` 的 `#closedDocument` · `#closedDocumentFactory` · 构造选项 `closedDocument` 与 `face/cli.ts` 的 `#closedOf`——闭合读数的注入面；pin 访问者 `#pinIndex` · `#pinAuditFactory` · `pinAudit` · `#pinAudit()` · `#auditOf` 与两个读回语料原样在树上，两种拼写并存到 Task 4
- `contract/invariants.ts` 的导出默认索引读——`SlugIndex.build(repoRoot, fs?)` 是该文件唯一字面，`Invariant#indexOf` 与 `ClosedDocument` 的 fallback 同走这一处
- `contract/__tests__/closed-document.test.ts`——从 `pins-guard-closure.test.ts` 整篇接过的两段：成对夹具（两格各自闭合 · 零命中不闭合 · 多命中不闭合 · 唯一命中且同 slug 才闭合）与构造点臂（一次 dispatch 只取一个闭合读数，该读数就是交给 `Contract.validate` 的那一个；未注入访问者时由 fallback 构造，同一惰性备忘）；`pins-guard-closure.test.ts` 因此整文件退役，`Delete` 行在本任务的 Files 里（内容整体搬进新文件，旧文件名不再需要）。
- `pins.ts` 在本任务后仍编译通过（本任务只给它 `Modify` 行，退役与 `Delete` 行在 Task 4）

#### Steps
- 建 `markdown-spans.ts`，把 `PinSpans` 整类搬入并改名 `ProseSpans` — checkable: `pnpm exec tsc --noEmit -p packages/cdd-engine` exit 0，且 `invariants.ts` 的栅栏读全部改指新类、`PinSpans` 在该文件零命中；`contract/__tests__/pins.guard.test.ts` 的 `PinSpans` import 改指 `ProseSpans`，其 `tokensOf` 臂随可见性改指或搬进 `markdown-spans.test.ts`
- 建 `shape-rules.ts`，把 `pathOf` · `isPattern` 与扩展名词表搬入并命名 `PathShape` — checkable: `invariants.ts#SingleCreateInvariant` 的 `#claimSets` 只经 `PathShape.pathOf` 判 `declaration.path`；`shape-rules.test.ts` 的既有断言全绿
- 建 `closed-document.ts`，把委派链搬入，枚举改走 `SlugIndex`；链开头的归一化函数随路径文法一起搬（搬走二的同一处），链内改指新名 — checkable: `closed-document.test.ts` 的四臂全红/全绿成对成立（两格各自闭合 · 零命中不闭合 · 多命中不闭合 · 唯一同 slug 闭合）；把归一化留在 `PinIndex` 上 ⇒ `pnpm exec tsc --noEmit -p packages/cdd-engine` 在 Task 4 删 `pins.ts` 时红，且本任务里 `closed-document.ts` 上 `PinIndex` 零命中
- 加闭合访问者与它的 fallback，pin 访问者一处不动 — checkable: `face/lifecycle.ts` 与 `face/cli.ts` 上 `#closedDocument` · `#closedDocumentFactory` · `closedDocument` · `#closedOf` 各在其位，而 `#pinIndex` · `#pinAuditFactory` · `pinAudit` · `#pinAudit()` · `#auditOf` 仍在原位、两个读回语料仍调到 `#pinAudit()`；`pnpm exec tsc --noEmit -p packages/cdd-engine` exit 0（构造选项仍是可选，`new CliLifecycle(` 的构造点一处未改）；fallback 只经 `contract/invariants.ts` 的导出索引读，不需要 `JudgeContext`，`pnpm -C packages/cdd-engine exec vitest run src-next/face/__tests__/cli.test.ts` 的 P36 T3 保持绿；`session/preflight.ts` 的 `provenClosed` 选项名逐字未变
- 两份 session 测试改指 `ClosedDocument` / `PathShape`，并把 `pins-guard-closure.test.ts` 的两段搬进 `closed-document.test.ts` — checkable: `session/__tests__/preflight-rows.test.ts` 与 `fix-round-gate.test.ts` 不再构造 `PinAudit`；`single-create.test.ts` 的 `pathOf` 调用改指 `PathShape.pathOf` 而上 `PinVocabulary` 零命中；`closed-document.test.ts` 同时带成对夹具与构造点臂且全绿，`pins-guard-closure.test.ts` 不在树上；成对：去掉那条零注入的臂 ⇒ 从注入访问者的 dispatch 仍绿而零注入的那条红
- 提交 — checkable: `git log -1 --format=%s` 以 `refactor(p43):` 起头

#### Acceptance
`pins.ts` 仍在树上，但形状规则与闭合读数已不依赖它的公开面；`tsc` 与本任务 Files 涉及的引擎套件全绿，`pins.guard` 的语料臂按 spec §8.4 的窗口读红并由 Task 4 的删除撤销（不以改冻结文档消红）；`ClosedDocument` 的唯一性证明由 `SlugIndex` 供给，树上不存在第二处目录走读。

#### DependsOn
none

### Task 2: `AGENTS.md` 立规范

#### Objective
把判据写进 `AGENTS.md` 的「Conventions not enforced by the formatter」节（英文，与宪章 D101 互为指针），三条要点各一行：测试只断言引擎对夹具做了什么；以本仓 `docs/kairos/**` 为语料并断言其状态是禁止的，并写出原因（误判会在文档里被静默修复，缺陷照发消费者）；每条规则保留三条臂（违规必报 · 邻居沉默 · 零候选即红），生成物一致只归 `emit:check`。同批把边界写明：README family · `AGENTS.md` · `marketplace/source.json` · `packages/kairos/skills/` · 生成物仍由探针守。宪章的「验自面的边界（D101）」一行今天还写着收窄前的边界（`docs/kairos/**` 与 README 类文档、生成物一致一起归为「不由测试断言」），同批把它改成同一句边界并指向 D101 的裁定行，两个家因此说同一件事。

#### Files
- Modify: `AGENTS.md`
- Modify: `docs/kairos/overalls/2026-10-10-engine-doc-tooling-overall.md`

#### Consumes
- 宪章 D101 的裁定正文（本规范的裁定与实测账，住 `docs/kairos/overalls/2026-10-10-engine-doc-tooling-overall.md`）
- 宪章 `## Boundary rules` 的「验自面的边界（D101）」一行（今天写的是收窄前的边界）

#### Produces
- `AGENTS.md` 的一节规范，含三条要点与边界；与 D101 双向指认
- 宪章 Boundary rules 的 D101 行与本节的边界同界：退役面只 `docs/kairos/**`，保留面点名 README family · `AGENTS.md` · `marketplace/source.json` · `packages/kairos/skills/` · 生成物；该行指向 D101 的裁定行而不复述理由
- 宪章 Change history 追加一行，front-matter `version` 随该行提到最新（同一次编辑）

#### Steps
- 在新节写下三条要点与边界 — checkable: 该节含「docs/kairos」字样与三条臂的枚举，且不含版本号与计数
- 与 D101 互指 — checkable: `docs/kairos/overalls/2026-10-10-engine-doc-tooling-overall.md` 的 D101 行与 `AGENTS.md` 该节各含对方的名字
- 对齐宪章的边界行 — checkable: 宪章 Boundary rules 上该行与 `AGENTS.md` 新节说同一条边界，两处都不枚举对方排除的语料（宪章不再写「README 类文档、生成物一致都不由测试断言」）；宪章 Change history 与 front-matter `version` 同批落行
- 提交 — checkable: `git log -1 --format=%s` 以 `docs(p43):` 起头

#### Acceptance
规范在册、可指认，且它描述的三条臂在 Task 6 之后可由树上判例读出（本节不自行立门）；宪章的边界行与本节的边界说同一件事，两个家不再各说一套。

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
- Modify: `packages/cdd-engine/src-next/session/__tests__/notes-channel.test.ts`

#### Consumes
- `face/declare.ts#ChannelArgRow` 的 `artifacts` 行（bool 折叠的既有先例，本任务照抄形态）
- `face/board-view.ts#BoardView` 的 `#summaryToken`（notes 正文唯一的投影点）
- `contract/review-criteria.ts#REGRADE_NOTE_SEPARATOR` 与 `displayReason`（折叠函数，展开面同样走它）

#### Produces
- `--notes` 通道行（board 命令）；缺省 = 折叠
- `BoardView#summaryToken` 的折叠分支：`notes +M` 在，正文不在；`--notes` 打开时字节与改动前逐字相同
- `board-view.test.ts` 的成对臂：默认无正文 · `--notes` 展开逐字节相等 · 段序不变 · 展开面仍是一行（` · ` 与换行都不出现）
- `notes-channel.test.ts` 的 board token 断言改到折叠形态：默认臂只断言 `notes +M`（计数在、正文不在），展开臂逐字节断言原正文；brief 渲染组不在本任务的面内，一行不动

#### Steps
- 加 `--notes` 通道行并接到 board — checkable: `cdd board --help` 出现 `--notes`，且不写 `--notes` 时不把正文打进输出
- 改 `#summaryToken` 的 notes 段为折叠/展开两支 — checkable: `board-view.test.ts` 三臂（默认零正文 · `--notes` 逐字节相等 · 段序逐字同序）各自可红：把展开支删掉 ⇒ 第二臂红；把计数挪出 token ⇒ 第三臂红
- 展开面仍走 `displayReason` 的一行折叠 — checkable: 一条含换行与 ` · ` 的 note 在 `--notes` 下仍是一行（成对：改用裸 `join` ⇒ 该臂红）
- 把 `session/__tests__/notes-channel.test.ts` 上按展开字节 pin 的 board token 断言改到折叠形态 — checkable: 该文件的默认臂只余 `notes +M`（正文零命中），`--notes` 臂逐字节等于改动前的原串；brief 渲染组断言未动且全绿；成对：把默认改回展开 ⇒ 默认臂红
- 提交 — checkable: `git log -1 --format=%s` 以 `feat(p43):` 起头

#### Acceptance
board 默认输出零 note 正文而计数在；`--notes` 展开的字节与改动前逐字相同；胶囊面零改动。

#### DependsOn
none

### Task 4: pin 门退役

#### Objective
在 Task 1 把生产腿搬走之后，把 pin 门本体整批删掉：`contract/pins.ts` 余下部分（`PinAudit` 的扫描与登记两半 · `PinIndex` · `PinSource` · `PinDeclarations` · `ForwardPaths` · `corpusOf` · `PinVocabulary` 的 pin 定义，含 `isPin` · `#isProduct` · 模板词表 · `testOf` · `memberOf` · `isSymbol`）· `pin-parseability` 判据行（连 `CriteriaFace` 的 `test` 取值）· `pinLensOf` 与 `ReviewGuides.pinLens` 字段与 `REVIEWS` 上每一处声明它的取值 · 余下的 pin 测试文件（`pins-guard-closure.test.ts` 已在 Task 1 搬篇时退役，本任务只删剩下两份）· 受影响测试的 pin 面。文件 `pins.ts` 在此任务后不存在。

Task 5 已先走：`contract/census.ts` 的 `PinAudit` 类型 import 与 `census.guard.test.ts` 的引用文法臂都在那一轮离开，所以本任务收尾时全树 `contract/pins` 的零命中是可达的，而不是靠删记录凑出的零。

#### Files
- Delete: `packages/cdd-engine/src-next/contract/pins.ts`
- Delete: `packages/cdd-engine/src-next/contract/__tests__/pins.guard.test.ts`
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
- `pins.ts` 与余下两份 pin 测试文件从树上消失；全树 `contract/pins` 零 import，`Contract` / `invariants` / `lifecycle` / `cli` 零 pin 引用
- `CRITERIA_ROWS` 少一行（`pin-parseability`），`CriteriaFace` 的 `test` 取值随之无人使用并删除
- `ReviewGuides.pinLens` 与 `REVIEWS` 上每一处声明它的取值删除
- `review-criteria.test.ts` 的 id 名册收为删除后的集合、去掉 `test` 面断言、`pin-parseability` 的层级与反例句格子删；`templates.test.ts` 的 `pinLensOf` 三格删，其余留

#### Steps
- 删 `pins.ts` 并清 `Contract` / `invariants` / `lifecycle` / `cli` 的引用 — checkable: 全树 `grep -rn "contract/pins" packages/cdd-engine/src-next` 零命中（`contract/census.ts` 的类型 import 已在 Task 5 离开），`pnpm exec tsc --noEmit -p packages/cdd-engine` exit 0
- 删判据行与 `CriteriaFace` 的 `test` 取值 — checkable: `CRITERIA_ROWS` 的行名册不再含 `pin-parseability`；`review-criteria.test.ts` 按删除后的 id 集断言（成对：把该行加回 ⇒ 名册臂红）
- 删 `pinLensOf` 与 `ReviewGuides.pinLens` — checkable: `render/templates.ts` 上 `pinLens` 零命中，`templates.test.ts` 只余非 pin 臂且全绿
- 删余下两份 pin 测试文件（`pins-guard-closure.test.ts` 的成对夹具与构造点臂已在 Task 1 搬进 `closed-document.test.ts`）；`lifecycle.test.ts` 只退 pin 回读面 — checkable: 三份 pin 测试文件都不在树上；`face/__tests__/lifecycle.test.ts` 上「pin 回读语料注入」与「交接单 `contract.path` 解析」两个 describe 退役、其余全绿
- 提交 — checkable: `git log -1 --format=%s` 以 `refactor(p43):` 起头

#### Acceptance
pin 门的每一符号都已不在树上，而形状规则与闭合读数仍在生产（Task 1 的三条腿），`tsc` 与套件全绿。

#### DependsOn
Task 1, Task 5

### Task 5: census 比较机器退役，文法夹具分家

#### Objective
`contract/census.ts` 只留 `CensusGate.referencesOf` 这一个静态文法面（收成单静态类，带一行 `biome-ignore` 与理由，按仓库既有做法——先例是 `packages/cdd-engine/src-next/bin.ts` 的静态面），`censusTableOf` · `CensusTable` · `CensusDeps` · `CensusGate#report` 与四行 `pin.*` 登记一并删除。`contract/__tests__/census.guard.test.ts` 按面拆：语料臂与登记机器臂退役，引用文法臂搬进 `contract/__tests__/census-grammar.test.ts` 继续断言（占位符读作散文 · 小数与带后缀值读作散文 · 只读右值）。

#### Files
- Modify: `packages/cdd-engine/src-next/contract/census.ts`
- Delete: `packages/cdd-engine/src-next/contract/__tests__/census.guard.test.ts`
- Create: `packages/cdd-engine/src-next/contract/__tests__/census-grammar.test.ts`
- Modify: `packages/cdd-engine/src-next/contract/invariants.ts`

#### Consumes
- `contract/census.ts#CensusGate.referencesOf`（留下的文法面，`MeasureLiteralInvariant` 的跨度读在用）
- `contract/__tests__/census.guard.test.ts` 的引用文法臂（搬迁源）

#### Produces
- `contract/census.ts` 只剩 `referencesOf`（单静态类 + `biome-ignore` 行）；登记表与比较机器不存在，`PinAudit` 的类型 import 随四行 `pin.*` 登记一并离开该文件
- `contract/__tests__/census-grammar.test.ts`——三臂各自可红（占位符 · 小数与带后缀值 · 只读右值）
- `invariants.ts#MeasureLiteralInvariant` 的调用点不动（仍只读文法）

#### Steps
- 删登记表与比较机器，收 `CensusGate` 为单静态类 — checkable: `pnpm run biome` exit 0（单静态类落在 `biome-ignore` 之下）；`contract/census.ts` 上 `PinAudit` 零命中；成对：删掉那行 ignore ⇒ `biome check` 非零退出
- 搬文法臂到新文件 — checkable: `census-grammar.test.ts` 三臂全绿；把 `REFERENCE` 的终止符规则去掉再跑 ⇒ `3.5` 那一臂红
- 提交 — checkable: `git log -1 --format=%s` 以 `refactor(p43):` 起头

#### Acceptance
文法面仍在判、且能红；登记机器与语料臂消失；`biome` 与本任务 Files 涉及的套件全绿（`pins.guard` 的语料臂是 spec §8.4 的窗口红，由 Task 4 撤销）。

#### DependsOn
Task 1

### Task 6: 语料臂退役与夹具补位

#### Objective
撤掉「拿本仓 `docs/kairos/**` 跑一遍并断言零」的那一臂，判据本体与夹具留下：`doc-corpus.guard.test.ts` 与 `phase-inventory.guard.test.ts` 整文件退役；`charter-self-repair.test.ts` 撤宪章零 finding 那一臂；`single-create.test.ts` 撤读 `docs/kairos/plans` 的那一段；`packages/kairos/tests/grep-sweep-regression.test.ts` 的扫描根去掉 `docs/`。同批核对每条被撤臂的判据是否仍有违规/邻合/零候选三条臂，缺则本任务补：补位落在该规则臂的既有宿主文件；一条规则今天没有臂宿主时，本步骤点名要新建的夹具文件，并在同一次编辑里把它加进本任务的 Files——缺口不能以「未点宿主」被读成「无缺口」。

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
- 缺口补位：任一被撤语料臂涉及的规则，若其夹具缺「违规必报 / 邻居沉默 / 零候选即红」中的一条，本任务补上，宿主文件随之进本任务的 Files

#### Steps
- 删两个语料文件，收两份文件到夹具面 — checkable: 两路径不存在；`charter-self-repair.test.ts` 与 `single-create.test.ts` 不再读 `docs/kairos`，且全绿
- `grep-sweep` 去掉 `docs/` 根 — checkable: 该文件的扫描根上 `docs/` 零命中；成对：把一个已删 token 写进 `docs/` 下的文件 ⇒ 不红（扫面不含它），写进 `packages/` ⇒ 红
- 把 `seat` 的 `corpus` 面从词表与每一行上拿掉 — checkable: `contract/rules.ts` 上 `corpus` 零命中；`contract/__tests__/rules.test.ts` 的字面表只余树上真实存在的两个面（成对：把 `corpus` 加回词表而不加行 ⇒ 词表臂红；把它加回某一行 ⇒ 行臂红）
- 逐规则核对三条臂并补缺 — checkable: 对每条被撤语料臂涉及的规则各跑一次「违规夹具必报 / 邻居夹具沉默 / 零候选即红」——doc-contract 各腿 · P41 的 doc 形状行（`measure-literal` · `line-coordinate` · `live-arithmetic` · `single-home` · `change-history-date-shape`）· `single-create`；缺的那条补在该规则臂的宿主文件里，宿主不在 Files 时同一次编辑把它加进去
- 提交 — checkable: `git log -1 --format=%s` 以 `test(p43):` 起头

#### Acceptance
测试面不再有以本仓文档为语料的零断言，而每条规则的执行面仍在；发布面探针原样全绿。

#### DependsOn
Task 1

### Task 7: 记录面：引用删与数字改

#### Objective
把已闭合文档里随门退役的读数处理掉：P37 的 spec 与 plan 上 `census:pin.* = <n>` 形式的引用删除；P41 的两份文档在其「实现窗口」理由段里各有一句指向退役登记行的散文提及（spec 的窗口纪律段 · plan 的窗口预期红段与它全量门 checkable 里的那一句），这些句子连同句中的 `census:pin` 字面一并删除，同段其余句子与任何结论、裁定、交付记录逐字不动；带 `census:criteria.rows` 的声明改读删除 `pin-parseability` 之后的行数。散文提及本身不构成引用，也不在本任务的判据里：宪章的 D101 行 · Phase inventory 的 P43 行 · 变更史，以及本相位自己的 spec 与 plan，都把 `census:pin` 这个名字当作退役记录——不附等号与数字，文法从不解析它们，删它们属于改记录。不动任何结论、裁定或交付记录。

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
- 声明的语料上 `census:pin.*` 的引用零命中：引用指文法判定的形态（`census:<id> = <n>` · 点分小写 id · 十进制整数 · 终止符不是数字/字母/点）；不附等号与数字的散文提及留作退役记录，声明的文件集内外都允许存在
- P41 两份文档的「实现窗口」理由段里指向退役登记行的散文提及消失；只有那些句子被删，同段其余句子与两份文档上的结论、裁定、交付记录逐字未动
- 每处 `census:criteria.rows` 声明等于 `CRITERIA_ROWS` 删除后的行数
- `census:questions.rows` 与 `questions.cells` 原样未动

#### Steps
- 删 `census:pin.*` 的引用与 P41 的散文提及 — checkable: 按 `CensusGate.referencesOf` 的形态，声明的六份文件上 `census:pin` 的引用为零（成对：把一处带 `= 0` 的 `census:pin` 引用写回 P37 的 spec ⇒ 该臂红）；P41 两份文档上 `census:pin` 零命中，且两处理由段的其余句子逐字未动；宪章与本相位自己文档里的同一字面仍在、未被改写
- 改 `census:criteria.rows` 的声明数字 — checkable: 全库该 id 的声明值与 `CRITERIA_ROWS` 的实际行数相等（成对：把一处改回旧值 ⇒ 该断言红）
- 提交 — checkable: `git log -1 --format=%s` 以 `docs(p43):` 起头

#### Acceptance
记录面与树自洽：retired 的读数不再指向已撤的登记行，活着的行数声明读得出真值。

#### DependsOn
Task 4, Task 5

### Task 8: 生成物一致收归 `emit:check`

#### Objective
把两处读**渲染产物**的臂移出测试，交给 `emit:check`：`face/__tests__/diagrams.guard.test.ts` 里读 HTML 的那一格（tag 在场、退役 tag 不在场）与 `face/__tests__/diagram-twin.guard.test.ts` 里源↔产物的成对比较（覆盖与图型根 · 产物命名 · 两侧修订一致 · 引用多重集 · 文案逐格）。两文件的源内容臂与内存反向注入臂留下。

搬过去的三条读数各自成一条断言，落点 `scripts/lib/diagrams.ts`，两侧字面都从源读：源声明的 `tag` 落在该源渲染出的执行卡首行；源的 `retiredTag` 不在产物上；源的引用多重集与每个文案格（标签 · 副标 · tag · 卡片串）在产物里同多重、逐字在场。逐字节相等比的是「已提交产物 vs 同一份源的重渲染」，渲染器丢掉一条引用、一个标签或一个 tag 时两侧仍然相等——所以这三条不能由字节比对蕴含，必须并列声明；引用多重集与文案逐格正是因此留在 `emit:check` 而不回测试。

反向注入臂不读产物：本任务给它们一份内存里的 html 夹具（一段携带注入要动的元素的字符串），`diagram-twin.guard.test.ts` 因此一行 `docs/diagrams` 产物路径都不读。

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
- `scripts/lib/diagrams.ts` 的三条产物断言：源里的 `tag` 落在该源渲染出的执行卡首行 · 源的 `retiredTag` 不在产物上 · 源的引用多重集与每个文案格在产物里同多重、逐字在场——两侧字面从源读，与逐字节比对并列
- `diagrams.guard.test.ts` 只余源内容臂 + P28 T2 那一格；`diagram-twin.guard.test.ts` 只余内存反向注入臂，且它们的 html 来自内存夹具而不是已提交产物
- 两个测试文件不再读 HTML

#### Steps
- 把 HTML 读取与孪生比对搬进 `emit:check`，并把三条读数落成各自的断言 — checkable: 手改 `docs/diagrams` 里一份已提交产物、使其执行卡首行不含源声明的 `tag`，且渲染器产出同一份字节（篡改落在产物上、源随产物一起偏，不是「改源再重生成」那种两侧自洽的假红）⇒ `pnpm run emit:check` 非零退出；篡改一份生成的 `.claude-plugin` 文件 ⇒ 同样非零；同一处再让渲染器丢一条源的引用与一个文案格 ⇒ 引用多重集与文案逐格两条断言各自红；成对：把新加的断言去掉、重跑同一篡改 ⇒ 回到 exit 0（字节比对与已删的读取臂都接不住渲染器丢内容），把断言加回 ⇒ 红
- 从两份测试里删去读产物的臂，反向注入臂改用内存 html 夹具 — checkable: 两文件上 `docs/diagrams` 的 HTML 路径零命中；`diagram-twin.guard.test.ts` 的内存反向注入臂全绿，且把夹具里的源或格文案改一处 ⇒ 对应臂红
- 提交 — checkable: `git log -1 --format=%s` 以 `test(p43):` 起头

#### Acceptance
生成物一致只有一个执行面（`emit:check`），且它可红——渲染器丢 tag · 丢引用 · 丢文案格三种情形各有一条断言接住；测试只剩作者源的判据与内存注入。

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
| v0.3 | 2026-11-23 | **按 plan 评审轮一的 F1–F9 用户裁定修正**：Task 1 的 Files 收为自己的写集（`contract/pins.ts` 的收缩行 · `pins.guard.test.ts` 的重指 · `pins-guard-closure.test.ts` 整篇搬进 `closed-document.test.ts` 后的退役行），Objective 写死闭合面的目标拼写与 fallback 的闭合构造，两处假计数改成点名；Task 3 收 `notes-channel.test.ts` 的 board token 断言；Task 4 只删余下两份 pin 测试并写明 `contract/census.ts` 的 import 已由 Task 5 先清；Task 5 的 Produces 点明类型 import 离开；Task 7 的判据改成文法形态、散文提及留作记录；Task 8 的 checkable 换成两侧可辨的成对判据并点明 tag 断言的落点 | Oscaner M. · Claude（kairos:cdd-plan） |
| v0.4 | 2026-11-23 | **按 plan 评审轮二的 F1–F10 用户裁定修正**：Constraints 加「除 Task 10 外套件全绿按文件读」与 spec §8.4 的窗口；Task 1 改成给闭合访问者做加法（pin 访问者与两个读回语料留到 Task 4）、fallback 走 `contract/invariants.ts` 导出的默认索引读（`SlugIndex.build` 字面仍只一处）、Acceptance 按窗口读红；Task 2 收宪章的 D101 边界行（两个家同界）；Task 5 去掉假计数、Acceptance 按窗口读红；Task 6 点名缺口补位的宿主文件与逐规则清单；Task 7 点名 P41 的两处窗口理由段；Task 8 的篡改落在已提交产物、引用多重集与文案逐格并列成断言、反向注入臂改用内存 html 夹具 | Oscaner M. · Claude（kairos:cdd-plan） |
