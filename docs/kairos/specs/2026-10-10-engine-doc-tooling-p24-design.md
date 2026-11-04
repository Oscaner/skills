---
title: 引擎文档工具（Engine Doc-Tooling）— P24 设计：NEXT-LOOP 收口面（drift 语义收窄 + hop 原因可读）
doc-type: phase-spec
version: v0.1
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

1. **C5 判定是对的**——`session/next.ts:282-287`：`case "fix"` 里 `#blockerCount(ref) > 0` 才回 `{kind:"review"}`，否则 `#close(state)`；注释自带 `#278` 的「a warn/nit-only fix closes」。
2. **基线只在 review 完成时写**——`session/run.ts:705-718` 的 T7 写回：`record.verdict.targetAction && (frame.phase === "review" || frame.phase === "branch-review")` 才绑定 `recordReviewedRevision`（doc 线取目标文档 revision · wave 线取重渲染 brief · branch 线取 plan 的 doc revision）。**fix 轮完成时不写**。
3. **drift 在收口侧才生效**——`Ledger#docLineVerdict` 拿「当前文档 revision」比「已记录的 reviewed revision」；`Ledger#docReopens` = `drift && onExitSide(lineRoute)`。零 blocker 的 fix 自己算出的 C5 路由正是 exit 侧（`done` / `handoff`），于是同一次调用里「fix 的产出」既触发了 drift，又满足了 drift 的生效条件。

结论：只要某一轮 review 还能挑出任意 warn/nit，循环就继续；闭包被压成「必须某轮 review 零 finding」这一条窄路。这与 C5 的书面语义**直接矛盾**，且 `fix` 面在文档线上**不可达**。

#### 1.2 原因 token 算而弃

`session/next.ts:165-173` 声明七个 token（`doc-drift` · `pending-fix` · `closed-line` · `face-closed` · `soft-cap` · `task-open` · `doc-class-blocked`）；`:392-404` 的 `reasonOf` 按固定序算出其中之一，挂进 `NextHop.reason`；而 `face/route-render.ts#renderHop` 只消费 `doc-class-blocked`。board-view 的测试甚至已经直接读 `peeked.hop.reason === "doc-drift"`——事实在对象里，**只是没走到输出**。

#### 1.3 三个面共享一条腿

`docReopens` / `recordReviewedRevision` 是**单点**：doc 线四型、wave brief（D30）、branch 线（P21 §4.1：身份文档即 plan）全部经它判定。因此「只修 doc 线」等于把最贵的 branch 面留债（P22 实案：分支 fix 改 plan 即自锁）。

### 2. 定案：基线随轮推进（判别机制）

**规则一句话**：**任一「完成」的轮收工写回时，把该行 reviewed identity 推进到该轮产出的 identity**——fix 是产出者，故不被自己的产出判为 drift；收口之后**轮外**（编排器 / 人）再改文档，仍按既有判据判 drift、仍重开 review lead。

**落点**：`session/run.ts:705-718` 的 T7 写回，phase 白名单由 `review | branch-review` 扩为 `review | branch-review | fix`。三分支（doc / wave / branch）原样复用，不新增写入点、不新增 ref kind。

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

**两面同字节**：胶囊（`face/capsule.ts:133-134`，轮的自身行）与板面（`face/board-view.ts:350-357` 的 `nextRow`，对齐 `  reason:  <token>`）都渲；共用 `RouteRenderer` 新增的 `renderReason(hop)`（`hop.reason` 直出，`null` hop 返回 `null`——BLOCKED/TIMEOUT 既无 `next:` 就无 `reason:`）。

**被否决**：A 在 `next:` 行尾追加 `— reason: x`（污染可执行字面）；D 加旗标（今日引擎无 `--verbose`，等于新增一整套旗标通道）。C（只渲非常规触发）作为备选，未采纳——一致性优先于少一行。

### 5. 定案：消费面（一句话）

根 `README.md:60` 现写「Each run ends with its `next:` line」，加行之后这句会陈旧 → 改为「ends with its `next:` line **and the reason line that follows it**」，`README.zh-CN.md` 镜像同步；引擎 README 无此承诺，不动；`README.md:88` 与 `packages/kairos/README.md:69`（「follow the engine's `next:` line」）仍成立，不动；**`SKILL.md` 零变更**（reason 是引擎对读者说的话，不是技能流程的一部分）。

### 6. 定案：证据（三条互锁 + 一次演示）

1. **实案复现（今日必红）**：构造 issue 的形态——review 产 1 warn、fix 修文档并完成、findings 的 blocker 计数为 0 ——断言收口（`next:` 为 `done` / `handoff` / `next-wave`，**非** `review`）。三个面各一条（plan · wave brief · branch）。
2. **防自旋负控**：收口之后由**编排器侧**改文档，断言 `next:` 仍回 review lead（drift 语义的另一半，非装饰）。
3. **半途负控**：改了文档但 `targetAction` 为假的 fix（BLOCKED），断言基线不推进、仍判 drift。
4. **验收演示**（不进测试集）：在 P24 自己的 plan 上真跑一轮 `cdd plan` review → fix → 收口，留下输出。

