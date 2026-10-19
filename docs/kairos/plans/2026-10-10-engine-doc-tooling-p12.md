---
title: 引擎文档工具（Engine Doc-Tooling）— P12 实施计划：child dispatch 终止兜底（liveness + budget）
doc-type: plan
version: v0.1
date: 2026-10-19
spec: docs/kairos/specs/2026-10-10-engine-doc-tooling-p12-design.md
parent-program: docs/kairos/specs/2026-10-10-engine-doc-tooling-overall.md
depends-on: P11（Done · v0.7 · hard——P11 全链闭合后 child dispatch 终止兜底 · overall 依赖图 D52）
base: develop
---

## Constraints

- **破坏性变更许可**：`DispatchStep` 异步化是一次 deliberate pin break（P8 §14.3 / D36 同步契约 · 授权来自前提 ①）——不保留旧同步签名，不做双面兼容。
- **零裸函数**：新增物全为类（`Terminator` / `StallJudge` / `TerminationPolicy`）与其类型；模块级导出仅类型 / 数据 / 类（`check:no-bare-functions` 门）。
- **不造轮子（前提 ⑦）**：进程组建 · 组杀 · SIGTERM→SIGKILL 升级 · 父退出连带杀 · 墙钟上限**全部交 execa**（`^10.1.1` 已装）——引擎不自持任何信号逻辑、不自建第二个墙钟定时器、不复活 T26 的 registry/`reapStale`、不自造后代枚举。
- **绝不用面向用户的 `detached: true`**：它会短路 `cleanup`（`execa/lib/terminate/cleanup.js:6`）；组杀一律走 `killDescendants`。AC 以「`detached` 活面零命中」把门。
- **单源纪律**：预算/时序常量一处（`TerminationPolicy`）；终止因词汇一处（`session/ledger.ts`）；心跳格式一处。零环境变量、零配置 JSON 面。
- **fail-open 是默认姿态**：任一条腿不可读 → 不杀。宁可漏杀（人处置），不可误杀（砍掉正在干活的 child）。
- **execa best-effort 边界如实记录**：`killDescendants` 不覆盖「自成进程组/会话」的后代（`setsid` 起的 daemon 等）；不为此自造枚举。
- **失败面冻结**：终止轮不产生 `next:` 行、不给自动重来、不改 `FAILED_STATUS`（`session/next.ts:160`）。
- **对外契约零变**：CLI 旗标 / 退出码表 0/1/2 / `next:` 字面 / D29 消费面 skill 文本**全部不动** → 无 README / flag help 文案面。
- **历史面不追改**：零残留断言只覆盖活面（引擎 src · 引擎测试 · 模板）。
- **红窗口同任务收口**：T1 的 A 组异步翻面与它**强制的**测试面迁移（`FakeSync` 24 处 · `dispatch:` fixture 全 async · `sync-runner.test.ts` 四 pin 重落）同属 T1——引擎测试面在 T1 边界即回绿，不留跨任务红窗口；T2–T4 为新增面，不破既有 pin。
- **时序可注入**：判官窗口 / 采样节奏是**参数**（生产取 `TerminationPolicy` 常量，测试注入极小值）——否则端到端僵死 case 要等 30 分钟。
- **注册连带已落地**：本 plan 落仓引入第 25 条语料（`docs/kairos/plans` 11→12 · total 24→25 · `specs`=13 不变），corpus form-pin（`packages/cdd-engine/src-next/contract/__tests__/corpus-form-pin.test.ts`）已随注册重锚（standalone 连地带 commit，仿 P11 `6b4e38b1` / spec 侧 `c3521ff1`）；引擎套件回绿。
- **不发布**：changeset（cdd-engine minor）落 pending；tag / publish = 独立动作。
- **English-primary**（SKILL.md / `docs/*.md`）· specs/plans 中文（Strategy B）· emit 产物派生（`pnpm run emit`）· EOF 恰一 newline。

