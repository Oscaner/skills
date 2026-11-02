---
title: 引擎文档工具（Engine Doc-Tooling）— P22 计划：定级口径 · 派发终态契约 · 活性信号 · Next 收敛
doc-type: plan
version: v0.2
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
- `export const SEVERITY_RUBRIC_SLOTS: { subject: string; audience: string }` —— 两个插槽的占位名（`{subject}` / `{audience}`）。
- `export const reviewGuideOf: (variant: ReviewVariant) => string` —— 用该变体的 `subject` / `audience` 填插槽后返回完整判据体；`REVIEWS.{wave,branch,spec,plan}.axesGuide` 保留为已拼好的字符串（值 = 各自轴句 + `reviewGuideOf(variant)`）。
- `FIX_READBACK_SUFFIX` 改为 `(confirm the reviews handoff · if a finding needs a ruling, record the ruling in the handoff file)`（同批：常量 jsdoc 的口径句与其字面回显一并改指 reviews handoff）。

#### Steps
- [ ] **Step 1: 写失败用例** —— 断言四件事（`render/__tests__/templates.test.ts`）：(a) `SEVERITY_RUBRIC` 含 `blocker` 四问的四个锚句（`declared acceptance gate` · `a legal input escapes` · `can never go red` · `security or privacy`）与 warn / nit 两档锚句；(b) 片段含 vision 句与 `set aside` 清单句，且带 `{subject}` / `{audience}` 占位；(c) 四份 `axesGuide` 各自**只**出现一次片段正文，断言面直接写死为 `REVIEWS[k].axesGuide.split(reviewGuideOf(k)).length === 2`（k ∈ wave / branch / spec / plan；片段带占位，故按已填的构建串切分）；(d) 模块源码里 `The reviewed` 只出现一次（`readFileSync` 上 `templates.ts` 计入断言，钉「副本零残留」）。运行：`pnpm -C packages/cdd-engine exec vitest run src-next/render/__tests__/templates.test.ts` → 期望 FAIL。 — checkable: 四条断言先红（片段缺位 / 副本仍在）
- [ ] **Step 2: 抽片段并接线** —— 在 `templates.ts` 定义 `SEVERITY_RUBRIC`（插槽以 `{subject}` / `{audience}` 字面出现）、`ReviewVariant` 的 `subject` / `audience` 两格（wave/branch：`artifact` / `user`；spec：`spec` / `downstream author`；plan：`spec` / `implementer`）、`reviewGuideOf`；四份 `axesGuide` 改为「本变体独有轴句 + `reviewGuideOf(...)`」。branch 变体独有的 "Three things a green run cannot show you…" 保留在变体侧（它只出现一次，不是重复）。同档一致性句放在「先承认做对了什么」**之前**。 — checkable: `templates.ts` 源码里 `The reviewed` 只出现一次
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
- Modify: `packages/cdd-engine/src-next/session/ledger.ts` · `packages/cdd-engine/src-next/session/run.ts` · `packages/cdd-engine/src-next/session/preflight.ts`（`recordedTasksOf` 改读完成集）
- Test: `packages/cdd-engine/src-next/session/__tests__/ledger.test.ts` · `packages/cdd-engine/src-next/session/__tests__/run.test.ts`

#### Consumes
`ProgressRow` / `readProgress` / `recordRound` · `OpenFrame`（`dispatchBase` 已由 `CliLifecycle#dispatchBase` 捕获）· `ClosedWaves` 派生。

#### Produces
- `export interface RoundVerdict { readonly treeClean: boolean; readonly targetAction: boolean }`
- `export interface RoundRecord { readonly op: OpType; readonly cycle: number; readonly attempt: number; readonly dispatchBase: string | null; readonly verdict: RoundVerdict; readonly violations: readonly RoundViolation[]; readonly carrierPath: string | null }`
- `export type RoundViolation = { readonly grade: "hard" | "soft"; readonly cause: string; readonly message: string }`
- `ProgressRow.rounds?: RoundRecord[]`（读期兼容旧两形：mode 键的 `number[]` 对象 · 纯数字）
- `Ledger#recordRound(record: RoundRecord): void`（唯一写面）· `Ledger#completedCycles(key: LedgerKey, op: OpType): readonly number[]` · `Ledger#recordsOf(key: LedgerKey): readonly RoundRecord[]`

