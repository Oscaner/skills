---
title: 引擎文档工具（Engine Doc-Tooling）— P22 计划：定级口径 · 派发终态契约 · 活性信号 · Next 收敛
doc-type: plan
version: v0.5
date: 2026-11-03
slug: 2026-10-10-engine-doc-tooling-p22
base: develop
---

## Constraints

- **逐字取 spec**：本计划只实现 `docs/kairos/specs/2026-10-10-engine-doc-tooling-p22-design.md` **现行 `version`** 所指的面；面与裁决以现行 spec 与 handoff 裁定为准（需要改动即回评审，不在计划里顺手扩面）。不钉版本号副本——实现者读该 spec 的 front-matter `version` 即判读基准。
- **零新运行时依赖**：日志用 Node 原生 append 流与 `node:fs/promises`；判据与活性信号都是本仓内的小类。
- **引擎不判定级是否正确**：口径是 prompt 契约（`render/templates.ts`），引擎只做 schema / 计数 / 转移表的结构校验。
- **Loop-vs-converge 的判据只有一处**：`NextStepRouter.next`（`session/next.ts`）的 blocker/warn/nit 计数表。任何把 hop 从 `route.kind` 反推并反向影响判据的写法都是回归；收敛只许改呈现。
- **capsule 三键字节面不动**：`status · blocker · handoff` 与失败面形态原样保留；轮次输出行不补三元计数。
- **findings schema 零新字段**；`dispositions` 是 work **载体槽**，不是作者面字段。
- **`ps` 仍只住 `infra/proc.ts` 一处**；预算与 idle 阈值（implement 6h / review 3h / fix 3h / branch-review 3h · idle 30min · 采样 60s）不动。
- **不改写历史**：冻结的轮记录、已入账波行、冻结文档里的旧字节一律不回改。
- **波内上限 = 硬门 + 修法指引**：引擎不切块、不截断、不重排；波次形状属作者的 `DependsOn`。
- **消费面 purity**：`packages/kairos/skills/*` 只增义务句与指针句，**不改任何 skill 的 digraph**；`contract/skill-anatomy.ts` 只增四问登记项。
- **发行**：changeset `cdd-engine` **minor** + `kairos` **patch**，不发布。

## Review Focus

- **重派身份**：BLOCKED/TIMEOUT 的轮入账后重派必须落在**同一 cycle** 的 `attempt + 1`；凭空造出 `fix-(K+1)` 会把一次未被请求的轮次写进账本（Task 3 · Task 7 的 checkable）。
- **日志不可写**：日志文件创建失败（权限 / IO）时该轮必须退化为 CPU 单腿、**失败可见**（soft 观测 + 点名路径），不得静默变成 `unknown` 或误杀（Task 2 · Task 5）。
- **CPU 腿不可读**：`ps` 不可得而日志零增长 30min ⇒ `stalled`（组杀）；`unknown` 只在整窗**没有一条腿可读**时成立（Task 5）。
- **旧 progress.json**：`rounds` 为对象 / 纯数字 / 记录缺 `carrierPath` 三种旧形必须读得动且不误判（Task 3 · Task 6）。
- **append 造成的宽波**：P21 的部分闭合路径（闭合集不是完整层并集）可能让 frontier 跨层超 3 ⇒ 必须显式 `wave-too-wide`（点名 id 与 `DependsOn` 修法），**不得**被既有 `split` 门抢走原因（Task 8）。

### Task 1: 定级口径片段（四问三档 · 单源四渲染）

#### Objective
把四型审查判据体里逐字重复的收尾段与定级口径收成**一个**共享片段 `SEVERITY_RUBRIC`，带两个插槽（被评审产物名 / 判「沉默」的受众），四份 `REVIEWS.*.axesGuide` 只引用它；同批把 `FIX_READBACK_SUFFIX` 的词面对齐到 reviews handoff（常数体 + jsdoc + 两条 pin）。

#### Files
- Modify: `packages/cdd-engine/src-next/render/templates.ts`
- Modify: `packages/cdd-engine/src-next/session/next.ts`（`FIX_READBACK_SUFFIX` 常量字面 + jsdoc）
- Test: `packages/cdd-engine/src-next/render/__tests__/render.test.ts`（既有 `REVIEWS.spec.axesGuide` 断言在此，改锚到 `reviewGuideOf` 面）· `packages/cdd-engine/src-next/session/__tests__/next.test.ts`（两条后缀 pin）
- Create: `packages/cdd-engine/src-next/render/__tests__/templates.test.ts`

#### Consumes
`REVIEWS`（现有四型登记表）· `ReviewGuides` 类型。

#### Produces
- `export const SEVERITY_RUBRIC: string` —— 完整片段正文（含四问三档 + vision/非穷举/沉默判读 + set-aside 清单 + 按真实严重度校准 + 先承认做对了什么 + 同档一致性句）。
- `export const SEVERITY_RUBRIC_SLOTS: { artifact: string; audience: string }` —— 两个插槽的占位名（`{artifact}` / `{audience}`，与 spec §2.1 同词）。
- `export type ReviewVariant = TargetType` —— 既有四值 `wave | branch | spec | plan`（`session/faces.ts:19`，`templates.ts:53` 已 import 该类型）；不新造值域名，`REVIEWS` 的键域就是它。
- `export const REVIEW_VARIANT_TEXT: Readonly<Record<TargetType, { readonly artifact: string; readonly audience: string }>>` —— 两插槽取值的唯一登记表：`{artifact}` 取 wave/branch `artifact` · spec `spec` · plan `plan`；`{audience}` 取 wave/branch `user` · spec `downstream author` · plan `implementer`。
- `export const reviewGuideOf: (type: TargetType) => string` —— 用 `REVIEW_VARIANT_TEXT[type]` 填插槽后返回完整判据体（参数域与 `REVIEWS` 的键域同一，故 Step 1(c) 的 `reviewGuideOf(k)` 调用点类型一致）；`REVIEWS.{wave,branch,spec,plan}.axesGuide` 保留为已拼好的字符串（值 = 各自轴句 + `reviewGuideOf(type)`）。
- `FIX_READBACK_SUFFIX` 改为 `(confirm the reviews handoff · if a finding needs a ruling, record the ruling in the handoff file)`（同批：常量 jsdoc 的口径句与其字面回显一并改指 reviews handoff）。

#### Steps
- [ ] **Step 1: 写失败用例** —— 断言四件事（`render/__tests__/templates.test.ts`）：(a) `SEVERITY_RUBRIC` 含 `blocker` 四问的四个锚句（`declared acceptance gate` · `a legal input escapes` · `can never go red` · `security or privacy`）与 warn / nit 两档锚句；(b) 片段含 vision 句与 `set aside` 清单句，且带 `{artifact}` / `{audience}` 占位；(c) 四份 `axesGuide` 各自**只**出现一次片段正文，断言面直接写死为 `REVIEWS[k].axesGuide.split(reviewGuideOf(k)).length === 2`（`k: TargetType` ∈ wave / branch / spec / plan；片段带占位，故按已填的构建串切分）；(d) 模块源码里 `The reviewed` 只出现一次（`readFileSync` 上 `templates.ts` 计入断言，钉「副本零残留」）。运行：`pnpm -C packages/cdd-engine exec vitest run src-next/render/__tests__/templates.test.ts` → 期望 FAIL。 — checkable: 四条断言先红（片段缺位 / 副本仍在）
- [ ] **Step 2: 抽片段并接线** —— 在 `templates.ts` 定义 `SEVERITY_RUBRIC`（插槽以 `{artifact}` / `{audience}` 字面出现）、`ReviewVariant = TargetType` 与其取值表 `REVIEW_VARIANT_TEXT`（取值见 Produces）、`reviewGuideOf(type: TargetType)`；四份 `axesGuide` 改为「本变体独有轴句 + `reviewGuideOf(...)`」。branch 变体独有的 "Three things a green run cannot show you…" 保留在变体侧（它只出现一次，不是重复）。同档一致性句放在「先承认做对了什么」**之前**。 — checkable: `templates.ts` 源码里 `The reviewed` 只出现一次
- [ ] **Step 3: 跑绿 + 全量回归** —— `pnpm -C packages/cdd-engine exec vitest run src-next/render` → 期望 PASS；`env -u AI_AGENT pnpm -C packages/cdd-engine test` → 期望零失败（既有 prompt 面断言若因文本合并而红，逐条改锚到 `reviewGuideOf` 面，断言不删）。 — checkable: `vitest run src-next/render` 与引擎全量套件 exit 0
- [ ] **Step 4: 词面对齐（`FIX_READBACK_SUFFIX` 三处同批）** —— 改 `session/next.ts` 的常量字面与其 jsdoc（口径句 + 字面回显）；`session/__tests__/next.test.ts` 的运行时逐字 `toBe` 与编译期字面类型 pin 逐字重锚。冻结文档里的旧字节不回改。 — checkable: `grep -rn "findings file" packages/cdd-engine/src-next` 零命中，且 `env -u AI_AGENT pnpm run typecheck` exit 0（编译期字面 pin 转绿）
- [ ] **Step 5: 提交** —— `git add packages/cdd-engine/src-next/render packages/cdd-engine/src-next/session && git commit -m "feat(cdd-engine): publish the severity rubric as one shared fragment"`。 — checkable: `git log -1` 为约定提交信息且工作树干净

#### Acceptance
四份 `axesGuide` 引用同一片段（单源）；片段含四问三档 + vision 句 + set-aside 句 + 同档一致性句；`templates.ts` 源码里 `The reviewed` 只出现一次；warn 档含 `duplicated policy` / `stale docstring` / `missing coverage case`，nit 档含 `Style, naming and line-wrapping`；`FIX_READBACK_SUFFIX` 新字面与其 jsdoc 同批落地，旧字面在 `packages/cdd-engine` 代码与测试面零命中。

#### DependsOn
none

### Task 2: 每轮日志通道（spawn 前创建 · 只增不改 · 不回显）

#### Objective
给每个派发轮一个自己的日志文件：spawn **之前**创建、child 的 stdout+stderr 只写它、收工 drain→close、重派带 `-a{attempt}`；引擎输出面零变化。

#### Files
- Create: `packages/cdd-engine/src-next/infra/round-log.ts`
- Modify: `packages/cdd-engine/src-next/session/round-naming.ts` · `packages/cdd-engine/src-next/face/lifecycle.ts`
- Test: `packages/cdd-engine/src-next/infra/__tests__/round-log.test.ts` · `packages/cdd-engine/src-next/session/__tests__/round-naming.test.ts`

#### Consumes
`RoundNaming`（现有命名源：report stem / crash name / evidence name）· `Workspace`（路径落点）。

#### Produces
- `export class RoundLog`：`static create(path: string): Promise<RoundLog>`（`mkdir(path.dirname(path), { recursive: true })` 后打开 append 流，零字节——`Workspace#ensure` 只建 root + slug 目录，`logs/` 由本类自建）· `get path(): string` · `write(chunk: string): void` · `static sizeOf(path: string): number | null`（读不到 → `null`）· `static mtimeOf(path: string): number | null` · `close(): Promise<void>`（等到流的 `close` 事件）。
- `export type AttemptIdentity = { readonly op: OpType; readonly cycle: number; readonly attempt: number }` —— 轮记录的结构切片（`RoundRecord` 结构性满足它，故命名单源不反向依赖账本）。
- `RoundNaming#attemptOf(records: readonly AttemptIdentity[], op: OpType, cycle: number): number` —— 该 cycle 已入册的最大 attempt + 1（未入册时为 1）：attempt 身份的唯一分配缝。
- `RoundNaming#logName(op, type, params, attempt: number): string` —— report stem 去 `-report.md` 加 `.log`，`attempt > 1` 时加 `-a{attempt}`；attempt 由 `#attemptOf` 分配后传入，命名不外推。

