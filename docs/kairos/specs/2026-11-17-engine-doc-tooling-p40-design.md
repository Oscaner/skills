---
title: 'P40 · 派发前拒绝的记账面：拒绝属树，不属轮'
doc-type: phase-spec
version: v0.2
date: 2026-11-18
slug: '2026-11-17-engine-doc-tooling-p40-design'
program: 2026-10-10-engine-doc-tooling
author: Oscaner M. · Claude
---

## Design

引擎在 child 存在之前拒绝一次派发时，落下的是**另一种事实的形状**：`ledger` 记一条 `grade: hard`、`cause: contract-violation` 的轮记录，`board` 因此念 `crashed: review 1·a1 contract-violation`，而 `waves[n].rounds` 里那一轮的号被永久占用——重派读作 `review 2·1`，即「第 1 轮跑过并死了」。诊断因此指向一个从未存在的孩子：读 `contract-violation` 的人会去找孩子的 stdout 与 handoff，真相是 `base.json` 缺失。

病根不是判据错，是**归属错**。引擎有两个拒绝通道，各记各的账：pre-flight 的 `DispatchAuthority` structure 腿（`tree-clean` · `in-flight` · `graph` · `plan-ledger` · `doc-contract`）拒绝后零记录、零轮号；派发体里的四道门（no-host · carrier · dispatch-input · artifact）拒绝后记账成 crash。而后者自带注释——它们停在这个 round 的 in-flight 记录被获取**之前**——它们是 pre-flight 性质的，只是被放在了派发体里，于是恰好落在了记账之后。

本相位把那四道门搬回它们本来的位置，于是「一次没跑的派发写了一条轮的账」这件事**不可表达**：没有代码路径能到达它，而不是靠「记得在记账之前返回」。拒绝这件事随后落在它自己的名下：**树**的事实（这棵树此刻没能通过门前判定），与「这棵树正在跑」的 in-flight 事实同级、互斥、同寿。

### 1. 归属：两个拒绝通道并成一个

#### 1.1 四门成为 structure 腿的第 6–9 行
- structure 腿的行集是一张闭集：`session/preflight.ts#PreFlightGateName` 今天给五行（`tree-clean` · `in-flight` · `graph` · `plan-ledger` · `doc-contract`），`session/dispatch-authority.ts#DispatchAuthority.structureRefusal` 把拒绝的 gate 原样重述为腿的 reason。四道门并入为它的第 6–9 行，行 id 即拒绝的站名——no-host · carrier · dispatch-input · artifact。行集因此由五扩到九，而**站名闭集就是这张行集**（3.2）：站名不是与行并存的第二套词汇。
- 判定顺序：四行排在 `doc-contract` 之后。输入面是否合格，需先有合格的文档；一条判据的门槛若低于它依赖的判据，它给出的绿是空的。
- 判定输入（值来源）：四行的判据今天读的是装配好的派发输入——`TemplateValues`（`INPUT_WAVE_BRIEF` 的路径值由 `session/round-naming.ts#RoundNaming` 的 `brief()` 命名，与 `--dry-run` 预览同一条推演）、`ArtifactCell`（fix 面的 `--reviews` 路径与 requesting carrier 取自本行已记录的上游轮）与将落的 `(cycle, attempt)`（同一命名面从 ledger 的下一轮参数渲染）。三者都是**只读推演**，不建工作区、不写 brief、不开本轮 carrier 名、不取 in-flight 记录。
- 判定点不后移（条件）：门必须在轮记录被写之前、也在 `--recover` 的接管判定之前给出结构腿的裁决（4.1）。把工作区创建或 brief 渲染提到门之前，会让一条被拒的派发留下工作区与 brief，并让接管判定先于拒绝读到一条陈旧的持有者——两条都是本相位要消除的形状。因此 `PreFlightContext` 多收这份输入，而不是门自己去读场景。
- 复用既有值类型与适配器，不新增：`DispatchRefusal`（`leg` 仍取 `structure`）与 `DispatchAuthority.structureRefusal`。`DispatchLeg` 的三值闭集不动——分腿的依据是**问题不同**（树是否就绪 / 上游面是否到达 / 这一行在哪），不是代码放在哪。
- 门判据本体不动：`dispatch-input` 的判据（`requiredOn` 与 `absent` 两维声明、`when` 臂、四态渲染）由 P38 交付且正确；本相位只改它被判定的位置与失败后的归属。

