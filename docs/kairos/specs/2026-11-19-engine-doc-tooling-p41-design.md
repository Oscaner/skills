---
title: '文档声明的机检面 — Phase Spec'
doc-type: phase-spec
version: v0.2
date: 2026-11-20
slug: '2026-11-19-engine-doc-tooling-p41-design'
program: 2026-10-10-engine-doc-tooling
author: "[human] · Claude Opus 5（kairos:cdd-design · grilling Q1–Q17 落定）"
---

## Design

本相位让**文档里的声明**第一次可机检。三条腿：判据面禁止四类可变量；findings 关于树的断言必须带可核证据；同一条判据不得被复述进两份文档。

身份面不动。`doc-revision` 已经把登记面摘出身份（`contract/doc-body.ts` 的 `DocBodyProjection` 摘掉 front matter 与 `## Change history`），所以「记录一次修复会作废评审」只在记录被写进判据面时成立——本相位补的正是「写进判据面的东西」，不是漂移判据。

### 1. 形状面
#### 1.1 面图是声明，不是约定
- 面图住 `contract/declare.ts`（`ElementRegistry` 旁），是从注册表派生的一张表：每个 docKey 的每个注册节声明为 `decision` / `record` / `registration`，节名从 `ElementRegistry` 取，不手抄——不另立第二个节名清单，也不提前引用一个尚未落地的模块路径。
- 面图对判的每个 docKey **全域**：注册表里的每个元素都有角色，没角色的元素即面图的缺口，而缺口本身就是这条规则的判词，不是沉默通过。
- `### 设计决策留存` 尚未成为注册表元素（无 anchor、无译名），它的名字只能手写，正是本节禁止的第二份清单——本相位把它补成一个可选 facet 元素，`schema get <type> --output skeleton` 的真值表随之增一行（§4）。
- `## Change history` 恒为 record——它是本仓唯一的记录节，不新造第二个。
- 哪些节是 registration 由 §1.4 的全域面图逐节写出，本节不重抄那份清单。
- **不给行形状留席位**：同一节内按行切面，等于给「把判据写成记录形状」开后门。

#### 1.2 判据面的四类可变量
- **测量字面**——非法形态按 **token 形状**定，不按语义类：机器没有「这条断言是否关于活的树」的分类器，所以判据是一条文法，不是一个含义。文法：散文里一个独立的十进制整数、一个空格、一个成词的计数单位，且单位落在规则行声明的闭集（`passed` · `failed` · `tests` · `files` · `rows` · `行` · `处` · `条`）；「独立」与「成词」是文法本身——小数与带点编号里的数字不是整数，汉字复合词里的同形字不是单位。合法形态只有一种：`census:<id> = <n>`——值由 `contract/census.ts#CensusTable` 供，比对由 `contract/census.ts#CensusGate` 做。**这条文法是本条的规范**：注册表里更宽或更窄的措辞以文法为准。
- **行号坐标**——`第 N 行` · `line N` · 路径后接 `:N`。
- **活文件算式**——`a − b = c` 一类，操作数是活的树的计数。
- **时序指示词**——挂在路径或符号上的 `today` / `currently` / `今天` / `仍`。断言必须写成「必须成立的条件」，不是「此刻的形状」。

四条形状规则是 `contract/rules.ts` 的**四行**（`measure-literal` · `line-coordinate` · `live-arithmetic` · `temporal-indicator`），冲突去重是第五行（`single-home`，见 §3.2）：一行一条规则，一行的子腿不藏第二条规则。

扫描面**只读散文**：行内代码段与围栏块豁免。理由是必需的，不是宽容——本相位自己的 spec 必须能**命名**这四条规则，否则规则的第一份文档就违反了它自己。表格单元格**属于散文**（漂移大多发生在表里），照扫。代价说得清：把断言藏进行内代码段可以躲过这条门，那是另一类事（评审会读，门不装作能读）。

