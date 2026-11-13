---
title: '引擎文档工具（Engine Doc-Tooling）— P34 计划：轮次产物身份的单射渲染'
doc-type: plan
version: v0.3
date: 2026-11-13
slug: 2026-10-10-engine-doc-tooling-p34
base: develop
---

## Constraints

- **逐字取 spec**：本计划只实现 `docs/kairos/specs/2026-10-10-engine-doc-tooling-p34-design.md` **现行 version v0.8** 所指的面；spec 版本一变，本约束的字面同笔改。
- **单射性是唯一不变量**：条件只允许出现在**渲染的省略**上（`attempt === 1` 不拼 `-a{n}`）；坐标本身恒从身份取，任何「满足某条件才拼坐标」的写法都是 §2.1 的反例。
- **`progress.json` 形状不变**：只停写 `carrierPath` / `draftPath`，不迁移旧值、不加版本标记。
- **不加运行时守护门**：写一次是构造属性；seal 的既有 unseal→写→seal 循环保留，不加「重写即拒」。
- **seal 窗口不扩**：只 `draft` + `final` 两个载体进窗口；`report` / `log` / `evidence` / `crash` 不进。
- **`next:` 字面零变更**（D70）。
- **来源行与层收窄都不进分级**：`crashed:` 行不进 legend 词表、不进任何计数、不改 `next:`（§2.13）；闭合 wave 的层收窄不新增持久字段（§2.15）。
- **坏值分档的边界由 `required` 声明驱动**：不在 `#materialize` 手写第二份字段清单（§2.14 / §3.8）。
- **不动收敛主线（D70）**：`session/next.ts`、`Ledger#nextHopOf`、`NextStepRouter`、`WaveGate` / `DispatchAuthority` 的分级计数与下一跳判定**零改动**——本相位不新增分级信号、不安装「按 route kind 反推」的分支、不改 Loop-vs-converge 的判据面。board 的 `+N` 是**渲染面**（一个计数从哪个产物读），不是分级信号；若某一步看起来必须动下一跳才能完成，停下来上报，不得顺手扩面。
- **不引入新依赖**；changeset 只 `@oscaner-skills/cdd-engine` **minor**；不发布；波宽 ≤ 3；零模块级裸函数。
- **不适用 kind 渲空串**：`evidence` 在四个文档形上渲 `""`，调用方按「无此产物」处理，空串不是名字、不入单射比较。

## Review Focus

- **implement 的 cycle 恒 1 被当成「没有 cycle」**：`Run#roundFor`（`session/run.ts:617`）对该相位返回固定值，而 `#stem`（`session/round-naming.ts:165`）今天正是据此省掉 round 令牌；最省事的写法就是保留这两处的默契，在渲染处继续省掉 round 令牌——那会让 implement 的五个 kind 依次落回同一格，单射性在 cycle 维度上无声退化。网格 pin 只比较「两个不同身份」，抓不到「所有身份都渲成 cycle 1」。
- **legacy 行的 attempt 缺省读错文件**：由记录反查路径时若把 `attempt` 缺省成 1 而记录实际是 2，会读 attempt 1 的文件、比对 attempt 2 的摘要——假 `carrier-mismatch`，与要治的症状同形。
- **owner 判据拿不到行内全量记录**：`BoardView#findingsCountOf` 是单记录 static，若判定输入退化成「只有这一条」，legacy 行永远判 owner → 老 slug 回到整块拒渲染。
- **seal 窗口与本轮 attempt 不同源**：preflight 打开无 attempt 的名字时，历史那一对在整个窗口内可写。断言面是「attempt-1 的一对在 attempt-2 的窗口内**不可写**」，不是「能写但不该写」。
- **`isCarrierName` 放宽成「任何产物」**：`-report.md` / `.log` / `-test-evidence.json` / `crash-` 四种形状一旦入判定，sweep 会把报告当载体 seal、board 会把崩溃记录当孤儿列出来。

---

