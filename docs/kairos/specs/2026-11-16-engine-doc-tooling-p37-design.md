---
title: 分级判据的可核化（Grading Boundary）
doc-type: phase-spec
version: v0.24
date: 2026-11-16
slug: 2026-11-16-engine-doc-tooling-p37
program: 2026-10-10-engine-doc-tooling
author: "[human] · Claude Opus 5 (1M context)（kairos:cdd-design grilling 裁定 → 本会话作者）"
---

## Design

评审者判 blocker、引擎按 blocker 收敛，两者之间今天没有共同的判据：`render/templates.ts` 的 `SEVERITY_RUBRIC` 用 severity 词写判据（(a)–(d) 四条），审阅面却用 lens 词（`a pinless claim is a lens-tagged finding` · `a scope that descends to code is a scope finding`），唯一的映射指令是 wave / branch 的 axes guide 里两处 `(severity by your judgment)` ——语义上等于「降档不算错」。同时三档只有举例没有边界：warn 的「debt inside the contract」与 nit 的「style, naming and line-wrapping」之间没有可对照的分界线。

本相位把判档**收成一条可核的梯度**：判档本体是**功能影响**，三档是一个按序回答的阶梯；每档担一条可核举证与一条反例句（举证与反例句都是判据**行**的格子，见 §1.3 / §6.1）；blocker 的举证落成结构化字段，由 `HandoffSchema.gradingViolations` 判定、交接单回读面发射（§2.2）。判据文本从**生成式注册表**装配，每行声明执行面，因此判据不可能只活在长句里。pin 另受可解析性门约束（窄形态，反转 P28 的「不设门」）。

### 1. 判档本体：功能影响与三级边界

#### 1.1 三档定义（按序回答，第一个「是」定档）

- **blocker** —— 结果偏离预期，或埋下功能缺陷：消费者拿到的字节、退出码、渲染结果与契约不符，或某条合法输入会走到未声明的结果。
- **warn** —— 不改本轮的功能结果，但会让**下一个人做错事**：债务（复制的策略、过期的 docstring、缺失的覆盖用例）、误导（声明与实际不符而无消费方受害）、漏覆盖（一段逻辑无人验证）、死码（留着会诱使后来者以为它还在用）。
- **nit** —— 纯表达：命名、换行、注释措辞、文件内顺序，既不改行为也不改变他人判断。

#### 1.2 每档一条举证义务

举证责任三档对称，不再只落在升档：

- blocker 欠**可复现场景**：输入 / 条件 → 实际 → 预期，一句可被下一位评审者当场否证。
- warn 欠**后果**：今天不出错，但「以后谁会在哪一步做错」。
- nit 欠**为什么不是 warn**：一句话说清它不改变任何人的判断。

#### 1.3 反例句（每行一条，入册）

反例句是判据**行**的格子，不是档位的格子：§6.1 的行形态里 `counterExample` 与 `tier` 平级，每一条判据行都带一条。因此每档至少一条，判据表 `census:criteria.rows = 5` 行：blocker 一条（`grading-impact-missing`）、`warn` 两条（`debt-consequence` 与 pin 可解析性那条 `pin-parseability`——后者把 P28 的反转理由写在自己的 `counterExample` 里，§7.4）、`nit` 两条（`expression-only` 与 §5.2 的降档标记行 `regrade-mark`）。下面四句里三句各是某一行的 `counterExample` 格子；第二句是例外，它落在 blocker 行的 `body` 上（紧挨 blocker 的定义才封得住 (a) 的旧漏洞），不占反例句格。四句按档位读如下，blocker 那句排在最前，因为它是把 §2.2 的举证判据翻成判档语言的那一句：

- 说得出一处偏离预期，却举不出「哪条合法输入 → 实际是什么 → 预期是什么」⇒ **warn**，不是 blocker：举不出场景的偏离没法被下一位评审者当场否证，也就不成立为功能影响，按缺陷描述自身的后果定档。
- 违反了一句写着的话，但消费者拿到的字节不变 ⇒ **warn**，不是 blocker。这一句封住 (a) 的旧漏洞：引得到条款不等于功能受影响。（这句是 blocker 判据行的 `body` 句，不是 `counterExample` 格。）
- 一段死码当前无人调用、也不影响任何输出 ⇒ **warn**，不是 nit：它改变后来者的判断。
- 一处命名不一致但同一文件内自洽 ⇒ **nit**，不是 warn：它不误导任何跨面读者。

#### 1.4 (a)–(d) 降为 blocker 档的实例（对原非目标的显式反转）

`SEVERITY_RUBRIC` 现有的四条 blocker 触发器不再是判据本身，而是 blocker 档的**典型实例**：声明的 AC / 契约 / prompt 被违反且消费者可见 · 合法输入逃出声明失败面 · 门失败或套件永不红 · 安全与隐私缺陷。反转理由：judged by (a) 的「条款被违反即 blocker」正是漏洞本体，保留它作触发器会让条款狩猎通过判档。

### 2. `impact` 字段与 blocker 举证门

#### 2.1 字段形态

`session/handoff-schema.ts` 的 `FINDING` 声明新增可选 `impact`：

- `scenario: string` —— 输入 / 条件 → 实际 → 预期。这是唯一被举证判据 `gradingViolations` 要求的槽。
- `test?: string` —— 可选加强：一条能红的测试 pin（格题或路径）。它的消费者是下一位评审者（能当场重跑），因此不需要聚合面承接。

同一处声明新增可选 `regrade: string` —— 跨轮改档的理由（§5）。它同样在 schema 层可选：只有 §5.1 的**跨轮同一性 + 场景同一性**判据成立（降档，且上一轮那一行的 `impact.scenario` 在 `trim()` 后非空）时才要求。

`impact` 在 schema 层可选（warn / nit 不需要它），**blocker 的必填性由举证判据 `gradingViolations` 判**——schema 层强制会连带 BLOCK 掉合法的 warn / nit finding。

§5.1 与 §5.2 要读的几格今天不在轮次 finding 投影里：`session/ledger.ts` 的 `RoundFinding` 只有 `{ severity, summary? }`，两个同形的投影（`Ledger#findingsOf` 与 `HandoffSchema.findingsOf`）把其余字段全丢掉。本相位把 `RoundFinding` 扩为 `{ severity, summary?, id?, impact?, regrade? }`，两个投影同步带上这三格——丢弃规则不变（未知 severity 仍丢），缺席仍是 `undefined`（present-facts-only）。三格各有自己的读者：`id` 与 `impact.scenario` 供 §5.1 的跨轮匹配，`regrade` 供 §5.2 板面的降档标记。两个读者都读这两个已声明的投影，不需要第三个读面去读持久化 carrier。

#### 2.2 举证判据与打印面

新增的举证义务只有一条：`severity === "blocker"` 的每一条，`impact.scenario` 必须是 `trim()` 后仍非空的字符串——与 §6.1 的空白格同一判据（`trim()` 后为空即视为缺），不另立第二种「非空」。它**不由 `rollup` 承接**——`rollup` 只按 severity 数 blocker；这条判据写成与 `rollup` 同处（colocated）的纯助手 `HandoffSchema.gradingViolations(findings)`，由交接单回读面调用，`rollup` 的返回类型不扩、仍只回 `RoundStatus`，成对门不是第四种结论。

面由谁打印：失败面不动——`face/lifecycle.ts` 的交接单回读（`#reconstruct` → `#reject` → 那唯一一行 `CDD_BLOCKED`），与其它 schema 拒绝同一条路径，不新开第二个报错者、不在 `face/cli.ts` 另设一道门。这是唯一的拒绝面：`--dry-run` 在派发前预览、不进 `#reconstruct`，因此**不**声称读这个谓词，也不另设预览面。不满足 ⇒ 该轮不产生结论（不是产出一个值为 `BLOCKED` 的结论），报文为 `CDD_BLOCKED: grading-impact-missing`（首词固定，其后带判定这条义务的判据行 `id`——§6.2 的 `gate` 执行面就是这个字面），并列出违规 finding 的 `id` 与 `summary`（多条目全列，不二选一）。

座位的移动本身是一次显式反转：母宪章 D93 ⑦ 与 Phase inventory P37 的 Scope ② / 验收 ② 最初把这条判据挂在 `rollup` 上（「无场景的 blocker 被 `rollup` 拒」），而 `rollup` 没有 io 句柄、发不出上面那一行 `CDD_BLOCKED`。本相位把座位移到 `HandoffSchema.gradingViolations` + 交接单回读面，并已回填母宪章那三处；与 P28 的「不设门」反转、D22 的「历史面零动」反转一样，反转记名在册，读者不必在两份文档之间推断哪一处是本意。

#### 2.3 `contract` 降为可选修复锚点

`FINDING` 声明新增可选 `contract: { path: string; anchor: string }`——`path` 为契约文档或门的模块路径，`anchor` 为节号 / AC 编号 / 规则 id。它**不参与 `rollup`**，语义是「这条 finding 的修复落在哪」，供 fix 轮定位。`contract.path` 是一个 pin，因此受 §7 的可解析性门约束（解析不到产一条 warn 级 finding，不 BLOCK 该轮；它按 warn 的既有语义参与 `rollup`，见 §7.2）。但它的执行面**不在** §7.1 的 markdown 语料扫描里：`contract` 只出现在 judge 交接单的 finding 行上，因此由 §7.2 回读面的第二份语料（交接单 finding 行的 `contract.path`）判，`PinAudit` 永远不承接这一格。

### 3. lens → 影响判定问句（替代硬映射）

#### 3.1 规则

每类 lens 在注册表里声明**一句影响判定问句**——「这个 lens 下，什么算跨进功能影响」，而不是「这个 lens 一律落哪一档」。硬映射与按影响判档互斥，注册原文的 ② 由此改写。问句形态取每个 lens 的消费者可见后果；下表是全部 (review kind, lens) 格（`census:questions.cells = 19`）。这些问句登记在注册表的**第二张表**（§6.1 的 lens 问句表），行形态 `{ id, reviewKinds, lens, question, face }`——`reviewKinds` 是多值：wave / branch 共用的句子只存一份、行上声明两个 kind，投影时按 kind 各展开一次；不带 `tier`、不带举证义务、不带反例句，因此**不参与** `SEVERITY_RUBRIC` 的装配：问句本身不判档，档位由回答它的评审者按 §1 的阶梯定。逐格登记，不得缺格：

| kind | lens | 影响判定问句（跨进功能影响的条件） |
| --- | --- | --- |
| wave · branch | standards | 仓库自己的标准在被消费的面上被破坏——公开形状、prompt 字节、文档化命令、既有测试所钉的契约 |
| wave · branch | spec | 改动与受审契约（wave brief / 计划 / 设计 spec）不符，且消费者拿到的行为随之改变 |
| wave · branch | buildability | 评审者自己跑的 typecheck / test 红，或在计划声明的路径上会红 |
| wave · branch | scope | 改动落在 wave brief 的 `**Files:**` 面与计划意图之外，且这处越界改动被消费 |
| plan | completeness | 某条 spec 要求无任务承接，实现时会被静默跳过，该要求因此不会出厂 |
| plan | decomposition | 任务粒度使某一步无法独立验证，缺陷会跨步传播而无人发现 |
| plan | buildability | 计划里的一步在仓库现状下不可执行——缺前置、命令不存在、顺序不可达 |
| spec | completeness | 一处必须成立的条件没有写，下游作者只能猜，猜错即改变行为 |
| spec | consistency | 两处对同一事实的表述不同，下游取任一处即出错 |
| spec | clarity | 一处表述可被两种合理读法接受，且两种读法导出的实现不同 |
| overall | scope | 相位范围下探到实现细节，使该阶段的增量不可判 |
| overall | inventory | 登记表与树的实况不符，使「已交付」不再可信 |
| overall | dependency | 依赖边与实际串行关系不符，排期会撞车 |
| overall | acceptance | 验收格在相位关闭时无法判定 |
| overall | boundary | 非目标画得过松，等于不过滤任何东西 |

