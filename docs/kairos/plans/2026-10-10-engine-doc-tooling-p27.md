---
title: 引擎文档工具（Engine Doc-Tooling）— P27 计划：派发权威收口
doc-type: plan
version: v0.3
date: 2026-11-06
slug: 2026-10-10-engine-doc-tooling-p27
base: develop
---

## Constraints

- **逐字取 spec**：本计划只实现 `docs/kairos/specs/2026-10-10-engine-doc-tooling-p27-design.md` **现行 `version`**（v0.2）所指的面；spec 版本一变，本约束的字面同笔改。
- **判收敛主线一字不动（硬约束，spec §4）**：`NextStepRouter#close`（`session/next.ts:300`）· `#blockerCount`（`:306`）· `REVIEW_CYCLE_CAP`（`:65`，值 50）· 软上限阈值与 `soft-cap` 触发条件，一行不改；`Route` 六种 kind 与派生顺序不改；`scripts/__tests__/next-loop-twin.test.ts` 与引擎侧 Loop-vs-converge 转移表 pin **零重锚**。
- **判据语义逐条等价**：wave 五行（`mixed-batch` · `wave-too-wide` · `too-many-tasks` · `split` · `wrong-phase`）与 doc/branch 四条只换宿主与输出通道；任何行为差异都是缺陷。
- **既有 token 拼写保留**：合表只加 `leg` 字段，`NEXT_HOP_REASON` 的既有拼写（`doc-drift` · `pending-fix` · `closed-line` · `face-closed` · `soft-cap` · `task-open` · `doc-class-blocked`）一个不改，不另立并行拼写；结构门沿用既有 gate id（tree-clean 等），不新造 token。
- **不动的面**：`PIPELINE_FACES`（`next.ts:127`）的顺序与成员 · `PIPELINE_NEXT` 的交棒目标 · `PipelineKey`（`:90`）/ `PhaseFaceKey`（`:121`）的既有区分 · overall 不进上游腿 · 无新命令/旗标/环境变量 · 不回流 `progress.json`。
- **不改 D30 的 brief 投影**：wave 的已审身份仍是渲染 brief 的指纹（plan 里不涉及本波任务段的改动不作废已审 wave）；leg U **只读** live 事实——`briefDrifted`（`ledger.ts:1023`）与 `closedWaves()`（`ledger.ts:1124`）——不重写投影、不改指纹口径。
- **只拒不记账**：announce 上游陈旧时**不**顺手触发复评——派发门只拒，不动账本：不开评审轮、不推进 `progress`、不改任何轮数。
- **波宽 ≤ 3**：本计划三任务链式 `DependsOn`（1 → 2 → 3），每层 1 个任务。
- **changeset**：`@oscaner-skills/cdd-engine` **minor**（拒绝行为与报文形状可见变化）。
- **零模块级裸函数**：`DispatchAuthority` 与规则表写成类/常量；静态面带 biome-ignore 与一行理由。

## Review Focus

- **收敛转移表**：任何一条 Loop-vs-converge 行为因「换宿主」而变（尤其 `soft-cap` 提前/延后、fix 后是否进 re-review）——这是本相位最容易误伤的地方。
- **混合批与追加路径**：`mixed-batch` 的静态批次判据含「plan 追加过 → 放行」的 `planTasks` 快照腿——写侧是 `Ledger#recordPlanTasks`（`ledger.ts:864`），读侧是 `WaveGate#appendedSinceClosure`（`wave.ts:204`，读 `row.planTasks`），改写宿主时最容易丢。
- **宽度两条**：`wave-too-wide`（派生宽度）与 `too-many-tasks`（请求宽度）是**两条不同**的拒绝，不可合并。
- **上游腿的面序**：身份面是槽位，`single-spec` 与 `phase-spec` 同属第 0 面；只按面键读会漏掉 `single-spec`。
- **结构拒无 next**：`leg === "structure"` 时报文只能是 `reason · ` + 既有 message，不得凭空造 `next:`。
- **陈旧但不触 brief**：上游 plan 只改了别处任务段时仍要拒（spec §2.3 的裁定 (a)），不得用 `briefDrifted` 放行。

### Task 1: reason 表合一 + `leg` 分区（零行为）

#### Objective

把 `WaveGateReason`（5）与 `NEXT_HOP_REASON`（7）并成一张带 `leg` 分区的表，新增 `unchanged` token；既有拼写、报文词与判收敛主线一字不动。

#### Files

- Modify: `packages/cdd-engine/src-next/session/next.ts`（`NEXT_HOP_REASON` 旁新增分区/并表后的单一词表类型）
- Modify: `packages/cdd-engine/src-next/session/wave.ts`（`WaveGateReason` 改为引用同一张表的分区行）
- Test: `packages/cdd-engine/src-next/session/__tests__/next.test.ts`（表逐行 pin）· 既有 `wave.test.ts` 零重锚仍绿

