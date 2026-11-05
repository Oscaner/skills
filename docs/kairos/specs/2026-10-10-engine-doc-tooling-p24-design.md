---
title: 引擎文档工具（Engine Doc-Tooling）— P24 设计：NEXT-LOOP 收口面（drift 语义收窄 + hop 原因可读）
doc-type: phase-spec
version: v0.32
date: 2026-11-05
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

**wave 面的边界（已取证，本相位收窄）**：今日 `Ledger#nextHopOf` 的 drift cell 对 wave 直接排除——`input.doc != null && input.type !== "wave"`（`session/ledger.ts:1230-1233`），wave 调用点的 `doc` 也拿不到可判文档（`#docOf` 对 wave 目标返回 null，`session/run.ts:853-857`）；wave 的 brief drift 判定另在 `Ledger#waveLineRoute` 的 D30 腿（`#briefDrift`，`session/ledger.ts:983` · `:1014-1019`），**今天只有两个漂移感知的读者**：frontier 的 `Lifecycle#peekNext`（`session/run.ts:402-405`，wave 分支直接调 `waveLineRoute`）与板面 pipeline frontier（`face/board-view.ts:724`）。**胶囊不是第三个读者**：`advance` 把 `#routeNext(frame)` 的 C5 路由（`session/run.ts:438`；`:813-818` 的 `router.next(state, ledger.round(...))`）交给 `#hopOf`，`:447` 把同一路由喂给 `#capsuleLines`，全程不经 `waveLineRoute`；加上已完成一轮的 `#bookkeep`（`:705-713`）会重绑 brief，一个由 `advance` 产出的胶囊看到的是 `drift: false`，wave 的 drift 只能在**未绑定帧**上经 `peekNext` / 板面观察。于是「只加 reason 行」时 wave 线在 frontier / 板面这一跳的 token 永远到不了 `doc-drift`：drifted wave 重开到 review 却带 `reason: task-open`。**token 优先级（须明写，免得下游以为 drift 能盖过 fix 跳）**：`#reasonOf` 的 `fix` 行（`session/next.ts:398`）先于 drift 行（`:399`），故 `route: fix` + `gate.drift` ⇒ `pending-fix`，`doc-drift` 只可能落在 `review` 路由上。父 overall 的 P24 要求 wave 线与 branch 线**同判据、同收益**，故本相位把这条 cell 改为**读调用方注入的 wave brief-drift 事实**（不新开判定，见 §4「wave 面」）。

#### 1.3 三个面共享一条腿

**一个已入账 identity，两个读它的人**：写侧确实单点——`recordReviewedRevision`（`session/ledger.ts:793-811`）是唯一写入，wave 线经 `recordReviewedBrief`（`:813-822`）落到同一写入。读侧按 D30 的事实分两条：`docReopens`（`session/ledger.ts:1287-1290`）服务 doc 线四型与 branch 线（P21 §4.1：身份文档即 plan），由 `CliGate#lineGate`（`face/gate.ts:87`）与 lifecycle 的 `#nextLinePhase`（`session/run.ts:545` · `:554`）读；wave brief 的重开判定是 `waveLineRoute` 的 D30 腿，由 `waveLinePhase`（frontier + wave gate）与板面 `pipelineFacts` 读。因此本相位的单点是**那个已入账 identity**，不是某个函数：每面读的都是它，且不得为某面新开第二个 drift 判定。于是「只修 doc 线」仍等于把最贵的 branch 面留债（P22 实案：分支 fix 改 plan 即自锁），wave 面的 reason 也一并在此收口。

### 2. 定案：基线随轮推进（判别机制）

**规则一句话**：**任一「完成」的轮收工写回时，把该行 reviewed identity 推进到该轮产出的 identity**——fix 是产出者，故不被自己的产出判为 drift；收口之后**轮外**（编排器 / 人）再改文档，仍按既有判据判 drift、仍重开 review lead。

**落点**：`session/run.ts:705-718` 的 T7 写回，phase 白名单由 `review | branch-review` 扩为 `review | branch-review | fix`。三分支（doc / wave / branch）原样复用，不新增写入点、不新增 ref kind。

**wave 分支保留，但须正名**：写回面的 wave 支并入同一白名单是「统一入账」，不是在修一个存在的收口行为——wave 线今天**没有**收口自锁（零 blocker 的 fix 其 C5 路由是 `done`，`waveLineRoute` 的两个重开分支都不命中，落到 `return null`，`session/ledger.ts:989`；分型证据见 §6 第 1 条），故 wave 的基线推进在本相位**零可观测收益**。wave 的真实增量是 §4「wave 面」那条 reason 判据：让 wave 的 `reason:` 与 frontier / 板面同源。此处写死以免下游误以为本相位在修一个已存在的 wave 收口缺陷。

**「完成」判据沿用既有事实**：该写回已被 `record.verdict.targetAction` 把守——BLOCKED / TIMEOUT 的轮 `targetAction` 为假，故**不**推进基线；于是半途被砍的 fix（改了文档但没完成）保持旧基线 → 下一次调用仍判 drift（基线未推进，负控直接读账本断言 `doc_hash` 未变），而 frontier 给出的是**该 fix 的重试面**（`fix` / `pending-fix`）：drift 不压 pending fix（§5.5 ②）——`lineRoute` 仍是 `{ kind: "fix" }`（`session/ledger.ts:1185-1188`），故 `docReopens` 为假、`linePhase` 回 `fix`；重试若再次带 blocker 才回到 review（让人看半成品，写成负控测试）。**读不到输入时维持既有事实**：文档 / plan 不可读则什么都不记录（present facts only），该行保留旧基线，不发明 identity。

**为什么不加 `implement`**：wave 线的 implement 轮收工路由永在非 exit 侧（`review`），drift 咬不到它；保持写回面最小，也保住「implement → review」这条边上「review 才绑定」的原义。这是对 grilling 里「任一完成的轮」的**故意收窄**，收窄不改变任何可观测行为，记录在此以免下游误读。

**被否决的两个候选**：② `dispatchBase` 作基——它装的是派发时的 **git HEAD**，与文档 revision 跨刻度，取那个 commit 的文档 blob 代价高，且 fix 轮未必有提交；③ 改动来源位——引擎无法观测「谁改的」，按轮窗口推断出来就等价于本方案，只是多一个状态位。

### 3. 定案：`reviewedRevision` 的语义（只改注释，不迁移）

机制让该字段的语义从「reviewer 读过的版本」变为「该行**已入账**的版本」。字段落在 `.kairos/cdd/<slug>/progress.json`（持久化状态），改名会让旧文件缺新键、静默退化成「未绑定」的 legacy 面。

**定案**：**不改名、不迁移**——`Ledger#recordReviewedRevision` 与 `Lifecycle`（`session/run.ts` 唯一导出的 run 类）的写回注释改为「已入账 identity（review 轮绑定被审版本，fix 轮绑定自产版本）」，spec 留存该决策。命名代价用文档还，不用状态迁移还。

### 4. 定案：reason 行（形态 · 覆盖 · 两面）

**形态**：`next:` 行**字节零变**（它是可执行字面，技能照抄即用），其后**紧邻独立一行**：

```
next: review --type plan --plan docs/kairos/plans/x.md
reason: doc-drift
```

**覆盖**：七类 token **无条件**全渲——不做「什么时候有、什么时候没有」的条件词面。该「无条件」限定的对象是 token 类别（七类都渲，不是只渲非常规触发），不是「每一行 `next:` 都带 `reason:`」：hop 为 `null` 的轮与两处 hop-less 的板面字面（`  next:    (none)` · 程序板 `  next:    done`）不带 `reason:` 行，见 §7 的板面行。

**两面同字节**：胶囊（`face/capsule.ts:133-134`，轮的自身行）与板面（`face/board-view.ts:349-358` 的 `static nextLine(hop, renderer)`，新行对齐 `  reason:  <token>`）都渲；共用 `NextHop.reason` 这一个事实——胶囊经 `RouteRenderer` 新增的 `renderReason(hop: NextHop)` 渲成站表前缀 + token，板面新增 `static reasonLine(hop)` 直取 `hop.reason` 再拼它自己的布局前缀（`renderReason` 的值自带 `reason:` 前缀，板面不直取；hop 的缺席由调用方一次把门——`renderHop` 只对 null hop 返回 null，故两行同门，BLOCKED/TIMEOUT 既无 `next:` 就无 `reason:`）。板面方法与 `nextLine` 并列（调用点 `:558` 之后追加一行），`nextLine` 的既有字节与行序不动；两个前缀等宽 11 列（`  next:    ` · `  reason:  `）。

**前缀的声明来源（两面各按自己的既有形态，字节同值而不共用来源）**：胶囊从**站表**取——`reason:` 与 `next:` 同类，都是 `: ` 结尾的通道锚，站表自己的注释即写「the `: `-suffixed channel anchors」；故 `StationKind`（`face/words.ts:47`）加 `"reason"`，`CAPSULE_WORDS.stations`（`face/words.ts:194-199`）增一行 `reason: "reason:"`，胶囊用 `words.station("reason")`（与它取 `next:` 完全同路，`face/capsule.ts:134`）。板面**不从词表取**：它的 `next:` 前缀本来就是布局字面（`face/board-view.ts:357` 直接写死 `  next:    `），故 `reasonLine` 同样写死 `  reason:  `（与它取 `next:` 的方式一致）——不给这个 static 加 `Words` 参数，那既是落点表外的签名变更，也让板面偏离自己的既有写法。**代价显式登记**：站表由四行变五行，唯一的站表长度 pin `face/__tests__/face.test.ts:103`（`Object.values(CAPSULE_WORDS.stations).length === 4`）随之重锚为 5——它是本次第 **16** 处重锚，逐条见 §7 的 pin 清单；站表的四条逐键断言（`face/__tests__/face.test.ts:66-69`）不受影响。**`routeWords` 一行不动**：它只装 `next:` 的分类动词，`reason` 不是动词；因此 `face/__tests__/face.test.ts:70-73` 的逐键断言与 `face/__tests__/cli.test.ts:3794` 的 routeWords-sync（名与注释都写「the four literal verbs ARE the four route classifier words」）原样成立、不致陈旧。取舍：`reason:` 收进站表而不另开 `labels` 行组——站表已是锚的既有家，另开行组会自带第二个长度 pin 与额外重锚面。这一取舍记在 §7 的表里。

**wave 面（该面的 drift 判据在同一处收窄）**：`Ledger#nextHopOf` 的 drift cell 由 `input.type !== "wave"` 的排除改为读**调用方注入的 fact**——`nextHopOf` 自己的**内联参数类型**（`session/ledger.ts:1219-1230`，不是 router 的 `NextHopInput`）新增可选 cell `briefDrift?: boolean`；wave 面的 drift 取该 cell，其余面仍读 `reviewGate`。**wave 面不做路由替换——两个值必须分开**：`nextHopOf` 内部今天只有一个 `drift`，它同时驱动「路由替换」与「原因 cell」；本相位必须拆成两个局部量：① **替换驱动** `drift` 仍只来自 doc 面的 `reviewGate`（`input.doc != null && input.type !== "wave"`，`:1230-1233` 的既有形状**保留**），故 `drift && onExitSide(input.route)`（`:1242-1243`）对 wave 面**完全不触发**；② **原因 cell** 喂 router 的 `gate.drift`（`NextHopInput.gate` 由 `nextHopOf` 自己填，`:1248-1254`）取 `drift || briefDrift`，于是 wave 面能命中 `doc-drift`。**只用一个值是不行的**：wave 的 exit 侧路由（soft-capped 时 `waveLineRoute` 落 `return null` → 板面 `#exitRoute` 的 `{ kind: "handoff", entry: PIPELINE_NEXT.wave }`，`face/board-view.ts:886-892`）会被替换成 review，等于把「本次暂停待用户裁定」改写成「再去审一遍」；而 `WaveGate.vet` 又按 `waveLinePhase` 为 null 拒绝同一条路由（板面 ⇄ 门分叉）。事实来源不新增判定：把 `#briefDrift`（`session/ledger.ts:1014-1019`）提为 public 读 `briefDrifted(waveKey): boolean`（内部读 `reviewedRevisionOf(waveKey)`），`waveLineRoute` 的 D30 腿改调它（`session/ledger.ts:983`），两个注入点喂同一值：板面 `BoardNext#hopOf`（`face/board-view.ts:849-861`）**在那唯一一次 `nextHopOf` 调用的输入对象里**按 target 条件注入（`target?.type === "wave" ? facts.ledger.briefDrifted(String(target.id)) : undefined`）。**不需要 `active !== null` 之类的闸**：wave 面从不做路由替换（见上），soft-capped wave 的 `{ kind: "handoff", entry: PIPELINE_NEXT.wave }`（`:886-892` · `:902-905`）原样保留，注入只可能改变它 `reason:` 的取值；两个注入点（板面与 `Lifecycle#hopOf`）也不因多一道闸而变得不对称。该 static **没有** wave 分支（`type` / `key` / `doc` 全由 walked target 派生：`key: target?.type === "wave" ? target.id : (target?.type ?? "branch")`，`:852-859`），故**禁止**为 wave 另开第二次 `nextHopOf` 调用（那会把本相位要保的单一派生劈成两份）；frontier 侧是 `Lifecycle#hopOf`（`nextHopOf` 调用在 `session/run.ts:838`）——一个判定，三个路由读者（wave 线路由 · frontier · 板面）加它们 `next:` 行各自派生出的 `reason:`。板面的 wave key 就是 `target.id`（pipeline 面在 `face/board-view.ts:725` 以 `waveKey ?? ""` 填它），空 key 不必另加守卫：`briefDrifted` 内部读 `reviewedRevisionOf(waveKey)`（`session/ledger.ts:843-850`）——空 key 无行 ⇒ `null`，与 null identity 同退化 ⇒ `false`。drift 的替换范围：**wave 面从不做路由替换**（cell 只喂 `gate.drift`；wave 的路由由 `waveLineRoute` 的 D30 腿在 `session/ledger.ts:980-988` 就改写成 review，再来一次替换既多余又会劫持 soft-capped wave 的 `handoff`），其余面仍是 `drift && onExitSide(route)`（`session/ledger.ts:1242-1243`）；frontier / 板面的路由与 `reason:` 因此出自同一条判定（路由由调用方给、token 由该 cell 给），消掉今日「drift cell 对 wave 直接排除、只有路由 side 是 drift-aware」的差。**胶囊在 wave 面随 §11 渲 **pipeline frontier** 的 hop（与板面共用的那一个）**：`#capsuleLines`（`session/run.ts:447`）不再取 `advance` 交付的 frame-keyed 路由（`:438` → `:813-818`），故「胶囊帧上 drift 恒为假」只描述本节这个 frame-keyed 装配（即 `peekNext` 那条 **line frontier** 活判据），不再是胶囊的输出事实——胶囊在 wave 面的 `reason:` 与板面同值；与 `peekNext` 同值只是该夹具上的期望，不是恒等式（术语见 §11「术语消歧」）。**同一条 `#hopOf`（`:836-851`）另服务一个活读者**：它有两个调用点——`advance`（`:447`，其前 `:429-430` 的 `#bookkeep` 已重绑 brief ⇒ 注入对它是死代码）与 `peekNext`（`:399-408`，帧未 dispatch、brief 未重绑 ⇒ 注入是活判据，这正是 §1.2 点名的 frontier 读点）。故在 `session/run.ts:838` 的 `nextHopOf` 入参注入 `briefDrift`（`frame.type === "wave" ? this.#ledger.briefDrifted(String(frame.key)) : undefined`）：方法签名与字节不动，只有 `nextHopOf` 的入参对象长一格——死的是 `advance` 那一跳，不是整个注入。唯一不重绑的 implement 帧也不会与已绑定 brief 并存（`waveLineRoute` 在 `completedCycles(key,"implement")` 为空时返回 `next-wave`，`session/ledger.ts:956-958`），故该帧上不存在可观察的 drift。胶囊的 `reason:` 行本身仍渲（§4「形态」），取值按其路由的既有优先级（`session/next.ts:398` 先于 `:399`）。

