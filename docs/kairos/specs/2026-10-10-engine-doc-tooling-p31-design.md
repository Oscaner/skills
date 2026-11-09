---
title: 引擎文档工具（Engine Doc-Tooling）— P31 设计：账本事实与磁盘一致性
doc-type: phase-spec
version: v0.1
date: 2026-11-09
slug: 2026-10-10-engine-doc-tooling-p31
program: 2026-10-10-engine-doc-tooling
parent-version: v3.44
author: '[human] 裁定 · Claude（kairos:cdd-design · 2026-11-09）'
---

## Design

本相位收口 github #444 / #446 / #447 三单。三单场景不同，撞在同一结构上：**账本声称的事实与磁盘/身份上的事实可以静默分叉**——载体字节可被任意覆盖而 `carrierPath` 仍指向「该轮结论」；`reviewedRevision` 可被 fix 收工无条件重绑成「当前」正文，把评审后的未审改动盖成已审；change-history 表头可自造第 5 列而 `row-shape` 只要求「行宽=表头宽」。P30 已交付 overall 表头 4 列规范化与 corpus ceiling 0，以及 shape 腿本身；本相位补上写保护、条件写回与表头列集门。设计决策 D82；grilling 定案见母 overall Phase inventory P31 行与本篇 §2。

### 1. 病根

#### 1.1 引擎是唯一写入者，却不是唯一可写者（#444）

`session/run.ts#bookkeep` 把 handoff 落成普通文件并记进 `RoundRecord.carrierPath`。落盘之后：

- 任何进程一条 shell 重定向即可整文件替换；
- 引擎不记内容摘要、读回不比对、事后不发现；
- `FIX_READBACK_SUFFIX` 仍教编排者「把 ruling 记进 handoff 文件」——官方路径等于手改引擎产物。

P30 实测：编排器用 `jq … > carrier` 把已 APPROVED 的 review 载体换成一行字符串，fix 输入集中空；`.kairos/` 未入库、bookkeep 同路径整文件替换、round log 无 JSON 副本，恢复只靠会话里碰巧打印过的 finding 原文。

缺口的两半：① **写入权威**成立（只有引擎该写 carrier）；② **写入保护**不成立（谁都能写）。检测面与拦截面都缺。

#### 1.2 fix 收工把「当前字节」绑成已审（#446）

`#bookkeep` 在 `record.verdict.targetAction` 为真时调用 `ReviewedIdentity.legOf` → `#recordReviewedDocRevision`，绑定的是**收工时刻**磁盘上的正文 revision。P24 要的是「fix 轮自身改了文档，不该被自己判成 drift」；同一条路径也把「**在 fix 派发之前、由别人改的正文**」一起吞掉。

实测：plan 行 review 收口 → 编排器提交正文改动 → fix 完成（零提交）→ `review --dry-run` 报 `unchanged`。规则「正文动了就要重审」没有歧义；执行面把未审改动盖了章。

#### 1.3 表头不在门内（#447）

`ChangeHistoryRowShapeInvariant` 只判「表体行单元格数 = 表头列数」，**不判表头是不是规范列集**。文档曾把手加宽成五列（`Version · date · summary · 落点 · author`），骨架与其它文档仍是四列，全门皆绿；随后行集腐坏（未转义竖线劈格、缺 author 格）直到 P30 的 shape 腿才第一次红在引入判据的同一份文档上。P30 closeout 已把 overall 归一为四列且 ceiling 0；缺的是「表头必须等于声明列集」这一钉，否则下一作者仍可再加一列。

### 2. 裁定

#### 2.1 载体归引擎，裁定归编排者（#444 · ①）

- 引擎产物 `<carrier>.json`（及定稿，见 §2.3）落盘后**字节冻结**；编排者的裁写进同目录 `<carrier-stem>.rulings.json` sidecar。
- sidecar 形状（严格 schema，见 §2.6）：

