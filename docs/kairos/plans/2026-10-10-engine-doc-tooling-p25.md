---
title: 引擎文档工具（Engine Doc-Tooling）— P25 计划：写回判定的单源
doc-type: plan
version: v0.2
date: 2026-11-05
slug: 2026-10-10-engine-doc-tooling-p25
base: develop
---

## Constraints

- **逐字取 spec**：本计划只实现 `docs/kairos/specs/2026-10-10-engine-doc-tooling-p25-design.md` **现行 `version`**（v0.4）所指的面；spec 版本一变，本约束的字面同笔改。
- **纯重构**：任何消费面字节变化都是越界。`preview.test.ts` 的五条 `would record:` 断言（`:79` · `:101` · `:122` · `:144` · `:162`）**一行不改**即证据。
- **判定必须纯**：`legOf` 不读账本、不读文件、不接 verdict、不接 plan path——只凭 `(phase, kind)` 回答。
- **参数类型不得放宽**：`phase: RoundPhase`（`session/ledger.ts:71` = `OpType | "branch-review"`）· `kind: AuditTarget["kind"]`（`session/run.ts:73-80`）。**禁用 `TargetType`**（它没有 `spec` 成员，会诱出第二张 type → 腿映射表）。
- **腿名与写方法 1:1**：`ReviewedLeg` = `doc` · `brief` · `branch`，各自一一对应 `#recordReviewedDocRevision`（`plan` / `spec` 共用，doc 路径从 `frame.target.doc` 取）· `#recordReviewedWaveBrief` · `#recordReviewedBranchRevision`（读 `#planPath`）。故记账侧是按腿派发的 1:1，`#bookkeep` 里**不再残留任何 kind 分支**；`branch` 独享一条腿名，因为它的 plan path 是**输入**而不是判定。
- **未列出的 kind 一律 `null`**：目标联合将来长出新成员时两面同一方式「不写」，绝不落成一次 doc 写回。
- **两处不对称保留并登记，不「修正」**：① `targetAction` 是真跑独有 ② `wave` + `planPath === null` 时真跑不写、预览仍陈述 `reviewedRevision(brief)`。两者都是既有且被字节冻结的行为。
- **结构门必须可红且必须写具体**：禁用「全仓字面量计数」（会自匹配门自身的 pattern 串与 docstring）。三条门按 spec §3 的定义写，并照 D26 先例（`session/__tests__/wave-line-phase.guard.test.ts`）**锚到调用方法体**：调用门取 `#bookkeep`（`run.ts`）与 `#recordsOf`（`preview.ts`）的方法体切片，不取全文件——否则一句新 docstring 就满足它。白名单消失门**只**扫 `face/preview.ts` 与 `session/run.ts`；`run.ts:844` 的 `phase === "branch-review"`（相位归一，无关）**不计入**。声明单源门**只**扫 `session/reviewed-identity.ts`，且两个消费者文件里 `REVIEWED_WRITE_PHASES` 的出现数必须为 0（它们只调 `legOf`，不碰白名单）。
- **诚实标注门的限度**：换个写法（`includes([...])` / `Set` / 单引号）的副本会绕过字面量门；本相位不加更强的静态分析，限度写进注释。
- **零新依赖 / 零新命令 / 零环境变量**；changeset `@oscaner-skills/cdd-engine` **patch**（纯重构，D74 方法契约不变）。

## Review Focus

- **两面同值但未来只改一面**：矩阵用例（`phase × kind × planPath`，只覆盖**可达格**，两侧都不许走 `legOf`）——左取 `Preview#render` 的 `would record:` 行，右取真跑后的账本 ref kind；两侧**共用一张期望表**（单一 oracle），落在**同一个**测试文件里。
- **只有一份但两面没调它**：三条结构门（调用门 / 白名单消失门 / 声明单源）；门②今日必红（两文件各一处白名单），门①③也锚在方法体与单个新文件上，不靠全文件散匹配。
- **判定自身的不变式**：`REVIEWED_WRITE_PHASES` × 每个 kind 的返回值逐格，以及未列出的 kind 与 `implement` 一律 `null`——这两条是**运行时断言**（类型层不会把测试变红），落在 T1 的门测试里。
- **wave + 无 plan path 的既有不对称**：真跑不写、预览陈述 brief 腿——不得当成失败去「修」，必须单列一条断言把它**钉住**。
- **未列出的 kind**：不得落成 doc 写回（保守链）。
- **陈旧 docstring**：`preview.ts:147-158`（「a SECOND copy… kept apart on purpose」）· `:165-171`（`#reviewedLegOf` 链描述）· `run.ts:726-745`（phase 门内联叙述）——改完必须不再声称有两份。

