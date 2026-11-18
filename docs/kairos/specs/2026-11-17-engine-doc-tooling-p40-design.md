---
title: 'P40 · 派发前拒绝的记账面：拒绝属树，不属轮'
doc-type: phase-spec
version: v0.1
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
- `DispatchAuthority` 的 structure 腿今天是一张闭集：`tree-clean` · `in-flight` · `graph` · `plan-ledger` · `doc-contract`。四道门并入为它的第 6–9 行，行 id 即拒绝的站名——`no-host` · `carrier` · `dispatch-input` · `artifact`。
- 判定顺序：四行排在 `doc-contract` 之后。输入面是否合格，需先有合格的文档；一条判据的门槛若低于它依赖的判据，它给出的绿是空的。
- 复用既有值类型与适配器，不新增：`DispatchRefusal`（`leg` 仍取 `structure`）与 `DispatchAuthority.structureRefusal`。`DispatchLeg` 的三值闭集不动——分腿的依据是**问题不同**（树是否就绪 / 上游面是否到达 / 这一行在哪），不是代码放在哪。
- 门判据本体不动：`dispatch-input` 的判据（`requiredOn` 与 `absent` 两维声明、`when` 臂、四态渲染）由 P38 交付且正确；本相位只改它被判定的位置与失败后的归属。

#### 1.2 拒绝在轮记录被写之前返回
- 轮记录的写入点是 `Ledger.recordRound`，经 `session/run.ts` 的无条件记账。structure 腿的拒绝发生在它之前，因此一条被拒的派发**不产生** `RoundRecord`：无 crash 记录、`cycle` 不推进、`attempt` 不递增、`waves[n].rounds` 长度不变。
- 条件而非快照：本相位之后，任何 pre-flight 拒绝都不得让 `recordRound` 被调用一次。可核方式是「拒绝后 `waves[n].rounds` 长度与拒绝前相等」，不是「今天恰好没写」。

#### 1.3 carrier 开名挪到门之后
- 今天派发体的 pre-flight 半程先开本轮的两个 carrier 名，四门拒绝时调 `#sealRoundCarriers` 封回。门前移后，拒绝发生时**还没有名字被开**，因此封回这一步从拒绝路径上消失。
- 条件：拒绝路径不得留下「已开名、未封」的 carrier；由于开名在门之后，这条由顺序保证，不再由一次补封保证。

### 2. 事实：一条树级拒绝记录

#### 2.1 形状与位置
- 位置：工作区根的 `.kairos/cdd/` 下，`in-flight.json` 的邻居，文件名 refusal.json（裸词：本相位新建，落地前不构成 pin 坐标）。
- 形状：一条记录对象，字段为 `at`（写入时刻）· `slug`（相位工作区名）· `op`（`implement` / `review` / `fix`）· `type`（面）· `cycle` · `attempt` · `station`（闭集，见 3.2）· `detail`（站内原因，自由文本，**不含站名**——站名与原因各存一份，不互相复述）。
- 归属类：与 `InFlight` 同构的一个类，守「一棵树任一时刻最多一条拒绝事实」。它不持有轮的状态，也不参与轮的任何判定。
- 名字进 `round-artifacts.ts` 的拼写矩阵，与 `in-flight` 行并列——矩阵是名字的唯一语法，不在矩阵里的名字对清扫与判定都是隐形的。

#### 2.2 生命周期：一条，门一通过就清
- 写入：任一 structure 腿拒绝时覆盖写入。
- 清除：一次派发通过全部门前判定、即将进入派发体时清除。语义是「此刻这棵树未通过门前判定」——门过了，这句话就不成立。
- 因此任一时刻最多一条，且**不留下历史**。拒绝的历史在命令输出里逐次可见（`CDD_BLOCKED` 行），轮的历史在 `rounds` 里（拒绝不在其中）。第三个历史源是禁止的：它会与 `rounds` 永不同步。

