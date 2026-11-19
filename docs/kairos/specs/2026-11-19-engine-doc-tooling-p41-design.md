---
title: '文档声明的机检面 — Phase Spec'
doc-type: phase-spec
version: v0.9
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
- 面图对判的每个 docKey **全域**：域由一条可判的公式给出——注册表里**锚以标题字面起头**的元素（`## ` · `### ` · `#### `：节、charter facet、`### Task N:` 与其 `####` 字段、conditional 记录节、design 子节）；其余元素不欠角色——表格行与单元格、front-matter 键、`graph` 边，以及列表条目与 token 类锚（`Constraint delta bullet` · `Task id token` · `Constraint delta sub-heading` 一类）——它们的角色随所在节继承，故不另造第二张清单。没角色的域内元素即面图的缺口，而缺口本身就是这条规则的判词，不是沉默通过。
- `### 设计决策留存` 尚未成为注册表元素（无 anchor、无译名），它的名字只能手写，正是本节禁止的第二份清单——本相位把它补成一个可选 facet 元素，投影面按 §4 登记的三条走。**骨架面不动**：`contract/project.ts#Projector#projectDocSkeleton` 只为 `presence: "required"` 的元素发槽位，可选元素不进 `render/skeleton.ts#SkeletonAssembler` 的真值表；把该元素声明成 required 则每一份缺该节的总体文档都会被 `presence` 规则拒，那是语料面一次不可迁移的改动。
- `## Change history` 恒为 record——它是模板声明为 **required** 的唯一记录节；其余记录节（`## Deviations` · `## Incremental warning` · `## Notes for downstream` · `## Review record`）的角色按 §1.4 的逐 docKey 表取，两处不会读成两件事。不新造第二个记录节。
- 哪些节是 registration 由 §1.4 的全域面图逐节写出，本节不重抄那份清单。
- **不给行形状留席位**：同一节内按行切面，等于给「把判据写成记录形状」开后门。
- **角色的判词是三维的，不是两维的**：六条形状规则只判 `decision` 节；`record` 节上只有日期形状一行（`change-history-date-shape`）在判，其余五条对 `record` 不产判词；`registration` 节不判。分界是「这一节的句子是不是一条必须成立的条件」——register 记的是身份与位置，record 记的是发生过什么，两者都不是条件。三档因此不是「判」与「豁免」两档，而是「全判 · 一条判 · 不判」。

#### 1.2 判据面的四类可变量
- **测量字面**——非法形态按 **token 形状**定，不按语义类：机器没有「这条断言是否关于活的树」的分类器，所以判据是一条文法，不是一个含义。文法：散文里一个独立的十进制整数、一个空格、一个成词的计数单位，且单位落在规则行声明的闭集（`passed` · `failed` · `tests` · `files` · `rows` · `行` · `处` · `条`）；「独立」与「成词」是文法本身——小数与带点编号里的数字不是整数，汉字复合词里的同形字不是单位。合法形态只有一种：`census:<id> = <n>`——值由 `contract/census.ts#CensusTable` 供，比对由 `contract/census.ts#CensusGate` 做。**这条文法是本条的规范**：注册表里更宽或更窄的措辞以文法为准。
- **行号坐标**——`第 N 行` · `line N` · 路径后接 `:N`。
- **活文件算式**——判据是**文法**，不是「这条算式是否关于活的树」：散文里一个十进制整数、可选空格、一个运算符、可选空格、第二个十进制整数、可选空格、`=`、可选空格、第三个十进制整数。运算符字形是闭集：`−`（U+2212）· `-`（ASCII hyphen）· `–`（en dash）——三种字形同一判词，档位不因一个字符而分叉。三个操作数的来源（哪一棵树、哪个计数）**不在文法里**：机器没有「这条算式关于活的树」的分类器，故 `a − b = c` 一类形状一旦出现在散文里即违规，与两侧是不是活读数无关——行名里的「活」只是这条规则的由来，不是判据的一部分。合法形态只有一种：把它写成条件（「差值由某守卫维持」一类），不摆算式。
- **时序指示词**——`today` · `currently` · `今天` · `今日` · `仍`。断言必须写成「必须成立的条件」，不是「此刻的形状」。**挂载是文法，不是含义**：指示词所在的分句里必须出现一个**符号候选**才算违规——分句按 `，` · `；` · `。` · `·` · `——` 切分，符号候选是一个行内代码段，或一个带 `/` `.` `#` 的裸词元。孤立的副词因此零拒绝：`豁免面清单仍为空` 的分句里没有符号候选，而 `今日形面 schema get --output skeleton` 这一形带着符号，是本条要拦的形状。

四条形状规则是 `contract/rules.ts` 的**四行**（`measure-literal` · `line-coordinate` · `live-arithmetic` · `temporal-indicator`），冲突去重是另一行（`single-home`，见 §3.2），记录面的日期形状行见 §1.5：一行一条规则，一行的子腿不藏第二条规则。

扫描面**只读散文**：行内代码段与围栏块豁免。理由是必需的，不是宽容——本相位自己的 spec 必须能**命名**这四条规则，否则规则的第一份文档就违反了它自己。表格单元格**属于散文**（漂移大多发生在表里），照扫。代价说得清：把断言藏进行内代码段可以躲过这条门，那是另一类事（评审会读，门不装作能读）。

