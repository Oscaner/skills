---
title: 引擎文档工具（Engine Doc-Tooling）— P13 设计：child dispatch 终止面跟进（stdin 闭合 + 终止 ⊥ 结论 + idle 可见性）
doc-type: phase-spec
version: v0.1
date: 2026-10-19
status: Draft
author: Oscar M. · Claude Opus 5（kairos:cdd-design [P13] 会话 · 用户逐轮裁定 Q1–Q11 · 2026-10-19）
parent-program: 2026-10-10-engine-doc-tooling-overall.md
parent-version: v2.60
depends-on: P12（Done · v0.8 · hard——P12 终止面落地后的四个跟进缺陷 · overall 依赖图 D55）
---

## Design

本 phase 承接 P12 收口后的跟进（2026-10-19 cdd-design [P13] 会话 · 注册 D55 · grilling 全裁定 D56），治 issue #363 汇总的四个缺陷。四者同在 child **spawn 与终止轮收尾**面，共享一个模型缺口：P12 把「child 被终止」和「这一轮有没有结论」当成了同一件事。

**四个缺陷（#363）**。① child 的 stdin 是一条无人关闭的管道，pi 在非 TTY 下读 stdin 到 EOF 才开工，child 永久阻塞，只剩 30 分钟 stall 窗口兜底；② TIMEOUT 轮的摘要行写 `blocker: 0`，而 child 已写下的 handoff 含真实 blocker，且该轮不被记为结论，后续 `cdd fix --reviews` 被拒；③ TIMEOUT 轮的轮号不推进，重跑覆盖上一轮产物；④ 零活动的 child 要等满固定的 30 分钟窗口才被检出，`idled` 判定只写心跳文件、对消费方不可见。外加一例 stdin 解释不了的现象：handoff 已写而 child 不退出。

**设计主轴**：终止是一条**事实**，结论由 **handoff 推出**——与 D27「判定面 ⊥ 输入面」同款正交。缺陷②③由这一个模型解决，不各打补丁；缺陷①与「不退出」属进程生命周期面，缺陷④收窄为终止时的诊断可见性。

### 1. 目标与边界

#### 1.1 设计输入与授权

- 输入：overall D55（注册）与 D56（Q1–Q11 全裁定）；P12 spec v0.8 的终止面（`face/termination.ts` 的 `Terminator` / `StallJudge` / `Sampler` / `SamplingLoop`）。
- 授权：六前提 + 第七前提「不造轮子，优先第三方 pkg」整评；破坏性变更许可，不保守、不打补丁。
- 尺寸 `fit`，单 phase-spec，无内部拆 phase。

#### 1.2 判定基线（源码已确认 · 未经实机复现）

- spawn 面唯一：`Terminator.run` 的 `execa` 调用（`face/termination.ts`），三个 harness（claude / cursor / pi）共用，不按 harness 分支；该调用未设 `stdin`。
- execa 的 `await subprocess` 等的是 stdout / stderr 流关闭，不止进程退出；孙进程继承了 fd 1 或 2 且比直接子进程活得久时，`await` 在 child 退出后仍然挂着。execa 不会在直接子进程退出时杀进程组。
- 终止轮在 `#dispatch` 的终止分支直接走 `#reject`：`#reconstruct` 不执行，child 已写的草稿不被读取、校验或持久化；`blocker:` 计数取 `(outcome.findings ?? [])` 的默认空数组，故恒为 0；round 因 `recordRound` 被 `!blocked` 门跳过而不记账，`roundCount(review)` 仍为 0，`lineRoute` 回到 review，`fix` 被门禁拒绝。
- 引擎无 move-aside、备份或重命名逻辑；同名产物（handoff、report、crash record）被重跑覆盖。
- 判官只认进程组 CPU 与 tree mtime：CPU 在涨即重置 idle 时钟；handoff 写入本身是一次 mtime 前进，同样重置。
- 待 plan 阶段实机确认（不阻塞设计）：孙进程占管道的真实复现；`ps -g` 在 macOS / Linux 上是否覆盖后代进程。

#### 1.3 保留面（冻结）

