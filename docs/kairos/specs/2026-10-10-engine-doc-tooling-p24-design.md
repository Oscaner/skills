---
title: 引擎文档工具（Engine Doc-Tooling）— P24 设计：NEXT-LOOP 收口面（drift 语义收窄 + hop 原因可读）
doc-type: phase-spec
version: v0.3
date: 2026-11-04
slug: 2026-10-10-engine-doc-tooling-p24
program: 2026-10-10-engine-doc-tooling
author: "[human] · Claude（kairos:cdd-design [P24] grilling → 本会话落 spec · 2026-11-04）"
---

## Design

本相位治一个**结构性自锁**加一处**已算不渲**：C5 决策表写明 `fix blocker==0 → close(state)`，而文档面（plan / phase-spec / single-spec / overall）、wave 面（brief drift · D30）与 branch 面（身份文档即 plan）共用的 drift 腿会把它反噬——fix 轮是那一版文档的**产出者**，它必然改文档（升版本、移行号），于是「fix 造成的 drift」把「同一个 fix 的收口」重新打开。实案：同 run 连续 20 轮 review + 20 轮 fix 未收口，其中 5 轮输入 findings 的 blocker 计数为 0，五轮 `next:` 仍全是 `review`。

**一句话的病根**：drift 的语义今天被实现成「文档相对上次 review 绑定版本变了」，而它**应当**是「有人在轮次之外动了它」。产出者被自己的产出判为未审改动，收口永远拿不到机会。

**第二条（诊断面）**：`NEXT_HOP_REASON` 七类 token 早已算出并挂在 `NextHop.reason` 上，`face/route-render.ts#renderHop` 却只对 `doc-class-blocked` 使用，其余六类算完即弃——外部因此无法区分「drift 重开 / 仍有 blocker / 任务未开」，只能读引擎源码反推。

**边界（本相位不越的线）**：不改 C5 决策表本身（`fix blocker==0 → close` 一字不动）· 不改 `Ledger#docReopens` 与 `onExitSide` 的判据 · 不改 `next:` 行的字节（它是可执行字面）· 不新增 CLI 动词或旗标 · 不改 findings / handoff schema · 不改任何 `SKILL.md` · 不做 `progress.json` 的状态迁移。

### 1. 缺口（取证）

#### 1.1 自噬是结构性的，不是偶发

今日链路（三处都读过）：

1. **C5 判定是对的**——`session/next.ts:272-286`：`case "fix"` 里 `#blockerCount(ref) > 0` 才回 `{kind:"review"}`，否则 `#close(state)`；注释自带 `#278` 的「a warn/nit-only fix closes」。
2. **基线只在 review 完成时写**——`session/run.ts:705-718` 的 T7 写回：`record.verdict.targetAction && (frame.phase === "review" || frame.phase === "branch-review")` 才绑定 `recordReviewedRevision`（doc 线取目标文档 revision · wave 线取重渲染 brief · branch 线取 plan 的 doc revision）。**fix 轮完成时不写**。
3. **drift 在收口侧才生效**——`Ledger#docLineVerdict` 拿「当前文档 revision」比「已记录的 reviewed revision」；`Ledger#docReopens` = `drift && onExitSide(lineRoute)`。零 blocker 的 fix 自己算出的 C5 路由正是 exit 侧（`done` / `handoff`），于是同一次调用里「fix 的产出」既触发了 drift，又满足了 drift 的生效条件。

结论：只要某一轮 review 还能挑出任意 warn/nit，循环就继续；闭包被压成「必须某轮 review 零 finding」这一条窄路。这与 C5 的书面语义**直接矛盾**，且 `fix` 轮在文档线上**无法收口**（fix 面本身可派发、也有 20 轮完成记录，不可达的是收口）。

#### 1.2 原因 token 算而弃

`session/next.ts:165-173` 声明七个 token（`doc-drift` · `pending-fix` · `closed-line` · `face-closed` · `soft-cap` · `task-open` · `doc-class-blocked`）；`:392-404` 的 `reasonOf` 按固定序算出其中之一，挂进 `NextHop.reason`；而 `face/route-render.ts#renderHop` 只消费 `doc-class-blocked`。board-view 的测试甚至已经直接读 `peeked.hop.reason === "doc-drift"`——事实在对象里，**只是没走到输出**。