`wave` 与 `branch` 行的问句逐字相同（两者的受审对象不同、判据同源）；lens 问句表按 kind × lens 逐格登记，共同句在行上以 `reviewKinds: ["wave", "branch"]` 存一份、按 kind 展开，不复制正文——因此物理行数 `census:questions.rows = 15`（即 `rows.length`）、覆盖格数 `census:questions.cells = 19`（即各行 `reviewKinds.length` 之和）。两张表不得合并：判据表承载 `tier` / `duty` / `counterExample`，问句表三者皆无，合并只能靠空值或伪造档位。

#### 3.2 删除两处 judgment 逃逸口

wave 与 branch 的 axes guide 里两处 `(severity by your judgment)` 删除；`scope` 轴的判定改由 `scope` lens 的问句承担（wave / branch 的 `lensEnum` 现缺 `scope`，本相位补齐，使 axes guide 的轴与枚举一一对应）。删除后不留判档空白：每类 review 的 axes guide 末尾接一段由 `LENS_QUESTIONS` 装配的编号问句清单（§6.1 的投影面），原逃逸口那句「档位由你判断」的职责改由 `scope` 那一格的问句承担，问句随 prompt 字节下发。

### 4. wave review 的契约可见性

#### 4.1 注入 `INPUT_SPEC` + `INPUT_OVERALL`

wave review 的 round context 必须携带 `INPUT_SPEC`（本计划同 slug 的身份文档）与 `INPUT_OVERALL`（其 `program:` 指向的母宪章），与 branch 同路。今天的归因要写准：`face/cli.ts` 的场景装配只为 `plan` / `branch` 设 `specLink`，而 `overallLink` 也对三个 doc 目标（`phase-spec` / `overall` / `single-spec`）由被审文档的 `program:` 设；wave 是唯一两格都为空的面——这是「代码评审读不到相位契约」的构造性盲区。

两格按身份文档的形状配对，不强行成对：身份文档解析到且 `program:` 可解析 ⇒ 两行同时出现（路径为仓根相对、可读）；身份文档解析到但没有 `program:`（身份文档是 single-spec——single-spec 按设计无母宪章）⇒ 只有 `INPUT_SPEC`，`INPUT_OVERALL` 合法缺席；身份文档缺席或读面为 `invalid` 时（无 `slug:` 链接、同 slug 多份、文档不可读）⇒ 两行都不出现；`program:` 指不到母宪章 ⇒ 只丢 `INPUT_OVERALL`。丢弃指该行**不出现在** round context 里，不是出现一个空值。因此「任一环缺席 ⇒ 两 token 均不出现」不能当反向 pin：它会把 single-spec 相位的 spec 锚一并剥掉，正是 D93 ⑤ 要关的盲区。wave 评审照常派发，不因此拒绝：引擎只拒它能判的形态（P36 的 `misplaced` 纪律），链路缺口由既有 `doc-contract` 面报，不在本相位新增第二个报告者。

**验收落在哪一面**：本条能核的事实只有 round context 的字节——锚出现、路径仓根相对、读得到（取源见 §4.2），验收按上面各配对臂逐条钉，外加一条 branch 字节不变 pin。评审者有没有引用契约的某一行**不是**引擎的字节：那是子代理的阅读行为，由评审 prompt 的判据（§3 的 lens 问句）管，没有任何机械面能判。因此验收只钉锚、不钉「被引用」，母宪章 P37 验收 ④ 已回填成同一形态，两处不各写一套。

#### 4.2 取源与 branch 同路

路径取 `SlugIndex` 的身份文档与其 `program:`，**不做任何文件名推演**（P36 已删尽派生）。

### 5. 跨轮改档落账

#### 5.1 判据：跨轮同一性 + 场景同一性

`impact.scenario` 落进 `session/ledger.ts` 的轮次 finding 投影。跨轮同一性的匹配按序判定：

1. **定位上一轮对应行**：「上一轮」指**同一行上更早的、其 findings 投影非空的那条记录**——`Ledger#recordsOf` 给出整行的 implement / review / fix 记录，读法是从近到远逐条取该 review 记录自己的 carrier（`Ledger#readHandoff` 读一轮的交接单，单条读面是 `Ledger#round(op, type, params, round)`），再用 `HandoffSchema.findingsOf` 投影出 findings；implement 记录与 findings 为空的 review 记录都投影出空集，而按「紧接着的上一条记录」读则会把 review 与一条空 findings 的 implement 对比、零行匹配，降档于是静默通过，正是 D93 ④「降档买一轮」的漏洞。匹配先取 `summary` 原文相同的那一行（`summary` 是缺陷描述本身，跨轮改写比换位少见）；多行同文时再以 carrier `id` 收窄。`id` 不能作首键：`FINDING` 的 `id` 在 materialize 时按 carrier 行序写入（`F1`、`F2` …；行号语义的成文处是 `session/handoff-schema.ts` 的 `HandoffSchema`——`downgrades` 的判据注释——与 `session/ledger.ts` 的 `RoundFinding`，`id` 字段本身不带这条注释），它是那一轮的行号而不是缺陷的身份——上一轮新增或删除一条 finding，后续行号整体错位，首键会把两个不相干的缺陷配成一对：对从未判过的缺陷误索 `regrade`，而真实的降档因配对失败静默通过。因此 `summary` 不是唯一的键：上一轮某行的 `impact.scenario` 原文与本轮某行相同也算同一行（缺陷未变、`summary` 换了说法的情形）——这是母宪章 P37 ⑥ 注册的判据（「判据是两轮场景文本是否相同」），本相位把它保留为**第二个匹配键**而不是替换第一个：两键任一命中即配对，因此「场景未变而改档」在两条路径上都必须给理由，缺陷换了说法也不会因 `summary` 改写而漏账。
2. **档位未降低**（本轮 ≥ 上一轮）⇒ 不判，不要求 `regrade`、不标记。
3. **档位降低且上一轮那一行的 `impact.scenario` 在 `trim()` 后非空**（与 §2.2 的举证谓词同一判据）⇒ 本轮必须携带 `regrade: string`（改档理由）；缺理由 ⇒ 胶囊与板面各出现一条可见标记。配对一旦成立，本轮**省略或改写**自己那一行的 `scenario` 都**不注销**这条义务——降档方唯一能掌控的就是新行自己的字节，若靠改场景就能逃开，D93 点名的「blocker 降成 warn 收线」就会在可见面上静默；要切断配对得**同时**改写 `summary` 与 `scenario`，而那是「另一条缺陷」的声明，母宪章 ⑥ 的场景判据同样覆盖不到。
4. **档位降低但上一轮那一行的 `scenario` 在 `trim()` 后为空** ⇒ 没有参照场景，按缺陷已变处理，不要求 `regrade`、不标记。

标记是**显示面**，不是判据：它不写入 `findings[]`、不生成合成 finding、不进 `rollup`，因此单独一条降档不会把本轮推成 `REVIEW_FIX`，也不动 D70 收敛判据（Constraints 冻结）。

#### 5.2 落点

落点两处，都挂在既有渲染面上。标记的措辞在判据表旁声明一次——`REGRADE_MARK` 与 §6.1 的表同模块导出，不另写第二句，也不取自任何一格；它自己的那一行（§6.1 的 `regrade-mark`）在 §6.1 里是**显示行**：`tier` 格只为行形态必填（删键即类型红，见 §6.1）而填，不是给某类 finding 定档——标记没有 finding 可判——它的 `body` / `duty` 句像任何一行那样写进 rubric 字节，`duty` 句明写「标记是显示事实，永不是 finding 行、不是 carrier 条目、也不动本轮结论」，而**表里没有任何一格是标记本身**：`contract/__tests__/review-criteria.test.ts` 逐格反证这一点（每行的三格都不等于标记），并断言 `renderRubric` 渲染出的档位散文不把标记当句子带上——标记不是 rubric 格子——它只由板面的 verb token 与胶囊的 `summary` 行打印（下面两处落点）。因此读这段散文的子代理拿到的是一句更正，而且标记不是 review 轮的产物：它由渲染面从记录里读出（§5.1 末段的显示面纪律）。这是 ③ 的「同类降档须写理由」与 ⑤ 的「降档落账」合并后的**唯一**执行面。

- **板面**——`face/board-view.ts` 的每 verb token（`BoardView#summaryToken` 渲的 `{verb} {body} {mark}+N`）在 `+N` 之后接降档标记，仍是同一个 token：不新增行、不新增条目。板面今天没有 per-finding 行（`LineCarriers` 只供 `+N` 计数），因此本相位给它补一个 per-record 的 findings 读面 `findingsOf(record): readonly RoundFinding[]`——同一条 digest 校验过的 carrier 读，投影直接用 `HandoffSchema.findingsOf`（§2.1 的同一个投影，丢弃规则不变）；`countOf` 的语义不动（仍数 carrier `findings` 数组的长度），两个读面同源不同格。`BoardView#summaryToken` 的标记**不是**由本轮记录自己的 findings 判出来的：§5.1 的判据要三个事实——本轮比上一轮低一档、上一轮那一行的 `impact.scenario` 在 `trim()` 后非空、本轮没写 `regrade`——前两个不在本轮记录的 findings 里。因此板面在同一条 carrier 读上再补一个 per-record 的判定面 `LineCarriers#regradeNoteOf`：它从 `findingsOf` 往回走，取最近一条 findings 投影非空的更早记录（§5.1 步骤 1 的「上一轮」），把这一对交给 `HandoffSchema.downgrades` 与 `HandoffSchema.regradeReasons`（同一判据的标记侧与理由侧），交给 `regradeNote` 合成一行——标记恰在「降档而无理由」时出现、理由恰在有理由时出现。因此板面标记不新开第二个读面、也不第二次解析 carrier 字节；本轮 findings 里的 `regrade` 格不是判据的输入，配对成立之后它才被读。
- **胶囊**——`face/capsule.ts` 的 `summary` 槽：`Capsule#emit` 早已把调用方给的一行渲在 status 行与 `next:` 之间，今天只由 fix 轮的 `dispositionsSummary` 填。降档标记走同一槽，`emit` 的签名与键集都不动；但它**确实会让评审轮的 stdout 多一行**（今天评审轮只有 `status · handoff`，加上可选的 `next:` 与 `reason:`）。这一行是显式声明的新字节，带自己的成对 pin：无降档 ⇒ 该行不出现，评审轮 stdout 与今天逐字节相同；有一条降档 ⇒ 恰好多这一行。

因此「不新增行」不能作概括：准确的说法是**不新增 finding 行、不新增 carrier 条目、不改本轮结论**，胶囊那一行是设计里唯一新增的可见字节。

### 6. 生成式判据注册表

#### 6.1 两张表的行形态

新增 `contract/review-criteria.ts`，它承载两张形状不同、互不混行的表：

