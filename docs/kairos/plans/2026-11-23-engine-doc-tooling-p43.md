---
title: 'P43 · 引擎自证面退役：pin 按符号退、语料臂退、生成物归 emit:check、board 折叠'
doc-type: plan
version: v0.20
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
- **对已闭合文档只动随门退役的读数**：删 `census:pin.*` 的引用——文法判定的形态 `census:<id> = <n>`——把 `census:criteria.rows` 改成删除后的行数；P41 的两份文档上把退役登记行写成枚举成员的散文提及（spec 的 ② · plan 的两处），按 spec §2.2 就地把该成员删掉，并把枚举自己的计数与连接词折到剩下的成员上；除此之外，不带等号与数字的散文提及留作退役记录——宪章的 D101 行 · Phase inventory 的 P43 行 · 变更史，以及本相位自己的 spec 与 plan 是它们的家；变更史行里带等号的读数同样不改写，因为一行版本记录的是「当时写下了什么」，改它就等于把历史陈述改成从未发生的事；不动任何结论、裁定或交付记录（D22 窄反转）。
- **一对夹具优先于一次全语料扫描**：每条保留的规则付出的是违规/邻合/零候选三条臂，不是语料。
- **折叠只改打印，不改口径**：`notes +M` 的 M 与今天同源；board 不新增第三态。
- **除 Task 10 外，「套件全绿」按文件读**：窗口的账按文档记，不按固定的文件记——`pins.guard` 的语料臂读的是「本仓文档引用的符号 · 路径 · 测试题」，凡引用了树上不再承载的名字的文档都落在窗口内。窗口的成员就是该臂当次读数报出的那些文档，本段不列举：列举是一句未经度量的断言，而那份读数正是本相位要退役的东西；哪份文档为什么进窗口，归到拥有那次改动的任务里去说。所以从本相位文档落树到 Task 4 删掉那一臂之间，`pins.guard` 的语料臂恒红——那就是 spec §8.4 的窗口，不是回归。故除 Task 10 外，每个任务的「套件全绿」指本任务 Files 涉及的文件加上 `pnpm exec tsc --noEmit -p packages/cdd-engine`；语料臂的红按该窗口处理，只能由 Task 4 的删除撤销，绝不以改冻结文档消红。宪章那一处由 Task 2 就地改成散文（那行登记本就在它的写集里）。
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
把判据写进 `AGENTS.md` 的「Conventions not enforced by the formatter」节（英文，与宪章 D101 互为指针），三条要点各一行：测试只断言引擎对夹具做了什么；以本仓 `docs/kairos/**` 为语料并断言其状态是禁止的，并写出原因（误判会在文档里被静默修复，缺陷照发消费者）；每条规则保留三条臂（违规必报 · 邻居沉默 · 零候选即红），生成物一致只归 `emit:check`。同批把边界写明：README family · `AGENTS.md` · `marketplace/source.json` · `packages/kairos/skills/` · 生成物仍由探针守。宪章的「验自面的边界（D101）」一行今天还写着收窄前的边界（`docs/kairos/**` 与 README 类文档、生成物一致一起归为「不由测试断言」），同批把它改成同一句边界并指向 D101 的裁定行，两个家因此说同一件事。宪章上登记本相位的那行变更史也同批改一处写法：`ProseSpans` 被写在行内代码段里，而 pin 的语料臂把代码段当读数的来源，于是那个尚未落树的类名成了宪章替本相位付的窗口账——改成散文（与 spec 的窗口段同一种写法），搬运的四件事仍在那行里逐件读出。这不是改写记录：那一格写的是本相位的搬运计划，不是历史结论。

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
- 宪章 `## Change history` 里登记本相位的那一行，未落树的符号改写成散文（该行上它的代码段零命中），搬运的四件事仍逐件读得出；窗口的成员按文档记，本计划自己那几处未落树的符号只是其中一员
- 宪章的 Phase inventory 行上栅栏读者那一格读作**四个**公开成员（当时名为 `PinSpans` 的 `tokensOf` · `proseEntriesOf` · `proseOf` · `blankedOf`），与 spec §2.1 · Task 1 与树上的 `ProseSpans` 同构，不再作「两个入口」——登记行与前一位评审回填的 v4.63 行逐字对齐

#### Steps
- 在新节写下三条要点与边界 — checkable: 该节含「docs/kairos」字样与三条臂的枚举，且不含版本号与计数
- 与 D101 互指 — checkable: `docs/kairos/overalls/2026-10-10-engine-doc-tooling-overall.md` 的 D101 行与 `AGENTS.md` 该节各含对方的名字
- 对齐宪章的边界行 — checkable: 宪章 Boundary rules 上该行与 `AGENTS.md` 新节说同一条边界，两处都不枚举对方排除的语料（宪章不再写「README 类文档、生成物一致都不由测试断言」）；宪章 Change history 与 front-matter `version` 同批落行
- 把宪章登记行的代码段改成散文 — checkable: 宪章 `## Change history` 上登记本相位的那一行里 `ProseSpans` 的代码段零命中，而搬运的四件事（栅栏读者 · 闭合读数的枚举源 · 引用文法臂 · 单静态类的 `biome-ignore` 先例）仍逐件读得出；成对：把类名写回代码段 ⇒ 语料臂把它读成一处未落树的符号
- 提交 — checkable: `git log -1 --format=%s` 以 `docs(p43):` 起头

#### Acceptance
规范在册、可指认，且它描述的三条臂在 Task 6 之后可由树上判例读出（本节不自行立门）；宪章的边界行与本节的边界说同一件事，两个家不再各说一套；宪章的登记行不再拿行内代码段写一个未落树的符号，于是宪章那一处从窗口里离场；窗口的其余成员按文档记（本计划未落树的符号 · 按旧名引用的已闭合相位记录），成员由语料臂当次的读数给出，不在这里写死。

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
- Modify: `packages/cdd-engine/src-next/face/__tests__/cli.test.ts`
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
- `cli.test.ts` 的 CLI 级成对臂（照 `board --artifacts` 的先例）：一颗带 note 的载体经 `runArgv(["board", "--plan", …])` 走默认面只印 `notes +M`，`--notes` 时同一 token 追加正文字节 —— 参数读取（`parsed.args.notes`）与 `display` 经 `BoardView.render` 的逐点透传因此端到端可红，而不只是 `summaryCell` 的单测

#### Steps
- 加 `--notes` 通道行并接到 board — checkable: `cdd board --help` 出现 `--notes`，且不写 `--notes` 时不把正文打进输出
- 改 `#summaryToken` 的 notes 段为折叠/展开两支 — checkable: `board-view.test.ts` 三臂（默认零正文 · `--notes` 逐字节相等 · 段序逐字同序）各自可红：把展开支删掉 ⇒ 第二臂红；把计数挪出 token ⇒ 第三臂红
- 展开面仍走 `displayReason` 的一行折叠 — checkable: 一条含换行与 ` · ` 的 note 在 `--notes` 下仍是一行（成对：改用裸 `join` ⇒ 该臂红）
- 把 `session/__tests__/notes-channel.test.ts` 上按展开字节 pin 的 board token 断言改到折叠形态 — checkable: 该文件的默认臂只余 `notes +M`（正文零命中），`--notes` 臂逐字节等于改动前的原串；brief 渲染组断言未动且全绿；成对：把默认改回展开 ⇒ 默认臂红
- 在 `cli.test.ts` 补 CLI 级成对臂 — checkable: 默认臂断言 `notes +M` 且正文字节零命中，`--notes` 臂断言同一 token 追加正文；成对：把 `display` 写成常量折叠（不读 `parsed.args.notes`）⇒ `--notes` 臂红
- 提交 — checkable: `git log -1 --format=%s` 以 `feat(p43):` 起头

#### Acceptance
board 默认输出零 note 正文而计数在；`--notes` 展开的字节与改动前逐字相同；胶囊面零改动；`--notes` 的读取与 `display` 的透传由 `cli.test.ts` 的一条 CLI 级臂端到端判红，单测只覆盖 `summaryCell` 的一层不算数。

#### DependsOn
none

### Task 4: pin 门退役

#### Objective
在 Task 1 把生产腿搬走之后，把 pin 门本体整批删掉：`contract/pins.ts` 余下部分（`PinAudit` 的扫描与登记两半 · `PinIndex` · `PinSource` · `PinDeclarations` · `ForwardPaths` · `corpusOf` · `PinVocabulary` 的 pin 定义，含 `isPin` · `#isProduct` · 模板词表 · `testOf` · `memberOf` · `isSymbol`）· `pin-parseability` 判据行（连 `CriteriaFace` 的 `test` 取值）· `pinLensOf` 与 `ReviewGuides.pinLens` 字段与 `REVIEWS` 上每一处声明它的取值 · 余下的 pin 测试文件（`pins-guard-closure.test.ts` 已在 Task 1 搬篇时退役，本任务只删剩下两份）· 受影响测试的 pin 面——`face/__tests__/lifecycle.test.ts` 上 `P37 T6`（pin 回读语料注入真实 warn finding）与 `P37 T7`（pin 时间面在调用点读被审身份）两段 describe 整段退役，该文件其余的臂（评分门 · 载体完整性 · 胶囊标记 · dispatch 面）一字不动：它们判的是活着的面，整文件退役会是错的修法。文件 `pins.ts` 在此任务后不存在。

退役的不只是判据行本身：那个边界的名字还留在两处散文里——`CRITERIA_ROWS` 上方那段段注的 warn 档边界清单，与 `review-criteria.test.ts` 里逐名断言该清单的 `BOUNDARIES` 表。两处都不在产物上，故删掉判据行之后它们照旧全绿，却让判据表继续宣告一条已撤的边界；同批把名字从两处拿走，剩下的边界名仍逐名在位。

