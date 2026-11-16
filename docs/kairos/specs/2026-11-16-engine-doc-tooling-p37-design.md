---
title: 分级判据的可核化（Grading Boundary）
doc-type: phase-spec
version: v0.6
date: 2026-11-16
slug: 2026-11-16-engine-doc-tooling-p37
program: 2026-10-10-engine-doc-tooling
author: "[human] · Claude Opus 5 (1M context)（kairos:cdd-design grilling 裁定 → 本会话作者）"
---

## Design

评审者判 blocker、引擎按 blocker 收敛，两者之间今天没有共同的判据：`render/templates.ts` 的 `SEVERITY_RUBRIC` 用 severity 词写判据（(a)–(d) 四条），审阅面却用 lens 词（`a pinless claim is a lens-tagged finding` · `a scope that descends to code is a scope finding`），唯一的映射指令是 wave / branch 的 axes guide 里两处 `(severity by your judgment)` ——语义上等于「降档不算错」。同时三档只有举例没有边界：warn 的「debt inside the contract」与 nit 的「style, naming and line-wrapping」之间没有可对照的分界线。

本相位把判档**收成一条可核的梯度**：判档本体是**功能影响**，三档是一个按序回答的阶梯；每档担一条可核举证与一条反例句；blocker 的举证落成结构化字段，由 `rollup` 成对校验。判据文本从**生成式注册表**装配，每行声明执行面，因此判据不可能只活在长句里。pin 另受可解析性门约束（窄形态，反转 P28 的「不设门」）。

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

#### 1.3 反例句（每档一条，入册）

- 违反了一句写着的话，但消费者拿到的字节不变 ⇒ **warn**，不是 blocker。这一句封住 (a) 的旧漏洞：引得到条款不等于功能受影响。
- 一段死码当前无人调用、也不影响任何输出 ⇒ **warn**，不是 nit：它改变后来者的判断。
- 一处命名不一致但同一文件内自洽 ⇒ **nit**，不是 warn：它不误导任何跨面读者。

#### 1.4 (a)–(d) 降为 blocker 档的实例（对原非目标的显式反转）

`SEVERITY_RUBRIC` 现有的四条 blocker 触发器不再是判据本身，而是 blocker 档的**典型实例**：声明的 AC / 契约 / prompt 被违反且消费者可见 · 合法输入逃出声明失败面 · 门失败或套件永不红 · 安全与隐私缺陷。反转理由：judged by (a) 的「条款被违反即 blocker」正是漏洞本体，保留它作触发器会让条款狩猎通过判档。

### 2. `impact` 字段与 `rollup` 的成对门

#### 2.1 字段形态

`session/handoff-schema.ts` 的 `FINDING` 声明新增可选 `impact`：

- `scenario: string` —— 输入 / 条件 → 实际 → 预期。这是唯一被 `rollup` 要求的槽。
- `test?: string` —— 可选加强：一条能红的测试 pin（格题或路径）。它的消费者是下一位评审者（能当场重跑），因此不需要聚合面承接。

同一处声明新增可选 `regrade: string` —— 跨轮改档的理由（§5）。它同样在 schema 层可选：只有 §5.1 的**稳定键 + 场景同一性**判据成立（降档，且上一轮同一稳定键的行带着非空场景）时才要求。

`impact` 在 schema 层可选（warn / nit 不需要它），**blocker 的必填性由 `rollup` 判**——schema 层强制会连带 BLOCK 掉合法的 warn / nit finding。

#### 2.2 `rollup` 的判据

`session/handoff-schema.ts` 的 `rollup` 只多判一件事：`severity === "blocker"` 的每一条，`impact.scenario` 必须是非空字符串。该判据写成与 `rollup` 同处（colocated）的纯助手 `HandoffSchema.gradingViolations(findings)`：交接单回读面调用它，`rollup` 本身**不承接**这次拒绝——返回类型不扩，它仍只回 `RoundStatus`，成对门不是第四种结论。

面由谁打印：失败面不动——`face/lifecycle.ts` 的交接单回读（`#reconstruct` → `#reject` → §3.3 那唯一一行 `CDD_BLOCKED`），与其它 schema 拒绝同一条路径，不新开第二个报错者、不在 `face/cli.ts` 另设一道门。这是唯一的拒绝面：`--dry-run` 在派发前预览、不进 `#reconstruct`，因此**不**声称读这个谓词，也不另设预览面。不满足 ⇒ 该轮不产生结论（不是产出一个值为 `BLOCKED` 的结论），报文为 `CDD_BLOCKED: grading-impact-missing` 并列出违规 finding 的 `id` 与 `summary`（多条目全列，不二选一）。

#### 2.3 `contract` 降为可选修复锚点

