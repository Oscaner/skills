---
title: '引擎文档工具（Engine Doc-Tooling）— P34 计划：轮次产物身份的单射渲染'
doc-type: plan
version: v0.19
date: 2026-11-14
slug: 2026-10-10-engine-doc-tooling-p34
base: develop
---

## Constraints

- **逐字取 spec**：本计划只实现 `docs/kairos/specs/2026-10-10-engine-doc-tooling-p34-design.md` **现行 version v0.17** 所指的面；spec 版本一变，本约束的字面同笔改。
- **单射性是唯一不变量**：条件只允许出现在**渲染的省略**上（`attempt === 1` 不拼 `-a{n}`）；坐标本身恒从身份取，任何「满足某条件才拼坐标」的写法都是 §2.1 的反例。
- **`progress.json` 形状不变**：只停写 `carrierPath` / `draftPath`，不迁移旧值、不加版本标记。
- **不加运行时守护门**：写一次是构造属性；seal 的既有 unseal→写→seal 循环保留，不加「重写即拒」。
- **seal 窗口不扩**：只 `draft` + `final` 两个载体进窗口；`report` / `log` / `evidence` / `crash` 不进。
- **`next:` 字面零变更**（D70）。
- **来源行与层收窄都不进分级**：`crashed:` 行不进 legend 词表、不进任何计数、不改 `next:`（§2.13）；闭合 wave 的层收窄不新增持久字段（§2.15）。
- **坏值分档的边界由 `required` 声明驱动**：不在 `#materialize` 手写第二份字段清单（§2.14 / §3.8）。
- **不动收敛主线（D70）**：`session/next.ts`、`Ledger#nextHopOf`、`NextStepRouter`、`WaveGate` / `DispatchAuthority` 的分级计数与下一跳判定**零改动**——本相位不新增分级信号、不安装「按 route kind 反推」的分支、不改 Loop-vs-converge 的判据面。board 的 `+N` 是**渲染面**（一个计数从哪个产物读），不是分级信号；若某一步看起来必须动下一跳才能完成，停下来上报，不得顺手扩面。
- **不引入新依赖**；changeset 只 `@oscaner-skills/cdd-engine` **minor**；不发布；波宽 ≤ 3；零模块级裸函数。
- **渲染面全域、适用面在帧面**：`renderName` 对六个 kind × 任何身份都出名字，不因面返回空串；`evidence` 的适用面住在帧面——`RoundNaming#evidenceName` 对文档形与非 implement / fix 相位返回空串，调用方按「无此产物」处理。空串是帧面的记号、不是渲染器的输出，所以单射网格在六个 type × 六个 kind 上全比、不按面筛，也不把 `""` 当名字（按面筛 + 空串比名会把 24 个文档身份塌成一个名字）。

## Review Focus

- **implement 的 cycle 恒 1 被当成「没有 cycle」**：`Lifecycle#roundFor`（`session/run.ts:617`）对该相位返回固定值，而 `#stem`（`session/round-naming.ts:165`）今天正是据此省掉 round 令牌；最省事的写法就是保留这两处的默契，在渲染处继续省掉 round 令牌——那会让 implement 的五个 kind 依次落回同一格，单射性在 cycle 维度上无声退化。网格 pin 只比较「两个不同身份」，抓不到「所有身份都渲成 cycle 1」。
- **legacy 行的 attempt 缺省读错文件**：由记录反查路径时若把 `attempt` 缺省成 1 而记录实际是 2，会读 attempt 1 的文件、比对 attempt 2 的摘要——假 `carrier-mismatch`，与要治的症状同形。
- **owner 判据拿不到行内全量记录**：`BoardView#findingsCountOf` 是单记录 static，若判定输入退化成「只有这一条」，legacy 行永远判 owner → 老 slug 回到整块拒渲染。
- **seal 窗口与本轮 attempt 不同源**：preflight 打开无 attempt 的名字时，历史那一对在整个窗口内可写。断言面是「attempt-1 的一对在 attempt-2 的窗口内**不可写**」，不是「能写但不该写」。
- **`isCarrierName` 放宽成「任何产物」**：`-report.md` / `.log` / `-test-evidence.json` / `crash-` 四种形状一旦入判定，sweep 会把报告当载体 seal、board 会把崩溃记录当孤儿列出来。

---

### Task 1: 渲染单源 `render(identity, kind)` + 扫描面收窄

#### Objective

把 `RoundNaming` 的名字派发收成一处：身份 `(line, op, cycle, attempt)` × 种类 `kind ∈ {draft, final, report, log, crash, evidence}` → 一个名字。`attempt === 1` 省略 `-a{n}`；`final` 携 `.c{cycle}`；implement 族的每个 kind 都携 cycle；`evidence` 携 op/cycle/attempt。`finalName` / `logName` / `report` / `evidenceName` / `crashName` 的独立拼装全部改由这一处派生；`#stem`（`session/round-naming.ts:165`）**删除**——stem 与 `-a{n}` 的插入归 `renderName`，`report` / `logName` 反向委派给它（stem 委派给 renderer 是循环，且这两处委派之后 `#stem` 再无调用者，留着就是一条死私有方法）。`isCarrierName` 收窄到只认 `draft` / `final` 两种形状。identity 的 `attempt` 只能来自派发帧，所以 `Lifecycle#paramsOf`（`session/run.ts:651-673`）必须给每一帧填 `attempt: frame.attempt`——两个帧构造点（`:536` / `:575`）把帧的 `attempt` 传进来：不填则 `persistHandoff` 收到无 attempt 的 params、`renderName` 对每次重派都渲 attempt 1，attempt ≥ 2 的 draft / final / report / log / evidence 逐一覆盖 attempt 1 的同名文件，本相位在写面重新引入自己正要治的症状。implement 的 `round` 在同一处填（`#stem` 分支删除后的同笔依赖）；`Ledger#handoffOwner` 的反向归属同批改为从名字结构反解，否则新拼写的未入账载体在孤儿面上静默消失。

#### Files

- Modify: `packages/cdd-engine/src-next/session/round-naming.ts`（新增 `RoundArtifact` / `ArtifactKind` 与 `renderName` / `renderPath`；`logName` / `report` / `evidenceName` / `crashName` 改为委派 `renderName`；`finalName(draftName, round)` / `finalPath(draftName, round)` **退役**——它们收的是名字而非身份，只能靠反解名字再正向渲染（§2.1 的「拿到一个名字再切字符串拼后缀」退役），`resolveHandoffName` 的 final 候选改为 `renderName(identity, "final")`、`persistHandoff` 写 `renderPath(identity, "final")`，调用点 `face/lifecycle.ts:1094` / `session/ledger.ts:1617` / `:1644` / `session/run.ts:915` 随动；删除 `#stem`——stem 与 `-a{n}` 归 `renderName`；`isCarrierName` 的 pattern 只认 draft/final 且容 `(?:-a\d+)?`）
- Modify: `packages/cdd-engine/src-next/session/ledger.ts`（`handoffName` / `handoffPath` 委派 `renderName`；`HandoffParams` 补 `attempt?: number`；`#handoffOwner`（`:1929`）经 `#WAVE_CARRIER`（`:1963`）/ `#LINE_CARRIER`（`:1969`）两张反读表反解、`#attemptOf`（`:1975`）对缺段读 1——不以 `families` 拼写匹配，而是把名字反解成 `(line, op, cycle, attempt)` 再与记录身份比对——不比名字，正向渲染比较在 implement 旧拼写与 pre-P31 的 pathless 行上必错；每族反向读表至少留一条 legacy 拼写（缺坐标按 1 读，§3.4），退役的 `{spec}-{op}-{round}.json` 孪生名同 round · attempt 1——该线词**不在 `families` 里**（`HANDOFF_FAMILIES` 只有 `implement.wave` / `review.*` / `fix.*`），须像 `#LINE_CARRIER`（`session/ledger.ts:1969` 取 `targetFaces` 后并入 `RETIRED_SPEC_KEY`）那样显式并入读表，不得从 `families` 推导；`families` 占位替换只留 legacy 读法）
- Modify: `packages/cdd-engine/src-next/session/run.ts`（`#paramsOf`（:651-673）接帧的 `attempt`，对每一帧填 `attempt`、对 implement 也填 `round`；`:536` / `:575` 两个帧构造点传 `attempt`——`#stem` 删分支后的同笔依赖）
- Test: `packages/cdd-engine/src-next/session/__tests__/round-naming.test.ts`（网格 pin（六个 type × 六个 kind 全比）· 守恒边界 · implement 五 kind 携 cycle · `isCarrierName` 四拒 · `evidenceName` 的两道空串闸（文档形 · 非 implement / fix 相位，`:205-243`）在委派后仍绿）
- Test: `packages/cdd-engine/src-next/session/__tests__/ledger.test.ts`（反向归属：未入账的 `-a2` draft / final 各列出一次、已入账的不列；`tasks-6,7-implement-1.json` → `(6,7) · implement · cycle 1 · attempt 1`；负向 pin——同一 `(line, op, cycle)` 的 attempt-1 记录**不**认领 `tasks-6,7-implement-1-a2.json`（认领键含 `attempt`）；三族 legacy 拼写各一条：`tasks-{tasks}-implement.json` 读成 cycle 1 · attempt 1、`{line}-{op}-{round}.json` 读成该 round · attempt 1、退役的 `{spec}-{op}-{round}.json` 读成同 round · attempt 1（`spec` 线词不在 `families` 里，读表须显式并入，见 Files）；p16 的 pathless 夹具——`{"wave":"1","rounds":{"implement":[1],"review":[1]}}` 折叠出的记录认领 `tasks-1-implement.json`、不列孤儿，同一行的 `-a2` draft 列一次；report/evidence/crash 不入孤儿——它们不是 handoff 家族，列入会与扫描面的四拒相悖）
- Test: `packages/cdd-engine/src-next/infra/__tests__/infra.test.ts`（`CarrierSeal.sweep` 认 `-a{n}` 载体、拒 report/evidence/crash/log）
- Test: `packages/cdd-engine/src-next/face/__tests__/cli.test.ts`（锚点 + 扫描指令：锚点 `:1726` / `:1814` / `:1908` / `:3737` / `:4096` / `:5859` / `:5917`；范围是**两段**——(a) 本文件全部非 crash 的 `tasks-*-implement*` **载体**夹具（draft / final / report / log）实测 40 处；(b) 全部 `*-test-evidence.json` **证据**夹具实测 36 行（四形：`tasks-1-test-evidence.json` / `tasks-4,12-…` / `tasks-2,5-…` / `branch-test-evidence.json`，另有若干散文行）——证据名今日是 `{prefix}-{key}-test-evidence.json`（`session/round-naming.ts:124-130` 的 `evidenceName` 不带 op / cycle），**不在** `tasks-…-implement*` 名集合里，漏掉这 36 行则 acceptance 的「全线 evidence 携三坐标」缺覆盖。证据夹具的改法是把 `{prefix}-{key}-test-evidence.json` 换成 `{prefix}-{key}-{op}-{cycle}-test-evidence.json`（attempt ≥ 2 再加 `-a{n}`；wave 的 `tasks-1-…` 即 `tasks-1-implement-1-…`，`branch` 族随其线的 op / cycle，如 `branch-fix-1-test-evidence.json`）；行内清单只是锚点不是上限；`crash-tasks-…-implement-…json` 是守恒侧，逐字节不变、不得顺手改名）
- Test: `packages/cdd-engine/src-next/face/__tests__/preview.test.ts`（:97 的 implement 载体与证据拼写夹具）
- Test: `packages/cdd-engine/src-next/face/__tests__/lifecycle.test.ts`（:158 的 `tasks-${key}-test-evidence.json` 证据夹具）
- Test: `packages/cdd-engine/src-next/infra/__tests__/carrier-seal.test.ts`（:78 的 `tasks-1-test-evidence.json` 证据夹具）、`packages/cdd-engine/src-next/render/__tests__/render.test.ts`（:42 / :126 的 `OUTPUT_EVIDENCE` 断言）、`packages/cdd-engine/src-next/session/__tests__/handoff-schema.test.ts`（:42 的 `artifacts.test_evidence` 路径）——写进 workspace 或断言的旧证据名在新读回名下不再被读到，留着就是空转夹具