#### Steps
- [ ] **Step 1: 写失败用例** —— `ledger.test.ts`：(a) 写一条 `targetAction: true` 与一条 `false` 的记录 → `completedCycles` 只含前者、`roundCount`（派发编号）含两者；(b) 旧两形各一条：`{ rounds: { review: [1,2] } }`（数组形）与 `{ rounds: { review: 1, fix: 1 } }`（纯数字周期数，`#cyclesOf` 今日已归一）→ 读入后 `recordsOf` 降级为 `[]` 且 `roundCount` 与今日一致（兼容且不崩）；(c) 记录带 `carrierPath` 时 `recordsOf` 原样返回。`run.test.ts`：一个 BLOCKED 的 implement 轮**写入**一条记录（`verdict.targetAction === false`），且下一次派发算出同 cycle 的 `attempt + 1`。 — checkable: 四条账本用例（含两形旧 progress.json）+ 一条 BLOCKED 入账用例先红
- [ ] **Step 2: 改账本** —— `rounds` 类型换 `RoundRecord[]`；`recordRound` 收整条记录；读期归一方法 `#recordsOfRow(row)` 把旧两形折成 `[]`（不写回、不迁移），数组槽需区分记录对象与纯数字两种元素；新增 `completedCycles`（只取 `verdict.targetAction === true`）。 — checkable: 旧两形读入后 `roundCount` 与今日一致
- [ ] **Step 3: 改读面（四类）** —— 完成问句（`#pendingFix` · `#rowClosed` · `waveRoute`/`targetRoute` 的 implement/fix 成员读 · `orphanHandoffs` · `preflight#recordedTasksOf`）改读 `completedCycles`；派发编号（`roundCount` / `#reviewCount` / `#roundFor` 的 review 腿）读全部在册 cycle；活跃跳承载轮读**最新完成轮**；显示读面（board / preview）按 §5.3 的 Task 11 落地。`run.ts`：`#bookkeep` 去掉 `blocked` 分叉，已派发轮一律 `recordRound`（载体不覆盖规则保留）；**派发侧点名 attempt 调用点**——`Run` 一次分配：`const attempt = naming.attemptOf(records, op, cycle)`，同一个值同时写进 `RoundRecord` 与 `naming.logName(op, type, params, attempt)`（Task 2 的签名），不重复推算。 — checkable: 硬失败 fix-K 后 `#pendingFix` 为 false 且重派算出 attempt+1
- [ ] **Step 4: 跑绿 + 提交** —— `pnpm -C packages/cdd-engine test` → PASS（既有 rounds 形状断言改锚到记录面，断言不删）；`git commit -m "feat(cdd-engine): record every dispatched round as a first-class fact"`。 — checkable: `pnpm -C packages/cdd-engine test` exit 0

#### Acceptance
BLOCKED/TIMEOUT 轮写入记录（`targetAction: false`）；`completedCycles` 只认 `targetAction === true`；硬失败的 `fix-K` 不被读成已做、重派落在同一 cycle（不产 `fix-(K+1)`）；旧 `progress.json` 两形（数组值 / 纯数字周期数）读得动且不误判；`carrierPath` 随记录落盘；attempt 由命名单源一次分配、记录与日志名共读同一值。

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
- `export interface CompletionContext { readonly record: RoundRecord; readonly row: ProgressRow; readonly carrier: unknown; readonly git: GitClient; readonly repoRoot: string }`
- `export interface CompletionVerdict { readonly fulfilled: boolean; readonly violation: RoundViolation | null }`
- `export class CommitsSinceGroupBase implements CompletionCriterion`（组基线 = 该组**最早一条记录的 `dispatchBase`**）
- `export class JudgeCarrier implements CompletionCriterion`（载体缺失或 `findings` 非数组 → hard；`findings: []` 合法）
- `export const COMPLETION_CRITERIA: Readonly<Partial<Record<OpType, CompletionCriterion>>>`（本任务只注册 `implement` · `review`（branch review 折算 `review`）；`fix` 的注册在 Task 6）
- `export class CompletionCriteria { static of(op: OpType): CompletionCriterion }` —— 未注册 verb 在构造期抛错（本任务唯一的完整性断言面是「已注册键 ⊆ verb 集」）

#### Steps
- [ ] **Step 1: 写失败用例** —— (a) `implement`：组基线 = 最早 `dispatchBase`、`commitsSince` 空 ⇒ `fulfilled: false` 且 `violation.grade === "hard"`；非空 ⇒ true（含「attempt 1 已提交、attempt 2 零新提交」仍判完成）。(b) `review`：`{"findings": []}` ⇒ true；`{}` / `findings: "x"` ⇒ false + hard。(c) `COMPLETION_CRITERIA` 的**已注册**键集 ⊆ `OpType` 的 verb 集，且 `CompletionCriteria.of` 对未注册 verb（本任务下是 `fix`）构造期抛错。 — checkable: 三组用例先红（零提交 / 空 findings / 已注册键集 ⊆ verb 集与未知 verb 抛错）
- [ ] **Step 2: 实现契约与两个判据** —— 组基线由记录派生（找该组 `dispatchBase` 非 null 的最早一条）；`JudgeCarrier` 直接读载体 JSON 的 `findings` 形状。 — checkable: 组基线取最早 `dispatchBase`（attempt 2 零提交仍判完成）
- [ ] **Step 3: 跑绿 + 提交** —— vitest PASS；`git commit -m "feat(cdd-engine): judge round completion by one registry keyed on the verb"`。 — checkable: `vitest run src-next/contract` exit 0

#### Acceptance
`implement` 判据按**组**基线（同组内重派不误判为空转型）；`review` 的空 `findings` 是批准而非违约；已注册键 ⊆ verb 集且未知 verb 在构造期即失败（本任务的注册表 pin）；「键集 == verb 集」的完整性 pin 在 `fix` 注册后由 Task 6 收口。

#### DependsOn
3

### Task 5: 活性两腿换血（撤 workspace-mtime 腿）

#### Objective
活性信号改为**两条都由 child 自身产出**的腿——日志增长 + 组 CPU 前进（附加腿）；撤掉 workspace-mtime 腿与随之无消费者的排除面。

