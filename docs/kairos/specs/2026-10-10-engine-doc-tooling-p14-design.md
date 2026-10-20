---
title: 引擎文档工具（Engine Doc-Tooling）— P14 设计：one-shot CDD child 同步收工契约（handoff-absent + contractViolationCount）
doc-type: phase-spec
version: v0.3
date: 2026-10-20
status: Draft
author: Oscar M. · Claude（kairos:cdd-design [P14] 会话 · 用户七前提 mandate · grilling settled · 2026-10-20）
parent-program: 2026-10-10-engine-doc-tooling-overall.md
parent-version: v2.64
depends-on: P13（Done · v0.4 · hard——P13 终止面落地后的合作式提前退 · overall 依赖图 D58）
---

## Design

本 phase 承接 P13 收口后的跟进（2026-10-20 cdd-design [P14] 会话 · 注册 D58 · grilling settled），治 issue #368。现场不是 stdin 挂死（那是 #363/P13），而是 **one-shot CDD child 合作式提前退**：`pi -p` child 按 pi-background-tasks 默认契约在 `bg_run`/`bg_delegate` 后结束回合等 follow-up wake → 进程已退出 → 通知无处可落 → handoff 未写 → 引擎按 round 结束判缺稿 → `contract-violation`；重跑撞 dirty-tree；`contractViolationCount` 不涨。

**根因重分类（用户裁定）**。主因 = child + 宿主「end the turn · 等 wake」契约与 CDD `-p` one-shot **叠死**；引擎缺稿检测为次要/正确；脏树恢复与计数缺口为下游。治本不是「引擎多等 nested」，而是 **同步收工契约**：引擎派给 child 的契约/提示面硬钉——写出 handoff 前禁止 yield 式 bg；嵌套活同回合同步做完。

**设计主轴**：消费者只感受 implement/review/fix 能收口（系统内部事实，不是消费禁令）；机器面把「exit 0 + 草稿根本没写」从裸 `contract-violation` 拆出更具体的 `handoff-absent`，并让契约违约计数真递增；脏树恢复归编排器，引擎只把报错说清楚。

### 1. 目标与边界

#### 1.1 设计输入与授权

- 输入：overall D58（注册裁定）；issue #368 与调查评论；P13 Design Done（serial-phase 过）；源码面 `face/lifecycle.ts` 的 `#reconstruct`/`#reject`/`#writeCrash`、`session/ledger.ts` 的 `CrashCause`/`contractViolationCount`/`incrementTimeoutCount`、`render/templates.ts` 的派发提示面、`session/preflight.ts` + `face/words.ts` 的 dirty-tree 文案。
- 授权：七前提整评（破坏性 OK · OOP/零裸函数 · 无声明再抄 · 高内聚低耦合 · 消费者心智负担 · 最大收敛简化 · 不造轮子）；破坏性变更许可，不保守、不打补丁。
- 尺寸 `fit`，单 phase-spec，无内部拆 phase。

#### 1.2 判定基线（源码已确认）

- child 正常退出后唯一读回点是 `#reconstruct`：缺稿 → `#reject(..., defaults)`，默认 `exitCode: 0`、`cause: "contract-violation"`（`face/lifecycle.ts` 缺稿分支与 `#reject` 默认参）。
- `#reject` 写 crash record + `CDD_BLOCKED`，返回 `BLOCKED`（无 termination）或 `TIMEOUT`（有 termination）；**不**递增任何 progress 计数。
- `CrashCause` 现词表：`TerminationCause | "child-exit" | "contract-violation" | "unknown"`——无 `handoff-absent`（`session/ledger.ts`）。
- `contractViolationCount` 在 `PROGRESS_COUNTER_ZERO` / `ProgressData` 已声明，**零生产写入点**；唯一对称写点是 `incrementTimeoutCount()`，由 CLI 在 `step.termination !== undefined` 时调用（`face/cli.ts`）。
- dirty-tree 硬门在 `PreFlight.vet` 最先跑，文案现为「commit or discard your changes, then re-run the same command」——未区分「编排器恢复 / 引擎不自动清脏」（`session/preflight.ts` · `face/words.ts`）。
- 派发提示面单源：`TemplateAssembler` + `TEMPLATE_PROMPT`（`render/templates.ts`）；implement/fix/review（及 docs-fix）shell 经同一渲染器；现无「禁止 yield 式 bg / 同步收工」硬句；固定契约经 `FRAME_ITEMS` / `LICENSE_ITEMS` / `CLAUSES` 注入。

判定 pin 表（claim → path:line + 断言面）：

