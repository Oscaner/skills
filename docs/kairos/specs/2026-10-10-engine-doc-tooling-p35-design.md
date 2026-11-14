---
title: '引擎文档工具（Engine Doc-Tooling）— P35 设计：plan 读取收权（一份读取 · 一个失败值 · 一条拒绝通道）'
doc-type: phase-spec
version: v0.9
date: 2026-11-14
slug: '2026-10-10-engine-doc-tooling-p35'
program: 2026-10-10-engine-doc-tooling
parent-version: v3.65
author: '[human] 裁定 · Claude（kairos:cdd-design · 2026-11-14）'
---

## Design

本相位收口 plan 文档读取的一处权威缺口：同一份 plan 有**九个读取点（共十处到达 plan 解析的站点，含登记行一处）、四种失败策略**，坏结构的两个面分别是「静默放行」与「裸崩」。根因不是某个被吞掉的 `catch`，而是**读取权落在视图平面**——`face/cli.ts` 把 `BoardView.planGraph` 这条渲染路径的产物当门禁证据注入 session，于是一个 draw 契约变成了 gate 契约。计数口径写死在此：度量的单位是**到达 plan 解析的站点**，不是「拼出 `new PlanDocType("plan")` 的站点」——`grep -rn 'new PlanDocType("plan")' packages/cdd-engine/src-next`（排除 `__tests__/`）共 9 处 = 8 个显式读取点 + `contract/doc.ts` 登记行 1 处；第九个读取点是 `session/ledger.ts` 的 `Ledger#briefRevision`，它经由 `readonly #brief = new BriefRenderer();`（`session/ledger.ts:668`）的默认参数到达解析，这条 grep 看不见它。故总计 10 = 9 读取点 + 1 登记行，与 overall D90 / Phase-inventory 的 `9+1`、四策略同源。

裁定把 plan 的 read + parse + classify 收进 `infra/plan-source.ts` 的一处深类，失败成为一个携带行为的判别值，坏结构走既有的 `doc-contract` 拒绝通道，降级成为带警告的显式值，「读不出」不再授权下游结论。三件不破坏的事：plan grammar 语义不动、`doc-contract` 判定语义与既有拒绝报文不动、健康 plan 的板面与 `next:` / `reason:` 字节不动。

### 1. 病根

#### 1.1 一份文档、九个读取点、一个登记行、四种策略

九个读取点（模块 + 符号，非行号）分四类策略：

| 读取点 | 策略 | 坏 plan 的后果 |
| --- | --- | --- |
| `face/board-view.ts` 的 `BoardView.planGraph` | 捕获 → `null` | `  wave     (none)`、exit 0、`next:` 照常 |
| `face/cli.ts` 的 `Cli#sceneOf`（场景装配） | 裸抛 | 无 BLOCKED 面、无 path、无 `next:` |
| `face/cli.ts` 的 `Cli#renderWaveBoard` | 裸抛 | 同上 |
| `face/cli.ts` 的 usage 校验（`planIds` 块，`Cli#runWork` 内） | 裸抛 | 同上 |
| `session/preflight.ts` 的 `PreFlight#vet` graph 门禁 | 裸抛 | 同上（且被场景装配抢先） |
| `session/preflight.ts` 的 `PreFlight#ledgerFactsOf` | 裸抛 | 同上 |
| `render/brief.ts` 的 `BriefRenderer`（构造注入解析器，`extract` 内解析） | 裸抛 | 同上（本相位删除该解析：`BriefRenderer` 的 `render` / `taskBody` / `extract` 三面改收 `text` + `doc`，`PlanRead.text()` / `PlanRead.doc()`，见 §2.1 / §2.6） |
| `session/run.ts` 的 `Lifecycle#recordPlanSnapshot` | 捕获 → 不记快照 | 快照缺失在 wave 门里保守读作 `stall` |
| `session/ledger.ts` 的 `Ledger#briefRevision`（`:941`；经 `readonly #brief = new BriefRenderer();`（`:668`）的默认参数到达解析） | 捕获 → `null`（brief 事实不记） | 该次 review/fix 完成时不记 brief 修订，`briefDrifted` 读作未漂移、已评审波次不重开 |

`Lifecycle#recordPlanSnapshot` 是**策略正确的那一个**（缺失 → 拒绝，而非放行），本相位保留它的语义，只把「吞掉的缺失」换成「已知的缺失」——它改吃 `PlanRead`，非 ready 不记快照。`Ledger#briefRevision` 是第四类：它同样 `catch → null`，但吞掉的不是图而是一条修订哈希——算不出就不记，与「present facts only」一致；它与第一类不是一件事，后者把图吞成 `null` 后板面读作「没活干」，而这里不记的是「这次评审的 brief 基准是哪一版」。

**登记行**（唯一合法的构造点，不是读取点）：`contract/doc.ts` 的 `docTypeParsers` 里 `plan: new PlanDocType("plan")`。

**渲染消费点**（只读 `null` / 空集，不是解析点，移出上表）：`BoardView.#waveLines`、doc 面 `BoardView.render`、`BoardView.#programBoard` 内的 `waveCell` 局部。三处今日把「零 task block」「没有 plan」「读不出」压成同一个空值/`(none)`，§2.4 逐个拆开。

判定面另有一处通用分发：`contract/judge.ts` 的 `#contextOf` 直接调 `docTypeParsers[input.docKey].parse(...)`，于是同一份文档的 body 坏结构会把**判定门自己打死**，而不是产出一行 `Finding`。

顺序事实（今日成立、须有 pin）：`PreFlight` 的 doc-contract 结构拒绝发生在 `face/gate.ts` 的 `renderBrief` **之前**。这个顺序今日是 `BriefRenderer` 裸抛的唯一保障；本相位把 brief 的第二处解析删掉（§2.1 / §2.6），保障于是不再依赖时序——`renderBrief` 拿到的已是 `PlanRead.doc`，它没有解析可抛。

#### 1.2 为什么补 `catch` 不管用

两个面是同一个缺陷的两端：board 吞掉后把「读不出」渲染成「没活干」，dispatch 则在更早的场景装配处裸崩成 `cdd: task 27 carries the reserved section "#### DependsOn" more than once`。补 `catch` 只会把裸崩面也改成静默，让「读不出」在所有面上都读作「没活干」。

形式化的病句：**证据缺失被读作缺失的证据**。`session/pipeline.ts` 的 `#waveState` 把 `graph === null` 读作「wave 面从未进入」，`#wavesExhausted` 读作「没关门」，`session/dispatch-authority.ts` 的 `#waveStation` 读作「无站牌」——三处同一个推理错误，靠 `null` 这一个值串起来。

正确形状在同一份文档里已经存在：front-matter 的坏法走 `contract/frontmatter.ts` 的 `get parseError`，由 `session/preflight.ts` 的 doc-contract 块变成一次带 `routeWord("frontmatterParse")` 的拒绝。差别只在 `parse(): PlanParsed` 是「全成功或裸抛」，而 `parseError` 是值。

#### 1.3 为什么读取必须离开视图面

`contract/judge.ts` 的 `ContractInput` 只带 `content: string`——判定面按值收原文、从不读盘，读盘归 `infra/`（`infra/slug-index.ts` 已按 front-matter 读文档）。这是一个**按面分工**的判据，不是「`contract/` 不碰 IO」：`contract/invariants.ts` 里就住着 `DocFs` / `NodeFs` 读缝。而视图面持有读取权，就把「怎么渲染」升级成了「怎么判」：`face/cli.ts` 场景装配把 `BoardView.planGraph` 的结果当门禁证据往下传，视图因此成为门禁的上游。

