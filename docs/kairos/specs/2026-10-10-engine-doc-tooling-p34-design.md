---
title: '引擎文档工具（Engine Doc-Tooling）— P34 设计：载体身份收为轮次身份的单射渲染'
doc-type: phase-spec
version: v0.4
date: 2026-11-13
slug: '2026-10-10-engine-doc-tooling-p34'
program: 2026-10-10-engine-doc-tooling
parent-version: v3.60
author: '[human] 裁定 · Claude（kairos:cdd-design · 2026-11-13）'
---

## Design

本相位治 `cdd board` 在长回合 slug 上整块 `carrier-mismatch` 拒渲染（issue #470）。根因不是 board 取错了记录，而是**轮次身份与产物名身份是两个不同构的系统**：记录带 `attempt`，产物名不带；implement 一族连 `cycle` 都缺。于是重派一次就合法覆盖上一轮的物证，旧记录的内容摘要永久指向别人的字节。

裁定不取「加个后缀」「按所有者限定校验」「降级渲染」这类对账式修法，而是把两者收成同构：**产物名 = 轮次身份 × 产物种类的单次渲染**，单射由构造保证，写一次成为自然结果（§2.1–§2.3）。同一缺陷在 `report` / `evidence` / `crash` 三类产物上早已存在、只因没有摘要无人察觉，故作用面覆盖全部轮次产物（§1.2）。

身份与签名已由母 charter 回填（D88 · Phase inventory P34 行 · overall v3.60）：身份是 `(line, op, cycle, attempt)`，`kind` 是第二个参数、`role` 不再作为参数名，作用面是全部轮次产物，`carrierPath` 与 `draftPath` 同批退役。本文与该登记逐条对齐，不再另立形态。

### 1. 病根

#### 1.1 同一轮次有两个身份，且第二个不是单射

`RoundRecord` 的身份是 `(op, cycle, attempt)`（`session/ledger.ts` 的 `RoundRecord` 类型）；产物名的身份是 `(line, op, cycle)`——`RoundNaming.finalName` 只在名字尾部拼 `.c{round}`，`#stem` 对 implement 一族直接省掉 round 令牌，家族名则由 `Ledger.handoffName` 从 `config.handoffNamespace().families` 的 `{tasks}` / `{round}` 占位替换里取。

非单射的后果只有一个方向：**同一路径被两个身份共用**。implement 面上 `finalName` 在无 round 时原样返回 draft 名，`Ledger.persistHandoff` 据此把 materialize 后的 final 写在 child 的 draft 之上；下一次 attempt 的 child 又往同一个 draft 路径写。第 1 次 attempt 的摘要（记录里的 `carrierDigest`）从此指向第 2 次 attempt 的字节。

顺带纠正 issue 里一句归因：board 不是「取最早的 attempt」。`BoardView#findingsCountOf` 逐条记录用**该记录自己的**摘要读**该记录自己的**路径；任何一条被合法覆写的历史记录都会抛。问题在于这种记录必然存在，而不在取哪一条。

#### 1.2 摘要只兜住了四类产物中的一类

`RoundNaming.logName` 早就带 `-a{attempt}`，注释写明 attempt 1 的 log 永不被覆盖；`report` / `evidenceName` / `crashName` 三处都没有这个坐标。重派同样在销毁上一轮的评审报告、测试证据与崩溃记录——只是它们没有内容摘要，坏了没有任何面会喊。

所以缺陷类不是「载体名少了 attempt」，而是「**每轮产物名不是轮次身份的渲染**」；载体只是唯一带摘要、因而唯一会被发现的那个实例。

这条推论就是作用面从「载体」扩到「全部轮次产物」的依据，也由母 charter 回填登记（D88 · Phase inventory P34 行 · overall v3.60：`kind ∈ {draft, final, report, log, crash, evidence}`）。本相位不越登记面：`draftPath` 与 `carrierPath` 同批退役是同一条的必然（留一个是半个真源），同样已在 D88 与 P34 行登记。

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

补的是全部 kind，不只 final：cycle 若只出现在 final 上，draft / report / log / evidence 仍会在 cycle 之间共用一格，§1.2 那条「重派销毁上一轮的物证」就在本族内原样残留。今天 implement 的 cycle 恒为 1（`Run#roundFor` · `session/run.ts` · 对该相位返回固定值），所以这个令牌当下不区分任何两轮；正因为如此，把它留给运行面那个常量去保证，单射性就依赖 `RoundNaming` 之外的一条事实，而本相位的第一原则恰恰是名字只从身份派生。

#### 2.3 写一次是构造属性，不加门

新 attempt 必然落到不同的名字上，「覆盖上一轮」这个动作在新面里不被表达 → 不需要运行时守护（seal 状态检查 / 重写即拒）。以一条结构 pin 把门：同一身份的两个种类名不同，相邻 attempt 名不同。

