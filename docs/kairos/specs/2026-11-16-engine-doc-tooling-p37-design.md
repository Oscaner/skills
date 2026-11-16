---
title: 分级判据的可核化（Grading Boundary）
doc-type: phase-spec
version: v0.8
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

反例句是判据**行**的格子，不是档位的格子：§6.1 的行形态里 `counterExample` 与 `tier` 平级，每一条判据行都带一条。因此三档各有一条，`warn` 档还有第二条——pin 可解析性那条判据行把 P28 的反转理由写在自己的 `counterExample` 里（§7.4）。三档的反例句如下，blocker 那条排在最前，因为它是把 §2.2 的举证判据翻成判档语言的那一句：

- 说得出一处偏离预期，却举不出「哪条合法输入 → 实际是什么 → 预期是什么」⇒ **warn**，不是 blocker：举不出场景的偏离没法被下一位评审者当场否证，也就不成立为功能影响，按缺陷描述自身的后果定档。
- 违反了一句写着的话，但消费者拿到的字节不变 ⇒ **warn**，不是 blocker。这一句封住 (a) 的旧漏洞：引得到条款不等于功能受影响。
- 一段死码当前无人调用、也不影响任何输出 ⇒ **warn**，不是 nit：它改变后来者的判断。
- 一处命名不一致但同一文件内自洽 ⇒ **nit**，不是 warn：它不误导任何跨面读者。

#### 1.4 (a)–(d) 降为 blocker 档的实例（对原非目标的显式反转）

`SEVERITY_RUBRIC` 现有的四条 blocker 触发器不再是判据本身，而是 blocker 档的**典型实例**：声明的 AC / 契约 / prompt 被违反且消费者可见 · 合法输入逃出声明失败面 · 门失败或套件永不红 · 安全与隐私缺陷。反转理由：judged by (a) 的「条款被违反即 blocker」正是漏洞本体，保留它作触发器会让条款狩猎通过判档。

### 2. `impact` 字段与 blocker 举证门

#### 2.1 字段形态

`session/handoff-schema.ts` 的 `FINDING` 声明新增可选 `impact`：

- `scenario: string` —— 输入 / 条件 → 实际 → 预期。这是唯一被举证判据 `gradingViolations` 要求的槽。
- `test?: string` —— 可选加强：一条能红的测试 pin（格题或路径）。它的消费者是下一位评审者（能当场重跑），因此不需要聚合面承接。

同一处声明新增可选 `regrade: string` —— 跨轮改档的理由（§5）。它同样在 schema 层可选：只有 §5.1 的**跨轮同一性 + 场景同一性**判据成立（降档，且上一轮那一行带着非空 `impact.scenario`）时才要求。

`impact` 在 schema 层可选（warn / nit 不需要它），**blocker 的必填性由举证判据 `gradingViolations` 判**——schema 层强制会连带 BLOCK 掉合法的 warn / nit finding。

§5.1 与 §5.2 要读的几格今天不在轮次 finding 投影里：`session/ledger.ts` 的 `RoundFinding` 只有 `{ severity, summary? }`，两个同形的投影（`Ledger#findingsOf` 与 `HandoffSchema.findingsOf`）把其余字段全丢掉。本相位把 `RoundFinding` 扩为 `{ severity, summary?, id?, impact?, regrade? }`，两个投影同步带上这三格——丢弃规则不变（未知 severity 仍丢），缺席仍是 `undefined`（present-facts-only）。三格各有自己的读者：`id` 与 `impact.scenario` 供 §5.1 的跨轮匹配，`regrade` 供 §5.2 板面的降档标记。两个读者都读这两个已声明的投影，不需要第三个读面去读持久化 carrier。

#### 2.2 举证判据与打印面

新增的举证义务只有一条：`severity === "blocker"` 的每一条，`impact.scenario` 必须是非空字符串。它**不由 `rollup` 承接**——`rollup` 只按 severity 数 blocker；这条判据写成与 `rollup` 同处（colocated）的纯助手 `HandoffSchema.gradingViolations(findings)`，由交接单回读面调用，`rollup` 的返回类型不扩、仍只回 `RoundStatus`，成对门不是第四种结论。