#### Files
- Create: `packages/cdd-engine/src-next/contract/liveness-signal.ts`
- Modify: `packages/cdd-engine/src-next/face/termination.ts` · `packages/cdd-engine/src-next/session/ledger.ts`（`Sample.newestMtimeMs` 退场）· `packages/cdd-engine/src-next/face/lifecycle.ts`（把日志路径喂给采样器）
- Test: `packages/cdd-engine/src-next/contract/__tests__/liveness-signal.test.ts` · `packages/cdd-engine/src-next/face/__tests__/termination.test.ts`

#### Consumes
`ProcessFacts.groupCpuMs`（`infra/proc.ts`，不动）· `RoundLog.sizeOf` / `mtimeOf`（Task 2）。

#### Produces
- `export interface LivenessSignal { sample(): SignalReading }`，`SignalReading = { readonly value: number | null }`
- `export class LogGrowth implements LivenessSignal` · `export class CpuAdvance implements LivenessSignal`
- `export const LIVENESS_SIGNALS: readonly LivenessSignal[]`（`CpuAdvance` 为附加腿）
- `export class LivenessJudge { verdict(readings: readonly SignalReading[], previous: readonly (number|null)[], idleMs: number, windowMs: number): StallVerdict }` —— 实现 spec §4.2 的四态真值表。
- `Sample.newestMtimeMs` 与 `Sampler` 的树扫描（`#newestMtimeMs` · `MAX_DEPTH` · `VCS_DIR` · `excludesFor`）删除。
- `CrashRecord` 增 `logPath: string | null` 与末次采样 `lastSample: { verdict: StallVerdict; logSize: number | null; cpuMs: number | null; at: number }`（spec §4.4：半死轮次的事后诊断面）。

#### Steps
- [ ] **Step 1: 写真值表用例** —— 六条：(a) 日志增长 + CPU 静默 ⇒ `progress`；(b) CPU 前进 + 日志静默 ⇒ `progress`；(c) 两腿静默、均**可读**、未满 30min ⇒ `idled`；(d) 同上但满 30min ⇒ `stalled`；(e) CPU 不可读（`null`）且日志静默满 30min ⇒ `stalled`（现行为是 `unknown`）；(f) 两腿都不可读 ⇒ `unknown`（不杀）。 — checkable: 六条真值表用例先红
- [ ] **Step 2: 实现契约与判官** —— OR 聚合；`unknown` 只在整窗无一条腿可读时成立；阈值仍从 `TerminationPolicy` 读（60s / 30min）。 — checkable: `LivenessJudge` 六条转绿
- [ ] **Step 3: 撤 mtime 腿** —— 删 `Sample.newestMtimeMs` / 树扫描 / 排除面；`termination.test.ts` 里依赖树腿的用例改钉日志腿（断言不删）；补一条回归：**仓库他处写入 + child 零输出零 CPU 30min ⇒ `stalled`**（今日会被判 `progress`）。 — checkable: 回归 pin「仓库他处写入 + 零 CPU 30min ⇒ stalled」先红后绿
- [ ] **Step 4: 落地尸检面** —— `CrashRecord` 写 `logPath` 与 `lastSample`；用例断言被杀的轮其 crash 记录两格非空且 `logPath` 指向本轮日志。 — checkable: 被杀轮的 crash 记录含 `logPath` 与末样本，且 `logPath` 指到的文件存在
- [ ] **Step 5: 跑绿 + 提交** —— `pnpm -C packages/cdd-engine test` → PASS；边界 pin 收窄到 OS 调用面（`ps` 开阔 grep 今日 306 行命中，不是可成立的 pin）；`git commit -m "feat(cdd-engine): judge liveness by the child's own evidence"` — checkable: `grep -rnE 'execFileSync\("ps"|execFile\("ps"|"ps",' packages/cdd-engine/src-next --include=*.ts` 在 `infra/proc.ts` 与 `infra/__tests__/proc.test.ts` 之外零命中，且 `pnpm -C packages/cdd-engine test` exit 0

#### Acceptance
四态真值表逐行有用例；`unknown` 仅在整窗无腿可读时成立；仓库他处写入不再能自证 progress（红 pin）；`ps` 仍只在 `infra/proc.ts` 的 OS 调用面（其自身测试独立读数）；阈值与四态词零变化。

#### DependsOn
2

### Task 6: `fix` 的逐条处置（载体槽 + 简化版判据）

#### Objective
work 载体新增 `dispositions` 槽，`fix` 的完成判据 = 逐条处置覆盖请求方 review 载体的每条 finding（summary 原文精确匹配），六类（含缺理由）判 hard。

#### Files
- Modify: `packages/cdd-engine/src-next/session/handoff-schema.ts`（`CARRIER` + `PLANE_SLOTS.work`）· `packages/cdd-engine/src-next/contract/completion-criterion.ts`（注册 `fix`）
- Test: `packages/cdd-engine/src-next/session/__tests__/handoff-schema.test.ts` · `packages/cdd-engine/src-next/contract/__tests__/completion-criterion.test.ts`

#### Consumes
`CARRIER` / `PLANE_SLOTS` / `PLANE_REQUIRED`（`PLANE_REQUIRED` **不动**）· `CompletionCriterion`（Task 4）· 请求方载体的 `carrierPath`（Task 3）。

