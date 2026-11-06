---
title: 引擎文档工具（Engine Doc-Tooling）— P27 设计：派发权威收口（`next:` 由建议升为裁决）
doc-type: phase-spec
version: v0.1
date: 2026-11-06
slug: 2026-10-10-engine-doc-tooling-p27
program: 2026-10-10-engine-doc-tooling
parent-version: v3.28
author: '[human] 裁定 · Claude（本会话 · 2026-11-06）'
---

## Design

本相位把「谁能派」从一个散在三处的判断收成**一个裁决对象**，并让 `next:` 从渲染物升为裁决物。

起因是一件可复现的事：P26 的 T1 把 `doc-revision` 换成只算正文之后，spec 与 plan 两行各触发一次 `doc-drift`，引擎的 `next:` 指向复评——而 `implement --tasks …` 照派不误。查下去发现两个事实：派发面根本没有「上游」这一维；而且**站牌对象自己也没有派发读者**。

### 1. 病根

#### 1.1 十三处判断，三个「谁能派」的权威

| 类 | 守卫 | 住哪 | 谁调 |
| --- | --- | --- | --- |
| 结构（环境） | tree-clean · in-flight · graph · plan-ledger · doc-contract（24 条规则） | `session/preflight.ts` 六道有序门 | 所有 work 命令 |
| 本行相位 · wave | `WaveGate.vet`：`mixed-batch` · `wave-too-wide` · `too-many-tasks` · `split` · `wrong-phase`（`session/wave.ts:44`） | `session/wave.ts:86`，**从 `preflight.ts:299` 调** | wave 面 |
| 本行相位 · doc/branch | `lineGate`：drift 重开 · pending-fix · same-revision 拒 · face-closed（`face/gate.ts:71`） | `face/gate.ts`，**从 `face/cli.ts:764` 调** | doc / branch 面 |
| 行事实 | `reviewGate`（`:934`）· `docReopens`（`:1311`）· `briefDrifted`（`:1023`）· `waveLineRoute`（`:964`）· `linePhase`（`:1209`）· `lineRoute`（`:1187`） | `session/ledger.ts` | 经上面两处 |
| 帧前沿 | `peekNext` / `#openLineFrame` / `#nextWavePhase` | `session/run.ts` | 派发循环 |
| 站牌 | `PipelineFrontier#hopOf`（`session/pipeline.ts:132`）→ `NextHop` | `session/pipeline.ts` · `session/next.ts` | **只有 board（`face/board-view.ts:867`）与 capsule（`run.ts:915`）** |

#### 1.2 三处让它散的原因

1. **同一问题两个调用点**：wave 的相位权威住在 preflight 的行里（`preflight.ts:299`），doc/branch 的住在 CLI 里（`cli.ts:764`）。顺序语义因此隐含在两处——结构门先于 doc-contract，而 `lineGate` 在 preflight 之后才跑。
2. **两套拒绝词表**：`WaveGateReason`（5 个，纯拒绝，`wave.ts:44`）与 `NEXT_HOP_REASON`（7 个，含 `doc-drift` / `pending-fix` 这类「该走哪」，`next.ts:164`）。语义相邻却不共享一张表，报文家族随之分裂（WaveGate 词表 · `lineHopMessage`（`gate.ts:164`）· board 行）。
3. **站牌没有派发读者**：`NextHop` 已经是「一个对象、多读面」（D40），但那些读面里**没有派发门**——所以它是建议。

#### 1.3 实证

P26 的 T1 落地后：spec 行 `next: review --type phase-spec`、plan 行 `next: review --type plan`，而 `implement --tasks 4` 照常派发。更要紧的是 **frontier 自己也看不见**：wave 还开着时，frontier 指向 wave 面（`#waveState`），`hopOf` 传给 drift 判定的 `doc` 是 `#docOf(target)`——wave target 给的是 **wave key**，不是 plan 路径。所以「必须照 `next:` 走」这种加门法连这一例都拦不住：那时 `next:` 本来写的就是 wave 的 hop。缺的是**上游**这一维。

### 2. 裁定：一个 `DispatchAuthority`

#### 2.1 verdict 形状

```
DispatchVerdict =
  | { allowed: true }
  | { allowed: false
      leg: "structure" | "upstream" | "line"
      reason: DispatchReason          // 合一张表的 token
      next: NextHop | null }          // leg structure 时为 null
```

`leg` 是分区字段，也是排错第一眼要读的东西；`next` 直接取 `PipelineFrontier#hopOf` 的输出（同一个对象，不新造形状）。

#### 2.2 优先级：结构 → 上游 → 本行（短路，一次只报一条）

先环境（tree / in-flight / base）与结构（graph / plan-ledger / doc-contract），再上游站牌，最后本行相位。理由：上游没复评完时，本行相位判了也不能派；报最上游的那条才可行动。

