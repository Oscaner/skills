---
title: 引擎文档工具（Engine Doc-Tooling）— P29 计划：闭合 wave 不追溯 briefDrift + `brief-drift` 拆词/诊断同源 + issue related 形状门
doc-type: plan
version: v0.4
date: 2026-11-07
slug: 2026-10-10-engine-doc-tooling-p29
base: develop
---

## Constraints

- **逐字取 spec**：本计划只实现 `docs/kairos/specs/2026-10-10-engine-doc-tooling-p29-design.md` **现行 `version`**（v0.1）所指的面；spec 版本一变，本约束的字面同笔改。
- **child brief 仍含 Constraints**：`BriefRenderer#render` 对派发 child 的字节不得删掉 `## Constraints`；与 hash 投影分离。
- **旧 `brief_hash` 不迁移**：无读写时静默 rebase、无一次性迁移命令。
- **D76 保持**：plan 正文投影漂移仍重开 branch（`doc-drift` · `next: review --type branch`）；既有 P22 T17 族行为不得被本相拆掉。
- **判收敛主线零改**：`NextStepRouter#close` / `#blockerCount` / `REVIEW_CYCLE_CAP` / next-loop 孪生门零重锚。
- 无新 CLI 动词 / 旗标；changeset `@oscaner-skills/cdd-engine` **minor**；不发布。
- 零模块级裸函数；波宽 ≤ 3：本计划分层 W1={1,3} · W2={2}。

## Review Focus

- **hash 与 render 双轨不同步**：若 child 路径也误切到 task-only，Constraints 从 child 消失——必须有 pin 钉住 `render` 仍含 Constraints 段。
- **闭合过滤漏进 `briefDrifted`**：若把「闭合 ⇒ false」写进谓词，会抹掉可观测事实并污染未来读者——过滤只许在 `#waveStation`。
- **upstream 仍挂 frontier hop**：只改 reason 词却保留 `next: review --type branch`，自指僵局仍在。
- **`gate.drift` 继续吞并 brief**：`#reasonOf` 若仍 `review && gate.drift → doc-drift`，拆词名存实亡。
- **related 只 warn / 仍 exit 0**：与 spec「同级 exit 1」冲突。
- **D76 误伤**：闭合过滤或拆词改写把 plan→branch 重开腿弄坏。
- **Task 2 红测恒绿**：Task 1 落地后仅改 `## Constraints` 已使 `briefDrifted` 为 false；用「改 Constraints / 陈旧 hash」作闭合站红测夹具会恒绿，必须以**闭合波 Task 段陈旧**为夹具。
- **诊断只落一半**：「P22 T17 仍绿」只证明 doc 漂移行为不破，不证明诊断字段存在；若只给 `brief-drift` 分支加 `layer/line/recorded/current`，各条「仍绿」断言照样通过。doc 侧必须有独立红测钉诊断。

### Task 1: brief-revision 只 hash task 正本

#### Objective

把 wave 的 reopen 指纹从「完整 brief（task + Constraints）」收窄为 **task 正本**；`BriefRenderer#render` 对 child 仍输出 Constraints。`Ledger#briefRevision` / `#briefRevision` / `briefDrifted` 走 task-only 投影。旧 hash 不迁。

#### Files

- Modify: `packages/cdd-engine/src-next/render/brief.ts`（新增 task-only 投影面；`render` 语义保持）
- Modify: `packages/cdd-engine/src-next/session/ledger.ts`（`#briefRevision` / `recordReviewedBrief` 注释与调用改走 task-only 投影；`briefDrifted` 谓词签名不变）
- Test: `packages/cdd-engine/src-next/render/__tests__/render.test.ts` 或 colocated brief 测（Constraints 仍在 `render` 输出）
- Test: `packages/cdd-engine/src-next/session/__tests__/ledger.test.ts`（P24 T3 `briefDrifted` 族：仅改 Constraints ⇒ false；改本波 Task 段 ⇒ true）

#### Consumes

- `BriefRenderer#render` / `#extract` / `PlanTaskBlocksReader#section`
- `ReviewRefs#briefRevision` / `Ledger#briefDrifted` / `#briefRevision`

#### Produces

- `BriefRenderer` 上单源 **task-only** 投影（建议名 `taskBody` / `renderTasks`——实现自定，但必须是 `render` 与 hash 共用的 task 段拼装，禁止第二份切片逻辑）
- `Ledger#briefRevision` 对投影结果做 `ReviewRefs#briefRevision`；`render(...)` 仍 = task 段 + Constraints
- colocated pins：① `render` 输出含 Constraints 标题/正文；② 同 Task、只改 Constraints → `briefDrifted` false；③ 改该波 Task 段 → true

#### Steps