#### Steps
- [ ] **Step 1: 写失败用例** —— `round-naming.test.ts`：`logName` 对 doc line（`spec-review-2`）、wave line（`tasks-1-fix-1`）、`implement`（无轮号）、重派（`tasks-1-fix-1-a2`）四种形态的期望名，加 `attemptOf` 两形（该 cycle 已入册 attempt 1 ⇒ 2 · 未入册 ⇒ 1）；`round-log.test.ts`：`create` 在**不存在的父目录**（`<slug>/logs/`）下自建成功且文件 size 为 0 · `write` 后 `sizeOf` 增长 · `close` 后 `sizeOf` 等于已写字节 · 不存在的路径 `sizeOf`/`mtimeOf` 返回 `null`。运行 → FAIL。 — checkable: `logName` 四形态 + `attemptOf` 两形 + `RoundLog` 五断言的用例先红
- [ ] **Step 2: 实现 `RoundLog` 与 `logName`** —— append 流（`createWriteStream({flags:"a"})`）；`sizeOf`/`mtimeOf` 走 `node:fs` `statSync` 并吞掉读失败（返回 `null`，fail-open 的观测面）。 — checkable: `RoundLog` 用例转绿（size 0 → 增长 → close 后稳定）
- [ ] **Step 3: 接线 lifecycle** —— 派发前 `await RoundLog.create(logPath)`（内部自建 `logs/` 目录）并把 child 的 stdout/stderr 都 pipe 进它（`stdio: ["ignore","pipe","pipe"]`，零 tee、零前缀）；child 退出后 `await roundLog.close()` 再进入读回判定；`--dry-run` 分支不创建日志。失败创建（抛错）→ 记一条 soft 观测并点名路径，该轮继续（退化为 CPU 单腿，Task 5 消费）。 — checkable: 新工作区首轮派发后 `<slug>/logs/<stem>.log` 存在且 size > 0、引擎 stdout 无 child 文本
- [ ] **Step 4: 跑绿 + 提交** —— `pnpm -C packages/cdd-engine exec vitest run src-next/infra src-next/session/__tests__/round-naming.test.ts src-next/face` → PASS；`git add -A && git commit -m "feat(cdd-engine): give every dispatched round its own log file"`。 — checkable: `vitest run src-next/infra src-next/face` exit 0

#### Acceptance
日志文件在 spawn 前存在且为 0 字节（父目录 `logs/` 由 `RoundLog.create` 自建）；child 的 stdout/stderr 只进文件（引擎 stdout/stderr 字节面零变化）；重派不撞名（attempt 由命名单源分配）；`close` 之后才允许读；`--dry-run` 零日志；创建失败落 soft 观测且不中断本轮。

#### DependsOn
none

### Task 3: 逐轮记录（`rounds` → `RoundRecord[]` · 状态全派生）

#### Objective
把 `progress.json` 的 `rounds: Record<mode, number[]>` 改为逐轮记录数组，每项携带身份（`op`+`cycle`+`attempt`）、派发基线、终态裁决、违约清单与载路径；`#bookkeep` 的 `blocked` 谓词退役——**已派发的轮无条件入账**，「完成」改由裁决回答。

#### Files
- Modify: `packages/cdd-engine/src-next/session/ledger.ts` · `packages/cdd-engine/src-next/session/run.ts` · `packages/cdd-engine/src-next/session/preflight.ts`（`recordedTasksOf` 改读完成集）· `packages/cdd-engine/src-next/face/board-view.ts`（记录读面：`#rowRounds` / `roundsCell`）· `packages/cdd-engine/src-next/face/preview.ts`（`would record` 描述面）
- Test: `packages/cdd-engine/src-next/session/__tests__/ledger.test.ts` · `packages/cdd-engine/src-next/session/__tests__/run.test.ts` · `packages/cdd-engine/src-next/face/__tests__/board-view.test.ts`（`:131` 的旧形 fixture 与单元格断言改锚到记录面） · `packages/cdd-engine/src-next/face/__tests__/preview.test.ts`（四条 `would record` 字节 pin 改锚）

#### Consumes
`ProgressRow` / `readProgress` / `recordRound` · `OpenFrame`（`dispatchBase` 已由 `CliLifecycle#dispatchBase` 捕获）· `ClosedWaves` 派生。

#### Produces
- `export interface RoundVerdict { readonly treeClean: boolean; readonly targetAction: boolean }`
- `export interface RoundRecord { readonly op: OpType; readonly cycle: number; readonly attempt: number; readonly dispatchBase: string | null; readonly verdict: RoundVerdict; readonly violations: readonly RoundViolation[]; readonly carrierPath: string | null }`
- `export type RoundViolation = { readonly grade: "hard" | "soft"; readonly cause: string; readonly message: string }`
- `ProgressRow.rounds?: RoundRecord[] | Record<string, number[] | number>` —— 读期类型纳两形旧值与记录数组；调用方只见 `RoundRecord[]`（归一由 `RoundRecords.of` 承担，零第二份读缝）
- `export class RoundRecords { static of(row: ProgressRow | undefined): readonly RoundRecord[] }` —— 旧两形归一与记录数组读取的**唯一**读期归一缝（`Ledger#recordsOf` · `BoardView#rowRounds` · `preview` 共读一个入口，零第二份归一）
- `Ledger#recordRound(record: RoundRecord): void`（唯一写面）· `Ledger#completedCycles(key: LedgerKey, op: OpType): readonly number[]` · `Ledger#recordsOf(key: LedgerKey): readonly RoundRecord[]`

#### Steps
- [ ] **Step 1: 写失败用例** —— `ledger.test.ts`：(a) 写一条 `targetAction: true` 与一条 `false` 的记录 → `completedCycles` 只含前者、`roundCount`（派发编号）含两者；(b) 旧两形各一条：`{ rounds: { review: [1,2] } }`（数组形）与 `{ rounds: { review: 1, fix: 1 } }`（纯数字周期数，`#cyclesOf` 今日已归一）→ 读入后每个旧 cycle 折成**一条完成记录**（`op` 取该 mode 键的 verb · `cycle` 取旧轮号 · `attempt: 1` · `verdict: { treeClean: true, targetAction: true }` · `dispatchBase: null` · `violations: []` · `carrierPath: null`），`completedCycles` 等于今日的 cycle 集，且逐字断言 `attempt === 1`（Task 11 的 `attemptSuffix` 在存量行上因此渲染空串，不产 `aundefined`，不撞 §5.3 的「出现 `a1` 即红」），`roundCount` 与今日一致（兼容且不误判）；(c) 旧形行的完成问句：`#rowClosed` 判闭合、`preflight#recordedTasksOf` 对该行非空（旧 cycle 不被读成无完成轮）；(d) 记录带 `carrierPath` 时 `recordsOf` 原样返回；(e) 往返 pin：写入一条 `{ op: "review", cycle: 1, attempt: 1 }` 的记录后，`board-view` 该线的 rounds 单元格看得见它（`review` 与 cycle `1` 同时出现）——写一条记录 → 板面看得见它，经 `RoundRecords` 同一归一，不经 Task 11 的排版面。`preview.test.ts`：`would record` 行描述**将追加的那一条记录**（op · cycle · attempt 三个身份同时出现），四条既有字节 pin 逐字重锚。`run.test.ts`：一个 BLOCKED 的 implement 轮**写入**一条记录（`verdict.targetAction === false`），且下一次派发算出同 cycle 的 `attempt + 1`。 — checkable: 五条账本用例（含两形旧 progress.json 的完成折算与两条完成问句）+ 一条记录→板面往返 pin + 一条 `would record` 身份 pin + 一条 BLOCKED 入账用例先红
- [ ] **Step 2: 改账本** —— `rounds` 类型换 `RoundRecord[]`；`recordRound` 收整条记录；读期归一缝 `RoundRecords.of(row)`（`Ledger#recordsOf` · `BoardView#rowRounds` · preview 共读）把旧两形的每个 cycle 号折成一条**完成记录**（`op` 取 mode 键 · `cycle` 取旧轮号 · `attempt: 1` · `verdict: { treeClean: true, targetAction: true }` · `dispatchBase: null` · `violations: []` · `carrierPath: null`；不写回、不迁移）——旧 `rounds` 只装完成轮（`Run#bookkeep` 仅在 `!blocked` 时 `recordRound`），折算故保住完成语义，存量已闭合线不读成未完成；数组槽需区分记录对象与纯数字两种元素；新增 `completedCycles`（只取 `verdict.targetAction === true`）。 — checkable: 旧两形读入后 `roundCount` 与今日一致，且 `completedCycles` 含全部旧 cycle
- [ ] **Step 3: 改读面（四类）** —— 完成问句（`Ledger#pendingFix` · `Ledger#rowClosed` · `Ledger#waveLinePhase`（`session/wave.ts` 委托）与 `Ledger#roundRoute` 的 implement/fix 成员读 · `Ledger#orphanHandoffs` · `preflight#recordedTasksOf`）改读 `completedCycles`；派发编号（`roundCount` / `#reviewCount` / `#roundFor` 的 review 腿）读全部在册 cycle；活跃跳承载轮读**最新完成轮**；显示读面（board / preview）按 §5.3 的 Task 11 落地。`run.ts`：`#bookkeep` 去掉 `blocked` 分叉，已派发轮一律 `recordRound`（载体不覆盖规则保留）；**派发侧点名 attempt 调用点**——`Run` 一次分配：`const attempt = naming.attemptOf(records, op, cycle)`，同一个值同时写进 `RoundRecord` 与 `naming.logName(op, type, params, attempt)`（Task 2 的签名），不重复推算。**显示读面在本任务内同步迁移**（不许把读旧形的缺口留到 Task 11）：`face/board-view.ts:600-608` 的 `#rowRounds` 改经 `RoundRecords.of` 取记录（旧的 `Array.isArray(value)` 旧形过滤退场——归一已由 `RoundRecords` 承担；`roundsCell` 从记录的 `cycle` 取编号、按 `VERB_ORDER` 聚合），`face/preview.ts:153` 的 `progress.waves["<key>"].rounds.<phase> += [<round>]` 描述串改为描述将追加的那条记录（op · cycle · attempt）；Task 11 只做排版重设（聚合令牌 / `+N` / attempt 上标 / 路径省略 / 列对齐），**不再承担记录形状迁移**。 — checkable: 硬失败 fix-K 后 `#pendingFix` 为 false 且重派算出 attempt+1；写一条记录后 board 单元格可见（往返 pin 转绿）
- [ ] **Step 4: 跑绿 + 提交** —— `pnpm -C packages/cdd-engine test` → PASS（既有 rounds 形状断言改锚到记录面，断言不删）；`git commit -m "feat(cdd-engine): record every dispatched round as a first-class fact"`。 — checkable: `pnpm -C packages/cdd-engine test` exit 0

#### Acceptance
BLOCKED/TIMEOUT 轮写入记录（`targetAction: false`）；`completedCycles` 只认 `targetAction === true`；硬失败的 `fix-K` 不被读成已做、重派落在同一 cycle（不产 `fix-(K+1)`）；旧 `progress.json` 两形（数组值 / 纯数字周期数）读得动且不误判——每个旧 cycle 折成一条完成记录（`attempt: 1` 随折算入册——存量行不产 `aundefined`；存量已闭合线仍判闭合、`recordedTasksOf` 非空）；`carrierPath` 随记录落盘；attempt 由命名单源一次分配、记录与日志名共读同一值；记录形状换血后**每个读面同批迁移**——board 的 rounds 单元格与 preview 的 `would record` 行都读新形（一条「写一条记录 → board 显示它」的往返 pin），旧形过滤代码零残留。

#### DependsOn
none

### Task 4: 完成判据契约 + 按 verb 注册表

