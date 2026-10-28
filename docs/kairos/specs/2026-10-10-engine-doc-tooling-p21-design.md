---
title: 引擎文档工具（Engine Doc-Tooling）— P21 设计：引擎作为唯一读写路径
doc-type: phase-spec
version: v0.9
date: 2026-10-27
slug: 2026-10-10-engine-doc-tooling-p21
program: 2026-10-10-engine-doc-tooling
status: Draft
author: "[human] · Claude（kairos:cdd-design [P21] grilling → cdd-spec-writer · 2026-10-27）"
parent-version: v2.84
---

## Design

P21 收口四个 issue（#391 · #394 · #393 · #386）。它们不是四条补丁，是**一个缺口的四个面**：引擎是 CDD 唯一受支持的读写路径，但它对**自己在飞的状态**与**文档/账本之间的结构关系**都不持事实——于是每一次都逼消费方在引擎之外重建一条事实（自建测试套件、`ps`/`pgrep` 猜存活、手改 `progress.json`、编造调度依赖边）。

一句话命题：**引擎必须把自己的在飞状态与文档/账本的结构关系持成事实——一处一个事实、判定时刻现读（D26 法条）。**

方案形状（不按 issue 分四套机件，落成三个抽象 + 一个零新增字段的观测）：

| 抽象 | 归口 | 收口的 issue |
|---|---|---|
| `InFlight` — 在飞记录 + 互斥 + 存活 | `session/inflight.ts` | #391 |
| `ConsistencyRules` — 登记表（规则声明面）派生的结构规则族 | `contract/` | #394 |
| `LineIdentity` — 三种行一个身份面 | `session/line-identity.ts` | #393 |
| 波行 `planTasks` 快照 — 追加 vs 滞留的观测事实 | `session/ledger.ts` | #386 |

七前提贯穿：允许破坏性重写（目录与类面直接重组，不打补丁）· 零裸函数 · 免声明再抄（**不新增任何作者字段**，`checked` 清单从登记表派生）· 清死代码（写而无读的 `liveness.json` 独立面就地消灭）· 消费者只需学三句话 · 两处真合并 · OS 面优先第三方包。

### 1. 缺口（取证）

| 面 | 今日事实 | 证据 |
|---|---|---|
| 派发无互斥 | 四道门（tree-clean → graph → wave → doc-contract）没有一道读「是否已有人在跑」 | `session/preflight.ts:136-277` |
| 意图不落账 | `progress.json` 只在轮结束时写；preflight 拒绝的派发「既不持久化也不入账」 | `session/run.ts:254-286` · `session/ledger.ts:496-510` |
| 在飞产物写而无读 | `liveness.json` **只有一个写者、零个生产读者**（读者只有测试，用来排除 mtime 扫描）；`SampleRecord` 无 pid / 命令 / wave | `face/lifecycle.ts:183` · `session/ledger.ts:170-173`（`SampleRecord`）· `face/termination.ts:411-440`（写入面） |
| 存活判定外包且两向皆骗 | 同一次派发在 `ps` 里是父 `npm exec` + 子 `cdd` 两个 PID：`pgrep -fl cdd-engine` 零命中，`pgrep -f "implement --tasks N"` 得 2 | #391 实测 |
| 结构门半覆盖 | 变更记录版本唯一性与升序都写在 `if (ctx.docKey === "overall")` 分支内，plan 与 phase-spec 零门 | `contract/invariants.ts:447-505, 733-767` |
| 结构门零清单 | 门只报「失败」，不报「查了哪些规则」——「检查过」与「通过」不可区分 | `session/preflight.ts:56-75`（`PreFlightVerdict` 只带 `order` / `message` / `details`，不带已检规则面） |
| 规模校验伪造历史 | 把全文所有「N 任务 / M 波」当当前状态比对，历史行含同一模式 → 只能改写历史自救 | #394 实测 |
| 行重开只有两个态 | reviewed 身份写回只对 `frame.phase === "review"` 且目标为 plan/spec/wave 触发；branch 线永不落 `reviewedRevision`，闭合即终态 | `session/run.ts:489-498` · `session/ledger.ts:583-599, 699-720` |
| `next:` 与门禁自相矛盾 | `PIPELINE_NEXT.wave` 硬发 `review --type branch --plan` + 计划槽，而 branch 闭合后报 `the line holds no open round` | `session/next.ts` · `face/cli.ts:696` |
| 追加路径封死 | 开波 = `frontier(closedWaves())`，而 `mixed-batch` 先查静态批：新任务只依赖已关闭层 → 批混合 → BLOCK | `session/wave.ts:74-150` |
| 追加无判据 | Task 块七字段，无任何字段记录「这个任务什么时候进来的」→ 追加与滞留同形不可判 | `render/skeleton.ts:452-484` |

### 2. 定案：`InFlight`（#391）

#### 2.1 一个类，一份记录

`InFlight`（`session/inflight.ts`）是**唯一的在飞事实**，同时是锁与意图账本。它消灭今天 `liveness.json` 的「写而无读」残渣：记录不再是诊断尾迹，而是 preflight / `board` / `--dry-run` 的读取源。

- **落点 = 工作树级**（`.kairos/cdd/` 命名空间根），不是各 slug 的工作区：不同 phase 共用同一棵工作树，碰撞面是树。记录里带 `slug`。
- **字段**：`pid` / `pgid` · `command`（verb + 关键旗标）· `slug` · `startedAt` · `wave` / `phase` · `briefHash`（复用 `brief-revision` 的内容指纹，非新哈希面）· `plan` · `sampledAt` / `verdict`（采样尾迹）。
- **写序**是新增的核心：**spawn 之前取锁即写意图**；派发期间由采样循环经同一类覆写（保留身份字段）；正常收工释放。**「不自动释放」的对象是意图记录**：记录不由任何退出路径移除——正常 return、`process.exit()`、未捕获异常、SIGINT / SIGTERM 都不移除它，只有收工路径与 `--steal-stale` 移除。锁目录则归 `proper-lockfile` 的退出钩子管（§2.2），于是**被 SIGKILL 时锁目录与记录同时留下，其余崩溃 / kill / 超时只留记录**；因此判定「有人在跑」一律看记录，不看锁。
- 采样尾迹的写点收进 `InFlight`——今天它是 `SamplingLoop` 里的直写（`face/termination.ts:436`），是与锁平行的第二个写者。