#### Produces
- `CARRIER.properties.dispositions = { type: "object" }`（值形 `{ [summary]: { status: "fixed" | "rejected", reason?: string } }`）
- `export class FixDispositions implements CompletionCriterion` + `COMPLETION_CRITERIA.fix`
- `COMPLETION_CRITERIA` 的完整性 pin 落于本任务：注册后已注册键集 == `OpType` 的 verb 集（Task 4 只钉「已注册键 ⊆ verb 集 + 未知 verb 构造期抛错」）
- `export const FIX_DISPOSITIONS_ZERO_COMMIT`（零提交 soft 观测的文案，沿用既有零提交告警文案）

#### Steps
- [ ] **Step 1: 写失败用例** —— 六类 hard 各一条：(①) 该轮 work 载体缺失 ⇒ hard 并点名载体路径；(②) 载体在而 `dispositions` 槽缺失 ⇒ hard；(③) 键集与输入集不等（缺条 / 多条各一条）⇒ hard；(④) 键不属输入集 ⇒ hard 并点名未知条；(⑤) 请求方载体缺失或不可读 ⇒ hard 并点名路径；(⑥) `rejected` 缺 `reason` ⇒ hard。另三组：(a) 键集与输入集相等 ⇒ 完成；(b) 输入 `findings: []` ⇒ 要求键集为空 + 一条 soft 观测；(c) 旧记录（无 `carrierPath`）⇒ 判据跳过并落可见观测（不判 hard、不读成空集）；(d) 注册后 `COMPLETION_CRITERIA` 键集 == verb 集（完整性 pin）。 — checkable: 六类 hard 各一条 + 三组判定/兼容 + 一条完整性 pin 先红
- [ ] **Step 2: 实现** —— `dispositions` 入 `CARRIER` 与 `PLANE_SLOTS.work`；`FixDispositions` 按 `record.carrierPath` 现读请求方载体组装输入集（去重后比较）；六类 hard + 两类 soft 观测；`fix` 注册后完成键集 == verb 集。 — checkable: `PLANE_REQUIRED.work` 仍为 `status`+`artifacts`（结构 pin）且 `COMPLETION_CRITERIA` 的键集 == verb 集
- [ ] **Step 3: 跑绿 + 提交** —— `pnpm -C packages/cdd-engine test` → PASS；`git commit -m "feat(cdd-engine): judge a fix round by its dispositions"`。 — checkable: `pnpm -C packages/cdd-engine test` exit 0

#### Acceptance
六类 hard（work 载体缺失 · `dispositions` 槽缺失 · 键集不等 · 未知条 · 请求方载体不可读 · `rejected` 缺理由）各一条用例 + 两条 soft 观测（空输入观测 · 零提交观测）；`PLANE_REQUIRED` 零变化（`implement` 不被要求交处置）；旧记录跳过且可见；注册后 `COMPLETION_CRITERIA` 键集 == verb 集。

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
- `CliLifecycle#verdictOf(frame, outcome): { verdict: RoundVerdict; violations: readonly RoundViolation[] }`
- `Ledger#counterOf` 的派生面：`softViolationsOf(key)`（各轮 soft 条目数 + `treeClean === false` 派生一条），`contractViolationCount` 持久化标量退役（旧值只读忽略）。
- 证据门改为 hard 条目（`{line}-test-evidence.json` 缺失/malformed/违约 ⇒ `grade: "hard"`）。
- `ReviewedRevisionWriter`：三个回写（doc · wave-brief · branch）只在 `verdict.targetAction === true` 时执行。

#### Steps
- [ ] **Step 1: 写失败用例** —— (a) `implement` 零提交 ⇒ exit 非零 + 记录 `targetAction: false` + 该轮**在册**（`board` 可见）；(b) 证据缺失 ⇒ hard（exit 非零），软违约（脏树）⇒ exit 0 且计数 +1；(c) 载体缺失的 `review` ⇒ hard，且 `reviewedRevision` **未**绑定（随后改文档 ⇒ `next:` 回到 `review`）；(d) stderr 的 `CDD_BLOCKED` 行含该轮日志路径。 — checkable: 四条裁决用例先红
- [ ] **Step 2: 实现裁决与分级** —— 裁决先写、违约族分流；`#verdictOf` 自书 hard 条目（复用 `contract-violation` 因由，零新枚举）；`#blocked` 分支的写点全退（Task 3 已改）；三个回写加门。 — checkable: hard 轮 exit 非零且在 `board` 可见
- [ ] **Step 3: 派生计数收口** —— `counterOf` 对 `contractViolationCount` 返回派生值；旧 `progress.json` 标量忽略；`PROGRESS_COUNTER_ZERO` 只留仍被写入的键。 — checkable: `counterOf("contractViolationCount")` 返派生值且旧标量被忽略
- [ ] **Step 4: 跑绿 + 提交** —— `pnpm -C packages/cdd-engine test` → PASS（覆盖面变化的断言逐条翻转并注明，断言不删）；`git commit -m "feat(cdd-engine): let the terminal verdict decide a round, not its exit code"`。 — checkable: `pnpm -C packages/cdd-engine test` exit 0