**被否决**：A 在 `next:` 行尾追加 `— reason: x`（污染可执行字面）；D 加旗标（今日引擎无 `--verbose`，等于新增一整套旗标通道）。C（只渲非常规触发）作为备选，未采纳——一致性优先于少一行。

### 5. 定案：消费面（一句话）

根 `README.md:60` 这一 bullet 会被加行冲掉**两处**：粗体首句「**The next hop is derived, then printed last.**」（加行之后收尾的是 `reason:` 行，不是 `next:` 行）与后半句「Each run ends with its `next:` line」。改写给出**整条**新 bullet，第三个从句（板面）原样保留：

> **The next hop is derived, then printed with its reason.** Each run ends with its `next:` line and the reason line that follows it, and `cdd board --plan <path>` renders that same judgment as a progress board — the line and the board cannot disagree.

`README.zh-CN.md:64` 镜像同笔，同样保留第三个从句：

> **下一个去向是推演出来的，并连同其原因一起打印。** 每次运行以 `next:` 行收尾，紧接着是它的原因行，而 `cdd board --plan <path>` 会把同一个判定渲染成进度看板——这一行与看板不可能互相矛盾。

该从句在本相位之后**更强**（连 `reason:` 行也同值），不是可删的冗余；改写不留首句与后半句互相矛盾的一版；引擎 README 无此承诺，不动；`README.md:88` 与 `packages/kairos/README.md:69`（「follow the engine's `next:` line」）仍成立，不动；**`SKILL.md` 零变更**（reason 是引擎对读者说的话，不是技能流程的一部分）。

**第三块消费面：四份 diagram 源（同笔改写）**。同一句「`next:` 是运行的最后一行」还作为取证散文写在 `docs/diagrams/src/` 的四份源里；加行之后它们对本相位的引擎**全部为假**（收尾的是 `next:` 与紧随其后的 `reason:` 行），故与 README 同笔改写：

**这四份产物的新鲜度保证只在本轮成立（不声明常驻门）**：`face/__tests__/diagrams.guard.test.ts` 的 `SOURCES` 映射只覆盖 `architecture.{en,zh-CN}`，而 `scripts/__tests__/next-loop-twin.test.ts` 只读 `next-loop` 的源、没有 HTML 腿——即 `next-loop` / `journey` 的源与生成 HTML 之间**没有常驻孪生门**。失败模式已经在 W3 实现轮里现形过一次：`next-loop.zh-CN.html` 曾读作「运行的最后一一行」而源写「最后一行」，所有门都是绿的。故本相位对这四个产物的保证限定为「**本轮以 Archify finalize 重生成、并以一次性校验确认新鲜**」，**不**声明「门会拦住改源不重生成与手改 HTML」；建立该常驻门属后续工作，作为已知限制登记（不在本相位扩面）。

| 源 | 位置 | 现措辞 | 改写为 |
|---|---|---|---|
| `next-loop.en.json` | `:278` | "The next: line is the last line of a run and the only continuation; a BLOCKED or TIMEOUT round carries none" | "The next: line and the reason line that follows it are the last two lines of a run — the route and its cause; a BLOCKED or TIMEOUT round carries neither" |
| `next-loop.zh-CN.json` | `:278` | 「next: 是运行的最后一行，也是唯一的延续；BLOCKED 或 TIMEOUT 的轮次不带它」 | 「next: 行与紧随其后的原因行是运行的最后两行——去向与它的原因；BLOCKED 或 TIMEOUT 的轮次两者都不带」 |
| `journey.en.json` | `:573` | "next: closes the run as its last line, and cdd board renders the same judgment from the ledger" | "next: and the reason line that follows it close the run, and cdd board renders the same judgment from the ledger" |
| `journey.zh-CN.json` | `:573` | 「next: 作为最后一行收尾，而 cdd board 从账本渲染同一个判定」 | 「next: 与紧随其后的原因行一起收尾，而 cdd board 从账本渲染同一个判定」 |

**生成物不手改**：四份源各有一份生成 HTML（`next-loop.{en,zh-CN}.html` · `journey.{en,zh-CN}.html`），按 `docs/diagrams/README.md` 的 Archify finalize 命令重生成——**禁手改 HTML**。这是纪律而非门：上面那段已写明这四份产物上没有任何常驻门，源与生成 HTML 的一致性由人负责，`packages/cdd-engine/src-next/face/__tests__/diagrams.guard.test.ts` 的源→HTML 腿只覆盖 `architecture.{en,zh-CN}`，抓不到这四份文件。该 guard 的取证跨度只覆盖 `upstream` / `host` / `engine` 三节点（`plugins.ts` · `host.ts` · `cli.ts`），本相位一个都不改；`capsule` / `board` / `ledger` / `next` 的跨度也不脱钩——本相位的每一处编辑都插在这些跨度**之下**。

**不破的孪生 pin**：`scripts/__tests__/next-loop-twin.test.ts` 的三条断言（blocker → 重新评审 · warn/nit → `REVIEW_FIX` · 软上限）一字未动，故这四份源的改写只动「最后一行」这一句、断言不红。**该面的落点与验收归 plan Task 4**（已登记该面：四份源 + 重生成 + 一次性新鲜度校验；`diagrams.guard` 只覆盖 `architecture.*`，见上），§5 此处只把消费面补齐，不另立第二条验收条目。

### 6. 定案：证据（三条互锁 + 一次演示）

1. **实案复现（分型取证，不假装三面同型）**：构造 issue 的形态——review 产 1 warn、fix 修文档并完成、findings 的 blocker 计数为 0——再断言收口。三个面的可观测面**不同型**，证据按型给：
   - **doc 线（四型共用 `docReopens`，任取一型即可）与 branch 线 = 收口自锁**：今日必被「fix 自产的 drift」重开 review（§1.1 的因果链），故断言**该线自身闭合**在改动前**必红**、改动后转绿——判据是线的闭合，不是一个 `next:` 字面：`Ledger#lineRoute(type, type)` 为 `null`（等价断言 `peekNext()` 为 `null`，或该记录轮的 C5 路由落在 exit 侧）。断言面按 §11 的公理分写：胶囊与板面渲的是 **pipeline frontier** 的同一个 `NextHop`，故收口轮印的是**下一面的 active hop**——spec 收口而后继 plan 未起步时即 `review --type plan --plan …`（板面侧同形，`board-view.test.ts:316` 已钉）、plan 收口而 plan 为空时即 `review --type branch --plan …`（`:1497` 已钉）；那两个 `review` 是**别的面**的 lead，不是本线被重开，本线的重开只算它自己的 review lead。只有**裸 doc slug**（无 spec、无 plan，pipeline frontier 退化为该面自己的 exit）上两者才是逐字节相同的 `done` / `handoff`。故**带 plan 的 slug** 取胶囊的 `next:` 行并与板面同值，**裸 doc slug** 两面逐字节相同、任取其一断言。不得笼统说「两面此面皆 drift-aware」——drift-awareness 属于 frontier 的装配，不属于渲染面。
   - **wave 线 = 无收口自锁**：零 blocker 的 fix 其 C5 路由是 `done`，`waveLineRoute` 的两个重开分支（`route?.kind === "review"` / `"fix"`，`session/ledger.ts:979-988`）都不命中，落到 `return null`（`:989`）；于是 `#rowClosed`（`session/ledger.ts:1303-1310`）判已闭合、frontier 的 `#nextWavePhase`（`session/run.ts:504-506` → `waveLinePhase`）不再出帧、板面的 wave cell（`face/board-view.ts:719-726`，`closed` 在 `:723`、`active` 在 `:724`）报 closed。**今天不存在 wave 的收口自锁**——把收口写成 wave 的「必红」就是拿一条已绿的断言证红。wave 的必红证据由本相位的一处真实增量承担，并配一条回归对照：
     (i) **reason token**：drifted 且 fix 待办的 wave，今日 drift cell 对 wave 排除（`session/ledger.ts:1230-1233`），`#reasonOf` 落到「有 hop ⇒ `task-open`」（`session/next.ts:396-401`；`task-open` 在 `:401`），改动后注入的 `briefDrift` 让 `route.kind === "review" && gate.drift` 命中（`session/next.ts:399`）→ `doc-drift`。断言 `reason:` 行在改动前必红（行本身尚不存在），改动后 `peekNext` 帧与板面取值 `doc-drift`。**优先级同笔写死**：`#reasonOf` 的 `fix` 行（`:398`）先于 drift 行（`:399`），故 `route: fix` 恒得 `pending-fix`；而 drift 的 wave fix 待办面在 `waveLineRoute`（`session/ledger.ts:983`）里已被改写成 `review`，故那里得 `doc-drift`——`doc-drift` 只落在 `review` 路由上，`pending-fix` 只落在未 drift 的 `fix` 路由上，两者都与 `frame.phase` 一致。**渲染器等值（与注入无关的回归 pin）**：同一 hop 上胶囊与板面两条 `reason:` 行字节等值（胶囊前缀取站表行、板面前缀取布局字面）；它证的是渲染面，**不是** wave 的 drift 注入。
     (ii) **frontier ⇄ 板面的 token 同源（本相位的新增量：必红 → 绿）**：drifted wave 的 `next:` 路由今天**已有两个 drift-aware 读者**——`Lifecycle#peekNext`（`session/run.ts:399-408`，wave 分支直接调 `waveLineRoute`）与板面（`face/board-view.ts:724`）——但两面的 `reason:` 今日都取不到 drift：`Ledger#nextHopOf` 的 drift cell 对 wave 排除（`session/ledger.ts:1230-1233`），故两面一致地渲 `task-open`。本相位在 `#hopOf` 的两条路上喂 `briefDrift`——frontier 的活读者 `peekNext`（`nextHopOf` 调用在 `session/run.ts:838`）与板面 `BoardNext#hopOf`（`face/board-view.ts:849-861`——同样是在既有 `nextHopOf` 入参对象 `:852` 里加一格，不另开第二次调用）——一个判定，两面同值。**断言**：`peekNext().hop.reason === "doc-drift"` 且 `peekNext().frame.phase === "review"`，板面对同一 drifted wave 夹具渲 `  reason:  doc-drift`；改动前两面皆为 `task-open`（**必红**），改动后皆为 `doc-drift`。**一致性**（两面不分叉）在两态都成立，故为回归 pin；`doc-drift` 这个取值是本相位新增的断言。**胶囊在 wave 面与板面同属一个对象（§11）**：它渲的是 `PipelineFrontier.next(...)` 装出的那个 `NextHop`——**pipeline frontier**，与板面**共用**——故不新增胶囊 ⇄ `peekNext` 的 parity 断言：`peekNext` 是 **line frontier**，仍从被派发的 frame 与本线 C5 路由装配（`session/run.ts:399-408`），与 pipeline frontier 不是同一个对象；本相位不为这一对立等值要求，wave 面上两者同值只是该夹具的期望。板面的 parity（§10）才是存在的那一条。**仍然在册的取证边界**：`briefDrift` 的注入只在这两条装配路径（`peekNext` 与板面）上可观察，本相位的 wave 必红断言（上句）即落在这里。
   - **wave 的收口同样按回归断言**：断言同一 wave 在改动前后都收口（钉住现状），证明本相位没有把 wave 的闭合弄坏。