- **判据表**——每行 `{ id, tier, body, duty, counterExample, face }`，`tier` ∈ blocker / warn / nit，`face` ∈ gate / test / numbered。`SEVERITY_RUBRIC` 由行按声明序装配（正文即行，散文不再是判据的第二份副本），因此判据表是唯一进 rubric **档位散文**的语料。表里有一类行是**显示行**：它描述的是渲染面的事实而不是给 finding 定档（今天只有 `regrade-mark` 一条，§5.2），它的 `body` 句因此陈述事件、`duty` 句紧接着禁止把它记成 finding，`tier` 格只是行形态的必填格（标记**措辞本身不在表里**——它是 `REGRADE_MARK`，声明在表旁，见 §5.2）显示行留在表内而不挪到表外，理由是可核性：rubric 是子代理唯一读到的面，更正必须与它所更正的句子同一段字节；标定尾段（同档一致义务、`{artifact}` / `{audience}` 视觉句、设而不用清单、收尾致谢）不在档位片段内，仍由 `reviewGuideOf` 的共享尾段承接。装配公式一格一段、三格恒序：`body` → `duty` → `counterExample`，单句之间以空格相连得到该行的 rubric 片段；同一 `tier` 的片段相邻成段（多行时按声明序），各段按 blocker → warn → nit 排成档位主体。三格都进字节，没有只作元数据的格子——`duty` 与 `counterExample` 若不渲染，举证义务与反例句就退回了长句。`CRITERIA.of(id)` 查不到即抛——仿 `contract/completion-criterion.ts` 的「未登记即抛」形态。
- **lens 问句表**——每行 `{ id, reviewKinds, lens, question, face }`（§3.1 的 `census:questions.cells = 19` 格，`reviewKinds` 多值），`face` 恒为 `numbered`：问句的唯一执行面是渲染出的评审 prompt。它没有 `tier`：问句不判档；没有 `duty` 与 `counterExample`：举证与反例句属于档位而不属于 lens。按 (review kind, lens) 逐格 19 条：`wave` 与 `branch` 的四行以 `reviewKinds: ["wave", "branch"]` 存一份、投影时各展开一次，故物理行 `census:questions.rows = 15`（即 `LENS_QUESTIONS.rows.length`）、覆盖格 `census:questions.cells = 19`（即各行 `reviewKinds.length` 之和）。该表**不参与** `SEVERITY_RUBRIC` 装配，`LENS_QUESTIONS.of(reviewKind, lens)` 查不到即抛（同一「未登记即抛」形态）。

装配的校验契约两段，缺一不可（AC ① 的负向 pin 按这两段分开钉）：**行形态是类型**——每行是 `readonly` 字面行，`id` / `tier` / `body` / `duty` / `counterExample` / `face` 六格全必填，删掉某个键是 `tsc` 红（类型层，不是运行时抛）；**格子内容是装配期校验**——装配时任一必填格为空白字符串（`trim()` 后为空）即抛，某一 `tier` 无任何行也即抛。因此「删了一条反例句」有两种形态、两种红法：删键 ⇒ 类型层拦，置空串 ⇒ 装配期拦；二者都不会渲染出一个少一句的档位片段。装配只对声明表的行做这两条运行期校验，不对散文做内容匹配。

问句的投影面只有一处：`render/templates.ts` 每类 review 的 `axesGuide` 由该类问句装配——`LENS_QUESTIONS.forReviewKind(reviewKind)` 按声明序取行，渲染成从 1 起的编号清单（`1. <question>` 逐行），追加到该类 `axesGuide` 末尾；`reviewRow(type)` 把整段 `axesGuide` 原样折进 `**Criteria — <type>:**` 那一行，问句因此随 prompt 字节下发。五类 review 各装配自己的一段：`wave` / `branch` 行正文相同、`reviewKind` 不同，两类共用同一批行，故条数相同；`plan` / `spec` / `overall` 各取自己 `reviewKinds` 命中的行。逐类条数不在此复述：它是投影的读数（`LENS_QUESTIONS.forReviewKind(reviewKind)` 的行数），由 §6.2 的 `numbered` 面与 `render/__tests__/templates.test.ts` 对着渲染产物核；写成手测数字只会多一处没有 `census:` id 的测量（§8.1）。表里有行不等于 prompt 里有问句，因此核对落在渲染产物上（§6.2 的 `numbered` 面），不是落在表的行数上。

两表不得合并：问句塞进判据表只能带一个不存在的 `tier` 或用空 `duty` / `counterExample` 污染 rubric 散文；判据行塞进问句表则丢掉举证义务与反例句。计数按表各计一次，由 §6.2 的同一条结构测试核对；写进散文的计数带 `census:` 引用（§8），因此本段的三处数字是门核对的引用而不是手测：判据表 `census:criteria.rows = 5` 行 · 问句表 `census:questions.rows = 15` 行 / `census:questions.cells = 19` 格。

#### 6.2 边界

三种 `face` 各自的执行面如下，且每个非 `numbered` 的值至少有一行占位——否则把每行都标 `numbered` 就能全绿，`face` 只是一列装饰：

- `gate`：该行的 `id` 必须出现在它那条机械门的报文里。至少一行——blocker 的举证义务行出现在 `CDD_BLOCKED: grading-impact-missing` 的报文里（§2.2，报文首词固定、行 `id` 随后）。
- `test`：该行必须被一条测试的格题命名。至少一行——pin 可解析性的那条判据行（§7.4）由 `contract/__tests__/pins.guard.test.ts` 的一条格题命名（`*.guard.test.ts` 是仓内既有命名，不带 `.guard` 的同名文件不在树里）。
- `numbered`：该行出现在渲染产物里。至少一行（三档行本身）。

lens 问句表的行同为 `numbered`，其渲染产物是该 `reviewKind` 的评审 prompt：每一行问句必须逐字出现在对应 review 的 `**Criteria —` 行里，缺一条即红。以上由 `contract/__tests__/review-criteria.test.ts` 一条结构测试核对——判据行 id 按 `face` 归面、三个 `face` 值各至少一行、判据表按 `tier` 各至少一行，lens 问句表另计 `census:questions.rows = 15` 行 / `census:questions.cells = 19` 格；问句折进 prompt 的那一半由 `render/__tests__/templates.test.ts` 核对（五类 `**Criteria —` 行的编号清单逐字对上）。普查不在 §7 的 `pins.guard.test.ts` 上：那是 pin 门的测试面，不含判据普查。

### 7. pin 可解析性门（P28 反转的窄形态）

#### 7.1 三形态判定与「什么是 pin」

`contract/pins.ts` 暴露 `PinAudit`，扫描 `docs/kairos/**/*.md` 与仓库 README 家族（`README.md` · `README.zh-CN.md` · `packages/*/README*.md`）的三类 pin：

- `path.ext[:line[-line]]` —— 路径**按固定顺序解析，不取第一个命中**：① 与仓内条目**全等**的命中胜（写 `README.md` 就只指仓根那份，不会落到 `.changeset/README.md`）；② 全等无命中时取**唯一后缀**命中（`face/declare.ts` 只有一个候选）；③ 后缀命中多于一个时**不挑**，产一条 ambiguity finding 并列出**全部候选**（裸写 declare.ts 今天同时命中 `contract/declare.ts` 与 `face/declare.ts`）——pin 指向哪个文件是文档的主张，门不替它选，档位与解析不到同（warn，§7.2）。行号可省，省略时就是**裸路径 pin**（本 spec 自身的路径坐标都写这一形）；出现时按**解析到的那个条目**的行数判，不是同名兄弟文件的行数；**不比对内容**（内容匹配不可能机械）。
- 裸符号（如 `#artifactCellOf`、`PinAudit`）—— 在**被审仓库自身源码**的符号索引中可解析：索引读的是被审根下每一个源文件的代码体，不写死任何树名——引擎装进消费方仓库运行，那棵树里没有本仓的引擎源、技能包与 `scripts`，写死树名会让索引在消费方为空，于是每一条活着的符号 pin 都被判成死 pin，而这个红没有任何文档改动能清掉（§7.3 为路径形消掉的就是这个环）。构建输出与机器本地目录（`node_modules` · `dist` · `.git` · `.kairos`）不进索引：装进来的依赖副本与本地产物不是被审仓库的声明。索引按运行缓存。
- **测试格题 + 文件名** —— 两半写在同一枚 token 里，形如 `<file>.test.ts::<格题>`：`::` 之前是文件半、必须落在树里且以 `.test.ts` 结尾，`::` 之后是格题原文（可含空格，按该文件字节里是否存在这个字符串判）。路径一枚 token 加题名另一枚 token **不是**这一形——那样只有路径被判定、题名退回散文，题名后来被改写也不会变红。

**pin 的定义是门的一部分**（否则扫描器会把词汇当主张）。一个反引号 token 只在下列四条同时成立时才是 pin，否则它是散文词汇，不受本门管辖：

1. **仓根相对**——`path` 不以 `./` / `../` 开头，也不以 `...` 省略号开头；相对简写与省略形是行文习惯，不是可核对的主张。
2. **不是产物词汇**——workspace 产物名（`progress.json` / `base.json` / `in-flight.json` / `liveness.json`）、后缀（`.rulings.json`）、模板（`X.md` / `-overall.md` / `-design.md`）都是词表条目，不是坐标。产物名按**矩阵自己的答案**判（`ArtifactRegistry.ownsName` 认得的那些具名登记者）；`tasks-<N>-<op>.json` 不在此列——矩阵渲染的是字面具名，这个 token 之所以不是坐标是第 4 条，不是这一条。
3. **不是易逝物**——`.changeset/*.md` 按设计在发布时被消费删除，引用它们不是主张而是记录；同理不判。
4. **不是模式**——token 里带 `*` · `<` · `>` · `{` · `}` · `|` 或空白字符的，命名的是**模式**（一个家族，或一条派生路径的规则），不是三形态里的任何一枚坐标：路径形态与测试形态的**文件半**都先过这一条，符号形态的标识符形状本身不含这些字符。本 spec 自己就用着三处，它们是行文而不是主张——§6.2 的 `*.guard.test.ts`（仓内既有命名族）· §7.3 条件 ③ 的 `<file>.md`（文件名形态，不是路径）· §7.1 与 AC ⑥ 的 `<file>.test.ts::<格题>`（测试形态的例子）。同一 token 把元字符换成具体的名字，就是一条可判定、可解析的 pin。

**成员引用的写法**（不是第四形态，是裸符号形态的连写）：符号索引是**平坦的标识符集**，语料是被审仓库自身源文件的**代码体**——注释体与正则字面量体先被抹掉（长度与行号保持，后续读者的位置仍然真），字符串 / 模板字面量**有意保留**：本树的活词汇就声明在字面量里，胶囊的 `CDD_BLOCKED:` 与任务块的 `DependsOn` 家族都只以字面量出现，抹掉它们会把 `CDD_BLOCKED` 一族与 `DependsOn` 家族一并判成死 pin。代码体里每一段标识符连写都进集（不限声明位置），成员名与类名同处一集，`#` 不是标识符字符，因此索引不是「只收声明」——判据是「名字在代码里活着」，声明只是它最常见的位置。一个成员与承载它的类 / 模块写在**同一枚 token** 里、以 `.` 或 `#` 连写（`HandoffSchema.gradingViolations` · `BoardView#summaryToken` · `render/templates.ts#pinLensOf`），判定法与裸符号同一套，只是分两半：尾随的 `(...)` 实参先剥掉；token 里有 `#` 时以**最后一个** `#` 为界（路径载体自己带点），否则以**第一个** `.` 为界。前半是载体，按裸路径或裸符号形态**过筛**（路径仍走三级优序，过不了筛即散文）；后半是成员，过**同一套**裸符号形状判据（过不了筛即散文）。两半都过筛而任一半解析不到 ⇒ 该 token 产一条 finding。形状判据因此不被分隔符改写：小写成员名（`impact.scenario` · `chain.phases`）与裸小写词（`wave`）同判为散文，本相位新增、树中尚不存在的成员（§8.2 的访问器）也就写不成假 pin。

