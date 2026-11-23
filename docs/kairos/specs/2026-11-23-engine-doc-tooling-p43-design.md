---
title: '引擎自证面退役 — Phase Spec'
doc-type: phase-spec
version: v0.3
date: 2026-11-23
slug: '2026-11-23-engine-doc-tooling-p43-design'
program: 2026-10-10-engine-doc-tooling
author: '[human] · Claude Opus 5（kairos:cdd-design · 用户裁定「tests 衡量引擎，不规训我们自己的文档」）'
---

## Design

本相位撤掉引擎仓库的**自证面**：pin 可解析性门整条退役，规训本仓文档的测试语料臂退役，生成物一致收归既有 CLI 门，并把判据写进 `AGENTS.md`；同批收掉它的输出面镜像——board 把每轮实现叙述原样内联进进度格（github#518）。判据只有一条——**tests 衡量引擎，不规训我们自己的文档**——而另一件事是同一族的另一面：**状态面只给状态，不替读者预付散文的成本**。

### 1. 判据：为什么「用测试规训自己的文档」是缺陷来源

D98 已把「引擎判物料，物料不判自己」立住，但它只约束了引擎**生产物料**的那一面。仓库仍在用**测试**判我们的物料：`docs/kairos/**` 的每份 spec / plan / overall 都被拿全量 doc-contract 跑一遍并断言零，pin 门与 census 门同在这一面上。

后果不是文档变干净，而是**引擎的误判被静默修复在文档里**：门报「符号不存在」，人改文档，缺陷原封不动发到消费者。这条链路在 github#517 上有账本——一个相位产出的 pin finding 里，真设计错误只占极少数，其余分别是「裸符号在只认 ts/js/json 的索引里找不到」、「本阶段正要退役的符号」、「内建名与配置键」；而消息把它们一律说成「树上的 sources 里没有这个名字」。

**条件（本相位交付后必须成立）**：测试里不存在任何以本仓 `docs/kairos/**`、README 类文档或生成物为语料并断言其状态的断言。它们可以断言引擎**对一个夹具**做了什么，夹具的答案由作者自己选定。

**边界**：`docs/kairos/**` · README family · 生成物。`packages/kairos/skills/` 与 `packages/kairos/tests/` 中守消费面契约的测试**不在内**——skills 是发布物，守的是消费者拿到的字节（`skill-anatomy` · `words` · `presentation-surface` · `grep-sweep-regression`）。

**「语料臂」与「判据」的分界是全部工作的分水岭**：撤的是「拿本仓文档跑一遍」那一臂，判据本体连同它的成对夹具留下。D98 ① 的三条臂是本相位对每条被撤语料臂的验收口径——违规必报 · 邻居沉默 · 零候选即红。

### 2. pin 门整条退役

`github#517` 的实测结论：pin 判据点名的三种「解析不到」在语义上是三件事（真不存在 · 缺宿主 · 本阶段正要退役），引擎只说了第一种，且说了三遍；而它抓到的真问题可由任何一次实现前的事实核对取代。

**下线面（全批，同一提交面）**：

- `packages/cdd-engine/src-next/contract/pins.ts` 整模块——`PinAudit` · `PinIndex` · `PinSource` · `PinDeclarations` · `PinVocabulary` · `ForwardPaths` · `corpusOf` 一并随之消失，不留空壳、不留「以后可能有用」的残座。
- `packages/cdd-engine/src-next/contract/review-criteria.ts` 的 `pin-parseability` 判据行（`CRITERIA_ROWS` 的 warn 档一行）。
- `packages/cdd-engine/src-next/render/templates.ts` 的 `pinLensOf` 注入面，以及引用它的注入行。
- `packages/cdd-engine/src-next/contract/census.ts` 的四行 `pin.*` 登记（`pin.symbol` · `pin.path` · `pin.total` · `pin.files`）与其 `PinAudit` 依赖。
- `packages/cdd-engine/src-next/face/lifecycle.ts` 的三处调用面：被审文档正文的 pin 回读 · 交接单 `contract.path` 的解析腿 · 判据注入。
- `packages/cdd-engine/src-next/face/cli.ts` 的 census 装配点中属于 pin 的那一半。
- `packages/cdd-engine/src-next/contract/__tests__/pins.guard.test.ts` 与 `pins-guard-closure.test.ts` 两个文件，及 `scan-coverage.test.ts`（它的证明对象就是 pin 扫描的覆盖）。

