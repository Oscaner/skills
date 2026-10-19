---
title: 引擎文档工具（Engine Doc-Tooling）— P12 设计：child dispatch 终止兜底（liveness + budget）
doc-type: phase-spec
version: v0.7
date: 2026-10-19
status: Draft
author: Oscar M. · Claude Opus 5（kairos:cdd-design [P12] 会话 · 用户逐轮裁定 Q1–Q14 · 2026-10-19）
parent-program: 2026-10-10-engine-doc-tooling-overall.md
parent-version: v2.57
depends-on: P11（Done · v0.7 · hard——P11 全链闭合后 child dispatch 终止兜底 · overall 依赖图 D52）
---

## Design

本 phase 承接 P11 收口后的续 phase（2026-10-19 cdd-design [P12] 会话 · 注册 D52 · grilling 全裁定 D53），补回**引擎 child dispatch 面的终止兜底**：停摆的 child 要被**真发现、真砍、真记录**——消费方不再需要外部 `ps` 才发现 child 链已死，也不再需要人工杀进程树恢复。

**病灶（issue #346 · 现场）**。kairos:cdd-dev 的 NEXT-LOOP 后台 dispatch `cdd review --type wave --tasks 1,2,3`；review child 在验证面自行跑探针（`timeout 25 uv run taskiq worker app.indexing.worker:broker --workers 1`），该 `timeout` 包装进程**自身僵死**（1h33m+ 无 CPU、无子进程、不回收），堵死 review child → 堵死整个 dispatch。期间 progress.json 不动、无 crash record、无 stderr——消费方只能靠外部 `ps` 发现在 1h44m，并需人工杀进程树。探针类命令（worker 启动验证、compose 拉起、long-poll）天然易踩，任何一层僵死即无限等待。

**这不是"被裁掉的机制"，是迁移缺口（调查结论 · D52）**。旧树曾持**全套**终止面：T14（`50c20f22` · 2026-09-19）dispatch-phase liveness monitor · `a8f697e7` per-sample CPU stall baseline · T26（`ea5d8433` · 2026-09-20）unified termination monitor——commit 原文 *"one judgment layer replaces the execa timeout channel — stall signal (CPU + workspace mtime, fail-open) judges before the budget wall-clock cap; external SIGTERM folds into the same cause surface"*，落在 `src/infra/proc.ts`（`spawnManaged` + `TerminationJudge` + 双信号采样）与 `src/infra/invoke.ts`（`resolveTerminationConfig`）；T9（`b04ac1ab` · 2026-10-01）再把它统一为 op-keyed `timeouts.defaults`。**cutover `f8471c44`（2026-10-08「切 src-next + 删旧树·旧数据面」）一次删净**（含 `liveness.monitor.test.ts` 412 行 · `infra.proc.test.ts` 151 · `lifecycle.proc.test.ts` 229）。src-next 重写从未携带终止面，且 `infra/runtime.ts:20-22` 把 `contextContract…timeouts` 通道当 **"no live consumer"** 死配置**显式删除**（循环论证：读它的消费者没被搬过来，于是它被判为无消费者）。P8 D36（2026-10-15）在已无监控的 src-next 上把 `SyncRunner` 由 `execFileSync` 换 `execaSync`，只治 `maxBuffer` 输出缓冲上限——**时间维度从未在 src-next 被提起**。

**现状坐实**。`SyncRunner.#collect`（`face/lifecycle.ts:96`）的 `execaSync` 仅传 `{cwd, reject:false, stripFinalNewline:false}`——无 `timeout`、无 `killSignal`、无任何看门狗；`face/lifecycle.ts:64-73` 的注释自称"the unbounded sync child channel"并把"无界"写成设计（它治的是**输出缓冲**上限，时间维度从未被讨论）。`CrashCause` 的 `engine-timeout` / `engine-over-budget`（`session/ledger.ts:158-159`）与 `timeoutCount`（`:105`/`:139`）**全库零写入者**（真写入只有 `child-exit` `face/lifecycle.ts:231` 与 `contract-violation` `:514`）= **超时分类存在、超时检测不存在**。全树零 `process.kill`、零 `detached`、零 `process.on('SIGTERM'|'SIGINT')`、零配置读取器。

**一记回旋镖**。`render/templates.ts:457-458` 的 `cl:bash-stall-limit` 在 **7 个 shell 模板**（`:167`/`:187`/`:207`/`:354`/`:370`/`:386`/`:402`）里对 child 说 *"If a Bash command stalls without progress for more than 10 minutes, terminate it…"*——**引擎给 child 装了 idle 看门狗，自己却没有**。（本 phase 之后两侧并存且自洽：child 自警 10 分钟 < 引擎 idle 窗口 30 分钟——child 先自省，引擎兜底。）

**用户裁定（本会话 · D53）**：**两个信号都要**——① 墙钟**上限**兜底（长任务 child 合法耗时不可预估）；② **上限之内**，child「一直未动」超过 **半小时** 即砍。后者是 **T26 的 stall 语义**，不是 execa 裸 `timeout`——后者的墙钟砍不动"正在干活"与"僵死"之别。

### 1. 目标与边界

#### 1.1 设计输入与授权

- **设计输入**：本会话 grilling 全裁定（kairos:cdd-design [P12] · 用户逐轮裁定 Q1–Q14）· 已回填 overall D52（注册）与 D53（grilling · settled）+ 四表（v2.55 → v2.56，**含本 spec 前的 parent overall sync**）。
- **外部输入**：issue #346（唯一）。
- **重构授权**：用户七前提 mandate（① 允许破坏性变更，可重写代码、重组目录 ② 高维 OOP 抽象统一，零裸函数 ③ 最佳实践零技术债，避免散文堆砌，避免声明再抄 ④ 高内聚低耦合，死代码、空壳清理 ⑤ 消费者心智负担优先 ⑥ 在保证语义清晰下最大程度重构整合、最大精简系统 ⑦ **不造轮子，优先考虑第三方 pkg**）。
- **判据的首要性**：**前提 ⑦ 是本轮的决定性判据**——它把"自造看门狗进程"整条路线排除（见 §3.2）。

#### 1.2 判定基线