#### Acceptance
hard 轮的 exit / 记录 / 在册三面一致；soft 轮不改 exit 码；派生计数只数 soft 且单一出口；证据门归 hard；`reviewedRevision` 以裁决为门（红 pin）。 **派发前的 `tree-clean` 门行为与字节面零变化**（既有脏树拒绝用例全绿，本相位只裁派发之后的终态裁决）。

#### DependsOn
3, 4, 6

### Task 8: 波内上限 3（硬门 + 计划面规则）

#### Objective
`MAX_TASKS_PER_WAVE = 3`：计划面规则判「任一依赖层 ≤3」，派发面硬门拒「frontier 超 3」与「`--tasks` 超 3」，且病因点名 `DependsOn` 修法；引擎不切块。

#### Files
- Modify: `packages/cdd-engine/src-next/session/next.ts`（常量）· `packages/cdd-engine/src-next/session/wave.ts`（两条拒绝 + 次序）· `packages/cdd-engine/src-next/contract/rules.ts`（`wave-width-at-most-three`）· `packages/cdd-engine/src-next/face/words.ts`（两条报文）
- Test: `packages/cdd-engine/src-next/session/__tests__/wave.test.ts` · `packages/cdd-engine/src-next/contract/__tests__/rules.test.ts`

#### Consumes
`TaskGraph#batches()` / `frontier`（不动）· `WaveGate.vet` 现有门序（`mixed-batch` → `exact` → `wrong-phase`）。

#### Produces
- `export const MAX_TASKS_PER_WAVE = 3`（`session/next.ts`，与 `REVIEW_CYCLE_CAP` 同款代码常量）
- `WaveGateReason` 增 `"wave-too-wide" | "too-many-tasks"`；`WaveGate.vet` 的新判据插在 **`mixed-batch` 之后、`exact` 之前**
- `RULE_REGISTRY` 增 `{ scope: "doc", id: "wave-width-at-most-three", docKeys: ["plan"], create: () => new WaveWidthInvariant() }`
- `export class WaveWidthInvariant implements Invariant`（由计划正文派生 `TaskGraph`，逐层判宽）

#### Steps
- [ ] **Step 1: 写失败用例** —— (a) frontier 超 3（层 `{1,2,3}` 与 `{4,5}`，`4`/`5` 只依赖 `1`，`done = {1}` ⇒ frontier `{2,3,4,5}`）→ `reason === "wave-too-wide"`，报文含 `2,3,4,5`（该 frontier 成员 id 的升序逗号形）与 `DependsOn` 修法句，且**不是** `split`；(b) `--tasks 1,2,3,4` → `too-many-tasks`；(c) `mixed-batch` 形状仍报 `mixed-batch`（次序 pin）；(d) 计划面：某层 5 个 ⇒ 规则红并点名该层 id；改成链式（后两个依赖第三个）⇒ 规则绿；(e) 跨面正向 pin：完整层并集全闭（层 `{1,2,3}` 全闭）时 `#close` 渲染的 `next-wave` 字面（`tasks` 升序三值）过 `WaveGate.vet` ⇒ `ok: true`。 — checkable: 五组用例先红（含「不得报成 split」与「自家 `next:` 字面被自家波门接受」）
- [ ] **Step 2: 实现三面** —— 常量落地；`WaveGate.vet` 两段判据（先 `open.length > MAX`，再 `requested.length > MAX`）插在 `mixed-batch` 之后；规则行与 `WaveWidthInvariant`；`face/words.ts` 两条报文。 — checkable: frontier `{2,3,4,5}` 报 `wave-too-wide`、`--tasks` 4 个报 `too-many-tasks`
- [ ] **Step 3: 跑绿 + 提交** —— `pnpm -C packages/cdd-engine test` → PASS；`git commit -m "feat(cdd-engine): hold a wave to three tasks with a hard gate and a plan rule"`。 — checkable: `vitest run src-next/session/__tests__/wave.test.ts` exit 0

#### Acceptance
frontier 超 3 报 `wave-too-wide`（**不得**报 `split`）且报文点名成员 id 与 `DependsOn` 修法；`--tasks` 超 3 报 `too-many-tasks`；`mixed-batch` 次序不变；计划面规则红/绿各一 pin；完整层并集上的 `next-wave` 字面必被波门接受（跨面正向 pin）；`batches()`/`frontier` 语义零变化（既有波次用例全绿）。

#### DependsOn
3

### Task 9: `NextHop` 一处派生（判据仍在计数表）

#### Objective
把「下一轮是什么」收敛成 `NextStepRouter` 上的一个方法：`NextHop {face, hop, to, reason, route}`，判据读既有计数表，`hop` 由 `route.kind` 经**一处**映射读出，`reason` 走单一文案表。

#### Files
- Modify: `packages/cdd-engine/src-next/session/next.ts`
- Create: `scripts/__tests__/next-loop-twin.test.ts`（仓库级孪生 pin）
- Test: `packages/cdd-engine/src-next/session/__tests__/next.test.ts`

#### Consumes
`NextStepRouter.next`（计数表，判定面不动）· `Route`（六 kind）· `PIPELINE_NEXT`（降为数据）· `PipelineKey`（`phase-spec` / `overall` / `plan` / `wave` / `branch`）。