### Task 1: A 组派发契约异步化 + 进程缝换血 + 终止词汇单源（含强制的测试面迁移）
- **Objective**: `DispatchStep`（`session/run.ts:113`）由 `(frame: OpenFrame) => DispatchOutcome` 改为 `(frame: OpenFrame) => Promise<DispatchOutcome>`；`Lifecycle.advance()`（`:242`）异步化（`:257` 加 await）；`CliLifecycle.step()` / `#dispatch`（`face/lifecycle.ts:191`/`:198`）异步；`face/cli.ts:642` 的 `run.advance()` 加 await、注入包装（`:575-579`，其 `dispatch` 常量在 `:564`）的 `dispatch(frame)` 改 await。进程缝换血：`SyncProcess`（`face/lifecycle.ts:56-62`）与 `SyncRunner`（`:74-107`，其 `#collect` 即 `execaSync` 调用点 `:96`）退役，新建 `face/termination.ts` 承载——接口 `ChildRunner`（`run(command, args, cwd, policy): Promise<ChildOutcome>`）· 生产实现 `Terminator`（**execa 异步面**，选项面 = `killDescendants:true` + `forceKillAfterDelay:5000` + `timeout: policy.budgetMs` + `reject:false` + `stripFinalNewline:false`，**不设/不下调 `maxBuffer`**）· 值对象 `TerminationPolicy`（四键预算 + `idleWindowMs` + `sampleIntervalMs` 的**代码常量单源**，`of(phase: RoundPhase)` 按派发相取键；零 env、零 JSON）· `ChildOutcome = { code: number | null; stdout: string; stderr: string; termination: TerminationCause | null }`（`termination` 由 `Terminator` **内部**依 execa 结果面的 `timedOut` / `signal` 再叠我方 kill 行动派生——§4.1 的三因派生落在 `Terminator` 内，`CliLifecycle` 只读结论）。接线点 `face/lifecycle.ts:172` 与 `face/cli.ts:235` 的 `opts.sync ?? new SyncRunner()` 改 `Terminator`；全树唯一调用点 `face/lifecycle.ts:216` 的 `this.#sync.run(...)`（cwd 实参在 `:219`）改异步 runner 调用。C 组词汇单源：`session/ledger.ts:155-161` 的 `CrashCause` 改为 `TerminationCause = "stalled" | "over-budget" | "signal"` 与 `CrashCause = TerminationCause | "child-exit" | "contract-violation" | "unknown"`，退役三个**零写入者**死值 `engine-timeout` / `engine-over-budget` / `child-signal`（`child-signal` 语义归并 `signal`）；`unknown` 保留为不可归因兜底。**强制的测试面迁移同任务收口**：`face/__tests__/cli.test.ts`（`:147` `APPROVING: DispatchStep` 改 async · `:4718` `class FakeSync implements SyncProcess` 的 **24 处**实例化改实现 `ChildRunner` 的替身 `StubRunner` · 全树 `dispatch:` fixture 约 53 处改 async）· `session/__tests__/run.test.ts`（`:29`/`:88` 的 `DispatchStep` 类型 + `stub()` 助手 + `dispatch:` fixture 24 处改 async）· `session/__tests__/preflight.test.ts:510`（单处类型）· `face/__tests__/sync-runner.test.ts` 退役，其 **D36 四 pin** 迁入 `face/__tests__/termination.test.ts`（>1 MiB 整取 1048577 字节 · 尾段 prose 存活于 2 MB 叙事之后 · stderr 经同面聚合 1100000 · fail-open：非零 child 走其 `code`、坏命令不抛）。
- **Files**: Modify `packages/cdd-engine/src-next/session/run.ts`（`:113` · `:242` · `:257`）· Modify `packages/cdd-engine/src-next/face/lifecycle.ts`（`:56-62`/`:74-107` 退役 · `:172` 接线 · `:191`/`:198` · `:216`/`:219`）· Modify `packages/cdd-engine/src-next/face/cli.ts`（`:235` 接线 · `:564`/`:575-579`/`:642`）· Modify `packages/cdd-engine/src-next/session/ledger.ts`（`:155-161`）· Create `packages/cdd-engine/src-next/face/termination.ts` · Create `packages/cdd-engine/src-next/face/__tests__/termination.test.ts` · Delete `packages/cdd-engine/src-next/face/__tests__/sync-runner.test.ts` · Modify `packages/cdd-engine/src-next/face/__tests__/cli.test.ts` · Modify `packages/cdd-engine/src-next/session/__tests__/run.test.ts` · Modify `packages/cdd-engine/src-next/session/__tests__/preflight.test.ts`
- **Consumes**: spec §2.1（契约面）· §2.2（缝退役）· §3.1（形态）· §3.2（选项面与三条硬约束）· §3.5（常量）· §4.1（词汇）；execa 10.1.1 的 `killDescendants` / `forceKillAfterDelay` / `timeout`（`lib/methods/main-async.js:121` 单点焊接进所有 execa 发起的终止路径）
- **Produces**: `DispatchStep = (frame) => Promise<DispatchOutcome>`；`Lifecycle.advance(): Promise<StepResult | null>`；`CliLifecycle.step(): DispatchStep`（async）；`face/termination.ts` 的接口 `ChildRunner` + 实现 `Terminator` + 值对象 `TerminationPolicy`（`of(phase)` · 四键 `implement 6h` / `review 3h` / `fix 3h` / `branch-review 3h` · `idleWindowMs` 30min · `sampleIntervalMs` 60s）+ `ChildOutcome`；`TerminationCause` / `CrashCause` union；测试替身 `StubRunner implements ChildRunner`
- **Steps**:
  - `session/run.ts`：`DispatchStep` 改 Promise 返回；`Lifecycle.advance()` 改 `async`，`:257` 加 `await` — checkable: `grep -n 'DispatchStep' packages/cdd-engine/src-next/session/run.ts` 命中 `Promise<DispatchOutcome>`
  - 建 `face/termination.ts`（`ChildRunner` 接口 · `TerminationPolicy` 常量单源 + `of(phase)` · `Terminator` 的 execa 异步选项面 · `ChildOutcome`）— checkable: 新 pin「`Terminator` 对非零 child 走其 `code`、坏命令不抛、>1 MiB 整取 1048577」PASS（D36 四 pin 重落之一）
  - `face/lifecycle.ts`：删 `SyncProcess` / `SyncRunner`；`step()` / `#dispatch` 改 async；接线点改 `Terminator`；`:216`/`:219` 调用改异步 — checkable: `grep -rn 'SyncProcess\|SyncRunner\|execaSync' packages/cdd-engine/src-next | grep -v __tests__` 零命中
  - `session/ledger.ts` 词汇单源 — checkable: `grep -rn 'engine-timeout\|engine-over-budget\|child-signal' packages/cdd-engine/src-next` 零命中
  - `face/cli.ts` 接线与 await（`:235` / `:564` / `:575-579` / `:642`）— checkable: `tsc --noEmit -p packages/cdd-engine` 退出 0
  - 测试面迁移（`FakeSync`→`StubRunner` 24 处 · `dispatch:` fixture 全 async · `sync-runner.test.ts` 四 pin 迁入 `termination.test.ts`）— checkable: `pnpm -C packages/cdd-engine test` PASS（引擎测试面回绿）