#### Consumes

- `TargetType`（`session/faces.ts`）与 `OpType`（`session/ledger.ts`）的既有词表
- `config.handoffNamespace().families`（既有家族名表——本任务把它降为 legacy 读法；表里**没有 `spec`**，退役孪生名的线词由 `RETIRED_SPEC_KEY` 显式并入读表）

#### Produces

- `type ArtifactKind = "draft" | "final" | "report" | "log" | "crash" | "evidence"`
- `interface RoundArtifact { line: string; op: OpType; cycle: number; attempt: number }`
- `RoundNaming#renderName(identity: RoundArtifact, kind: ArtifactKind): string`
- `RoundNaming#renderPath(identity: RoundArtifact, kind: ArtifactKind): string`
- `HandoffParams.attempt?: number`（缺省分两档：`handoffName` / `handoffPath` / `renderName` 对缺省出 attempt 1 的拼写；`resolveHandoffName` / `resolveHandoffPath` 先经中央缺省 `#attemptAware`（`session/ledger.ts:1736`）把缺省解析成该轮**最新已记录**的 attempt，整轮无记录才落回 1——只持 `(tasks, round)` 的解析读者不传 attempt，靠的正是这条中央缺省）
- `RoundNaming.isCarrierName(name): boolean`（只认 draft/final，含 `-a{n}`）

#### Steps

- 写失败测（网格）：六个 `TargetType`（四个文档形 + wave + branch）× 六个 `kind`（不按面筛——`renderName` 全域渲染）× `attempt` 1–3 × `cycle` 1–2，断言同一 kind 下任意两个不同身份不同名；`""` 不是渲染结果、不入网格 — checkable: 定向 vitest FAIL（今日无 `renderName`）
- 写失败测（守恒边界）：四条文档线的 review / fix 族，每条文档线断言自己的拼写前缀并各带一条守恒字面（`phase-spec-review-1.json` / `phase-spec-review-1.c1.json` / `phase-spec-review-1-report.md` / `phase-spec-review-1.log` 之外，`overall-review-1*` / `plan-review-1*` / `single-spec-review-1*` 各一条），与今日拼写逐字节相同 — checkable: FAIL（今日 `render` 不存在）
- 写失败测（守恒边界 · wave 与 branch 两族）：wave 的 review / fix 族，以及 branch 的 **review 与 fix 两族**——`branch-fix-1.json` / `branch-fix-1.c1.json` / `branch-fix-1-report.md` / `branch-fix-1.log` 与同线 review 族逐字节等于今日拼写；`crash-phase-spec-review-1.json` 这类 `crash` 名对每条线、每个 kind 在 `attempt === 1` 时逐字节不变（attempt ≥ 2 携 `-a{n}`，由 T3 钉——`crashName` 今日不带 attempt 令牌，`session/round-naming.ts:177-179`） — checkable: FAIL（今日 `render` 不存在）
- 写失败测（implement 族）：五个非 crash kind 均携 `-1` 且 `final ≠ draft`；`crash` 保持今日拼写 `crash-tasks-6,7-implement-1.json` — checkable: FAIL
- 写失败测（`evidence` 携三坐标）：`tasks-6,7-implement-1-test-evidence.json` 与 `branch-fix-1-test-evidence.json` — checkable: FAIL
- 写失败测（扫描面四拒）：`isCarrierName` 对 `…-report.md` / `….log` / `…-test-evidence.json` / `crash-….json` 均为 false，对 `tasks-6,7-implement-1-a2.json` 与 `tasks-6,7-implement-1-a2.c1.json` 为 true（携 cycle 的拼写——形状若只容无 cycle 的 `-a2`，会接受渲染面永不铸出的名） — checkable: FAIL（今日 pattern 不认 `-a{n}`）
- 实现 `RoundArtifact` / `ArtifactKind` / `renderName` / `renderPath`：`-a{n}` 插在 stem 尾部、`.c{cycle}` 之前，`attempt === 1` 省略 — checkable: 网格与守恒两组测 PASS
- 把 `logName` / `report` / `evidenceName` / `crashName` 改成对 `renderName` 的委派——委派只替拼写，`evidenceName` 的两道闸（文档形 · 非 implement / fix 相位）留在帧面原样不动、不得并入渲染器；并**删除 `#stem`**——stem 与 `-a{n}` 的插入由 `renderName` 持有，`report` / `logName` 反向委派给它；`finalName` / `finalPath` **退役**（收名字的变换无法渲染身份），四个调用点改取 `renderName` / `renderPath` 的 final 候选 — checkable: implement 组与 evidence 组 PASS · `round-naming.test.ts:205-243` 的两条空串 pin 仍绿
- 把 `Ledger.handoffName` / `handoffPath` 改成委派 `renderName`，`HandoffParams` 补 `attempt`，`families` 的占位替换降为 legacy 读法 — checkable: `ledger.test.ts` 全绿
- 收窄 `isCarrierName` 的 pattern，并让 `CarrierSeal.#isStray` 的判定与之一致 — checkable: 扫描面四拒 PASS · `infra.test.ts` 全绿
- 写失败测（params 携帧 attempt）：一帧 `attempt = 2` 的 implement 派发，其 draft / final / report / log / evidence 名字均携 `-a2`，且 attempt-1 的同名文件不被覆盖 — checkable: FAIL（今日 `#paramsOf` 不带 `attempt`，`renderName` 缺省渲 attempt 1）
- `Lifecycle#paramsOf` 接帧的 `attempt`（`:536` / `:575` 传 `attempt`），对每一帧填 `attempt`、对 implement 也填 `round`，随 `#stem` 分支的删除同笔落地 — checkable: attempt-2 派发测 PASS · implement 派发的产物名携 `-1`（一条夹具断言）· implement 组与 evidence 组 PASS
- 写失败测（反向归属）：`Ledger#handoffOwner` 反解 `-a{n}` / `-{cycle}` 新拼写 — checkable: FAIL（今日只剥 `.c\d+.json` 再按 `families` 拼写端锚匹配，新名零命中）
- 实现反向归属的结构化读法：名字 → `(line, op, cycle, attempt)` → 与**记录身份**比对（不比名字；正向渲染比较在 implement 旧拼写与 pre-P31 pathless 行上必错），每族反向读表至少留一条 legacy 拼写（缺坐标按 1 读，§3.4——三族：`tasks-{tasks}-implement.json` · `{line}-{op}-{round}.json` · 退役 `{spec}-{op}-{round}.json`，末者的线词不在 `families` 里、须显式并入），`families` 拼写只留 legacy 回退 — checkable: 反向归属组 PASS · `ledger.test.ts` 全绿
- 全量回归 — checkable: `pnpm -C packages/cdd-engine exec vitest run` 与 `pnpm exec tsc --noEmit -p packages/cdd-engine` 均 exit 0
- 提交 — checkable: `git log -1 --oneline` 含本任务主题

#### Acceptance

- 网格 pin 绿：六个 type × 六个 kind × attempt 1–3 × cycle 1–2（`renderName` 全域渲染，网格不按面筛 kind），同一 kind 下无同名；`evidence` 的适用面由帧面 `RoundNaming#evidenceName` 的空串判据承担（文档形与非 implement / fix 相位返空串），那两条空串 pin（`round-naming.test.ts:205-243`）与网格同批绿，委派不删闸。
- 守恒边界：四类文档线（每条断一条自己的守恒字面：`phase-spec-review-1*` / `overall-review-1*` / `plan-review-1*` / `single-spec-review-1*`）· wave 的 review/fix 族 · branch 的 **review/fix 两族** · `attempt === 1` 的全部 `crash` 名逐字节不变（attempt ≥ 2 携 `-a{n}`，由 T3 钉；`crashName` 今日不带 attempt 令牌）。
- implement 五个非 crash kind 携 cycle 且 `final ≠ draft`；全线 `evidence` 携 op/cycle/attempt；`Lifecycle#paramsOf` 对每一帧填 `attempt`、对 implement 填 round，attempt-2 的派发名携 `-a2`，派发名不出现 `undefined`。
- `isCarrierName` 只认 draft/final（含 `-a{n}`），四种非载体形状一律 false。
- 反向归属认新拼写且认 attempt：未入账的 `-a2` draft / final 各在 `orphanHandoffs` 出现一次，已入账的不出现；同一 `(line, op, cycle)` 的 attempt-1 记录**不**认领 attempt-2 的文件；`report` / `evidence` / `crash` 不入孤儿；implement 的 `tasks-6,7-implement-1.json` 归属到 `(6,7) · implement · cycle 1 · attempt 1`；三族 legacy 拼写（`tasks-{tasks}-implement.json` = cycle 1 · attempt 1、`{line}-{op}-{round}.json` = 该 round · attempt 1、退役 `{spec}-{op}-{round}.json` = 同 round · attempt 1，末者线词不在 `families` 里、须显式并入读表）与 p16 的 pathless 行一并认领。

#### DependsOn

none

---

### Task 2: 读写缝——记录不携路径，路径经一个 accessor 派生

#### Objective

`RoundRecord` 停写 `carrierPath` / `draftPath`；新增 `Ledger#carrierPathOf(type, key, record)` 与 `RoundRecords#ownerOf(records, record, pathOf)`。accessor 取值三步：① 记录的 `carrierPath` 是非空字符串就用它（legacy 行的历史事实，零迁移）；② 否则走 `resolveHandoffName` 的既有阶梯（`session/ledger.ts:1696-1712`，次序是 shipped 形：final-if-exists → 活线的 cycle 1 · attempt 1 implement legacy 级（先于 canonical）→ canonical；退役 `spec` 孪生线另序 canonical-if-exists → 退役孪生名 → canonical），**不是裸 `renderPath(…, "final")`**——pre-P31 行从未铸过 `.c{cycle}` 拼写，裸渲染指向一个不存在的文件，合法轮次就被硬拒；走阶梯之前先把记录还原成完整身份（`line = type`（wave 线取 `key`）、`op = record.op`、`cycle = record.cycle`、`attempt = record.attempt`，即 `HandoffParams = { tasks: 该 wave 线的 key, round: record.cycle, attempt: record.attempt }`）——漏喂 `attempt` 就会让 attempt-2 的记录因守恒仍在盘上的 attempt-1 final 被 `final-if-exists` 命中，`+N` 拿别人的路径比本记录的 `carrierDigest`；③ 对阶梯给出的候选自探存在（`resolveHandoffName` 的 canonical 级从不 stat——活线在 implement legacy 级 stat 自己的候选后直接返回 `legacy ?? canonical`，退役 `spec` 孪生线只 stat canonical 与退役孪生两级，阶梯报不出「取不到文件」），探不到就返回空，调用方维持 `RequesterRead.unrecorded` / `FIX_DISPOSITIONS_UNRECORDED` 的 soft skip（`contract/completion-criterion.ts:291`），而不是 `unreadable` 硬拒。五条读面改经它们：board 的 `+N`、`Ledger#reviewsPathOf`、`CliLifecycle#reviewsPath`（`face/lifecycle.ts:1301-1309`——第五读面，也是 `CompletionContext.reviewsPath` 的来源）、`FixDispositions` 的 requester 路径、capsule 成功面；`CliLifecycle#judgedRecordOf`（`face/lifecycle.ts:519-531`）不再以 draft 拼写制造 `carrierPath`，`FixDispositions#ownRefusal`（`contract/completion-criterion.ts:487-492`）不再读该格。

