---
title: '引擎文档工具（Engine Doc-Tooling）— P34 设计：载体身份收为轮次身份的单射渲染'
doc-type: phase-spec
version: v0.1
date: 2026-11-13
slug: '2026-10-10-engine-doc-tooling-p34'
program: 2026-10-10-engine-doc-tooling
parent-version: v3.58
author: '[human] 裁定 · Claude（kairos:cdd-design · 2026-11-13）'
---

## Design

本相位治 `cdd board` 在长回合 slug 上整块 `carrier-mismatch` 拒渲染（issue #470）。根因不是 board 取错了记录，而是**轮次身份与产物名身份是两个不同构的系统**：记录带 `attempt`，产物名不带；implement 一族连 `cycle` 都缺。于是重派一次就合法覆盖上一轮的物证，旧记录的内容摘要永久指向别人的字节。

裁定不取「加个后缀」「按所有者限定校验」「降级渲染」这类对账式修法，而是把两者收成同构：**产物名 = 轮次身份 × 产物种类的单次渲染**，单射由构造保证，写一次成为自然结果（§2.1–§2.3）。同一缺陷在 `report` / `evidence` / `crash` 三类产物上早已存在、只因没有摘要无人察觉，故作用面覆盖全部轮次产物（§1.2）。

### 1. 病根

#### 1.1 同一轮次有两个身份，且第二个不是单射

`RoundRecord` 的身份是 `(op, cycle, attempt)`（`session/ledger.ts` 的 `RoundRecord` 类型）；产物名的身份是 `(line, op, cycle)`——`RoundNaming.finalName` 只在名字尾部拼 `.c{round}`，`#stem` 对 implement 一族直接省掉 round 令牌，家族名则由 `Ledger.handoffName` 从 `config.handoffNamespace().families` 的 `{tasks}` / `{round}` 占位替换里取。

非单射的后果只有一个方向：**同一路径被两个身份共用**。implement 面上 `finalName` 在无 round 时原样返回 draft 名，`Ledger.persistHandoff` 据此把 materialize 后的 final 写在 child 的 draft 之上；下一次 attempt 的 child 又往同一个 draft 路径写。第 1 次 attempt 的摘要（记录里的 `carrierDigest`）从此指向第 2 次 attempt 的字节。

顺带纠正 issue 里一句归因：board 不是「取最早的 attempt」。`BoardView#findingsCountOf` 逐条记录用**该记录自己的**摘要读**该记录自己的**路径；任何一条被合法覆写的历史记录都会抛。问题在于这种记录必然存在，而不在取哪一条。

#### 1.2 摘要只兜住了四类产物中的一类

`RoundNaming.logName` 早就带 `-a{attempt}`，注释写明 attempt 1 的 log 永不被覆盖；`report` / `evidenceName` / `crashName` 三处都没有这个坐标。重派同样在销毁上一轮的评审报告、测试证据与崩溃记录——只是它们没有内容摘要，坏了没有任何面会喊。

所以缺陷类不是「载体名少了 attempt」，而是「**每轮产物名不是轮次身份的渲染**」；载体只是唯一带摘要、因而唯一会被发现的那个实例。

#### 1.3 为什么只有渲染面受害

派发面读的是「最新 attempt」：`Ledger#latestRecordOf` 在 `#reviewsPathOf` 与摘要比对处都按 `attempt` 取最大，所以运行中的轮次从未观察到这个缺陷。受害的只有历史渲染（board 的 `+N`）与任何「重新读一条旧记录」的面——这也是它能在多轮评审里静默存活的原因。

### 2. 裁定

#### 2.1 一个身份，一处渲染：artifact = render(identity, kind)

身份 = `(line, op, cycle, attempt)`；产物种类 `kind ∈ {draft, final, report, log, crash, evidence}`。

`RoundNaming` 收这两个输入，一处渲染出名字。单射由构造保证：每个坐标都参与，唯一的省略是 `attempt === 1`（§2.6 的字节守恒），而省略不破坏单射——能与它撞名的只有它自己。

