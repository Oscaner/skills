---
title: 引擎文档工具（Engine Doc-Tooling）— P22 设计：定级口径 · 派发终态契约 · 活性信号 · Next 收敛
doc-type: phase-spec
version: v0.9
date: 2026-11-03
slug: 2026-10-10-engine-doc-tooling-p22
program: 2026-10-10-engine-doc-tooling
author: "[human] · Claude（kairos:cdd-design [P22] grilling → 本会话落 spec · 2026-11-02）"
parent-version: v2.92
---

## Design

本相位承载六块：**定级口径（#402）· 派发终态契约（#400 ①）· 日志通道与活性换血（#400 ②）· Next 收敛与板面 · 波内任务上限 3 · 消费面义务**。前五块改引擎，第六块只改消费面文本与一条文档结构规则。

**一句话的病根**：引擎在四个面上把「看起来成功」当成了「成功」——review 的定级没有口径（按措辞判，不按后果判）· 派发以子进程退出码 0 当成功 · 活性判官的 workspace 腿由第三方写入自证 · 「下一轮是什么」在三处各算一遍。第六块是编排纪律：波次可以无限大，一次派发塞进十个任务。

**边界（本相位不越的线）**：引擎**不判定级是否正确**（那是 review 孩子的裁量，引擎只发布口径 + 做结构校验）· 引擎**不判断合并与关 issue**（属 skill 面，无命令可判）· 引擎**不复活 child 自述通道**（P11 的「零解析 child stdout」不变）· 引擎**不自造第二套 Next 判据**（Loop-vs-converge 永远由 blocker/warn/nit 计数决定，本相位只把同一答案渲染到四处）。

### 1. 缺口（取证）

#### 1.1 定级无口径（#402）

`session/handoff-schema.ts` 只有结构词汇：`severity` 的枚举 `["blocker","warn","nit"]`，与结论推导（任一 `blocker` → `CHANGES_REQUESTED`，否则有 findings → `REVIEW_FIX`，空 → `APPROVED`）。口径面只有一句 "Calibrate findings by real severity — not everything is a blocker"，四型 `REVIEWS.{wave,branch,spec,plan}.axesGuide` 各挂一次。

实证：同一 run 里同类缺陷被判成不同档——断言依赖随机 id 的字典序（12 跑 6 挂）判 blocker，冷栈 1/3 失败判 warn，三处永远不成立的守卫判 nit；声明的主交付物不存在判 blocker，同一交付物的唯一路由指令指向答不出问题的命令判 warn；预算超 3–7 倍判 blocker，已发布的评分分解与置信度恒等式不一致判 warn；随机密码进入十个受版本控制的文件判 **warn**（最后靠分支终审才捞回）。判定跟着措辞走（does not exist / gate unmet 对 behaviour is inherited / additive / judgement call），不跟后果走。

代价是**升级路径走错**：有 blocker 走 CHANGES_REQUESTED，只有 warn/nit 走 REVIEW_FIX，两条语义的调度与收口不同；被判轻的实质 blocker 只能靠后续轮次或分支终审回收。

#### 1.2 退出码 = 成功（#400 ①）

`face/lifecycle.ts` 把子进程退出码 0 当成功。反例在册：被派发的子进程半途结束回合（把自己派的校验丢进后台任务后退出），退出码 0，handoff 未写、工作树留未提交改动、合并与关 issue 全未执行——**进程退出码 0，实质半途而废**。

同一面上还有三处「白跑的一轮看起来没发生」：`Run#bookkeep` 按子进程自述的 `blocked` 分叉，BLOCKED/TIMEOUT 的轮**不写记录**（于是它既不在账本里、也不在任何后续判断里）· `contractViolationCount` 只在 `handoff-absent` / `contract-violation` 两类崩溃因由上递增（一个「提交了但没交合格证据」的轮不递增）· 载体与记录互为条件（无载体 ⇒ 无记录）。

#### 1.3 活性腿被第三方写入自证（#400 ②）

`face/termination.ts` 的 `Sampler` 读两条腿：进程组累计 CPU（`infra/proc.ts` 的 `ps -o time=`）+ **workspace 最新 mtime**，且**两条都必须可读**（任一 `null` ⇒ `unknown`，fail-open 不杀）。

两个病：

- **mtime 腿不是 child 的证据**。派发期间仓库里任何动静（编排器改文档、别的进程写缓存）都会替子进程证明「它在干活」。实测：子进程零输出、零 CPU 持续两小时，判官始终判 `progress`——因为树在动。
- **CPU 腿在 Linux 上是整秒分辨率**（`ps` 为 procps 时 `-o time=` 只到秒），忙碌子进程的累计时间可能被读成零增量；本地 macOS（百分秒）全绿、CI 红即此。已有 pin 用 5s 窗口绕过它，但那是把测试面调安全，不是把判据修对。

#### 1.4 「下一轮是什么」三处各算一遍，且计数表可被绕过

今日三处读法（实测，全在 `packages/cdd-engine/src-next/`）：`face/capsule.ts` 的 `Capsule#routeText` → `NextStepRouter.resolve`（本轮 `next:` 的现实渲染面，`emit` 的 `next:` 分支在 `:118-121`）· `face/gate.ts#lineGate`（`:52`，用命令自己的 face 推 `reviewLead` 再比动词，自指）· `face/board-view.ts` 的 `NextStepRouter.walk`（`:555`，每线 walk 到 `next:` 行）。三者共享输入却不共享事实，同一棵树上可以同时印出互相矛盾的下一步。`NextStepRouter.resolve(active, key, targetLineOpen?)` 那个补丁参数（`targetLineOpen` 的声明、传递与唯一使用点都在 capsule：`:103` / `:120` / `:131` / `:141`）就是分裂的物证。

**旧链的教训（本相位必须写进验收）**：被 reset 的旧 P22 把 `next:` 改成由 route kind 反推（`hopOf(route.kind)`），于是 **Loop-vs-converge 不再由 blocker/warn/nit 数量决定**——这正是用户点名的「被改坏」之处。本相位把转移表逐行进 pin，收敛只做「同一答案渲染四处」。

#### 1.5 波次无上限

`NextStepRouter#close` 把整个 ready frontier 一次发成一个 wave（`tasks: ready.join(",")`）。frontier 有十个任务 ⇒ 一次派发十个；任务越多，一轮 review 的评审面越大、一轮 fix 越难收口，失败面被放大十倍。

### 2. 定案：定级口径（#402）

#### 2.1 四问口径 = 一段共享片段（两个插槽）

口径落成 `render/templates.ts` 的**一个**共享常量（`SEVERITY_RUBRIC`），四型审查判据体**引用同一片段**，不各写一份。片段带两个插槽：**主语**（被评审产物名：artifact / spec / plan）与**受众**（判「沉默」的主体：user / downstream author / implementer）——今日四份 `axesGuide` 的收尾段（"The reviewed artifact is a vision … earns the rest of the report trust."）逐字重复四遍、只差这两个词，随片段一并收掉。

片段正文（英文，消费面文案；spec 只钉语义与插槽）：

- **任一条命中即 blocker**——(a) 声明的验收门 / 契约 / 提示词被违反；(b) **合法输入逃出声明的失败面**（纯空白输入打成 500、未知 id 不是 404）；(c) **门失效或套件根本不可能红**（惰性 grep · 死守卫 · 无条件 skip）；(d) **安全或隐私缺陷**。
- **契约内的债 → warn**：重复策略、过期 docstring、缺一条覆盖用例。
- **风格 / 命名 / 换行 → nit**。
- **四句保留义务，随片段一行不落**（今日四份收尾段的**完整替代**，插槽只有两处）：① 段落开头的「按真实严重度校准，不要什么都判 blocker」（`Calibrate findings by real severity — not everything is a blocker`）；② **沉默不是许可**——`The reviewed {artifact} is a vision, not an exhaustive enumeration — behavior it is silent on is judged by what a reasonable {audience} would expect; its silence is not permission, and a finding's severity grades that expectation, not whether the text mentions the trigger.`（插槽：`{artifact}` = artifact / spec / plan · `{audience}` = user / downstream author / implementer）；③ **set-aside 清单**——`Before your verdict, list every behavior you considered and set aside as outside the reviewed scope — one line each with the reason; nothing set aside is dropped silently; an empty list means you set nothing aside.`（无插槽）；④ 结尾的「先承认做对了什么」（`acknowledge what was done well before listing findings`）。
- 四问是口径，②③④ 是**活跃义务句**——它们不并入四问，但必须随片段出现在四型判据体里；否则「收掉四份副本」会连义务一起从四型 prompt 里删掉（§2.1 的验收面因此按「片段 = 今日收尾段的完整替代」写）。

**类型不是口径**：`severity` 的枚举、`FindingSeverity` 类型、结论推导（`blocker → CHANGES_REQUESTED` · `warn/nit → REVIEW_FIX` · 空 → `APPROVED`）、router 按 `blocker` 计数的分流，**一律不动**。本条禁的是「没有口径」，不是这个类型。