**已闭合文档的读数引用同批删除，而不是改数字**：`census:pin.total` 出现在本程序 P37 的 spec 与 plan、P41 的 spec 与 plan 里。那几个 `= 0` 断言的是一个已撤门的读数，保留任何数字都是说谎；删引用改的是记录面，不是结论面——这是 D22 的窄反转，形态同 D100 的 `temporal-indicator` 整条退出。**为什么必须动**：`CensusGate` 是消费者可见的 doc-contract 腿，登记行一撤，任何人（含我们自己）对被引文档跑 `cdd review` 都会抛未登记 id。

**非目标**：不发明替代解析器（路径/符号/测试题三种形态都不再有机械面）· 不保留 `pin.total` 的墓碑行（回报一个恒零的数是说谎）· 不改任何 doctrine 散文的措辞（D93 ⑥ 的历史记录留在本程序宪章的决策表里，不追改）。

### 3. 语料臂退役

| 文件 | 撤掉的那一臂 | 留下的 |
|---|---|---|
| `doc-corpus.guard.test.ts` | 全语料 doc-contract 扫描 + 四腿血缘回读 | 无（判据本体在引擎，语料臂是它唯一的断言对象） |
| `phase-inventory.guard.test.ts` | 对宪章 Phase inventory 的逐行七格判 | 无 |
| `census.guard.test.ts` | 对本仓文档 `census:<id> = <n>` 的比对 | `CensusGate` 本体的夹具（见 §4） |
| `charter-self-repair.test.ts` | 宪章五节零 finding | 无 |
| `single-create.guard` 的语料臂（`contract/__tests__/single-create.test.ts` 内读 `docs/kairos/plans` 的那一段） | 读本仓 plans 目录的那条臂 | 两个面（VERB / CLAIM）的成对夹具 |
| `floor.guard.test.ts` | README 安装行与 `engines` 的一致性 | 无（漂移风险记入 §8） |

**判据不得随之消失**：`doc-corpus.guard` 与 `charter-self-repair` 撤掉的是**语料**臂，它们跑的规则（doc-contract 各腿 · P41 的五条形状规则 · `single-create`）必须有夹具对覆盖。逐条核对的判据是：每条规则的违规夹具必报、邻居夹具必沉默、零候选即红。`single-create` 与 `shape-rules` 已有这类夹具，本相位不重写它们，只删语料臂并核对缺口；发现缺口就在本相位补，不留后续相位的债务。

### 4. `CensusGate` 的本体保留

census 门是**引擎行为**，不是我们的文档事实：它规定消费者文档里的测量数字必须以 `census:<id> = <n>` 引用，且引用由登记面核对。这条规则留在引擎里，退的是四行 `pin.*` 登记与「拿我们自己的文档比对」那一臂。

给的夹具面（`contract/__tests__/census.guard.test.ts` 收敛为夹具文件）：引用文法（点分小写 id · 十进制整数 · 终止符不是数字/字母/点）· 未登记 id 抛 · 数字与登记值不符即红 · 合规引用沉默 · 零候选即红。

### 5. `selector-coverage` 的物料替换

`contract/__tests__/selector-coverage.test.ts` 今天是「四条登记表全部 selector 的解析证明，夹具就是我们自己的文档」——这是本相位唯一**要新写物料**而不是纯删的地方。判定与格题一字不改，物料换成按四种 doc-type 各一份的合成合规文档，住 `contract/__tests__/fixtures/`；物料的字段名与结构由四种类型的骨架派生，不手写重复结构。

**成对**：删掉任一 selector 的表达面即红（原红腿保留）· 新增一条 selector 而不给表达面即红。合成的合规文档必须能过 doc-contract —— 它们与消费者文档同判，不享受豁免。

### 6. 生成物一致收归 `emit:check`

`face/__tests__/plugins.guard.test.ts` · `face/__tests__/diagrams.guard.test.ts` · `face/__tests__/diagram-twin.guard.test.ts` 里的生成物比较臂搬到 `scripts/` 的 `emit:check` 路径上——那是消费者也会跑的同一条 CLI 门，也是 D98 ② 指定的唯一路径。

