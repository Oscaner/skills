---
title: 'P40 · 派发前拒绝的记账面：拒绝属树，不属轮'
doc-type: phase-spec
version: v0.4
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
- 判定输入（值来源）：四格输入，不是一行一格（`ArtifactCell` 同时供 carrier 与 artifact 两行判定；`(cycle, attempt)` 是这条拒绝事实自己的身份，不是任何一行的输入），全部由装配好的派发输入推得，门自己去读场景不在其中——① `TemplateValues`（`INPUT_WAVE_BRIEF` 的路径值由 `session/round-naming.ts#RoundNaming` 的 `brief()` 命名，与 `--dry-run` 预览同一条推演）；② `ArtifactCell`（fix 面的 `--reviews` 路径与 requesting carrier 取自本行已记录的上游轮）；③ 将落的 `(cycle, attempt)`（同一命名面从 ledger 的下一轮参数渲染）；④ 主机探测事实（`no-host` 行的唯一输入，今天由 `face/lifecycle.ts#CliLifecycle#detectHost` 在 `#runDispatch` 顶部现算）。前三格是**只读推演**：不建相位工作区目录、不写 brief、不开本轮 carrier 名、不取 in-flight 记录。第四格是 composition root 填进 `PreFlightContext` 的**已判事实**（一个值，不是一次调用）：seam 读事实，绝不 import face 的 host 模块——否则这条接缝在落地第一天就破了本程序要立的 plane 方向（P39）。发布命名空间的 keep-out 标记（`infra/workspace.ts#WorkspaceRoot#ensure`，见 2.2）不算「建工作区」：它只写 `<repoRoot>/.kairos/.gitignore` 与 `.kairos/cdd/`，不建 `<slug>` 目录、不写 brief。
- 判定点不后移（条件）：门必须在轮记录被写之前、也在 `--recover` 的接管判定之前给出结构腿的裁决（4.1）。把工作区创建或 brief 渲染提到门之前，会让一条被拒的派发留下工作区与 brief，并让接管判定先于拒绝读到一条陈旧的持有者——两条都是本相位要消除的形状。因此 `PreFlightContext` 多收这些输入格，而不是门自己去读场景。
- 复用既有值类型与适配器，不新增：`DispatchRefusal`（`leg` 仍取 `structure`）与 `DispatchAuthority.structureRefusal`。`DispatchLeg` 的三值闭集不动——分腿的依据是**问题不同**（树是否就绪 / 上游面是否到达 / 这一行在哪），不是代码放在哪。
- 判定本体里唯一被本相位改动的一格是 `INPUT_WAVE_BRIEF`，且这条改动是具名的：门要判的是**编排者欠的输入**，不是**引擎自己要写的产物**——brief 的路径名就是这一格的完整答案，而那个文件由引擎在 child 读它之前自己渲染（`face/cli.ts#CliGate#renderBrief`，在门之后、`scene.workspace.ensure()` 之后）。因此这一格在声明面上改成它真实的意思：**引擎写的**（新声明字段 written: "engine"，裸词：本相位新建，落地前不构成 pin 坐标），释义只有一条——引擎保证该文件存在，因此**任何**路径都不做存在性读。作用面是**该格的每一处声明**，不是一行：`render/templates.ts` 的 `TEMPLATE_PROMPT` 把 `INPUT_WAVE_BRIEF` 声明三次——implement 行（`requiredOn: always`）、review 行与 fix 行（各 `requiredOn: [wave]`）——三处一起由 `preview: "satisfied"` 改为引擎写；只改一处，另两行就留着一个没有判定读的字段（判定看的是同一格，声明表却给出两个意思）。
  随之：`#inputRefusalOf` 的 `mode === "preview"` 守卫与 `#answeredByNaming` 的 `decl.preview !== "satisfied"` 守卫一并消失（只剩「这一格是不是命名行写的那一格」的 token 守卫），`inputRefusal` 的 `mode` 参数退场。`TemplateAssembler` 的构造期断言保留并**换论域**：`#assertPreviewAnswer` 今天按声明行判「只有 brief 这一格能取 `satisfied`」，三处同改会让它把同一格数三遍；改后它按**槽**判——收集声明为引擎写的槽，集合必须恰好是 `{NAMED_BRIEF_CELL}` 这一个元素，于是「另一格也称引擎写」是构造期红，而三行声明同一格不是三格。声明表本身同批收成按 mode 名索引的 `Record<mode, Row>`，三处声明因此无法各自漂移（少一行即编译期红）。
  这条与「判定点不后移」不冲突：门仍在 brief 渲染之前，判的不是文件在不在，而是编排者有没有欠它的名字；于是 P38 §2.4 在这一格上的 per-mode 例外作废，同帧镜像规则收紧成「两面对同一帧报出逐字节相同的拒绝串」。**这条作废不在本相位的自裁范围内**——它退的是 P38 交付的判据一格，因此同批回填章程（D96 与 Phase inventory P40 的非目标从「改门判据（P38 交付）」收窄为「四门判什么不变；这一格的模式豁免按本轮登记改为引擎写」，行为在册增量补一条），并在 P38 的 spec 上追加一条**换向记录**指向本相位：历史行不改，指向不重写。