#### 1.4 否决面（issue 的四条建议各自停在哪）

- 建议①「返回类型化的失败值」——停在返回类型：谁读、谁判、判据在哪，一个问题没回答。
- 建议②「board 打一行 `CDD_WARN`」——只覆盖视图面，dispatch 的裸崩面原封不动。
- 建议③「新增 `doc-structure` violation 类」——`doc-contract` 已是结构拒绝类，新增等于扩令牌表（P27 的十三 token 分腿），收益只是诊断更细，而 path / field / message 已经在报文里。
- 建议④「`next:` 必须说明被什么挡住」——`next:` 是路由分类器的单一出口，为一个拒绝类分叉会让「路由 == 门禁 == 渲染」多一个例外；「被挡住」的可见性由 `CDD_BLOCKED:` + `reason:` + 报文承担。

### 2. 裁定

#### 2.1 读取收进 `infra/plan-source.ts`：一个深类、两个入口、一个携带行为的值

新增深类 `PlanSource`（家：`infra/plan-source.ts`），在组合根 `Cli.create()`（`face/cli.ts` 的静态工厂，`src-next/bin.ts` 只负责启动它）构造，构造注入 `DocFs`（默认 `NodeFs`）。两个入口，同一个 `PlanRead`：

- `readDeclared(entry: DocEntry, index: SlugIndex): PlanRead` — 相位文档的声明面：`entry.declaredPlan`（front-matter `plan:` 的声明路径）优先，缺省回落 `entry.slug === null ? null : index.planOf(entry.slug)?.rel`（今日行为；`SlugIndex.planOf(slug: string)` 收非空串而 `DocEntry.slug` 是 `string | null`，`face/board-view.ts:281-296` 正是这样守卫的）。声明优先的意义是**绕开 `SlugIndex` 的内容谓词**——「声明了、但内容读不出」的 plan 因此在 board 面第一次可达 `cause: "io"`。`infra/slug-index.ts` 的 `#scanRoot` 行为不动（改它会把每条 doc-type 扫描都变成允许不可读候选，波及面远超本相位）；`plan:` 是可选增量键，不作必填，不改变任何既有文档的合法性。

`plan:` 的值有域，且域钉在边界上：**repo 相对**、经 `RepoRoot` 解析、不得是绝对路径、不得用 `..` 逃出 doc roots。越域的值**不得抵达** `DocFs.read`——`readDeclared` 先做域校验，越域即按 `doc-contract` 结构拒绝处理（`kind: "unreadable"`、`cause: "syntax"`、`field: "plan"`、`message` 取新增的 `planPathInvalid` 词行、`path` 置空串——越域原值不回显），`refusal(words)` 因此给出 `gate: "doc-contract"` / `reason: "doc-contract"` 的入参，与既有 `frontmatterParse` 同形状。plan 行的字节基准随之写死为 **repo 相对形式**——机器绝对路径永远不进格。
- `readPath(rel: string): PlanRead` — argv 直给路径的读取面：`cdd board --plan` 与三条 argv 驱动读者（usage 校验的 `planIds` 块、`Cli#renderWaveBoard`、`Cli#sceneOf`）共用它，不再各写一次「索引里没有就当没读」。

`plan:` 键的可达面三件，缺一条这条声明就落不了地：

1. `contract/frontmatter.ts` 的 `FrontMatterHead` 增 `get plan(): string | null`，沿用既有「每键一个 typed getter」的形状（`value(key)` 是通用读法，getter 是消费面）。
2. `infra/slug-index.ts` 的 `DocEntry` 增 `declaredPlan: string | null`，`#scanRoot` 建 entry 时从它已经解析出的那份 `head` 取值——**不第二次 parse YAML**：索引本来就持有 `FrontMatterHead`，`plan:` 只是把其中一个标量事实带出来。
3. 不新增 skeleton 槽位、不新增 doc-contract 元素——`schema get --output skeleton` 不吐该键、`contract/project.ts` 的元素表不动；该键由 fixture 手写（`infra/__tests__/plan-source.test.ts` 自己的夹具）。

判别值三态：

```ts
type PlanRead =
  | { readonly kind: "undeclared" }
  | { readonly kind: "unreadable"; readonly path: string; readonly cause: "io" | "syntax"; readonly message: string; readonly field: string | null }
  | { readonly kind: "ready"; readonly path: string; readonly text: string; readonly doc: PlanParsed; readonly graph: TaskGraph };
```

值**携带行为**，消费点不写 `switch (read.kind)`——同一个三态分支不许在七个调用点各写一遍，那正是本相位要杀的病：

- `text(): string | null` — wave brief 与 `#targetSlug` 的原文；非抛，非 ready 返回 `null`。
- `doc(): PlanParsed | null` — brief 的数据面（§2.6 的 `render` / `taskBody` 第二个入参）；非 ready 返回 `null`（`undeclared` 与 `unreadable` 一律没有已解析文档）。
- `graph(): TaskGraph | null` — 门禁 / frontier / 板面的唯一图输入。`ready` 里 **eager** 派生于同一次解析（一次解析只产一份派生，不留第二重惰性事实源）。
- `waves(): readonly TaskBatch[]` — 板面 wave 段的数据面；非 ready 返回空集。**它不是渲染信号**：`waves()` 为空既可能是「这版 plan 还没写 task」也可能是「读不出」，doc 面渲什么字面由 `degradedWaveRow()` 决定（§2.4）。
- `degradedWaveRow(words: PlanReadWords): string | null` — **doc 面**只负责**三种降级字面量**（§2.4 的四语义减一）：`undeclared` → `(none)`；`ready` 且零 task block → `(empty plan)`；非 ready → `! unparseable` / `! unreadable`；**`ready` 且有波次 → `null`**，表示「健康行不由本访问器负责」。`#waveLines` 仍是装配者：先问 `degradedWaveRow`，得 `null` 才按今日路径渲健康行（`waves()` + `graph.report(ledger.closedWaves())` 的标记 + `#rowRounds(progress, key)` 的轮次段 + `LineCarriers.ofLedger(ledger, "wave", key, rounds)` 的 carried lines，一字不改）；`#nodeBoard` 同源。健康行的字节基准因此留在装配者手里，AC #11 仍是字节断言而不是愿望；`#waveLines` **不再**以 `waves()` 是否为空作为渲 `(none)` 的信号。
- `cell(words: PlanReadWords): string | null` — **程序面**波次格的字面（§2.4 的四语义；`undeclared` → `""`；**`ready` 且有波次 → `null`**，表示「健康格不由本访问器负责」，`#programBoard` 得 `null` 才按今日路径渲 `waves[0]!.label.split(" ")[0] + "…"`，即 `W1…`），不接面参数——同一份 `undeclared` 在两面渲不同字面，靠**调哪个访问器**区分，不靠传参分支。
- `planLine(words: PlanReadWords): string | null` — plan 行的**格内容**：非 ready 时返回，`ready` 但 `PlanRead.path` 未解析到索引里的 `DocEntry` 时也返回（否则 `null`，plan 行交 `#docCell`），形为 `<repo 相对路径> · <标记>`——`ready` 且无标记时只渲路径、不带分隔符——标记复用波次格同一个词（`! unparseable` / `! unreadable`，不另造），格子不经 `#docCell`；标签与 `LABEL_WIDTH` 的 padding 仍由 `#nodeBoard` 的 `  ${row.label.padEnd(LABEL_WIDTH)}${cell.text}` 负责（不搬进本访问器），降级 plan 行的完整字形因而是 `  plan     <repo 相对路径> · ! unparseable`（`LABEL_WIDTH = 9`，`trimEnd` 后无尾随空格）。越域声明（`path` 为空串）**丢掉分隔符**，逐字节渲 `  plan     ! unparseable`——不是 `  plan      · ! unparseable` 那种孤儿分隔符——且不回显原值。`undeclared` 返回 `null`，plan 行照旧走索引派生的那一项；**两个入口面都生效**（`--plan` 与 `--spec` 同一条规则，不加面条件——少一个 if 就少一处将来的分叉），读失败不是 slug 缺失，不参与 `#entryMark` 记账，板面消费点因此不写 `switch (read.kind)`。
- `warnLine(words: PlanReadWords): string | null` — board 的 `CDD_WARN:` 行，健康 plan 返回 `null`。
- `refusal(words: PlanReadWords): { gate: "doc-contract"; reason: "doc-contract"; message: string } | null` — preflight 的拒绝通道入参，健康 plan 返回 `null`。