#### 2.2 互斥与接管

- 取锁原子化交给 `proper-lockfile`，三项配置**显式钉死**（缺省值在这一组合下会出错）：`stale: 12h`（有限值，大于 implement 的 6h 预算）· `update: 60s` · `realpath: false`。**「永不自动抢」由记录 + pid 判据保证，不靠 `stale` 取 ∞**：`stale: Infinity` 会把缺省 `update` 推成 `Infinity`，被 Node 夹到 1ms，于是整个派发期间（最长 6h）以约 1ms 周期 `stat` + `utimes` 刷锁；而 `realpath` 缺省 `true` 要求被锁目标已存在，与「锁先于记录」的写序冲突（全新命名空间的首锁会失败）。有限 `stale` 不违背「永不自动抢」——抢不抢由判据决定，不由锁的时长决定。
- **门禁判据是「记录存在」，不是「持锁」**（锁只承担取锁互斥，其生命周期归库）：记录可读且 pid 存活 → **拒绝派发**并点名持有者：pid、命令、`startedAt`、已运行时长、波键、slug（跨 slug 同理，碰撞面是树）。走 `CDD_BLOCKED` 通道，exit 1。锁目录是否存在只在三态里充当「记录损坏」时的旁证：`proper-lockfile` 的退出钩子在任何优雅退出（正常 return / `process.exit()` / 未捕获异常 / SIGINT / SIGTERM）上移除锁目录，只有 SIGKILL 把它留下。
- 记录可读且 pid 已亡 → 同样拒绝派发，并提示 `--steal-stale` 可接管（下一次派发**不得**径直取锁覆写死者的意图记录）。
- **接管只走显式旗标 `--steal-stale`**（旗标不是新命令面，作用于 implement / review / fix），前提是记录的 pid 已不存在。pid 还活着就无论跑了多久都拒绝——「中断后的恢复」是显式动作。
- **这是本 phase 唯一刻意不精简的一处**：误判「已死」的代价是一整个纵切实现被覆盖且不可恢复（#391 已发生一次），破坏性动作必须由人拍。
- 心智负担的降低放在别处：`board` 与 `--dry-run` 主动报「持有者 pid 已亡 · 可 `--steal-stale` 接管」，消费方只需照提示敲。
- **损坏记录是三态，不是 fail-open**：（a）记录可读 + pid 已亡 → 见上，出口是 `--steal-stale`；（b）记录损坏 **且** 锁目录在 → 报文点名「记录损坏」，按**持有**处理，唯一出口是 `--steal-stale`（人拍，该路径顺手清锁）——同一记录也是采样循环的覆写目标，读面可能短暂拿到空 / 坏 JSON 与真损坏同形，此时 pid 不可读即判不出存活，删锁就会双开派发，正是 `--steal-stale` 要保护的那一面；（c）记录损坏 **且** 锁目录不在 → 无持有者，直接放行并点名该事实——一个坏文件不得把仓库永久锁死。
- 锁落在 `.kairos/` 下，而该命名空间的 `.gitignore` 由引擎自己写 `*`（`infra/workspace.ts:70-80`），取锁**永不弄脏树**、永不触发 tree-clean 门。**这个前提由 `InFlight` 自己保证**：命名空间标记是它**第一次写的前置条件**——第一次写之前自己发布 `.gitignore`（内容 `*`），不依赖 `WorkspaceRoot.ensure()` 的时点（P11 已把首个 `ensure()` 写点挪到 pre-flight 判定之后，见 `face/cli.ts:609-620`）。全新命名空间首次派发时若在 `ensure()` 之前被杀，`.kairos/cdd/inflight` 与锁目录会以未跟踪文件留下，下一次 tree-clean 门会先把「可 `--steal-stale` 接管」的恢复面挡掉；标记前置即消灭这个窗口。

#### 2.3 进程事实收进一个读面

OS 读面收进 `ProcessFacts`（`infra/proc.ts`）一处：`Sampler` 只向它取两条腿，判官（`StallJudge`）与阈值零动。

- **组 CPU 保留 `ps -g` 读法**（今日 `face/termination.ts:262-290` 的 `ps -o time= -g <pgid>` + 全组成员求和），迁进 `ProcessFacts` 作为唯一 OS 读面。这是「OS 面优先第三方包」原则的**唯一例外**（据实登记）：没有跨平台成熟包提供进程组累计 CPU——`pidusage` 按单 pid 计，`ps-list` 的 `ProcessDescriptor` 无 `pgid` 字段。用「PPID 下降 + `pidusage`」替代组读法会漏成员：组长先退则成员被 reparent，`setsid` 的孙进程根本不在这棵树里（P13/D56 的「孙进程占管道」正是这类形态）。方向是**假 stall → 杀活进程**，代价远高于收益，**故 `pidusage` 不引入**。
- **`ps-list` 只承接非 CPU 面**：存活、PPID 链、进程组去重（「在跑吗」与「跑了几个」由同一份记录回答，`npm exec` 包装不计第二个任务）。
- **组的定义钉在这里**：`ProcessFacts` 的组成员 = `ps -g <pgid>` 的成员集合（真进程组，货源与今日同一），`startedAt` 兜 pid 复用。于是组的语义、CPU 腿的读数、真值表与今日一致；PPID 下降仅服务 `ps-list` 侧的存活/去重面，**绝不参与 CPU 腿**。
- 两个既有实测形态进验收作样本 pin：**组长先退**（成员被 reparent）与 **`setsid` 孙进程**——两者在新 `ProcessFacts` 下的组 CPU 读数必须与今日 `ps -g` 相同。

#### 2.4 `--dry-run` 与恢复纪律

