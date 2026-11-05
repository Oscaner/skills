---
title: 引擎文档工具（Engine Doc-Tooling）— P25 计划：写回判定的单源
doc-type: plan
version: v0.1
date: 2026-11-05
slug: 2026-10-10-engine-doc-tooling-p25
base: develop
---

## Constraints

- **逐字取 spec**：本计划只实现 `docs/kairos/specs/2026-10-10-engine-doc-tooling-p25-design.md` **现行 `version`**（v0.3）所指的面；spec 版本一变，本约束的字面同笔改。
- **纯重构**：任何消费面字节变化都是越界。`preview.test.ts` 的五条 `would record:` 断言（`:79` · `:101` · `:122` · `:144` · `:162`）**一行不改**即证据。
- **判定必须纯**：`legOf` 不读账本、不读文件、不接 verdict、不接 plan path——只凭 `(phase, kind)` 回答。
- **参数类型不得放宽**：`phase: RoundPhase`（`session/ledger.ts:71` = `OpType | "branch-review"`）· `kind: AuditTarget["kind"]`（`session/run.ts:73-80`）。**禁用 `TargetType`**（它没有 `spec` 成员，会诱出第二张 type → 腿映射表）。
- **未列出的 kind 一律 `null`**：目标联合将来长出新成员时两面同一方式「不写」，绝不落成一次 doc 写回。
- **两处不对称保留并登记，不「修正」**：① `targetAction` 是真跑独有 ② `wave` + `planPath === null` 时真跑不写、预览仍陈述 `reviewedRevision(brief)`。两者都是既有且被字节冻结的行为。
- **结构门必须可红且必须写具体**：禁用「全仓字面量计数」（会自匹配门自身的 pattern 串与 docstring）。三条门按 spec §3 的定义写。门**只**覆盖 `face/preview.ts` 与 `session/run.ts`；`run.ts:844` 的 `phase === "branch-review"`（相位归一，无关）**不计入**。
- **诚实标注门的限度**：换个写法（`includes([...])` / `Set` / 单引号）的副本会绕过字面量门；本相位不加更强的静态分析，限度写进注释。
- **零新依赖 / 零新命令 / 零环境变量**；changeset `@oscaner-skills/cdd-engine` **patch**（纯重构，D74 方法契约不变）。

## Review Focus

- **两面同值但未来只改一面**：矩阵用例（`phase × kind × planPath`，两侧都不许走 `legOf`）——左取 `Preview#render` 的 `would record:` 行，右取真跑后的账本 ref kind。
- **只有一份但两面没调它**：三条结构门（调用门 / 白名单消失门 / 声明单源）；门②今日必红（两文件各一处白名单）。
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
- Test: `packages/cdd-engine/src-next/session/__tests__/reviewed-identity.guard.test.ts`（新增，三条门）

#### Consumes

- `RoundPhase`（`session/ledger.ts:71`）· `AuditTarget`（`session/run.ts:73-80`）· `Ledger#recordReviewedRevision` / `recordReviewedBrief`（既有，签名不动）

#### Produces

- `type ReviewedLeg = "doc" | "brief"`
- `REVIEWED_WRITE_PHASES: readonly RoundPhase[]`（判定文件内**唯一**声明）
- `ReviewedIdentity.legOf(phase: RoundPhase, kind: AuditTarget["kind"]): ReviewedLeg | null`

#### Steps

- [ ] **Step 1: 写三条门（先红）** — checkable: 门②「`frame.phase === "branch-review"` 在两文件的出现数为 0」今日 FAIL（实测 `preview.ts:159` 与 `run.ts:747` 各一处）；门①③今日亦 FAIL（`legOf(` 不存在、`REVIEWED_WRITE_PHASES` 不存在）
- [ ] **Step 2: 建判定文件** — checkable: `reviewed-identity.ts` 含 `ReviewedLeg` · `REVIEWED_WRITE_PHASES`（`review` / `branch-review` / `fix`）· `legOf`；类上带 `// biome-ignore lint/complexity/noStaticOnlyClass: <理由>`（先例 `faces.ts` 的 `TargetFaceTable`），并一句话写明「为什么是类而非箭头常量对象」；旁注写明两处不对称
- [ ] **Step 3: 记账侧迁移** — checkable: `run.ts:746-752` 改为 `record.verdict.targetAction && (leg = ReviewedIdentity.legOf(frame.phase, frame.target.kind)) !== null` 随后按 `leg` 分派到既有三个 `#record…` 方法；三个方法本体**不动**（它们做写，不做判定）
- [ ] **Step 4: 预览侧迁移** — checkable: `preview.ts:159` 的 phase 白名单与 `:172-178` 的 kind 三分支改为调 `legOf`，随后按返回的 `leg` 渲染 `reviewedRevision(doc|brief)`；`branch` 的 null-plan-path 守卫**保留**（输入，不是判定）
- [ ] **Step 5: 改写陈旧 docstring** — checkable: 三处不再声称「a SECOND copy … kept apart on purpose」（`preview.ts:147-158` · `:165-171` · `run.ts:726-745`），改为「判定在 `ReviewedIdentity.legOf`，两面共用；`targetAction` 与 plan path 是两面各自的输入」
- [ ] **Step 6: 三条门转绿 + 限度注释** — checkable: `reviewed-identity.guard.test.ts` 三条全绿；注释写明「字面量门挡不住换写法的副本」
- [ ] **Step 7: 字节零变** — checkable: `preview.test.ts` 五条 `would record:` 断言**一行不改**仍绿；`pnpm -C packages/cdd-engine exec vitest run src-next` 全绿
- [ ] **Step 8: 提交** — checkable: `pnpm run precommit` 绿；`git commit -m "refactor(cdd-engine): one home for the write-back judgment"`

