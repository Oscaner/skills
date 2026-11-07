---
title: 引擎文档工具（Engine Doc-Tooling）— P29 设计：闭合 wave 不追溯 briefDrift + `brief-drift` 拆词/诊断同源 + issue related 形状门
doc-type: phase-spec
version: v0.2
date: 2026-11-07
slug: 2026-10-10-engine-doc-tooling-p29
program: 2026-10-10-engine-doc-tooling
parent-version: v3.38
author: '[human] 裁定 · Claude（kairos:cdd-design · 2026-11-07）'
---

## Design

本相位收口 #438 的两处契约缺口：① branch 终审被上游站以 `doc-drift` 卡住，而文档 revision 实际未漂——真因是**已闭合 wave 的 brief 漂移**与**文档 revision 漂移**共用一个 reason，且拒绝语的 `next:` 指错面；② `cdd issue render` 对非法/平铺 `related` **静默丢弃** Related 区，与 `findings[]` 的严格校验不对称。

现场（#438 comments）已证伪「branch 行自身假阳性 / doc_hash 未对齐提交」两条早期假说；定案建立在「`reviewGate(branch)` = `unbound`、两份文档 revision 与磁盘一致、`briefDrifted(<closed-batch>)` = true」这一可复现事实上。

### 1. 病根

#### 1.1 上游站把「任意 batch 的 brief 漂移」当成挡 branch 的 `doc-drift`

`DispatchAuthority#waveStation`（`session/dispatch-authority.ts`）对 `graph.batches()` 做 `.some(briefDrifted)`。波一旦闭合，`Ledger#waveLineRoute` 已是 `null`（无 open hop），但 **station 仍扫全部 batch**——收口后修订 plan（尤其 `## Constraints`）使每条 `brief_hash` 失效，于是 branch 派发被 leg `upstream` 拒绝。

拒绝语路径把 station=`drift` 映射成 `DISPATCH_REASON.docDrift`，再拼上 pipeline frontier 的 hop（常为 `review --type branch`）——**reason 来自 wave brief，next 来自 branch 站**，读起来像自指僵局。`board` 若读另一套拼装，同一状态还可并行报 `task-open`。

#### 1.2 `briefDrift` 与文档 drift 共用 `doc-drift` 词

`Ledger#nextHopOf` 把文档 `reviewGate` 漂移与注入的 `briefDrift` **并进同一个** `gate.drift`；`NextStepRouter#reasonOf` 在 `route.kind === "review" && gate.drift` 时一律返回 `doc-drift`。补救动作不同（重审文档 ≠ 重审 wave），词却相同。

#### 1.3 brief 判定输入把 `## Constraints` 算进 hash

`BriefRenderer#render`（`render/brief.ts`）仍把 task 段与 `## Constraints` 拼成 child 输入（D25/D30「完整计划镜像」）。`ReviewRefs#briefRevision` / `Ledger#briefDrifted` 对这份**完整渲染**做 hash。于是收口后只改 Constraints 措辞，也会让全部 batch 的 brief 判定失效——正是 #438 现场的触发面。

#### 1.4 `issue render` 的 related 无形状门

`IssueBodyRenderer#validateInput`（`render/issue-body.ts`）严校 `findings[]`（类型/语言/四段/meta），却**不读** `related` 的形状；`#renderBody` 只认嵌套 `{ open?, closed?, program? }`。平铺数组 → exit 0、无 Related 区、无字段路径——去重自动化不可信。

### 2. 裁定

#### 2.1 闭合不追溯：只滤 `#waveStation`

- **改面**：`DispatchAuthority#waveStation` 只对**尚未落入** `Ledger#closedWaves()` 的 batch 调用 `briefDrifted`。
- **不改**：`Ledger#briefDrifted` 的谓词语义（仍是「记录的 brief-revision vs 当前判定投影」的纯事实读）；`waveLineRoute` 对已进入未闭合波的 D30 重开腿保持。
- **效果**：已闭合 batch 的 Constraints/brief 变更不再把上游站标成 `drift` 挡 branch；仍 open 的波继续可因 brief 漂移重开。