沿 D26 法条（一事实一处 · 判定时刻现读 · 副本永不具权威）在本 phase 的落点，以及**恢复面**的性质：

| 类 | 义 | 本 phase 实例 |
|---|---|---|
| **迁移缺口** | 机制被重构吞掉，无任何"决定不要它"的记录 | 终止面（T14/T26/T9 → cutover 删旧树 → src-next 零携带） |
| **死枚举 / 死计数器** | 声明了分类，无人写入 | `engine-timeout` / `engine-over-budget` / `timeoutCount` |
| **名不符实** | 一个词的名字与它指的事不是同一个东西 | `engine-timeout`（它不是 timeout，是**停滞**） |
| **同步契约的代价** | 一条为别的目的立下的约束，挡住了新能力 | P8 §14.3 否决 async 化（当时是为"一桩 IO 异步化"）→ 现为终止面所必需 |

#### 1.3 保留面（冻结）

- **失败面契约不变**：`FAILED_STATUS = {BLOCKED, TIMEOUT}`（`session/next.ts:160`）——两者**在任何 op 上都不产生 `next:` 行**，理由走 stderr 的 `CDD_BLOCKED` 通道（D18 ④ 冻结了 `next:` 字面语义）。本 phase **不**给终止轮开自动重来的口（见 §4.3）。
- **不含 residue/stash 抢救**（Q10 · anti-goal）：T26 的 `artifacts/residue.ts` 那套（死轮 WIP 存 stash + 载体记 `recovery.*` + 派发预检 salvage）**不纳入**本 phase——issue #346 未要求；P11 后 child 产物面已收敛为 handoff 草稿 + evidence，半写草稿属"被拒稿"处理（crash record 已记 tails）。留作独立议题。
- **对外契约零变**：CLI 旗标 / 退出码表 0/1/2 / `next:` 字面 / doc-contract 判定语义 / 投影面——**全部不动**。`face/cli.ts:661` 既有的 `lastStatus === "BLOCKED" || "TIMEOUT"` 分支语义不变（它今天就在那儿等着一个从未到达的状态）。
- **D29 黑盒边界守约**：消费面 skill 文本**零改**（终止只是一个"那时会得到的结论"）；模板是引擎发射面，非 skill 文本。
- **结论派生不变**：`HandoffSchema.conclusionOf` / `rollup` / `#reconstruct` 的草稿回读 + evidence 回读语义逐条不变——本 phase 只加"派发会不会被提前终止"，不动"终止之后结论怎么读"。
- **dry-run 零影响**：`--dry-run` 不派发（P11）→ 天然不进终止面。
- **不发布**：changesets 收尾至可发布态即止（cdd-engine **minor** · 不发布）。

### 2. A 组 · 派发链路异步化

#### 2.1 契约面

| 面 | 今日 | 改后 |
|---|---|---|
| `DispatchStep`（`session/run.ts:113`） | `(frame: OpenFrame) => DispatchOutcome` | **`(frame: OpenFrame) => Promise<DispatchOutcome>`** |
| `Lifecycle.advance()`（`session/run.ts:242`；派发于 `:257` `const outcome = this.#dispatch(frame)`） | `StepResult \| null` | **`Promise<StepResult \| null>`**（`:257` await） |
| `CliLifecycle.step()` / `#dispatch`（`face/lifecycle.ts:191`/`:198`） | 同步 | **async**（`step()` 返回 async step；`#dispatch` 返回 `Promise<DispatchOutcome>`） |
| `Cli.#runWork`（`face/cli.ts:456` · 派发循环 `:617`/`:618`/`:642`） | 已 `async`；`:642` `const step = run.advance()` | `await run.advance()`（及其注入包装 `:575-579` 内的 `dispatch(frame)` 改 await——该包装的 `dispatch` 常量在 `:564`；派发循环即 `:617` 的 `for (;;)`，`:618` 的 `run.peekNext()`） |
| action 壳（`face/cli.ts:335-340`） | 已 `async` | 不变（内层 await 自然上浮） |
| `--dry-run` 预览分支（`face/cli.ts:638-641`） | 读 `peekNext()` 的 frame + 同步 `Preview.render` | 不变——`peekNext()` 仍同步（它只读 frontier，不派发） |

**这是一次 deliberate pin break**：P8 §14.3 明文以"为一次 IO 异步化会撕开整个 lifecycle 类型面"否决 async 化（`specs/2026-10-10-engine-doc-tooling-p8-design.md`）。当时的判断针对**一桩 IO 便利**；本 phase 的 async 是**终止面的必要条件**（同步面 `detached` / `forceKillAfterDelay` / `killDescendants` 全为 `never`，见 §3.2）——性质不同，授权来自前提 ①。回归落点：父 overall **D53**（本 spec 已回填）。

#### 2.2 进程面：`SyncProcess` / `SyncRunner` 退役

- **接口**：`SyncProcess`（`face/lifecycle.ts:56-62`）的同步签名（`run(...): {code, stdout, stderr}`）退役，代之以异步面。
- **类**：`SyncRunner`（`face/lifecycle.ts:74-107`，其 `#collect` 即 `execaSync` 调用点 `:96`）退役——它的名字（`Sync`）在异步后成为谎言（前提 ③），且它的整个职责被 §3 的终止器吞并。
- **唯一调用点**：全树唯一的 `this.#sync.run(...)` 在 `face/lifecycle.ts:216`（cwd = `this.#scene.workspace.root.repoRoot`）；构造点 `face/lifecycle.ts:172` 与 `face/cli.ts:235`（`opts.sync ?? new SyncRunner()`）随之退役。
- **新面**：注入缝改为**终止器接口 `ChildRunner`**（§3.1）——测试替身从"假 `SyncProcess`"改为**实现该接口的 `StubRunner`**（`run(): Promise<ChildOutcome>`）。

#### 2.3 迁移面（生产站点 + 测试）

生产站点（~18 处）随 §2.1 的类型改自然上浮；测试面是**有量**的工作，逐条列名（"测试面全绿"是 AC，不迁移则落地即红）：