- `--dry-run` **与真派发同判**：持锁时打印 `lock: held by pid …` 并 exit 1（P11 的「预览 = 真派发的镜像」继续成立）。预览面对锁**只读**：不取、不接管、不释放——零写纪律不被锁门破坏。
- 中断恢复指导语改成三句，写进引擎报文与消费面 skill：**先看工作树** · **能用的改动就 commit** · **坏掉的改动就丢弃**。三句的**字节主源是英文**（引擎报文面 `words.ts` 与英文主导的 SKILL.md 同读一串）：`look at the working tree first` · `commit the changes that work` · `discard the ones that are broken`；本 spec 的中文句是它对译，不是另一份真源。现存消费面已是**零** `stash` / `checkout --` 建议（`face/words.ts:155` 的 dirty-tree 报文即「commit or discard your changes」），故本 phase 只补这三句纪律，并留一条 grep pin 防回归——断言的是**不引入**（`stash` 制造第二个真相，`checkout --` 已实测丢掉过一整个纵切实现）。
- kill / 超时 / 崩溃后报文显式提示「可能有迟到落盘，先检查工作树再进评审」（同一根因曾一次会话内三次把评审挡在 dirty-tree 上）。

### 3. 定案：`ConsistencyRules`（#394）

#### 3.1 一个登记表派生的规则族

doc-contract 与「账本↔计划」不再是 `PreFlight` 里的两个分支，而是**同一族策略**（登记表驱动、零新增判定面）。

**规则的唯一家是登记表的「规则声明面」**（不是元素面）：`contract/declare.ts` 今日的 `DeclaredRegistries` 只有骨架元素表 `ElementRegistry`（`anchor` / `presence` / `valuePattern` / `refKind` / `home`；定义 `contract/declare.ts:53-78`，四张登记表落点 `:1059-1064`），它列的是文档元素、不含任何规则名；而策略族今天是 `contract/judge.ts` 的 `Contract#buildPolicy()` 里 15 个硬编码 `new`（`contract/judge.ts:133-150`）。本 phase 增一层 `RuleDeclaration`（规则 id + 适用 docKey 集合 + 作用域 `doc|ledger`），`#buildPolicy()` 改为**遍历声明构造策略**——于是「改登记表即改清单与策略」，只有一处来源。两个作用域各持**唯一入口**：`Contract.validate`（判文档）只跑 `doc` 作用域策略；跨账本两条由独立入口 `Contract.validateLedger(input, LedgerFacts)` 求值（账本事实包 = 计划任务集合 + 已闭合波次 + 波行快照）——判文档时不跑 ledger 规则、判账本时不兼判文档，避免「一个入口两种判据」。

| 规则 id | 适用 docKey | 作用域 |
|---|---|---|
| `change-history-version-unique` — 变更记录版本标签唯一 | overall / phase-spec / single-spec / plan | doc |
| `change-history-version-monotone` — 变更记录版本单调（同向，不来回） | 同上 | doc |
| `front-matter-version-matches-lineage-end` — front-matter `version:` 与变更记录某一端一致 | 同上 | doc |
| `change-history-row-not-in-other-table` — 变更记录行不得落进其它表格 | 同上 | doc |
| `list-marker-not-doubled` — 列表标记不得双写 | 同上 | doc |
| `closed-wave-fits-depends-on-layers` — 账本已闭合波次仍贴合 `DependsOn` 分层 | plan + 账本 | ledger |
| `planned-tasks-vs-recorded-tasks` — 计划任务集合 vs 账本已记录任务集合（允许领先） | plan + 账本 | ledger |

两条 intra-doc 规则的判据与本 spec 的违例样例（AC 的红 pin 以它们为断言面）：

- **变更记录行不得落进其它表格**：`## Change history` 之外的任意表格行，其首列匹配 `v\d+\.\d+` 即违例。违例样例：`## Design` 的落点表里出现一行首列为 `v0.2` 的表行（单元格序列 `v0.2 · 2026-10-27 · …`）。fix = 把该行移回 `## Change history`。
- **列表标记不得双写**：列表项内容以另一枚列表标记开头（`- - x` · `* + y` · `- * z`）即违例。违例样例：`- - **status:** Draft`。fix = 合并为单枚标记。

**一规则一策略**是这条声明面的硬约束：清单里每一行必须对应且只对应一个可独立判定的策略，否则「查过哪条」与「判了什么」两件事会错位。因此今天两条**多表面策略要拆腿**——`UniquenessInvariant`（一条策略同时判变更记录版本、任务 id、阶段 id）拆成 `change-history-version-unique` / `task-id-unique` / `phase-id-unique` 三条，`OrderInvariant`（同时判小节序与变更记录升序）拆成 `section-order` / `change-history-version-ascending` 两条。声明面因此共 **23 行**：doc 作用域 **21**（既有 15 条拆腿后成 18 + 本 phase 新增 3）· ledger 作用域 **2**。上表 7 行是本 phase 的**公共面**（消费者能读懂的规则名），其余 16 行是既有策略的声明化，同一套机制、同一份清单。

两条 lineage 规则的判据按仓内既有两种合法格式钉死（**历史行不可变**这条铁律要求它们不得只认一种方向）：仓内 overall 与较新文档是**升序**（最旧在上、最新在下），而 P3–P7 / P10 的十篇冻结计划与 P4–P7 的四篇 spec 是**降序**（最新在上）——两种都是既有合法历史，重排任何一篇都已违反「历史行不可变」。因此：**版本序判「单调」**（同一方向贯穿到底，来回跳 = 违例；两种方向各自合法），**header 判「与某一端一致」**（首行或末行皆可，但必须恰是其中一端）。真正的缺陷面——重复版本、非单调来回、header 与两端都不符——一条不漏。

违规报文沿用 `kind@field: message`（字段路径 + 违规内容），fix 句点名**应改哪一处**。

#### 3.2 规模散文零门

**「Phase 规模与计划一致」不落地**（引擎今日无此判定面——`contract/invariants.ts` 与全库零规模一致性判定）。散文里的「N 任务 / M 波」不是机器事实，校验它必然把不可变的变更记录历史行拖进来——任何为转绿而做的改写都是伪造（「原记 A，改为 A」），而校验通过反而证明历史已被改。引擎只认登记表元素上的当前状态；需要引用历史规模时用引用，不改写。

#### 3.3 跨账本判据：允许计划领先

