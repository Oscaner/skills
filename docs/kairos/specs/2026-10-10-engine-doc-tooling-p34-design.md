---
title: '引擎文档工具（Engine Doc-Tooling）— P34 设计：载体身份收为轮次身份的单射渲染'
doc-type: phase-spec
version: v0.10
date: 2026-11-14
slug: '2026-10-10-engine-doc-tooling-p34'
program: 2026-10-10-engine-doc-tooling
parent-version: v3.61
author: '[human] 裁定 · Claude（kairos:cdd-design · 2026-11-13）'
---

## Design

本相位治 `cdd board` 在长回合 slug 上整块 `carrier-mismatch` 拒渲染（issue #470）。根因不是 board 取错了记录，而是**轮次身份与产物名身份是两个不同构的系统**：记录带 `attempt`，产物名不带；implement 一族连 `cycle` 都缺。于是重派一次就合法覆盖上一轮的物证，旧记录的内容摘要永久指向别人的字节。

相位收敛过程中又并入了四条同族面——孤儿归属谓词、崩溃/中断轮的来源、可选字段坏值的处置、闭合 wave 的层权威（§2.12–§2.15）。它们与产物身份共用同一条判据：**账本记录与磁盘产物必须互相对得上**；分开看是四个 bug，合起来看是同一句话在五个面上的失效。

裁定不取「加个后缀」「按所有者限定校验」「降级渲染」这类对账式修法，而是把两者收成同构：**产物名 = 轮次身份 × 产物种类的单次渲染**，单射由构造保证，写一次成为自然结果（§2.1–§2.3）。同一缺陷在 `report` / `evidence` / `crash` 三类产物上早已存在、只因没有摘要无人察觉，故作用面覆盖全部轮次产物（§1.2）。

身份与签名已由母 charter 回填（D88 · D89 · Phase inventory P34 行 · overall v3.61）：身份是 `(line, op, cycle, attempt)`，`kind` 是第二个参数、`role` 不再作为参数名，作用面是全部轮次产物，`carrierPath` 与 `draftPath` 同批退役。本文与该登记逐条对齐，不再另立形态。

### 1. 病根

#### 1.1 同一轮次有两个身份，且第二个不是单射

`RoundRecord` 的身份是 `(op, cycle, attempt)`（`session/ledger.ts` 的 `RoundRecord` 类型）；产物名的身份是 `(line, op, cycle)`——`RoundNaming.finalName` 只在名字尾部拼 `.c{round}`，`#stem` 对 implement 一族直接省掉 round 令牌，家族名则由 `Ledger.handoffName` 从 `config.handoffNamespace().families` 的 `{tasks}` / `{round}` 占位替换里取。

非单射的后果只有一个方向：**同一路径被两个身份共用**。implement 面上 `finalName` 在无 round 时原样返回 draft 名，`Ledger.persistHandoff` 据此把 materialize 后的 final 写在 child 的 draft 之上；下一次 attempt 的 child 又往同一个 draft 路径写。第 1 次 attempt 的摘要（记录里的 `carrierDigest`）从此指向第 2 次 attempt 的字节。

顺带纠正 issue 里一句归因：board 不是「取最早的 attempt」。`BoardView#findingsCountOf` 逐条记录用**该记录自己的**摘要读**该记录自己的**路径；任何一条被合法覆写的历史记录都会抛。问题在于这种记录必然存在，而不在取哪一条。

#### 1.2 摘要只兜住了四类产物中的一类

`RoundNaming.logName` 早就带 `-a{attempt}`，注释写明 attempt 1 的 log 永不被覆盖；`report` / `evidenceName` / `crashName` 三处都没有这个坐标。重派同样在销毁上一轮的评审报告、测试证据与崩溃记录——只是它们没有内容摘要，坏了没有任何面会喊。

所以缺陷类不是「载体名少了 attempt」，而是「**每轮产物名不是轮次身份的渲染**」；载体只是唯一带摘要、因而唯一会被发现的那个实例。

这条推论就是作用面从「载体」扩到「全部轮次产物」的依据，也由母 charter 回填登记（D88 · D89 · Phase inventory P34 行 · overall v3.61：`kind ∈ {draft, final, report, log, crash, evidence}`）。本相位不越登记面：`draftPath` 与 `carrierPath` 同批退役是同一条的必然（留一个是半个真源），同样已在 D88 与 P34 行登记。

#### 1.3 为什么只有渲染面受害

派发面读的是「最新 attempt」：`Ledger#latestRecordOf` 在 `#reviewsPathOf` 与摘要比对处都按 `attempt` 取最大，所以运行中的轮次从未观察到这个缺陷。受害的只有历史渲染（board 的 `+N`）与任何「重新读一条旧记录」的面——这也是它能在多轮评审里静默存活的原因。

### 2. 裁定

#### 2.1 一个身份，一处渲染：artifact = render(identity, kind)

身份 = `(line, op, cycle, attempt)`，其中 `line` 是四个文档形词（`phase-spec` · `overall` · `plan` · `single-spec`）之一、wave 线的 `tasks-{tasks}`、或 branch 线的 `branch`；产物种类 `kind ∈ {draft, final, report, log, crash, evidence}`。这是 D88/P34 登记的那一个形态（`(line, op, cycle, attempt) × kind`），`role` 不再是参数名。

`RoundNaming` 收这两个输入：一处 `render(identity, kind)` 出名字，一处 `renderPath(identity, kind)` 出磁盘路径（名字是唯一派生，路径只解析一次），别处不得再拼（§3.2）。

排版规则一条：`-a{n}` 插在 stem 尾部、kind 后缀之前，`attempt === 1` 省略；`cycle` 恒参与；`final` 另加 `.c{cycle}` 后缀。逐 kind 的拼写：

| kind | 拼写 | 适用面 |
| --- | --- | --- |
| draft | `{line}-{op}-{cycle}[-a{n}].json` | 每个派发轮 |
| final | `{line}-{op}-{cycle}[-a{n}].c{cycle}.json` | 每个派发轮，恒不等于 draft |
| report | `{line}-{op}-{cycle}[-a{n}]-report.md` | 每个派发轮 |
| log | `{line}-{op}-{cycle}[-a{n}].log` | 每个派发轮 |
| evidence | `{line}-{op}-{cycle}[-a{n}]-test-evidence.json` | 仅 implement / fix |
| crash | `crash-{line}-{op}-{cycle}[-a{n}].json` | **每一个**派发轮 |

单射由构造保证：四个坐标都参与，唯一的省略是 `attempt === 1`，而省略不破坏单射——能与它撞名的只有它自己。例：`tasks-6,7-implement-1-a2.c1.json` 是 wave `6,7` 第 1 cycle 第 2 次派发实现轮的 final。

`attempt` 由 `RoundNaming.attemptOf` 在派发前一次性分配并随帧传递，`render` 只消费它，从不自行推算——两处各推一次就又是一条双真源。

不适用的 kind 渲染空串：空串不是名字，调用方按「无此产物」处理。适用面逐 kind 固定，不留推断空间——`evidence` 只对 implement / fix 存在（与 `RoundNaming#evidenceName` 的现有判据同源：文档形与 review 面无此文件）；`crash` 对**每一个派发轮**存在，review 轮也写（拒绝面与终止面都走 `CliLifecycle#writeCrash`，resume 与 capsule 又按同一名字读回）。「非 work 轮不产 crash」是错的，落到实现上会让 review 轮的崩溃记录写去空路径、postmortem 与 resume 双双丢失（§3.5）。

`finalName(draftName, round)` 那种「拿到一个名字再切字符串拼后缀」的变换退役；`families` 占位表降为 legacy 只读回退（§2.4、§3.3）。

#### 2.2 implement 补 cycle 坐标

implement 一族的每个 kind 都携 `cycle` 令牌：`#stem` 对 implement 省掉 round 令牌、`finalName` 在 `round === undefined` 时原样返回 draft 名，这两条约定同时退役，`HandoffParams.round` 对 implement 也照常填（今天 `Lifecycle#paramsOf` 对该相位刻意不填，正是同一个省法的另一半）。于是 `render(id, draft) ≠ render(id, final)` 恒真，`final ≠ draft` 恒成立——这既是「种类是坐标」的直接后果，也是 P31 §2.3「final 永不覆盖 draft」第一次在该族兑现。

