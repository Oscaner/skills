---
title: '引擎文档工具（Engine Doc-Tooling）— P35 设计：plan 读取收权（一份读取 · 一个失败值 · 一条拒绝通道）'
doc-type: phase-spec
version: v0.1
date: 2026-11-14
slug: '2026-10-10-engine-doc-tooling-p35'
program: 2026-10-10-engine-doc-tooling
parent-version: v3.62
author: '[human] 裁定 · Claude（kairos:cdd-design · 2026-11-14）'
---

## Design

本相位收口 plan 文档读取的一处权威缺口：同一份 plan 有七个解析点、三种失败策略，坏结构的两个面分别是「静默放行」与「裸崩」。根因不是某个被吞掉的 `catch`，而是**读取权落在视图平面**——`face/cli.ts` 把 `BoardView.planGraph` 这条渲染路径的产物当门禁证据注入 session，于是一个 draw 契约变成了 gate 契约。

裁定把 plan 的 read + parse + classify 收进 `infra/` 的一处深类，失败成为一个判别值，坏结构走既有的 `doc-contract` 拒绝通道，降级成为带警告的显式值，「读不出」不再授权下游结论。三件不破坏的事：plan grammar 语义不动、`doc-contract` 判定语义与既有拒绝报文不动、健康 plan 的板面与 `next:` / `reason:` 字节不动。

### 1. 病根

#### 1.1 一份文档、七个解析点、三种策略

七个解析点（模块 + 符号，非行号）分三类策略：

| 解析点 | 策略 | 坏 plan 的后果 |
| --- | --- | --- |
| `face/board-view.ts` 的 `BoardView.planGraph` | `catch` → `null` | 无 |
| `face/board-view.ts` 的 `BoardView.#waveLines` | `null` → `[]` | wave 块空 |
| `face/board-view.ts` 的 `BoardView.render` / `#programFacts` | 空集 → `(none)` / `""` | `wave  (none)`、exit 0、`next:` 照常 |
| `face/cli.ts` 场景装配 | 裸抛 | 无 BLOCKED 面、无 path、无 `next:` |
| `face/cli.ts` 的 `#renderWaveBoard` | 裸抛 | 同上 |
| `face/cli.ts` 的 usage 校验 | 裸抛 | 同上 |
| `session/preflight.ts` 的 graph 门禁 | 裸抛 | 同上（且被场景装配抢先） |
| `session/preflight.ts` 的 `#ledgerFactsOf` | 裸抛 | 同上 |

`session/run.ts` 的 `#recordPlanSnapshot` 是**第三种**策略：`catch` 掉、不记快照，而快照缺失在 wave 门里保守读作 `stall`。它是唯一策略正确的读者（缺失 → 拒绝，而非放行），本相位保留其语义。

判定面另有一处通用分发：`contract/judge.ts` 的 `#contextOf` 直接调 `docTypeParsers[docKey].parse(...)`，于是同一份文档的 body 坏结构会把**判定门自己打死**，而不是产出一行 `Finding`。

#### 1.2 为什么补 `catch` 不管用

两个面是同一个缺陷的两端：board 吞掉后把「读不出」渲染成「没活干」，dispatch 则在更早的场景装配处裸崩成 `cdd: task 27 carries the reserved section "#### DependsOn" more than once`。补 `catch` 只会把裸崩面也改成静默，让「读不出」在所有面上都读作「没活干」。

形式化的病句：**证据缺失被读作缺失的证据**。`session/pipeline.ts` 的 `#waveState` 把 `graph === null` 读作「wave 面从未进入」，`#wavesExhausted` 读作「没关门」，`session/dispatch-authority.ts` 的 `#waveStation` 读作「无站牌」——三处同一个推理错误，靠 `null` 这一个值串起来。

正确形状在同一份文档里已经存在：front-matter 的坏法走 `contract/frontmatter.ts` 的 `get parseError`，由 `session/preflight.ts` 的 doc-contract 块变成一次带 `routeWord("frontmatterParse")` 的拒绝。差别只在 `parse(): PlanParsed` 是「全成功或裸抛」，而 `parseError` 是值。

#### 1.3 为什么读取必须离开视图面

`contract/judge.ts` 的 `ContractInput` 只带 `content: string`——判定平面吃原文、从不读盘。真正读盘的是 `infra/`（`infra/slug-index.ts` 已按 front-matter 读文档，`contract/invariants.ts` 的 `DocFs` / `NodeFs` 是现成读缝）。而视图面持有读取权，就把「怎么渲染」升级成了「怎么判」：`face/cli.ts` 场景装配把 `BoardView.planGraph` 的结果当门禁证据往下传，视图因此成为门禁的上游。

#### 1.4 否决面（issue 的四条建议各自停在哪）