- 判据一：计划任务集合 vs 账本已记录任务集合；判据二：已闭合波次是否仍贴合 `DependsOn` 分层（一个波必须是一层的整批）。
- **允许计划领先账本**：仅对「编号大于账本已记录最大任务号的未开工任务」放行，给一行提示（`plan leads ledger by N tasks`）而非失败——这是每轮都会经过的正常窗口，假红会污染实现与修复轮次。
- **变异验证入验收**：删掉中间那条账本记录后同一判据必须转红。没有它，放宽会滑成永远绿。

#### 3.4 已检清单 = 规则声明面派生

`PreFlightVerdict` 增加已检规则清单，**与策略组成同源**：两者都从 §3.1 的**规则声明面**（规则 id + 适用 docKey 集合 + 作用域）派生——`Contract#buildPolicy()` 遍历声明构造策略，清单渲染同一批声明行。不手写第二份清单——那就是声明再抄。

元素面 ≠ 规则面：`ElementRegistry` 是骨架元素表，列的是 anchor / presence / valuePattern / refKind / home，**不**是规则名单，不能作为清单来源。跨账本那两条规则在元素表里无对应元素，只有规则声明面能让它们出现在清单里。

`ledger` 作用域的规则在未拿到账本事实包时列作 `skipped (no ledger facts)`——不静默缺席。对称地，`doc` 作用域的规则在 **wave / branch 派发**上列作 `skipped (no doc target)`——那两类派发的 `PreFlightContext.doc` 恒为 null（`face/cli.ts:603-606`），doc-contract 门不运行，doc 作用域的每一条声明（21 行）没有判定面，但必须在清单上留行，不得静默缺席。清单的取值形态四种：`passed` / `failed` / `skipped (原因)` / `info (提示)`——最后一种承载「不是失败但必须让人知道」的事实（例如计划领先账本）。让「检查过」与「通过」在报文上可分：消费方 CI 变红时读得到引擎究竟查了哪些规则。

### 4. 定案：`LineIdentity`（#393）

#### 4.1 三种行一个身份面

`LineIdentity`（`session/line-identity.ts`）把今天两套平行的漂移判定（`docLineVerdict` 的 doc-revision、`#briefDrift` 的 brief-revision）合成一个身份面，并补上第三行：

| 行 | reviewed 身份 | 漂移即重开 |
|---|---|---|
| spec / plan | 该文档的 `doc-revision` | 文档内容前进 |
| wave | 渲染后 brief 的 `brief-revision` | brief 内容前进（计划改动落在本波之外不算） |
| branch | **其计划文档的 `doc-revision`**（复用既有 kind，不新增 ref kind） | 计划修订前进 |

写点从「`review` 阶段 + plan/spec/wave 目标」放开到 branch 线（`branch-review` 阶段记它的源计划修订）。**不在账本身份 / 评测面引入 commit sha**——P7/D24 刚把它从评测面退役，账本里不留第二份代码身份；reviewed 身份一律复用 doc-revision / brief-revision（`CrashRecord` 的 `dispatchBase` / `commitsSince` 是 §5.5 的事后诊断事实，不在此列）。

#### 4.2 `next:` 与门禁不再自相矛盾

判据是「**该线是否有可派发的 open round**」——与 §4.1 的行身份判定同源（drift-aware：`LineIdentity` 与账本的 `docLineVerdict` / 行门同一份判定），**不是** `PipelineFaceState.closed`。`closed` 只是纯闭合位（`session/next.ts:119-131`），不感知 reviewed 身份漂移：按它发令，计划修订前进后波线闭合仍会渲 `/kairos:cdd-close`，把本该重开的终审压掉。全库口径统一为「计划未动时」：波线闭合 **且** branch 线无 open round 才落到 branch 面自己的下一站（`kairos:cdd-close`）；计划已动则渲 branch review。

事实通路（不新增第二位判定者）：持 ledger 的一侧——`Run` / `Lifecycle`——在算 route 时把 branch 线的 open 判定作为**入参**传给 `NextStepRouter.resolve(active, key, faceOpen)`；`Capsule#routeText`（`face/capsule.ts:139`）仍是纯渲染面，自己不读账本。「line holds no open round」退回它本来的意思：这条线确实没有待办轮次。

#### 4.3 迟到增量

只改代码不动计划的增量**不构成 branch 线重开**（身份只认计划修订）。要正式终审就先回填计划——这正是 CDD 纪律（需求变更先回填文档再实现）。不动的代码增量仍可走人工 PR 评审，引擎不假装它被终审过。

### 5. 定案：中途追加为受支持路径（#386）

#### 5.1 事实而非申报：波行的 `planTasks` 快照

D63 的 `mixed-batch` 拦的是**滞留**（plan 修订把新任务塞进已部分闭合的批），#386 要放行的是**追加**（合法新任务只依赖已关闭层）。两者同形，判别依据只能是「这个任务在那一批闭合时存不存在」——而这是**引擎可观测的事实**，不需要作者申报：

- 账本每个波行在**闭合时记下当时的计划任务集合**（`planTasks`）。这不是「当前计划的副本」：计划可变，而在闭合那一刻的计划内容是不可再生的历史事实。
- 因此**不新增 `Introduced in` 字段**，plan 作者零新增负担，零迁移。你在 #386 批注里的 `Ref plan version` 由此得出结论：**不可行且不必要**——它是引擎既有事实的作者副本（声明再抄），且会让每次版本推进都动已关闭任务（假账）。

#### 5.2 追加 vs 滞留

对混合批：取该批已闭合成员**最近一次闭合**的波行快照。若未开工成员**不在**快照里 → 它是事后追加的 → 按新波放行；在快照里 → 滞留 → 维持 `mixed-batch` BLOCK。缺快照的历史波行按「未知」处理，保守落 BLOCK（向后兼容，零迁移）。

#### 5.3 Task 块结构化（零新字段）

不新增字段，约束面不动：**零新字段**，字段键集固定、由既有 task-field 门校验；`### Task N:` 标题形态与 doc 类型集合零改。`Steps` 每条写成「动作 — checkable: 判定」在今日树上已成立（`Step checkable` 元素已注册 `valuePattern: "—\\s*checkable:\\s*\\S"`，`contract/declare.ts:641-647`），骨架已渲同形样例（`render/skeleton.ts:471-481`），故残余交付只有两条、都可变异打红：