同一个缝在代码与散文里各宣告一次，故退场也按两条读，散文那半同样在本任务的写集里：`face/cli.ts` 上 `#audit` 的散文随符号收口——`RootMemo` 段注与命令边界的 memo 清单里它消失、清单自己的计数与连接词折到剩下的条目上（`four per-root memos` 不再读得通），pre-flight 那段不再要求闭合端口「点名本次调用的 pin audit」而去指闭合读数，`#auditOf` 的段注不再自称「那份物料的唯一构造点」；`contract/__tests__/review-criteria.test.ts` 的文件头不再把 `test` 取值说成「the pin gate」，那一处正是文件里既有的 `pin-parseability` grep 接不住的形态；散文半还有第三处，落在被搬走的那个读者自己的文件头上——`contract/markdown-spans.ts` 的模块段注把 `ProseSpans` 说成「形状文法、句子索引与 pin 扫描」共用的那一处行读，pin 门退役后它仍宣告一个没有读者的名字，同批把该句收成剩下的两个读者，`contract/__tests__/markdown-spans.test.ts` 的文件头同理（它把这份 span 清单说成 pin 模块的读法，收成「曾经由它读这道门」）。两半各判各的：符号零命中不代偿散文，反之亦然。散文半的三处各判各的，谁都不替另一处过关。

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
- Modify: `packages/cdd-engine/src-next/session/preflight.ts`（闭合端口段注里的 `audit accessor` 随符号收口改指闭合读数）
- Modify: `packages/cdd-engine/src-next/session/round-artifacts.ts`（`ArtifactRegistry.ownsName` 的唯一读者是 pin 门的「它是词表，不是可跟随的坐标」排除，随门退役而死，删除属本任务的收口）
- Modify: `packages/cdd-engine/src-next/contract/markdown-spans.ts`
- Modify: `packages/cdd-engine/src-next/contract/__tests__/markdown-spans.test.ts`
- Modify: `docs/diagrams/src/architecture.en.json`
- Modify: `docs/diagrams/src/architecture.zh-CN.json`
- Modify: `docs/diagrams/architecture.en.html`
- Modify: `docs/diagrams/architecture.zh-CN.html`

#### Consumes
- `contract/markdown-spans.ts#ProseSpans` · `contract/shape-rules.ts#PathShape` · `contract/closed-document.ts#ClosedDocument`（Task 1 已接走的三条腿）
- `contract/judge.ts#Contract.validate` 的第二实参（由 `ClosedDocument` 供给）

#### Produces
- `pins.ts` 与余下两份 pin 测试文件从树上消失；全树 `contract/pins` 零 import，`Contract` / `invariants` / `lifecycle` / `cli` 零 pin 引用
- `CRITERIA_ROWS` 少一行（`pin-parseability`），`CriteriaFace` 的 `test` 取值随之无人使用并删除
- `ReviewGuides.pinLens` 与 `REVIEWS` 上每一处声明它的取值删除
- `review-criteria.test.ts` 的 id 名册收为删除后的集合、去掉 `test` 面断言、`pin-parseability` 的层级与反例句格子删；`templates.test.ts` 的 `pinLensOf` 三格删，其余留
- `CRITERIA_ROWS` 上方段注的边界清单与 `review-criteria.test.ts` 的 `BOUNDARIES` 同批去掉 `the pin parseability gate`，那处 `lists all six boundary names` 的标题与计数读删除后的集合；其余边界名仍逐名断言（成对：整段重写时漏掉一个活着的边界名 ⇒ 该臂红）

#### Steps
- 删 `pins.ts` 并清 `Contract` / `invariants` / `lifecycle` / `cli` 的引用，符号那半与散文那半一起收 — checkable: 全树 `grep -rn "contract/pins" packages/cdd-engine/src-next` 零命中（`contract/census.ts` 的类型 import 已在 Task 5 离开），`pnpm exec tsc --noEmit -p packages/cdd-engine` exit 0；`face/cli.ts` 与 `contract/__tests__/review-criteria.test.ts` 上 `#audit` · `#auditOf` · `pinAudit` 零命中；`contract/markdown-spans.ts` 与 `contract/__tests__/markdown-spans.test.ts` 上 `pin` 零命中；两半各判各的——成对：只往 `RootMemo` 段注里写回一处 `#audit` 的指名（不写回任何字段）⇒ 散文半红而符号半照旧零命中；把 `#audit` 备忘写回而段注不动 ⇒ 符号半红而散文半不红；只把 `ProseSpans` 的段注写回成「与 pin 扫描共用」⇒ 该处臂红而符号半与另两处仍绿。谁都不替对方过关
- 删判据行、`CriteriaFace` 的 `test` 取值与它在两处散文里的名字 — checkable: `CRITERIA_ROWS` 的行名册不再含 `pin-parseability`；`review-criteria.test.ts` 按删除后的 id 集断言（成对：把该行加回 ⇒ 名册臂红）；`contract/review-criteria.ts` 与 `contract/__tests__/review-criteria.test.ts` 上 `pin parseability` 零命中，且其余边界名在两处仍逐名在位（成对：从段注里删掉一个活着的边界名 ⇒ 该臂红）
- 删 `pinLensOf` 与 `ReviewGuides.pinLens` — checkable: `render/templates.ts` 上 `pinLens` 零命中，`templates.test.ts` 只余非 pin 臂且全绿
- 删余下两份 pin 测试文件（`pins-guard-closure.test.ts` 的成对夹具与构造点臂已在 Task 1 搬进 `closed-document.test.ts`）；`lifecycle.test.ts` 只退 pin 回读面，即 `P37 T6` 与 `P37 T7` 两段 describe — checkable: 两份 pin 测试文件都不在树上；`face/__tests__/lifecycle.test.ts` 上 `P37 T6 — the pin read-back corpora inject real warn findings` 与 `P37 T7 — the pin time face reads the judged identity at the call site` 两段 describe 整段退役，该文件其余的臂（评分门 · 载体完整性 · 胶囊标记 · dispatch 面）一字不动且全绿
- 提交 — checkable: `git log -1 --format=%s` 以 `refactor(p43):` 起头

#### Acceptance
pin 门的每一符号都已不在树上，`face/cli.ts` · `contract/__tests__/review-criteria.test.ts` · `contract/markdown-spans.ts` 与 `contract/__tests__/markdown-spans.test.ts` 上也没有一句话再宣告被撤的那条注入（第三处的说法是那道门曾经由这份读者读过，不是它仍在树上读）；形状规则与闭合读数仍在生产（Task 1 的三条腿），`tsc` 与套件全绿。

#### DependsOn
Task 1, Task 5

### Task 5: census 比较机器退役，文法夹具分家

#### Objective
`contract/census.ts` 只留 `CensusGate.referencesOf` 这一个静态文法面（收成单静态类，带一行 `biome-ignore` 与理由，按仓库既有做法——先例是 `packages/cdd-engine/src-next/bin.ts` 的静态面），`censusTableOf` · `CensusTable` · `CensusDeps` · `CensusGate#report` 与四行 `pin.*` 登记一并删除。`contract/__tests__/census.guard.test.ts` 按面拆：语料臂与登记机器臂退役，引用文法臂搬进 `contract/__tests__/census-grammar.test.ts` 继续断言（占位符读作散文 · 小数与带后缀值读作散文 · 只读右值）。

散文那半与语料那半不同：`contract/invariants.ts` 的 `MeasureLiteralInvariant` 类段注把计数说成「由 census 登记表供给、由 `CensusGate` 比对」，而那两个构造物正是本任务退役的东西——段注同批改读成「这份读者经 `CensusGate.referencesOf` 读引用的形状」，判定语义、`evaluate` 的 gap 臂与 `#referenceSpans` 的跨度读一字不动，改的只是这段话说它自己怎么读。两半各判各的：符号零命中不代偿段注，反之亦然。

#### Files
- Modify: `packages/cdd-engine/src-next/contract/census.ts`
- Delete: `packages/cdd-engine/src-next/contract/__tests__/census.guard.test.ts`
- Create: `packages/cdd-engine/src-next/contract/__tests__/census-grammar.test.ts`
- Modify: `packages/cdd-engine/src-next/contract/invariants.ts`（`MeasureLiteralInvariant` 的类段注随比较机器收口，成对判法与写面见 Objective 与步骤；该类的调用点与判定语义不动）

#### Consumes
- `contract/census.ts#CensusGate.referencesOf`（留下的文法面，`MeasureLiteralInvariant` 的跨度读在用）
- `contract/__tests__/census.guard.test.ts` 的引用文法臂（搬迁源）

#### Produces
- `contract/census.ts` 只剩 `referencesOf`（单静态类 + `biome-ignore` 行）；登记表与比较机器不存在，`PinAudit` 的类型 import 随四行 `pin.*` 登记一并离开该文件
- `contract/__tests__/census-grammar.test.ts`——三臂各自可红（占位符 · 小数与带后缀值 · 只读右值）
- `invariants.ts#MeasureLiteralInvariant` 的调用点 · 判定语义与跨度读都不动（仍只读文法）
- `invariants.ts` 的 `MeasureLiteralInvariant` 类段注不再宣告登记表的供给与 `CensusGate` 的比对，改读成经 `CensusGate.referencesOf` 读引用形状；类里那条 finding 提示不在本任务的写集里——它讲的是那个值从哪来，不是这段被撤的断言