面由谁打印：失败面不动——`face/lifecycle.ts` 的交接单回读（`#reconstruct` → `#reject` → §3.3 那唯一一行 `CDD_BLOCKED`），与其它 schema 拒绝同一条路径，不新开第二个报错者、不在 `face/cli.ts` 另设一道门。这是唯一的拒绝面：`--dry-run` 在派发前预览、不进 `#reconstruct`，因此**不**声称读这个谓词，也不另设预览面。不满足 ⇒ 该轮不产生结论（不是产出一个值为 `BLOCKED` 的结论），报文为 `CDD_BLOCKED: grading-impact-missing`（首词固定，其后带判定这条义务的判据行 `id`——§6.2 的 `gate` 执行面就是这个字面），并列出违规 finding 的 `id` 与 `summary`（多条目全列，不二选一）。

座位的移动本身是一次显式反转：母宪章 D93 ⑦ 与 Phase inventory P37 的 Scope ② / 验收 ② 最初把这条判据挂在 `rollup` 上（「无场景的 blocker 被 `rollup` 拒」），而 `rollup` 没有 io 句柄、发不出上面那一行 `CDD_BLOCKED`。本相位把座位移到 `HandoffSchema.gradingViolations` + 交接单回读面，并已回填母宪章那三处；与 P28 的「不设门」反转、D22 的「历史面零动」反转一样，反转记名在册，读者不必在两份文档之间推断哪一处是本意。

#### 2.3 `contract` 降为可选修复锚点

`FINDING` 声明新增可选 `contract: { path: string; anchor: string }`——`path` 为契约文档或门的模块路径，`anchor` 为节号 / AC 编号 / 规则 id。它**不参与 `rollup`**，语义是「这条 finding 的修复落在哪」，供 fix 轮定位。`contract.path` 是一个 pin，因此受 §7 的可解析性门约束（解析不到产一条 warn 级 finding，不 BLOCK 该轮；它按 warn 的既有语义参与 `rollup`，见 §7.2）。但它的执行面**不在** §7.1 的 markdown 语料扫描里：`contract` 只出现在 judge 交接单的 finding 行上，因此由 §7.2 回读面的第二份语料（交接单 finding 行的 `contract.path`）判，`PinAudit` 永远不承接这一格。

### 3. lens → 影响判定问句（替代硬映射）

#### 3.1 规则

每类 lens 在注册表里声明**一句影响判定问句**——「这个 lens 下，什么算跨进功能影响」，而不是「这个 lens 一律落哪一档」。硬映射与按影响判档互斥，注册原文的 ② 由此改写。问句形态取每个 lens 的消费者可见后果；下表是全部 19 组 (review kind, lens)。这些问句登记在注册表的**第二张表**（§6.1 的 lens 问句表），行形态 `{ id, reviewKind, lens, question }`——不带 `tier`、不带举证义务、不带反例句，因此**不参与** `SEVERITY_RUBRIC` 的装配：问句本身不判档，档位由回答它的评审者按 §1 的阶梯定。逐格登记，不得缺格：

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

`wave` 与 `branch` 行的问句逐字相同（两者的受审对象不同、判据同源）；lens 问句表按 kind × lens 逐格登记，共同句以同一 `id` 的两次引用表达，不复制正文——因此该表物理行 15 条、覆盖 19 格。两张表不得合并：判据表承载 `tier` / `duty` / `counterExample`，问句表三者皆无，合并只能靠空值或伪造档位。

#### 3.2 删除两处 judgment 逃逸口

wave 与 branch 的 axes guide 里两处 `(severity by your judgment)` 删除；`scope` 轴的判定改由 `scope` lens 的问句承担（wave / branch 的 `lensEnum` 现缺 `scope`，本相位补齐，使 axes guide 的轴与枚举一一对应）。删除后不留判档空白：每类 review 的 axes guide 末尾接一段由 `LENS_QUESTIONS` 装配的编号问句清单（§6.1 的投影面），原逃逸口那句「档位由你判断」的职责改由 `scope` 那一格的问句承担，问句随 prompt 字节下发。

