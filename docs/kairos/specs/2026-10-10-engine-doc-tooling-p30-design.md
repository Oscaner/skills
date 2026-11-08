---
title: 引擎文档工具（Engine Doc-Tooling）— P30 设计：中断可表达 · 完成判据换代理 · 机械判据硬化
doc-type: phase-spec
version: v0.3
date: 2026-11-08
slug: 2026-10-10-engine-doc-tooling-p30
program: 2026-10-10-engine-doc-tooling
parent-version: v3.40
author: '[human] 裁定 · Claude（kairos:cdd-design · 2026-11-08）'
---

## Design

本相位收口 github #431 / #436 / #437 / #443 四单的机械面。四单的场景互不相同，但撞在同一个结构上：**账本只认识引擎自己跑完的轮次**，而**机器判据拿脆弱代理当真值**。前者让「被外部杀掉的轮次」与「用户改掉的设计」在账本上不可表达，于是恢复动作与门禁规则互相否定；后者让 commit 数、LLM 散文、宽松正则成为放行与拒绝的依据。两条以裁定关闭（D81）：#431③ 的评审增量面与 #437 的契约/台账二元性都不是缺陷，而是 CDD 的形态，免审区（front matter · `## Change history` · version 头）就是全部豁免面。

### 1. 病根

#### 1.1 账本只认识「引擎跑完的轮次」

`face/lifecycle.ts` 的派发面在 spawn 前取 `#dispatchBase`，`#reject` 把终止事实（cause 与采样）带回 outcome，`session/run.ts#bookkeep` 对每一轮派发落 `RoundRecord` —— 引擎自己的 stall / timeout 路径是记账的。但整条 `cdd` 进程被外部杀死时 bookkeep 未跑，账本零记录；`session/inflight.ts#InFlight.steal` 只接管锁与记录，`InFlightRecord` 携带的 `wave` / `phase` / `cycle` / `attempt` / `briefHash` / `plan` 被直接丢弃 —— 该轮在账本上从未存在。

由此派生三处症状，机制同一个：

- **恢复提交后重派被拒**（#431②）：重派成为该线的新 attempt 1，`CommitsSinceGroupBase.groupBaseOf` 组内只剩这一条 `dispatchBase`（即恢复提交之后的 HEAD），`commitsSince` 为空 → `the group committed nothing since its baseline`。
- **一次中断永久关闭一条线**（#436②）：review 已给出 CHANGES_REQUESTED，fix 轮被杀，`Ledger#pendingFix` 以「最新 completed review 的 cycle 不在 fix 完成集」派生，永不解除。
- **报文只教一半**：`--steal-stale` 的拒绝语教「steal 锁」，steal 之后撞的是同一堵墙，两条报文互不指向。

#### 1.2 pending-fix 压过 drift，且「设计被外部改写」没有出口

`Ledger#docReopens` 只对 `Ledger.onExitSide(lineRoute)` 为真的行放行 drift，挂在非 exit 侧的 pending fix 保留自己的轮次。这条规则本身是对的（P24 的「fix 轮自身产出不算 drift」靠它成立）—— 缺口在于它同时封死了另一件事：`doc-drift` 已经成立（`Ledger#reviewGate` 为 `open`）却因为 fix 未完成而无法派发 review（`DispatchAuthority#linePhaseFacts` 落到 `pending-fix` 拒绝，#436①）。用户整篇重写设计后，唯一合法路径是派一个「对着已不成立的 findings 做 fix」的轮次，而引擎没有 supersede 语义。「这一轮 review 的结论已被外部改写取代」是一件真实发生的事实，账本没有它的位置。

#### 1.3 完成判据拿 commit 代理「这轮干了活」

`CommitsSinceGroupBase.judge` 的唯一放行条件是组内最早 `dispatchBase` 之后至少一笔提交。纯验证任务的交付物是证据（跑门与采集结论），定义上零 diff；而 wave / branch 的 work 轮本来就强制写 `test-evidence.json`（`face/lifecycle.ts` 的证据门与 `HandoffSchema` 的 EVIDENCE 契约），证据面齐备，唯一不过的是 commit 门（#443①、#436③）。