P31 §2.4 的 unseal / seal 窗口照旧存在，它管的是「谁在这一轮的窗口里可写」，不承担去重；窗口的成员必须与本轮的渲染同源（§2.11）。

#### 2.4 真源收窄：`carrierPath` / `draftPath` 在新记录退役

两者都是同一身份两个坐标的副本，路径由 `render` 派生（派生的唯一读缝见 §2.10）。字段保留，但只服务 legacy 行，且明确不参与身份推导。

兼容判别**逐条记录**，不引入工作区级版本标记（`ProgressData` 没有版本字段，引擎只看得见记录与文件）。一条记录判三件事——有没有摘要、是不是它那个路径的 owner（§2.7）、路径是否等于 `render` 的输出。

#### 2.5 记录缺席时回退取 attempt 1

凡派发过的轮无条件入账（P22 ②），所以「无记录」只可能是第 1 次派发，回退取 `attempt 1`（即今天的家族名，逐字节不变）。不为旧引擎「blocked 轮不入账」的边缘去扫目录猜最大 attempt。

#### 2.6 attempt=1 的渲染逐字节守恒（implement 族与 evidence 除外）

attempt 1 省略 `-a{1}`，所以历史文件与历史记录零迁移可读：`phase-spec-review-1.json` · `phase-spec-review-1.c1.json` · `phase-spec-review-1-report.md` · `phase-spec-review-1.log` · `crash-phase-spec-review-1.json` 这类拼写不变；只有 attempt ≥ 2 才多出 `-a{n}` 坐标。

两处例外是有意的坐标补足（§2.2、§2.1），不是守恒的遗漏：

- **implement 族**：draft / final / report / log 从「无 cycle」变为携 `-{cycle}`（draft `tasks-6,7-implement.json` → `tasks-6,7-implement-1.json`，final 是同 stem 加 `.c{cycle}`）。`crash` 名今天已携 cycle（`crash-tasks-6,7-implement-1.json`），逐字节不变——这恰好说明缺位只在本族的非 crash 面上。
- **evidence**：今天只携 line（`tasks-6,7-test-evidence.json`），implement 与 fix、各 cycle、各 attempt 共用一格；改为携 op / cycle / attempt（`tasks-6,7-implement-1-test-evidence.json` · `branch-fix-1-test-evidence.json`）。

于是守恒判据的边界是：四类文档线、wave 线的 review / fix 族、branch 线的 review 族、以及全部 `crash` 名逐字节不变；implement 族的五个非 crash kind 与全线的 evidence 名换新拼写（消费面可见，故 changeset 取 **minor**）。

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

**一个 accessor**：`Ledger#carrierPathOf(type, key, record)`——记录的载体路径。取值顺序固定：记录里的 `carrierPath` 存在就用它（legacy 行的历史事实，零迁移），否则由该记录的身份 `renderPath(…, final)` 派生。行的 line 与 type 由调用方持有（记录本身不带 line，这是行的键），所以 accessor 收 `(type, key, record)` 三样，绝不从记录本身猜 line。

四条读面改写为经它取路径，语义不变：

- `BoardView` 的 `+N` 计数：路径来自 accessor，摘要来自记录的 `carrierDigest`，owner 判定来自 §2.7；
- `Ledger#reviewsPathOf`：requester 是同一 (key, op, round) 的**最新 review attempt**，其 final 由 accessor 给出；无记录时回退家族名并取该 review 的最新 attempt（无则 1，§2.5）；
- `FixDispositions` 的 requester 路径：字段退役后「优先记录里的路径」这一支消失——requester 路径就是 lifecycle 已解析的 `ctx.reviewsPath`（其来源正是 `#reviewsPathOf`），digest 仍按同一条 requester 记录取；
- `Lifecycle#capsuleLines` 的成功面：`resolveHandoffPath` 带上帧的 `attempt`，名字只经渲染面来。

**`HandoffParams` 补 `attempt`**：`{tasks, round, attempt}`。派发产出的 params 恒带帧的 `attempt`，于是 `handoffName` / `handoffPath` / `resolveHandoffName` / `resolveHandoffPath` / `readHandoff` / `--reviews` 都能命名并读回第 n attempt 的文件；`attempt` 缺省即 1（legacy 调用与 §2.5 的回退同一条规则）。

**摘要面不动**：`carrierDigest` 保留——它才是完整性事实。`CarrierIntegrity.readFor` 的「从记录里取路径」职责退役，读面传 `(accessor 给出的路径, record.carrierDigest)`；`persistHandoff` 的写点也随 `draftPath` 一起收窄为「写 `render(id, final)`、封印 draft + final 两个名字」。