摘要半边同批认 `attempt`，落点是 `Ledger#carrierDigestOf`（`session/ledger.ts:1692`）→ `#latestRecordOf`（`:1700`）——**不是** `#requesterDigestOf`（那一处只删路径门）：两者今天只按 op + cycle 过滤再归约最大 attempt，名字带 attempt 而摘要仍归约最大 attempt，一条被重派的 cycle（attempt 2 已入账、attempt 1 的 final 因守恒仍在盘上）就变成「读 attempt 1 的字节、比 attempt 2 的摘要」，`CarrierIntegrity.read`（`session/carrier-integrity.ts:94-102`）对自己的记录抛 `carrier-mismatch`。所以 `#latestRecordOf` 在 `params.attempt` 存在时按它选记录，名字与摘要逐字同源。调用方按手里有没有那条记录分两类：**持有记录的读者传该记录自己的 attempt**（`Ledger#round` `:1917`，其读点 `:1946` / `:1965` / `:1966`，调用点 `:1077` / `:1176` / `:1531`，`Lifecycle#routeNext` `session/run.ts:927`）；**解析读者先取该轮最新 review attempt 再用它取名，绝不继承派发帧的 attempt**（`#reviewsPathOf` `:1717-1720`、`#consecutiveS1Run` `:1882-1893`、`Ledger#round` 的两处 review 读）——帧的 `attempt` 一经 `Lifecycle#paramsOf` 填进 params，attempt-2 的 fix 帧会把 review 记录过滤到 attempt 2、一条都取不到，回退渲出 review 从未写过的 `…-review-1-a2.c1.json`，合法 fix 轮便不产生 Round、re-review hop 也随之消失。记录缺席时回退 attempt 1（§2.5）。

`persistHandoff` 记摘要、不再记路径；capsule 成功面经 `resolveHandoffPath` 取名——`attempt` 已由帧的 params 携带，不再手传第二个参数。

implement 的 legacy 级（`#legacyCarrierName`，读-only，cycle 1 · attempt 1 专用）是 Task 4 反向归属的读面孪生：`orphanHandoffs` 把 `tasks-1-implement.json` 认给 `(implement, cycle 1, attempt 1)` 之后，accessor 必须从同一级把它读回，否则同一行在板上「有主却无载体」。该级只在 implement 族、cycle 与 attempt 都是 1、且渲染出的 legacy 名不等于 canonical 名时生效，命中与否都以文件存在为准。

#### Files

- Modify: `packages/cdd-engine/src-next/session/ledger.ts`（`carrierPathOf`（三步取值序：记录值 → 阶梯的种子身份 → 自探存在）· `resolveHandoffName` 的 implement legacy 级 `#legacyCarrierName` 与阶梯次序（活线 implement legacy 先于 canonical）· `#attemptAware`（:1736）保持中央缺省——`resolveHandoffName` / `resolveHandoffPath` 的缺省仍解析成该轮最新已记录 attempt、整轮无记录才落 1 · `RoundRecords.ownerOf` · `RoundIdentity`（:146-148）摘 `carrierPath` 格 · `#latestRecordOf` 在 `params.attempt` 存在时按它选记录 · `#reviewsPathOf` / `#consecutiveS1Run` / `Ledger#round` 的 review 读为解析读者（剥帧 attempt、取请求侧 review 记录最新 attempt）· `recordRound` 停写两字段 · `persistHandoff` 写 `renderPath(final)` 并 seal 两个名字 · `readHandoff` 接受 `attempt`）
- Modify: `packages/cdd-engine/src-next/session/carrier-integrity.ts`（`readFor` 的「从记录取路径」职责退役，调用点改 `read(path, digest)`）
- Modify: `packages/cdd-engine/src-next/face/board-view.ts`（`#findingsCountOf` 收 `(path, digest, owner)`；行构造处一次算行内全量记录并传判定）
- Modify: `packages/cdd-engine/src-next/contract/completion-criterion.ts`（`requesterPathOf` 退休——请求侧归属判定内联进 `#requesterOf`，`ctx.reviewsPath` 由 `requesterInputOf` 的入参直取；`#requesterDigestOf` 只取 `record.carrierDigest`、删 :423 的 `carrierPath === null` 门；`#ownRefusal` 的「no work carrier at …」文案改由 accessor 取路径或去路径片）
- Modify: `packages/cdd-engine/src-next/face/lifecycle.ts`（`#reviewsPath`（:1301-1309）走 `carrierPathOf` + 请求侧 review 记录的最新 `attempt`（记录缺席回退 1），取路写成一条：`--reviews` → `carrierPathOf`（记录值 → 阶梯种子身份 → 自探存在）→ 解析不到即 `null`——recorded-path 直读（`:1299`）与 legacy `carrierPath === null` 判别（`:1307`）两道同批退役，不留「记录在、载体缺席 → 返回 resolved 名」的第三档（§2.10 的 `unrecorded` 改由 accessor 解析不到载体触发）；`#judgedRecordOf`（:519-531）不再制造 `carrierPath`）；`#resumeOf`（:1761）fix 分支的回退（:1787）只持 cycle——经 `#reviewFamilyPath`（`:1316-1321`，`#reviewsPath` 的无记录支同处调用）以 `{ tasks: frame.params.tasks, round: frame.round }` 调 `resolveHandoffPath("review", …)`，让中央 `#attemptAware`（`session/ledger.ts:1736`）缺省取该 cycle 的最新 review attempt（无则 1），永不把 fix 帧自己的 `attempt` 带进 review 家族）
- Modify: `packages/cdd-engine/src-next/session/run.ts`（`#capsuleLines`（:1008-1031）成功面经 `resolveHandoffPath` 取名，`attempt` 由帧的 params 携带，不手传第二个参数）
- Test: `packages/cdd-engine/src-next/session/__tests__/ledger.test.ts`（accessor 三步取值序 · legacy 行阶梯命中 canonical 名 · pathless implement legacy 行由 legacy 级读回（cycle 1 命中 `tasks-1-implement.json`、cycle 2 不命中，orphan 认领与读面一致）· 阶梯种子取 `record.attempt`：一条 attempt-2 记录在 attempt-1 final 仍在盘上时命中 attempt-2 的 final · 阶梯候选全缺返空（doc / wave / branch 三线各一条）· `ownerOf` 三例 · 摘要缝同源两例：attempt 2 与显式 attempt 1 · 解析读者不继承帧 attempt · 中央缺省两例：只有 attempt-2 记录且无 `-a2` 候选时，只持 `(tasks, round)` 的 `resolveHandoffPath("review", …)` 仍解析到 attempt 2；整轮无记录时落回 attempt 1）
- Test: `packages/cdd-engine/src-next/face/__tests__/board-view.test.ts`（重派两次后零 `carrier-mismatch` · 旧 attempt 的 `+N` 来自自己的产物 · legacy 失配行计 0 · 无 `carrierPath` 的 legacy 行经阶梯命中 canonical 并计入 · 节点板的 `overall` 行读 program workspace 的 progress 与 ledger：program 的 review 轮只出现一次且带自己的 `+N`，节点自身多出的 `overall` 行不参与）
- Test: `packages/cdd-engine/src-next/face/__tests__/lifecycle.test.ts`（attempt-2 夹具：`--reviews` 读回 attempt-2 final；篡改 attempt-2 final 仍抛 `carrier-mismatch`；新记录在阶梯候选全缺时 `#reviewsPath` 返 `null`、fix 轮落 `RequesterRead.unrecorded` 的 soft skip 而非 `unreadable` 硬拒；attempt-2 fix 帧的 Round 非 null；`#resumeOf` 回退的第二条夹具：一次崩溃的 review（记录在册、`#reviewsPath` 返 `null`）后 fix 重派到 attempt 2 → `next:` 与 in-flight `command` 的 `--reviews` 是该 cycle 的最新 review attempt 名，不出现 `…-review-{round}-a2` 的幽灵名）
- Test: `packages/cdd-engine/src-next/contract/__tests__/completion-criterion.test.ts`（无 `carrierPath` 而有 `carrierDigest` 的记录 + 一字节篡改 → `CarrierMismatchError`；accessor 解析不到载体 → `RequesterRead.unrecorded` 的 soft skip，不落 `unreadable`；pre-P31 pathless 行的 fix 轮读到 canonical 名载体的 findings 并照常判 dispositions、零摘要比对）

#### Consumes

- Task 1 的 `renderName` / `renderPath` / `HandoffParams.attempt`（缺省两档：写面 `handoffName` / `handoffPath` / `renderName` 落 1；解析面 `resolveHandoffName` / `resolveHandoffPath` 经 `Ledger#attemptAware` 落该轮最新已记录 attempt，整轮无记录落 1）
- 既有 `CarrierIntegrity.read(path, recordedDigest)` 三态读
- 既有 `BoardView#summaryCell` 的行构造点与 `Lifecycle#capsuleLines` 的成功面

#### Produces

- `Ledger#carrierPathOf(type: string, key: string, record: RoundRecord): string`（`type` / `key` 故意收 `string` 而非 `TargetType` / `LedgerKey`：board 的行构造以 `string` 持有 `line` / `key`，收窄只会把两个调用点变成断言，而 `carrierPathOf` 把它们原样转手 `#resolvedCarrierName`、从不据其分派）
- `RoundRecords#ownerOf(records: readonly RoundRecord[], record: RoundRecord, pathOf: (candidate: RoundRecord) => string): boolean`（路径以投影传入：`RoundRecords` 没有 workspace，解析不了名字，两参版本不可实现）
- `CarrierIntegrity.readFor` 退役（调用点改 `read`）
- `FixDispositions#requesterDigestOf` 只看 `record.carrierDigest`（不再以 `carrierPath` 为门；摘要的**按哪条记录取**由 `#latestRecordOf` 的 `params.attempt` 收窄决定）
- `recordRound` 的写入面不再产生 `carrierPath` / `draftPath`（字段保留为只读 legacy）；`RoundIdentity` 的 `carrierPath` 格随 `#judgedRecordOf` 一同摘除

#### Steps