补的是全部 kind，不只 final：cycle 若只出现在 final 上，draft / report / log / evidence 仍会在 cycle 之间共用一格，§1.2 那条「重派销毁上一轮的物证」就在本族内原样残留。今天 implement 的 cycle 恒为 1（`Lifecycle#roundFor` · `session/run.ts:617` · 对该相位返回固定值；树里没有 `Run` 类，`session/ledger.ts:801` 注释里的 `(Run)` 是陈旧散文），所以这个令牌当下不区分任何两轮；正因为如此，把它留给运行面那个常量去保证，单射性就依赖 `RoundNaming` 之外的一条事实，而本相位的第一原则恰恰是名字只从身份派生。

#### 2.3 写一次是构造属性，不加门

新 attempt 必然落到不同的名字上，「覆盖上一轮」这个动作在新面里不被表达 → 不需要运行时守护（seal 状态检查 / 重写即拒）。以一条结构 pin 把门：同一身份的两个种类名不同，相邻 attempt 名不同。

P31 §2.4 的 unseal / seal 窗口照旧存在，它管的是「谁在这一轮的窗口里可写」，不承担去重；窗口的成员必须与本轮的渲染同源（§2.11）。

#### 2.4 真源收窄：`carrierPath` / `draftPath` 在新记录退役

两者都是同一身份两个坐标的副本，路径由 `render` 派生（派生的唯一读缝见 §2.10）。字段保留，但只服务 legacy 行，且明确不参与身份推导。

兼容判别**逐条记录**，不引入工作区级版本标记（`ProgressData` 没有版本字段，引擎只看得见记录与文件）。一条记录判三件事——有没有摘要、是不是它那个路径的 owner（§2.7）、路径是否等于 `render` 的输出。

#### 2.5 记录缺席时回退取 attempt 1

凡派发过的轮无条件入账（P22 ②），所以「无记录」只可能是第 1 次派发，回退取 `attempt 1`——attempt 1 的渲染即今天的名字；实现族与 evidence 的跨度为 §2.6 的例外，不在这条回退的守恒面里。不为旧引擎「blocked 轮不入账」的边缘去扫目录猜最大 attempt。

#### 2.6 attempt=1 的渲染逐字节守恒（implement 族与 evidence 除外）

attempt 1 省略 `-a{1}`，所以历史文件与历史记录零迁移可读：`phase-spec-review-1.json` · `phase-spec-review-1.c1.json` · `phase-spec-review-1-report.md` · `phase-spec-review-1.log` · `crash-phase-spec-review-1.json` 这类拼写不变；只有 attempt ≥ 2 才多出 `-a{n}` 坐标。

两处例外是有意的坐标补足（§2.2、§2.1），不是守恒的遗漏：

- **implement 族**：draft / final / report / log 从「无 cycle」变为携 `-{cycle}`（draft `tasks-6,7-implement.json` → `tasks-6,7-implement-1.json`，final 是同 stem 加 `.c{cycle}`）。`crash` 名今天已携 cycle（`crash-tasks-6,7-implement-1.json`），逐字节不变——这恰好说明缺位只在本族的非 crash 面上。
- **evidence**：今天只携 line（`tasks-6,7-test-evidence.json`），implement 与 fix、各 cycle、各 attempt 共用一格；改为携 op / cycle / attempt（`tasks-6,7-implement-1-test-evidence.json` · `branch-fix-1-test-evidence.json`）。

于是守恒判据的边界是：四类文档线、wave 线的 review / fix 族、branch 线的 review / fix 族、以及全部 `crash` 名逐字节不变；implement 族的五个非 crash kind 与全线的 evidence 名换新拼写（消费面可见，故 changeset 取 **minor**）。branch 线的 fix 族不是例外而是守恒侧的一员：今天它就是 `branch-fix-{cycle}` 加 `.c{cycle}`、attempt 1 省略 `-a{n}`（`RoundNaming#stem` · `session/round-naming.ts:165`），与同线 review 族逐字节同形，所以两侧都点名——只点 review 会让实现读成「fix 要么是例外、要么没人 pin」。

#### 2.7 legacy 失配行：present-facts，零迁移

一条记录若不是它那个路径的 owner，就不比对摘要、不抛、`+N` 计 0；owner 记录照常校验。对历史行引擎无法区分「合法覆写」与「篡改」，任何判断都是猜；present-facts 是既有的历史读法（与无摘要记录的零比对同款），且不需要动磁盘。board 不加标记——为一类不再复现的历史状态新增词表项与 pins 是拿债还债。

owner 判据要有名字与输入，否则这条读法无法实现：**`RoundRecords#ownerOf(records, record)`**——输入是行的**全量**记录加候选记录，回答「行内没有更大 `(cycle, attempt)` 的记录落在同一路径上」。board 的行构造在 `summaryCell` 处一次算好行的全量记录，把判定连同派生路径传进 `+N` 计数；计数本身不再读任何路径字段（§2.10）。新写记录逐条都是自己的 owner（名字按身份唯一），这条判据只对 legacy 行有分辨力。

#### 2.8 否决的三条

- **把「按所有者限定校验」当作不变量**：那会把不变量从产物搬到读取纪律，且历史证据仍被销毁。它在本相位只作为 legacy 读法存在（§2.7）。
- **内容寻址**（`carriers/{sha}.json`）：单射天然成立，但摧毁可寻址交接——child 要往给定路径写 draft、`--reviews` 要命名一个文件、rulings 边车靠相邻命名。与六前提⑤冲突。
- **board 降级渲染 + `--strict` + `carrier reseal`**（issue 原建议）：掩盖真篡改，并把「重新封印」变成修复手段——等于把「引擎写过什么」降级成「现在看起来如何」。

#### 2.9 边界声明：issue 的另两条不属本相位

`BLOCKED` 退出码与 stale in-flight 可见性两项，当前树已具备：`Cli#normalizeExit` 对 `CarrierMismatchError` 走 CDD_BLOCKED 通道并返回 1；`BoardView#inFlightRows` 渲染 `pid` / `op` / `cycle` / `attempt` / `wave`，并对死持有者追加可接管提示。它们不进 scope。

#### 2.10 读写缝：记录不再携路径，路径一律经一个 accessor 派生

退役两个字段的前提是先有一条派生的读缝，否则每条基于记录的读者都会失去名字（board 的 `+N`、`--reviews` 的 latest 解析、fix 的 requester 路径、capsule 的成功面、摘要读面都读同一个字段）。

**一个 accessor**：`Ledger#carrierPathOf(type, key, record)`——记录的载体路径。取值顺序固定三步：