| 测试面 | 今日 | 迁移后 |
|---|---|---|
| `face/__tests__/cli.test.ts:147` `APPROVING: DispatchStep = () => ({status:"APPROVED", findings:[]})` | 同步返回 | `async` 返回 |
| `face/__tests__/cli.test.ts:4718` `class FakeSync implements SyncProcess`（实例化 **24 处**） | 同步 `run()` | 换为 `StubRunner implements ChildRunner`（`run(): Promise<ChildOutcome>`） |
| `face/__tests__/cli.test.ts` 的 `dispatch:` fixture（**29 处**） | 同步 step | async step |
| `session/__tests__/run.test.ts`（`DispatchStep` 类型 `:29`/`:88` · `stub()` 助手 · `dispatch:` **24 处**） | 同步 | async |
| `session/__tests__/preflight.test.ts:510` 的单处 `DispatchStep` | 同步 | async |
| `run.advance()` 的调用点（`session/__tests__/run.test.ts` **91 处** · `session/__tests__/preflight.test.ts:535`/`:540` 2 处） | 同步取值（`const step = run.advance()` · `run.advance()!.frame` · `expect(run.advance()).toBeNull()`，另有裸调用 `run.advance();`） | **逐处 `await`**——`advance()` 改返 `Promise` 后，裸调用会因 promise 未结算而语义失效（"红窗口同任务收口"要求这一块与其余迁移同在 T1 内回绿） |
| `face/__tests__/sync-runner.test.ts`（用**真** `new SyncRunner()`） | 锁 `execaSync` 三选项 + **四条行为 pin**（>1 MiB 整取 1048577 字节 · 尾段 prose 存活于 2 MB 叙事之后 · stderr 经同面聚合 1100000 · fail-open：非零 child 走其 code、坏命令不抛） | 整体重写为**终止器用例**（`ChildRunner` 面）——四条 pin **不随 `SyncRunner` 退役而消失**，改由**同一新文件**收录（异步 `ChildRunner` 仍整取无界输出 · 尾段不截断 · fail-open 不抛）；生产语义由 §3.2 选项面保住（`reject:false` · `stripFinalNewline:false` · 不设/不下调 `maxBuffer`——execa 默认 **100 MB**，sync/async 共用同一默认表 `lib/arguments/specific.js:121`） |
| `src-next/contract/__tests__/corpus-form-pin.test.ts` | 本 phase 落仓期间曾两次被迫重锚语料计数（specs 12→13 · plans 11→12） | **该 pin 已整体退役**（用户裁定 · overall **D54**）：语料完整性属**引擎流程**职责——spec/plan 各自 review 已逐篇判过，整体 spec 若要有门应加在 flow 侧；测试面只校验引擎功能，而 `Contract.validate` 的行为面由 `judge.test.ts` / `doc.test.ts` / `lint.test.ts` 覆盖。计数重锚「注册连带」仪式随之消失 |

### 3. B 组 · 终止器（stall + budget）

#### 3.1 形态与职责

一个 **`Terminator`** 类（新 · `face/` 面 · OOP · 零裸函数）承担一次派发的**进程生命周期**：spawn → 采样 → 判停 → 杀 → 收回结果。缝的接口是 **`ChildRunner`**（`run(...): Promise<ChildOutcome>`）：`Terminator` 是其**生产实现**、测试注入的是实现同一接口的**替身 `StubRunner`**——接口名 / 生产实现名 / 替身名三者对齐，`CliLifecycle` 只见接口。

**`ChildOutcome` 形状**（缝的结果契约）：`{ code: number | null; stdout: string; stderr: string; termination: Termination | null }`。`Termination = { cause: TerminationCause | "unknown"; lastSample: SampleRecord | null }`——`cause` 由 `Terminator` **内部**依 execa 结果面的 `timedOut` / `signal`（`lib/terminate/timeout.js:24-33` · `lib/methods/main-async.js:223`）再叠我方 kill 行动派生（§4.1 的派生面因此落在 `Terminator` 内，`CliLifecycle` 只读结论、不见 execa 结果面）；`lastSample` 是采样循环的**末次观测**（`SampleRecord` · §3.4 的同一形状）。**终止的判据**：`termination !== null` ⟺ **本轮被终止**（`timedOut` ∨ 我方 kill ∨ 结果面带信号）——**不是**"没有正常退出码"：spawn 失败（坏命令 / ENOENT 之类）既无退出码、也无终止事件，`termination` 仍为 `null`，照旧走 `child-exit` 面 → `BLOCKED`（今日的 fail-open 面逐字不变）；`unknown` 是"被终止但三支皆不可归因"的兜底。终止轮的一切下游判定（`status: TIMEOUT` · crash record 的因与末样本 · `timeoutCount` 递增）都从 `termination` 这一支读，**不从 `code` 反推**。

`code` 取 execa 的 `exitCode` **原值**——`SyncRunner.#collect` 今日的 `exitCode ?? 1` 折叠随本轮退役（它把"从未启动"与"被杀死"都谎报成 `1`）；崩溃记录的 `exitCode` 相应放宽为 `number | null`，其字段注释里"143 = SIGTERM 的 shell 约定"一并退役（被信号杀死的 child 没有退出码，信号语义由 `cause` 承载）。

**`ChildRun` 形状**（缝的入参契约 = 一次派发的全部上下文）：`{ command: string; args: readonly string[]; cwd: string; heartbeatPath: string; policy: TerminationPolicy }`。两个路径**同源于派发会话工作区**：`CliLifecycle`（唯一持有 `scene.workspace` 的一方）在调用点 `face/lifecycle.ts:216` 派生 `cwd = scene.workspace.root.repoRoot`（child 的 cwd）与 `heartbeatPath = <scene.workspace.path>/liveness.json`（§3.4 落点）。`Terminator` **零会话态构造**——`face/cli.ts:235` 的默认接线处无需 scene，会话事实全走调用实参；且它以**同一个** `run.cwd` 既作 spawn 的 cwd、又作 §3.3 树腿的扫描根，「扫描根 ≡ child 的 cwd」因此是结构保证而非注释。

**引擎自持的只有三样**——**没有一样是轮子**（前提 ⑦）：