2. **防自旋负控**：收口之后由**编排器侧**改文档，断言 `next:` 仍回 review lead（drift 语义的另一半，非装饰）。
3. **半途负控**：改了文档但 `targetAction` 为假的 fix（BLOCKED），断言基线不推进（`reviewedDocRevisionOf` 仍指向 review 绑定的内容哈希），且 `peekNext()` 帧为该 fix 的重试面（`fix`）——drift 不压 pending fix（§5.5 ②）。
4. **验收演示**（不进测试集）：在 P24 自己的 plan 上真跑一轮 `cdd plan` review → fix → 收口，留下输出。

**测试落点**：写回与三面判定落在 `session/__tests__/run.test.ts`（写回面）；门与重开落在 `face/__tests__/cli.test.ts`（`lineGate` 的 drift 腿）；渲染落在 `face/__tests__/capsule.test.ts` 与 `face/__tests__/board-view.test.ts`（两面同值、`next:` 零变、`reason:` 新增）。wave 的 reason token 需一条自己的夹具：drifted wave brief（plan 的 wave 段在 review 绑定后改动，`reviewedRevisionOf(waveKey)` 即判 drift），可照 `board-view.test.ts:1612-1654` 的 branch 漂移夹具同型构造（同一 `Lifecycle` + `peekNext()` 形态，换 `target: { kind: "wave" }` 与 wave 的写回），板面侧取板输出 / `BoardNext` 的 hop，**不**取胶囊（胶囊在该面看不到 drift）。

### 7. 落点、依赖与发行

**源码落点**（十三行：七处既有面 + 一行渲染源统一（胶囊与板面同一装配）+ 一行新增面（frontier 归 `session/pipeline.ts`）+ 一处判据收窄 + 一行输入面 + 一行汇总单元（§12）+ 一行注入点）：

| 面 | 文件 | 落点 |
|---|---|---|
| 写回白名单 | `session/run.ts` | `:705-718` phase 白名单加 `fix`；`#recordReviewedDocRevision` / `#recordReviewedWaveBrief` / `#recordReviewedBranchRevision` 的文档注释同步语义 |
| dry-run 预览 | `face/preview.ts` | `#recordsOf`（`:152-162`）的写回判别式与 `#bookkeep` 同源——phase 白名单同为 `review \| branch-review \| fix`，腿按 target 取（plan / spec / branch 绑 `reviewedRevision(doc)`、wave 绑 `reviewedRevision(brief)`），**不得留第二份策略**：能共用的判别就共用（`#bookkeep` 与 `#recordsOf` 读同一处判定），否则以 `face/__tests__/preview.test.ts` 的一条 **fix 轮**用例（doc 线断言 `would record:` 含 `reviewedRevision(doc)`）把副本钉死；`:147-151` 的 docstring 同步改为「on a completed review **or a fix**」，并删掉「the branch line binds none」——分支线自 P21 起就绑 plan 的 doc-revision。**这一行的两半**：`fix` 腿是本相位加的；同一次改动顺带治好既有的 `branch-review` 残差——`face/__tests__/preview.test.ts:126-146` 至今仍钉「the branch line — its review binds no reviewed revision」，而 `session/run.ts:707-713` 早已在 `branch-review` 上经 `#recordReviewedBranchRevision`（`:741`）绑 plan 的 doc-revision，故该用例的标题与 `:144` 的 `would record:` 期望同笔改为含 `reviewedRevision(doc)`（陈旧 pin 的修复，不进下面 1–5 类的 `next:` 字节账） |
| 语义注释 | `session/ledger.ts` · `session/run.ts` · `session/next.ts` | `recordReviewedRevision`（文档注释 `:793-797`）改为「已入账 identity」；**`nextHopOf` 的 docstring（`:1205-1218`）同笔改为两值口径**——它今天教「input face 就是 drift-aware 的 gate 裁决、gate 的 drift 就是重开」，本相位之后该装配里有两个 drift 量（替换驱动只取 doc 面 `reviewGate`；`gate.drift` 取 `drift || briefDrift`），注释不改就是新的陈旧契约；**`NextHopInput.gate` 的 docstring（`session/next.ts:211-213`）同属同步列**——它今天教「`drift` = the doc moved past its reviewed revision, so the closed line reopens」，本相位之后该 cell 是**两个事实的并**（doc 的 revision 移动，或 wave 的 brief revision 相对该面自己的已入账 identity 移动），且替换只落 doc 线，故改为「该面自己的已入账 identity 移动了（doc 的 revision 或 wave 的 brief revision），故闭合行重开——替换只对 doc 线生效」；`run.ts:689-693`（白名单正上方）同属同步列 |
| reason 渲染 | `face/route-render.ts` | 新增 `renderReason(hop: NextHop): string`（hop 的缺席由胶囊的同一门一次判定，不设 null 入参）；`renderHop` 不动 |
| reason 站表 | `face/words.ts` | `StationKind`（`:47`）加 `"reason"`；`CAPSULE_WORDS.stations`（`:194-199`）增 `reason: "reason:"` 一行（锚的既有家，注释即「the `: `-suffixed channel anchors」）——**只有胶囊取用**，板面按自己的布局字面写法（见下一行）；`RouteWordKind`（`:57`）与 `routeWords`（`:201-222`）一行不动；站表长度 pin `face/__tests__/face.test.ts:103` 由 4 重锚为 5 |
| 胶囊 | `face/capsule.ts` | `:133-134` 之后追加 `reason:` 行（前缀取 `station("reason")`，不硬编码；值取 `renderReason(hop)`；hop 为 `null` 时不追加） |
| 板面 | `face/board-view.ts` | `:349-358` 的 `nextLine(hop, renderer)` 旁增 `reasonLine(hop)`：前缀为布局字面 `  reason:  `（与 `nextLine` 的 `  next:    ` 同形，不取词表），值直取 `hop.reason`（`renderReason` 的值自带站表前缀，板面不直取；无 `renderer` 参数，故无「渲不出就退化成 `(none)`」的不可达分支）；调用点 `:558` 之后追加一行。**两处 hop-less 字面不改**：`:556` 的 `  next:    (none)`（null-next 分支，不调用 `reasonLine`）与 `:623` 程序板的 `  next:    done` 都不是 `renderHop` 产物，**不追加 `reason:` 行**、字节零变 |
| reason 判据（wave） | `session/ledger.ts` | `nextHopOf`（`:1229-1243`）的 drift 装配**拆成两个局部量**（§4「wave 面」是判据源，本行逐字对齐它）：① **替换驱动** `drift` 仍只取 doc 面 `reviewGate`——`input.doc != null && input.type !== "wave"`，`:1230-1233` 的既有形状**保留**，故 `drift && onExitSide(input.route)`（`:1242-1243`）对 wave 面**完全不触发**；② **原因 cell** 喂 router 的 `gate.drift`（`:1248-1254`）取 `drift \| (briefDrift ?? false)`，wave 面因此能命中 `doc-drift`。**两个值必须分开**：只用一个值会让 wave 的 exit 侧路由被替换成 review，劫持 soft-capped wave 的 `handoff`（而 `WaveGate.vet` 又按 `waveLinePhase` 为 null 拒绝它）；wave 的路由本身仍由 `waveLineRoute` / `#pipeline` 给出。`#briefDrift`（`:1014-1019`）提为 public `briefDrifted(waveKey)`，`waveLineRoute` 的 D30 腿（`:983`）共用 |
| reason 输入面 | `session/ledger.ts` | **`Ledger#nextHopOf` 的内联参数类型**（`:1219-1230`）新增可选 cell `briefDrift?: boolean`；`session/next.ts` 的 `NextHopInput`（`:208-226`）**形状一行不动**（不加 cell、`NextHop.reason` 与 `#reasonOf` 也不动）——`nextHopOf` 自己把该值折进 `NextHopInput.gate.drift`（`:1248-1254`）；该接口唯一被改的是 `gate` 的 docstring（`:211-213`），见「语义注释」行：行为契约不变，只有教它的散文陈旧 |
| 汇总单元 | `face/board-view.ts` | `summaryCell`（`:278`）/ `#summaryToken`（`:296`）/ `#judgementRuns`（`:328`）改为「成功令牌（成功数为 0 时不渲；有失败时带 `/尝试总数`）+ 失败令牌（cycle + `✗→✓` 恢复标记）」；**仅 `summaryCell` / `#summaryToken` 两处** docstring 改指 P24 §12，`#judgementRuns` 的 docstring 同笔改写（按「成功面按 verb 合并、异常面逐条」）但**不删、不改名** |
| 渲染源统一 | `session/pipeline.ts` · `session/run.ts` · `face/cli.ts` · `face/board-view.ts` | 把 `BoardNext#hopOf` 的 cell 装配（target → `type` / `key` / `doc` / `briefDrift`）与 `PipelineFrontier` 一起收进 session 平面；胶囊（`#capsuleLines`，`:439-448`）与板面调**同一个**装配，`#routeNext` 仍只服务 `#markTerminal`；四格输入由 `face/cli.ts` 的装配层收齐——三格（`specType` / `specPath` / `planPath`）取自文档索引，第四格 `planGraph` 取自既有受守卫读（见 §11「输入事实的来源」） |
| frontier 归属 | `session/pipeline.ts`（新增）· `face/board-view.ts` | 新增 `PipelineFrontier`（逐面读该线自己的 `lineStateAt` / `lineRoute` / ready batch + `waveLineRoute`；四条面序规则与 `#exitRoute` / `#lastEnteredIndex` 搬入）；板面删除 `pipelineFacts` 的逐面 `closed` / `active`、`#waveFrontierKey`、`#pipeline`、`#exitRoute`、`#lastEnteredIndex` |
| ~~板面选面~~（已作废） | `face/board-view.ts` | ~~`pipelineFacts` 的 spec / plan 两面 `closed` 改 `lineStateAt`~~——被上一行的整体搬迁取代（它改的两行会被删除） |
| 注入点 | `session/run.ts` · `face/board-view.ts` | 两个调用点喂同一 fact：`Lifecycle#hopOf`（`session/run.ts:836-851`，`nextHopOf` 调用在 `:838`）在 wave 帧上注入 `briefDrift`——对 `peekNext`（frontier，帧未重绑 ⇒ 活判据）生效、对 `advance`（`:447`，`#bookkeep` 已在 `:429-430` 重绑 brief ⇒ 恒假）是死代码，方法签名不动；`BoardNext#hopOf`（`face/board-view.ts:849-861`）在既有 `nextHopOf` 输入对象（`:852`）里加一格 `briefDrift: target?.type === "wave" ? facts.ledger.briefDrifted(String(target.id)) : undefined`（唯一条件是「这一面是 wave」：`target.type` 非 wave 时 `target.id` 是文档路径，不该拿去问 brief drift；**不要**再加 `active !== null` 之类的闸——wave 面从不做路由替换，`handoff` 不会被劫持，见 §4「wave 面」）——该 static 没有 wave 分支（`type` / `key` / `doc` 全由 walked target 派生），**禁止**为 wave 另开第二次 `nextHopOf` 调用；板面 wave key 即 `target.id`（`waveKey ?? ""`，`:725`），空 key 经 `reviewedRevisionOf` 与 null identity 同退化 ⇒ `false`，不另加守卫——从而使板面的 `next:` / `reason:` 与 `peekNext` 同读一个 fact（§4「wave 面」） |

**依赖**：P23 已 Done（`P23 -> P24` hard，本相位不依赖 P23 的任何产物，只依赖其闭合后的树）。

**发行**：`@oscaner-skills/cdd-engine` **minor**（D74：消费面可见字节变化即 minor——新增 `reason:` 行、根 README 一句、**§12 的板面汇总单元在有失败尝试的行上改字节**）。§12 **并入同一份** `.changeset/p24-fix-identity-and-reason-row.md`（不另开第二条、级别不变仍 minor），该条目现有的末句「`cdd board` output is unchanged」随之**改写**而非追加——由落地 §12 的 **Task 8** 在同一次提交里负责（Task 4 的不变式是「每件消费面可见变化都在这一份条目内」）；不涉 kairos 包，故不给 kairos changeset。

**pin 清单（分类在册：零改动 137 处 + 重锚 16 处 = 整块快照 15 处 + 站表长度 1 处；另有第 5 类陈旧散文，断言字节零变）**：`next:` 断言分布于 11 个测试文件、152 处引用，另有一处站表长度 pin 落在同一批词表测试里。分类逐条在册，不许含糊：