#### 2.2 同档一致性（义务层，零新字段）

同一 run 内**同一类缺陷已判过的档为前档**，跨档必须在该 finding 里点名理由。落成 2.1 片段的**一句**，位置在 ④「先承认做对了什么」**之前**（片段的末句仍归 ④，§2.1 的收尾顺序不动）——**不引入 `category` / `class` 字段**，不做跨轮定级比对机件（旧链的 `rounds` scope 漂移规则、`SummaryFingerprint` 归一化、用户裁定清除路径，全部不进本相位）。理由：reviewer 声明类别 = 声明再抄，且换措辞即可绕开；误报（合法改档）还必须给豁免口，最终仍回人裁。

#### 2.3 回读后缀的词面对齐

`session/next.ts` 的 `FIX_READBACK_SUFFIX` 由

`(confirm the findings · if a finding needs a ruling, record the ruling in the findings file)`

改为

`(confirm the reviews handoff · if a finding needs a ruling, record the ruling in the handoff file)`

三处同批：常量本体 + 运行时断言（`session/__tests__/next.test.ts` 的两条断言）+ **编译期字面类型 pin**（该测试把常量声明为逐字字面类型，改错即 `tsc --noEmit` 红）。常量 jsdoc 里「the findings file the fix round consumes」同句改为「the reviews handoff the fix round consumes」。

**裁定的合法落点（与 §3.4 的只读面同批成立）**：后缀里的 `record the ruling in the handoff file` 指**请求方 reviews handoff 的 `notes`**——它是 `session/handoff-schema.ts` 的 `CARRIER` 已声明的 both-plane `array<string>` 槽，裁定以**追加一行**写入；`findings[]` 的 `summary` / `severity` / 条数**永不改写**，故 §3.4 的精确匹配键集跨裁定稳定。裁定不是第二份载体、不是对评审载体的语义改写，也不新增槽。

**历史不改写**：冻结文档里的旧字节（旧 spec / 旧 change-history 行）原样保留，故本条的 pin 只落在 `packages/cdd-engine` 的代码与测试面。

### 3. 定案：派发终态契约（#400 ①）

#### 3.1 两段形态：先裁决，后分流

每轮派发结束先写**终态裁决** `{ treeClean, targetAction }`，再按违约族分流 gate。裁决是记录上的结构化事实，故「这一轮判过什么」永远可回读，不靠散文。**两段都在派发之后**；派发前的门（`tree-clean` · `in-flight` · `graph` · `plan-ledger` · `wave` · `doc-contract`）位置与判据不动（§3.5）。

#### 3.2 完成判据按 verb 注册

判据是一份**契约 + 一个注册表**（`CompletionCriterion` 接口 + 按 verb 的注册表；plane 由既有 `planeOf(op)` 派生，branch review 折算 `review`）。判据回答的永远是「引擎自己能证明的事实」，child 自述不作凭证。

| verb | 完成判据 |
|---|---|
| `implement` | **该组基线以来有提交**——组基线 = 该组**最早一条轮记录的 `dispatchBase`**（`dispatchBase` 是派发前的 HEAD，`face/lifecycle.ts` 本来就在为崩溃尸检捕获它；本相位把它写进轮记录，组基线由记录派生，零新格）；判据 = `GitClient.commitsSince(组基线)` 非空。基线属于**组**、不属于轮：一个组的所有 attempt 共享它，故「被杀 attempt 已提交、重派零新提交」不会被误判成空转型 |
| `fix` | **逐条处置**——该轮 work 载体的 `dispositions` 覆盖请求方 review 载体的每条 finding（§3.4） |
| `review` | 本轮 findings 载体**存在且 schema 合法**——`{"findings": []}` = APPROVED，是批准载体，不是违约 |
| branch review | 同 `review`（branch findings 载体） |

#### 3.3 违约分级：hard / soft

**hard（空转型，当场判该轮失败）**：`implement` 组基线以来零提交 · judge plane 载体缺失或 schema 非法（`findings` 缺失或非数组） · `fix` 的处置判据不成立（§3.4 的六类） · **证据门**（`{line}-test-evidence.json` 缺失 / malformed / 违约契约——今日它把状态改写成 `BLOCKED`，本相位它成为该轮的一条 hard 违约，三条既有可观测后果〔非零退出 · 可重派 · 提交与树事实照记〕逐条保留）。

hard 的后果：`exit` 非零 · `verdict.targetAction === false` · **照常入账并消耗身份槽**。判据不成立时由 `#verdictOf` 自书一条 hard 条目（复用既有 `contract-violation` 因由，零新违约枚举），故「失败」永不是一次静默的缺席。

**hard 的呈现面**：hard 裁决的 stderr 报文与「被拒 / 被杀」的轮共用同一条行——`face/lifecycle.ts` 的 `#cutShort` `CDD_BLOCKED` 行（`:715`），报文带该轮日志路径（§4.1），故零提交的 `implement`、处置不成立的 `fix` 也能只凭 stderr 诊断；capsule 的 `status · blocker · handoff` 三键字节面不变。

**soft（收拾类，只记账）**：`implement` 的 handoff 载体缺失（`fix` 的处置载体属 hard，见 §3.4）· 其余卫生项。soft 写进该轮记录的 `violations` 并随报文告警，**不进 gate**（既有语义本无阈值机制，本相位不虚增）。

**树脏不单立条目**：工作树干净已由 `verdict.treeClean` 承载；soft 族里那一条由该字段派生（每轮至多一条），不另写一条同义记录——同一事实一个结构。`verdict.targetAction === true` ⇔ 完成判据成立**且** `violations` 里没有 hard 条目（hard 胜，判据表与违约族不各判一次）。

**派生计数只数 soft**：既有 `contractViolationCount` 的持久化标量退役（旧 `progress.json` 里残留的标量**只读忽略**，由记录派生重新起算——不迁移、不改写历史文件），读面改为「各轮 `violations` 中 soft 条目数 + 由 `treeClean === false` 派生的一条」，出口仍是 `counterOf` 一处；hard 以该轮的失败裁决呈现（exit 非零 + `targetAction: false`），不以计数呈现。**覆盖面变化明示**：judge plane 的 `handoff-absent` / `contract-violation` 由「计数 +1」改由轮裁决呈现；work plane 的 `implement` 载体缺失仍记 soft（+1）；树卫生（`treeClean === false`）首次进入该计数。

#### 3.4 fix 的逐条处置（简化版）

- **载体槽**：work 载体新增 `dispositions`（`session/handoff-schema.ts` 的 `CARRIER` 声明 + `PLANE_SLOTS.work` 收入；`PLANE_REQUIRED` 不动——「缺失即不成立」由判据自证，不改写成 verb 表，否则 `implement` 也会被要求交处置）。
- **键**：请求方 review 载体每条 finding 的 `summary` **原文精确匹配**（不做归一化、不做指纹、不引入相似度）。同一载体里措辞重复的两条 finding 按**去重后的集合**判（同一缺陷只欠一条处置）。
- **值**：`{ [summary]: { status: "fixed" | "rejected", reason?: string } }`（`rejected` 必须带理由，`fixed` 可省）。形状钉死，不留「数组还是映射」的猜测。
- **请求方载体只读**：输入集的唯一真相是请求方 review 载体的 `summary` 原文，fix 轮不得改写那份载体——故精确匹配稳定；真的匹配不上（例如 review 载体被外部改动）落 hard 并点名该键，是**可见失败**，不是静默跳过。
- **六类 hard**：① 该轮 work 载体缺失 ② `dispositions` 槽缺失 ③ 键集与输入集**不等**（缺条 / 多条）④ 键不属于输入集（点名未知 finding）⑤ **输入侧缺失**——请求方 review 载体缺失或不可读 ⇒ 同属 hard 并点名其路径（「证据不见了」不等于「没有 finding」，判空会把恒通过判据放回来）⑥ **`rejected` 缺理由**——声明的值形状要求理由，与 ② 同属**形状违约族**，同样当场判 hard。
- **裁定与只读的分界**：fix 轮对请求方 review 载体的唯一合法写入是 `notes` 的**追加**（§2.3 的裁定落点）；`findings[]` 的 `summary` / `severity` / 条数**零改写**——故精确匹配稳定，键集不等与「载体被外部改动」仍判 hard。
- **空输入**：请求方载体在盘且 `findings` 为空数组 ⇒ 输入集为空 ⇒ 要求 `dispositions` 存在且键集为空，并落一条 soft 观测（空输入是合法输入，判失败会让一次合法派发凭空失败）。
- **零提交**：`fix` 轮零提交**不**判 hard（判据由载体回答，不由 diff 回答），只落一条 soft 观测，文案沿用既有零提交告警常量。
- **汇总行**：`fixed N · rejected M` 由 dispositions 与输入集现算，不落盘、不加第二份读面、不进 capsule（§2.2 的口径不动）。

#### 3.5 入账即事实：记录 → 状态，单方向