`FINDING` 声明新增可选 `contract: { path: string; anchor: string }`——`path` 为契约文档或门的模块路径，`anchor` 为节号 / AC 编号 / 规则 id。它**不参与 `rollup`**，语义是「这条 finding 的修复落在哪」，供 fix 轮定位。`contract.path` 是一个 pin，因此受 §7 的可解析性门约束（解析不到产一条 warn 级 finding，不阻断）。但它的执行面**不在** §7.1 的 markdown 语料扫描里：`contract` 只出现在 judge 交接单的 finding 行上，因此由 §7.2 的第三个消费者（交接单回读面）判，`PinAudit` 永远不承接这一格。

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

wave review 的 round context 必须携带 `INPUT_SPEC`（本计划同 slug 的设计 spec）与 `INPUT_OVERALL`（其 `program:` 指向的母宪章），与 branch 对齐。今天 `face/cli.ts` 的场景装配只为 `plan` / `branch` 设 `specLink` / `overallLink`，wave 两格为空——这是「代码评审读不到相位契约」的构造性盲区。

身份文档缺席或读面为 `invalid` 时（无 `spec:` 链接、同 slug 多份、文档不可读），或 `program:` 指不到母宪章时，两行由装配器成对丢弃——丢弃指该行**不出现在** round context 里，不是出现一个空值。wave 评审照常派发，不因此拒绝：引擎只拒它能判的形态（P36 的 `misplaced` 纪律），链路缺口由既有 `doc-contract` 面报，不在本相位新增第二个报告者。两格因此只有两种形态：同时出现且路径为仓根相对、可读；或同时不出现。

#### 4.2 取源与 branch 同路

路径取 `SlugIndex` 的身份文档与其 `program:`，**不做任何文件名推演**（P36 已删尽派生）。

### 5. 跨轮改档落账

#### 5.1 判据：稳定键 + 场景同一性

`impact.scenario` 落进 `session/ledger.ts` 的轮次 finding 投影。跨轮同一性的匹配按序判定：

1. **定位上一轮对应行**：先取 carrier 出口的 finding `id` 相同者；取不到则退到 `summary` 原文相同的那一行。
2. **档位未降低**（本轮 ≥ 上一轮）⇒ 不判，不要求 `regrade`、不标记。
3. **档位降低且上一轮那一行的 `impact.scenario` 非空** ⇒ 本轮必须携带 `regrade: string`（改档理由）；缺理由 ⇒ 胶囊与板面各出现一条可见标记。本轮省略或改写 `scenario` 都**不注销**这条义务——降档方唯一能掌控的就是新行自己的字节，若靠省略或改写场景就能逃开，D93 点名的「blocker 降成 warn 收线」就会在可见面上静默。
4. **档位降低但上一轮那一行的 `scenario` 为空** ⇒ 没有参照场景，按缺陷已变处理，不要求 `regrade`、不标记。

标记是**显示面**，不是判据：它不写入 `findings[]`、不生成合成 finding、不进 `rollup`，因此单独一条降档不会把本轮推成 `REVIEW_FIX`，也不动 D70 收敛判据（Constraints 冻结）。

#### 5.2 落点

`face/capsule.ts` 的轮次小计与 `face/board-view.ts` 的 finding 行各加一处可见标记（措辞取自注册表，不另写一句）。这是 ③ 的「同类降档须写理由」与 ⑤ 的「降档落账」合并后的**唯一**执行面。两处标记只显影已有 finding 行上的那个字段：不新增行、不新增条目、不改本轮结论。

### 6. 生成式判据注册表

#### 6.1 两张表的行形态

新增 `contract/review-criteria.ts`，它承载两张形状不同、互不混行的表：

- **判据表**——每行 `{ id, tier, body, duty, counterExample, face }`，`tier` ∈ blocker / warn / nit，`face` ∈ gate / test / numbered。`SEVERITY_RUBRIC` 由行按声明序装配（正文即行，散文不再是判据的第二份副本），因此判据表是唯一进 rubric **档位散文**的语料；标定尾段（同档一致义务、`{artifact}` / `{audience}` 视觉句、设而不用清单、收尾致谢）不在档位片段内，仍由 `reviewGuideOf` 的共享尾段承接。装配公式一格一段、三格恒序：`body` → `duty` → `counterExample`，单句之间以空格相连得到该行的 rubric 片段；同一 `tier` 的片段相邻成段（多行时按声明序），各段按 blocker → warn → nit 排成档位主体。三格都进字节，没有只作元数据的格子——`duty` 与 `counterExample` 若不渲染，举证义务与反例句就退回了长句。`CRITERIA.of(id)` 查不到即抛——仿 `contract/completion-criterion.ts` 的「未登记即抛」形态。
- **lens 问句表**——每行 `{ id, reviewKind, lens, question, face }`（§3.1 的 19 格），`face` 恒为 `numbered`：问句的唯一执行面是渲染出的评审 prompt。它没有 `tier`：问句不判档；没有 `duty` 与 `counterExample`：举证与反例句属于档位而不属于 lens。按 (review kind, lens) 逐格 19 条，`wave` 与 `branch` 的四格共享同一 `id` 双引用，故物理行 15 条。该表**不参与** `SEVERITY_RUBRIC` 装配，`LENS_QUESTIONS.of(reviewKind, lens)` 查不到即抛（同一「未登记即抛」形态）。