**wave 面的边界（已取证，本相位收窄）**：今日 `Ledger#nextHopOf` 的 drift cell 对 wave 直接排除——`input.doc != null && input.type !== "wave"`（`session/ledger.ts:1230-1233`），wave 调用点的 `doc` 也拿不到可判文档（`#docOf` 对 wave 目标返回 null，`session/run.ts:853-857`）；wave 的 brief drift 判定另在 `Ledger#waveLineRoute` 的 D30 腿（`#briefDrift`，`session/ledger.ts:983` · `:1014-1019`），由 frontier（`#nextWavePhase` → `waveLinePhase`，`session/run.ts:505-507`）与板面 pipeline frontier（`face/board-view.ts:724`）消费。于是「只加 reason 行」时 wave 线的 token 永远到不了 `doc-drift`：drifted wave 重开到 review 却带 `reason: task-open`。父 overall 的 P24 要求 wave 线与 branch 线**同判据、同收益**，故本相位把这条 cell 改为**读调用方注入的 wave brief-drift 事实**（不新开判定，见 §4「wave 面」）。

#### 1.3 三个面共享一条腿

**一个已入账 identity，两个读它的人**：写侧确实单点——`recordReviewedRevision`（`session/ledger.ts:793-811`）是唯一写入，wave 线经 `recordReviewedBrief`（`:813-822`）落到同一写入。读侧按 D30 的事实分两条：`docReopens`（`session/ledger.ts:1287-1290`）服务 doc 线四型与 branch 线（P21 §4.1：身份文档即 plan），由 `CliGate#lineGate`（`face/gate.ts:87`）与 lifecycle 的 `#nextLinePhase`（`session/run.ts:545` · `:554`）读；wave brief 的重开判定是 `waveLineRoute` 的 D30 腿，由 `waveLinePhase`（frontier + wave gate）与板面 `pipelineFacts` 读。因此本相位的单点是**那个已入账 identity**，不是某个函数：每面读的都是它，且不得为某面新开第二个 drift 判定。于是「只修 doc 线」仍等于把最贵的 branch 面留债（P22 实案：分支 fix 改 plan 即自锁），wave 面的 reason 也一并在此收口。

### 2. 定案：基线随轮推进（判别机制）

**规则一句话**：**任一「完成」的轮收工写回时，把该行 reviewed identity 推进到该轮产出的 identity**——fix 是产出者，故不被自己的产出判为 drift；收口之后**轮外**（编排器 / 人）再改文档，仍按既有判据判 drift、仍重开 review lead。

**落点**：`session/run.ts:705-718` 的 T7 写回，phase 白名单由 `review | branch-review` 扩为 `review | branch-review | fix`。三分支（doc / wave / branch）原样复用，不新增写入点、不新增 ref kind。

**wave 分支保留，但须正名**：写回面的 wave 支并入同一白名单是「统一入账」，不是在修一个存在的收口行为——wave 线今天**没有**收口自锁（零 blocker 的 fix 其 C5 路由是 `done`，`waveLineRoute` 的两个重开分支都不命中，落到 `return null`，`session/ledger.ts:989`；分型证据见 §6 第 1 条），故 wave 的基线推进在本相位**零可观测收益**。wave 的真实增量是 §4「wave 面」那条 reason 判据：让 wave 的 `reason:` 与 frontier / 板面同源。此处写死以免下游误以为本相位在修一个已存在的 wave 收口缺陷。

**「完成」判据沿用既有事实**：该写回已被 `record.verdict.targetAction` 把守——BLOCKED / TIMEOUT 的轮 `targetAction` 为假，故**不**推进基线；于是半途被砍的 fix（改了文档但没完成）保持旧基线 → 下一轮仍判 drift → 仍重开 review（让人看半成品，这是期望行为，写成负控测试）。**读不到输入时维持既有事实**：文档 / plan 不可读则什么都不记录（present facts only），该行保留旧基线，不发明 identity。

**为什么不加 `implement`**：wave 线的 implement 轮收工路由永在非 exit 侧（`review`），drift 咬不到它；保持写回面最小，也保住「implement → review」这条边上「review 才绑定」的原义。这是对 grilling 里「任一完成的轮」的**故意收窄**，收窄不改变任何可观测行为，记录在此以免下游误读。

**被否决的两个候选**：② `dispatchBase` 作基——它装的是派发时的 **git HEAD**，与文档 revision 跨刻度，取那个 commit 的文档 blob 代价高，且 fix 轮未必有提交；③ 改动来源位——引擎无法观测「谁改的」，按轮窗口推断出来就等价于本方案，只是多一个状态位。