| 自持项 | 为什么没有现成轮子 |
|---|---|
| **stall 判官**（纯逻辑） | 没有任何 pkg 会替你判"这个 dispatch 是不是不动了"——这是本域的定义性问题 |
| **采样循环** | 唯二的两条腿（进程组 CPU · workspace mtime）是本引擎的领域信号 |
| **心跳落盘** | 本引擎的可观测协议 |

**其余全交 execa**（§3.2）：进程组建、组杀、SIGTERM→SIGKILL 升级、父退出连带杀、墙钟上限——全是 `execa@10.1.1` 已内建的能力。

#### 3.2 选项面（execa · 三条硬约束）

生产 spawn 的选项**就是**：

```ts
execa(command, args, {
  cwd,
  reject: false,
  stripFinalNewline: false,
  killDescendants: true,        // 组杀（内部强制进程组 + process.kill(-pid)）
  forceKillAfterDelay: 5000,    // SIGTERM → 5s → SIGKILL（默认值，显式写出）
  timeout: policy.budgetMs,     // 墙钟上限（budget）
})
```

**约束 ① · 绝不使用面向用户的 `detached: true`。** execa 把「面向用户的 `detached`」与「内部组建」**刻意分家**（`lib/terminate/kill-descendants.js:10-11`）——因为 `detached: true` 会**关掉 `cleanup`**（`lib/terminate/cleanup.js:6`：`if (!cleanup || detached) { return; }`）。要组杀就用 `killDescendants`（它自己强制 spawn 层的 detached，不动用户值）。**这条是硬约束**：写 `detached: true` 会静默失去 §3.2 约束 ③。

**约束 ② · budget 交给 execa 的 `timeout`。** 引擎**不自建第二个墙钟定时器**（前提 ⑥）。execa 的 `timeout` 走同一条 kill 函数 → 组杀 + 5s 升级，错误面原生带 `timedOut` / `signal` / `isForcefullyTerminated`（`lib/terminate/timeout.js:24-33` · `lib/methods/main-async.js:223`）。

**约束 ③ · 父退出连带杀由 `cleanup` 免费覆盖。** `cleanup` 默认 `true`（`lib/arguments/options.js:89`），由 `signal-exit` 驱动，且**继承 `killDescendants`** → 父进程被 Ctrl-C / 引擎崩溃时，child 的整组连带走。**不复活** T26 的持久化 registry + `reapStale` 那套（Q9 裁定）。因约束 ①，`cleanup` 保住。

**事实依据（已逐行核 · `execa@10.1.1`）**：

| 事实 | 证据 |
|---|---|
| `killDescendants` 存在 · 默认 `false` · 同步面为 `never` | `types/arguments/options.d.ts:336-347` · `lib/arguments/options.js:90` · `lib/methods/main-sync.js:73-75`（throw） |
| Unix 组杀实现 | `lib/terminate/kill-descendants.js:12-14`（强制 detached）+ `:51` `process.kill(-subprocess.pid, signal)`（包内**唯一**一处 `process.kill`） |
| Windows 组杀 | `lib/terminate/kill-descendants.js:64-81` `taskkill /pid … /T /F` |
| 内建于所有 execa 发起的终止路径 | `lib/methods/main-async.js:121` `getKillFunction` 单点焊接（`kill()` / `timeout` / `cancelSignal` / `cleanup` 共用） |
| `forceKillAfterDelay` 默认 5000 · 升级条件 | `lib/terminate/kill.js:20` · `:68-77`（`signal === killSignal && killResult`）——**仅 execa 发起的终止**，外部信号不触发 |
| `cleanup` 默认 true · `detached` 短路 | `lib/arguments/options.js:89` · `lib/terminate/cleanup.js:5-16` |
| `timeout`（异步）组杀 + 升级 + 错误面 | `lib/terminate/timeout.js:24-33` · `lib/methods/main-async.js:223` |
| 同步面三能力全 `never`（Q1 必须 async 的硬约束） | `types/utils.d.ts:5` `Unless<IsSync,…>` · `lib/methods/main-sync.js:52-75` 显式抛错 |
| 零自造后代枚举（全交 OS） | 包内无 `pidtree` · 无 `cross-spawn`（`package.json#dependencies` 无此项） |

**best-effort 边界**：`killDescendants` 的文档明说"descendant processes that create their own process group or session are not terminated"。issue #346 的现场（`timeout` 包装 + taskiq worker）在 child 组内，被覆盖；**自成 group/session 的探针**（如 `setsid` 起的 daemon）不在覆盖内——这是 execa 的既定边界，本 phase 不为此自造枚举（前提 ⑦）；该边界写进 Constraints 与 AC。

#### 3.3 stall 判官

**`StallJudge`**（纯逻辑类 · **零 I/O · 有状态** · 窗口与节奏皆可注入）：判官不是"两个样本的纯比较"，而是一次派发期间的**运行判断**——它自持累加态，观测入口 `observe(sample: Sample, now: number): StallVerdict`，逐 tick 喂入样本、返回四态之一。

`Sample = { groupCpuMs: number | null; newestMtimeMs: number | null }`——`null` = 该腿不可读；字段名与 §3.4 的心跳记录面**同一处命名**（一处命名、两处引用）。判官自持的累加态：`#lastCpuMs`（上一次观测的进程组 CPU）· `#maxMtimeMs`（历史最大 mtime）· `#idleSince`（最近一次"有进展"的时刻，首采置为 spawn 时刻）。

```
progress | unknown | idled | stalled
```

判据（承 T26 语义）：

- **两条腿**：CPU 腿 = 进程组累计 CPU（ms）· 树腿 = **repoRoot** 工作树最新文件 mtime（ms，排除项见下）。
- **可测性**：**两条腿都必须可读**才判；任一条不可读 → **`unknown` → 永不杀**（fail-open：未知不等于僵死）。
- **有进展**：CPU 比**上一次观测**（`#lastCpuMs`）增长 **或** mtime 比**历史最大值**（`#maxMtimeMs`）增长 → 重置 `#idleSince` → `progress`。
- **无进展但未到期**：`now - #idleSince < idleWindowMs` → `idled`。
- **无进展且到期**：`now - #idleSince >= idleWindowMs` → **`stalled` → 砍**。

