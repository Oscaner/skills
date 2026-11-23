---
title: '引擎自证面退役 — Phase Spec'
doc-type: phase-spec
version: v0.4
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
- 本相位交付后必须成立的条件：测试里不存在任何以本仓 `docs/kairos/**`、README family 或生成物为语料并断言其状态的断言。它们可以断言引擎**对一个夹具**做了什么，夹具的答案由作者自己选定。

#### 1.2 边界：哪一类文档在内，skills 为什么不在内

- 在内：`docs/kairos/**` · README family · 生成物（`.claude-plugin/`、`marketplace/source.json`、`docs/diagrams/` 的渲染产物、ISSUE_TEMPLATE）。
- 不在内：`packages/kairos/skills/` 与其守消费面契约的测试——`skill-anatomy` · `words` · `presentation-surface` · `grep-sweep-regression`。skills 是发布物，守的是消费者拿到的字节，不是我们的写作习惯。
- 判定的分水岭是「谁的商品」：断言的对象是消费者最终拿到的东西 ⇒ 保留；断言的对象是本仓写作过程的产物 ⇒ 退役。

#### 1.3 语料臂与判据的分界

- 撤的是「拿本仓文档跑一遍」那一臂，**判据本体连同它的成对夹具留下**。
- 每条被撤语料臂按 D98 ① 的三条臂验收：违规必报 · 邻居沉默 · 零候选即红。
- 语料臂只提供「今天恰好干净」这一个读数，而它对正确实现与没跑的实现同时成立——这是它不足以替代夹具的原因，也是本相位存在的理由。

### 2. pin 门整条退役

#### 2.1 下线面：全批同一次提交

- `packages/cdd-engine/src-next/contract/pins.ts` 整模块——`PinAudit` · `PinIndex` · `PinSource` · `PinDeclarations` · `PinVocabulary` · `ForwardPaths` · `corpusOf` 一并消失，不留空壳、不留「以后可能有用」的残座。
- `contract/review-criteria.ts#CRITERIA_ROWS` 的 `pin-parseability` 判据行整行删除（含 `body` / `duty` / `counterExample`）。
- `render/templates.ts#pinLensOf` 及其注入行：被审文档的 pin 回读不再注入 review prompt。
- `contract/census.ts` 的四行 `pin.*` 登记（`pin.symbol` · `pin.path` · `pin.total` · `pin.files`）与其 `PinAudit` 依赖。
- `face/lifecycle.ts` 的三处调用面：被审文档正文的 pin 回读 · 交接单 `contract.path` 的解析腿 · 判据注入。
- `face/cli.ts` 的 census 装配点中属于 pin 的那一半。
- `contract/__tests__/pins.guard.test.ts` · `pins-guard-closure.test.ts` · `scan-coverage.test.ts` 三个文件（第三个的证明对象就是 pin 扫描的覆盖）。

#### 2.2 已闭合文档的读数引用同批删除，而不是改数字

- `census:pin.total` 出现在本程序 P37 的 spec 与 plan、P41 的 spec 与 plan 里。那几个 `= 0` 断言的是一个已撤门的读数，保留任何数字都是说谎。
- 删引用改的是**记录面**，不是结论面——这是 D22 的窄反转，形态同 D100 的 `temporal-indicator` 整条退出。
- **为什么必须动**：`CensusGate` 是消费者可见的 doc-contract 腿；登记行一撤，任何人（含我们自己）对被引文档跑 `cdd review` 都会抛未登记 id。

#### 2.3 非目标

- 不发明替代解析器：路径 / 符号 / 测试题三形都不再有机械面。
- 不保留 `pin.total` 的墓碑行——回报一个恒零的数是说谎。
- 不追改 D93 ⑥ 的历史记录：那条裁定留在本程序宪章的决策表里，是历史，不是树上状态。
- 不并入 issue 提议的「plan 的 `Create/Modify/Delete` 三行对账」——用户 2026-11-23 选择整条撤；将来要做，是新相位与新判据。

### 3. 语料臂退役

#### 3.1 逐文件的撤与留