#### 1.2 拒绝在轮记录被写之前返回
- 轮记录的写入点是 `Ledger.recordRound`，经 `session/run.ts` 的无条件记账。structure 腿的拒绝发生在它之前，因此一条被拒的派发**不产生** `RoundRecord`：无 crash 记录、`cycle` 不推进、`attempt` 不递增、`waves[n].rounds` 长度不变。
- 条件而非快照：本相位之后，任何 pre-flight 拒绝都不得让 `recordRound` 被调用一次。可核方式是「拒绝后 `waves[n].rounds` 长度与拒绝前相等」，不是「今天恰好没写」。

#### 1.3 carrier 开名挪到门之后
- 今天派发体的 pre-flight 半程先开本轮的两个 carrier 名，四门里的**三道**（carrier · dispatch-input · artifact）拒绝时调 `#sealRoundCarriers` 封回。no-host 是第四道却站在例外一侧：它在 `face/lifecycle.ts#CliLifecycle` 的 `#runDispatch` 顶部返回，早于开名，从不封回。门前移后，四道拒绝都发生在开名之前，封回这一步因此从拒绝路径上消失。
- 条件：拒绝路径不得留下「已开名、未封」的 carrier；由于开名在门之后，这条由顺序保证，不再由一次补封保证。

### 2. 事实：一条树级拒绝记录

#### 2.1 形状与位置
- 位置：工作区根的 `.kairos/cdd/` 下，`in-flight.json` 的邻居，文件名 refusal.json（裸词：本相位新建，落地前不构成 pin 坐标）。
- 形状：一条记录对象，字段为 `at`（写入时刻）· `slug`（相位工作区名）· `op`（`implement` / `review` / `fix`）· `type`（面）· `cycle` · `attempt` · `station`（闭集，见 3.2）· `detail`（站内原因，自由文本，**不含站名**——站名与原因各存一份，不互相复述）。八格就是全部：父章程写的 reason 是 `detail` 这一格的旧名，本相位以 `detail` 为准。
- `detail` 的规范化：单行（行内换行折叠为空格）、不重复站名（今日本部分原因串以该门自己的原因词开头，写入前剥掉——carrier 门的 `carrier-mismatch`、artifact 门的 `artifact-identity`、dispatch-input 门的段串）、` · ` 视作行内分隔符而非第二个 token。规范化只作用于**拒绝事实与 board / 预览的合成串**；`CDD_BLOCKED` 仍念它自己的既有渲染（3.3），不读这份合成。
- 归属类：与 `InFlight` 同构的一个类，守「一棵树任一时刻最多一条拒绝事实」。它不持有轮的状态，也不参与轮的任何判定。
- 名字进 `round-artifacts.ts` 的拼写矩阵，与 `in-flight` 行并列——矩阵是名字的唯一语法，不在矩阵里的名字对清扫与判定都是隐形的。

#### 2.2 生命周期：一条，整条腿一通过就清
- 写入：**任一** structure 腿拒绝时覆盖写入——九行一视同仁，不留豁免。`tree-clean` · `in-flight` · `graph` · `plan-ledger` · `doc-contract` 的拒绝与四道门的拒绝同样写：本相位要治的正是「一次拒绝不留痕」，而「只让迁移过来的四行写」是给旧行开的豁免层（Constraints 禁止）。
- 清除：一次派发通过**整条**结构腿（九行全过）、即将进入派发体时清除。语义是「这棵树此刻未通过门前判定」——门过了，这句话就不成立。
- 因此任一时刻最多一条，且**不留下历史**。拒绝的历史在命令输出里逐次可见（`CDD_BLOCKED` 行），轮的历史在 `rounds` 里（拒绝不在其中）。第三个历史源是禁止的：它会与 `rounds` 永不同步。