#### Consumes

- `NEXT_HOP_REASON`（`session/next.ts:164`）· `WaveGateReason`（`session/wave.ts:44`）

#### Produces

- 一张带 `leg` 分区的 `DispatchReason` 词表（13 个非结构 token：wave 5 · doc/branch 4（含新增 `unchanged`）· 站牌 4），既有拼写逐字保留。
- **两个 `leg` 不是同一个枚举，别混用**：token 行的 `leg` 只有 `"structure" | "line" | "station"` 三值（spec §2.5 的分区）；`DispatchVerdict` 的 `leg` 是裁定腿 `"structure" | "upstream" | "line"` 三值（spec §2.1）。上游拒**复用**站牌/行那侧的既有 token（`doc-drift` · `task-open` · `pending-fix` 等），**不给词表加 `upstream` 分区行**，也不新铸 `upstream` 专用 token。
- `WaveGateReason` 成为该表中 `leg: "line"` 的 wave 五行视图（类型层收窄，词不变）。

#### Steps

- [ ] **Step 1: 写红 pin** — checkable: 新用例按**拼写逐一点名** 13 个 token（wave 5 · doc/branch 4 含 `unchanged` · 站牌 4），每个都带 `leg` 且落在 `structure`/`line`/`station` 之一，并断言沿用既有结构 gate id；**不断言「13 行」**（同一张表还带结构分区行）；今日无该表 ⇒ 红
- [ ] **Step 2: 建表** — checkable: 表落 `session/next.ts`（与 `NEXT_HOP_REASON` 同址，单一来源），每行 `{ token, leg }`；既有 7 个拼写逐字保留
- [ ] **Step 3: wave 五行走视图** — checkable: `WaveGateReason` 由表派生（`leg: "line"` 的 wave 五行），`wave.ts` 内不再手写第二份字面量
- [ ] **Step 4: 回归** — checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/session/__tests__/wave.test.ts src-next/session/__tests__/next.test.ts` 全绿；`next-loop-twin` 仍绿
- [ ] **Step 5: 提交** — checkable: commit `refactor(cdd-engine): one reason table with a leg partition`

#### Acceptance

- 13 个 token **按拼写逐个** pin（不按行数计）+ `leg` 分区逐行 pin（仅 `structure` / `line` / `station` 三值）；`unchanged` 在册；既有 7 个拼写一字不改（每个一条断言）；结构分区沿用既有 gate id、无 `upstream` 分区行。
- `WaveGateReason` 从表派生；`wave.ts` 零第二份字面量（源码 pin）。
- 本任务零行为变化：`wave.test.ts` 与收敛转移表 pins 一行不改仍绿。

#### DependsOn
none

### Task 2: `DispatchAuthority` + leg L 入表 + 删两个平行调用点（行为保持）

#### Objective

建裁决对象并让 leg L 承载本行相位（wave 五行 + doc/branch 四条），把 `preflight.ts:299` 与 `cli.ts:764` 两个调用点收成一处；报文统一 `reason · next:`。

#### Files

- Create: `packages/cdd-engine/src-next/session/dispatch-authority.ts`
- Modify: `packages/cdd-engine/src-next/session/preflight.ts`（`:299` 的 `WaveGate.vet` 调用移出）
- Modify: `packages/cdd-engine/src-next/face/cli.ts`（`:764` 的 `lineGate` 调用改为读 authority）
- Modify: `packages/cdd-engine/src-next/face/gate.ts`（`lineGate` 保留为行事实读面，不再是独立权威）
- Test: `packages/cdd-engine/src-next/session/__tests__/dispatch-authority.test.ts`

#### Consumes

- Task 1 的 `DispatchReason` 表 · `WaveGate.vet`（`wave.ts:88`）· `Ledger#reviewGate`（`ledger.ts:934`）/ `docReopens`（`:1311`）/ `linePhase`（`:1209`）/ `lineRoute`（`:1187`）/ `waveLineRoute`（`:964`）· `PipelineFrontier#hopOf`（`pipeline.ts:132`）

#### Produces

- `DispatchAuthority.verdict(request): DispatchVerdict`，`DispatchVerdict` 形状按 spec §2.1（`{ allowed }` | `{ allowed: false, leg, reason, next }`）。
- 优先级实现：结构 → 上游（Task 3 落地前为恒空）→ 本行；短路只报一条。
- 统一报文：`reason · next: ` + 渲染命令；`leg === "structure"` 时 `reason · ` + 既有 message。
- 派发门（`cli.ts`）与 capsule/board 同读 `hopOf` 输出。