### Task 1: 渲染单源 `render(identity, kind)` + 扫描面收窄

#### Objective

把 `RoundNaming` 的名字派发收成一处：身份 `(line, op, cycle, attempt)` × 种类 `kind ∈ {draft, final, report, log, crash, evidence}` → 一个名字。`attempt === 1` 省略 `-a{n}`；`final` 携 `.c{cycle}`；implement 族的每个 kind 都携 cycle；`evidence` 携 op/cycle/attempt。`finalName` / `logName` / `report` / `evidenceName` / `crashName` / `#stem` 的独立拼装全部改由这一处派生，`isCarrierName` 收窄到只认 `draft` / `final` 两种形状。删除 `#stem` 的 implement 省 round 分支会让 implement 名在 `HandoffParams.round` 缺省时渲出 `undefined`，所以 `Run#paramsOf` 对 implement 也填 round 与拼写改动同批落地（单笔，不可拆）；`Ledger#handoffOwner` 的反向归属同批改为从名字结构反解，否则新拼写的未入账载体在孤儿面上静默消失。

#### Files

- Modify: `packages/cdd-engine/src-next/session/round-naming.ts`（新增 `RoundArtifact` / `ArtifactKind` 与 `renderName` / `renderPath`；`finalName` / `logName` / `report` / `evidenceName` / `crashName` / `#stem` 改为委派；`isCarrierName` 的 pattern 只认 draft/final 且容 `(?:-a\d+)?`）
- Modify: `packages/cdd-engine/src-next/session/ledger.ts`（`handoffName` / `handoffPath` 委派 `renderName`；`HandoffParams` 补 `attempt?: number`；`#handoffOwner`（:1778-1799）与 `#familyCaptures`（:1813-1827）停止以 `families` 拼写匹配，改为反解名字形状并与 `renderName` 比对；`families` 占位替换只留 legacy 读法）
- Modify: `packages/cdd-engine/src-next/session/run.ts`（`#paramsOf`（:651-673）对 implement 也填 `round`——`#stem` 删分支后的同笔依赖）
- Test: `packages/cdd-engine/src-next/session/__tests__/round-naming.test.ts`（网格 pin · 守恒边界 · implement 五 kind 携 cycle · `isCarrierName` 四拒）
- Test: `packages/cdd-engine/src-next/session/__tests__/ledger.test.ts`（反向归属：未入账的 `-a2` draft / final 各列出一次、已入账的不列；`tasks-6,7-implement-1.json` → `(6,7) · implement · cycle 1`；report/evidence/crash 不入孤儿——它们不是 handoff 家族，列入会与扫描面的四拒相悖）
- Test: `packages/cdd-engine/src-next/infra/__tests__/infra.test.ts`（`CarrierSeal.sweep` 认 `-a{n}` 载体、拒 report/evidence/crash/log）
- Test: `packages/cdd-engine/src-next/face/__tests__/cli.test.ts`（:1726 / :1814 / :1908 / :3737 / :4096 / :5859 / :5917 / :6875 的 implement 拼写夹具随新名同批改）
- Test: `packages/cdd-engine/src-next/face/__tests__/preview.test.ts`（:97 的 implement 拼写夹具）
- Test: `packages/cdd-engine/src-next/face/__tests__/lifecycle.test.ts`（:158 的 implement 拼写夹具）

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
- `Run#paramsOf` 对 implement 也填 `round`，随 `#stem` 分支的删除同笔落地 — checkable: implement 派发的产物名携 `-1`（一条夹具断言），implement 组与 evidence 组 PASS
- 写失败测（反向归属）：`Ledger#handoffOwner` 反解 `-a{n}` / `-{cycle}` 新拼写 — checkable: FAIL（今日只剥 `.c\d+.json` 再按 `families` 拼写端锚匹配，新名零命中）
- 实现反向归属的结构化读法（名字 → `(line, op, cycle, attempt)` → 与 `renderName` 比对该 kind），`families` 拼写只留 legacy 回退 — checkable: 反向归属组 PASS · `ledger.test.ts` 全绿
- 全量回归 — checkable: `pnpm -C packages/cdd-engine exec vitest run` 与 `pnpm exec tsc --noEmit -p packages/cdd-engine` 均 exit 0
- 提交 — checkable: `git log -1 --oneline` 含本任务主题