#### Objective
把「这一轮算不算完成」从散文变成两条判据实现 + 一个按 verb 的注册表：`implement` = 组基线以来有提交，`review`/branch review = 载体存在且 schema 合法。

#### Files
- Create: `packages/cdd-engine/src-next/contract/completion-criterion.ts`
- Test: `packages/cdd-engine/src-next/contract/__tests__/completion-criterion.test.ts`

#### Consumes
`GitClient#commitsSince` · `HandoffSchema#planeOf` · `RoundRecord`（Task 3）。

#### Produces
- `export interface CompletionCriterion { judge(ctx: CompletionContext): CompletionVerdict }`
- `export interface CompletionContext { readonly record: RoundRecord; readonly row: ProgressRow; readonly records: readonly RoundRecord[]; readonly carrier: unknown; readonly reviewsPath: string | null; readonly git: GitClient; readonly repoRoot: string }` —— `records` 是该键的在册记录（`Ledger#recordsOf` 的派生面，供 `CommitsSinceGroupBase` 取组基线与 `FixDispositions` 找同 key 同 cycle 的 review 完成记录）；`reviewsPath` 是请求方 review 载体的取值缝（provider：`CliLifecycle#reviews`，`face/lifecycle.ts:105/167`，回退走 `:410` 同款的 `ledger.handoffPath("review", …)`；缺席时为 `null`）。两个格都由 `CliLifecycle#verdictOf` 供值（它同时持 ledger 与 `#reviews`）。**供值方 pin 落 Task 7 Step 1(f)**（`#verdictOf` 与 `#reviews ?? ledger.handoffPath("review", …)` 回退同住 lifecycle）；本任务只钉 ctx 的纯形状，不 import face / lifecycle（W2 不以 face 面依赖收尾）。
- `export interface CompletionVerdict { readonly fulfilled: boolean; readonly violation: RoundViolation | null }`
- `export class CommitsSinceGroupBase implements CompletionCriterion`（组基线 = 该组**最早一条记录的 `dispatchBase`**）
- `export class JudgeCarrier implements CompletionCriterion`（载体缺失或 `findings` 非数组 → hard；`findings: []` 合法）
- `export const COMPLETION_CRITERIA: Readonly<Partial<Record<OpType, CompletionCriterion>>>`（本任务只注册 `implement` · `review`（branch review 折算 `review`）；`fix` 的注册在 Task 6）
- `export class CompletionCriteria { static of(op: OpType): CompletionCriterion }` —— 未注册 verb 在构造期抛错（本任务唯一的完整性断言面是「已注册键 ⊆ verb 集」）

#### Steps
- [ ] **Step 1: 写失败用例** —— (a) `implement`：组基线 = 最早 `dispatchBase`、`commitsSince` 空 ⇒ `fulfilled: false` 且 `violation.grade === "hard"`；非空 ⇒ true（含「attempt 1 已提交、attempt 2 零新提交」仍判完成）。(b) `review`：`{"findings": []}` ⇒ true；`{}` / `findings: "x"` ⇒ false + hard。(c) `COMPLETION_CRITERIA` 的**已注册**键集 ⊆ `OpType` 的 verb 集，且 `CompletionCriteria.of` 对未注册 verb（本任务下是 `fix`）构造期抛错。(d) ctx 纯形状 pin（字面构造，不起 lifecycle、不 import `face/`）：一条七格齐全的字面 `CompletionContext`（`records` 含两条同组记录、`reviewsPath` 取 `…/review-1.json`）调 `CommitsSinceGroupBase` / `JudgeCarrier`，断言两格可读且判据只读 ctx（`records` 的消费面：组基线取最早一条的 `dispatchBase`）。供值方两条格（`#verdictOf` 的 `records` / `reviewsPath`）的 pin 在 Task 7 Step 1(f)。 — checkable: 四组用例先红（零提交 / 空 findings / 已注册键集 ⊆ verb 集与未知 verb 抛错 / ctx 纯形状）
- [ ] **Step 2: 实现契约与两个判据** —— 组基线由记录派生（找该组 `dispatchBase` 非 null 的最早一条）；`JudgeCarrier` 直接读载体 JSON 的 `findings` 形状。 — checkable: 组基线取最早 `dispatchBase`（attempt 2 零提交仍判完成）
- [ ] **Step 3: 跑绿 + 提交** —— vitest PASS；`git commit -m "feat(cdd-engine): judge round completion by one registry keyed on the verb"`。 — checkable: `vitest run src-next/contract` exit 0

#### Acceptance
`implement` 判据按**组**基线（同组内重派不误判为空转型）；`review` 的空 `findings` 是批准而非违约；已注册键 ⊆ verb 集且未知 verb 在构造期即失败（本任务的注册表 pin）；ctx 两格只钉纯形状（供值 pin 在 Task 7）；「键集 == verb 集」的完整性 pin 在 `fix` 注册后由 Task 6 收口。

#### DependsOn
3

### Task 5: 活性两腿换血（撤 workspace-mtime 腿）

#### Objective
活性信号改为**两条都由 child 自身产出**的腿——日志增长 + 组 CPU 前进（附加腿）；撤掉 workspace-mtime 腿与随之无消费者的排除面。

#### Files
- Create: `packages/cdd-engine/src-next/contract/liveness-signal.ts`
- Modify: `packages/cdd-engine/src-next/face/termination.ts` · `packages/cdd-engine/src-next/session/ledger.ts`（`Sample.newestMtimeMs` 退场）· `packages/cdd-engine/src-next/face/lifecycle.ts`（把本轮的 `logPath` 与 `pgid` 喂给采样器）
- Test: `packages/cdd-engine/src-next/contract/__tests__/liveness-signal.test.ts` · `packages/cdd-engine/src-next/face/__tests__/termination.test.ts` · `packages/cdd-engine/src-next/face/__tests__/cli.test.ts`（`:5450` 与 `:5848` 两处 `lastSample: SampleRecord` fixture 随形状迁移，否则 `typecheck` 在本波即红）

#### Consumes
`ProcessFacts.groupCpuMs`（`infra/proc.ts`，不动）· `RoundLog.sizeOf` / `mtimeOf`（Task 2）。

#### Produces
- `export interface LivenessSignal { sample(): SignalReading }` —— `SignalReading = { readonly value: number | null; readonly readableAt: number | null }`：`value` 是本 tick 的读数，`readableAt` 是该腿**最近一次可读**的 tick 时刻（本 tick 读不到时**保留**上一次可读时刻，不清零）——「窗口内曾可读」因此是可判事实，不是丢掉的过去；信号实现自持这个状态（生命周期 = 一次派发，见下条工厂）。
- `export class LogGrowth implements LivenessSignal` · `export class CpuAdvance implements LivenessSignal`
- `export interface LivenessContext { readonly logPath: string; readonly pgid: number }` —— 本轮事实：`logPath` 是本轮日志路径（重派带 `-a{attempt}`），`pgid` 是本轮 child 的进程组；两格都由派发侧（`face/lifecycle.ts`）在本轮现取
- `export const LIVENESS_SIGNALS: readonly ((context: LivenessContext) => LivenessSignal)[]` —— **按轮工厂**，不是模块级实例数组：采样器以本轮 `LivenessContext` 现造信号（`CpuAdvance` 为附加腿），`readableAt` 这类自持状态因此不跨轮串味（上一轮的「曾可读」不得为下一轮作证）
- `export interface LivenessInput { readonly readings: readonly SignalReading[]; readonly previous: readonly (number|null)[]; readonly idleMs: number; readonly windowMs: number; readonly now: number }`（`now` 由采样器的同一 tick 时钟供值；五格收进参数对象）
- `export class LivenessJudge { verdict(input: LivenessInput): StallVerdict }` —— 实现 spec §4.2 的四态真值表：`progress` = 任一腿前进；否则「至少一条腿的 `readableAt` 落在 `[now - windowMs, now]` 内」⇒ `idled` / `stalled`（按 `idleMs`）；该条件不成立 ⇒ `unknown`。`value === null` 本身**不**参与 `unknown` 判定（它既不贡献前进、也不贡献未知、更不阻断 stall）。
- `Sample.newestMtimeMs` 与 `Sampler` 的树扫描（`#newestMtimeMs` · `MAX_DEPTH` · `VCS_DIR` · `excludesFor`）删除。
- `CrashRecord` 增 `logPath: string | null` 与末次采样 `lastSample: { verdict: StallVerdict; logSize: number | null; cpuMs: number | null; at: number }`（spec §4.4：半死轮次的事后诊断面）。

#### Steps
- [ ] **Step 1: 写真值表用例** —— 八条：(a) 日志增长 + CPU 静默 ⇒ `progress`；(b) CPU 前进 + 日志静默 ⇒ `progress`；(c) 两腿静默、均**可读**、未满 30min ⇒ `idled`；(d) 同上但满 30min ⇒ `stalled`；(e) CPU 不可读（`null`）且日志静默满 30min ⇒ `stalled`（现行为是 `unknown`）；(f) 两腿都不可读且**整窗无 `readableAt`** ⇒ `unknown`（不杀）；(g) 窗口形：某腿前段可读且静默、随后变 `null`（文件被删 / `ps` 失效），静默满 30min ⇒ `stalled` **不是** `unknown`（`readableAt` 落在窗内）；(h) 按轮工厂：连续两轮派发各自 `LIVENESS_SIGNALS(context)` 现造信号，上一轮的 `readableAt` 不从新一轮读出（状态不跨轮）。 — checkable: 八条真值表/生命周期用例先红
- [ ] **Step 2: 实现契约与判官** —— OR 聚合；`unknown` 只在**整窗**无一条腿可读（每条腿的 `readableAt` 都不在窗内）时成立；阈值仍从 `TerminationPolicy` 读（60s / 30min）。 — checkable: `LivenessJudge` 八条转绿（含 (g) 的「先可读后不可读 ⇒ stalled」与 (h) 的按轮现造）
- [ ] **Step 3: 撤 mtime 腿** —— 删 `Sample.newestMtimeMs` / 树扫描 / 排除面；`termination.test.ts` 里依赖树腿的用例改钉日志腿（断言不删）；`cli.test.ts` 的两处 `lastSample` fixture 改为新形状（`{ verdict, logSize, cpuMs, at }`）；补一条回归：**仓库他处写入 + child 零输出零 CPU 30min ⇒ `stalled`**（今日会被判 `progress`）。 — checkable: 回归 pin「仓库他处写入 + 零 CPU 30min ⇒ stalled」先红后绿，且 `pnpm -C packages/cdd-engine exec tsc --noEmit -p .` exit 0（旧 `newestMtimeMs` fixture 已迁，本波不得以红 typecheck 收尾）
- [ ] **Step 4: 落地尸检面** —— `CrashRecord` 写 `logPath` 与 `lastSample`；用例断言被杀的轮其 crash 记录两格非空且 `logPath` 指向本轮日志。 — checkable: 被杀轮的 crash 记录含 `logPath` 与末样本，且 `logPath` 指到的文件存在
- [ ] **Step 5: 跑绿 + 提交** —— `pnpm -C packages/cdd-engine test` → PASS；边界 pin 收窄到 OS 调用面（`ps` 开阔 grep 今日 306 行命中，不是可成立的 pin）；`git commit -m "feat(cdd-engine): judge liveness by the child's own evidence"` — checkable: `grep -rnE 'execFileSync\("ps"|execFile\("ps"|"ps",' packages/cdd-engine/src-next --include=*.ts` 在 `infra/proc.ts` 与 `infra/__tests__/proc.test.ts` 之外零命中，且 `pnpm -C packages/cdd-engine test` exit 0