### 4. wave review 的契约可见性

#### 4.1 注入 `INPUT_SPEC` + `INPUT_OVERALL`

wave review 的 round context 必须携带 `INPUT_SPEC`（本计划同 slug 的身份文档）与 `INPUT_OVERALL`（其 `program:` 指向的母宪章），与 branch 同路。今天的归因要写准：`face/cli.ts` 的场景装配只为 `plan` / `branch` 设 `specLink`，而 `overallLink` 也对三个 doc 目标（`phase-spec` / `overall` / `single-spec`）由被审文档的 `program:` 设；wave 是唯一两格都为空的面——这是「代码评审读不到相位契约」的构造性盲区。

两格按身份文档的形状配对，不强行成对：身份文档解析到且 `program:` 可解析 ⇒ 两行同时出现（路径为仓根相对、可读）；身份文档解析到但没有 `program:`（身份文档是 single-spec——single-spec 按设计无母宪章）⇒ 只有 `INPUT_SPEC`，`INPUT_OVERALL` 合法缺席；身份文档缺席或读面为 `invalid` 时（无 `slug:` 链接、同 slug 多份、文档不可读）⇒ 两行都不出现；`program:` 指不到母宪章 ⇒ 只丢 `INPUT_OVERALL`。丢弃指该行**不出现在** round context 里，不是出现一个空值。因此「任一环缺席 ⇒ 两 token 均不出现」不能当反向 pin：它会把 single-spec 相位的 spec 锚一并剥掉，正是 D93 ⑤ 要关的盲区。wave 评审照常派发，不因此拒绝：引擎只拒它能判的形态（P36 的 `misplaced` 纪律），链路缺口由既有 `doc-contract` 面报，不在本相位新增第二个报告者。

#### 4.2 取源与 branch 同路

路径取 `SlugIndex` 的身份文档与其 `program:`，**不做任何文件名推演**（P36 已删尽派生）。

### 5. 跨轮改档落账

#### 5.1 判据：跨轮同一性 + 场景同一性

`impact.scenario` 落进 `session/ledger.ts` 的轮次 finding 投影。跨轮同一性的匹配按序判定：

1. **定位上一轮对应行**：「上一轮」指**同一行上更早的、其 findings 投影非空的那条记录**——`Ledger#recordsOf` 给出整行的 implement / review / fix 记录，而 implement 记录与「对 fix 记录取源 review」的 `Ledger#roundOf` 都可能给出空集；按「紧接着的上一条记录」读会把 review 与一条空 findings 的 implement 对比、零行匹配，降档于是静默通过，正是 D93 ④「降档买一轮」的漏洞。匹配先取 `summary` 原文相同的那一行（`summary` 是缺陷描述本身，跨轮改写比换位少见）；多行同文时再以 carrier `id` 收窄。`id` 不能作首键：`FINDING` 的 `id` 在 materialize 时按 carrier 行序写入（`F1`、`F2` …，`session/handoff-schema.ts` 该字段的注释即此），它是那一轮的行号而不是缺陷的身份——上一轮新增或删除一条 finding，后续行号整体错位，首键会把两个不相干的缺陷配成一对：对从未判过的缺陷误索 `regrade`，而真实的降档因配对失败静默通过。
2. **档位未降低**（本轮 ≥ 上一轮）⇒ 不判，不要求 `regrade`、不标记。
3. **档位降低且上一轮那一行的 `impact.scenario` 非空** ⇒ 本轮必须携带 `regrade: string`（改档理由）；缺理由 ⇒ 胶囊与板面各出现一条可见标记。本轮省略或改写 `scenario` 都**不注销**这条义务——降档方唯一能掌控的就是新行自己的字节，若靠省略或改写场景就能逃开，D93 点名的「blocker 降成 warn 收线」就会在可见面上静默。
4. **档位降低但上一轮那一行的 `scenario` 为空** ⇒ 没有参照场景，按缺陷已变处理，不要求 `regrade`、不标记。