`PlanReadWords` 是 `infra/plan-source.ts` 自己声明的词表端口（`planReadWord(cause)` / `planEmptyWord` / `cellEmpty` / `warnPrefix` / `planPathInvalid` …），由 `face/words.ts` 的 `Words` 实现——依赖方向仍是 face → infra，词表仍旧单源。

接线（一次读取、一个事实源）：`PlanSource` 在 `Cli.create()` 构造一次；`Cli#runBoard` 在**自己内部**构造 `PlanRead`（`--plan` 走 `readPath`、`--spec` 走 `readDeclared`；overall 视图逐相位读取走同一个实例，按 `index.phaseSpecsOf(slug)` 的行序形成一张有序值表），并以**参数**传给 `BoardNext.of` 与 `BoardView.pipelineFacts`。`BoardView.render` / `#programBoard` / `#waveLines` 仍是静态方法，但改为**收值不再自读**（node 板收一个 `PlanRead`，程序板收逐相位的有序值表）——`BoardView.planGraph` 删除后，板面没有第二个读取点。工作路径上 `PlanRead` 随 `WorkScene` 下行（取代 `planText: string | null` 这个第二重事实源），`PreFlight#vet` 从场景取值，不各读一次；板面不建 `WorkScene` 是既有事实——`PlanRead` 是值，不是场景成员，不为此新增场景。

doc 行的 plan 项与波次格同源，规则是一句可判定的话：**plan 行的事实源恒为 `PlanRead.path`**——该路径若解析到索引里的 `DocEntry`，就用既有的 `#docCell` 渲（今日字节不变），否则用 `PlanRead.planLine(words)` 渲（repo 相对路径 + 有无标记）。三个面因此一致：无声明时路径来自 `index.planOf`（必有 entry），走 `#docCell`，健康对照逐字节不变，AC #11 不受影响；`ready` 但声明路径未被索引收进去（plan 文件缺 `doc-type: plan`，或新 plan 覆盖旧 entry）时，plan 行渲声明路径，而不是 `(none)` 或旧文档的 `name  version · status`；非 ready 时同样渲声明路径加读失败标记（`--plan` 面走 `readPath` 的同一条规则）。由 `planLine` 渲出时，plan 行不构造 `DocEntry`、不参与 `#entryMark` 记账、不进 `#docCell` 的 blocked 判定，`#nodeBoard` 照常打 overall / spec / plan / branch 四行，只把 plan 行换成 `PlanRead.planLine(words)` 渲出的这一行。反向约束同源：**不许**把无身份的值包成 `DocEntry`——`face/board-view.ts` 的 `#entryMark` 读 `entry.slug`，空 slug 回 `MARK_SLUG_MISSING`，`#docCell` 随即 `blocked: true`，`#nodeBoard` 的 `return blocked ? 2 : 0` 把这次降级误判成 exit 2。于是「plan 行与波次格一分为二」在任何 kind 上都不发生：同一个 `PlanRead` 供两边，`plan` 行渲声明路径、波次格渲 `! unreadable`；`ready` 而声明路径未入索引时，plan 行渲声明路径、波次格照常渲健康波次行。argv 面由索引成员性裁决的判定（§2.4 判定 ③）不变——它决定的是**拒绝还是成板**，不是行的来源。

`face/gate.ts` 的 `scene.planText!` 改为 `scene.plan.text()`（非抛访问器，`null` 由调用点显式处理，不再靠断言抹平）。

#### 2.2 坏结构升级为类型化错误 `DocSyntaxError`

在 `contract/doc.ts` 的 `DocType` 基类旁定义 `DocSyntaxError`（携带 `field` / `message` / `fix`），不设 plan 专属类；plan grammar 抛它，其余 doc 型可复用。`contract/task-block-grammar.ts` 的 `TaskBlockGrammar#assertNoDuplicateKeys` 改抛它，不再抛裸 `Error`；`parse(): PlanParsed` 的签名不变，`assert` 从此只承载编程不变量。

物化只发生在**有消费者**的地方——判官边界：`contract/judge.ts` 的 `#contextOf` 只**把 `DocSyntaxError` 带出来**（它返回 `JudgeContext`，物化不在这一层），`Finding` 由 `validate` / `validateLedger` 物化——`path` 取 `ContractInput.path`、`field` 取错误自带的字段、`fix` 取错误自带的修复提示。`infra/plan-source.ts` **不物化** `Finding`：`unreadable` 自带的 `path` / `message` / `field` 就是失败值本身，`refusal(words)` 直接交出 `{ gate, reason, message }`——同一事实不在同一对象图里携带两遍（D26「一事实一处」）；`DocSyntaxError` 的 `fix` 因此只服务判定面的 `Finding`。`kind` 字面量统一为 `"doc-syntax"`（`Finding.kind` 是不变量类名词汇，不是 station 的 reason token，故不新增令牌）。两个字面量必须逐字节相同，由测试钉住。

`path` 不进 grammar：文件身份是读者的事实。`contract/judge.ts` 一侧的路径来自 `ContractInput.path`（`Finding.path` 的既有归因源），因此 `validate` / `validateLedger` 对 `#contextOf` 的调用包在 try/catch 里：捕获 `DocSyntaxError` → 产一行 `Finding`，而不是穿透判定门。

#### 2.3 拒绝复用既有 doc-contract 通道

`session/preflight.ts` 的拒绝是**一道不挂门的独立判定**，不是 doc-shape 块里的一行：位置在 in-flight 之后、graph 门之前，依据**场景里的 `PlanRead`**（不是 `ctx.doc`——wave 面到达这一步时 `ctx.doc === null`，`TargetFaceTable.isDocShape` 为假，`session/faces.ts` 给它 `audit: { kind: "task-graph" }`），凡是携带 `PlanRead` 的面（`wave` / `plan` / `branch`）都执行——`branch` 面确实是 plan 携带者：`case "plan"` fallthrough 进 `case "branch"`，`face/cli.ts:1237` 的 `planText = this.#artifacts.readText(node, root, planRel)` 是同一处读取，`:1238` 的 `#targetSlug` 消费它，`face/cli.ts:674` 的 `Cli#runWork` 无条件交给 preflight，`session/preflight.ts:509` 的 `#ledgerFactsOf` 对 `plan | wave | branch` 无 try/catch 地解析（此前引的 `face/cli.ts:805` 是过时注释，已删）；三个 doc 面今日不带 plan，不在此列；`refusal(words)` 非 `null` → 与该块既有形状同一 gate id、同一 reason token（`gate: "doc-contract"` / `reason: "doc-contract"`），报文含 plan 路径与字段名。不新增 gate id，不新增 reason token。门的记账写清：doc 面上 `doc-contract` 本来就在该面的 gate 计划里，故这次拒绝同时入 `checked`；wave 面上它**不在** gate 计划里，因此**不入** `checked`；`branch` 面同 wave 面**不入** `checked`——`session/faces.ts` 给它 `audit: { kind: "branch-tree" }`，`isDocShape` 为 false，`doc-contract` 不在它的 gate 计划里，而 `cdd implement --type branch` 是 AC #3 的合法可达面。拒绝靠 `reason:` 与报文表达，不许让 wave 面 / `branch` 面声称跑过一个它们没计划的门。`graph` 门只在 `read.kind === "ready"` 时运行，其余按 `skipped` 记账——因此 plan 面上的第一处拒绝恒为 `doc-contract`，AC #3 观察到的 `reason` 不会变成 `graph`。doc 面既有的 doc-contract 行原样不动。