**搬过去的东西**：`.claude-plugin/` 与 `marketplace/source.json` 与 packages 各自 `#oscaner` 行的一致性 · `docs/diagrams/src/*.json` 与生成 HTML 的对应 · ISSUE_TEMPLATE 与 `issue-body.json` 的一致性。

**留下的东西**：孪生判据本体的夹具臂（EN 与 zh-CN 同构这一条的违规/合规格）留在测试里——那是判据，不是生成物比较。搬完之后测试文件不得再读 `docs/diagrams` 的真实产物做断言。

### 7. `AGENTS.md` 规范

落点：「Conventions not enforced by the formatter」节，英文，与宪章 D101 互为指针（一处规范、一处裁定与实测账）。措辞要点三条：测试只断言引擎对夹具做了什么 · 以本仓文档为语料并断言其状态是禁止的（并写出为什么：误判被静默修复在文档里，缺陷照发消费者）· 每条规则保留三条臂（违规必报 · 邻居沉默 · 零候选即红），生成物一致只归 `emit:check`。

**执行面**：新规范第一次出场由本仓自己的判例承担——本相位交付后，引擎与 kairos 两套测试面上不存在一条违反它的断言。这是规范唯一的机械读法，不另立门。

### 8. 失败面与接受的代价

- **我们自己的文档不再被机械判**：doc-contract 的规则在我们全部已存文档上不再有零断言。这是判据的本意，不是疏漏——真实 CDD 运行本身是执行面，误判会在轮里被看见，而不是被改文档消掉。
- **README 安装行与 `engines` 的漂移**：`floor.guard` 撤后无人机械核对。接受这个代价，不在测试里复活它；若将来要判，正确去处是发布面检查而不是引擎测试。
- **已闭合文档的引用迁移**：`census:pin.*` 的引用删除后不可回滚成数字。判据是 `cdd review` 对被引文档零抛错——这条腿在 P37 的文档上跑一次即可。
- **读实现理由的人要多打一个旗标**：这是附带的代价，不是疏漏——正文的权威载体在轮次 handoff 与 `logs/`，board 不再做第三份副本。
- **P39 的审计理由作废**：pin 门不再能审计搬家。P39 改为冻结 `src-next/` + 新开 `src/` 重建（用户 2026-11-23 裁定），宪章的对应行已在本相位注册时补句作废，P39 自己的会话重写它。

### 9. board 的 notes 默认折叠（github#518）

board 的消费者是要看进度的人或 agent，不是要读实现理由的人。今天 `BoardView` 的 token 把该轮 `notes` 的全部正文用分号连进进度格，于是一个「不需要读」的面板成了一份散文集；而同一份散文的权威载体已经存在（轮次 handoff 与 `.kairos/cdd/<slug>/logs/`），board 成了第三份副本，且只有这一份会被反复整篇打印。

**条件**：默认输出里不出现 note 正文；`notes +M` 的计数留痕（P42 §2.1 已把它挂在 token 尾部）；正文只在显式旗标之后展开，且展开不改变 token 的段序。

**旗标形态：单键 `--notes`（bool，展全部）**，不设带量变体。理由两条：`ChannelArgRow` 没有「可选值」这一维（通道行只有 flag / type / help 三列数据驱动 commander），issue 提的 `--notes [n]` 今天表达不出来；而带量变体本身是多余的——折叠是默认，展开就是「我要全部」，一个 bool 与 `--artifacts` 同形。没有第二个键，就没有优先级表，也没有「两者同给」的拒绝面。

**不变量**：P42 §2.1 的 token 形态不变——段序仍是 `verb · body · mark · +N · 降档注 · notes +M`，折叠意味着最后一段不起正文，而不是搬走这一段。胶囊面不涉及：notes 正文今天只由 `packages/cdd-engine/src-next/face/board-view.ts` 的 `BoardView` 投影，胶囊不印它，本相位不改胶囊。

**反向臂**：展开面仍走同一个折叠函数（一行、无换行、无 ` · `），否则一个大回合的 note 就能把一行进度拆成多行——展开是「多给正文」，不是「允许拆行」。

### Acceptance criteria