- `contract/__tests__/doc-corpus.guard.test.ts`：撤全语料 doc-contract 扫描与四腿血缘回读；无留（判据本体在引擎，语料臂是它唯一的断言对象）。
- `contract/__tests__/phase-inventory.guard.test.ts`：撤对宪章 Phase inventory 的逐行七格判；无留。
- `contract/__tests__/census.guard.test.ts`：撤对本仓文档 `census:<id> = <n>` 的比对臂；留 `CensusGate` 本体的夹具（见 §4）。
- `contract/__tests__/charter-self-repair.test.ts`：撤宪章五节零 finding 那一臂；无留。
- `contract/__tests__/single-create.test.ts`：撤读 `docs/kairos/plans` 目录的那一段；留 VERB / CLAIM 两面的成对夹具。
- `__tests__/floor.guard.test.ts`：撤 README 安装行与 `engines` 的一致性；无留，漂移风险记入 §8。

#### 3.2 判据不随之消失

- `doc-corpus.guard` 与 `charter-self-repair` 撤掉的是**语料**臂，它们跑的规则（doc-contract 各腿 · P41 的五条形状规则 · `single-create`）必须有夹具对覆盖。
- 逐条核对的判据：每条规则的违规夹具必报、邻居夹具必沉默、零候选即红。
- `single-create` 与 `shape-rules` 已有这类夹具，本相位不重写它们，只删语料臂并核对缺口；发现缺口就在本相位补，不留后续相位的债务。

### 4. `CensusGate` 的本体保留

#### 4.1 门是引擎行为，退的是登记行与语料臂

- census 门规定消费者文档里的测量数字必须以 `census:<id> = <n>` 引用，且引用由登记面核对；这条规则留在引擎里。
- 退的是四行 `pin.*` 登记与「拿我们自己的文档比对」那一臂；`contract/census.ts#CensusGate` 与 `contract/invariants.ts` 的调用点不动。

#### 4.2 收敛后的夹具面

- 引用文法：点分小写 id · 十进制整数 · 终止符不是数字 / 字母 / 点。
- 未登记 id 抛；数字与登记值不符即红；合规引用沉默；零候选即红。

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

- `face/__tests__/plugins.guard.test.ts` 的清单一致臂：`.claude-plugin/` · `marketplace/source.json` · 各 package 的 `#oscaner` 行三方对齐。
- `face/__tests__/diagrams.guard.test.ts` 的生成物臂：`docs/diagrams/src/*.json` 与渲染出的 HTML 的对应。
- `face/__tests__/diagram-twin.guard.test.ts` 里读真实产物的那一臂。
- 落点是 `scripts/` 的 `emit:check` 路径——消费者也会跑的同一条 CLI 门，也是 D98 ② 指定的唯一路径。

#### 6.2 留下的

- 孪生判据本体的夹具臂（EN 与 zh-CN 同构）留在测试里：那是判据，不是生成物比较。
- 搬完之后，测试文件不得再读 `docs/diagrams` 的真实产物做断言。

### 7. `AGENTS.md` 规范

#### 7.1 落点与三条要点

- 落点：「Conventions not enforced by the formatter」节，英文，与宪章 D101 互为指针（一处规范、一处裁定与实测账）。
- 要点一：测试只断言引擎对**夹具**做了什么。
- 要点二：以本仓 `docs/kairos/**`、README family 或生成物为语料并断言其状态是禁止的，并写出为什么——误判会被静默修复在文档里，缺陷照发消费者。
- 要点三：每条规则保留三条臂（违规必报 · 邻居沉默 · 零候选即红），生成物一致只归 `emit:check`。

#### 7.2 执行面

- 新规范第一次出场由本仓自己的判例承担：本相位交付后，引擎与 kairos 两套测试面不存在一条违反它的断言。
- 这是规范唯一的机械读法，不另立门。

### 8. 失败面与接受的代价

#### 8.1 我们自己的文档不再被机械判

- doc-contract 的规则在我们全部已存文档上不再有零断言。这是判据的本意，不是疏漏——真实 CDD 运行本身是执行面，误判会在轮里被看见，而不是被改文档消掉。

#### 8.2 README 安装行与 `engines` 的漂移

- `floor.guard` 撤后无人机械核对。接受这个代价，不在测试里复活它；若将来要判，正确去处是发布面检查而不是引擎测试。

#### 8.3 已闭合文档的引用迁移

