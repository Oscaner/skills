---
title: 引擎文档工具（Engine Doc-Tooling）— P25 设计：写回判定的单源（`#bookkeep` ⇄ `#recordsOf`）
doc-type: phase-spec
version: v0.2
date: 2026-11-05
slug: 2026-10-10-engine-doc-tooling-p25
program: 2026-10-10-engine-doc-tooling
author: "[human] · Claude（kairos:cdd-design [P25] grilling → 本会话落 spec · 2026-11-05）"
---

## Design

本相位治一处**同族残余**：「哪些轮会写 reviewed identity、写到哪条腿」这件事在引擎里有**两份实现**。真实记账 `session/run.ts#bookkeep`（`:746-748` 的 phase 白名单 + `:749-752` 的 target kind 三分支）与 dry-run 预览 `face/preview.ts#recordsOf`（`:159` 的同一份 phase 字面量 + `:172-178` 的 `#reviewedLegOf`）各存一份。

**一句话的病根**：这是 P24 治过的「第二套逻辑」在**预览面**的残余。P24 收掉了板面的 frontier、收掉了胶囊的 hop 装配，但没有收这一份——因为它比前两个更隐蔽：两处**物理上无法共用同一条判定**（`#bookkeep` 还乘了 `record.verdict.targetAction`，dry run 手里没有 verdict），于是「各自写一份」看起来像是不得已。

**它今天造成的实际风险**：P24 把 `fix` 加进白名单时必须同时改两处；漏一处，预览就少报一条本相位引入的写，**而没有任何门会红**。`face/__tests__/preview.test.ts:148-164` 的 fix 轮用例只是**行为 pin**（钉预览侧当前输出），不是漂移探针——两处今后不同步改动，它不会红。

**边界（本相位不越的线）**：不改 `#bookkeep` 的记账内容与顺序 · 不改预览的 `render` 面与行序 · 不改 `targetAction` 的语义 · 不引入第二套 kind → 腿映射 · 不动任何 `next:` / `reason:` 字节 · 不改 `Ledger` 的 `recordReviewedRevision` 签名。

### 1. 缺口（取证）

#### 1.1 两份实现，逐字对照

| | 真实记账（`session/run.ts`） | dry-run 预览（`face/preview.ts`） |
|---|---|---|
| phase 白名单 | `:746-748`：`record.verdict.targetAction && (frame.phase === "review" \|\| frame.phase === "branch-review" \|\| frame.phase === "fix")` | `:159`：`if (frame.phase === "review" \|\| frame.phase === "branch-review" \|\| frame.phase === "fix")` |
| kind → 腿 | `:749-752`：`plan`/`spec` → `#recordReviewedDocRevision`；`wave` → `#recordReviewedWaveBrief`；`branch` → `#recordReviewedBranchRevision` | `:172-178` `#reviewedLegOf`：`wave` → `"reviewedRevision(brief)"`；`plan`/`spec` → `"reviewedRevision(doc)"`；`branch` → 有 plan path 才 `"reviewedRevision(doc)"`，否则 `null` |

两处对**同一组事实**各写一遍，且**顺序还不一样**（记账侧 doc 分支写在 wave 之前，预览侧 wave 写在 doc 之前）——这正是复制会漂移的典型征兆。

#### 1.2 为什么「无法共用」是个错觉

看起来不可共用的是**verdict**，不是判定本身。判定实际是两个正交问题：

1. **这一轮的 phase 允不允许写**——纯函数，只看 `op`（或 `phase`）；
2. **这个 target kind 写到哪条腿**——纯函数，只看 `kind`（`branch` 另需 plan path 这一**输入**，不是判定）。

`targetAction` 是**运行时结果**，它守的是「这一轮算不算完成」，与「写哪条腿」正交。把它塞进判定只会让签名撒谎（dry run 必须传一个恒 `true` 的假值）。

### 2. 定案：判定的形状与家

**形状**（grilling Q1 裁定）：返回值是**腿类型**而非布尔——