### Task 1: `ReviewedIdentity.legOf` + 两个调用点迁移 + 三条结构门

#### Objective

把「这一轮/这个 target 写不写、写哪条腿」收成一处纯判定，让 `#bookkeep` 与 `#recordsOf` 都调它；两面各自的 phase 白名单字面量与 kind 三分支消失。

#### Files

- Create: `packages/cdd-engine/src-next/session/reviewed-identity.ts`
- Modify: `packages/cdd-engine/src-next/session/run.ts`（`:746-752` 写回白名单 + kind 三分支；`:726-745` 的内联叙述注释）
- Modify: `packages/cdd-engine/src-next/face/preview.ts`（`:159` phase 白名单；`:172-178` `#reviewedLegOf`；`:147-158` 与 `:165-171` 的 docstring）
- Test: `packages/cdd-engine/src-next/session/__tests__/reviewed-identity.guard.test.ts`（新增：三条结构门 + `legOf` 的运行时单元 pin）

#### Consumes

- `RoundPhase`（`session/ledger.ts:71`）· `AuditTarget`（`session/run.ts:73-80`）· `Ledger#recordReviewedRevision` / `recordReviewedBrief`（既有，签名不动）
- **两个类型必须以 `import type` 取**：`session/run.ts` 反向 import `ReviewedIdentity`，值导入会把 `reviewed-identity.ts` → `run.ts` → `reviewed-identity.ts` 变成运行时静态环（`RoundPhase` 从 `ledger.ts` 取同样走 `import type`）。

#### Produces

- `type ReviewedLeg = "doc" | "brief" | "branch"`——三值与三个 `#record…` 方法**1:1**：`doc` → `#recordReviewedDocRevision` · `brief` → `#recordReviewedWaveBrief` · `branch` → `#recordReviewedBranchRevision`
- `REVIEWED_WRITE_PHASES: readonly RoundPhase[]`（判定文件内**唯一**声明：`review` · `branch-review` · `fix`）
- `ReviewedIdentity.legOf(phase: RoundPhase, kind: AuditTarget["kind"]): ReviewedLeg | null`

#### Steps