**测试落点**：写回与三面判定落在 `session/__tests__/run.test.ts`（写回面）；门与重开落在 `face/__tests__/cli.test.ts`（`lineGate` 的 drift 腿）；渲染落在 `face/__tests__/capsule.test.ts` 与 `face/__tests__/board-view.test.ts`（两面同值、`next:` 零变、`reason:` 新增）。

### 7. 落点、依赖与发行

**源码落点**（三处 + 一处新增方法）：

| 面 | 文件 | 落点 |
|---|---|---|
| 写回白名单 | `session/run.ts` | `:705-718` phase 白名单加 `fix`；`#recordReviewedDocRevision` / `#recordReviewedWaveBrief` / `#recordReviewedBranchRevision` 的文档注释同步语义 |
| 语义注释 | `session/ledger.ts` | `recordReviewedRevision`（`:793-798`）的注释改为「已入账 identity」 |
| reason 渲染 | `face/route-render.ts` | 新增 `renderReason(hop): string \| null`；`renderHop` 不动 |
| 胶囊 | `face/capsule.ts` | `:133-134` 之后追加 `reason:` 行 |
| 板面 | `face/board-view.ts` | `:350-357` 的 `nextRow` 旁增 `reasonRow` |

**依赖**：P23 已 Done（`P23 -> P24` hard，本相位不依赖 P23 的任何产物，只依赖其闭合后的树）。

**发行**：`@oscaner-skills/cdd-engine` **minor**（D74：消费面可见字节变化即 minor——新增 `reason:` 行、根 README 一句）；不涉 kairos 包，故不给 kairos changeset。

**pin 清单（零重锚）**：`next:` 断言分布于 11 个测试文件、152 处引用，形态全是按行抽取（`lines[1]!.slice("next: ".length)`）或 `toContain("next: …")`，**无一整块快照** → 既有断言零改动，`reason:` 断言并行新增。两处需盯：board 行布局多一行 `  reason:  `；`face/__tests__/preview.test.ts:295` 的 `not.toContain("next:")`（预览面既无 next 就无 reason，语义仍成立，断言不动）。

### 8. 非目标

- 不改 soft-cap 语义、不改 `REVIEW_CYCLE_CAP`。
- 不引入「改动来源」状态位，不为轮中途的带外编辑提供 provenance（已知边界见 Constraints）。
- 不改 `next:` 值的渲染、不改板面既有行序。
- 不为 `reason:` 提供机器可解析的稳定 schema（它是人读的一行；解析契约不承诺）。

### Acceptance criteria

- `review`（仅 warn/nit）→ `fix`（改文档、blocker 计数为 0）之后的下一次调用**收口**：`next:` 为 `done` / `handoff` / `next-wave`，不是 `review`；三个面（plan / wave brief / branch）各有一条测试，且该测试在改动前的树上**必红**（先证红，后转绿）。
- 收口之后由编排器侧改同一文档 → `next:` 仍回 review lead（drift 重开语义未失效），有测试。
- `targetAction` 为假的 fix（BLOCKED / TIMEOUT）不推进基线 → 仍判 drift，有测试。
- 每条 `next:` 行之后紧跟一行 `reason: <token>`，token 取 `NEXT_HOP_REASON` 七值之一；`next:` 行字节与今日**逐字节相同**（152 处既有断言零改动即证）。
- 胶囊与板面渲染同值；BLOCKED / TIMEOUT 轮两面都不渲 `reason:`。
- 根 `README.md` 与其 `.zh-CN.md` 镜像的「ends with its `next:` line」一句同步更新，`SKILL.md` 零变更。
- `env -u AI_AGENT pnpm run validate` 退出码 0；`pnpm run emit:check` fresh；changeset 为 `@oscaner-skills/cdd-engine` minor。

## Constraints

- **`next:` 可执行契约不可破**：它必须仍是「整行抄进 shell 就能跑」的字面；任何诊断信息只能落在**另一行**。
- **单点判据**：不得为某一面（如 branch）另开 drift 判定或另开写入点；三面必须经 `docReopens` + `recordReviewedRevision` 同一处。
- **只推进完成的轮**：`targetAction` 为假的轮一律不推进基线，这条不可为「简化」而放宽。
- **已知边界**：轮次进行中由编排器带外改文档（已违反「派发期间不动树」纪律）会被 fix 的写回一并入账——本相位不建 provenance 去区分；该场景记为已知限制。
- **零状态迁移**：不改 `progress.json` 的任何键名或键集。
- **消费面纯净**：`SKILL.md` 与技能 `docs/` 零变更；根 README 只改那一句（英 + 中镜像同笔）。

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-11-04 | 初稿：P24 NEXT-LOOP 收口面——基线随轮推进（写回白名单加 `fix` · 只推进完成的轮 · 三面单点）· reason 独立行（七类无条件 · 胶囊与板面同字节 · `next:` 字节零变）· 字段语义只改注释不迁移 · 根 README 一句 · 证据三条互锁 + 演示 · 零重锚 | Oscaner M. · Claude（kairos:cdd-design [P24] grilling → 本会话落 spec · 2026-11-04） |