**不新增 station kind**（`session/dispatch-authority.ts` 的三 kind 不动，P27 的十三 token 不动）：`unreadable` 与 `unparseable` 的可观察面是「结构拒绝先于 station 计算发生」——前者使下游不可达，而不是新增一个 kind。

board 面另落同一条意图（charter ④「读不出不得授权下游 `next:`」）：拿到非 ready 的 `PlanRead` 时**不派生任何波次路由**——`BoardNext.of` 短路，`next:` 渲既有的 hop-less 降级形态 `  next:    (none)`（`face/board-view.ts` 的 `next === null` 分支，`face/__tests__/board-view.test.ts` 已钉），且不出 `reason:` 行；原因由波次格（`! unparseable` / `! unreadable`）外加 stderr 的 `CDD_WARN:` 承担。这条路径不构造 station，故不新增 `TargetType`、不新增 station kind、不新增 reason token。`undeclared` 不在短路之列：没有 plan 的相位仍走 frontier 的今日语义（`graph === null` → 未进入 → plan 面路由），「读不出」与「没有」不是一件事。

#### 2.4 降级显式：视图面与 preview 面

四语义一格不多一格不少：

| 语义 | doc 面 wave 行 | 程序面波次格 |
| --- | --- | --- |
| 真 undeclared（该相位没有 plan） | `(none)` | `""`（`""` 只属于这一种语义） |
| `ready` 但零 task block（skeleton 刚生成） | `(empty plan)` | `(empty plan)` |
| `unreadable` / `unparseable` | `! unreadable` / `! unparseable` | 同 |

doc 面的 wave 行分两段：`PlanRead.degradedWaveRow(words)` 只产三种降级字面量，`ready` 且有波次时返回 `null`，由装配者 `#waveLines` 按今日路径（`waves()` + `graph.report(ledger.closedWaves())` + `#rowRounds` + `LineCarriers`）渲健康行；程序面的波次格由 `PlanRead.cell(words)` 生产，它只产三种降级字面量与空串（`undeclared` → `""`），`ready` 且有波次时同样返回 `null`，由 `#programBoard` 按今日路径渲 `waves[0]!.label.split(" ")[0] + "…"`（即 `W1…`）——健康 doc 行与健康程序格都「不由本访问器负责」，两面成对。同一份 `undeclared` 在两面渲不同字面，靠**调哪个访问器**区分，`cell` 不接面参数；`#waveLines` / `#nodeBoard` 渲 doc 面波次行时**从不**以 `waves()` 是否为空作为渲 `(none)` 的信号。

格面字面按 `LABEL_WIDTH`（`face/board-view.ts`）对齐：真 undeclared 那一行是 `  wave     (none)`（前导两空格 + `wave` 补齐到 9 列），验收逐字节对照这条字面，不写活动格。

`(empty plan)` 走**独立端口成员** `planEmptyWord()`（与 `cellEmpty` 并列的同级 station，仍是 `PlanReadWords` 的一员），不进 `planReadWord(cause)`——后者只承担 `io` / `syntax` 两种读失败。理由：健康但空的状态不是读失败，塞进失败词法会让测试从同一处推出字面量而永不红。该字面不得回落 `(none)`，也不得回落空串——它是「有 plan、还没写 task」的正常态，与「没有 plan」不是一件事。

board 收到非 ready 时额外打一行诊断：`CDD_WARN:` + 对应词行，走 **stderr**（`face/lifecycle.ts` 与 `face/cli.ts` 的现有一律 stderr，`words.stations.warn` 是诊断锚）；stdout 的 wave 块零字节变化（只差那一格），退出码仍 0。写者是 **`Cli#runBoard`**：`BoardView.render` 是纯函数（静态返回 `{ lines, exitCode }`，不持有 io 通道），不承担写盘——`Cli#runBoard` 在打印渲染行**之前**调用 `read.warnLine(words)` 写 stderr；overall 板由它按 §2.1 那张有序逐相位值表，对每个非 ready 相位各写一行（行内带相位 id）。把诊断放 stdout 会让一个站牌词跑上没有站牌走的通道。

程序面（`BoardView.#programBoard`）一条降级、两处落点：每个坏 plan 的相位各出一行 `CDD_WARN:`（行内带该相位的 `slug:`，多相位板上才定位得到），打 **stderr**；波次格只渲 `! unparseable` / `! unreadable`（真 undeclared 仍是 `""`），健康相位行的波次格仍按今日路径渲 `W1…`（`cell(words)` 对它返回 `null`），不在格内另造标记，相位行其余列零字节变化。

`cdd board --plan <存在但读不出>` 是 argv 面，**不出板面**：读取失败即拒绝，保持 exit 2，但报文必须点明是读失败而不是「没有这份文档」——`cdd board: cannot read --plan <path>: <原因>`（`#boardNotFound` 的 `no docs match` 只留给「不存在」与「读得到但不在索引」两种**非读取失败**——与判定 ③ 同义，也只有存在性探针失败与索引缺员两种情形用它）。没有板面就没有 `next:`，charter ④「读不出不得授权下游 `next:`」自动满足。exit 0 的 `! unreadable` 渲染只经相位文档的 `plan:` 声明到达（§2.1 的声明面），两条面各归各的通道，不复用同一个身份。读得成功但索引里没有这份文档（不是两个 doc root 下的扫描面）仍走既有 `#boardNotFound`（exit 2）。

归类顺序一句写死——四个判决不在同一层，重叠时必须有序，且**判定 0 是存在性探针**（与今日代码同序，零文档读取）：① **`SlugIndex.insideDocRoots` + `existsSync`** → 不存在（不在 doc roots 内或盘上无此文件）→ 既有 `#boardNotFound`（`no docs match`，exit 2；`face/__tests__/cli.test.ts` 的 ghost-path pin 不变）；② 存在 → **读字节**，读失败即 `cdd board: cannot read --plan <path>: <原因>`（exit 2）；③ 字节读到后**由索引成员性裁决**，不在索引即既有 `#boardNotFound`（`no docs match`，exit 2）；④ **只有已入索引的 plan 才走文法判决**，坏文法渲 `! unparseable` 板面、exit 0。重叠情形取此序：**存在但读不出 ∧ 不在索引 → `cannot read`**（存在性已过、io 失败先于成员性）；读得到但不在索引的非 plan 文件一律 `no docs match`，其文法如何不参与裁决。

