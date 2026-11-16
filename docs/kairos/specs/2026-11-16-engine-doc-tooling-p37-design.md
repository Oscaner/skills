---
title: 分级判据的可核化（Grading Boundary）
doc-type: phase-spec
version: v0.2
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

- `scenario: string` —— 输入 / 条件 → 实际 → 预期。
- `kind?: "crash" | "wrong-output" | "silent-miss" | "security" | "evidence"` —— 影响类别，供胶囊与板面聚合。
- `test?: string` —— 可选加强：一条能红的测试 pin（格题或路径）。

同一处声明新增可选 `regrade: string` —— 跨轮改档的理由（§5）。它同样在 schema 层可选：只有「本轮档位低于上一轮且场景文本相同」时才由 `rollup` 要求。

`impact` 在 schema 层可选（warn / nit 不需要它），**blocker 的必填性由 `rollup` 判**——schema 层强制会连带 BLOCK 掉合法的 warn / nit finding。

#### 2.2 `rollup` 的判据

`session/handoff-schema.ts` 的 `rollup` 只多判一件事：`severity === "blocker"` 的每一条，`impact.scenario` 必须是非空字符串。不满足 ⇒ 该轮不产生结论，按既有失败面报 `CDD_BLOCKED: grading-impact-missing`，报文列出违规 finding 的 `id` 与 `summary`（多条目全列，不二选一）。`--dry-run` 同源。

#### 2.3 `contract` 降为可选修复锚点

`FINDING` 声明新增可选 `contract: { path: string; anchor: string }`——`path` 为契约文档或门的模块路径，`anchor` 为节号 / AC 编号 / 规则 id。它**不参与 `rollup`**，语义是「这条 finding 的修复落在哪」，供 fix 轮定位。`contract.path` 是一个 pin，因此受 §7 的可解析性门约束（解析不到产一条 warn 级 finding，不阻断）。

### 3. lens → 影响判定问句（替代硬映射）

#### 3.1 规则

每类 lens 在注册表里声明**一句影响判定问句**——「这个 lens 下，什么算跨进功能影响」，而不是「这个 lens 一律落哪一档」。硬映射与按影响判档互斥，注册原文的 ② 由此改写。问句形态取每个 lens 的消费者可见后果；下表是全部 19 组 (review kind, lens)，注册表逐行登记，不得缺格：

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

`wave` 与 `branch` 行的问句逐字相同（两者的受审对象不同、判据同源）；注册表按 kind × lens 逐格登记，共同句以同一 `id` 的两次引用表达，不复制正文。

#### 3.2 删除两处 judgment 逃逸口

wave 与 branch 的 axes guide 里两处 `(severity by your judgment)` 删除；`scope` 轴的判定改由 `scope` lens 的问句承担（wave / branch 的 `lensEnum` 现缺 `scope`，本相位补齐，使 axes guide 的轴与枚举一一对应）。

### 4. wave review 的契约可见性

#### 4.1 注入 `INPUT_SPEC` + `INPUT_OVERALL`

wave review 的 round context 必须携带 `INPUT_SPEC`（本计划同 slug 的设计 spec）与 `INPUT_OVERALL`（其 `program:` 指向的母宪章），与 branch 对齐。今天 `face/cli.ts` 的场景装配只为 `plan` / `branch` 设 `specLink` / `overallLink`，wave 两格为空——这是「代码评审读不到相位契约」的构造性盲区。

身份文档缺席或读面为 `invalid` 时（无 `spec:` 链接、同 slug 多份、文档不可读），两格留空并由装配器丢弃该行——wave 评审照常派发，不因此拒绝：引擎只拒它能判的形态（P36 的 `misplaced` 纪律），链路缺口由既有 `doc-contract` 面报，不在本相位新增第二个报告者。

#### 4.2 取源与 branch 同路

路径取 `SlugIndex` 的身份文档与其 `program:`，**不做任何文件名推演**（P36 已删尽派生）。

### 5. 跨轮改档落账

#### 5.1 判据：场景文本同一性