- 写失败测：同 wave 绑定 brief 后只改 plan 的 `## Constraints`，断言 `briefDrifted` 仍为 false（红在今日 true） — checkable: 定向 vitest 该用例 FAIL，失败信息指向 briefDrifted===true 或等价
- 写失败测：`render` 在含 Constraints 的 plan 上输出仍包含 Constraints 段 — checkable: 若实现误删，该测 FAIL
- 实现 task-only 投影；`#briefRevision` 改 hash 该投影；`render` 继续附加 Constraints — checkable: 上两测 PASS；既有 brief 提取测全绿
- 补「改 Task 段 ⇒ drift」回归（若 P24 T3 已覆盖则重锚期望）— checkable: 定向 vitest PASS
- 提交 — checkable: `git log -1 --oneline` 含本任务主题

#### Acceptance

- child 路径 `BriefRenderer#render` 仍含 Constraints；hash/`briefDrifted` 对仅 Constraints 变更不漂移、对 Task 段变更漂移；由上述 pins 钉住。

#### DependsOn

none

### Task 2: `#waveStation` 闭合不追溯 + `brief-drift` 拆词/next 同源 + 强制诊断

#### Objective

① `#waveStation` 只对**未落入** `closedWaves()` 的 batch 读 `briefDrifted`。② reason 表增加 `brief-drift`；文档 revision 继续 `doc-drift`。③ wave brief 漂移拒下游时，`reason=brief-drift` 且 `next` 指向 `graph.batches()` 中第一个「未闭合且 drifted」batch 的 wave review——**不得**再把 pipeline frontier 的 branch hop 挂到 brief 原因上。④ 拒绝语对 `brief-drift`/`doc-drift` 打印 layer · line key · recorded/current hash。⑤ board 与 dispatch 同源 station 读（同一夹具不再互斥）。⑥ D76 行为保留。

#### Files

- Modify: `packages/cdd-engine/src-next/session/next.ts`（`DISPATCH_REASON` / `NEXT_HOP_REASON` + `#reasonOf`：brief 与 doc 分流；`gate` 输入不得再把 brief 吞进 doc-drift）
- Modify: `packages/cdd-engine/src-next/session/dispatch-authority.ts`（`#waveStation` 过滤闭合 batch；`#upstreamLeg` 在 wave brief 漂移时组装 `brief-drift` + wave-review `next`；`message` 附诊断）
- Modify: `packages/cdd-engine/src-next/session/ledger.ts` / `session/pipeline.ts` / `session/run.ts`（若 `NextHopInput.gate` 需区分 `docDrift`/`briefDrift` 字段——按最小改动拆；route 替换仍只由**文档** drift 驱动）
- Modify: `packages/cdd-engine/src-next/face/cli.ts`（若诊断行需在 `#renderLineRefusal` 加明细通道——与 `authority.message` 单源，禁止第二套文案）
- Create: `.changeset/p29-brief-drift-and-related-gate.md`（front matter 行 `"@oscaner-skills/cdd-engine": minor`）
- Test: `packages/cdd-engine/src-next/session/__tests__/dispatch-authority.test.ts`（重锚既有「closed wave with a moved brief」夹具：闭合波 **Task 段**陈旧不挡 branch；open 波 Task 漂移 → brief-drift + wave next；诊断串 **两半**——brief 侧 open-Task 漂移拒，doc 侧既有 stale-plan-identity `doc-drift` 拒）
- Test: `packages/cdd-engine/src-next/session/__tests__/next.test.ts` / `ledger.test.ts`（reason token 分流）
- Test: `packages/cdd-engine/src-next/face/__tests__/board-view.test.ts` · `cli.test.ts`（原 wave `reason: doc-drift` 夹具重锚为 `brief-drift`；board↔dispatch 成对；P22 T17 doc-drift·branch 仍绿）

#### Consumes

- Task 1 的 task-only `briefDrifted` 语义
- `DispatchAuthority#waveStation` / `#upstreamLeg` / `message`
- `PipelineFrontier#hopOf` · `Ledger#closedWaves` · `TaskGraph#batches`
- `DISPATCH_REASON` / `NEXT_HOP_REASON` / `NextStepRouter#reasonOf`

#### Produces