#### 2.3 不变量：最多一条，通过即清
- 两条可核不变量：① 任一时刻最多一条拒绝事实（覆盖写入 + 通过即清共同保证）；② 一次通过结构腿全部门的派发之后，拒绝事实不存在。
- refused 行与 `in-flight:` 行**可以并存**，且不构成矛盾：`in-flight` 门就是腿的第 2 行，「树正在跑」正是一棵树此刻被拒的合法原因之一。把两者说成互斥，会让「因为正在跑而被拒」这条最常见的拒绝无法同时陈述两个事实。
- 方向仍然成立，只是换成通过即清：拒绝后跑一次合法派发 ⇒ 拒绝事实消失、`in-flight:` 出现；该派发正常结束 ⇒ `in-flight:` 消失，拒绝事实不因结束而出现（除非真的又被拒了一次）。

#### 2.4 预览：镜像判定，不写不清
- `--dry-run` 走同一批门前判定（P38 §2.3 的镜像规则），渲染「如果你真跑，会在这里被拒」，但**不写、不清**拒绝事实：预览不是一次派发，无权宣布这棵树通过了门，也无权覆盖一条真实拒绝。

### 3. 露面：board 的一行与命令的一行

#### 3.1 board 行：复用 preview 已经说出的那个词

- 词不是本相位新造的。`Preview.artifactBlock` 今天已经在为**同一批门**渲染一条 `refused:  <原因>` 行——预览说「如果你真跑，会在这里被拒」。这里要说清「同一批」是几道：预览镜像的是 **carrier · dispatch-input · artifact 三道**；no-host 不在预览面上（它在 `face/lifecycle.ts#CliLifecycle` 的 `#runDispatch` 顶部返回，预览没有这一格）。board 要加的是**同一个词在持久面上的那一份**：同义、同形、三道镜像 + no-host 说明。新造一个词反而会让两个面各说各话。
- 位置：`in-flight:` 行的下一行。两行回答同一个问题（这棵树能开跑吗）；`crashed:` 回答另一个问题（跑过的轮里哪些坏了），因此不与它并排。
- 形状：

```text
refused: {op} {cycle}·a{attempt} {station} · {detail}
```

- 为什么这一行可以直接含 ` · `：这一行只有**一个轮标识**（`{cycle}·a{attempt}`），`station` 取自九值闭集、永远先于第一个 ` · ` 出现，因此行内的 ` · ` 只是「站名 / 原因」与原因自身片段之间的分隔；`crashed:` 的 ` · ` 是**跨轮**分隔符（多个 token 之间），两者的活儿不同。行也不靠切分解析：站名从闭集取，`detail` 是剥掉站名与规范化（2.1）之后剩下的部分。
- 构造点：`station` 与 `detail` 在一处拼成 **board / 预览** 的合成串；`CDD_BLOCKED` **不**读这份合成，它念自己既有的报文（3.3）——三个读者共用一份会改掉 `CDD_BLOCKED` 的字节，而 3.3 声明那不可能。两个面各自一次拼装，就是两份会漂移的字面；两边各守自己已声明的字节则是两件事。
- 渲染归属：board 只在拒绝事实的 `slug` 与本次观察的工作区相同时渲染它。别的相位工作区的拒绝不是本次观察对象——但它在自己的 board 上照常可见，且被下一次写入覆盖即消失。

#### 3.2 站名闭集与穷尽断言
- 站名闭集就是 structure 腿的行集，九值一张表（`session/preflight.ts#PreFlightGateName`）：

```text
tree-clean · in-flight · graph · plan-ledger · doc-contract · no-host · carrier · dispatch-input · artifact
```

- 后四个里只有 dispatch-input 已成词（`face/words.ts` 的 station 行）；no-host · carrier · artifact 是本相位新立的判别值，落地前不构成 pin 坐标。`carrier` 是站名，报文里的 `carrier-mismatch` 是这道门的原因词面，不是第二个站名。
- 一条穷尽断言守它：structure 腿的每一行都必须给得出闭集内的站名与一条 detail 来源（今天的 `CDD_BLOCKED` 报文字面就是那来源）；新增一行而不给站名、或给不出原因来源，是构造期红。新增站名因此触发一次有意识的决定，而不是随手多一个字符串。

