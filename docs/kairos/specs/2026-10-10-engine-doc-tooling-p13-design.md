---
title: 引擎文档工具（Engine Doc-Tooling）— P13 设计：child dispatch 终止面跟进（stdin 闭合 + 终止 ⊥ 结论 + idle 可见性）
doc-type: phase-spec
version: v0.4
date: 2026-10-19
slug: 2026-10-10-engine-doc-tooling-p13
program: 2026-10-10-engine-doc-tooling
status: Draft
author: Oscar M. · Claude Opus 5（kairos:cdd-design [P13] 会话 · 用户逐轮裁定 Q1–Q11 · 2026-10-19）
parent-version: v2.62
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

判定 pin 表（claim → path:line + 断言面，均已对源码确认）：

| 断言（claim） | pin（path:line） | 断言面（assertion face） |
| --- | --- | --- |
| spawn 面唯一，三 harness 共用，未设 `stdin` | `face/termination.ts:467-473` | `execa(...)` 选项集无 `stdin` 键 |
| 终止派生为 TIMEOUT | `face/lifecycle.ts:521` | `death.termination === null ? 'BLOCKED' : 'TIMEOUT'` |
| 失败轮被 `!blocked` 门跳过 `recordRound` | `session/run.ts:436` | `outcome.status` 为 `BLOCKED` 或 `TIMEOUT` 时 `blocked=true` |
| 失败轮 `blocker:` 恒 `0` | `face/__tests__/face.test.ts:199` | `emit('TIMEOUT','0',…)` → `status: TIMEOUT · blocker: 0 · handoff: /h.json` |
| `timeoutCount` 键在 `lastStatus === 'TIMEOUT'` | `face/cli.ts:653-656` | `if (lastStatus === 'TIMEOUT') scene.ledger.incrementTimeoutCount()` |
| 终止轮 outcome 严格等于 `{status:'TIMEOUT'}` | `face/__tests__/cli.test.ts:4500` · `:4543` | `expect(outcome).toEqual({ status: 'TIMEOUT' })`（两处） |
| no-host BLOCKED 在任何记录前返回 | `face/lifecycle.ts:150-154` | `return { status: 'BLOCKED' }`（无 crash record） |
| crash record schema 家 | `session/ledger.ts:192-213` | `interface CrashRecord`（含既有 `lastSample`） |

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
- plan 时约束：回收的 kill 只作用于**仍归引擎所有的进程组**（spawn 时由 `killDescendants` 建立的那个组），不得因 pid/pgid 复用误伤他组；回收的「无副作用」由测试 pin——复用既有端到端 fixture，断言孙进程被回收且无旁观进程受损。

### 3. B 组 · 终止 ⊥ 结论

#### 3.1 模型

- 终止轮不再默认走失败面。引擎对被终止的 **review 面**轮先读 child 的 handoff 草稿，由草稿推出结论；终止原因作为独立事实并行保留（stderr 与 crash record）。
- review 面指所有 review 动词的轮（spec、plan、wave、branch 线，其载体均为 findings 载体）；implement 与 fix 属 work 面，不适用升格。

#### 3.2 升格条件

同时满足下列条件，终止轮**升格**为有结论的轮：

- 轮属 review 面；
- 草稿存在，且通过载体 schema 校验；
- 草稿含至少一条 finding。
- 草稿被截断（child 在被终止时正写至一半）按**非法草稿**处理：它过不了载体 schema 校验，因而不满足第二条、不升格。

理由：被杀的 child 写出的「无 findings」不可信（可能未审完即被终止），而带 findings 的草稿是可执行的证据，不论审得完整与否。

#### 3.3 升格轮的收口

- 走与正常 review 轮相同的读回、持久化、`recordRound`、结论派生（`conclusionOf`），摘要行 `blocker:` 为 handoff 的真实计数，`next:` 照常给出（通常是 fix）；后续 `cdd fix --reviews` 因此被接受，消费方不必重跑整轮。
- 退出码 0。
- stderr 输出一条 `CDD_WARN`：说明终止原因，并说明 findings 自 handoff 草稿恢复。
- crash record 照写：既有末样本 `lastSample`、终止原因 `cause` 之外，另加两个**新字段** `promoted: true`（已升格标记）与 `idleMs`（终止时 idle 时长）。crash record 的 schema 家是 `session/ledger.ts:192` 的 `CrashRecord` 接口（`lastSample` 为该接口既有字段，非新增）。
- `timeoutCount` 照常递增：它统计终止事件，与轮次结论正交。递增判据由「status 词为 TIMEOUT」改为「存在 termination 事实」——termination 事实的**唯一承载**是 `DispatchOutcome`（`session/run.ts:97`）新增的可选 `termination` 字段，由 `face/lifecycle.ts:521` 的单一派生点填入；`face/cli.ts:653-656` 改读该字段递增，否则升格轮会漏计（升格轮的 status 由 findings 推出，不再是 TIMEOUT 词）。升格轮结论是 findings 推出的**非失败**状态，故其 carrier 仍过 `session/run.ts:436` 的非失败门、照常进入 `#bookkeep` 记账，`termination` 事实随 outcome 并行保留。