1. **零改动（152 − 15 = 137 处）**——形态是按行抽取（`lines[1]!.slice("next: ".length)`）或 `toContain("next: …")`。`reason:` 行追加在索引 2 之后，故 `lines[1]` 抽取与 `toContain` 皆不破；board 行由 `find` / `slice` / `toContain` 定位（`board-view.test.ts:119-124` · `:311` · `:943`；`cli.test.ts:2480`），board 的 capsule 对照取 `[1]`（`board-view.test.ts:1518-1523` · `:1604-1609` · `:1648-1653`），同样不受影响。两处需盯但**断言不动**：board 行布局多一行 `  reason:  `；`face/__tests__/preview.test.ts:295` 的 `not.toContain("next:")`（预览面既无 next 就无 reason，语义仍成立）。
2. **整块 `toEqual` 快照重锚（15 处，`toEqual` 对长度敏感，追加一行即破）**——每处各新增**一个** `reason: <token>` 元素，一个都不许省：`face/__tests__/face.test.ts` **13 处** → `:124`（done）· `:128`（next-wave）· `:136`（review）· `:142`（fix + reviews）· `:152`（bare fix）· `:158`（soft-cap，单行数组）· `:171`（review + wave target）· `:177`（fix + wave target）· `:190`（review + branch target）· `:200`（review + phase-spec target）· `:212`（next-wave + wave target）· `:226`（done）· `:266`（T8 seam 的 `lines`）；行号取 `capsule.emit(...)` 调用行，其 `.toEqual([` 落在紧邻的 `:147` · `:163` · `:182` · `:195` · `:205` · `:213`。`face/__tests__/capsule.test.ts` **2 处** → `:482`（fix 摘要的三行）· `:498`（普通两行）。
3. **站表长度重锚（1 处，全单第 16 处）**——`face/__tests__/face.test.ts:103` 的 `Object.values(CAPSULE_WORDS.stations).length` 由 4 改 5（站表新增 `reason` 行，§4「前缀的声明来源」）。站表侧其它断言：`:66-69` 四条逐键断言（`next` / `blocked` / `warn` / `cliMissing`）不动；`CAPSULE_WORDS.stations` 在测试里只被 `:103` 读，无第二处长度或 sync 断言。`routeWords` 一行未动，故 `face/__tests__/face.test.ts:70-73` 与 `face/__tests__/cli.test.ts:3794`（routeWords-sync，名与注释的「four literal verbs」仍真）断言与名称均不改。
4. **不在重锚列内**（hop 为 `null` → 无 `reason:` 行，形状不变）：`face.test.ts:109` · `:114` · `:118` · `:222` · `:223`，`capsule.test.ts:470` · `:490` · `:491`。
5. **陈旧散文在册（断言字节零变，同笔改写措辞；范围＝凡声称 `next:` / `reason:` 行形状的散文——末行、唯一站锚、唯一站词、以及「`LAST` / `close` / `last line` / `trailing`」这类同义说法——不止「末行」）**——本相位之后 `next:` 不再是成功胶囊 / 一行 hop 渲染输出的末行，且胶囊输出带**两个**站锚（`next:` + 新增的 `reason:`，站表由四行变五行），凡声称这些形状的注释与用例标题一律改为「`next:` 行 + 紧随其后的 `reason:` 行」或按新形状重述：`face/__tests__/face.test.ts:8`（「`next:` last」）· `face/__tests__/face.test.ts:101`（「the only station word in the output is the table's own `next:`」→「both station anchors ride the table (`next:` + the new `reason:`)」——注释 only，`:102` 的 `emitted[1].split(" ")[0]` 断言不动）· `face/capsule.ts:19`（「the dispatchable `next:` literal closes the output」）· `face/capsule.ts:67`（「`next:` line LAST (the dispatchable literal closes the output)」）· `face/capsule.ts:100`（emit 的 docstring：「the optional `next:` line LAST — the dispatchable literal is the output's close」）· `session/run.ts:262`（「`next:` closes the output」）。同族的「trailing `next:`」措辞四处随之改写（`session/run.ts:239` · `:876` · `face/__tests__/capsule.test.ts:474` · `face/__tests__/cli.test.ts:1960`），另加 `face/__tests__/capsule.test.ts:467` 的 describe 标题（「the two-key capsule and the `next:` close」）；它们证的是「摘要在状态行与 `next:` 之间」，前提不变、只换末行措辞。六处注释与五处措辞均不承载断言，故不进 1–4 类的计数。**扫描词面**：末行 / `LAST` / `close` / `last line` / `trailing` / 唯一站锚 / 唯一站词——旧词面只扫「末行」时漏了 `face/capsule.ts:100`，这是本类不再凭「九处」判穷尽的理由。

   另有两文件的自述散文在册（同属本类：不承载断言、断言字节零变）——它们是**输出形状的权威陈述**，不改就是新的陈旧契约：`face/capsule.ts:2`（文件摘要「the `status · handoff · next:` word-face steady state」→「both station anchors ride the table (`next:` + the new `reason:`)」）· `face/capsule.ts:7-10`（文件自己的渲染示意图，需补第十一行 `reason: <token>`，并注明 hop 为 `null` 时不渲）· `face/words.ts:7-8`（capsule 家族描述「the `next:` route station + the stderr stations」→ 站表五行、**两个**路由站锚 `next:` + `reason:`）。改写留在 `face/capsule.ts:1-12` 与 `face/words.ts:1-12` 的既有散文内——架构图以 `face/capsule.ts 1..12` 作为 `face` 节点的取证跨度，新增一行示意图仍在该段内，跨度不脱钩。

### 8. 非目标

- 不改 soft-cap 语义、不改 `REVIEW_CYCLE_CAP`。
- 不引入「改动来源」状态位，不为轮中途的带外编辑提供 provenance（已知边界见 Constraints）。
- 不改 `next:` 值的渲染、不改板面既有行序。
- 不为 `reason:` 提供机器可解析的稳定 schema（它是人读的一行；解析契约不承诺）。
- 不新增胶囊 ⇄ `peekNext` 的 drift parity 断言——§11 之后胶囊与**板面**共用 pipeline frontier 的同一个 `NextHop`（§11 的 Acceptance 覆盖的正是 board ⇄ capsule 这一对），而 `peekNext` 是 frame-keyed 的 line frontier，与 pipeline frontier 不是同一个对象；故 wave 面不再单列胶囊条目，`briefDrift` 注入本身服务 `peekNext` 与板面，见 §4「wave 面」与 Constraints。

### 9. 定案：板面 frontier 的选面读 drift（与门同源）

**缺口**：板面 `BoardView.pipelineFacts` 的逐面闭合，spec / plan 两面用 `ledger.lineClosed(type, type)`——只读 C5 路由，**不读 drift**；`branch` 面用的才是 drift-aware 的 `lineStateAt(type, type, planPath)`。于是收口后被轮外改动的 doc 仍算闭合，frontier 越过它推进到下一面。

**实案（本相位自身的记录）**：P24 的 spec 在 review 6 收口后由裁定回填 5 次（v0.8 → v0.13），`review --dry-run` 判它该重审（drift 成立），而板面同时印 `next: implement --plan docs/kairos/plans/2026-10-10-engine-doc-tooling-p24.md --tasks 1,2` —— **板面给出的是一条引擎会拒的命令**。这不是 lifecycle 的问题：`Lifecycle#nextLinePhase` 读 `docReopens`，本来就是 drift-aware 的。

**定案**：选面的闭合判定换用**既有的** drift-aware 读数——`phase-spec` 与 `plan` 两面的 `closed` 改为 `ledger.lineStateAt(type, type, docPath) === "closed"`（`session/ledger.ts:1154-1161`），与 `branch` 面同一条判定。`lineStateAt` 的定义就是「C5 已闭合 **且** 身份文档未漂移」：`!lineClosed ⇒ "open"`，否则 `reviewGate(...).kind === "open" ⇒ "reopened"`，其余 `"closed"`。**不新增判定、不新增状态位**——这是 §3「一个已入账 identity，两个读它的人」的第三次应用。

**选面之后的 `next:` 怎么走到 review**：frontier 停在该 doc 面 → `BoardNext.#pipeline` 取该面的活动 hop → `nextHopOf` 的既有替换腿（`drift && onExitSide(route)`，`session/ledger.ts:1242-1243`）把它替换成 review lead；`reason:` 由 `gate.drift` 命中 `doc-drift`（§4）。故本相位**不改** `#pipeline` 的四条面序规则。

**证据（必红 → 绿）**：构造「spec 已收口 → 轮外改 spec → plan 存在」，断言板面 `next:` 为该 spec 的 review lead（`review --type <specType> --spec <path>`）且 `reason:` 为 `doc-drift`——今日为 `implement --plan … --tasks …`。**孪生绿**：该 review 闭合后 frontier 前进到 plan 的波形（回归 pin：不得把正常推进弄坏）。

**非目标**：不改 `Lifecycle` 的 frontier（已 drift-aware）· 不改 `#pipeline` 的面序规则 · 不为 wave 面引入 drift 选面（wave 闭合是 `closedWaves()` 集合，其 drift 已在 §4「wave 面」处理）· 不动 `lineClosed` 本身（它是 `lineStateAt` 的一半，仍有其消费者）。

### 10. 定案：pipeline frontier 归 session 平面（板面即投影）

**缺口**：板面至今自持**三份**判定——`pipelineFacts` 的逐面 `closed` / `active` 单元格 · `#waveFrontierKey` 自走一遍 ready batch · `#pipeline` 的四条面序规则与 `#exitRoute` / `#lastEnteredIndex`。§9 只把 spec / plan 的 `closed` 换成 `lineStateAt`，结果是「某一次恰好对上」：

**实案**：spec 因版本重号产生 drift 之后，板面印 `review --type phase-spec --spec …`（§9 生效），同一时刻波形自己的 `next:` 印 `review --type wave --tasks 5`——两条**都可执行**，没有仲裁者。这不是 §9 的回归：§9 让事情说对了，同时把「判定所有权仍未统一」暴露出来。

**定案**：pipeline frontier 的判定整体搬进 session 平面，板面退化为**渲染**。

- **新增 `session/pipeline.ts` 的 `PipelineFrontier`**：逐面只调该线**自己的**读数——`phase-spec` / `plan` / `branch` 用 `lineStateAt(...)` + `lineRoute(...)`；`wave` 用 ready batch + `waveLineRoute(...)`（不得自走 ready batch）。四条面序规则、`#exitRoute`、`#lastEnteredIndex` 一并搬入（`PIPELINE_FACES` / `PIPELINE_NEXT` 两张表本来就住 session 平面）。
- **输出形状不变**：仍是 `{ face, route, target }`，交给既有 `Ledger#nextHopOf` → `NextHop`；`next:` / `reason:` 的渲染面一行不改。
- **`face/board-view.ts` 删除**：`pipelineFacts` 的逐面 `closed` / `active`、`#waveFrontierKey`、`#pipeline`、`#exitRoute`、`#lastEnteredIndex`——板面不再判定任何东西。**§9 的「板面选面」落点行随之作废**（它改的两行会被本任务删除）。

**证据（纯重构的三条，无「必红」）**：**本任务不修任何行为缺陷**——初稿把「板面 `next:` == frontier 线 `peekNext()`」写成「今日必红」，实测否掉了它：§9 落地后（`c2626b68`）play 第 6 轮的评审**直接搭台实测**了该状态（spec 已收口且绑定身份 → 轮外改 spec → plan 存在且波形就绪），板面渲出的 `next:` / `reason:` 与该 spec 线 `peekNext()` **逐字节相同**；**该状态没有任何既有 pin 覆盖**（`board-view.test.ts:1589` 的 (h) 里 spec 从未被审过、无 drift；`:1612` 的 (h2) 漂的是 plan、钉的是 branch 线），所以它是**一次实测事实，不是被钉住的断言**——本相位不为它新增 pin（纯重构的判据见下），用户观察到的分叉是**两条不同线**的 next（板面的 spec 线 vs 波形那一轮的自身输出），不是 parity 违约。故证据改为：① 行为零变——既有 `next:` / `reason:` 断言**一行不改**仍全绿；② 结构断言——`face/board-view.ts` 内 frontier 判定代码全部消失（`grep` 为空）；③ 搬走的四条面序规则由 `pipeline.test.ts` 直接打 `PipelineFrontier`（新家自己的用例）。**不得**再声称「必红」。另一条是**零字节回归**：`board-view` 既有测试文件的 `next:` / `reason:` 字节一条不许动（纯重构）。

**边界**：C5 决策表 · drift 判据 · pending-fix 派生 · 写回 · 派发动词 · round 记账**一律不动**——本任务只搬「哪条线在下」。**不含**「越序派发要不要被拒」：pipeline frontier 仍是调度建议而非闸（`WaveGate` 只查波与波之间的前置），要让引擎拒绝越序需另立。

### 11. 定案：每轮的下一跳也读 pipeline frontier（渲染源统一）

**缺口**：§10 统一了「**哪条线在下**」的判定，但每轮胶囊仍喂 `#routeNext(frame)`（本线的 C5 路由），板面喂的是 frontier 路由。两者共用 `nextHopOf` / `NextStepRouter`（判定确实同源），但**输入路由有两个来源**，所以结果会不同——实测同一时刻：spec 行收起后其自身 `next:` 是 `route to /skill:cdd-plan skill`，而板面（全流程已闭）是 `route to /skill:cdd-close skill`。

**定案（比「只换路由」更深一层）**：胶囊要渲染的**不是一个路由，而是板面渲染的那个 `NextHop` 对象**。因为 `#hopOf(frame, route)` 的 `type` / `key` / `doc` / `briefDrift` 全部取自**被派发的那个 frame**，而 `Ledger#nextHopOf` 又基于同一组 frame-keyed 输入重算 drift——所以只把 route 换掉，cell 仍是本轮的，frontier 的 target（例如 spec）与 cell（例如 wave）就会打架。

因此：**把板面 `BoardNext#hopOf` 填 cell 的那段装配（target → `type` / `key` / `doc` / `briefDrift`）与 `PipelineFrontier` 一起收进 session 平面**，胶囊与板面调**同一个装配**，各自只负责渲染。做完之后「板面与胶囊是同一个对象」是结构事实。

**输入事实的来源**：`PipelineFrontierInput` 有四格（`specType` / `specPath` / `planPath` / `planGraph`）。生命周期手上只有 argv 派生的 `#planPath`（`--spec` 轮为 null），doc 轮的 run state 是 `EMPTY_RUN_STATE` 而非 `TaskGraph`——**都不够**。故其中三格（`specType` / `specPath` / `planPath`）由 `face/cli.ts` 的场景从文档索引填；**第四格 `planGraph` 不是索引单元格**——它是既有的受守卫读（`readFileSync` + `PlanDocType` 解析，今日在 `face/board-view.ts:720-728`），由 `:711` 的 `pipelineFacts` 注入 frontier（`session/pipeline.ts` 自身不读文件，`:9` / `:43` 已定此规）。**该读在装配搬走之后的家要说准**：§10 搬走的是板面的**判定**，不是这处受守卫读——它要么提成 `face` 侧的一个 seam，其产物（`TaskGraph | null`）作为一格输入交给 session 平面，要么在组合根（`face/cli.ts` 的场景）读出后注入；两条都可，但**不得**让 frontier 自己去读文件，也**不得**把 `task-open` 之类的判据挪进 `face`。即：**四格的来路都要在装配层收齐**（三格索引 + 一格受守卫读），frontier 只消费。