- **Acceptance**: 派发链路全异步（`DispatchStep` 返回 `Promise<DispatchOutcome>` · `advance()` 为 `Promise` 且调用点 await · `CliLifecycle.step()`/`#dispatch` async · `Cli.#runWork` 的 `advance()` await）；`execaSync` / `SyncProcess` / `SyncRunner` 全活面零残留；生产选项面 = `killDescendants:true` + `forceKillAfterDelay:5000` + `timeout` 取该 op 预算键；`detached` 活面零命中（父退出连带杀走 execa `cleanup`，未被短路——本 pin 即其把门方式）；`TerminationCause` 三值 + 组合 `CrashCause`，三个死值零残留；D36 四 pin 在 `termination.test.ts` 在册；引擎测试面全绿
- **DependsOn**: none

### Task 2: B 组 stall 判官 + 双信号采样器（fail-open · 时序可注入）
- **Objective**: 在 `face/termination.ts` 内新增 **`StallJudge`**（纯逻辑类 · 零 I/O）：输入上一样本 / 本样本 + `idleWindowMs`，输出 `StallVerdict = "progress" | "unknown" | "idled" | "stalled"`（承 T26 语义）。判据：**两条腿都必须可读**才判，任一条不可读 → **`unknown` → 永不杀**（fail-open）；CPU 比**上一样本**增长 **或** mtime 比**历史最大值**增长 → 重置 idle 起点 → `progress`；无进展且 `now - idleSince < idleWindowMs` → `idled`；无进展且 `>=` → **`stalled`**。信号取法：**CPU 腿** = `execFileSync("ps", ["-o", "time=", "-g", String(subprocess.pid)])` 的多行输出求和（`time=` 格式解析为 ms；非零退出 / 解析失败 → `null`）——因约束（`killDescendants` 在 spawn 层强制进程组）child 即组长，**pgid = `subprocess.pid`**（引擎不重算）；**树腿** = 递归遍历 **repoRoot**（child 的 cwd，`face/lifecycle.ts:216-219` 的 `this.#scene.workspace.root.repoRoot`）· 跳过 `.git/` 与符号链接 · 深度上限，取 `statSync().mtimeMs` 最大值 · **显式排除心跳文件的精确路径**（§3.3 消歧硬约束；`.kairos/` **不**整目录排除——child 在 `.kairos/cdd/<slug>/` 下的 handoff 草稿是真进展），目录不可读 → `null`。判官窗口与采样节奏**是参数**（不读模块级常量），生产由 `TerminationPolicy` 注入、测试注入极小值。明确否决以 child stdout / 输出活动为信号（`claude -p` 可长时间静默思考 → 会误杀好 child）。
- **Files**: Modify `packages/cdd-engine/src-next/face/termination.ts`（`StallJudge` + 两条腿采样器）· Modify `packages/cdd-engine/src-next/face/__tests__/termination.test.ts`
- **Consumes**: Task 1 的 `ChildOutcome` / `TerminationPolicy` / `face/termination.ts` · spec §3.3
- **Produces**: `class StallJudge`（`verdict(prev: Sample | null, sample: Sample, idleWindowMs: number): StallVerdict`，纯逻辑）；两条腿采样器（`ps -o time= -g String(subprocess.pid)` 求和 · repoRoot mtime 最大值，跳过 `.git/` / 符号链接 / 心跳精确路径，不可读 → `null`）；`StallVerdict` 四态
- **Steps**:
  - 写 failing test（真值表四态：`progress` / `unknown` / `idled` / `stalled`，窗口参数化注入）— checkable: `pnpm -C packages/cdd-engine test termination` FAIL（类未建）
  - 实现 `StallJudge`（纯逻辑 · 窗口参数化 · fail-open）— checkable: 真值表四态 PASS
  - 实现两条腿采样器（CPU 腿求和 · 树腿 repoRoot mtime 最大值贴排除清单）— checkable: pin「任一腿不可读 → `null` → `unknown` 不杀」PASS
  - 心跳排除 pin — checkable: pin「心跳文件 mtime 增长**不**重置 idle 起点（扫描根排除其精确路径）」PASS