#### Acceptance
四态真值表逐行有用例（含「窗内曾可读、随后不可读 + 静默满 30min ⇒ `stalled`」）；信号按轮现造（`LIVENESS_SIGNALS(context)`，`readableAt` 不跨轮，一条 pin）；`unknown` 仅在整窗无腿可读时成立（`readableAt` 都在窗外）；仓库他处写入不再能自证 progress（红 pin）；`ps` 仍只在 `infra/proc.ts` 的 OS 调用面（其自身测试独立读数）；阈值与四态词零变化；`SampleRecord` 换形后 `pnpm -C packages/cdd-engine exec tsc --noEmit -p .` 绿（`cli.test.ts` 两处 fixture 同批迁移，不留跨任务红灯）。

#### DependsOn
2

### Task 6: `fix` 的逐条处置（载体槽 + 简化版判据）

#### Objective
work 载体新增 `dispositions` 槽，`fix` 的完成判据 = 逐条处置覆盖请求方 review 载体的每条 finding（summary 原文精确匹配），六类（含缺理由）判 hard。

#### Files
- Modify: `packages/cdd-engine/src-next/session/handoff-schema.ts`（`CARRIER` + `PLANE_SLOTS.work`）· `packages/cdd-engine/src-next/contract/completion-criterion.ts`（注册 `fix`）· `packages/cdd-engine/src-next/face/lifecycle.ts`（fix 轮收工后的汇总行输出点）· `packages/cdd-engine/src-next/face/words.ts`（`fixDispositionsSummary` 文案）
- Test: `packages/cdd-engine/src-next/session/__tests__/handoff-schema.test.ts` · `packages/cdd-engine/src-next/contract/__tests__/completion-criterion.test.ts` · `packages/cdd-engine/src-next/face/__tests__/cli.test.ts`（汇总行一条 pin）

#### Consumes
`CARRIER` / `PLANE_SLOTS` / `PLANE_REQUIRED`（`PLANE_REQUIRED` **不动**）· `CompletionCriterion`（Task 4）· 请求方 review 轮记录的 `carrierPath`（Task 3 · 同 key 同 cycle 的 review 完成记录）。

#### Produces
- `CARRIER.properties.dispositions = { type: "object" }`（值形 `{ [summary]: { status: "fixed" | "rejected", reason?: string } }`）
- `export class FixDispositions implements CompletionCriterion` + `COMPLETION_CRITERIA.fix`
- `COMPLETION_CRITERIA` 的完整性 pin 落于本任务：注册后已注册键集 == `OpType` 的 verb 集（Task 4 只钉「已注册键 ⊆ verb 集 + 未知 verb 构造期抛错」）
- `export const FIX_DISPOSITIONS_ZERO_COMMIT`（零提交 soft 观测的文案 —— **新写字面**：今日引擎没有可沿用的零提交告警文案，`commitsSince` 只用于崩溃尸检（`lifecycle.ts:228/755` · `infra/git.ts:54`），故本常量与 `FIX_DISPOSITIONS_SUMMARY` 同批新写）
- `export const FIX_DISPOSITIONS_SUMMARY`（`fixed {fixed} · rejected {rejected}` 两插槽文案，落 `face/words.ts`）+ `FixDispositions#summaryOf(carrier, input): string` —— spec §3.4 末条的汇总行：由 dispositions 与输入集**现算**，只作 fix 轮 capsule 之后的**一行 stdout**（不落盘、不进 capsule 三键、不加第二份读面）；这是 spec 要求的** deliberate byte addition**，故必须有 pin（Task 1 的口径面不加三元计数，此处也不加）。—— checkable（Step 3）: `fixed 2 · rejected 1` 与 `fixed 0 · rejected 0` 两形各一条

#### Steps
- [ ] **Step 1: 写失败用例** —— 六类 hard 各一条：(①) 该轮 work 载体缺失 ⇒ hard 并点名载体路径；(②) 载体在而 `dispositions` 槽缺失 ⇒ hard；(③) 键集与输入集不等（缺条 / 多条各一条）⇒ hard；(④) 键不属输入集 ⇒ hard 并点名未知条；(⑤) 请求方载体缺失或不可读 ⇒ hard 并点名路径（本轮自己的载体存在、请求方缺失 ⇒ 仍 hard，证明判据读的是请求方载体）；(⑥) `rejected` 缺 `reason` ⇒ hard。另五组：(a) 键集与输入集相等 ⇒ 完成；(b) 输入 `findings: []` ⇒ 要求键集为空 + 一条 soft 观测；(c) 旧记录（无 `carrierPath`）⇒ 判据跳过并落可见观测（不判 hard、不读成空集）；(d) 注册后 `COMPLETION_CRITERIA` 键集 == verb 集（完整性 pin）；(e) 请求方取值缝走**另一条路径**：本轮自己的 `carrierPath` 在盘、请求方路径（`reviewsPath`）缺失 ⇒ 仍判 hard 并点名请求方路径（证明判据读的是请求方而不是本轮自己）；(f) `fix` 轮零提交（组基线以来无提交）⇒ 一条 soft 观测（`FIX_DISPOSITIONS_ZERO_COMMIT` 字面，不判 hard、不改 exit 码）。 — checkable: 六类 hard 各一条 + 五组判定/兼容/soft（含 (e) 的请求方缝 · (f) 的零提交观测）+ 一条完整性 pin 先红
- [ ] **Step 2: 实现** —— `dispositions` 入 `CARRIER` 与 `PLANE_SLOTS.work`；`FixDispositions` 按**请求方**载体现读组装输入集（去重后比较）：取同 key 且 cycle 等于该 fix 轮 cycle 的 review 完成记录（`completedCycles(key, "review")` 匹配该 cycle）的 `carrierPath`，缺失时回退该轮 fix route 的 `--reviews` 路径——`record.carrierPath` 是被判轮**自己**的载体，不用于此；六类 hard + 两类 soft 观测；`fix` 注册后完成键集 == verb 集。 — checkable: `PLANE_REQUIRED.work` 仍为 `status`+`artifacts`（结构 pin）且 `COMPLETION_CRITERIA` 的键集 == verb 集
- [ ] **Step 3: 汇总行** —— fix 轮读回判定之后向 stdout 追加**一行** `fixed N · rejected M`（`FixDispositions#summaryOf` + `[FIX_DISPOSITIONS_SUMMARY]` 文案）：值由 dispositions 与请求方输入集现算，不写进记录 / 载体 / capsule 三键；`cli.test.ts` 一条 pin 钉字节与位置（capsule 之后、且非 fix 的轮零此行）。 — checkable: fix 轮的汇总行字节 pin 转绿，且非 fix 轮该行零出现
- [ ] **Step 4: 跑绿 + 提交** —— `pnpm -C packages/cdd-engine test` → PASS；`git commit -m "feat(cdd-engine): judge a fix round by its dispositions"`。 — checkable: `pnpm -C packages/cdd-engine test` exit 0

#### Acceptance
六类 hard（work 载体缺失 · `dispositions` 槽缺失 · 键集不等 · 未知条 · 请求方载体不可读 · `rejected` 缺理由）各一条用例 + 两条 soft 观测（空输入观测 · 零提交观测，后者用新写的 `FIX_DISPOSITIONS_ZERO_COMMIT` 字面）；请求方载体的取值缝为同 key 同 cycle 的 review 记录 `carrierPath`（缺失回退 fix route 的 `--reviews`，即 ctx 的 `records` + `reviewsPath` 两格），判据不读本轮自己的载体（两条 pin：本轮载体在而请求方缺失 ⇒ 仍 hard）；`PLANE_REQUIRED` 零变化（`implement` 不被要求交处置）；旧记录跳过且可见；注册后 `COMPLETION_CRITERIA` 键集 == verb 集；`fixed N · rejected M` 汇总行有字节 pin（现算 · 不落盘 · 不进 capsule · 非 fix 轮零行）。

#### DependsOn
4

### Task 7: 终态裁决与违约分级（退出码不再是唯一信号）

#### Objective
`face/lifecycle.ts` 收工时先写 `{treeClean, targetAction}` 裁决，再按违约族分流：hard 判该轮失败（exit 非零 · 照常入账 · stderr 的 `CDD_BLOCKED` 行带日志路径），soft 只记账；`reviewedRevision` 的三个回写以裁决为门。

#### Files
- Modify: `packages/cdd-engine/src-next/face/lifecycle.ts` · `packages/cdd-engine/src-next/session/run.ts` · `packages/cdd-engine/src-next/session/ledger.ts`（派生计数）· `packages/cdd-engine/src-next/face/words.ts`（报文）
- Test: `packages/cdd-engine/src-next/face/__tests__/cli.test.ts` · `packages/cdd-engine/src-next/face/__tests__/termination.test.ts`

#### Consumes
`COMPLETION_CRITERIA`（Task 4 · Task 6）· `RoundRecord` / `RoundVerdict`（Task 3）· `RoundLog.path`（Task 2）。

#### Produces
- `CliLifecycle#verdictOf(frame, outcome): { verdict: RoundVerdict; violations: readonly RoundViolation[] }` —— 同时供 `CompletionContext` 的两格：`records` 取 `Ledger#recordsOf(key)`（当前键的在册记录）、`reviewsPath` 取 `#reviews ?? ledger.handoffPath("review", …)`（`face/lifecycle.ts:410` 同款回退）；两格只在此处供值（单供值点）
- `Ledger#counterOf` 的派生面：`softViolationsOf(key)`（各轮 soft 条目数 + `treeClean === false` 派生一条），`contractViolationCount` 持久化标量退役（旧值只读忽略）。
- 证据门改为 hard 条目（`{line}-test-evidence.json` 缺失/malformed/违约 ⇒ `grade: "hard"`）。
- `Run` 的三个**既有**私有回写 `#recordReviewedDocRevision` / `#recordReviewedWaveBrief` / `#recordReviewedBranchRevision`（`session/run.ts:495-512`，今日由 `#bookkeep` 的 `!blocked` 分支调用）改由 `verdict.targetAction === true` 为门：调用点仍在 `#bookkeep` 同一处，只换谓词。**不新建** `ReviewedRevisionWriter` 类（三个方法各持一条待审身份，收敛成类是另一相位的重构，本相位不拔）。

#### Steps
- [ ] **Step 1: 写失败用例** —— (a) `implement` 零提交 ⇒ exit 非零 + 记录 `targetAction: false` + 该轮**在册**（`board` 可见——记录读面已由 Task 3 迁到记录数组，本断言不依赖 Task 11 的排版重设）；(b) 证据缺失 ⇒ hard（exit 非零），软违约（脏树）⇒ exit 0 且计数 +1；(c) 载体缺失的 `review` ⇒ hard，且 `reviewedRevision` **未**绑定（随后改文档 ⇒ `next:` 回到 `review`）；(d) stderr 的 `CDD_BLOCKED` 行含该轮日志路径——**两条**：hard 裁决轮一条、被 kill 的轮（`#cutShort` 的 kill / timeout 分支，`face/lifecycle.ts:715`）一条，且两条点名的 `.kairos/cdd/<slug>/logs/<stem>.log` 文件均存在；(e) `implement` 轮的 handoff 载体缺失 ⇒ exit 0 + 派生计数 +1（soft，spec §3.3）；(f) ctx 两格的**供值方** pin：`#verdictOf` 供出的 `records` 等于 `Ledger#recordsOf(key)`（含本轮之前已入册的全部记录）；`--reviews` 在场时 `reviewsPath` 等于该值、缺席时等于 `ledger.handoffPath("review", …)` 的回退值（两条断言钉同一供值点）。 — checkable: 六条裁决用例先红（含两条日志指路 pin 与 ctx 两格供值）
- [ ] **Step 2: 实现裁决与分级** —— 裁决先写、违约族分流；`#verdictOf` 自书 hard 条目（复用 `contract-violation` 因由，零新枚举）并供 `CompletionContext` 的 `records` / `reviewsPath` 两格；`#blocked` 分支的写点全退（Task 3 已改）；`#bookkeep` 里三个既有回写换谓词（`!blocked` → `verdict.targetAction === true`）。 — checkable: hard 轮 exit 非零且在 `board` 可见；hard 失败的 review 不绑定 `reviewedRevision`
- [ ] **Step 3: 派生计数收口** —— `counterOf` 对 `contractViolationCount` 返回派生值；旧 `progress.json` 标量忽略；`PROGRESS_COUNTER_ZERO` 只留仍被写入的键。 — checkable: `counterOf("contractViolationCount")` 返派生值且旧标量被忽略
- [ ] **Step 4: 跑绿 + 提交** —— `pnpm -C packages/cdd-engine test` → PASS（覆盖面变化的断言逐条翻转并注明，断言不删）；`git commit -m "feat(cdd-engine): let the terminal verdict decide a round, not its exit code"`。 — checkable: `pnpm -C packages/cdd-engine test` exit 0