#### Steps
- 删登记表与比较机器，收 `CensusGate` 为单静态类 — checkable: `pnpm run biome` exit 0（单静态类落在 `biome-ignore` 之下）；`contract/census.ts` 上 `PinAudit` 零命中；成对：删掉那行 ignore ⇒ `biome check` 报出 `noStaticOnlyClass` 诊断（该规则在 recommended 预设下是 warning 级，退出码不变，故判据读诊断而不是退出码）
- 收 `MeasureLiteralInvariant` 段注的散文半 — checkable: `packages/cdd-engine/src-next/contract/invariants.ts` 上 `compared by` 与 `supplied by the census` 零命中，而 `CensusGate.referencesOf` 仍在位（类段注里说它读的是引用文法，`#referenceSpans` 的段注里说跨度读骑的就是这道文法）；`MeasureLiteralInvariant` 的 `evaluate` 与 `#referenceSpans` 一字不动，`pnpm exec tsc --noEmit -p packages/cdd-engine` exit 0；两半各判各的——成对：把 `compared by` 那半写回段注（不碰任何符号）⇒ 散文半红而符号半照旧零命中；把登记表与比较机器写回 `contract/census.ts` 而段注不动 ⇒ 符号半红而散文半不红。判据读的是被撤的那句断言，不是 `census registry` 这两个词本身——该类段注之外，类的 finding 提示仍要说清那个值从哪来
- 搬文法臂到新文件 — checkable: `census-grammar.test.ts` 三臂全绿；把 `REFERENCE` 的终止符规则去掉再跑 ⇒ `3.5` 那一臂红
- 提交 — checkable: `git log -1 --format=%s` 以 `refactor(p43):` 起头

#### Acceptance
文法面仍在判、且能红；登记机器与语料臂消失；`contract/invariants.ts` 的 `MeasureLiteralInvariant` 段注同批收口——它在 Files 里有主、在步骤里有判法，不再宣告登记表供给或 `CensusGate` 比对；`biome` 与本任务 Files 涉及的套件全绿（`pins.guard` 的语料臂是 spec §8.4 的窗口红，由 Task 4 撤销）。

#### DependsOn
Task 1

### Task 6: 语料臂退役与夹具补位

#### Objective
撤掉「拿本仓 `docs/kairos/**` 跑一遍并断言零」的那一臂，判据本体与夹具留下：`doc-corpus.guard.test.ts` 与 `phase-inventory.guard.test.ts` 整文件退役；`charter-self-repair.test.ts` 的第二个 describe 里两臂都读真宪章，按各自断言的东西点名分别处置：`reports nothing on the real charter — both families at zero` 那一臂在真宪章上断言零 finding，整臂退役；`reads measure-literal's candidate face — an unplaceable heading is a gap, not a silence` 那一臂只撤它的真宪章读取（`CHARTER_REL` 的 `readFileSync`，以及它对未改文本的 `gapsOf(text)` 零断言），量缺口的那一对重挂到邻臂已在用的 `charterBody([...])` 合成宪章上——两臂各自的真宪章读取都退役，留下的是合成宪章上的夹具；`measure-literal` 得保住那条把「干净的宪章」与「面从未跑过」分开的臂，缺口不随这次退役丢失，也不靠删臂消红；同一文件里 `single-home` 的右域同批收进夹具——那条「只留回填家族」的臂今天拿 `docs/kairos/**` 当真语料，它的绿就是在断言本仓四份文档仍写着回填句（它点名的那四位持有者只能来自真树），而它的绿恰好错在看起来像夹具：改为经判定上下文的 `fs` 缝注入本文件自建的语料（`__tests__/support/memory-fs.ts` 的 `MemoryFs`，与 `single-home.test.ts` 共用一处实现），臂保留「一次一个家族、按持有者点名」的可判，成对红补两条：改夹具里的一处句子 ⇒ 该家族少点名一位持有者；空语料 ⇒ 零 finding（绿来自夹具，不来自本仓文档树）；`single-create.test.ts` 撤读 `docs/kairos/plans` 的那一段；`packages/kairos/tests/grep-sweep-regression.test.ts` 的扫描根去掉 `docs/`。同批核对每条被撤臂的判据是否仍有违规/邻合/零候选三条臂，缺则本任务补：补位落在该规则臂的既有宿主文件；一条规则今天没有臂宿主时，本步骤点名要新建的夹具文件，并在同一次编辑里把它加进本任务的 Files——缺口不能以「未点宿主」被读成「无缺口」。

#### Files
- Delete: `packages/cdd-engine/src-next/contract/__tests__/doc-corpus.guard.test.ts`
- Delete: `packages/cdd-engine/src-next/contract/__tests__/phase-inventory.guard.test.ts`
- Create: `packages/cdd-engine/src-next/__tests__/support/memory-fs.ts`
- Modify: `packages/cdd-engine/src-next/contract/__tests__/charter-self-repair.test.ts`
- Modify: `packages/cdd-engine/src-next/contract/__tests__/single-home.test.ts`
- Modify: `packages/cdd-engine/src-next/contract/__tests__/single-create.test.ts`
- Modify: `packages/kairos/tests/grep-sweep-regression.test.ts`
- Modify: `packages/cdd-engine/src-next/contract/rules.ts`
- Modify: `packages/cdd-engine/src-next/contract/__tests__/rules.test.ts`
- Modify: `packages/cdd-engine/src-next/contract/__tests__/judge.test.ts`
- Modify: `packages/cdd-engine/src-next/contract/__tests__/shape-rules.test.ts`
- Modify: `packages/cdd-engine/src-next/contract/__tests__/change-history-header.test.ts`
- Modify: `packages/cdd-engine/src-next/contract/__tests__/rules-severity.test.ts`
- Modify: `packages/cdd-engine/src-next/session/__tests__/preflight-rows.test.ts`

#### Consumes
- `contract/judge.ts#Contract`（doc-contract 各腿的夹具入口）
- `contract/invariants.ts` 的形状规则类（`single-create` 与五条 P41 规则的既有夹具所在面）

#### Produces
- 两文件退役；两份文件只余夹具面且全绿
- `grep-sweep-regression` 的扫面不含 `docs/`，发布面（`packages/` · README family · `marketplace/source.json`）照旧
- 缺口补位：任一被撤语料臂涉及的规则，若其夹具缺「违规必报 / 邻居沉默 / 零候选即红」中的一条，本任务补上，宿主文件随之进本任务的 Files

#### Steps
- 删两个语料文件，收两份文件到夹具面 — checkable: 两路径不存在；`charter-self-repair.test.ts` 与 `single-create.test.ts` 上 `docs/kairos` 零命中（含 `CHARTER_REL` 的取值与 `REPO_ROOT` 拼出的真宪章路径），而两文件仍整文件在树上、全绿，非语料臂逐条留在原位且可红（`charter-self-repair.test.ts` 的 `single-home` 与 `measure-literal` 夹具臂照旧报它读的那一句，且 `single-home` 臂的绿只来自夹具：空语料 ⇒ 零 finding，改夹具一处句子 ⇒ 少点名一位持有者）；重挂后的缺口对成对可辨：把合成宪章的一处标题改成面图放不下的名字 ⇒ 那一臂报缺口，用它自己的合成体 ⇒ 零缺口
- `grep-sweep` 去掉 `docs/` 根 — checkable: 该文件的扫描根上 `docs/` 零命中；成对：把一个已删 token 写进 `docs/` 下的文件 ⇒ 不红（扫面不含它），写进 `packages/` ⇒ 红
- 把 `seat` 的 `corpus` 面从词表与每一行上拿掉 — checkable: `contract/rules.ts` 上 `corpus` 零命中；`contract/__tests__/rules.test.ts` 的字面表只余树上真实存在的两个面（成对：把 `corpus` 加回词表而不加行 ⇒ 词表臂红；把它加回某一行 ⇒ 行臂红）；两份以注入声明代行注册表的夹具（`rules-severity.test.ts` 的 `probeDeclaration` · `session/__tests__/preflight-rows.test.ts` 的 `markerRow`）同批改成两个面，`tsc` 于是仍是零错误
- 逐规则核对三条臂并补缺 — checkable: 对每条被撤语料臂涉及的规则各跑一次「违规夹具必报 / 邻居夹具沉默 / 零候选即红」——doc-contract 各腿 · P41 的 doc 形状行（`measure-literal` · `line-coordinate` · `live-arithmetic` · `single-home` · `change-history-date-shape`）· `single-create`；缺的那条补在该规则臂的宿主文件里，宿主不在 Files 时同一次编辑把它加进去。本轮实测的缺口与补位：`change-history-row-shape` · `change-history-version-unique` · `change-history-latest-matches-front-matter` 三条腿的零候选读数随 `doc-corpus.guard` 的 `reads change-history-row-shape's candidate face off the section heading` 一并退役，补在 `judge.test.ts` 的合成 plan 上（无 `## Change history` 表 ⇒ 解析出的表为空且规则零 finding；成对各自那条缺陷 ⇒ 恰一条）；`change-history-date-shape` 的候选面同样补在 `shape-rules.test.ts`（无表 ⇒ 零候选；成对非 ISO 日期单元 ⇒ 恰一条）；`change-history-header-columns` 的零候选臂原在 `change-history-header.test.ts` `is silent on a document with no Change-history section`，留下；五条 P41 形状行的零候选读数原是面图的 gap 臂（`shape-rules.test.ts` 的 `falls to the gap verdict when the face read carries no heading stack`），已在；`single-create` 的零候选读数是 `counts only path-shaped tokens` 那一臂，已在。`change-history-header.test.ts` 头部指向已删的 `doc-corpus.guard.test.ts` 的那句同批收成 `judge.test.ts` 一处
- 提交 — checkable: `git log -1 --format=%s` 以 `test(p43):` 起头

#### Acceptance
测试面不再有以本仓文档为语料的零断言，而每条规则的执行面仍在；发布面探针原样全绿。

#### DependsOn
Task 1

### Task 7: 记录面：引用删与数字改