#### 7.2 解析不到的处理

解析不到 ⇒ 该 pin 自身产一条 finding（档位 **warn**：失效 pin 不改变消费者拿到的结果，只让一处主张不可核），lens 取**该评审面自己声明的**那一个（见下条）。判据只有一条，喂给它的语料有三份，执行面只有两处——今天的树没有第二个文档评审回读面：文档评审与交接单回读同属 `face/lifecycle.ts` 的 `#reconstruct` / `#materialize`。

**注入行的 lens 按面取，不写死。** 每个判据体在 `lensEnum` 旁声明自己的 `pinLens`，注入点读 `render/templates.ts#pinLensOf(frame.type)`，并在派生时与同一份 `lensEnum` 交叉校验（drift 即抛）：`spec` 面（`phase-spec` / `single-spec`）取 `consistency`（文档与树对同一事实的陈述不一致）、`overall` 面取 `inventory`（宪章登记的账与树不符——宪章判据第 6 条）、`plan` 面取 `buildability`（步进写到的坐标在今天的树上不存在）、`wave` / `branch` 面取 `standards`（finding 的 `contract` 主张要落在仓里被 pin 的面上，路径解析不到即无面可落）。理由：同一轮的提示词把 `**Lens labels:**` 限定为该面的词表，载体里的引擎行若落在词表之外，下一轮与维护者就无法分辨「引擎写的」与「子代理无视枚举写的」；因此两张面写同一份词，越界即抛而不是静默落盘。

- **引擎套件的结构测试**——§7.1 三形态加 pin 定义，入口 `PinAudit`，语料 = `docs/kairos/**/*.md` 与 README 家族，**全语料必须零 finding**（无基线、无白名单、无豁免：门的范围是一句定义，不是一份数据）。
- **`face/lifecycle.ts` 的回读面**——同一个 `PinAudit` 判据，喂两份语料，每份有自己的读点：
  - **被审文档自身的 markdown**——文档评审轮（`TARGET_TYPE` 为 doc 三型）在 `#reconstruct` 里对**本轮被审文档的正文**跑一次 markdown 扫描：该文档是 `SlugIndex` 解析到、本轮回读的那份身份文档（`INPUT_SPEC` / `INPUT_OVERALL` 是它的引用，不是语料）；解析不到的 pin 折算成该轮的一条 warn 级 finding（lens 取该面声明的 `pinLens`，即上一段：`phase-spec` / `single-spec` 为 `consistency`、`overall` 为 `inventory`）注入 `findings[]`，`summary` 指出失效的 pin。这份语料同样受 §7.3 的时间面约束：作者态下由与被审文档同 `slug:`（或由计划同 `slug:` 的身份文档所声明的 `program:` 到达）的计划某条 `Create:` 行声明、树中缺席、且该计划尚未被关闭记录点名的路径不产 finding（跳过由 `PinAudit` 一处判定，§7.3）——否则被审文档每轮评审都带一批指向待建路径的 warn 行，文档评审在相位落地前不可能收敛。判据、语料、注入点这三处都要点名：既不是「文档评审的语言」这种可指被审文档、也可指本轮散文的说法，也不是「另一次文档评审」这种今天不存在的面。
  - **交接单 finding 行上的 `contract.path`**——路径解析不到 ⇒ 追加一条 warn 级 finding，lens 同样取该面声明的 `pinLens`（`contract` 这一格在五个判据面上都会出现，因此这一份语料不是 spec 专用：`wave` / `branch` 面上是 `standards`，`plan` 面上是 `buildability`），`summary` 指出失效的 `path`。`PinAudit` 的 markdown 扫描永不承接这一格。

两个执行面共用一条判据、各自判自己的语料，不得合并成一处。`contract.path` 那一份的后果要说准：它**不 BLOCK** 该轮（不出 `CDD_BLOCKED`），但它是真实的 warn 级 finding，按既有语义进 `findings[]` 并被 `rollup` 读到——本来零 finding 的评审轮因此落到 `REVIEW_FIX`，不会停在 `APPROVED`。这不是新机制：`rollup` 对 warn 的处理今天就是这样。被审文档那一份同理：它是真实的 warn 级 finding、也进 `findings[]`，因此一份带死 pin 的被审文档在文档评审轮落到 `REVIEW_FIX`，而不是停在今天的 `APPROVED`——这是本相位对文档审阅面唯一的可见后果，AC ⑥ 为它配了成对 pin。反方向的做法（把它做成只显示、不进 `findings[]` 的行）等于在 §5.1 的显示面之外再立一类不受 `rollup` 管的 finding，本相位不立。

#### 7.3 存量迁移（门上线的前置，一次性）

全语料今天不干净，因此门上线前完成一次**一次性迁移**，此后不得再产生豁免机制。迁移规模不在此预登记——上一版预登记的语料计数已撤回：它们无法从公开基准复现（按「`docs/kairos/**/*.md` 与 README 家族里的反引号 token」数会得到另一组值），写成事实只会给下游一个不可验的工作量。改以一条可判的条件：**`PinAudit` 第一次全语料运行的 finding 集就是待改清单**，迁移完成的判据是同一扫描的零 finding。

**上线条件的时间面（作者态红 vs 关闭时零）**：`全语料零 finding` 判在**相位关闭时**，不判在作者态——文档先于代码写，本相位自己的计划在 `Create:` 行里声明、树上尚未落地的路径在作者态必然解析不到（今天这一类非空：指向 §8.2 那个尚未落地的计数登记面与 §8.3 那条计数门的结构测试——这些处由本节第三条判据跳过，不进待改清单；具体是哪些处、各占几条，本 spec 既不预登记也不在散文中复述），这是设计的形状而不是语料缺陷。跳过判据机械、无名单，三条同时成立才跳过：
① **声明**——该路径按 §7.1 的后缀形态，是某份**计划文档**某条 `Create:` 行所写路径的后缀或全等，且该计划与**被审文档**共一个身份键。两个键都只读 front-matter 的声明值，读的是门自己那张头表而不是身份索引：`ForwardPaths#headsOf` 对仓内条目列表（`PinIndex.entries`）逐份文档 `FrontMatterExtractor.split` 出头块，两个键于是都是头表上的比较；`#reconstruct` 里**不建第二个 `SlugIndex`**（P36 把身份索引限在命令前导的三处，`ForwardPaths` 对它的唯一触碰是拼写判定 `SlugIndex.isLegalSlug`），不按文件名推演、不读 `## Phase inventory`：其一，被审文档的 `slug:` 等于该计划的 `slug:`（plan / phase-spec / single-spec 三型共享同一个 `slug:`，覆盖计划自己声明的 `Create:` 行，以及与它同 slug 的那份身份文档）；其二，被审文档的 `slug:` 等于该计划身份文档声明的 `program:`——`program:` **不写在计划上**（`PLAN_ELEMENTS` 没有这一格），它写在与计划同 `slug:` 的那份身份文档上，因此这一支读的是**身份文档的 `program:`**，而母宪章的 `slug:` **就是**程序 slug，宪章因此是头表里 `docType: overall` 且 `slug:` 等于该 `program:` 的那一份（`ForwardPaths#closedBy` 就这么取它）。
② **缺席**——树上没有这条路径（§7.1 的三级优序解析不到）。
③ **未关闭**——那份计划尚未被关闭记录点名。「关闭」只有一处登记面：母宪章 `## Phase inventory` 某行的 `Implementation plan` 格写成 `✔ Done（…）`（成对全角括号 · 反引号内的文件名 · 日期），且该文件名解析到的那份文档的 `slug:` 等于本计划的 `slug:`。这一步的读面写在明处：本格声明的是**文件名**（反引号内 `<file>.md`，不是路径），解析把它与头表里每份文档 `rel` 的文件名部分全等比对（`ForwardPaths#closedBy` 读的就是这张表，不拼接路径——P36 的文档路径零拼接门——也不按文件名推演身份）；命中恰一份时再判它的 `slug:`。**零命中与不唯一命中同判「已关闭」**：一处登记不再解析得通时「未关闭」无法确立，而跳过是一条窄面——登记烂掉不能换来跳过，否则一条过期的 `✔ Done` 格就能让死 pin 静默绿着。该判只发生一次，就在这里。这张表的行形态由 `packages/cdd-engine/src-next/contract/__tests__/phase-inventory.guard.test.ts` 钉住（两格只写该形态或 `[Pending]`），它**不是 `PinAudit` 的读面**：读面是生产读取面 `contract/doc.ts` 的 `OverallDocType#parse`，`chain.phases` 的 `designCell` / `planCell` 两格已在那里。这一臂的主语是**计划**而不是被审文档——母宪章的 `slug:` 不与任何计划相同，宪章里的待建 pin 由声明该路径的那份计划的关闭状态判，那份计划本身经条件 ① 的第二支到达宪章。该计划所属的身份文档声明 `program:`、且该 `program:` 解析到一份带 `## Phase inventory` 的宪章时，才读这一臂；**`program:` 缺席（single-spec）、`program:` 解析不到母宪章、或母宪章没有 `## Phase inventory` 时**，树上没有任何闭合登记面，跳过以**声明本身**为界——该计划仍在树上且仍写着这条 `Create:` 行即算未关闭。
任一条件失效——路径落地、计划删掉该行、计划被 `Implementation plan` 格的 `✔ Done` 点名（相位关闭）——跳过即失效。

**为什么钉身份键而不只钉 `program:`**：pin 门对所有消费者开放，而 `program:` → 母宪章 → `## Phase inventory` 这条链**只有本仓这种带宪章的程序才有**。把它写成唯一入口会让 single-spec 与不用 overalls 的仓永久红：它们既没有 `program:`，也没有宪章，条件 ① 永不成立。`slug:` 是引擎自己的身份模型（spec 与 plan 共享同一个 `slug:`，即 `infra/slug-index.ts` 的 same-slug Class-A arm），三类消费者都有；宪章的 `slug:` 与它自己的计划不同，但计划的身份文档写着 `program:` = 宪章的 `slug:`——两个键因此归到同一个共同项：**被审文档自己的 `slug:`**。宪章不靠「同 slug」到达，靠的是计划身份文档那一格 `program:`；两者都不是文件名推演。