#### Acceptance

- 网格 pin 绿：六个 type × 适用 kind × attempt 1–3 × cycle 1–2，同一 kind 下无同名；`""` 不入比较。
- 守恒边界：四类文档线 · wave 的 review/fix 族 · branch 的 review 族 · 全部 `crash` 名逐字节不变。
- implement 五个非 crash kind 携 cycle 且 `final ≠ draft`；全线 `evidence` 携 op/cycle/attempt；`Run#paramsOf` 对 implement 填 round，派发名不出现 `undefined`。
- `isCarrierName` 只认 draft/final（含 `-a{n}`），四种非载体形状一律 false。
- 反向归属认新拼写：未入账的 `-a2` draft / final 各在 `orphanHandoffs` 出现一次，已入账的不出现；`report` / `evidence` / `crash` 不入孤儿；implement 的 `tasks-6,7-implement-1.json` 归属到 `(6,7) · implement · cycle 1`。

#### DependsOn

none

---

### Task 2: 读写缝——记录不携路径，路径经一个 accessor 派生

#### Objective

`RoundRecord` 停写 `carrierPath` / `draftPath`；新增 `Ledger#carrierPathOf(type, key, record)`（记录里有就用、没有就 `renderPath(..., "final")`，候选取值前自探存在）与 `RoundRecords#ownerOf(records, record)`。五条读面改经它们：board 的 `+N`、`Ledger#reviewsPathOf`、`CliLifecycle#reviewsPath`（`face/lifecycle.ts:1297-1310`——第五读面，也是 `CompletionContext.reviewsPath` 的来源）、`FixDispositions` 的 requester 路径、capsule 成功面；`CliLifecycle#judgedRecordOf`（`face/lifecycle.ts:519-531`）不再以 draft 拼写制造 `carrierPath`，`FixDispositions#ownRefusal`（`contract/completion-criterion.ts:487-492`）不再读该格。摘要半边同批认 `attempt`：`#requesterDigestOf`（`contract/completion-criterion.ts:422-425`）只读 `record.carrierDigest`，删 `record.carrierPath === null` 这道门——否则退役后每条新记录都走零比对，篡改的 `--reviews` 载体被当成真迹。`persistHandoff` 记摘要、不再记路径。

#### Files