- **已派发的轮无条件入账**（有帧身份、有 child、有终态裁决即写一条轮记录）。`Run#bookkeep` 的 `blocked` 谓词退役——BLOCKED/TIMEOUT 不再意味着「不记录」。
- **修订回写以裁决为门**：`review` / branch review 完成时的三个回写（doc · wave-brief · branch，今日与 `recordRound` 同处 `!blocked` 分支：`session/run.ts:495-512`）改由 `verdict.targetAction === true`（即该轮在 `completedCycles` 里）为门。hard 失败的 review（载体缺失 / schema 非法）**不得**绑定当前修订——否则漂移身份被静默关掉，正是本相位要治的「白跑的一轮看起来没发生」。
- **保留载体不覆盖规则**：`outcome.carrier === undefined` 的失败轮仍不写载体，child 的草稿原样留盘（那是**载体**的写事实，与**记录**的写事实分家）。
- **`rounds` 从 `Record<mode, number[]>` 整体重写为逐轮记录数组**：每项 `{ op, cycle, attempt, dispatchBase, verdict: { treeClean, targetAction }, violations, carrierPath }`。周期号、重派序号、派发基线、裁决、违约、载路径同住一条记录——一个事实一个结构。读期兼容旧两形（mode 键的周期号对象 · 纯数字），新写只写新形。
- **「完成」不是成员资格，是裁决**：需要「这一轮成功了吗」的读面读 `verdict`，不读数组长度、也不读「该 cycle 在不在册」。完成访问器 `completedCycles(key, op)` 只取 `verdict.targetAction === true` 的记录；`roundRecorded` 仍回答「该 cycle 已派发」，两者不等价。
- **读面按它问的事实分四类**（同类读法一致，不各写一遍）：① **完成问句**——`Ledger#pendingFix`（`session/ledger.ts`）· `WaveGate#phaseOf` 的 implement/fix 相位读（`session/wave.ts`）· `Ledger#rowClosed` · `Ledger#orphanHandoffs` · 预发门的 `recordedTasksOf`，一律读 `completedCycles`；② **派发编号分配**——`Run#reviewCount` / `#roundFor` 的 review 腿读**全部在册 cycle**（入账即消耗编号），`attempt` 由命名单源分配（该 cycle 已入册的最大 attempt + 1）；③ **活跃跳的承载轮**——只取**最新完成轮**（拿硬失败的轮当承载轮会让 `round()` 读不回，把该线永久搁死）；④ **显示读面**——`board` 读全部在册记录并显示每轮的裁决（hard 违约轮照常出现在板上：它已入账、已消耗身份槽，藏起来正是「白跑的一轮看起来没发生」），`--dry-run` 只描述本次将追加的那一条**轮记录**——今日的既读面原样保留（`face/preview.ts` 的 `orphanHandoffs()` 孤儿草稿行、`#recordsOf` 用 `reviewedRevision` 决定的 `would record:` 行），本相位不增不删这些读面；「零日志」是 §4.1 的日志面限制，不是记录面禁令。
- **重派语义由「算出的 cycle 是否已入册」决定**：已入册 ⇒ 重派，同 cycle 取 `attempt + 1`，绝不覆盖失败轮记录；未入册 ⇒ 新的一轮，attempt 从 1 起。`implement` cycle 恒 1（重派靠 attempt）· `fix` cycle = 该行最新**完成** review 的 cycle（失败的 fix 不推进它 ⇒ 重派是 fix-K 的 attempt + 1，不是凭空造出 fix-(K+1)）· `review` / branch review 重派前进 cycle（该 cycle 的 attempt 恒 1）。
- **退出码不再是唯一进程信号**（取代 P11 那半条）：退出码仍被读，但它只是判据之一、不等于成功；P11 的另一半（撤结构化 Return、零解析 child stdout）不变。

#### 3.6 脏树的分界（只裁派发之后）

**派发前**的 `tree-clean` 硬门**不动**：它是 `PreFlight#vet` 的首位门，三个派发动词共用，脏树在任何 child 派发之前即以 `gate: 'tree-clean'` · `reason: 'dirty-tree'` 拒绝，P12 / P21 已 pin，行为与字节面原样保留。本节只裁**派发之后**：一轮收工时工作树干净是**记录里的观察裁决**，不构成终态裁决的 gate（合并与关 issue 属 skill 面，引擎无命令可判）。故「树脏 ⇒ 本轮非成功」不由引擎回答，也**不取消**任何既有门。

### 4. 定案：日志通道与活性换血（#400 ②）

#### 4.1 每轮日志文件

- **通道**：三个派发动词（`implement` / `review` / `fix`）一律 `stdio: pipe`；`inherit` 永不用于派发。child 的 stdout + stderr 落**每轮日志文件** `.kairos/cdd/<slug>/logs/<stem>.log`（`gitignore`），**只落文件、不回显**——引擎输出面零变化（capsule 的 `status · blocker · handoff` 行不被淹没）；**指路只在 stderr**：失败报文点名该轮日志路径——落点是 `face/lifecycle.ts` 的 `#cutShort` `CDD_BLOCKED` 行（`:715`，由 `#reject` 到达，写 crash 记录 + 报文），即一轮被拒 / 被杀时消费者实际看到的那一行（不是 `face/cli.ts` 的 `#slugBlocked` slug 拒绝面：`CDD_BLOCKED` 站行有多个，诊断面只认能看见轮次的那一个）——capsule 的 `next:` 行与其 `status · handoff` 两键**与日志通道无关**（§10 的字节变更只删 `blocker` 格、不动这一条）。这就是消费者唯一需要的指路。
- **文件名**取该轮 report 的 stem（与 `RoundNaming` 同源）：doc line `{type}-{op}-{round}.log`，wave/branch line `{family}-{op}{-round}.log`（`implement` 不带轮号）。**重派带 attempt**：`attempt > 1` 时 stem 加 `-a{attempt}`（如 `tasks-1-fix-1-a2.log`），故「只增不改」对重派同样成立——attempt 1 的日志不被 attempt 2 覆盖。
- **spawn 之前创建**（append 流已打开、零字节），故日志腿从派发的第一毫秒起就是**已读且静默**，不是 `null`——恒不写字节的 child 因此走得到 `stalled`，而不是停在 `unknown` 等预算。
- **收尾顺序是通道契约的一半**：child 退出后 **drain → close** → 任何对本轮日志的读取都发生在 close 之后（append 流的尾字节可以晚于退出事件落盘）。事后诊断面成立的前提是本轮日志**完整**。
- 日志保留全部轮次、不做轮转；`--dry-run` 不派发，故不落日志。
- **创建失败（权限 / IO）**：落一条 soft 观测并点名路径，该轮退化为 **CPU 单腿**（日志腿 `null` 不压制判定，§4.2）——不因记录面不可写而杀掉一个真在工作的 child，但失败**可见**。

#### 4.2 两条 child 自身的腿 + 四态真值表

**信号契约 + 注册表**（`LivenessSignal` 契约，两个实现）：`LogGrowth`（日志文件 size / mtime 增长——零解析，只观测字节到达）· `CpuAdvance`（进程组累计 CPU **前进**，附加腿）。两腿同级取或：**任一腿前进即 `progress`**。

| 窗口里的事实 | 裁决 |
|---|---|
| 任一腿明确前进（日志 size/mtime 增长 · CPU 越过上次读数） | `progress` |
| 无腿前进，**至少一条腿可读**，idle 未满 30min | `idled` |
| 无腿前进，**至少一条腿可读**，idle 满 30min | `stalled`（组杀） |
| 无腿前进，且**没有任何一条腿可读** | `unknown`——fail-open，不杀 |

**必需可读性只剩一条**：任何单腿的 `null` 都不再阻塞判定——CPU 读不到（`ps` 不可得）既不贡献前进、也不贡献未知、更不阻断 stall；`unknown` 的唯一触发条件是「整窗内没有一条腿读得到」。**阈值不变**（采样 60s · idle 30min），四态词一个不删，不新造预算矩阵。

#### 4.3 撤 workspace-mtime 腿，及其连带的排除面

- 删 `Sample.newestMtimeMs` 与 `Sampler` 的树步进（`#newestMtimeMs` · `MAX_DEPTH` / `VCS_DIR` 扫描面）；删 `Sampler.excludesFor` 与排除集——它们只为树扫描而存在。**副作用是好的**：「引擎自己的写入不得自证 progress」从此是**结构事实**（两条腿都不看树），不再是一条声明。
- `CpuAdvance` 读 `infra/proc.ts` 的组 CPU，`ps` 仍只住那一处，边界不扩。
- **接受的限制**（写进验收）：阻塞在单次长网络调用上、30 分钟不产出任何字节的子进程会被杀；该情形不视为合法任务。烧 CPU 但不写文件的长轮次**不会**被杀（CPU 腿仍算前进）。

#### 4.4 崩溃尸检面

`CrashRecord` 保留末次采样（裁决 + 两条腿的读数 + 时间）+ **该轮日志路径**。半死轮次的事后诊断从「只能外部 `ps`」变为「打开一个文件」。