- 门判据本体不动（唯一例外是上一条的 `INPUT_WAVE_BRIEF` 一格）：`dispatch-input` 的判据（`requiredOn` 与 `absent` 两维声明、`when` 臂、四态渲染）由 P38 交付且正确；本相位只改它被判定的位置与失败后的归属。

#### 1.2 拒绝在轮记录被写之前返回
- 轮记录的写入点是 `Ledger.recordRound`，经 `session/run.ts` 的无条件记账。structure 腿的拒绝发生在它之前，因此一条被拒的派发**不产生** `RoundRecord`：无 crash 记录、`cycle` 不推进、`attempt` 不递增、`waves[n].rounds` 长度不变。
- 条件而非快照：本相位之后，任何 pre-flight 拒绝都不得让 `recordRound` 被调用一次。可核方式是「拒绝后 `waves[n].rounds` 长度与拒绝前相等」，不是「今天恰好没写」。

#### 1.3 carrier 开名挪到门之后
- 今天派发体的 pre-flight 半程先开本轮的两个 carrier 名，四门里的**三道**（carrier · dispatch-input · artifact）拒绝时调 `#sealRoundCarriers` 封回。no-host 是第四道却站在例外一侧：它在 `face/lifecycle.ts#CliLifecycle` 的 `#runDispatch` 顶部返回，早于开名，从不封回。门前移后，四道拒绝都发生在开名之前，封回这一步因此从拒绝路径上消失。
- 条件：拒绝路径不得留下「已开名、未封」的 carrier；由于开名在门之后，这条由顺序保证，不再由一次补封保证。

### 2. 事实：一条树级拒绝记录

#### 2.1 形状与位置
- 位置：工作区根的 `.kairos/cdd/` 下，`in-flight.json` 的邻居，文件名 refusal.json（裸词：本相位新建，落地前不构成 pin 坐标）。
- 形状：一条记录对象，字段为 `at`（写入时刻）· `slug`（相位工作区名）· `op`（`implement` / `review` / `fix`）· `type`（面）· `cycle` · `attempt` · `station`（闭集，见 3.2）· `detail`（站内原因，自由文本，**不以站名开头**——站名已由这一行自己印出，串首再重复一遍就是同一事实说两次；站名出现在句子中间不在本相位可改的范围：`face/words.ts#CAPSULE_WORDS` 的 `inFlight.corruptLocked` / `corruptUnlocked` / `lockOnly` 三条措辞把 `in-flight` 写在句中，而措辞按章程非目标冻结）。八格就是全部，没有第九格，也没有第二个名字：`detail` 是这一格在章程、本相位与 board 行里唯一的名（站内原因，自由文本）。
- `detail` 的规范化：单行（行内换行折叠为空格）、去掉**串首**重复的站名（dispatch-input 门的报文以它自己的站名开头，去掉后 `detail` 从 `review · INPUT_OVERALL · target-absent` 起算；carrier 门的 `carrier-mismatch` 与 artifact 门的 `artifact-identity` **不是站名**——3.2 已把它们判为这两道门的原因词面——因此留在 `detail` 里）、` · ` 视作行内分隔符而非第二个 token。规范化服务于**同一条拼装**：三个面（命令行的 `CDD_BLOCKED:` 行 · 预览的 `refused:` 行 · board 行）都念 `station · detail`（3.3），没有第二份报文来源，也没有 per-face 抑制规则。
- 归属类：一个新类 tree-refusal，住在 session/refusal.ts（两者都是裸词：本相位新建，落地前不构成 pin 坐标），与 `InFlight`（`session/inflight.ts`）同构——一条记录、一次原子写、一个 `inspect` 式的状态读——守「一棵树任一时刻最多一条拒绝事实」。它不持有轮的状态，也不参与轮的任何判定；写入与清除都是别的面的动作（2.2），它只交出事实的读写与那一行拼装（3.1 · 3.3）。
- 名字进 `round-artifacts.ts` 的拼写矩阵，与 `in-flight` 行并列——矩阵是名字的唯一语法，不在矩阵里的名字对清扫与判定都是隐形的。