#### 1.3 严重度与自毁
- `contract/invariants.ts` 的 `Finding` 增 `severity: "block" | "warn"`，取值由 `rules.ts` 的行声明——规则表继续是唯一来源。
- 门判词：存在 block 即拒；warn 不拒。
- 告警的消费者字节挂在**规则自己的 `checked:` 行**上（`session/preflight.ts#PreFlight` 的规则行渲染，一行一条声明）：声明 `warn` 的规则命中时该行读作 `<rule id>: warned — <n> warning(s)`；未命中读 `passed`，声明 `block` 的规则命中读 `failed`——后两档与既有字节逐字节相同（消费面守恒），告警档是本相位唯一的新增形态。
- **`details` 只列 block 命中**：既有门把全部 finding 映进 `details`（一行一条 `kind@field: message`，行内不带档位标记；`session/preflight.ts#PreFlight` 的 `doc-contract` 分支），而档位现在由规则行声明——不过滤，同一次拒绝就把一条告警与真正的阻断并列，读者会照 `details` 去修一条本来不该修的行。故 `doc-contract` 的 `details` 行集过滤到 `severity: "block"`：前缀、字段分隔符与一行的形状逐字节不变，变的是行集。只有 warn 命中的文档不拒，故「`details` 为空」在报文面上不可见。混合档的成对用例见验收。
- **第三档不是 `passed`**：被判目标是闭合文档时（§1.4 的豁免），六条规则行读 `skipped (closed document)`——规则面自己的契约是「哪条规则跑了」与「它判了什么」不许漂移，一条从未跑过的规则读 `passed` 是在替它作证。无文档目标的派发读 `skipped (no doc target)`：两个原因两个词——这一面的集合是 `wave` 与 `branch` 两种派发（按派发类型定，不按 `--spec` 缺席定，§4），plan 面有文档目标，故它的六行照判。
- 自毁不是豁免层，是**本相位内的一个过渡值**：本相位落的**六条规则行一律 warn 起步**（四类可变量的四条 · `single-home` · 记录面的日期形状行），本相位最后一个任务把这六行的告警位翻成 block，并加一条 pin 断言「当前无一规则声明 warn」。pin 的断言跨全部规则行，故没有「翻了一半」的中间态被登记；`single-home` 的起步档也在这句里，不留给作者猜。

#### 1.4 适用范围由生命周期决定
- 形状门只判**所属相位未闭合**的文档。闭合不另立第二张表：读 `contract/pins.ts#ForwardPaths` 已解析的那份 Phase inventory（P37 §7.3 条件 ③ 的材料）——一行的 **Design spec 格与 Implementation plan 格都是命名格**，任一格写成 `✔ Done（<file> · <date>）` 时取其中的文件名，与 `path.basename(rel)` 比，恰一份命中才是闭合。两格同判是刻意的：相位 spec 与它的 plan 是同一份闭合登记的两个面，只认 plan 格等于让每一份闭合 spec 永远被判——而闭合 spec 是对一棵已不存在的树的记录。
- 形状门要的是**被证明的闭合**，而 `ForwardPaths` 对 pin 面要的是「未被证明的未闭合」（一份失效的登记不该买来一次静默跳过）——两者极性相反，读数同源。因此本相位把这一判定提为同一个类上的公开读数，形状门读「已证明」并保留 pin 面原有的极性：不增第二份材料、不增第二张表。
- 为什么不是「全量」：存量语料的违例量使全量硬门等于要求重写历史（实测记在注册提交里）——而闭合相位的文档是对一棵已不存在的树的记录，再审它正是本相位要治的病。
- 为什么不是「行级基线」：那要新增一份基线产物，并与 `doc-drift` 的身份面争夺「什么是这一版」。
- **没有总体文档时闭合不可证 ⇒ 判**，且既有 `doc-contract` 拒绝上多一条 `details` 行直说「无可用的闭合登记」——不静默豁免。通道是既有的拒绝说明，不是新增 `checked:` 行：`checked:` 的每一行对应一条规则声明，而「本仓没有总体、闭合不可证」是这次判定所依据的材料缺席，不是某条规则的命中。触发条件收窄：被判文档在树上一个总体都没有时出现；有总体、但没有任何一行的命名格点名本文件时不出现——那是「未闭合」，不是「不可证」。宁可让一个没有程序的仓被判，也不让门在一个永不闭合的仓里变成空门。
- 为什么不是「ratchet（冻结上限）」：那会把存量违例永久赦免，直接违反「不留豁免层」。
- **plan 的 front matter 没有 `program:`**（只有 phase-spec 有），故闭合按「任一总体的 Phase inventory 命名格是否点名本文件」判，不按 front-matter 链判——给 plan 补 `program:` 对存量文档无从补起，补不上就判不出闭合，判不出闭合就豁免不了，语料不可迁移。
- overall 与 single-spec 无格点名 ⇒ 一律判。全域面图逐节写角色：
  - overall：`## Document scope` · `## Program charter` · `### Goal` · `### Non-goals` · `### Cross-cutting` · `## Boundary rules` · `## Constraints` · `## Maintenance` 为 **decision**；`## File paths` · `## Issue inventory`（含其下两个 `####` facet：`#### [MFRBEN] group` · `#### Upstream Endorsements`）· `## Phase inventory` · `## Dependency graph` · `### 设计决策留存` 为 **registration**；`## Change history` 为 record。
  - phase-spec：`## Design`（含 `### N.` 与 `#### N.M` 所辖正文）· `### Acceptance criteria` · `## Constraints` 为 decision；`## Deviations` · `## Incremental warning` · `## Notes for downstream` · `## Review record` · `## Change history` 为 record。
  - plan：task 块（`### Task N:` 与其 `####` 字段，含 Steps）· `## Constraints`（含其下的 `###` 子节）为 decision；`## Change history` 为 record。
  - single-spec：`## Background & root cause` · `## Design decisions` · `## Acceptance` · `## Constraints` 为 decision；`## Change history` 为 record。