#### Objective
把已闭合文档里随门退役的读数处理掉：P37 的 spec 与 plan 正文段上 `census:pin.* = <n>` 形式的引用删除（变更史行是例外，见后段）；P41 的两份文档上指向退役登记行的提及不是独立句子，而是三个枚举各自的成员——spec 的窗口纪律段里那个以「窗口内三条纪律」起头的枚举的 ②（`census:pin.total` 取活读数那一条）· plan 的窗口预期红段里「其一 / 其二」那一对的 `其二`（连它后面以「两者」收口的衔接句）· plan 全量门 checkable 里「两处预期红」那个括注中的 pin 半句。修法因此是就地改写枚举而不是整句删除：其余成员留下，只去掉退役读数那一半，并把枚举自己的计数与连接词折到剩下的成员上（spec 的「三条纪律」随 ② 的离场读成余下的两项 · plan 的「两者」「两处」收成剩下那一项的指代 · 括注的「两处预期红」收成唯一留下的那一处）；改写后每处仍读成一份完整清单（没有空位，也没有冒号后无项），同段其余句子与任何结论、裁定、交付记录逐字不动；正文段上带 `census:criteria.rows` 的声明改读删除 `pin-parseability` 之后的行数（变更史行同下段的例外）。声明若坐在一句构成句里——P37 的 spec §1.3 把判据表那几行的构成逐档点名——改的就不只是数字：数字改到删除后的行数，构成句改读成「本相位落笔时的表记」，被撤的那一行就地标成已随 pin 门撤除，其余成员、档位与结论逐字不动。既不删那个成员，也不把构成句整句删掉：删掉它，那句就读成判据表从未有过该行，等于把一份已闭合文档的记录改写成从未发生的事。

变更史是这条规则唯一的例外，而且例外的单位是那张表、不是整份文件：一行版本记录的是「当时写下了什么读数」，改写它就把已交付的记录改成从未发生的事——与 `.changeset/*` 是记录而不是坐标同一个理由。故本任务的可判只圈正文段：`## Change history` 表以外的带等号读数——`census:pin.*` 的引用与 `census:criteria.rows` 的声明——一律删净或改读删除后的行数，表内的读数原值保留、逐字不动。两个 id 共用同一条豁免：例外的单位是行，不是 id。受此例外的行按文档与版本点名，实现者不必自己去搜：`docs/kairos/plans/2026-11-16-engine-doc-tooling-p37.md` 的 `v0.20` · `v0.22` · `v0.23` 三行（`v0.23` 行内引用出现两次，两处都保留），`docs/kairos/specs/2026-11-16-engine-doc-tooling-p37-design.md` 的 `v0.19` 行与 `v0.13` 行。`v0.13` 行就是本段存在的那个案例：它记的是当时把裸计数改写成 `census:criteria.rows` 声明的那次读数，正文段的同一声明已改读删除后的行数，而这一行仍留当时的数。成对判据只随引用那一半写死：往 P37 文档的正文段写回一处带 `= 0` 的 `census:pin` 引用 ⇒ 该臂红；这些历史行原样留着 ⇒ 该臂不红，也不因此红。声明那一半不配成对臂——Task 5 之后树上没有任何面读它（见本任务步骤二），故它只按读数核，把它写成别的数既不红也不假装红。这条豁免不是本计划的发明：宪章的「不动任何结论、裁定或交付记录」与 spec §8.2 的全库归零在同一行上相遇时，前者胜——那行本身就是交付记录，行内容下的就是当时写下的读数，改它等于断言一件没发生过的事。散文提及本身不构成引用，也不在本任务的判据里：宪章的 D101 行 · Phase inventory 的 P43 行 · 变更史，以及本相位自己的 spec 与 plan，都把 `census:pin` 这个名字当作退役记录——不附等号与数字，文法从不解析它们，删它们属于改记录。不动任何结论、裁定或交付记录。

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
- 声明的语料上 `census:pin.*` 的引用零命中——引用指文法判定的形态（`census:<id> = <n>` · 点分小写 id · 十进制整数 · 终止符不是数字/字母/点），且零命中的范围是正文段，`## Change history` 表内的引用作为记录原值保留；不附等号与数字的散文提及留作退役记录，声明的文件集内外都允许存在
- P41 两份文档的「实现窗口」理由段上指向退役登记行的枚举成员消失，枚举的其余成员、计数与连接词随之折到剩下的项上，改写后仍是一份完整清单；同段其余句子与两份文档上的结论、裁定、交付记录逐字未动
- `## Change history` 表以外的每处 `census:criteria.rows` 声明等于 `CRITERIA_ROWS` 删除后的行数；声明坐在构成句里时该句改读成落笔时的表记，被撤的那一行标成已随 pin 门撤除，其余成员与结论逐字未动；表内 `v0.13` 行原值保留
- `census:questions.rows` 与 `questions.cells` 原样未动

#### Steps
- 删 `census:pin.*` 的引用与 P41 的三个枚举成员 — checkable: 按 `CensusGate.referencesOf` 的形态，声明的六份文件的正文段上（`## Change history` 表以外）`census:pin` 的引用为零，而表内引用逐字保留（成对：把一处带 `= 0` 的 `census:pin` 引用写回 P37 的 spec 正文段 ⇒ 该臂红；P37 plan 的 `v0.20` · `v0.22` · `v0.23` 行与 P37 spec 的 `v0.19` · `v0.13` 行原样留着 ⇒ 该臂不红）；P41 两份文档上 `census:pin` 零命中，两处理由段的其余句子逐字未动，且三处枚举改写后各自读成一份完整清单（无空位 · 无冒号后无项 · 衔接句的指代有项可指）；宪章与本相位自己文档里的同一字面仍在、未被改写；P37 的 spec §1.3 是一句构成句而不是一份清单，它的声明数字归下一步，而被撤的那一行在那句里只是散文提及（不带等号与数字），按本任务的散文条留作退役记录——那句的改法是把构成改读成落笔时的表记并把该行标注成已撤，不是删成员，判法见下一步
- 改 `census:criteria.rows` 的声明数字 — checkable: 全库范围内、`## Change history` 表以外的每处该 id 声明等于 `contract/review-criteria.ts#CRITERIA_ROWS` 删掉 `pin-parseability` 之后的行数——读一次该模块自己的度量，逐处核对写下的数（不另立比对臂：该声明唯一会红的机械对照是 `census.guard.test.ts` 的已闭合语料臂，Task 5 已先把它退役，本任务之后树上没有任何面能把它重判红，本步骤也不为此新造一门，故这一步只按读数核，不配成对臂）；声明坐在构成句里时（P37 的 spec §1.3）该句同批改读成落笔时的表记、被撤的那一行标成已随 pin 门撤除，其余成员与结论逐字不动——这一面同样只按读数核、不配机械臂，成对读作：把 §1.3 的构成句原样留着 ⇒ 该处读成判据表仍带 `pin-parseability`；表内 `v0.13` 行当时的数原样保留
- 提交 — checkable: `git log -1 --format=%s` 以 `docs(p43):` 起头

#### Acceptance
记录面与树自洽：retired 的读数不再指向已撤的登记行，活着的行数声明读得出真值。

#### DependsOn
Task 4, Task 5

### Task 8: 生成物一致收归 `emit:check`

#### Objective
把两处读**渲染产物**的臂移出测试，交给 `emit:check`：`face/__tests__/diagrams.guard.test.ts` 里读 HTML 的那一格（tag 在场、退役 tag 不在场）与 `face/__tests__/diagram-twin.guard.test.ts` 里源↔产物的成对比较（覆盖与图型根 · 产物命名 · 两侧修订一致 · 引用多重集 · 文案逐格）。两文件的源内容臂与内存反向注入臂留下。

搬过去的是孪生对的每一格，不留一格靠字节比对隐式接住：`scripts/lib/diagrams.ts` 上各落一条断言，除退役拼写那一格外，两侧字面都从源与暂存渲染读（不读已提交产物）——源声明的引擎节点 `tag` 落在该源渲染出的产物上（对应面是节点标记而不是执行卡首行：卡片首行携带的是 `detail` 散文，节点的 `tag` 从不写进那里，所以执行卡首行的读数仍作为源内容臂留在 `diagrams.guard.test.ts`）；退役拼写不在渲染里——这一格的两侧都不在源上：源 `docs/diagrams/src/*.json` 上 `retiredTag` 零命中，退役拼写今天是测试侧的字面（`diagrams.guard.test.ts` 的 `DiagramPin` 上 `retiredTag` 那一对，英文与中文各一条），搬过来时落成 `scripts/lib/diagrams.ts` 的一张字面表，与 `DIAGRAM_SRC_DIR` 派生的产品清单同住一个模块，断言读这张表与源的暂存渲染（退役拼写在渲染里零命中），不读任何源声明的字段；源 `meta.repository.revision` 等于产物证据块的 `repository.revision`；源的引用多重集与证据块的 `referenceCount` 同多重、同计数；源的每个文案格（标签 · 副标 · tag · 卡片串）以逐字或 HTML 转义后的形态在产物里在场，与 `DiagramTwin#copyMismatches` 同判——它的合同本就是 escaped-or-raw（`&#39;` 这类转义满足在场，带撇号的卡片串在干净树上正是这样通过的），所以这一格判的是「在场」而不是「字节相同」。覆盖与图型根、产物命名两格不另立断言：`emit:check` 既有的树比对接住多出来的或改名后的产物，`scripts/lib/diagrams.ts#DiagramProducts` 的孤儿走读接住不再产出的 html。逐字节相等比的是「已提交产物 vs 同一份源的重渲染」，渲染器丢掉一条引用、一个标签或一个 tag，或不再把 `meta.repository.revision` 抄进证据块时，两侧仍然相等——所以修订一致、引用多重集与文案逐格都不能由字节比对蕴含，必须并列声明；它们正是因此留在 `emit:check` 而不回测试。

反向注入臂不读产物：本任务给它们一份内存里的 html 夹具（一段携带注入要动的元素的字符串），`diagram-twin.guard.test.ts` 因此一行 `docs/diagrams` 产物路径都不读。

#### Files
- Modify: `packages/cdd-engine/src-next/face/__tests__/diagrams.guard.test.ts`
- Modify: `packages/cdd-engine/src-next/face/__tests__/diagram-twin.guard.test.ts`
- Modify: `scripts/lib/diagrams.ts`
- Modify: `scripts/run.ts`
- Modify: `scripts/emit.ts`（`emitAll` 把本轮暂存对交回来，一条渲染喂写回与断言两处）
- Modify: `scripts/__tests__/diagrams.test.ts`