- `#waveStation`：`batches().some(batch => !closed.hasAll(batch) && briefDrifted(key))`（闭合判定与 `closedWaves()` 同源）
- `DISPATCH_REASON.briefDrift = { token: "brief-drift", leg: "station" }`（或等价登记）；`NEXT_HOP_REASON.briefDrift` 同源
- upstream wave drift 拒绝：`reason: brief-drift`，`next` 可渲染为 `review --type wave --tasks <first-drifted-open-batch> --plan …`
- `message(...)`（或拒绝对象的诊断字段）在 brief/doc 漂移时含 `layer=` · `line=` · `recorded=` · `current=`（hash 至少稳定前缀）
- doc 侧诊断读源：行键取文档路径（`docs/kairos/plans/…` 一族），recorded = `Ledger#reviewedDocRevisionOf(key).doc_hash`，current = `ReviewRefs#docRevision(doc, content).doc_hash`——与 brief 侧同一诊断字段形状，禁止两套键名
- pins：闭合波 **Task 段**陈旧不挡 branch（既有「closed wave with a moved brief」夹具重锚为 allowed；仅改 `## Constraints` 已不构成漂移，只作 Task 1 pin 与合流后绿测，不作本站红测）；open Task 漂移 brief-drift+wave next；诊断子串 **两半**（`brief-drift` 拒含 `layer=brief` · batch key · 双 hash 前缀；既有 upstream `doc-drift` 拒含 `layer=doc` · 文档行键 · 双 hash 前缀）；board/dispatch 成对；D76/P22 T17 仍绿；原「wave reason doc-drift」夹具改锚 brief-drift
- changeset `.changeset/p29-brief-drift-and-related-gate.md`：`@oscaner-skills/cdd-engine` minor，叙述覆盖 task-only brief hash · 闭合站过滤 · `brief-drift` 词与同源 next · 强制诊断 · related 形状门

#### Steps

- 写失败测（红）：重锚既有「closed wave with a moved brief」夹具——全 wave 已闭合 + 该 batch 的 Task 段（Acceptance/正文）改写使 task-only `brief_hash` 陈旧后，`verdict(branch review)` 仍 allowed — checkable: 今日 upstream `doc-drift` 拒 → FAIL；`#waveStation` 滤闭合后 PASS。前置断言 `briefDrifted` 为 true——只改 `## Constraints` 的夹具在 Task 1 后恒绿，禁用
- 写失败测：一未闭合 batch Task 漂移后拒 branch，`reason==="brief-drift"` 且 message/next 含该 batch 的 wave review 字面 — checkable: 今日 reason 为 doc-drift 或 next 为 branch → FAIL
- 写失败测：上述 `brief-drift` 拒绝 message 含 layer/line/recorded/current（或规范键名）— checkable: FAIL until 诊断落地
- 写失败测（**doc 侧独立红测**，不得以「P22 T17 仍绿」代替）：既有 upstream `doc-drift` 拒绝——`dispatch-authority.test.ts` 的 stale-plan-identity 用例（`docs/kairos/plans/p3.md` 一族）或 `cli.test.ts` P22 T17 branch 重开——其 message/诊断字段含 `layer=doc`（或规范键名）、该文档行键、recorded/current hash 前缀 — checkable: 今日拒绝语仅 `doc-drift · next: …`（或 `doc-drift · next: review --type branch`）→ 断言 FAIL until doc 侧诊断落地；只在 brief 分支加诊断时本测仍 FAIL
- 扩展 reason 表 + 拆 `#reasonOf` / gate 输入；改 `#waveStation` 与 `#upstreamLeg` next 组装；message 附诊断 — checkable: 上列测 PASS（含 brief 与 doc 两条诊断测）
- 重锚 board/cli 中 wave brief 的 `doc-drift` 期望为 `brief-drift`；跑 P22 T17 branch doc-drift 夹具确认仍绿 — checkable: 定向 vitest PASS
- board↔dispatch 成对夹具（仅闭合 Task 段陈旧）— checkable: 两者都不以漂移拒 branch / 或以同一 token 同意开放
- 建 changeset（`Create` 行）：front matter `"@oscaner-skills/cdd-engine": minor`，叙述覆盖 task-only brief hash · 闭合站过滤 · `brief-drift` 词与同源 next · 强制诊断 · related 形状门（Task 3 已在 W1 落地，可一并叙述）— checkable: `pnpm exec vitest run scripts/__tests__/changeset-levels.test.ts` PASS（level 非空、无 major）
- 提交 — checkable: `git log -1 --oneline` 含本任务主题

#### Acceptance

- spec §2.1–§2.7 与 AC 中 brief/branch 相关条全部由本任务 pins 覆盖；D76 不破。
- spec §2.5 诊断条由**两条**红测共同钉住：`brief-drift` 侧（open Task 漂移）与 `doc-drift` 侧（既有 upstream / P22 T17 夹具）各自断言 layer · 行键 · recorded/current；「P22 T17 仍绿」仅证明行为不破，不算诊断覆盖。
- AC 的 changeset 条有归属：`.changeset/p29-brief-drift-and-related-gate.md` 随本任务落地（minor）。

#### DependsOn

1

### Task 3: `issue render` related 只认嵌套

#### Objective