1. 记录里的 `carrierPath` 是非空字符串 → 用它（legacy 行的历史事实，零迁移）；
2. 否则走 `resolveHandoffName` 的既有阶梯（`session/ledger.ts:1638-1650`：final-if-exists → canonical → 退役的 `spec` 孪生名），**不是裸 `renderPath(…, final)`**。走阶梯之前，accessor 先把记录还原成一个**完整身份**：阶梯的种子是 `render(id, final)`，`line = type`（wave 线取 `key`）、`op = record.op`、`cycle = record.cycle`、`attempt = record.attempt`，即 `HandoffParams = { tasks: 该 wave 线的 key, round: record.cycle, attempt: record.attempt }`。名字与摘要因此恒来自**同一条记录**，与下面 `readHandoff` 的同记录要求是同一条规则，不是两条。选阶梯而非裸渲染的原因只有一个：pre-P31 行整条没有该字段（`RoundRecords.of` · `:265` 原样透传数组项，只有 `recordRound` · `:826` 把缺省归一成 `null`），legacy fold `RoundRecords.completed`（`:287`）与 `#bookAbort`（`face/lifecycle.ts:294`）同样合成 `carrierPath: null`；而 render 派生的 `.c{cycle}` 拼写是 pre-P31 行从未铸过的名——按它直取会指向一个不存在的文件，把合法轮次硬拒。`attempt` 的缺省**不是**坐标缺省：`HandoffParams.attempt` 缺省为 1（legacy 调用与 §2.5 的回退），所以 accessor 必须显式喂记录的 `attempt`。漏喂的后果是可复现的：attempt 2 的记录解析到 attempt 1 的 final，而那个 final 因 §2.6 的守恒仍在盘上、`final-if-exists` 必然命中；board 的 `+N` 拿别人的路径比本记录的 `carrierDigest`，`CarrierIntegrity.read`（`session/carrier-integrity.ts:94-99`）对合法状态抛 `carrier-mismatch`——#470 的形态从本该消掉它的缝里回来。
3. accessor 对阶梯给出的候选取值前**自己**探一次存在（`#read(candidate) !== null`，或等价的文件存在检查），探不到就返回空。这一步不能指望阶梯：`resolveHandoffName`（`:1638-1646`）对非退役 type 在 canonical 级上没有存在判定（`if (!RETIRED_SPEC_LINE_KEYS.has(type) || this.#read<unknown>(canonical) !== null) return canonical;` 对任何非退役 type 都直接返回 canonical），只有退役的 `spec` 孪生级才 stat，所以「阶梯取不到文件」不是阶梯能报告的事实，探针只能住在 accessor 里。返回空后该轮维持 `RequesterRead.unrecorded` / `FIX_DISPOSITIONS_UNRECORDED`（`contract/completion-criterion.ts:272`）的 soft skip：缺了这层探针，真缺席的 doc / wave / branch 行会拿到一个非空路径，`CarrierIntegrity.read` 返回 null，`FixDispositions#requesterInputOf`（`:365-380`）落到 `RequesterRead.unreadable` → 硬拒一个合法轮次，与本条及 acceptance 宣告的软跳过相反。缺席与「无摘要」是两件事：前者是可见的软跳过，后者是 `carrierDigest` 缺席时的零比对。`carrierPath === null` 这个探针退役，但 `unrecorded` 那一面不退役——触发条件从「字段为 null」换成「accessor 解析不到载体」。

行的 line 与 type 由调用方持有（记录本身不带 line，这是行的键），所以 accessor 收 `(type, key, record)` 三样，绝不从记录本身猜 line。

五条读面改写为经它取路径，语义不变：

- `BoardView` 的 `+N` 计数：路径来自 accessor，摘要来自记录的 `carrierDigest`，owner 判定来自 §2.7；
- `Ledger#reviewsPathOf`：requester 是同一 (key, op, round) 的**最新 review attempt**，其 final 由 accessor 给出；无记录时回退家族名并取该 review 的最新 attempt（无则 1，§2.5）。它是**解析读者**：先取该记录自己的最新 review attempt，绝不继承派发帧的 `attempt`（与下一条摘要半边的第二类同一规则）；
- `CliLifecycle#reviewsPath`（`face/lifecycle.ts:1297`）——**第五读面，也是 `ctx.reviewsPath`（`:482`）、`INPUT_REVIEWS`（`:947`）与 `#resumeOf` 的 `--reviews`（`:1739`）真正的来源**，不是私有的 `#reviewsPathOf`（只在 `session/ledger.ts:1955` / `:1974` 被调用）。记录里的路径取自 accessor，attempt 取自 **requester review 记录自己的最新 attempt，绝不取 fix 帧的 `attempt`**：重派到 attempt 2 的 fix 轮若拿帧的 attempt 解析 review 家族，会去要 `…-review-{round}-a2.json`——review（attempt 1）从未写过它，`FixDispositions#requesterInputOf`（`contract/completion-criterion.ts:365-380`）读到缺席载体就硬拒一个合法轮次；`#resumeOf` 的同一条回退会把这个错的 attempt 带进崩溃记录的 `next`。recorded-path 直读（`:1299`）与 legacy `carrierPath === null` 判别（`:1307`）在本相位退役，路径一律走 accessor（`unrecorded` 这一结局不退役，改由 accessor 解析不到载体触发，见上一条的三步）；
- `FixDispositions` 的 requester 路径：字段退役后「优先记录里的路径」这一支消失——`requesterPathOf` 的 `carrierPath ?? reviewsPath`（`:337-342`）与 `#requesterInputOf` 的 `declared`（`:365`）改由 accessor 取出，requester 路径就是 lifecycle 已解析的 `ctx.reviewsPath`（其来源是 `CliLifecycle#reviewsPath`）；`#requesterDigestOf`（`:423`）不再以 `carrierPath === null` 判「无摘要」（改看 `carrierDigest` 是否缺席），`#ownRefusal`（`:490`）的报错路径取 ctx 里 accessor 已给的路径——摘要面本身不变；
- `Lifecycle#capsuleLines`（`session/run.ts:1011`）的成功面：它是**名字解析面，不是路径读面**——不读任何路径字段，只把帧交给 `Ledger#resolveHandoffPath` 要一个名字；该调用带上帧的 `attempt`，名字只经渲染面来。

**`HandoffParams` 补 `attempt`**：`{tasks, round, attempt}`。派发产出的 params 恒带帧的 `attempt`，于是 `handoffName` / `handoffPath` / `resolveHandoffName` / `resolveHandoffPath` / `readHandoff` 都能命名并读回第 n attempt 的文件，且名字与摘要取同一条记录（下一条）；`attempt` 缺省即 1（legacy 调用与 §2.5 的回退同一条规则）。`--reviews` 是唯一例外：它命名的是 requester review 轮自己的 attempt（上一条），不是 fix 帧的 attempt。

**摘要半边同批认 `attempt`——只补名字等于制造新的失配**：`readHandoff`（`session/ledger.ts:1673`）的名字经 `resolveHandoffName`（`:1638`），摘要经 `#carrierDigestOf`（`:1692`）→ `#latestRecordOf`（`:1700`），后者只按 `record.op === mode` 与 `cycle` 过滤再归约最大 `attempt`，不认 `params.attempt`。名字带 attempt、摘要仍归约最大 attempt，一条被重派过的 cycle（`attempt 2` 已入账、`attempt 1` 的 final 还在盘上——正是 §1.1 / §2.6 不再覆写的那个状态）就变成「读 `attempt 1` 的字节、比 `attempt 2` 的摘要」，`CarrierIntegrity.read`（`session/carrier-integrity.ts:94-99`）对合法状态抛 `carrier-mismatch`。所以两处必须同批认：`#carrierDigestOf` / `#latestRecordOf` 在 `params.attempt` 存在时按它选记录，名字与摘要逐字同源。而「调用方该传哪个 attempt」要按**它手里有没有那条记录**分成两类，两类不能混：

- **已持有记录、只读回它自己的面**：传**该记录自己的** `attempt`。`Ledger#round`（`:1917`，`readHandoff` 在 `:1946` 与 `:1965-1966`：`:1965` 传那条 review 记录的最新 attempt、`:1966` 传那条 fix 记录自己的）连同它的调用点 `session/ledger.ts:1077` / `:1176` / `:1531`、`Lifecycle#routeNext`（`session/run.ts:927`）。
- **自己要解析出那条记录的面**：先取该轮的最新 review attempt，再用它取名——绝不继承派发帧的 `attempt`。`#reviewsPathOf`（`:1717-1720`，`this.#latestRecordOf("review", type, { ...params, round })`）与 `#consecutiveS1Run`（`:1882-1890`，`readHandoff("review", type, { ...params, round: index })`）都是这一类的读者：两者展开派发 params，而本条规则让派发 params 恒带帧的 `attempt`，于是一次重派到 attempt 2 的 fix 帧（params.attempt = 2、review 记录停在 attempt 1）会把 review 记录过滤到 attempt 2、一条都取不到，再回退 `resolveHandoffPath("review", type, { ...params, round })` 渲染 `phase-spec-review-1-a2.c1.json`——review 从未写过这个文件。后果全落在合法状态上：`Ledger#round` 的 requester 读（`:1965`）解析到那个幽灵名，`#carrierDigestOf` 找不到 attempt-2 的 review 记录，`CarrierIntegrity.read` 返回 null，`reviewCarrier === null` 守卫让一个合法 fix 轮**不产生 Round**，`Lifecycle#routeNext`（`session/run.ts:922-925`）因而没有下一跳；`Round.reviewsPath` 带着幽灵路径（其 docstring 称它是 `--reviews` 的输入，`session/ledger.ts:183-184`），`NextStepRouter#next` 把它发成 `{ kind: "fix", reviews: ref.reviewsPath }`（`session/next.ts:342` / `:363`）；`#consecutiveS1Run` 在第一个读不回的 cycle 上 `break`，`Round.consecutiveS1` 少算。