问句的投影面只有一处：`render/templates.ts` 每类 review 的 `axesGuide` 由该类问句装配——`LENS_QUESTIONS.forReviewKind(reviewKind)` 按声明序取行，渲染成从 1 起的编号清单（`1. <question>` 逐行），追加到该类 `axesGuide` 末尾；`reviewRow(type)` 把整段 `axesGuide` 原样折进 `**Criteria — <type>:**` 那一行，问句因此随 prompt 字节下发。五类 review 各装配自己的一段：`wave` / `branch` 行正文相同、`reviewKind` 不同，各 4 条；`plan` / `spec` 各 3 条；`overall` 5 条。表里有行不等于 prompt 里有问句，因此核对落在渲染产物上（§6.2 的 `numbered` 面），不是落在表的行数上。

两表不得合并：问句塞进判据表只能带一个不存在的 `tier` 或用空 `duty` / `counterExample` 污染 rubric 散文；判据行塞进问句表则丢掉举证义务与反例句。计数按表各计一次，由 §6.2 的同一条结构测试核对。

#### 6.2 边界

判据表里 `face` 为 `gate` 的行必须在报文里出现其 `id`；`test` 的行必须被一条测试的格题命名；`numbered` 的行必须出现在渲染产物中。lens 问句表的行同为 `numbered`，其渲染产物是该 `reviewKind` 的评审 prompt：每一行问句必须逐字出现在对应 review 的 `**Criteria —` 行里，缺一条即红。以上由一条结构测试核对，同一测试面另计 lens 问句表的 15 行 / 19 格（§7 的同一测试面）。

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

解析不到 ⇒ 该 pin 自身产一条 finding（lens `consistency`，档位 **warn**：失效 pin 不改变消费者拿到的结果，只让一处主张不可核）。判据只有一条，消费者有三个，各自把自己的语料喂给它：

- 引擎套件的结构测试——§7.1 三形态加 pin 定义，入口 `PinAudit`，**全语料必须零 finding**（无基线、无白名单、无豁免：门的范围是一句定义，不是一份数据）。
- 文档评审的回读面——同一语料面，把同一份 finding 注入该轮。
- 交接单回读面（`face/lifecycle.ts` 的 read-back / materialize）——只判 finding 行上的 `contract.path`：路径解析不到 ⇒ 追加一条 warn 级 finding（lens `consistency`，`summary` 指出失效的 `path`），不阻断该轮、不升档、不改它的结论。`PinAudit` 只扫 markdown 语料，永不承接这一格：三个消费者各判自己的语料，不得合并成一处。

#### 7.3 存量迁移（门上线的前置，一次性）

全语料今天不干净，因此门上线前完成一次**一次性迁移**，此后不得再产生豁免机制：

- **过期引用删除**——目标已按设计消失的引用（已消费 `.changeset/*` · 已整目录移除的 `docs/maintainers/*` · P5 已退役的 `scripts/*`）改为不指路径的表述，保留「当时做了什么」而不留死号。
- **迁移路径修正**——`docs/kairos/specs/<slug>-overall.md` 等已按 P17 改名/搬迁的路径改为现行路径。
- **行号越界修正**——行号超过文件行数的 pin 改为路径 + 符号（本相位起的书写纪律），不再钉行号。

迁移只改坐标与引用句，**不改任何结论、裁定或交付记录**；迁移后全语料零 finding 即为门的上线条件。

#### 7.4 边界（显式反转）

不做 docs 全量校验——只判 pin 的每一段可解析，不判文档结构、不判语义。P28 当年撤门的理由是「docs 全量校验过重、合法性交 dispatch 门自判」，而 dispatch 门只判文档结构、不判 pin 坐标形态；本条把门装回窄形态，理由与边界记入注册表行的 `counterExample`。

### Acceptance criteria