### 3. 定案：`reviewedRevision` 的语义（只改注释，不迁移）

机制让该字段的语义从「reviewer 读过的版本」变为「该行**已入账**的版本」。字段落在 `.kairos/cdd/<slug>/progress.json`（持久化状态），改名会让旧文件缺新键、静默退化成「未绑定」的 legacy 面。

**定案**：**不改名、不迁移**——`Ledger#recordReviewedRevision` 与 `SessionRun` 的写回注释改为「已入账 identity（review 轮绑定被审版本，fix 轮绑定自产版本）」，spec 留存该决策。命名代价用文档还，不用状态迁移还。

### 4. 定案：reason 行（形态 · 覆盖 · 两面）

**形态**：`next:` 行**字节零变**（它是可执行字面，技能照抄即用），其后**紧邻独立一行**：

```
next: review --type plan --plan docs/kairos/plans/x.md
reason: doc-drift
```

**覆盖**：七类 token **无条件**全渲——不做「什么时候有、什么时候没有」的条件词面。

**两面同字节**：胶囊（`face/capsule.ts:133-134`，轮的自身行）与板面（`face/board-view.ts:349-358` 的 `static nextLine(hop, renderer)`，新行对齐 `  reason:  <token>`）都渲；共用 `RouteRenderer` 新增的 `renderReason(hop)`（`hop.reason` 直出，`null` hop 返回 `null`——BLOCKED/TIMEOUT 既无 `next:` 就无 `reason:`）。板面新增 `static reasonLine(hop)` 与 `nextLine` 并列（调用点 `:558` 之后追加一行），`nextLine` 的既有字节与行序不动；两个前缀等宽 11 列（`  next:    ` · `  reason:  `）。

**前缀的声明来源（不硬编码）**：`reason:` 与 `next:` 一样从词表取——`RouteWordKind`（`face/words.ts:57`）加 `"reason"`，`CAPSULE_WORDS.routeWords`（`face/words.ts:201-222`）增一行 `reason: "reason:"`，胶囊与板面都经 `words.routeWord("reason")` 取用。**不动站表**：`StationKind`（`face/words.ts:47`）与 `CAPSULE_WORDS.stations`（`:194-199`）仍四行，`face/__tests__/face.test.ts:103` 的四站 pin（`Object.values(CAPSULE_WORDS.stations).length === 4`）原样成立；`routeWords` 没有长度 pin，其逐键断言只钉 `done` / `review` / `fix` / `implement`（`face/__tests__/face.test.ts:70-73`），新增一行不触碰任何一条。取舍：该行记的是**行标签**而非 `next:` 的分类动词，本相位仍收进 `routeWords` 而不另开 `labels` 行组——前者零额外重锚，后者自带长度 pin 与额外重锚面。这一取舍记在 §7 的表里。

**wave 面（该面的 drift 判据在同一处收窄）**：`Ledger#nextHopOf` 的 drift cell 由 `input.type !== "wave"` 的排除改为读**调用方注入的 fact**——input face 新增可选 cell `briefDrift?: boolean`；wave 面的 drift 取该 cell，其余面仍读 `reviewGate`。事实来源不新增判定：把 `#briefDrift`（`session/ledger.ts:1014-1019`）提为 public 读 `briefDrifted(waveKey): boolean`（内部读 `reviewedRevisionOf(waveKey)`），`waveLineRoute` 的 D30 腿改调它（`session/ledger.ts:983`），run 的 `#hopOf`（`session/run.ts:836-851`）与板面 `BoardNext#hopOf`（`face/board-view.ts:852-864`）的 wave 分支注入同一值——一个判定，四个读者（wave 线路由 · frontier · 板面 · reason 行）。drift 的替换范围沿用 D30 的既有语义：wave 面**不受 exit-side 限制**（`waveLineRoute` 在 fix 待办面也重开 review，`session/ledger.ts:980-988`），其余面仍是 `onExitSide`（`session/ledger.ts:1242-1243`）；这样胶囊与 frontier / 板面的**路由与 `reason:` 都出自同一条判定**，消掉今日「drift cell 对 wave 直接排除、只有路由 side 是 drift-aware」的差。