1. 骨架把 **step 样例渲两条**（今日一条），使实现轮看到多步形态。
2. Task 字段**键序钉死**为 Objective → Files → Consumes → Produces → Steps → Acceptance → DependsOn（今日骨架同序但不设门，键序漂移必须能转红）。

**不加 continuation 行**——继续行削弱内容指纹的稳定性，让 brief 漂移判定变糊。

#### 5.4 轮号读法

`progress.json` 的 `rounds` 记的是**周期号**（fix-K ⟷ review-K，D28），不是序号：`rounds.fix = [2,3]` 读作「修的是 review-2 与 review-3」。**记账零改**——被拒派发本来就不入账。要收的是读面：`board` 的轮次列显式按周期语义渲染（`review×1,2,3 · fix×2,3`），词表写明「周期号 ≠ 序号」。今日 `roundsCell` 只渲 `${verb}×${value.length}`，且注释明写 never the stored number（`face/board-view.ts:209-220`，裁定句在 `:210-211`）——本 phase **反转该既有裁定**，这是 deliberate pin break，不是顺带改动。

#### 5.5 崩溃身份与迟到落盘

- crash 文件名与 `attemptedHandoff` **从 frame 的单一身份派生**（收进既有 `session/round-naming.ts`，与 report / evidence / brief 同源），修掉「wave 号与真实崩溃波不符」「`attemptedHandoff` 指向另一个任务」；今日成因可点名：`session/ledger.ts:959-960`（`crash-${lane}-${round}.json`）+ `face/lifecycle.ts:643`（`lane = ${op}.${frame.type}`，无波键）+ `:649`（`attemptedHandoff` 取同一 `handoffPath`）。
- `CrashRecord` 增 `dispatchBase`（派发前 HEAD）与 `commitsSince`（此后新增提交清单）：崩溃/kill 前子进程已提交的工作在 handoff 里可见，消费方不必逐个人工比对 git 历史。**这两项是事后诊断事实**：不参与任何身份比较、不参与门控、不写入任何 reviewed 身份面（§4.1 的 D24 裁定不受影响）。

#### 5.6 孤儿草稿：零写、只显示

**不做 `superseded` 标记、不归档、不加 `prune` 命令。** brief 每次派发无条件重渲染、名字稳定；版本信息由账本的 `brief-revision`（plan 指针 + 渲染内容指纹，`session/ledger.ts:534-536` · `recordReviewedBrief`）承担，**不在 brief 正文里**——brief 正文不得引入头行或任何稳定前缀，内容即指纹（头行一变，所有已评审波次的 `brief-revision` 全判漂移，恰好推翻「不存在旧 brief」这个结论）；真正无法辨认的是**从未入账的 handoff 草稿**，而清理它只能靠引擎偷偷搬家——比问题更糟。孤儿由账本判定（无对应终态轮次者），在 `board` 的在飞行/孤儿栏与 `--dry-run` 的 `reads:` 面列出，**零写**。

#### 5.7 消费面 recipe

按 D29 黑盒边界（只写行为契约，不点名内部 token）：`cdd-plan` 的 author 节点补「追加任务 = 用真实 `DependsOn` 边另起一波；**禁止改写已关闭任务的内容**」；`cdd-dev` 的 implement 节点补「计划领先账本时直接派新波，`plan leads ledger by N tasks` 是提示不是错误」。

### 6. 落点、依赖与发行

#### 6.1 目录与类面

| 文件 | 内容 |
|---|---|
| `session/inflight.ts` | `InFlight`（取锁 · 写意图 · 采样尾迹 · 释放 · 存活 · 接管） |
| `session/line-identity.ts` | `LineIdentity`（三种行一个漂移判定） |
| `infra/proc.ts` | `ProcessFacts`（`ps-list` 存活/PPID 链/组去重 + `ps -g` 组 CPU 的唯一 OS 读面） |
| `infra/atomic.ts` | `AtomicWriter`（`Workspace.writeJson` 的单一写实现） |
| `contract/` | 登记表增**规则声明面**（`RuleDeclaration`：规则 id + 适用 docKey + 作用域 `doc / ledger`）；`Contract#buildPolicy()` 由硬编码改为遍历声明派生；跨账本两条作用域 `ledger`，由 `Contract.validateLedger(input, LedgerFacts)` 独立入口求值（`ContractInput` 零新增字段——一个入口两种判据会让两侧各自推断该不该跑 ledger 规则）；已检清单渲染同一批声明行 |
| `session/ledger.ts` · `run.ts` · `wave.ts` · `next.ts` | 波行 `planTasks` · branch 身份写回 · 追加判据 · branch 面判 open |
| `face/declare.ts` · `render/skeleton.ts` | `--steal-stale` 旗标 · Task 块样例 |

零裸函数：新面全是类，受既有 `check:no-bare-functions` 全树门约束。

#### 6.2 第三方依赖（OS 面不造轮子）

| 包 | 替换掉 |
|---|---|
| `proper-lockfile` | 手写取锁的 read-modify-write 竞态面（显式三配置：`stale: 12h` · `update: 60s` · `realpath: false`，理由见 §2.2） |
| `write-file-atomic` | `Workspace.writeJson` 的直写（progress / crash / handoff / in-flight 全走这一缝） |
| `ps-list` | `Sampler` 里的存活与 PPID 链枚举、进程组去重判定 |

引擎运行时依赖 5 → 8，全部只服务 OS 面。**组 CPU 是本原则的唯一例外**（据实登记）：无跨平台成熟包提供进程组累计 CPU，保留 `ps -g` 读法收进 `infra/proc.ts`（理由见 §2.3）。不引入：`pidusage`（按单 pid 计；PPID 下降替代组读法会造成假 stall）· newest-mtime 扫描（无成熟包能便宜地给「最新 mtime」）· `chokidar`（watch 面不属于本 phase）。

#### 6.3 删除面（死代码清理）

- `liveness.json` 作为**独立诊断产物**消灭：升格为 `InFlight` 的记录，写者从两个（采样循环 + 未来锁）变一个、读者从零变三。
- `Sampler` 的 `ps` 解析与 `TIME_PATTERN` 退役（`ProcessFacts` 承接）。
- 规模一致性校验面**不存在**（不是新删，是不落地）。