#### 2.2 brief-revision 只 hash task 正本

- **child 输入不变**：`BriefRenderer#render` 仍附加 `## Constraints`（实现/评审可读全局约束）。
- **判定投影分离**：`brief-revision` / `briefDrifted` 的 hash 只对 **task 段渲染**（不含 Constraints）。改 Constraints 不再误触；改本波 Task 段仍重开。
- **旧 hash**：不迁移。闭合波靠 2.1 不追溯；仅仍 open 的波可能因口径切换触发**一次** brief-drift 重开（可接受的一次性代价）。
- **对 D30 的显式修正**：D30「门控绑渲染后 brief」收窄为「门控绑 **task 正本**投影」；Constraints 仍是派发输入的一部分，但不是 reopen 指纹的一部分。

#### 2.3 reason 拆词：`brief-drift`

- `NEXT_HOP_REASON` / `DISPATCH_REASON`（及站牌/拒绝语同源读者）增加 **`brief-drift`**。
- **`doc-drift` 专指文档 revision**（`reviewGate` → open）。
- `nextHopOf` / `#reasonOf` / 上游站映射不得再把 brief 漂移写成 `doc-drift`。

#### 2.4 next 与 reason 同源

当未闭合 batch 的 brief 漂移使上游站拒绝 **branch**（或其他下游）派发时：

- `reason` = `brief-drift`
- `next` = `review --type wave --tasks <batch>`，`<batch>` = `graph.batches()` 序中**第一个**「未闭合且 `briefDrifted`」的 batch
- 诊断可列出全部 drifted batch keys；**可执行 next 只有一条**（第一个）

不得再把 branch 站的 hop 挂到 wave brief 的 reason 上。

#### 2.5 诊断强制

凡拒绝语 reason 为 `brief-drift` 或 `doc-drift`，必须打印：

- `layer`（`brief` | `doc`）
- `line key`（wave batch key，或 spec/plan/branch 行键）
- `recorded` hash 与 `current` hash（至少稳定前缀；完整与否由实现定，但两端必须可辨）

现场定位曾依赖自写钩子——CLI 必须自带同等信息。

#### 2.6 board 与 dispatch：同源 station 读

两边都经同一套 station / reason 派生（滤闭合 batch + `brief-drift` token）。**不**另造第三套合成器；本相不以「抽出唯一 public 函数」为硬门，以「同一状态不再一边 `task-open`、一边 `doc-drift`」为验收。

#### 2.7 D76 保持

plan 正文投影（`DocBodyProjection`）漂移仍使 branch 面重开：`doc-drift` · `next: review --type branch --plan …`。本相不收紧、不撤计划身份重开。

#### 2.8 `issue render` related：只认嵌套

- 合约形状唯一：`related?: { open?; closed?; program? }`（字段形态与现 `IssueReportInput` 一致）。
- `validateInput`：若存在 `related` 键，则必须为非 null 对象且非数组；`open`/`closed` 若在则为元素形状正确的数组；`program` 若在则含 `issue: number`。平铺数组或其他形状 → **exit 1** + 字段路径（与 findings 同级）。
- 合法嵌套继续渲染 Dedup / Related；缺省 `related` 仍合法。

### 3. 非目标

- 不提供 `--rebase-docs` / 手改账本逃逸，不以「允许受控重审已闭合 wave」为主路径。
- 不从 child brief 中删除 Constraints；不恢复 `INPUT_PLAN` 作为 Constraints 通道。
- 不迁移历史 `brief_hash`；不做读时静默重绑。
- 不改 D76；不把 #436（pending-fix 重开 / 零提交验证任务）并入本相。
- 无新 CLI 动词；changeset **minor**；不发布。

### Acceptance criteria