唯一不传帧 attempt 的仍是 `--reviews`（上一条）——它就是第二类规则在 lifecycle 那一侧的同一个答案。

**摘要字段不动**：`carrierDigest` 保留——它才是完整性事实；它按哪条记录取由上面那条 `attempt` 规则定，字段与比对语义不变。`CarrierIntegrity.readFor` 的「从记录里取路径」职责退役，读面传 `(accessor 给出的路径, record.carrierDigest)`；`persistHandoff` 的写点也随 `draftPath` 一起收窄为「写 `render(id, final)`、封印 draft + final 两个名字」。

**`OUTPUT_HANDOFF`** 是 `render(id, draft)`：child 的写点与引擎的读点同源，不经过任何占位表。

#### 2.11 preflight / seal 窗口与本轮同一 attempt 同批对齐

P31 §2.4 的窗口成员必须与本轮渲染同源，否则新名字让人「打开错的窗」：打开的若是无 attempt 的名字，对一次重派来说那是历史轮的文件，本轮真正要写的 draft / final 反而没开，而历史文件在整个窗口里可写。

**窗口 = `[render(id, draft), render(id, final)]`**，`id` 是本轮的完整身份：preflight `#openRoundCarriers` 在 `CarrierSeal.sweep` 之后只 unseal 这一对，terminal（gate 拒、death、abort fold）seal 同一对。因此 `CliLifecycle#roundCarrierNamesOf` 收 `attempt`：帧路径取帧的 `attempt`，abort fold 取那条**记录自己的** `attempt`（记录带它，绝不重推）。

**崩溃遗留**：一对 attempt 形状的载体由 preflight 的 `CarrierSeal.sweep` 认出并封印，前提是扫描面认得 `-a{n}`（§3.4）；sweep 之外不扫第二遍，resume 也不需要猜——同一身份同一 attempt 的名字由同一 `render` 复现。

**legacy 轮**：当前 attempt 就是 1，窗口名与历史名同字节，打开的是它自己那一对，不是别人的文件。禁止的是 preflight 打开一个不属于本轮 attempt 的名字（今天的 `finalPath(draftName, params.round)` 在 implement 族打开的就是这一对里的同一个名字，退役后由 `render` 的两条 kind 分岔）。

#### 2.12 孤儿归属 = 记录归属，不是完成归属

`Ledger#orphanHandoffs` 今天问的是「本行有没有一条**完成**的轮认领这个 `(op, cycle)`」（`record.verdict.targetAction` 过滤），而 board 印的是 `no recorded round owns it`。两句不是一回事：`#bookkeep` 允许 BLOCKED 轮落载体，于是「记录了路径、`carrierDigest` 与文件逐字相同」的产物被判无主。

裁定：**归属 = 本行有一条记录，其完整身份渲染出的产物名等于该文件**，与 verdict 无关——认领键是产物自己的渲染身份 `(line, op, cycle, attempt)`（`kind` 由文件名的后缀读出，§2.1），**`attempt` 不是可以丢掉的坐标**。abort 轮（`interrupted`）也算认领——它的产物属于那一轮。真正的孤儿因此收窄为「这个文件没有任何记录认领」。

判据按**反向读**实现，不按正向渲染比较：从扫描到的文件名解出 `(line, op, cycle, attempt)`（缺该坐标的 legacy 拼写按 1 读，§3.4），再看本行有没有记录的身份等于它。正向比较在两类合法输入上必错：implement 族 attempt-1 的拼写在本相位换新（§2.6 的例外：`tasks-6,7-implement.json` → `tasks-6,7-implement-1.json`），按新身份渲染出的名字永远不等于磁盘上的旧拼写；pre-P31 行又整条没有路径可回退（`RoundRecords.completed` 合成 `carrierPath: null`，`session/ledger.ts:287-296`；`RoundRecords.of` 把 legacy `rounds: {implement: [1]}` 折叠过去，`:278-281`），而这类行的文件是活着的——本仓 `.kairos/cdd/2026-10-10-engine-doc-tooling-p16/progress.json` 里 `{"wave":"1","rounds":{"implement":[1],"review":[1]}}` 就是这样一行，`tasks-1-implement.json` 归它。所以反向读的每族拼写表要同时收 legacy 形，解出的 identity 与记录 identity 直接对等，不经名字渲染。

把键退回 `(op, cycle)` 会在归属面上把本相位的成果重新抹掉：attempt-2 的 draft 与 attempt-1 的 draft 是两个不同名字，前者只由 attempt-2 的记录认领；用 attempt-free 键时 attempt-1 的记录也「认领」`tasks-6,7-implement-1-a2.json`，而 §2.6 的守恒保证 attempt-1 的 final 仍在盘上、也仍被它自己的记录认领——acceptance 的「出现恰好一次」于是永远不可能成立。今天的实现正是这个键：`orphanHandoffs`（`session/ledger.ts:1738`）把完成集算成 `${record.op}:${record.cycle}`（`:1743-1749`），`#handoffOwner`（`:1778`）只返回 `{key, op, round}`——attempt 在这两处都被丢掉了，所以反向读必须先解出该坐标并保留它（§3.4）。

legacy 行再加一档：记录的载体路径指向该文件即算认领（随字段退场同时退场）。记录侧的值**一律经 `Ledger#carrierPathOf(type, key, record)` 取**，不裸读 `carrierPath`——accessor 的 step 1 就是记录的 `carrierPath` 原值（§2.10），legacy 行读到的仍是历史事实，而 acceptance 的守卫 pin（`RoundNaming` 与 accessor 之外零 `carrierPath` 读）不必为 `#orphanHandoffs` 开口子。这一档必须点名比较基准，否则它静默不生效：`persistHandoff` 返回的 `path` 是 `this.#workspace.resolve(finalName)`（`session/ledger.ts:1623`）——含目录的绝对形；`carrierPath` 不在读时相对化的路径键集里（`PERSISTED_PATH_KEYS` 只有 `doc` / `plan`，`infra/workspace.ts:49`），所以它按落盘形读回；扫描面拿到的却是裸文件名（`#workspaceFiles` 映射 `entry.name`，`session/ledger.ts:1764`）。因此这一档比较 `path.basename` 的两侧（扫描名与该 accessor 值），基准写在这里而不是留给实现去猜——与 §2.7 / D46 的「一条基准」同一课。

别与 §2.7 混：`RoundRecords#ownerOf` 问的是「同路径上有没有更大的 `(cycle, attempt)`」，那是**摘要校验**的判据；孤儿问的是「有没有记录认领」，那是**归属**的判据。

#### 2.13 崩溃 / 中断的来源可见，但不是分级信号

`BoardView#judgementRuns` 只按 `verdict.targetAction` 分流，于是判败（`contract-violation`）、abort（`interrupted`）、终止（`stalled` / `over-budget` / `signal`）、child 自退（`child-exit`）在板上同形：都是一个 `✗`。消费者读到的是一次「判败」，实际是一次「没有结论」。

裁定：`✗` 留着（那轮确实没有交付），另加一行来源事实，与 `in-flight` / `orphan` 同级：

```
  crashed: review 1·a1 contract-violation · review 3·a2 stalled
```