- **Acceptance**: `StallJudge` 四态真值表 pin 在册，`unknown` 恒不杀；CPU 或 mtime 任一腿不可读 → 不杀；扫描根 = repoRoot 且排除 `.git/` 与心跳文件精确路径（`.kairos/` 未整目录排除）；窗口 / 采样节奏为参数（可注入）
- **DependsOn**: 1

### Task 3: B 组采样循环 + 心跳落盘（60s unref · 终态清理）
- **Objective**: 在 `Terminator` 内接采样循环：spawn 后**立即先采一次**，此后 `setInterval`（**unref**，不阻父进程退出）每 `policy.sampleIntervalMs`（60s）；每 tick **覆写**该 dispatch 会话工作区（`.kairos/` 域内）的 `liveness.json` = `{ sampledAt: number; groupCpuMs: number | null; newestMtimeMs: number | null; verdict: StallVerdict }`（名固定——引擎是「一次派发、一次推进」，无并发派发）。**生命周期**：派发**正常完成**（child 自行退出）→ **删除**心跳文件；**被终止** → **保留**（供事后读，末样本由 T4 并入 crash record）。心跳文件的精确路径 = T2 树腿的显式排除项（不写 stderr：后台 dispatch 的 stderr 不保证被看且每 60s 一行噪声高；不并进 `progress.json`：那是轮次账本，采样噪声会撑大其 schema）。
- **Files**: Modify `packages/cdd-engine/src-next/face/termination.ts`（循环 + 心跳读写）· Modify `packages/cdd-engine/src-next/face/__tests__/termination.test.ts`
- **Consumes**: Task 2（判官 + 采样器）· spec §3.4
- **Produces**: 采样循环（立即首采 + 每 60s unref tick）；心跳落盘（tick 覆写）/ 正常完成删除 / 终止保留
- **Steps**:
  - 写 failing test（注入极小 `sampleIntervalMs` → 派发期心跳文件存在且被多 tick 覆写）— checkable: `pnpm -C packages/cdd-engine test termination` FAIL→PASS
  - 实现循环 + 心跳落盘 — checkable: pin「立即首采 + 多 tick 覆写（四字段）」PASS
  - 终态清理 — checkable: pin「正常完成 → 心跳删除」PASS；pin「被终止 → 心跳保留」PASS