- [ ] **Step 1: 写三条门（先红）** — checkable: 门①「调用门」锚在方法体上（照 D26 先例：从方法签名切片到该方法体收尾，再断言切片内含 `ReviewedIdentity.legOf(`）——`session/run.ts` 的 `#bookkeep(frame: OpenFrame, outcome: DispatchOutcome): number {` 与 `face/preview.ts` 的 `#recordsOf(frame: OpenFrame): string {`，故删掉真调用、只留 docstring 时门①**仍红**（今日两处均无调用 ⇒ 今日 FAIL）；门②「白名单消失门」只扫上述两文件，`frame.phase === "branch-review"` 的出现数各为 **0**（今日 `preview.ts:159` 与 `run.ts:747` 各一处 ⇒ **今日 FAIL**；注释里的副本会**误红**而非漏红，方向安全）；门③「声明单源门」只扫 `session/reviewed-identity.ts`，`(export )?const REVIEWED_WRITE_PHASES\b` 的行数 = **1**（今日无此文件 ⇒ 今日 FAIL），另断言两个消费者文件里 `REVIEWED_WRITE_PHASES` 出现数 = 0；用例自带一条自检：门文件自身的源码不在任何一条的扫描范围内（否则 pattern 串会自匹配）
- [ ] **Step 2: 建判定文件** — checkable: `reviewed-identity.ts` 含 `ReviewedLeg`（三值）· `REVIEWED_WRITE_PHASES`（`review` / `branch-review` / `fix`）· `legOf`；类上带 `// biome-ignore lint/complexity/noStaticOnlyClass: <理由>`（先例 `faces.ts:137` 的 `TargetFaceTable`），并一句话写明「为什么是类而非箭头常量对象」；`legOf` **旁边**并列写明**三处**同址事实：① `targetAction` 是真跑独有、不属于判定 ② plan path 是**输入**而非判定（`branch` 因此独享一条腿名）③ `wave` + `planPath === null` 时真跑不写、预览仍陈述 `reviewedRevision(brief)`（既有、本相位保留）；`AuditTarget` / `RoundPhase` 用 `import type` 取
- [ ] **Step 3: 记账侧迁移** — checkable: `run.ts:746-752` 改写为**语句式**（不得写「条件里赋值」——`lint/suspicious/noAssignInExpressions` 会让 `pnpm run precommit` 直接红）：先 `const leg = record.verdict.targetAction ? ReviewedIdentity.legOf(frame.phase, frame.target.kind) : null;`，再 `if (leg !== null)` 按 `leg` 分派（`switch (leg)` 或 `if` 均可）；派发与三个 `#record…` 方法是 **1:1**，`run.ts` 里**不再残留任何 kind 分支**（`#recordReviewedDocRevision` 体内既有的 kind 收窄守卫保留不动——那是写方法自己的防御，不是判定）；三个方法本体**不动**（它们做写，不做判定）
- [ ] **Step 4: 预览侧迁移** — checkable: `preview.ts:159` 的 phase 白名单与 `:172-178` 的 kind 三分支改为 `const leg = ReviewedIdentity.legOf(frame.phase, frame.target.kind)`，`#reviewedLegOf` 退化成「腿 → 字符串」的渲染映射（`doc` / `branch` → `reviewedRevision(doc)`，`brief` → `reviewedRevision(brief)`）；`branch` 的 `#scene.planPath === null` 守卫**保留**在渲染映射里（那是输入，不是判定），故五条既有 `would record:` 行的字节不变
- [ ] **Step 5: 改写陈旧 docstring** — checkable: 三处不再声称「a SECOND copy … kept apart on purpose」（`preview.ts:147-158` · `:165-171` · `run.ts:726-745`），改为「判定在 `ReviewedIdentity.legOf`，两面共用；`targetAction` 与 plan path 是两面各自的输入；`wave` + 无 plan path 的不对称仍保留」
- [ ] **Step 6: 三条门转绿 + `legOf` 单元 pin + 限度注释** — checkable: `reviewed-identity.guard.test.ts` 三条门全绿；同文件内加 `legOf` 的**运行时**单元 pin（这是全仓唯一被允许直接调 `legOf` 的测试，不属矩阵）：① `REVIEWED_WRITE_PHASES` 每个成员 × 四个 kind 逐格断言（`wave` → `brief` · `plan` / `spec` → `doc` · `branch` → `branch` · `implement` 全 `null`）② 未列出的 kind（`ReviewedIdentity.legOf("review", "bogus" as never)`）返回 `null`，且 `ReviewedIdentity.legOf("implement", "wave")` 返回 `null`——**必须是 vitest 断言，类型层不算**；注释写明「字面量门挡不住换写法的副本」
- [ ] **Step 7: 字节零变** — checkable: `preview.test.ts` 五条 `would record:` 断言**一行不改**仍绿；`pnpm -C packages/cdd-engine exec vitest run src-next` 全绿
- [ ] **Step 8: 提交** — checkable: `pnpm run precommit` 绿；`git commit -m "refactor(cdd-engine): one home for the write-back judgment"`

#### Acceptance

- 三条结构门存在且**门②在改动前必红**（今日两文件各一处白名单）；门①锚在 `#bookkeep` / `#recordsOf` 的方法体上，门③只扫判定文件，两个消费者文件零 `REVIEWED_WRITE_PHASES`。
- `#bookkeep` 与 `#recordsOf` 都调 `ReviewedIdentity.legOf`；两文件再无 phase 白名单字面量。
- `ReviewedLeg` 三值与三个 `#record…` 方法 1:1，`#bookkeep` 里除 `switch (leg)` 外零 kind 判断。
- `legOf` 是纯函数：不读账本 / 文件 / verdict / plan path；其运行时单元 pin 覆盖 `REVIEWED_WRITE_PHASES` × kind 全格与未列出的 kind（→ `null`）。
- `reviewed-identity.ts` 以 `import type` 取 `AuditTarget` / `RoundPhase`（无运行时静态环）。
- 五条既有 `would record:` 断言零改动仍绿（纯重构判据）。
- 三处陈旧 docstring 不再声称有两份。
- `pnpm run precommit` 绿。