- `三档各有一条边界定义、一条举证义务句、一条反例句，全部来自判据表（行形态含 `tier` / `duty` / `counterExample`）；装配公式固定为 `body` → `duty` → `counterExample`，三格全进字节——每个 `tier` 的 `duty` 句与 `counterExample` 句逐字出现在 `SEVERITY_RUBRIC` 的渲染产物里（负向 pin：删掉某档的 `counterExample` ⇒ 该句从渲染字节消失且装配即抛）；判据表按 `tier` 覆盖 blocker / warn / nit 各至少一行，缺行 ⇒ 装配失败（成对 pin：完整判据表装配成功 / 删一行装配即抛）`
- `impact 场景成对 pin：blocker 缺 `impact.scenario` ⇒ `CDD_BLOCKED: grading-impact-missing` 由交接单回读面打出（与其它 schema 拒绝同一行、同一路径），报文列出违规 `id`；补上场景 ⇒ 通过；warn / nit 无场景 ⇒ 通过；拒绝面只有这一处（`rollup` 返回仍是 `RoundStatus`，`--dry-run` 不声称读该谓词）`
- `wave / branch 的 axes guide 零 `(severity by your judgment)`；lens 问句表（行形态 `{ id, reviewKind, lens, question, face }`，`face` 恒为 `numbered`）按 (review kind, lens) 覆盖 19 格、物理行 15 条（`wave` / `branch` 四格共享 `id` 双引用），与判据表分开计数（判据表各 `tier` 至少一行）；投影 pin：五类 review 渲染出的 `**Criteria —` 行逐字带上该类自己的编号问句（`wave` / `branch` 各 4 条、`plan` / `spec` 各 3 条、`overall` 5 条，`wave` 与 `branch` 字节同源），删掉表里任一问句行 ⇒ 该类 prompt 少一条编号问句；把问句塞进判据表或把判据行塞进问句表 ⇒ 查表即抛`
- `wave review 的 round context 的 `INPUT_SPEC` / `INPUT_OVERALL` 成对 pin：`SlugIndex` 解析到身份文档与它的 `program:` 母宪章 ⇒ 两 token 均出现且路径为仓根相对、可读；任一环缺席或 `invalid` ⇒ 两 token 均不出现（负向 pin）；branch 的 prompt 字节不变`
- `降档且上一轮同一稳定键（carrier `id`，缺失时 `summary` 原文）的行 `impact.scenario` 非空：无 `regrade` ⇒ 胶囊与板面各一条可见标记，且该标记不进 `findings[]`（负向 pin：一条这样的降档既不新增 finding，也不单独把本轮推成 `REVIEW_FIX`）；本轮省略或改写 `scenario` 不注销该义务（正向 pin：省掉场景文本仍出标记）；有 `regrade` ⇒ 两处各出现一次理由；上一轮该行 `scenario` 为空 ⇒ 不要求、不标记`
- `pin 门可红可修，两个语料面分开 pin：注入一条指向不存在符号的 markdown pin ⇒ `PinAudit` 红并指出该 pin；**全语料零 finding**（无基线 / 无白名单 / 无豁免）为门的上线条件，由 §7.3 的一次性迁移达成（过期引用删除、迁移路径修正、行号越界修正）——迁移前后语料 finding 数从非零变零（成对 pin）；一条 finding 的 `contract.path` 解析不到 ⇒ 交接单回读面追加一条 warn 级 finding 且该轮不被阻断；pin 定义的三条排除（非仓根相对 / 产物词汇 / 易逝 changeset）各有成对 pin：排除形不产 finding、真死引用产 finding`
- `validate 全绿（`pnpm run validate` exit 0）；changeset `cdd-engine` **minor**、kairos 无`

## Constraints

- 跟随仓内既有范式：注册表 + 「查不到即抛」（`contract/completion-criterion.ts`）；`src-next` 零裸函数、参数 ≤4、类 ≤200 行、接口先行、协作者构造注入。
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
| v0.6 | 2026-11-16 | 存量迁移裁定（用户：「过期档案删除，没过期档案修」）：§7.1 把**pin 的定义**写进门内（三条排除：非仓根相对的 `./` / `...` 省略形 · 产物词汇如 `progress.json` / `.rulings.json` / `X.md` · 按设计被消费的 `.changeset/*`），使 165 条行文词汇不再被误判为坐标；§7.2 语料面改为**全语料零 finding，无基线 / 无白名单 / 无豁免**（门的范围是一句定义，不是一份数据）；新增 §7.3 一次性存量迁移——过期引用删除（194 条：117 已消费 changeset · 32 已删 `docs/maintainers` · 45 已退役 `scripts/*`）· 迁移路径修正（7 条）· 行号越界修正（13 条改路径 + 符号），迁移只改坐标与引用句、不改任何结论；AC ⑥ 重写为成对 pin（迁移前后 finding 数非零→零 + 三条排除各一对） | Oscaner M. · Claude（kairos:cdd-plan 回填 · 2026-11-16） |