代理的失真面：验证型任务必然零 diff；编排方在轮次之间合法提交恢复成果（树动了，但不是「这轮」动的）；abort 轮未入账时组基线退化成重派时 HEAD（§1.1）。组基线的原意 —— attempt 2 可吃 attempt 1 的提交 —— 是对的，本相位不动它；缺口只在「把它当成唯一真值」。

#### 1.4 disposition 以 LLM 散文为主键

`FixDispositions` 把请求方 carrier 每条 finding 的 `summary` 逐字当键；`#keyRefusal` 先算「disposition 有而 carrier 无」，命中即返回。于是子代理把 summary 改写一个词，报文就变成 `disposition(s) for finding(s) the requesting carrier never raised` 加一段改写后的散文 —— 而真正可行动的「你漏了哪条」永不打印。「幽灵 finding」与「三次派发、两次同样报错」由此而来（#443④）。主键语料是被审者自己写的散文，任何一致性要求只能靠自律。

#### 1.5 change-history 的行与版本读面过松

`contract/invariants.ts` 的版本读面用未锚定的版本正则读任意行，行集来自表格解析；GFM 表格的折行续行**不以竖线起首**，却仍被收进行集，折行片段里出现的版本号于是变成第二个 lineage 行，`change-history-version-unique` 假红（#443②）。同时 `front-matter-version-in-lineage` 的语义是成员（header 属于 lineage）而非「等于最新行」，于是 fix 轮追加一行新版本而 header 停在旧版本时全门皆绿（#443③）。这一族与文档内容无关，纯粹是判据读面的松。

### 2. 裁定

#### 2.1 `--recover` 一个词收掉 steal 与 reopen

- `--steal-stale` 退役（硬切；按 D74 属消费面字节破坏，版本级仍 minor），由 `--recover` 取代：同形命令加 flag，不新增 CLI 动词。
- 判定按序、先命中先做，可叠加：① 陈旧 in-flight（记录存在且持有进程已死、记录不可读、或锁残留）→ 接管并折 abort（§2.2）；② doc drift 且 pending-fix → supersede 上一轮 pending-fix 并放行 review（§2.3）；③ 两条皆不成立 → BLOCKED，报文同时点名两个缺失条件（不许静默降级为普通派发）；④ 两条同时成立 → 同一命令内先 abort 入账、再 reopen，账本留两条事实。
- 两条腿的触发面钉死，不许扩权：
  - **abort 腿**：`implement` / `review` / `fix` 任一派发动词，只要树或 slug 上有陈旧 in-flight —— 与目标行种类无关；
  - **reopen 腿**：仅 `review`，且目标是 doc / branch 行。`fix --recover` 与 `implement --recover` 永不走 reopen；wave 行永不走 reopen（wave 的重开面仍是 P29 的 brief-drift）。
- `next:` 面：在 drift 且 pending-fix 的拒绝语上给出带 `--recover` 的同形 review 命令，不引导人去翻文档。
- 该 flag 在 `face/declare.ts` 的旗标表与 `face/words.ts` 的报文面；`--steal-stale` 的字面在帮助面、拒绝语、capsule、words 表零残留。

#### 2.2 abort 入账

- `InFlightRecord` 增 `dispatchBase`（acquire 时写入 HEAD）。没有这一格，abort 记录的组基线无从复原（§1.3 的第二个失真）。
- `InFlight#steal` 的返回值折成一条 `RoundRecord`：`op` 由 `phase` 派生、`cycle` 与 `attempt` 取记录值、`dispatchBase` 取记录值、`verdict.targetAction` 为 `false`、一条 hard violation，cause 记为 `interrupted` —— 向既有 `CrashCause` 联合（`session/ledger.ts`：`stalled` · `over-budget` · `signal` · `child-exit` · `contract-violation` · `unknown`）**新增一个字面**，不新建并行枚举类型；该字面今日不在联合内，是本相位的一处真实增量。
- **只写 `RoundRecord`，不写 `crash-*.json`**：crash 仍是进程内死亡面（`#reject`）的产物；abort 是引擎外杀进程后的事后折账，两条路径不得混。
- **旧记录无 `dispatchBase`（present facts）**：abort 仍入账，`dispatchBase: null`；组基线退回更早的有值记录（与今日「记录无 base」同语义，不发明 base）。
- 效果：组基线回到被杀那一轮之前，恢复提交落在 base 之后，重派看得见（#431②）；pending-fix 仍读「未完成」，同命令可重跑，但账本现在有记录说明为什么。
- 不变：`Ledger#pendingFix` 的派生规则骨架不动（cycle 身份加完成集），abort 只补事实；唯一允许的派生读面扩展在 §2.3（跳过 superseded）。
- 不提升未完成的草稿：草稿留在盘上作 postmortem，轮次的结论仍只由 bookkeep 落账的轮次说话（进程在 bookkeep 前死掉，等于该轮无结论）。

