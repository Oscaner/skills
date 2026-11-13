---
title: '引擎文档工具（Engine Doc-Tooling）— P34 计划：轮次产物身份的单射渲染'
doc-type: plan
version: v0.1
date: 2026-11-13
slug: 2026-10-10-engine-doc-tooling-p34
base: develop
---

## Constraints

- **逐字取 spec**：本计划只实现 `docs/kairos/specs/2026-10-10-engine-doc-tooling-p34-design.md` **现行 version v0.3** 所指的面；spec 版本一变，本约束的字面同笔改。
- **单射性是唯一不变量**：条件只允许出现在**渲染的省略**上（`attempt === 1` 不拼 `-a{n}`）；坐标本身恒从身份取，任何「满足某条件才拼坐标」的写法都是 §2.1 的反例。
- **`progress.json` 形状不变**：只停写 `carrierPath` / `draftPath`，不迁移旧值、不加版本标记。
- **不加运行时守护门**：写一次是构造属性；seal 的既有 unseal→写→seal 循环保留，不加「重写即拒」。
- **seal 窗口不扩**：只 `draft` + `final` 两个载体进窗口；`report` / `log` / `evidence` / `crash` 不进。
- **`next:` 字面零变更**（D70）。
- **不动收敛主线（D70）**：`session/next.ts`、`Ledger#nextHopOf`、`NextStepRouter`、`WaveGate` / `DispatchAuthority` 的分级计数与下一跳判定**零改动**——本相位不新增分级信号、不安装「按 route kind 反推」的分支、不改 Loop-vs-converge 的判据面。board 的 `+N` 是**渲染面**（一个计数从哪个产物读），不是分级信号；若某一步看起来必须动下一跳才能完成，停下来上报，不得顺手扩面。
- **不引入新依赖**；changeset 只 `@oscaner-skills/cdd-engine` **minor**；不发布；波宽 ≤ 3；零模块级裸函数。
- **不适用 kind 渲空串**：`evidence` 在四个文档形上渲 `""`，调用方按「无此产物」处理，空串不是名字、不入单射比较。

## Review Focus

- **implement 的 cycle 恒 1 被当成「没有 cycle」**：`CliLifecycle#roundFor` 对该相位返回固定值，最省事的写法就是在渲染处继续省掉 round 令牌——那会让 implement 的五个 kind 依次落回同一格，单射性在 cycle 维度上无声退化。网格 pin 只比较「两个不同身份」，抓不到「所有身份都渲成 cycle 1」。
- **legacy 行的 attempt 缺省读错文件**：由记录反查路径时若把 `attempt` 缺省成 1 而记录实际是 2，会读 attempt 1 的文件、比对 attempt 2 的摘要——假 `carrier-mismatch`，与要治的症状同形。
- **owner 判据拿不到行内全量记录**：`BoardView#findingsCountOf` 是单记录 static，若判定输入退化成「只有这一条」，legacy 行永远判 owner → 老 slug 回到整块拒渲染。
- **seal 窗口与本轮 attempt 不同源**：preflight 打开无 attempt 的名字时，历史那一对在整个窗口内可写。断言面是「attempt-1 的一对在 attempt-2 的窗口内**不可写**」，不是「能写但不该写」。
- **`isCarrierName` 放宽成「任何产物」**：`-report.md` / `.log` / `-test-evidence.json` / `crash-` 四种形状一旦入判定，sweep 会把报告当载体 seal、board 会把崩溃记录当孤儿列出来。

---

### Task 1: 渲染单源 `render(identity, kind)` + 扫描面收窄

#### Objective

把 `RoundNaming` 的名字派发收成一处：身份 `(line, op, cycle, attempt)` × 种类 `kind ∈ {draft, final, report, log, crash, evidence}` → 一个名字。`attempt === 1` 省略 `-a{n}`；`final` 携 `.c{cycle}`；implement 族的每个 kind 都携 cycle；`evidence` 携 op/cycle/attempt。`finalName` / `logName` / `report` / `evidenceName` / `crashName` / `#stem` 的独立拼装全部改由这一处派生，`isCarrierName` 收窄到只认 `draft` / `final` 两种形状。

#### Files

- Modify: `packages/cdd-engine/src-next/session/round-naming.ts`（新增 `RoundArtifact` / `ArtifactKind` 与 `renderName` / `renderPath`；`finalName` / `logName` / `report` / `evidenceName` / `crashName` / `#stem` 改为委派；`isCarrierName` 的 pattern 只认 draft/final 且容 `(?:-a\d+)?`）
- Modify: `packages/cdd-engine/src-next/session/ledger.ts`（`handoffName` / `handoffPath` 委派 `renderName`；`HandoffParams` 补 `attempt?: number`；`families` 占位替换只留 legacy 读法）
- Test: `packages/cdd-engine/src-next/session/__tests__/round-naming.test.ts`（网格 pin · 守恒边界 · implement 五 kind 携 cycle · `isCarrierName` 四拒）
- Test: `packages/cdd-engine/src-next/infra/__tests__/infra.test.ts`（`CarrierSeal.sweep` 认 `-a{n}` 载体、拒 report/evidence/crash/log）