#### 2.2 生命周期：一条，整条腿一通过就清
- 写入：**任一** structure 腿拒绝时覆盖写入——九行一视同仁，不留豁免。`tree-clean` · `in-flight` · `graph` · `plan-ledger` · `doc-contract` 的拒绝与四道门的拒绝同样写：本相位要治的正是「一次拒绝不留痕」，而「只让迁移过来的四行写」是给旧行开的豁免层（Constraints 禁止）。
- 写入点：**门口，不是门里**——`face/cli.ts#Cli#runWork` 拿到 `DispatchAuthority#verdict` 的结构腿拒绝、在 `#renderPreflightBlocked` 之前写；**不**写在 `session/preflight.ts` 的门里。理由是可判的，不是风格：同一个门由真派发与 `--dry-run` 共用（预览那一支问的就是同一批判定），写进门里会让每次预览拒绝都落盘、每次预览通过都清除，直接与 2.4 的「不写、不清」和验收⑤的零写入相反。
- 写入的顺序与 `InFlight` 同一条：先发布命名空间的 keep-out 标记（`infra/workspace.ts#WorkspaceRoot#ensure` 写 `<repoRoot>/.kairos/.gitignore` = `*` 与 `.kairos/cdd/`），再做原子写。理由是一条拒绝的前置条件：它是唯一跑在 `scene.workspace.ensure()` 之前的路径，没有这条，一次拒绝就会成为某棵树的第一个 `.kairos` 条目；而 `infra/git.ts#GitClient#isClean` 读 git 自己的判断、零引擎侧排除，untracked 的 `.kairos/` 立刻弄脏这棵树——下一次派发被 `tree-clean` 拒并覆盖同一份记录，这棵树从此为引擎自己的一个文件拒绝每一次派发。发布标记不是「建工作区」（1.1）：不建 `<slug>` 目录、不写 brief。
- 清除：一次派发通过**整条**结构腿（九行全过）、即将进入派发体时清除——清除点是 `face/lifecycle.ts#CliLifecycle` 的 `#runDispatch` 入口、`#openRoundCarriers` 之前（走到那里就是腿已通过的证据，`#runDispatch` 只在裁决通过后被调用）。语义是「这棵树此刻未通过门前判定」——门过了，这句话就不成立。同样不在门里清：预览走不到派发体，而清除本身是一次写。
- 因此任一时刻最多一条，且**不留下历史**。拒绝的历史在命令输出里逐次可见（`CDD_BLOCKED` 行），轮的历史在 `rounds` 里（拒绝不在其中）。第三个历史源是禁止的：它会与 `rounds` 永不同步。

#### 2.3 不变量：最多一条，通过即清
- 两条可核不变量：① 任一时刻最多一条拒绝事实（覆盖写入 + 通过即清共同保证）；② 一次通过结构腿全部门的派发之后，拒绝事实不存在。
- refused 行与 `in-flight:` 行**可以并存**，且不构成矛盾：`in-flight` 门就是腿的第 2 行，「树正在跑」正是一棵树此刻被拒的合法原因之一。把两者说成互斥，会让「因为正在跑而被拒」这条最常见的拒绝无法同时陈述两个事实。
- 方向仍然成立，只是换成通过即清：拒绝后跑一次合法派发 ⇒ 拒绝事实消失、`in-flight:` 出现；该派发正常结束 ⇒ `in-flight:` 消失，拒绝事实不因结束而出现（除非真的又被拒了一次）。