#### 2.3 上游腿：按面序派生

- **面序单一来源**：`PIPELINE_FACES`（`session/next.ts:127`）。请求面的索引 i，上游 = 面序前 i 项；不手写第二个顺序表。
- **身份面是槽位**：面序第一项 `phase-spec` 是**身份面**，行键取文档自己声明的 `doc-type`（`specType`）——`single-spec` 与 `phase-spec` 同属第 0 面、各自成行。P26 T3 已立的区分不动：`PipelineKey = TargetType`（`next.ts:90`）含 `single-spec`，`PhaseFaceKey`（`:121`）不含。**所以两种 spec 都被上游腿覆盖**，不需要额外一支。
- **每个上游面两条判据**：① reviewed identity 陈旧（`reviewGate(...).kind === "open"`，即 drift）⇒ 拒；② 该面还有开放 hop（`lineRoute` / `waveLineRoute` 非 null）⇒ 拒。两条都带出该面的 `next:`。
- **`overall` 不计入**：它不在 `PIPELINE_FACES` 里（章程不参与流水线），改一个字不挡派发。
- **陈旧即拒，不看 brief**：不按「drift 是否触及本波 brief」放行——P26 那次内容一字未改、只有口径变了，按 brief 判会被放行，等于本例仍不拦。

#### 2.4 leg L：五规则入表

`WaveGate` 的五条改写为 leg L 的规则表行，判据语义逐条保持（静态批次开闭混放 · 派生宽度上限 · 请求宽度上限 · 精确匹配 · 相位不符），只换宿主与输出通道。doc/branch 行的四条（drift 重开 → 允许；pending-fix 拒；same-revision 拒；face-closed 拒）同样入表，与 wave 五行同形：**一个 leg，一张规则表，一个 verdict**。

#### 2.5 reason 表：13 行 + `leg` 分区

| 分区 | 行 |
| --- | --- |
| `structure` | tree-clean · in-flight · graph · plan-ledger · doc-contract（沿用 gate id 作 token） |
| `line` | `mixed-batch` · `wave-too-wide` · `too-many-tasks` · `split` · `wrong-phase`（wave 五行搬家） |
| `line` | `pending-fix` · `unchanged`（新增：same-revision 的那条拒今天只有报文、没有 token）· `closed-line` / `face-closed` |
| 站牌（`next` 的理由） | `doc-drift` · `soft-cap` · `task-open` · `doc-class-blocked` |

合一张表、逐行带 `leg` 字段。**计数更正**：grilling 时按 wave 5 + 站牌 7 = 12 计，并入 doc/branch 四条时实际为 **13 个 token**（新增 `unchanged`）——结构门沿用既有 gate id，不新造 token。

#### 2.6 报文：`reason · next:` 一行

拒时统一一行：`reason · next: ` + 那条命令；`leg === "structure"`（无 `next`）时为 `reason · ` + 既有 message。三个读面同形：派发门的 stderr、capsule、board 的 `next:` 行。

#### 2.7 派发门成为 `NextHop` 的第五个读者

删掉两个平行调用点（`preflight.ts:299` 的 `WaveGate.vet` 调用、`cli.ts:764` 的 `lineGate` 调用），派发门改读 `DispatchAuthority.verdict`；其 `next` 字段就是 `PipelineFrontier#hopOf` 的输出，所以 board 与 capsule 的读者不变、形状不增（D40 的「一个对象多读面」补上派发面）。

### 3. 与 D30 的关系（澄清，不是让步）

D30 保的是「plan 里不涉及本波任务段的改动，不作废已审的 wave」——那是**身份**面：wave 行不因无关改动重开。本相位说的是**派发**面：上游没复评完，就不往下游投料。两者不矛盾：波内 `implement → review → fix` 循环照旧（wave 行身份不动），但**新一轮派发**要等上游复评。裁定 (a) 是对 D30 的正向补充，不是反转——D30 原文没区分这两层。

### 4. 与判收敛主线的关系（只收口「谁说了算」，不动「算不算收敛」）

**「这一轮算不算收敛」的主线逻辑一字不动**，仍是 `NextStepRouter` 那一条：review 的 `blocker > 0` ⇒ `fix`；只有 `warn` / `nit` ⇒ `fix` 且修完**不进** re-review；全 0 ⇒ 闭合 / 下一跳；fix 的请求含 blocker ⇒ `review`，不含 ⇒ 闭合；连续 `REVIEW_CYCLE_CAP`（`session/next.ts:65`，值 50）个 blocker 周期 ⇒ `soft-cap` 交用户裁定。店主是 `#close`（`:300`）与 `#blockerCount`（`:306`）。