**`OUTPUT_HANDOFF`** 是 `render(id, draft)`：child 的写点与引擎的读点同源，不经过任何占位表。

#### 2.11 preflight / seal 窗口与本轮同一 attempt 同批对齐

P31 §2.4 的窗口成员必须与本轮渲染同源，否则新名字让人「打开错的窗」：打开的若是无 attempt 的名字，对一次重派来说那是历史轮的文件，本轮真正要写的 draft / final 反而没开，而历史文件在整个窗口里可写。

**窗口 = `[render(id, draft), render(id, final)]`**，`id` 是本轮的完整身份：preflight `#openRoundCarriers` 在 `CarrierSeal.sweep` 之后只 unseal 这一对，terminal（gate 拒、death、abort fold）seal 同一对。因此 `CliLifecycle#roundCarrierNamesOf` 收 `attempt`：帧路径取帧的 `attempt`，abort fold 取那条**记录自己的** `attempt`（记录带它，绝不重推）。

**崩溃遗留**：一对 attempt 形状的载体由 preflight 的 `CarrierSeal.sweep` 认出并封印，前提是扫描面认得 `-a{n}`（§3.4）；sweep 之外不扫第二遍，resume 也不需要猜——同一身份同一 attempt 的名字由同一 `render` 复现。

**legacy 轮**：当前 attempt 就是 1，窗口名与历史名同字节，打开的是它自己那一对，不是别人的文件。禁止的是 preflight 打开一个不属于本轮 attempt 的名字（今天的 `finalPath(draftName, params.round)` 在 implement 族打开的就是这一对里的同一个名字，退役后由 `render` 的两条 kind 分岔）。

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

`-a{n}` 进名字之后，按名字扫目录的两处会错：`RoundNaming.isCarrierName`（`infra/carrier-seal.ts` 的 `CarrierSeal.sweep` / `#isStray` 消费它）的 pattern 若不接受 `-a{n}`，崩溃遗留的载体就 sweep 不到（残留可写，§2.3 判它不可能存在的窗口）；若反过来放宽过头，`report` / `evidence` / `crash` 会被当成载体 seal 或当孤儿列上 board。`orphanHandoffs` 的家族归属读法同理。把门方式：扫描面只认 `draft` / `final` 两种 kind 的形状（`(?:-a\d+)?` 插在 `.c\d+` 之前），且新尝试的名字在其中；`-report.md` / `.log` / `-test-evidence.json` / `crash-` 前缀四种形状一律不入判定。

#### 3.5 `crash` 的适用面被按 phase 收窄

把 `crash` 读成「非 work 轮不产」，写点与读点就一起落到空路径上：拒绝面与终止面对每个派发相位都写崩溃记录，`Lifecycle#capsuleLines` 的失败面与 resume 又按同一名字读回。把门方式：一条 review 轮崩溃夹具断言——崩溃记录落在 `crash-{line}-{op}-{cycle}[-a{n}].json` 上（attempt 2 落在带 `-a2` 的名字上，不覆盖 attempt 1），失败面 capsule 读到它，resume 决策读到的也是它。

### Acceptance criteria

- 单射性网格 pin 绿：六个 `TargetType` × 适用 kind × attempt 1–3 × cycle 1–2，同一 kind 下任意两个不同身份不同名；`""` 不入比较；implement 的 draft/final 对、相邻 attempt、相邻 cycle 各有一条具名断言；四个文档形各断言自己的拼写前缀。
- implement 的 `final ≠ draft` 且 final 带 `.c{cycle}`；draft / report / log / evidence 同样携 `-{cycle}`（§2.2），相邻 cycle 不同名。
- 记录不带路径仍可读：`carrierPath` / `draftPath` 不再写入新记录；board 的 `+N`、`--reviews` 的 latest 解析、`FixDispositions` 的 requester 路径、capsule 成功面、摘要读面全部经 `Ledger#carrierPathOf(type, key, record)` 派生（守卫 pin：`RoundNaming` 与 accessor 之外零 `carrierPath` 读、零名字拼装）。
- `HandoffParams.attempt` 贯通：attempt 2 的 draft / final / report / log 由 `render` 命名，`readHandoff` 与 `--reviews` 读回的就是 attempt 2 自己的文件（一条 attempt-2 夹具）。
- preflight / seal 同批对齐：attempt 2 的派发只 unseal attempt-2 的 draft/final 对，attempt-1 的一对在轮内不可写；terminal（gate 拒 / death / abort）seal 同一对；崩溃遗留的 `-a{n}` 载体被 sweep 认出并封印。
- 重派 N 次（N ≥ 2）后：旧 attempt 的记录仍可读，board 零 `carrier-mismatch`；每个 attempt 的 `+N` 来自它自己的产物。
- 外部篡改仍抛 `carrier-mismatch`（owner 记录的摘要与产物字节不符）——保护不退化。
- `report` / `evidence` / `crash` 在重派后不再覆盖上一轮的文件；`crash` 对每个派发轮适用（review 轮的崩溃记录落在渲染名上，失败面与 resume 读得回）。
- legacy 三类各有一条 pin：无摘要记录（零比对）· 已失配的历史记录（present-facts，不抛，`+N` = 0，owner 判定来自 `RoundRecords#ownerOf(行全量记录, 记录)`）· 旧命名文件（按记录的路径读）。
- 写面不调用 `families` 占位表；`RoundNaming`（含 accessor 委派）之外零产物名拼装（两条守卫测试）。
- 扫描面只认 `draft` / `final` 两种 kind，`-a{n}` 形状被识别；`report` / `evidence` / `crash` 不被当作载体。
- `attempt === 1` 的守恒边界按 §2.6 断言：四类文档线 · wave 线 review/fix 族 · branch 线 review 族 · 全部 `crash` 名逐字节不变；implement 族的 draft/final/report/log/evidence 与全线的 evidence 名是新拼写，各有具名断言。
- 引擎 vitest 全绿；`pnpm run validate` exit 0；changeset `cdd-engine` **minor**；不发布。