#### Acceptance
hard 轮的 exit / 记录 / 在册三面一致；soft 轮不改 exit 码（含 `implement` 载体缺失 ⇒ exit 0 + 派生计数 +1）；派生计数只数 soft 且单一出口；证据门归 hard；`reviewedRevision` 以裁决为门（红 pin，三个回写仍是 `session/run.ts:495-512` 的既有方法、只换谓词）；stderr 的日志指路两条（hard 裁决轮 · 被 kill 轮）；`CompletionContext` 的 `records` / `reviewsPath` 两格由 `#verdictOf` 单点供值（两断言 pin：记录面相等 · `--reviews` 在场/缺席两形），Task 4 不承担该 pin。 **派发前的 `tree-clean` 门行为与字节面零变化**（既有脏树拒绝用例全绿，本相位只裁派发之后的终态裁决）。

#### DependsOn
3, 4, 6

### Task 8: 波内上限 3（硬门 + 计划面规则）

#### Objective
`MAX_TASKS_PER_WAVE = 3`：计划面规则判「任一依赖层 ≤3」，派发面硬门拒「frontier 超 3」与「`--tasks` 超 3」，且病因点名 `DependsOn` 修法；引擎不切块。

#### Files
- Modify: `packages/cdd-engine/src-next/session/next.ts`（常量）· `packages/cdd-engine/src-next/session/wave.ts`（两条拒绝 + 次序）· `packages/cdd-engine/src-next/contract/rules.ts`（`wave-width-at-most-three` 注册行）· `packages/cdd-engine/src-next/contract/invariants.ts`（`WaveWidthInvariant` + `JudgeContext.taskLayers`——全部 `Invariant` 策略的既有宿主）· `packages/cdd-engine/src-next/contract/judge.ts`（`ContractInput.taskLayers` 注入格）· `packages/cdd-engine/src-next/session/preflight.ts`（把 graph 门已算出的批次注入 `validate()`）· `packages/cdd-engine/src-next/face/words.ts`（两条报文）
- Test: `packages/cdd-engine/src-next/session/__tests__/wave.test.ts` · `packages/cdd-engine/src-next/contract/__tests__/rules.test.ts`（规则行与 `WaveWidthInvariant` 的用例同宿主）

#### Consumes
`TaskGraph#batches()` / `frontier`（不动，且是宽度的**唯一**派生权威）· `WaveGate.vet` 现有门序（`mixed-batch` → `exact` → `wrong-phase`）· `preflight` 的 graph 门（`session/preflight.ts:232` 已由 `TaskGraph#batches()` 持有该计划的层级，`#ledgerFactsOf` 用的同一条派生）。

#### Produces
- `export const MAX_TASKS_PER_WAVE = 3`（`session/next.ts`，与 `REVIEW_CYCLE_CAP` 同款代码常量）
- `WaveGateReason` 增 `"wave-too-wide" | "too-many-tasks"`；`WaveGate.vet` 的新判据插在 **`mixed-batch` 之后、`exact` 之前**
- `RULE_REGISTRY` 增 `{ scope: "doc", id: "wave-width-at-most-three", docKeys: ["plan"], create: () => new WaveWidthInvariant() }`
- `export class WaveWidthInvariant implements Invariant`（住 `contract/invariants.ts`，读注入的层级逐层判宽——**不** import `session/graph.ts`，**不**在 `parsed.taskBlocks` 上重写一份 `batches()`：`TaskGraph#batches()` 是唯一权威。`contract/` 层零 `../session` 导入的结构 pin 保持绿（今日方向是 session → contract））
- `JudgeContext` 增 `taskLayers?: readonly (readonly number[])[]`，经 `ContractInput.taskLayers?` 由调用方注入：`session/preflight.ts` 在 graph 门处已构造 `TaskGraph`，派发前 `this.#contract.validate({ …, taskLayers: graph?.batches() })` 直接供值；`taskLayers` 缺席时规则**零 finding** 并在 `checked` 行里落可见的 `plan layers: unavailable`（对齐既有「缺事实包 ⇒ 行渲染 skipped 而非拒绝」先例）——但 plan / wave 派发路径恒经 graph 门，故该降级只在非派发调用面出现。

#### Steps
- [ ] **Step 1: 写失败用例** —— (a) frontier 超 3：任务 `1` / `2` / `3` 无依赖、`4` / `5` 只依赖 `1` ⇒ `TaskGraph#batches() = [{1,2,3}, {4,5}]`（两层宽 3 / 2，**计划面规则绿**）；取 `done = {1}` ⇒ frontier `{2,3,4,5}`（四成员，宽 4 > 3）→ `reason === "wave-too-wide"`，报文含 `2,3,4,5`（该 frontier 成员 id 的升序逗号形）与 `DependsOn` 修法句，且**不是** `split`——该形即「计划面规则必要不充分」的例（规则绿而派发门拒）；(b) `--tasks 1,2,3,4` → `too-many-tasks`；(c) `mixed-batch` 形状仍报 `mixed-batch`（次序 pin）；(d) 计划面：某层 5 个 ⇒ 规则红并点名该层 id（断言面走 `preflight` 注入的 `taskLayers`，即 `TaskGraph#batches()` 的同一值）；改成链式（后两个依赖第三个）⇒ 规则绿；(d2) 单一权威 pin：`taskLayers` 缺席时规则零 finding 且 `checked` 行含 `plan layers: unavailable`（不另建第二份 `batches()`）；(e) 跨面正向 pin：完整层并集全闭（层 `{1,2,3}` 全闭）时 `#close` 渲染的 `next-wave` 字面（`tasks` 升序三值）过 `WaveGate.vet` ⇒ `ok: true`；(f) 历史读面：已入账的一条 4 成员闭合波行读入 `closedWaves()` / `frontier` 零报错（历史不动）。 — checkable: 六组用例先红（含「不得报成 split」·「自家 `next:` 字面被自家波门接受」· 历史超 3 波行可读）
- [ ] **Step 2: 实现三面** —— 常量落地；`WaveGate.vet` 两段判据（先 `open.length > MAX`，再 `requested.length > MAX`）插在 `mixed-batch` 之后；规则行与 `WaveWidthInvariant`（读 `ctx.taskLayers`）+ `ContractInput.taskLayers` 的注入与 preflight 供值；`face/words.ts` 两条报文。 — checkable: frontier `{2,3,4,5}` 报 `wave-too-wide`、`--tasks` 4 个报 `too-many-tasks`，且 `contract/` 零 `../session` 导入
- [ ] **Step 3: 跑绿 + 提交** —— `pnpm -C packages/cdd-engine test` → PASS；`git commit -m "feat(cdd-engine): hold a wave to three tasks with a hard gate and a plan rule"`。 — checkable: `vitest run src-next/session/__tests__/wave.test.ts` exit 0

#### Acceptance
frontier 超 3 报 `wave-too-wide`（**不得**报 `split`）且报文点名成员 id 与 `DependsOn` 修法；`--tasks` 超 3 报 `too-many-tasks`；`mixed-batch` 次序不变；计划面规则红/绿各一 pin；`TaskGraph#batches()` 是宽度唯一权威（`contract/` 零 `../session` 导入 + 缺席时可见降级，各一条 pin）；完整层并集上的 `next-wave` 字面必被波门接受（跨面正向 pin）；`batches()`/`frontier` 语义零变化（既有波次用例全绿）；已入账的超 3 波行读取零报错（一条 pin）。

#### DependsOn
3

### Task 9: `NextHop` 一处派生（判据仍在计数表）

#### Objective
把「下一轮是什么」收敛成 `NextStepRouter` 上的一个方法：`NextHop {face, target, hop, to, reason, route}`，判据读既有计数表，`hop` 由 `route.kind` + `face` 经**一处**映射读出，`reason` 走单一文案表。

#### Files
- Modify: `packages/cdd-engine/src-next/session/next.ts`
- Create: `scripts/__tests__/next-loop-twin.test.ts`（仓库级孪生 pin）
- Test: `packages/cdd-engine/src-next/session/__tests__/next.test.ts`

#### Consumes
`NextStepRouter.next`（计数表，判定面不动）· `Route`（六 kind）· `RouteTarget`（`NextHop.target` 的载荷：`plan` / `type` / `id`）· `PIPELINE_NEXT`（降为数据）· `PipelineKey`（`phase-spec` / `overall` / `plan` / `wave` / `branch`）。

#### Produces
- `export interface NextHop { readonly face: PipelineKey | null; readonly target: RouteTarget | null; readonly hop: Hop | null; readonly to: PipelineEntry | null; readonly reason: string; readonly route: Route | null }` —— `face` / `target` / `route` **可空**（spec §5.2）：失败面（`BLOCKED` / `TIMEOUT` ⇒ `next` 返回 `null`）与 doc-class `terminal` 行没有 route；已派发的正常面与 board 的已进入面仍带 `face` / `target` / `route`。`target` 是**判别与渲染共读的那一格**（`docClassOf(target)` 与 `RouteRenderer` 的 plan/type/id 字面都只读它）。
- `export type Hop = "implement" | "review" | "branch-review" | "fix"`
- `export const NEXT_HOP_REASON = { docDrift, pendingFix, closedLine, faceClosed, softCap, taskOpen, docClassBlocked } as const`（`reason` 文案的唯一来源）
- `NextStepRouter#nextHop(input: NextHopInput): NextHop`，`NextHopInput = { face: PipelineKey | null, target: RouteTarget | null, gate: { drift: boolean; open: boolean }, latestCompleted: RoundRecord | null, route: Route | null, counters: { consecutiveS1: number }, docClassOf: (target: RouteTarget) => PipelineKey | "blocked" | "terminal" }`（`route` / `target` 可缺席——失败面与 doc-class `terminal` 没有 route，spec §5.2；`docClassOf` 是**注入的判别缝**，其入参就是这一格 `target`）
- `NextStepRouter#hopOf(route: Route, face: PipelineKey | null): Hop | null` —— **唯一**常量映射，且**读 face**：`next-wave → implement` · `review → review`（`face === "branch"` ⇒ `branch-review`）· `fix → fix` · `done / soft-cap / handoff → null`（`Route` 的 `review` 值不带面，branch 面事实只在 `NextHop.face`，故签名必收 face）
- `#nextHop` 的 `to`：`handoff` 与 `done` 同路径取 `PIPELINE_NEXT[docClass]`，`docClass = docClassOf(input.target)`——**target 由调用方供值**：capsule 供帧的 target、board 供它遍历选中的面 target、CLI 拒绝报文供自己的 target；无 target 时 `docClass` 不可判⇒ `terminal`（`to: null` + `faceClosed`）。doc-class 判别**经注入**——`NextHopInput.docClassOf` 由调用方供值：capsule 注入自己的 `#docClassOf`（`face/capsule.ts:155-166`，内部读 `BoardView.readDocType`），board / CLI 注入各自的同一判别源。`session/next.ts` **只消费注入值、不 import `BoardView`**（`next.ts` 已被 `face/capsule.ts:45` 与 `face/board-view.ts` 导入，把判别搬进来会造 `next.ts → board-view.ts → next.ts` 的运行时导入环，并让 session 反向依赖 face 类；spec §5.2 定的是「由 capsule 经构造注入给派生器」）。