### 5. 定案：Next 收敛与板面（计数表不可破）

**核心理念（不可破）——分级判收敛**：CDD 按 findings 的分级向前推进——review 交出的 findings 按 blocker / warn / nit 分级，**有 blocker 就把线推回 fix 并重新评审，只有 warn/nit 时以 `REVIEW_FIX` 收敛，全空即通过**，连续 `REVIEW_CYCLE_CAP` 个 blocker 周期触软上限交人裁定。这不是某一条实现细节，而是本程序的方法论主轴：`docs/diagrams/src/next-loop.{en,zh-CN}.json` 画出**全部三条**（三格 + 两条边 + `连续 N 个 blocker 周期 → 软上限`），`architecture.{en,zh-CN}.json` 画出前两条（blocker 回合与 `REVIEW_FIX` 收敛）；四份图合起来覆盖全部三条（`blocker · warn/nit · 无` 三格 · `评审有 blocker · 重新评审` 与 `仅 warn/nit · 以 REVIEW_FIX 收口` 两条边 · 连续 `REVIEW_CYCLE_CAP` 个 blocker 周期 的软上限）。图侧陈述与常量同值；**该常量的值以章程裁定为准**（v2.94 / D70 已按用户裁定抬至 50，本相位承接该裁定、不再复述数字），孪生 pin 断言「图侧周期数 == `REVIEW_CYCLE_CAP`」，故将来改常量时图与 pin 同时红、spec 正文不抄数字。§2 的定级口径与本节的分级转移表是**同一件事的两半**：**口径让计数有意义**（没有口径，blocker/warn/nit 只是噪声），**计数是推进的唯一判据**（没有计数，口径无处落地）。因此本相位禁止任何形态的第二判据：不得把下一跳改由 route kind 反推、不得让文档漂移抢在未闭合线的 blocker 之前、不得引入新的分级信号——被 reset 的旧链正是这样坏的。

#### 5.1 转移表：Loop-vs-converge 只由 blocker/warn/nit 数量决定

| 上一轮 | 该轮产物 | 下一跳 |
|---|---|---|
| 无 | — | `review`（线未进入） |
| `review` | `blocker > 0` | `fix`（带本次载体为 `reviews`） |
| `review` | `blocker == 0` 且 warn/nit > 0 | `fix`（建议项也修；**修完不进 re-review**——`#278` 的 REVIEW_FIX 收敛） |
| `review` | 全 0 | 闭合 / 下一跳（ready batch 决定 `next-wave` 或 `done`） |
| `fix` | 请求的 review 含 blocker | `review`（重审是「blocker 已消除」的证明） |
| `fix` | 请求的 review 无 blocker | 闭合 / 下一跳 |
| branch review | findings | `fix` |
| branch review | 全 0 | 闭合 / 下一跳 |

请求轮与 fix **同 cycle**（fix-K 回答 review-K），故「请求是否含 blocker」是**已记录事实**，不新增字段。**分级 fail-closed**：`severity` 只认三档，出现其它值即载体 schema 非法（该轮不成立、hard 违约），绝不把未知严重度读成「非 blocker」而静默闭合。软上限（`REVIEW_CYCLE_CAP` · `SOFT_CAP_SUGGESTION`）仍只是**预算**，不是收敛机制；该常量的**值**以章程裁定为准（v2.94 / D70：用户裁定抬至 50），本相位承接而不重新裁定；spec 与 §5 一律引用常量名、不抄数字。

这条表**不许任何形态的重写**：本相位的收敛只做「同一答案渲染四处」，不改判据（旧链把判据换成 route kind 反推，是本相位点名要避免的回归）。

#### 5.2 一个派生、四读面

```text
NextHop {                                   // session/next.ts 的新增类型
  face:   PipelineKey | null                // 面轴：复用既有键 phase-spec | overall | plan | wave | branch（null = 无在册线）
  hop:    "implement" | "review" | "branch-review" | "fix" | null    // 线轴：面内下一跳
  to:     PipelineEntry | null              // 面间轴：面已闭时的交接站（复用既有 PIPELINE_NEXT 行类型）
  route:  Route | null                      // 渲染载荷：派生出的那条 Route（`next:` 字面的事实源）
  reason: string                            // 选中它的那条具名事实（单一文案表：doc-drift / pending-fix / doc-class-blocked / closed-line / face-closed / soft-cap / task-open）
}
```

- 两个类型都**复用既有声明**：`face` 用 `PipelineKey`，`to` 用 `PipelineEntry`（`session/next.ts` 已声明，就是 `PIPELINE_NEXT` 的行类型）——不引入 `StationRef` / `PipelineFace` 这类新名字。
- `hop` 与 `to` **互斥**（面内 vs 面间），两条轴不拍平。
- **`route` 是渲染载荷，不是第二份判据**：`next:` 字面由 capsule 与 board 共用的唯一渲染器 `face/route-render.ts` 从这条 `Route` 渲染（capsule `face/capsule.ts:141` · board `face/board-view.ts:522`），`next-wave` 的 `--tasks <ids>`（`route-render.ts:88`）与 `fix` 的 `--reviews <path>`（`:151`）都住在这条 Route 上——故载荷不复制进 `hop`（`hop` 只是 `route.kind` 的读出），`to` 只承载面间交接。
- **判据仍在 `NextStepRouter.next`**（§5.1 的计数表）；`hop` 由它产出的 `Route` 的动词**读出**，映射表按 `Route` 的六值**逐值钉死、零漏分支**：

  | `Route` kind | `hop` | `to` |
  |---|---|---|
  | `next-wave` | `implement` | `null` |
  | `review` | `review`（branch 面为 `branch-review`） | `null` |
  | `fix` | `fix` | `null` |
  | `soft-cap` | `null` | `null`（`reason: soft-cap`） |
  | `done` | `null` | 经 doc-class 判别取 `PIPELINE_NEXT[key]` |
  | `handoff` | `null` | 该 `Route` 自带的 `entry` |

  `done` 与 `handoff` 的 `to` 是**同一条取值路径**：`done` 的判别产物就是 `handoff` 的 `entry`（今日 `Capsule#routeText` 先做 doc-class 判别、再交 `resolve` 折成 `handoff`），故 `to` 不各算一次。判别逻辑与 `Capsule#docClassOf` **同源**（读声明的那一份是 `BoardView.readDocType`），由 capsule 经构造注入给派生器；判别出 `blocked` / `terminal` 时 `to: null` 并带 `reason`（`doc-class-blocked` / `face-closed`）。这**一处**常量映射只做呈现，**不得**反向影响判据（旧链的 `hopOf(route.kind)` 之所以坏，是因为判据被搬到了路由渲染的一侧）。
- **一处派生、每次调用一次**：`NextStepRouter#nextHop`——**既有类 `session/next.ts` 上的新方法**（不新增类、不新增文件）——**按每次调用、按每线解析一个 `NextHop`，不缓存、不跨调用共享**（`board` 每线一个 · `#lineGate` 派发前一个 · capsule 在一轮收工、记录写入之后调用，故本轮自己的记录自然计入，轮的 `next:` 与 `board` 不差拍）。派生只**读**该线既有的输入事实，不在渲染侧另算第二份判据：

  | 该线的输入事实 | `route` / `hop` | `reason` |
  |---|---|---|
  | 未进入（无在册轮） | `review` / `review` | `task-open` |
  | ready batch 非空（线在推进） | `next-wave` / `implement` | `task-open` |
  | 最新完成轮是 review 且交回 blocker 或 warn/nit | `fix` / `fix` | `pending-fix` |
  | 最新完成轮是 review 且全 0（线闭合、事实无漂移） | `done` / `handoff`（`hop: null`，`to` = doc-class 判别产物） | `closed-line` |
  | 闭合后文档被改动（drift 感知 gate 判开） | `review` / `review` | `doc-drift` |
  | 连续 `REVIEW_CYCLE_CAP` 个 blocker 周期 | `soft-cap` / `null` | `soft-cap` |
  | doc-class 判别 `blocked` / `terminal` | `null` / `null`（`to: null`） | `doc-class-blocked` / `face-closed` |

  三个输入源：① 该线 **drift 感知的 gate 裁决**——今日由 `Run#targetLineOpen` 经 `Ledger#reviewGate` 现算（`session/run.ts:285` · `:630-637`），派生器读同一裁决、不复制判据；② 该线**最新完成轮**（§3.5 ③ 的 `completedCycles` 口径，硬失败轮不当承载轮）；③ **计数状态**（§5.1 的 blocker/warn/nit 计数 + `REVIEW_CYCLE_CAP`）。`targetLineOpen` 这个补丁参数随 `resolve` 一并消失（§5.4），但**它承载的事实不消失**——事实迁进派生器的输入面，`doc-drift` / `pending-fix` 因此仍有产出者。