#### 2.3 外部改设计的 reopen（严格条件）

- 允许条件，三条同时成立：① 该行 `reviewGate` 为 `open`（doc 已 drift）；② 该行处于 `pending-fix`；③ 该行没有在飞轮次（in-flight free，或已被本命令接管）。
- 动作顺序钉死：先分配下一 review cycle `N+1`（`N` = 最新 completed review 的 cycle），再给旧 review（cycle `N`）打 `supersededBy: { cycle: N+1; cause: "recover" }`，然后派 cycle=`N+1` 的 review。**不**写出假的 completed fix；fix 身份仍与其请求方 review 同 cycle（D28 身份不变）。
- **派生读面扩展的精确落点**：`#pendingFix`（`session/ledger.ts`）与 `lineRoute`（同文件）选取「最新 completed review」时跳过带 `supersededBy` 的记录；两者是「fix 是否仍被欠着」的唯一判据，改了它们，`--recover` 后 review 才真能派发。**共享助手的第三、四读者（`#rowClosed` 与波行闭合判定）不改**：闭合是账本全序事实，supersede 不得让一条已闭合的线看起来还开着。
- 记账：`supersededBy` 落在被取代的那条 `RoundRecord` 上；不进 `progress.json` 的固定键集。
- 不允许：无条件 reopen（条件未满足的调用一律 BLOCKED）；用 reopen 绕过 fix（P24 的 fix 自产 drift 判定不动）。

#### 2.4 完成判据换代理

- `CommitsSinceGroupBase` 的放行条件扩为：组内自基线以来有提交，或本轮为验证型且证据绿。
- 验证型由计划声明派生，不看 diff。`CompletionContext` 新增两个只读 provider cell，均由 `CliLifecycle` 填入，判据本身不读盘：
  - `emptyFileTasks: ReadonlySet<number>`——该 wave 中 `Files` 为空的 task id 集；
  - `evidenceOk: boolean`——本轮 `test-evidence.json` 已通过既有 `HandoffSchema` 证据校验（lifecycle 证据门已判过，不二次读盘）。
- **wave 为验证型** ⟺ 该 wave 的**每一个** task id 都 ∈ `emptyFileTasks`（全集空，不是「至少一个空」）。`Files` 何为空：解析后字段无路径 token（空值 / 仅空白 / 缺字段皆空；字面 `(none)` 若出现也算空）。
- 放行：验证型 ∧ `evidenceOk`；`Files` 非空的零 diff 仍 BLOCKED。不放宽 commit 判据本身，只加一个 OR 分支。
- 组基线语义不动（`groupBaseOf` 仍取组内最早 `dispatchBase`）。

#### 2.5 disposition 主键引擎化

- review materialize 时由引擎按 findings 序写入稳定 `id`（`F1`、`F2` 依此类推），写进 carrier；`FINDING` 声明增 `id`（read-back 要求存在，且引擎是唯一作者：子代理写的值被 materialize 覆盖，与既有 reserved-key 丢弃同一条纪律）。
- `FixDispositions` 的键集改为请求方 carrier 的 `id` 集；`summary` 降为说明文本，不再参与匹配。
- 失败报文同打两侧差集：carrier 有而 disposition 缺（missing）与 disposition 有而 carrier 无（unknown），各带 id 与 summary 首句，让一次失败即可行动。
- 兼容：旧 carrier 无 `id` 时退回 summary 匹配并记一条 soft 观察（present facts only），不迁移历史 carrier。

#### 2.6 change-history 与版本头的读面硬化