标记是**显示面**，不是判据：它不写入 `findings[]`、不生成合成 finding、不进 `rollup`，因此单独一条降档不会把本轮推成 `REVIEW_FIX`，也不动 D70 收敛判据（Constraints 冻结）。

#### 5.2 落点

落点两处，都挂在既有渲染面上（措辞取自注册表，不另写一句）。这是 ③ 的「同类降档须写理由」与 ⑤ 的「降档落账」合并后的**唯一**执行面。

- **板面**——`face/board-view.ts` 的每 verb token（`BoardView#summaryToken` 渲的 `{verb} {body} {mark}+N`）在 `+N` 之后接降档标记，仍是同一个 token：不新增行、不新增条目。板面今天没有 per-finding 行（`LineCarriers` 只供 `+N` 计数），因此本相位给它补一个 per-record 的 findings 读面 `findingsOf(record): readonly RoundFinding[]`——同一条 digest 校验过的 carrier 读，投影直接用 `HandoffSchema.findingsOf`（§2.1 的同一个投影，丢弃规则不变）；`countOf` 的语义不动（仍数 carrier `findings` 数组的长度），两个读面同源不同格。`BoardView#summaryToken` 由 `findingsOf` 判「本轮是否有非空 `regrade`」，因此板面标记不新开第二个读面、也不第二次解析 carrier 字节。
- **胶囊**——`face/capsule.ts` 的 `summary` 槽：`Capsule#emit` 早已把调用方给的一行渲在 status 行与 `next:` 之间，今天只由 fix 轮的 `dispositionsSummary` 填。降档标记走同一槽，`emit` 的签名与键集都不动；但它**确实会让评审轮的 stdout 多一行**（今天评审轮只有 `status · handoff`，加上可选的 `next:` 与 `reason:`）。这一行是显式声明的新字节，带自己的成对 pin：无降档 ⇒ 该行不出现，评审轮 stdout 与今天逐字节相同；有一条降档 ⇒ 恰好多这一行。

因此「不新增行」不能作概括：准确的说法是**不新增 finding 行、不新增 carrier 条目、不改本轮结论**，胶囊那一行是设计里唯一新增的可见字节。

### 6. 生成式判据注册表

#### 6.1 两张表的行形态

新增 `contract/review-criteria.ts`，它承载两张形状不同、互不混行的表：

- **判据表**——每行 `{ id, tier, body, duty, counterExample, face }`，`tier` ∈ blocker / warn / nit，`face` ∈ gate / test / numbered。`SEVERITY_RUBRIC` 由行按声明序装配（正文即行，散文不再是判据的第二份副本），因此判据表是唯一进 rubric **档位散文**的语料；标定尾段（同档一致义务、`{artifact}` / `{audience}` 视觉句、设而不用清单、收尾致谢）不在档位片段内，仍由 `reviewGuideOf` 的共享尾段承接。装配公式一格一段、三格恒序：`body` → `duty` → `counterExample`，单句之间以空格相连得到该行的 rubric 片段；同一 `tier` 的片段相邻成段（多行时按声明序），各段按 blocker → warn → nit 排成档位主体。三格都进字节，没有只作元数据的格子——`duty` 与 `counterExample` 若不渲染，举证义务与反例句就退回了长句。`CRITERIA.of(id)` 查不到即抛——仿 `contract/completion-criterion.ts` 的「未登记即抛」形态。
- **lens 问句表**——每行 `{ id, reviewKind, lens, question, face }`（§3.1 的 19 格），`face` 恒为 `numbered`：问句的唯一执行面是渲染出的评审 prompt。它没有 `tier`：问句不判档；没有 `duty` 与 `counterExample`：举证与反例句属于档位而不属于 lens。按 (review kind, lens) 逐格 19 条，`wave` 与 `branch` 的四格共享同一 `id` 双引用，故物理行 15 条。该表**不参与** `SEVERITY_RUBRIC` 装配，`LENS_QUESTIONS.of(reviewKind, lens)` 查不到即抛（同一「未登记即抛」形态）。