- Modify: `packages/cdd-engine/src-next/session/ledger.ts`（`carrierPathOf` · `RoundRecords.ownerOf` · `RoundIdentity`（:146-148）摘 `carrierPath` 格 · `#reviewsPathOf` 走 accessor + 请求侧记录自己的 `attempt` · `recordRound` 停写两字段 · `persistHandoff` 写 `renderPath(final)` 并 seal 两个名字 · `readHandoff` 接受 `attempt`）
- Modify: `packages/cdd-engine/src-next/session/carrier-integrity.ts`（`readFor` 的「从记录取路径」职责退役，调用点改 `read(path, digest)`）
- Modify: `packages/cdd-engine/src-next/face/board-view.ts`（`#findingsCountOf` 收 `(path, digest, owner)`；行构造处一次算行内全量记录并传判定）
- Modify: `packages/cdd-engine/src-next/contract/completion-criterion.ts`（`requesterPathOf` 收 `ctx.reviewsPath`；`#requesterDigestOf` 只取 `record.carrierDigest`、删 :423 的 `carrierPath === null` 门；`#ownRefusal` 的「no work carrier at …」文案改由 accessor 取路径或去路径片）
- Modify: `packages/cdd-engine/src-next/face/lifecycle.ts`（`#reviewsPath`（:1297-1310）走 `carrierPathOf` + 请求侧记录的 `attempt`，legacy 探针改读「记录无 `carrierDigest` 字段」而非 `carrierPath === null`；`#judgedRecordOf`（:519-531）不再制造 `carrierPath`）
- Modify: `packages/cdd-engine/src-next/session/run.ts`（`#capsuleLines`（:1011-1041）成功面把 `attempt` 传给 `resolveHandoffPath`）
- Test: `packages/cdd-engine/src-next/session/__tests__/ledger.test.ts`（accessor 两条取值序 · `ownerOf` 三例）
- Test: `packages/cdd-engine/src-next/face/__tests__/board-view.test.ts`（重派两次后零 `carrier-mismatch` · 旧 attempt 的 `+N` 来自自己的产物 · legacy 失配行计 0）
- Test: `packages/cdd-engine/src-next/face/__tests__/lifecycle.test.ts`（attempt-2 夹具：`--reviews` 读回 attempt-2 final；篡改 attempt-2 final 仍抛 `carrier-mismatch`；新记录在 resolved 名无载体时走 missing-carrier 而非 legacy/unrecorded）
- Test: `packages/cdd-engine/src-next/contract/__tests__/completion-criterion.test.ts`（无 `carrierPath` 而有 `carrierDigest` 的记录 + 一字节篡改 → `CarrierMismatchError`）

#### Consumes

- Task 1 的 `renderName` / `renderPath` / `HandoffParams.attempt`
- 既有 `CarrierIntegrity.read(path, recordedDigest)` 三态读
- 既有 `BoardView#summaryCell` 的行构造点与 `Run#capsuleLines` 的成功面

#### Produces

- `Ledger#carrierPathOf(type: TargetType, key: LedgerKey, record: RoundRecord): string`
- `RoundRecords#ownerOf(records: readonly RoundRecord[], record: RoundRecord): boolean`
- `CarrierIntegrity.readFor` 退役（调用点改 `read`）
- `FixDispositions#requesterDigestOf` 只看 `record.carrierDigest`（不再以 `carrierPath` 为门）
- `recordRound` 的写入面不再产生 `carrierPath` / `draftPath`（字段保留为只读 legacy）；`RoundIdentity` 的 `carrierPath` 格随 `#judgedRecordOf` 一同摘除

#### Steps

- 写失败测（accessor 取值序）：记录带 `carrierPath` 时原样返回；不带时按身份派生 — checkable: 定向 vitest FAIL
- 写失败测（`ownerOf` 三例）：同一路径更大 `(cycle, attempt)` → false；同路径同身份 → true；路径不同 → true — checkable: FAIL
- 写失败测（board 重派）：两条 attempt 记录 + 各自产物 → 渲染不抛，两个 token 的 `+N` 各来自自己的文件 — checkable: FAIL（今日整块抛）
- 写失败测（legacy 失配）：一条被覆写的历史记录 → `+N` = 0、不抛 — checkable: FAIL
- 写失败测（attempt-2 读写）：`--reviews` 解析到 attempt-2 final，`readHandoff` 读回它 — checkable: FAIL
- 写失败测（篡改不退化）：改 attempt-2 final 一字节 → 仍抛 `carrier-mismatch` — checkable: FAIL
- 写失败测（摘要缝独立于路径字段）：一条无 `carrierPath`、有 `carrierDigest` 的 review 记录 + 其载体被翻一字节 → fix 派发仍抛 `CarrierMismatchError` — checkable: FAIL（今日 `#requesterDigestOf` 返 null，零比对）
- 实现 `carrierPathOf` 与 `RoundRecords.ownerOf` — checkable: 前两组测 PASS
- `recordRound` 停写两字段、`persistHandoff` 记摘要不记路径、`CarrierIntegrity.readFor` 退役并改调用点 — checkable: `ledger.test.ts` 与 `carrier-integrity.test.ts` 全绿
- `#requesterDigestOf` 改为只读 `carrierDigest`、删 :423 的门 — checkable: 摘要缝测 PASS
- 五条读面改为经 accessor（board / `#reviewsPathOf` / `#reviewsPath` / `FixDispositions` / capsule）— checkable: board 与 lifecycle 定向测 PASS
- `#reviewsPath` 的 attempt 取请求侧记录自己的值（不向 1 缺省），legacy 探针重写为「记录无 `carrierDigest` 字段」 — checkable: 新记录缺载体时落 missing-carrier 而非 legacy/unrecorded（lifecycle attempt-2 测）
- `#judgedRecordOf` 摘掉 `carrierPath` 格，`#ownRefusal` 文案不再读它 — checkable: `completion-criterion.test.ts` 全绿
- 全量回归 — checkable: `pnpm -C packages/cdd-engine exec vitest run` 与 typecheck exit 0
- 提交 — checkable: `git log -1 --oneline` 含本任务主题