| 断言（claim） | pin（path:line） | 断言面（assertion face） |
| --- | --- | --- |
| 缺稿走 `#reject` 默认 `contract-violation` | `face/lifecycle.ts` 缺稿分支 → `#reject` 默认参 | `draftRead.kind === "missing"` → `#reject`；默认 `cause: "contract-violation"` · `exitCode: 0` |
| 畸形 JSON 与 schema 违约同走 `#reject` 默认因 | `face/lifecycle.ts` malformed / `violations` 分支 | 两分支均未覆盖 `cause`，落入默认 `contract-violation` |
| `CrashCause` 无 `handoff-absent` | `session/ledger.ts` `CrashCause` | 联合类型字面量集合 |
| `contractViolationCount` 零生产写入 | `session/ledger.ts` `incrementTimeoutCount` 邻域 | 仅有 timeout 递增方法；无 contract 对称写点 |
| TIMEOUT 计数由 termination 事实驱动 | `face/cli.ts` termination → `incrementTimeoutCount` | `step.termination !== undefined` 才递增 |
| dirty-tree 文案未指编排器 | `face/words.ts` `preflight.dirtyTree` | 字面量「commit or discard…」 |
| 提示面无同步收工硬句 | `render/templates.ts` `FRAME_ITEMS` / `LICENSE_ITEMS` / shells | 源扫描无 `bg_run`/`bg_delegate`/同步收工禁令 |

#### 1.3 保留面（冻结）

- P13 终止面：stdin `ignore`、进程组回收、review 终止升格、`DispatchOutcome.termination`、失败 capsule 按状态键集、idle 可见性——本 phase 零改其语义。
- TIMEOUT / `timeoutCount` 语义：仍只由 termination 事实递增；不与契约违约混计。
- dirty-tree **门**本身：仍硬拒绝脏树派发；引擎不 stash、不临时 commit、不对脏树放行 resume。
- CLI 旗标面、退出码表 0/1/2、`next:` 字面形态、消费面 skills 文案——零破；禁令不进消费者可见 skill 文本。
- 宿主 wake / bg 生命周期（Claude Code「Background tasks at exit」、pi-background-tasks 默认 tip）——本 phase 不重造宿主面。

#### 1.4 Non-goals

- 引擎多等 nested background work（把 one-shot 伪装成长会话）。
- 「允许 bg 但禁止 yield」细粒度策略（主门是同步收工硬句，不靠拆工具当主门）。
- 宿主 wake 生命周重做；或换 RPC / 长会话 spawn 作本 phase 主路径。
- 给消费者看的禁令文案（消费面 skills 零改）。
- 法医式证明「确实做过 yield / 未完成 bg」才归因——机器因只认 exit 0 + 缺合法稿。

### 2. A 组 · 同步收工契约（提示/契约面）

#### 2.1 硬句落点

- **单源硬钉**在引擎派给 child 的契约/提示面（`render/templates.ts` 的固定前缀 / discipline clauses / 等价单源），**不是**拆宿主工具当主门。
- **implement / review / fix 三腿同一句**（含走同一提示组装的 docs-fix / branch 线若共享该壳——以「所有会写 handoff 的 one-shot 派发」为准，禁止只钉 implement）：
  - 写出 handoff 草稿之前，禁止 `bg_run` / `bg_delegate`（及同语义）「结束回合、等通知再续」路径；
  - 嵌套活（依赖安装、code-review 子派发等）必须在**同一进程回合内同步做完**，再写 handoff、再收工；
  - 做了算违约——引擎侧以缺合法 handoff / 契约读回失败收口，不另开「bg 违规」法医通道。
- 文案要对 **agent child** 可执行，短、硬、无程序史；**不**复制进消费面 skills。
- **英文候选硬句**（plan 拥有最终措辞；必达 token：`bg_run` / `bg_delegate`、写出 handoff 前禁止 yield 式结束回合、嵌套活同回合同步完成）：
  > Finish nested work in this same turn before writing the handoff. Do not `bg_run` / `bg_delegate` (or equivalent yield-and-wait paths) before the handoff draft is written — nested work must complete synchronously in this process turn, then write the handoff and finish.

#### 2.2 形态选择（设计裁定）

- 优先落在既有 `CLAUSES` + `LICENSE_ITEMS`（或 `FRAME_ITEMS`）单源，使三腿 byte-identical 共享，避免 per-shell 再抄（七前提：无声明再抄 · 高内聚）。
- 若一句无法干净挂入既有 clause 槽，允许新增一条 clause 键并挂进共享 license 列表——仍保持单源；禁止在 implement/fix/review 三处 shell 各写一份长文。
- 不把「禁令」做成可配置旗标或环境变量（消费者心智负担；与 P13 窗口零配置同型）。