#### 3.4 不升格的终止轮

- implement 与 fix 轮；review 面草稿缺失、非法或无 findings：保持 TIMEOUT 失败面——无 `next:`、不记账、退出码 1，行为与 P12 一致。
- 此类轮不推进轮号，重跑覆盖同名产物（含 crash record），**接受**：这些轮没有可用产物，唯一损失是上一次的 crash record，追溯看 `timeoutCount` 与 stderr。
- 不采用「任何终止都推进轮号」：会让 ledger 出现无结论的空轮，污染 `rounds` 的周期号语义（D28）。不采用 crash record 按尝试次数命名：为一份诊断文件多一套命名规则。
- 这是对 D53 Q12「终止轮无 `next:`」的**有意收窄**：仅升格轮例外。

### 4. C 组 · 摘要行与 idle 可见性

#### 4.1 失败状态摘要行去伪值

- TIMEOUT 与 BLOCKED 的摘要行**不输出** `blocker:` 键：`0` 读作「没发现问题」，实为「不知道」。
- `handoff:` 一栏**仅在该轮写了 crash record 时才输出**，且指向 crash record（失败轮没有可用 handoff，规范路径上并无文件）；未写 crash record 的失败轮省略该栏，避免悬空路径——`face/lifecycle.ts:150-154` 的 no-host BLOCKED 在任何记录写入前即返回，属此类，故其失败 capsule 不带 `handoff:` 栏。
- 键集单源改为**按状态分键集**：`words.capsuleKeys(status)`（`face/words.ts:238`）按状态返回键集，渲染点不自加特例。既有 pin `face/__tests__/face.test.ts:32`（无条件键表）、`:73`（`keysOf` 等于 `capsuleKeys()`）、`:221`（`capsuleKeys()` + `next:` 字面序）与 `:199`（失败 capsule 现状）随之翻新为按状态断言。

#### 4.2 idle 可见性

- 仅在**终止时**把 idle 时长（crash record 新字段 `idleMs`）与末样本（既有 `lastSample`）写入 TIMEOUT 的 stderr 与 crash record。
- 不加中途 stderr 进度行：skill 约定后台派发、等通知、不轮询，没有程序化消费方，中途信号只是稳定噪声。

#### 4.3 已知边界（写明，不修）

- **不加第二个更短窗口**：它意味着判官多一个常量、一条状态分支和一张真值表；零活动的头号成因是 stdin 阻塞，由 §2.1 消除；「启动后纯思考、零 CPU、零写文件」的 child 是否合法至今无裁定，更短窗口会引入误杀。
- **CPU 空转盲区**：阻塞在 stdin 上、但运行时空转（GC、定时器、轮询的孙进程）的 child，进程组 CPU 持续前进，不会被判 stalled。改信号会触动 D53 的 T26 双信号，不在本 phase。
- 判官两腿任一不可读时每个 tick 都是 `unknown`，stall 杀永不触发，只剩预算上限兜底（fail-open 的固有代价）。

### 5. D 组 · handoff 载体 face 命名

- `HandoffFamily.schema` 选的是 child 草稿的**数据形状**：`findings` = child 写发现列表、不写 `status`，结论由引擎 `rollup(findings)` 汇总（review 与改文档的 fix 轮）；原 `work` = child 交付产物并自己声明 `status`（APPROVED / BLOCKED）（implement 与改代码的 fix 轮）。
- 原名 `work` 描述场景而非形状（review 发现问题同样是在工作），与 `findings` 并列时区分不出两者。**改名为 `delivery`**，`findings` 不变（D57）。
- 破坏性改名，范围：`HandoffSchemaFace` 取值 · `CARRIER_WORK` / `WorkCarrier` · `buildHandoff` 的重载 · `HANDOFF_FAMILIES` 三处 `schema: "work"` · `handoffFaceOf` 调用点 · 相关测试。非 face 语义的 `work` 词（如 `WorkInit`、变量名）逐处核对，不全局替换。
- `HandoffFamily.schema` 的注释按载荷形状重写，并清除其中的 spec 章节号与重构叙述（程序历史不进代码注释）。
- 不改 CLI 面、不改磁盘上的 handoff 文件格式（face 名不落盘）；changeset 仍 cdd-engine **minor**。

### Acceptance criteria