#### 2.4 预览：镜像判定，不写不清
- `--dry-run` 走同一批门前判定（P38 §2.3 的镜像规则），渲染「如果你真跑，会在这里被拒」，但**不写、不清**拒绝事实：预览不是一次派发，无权宣布这棵树通过了门，也无权覆盖一条真实拒绝。
- 入口收成一个：结构腿拒绝在 `--dry-run` 上**一律由 preview 面陈述**，不再分「哪个渲染器」。今天的分岔就在 `face/cli.ts#Cli#runWork` 的 `verdict.leg === "structure"` 那一支——`in-flight` 且有活主的特例走 `Preview#heldBlock`，其余全走 `#renderPreflightBlocked`；本相位之后这一支在 `--dry-run` 上只留一个出口，覆盖整条腿而不止迁移过来的四行。
- 形状与**帧来源**：结构腿拒绝发生在 `OpenFrame` 存在之前——帧出自 `session/run.ts#Lifecycle` 的 `#peekNext`（在 `run` 构造之后、派发循环内调用），而 `run` 在裁决通过之后才构造，pre-flight 点上没有任何帧可借。因此预览的拒绝块**不是**五行的预报，而是 `Preview#artifactBlock` 今天已有的那一形：`cdd <verb>: preview (no repo changes)` 头 + 一行 `  refused:  <拼装>` + 报文自己的后续行（artifact 门的四段修法报告就在这些后续行里），再跟 seam 自己的 details 行与 `#renderChecked` 的 checked 面。本相位不为一条拒绝造第二个帧源，也不为它重算一帧。
- 流与随行行：拒绝块与 checked 面都走 **stdout**（`--dry-run` 的 checked 面今天在活主臂上就是这样走的——同一写作器），因此旧五行在 `--dry-run` 上的拒绝从 stderr 的 `CDD_BLOCKED:` 行改成 stdout 的预览块；details 行与 checked 面**保留**（「哪些门跑过」是既有生产读面，P21 §3.4 的两路径规则不因入口合并而破）。这是本相位对 `--dry-run` 面的具名变更，验收有对应对。
- 唯一保留自有形状的臂：`in-flight` **且有活主**。它今天走 `Preview#heldBlock`（`lock:` 行 + 接管提示，**没有** `refused:` 行），本相位不动——那一臂陈述的是一个持有者的事实，不是一个站名；把它折进 `refused:` 块会替换一个既有面，而本相位没有换它的理由。
- 预览的 `refused:` 行保持自己的既有形状（`  refused:  ` 两空格 + 内容，无轮标识），payload 与另两个面同一条拼装（`station · detail`，3.3）：`dispatch-input` 与五行既有报文因此与今天逐字节相同，`no-host` · `carrier` · `artifact` 三行多一段站名前缀（3.3 的具名变更）。board 的形状见 3.1。

### 3. 露面：board 的一行与命令的一行

#### 3.1 board 行：复用 preview 已经说出的那个词

- 词不是本相位新造的。`Preview.artifactBlock` 今天已经在为**同一批门**渲染一条 `refused:  <原因>` 行——预览说「如果你真跑，会在这里被拒」。这里要说清「同一批」是几道：预览镜像的是 **carrier · dispatch-input · artifact 三道**；no-host 没有它的预览格（它在 `face/lifecycle.ts#CliLifecycle` 的 `#runDispatch` 顶部返回，预览的预报里没有这一格）；`--dry-run` 上它照样以 `refused:` 行露面（2.4），只是没有一行预报可镜像。board 要加的是**同一个词在持久面上的那一份**：**同词**，不是同形——两个面共用词面与**同一条拼装**（`station · detail`，3.3），行内排布各按自己已声明的形状（预览是 `  refused:  ` 两空格、无轮标识；board 是下一行、带轮标识）。新造一个词反而会让两个面各说各话。
- 位置：`in-flight:` 行的下一行。两行回答同一个问题（这棵树能开跑吗）；`crashed:` 回答另一个问题（跑过的轮里哪些坏了），因此不与它并排。
- 形状：

```text
  refused: {op} {cycle}·a{attempt} {station} · {detail}
```

