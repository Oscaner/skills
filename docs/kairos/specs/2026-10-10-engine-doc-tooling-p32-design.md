---
title: 引擎文档工具（Engine Doc-Tooling）— P32 设计：已审版本写回的相位判别
doc-type: phase-spec
version: v0.3
date: 2026-11-10
slug: 2026-10-10-engine-doc-tooling-p32
program: 2026-10-10-engine-doc-tooling
parent-version: v3.48
author: '[human] 裁定 · Claude（kairos:cdd-design · 2026-11-09）'
---

## Design

本相位收口 github #458 的写回半边。P31 §2.7 把 fix 轮写回改成「只绑本轮动过的字节」，但这条判据**没有区分相位**：它同样拦住了 `review` / `branch-review`，而评审的本职恰恰是**不改文件地判定现有字节**。于是每一轮 APPROVED 都不留痕——`reviewedRevision` 停在轮前值，drift 永真，同一行被无界重派。实测四步夹具（首次绑定 → 轮外正文改动 → `review(touchedDoc:false)` → 再一轮同样）复现：binding 不动、`docLineVerdict` 恒 `drift`、`reviewGate` 恒 `open`、`lineStateAt` 恒 `reopened`。#458 用户侧观测到的 cycles 38–41 连续五轮空 findings 的 APPROVED 仍不闭合，正是这个形态。

### 1. 病根

#### 1.1 条件写回缺相位判别

`session/run.ts#bookkeep` 的写回门是一句与相位无关的条件：

```ts
const leg =
  record.verdict.targetAction && outcome.touchedDoc !== false
    ? ReviewedIdentity.legOf(frame.phase, frame.target.kind)
    : null;
```

`ReviewedIdentity.legOf` 决定**绑哪条腿**（`doc` / `brief` / `branch`），却无人决定**这条腿是否该受 `touchedDoc` 支配**。两种相位的实事相反：

| 相位 | 本职 | 「本轮提交没动过该文档」的含义 |
|---|---|---|
| `fix` | 改文档解决 findings | **有意义**——轮外改动不该被吸收（#446 的原意） |
| `review` / `branch-review` | **判定**现有字节 | **是正常情况**——审阅不改文件 |

对 review 施加同一条门，等于把「这版被审过了」这件事永远写不进账本。

#### 1.2 为什么它是无界循环而不是一次退化

`reviewedRevision` 是 drift 判定的唯一起点（`Ledger#docLineVerdict` 拿它与当前正文比）。写不进去，drift 就永真；`reviewGate` 恒 `open` 时派发权威把下一轮又指向 review；新的一轮仍然 `touchedDoc: false`（review child 不提交），于是循环自我维持，轮次号只增不减。消费者唯一的出口是手工把账本里的 `reviewedRevision` 改成引擎投影出的正文哈希——这需要读引擎源码才能复现投影。

#### 1.3 为什么 P31 的验收没拦住

P31 的三条写回 pin 全部构造在「本轮自己改写了文档」的夹具上：

- `true` 用例：review round 内部 `writeFileSync` 改写文档（真实 review 从不这样）；
- `false` 用例：review 带 finding，随后 **fix** 不碰文档（覆盖的是 fix 相位）；
- `null` 用例：git 不可读。

**缺的正交面是**：「一行已绑定 → 轮外正文改动 → 派 review 且 `touchedDoc: false` → 行必须闭合」。本相位把它补成 pin，而不是靠散文记住。

### 2. 裁定

#### 2.1 判据按相位分治（Q1）

- `ReviewedIdentity` 增一个静态判定 `gatedByTouchedDoc(phase: RoundPhase): boolean`——**`fix` 为 `true`，其余为 `false`**。它与 `legOf` 同栖一处：一个是「绑哪条腿」，一个是「这条腿受不受 touchedDoc 支配」，两份相位知识同源，消费者只有一处可读。
- `#bookkeep` 的写回门改为：

```ts
const leg =
  record.verdict.targetAction &&
  (!ReviewedIdentity.gatedByTouchedDoc(frame.phase) || outcome.touchedDoc !== false)
    ? ReviewedIdentity.legOf(frame.phase, frame.target.kind)
    : null;
```

- `touchedDoc` 的**事实**计算不动（`face/lifecycle.ts#touchedDocOf` 照旧按 `dispatchBase..HEAD` 读路径）：事实继续被记录、继续在 fix 相位生效、继续进 `null` 的 soft 观测；变的是**谁受它支配**。

#### 2.2 review 的任何完成结论都绑（Q2）

- `targetAction` 为真即绑，不区分 APPROVED / CHANGES_REQUESTED / REVIEW_FIX——这与 P31 之前的语义一致，也是 P24 的 `fix→review` 链条所依赖的：review 绑住它审过的字节，fix 改完后正文再变，drift 自然重开 review。
- 只绑 APPROVED 会让 drift 在 review→fix 之间恒真，把「评审已发生」这件事压缩成比 P31 之前更窄的语义，与本相位要修的错同型（把「没改文件」当「没发生」）。

#### 2.3 `branch-review` 同待遇

- `branch-review` 的腿是 `branch`（绑该行 plan 文档），它的本职同样是判定而不是改写，因此与 `review` 同判：不受 `touchedDoc` 支配。
- 一句话的理由：**判据分治的依据是「这个相位是否会被期望改写它判定的那份文档」**，`fix` 才会。

#### 2.4 不加新门，只补正交 pin（Q3）

- 不引入「完成 review 必须有身份落账」的 hard 门：历史行、旧记录、非 doc 面都可能误红，且这与 P28「易变事实不设门」同向。
- 防复发靠 pin 不靠散文：本相位新增的那条夹具测试就是它的守卫。plan 与 spec 的写作纪律各补一句（`fix` 可以「没动过就不绑」，评审面不可以），落点在 `## Constraints` 与 phase-spec 模板的既有句旁。