### 3. B 组 · 机器因 `handoff-absent` 与契约计数

#### 3.1 归因拆分

| 现场 | `CrashCause` | 计数 |
| --- | --- | --- |
| exit 0 + 草稿**根本没写**（missing） | **`handoff-absent`**（新） | `contractViolationCount += 1` |
| exit 0 + 草稿畸形 JSON / 载体 schema 违约 | `contract-violation`（保留） | `contractViolationCount += 1` |
| 非零退出 | `child-exit`（保留） | 不走契约计数 |
| 终止事实（stalled / over-budget / signal / …） | 既有 termination 因 | `timeoutCount += 1`（语义零变） |

- **不**要求证明 yield / 未完成 bg：缺稿是可观察事实；yield 只是 #368 的解释，不是机器谓词。
- 缺稿分支调用 `#reject` 时必须**显式**传入 `cause: "handoff-absent"`，不得再吃默认 `contract-violation`。
- 畸形 / schema 分支保持默认或显式 `contract-violation`——词义仍是「有稿但不合格」。
- 扩展 `CrashCause` 时**同步改写**其 JSDoc（`session/ledger.ts`）：`handoff-absent` = 缺稿（草稿根本没写）；`contract-violation` = 有稿但不合格（畸形 JSON / schema）；与上表一致，禁止继续把「无稿或 schema 违约」一并归在 `contract-violation`。

#### 3.2 计数写点

- 在 `Ledger` 增对称写点（命名与 `incrementTimeoutCount` 同族，例如 `incrementContractViolationCount`）——**唯一**生产写入 `contractViolationCount` 的方法；禁止散落 `data.contractViolationCount += 1`。
- **唯一记账缝裁定**：现有 `DispatchOutcome` 仅有 `status` + 可选 `termination`，**无** `cause` 字段——CLI 收口若只看 `status === "BLOCKED"` 会误计无 crash-cause 的 BLOCKED（如 host 未检出）以及 evidence-gate 改写的 BLOCKED，无法与 TIMEOUT（靠 `termination` 观察）对称。裁定优先落点：在 `#reject` / `#writeCrash` 内，当写入的 crash `cause ∈ {handoff-absent, contract-violation}` 时调用该唯一 Ledger 写点（lifecycle 已持有 cause，观察面完整）。备选：扩展 `DispatchOutcome` 显式携带该 cause/旗标后再在 CLI 收口递增——本 phase 二选一即可，但必须单一缝、必须按 cause 观察，**禁止**只靠 status 字面递增。
- 明确排除：无 crash-cause 的 BLOCKED、evidence-gate 改写的 BLOCKED、升格终止轮、普通成功轮、纯 `child-exit`、纯 TIMEOUT 失败面——**不**递增 `contractViolationCount`。
- 计数是 postmortem / 观测面，**零行为分叉**：resume 路由不读该计数（与既有 crash cause「零行为分叉」同款）。

#### 3.3 对外信号

- crash record 的 `cause` 字段携带新词；`CDD_BLOCKED` 理由句区分「not written」与「malformed / schema」——已有文案可保留，只要 cause 字段与计数正确。
- 退出码与 `next:`：缺稿 / 契约违约仍走既有 BLOCKED 失败面（退出码 1、同令 resume）——**不**借本 phase 改退出码表。

### 4. C 组 · dirty-tree 说明（编排器责）

- **门语义零变**：脏树仍 BLOCK，引擎不自动恢复。
- **文案收窄**：`preflight.dirtyTree`（及任何同源转述）须说清——恢复（commit / discard / 编排器侧收拾）归**编排器**；引擎侧动作是「说明后拒绝」，不是「替你清树」或「对脏树放行 resume」。
- 不引入 stash / 临时 commit / dirty-resume 代码路径（Non-goals 的工程镜像）。

### Acceptance criteria