#### Steps

- [ ] **Step 1: 写行为 pin（现状全绿）** — checkable: **九条拒绝面各一条用例**——wave 五条 `mixed-batch` · `wave-too-wide` · `too-many-tasks` · `split` · `wrong-phase`，doc/branch 三条 `pending-fix` · `unchanged`（same-revision）· `face-closed`，外加 drift 重开 → **允许** 一条；每条断言改前改后**同一条 reason**（改前绿、改后仍绿，且改后走的是新对象）；`wave-too-wide` 与 `too-many-tasks` 各一条、不得互相顶替
- [ ] **Step 2: 建 authority + leg S** — checkable: 结构门（tree/in-flight/base · graph/plan-ledger/doc-contract）判据沿用既有实现，只经 authority 汇出
- [ ] **Step 3: leg L 入表** — checkable: wave 五行作为规则表行插入，判据体从 `wave.ts` 迁入（`WaveGate.vet` 退化为该 leg 的内部实现或并入）；doc/branch 四条与 wave 五行同形
- [ ] **Step 4: 删两个调用点** — checkable: `preflight.ts` 不再出现 `WaveGate.vet` 调用；`cli.ts` 不再直接调 `lineGate` 作为权威（源码 pin：两处出现数为 0）；派发门读 `authority.verdict`
- [ ] **Step 5: 报文统一** — checkable: 三个读面同形（派发门 stderr / capsule / board），`reason · next:` 逐字 pin；结构拒无 `next:`
- [ ] **Step 6: 回归** — checkable: 引擎全套绿；`preflight.test.ts` / `gate.ts` 相关用例按新通道重锚但**断言语义不变**；收敛转移表 pins 零重锚仍绿
- [ ] **Step 7: 提交** — checkable: commit `refactor(cdd-engine): one dispatch authority over the line phase`

#### Acceptance

- 权威只剩一处：两个旧调用点的出现数为 0；派发门 / capsule / board 读同一 verdict（跨面 pin）。
- 五条 wave 拒绝与 doc/branch 四条的行为逐条等价（改前改后同一 reason 的用例对）。
- 报文形状 `reason · next:` 逐字 pin；结构拒无 `next`。
- 收敛转移表 pins 与 `next-loop-twin` 零重锚仍绿。

#### DependsOn
1

### Task 3: leg U 上游站牌（行为变化：本相位的目的）

#### Objective

让「上游没复评完」真正挡住下游派发：按 `PIPELINE_FACES` 派生上游面，逐面按 spec §2.3 的两条判据裁决——① **reviewed identity 陈旧**（doc 面 `reviewGate(...).kind === "open"`，wave 面 `briefDrifted(waveKey)`）⇒ 拒 `doc-drift`；② **该面未对请求面闭合**（doc 面 `lineStateAt(...) !== "closed"`，wave 面 `PipelineFrontier#wavesExhausted` 为 false，判据集是 `ledger.closedWaves()`）⇒ 拒，理由取该面 `hopOf` 的输出（通常 `task-open` / `pending-fix`）。两条都带出该面的 `next:`。`waveLineRoute !== null` **不是**闭合判据。

#### Files

- Modify: `packages/cdd-engine/src-next/session/dispatch-authority.ts`（leg U）
- Test: `packages/cdd-engine/src-next/session/__tests__/dispatch-authority.test.ts`（红/绿各面）· `packages/cdd-engine/src-next/face/__tests__/cli.test.ts`（端到端一条）

#### Consumes

- `PIPELINE_FACES`（`next.ts:127`）· 身份面的声明词（`specType`）· `PipelineFrontier#hopOf`（`pipeline.ts:132`）
- 判据 ①：`Ledger#reviewGate`（`ledger.ts:934`）· `Ledger#briefDrifted`（`ledger.ts:1023`）
- 判据 ②：`Ledger#lineStateAt`（`ledger.ts:1164`）· `PipelineFrontier#wavesExhausted`（`pipeline.ts:279`）读 `ledger.closedWaves()`（`ledger.ts:1124`）

#### Produces

- leg U：请求面索引 i ⇒ 上游 = 面序前 i 项；每面两条判据（① 陈旧 ⇒ `doc-drift`；② 未闭合 ⇒ 该面 `next:` 的理由）；命中即拒并带出该面 `next:`。
- 优先级：结构 → 上游 → 本行。
- 只拒不记账：拒时不开评审轮、不写账本、不改任何轮数。

#### Steps