#### 1.3 严重度与自毁
- `contract/invariants.ts` 的 `Finding` 增 `severity: "block" | "warn"`，取值由 `rules.ts` 的行声明——规则表继续是唯一来源。
- 门判词：存在 block 即拒；warn 不拒。
- 告警的消费者字节挂在**规则自己的 `checked:` 行**上（`session/preflight.ts#PreFlight` 的规则行渲染，一行一条声明）：声明 `warn` 的规则命中时该行读作 `<rule id>: warned — <n> warning(s)`；未命中读 `passed`，声明 `block` 的规则命中读 `failed`——后两档与既有字节逐字节相同（消费面守恒），告警档是本相位唯一的新增形态。
- 自毁不是豁免层，是**本相位内的一个过渡值**：本相位最后一个任务把四个形状行的告警位翻成 block，并加一条 pin 断言「当前无一规则声明 warn」。

#### 1.4 适用范围由生命周期决定
- 形状门只判**所属相位未闭合**的文档。闭合不另立第二张表：读 `contract/pins.ts#ForwardPaths` 已有的那一路（P37 §7.3 条件 ③）——Phase inventory 的 Implementation plan 格写成 `✔ Done（<file> · <date>）` 时取其中的文件名，与 `path.basename(rel)` 比，恰一份命中才是闭合。
- 形状门要的是**被证明的闭合**，而 `ForwardPaths` 对 pin 面要的是「未被证明的未闭合」（一份失效的登记不该买来一次静默跳过）——两者极性相反，读数同源。因此本相位把这一判定提为同一个类上的公开读数，形状门读「已证明」并保留 pin 面原有的极性：不增第二份材料、不增第二张表。
- 为什么不是「全量」：存量语料的违例量使全量硬门等于要求重写历史（实测记在注册提交里）——而闭合相位的文档是对一棵已不存在的树的记录，再审它正是本相位要治的病。
- 为什么不是「行级基线」：那要新增一份基线产物，并与 `doc-drift` 的身份面争夺「什么是这一版」。
- **没有总体文档时闭合不可证 ⇒ 判**，且报文直说「无可用的闭合登记」——不静默豁免。宁可让一个没有程序的仓被判，也不让门在一个永不闭合的仓里变成空门。
- 为什么不是「ratchet（冻结上限）」：那会把存量违例永久赦免，直接违反「不留豁免层」。
- **plan 的 front matter 没有 `program:`**（只有 phase-spec 有），故闭合按「任一总体的 Phase inventory 格是否点名本文件」判，不按 front-matter 链判——给 plan 补 `program:` 对存量文档无从补起，补不上就判不出闭合，判不出闭合就豁免不了，语料不可迁移。
- overall 与 single-spec 无格点名 ⇒ 一律判。全域面图逐节写角色：
  - overall：`## Document scope` · `## Program charter` · `### Goal` · `### Non-goals` · `### Cross-cutting` · `## Boundary rules` · `## Constraints` · `## Maintenance` 为 **decision**；`## File paths` · `## Issue inventory` · `## Phase inventory` · `## Dependency graph` · `### 设计决策留存` 为 **registration**；`## Change history` 为 record。
  - phase-spec：`## Design`（含 `### N.` 与 `#### N.M` 所辖正文）· `### Acceptance criteria` · `## Constraints` 为 decision；`## Deviations` · `## Incremental warning` · `## Notes for downstream` · `## Review record` · `## Change history` 为 record。
  - plan：task 块（`### Task N:` 与其 `####` 字段，含 Steps）· `## Constraints` 为 decision；`## Change history` 为 record。
  - single-spec：`## Background & root cause` · `## Design decisions` · `## Acceptance` · `## Constraints` 为 decision；`## Change history` 为 record。
- **本相位修自己的章程**：翻位把「总是判」施于 overall 之后，本程序章程自身会在 `### Goal` / `### Non-goals` / `## Constraints` 三节被判据面拒——那里把命令清单与例外面挂在一个符号上，用的是时序措辞。所以本相位有一个具名交付：把这三节改写成条件句，并给成对用例（改前必红、改后零拒绝）。不修而宣布「总是判」，等于让翻位之后章程不可评审。
- **刻意接受**：闭合文档不再被形状门约束。改它就等于改历史，而评审不该因为记录而重开。

#### 1.5 记录面不加新规则
- 「前导 ISO 日期」**已由既有的 `change-history-row-shape` 覆盖**，本相位不为它加第二条规则——一处定义，两个说法会各自漂移。
- 「这条读数是怎么取的」**不进文档**：住 fix 轮的提交信息。加第五列是 schema 破坏（表头列集门 + 全部存量文档 + 骨架模板三处同改），而提交信息本身就是痕，且不占文档字节。
- 因此 record 面在本相位里唯一的增量是**它被面图认出来**（从而豁免），不是它被加了约束。