#### Consumes
- `scripts/lib/diagrams.ts#DiagramProducts`（重渲染后比对，`emit:check` 的既有路径）
- `scripts/run.ts` 的 `emit:check` 分支（新断言落点）

#### Produces
- `emit:check` 覆盖生成物面：`.claude-plugin/` 与 marketplace 的派生、ISSUE_TEMPLATE、`docs/diagrams` 的源↔产物（含孪生对）；孪生对的覆盖与图型根、产物命名两格由既有的树比对与 `scripts/lib/diagrams.ts#DiagramProducts` 的孤儿走读接住
- `scripts/lib/diagrams.ts` 的产物断言逐格一条：源里的引擎节点 `tag` 落在该源渲染出的产物上（节点标记在场） · 模块里那张退役拼写字面表在源的暂存渲染里零命中（源上无此字段：源侧是字面表，产物侧是暂存渲染，测试侧的 `DiagramPin` 字面随这一格搬出去） · 源的 `meta.repository.revision` 等于产物证据块的 `repository.revision` · 源的引用多重集与证据块的 `referenceCount` 同多重、同计数 · 源的每个文案格以逐字或 HTML 转义后的形态在产物里在场（与 `DiagramTwin#copyMismatches` 同判，不是字节相同）——除退役拼写那一格外，两侧字面从源与暂存渲染读，与逐字节比对并列；执行卡首行不是 `tag` 的对应面，它的读数留在 `diagrams.guard.test.ts` 的源内容面
- `diagrams.guard.test.ts` 只余源内容臂 + P28 T2 那一格；`diagram-twin.guard.test.ts` 只余内存反向注入臂，且它们的 html 来自内存夹具而不是已提交产物；产物读者 `DiagramTwin.of` 与它的源清单 `DiagramTwin.SOURCES` 一并离场——搬走的那几段是它们仅有的调用者，留下任何一处就是文件里还开着已提交产物的读法
- 两个测试文件不再读 HTML

#### Steps
- 把 HTML 读取与孪生比对搬进 `emit:check`，并把各格读数落成各自的断言 — checkable: 判据只从注入的渲染输出读——往 `scripts/lib/diagrams.ts#DiagramProducts` 注入一份 stub 渲染，让它的产物缺掉源声明的引擎节点 `tag`（或让渲染里带上字面表列的退役拼写 · 丢掉一条源引用 · 改掉一个文案格 · 把证据块的 `repository.revision` 写成源之外的值），那一格各自报红；同一份源配一份照源渲染的 stub ⇒ 各格沉默（成对）。篡改已提交产物这条路走不通：`emit:check` 会用源重新渲染并覆盖它，字节比对在前一格就先红，所以这一层只能由注入的渲染输出判；把新加的任一格断言去掉、重跑同一份 stub ⇒ 该格回到沉默，加回 ⇒ 红。逐格断言读的只能是注入的渲染输出，而树比对那一面由篡改判红：篡改一份已提交的 `.claude-plugin` 文件 · 一处 `docs/diagrams/src/*.json` 源 · 一份 `.github/ISSUE_TEMPLATE/*.yml` 表单，三者各使 `pnpm run emit:check` 非零退出（每次改完还原）——表单与架构产物同列在 `EmitService` 收进 `generatedPaths` 的生成路径里，`EmitComparer.compareTrees` 逐条字节比对，源一改，重渲染的产物就与已提交的那份不同
- 从两份测试里删去读产物的臂，反向注入臂改用内存 html 夹具 — checkable: 判据按机制判、不按拼写判——`diagram-twin.guard.test.ts` 上 `DiagramTwin.of` 与 `DiagramTwin.SOURCES` 零命中（产物读者离场，没有一处调用它），`meta.output` 的读法零命中（`of` 取值走这条，路径字面从来不是它的形态），存活的每条反向注入臂都用 `DiagramTwin.withSource` 拿一份内存 html 与自己构造的源配对；`docs/diagrams` 的 HTML 路径字面零命中只作副证，不作证明；`diagram-twin.guard.test.ts` 的反向注入臂全绿，且把夹具里的源或格文案改一处 ⇒ 对应臂红
- 提交 — checkable: `git log -1 --format=%s` 以 `test(p43):` 起头

#### Acceptance
生成物一致只有一个执行面（`emit:check`），且它可红——渲染器丢 tag · 丢引用 · 改文案格 · 把证据块的修订写成源之外的值，各有一条断言接住；同一道门的树比对那一面也按 spec 的生成物面逐面判红——`.claude-plugin/` 的派生 · `docs/diagrams/src/*.json` 的源 · ISSUE_TEMPLATE 的表单各拿一处篡改，`emit:check` 各自非零退出，于是它接住的不只是孪生对的格，还有 Produces 声明的生成物面；测试只剩作者源的判据与内存注入。

#### DependsOn
Task 6

### Task 9: `selector-coverage` 换合成物料

#### Objective
把 `contract/__tests__/selector-coverage.test.ts` 的夹具从本仓文档换成按四种 doc-type 各一份的合成合规文档（住 `contract/__tests__/fixtures/`），判定与格题一字不改。合成文档必须过 doc-contract（与消费者文档同判，无豁免），字段名与结构由四种类型的骨架派生。判定的**右域**同批收进夹具：`single-home` 扫的邻域经判定上下文的 `fs` 缝注入本文件自持的内存语料（`__tests__/support/memory-fs.ts` 的 `MemoryFs`，其余三份载体按各自 doc-type 的 doc root 挂载、各带自己的 slug），于是「零 finding」是本文件写下的语料的性质，而不是本仓 `docs/kairos/**` 的性质。

同一文件的**文件头**也在本任务的写集里：那句点明四张登记表总体规模的括注数目，读的正是 `declaredRegistries[type].elements.length` 的合计——与判定自己在两处断言里量的总体同源——而不是落笔那一刻抄下的旧读数。判定与格题仍一字不改，改的只是文件头对同一个总体的点名。

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
- 判定的右域住本文件：`single-home` 的邻域是注入的内存语料（其余三份载体），全文件零处把判定指向 checkout；把一份载体的判据句写进语料里另一份 ⇒ 读那一格红，语料原样 ⇒ 零 finding
- 文件头的总体数与判定同源：文件头那句 `the four registries (… rows)` 的括注数目等于四类 `declaredRegistries[type].elements.length` 的合计，与同文件断言正在量的总体是同一个数；把括注写成一个与合计不符的邻值 ⇒ 该臂红

#### Steps
- 生成四份合成物料并自证 — checkable: 对四份各跑一次 doc-contract，零 finding
- 把 `selector-coverage` 的夹具指向它们 — checkable: 每表每 selector 在各自类型的物料上解析成功；把一份物料的字段名改错 ⇒ 该臂红
- 把右域收进内存语料 — checkable: 该文件的全契约臂与 domain 臂都带 `fs` 注入（`root` 仍指仓库根，只作路径坐标），临时在 `docs/kairos/**` 下放一份写着某载体判据句的文档 ⇒ 该套件照旧全绿；把同一句写进注入的语料里另一份 ⇒ `single-home` 那一格红
- 让文件头的总体数与判定同源 — checkable: 先按四类 `declaredRegistries[type].elements.length` 求出合计，再读文件头括注里的数目，两者相等；把括注里的数目写成一个与合计不符的邻值 ⇒ 该臂红
- 提交 — checkable: `git log -1 --format=%s` 以 `test(p43):` 起头

#### Acceptance
selector 的解析证明不再依赖本仓文档，且物料自己在判据之下；文件头的总体数与判定自己量的合计同源；删一条 selector 仍能红。

#### DependsOn
Task 6

### Task 10: changeset 与全量门

#### Objective
收口：把本相位早已在册的那份 changeset 补成完整的一份（消费面字节变化：判据行少一条、prompt 少一段 lens、`cdd board` 的默认输出变化、生成物比对归口变化），并跑全量门。本相位只此一份 note——再写一份就是把同一个相位从两个不完整的角度各说一遍，而树上那份的「pin 门没有任何消费面字节变化」在 Task 4 删掉判据行与 lens 之后已经与发布的字节相反。

#### Files
- Modify: `.changeset/p43-self-assertion-retirement.md`
- Modify: `docs/kairos/plans/2026-11-23-engine-doc-tooling-p43.md`

#### Consumes
- 全量门的既有入口 `pnpm run validate`（本任务只跑不改）
- 变更史纪律（`.changeset/README.md` 的级别判据）
- 树上已有的 `.changeset/p43-self-assertion-retirement.md`（本轮之前由 `chore(p43): declare the engine's minor for the board notes fold` 建立，本任务扩写它而不是另起一份）

#### Produces
- 本相位的一份 minor changeset（就是树上那份 note），摘要点名四处消费面变化，且不再声称 pin 门字节未动
- 计划文档的变更史追加一行（本任务的收口读数）

#### Steps
- 收齐 changeset — checkable: 合 `changeset-levels.test.ts` 的级别判据（非 `major`），且摘要含四处消费面变化；`.changeset/` 下本相位的 note 只有一份（出现第二份即缺陷），与已落地字节矛盾的那句随本次编辑删掉
- 跑全量门 — checkable: `pnpm run validate` exit 0
- 提交 — checkable: `git log -1 --format=%s` 以 `chore(p43):` 起头

#### Acceptance
`validate` 全绿；本相位只有一份 changeset、在册且级别为 minor，摘要覆盖四处消费面变化；本相位的十项任务全部落地。

#### DependsOn
Task 1, Task 2, Task 3, Task 4, Task 5, Task 6, Task 7, Task 8, Task 9

### Task 11: `measure-literal` 整条退出