- D53 的 T26 双信号（进程组 CPU + workspace mtime）及其 fail-open 语义；idle 30 分钟、采样 60 秒、四键预算常量（implement 6h · review 3h · fix 3h · branch-review 3h）全部不变。
- **窗口不可配置**：零新旗标、零环境变量、零配置 JSON（D53 Q2 坚守）。
- 轮号语义（D28：`rounds` 记周期号）；CLI 旗标面与退出码表 0/1/2 的语义；`next:` 字面形态。
- handoff 写入重置 idle 时钟的行为不改——handoff 是真实进度。

### 2. A 组 · child 进程生命周期

#### 2.1 stdin 闭合

- `Terminator.run` 的 execa 选项增 `stdin: 'ignore'`，对所有 harness 统一生效：child 的 fd 0 连 `/dev/null`，读到即 EOF，行为确定。
- 不取 `'inherit'`：其行为取决于调用方的 stdin，后台派发下可能仍挂住，也可能把终端输入泄漏给 child。
- 该选项是 execa 原生能力，引擎不自研任何 stdin 处理。

#### 2.2 直接子进程退出后的进程组回收

- 直接子进程退出后，引擎回收其所在进程组，使遗留的孙进程不再占着 stdout / stderr 管道拖住 `await`。这些孙进程按定义已是孤儿，回收无副作用。
- 机制留 plan 阶段确认：优先 execa 现成能力；确无现成能力时才落一次对进程组的 kill。选型的判据是第七前提（不造轮子）与既有 `killDescendants` 语义不冲突（不得引入 `detached`，它会关掉 execa 的 `cleanup`）。
- 回收不改变轮的归因：child 自己退出的轮仍是「自行结束」，不产生 termination 事实。

### 3. B 组 · 终止 ⊥ 结论

#### 3.1 模型

- 终止轮不再默认走失败面。引擎对被终止的 **review 面**轮先读 child 的 handoff 草稿，由草稿推出结论；终止原因作为独立事实并行保留（stderr 与 crash record）。
- review 面指所有 review 动词的轮（spec、plan、wave、branch 线，其载体均为 findings 载体）；implement 与 fix 属 work 面，不适用升格。

#### 3.2 升格条件

同时满足下列条件，终止轮**升格**为有结论的轮：

- 轮属 review 面；
- 草稿存在，且通过载体 schema 校验；
- 草稿含至少一条 finding。

理由：被杀的 child 写出的「无 findings」不可信（可能未审完即被终止），而带 findings 的草稿是可执行的证据，不论审得完整与否。

#### 3.3 升格轮的收口

- 走与正常 review 轮相同的读回、持久化、`recordRound`、结论派生（`conclusionOf`），摘要行 `blocker:` 为 handoff 的真实计数，`next:` 照常给出（通常是 fix）；后续 `cdd fix --reviews` 因此被接受，消费方不必重跑整轮。
- 退出码 0。
- stderr 输出一条 `CDD_WARN`：说明终止原因，并说明 findings 自 handoff 草稿恢复。
- crash record 照写，带末样本 `lastSample`、终止原因与「已升格」标记。
- `timeoutCount` 照常递增：它统计终止事件，与轮次结论正交；递增的判据由「status 词为 TIMEOUT」改为「存在 termination 事实」，否则升格轮会漏计。

#### 3.4 不升格的终止轮

- implement 与 fix 轮；review 面草稿缺失、非法或无 findings：保持 TIMEOUT 失败面——无 `next:`、不记账、退出码 1，行为与 P12 一致。
- 此类轮不推进轮号，重跑覆盖同名产物（含 crash record），**接受**：这些轮没有可用产物，唯一损失是上一次的 crash record，追溯看 `timeoutCount` 与 stderr。
- 不采用「任何终止都推进轮号」：会让 ledger 出现无结论的空轮，污染 `rounds` 的周期号语义（D28）。不采用 crash record 按尝试次数命名：为一份诊断文件多一套命名规则。
- 这是对 D53 Q12「终止轮无 `next:`」的**有意收窄**：仅升格轮例外。

### 4. C 组 · 摘要行与 idle 可见性

#### 4.1 失败状态摘要行去伪值

- TIMEOUT 与 BLOCKED 的摘要行不输出 `blocker:` 键：`0` 读作「没发现问题」，实为「不知道」。
- `handoff:` 一栏改指 crash record（失败轮没有可用 handoff，规范路径上并无文件）。
- 键集来自 `words.capsuleKeys()` 单源，按状态分键集在该处表达，不在渲染点另加特例。