**术语消歧（本相位之后必须分开说的两件事）**：**pipeline frontier** 指 `PipelineFrontier.next(...)` 的产物——胶囊与板面**共用**它；**line frontier** 指 `Lifecycle#peekNext`——它仍从被派发的 frame 与本线 C5 路由装配，是**单线**视角。故「胶囊与板面是同一个对象」成立，「胶囊与 `peekNext` 是同一个对象」**不成立**（§11 的旗舰夹具本身就把两者分开）。凡是把两者混称「frontier」的句子都要改准；parity 断言只打 board ⇄ capsule 这一对，**不**打 capsule ⇄ peekNext。

**落空面**：无 spec / 无 plan 的裸 slug，frontier 退化为该面自己的 exit；此时胶囊与今日逐字节相同（有测试）。

**证据**：

- **必红（真必红，不是 §10 那次）**：一条断言——「spec 未闭而行完一轮波形，胶囊的 `next:` 必须等于板面的 `next:`，且其 `reason:` 同值」；今日两者**不等**（胶囊印本线的 review / implement 字面），改后相等。
- **行为边界**：`next:` 仍是可执行字面；`reason:` 仍取同一 token 源；C5 / drift / pending-fix / 写回 / 派发动词一字不动。
- **重锚在册**：胶囊整块快照中「pipeline frontier next ≠ 本线 C5 next」的那些会改变，实施轮须**逐条**登记（文件:行 + 变化前后），不许只说「若干处」；§7 的 137/15 分类只描述**非胶囊**读者，胶囊侧另立一份清单。

**非目标**：不引入越序拒绝。frontier 仍是**建议**，只是这条建议现在由每轮输出承载，而不是只有板面承载。

### 12. 定案：板面汇总单元区分「尝试总量 / 失败轮次 / 是否已恢复」

**缺口**：`BoardView.summaryCell` 按「**判决连续段**」切分，每段从 1 重新计数（`face/board-view.ts:328-345`）。plan 行今日实渲（`cdd board --plan docs/kairos/plans/2026-10-10-engine-doc-tooling-p24.md`）：

```
review 13 ✓+74 · fix 11 ✓ · fix 1 ✗ · fix 2 ✓
```

真相是：cycle 1–11 成功、**cycle 12 的 attempt 1 失败**（child 404 的环境故障）、cycle 12 attempt 2 与 cycle 13 成功。四个问题：

1. 三个数字都是**段内计数**，不是进度——「fix 1 ✗」看着像第 1 轮，实际是第 12 轮。
2. `attemptSuffix` 只渲**段末**记录，那次重派（12a2）在输出里**完全消失**。
3. 读者无法从 `fix 1 ✗` 判断这次失败**是否已经恢复**。
4. 「成功数」与「失败轮次」被塞进同一种令牌形状，两种量无从区分。

**本相位不推翻的地基（P22 §5.3，仍为历史依据）**：裁决符不可省 · findings 只以 `+N` 出现 · **区间形永不出现**（`review 1–10 ✓` 即红）· `attempt === 1` 不加后缀（出现 `a1` 即红）。

**§12 明确修订 P22 §5.3 的三条**（不装作"在门内"）：

- P22 `:255`「只按 verb 聚合、不逐轮展开」——**修订**：失败尝试**逐条**列出（成功仍严格按 verb 合并）。展开只发生在异常面，成功面不展开。
- P22 `:257` 令牌形 `{label} {count} {mark}`——**修订**：✗ 令牌携带 **cycle 号**而非 count；有失败时 ✓ 令牌携带 **`{成功}/{尝试}` 比率**而非纯计数。
- P22 `:260` 的示例字面 `fix 1 ✗ · fix 1a2 ✓`——**作废**，由下面的新形取代。

**令牌顺序**：外层按 `VERB_ORDER`（`implement` → `review` → `branch-review` → `fix`，其余 verb 追加在后，`face/board-view.ts:58`）；**内层同一 verb 内先成功令牌、后失败令牌**，失败令牌按时间序（`rounds` 的存储序，同今日 `#judgementRuns` 的读序）。示例中若前一个 verb 有失败，形如 `review 3/4 ✓ · review 3 ✗→✓ · fix 3 ✓`（失败令牌**紧跟**其 verb 的成功令牌，不聚到行尾）。

**定案（两类令牌，形状不同故不会混淆）**：

- **成功令牌**：**该 verb 的成功数为 0 时不渲**（纯失败 verb 只有 ✗ 令牌，故既有 pin `review 1 ✗` / `implement 1 ✗` 字节零变）；无失败时 `{verb} {成功数}{末条成功记录的 attempt 后缀} ✓{+N}`；**该 verb 存在失败记录时**改渲 `{verb} {成功数}/{尝试总数} ✓{+N}`——**比率形不带 attempt 后缀**（后缀与分母不同时出现，避免 `fix 1/2a2 ✓` 这类读法；末条尝试是第几次已由同行的 ✗ 令牌说明）。
- **失败令牌**：每条失败记录一个，`{verb} {cycle}{attempt>1 ? aN : ""} ✗{+N}`；**若该 cycle 的后续 attempt 成功**（重派 = 同 cycle 的 `attempt + 1`，不是「后续 cycle」），改为 `{verb} {cycle}{aN} ✗→✓{+N}`（已恢复，**`+N` 照带**——该轮的 findings 数不因后来成功而消失）。

**令牌数的界**：✓ 每个 verb 至多一枚（成功面严格合并）；✗ **每条失败记录一枚、逐条不设上限**（展开只发生在异常面）。**没有既有常量封顶它**——`REVIEW_CYCLE_CAP`（`session/next.ts:65`，读点在 `:274`）只对 `ref.consecutiveS1` 生效（`Ledger#consecutiveS1Run`，`session/ledger.ts:1613-1622`：连续「每轮都带 blocker」的 review 轮数），它界的是 blocker 循环，**不界同一 cycle 的 attempt 重派**（重派即 `attempt + 1`，`session/run.ts:595-600`）。故 ✗ 令牌数在理论上无界，本相位**不为它加界**（异常面本就该完整暴露）。

**本相位实况与既有 pin 的前后**：

| 数据 | 今日 | 本相位之后 |
|---|---|---|
| plan 行（cycle 1–11 胜 · 12a1 败 · 12a2 胜 · 13 胜） | `review 13 ✓+74 · fix 11 ✓ · fix 1 ✗ · fix 2 ✓` | `review 13 ✓+74 · fix 13/14 ✓ · fix 12 ✗→✓` |
| 既有 pin（`board-view.test.ts:1274`：cycle 1 的 a1 败、a2 胜） | `fix 1 ✗ · fix 1a2 ✓` | `fix 1/2 ✓ · fix 1 ✗→✓` |
| 无失败行（该 verb 无失败记录，如 `review 13 ✓+74 · fix 13 ✓`） | 同 | **逐字节相同** |
| 纯失败行（该 verb 成功数为 0，如 `review 1 ✗` · `implement 1 ✗`） | 同 | **逐字节相同**（成功数为 0 ⇒ 不渲 ✓ 令牌） |
| 两 verb 且前者有失败（顺序样例） | — | `review 3/4 ✓ · review 3 ✗→✓ · fix 3 ✓`（失败令牌紧跟其 verb 的成功令牌，不聚到行尾） |

新形的读法：`13/14 ✓` = 14 次 fix 尝试、13 次成功；`fix 12 ✗→✓` = cycle 12 的尝试失败过一次、随后重派成功。四个问题逐条消解：数字是**尝试口径**而非段内计数 · 重派由 `→✓` 显式出现 · 是否恢复一眼可读 · ✓ 与 ✗ 是**两种形状**（比率 vs cycle），不再同槽。

**证据（每条带 pin）**：

1. **实况行必红**：上表第 1 行的目标字面，断言在 `face/__tests__/board-view.test.ts` 新增用例；改动前必红（今日渲 `fix 11 ✓ · fix 1 ✗ · fix 2 ✓`）。
2. **既有 pin 重锚**：`board-view.test.ts:1274` 的 `"fix 1 ✗ · fix 1a2 ✓"` → `"fix 1/2 ✓ · fix 1 ✗→✓"`。
3. **无失败行与纯失败行零变**：`board-view.test.ts:1218-1228` · `:1242-1246` · `:1256-1265` 与 `cli.test.ts:7356-7357` 的既有断言**一行不改**仍绿。这四段既有**无失败行**（`:1218` 的 `review 10 ✓` · `:1225` 的 `review 1 ✓` · `:1242` 的 `review 3 ✓+2` · `:1263` 的 `review 1 ✓+2`），也有**纯失败行**——`:1228` / `:1246` 的 `review 1 ✗` 与 `cli.test.ts:7356-7357` 的 `implement 1 ✗` 是「有失败记录、成功数为 0」的行：按定案该 verb 的 ✓ 令牌不渲，故它们照旧只出 ✗ 令牌、字节零变（若渲 `review 0/1 ✓` 便与这些 pin 直接冲突）。新增用例再为纯失败 verb 立一条独立断言（`review 1 ✗`，与 `:1228` 同形）。
4. **两条 P22 门仍红**：区间形（`review 1–10 ✓`）与 `a1`（任何令牌出现 `a1`）的既有断言不改。
5. **重锚在 §7 的 1–5 类账之外**：板面汇总单元不是 `next:` 行，故 `board-view.test.ts:1274` 的重锚与上面的新增实况用例不占 §7 的 152 处引用、15 处 `toEqual` 快照、站表长度 1 处任何一格——§7 的账只覆盖 `next:` 字节，本处按**账外修复**在册（先例：`preview.test.ts:126-146` 的陈旧 pin，同属 `next:` 账外）。

**陈旧散文登记（随本任务同笔改写，不含断言）**：`board-view.test.ts:1268` 的用例标题 `(d) a re-dispatch carries its attempt superscript and attempt 1 never renders a1` 在 §12 之后不准（新形 `fix 1/2 ✓ · fix 1 ✗→✓` 无上标；上标只在失败令牌且 `attempt>1`、或无失败的成功令牌上出现）；`#judgementRuns`（`face/board-view.ts:328`）**保留**——不删除、不改方法名，只改其 docstring：标题与注释由「contiguous verdict runs」改为「成功面按 verb 合并、异常面逐条」，并指 P24 §12。

**落空面（范围写窄）**：`face/board-view.ts` 里 `spec §5.3` 的引用约十处（`:24` 文件头 · `:60` 字形 · `:294` `+N` · `:370` 在飞单元 · `:406`/`:511`/`:530` 排版 · `:612` 波单元 · `:655` doc 单元）。**只有承载令牌规则的三处 docstring（`summaryCell` / `#summaryToken` / `#judgementRuns`）改指 P24 §12**；其余引用的是排版与字形规则，P22 §5.3 对它们仍然是正确依据，**不动**。

**发行面**：`cdd board` 对有失败的行输出变了 ⇒ changeset 必须新增一条（`.changeset/p24-fix-identity-and-reason-row.md` 现有末句「cdd board output is unchanged」随之作废，须改写而不是追加）。

**非目标**：不引入 `--verbose` · 不改 `+N` 算法 · 不改 capsule 排版 · 不给失败令牌加 `a1`。

### Acceptance criteria