#### 2.3 互斥不变量
- refused 行与 `in-flight:` 行**永不同时出现**：一个是还没开跑，一个是正在跑；同一棵树任一时刻只有一个状态。
- 两个方向都要成立：拒绝后跑一次合法派发 ⇒ 拒绝事实消失、`in-flight:` 出现；派发正常结束 ⇒ `in-flight:` 消失，且不被任何拒绝事实替代（除非真的又拒了一次）。

#### 2.4 预览：镜像判定，不写不清
- `--dry-run` 走同一批门前判定（P38 §2.3 的镜像规则），渲染「如果你真跑，会在这里被拒」，但**不写、不清**拒绝事实：预览不是一次派发，无权宣布这棵树通过了门，也无权覆盖一条真实拒绝。

### 3. 露面：board 的一行与命令的一行

#### 3.1 board 行：复用 preview 已经说出的那个词

- 词不是本相位新造的。`Preview.artifactBlock` 今天已经在为**同一批门**渲染一条 `refused:  <原因>` 行——预览说「如果你真跑，会在这里被拒」。board 要加的是**同一个词在持久面上的那一份**：同义、同形、同一批门。新造一个词反而会让两个面各说各话。
- 位置：`in-flight:` 行的下一行。两行回答同一个问题（这棵树能开跑吗）；`crashed:` 回答另一个问题（跑过的轮里哪些坏了），因此不与它并排。
- 形状：

```text
refused: {op} {cycle}·a{attempt} {station} · {detail}
```

- 为什么这一行可以直接含 ` · `：它**只有一个 token**。`crashed:` 的 ` · ` 是**跨轮**分隔符（多个 token 之间），而这一行只有一个轮标识；` · ` 在此是行的内容。用 `/` 去规避一个不存在的冲突，是拿可读性换一个假问题的安全。
- 构造点只有一处：`station` 与 `detail` 在一处拼成整行的原因串，`CDD_BLOCKED` · 预览 · board 三个读者共用它。三个读者各拼一次，就是三份会漂移的字面。
- 渲染归属：board 只在拒绝事实的 `slug` 与本次观察的工作区相同时渲染它。别的相位工作区的拒绝不是本次观察对象——但它在自己的 board 上照常可见，且被下一次写入覆盖即消失。

#### 3.2 站名闭集与穷尽断言
- 站名是一个四值闭集：

```text
no-host · carrier · dispatch-input · artifact
```

- 这四个词在源树里只有 `dispatch-input` 已成词（`face/words.ts` 的 station 行）；其余三个是本相位新立的判别值，落地前不构成 pin 坐标。
- 一条穷尽断言守它：structure 腿的每一行都必须给出闭集内的站名，新增一行而不给站名是构造期红。新增站名因此触发一次有意识的决定，而不是随手多一个字符串。

#### 3.3 命令输出不变
- `CDD_BLOCKED:` 行逐字节不变。拒绝的报文与原因仍由既有的 station 词面渲染；本相位只改变「拒绝之后写什么账」，不改「拒绝时说什么话」。这是消费面守恒的一半。

### 4. 边界

#### 4.1 明确不动
- `RoundStatus` 五值闭集不动：它是**孩子结论**的词汇（`words.ts` 的 status 行、`handoff-schema.ts` 的孩子 enum），孩子说不出「被拒」。
- `RoundRecord` 不加字段：拒绝不是轮的事实，加字段等于承认它住在这里。
- `CrashCause` 与 `RoundViolation` 的 grade 轴不动：前者是孩子之死的词汇，后者被 `targetAction` 判定读取——实测软档会让 `targetAction` 变 `true`，等于把拒绝记成「本轮完成了任务」。
- `--recover` 的措辞不动：它只读 in-flight 陈旧锁，拒绝后无锁可接管，行为已经对，本相位只加判据钉住它。
- `#reject` 族不动：那里孩子确实存在（draft 在盘上、形状不合格），`contract-violation` 是真话。