#### 3.3 命令输出不变
- `CDD_BLOCKED:` 行逐字节不变。拒绝的报文与原因仍由既有的 station 词面渲染；本相位只改变「拒绝之后写什么账」，不改「拒绝时说什么话」。这是消费面守恒的一半。

### 4. 边界

#### 4.1 明确不动
- `RoundStatus` 五值闭集不动：它是**孩子结论**的词汇，五个值住在 `session/ledger.ts#RoundStatus`（镜像 `face/words.ts` 的 status 行）；`session/handoff-schema.ts` 的孩子 enum 只有两值（APPROVED / BLOCKED），是另一件事——它管「孩子能写什么」，不承载这五个值。「孩子说不出被拒」的判据取前者，孩子 enum 不因本相位动一格。
- `RoundRecord` 不加字段：拒绝不是轮的事实，加字段等于承认它住在这里。
- `CrashCause` 与 `RoundViolation` 的 grade 轴不动：前者是孩子之死的词汇；后者被 `targetAction` 判定读取，判据写作一条**条件**——一条拒绝表示不得让 `targetAction` 为 `true`。今天该值在 `face/lifecycle.ts` 由 grade 判：

```text
targetAction: !violations.some(v => v.grade === "hard")
```

软档即 `true`，等于把拒绝记成「本轮完成了任务」——所以拒绝不借软档。
- `--recover` 的措辞不动，但**行为面按改后形面重述**：接管判定跑在结构腿裁决之后（`face/cli.ts#Cli#step`：结构腿一拒，`#recoverRun` 不被调用），而四门并入后正是结构腿在拒绝。因此一次被拒的派发上执行 `--recover`：不认领任何东西、不写、`cycle` 不动，同一拒绝再次出现。今天那句「无可接管」（`RECOVER_NOTHING`，住 `face/cli.ts` 的 `#recoverRun`）在这条路径上**不可达**——本相位不承诺那句话，也不改它：它仍属于「结构腿通过、但没有陈旧锁可接管」的另一条路径。
- `#reject` 族不动：那里孩子确实存在（draft 在盘上、形状不合格），`contract-violation` 是真话。

#### 4.2 不可读的拒绝事实
- 拒绝事实损坏或不可解析时，board 念一条**自己的** corrupt 行（unreadable refusal record，裸词：本相位新立），**不静默视作「无拒绝」**。它不借 `InFlight` 的两行：那两行各自声明一个锁事实（lock on disk / no lock behind），而拒绝事实从不持锁，借用会把「无锁」说成一个锁事实，也会让同一张词表里一行有两个意思。一条被吞掉的拒绝，比一条标错的拒绝更难查——本相位治的就是「错的形状」，不能顺手造出「没有形状」。
- 读面不因一条只读产物损坏而整体失败：corrupt 是一行，不是一次退出。

#### 4.3 与 #459 的对账
- #459 是「轮的终止不可与完成分辨」；本相位是「轮的被拒不可与死亡分辨」。同族：**轮的一种状态没有真实表示，于是借用了另一种状态的形状**。
- 本相位只收 pre-spawn 这一半。另一半（终止）留在 #459，且本相位不提供那一半的答案——只把「状态必须有自己名字」这条判据立起来。

### Acceptance criteria