#### Steps
- [ ] **Step 1: 写失败用例** —— (a) `review` 留 blocker ⇒ `hop === "fix"` 且 `route == {kind:"fix"}`；(b) `review` 全 0 ⇒ 闭合侧，`next-wave` 时 `hop === "implement"`、`reason === taskOpen`；(c) 闭合线 + drift ⇒ `hop === "review"`、`reason === docDrift`（同一形的 branch 面：`face === "branch"` ⇒ `hop === "branch-review"`，即 `hopOf(route, face)` 的面内覆写 pin）；(d) `done` ⇒ `hop === null`、`reason === closedLine`，且 `to` 由 `NextHop.target` 这一格判出：plan 段的 spec 目标（`doc-type: phase-spec`）⇒ `PIPELINE_NEXT["phase-spec"]`、`doc-type: overall` ⇒ `PIPELINE_NEXT["overall"]`（＝ `{kind:"done"}`，**不是** `terminal`）、`doc-type: single-spec` ⇒ `terminal` ⇒ `to: null`；(e) `soft-cap` ⇒ `hop === null`、`reason === softCap`；(f) 决议不可得（doc-class blocked）⇒ `reason === docClassBlocked` 且报文可渲染；(g) `fix` 的请求侧 review 载体含 blocker ⇒ `hop === "review"`（fix-K → review-K 重审）；(h) `fix` 的请求侧无 blocker ⇒ 闭合 / 下一跳（`hop` 按 ready batch 取，不是 `review`）；(i) doc-class `terminal`（`single-spec` / 无 target）⇒ `hop === null` · `to === null` · `reason === faceClosed`；另一条结构 pin：`session/next.ts` 不以任何形式 import `face/board-view.ts`（不造运行时环，doc-class 只经 `docClassOf` 注入）；(j) 报文三形：`hop` 非空 ⇒ `<reason> · the next round is <hop>`；`hop` 空而 `to` 非空 ⇒ `<reason> · next: <to>`；两者皆空 ⇒ 只渲染 `reason`（不造动词槽）。 — checkable: 十一条映射/报文用例先红（§5.2 六值逐值——含 branch 面的 `review → branch-review`——与 `reason` 七值各有产出者；`done` 行 `to` 由 `target` 判出）
- [ ] **Step 2: 实现 `nextHop` / `hopOf` / 文案表** —— 判据只读 `route`（来自 `next`）；`reason` 按输入事实选一句；`hopOf` 是唯一映射。 — checkable: `nextHop` 十一条转绿且 `hopOf` 是唯一映射（且必读 `face`）
- [ ] **Step 3: 仓库级孪生 pin** —— 新建 `scripts/__tests__/next-loop-twin.test.ts`：读四份图源（`docs/diagrams/src/next-loop.{en,zh-CN}.json` · `architecture.{en,zh-CN}.json`），断言三条陈述（blocker → 重新评审 · 仅 warn/nit → `REVIEW_FIX` 收敛 · 连续周期软上限）由四份**合起来**覆盖——第三条与周期数只住在两份 `next-loop`，两份 `architecture` 只钉它真正携带的前两条；从两份 `next-loop` 图源抽出的「连续 N 个 blocker 周期」的 N 断言 **== `REVIEW_CYCLE_CAP`**（N 只在图源里，spec / 计划正文不抄）；源侧另 pin `#blockerCount` / `#close` / `REVIEW_CYCLE_CAP` 三个符号存在于 `session/next.ts`。 — checkable: `pnpm exec vitest run scripts/__tests__/next-loop-twin.test.ts` exit 0；图源里的 N 与常量同值（改任一侧即红）
- [ ] **Step 4: 跑绿 + 提交** —— vitest PASS；`git add packages/cdd-engine/src-next/session scripts/__tests__ && git commit -m "feat(cdd-engine): derive the next hop once, on top of the count table"`。 — checkable: `vitest run src-next/session/__tests__/next.test.ts` 与孪生 pin 均 exit 0

#### Acceptance
八条映射逐值有用例（含 fix 轮按请求载体的 blocker 数取 `review` / 闭合两行，含 branch 面 `review ⇒ branch-review`）；`hopOf(route, face)` 的六值逐值 pin（`Hop` 四个非空值各有产出者）；`done` 行的 `to` 由 `NextHop.target` 一格判出（overall ⇒ `PIPELINE_NEXT["overall"]`、single-spec / 无 target ⇒ `terminal` ⇒ `to: null`）；`reason` 七值逐值有产出者（含 `taskOpen` · `closedLine` · doc-class `terminal` → `faceClosed`）；仓库级孪生 pin 在册（四份图合起来覆盖三条陈述 · `architecture` 只钉前两条 · `next-loop` 周期数 == `REVIEW_CYCLE_CAP`，两侧任改即红）；`doc-drift` / `pending-fix` 有真实产出者（闭合线 + drift / 未闭合线 + 待修）；`hop: null` 的报文两形（`to` 非空 / 皆空）与 `hop` 非空的报文形各一条 pin；`PIPELINE_NEXT` 零判断逻辑（结构 pin）；计数表判据零改动（既有 `next` 用例全绿）。

#### DependsOn
3, 7

### Task 10: 四读面收敛 + 删除面

#### Objective
四个渲染面全部读同一个 `NextHop`（capsule 的 `next:` · 生命周期前沿 · CLI 拒绝报文 · board 的 `next:` 行）；删掉三处各算一遍的入口与 `targetLineOpen` 补丁参数。

#### Files
- Modify: `packages/cdd-engine/src-next/face/capsule.ts` · `packages/cdd-engine/src-next/face/gate.ts` · `packages/cdd-engine/src-next/face/board-view.ts` · `packages/cdd-engine/src-next/face/cli.ts` · `packages/cdd-engine/src-next/session/run.ts`
- Test: `packages/cdd-engine/src-next/face/__tests__/capsule.test.ts` · `packages/cdd-engine/src-next/face/__tests__/board-view.test.ts` · `packages/cdd-engine/src-next/face/__tests__/cli.test.ts`

#### Consumes
`NextHop`（Task 9）· `RouteRenderer`（`face/route-render.ts`，渲染载荷来自 `NextHop.route`）。

#### Produces
- `Capsule#emit(hop: NextHop | null, ...)` —— `NextHop` **缺席**（失败面：`BLOCKED` / `TIMEOUT`）时**不印** `next:` 行，`status · blocker · handoff` 三键字节原样；`NextHop` 在册时按下表逐行渲染。`#routeText` 的 doc-class 分支退场（判别已由注入的 `docClassOf` 完成），但「今日印不印、印什么」逐行冻结——**`hop` 为 `null` 不等于失败面**（`done` / `soft-cap` 今日都印行，字节不得静默改）。六行渲染冻结表（前一条 = 形状，后两条 = 字节 pin）：
  - ① `NextHop` **缺席**（失败面 `BLOCKED` / `TIMEOUT`）⇒ 无行；三键字节原样（pin：既有失败面对断言）。
  - ② `hop` 非空（`route` 非空：`next-wave` / `review` / `fix`）⇒ `NextHop.route` 经 `RouteRenderer` 渲染（`--tasks` / `--reviews` 载荷原样，pin：既有 `next:` 字面）。
  - ③ `hop: null` · `route?.kind === "soft-cap"` ⇒ `route.message` 原样（pin：`face/__tests__/face.test.ts:135-138`）。
  - ④ `hop: null` · `to` 非空（`done` 经 `NextHop.target` 判出 pipeline 键 / `handoff`）⇒ `next: <to>` 经同一渲染器（`route to /kairos:<skill> skill` 等今日字节）；`doc-type: overall` 的 `target` 在此行：`to = PIPELINE_NEXT["overall"] = {kind:"done"}`，渲染为 `next: done`。
  - ⑤ `hop: null` · `to: null` · `reason === face-closed`（doc-class `terminal`：`single-spec` / 无 target）⇒ `next: done`（pin：`capsule.test.ts:260` / `:287` / `:299`）。`terminal` 只属 `single-spec`：`#docClassOf` 对 overall 返回 PipelineKey `"overall"`（`capsule.ts:166`），故 overall 走行④（`to` 非空）——两行字节都是 `next: done`，但路径不同（`to: null` vs `{kind:"done"}`），pin 同时钉字节与路径。
  - ⑥ `hop: null` · `to: null` · `reason === doc-class-blocked`（缺 `doc-type:`）⇒ `next: CDD_BLOCKED …docType…`（今日字节，pin：`capsule.test.ts` 的 docType 行）。

  末三行（④⑤⑥）是 **deliberate byte freeze**：`to: null`（spec §5.2 的 `terminal` / `blocked` 行）与「今日仍印行」并存，故渲染按 `reason` 选形、不重算 doc-class，也不删行。
- `BoardView` 构造期**接收** `NextHop`（不持账本、不自推）。**`walk` 的四条面序规则有落点**：它们落在 board 的构造方（`face/cli.ts` 的 board 装配点，今日 `BoardView#nextLine` 里 `walk` 的调用处，`board-view.ts:555`）——按 `PIPELINE_FACES` 顺序遍历 face report、套今日四形（frontier 带 active hop / frontier 无 hop 但已进入 ⇒ 自身出口 / frontier 未进入 ⇒ 回退前一进入面 / 全闭 ⇒ 最后进入面 + `#lastEnteredIndex`），再以注入的 `NextHop` 构造 board；`PIPELINE_FACES` 仍是唯一面序声明（cli 侧 import，不自带第二份序），`#lastEnteredIndex` 随 `walk` 一起搬到该构造面或留在 router 作派生工具（二选一，实现时声明）。
- `CliGate#lineGate` **保留并收窄**：`phase` / `verdict` / `reviewed` 三值不动，`cli.ts:730` 的 `pendingFixBlock` / `docLineBlock` / phase hint 逐字依赖它，两条报文各有行为 pin（`cli.test.ts:2265` 「already reviewed at v1.0」· `:2467` 「the pending fix applies…」），而 `reviewed`（`DocRevisionRef`）在 `NextHop` 里无处存——**删的只是它内部的自指 hop 推演**（`NextStepRouter.resolve` 那条 route→route 推导）；拒绝报文改读同一 `NextHop` 的 `reason` 与新 hop（block 报文仍由 `lineGate` 供相位与 `reviewed`）。
- 删除：`NextStepRouter.resolve` · `NextStepRouter.walk` · `CliLifecycle#targetLineOpen` 与 `Run#targetLineOpen` 的生产侧（`face/cli.ts` / `session/run.ts` 的传递面一并退）。**删面之外**：`lineGate` · `#linePhase` · `#lineKey` 保留（相位与 block 报文面）。