- 写失败测（accessor 三步取值序）：记录带非空 `carrierPath` → 原样返回；记录无 `carrierPath`、canonical 名在盘上 → 走阶梯命中 canonical；`carrierPath` 为空串 → 同样走阶梯，不当「空串路径」返回 — checkable: 定向 vitest FAIL
- 写失败测（legacy 行阶梯命中）：一条 doc / wave / branch 记录无 `carrierPath`、载体停在 canonical 家族名（pre-P31 行从未铸 `.c{cycle}`）→ accessor 返回该 canonical 名，board 的 `+N` 计入且零摘要比对 — checkable: FAIL（今日裸 `renderPath(…, "final")` 指向不存在的 `.c{cycle}`）
- 写失败测（阶梯种子不丢 attempt）：一条 attempt-2 记录（无 `carrierPath`）与守恒仍在盘上的 attempt-1 final → accessor 以 `record.attempt = 2` 为种子走阶梯，命中 attempt-2 的 final，不命中 attempt-1 — checkable: FAIL（种子漏喂 attempt 时 `final-if-exists` 命中 attempt-1，`+N` 拿别人的路径比本记录的摘要）
- 写失败测（pre-P31 行读全 findings）：一条记录整条无 `carrierPath`、载体停在 canonical 名 → fix 轮读到该载体的 findings 并照常判 dispositions，零摘要比对 — checkable: FAIL
- 写失败测（pathless implement legacy 行）：一条 `rounds: {implement: [1]}` 折叠出的记录（无 `carrierPath`，磁盘上是 `tasks-1-implement.json`）→ accessor 从 legacy 级读到该文件，`orphanHandoffs` 与 `+N` 对同一文件一致；同记录的 cycle 2 不命中 — checkable: FAIL（今日阶梯只有退役 `spec` 孪生级，canonical / final 两名都探不到）
- 写失败测（阶梯候选全缺 → 软跳过）：记录无 `carrierPath`、阶梯的 final / canonical / 退役 `spec` 三级均探不到 → accessor 返回空，fix 轮落 `RequesterRead.unrecorded` / `FIX_DISPOSITIONS_UNRECORDED`（`contract/completion-criterion.ts:291`）的 soft skip，而非 `unreadable` 硬拒；doc / wave / branch 三线各一条夹具 — checkable: FAIL
- 写失败测（`ownerOf` 三例）：同一路径更大 `(cycle, attempt)` → false；同路径同身份 → true；路径不同 → true — checkable: FAIL
- 写失败测（board 重派）：两条 attempt 记录 + 各自产物 → 渲染不抛，两个 token 的 `+N` 各来自自己的文件 — checkable: FAIL（今日整块抛）
- 写失败测（legacy 失配）：一条被覆写的历史记录 → `+N` = 0、不抛 — checkable: FAIL
- 写失败测（attempt-2 读写）：`--reviews` 解析到 attempt-2 final，`readHandoff` 读回它 — checkable: FAIL
- 写失败测（篡改不退化）：改 attempt-2 final 一字节 → 仍抛 `carrier-mismatch` — checkable: FAIL
- 写失败测（摘要缝同源）：attempt 2 已入账、attempt 1 的 final 仍在盘上 → `readHandoff(…, { attempt: 2 })` 读 attempt-2 的字节、比 attempt-2 的摘要，零 `carrier-mismatch` — checkable: FAIL（今日 `#latestRecordOf` 归约最大 attempt，不看 `params.attempt`）
- 写失败测（显式 attempt 1）：`readHandoff(…, { attempt: 1 })` 读 attempt-1 的文件、比 attempt-1 的摘要 — checkable: FAIL
- 写失败测（解析读者不继承帧 attempt）：一个 fix 帧 `attempt = 2`、同 cycle 的 review 记录只到 attempt 1 → `Ledger#round` 产生非 null Round，`reviewsPath` 是 attempt-1 的 final 名，`consecutiveS1` 与 attempt-1 读数相同，`Lifecycle#routeNext` 仍发 re-review hop — checkable: FAIL（`Lifecycle#paramsOf` 填 attempt 后，三个解析读者会把 review 记录过滤到 attempt 2）
- 写失败测（摘要缝独立于路径字段）：一条无 `carrierPath`、有 `carrierDigest` 的 review 记录 + 其载体被翻一字节 → fix 派发仍抛 `CarrierMismatchError` — checkable: FAIL（今日 `#requesterDigestOf` 返 null，零比对）
- 实现 `carrierPathOf`（三步取值序 + 阶梯的种子身份）与 `RoundRecords.ownerOf` — checkable: 前三组测 PASS
- `#latestRecordOf` 在 `params.attempt` 存在时按它选记录（名字与摘要同源）— checkable: 摘要缝同源与显式 attempt 1 两组测 PASS
- `recordRound` 停写两字段、`persistHandoff` 记摘要不记路径、`CarrierIntegrity.readFor` 退役并改调用点 — checkable: `ledger.test.ts` 与 `carrier-integrity.test.ts` 全绿
- `#requesterDigestOf` 改为只读 `carrierDigest`、删 :423 的门 — checkable: 摘要缝测 PASS
- 五条读面改为经 accessor（board / `#reviewsPathOf` / `#reviewsPath` / `FixDispositions` / capsule）— checkable: board 与 lifecycle 定向测 PASS
- 三个解析读者（`#reviewsPathOf`、`#consecutiveS1Run`、`Ledger#round` 的 `:1946` / `:1965` review 读）剥掉帧的 `attempt`，改传请求侧 review 记录的最新 attempt（无记录回退 1，§2.5）— checkable: 解析读者测 PASS
- `#reviewsPath` 的 attempt 取请求侧 review 记录的最新值（无记录回退 1，不向帧的值靠），body 写成一条：`--reviews` → `carrierPathOf` → 解析不到即 `null`（recorded-path 直读与 legacy `carrierPath === null` 两道退役，不留「记录在、载体缺席 → 返回 resolved 名」的第三档） — checkable: 新记录在阶梯候选全缺时落 `unrecorded` 软跳过、不落硬拒（lifecycle attempt-2 测）
- 写失败测（`#resumeOf` 回退只持 cycle）：一次崩溃的 review（记录在册、载体缺席 → `#reviewsPath` 返 `null`）之后 fix 重派到 attempt 2 → 崩溃记录的 `next`（`face/lifecycle.ts:1550`）与 in-flight 记录的 `command`（`:802`）里的 `--reviews` 都是该 cycle 最新 review attempt 的名，不出现 `…-review-{round}-a2` 的幽灵名 — checkable: FAIL（今日回退把 `frame.params` 整份交出去，帧的 `attempt = 2` 渲染出 review 从未写过的名）
- `#resumeOf` 的 fix 分支回退改为只持 cycle（`{ tasks: frame.params.tasks, round: frame.round }`），attempt 交由 `#attemptAware` 的中央缺省解析 — checkable: 回退测 PASS · `lifecycle.test.ts` 全绿
- `#judgedRecordOf` 摘掉 `carrierPath` 格，`#ownRefusal` 文案不再读它 — checkable: `completion-criterion.test.ts` 全绿
- 全量回归 — checkable: `pnpm -C packages/cdd-engine exec vitest run` 与 typecheck exit 0
- 提交 — checkable: `git log -1 --oneline` 含本任务主题

#### Acceptance

- 新记录不含 `carrierPath` / `draftPath`；五条读面（board · `#reviewsPathOf` · `#reviewsPath` · `FixDispositions` · capsule）全部经 accessor 派生；accessor 走三步取值序（记录值 → 阶梯的种子身份 → 自探存在），阶梯候选全缺时返回空，该轮因而一律落 `RequesterRead.unrecorded` / `FIX_DISPOSITIONS_UNRECORDED` 的 soft skip——记录携 `carrierDigest` 也不改判，不落 `unreadable` 硬拒（`#reviewsPath` 不留第三档）。
- 重派两次后 board 零 `carrier-mismatch`，每个 attempt 的 `+N` 来自自己的产物。
- 节点板的行装配按线取源：`spec` / `plan` 行读本节点 workspace 的 progress 与 ledger，`overall` 行读 program workspace（overall 文档 slug）自己的 progress 与 ledger，program 的轮次在节点板上只出现一次、带自己的 `+N`。
- legacy 行两档：无 `carrierPath` 而载体停在 canonical 名的判为已记录（阶梯命中、零摘要比对；fix 轮读到其 findings 并照常判 dispositions）；被覆写的失配行 present-facts（`+N` = 0、不抛）；pathless 的 implement legacy 行（`rounds: {implement: [1]}`）由 legacy 级读回 `tasks-1-implement.json`（cycle 1 命中、cycle 2 不命中，与 orphan 认领同一事实）；外部篡改仍抛——包括无 `carrierPath` 而有 `carrierDigest` 的记录（摘要缝不依赖路径字段）。阶梯的种子恒取 `record.attempt`（attempt-2 记录不落到 attempt-1 的 final）；阶梯候选全缺时 doc / wave / branch 三线各落软跳过。
- attempt-2 的 draft/final/report/log 由渲染命名；名字与摘要取自同一条记录——`readHandoff` 带 `attempt: 2` 读 attempt-2 的字节与 attempt-2 的摘要，带 `attempt: 1` 读 attempt-1 的两者，零 `carrier-mismatch`；attempt-2 的 fix 帧产生非 null Round，`reviewsPath` 是 attempt-1 的 final 名，`consecutiveS1` 与 attempt-1 读数相同，re-review hop 仍由 `Lifecycle#routeNext` 发出。
- `HandoffParams.attempt` 的缺省两档：`handoffName` / `handoffPath` / `renderName` 落 1；`resolveHandoffName` / `resolveHandoffPath` 经 `#attemptAware` 落该轮最新已记录 attempt（整轮无记录落 1）——只持 `(tasks, round)` 的解析读者因此仍读到 attempt 2，不把缺省重新变成 1。
- `#resumeOf` 的回退只持 cycle：崩溃的 review（记录在册、载体缺席 → `#reviewsPath` 返 `null`）后 fix 重派到 attempt 2，`next:` 与 in-flight `command` 的 `--reviews` 是该 cycle 的最新 review attempt 名（无则 attempt 1），不出现 `…-review-{round}-a2` 的幽灵名；requester 载体在场的那一半仍取 review 记录自己的 attempt-1 final 名。

#### DependsOn

1

---

### Task 3: preflight/seal 窗口同源 + 守卫 pin + changeset

#### Objective

preflight 的 unseal 集合、terminal 的 seal 集合与 `#writeCrash` 的写入名在 HEAD 已随 T1 同源落地：`#openRoundCarriers`（`face/lifecycle.ts:1058`）→ `#roundCarrierNames`（`:1080`）→ `#roundCarrierNamesOf`（`:1086`）走 `artifactOf` + `renderPath` 的 draft / final 两 kind，`session/run.ts:908-912` 的 `#sealRoundCarriers` 同形，`#writeCrash`（`:1515`）写 `this.#naming.crashName(frame)`（`:1529`），帧的 `params.attempt` 由 `session/run.ts:653-674` 的 `#paramsOf` 每帧填好。T3 的剩余范围因此收窄成三块：**abort fold 的 params 携记录自己的 attempt 已由 `c2feec9f` 落地**（`#bookAbort`（`:294`）在 `:314` 把记录自己的 `attempt` 交给三参形 `#waveParams(key, cycle, attempt)`（`:321`），implement 族同带 `cycle`），本任务只为它补 attempt-2 的覆盖测、不重写实现；三条守卫 pin 的收口（(a) 已由 T2 落在 `session/__tests__/carrier-path.guard.test.ts:37-60`，只核不写；新增 (b) 零名字拼装与 (c) 写路径零占位表）；attempt-2 的窗口 / 崩溃覆盖测与既有 changeset 的确认。

#### Files