#### Produces
- `export interface NextHop { readonly face: PipelineKey; readonly hop: Hop | null; readonly to: PipelineEntry | null; readonly reason: string; readonly route: Route }` —— `face` 与 `route` **恒非空**（已派发的线总有面，闭合线仍携带 `done`/`handoff`），`null` 面不在类型里。
- `export type Hop = "implement" | "review" | "branch-review" | "fix"`
- `export const NEXT_HOP_REASON = { docDrift, pendingFix, closedLine, faceClosed, softCap, taskOpen, docClassBlocked } as const`（`reason` 文案的唯一来源）
- `NextStepRouter#nextHop(input: NextHopInput): NextHop`，`NextHopInput = { face, gate: { drift: boolean; open: boolean }, latestCompleted: RoundRecord | null, route: Route, counters: { consecutiveS1: number } }`（`route` 非空——派生器总是从一次 `next` 的产物开工）
- `NextStepRouter#hopOf(route: Route): Hop | null` —— **唯一**常量映射：`next-wave → implement` · `review → review`（branch 面 → `branch-review`）· `fix → fix` · `done / soft-cap / handoff → null`
- `#nextHop` 的 `to`：`handoff` 与 `done` 同路径取 `PIPELINE_NEXT[docClass]`（doc-class 判别复用 `face/capsule.ts#docClassOf` 的同一判别源，抽到 `session/next.ts` 后 capsule 改调）

#### Steps
- [ ] **Step 1: 写失败用例** —— (a) `review` 留 blocker ⇒ `hop === "fix"` 且 `route == {kind:"fix"}`；(b) `review` 全 0 ⇒ 闭合侧，`next-wave` 时 `hop === "implement"`；(c) 闭合线 + drift ⇒ `hop === "review"`、`reason === docDrift`；(d) `done` ⇒ `hop === null` 且 `to === PIPELINE_NEXT[docClass]`；(e) `soft-cap` ⇒ `hop === null`、`reason === softCap`；(f) 决议不可得（doc-class blocked）⇒ `reason === docClassBlocked` 且报文可渲染；(g) `fix` 的请求侧 review 载体含 blocker ⇒ `hop === "review"`（fix-K → review-K 重审）；(h) `fix` 的请求侧无 blocker ⇒ 闭合 / 下一跳（`hop` 按 ready batch 取，不是 `review`）。 — checkable: 八条映射用例先红
- [ ] **Step 2: 实现 `nextHop` / `hopOf` / 文案表** —— 判据只读 `route`（来自 `next`）；`reason` 按输入事实选一句；`hopOf` 是唯一映射。 — checkable: `nextHop` 八条转绿且 `hopOf` 是唯一映射
- [ ] **Step 3: 仓库级孪生 pin** —— 新建 `scripts/__tests__/next-loop-twin.test.ts`：读四份图源（`docs/diagrams/src/next-loop.{en,zh-CN}.json` · `architecture.{en,zh-CN}.json`），断言三条陈述（blocker → 重新评审 · 仅 warn/nit → `REVIEW_FIX` 收敛 · 连续周期软上限）在四份里均成立；从两份 `next-loop` 图源抽出的「连续 N 个 blocker 周期」的 N 断言 **== `REVIEW_CYCLE_CAP`**（N 只在图源里，spec / 计划正文不抄）；源侧另 pin `#blockerCount` / `#close` / `REVIEW_CYCLE_CAP` 三个符号存在于 `session/next.ts`。 — checkable: `pnpm exec vitest run scripts/__tests__/next-loop-twin.test.ts` exit 0；图源里的 N 与常量同值（改任一侧即红）
- [ ] **Step 4: 跑绿 + 提交** —— vitest PASS；`git add packages/cdd-engine/src-next/session scripts/__tests__ && git commit -m "feat(cdd-engine): derive the next hop once, on top of the count table"`。 — checkable: `vitest run src-next/session/__tests__/next.test.ts` 与孪生 pin 均 exit 0

#### Acceptance
八条映射逐值有用例（含 fix 轮按请求载体的 blocker 数取 `review` / 闭合两行）；仓库级孪生 pin 在册（图侧周期数 == `REVIEW_CYCLE_CAP`，两侧任改即红）；`doc-drift` / `pending-fix` 有真实产出者（闭合线 + drift / 未闭合线 + 待修）；`hop: null` 的报文形可渲染；`PIPELINE_NEXT` 零判断逻辑（结构 pin）；计数表判据零改动（既有 `next` 用例全绿）。

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
- `Capsule#emit(hop: NextHop, ...)` —— `next:` 行由注入的 `NextHop.route` 渲染；`#routeText` 的 doc-class 分支退场。
- `BoardView` 构造期**接收** `NextHop`（不持账本、不自推）。
- `CliGate#lineGate` 删除，改读同一 `NextHop`；拒绝报文渲染 `reason` 与新 hop。
- 删除：`NextStepRouter.resolve` · `NextStepRouter.walk` · `CliLifecycle#targetLineOpen` 与 `Run#targetLineOpen` 的生产侧（`face/cli.ts` / `session/run.ts` 的传递面一并退）。