- **本相位修自己的章程**：翻位把「总是判」施于 overall 之后，本程序章程自身会在五节被判据面拒——`### Goal` / `### Non-goals` / `### Cross-cutting` / `## Boundary rules` / `## Constraints`，那里把命令清单、例外面与模板形面挂在一个符号上，用的是时序措辞；`### Non-goals` 那一颗子弹还带一处测量字面（`运行时依赖读 package.json#dependencies（今日 13 条：…）`），它是两个文法的交点，不是其中一条的样本。所以本相位有一个具名交付：把这五节改写成条件句，那颗子弹的计数要么删掉、要么写成 `census:<id> = <n>` 的合法形态，并让自修由**三族齐零**收口——两个文法（时序指示词与测量字面）各自零命中，**且** `single-home` 在章程上零命中。第三足不是附赠：章程对闭合域没有格点名 ⇒ 一律被判（上一条），而 `single-home` 的右侧是除本文件外的全部文档、含已闭合文档（§3.2），所以「两个文法齐零」不足以让翻位之后的章程过门。成对用例随之成四足：改回原句 ⇒ 被判据面拒；两个文法修净而重复句留着 ⇒ 被 `single-home` 拒；三族齐零 ⇒ 零拒绝；第四对判指针自身——按本节收窄后的措辞写（只点名持有者的节）⇒ 零拒绝，换成携带判据标签的复述 ⇒ 与本节的同源句命中 `single-home` 而拒。五节而不是三节按形状算，不按「已知的坏句」算：`### Cross-cutting` 与 `## Boundary rules` 带的是同一个「把此刻形状写成断言」的句式，只修三节会让翻位之后的章程被判——而「章程自身可评审」正是这条交付的目的。
- 第三族在章程上有两处实账，处置都是**指针**而不是删句：章程把每条判据留一处，写成点名持有者的指针句——不复述原句，因为复述会让右侧的同源文档在 `single-home` 上命中。
  - 「doc-contract 判定语义不变 · 骨架不是 gate 豁免通道」（章程的 `### Cross-cutting`，`### Non-goals` 与 `## Boundary rules` 另有同源两处）：三处同源表述收敛成一处指针，指向这三份 design 与一份 plan 的 `## Constraints`；四份的路径依次是 `docs/kairos/specs/2026-10-10-engine-doc-tooling-p3-design.md` · `docs/kairos/specs/2026-10-10-engine-doc-tooling-p4-design.md` · `docs/kairos/specs/2026-10-10-engine-doc-tooling-p5-design.md` · `docs/kairos/plans/2026-10-10-engine-doc-tooling-p4.md`。
  - 「不发布 · changesets 收尾到可发布态即止」（章程的 `## Constraints`，`### Non-goals` 另有同源一处）：两处收敛成一处指针，指向 P13 design 的 `## Constraints`；P13 design 的路径是 `docs/kairos/specs/2026-10-10-engine-doc-tooling-p13-design.md`，指针只点名节，不带判据标签、也不复述原句。
- 指针句自身也要过 `single-home`，而且过两对：对持有者文档不得同形，对本节给出的措辞面也不得同形——章程是被判文档，本 spec 的句子落在它右侧的比较域里。措辞因此收窄到**只点名持有者所在的节**（`见 <path> 的 ## Constraints`），不携带本节的判据标签，也不复述原句。**章程的写入由编排者执行**——本相位给判据与措辞面，fix 轮不写章程。
- **刻意接受**：闭合文档不再被形状门约束。改它就等于改历史，而评审不该因为记录而重开。

#### 1.5 记录面只判日期形状
- 「前导 ISO 日期」**立为本相位的一条规则行**（`change-history-date-shape`）：注册元素 `Change history date` 的模式是**惰性**的——`DomainInvariant` 经选择器取候选节点，而那个选择器的单元格匹配就是模式本身，不匹配即无候选，于是违规从不上报。判词改由一条规则行持有，而取值只有一个来源——该元素声明的 `valuePattern`（声明面与判据面同读）。报文首发是规则行 id，不借 `change-history-row-shape`——那一行判的是行宽与表头对齐，让它认领日期格等于把两条判据挤成一条。
- 「这条读数是怎么取的」**不进文档**：住 fix 轮的提交信息。加第五列是 schema 破坏（表头列集门 + 全部存量文档 + 骨架模板三处同改），而提交信息本身就是痕，且不占文档字节。
- 因此 record 面的增量是两项：**日期形状一条规则** + **面图把该节认作 record**（从而豁免）。

### 2. 证据面
#### 2.1 字段
- finding 增 `evidence: { repro, output? }`——嵌套让「有没有证据」成为可判的存在性。
- **没有 `claim` 字段**：finding 的 `summary` 就是那条断言，再抄一遍是同一事实的第二个住所。
- `repro` 的语义是**读者能在哪里自己核这条断言**：一条命令，或一个 `doc.md#section` 指针。两者皆可，但必须是**非空白串**——存在性判的是 `trim()` 之后非空，与 `impact.scenario` 的 `scenario.trim().length > 0` 同一把尺；一个空白串不是证据。
- `output` 长时可给路径；要点是字节存在于编排者可读之处。
- 字段的声明面只有一处：`session/handoff-schema.ts#HandoffSchema` 的 findings 条目，与 `impact` / `contract` 同层。

#### 2.2 强制面
- `severity: "blocker"` 而缺 evidence ⇒ 载体被拒（`contract-violation`），本轮作废；`evidence.repro` 在场但为空白串 ⇒ 同样被拒——存在性问的是「有没有可核的字节」，不是「有没有那个键」。blocker 是唯一逼人采纳结论的档，一条无法核的 blocker 被采纳的代价高于一轮。
- warn / nit 留空合法。
- 适用全部落在**判平面**的派发：`review`，连同它在同一平面上的 wave 与 branch 形态——`session/handoff-schema.ts#HandoffSchema.planeOf` 按 op 取平面，wave 与 branch 是同一平面的两种派发，不是另外的载体。**fix 不在其中**：它是 `work` 平面（可写 `status` · `artifacts` · `notes` · `dispositions`，无 `findings` 槽），fix 草稿写的是按 finding id 挂的裁定，不带 severity，故不欠这条举证。
- **接缝是既有的那一条，不新起第二条**：判定挂在 `session/handoff-schema.ts#HandoffSchema.gradingViolations` 的同一个草稿回读路径上（`face/lifecycle.ts`），判据本体是 `contract/review-criteria.ts#CRITERIA_ROWS` 的 `evidence-missing` 行。报文首词是判据行 id——`CDD_BLOCKED: evidence-missing:`——正文照 `grading-impact-missing` 那一行的形状，列出每个违规 finding 的 id 与 summary。blocker 档因此有两处举证：`impact.scenario`（P37）· `evidence.repro`（本相位）。该行同时进 `CriteriaRegistry.renderRubric` 的 blocker 片段——即每次 review 派发的 `SEVERITY_RUBRIC` 字节（§4 登记），`contract/__tests__/review-criteria.test.ts` 的 id 名册与 `gate` 档断言同批更新。**语料面随动**：`CRITERIA_ROWS` 多一行即 `criteria.rows` 的测量值由 `5` 变 `6`（`contract/census.ts#censusTableOf` 量的是行数）。`census:criteria.rows` 这条引用在闭集的 P37 对里恰好四处，写的都是旧值，四处与本相位同批逐字改成 `6`，逐处点名为：
  - `docs/kairos/specs/2026-11-16-engine-doc-tooling-p37-design.md` 的 `§1.3`（反例句节）与 `§6.1`（两张表的行形态）各一处——两处都在判据面；
  - 同一份 P37 design 的 `## Change history` 的 `v0.13` 行一处——**这是记录行**；
  - `docs/kairos/plans/2026-11-16-engine-doc-tooling-p37.md` 的 `### Task 8` 的 `#### Steps` 一处。