- implement / review / fix（及共享该壳的 one-shot 派发）的渲染提示含**同一**同步收工硬句：写出 handoff 前禁止 `bg_run`/`bg_delegate` 类结束回合等通知路径；嵌套活同回合同步完成后再写 handoff；源面单源（clause/license/frame 之一），无三处复制长文；必达 token 含 `bg_run`/`bg_delegate`、handoff 前禁止 yield 式结束回合、嵌套活同回合同步完成（最终英文措辞归 plan，候选句见 §2.1）。
- 消费面 skills（kairos 已发布 skill 文本）零新增禁令文案；本 phase changeset 不改 skills 消费副本。
- exit 0 + 缺稿 → crash record `cause: "handoff-absent"`（非 `contract-violation`）；`CDD_BLOCKED`；失败面退出码语义零变。
- exit 0 + 畸形 / schema 违约 → `cause: "contract-violation"` 保持。
- 上述两类均使 `contractViolationCount` 精确 +1；TIMEOUT 轮只动 `timeoutCount`；成功轮 / `child-exit` / 无 crash-cause 的 BLOCKED / evidence-gate 改写的 BLOCKED 不动契约计数。
- `Ledger` 暴露唯一契约计数写点；活面无第二写入路径（测试或源扫描可 pin）；记账缝按 §3.2 裁定——`#reject`/`#writeCrash` 内按 cause 调用，或扩展 `DispatchOutcome` 携带 cause 后再 CLI 收口；禁止只靠 `status === "BLOCKED"` 递增。
- `CrashCause` 类型含 `handoff-absent`；扩展时同步改写其 JSDoc（`handoff-absent` = 缺稿；`contract-violation` = 有稿但不合格）；相关 vitest / 类型面翻新。
- dirty-tree 门仍拒绝派发；文案明示编排器恢复、引擎不自动清脏；零 stash / 临时 commit / dirty-resume 实现。
- P13 终止/升格/`timeoutCount`/capsule 键集语义零回归；CLI 旗标 / 退出码表 / `next:` 字面零破。
- 引擎 vitest 全绿；`pnpm run validate` ALL PASS；changeset cdd-engine **minor**；不发布。

## Constraints

- 七前提整评：破坏性许可；OOP 统一、零裸函数；提示硬句单源、禁止声明再抄；死码随改清理；消费者只感「能收口」，禁令不进消费 skill；能收敛到既有 clause/计数对称面则不做平行子系统；宿主 bg 能力不在引擎重造。
- 机器因只认可观察读回事实（缺稿 / 不合格稿），不做法医 yield 证明。
- 契约违约计数 ⊥ 终止计数：两套计数、两套因，resume 都不读。
- 脏树恢复 ⊥ 引擎：门可以硬，手不能伸。
- 不发布：changeset 收到可发布态即止；版本应用 / tag / publish 为独立动作。
- 本设计文档为内部 spec，中文主源（Strategy B）。

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-10-20 | 初稿——P14 phase-spec：A 组同步收工契约（提示/契约面硬句 · implement/review/fix 三腿同一句 · 单源 clause）+ B 组机器因 `handoff-absent` 与 `contractViolationCount` 真递增（缺稿 vs 畸形/schema 拆分 · 与 `timeoutCount` 对称写点 · 零行为分叉）+ C 组 dirty-tree 文案归编排器（门语义零变）；Non-goals 明示不重造宿主 wake / 不等 nested / 不进消费禁令；承 D58 · #368 · P13 hard-dep；changeset minor · 不发布。 | Oscar M. · Claude（kairos:cdd-design [P14]） |
| v0.2 | 2026-10-20 | docs-fix round 1：§3.2 裁定唯一记账缝优先 `#reject`/`#writeCrash` 按 cause 调用（备选扩展 `DispatchOutcome`）；明确排除无 crash-cause / evidence-gate BLOCKED，禁止只靠 status 递增；§3.1/验收要求扩展 `CrashCause` 时同步改写 JSDoc；§2.1 补英文候选硬句与必达 token。 | Oscar M. · Claude（kairos:cdd docs-fix） |
| v0.3 | 2026-10-20 | closeout（cdd-close）——P14 全链闭合登记：两波实现链全绿（W1={1,2} → W2={3}；W1 经一轮 fix 收口——W1 implement `64dcf5da` · wave-review-1 REVIEW_FIX（1 nit · CrashCause JSDoc 落点）→ wave-fix-1 `e53d3077` · W2 implement `00da0d34` · wave-review APPROVED） · 分支终审 APPROVED（branch-review-1 · 零 branch-fix） · 文档链（注册 `96a48b98` · phase-spec `c47943e6` · docs-fix `2c711c32` · plan `35209eb5`） · 验收：`pnpm run validate` exit 0（cdd-engine 782/782 · kairos 83/83 · root 10/10 · typecheck ×3 · emit-check fresh · version-sync kairos 1.1.2 · cdd-engine 3.1.0 · 零裸函数）· changeset cdd-engine minor pending · 不发布 · **未验证面（如实记录）**：真实 pi `-p` child 上 `bg_run`/`bg_delegate` yield 路径导致缺稿的端到端实机路径未跑（提示面/lifecycle/ledger 单测与渲染 pin 已绿） · 父 overall → v2.64（P14 行 Done · `parent-version` 随之 v2.63 → v2.64） | Oscar M. · Claude（kairos:cdd-close · closeout-backfill · 2026-10-20） |