#### Steps
- [ ] **Step 1: 写失败用例** —— (a) capsule 的 `next:` 与 board 的 `next:` 逐字相等（同一次解析的同一对象）；(b) warn/nit-only 的 fix 之后 `next:` **不是** `review`（C5-1 投影）；(c) 闭合线改文档后 `next:` 回到 `review`；(d) CLI 拒绝报文的 hop 与 board 的 hop 相等（跨面）；(e) 删除面 pin 收窄到被删入口：`grep -rnE 'NextStepRouter\.(resolve|walk)|#lineGate|targetLineOpen' packages/cdd-engine/src-next --include=*.ts` 零命中（开阔的 `resolve(` 今日 41 处在非测试面，含 `path.resolve` / `Workspace#resolve`，不得当作 pin）；(f) 漂移不得胜出：未闭合线 + 已有 blocker + drift 同时成立 ⇒ hop 仍为 `fix`、`reason === pendingFix`。 — checkable: 六条跨面/行为用例先红（含收窄后的 grep 零命中）
- [ ] **Step 2: 改四读面** —— 全部改为接收 `NextHop`；capsule 与 board 共用 `RouteRenderer`；删除三处入口。 — checkable: capsule 与 board 的 `next:` 逐字相等
- [ ] **Step 3: 跑绿 + 提交** —— `pnpm -C packages/cdd-engine test` → PASS（capsule 字节面三键断言原样绿）；`git commit -m "refactor(cdd-engine): render the next hop from one object on every face"`。 — checkable: `grep -rnE 'NextStepRouter\.(resolve|walk)|#lineGate|targetLineOpen' packages/cdd-engine/src-next --include=*.ts` 零命中

#### Acceptance
四读面同一对象（跨面 pin）；capsule 三键与失败面字节不变；`NextStepRouter.resolve` / `NextStepRouter.walk` / `#lineGate` / `targetLineOpen` 零残留（收窄 grep pin）；warn/nit-only 收敛、漂移重开、drift 不抢 blocker 三条行为 pin 在册。

#### DependsOn
9

### Task 11: board 排版重设（按 verb 聚合 + 逐轮裁决）

#### Objective
board 默认面按 verb 聚合、只按裁决标令牌、`+N` 标 finding 数、重派带 attempt 上标、路径省略与列对齐、在飞行只留身份；区间形**永不出现**（本相位不引入 `--verbose`）。

#### Files
- Modify: `packages/cdd-engine/src-next/face/board-view.ts` · `packages/cdd-engine/src-next/face/preview.ts`（`would record` 行描述将追加的那一条）
- Test: `packages/cdd-engine/src-next/face/__tests__/board-view.test.ts`

#### Consumes
`RoundRecord` / `RoundVerdict`（Task 3 · Task 7）· `NextHop`（Task 9）。

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
- `packages/kairos/tests/self-review-obligations.test.ts`：`packages/kairos/skills/*/SKILL.md` 上的 grep pin 组——四问指针 ×2 · 审批门 ×3 · 写作权 ×3 · `cdd-dev` 日志指路 ×1；另一条零复述 pin：六份 SKILL.md 对 `declared acceptance gate` / `a legal input escapes` / `set aside` 零命中。
- `packages/kairos/skills/cdd-dev/SKILL.md`：新增**日志指路一句**——三个派发动词的 child 输出落在 `.kairos/cdd/<slug>/logs/<stem>.log`，失败时 stderr 的 `CDD_BLOCKED` 行点名该路径（消费面据此读取 child 输出）。

#### Steps
- [ ] **Step 1: 写失败用例** —— (a) 轮内改 Task id 集或某任务 `DependsOn` 集 ⇒ 该轮 hard（exit 非零 + `targetAction: false`）；未改 ⇒ 无 hard 条目；(b) 快照不落 `progress.json` / 不进载体（结构 pin）；(c) 四类 grep pin 各命中：指针句 ×2（cdd-spec-writer · cdd-plan）· 审批门句 ×3（cdd-spec-writer · cdd-plan · cdd-dev）· 写作权句 ×3 · `cdd-dev` 日志指路句 ×1（缺一即红）；(d) `packages/kairos/tests/skill-anatomy.test.ts` 里四问登记项的结构 pin 转绿，节点/边数与 crossings 不变（回归 pin）；(e) 六份 SKILL.md 的零复述 pin（片段锚句零命中）。 — checkable: 五组用例先红（结构面变更 / 快照不进持久化 / 四类 grep / anatomy 计数不变与登记项结构 / 零复述）
- [ ] **Step 2: 实现** —— 快照与比对、capability 行、四问登记项；三份 SKILL.md 各增义务句（`cdd-dev` 另增日志指路句），不改节点、不改边。 — checkable: 轮内改 Task id 集判 hard 且 exit 非零，且四类 grep pin 全绿
- [ ] **Step 3: 跑绿 + 提交** —— `pnpm -C packages/cdd-engine test && pnpm -C packages/kairos test` → PASS；`git commit -m "feat(kairos,cdd-engine): hold self-review, approval and plan-shape to one obligation each"`。 — checkable: `pnpm -C packages/cdd-engine test && pnpm -C packages/kairos test` exit 0

#### Acceptance
轮内结构面变更判 hard（红 pin）；快照不进持久化面；digraph 零变更（登记项结构 pin 在 kairos 套件）；四类 skill 面 grep pin（指针 ×2 · 审批门 ×3 · 写作权 ×3 · `cdd-dev` 日志指路 ×1）与零复述 pin 各一条；`plan-structure-frozen` 不登记规则行（零 `skipped (no structure snapshot)` 字面）。