- Modify: `packages/cdd-engine/src-next/face/lifecycle.ts`（`#bookAbort`（:294）→ `#waveParams(key, cycle, attempt)`（:321）的同源形已由 `c2feec9f` 落地，实现不重写；本任务的改动只是 docstring 退役——`#roundCarrierNames` 的注释（:1079-1082，句子 `A cycle-less identity resolves both to the same path — one name, sealed once.`，在 `:1081` 的 `— one` 与 `:1082` 的 `name, sealed once. */` 之间折行）随 T1 退役：T1 之后 implement 族的 draft / final 是两个名字，该句对窗口 / seal 的读者是假陈述。`:318-320` 那处「the implement family is round-less」已由 P31 §2.4 的 abort-record 段落替换，HEAD 的 `face/lifecycle.ts` 无 `round-less` 措辞，故不在退役清单内。窗口面与 `#writeCrash` 已同源，不动）
- Confirm: `packages/cdd-engine/src-next/session/run.ts`（`#sealRoundCarriers` 的 docstring（:904-908）在 HEAD 已改述为「two rounds of the same line never close each other's window」，无 implement 族 round-less 断言——T3 只核、不改；该文件在 T1 的 Files 内随 `#paramsOf` 落笔）
- Test: `packages/cdd-engine/src-next/face/__tests__/lifecycle.test.ts`（attempt-2 窗口覆盖测：attempt-1 一对不可写 · 窗口内只有 attempt-2 一对可写 · review 轮崩溃记录落在渲染名上且 attempt 2 不覆盖 attempt 1 · 失败面 capsule 行与 resume 决策读回同一个 attempt-2 崩溃名 · attempt-2 fix 轮的 `#resumeOf` 写出的 `next` 携 attempt-1 review final 名，不携 `…-review-1-a2` 幽灵名 · abort fold 用例：attempt-2 记录折叠后 attempt-2 一对 sealed 且 attempt-1 一对未动，implement 折叠出 `tasks-{tasks}-implement-{cycle}` 而非 legacy 名。今日只 P31 的通用封印窗用例（:1154 起），无 attempt-2 专门用例）
- Test: `packages/cdd-engine/src-next/session/__tests__/round-naming.test.ts`（守卫 (b) 零 `.c${` / `-report.md` / `-a${` / `-test-evidence` 名字拼装字面，判面「`RoundNaming` 之外的**非注释代码行**」，今日零命中；守卫 (c) 写路径零 `families` 占位替换——`#family(op, type)` 的键集校验（`session/ledger.ts:1584-1588`）是 loud unknown-family 抛错、不铸名字，不入判面）
- 守卫 (a) 归 `packages/cdd-engine/src-next/session/__tests__/carrier-path.guard.test.ts:37-60`（T2 已落：作用域是 `session/ledger.ts` 单文件，文件头 :10-20 写明收窄理由——其他平面把载体当**入参事实**读、不解析名字，故不可跳过阶梯），T3 只核不写，不重开第二份
- Confirm: `.changeset/p34-naming-derivation-tolerance.md`（`@oscaner-skills/cdd-engine` minor）已在册，正文覆盖本相位全部消费面字节（命名单源 · 记录不带路径 · board 崩溃行 · 两档读回 · 开放 wave 层判据 · 证据名单源），T3 不再新增第二份 minor

#### Consumes

- Task 1 的 `renderPath` 与 `isCarrierName`
- Task 2 的 `carrierPathOf`（abort fold 取记录自己的 attempt）
- 既有 `CarrierSeal.sweep` / `CarrierSeal.seal` 与 `#openRoundCarriers` 的窗口位置

#### Produces

- `CliLifecycle#roundCarrierNamesOf` 返回本轮的两个名字（attempt 与记录/帧同源；HEAD 已交付）
- `CliLifecycle#waveParams(key, cycle, attempt)` 返回记录自己的完整身份（折叠封的形状不再取决于 `op`，故 `op` 不是参数；implement 族同带 `cycle`，abort fold 与帧路径同形）
- 两条新守卫测试（零名字拼装 · 写路径零占位表）＋ 守卫 (a) 的核验（既有文件，不重写）

#### Steps

- 补覆盖测（窗口同源，terminal 后）：attempt-2 轮结束后尝试写 attempt-1 的 draft/final 被拒，attempt-2 的一对也是 sealed — checkable: 定向 vitest PASS（现状即绿：`#roundCarrierNamesOf` 已走 `renderPath` 的两 kind，作回归防线）
- 补覆盖测（窗口内可写面）：窗口打开期间只有 attempt-2 的一对可写 — checkable: PASS（回归防线）
- 补覆盖测（review 轮崩溃 + fix resume）：review 失败面写出 `crash-{line}-{op}-{cycle}.json`，attempt 2 写 `…-a2.json` 且 attempt 1 的文件不被覆盖；同一夹具的失败面 capsule 行与前 `next:` resume 决策都读回 attempt 2 的名字；fix resume 的 `--reviews` 携 requester review 记录的 attempt-1 final 名（fix 帧的 `attempt = 2` 不泄漏进 review 家族）— checkable: PASS（`#writeCrash` 已走 `crashName`，`--reviews` 由 T2 的解析读者规则承载；缺的是 attempt-2 专门用例，不是实现）
- 补覆盖测（abort fold 的 attempt 同源）：attempt-2 的 review / fix 记录 abort fold 后 attempt-2 一对 sealed、attempt-1 一对未动；implement 轮折叠出 `tasks-{tasks}-implement-{cycle}.json` 而非 legacy 无 cycle 名 — checkable: 定向 vitest PASS（现状即绿：`#waveParams`（:321）已是 `(key, cycle, attempt)`、`#bookAbort` 在 `:314` 传记录自己的 attempt，本组作回归防线）
- 退役 `#roundCarrierNames` 的 cycle-less docstring——`face/lifecycle.ts:1079-1082`（`session/run.ts:904-908` 已改述、不动；`:318-320` 已由 P31 §2.4 段落替换，不在清单内）— checkable: 红先跑——今日 `grep -n "cycle-less identity resolves both" packages/cdd-engine/src-next/face/lifecycle.ts` 1 命中（`:1081`）、exit 0；退役后同一 grep 零命中、exit 1。判据不取 `round-less`（HEAD 已无该措辞，恒绿、exit 1）也不取 `one name, sealed once`（该句被 `:1081` 的 `— one` 与 `:1082` 的注释星号加换行切开，单行 grep 恒 0 命中——活句子因此漏网）；若要一次连折行判完，用 `perl -0777 -ne 'exit(/cycle-less identity resolves both to the same path[^\n]*\n\s*\*?\s*name, sealed once/ ? 1 : 0)' packages/cdd-engine/src-next/face/lifecycle.ts`（今日 exit 1 = 命中、退役后 exit 0 = 绿）
- 写守卫 (b)：`RoundNaming` 之外非注释代码行零 `.c${` / `-report.md` / `-a${` / `-test-evidence` 拼装字面 — checkable: PASS（今日零命中：`session/handoff-schema.ts:226` 已由 T6 ③ 改述为 `OUTPUT_EVIDENCE`，历史拼写不入集；三条注释 `infra/carrier-seal.ts:11` / `infra/workspace.ts:150` / `face/lifecycle.ts:545` 不入集；零命中即绿，不得为新开豁免着色）
- 写守卫 (c)：写路径零 `families` 占位替换（名字只经 `RoundNaming.renderName` 铸出） — checkable: PASS（`#family` 的键集校验不入判面）
- 核守卫 (a)：`session/__tests__/carrier-path.guard.test.ts` 仍在且绿 — checkable: PASS（不重写；非测试全树唯一读点是守卫自身作用域内的 `session/ledger.ts:1804`，红集为零）
- 确认既有 changeset 覆盖命名面 — checkable: `pnpm exec changeset status` 列出 `p34-naming-derivation-tolerance`
- 全量回归 — checkable: `pnpm run validate` exit 0
- 提交 — checkable: `git log -1 --oneline` 含本任务主题

#### Acceptance

- attempt-2 的派发只 unseal attempt-2 的一对；attempt-1 一对在整轮不可写；terminal seal 同一对；abort fold 取记录自己的 attempt——attempt-2 折叠封 attempt-2 一对、attempt-1 不动，implement 折叠出 `tasks-{tasks}-implement-{cycle}` 而非 legacy 名。
- 崩溃遗留的 `-a{n}` 载体被 sweep 认出并封印；四种非载体形状不被当载体。
- review 轮的崩溃记录落在渲染名上，attempt 2 不覆盖 attempt 1；失败面 capsule 行与 resume 决策读回同一个 attempt-2 名字；fix resume 的 `next` 携 requester review 的 attempt-1 final 名。
- legacy 轮窗口 = 本轮身份渲染出的那一对：implement 族换新拼写 `tasks-{tasks}-implement-{cycle}.json`（§2.6 的例外），其余族与历史拼写同字节；历史 implement draft 保持 sealed，由 T4 的 legacy 拼写档认领——preflight 不为它开窗（spec §2.11 的「窗口名与历史名同字节」在 implement 族不成立，例外以本行为准）。
- 守卫 pin 三条、判面各自写死：(a) 由 `session/__tests__/carrier-path.guard.test.ts:37-60` 承担——判面是 `session/ledger.ts` 的记录存储 + `#reviewsPathOf` 的委派路由，不是全树；与 spec §2.12 全树口径之间的差额（其他平面以入参事实读、不解析名字）理由写在守卫文件头 :10-20，spec 那侧的收敛属 spec 文档轮，不在本轮判面。(b) `RoundNaming` 之外非注释代码行零拼装：今日零命中即绿，不得开豁免。(c) 写路径零 `families` 占位替换（`#family` 的键集校验不入判面）。
- docstring 退役由活闸判：`grep -n "cycle-less identity resolves both" packages/cdd-engine/src-next/face/lifecycle.ts` 退役前 1 命中（`:1081`）、退役后零命中；判据不取 `round-less`（HEAD 已无该措辞）与 `one name, sealed once`（该句在 `:1081` / `:1082` 折行，单行 grep 不可见）。
- changeset：既有 `.changeset/p34-naming-derivation-tolerance.md`（minor）在册且覆盖命名面，不新增第二份；`pnpm run validate` exit 0。

#### DependsOn

2

---

### Task 4: 孤儿归属 = 记录归属

#### Objective

`Ledger#orphanHandoffs` 的认领谓词从「本行有一条 `targetAction` 的轮」改为「本行任意记录认领该文件的完整身份」——认领键是产物自己的渲染身份 `(line, op, cycle, attempt)`，`kind` 由文件名的后缀读出，legacy 拼写缺该坐标时按 1 读（§3.4），**`attempt` 不是可以丢掉的坐标**（attempt-free 键会让 attempt-1 记录也认领 `-a2` 文件，而 §2.6 的守恒让 attempt-1 的 final 仍在盘上，「出现恰好一次」永远不可能成立）。abort 轮（`interrupted`）算认领；legacy 行再由记录侧的载体路径直指同一文件补一档认领——该值一律经 `Ledger#carrierPathOf(type, key, record)` 取（不裸读 `carrierPath`，守卫 pin 不为 `#orphanHandoffs` 开口子），比较基准是两侧的 `path.basename`（`persistHandoff` 返回含目录的绝对形，扫描面拿裸 `entry.name`）。board 的 `orphan:` 文案不动——它本来就是这么说的。

#### Files

- Modify: `packages/cdd-engine/src-next/session/ledger.ts`（`orphanHandoffs` 的认领谓词改为完整身份；legacy 认领档经 `carrierPathOf` 取记录侧值并以 `path.basename` 两侧比较）
- Test: `packages/cdd-engine/src-next/session/__tests__/ledger.test.ts`（BLOCKED 落载体不列孤儿 · 未入账草稿仍列 · legacy `carrierPath` 直指算认领）
- Test: `packages/cdd-engine/src-next/face/__tests__/board-view.test.ts`（board 的 `orphan:` 行只列真孤儿）

#### Consumes