- 行：行集只有一个来源 —— 表格解析出的表体行（mdast/GFM 单一解析模型，手写行扫描零参与）；表体行的列数与表头不一致时不算 lineage 行，并作为一条 shape finding 报一次（折行续行即此形态），不得静默丢弃。
- 版本：只读首列并锚定 `^v\d+\.\d+$` 匹配 —— 行内任意位置出现的版本号不再算数（折行续行于是也不再冒充 lineage 行）。
- 新增不变量 `change-history-latest-matches-front-matter`：front-matter `version:` 必须等于 lineage 中最新（数值最大）的版本；落后或超前都红，报错点名两端。
- fix 模板（`render/templates.ts` 的 docs-fix 变体）同步两句：追加 change-history 行必须同步 bump front-matter `version:`；表格单元格不得硬折行（折行续行会落成错列的表体行）。

#### 2.7 已关闭波的 finding 路由（文字面）

- 落点钉死（仓库无 `cdd-review` skill）：引擎评审 prompt 轴（`render/templates.ts` 的 plan / spec 变体）与 `cdd-plan` 的 fix 节点各加一句——finding 落在已关闭 task 块的内容面时，要求改文档去对齐已交付切分，禁止把工作搬进或搬出已关闭任务；评审不得提出改写历史切分的 finding。
- 引擎侧不做分类：finding 的 `section` 不保证可解析到 task 块，本相位不引入 finding 路由表，也不新增派发分支。
- 附 pin（模板与 skill 文本子串）。

### 3. 非目标

- 不拆契约与台账两份工件（#437 以 D81 裁定关闭）；不把免审区扩到 task 交付标记。
- 不做 `--diff-since` 增量评审读面，不加 finding 的 `origin` 标注（#431③ 以 D81 裁定关闭）。
- 不迁移历史 `progress.json`、历史 carrier、历史 `brief_hash`。
- 不把 implement 的组基线改成「相对本 attempt」的判据（D81 ③）。
- **判收敛主线零改（硬底线）**：blocker / warn / nit 分级 → Loop 还是收敛，这条方法论主轴（D70）本相位不得触碰——`NextStepRouter` 的闭合判定、`#blockerCount`、`REVIEW_CYCLE_CAP`、next-loop / architecture 孪生门、finding severity 词表与 rollup 规则，全部字节级保留；本相位的 abort / reopen / 完成判据 / finding id / change-history 硬化都不准改写「有 blocker 推回 fix、仅 warn/nit 收敛、全空通过」的转移表。发现冲突即回填 overall 再继续，不得就地改主线。
- 无新 CLI 动词；`--steal-stale` 硬切；changeset minor；不发布。

### Acceptance criteria

- **abort 入账**：陈旧 in-flight 夹具下 `--recover` 落一条 abort `RoundRecord`（`targetAction` 为 false、cause 为 `interrupted`、携带该轮 `dispatchBase`），同 slug 的下一轮随后可派发；恢复提交（落在 abort 轮 base 之后、重派 base 之前）能通过完成判据 —— 行为 pin 钉在「组基线读被杀轮 base」。
- **recover 的拒绝面**：既无陈旧 in-flight、也无 drift 且 pending-fix 时，`--recover` BLOCKED，报文同时点名两个缺失条件。
- **reopen**：drift 且 pending-fix 的夹具下 `--recover` 后 `review` 可派发，新 review cycle 为旧 review cycle 加一，旧轮被标 superseded；新 review 的 fix 身份仍与该 review 同 cycle。
- **`--steal-stale` 退役**：帮助面、拒绝语、capsule、words 表零 `--steal-stale` 字面；同位置出现 `--recover`（grep pin 加行为 pin）。
- **零 diff 验证型**：wave 内每个 task 的 `Files` 皆空且 `evidenceOk` → 通过并带 soft 观察；`Files` 皆空但证据缺失或违约 → 仍 BLOCKED（既有证据门）；任一 task `Files` 非空的零 diff → 仍 `committed nothing`（既有判据不动，成对 pin）。
- **finding id**：review materialize 的 carrier 每条 finding 带稳定 id，序即 carrier 序；fix 的 dispositions 以 id 为键，改写 summary 不再产生 unknown；两侧差集同现于一次失败报文。
- **旧 carrier 无 `id`**：present-facts 路径退回 summary 匹配，且记一条 soft 观察（colocated pin：软观察缺失即红）；历史 carrier 零迁移、零改写。
- **change-history**：折行续行（列数与表头不一致的表体行）不产生第二个 lineage 行，且只报一条 shape finding（折叠夹具 pin，反向 pin：静默丢弃即红）；header 停在旧版本而追加新行 → 新不变量红；header 等于最新行 → 绿；docs-fix 变体含「同步 bump front-matter」与「单元格不得硬折行」两句（子串 pin）。
- **已关闭波纪律**：`render/templates.ts` 评审轴与 `cdd-plan` fix 节点含对应句（子串 pin）；引擎侧零新增 finding 路由分支（结构性 pin）。
- **判收敛主线**：既有 next-loop / architecture 孪生门与 `NextStepRouter` 相关 pin 全绿、零字节改动（结构性 pin）。
- `pnpm run validate` exit 0；changeset `cdd-engine` minor；不发布；#431 / #436 / #437 / #443 各得终态（其中 #437 与 #431③ 以 D81 裁定关闭，无代码改动）。