数据源是记录自己的 `violations[].cause`，成员谓词是**合取**：`verdict.targetAction === false && violations.some((v) => v.grade === "hard")`——只有同时「没有交付」且「有一条 hard 登记」的轮才列。判别子是 `RoundViolation.grade`（`session/ledger.ts:87` · `:103-108`），不是条目数。单看「有 violation」不成立：成功的轮也带 soft 条目，`#verdictOf`（`face/lifecycle.ts:420`）在每个面上都附上 `#logUnavailable`（`:428`；成功分支在 `:453` 展开同一组），其 `cause` 缺省就是 `contract-violation`（`RoundViolation.soft` 的缺省值，`session/ledger.ts:103` · 赋值点 `face/lifecycle.ts:838`）；`session/run.ts:746` 的 `WRITE_BACK_UNMEASURED` 是同一形态，并且它落在「child 声明 BLOCKED、没写回文档」的轮上（`#bookkeep` 在 `:745-748` 追加这一条 soft，verdict 缺省 `{treeClean, targetAction: !blocked}`，`:749-757`）——那轮 `targetAction === false` 却只有 soft。按计数读，一次 APPROVED 评审只要日志建不出来，就会在板上印成 `crashed: review 1·a1 contract-violation`——给已交付的轮报一次崩溃；而一条只带 soft 的中断轮则被收进集合、又因下面「取首条 hard」的规则取不到 token，文档得替它发明一个印法。两级的失败面是同一个：谓词本身必须要求 hard。

一行一轮：每轮只取**记录顺序里第一条 hard 条目**作 token；soft-only 的轮由上一条的谓词本身排除在外，这条 token 规则因此不会遇到取不到条目的轮。崩溃记录本身仍是完整的事后取证。行按 `(cycle, attempt)` 排序。

**这一行不参与任何判定**（D70）：不进 blocker / warn / nit 计数、不改 `+N`、不改 `next:`、不进 Loop-vs-converge。它只回答「这个叉是怎么来的」。

#### 2.14 可选字段的坏值：drop + soft，不 BLOCK

载体声明分两档，边界由声明推导、不在文档里手写一份字段清单：`required`（`PLANE_REQUIRED`，`session/handoff-schema.ts:108`：work 面 `status` / `artifacts`；judge 面 `findings`）+ finding 自身 required 的 `severity` / `lens` / `summary`；**装饰档 = `PLANE_SLOTS` 声明的可写槽（`session/handoff-schema.ts:97`）减去本面的 `required` 集**，即 judge 面 `artifacts` / `notes`、work 面 `notes` / `dispositions`，再加 finding 里非 required 的 `id` / `section` / `line` / `fix`。`artifacts` 在两面都声明而 judge 面不 required，work 面的 `dispositions` 同理——二者**都在装饰档**；把括号里的举例读成一个封闭集合，正是手写清单最容易犯的错（§3.8）。今天两档同一把尺子：任何字段类型不符，整条载体被拒、整轮作废——`findings[].line = null` 即可把一次完整评审打成 BLOCKED。

裁定：坏值按档处置。`required` 字段坏值仍 BLOCKED（负载面，语义会因此失真）；非 required 字段坏值 **drop 该键** + 记一条 soft observation，轮次照常结束。落点是**三处**缝，不是一处：**校验走查本身**（`HandoffSchema#check`，`session/handoff-schema.ts:328`；整数分支在 `:378` 记 `expected an integer`）改成 tier-aware——非 required 节点失配时记录并跳过该键，不产生 problem；**顶层值的搬运在 `#materialize` 的拷贝点**（`face/lifecycle.ts:1608` 的 `draftNotes`、`:1613` 的 `carrier.dispositions = draft.dispositions`、`:1615` 的 `carrier.notes = [...notes, ...draftNotes]`）——`#check` 只判不写、从不重写 draft，这两条 top-level 装饰槽是把未过筛的值原样搬进载体的地方，drop 必须也落在那里，否则引擎会写出一个自己的 `CARRIER` 声明（`session/handoff-schema.ts:120-135`）拒收的载体，而活过一个非对象 `dispositions` 还会走到 fix 判据而不是止于 drop；两处只留一处判定更好：tier-aware `#check` 返回被丢掉的键集、`#materialize` 消费它，谓词不抄第二份；**嵌套 findings 的剥键在 `#findingsList`**（`face/lifecycle.ts:1702`，今天除引擎自印的 `id` 外逐行原样拷贝）里丢掉越档的那个键。`#materialize` 的 `droppedKeys` 路（`face/lifecycle.ts:1579`）只覆盖**顶层未声明键**，是这条机制的另一半而不是全部：`#reconstruct` 先跑 `schema.readBack` 的 required 档并在有问题时 `#reject`（`face/lifecycle.ts:1223`），`#materialize` 在 `:1234` 才被调用，坏值的 draft 根本走不到那里。soft observation 的落点是既有那一个——`RoundViolation.soft`（`session/ledger.ts:103`）进记录的 `violations[]`，与 §2.13 的来源行读同一列；不另开告示面。

理由与 D27 同源：`line` / `section` 不参与任何判定，不该有否决权。

#### 2.15 闭合 wave 的层权威：账本为准，不重算

`TaskGraph` 从 `DependsOn` 现算分层，`closed-wave-fits-depends-on-layers` 再拿它与账本里已闭合的 wave 名比对。事后编辑依赖（追加任务的自然动作）会让一段合法历史必然报红：历史 wave 名是账本记录，层是派生面，派生面压过了记录面。

裁定：**已闭合的 wave 不再受层判据约束**，只受既有的 `planned-tasks-vs-recorded-tasks` 约束——这条规则读的是**当前** plan 的 task id 集（`const planned = new Set(ledger.planTasks)`，`contract/invariants.ts:419` · `:424`），单向地把「账本已记录而当前 plan 不再携带」的 task id 报红；它**不读快照**。`LedgerFacts` 的 `snapshots` 列（`contract/judge.ts:57`，由 `#snapshotsOf` 装配，`session/preflight.ts:533`）属于 append-vs-stall 的观察面；不要为了让这条规则「用上快照」而把它接进去——那会改变它判的东西。于是闭合 wave 的保证是：它的每个已记录 task id 必须仍在当前 plan 里。

层判据只对**未闭合**的 wave 生效，而「未闭合」需要一个来源：`LedgerLayeringRule` 今天只迭代 `ledger.closedWaves`（`contract/invariants.ts:388`），而 `LedgerFacts` 的格子里没有一格收开放 wave——闭合集（`contract/judge.ts:55`）、层（`:60`）、`planTasks`（`:51`）与 `snapshots`（`:57`）都在，开放集不在。裁定补一格**装配事实**（不是持久字段）：**`openWaves`——未完全闭合的 wave 行，wave key → task ids**，在 `#ledgerFactsOf`（`session/preflight.ts:506`）里与 `closedWaves` 相邻、读同一个 `progress.waves`；收窄后的规则迭代它。不新增 `planLayer` 之类持久字段——消费者要的「账本为准，plan 只标未派发」由此达成。

### 3. 失败面

#### 3.1 单射退化无人喊

`report` / `evidence` / `crash` 没有摘要。若日后有人给 `render` 加一个条件（例如只在某个旗标下才拼 attempt），两类产物重新撞名，而这些产物不会红。把门方式：单射性做成跨 identity 网格的**性质 pin**（六个 `TargetType`——四个文档形 + wave + branch——× 适用的 kind × attempt 1–3 × cycle 1–2；同一 kind 下任意两个不同身份不得同名），而不是逐例断言。

网格的两条口径必须写死，否则它永远红：

- **只比适用的 `(identity, kind)` 对**：`evidence` 只在 implement / fix 上比较，其余 kind 各自全适用；不适用处渲染的 `""` 不是名字，不入比较（两个不同文档身份的 `evidence` 都是 `""`，按字面比必红）。
- **六个 type 全在网格里**：四个文档形各断言一次自己的拼写前缀（`phase-spec-` / `overall-` / `plan-` / `single-spec-`），wave 与 branch 各取一个身份；不拿「三个 line 形」概括六个 type。

#### 3.2 读面与写面各推一份名字

「名字从身份派生」只在 `RoundNaming` 里成立。一旦有读者回到「从参数自己拼一个名字」，同类缺陷重新长出来，且这种读者不受 §3.1 的网格保护。把门方式：`RoundNaming`（含 `Ledger#carrierPathOf` 对它的委派）之外不得出现产物名拼装字面（`.c${` / `-report.md` / `-a${` / `-test-evidence` 一类）的守卫测试。

#### 3.3 legacy 回退长成永久机制