- `dispatch-input` **拒绝不写轮记录**：在没有 `base.json` 的工作区派发一次 wave 评审 ⇒ 命令输出 `CDD_BLOCKED` 且站名取自 structure 腿的九值行集；随后 `board` 无 `crashed:` 行、`waves[n].rounds` 长度与派发前相等、重派仍是 `review 1·1`。同一断言在改前必须红（今天读作 `review 2·1`）。
- `board` **拒绝写树级事实**：同一派发后 refusal.json 存在且八格齐全（`at` · `slug` · `op` · `type` · `cycle` · `attempt` · `station` · `detail`，缺任一格即红）；`board` 出现 refused 行，形状合 3.1，位置在 `in-flight:` 之后。同一条 pin 带跨工作区方向：`slug` 指向别的工作区的拒绝事实在本树的 board 上不渲染，而在它自己的 board 上照常渲染。
- `refused` 事实**最多一条 · 通过即清**：拒绝后跑一次合法派发 ⇒ refused 行消失、`in-flight:` 出现；该派发正常结束 ⇒ `in-flight:` 消失且 refused 行不因结束而出现。第三条方向：树被 `in-flight` 门拒绝（有活主）之后，board 上 `in-flight:` 与 `refused:` **同时**存在——改前结构上不可能（拒绝不写事实），两行各自只陈述自己的事实。
- `DispatchAuthority` **行集即站名闭集 · 穷尽断言**：四道门各实测一次拒绝，落下的 `station` 分别是 no-host · carrier · dispatch-input · artifact 之一，且取自 `session/preflight.ts#PreFlightGateName` 这张九值表；穷尽断言对「structure 腿新增一行未给站名、或给不出 detail 来源」报红（构造期或编译期，一处）。
- `--recover` **不认领被拒的派发**：对一次被拒的派发执行 `--recover` ⇒ 不认领任何东西、无写入、`cycle` 不推进，且同一拒绝再次出现（`face/cli.ts#Cli#step` 在结构腿拒绝上不调 `#recoverRun`，所以既有「无可接管」文案在这条路径上不可达——测的是不认领 + 无写入 + 同一拒绝，不是那句话）；`--dry-run` 中途被拒 ⇒ 零写入（refusal.json 既不出现也不消失）。
- `.changeset/` **门控**：`pnpm run validate` exit 0；changeset 为 `cdd-engine` **minor**（board 新增一行 · refusal.json 为新增产物 · structure 腿多四行，均为消费面可见）；kairos 未动。

## Constraints

- **零裸函数**：`packages/cdd-engine/src-next` 下不新增 `function` 声明，状态与行为落进类（`check:no-bare-functions` 是门）。
- **pin 写法**：行为断言引模块路径 + 符号名，不引行号；尚未在源树出现的词汇写裸词或进围栏块——反引号即成 pin，未落地即红。
- **单事实单份**：拒绝事实只有一个家（树级记录）；board 行与预览从它派生，`CDD_BLOCKED` 念自己既有的报文（3.3），两边不各自持有第三份副本。
- **消费面守恒**：`CDD_BLOCKED` 行与既有 `crashed:` 语义逐字节不变；本相位新增的消费面只有 board 的一行与新产物文件。
- **不留豁免层**：不引入「pre-flight 拒绝走一条特殊路径」的分支——门前的返回本身就是普通路径，拒绝不需要例外。
- **引擎只拒不改**：拒绝不移动、不改写、不删除任何既有产物；门的前移不得让任何已被写的文件变成孤儿。
- **类的规模**：新增类守一条不变量（一树最多一条拒绝事实），方法读作 ≤10 行，参数 ≤4；超过即说明它守了两件事。

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-11-18 | 首稿：S1 归属落定（四门并入 structure 腿 · 拒绝在 recordRound 之前返回 · 树级 refusal 事实 · board 一行 · 四站闭集 · 互斥不变量） | Oscaner M. · Claude |
| v0.2 | 2026-11-18 | 首轮评审回填（F1–F12 全采纳）：① 站名闭集改为 structure 腿的行集（九值，`session/preflight.ts#PreFlightGateName`），九行一视同仁写事实，互斥不变量换成「最多一条 · 通过即清」；② 四行的判定输入与判定点写成条件（只读推演，不建工作区、不写 brief、不在 `--recover` 之后）；③ `--recover` 按改后形面重述（不认领 · 无写入 · 同一拒绝复发）；④ `detail` 规范化 + `CDD_BLOCKED` 自有渲染分离；⑤ 封回与预览镜像的门数写实（三道 + no-host 例外）；⑥ corrupt 行自成一词；⑦ `RoundStatus` 五值 pin 到 `session/ledger.ts#RoundStatus`；⑧ 腿行集加 pin、三个未落地词写裸词；⑨ AC② 八格 + 跨工作区渲染、AC③ 通过即清、AC④ 九值表、AC⑤ 改后形面 | Oscaner M. · Claude |