- 建议①「返回类型化的失败值」——停在返回类型：谁读、谁判、判据在哪，一个问题没回答。
- 建议②「board 打一行 `CDD_WARN`」——只覆盖视图面，dispatch 的裸崩面原封不动。
- 建议③「新增 `doc-structure` violation 类」——`doc-contract` 已是结构拒绝类，新增等于扩令牌表（P27 的十三 token 分腿），收益只是诊断更细，而 path / field / message 已经在报文里。
- 建议④「`next:` 必须说明被什么挡住」——`next:` 是路由分类器的单一出口，为一个拒绝类分叉会让「路由 == 门禁 == 渲染」多一个例外；「被挡住」的可见性由 `CDD_BLOCKED:` + `reason:` + 报文承担。

### 2. 裁定

#### 2.1 读取收进 `infra/plan-source.ts`，失败是一个判别值

新增深类 `PlanSource`，构造注入 `DocFs`（默认 `NodeFs`），一个方法 `read(path: string | null): PlanRead`：

- `{ kind: "undeclared" }` — 面没有声明 plan（今日 `planText === null` 的合法情形）
- `{ kind: "unreadable"; path: string; cause: "io" | "syntax"; message: string; field?: string }`
- `{ kind: "ready"; path: string; text: string; doc: PlanParsed; graph: TaskGraph }`

`ready` 带 `text`：wave brief（`face/gate.ts`）与 `#targetSlug`（`face/cli.ts`）都还在读原文，它们不搬家、不改字节。

`BoardView.planGraph` 删除，`BoardView.#waveLines` 与场景装配改吃 `PlanRead`。场景只持 `PlanRead`，`planText` 退成 `ready` 分支的访问器——缺陷的根因就是同一份事实被读了七遍，留下两个字段等于留下第二重事实源。

#### 2.2 grammar 的坏结构升级为类型化错误

`contract/task-block-grammar.ts` 的 `#assertNoDuplicateKeys` 改抛 `PlanSyntaxError`（携带 `field` / `message` / `fix`），不再抛裸 `Error`。`parse(): PlanParsed` 的签名不变，其余文档类型不受牵连；`assert` 从此只承载编程不变量。

`path` 不进 grammar：文件身份是读者的事实。`PlanSource` 与 `contract/judge.ts` 的 `#contextOf` 捕获 `PlanSyntaxError` 并补上 `path`，产出 `contract/invariants.ts` 的 `Finding`（`kind` 取文法所属的不变量类名）。

#### 2.3 拒绝复用既有 doc-contract 通道

`session/preflight.ts` 的 doc-shape 块在判定前先读 `PlanRead`：`unreadable` → `#refusal({ ok: false, gate: "doc-contract", reason: "doc-contract", message })`，与 front-matter 坏法同一形状、同一 gate id、同一 reason token。不新增 gate id，不新增 reason token。

措辞进词表（`face/words.ts` 的 routeWord 区），两条：`planUnparseable: "plan unparseable: {path} — {message}"`、`planUnreadable: "plan unreadable: {path}"`。两种 cause 分两个词：一个要改文法，一个要修路径或权限，合成一个词等于把诊断再吞一层。

#### 2.4 降级显式：视图面与 preview 面

board 收到 `unreadable` 时渲一行 `CDD_WARN:`（`face/words.ts` 的 `stations.warn` 锚）+ 对应词行，打在 wave 块之后，退出码仍 0；wave 格渲 `! unparseable` / `! unreadable`。`(none)` 退守 `undeclared` 一种语义——今日它同时冒充「没有 plan」与「读不出 plan」。

程序面（overall 视图）的波次格同规则，空串退役。

`--dry-run` / preview 与真派同批：preview 在坏 plan 上同样返回 BLOCKED，不降级。preview 的卖点是「先看这一轮会做什么」，让它照常输出等于把同一个谎报搬到第二个面。

#### 2.5 缺证据不得授权下游

`session/pipeline.ts` 的 `#waveState` 与 `#wavesExhausted`、`session/dispatch-authority.ts` 的 `#waveStation` 改吃 `PlanRead`：`undeclared` 保留今日语义，`unreadable` 落成结构阻塞，不再读作「未进入 / 没关门 / 无站牌」。

`session/run.ts` 的 `#recordPlanSnapshot` 保留「缺快照读作 stall」，只把「吞掉的缺失」改成「已知的缺失」——账本是记录面，为一个坏 plan 把已完成的 wave 卡死在闭合点，会把读取缺陷升级成流程死锁，而 stall 已经给出了保守的正确答案。

#### 2.6 机械强制三项