#### Objective
分支终评之后追加的工作项（用户裁定）：登记表随 `pin.*` 四行退役之后，`measure-literal` 要求的 `census:` 形态已无人比对——写一个荒唐的值也过——而实测里出错的一直是「数对不上指称物」那一类（数字改了枚举没改 · 文件头的种群计数过期 · 历史行的读数被当活引用），它一条都抓不到。要求形态而无值可核的规则与 pin 门同族，故整条退出：`contract/invariants.ts` 的 `MeasureLiteralInvariant` 与它的 token 文法、量词词表一并删除；`contract/rules.ts` 的规则行删除；`contract/census.ts` 整个模块随它唯一的读者消失；`contract/__tests__/census-grammar.test.ts` 删除。

撤一条规则撤的是三张面，缺一面留下的就是「声明活得比机制长」：**执行面**（登记行 · 判据本体 · 它读的常量）· **教学面**（两个 authoring 节点的 `count` 造句 · `#docNarrativeAxes` 的评审正文与它的段注 · `#DOCS_FIX_SHAPE_RULES` 的点数词与清单）· **断言面**（钉住那几处句子的探针与读该族读数的夹具）。该 id 在这三张面上的每一处都归本任务，一处不留——`contract/rules.ts` 的登记表头与 `skipWhenClosed` 列注释、`contract/invariants.ts` 的 `ProseWalk` 与 `ProseFace` 两处头注释、`contract/__tests__/shape-rules.test.ts` 的文件头与两条 describe 标题同在这张面上，交付时删掉那个数目并指回 spec §4.2 的名册，不就地重新推导。P41 的形状门只余 `RULE_REGISTRY` 里留下的那几条形状行，其余一字不动；本任务不在任何一处写下那个数目，名册与各臂的归属住 spec §4.2。

缺口读数随该行改挂到留在册的形状行 `line-coordinate`，这不是顺带的收尾而是退役的一半：`MeasureLiteralInvariant.evaluate` 是全树唯一调 `ProseFace.gaps` 的地方，而缺口读数按规则名落 finding——删掉那个调用者而不接管，形状门就同时失去它唯一的零候选臂，「脸读不出任何声明面」与「文档干净」从此是同一个答案。故 `LineCoordinateInvariant.evaluate` 起调 `ProseFace.gaps(ctx, this.name)`，自己的违规臂照旧：一份文档的脸读不出任何声明面时报一条 kind 为 `line-coordinate` 的缺口 finding，同一份正文放到已登记的小标题下则沉默。接手的是这一行本来的职责，不是给规则加的新读数——判据语义未动。

本任务同时接过两处先前任务的交付面，因为那两处在各自的块闭合之后才被读出与树不符：`.changeset/p43-self-assertion-retirement.md` 的 census 段（Task 10 已闭合——该段声称 `contract/census.ts` 只留引用文法，而本任务把这个模块整个删掉，且摘要从未点名 `count` 造句的退役）· `contract/__tests__/selector-coverage.test.ts` 的文件头括注（Task 9 已闭合——它声称括注在本任务的写集里，而交付的文件头仍停在旧读数）。闭合任务的文字是交付记录，不回头重写；两处由本任务接管并在 Objective 里记为对那两块文字的取代。

已闭合文档里的 `census:` 声明不做任何迁移：没有判据读它们，也就没有「与登记面不符」这回事。文档里的测量数字从此只剩写作纪律与评审，这是 spec §4.2 登记的代价。

#### Files
- Delete: `packages/cdd-engine/src-next/contract/census.ts`
- Delete: `packages/cdd-engine/src-next/contract/__tests__/census-grammar.test.ts`
- Modify: `packages/cdd-engine/src-next/contract/invariants.ts`（规则类与它读的两个常量删除；`LineCoordinateInvariant.evaluate` 接手 `ProseFace.gaps`；`ProseWalk` 与 `ProseFace` 两处头注释与文件头的形状门头注释按留下的名册重述，不写数目）
- Modify: `packages/cdd-engine/src-next/contract/rules.ts`（删 `measure-literal` 行；登记表头的计数分句与 `skipWhenClosed` 列注释改指 spec §4.2 的名册）
- Modify: `packages/cdd-engine/src-next/contract/__tests__/rules.test.ts`（删该 id 的席位行；两处写死读数改成从登记表自身取，夹具不留第三个数目）
- Modify: `packages/cdd-engine/src-next/contract/__tests__/shape-rules.test.ts`（`SHAPE_RULE_IDS` 去 id、绑定该规则的 `measure` 辅助与以它为读法的 describe 删除；`unmapped` 那条缺口臂改挂 `line-coordinate` 的 describe 并断言它的 kind；文件头与两条 describe 标题按留下的名册重述）
- Modify: `packages/cdd-engine/src-next/render/templates.ts`（`#docNarrativeAxes` 的正文与它上方的段注 · `#DOCS_FIX_SHAPE_RULES` 的点数词与清单 · 它上方的段注）
- Modify: `packages/cdd-engine/src-next/render/__tests__/templates.test.ts`（`VOLATILE_FACT_ANCHORS` 的锚点换成改读后那句的稳定片段 · `SHAPE_RULE_IDS` 去 id · 文件头注释改读）
- Modify: `packages/cdd-engine/src-next/contract/__tests__/charter-self-repair.test.ts`（读该族的臂与 `single-home` 臂里断言该 id 的零读数删除，P41 的缺口 describe 留下换 kind，文件头注释改读）
- Modify: `packages/cdd-engine/src-next/face/__tests__/cli.test.ts`（P41 T5 两格的载体换成 `line-coordinate`，断言面逐字同形）
- Modify: `packages/cdd-engine/src-next/session/__tests__/fix-round-gate.test.ts`（`MEASURE` 与 `MEASURE_OTHER` 两份夹具改写成 `line-coordinate` 的违规并改名、措辞断言随新报文、手写 baseline 取同一条在册行）
- Modify: `packages/cdd-engine/src-next/contract/__tests__/selector-coverage.test.ts`（文件头括注的数目取四类 `declaredRegistries[type].elements.length` 的合计，并配成对臂；Task 9 的同一句由本任务接管）
- Modify: `packages/kairos/skills/cdd-spec-writer/SKILL.md`（`author-spec` 节点的 `count` 行按 spec §4.1 落定的那一句改写）
- Modify: `packages/kairos/skills/cdd-plan/SKILL.md`（`author-plan` 节点的 `count` 行同批，与上一条逐字相同）
- Modify: `packages/kairos/tests/claim-shapes.test.ts`（`RULE_IDS_BY_SHAPE.count` 去 id，合法形态臂反转为要求那句说出没有这样的登记表）
- Modify: `.changeset/p43-self-assertion-retirement.md`（census 段按模块的实际命运改写，摘要点名 `count` 造句的退役）

#### Consumes
- `contract/rules.ts#RULE_REGISTRY` 的 `measure-literal` 行（登记面的删除对象）与它留下的形状行（改名册的唯一来源）
- `contract/invariants.ts#MeasureLiteralInvariant` 与其 token 文法、量词词表（判据本体），以及它 `evaluate` 里那一处 `ProseFace.gaps` 调用（接手的对象）
- `contract/invariants.ts#ProseFace.gaps` 与它读的 `ProseWalk`（零候选臂的唯一来源）
- `contract/__tests__/shape-rules.test.ts` 的该规则臂与 `contract/__tests__/rules.test.ts` 的 id 字面表（两条夹具面）
- `render/templates.ts#docNarrativeAxes` 与 `#DOCS_FIX_SHAPE_RULES` · 两份 authoring 节点 · `packages/kairos/tests/claim-shapes.test.ts` 的三条探针（教学面与断言面）
- spec §4.1 落定的那一句（教学面四处逐字同句的唯一依据）与 spec §4.2 的名册（不写数目的依据）
- 树上已有的 `.changeset/p43-self-assertion-retirement.md`（Task 10 的交付，本任务改写的对象）与 `selector-coverage.test.ts` 的文件头（Task 9 的交付）

#### Produces
- `contract/census.ts` 从树上消失；`contract/invariants.ts` 上 `CensusGate` 与 `measure-literal` 零命中
- `RULE_REGISTRY` 的 doc 规则少一行，字面表与登记面同批收准
- `shape-rules.test.ts` 的形状行臂与 `RULE_REGISTRY` 里留下的形状行一一对应，且各自可红
- 形状门的零候选臂仍在：`ProseFace.gaps` 的读者是 `LineCoordinateInvariant.evaluate`，它落的 finding kind 是 `line-coordinate`
- 教学面三处同句、写作约束只列留下的形状行；断言面不红在一条已不在树上的规则上
- 本任务接过的两处交付面就位：changeset 不再声称 `contract/census.ts` 幸存、摘要点名 `count` 造句；`selector-coverage.test.ts` 的文件头括注与它自己量的合计同源
- 全树没有一条判据读 `census:` 形态