- **四读面 + 一处报文，同一个对象**：
  - ① `Capsule#routeText` / `emit`（今日走 `NextStepRouter.resolve`，带 `targetLineOpen` 补丁参数）：改读注入的 `NextHop` 渲染 `next:` 行，`targetLineOpen` 参数消失。
  - ② `face/gate.ts#lineGate`（今日自指推演）：删自指，读同一 `NextHop` 的 `hop`。
  - ③ `face/board-view.ts` 的每线 `next:` 行（今日 `NextStepRouter.walk`）：接收注入的 `NextHop` 并渲染（不持账本、不自推、不比修订）。
  - ④ 生命周期前沿 `Run#peekNext`：读 `hop`。
  - 报文一处：CLI 的拒绝报文渲染 `reason`，与读面同取一个对象。形态由两轴决定：`hop` 非空 ⇒ `<reason> · the next round is <hop>`；`hop` 为空且 `to` 非空（面已闭、有交接站）⇒ `<reason> · next: <to>`（`to` 经 `face/route-render.ts` 同一渲染）；`hop` 与 `to` 皆空（`soft-cap` · `doc-class-blocked`）⇒ 只渲染 `reason`，不造动词槽。
- **`PIPELINE_NEXT` 降为数据**：它声明管线形状（面顺序 + 每面交接站），是配置不是判断；判断只剩一处。
- **命名**：本相位**不改**值域类型名（不做 `RoundPhase → Hop` 的全库改名）；`hop` 的值域就是四个派发动词（`branch-review` 沿用既有 `ReviewLead` 的词）。

#### 5.3 板面排版重设

`board` 的默认面按 verb 聚合轮次与裁决（**只按 verb 聚合、不逐轮展开；异常 `✗` / `+N` 在令牌上标出**）：

- 令牌形 `{label} {count} {mark}`，裁决符**不可省**（`review 10 ✓ · fix 10 ✓`）；`✓` / `✗` 由该轮裁决决定。
- findings 数只以 `+N` 后缀出现且 `N === 0` 时省略（`review 3 ✓+2` · `review 3 ✗` · `review 3 ✗+3`）；**不出现 blocker/warn/nit 三元拆分**（capsule 不加计数、板面也不加——§2.2 的口径只在 prompt 里）。
- **区间形永不出现**（`review 1–10 ✓` 这种形即红）：本相位**不引入 `--verbose` 旗标**（今日旗标表零 `--verbose`），区间折叠随 `--verbose` 网格一并留在 charter 的非目标里；本句即取回依据的登记面（整板排版重设按 D69 ③ 取回，`--verbose` 网格不取回）。任一令牌缺裁决符即红。
- 重派带 attempt 上标（`fix 1 ✗ · fix 1a2 ✓`），`attempt === 1` 不加后缀（出现 `a1` 即红）。
- 省略目录、`next:` 用**相对路径**；列宽与版本列对齐；在飞行只留身份（`op` + cycle + attempt）。
- hard 违约轮照常在板上（§3.5 显示读面）。

#### 5.4 删除面

- `NextStepRouter.resolve` 与 `walk` 两个入口塌成一个派生（`targetLineOpen` 补丁参数随之消失——合并后派生器自己去问 branch 线）。
- `face/gate.ts#lineGate` 的自指推演（用命令自己的 face 推 `reviewLead` 再比动词）删除，改读同一个 `NextHop`。
- `#targetPhase` / `#lineFixRoute` 一类的二次推导删除。

#### 5.5 pin

三条行为 pin + 一条跨面 pin：① warn/nit-only 的 fix 之后 `next:` **不得**是 `review`；② 未闭合线上留 blocker 时 `next:` 仍是 `fix`（`drift` 不得胜出）；③ 闭合之后再改文档 ⇒ `next:` 必须回到 `review`（漂移能力不退化）；④ 对任一状态，`board` 的 `next:` 动词 == CLI 拒绝报文点名的 hop == 实际可派发的动词（跨面，单面自测封不住）。

### 6. 定案：波内任务上限 3

- **上限是代码常量**（`MAX_TASKS_PER_WAVE = 3`，与 `REVIEW_CYCLE_CAP` 同款：零环境变量、零配置、零落盘）。
- **形态 = 硬门，不是派生**：引擎**不切块、不截断、不重排**波次——波次形状是作者的声明（`DependsOn`），引擎只判它合不合规并拒绝越界。引擎若替作者分批，就是把依赖声明悄悄重新解释（那是旧链的做法，本节明确不做）。
- **判据面一：计划面（预防，作者在此修）**——`contract/rules.ts` 的 `doc` scope 增一条规则（`docKeys: ["plan"]`，规则 id `wave-width-at-most-three`）：由计划正文派生 `TaskGraph#batches()`，**任一依赖层（batch）的成员数不得超过 `MAX_TASKS_PER_WAVE`**；越界即规则红并点名该层的任务 id。计划评审（`cdd review --type plan`）就是修 `DependsOn` 的地方——把同层任务串成链（例如让后两个依赖第三个），层级自然拆开。
- **判据面二：派发面（执行，硬门）**——`WaveGate.vet`（今日 `open = frontier(closedWaves())` 的升序全量）新增两条拒绝，插在**既有 `mixed-batch`（`session/wave.ts:100-119`，带 append 豁免）之后、`exact`（split）之前**（今日门序：`mixed-batch` → `exact` → `wrong-phase`）。次序是判据的一部分：混合批次形态保留它自己的原因，5 宽 frontier 的期望原因是 `wave-too-wide`（不是 `split`）。
  - `open.length > MAX_TASKS_PER_WAVE` → 拒绝，原因 `wave-too-wide`，文案点名该波的任务 id 与唯一修复路径（`at most 3 tasks per wave — narrow the wave by adjusting the plan's DependsOn`）。这条是**病因点名**：若不先判，同一形状会被既有的 split 门报成「requested ≠ open」，把作者引向错误的修法。
  - `requested.length > MAX_TASKS_PER_WAVE` → 拒绝，原因 `too-many-tasks`，文案点名上限（不猜、不截断、不静默减半——截断会把调用者的手选当成引擎的判断）。
- **`next-wave` 不截断，且它的字面必被波门接受——只在成立条件内**：`#close` 仍渲染全量 ready batch（`frontier(closedWaves())`）。断言收窄为：**当闭合集 = 当前图完整依赖层的并集时**，`next-wave` 的 `tasks` 恒 ≤3 且必被波门接受。越出该条件有一条可达路径——P21 的 append 形态（同批追加成员，`session/wave.ts:100-118` 的 `#appendedSinceClosure`）允许一层只闭了部分成员，此时 frontier 跨两层并可 >3（合规例：层 `{1,2,3}` 与 `{4,5}`，done=`{1}` ⇒ frontier `{2,3,4,5}`；`closed-wave-fits-depends-on-layers` 只判「闭合波 ⊆ 某层」，`contract/invariants.ts:347`，故放行该形）。该形态是**派发门的显式拒绝**——`wave-too-wide`，报文点名 id 与 `DependsOn` 修法，绝不静默截断、不重排。因此：计划面的层级规则是**必要不充分**条件；`next-wave` 不是「恒被接受」，而是「完整层并集上的闭合集恒被接受，部分闭合的跨层 frontier 被显式拒绝」。这**不是** P21 §4.2 禁的「引擎明知不可执行还发」：那条禁的是引擎自己在正确输入上算错；这里输入本身违规（计划形状越界 / 部分闭合），引擎拒绝执行是唯一不越权的行为，且报错自带修法。**主预防在计划面**（判据面一），派发面这条是兜底与病因点名。
- **单源**：上限常量由计划面规则、派发面两条拒绝、文案共读（改一处即三处同时变）。
- **历史不动**：已入账的超 3 波行照旧读，本期不回改账本、不改写任何历史记录。
- **与依赖语义正交**：`DependsOn` 仍只表达前置关系，引擎绝不用它兼职「分批」以外的含义——本相位只是给「一层能有多宽」加了一条上限。

### 7. 定案：消费面义务

#### 7.1 self-review 四问（登记一次，两处指针）

四问正文在 `contract/skill-anatomy.ts` **登记一次**（义务条目：**证据先于断言**——先跑命令、先读输出、再声称完成，未提交的产物不算完成 · **双轴自查**——符合仓内既有标准 / 符合既定规格 · **自查发现当轮修掉**——不得只记录 · **自查不替代评审**——下游评审仍必须发生）；`cdd-spec-writer` 与 `cdd-plan` 的 `self-review` 节点**只挂指针**（grep pin 两份），正文不复述。

**`cdd-design` 不增节点**：用户的裁定是「cdd-design 的写文档路径本来就经 cdd-spec-writer，self-review 只要在 cdd-spec-writer 里有」——故 digraph 零变更、anatomy 零 crossing。**接受的限制**：`charter · sync` 的四表回填不派发任何轮次，不经过任何 self-review 节点，其自查由编排器在本会话内承担（义务，不是判据）。

#### 7.2 作者审批门（义务归派发方）