**被否决**：A 在 `next:` 行尾追加 `— reason: x`（污染可执行字面）；D 加旗标（今日引擎无 `--verbose`，等于新增一整套旗标通道）。C（只渲非常规触发）作为备选，未采纳——一致性优先于少一行。

### 5. 定案：消费面（一句话）

根 `README.md:60` 这一 bullet 会被加行冲掉**两处**：粗体首句「**The next hop is derived, then printed last.**」（加行之后收尾的是 `reason:` 行，不是 `next:` 行）与后半句「Each run ends with its `next:` line」→ 同笔改写为「**The next hop is derived, then printed with its reason.** Each run ends with its `next:` line and the reason line that follows it.」；`README.zh-CN.md:64` 镜像同笔（「**下一个去向是推演出来的，并且最后打印。**」→「**下一个去向是推演出来的，并连同其原因一起打印。**」＋「每次运行以 `next:` 行收尾，紧接着是它的原因行」），不留下首句与后半句互相矛盾的一版；引擎 README 无此承诺，不动；`README.md:88` 与 `packages/kairos/README.md:69`（「follow the engine's `next:` line」）仍成立，不动；**`SKILL.md` 零变更**（reason 是引擎对读者说的话，不是技能流程的一部分）。

### 6. 定案：证据（三条互锁 + 一次演示）

1. **实案复现（分型取证，不假装三面同型）**：构造 issue 的形态——review 产 1 warn、fix 修文档并完成、findings 的 blocker 计数为 0——再断言收口。三个面的可观测面**不同型**，证据按型给：
   - **doc 线（四型共用 `docReopens`，任取一型即可）与 branch 线 = 收口自锁**：今日必被「fix 自产的 drift」重开 review（§1.1 的因果链），故断言 `next:` 为 `done` / `handoff` / `next-wave`（**非** `review`）在改动前**必红**、改动后转绿。断言面读胶囊或板面的 `next:` 行（两面此面皆 drift-aware）。
   - **wave 线 = 无收口自锁**：零 blocker 的 fix 其 C5 路由是 `done`，`waveLineRoute` 的两个重开分支（`route?.kind === "review"` / `"fix"`，`session/ledger.ts:979-988`）都不命中，落到 `return null`（`:989`）；于是 `#rowClosed`（`session/ledger.ts:1303-1310`）判已闭合、frontier 的 `#nextWavePhase`（`session/run.ts:504-506` → `waveLinePhase`）不再出帧、板面的 wave cell（`face/board-view.ts:719-726`，`closed` 在 `:723`、`active` 在 `:724`）报 closed。**今天不存在 wave 的收口自锁**——把收口写成 wave 的「必红」就是拿一条已绿的断言证红。wave 的必红证据由本相位两处真实增量承担：
     (i) **reason token**：drifted 且 fix 待办的 wave，今日 drift cell 对 wave 排除（`session/ledger.ts:1230-1233`），`#reasonOf` 落到「有 hop ⇒ `task-open`」（`session/next.ts:396-401`；`task-open` 在 `:401`），改动后注入的 `briefDrift` 让 `route.kind === "review" && gate.drift` 命中（`session/next.ts:399`）→ `doc-drift`。断言 `reason:` 行在改动前必红（行本身尚不存在），改动后取值 `doc-drift`；胶囊与板面两条 `reason:` 行等值（同一 hop、同一词表行）。
     (ii) **token 与路由不分叉（回归 pin）**：drifted wave 的 `next:` 路由今日已 drift-aware——frontier、胶囊与板面都读 `waveLineRoute` 的 D30 腿（`session/run.ts:439-447` · `face/board-view.ts:724`），改动后新增的 `reason:` 行不得让三者分叉；这条是**回归**断言，不是红转绿断言。
   - **wave 的收口同样按回归断言**：断言同一 wave 在改动前后都收口（钉住现状），证明本相位没有把 wave 的闭合弄坏。
2. **防自旋负控**：收口之后由**编排器侧**改文档，断言 `next:` 仍回 review lead（drift 语义的另一半，非装饰）。
3. **半途负控**：改了文档但 `targetAction` 为假的 fix（BLOCKED），断言基线不推进、仍判 drift。
4. **验收演示**（不进测试集）：在 P24 自己的 plan 上真跑一轮 `cdd plan` review → fix → 收口，留下输出。