- **Acceptance**: spawn 后立即首采；tick 间隔 = `policy.sampleIntervalMs` 且 `setInterval` unref；每 tick 覆写 `liveness.json`（四字段）；正常完成删除 · 被终止保留；心跳精确路径是树腿排除项
- **DependsOn**: 2

### Task 4: C 组终止落地面——kill 触发 → `TIMEOUT` · crash record（含末样本）· `timeoutCount` 递增 · 失败面无 `next:`
- **Objective**: 把判官 / 预算的结论落到轮次面。**触发**：判官 `stalled` → 我方调 `subprocess.kill()`（组杀 + SIGTERM→5s→SIGKILL 升级由 execa 承接）；budget 到期由 execa 的 `timeout` 自行终止；外部信号（`res.signal` 为任何信号 · 我方未杀 · 非 `timedOut`）→ `signal`。**三因派生**（落在 `Terminator` 内）：`error.timedOut === true` → `over-budget`；我方 kill（stall）→ `stalled`；以上皆非的外部信号 → `signal`；三支皆不匹配 → `unknown`（不可归因兜底）。**落地面**：`CliLifecycle.#dispatch`（`face/lifecycle.ts:198`）见 `termination !== null` → `status: "TIMEOUT"`（词表位 `face/words.ts:92` 已在）+ 理由走 stderr 的 `CDD_BLOCKED` 通道；`#reject`（`:514-518`，全树唯一 `writeCrash` 调用点）**扩为终止轮也写 crash record**——`cause`（`session/ledger.ts:179`）取三因/`unknown` 之一 · `stdoutTail`/`stderrTail` 照 `STDOUT_TAIL_MAX`（`face/lifecycle.ts:37`）限界 · 新增**末样本**字段（T3 心跳末态）；`timeoutCount` 真递增（`PROGRESS_COUNTER_ZERO` `session/ledger.ts:104` 的 `timeoutCount: 0` 与 `ProgressData.timeoutCount` `:139` 今日零写入者，`face/cli.ts:661` 的 `lastStatus === "BLOCKED" || "TIMEOUT"` 分支语义不变）。**失败面照旧**：`FAILED_STATUS = {BLOCKED, TIMEOUT}`（`session/next.ts:160`，路由 `:167-171`）→ **不产生 `next:` 行**，不给自动重来（挂起多半是环境性病变，自动重来只会再挂）。
- **Files**: Modify `packages/cdd-engine/src-next/face/termination.ts`（三因派生 + kill 触发）· Modify `packages/cdd-engine/src-next/face/lifecycle.ts`（`#dispatch` 终止腿 · `#reject` `:514-518` 扩终止轮 + 末样本）· Modify `packages/cdd-engine/src-next/session/ledger.ts`（crash record 末样本字段 · `timeoutCount` 写入点）· Modify `packages/cdd-engine/src-next/face/cli.ts`（`timeoutCount` 落的调用点；`:661` 语义不变）· Modify `packages/cdd-engine/src-next/face/__tests__/termination.test.ts` · Modify `packages/cdd-engine/src-next/face/__tests__/cli.test.ts`
- **Consumes**: Task 1–3 · spec §4.1（三因派生）· §4.2（crash record / `timeoutCount`）· §4.3（失败面）
- **Produces**: 终止轮 `status: "TIMEOUT"`；`ChildOutcome.termination` 三因或 `unknown`；crash record 含 `cause` + 末样本；`timeoutCount` 递增；终止轮无 `next:` 行
- **Steps**:
  - 三因派生 + kill 触发（`stalled` → `subprocess.kill()`；`over-budget` ← `timedOut`；`signal` ← 外部信号）— checkable: pin「注入极小 `budgetMs` → `cause: "over-budget"`（源自 `error.timedOut`）」PASS；pin「CPU 静默挂死 child（零 CPU 增长 · 不触碰 workspace · 不产出，issue #346 同形）+ 注入极小 `idleWindowMs`/`sampleIntervalMs` → `cause: "stalled"`」PASS；pin「忙等 child（进程组 CPU 持续增长）→ `progress` → 不砍」PASS（判别力正例）
  - `#dispatch` 终止腿 + `#reject` 扩终止轮 + 末样本 — checkable: pin「终止轮产 crash record（`cause` 三因之一 + 末样本非空）」PASS
  - `timeoutCount` 递增 — checkable: pin「终止一轮后 progress 的 `timeoutCount` +1」PASS
  - 失败面 — checkable: pin「终止轮输出**无** `next:` 行、走失败面（exit 码与 `CDD_BLOCKED` 通道携因）」PASS