排版规则一条：`-a{n}` 插在 `{stem}` 与 kind 后缀之间（stem 尾部），`attempt === 1` 省略；`final` 另有 `.c{cycle}` 后缀，且该后缀对 implement 一族也必须出现（§2.2）。例：`tasks-6,7-implement-a2.c1.json`。

`attempt` 由 `RoundNaming.attemptOf` 在派发前一次性分配并随帧传递，`render` 只消费它，从不自行推算——两处各推一次就又是一条双真源。不适用的 kind 渲染空串（文档线不产 `evidence`、非 work 轮不产 `crash`），空串不是名字，调用方按「无此产物」处理。

`finalName(draftName, round)` 那种「拿到一个名字再切字符串拼后缀」的变换退役；`families` 占位表降为 legacy 只读回退（§2.4、§3.3）。

#### 2.2 implement 补 cycle 坐标

implement 一族的 final 必须带 `cycle` 令牌，`final ≠ draft` 恒成立。这是「种类是坐标」的直接后果（`render(id, draft) ≠ render(id, final)` 必须恒真），也是 P31 §2.3「final 永不覆盖 draft」第一次在该族兑现。

#### 2.3 写一次是构造属性，不加门

新 attempt 必然落到不同的名字上，「覆盖上一轮」这个动作在新面里不被表达 → 不需要运行时守护（seal 状态检查 / 重写即拒）。以一条结构 pin 把门：同一身份的两个种类名不同，相邻 attempt 名不同。

#### 2.4 真源收窄：`carrierPath` / `draftPath` 在新记录退役

两者都是同一身份两个坐标的副本，路径由 `render` 派生。字段保留，但只服务 legacy 行，且明确不参与身份推导。

兼容判别**逐条记录**，不引入工作区级版本标记（`ProgressData` 没有版本字段，引擎只看得见记录与文件）。一条记录判三件事——有没有摘要、是不是它那个路径的 owner（同路径存在更大的 `(cycle, attempt)`）、路径是否等于 `render` 的输出。

#### 2.5 记录缺席时回退取 attempt 1

凡派发过的轮无条件入账（P22 ②），所以「无记录」只可能是第 1 次派发，回退取 `attempt 1`（即今天的家族名，逐字节不变）。不为旧引擎「blocked 轮不入账」的边缘去扫目录猜最大 attempt。

#### 2.6 attempt=1 的渲染逐字节守恒

`spec-review-1.c1.json` 这类拼写不变；只有 attempt ≥ 2 才多出 `-a{n}` 坐标。历史文件与历史记录零迁移可读。

#### 2.7 legacy 失配行：present-facts，零迁移

一条记录若不是它那个路径的 owner，就不比对摘要、不抛、`+N` 计 0；owner 记录照常校验。对历史行引擎无法区分「合法覆写」与「篡改」，任何判断都是猜；present-facts 是既有的历史读法（与无摘要记录的零比对同款），且不需要动磁盘。board 不加标记——为一类不再复现的历史状态新增词表项与 pins 是拿债还债。

#### 2.8 否决的三条

- **把「按所有者限定校验」当作不变量**：那会把不变量从产物搬到读取纪律，且历史证据仍被销毁。它在本相位只作为 legacy 读法存在（§2.7）。
- **内容寻址**（`carriers/{sha}.json`）：单射天然成立，但摧毁可寻址交接——child 要往给定路径写 draft、`--reviews` 要命名一个文件、rulings 边车靠相邻命名。与六前提⑤冲突。
- **board 降级渲染 + `--strict` + `carrier reseal`**（issue 原建议）：掩盖真篡改，并把「重新封印」变成修复手段——等于把「引擎写过什么」降级成「现在看起来如何」。

#### 2.9 边界声明：issue 的另两条不属本相位

`BLOCKED` 退出码与 stale in-flight 可见性两项，当前树已具备：`Cli#normalizeExit` 对 `CarrierMismatchError` 走 CDD_BLOCKED 通道并返回 1；`BoardView#inFlightRows` 渲染 `pid` / `op` / `cycle` / `attempt` / `wave`，并对死持有者追加可接管提示。它们不进 scope。