装配的校验契约两段，缺一不可（AC ① 的负向 pin 按这两段分开钉）：**行形态是类型**——每行是 `readonly` 字面行，`id` / `tier` / `body` / `duty` / `counterExample` / `face` 六格全必填，删掉某个键是 `tsc` 红（类型层，不是运行时抛）；**格子内容是装配期校验**——装配时任一必填格为空白字符串（`trim()` 后为空）即抛，某一 `tier` 无任何行也即抛。因此「删了一条反例句」有两种形态、两种红法：删键 ⇒ 类型层拦，置空串 ⇒ 装配期拦；二者都不会渲染出一个少一句的档位片段。装配只对声明表的行做这两条运行期校验，不对散文做内容匹配。

问句的投影面只有一处：`render/templates.ts` 每类 review 的 `axesGuide` 由该类问句装配——`LENS_QUESTIONS.forReviewKind(reviewKind)` 按声明序取行，渲染成从 1 起的编号清单（`1. <question>` 逐行），追加到该类 `axesGuide` 末尾；`reviewRow(type)` 把整段 `axesGuide` 原样折进 `**Criteria — <type>:**` 那一行，问句因此随 prompt 字节下发。五类 review 各装配自己的一段：`wave` / `branch` 行正文相同、`reviewKind` 不同，各 4 条；`plan` / `spec` 各 3 条；`overall` 5 条。表里有行不等于 prompt 里有问句，因此核对落在渲染产物上（§6.2 的 `numbered` 面），不是落在表的行数上。

两表不得合并：问句塞进判据表只能带一个不存在的 `tier` 或用空 `duty` / `counterExample` 污染 rubric 散文；判据行塞进问句表则丢掉举证义务与反例句。计数按表各计一次，由 §6.2 的同一条结构测试核对。

#### 6.2 边界

三种 `face` 各自的执行面如下，且每个非 `numbered` 的值至少有一行占位——否则把每行都标 `numbered` 就能全绿，`face` 只是一列装饰：

- `gate`：该行的 `id` 必须出现在它那条机械门的报文里。至少一行——blocker 的举证义务行出现在 `CDD_BLOCKED: grading-impact-missing` 的报文里（§2.2，报文首词固定、行 `id` 随后）。
- `test`：该行必须被一条测试的格题命名。至少一行——pin 可解析性的那条判据行（§7.4）由 `contract/__tests__/pins.test.ts` 的一条格题命名。
- `numbered`：该行出现在渲染产物里。至少一行（三档行本身）。

lens 问句表的行同为 `numbered`，其渲染产物是该 `reviewKind` 的评审 prompt：每一行问句必须逐字出现在对应 review 的 `**Criteria —` 行里，缺一条即红。以上由一条结构测试核对，同一测试面另计 lens 问句表的 15 行 / 19 格，以及三个 `face` 值各至少一行（§7 的同一测试面）。

### 7. pin 可解析性门（P28 反转的窄形态）

#### 7.1 三形态判定与「什么是 pin」

`contract/pins.ts` 暴露 `PinAudit`，扫描 `docs/kairos/**/*.md` 与仓库 README 家族（`README.md` · `README.zh-CN.md` · `packages/*/README*.md`）的三类 pin：

- `path.ext:line[-line]` —— 路径按后缀唯一解析，行号 ≤ 文件行数；**不比对内容**（内容匹配不可能机械）。
- 裸符号（如 `#artifactCellOf`、`SymbolName`）—— 在 `packages/cdd-engine/src-next`、`packages/kairos`、`scripts` 的符号索引中可解析。索引按运行缓存。
- 测试格题 + 文件名 —— 该 `.test.ts` 内存在这个字符串。

**pin 的定义是门的一部分**（否则扫描器会把词汇当主张）。一个反引号 token 只在下列条件同时成立时才是 pin，否则它是散文词汇，不受本门管辖：

1. **仓根相对**——`path` 不以 `./` / `../` 开头，也不以 `...` 省略号开头；相对简写与省略形是行文习惯，不是可核对的主张。
2. **不是产物词汇**——workspace 产物名（`progress.json` / `base.json` / `in-flight.json` / `liveness.json` / `tasks-<N>-<op>.json`）、后缀（`.rulings.json`）、模板（`X.md` / `-overall.md` / `-design.md`）都是词表条目，不是坐标。
3. **不是易逝物**——`.changeset/*.md` 按设计在发布时被消费删除，引用它们不是主张而是记录；同理不判。