- **记录行的处置是显式覆盖，不是沉默例外**：章程 `v4.10` 行立的纪律是「历史行记录当时被相信的字节，更正写在本行」，这里走的是相反的那一支，理由是 `census:<id> = <n>` 是**测量值**而不是判断——门量的是本轮的判据表（`criteria.rows` 的供值是 `CRITERIA_ROWS.length`），记录行里的旧读数不会因为被保留而变真，留下它只会让语料守卫一直红。另一条路是让 `CensusGate` 豁免 `## Change history`——那是一条本相位不注册的规则，故不采用。改的是数值，不是那一行记录的那次判断。
- `contract/__tests__/census.guard.test.ts` 是这四处的门：批量改完之后它对 `criteria.rows` 零失配。
- **本相位自己的 plan 也是语料的一行**，故语料面有一个**实现前窗口**，判据写在这里，不留给作者现场推导：plan 落在 `docs/kairos/plans/` 下，`CensusGate` 对它的读数与任何文档同判。窗口内三条纪律——① `criteria.rows` 的新值属**判据行落地之后**的形状，落地之前不得写进任何文档的正文（本相位的 plan 与验收面也不例外）作为活引用，写进去的那一天语料守卫即红；② `census:pin.total` 同理，plan 里指向待创建符号的 pin 在符号落地前不计入，故它的声明值取登记面当下的导出值，不取实现后的目标值；③ 语料规模常量（`contract/__tests__/pins.guard.test.ts` 的 `CORPUS_SIZE`）随 plan 落地同批上调——它与前两条不同类：前两条是测量引用，红会随实现自愈；规模常量是一条必须与语料同步的**判断**，不随任何实现自愈，故它属于同批义务而不是窗口宽限。窗口两侧的判据因此分开：引用类失配是实现前的预期红，规模常量失配是当场红。
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
- 豁免：引用块与代码围栏，两者都按**行形态**判，不按树节点。引用块是行首 `>` 起的连续块；围栏块按围栏标记判（`contract/pins.ts#PinSpans` 的围栏跳过是同一个判法）。`MarkdownTree` 的 `Walk` 不暴露引用块——它的结构走法只有 frontmatter · heading · table · row · cell · list · taskField · taskStep · graphEdge 九种，故豁免不走树；两种行形态的判定与围栏跳过同住一处，`## Constraints` 的「一处定义」因此不破。要引判据就摆在引用块里，看得见、审得出。

#### 3.2 比较域是单边的
- 左侧 = 在范围内的文档，右侧 = **除本文件之外**的全部文档。自比不计：右侧若含本文件，它的每一句都和自己同形，判据在任何文档上都恒真——这条排除是判据的一部分，不留给实现者顺手加。漂移的方向永远是「新的抄旧的然后各自演化」；反向不存在。
- **同一 run 的一对不互比**：`slug:` 相同的 spec 与 plan 是同一份设计的两面——plan 的 `#### Acceptance` 本来就是 spec 判据的可核形态，判它们互抄等于判死每一份 plan。故比较按 `slug:` 分组：一份文档只与**不同 slug** 的文档比。这条不收窄评审面实测到的那一类：章程与相位文档的 slug 各不相同（章程的 slug 是程序名，相位文档的是 `<date>-<program>-pN-design`），所以章程对相位文档的复述照旧被判。
- **分组与判据同批登记**：分组不是实现细节，它有正负两臂（验收的「一份住所」一条）——缺了分组，正臂照绿而负臂红。它的登记面是章程：P41 验收 ⑥ 按本节的同 slug 例外重述，章程的写入由编排者执行（§4 交付面的第三笔），因为 ⑥ 住在 `## Phase inventory`，那是注册节，五节自修够不到它。
- 这是 `doc-contract` 的一条规则行（重复规则那一行），不是新腿——同一扇门、同一张规则表。

#### 3.3 不判什么
- 不判行级事实（`- Create:` / `- Modify:` 与载具表点名同一个文件）。那是**两件事**：一个是时间面，一个是归属面；判它等于判死现行模板。
- 不判「同一条判据的两种不同说法」：那需要一个语义判据，机器没有。

### 4. 消费面
- 新增：`doc-contract` 的六条规则行出现在**每次派发**的 `checked:` 面（`measure-literal` · `line-coordinate` · `live-arithmetic` · `temporal-indicator` · `single-home` · `change-history-date-shape`），且告警档命中时该行读作 `<rule id>: warned — <n> warning(s)`。无文档目标的派发读 `skipped (no doc target)`，条数与位置不变；这个面的集合由**派发类型**给出，不由「有没有 `--spec`」给出——`session/preflight.ts#PreFlight#docOutcomeOf` 只对 `wave` 与 `branch` 两种派发返回 `no-doc-target`。plan 面有文档目标（`face/declare.ts#REQUIRED_GROUPS` 的 `review.plan` 组要求 `--plan`，故 `ctx.doc` 非空，而 plan 是 §1.4 的 docKey 之一），它的六行照判：`passed` / `failed` / `warned`，不读 `skipped (no doc target)`。因此 wave / branch 的预览字节同样变，入册面是每一次派发，不是带文档那一档。
- 新增：闭合文档的六条规则行读 `skipped (closed document)`（§1.3 · §1.4）——闭合让文档被判据面豁免，而规则行不许用 `passed` 替一条从未跑过的规则作证。`skipped (no doc target)` 那一条不动：两个原因两个词。
- 新增：`SEVERITY_RUBRIC` 的 blocker 片段增一行（`evidence-missing` 的判据行）⇒ 每次 review 派发的 prompt 字节随之变化；`contract/__tests__/review-criteria.test.ts` 的 id 名册与 `gate` 档断言同批更新。同批随动的是语料面：`census:criteria.rows` 的值由 `5` 变 `6`，闭集 P37 对里声明它的四行同批改（§2.2），`contract/__tests__/census.guard.test.ts` 是它们的门。
- 新增：`packages/kairos/skills/cdd-spec-writer/SKILL.md` 的 `author-spec` 节点与 `packages/kairos/skills/cdd-plan/SKILL.md` 的 `author-plan` 节点，同一份三种 claim shape 的表述面（`## Constraints` 的「只改表述不增段落」）——三条各占一行，不多一条段落，每条点名它对应的规则行；标题面由既有 skill-anatomy 用例守恒，三行本身由验收臂的逐字对读守恒（既有用例不数段落）。plan 的 task 块（含 `#### Steps`）与 `## Constraints` 是判定面里体量最大的一块，且本相位自己的 plan 落在被判集里，故 plan 的作者拿到的是同一份说明书。最终措辞就是下面引文，两处照抄、不另造：