### 3. 失败面

#### 3.1 单射退化无人喊

`report` / `evidence` / `crash` 没有摘要。若日后有人给 `render` 加一个条件（例如只在某个旗标下才拼 attempt），两类产物重新撞名，而这些产物不会红。把门方式：注入性做成跨 identity 网格的**性质 pin**（三个 line 形 × 六个 kind × attempt 1–3 × cycle 1–2；任意两个不同身份不得同名），而不是逐例断言。

#### 3.2 读面与写面各推一份名字

「名字从身份派生」只在 `RoundNaming` 里成立。一旦有读者回到「从参数自己拼一个名字」，同类缺陷重新长出来，且这种读者不受 §3.1 的网格保护。把门方式：`RoundNaming` 之外不得出现产物名拼装字面（`.c${` / `-report.md` / `-a${` 一类）的守卫测试。

#### 3.3 legacy 回退长成永久机制

`families` 占位表一旦被新写面重新用上，第二真源就复活。把门方式：写路径（`persistHandoff` 及其上游）不得调用占位表——守卫测试固定这一条，直到 legacy 行退场后整表删除。

#### 3.4 产物扫描面不认识新名字

`-a{n}` 进名字之后，按名字扫目录的两处会错：`CarrierSeal.isCarrierName` 的 pattern 若不接受 `-a{n}`，崩溃遗留的载体就 sweep 不到（残留可写，§2.3 判它不可能存在的窗口）；若反过来放宽过头，`report` / `evidence` / `crash` 会被当成载体 seal 或当孤儿列上 board。`orphanHandoffs` 的家族归属读法同理。把门方式：扫描面只认 `draft` / `final` 两种 kind 的形状，且新尝试的名字在其中。

### Acceptance criteria

- 注入性网格 pin 绿：任意两个不同身份（含 implement 的 draft/final 对与相邻 attempt）不得渲染同名。
- implement 的 `final ≠ draft`，且其 final 带 `cycle` 令牌。
- 重派 N 次（N ≥ 2）后：旧 attempt 的记录仍可读，board 零 `carrier-mismatch`；每个 attempt 的 `+N` 来自它自己的产物。
- 外部篡改仍抛 `carrier-mismatch`（owner 记录的摘要与产物字节不符）——保护不退化。
- `report` / `evidence` / `crash` 在重派后不再覆盖上一轮的文件。
- legacy 三类各有一条 pin：无摘要记录（零比对）· 已失配的历史记录（present-facts，不抛，`+N` = 0）· 旧命名文件（按记录的路径读）。
- 写面不调用 `families` 占位表；`RoundNaming` 之外零产物名拼装（两条守卫测试）。
- 扫描面只认 `draft` / `final` 两种 kind，且 `-a{n}` 形状被识别；`report` / `evidence` / `crash` 不被当作载体。
- `attempt === 1` 的渲染与今天逐字节相同（四类文档线 · wave 线 · branch 线各取代表身份断言）。
- 引擎 vitest 全绿；`pnpm run validate` exit 0；changeset `cdd-engine` **minor**；不发布。

## Constraints

- 不动 `next:` 字面（D70 收敛主线）。
- 不改 `progress.json` 的形状：只停写 `carrierPath` / `draftPath` 两个字段，不迁移旧值。
- 不加运行时守护门（§2.3 的构造属性判定）。
- legacy 回退只读，不得参与身份推导。
- 不引入新依赖；不发布。

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-11-13 | P34 初稿：产物名收为轮次身份的单射渲染（`(line, op, cycle, attempt)` × `kind` 一处派生）· implement 补 cycle 坐标 · 写一次作构造属性 · `carrierPath`/`draftPath` 新记录退役 · 记录缺席回退 attempt 1 · attempt=1 逐字节守恒 · legacy 失配行 present-facts。作用面覆盖 carrier / report / evidence / crash（log 已有）。 | '[human] 裁定 · Claude（kairos:cdd-design · 2026-11-13）' |