`--dry-run` / preview 与真派同批：preview 在坏 plan 上同样返回 BLOCKED，不降级。preview 的卖点是「先看这一轮会做什么」，让它照常输出等于把同一个谎报搬到第二个面。

#### 2.5 缺证据不得授权下游

`session/pipeline.ts` 的 `#waveState` 与 `#wavesExhausted`、`session/dispatch-authority.ts` 的 `#waveStation` 改吃 `PlanRead`：`undeclared` 保留今日语义（未进入 / 没关门 / 无站牌）。两个 `unreadable` cause 在可达路径上不进这三处——真派路径由 §2.3 的结构拒绝先一步拦下，板面路径由 `BoardNext.of` 先一步短路；因此「不授权」成立、`PipelineFaceState` 不必多出第四个值、令牌表不动。

`session/run.ts` 的 `Lifecycle#recordPlanSnapshot` 改吃 `PlanRead`：非 ready → 不记快照；「缺快照读作 stall」原样保留。账本是记录面，为一个坏 plan 把已完成的 wave 卡死在闭合点，会把读取缺陷升级成流程死锁，而 stall 已经给出了保守的正确答案。

#### 2.6 机械强制三项

- **唯一构造点门**：落门之前先删掉现存唯一一处越界构造，三件一次写清——① **`BriefRenderer` 的 parser 协作者整体删除**（`constructor(parser = new PlanDocType("plan"))`，默认参数一起没了，四个生产调用点无需再传解析器）；② **`taskHeadingPattern()` 迁出**——它是**文档类型的属性，不是渲染器的**：`contract/doc.ts` 的 `DocType` 已经暴露 `readonly slices: DocSlices`（`:287`），故该访问器（`render/brief.ts:65` 的 `this.#parser.slices.slices.find((slice) => slice.anchor === "### Task N:")?.valuePattern`）连同它的两条断言（`render/__tests__/render.test.ts`：pattern 仍匹配 `### Task 3:` / `### Task 12:`）搬去 `PlanDocType#slices` 的契约测试，renderer 因此既不解析、也不转发解析面，且不留一个只被测试使用的构造参数；③ **brief 只收 `text` + `doc`**——`render(text, doc, tasks)` / `taskBody(text, doc, tasks)` / `extract(text, doc, tasks)`（三面同形，不含「实现者决定」：`extract` 今日是公开面且解析就发生在它内部（`render/brief.ts:70`），也是 §1.1 那一行点名的解析点，故它同样收 `doc`、从 `doc.taskBlocks` 取块而不再解析），`text` 取自 `PlanRead.text()`、`doc` 取自 `PlanRead.doc()`，裸行切片（`planContent.split("\n")` 后按 `TaskBlock.range` 取任务段）与 `## Constraints` 节仍读 `text`，因为 brief 被哈希（D30 / P29），按 `fields[].lines` 重建 heading 字节会让已评审波次凭空重开。两个枚举分开数，不共用一个「四」：**构造点**四处（`face/gate.ts`、`face/lifecycle.ts`、`face/cli.ts`、`session/ledger.ts`；其中 `face/cli.ts` 只存 `#brief` 字段、构造、交给 `CliGate`，本身不调公开面，故在构造点里正确、不需要改）；**供值点**三处（`face/gate.ts` 的 `render`、`face/lifecycle.ts` 的 `taskBody`、`session/ledger.ts` 的 `#briefRevision` 里那次 `taskBody`）外加两处内部委托（`render/brief.ts` 的 `extract` 与 `taskBody`，与公开面同签名，也必须从解析切到 `doc.taskBlocks`），每处都从同一个 `PlanRead` 取两值传入；`#briefRevision` 的 `PlanRead` 由已在场景里的调用链传入（`session/run.ts:833` 的 `#recordReviewedWaveBrief` → `recordReviewedBrief(waveKey, planPath)` → `#briefRevision`），「不可得 → `null`」保持在本地；brief 因此不再解析、不再构造，构造点白名单只剩 `contract/doc.ts` 的登记行与 `infra/plan-source.ts` 两处，本门在未改动文件上为绿。门本身：`infra/__tests__/plan-source.guard.test.ts` 以 `contract/doc.ts` 的 `docTypeParsers` **登记行为参数**——每个 doc key 的 `new <X>DocType("<key>")` 只许出现在两处：它自己的登记行，以及该 doc 型指定的唯一读取点（plan 的是 `infra/plan-source.ts`）。规则通用，plan 只是第一个受益者：防复发靠规则，不靠再写一条 plan 专属 grep。扫描面是生产源码（`**/__tests__/**` 排除——测试合法地直接构造解析器），且同一测试禁止 `infra/plan-source.ts` 出现空 `catch`（biome 无现成规则，自定义插件的维护成本高于一条正则）。
- **三面一致性必红**：结构测试落 `session/__tests__/`（单进程内三集合都可达，不需要一次 CLI 调用同时看见三层），逐格比较三件 observable——板面渲染的 wave 行、`session/preflight.ts` 判定所用的 graph 的 wave 集、frontier 路由的 wave 键；健康 plan 与坏 plan 各一条。
- **合法降级不误伤**：`face/__tests__/board-view.test.ts` 既有的 `  wave     (none)` 格（真 undeclared）必须保持绿，新的 `(empty plan)` pin 紧挨它。

### 3. 失败面

#### 3.1 裸崩面的残留路径

场景装配先于 preview 与 usage 校验执行，`#renderWaveBoard` 又在拒绝分支之后。所有读取点都必须改吃同一个 `PlanRead`，否则会出现「门禁已拒绝、渲染先崩」的顺序漏洞。验收要求 stderr 不再出现 `cdd: ` 前缀的文法报文。

usage 校验的 `planIds` 成员判定在非 ready 时**跳过**——它今日排在 `#renderPreflightBlocked`（`face/cli.ts:779`）之前，若让非 ready 的空集跑到 `face/cli.ts:706-716`，每个请求 id 都会走 `this.#usage(node, …)` 报出 `cdd <verb>: task <id> not found in the plan`（`#usage` 返回 `never`，`error:` + exit 2），AC #3 的 `CDD_BLOCKED:` 就没机会渲出。落法：该循环以 `read.kind === "ready"` 为**执行前提**（不是以「集合为空」为信号）——结构拒绝拥有裁决权，usage 只校验一个可解析 plan 内部的 id 成员性。`BriefRenderer` 不再是这条要求上的风险面：默认参数删除后它**已无解析可抛**（§2.6），`render` / `taskBody` / `extract` 收的是 `PlanRead.text()` 与 `PlanRead.doc`——因此这条要求不再依赖「被前置拒绝挡住」的时序论证；§1.1 的顺序事实仍由 pin 钉住（doc-contract 拒绝先于 brief 渲染），但它现在是冗余保障，不是唯一保障。

#### 3.2 `(none)` 与退出码的既有 pin

`cli.test.ts` 把 `(none)` 降级与 exit 0 绑在一起，`board-view.test.ts` 钉着合法的 `  wave     (none)`。降级面重构后这两处 pin 必须仍绿——它们是「不误伤健康路径」的证据。

#### 3.3 IO 与语法分叉后的报文覆盖

`DocFs.read` 返回 `null` 已是 IO 面的事实（读不出），与文法坏结构（读得出、判不过）是两件事。两条词行各自被至少一条测试覆盖，避免只测其中一条就让另一条裸走。

#### 3.4 判定面的路径归因