```
- **pin** — a behavior claim cites a colocated pin by module path + symbol name; a line coordinate is not a pin (`line-coordinate`)
- **count** — a count is stated only as `census:<id> = <n>`, the id taken from the census registry; a bare integer plus a count unit in prose is refused (`measure-literal`), as is an arithmetic over live counts (`live-arithmetic`); naming the guard that maintains the value is the reason for the reference, not its form
- **narrative** — a present-tense description of the tree as it stands belongs to the plan; restate it as the condition that must hold (`temporal-indicator`)
```

- 新增：`CDD_BLOCKED: evidence-missing:` 一种拒绝报文；finding 的 `evidence` 嵌套键是它的输入面。
- 新增：rulings 侧车两个可机检键 `verdict`（闭集 `fixed` | `rejected`）与 `probe`。
- 新增：`schema get overall` 的 json 面——`### 设计决策留存` 补成一个可选 facet 元素（§1.1）：json 面的 `properties` 多一条（该元素带 `valuePattern`）、`shape` 的 facet 组多一条、`slices` 多一行。**骨架面不动**：`--output skeleton` 的字节逐字节不变，投影器只为 `presence: "required"` 的元素发槽位，可选元素没有骨架行；入册面是这三个投影，不是每一个 `--output`。
- 新增：既有 `doc-contract` 拒绝上的一条 `details` 行——字面「无可用的闭合登记」（§1.4），只在被判目标是文档、且树上一个总体都没有时出现；有总体而没有格点名本文件时不出现（那是未闭合）。拒绝码与其余 `details` 行不变。
- 新增：`contract/pins.ts#ForwardPaths` 上一条公开的闭合读数（§1.4）——同一个类、同一份材料，供形状门读；不经 `checked:` 面，不改报文。
- 不动：退出码表 · `CDD_BLOCKED` 通道 · 既有拒绝报文 · `next:` 字面 · 身份与漂移判据 · 分级判收敛 · **board 的任何字节**（§2 不再有可见面交付）。
- 本相位自身的交付面（章程）：把 `### Goal` · `### Non-goals` · `### Cross-cutting` · `## Boundary rules` · `## Constraints` 五节改成条件句，两文法零命中**且** `single-home` 在章程上零命中（§1.4）；`### Non-goals` 那一颗子弹同时带时序指示词与测量字面，故计数随句改、其余四节只改句式。同批落地的是两处重复句的指针处置（§1.4）：gate 判据指向 P3 · P4 · P5 三份 design 与 P4 plan 的 `## Constraints`，发布姿态指向 P13 design 的 `## Constraints`。**第三笔是验收回填**：章程 `## Phase inventory` 的 P41 验收 ⑥ 按 §3.2 的同 slug 例外重述（「同句进两份未闭合文档 ⇒ 两侧都念」加一句「同一份设计的 spec 与 plan 除外」），并在章程的 `## Change history` 记一行——章程自己的规矩是「变更先回填本 overall（backfill-as-version），再继续实现」，而 ⑥ 住在注册节，五节自修够不到它；不回填就等于让实现面写一条与登记面相反的判据。交付面因此是「五节条件句 + 两处指针 + 一处验收回填」，改的是文档内容，不动报文；章程的写入由编排者执行，本相位只给判据、措辞面与那一句回填文字。
- 版本级按 D74：方法论契约不变 ⇒ changeset **minor**。

### Acceptance criteria