### 2. 证据面
#### 2.1 字段
- finding 增 `evidence: { repro, output? }`——嵌套让「有没有证据」成为可判的存在性。
- **没有 `claim` 字段**：finding 的 `summary` 就是那条断言，再抄一遍是同一事实的第二个住所。
- `repro` 的语义是**读者能在哪里自己核这条断言**：一条命令，或一个 `doc.md#section` 指针。两者皆可。
- `output` 长时可给路径；要点是字节存在于编排者可读之处。
- 字段的声明面只有一处：`session/handoff-schema.ts#HandoffSchema` 的 findings 条目，与 `impact` / `contract` 同层。

#### 2.2 强制面
- `severity: "blocker"` 而缺 evidence ⇒ 载体被拒（`contract-violation`），本轮作废。blocker 是唯一逼人采纳结论的档，一条无法核的 blocker 被采纳的代价高于一轮。
- warn / nit 留空合法。
- 适用全部携带 findings 的载体：review · fix · wave · branch。
- **接缝是既有的那一条，不新起第二条**：判定挂在 `session/handoff-schema.ts#HandoffSchema.gradingViolations` 的同一个草稿回读路径上（`face/lifecycle.ts`），判据本体是 `contract/review-criteria.ts#CRITERIA_ROWS` 的 `evidence-missing` 行。报文首词是判据行 id——`CDD_BLOCKED: evidence-missing:`——正文照 `grading-impact-missing` 那一行的形状，列出每个违规 finding 的 id 与 summary。blocker 档因此有三处举证：`impact.scenario`（P37）· `evidence.repro`（本相位）。
- **不收窄成「只对树事实强制」**：这需要一个「这条断言是否关于树」的分类器，而机器没有。按档强制不需要分类器。

#### 2.3 裁定侧
- rulings 侧车按 finding id 挂两份可机检字段：`verdict`（闭集 `fixed` | `rejected`）与 `probe`（可选）；其余字段是自由文本，`ruling` 继续写理由。判定因此不再从散文里解析——散文写理由，`verdict` 才是判词。
- 声明面是 `session/carrier-rulings.ts#CarrierRulings`：顶层只接受 `carrier` / `rulings`，每条裁定只接受已声明的键，多一个键即整份侧车不被接受；`verdict` 与 `probe` 加进 `RULING_FIELDS`，`probe` 与 finding 的 `repro` 对称。
- `verdict: "rejected"` 时 `probe` 必填：驳回是唯一「我说评审错了」的动作，它必须带可复核的路径。`verdict: "fixed"` 不需要——改动本身就是证据。
- 侧车不带 `verdict` 时 `probe` 不欠：存量侧车是自由文本，本相位不给它们补一次迁移（消费面守恒）。
- 判定只有 `verdict` 一个词，不另立同义的第三个键。

### 3. 一份住所
#### 3.1 判据
- 句子级**字符 3-gram Jaccard ≥ 0.6**，且两侧句子的归一化长度**均 ≥ 40 字符** ⇒ 两份文档陈述了同一条判据。
- 归一化：去掉行内代码标记、折叠空白、折大小写、丢标点。切句：`。` `！` `？` `!` `?` 与后接空白的 `.`，代码段与围栏内不切；表格行与列表项各自成句。
- 只抓**抄**，不抓**改**：抄的相似度趋近于一，阈值是安全垫。
- 报文必须给两侧文件与两侧开头，让人一眼判真假。
- 豁免：引用块与代码围栏。引用块的边界是结构，`MarkdownTree` 能读；要引判据就摆在引用块里，看得见、审得出。

#### 3.2 比较域是单边的
- 左侧 = 在范围内的文档，右侧 = 全部文档。漂移的方向永远是「新的抄旧的然后各自演化」；反向不存在。
- 这是 `doc-contract` 的第五行，不是新腿——同一扇门、同一张规则表。

#### 3.3 不判什么
- 不判行级事实（`- Create:` / `- Modify:` 与载具表点名同一个文件）。那是**两件事**：一个是时间面，一个是归属面；判它等于判死现行模板。
- 不判「同一条判据的两种不同说法」：那需要一个语义判据，机器没有。