#### Consumes

- `TargetType`（`session/faces.ts`）与 `OpType`（`session/ledger.ts`）的既有词表
- `config.handoffNamespace().families`（既有家族名表——本任务把它降为 legacy 读法）

#### Produces

- `type ArtifactKind = "draft" | "final" | "report" | "log" | "crash" | "evidence"`
- `interface RoundArtifact { line: string; op: OpType; cycle: number; attempt: number }`
- `RoundNaming#renderName(identity: RoundArtifact, kind: ArtifactKind): string`
- `RoundNaming#renderPath(identity: RoundArtifact, kind: ArtifactKind): string`
- `HandoffParams.attempt?: number`（缺省即 1）
- `RoundNaming.isCarrierName(name): boolean`（只认 draft/final，含 `-a{n}`）

#### Steps

- 写失败测（网格）：六个 `TargetType`（四个文档形 + wave + branch）× 适用 kind × `attempt` 1–3 × `cycle` 1–2，断言同一 kind 下任意两个不同身份不同名；`""` 不入比较 — checkable: 定向 vitest FAIL（今日无 `renderName`）
- 写失败测（守恒边界）：`phase-spec-review-1.json` / `phase-spec-review-1.c1.json` / `phase-spec-review-1-report.md` / `phase-spec-review-1.log` / `crash-phase-spec-review-1.json` 逐字节等于今日拼写 — checkable: FAIL（今日 `render` 不存在）
- 写失败测（implement 族）：五个非 crash kind 均携 `-1` 且 `final ≠ draft`；`crash` 保持今日拼写 `crash-tasks-6,7-implement-1.json` — checkable: FAIL
- 写失败测（`evidence` 携三坐标）：`tasks-6,7-implement-1-test-evidence.json` 与 `branch-fix-1-test-evidence.json` — checkable: FAIL
- 写失败测（扫描面四拒）：`isCarrierName` 对 `…-report.md` / `….log` / `…-test-evidence.json` / `crash-….json` 均为 false，对 `tasks-6,7-implement-a2.json` 与 `tasks-6,7-implement-a2.c1.json` 为 true — checkable: FAIL（今日 pattern 不认 `-a{n}`）
- 实现 `RoundArtifact` / `ArtifactKind` / `renderName` / `renderPath`：`-a{n}` 插在 stem 尾部、`.c{cycle}` 之前，`attempt === 1` 省略 — checkable: 网格与守恒两组测 PASS
- 把 `finalName` / `logName` / `report` / `evidenceName` / `crashName` / `#stem` 改成对 `renderName` 的委派（签名保留以缩小调用面），删掉 `#stem` 的 implement 省 round 分支 — checkable: implement 组与 evidence 组 PASS
- 把 `Ledger.handoffName` / `handoffPath` 改成委派 `renderName`，`HandoffParams` 补 `attempt`，`families` 的占位替换降为 legacy 读法 — checkable: `ledger.test.ts` 全绿
- 收窄 `isCarrierName` 的 pattern，并让 `CarrierSeal.#isStray` 的判定与之一致 — checkable: 扫描面四拒 PASS · `infra.test.ts` 全绿
- 全量回归 — checkable: `pnpm -C packages/cdd-engine exec vitest run` 与 `pnpm exec tsc --noEmit -p packages/cdd-engine` 均 exit 0
- 提交 — checkable: `git log -1 --oneline` 含本任务主题

#### Acceptance

- 网格 pin 绿：六个 type × 适用 kind × attempt 1–3 × cycle 1–2，同一 kind 下无同名；`""` 不入比较。
- 守恒边界：四类文档线 · wave 的 review/fix 族 · branch 的 review 族 · 全部 `crash` 名逐字节不变。
- implement 五个非 crash kind 携 cycle 且 `final ≠ draft`；全线 `evidence` 携 op/cycle/attempt。
- `isCarrierName` 只认 draft/final（含 `-a{n}`），四种非载体形状一律 false。

#### DependsOn

none

---

### Task 2: 读写缝——记录不携路径，路径经一个 accessor 派生

#### Objective