代价要说准，两处仍然会红，本相位不打算救：**相位已 `✔ Done` 后追加 `Create:` 行的计划**——相位已关闭，它的待建路径按条件 ③ 不再跳过，因此在落地前就是一条 finding；重开一个已闭合相位是本宪章「变更先回填 overall」的变更，不是 pin 门的例外。**不用 overalls 的仓**——条件 ① 成立（同 slug），条件 ③ 退化为声明边界，因此这条臂比带宪章的程序**弱**：活着但作废的声明在那里不会转红。反方向（没有闭合登记面即不跳过）不成立，理由是相位自己的顺序：single-spec 的规格在它自己的计划落地前每轮评审都会被注入一批指向待建模块的死 pin，规格评审永远到不了 `APPROVED`，而那个模块又要等计划落地——那个环正是本相位要拆的东西。**跳过判在哪一层**：判定落在 `PinAudit` 这一处判据里，不落在调用方——待建路径表在判定前一次算好，`scan`（全语料）、`scanText`（被审文档正文，即 §7.2 的第二份语料）与 `pathResolves`（交接单 finding 行的 `contract.path`）三份语料读同一张表，因此同一条待建路径在三份语料上得到同一个答案；不存在「§7.2 自己再判一次跳过」的第二套读法，也不存在「语料零 finding」与「扫描计数」成为同一个名字下的两个事实。§8.2 的 `pin.total` 就是这一次扫描在时间面判定之后剩下的 finding 数：作者态它是 `census:pin.total = 0`（待建的都跳过了），关闭时它仍是零（门的上线条件），两处是同一个函数的一次读数。时间面对三份语料一视同仁是它的必要条件而不是便利：三份语料若各判一套，同一条待建路径在不同面上会得到不同答案，`pin.total` 也就失去「一次扫描的读数」这个含义。

因此它是**时间面**而不是豁免机制：§7.2 的「无基线、无白名单、无豁免」逐字成立（关闭时门必须为零），而「该计划已关闭、路径仍缺席」由同一扫描判红。

- **过期引用删除**——目标已按设计消失、因此今天解析不到的引用（已整目录移除的 `docs/maintainers/*` · P5 已退役的 `scripts/*`）改为不指路径的表述，保留「当时做了什么」而不留死号。
- **迁移路径修正**——`docs/kairos/specs/<slug>-overall.md` 等已按 P17 改名/搬迁的路径改为现行路径。
- **行号越界修正**——行号超过文件行数的 pin 改为路径或符号（§7.1 的形态，本相位起的书写纪律），不再钉行号。

已按设计被消费的 `.changeset/*` 引用**不是迁移对象**：§7.1 的第 3 条排除已把它们定义成记录而非主张，它们产生不了 finding，删它们买不到门上的任何一条红。

这是对 **D22**（P6 裁定 Q5→a：「`docs/kairos/{specs,plans}` frozen 历史面零动」）的**显式反转**，理由写在明面上：D22 防的是**追溯重写**——按今天的口味改写历史结论、裁定与交付记录；本条只改坐标与引用句（目标已消失的引用、已搬迁的路径、已越界的行号），零结论改动、零裁定改动、零交付记录改动，因此不落在 D22 所防的面内。反转已回填母宪章（Phase inventory P37 的 Scope 与 D93 ⑧），实现前该回填已到位。

迁移只改坐标与引用句，**不改任何结论、裁定或交付记录**；迁移后全语料零 finding 即为门的上线条件。

#### 7.4 边界（显式反转）

不做 docs 全量校验——只判 pin 的每一段可解析，不判文档结构、不判语义。P28 当年撤门的理由是「docs 全量校验过重、合法性交 dispatch 门自判」，而 dispatch 门只判文档结构、不判 pin 坐标形态；本条把门装回窄形态，理由与边界记入**判据表里那条 pin 可解析性判据行**（warn 档）的 `counterExample`——该行按 §6.2 由 `contract/__tests__/pins.guard.test.ts` 的一条格题命名，`test` 执行面因此有行占位。

### 8. 计数的执行面（`census` 引用）

#### 8.1 病根与规则

`count` claim 今天只活在写作规范里（「N places 必须声明由哪个具名 guard 或 test 维护」），**没有任何执行面**：本相位的计划因此三次被自己的手测数字打回。规则只有一条——**数字允许出现，但每个测量数字必须带 `census:<id>` 引用，由门核对**。不加引用的裸数字不在门内：门不为散文做语义猜测，它只核对被声明的引用。

#### 8.2 登记面

新增一个计数登记面：一个注册表模块，其文件路径由本相位计划的 `Create:` 行声明，本 spec 只写它现在就能声明的契约（登记表 + 「查不到即抛」），不写尚未落地的坐标。登记表每行 `{ id, measure(): number }`——**一行一个数**，因此 §8.3 的书写形态保持单值 `census:<id> = <n>`，不需要子键语法：一个测量面要暴露几个数就登记几行，键就是 `id`。登记表的查表面是 `CensusTable.of(id)`，查不到即抛（同一「未登记即抛」形态），表由 `censusTableOf` 在装配点建出——`CENSUS` 不是一个导出，它只是调用方给那个实例起的名字。登记项的供值面是既有导出，外加本相位新增的两个 `PinAudit` 访问器——`census()` 供 pin 普查的三个 finding 读数、`filesOf()` 供语料体积（见下）；登记面不二次计算：

- **pin 普查四行**——`pin.symbol` · `pin.path` · `pin.total` · `pin.files`，供值面是 `PinAudit.census()` 的三个 finding 读数、外加 `PinAudit.filesOf()` 给出的语料文件数（两个访问器都是本相位新增的公开成员，`contract/pins.ts` 今天两个都没有），与 §7 的 `scan` 同一次扫描；四行各是一个可复述的读数，不是四种猜法：`pin.symbol` = §7.1 符号形态的 finding 数，`pin.path` = §7.1 路径形态（含测试 pin）的 finding 数，`pin.total` = 全语料 finding 数，也就是那一次扫描在 §7.3 的时间面判定之后剩下的 finding 数（= `pin.symbol` + `pin.path`，作者态零 · 关闭时零，同一个函数的一次读数，不是第二个计算；两处不得各算一套），`pin.files` 则是体积不是 finding 数：`PinAudit.filesOf` 给出的 §7.1 语料文件数。供 §7.3 的迁移完成陈述与计划的规模陈述引用。
- **两张注册表的计数三行**——`criteria.rows` · `questions.rows` · `questions.cells`，供值为 `CRITERIA_ROWS.length` · `LENS_QUESTION_ROWS.length` · 各行 `reviewKinds.length` 之和，使 §6.1 写下的计数成为被门比对的引用。

消费者要有具体落点：门可以建起来、绿着、一条主张都没比过——§6.2 给每个 `face` 设了最低一行的下限，§8 同样要有一条（§8.3 的下限 pin），§6.1 的三处 `census:` 引用已是可核形态，登记面落地即可比对。迁移规模本身仍不预登记（§7.3 已撤回无法复现的计数），迁移完成后的数字在相位关闭时以同一形态写出。

#### 8.3 门的判据

这条门是本相位新建的一条结构测试（文件路径由计划的 `Create:` 行声明），它只判一件事：语料里每个 `census:<id>` 的声明值是否等于登记项的导出值。它扫 `docs/kairos/**/*.md` 与 README 家族：每个 `census:<id>` 解析到登记项，并把**该引用自身固定形态里的 `<n>`** 与导出值比对——`<n>` 只从 `census:<id> = <n>` 的等号右侧读，同一行 / 同一单元格里的其它数字不参与比对（不存在「把这一行里的数字拿去比」这种读法）。**不等即红；合形而未登记的 id 抛**。

**哪一些 `census:` 词算引用，本身是一条写进判据的语法**（`CensusGate.referencesOf` 是它唯一的读面）：左侧 id 必须是小写点分形式——`census:pin.total` 是（至少一个点），`census:rows` 这种无点 id 不是；右侧必须是十进制整数，且整数后的终止符不是数字 / 字母 / 点——小数右侧因此不被截断成一个整数，而是整条落在引用之外。不合这一形的 `census:` 词是**关于形态的散文**，门既不比对也不查表（本语料自己写的占位 `census:<id> = <n>` 就是这一形）；合形而 id 未登记即抛，不是静默略过。

下限同样成对：语料里必须至少有**一处**真实的 `census:<id> = <n>` 被比对，否则门在对零个引用全绿——§6.1 的三处引用与 §1.3 / §3.1 的同 id 复述是这条底座的具体实例，删光全部引用即红。

#### 8.4 边界

只核对被 `census:` 声明的关系，不判数字的字面是否「看起来合理」，也不覆盖未被声明的计数——本相位不做散文语义推断。这条门的失效面是**红**：它不是一处「不改变消费者字节」的观察，而是让规模陈述不可虚构的那个断言，按 warn 判档的说法会把门做成永不变红的展示行（§8.3 的「不等即红」即其执行面）。

### Acceptance criteria