**明确否决的备选**：以 child 的 stdout / 输出活动为信号。`claude -p` 完全可以长时间静默思考——用输出当"有进展"会**误杀好 child**。CPU + mtime 是"在真干活"的**正面证据**。

**信号取法**：

| 腿 | 取法 | fail 语义 |
|---|---|---|
| CPU | `execFileSync("ps", ["-o", "time=", "-g", String(subprocess.pid)])` → 多行输出求和（`time=` 格式解析为 ms） | 非零退出 / 解析失败 → `null`（腿不可读） |
| 树 | 递归遍历 **repoRoot**（child 的 cwd——`face/lifecycle.ts:216-219` 的 `this.#scene.workspace.root.repoRoot`，`:216` 的 `#sync.run(` 调用锚点 + `:219` 的 cwd 实参）· 跳过 `.git/` 与符号链接 · 深度上限，取 `statSync().mtimeMs` 最大值——**显式排除心跳文件本身**（§3.4） | 目录不可读 → `null` |

**树腿扫描根 · 消歧（硬约束）**：扫描根 pin 为 **repoRoot**（= child 的 cwd，`face/lifecycle.ts:216-219`），**不是**会话工作区子目录——child 的真产物流向 repoRoot 工作树，含 `.kairos/cdd/<slug>/` 下的 handoff 草稿（那是真进展），故**不可**整目录排除 `.kairos/`。但引擎在派发窗口内的自写必须排除，否则心跳即自证"进展"：§3.4 的 `liveness.json` 恰落在 repoRoot 树内的 `.kairos/` 域，若计入，每 60s 的覆写就成为每一步样本的最新 mtime，上面「mtime 增长 ⇒ progress」每 tick 命中、idle 窗口永不耗尽——对 issue #346 的**零 CPU 静默挂死** child，`stalled` 将永不触发。故排除清单恰好两处：`.git/` 与**心跳文件的精确路径**；一次心跳 tick 的覆写**绝不计入** mtime 腿（AC pin）。

**进程组 id 的来源**：因约束 ①（`killDescendants` 在 spawn 层强制 `detached`），child 即进程组长 → **pgid = `subprocess.pid`**（这正是 execa 内部 `process.kill(-subprocess.pid, …)` 所依赖的同一事实）。引擎**不重算** pgid。

#### 3.4 采样与心跳

- **节奏**：`setInterval`（**unref**，不阻父进程退出）· 播 **60s**；spawn 后立即先采一次。
- **心跳文件**：每 tick **覆写**该 dispatch 的 workspace 目录（`.kairos/` 域内）下的 **`liveness.json`**（名固定——引擎是"一次派发、一次推进"，无并发派发）；该文件的**精确路径是 §3.3 树腿的显式排除项**——引擎自写不得自证"进展"：

```ts
// SampleRecord —— Sample（§3.3 的两腿）扩展记录面的两字段：一处命名，扩展而非重抄
{ sampledAt: number; groupCpuMs: number | null; newestMtimeMs: number | null; verdict: StallVerdict }
```

- **生命周期**：派发**正常完成**（child 自行退出）→ **删除**心跳文件；**被终止** → **保留**（供人事后读），并把**末样本**并入 crash record（§4.2）——末样本走 `ChildOutcome.termination.lastSample`（§3.1）**随因同行**，生产者在内存里已持有该观测，**不回读**盘上文件。
- **为什么不写 stderr**：后台 dispatch 的 stderr 落在重定向输出里，不保证被看，且每 60s 一行噪声高。
- **为什么不并进 `progress.json`**：那是轮次账本；采样噪声会撑大它的 schema（前提 ④ 高内聚）。

#### 3.5 预算与时序常量（单源 · 按 op 分开）

**代码常量单源**（`TerminationPolicy` 值对象 + 其常量表），**零环境变量、零配置 JSON 面**：

| 键 | 值 | 义 |
|---|---|---|
| `implement` | **6h** | 实施轮墙钟上限 |
| `review` | **3h** | 评审轮墙钟上限 |
| `fix` | **3h** | 修复轮墙钟上限 |
| `branch-review` | **3h** | 分支评审轮墙钟上限 |
| `idleWindowMs` | **30min** | stall 判定窗口（非 per-op） |
| `sampleIntervalMs` | **60s** | 采样节奏（非 per-op） |

- **键集 = 派发相全集**：`OpType = implement|review|fix`（`session/ledger.ts:73`）+ `RoundPhase` 的 `branch-review`（`:74`）。**理由（T9 的老账）**：T9 当年的缺陷正是"键与实际派发 op 不匹配"（legacy 硬编码 `"task"` 键使 `cdd review --type task` 读到 implement 的预算）——键集少于派发相就会掉进 fallback，那正是"模糊"。
- **为什么零配置面**：旧面那三个 env 覆盖键（`CDD_TASK_TIMEOUT` / `CDD_REVIEW_TIMEOUT` / `CDD_CLI_TIMEOUT`）当年已被 T26 **主动废除**；src-next 更立了"new tree reads zero config files — every stable runtime fact lives here"（`infra/runtime.ts:3-5`）。为六个数字重开一个 JSON 解析平面，违前提 ③⑥。将来真需要按仓库微调，开 CLI flag 即可——**本期不做**。
- **时序可注入（AC 的硬性设计后果）**：判官的窗口与采样节奏必须是**参数**而非模块级常量读取——生产走常量单源，测试注入极小值（否则"端到端僵死 case"要等 30 分钟）。

### 4. C 组 · 词汇统一与失败面

#### 4.1 `TerminationCause` 单源

现树有两套名字打架：`CrashCause`（`session/ledger.ts:155-161`）= `child-exit` / `child-signal` / `engine-over-budget` / `engine-timeout` / `contract-violation` / `unknown`；T26 的 `TerminationCause` = `stalled` / `over-budget` / `signal`。同一事实两套词 = **声明再抄**（前提 ③）。

**裁定**（单源三词 · 前提 ③④）：

```ts
export type TerminationCause = "stalled" | "over-budget" | "signal";
export type CrashCause = TerminationCause | "child-exit" | "contract-violation" | "unknown";
```