## Constraints

- 不动 `next:` 字面（D70 收敛主线）。
- 不改 `progress.json` 的形状：只停写 `carrierPath` / `draftPath` 两个字段，不迁移旧值。
- 不加运行时守护门（§2.3 的构造属性判定）。
- seal 窗口的文件集不扩：仍是 `draft` + `final` 两个载体，`report` / `log` / `evidence` / `crash` 不进窗口（§2.11）。
- legacy 回退只读，不得参与身份推导。
- 不引入新依赖；不发布。

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-11-13 | P34 初稿：产物名收为轮次身份的单射渲染（`(line, op, cycle, attempt)` × `kind` 一处派生）· implement 补 cycle 坐标 · 写一次作构造属性 · `carrierPath`/`draftPath` 新记录退役 · 记录缺席回退 attempt 1 · attempt=1 逐字节守恒 · legacy 失配行 present-facts。作用面覆盖 carrier / report / evidence / crash（log 已有）。 | '[human] 裁定 · Claude（kairos:cdd-design · 2026-11-13）' |
| v0.2 | 2026-11-13 | 并入 phase-spec-review-1 全部十条。F1 新增 §2.10 读写缝（`Ledger#carrierPathOf` 一个 accessor + `HandoffParams.attempt` + 四条读面改写 + 摘要面不动）；F2 新增 §2.11 preflight/seal 与本轮 attempt 同批（含崩溃遗留的 sweep 与 legacy 轮）；F3 改正 crash 适用面为「每一个派发轮」并新增 §3.5 pin；F4 把 implement 的 cycle 补到全部 kind（§2.2）并重写 §2.6 为守恒 + 例外清单；F5/F6 对齐母 charter 回填（D88 · P34 行 · overall v3.59：全部轮次产物 + `draftPath` 同批退役 · 签名 `(line, op, cycle, attempt) × kind`），`parent-version` 随行 v3.59；F7 点名 owner 判据 `RoundRecords#ownerOf`（§2.7）；F8 网格改按适用对比较、覆盖六个 `TargetType`（§3.1）；F9 守恒示例改回规范拼写 `phase-spec-review-1.c1.json`；F10 统一用「单射性」。 | '[human] 裁定 · Claude（kairos:cdd-dev · phase-spec-fix-1 · 2026-11-13）' |
| v0.3 | 2026-11-13 | 并入 phase-spec-review-2 两条。F1：母 charter 的守恒边界回填为与 §2.6 同一条（overall v3.60 · D88 · Issue inventory P34 ⑤ · Phase inventory P34 scope + acceptance 格），§2.6 的字节 pin 不动；F2：§3.4 的扫描面符号改正为 `RoundNaming.isCarrierName`（`CarrierSeal.sweep` 的消费面），`CarrierSeal.isCarrierName` 不存在。 | '[human] 裁定 · Claude（kairos:cdd-dev · phase-spec-fix-2 · 2026-11-13）' |
| v0.4 | 2026-11-13 | **§2.2 符号回填（plan-review-1 F7 · 设计文档事实错误）**：implement 的 cycle 常量持有者是 `Run#roundFor`（`session/run.ts`），不是 `Lifecycle#roundFor` / `CliLifecycle#roundFor`——后者在树里不存在。设计意图与结论不变，只纠正引用；plan 的 Review Focus 条目由计划 fix 轮同笔改。 | '[human] 裁定 · Claude（kairos:cdd-plan · backfill-design · 2026-11-13）' |