## Constraints

- 零模块级裸函数；改动落在既有的类面（`InFlight`、`Ledger`、`CommitsSinceGroupBase` 与 `FixDispositions`、`HandoffSchema`、不变量族、`face/words.ts` 报文表、`face/declare.ts` 旗标表、`render/templates.ts`）。
- 不新增 CLI 动词；`--recover` 取代 `--steal-stale`，pin 整体重锚属于本相位的 deliberate break。
- `progress.json` 的固定键集不动；新增事实只落 `RoundRecord` 与 `InFlightRecord` 两处已有记录面。
- 波宽不超过 3。
- **判收敛主线零改（硬底线 · 与 §3 同文）**：blocker / warn / nit → Loop / 收敛 / 通过的转移表、`NextStepRouter` 闭合判定、`#blockerCount`、`REVIEW_CYCLE_CAP`、next-loop / architecture 孪生门，本相位字节级保留；D70 方法论主轴不得被本相实现反向推翻。发现冲突即回填 overall 再继续，不得就地改主线。
- D81 的记录裁定不得被本相实现反向推翻（发现冲突即回填 overall 再继续）。
- 每条 AC 必须有 colocated pin；无 pin 的声称视为未交付（D75 纪律）。

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-11-08 | 初版：病根五条（账本只认识跑完的轮次 · pending-fix 压过 drift 且无出口 · commit 代理干完活 · disposition 以散文为主键 · change-history 读面过松）· 裁定七条（`--recover` 一词收两面 · abort 入账 · 严格 reopen · 完成判据加证据分支 · finding 主键归引擎 · 版本头交叉校验 · 已关闭波纪律落写作面）· 非目标与验收 | [human] 裁定 · Claude（kairos:cdd-design · 2026-11-08） |
| v0.2 | 2026-11-08 | 自检补洞：① `#pendingFix` 跳过 `supersededBy` + reopen 动作序（先分 `N+1` 再盖戳再派）；② 完成判据双 cell（`emptyFileTasks` + `evidenceOk`）与「wave 内每个 task 皆空」；③ abort/reopen 腿的动词与行种触发面钉死；④ §2.7 落点改为 `render/templates.ts` + `cdd-plan`；⑤ §1.5 病根改为「折行不以竖线起首却进了行集」；⑥ abort 不写 crash、旧记录无 `dispatchBase` 的 present-facts 语义、`Files` 空判定；⑦ **判收敛主线零改**升为 §3 与 Constraints 硬底线（D70） | [human] 裁定 · Claude（kairos:cdd-design · 2026-11-08） |
| v0.3 | 2026-11-08 | 评审回填（phase-spec-review-1）：① §2.2 的 cause 陈述改为「向既有 `CrashCause` 联合新增一个字面 `interrupted`」——原「既有字面面」不实；② §2.6 行集判据改为「表体行 + 列数须与表头一致，不一致只报一条 shape finding」，版本读面保留 `^v\d+\.\d+$` 锚定，fix 模板增「单元格不得硬折行」；③ §2.5 旧 carrier 无 `id` 的 soft 观察补 AC 与 pin，不许计划静默丢弃；④ 已关闭波纪律的回填已在 overall v3.41 落定（提交 `04b123a4`），本相位 spec 与 overall 一致 | Oscaner M. · Claude（kairos:cdd-dev · docs-fix · 2026-11-08） |