`families` 占位表一旦被新写面重新用上，第二真源就复活。把门方式：写路径（`persistHandoff` 及其上游）不得调用占位表——守卫测试固定这一条，直到 legacy 行退场后整表删除。

#### 3.4 产物扫描面不认识新名字

`-a{n}` 进名字之后，按名字扫目录的两处会错：`RoundNaming.isCarrierName`（`infra/carrier-seal.ts` 的 `CarrierSeal.sweep` / `#isStray` 消费它）的 pattern 若不接受 `-a{n}`，崩溃遗留的载体就 sweep 不到（残留可写，§2.3 判它不可能存在的窗口）；若反过来放宽过头，`report` / `evidence` / `crash` 会被当成载体 seal 或当孤儿列上 board。`orphanHandoffs`（`session/ledger.ts:1738`）不是同一处判定：它反向读工作区每个文件名，经 `#handoffOwner`（`:1778`）→ `#familySpellings`（`:1803`）/ `#familyCaptures`（`:1818`）重建 legacy `families` 占位表的正则（`tasks-{tasks}-implement.json`、`{line}-{op}-{round}.json`），新名一个都不匹配——`tasks-6,7-implement-1-a2.json`（新 attempt）与 `tasks-6,7-implement-1.json`（implement 补 cycle）都没有 `families` 行能拼出，未入账的 draft 于是从 board 的孤儿行（`face/board-view.ts:525`）与 `--dry-run`（`face/preview.ts:129`）上静默消失。「同理」是指针不是门，两处各有一条把门方式：

- **`isCarrierName`**：扫描面只认 `draft` / `final` 两种 kind 的形状（`(?:-a\d+)?` 插在 `.c\d+` 之前），且新尝试的名字在其中；`-report.md` / `.log` / `-test-evidence.json` / `crash-` 前缀四种形状一律不入判定。
- **`orphanHandoffs`**：反向读从渲染表派生家族，且**必须解出 `-a{n}` 并把它留在认领键里**（legacy 拼写缺该坐标时取 1），使新 attempt / cycle 名下写的载体归属到它自己的 `(line, op, cycle, attempt)`。反向读表每族至少留**一条 legacy 拼写**，否则 pathless 的历史行无主：`tasks-{tasks}-implement.json` 读成 `cycle 1 · attempt 1`（implement 族的 attempt-1 旧拼写，§2.6）、`{line}-{op}-{round}.json` 读成该 round 的 `attempt 1`、退役的 `{spec}-{op}-{round}.json` 孪生名同 round 同 attempt 1——「记录身份会铸出的名字」于是对旧拼写也成立，而不是只对新名字成立。夹具——未入账的 `-a2` draft 被列出一次，已入账的不列；legacy 形 `tasks-1-implement.json` 在 pathless 行（legacy `rounds: {implement: [1]}` 折叠出的 `carrierPath: null` 记录）下算认领、不列孤儿。先剥 `-a{n}` 再匹配 legacy 拼写会把 attempt 抹平，attempt-1 的记录因此「认领」attempt-2 的文件（§2.12）。

#### 3.5 `crash` 的适用面被按 phase 收窄

把 `crash` 读成「非 work 轮不产」，写点与读点就一起落到空路径上：拒绝面与终止面对每个派发相位都写崩溃记录，`Lifecycle#capsuleLines` 的失败面与 resume 又按同一名字读回。把门方式：一条 review 轮崩溃夹具断言——崩溃记录落在 `crash-{line}-{op}-{cycle}[-a{n}].json` 上（attempt 2 落在带 `-a2` 的名字上，不覆盖 attempt 1），失败面 capsule 读到它，resume 决策读到的也是它。

#### 3.6 归属谓词放宽过头

把「完成轮认领」改成「任意记录认领」之后，最省事的下一步是继续放宽到「文件在，就算有主」——那孤儿面就消失了，而它的用处恰恰是发现「写了文件但没入账」的轮。把门方式：一条真正未入账的草稿仍列出（正反两例同时存在）。

#### 3.7 来源行退化成第二套分级

`crashed:` 行天然诱人：既然知道有 `contract-violation`，下一步就会有人拿它算「本轮崩溃数」或据此改下一跳。那是 D70 明令禁止的第二套判级。把门方式：一条断言——`next:` 字面、blocker 计数、`+N` 在「有崩溃记录」与「无崩溃记录」两个夹具下逐字节相同。

#### 3.8 drop 档吞掉负载字段

分档的边界必须由 `required` 声明驱动，不能在 `#materialize` 里手写一份字段清单——两处清单必然分叉，而分叉的方向总是「把 `severity` 也当成装饰」。装饰档是**推导值**：`PLANE_SLOTS` 减本面的 `PLANE_REQUIRED`（`session/handoff-schema.ts:97` / `:108`；judge 面的 `artifacts` 与 work 面的 `dispositions` 都在其中），finding 内部同理；写成枚举等于把这道减法抄了一遍，抄的那份迟早与声明分叉。把门方式：`severity` / `findings` / `status` 的坏值仍 BLOCKED 的三条 pin，与 `line: null`、judge 面 `artifacts` 坏值被接受的两条 pin 同批。

#### 3.9 层判据收窄一收到底

「已闭合不受层判据」若写成「层判据整体撤销」，未闭合 wave 的跨层就再也不红。把门方式：一个未闭合 wave 跨层的红例与一个已闭合 wave 事后改依赖的绿例并存。

### Acceptance criteria

