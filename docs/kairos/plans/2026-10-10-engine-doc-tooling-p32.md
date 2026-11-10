---
title: 引擎文档工具（Engine Doc-Tooling）— P32 计划：已审版本写回的相位判别
doc-type: plan
version: v0.1
date: 2026-11-10
slug: 2026-10-10-engine-doc-tooling-p32
base: develop
---

## Constraints

- **逐字取 spec**：本计划只实现 `docs/kairos/specs/2026-10-10-engine-doc-tooling-p32-design.md` **现行 `version`** 所指的面；spec 版本一变，本约束的字面同笔改。
- **判收敛主线零改（D70）**：`session/next.ts` 零字节 diff；`NextStepRouter`、`#blockerCount`、`REVIEW_CYCLE_CAP`、next-loop / architecture 孪生门字节级保留。
- **不回退 #446**：`fix` 相位的 `touchedDoc` 三态（`true` 绑当前 / `false` 保持旧绑定 / `null` 绑当前 + 一条 soft / `undefined` 默认绑）逐条保住，P31 的四个用例原样通过。
- **事实层不动**：`face/lifecycle.ts#touchedDocOf` 的 `dispatchBase..HEAD` 读面保持现状；本相只改「谁受它支配」。
- **不加门**：不引入「完成 review 必须有身份落账」的 hard 门（P28 同向）。
- **`progress.json` / `RoundRecord` 形状不动**：本相不新增任何持久键。
- 零模块级裸函数；新判定落 `session/reviewed-identity.ts`（与 `legOf` 同栖）。
- changeset 只 `@oscaner-skills/cdd-engine` **patch**；不发布；波宽 ≤ 3。

## Review Focus

- **修法把 review 变成无条件绑、顺手把 fix 的 #446 洞打开**：两处共用一个 `legOf` 调用点，若把条件写成 `phase !== "fix" || touchedDoc !== false` 之外的形状（例如直接删掉 `touchedDoc` 判断），P31 的四条 fix 用例会红——成对 pin 必须同时存在。
- **`branch-review` 被漏掉**：它的腿是 `branch`（绑 plan 文档），若判定只按 `review` 字面排除，branch 行仍会卡在 `reopened`。
- **夹具构造在「本轮改写文档」上**：本条缺陷的成因正是「P31 三条 pin 全在改写夹具上」，新 pin 必须让 review round **不写文件**且 `touchedDoc: false`，否则测的是别的东西。
- **带 finding 的 review 也要绑**：只测 APPROVED 会漏掉 CHANGES_REQUESTED 分支——而那正是 `fix→review` 链条的入口。
- **`undefined`（注入式 dispatcher）被误判成 `false`**：注入面不提供 `touchedDoc`，若实现把 `undefined` 归并到 `false`，所有既有注入式 pin 会静默失效。
- **闭环的第二次派发**：只断言 `reviewedRevision` 更新不够，必须断言「同一行不再被派 review」——字段对了但路由仍循环同样是缺陷。

---

### Task 1: 写回判据的相位分治与正交 pin

#### Objective

把 P31 的条件写回按相位分治：`fix` 继续受 `touchedDoc` 支配，`review` / `branch-review` 结论完成即绑当前字节。判定落 `ReviewedIdentity`（与 `legOf` 同栖），`#bookkeep` 只读它。附一条「已绑定 → 轮外改动 → review(touchedDoc:false) → 闭合」的正交 pin，以及带 finding 与 branch-review 两条旁证 pin。

#### Files

- Modify: `packages/cdd-engine/src-next/session/reviewed-identity.ts`（新增 `gatedByTouchedDoc(phase)`）
- Modify: `packages/cdd-engine/src-next/session/run.ts`（`#bookkeep` 的写回门读新判定）
- Test: `packages/cdd-engine/src-next/session/__tests__/reviewed-identity.guard.test.ts`（逐相位表 pin）
- Test: `packages/cdd-engine/src-next/session/__tests__/run.test.ts`（P31 T6 块旁追加三例）

#### Consumes

- `ReviewedIdentity.legOf(phase, kind)` / `REVIEWED_WRITE_PHASES`（`session/reviewed-identity.ts`）
- `#bookkeep` 现有的 `record.verdict.targetAction` 门与 `outcome.touchedDoc` 三态
- P31 T6 的既有夹具：`fixture()` · `stub()` · `docOf()` · `stub(reviewScript(...))`

#### Produces