### 4. 消费面
- 新增：`doc-contract` 的五条规则行出现在每次带文档的派发的 `checked:` 面（`measure-literal` · `line-coordinate` · `live-arithmetic` · `temporal-indicator` · `single-home`），且告警档命中时该行读作 `<rule id>: warned — <n> warning(s)`。
- 新增：`CDD_BLOCKED: evidence-missing:` 一种拒绝报文；finding 的 `evidence` 嵌套键是它的输入面。
- 新增：rulings 侧车两个可机检键 `verdict`（闭集 `fixed` | `rejected`）与 `probe`。
- 新增：`schema get <type> --output skeleton` 的字节——`### 设计决策留存` 补成一个可选 facet 元素（§1.1），骨架真值表随之增一行。
- 新增：`contract/pins.ts#ForwardPaths` 上一条公开的闭合读数（§1.4）——同一个类、同一份材料，供形状门读；不经 `checked:` 面，不改报文。
- 不动：退出码表 · `CDD_BLOCKED` 通道 · 既有拒绝报文 · `next:` 字面 · 身份与漂移判据 · 分级判收敛 · **board 的任何字节**（§2 不再有可见面交付）。
- 本相位自身的交付面：把章程的 `### Goal` · `### Non-goals` · `## Constraints` 三节改成条件句（§1.4）——改的是文档内容，不动报文。
- 版本级按 D74：方法论契约不变 ⇒ changeset **minor**。

### Acceptance criteria

- `contract/declare.ts` **面图即声明**：同一行文案只落在 `## Change history` ⇒ 零拒绝；同一行搬进判据面 ⇒ 该行报 `line-coordinate`（成对，同一份夹具只改位置）。overall 面：`## Constraints` 带坐标 ⇒ 被拒，设计决策留存里同一形态 ⇒ 零拒绝。节名由 `ElementRegistry` 派生——手写第二个节名清单在该用例上必红。全域：四个 docKey 的每个注册节都有角色，`### 设计决策留存` 的角色从注册表取值（骨架真值表随之增一行），面图的缺口即红。
- `doc-contract` **测量字面**：判据面裸写 `<整数> <单位>` 且单位在闭集内 ⇒ 报 `measure-literal`；改写成 `census:<id> = <n>` 且值与登记行相等 ⇒ 零拒绝；值不等 ⇒ 由 `contract/census.ts#CensusGate` 比对 `contract/census.ts#CensusTable` 后报出，报文与该形状行的不同（两条判据不许挤成一条）。单位不在闭集内的裸数 ⇒ 零拒绝（文法之外，不是判据）。
- `doc-contract` **行号坐标**：`第 N 行` · `line N` · 路径后接 `:N` 三种形态各成一条用例且各报一次；同一形态落在行内代码段里 ⇒ 零拒绝（本 spec 命名规则自身即依赖这一条）。
- `doc-contract` **算式与指示词**：各成对——活文件算式 ⇒ 报 `live-arithmetic`，写成「差值由某守卫维持」⇒ 零拒绝；挂在路径上的时序指示词 ⇒ 报 `temporal-indicator`，改写成「必须成立的条件」⇒ 零拒绝。
- `contract/invariants.ts#Finding` **严重度由规则行声明**：一条声明 warn 的规则在违规文档上不拒，且 `checked:` 面**该规则自己那一行**读作 `<rule id>: warned — <n> warning(s)`；把该行翻成 block 后同一文档被拒、该行读作 `<rule id>: failed`（与既有字节相同）；零命中时该行读 `passed`，字节不变。本相位末任务的 pin 断言「无一规则声明 warn」为真（自毁面可核，不是承诺）。
- `doc-contract` **范围按生命周期**：某总体 Phase inventory 的 Implementation plan 格读 `✔ Done（<file> · <date>）` 且文件名解析到本文件 ⇒ 该文档带任何违例都零拒绝；同一内容放进一个格中不被点名的文件 ⇒ 被拒（成对）。无任何总体时 ⇒ 被拒且报文含「无可用的闭合登记」。格中文件名零命中或多命中 ⇒ 形状门不认这项闭合 ⇒ 被拒（pin 面相反极性由既有用例守住）。single-spec 无格点名 ⇒ 判。
- **章程自修（本相位交付）**：`### Goal` / `### Non-goals` / `## Constraints` 三节改成条件句后 ⇒ 零拒绝；改回带时序措辞的原句 ⇒ 被拒（成对，同一份夹具只改这三节）。翻位之后以 `cdd review --type overall` 判本程序章程为同一个用例的终态。
- `change-history-row-shape` **记录面不新增规则**：历史行缺前导 ISO 日期 ⇒ 依旧由既有规则报（本相位不新增第二条）；同一行不带「测量方式」⇒ 零拒绝（提交信息不是文档）。面图把该节认作 record 是唯一增量。
- `evidence` **blocker 必填**：带 findings 的载体里 `severity: "blocker"` 而 `evidence` 缺席 ⇒ 载体被拒（`CDD_BLOCKED: evidence-missing`），本轮不推进、不记结论；`warn` 缺席 evidence ⇒ 通过。`repro` 为一条命令与为一个 `doc.md#section` 指针两种形态都通过（判断类 blocker 拿不出命令时不得被迫降档）。
- rulings **`probe` 在驳回时必填**：侧车里 `verdict: "rejected"` 而 `probe` 缺席 ⇒ 侧车不被接受；`verdict: "fixed"` 缺席 `probe` ⇒ 通过（改动本身即证据）；不带 `verdict` 的存量侧车 ⇒ 通过。
- `doc-contract` **一份住所**：同一判据句进两份未闭合文档的正文 ⇒ 两侧文件与两侧开头都被念出；同句搬进引用块 ⇒ 零拒绝；左侧闭合、右侧未闭合而含同一句 ⇒ 照报（单边比较）。
- `contract/doc-body.ts#DocBodyProjection` **身份面回归**：只追加一条 `## Change history` 行并 bump 版本 ⇒ `doc-revision` 摘要逐字节不变；判据面改一个词 ⇒ 变。本相位不为身份面新增判据，只留这一对回归防止被顺手改动。