```json
{
  "carrier": "phase-spec-review-1.json",
  "rulings": [
    { "finding": "F4", "ruling": "REJECTED as stated…", "at": "…", "by": "orchestrator" }
  ]
}
```

- **无新 CLI 动词**（grilling Q4）：编排者直接写 sidecar 文件；引擎读回校验。
- **sidecar 永不 seal**（grilling Q11）：只 seal 引擎自己的 carrier；编排者在 carrier seal 之后仍须能写裁定。
- child 侧：fix 派发时引擎读载体；若有 sidecar 则合并进 round-context 的 `INPUT_RULINGS`（载体本身字节不动）。
- `FIX_READBACK_SUFFIX` 改指向 sidecar 路径（grilling Q12）：不再教改 handoff 文件；策略（先看 findings 再裁）不变。

#### 2.2 落盘记摘要，凡读比对（#444 · ②）

- bookkeep / materialize 定稿时算内容 sha256，写入：① 定稿 JSON 内字段；② 该轮 `RoundRecord`（`carrierPath` 旁）。
- **凡引擎读载体的入口**先比对 recorded / current；不匹配即 `CDD_BLOCKED`，诊断：

```
carrier-mismatch · line=<path> · recorded=<sha 前缀> · current=<sha 前缀>
```

格式沿用 `doc-drift` 的 recorded/current（grilling Q5′：读面全覆盖——fix 输入、board、capsule、任何读 `carrierPath` 的路径；不启动 child）。

#### 2.3 draft 与 final 分路径（#444 · ③）

- draft 留在派发原路径（例：`phase-spec-review-1.json`），child 仍写该路径。
- final 写周期名：`<stem>.c<N>.json`（例：`phase-spec-review-1.c2.json`）；**内容 sha 在文件内字段 + RoundRecord，不进文件名**（grilling Q6″）。
- `RoundRecord.carrierPath` 指向 final；另记 `draftPath`（draft→final 路径对）。bookkeep **禁止**对同一路径整文件替换定稿。
- 效果：即使 final 被毁，draft 仍在盘上可作 postmortem（对症 P30 事故里 artifacts 槽无副本）。

#### 2.4 落盘即只读：本轮产物路径的 unseal / seal（#444 · ④）

```
preflight        unseal(本轮产物路径)
dispatch child   任意写（草稿路径）
postflight       materialize final → seal(0o444)
```

- **unseal 作用域**只能是本轮 `RoundNaming` 算出的产物路径，不能是目录或整个 slug——否则 fix 的 preflight 会解封作为输入的上一轮 review 载体，在整个 fix 窗口重新开放 #444 的暴露面。
- **seal 必须在每一个终态发生**：成功路径、child stall/超时 `#reject`、门禁在 spawn 前拒绝、`--recover` abort 折账——各补一次；下一轮 preflight 开头 sweep 该 slug 名下任何无主 unsealed 引擎产物。
- **① 必须先于 ④**（硬顺序）：若只上 seal 而裁定仍教改 carrier，官方路径 EACCES。本相位落地序：sidecar + `FIX_READBACK_SUFFIX` 改写 → digest → draft/final → seal。

#### 2.5 `INPUT_RULINGS` 进 fix 输入侧 round-context（#444 · 补充）

- `render/templates.ts` 的 `TOKENS` 增 `INPUT_RULINGS`（`zone: "round-context"`）。
- `face/lifecycle.ts` 填 context 时按 `INPUT_REVIEWS` 路径推导 sidecar；无 sidecar → 空串（既有空值行丢弃）。
- 渲染位置与 `INPUT_REVIEWS` 相邻。
- **仅 fix 输入侧**：review 轮自己的 round-context 不渲染 sidecar 位（那时它还不存在）。
- pin：有 sidecar 时 fix 渲染文本含裁定正文；无 sidecar 时不含该行。
- **本相不做** board/capsule 展示（grilling Q10）。

#### 2.6 sidecar 严格 schema（#444 · grilling Q9）