- `contract/declare.ts` **面图即声明**：同一行文案只落在 `## Change history` ⇒ 零拒绝；同一行搬进判据面 ⇒ 该行报 `line-coordinate`（成对，同一份夹具只改位置）。overall 面：`## Constraints` 带坐标 ⇒ 被拒，设计决策留存里同一形态 ⇒ 零拒绝。节名由 `ElementRegistry` 派生——手写第二个节名清单在该用例上必红。全域：四个 docKey 的**面图域内**每个注册元素都有角色（锚以标题字面起头的那些），`### 设计决策留存` 的角色从注册表取值（它的三个投影——json `properties` · `shape` facet 组 · `slices`——各增一条，`--output skeleton` 的字节不变），面图的缺口即红；列表条目、token 类锚、表格行与 front-matter 键随所在节继承角色，为它们造第二张角色表在该用例上必红。
- `doc-contract` **测量字面**：判据面裸写 `<整数> <单位>` 且单位在闭集内 ⇒ 报 `measure-literal`；改写成 `census:<id> = <n>` 且值与登记行相等 ⇒ 零拒绝；值不等 ⇒ 由 `contract/census.ts#CensusGate` 在语料守卫 `contract/__tests__/census.guard.test.ts` 里报出，报文与该形状行的不同（两条判据不许挤成一条）；门面不因此增第七条规则行——六条规则行的清单不动，这一支读的是语料守卫的报告。单位不在闭集内的裸数 ⇒ 零拒绝（文法之外，不是判据）。语料面同批一件事：`criteria.rows` 的测量值变 `6` 之后，§2.2 点名的四处引用（含 P37 design 的 `## Change history` 的 `v0.13` 记录行）逐字改成 `6`，`contract/__tests__/census.guard.test.ts` 对这条 id 零失配——记录行走 §2.2 登记的显式覆盖分支，不留给作者猜。实现前窗口的终态在这条臂上同样成立：批落地之后 `census.guard.test.ts` 与 `pins.guard.test.ts` 都绿，且语料规模常量等于批后的语料文件数——窗口内预写目标值 ⇒ 红，与语料同批上调 ⇒ 绿（成对）。
- `doc-contract` **行号坐标**：`第 N 行` · `line N` · 路径后接 `:N` 三种形态各成一条用例且各报一次；同一形态落在行内代码段里 ⇒ 零拒绝（本 spec 命名规则自身即依赖这一条）。
- `doc-contract` **算式与指示词**：各成对——活文件算式 ⇒ 报 `live-arithmetic`：三份夹具只差运算符字形，`249 - 1777 = 0`（ASCII hyphen）· `249 – 1777 = 0`（en dash）· `249 − 1777 = 0`（U+2212）各报一次，分类不因一个字符而变；写成「差值由某守卫维持」⇒ 零拒绝；挂在符号上的时序指示词 ⇒ 报 `temporal-indicator`，改写成「必须成立的条件」⇒ 零拒绝；**孤立的副词**（`豁免面清单仍为空` 那一形）⇒ 零拒绝——这一支是反证用例，防闭集误伤散文。
- `contract/invariants.ts#Finding` **严重度由规则行声明**：一条声明 warn 的规则在违规文档上不拒，且 `checked:` 面**该规则自己那一行**读作 `<rule id>: warned — <n> warning(s)`；把该行翻成 block 后同一文档被拒、该行读作 `<rule id>: failed`（与既有字节相同）；零命中时该行读 `passed`，字节不变。起步档是**六条规则行全 warn**（四类可变量 · `single-home` · 日期形状），本相位末任务同批翻成 block，pin 断言「无一规则声明 warn」为真（自毁面可核，不是承诺）。混合档一条：同一份夹具上一条 block 规则命中、一条 warn 规则命中 ⇒ 只拒一次，`details` 只列 block 那一条（warn 那一条的 `kind@field` 不在报文里），`checked:` 面 block 行读 `failed`、warn 行读 `warned — 1 warning(s)`。
- `doc-contract` **范围按生命周期**：某总体 Phase inventory 的两个命名格（`Design spec` · `Implementation plan`）各是一条用例——该格读 `✔ Done（<file> · <date>）` 且文件名解析到本文件 ⇒ 该文档的六条形状规则行对任何违例都读 `skipped (closed document)`，其余规则照判（spec 与 plan 两形各一条），同一内容放进两格都不点名的文件 ⇒ 被拒（成对）。无任何总体时 ⇒ 被拒且报文含「无可用的闭合登记」（该字面住既有 `doc-contract` 拒绝的一条 `details` 行，§1.4 · §4）。格中文件名零命中或多命中 ⇒ 形状门不认这项闭合 ⇒ 被拒（pin 面相反极性由既有用例守住）。single-spec 无格点名 ⇒ 判。闭合文档的规则行 ⇒ 六行都读 `skipped (closed document)`（成对：同一份违例内容放进未闭合的副本 ⇒ 各行对那几条违例读 `failed`）；`skipped (no doc target)` 的面按**派发类型**定，不由 `--spec` 缺席定：一份带一处违例的 plan 作为夹具，用 `review --type plan` 判 ⇒ 命中的那条规则行读 `failed`、其余五行读 `passed`，六行都不读 `skipped (no doc target)`；同一份内容作为 `wave` 派发 ⇒ 六行全读 `skipped (no doc target)`（成对，只改派发类型）。
- **章程自修（本相位交付）**：`### Goal` / `### Non-goals` / `### Cross-cutting` / `## Boundary rules` / `## Constraints` 五节改成条件句后 ⇒ 零拒绝——**三族齐零**才是这一臂的判据：两个文法（时序指示词与测量字面）各自零命中，**且** `single-home` 在章程上零命中，不是只看时序一条；两个文法修净而重复句留着 ⇒ 被 `single-home` 拒（成对：这一对只改重复句）；指针句是第四对——只点名持有者的节 ⇒ 零拒绝，携带判据标签的复述 ⇒ 与本节 §1.4 的同源句命中 `single-home` 而拒；改回原句 ⇒ 被拒（成对，同一份夹具只改这五节），命中八处：`### Goal` · `### Cross-cutting` · `## Boundary rules` 各一处 `temporal-indicator`，`## Constraints` 两处 `temporal-indicator`，`### Non-goals` 一节三处——`temporal-indicator` 两处加 `measure-literal` 一处（那颗子弹的 `13 条`）——故这一臂到不了「时序一条全包」。原句的引证走行内代码段，不为新需求开引用块豁免。翻位之后以 `cdd review --type overall --spec docs/kairos/overalls/2026-10-10-engine-doc-tooling-overall.md` 判本程序章程为同一个用例的终态。
- `doc-contract` **记录面日期形状**：历史行的日期格写成 `xxx` ⇒ 该行报 `change-history-date-shape`（成对：改回 ISO 日期 ⇒ 零拒绝，同一份夹具只改那一格）；同一夹具下 `change-history-row-shape` 与 `change-history-header-columns` 都零拒绝——日期不借那两行的判词。同一行不带「测量方式」⇒ 零拒绝（提交信息不是文档）。面图把该节认作 record 的一笔随 §1.4 的逐 docKey 表落。
- `evidence` **blocker 必填**：带 findings 的载体里 `severity: "blocker"` 而 `evidence` 缺席 ⇒ 载体被拒（`CDD_BLOCKED: evidence-missing`），本轮不推进、不记结论；`warn` 缺席 evidence ⇒ 通过。`repro` 为一条命令与为一个 `doc.md#section` 指针两种形态都通过（判断类 blocker 拿不出命令时不得被迫降档），而 `repro` 为空白串 ⇒ 被拒（成对：缺席一形与 `" "` 一形各一条用例，两条都读同一个拒绝报文）；fix 草稿带 `dispositions` 而无 `findings` 槽 ⇒ 不欠这条义务（`work` 平面没有 findings）；判据行进 `SEVERITY_RUBRIC` ⇒ `renderRubric` 的 blocker 片段与 `review-criteria.test.ts` 的 id 名册同批更新。
- rulings **`probe` 在驳回时必填**：侧车里 `verdict: "rejected"` 而 `probe` 缺席 ⇒ 侧车不被接受；`verdict: "fixed"` 缺席 `probe` ⇒ 通过（改动本身即证据）；不带 `verdict` 的存量侧车 ⇒ 通过。
- `doc-contract` **一份住所**：同一判据句进两份**不同 slug**、都未闭合的文档正文 ⇒ 两侧文件与两侧开头都被念出；同一句同时出现在一份闭合文档与一份**不同 slug** 的未闭合文档 ⇒ 照报：左侧是那份未闭合文档，右侧把那份闭合文档念出（闭合只让它不被判，不豁免右侧的语料）；**同 slug 的负向对照**：两份 `slug:` 相同的文档（一份 spec 与它的 plan）各带同一句、且该句越过判据的长度与相似度门 ⇒ 零拒绝——这条是分组缺席时的红灯，不写分组的实现在它上面必红，而上面那条不同 slug 的正向臂要求同句照报（两侧成对，只改一侧的 `slug:`）；同句搬进引用块 ⇒ 零拒绝；本文件与自己的同一句 ⇒ 零拒绝（右侧不含本文件）。
- `cdd-spec-writer` · `cdd-plan` **claim shape 与规则行对齐（本相位交付）**：两个 skill 的 `author-spec` 与 `author-plan` 节点各为三条（`pin` · `count` · `narrative`），每条点名它对应的规则行——少一条、多一条或某条不点名规则行 ⇒ 红；标题面由既有 skill-anatomy 用例守（注册表外的标题不被接受），三行本身由逐字对读守住（既有用例不数段落）。验收把 §4 的同一段引文与两个节点逐字对读，任一节点措辞漂一个词即红。
- `contract/doc-body.ts#DocBodyProjection` **身份面回归**：只追加一条 `## Change history` 行并 bump 版本 ⇒ `doc-revision` 摘要逐字节不变；判据面改一个词 ⇒ 变。本相位不为身份面新增判据，只留这一对回归防止被顺手改动。