**测试落点**：写回与三面判定落在 `session/__tests__/run.test.ts`（写回面）；门与重开落在 `face/__tests__/cli.test.ts`（`lineGate` 的 drift 腿）；渲染落在 `face/__tests__/capsule.test.ts` 与 `face/__tests__/board-view.test.ts`（两面同值、`next:` 零变、`reason:` 新增）。wave 的 reason token 需一条自己的夹具：drifted wave brief（plan 的 wave 段在 review 绑定后改动，`reviewedRevisionOf(waveKey)` 即判 drift），可照 `board-view.test.ts:1612-1654` 的 branch 漂移夹具同型构造（同一 `Lifecycle` + `peekNext()` 形态，换 `target: { kind: "wave" }` 与 wave 的写回）。

### 7. 落点、依赖与发行

**源码落点**（八行：六处既有面 + 一处判据收窄 + 一行注入点）：

| 面 | 文件 | 落点 |
|---|---|---|
| 写回白名单 | `session/run.ts` | `:705-718` phase 白名单加 `fix`；`#recordReviewedDocRevision` / `#recordReviewedWaveBrief` / `#recordReviewedBranchRevision` 的文档注释同步语义 |
| 语义注释 | `session/ledger.ts` | `recordReviewedRevision`（文档注释 `:793-797`）改为「已入账 identity」 |
| reason 渲染 | `face/route-render.ts` | 新增 `renderReason(hop): string \| null`；`renderHop` 不动 |
| reason 词表 | `face/words.ts` | `RouteWordKind`（`:57`）加 `"reason"`；`CAPSULE_WORDS.routeWords`（`:201-222`）增 `reason: "reason:"` 一行；站表 `StationKind`（`:47`）与 `stations`（`:194-199`）不动，四站 pin（`face/__tests__/face.test.ts:103`）不变 |
| 胶囊 | `face/capsule.ts` | `:133-134` 之后追加 `reason:` 行（前缀取 `routeWord("reason")`，不硬编码） |
| 板面 | `face/board-view.ts` | `:349-358` 的 `nextLine` 旁增 `reasonLine`（调用点 `:558` 之后追加一行） |
| reason 判据（wave） | `session/ledger.ts` | `nextHopOf`（`:1229-1243`）的 drift cell 改读注入的 `briefDrift`（wave 面的替换范围不受 `onExitSide` 限制）；`#briefDrift`（`:1014-1019`）提为 public `briefDrifted(waveKey)`，`waveLineRoute` 的 D30 腿（`:983`）共用 |
| 注入点 | `session/run.ts` · `face/board-view.ts` | run `#hopOf`（`:836-851`）与 `BoardNext#hopOf`（`face/board-view.ts:852-864`）的 wave 分支注入 `briefDrift` |

**依赖**：P23 已 Done（`P23 -> P24` hard，本相位不依赖 P23 的任何产物，只依赖其闭合后的树）。

**发行**：`@oscaner-skills/cdd-engine` **minor**（D74：消费面可见字节变化即 minor——新增 `reason:` 行、根 README 一句）；不涉 kairos 包，故不给 kairos changeset。

**pin 清单（分类在册：零改动 137 处 + 整块快照重锚 15 处）**：`next:` 断言分布于 11 个测试文件、152 处引用。分两类，逐条在册，不许含糊：

1. **零改动（152 − 15 = 137 处）**——形态是按行抽取（`lines[1]!.slice("next: ".length)`）或 `toContain("next: …")`。`reason:` 行追加在索引 2 之后，故 `lines[1]` 抽取与 `toContain` 皆不破；board 行由 `find` / `slice` / `toContain` 定位（`board-view.test.ts:119-124` · `:311` · `:943`；`cli.test.ts:2480`），board 的 capsule 对照取 `[1]`（`board-view.test.ts:1518-1523` · `:1604-1609` · `:1648-1653`），同样不受影响。两处需盯但**断言不动**：board 行布局多一行 `  reason:  `；`face/__tests__/preview.test.ts:295` 的 `not.toContain("next:")`（预览面既无 next 就无 reason，语义仍成立）。
2. **整块 `toEqual` 快照重锚（15 处，`toEqual` 对长度敏感，追加一行即破）**——每处各新增**一个** `reason: <token>` 元素，一个都不许省：`face/__tests__/face.test.ts` **13 处** → `:124`（done）· `:128`（next-wave）· `:136`（review）· `:142`（fix + reviews）· `:152`（bare fix）· `:158`（soft-cap，单行数组）· `:171`（review + wave target）· `:177`（fix + wave target）· `:190`（review + branch target）· `:200`（review + phase-spec target）· `:212`（next-wave + wave target）· `:226`（done）· `:266`（T8 seam 的 `lines`）；行号取 `capsule.emit(...)` 调用行，其 `.toEqual([` 落在紧邻的 `:147` · `:163` · `:182` · `:195` · `:205` · `:213`。`face/__tests__/capsule.test.ts` **2 处** → `:482`（fix 摘要的三行）· `:498`（普通两行）。
3. **不在重锚列内**（hop 为 `null` → 无 `reason:` 行，形状不变）：`face.test.ts:109` · `:114` · `:118` · `:222` · `:223`，`capsule.test.ts:470` · `:490` · `:491`。