#### Acceptance

- 新记录不含 `carrierPath` / `draftPath`；五条读面（board · `#reviewsPathOf` · `#reviewsPath` · `FixDispositions` · capsule）全部经 accessor 派生；新记录在 resolved 名无载体时走 missing-carrier，不被当 legacy/unrecorded。
- 重派两次后 board 零 `carrier-mismatch`，每个 attempt 的 `+N` 来自自己的产物。
- legacy 失配行 present-facts（`+N` = 0、不抛）；外部篡改仍抛——包括无 `carrierPath` 而有 `carrierDigest` 的记录（摘要缝不依赖路径字段）。
- attempt-2 的 draft/final/report/log 由渲染命名，`--reviews` 与 `readHandoff` 读回的就是 attempt 2 自己的文件。

#### DependsOn

1

---

### Task 3: preflight/seal 窗口同源 + 守卫 pin + changeset

#### Objective

preflight 的 unseal 集合与 terminal 的 seal 集合都改用本轮身份的 `renderPath(draft)` / `renderPath(final)`；崩溃遗留由 `sweep` 按新 pattern 认出。补 spec 的三条守卫 pin（`RoundNaming` 与 accessor 之外零 `carrierPath` 读 / 零名字拼装 / 写面零 `families` 调用）与 `crash` 对每个派发轮适用的断言（写入名与失败面 / resume 的读回同一名字），收尾落 changeset。

#### Files

- Modify: `packages/cdd-engine/src-next/face/lifecycle.ts`（`#roundCarrierNamesOf` 收 `attempt` · `#openRoundCarriers` 只 unseal 本轮一对 · terminal 同对 seal · `#writeCrash` 走渲染名）
- Modify: `packages/cdd-engine/src-next/session/run.ts`（`#sealRoundCarriers` 同源）
- Test: `packages/cdd-engine/src-next/face/__tests__/lifecycle.test.ts`（attempt-2 窗口：attempt-1 一对不可写 · 窗口内只有 attempt-2 一对可写 · review 轮崩溃记录落在渲染名上且 attempt 2 不覆盖 attempt 1 · 失败面 capsule 行与 resume 决策读回同一个 attempt-2 崩溃名）
- Test: `packages/cdd-engine/src-next/session/__tests__/round-naming.test.ts`（三条守卫：`RoundNaming` 与 accessor 之外零 `carrierPath` 读；零 `.c${` / `-report.md` / `-a${` / `-test-evidence` 名字拼装字面；写面零 `families` 调用）
- Add: `.changeset/p34-round-artifact-identity.md`（`@oscaner-skills/cdd-engine` minor）

#### Consumes

- Task 1 的 `renderPath` 与 `isCarrierName`
- Task 2 的 `carrierPathOf`（abort fold 取记录自己的 attempt）
- 既有 `CarrierSeal.sweep` / `CarrierSeal.seal` 与 `#openRoundCarriers` 的窗口位置

#### Produces