- **汇总单元（§12）**：有失败尝试的行渲 `{verb} {成功}/{尝试} ✓ · {verb} {cycle} ✗→✓`（实况 `fix 13/14 ✓ · fix 12 ✗→✓`，同 cycle 重派 `fix 1/2 ✓ · fix 1 ✗→✓`），改动前必红；**成功数为 0 的 verb 不渲 ✓ 令牌**（纯失败行 `review 1 ✗` / `implement 1 ✗` 字节零变，另有一条独立用例钉住）；**令牌顺序钉死**（外层 `VERB_ORDER`，同 verb 内先成功令牌、后失败令牌，失败按时间序，不聚到行尾——样例 `review 3/4 ✓ · review 3 ✗→✓ · fix 3 ✓`）；无失败记录的行**字节零变**；区间形（`review 1–10 ✓`）与 `a1` 两个既有门仍红。
- **每轮的 next 读同一 frontier（§11）**：spec 未闭而行完一轮波形时，胶囊的 `next:` **等于**板面的 `next:`（spec 的 review lead），今日必红、改后相等；且 `next:` 仍是可执行字面、`reason:` 仍取同一 token 源；胶囊快照中受影响处的重锚逐条在册。
- **板面即投影（§10 · 纯重构）**：同一 slug 上，板面的 `next:` 等于 frontier 那条线自己的 `peekNext()` 渲染值（parity，**改动前后皆成立**——它是回归事实而非必红）；① `board-view` 既有测试的 `next:` / `reason:` 字节零变（断言一行不改仍全绿）② `face/board-view.ts` 里不再存在 frontier 判定代码（`#pipeline` / `#exitRoute` / `#lastEnteredIndex` / `#waveFrontierKey` 均已移出）③ 四条面序规则由 `pipeline.test.ts` 直接钉。
- **板面 frontier 的选面读 drift（§9）**：spec 已收口、其后其身份文档被轮外改动、且存在 plan 时，板面 `next:` 为该 spec 的 review lead 且 `reason:` 为 `doc-drift`（今日为 `implement --plan … --tasks …`），断言在改动前的树**必红**；该 review 闭合后 frontier 前进到 plan 的波形（孪生回归 pin）。
- **doc 线（四型共用 `docReopens`，任取一型）与 branch 线**：`review`（仅 warn/nit）→ `fix`（改文档、blocker 计数为 0）之后的下一次调用**该线闭合**：`Ledger#lineRoute(type, type)` 为 `null`（等价断言 `peekNext()` 为 `null`，或该记录轮的 C5 路由落在 exit 侧）；每线一条测试；**断言面按 §11 之后的规范写**：胶囊与板面渲染 **pipeline frontier** 的同一个 `NextHop`，故对**带 plan 的 slug**，收口轮的 `next:` 是**下一面的 active hop**——spec 收口而后继 plan 未起步时即 `review --type plan --plan …`（板面侧同形，`board-view.test.ts:316` 已钉）、plan 收口而 plan 为空时即 `review --type branch --plan …`（`:1497` 已钉）；那两个 `review` 是别的面的 lead，不构成本线被重开（本线自己的 review lead 才算重开）；只有**裸 doc slug**（无 spec、无 plan）才是本线的 exit（`handoff` / `done`），且该面上两者逐字节相同——测试夹具须显式选其一并写明，不得笼统说「两面此面皆 drift-aware」，且该测试在改动前的树上**必红**（先证红，后转绿）。
- **wave 线无收口自锁，证据按 §6 第 1 条的分型给**：不做「必红 → 绿」的收口断言——零 blocker 的 fix 其 wave 路由今日已是 `done` → 已闭合（`session/ledger.ts:989` · `:1303-1310`）。wave 的必红证据是 **frontier / 板面这一跳**的 reason token：drifted wave，今日在 `peekNext` 帧与板面上 `reason` 为 `task-open`（drift cell 对 wave 排除，`session/ledger.ts:1230-1233`）、改动后为 `doc-drift`（frontier 经 `Lifecycle#hopOf` 注入、`nextHopOf` 调用在 `session/run.ts:838`；板面经 `BoardNext#hopOf` 注入，`face/board-view.ts:849-861`）；drift 的 wave fix 待办面已在 `waveLineRoute`（`session/ledger.ts:983`）里改写成 `review`，故其 token 是 `doc-drift`，`#reasonOf` 的 `fix` 行（`session/next.ts:398`）只对未 drift 的 `fix` 路由给出 `pending-fix`（drift 行 `:399` 在其后）。wave 的收口另作**回归**断言（改动前后都收口）；**frontier ⇄ 板面**的 token **一致性**是回归 pin（改动前后都不得分叉），而 token 取值 `doc-drift` 是本相位新增的必红 → 绿断言。**胶囊在 wave 面同属断言面（§11 之后渲 pipeline frontier 的同一个 `NextHop`）**：它渲的是 `PipelineFrontier.next(...)` 的 hop，故 `reason:` 与板面同值；不新增胶囊 ⇄ `peekNext` 的 parity 断言——`peekNext` 是 frame-keyed 的 line frontier，与 pipeline frontier 不是同一个对象，同一夹具上的同值只是该夹具的期望（§11 的 Acceptance 覆盖的是 board ⇄ capsule 这一对），且该面上新增的必红断言仍只落在 `peekNext` 与板面这两条注入路径上。
- wave 面的 `reason:` 与其重开判据同源：drifted wave brief 在 `peekNext` 与板面渲 `reason: doc-drift`，与 `peekNext` 的 `frame.phase`（review）一致；非 drifted 的 wave 面 token 仍按既有序取值（`pending-fix` / `task-open` / `closed-line`）。胶囊在该面上渲的是 §11 之后的 **pipeline frontier** hop（故 token 与板面同值；与 `peekNext` 同值是该夹具的期望，不是恒等式）。
- 收口之后由编排器侧改同一文档 → `next:` 仍回 review lead（drift 重开语义未失效），有测试。
- `targetAction` 为假的 fix（BLOCKED / TIMEOUT）不推进基线 → 仍判 drift（负控读账本的 `doc_hash`），frontier 给的是该 fix 的重试面（`peekNext()` 帧 `fix`；drift 不压 pending fix，§5.5 ②），有测试。
- **非胶囊读者的**每条由 hop 渲染出的 `next:` 行（`RouteRenderer#renderHop` 的产物）之后紧跟一行 `reason: <token>`，token 取 `NEXT_HOP_REASON` 七值之一。两处**非 hop** 的 `next:` 字面是显式例外、字节零变且**不带** `reason:` 行：`face/board-view.ts:556`（null-next 分支的 `  next:    (none)`）与 `:623`（程序板收尾的 `  next:    done`），二者登记在 §7 的板面行。`next:` 行字节与今日**逐字节相同**——证据是 §7 pin 清单的分类：152 处引用中 137 处按行抽取 / `toContain` 零改动，15 处整块 `toEqual` 快照各**只**追加一个 `reason:` 元素（`face/__tests__/face.test.ts` 13 处 · `face/__tests__/capsule.test.ts` 2 处，逐条在册），外加站表长度 pin 1 处（`face/__tests__/face.test.ts:103`，4 → 5）重锚。
- 胶囊与板面渲染同值（同一 hop 的同一 token）；BLOCKED / TIMEOUT 轮两面都不渲 `reason:`。前缀**字节同值而不共用来源**：胶囊走**站表**行（`words.station("reason")`，与它取 `next:` 同路），板面走与其 `next:` 行同形的布局字面 `  reason:  `；站表由四行变五行，`face/__tests__/face.test.ts:103` 的站表长度 pin 重锚为 5（全单第 16 处重锚，§7 在册），`routeWords` 与 `face/__tests__/cli.test.ts:3794` 的 routeWords-sync 不动。
- 根 `README.md:60` 与其 `.zh-CN.md:64` 镜像同步更新该 bullet 的**首句与后半句**（「printed last」/「最后打印」在加行后不再成立），第三个从句（板面）原样保留并因 `reason:` 同值而更强，`SKILL.md` 零变更。
- `env -u AI_AGENT pnpm run validate` 退出码 0；`pnpm run emit:check` fresh；changeset 为 `@oscaner-skills/cdd-engine` minor，且 **§12 的板面字节变化并入同一份 p24 条目**（不另开第二条、不改级别），该条目末句「`cdd board` output is unchanged」已改写为「在有失败尝试的行上会变」。

## Constraints