- 单射性网格 pin 绿：六个 `TargetType` × 适用 kind × attempt 1–3 × cycle 1–2，同一 kind 下任意两个不同身份不同名；`""` 不入比较；implement 的 draft/final 对、相邻 attempt、相邻 cycle 各有一条具名断言；四个文档形各断言自己的拼写前缀。
- implement 的 `final ≠ draft` 且 final 带 `.c{cycle}`；draft / report / log / evidence 同样携 `-{cycle}`（§2.2），相邻 cycle 不同名。
- 记录不带路径仍可读：`carrierPath` / `draftPath` 不再写入新记录；board 的 `+N`、`--reviews` 的 latest 解析、`CliLifecycle#reviewsPath`、`FixDispositions` 的 requester 路径、capsule 成功面、摘要读面全部经 `Ledger#carrierPathOf(type, key, record)` 派生（守卫 pin：`RoundNaming` 与 accessor 之外零 `carrierPath` 读、零名字拼装——§2.12 的 legacy 认领档把记录侧的值也交给 accessor，所以 `Ledger#orphanHandoffs` 不开例外）。
- 重派到 attempt 2 的 fix 轮仍读 requester 自己的 attempt：一条 attempt-2 fix 夹具断言 `--reviews` / `INPUT_REVIEWS` / `FixDispositions#requesterInputOf` 解析到 review 记录（attempt 1）的 final 名、合法轮次不被硬拒，`#resumeOf` 写出的 `next` 也带同一个名字。
- `HandoffParams.attempt` 贯通：attempt 2 的 draft / final / report / log 由 `render` 命名，`readHandoff` 与 `handoffName` / `handoffPath` 命名并读回的就是 attempt 2 自己的文件；`--reviews` 读回的是 requester review 记录自己的 attempt（上一条夹具）。
- 重派过的 cycle 读回同一条记录：一条 review cycle 重派到 attempt 2（`attempt 2` 已入账、`attempt 1` 的 final 仍在盘上）的夹具断言——`Ledger#round` / `Lifecycle#routeNext` / `#consecutiveS1Run` 读回 `attempt 2` 自己的字节并比它自己的摘要，零 `carrier-mismatch`；`readHandoff` 显式带 `attempt: 1` 时读回 `attempt 1` 的文件与 `attempt 1` 的摘要。名字与摘要必须来自同一条记录。
- 解析读者不继承派发帧的 attempt：一条 attempt-2 fix 帧（review 记录停在 attempt 1）的夹具断言——`Ledger#round("fix", …, attempt 2)` 非 null，`Round.reviewsPath` 是 review 记录 attempt 1 的 final 名（不是 `…-a2` 的幽灵名），`Round.consecutiveS1` 与 attempt-1 的读数一致，`Lifecycle#routeNext` 仍产出重评审那一跳。
- accessor 自探存在：doc / wave / branch 线各一条「记录在、载体与阶梯两个候选都不存在」的夹具断言 accessor 返回空、该轮落到 `RequesterRead.unrecorded` 的 soft skip 而非 `unreadable` 硬拒；attempt-2 记录的 accessor 断言其名字与摘要同来自 attempt 2（不缺喂 `HandoffParams.attempt`）。
- preflight / seal 同批对齐：attempt 2 的派发只 unseal attempt-2 的 draft/final 对，attempt-1 的一对在轮内不可写；terminal（gate 拒 / death / abort）seal 同一对；崩溃遗留的 `-a{n}` 载体被 sweep 认出并封印。
- 重派 N 次（N ≥ 2）后：旧 attempt 的记录仍可读，board 零 `carrier-mismatch`；每个 attempt 的 `+N` 来自它自己的产物。
- 外部篡改仍抛 `carrier-mismatch`（owner 记录的摘要与产物字节不符）——保护不退化。
- `report` / `evidence` / `crash` 在重派后不再覆盖上一轮的文件；`crash` 对每个派发轮适用（review 轮的崩溃记录落在渲染名上，失败面与 resume 读得回）。
- legacy 三类各有一条 pin：无摘要记录（零比对）· 已失配的历史记录（present-facts，不抛，`+N` = 0，owner 判定来自 `RoundRecords#ownerOf(行全量记录, 记录)`）· 旧命名文件（按记录的路径读）。
- legacy 无 `carrierPath` 行照常把门：一条 pre-P31 行（记录整条无该字段）其载体落在 canonical 名上的夹具断言 accessor 按 `resolveHandoffName` 阶梯解析到该文件、fix 轮读到它的 findings 并照常判 dispositions（零摘要比对），不因「记录无路径」翻成 `unrecorded`；载体确实缺席的行仍落到 `RequesterRead.unrecorded` / `FIX_DISPOSITIONS_UNRECORDED` 的 soft skip。同族的 implement 变体一条：legacy `rounds: {implement: [1], review: [1]}` 折叠出的 pathless 行（`carrierPath: null`）与磁盘上的 `tasks-1-implement.json`——孤儿面按反向读的 legacy 拼写把它认给 `(implement, cycle 1, attempt 1)`、不列孤儿，同一行的 `-a2` 新 draft 仍被列出一次。
- 写面不调用 `families` 占位表；`RoundNaming`（含 accessor 委派）之外零产物名拼装（两条守卫测试）。
- 扫描面只认 `draft` / `final` 两种 kind，`-a{n}` 形状被识别；`report` / `evidence` / `crash` 不被当作载体。
- 反向归属认新拼写且认 attempt：未入账的 `-a2` draft 在 `orphanHandoffs` / board 孤儿行 / `--dry-run` 上出现恰好一次，已入账的同名 draft 不出现；同一 `(line, op, cycle)` 的 attempt-1 记录**不**认领 attempt-2 的文件（认领键含 `attempt`）；`tasks-6,7-implement-1.json` 归属到 `(6,7) · implement · cycle 1 · attempt 1`；legacy 行由 `carrierPath` 直指的目录形记录值经 `path.basename` 两侧比较同样算认领。
- `attempt === 1` 的守恒边界按 §2.6 断言：四类文档线 · wave 线 review/fix 族 · branch 线 review/fix 族 · 全部 `crash` 名逐字节不变（branch fix 的 `branch-fix-1.json` / `branch-fix-1.c1.json` / `branch-fix-1-report.md` / `branch-fix-1.log` 在其中）；implement 族的 draft/final/report/log/evidence 与全线的 evidence 名是新拼写，各有具名断言。
- 一条 BLOCKED / abort 但已落载体的轮不再列孤儿；一条真正未入账的草稿仍列一次；legacy 行由 `carrierPath` 直指的文件同样算认领。
- board 的 `crashed:` 行按记录列出 cause 与 `(cycle, attempt)`，每轮一个 token（取记录顺序里第一条 hard 条目），成员谓词要求至少一条 hard 条目（`violations.some((v) => v.grade === "hard")`）；`✗` 保留；一条只带 soft `#logUnavailable` 的 APPROVED 评审**不**出现在该行，一条 child 声明 BLOCKED 但未写回文档（只带 `WRITE_BACK_UNMEASURED` 一条 soft）的轮也**不**出现；`+N`、blocker 计数与 `next:` 字面在有无崩溃记录两种夹具下逐字节相同。
- `line: null` 的 review 载体被接受（drop 该键 + 一条 soft observation 进记录的 `violations[]`，`RoundViolation.soft`），轮次照常结束且引擎写出的载体自过 `CARRIER` 声明；judge 面的 `artifacts` 坏值与 `notes` 坏值同档（drop + soft，不搬进载体，doc 型评审不再因此 BLOCKED）；`severity` / `findings` / `status` 的坏值仍 BLOCKED。
- 事后追加任务使已闭合 wave 与新算层不匹配时零红；未闭合 wave 跨层仍红——红例的开放集来自 `LedgerFacts.openWaves`（与 `closedWaves` 同批装配）；`planned-tasks-vs-recorded-tasks` 仍只判「已记录而当前 plan 不再携带」一个方向，快照列不参与该规则。
- 引擎 vitest 全绿；`pnpm run validate` exit 0；changeset `cdd-engine` **minor**；不发布。

## Constraints