- `CliLifecycle#roundCarrierNamesOf` 返回本轮的两个名字（attempt 与记录/帧同源）
- 三条守卫测试（零 `carrierPath` 读 · 零名字拼装 · 写面零占位表）

#### Steps

- 写失败测（窗口同源，terminal 后）：attempt-2 轮结束后 attempt-1 的 draft/final 仍是 sealed，attempt-2 的一对也是 sealed — checkable: 定向 vitest FAIL
- 写失败测（窗口内可写面）：窗口打开期间只有 attempt-2 的一对可写 — checkable: FAIL
- 写失败测（review 轮崩溃）：review 失败面写出 `crash-{line}-{op}-{cycle}.json`，attempt 2 写 `…-a2.json` 且 attempt 1 的文件不被覆盖；同一夹具的失败面 capsule 行与前 `next:` resume 决策都读回 attempt 2 的名字（不是 attempt 1、不是无后缀的默认名）— checkable: FAIL
- 写失败测（三条守卫）：`RoundNaming` 与 accessor 之外零 `carrierPath` 读；零产物名拼装字面；写路径零 `families` 调用 — checkable: FAIL（今日命中：`lifecycle.ts:1299` / `:1307` / `:526`、`completion-criterion.ts:365` / `:423` / `:490`、`run.ts:694` / `:724`）
- 实现 preflight / terminal 的同源窗口、`#writeCrash` 的渲染名与失败面 / resume 的读回 — checkable: 前三条测 PASS
- 补三条守卫测试并让它们绿 — checkable: 三条守卫 PASS
- 落 changeset（minor，理由：产物命名是消费面可见的字节）— checkable: `pnpm exec changeset status` 列出该条
- 全量回归 — checkable: `pnpm run validate` exit 0
- 提交 — checkable: `git log -1 --oneline` 含本任务主题

#### Acceptance

- attempt-2 的派发只 unseal attempt-2 的一对；attempt-1 一对在整轮不可写；terminal seal 同一对。
- 崩溃遗留的 `-a{n}` 载体被 sweep 认出并封印；四种非载体形状不被当载体。
- review 轮的崩溃记录落在渲染名上，attempt 2 不覆盖 attempt 1；失败面 capsule 行与 resume 决策读回同一个 attempt-2 名字。
- 三条守卫 pin 绿（零 `carrierPath` 读 · 零名字拼装 · 写面零 `families`）；changeset minor 在册；`pnpm run validate` exit 0。

#### DependsOn

2

---

### Task 4: 孤儿归属 = 记录归属

#### Objective

`Ledger#orphanHandoffs` 的认领谓词从「本行有一条 `targetAction` 的轮」改为「本行任意记录认领该 `(op, cycle)`」。abort 轮（`interrupted`）算认领；legacy 行再由记录的 `carrierPath` 直指同一文件补一档认领。board 的 `orphan:` 文案不动——它本来就是这么说的。

#### Files

- Modify: `packages/cdd-engine/src-next/session/ledger.ts`（`orphanHandoffs` 的认领谓词；legacy 的 `carrierPath` 认领档）
- Test: `packages/cdd-engine/src-next/session/__tests__/ledger.test.ts`（BLOCKED 落载体不列孤儿 · 未入账草稿仍列 · legacy `carrierPath` 直指算认领）
- Test: `packages/cdd-engine/src-next/face/__tests__/board-view.test.ts`（board 的 `orphan:` 行只列真孤儿）

#### Consumes

- Task 1 的身份渲染（把名字反解成 `(line, op, cycle)`）
- Task 2 的 `Ledger#carrierPathOf`（legacy 档）

#### Produces

- `orphanHandoffs()` 的认领语义：任意记录认领 + legacy 路径直指认领

#### Steps