本相位只动**「谁能派这一轮」**这一侧的裁决与词表，不动**「这一轮之后该哪一轮」**这一侧的推导。两者的接缝很窄，写清三条避免误伤：

1. **`Route` 的六种 kind 与派生顺序不变**（`next.ts:46` 起的 `done` · `next-wave` · `review` · `fix` · `soft-cap` · `handoff`）。
2. **reason 表合一只搬 token 与渲染，不改 `#close` / `#blockerCount` / `REVIEW_CYCLE_CAP`**：`soft-cap` 这一行照旧只在软上限成立时出现；`pending-fix` / `closed-line` 的判定条件也不因为换了表而变。
3. **原有的收敛 pin 全部零重锚**：`scripts/__tests__/next-loop-twin.test.ts`（三条陈述 + 周期数与常量对齐 + 运行时符号 `#blockerCount(` / `#close(` / `export const REVIEW_CYCLE_CAP`）与引擎侧 Loop-vs-converge 转移表逐行 pin 都必须**原样绿**——这是本相位「只管派发面」的证据。

一句话：本相位让 `next:` 变成必须遵守的裁决，但**不改变裁决内容怎么算出来的**。

### Acceptance criteria

- **红 pin（今日必红）**：plan 行 reviewed identity 陈旧时，`implement --tasks …` 被拒，`leg: "upstream"`、`reason: "doc-drift"`、报文点名 `review --type plan`。
- **绿 pin**：上游全新鲜 + 本行相位正确 ⇒ 派发照旧（零摩擦，既有 happy path 用例不重锚）。
- **权威只剩一处**：`WaveGate.vet` 与 `lineGate` 不再是两个面各自的调用点（源码 pin：两处调用的出现数为 0）；派发门、capsule、board 读同一个 verdict 对象（跨面 pin）。
- **reason 表 13 行 + `leg` 分区**，逐行 pin；报文形状 `reason · next:` 逐字 pin；结构拒无 `next`。
- **WaveGate 五行语义逐条等价**：`mixed-batch` / `wave-too-wide` / `too-many-tasks` / `split` / `wrong-phase` 各一条行为 pin（改写后仍红）。
- **每种面各一条上游红 pin**：spec 陈旧挡 plan review · plan 陈旧挡 wave 派发 · wave 未闭合挡 branch review；**身份面两种声明各一条**（`single-spec` 与 `phase-spec` 都能被上游腿判到）。
- **判收敛主线零变化**：`#close` / `#blockerCount` / `REVIEW_CYCLE_CAP` 的取值与派生顺序不动（源码 pin），Loop-vs-converge 转移表逐行 pin 与 `next-loop-twin` 的三条陈述 + 符号 pin **一行不改仍绿**；`soft-cap` 仍只在软上限成立时出现（一条行为 pin）。
- `pnpm run validate` exit 0；changeset `cdd-engine` **minor**（拒绝行为与报文可见变化）。

## Constraints

- **判据语义逐条不变**：wave 五行与 doc/branch 四条只换宿主与输出通道；任何行为差异都是缺陷。
- 不改 D30 的 brief 投影、不改 `PIPELINE_NEXT` 的交棒目标、不动 `PIPELINE_FACES` 的顺序与成员。
- `overall` 不进上游腿（章程不参与流水线）。
- 无新命令、无新旗标、无环境变量；不回流 `progress.json`、不加字段。
- 零模块级裸函数：`DispatchAuthority` 与规则表写成类/常量；静态面带 biome-ignore 与一行理由。
- 波宽 ≤ 3：本相位任务的 `DependsOn` 分层任一不超过 3。
- 门与报文只读既有事实：announce 上游陈旧时**不**顺手触发复评（派发门只拒，不动账本）。
- **判收敛主线不动（硬约束）**：`NextStepRouter#close`（`:300`）· `#blockerCount`（`:306`）· `REVIEW_CYCLE_CAP`（`:65`，值 50）· 软上限阈值与 `soft-cap` 的触发条件，一行不改；`Route` 六种 kind 与派生顺序不改；`scripts/__tests__/next-loop-twin.test.ts` 与引擎侧 Loop-vs-converge 转移表 pin **零重锚**。任何一条被改动，本相位即判缺陷。

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-11-06 | 初版（含作者追加的硬约束 §4：判收敛主线一字不动）：病根取证（十三处判断 · 三个权威 · 站牌无派发读者 · P26 实证）· 一个 `DispatchAuthority`（三腿 + 优先级）· 上游腿按面序派生（身份面含 `single-spec`）· 五规则入表 · reason 表 13 行分区（计数更正）· 报文统一 · 与 D30 的澄清 | [human] 裁定 · Claude（本会话 · 2026-11-06） |