### 8. 非目标

- 不改 soft-cap 语义、不改 `REVIEW_CYCLE_CAP`。
- 不引入「改动来源」状态位，不为轮中途的带外编辑提供 provenance（已知边界见 Constraints）。
- 不改 `next:` 值的渲染、不改板面既有行序。
- 不为 `reason:` 提供机器可解析的稳定 schema（它是人读的一行；解析契约不承诺）。

### Acceptance criteria

- **doc 线（四型共用 `docReopens`，任取一型）与 branch 线**：`review`（仅 warn/nit）→ `fix`（改文档、blocker 计数为 0）之后的下一次调用**收口**：`next:` 为 `done` / `handoff` / `next-wave`，不是 `review`；每线一条测试，断言面取胶囊或板面的 `next:` 行（两面此面皆 drift-aware），且该测试在改动前的树上**必红**（先证红，后转绿）。
- **wave 线无收口自锁，证据按 §6 第 1 条的分型给**：不做「必红 → 绿」的收口断言——零 blocker 的 fix 其 wave 路由今日已是 `done` → 已闭合（`session/ledger.ts:989` · `:1303-1310`）。wave 的必红证据是 reason token：drifted 且 fix 待办的 wave 今日 `reason` 为 `task-open`、改动后为 `doc-drift`，胶囊与板面两条 `reason:` 行等值。wave 的收口另作**回归**断言（改动前后都收口），token 与 `next:` 路由不分叉亦为**回归**断言。
- wave 面的 `reason:` 与其重开判据同源：drifted wave brief 在胶囊与板面都渲 `reason: doc-drift`，并与 frontier 的 `frame.phase`（review）一致；非 drifted 的 wave 面 token 仍按既有序取值（`pending-fix` / `task-open` / `closed-line`）。
- 收口之后由编排器侧改同一文档 → `next:` 仍回 review lead（drift 重开语义未失效），有测试。
- `targetAction` 为假的 fix（BLOCKED / TIMEOUT）不推进基线 → 仍判 drift，有测试。
- 每条 `next:` 行之后紧跟一行 `reason: <token>`，token 取 `NEXT_HOP_REASON` 七值之一；`next:` 行字节与今日**逐字节相同**——证据是 §7 pin 清单的两类：152 处引用中 137 处按行抽取 / `toContain` 零改动，15 处整块 `toEqual` 快照各**只**追加一个 `reason:` 元素（`face/__tests__/face.test.ts` 13 处 · `face/__tests__/capsule.test.ts` 2 处，逐条在册）。
- 胶囊与板面渲染同值；BLOCKED / TIMEOUT 轮两面都不渲 `reason:`。`reason:` 前缀取自词表（`routeWords.reason`）并由两面共用；`StationKind` 四站与 `face/__tests__/face.test.ts:103` 的 pin 不变。
- 根 `README.md:60` 与其 `.zh-CN.md:64` 镜像同步更新该 bullet 的**首句与后半句**（「printed last」/「最后打印」在加行后不再成立），`SKILL.md` 零变更。
- `env -u AI_AGENT pnpm run validate` 退出码 0；`pnpm run emit:check` fresh；changeset 为 `@oscaner-skills/cdd-engine` minor。

## Constraints