`impact.scenario` 落进 `session/ledger.ts` 的轮次 finding 投影。当本轮某条 finding 的档位低于上一轮、且两轮的 `impact.scenario` **文本完全相同**时，该条 finding 必须携带 `regrade: string`（改档理由）；缺理由 ⇒ 胶囊与板面各出现一条可见标记。场景文本不同 ⇒ 视为缺陷已变，不标记。

#### 5.2 落点

`face/capsule.ts` 的轮次小计与 `face/board-view.ts` 的 finding 行各加一处可见标记（措辞取自注册表，不另写一句）。这是 ③ 的「同类降档须写理由」与 ⑤ 的「降档落账」合并后的**唯一**执行面。

### 6. 生成式判据注册表

#### 6.1 行形态

新增 `contract/review-criteria.ts`：每行 `{ id, tier, body, duty, counterExample, face }`，`tier` ∈ blocker / warn / nit，`face` ∈ gate / test / numbered。`SEVERITY_RUBRIC` 由行按声明序装配（正文即行，散文不再是判据的第二份副本）；`CRITERIA.of(id)` 查不到即抛——仿 `contract/completion-criterion.ts` 的「未登记即抛」形态。

#### 6.2 边界

`face` 为 `gate` 的行必须在报文里出现其 `id`；`test` 的行必须被一条测试的格题命名；`numbered` 的行必须出现在渲染产物中。三者由一条结构测试核对（§7 的同一测试面）。

### 7. pin 可解析性门（P28 反转的窄形态）

#### 7.1 三形态判定

`contract/pins.ts` 暴露 `PinAudit`，扫描 `docs/kairos/**/*.md` 与 `packages/*/README.md` 的三类 pin：

- `path.ext:line[-line]` —— 路径按后缀唯一解析，行号 ≤ 文件行数；**不比对内容**（内容匹配不可能机械）。
- 裸符号（如 `#artifactCellOf`、`SymbolName`）—— 在 `packages/cdd-engine/src-next`、`packages/kairos`、`scripts` 的符号索引中可解析。索引按运行缓存。
- 测试格题 + 文件名 —— 该 `.test.ts` 内存在这个字符串。

#### 7.2 解析不到的处理

解析不到 ⇒ 该 pin 自身产一条 finding（lens `consistency`，档位 **warn**：失效 pin 不改变消费者拿到的结果，只让一处主张不可核）。两个消费者：引擎套件的结构测试（在册语料必须零 finding）与文档评审的回读面（把同一份 finding 注入该轮）。

#### 7.3 边界（显式反转）

不做 docs 全量校验——只判 pin 的每一段可解析，不判文档结构、不判语义。P28 当年撤门的理由是「docs 全量校验过重、合法性交 dispatch 门自判」，而 dispatch 门只判文档结构、不判 pin 坐标形态；本条把门装回窄形态，理由与边界记入注册表行的 `counterExample`。

### Acceptance criteria

- `三档各有一条边界定义、一条举证义务句、一条反例句，全部来自注册表；注册表缺行 ⇒ 装配失败（成对 pin：完整注册表装配成功 / 删一行装配即抛）`
- `impact 场景成对 pin：blocker 缺 `impact.scenario` ⇒ `CDD_BLOCKED: grading-impact-missing` 且报文列出违规 `id`；补上场景 ⇒ 通过；warn / nit 无场景 ⇒ 通过`
- `wave / branch 的 axes guide 零 `(severity by your judgment)`；注册表中每个 (review kind, lens) 组合各有一句影响判定问句（枚举 pin，由注册表测试计数）`
- `wave review 的 round context 含 `INPUT_SPEC` 与 `INPUT_OVERALL`，且一条行为 pin：wave 评审的 prompt 中两 token 可读，branch 字节不变`
- `场景文本相同而降档且无 `regrade` ⇒ 胶囊与板面各一条可见标记；有 `regrade` ⇒ 两处各出现一次理由`
- `pin 门可红可修：注入一条指向不存在符号的 pin ⇒ 红并指出该 pin；在册语料 ⇒ 零 finding；`contract` 的 `path` 失效 ⇒ 该条 finding 为 warn`
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