#### Steps
- [ ] **Step 1: 写失败用例** —— (a) capsule 的 `next:` 与 board 的 `next:` 逐字相等（同一次解析的同一对象）；(b) warn/nit-only 的 fix 之后 `next:` **不是** `review`（C5-1 投影）；(c) 闭合线改文档后 `next:` 回到 `review`；(d) CLI 拒绝报文的 hop 与 board 的 hop 相等（跨面）；(e) 删除面 pin 只钉被删入口的精确名：`grep -rnE 'NextStepRouter\.(resolve|walk)|targetLineOpen' packages/cdd-engine/src-next --include=*.ts` 零命中；并对删面之外的近名符号加**保留**断言——`\blineGate\b` · `#linePhase` · `#lineKey` 在 `face/gate.ts` 仍各自命中（旧 pin 的 `#lineGate` 拼写与实存方法 `lineGate`（`gate.ts:52`）不符，只命中 `gate.ts:4` 的注释，删注释即假绿）；开阔的 `resolve(` 今日 41 处在非测试面，含 `path.resolve` / `Workspace#resolve`，不得当作 pin；(f) 漂移不得胜出：未闭合线 + 已有 blocker + drift 同时成立 ⇒ hop 仍为 `fix`、`reason === pendingFix`；(g) `BLOCKED` 轮的 capsule 无 `next:` 行且三键字节不变（`NextHop` **缺席**，不是 `hop: null`）；(h) 生命周期前沿 `Run#peekNext` 的 hop 与 board / CLI 的 hop 逐字相等（第四读面的跨面断句）；(i) 渲染冻结表逐行 pin：`capsule.test.ts` 里 `next: done` 的三形（无 target / `single-spec` 走行⑤，`overall` 走行④）与缺 `doc-type:` 的 `CDD_BLOCKED …docType` 行、`face.test.ts` 的 soft-cap 行逐字与今日相等（`to: null` 与「印行」共存成立）；(j) 该表另补一条反例：把 `hop === null` 一律读成「不印行」时 (i) 必红；(k) 遍历落点回归 pin：board 的 `next:` 在今日 `walk` 的四形（frontier 带 active hop · frontier 无 hop 但已进入 · frontier 未进入回退前一进入面 · 全闭取最后进入面）上与今日 `walk` 输出逐字相等。 — checkable: 十一条跨面/行为用例先红（含渲染冻结表逐行、收窄后的删除面 grep 与四形遍历回归）
- [ ] **Step 2: 改四读面** —— 全部改为接收 `NextHop`；capsule 与 board 共用 `RouteRenderer`；删自指 hop 推演（`resolve`）、`walk`（规则落入 board 构造方）与 `targetLineOpen` 传递面。 — checkable: capsule 与 board 的 `next:` 逐字相等，且 board 四形与今日 `walk` 逐字相等
- [ ] **Step 3: 跑绿 + 提交** —— `pnpm -C packages/cdd-engine test` → PASS（capsule 字节面三键断言原样绿）；`git commit -m "refactor(cdd-engine): render the next hop from one object on every face"`。 — checkable: `grep -rnE 'NextStepRouter\.(resolve|walk)|targetLineOpen' packages/cdd-engine/src-next --include=*.ts` 零命中，且 `lineGate` / `#linePhase` / `#lineKey` 保留断言绿

#### Acceptance
四读面同一对象（capsule · CLI 拒绝报文 · board · `Run#peekNext` 各一条跨面 pin，四读面全覆盖）；`lineGate` 的相位判定与 `reviewed` 保留（两条 block 报文 pin 原样绿，删面不含它）；capsule 三键与失败面字节不变（失败轮零 `next:` 行，条件是 `NextHop` **缺席**而非 `hop: null`）；`done` / `soft-cap` / doc-class `terminal` / doc-class `blocked` 四行字节逐行冻结（各自一条 pin，deliberate byte freeze；`overall` 走行④而 `single-spec` 走行⑤，字节同为 `next: done`）；`NextStepRouter.resolve` / `NextStepRouter.walk` / `targetLineOpen` 零残留（精确名 grep），`lineGate` / `#linePhase` / `#lineKey` 保留断言在册；board 的 `next:` 与今日 `walk` 四形逐字相等（遍历落点回归 pin）；warn/nit-only 收敛、漂移重开、drift 不抢 blocker 三条行为 pin 在册。

#### DependsOn
9

### Task 11: board 排版重设（按 verb 聚合 + 逐轮裁决）

#### Objective
board 默认面按 verb 聚合、只按裁决标令牌、`+N` 标 finding 数、重派带 attempt 上标、路径省略与列对齐、在飞行只留身份；区间形**永不出现**（本相位不引入 `--verbose`）。

#### Files
- Modify: `packages/cdd-engine/src-next/face/board-view.ts` · `packages/cdd-engine/src-next/face/preview.ts`（`would record` 行描述将追加的那一条）
- Test: `packages/cdd-engine/src-next/face/__tests__/board-view.test.ts`

#### Consumes
`RoundRecord` / `RoundVerdict`（Task 3 · Task 7）· `NextHop`（Task 9）· Task 3 已落地的记录读面（`RoundRecords.of` · `BoardView#rowRounds` 读 `RoundRecord[]`）——本任务**只改排版**，不重做归一、不恢复旧形兼容。

#### Produces
- `BoardView#summaryCell(records: readonly RoundRecord[]): string` —— `{label} {count} {mark}`（裁决符不可省）+ `+N` 后缀（`N === 0` 省略）。
- `BoardView#attemptSuffix(record: RoundRecord): string` —— `attempt === 1` 空串，否则 `a{attempt}`。
- `BoardView#nextLine(hop: NextHop): string` —— 相对路径的 `next:` 行。

#### Steps
- [ ] **Step 1: 写失败用例** —— (a) 十轮全绿 ⇒ `review 10 ✓`（无区间形；出现 `1–10` 即红）；(b) 任一令牌缺裁决符即红；(c) `review 3 ✓+2` / `review 3 ✗`；(d) `fix 1 ✗ · fix 1a2 ✓` 且首轮无 `a1`；(e) 输出零绝对路径；(f) 在飞行只含 `op` + cycle + attempt；(g) 存在在飞记录时 `board` 运行前后 `progress.json` 与 lock 文件字节不变（零写 pin）。 — checkable: 七条渲染/零写用例先红
- [ ] **Step 2: 实现渲染器** —— 聚合与令牌、`+N`、attempt 上标、路径省略与列对齐；preview 的 `would record` 行只描述本次将追加的那一条（孤儿草稿与 `reviewedRevision` 读面**保留**）。 — checkable: 十轮全绿渲染为 `review 10 ✓`（区间形零出现）
- [ ] **Step 3: 跑绿 + 提交** —— `pnpm -C packages/cdd-engine test` → PASS；`git commit -m "feat(cdd-engine): aggregate the board by verb and judgement"`。 — checkable: `vitest run src-next/face/__tests__/board-view.test.ts` exit 0

#### Acceptance
七条渲染/零写 pin 全绿；finding 数不进默认面（无三元拆分）；区间形零出现；`board` 对在飞事实零写（`progress.json` 与 lock 文件字节不变）；preview 既有读面保留。

#### DependsOn
7, 9

### Task 12: 消费面义务（四问登记 · 审批门 · 写作权 + 结构面快照）

#### Objective
把四问登记一次、两处挂指针、三份派发方 skill 挂审批门（`cdd-dev` 另增日志指路句）、work-plane prompt 增 `may.amend = content`、并让「轮内改结构面」判 hard（快照比对，不登记规则行）。

#### Files
- Modify: `packages/cdd-engine/src-next/contract/skill-anatomy.ts`（四问登记项）· `packages/cdd-engine/src-next/render/templates.ts`（work-plane capability 行）· `packages/cdd-engine/src-next/face/lifecycle.ts`（派发时快照 + 收工比对）· `packages/cdd-engine/src-next/session/run.ts`（帧携带快照）· `packages/kairos/skills/cdd-spec-writer/SKILL.md` · `packages/kairos/skills/cdd-plan/SKILL.md` · `packages/kairos/skills/cdd-dev/SKILL.md`
- Test: `packages/kairos/tests/skill-anatomy.test.ts`（四问登记项的结构 pin · 节点/边数与 crossings 回归）· `packages/cdd-engine/src-next/face/__tests__/cli.test.ts`
- Create: `packages/kairos/tests/self-review-obligations.test.ts`（grep pin 宿主；引擎侧不新建 anatomy 测试）

#### Consumes
`ROSTER` / `growthBoundary`（anatomy 契约，**不改 crossings**）· `OpenFrame`（新快照格）· 计划文档的两个结构面（Task id 集 / 每任务 `DependsOn` 集）。

#### Produces
- `contract/skill-anatomy.ts`：`SELF_REVIEW_OBLIGATIONS` 登记表（四问正文）——仅登记，不改 digraph / 不改 crossings。
- `render/templates.ts`：work-plane 变体增一行 `capability: may.amend = content`（review 变体不声明）。
- `face/lifecycle.ts`：派发时（pre-flight 之后、spawn 之前）取 `{taskIds, dependsOn}` 快照随帧持有；收工时比对，变化 ⇒ 该轮 hard 条目（cause `contract-violation`）。
- `packages/kairos/tests/self-review-obligations.test.ts`：`packages/kairos/skills/*/SKILL.md` 上的 grep pin 组——四问指针 ×2 · 审批门 ×3 · 写作权 ×3 · 呈交声明 ×3 · `cdd-dev` 日志指路 ×1；另一条零复述 pin：六份 SKILL.md 对 `declared acceptance gate` / `a legal input escapes` / `set aside` 零命中。
- `packages/kairos/skills/{cdd-spec-writer,cdd-plan,cdd-dev}/SKILL.md`：审批门句各一行，并**在审批门句内写明呈交作者的那一行由编排器在本会话写成**（spec §7.3 末条——self-review 的行即 self-describing：`this document was written by the orchestrator in this session`，不另起一节、不靠句外指针）。
- `packages/kairos/skills/cdd-dev/SKILL.md`：新增**日志指路一句**——三个派发动词的 child 输出落在 `.kairos/cdd/<slug>/logs/<stem>.log`，失败时 stderr 的 `CDD_BLOCKED` 行点名该路径（消费面据此读取 child 输出）。

#### Steps
- [ ] **Step 1: 写失败用例** —— (a) 轮内改 Task id 集或某任务 `DependsOn` 集 ⇒ 该轮 hard（exit 非零 + `targetAction: false`）；未改 ⇒ 无 hard 条目；(b) 快照不落 `progress.json` / 不进载体（结构 pin）；(c) 五类 grep pin 各命中：指针句 ×2（cdd-spec-writer · cdd-plan）· 审批门句 ×3（cdd-spec-writer · cdd-plan · cdd-dev）· 写作权句 ×3 · 呈交声明 ×3（每条审批门句内的「written by the orchestrator in this session」子句）· `cdd-dev` 日志指路句 ×1（缺一即红）；(d) `packages/kairos/tests/skill-anatomy.test.ts` 里四问登记项的结构 pin 转绿，节点/边数与 crossings 不变（回归 pin）；(e) 六份 SKILL.md 的零复述 pin（片段锚句零命中）。 — checkable: 五组用例先红（结构面变更 / 快照不进持久化 / 五类 grep / anatomy 计数不变与登记项结构 / 零复述）
- [ ] **Step 2: 实现** —— 快照与比对、capability 行、四问登记项；三份 SKILL.md 各增义务句（每条审批门句内含呈交声明子句，`cdd-dev` 另增日志指路句），不改节点、不改边。 — checkable: 轮内改 Task id 集判 hard 且 exit 非零，且五类 grep pin 全绿
- [ ] **Step 3: 跑绿 + 提交** —— `pnpm -C packages/cdd-engine test && pnpm -C packages/kairos test` → PASS；`git commit -m "feat(kairos,cdd-engine): hold self-review, approval and plan-shape to one obligation each"`。 — checkable: `pnpm -C packages/cdd-engine test && pnpm -C packages/kairos test` exit 0

#### Acceptance
轮内结构面变更判 hard（红 pin）；快照不进持久化面；digraph 零变更（登记项结构 pin 在 kairos 套件）；五类 skill 面 grep pin（指针 ×2 · 审批门 ×3 · 写作权 ×3 · 呈交声明 ×3 · `cdd-dev` 日志指路 ×1）与零复述 pin 各一条；`plan-structure-frozen` 不登记规则行（零 `skipped (no structure snapshot)` 字面）。