- 为什么这一行可以直接含 ` · `：这一行只有**一个轮标识**（`{cycle}·a{attempt}`），`station` 取自九值闭集、永远先于第一个 ` · ` 出现，因此行内的 ` · ` 只是「站名 / 原因」与原因自身片段之间的分隔；`crashed:` 的 ` · ` 是**跨轮**分隔符（多个 token 之间），两者的活儿不同。行也不靠切分解析：站名从闭集取，`detail` 是剥掉站名与规范化（2.1）之后剩下的部分。
- 构造点：三个面由**同一处**拼成——tree-refusal 交出它自己那一行（`station · detail`，2.1 规范化之后），命令行 · 预览的 `refused:` 行与 board 行都念这一行，各自只加自己的**外层**（`CDD_BLOCKED: ` / `  refused:  ` / `  refused: {op} {cycle}·a{attempt} `）。`session/dispatch-authority.ts#DispatchAuthority#message` 在结构腿今天做的就是 `reason · detail` 这件同一件事，而结构腿的 reason 就是行 id；本相位让它念的 reason 与记录里的 `station` 是同一个值。一份存储、一处拼装、三个外层，没有第二份会漂移的字面。
- 渲染归属：board 只在拒绝事实的 `slug` 与本次观察的工作区相同时渲染它。别的相位工作区的拒绝不是本次观察对象——但它在自己的 board 上照常可见，且被下一次写入覆盖即消失。读取点就在渲染 `in-flight:` 行的同一处（`face/board-view.ts`），不新开第二次扫描。

#### 3.2 站名闭集与穷尽断言
- 站名闭集就是 structure 腿的行集，九值一张表（`session/preflight.ts#PreFlightGateName`）：

```text
tree-clean · in-flight · graph · plan-ledger · doc-contract · no-host · carrier · dispatch-input · artifact
```

- 后四个里只有 dispatch-input 已成词，且它是 `face/words.ts#CAPSULE_WORDS` 的 `dispatchInput.station`（拒绝行的行首，不是 `stations` 那张前缀表——那张表是 `next` · `reason` · `blocked` · `warn` · `cliMissing` 的行首锚）；no-host · carrier · artifact 是本相位新立的判别值，落地前不构成 pin 坐标。`carrier` 是站名，报文里的 `carrier-mismatch` 是这道门的原因词面，不是第二个站名。
- 一条穷尽断言守它：structure 腿的每一行都必须给得出闭集内的站名与一条 detail 来源（今天的 `CDD_BLOCKED` 报文字面就是那来源）；新增一行而不给站名、或给不出原因来源，是构造期红。新增站名因此触发一次有意识的决定，而不是随手多一个字符串。

#### 3.3 一条拼装，三个面各自的外层
- 先改正一处事实：`face/cli.ts#Cli#renderPreflightBlocked` 今天念的**就是** `<站名> · <报文>`。它的插值来自 `session/dispatch-authority.ts#DispatchAuthority#message`，后者在结构腿上返回 `<reason> · <detail>`，而结构腿的 reason 正是拒绝的行 id（`structureRefusal` 把 `preflight.gate` 原样重述）。两个分支的差别只在**行外层**：`tree-clean` · `in-flight` · `doc-contract` 念 `CDD_BLOCKED: …`（`Words#station` 的 blocked 行首），`graph` · `plan-ledger` 念 `cdd <verb>: …`。因此「这一支不带站名」是错的——站名今天就在第一个位置（`CDD_BLOCKED: tree-clean · the working tree is dirty …`），`session/__tests__/dispatch-authority.test.ts` 与 `face/__tests__/cli.test.ts` 各有一枚 pin 钉着这个字节。
- 合成规则：记录只存两格（`station` + `detail`，2.1），**三个面都念 `station · detail`**——命令行的 `CDD_BLOCKED:` 行、预览的 `refused:` 行、board 的 `refused:` 行。没有 per-face 抑制规则，也没有第二份报文来源。旧稿曾想让三行「不带站名」，那需要一条「报文已自带身份就抑制前缀」的判定，而这条判定在 dispatch-input 上无法同时满足两个面：它带站名的串会与命令行重复，它不带站名的串会从预览那一行里丢掉 `dispatch-input` 这个头。
- 字节账（**具名变更**，与 changeset 同批）：
  - `dispatch-input`：今天的报文以它自己的站名开头，`station · detail` 逐字节复现 `CDD_BLOCKED: dispatch-input · review · INPUT_OVERALL · target-absent`，预览的 `  refused:  dispatch-input · …` 同样不变。
  - 五行既有行（`tree-clean` · `in-flight` · `graph` · `plan-ledger` · `doc-contract`）：今天已是 `station · detail`，逐字节不变。
  - `no-host` · `carrier` · `artifact`：今天念的是不带站名的句子，合成后**多一段站名前缀**——`CDD_BLOCKED: no-host · no host harness detected (run cdd from within a supported harness)` · `CDD_BLOCKED: carrier · carrier-mismatch · line=… · recorded=… · current=…` · `CDD_BLOCKED: artifact · artifact-identity · …`；预览的 `refused:` 行同步多这一段。**detail 的文本一个字不改**（措辞不动），改的只是行首多了它自己的站名。代价换来的是：一条拼装、零抑制规则、`carrier` 与 `artifact` 两条不同的修法在输出里可分辨。