- **`next:` 可执行契约不可破**：它必须仍是「整行抄进 shell 就能跑」的字面；任何诊断信息只能落在**另一行**。
- **单点判据**：三面共用**一个已入账 identity**（`recordReviewedRevision` 是唯一写入）与**每面一个既有 drift 判定**：不得新开第二处写入，也不得新开第二个 drift 判定；doc 线与 branch 线读 `docReopens`，wave brief 读 `waveLineRoute` 的 D30 腿（两读者读同一 identity，见 §1.3），wave 的 reason cell 只注入该腿已算出的布尔，不重算。
- **wave 面的备选收窄（须报告，不得静默）**：若注入 `briefDrift` 必须改 D30 precheck（`waveLineRoute`）或 frontier 判据本身——越出本相位的边界——则 wave 面只保路由一致（写回单点已覆盖，且该面本无收口自锁，见 §2 / §6），其 `reason:` 如实保持 `task-open`，并须在本 Constraints 写明该已知限制 + 另开 follow-up issue 记录残差。
- **只推进完成的轮**：`targetAction` 为假的轮一律不推进基线，这条不可为「简化」而放宽。
- **已知边界**：轮次进行中由编排器带外改文档（已违反「派发期间不动树」纪律）会被 fix 的写回一并入账——本相位不建 provenance 去区分；该场景记为已知限制。
- **注入点只服务 frontier 读者（不是胶囊的输入面）**：`Lifecycle#hopOf`（`session/run.ts:838`）与板面 `BoardNext#hopOf` 的 `briefDrift` 注入读的是同一个既有事实（该面自己的已入账 identity 相对 brief revision 是否移动）——对 `peekNext` 是活判据，对 `#bookkeep` 之后的 `advance` 那一跳是死代码。§11 之后胶囊渲的是 **pipeline frontier** 装出的 `NextHop`（与板面共用），故本节**不**声称「胶囊帧上 drift 恒为假」：该说法只描述 `peekNext` 这条 frame-keyed 的 **line frontier** 装配，不再是胶囊的输出事实；上面两条注入路径服务的是那个装配，不是胶囊。
- **零状态迁移**：不改 `progress.json` 的任何键名或键集。
- **消费面纯净**：`SKILL.md` 与技能 `docs/` 零变更；根 README 只改那一句（英 + 中镜像同笔）。

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-11-04 | 初稿：P24 NEXT-LOOP 收口面——基线随轮推进（写回白名单加 `fix` · 只推进完成的轮 · 三面单点）· reason 独立行（七类无条件 · 胶囊与板面同字节 · `next:` 字节零变）· 字段语义只改注释不迁移 · 根 README 一句 · 证据三条互锁 + 演示 · 零重锚 | Oscaner M. · Claude（kairos:cdd-design [P24] grilling → 本会话落 spec · 2026-11-04） |
| v0.2 | 2026-11-04 | 评审回填（无结构变更，内容面）：① reason 行落点按实测更正——板面方法是 `static nextLine(hop, renderer)`（`face/board-view.ts:349-358` · 调用点 `:558`），新增并列 `reasonLine`，旧方法名与旧行名（钉错的旧符号）全删 ② wave 面的 drift 判据收窄进本相位——`nextHopOf` 的 drift cell 由 `type !== "wave"` 排除改为读注入的 `briefDrift`，`#briefDrift` 提为 public `briefDrifted(waveKey)` 由 `waveLineRoute` 的 D30 腿共用（`:983` · `:1014-1019`），run `#hopOf` 与 `BoardNext#hopOf` 注入；wave 的 drift 替换沿用 D30 既有语义不受 exit-side 限制，胶囊与 frontier 从此同路由 ③ §1.3 / Constraints 单点改写为「一个已入账 identity + 每面一个既有判定」（`docReopens` 服务 doc/branch 且有两个读点 `face/gate.ts:87` · `session/run.ts:545`/`:554`，`waveLineRoute` 服务 wave）④ §6 证据 1 按线指定断言面——wave 不得用胶囊 `next:`（今日 drift-blind 已绿），取 `frame.phase` 或板面 `next:` ⑤ 措辞与 pin：`fix 轮无法收口` · `session/next.ts:272-286` · `#briefDrift` `:1014-1019` ⑥ spec 文件补 EOF 换行 | [human] · Claude（kairos:cdd-design [P24] 评审回填 · 2026-11-04） |
| v0.3 | 2026-11-04 | 第二轮评审回填（无结构变更，内容面）：① 字节面由「零重锚」改为**分类在册**——152 处引用拆成「按行抽取 / `toContain` 零改动 137 处」与「整块 `toEqual` 快照 15 处逐条重锚」（`face.test.ts` 13 处 · `capsule.test.ts` 2 处，每处新增一个 `reason:` 元素），Acceptance 的字节面同步改写 ② wave 线的收口证据改型——wave 今天**无收口自锁**（`waveLineRoute` 落到 `return null` `:989` · `#rowClosed` `:1303-1310`），§2 正名写回面的 wave 支对收口零可观测收益，§6 第 1 条改为分型取证（doc/branch = 红转绿；wave = reason token 红转绿 + 路由与收口的回归 pin），Acceptance 同步 ③ `reason:` 前缀落到词表——`RouteWordKind` 加 `"reason"`、`routeWords` 增一行，§7 增一行落点，站表与四站 pin 不动 ④ 根 README（英 + 中镜像）该 bullet 的粗体首句一并改写 | [human] · Claude（kairos:cdd-design [P24] 第二轮评审回填 · 2026-11-04） |
| v0.4 | 2026-11-04 | 第三轮评审回填（无结构变更，内容面）：① §6(ii) 由「回归 pin」改为**本相位新增的 parity**——wave 的 drift-aware 读者今日只有 `Lifecycle#peekNext`（`session/run.ts:402-405`）与板面（`face/board-view.ts:724`），胶囊读 recorded round 的 C5 路由（`:438` → `:813-818` · `:447`），且 `#bookkeep`（`:705-713`）已在同一调用重绑 brief，故 `advance` 胶囊见 `drift: false`；回归只留 frontier ⇄ 板面 ② §1.2 与 Acceptance 的「今日 `reason` 为 `task-open`」按面收窄（frontier / 板面这一跳），并写死 `#reasonOf` 优先级——`fix` 行（`session/next.ts:398`）先于 drift 行（`:399`），`doc-drift` 只落 `review` 路由 ③ `reason:` 前缀改为**两面各按既有形态、字节同值不共用来源**：胶囊走词表行，板面沿用其 `next:` 的布局字面写法（`face/board-view.ts:357`），`reasonLine(hop, renderer)` 取 `renderer.renderReason(hop)`，不加 `Words` 参数；§4 / §7 / Acceptance 三处同步 ④ §5 README bullet 给出**整条**英中改写，第三个从句（板面）原样保留 | [human] · Claude（kairos:cdd-design [P24] 第三轮评审回填 · 2026-11-04） |
| v0.5 | 2026-11-04 | 第四轮评审回填（无结构变更，内容面）：① **斩掉胶囊的 wave parity 腿**——胶囊帧恒在 `#bookkeep` 重绑之后，`advance` 腿注入 `briefDrift` 是死代码、该状态不可达；§4 / §6(ii) / Acceptance / Constraints 四处同步，wave 的增量收窄为板面 `reason:` 与 frontier 同判据，回归 pin 只留 frontier ⇄ 板面，run `#hopOf` 不再列为注入点 ② `reason:` 前缀的家改回**站表**（`StationKind` + `stations`，与 `next:` 同路），`routeWords` 一行不动（故 `cli.test.ts:3794` 不致陈旧），站表长度 pin `face.test.ts:103` 由 4 重锚为 5，登记为全单第 16 处重锚 ③ pin 清单补第三类（站表长度，含站表侧无第二处 sync 断言的核验） ④ 两处 hop-less 帧面字面（`face/board-view.ts:556` `(none)` / `:623` 程序板 `done`）登记为显式例外：不带 `reason:` 行、字节零变 | [human] · Claude（kairos:cdd-design [P24] 第四轮评审回填 · 2026-11-04） |
| v0.6 | 2026-11-04 | 第五轮评审回填（无结构变更，内容面）：① **wave 的注入点改到 `Lifecycle#hopOf`**——同一条 `#hopOf` 服务两个调用点：`advance`（`:447`，`#bookkeep` 已在 `:429-430` 重绑 brief ⇒ 死）与 `peekNext`（`:399-408`，帧未重绑 ⇒ 活，今日 frontier 渲 `task-open` 就是这处活缺口），故注入而非禁止；§4 / §6 (i)(ii) / §7 注入点行 / Acceptance / §8 / Constraints 同步；胶囊帧仍在重绑之后、drift 恒假，故不承诺其渲 `doc-drift`（不可达，非漏做）② §7 落点表加第九行 `session/next.ts` 的 `NextHopInput` 新 cell `briefDrift?: boolean`（`:208-226`，`nextLineOpen` 旁），标题「八行」改「九行」，行内措辞改为「新增 cell」③ §6 (ii) 由「回归 pin，不是新增断言」改为本相位的新增量（必红 → 绿）：两面今日一致地 `task-open`、改动后一致地 `doc-drift`，一致性仍为回归 pin ④ 陈旧散文进 §7 pin 清单第 5 类（断言字节零变）：`next:` 不再是末行，`face/__tests__/face.test.ts:8` · `face/capsule.ts:19` · `:67` · `session/run.ts:262` 四处注释与四处「trailing `next:`」措辞同笔改写 ⑤ `#reasonOf` 优先级表述精确化：drift 的 wave fix 待办面已被 `waveLineRoute`（`:983`）改写成 review，故得 `doc-drift`；`pending-fix` 只落未 drift 的 `fix` 路由 | [human] · Claude（kairos:cdd-design [P24] 第五轮评审回填 · 2026-11-04） |
| v0.7 | 2026-11-04 | 第六轮评审回填（无结构变更，内容面）：① §7 落点表加第十行 `face/preview.ts`——dry-run 预览的 `#recordsOf`（`:152-162`）持有写回判别式的第二份活副本，本相位把 `fix` 加进白名单后它会漏报 `reviewedRevision(doc)` / `reviewedRevision(brief)`；判别式与 `#bookkeep` 同源（共用同一判定，或由一条 fix 轮用例钉死副本），`:147-151` 的 docstring 与 `preview.test.ts:126-146` 的陈旧 `branch-review` pin（自 P21 `#recordReviewedBranchRevision` 起即错）同笔修正；标题「九行」改「十行」② §7 第 5 类范围由「声称 `next:` 为末行」扩为「凡声称 `next:` / `reason:` 行形状（末行 · 唯一站锚 · 唯一站词）」，并把 `face/__tests__/face.test.ts:101` 登记入册 ③ wave 注入点措辞更正——`BoardNext#hopOf` **没有** wave 分支，§4 / §6 (ii) / §7 三处改为「在既有 `nextHopOf` 入参对象 `:852` 里加一格」，明写禁止为 wave 另开第二次调用，并补板面 wave key 即 `target.id`（`waveKey ?? ""` `:725`）、空 key 经 `reviewedRevisionOf` 退化 `false` | [human] · Claude（kairos:cdd-design [P24] 第六轮评审回填 · 2026-11-04） |
| v0.8 | 2026-11-04 | plan 评审回填（`backfill-design` · 无结构变更，内容面两处订正）：① **`briefDrift` 的家改对了**——原写 `NextHopInput`（`session/next.ts:208-226`）是错的：`nextHopOf` 自己构造 `NextHopInput` 并填 `gate.drift`（`:1248-1254`），写在 router 的输入面等于加一个没人读的字段；改为 `Ledger#nextHopOf` 的内联参数类型（`:1219-1230`），§7 的「reason 输入面」行随之改指 `session/ledger.ts`。② **wave 面不做路由替换**——原写「wave 面的替换范围不受 `onExitSide` 限制」会劫持 soft-capped wave 的 `handoff` 路由（`waveLineRoute` 落 `return null` → `#exitRoute`）；改为 cell 只喂 `gate.drift`，替换谓词一字不动，wave 的路由仍由 `waveLineRoute` / `#pipeline` 给出。两处均由 plan 第 2 轮评审实测指出 | §4 wave 面 + §7（判据行 · 输入面行）+ Change history v0.8 | Oscaner M. · Claude（kairos:cdd-plan · backfill-design · 2026-11-04） |
| v0.9 | 2026-11-04 | plan 第 2 轮评审回填（`backfill-design` · 无结构变更，内容面三处订正）：① **半途被砍的 fix 的 frontier 面写对了**——BLOCKED 的 fix 之后 `lineRoute` 仍是 `{ kind: "fix" }`（非 exit 侧），故 `docReopens` 为假、`linePhase` 回 `fix`，frontier 给的是该 fix 的重试面而不是 review（§5.5 ②：drift 不压 pending fix）；§2 / §6 第 3 条 / Acceptance 同步改写，负控改为直读账本 `doc_hash` 未推进 + `peekNext()` 帧为 `fix` ② **板面注入加闸**——`briefDrift` 只在 `target?.type === "wave" && facts.report.wave.active !== null` 时取值：soft-capped / carried 轮不可读时 wave 的路由是 `#exitRoute` 的 `handoff`（exit 侧）且未闭合，故板面会把该 wave 当 frontier，不设闸则待用户裁定被翻成 review、与 `waveLinePhase` 为 null 的门分叉；§4 wave 面与 §7 注入点行同步，并要求一条负控 ③ **陈旧散文 9→11 处**——补 `face/capsule.ts:100`（「line LAST … the output's close」）与 `face/__tests__/capsule.test.ts:467` 的 describe 标题，扫描词面扩为末行 / `LAST` / `close` / `last line` / `trailing` / 唯一站锚 / 唯一站词 （落点：§2 · §4 wave 面 · §6 第 3 条 · §7 第 5 类与注入点行 · Acceptance） | Oscaner M. · Claude（kairos:cdd-plan · 2026-11-04） |
| v0.10 | 2026-11-04 | 编排器裁定（把 v0.9 里并存的两套说法收敛成一套）：**wave 面从不做路由替换**——删掉「wave 面不受 exit-side 限制」那句（它与 v0.8 的「不做替换」直接矛盾），同时删掉 v0.9 在板面注入处加的 `facts.report.wave.active !== null` 闸（它防的正是替换；不替换就不需要防，且只加在板面一侧会让两处注入不对称）。收敛后的口径：cell 只喂 `gate.drift`，替换谓词 `drift && onExitSide(route)` 对 wave 不适用 | §4 wave 面 · Change history v0.10 | Oscaner M. · Claude（kairos:cdd-plan · 裁定回填 · 2026-11-04） |
| v0.11 | 2026-11-04 | **设计订正（本轮 blocker）**：v0.10 说「cell 只喂 `gate.drift`、替换谓词一字不动」在代码上不成立——`nextHopOf` 里的 `drift` 一个值同时驱动替换与原因，故 wave 的 exit 侧路由仍会被替换。订正为**两个值分开**：替换驱动 `drift` 仍只取 doc 面 `reviewGate`（wave 恒 false，谓词不触发）；原因 cell 取 `drift || briefDrift`。**§4「wave 面」当轮同步，§7 判据行未同步**——它的行与本条之前（同步前的单值口径）字节相同，由 v0.14 补上 | §4 wave 面 | Oscaner M. · Claude（kairos:cdd-plan · 裁定回填 · 2026-11-04） |
| v0.12 | 2026-11-04 | plan 第 4 轮评审回填（内容面一行）：§7「语义注释」行补两处——`nextHopOf` 的 docstring（`:1205-1218`）改为两值口径、`run.ts:689-693` 入同步列；理由：本相位在同一个装配里引入两个 drift 量，注释仍教「gate 的 drift 就是重开」即新的陈旧契约 | §7 语义注释行 + Change history v0.12 | Oscaner M. · Claude（kairos:cdd-plan · backfill-design · 2026-11-04） |
| v0.13 | 2026-11-04 | **范围追加（用户裁定并入 P24）**：新增 §9「板面 frontier 的选面读 drift」——`pipelineFacts` 的 spec/plan 两面用只读 C5 的 `lineClosed`，branch 面用的却是 drift-aware 的 `lineStateAt`；实案即本相位自身（spec 收口后裁定回填 5 次，门要求重审、板面却印 `implement`）。修法：两面 `closed` 改用既有的 `lineStateAt`（不新增判定）；§7 加「板面选面」行；Acceptance 加一条必红断言 + 孪生回归 | §9 + §7 板面选面行 + Acceptance + Change history v0.13 | Oscaner M. · Claude（kairos:cdd-plan · 范围追加 · 2026-11-04） |
| v0.14 | 2026-11-04 | spec 第 7 轮评审回填（无结构变更，内容面四条）：① §7「reason 判据（wave）」行由单值口径改为**两值口径**——替换驱动 `drift` 仍只取 doc 面 `reviewGate`（`:1230-1233` 形状保留 ⇒ `:1242-1243` 对 wave 不触发），原因 cell `gate.drift` 取 `drift \| (briefDrift ?? false)`（`:1248-1254`），与 §4 逐字对齐；v0.11 声称的 §7 同步当轮并未发生，其条目同笔订正 ② §5 补第三块消费面：`docs/diagrams/src/` 四份源（`next-loop.{en,zh-CN}.json:278` · `journey.{en,zh-CN}.json:573`）同笔改写 + 用 Archify finalize 重生成四份 HTML（禁手改）+ `diagrams.guard` / `next-loop-twin` 的边界说明，落点归 plan Task 4 ③ §7 第 5 类补三处文件自述：`face/capsule.ts:2` · `face/capsule.ts:7-10`（示意图补 `reason:` 行）· `face/words.ts:7-8`（两个路由站锚、五行站表）④ §7「语义注释」行补 `NextHopInput.gate` 的 docstring（`session/next.ts:211-213`），并把「reason 输入面」行的「一行不动」收窄为「形状一行不动」——两行原先对这同三行指向相反 | §5 + §7（语义注释 · reason 判据 · reason 输入面 · 第 5 类）+ Change history | Oscaner M. · Claude（kairos:cdd-plan · spec 第 7 轮评审回填 · 2026-11-04） |
| v0.15 | 2026-11-04 | 实现轮修复（内容面，任务 1,2 第 1 轮 fix）：① §4「两面同字节」与 §7「reason 渲染」「板面」两行按实际代码校正面——`renderReason(hop: NextHop)` 取非 null 入参、只服务胶囊（其值自带站表前缀），板面 `reasonLine(hop)` 直取 `hop.reason`，hop 的缺席由调用方一次把门（`renderHop` 只对 null hop 返回 null），删除「`reasonLine(hop, renderer)` 值取 `renderer.renderReason(hop)`」与「`null` hop 返回 `null`」两句——前者与代码不符，后者是 `renderReason` 内部永不可达的 null 分支；② 由此登记 `reasonLine` 无不可达 `(none)` 退化分支这条事实 | §4 + §7（reason 渲染 · 板面）+ Change history | Oscaner M. · Claude（kairos:cdd-dev [P24] 第 1 轮 fix · 2026-11-04） |
| v0.16 | 2026-11-04 | **W3 评审回填（消除一处过度承诺）**：§5 的 diagram 段补一段边界——`diagrams.guard` 只覆盖 `architecture.*`、`next-loop` / `journey` 无 HTML 腿，故本相位对这四份产物的保证只是「本轮重生成 + 一次性校验」，**不**声明常驻孪生门；该门缺失作为已知限制登记（W3 评审实测：曾有一份 HTML 读作「最后一一行」而全部门绿） | §5 diagram 段 + Change history v0.16 | Oscaner M. · Claude（kairos:cdd-dev · W3 裁定回填 · 2026-11-04） |
| v0.17 | 2026-11-04 | **范围追加（用户裁定 · 第三次并入 P24）**：新增 §10「pipeline frontier 归 session 平面（板面即投影）」——板面自持三份判定（逐面 `closed`/`active` · `#waveFrontierKey` · `#pipeline` 四条面序）是第二套逻辑；§9 只换了一个单元格，实案随即显形（spec drift 时板面印 spec review、波形自印 wave review，两条都可执行）。定案：新增 `session/pipeline.ts` 的 `PipelineFrontier` 承担选面，板面只渲染；§9 的「板面选面」落点行作废；必红验收为「板面 `next:` == frontier 线的 `peekNext()`」parity + 零字节回归；不含越序拒绝 | §10 + §7 frontier 归属行 + Acceptance + Change history v0.17 | Oscaner M. · Claude（kairos:cdd-dev · 范围追加 · 2026-11-04） |
| v0.18 | 2026-11-04 | **spec 第 8 轮评审回填（内容面三条 + 一行残留清理）**：① §5「生成物不手改」不再断言 `diagrams.guard` 能抓这四份产物——该 guard 的源→HTML 腿只覆盖 `architecture.{en,zh-CN}`，与本段上文「不声明常驻门」对齐：只留「禁手改 HTML」这条纪律，并指回上文说清一致性由人负责；§5 末句的 Task 4 验收要点同步由「跑绿」改为**一次性新鲜度校验（guard 只覆盖 `architecture.*`）** ② §7 源码落点表头「十行」改为**十一行**并按现表重算分解（七处既有面 + frontier 归属这一行新增面 + 一处判据收窄 + 一行输入面 + 一行注入点），同笔删去 v0.17 残留的第二份「板面选面」活行（该面已由 v0.17 整体搬迁取代，表内上方已有一份带删除线的墓石）③ Change history 的 v0.16 行落点列「v0.15」订正为「v0.16」 | §5 diagram 段 + §7 源码落点 + Change history | Oscaner M. · Claude（kairos:cdd-dev · spec-fix（docs-fix）· 2026-11-04） |
| v0.19 | 2026-11-04 | **分支终审回填（撤回一条假必红）**：§10 的证据段与 Acceptance 原写「parity 今日必红」，而实测（`c2626b68`）该 parity 在 §9 落地后**已成立**（(h)/(h2) 早已钉住）；用户观察到的分叉是两条不同线的 next，不是 parity 违约。改为纯重构的三条证据（行为零变 / 结构断言 / 新家用例），并明写不得再声称必红 | §10 证据段 + Acceptance + Change history v0.19 | Oscaner M. · Claude（kairos:cdd-dev · 分支终审回填 · 2026-11-04） |
| v0.20 | 2026-11-04 | **spec 第 9 轮回填**：① 撤回假必红时引错了两条 pin——(h) 的 spec 从未被审过（无 drift）、(h2) 漂的是 plan 且钉的是 branch 线；改为如实：该状态是 round-6 评审的**一次实测事实、无既有 pin 覆盖**，本相位不为它新增 pin ② Acceptance 的三条证据去重（v0.19 合并时 v0.17 的复述未删） | §10 证据段 + Acceptance + Change history v0.20 | Oscaner M. · Claude（kairos:cdd-dev · spec 回填 · 2026-11-04） |
| v0.21 | 2026-11-04 | **范围追加（用户裁定 · 第四次并入）**：新增 §11「每轮的下一跳也读 pipeline frontier」——§10 只统一了「哪条线在下」的判定，每轮胶囊仍喂本线 C5 路由，于是同一时刻两条 next 可不同（实测：spec 自身 `cdd-plan` vs 板面 `cdd-close`）。定案：胶囊改喂 `PipelineFrontier.next(...)`，`cli.ts` 补 `specType`/`specPath`；必红断言为「波形轮完而 spec 未闭时，胶囊 `next:` == 板面 `next:`」；重锚逐条在册；不含越序拒绝 | §11 + §7 渲染源统一行 + Acceptance + Change history v0.21 | Oscaner M. · Claude（kairos:cdd-dev · 范围追加 · 2026-11-04） |
| v0.22 | 2026-11-04 | **spec 第 10 轮回填（blocker）**：① **§11 的定案改深了一层**——胶囊要渲染的不是 route 而是板面那个 `NextHop`；只换 route 会让 cell 仍取自本轮 frame（`type`/`key`/`doc`/`briefDrift`），与 frontier 的 target 打架。改为：把 `BoardNext#hopOf` 的 cell 装配与 `PipelineFrontier` 一起收进 session 平面，两面调同一装配 ② 四格输入由 `cli.ts` 的场景从文档索引填（doc 轮是 `EMPTY_RUN_STATE`、`--spec` 轮 `#planPath` 为 null，生命周期本就不够） ③ Acceptance 的「`next:` 字节逐字节相同」收窄为「非胶囊读者」——胶囊侧另立重锚清单 ④ 删掉不存在的 `SessionRun` 类名 | §11 + §7 渲染源统一行 + §3 注释 + Acceptance + Change history v0.22 | Oscaner M. · Claude（kairos:cdd-dev · spec 回填 · 2026-11-04） |
| v0.23 | 2026-11-04 | **spec 第 10 轮 W3 回填**：三处关于胶囊的旧陈述随 §11 更新——① doc/branch 收口轮的断言面按「带 plan 的 slug vs 裸 doc slug」显式分写 ② wave 面的「胶囊不保证与 frontier 同值」作废（§11 之后同值）③ 「胶囊在 wave 面不在断言面内」改为同属断言面 | Acceptance + Change history v0.23 | Oscaner M. · Claude（kairos:cdd-dev · spec 回填 · 2026-11-04） |
| v0.24 | 2026-11-04 | **spec 第 10 轮 fix 回填（W3 残留）**：v0.23 只改了 Acceptance 的三处，`§4`/`§6`/`§8`/`Constraints` 仍留着「胶囊在 wave 面 drift 恒为假（不可达）」这套说法，与 §11「胶囊渲 frontier 的同一 `NextHop`」直接矛盾——四处同笔改为「胶囊渲 frontier 的 hop，故 `reason:` 与 frontier / 板面同值」，并把取证边界收窄为「`briefDrift` 注入只在 `peekNext` 与板面两条路径上可观察」；`§6` 第 1 条的 doc 线断言面随之按「裸 doc slug vs 带 plan 的 slug」分写，不再笼统说「两面此面皆 drift-aware」 | §4 wave 面 · §6 第 1 条（doc 线与 wave (ii)）· §8 · Constraints + Change history v0.24 | Oscaner M. · Claude（kairos:cdd-dev · spec docs-fix 第 10 轮 · 2026-11-04） |
| v0.25 | 2026-11-04 | **spec 第 11 轮回填**：① **术语消歧**——`pipeline frontier`（胶囊+板面共用）与 `line frontier`（`peekNext`，单线）不是同一个东西；「胶囊与板面同一对象」成立、「胶囊与 `peekNext` 同一」不成立，parity 只打 board ⇄ capsule ② 收口轮胶囊印的是 **frontier 面的 active hop**（spec 收口而 plan 未起步 ⇒ `review --type plan`），只有裸 doc slug 才是本线 exit ③ `planGraph` 的来路改为「板面的受守卫读 + 装配层注入」，不是索引单元格 ④ §7 表头 11→12 行 | §11 术语段 + Acceptance doc 线 + §11 输入来源 + §7 表头 + Change history v0.25 | Oscaner M. · Claude（kairos:cdd-dev · spec 回填 · 2026-11-04） |
| v0.26 | 2026-11-05 | **spec 第 11 轮 fix 回填（docs-fix）**：v0.25 落了裁定的一半，本条补齐残差——① §6 第 1 条与 Acceptance 的 doc 线不再写「`next:` 为 `done` / `handoff` / `next-wave`，不是 `review`」（在带 plan 的 slug 上是直言为假），改为断言**该线自身闭合**（`lineRoute(type, type)` 为 `null` · 或 `peekNext()` 为 `null` · 或该记录轮路由在 exit 侧），并明写收口轮印的是**下一面的 active hop**：`review --type plan --plan …`（`board-view.test.ts:316`）与 `review --type branch --plan …`（`:1497`）是别的面的 lead，不是本线重开 ② 五处混称「frontier」的句子（§4 wave 面 · §6 (ii) · §8 · Acceptance wave · Constraints）改为分开说：胶囊与板面共用 **pipeline frontier**（`PipelineFrontier.next(...)`），`peekNext` 是 **line frontier**（frame-keyed 装配），被跳过的 parity 断言是 capsule ⇄ `peekNext`，板面的那条（§10）才存在；wave 面上 capsule ⇄ `peekNext` 同值是夹具级期望 ③ §7 表头「十一行」改**十二行**并补「一行渲染源统一」的分解 ④ `planGraph` 的来路在 §11 与 §7「渲染源统一」行同时说准：三格来自文档索引、第四格来自既有受守卫读，并写明装配搬走后该读的家（`face` 侧 seam 交装配层，或组合根注入；frontier 仍不读文件） | §4 wave 面 · §6 第 1 条与 (ii) · §7 表头与渲染源统一行 · §8 · §11 输入来源 · Acceptance doc 线与 wave · Constraints + Change history v0.26 | Oscaner M. · Claude（kairos:cdd-dev · spec docs-fix 第 11 轮 · 2026-11-05） |
| v0.27 | 2026-11-05 | **范围追加（用户裁定 · 第五次并入）**：新增 §12「板面汇总单元按成功总量 + 失败尝试重排」——现按判决连续段切分并段内重计数，于是 `fix 11 ✓ · fix 1 ✗ · fix 2 ✓` 既看不出失败在第 12 轮、也丢掉了那次重派。定案：成功按 verb 合并为一个令牌、失败逐条带 cycle；在 P22 §5.3 的两条既有门之内落地（区间形不出现 · `a1` 不出现）；无失败的行字节零变 | §12 + §7 汇总单元行 + Acceptance + Change history v0.27 | Oscaner M. · Claude（kairos:cdd-dev · 范围追加 · 2026-11-04） |
| v0.28 | 2026-11-05 | **spec 第 12 轮回填（重设 §12）**：① 原「成功数 + cycle」把两个量塞进同一槽位（`fix 3 ✓ · fix 3 ✗` 读着自相矛盾），改为「成功用 `{成功}/{尝试}` 比率（仅在存在失败时出现）+ 失败令牌带 `✗→✓` 恢复标记」 ② **显式列出对 P22 §5.3 的三条修订**（逐轮展开限定于异常面 · 令牌形增比率与 cycle · 旧示例字面作废），不再声称『在门内』 ③ 缺口改引真实行输出 ④ 落空面收窄为 `summaryCell`/`#summaryToken` 两处 docstring ⑤ changeset 须改写（现有『board output is unchanged』作废） ⑥ §7 表头 13 行 ⑦ 证据每条带 pin | §12 + §7 汇总单元行/表头 + Acceptance + Change history v0.28 | Oscaner M. · Claude（kairos:cdd-dev · spec 回填 · 2026-11-05） |
| v0.29 | 2026-11-05 | **spec 第 12 轮 fix 回填（docs-fix）**：① **W1**——§7「发行」与 Acceptance 的 changeset 末条补 §12：板面汇总单元在有失败尝试的行上改字节是**消费面可见变化**，并入同一份 `.changeset/p24-fix-identity-and-reason-row.md`（仍 minor、不另开第二条），该条目末句「`cdd board` output is unchanged」须改写（Task 8 owner） ② **N1**——§7 表头分项补「一行汇总单元（§12）」，7+1+1+1+1+1+1 = 十三行（此前十三行却只列 12 项） ③ **W2 尾项**——§12 写明 ✗ 令牌逐条不设上限、实际由 `REVIEW_CYCLE_CAP` 封顶 ④ **N2 尾项**——§12 证据第 5 条：`:1274` 的重锚在 §7 的 1–5 类 `next:` 账之外，按账外修复在册 ⑤ **N3**——Change history v0.27 行日期 2026-11-04 → 2026-11-05（不再早于 v0.26 与 front-matter） | §7 表头/发行 + Acceptance 末条 + §12 定案/证据 + Change history | Oscaner M. · Claude（kairos:cdd-dev [P24] spec 第 12 轮 fix · 2026-11-05） |
| v0.30 | 2026-11-05 | **spec 自查订正（plan 第 14 轮 W3）**：成功令牌原本「永远带末条成功记录的 attempt 后缀」，与本相位自己钉的目标 `fix 1/2 ✓`（末条成功是 a2 ⇒ 会渲成 `1/2a2`）矛盾。订正为**后缀与分母互斥**：有失败时渲比率且不带后缀，无失败时才可能带后缀。 | §12 成功令牌一句 + Change history v0.30 | Oscaner M. · Claude（kairos:cdd-dev · spec 自查订正 · 2026-11-05） |
| v0.31 | 2026-11-05 | **spec 第 13 轮回填**：① 成功令牌在**成功数为 0** 时不渲（否则纯失败 verb 会渲 `review 0/1 ✓`，与既有 `review 1 ✗` pin 冲突） ② 删掉「✗ 条数由 `REVIEW_CYCLE_CAP` 封顶」这条**假依据**（它界 blocker 循环、不界同 cycle 的 attempt 重派；✗ 数理论上无界，本相位不加界） ③ 补**令牌顺序**（外层 `VERB_ORDER`、内层先成功后失败、失败按时间序、不聚到行尾） ④ 恢复形 `✗→✓` 也带 `+N`，并点明「同 cycle 的后续 attempt」 ⑤ 陈旧散文登记（`:1268` 用例标题 · `#judgementRuns` docstring） | §12 五处 + Change history v0.31 | Oscaner M. · Claude（kairos:cdd-dev · spec 回填 · 2026-11-05） |
| v0.32 | 2026-11-05 | **spec 第 13 轮 fix 回填（docs-fix）**：v0.31 已落五条的正文，本笔补齐三处**落尾**：① **W1 尾**——§12 表把「干净行」拆为**无失败行**与**纯失败行**并各给目标字节（纯失败行成功数为 0 ⇒ 不渲 ✓ 令牌），证据 3 改标题为「无失败行与纯失败行零变」并点名 `:1228`/`:1246` 的 `review 1 ✗` 与 `cli.test.ts:7356-7357` 的 `implement 1 ✗` 正是纯失败行、另加一条独立用例；Acceptance 同笔补该条 ② **W3 尾**——表再补一行**两 verb 顺序样例** `review 3/4 ✓ · review 3 ✗→✓ · fix 3 ✓`，Acceptance 把**令牌顺序**列为钉死项 ③ **N2 尾**——陈旧散文登记与 §7 汇总单元行写准 `#judgementRuns` 的去向（**保留**、不删不改名，docstring 同笔改写并改指 P24 §12），落空面的「两处 docstring」随之修为三处 | §12 表/证据 3/陈旧散文/落空面 + §7 汇总单元行 + Acceptance §12 + Change history v0.32 | Oscaner M. · Claude（kairos:cdd-dev [P24] spec 第 13 轮 fix · 2026-11-05） |