- 写失败测（BLOCKED 落载体）：一行有 `targetAction: false` 且记录了 `carrierPath`，文件在 → 不列孤儿 — checkable: 定向 vitest FAIL
- 写失败测（真孤儿仍在）：文件在、本行无记录 → 仍列 — checkable: FAIL
- 写失败测（legacy 认领）：记录的 `carrierPath` 直指该文件、但名字反解不出同一 `(op, cycle)` → 不列 — checkable: FAIL
- 改谓词与 legacy 档 — checkable: 三条测 PASS
- 全量回归 — checkable: `pnpm -C packages/cdd-engine exec vitest run` 与 typecheck exit 0
- 提交 — checkable: `git log -1 --oneline` 含本任务主题

#### Acceptance

- BLOCKED / abort 但已入账的载体不再列孤儿；真正未入账的仍列一次；legacy 路径直指算认领。
- board 的 `orphan:` 文案保持 `no recorded round owns it`（它现在为真）。

#### DependsOn

1, 2

---

### Task 5: 崩溃 / 中断的来源行（不参与分级）

#### Objective

board 在 `in-flight` / `orphan` 同级加一行 `crashed:`，由记录自己的 `violations[].cause` 派生，列出 `(op, cycle·attempt, cause)`；`✗` 保留。该行是纯观测，不参与任何判定。

#### Files

- Modify: `packages/cdd-engine/src-next/face/board-view.ts`（`inFlightRows` 同级渲 `crashed:` 行，数据源为行内记录）
- Test: `packages/cdd-engine/src-next/face/__tests__/board-view.test.ts`（有崩溃记录时该行存在且带 cause · 无 cause 时不出现 · 有无崩溃两夹具的 `next:` / `+N` / 计数逐字节相同）

#### Consumes

- `RoundRecord.violations[].cause` 的既有值域（`contract-violation` / `interrupted` / `stalled` / `over-budget` / `signal` / `child-exit`）

#### Produces

- `BoardView` 的 `crashed:` 行渲染（零分级接入）

#### Steps

- 写失败测（行存在）：一条 `interrupted` 记录 → board 含 `crashed:` 且带 `interrupted` — checkable: FAIL
- 写失败测（无崩溃不出现）：记录无 violation → 不渲该行 — checkable: FAIL
- 写失败测（不参与分级）：同一 slug 两夹具（有 / 无崩溃记录）的 `next:` 行、`+N` 与 blocker 计数逐字节相同 — checkable: FAIL
- 实现渲染 — checkable: 三条 PASS
- 全量回归 — checkable: `pnpm -C packages/cdd-engine exec vitest run` 与 typecheck exit 0
- 提交 — checkable: `git log -1 --oneline` 含本任务主题

#### Acceptance

- `crashed:` 行按记录列出 cause 与 `(cycle, attempt)`；`✗` 保留。
- 有无崩溃记录两种夹具下 `next:` 字面、`+N`、blocker 计数逐字节相同（D70：零第二套分级）。
- 该行不进 legend 词表。

#### DependsOn

none

---

### Task 6: 宽容面——坏值分档 + 闭合 wave 层判据收窄

#### Objective

两处过严判据按**事实负载度**分档（同一条判据：不该红的地方不要红）。① 载体坏值：`required` 字段（work 的 `status` / `artifacts`、judge 的 `findings`、finding 的 `severity` / `lens` / `summary`）坏值仍 BLOCKED；非 required 的装饰字段（`id` / `section` / `line` / `fix` / `notes`）坏值 drop 该键 + 一条 soft observation。② `closed-wave-fits-depends-on-layers` 只判**未闭合** wave，闭合面交既有的 `planned-tasks-vs-recorded-tasks`（`planTasks` 快照）。两处合并为一任务的理由：同一个「过严判据」根因，两处各一行改动，合并后波宽仍 ≤ 3。

#### Files