- 唯一解析点守卫：`infra/__tests__/plan-source.guard.test.ts` 扫 `src-next` 全树，`new PlanDocType("plan").parse` 只许出现在 `infra/plan-source.ts`；同一测试禁止该模块出现空 `catch`（biome 无现成规则，自定义插件的维护成本高于一条正则）。
- 三面一致性必红：`face/__tests__/cli.test.ts` 黑盒，健康 plan 与坏 plan 各一条——板面渲染的 wave 集、门禁判的 wave 集、frontier 路由的 wave 集逐格相等。只有 CLI 面同时看得见渲染、门禁、路由三层。
- 合法降级不误伤：`face/__tests__/board-view.test.ts` 既有的 `wave (none)` 格（真 undeclared）必须保持绿。

### 3. 失败面

#### 3.1 裸崩面的残留路径

场景装配先于 preview 与 usage 校验执行，`#renderWaveBoard` 又在拒绝分支之后。三处都必须改吃同一个 `PlanRead`，否则会出现「门禁已拒绝、渲染先崩」的顺序漏洞。验收要求 stderr 不再出现 `cdd: ` 前缀的文法报文。

#### 3.2 `(none)` 与退出码的既有 pin

`cli.test.ts` 把 `(none)` 降级与 exit 0 绑在一起，`board-view.test.ts` 钉着合法的 `wave (none)`。降级面重构后这两处 pin 必须仍绿——它们是「不误伤健康路径」的证据。

#### 3.3 IO 与语法分叉后的报文覆盖

`DocFs.read` 返回 `null` 已是 IO 面的事实（读不出），与文法坏结构（读得出、判不过）是两件事。两条词行各自被至少一条测试覆盖，避免只测其中一条就让另一条裸走。

#### 3.4 判定面的路径归因

`contract/judge.ts` 捕获 `PlanSyntaxError` 后必须补上 `ContractInput.path`，否则 `Finding.path` 会出现空串或读者路径，判定面的锚定失效。

### Acceptance criteria

- `cdd board --plan` 指数到一个重复 `#### DependsOn` 节的背景 plan（fixture）：stdout 含一行 `CDD_WARN:`，wave 格为 `! unparseable`，全文不含 `wave  (none)`，退出码 0 — pin `face/__tests__/cli.test.ts`
- `cdd implement --type wave --plan` 同一 fixture：输出 `CDD_BLOCKED:` 与 `reason: doc-contract`，报文含 plan 路径与字段名，stderr 不含 `cdd: task 27 carries the reserved section` — pin `face/__tests__/cli.test.ts`
- 读不出文件（已声明但路径不存在或不可读）的 plan：wave 格为 `! unreadable`，词行为 `plan unreadable`，退出码 0；与文法坏结构各自被覆盖 — pin `infra/__tests__/plan-source.test.ts`
- 健康 plan 上，板面渲染的 wave 集、`session/preflight.ts` 判定的 wave 集、frontier 路由的 wave 集逐格相等（三面一致性）— pin `face/__tests__/cli.test.ts`
- `new PlanDocType("plan").parse` 在 `packages/cdd-engine/src-next` 只出现在 `infra/plan-source.ts`，且该文件不含空 `catch` — pin `infra/__tests__/plan-source.guard.test.ts`
- 真 undeclared 的 phase 文档仍渲 `wave  (none)` 且退出码 0 — pin `face/__tests__/board-view.test.ts`
- 健康 plan 的板面、`next:`、`reason:` 逐字节不变 — pin `face/__tests__/board-view.test.ts`
- `--dry-run` / preview 面在坏 plan 上同样 BLOCKED，不降级 — pin `face/__tests__/cli.test.ts`
- `pnpm run validate` exit 0；changeset：cdd-engine **minor**（新增拒绝面与一格渲染字面属消费可见字节变化，D74）

## Constraints

- plan grammar 语义不动：`#### DependsOn` 仍只许一节，其余重复节规则与报文措辞保持
- `doc-contract` 判定语义不动，既有拒绝报文（front-matter 行）逐字节不变；不新增 gate id 与 reason token
- `contract/` 保持纯文本面，不引入读盘职责；读取归 `infra/`
- progress 账本口径与 `recordPlanTasks` 的形状不动；`session/run.ts` 的 stall 语义保留
- 不新增 CLI 动词或旗标，不重排 board 既有列与 `next:` / `reason:` 字节
- 无 module-level 裸函数；新类按 OOP-first 落（状态与行为共变），单一职责

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-11-14 | 初稿：plan 读取收权（`infra/plan-source.ts` 的 `PlanRead` 三态、`PlanSyntaxError` → `Finding`、复用 doc-contract 拒绝通道、降级显式化、缺证据不授权、三项机械强制） | [human] 裁定 · Claude（kairos:cdd-design · 2026-11-14） |