#### 2.5 #458 的另一半另立（Q4）

- 本相关闭的是**写回**那一半（账本留痕 / 行闭合）。#458 报的「child 已完成但 wrapper 看不到终止行、日志零字节、跑满 60/90/120 分钟超时」是另一条主张：引擎不解析 child stdout（P11），若 child 不退出则引擎只能按预算终止，属 harness 侧行为，需单独定性后才能判是不是引擎缺陷。该半边另开 issue，不在本相。

### 3. 非目标

- 不回退 #446：`fix` 的条件绑定保持原样（含 `null` 的 soft 观测与 `undefined` 的默认绑定）。
- 不改 drift / reopen 语义、不改免审区（front matter · `## Change history` · version 头）、不迁历史 `reviewedRevision`。
- **判收敛主线零改（D70）**：blocker / warn / nit → Loop / 收敛 / 通过的转移表、`NextStepRouter`、`#blockerCount`、`REVIEW_CYCLE_CAP`、next-loop / architecture 孪生门字节级保留；`session/next.ts` 零 diff。
- 不加新 CLI 动词、不加新旗标、不改 `preview` 的 `would record:` forecast 面（它本就没有 `touchedDoc` 输入）。
- 不处理 #458 的超时半边（§2.5）。

### Acceptance criteria

- **闭合夹具（本相位的核心 pin）**：一行先被 review 绑定 → 轮外正文改动（`reviewGate` 转 `open`、`lineStateAt` 转 `reopened`）→ 派一轮 review 且 `touchedDoc: false` → 收工后 `reviewedRevision` **等于该轮审过的正文修订**、`docLineVerdict` 为 `same`、`reviewGate.kind` 为 `same`、`lineStateAt` 为 `closed`。
- **无界循环消失**：同一夹具连续两次派发，第二次不再派同一行的 review（`lineRoute` 无 active hop / 该行已闭合）。
- **带 finding 的 review 也绑**：review 结论为 CHANGES_REQUESTED（findings 非空）且 `touchedDoc: false` 时仍绑定已审字节；随后的 fix 若改写文档，drift 重新成立（`docLineVerdict` 为 `drift`）——证明 P24 的 fix→review 链条未被削窄。
- **fix 侧零回归（成对 pin）**：`touchedDoc: true` 绑当前、`false` 保持旧绑定并使下一次 review 报 drift、`null` 绑当前并附一条 soft、`undefined`（注入式 dispatcher）与 P31 一致——P31 的四个用例原样通过。
- **branch-review 同判**：branch 行在 `touchedDoc: false` 的 branch-review 完成后，其 `reviewedRevision`（plan 文档）被更新，行闭合。
- **判据同源**：`gatedByTouchedDoc` 只对 `fix` 返回 `true`（逐相位表驱动 pin），且 `legOf` 的相位白名单未被改动。
- **D70**：`session/next.ts` 零字节 diff；`NextStepRouter` / 孪生门相关 pin 全绿。
- `pnpm run validate` exit 0；changeset `cdd-engine` **patch**；#458 的写回半边以本相关闭，超时半边另立 issue。

## Constraints

- 零模块级裸函数；新增判定落 `session/reviewed-identity.ts`（与 `legOf` 同栖），`#bookkeep` 只读它。
- **判收敛主线零改（D70，与 §3 同文）**：转移表与孪生门字节级保留。
- D83 的记录裁定不得被本相实现反向推翻（发现冲突即回填 overall 再继续）。
- 不新增 `progress.json` 顶层键；`RoundRecord` 形状本相不动。
- `touchedDoc` 的事实计算保持现状（不因本相而删减或改语义）。
- 每条 AC 必须有 colocated pin；无 pin 的声称视为未交付（D75）。
- changeset 只 `@oscaner-skills/cdd-engine` **patch**（恢复被误窄的既有语义，方法论未变）。

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-11-10 | 初版：病根三条（条件写回归纳相位无关 · 无界循环机制 · P31 三条 pin 全部构造在「本轮改写文档」的夹具上）· 裁定五条（`gatedByTouchedDoc` 只对 fix 为真 · review 任何完成结论都绑 · branch-review 同判 · 只补正交 pin 不加门 · #458 超时半边另立）· 非目标与验收；grilling Q1–Q4 定案 | [human] 裁定 · Claude（kairos:cdd-design · 2026-11-09） |
| v0.2 | 2026-11-10 | 评审回填（phase-spec-review-1 F1/F2）：母 overall 的 D83 与 P32 两表行由 working scope 升 grilling settled（D83 记 Q1–Q4 · Phase inventory 的 P32 验收对齐本文的八条 · 执行序 P32 段同改 · Change history v3.48），`parent-version` 随行对齐 v3.48；文件末尾补齐单一换行 | [human] 裁定 · Claude（kairos:cdd-dev · phase-spec-fix-1 · 2026-11-10） |
| v0.3 | 2026-11-09 | **closeout 登记（cdd-close）**：P32 全链闭合——两波 W1{1}·W2{2} 各 implement→review，**两轮零 finding**，分支终审 0 finding（5 提交）。交付与 §2 五条裁定逐条对应：`gatedByTouchedDoc` 只对 `fix` 为真 · review 任何完成结论都绑 · branch-review 同判 · 只补正交 pin 不加新门 · #458 超时半边转 #459。三组 pin（核心正交面 / CHANGES_REQUESTED / branch-review）+ P31 四态零回归。`pnpm run validate` exit 0（engine 73/1603）· `session/next.ts` 零 diff（D70）· changeset `cdd-engine` patch | Oscaner M. · Claude（kairos:cdd-close · closeout-backfill · 2026-11-09） |