#### 6.4 门序

`tree-clean → in-flight(记录/持有者) → graph → plan-ledger → wave → doc-contract`。tree-clean 仍在最前（评审基线 = 已提交状态），锁紧随其后，结构门与既有门同居一条序列；**门序本身是判定面的一部分，随已检清单输出**。

`plan-ledger` 门：跑 §3.1 的**两条 `ledger` 作用域规则**（`closed-wave-fits-depends-on-layers` · `planned-tasks-vs-recorded-tasks`），适用于 **plan / wave / branch** 派发——wave 派发必须跑，mixed-batch 与追加判据（§5.2）就在这一面，而 wave / branch 派发没有 doc 目标（`PreFlightContext.doc` 恒为 null，`face/cli.ts:603-606`），doc-contract 门在那里不运行。门名沿用 `PreFlightGateName` 的 `plan-ledger`，**本门无专属拒绝原因词**：缺账本事实包时规则列作 `skipped (no ledger facts)`（`ok: true`，`reason` 缺席），一条 `no-ledger-facts` 式的 reason 值会成为无产出点的死值（`PreFlightVerdict.reason` 只在失败面出现）。「计划领先账本」**不是拒绝形态**——它落 `checked` 的 `info (plan leads ledger by N tasks)` 行（§3.3），而 `PreFlightVerdict.reason` 只在失败面出现（`ok: true` 时缺席），零死值。与 doc-contract 的分工：**同一规则族按作用域分两个门执行**——doc 作用域 21 条在 doc-contract 门，ledger 作用域两条在 plan-ledger 门；已检清单按规则声明行**合并渲染一次**，同一规则不因跨两个门而出现两行。

门序旁注：**门只判、不写**——`in-flight` 门在 pre-flight 序列内只做 `inspect()`（读记录 + 判存活），取锁与写意图是**真派发路径**唯一的写点（`CliLifecycle` 在门通过之后 `acquire`）；预览面因此天然零写：它只读门给出的持有者事实并 exit 1，`--steal-stale` 在 `--dry-run` 下作废（有 pin）。门通过到 `acquire` 之间的竞态（另一派发抢先取锁）由 `acquire` 抛 `HoldingError` 并走同一条 `held` BLOCK 通道渲染。而 tree-clean 已先行——因此命名空间标记必须是 `InFlight` 第一次写的前置条件（§2.2），不得等 `WorkspaceRoot.ensure()`。奇异例外：若某轮将来把 in-flight 门挪到 `ensure()` 之后，必须先说明它为何不破坏「预览零写」。

#### 6.5 影响面与发行

- 消费面：`cdd-plan` / `cdd-dev` 的追加 recipe 与恢复纪律措辞。
- **changeset：cdd-engine minor（功能调整与新增）+ kairos patch（skill 文本），不发布。**
- 不变式：在飞状态只在 `InFlight` · 轮次只在 `progress.json` · 历史事实只在波行快照 · 文档身份只在 `reviewedRevision`；判定时刻现读，零缓存副本；`cdd` 仍是八命令。

### Acceptance criteria

- 同工作树的第二次派发在第一次存活期间被拒（含跨 slug），报文含 pid / 命令 / startedAt / 波键（**判据是记录存在，不是持锁**）；`--steal-stale` 在持有 pid 仍存活时**同样被拒**，pid 已不存在时放行并接管。
- `InFlight` 记录在 spawn **之前**即存在且携带身份字段；正常收工后释放；**任何退出路径都留下记录**（被 SIGKILL 时锁目录与记录同时留下，其余崩溃 / kill / 超时只留记录——锁是否仍在**不作判据**），`board` 与 `--dry-run` 都能据它回答「这一波是不是有人在做」（进程组去重，`npm exec` 包装不计第二任务）。
- `board` / `--dry-run` 在持有者 pid 已亡时报出「可 `--steal-stale` 接管」，且两面对锁**零写**（运行前后字节不变）。
- 锁记录损坏按三态处理（不是 fail-open）：**损坏记录 + 锁目录在 → 按持有处理**，报文点名损坏，唯一出口是 `--steal-stale`，且**损坏记录 + 活锁不得被静默清掉**；**损坏记录 + 锁目录不在 → 无持有者**，放行并点名（不留永久锁死）。两条各一 pin。
- 全新命名空间（无 `.kairos/.gitignore`）下首次派发被 kill 后 `git status --porcelain` 为空，且 `board` 能报可接管（`InFlight` 自己发布标记，不依赖 `ensure()`）。
- 全部 `ps` 调用只在 `infra/proc.ts` 一处（`face/termination.ts` 与其余引擎面零 `ps` / `TIME_PATTERN` 命中），`ProcessFacts` 是唯一 OS 读面；`Sampler` 的两条腿由它供数，stall 判官的阈值与真值表不变，并补「组长先退」/「`setsid` 孙进程」两个样本 pin（组 CPU 读数与今日 `ps -g` 一致）。
- `Workspace.writeJson` 经 `write-file-atomic` 落盘（progress / crash / handoff 全部经此一缝），进程被杀不会留半截 JSON。
- 七条结构规则在四类文档 / plan+账本上各有红 pin；**变更记录历史行原文即为绿**（不得为转绿改写历史）。
- front-matter `version:` 与末行不一致、变更记录行落进别的表格、列表标记双写，各有一条红 pin 与点名「应改哪一处」的 fix 句（断言面 = §3.1 的两个违例样例：`## Design` 表里的 `| v0.2 | …` 行 · `- - **status:** Draft`）。
- 散文「N 任务 / M 波」零一致性判压（无红 pin、无规模门）。
- 账本↔计划：窗口期内「编号大于账本最大任务号的未开工任务」放行并给 `plan leads ledger by N tasks` 提示；删掉中间账本记录的变异用例转红。两条 `ledger` 规则在 **`plan-ledger` 门**上执行（plan / **wave** / branch 三种派发都跑），拒绝/提示词为 `plan-ahead` 与 `no-ledger-facts`（后者对应 `skipped (no ledger facts)`，不静默缺席）。
- 每次派发输出的已检清单自**规则声明面**派生（`Contract` 的策略族与清单同源，改动声明即改动清单与策略，无第二份手写列表）；跨账本两条在清单里以实际结果或 `skipped (no ledger facts)` 出现（不静默缺席）；**wave / branch 派发的已检清单包含 21 条 doc 作用域声明各自的 `skipped (no doc target)` 行**；同一规则不因跨两个门而出现两行；「检查过」与「通过」在报文上可分。
- branch 线终审闭合后，计划修订前进即可再开一轮 branch review；计划**未动时**波线闭合的 `next:` **不再发出被门禁拒绝的命令**（落到 `kairos:cdd-close`）——判据是 drift-aware 的「该线有可派发 open round」，事实由持 ledger 一侧作入参传给 `NextStepRouter.resolve`，capsule 零新增判定。
- 波行闭合即记 `planTasks` 快照；混合批里不在该批闭合快照中的未开工任务按新波放行（追加），在快照中或快照缺失时维持 `mixed-batch` BLOCK（滞留），两条各一 pin。
- crash 文件名与 `attemptedHandoff` 与真实 frame 同源（一条 pin 断言两者）；`CrashRecord` 含 `dispatchBase` 与 `commitsSince`，kill 前的提交在 handoff 里可见，且两者只作事后诊断、不参与任何身份比较与门控。
- 从未入账的 handoff 草稿在 `board` / `--dry-run` 列出，引擎对这些草稿**零写**（目录 mtime 不变）。
- `cdd` 命令面仍为八命令（结构 pin）；`--steal-stale` 在 implement / review / fix 的帮助面在册。
- 消费面 skill 文本零 `pgrep` / `stash` / `checkout --`（grep pin——**基线已绿，断言的是不引入**，回归门而非新交付），且含「能用的 commit、坏掉的丢」的恢复纪律句。
- 新面零裸函数（`check:no-bare-functions` 零命中）· engine vitest 全绿 · typecheck ×3 · `pnpm run validate` ALL PASS · changeset cdd-engine **minor** + kairos **patch**，不发布。