- **派生面：三因 + 一支兜底**（极干净，因为 §3.2 约束 ② 把 budget 交给了 execa）：`error.timedOut === true` → **`over-budget`**；我方 stall 判定后调 `subprocess.kill()` → **`stalled`**；外部信号（`res.signal` 为**任何**信号 · 我方未杀 · 非 `timedOut`）→ **`signal`**（按语义收口而非 SIGTERM 字面——SIGTERM / SIGKILL / SIGINT / SIGHUP 一视同仁）；**以上三支皆不匹配 → `unknown`**（第四支兜底 · 不可归因）。
- **退役（三个死值）**：`engine-timeout` / `engine-over-budget` / `child-signal`——`engine-timeout` **名不符实**（它不是 timeout，是停滞），且与 `stalled` 语义重复；`child-signal` **整体退役**，语义归并到 `signal`（同一事实：child 被外部信号杀死——我方未杀、execa 未超时）。核实：`child-signal` 全库唯一出现即 union 成员本身（`session/ledger.ts:157`），零写入者。
- **保留**：`child-exit`（child 非零退出）与 `contract-violation`（read-back 拒绝）是**另一维度**（正常终止但失败），不混进终止词表；`unknown` 亦保留——它是派生面的**第四支兜底**（以上三支皆不匹配才落到它），有明确的生产者，**不是**死枚举。

#### 4.2 crash record 与 `timeoutCount`

- **crash record**：`#reject`（`face/lifecycle.ts:514-518`，唯一 `writeCrash` 调用点）扩为**终止轮也写**——`cause`（`session/ledger.ts:179` · 字段注释已写"The unified termination cause — postmortem, zero behavior fork"，本 phase 正是把它由死值换成活值）取 §4.1 的派生因（`stalled` / `over-budget` / `signal`，兜底 `unknown`）；`stdoutTail`/`stderrTail` 照 P11 的 `STDOUT_TAIL_MAX` 限界；新增**末样本**字段，取 `outcome.termination.lastSample`（`SampleRecord` · 随因同行 · **零回读**——生产者在内存里已持有该观测，回读盘上心跳只会再造一个可漂移的第二来源）；`exitCode` 放宽为 `number | null`（§3.1 的推导面诚实化连带——被信号杀死 / 从未启动的 child 没有退出码，不折叠谎报）。
  - 现状注记：`Ledger.readCrash`（`session/ledger.ts:910`）**零调用者**——crash record 今天是一份"只写不读"的盘上事后件，其 `next`（`session/ledger.ts:177` · the same-command resume string）字段从未被消费。本 phase **不改这个性质**（消费方读盘自查），只让终止轮也产出它。
- **`timeoutCount` 真递增**：`PROGRESS_COUNTER_ZERO`（`session/ledger.ts:104`）与 `ProgressData.timeoutCount`（`:139`）今日**零写入者**——终止轮落地时真递增（`face/cli.ts:661` 已有的 `TIMEOUT` 分支说明这条通道本来就为它留着）。

#### 4.3 失败面（无 `next:` · 照旧）

终止轮 = **`status: TIMEOUT`**（词表位 `face/words.ts:92` 已在）→ 走 `CDD_BLOCKED` stderr 通道携因 → **不产生 `next:` 行**（`session/next.ts:160-171`）。

该状态**由 `termination !== null` 派生**（§3.1），**不新增入参**：`#reject`（唯一 `writeCrash` 点）据结果面的 `termination` 决定返回 `TIMEOUT`（有终止）还是 `BLOCKED`（无终止），`cause` 取 `termination?.cause ?? "child-exit"`；而 `#dispatch` 必须在 `result.code !== 0` 的 `child-exit` 分支**之前**先判 `termination !== null`——被杀 child 的 `code` 为 `null`，`null !== 0` 会把终止轮误落进 `child-exit`。

**明确否决**：给终止轮一条自动重来的 `next:` 行。理由：挂起多半是环境性病变（探针僵死、依赖服务不回），自动重来只会再挂 30 分钟——而**无人值守的后台派发正是最没人拦的场景**。失败面就是失败面：由人定夺。这同时守住了 D18 ④ 冻结的 `next:` 语义。

### Acceptance criteria

- 派发链路**全异步**：`DispatchStep` 返回 `Promise<DispatchOutcome>` · `Lifecycle.advance()` 为 `Promise` 且其调用点 await · `CliLifecycle.step()`/`#dispatch` 为 async · `Cli.#runWork` 的 `advance()` await
- `execaSync` 在引擎活面**零残留**；`SyncProcess` / `SyncRunner` 的同步签名与类名零残留（构造点 `face/lifecycle.ts:172` · `face/cli.ts:235` 一并退役）
- **无界整取与 fail-open 传承**：异步 `ChildRunner` 仍整取 >1 MiB 输出（`1048577` 字节，尾段 prose 存活）且 fail-open 不抛（非零 child 走其 code、坏命令不抛——坏命令 = spawn 失败：`code: null` · 不抛 · stderr 携 `shortMessage`；`?? 1` 折叠退役后该 pin 的 `code` 期望由 `1` 改为 `null`，pin 的**实质**（不抛 + 有原因文本）不变）——`sync-runner.test.ts` 的四条 D36 pin 改由终止器用例承载、覆盖不丢
- 生产 spawn 选项面 pin：`killDescendants: true` + `forceKillAfterDelay: 5000` + `timeout` 取该 op 的预算键；**`detached` 在引擎活面零命中**（它会关掉 `cleanup`）
- **僵死 child 被真砍**（端到端）：合成 **CPU 静默的挂死 child**（零 CPU 增长 · 不触碰 workspace · 不产出——与 issue #346 现场同形：1h33m+ 无 CPU、无子进程）+ **注入极小时序**（`idleWindowMs` / `sampleIntervalMs`）→ 断言 `status: TIMEOUT` + `cause: "stalled"` + crash record 落盘（含末样本）+ `timeoutCount` 递增
- **超 budget**：注入小 `budgetMs` → `cause: "over-budget"`（源自 `error.timedOut`）
- **合法长任务零误砍**：判官真值表 pin 四态（`progress` / `unknown` / `idled` / `stalled`）；`unknown` 恒不杀；CPU 或 mtime 任一腿读不到 → 不杀；**忙等正例**——进程组 CPU 持续增长的 child → 判 `progress` → **不砍**（把判别力两侧都钉住）
- **词汇单源**：`TerminationCause` 三值 + 组合 `CrashCause`；`engine-timeout` / `engine-over-budget` / `child-signal` 在引擎活面零残留（grep pin）
- **心跳文件**：派发期存在且 tick 覆写（`sampledAt` / `groupCpuMs` / `newestMtimeMs` / `verdict`）；正常完成**删除**；被终止**保留**且末样本并入 crash record；**一次心跳 tick 不得重置 idle 起点**（心跳文件被 §3.3 树腿显式排除——引擎自写不得自证"进展"）
- **终止轮无 `next:` 行**（失败面契约照旧）；CLI 旗标 / 退出码表 0/1/2 / `next:` 字面零变化
- **消费面 skills 零改**（活面零残留断言不覆盖 skill 文本）
- 四键预算常量（implement 6h · review 3h · fix 3h · branch-review 3h）+ `idleWindowMs` 30min + `sampleIntervalMs` 60s 为**代码常量单源**；**零环境变量、零配置 JSON 读取面**；时序参数**可注入**（生产取自常量）
- **父退出连带杀**：父进程被杀时 child 组随 `cleanup` 退出（pin：不设 `detached`，`cleanup` 未被短路）
- 测试面全绿（含 §2.3 的逐条迁移：`FakeSync` 24 处 · `dispatch:` fixture 53 处 · `run.advance()` 91+2 处 · `sync-runner.test.ts` 整体重写）
- 引擎 vitest 全绿 · `pnpm run validate` ALL PASS · cdd-engine changeset **minor** 在册 · 不发布