#### DependsOn
7

### Task 13: 文档 · changeset · 全量验证

#### Objective
把面变化写进消费者看得见的地方（README 双语 · `--help` 面），落 changeset，跑全量验证。

#### Files
- Modify: `packages/cdd-engine/README.md` + `package.json` 的 `oscaner` 面（如涉及）· `README.zh-CN.md` 对应行 · `.changeset/p22-terminal-verdict-and-liveness.md`（新）· `.changeset/p22-kairos-obligations.md`（新）
- Test: `packages/cdd-engine/src-next/face/__tests__/cli.test.ts`（`--help` 面 pin）

#### Consumes
Task 1–12 的全部产物。

#### Produces
- `.changeset/p22-terminal-verdict-and-liveness.md`：`cdd-engine` **minor**（逐轮记录 · 终态裁决 · 日志 · 活性 · Next 收敛 · 波内上限）。
- `.changeset/p22-kairos-obligations.md`：`kairos` **patch**（四问指针 · 审批门 · 写作权）。
- README 与 `--help` 面同步（波内上限 · 日志路径 · 软上限 50 的表述以常量引用呈现）。

#### Steps
- [ ] **Step 1: 写文档与 changeset** —— README（EN + zh-CN 的对应行）写清：每轮日志路径 · `wave-too-wide` / `too-many-tasks` 两条拒绝与其修法 · `dispositions` 槽 · 软上限引用 `REVIEW_CYCLE_CAP`（不写死数字）。两份 changeset 落地。 — checkable: README 双语与两份 changeset 均含对应改动行
- [ ] **Step 2: 补帮助面 pin** —— `cli.test.ts` 增断言：`--help` 不引入 `--verbose`；`implement --help` 提及每波至多 3 个任务。 — checkable: `--help` 面 pin 转绿（无 `--verbose`）
- [ ] **Step 3: 跑全量** —— `env -u AI_AGENT pnpm run validate` → 期望 ALL PASS（emit fresh · root 套件 · kairos 套件 · cdd-engine 套件 · typecheck ×3 · version-sync · 零裸函数）。 — checkable: `env -u AI_AGENT pnpm run validate` exit 0
- [ ] **Step 4: 提交** —— `git add -A && git commit -m "docs(cdd-engine): record the P22 surface in the consumer docs"`。 — checkable: 该步的断言转绿

#### Acceptance
`env -u AI_AGENT pnpm run validate` exit 0；两份 changeset 存在且 bump 级正确；README 双语与 `--help` 面同步；`--verbose` 零引入。

#### DependsOn
10, 11, 12

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.2 | 2026-11-03 | **plan-review-1 findings 全量落册**：① `FIX_READBACK_SUFFIX` 三处同批（常量字面 + jsdoc + 运行时/编译期两条 pin）收进 Task 1 的 Step 4；② 仓库级孪生 pin 落 `scripts/__tests__/next-loop-twin.test.ts`，作 Task 9 独立一步；③ Task 2 删不存在的 `workspace/.gitignore` 落点，`logs/` 由 `RoundLog.create` 自建并补首轮落盘 checkable；④ Task 4 注册表改 `Partial<Record<…>>`（只钉「已注册 ⊆ verb 集 + 未知 verb 抛错」），完整性 pin 移到 Task 6；⑤ Task 6 补齐六类 hard 每条一 pin（含 work 载体缺失·槽缺失），Acceptance 改为「六 hard + 两 soft」；⑥ Task 9 补 fix 轮两行（含 blocker ⇒ `review` · 无 blocker ⇒ 闭合），Task 10 补 drift 不得抢 blocker；⑦ Task 12 补 `cdd-dev` 日志指路句与四类 grep pin + 零复述 pin，删不存在的引擎侧 anatomy 测试，宿主改指 kairos 套件；⑧ Task 3 旧形 pin 改为真实两形（数组值 · 纯数字）；⑨ attempt 身份收进命名单源（`#attemptOf` + `logName(…, attempt)` 签名），Task 3 点名派发侧调用点；⑩ 三处假 pin 收窄（`ps` OS 调用面 · 删面入口正则 · 尝试不存在的 `.gitignore`）；⑪ Task 8 报文断言改锚到成员 id 形 + 补跨面正向 pin；Task 11 补零写 pin；⑫ nit：Task 1 片段切分断言改为 `reviewGuideOf(k)` 构建串、`templates.test.ts` 标 `Create` 并补 `render.test.ts` 为 Modify、Task 5 合并重复 checkable、`NextHop.face`/`route` 与 `NextHopInput.route` 恒非空 | Oscaner M. · Claude（kairos:cdd-plan [P22] docs-fix · 2026-11-03） |
| v0.1 | 2026-11-03 | 首版：13 个任务，依赖派生 7 层（W1 = {1,2,3} · W2 = {4,5,8} · W3 = {6} · W4 = {7} · W5 = {9,12} · W6 = {10,11} · W7 = {13}），每层宽 ≤3 与 P22 自身的波内上限一致（`TaskGraph#batches()` 实算 max width = 3）；Review Focus 五条覆盖重派身份 / 日志不可写 / CPU 腿不可读 / 旧 progress.json / append 宽波 | Oscaner M. · Claude（kairos:cdd-plan · 2026-11-03） |