## Constraints

- **不添加新命令面**（用户裁定 2026-10-26）：`cdd` 保持八命令；`--steal-stale` 是旗标；追加与孤儿治理不得引入子命令。
- **中断恢复 = 能用的改动 commit、坏掉的改动丢弃**（用户裁定 2026-10-26）：引擎与 skill 都不得建议 `git stash` 或 `git checkout --`。
- **branch 重开只认计划修订**（issue #393 评论裁定）：不引入 commit sha 作为账本身份。
- **`rounds` 记周期号不记序号**（D28）：不改记账语义，只改读面表述。
- **零新增作者字段**：判别「追加 vs 滞留」用引擎观测的波行快照，不要求作者申报版本（`Introduced in` / `Ref plan version` 均不落地）。
- **一事实一处 · 判定时刻现读**（D26 法条）：不在 `progress.json` 写 open round、不把计划版本复制进任务块、不做 `superseded` 副本。
- **OS 面例外**：组 CPU 保留 `ps -g` 读法（无成熟包提供进程组累计 CPU，`pidusage` 会因 reparent / setsid 少算成员），收进 `infra/proc.ts` 单一读面。
- **交付面**：每个文本文件结尾恰一个换行（无缺失尾换行、无尾随空行）；代码与交付散文英文主导。
- **历史行不可变**：任何为让校验转绿而改写变更记录历史行的做法都是缺陷。
- **D29 黑盒边界**：消费面 skill 只写行为契约，不点名引擎内部 token / 类名 / 槽位名。
- **七前提**：允许破坏性重写与目录重组 · OOP 统一零裸函数 · 免散文堆砌与声明再抄 · 死代码与空壳清理 · 消费者心智负担优先 · 最大精简（`--steal-stale` 为唯一刻意保留项）· OS 面优先第三方包。
- **changeset 级别**：cdd-engine **minor** + kairos **patch**（用户裁定 2026-10-27），不发布。

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-10-27 | P21 首版设计：在飞事实单一源 · 五条 intra-doc 规则上位且规模散文零门 · 账本↔计划结构门与已检规则清单 · branch 线补修订身份并修掉 `next:` 与门禁的矛盾 · 中途追加以 `Introduced in` 判别 · 崩溃身份单源 · 孤儿零写只显示 | [human] · Claude（kairos:cdd-design [P21] grilling → cdd-spec-writer · 2026-10-27） |
| v0.2 | 2026-10-27 | 七前提重审：四处收敛为三个抽象（`InFlight` · `ConsistencyRules` · `LineIdentity`）+ 一个观测快照——① **撤 `Introduced in`**，改波行闭合时的 `planTasks` 快照（引擎观测事实，零新增作者字段，`Ref plan version` 判为不可行不必要）② **锁提到工作树级**并交 `proper-lockfile`（`stale: Infinity`），`--steal-stale` 为唯一刻意不精简项，`board` / `--dry-run` 主动报可接管 ③ **进程事实外包** `ps-list` + `pidusage`，`Sampler` 的 `ps` 解析退役 ④ **写面原子化** `write-file-atomic`（`Workspace.writeJson` 单一缝）⑤ 两套漂移判定合为 `LineIdentity`（branch 复用 plan 的 doc-revision）⑥ 两类结构门合为 registry 派生的一族，已检清单自 `declaredRegistries` 派生 ⑦ 消灭写而无读的 `liveness.json` 独立面 ⑧ §1 取证压缩为表 | [human] · Claude（kairos:cdd-design [P21] → cdd-spec-writer · 2026-10-27） |
| v0.3 | 2026-10-27 | review-1 修订（全部 findings + 编排器裁定）：① 已检清单来源钉成登记表新增的 **规则声明面**（规则 id + 适用 docKey + 作用域 doc 或 ledger），`Contract#buildPolicy()` 由硬编码改派生，跨账本两条作用域 ledger、由 `ContractInput` 可选账本事实包求值，「元素面 ≠ 规则面」写死 ② **组 CPU 保留 `ps -g`**，收进 `infra/proc.ts` 唯一 OS 读面；`ps-list` 只接存活 / PPID 链 / 组去重，**不引 `pidusage`**（reparent / setsid 会假 stall），依赖 5→8 ③ `InFlight` 在第一次写之前自发布 `.kairos/.gitignore`（标记是记录的前置条件），补门序旁注与「全新命名空间被 kill 后树不脏」pin ④ 两条无形状规则给出判据 + 违例样例 ⑤ §4.2 判据改为 drift-aware 的「该线有可派发 open round」，事实由 Run / Lifecycle 入参传给 `NextStepRouter.resolve` ⑥ §4.1 收窄为「不在账本身份 / 评测面引 commit sha」，`CrashRecord` 两项标为事后诊断面（D24 零影响） ⑦ §3.2 动词统一为「不落地」 ⑧ pin 精度修正（`preflight.ts:136-277` · `SampleRecord` 改指 `session/ledger.ts:170-173` · §5.5 补 `ledger.ts:959-960` + `lifecycle.ts:643,649`） ⑨ EOF 换行纪律入 Constraints；parent-version → v2.83 | [human] · Claude（kairos:cdd-design [P21] → cdd-spec-writer · review-1 fix · 2026-10-27） |
| v0.4 | 2026-10-27 | review-2 修订（全部 findings + 编排器裁定）：① **门禁判据从「持锁」改为「记录存在」**（锁只承担取锁互斥，其生命周期归库）；「不自动释放」的对象点明为意图记录，SIGKILL 留锁与记录、其余退出路径只留记录，AC 同步限定 ② `proper-lockfile` 三配置显式钉死（`stale: 12h` · `update: 60s` · `realpath: false`），「永不自动抢」改由记录 + pid 判据保证，有限 `stale` 不违背该原则；§2.2 与 §6.2 同登记 ③ 损坏记录由 fail-open 收窄为**三态**，损坏 + 活锁按持有处理且不得静默清掉 ④ §6.4 给出 `plan-ledger` 门定义（两条 ledger 规则 · plan / wave / branch 派发 · gate/reason 词 `no-ledger-facts` / `plan-ahead` · 与 doc-contract 按作用域分工、清单合并渲染一次）；§3.4 补 `skipped (no doc target)` 配对句 ⑤ §5.6 删掉「版本信息在内容首行」的错误括号，改为账本 `brief-revision` 承担且正文不得引入头行 ⑥ §5.3 残余交付点名为「骨架渲两条 step 样例」与「Task 字段键序钉死」，不加 continuation 行，并补现况 pin ⑦ §2.4 改写为「现存零 stash / checkout -- 建议，本 phase 只补三句纪律」，grep pin 降为回归门（基线已绿） ⑧ 剩余现状主张补行 pin（`contract/declare.ts:53-78,1059-1064` · `contract/judge.ts:133-150` · `session/preflight.ts:56-75` · `face/board-view.ts:209-220`），并点明反转 `board-view.ts:210-211` 的既有裁定 ⑨ 措辞统一为「唯一例外（据实登记）」；parent-version → v2.84 | [human] · Claude（kairos:cdd-design [P21] → cdd-spec-writer · review-2 fix · 2026-10-27） |
| v0.5 | 2026-10-28 | 计划期的设计回填（`backfill-design`）：两个作用域各持唯一入口——`Contract.validate` 只跑 `doc` 作用域，跨账本两条由 `Contract.validateLedger(input, LedgerFacts)` 独立入口求值（取代「`ContractInput` 带可选账本包」的写法：一个入口两种判据会让调用侧与读取侧各自推断该不该跑 ledger 规则）。零行为变化，仅接口面收敛 | [human] · Claude（kairos:cdd-plan backfill · 2026-10-28） |
| v0.6 | 2026-10-28 | plan-review-1 blocker 触发的自相矛盾收敛（§6.1 残留句）：落点表仍写「`ContractInput` 增可选账本事实包」，与 §3.1 与 v0.5 的「每作用域一个入口」相反；改为 `Contract.validateLedger(input, LedgerFacts)` 双参入口、`ContractInput` 零新增字段。零行为变化 | [human] · Claude（kairos:cdd-plan backfill · 2026-10-28） |
| v0.7 | 2026-10-28 | plan-review-2 触发的两处设计收敛：① **一规则一策略**写死——清单每行对应一个可独立判定的策略，故 `UniquenessInvariant` / `OrderInvariant` 拆腿（声明面 = doc 21 + ledger 2 = 23 行，本 phase 公共面 7 行），`checked` 取值补 `info (提示)` 形态 ② 恢复三句的**字节主源定为英文**（`words.ts` 与 SKILL.md 同读一串，中文为对译）；「计划领先账本」落 `info` 行而非 `PreFlightReason`（reason 只在失败面出现，零死值） | [human] · Claude（kairos:cdd-plan backfill · 2026-10-28） |
| v0.8 | 2026-10-28 | plan-review-3 触发的三处收敛：① AC 的「五条 doc 规则」改成「21 条 doc 作用域声明」（与 §3.4/§6.4 的 21 行算术一致，两个数不得并存）② **in-flight 门只判不写**——取锁与写意图收归真派发路径，预览面因此天然零写、`--steal-stale` 在 `--dry-run` 下作废（门通过到 `acquire` 的竞态走同一条 `held` BLOCK 通道）③ 删掉 `no-ledger-facts` 这个无产出点的 reason 值（skipped 行即全部事实） | [human] · Claude（kairos:cdd-plan backfill · 2026-10-28） |
| v0.9 | 2026-10-28 | W1 评审触发的判据收敛（存量文档冲突）：仓内 P3–P7/P10 的十篇计划与 P4–P7 的四篇 spec 是 newest-first（降序）历史，而「历史行不可变」是铁律——只认升序会让这些文档被判红并给出一个禁止执行的 fix。两条 lineage 规则改为**方向无关**：`change-history-version-ascending` → `change-history-version-monotone`（同向贯穿，来回 = 违例）· `front-matter-version-matches-last-row` → `front-matter-version-matches-lineage-end`（header 与首行或末行一致，须恰为某一端）。重复版本 / 来回跳 / header 与两端皆不符仍全数捕获 | [human] · Claude（kairos:cdd-dev W1 review backfill · 2026-10-28） |