- **`next:` 可执行契约不可破**：它必须仍是「整行抄进 shell 就能跑」的字面；任何诊断信息只能落在**另一行**。
- **单点判据**：三面共用**一个已入账 identity**（`recordReviewedRevision` 是唯一写入）与**每面一个既有 drift 判定**：不得新开第二处写入，也不得新开第二个 drift 判定；doc 线与 branch 线读 `docReopens`，wave brief 读 `waveLineRoute` 的 D30 腿（两读者读同一 identity，见 §1.3），wave 的 reason cell 只注入该腿已算出的布尔，不重算。
- **wave 面的备选收窄（须报告，不得静默）**：若注入 `briefDrift` 必须改 D30 precheck（`waveLineRoute`）或 frontier 判据本身——越出本相位的边界——则 wave 面只保路由一致（写回单点已覆盖，且该面本无收口自锁，见 §2 / §6），其 `reason:` 如实保持 `task-open`，并须在本 Constraints 写明该已知限制 + 另开 follow-up issue 记录残差。
- **只推进完成的轮**：`targetAction` 为假的轮一律不推进基线，这条不可为「简化」而放宽。
- **已知边界**：轮次进行中由编排器带外改文档（已违反「派发期间不动树」纪律）会被 fix 的写回一并入账——本相位不建 provenance 去区分；该场景记为已知限制。
- **零状态迁移**：不改 `progress.json` 的任何键名或键集。
- **消费面纯净**：`SKILL.md` 与技能 `docs/` 零变更；根 README 只改那一句（英 + 中镜像同笔）。

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-11-04 | 初稿：P24 NEXT-LOOP 收口面——基线随轮推进（写回白名单加 `fix` · 只推进完成的轮 · 三面单点）· reason 独立行（七类无条件 · 胶囊与板面同字节 · `next:` 字节零变）· 字段语义只改注释不迁移 · 根 README 一句 · 证据三条互锁 + 演示 · 零重锚 | Oscaner M. · Claude（kairos:cdd-design [P24] grilling → 本会话落 spec · 2026-11-04） |
| v0.2 | 2026-11-04 | 评审回填（无结构变更，内容面）：① reason 行落点按实测更正——板面方法是 `static nextLine(hop, renderer)`（`face/board-view.ts:349-358` · 调用点 `:558`），新增并列 `reasonLine`，旧方法名与旧行名（钉错的旧符号）全删 ② wave 面的 drift 判据收窄进本相位——`nextHopOf` 的 drift cell 由 `type !== "wave"` 排除改为读注入的 `briefDrift`，`#briefDrift` 提为 public `briefDrifted(waveKey)` 由 `waveLineRoute` 的 D30 腿共用（`:983` · `:1014-1019`），run `#hopOf` 与 `BoardNext#hopOf` 注入；wave 的 drift 替换沿用 D30 既有语义不受 exit-side 限制，胶囊与 frontier 从此同路由 ③ §1.3 / Constraints 单点改写为「一个已入账 identity + 每面一个既有判定」（`docReopens` 服务 doc/branch 且有两个读点 `face/gate.ts:87` · `session/run.ts:545`/`:554`，`waveLineRoute` 服务 wave）④ §6 证据 1 按线指定断言面——wave 不得用胶囊 `next:`（今日 drift-blind 已绿），取 `frame.phase` 或板面 `next:` ⑤ 措辞与 pin：`fix 轮无法收口` · `session/next.ts:272-286` · `#briefDrift` `:1014-1019` ⑥ spec 文件补 EOF 换行 | [human] · Claude（kairos:cdd-design [P24] 评审回填 · 2026-11-04） |
| v0.3 | 2026-11-04 | 第二轮评审回填（无结构变更，内容面）：① 字节面由「零重锚」改为**分类在册**——152 处引用拆成「按行抽取 / `toContain` 零改动 137 处」与「整块 `toEqual` 快照 15 处逐条重锚」（`face.test.ts` 13 处 · `capsule.test.ts` 2 处，每处新增一个 `reason:` 元素），Acceptance 的字节面同步改写 ② wave 线的收口证据改型——wave 今天**无收口自锁**（`waveLineRoute` 落到 `return null` `:989` · `#rowClosed` `:1303-1310`），§2 正名写回面的 wave 支对收口零可观测收益，§6 第 1 条改为分型取证（doc/branch = 红转绿；wave = reason token 红转绿 + 路由与收口的回归 pin），Acceptance 同步 ③ `reason:` 前缀落到词表——`RouteWordKind` 加 `"reason"`、`routeWords` 增一行，§7 增一行落点，站表与四站 pin 不动 ④ 根 README（英 + 中镜像）该 bullet 的粗体首句一并改写 | [human] · Claude（kairos:cdd-design [P24] 第二轮评审回填 · 2026-11-04） |