- 与章程的关系：章程的非目标是「改 `CDD_BLOCKED` 报文**措辞**」——本相位不改任何一句措辞，只在三行行首补站名，那条非目标因此不是「字节不变」的承诺。这条变更按章程同批登记为在册增量（D96 与 Phase inventory 的同句），验收里写成对（改前三行不带站名 · 改后带）。
- 三个面各守自己的外层：`CDD_BLOCKED: ` / `  refused:  ` / `  refused: {op} {cycle}·a{attempt} `。外层不是拼装的一部分——把外层也并进一处，board 就会印出 `CDD_BLOCKED:`，预览就会印出轮标识。消费面的守恒因此分两半：五行 + `dispatch-input` 逐字节不变，三行按具名变更加前缀；另一半是 `--dry-run` 上的整条腿改由预览面陈述（2.4）。

### 4. 边界

#### 4.1 明确不动
- `RoundStatus` 五值闭集不动：它是**孩子结论**的词汇，五个值住在 `session/ledger.ts#RoundStatus`（镜像 `face/words.ts` 的 status 行）；`session/handoff-schema.ts` 的孩子 enum 只有两值（APPROVED / BLOCKED），是另一件事——它管「孩子能写什么」，不承载这五个值。「孩子说不出被拒」的判据取前者，孩子 enum 不因本相位动一格。
- `RoundRecord` 不加字段：拒绝不是轮的事实，加字段等于承认它住在这里。
- `CrashCause` 与 `RoundViolation` 的 grade 轴不动：前者是孩子之死的词汇；后者被 `targetAction` 判定读取，判据写作一条**条件**——一条拒绝表示不得让 `targetAction` 为 `true`。今天该值在 `face/lifecycle.ts` 由 grade 判：

```text
targetAction: !violations.some(v => v.grade === "hard")
```