- `判据行是判据的单位：每行 `body` / `duty` / `counterExample` 三格全必填，`tier` 三值各至少一行——三档的边界定义 / 举证义务 / 反例句因此各有一条，`warn` 档另有 pin 可解析性那一行（§7.4），`nit` 档另有 §5.2 的显示行 `regrade-mark`（显示行不是判档，§6.1）；装配公式固定为 `body` → `duty` → `counterExample`，三格全进字节，**每一行**的 `duty` 句与 `counterExample` 句逐字出现在 `SEVERITY_RUBRIC` 的渲染产物里（成对 pin：完整判据表装配成功且每行三句都在字节里 / 把某行的 `counterExample` 置空串 ⇒ 装配即抛、该行片段不出现；从行里删掉该键 ⇒ `tsc` 红——两段校验契约见 §6.1）；判据表按 `tier` 覆盖 blocker / warn / nit 各至少一行，缺行 ⇒ 装配失败；`face` 三值各至少一行并各自接上执行面——`gate` 行的 `id` 出现在 §2.2 的 `CDD_BLOCKED: grading-impact-missing` 报文里、`test` 行的 `id` 被一条测试格题命名、`numbered` 行出现在渲染产物里；全标 `numbered` 而门 / 格题缺席 ⇒ 红（成对 pin：完整判据表装配成功 / 删一行装配即抛）`
- `impact 场景成对 pin：blocker 缺 `impact.scenario` ⇒ `CDD_BLOCKED: grading-impact-missing` 由交接单回读面打出（与其它 schema 拒绝同一行、同一路径），报文首词固定、随后是 blocker 举证判据行的 `id`，并列出违规 finding 的 `id`；补上场景 ⇒ 通过；warn / nit 无场景 ⇒ 通过；拒绝面只有这一处（`rollup` 返回仍是 `RoundStatus`，`--dry-run` 不声称读该谓词）`
- `wave / branch 的 axes guide 零 `(severity by your judgment)`；lens 问句表（行形态 `{ id, reviewKinds, lens, question, face }`，`reviewKinds` 多值、`face` 恒为 `numbered`）按 (review kind, lens) 覆盖 `census:questions.cells = 19` 格、物理行 `census:questions.rows = 15` 条（`wave` / `branch` 四行以 `reviewKinds: ["wave", "branch"]` 存一份；行数即 `LENS_QUESTIONS.rows.length`，格数是各行 `reviewKinds.length` 之和），与判据表分开计数（判据表各 `tier` 至少一行）；投影 pin：五类 review 渲染出的 `**Criteria —` 行逐字带上该类自己的编号问句（逐类条数即 `LENS_QUESTIONS.forReviewKind(reviewKind)` 的行数，`wave` 与 `branch` 字节同源），删掉表里任一问句行 ⇒ 该类 prompt 少一条编号问句；把问句塞进判据表或把判据行塞进问句表 ⇒ 查表即抛`
- `wave review 的 round context 的 `INPUT_SPEC` / `INPUT_OVERALL` 按身份文档形状配对 pin：身份文档与它的 `program:` 母宪章都解析到 ⇒ 两 token 均出现且路径为仓根相对、可读；身份文档解析到但无 `program:`（single-spec）⇒ 只出 `INPUT_SPEC`，`INPUT_OVERALL` 合法缺席（负向 pin：不得因此连 spec 锚一起剥）；身份文档缺席或 `invalid` ⇒ 两 token 均不出现；`program:` 指不到母宪章 ⇒ 只丢 `INPUT_OVERALL`；branch 的 prompt 字节不变`
- `降档且上一轮同一行（「上一轮」= 同一行上更早的、findings 投影非空的那条记录；匹配键为 `summary` 原文相同，多行同文时以 `id` 收窄，**或**上一轮该行的 `impact.scenario` 原文相同——母宪章 P37 ⑥ 的键）的 `impact.scenario` 在 `trim()` 后非空：无 `regrade` ⇒ 板面该 verb token 与胶囊的 `summary` 行各一条可见标记（胶囊侧成对 pin：无降档的评审轮 stdout 与今天逐字节相同，有降档恰好多这一行），且该标记不进 `findings[]`（负向 pin：一条这样的降档既不新增 finding，也不单独把本轮推成 `REVIEW_FIX`）；本轮省略或改写 `scenario` 不注销该义务（正向 pin：省掉场景文本仍出标记）；有 `regrade` ⇒ 两处各出现一次理由；上一轮该行 `scenario` 在 `trim()` 后为空 ⇒ 不要求、不标记；参照对象 pin：一条 review 的降档与它之前**最近一条 findings 非空的 review** 配对——中间夹一条 findings 为空的 implement 记录时仍出标记（按「紧接着的上一条记录」读则零行匹配、标记消失）；第二键 pin：上一轮场景原文不变而本轮 `summary` 换了说法 ⇒ 仍配对、仍出标记`
- `pin 门可红可修，两个执行面各 pin 自己的语料：注入一条指向不存在符号的 markdown pin ⇒ `PinAudit` 红并指出该 pin；一条符号形态成对 pin：两半都在索引里的连写（类 + 成员）⇒ 绿，成员半换成索引里没有的名字 ⇒ 恰好多一条 finding（成对 pin：小写成员名按散文处理、不产 finding）；测试形态成对 pin：`<file>.test.ts::<格题>` 的格题在所指文件里存在 ⇒ 绿，格题在文件里不存在 ⇒ 恰好多一条 finding（把路径与题名写成两枚 token ⇒ 只有路径被判定、改题名不红，反向 pin）；**全语料零 finding**（无基线 / 无白名单 / 无豁免）为门的上线条件，**判在相位关闭时**（作者态的红只允许落在 §7.3 三条同时成立的待建路径上：被审文档的 `slug:` 等于该计划的 `slug:` 或该计划身份文档的 `program:` · 树中缺席 · 该计划未被 `Implementation plan` 格的 `✔ Done` 点名），由 §7.3 的一次性迁移达成（过期引用删除、迁移路径修正、行号越界修正）——迁移前后语料 finding 数从非零变零（成对 pin）；§7.1 的三级优序逐条成对 pin：一条带共享尾部的裸路径（仓根 `README.md` 与 `.changeset/README.md` 同尾）⇒ 层级 ① 的全等条目胜、行号按仓根那份的行数判（取首条命中而落到更短那份 ⇒ 红）；一条唯一后缀（`face/declare.ts` 这种只有一个候选的尾）⇒ 层级 ② 解析到那一份；一条多候选的裸名（同时命中两处的尾）⇒ 层级 ③ 不挑、产一条 ambiguity finding 并点名**全部**候选（静默取首条 ⇒ 红）；一条 finding 的 `contract.path` 解析不到 ⇒ 同一回读面追加一条 warn 级 finding，该轮不 BLOCK（无 `CDD_BLOCKED`），并按 warn 的既有语义进 `rollup`（成对 pin：本来零 finding 的评审轮 → `REVIEW_FIX`，不会停在 `APPROVED`）；被审文档语料（§7.2 回读面的第二份）单独成对 pin：干净的被审文档 ⇒ 零注入 finding、结论不变（`APPROVED` 仍 `APPROVED`），文档里一条解析不到的 pin ⇒ 该轮恰好多一条 warn 级 finding、零 blocker，结论落到 `REVIEW_FIX`（反向 pin：把这条注入面当成只显示而不进 `findings[]` ⇒ 红）；该语料同受 §7.3 的时间面约束（成对 pin：被审文档里一条由同 `slug:` 的计划 `Create:` 行声明、树中缺席、且该计划未被 `Implementation plan` 格的 `✔ Done` 点名的路径 ⇒ 零注入 finding、结论不变；一条没有任何 `Create:` 行声明的死 pin ⇒ 恰好多一条 warn 级 finding、结论落到 `REVIEW_FIX`）；§7.3 的条件 ③ 由**宣告该 `Create:` 行的计划**的关闭记录判定，不是被审文档自己的相位，因此宪章面同样成对 pin：母宪章（它的 `slug:` 是程序 slug，不属于任何相位行）里一条待建路径——由某计划的一条 `Create:` 行声明（该计划的身份文档声明 `program:` = 宪章的 `slug:`）——树中缺席、且该计划未被 `Implementation plan` 格的 `✔ Done` 点名 ⇒ 零 finding、结论不变；同一条路径在任何计划里都没有 `Create:` 行 ⇒ 恰好多一条 warn 级 finding、结论落到 `REVIEW_FIX`（按被审文档自己的 `slug:` 判则宪章不与任何计划同 slug、永不跳过 ⇒ 红）；闭合面成对 pin：同一条路径由一份其 `Implementation plan` 格已写成 `✔ Done（…）` 的计划声明 ⇒ 跳过失效、恰好多一条 warn 级 finding；无闭合登记面的一面（single-spec · 无 `## Phase inventory`）同受 pin：同 `slug:` 的计划 `Create:` 行声明 + 树中缺席 ⇒ 零 finding，该计划删掉这条行 ⇒ 恰好多一条 warn 级 finding；已消费的 `.changeset/*` 引用按 §7.1 第 3 条排除，既不产 finding 也不在迁移清单里；pin 定义的四条排除（非仓根相对 / 产物词汇 / 易逝 changeset / 模式）各有成对 pin：排除形不产 finding、真死引用产 finding；模式那一条按本 spec 自己的三处行文钉——`*.guard.test.ts`（§6.2）· `<file>.md`（§7.3）· `<file>.test.ts::<格题>`（§7.1）各产零 finding，把同一 token 的元字符换成指不到任何条目的具体名字 ⇒ 恰好多一条 finding；注入行的 lens 取该评审面自己声明的 `pinLens`（`render/templates.ts#pinLensOf` 与同一份 `lensEnum` 交叉校验，drift 即抛，因此载体里不会出现同轮提示词声明为不可能的 lens）：`phase-spec` / `single-spec` 面 `consistency` · `overall` 面 `inventory` · `plan` 面 `buildability` · `wave` / `branch` 面 `standards``
- `计数面成对 pin：文档里 `census:<id> = <n>` 由门解析到计数登记面（本相位新建，路径由计划的 `Create:` 行声明）的登记项并与导出值比对——一致 ⇒ 绿；把 `<n>` 改一个数而不改实现 ⇒ 红；未知 id ⇒ 查表即抛（限定在 §8.3 的引用形态内；形态外的 `census:` 词按散文、不查表）；登记表一行一个数（`measure(): number`），pin 普查登记四行 `pin.symbol` / `pin.path` / `pin.total` / `pin.files`（依次为符号形态与路径形态的 finding 数、二者之和的 `pin.total`——即 §7.3 时间面之后同一次扫描的读数——以及 §7.1 语料的文件数 `pin.files`；四行必须可复述，不得各自暗含另一种含义），两张注册表登记 `criteria.rows` / `questions.rows` / `questions.cells`，供值面依次是 `CRITERIA_ROWS.length` · `LENS_QUESTION_ROWS.length` · 各行 `reviewKinds.length` 之和（§8.2 的同三行）——pin 扫描的读数只落在上面那四行 `pin.*`，不与注册表三行交叉（两处不得各算一套）；下限 pin：语料里至少一处真实 `census:<id> = <n>` 被比对，把 §6.1 / §1.3 / §3.1 的引用全删掉 ⇒ 红（零引用全绿等于没门）`
- `validate 全绿（`pnpm run validate` exit 0）；changeset `cdd-engine` **minor**、kairos 无`

## Constraints