## Constraints

- **门只拒不改**：任何拒绝都不移动、不改写、不删除文档；恢复归编排者。
- **一处定义**：面图、规则表、严重度都住在 `contract/` 的声明里，`face/` 不新起第二份清单。六条 `doc-contract` 规则行（四类可变量 · 重复规则 · 日期形状）都是 `rules.ts` 的行。
- **消费面守恒**：`next:` 字面 · 退出码 · `CDD_BLOCKED` 通道 · 既有拒绝报文逐字节不变；破坏性字节一律 changeset minor（D74）。
- **豁免必须自毁**：warn 位是本相位内的过渡值，不是永久档；pin 断言它在闭合时为假。
- **新增消费面指令只在消费面文件**：语言面（`cdd-spec-writer` 的 `author-spec` 与 `cdd-plan` 的 `author-plan`，同一组三种 claim shape）与本相位同批落地，且只改表述不增段落——注册表外的标题一律不被接受。
- **不新造文档类型、不新造记录节、不改身份定义**：三条都是本相位明确不做的事。

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.9 | 2026-11-20 | 第七轮评审回填（fix 7）：① **同 slug 例外补上自己的验收臂**——一份住所的正臂收窄到不同 slug，另加一条负向对照（同 slug 两份带同一句 ⇒ 零拒绝），不写分组的实现在负臂必红；② **章程验收 ⑥ 的回填写进交付面**——同 slug 例外在章程 `## Phase inventory` 重述并记一行变更史（⑥ 住注册节，五节自修够不到它，而章程自己的规矩是先回填再实现），§3.2 同批点名这条登记面；③ **§2.2 补实现前窗口**——本相位自己的 plan 是语料的一行，`criteria.rows` 与 `pin.total` 的新值不得在行落地前写成活引用（引用类失配随实现自愈），而语料规模常量是判断不是引用、随 plan 同批上调，验收臂补窗口终态成对；④ **§1.1 补角色的三维判词**——六条规则只判 `decision`，`record` 上只有日期形状一行，`registration` 不判，使 172 处注册节命中不被误判。正文按本相位自己的规则书写 | [human] · Claude Opus 5（kairos:cdd-spec-writer） |
| v0.8 | 2026-11-20 | **plan 阶段回填（backfill-design）**：起草 plan 时撞到一处设计缺口——`single-home` 的比对面会让**同一份设计的 spec 与 plan 互判**，而 plan 的 `#### Acceptance` 本来就是 spec 判据的可核形态，那会把每一份 plan 判成违规。⇒ §3.2 增同 slug 豁免：一篇只与**不同 slug** 的文档比。评审面实测到的章程那一类不受影响（章程与各相位文档 slug 互不相同），故这条是缺口补全，不是收紧判据 | [human] · Claude（kairos:cdd-plan · backfill-design） |
| v0.1 | 2026-11-20 | 首版：四组与验收。grilling Q1–Q17 落定的设计树——形状面（面图 / 四类可变量 / 严重度与自毁 / 生命周期范围 / 记录面正面形状）· 证据面（嵌套字段 / blocker 强制 / 裁定侧 probe / read 行尾）· 一份住所（3-gram 单边比 / 引用块豁免 / 不判行级事实）· 消费面（minor）。实测依据记在注册提交信息里，正文按本相位自己的规则书写 | [human] · Claude Opus 5（kairos:cdd-spec-writer） |
| v0.2 | 2026-11-20 | 首轮评审回填（fix 1）：面图落 `contract/declare.ts` 并补全域角色（`### 设计决策留存` 补成 facet 元素）· 测量字面改成 token 文法且以文法为规范 · 告警字节挂规则自己的 `checked:` 行（`warned` 档）· 闭合读 `contract/pins.ts#ForwardPaths` 并写出与 pin 面相反的极性 · 证据接缝复用 `gradingViolations` 加一条 `CRITERIA_ROWS` 行（`evidence-missing`）· 侧车改 `verdict` 与 `probe` 两键 · 删除 board 可见面整条 · 章程三节自修列为具名交付 · 消费面补五条 `checked:` 行与骨架真值表一行；正文按本相位自己的规则书写 | [human] · Claude Opus 5（kairos:cdd-spec-writer） |
| v0.3 | 2026-11-20 | 第二轮评审回填（fix 2）：日期形状立为 `doc-contract` 的规则行 `change-history-date-shape`（注册元素的模式惰性，故判词由规则行持有，不借 `change-history-row-shape`）· 时序闭集加 `今日` 并把挂载写成文法（同一分句内要有符号候选，孤立副词不报，附反证用例）· 章程自修从三节扩到五节（`### Cross-cutting` 与 `## Boundary rules` 同病）· 面图的域收为「锚以标题字面起头的元素」并补两个 `####` facet · 闭合读两格命名（相位 spec 与 plan 同判）· 六条规则行一律 warn 起步、末任务同批翻 block · 证据面去掉 `fix` 载体（work 平面无 findings）· `SEVERITY_RUBRIC` 与 json 面字节入册 · 重复规则右侧排除本文件 · 正文按本相位自己的规则书写 | [human] · Claude Opus 5（kairos:cdd-spec-writer） |
| v0.4 | 2026-11-20 | 第三轮评审回填（fix 3）：① **骨架面按编排者裁定删净**——`### 设计决策留存` 是可选 facet 元素，投影器只为 `presence: "required"` 的元素发骨架槽位，故 §1.1 · §4 · 验收 ① 同时删去「骨架真值表增一行」，入册改为 json `properties` · `shape` facet 组 · `slices` 三面并写明 `--output skeleton` 字节不变；② **章程自修的判据改成两个文法都满足**——`### Non-goals` 那颗子弹同时带时序指示词与测量字面，原句在五节上命中八处（`## Constraints` 与 `### Non-goals` 各不止一处），验收臂改成逐节点名而非「时序一条全包」，原句引证走行内代码段、不开引用块豁免；③ **无总体时的「无可用的闭合登记」指定通道**——既有 `doc-contract` 拒绝上的一条 `details` 行，触发条件收窄为「被判目标是文档且树上一个总体都没有」，有总体而不点名本文件时不出现；④ **语料随动入册**——`criteria.rows` 由 5 变 6，闭集 P37 对的四处声明同批改，语料守卫是它们的门；⑤ 六条 `checked:` 行改为每次派发（无文档目标读 `skipped (no doc target)`）；⑥ 测量字面的语料比对归语料守卫，门面不增第七条规则行；⑦ 单边比较的验收臂改写成「闭合文档在右侧仍被念出」；⑧ 证据面的载体措辞改为判平面的各形态（wave 与 branch 是同一平面的派发，不是另外的载体）。正文按本相位自己的规则书写 | [human] · Claude Opus 5（kairos:cdd-spec-writer） |
| v0.5 | 2026-11-20 | 第四轮评审回填（fix 4）：① **章程自修改三族齐零**——两个文法之外补 `single-home` 一足（章程对闭合域无格点名故一律被判，右侧含已闭合文档），两处重复句各处置成一处指针并点名持有者（gate 判据 → P3/P4/P5 三份 design 与 P4 plan 的 `## Constraints`；发布姿态 → P13 design 的 `## Constraints`），验收臂成三足、章程写入归编排者；② **引用块豁免改行形态**——按行首 `>` 连续块判，不按树节点（`MarkdownTree` 的 `Walk` 不暴露引用块），与围栏跳过同住一处；③ **`repro` 补非空白串判据**（与 `impact.scenario` 同一把尺），验收加空白串一形；④ **`cdd-spec-writer` 的 claim shape 入册**——三条各点名其规则行、最终措辞以引文落地、加逐字对读验收臂；⑤ **闭合文档的规则行读 `skipped (closed document)`**（不读 `passed`），验收加闭合与未闭合的成对一臂；⑥ 三处举证改两处；⑦ 章程终态命令补全 `--spec`。正文按本相位自己的规则书写 | [human] · Claude Opus 5（kairos:cdd-spec-writer） |
| v0.6 | 2026-11-20 | 第五轮评审回填（fix 5）：① **`count` 那一行改成合法形态**——合法写法只有 `census:<id> = <n>`（id 取自 census 登记表），散文里的裸整数加计数单位一律被拒，「由谁维持这个数」是理由不是形态，三行与段落数不变、逐字验收臂指向改写后的引文；② **指针句按本节自身的比较域收窄**——只点名持有者所在的节、不携带判据标签，两处持有者句改写成「指针 + 路径」的同句形态（使本节句子与任何指针渲染都不同形），并补第四对（指针与本节同源句），原「天生没有第二份抄本」一句删去；③ **`cdd-plan` 的 `author-plan` 与 `cdd-spec-writer` 的 `author-spec` 同批教这六条规则**（同一组三行、逐字验收臂同构），理由写进 §4：plan 的 task 块与 `## Constraints` 是判定面里体量最大的一块；④ **删去「段落数由既有 skill-anatomy 用例守恒」的误述**——既有用例只守标题面，三行由逐字对读那一臂守；⑤ **生命周期验收臂收窄到六条形状规则**——读 `skipped (closed document)`，其余规则照判。正文按本相位自己的规则书写 | [human] · Claude Opus 5（kairos:cdd-spec-writer） |
| v0.7 | 2026-11-20 | 第六轮评审回填（fix 6）：① **`live-arithmetic` 改成 token 文法**——十进制整数 + 运算符字形闭集（`−` · `-` · `–`）+ `=` + 可选空格，三个操作数的来源不在文法里、行名里的「活」只是由来，合法形态只有条件句；验收臂改成三份只差字形的夹具各报一次；② **`skipped (no doc target)` 的面按派发类型定**（`PreFlight#docOutcomeOf` 只认 `wave` 与 `branch`），plan 面带 `--plan`、`ctx.doc` 非空故六行照判 `passed` / `failed` / `warned`，§1.3 与 §4 同改，验收补 plan 与 wave 的成对一臂；③ **`details` 过滤到 `severity: "block"`**——告警命中只在自己那一行读 `warned`，报文形状不变，验收补混合档一夹具；④ **`census:criteria.rows` 的四处逐处点名并显式处置记录行**——P37 design 的 `§1.3` · `§6.1` · `## Change history` 的 `v0.13` 行与 P37 plan 的 `### Task 8` 的 `#### Steps`，记录行按「测量值不是判断」的覆盖分支处置（不引入 `CensusGate` 豁免），验收臂写明语料守卫零失配。正文按本相位自己的规则书写 | [human] · Claude Opus 5（kairos:cdd-spec-writer） |