- 读 fix 输入时校验：JSON 可解析、`rulings` 为数组、每条含 `finding` / `ruling`、`finding` id 必须出现在对应 carrier 的 findings id 集中。
- 失败 → `CDD_BLOCKED`（与 carrier-mismatch 同级硬停），避免「写了但 child 看不见」的假裁定。
- 未知字段策略：拒绝（严格），不静默忽略。

#### 2.7 写回只绑本轮造成的字节（#446）

- **派发时快照**：open frame 记录该文档正文 revision（与 `PlanStructure` 的 dispatch-time 基线同款，零新持久键——帧内即可）。
- **「动过」的证据**（grilling Q1）：本轮 `dispatchBase..HEAD` 的 commits 是否命中该文档路径（与完成判据同源，零新抽象）。
- **收工写回**（grilling Q2：凡 `ReviewedIdentity.legOf` 会写的相位——review / fix / branch-review 统一）：
  - 动过 → 绑当前正文 revision（保 P24「fix 自产不算 drift」）；
  - 未动过 → **保持旧** `reviewedRevision`，让既有 drift / reopen 面把行推回评审；
  - 无 git 可读 / 非 git 树 → 保持现状（绑当前）并记一条 soft 观察，不发明判据。
- 非目标：不改免审区口径；不改 drift 语义与重开面骨架；不迁移历史 `reviewedRevision`。

#### 2.8 钉 change-history 表头列集（#447）

- 新增不变量 `change-history-header-columns`：`## Change history` 表头必须**精确等于**声明列集 `Version · date · summary · author`（单元格文案按 trim 后逐格相等）；否则一条 finding。
- `change-history-row-shape` **保留**，只判行宽=表头宽（grilling Q3：两腿正交，corpus 可分别钉）。
- **语料门**：全语料零容忍（grilling Q7）。落地前实测 59 篇文档表头已全部为声明四列（bad=0），故 `DRIFT_CEILING` 对该 kind 为空表（≡ 全 0）；PROGRAM_DOCS 随本相 spec/plan 更新。
- docs-fix 模板（`render/templates.ts`）补一句：summary 内不得直接写竖线，必须 `\|`。
- 非目标：v3.20 author 考古；overall ceiling 已 0（P30），本相不重做 shape ceiling。

### 3. 非目标

- 不把 `.kairos/` 纳入 git 跟踪（工作区态进库会污染每次 CDD 运行的 diff）。
- 不新增 `cdd annotate` / `--ruling` 旗标（sidecar 文件约定即可）。
- 不改免审区（front matter · `## Change history` · version 头）；不做 `--diff-since`；不加 finding `origin`。
- 不迁移历史 `progress.json`、历史 carrier、历史 `reviewedRevision`。
- **判收敛主线零改（硬底线 · D70）**：blocker / warn / nit → Loop / 收敛 / 通过的转移表、`NextStepRouter`、`#blockerCount`、`REVIEW_CYCLE_CAP`、next-loop / architecture 孪生门，本相位字节级保留；`session/next.ts` 对 develop 零字节差（除本相明确改写的 `FIX_READBACK_SUFFIX` 字符串本身——该后缀是提示文案，不是收敛转移表）。
- board/capsule 展示 sidecar 裁定留后续相位。
- changeset：仅 `cdd-engine` minor（grilling Q8）；kairos 本相不 bump；不发布。

### Acceptance criteria