#### DependsOn
7

### Task 13: 文档 · changeset · 全量验证

#### Objective
把面变化写进消费者看得见的地方（README 双语 · `--help` 面），落 changeset，跑全量验证。

#### Files
- Modify: `packages/cdd-engine/README.md` + `package.json` 的 `oscaner` 面（如涉及）· `README.zh-CN.md` 对应行 · `packages/cdd-engine/src-next/face/declare.ts`（`implement` 的帮助行：`description` 与同处 options 描述）· `.changeset/p22-terminal-verdict-and-liveness.md`（新）· `.changeset/p22-kairos-obligations.md`（新）
- Test: `packages/cdd-engine/src-next/face/__tests__/cli.test.ts`（`--help` 面 pin）

#### Consumes
Task 1–12 的全部产物。

#### Produces
- `.changeset/p22-terminal-verdict-and-liveness.md`：`cdd-engine` **minor**（逐轮记录 · 终态裁决 · 日志 · 活性 · Next 收敛 · 波内上限）。
- `.changeset/p22-kairos-obligations.md`：`kairos` **patch**（四问指针 · 审批门 · 写作权）。
- README 与 `--help` 面同步（波内上限 · 日志路径 · 软上限以 `REVIEW_CYCLE_CAP` 常量引用呈现——正文不抄数字）。

#### Steps
- [ ] **Step 1: 写文档与 changeset** —— README（EN + zh-CN 的对应行）写清：每轮日志路径 · `wave-too-wide` / `too-many-tasks` 两条拒绝与其修法 · `dispositions` 槽 · 软上限引用 `REVIEW_CYCLE_CAP`（不写死数字）。两份 changeset 落地。 — checkable: README 双语与两份 changeset 均含对应改动行
- [ ] **Step 2: 补帮助面 pin** —— `cli.test.ts` 增断言：`--help` 不引入 `--verbose`；`implement --help` 提及每波至多 3 个任务（帮助文本的落点是 `face/declare.ts` 的 `implement` `description` 与同处 options 描述行——只改 README 不会让这条 pin 转绿）。 — checkable: 两条帮助面 pin 转绿（无 `--verbose` · `implement --help` 点名每波 ≤3）
- [ ] **Step 3: 跑全量** —— `env -u AI_AGENT pnpm run validate` → 期望 ALL PASS（emit fresh · root 套件 · kairos 套件 · cdd-engine 套件 · typecheck ×3 · version-sync · 零裸函数）。 — checkable: `env -u AI_AGENT pnpm run validate` exit 0
- [ ] **Step 4: 提交** —— `git add -A && git commit -m "docs(cdd-engine): record the P22 surface in the consumer docs"`。 — checkable: 该步的断言转绿

#### Acceptance
`env -u AI_AGENT pnpm run validate` exit 0；两份 changeset 存在且 bump 级正确；README 双语与 `--help` 面同步；`--verbose` 零引入。

#### DependsOn
10, 11, 12

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.5 | 2026-11-03 | **plan-review-4 findings 全量落册**：① `CompletionContext` 的 `records` / `reviewsPath` 供值 pin 移到 Task 7 Step 1(f)（`#verdictOf` + `#reviews ?? handoffPath("review", …)` 同住 lifecycle），Task 4 只留 ctx 纯形状（W2 不引 face 依赖）；② `NextHop` / `NextHopInput` 增 `target: RouteTarget | null`（capsule 供帧 target · board 供遍历选中面 target · CLI 供自己的），`docClassOf` 与 `RouteRenderer` 同读这一格；Task 10 行④ / 行⑤ 分清 `overall`（`to = PIPELINE_NEXT["overall"]`）与 `single-spec`（`terminal` · `to: null`）；③ `hopOf(route, face)` 收 face 并补 `review` @ branch 面 ⇒ `branch-review` 的 pin；④ Task 10 删除面收窄到自指 hop 推演：`lineGate`（`phase` / `verdict` / `reviewed`）与 `#linePhase` / `#lineKey` 保留，`walk` 四形落点在 board 构造方（`cli.ts`）+ 四形逐字回归 pin；⑤ 活性信号改按轮工厂（`LIVENESS_SIGNALS(context)` + `LivenessContext{logPath, pgid}`），补「状态不跨轮」pin；⑥ Task 8 Step 1(a) fixture 写实：`1`/`2`/`3` 无依赖、`4`/`5` 只依赖 `1` ⇒ `batches() = [{1,2,3},{4,5}]`（规则绿）而 frontier `{2,3,4,5}` 宽 4 ⇒ `wave-too-wide`（规则必要不充分之例）；⑦ 旧形折算补 `attempt: 1`，`rounds` 读期类型括上 `Record<string, number[] | number>`；⑧ nit：`FIX_DISPOSITIONS_ZERO_COMMIT` 改标**新写字面** + 补零提交 soft pin；删面 pin 改用精确名 + `lineGate` / `#linePhase` / `#lineKey` 保留断言；Task 12 审批门句内含「由编排器在本会话写成」呈交声明 ×3 与其 grep pin；Task 13 删掉软上限数字，只引用 `REVIEW_CYCLE_CAP` | Oscaner M. · Claude（kairos:cdd-plan [P22] docs-fix · 2026-11-03) |
| v0.4 | 2026-11-03 | **plan-review-3 findings 全量落册**：① blocker：`board` / `preview` 的记录读面连同 `board-view.test.ts` 旧形 fixture 迁进 Task 3（新增 `RoundRecords` 单一归一缝 + 「写一条记录 → board 显示它」往返 pin + `would record` 身份 pin），Task 11 只留排版重设；② `SignalReading` 增 `readableAt`（最近可读 tick），`LivenessJudge#verdict` 收 `LivenessInput`（含 `now`）——`unknown` 改为「整窗无腿可读」，补「先可读后不可读 + 静默满 30min ⇒ `stalled`」pin（七条真值表）；③ Task 5 Files 收 `cli.test.ts` 的两处 `lastSample` fixture，checkable 增 `tsc --noEmit` 绿；④ `CompletionContext` 增 `records` / `reviewsPath` 两格并点名供值方（`#verdictOf` + `CliLifecycle#reviews`），Task 4/6 各补一条 pin（含「本轮载体在而请求方缺失 ⇒ hard」）；⑤ Task 6 补 spec §3.4 的 `fixed N · rejected M` 汇总行（`FIX_DISPOSITIONS_SUMMARY` + `summaryOf`，capsule 之后一行 stdout，不落盘 / 不进 capsule，字节 pin）；⑥ Task 10 把「不印 `next:` 行」的条件从 `hop === null` 改为 `NextHop` **缺席**，并写出逐行字节冻结表（`done` / `soft-cap` / doc-class `terminal` / `blocked`）；⑦ doc-class 判别改为 `NextHopInput.docClassOf` 注入，`next.ts` 不 import `BoardView`（免运行时环）；⑧ 波宽规则改读注入的 `ContractInput.taskLayers`（`preflight` graph 门供值），`contract/` 零 `../session` 导入，`TaskGraph#batches()` 单一权威 pin；⑨ nit：`reviewGuideOf(type: TargetType)` + `REVIEW_VARIANT_TEXT`（无 `ReviewVariant` 新名）、删 `ReviewedRevisionWriter` 改为点名 `session/run.ts:495-512` 的三个既有回写换谓词、补被 kill 轮的日志指路 pin | Oscaner M. · Claude（kairos:cdd-plan [P22] docs-fix · 2026-11-03） |
| v0.3 | 2026-11-03 | **plan-review-2 findings 全量落册**：① 孪生 pin 按 spec v0.6 收窄——第三条陈述与周期数只住两份 `next-loop`，两份 `architecture` 只钉前两条，pin 断言四份**合起来**覆盖三条（`architecture` 不入 Task 9 Files）；② 旧 `progress.json` 的 cycle 号折成**完成记录**（`targetAction: true` · `dispatchBase: null` · `violations: []` · `carrierPath: null`），补「存量闭合线仍判闭合」与「`recordedTasksOf` 非空」两条 pin；③ `NextHop.face` / `route` 与 `NextHopInput.route` 改为可空（失败面与 doc-class `terminal`），capsule 参数 `NextHop \| null`、失败轮零 `next:` 行；④ `reason` 七值补产出者（`taskOpen` · `closedLine` · `terminal → faceClosed`）与三条报文形 pin；⑤ `WaveWidthInvariant` 落到 `contract/invariants.ts` 并点名用例宿主；⑥ Task 13 Files 增 `face/declare.ts` 并写明帮助行落点；⑦ `FixDispositions` 定请求方载体取值缝（同 key 同 cycle 的 review 记录，回退 `--reviews`）；⑧ Task 8 补历史超 3 波行读面 pin、Task 7 补 `implement` 载体缺失 soft pin、Task 10 补 `Run#peekNext` 跨面 pin；⑨ nit：插槽 token 改 `{artifact}` / `{audience}`、Task 3 Step 3 符号改为实存的 `Ledger#waveLinePhase` / `#rowClosed` / `#roundRoute` | Oscaner M. · Claude（kairos:cdd-plan [P22] docs-fix · 2026-11-03） |
| v0.2 | 2026-11-03 | **plan-review-1 findings 全量落册**：① `FIX_READBACK_SUFFIX` 三处同批（常量字面 + jsdoc + 运行时/编译期两条 pin）收进 Task 1 的 Step 4；② 仓库级孪生 pin 落 `scripts/__tests__/next-loop-twin.test.ts`，作 Task 9 独立一步；③ Task 2 删不存在的 `workspace/.gitignore` 落点，`logs/` 由 `RoundLog.create` 自建并补首轮落盘 checkable；④ Task 4 注册表改 `Partial<Record<…>>`（只钉「已注册 ⊆ verb 集 + 未知 verb 抛错」），完整性 pin 移到 Task 6；⑤ Task 6 补齐六类 hard 每条一 pin（含 work 载体缺失·槽缺失），Acceptance 改为「六 hard + 两 soft」；⑥ Task 9 补 fix 轮两行（含 blocker ⇒ `review` · 无 blocker ⇒ 闭合），Task 10 补 drift 不得抢 blocker；⑦ Task 12 补 `cdd-dev` 日志指路句与四类 grep pin + 零复述 pin，删不存在的引擎侧 anatomy 测试，宿主改指 kairos 套件；⑧ Task 3 旧形 pin 改为真实两形（数组值 · 纯数字）；⑨ attempt 身份收进命名单源（`#attemptOf` + `logName(…, attempt)` 签名），Task 3 点名派发侧调用点；⑩ 三处假 pin 收窄（`ps` OS 调用面 · 删面入口正则 · 尝试不存在的 `.gitignore`）；⑪ Task 8 报文断言改锚到成员 id 形 + 补跨面正向 pin；Task 11 补零写 pin；⑫ nit：Task 1 片段切分断言改为 `reviewGuideOf(k)` 构建串、`templates.test.ts` 标 `Create` 并补 `render.test.ts` 为 Modify、Task 5 合并重复 checkable、`NextHop.face`/`route` 与 `NextHopInput.route` 恒非空 | Oscaner M. · Claude（kairos:cdd-plan [P22] docs-fix · 2026-11-03） |
| v0.1 | 2026-11-03 | 首版：13 个任务，依赖派生 7 层（W1 = {1,2,3} · W2 = {4,5,8} · W3 = {6} · W4 = {7} · W5 = {9,12} · W6 = {10,11} · W7 = {13}），每层宽 ≤3 与 P22 自身的波内上限一致（`TaskGraph#batches()` 实算 max width = 3）；Review Focus 五条覆盖重派身份 / 日志不可写 / CPU 腿不可读 / 旧 progress.json / append 宽波 | Oscaner M. · Claude（kairos:cdd-plan · 2026-11-03） |