- `ReviewedIdentity.gatedByTouchedDoc(phase: RoundPhase): boolean` — `true` 仅当 `phase === "fix"`；其余（含 `review` / `branch-review` / `implement`）为 `false`
- `#bookkeep` 的写回门 = `record.verdict.targetAction && (!gatedByTouchedDoc(phase) || outcome.touchedDoc !== false)`

#### Steps

- 写失败测（逐相位表）：`gatedByTouchedDoc` 对 `fix` 为 `true`，对 `review` / `branch-review` / `implement` 为 `false` — checkable: 定向 vitest FAIL（方法不存在）
- 写失败测（核心正交面）：一行先经 review 绑定 → 轮外改写文档（`docLineVerdict` 转 `drift`、`lineStateAt` 转 `reopened`）→ 派一轮 review 且 `touchedDoc: false` 且**不写文件** → 断言 `reviewedDocRevisionOf` 等于该轮审过的正文修订、`docLineVerdict` 为 `same`、`reviewGate.kind` 为 `same`、`lineStateAt` 为 `closed`；再断言同一行下一次 `advance()` 不再派 review — checkable: 定向 vitest FAIL（今日 binding 不动、判据全停在 drift/open）
- 写失败测（旁证两条）：① 带 finding 的 review（CHANGES_REQUESTED）且 `touchedDoc: false` 仍绑，随后 fix 改写文档使 `docLineVerdict` 回到 `drift`；② branch 行在 `touchedDoc: false` 的 branch-review 完成后其 `reviewedRevision` 被更新 — checkable: 两条各自 FAIL
- 在 `session/reviewed-identity.ts` 实现 `gatedByTouchedDoc`（一行返回 `phase === "fix"`，注释写明「判据分治的依据是该相位是否被期望改写它判定的文档」）— checkable: 逐相位表 PASS，`pnpm exec tsc --noEmit -p packages/cdd-engine` exit 0
- 改 `#bookkeep` 的写回门接新判定（旧注释改写为相位分治的表述，保留 `null` 的 soft 与 `undefined` 的默认绑定）— checkable: 核心正交面 + 两条旁证 PASS，且 P31 的四条 fix 用例（true / false / null / undefined）全部保持绿
- 提交 — checkable: `git log -1 --oneline` 含本任务主题

#### Acceptance

- 核心正交面：已绑定行 → 轮外改动 → `review(touchedDoc:false)` → `reviewedRevision` 更新、`docLineVerdict` `same`、`reviewGate` `same`、`lineStateAt` `closed`，且下一次派发不再指向该行的 review。
- `gatedByTouchedDoc` 逐相位表：仅 `fix` 为 `true`。
- `fix` 侧四态零回归（P31 T6 用例原样通过，含 `null` 的 soft 观测与 `undefined` 的默认绑定）。
- 带 finding 的 review 仍绑；branch-review 同判。
- `session/next.ts` 零字节 diff。

#### DependsOn

none

---

### Task 2: changeset 与全门

#### Objective

为恢复被误窄的既有语义落一个 **patch** changeset，并跑通完整校验门。

#### Files

- Create: `.changeset/p32-write-back-phase-discrimination.md`

#### Consumes

- `.changeset/README.md` 的级别规则（D74：方法论未变 ⇒ 本次为 patch）
- Task 1 的实现面

#### Produces

- changeset：`"@oscaner-skills/cdd-engine": patch` + 三句（相位分治的判定 · 恢复 review/branch-review 的完成即绑 · #446 的 fix 侧语义不变）

#### Steps

- 写 changeset（`patch` + 三句，点名 `gatedByTouchedDoc` 与恢复的行为）— checkable: `pnpm exec vitest run scripts/__tests__/changeset-levels.test.ts` PASS（无 major、级别齐备）
- 跑全门 — checkable: `pnpm run validate` exit 0（root · kairos · engine · typecheck ×3 · version-sync · emit fresh · 零裸函数）
- 提交 — checkable: `git log -1 --oneline` 含本任务主题

#### Acceptance

- `pnpm run validate` exit 0。
- changeset 为 `patch`，无 `major`。
- `pnpm run emit:check` 无 drift。

#### DependsOn

1

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-11-10 | 初版：两任务（相位分治判定 + 正交 pin / patch changeset 与全门）· Review Focus 六条（fix 侧回归 · branch-review 漏判 · 夹具构造在改写上 · 带 finding · `undefined` 归并 · 路由仍循环） | Claude（kairos:cdd-plan · 2026-11-10） |