- Task 1 的身份渲染（把名字反解成 `(line, op, cycle, attempt)`，缺坐标的 legacy 拼写按 1 读）
- Task 2 的 `Ledger#carrierPathOf`（legacy 档）

#### Produces

- `orphanHandoffs()` 的认领语义：任意记录认领 + legacy 路径直指认领

#### Steps

- 写失败测（BLOCKED 落载体）：一行有 `targetAction: false` 且记录了 `carrierPath`，文件在 → 不列孤儿 — checkable: 定向 vitest FAIL
- 写失败测（真孤儿仍在）：文件在、本行无记录 → 仍列 — checkable: FAIL
- 写失败测（legacy 认领）：记录经 `carrierPathOf` 给出的值（含目录的绝对形）以 `path.basename` 直指该文件、但名字反解不出同一 `(line, op, cycle, attempt)` → 不列 — checkable: FAIL
- 写失败测（认领键含 attempt）：同一 `(line, op, cycle)` 的 attempt-1 记录与磁盘上的 `-a2` draft（attempt-1 的 final 因守恒仍在盘上）→ `-a2` draft 仍列一次，attempt-1 记录不认领它 — checkable: FAIL（今日认领集是 `${op}:${cycle}`）
- 写失败测（legacy 拼写仍认领）：`tasks-{tasks}-implement.json` 读成 cycle 1 · attempt 1，`{line}-{op}-{round}.json` 与退役的 `{spec}-{op}-{round}.json` 读成该 round · attempt 1（`spec` 线词不在 `families` 里，读表须显式并入），pathless 行（`{"wave":"1","rounds":{"implement":[1],"review":[1]}}`）认领 `tasks-1-implement.json`、不列 — checkable: FAIL
- 改谓词与 legacy 档 — checkable: 上述五条写失败测 PASS
- 全量回归 — checkable: `pnpm -C packages/cdd-engine exec vitest run` 与 typecheck exit 0
- 提交 — checkable: `git log -1 --oneline` 含本任务主题

#### Acceptance

- BLOCKED / abort 但已入账的载体不再列孤儿；真正未入账的仍列一次；legacy 路径直指算认领（记录侧值经 `carrierPathOf`、两侧 `path.basename`）。认领键含 `attempt`：attempt-1 记录不认领 attempt-2 的文件；`tasks-6,7-implement-1.json` 归属到 `(6,7) · implement · cycle 1 · attempt 1`；三族 legacy 拼写（含退役的 `{spec}-{op}-{round}.json`，同 round · attempt 1）与 p16 pathless 行认领成功。
- board 的 `orphan:` 文案保持 `no recorded round owns it`（它现在为真）。

#### DependsOn

1, 2

---

### Task 5: 崩溃 / 中断的来源行（不参与分级）

#### Objective

board 在 `in-flight` / `orphan` 同级加一行 `crashed:`，由记录自己的 `violations[].cause` 派生，列出 `(op, cycle·attempt, cause)`；`✗` 保留。成员谓词是**合取**：`verdict.targetAction === false && violations.some((v) => v.grade === "hard")`——只有同时「没有交付」且「有一条 hard 登记」的轮才列（判别子是 `RoundViolation.grade`，不是条目数：成功的轮也带 soft 条目，其 `cause` 缺省就是 `contract-violation`）。每轮一个 token，取**该轮记录顺序里第一条 hard 条目**（soft-only 的轮由谓词本身排除，token 规则因此遇不到取不到条目的轮）；行内 token 按 `(cycle, attempt)` 排序——与 `BoardView.#byRound`（`face/board-view.ts:495-499`）同一序，不按记录写入顺序。该行是纯观测，不参与任何判定。

#### Files

- Modify: `packages/cdd-engine/src-next/face/board-view.ts`（`inFlightRows` 同级渲 `crashed:` 行，数据源为行内记录）
- Modify: `packages/cdd-engine/src-next/face/lifecycle.ts`（`#verdictOf`（`:420`）的合成条目 `:440-443`——作者零条目时 `RoundViolation.hard(…, CONCLUDED_BLOCKED_CAUSE)`；本任务只由 `crashed:` 行消费它，判定面零改动）
- Confirm: `packages/cdd-engine/src-next/session/ledger.ts`（`CONCLUDED_BLOCKED_CAUSE = "round-blocked"` `:97`——合成 cause 的字面单源，本任务不新增第二条字面）
- Test: `packages/cdd-engine/src-next/face/__tests__/cli.test.ts`（no-host 派发夹具 `:6696` 在 `:6715` 逐字断言合成条目的 `cause: "round-blocked"`——它先于本任务就绿，本任务让它与 `crashed:` 行同批可核）
- Test: `packages/cdd-engine/src-next/face/__tests__/board-view.test.ts`（有 hard 崩溃记录时该行存在且带 cause · 只带 soft `#logUnavailable` 的 APPROVED 评审不出现 · child 声明 BLOCKED 未写回文档（只带 `WRITE_BACK_UNMEASURED` 一条 soft）的轮不出现 · 同一轮两条 hard 条目只取记录顺序第一条 · 无崩溃时不出现 · 有无崩溃两夹具的 `next:` / `+N` / 计数逐字节相同）

#### Consumes

- `RoundRecord.violations[].cause` 的既有值域（`contract-violation` / `interrupted` / `stalled` / `over-budget` / `signal` / `child-exit`）
- 引擎为「作者零条目」的轮合成的 `round-blocked`——**本任务首次消费**，不属于上面那条既有值域：字面单源是 `session/ledger.ts:97` 的 `CONCLUDED_BLOCKED_CAUSE`，合成点是 `face/lifecycle.ts:440-443` 的 `#verdictOf`

#### Produces

- `BoardView` 的 `crashed:` 行渲染（零分级接入）

#### Steps

- 写失败测（行存在）：一条 `targetAction: false` 且带 hard `interrupted` 的记录 → board 含 `crashed:` 且带 `interrupted` — checkable: FAIL
- 写失败测（soft-only 不列）：一条 APPROVED 评审只带 `#logUnavailable`（`cause` 缺省 `contract-violation`）→ 该行不出现它 — checkable: FAIL（按「有 violation」读会印成一次崩溃）
- 写失败测（soft-only 的 BLOCKED 不列）：child 声明 BLOCKED、未写回文档、只带 `WRITE_BACK_UNMEASURED` 一条 soft（`targetAction === false`）→ 仍不出现 — checkable: FAIL
- 写失败测（每轮一个 token）：同一轮两条 hard（`stalled` 后 `child-exit`）→ 只取记录顺序第一条 — checkable: FAIL
- 写失败测（无崩溃不出现）：记录无 violation → 不渲该行 — checkable: FAIL
- 写失败测（不参与分级）：同一 slug 两夹具（有 / 无崩溃记录）的 `next:` 行、`+N` 与 blocker 计数逐字节相同 — checkable: FAIL
- 写失败测（合成条目自带 cause）：一条 BLOCKED / TIMEOUT 且作者零条目的轮 → `crashed:` 行带的就是引擎合成的那条 `round-blocked` — checkable: FAIL（今日无该行；合成行为本身现状即绿——`face/lifecycle.ts:440-443` 以 `CONCLUDED_BLOCKED_CAUSE` 合成，no-host 夹具 `face/__tests__/cli.test.ts:6696` 的 `:6715` 逐字断言 `cause: "round-blocked"`，本步不重造它）
- 写失败测（声明式 BLOCKED 不补条目）：与上一步同一夹具里再放一条声明 BLOCKED、只带 soft 条目（`WRITE_BACK_UNMEASURED`）的轮 → 该轮不进 `crashed:`，行内只剩上一步那条 — checkable: FAIL（今日无该行；合成条件是「作者零条目」而非「没有 hard」，单独断言「不出现」在无该行时恒绿，故与上一步同夹具）
- 实现渲染 — checkable: 上述八条写失败测 PASS
- 全量回归 — checkable: `pnpm -C packages/cdd-engine exec vitest run` 与 typecheck exit 0
- 提交 — checkable: `git log -1 --oneline` 含本任务主题

#### Acceptance

- `crashed:` 行按记录列出 cause 与 `(cycle, attempt)`，每轮一个 token（该轮记录顺序第一条 hard 条目），行内 token 按 `(cycle, attempt)` 排序（与 `BoardView#byRound` 同序）；成员谓词要求 `targetAction === false` 且至少一条 `grade === "hard"`；只带 soft 的 APPROVED 评审与只带 `WRITE_BACK_UNMEASURED` 的 BLOCKED 轮均不出现；引擎为「作者零条目」的轮合成的 hard 条目带 `cause: "round-blocked"` 而不是 `contract-violation`（合成点 `face/lifecycle.ts:440-443`，字面单源 `session/ledger.ts:97` 的 `CONCLUDED_BLOCKED_CAUSE`，夹具 `face/__tests__/cli.test.ts:6696` 逐字断言于 `:6715`），该轮照常出现；`✗` 保留。
- 有无崩溃记录两种夹具下 `next:` 字面、`+N`、blocker 计数逐字节相同（D70：零第二套分级）。
- 该行不进 legend 词表。

#### DependsOn

none

---

### Task 6: 宽容面与单源面——坏值分档 + 闭合 wave 层判据收窄 + prompt 证据名单源

#### Objective

两处过严判据按**事实负载度**分档（同一条判据：不该红的地方不要红），外加一处「第二份手写拼写」的收敛。① 载体坏值：`required` 字段（work 的 `status` / `artifacts`、judge 的 `findings`、finding 的 `severity` / `lens` / `summary`）坏值仍 BLOCKED；非 `required` 的装饰字段（**定义**：`PLANE_SLOTS` 减 `PLANE_REQUIRED`，finding 面同法取 `FINDING` 的 slot 减 required——下列括号只为举例、不是清单：judge 的 `artifacts` / `notes`、work 的 `dispositions`，与 finding 的 `id` / `section` / `line` / `fix` 皆在其中）坏值 drop 该键 + 一条 soft observation；`dispositions` 的成员资格不动、但坏值不被原谅——drop 之后载体里没有这个对象，`FixDispositions#ownRefusal`（`contract/completion-criterion.ts:487`，判定 `:497-500`，经 `dispositionsOf` `:429`）对「缺席或非对象」仍硬拒，拒因从类型不符换成 `declares no dispositions object`，那条 soft observation 必须点出被丢掉的键名——落点是三处真实的缝、四处赋值：`HandoffSchema#check` 返丢弃键集、`#reconstruct` 的 `schema.readBack` required 档门与 `#materialize` 消费它（四处顶层拷贝赋值覆盖三个装饰槽——judge 面 `artifacts` 的三元、`draftNotes`、`dispositions`、`notes`）、`#findingsList` 剝掉嵌套越档键（引擎的 `id` 在剥键之后才盖，坏形状的草稿 `id` 只丢孩子那份）。② `closed-wave-fits-depends-on-layers` 只判**未闭合** wave，闭合面交既有的 `planned-tasks-vs-recorded-tasks`——它读**当前** plan 的 task id 集、只判「已记录而当前 plan 不再携带」一个方向，快照列不接进该规则（那会改变它判的东西，快照属于 append-vs-stall）。③ 同一文件的派发 prompt 契约面（`HandoffSchema#schemaText` :196-203，第 200 行）把证据名以旧拼写渲进每一条 work 面 prompt——改述为「the file named by `OUTPUT_EVIDENCE`」，拼写只留 `RoundNaming` 一处；不动则守卫 (b) 红，且子 agent 照 prompt 的旧形状写文件，读回门（`face/lifecycle.ts:552-553` 按 `RoundNaming.evidenceName` 的新名字取文件）判其缺失、改写为 BLOCKED。三处合并为一任务的理由：同一个「第二份手写副本 / 过严判据」根因，每处一两行改动，`session/handoff-schema.ts` 本就在本任务的 Files 内（同波次不再撞行），合并后波宽仍 ≤ 3。