软档即 `true`，等于把拒绝记成「本轮完成了任务」——所以拒绝不借软档。
- `--recover` 的措辞不动，但**行为面按改后形面重述**：接管判定跑在结构腿裁决之后（`face/cli.ts#Cli#runWork`：只有 `this.#authority.structureRefusal(preflight) === null` 才进 `#recoverRun`，结构腿一拒它不被调用），而四门并入后正是结构腿在拒绝。因此一次被拒的派发上执行 `--recover`：不认领任何东西、不写、`cycle` 不动，同一拒绝再次出现。今天那句「无可接管」（`RECOVER_NOTHING`，住 `face/cli.ts` 的 `#recoverRun`）在这条路径上**不可达**——本相位不承诺那句话，也不改它：它仍属于「结构腿通过、但没有陈旧锁可接管」的另一条路径。
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
- `--recover` **不认领被拒的派发**：对一次被拒的派发执行 `--recover` ⇒ 不认领任何东西、无写入、`cycle` 不推进，且同一拒绝再次出现（`face/cli.ts#Cli#runWork` 在结构腿拒绝上不调 `#recoverRun`，所以既有「无可接管」文案在这条路径上不可达——测的是不认领 + 无写入 + 同一拒绝，不是那句话）；`--dry-run` 中途被拒 ⇒ 零写入（refusal.json 既不出现也不消失）。
- `.changeset/` **门控**：`pnpm run validate` exit 0；changeset 为 `cdd-engine` **minor**（board 新增一行 · refusal.json 为新增产物 · structure 腿多四行，均为消费面可见）；kairos 未动。
- `INPUT_WAVE_BRIEF` **是引擎写的格子**：在一个还没有 `tasks-<n>-brief.md` 的全新工作区派发一次 wave 评审 ⇒ 四道门全过（不是 `target-absent`），真跑路径随后渲染出 brief；同一状态下 `cdd implement --type wave` 的首次派发同样不拒（implement 行的声明同改）；同一状态加 `--dry-run` ⇒ 同一裁决（门不因面而换判据）。构造期断言的论域是**槽**：三行声明同一格时绿（槽集合恰好 `{NAMED_BRIEF_CELL}`），而「另一格也声明引擎写」即红；声明表的三处按 mode 索引的 `Record<mode, Row>` 同表，少一行即编译期红。
- `CDD_BLOCKED` **一条拼装 · 一处具名变更**：四道门各拒绝一次，真跑分别念 `CDD_BLOCKED: no-host · no host harness detected (run cdd from within a supported harness)` · `CDD_BLOCKED: carrier · carrier-mismatch · …` · `CDD_BLOCKED: dispatch-input · …` · `CDD_BLOCKED: artifact · artifact-identity · …`；成对：五行既有行与 `dispatch-input` 一行逐字节同改前，`no-host` · `carrier` · `artifact` 三行比改前**多一段站名前缀**（改前三行不带站名、改后带），且三行的 detail 文本与改前逐字节相同（只加前缀、不改措辞）。
- `--dry-run` 上的结构腿拒绝**由预览面陈述**：脏树上三动词各跑一次 `--dry-run` ⇒ stdout 出现预览头 + 一条 `  refused:  <拼装>` 行，`CDD_BLOCKED:` 不出现在任何流上，details 行与 checked 面仍在 stdout，refusal.json 零写入；`in-flight` 有活主的 `--dry-run` ⇒ 仍是 `lock:` 面 + 接管提示、无 `refused:` 行（成对：入口合并前后两个流都被断言）。
- refusal.json **落在被忽略的命名空间里**：在一棵 `.gitignore` 不含 `.kairos` 的临时仓库里拒绝一次 ⇒ `.kairos/cdd/` 下出现 refusal.json（裸词，见 2.1）且 `git status` 干净（标记先于写入发布）；紧接着的第二次派发仍按自己的事实判定，而不是在 `tree-clean` 上被引擎自己写的文件拒掉。

## Constraints