- **Acceptance**: 端到端僵死 case（CPU 静默挂死 fixture + 注入极小时序）→ `TIMEOUT` + `cause: "stalled"` + crash record（含末样本）+ `timeoutCount` 递增；超 budget → `cause: "over-budget"`；外部信号 → `cause: "signal"`；忙等 fixture → `progress` → 不砍（正例 pin 在册）；终止轮无 `next:` 行（失败面契约照旧）
- **DependsOn**: 2, 3

### Task 5: 交付面——变更集 + 全量 validate
- **Objective**: cdd-engine **minor** changeset 在册（覆盖全 phase——`DispatchStep` 是内部类型 seam，不进包契约；P11 判 major 是因 `--findings`→`--reviews` 旗标改名，本 phase 无对外破坏）；全量 `pnpm run validate` 退出 0（emit 新鲜 + 插件解析 + 根脚本 vitest + kairos 套件 + 引擎套件 + typecheck × 3 + version-sync + `check:no-bare-functions`）；**不发布**（tag / publish 为独立动作）。
- **Files**: Modify `.changeset/*`（cdd-engine minor）
- **Consumes**: Task 1–4 的行为面 · spec §1.3（不发布 · minor）
- **Produces**: cdd-engine minor changeset 在册；`pnpm run validate` 退出 0
- **Steps**:
  - 写 changeset（`cdd-engine` minor）— checkable: `.changeset/*.md` 含 `@oscaner-skills/cdd-engine` 的 `minor`
  - 全量 — checkable: `pnpm run validate` 退出 0
  - 引擎全量 — checkable: `pnpm -C packages/cdd-engine test` 全绿（含 T1 里迁入的 D36 四 pin + T2–T4 新 pin）
- **Acceptance**: cdd-engine minor changeset 在册且不发布；`pnpm run validate` 退出 0；引擎测试面全绿（含终止器用例 + D36 四 pin + 判官真值表 + 端到端僵死 case）
- **DependsOn**: 1, 2, 3, 4

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-10-19 | 初稿——P12 实施计划：A 组派发契约异步化 + 进程缝换血 + 终止词汇单源（T1，含强制的测试面迁移与 D36 四 pin 重落，红窗口同任务收口）· B 组 stall 判官 + 双信号采样器（T2）+ 采样循环 + 心跳落盘（T3）· C 组终止落地面（T4：三因派生 / `TIMEOUT` / crash record + 末样本 / `timeoutCount` / 失败面无 `next:`）· 交付面（T5：changeset minor + 全量 validate）；波次 W1={1} · W2={2} · W3={3} · W4={4} · W5={5} | Oscar M. · Claude Opus 5（kairos:cdd-plan [P12] · 2026-10-19） |