- `Terminator.run` 的 execa 调用带 `stdin: 'ignore'`；行为 pin：读 stdin 至 EOF 的 child 在非 TTY 下正常退出，不再被挂到 stall 窗口。
- 孙进程占 stdout / stderr 管道时，`await` 在直接子进程退出后及时返回（端到端 fixture，孙进程被回收）；引擎活面无 `detached:` **选项键**（源码扫描 `detached:` 选项键形态、注释不计——`face/__tests__/cli.test.ts:4855` 的 `engineSourceTexts()` 扫描即该守卫；`termination.ts:440` 的注释词不触发）。
- review 面被终止且草稿合法含 findings → 升格：`recordRound` 已记（升格轮 status 由 findings 推出、非失败，carrier 照进 `#bookkeep`），摘要 `blocker:` 为 handoff 真实计数，退出码 0，stderr 有 `CDD_WARN`，`timeoutCount` 由 `DispatchOutcome.termination` 非空递增，crash record 带 `promoted: true` 与 `idleMs`，`next:` 给出，随后 `cdd fix --reviews` 被接受。
- implement / fix 轮被终止，或 review 面草稿缺失 / 非法 / 无 findings → TIMEOUT 失败面不变：无 `next:`、不记账、退出码 1。
- TIMEOUT 与 BLOCKED 摘要行零 `blocker:` 键；`handoff:` 仅在该轮写了 crash record 时输出并指向之。
- 终止时 crash record 与 stderr 带 idle 时长（`idleMs`）与末样本（`lastSample`）；crash record 另带 `promoted`。
- D53 常量（idle 30min · 采样 60s · 四键预算）零变；活面无新旗标、环境变量或配置 JSON。
- 翻新 pin：`cli.test.ts:4500`、`:4543`（终止轮 outcome 严格等于 `{status:'TIMEOUT'}`——实为两处，非三处）与 `:2259`（失败面测试：`:2272` 的 stdout `toContain('status: TIMEOUT')` 与 `timeoutCount`——注入式 dispatch 须带 `termination` 事实以适配新递增判据）；`face.test.ts:32`、`:73`、`:221`（键集按状态）与 `:199`（失败 capsule 去 `blocker:`）；`next.test.ts` 的 TIMEOUT 路由断言；`timeoutCount` 的递增判据改为「`DispatchOutcome.termination` 非空」。
- 载体 face `work` 已改名 `delivery`：引擎活面零 `"work"` face 字面量残留（`WorkInit` 等非 face 语义词除外并逐处核对）；`HandoffFamily.schema` 注释按载荷形状重写、无 spec 章节号；引擎 vitest 全绿。
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
| v0.2 | 2026-10-19 | docs-fix round 1（spec-review-1 全裁定落地）：§1.2 补判定 pin 表；§2.2 加进程组回收的 plan 约束与测试 pin；§3.2 明确截断草稿=非法；§3.3 命名 termination 事实的承载（`DispatchOutcome.termination`）、crash record 新字段 `promoted`/`idleMs` 与 schema 家、升格轮记账路径；§4.1 失败 capsule 按状态键集（`capsuleKeys(status)`）与条件 `handoff:` 栏；§4.2 命名 `idleMs`；验收面明确 `detached:` 选项键守卫与 pin 行号。 | Oscar M. · Claude Opus 5（kairos:cdd-fix [P13]） |
| v0.3 | 2026-10-19 | 开发观测回填（D57 · cdd-dev [P13] wave 3,4 在飞时）：新增 §5 D 组 handoff 载体 face 命名（`work` → `delivery`）与验收条；parent-version 同步 v2.61。 | Oscar M. · Claude Opus 5（kairos:cdd-dev [P13]） |
| v0.4 | 2026-10-19 | closeout（cdd-close）——P13 全链闭合登记：四波实现链全绿（W1={1,2} → W2={3,4} → W3={5} → W4={6}；四波各经一轮 fix 收口——W1 `accbc782` · W2 `fe1f807e` · W3 `cd3a348a` · W4 `e787a3b4`） · 分支终审 → 分支 fix 闭环（branch-review-1 REVIEW_FIX（2 nit）→ branch-fix-1 `006caf19`） · 编排器回填（plan-review 2 轮 + D57 face 改名回填 `4c364011`） · 验收：`pnpm run validate` exit 0（cdd-engine 780/780 · kairos 83/83 · root 10/10 · typecheck ×3 · emit-check fresh · version-sync kairos 1.1.2 · cdd-engine 3.0.1 · 零裸函数）· changeset cdd-engine minor pending · 不发布 · **未验证面（如实记录）**：真实 pi/claude/cursor child 上的 stdin 阻塞与终止轮升格全流程未做实机验证（测试层 fixture 已绿） · 进程组回收在「无孙进程退出」下依赖 pgid 复用窗口极小的假设，已在 `termination.ts` 注释中如实限定，非已证明安全 · 父 overall → v2.62（P13 行 Done · `parent-version` 随之 v2.61 → v2.62） | Oscar M. · Claude Opus 5（kairos:cdd-close · closeout-backfill · 2026-10-19） |