审批门必须住在**派发的执行者**手里。义务按**派发入口**装：任何在 self-review 之后**首次派发 NEXT-loop 轮**的流——`cdd-spec-writer`（spec 评审派发）· `cdd-plan`（plan 评审派发）· `cdd-dev`（implement / review / fix 首轮派发）——在派发之前**把产物与自查结论一并呈交作者并停下**，等作者显式批准后方可派发；未获批准即派发 = 违约。同一义务、三处落地，不是三个门，不新增第二个停等点。**引擎侧零代码**：这个交界处引擎手里没有任何一轮可拦，做成引擎状态需要新增 `cdd approve` 动词（破八命令面），记为显式非目标。回填不跳过批准门——回填后重新呈交、重新等批准。

#### 7.3 文档写作权三分

- **创作权归编排器**：overall / spec / plan 的**成形**（新写、重构、章节重组、父章程回填）由编排器在本会话内完成，**不得**把「写稿」整体派发给子代理（`bg_run` · `pi -p` · subagent）。skill 导入不是子代理——它是编排器按节点指导在同一会话里写，属允许形。
- **执行期修订权归派发轮**：`implement` / `fix` 子代理**可以**更新 spec 与 plan 的**内容面**（事实、文件清单、步骤、验收细节、引用行号）。该授权是 **prompt 槽**（work-plane 派发提示的一行 capability 声明，`review` 变体不声明），**不是载体槽**：不进 `CARRIER`、不改 `PLANE_REQUIRED`、不进帧、不进 `progress.json`——门判的是结果，不读这句声明。
- **结构面变更归编排器，且由轮裁决判**：一轮结束时若 ① Task id 集合变化 或 ② 任一任务 `DependsOn` 集合变化，即判**结构面变更** → 该轮 **hard 违约**，须由编排器以独立提交落。判读面唯一：基线是**逐轮**的——该轮**派发时（pre-flight 之后、spawn 之前）**给计划文档拍下两个结构面，收工时与工作树上的计划文档比对，故判的只有**该轮自己的编辑**；比较是**集合相等**，不比散文、不做相似度。快照随派发帧持有（不落 `progress.json`、不进载体、不进 `InFlight`）。**呈现面唯一：该轮记录的 `violations`**——不登记 `contract/rules.ts` 的规则行（引擎唯一的 doc-contract 求值点是派发前的门，收工处零复跑，登记行永远不会 `evaluate`，只会渲染一条永不求值的 skip 词）；收工比对判败即由 `#verdictOf` 在该轮 `violations` 里自书一条 hard 条目（复用既有 `contract-violation` 因由，零新违约枚举），`board` 与报文按 hard 轮呈现。故「轮内改结构 → hard」只有一个判读面，没有第二份账。**接受的不分面**：spawn 之后的作者编辑与 child 编辑不可区分，该面属编排器纪律（中途回填规则），不由门判。
- **呈交行必须声明**：self-review 呈交作者的那一行写明该文档由编排器在本会话内写成（义务，不是判据——引擎不记录它，无法取证的门不写进门面）。

### 8. 落点、依赖与发行

| 面 | 落点 |
|---|---|
| 定级口径 | `render/templates.ts`（`SEVERITY_RUBRIC` 单源常量 + 四型 `axesGuide` 引用 + 两插槽渲染）；skill 面零复述 |
| 词面对齐 | `session/next.ts` 的 `FIX_READBACK_SUFFIX` + `session/__tests__/next.test.ts` 两处 pin + 常量 jsdoc |
| 终态裁决 | `face/lifecycle.ts`（派发收工处：裁决 → 违约族分流）+ `session/ledger.ts`（逐轮记录 + `completedCycles` + 派生计数）+ `session/run.ts`（`#bookkeep` 谓词退役、完成问句四类读面、修订回写以裁决为门） |
| 完成判据 | `contract/completion-criterion.ts`（契约 + 按 verb 的注册表；`implement` 走 `GitClient.commitsSince`，`fix` 走 dispositions，`review` 走载体 schema） |
| 载体槽 | `session/handoff-schema.ts`（`CARRIER` 增 `dispositions` + `PLANE_SLOTS.work` 收入；裁定追加在 both-plane 的 `notes`，`findings[]` 零改写） |
| 日志通道 | `face/lifecycle.ts`（stdio pipe + spawn 前建日志 + drain/close + `#cutShort` 的 `CDD_BLOCKED` 行点名该轮日志路径；hard 裁决同行走这一行）+ `infra/round-log.ts`（append 流封装）+ `session/round-naming.ts`（log stem 派生，含 `-a{attempt}`） |
| 活性 | `face/termination.ts`（`Sampler` 换两腿 + 四态真值表）+ `contract/liveness-signal.ts`（契约 + `LogGrowth` / `CpuAdvance` 注册表，`workspace-mtime` 键退役）+ `session/ledger.ts`（`Sample.newestMtimeMs` 随腿退役） |
| 波内上限 | `contract/wave-width.ts`（`MAX_TASKS_PER_WAVE` 的**声明**——计划面规则与派发面同读它，故 `contract/` 无需反向导入 `session/`）· `session/next.ts`（同一常量的 **re-export**，派发面进口面不变）+ `session/wave.ts`（`WaveGate.vet` 两条拒绝：`wave-too-wide` / `too-many-tasks`，两者在 `mixed-batch` 之后、`exact` 之前）+ `contract/rules.ts`（`doc` scope 规则 `wave-width-at-most-three`，`docKeys: ["plan"]`）+ `face/words.ts`（两条报文，点名任务 id 与 `DependsOn` 修法） |
| Next 派生 | `session/next.ts`（`NextHop` 类型（含 `route` 渲染载荷）+ `NextStepRouter#nextHop` 唯一派生（每次调用、每线一个）+ doc-class 判别注入 + `PIPELINE_NEXT` 降数据 + 删 `resolve`/`walk`）+ `face/route-render.ts`（`next:` 字面的唯一渲染器，capsule 与 board 共用，读 `NextHop.route`）+ `face/capsule.ts`（读注入的 `NextHop` · 删 `targetLineOpen` 与 `NextStepRouter.resolve` 调用 · `#routeText` 的 doc-class 分支改读注入对象）+ `face/gate.ts`（删 `#lineGate` 自指推演、读同一 `NextHop`）+ `face/board-view.ts`（删 `NextStepRouter.walk`、接收注入）+ `face/cli.ts`（拒绝报文按 `reason` / `hop` / `to` 渲染） |
| 板面 | `face/board-view.ts`（注入 `NextHop` + 逐轮裁决 + 聚合令牌 / `+N` / attempt 上标 / 路径省略 / 列对齐 / 在飞身份）+ `face/preview.ts`（`--dry-run` 只描述将追加的那条轮记录，既读面不增删） |
| 结构面规则 | `face/lifecycle.ts`（派发时快照 · 收工比对 · 判败自书该轮 `violations` 的 hard 条目）+ `render/templates.ts`（work-plane capability 行；`contract/rules.ts` 零登记行） |
| 消费面文本 | `packages/kairos/skills/cdd-spec-writer` / `cdd-plan`（self-review 指针 · 审批门）· `cdd-dev`（审批门 · 日志指路一句）· `packages/kairos/tests/` 的 grep pin + `contract/skill-anatomy.ts` 的四问登记项（结构 pin） |

**依赖**：P21 已 Done（`InFlight` · `RoundNaming` · `infra/proc.ts` · 账本轮记录四者都是本相位的基座）。

**发行**：changeset `cdd-engine` **minor** + `kairos` **patch**；不发布。

### 9. 非目标

- **旧链架构面整退**：波 = 派发组（`DispatchGroup`）· 「一个事实 → 访问器 → 一条求值缝 → 一个投影」· 单一派发目标（`DispatchTarget`）· `RunFacts` 事实包 · 全库「a line is a task, not a wave」改名 · 删 `--reviews` 旗标 · 值域类型 `RoundPhase → Hop` 改名。
- **载体内定级漂移机检**（`rounds` scope 规则 · 归一化指纹类 · 用户裁定清除路径）。
- **不新增 `--verbose` 旗标**（默认面区间形零出现；整板排版重设按 D69 ③ 取回，`--verbose` 网格留在 charter 的非目标里）· **不重新裁定 `REVIEW_CYCLE_CAP` 的值**（其值以章程裁定为准——v2.94 / D70 已抬至 50；spec 只引用常量名、不抄数字） · **不新增 `cdd` 命令**（仍八命令）· **不动 P21 的 `InFlight` 门与互斥语义**（记录形状不动）· **不复活 child 自述通道** · **不做日志轮转** · **不改预算阈值** · **不判 skill 侧动作**（合并 / 关 issue 属 skill 面） · **不新增审批状态文件**（审批门是消费面义务） · **不为文档创作面设引擎门**（创作不经引擎）。

### 10. 定案：输出面收口（capsule 两键 + `next:` 收尾）