- `census:pin.*` 的引用删除后不可回滚成数字。判据是 `cdd review` 对被引文档零抛错——这条腿在 P37 的文档上跑一次即可。

#### 8.4 P39 的审计理由作废

- pin 门不再能审计搬家。P39 改为冻结 `src-next/` + 新开 `src/` 重建（用户 2026-11-23 裁定），宪章的对应行已在本相位注册时补句作废，P39 自己的会话重写它。

#### 8.5 读实现理由的人要多打一个旗标

- 这是 §9 的附带代价，不是疏漏——正文的权威载体在轮次 handoff 与 `logs/`，board 不再做第三份副本。

### 9. board 的 notes 默认折叠（github#518）

#### 9.1 现象与条件

- board 的消费者是要看进度的人或 agent，不是要读实现理由的人。今天 `BoardView` 的 token 把该轮 `notes` 的全部正文用分号连进进度格，于是一个「不需要读」的面板成了一份散文集。
- 同一份散文的权威载体已经存在（轮次 handoff 与 `.kairos/cdd/<slug>/logs/`），board 成了第三份副本，且只有这一份会被反复整篇打印。
- 条件：默认输出里不出现 note 正文；`notes +M` 的计数留痕（P42 §2.1 已把它挂在 token 尾部）；正文只在显式旗标之后展开，且展开不改变 token 的段序。

#### 9.2 旗标形态：单键 `--notes`

- 形态：`--notes`（bool，展全部），不设带量变体。
- 理由一：`packages/cdd-engine/src-next/face/declare.ts#ChannelArgRow` 没有「可选值」这一维（通道行只有 flag / type / help 三列数据驱动 commander），issue 提的 `--notes [n]` 今天表达不出来。
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

- `pin` 门零残座：模块 · 判据行 · `pinLensOf` 注入面 · 四行登记 · 三个测试文件 · 三处调用面，全树没有留存；`contract/census.ts` 不再 import `PinAudit`。
- 被撤语料臂的判据仍可红：`single-create` 与 P41 的五条形状规则各有违规 / 邻合格，`CensusGate` 的四腿各有格，`selector-coverage` 删一条 selector 即红。
- `selector-coverage` 在合成物料上全绿，且把任一份合成文档的字段名改错即红。
- `emit:check` 接管原三项生成物断言：篡改 `.claude-plugin/` 一处、`docs/diagrams/src/*.json` 一处、ISSUE_TEMPLATE 一处，各使 `emit:check` 非零退出。
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
- **pin 判据的下线不用新解析器替代**：路径 / 符号 / 测试题三形不再有人判；issue 提议的 plan 三行对账不在本相位。
- **折叠只改打印，不改口径**：`notes +M` 的 M 与今天同源；board 不新增第三态。
- **被删模块在本 spec 里的引用是历史引用**：按构造不再有人判——判它们的门正是本相位撤掉的那一道。

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-11-23 | 初稿（cdd-design 会话落定）：判据「tests 衡量引擎，不规训我们自己的文档」· pin 门整条退役与已闭合文档引用同批删 · 语料臂退役而判据留 · `CensusGate` 本体保留 · `selector-coverage` 换合成物料 · 生成物一致收归 `emit:check` · `AGENTS.md` 立规范 · 失败面与接受的代价 | Oscaner M. · Claude（kairos:cdd-spec-writer） |
| v0.2 | 2026-11-23 | **github#518 并入（用户裁定）**：新增 §9——board 的 notes 默认折叠（`notes +M` 计数留痕 · `--notes` 展全部 · 不改 P42 的 token 形态）；验收补一腿、失败面补一条代价 | Oscaner M. · Claude（kairos:cdd-spec-writer） |
| v0.3 | 2026-11-23 | **旗标收为单键（用户裁定）**：去掉带量变体，只留 `--notes` bool——折叠是默认，展开就是「我要全部」；验收相应收窄 | Oscaner M. · Claude（kairos:cdd-spec-writer） |
| v0.4 | 2026-11-23 | **按 doc-contract 的 `presence` 重排结构**：九个 Design 组各补 `#### N.M` 条目、内容改为条目下的条目行，正文判定一字未改；评审轮一（`CDD_BLOCKED: doc-contract · presence`）的整改 | Oscaner M. · Claude（kairos:cdd-spec-writer） |