`IssueBodyRenderer#validateInput` 对出现的 `related` 做与 findings 同级的形状校验：必须为非 null 非数组对象；`open`/`closed`/`program` 字段形态对齐 `IssueReportInput`；平铺数组或其他形状 → 错误列表含字段路径；CLI `issue render` 据此 **exit 1**。合法嵌套与缺省 `related` 行为不变。

#### Files

- Modify: `packages/cdd-engine/src-next/render/issue-body.ts`（`validateInput` 增 related 腿：非 null 非数组对象 · `open`/`closed` 元素形状 · `program.issue:number`）
- Test: `packages/cdd-engine/src-next/render/__tests__/render.test.ts`（平铺数组 / `null` / 字符串 → `related` 路径错误；`related.open[i]`/`related.closed[i]` 坏元素与 `related.program` 缺 `issue` → 嵌套路径错误；合法嵌套零 related 错误；渲染回归仍绿）
- Test: `packages/cdd-engine/src-next/face/__tests__/cli.test.ts`（复用既有「issue render — malformed / invalid input exits 1 with the field path」通道：平铺 `related` → exit 1 且 stderr 含 `related`；合法嵌套 → exit 0 且 Related 区渲染）

#### Consumes

- `IssueReportInput.related` 类型
- `IssueBodyRenderer#validateInput` / `#renderBody`

#### Produces

- related 校验错误形如 `related: …` / `related.open[i].…`（与 findings 路径风格一致）
- pins：平铺 / `null` / 非对象 → 非空 errors 且路径以 `related` 起头；`related.open[i]` / `related.closed[i]` 元素坏或 `related.program` 缺 `issue:number` → 嵌套路径错误；嵌套合法 → 无 related 错误且 Related 区仍渲染；缺省 related → 无错误；CLI 侧 exit 1 与 exit 0 成对钉住

#### Steps

- 写失败测：`related: [{ issue: 1 }]`（平铺）→ `validateInput` 含 `related` 路径错误 — checkable: 今日 errors 不含 related → FAIL
- 写失败测：`related: null` 与非对象（如 `"x"`）→ 同一 `related` 路径错误；`related.open[0]` 缺 `component`/`reason`、`related.closed[0]` 非对象、`related.program` 缺 `issue:number` → 嵌套路径错误 — checkable: 今日三者 errors 均为空 → FAIL
- 写 CLI 失败测（必做，非「若」）：沿 `face/__tests__/cli.test.ts` 既有 invalid-input exit 1 通道，stdin 送平铺 `related` → `runArgv(["issue","render"])` 为 1 且 stderr 含 `related` — checkable: 今日为 0 → FAIL
- 实现校验腿（路径风格对齐 `findings[i].type`，不新造通道）— checkable: 上列测全 PASS；嵌套合法 + 缺省 related 仍 exit 0 且 Related 区渲染
- 提交 — checkable: `git log -1 --oneline` 含本任务主题

#### Acceptance

- spec §2.8 与 related AC 由 pins 钉住。

#### DependsOn

none

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-11-07 | 初版：三任务 W1={1,3}·W2={2}——task-only brief hash · station 过滤+brief-drift/next/诊断/D76 · related 严校验 | [human] 裁定 · Claude（kairos:cdd-plan · 2026-11-07） |
| v0.2 | 2026-11-07 | plan-review-1 收口：② 闭合站红测改用「闭合波 Task 段陈旧」夹具（Constraints-only 在 Task 1 后恒绿）· ③ changeset minor 归属 Task 2 的 Create+Step · ④ Task 3 补齐 related 非对象/嵌套路径错误与 CLI exit 1 必做 pin | [human] 裁定 · Claude（kairos:cdd-fix · 2026-11-07） |
| v0.3 | 2026-11-07 | plan-review-2 收口：Task 2 补 doc 侧诊断红测（既有 upstream / P22 T17 `doc-drift` 夹具断言 `layer=doc` · 文档行键 · recorded/current 前缀）· Produces 增 doc 诊断读源 pin · Acceptance 明确 §2.5 由 brief/doc 两条红测共同钉住（「T17 仍绿」不算诊断覆盖） | [human] 裁定 · Claude（kairos:cdd-fix · 2026-11-07） |
| v0.4 | 2026-11-07 | **closeout 登记（cdd-close）**：三任务全交付，W1={T1,T3} · W2={T2} 各 implement→review→fix 闭合；分支终审 2 findings 闭合。任务 1 = task-only brief hash（`taskBody`）+ child 仍收 Constraints；任务 3 = related 嵌套严校验 + CLI exit 1；任务 2 = `#waveStation` 闭合过滤 · `brief-drift` 拆词 · 首漂移 batch 的 wave `next:` · 强制诊断 · board↔dispatch 同源 · D76 保留。`pnpm run validate` exit 0（engine 1425 tests）| Oscaner M. · Claude（kairos:cdd-close · closeout-backfill · 2026-11-07） |