**缺口**：capsule 的 `status · blocker · handoff` 里那一格 `blocker` **完全可由 `status` 推出**——`status` 由 findings 滚成（任一 blocker ⇒ `CHANGES_REQUESTED`、只有 warn/nit ⇒ `REVIEW_FIX`、空 ⇒ `APPROVED`、失败轮 ⇒ `BLOCKED`/`TIMEOUT` 且本就不印该格）。于是该格的全部信息量只是「有几个 blocker」，正是 #402 那条 comment 判定不该展示的数量；而它每轮都要算一遍、写一遍、被消费者读一遍。**定案**：capsule 收为两键 `status · handoff`（+ `next:` 行），`blocker` 格删除。

**行序**：`next:` 是消费者真正照着执行的那一行，必须**收尾**。故 fix 轮的处置摘要 `fixed N · rejected M` 从「capsule 之后」移到「`status` 行之后、`next:` 之前」——输出顺序成为：`status · handoff` → （fix 轮）`fixed N · rejected M` → `next: …`。

**字节面按 deliberate break 处理**：`blocker` 格的删除是 v1 pin 的显式破坏——capsule 的类注释、`face/__tests__/capsule.test.ts` 的形状断言、两份 README 的 capsule 行、消费面 skill 里引用的形状、以及本节与 §2.2/§4.1/Constraints 的相关表述全部同批重锚；断言不删，改锚到两键形状。changeset 按 D74 仍为 **engine minor**（方法论未动）。

**不新增机件**：没有新旗标、没有新行、没有第二份读面——`blocker` 计数在 `#capsuleLines` 里那一次局部计算随格一起删（判据侧 `blocker` 计数毫发不动，它仍是分级判收敛的核心）。

### Acceptance criteria

- `定级口径`：四型 `axesGuide` 引用同一 `SEVERITY_RUBRIC`（源码 pin：单源常量被四份引用；四份收尾段副本零残留）· 四问三档各有一条文本 pin（blocker 四问 · warn 契约内债 · nit 风格）· 片段含沉默义务句与 set-aside 句各一条文本 pin（两插槽渲染两值各一例）· skill 面零复述（grep pin）
- `词面对齐`：`FIX_READBACK_SUFFIX` 新字面 + 运行时断言 + 编译期字面类型 pin；旧字面在 `packages/cdd-engine` 代码与测试面零命中（冻结文档不在此列）
- `完成判据`：`implement` 组基线以来零提交 → hard（exit 非零 · `targetAction: false`）· `review` 空 `findings` → APPROVED（非违约）· `fix` 处置**六类** hard 面各一条红 pin（① work 载体缺失 ② `dispositions` 槽缺失 ③ 键集不等——缺条与多条各一条 ④ 未知条 ⑤ 请求方载体不可读 ⑥ `rejected` 缺理由）· `fix` 空 `findings` 输入 → 要求空键集 + 一条 soft 观测
- `违约分级`：hard 轮入账在册且 `board` 可见；soft 轮不改 exit 码；树脏不另写 soft 条目（由 `treeClean` 派生一条）；派生计数只数 soft（`counterOf` 单一出口）
- `入账即事实`：BLOCKED/TIMEOUT 轮**写入**一条记录（`op` + cycle + attempt + `dispatchBase` + 裁决 + 违约 + 载路径）；`completedCycles` 只认 `targetAction === true`；「完成问句」四类读面各有一条 pin（含 `#pendingFix` 不得把硬失败的 fix-K 读成已做、不得派 `fix-(K+1)`）· 修订回写以裁决为门（hard 失败的 review 不绑定 `reviewedRevision`，一条红 pin）
- `派发前门不动`：脏树在任何 child 派发前以 `tree-clean` / `dirty-tree` 拒绝（行为与字节面零变化 pin）
- `日志通道`：spawn 前文件已存在且为 0 字节 · 只增不改 · 重派带 `-a{attempt}` 不撞名 · close 之后可读 · `--dry-run` 零日志 · **stdout / capsule 面零变化**（child 文本不进 stdout/stderr · `next:` 行与 `status · blocker · handoff` 三键字节不变）且 stderr 的 `CDD_BLOCKED` 行点名日志路径（cut-short 行 `face/lifecycle.ts:715`；hard 裁决轮同行走同一行，各一条 pin）
- `活性`：撤 mtime 腿后三条红 pin——仓库他处写入 + child 零输出零 CPU 30min → `stalled` · CPU 读不到但日志在增长 → `progress` · 整窗无腿可读 → `unknown`（不杀）；另两条真值表 pin——CPU 腿不可读 · 日志零增长 · idle 满 30min → `stalled`（组杀）· **CPU 腿可读时**，烧 CPU 不写文件的长轮次不被杀；阈值 60s / 30min 与四态词零变化；`infra/proc.ts` 之外零 `ps` 调用（既有 grep pin 保持绿）
- `分级判收敛`：§5.1 转移表逐行 pin 之外，新增**仓库级孪生 pin**（落 `scripts/__tests__/`）——**第三条陈述与周期数只住在 `next-loop.{en,zh-CN}.json`**（`architecture.{en,zh-CN}.json` 只携带前两条：blocker 回合与 `REVIEW_FIX` 收敛）；孪生 pin 断言四份图**合起来覆盖三条**、`next-loop` 的周期数**等于** `REVIEW_CYCLE_CAP`，并锚定 `next.ts` 的 `#blockerCount` / `#close` / `REVIEW_CYCLE_CAP` 三个来源；任一常数或图侧措辞改动，两侧断言同时红
- `Next`：§5.1 转移表逐行 pin（含 warn/nit-only fix 后 next 不得为 `review`；未闭合线上的 blocker 不被 drift 抢走）· §5.5 四条 pin（含跨面一致性）· §5.2 映射表六值逐值 pin（含 `handoff` → `hop: null` + `to` = `entry`）· `reason` 七值逐值有产出者（`doc-drift` / `pending-fix` 各一条红 pin，闭合后改文档 ⇒ `doc-drift`）· `hop: null` 的报文两形各一条 pin（`to` 非空 / 皆空）· `NextHop.route` 载荷 pin（`next-wave` 的 `--tasks` 与 `fix` 的 `--reviews` 由同一条 `route` 经 `face/route-render.ts` 渲染，capsule 与 board 字节一致）· `PIPELINE_NEXT` 仅作数据（判断逻辑零命中）· `resolve` / `walk` / `#lineGate` / `targetLineOpen` 零残留 · 四读面（capsule · `#lineGate` · board · 生命周期前沿）读同一 `NextHop`（跨面 pin）
- `板面`：默认面聚合令牌裁决符不可省 · findings 数不进默认面 · 区间形零出现（本相位无 `--verbose`，`review 1–10 ✓` 即红）· `attempt === 1` 零 `a1` 后缀 · 绝对路径零出现（`next:` 相对）· 在飞行只留身份 · `board` 对在飞事实零写（运行前后字节不变）
- `波内上限`：计划面——某一依赖层 5 个任务 → 计划评审报 `wave-width-at-most-three` 红并点名该层 id；改成链式 `DependsOn`（后两个依赖第三个）后转绿（红/绿各一 pin）· 派发面——frontier 5 个时任何 `--tasks` 都被拒且原因 `wave-too-wide`、报文点名任务 id 与 `DependsOn` 修法（**不得**被报成 `split`）；`--tasks` 列 4 个 → 原因 `too-many-tasks` · **门序 pin**：混合批次形态仍报 `mixed-batch`（新拒绝在其后、`exact` 之前）· 引擎零重排（`TaskGraph#batches()` / `frontier` 语义零变化：既有波次用例全绿）· 跨面两条——完整层并集上的闭合集 ⇒ `next-wave` 字面恒被波门接受；部分闭合的跨层 frontier（append 形态）⇒ `wave-too-wide` 显式拒绝（不是 `split`）· 已入账的超 3 波行读取零报错
- `消费面义务`：四问在 `contract/skill-anatomy.ts` 登记一次 + 两份指针 grep pin · digraph 零变更（`cdd-design` 节点/边数不动）· 审批门三句与写作权三句 grep pin · 轮内改结构面两条红 pin（Task id 集 / `DependsOn` 集 → 该轮 `violations` 一条 hard · `board` 可见）+ `contract/rules.ts` 零 `plan-structure-frozen` 登记行（零残留 pin）
- `全量`：`cdd` 仍八命令 · engine vitest 全绿 · typecheck ×3 · `env -u AI_AGENT pnpm run validate` exit 0 · changeset `cdd-engine` minor + `kairos` patch，不发布

## Constraints