#### 4.2 不可读的拒绝事实
- 拒绝事实损坏或不可解析时，board 念一条明确的 corrupt 行（沿用 `InFlight` 的 corrupt 词面），**不静默视作「无拒绝」**。一条被吞掉的拒绝，比一条标错的拒绝更难查——本相位治的就是「错的形状」，不能顺手造出「没有形状」。
- 读面不因一条只读产物损坏而整体失败：corrupt 是一行，不是一次退出。

#### 4.3 与 #459 的对账
- #459 是「轮的终止不可与完成分辨」；本相位是「轮的被拒不可与死亡分辨」。同族：**轮的一种状态没有真实表示，于是借用了另一种状态的形状**。
- 本相位只收 pre-spawn 这一半。另一半（终止）留在 #459，且本相位不提供那一半的答案——只把「状态必须有自己名字」这条判据立起来。

### Acceptance criteria

- ① **拒绝不写轮记录**：在没有 `base.json` 的工作区派发一次 wave 评审 ⇒ 命令输出 `CDD_BLOCKED` 且站名为 structure 腿的四值之一；随后 `board` 无 `crashed:` 行、`waves[n].rounds` 长度与派发前相等、重派仍是 `review 1·1`。同一断言在改前必须红（今天读作 `review 2·1`）。
- ② **拒绝写树级事实**：同一派发后 refusal.json 存在且字段完整（`op` · `type` · `cycle` · `attempt` · `station` · `detail`）；`board` 出现 refused 行，形状合 3.1，位置在 `in-flight:` 之后。
- ③ **互斥不变量两向可核**：拒绝后跑一次合法派发 ⇒ refused 行消失、`in-flight:` 出现；该派发正常结束 ⇒ `in-flight:` 消失且 refused 行不出现。两条方向各一条断言。
- ④ **四站闭集与穷尽断言**：四道门各实测一次拒绝，落下的 `station` 分别是四值之一；穷尽断言对「structure 腿新增一行未给站名」报红（构造期或编译期，一处）。
- ⑤ **`--recover` 无可接管**：对一次被拒的派发执行 `--recover` ⇒ 报「无可接管」，不认领、`cycle` 不推进；`--dry-run` 中途被拒 ⇒ 零写入（refusal.json 既不出现也不消失）。
- ⑥ **门控**：`pnpm run validate` exit 0；changeset 为 `cdd-engine` **minor**（board 新增一行 · refusal.json 为新增产物 · structure 腿多四行，均为消费面可见）；kairos 未动。

## Constraints

- **零裸函数**：`packages/cdd-engine/src-next` 下不新增 `function` 声明，状态与行为落进类（`check:no-bare-functions` 是门）。
- **pin 写法**：行为断言引模块路径 + 符号名，不引行号；尚未在源树出现的词汇写裸词或进围栏块——反引号即成 pin，未落地即红。
- **单事实单份**：拒绝事实只有一个家（树级记录）；board 行与命令输出都从它派生，不各自持有副本。
- **消费面守恒**：`CDD_BLOCKED` 行与既有 `crashed:` 语义逐字节不变；本相位新增的消费面只有 board 的一行与新产物文件。
- **不留豁免层**：不引入「pre-flight 拒绝走一条特殊路径」的分支——门前的返回本身就是普通路径，拒绝不需要例外。
- **引擎只拒不改**：拒绝不移动、不改写、不删除任何既有产物；门的前移不得让任何已被写的文件变成孤儿。
- **类的规模**：新增类守一条不变量（一树最多一条拒绝事实），方法读作 ≤10 行，参数 ≤4；超过即说明它守了两件事。

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-11-18 | 首稿：S1 归属落定（四门并入 structure 腿 · 拒绝在 recordRound 之前返回 · 树级 refusal 事实 · board 一行 · 四站闭集 · 互斥不变量） | Oscaner M. · Claude |