- **闭合不追溯**：构造「全部 wave 行已闭合 + 各 `brief_hash` 与当前完整渲染不一致（例如只改 `## Constraints`）」时，`review --type branch` **不再**因上游 `doc-drift`/`brief-drift` 被拒；行为由 colocated pin 钉在 `DispatchAuthority` / `#waveStation` 一侧。
- **open 波仍追溯**：至少一条未闭合 wave 的 Task 段漂移时，branch（或下游）派发被拒，`reason` 为 **`brief-drift`**（不得再是 `doc-drift`），`next:` 为该 batch 的 `review --type wave --tasks …`（batches 序第一个漂移未闭合 batch）。
- **hash 口径**：同一 Task 段、仅改 Constraints → `briefDrifted` 对未闭合波为 **false**；改该波 Task 段 → **true**。`BriefRenderer#render` 输出仍含 Constraints（行为 pin）。
- **拆词**：`NEXT_HOP_REASON` / `DISPATCH_REASON`（或同源表）含 `brief-drift`；源码与拒绝语中 brief 漂移路径零 `doc-drift` 误贴（grep/行为 pin）。
- **诊断**：`brief-drift` 与 `doc-drift` 拒绝输出含 layer · line key · recorded/current hash（字符串 pin 或结构化字段 pin）。
- **board ↔ dispatch**：同一「仅闭合波 brief 陈旧」夹具下，board 与 dispatch 不得一个报可派 branch、一个报漂移拒派（成对行为 pin）。
- **D76**：plan 正文投影漂移后，`review --type branch` 仍可派发且 reason/`next` 走文档漂移重开（既有 P22 T17 族 pin 不破或等价重锚）。
- **related**：平铺数组 / 非对象 `related` → `issue render` exit 1 且错误含字段路径；合法嵌套仍渲染 Related；缺省 `related` exit 0。
- `pnpm run validate` exit 0；changeset `cdd-engine` **minor**；不发布；#438 可关。

## Constraints

- 零模块级裸函数；改动落在既有类面（`DispatchAuthority` · `Ledger` / `ReviewRefs` · `BriefRenderer` 或紧邻投影 · `IssueBodyRenderer` · reason 表）。
- 不新造 CLI 动词 / 旗标；不回流 `progress.json` 新字段（除 reason 词表与拒绝语文案）。
- `BriefRenderer#render` 对 child 的 Constraints 附加不得删除；hash 口径与 render 字节允许分离，但分离点必须单源、可测。
- 波宽 ≤ 3；判收敛主线（`NextStepRouter#close` / `#blockerCount` / `REVIEW_CYCLE_CAP` / next-loop 孪生门）零改。
- D76 行为保留；D30 仅按 §2.2 收窄指纹，不撤 wave brief 重开机制。

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-11-07 | 初版：病根（闭合波 brief 扫全表 · reason 混用 · Constraints 进 hash · related 无门）· 裁定九条（只滤 `#waveStation` · task-only hash · 旧 hash 不迁 · `brief-drift` · next 同源 · 强制诊断 · board/dispatch 同源 station · D76 保持 · related 只认嵌套）· 非目标与验收 | [human] 裁定 · Claude（kairos:cdd-design · 2026-11-07） |
| v0.2 | 2026-11-07 | **closeout 登记（cdd-close）**：P29 全链闭合——W1={1,3} implement→review→fix(1 warn) · W2={2} implement→review(2 findings)→fix · 分支终审 `branch-review-1` 2 findings（warn JSDoc / nit changeset EOF）→ branch-fix 全 APPROVED。交付：`BriefRenderer#taskBody` task-only 投影（child `render` 仍附 Constraints · hash/`briefDrifted` 只算 task 正本）· `#waveStation` 经 `closedWaves()` 先滤闭合 batch · `brief-drift` 与 `doc-drift` 拆词 + 漂移波 `next:` 指第一个漂移未闭合 batch 的 wave review · 拒绝语强制 `layer/line/recorded/current` · `IssueBodyRenderer#validateInput` related 只认嵌套（平铺 → exit 1 带字段路径）。`pnpm run validate` exit 0（root 34 · kairos 95 · engine 1425 · typecheck ×3 · version-sync kairos 1.5.0 / cdd-engine 4.6.0 · emit fresh · 零裸函数）· changeset `p29-brief-drift-and-related-gate`（cdd-engine minor）pending · 不发布 · #438 关闭 | Oscaner M. · Claude（kairos:cdd-close · closeout-backfill · 2026-11-07） |