```ts
type ReviewedLeg = "doc" | "brief";
class ReviewedIdentity {
  static legOf(phase: string, kind: TargetType): ReviewedLeg | null;
}
```

`null` = 这一轮 / 这个 target 不写。返回腿类型一次性覆盖「写不写」与「写哪条」两问；若返回 `boolean`，调用方还得各自再判一次腿，等于把刚合并的东西又劈开——预览面 `#reviewedLegOf` 的重复正源于此。

**家**（grilling Q2 裁定）：新增 `session/reviewed-identity.ts`。理由：`Ledger` 已 86K+ 行，不该再塞判定；`session/run.ts` 46K 且是 lifecycle 实体，让 `face/` 平面的预览面从一个 lifecycle 文件 import 静态会制造不必要的跨面耦合。新文件极小，两面都 import 它，依赖方向干净。

**verdict 的归属**（grilling Q4 裁定）：判定只收 `(phase, kind)`；`targetAction` 留在 `#bookkeep`。这处**不对称必须显式记在判定旁边**——它是两面唯一的合法差异，不写清就会被后人当成遗漏。

**plan path 的归属**：`branch` 的「有没有 plan path」是**输入**不是判定，仍由调用方各自提供（记账侧 `#planPath`、预览侧 `#scene.planPath`）；`legOf` 只回答「branch 写到 doc 腿」。

### 3. 定案：双面证据（缺一不可）

**矩阵行为断言**：对 `phase × kind` 的矩阵，比对「预览报的腿」与「真实记账实际写入的腿」，两者必须同值。矩阵由 `#bookkeep` 真跑一次拿到实际写回的 ref kind，与预览的 `would record:` 行比对——**不是各测各的**。

**结构零门**：`grep` 断言那份 phase 字面量与 kind 三分支在 `packages/cdd-engine/src-next/` 内**只出现一次**（判定本体所在处）。

**为什么两条都要**（这条必须写进 spec，否则后人会以为一条就够）：

- **矩阵单独不够**——有人把列表原样抄一份，矩阵仍然全绿（两份一致）。它测的是「两面同值」，不是「只有一份」。
- **结构零门单独也不够**——它只证明「字面量只有一处」，证明不了「两面真的调了它」（可以写一处再让某一面绕过）。
- 两条合起来才封住：矩阵证「同源」，结构门证「单源」。

**字节零变**：`cdd fix --dry-run` 与真跑的输出在真值域内与今日逐字节相同。`preview.test.ts:79` / `:101` / `:122` / `:144` / `:162` 五条既有 `would record:` 断言**不重锚**——这是纯重构的判据。

### 4. 落点、依赖与发行

| 面 | 文件 | 落点 |
|---|---|---|
| 判定本体 | `session/reviewed-identity.ts`（新增） | `ReviewedIdentity.legOf(phase, kind): "doc" \| "brief" \| null`；旁注写明 `targetAction` 与 plan path 两项**不属于判定**的输入 |
| 真实记账 | `session/run.ts` | `:746-748` 的 phase 白名单与 `:749-752` 的 kind 三分支改调 `legOf`；`#recordReviewedDocRevision` / `#recordReviewedWaveBrief` / `#recordReviewedBranchRevision` 保留（它们做的是**写**，不是判定） |
| 预览 | `face/preview.ts` | `:159` 的 phase 字面量与 `:172-178` 的 `#reviewedLegOf` 改调 `legOf`；`#reviewedLegOf` 退化为「腿 → 字符串」的渲染映射（或直接内联），**不再持有 phase 白名单或 kind 三分支** |
| 测试 | `face/__tests__/preview.test.ts` · `session/__tests__/run.test.ts` | 新增矩阵用例（预览腿 ⇄ 实际写回腿）· 结构门（新 guard 或在既有 guard 里加一条）· 五条既有 `would record:` 断言**不动** |

**依赖**：P24 已 Done（`P24 -> P25` hard，本相位不依赖 P24 的产物，只依赖其闭合后的树——那里的 `fix` 白名单正是本相位要收的那一份）。