- **零裸函数**：`packages/cdd-engine/src-next` 下不新增 `function` 声明，状态与行为落进类（`check:no-bare-functions` 是门）。
- **pin 写法**：行为断言引模块路径 + 符号名，不引行号；尚未在源树出现的词汇写裸词或进围栏块——反引号即成 pin，未落地即红。
- **单事实单份**：拒绝事实只有一个家（树级记录）；三个面都念记录的两格（`station` · `detail`，3.3），只各自加外层，不各自持有第三份副本。
- **消费面守恒（三条逐字节 + 四处具名变更）**：逐字节不变的是五行既有 `CDD_BLOCKED` 行 · `dispatch-input` 一行（含预览那一行）· 既有 `crashed:` 语义 · `in-flight` 有活主那一臂的 `lock:` 面。具名变更有四处：`no-host` · `carrier` · `artifact` 三行行首多一段站名（3.3），`--dry-run` 上的结构腿拒绝改由 stdout 的预览块陈述（2.4）。本相位新增的消费面因此是：board 的一行 · 新产物文件 · 三个拒绝行的一个前缀 · `--dry-run` 上一个入口与一条流。
- **不留豁免层**：不引入「pre-flight 拒绝走一条特殊路径」的分支——门前的返回本身就是普通路径，拒绝不需要例外。
- **引擎只拒不改**：拒绝不移动、不改写、不删除任何既有产物；门的前移不得让任何已被写的文件变成孤儿。
- **类的规模**：新增类守一条不变量（一树最多一条拒绝事实），方法读作 ≤10 行，参数 ≤4；超过即说明它守了两件事。

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-11-18 | 首稿：S1 归属落定（四门并入 structure 腿 · 拒绝在 recordRound 之前返回 · 树级 refusal 事实 · board 一行 · 四站闭集 · 互斥不变量） | Oscaner M. · Claude |
| v0.2 | 2026-11-18 | 首轮评审回填（F1–F12 全采纳）：① 站名闭集改为 structure 腿的行集（九值，`session/preflight.ts#PreFlightGateName`），九行一视同仁写事实，互斥不变量换成「最多一条 · 通过即清」；② 四行的判定输入与判定点写成条件（只读推演，不建工作区、不写 brief、不在 `--recover` 之后）；③ `--recover` 按改后形面重述（不认领 · 无写入 · 同一拒绝复发）；④ `detail` 规范化 + `CDD_BLOCKED` 自有渲染分离；⑤ 封回与预览镜像的门数写实（三道 + no-host 例外）；⑥ corrupt 行自成一词；⑦ `RoundStatus` 五值 pin 到 `session/ledger.ts#RoundStatus`；⑧ 腿行集加 pin、三个未落地词写裸词；⑨ AC② 八格 + 跨工作区渲染、AC③ 通过即清、AC④ 九值表、AC⑤ 改后形面 | Oscaner M. · Claude |
| v0.3 | 2026-11-18 | 第二轮评审回填（F1–F9 全采纳）：① `INPUT_WAVE_BRIEF` 在声明面上改成它真实的意思——`preview: "satisfied"` 换成 `written: "engine"`，`#inputRefusalOf` 的 `mode` 守卫与 `#answeredByNaming` 的 per-mode 例外一并退场，任何路径都不做存在性读，构造期断言改证「恰好一格引擎写的」；② 四行的输入补齐第四格（主机探测事实由 composition root 注入，seam 不 import face 的 host 模块）；③ 拒绝写入先发布命名空间 keep-out 标记，并声明发布标记不是「建工作区」；④ `--dry-run` 上的结构腿拒绝统一由预览面渲染（整条腿九行，`refused:` 行字节不动）；⑤ `CDD_BLOCKED` 与 board 行改成「一份事实、两条已声明的渲染」，渲染入口按 `preflight.gate` 取键；⑥ `Cli#step` 改 pin 到 `face/cli.ts#Cli#runWork`；⑦ 「同义、同形」改回「同词」；⑧ dispatch-input 的词 pin 到 `CAPSULE_WORDS.dispatchInput.station`；⑨ 去掉 `detail` 的旧名考古；AC 增三条（引擎写的格子 · `CDD_BLOCKED` 字节 · 命名空间标记） | Oscaner M. · Claude |
| v0.4 | 2026-11-18 | 第三轮评审回填（F1–F8 全采纳，F1 / F2 / F4 / F5 四条按裁定落地）：① **一条拼装**——记录只存 `station` + `detail`，三个面（命令行 · 预览的 `refused:` 行 · board 行）都念它，只剩外层不同；先改正「首支不带站名」的事实错误（`DispatchAuthority#message` 今天就是 `reason · detail`，站名已在第一个位置），于是 `dispatch-input` 与五行既有行逐字节不变，`no-host` · `carrier` · `artifact` 三行多一段站名——具名变更，与 changeset 同批登记（F1）；② `INPUT_WAVE_BRIEF` 的改动面写实为该格的全部三处声明（implement · review · fix），构造期断言换论域到槽、三行收进一张 `Record<mode, Row>`；章程同批回填（D96 · Phase inventory · 在册增量），P38 的 spec 追加换向记录（F2 · F3）；③ `detail` 的格与规范化改为「不以站名开头」+ 只去串首站名，in-flight 三条冻结措辞写在明处（F6）；④ `--dry-run` 的拒绝块写实：帧来源（`#peekNext` 在裁决之后才有，pre-flight 点无帧）、形状（`Preview#artifactBlock` 的既有形，不是五行预报）、流（stdout）、随行行的存留（details 行与 checked 面保留）、活主臂的豁免，并新增一条验收（F4）；⑤ 写入与清除点具名（门口写 · `#runDispatch` 入口清，都不进门里），board 读取点与 `in-flight:` 同一处（F5）；⑥ board 形状块补两格缩进（F7）；⑦ 去掉「四行各读一格」的 1:1 说法（F8） | Oscaner M. · Claude |