#### 7.2 解析不到的处理

解析不到 ⇒ 该 pin 自身产一条 finding（lens `consistency`，档位 **warn**：失效 pin 不改变消费者拿到的结果，只让一处主张不可核）。判据只有一条，喂给它的语料有三份，执行面只有两处——今天的树没有第二个文档评审回读面：文档评审与交接单回读同属 `face/lifecycle.ts` 的 `#reconstruct` / `#materialize`。

- **引擎套件的结构测试**——§7.1 三形态加 pin 定义，入口 `PinAudit`，语料 = `docs/kairos/**/*.md` 与 README 家族，**全语料必须零 finding**（无基线、无白名单、无豁免：门的范围是一句定义，不是一份数据）。
- **`face/lifecycle.ts` 的回读面**——同一个 `PinAudit` 判据，喂两份语料，每份有自己的读点：
  - **被审文档自身的 markdown**——文档评审轮（`TARGET_TYPE` 为 doc 三型）在 `#reconstruct` 里对**本轮被审文档的正文**跑一次 markdown 扫描：该文档是 `SlugIndex` 解析到、本轮回读的那份身份文档（`INPUT_SPEC` / `INPUT_OVERALL` 是它的引用，不是语料）；解析不到的 pin 折算成该轮的一条 warn 级 finding（lens `consistency`）注入 `findings[]`，`summary` 指出失效的 pin。判据、语料、注入点这三处都要点名：既不是「文档评审的语言」这种可指被审文档、也可指本轮散文的说法，也不是「另一次文档评审」这种今天不存在的面。
  - **交接单 finding 行上的 `contract.path`**——路径解析不到 ⇒ 追加一条 warn 级 finding，lens `consistency`，`summary` 指出失效的 `path`。`PinAudit` 的 markdown 扫描永不承接这一格。

两个执行面共用一条判据、各自判自己的语料，不得合并成一处。`contract.path` 那一份的后果要说准：它**不 BLOCK** 该轮（不出 `CDD_BLOCKED`），但它是真实的 warn 级 finding，按既有语义进 `findings[]` 并被 `rollup` 读到——本来零 finding 的评审轮因此落到 `REVIEW_FIX`，不会停在 `APPROVED`。这不是新机制：`rollup` 对 warn 的处理今天就是这样。被审文档那一份同理：它是真实的 warn 级 finding、也进 `findings[]`，因此一份带死 pin 的被审文档在文档评审轮落到 `REVIEW_FIX`，而不是停在今天的 `APPROVED`——这是本相位对文档审阅面唯一的可见后果，AC ⑥ 为它配了成对 pin。反方向的做法（把它做成只显示、不进 `findings[]` 的行）等于在 §5.1 的显示面之外再立一类不受 `rollup` 管的 finding，本相位不立。

#### 7.3 存量迁移（门上线的前置，一次性）

全语料今天不干净，因此门上线前完成一次**一次性迁移**，此后不得再产生豁免机制。迁移规模不在此预登记——上一版预登记的语料计数已撤回：它们无法从公开基准复现（按「`docs/kairos/**/*.md` 与 README 家族里的反引号 token」数会得到另一组值），写成事实只会给下游一个不可验的工作量。改以一条可判的条件：**`PinAudit` 第一次全语料运行的 finding 集就是待改清单**，迁移完成的判据是同一扫描的零 finding。

- **过期引用删除**——目标已按设计消失、因此今天解析不到的引用（已整目录移除的 `docs/maintainers/*` · P5 已退役的 `scripts/*`）改为不指路径的表述，保留「当时做了什么」而不留死号。
- **迁移路径修正**——`docs/kairos/specs/<slug>-overall.md` 等已按 P17 改名/搬迁的路径改为现行路径。
- **行号越界修正**——行号超过文件行数的 pin 改为路径 + 符号（本相位起的书写纪律），不再钉行号。