**发行**：`@oscaner-skills/cdd-engine` **patch**——这是一次纯重构：零消费面字节变化、零新命令、零新旗标。按 D74，方法契约不变，故不是 minor。

### 5. 非目标

- 不做「预览面与真跑共用**整条** `#bookkeep`」——两者差一个 verdict，合并会把 dry run 变成真跑的形状。
- 不改 `recordReviewedRevision` / `recordReviewedBrief` 的签名或写回时机。
- 不给判定加第二个入参（如 `completed`）——那是把运行时结果泄进纯判定。
- 不顺手改 `preview.ts` 的其它重复（例如 `reads:` 行的路径来源）——不在本相位证据面内。

### Acceptance criteria

- `ReviewedIdentity.legOf(phase, kind)` 是「写不写 + 写哪条腿」的**唯一实现**；`#bookkeep` 与 `#recordsOf` 都调它。
- **矩阵用例（禁止调用 `legOf`）**：`phase × kind` 逐格比对，**左侧取预览面的真实输出**（`cdd fix --dry-run` 的 `would record:` 行里的 `reviewedRevision(doc|brief)`），**右侧取真实记账后的账本事实**（真跑一轮后 `reviewedDocRevisionOf` / `reviewedRevisionOf` 的 ref kind）——两面都不许走 `legOf`，否则用例只证「同一函数被调了两次」。**今日为何不会红、本相位之后靠什么红**：今天两面恰好一致，故「同值」断言今日**是绿的**——它能红的是**未来只有一面被改**的那种漂移（这正是要防的回归）；而「今天就有两份」这件事由**结构零门**直接证明（今日字面量出现两次 ⇒ 该门今日必红）。两条各证一件事，缺一不可。
- **结构零门（今日必红）**：`packages/cdd-engine/src-next/` 内那份 phase 字面量与 kind 三分支只出现一次——**今日出现两次，故该门在改动前必红**，改动后转绿；把副本加回去即重新红。
- 五条既有 `would record:` 断言（`preview.test.ts:79` · `:101` · `:122` · `:144` · `:162`）**一行不改**仍绿。
- `next:` / `reason:` / 板面任何字节零变；`env -u AI_AGENT pnpm run validate` 退出码 0；changeset 为 `@oscaner-skills/cdd-engine` **patch**。

## Constraints

- **纯重构**：任何消费面字节变化都是越界。五条既有断言不重锚即证据。
- **判定必须纯**：`legOf` 不得读账本、不得读文件、不得接 verdict——只凭 `(phase, kind)` 回答。
- **不对称显式化**：`targetAction`（真跑独有）与 plan path（输入而非判定）两处差异必须写在判定旁边，否则后人会当遗漏补齐。
- **结构门必须可红**：写在 `src-next/` 范围上的字面量计数门，加回副本即红；不可红的门不算门。
- **零新依赖 / 零新命令 / 零环境变量**。

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-11-05 | 初稿：P25 写回判定单源——腿类型返回（非布尔）· 新家 `session/reviewed-identity.ts` · 双面证据（矩阵 + 结构零门，附「为何缺一不可」）· `targetAction` 留 `#bookkeep` 并显式登记不对称 · 纯重构、patch | Oscaner M. · Claude（kairos:cdd-design [P25] grilling → 本会话落 spec · 2026-11-05） |
| v0.2 | 2026-11-05 | **自查订正（编排器）**：原 Acceptance 说「矩阵用例在改动前的树上必红」不准确——今日两面恰好一致，「同值」断言今天是绿的。改为：**矩阵用例禁止调用 `legOf`**（左取预览真实输出、右取真跑后的账本 ref kind），它防的是「未来只有一面被改」的漂移；而「今天就有两份」由**结构零门**直接证明（今日必红）。两条各证一件事 | Acceptance 两条 + Change history v0.2 | Oscaner M. · Claude（kairos:cdd-spec-writer · 自查 · 2026-11-05） |