#### Steps
- 删规则行与判据本体，并把缺口读数交给 `line-coordinate` — checkable: `grep -rn "measure-literal" packages/cdd-engine/src-next` 零命中；`LineCoordinateInvariant.evaluate` 调 `ProseFace.gaps(ctx, this.name)`；`pnpm exec tsc --noEmit -p packages/cdd-engine` exit 0。成对两向：把 `ProseFace.gaps` 那一行从 `LineCoordinateInvariant.evaluate` 里删掉、其余一字不动 ⇒ 缺口臂红（一份文档的脸读不出任何声明面时，门只剩沉默），其余形状臂照旧全绿；把 `MeasureLiteralInvariant` 的 `evaluate` 单独写回而不恢复它的登记行 ⇒ 该读数落在一个没有声明的 kind 上，缺口臂红
- 删 `census.ts` 与文法夹具 — checkable: 两个路径不存在；全树 `CensusGate` 零命中（成对：把 `referencesOf` 的任何调用加回 ⇒ 该 grep 红，因为模块已不在）
- 收准字面表与留下的形状臂，读数从表自身取 — checkable: `rules.test.ts` 的 id 表与 `RULE_REGISTRY` 逐 id 对齐，登记表长度与两条 scope 的过滤结果互相比对，夹具里不留第三个写死的数目（成对：往 `RULE_REGISTRY` 加一行而夹具不动 ⇒ 该臂红，因为每一处断言比的都是表自己产出的值）；`shape-rules.test.ts` 的形状行臂与登记表里留下的形状行同集且各自可红（成对：删任一条臂的违规夹具 ⇒ 该条失去执行面，字面表的 drop 臂红）
- 改读教学面与它的探针 — checkable: 两个 authoring 节点的 `count` 行 · `#docNarrativeAxes` 的正文 · `VOLATILE_FACT_ANCHORS` 取的稳定片段逐字同句，且与 spec §4.1 落定的那一句一致；`#DOCS_FIX_SHAPE_RULES` 只列 `RULE_REGISTRY` 里留下的形状行、点数词与那份清单逐项对齐；`claim-shapes.test.ts` 的合法形态臂要求那句 `no census registry exists`（成对：把 `count` 行写回 `census:<id> = <n>` 的形态 ⇒ 该臂红）；处置面（夹具 · 模板 · 两个 skill 节点 · 登记行 · 各处头注释）上一次只圈这些路径的 `rg` 对该 id 零命中，两份 `CHANGELOG.md` 的发行史与 `docs/kairos/**` 的退役记录不在此列
- 补齐两处已闭合任务的交付面 — checkable: changeset 里 `contract/census.ts` 那一段说的是它被删除、摘要点名 `count` 造句的退役；`selector-coverage.test.ts` 的括注等于四类 `declaredRegistries[type].elements.length` 的合计（成对：把括注写成一个与合计不符的邻值 ⇒ 该臂红）
- 提交 — checkable: `git log -1 --format=%s` 以 `refactor(p43):` 起头

#### Acceptance
形状门只按 `RULE_REGISTRY` 里留下的形状行在册、各自可红，整门的零候选臂仍有一条且由 `line-coordinate` 承担（一份文档的脸读不出任何声明面时报一条 kind 为 `line-coordinate` 的缺口 finding，同一份正文放到已登记的小标题下则沉默）；`census:` 不再有任何读者，处置面上该 id 的读取为零，教学面四处与探针同句且不红在一条已不在树上的规则上；changeset 与 `selector-coverage.test.ts` 两处补写就位；`pnpm run validate` exit 0。