`contract/judge.ts` 的 `#contextOf` 只把 `DocSyntaxError` 带出来，物化在 `validate` / `validateLedger`；两侧都必须补上 `ContractInput.path`，否则 `Finding.path` 会出现空串或读者路径，判定面的锚定失效；这个分支由 `contract/__tests__/judge.test.ts` 的新增用例（跑 `validate`）覆盖。

### Acceptance criteria

- `cdd board --plan` 指向一个重复 `#### DependsOn` 节的背景 plan（fixture），健康对照夹具仍是**单波 plan**（渲一行 `W1 {…}`）：该板与健康对照**恰好三处不同**，其余逐字节相同——① plan 行：`PlanRead.planLine(words)` 取代索引派生的 `name  version · status`，降级字形逐字节为 `  plan     <repo 相对路径> · ! unparseable`（标签与 `LABEL_WIDTH` 的 padding 由 `#nodeBoard` 的 `  ${row.label.padEnd(LABEL_WIDTH)}${cell.text}` 负责，`planLine` 只给格内容 `<repo 相对路径> · ! unparseable`，`trimEnd` 后无尾随空格）；② 波次格：`! unparseable`；③ `next:`：hop-less 的 `  next:    (none)`；stderr 恰一行 `CDD_WARN:`（含 `plan unparseable` 词行，由 `Cli#runBoard` 在打印渲染行之前写出），stdout 全文不含 `  wave     (none)`（doc 面降级字面由 `PlanRead.degradedWaveRow(words)` 生产，`(none)` 不再由 `waves()` 为空触发；健康行仍是 `#waveLines` 按今日路径装配），退出码 0 — pin `face/__tests__/cli.test.ts`
- 坏 plan 上板面的变化点**按面列出**、不用排除法：argv 面（`! unparseable`）与声明面（`! unreadable`）都是**同三处**——plan 行（`PlanRead.planLine(words)`）、波次格（`! unparseable` / `! unreadable`）、`next:`；`planLine` **两个面都生效**，不加面条件。`next:` 为 hop-less 降级 `  next:    (none)` 且无 `reason:` 行，**不得**等于健康 plan 的波次派生路由（不得出现 `review --type branch --plan …`）；健康 plan 上 `next:` / `reason:` 逐字节不变（AC #11 已覆盖）— pin `face/__tests__/cli.test.ts`
- `cdd implement --type wave --plan` 同一 fixture：输出 `CDD_BLOCKED:` 与 `reason: doc-contract`，报文含 plan 路径与字段名，stderr 不含 `cdd: task 27 carries the reserved section`（doc-contract 拒绝先于 brief 渲染），也**不含** usage 拒绝（`task <id> not found in the plan`——非 ready 时 `planIds` 成员判定跳过，结构拒绝拥有裁决权）；该面上拒绝必得发出：wave 面是 `audit: { kind: "task-graph" }`、`face/cli.ts` 给它 `doc: null`，拒绝不靠 doc-shape 块；`cdd implement --type branch --plan` 同一 fixture 同样输出 `CDD_BLOCKED:` 与 `reason: doc-contract`（branch 面与 plan 面共用 `face/cli.ts:1237` 的同一处读取与 `session/preflight.ts:509` 的同一解析点），且 stderr 不得出现裸 `cdd: ` 文法报文 — pin `face/__tests__/cli.test.ts`
- 已声明但读不出（存在、权限拒绝）的 plan，声明面 exit 0：`cdd board --spec <声明 plan: 的相位文档>` 的 wave 格为 `! unreadable`、stderr 含 `plan unreadable` 词行（由 `Cli#runBoard` 写出）、`next:` 为 `  next:    (none)`，且同一块板面的 plan 行渲声明路径——不是 `(none)`、不是 `(SLUG-MISSING)`，与波次格同源；与文法坏结构各由一条用例覆盖。同一族第三条：**声明可读但未被索引收进去**（plan 文件缺 `doc-type: plan`，或声明的新 plan 覆盖了旧 entry）→ plan 行是声明路径（不是 `(none)`、不是被覆盖文档的 `name  version · status`），wave 行照常健康（`W1 {…}`），两者不混排。越域声明（绝对路径 / 含 `..` 逃出 doc roots）另有一条用例：该相位被 `doc-contract` 拒绝（报文取 `planPathInvalid` 词行）、板面 plan 行**逐字面对照** `  plan     ! unparseable`（`path === ""` 丢掉分隔符；只断言「不打出该路径」等于没断言——空路径天然满足）、不回显机器绝对路径或越域原值、且该值从未抵达 `DocFs.read` — pin `face/__tests__/cli.test.ts`；值 pin `infra/__tests__/plan-source.test.ts`
- argv 面保持拒绝，且归类顺序写死——**判定 0 是存在性探针**：`cdd board --plan <不在 doc roots 或盘上无此文件>` 零文档读取即走 `#boardNotFound` 的 `no docs match`（exit 2，ghost-path pin 不变）；**存在则先读字节**：`cdd board --plan <存在但读不出>` exit 2，stderr 报文含 `cannot read`、**不含** `no docs match`，且不出板面；字节读到后**由索引成员性裁决**：不在索引即 `#boardNotFound` 的 `no docs match`（exit 2，已钉）；只有**已入索引的 plan** 才走文法判决（`! unparseable` 渲板面 exit 0）。两条重叠用例钉此序：① **存在但读不出 ∧ 不在索引** → `cannot read`（存在性已过，io 失败先于成员性）；② 读得到 ∧ 不在索引 ∧ 文法也坏 → `no docs match`（其文法如何不参与裁决）— pin `face/__tests__/cli.test.ts`
- plan body 带重复保留节时，`validate` 产出一行 `Finding`（`#contextOf` 只把 `DocSyntaxError` 带出）：`path` 非空且等于契约路径、`field` 指到该节、`kind` 为 `"doc-syntax"`、无异常逃逸 — pin `contract/__tests__/judge.test.ts`
- `ready` 但零 task block 的 plan 渲 `(empty plan)`（字面取自端口成员 `planEmptyWord()`；doc 面由 `PlanRead.degradedWaveRow(words)` 渲、程序面由 `PlanRead.cell(words)` 渲，两面同字面），既不是 `(none)` 也不是空串 — pin `face/__tests__/board-view.test.ts`（紧挨既有的 `  wave     (none)` 一条）
- 程序面上真 undeclared（该相位没有 plan）的波次格仍为 `""`，与 `(empty plan)` / `! unparseable` / `! unreadable` 三语义互不混同；同一张程序板里坏 plan 的相位波次格为 `! unparseable` / `! unreadable`，每个坏 plan 各出**一行** `CDD_WARN:`（含该相位 `slug:`）到 stderr——写者是 `Cli#runBoard`，按 §2.1 的有序逐相位值表逐行写出——格内不另造标记；健康相位行的波次格仍为 `wave W1…`——`cell(words)` 在 `ready` 且有波次时返回 `null`，`#programBoard` 得 `null` 才按今日路径渲 `waves[0]!.label.split(" ")[0] + "…"`，逐字节对照（「生产者签名产不出既有字节」这一类回归必须有红 pin） — stderr 断言行 pin `face/__tests__/cli.test.ts`，格面 pin `face/__tests__/board-view.test.ts`
- 三面一致性：结构测试同进程内比较板面渲染的 wave 行、`PreFlight` 判定所用 graph 的 wave 集、frontier 路由的 wave 键，逐格相等；健康与坏 plan 各一条 — pin `session/__tests__/`
- 唯一构造点门：按 `docTypeParsers` 登记行参数化，每个 doc key 的构造点只出现在登记行与其唯一读取点——plan 只剩两处：`contract/doc.ts` 的登记行与 `infra/plan-source.ts`（`render/brief.ts` 的 parser 协作者与默认参数已整体删除、`taskHeadingPattern` 已迁入 `PlanDocType#slices` 的契约测试），且该文件不含空 `catch` — pin `infra/__tests__/plan-source.guard.test.ts`；`taskHeadingPattern` 的两条断言（`### Task 3:` / `### Task 12:`）随访问器迁入 `contract/__tests__/doc.test.ts` 的 `PlanDocType#slices` 契约用例
- 真 undeclared 的 phase 文档仍渲 `  wave     (none)` 且退出码 0 — pin `face/__tests__/board-view.test.ts`
- 健康 plan 的板面、`next:`、`reason:` 逐字节不变 — pin `face/__tests__/board-view.test.ts`
- `--dry-run` / preview 面在坏 plan 上同样 BLOCKED，不降级 — pin `face/__tests__/cli.test.ts`
- `pnpm run validate` exit 0；changeset：cdd-engine **minor**（新增拒绝面与一格渲染字面属消费可见字节变化，D74）