`RoundRecord` 停写 `carrierPath` / `draftPath`；新增 `Ledger#carrierPathOf(type, key, record)`（记录里有就用、没有就 `renderPath(..., "final")`）与 `RoundRecords#ownerOf(records, record)`。四条读面改经它们：board 的 `+N`、`#reviewsPathOf`、`FixDispositions` 的 requester 路径、capsule 成功面。`persistHandoff` 记摘要、不再记路径；`#paramsOf` 对 implement 也填 round。

#### Files

- Modify: `packages/cdd-engine/src-next/session/ledger.ts`（`carrierPathOf` · `RoundRecords.ownerOf` · `#reviewsPathOf` 走 accessor + `attempt` · `recordRound` 停写两字段 · `persistHandoff` 写 `renderPath(final)` 并 seal 两个名字 · `readHandoff` 接受 `attempt`）
- Modify: `packages/cdd-engine/src-next/session/carrier-integrity.ts`（`readFor` 的「从记录取路径」职责退役，调用点改 `read(path, digest)`）
- Modify: `packages/cdd-engine/src-next/face/board-view.ts`（`#findingsCountOf` 收 `(path, digest, owner)`；行构造处一次算行内全量记录并传判定）
- Modify: `packages/cdd-engine/src-next/contract/completion-criterion.ts`（`requesterPathOf` 收 `ctx.reviewsPath`，摘要仍按 requester 记录取）
- Modify: `packages/cdd-engine/src-next/face/lifecycle.ts`（`#paramsOf` 对 implement 填 round；`capsuleLines` 成功面把 `attempt` 传给 `resolveHandoffPath`）
- Test: `packages/cdd-engine/src-next/session/__tests__/ledger.test.ts`（accessor 两条取值序 · `ownerOf` 三例）
- Test: `packages/cdd-engine/src-next/face/__tests__/board-view.test.ts`（重派两次后零 `carrier-mismatch` · 旧 attempt 的 `+N` 来自自己的产物 · legacy 失配行计 0）
- Test: `packages/cdd-engine/src-next/face/__tests__/lifecycle.test.ts`（attempt-2 夹具：`--reviews` 读回 attempt-2 final；篡改 attempt-2 final 仍抛 `carrier-mismatch`）

#### Consumes

- Task 1 的 `renderName` / `renderPath` / `HandoffParams.attempt`
- 既有 `CarrierIntegrity.read(path, recordedDigest)` 三态读
- 既有 `BoardView#summaryCell` 的行构造点与 `CliLifecycle#capsuleLines` 的成功面

#### Produces

- `Ledger#carrierPathOf(type: TargetType, key: LedgerKey, record: RoundRecord): string`
- `RoundRecords#ownerOf(records: readonly RoundRecord[], record: RoundRecord): boolean`
- `CarrierIntegrity.readFor` 退役（调用点改 `read`）
- `recordRound` 的写入面不再产生 `carrierPath` / `draftPath`（字段保留为只读 legacy）

#### Steps

- 写失败测（accessor 取值序）：记录带 `carrierPath` 时原样返回；不带时按身份派生 — checkable: 定向 vitest FAIL
- 写失败测（`ownerOf` 三例）：同一路径更大 `(cycle, attempt)` → false；同路径同身份 → true；路径不同 → true — checkable: FAIL
- 写失败测（board 重派）：两条 attempt 记录 + 各自产物 → 渲染不抛，两个 token 的 `+N` 各来自自己的文件 — checkable: FAIL（今日整块抛）
- 写失败测（legacy 失配）：一条被覆写的历史记录 → `+N` = 0、不抛 — checkable: FAIL
- 写失败测（attempt-2 读写）：`--reviews` 解析到 attempt-2 final，`readHandoff` 读回它 — checkable: FAIL
- 写失败测（篡改不退化）：改 attempt-2 final 一字节 → 仍抛 `carrier-mismatch` — checkable: FAIL
- 实现 `carrierPathOf` 与 `RoundRecords.ownerOf` — checkable: 前两组测 PASS
- `recordRound` 停写两字段、`persistHandoff` 记摘要不记路径、`CarrierIntegrity.readFor` 退役并改调用点 — checkable: `ledger.test.ts` 与 `carrier-integrity.test.ts` 全绿
- 四条读面改为经 accessor（board / `#reviewsPathOf` / `FixDispositions` / capsule）— checkable: board 与 lifecycle 定向测 PASS
- `#paramsOf` 对 implement 也填 round — checkable: implement 派发的产物名携 `-1`（一条夹具断言）
- 全量回归 — checkable: `pnpm -C packages/cdd-engine exec vitest run` 与 typecheck exit 0
- 提交 — checkable: `git log -1 --oneline` 含本任务主题

#### Acceptance