#### Files

- Modify: `packages/cdd-engine/src-next/session/handoff-schema.ts`（`HandoffSchema#check`（:328，整数分支 `:378`）改为 tier-aware：非 required 节点失配时记录并跳过该键、不产生 problem；`#check` 返**被丢掉的键集**，谓词不抄第二份；`schemaText`（:196-203，第 200 行）把证据名改述为「the file named by `OUTPUT_EVIDENCE`」，不再以 `{prefix}-{key}-test-evidence.json` 抄第二份拼写）
- Modify: `packages/cdd-engine/src-next/face/lifecycle.ts`（坏值缝的另两处：`#reconstruct` 的 `schema.readBack` required 档门（:1223）消费 tier-aware 结果、`#materialize`（:1566）的 `droppedKeys` 路（:1579）与四个顶层拷贝赋值消费同一键集——`const artifacts = droppedDecorative.includes("artifacts") ? undefined : draft.artifacts`（judge 面 `artifacts` 槽；该文件行号本轮已漂，按赋值点名）· `draftNotes` 的按档取值 · `carrier.dispositions = draft.dispositions` · `carrier.notes = [...notes, ...draftNotes]`（四处赋值覆盖三个装饰槽）、`#findingsList`（:1702）剝掉越档的嵌套键并在剥键之后盖引擎的 `id`（`copy.id`，坏形状的草稿 `id` 只丢孩子那份））
- Modify: `packages/cdd-engine/src-next/contract/judge.ts`（`LedgerFacts`（:45-63）补 `openWaves` 装配格，与 `closedWaves` 相邻且同形（`readonly (readonly number[])[]`，每个元素一组 task id、不携 wave key））
- Modify: `packages/cdd-engine/src-next/session/preflight.ts`（`#ledgerFactsOf`（:506）装配 `openWaves`——读同一个 `progress.waves`，与 `closedWaves` 同批）
- Modify: `packages/cdd-engine/src-next/contract/invariants.ts`（层判据体 `LedgerLayeringRule`（:388）改迭代 `openWaves`；判词与 heading 同改——`the closed wave {…}` → `the open wave {…}`、`closed Waves` → `open Waves`（收窄后闭合 wave 被豁免、永远不会被这条判据说出来，判词再写 `closed` 就是对一条未闭合 wave 说谎），规则 id `closed-wave-fits-depends-on-layers` 与 `contract/rules.ts:184` 的声明行保持不动；`contract/rules.ts:184` 只携带声明行，无判据体，随动无行为）
- Test: `packages/cdd-engine/src-next/session/__tests__/handoff-schema.test.ts`（`line: null` 被接受 + 一条 soft · judge 面 `artifacts` / `notes` 坏值同档（drop + soft、不搬进载体）· `severity` / `findings` / `status` 坏值仍 BLOCKED · `findings[].line = null` 的载体自过 `CARRIER` 声明 · `schemaText(plane, true, prefix)` 的 work 面 prompt 不再出现 `{prefix}-{key}-test-evidence.json` 第二份拼写、只指 `OUTPUT_EVIDENCE`）
- Test: `packages/cdd-engine/src-next/contract/__tests__/judge.test.ts`（已闭合 wave 事后改依赖零红 · 未闭合 wave 跨层仍红，开放集来自 `LedgerFacts.openWaves`；红例的 finding message / heading 断言用新判词 `open wave` / `open Waves`）
- Test: `packages/cdd-engine/src-next/session/__tests__/preflight.test.ts`（`#ledgerFactsOf` 的 `openWaves` 与 `closedWaves` 同批装配、两端不相交）
- Test: `packages/cdd-engine/src-next/face/__tests__/lifecycle.test.ts`（`#findingsList` 的两步顺序：草稿 `findings[0].id = 0` 物化后载体行仍带 `id: "F1"`，一条 soft 点名 `findings[0].id`）

#### Consumes

- `PLANE_REQUIRED` / `FINDING.required` 的既有声明面
- `#materialize` 对非声明字段的 drop + WARN 路（复用，不新造）
- `progress.waves` 的 wave → task ids 映射（`#ledgerFactsOf` 已在读，用于 `closedWaves`）
- `planned-tasks-vs-recorded-tasks` 读的**当前** plan task id 集（单向判据；`ProgressRow.planTasks` 快照列属于 append-vs-stall，本任务不接）

#### Produces

- `handoff-schema` 的坏值分档校验（装饰字段 drop + soft，负载字段 BLOCKED；`#check` 返丢弃键集供 `#reconstruct` / `#materialize` 消费）
- `LedgerFacts.openWaves`（与 `closedWaves` 同形：`readonly (readonly number[])[]`，每个元素一组 task id、不携 wave key；与 `closedWaves` 同批装配在 `#ledgerFactsOf`，消费面 `LedgerLayeringRule#evaluate` 直接迭代它）
- 层判据的闭合豁免（`LedgerLayeringRule` 只迭代未闭合 wave）

#### Steps

- 写失败测（装饰字段容错）：judge 载体含 `findings[].line = null` → 载体被接受，记一条 soft — checkable: 定向 vitest FAIL（今日整条被拒）
- 写失败测（judge 面 `artifacts` / `notes` 同档）：judge 载体带非对象 `artifacts` 与坏值 `notes` → 被接受、两键不搬进载体、各记一条 soft — checkable: FAIL
- 写失败测（载体自过声明）：`findings[].line = null` 的载体写出后自过 `CARRIER` 声明 — checkable: FAIL
- 写失败测（装饰剥键不吞引擎主键）：judge 草稿 `findings[0].id = 0` → 物化后的载体行 `id === "F1"`、一条 soft 点名 `findings[0].id` — checkable: 定向 vitest FAIL（今日载体行无 `id`）
- 写失败测（负载字段不放宽）：`severity` / `findings` / `status` 任一处坏值 → 仍 BLOCKED — checkable: FAIL
- 写失败测（闭合豁免）：一条已闭合 wave，事后改 `DependsOn` 使其与现算层不符 → 零红（闭合面由 `planned-tasks-vs-recorded-tasks` 承担，读当前 plan、单向）— checkable: FAIL
- 写失败测（未闭合仍红）：未闭合 wave 跨层 → 仍红，红例的开放集来自 `LedgerFacts.openWaves` — checkable: FAIL
- 写失败测（派发 prompt 契约面）：一条 work 面 `schemaText` 的证据段含旧拼写 `{prefix}-{key}-test-evidence.json` → 断言它已改述为 `OUTPUT_EVIDENCE`、且 prompt 里不再出现第二份证据名拼写 — checkable: 定向 vitest FAIL（今日 `session/handoff-schema.ts:200` 以旧拼写渲入）
- 实现分档校验、层判据收窄与 prompt 面的单源改述 — checkable: 八条测 PASS
- 全量回归 — checkable: `pnpm -C packages/cdd-engine exec vitest run` 与 typecheck exit 0
- 提交 — checkable: `git log -1 --oneline` 含本任务主题

#### Acceptance

- `line: null` 的 review 载体被接受并记一条 soft，轮次照常结束且引擎写出的载体自过 `CARRIER` 声明；judge 面 `artifacts` / `notes` 坏值同档（drop + soft、不搬进载体）。
- 装饰剥键不吞引擎主键：草稿的 `findings[].id` 形状不符时 drop 只落在草稿值上，物化后的载体行仍带 `id: "F{n}"`（一条 soft 点名该键），下一轮 fix 的 dispositions 键不缺。
- `severity` / `findings` / `status` 的坏值仍 BLOCKED（负载面不缩）。
- 已闭合 wave 事后改依赖零红（闭合面由 `planned-tasks-vs-recorded-tasks` 承担，读当前 plan、单向；快照列不接）；未闭合 wave 跨层仍红，开放集来自 `LedgerFacts.openWaves`。
- 坏值分档的边界读 `required` 声明，不在 `#materialize` 手写第二份清单：tier-aware `#check` 返丢弃键集，`#materialize` 与 `#findingsList` 消费它。
- 派发 prompt 的契约面只剩一份拼写：`HandoffSchema#schemaText` 以 `OUTPUT_EVIDENCE` 指代证据文件，不再渲 `{prefix}-{key}-test-evidence.json`；守卫 (b)（`RoundNaming` 之外零名字拼装字面）因该行改述而全绿。

#### DependsOn