#### DependsOn
Task 4, Task 5

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-11-23 | 初稿（cdd-plan 会话）：按 spec v0.7 的九节拆为十任务五波——三条生产腿搬家 · AGENTS.md 规范 · board 折叠 · pin 门退役 · census 文法分家 · 语料臂退役与夹具补位 · 记录面引用 · 生成物归 `emit:check` · selector 合成物料 · changeset 收口 | Oscaner M. · Claude（kairos:cdd-plan） |
| v0.2 | 2026-11-23 | **按 spec 评审轮四的 F1–F4 修正任务面（spec v0.9）**：Task 1 补 `single-create.test.ts` 的重指与路径归一化的归属（`PinIndex.normalize` 随路径文法搬）；Task 4 补 `lifecycle.test.ts` 的两个 pin 回读 describe；Task 6 收掉 `seat` 的 `corpus` 幻面（词表与 33 行 + `rules.test.ts` 字面表同批） | Oscaner M. · Claude（kairos:cdd-plan） |
| v0.3 | 2026-11-23 | **按 plan 评审轮一的 F1–F9 用户裁定修正**：Task 1 的 Files 收为自己的写集（`contract/pins.ts` 的收缩行 · `pins.guard.test.ts` 的重指 · `pins-guard-closure.test.ts` 整篇搬进 `closed-document.test.ts` 后的退役行），Objective 写死闭合面的目标拼写与 fallback 的闭合构造，两处假计数改成点名；Task 3 收 `notes-channel.test.ts` 的 board token 断言；Task 4 只删余下两份 pin 测试并写明 `contract/census.ts` 的 import 已由 Task 5 先清；Task 5 的 Produces 点明类型 import 离开；Task 7 的判据改成文法形态、散文提及留作记录；Task 8 的 checkable 换成两侧可辨的成对判据并点明 tag 断言的落点 | Oscaner M. · Claude（kairos:cdd-plan） |
| v0.4 | 2026-11-23 | **按 plan 评审轮二的 F1–F10 用户裁定修正**：Constraints 加「除 Task 10 外套件全绿按文件读」与 spec §8.4 的窗口；Task 1 改成给闭合访问者做加法（pin 访问者与两个读回语料留到 Task 4）、fallback 走 `contract/invariants.ts` 导出的默认索引读（`SlugIndex.build` 字面仍只一处）、Acceptance 按窗口读红；Task 2 收宪章的 D101 边界行（两个家同界）；Task 5 去掉假计数、Acceptance 按窗口读红；Task 6 点名缺口补位的宿主文件与逐规则清单；Task 7 点名 P41 的两处窗口理由段；Task 8 的篡改落在已提交产物、引用多重集与文案逐格并列成断言、反向注入臂改用内存 html 夹具 | Oscaner M. · Claude（kairos:cdd-plan） |
| v0.5 | 2026-11-23 | **按 plan 评审轮三的 F1–F4 用户裁定修正**：Constraints 的窗口账改成按文档记（本计划付引用 · 宪章的回填行带一处 · spec 按 §2.1 写散文不带），Task 2 同批把宪章登记行的行内代码段改成散文；Task 4 收两处散文里的退役边界名（段注的边界清单与 `BOUNDARIES` 的逐名断言）；Task 7 的 P41 修法从「删句子」改成「就地改写枚举」（三个枚举各留其余成员，计数与连接词折到剩下的项，改写后仍读成完整清单）；Task 8 把孪生对的修订一致格补成自己的断言（源 `meta.repository.revision` 对产物证据块），覆盖与图型根 · 产物命名两格明写由树比对与孤儿走读接住 | Oscaner M. · Claude（kairos:cdd-plan） |
| v0.6 | 2026-11-23 | **记录 `a611459d` 的 Task 3 补写（本行追登）并应用 plan 评审轮四的 F1–F6 用户裁定**：Task 3 的写集与它的 CLI 级成对臂（`face/__tests__/cli.test.ts` 上的 `--notes` 透传，参数读取与 `display` 经 `BoardView.render` 端到端可红）在本行正式入账；Task 4 的 Objective 与 checkable 按 ID 点名 `P37 T6` / `P37 T7` 两段 describe，并写明该文件其余臂为何留；Task 7 的 `census:criteria.rows` 步骤改成读一次 `CRITERIA_ROWS` 的度量并明写 Task 5 之后没有比对臂可红；Constraints 的对已闭合文档条补上 P41 的枚举改写（spec §2.2），窗口账改按文档记、点名 Task 1 改名让已闭合相位的记录付红、删掉会随树漂移的文档普查；Task 8 的 tag 格改按节点标记判（执行卡首行携带 `detail` 散文，不是 `tag`），篡改改由注入的 stub 渲染判，`scripts/__tests__/diagrams.test.ts` 随之进写集 | Oscaner M. · Claude（kairos:cdd-plan） |
| v0.7 | 2026-11-23 | **按 plan 评审轮五的 F1–F3 用户裁定修正（Task 6 与 Task 8 两任务面，结构面未动）**：Task 6 的 Objective 点名 `charter-self-repair.test.ts` 第二个 describe 的两臂——零 finding 臂整臂退役，P42 T9 的候选面臂只撤真宪章读取、量缺口的一对重挂到 `charterBody([...])` 合成宪章上（`measure-literal` 的缺口对不丢），步骤一的可判改成读机制（两文件全绿且非语料臂留在原位 + 重挂后的缺口对成对可辨），整文件删除仍不是修法；Task 8 的退役拼写格按树改写——源上无 `retiredTag` 字段，退役拼写今天住在 `diagrams.guard.test.ts` 的 `DiagramPin` 字面上，搬过去落成 `scripts/lib/diagrams.ts` 的模块内字面表、断言读该表与源的暂存渲染，Objective / Produces / 步骤一的 stub 表述同批改齐；Task 8 的产物读者离场入账（`DiagramTwin.of` 与 `DiagramTwin.SOURCES` 随两个 describe 搬走后零调用，步骤二的可判改按机制判，HTML 路径字面只作副证） | Oscaner M. · Claude（kairos:cdd-docs-fix） |
| v0.8 | 2026-11-23 | **按 plan 评审轮六的 F1–F4 用户裁定修正**：Task 7 把变更史行逐条点名为例外——零命中只圈正文段，表内引用原值保留（`## Change history` 是记录不是活引用），成对判据写死「正文段写回即红 / 历史行原样不红」；Task 8 的文案格改写成 escaped-or-raw 的在场判据（与 `DiagramTwin#copyMismatches` 同判），不再暗示字节相同；Constraints 的窗口段删掉成员枚举，只留按文档记的规则与该臂当次读数；Task 10 从新建 changeset 改成扩写树上已有的 `.changeset/p43-self-assertion-retirement.md`，一个相位一份 note | Oscaner M. · Claude（kairos:cdd-docs-fix） |
| v0.9 | 2026-11-23 | **按 plan 评审轮七的 F1 用户裁定修正**：Task 7 的变更史豁免从一条 id 的措辞改成一条覆盖两个 id 的规则——可判仍只圈正文段，而 `census:pin` 引用与 `census:criteria.rows` 声明同在例外之内，例外的单位是行不是 id；`v0.13` 行被点名为本段存在的那个案例（它记的是当时把裸计数改写成声明的那次读数），Produces 与步骤二随之收成「表以外等于删除后的行数、表内原值保留」，两条 id 各一半的成对判据各自可红 | Oscaner M. · Claude（kairos:cdd-docs-fix） |
| v0.10 | 2026-11-23 | **按 plan 评审轮八的 F1–F2 用户裁定修正（Task 4 与 Task 7 两任务面，结构面未动）**：Task 7 的声明步骤收成单一读法——按 `CRITERIA_ROWS` 的度量逐处核，并明写 Task 5 之后树上没有任何面能把它重判红，删掉与自家括注互斥的成对臂；豁免段的成对判据随之只留在引用那一半，声明那一半明写不配成对臂；Task 4 的写集、步骤一与 Acceptance 补上散文那半——`face/cli.ts` 的 `#audit` 段注、memo 清单、pre-flight 与 `#auditOf` 段注随符号收口，`review-criteria.test.ts` 文件头不再称 `test` 为 pin 门，成对判据是「散文写回 ⇒ 散文半红而符号半绿」与「符号写回 ⇒ 符号半红而散文半绿」两向，两半互不代偿 | Oscaner M. · Claude（kairos:cdd-docs-fix） |
| v0.11 | 2026-11-24 | **记录 `0284f07d` 的 Task 4 与 Task 8 补写（本行追登）并应用 plan 评审轮九的 F1–F2 用户裁定**：该提交给 Task 4 的 Files 加了七行与 pin 退役散文面同批的写集（`session/preflight.ts` · `contract/markdown-spans.ts` 与它的测试 · 两份 `docs/diagrams/src/architecture.*.json` · 两份生成物 `architecture.*.html`），并给 Task 8 加了 `scripts/emit.ts` 一行，本行把两处入账；Task 4 的散文半补第三处——`contract/markdown-spans.ts` 的模块段注与 `contract/__tests__/markdown-spans.test.ts` 的文件头不再把这条行读说成 pin 扫描的共用者，Objective · 步骤一的可判与 Acceptance 同批收该处与它自己的成对臂 | Oscaner M. · Claude（kairos:cdd-docs-fix） |
| v0.12 | 2026-11-24 | **Task 10 收口（implement 轮）**：本相位那份 changeset 补上第四处消费面变化——生成物一致的执行面收归 `emit:check`（引用多重集与其计数 · 源的修订钉对产物证据块 · 文案格 · 源的节点 `tag` · 退役拼写各一条断言，`DiagramTwin` 的产物读者随它仅有的调用者离场），两份架构产物随 `init` 块搬进 `face/cli.ts` 的重渲染同批入账；相位仍只一份 note、级别 minor，全量门 `pnpm run validate` exit 0（root 6 文件 / 41 例 · kairos 17 / 106 · engine 98 / 2254，零告警） | Oscaner M. · Claude（kairos:cdd-dev） |
| v0.13 | 2026-11-24 | **记录 `2a2b1312` 的 Task 4 写集补写（本行追登）并应用 branch 评审轮一的 F1 裁定**：该提交删掉 `session/round-artifacts.ts` 上的 `ArtifactRegistry.ownsName`（−10 行）——它的唯一读者是 pin 门的 artifact 名排除，Task 4 一退役它就是死代码；文件本身不在任何任务的 `**Files:**` 里，本行给 Task 4 补上该 `Modify:` 行，使计划的写集与 `git diff origin/develop...HEAD` 的文件面重新一一对应（除本相位的 spec 外，该 diff 不再有不被计划署名的文件） | Oscaner M. · Claude（kairos:cdd-fix） |
| v0.14 | 2026-11-24 | **记录 `51e5ba5c` 的 Task 7 补写（本行追登）并应用 plan 评审轮十的 F1–F2 用户裁定（Task 7 与 Task 8 两任务面，结构面未动）**：Task 7 把 P37 spec §1.3 的构成句点名为声明那一半的第三类写面——声明坐在构成句里时数字改到删除后的行数，构成句改读成落笔时的表记，被撤的那一行就地标成已随 pin 门撤除（不删成员 · 不改结论），Objective · Produces · 两步同批落笔，成对读作「把 §1.3 的构成句原样留着 ⇒ 该处读成判据表仍带 pin-parseability」；`51e5ba5c`（`docs(p43): frame the P37 criteria census as its authoring-time table`）是本相位的 Task 7 交付，本行把它与那处构成句的写面一并入账；Task 8 的篡改臂补齐 spec 点名的生成物面——`.claude-plugin` 的派生 · `docs/diagrams/src/*.json` 的源 · ISSUE_TEMPLATE 的表单各一处，Acceptance 同批携带三面，与 Produces 已声明的生成物面一一对应 | Oscaner M. · Claude（kairos:cdd-docs-fix） |
| v0.15 | 2026-11-24 | **按 branch 评审轮二的 F1 裁定修正（Task 6 面，结构面未动）**：`charter-self-repair.test.ts` 里那条「只留回填家族」的 `single-home` 臂不再拿本仓 `docs/kairos/**` 当真语料——它的右域改由判定上下文的 `fs` 缝注入本文件自建的语料，`MemoryFs` 收成 `__tests__/support/memory-fs.ts` 一处实现（`single-home.test.ts` 的本地同类同批改用），臂的文件头与成对红同批落笔（改夹具一处句子 ⇒ 该家族少点名一位持有者 · 空语料 ⇒ 零 finding）；Task 6 的 Objective · 步骤一可判与 Files 同批对齐（新增 `Create:` 一行与 `single-home.test.ts` 的 `Modify:` 一行） | Oscaner M. · Claude（kairos:cdd-fix） |
| v0.16 | 2026-11-24 | **按 plan 评审轮十一的 F1 修正（Task 5 面，结构面未动）**：`contract/invariants.ts` 上 `MeasureLiteralInvariant` 的类段注随比较机器收口——那句「登记表供给 · `CensusGate` 比对」改读成经 `CensusGate.referencesOf` 读引用形状（`d22318b2` 的散文改写随之入账，此前 Task 4 已为它自己的散文半立过同一先例）；Task 5 的 `Modify:` 行就地署上它的写面，Objective · Produces 与 Acceptance 同批落笔，并新增一步按 `compared by` 与 `supplied by the census` 零命中判，成对为「段注写回 ⇒ 散文半红而符号半绿」与「登记表写回 ⇒ 符号半红而散文半绿」两向 | Oscaner M. · Claude（kairos:cdd-docs-fix） |
| v0.17 | 2026-11-24 | **按 branch 评审轮三的 F1–F2 裁定修正（Task 9 与 Task 2 两任务面，结构面未动）**：Task 9 的右域收进夹具——`selector-coverage.test.ts` 的判定不再以 `root: REPO_ROOT` + 默认 `NodeFs` 扫本仓 `docs/kairos/**`，`single-home` 的邻域改经 `fs` 缝注入本文件自持的内存语料（`__tests__/support/memory-fs.ts` 的 `MemoryFs`，其余三份载体按各自 doc-type 的 doc root 挂载且各带自己的 slug——同 slug 的兄弟被该规则按设计跳过，停在骨架的 `:::fill slug` 上会什么也对比不到），Objective · Produces 与新增的一步同批落笔，成对为「语料里写进一份载体的判据句 ⇒ 那一格红」与「checkout 里临时放一份同句文档 ⇒ 套件照旧全绿」；Task 2 的 Produces 补上宪章 Phase inventory 行的栅栏读者一格（改读当时名为 `PinSpans` 的四个公开成员，与 spec §2.1 · Task 1 · v4.63 行同构） | Oscaner M. · Claude（kairos:cdd-fix） |
| v0.18 | 2026-11-24 | **按 plan 评审轮十二的 F1 修正（Task 9 面，结构面未动）**：`selector-coverage.test.ts` 的文件头括注在 `7346cc12` 之后停在旧读数——同文件两处断言与其上那条 `all … elements` 的题目量的都是四类登记表的合计，文件头却不再与它同源，而计划里没有一行署这个括注；Task 9 的 Objective · Produces · Steps 与 Acceptance 同批落笔：括注的数目与 `declaredRegistries[type].elements.length` 的合计同源，成对判据为「括注写成一个与合计不符的邻值 ⇒ 该臂红」 | Oscaner M. · Claude（kairos:cdd-docs-fix） |
| v0.19 | 2026-11-23 | **追加 Task 11（分支终评后用户裁定）**：`measure-literal` 整条退出——规则行 · 判据本体 · `census.ts` 整模块 · 文法夹具全批下线，P41 形状门收成五条；已闭合文档的 `census:` 声明不迁移（无读者）。`DependsOn` 只指向已闭合的 Task 4 / Task 5，引擎据此派生新波。 | Oscaner M. · Claude（kairos:cdd-dev） |
| v0.20 | 2026-11-24 | **按 plan 评审轮十三的 F1–F6 用户裁定修正（Task 11 面，结构面未动；Task 9 与 Task 10 已闭合，其文字不改，接管记录在 Task 11 的 Objective）**：F1 把撤一条规则的三张面收进 Task 11——执行面（登记行 · 判据本体 · 它读的两个常量）· 教学面（两份 authoring 节点的 `count` 行 · `#docNarrativeAxes` · `#DOCS_FIX_SHAPE_RULES`）· 断言面（`templates.test.ts` 的两个常量 · `charter-self-repair.test.ts` · `cli.test.ts` · `fix-round-gate.test.ts` · `claim-shapes.test.ts`），全部进 Files 并各署一行处置；F2 把缺口读数的接手写进 Objective · Produces · Steps 与 Acceptance——`LineCoordinateInvariant.evaluate` 起调 `ProseFace.gaps(ctx, this.name)`，成对为「删掉那一行 ⇒ 缺口臂红而其余臂全绿」与「同一份正文放到已登记的小标题下 ⇒ 沉默」；F3 让形状门的名册只读 `RULE_REGISTRY` 里留下的形状行，四处数目分句一并撤掉、改指 spec §4.2；F4 把 `.changeset/p43-self-assertion-retirement.md` 加进写集，census 段按模块的实际命运改写、摘要点名 `count` 造句；F5 把 `selector-coverage.test.ts` 的文件头括注接到本任务；F6 把 `rules.test.ts` 的两处写死读数改成从登记表自身取（长度与两条 scope 的过滤结果互相比对，夹具不留第三个数目） | Oscaner M. · Claude（kairos:cdd-docs-fix） |