#### DependsOn

none

### Task 2: 三轴矩阵 + 两处不对称的显式断言 + changeset

#### Objective

证明「两面同值」而不依赖 `legOf`，并**钉住**两处既有不对称（不修正它们），最后落一条 patch changeset。

#### Files

- Create: `packages/cdd-engine/src-next/session/__tests__/reviewed-identity.matrix.test.ts`（矩阵 + 两处不对称断言 + `branch` + `planPath: null` 的预览 pin；左右两侧共用**一张**期望表）
- Create: `.changeset/p25-one-write-back-judgment.md`
- 不动: `packages/cdd-engine/src-next/face/__tests__/preview.test.ts`（五条 `would record:` 断言一字不改）与 `packages/cdd-engine/src-next/session/__tests__/run.test.ts`——矩阵**不**落进这两个文件，否则就是两张各写一遍的期望表，把要防的漂移搬进了测试

> spec §4 的测试行把矩阵写在 `preview.test.ts` / `run.test.ts`；本相位按作者裁定（fix 轮 1 · W4/W5）把矩阵收进单个新文件。矩阵的**证据形状**（spec §3：左取预览、右取真跑、两侧不走 `legOf`）不变，变的只是落点；spec 正文除 §2 的腿类型外不动。

#### Consumes

- `Preview#render(op, frame)`（`preview.test.ts` 既有做法：内联 `DispatchScene` + 内联 `OpenFrame`，`planPath` 走 `scene({ planPath: … })`）· `Ledger#reviewedDocRevisionOf` / `reviewedRevisionOf`（既有）· `Lifecycle` + `targetFaces`（`run.test.ts` 既有做法：hermetic 临时 workspace + `planDoc` / `task` / `taskGraph` / `stub`）· `BriefRenderer`（可渲染的 brief 源）

#### Produces

- 无代码导出；测试矩阵、两处不对称断言与发行条目。

#### Steps

- [ ] **Step 1: 写矩阵（行为面，只覆盖可达格）** — checkable: **一张**共享 oracle 表同时驱动左右两侧，表列为 `{ phase, kind, planPath, preview, ledgerKey, ledgerKind }`；`preview` 是**渲染面的词**（`"doc"` / `"brief"` / `null`）：左侧据此断言 `would record:` 行以 ` · reviewedRevision(<preview>)` 收尾（`null` ⇒ 行里无 `reviewedRevision`）；右侧断言 `ledger.reviewedRevisionOf(<ledgerKey>)?.kind === <ledgerKind>`（`doc` / `branch` 腿 ⇒ `"doc-revision"`，`branch` 取 key `branch`；`brief` 腿 ⇒ `"brief-revision"`，取 key `1`；`null` ⇒ 无写回）；doc 格的 `ledgerKey` 是该格所用 face 的 key（`kind: "plan"` → `"plan"`，`kind: "spec"` → `"phase-spec"`）；**两侧都不许调用 `legOf`**。可达格（`implement` 只在 wave 线派发，`branch-review` 只在 branch 线派发）：

  | 相位 | 可达 kind | `planPath` 有 | `planPath` 无 |
  | --- | --- | --- | --- |
  | `implement` | `wave` | 无腿 · 无写回 | 无腿 · 无写回 |
  | `review` | `wave` | `brief` · `brief-revision` | **不对称 ②**：`brief` · 无写回 |
  | `review` | `plan` · `spec` | `doc` · `doc-revision` | 同格（`planPath` 轴对 doc kind 无意义，不重复断言） |
  | `fix` | `wave` | `brief` · `brief-revision` | **不对称 ②**：`brief` · 无写回 |
  | `fix` | `plan` · `spec` | `doc` · `doc-revision` | 同格 |
  | `branch-review` | `branch` | `doc` · `doc-revision` | 无腿 · 无写回（**本相位新增的独立 pin**，断言里显式写 `scene({ planPath: null })`） |
  | `fix` | `branch` | `doc` · `doc-revision` | 无腿 · 无写回 |

  跳过格**按名列出并给原因**，不静默省略：`implement × branch|plan|spec`（`implement` 只在 wave 线派发）· `branch-review × wave|plan|spec`（`branch-review` 只在 branch 线派发）· `plan` / `spec` 的 `planPath` 轴（同格，不重复断言）。
  夹具：wave 格必须给出**可渲染的 plan 与 brief 源**（`planDoc` + `task` + 一个真实存在的 `planPath`，让 `#recordReviewedWaveBrief` 走真写回），否则真跑侧落进「无 plan fact」分支，测的就不是判定；`fix` 格靠 `stub` 让 review 完成轮带一条 `warn` finding，再 `advance()` 到 fix 轮。