none

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-11-13 | P34 计划初稿：T1 渲染单源 + 扫描面收窄（网格 pin · 守恒边界 · implement 五 kind 携 cycle · evidence 三坐标）· T2 读写缝（`carrierPathOf` / `ownerOf` / 四条读面 / 记录停写两字段 / implement 填 round）· T3 preflight-seal 同源窗口 + 守卫 pin + changeset。 | '[human] 裁定 · Claude（kairos:cdd-plan · 2026-11-13）' |
| v0.2 | 2026-11-13 | 评审回改（docs-fix round 1）：T1 收 `#paramsOf` 的 implement round 与拼写夹具、`#handoffOwner` 反向归属改结构化反解；T2 补摘要缝（删 `carrierPath === null` 门）、第五条读面 `#reviewsPath`、`#judgedRecordOf` / `#ownRefusal` 摘格，`run.ts` 行改指 `session/run.ts`；T3 补第三条守卫（零 `carrierPath` 读）与崩溃记录的读回断言；Review Focus 改指 `Run#roundFor`。 | '[ai] Claude（kairos:cdd-docs-fix · 2026-11-13）' |
| v0.3 | 2026-11-13 | 并入四条同族面（spec v0.8 · 用户裁定「全并」）：新增 T4 孤儿归属（记录归属 + legacy 路径档）、T5 崩溃/中断来源行（不参与分级）、T6 宽容面（坏值按 `required` 分档 drop + soft · 闭合 wave 层判据收窄）。波次：W1{1,5,6} → W2{2} → W3{3,4}。 | '[human] 裁定 · Claude（kairos:cdd-design · 2026-11-13）' |
| v0.4 | 2026-11-14 | 评审回改（docs-fix round 2）：T1 补 `Lifecycle#paramsOf` 填帧的 `attempt`（两个帧构造点）+ attempt-2 派发夹具、`#stem` 改为删除、守恒边界补 branch fix 族、cli 夹具改为锚点 + 扫描指令；T2 的 accessor 改为 `resolveHandoffName` 阶梯 + 种子身份 + 自探存在，摘要半边改指 `#carrierDigestOf` / `#latestRecordOf` 的 attempt 收窄，新增解析读者类（`#reviewsPathOf` / `#consecutiveS1Run` / `Ledger#round` 的 review 读）；T3 守卫证据改到真实红集并把写入侧赋值点列为不属判面；全文 `Run#` 改为 `Lifecycle#`。 | '[ai] Claude（kairos:cdd-docs-fix · 2026-11-14）' |
| v0.5 | 2026-11-14 | 评审回改（docs-fix round 3）：T1 反向归属改为名字 → 身份比对并补两族 legacy 拼写、p16 pathless 夹具与 attempt 负向 pin，`isCarrierName` 字面补 cycle，`finalName` / `finalPath` 退役及其四个调用点，守恒边界补四条文档线各一条字面；T2 补阶梯种子取 `record.attempt`、doc/wave/branch 三线自探与 pre-P31 行读全 findings；T3 补 fix resume 的 `--reviews` 携带 attempt-1 review final；T4 认领键改完整身份（含 attempt），legacy 档经 `carrierPathOf` 且两侧 `path.basename`；T5 成员谓词补 `targetAction === false` 且 hard 条目，补两组 soft-only 反例与每轮一个 token；T6 坏值缝改指 `HandoffSchema#check` + `face/lifecycle.ts`（`#reconstruct` / `#materialize` / `#findingsList`），新增 `LedgerFacts.openWaves` 与 `LedgerLayeringRule` 判据体坐标，闭合面改述为当前 plan 的单向判据。 | '[ai] Claude（kairos:cdd-docs-fix · 2026-11-14）' |
| v0.6 | 2026-11-14 | 评审回改（docs-fix round 4）：T1 的 cli 扫描面改为两段（40 行载体夹具 + 36 行证据夹具，证据名旧形不在 implement 名集合），并补 `carrier-seal.test.ts:78` / `render.test.ts:42` `:126` / `handoff-schema.test.ts:42` 三处证据夹具，守恒边界与对应失败测给 `crash` 名字加 `attempt === 1` 限定；T3 守卫 (b) 的判面定为「`RoundNaming` 之外的非注释代码行」并列出红集与非红集；T6 新增 ③（`schemaText` 的证据名改述为 `OUTPUT_EVIDENCE`、拼写单源）及对应失败测、断言与 acceptance 行，标题同步改名；T6 的装饰字段枚举改为 `PLANE_SLOTS` 减 `PLANE_REQUIRED` 的定义式（括号仅举例），层判据的判词与 heading 同改为 `open wave`。 | '[ai] Claude（kairos:cdd-docs-fix · 2026-11-14）' |
| v0.7 | 2026-11-14 | 评审回改（docs-fix round 5）：Constraints 的 spec 字面随版移到 v0.11；T6 补 `dispositions` 坏值的边界（成员资格不动、drop 后 `ownRefusal` 仍硬拒、soft observation 点名被丢键），同笔记下 T6 两处缝已从 `schema.violations`（:1213）移到 `schema.readBack` 的 required 档门（:1223）这一未入版的改动；T2 的 `#reviewsPath` 写成一条取路（`--reviews` → `carrierPathOf` → 解析不到即 `null`），删掉「记录在、载体缺席 → 返回 resolved 名」的第三档，Files / Test / Step / Acceptance 四处同笔对齐；T4 与 T5 的 checkable 计数改为五条 / 六条；T5 的 Objective 与 Acceptance 补行内 token 按 `(cycle, attempt)` 排序（与 `BoardView#byRound` 同序）。 | '[ai] Claude（kairos:cdd-docs-fix · 2026-11-14）' |
| v0.9 | 2026-11-14 | 评审回改（docs-fix round 6）：T3 按 HEAD 收窄剩余范围——窗口面与 `#writeCrash` 已随 T1 同源落地，三条窗口 / 崩溃步骤改为覆盖测（现状即绿），Objective 显式收窄；守卫 (a) 改指 T2 已落的 `session/__tests__/carrier-path.guard.test.ts:37-60`（作用域 `session/ledger.ts` 记录存储 + 委派路由，spec §2.12 全树口径的差额记在文件头），守卫 (b) 红集由过期的 `session/handoff-schema.ts:200` 改为今日零命中（T6 ③ 已改述 `OUTPUT_EVIDENCE`），守卫 (c) 的判面排除 `#family` 键集校验；新增 abort fold 的 attempt 同源：Files / Steps / Produces / Acceptance 点名 `#bookAbort` → `#waveParams(…, attempt)` 与两处 round-less docstring 退役；Acceptance 补 legacy 轮窗口的 implement 例外；changeset 由新增第二份改为确认既有 `p34-naming-derivation-tolerance.md`。 | '[ai] Claude（kairos:cdd-docs-fix · 2026-11-14）' |
| v0.10 | 2026-11-14 | 评审回改（fix round 7）：`#waveParams` 的声明对齐实现——四参形 `(key, cycle, op, attempt)` 收为三参 `(key, cycle, attempt)`（折叠封的形状不再取决于 `op`，`op` 不是参数），Files / Produces 两处同笔；Steps 的 `#bookAbort` → `#waveParams(…, attempt)` 与其余字面不动。 | '[ai] Claude（kairos:cdd-fix · 2026-11-14）' |
| v0.11 | 2026-11-14 | 评审回改（docs-fix round 7）：T1 的反向读表补第三类 legacy 拼写退役 `{spec}-{op}-{round}.json`（同 round · attempt 1），并写明该线词不在 `families` 里、须像 `#LINE_CARRIER` 并 `RETIRED_SPEC_KEY` 那样显式并入（Files / Consumes / Test / Steps / Acceptance 五处同笔），T4 的 Test 与 Acceptance 同步补第三类；T3 按 HEAD 收窄——abort fold 的 attempt 同源已由 `c2feec9f` 落地，实现步改为覆盖测（现状即绿），Files 删去对今日 `#waveParams` 分支的旧描述，`session/run.ts` 由 Modify 降为 Confirm（docstring 已改述）；docstring 退役清单补第三处 `face/lifecycle.ts:1076-1080` 的 `#roundCarrierNames` 注释。 | '[ai] Claude（kairos:cdd-docs-fix · 2026-11-14）' |
| v0.12 | 2026-11-14 | 评审回改（branch-fix-1）：T2 的阶梯补 cycle 1 · attempt 1 的 implement legacy 级（`#legacyCarrierName`）并说明它是 T4 反向归属的读面孪生（Objective / Files / Test / Steps / Acceptance 同笔）；T2 的 board 行装配点名 `overall` 行读 program workspace（Test / Acceptance）；T5 的 cause 值域补引擎合成的 `round-blocked`，并补「作者零条目才合成」「声明式 BLOCKED soft-only 不进 `crashed:`」两条写失败测与 acceptance；spec 字面随版移到 v0.12。 | '[ai] Claude（kairos:cdd-dev · branch-fix-1 · 2026-11-14）' |
| v0.13 | 2026-11-14 | 评审回改（docs-fix round 8）：T1 把适用面搬到帧面——`renderName` 全域渲染、单射网格六 type × 六 kind 全比（Constraints / Test / Steps / Acceptance 同笔），`evidenceName` 的两道空串闸（文档形 · 非 implement / fix 相位）留在帧面、委派只替拼写，补 `round-naming.test.ts:205-243` 的空串 pin；T1 Produces 的 `HandoffParams.attempt` 缺省拆两档（写面落 1、解析面经 `#attemptAware` 落该轮最新记录），T2 的 Files / Consumes / Test / Acceptance 点名该中央缺省；T2 Objective 的阶梯改为 shipped 次序（活线 implement legacy 先于 canonical，退役 `spec` 孪生线另序）并按新次序重述自探存在；T6 的 `LedgerFacts.openWaves` 改为与 `closedWaves` 同形的 task-id 数组列表，`#materialize` 的拷贝点补 judge 面 `artifacts` 三元（四处赋值覆盖三个装饰槽）；spec 字面随版移到 v0.13。 | '[ai] Claude（kairos:cdd-docs-fix · 2026-11-14）' |
| v0.14 | 2026-11-14 | 评审回改（branch-fix-2）：T6 写明 `#findingsList` 的两步顺序——装饰剥键先跑、引擎自印的 `id` 后盖，草稿里形状不符的 `id` 只丢孩子那份（Objective / Files / Test / Steps / Acceptance 同笔），并新增一条定向 vitest 步骤与 `lifecycle.test.ts` 的顺序 pin；Steps 的通过计数 七条 → 八条；spec 字面随版移到 v0.14。 | '[ai] Claude（kairos:cdd-fix · 2026-11-14）' |
| v0.15 | 2026-11-14 | 评审回改（docs-fix round 9）：T2 补 `#resumeOf` 的 owning 项——fix 分支的回退只持 cycle（`{ tasks: frame.params.tasks, round: frame.round }`），attempt 交中央 `#attemptAware` 缺省解析（Files / Test / Steps / Acceptance 同笔），并新增「记录在册 · 载体缺席 + fix 重派 attempt 2」的幽灵名夹具；spec 字面随版移到 v0.15。 | '[ai] Claude（kairos:cdd-docs-fix · 2026-11-14）' |
| v0.16 | 2026-11-14 | 评审回改（branch-fix-3）：T2 的回退只持 cycle 已落码并钉住——`#resumeOf` 以 `{ tasks: frame.params.tasks, round: frame.round }` 解析 review 家族、新增「记录在册 · 载体缺席 + fix 重派 attempt 2」的幽灵名夹具；随落码刷新 `#reviewsPath`（`:1301-1310`）与回退（`:1778-1782`）的锚点，spec 字面随版移到 v0.16。 | '[ai] Claude（kairos:cdd-dev · branch-fix-3 · 2026-11-14）' |
| v0.17 | 2026-11-14 | 评审回改（docs-fix round 10）：T3 的 docstring 退役闸由恒绿改为红先跑——判据换成 `grep -n "cycle-less identity resolves both"`（今日 1 命中于 `:1081`、退役后零命中），原 `grep -n "round-less\|one name, sealed once"` 在 HEAD 恒 exit 1（`round-less` 已被 P31 §2.4 段落替换、`one name, sealed once` 被 `:1081` / `:1082` 的换行与注释星号切开），退役不落地也能 PASS；Files 的行号由 `:1076-1080` 改为 `:1079-1082` 并把退役清单收窄到该一处（`:318-320` 已无该措辞，不再列为待退役）；Acceptance 新增该退役的活闸条目，并记折行时的跨行 `perl -0777` 备选。 | '[ai] Claude（kairos:cdd-docs-fix · 2026-11-14）' |
| v0.18 | 2026-11-14 | 评审回改（docs-fix round 11）：T5 补 `round-blocked` 的 owner——Files 新增 `face/lifecycle.ts` 的合成条目（`#verdictOf` `:420` · `:440-443`）与 `session/ledger.ts:97` 的 `CONCLUDED_BLOCKED_CAUSE`（Confirm）、`face/__tests__/cli.test.ts:6696` 的 no-host 逐字断言（`:6715`）；Consumes 把引擎合成的 `round-blocked` 从既有值域里提出来标为本任务首次消费；两条 `checkable: FAIL` 改为真红口径（今日无 `crashed:` 行，合成行为现状即绿），Acceptance 指到这两个 owner。T1 的反向读面 pin 由不存在的 `#familyCaptures` 改为交付符号 `#handoffOwner` `:1929` · `#WAVE_CARRIER` `:1963` · `#LINE_CARRIER` `:1969` · `#attemptOf` `:1975`，同句旧锚点 `:1946` 一并改 `:1969`。 | '[ai] Claude（kairos:cdd-docs-fix · 2026-11-14）' |
| v0.19 | 2026-11-14 | 评审回改（branch-fix-4）：T2 的回退规则收成一宿——`#reviewFamilyPath`（`:1316-1321`），`#reviewsPath` 的无记录支与 `#resumeOf` 同处调用（Files 的回退项同笔点名）；随落码刷新 `#reviewsPath`（`:1301-1309`）、`#resumeOf`（`:1761`）、回退（`:1787`）与崩溃记录 `next`（`:1550`）的锚点，spec 字面随版移到 v0.17。 | '[ai] Claude（kairos:cdd-dev · branch-fix-4 · 2026-11-14）' |