## Constraints

- **门只拒不改**：任何拒绝都不移动、不改写、不删除文档；恢复归编排者。
- **一处定义**：面图、规则表、严重度都住在 `contract/` 的声明里，`face/` 不新起第二份清单。四条形状规则与一条重复规则都是 `rules.ts` 的行。
- **消费面守恒**：`next:` 字面 · 退出码 · `CDD_BLOCKED` 通道 · 既有拒绝报文逐字节不变；破坏性字节一律 changeset minor（D74）。
- **豁免必须自毁**：warn 位是本相位内的过渡值，不是永久档；pin 断言它在闭合时为假。
- **新增消费面指令只在消费面文件**：语言面（`cdd-spec-writer` 的三种 claim shape）与本相位同批落地，且只改表述不增段落——注册表外的标题一律不被接受。
- **不新造文档类型、不新造记录节、不改身份定义**：三条都是本相位明确不做的事。

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-11-20 | 首版：四组与验收。grilling Q1–Q17 落定的设计树——形状面（面图 / 四类可变量 / 严重度与自毁 / 生命周期范围 / 记录面正面形状）· 证据面（嵌套字段 / blocker 强制 / 裁定侧 probe / read 行尾）· 一份住所（3-gram 单边比 / 引用块豁免 / 不判行级事实）· 消费面（minor）。实测依据记在注册提交信息里，正文按本相位自己的规则书写 | [human] · Claude Opus 5（kairos:cdd-spec-writer） |
| v0.2 | 2026-11-20 | 首轮评审回填（fix 1）：面图落 `contract/declare.ts` 并补全域角色（`### 设计决策留存` 补成 facet 元素）· 测量字面改成 token 文法且以文法为规范 · 告警字节挂规则自己的 `checked:` 行（`warned` 档）· 闭合读 `contract/pins.ts#ForwardPaths` 并写出与 pin 面相反的极性 · 证据接缝复用 `gradingViolations` 加一条 `CRITERIA_ROWS` 行（`evidence-missing`）· 侧车改 `verdict` 与 `probe` 两键 · 删除 board 可见面整条 · 章程三节自修列为具名交付 · 消费面补五条 `checked:` 行与骨架真值表一行；正文按本相位自己的规则书写 | [human] · Claude Opus 5（kairos:cdd-spec-writer） |