- [ ] **Step 1: 写红 pin（今日必红）** — checkable: plan 行的 reviewed identity 陈旧（`reviewGate("plan", planPath, "plan").kind === "open"`）时 `implement --tasks …` 应被拒（今日派发成功 ⇒ 红），期望 `leg: "upstream"` · `reason: "doc-drift"` · 报文点名 `review --type plan`
- [ ] **Step 2: 实现 leg U** — checkable: 按面序派生、身份面按 `specType` 取行键；`overall` 不在面序、不计入；两条判据都读 live 事实（`reviewGate` / `briefDrifted` / `lineStateAt` / `#wavesExhausted`），**不读 `waveLineRoute !== null` 作闭合判据**（面未进入时 `#waveState.active` 本就是 null）；命中即拒并带 `next`
- [ ] **Step 3: 各面红 pin** — checkable: spec 陈旧挡 plan review（①）· plan 陈旧挡 wave 派发（①，wave 面读 `briefDrifted`）· wave 未对 branch 面闭合挡 branch review（②，`#wavesExhausted` 为 false）；身份面两种声明（`single-spec` / `phase-spec`）各一条
- [ ] **Step 4: 「闭合但漂移」红 pin** — checkable: 波的任务全 done（`#wavesExhausted` 为真）但 `briefDrifted(waveKey)` 为真 ⇒ branch review 仍被拒，`reason: "doc-drift"`（由 ① 判，不由 ② 判）
- [ ] **Step 5: 绿 pin** — checkable: 上游两判据全清 + 本行相位正确 ⇒ 派发照旧（既有 happy path 用例不重锚）
- [ ] **Step 6: 端口一条** — checkable: `cli.test.ts` 端到端一条：`implement` 被拒时 stderr 为 `reason · next: …` 且退出码非零
- [ ] **Step 7: 只拒不记账 pin** — checkable: 上游拒一次后，`progress.json` 与账本轮数/评审轮数**零变化**（拒绝路径不触发复评），源码 pin：拒分支内无 ledger 写方法
- [ ] **Step 8: 收敛面复核** — checkable: 收敛转移表 pins 与 `next-loop-twin` 仍绿；`soft-cap` 触发条件零变化
- [ ] **Step 9: 提交** — checkable: `validate` 全绿；changeset `cdd-engine` minor（若 T2 未建则本任务建）；commit `feat(cdd-engine): an open upstream station refuses downstream dispatch`

#### Acceptance

- spec 的 8 条 Acceptance 全绿（红 pin 今日必红 → 改后转绿；绿 pin 零摩擦；权威单点；13 个 token 逐拼写 + `leg` 分区；五行等价；各面上游红 pin 含两种 spec 声明；判收敛主线零变化（`#close` / `#blockerCount` / `REVIEW_CYCLE_CAP` 与 Loop-vs-converge 转移表、`next-loop-twin` 零重锚）；validate + minor changeset），外加「闭合但漂移仍拒」与「只拒不记账」两条 pin。
- 上游腿只按 spec §2.3 的两条判据裁决：① identity 陈旧（`reviewGate` / `briefDrifted`）· ② 未闭合（`lineStateAt` / `#wavesExhausted`）；`waveLineRoute !== null` 不作判据。
- 收敛主线零变化（§4 的硬约束在验）。

#### DependsOn
2

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-11-06 | 初版：三任务链式（T1 词表合一·零行为 → T2 authority + leg L·行为保持 → T3 leg U·行为变化），把 spec 的 13 行表、优先级、面序派生与收敛冻结拆成三步可独立评审的交付 | Claude（本会话 cdd-plan） |
| v0.2 | 2026-11-06 | 按首轮计划评审更正内容面：T3 上游判据改回 spec §2.3 的 ① identity 陈旧（`reviewGate` / `briefDrifted`）与 ② 未闭合（`lineStateAt` / `#wavesExhausted`），点名 `waveLineRoute !== null` 不是判据，并补「闭合但漂移」红 pin；T2 Step 1 拒绝面补全为五行 + doc/branch 四条 + drift 重开放行；T1 的 token `leg` 收为 `structure`/`line`/`station`（与 verdict 腿 `upstream` 区分）、口径改为 13 个 token 按拼写；Constraints 补「只拒不记账」及对应 pin；Review Focus 更正 `recordPlanTasks` / `appendedSinceClosure` 归属 | Claude（本会话 · docs-fix） |
| v0.3 | 2026-11-06 | 按第二轮计划评审补两条内容面：Constraints 补「不改 D30 的 brief 投影」（wave 已审身份仍是渲染 brief 指纹，leg U 只读 `briefDrifted` / `closedWaves()`）；T3 Acceptance 的 spec 条数由 7 更正为 8，并把「判收敛主线零变化」补进枚举 | Claude（本会话 · docs-fix） |