- 跟随仓内既有范式：注册表 + 「查不到即抛」（`contract/completion-criterion.ts`）；`src-next` 零裸函数、参数 ≤4、类 ≤200 行、接口先行、协作者构造注入。类 ≤200 行的上限**只约束本相位新建的类**；既有类按 rule zero 处理——本相位触到的每一个超限既有类都免于该上限，每处改动在代码里写一行理由（行数在拆分时重测，本 spec 不登记具体数字——本相位自己的交付会改动它们）。今天的交付触到的超限既有类逐个具名：`session/ledger.ts`（`RoundFinding` 扩 `id` / `impact` / `regrade` 三格，两个投影同步）· `face/lifecycle.ts`（`#reconstruct` 的 pin 回读与 `gradingViolations` 的拒绝面）· `face/board-view.ts`（verb token 的降档标记与 `LineCarriers#regradeNoteOf`）· `session/handoff-schema.ts`（`impact` / `contract` / `regrade` 三格与同处的纯判据助手）· `face/cli.ts`（`#sceneOf` 的 wave 臂与 plan / branch 臂在同一条派发链上取同一个值）· `render/templates.ts`（rubric 由注册表装配、`pinLens` 声明在 `lensEnum` 旁、编号问句折进各面 axes guide）· `session/run.ts`（`#capsuleLines` 的约定跟着 `summary` 槽的第二个填主走）· `session/round-artifacts.ts`（`ArtifactRegistry.ownsName`——产物词汇的答案，pin 定义要读它）；`face/capsule.ts` 同批触到但在上限内（同一个 `summary` 槽的约定）。拆分归 P39（D95 ②）。
- pin 写法：§7.1 的三形态——路径（行号只在路径上出现，且不超解析到那份文件的行数）· 裸符号 · 测试格题；成员引用按 §7.1 的连写规则落在裸符号形态上，符号永不带行号。本 spec 自身遵守此纪律。
- 不改 D70 收敛判据（`blocker > 0 ⇔ CHANGES_REQUESTED`）与「任何 findings → fix」路由。
- 不重审已闭合相位的 finding 判档（P36 那 7 条只是病根证据）；`packages/kairos/skills` 文本零改动。
- prompt 字节会变（rubric 由注册表装配），changeset 为 `cdd-engine` **minor**；kairos 无。

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-11-16 | 初稿：判档本体改为功能影响 + 三级边界（每档一条举证与反例句）· `impact` 场景字段与 `rollup` 成对门 · `contract` 降为可选锚点 · lens→影响判定问句 · wave 注入 `INPUT_SPEC`/`INPUT_OVERALL` · 跨轮改档落账 · 生成式判据注册表 · pin 三形态可解析性门（P28 窄形态反转） | Oscaner M. · Claude（kairos:cdd-spec-writer · 2026-11-16） |
| v0.2 | 2026-11-16 | 结构修正：`### Acceptance criteria` 归入 `## Design`（原先误落在 `## Constraints` 之后）；每条 AC 以 `` `- ` `` 开首，对齐 `Acceptance entry` 的 valuePattern | Oscaner M. · Claude（kairos:cdd-spec-writer · 2026-11-16） |
| v0.3 | 2026-11-16 | 评审修复：wave 注入的两格收成成对判定（解析到 ⇒ 同时出现且路径可读；缺席或 `invalid` ⇒ 同时丢弃）并与 AC 的成对 + 负向 pin 对齐 · `contract.path` 的执行面点名为交接单回读的第三消费者，`PinAudit` 只扫 markdown 语料 · regrade 标记明示为显示面（不进 `findings[]`、不动 `rollup` / D70）并补负向 pin · 删除无消费者的可选 `impact.kind`，`impact.test` 留作可选加强 · `CDD_BLOCKED: grading-impact-missing` 的谓词与打印面点名（`HandoffSchema` 纯谓词 + lifecycle 回读同一行，`rollup` 返回类型不变） | Oscaner M. · Claude（kairos:cdd-spec-writer · 2026-11-16） |
| v0.4 | 2026-11-16 | 评审修复：注册表拆成两张表——判据表 `{ id, tier, body, duty, counterExample, face }` 供 `SEVERITY_RUBRIC` 装配，lens 问句表 `{ id, reviewKind, lens, question }` 以 15 行覆盖 19 格，AC 按表各计一次；删除没有执行面的 `--dry-run` 半边，`grading-impact-missing` 只由交接单回读面打印；regrade 匹配改用稳定键 + 上一轮非空场景，省略或改写场景不注销改档理由（标记仍是显示面）；明示 `gradingViolations` 为同处纯助手、`rollup` 不承接拒绝 | Oscaner M. · Claude（kairos:cdd-spec-writer · 2026-11-16） |
| v0.5 | 2026-11-16 | 评审修复：判据表补装配公式（`body` → `duty` → `counterExample` 恒序、三格全进字节），`SEVERITY_RUBRIC` 的语料范围收窄为档位散文、标定尾段仍由 `reviewGuideOf` 承接；lens 问句表补 `face: numbered` 与唯一投影面——`REVIEWS[*].axesGuide` 由 `LENS_QUESTIONS.forReviewKind` 装配编号清单、随 `**Criteria —` 行进 prompt；§6.2 的 `numbered` 核对扩到问句行，AC 增投影 pin 与档位片段进字节的 pin | Oscaner M. · Claude（kairos:cdd-spec-writer · 2026-11-16） |
| v0.6 | 2026-11-16 | 存量迁移裁定（用户：「过期档案删除，没过期档案修」）：§7.1 把**pin 的定义**写进门内（三条排除：非仓根相对的 `./` / `...` 省略形 · 产物词汇如 `progress.json` / `.rulings.json` / `X.md` · 按设计被消费的 `.changeset/*`），使非仓根相对的行文词汇不再被误判为坐标；§7.2 语料面改为**全语料零 finding，无基线 / 无白名单 / 无豁免**（门的范围是一句定义，不是一份数据）；新增 §7.3 一次性存量迁移——过期引用删除 · 迁移路径修正 · 行号越界修正（改路径 + 符号），迁移只改坐标与引用句、不改任何结论，规模由门的首次全语料扫描给出；AC ⑥ 重写为成对 pin（迁移前后 finding 数非零→零 + 三条排除各一对） | Oscaner M. · Claude（kairos:cdd-plan 回填 · 2026-11-16） |
| v0.7 | 2026-11-16 | 评审修复（第 4 轮 12 条全部采纳）：§5.2 的落点改挂既有渲染面--板面每 verb token 内加标记、胶囊走既有的 `summary` 槽并明示这是设计里唯一新增的一行(撤销「不新增行」的概括,改为不新增 finding 行 / 条目 / 结论改动);§7.2 的 `contract.path` 失配改为按 warn 的既有语义进 `rollup`(`REVIEW_FIX`,不 BLOCK),消费者由「三个」改为「一条判据、两份语料、两个执行面」;§2.1 明写 `RoundFinding` 扩 `id` / `impact` 两格与两个投影同步;§5.1 的跨轮键改为 `summary` 优先、`id` 只作同文收窄(`id` 是行号不是缺陷身份);§4.1 按身份文档形状改配对规则(single-spec 合法只有 spec 锚)并修正「只为 plan/branch 设」的归因;§7.3 撤回无法复现的迁移计数、把已消费 `.changeset` 移出迁移清单、显式记名 D22 反转并回填母宪章;§6.2 为 `gate` / `test` / `numbered` 各钉至少一行与各自的报文 / 格题面;§2.2 改由举证义务作主语,报文带判据行 `id`;Constraints 的类上限只约束新建类;AC 1-6 随行重写 | Oscaner M. · Claude(kairos:cdd-plan 回填 · 2026-11-16) |
| v0.8 | 2026-11-16 | 评审修复（第 5 轮 7 条全部采纳）：§1.3 的规则从「每档一条反例句」改为「每行一条」（`counterExample` 是判据行的格子），补上 blocker 档的反例句（说得出一处偏离却举不出「输入 → 实际 → 预期」⇒ warn），并指明 `warn` 档有两条（档位行 + §7.4 的 pin 判据行）；§2.1 把 `regrade` 一并列入 `RoundFinding`（`{ severity, summary?, id?, impact?, regrade? }`）与两个投影，§5.2 板面补 per-record 读面 `LineCarriers#findingsOf`（投影复用 `HandoffSchema.findingsOf`，`countOf` 语义不动）；§5.1 的「上一轮」定为同一行上更早的、findings 投影非空的那条记录（implement 的空投影不参与匹配，否则零行匹配、降档静默通过），AC ⑤ 加参照对象 pin；§7.2 的第二份语料点名为被审文档自身的 markdown、读点为 `#reconstruct` 的身份文档正文，AC ⑥ 补其成对 pin（干净文档零注入；一条死 pin ⇒ 恰好多一条 warn、落 `REVIEW_FIX`）；§6.1 补装配校验契约（删键 = 类型层红，空白格与档位缺行 = 装配期抛），AC ① 的负向 pin 随之拆成两段；§2.2 记名座位反转（母宪章原写 `rollup`，本相位改挂 `HandoffSchema.gradingViolations` + 交接单回读面，三处已回填）；AC ⑥ 的「两个语料面」改为「两个执行面」 | Oscaner M. · Claude（kairos:cdd-spec-writer · 2026-11-16） |
| v0.9 | 2026-11-16 | 修复轮（wave 2,5,6 · review-3 的 F1 受理）：§7.2 明确注入行的 lens **按面取、不写死**——每个判据体在 `lensEnum` 旁声明 `pinLens`，注入点读 `pinLensOf(frame.type)` 并与同一份 `lensEnum` 交叉校验（drift 即抛），因此载体里不会再出现同轮提示词声明为不可能的 lens；逐面取值 `phase-spec` / `single-spec` = `consistency` · `overall` = `inventory` · `plan` = `buildability` · `wave` / `branch` = `standards`（`contract.path` 语料在每个判据面上都会出现，故不是 spec 专用），两份语料的 lens 同源；AC ⑥ 补该交叉校验与逐面取值 | Oscaner M. · Claude（kairos:cdd-fix · 2026-11-16） |
| v0.10 | 2026-11-16 | 评审修复（第 6 轮 F1–F11 全部采纳）：问句表行形态按树改为 `{ id, reviewKinds, lens, question, face }`，多值 `reviewKinds`，物理行 15 = `rows.length`、覆盖 19 = 各行 `reviewKinds.length` 之和（§3.1 · §6.1 · AC ③）；§6.2 / §7.4 的 `test` 面文件名改为 `contract/__tests__/pins.guard.test.ts`；§7.1 的路径形态改为 `path.ext[:line[-line]]` 并说明裸路径同样是 pin、行号出现时不得超过文件行数，裸符号的第二个例子换成 `PinAudit`；§5.1 的「上一轮」读面改指 `recordsOf` + `readHandoff` + `HandoffSchema.findingsOf`（原先点名的单条读面并不存在）；§6.1 记名显示行 `regrade-mark` 并把显示措辞的落点写清，§5.2 同步；§1.3 的普查改为每档至少一行、点出五行，第二句标为 blocker 行的 `body` 句；§6.2 的普查改指 `contract/__tests__/review-criteria.test.ts` 与 `render/__tests__/templates.test.ts`；Constraints 撤掉四个文件的行数、改为拆分时重测 | Oscaner M. · Claude（kairos:cdd-fix · 2026-11-16） |
| v0.11 | 2026-11-16 | 并入 §8 计数的执行面（用户裁定「并入 P37」· D93 ⑨）：`count` claim 只有写作规范没有执行面，本相位的计划因手测数字三次被评审打回；规则为「数字必须带 `census:<id>` 引用并由门核对」，计数登记面登记 `{ id, measure() }`、未知 id 即抛，首个登记项 `PinAudit.census()`；门比对固定书写形态 `census:<id> = <n>` 与导出值，不等即红；边界为只核已声明引用、不做散文语义推断 | Oscaner M. · Claude（kairos:cdd-dev 回填 · 2026-11-16） |
| v0.12 | 2026-11-16 | 评审修复（第 7 轮 F1–F9 全部受理）：§7.1 的路径 pin 改为固定解析序（全等胜 · 否则唯一后缀 · 多候选产 ambiguity finding 并列出全部候选），行号按解析到的那个条目判；§7.3 补上线条件的时间面（作者态的红只允许落在计划 `Create:` 声明、树中缺席、相位行仍 `[Pending]` 三条同时成立的待建路径上，关闭时仍须零 finding）；§8.2 的登记表改为一行一个数 `measure(): number` 并点名七个 id（`pin.symbol` · `pin.path` · `pin.total` · `pin.files` · `criteria.rows` · `questions.rows` · `questions.cells`）；§8.3 只从固定形态读 `<n>` 并加「至少一处真实引用」的下限，§6.1 的三处计数随之带引用；§8.4 删掉 warn 档措辞（门失败即红）；§5.1 恢复母宪章 P37 ⑥ 的场景原文键为第二个匹配键，两键任一命中即配对，AC ⑤ 补第二键 pin | Oscaner M. · Claude（kairos:cdd-fix · 2026-11-16） |
| v0.13 | 2026-11-16 | 评审修复（第 8 轮 F1–F9 全部受理）：§7.3 的时间面扩到三份语料——跳过由 `PinAudit` 一处判定（`scan` / `scanText` / `pathResolves` 读同一张待建路径表），被审文档正文不再被注入指向本相位待建模块的 warn 行，规格评审可在登记模块落地前收敛；条件 ③ 点名母宪章 `## Phase inventory` 的 `Design spec` 与 `Implementation plan` 两格都仍为 `[Pending]`（两格只在相位关闭时写 `✔ Done`，故该条即「该相位尚未关闭」），§7.3 的裸计数与其分处拆分撤回、改为只点名两个目标；`pin.total` 定义为同一次扫描在时间面判定之后剩下的 finding 数（作者态零 · 关闭时零，同一个函数的一次读数）；AC ⑥ 补 §7.1 三级优序的三条腿（全等胜 · 唯一后缀 · 多候选点名全部候选）与被审文档语料的时间面成对 pin；§1.3 / §3.1 的裸计数改为 `census:criteria.rows = 5` / `census:questions.cells = 19`；§8.2 说明供值面是既有导出加本相位唯一的访问器 `PinAudit.census()`；§8.3 点名该计数门的测试文件（路径留给计划）并同步下限 pin 的删光条件 | Oscaner M. · Claude（kairos:cdd-fix · 2026-11-16） |
| v0.14 | 2026-11-16 | 评审修复（第 9 轮 F1–F10 全部受理）：§7.3 的条件 ③ 补上主语——由宣告该 `Create:` 行的计划所属相位判定，而不是被审文档自己的相位，并写明母宪章是一个 `program:`、不属于任何相位行，其待建 pin 由计划声明它的那个相位判，AC ⑥ 随之补宪章面的成对 pin；§7.3 把待建处明确为由第三条判据跳过、不进待改清单（原先一句同时把它们算作迁移工作又排除在外）；按裁定撤掉 §8 里的前向坐标——计数登记面与计数门的结构测试文件均只说「路径由计划的 `Create:` 行声明」、不写尚未落地的文件，§8.3 改按它判的事实命名，因此本 spec 体上的失效 pin 告警归零；§8.2 补齐 `pin.symbol` / `pin.path` / `pin.files` 的含义（符号形态 finding 数 · 路径形态 finding 数 · 语料文件数），AC ⑦ 同步；§8.2 的「今天即可比对」改为登记面落地即可比对；§3.1 / §6.1 / §6.2 / AC ③ 的裸计数改为 `census:` 引用（问句表的行数与格数） | Oscaner M. · Claude（kairos:cdd-fix · 2026-11-16） |
| v0.15 | 2026-11-16 | 时间面改钉 `slug:` 而非 `program:`（用户裁定：消费者同样会死锁）：条件 ① 由「同一 `program:` 的计划文档」放宽为「同一 `slug:` 的计划文档」，条件 ③ 由母宪章的 Phase inventory 单入口改为「该计划尚未关闭」——`program:` 存在时用宪章两格、缺席时（single-spec）用该 slug 的关闭标记；补写「为什么钉在 `slug:`」一段，列明三类会被永久红的消费者（single-spec · 相位 Done 后追加 · 不用 overalls 的仓）。判据仍无基线、无白名单、无豁免：三种失效各对应一条自毁路径 | Oscaner M. · Claude（kairos:cdd-dev 回填 · 2026-11-16） |
| v0.16 | 2026-11-16 | 评审修复（第 10 轮 F1–F5 全部受理）：时间面改钉**身份键**、给两条腿各自的事实—条件 ① 由「同一 `slug:` 的计划文档」改为「被审文档的 `slug:` 等于该计划的 `slug:`，或等于该计划身份文档声明的 `program:`」（计划不写 `program:`，母宪章的 `slug:` 就是程序 slug，宪章因此可经计划到达）；条件 ③ 换成一处处可读的闭合登记面—母宪章 `## Phase inventory` 的 `Implementation plan` 格写成 `✔ Done`、且解析到的那份文档与计划同 `slug:`，无该登记面时以声明本身为界，主语是计划而不是被审文档，读面改指 `contract/doc.ts` 的生产读取面（原先指的是一份 vitest 文件）；§7.3 的 rationale 撤掉「相位 Done 后追加的任务」这一类（它在条件 ③ 下必然红，重开已闭合相位是宪章变更），并写明无宪章那一腿更弱；§6.1 / AC ③ 的逐类问句条数改为投影读数（§8.1 的 `census:` 纪律），§7.2 与 AC ⑥ 同步成对 pin | Oscaner M. · Claude（kairos:cdd-fix · 2026-11-16） |
| v0.17 | 2026-11-16 | 评审修复（第 11 轮 F1–F6 全部受理）：条件 ③ 的闭合面在两处写成同一格——AC ⑥ 的三处与 §7.3 收尾句的「`✔ Done` 格」改为「`Implementation plan` 格的 `✔ Done`」，与 §7.3 正文一致；条件 ③ 的「文件名 → 文档」一跳补上具名读面（`SlugIndex#entries` 里每个 `DocEntry.rel` 的文件名部分全等比对，不拼接路径、不按文件名推演身份），并声明零命中与不唯一命中同判「已关闭」——登记烂掉不能换来跳过；条件 ① 的第二支改用 AC ⑥ 的写法「该计划身份文档声明的 `program:`」；§5.1 的行号语义指针改指符号（`HandoffSchema` 的 `downgrades` 与 `RoundFinding`），不再指 `id` 字段不存在的注释；§4.1 补验收落点（只钉锚的出现与可读，不钉「被引用」，与母宪章 P37 验收 ④ 同一形态）；母宪章 D93 ⑨ 附注已按本节回填（v4.00）——相位 `Done` 后追加 `Create:` 行的一类不再写作「无解除路径」，改按 §7.3 的代价陈述 | Oscaner M. · Claude（kairos:cdd-fix · 2026-11-16） |
| v0.18 | 2026-11-16 | 评审修复（第 12 轮 F1–F5 全部受理）：§7.1 补测试 pin 的书写形态——`<file>.test.ts::<格题>` 两半同 token、`::` 前是文件半（须落在树里且以 `.test.ts` 结尾）、后是格题原文，路径一枚加题名另一枚不算这一形，AC ⑥ 补其成对 pin；§7.1 补成员引用的写法——索引是平坦标识符集，成员与载体同 token 以 `.` / `#` 连写、尾随实参先剥、有 `#` 取最后一个否则取第一个 `.`，前半按裸路径 / 裸符号过筛、后半过同一套符号形状判据，两半过筛而任一解析不到即产 finding（小写成员名与树上尚不存在的成员同判散文），Constraints 的「路径 + 符号」改为指向 §7.1 的三形态并删掉与正文不符的断言，AC ⑥ 补成员的成对 pin；AC ⑦ 的三行供值面改为 `CRITERIA_ROWS.length` · `LENS_QUESTION_ROWS.length` · 各行 `reviewKinds.length` 之和，pin 扫描读数只落在 `pin.*` 四行；§2.2 的举证谓词改为 `trim()` 后非空（与 §6.1 的空白格同一判据），§2.1 · §5.1 步骤 3–4 · AC ⑤ 同步；§2.2 删掉不存在的 `§3.3` 指针 | Oscaner M. · Claude（kairos:cdd-fix · 2026-11-16） |
| v0.19 | 2026-11-17 | 实现期对齐（§8.2 的供值面落地 · AC ⑦）：§7.3 的作者态读数由散文里的「零」写成可核引用 `census:pin.total = 0`——门读的是语料整体而不是本 spec 一份，因此这条引用在成员形态上线的那一刻就已既定（语料里另有九处同 id 引用），本次只把它对齐成同一形态；正文、本行与 front-matter 的 `version:` 三处同批落地（doc 契约腿不比正文与血缘，漏写不红，而 Constraints 按 `version:` 消费本 spec 的面） | Oscaner M. · Claude（kairos:cdd-dev · 2026-11-17） |
| v0.20 | 2026-11-17 | 评审修复（第 13 轮 F1 / F3 / F4 / F5 全部受理）：§7.1 的成员引用基础句改为门真正读的语料——符号索引取三棵源树的**代码体**（注释体与正则字面量体抹掉、字符串 / 模板字面量有意保留，因为胶囊的 `CDD_BLOCKED:` 与任务块 `DependsOn` 家族只在字面量里声明），不是「只按声明收集」的标识符集；§5.2 的板面标记改写成它实际是的那次判定——`LineCarriers#regradeNoteOf` 从 `findingsOf` 往回取最近一条非空记录，交给 `HandoffSchema.downgrades` / `HandoffSchema.regradeReasons` 合成，标记恰在「降档而无理由」时出；§8.2 的查表面改为树里真有的 `CensusTable.of(id)`（表由 `censusTableOf` 在装配点建出），并把「新增唯一一个访问器」改成两个（`census()` 供 finding 读数、`filesOf()` 供语料体积） | Oscaner M. · Claude（kairos:cdd-fix · 2026-11-17） |
| v0.21 | 2026-11-17 | 分支修复（branch-review-1 · F1 受理）：§7.1 的裸符号语料由本仓三棵源树（引擎源 · 技能包 · `scripts`）改为**被审仓库自身的源文件**——引擎装进消费方仓库运行，那棵树里没有这三棵，写死树名会让符号索引在消费方为空、把每一条活着的符号 pin 判成死 pin，该轮因此落到 `REVIEW_FIX`，而红源在语料的声明方式上、任何文档改动能清掉它——§7.3 为路径形消掉的正是这个环；成员段的同一句随之改为「被审仓库自身源文件的代码体」，构建输出与机器本地目录不进索引。判据、三份语料与全部成对 pin 一概不变 | Oscaner M. · Claude（kairos:cdd-fix · 2026-11-17） |
| v0.22 | 2026-11-17 | 评审修复（第 14 轮 F1–F3 全部受理）：§7.3 的两条机制句改为门真正读的面——条件 ① 的两个身份键读 `ForwardPaths#headsOf` 自建的头表（`PinIndex.entries` 逐份 `FrontMatterExtractor.split` 出 `slug:` / `docType:` / `program:`），`#reconstruct` 里不建第二个 `SlugIndex`（唯一共享的 `SlugIndex.isLegalSlug` 只是拼写判定，P36 把身份索引限在命令前导三处），宪章是头表里 `docType: overall` 且 `slug:` 等于计划身份文档 `program:` 的那一份；条件 ③ 的闭合文件名改为与头表里每份文档 `rel` 的文件名部分比对；§5.2 写清标记措辞的落点——`REGRADE_MARK` 与判据表同模块导出、`regrade-mark` 行只登记显示事实（`body` / `duty` 照常进 rubric）、表里没有任何一格是标记本身（`review-criteria.test.ts` 逐格反证、`renderRubric` 不带该 token）；§8.3 补写引用语法（小写点分 id · 等号右侧十进制整数且终止符非数字 / 字母 / 点），形态外的 `census:` 词为散文，AC ⑦ 同步收窄「未知 id 抛」 | Oscaner M. · Claude（kairos:cdd-fix · 2026-11-17） |
| v0.23 | 2026-11-17 | 分支修复（branch-review-2 · F1 受理）：§Constraints 的既有文件豁免补齐第五个——`face/cli.ts` 随本相位的交付进场（`#sceneOf` 的 wave 臂与 plan / branch 臂在同一条派发链上取同一个值），此前只列四个，读者按本节核对交付树时只能把一处已批准的改动读成越限、或在本相位拆 `Cli`（那是 P39 的工作）。本轮补入该文件与它那一行 rule-zero 理由，正文、本行与 front-matter 的 `version:` 三处同批落地。判据、语料与成对 pin 一概不动 | Oscaner M. · Claude（kairos:cdd-fix · 2026-11-17） |
| v0.24 | 2026-11-17 | 评审修复（第 15 轮 F1–F3 全部受理）：§7.1 的 pin 定义补第 4 条排除——token 里带星号 · 尖括号 · 花括号 · 竖线或空白的命名的是**模式**（家族或派生规则），不是三形态里的坐标，本 spec 自己的 `*.guard.test.ts` · `<file>.md` · `<file>.test.ts::<格题>` 三处因此读作行文而不是死 pin；排除 ② 撤掉 `tasks-<N>-<op>.json`——矩阵渲染字面具名、`ArtifactRegistry.ownsName` 对它为假，它不是产物词汇，适用第 4 条；AC ⑥ 的四条排除各配成对 pin，模式那一条按上列三处钉（模式零 finding、换成指不到条目的具体名字恰好多一条）。Constraints 的既有类豁免改为**规则 + 具名清单**：除原五处外补 `render/templates.ts` · `session/run.ts` · `session/round-artifacts.ts` 三处超限类的 rule-zero 理由，`face/capsule.ts` 记为触到但在上限内 | Oscaner M. · Claude（kairos:cdd-fix · 2026-11-17） |