- `pin` 门零残座：模块 · 判据行 · `pinLensOf` 注入面 · 四行登记 · 两个测试文件 · 三处调用面，全树 `grep` 无一留存；`contract/census.ts` 不再 import `PinAudit`。
- 被撤语料臂的判据仍可红：`single-create` 与 P41 的五条形状规则各有违规/邻合格，`CensusGate` 的四腿各有格，`selector-coverage` 删一条 selector 即红。
- `selector-coverage` 在合成物料上全绿，且合成物料自己过 doc-contract —— 把任一份合成的字段名改错即红。
- `emit:check` 接管原三项生成物断言：篡改 `.claude-plugin/` 一处、篡改 `docs/diagrams/src/*.json` 一处、篡改 ISSUE_TEMPLATE 一处，各使 `emit:check` 非零退出。
- 测试面零语料臂：引擎与 kairos 两套测试里不存在以本仓 `docs/kairos/**`、README family 或生成物为语料并断言其状态的断言；孪生判据只对夹具。
- `AGENTS.md` 规范行在册，与宪章 D101 互为指针，且本仓测试面无一违反（上一格即其证据）。
- 已闭合文档的 `census:pin.*` 引用为零，且对被引文档跑一次 `cdd review` 不抛未登记 id。
- board 默认输出零 note 正文：wave 行以 `notes +M` 收尾，M 与该 run 的 note 行数同源；`--notes` 展开后的字节与改动前逐字相同；token 段序与折叠时逐字同序。
- `pnpm run validate` exit 0；changeset 记 `cdd-engine` **minor**（D74：方法论契约不变，消费面字节破坏仍 minor）。

## Constraints

- **判据只撤语料臂，不改语义**：doc-contract / `single-create` / P41 形状规则 / `CensusGate` 的判定语义一字不动；本相位动的是「拿什么物料去跑」，不是「跑什么」。
- **不写测试来证明自己的文档干净**：本相位的验收里没有任何一条要求本仓文档处于某状态。违反这一条就是相位失败，而不是验收漏项。
- **对已闭合文档只删随门退役的读数引用**：不改任何结论、裁定或交付记录；这是 D22 的窄反转，边界与 P37 的存量化迁移同款。
- **一对夹具优先于一次全语料扫描**：任一规则若要保住执行面，代价是夹具而不是语料。语料只提供「今天恰好干净」这个读数，而它对正确实现与没跑的实现同时成立（D98 的三条臂即为此立）。
- **禁止为了消红改文档**：本相位任何一轮若出现「门报错 → 改文档」的处置，按缺陷处理——那正是本相位要消灭的链路。
- **折叠只改打印，不改口径**：`notes +M` 的 M 与今天同源（同一个 run 的 note 行数），不得因折叠而换口径；board 不新增第三态（如「展开但截断」）——两种形态就两种。
- **pin 判据的下线不用新解析器替代**：路径/符号/测试题三形不再有人判。issue 提议的「plan 的 `Create/Modify/Delete` 三行对账」不在本相位（用户 2026-11-23 选择整条撤），若将来要做，是新的相位与新的判据。
- **公共措辞**：`packages/cdd-engine/src-next/contract/pins.ts` 等被删模块在本 spec 里的引用是历史引用，按构造不再有人判——判它们的门正是本相位撤掉的那一道。

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-11-23 | 初稿（cdd-design 会话落定）：判据「tests 衡量引擎，不规训我们自己的文档」· pin 门整条退役与已闭合文档引用同批删 · 语料臂退役而判据留 · `CensusGate` 本体保留 · `selector-coverage` 换合成物料 · 生成物一致收归 `emit:check` · `AGENTS.md` 立规范 · 失败面与接受的代价 | Oscaner M. · Claude（kairos:cdd-spec-writer） |
| v0.2 | 2026-11-23 | **github#518 并入（用户裁定）**：新增 §9——board 的 notes 默认折叠（`notes +M` 计数留痕 · `--notes` 展全部 · 不改 P42 的 token 形态）；验收补一腿、失败面补一条代价 | Oscaner M. · Claude（kairos:cdd-spec-writer） |
| v0.3 | 2026-11-23 | **旗标收为单键（用户裁定）**：去掉 `--notes-last <n>`，只留 `--notes` bool——折叠是默认，展开就是「我要全部」；带量变体没有需求，且会把一个显示旗标变成「优先级 + 拒绝面」两张表。验收相应收窄 | Oscaner M. · Claude（kairos:cdd-spec-writer） |