已按设计被消费的 `.changeset/*` 引用**不是迁移对象**：§7.1 的第 3 条排除已把它们定义成记录而非主张，它们产生不了 finding，删它们买不到门上的任何一条红。

这是对 **D22**（P6 裁定 Q5→a：「`docs/kairos/{specs,plans}` frozen 历史面零动」）的**显式反转**，理由写在明面上：D22 防的是**追溯重写**——按今天的口味改写历史结论、裁定与交付记录；本条只改坐标与引用句（目标已消失的引用、已搬迁的路径、已越界的行号），零结论改动、零裁定改动、零交付记录改动，因此不落在 D22 所防的面内。反转已回填母宪章（Phase inventory P37 的 Scope 与 D93 ⑧），实现前该回填已到位。

迁移只改坐标与引用句，**不改任何结论、裁定或交付记录**；迁移后全语料零 finding 即为门的上线条件。

#### 7.4 边界（显式反转）

不做 docs 全量校验——只判 pin 的每一段可解析，不判文档结构、不判语义。P28 当年撤门的理由是「docs 全量校验过重、合法性交 dispatch 门自判」，而 dispatch 门只判文档结构、不判 pin 坐标形态；本条把门装回窄形态，理由与边界记入**判据表里那条 pin 可解析性判据行**（warn 档）的 `counterExample`——该行按 §6.2 由 `contract/__tests__/pins.test.ts` 的一条格题命名，`test` 执行面因此有行占位。

### Acceptance criteria