- **sidecar 写与读**：编排者写入 `<stem>.rulings.json` 后，fix 派发的 prompt round-context 含 `INPUT_RULINGS` 且正文与 sidecar 一致；无 sidecar 时该行不出现（成对 pin）。
- **`FIX_READBACK_SUFFIX`**：字面指向 sidecar 路径（或「与 --reviews 同 stem 的 `.rulings.json`」），零「记进 handoff / carrier」教唆（子串 pin）。
- **carrier-mismatch**：篡改 final 字节后，任一引擎读入口（fix 输入 / board / capsule）→ `CDD_BLOCKED` 且报文含 recorded/current 前缀；不启动 child。
- **draft/final**：bookkeep 后盘上同时存在 draft 原路径与 `<stem>.c<N>.json`；`RoundRecord.carrierPath` 为 final、`draftPath` 为 draft；final JSON 内与 RoundRecord 均有同一 content sha。
- **seal**：成功收工后 final 模式为 `0o444`；对已 seal 的输入载体，fix preflight **不解封**它；stall/`#reject`/spawn 前门禁拒/`--recover` abort 后本轮产物仍被 seal 或被下一轮 sweep 收口（行为 pin 覆盖终态集）。
- **sidecar 坏 schema**：缺 `rulings`、finding id 不在 carrier、非 JSON → fix 派发前 `CDD_BLOCKED`。
- **条件写回**：夹具「review 收口 → 轮外正文提交 → fix 零提交收工」后 `reviewedRevision` **仍为 review 收口时的字节**（或等价：随后 dry-run review 报 drift / open，而非 `unchanged`）；夹具「fix 自身提交改了该文档」后写回为新字节（P24 语义成对 pin）。
- **写回作用域**：review / fix / branch-review 凡 `ReviewedIdentity` 写回路径均走「动过才绑」；wave brief 腿若绑定的不是整篇正文 revision，其既有 brief 语义不变（结构性说明 + 既有 pin 全绿）。
- **header-columns**：表头多一列或少一列或列名漂移 → 一条 `change-history-header-columns` finding；声明四列表头 + 行宽一致 → 该 kind 零 finding；`row-shape` 腿行为不变（正交 pin）。
- **语料**：`doc-corpus.guard.test.ts` 对 `change-history-header-columns` 全语料 0；既有 shape ceiling 表不被本相放宽。
- **docs-fix 模板**：含 summary 竖线须 `\|` 的句子（子串 pin）。
- **判收敛主线**：`NextStepRouter` / 孪生门相关 pin 全绿；除 `FIX_READBACK_SUFFIX` 字符串外收敛主线源文件零行为变化。
- `pnpm run validate` exit 0；changeset `cdd-engine` minor；不发布；#444 / #446 / #447 各得终态。

## Constraints

- 零模块级裸函数；改动落在既有类面（`Ledger` / `RoundRecord`、`session/run.ts#bookkeep`、`ReviewedIdentity`、`face/lifecycle.ts`、`render/templates.ts`、不变量族、`infra/workspace` 写盘缝、corpus guard）。
- 不新增 CLI 动词；不把 `.kairos/` 入 git。
- `progress.json` 固定键集：新增 `draftPath` / carrier digest 字段只落在 `RoundRecord`（及定稿 JSON 自描述字段），不新增顶层固定键。
- 波宽不超过 3。
- **落地序硬约束**：sidecar + readback 文案 → digest 读回 → draft/final → seal；颠倒 seal 与 sidecar 即 BLOCKED 于设计（计划波次必须尊重此序）。
- **判收敛主线零改（硬底线 · 与 §3 同文）**：D70 转移表与孪生门本相位字节级保留。
- D82 的记录裁定不得被本相实现反向推翻（发现冲突即回填 overall 再继续）。
- 每条 AC 必须有 colocated pin；无 pin 的声称视为未交付（D75）。

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-11-09 | 初版：病根三条（载体无写保护 · fix 写回绑当前字节 · 表头不在门内）· 裁定八条（sidecar 文件约定 · digest 凡读硬停 · draft/final 周期名+内嵌 sha · 本轮路径 unseal/seal · INPUT_RULINGS · sidecar 严格 schema · dispatchBase..HEAD 条件写回 · header-columns 不变量+全语料 0）· 非目标与验收；grilling Q1–Q13 定案；语料实测 59/59 四列 | [human] 裁定 · Claude（kairos:cdd-design · 2026-11-09） |