- 新记录不含 `carrierPath` / `draftPath`；四条读面全部经 accessor 派生。
- 重派两次后 board 零 `carrier-mismatch`，每个 attempt 的 `+N` 来自自己的产物。
- legacy 失配行 present-facts（`+N` = 0、不抛）；外部篡改仍抛。
- attempt-2 的 draft/final/report/log 由渲染命名，`--reviews` 与 `readHandoff` 读回的就是 attempt 2 自己的文件。

#### DependsOn

1

---

### Task 3: preflight/seal 窗口同源 + 守卫 pin + changeset

#### Objective

preflight 的 unseal 集合与 terminal 的 seal 集合都改用本轮身份的 `renderPath(draft)` / `renderPath(final)`；崩溃遗留由 `sweep` 按新 pattern 认出。补 spec 的三条守卫 pin（零名字拼装 / 写面不取占位表 / 扫描面只认两种 kind）与 `crash` 对每个派发轮适用的断言，收尾落 changeset。

#### Files

- Modify: `packages/cdd-engine/src-next/face/lifecycle.ts`（`#roundCarrierNamesOf` 收 `attempt` · `#openRoundCarriers` 只 unseal 本轮一对 · terminal 同对 seal · `#writeCrash` 走渲染名）
- Modify: `packages/cdd-engine/src-next/session/run.ts`（`#sealRoundCarriers` 同源）
- Test: `packages/cdd-engine/src-next/face/__tests__/lifecycle.test.ts`（attempt-2 窗口：attempt-1 一对不可写 · 窗口内只有 attempt-2 一对可写 · review 轮崩溃记录落在渲染名上且 attempt 2 不覆盖 attempt 1）
- Test: `packages/cdd-engine/src-next/session/__tests__/round-naming.test.ts`（两条守卫：`RoundNaming` 与 accessor 之外零 `.c${` / `-report.md` / `-a${` / `-test-evidence` 字面；写面零 `families` 调用）
- Add: `.changeset/p34-round-artifact-identity.md`（`@oscaner-skills/cdd-engine` minor）

#### Consumes

- Task 1 的 `renderPath` 与 `isCarrierName`
- Task 2 的 `carrierPathOf`（abort fold 取记录自己的 attempt）
- 既有 `CarrierSeal.sweep` / `CarrierSeal.seal` 与 `#openRoundCarriers` 的窗口位置

#### Produces

- `CliLifecycle#roundCarrierNamesOf` 返回本轮的两个名字（attempt 与记录/帧同源）
- 两条守卫测试（零名字拼装 · 写面零占位表）

#### Steps

- 写失败测（窗口同源，terminal 后）：attempt-2 轮结束后 attempt-1 的 draft/final 仍是 sealed，attempt-2 的一对也是 sealed — checkable: 定向 vitest FAIL
- 写失败测（窗口内可写面）：窗口打开期间只有 attempt-2 的一对可写 — checkable: FAIL
- 写失败测（review 轮崩溃）：review 失败面写出 `crash-{line}-{op}-{cycle}.json`，attempt 2 写 `…-a2.json` 且 attempt 1 的文件不被覆盖 — checkable: FAIL
- 写失败测（两条守卫）：`RoundNaming` 与 accessor 之外零产物名拼装字面；写路径零 `families` 调用 — checkable: FAIL（今日命中）
- 实现 preflight / terminal 的同源窗口与 `#writeCrash` 的渲染名 — checkable: 前三条测 PASS
- 补两条守卫测试并让它们绿 — checkable: 两条守卫 PASS
- 落 changeset（minor，理由：产物命名是消费面可见的字节）— checkable: `pnpm exec changeset status` 列出该条
- 全量回归 — checkable: `pnpm run validate` exit 0
- 提交 — checkable: `git log -1 --oneline` 含本任务主题

#### Acceptance

- attempt-2 的派发只 unseal attempt-2 的一对；attempt-1 一对在整轮不可写；terminal seal 同一对。
- 崩溃遗留的 `-a{n}` 载体被 sweep 认出并封印；四种非载体形状不被当载体。
- review 轮的崩溃记录落在渲染名上，attempt 2 不覆盖 attempt 1，失败面与 resume 读得回。
- 两条守卫 pin 绿；changeset minor 在册；`pnpm run validate` exit 0。

#### DependsOn

2

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-11-13 | P34 计划初稿：T1 渲染单源 + 扫描面收窄（网格 pin · 守恒边界 · implement 五 kind 携 cycle · evidence 三坐标）· T2 读写缝（`carrierPathOf` / `ownerOf` / 四条读面 / 记录停写两字段 / implement 填 round）· T3 preflight-seal 同源窗口 + 守卫 pin + changeset。 | '[human] 裁定 · Claude（kairos:cdd-plan · 2026-11-13）' |