- `判据行是判据的单位：每行 `body` / `duty` / `counterExample` 三格全必填，`tier` 三值各至少一行——三档的边界定义 / 举证义务 / 反例句因此各有一条，`warn` 档另有 pin 可解析性那一行（§7.4）；装配公式固定为 `body` → `duty` → `counterExample`，三格全进字节，**每一行**的 `duty` 句与 `counterExample` 句逐字出现在 `SEVERITY_RUBRIC` 的渲染产物里（成对 pin：完整判据表装配成功且每行三句都在字节里 / 把某行的 `counterExample` 置空串 ⇒ 装配即抛、该行片段不出现；从行里删掉该键 ⇒ `tsc` 红——两段校验契约见 §6.1）；判据表按 `tier` 覆盖 blocker / warn / nit 各至少一行，缺行 ⇒ 装配失败；`face` 三值各至少一行并各自接上执行面——`gate` 行的 `id` 出现在 §2.2 的 `CDD_BLOCKED: grading-impact-missing` 报文里、`test` 行的 `id` 被一条测试格题命名、`numbered` 行出现在渲染产物里；全标 `numbered` 而门 / 格题缺席 ⇒ 红（成对 pin：完整判据表装配成功 / 删一行装配即抛）`
- `impact 场景成对 pin：blocker 缺 `impact.scenario` ⇒ `CDD_BLOCKED: grading-impact-missing` 由交接单回读面打出（与其它 schema 拒绝同一行、同一路径），报文首词固定、随后是 blocker 举证判据行的 `id`，并列出违规 finding 的 `id`；补上场景 ⇒ 通过；warn / nit 无场景 ⇒ 通过；拒绝面只有这一处（`rollup` 返回仍是 `RoundStatus`，`--dry-run` 不声称读该谓词）`
- `wave / branch 的 axes guide 零 `(severity by your judgment)`；lens 问句表（行形态 `{ id, reviewKind, lens, question, face }`，`face` 恒为 `numbered`）按 (review kind, lens) 覆盖 19 格、物理行 15 条（`wave` / `branch` 四格共享 `id` 双引用），与判据表分开计数（判据表各 `tier` 至少一行）；投影 pin：五类 review 渲染出的 `**Criteria —` 行逐字带上该类自己的编号问句（`wave` / `branch` 各 4 条、`plan` / `spec` 各 3 条、`overall` 5 条，`wave` 与 `branch` 字节同源），删掉表里任一问句行 ⇒ 该类 prompt 少一条编号问句；把问句塞进判据表或把判据行塞进问句表 ⇒ 查表即抛`
- `wave review 的 round context 的 `INPUT_SPEC` / `INPUT_OVERALL` 按身份文档形状配对 pin：身份文档与它的 `program:` 母宪章都解析到 ⇒ 两 token 均出现且路径为仓根相对、可读；身份文档解析到但无 `program:`（single-spec）⇒ 只出 `INPUT_SPEC`，`INPUT_OVERALL` 合法缺席（负向 pin：不得因此连 spec 锚一起剥）；身份文档缺席或 `invalid` ⇒ 两 token 均不出现；`program:` 指不到母宪章 ⇒ 只丢 `INPUT_OVERALL`；branch 的 prompt 字节不变`
- `降档且上一轮同一行（「上一轮」= 同一行上更早的、findings 投影非空的那条记录；匹配键为 `summary` 原文相同，多行同文时以 `id` 收窄）的 `impact.scenario` 非空：无 `regrade` ⇒ 板面该 verb token 与胶囊的 `summary` 行各一条可见标记（胶囊侧成对 pin：无降档的评审轮 stdout 与今天逐字节相同，有降档恰好多这一行），且该标记不进 `findings[]`（负向 pin：一条这样的降档既不新增 finding，也不单独把本轮推成 `REVIEW_FIX`）；本轮省略或改写 `scenario` 不注销该义务（正向 pin：省掉场景文本仍出标记）；有 `regrade` ⇒ 两处各出现一次理由；上一轮该行 `scenario` 为空 ⇒ 不要求、不标记；参照对象 pin：一条 review 的降档与它之前**最近一条 findings 非空的 review** 配对——中间夹一条 findings 为空的 implement 记录时仍出标记（按「紧接着的上一条记录」读则零行匹配、标记消失）`
- `pin 门可红可修，两个执行面各 pin 自己的语料：注入一条指向不存在符号的 markdown pin ⇒ `PinAudit` 红并指出该 pin；**全语料零 finding**（无基线 / 无白名单 / 无豁免）为门的上线条件，由 §7.3 的一次性迁移达成（过期引用删除、迁移路径修正、行号越界修正）——迁移前后语料 finding 数从非零变零（成对 pin）；一条 finding 的 `contract.path` 解析不到 ⇒ 同一回读面追加一条 warn 级 finding，该轮不 BLOCK（无 `CDD_BLOCKED`），并按 warn 的既有语义进 `rollup`（成对 pin：本来零 finding 的评审轮 → `REVIEW_FIX`，不会停在 `APPROVED`）；被审文档语料（§7.2 回读面的第二份）单独成对 pin：干净的被审文档 ⇒ 零注入 finding、结论不变（`APPROVED` 仍 `APPROVED`），文档里一条解析不到的 pin ⇒ 该轮恰好多一条 warn 级 finding、零 blocker，结论落到 `REVIEW_FIX`（反向 pin：把这条注入面当成只显示而不进 `findings[]` ⇒ 红）；已消费的 `.changeset/*` 引用按 §7.1 第 3 条排除，既不产 finding 也不在迁移清单里；pin 定义的三条排除（非仓根相对 / 产物词汇 / 易逝 changeset）各有成对 pin：排除形不产 finding、真死引用产 finding`
- `validate 全绿（`pnpm run validate` exit 0）；changeset `cdd-engine` **minor**、kairos 无`

## Constraints

- 跟随仓内既有范式：注册表 + 「查不到即抛」（`contract/completion-criterion.ts`）；`src-next` 零裸函数、参数 ≤4、类 ≤200 行、接口先行、协作者构造注入。类 ≤200 行的上限**只约束本相位新建的类**；本相位要动的四个既有文件均超此限（`session/ledger.ts` 2057 行 · `face/lifecycle.ts` 1857 行 · `face/board-view.ts` 1523 行 · `session/handoff-schema.ts` 470 行），按 rule zero 免于该上限，每处改动写一行理由，拆分归 P39（D95 ②）。
- pin 写法：**路径 + 符号**，不用行号。本 spec 自身遵守此纪律。
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