- [ ] **Step 2: 登记并断言两处不对称** — checkable: ① `targetAction === false`（`stub` 返回 `BLOCKED`）时真跑不写、预览仍陈述腿——一条断言钉住 ② `wave` + `planPath: null` 是 oracle 表里的一格（`preview: "brief"` · `ledgerKind: null`），另在用例里单列一句断言陈述「预览陈述 brief 腿 · 账本无写回」；两者都写明「这是既有行为，本相位不修正」
- [ ] **Step 3: 未列出的 kind 不建格** — checkable: 矩阵不为目标联合之外的 kind 建格（派发不产生），保守链由 T1 的 `reviewed-identity.guard.test.ts` 用**运行时断言**钉住（`legOf("review", "bogus" as never)` 与 `legOf("implement", "wave")` 均为 `null`），本任务不重复
- [ ] **Step 4: changeset** — checkable: `.changeset/p25-one-write-back-judgment.md` front-matter 为 `"@oscaner-skills/cdd-engine": patch`，正文说明「纯重构：写回判定收成一处纯判定，消费面字节零变」
- [ ] **Step 5: 全量验收** — checkable: `env -u AI_AGENT pnpm run validate` 退出码 0
- [ ] **Step 6: 提交** — checkable: `git commit -m "test(cdd-engine): pin the two write-back faces to one judgment"`；`git status --porcelain` 为空

#### Acceptance

- 矩阵只覆盖上表的**可达格**；跳过格按名列出并给出原因，不再声称「`4 phase × 4 kind × 2 planPath` 逐格」——派发形状由 `faces.ts` 的 `product.reviewLead` 决定，不可达的格在真跑侧根本建不出来。
- 左右两侧共用**同一张**期望表（单文件 `reviewed-identity.matrix.test.ts`），两侧都**不经** `legOf`；改动前后**同值**（今日两面恰好一致，故它是防「未来只改一面」的回归 pin，不是必红）。
- 两处既有不对称各有一条断言钉住（① `targetAction === false` ② `wave` + `planPath: null`），注释写明「不修正」；`branch-review × branch × planPath: null` 一格有独立 pin。
- 未列出的 kind 的保守链由 T1 门测试的运行时断言覆盖（矩阵不重复）。
- changeset 为 `patch`。
- `env -u AI_AGENT pnpm run validate` 退出码 0。

#### DependsOn

1

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-11-05 | 初稿：两任务两波——T1 判定本体 + 两调用点迁移 + 三条结构门（门②今日必红）· T2 三轴矩阵（两侧不经 `legOf`）+ 两处不对称钉住 + patch changeset | Oscaner M. · Claude（kairos:cdd-plan · 2026-11-05） |
| v0.2 | 2026-11-05 | **评审第 1 轮 fix（九条 findings 全接受 · 作者裁定入文）**：① 腿类型三值 `doc`/`brief`/`branch`，与三个 `#record…` 方法 1:1，记账侧不再残留 kind 分支（spec §2 同笔改 v0.4）② Step 3 改语句式，去掉条件内赋值（biome `noAssignInExpressions` 会红）③ 三条门按 D26 锚到 `#bookkeep` / `#recordsOf` 方法体，写明门③只扫判定文件、两消费者文件零 `REVIEWED_WRITE_PHASES` ④⑤ 矩阵改「可达格 + 显式跳格清单 + 单文件单 oracle」，删掉 `4×4×2 = 32 格`算术 ⑥ `legOf` 的运行时单元 pin 落 T1 门测试（含未列出的 kind → `null`）⑦ Step 2 列三处同址事实，plan path 那条写在 `legOf` 旁边 ⑧ `import type` 避开运行时静态环 ⑨ 补文件末尾换行 | Oscaner M. · Claude（kairos:cdd-plan · 2026-11-05） |