- Modify: `packages/cdd-engine/src-next/session/handoff-schema.ts`（按 `required` 分档的校验面，暴露装饰字段集）
- Modify: `packages/cdd-engine/src-next/session/run.ts`（读回校验的调用点：坏值落到 drop + soft 而非整条拒绝）
- Modify: `packages/cdd-engine/src-next/contract/rules.ts`（层判据只对未闭合 wave 生效；`invariants.ts` 的站点随动）
- Test: `packages/cdd-engine/src-next/session/__tests__/handoff-schema.test.ts`（`line: null` 被接受 + 一条 soft · `severity` / `findings` / `status` 坏值仍 BLOCKED）
- Test: `packages/cdd-engine/src-next/contract/__tests__/rules.test.ts`（已闭合 wave 事后改依赖零红 · 未闭合 wave 跨层仍红）

#### Consumes

- `PLANE_REQUIRED` / `FINDING.required` 的既有声明面
- `#materialize` 对非声明字段的 drop + WARN 路（复用，不新造）
- `ProgressRow.planTasks` 的闭合快照

#### Produces

- `handoff-schema` 的坏值分档校验（装饰字段 drop + soft，负载字段 BLOCKED）
- 层判据的闭合豁免（`closed-wave-fits-depends-on-layers` 只对未闭合生效）

#### Steps

- 写失败测（装饰字段容错）：judge 载体含 `findings[].line = null` → 载体被接受，记一条 soft — checkable: 定向 vitest FAIL（今日整条被拒）
- 写失败测（负载字段不放宽）：`severity` / `findings` / `status` 任一处坏值 → 仍 BLOCKED — checkable: FAIL
- 写失败测（闭合豁免）：一条已闭合 wave，事后改 `DependsOn` 使其与现算层不符 → 零红 — checkable: FAIL
- 写失败测（未闭合仍红）：未闭合 wave 跨层 → 仍红 — checkable: FAIL
- 实现分档校验与层判据收窄 — checkable: 四条测 PASS
- 全量回归 — checkable: `pnpm -C packages/cdd-engine exec vitest run` 与 typecheck exit 0
- 提交 — checkable: `git log -1 --oneline` 含本任务主题

#### Acceptance

- `line: null` 的 review 载体被接受并记一条 soft，轮次照常结束。
- `severity` / `findings` / `status` 的坏值仍 BLOCKED（负载面不缩）。
- 已闭合 wave 事后改依赖零红；未闭合 wave 跨层仍红。
- 坏值分档的边界读 `required` 声明，不在 `#materialize` 手写第二份清单。

#### DependsOn

none

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-11-13 | P34 计划初稿：T1 渲染单源 + 扫描面收窄（网格 pin · 守恒边界 · implement 五 kind 携 cycle · evidence 三坐标）· T2 读写缝（`carrierPathOf` / `ownerOf` / 四条读面 / 记录停写两字段 / implement 填 round）· T3 preflight-seal 同源窗口 + 守卫 pin + changeset。 | '[human] 裁定 · Claude（kairos:cdd-plan · 2026-11-13）' |
| v0.2 | 2026-11-13 | 评审回改（docs-fix round 1）：T1 收 `#paramsOf` 的 implement round 与拼写夹具、`#handoffOwner` 反向归属改结构化反解；T2 补摘要缝（删 `carrierPath === null` 门）、第五条读面 `#reviewsPath`、`#judgedRecordOf` / `#ownRefusal` 摘格，`run.ts` 行改指 `session/run.ts`；T3 补第三条守卫（零 `carrierPath` 读）与崩溃记录的读回断言；Review Focus 改指 `Run#roundFor`。 | '[ai] Claude（kairos:cdd-docs-fix · 2026-11-13）' |
| v0.3 | 2026-11-13 | 并入四条同族面（spec v0.8 · 用户裁定「全并」）：新增 T4 孤儿归属（记录归属 + legacy 路径档）、T5 崩溃/中断来源行（不参与分级）、T6 宽容面（坏值按 `required` 分档 drop + soft · 闭合 wave 层判据收窄）。波次：W1{1,5,6} → W2{2} → W3{3,4}。 | '[human] 裁定 · Claude（kairos:cdd-design · 2026-11-13）' |