- 不动 `next:` 字面（D70 收敛主线）。
- 不改 `progress.json` 的形状：只停写 `carrierPath` / `draftPath` 两个字段，不迁移旧值。
- 不加运行时守护门（§2.3 的构造属性判定）。
- seal 窗口的文件集不扩：仍是 `draft` + `final` 两个载体，`report` / `log` / `evidence` / `crash` 不进窗口（§2.11）。
- legacy 回退只读，不得参与身份推导。
- 来源行不加字形、不进 legend 词表、不参与任何计数（§2.13）。
- 闭合 wave 的层权威收窄不新增持久字段（§2.15）。
- drop 档只覆盖非 `required` 字段；`required` 全集不缩（§2.14）。
- 不引入新依赖；不发布。

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-11-13 | P34 初稿：产物名收为轮次身份的单射渲染（`(line, op, cycle, attempt)` × `kind` 一处派生）· implement 补 cycle 坐标 · 写一次作构造属性 · `carrierPath`/`draftPath` 新记录退役 · 记录缺席回退 attempt 1 · attempt=1 逐字节守恒 · legacy 失配行 present-facts。作用面覆盖 carrier / report / evidence / crash（log 已有）。 | '[human] 裁定 · Claude（kairos:cdd-design · 2026-11-13）' |
| v0.2 | 2026-11-13 | 并入 phase-spec-review-1 全部十条。F1 新增 §2.10 读写缝（`Ledger#carrierPathOf` 一个 accessor + `HandoffParams.attempt` + 四条读面改写 + 摘要面不动）；F2 新增 §2.11 preflight/seal 与本轮 attempt 同批（含崩溃遗留的 sweep 与 legacy 轮）；F3 改正 crash 适用面为「每一个派发轮」并新增 §3.5 pin；F4 把 implement 的 cycle 补到全部 kind（§2.2）并重写 §2.6 为守恒 + 例外清单；F5/F6 对齐母 charter 回填（D88 · P34 行 · overall v3.59：全部轮次产物 + `draftPath` 同批退役 · 签名 `(line, op, cycle, attempt) × kind`），`parent-version` 随行 v3.59；F7 点名 owner 判据 `RoundRecords#ownerOf`（§2.7）；F8 网格改按适用对比较、覆盖六个 `TargetType`（§3.1）；F9 守恒示例改回规范拼写 `phase-spec-review-1.c1.json`；F10 统一用「单射性」。 | '[human] 裁定 · Claude（kairos:cdd-dev · phase-spec-fix-1 · 2026-11-13）' |
| v0.3 | 2026-11-13 | 并入 phase-spec-review-2 两条。F1：母 charter 的守恒边界回填为与 §2.6 同一条（overall v3.60 · D88 · Issue inventory P34 ⑤ · Phase inventory P34 scope + acceptance 格），§2.6 的字节 pin 不动；F2：§3.4 的扫描面符号改正为 `RoundNaming.isCarrierName`（`CarrierSeal.sweep` 的消费面），`CarrierSeal.isCarrierName` 不存在。 | '[human] 裁定 · Claude（kairos:cdd-dev · phase-spec-fix-2 · 2026-11-13）' |
| v0.4 | 2026-11-13 | **§2.2 符号回填（plan-review-1 F7 · 设计文档事实错误）**：implement 的 cycle 常量持有者是 `Lifecycle#roundFor`（`session/run.ts:617`），树里没有 `Run` 类（`session/ledger.ts:801` 注释里的 `(Run)` 是陈旧散文）。设计意图与结论不变，只纠正引用；plan 的 Review Focus 条目由计划 fix 轮同笔改。 | '[human] 裁定 · Claude（kairos:cdd-plan · backfill-design · 2026-11-13）' |
| v0.5 | 2026-11-13 | 并入 phase-spec-review-3 三条。F1：§2.2 的 cycle 常量持有者回到 `Lifecycle#roundFor`（`session/run.ts:617`），树里无 `Run` 类，v0.4 行同笔改写。F2：§2.10 补第五读面 `CliLifecycle#reviewsPath` 并改正 `ctx.reviewsPath` / `INPUT_REVIEWS` / `#resumeOf` 的来源；`--reviews` 的 attempt 改取 requester review 记录自己的最新 attempt，recorded-path 直读与 `FixDispositions#requesterPathOf` / `#requesterDigestOf` / `#ownRefusal` 的路径判别同批退役；点名 `Lifecycle#capsuleLines` 是名字解析面而非路径读面；acceptance 增 attempt-2 fix 夹具。F3：§2.5 的守恒 gloss 收回为 §2.6 的例外边界。 | '[human] 裁定 · Claude（kairos:cdd-dev · phase-spec-fix-3 · 2026-11-13）' |
| v0.6 | 2026-11-13 | 并入 phase-spec-review-4 四条。F1：§2.10 补摘要半边——`#carrierDigestOf` / `#latestRecordOf` 认 `params.attempt`，名字与摘要取同一条记录，`Ledger#round` / `#consecutiveS1Run` 及其调用点传记录自己的 attempt，`--reviews` 除外；acceptance 增重派 cycle 的读回夹具。F2：§2.10 的 accessor 取值改为三步（记录路径 → `resolveHandoffName` 阶梯 → 真缺席），`unrecorded` soft skip 保留，acceptance 增无 `carrierPath` 的 legacy 行夹具。F3：§3.4 给 `orphanHandoffs` 单列把门方式与夹具（反向读认新拼写，implement 补 cycle 与 `-a{n}` 都归属得回）。F4：§2.6 的守恒侧补「branch 线的 fix 族」，acceptance 字节 pin 同步。 | '[human] 裁定 · Claude（kairos:cdd-dev · phase-spec-fix-4 · 2026-11-13）' |
| v0.7 | 2026-11-13 | 并入 phase-spec-review-5 三条。F1：§2.10 的 accessor step 2 点名阶梯的种子身份——accessor 先由记录还原 `render(id, final)`（`line = type` · `op = record.op` · `cycle = record.cycle` · `attempt = record.attempt`，wave 线 `tasks = key`），名字与摘要恒同源，`HandoffParams.attempt` 缺省 1 不是坐标缺省。F2：step 3 改写成 accessor 自己探存在（阶梯对非退役 type 的 canonical 级无存在判定），`unrecorded` soft skip 与 `#requesterInputOf` 硬拒的分界随行写清。F3：摘要半边的 attempt 规则按「是否已持有记录」分两类，`#reviewsPathOf` 与 `#consecutiveS1Run` 归入解析类（先取该轮最新 review attempt、不继承 fix 帧的 attempt）；acceptance 增 attempt-2 fix 帧仍出 Round 与 accessor 自探存在两条夹具。 | '[human] 裁定 · Claude（kairos:cdd-dev · phase-spec-fix-5 · 2026-11-13）' |
| v0.8 | 2026-11-13 | **并入四条同族面（issue #470 消费者 comment · 用户裁定「全并」）**：§2.12 孤儿归属改为记录归属（`targetAction` 过滤是把「完成」当「认领」，与 board 的 `no recorded round owns it` 不符）；§2.13 崩溃/中断轮的 `crashed:` 来源行（`✗` 保留，明确不参与分级）；§2.14 可选字段坏值 drop + soft（`line: null` 不再否决整轮，required 面不放宽）；§2.15 闭合 wave 的层权威收窄（层判据只判未闭合，闭合面交 `planTasks` 快照）。新增 §3.6–§3.9 失败面与四条 AC；相位命题从「产物身份」扩为「账本记录与磁盘产物互相对得上」。 | '[human] 裁定 · Claude（kairos:cdd-design · 2026-11-13）' |
| v0.9 | 2026-11-14 | 并入 phase-spec-review-6 九条（F3 按调度方裁定 REJECTED，`#bookkeep` 原文不动）。F1：§2.12 的归属键收为完整渲染身份 `(line, op, cycle, attempt)`——attempt-free 的 `(op, cycle)` 会让 attempt-1 的记录认领 attempt-2 的文件，与 `-a2` 一次夹具直接互斥；§3.4 的反向读改为「解出 `-a{n}` 并保留」。F2：§2.13 的成员谓词改为 `targetAction === false && violations.length > 0`（成功轮也带 soft `#logUnavailable`），并补一行一轮取首条 hard 的口径。F4：§2.12 的 legacy 档点名 `path.basename` 两侧比较（`carrierPath` 是含目录的绝对形，不在 `PERSISTED_PATH_KEYS` 里）。F5：§2.15 把闭合面的证据改回 `planned-tasks-vs-recorded-tasks` 的真实读法（当前 plan、单向），快照列归 append-vs-stall——v0.8 行的「闭合面交 `planTasks` 快照」措辞由本节更正。F6：§2.15 补 `LedgerFacts.openWaves` 装配格作未闭合 wave 的来源。F7：§2.14 的 drop 缝写清为校验走查 tier-aware + `#findingsList` 嵌套剥键，`#materialize` 只是顶层那一半。F8：§2.14 / §3.8 的装饰档改为 `PLANE_SLOTS` 减 `PLANE_REQUIRED` 的推导值。F9：`parent-version` 与正文两处提到 v3.61 并引 D89。F10：§2.13 补一行一轮的 token 口径。母 charter 的 D89 措辞（`(op, cycle)` 归属键、「闭合面交 `planTasks` 快照」）需由编排者另起一笔回填，本相位不动。 | '[human] 裁定 · Claude（kairos:cdd-dev · phase-spec-fix-6 · 2026-11-14）' |
| v0.10 | 2026-11-14 | 并入 phase-spec-review-7 五条。F1：§2.14 的 drop 缝补齐为三处——加 `#materialize` 的顶层拷贝点（`face/lifecycle.ts:1608` · `:1613` · `:1615`，`#check` 只判不写）并点名 soft observation 的落点（`RoundViolation.soft` → 记录的 `violations[]`），acceptance 同笔断言载体自过 `CARRIER` 声明。F2：§2.12 的归属判据改为反向读（name → identity，缺坐标读 1），§3.4 的反向读表每族留一条 legacy 拼写（`tasks-{tasks}-implement.json` = cycle 1 · attempt 1），acceptance 增 pathless legacy implement 行夹具（p16 形）。F3：§2.13 的成员谓词收为「至少一条 hard 条目」（`violations.some((v) => v.grade === "hard")`），soft-only 的轮由谓词排除而非 token 规则，acceptance 增 soft-only BLOCKED 轮的反例。F4：§2.15 收回 `LedgerFacts` 的格子计数。F5：§2.12 的 legacy 认领档改经 `Ledger#carrierPathOf` 取值，acceptance 的守卫 pin 说明 `#orphanHandoffs` 不开例外。 | '[human] 裁定 · Claude（kairos:cdd-dev · phase-spec-fix-7 · 2026-11-14）' |