#### 4.2 idle 可见性

- 仅在**终止时**把 idle 时长与末样本写入 TIMEOUT 的 stderr 与 crash record。
- 不加中途 stderr 进度行：skill 约定后台派发、等通知、不轮询，没有程序化消费方，中途信号只是稳定噪声。

#### 4.3 已知边界（写明，不修）

- **不加第二个更短窗口**：它意味着判官多一个常量、一条状态分支和一张真值表；零活动的头号成因是 stdin 阻塞，由 §2.1 消除；「启动后纯思考、零 CPU、零写文件」的 child 是否合法至今无裁定，更短窗口会引入误杀。
- **CPU 空转盲区**：阻塞在 stdin 上、但运行时空转（GC、定时器、轮询的孙进程）的 child，进程组 CPU 持续前进，不会被判 stalled。改信号会触动 D53 的 T26 双信号，不在本 phase。
- 判官两腿任一不可读时每个 tick 都是 `unknown`，stall 杀永不触发，只剩预算上限兜底（fail-open 的固有代价）。

### Acceptance criteria

- `Terminator.run` 的 execa 调用带 `stdin: 'ignore'`；行为 pin：读 stdin 至 EOF 的 child 在非 TTY 下正常退出，不再被挂到 stall 窗口。
- 孙进程占 stdout / stderr 管道时，`await` 在直接子进程退出后及时返回（端到端 fixture，孙进程被回收）；引擎活面 `detached` 仍零命中。
- review 面被终止且草稿合法含 findings → 升格：`recordRound` 已记，摘要 `blocker:` 为 handoff 真实计数，退出码 0，stderr 有 `CDD_WARN`，`timeoutCount` 递增，crash record 带升格标记，`next:` 给出，随后 `cdd fix --reviews` 被接受。
- implement / fix 轮被终止，或 review 面草稿缺失 / 非法 / 无 findings → TIMEOUT 失败面不变：无 `next:`、不记账、退出码 1。
- TIMEOUT 与 BLOCKED 摘要行零 `blocker:` 键，`handoff:` 指 crash record。
- 终止时 crash record 与 stderr 带 idle 时长与末样本。
- D53 常量（idle 30min · 采样 60s · 四键预算）零变；活面无新旗标、环境变量或配置 JSON。
- 翻新 pin：`cli.test.ts` 终止轮 outcome 严格等于 `{status:'TIMEOUT'}` 的三处断言；`face.test.ts` 的 capsule 断言；`next.test.ts` 的 TIMEOUT 路由断言；`timeoutCount` 的递增判据改为 termination 事实。
- 引擎 vitest 全绿；`pnpm run validate` ALL PASS；changeset cdd-engine **minor**；不发布。

## Constraints

- 六前提 + 第七前提整评：不保守、不打补丁；OOP 统一、零裸函数；避免声明再抄（摘要键集单源 `words.capsuleKeys()`）；死码清理；消费者心智负担优先（零新旗标）；优先第三方现成能力。
- 终止与结论正交：终止是一条事实，结论只由 handoff 推出，不由终止状态词推出（承 D27）。
- 升格只限 review 面，且只认「合法且含 findings」的草稿；被终止的 child 的「无 findings」一律不信。
- 窗口、预算、采样常量沿用 P12（D53）：代码常量单源，零环境变量，零配置 JSON。
- #363 已知的「handoff 写完 child 不退出」成因以源码为据归于两处（孙进程占管道 · 判官信号），本 phase 修前者；后者属已知边界，不改信号。
- 不发布：changeset 收尾到可发布态即止；版本应用 / tag / publish 为独立动作。
- 本设计文档为内部 spec，中文主源（Strategy B）。

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-10-19 | 初稿——P13 phase-spec：A 组 child 进程生命周期（stdin `ignore` 统一 · 直接子进程退出后进程组回收）+ B 组终止 ⊥ 结论（review 面升格条件 · 升格轮收口 · 不升格轮保持失败面 · 轮号与产物覆盖接受）+ C 组摘要行去伪值与终止时 idle 可见性 + 已知边界（不加第二窗口 · CPU 空转盲区）；D53 Q12 有意收窄到非升格轮；changeset minor。 | Oscar M. · Claude Opus 5（kairos:cdd-design [P13]） |