## Constraints

- plan grammar 语义不动：`#### DependsOn` 仍只许一节，其余重复节规则与报文措辞保持
- `doc-contract` 判定语义不动，既有拒绝报文（front-matter 行）逐字节不变；不新增 gate id 与 reason token，不新增 station kind
- 判定面按值收 `contract/judge.ts` 的 `ContractInput.content`，读盘归 `infra/`（`infra/slug-index.ts` 同处；`contract/invariants.ts` 的 `DocFs` / `NodeFs` 是既有读缝，不是新职责）
- phase 头的 `plan:` 声明是可选增量键，缺省回落 `index.planOf`；不重写 `infra/slug-index.ts` 的扫描谓词
- progress 账本口径与 `recordPlanTasks` 的形状不动；`session/run.ts` 的 stall 语义保留
- 不新增 CLI 动词或旗标，不重排 board 既有列与 `next:` / `reason:` 字节
- 无 module-level 裸函数；新类按 OOP-first 落（状态与行为共变），单一职责

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-11-14 | 初稿：plan 读取收权（`infra/plan-source.ts` 的 `PlanRead` 三态、`PlanSyntaxError` → `Finding`、复用 doc-contract 拒绝通道、降级显式化、缺证据不授权、三项机械强制） | [human] 裁定 · Claude（kairos:cdd-design · 2026-11-14） |
| v0.2 | 2026-11-14 | 评审修复轮（F1–F13）：读取点清单按实测重列为 8 读取点 + 1 登记行 / 三策略并单列渲染消费点；守卫主体改为按 `docTypeParsers` 行参数化的构造点白名单；`#recordPlanSnapshot` 改吃 `PlanRead`；`! unreadable` 的 board 可达面改由 phase 头 `plan:` 声明解析（`#scanRoot` 不动）；`#programBoard` 的 `waveCell` 重钉；坏 plan 上 `next:` / `reason:` 逐字节不变 + 不新增 station kind；补 `contract/__tests__/judge.test.ts` 的 `Finding` 验收；接线写明 `Cli.create()` 组合根、`PlanRead` 随 `WorkScene` 下行、`graph` eager、`text()` 非抛；新增 `(empty plan)` 语义；`DocSyntaxError` 入 `contract/doc.ts` 且 `kind` 统一为 `"doc-syntax"`；`CDD_WARN:` 定 stderr；`""` 只属真 undeclared；三面一致性移入 `session/__tests__/` 结构测试；overall 同步 v3.63（D90 ① / Phase-inventory P35 的 `contract/` → `infra/`、计数 8+1 / 三策略、`纯文本面` 前提更正） | [human] 裁定 · Claude（kairos:cdd-design · 2026-11-14） |
| v0.3 | 2026-11-14 | 评审修复轮（F1–F7）：坏 plan 上板面不派生波次路由——`BoardNext.of` 短路到既有的 hop-less `  next:    (none)`（无 `reason:` 行），删除「board 不跑 preflight 因此字节相同」的假推断，`undeclared` 不在短路之列；AC #2 改两段（健康 plan 字节不变 + 非 ready 上波次格与 `next:` 是仅有的两处变化，`next:` 不得等于健康 plan 的波次派生路由）；`plan:` 声明面补全（`FrontMatterHead#plan` + `DocEntry.declaredPlan`，索引只解析一次），声明路径提升为只带路径的 plan entry 使 doc 面 plan 行与波次格同源；`cdd board --plan` 按读的结局归类（存在但读不出走 `unreadable`，不存在走 `#boardNotFound`）；`PlanSource` 收两个入口 `readDeclared` / `readPath`，板面静态方法改为收值不再自读；`#contextOf` 只带出 `DocSyntaxError`、`Finding` 由 `validate` / `validateLedger` 物化；AC #1 字面校正（指向 / `  wave     (none)`）；§2.4 补 `#programBoard` 的逐相位 stderr warn；overall 同步 v3.64（Phase-inventory P35 的 ④ 可测形式与 ⑤ 构造点门） | [human] 裁定 · Claude（kairos:cdd-design · 2026-11-14） |
| v0.4 | 2026-11-14 | 评审修复轮（F1–F5）：F1 取 (b) 作 argv 面机制——`cdd board --plan <存在但读不出>` 不出板面、保持 exit 2 但报文改为 `cdd board: cannot read --plan <path>: <原因>`，`! unreadable` 的 exit 0 渲染只经相位 `plan:` 声明到达且 plan 行从 `PlanRead.path` 字符串渲染（不包 `DocEntry`、不进 `#entryMark` / `#docCell` blocked），§2.1 的空 slug 句改为正向约束，AC #4 拆声明面 / argv 面两条；F2 删除 `BriefRenderer` 的第二处解析（默认参数删除，`#extract` / `#render` 收 `PlanParsed`，三调用点传 `PlanRead.doc`），§1.1 顺序事实与 §3.1 论证同步改为「已无解析可抛」，AC #9 白名单字面收窄为登记行 + `infra/plan-source.ts`；F3 AC #1 加单波夹具前提并改判「wave 行以外逐字节相同」；F4 点明 `CDD_WARN:` 写者为 `Cli#runBoard`（overall 板按有序逐相位值表各写一行，行内带相位 id），AC #1 / AC #7 的 stderr 断言指向它；F5 §2.3 补 `graph` 门只在 `read.kind === "ready"` 时运行、其余记 `skipped`，故 plan 面第一处拒绝恒为 `doc-contract` | [human] 裁定 · Claude（kairos:cdd-design · 2026-11-14） |
| v0.5 | 2026-11-14 | 评审修复轮（F1–F5）：F1 AC #1 / AC #2 改为**按面列变化点**（argv 面与健康单波对照恰好三处不同：plan 行、波次格、`next:`），`planLine` 两个面都生效、不加面条件；F2 `session/ledger.ts` 的 `#briefRevision` 补进 §1.1 表（第九行，策略 `catch → null`），计数口径改为「**到达 plan 解析的站点**」并写死 9 读取点 + 1 登记行 / 四策略，§2.6 调用点清单改四处，`#briefRevision` 的 `PlanRead` 来源写清（`session/run.ts:833` → `recordReviewedBrief` → `#briefRevision`），overall 同步 v3.65；F3 brief 两个面声明为 `render(text, doc, tasks)` / `taskBody(text, doc, tasks)`（`PlanRead.text()` / `PlanRead.doc()`，`text` 保住裸行切片与 `## Constraints` 节的字节基准、避免哈希重开），§3.1 同步；F4 `plan:` 值钉域（repo 相对、经 `RepoRoot`、不得绝对路径 / `..` 越界，越域值不入 `DocFs.read`、按 `doc-contract` 结构拒绝，新增 `Words` 行 `planPathInvalid`），AC #4 补越域用例；F5 argv 面归类顺序写死（先读字节 → 成员性 → 文法），§2.4 / AC #5 各补两条重叠用例 | [human] 裁定 · Claude（kairos:cdd-design · 2026-11-14） |
| v0.7 | 2026-11-14 | 评审修复轮（F1–F6）：F1 把 `branch` 加入 §2.3 的拒绝面集合（`case "plan"` fallthrough 进 `case "branch"`，同一 `--plan` 要求、同一 `#targetSlug` 文本消费者、同一 `#ledgerFactsOf` 解析点），过时的 `face/cli.ts:805` 注释 pin 换成符号 pin `face/cli.ts:1237` 与 `session/preflight.ts:509`，AC #3 增 branch 面可观察（`CDD_BLOCKED:` + `reason: doc-contract`、stderr 无裸 `cdd: ` 文法报文）。F2 doc 面生产者的职责切窄：`waveRows(words)` 改名并限定为 `degradedWaveRow(words): string \| null`（三种降级字面量，`ready` 且有波次 → `null`），`#waveLines` 仍是装配者、健康行按今日路径一字不改，AC #11 保持字节断言，AC #1 / #9 指向 `degradedWaveRow`。F3 收回 `infra/plan-source.ts` 的 `Finding` 物化（`unreadable` 的 `path` / `message` / `field` 与 `refusal()` 的 `{gate, reason, message}` 就是失败值），物化只在判官边界 `validate` / `validateLedger`（含 `fix`），按 D26「一事实一处」。F4 §2.6 ③ 写死第三个公开面 `extract(text, doc, tasks)`（与 `render` / `taskBody` 同形、从 `doc.taskBlocks` 取块），守卫的「唯一读取点之外无解析」覆盖到每个公开方法。F5 §2.4 括注改为与判定 ③ 同义——`no docs match` 同时覆盖「不存在」与「读得到但不在索引」两种非读取失败。F6 `readDeclared` 回落写成可编译形状 `entry.slug === null ? null : index.planOf(entry.slug)?.rel`（`planOf` 收非空串，`face/board-view.ts:281-296` 同形守卫） | [human] 裁定 · Claude（kairos:cdd-design · 2026-11-14） |
| v0.6 | 2026-11-14 | 评审修复轮（F1–F6）：F1 §2.3 的拒绝点**搬出 doc-shape 块**，改为 preflight 里一道不挂门的独立判定——位置在 in-flight 之后、graph 门之前，依据场景里的 `PlanRead`（不是 `ctx.doc`），`wave` 面到达时 `ctx.doc === null` 照样拒；记账写清：doc 面上 `doc-contract` 已在 gate 计划里故同时入 `checked`，wave 面不在计划里故不入 `checked`，doc 面既有行不动。F2 非 ready 时跳过 usage 的 `planIds` 成员判定（以 `read.kind === "ready"` 为执行前提，不以集合为空为信号），AC #3 增可观察：坏 plan 的 stderr 不得出现 usage 拒绝。F3 doc 面波次行给独立生产者 `waveRows(words)`（`undeclared` → `(none)`、`ready` 零 task block → `(empty plan)`、非 ready → `! unparseable` / `! unreadable`），`#waveLines` / `#nodeBoard` 从它渲、不再以 `waves()` 为空作为 `(none)` 信号，`cell(words)` 只属程序面（`undeclared` → 空串），AC #1 / AC #9 的字节断言随之指向 `waveRows()`。F4 归类顺序补**判定 0 = 存在性探针**（`insideDocRoots` + `existsSync`，与今日代码同序、ghost-path pin 不变），重叠用例改写为「存在但读不出 ∧ 不在索引 → `cannot read`」。F5 `taskHeadingPattern()` 是文档类型的属性而非渲染器的（`DocType` 已暴露 `readonly slices: DocSlices`），访问器连同两条断言迁到 `PlanDocType#slices` 契约测试，`BriefRenderer` 的 parser 协作者整体删除（默认参数一起没了，四个调用点无需传解析器），§2.6 一次写清三件。F6 §2.1 行为清单补 `doc(): PlanParsed \| null`（非 ready → `null`），紧挨 `text()` | [human] 裁定 · Claude（kairos:cdd-design · 2026-11-14） |
| v0.8 | 2026-11-14 | 评审修复轮（F1–F5）：F1 程序面照 doc 面同一个逃逸写——`cell(words: PlanReadWords): string \| null`，`ready` 且有波次 → `null`（健康格不由本访问器负责），`#programBoard` 得 `null` 才按今日路径渲 `waves[0]!.label.split(" ")[0] + "…"`（即 `W1…`），其余四语义不变；§2.4 补成与 doc 行对称的一对，格面 AC 扩一条健康相位行的 `wave W1…` 红 pin。F2 降级 plan 行的字节形写死：`planLine()` 只返回格内容 `<repo 相对路径> · <标记>`，标记复用波次格的 `! unparseable` / `! unreadable`，标签与 `LABEL_WIDTH` 的 padding 仍由 `#nodeBoard` 的 `  ${row.label.padEnd(LABEL_WIDTH)}${cell.text}` 负责，AC #1 按波次格同样的方式逐字面对照含 padding 的完整字形。F3 §1.1 与 §3.1 的「两面」改三面（`render` / `taskBody` / `extract`）。F4 §2.3 的记账枚举补第三种情形：`branch` 面同 wave 面不入 `checked`（`session/faces.ts` 给它 `audit: { kind: "branch-tree" }`，`isDocShape` 为 false，`doc-contract` 不在它的 gate 计划里）。F5 §2.6 的行号按符号校正：`taskHeadingPattern` 的 `slices.slices.find(...)` 在 `render/brief.ts:65`、`extract` 的 `const parsed = this.#parser.parse(...)` 在 `render/brief.ts:70` | [human] 裁定 · Claude（kairos:cdd-design · 2026-11-14） |
| v0.9 | 2026-11-14 | 评审修复轮（F1–F4）：F1 plan 行的事实源写死为 `PlanRead.path`——解析到索引里的 `DocEntry` 走 `#docCell`（今日字节不变），否则走 `planLine`，故声明可读但未入索引（缺 `doc-type: plan` 或新 plan 覆盖旧 entry）渲声明路径而非 `(none)` / 旧文档的 `name  version · status`，「一分为二」在任何 kind 上都不发生，§2.1 整段按此重写、AC #4 增该条；F2 空路径哨兵逐字写死（`path === ""` 丢掉分隔符，逐字节 `  plan     ! unparseable`），`planLine` 的触发条件补 `ready` 但未入索引一支，AC #4 的断言从「不打出该路径」升级为逐字面对照该行；F3 §2.6 ③ 把构造点四处与供值点三处外加两处内部委托分开枚举，不共用一个「四」；F4 `(empty plan)` 走独立端口成员 `planEmptyWord()`（与 `cellEmpty` 并列），`planReadWord(cause)` 只承担 `io` / `syntax`，理由（健康但空不是读失败，塞进失败词法会让测试从同一处推字面量而永不红）写进 §2.4 | [human] 裁定 · Claude（kairos:cdd-design · 2026-11-14） |