- **分级判收敛是程序方法论主轴**：Loop-vs-converge 只由 `blocker` / `warn` / `nit` 计数决定（§5.1）；口径（§2）与计数（§5）是同一件事的两半，改任一半必须同批改另一半；任何第二判据（route kind 反推 · 漂移抢判 · 新分级信号）都是本相位点名禁止的回归
- **图与判据孪生**：`next-loop.{en,zh-CN}.json`（三条全带，含周期数与软上限）与 `architecture.{en,zh-CN}.json`（只带 blocker 回合与 `REVIEW_FIX` 收敛两条）**合起来**覆盖三条陈述，`next-loop` 的周期数等于 `REVIEW_CYCLE_CAP`（spec 不抄数字）；图不可能与判据漂移
- **引擎不判定级是否正确**：口径是 prompt 契约，引擎只做结构校验（schema / 计数 / 转移表）；任何「引擎验证定级对不对」的实现都是越界
- **Loop-vs-converge 的判据只有一处**（`NextStepRouter.next` 的计数表）；HB 收敛只许改呈现，不许改判据——任何把 hop 从 route kind 反推并反向影响判据的写法都是本相位点名禁止的回归
- **引擎不替作者 reshape 波次**：上限是硬门 + 修法指引（改 `DependsOn`），不是自动切块/截断/重排；引擎只拒绝越界并点名病因
- **零新依赖**：日志用 Node 原生 append 流；判据与信号都是本仓内的小类
- **零新作者字段**：轮记录是引擎写的事实；`dispositions` 是**载体槽**（child 交回的结论），不是作者面字段；findings schema 零新字段
- **capsule 收为两键（deliberate 字节破坏 · §10）**：`status · handoff`（+ `next:` 行，且 `next:` 收尾）；`blocker` 格删除（可由 `status` 推出，且是 #402 comment 判定不展示的数量）；失败面形态与「日志路径只在 stderr `CDD_BLOCKED` 行点名」照旧；fix 轮的 `fixed N · rejected M` 移到 `next:` 之前；轮次输出行仍**不**补 blocker/warn/nit 三元拆分
- **`ps` 仍只住 `infra/proc.ts` 一处**；预算与 idle 阈值不动
- **不改写历史**：冻结轮次记录、已入账波行、冻结文档里的旧字节一律不回改
- **消费面 purity**：SKILL.md 只增义务句与指针句，不承载程序历史；不改写任何 skill 的 digraph
- **语言纪律**：引擎 prompt 面与 SKILL.md 英文主源；本 spec 为内部开发者文档（中文）

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.9 | 2026-11-03 | **输出面收口入册（用户裁定）**：capsule 收为 `status · handoff` 两键（`blocker` 格可由 `status` 推出，且是 #402 comment 判定不展示的数量）；`next:` 改为**收尾**——fix 轮的 `fixed N · rejected M` 移到 `status` 行之后、`next:` 之前；字节按 deliberate break 处理、pins 同批重锚，engine minor | Oscaner M. · Claude（kairos:cdd-close · reopen backfill · 2026-11-03） |
| v0.8 | 2026-11-03 | **落点行修正（W2 wave review 的 nit）**：`MAX_TASKS_PER_WAVE` 的驻地从「`session/next.ts`」改为「`contract/wave-width.ts` 声明 + `session/next.ts` re-export」——§8 原行与 §6「规则住 `contract/` 且零 `../session` 导入」不可能同时成立，实施轮的解法是唯一自洽形，参考面随之对齐 | Oscaner M. · Claude（kairos:cdd-dev · landing-row backfill · 2026-11-03） |
| v0.7 | 2026-11-03 | **软上限值的口径修正（W1 wave review 的 warn 触发 · 设计回填）**：三处「本相位不改该常量的值」与分支事实矛盾——`081f40cf` 已按用户裁定把 `REVIEW_CYCLE_CAP` 抬到 50（章程 v2.94 / D70）。改为「值以章程裁定为准（v2.94 / D70，本相位承接而非重新裁定）；spec 只引用常量名、不抄数字」，使参考面与树一致，同时保留「spec 不抄数字、孪生 pin 抓漂移」的原则 | Oscaner M. · Claude（kairos:cdd-dev · design backfill · 2026-11-03） |
| v0.6 | 2026-11-03 | **图面事实修正（plan-review-2 的 blocker 触发 · 设计回填）**：`architecture.{en,zh-CN}.json` 只画 blocker 回合与 `REVIEW_FIX` 收敛两条，周期数（软上限）只住在 `next-loop.{en,zh-CN}.json`——原文「四份图都按三条形状画」是事实错误。改为：`next-loop` 带全三条、周期数等于 `REVIEW_CYCLE_CAP`，`architecture` 带前两条，孪生 pin 断言四份**合起来**覆盖三条 | Oscaner M. · Claude（kairos:cdd-plan · design backfill · 2026-11-03） |
| v0.5 | 2026-11-03 | **spec-review-3 findings 全量落册**：① `NextHop` 增 `route` 渲染载荷（`next-wave` 的 `tasks` · `fix` 的 `reviews` 住在 Route 上，不复制进 `hop`），`face/route-render.ts` 入 §8 的 Next 落点行；② 日志指路 pin 改指 `face/lifecycle.ts` 的 `#cutShort` `CDD_BLOCKED` 行，§3.3 补 hard 裁决的 stderr 面；③ `reason` 词表补 `doc-class-blocked`，并写明 `hop: null` 的报文两形；④ 派生改为「每次调用、每线一个」并补输入面（drift 感知 gate 裁决 + 最新完成轮 + 计数）→ `hop` / `reason` 映射表；⑤ §3.5 补修订回写以 `verdict.targetAction` 为门（hard 失败的 review 不绑定 `reviewedRevision`）；⑥ 波宽断言收窄到「闭合集 = 完整依赖层并集」，append 形态写明显式拒绝，两条新拒绝钉在 `mixed-batch` 之后、`exact` 之前；⑦ 三处 nit（同档一致性句位置 · `PipelineKey` 取值 · 版本行序与日期） | Oscaner M. · Claude（kairos:cdd-design [P22] docs-fix · 2026-11-03） |
| v0.4 | 2026-11-03 | **波内上限改为硬门（用户裁定，取代 v0.3 的切块派生）**：引擎不切块、不截断、不重排——计划面增 `wave-width-at-most-three` 规则（任一依赖层 ≤3，作者在此修 `DependsOn`）+ 派发面 `WaveGate.vet` 两条拒绝（`wave-too-wide` 先于 `exact` · `too-many-tasks`），报文点名任务 id 与修法；`next-wave` 不截断（合规计划上恒 ≤3，越界者被同一道门连病因一起拒绝） | Oscaner M. · Claude（kairos:cdd-design [P22] · 2026-11-03） |
| v0.3 | 2026-11-03 | **spec-review-2 findings 全量落册**：① 波上限改由 `TaskGraph#batches()` 升序切块派生（`frontier` / `readyBatch` = 首个未闭合块），`WaveGate.vet` 的 `open` 与 `--tasks` 上限门同源——引擎自渲染的 `next-wave` 字面必被自家波门接受，mixed-batch / `planTasks` 快照语义随「一波 = 一块」重述；② 软上限一律引用 `REVIEW_CYCLE_CAP` 常量名（不再抄数字，孪生 pin 断言图侧周期数 == 常量），并明示值本相位不动；③ `plan-structure-frozen` 不登记规则行（无收工复跑），改由该轮 `violations` 单面呈现，删 skip 词；④ Next 派生宿主在既有 `NextStepRouter#nextHop`，类型复用 `PipelineKey` / `PipelineEntry`，映射表补齐 `handoff`，四读面含 capsule，`--dry-run` 既读面保留；⑤ 片段补齐沉默义务句（两插槽）与 set-aside 句；⑥ 裁定落点定为 reviews handoff 的 `notes`（`findings[]` 零改写）；⑦ 日志指路只在 stderr 的 `CDD_BLOCKED` 行（capsule 字节不变）；⑧ 不引入 `--verbose`（区间形永不出现）；⑨ `rejected` 缺理由入 hard（六类 hard 面）；⑩ AC 逐条对齐（四问三档 · 六类红 pin · 活性真值表补两条 · 跨面波门 pin） | Oscaner M. · Claude（kairos:cdd-design [P22] docs-fix · 2026-11-03） |
| v0.2 | 2026-11-02 | **方法论主轴入册（用户裁定）**：把「分级判收敛」提为程序核心理念并要求图⇄判据孪生——§5 开篇写明 blocker → 重审 / warn·nit → `REVIEW_FIX` 收敛 / 全空 → 通过 / 连续 20 个 blocker → 软上限就是图的形状，口径与计数是同一件事的两半（口径让计数有意义，计数是推进的唯一判据）；Constraints 首列该主轴与孪生约束；AC 增仓库级孪生 pin（`docs/diagrams/src/` 三陈述 ⇄ `next.ts` 的 `#blockerCount` / `#close` / `REVIEW_CYCLE_CAP`） | Oscaner M. · Claude（kairos:cdd-design [P22] · 2026-11-02） |
| v0.1 | 2026-11-02 | 首版：六块定案（定级口径 · 派发终态契约 · 日志与活性 · Next 收敛与板面 · 波内上限 3 · 消费面义务）；承 cdd-design [P22] grilling 四裁定（D69）与旧 P22 存链的价值取舍（D67/D68） | Oscaner M. · Claude（kairos:cdd-design [P22] · 2026-11-02） |