## Constraints

- **破坏性变更许可**：`DispatchStep` 异步化是 deliberate pin break（P8 §14.3 / D36 同步契约 · 授权来自前提 ①）——不保留旧同步签名，不做双面兼容。
- **零裸函数**：新增物全为类（`Terminator` / `StallJudge` / `TerminationPolicy`）与其类型；模块级导出仅类型 / 数据 / 类。
- **不造轮子（前提 ⑦）**：进程组建、组杀、SIGTERM→SIGKILL 升级、父退出连带杀、墙钟上限**全部交 execa**——引擎不自持任何信号逻辑、不自建第二个定时器、不复活 T26 的 registry/`reapStale`、不自造后代枚举。生产进程库固定 `execa`（`^10.1.1`）。
- **绝不用面向用户的 `detached: true`**：组杀一律走 `killDescendants`（`detached` 会短路 `cleanup`）。此条为硬约束，AC 以"`detached` 活面零命中"把门。
- **单源纪律**：预算/时序常量一处；终止因词汇一处（`session/ledger.ts`）；心跳格式一处。零环境变量、零配置 JSON 面。
- **fail-open 是默认姿态**：信号不可读 → 不杀。宁可漏杀（由人处置），不可误杀（把正在干活的 child 砍掉）。
- **execa 的 best-effort 边界如实记录**：`killDescendants` 不覆盖"自成进程组/会话"的后代；本 phase 不为此自造枚举。
- **失败面冻结**：终止轮不产生 `next:` 行；不给自动重来；不改 `FAILED_STATUS`。
- **D29 黑盒边界**：消费面 skill 文本零改动。
- **历史面不追改**：零残留断言只覆盖活面（引擎 src · 引擎测试 · 模板）；历史 spec/plan/changeset/CHANGELOG 原样保留。

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-10-19 | 初稿——P12 phase-spec：A 组派发链路异步化（`DispatchStep`→`Promise` · `SyncProcess`/`SyncRunner` 退役 · 迁移面逐条列名）+ B 组终止器（stall 判官双信号 fail-open · 采样 60s · idle 30min · 心跳文件 · 四键预算常量 · 组杀与 escalation 全交 execa 的三条硬约束）+ C 组词汇统一与失败面（`TerminationCause` 三词单源 · crash record 扩终止轮 · `timeoutCount` 真递增 · 无 `next:` 照旧）；裁定全承 D52/D53 · parent overall sync 至 v2.56 | Oscar M. · Claude Opus 5（kairos:cdd-design [P12] · 2026-10-19） |
| v0.2 | 2026-10-19 | docs-fix round 1——落实评审 1 blocker / 3 warn / 2 nit：（blocker）§3.3 树腿扫描根消歧为 **repoRoot** 并显式排除 `.git/` 与**心跳文件精确路径**（§3.4 标注交叉引用 · AC 增「一次心跳 tick 不得重置 idle 起点」pin），堵住引擎自写把静默挂死判成进展的漏洞；（warn）AC 端到端僵死 fixture 由「忙等」改正为 **CPU 静默挂死 child**（与 issue #346 同形）并另立**忙等正例**（CPU 增长 → progress → 不砍）· §2.3 登记 corpus 计数 pin 随行重锚（specs 12→13 · 合计 23→24）为已落事实 · §4.1 退役清单补齐第三值 `child-signal`（归并到 `signal`）且 `unknown` 明列保留（AC 词汇单源 grep pin 同步）；（nit）行 pin 校正 `ledger.ts:73`/`74`（OpType/RoundPhase）· `infra/runtime.ts:3-5` · `ledger.ts:155-161`（CrashCause）· `ledger.ts:104`（PROGRESS_COUNTER_ZERO）· 注入缝命名单一化（接口 `ChildRunner` · 生产实现 `Terminator` · 测试替身 `StubRunner`）+ `ChildOutcome` 形状定义（`{code,stdout,stderr,termination}`） | Oscar M. · Claude Opus 5（kairos:cdd-dev [P12] docs-fix round 1 · 2026-10-19） |
| v0.3 | 2026-10-19 | docs-fix round 2——落实评审 2 一 warn / 两 nit：（warn）§2.3 删掉悬空的 **`§3.6` 引用**并明示 pin 去处——`sync-runner.test.ts` 的四条 D36 pin（>1 MiB 整取 1048577 · 尾段 prose 存活于 2 MB 叙事之后 · stderr 同面聚合 1100000 · fail-open 非零 child 走其 code / 坏命令不抛）不随 `SyncRunner` 退役而消失，改由终止器用例同一新文件承载，生产语义由 §3.2 选项面保住（`reject:false` · `stripFinalNewline:false` · 不设/不下调 `maxBuffer` · execa 默认 100 MB · sync/async 共用默认表 `lib/arguments/specific.js:121`）；AC 补「异步 `ChildRunner` 仍整取 >1 MiB 且 fail-open」；（nit）§2.1 行 pin 校正——注入包装 `face/cli.ts:575-579`（`dispatch` 常量 `:564`）· 派发循环 `:617`(`for (;;)`)/`:618`(`peekNext()`)；§3.3 cwd 引改 `face/lifecycle.ts:216-219`（`#sync.run(` 锚点 + cwd 实参）；（nit）§4.1 外部信号按**语义收口**（`res.signal` 为任何信号 · 我方未杀 · 非 `timedOut` → `signal`，SIGTERM/SIGKILL/SIGINT/SIGHUP 一视同仁），`unknown` 明列为**第四支兜底**并给明确生产者，§3.1/§4.2 的「三因」引用同步为「派生面（三因 + `unknown` 兜底）」 | Oscar M. · Claude Opus 5（kairos:cdd-dev [P12] docs-fix round 2 · 2026-10-19） |
| v0.4 | 2026-10-19 | 用户裁定 backfill（in-flight · overall D54）——**`corpus-form-pin.test.ts` 整体退役**，§2.3 相应行改写：语料完整性属引擎流程职责，测试面只校验引擎功能（`Contract.validate` 行为面由 `judge.test.ts` / `doc.test.ts` / `lint.test.ts` 覆盖）；本 phase 两次「注册连带」计数重锚（`c3521ff1` / `bc999471`）所服务的仪式随之消失。§1.2/§4.1 的设计裁定不变 | Oscar M. · Claude Opus 5（kairos:cdd-plan [P12] in-flight user-ruling backfill · 2026-10-19） |
| v0.5 | 2026-10-19 | 设计回填（plan-review-1 F2 漂移 · `backfill-design`）——§3.3 判官形态改写：`StallJudge` 由「`prev` + `sample` + `idleWindowMs` 的纯函数」改为**有状态 · 零 I/O**（自持 `#lastCpuMs` / `#maxMtimeMs` / `#idleSince`，观测入口 `observe(sample, now): StallVerdict`）——原措辞表达不出本节自己的判据（mtime「比**历史最大值**增长」与「`idleSince` 起点」都需要跨调用累加态）；并定义 `Sample = { groupCpuMs: number \| null; newestMtimeMs: number \| null }`（`null` = 腿不可读 · 与 §3.4 心跳记录面同字段名）。四条判据文字与其余各节逐条不变；front-matter `parent-version` 由 v2.56 校正至 **v2.57**（v0.4 的 D54 回填本就属 overall v2.57 变更波次——陈旧声明 pin 正是本 phase 要消灭的漂移类） | Oscar M. · Claude Opus 5（kairos:cdd-plan [P12] design-backfill · 2026-10-19） |
| v0.6 | 2026-10-19 | 设计回填（plan-review-1 F1 漂移 · `backfill-design`）——§3.1 缝的两端形状补齐：**结果面** `ChildOutcome.termination` 由裸 `TerminationCause \| null` 升为值对象 **`Termination = { cause; lastSample }`**（因与证据同行，`termination === null` ⟺ 有正常退出码——终止轮的一切下游判定从此支读，**不从 `code` 反推**：被杀 child 的 `code` 为 `null`）；**入参面**新增 `ChildRun = { command, args, cwd, heartbeatPath, policy }` 并钉死 Two-Path 同源（`CliLifecycle` 由唯一持有的 `scene.workspace` 派生 `cwd`/`heartbeatPath`，`Terminator` 零会话态构造；同一 `run.cwd` 兼作 spawn cwd 与树腿扫描根 ⇒「扫描根 ≡ child 的 cwd」成结构保证）。§3.4 命名 `SampleRecord`（= `Sample` 扩展记录面两字段，一处命名）并明示末样本随因同行、零回读；§4.2 末样本字段改取 `termination.lastSample`；§4.3 补 `status` 的派生规则（`termination !== null` → `TIMEOUT`，无新入参）与 `#dispatch` 的判序必须（`child-exit` 分支须在 `termination` 判定之后）。判据/预算/词汇各节逐条不变 | Oscar M. · Claude Opus 5（kairos:cdd-plan [P12] design-backfill · 2026-10-19） |
| v0.7 | 2026-10-19 | 设计回填（plan-review-3 F1/F2 漂移 · `backfill-design`）——两处spec 自身缺陷：(1) **§3.1 的终止判据改写**——原文「`termination === null` ⟺ 本轮有正常退出码」是**错的**：spawn 失败（坏命令/ENOENT）既无退出码也无终止事件，按原文会被判成终止（`unknown` → `TIMEOUT`），破坏今日「坏命令 → BLOCKED」的 fail-open 面；改为「`termination !== null` ⟺ **本轮被终止**（`timedOut` ∨ 我方 kill ∨ 结果面带信号）」；(2) **`code` 的折叠退役**——`SyncRunner.#collect` 今日的 `exitCode ?? 1` 把「从未启动」与「被杀死」都谎报成 `1`，§3.1 改 pin `code` 取 execa 原值、`CrashRecord.exitCode` 放宽为 `number | null` 且其「143 = SIGTERM 的 shell 约定」注释退役；§4.2 crash record 同步；§2.3 补 `run.advance()` 调用点迁移行（`run.test.ts` 91 处 · `preflight.test.ts:535`/`:540` 2 处）——该块是本次异步化最大的测试面，原表漏列；AC 的 fail-open 行与测试面行同步（坏命令 `code` 期望 `1` → `null`，pin 实质不变） | Oscar M. · Claude Opus 5（kairos:cdd-plan [P12] design-backfill · 2026-10-19） |