#### Acceptance

- 三条结构门存在且**门②在改动前必红**（今日两文件各一处白名单）。
- `#bookkeep` 与 `#recordsOf` 都调 `ReviewedIdentity.legOf`；两文件再无 phase 白名单字面量。
- `legOf` 是纯函数：不读账本 / 文件 / verdict / plan path。
- 五条既有 `would record:` 断言零改动仍绿（纯重构判据）。
- 三处陈旧 docstring 不再声称有两份。
- `pnpm run precommit` 绿。

#### DependsOn

none

### Task 2: 三轴矩阵 + 两处不对称的显式断言 + changeset

#### Objective

证明「两面同值」而不依赖 `legOf`，并**钉住**两处既有不对称（不修正它们），最后落一条 patch changeset。

#### Files

- Test: `packages/cdd-engine/src-next/face/__tests__/preview.test.ts`（矩阵用例；既有五条断言不动）
- Test: `packages/cdd-engine/src-next/session/__tests__/run.test.ts`（真跑后的账本 ref kind 侧）
- Create: `.changeset/p25-one-write-back-judgment.md`

#### Consumes

- `Preview#render(op, frame)`（`preview.test.ts` 既有做法）· `Ledger#reviewedDocRevisionOf` / `reviewedRevisionOf`（既有）· `Lifecycle`（既有）

#### Produces

- 无代码导出；测试矩阵与发行条目。

#### Steps

- [ ] **Step 1: 写矩阵（行为面）** — checkable: 对 `phase ∈ {implement, review, branch-review, fix} × kind ∈ {wave, branch, plan, spec} × planPath ∈ {present, null}` 逐格：左侧取 `Preview#render` 的 `would record:` 行里的 `reviewedRevision(doc|brief)`（或「无腿」），右侧取真跑一轮后账本的 `reviewedDocRevisionOf(...)` / `reviewedRevisionOf(...)` 的 `kind`（或 `null`）；**两侧都不许调用 `legOf`**
- [ ] **Step 2: 登记并断言两处不对称** — checkable: ① `targetAction === false`（BLOCKED）时真跑不写而预览陈述腿——一条断言钉住 ② `wave` + `planPath === null`：真跑账本无写回、预览仍陈述 `reviewedRevision(brief)`——一条断言钉住；两者都写明「这是既有行为，本相位不修正」
- [ ] **Step 3: 未列出的 kind 保守链** — checkable: 断言未来成员的 kind 在 `legOf` 返回 `null`（用类型层或一条显式断言），绝不落成 doc 写回
- [ ] **Step 4: changeset** — checkable: `.changeset/p25-one-write-back-judgment.md` front-matter 为 `"@oscaner-skills/cdd-engine": patch`，正文说明「纯重构：写回判定收成一处纯判定，消费面字节零变」
- [ ] **Step 5: 全量验收** — checkable: `env -u AI_AGENT pnpm run validate` 退出码 0
- [ ] **Step 6: 提交** — checkable: `git commit -m "test(cdd-engine): pin the two write-back faces to one judgment"`；`git status --porcelain` 为空

#### Acceptance

- 矩阵覆盖 `4 phase × 4 kind × 2 planPath`，两侧均不经 `legOf`；改动前后**同值**（今日两面恰好一致，故它是防「未来只改一面」的回归 pin，不是必红）。
- 两处既有不对称各有一条断言钉住，且注释写明「不修正」。
- 未列出的 kind 落 `null`（保守链）。
- changeset 为 `patch`。
- `env -u AI_AGENT pnpm run validate` 退出码 0。

#### DependsOn

1

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-11-05 | 初稿：两任务两波——T1 判定本体 + 两调用点迁移 + 三条结构门（门②今日必红）· T2 三轴矩阵（两侧不经 `legOf`）+ 两处不对称钉住 + patch changeset | Oscaner M. · Claude（kairos:cdd-plan · 2026-11-05） |