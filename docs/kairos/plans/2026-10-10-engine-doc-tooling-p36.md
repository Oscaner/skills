---
title: '引擎文档工具（Engine Doc-Tooling）— P36 计划：身份面收权（身份域 × 产物矩阵 · 缺席有门 · 形状可发现）'
doc-type: plan
version: v0.29
date: 2026-11-16
slug: 2026-10-10-engine-doc-tooling-p36
base: develop
---

## Constraints

- **逐字取 spec**：本计划只实现 `docs/kairos/specs/2026-10-10-engine-doc-tooling-p36-design.md`（slug `2026-10-10-engine-doc-tooling-p36`）**在本轮被消费那一刻的 `version:`** 所指的面。本 bullet 只记「哪一节落在哪个任务」，**不记版本坐标**——spec 再升一版也不需要改这一行；本计划实际消费的是哪一版，记在 `## Change history` 里本轮那一行。规范增量的落点：§2.5 的两级归属判据与 AC「归属（两级）」的「认领两档各一条 pin」归 T5、§1.4 的「注册时基线 + 已交付随注」归 T1、§2.2 的无 cycle 往返例外归 T2、AC「`#485` 面」的 (c) 格 coverage pin 归 T4（波 4/5 只交了接线；链级 pin 由本相位分支评审第 1 轮的 F1 补交付，见本行 `## Change history` v0.22）；§2.3 的两级合成（`#artifactReadOf` = 矩阵 `read` × `CarrierRulings#verdict`，`invalid.reason` 原样是 schema 原因、矩阵永不解析内容）归 T6——照任何一版更早的字面实现，这几处 AC 要求都会漏。
- **守恒边界**：既有六 kind（`draft` · `final` · `report` · `log` · `crash` · `evidence`）+ 三个工作区字面量（`progress.json` / `base.json` / `in-flight.json`）+ `tasks-{tasks}-brief.md` 的**名字逐字节不变**；P31/P34 已交付 pin 只许新增不许翻。历史拼写的可读性**不在**守恒面（spec §3.3）。
- **`rulings` 身份只有一个源**：坐标 = `attribute(path.basename(the --reviews 载体))` 回出的那个 round 身份——**被评审的那一轮**，`op` 恒为 `review`，`cycle` / `attempt` 取载体自己的坐标。prompt 格、门的 `derived:` / `identity:`、`next:` 的读回值都从这一个身份渲染；**不得**用本轮（fix 轮）的 `(line, op)` 算，那会铸出 `plan-fix-1.c1.rulings.json`——一个没有门看得见、child 却会照着写的第二个表达式（spec §2.1 / §2.4 / §2.10）。
- **引擎只拒不改**：任何产物（载体、sidecar、文档）不得被移动、改写或删除；修复动作归编排器。
- **视图面零判定权**：board / capsule / preview 只渲染矩阵判定结果，不得重新推导名字。
- **零裸函数**：`packages/cdd-engine/src-next` 与 `packages/kairos/tests` 内不写行首 `function `；类或 `const` 箭头。静态面确有必要时带一行 `// biome-ignore lint/complexity/noStaticOnlyClass:` 理由。
- **一次读取**：任何读面（prompt 格、门、板面）读同一个判别值，不各读一次。
- **消费面纯度**：skill 文本零程序史 / 零相位号 / 零引擎内部实现词。

## Review Focus

- **同一 slug 两份身份文档**：读面若仍取第一份，board 与 doc 轮会渲出「这个 slug 没有身份文档」而盘上明明有两份。期望：`read` 回 `invalid(found:[a,b])`，`attribute` 仍回身份（歧义在身份侧、不在名字侧）；派发硬停由既有 `SlugIndex#slugVerdict` 的 `duplicated`（`doc-contract`）承担，doc 域不在 T6 那道门的作用面内 — 由 T3 的读取面（doc 域 `read` 的 `invalid(found)`）与 T3 Step 1 / T3 Acceptance 钉。
- **扫描根不干净但另一根干净**：一个脏 `specs/` 根加一个干净的 `plans/` 根，若两个判断读同一对合计计数，干净 miss 会被误判成未判态（`(none)` + `CDD_WARN:` 换掉 `undeclared` + `kairos:cdd-plan`）。期望：plan 路径的「干净」只读 plans 根那对计数 — 由 T4 Step 2 的混合格与 T4 Acceptance 钉。
- **无 cycle 身份**：`rulings` 与 `final` 同 stem、渲染名不含 `.c<cycle>` 段，`-a1` 从不铸出。期望：每个 rendered kind 的往返 pin 跑两遍（带坐标 / 不带坐标）；该形态下 `draft` 与 `final` 本就同名，故**只断身份**、`kind` 归一 `draft`，`misplaced` 只剩显式 `-a1` 一格 — 由 T2 Step 4 钉。
- **P34 前 legacy 载体仍在盘上**：`spec-review-1.json`、无 cycle 的 `tasks-1-implement.json` 在拆掉读法后必须**不被拦**，但两者走**不同的出口**，不可写成同一句：`spec-review-1.json` ⇒ `attribute → null` ⇒ orphan（一级）；无 cycle 的 `tasks-1-implement.json` ⇒ `attribute` 仍**归主**（spec AC ① 的往返 pin 要求 `attribute(render(无 cycle 身份)) === 身份`，`RoundNaming.renderName` 就把无 cycle draft 渲成这个名字），它的 `orphan:` 行由**第二级**（「归主的是 round 域载体、而无记录认领」）给出——交付后这一级只有一个答案，`Ledger#claimed` 的两档同时落空：身份档读矩阵自己的 `roundIdentityKey`（`cycle` 缺席 ≠ `cycle: 1`，只有 `attempt` 缺省折成 1，因渲染器从不铸 `-a1`），路径档读 `carrierPathOf` 的 basename，而 #legacyCarrierName 梯级已随 T8（波 6/8/10）拆除、该函数对这一名字回 `""` ⇒ 无人认领 ⇒ 才成 `orphan:` 行。三格按**用例名**定位（该文件已两轮因行号漂移被判）：`session/__tests__/ledger.test.ts` 的「lists a pathless legacy fixture's implement carrier — the folded round is cycle 1, the name is cycle-less」今日回 `["tasks-1-implement.json"]`；同族的「carrierPathOf reads `""` for a pathless cycle-less IMPLEMENT record — the pre-P34 rung is gone」与「orphanHandoffs lists a cycle-less implement carrier — a cycle-1 record never claims it」是同一判据的另一面。**别把 `[]` 那几格读成这一形态的现状**：「claims a doc-line carrier whose record remembers its own path — the basename tier」是一条**正例** pin（记录带绝对 `carrierPath`、扫描给裸名、身份不等而 basename 相等 ⇒ 不上 `orphan:`），不是待翻的反例。期望：派发零拒绝 — 由 T8 的 `session/__tests__/handoff-plane.guard.test.ts` pin（exit 0 · 零 `CDD_BLOCKED` · 两文件各落一行 `orphan:`）与 T8 Acceptance 钉。
- **半迁移 workspace（渲染名与变体并存）**：迁移做一半正是「渲染名合法 + 同身份另一个能归主的名字」的现场。期望：多候选优先于 `ok`，报文列全、不选、不写 — 由 T5 Step 1 与 T6 Step 4 钉。

---

### Task 1: 矩阵骨架与 `WorkspaceDomain`

#### Objective

把「名字从哪来」立成一张封闭登记表：`session/round-artifacts.ts` 落 `Kind` / `Identity` / `Attributed` / `ArtifactRead` / `IdentifierVocabulary` / `ArtifactRow` 六个值类型、`IdentityDomain` 契约与 `ArtifactRegistry` 深类（`entries()` · `rows()` · `rowOf(kind)` · `render(identity, kind)` · `attribute(name)` · `locate(identity, kind, base)` · `read(identity, kind, base)`），首批只登记 workspace 四行（`progress` · `base` · `in-flight` · `brief`），并给出往返 pin 的骨架。`brief` 的生产拼写同期改经矩阵（`RoundNaming#brief` / `#briefName` 只做委托，两个调用点随改）——否则矩阵行与 `briefName` 就是同一个名字的两个家，而没有任何门会红。矩阵的**唯一构造点与注入面**也由本任务钉住：命令前导一次构造，向下注入**五个**读面——`Lifecycle`（opts 字段）· `Ledger`（构造器第 4 参）· `CarrierSeal#sweep` 与 `BoardView.render`（显式入参）· `NextStepRouter`（构造器注入；`Ledger#router` 与 `Run#router` 的构造点因此改为构造体内赋值——字段初始化先于构造体执行，registry 又是构造器入参，而 `erasableSyntaxOnly` 禁参数属性，T9 的算值入口挂在这条注入上）。矩阵**不绑 workspace**：`locate` / `read` 的 `base` 是读取时的坐标——一块板一次渲多个节点 workspace，绑死一处就会把别的节点的名字解析到这一处（「名字看着合法、坐标是别人的」，本相位要消的正是这一类）；spec §2.2 的契约形状已按交付实现回填（`locate` / `read` 都收 `base: Workspace`，其 Change history 的 v0.9 行记的正是这次回填），本任务只做对账、不再提请回填。本任务**不迁移** round / doc 两域（它们是 T2 / T3），但 `Identity` 的判别联合一次写全，`ArtifactRow` 的字段面按 spec §2.1 定形（`identifier?` / `policy?` 在，**无** `attribution` 字段——归主文法不进类型，见 T5）。

#### Files

- Create: `packages/cdd-engine/src-next/session/round-artifacts.ts`（值类型 + `IdentityDomain` + `ArtifactRegistry` + `WorkspaceDomain` 实现；`RoundDomain` / `DocDomain` 由 T2 / T3 登记进同表的同一处）
- Create: `packages/cdd-engine/src-next/session/__tests__/round-artifacts.test.ts`
- Modify: `packages/cdd-engine/src-next/session/inflight.ts`（`InFlight.FILE` 的字面移入矩阵，读点经 registry 取；不改值）
- Modify: `packages/cdd-engine/src-next/face/artifacts.ts`（**已交付随注**：类名是 `CliArtifacts`——树里没有 `Artifacts` 这个类；`baseSet` / `baseGet` / `#readBase` 三面已各自经私有 `#baseName()` 问矩阵（`this.#matrix.render({ domain: "workspace", tasks: null }, "base")`），`base.json` 字面单源在 `session/round-artifacts.ts` 的 `WORKSPACE_LITERALS`；本任务只核零字节差）
- Modify: `packages/cdd-engine/src-next/face/cli.ts`（`Cli#baseBranchOf` 的 `base.json` 字面改经 registry；命令前导（`#runBoard` / `#runWork`）一次构造 registry 并向下注入五个读面；字节不变）
- Modify: `packages/cdd-engine/src-next/session/round-naming.ts`（`briefName` 只做矩阵渲染的委托；`brief` 走同一渲染）
- Modify: `packages/cdd-engine/src-next/face/gate.ts`（`CliGate#renderBrief` 的 brief 名取同一渲染——委托后的同一个值，零第二模板）
- Modify: `packages/cdd-engine/src-next/face/preview.ts`（`#readsOf` 的 `would re-render` 面读同一渲染）
- Modify: `packages/cdd-engine/src-next/session/ledger.ts`（**已交付随注**：`readProgress` / `writeProgress` 是两个**公开**成员（无前置 `#`），两者都已各自经私有 `#progressName()` 问矩阵；`#router` 已改为构造体内赋值——声明为 `readonly #router` 字段、赋值在构造体，注释即「Built in the constructor body, never as a field initializer」，registry 走构造器第 4 参；本任务只核零字节差）
- Modify: `packages/cdd-engine/src-next/session/next.ts`（`NextStepRouter` 增构造器接注入 registry——只改构造与字段持有，决策表与 `Route` 的判别联合不动；算值在 T9）
- Modify: `packages/cdd-engine/src-next/session/run.ts`（`#router` 的 `opts.router ?? new NextStepRouter(...)` 与命令前导传同一实例）

#### Consumes

- `session/round-naming.ts` 的 `ArtifactKind` / `RoundArtifact` / `renderName` 既有形状（T2 复用，本任务不依赖其内部）
- `infra/runtime.ts` 的 `ENGINE_RUNTIME`（`brief` 的作者与读面）
- 既有 pin：`face/__tests__/cli.test.ts` 的 `base` 用例（`base.json` 字面）、`session/__tests__/ledger.test.ts` 的 progress 读写、`session/__tests__/round-naming.test.ts` 的 `minted` / accepted-orphan 枚举（按内容定位：该文件今日只有 `minted`（`:510` 起、循环 `:531`），`neighbours` 已不在该文件——归属重锚在 T5；`"base.json"` 今日落在 `:550`）

#### Produces

- `type Kind`（联合：`draft · final · report · log · crash · evidence · rulings · progress · base · in-flight · brief`）
- `type Identity = {domain:"round"; line; op; cycle; attempt} | {domain:"doc"; slug; docType} | {domain:"workspace"; tasks: string | null}`
- `type ArtifactRead = {kind:"absent"} | {kind:"ok"; path} | {kind:"invalid"; path; found?: readonly string[]; reason} | {kind:"misplaced"; derived; found: readonly string[]; identity}`
- `type Attributed = {identity; kind}`
- `type IdentifierVocabulary = {canonical: string; accepts: readonly string[]}`
- `type ArtifactRow`（spec §2.1 逐字形状）：`domain` / `author` / `sealed` / `identifier?` / `policy?` + `{identityFrom:"rendered"; render; misplaced:"block"}` | `{identityFrom:"declared"}`；**零 `attribution` 字段**、零 `absence` 列
- `type MatrixEntry = { kind: Kind; row: ArtifactRow }`（行集带键的投影：`kind` ↔ `row` 的绑定与行同住，读面走封闭集时不必再拼一次 kind 列表）
- `interface IdentityDomain`：`kinds()` · `entries(): readonly MatrixEntry[]` · `attribute(name): Attributed | null`（无第三态）· `locate(identity, kind, base: Workspace): string | null` · `read(identity, kind, base: Workspace): ArtifactRead`
- `class ArtifactRegistry`：矩阵的七个对外方法（`entries` · `rows` · `rowOf` · `render` · `attribute` · `locate` · `read`），按 `Identity.domain` 分派到三个 `IdentityDomain`；构造器收域表（默认值按**交付后事实**是 `[new RoundDomain(), new WorkspaceDomain()]`——`RoundDomain` 由波 2/3 登记；测试可注入夹具域以看见 `sealed: true` 那一臂），**不绑 workspace**
- `ArtifactRegistry` 的唯一构造点与注入面：命令前导一次 `new ArtifactRegistry()`——就是 `Cli` 构造器里的那一行（`CliOptions.artifacts` 让测试注入一个记录型实例，见 Acceptance），`CliArtifacts` 与 `#sceneOf` / `#runBoard` 都读同一个字段；`Lifecycle`（opts 字段）· `Ledger`（构造器第 4 参）· `NextStepRouter`（构造器）按构造器注入，静态面 `CarrierSeal#sweep` 与 `BoardView.render` 按显式入参接同一实例；`NextStepRouter` 的生产构造点（`face/cli.ts` 的 `#sceneOf` · `session/ledger.ts` 的构造体 · `session/run.ts` 的构造体）传同一实例，`Ledger` 那处从字段初始化改为构造体内赋值——**零模块级默认实例、矩阵外零构造点、无「取回注入」的公开访问器**（`Ledger#artifacts()` / `NextStepRouter#artifacts()` 不设：只为取回注入而存在的读口让「注入掉了」在类型与测试两侧都不红）
- `Workspace#names(): readonly string[]` —— **已交付随注**：波 1 交付的是 `entries()` / `nameOf`，`Workspace#names()` 随 T5 落地（`infra/workspace.ts:125`），`Ledger#workspaceFiles` 与其 `readdirSync` 一并消失（`session/ledger.ts` 今日零 `readdirSync`）。归属分层照旧（构造面归波 1、`names()` 与「#workspaceFiles 并入它」归 T5）；形态记在这里只作共享前提——workspace 目录名清单的唯一读口，一次读取供两个消费者（`read` 的 `found` 枚举与 `Ledger#orphanHandoffs` 的候选集），`found` = `names()` 经 `attribute` 过滤到该 `(identity, kind)` 的集合，不新开第二次目录扫描（spec §2.3 的「`misplaced` 不引入新扫描面」），变体表也不另立（归主文法只有 `attribute` 一处反解，见 T5）
- `brief` 的唯一渲染：`render({domain:"workspace", tasks}, "brief")`；`RoundNaming#brief`（公开，`#workspace.resolve(this.briefName(tasks))`）· `#briefName`（矩阵委托，经 `ArtifactRegistry.nameOf("brief", tasks)`）· `CliGate#renderBrief` · `Preview#readsOf` 都是它的委托
- `ArtifactRegistry.nameOf(kind, tasks)`：同一行渲染的**模块级入口**（无实例的 workspace 读面——`InFlight.FILE` 这类静态常量——用它；`nameOf` 只服务 workspace 四行，round 行的模块级入口是 T2 的 `renderRound`），逐字委托行渲染 `renderWorkspace`，不是第二拼写；pin 断言它逐 kind 等于 `render({domain:"workspace", tasks}, kind)`

#### Steps

- 写失败测：`round-artifacts.test.ts` 断言 `rows()` 含四行 workspace kind、每行的 `author` / `sealed` / `identityFrom` 三格非空 —— checkable: 该文件跑红，报 `ArtifactRegistry` 未导出
- 实现六个值类型 + `MatrixEntry` + `IdentityDomain` + `ArtifactRegistry` 壳 + workspace 四行 —— checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/session/__tests__/round-artifacts.test.ts` 绿
- 写往返 pin：四行的 `attribute(render({domain:"workspace"}, kind))` 回到同一 `kind`，且 `render` 出的名字与今日字面逐字节相等（`progress.json` / `base.json` / `in-flight.json` / `tasks-{tasks}-brief.md`） —— checkable: 该断言绿
- 写坐标守卫 pin：`brief` 的 `tasks` 为 `null` / 空串、三个字面量的 `tasks` 非 `null` ⇒ `render` 与 `nameOf` 两条入口都抛错（`it("refuses an identity the row does not carry")`），`nameOf` 不设默认值 —— checkable: 该断言绿
- 写读取面 pin：`locate` / `read` 收 `base`，同一身份在两个 workspace 上解析到各自目录（两个账本共用一个矩阵各读各的 `progress.json`）；存在但读不出的名字回 `invalid(path, "unreadable")`、存在但不是普通文件回另一条 `invalid`，外来域 / 未登记 kind 抛错 —— checkable: 该断言绿
- 逐符号核 workspace 字面与 brief 模板都已改经 registry（**已交付随注**，本步只剩核对与零字节差：`InFlight.FILE` · `CliArtifacts#baseSet` / `#baseGet` / `#readBase`（经 `#baseName()`）· `Cli#baseBranchOf` · `Ledger#readProgress` / `Ledger#writeProgress`（两者公开，经 `#progressName()`）· `RoundNaming#brief` / `#briefName` · `CliGate#renderBrief` · `Preview#readsOf`） —— checkable: 先在 `round-artifacts.test.ts` 写结构断言「`"base.json"` / `"progress.json"` / `"in-flight.json"` / `tasks-{tasks}-brief.md` 在 `src-next` 内只出现在 `session/round-artifacts.ts` 与夹具」（实现前红），再跑 `pnpm -C packages/cdd-engine exec vitest run src-next/session/__tests__/ledger.test.ts src-next/face/__tests__/cli.test.ts src-next/infra/__tests__/carrier-seal.test.ts src-next/session/__tests__/round-naming.test.ts` 绿且零字节差
- 接线：命令前导一次构造 registry 并向下注入五个读面（`Lifecycle` opts 字段 · `Ledger` 构造器第 4 参 · `CarrierSeal#sweep` / `BoardView.render` 显式入参 · `NextStepRouter` 构造器；`Ledger#router` 与 `Run#router` 改为构造体内赋值、传同一实例） —— checkable: `round-artifacts.test.ts` 的结构断言「`new ArtifactRegistry(` 在**生产源码**内恰一处」绿——扫描面 = 去注释并排除 `__tests__`（沿用 `src-next/__tests__/support/strip-comments.ts` 的既有姿势），测试一律经夹具助手取实例；且五个读面读到同一实例

#### Acceptance

`ArtifactRegistry` 可实例化；`entries()` 恰四行 workspace kind（`kind` 直接可断言，不从行形状反推）；`rows()` 与 `entries()` 同序；四行往返 pin 绿；`nameOf(kind, tasks)` 与 `render({domain: "workspace", tasks}, kind)` 逐 kind 相等（同一行渲染的两个入口形态，不是第二拼写）；坐标守卫：`brief` 的 `tasks` 为 `null` / 空串、三个字面量的 `tasks` 非 `null` ⇒ 两条入口都抛错；读取面：`locate` / `read` 收 `base`（同一身份在两个 workspace 上解析到各自目录，两个账本共用一个矩阵各读各的 `progress.json`），存在但读不出的名字回 `invalid(path, "unreadable")`、存在但不是普通文件回另一条 `invalid`，外来域 / 未登记 kind 抛错（不伪装成 `absent`）；workspace 字面的**每个消费符号**（`InFlight.FILE` · `CliArtifacts#baseSet` / `#baseGet` / `#readBase`（经 `#baseName()`）· `Cli#baseBranchOf` · `Ledger#readProgress` / `Ledger#writeProgress`（两者公开，经 `#progressName()`））都经矩阵读取——这五个面**已交付**，本任务验收即逐符号核账 + 零字节差（按符号名核，不按旧类名 `Artifacts` 核：树里只有 `CliArtifacts`），且既有 pin 在 `session/__tests__/ledger.test.ts` · `face/__tests__/cli.test.ts`（base 用例）· `infra/__tests__/carrier-seal.test.ts` · `session/__tests__/round-naming.test.ts` 四处逐字节零差（守恒边界覆盖 workspace 面）；五个读面（`Lifecycle` · `Ledger` · `NextStepRouter` · `CarrierSeal#sweep` · `BoardView.render`）读到**同一实例**，且矩阵外零构造点——`new ArtifactRegistry(` 在去注释、排除 `__tests__` 的 `src-next` 生产源码内恰一处（「全树只允许一个字面」不是本门的主张：测试实例经夹具助手取）；端到端两格：① 注入一个记录型矩阵跑 `base set` 与 `board --plan`，前者记录到 `base` 渲染、后者记录到 `progress` 渲染（命令前导的实例经 board → `#ledgerOf` → 账本仍是被注入的那一个）；② `CarrierSeal.sweep(dir, [], 矩阵)` 与同一目录在该名字的命名谓词下判定一致（T1 时点的 pin：无矩阵臂仍有命名谓词兜底；T5 把矩阵入参升为**必填可空**、本格由「`null` ⇒ 零封印」取代，见 T5），且一个 `sealed: true` 的夹具行能让同一名字从「不是载体」变成「要封」——`sealed` 列真的被读；`brief` 名字只由矩阵渲染——`tasks-{tasks}-brief.md` 模板字面只在矩阵行，`briefName` / `CliGate#renderBrief` / `Preview#readsOf` 都是委托；目录名清单照交付后事实记录：`Workspace#names()` 随 T5 落地（`infra/workspace.ts:125`），`Ledger#workspaceFiles` 及其 `readdirSync` 已一并消失（`session/ledger.ts` 今日零 `readdirSync`），本任务只核这一面零回退；「零第二处 `readdirSync`」这句只在 **workspace 目录清单**这一面上成立——`infra/carrier-seal.ts` 的 `#entries` 与 `infra/slug-index.ts` 的 `#entryNames` 各有一处，读的是别的目录、不在这一面。

#### DependsOn

none

### Task 2: `RoundDomain` 搬入矩阵 · `rulings` 行 · pathFor 删除

#### Objective

把 `RoundNaming` 的六 kind 渲染收进矩阵的 round 行（`identityFrom: "rendered"`），新增 **`rulings`** 行（`author: "orchestrator"`、`sealed: false`、与 `final` 同 stem **由身份渲染**、`identifier: {canonical:"finding", accepts:["finding","id"]}`、`policy` = 缺席合法），并删除 `CarrierRulings.pathFor`——sidecar 路径从此是 `render({domain:"round", …}, "rulings")` 的产物。`rulings` 的身份是**被评审那一轮**的坐标（`attribute(path.basename(the --reviews 载体))`，`op` 恒为 `review`），不是 fix 轮的 `(line, op)`。round 域的 **`attribute`（渲染名反解：名字 → `{identity, kind}`）也在本任务落地**——它是三域里唯一的名字反解实体，恒回 `Attributed | null`（两种拼写都归主、**无第三态**），`misplaced` 是 T5 在 `read` 上接的一格，不另写第二处反解。round 行另有一个**模块级渲染入口** `renderRound(identity, kind)`：`ArtifactRegistry#render` 与静态 `RoundNaming.renderName` 都逐字委托它——`renderName` 是静态方法、八个调用点全是静态调用，而矩阵只提供实例方法 `render`，不落这一个入口就只剩「静态方法里 `new ArtifactRegistry()`」（撞 T1 的零构造点门）或「把 `renderName` 改成实例方法」（要动八处调用）两条不合法路。`RoundNaming` 的旧名保留为别名，六 kind 名字逐字节不变。同任务把 T1 的两格抛错守卫重指：`rulings` 登记之后凡是矩阵声明的 kind 都有行（三域登记齐后无一缺席），「未登记 kind ⇒ 抛错」这一形态**永久不可达**，该覆盖改由只登记部分 kind 的夹具域承担（`ArtifactRegistry([sealedDomain()])` 这种注入面：`rowOf` 回 `null`、`render` 抛错），「跨域身份 ⇒ 抛错」保留一格——否则那个用例要么在 T2 悄悄转红无人拥有、要么被顺手删掉，而丢掉 `Kind` 封闭集唯一的抛错守卫。

#### Files

- Modify: `packages/cdd-engine/src-next/session/round-artifacts.ts`（round 七行登记 + `render` 分派 + round 域 `attribute` 的渲染名反解；`rulings` 行声明 `identifier` 与 `policy`；导出 round 行的模块级入口 `renderRound(identity, kind)`——`ArtifactRegistry#render` 与 `RoundNaming.renderName` 都逐字委托它）
- Modify: `packages/cdd-engine/src-next/session/round-naming.ts`（`renderName` 委托 registry；`RoundArtifact` 映射到 `Identity` 的 round 变体）
- Modify: `packages/cdd-engine/src-next/session/carrier-rulings.ts`（pathFor 删除；`read(sidecarPath, carrierPath)` / `verdict(sidecarPath, carrierPath, findingIds)`——路径由调用方渲染，`carrier` 键校验仍以 **carrier 的 basename** 为参照）
- Modify: `packages/cdd-engine/src-next/face/lifecycle.ts`（prompt 格与门两处消费者读**同一个** `ArtifactCell`——`#artifactCellOf` 每次派发只取一次，其按-kind 的那层是 `#artifactReadOf` → `ArtifactReads.read`；严格 schema 那一半只有一处，`CarrierRulings.verdict` 由 `ArtifactReads#compose` 调一次，prompt 格不再用宽松读、一份文件只有一个判别值。#rulingsRefusal 只作为 T6 取代的旧成员出现在这句里，取代后的四个符号见 T6 的同文件行；矩阵形参升为必填，`null` 不再退化成「sidecar 不存在」）
- Test: `packages/cdd-engine/src-next/session/__tests__/round-naming.test.ts`（六 kind 名字逐字节不变 + `rulings` 渲染与无 cycle 形态）
- Test: `packages/cdd-engine/src-next/session/__tests__/round-artifacts.test.ts`（`rulings` 登记后重指两格守卫：「跨域身份 ⇒ 抛错」保留一格；「未登记 kind ⇒ 抛错」改由只登记部分 kind 的夹具域承担——不再指望一个三域登记齐后永不存在的 kind）
- Test: `packages/cdd-engine/src-next/session/__tests__/carrier-rulings.test.ts`（pathFor 零残留；`verdict` 对 `carrier` 键仍按其 basename 判）
- Test: `packages/cdd-engine/src-next/face/__tests__/lifecycle.test.ts`（派发轮为 `fix`、载体为 `plan-review-1.c1.json` 时，`INPUT_RULINGS` 的路径带 `review` 段、不含 `fix-` 段）

#### Consumes

- Task 1 的 `ArtifactRegistry` / `Identity` / `ArtifactRead` / `ArtifactRow`
- `session/carrier-rulings.ts` 的严格 schema 判定（`TOP_KEYS` / `#carrierRefusal`；接受集面的**已交付随注**：RULING_KEYS 已随 T9 退役，今日的单源读面是 `ArtifactRegistry.identifierOf("rulings")`）
- `session/ledger.ts` 的 `carrierPathOf`（`carrier` 键的 basename 参照）

#### Produces

- round 七行登记（六既有 + `rulings`），`rulings` 名字 = `<line>-<op>-<cycle>[-a<n>].c<cycle>.rulings.json`；无 cycle 身份 ⇒ `<line>-<op>.rulings.json`（与 `final` 同 stem，缺省坐标不铸段）
- `rulings` 行的身份来源（唯一一句）：坐标 = `attribute(path.basename(the --reviews 载体))` 回出的 round 身份，`op` 恒为 `review`、`cycle` / `attempt` 取载体自己的坐标
- `rulings` 行携带 `identifier: {canonical:"finding", accepts:["finding","id"]}` 与「缺席合法」的 `policy`（单源声明，读取面消费这一行，无第二处枚举）
- `CarrierRulings.read(sidecarPath, carrierPath)` / `CarrierRulings.verdict(sidecarPath, carrierPath, findingIds)`（`carrier` 键两侧同判：宽松读也不接受回答了另一个载体的 sidecar）
- round 域 `attribute`（渲染名反解：三域里唯一的名字 → 身份实体；无 cycle 的 implement 拼写仍认作 `draft`；显式 `-a1` 与省 `.c<cycle>` 等能归主的变体在 `attribute` 上照旧归到同一 `(identity, kind)`——两种拼写都归主、无第三态——由 T5 在 `read` 上接成 `misplaced`）
- `renderRound(identity, kind)`：round 行的模块级渲染入口（`ArtifactRegistry#render` 与静态 `RoundNaming.renderName` 的同一本体，一个拼写、两个入口形态）
- pathFor 删除后的唯一路径出口：`ArtifactRegistry#render(identity, "rulings")` + 调用方的 `Workspace#resolve`

#### Steps

- 写失败测：`render({domain:"round", line:"plan", op:"review", cycle:1}, "rulings")` 逐字节等于 `plan-review-1.c1.rulings.json`，且等于 `final` 的 stem 加 `.rulings.json`；无 cycle 形态 `render({domain:"round", line:"plan", op:"review"}, "rulings")` 等于 `plan-review.rulings.json`（同样等于该身份 `final` 的 stem + 尾，断言从**身份**写，不是对 `final` 的名字做字符串替换） —— checkable: 跑红（行未登记）
- 登记 round 七行（`rulings` 行带 `identifier` 与 `policy`）并让 `renderName` 委托 —— checkable: `round-naming.test.ts` 六 kind 逐字节绿 + 新 `rulings` 两形态用例绿，且 `round-artifacts.test.ts` 的「未登记 kind ⇒ 抛错」格已改由夹具域承担（`sealedDomain()` 那种只登记部分 kind 的注入面）、「跨域身份 ⇒ 抛错」格仍绿
- 删 pathFor、改 `read` / `verdict` 入参为 `(sidecarPath, carrierPath[, findingIds])` —— checkable: `grep -rn "pathFor" packages/cdd-engine/src-next` 零命中；`carrier-rulings.test.ts` 绿
- 往返 pin 扩到 round 七行，**每个 kind 跑两遍**：带 `cycle` / `attempt` 一遍、无 `cycle` / `attempt` 一遍；无 cycle 形态下 `draft` 与 `final` 渲染**同一个名字**（既有 pin `session/__tests__/round-naming.test.ts:99-105` 断言 draft = final = `tasks-1-implement.json`），而 `attribute(name)` 只回一个 `{identity, kind}` —— 故该形态**只断身份**（`attribute` 回出同一无 cycle 身份），`kind` 按今日 carrierPattern 的既有口径归一为 `draft`（「无 cycle 的 implement 是 draft、永不是 final」；该正则由 T5 随 `attribute` 接管后删除，口径以本句为准），不对 `final` 那一格断言 kind；`rulings` 同形态下渲染名是 `<line>-<op>.rulings.json`（等于 `final` 的 stem），其 `misplaced` 集只剩显式 `-a1` 一格 —— checkable: 该断言绿
- 改 `lifecycle` 两处，并写「派发轮 `fix` + 载体 `review`」的 pin —— checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/face/__tests__/lifecycle.test.ts` 绿，且证据里 `INPUT_RULINGS` 值含 `review` 段、不含 `fix-` 段

#### Acceptance

`rulings` 名字由**载体身份**渲染（同一 carrier 在 `fix` 轮与 `review` 轮渲染出同一个名字，`op` 段恒为 `review`）；与 `final` 同 stem（含无 cycle 形态）；pathFor 全仓零命中；`verdict` 仍拒 `carrier` 键不符的 sidecar；六 kind 名字逐字节不变；round 域 `attribute` 的渲染名反解在本任务落地（恒回 `Attributed | null`、无第三态；`misplaced` 由 T5 在 `read` 上接，无第二处反解），round 行的模块级渲染入口在册——`RoundNaming.renderName` 仍为静态、逐字委托 `renderRound`，模块内零 `new ArtifactRegistry(`；**往返 pin 覆盖 round 七行、每行两形态**（T1 只覆盖 workspace 四行，本任务补齐另一半；无 cycle 形态只断身份、`kind` 归一 `draft`）；`identifier` / `policy` 只在 `rulings` 行声明一次；`round-artifacts.test.ts` 的抛错守卫没有被顺手删掉——「跨域身份 ⇒ 抛错」一格保留、「未登记 kind ⇒ 抛错」改由夹具域承担（三域登记齐后那个形态已不可达）。

#### DependsOn

1

### Task 3: `DocDomain` + `SlugIndex` 单建一次

#### Objective

文档域进矩阵，但**只做 `attribute` / `locate` / `read`**：身份来自 front-matter `slug:`，路径取 `DocEntry.rel`，**没有 `render`**（spec §2.2 / §1.3）。`attribute` 保持 `Attributed | null`（名字 → 身份是一对一，**不加第三态**）；歧义只在 doc 域 `read` 里判：同 `(slug, docType)` 命中 ≥2 份 ⇒ `invalid(path, found:[a,b], reason:"duplicate-identity")`。`SlugIndex#identityDoc` / `#planOf` 退役为 `docsOf(slug)`（0/1/n，永不选）与 `hasIdentity(slug)`（n ≥ 1 即真），四个消费者按 spec §4.4 改写。`SlugIndex` 的生产调用点从**五处收到三处**：`face/cli.ts` 内一个私有构造入口 `#indexOf(root)`（`#runBoard` / `#runWork` / `#sceneOf` / `#runBase` 四条命令路径共用它——四个 `#indexOf(...)` 调用点即 `#runBoard` / `#runWork` / `#sceneOf` / `#runBase` 各一处（`#indexOf` 全树唯一，按本计划自立的口径不钉行号）；`SlugIndex.build` 字面因此在 `cli.ts` 只剩 `:500` 一处）+ `session/preflight.ts:364` / `contract/invariants.ts:332` 两处 `?? build` 兜底。「单建一次」的准确含义是**同一命令内不再二建**，不是四条命令共享同一个对象——四条路径各自 `#rootOf()`、互不相交，也没有比它们更早的公共前导。

#### Files

- Modify: `packages/cdd-engine/src-next/infra/slug-index.ts`（`identityDoc` / `planOf` 退役 → `docsOf(slug): readonly DocEntry[]` / `hasIdentity(slug): boolean`；索引**只答集合**，**不新增** `attribute`——今天的索引里没有这个成员、`Attributed` 这个类型全树也不存在（它由 T1 在 `round-artifacts.ts` 定义），名字 → 身份归 `DocDomain`，索引侧零第二个端口；doc 域 `read` 的委托实现：`docsOf(slug)` 命中 ≥2 份 ⇒ `invalid(found)`）
- Modify: `packages/cdd-engine/src-next/session/round-artifacts.ts`（doc 四行登记 `identityFrom: "declared"`；`DocDomain` 实现 `attribute` / `locate` / `read`，全部委托索引）
- Modify: `packages/cdd-engine/src-next/face/cli.ts`（`SlugIndex.build` 收进一个私有 `#indexOf(root)` 入口——今日该字面存活于 `cli.ts:500` 的 `#indexOf` 体内一处（成员声明在 `:498`），另有 `contract/invariants.ts:332` / `session/preflight.ts:364` 两处 `?? build` 兜底不在收敛面内；指向它的四个 `#indexOf(...)` 调用点就是 `#runBoard` / `#runWork` / `#sceneOf` / `#runBase`（`#indexOf` 全树唯一，不钉行号），`cli.ts` 内只剩该字面一处；同一入口把索引绑定到命令那**一个** `ArtifactRegistry` 实例（`bindDocIndex`，注入矩阵同样绑定、不再二建——此前 `#indexOf` 会换成一个新实例，base 面与 scene / board 因此读两个矩阵）；`#sceneOf` 的 `specLink` / `pipeline.specPath` 改吃 `read({domain:"doc", slug, docType})`）
- Modify: `packages/cdd-engine/src-next/session/preflight.ts`（`#vet` 的 `ctx.slugIndex ?? SlugIndex.build(...)` 兜底保留，吃注入索引）
- Modify: `packages/cdd-engine/src-next/contract/invariants.ts`（#identityDocOf → `hasIdentity(slug)`：n ≥ 1 即零 Finding，不取第一份）
- Modify: `packages/cdd-engine/src-next/face/board-view.ts`（`#nodeSources` 的 spec / plan 两格、`#programBoard` 的 phase 板 plan 行改读索引的集合端口（0 / 1 / n，与 `#entryMark` 的 `duplicatedRolesOf` 同一判定；同型歧义归 doc 域 `read` 的 `invalid(found)`、跨型歧义归这个集合口——spec §4.4），>1 时渲既有标记 `MARK_SLUG_DUPLICATED`（`slug: duplicated (BLOCKED)`）加集合内全部 `rel`，不得借任何一份的 version / status。**argv 命名的那一份不豁免**：`cdd board --spec` / `--plan` 把该文档当 `entry`，它的槽位仍按同类集合判——`own` 只在集合答不了时保留（无合法 slug；或 `doc-type:` 未声明，那条目归不进任何类、只能渲自身的 `MARK_DOC_TYPE_MISSING`））
- Test: `packages/cdd-engine/src-next/infra/__tests__/slug-index.test.ts`（`docsOf` 的 0 / 1 / n 三格与 `hasIdentity`；索引侧零 `attribute` 成员）
- Test: `packages/cdd-engine/src-next/session/__tests__/round-artifacts.test.ts`（`DocDomain#attribute` 的命中 / 未命中两态；重复身份 ⇒ doc 域 `read` 回 `invalid(found)` 而 `attribute` 仍回身份）
- Test: `packages/cdd-engine/src-next/face/__tests__/cli.test.ts`（`SlugIndex.build` 结构断言「这三处之外无 `SlugIndex.build`」+ `specLink` / `pipeline.specPath` 的读法）
- Test: `packages/cdd-engine/src-next/face/__tests__/board-view.test.ts`（`#nodeSources` / `#programBoard` 在重复身份下渲既有标记 `MARK_SLUG_DUPLICATED`；成对成三组，把两条入口都点到：`--plan` 条目 + 第二份 spec、`--spec` 条目 + 第二份 spec（`own` 臂）、`--spec` 条目 + 第二份 plan（身份条目的 plan 集合臂））
- Test: `packages/cdd-engine/src-next/contract/__tests__/judge.test.ts`（`planChain` 在 n ≥ 2 身份文档时零 Finding，见 `:723-765` 的既有成对用例）

#### Consumes

- Task 1 的 `ArtifactRegistry` / `Identity` / `Attributed` / `IdentityDomain`
- `infra/slug-index.ts` 的 `#bySlug` / `#judge` / `duplicatedRolesOf(slug)` / `slugVerdict`（多份身份文档已有判定面）
- `contract/invariants.ts:332` 与 `session/preflight.ts:364` 的 `ctx.slugIndex ?? build` 既有先例（升为允许保留的两处兜底）

#### Produces

- doc 四行登记（`overall` · `phase-spec` · `single-spec` · `plan`，`identityFrom: "declared"`，零 `render`）
- `DocDomain` 的 `attribute`（`Attributed | null`）· `locate`（取 `entry.rel`；`read` 的 `ok.path` 同基，存活探针走 `entry.path`）· `read`（≥2 命中 ⇒ `invalid(found:[a,b], reason:"duplicate-identity")`，歧义的唯一判定处）
- `SlugIndex#docsOf(slug)`（0/1/n，永不选）· `SlugIndex#hasIdentity(slug)`（n ≥ 1）
- `SlugIndex.build` 的三处存活点（`face/cli.ts` 的私有 `#indexOf(root)` 一处字面——`#runBoard` / `#runWork` / `#sceneOf` / `#runBase` 共用 + `session/preflight.ts:364` / `contract/invariants.ts:332` 两处 `?? build` 兜底）

#### Steps

- 写失败测：同一 slug 两份 phase-spec 时 `docsOf(slug)` 回两条、`read({domain:"doc", slug, docType:"phase-spec"}, "phase-spec")` 回 `invalid` 且 `found` 列全两条，而 `attribute("…")` 仍回身份 —— checkable: 跑红（`docsOf` 未导出）
- 实现 `docsOf` / `hasIdentity`（索引只答集合、零 `attribute`）+ `DocDomain#attribute` / `#read`（红态先写：`attribute` 在索引上零命中、在 `DocDomain` 上回身份）+ 三处判定收紧 —— checkable: `slug-index.test.ts` 与 `round-artifacts.test.ts` 绿
- 登记 doc 四行（无 `render`） —— checkable: `rowOf("plan").identityFrom === "declared"` 且 `render({domain:"doc",…}, "plan")` 抛（declared 域不渲染）
- 改写四个消费者（`planChain` → `hasIdentity`；`Cli#sceneOf` 的 `specLink` / `pipeline.specPath`；`BoardView#nodeSources` spec / plan 两格；`BoardView#programBoard` phase plan 行） —— checkable: `contract/__tests__/judge.test.ts`、`face/__tests__/cli.test.ts`、`face/__tests__/board-view.test.ts` 三文件绿
- 把 `SlugIndex.build` 收成每个命令的唯一构造入口（cli 三处 → 私有 `#indexOf(root)` 一处字面） —— checkable: 结构断言绿——去注释的源码中 `SlugIndex.build` 只余「`cli.ts` 的 `#indexOf(root)` 一处 + `preflight.ts` / `invariants.ts` 两处 `?? build`」，**这三处之外零命中**（不是「全树只允许一个字面」）；且 `board` / work / scene / base 四条命令各自只建一次索引（`#indexOf` 按 `repoRoot` memo，同一命令的多次调用只扫一次）

#### Acceptance

doc 行零 `render`；`DocDomain#attribute` 无第三态（`Attributed | null`），索引侧零 `attribute`（名字 → 身份端口恰一个）；同 slug 多份 ⇒ doc 域 `read` 回 `invalid(found:[a,b])`（派发硬停由既有 `SlugIndex#slugVerdict` 的 `duplicated` → `doc-contract` 承担，本任务只补读取面、不新开派发门）、`hasIdentity` 仍回真、四个消费者都不再有「取第一份」的读点——`planChain` 读 `hasIdentity`、`Cli#sceneOf` 读 doc 域 `read`，板面两格读索引的集合端口（0 / 1 / n，与 `#entryMark` 的 `duplicatedRolesOf` 同一判定；>1 即渲标记 + 集合内全部 `rel`、不借任何一份的 version / status；**argv 命名的那份不豁免**，`--spec` 条目下的同类第二份照样渲集合，「单份时今日格字节不变」由同一组 pin 的另一半把住）——并可核退役谓词（扫描面 = 去注释的生产源码，沿用 `src-next/__tests__/support/strip-comments.ts` 的既有姿势，`__tests__` 排除）：`identityDoc` 全树零命中，`planOf` 只余 `face/route-render.ts` 的 `RouteRenderer#planOf`（同名异物的 `--plan` 值位渲染，自 P8 起就在、不在本相位的拆除面）——即 `SlugIndex` 的 `identityDoc` / `planOf` 两成员与调用点零命中；`SlugIndex.build` 存活点恰三处（`cli.ts` 私有入口一处 + 两处 `?? build`），且「单建一次」= 每条命令内不再二建（`board` / work / scene / base 各一次，不共享对象；`#indexOf` 按 `repoRoot` memo，同一命令的两次调用只扫一次）。

#### DependsOn

1

### Task 4: `plan-source` 正查与反查的三态

#### Objective

`PlanSource` 两条腿都改成**问身份、不问名字**（spec §2.7）：正查（相位 → plan）与反查（plan → 相位 spec）都走索引 + **扫描面干净度**的三态：(a) 命中按 `DocEntry.rel` 读；(b) 未命中且扫描面干净 ⇒ `undeclared` / `spec-absent`；(c) 未命中且扫描面不干净 ⇒ **未判态**（不拒绝、板面照渲 `(none)`、装配面写一行 `CDD_WARN:` 带计数）；**外加之格 (d)**，不属三态：同一 slug 有两行 plan（`docsOf(slug)` 的 plan 行 ≥2）⇒ plan 路径**不答 `undeclared`**——`locate` 对 0 份与 ≥2 份都回 `null`，照 `null` 走就会把「两份」答成「没有 plan」，正是 spec §2.7 禁止的「读不出 / 未判态不得授权『没有』」；故 plan 路径先问集合、`n === 1` 才取该行 `rel`，`n ≥ 2` 落身份标记面（板面 plan 格渲既有标记 `MARK_SLUG_DUPLICATED` + 集合内全部 `rel`、`next:` 不印 `kairos:cdd-plan`），派发由既有 `SlugIndex#slugVerdict` 的 `duplicated`（`duplicate-plan`）挡下，本任务不新开拒绝面。`SlugIndex#scanRoot` 暴露**按根**的丢弃计数（三个 doc 根各一对，共六个值）——身份反查读三个根、plan 路径只读 `plans/` 那一对。`<slug>.md` / `<slug>-design.md` 两条派生整条删除；`PlanOrphan` 只留 `cause`（`specPath` **退役**，不是收 `null`）；`planOrphanSpec(slug: string)` 收单参、报文零路径片段；P35 的值 pin、板面 pin 与 AC ③ 按三态重锚。**P35 Constraints 的派生条款同批修订**（spec §2.7 · deliberate · D74 · 记入 overall D92 ⑦）：`docs/kairos/specs/2026-10-10-engine-doc-tooling-p35-design.md` 的「plan 路径由 `ENGINE_DOC_ROOTS.plans` + slug 派生，不在 front matter 里声明路径」拆成两半——前半句改为「plan 路径取索引 plan 行的 `rel`」，后半句（文档不自述路径）原样保留，同一条的「不重写 `infra/slug-index.ts` 的扫描谓词」不动（文档谓词一字不改，只多出按根的一对丢弃计数）。落地后仓里不许并存两条互斥约束——P35 说「派生」、P36 说「取索引 `rel`」正是 #485 的复发形态，而没有任何门会红。同一条 bullet 的**第三句**也在修订面内（`docs/kairos/specs/2026-10-10-engine-doc-tooling-p35-design.md:251` 的「身份的两个方向不对称——…plan 的 slug 找不到 `<slug>-design.md` 是身份破损（反查阻塞；只探存在性，不看索引的内容谓词）」）：它与本相位 §2.7 的三态反查逐字互斥（问索引 · `<slug>-design.md` 派生整条废除 · (c) 未判态零拒绝），留着就是同一个 #485 形态的第二处现场，而 `doc-path-door` 只扫源码、不扫文档，没有任何门会红。口径改为：「相位没有 plan 是合法状态」保留；「plan 的 slug 找不到 `<slug>-design.md` 是身份破损（只探存在性）」改为「plan 的 slug 在索引里找不到身份文档 ⇒ 三个 doc 根全干净才 `spec-absent`，否则未判态零拒绝（P36 §2.7）」。

#### Files

- Modify: `packages/cdd-engine/src-next/infra/plan-source.ts`（`readFor` / `#lookupOf` 重写——今日符号是 `#lookupOf`（`infra/plan-source.ts:582`）；`PlanOrphan` 只留 `cause`；未判态在 `warnLine` 通道产一行计数）
- Modify: `packages/cdd-engine/src-next/infra/slug-index.ts`（`#scanRoot` 每根保留一对丢弃计数，随索引暴露为六个值）
- Modify: `packages/cdd-engine/src-next/face/words.ts`（`planOrphanSpec(slug: string): string` 单参、报文字节 = `the slug names no identity document (index clean miss)`，零路径片段）
- Modify: `packages/cdd-engine/src-next/contract/invariants.ts`（`CrossDocChainInvariant#planChain` 吃同一组计数：null 身份 + 任一 doc 根不干净 ⇒ 零 `Finding`）
- Modify: `packages/cdd-engine/src-next/face/cli.ts`（`PlanSource` 的两个生产构造点——`Cli#runBoard` 内一处、`#runWork` 的命令前导一处——改成注入单建索引；两处按方法名定位、不钉行号，命令前导是随前置步骤增长的那一段，行号必漂；换源调用点 `#runBoard` / `#boardReadTable` / `#sceneOf` 读同一实例）
- Modify: `docs/kairos/specs/2026-10-10-engine-doc-tooling-p35-design.md`（Constraints 的派生条款拆两半：前半句改「plan 路径取索引 plan 行的 `rel`」、后半句与扫描谓词不动；同一条 bullet 的第三句（`-design.md` 反查 · 「只探存在性」）改为问索引三态；同批补该文件 `## Change history` 一行并同步其 front-matter `version:`——**已交付随注**：这次修订已落 P35 spec（Constraints 那半句 + §2.7 正文两处），本任务只核现口径零回退，不写版本坐标）
- Test: `packages/cdd-engine/src-next/infra/__tests__/plan-source.test.ts`（三态六格 + 「slug 自带 `-design`」用例 + 「脏 `specs/` × 干净 `plans/` ⇒ plan 路径仍 `undeclared`」的混合格 + `planOrphanSpec` 的报文字节——该断言留在文件既有的 `planOrphanSpec` 格，不在 `infra/` 的派生扫描面内；第四格：plan 行 ≥2 ⇒ `undeclared` 零命中、板面渲 `MARK_SLUG_DUPLICATED` 与集合内全部 `rel`）
- Test: `packages/cdd-engine/src-next/infra/__tests__/slug-index.test.ts`（`discarded()` 六值逐根的 pin 之家：overalls / specs / plans 各一对且与入册结果同一次扫描产出；外加「只在 `overalls/` 放一个不可读候选 ⇒ 身份反查落 (c)」一格）
- Test: `packages/cdd-engine/src-next/face/__tests__/board-view.test.ts`（`! no-spec` 只属 (b)；(c) 与今日逐字节相同；plan 格在 plan 行 ≥2 时渲 `MARK_SLUG_DUPLICATED` + 集合内全部 `rel`，不借任何一份的 version / status）
- Test: `packages/cdd-engine/src-next/face/__tests__/cli.test.ts`（P35 AC ③ 重锚：缺 `doc-type: plan` ⇒ plan / wave 行 `(none)`、`next:` 回 `kairos:cdd-plan`、stderr 恰一行 `CDD_WARN:`、零拒绝、exit 0；第四格：两行 plan ⇒ `next:` 零 `kairos:cdd-plan`、板面渲标记与全部 `rel`（硬拒由既有 `slugVerdict` 的 `duplicated` 出，本任务不新开拒绝面））
- Test: `packages/cdd-engine/src-next/contract/__tests__/judge.test.ts`（(c) 格的**链级** coverage pin——**已交付**（分支评审第 1 轮 F1，格题「the plan chain's undecided arm — a dirty doc root answers no absence」，三格成对）：① 干净对照（三根各有一个可读且 `doc-type:` 已入册的候选、无同一 slug 的身份文档）⇒ 恰一条 `cross-doc-chain@slug` `Finding` 且报文逐字；② 脏 `specs/`（一个不可读候选）⇒ 零 `cross-doc-chain` `Finding`；③ 脏 `overalls/`（读得出但 `doc-type:` 未入册）⇒ 零 `cross-doc-chain` `Finding`。双向可红可修已验：删 `planChain` 的 `if (!index.docRootsClean()) return []` ⇒ ②③ 红；把它换成无条件 `return []` ⇒ ① 红）

#### Consumes

- Task 3 的 DocsOf / `hasIdentity` / 单建索引 / doc 域 `read`
- `infra/plan-source.ts` 的 `PlanRead` 三态（`undeclared` / `unreadable` / `ready`）与 `PlanSource` 缝、`warnLine` / `refusal` 通道
- P35 的三条既有 pin（值 pin / 板面 pin / AC ③）

#### Produces

- `PlanSource#readFor(entry)` / `#lookupOf(head)` 的三态裁决（`hit` / `clean-miss` / `indeterminate`）
- `PlanSource#readFor` 的第四格（不属三态）：plan 行 ≥2 ⇒ **不答 `undeclared`**，落身份标记面（`MARK_SLUG_DUPLICATED` + 集合内全部 `rel`、`next:` 零 `kairos:cdd-plan`），派发由既有 `SlugIndex#slugVerdict` 的 `duplicated` 挡下；`n === 1` 才取 `rel`
- `SlugIndex#discarded(): {overalls: {unreadable; unregistered}; specs: {…}; plans: {…}}`（按根六值，与入册结果同一次扫描产出）
- 两个判断各自读的根：身份反查（`#lookupOf` / `planChain`）读三个根；plan 路径（`readFor`）只读 `plans/` 那一对
- 未判态的观测面：一行 stderr `CDD_WARN: <plans 根> — <n> discarded candidate(s)`（`n` 为该根 `unreadable + unregistered`，由既有 `warnPrefix` 通道拼装，零拒绝）
- `PlanSource` 的构造收索引：`new PlanSource(root, index[, fs])`——两条腿（正查 / 反查）都问注入的那一个索引，零自建
- `words.ts` 的新报文（无派生路径）+ `PlanOrphan` 只留 `cause`
- P35 Constraints 的新口径（「plan 路径取索引 plan 行的 `rel`」+ 文档不自述路径 + 扫描谓词不动 + 同一 bullet 第三句改为问索引三态：`-design.md` 反查与「只探存在性」两处旧口径零命中）与该文件的一行 Change history

#### Steps

- 写失败测：slug 以 `-design` 结尾的相位 + plan ⇒ 正查命中、反查 (a)，**零拒绝** —— checkable: 今日必红（派生 `-design-design.md`）
- 写三态六格测（命中 / 干净缺失 / 脏缺失 × 正查反查）+ 混合格（脏 `specs/`、干净 `plans/` ⇒ plan 路径仍 `undeclared`、零 `CDD_WARN:`） —— checkable: 跑红
- 写第四格测（不属三态）：同一 slug 两行 plan ⇒ plan 路径不答 `undeclared`——板面 plan 格渲 `MARK_SLUG_DUPLICATED` + 集合内全部 `rel`、`next:` 零 `kairos:cdd-plan`、派发由 `slugVerdict` 的 `duplicated` 硬拒；同格顺手钉 `n === 1` 才取 `rel`（0 份与 ≥2 份都回 `null`，`locate` 分不开两者） —— checkable: `infra/__tests__/plan-source.test.ts` 与 `face/__tests__/cli.test.ts` 的该格绿（实现前必红：照 `null` 走会答 `undeclared`）
- 实现 `discarded()`（按根六值）与 `PlanSource` 重写（含未判态那行 `CDD_WARN:`） —— checkable: `plan-source.test.ts` 绿
- 在 `infra/__tests__/slug-index.test.ts` 补两格：① 六值逐根（overalls / specs / plans 各一对：不可读候选、读得出但 `doc-type` 未入册）且与入册结果同一次扫描产出；② 只在 `overalls/` 放一个不可读候选 ⇒ 身份反查落 (c)（零拒绝、板面 `(none)`、`planChain` 零 `Finding`），而 plan 路径仍 `undeclared`（plans 根干净） —— checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/infra/__tests__/slug-index.test.ts` 绿
- 改 `words.ts` 报文 + `planChain` 吃同一组计数 —— checkable: `contract/__tests__/judge.test.ts` 与 `contract/__tests__/lint.test.ts` 绿；**(c) 格的链级 coverage pin 已交付**（分支评审第 1 轮 F1，格题「the plan chain's undecided arm — a dirty doc root answers no absence」：干净对照恰一条、脏 `specs/` 与脏 `overalls/` 各零条；删掉 `planChain` 的 `docRootsClean()` `return` ⇒ 两个脏根格红，换成无条件 `return []` ⇒ 对照格红）——本步的接线与三态计数因此有门，不再需要后续承接
- 重锚 P35 三条 pin，并跑派生零命中门 —— checkable: `face/__tests__/board-view.test.ts` + `face/__tests__/cli.test.ts` 绿，且派生零命中门可红可修——扫描面 = 去注释（沿用 `src-next/__tests__/support/strip-comments.ts` 的既有姿势）且排除 `__tests__` 的 `infra/`，断言「`ENGINE_RUNTIME.docRoots.*` 参与模板串或以 `path.join` 作基座」零命中（与 T10 的 `doc-path-door` 同一谓词；T4 只负责删掉 `readFor` / `#lookupOf` 的两个派生点，注释与夹具不在扫描面）
- 修订 P35 Constraints 的派生条款（前半句换口径、后半句与扫描谓词保留、第三句改为问索引三态）+ 该文件 `## Change history` 一行与 `version:` 同步递增 —— checkable: `grep -n "slug 派生" docs/kairos/specs/2026-10-10-engine-doc-tooling-p35-design.md` 在 Constraints 段零命中、该行只剩「plan 路径取索引 plan 行的 `rel`」这一处新口径，且同一 bullet 内 `-design.md` 与「只探存在性」两处旧口径零命中
- 构造收索引：`PlanSource` 入参加注入索引，改 `#runBoard` 内与 `#runWork` 的命令前导（两个生产构造点按方法名定位、不钉行号——命令前导随前置步骤增长，行号必漂）两个生产构造点、更新 `#boardReadTable` / `#sceneOf` 的传递；全树的 `new PlanSource(` 构造点按符号枚举只有三处——上述两处生产面 + 夹具助手 `planSourceOf`（`packages/cdd-engine/src-next/__tests__/support/plan-source.ts:19` 的导出；今日已传索引，全树的 `planSourceOf(` 都经夹具助手取，测试侧不逐个改） —— checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/infra/__tests__/plan-source.test.ts src-next/face/__tests__/board-view.test.ts src-next/face/__tests__/cli.test.ts` 绿，且证据里 `PlanSource` 的入参带索引

#### Acceptance

正查 / 反查各三格可判且成对 pin；plan 路径的第四格（plan 行 ≥2）不答 `undeclared`——板面渲 `MARK_SLUG_DUPLICATED` + 集合内全部 `rel`、`next:` 零 `kairos:cdd-plan`、派发由既有 `SlugIndex#slugVerdict` 的 `duplicated` 挡下（pin 在 `infra/__tests__/plan-source.test.ts` 与 `face/__tests__/cli.test.ts`；`n === 1` 才取 `rel`）；`-design` 结尾 slug 放行；`(c)` 未判态零拒绝、板面字节与今日相同、恰一行 `CDD_WARN:` 带计数；`PlanOrphan` 只剩 `cause`（`specPath` 字段不存在，不是 `null`）；`planOrphanSpec(slug: string)` 单参且报文字节为零路径片段；plan 路径的「干净」只读 `plans/` 那一对计数（混合格绿）；`readFor` / `#lookupOf` 内零派生拼接（结构断言：扫描面去注释且排除 `__tests__`，注释与夹具不在面内），`planOrphanSpec` 的报文断言留在 `plan-source.test.ts` 的既有格；`discarded()` 六值逐根可判（`infra/__tests__/slug-index.test.ts` 的六值格 + 脏 `overalls/` 一格）；`PlanSource` 的构造点只读注入的那一个索引、零自建 `SlugIndex.build`（换源调用点点名 `Cli#runBoard` / `#boardReadTable` / `Cli#sceneOf`）；**AC 的 (c) 格已满足**：链级 coverage pin 在 `contract/__tests__/judge.test.ts`（格题「the plan chain's undecided arm — a dirty doc root answers no absence」：干净对照恰一条 `cross-doc-chain@slug`、脏 `specs/` 与脏 `overalls/` 各零条；删 `docRootsClean()` 那条 `return` ⇒ 两个脏根格红，换成无条件 `return []` ⇒ 对照格红，双向可红可修）；P35 Constraints 的派生条款已是新口径（前半句「plan 路径取索引 plan 行的 `rel`」、后半句与扫描谓词原样），同一条 bullet 的第三句亦已换口径（「plan 的 slug 在索引里找不到身份文档 ⇒ 三根全干净才 `spec-absent`，否则未判态零拒绝」，`-design.md` 反查与「只探存在性」两处旧字节零命中）——两处均已交付，判据是现口径零回退（不写版本坐标：每轮的「今日」版本字面到下一轮即过期，核的是字节）。

#### DependsOn

3

### Task 5: 归主文法 · duplicate ⇒ invalid · 归属泛化 · `sealed` 列

#### Objective

矩阵补两格（spec §2.5 / §2.8 / §2.9 ⑤）：**归主文法**（三条落格规则 + 逐行答案表 + 枚举 pin，**不进类型**）与 **`sealed` 列**（`CarrierSeal` 改读它；RULINGS_SUFFIX 已随波 3 退役，本任务只留零命中验收）；同时把 `Ledger#orphanHandoffs` 泛化成**两级判据**（零写只显示）：候选集 = 目录里的全部文件（经本任务交付的 `Workspace#names()` 一次读取——该成员连同 `Ledger#workspaceFiles` 的并入在本任务的 Files 里，T1 未交付；不再只扫 carrierPattern 认得的名字）；orphan ⇔ (i) `attribute → null`，或 (ii) 归主的是 **round 域的载体**、而目录里没有任何记录的 `(op, cycle, attempt)` 或 `carrierPathOf` 的 basename 认领它（行键由 `identity.line` 派生，认领比对照旧）——workspace / doc 两域的名字归主即非 orphan（四个工作区产物与四类文档是板面自己的账本与身份文档，不是 handoff 载体；按字面实现会让它们各自成一行 `orphan:`，并把 `session/__tests__/ledger.test.ts` 的三条精确数组断言与健康树 board 的零字节断言一起打红）。**第二级只收 round 域的载体，即 `draft` / `final` 两行**：`rulings` / `report` / `log` / `crash` / `evidence` 与 workspace / doc 同规——归主即非 orphan（它们是板面自己的观测与附件，不是 handoff 载体）；而 `attribute` 对这五个 kind 的名字同样回得出 `(identity, kind)`，照「round 域 ⇒ 第二级」的字面读会把本 workspace 的 51 个 `*.rulings.json` 与消费仓侧的 89 个一起灌成 `orphan:` 行，健康树的零字节断言与 P34/D89 的 orphan 面同时破。**这条两级判据 spec 已按交付回填**：§2.5 今日就是 (i) 不归主 + (ii) 归主到 `draft` / `final` 而无人认领两级（其 Change history 的 v0.10 整行即这次回填），AC 已题为「归属（两级）」、母契约 P36 行 ⑥ 同为两级——本任务因此只做对账，不再提请回填、也不再生「按计划读是收窄、按 spec 读已是规范」这对互斥读法（收窄本身是**对**的：否则 `tasks-1-fix-1-a2.json` 一类已交付 pin 会静默消失）。**泛化只换候选集，不删认领这一级**——第二级是 P34/D89 已交付的语义（「已写盘、未记账」的文件仍要在板上看得见），抹掉它会让这批文件既不成行也不成 `orphan:`，整条从板上消失；`ArtifactRegistry#read` 对 `misplaced` 的判据写成**集合式**（不是计数式）：`found` = `base` 里能归主到该 `(identity, kind)` 的全部名字——**`found` 里存在任一 ≠ 渲染名 ⇒ `misplaced`（`derived` = 渲染名、`found` 列全）**；`found` 恰为 {渲染名} ⇒ `ok`；`found` 为空 ⇒ `absent`。「≥2 个能归主的名字」只是这条规则的**最大子情形**（渲染名与同身份另一个名字并存，spec §4.1 的多候选优先级句原样保留）；「推导名缺失、同轮 stem 变体存在」是另一格——迁现场（`<line>-<op>-<n>.rulings.json` 在、同目录无 `.c<N>.rulings.json`）只有一个能归主的名字，若把 `misplaced` 只定义成 ≥2，这一格既非 `ok`、也非 `absent`，判据没有答案（`attribute` 仍只回 `Attributed | null`：两种拼写都归主、无第三态；`read` 才拿得到 `base`，也才是看得见「同身份第二个名字」的那个读面），并把拼写知识 #1 / #2 一并退役（`attribute` 接管归属后它们是零读者的死声明：`RoundNaming#carrierPattern` / `CARRIER` / #isCarrierName 与 `Ledger#WAVE_CARRIER` / #LINE_CARRIER / #handoffOwner），且立**唯一构造点门**的骨架与放行面：判定函数认「矩阵行 + 夹具」为豁免，`CarrierSeal` 零后缀字面亦在本任务验收。两条**收紧**断言（`.rulings.json` 字面集封闭、`finding` / `id` 接受集单源）不在本任务落地：它们的第二声明当时分别住 `session/next.ts` 的 `.rulings.json` 字面与 `session/carrier-rulings.ts` 的 RULING_KEYS，这对声明**已交付随注**——T9 把两处一并拆除，今日 `.rulings.json` 字面只余矩阵模块 `session/round-artifacts.ts`、接受集只读 `ArtifactRegistry.identifierOf("rulings")`，故本任务只留这两条断言的零命中验收（T9 经 `T9 → T6 → T5` 严格晚于本任务，无依赖可加；W3 上跑全树封闭当时必然是红的）。**`sealed` 列接管的无矩阵臂**：`CarrierSeal#sweep` 的矩阵入参升为**必填但可空**（签名 `artifacts: ArtifactRegistry | null`；生产唯一调用点 `face/lifecycle.ts` 已传 `this.#artifacts`，这不是「缺能力」而是「缺一句归属」）——`null` ⇒ **零封印**（命名谓词删掉之后没有第二答案），`attribute → null` 的名字 ⇒ 不封；T1 自己立的「零模块级默认实例、矩阵外零构造点」不许再造一个认名谓词来补这一格（那正是本相位要消的第二次拼写知识）。因此两文件的 `sweep(dir, [])` 调用**全部**补第三个入参：`carrier-seal.test.ts` 的**全部 9 个** `CarrierSeal.sweep(` 调用（8 处 keep 为 `[]`、`:148` 传非空 keep）传夹具实例；`round-artifacts.test.ts` 的两处 `sweep(dir, [])` 改写成显式 `null`（与相邻那处带矩阵调用同值的一处保留为「零封印」对照格）。T1 的「两形态判定一致」pin 由此**取代**：新期望是「`null` ⇒ 零封印」＋「传入矩阵 ⇒ 按 `sealed` 列封印（`new ArtifactRegistry()` 归主 `tasks-1-review-2.c2.json` 到 round 载体行、仍封）」，`round-artifacts.test.ts` 那一格随之重指（场景名改为「seals nothing without a matrix, and follows the `sealed` column with one」），不是被悄悄翻。

#### Files

- Modify: `packages/cdd-engine/src-next/session/round-artifacts.ts`（归主文法三条规则 + 逐行答案表 + `read` 的 `misplaced` 一格——反解本体在 T2；**不加 `attribution` 字段**——`identifier` / `policy` 由 T1 定形、`rulings` 行由 T2 声明）
- Modify: `packages/cdd-engine/src-next/infra/carrier-seal.ts`（RULINGS_SUFFIX **已随波 3 删除**——今日 `grep -rn RULINGS_SUFFIX packages/cdd-engine/src-next` 零命中，本任务只留该零命中验收；`#isStray` 读 `sealed` 列，`RoundNaming.isCarrierName` 的调用随该列接管而消失）
- Modify: `packages/cdd-engine/src-next/session/round-naming.ts`（删拼写知识 #1：carrierPattern / `CARRIER` / `RoundNaming#isCarrierName`——三者全树唯一，按符号名定位、不钉行号）
- Modify: `packages/cdd-engine/src-next/session/ledger.ts`（`orphanHandoffs` 泛化为矩阵驱动的**两级判据**；删拼写知识 #2：#WAVE_CARRIER / #LINE_CARRIER / #handoffOwner（全树唯一，按符号名定位），含 #LINE_CARRIER 的 `spec` 替代项）
- Modify: `packages/cdd-engine/src-next/infra/workspace.ts`（增 `Workspace#names(): readonly string[]`——workspace 目录名清单的唯一读口，`Ledger#workspaceFiles` 并入它；T1 未交付此成员）
- Create: `packages/cdd-engine/src-next/__tests__/artifact-literal-door.test.ts`（结构门骨架：一个对源码样本判定的纯函数 + 判定函数层正反例——矩阵行 / 夹具放行，矩阵外样本判违例；**不**在真树上断言封闭集，两条收紧用例在 T9 补进同一文件）
- Test: `packages/cdd-engine/src-next/session/__tests__/round-artifacts.test.ts`（归主文法三格 + 逐行答案表 + `sealed` 列的两形态格重指：场景「judges an orphan carrier the same way with and without the workspace matrix」由「判定一致」改为「`null` ⇒ 零封印 + 传入矩阵 ⇒ 按 `sealed` 列封印」，矩阵入参赛为必填可空）
- Test: `packages/cdd-engine/src-next/session/__tests__/round-naming.test.ts`（枚举 pin 的家：accepted 与 orphan 两侧各枚举一条，逐行答案显式写「无此格」；原 `minted` 一组断言（数组 `:510` 起、循环 `:531`；`neighbours` 已不在该文件，`"base.json"` 今日落在 `:550` 与 `:634`）按矩阵归属重锚——isCarrierName 退役后，该组断言改由 `attribute` 的 accepted / orphan 两格承担）
- Test: `packages/cdd-engine/src-next/session/__tests__/carrier-rulings.test.ts`（`misplaced` 一侧的枚举：省 `.c<cycle>` 段 · 显式 `-a1`）
- Test: `packages/cdd-engine/src-next/infra/__tests__/carrier-seal.test.ts`（`sealed` 列驱动；`report` / `log` / `crash` / `evidence` 一律不封；该文件**全部 9 个** `CarrierSeal.sweep(` 调用都补矩阵入参——8 处 keep 为 `[]`、`:148` 传非空 keep；矩阵入参必填可空）
- Test: `packages/cdd-engine/src-next/session/__tests__/ledger.test.ts`（`orphan` 面的守恒守卫：两级判据**正反两面各成一格**——矩阵外名字 ⇒ `orphan:` 行、round 域载体归主但无记录认领 ⇒ 仍 `orphan:` 行；**认领两档的正例也各一格**：① 记录的 `(op, cycle, attempt)` 与名字解出的身份相等 ⇒ 该名字**不上** `orphan:`；② `carrierPath` 档——记录带**绝对路径的 `carrierPath`**、扫描给裸名、身份不等而 basename 相等 ⇒ 同样**不上**（这一格必须用带 `carrierPath` 的记录；pathless legacy 夹具在 T8 之后本就落 orphan，不能拿来当第二档的正例）；三条已交付 pin 按**载荷对象名**定位（各以 `workspace.writeJson(<名>, …)` 与紧随的 `orphanHandoffs()` 精确数组断言 `toEqual([<名>])` 成对出现，不钉行号——该文件已两轮因整段移行而被判漂移）：`tasks-6,8-implement-1.json` · `tasks-1-fix-1-a2.json` · `tasks-1-fix-1-a2.c1.json` 三条原样绿；第三格域边界：`progress.json` / `base.json` / `in-flight.json` / `tasks-<n>-brief.md` 与四类文档名归主即**不**进 `orphan:`，另加五类 round 域非载体（`rulings` / `report` / `log` / `crash` / `evidence`）各一条——同规归主即**不**进 `orphan:`）

#### Consumes

- Task 2 的 round 七行（含 `rulings` 的 `identifier` / `policy` 声明）与 round 域 `attribute` 的渲染名反解（本任务只在 `read` 上加 `misplaced` 一格）
- `infra/carrier-seal.ts` 的 `sweep` / `seal` / `unseal`
- `session/ledger.ts` 的 #handoffOwner 两套正则（本任务由矩阵归主文法取代，符号一并删除）

#### Produces

- 归主文法（三条落格规则 + spec §2.5 的逐行答案表原样 + 枚举 pin：accepted / orphan 在 `round-naming.test.ts`，`misplaced` 在 `carrier-rulings.test.ts`）；**不是字段**，不进 `ArtifactRow`
- `ArtifactRegistry#read` 的 `misplaced` 产出面（集合式判据：`found` = `base` 里能归主到该 `(identity, kind)` 的全部名字，任一 ≠ 渲染名 ⇒ `misplaced(derived, found, identity)`、恰为 {渲染名} ⇒ `ok`、全空 ⇒ `absent`；「≥2 个」是其最大子情形；`attribute` 仍只回 `Attributed | null`、无第三态）；`found` 的枚举面 = 本任务交付的 `Workspace#names()`（`read` 不新开第二次目录扫描），`Ledger#orphanHandoffs` 的候选集是同一读口的第二个消费者
- 拼写知识 #1 / #2 的退役面：carrierPattern · `CARRIER` · isCarrierName · #WAVE_CARRIER · #LINE_CARRIER · #handoffOwner 六个符号零残留
- `Ledger#orphanHandoffs` 的两级判据：候选集 = 目录全部文件；orphan ⇔ `attribute → null`，或「归主的是 round 域载体但没有记录认领」（行键由 `identity.line` 派生，认领比对沿用 `carrierPathOf` 的 basename）；workspace / doc 两域的名字归主即非 orphan（它们是板面自己的账本与身份文档）；**第二级只对 `draft` / `final` 两行成立**——`rulings` / `report` / `log` / `crash` / `evidence` 与 workspace / doc 两域同规（归主即非 orphan）；**该两级判据与 spec §2.5 的 (i) / (ii) 及 AC「归属（两级）」逐字同口径**（第二级只收 `draft` / `final`；spec v0.10 已按交付回填，本任务只做对账）；零写只显示不动
- `CarrierSeal#sweep` 读 `sealed` 列（零后缀字面），矩阵入参**必填但可空**——`null` ⇒ 零封印（命名谓词已删，没有第二答案），`attribute → null` ⇒ 不封
- `artifact-literal-door.test.ts` 的门骨架与放行面（矩阵行 / 夹具豁免）；**收紧断言不在本任务**：`.rulings.json` 字面集封闭与 `finding` / `id` 接受集单源归 T9

#### Steps

- 写失败测（判据是集合、不是计数）：同一 round 的 `.rulings.json` 与 `.c1.rulings.json` 并存 ⇒ `found` 含非渲染名 ⇒ `read(identity, "rulings", base)` 回 `misplaced`（`derived` = 渲染名 `.c1.rulings.json`、`found` 列全两条）；**同轮变体不在、只剩渲染名 ⇒ `ok`**；盘上零条 ⇒ `absent`；而 `attribute` 两处都仍回同一 `(identity, "rulings")`（供 T6 组报文） —— checkable: 跑红；本步同钉住 `found` 的枚举接缝——两个消费者读同一次目录读取（`Workspace#names()`：`read` 的 `found` 与 `Ledger#orphanHandoffs` 的候选集），`read` 内零第二次 `readdir`
- 交付 `Workspace#names()`：`infra/workspace.ts` 增该成员（一次 `readdirSync`、稳定排序），`Ledger#workspaceFiles` 并入它 —— checkable: `grep -rn "readdirSync" packages/cdd-engine/src-next/session/ledger.ts` 零命中，且同一次目录读取同时供给 `read` 的 `found` 与 `orphanHandoffs` 的候选集（`round-artifacts.test.ts` 的接缝格绿）
- 实现归主文法 + `sealed` 列（矩阵入参升必填可空、命名谓词兜底删除） —— checkable: `round-artifacts.test.ts` + `carrier-seal.test.ts` 绿，且两文件的 `sweep(` 调用已全数补第三入参（`carrier-seal.test.ts` 的全部 9 个 `CarrierSeal.sweep(`；`round-artifacts.test.ts` 的两处**两参调用**——`:615` 的 `dir` 与 `:649` 的 `bare.dir`——改成显式 `null`），且按形参判的门零命中：`grep -rnE "sweep\([^,]+, \[\]\)" packages/cdd-engine/src-next` 零命中（只认 `sweep(dir, [])` 这个字面会漏掉 `:649` 的 `bare.dir`；形参升为 `ArtifactRegistry | null` 后，其余形态由 tsc 兜住）
- 泛化 `orphanHandoffs`（候选集换全目录、认领那一级保留） —— checkable: `session/__tests__/ledger.test.ts` 的 orphan 面绿，两级判据各有一格（矩阵外名字 ⇒ `orphan:` 行；round 域载体归主但无记录认领 ⇒ 仍 `orphan:` 行），且认领两档的**正例各一格**（① 身份相等 ⇒ 不上 `orphan:`；② 记录带绝对 `carrierPath`、扫描给裸名、身份不等、basename 相等 ⇒ 同样不上——两档都不许只在失败方向被钉，否则下一次重构删掉第二档时全绿），并加一格域边界（同一目录里的 `progress.json` / `base.json` / `in-flight.json` / `tasks-<n>-brief.md` 与文档名**不**进 `orphan:`，五类 round 域非载体 `rulings` / `report` / `log` / `crash` / `evidence` 各一条也**不**进 `orphan:`，且 `orphanHandoffs` 的候选集走 `Workspace#names()`），且 `tasks-6,8-implement-1.json` · `tasks-1-fix-1-a2.json` · `tasks-1-fix-1-a2.c1.json` 三条已交付 pin 原样绿
- 删两族六个符号（carrierPattern · `CARRIER` · isCarrierName · #WAVE_CARRIER · #LINE_CARRIER · #handoffOwner），`CarrierSeal#isStray` 改读 `sealed` 列，`round-naming.test.ts` 的 `minted` 断言（数组 `:510` 起、循环 `:531`；`neighbours` 已不在该文件）改由 `attribute` 的 accepted / orphan 两格承担 —— checkable: `session/__tests__/round-naming.test.ts` · `infra/__tests__/carrier-seal.test.ts` · `session/__tests__/ledger.test.ts` 绿，且**逐符号** grep 门全零命中（去注释的生产源码内，六个符号各一条）
- RULINGS_SUFFIX 的退役已随波 3 落地（今日零命中），本任务只保留该回归门 —— checkable: `grep -rn "RULINGS_SUFFIX" packages/cdd-engine/src-next` 零命中（这是回归门，不是本任务的删除动作）
- 写唯一构造点门的骨架 + 判定函数层正反例（矩阵行与夹具放行；样本里注入一条矩阵外的 `.rulings.json` 字面 ⇒ 判定回违例） —— checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/__tests__/artifact-literal-door.test.ts` 绿且反例红；**红态期望**：本任务只到判定函数这一层——真树上此刻仍有 `session/next.ts` 的字面与 `carrier-rulings.ts` 的接受集枚举，「全树封闭」此刻必红，两条收紧用例随 T9 一起落地（先红后绿）

#### Acceptance

归主文法逐行声明且被枚举 pin（`progress` / `base` / `in-flight` / `brief` 四行显式写「无此格」而非留空）；`ArtifactRow` 零 `attribution` 字段；`CarrierSeal` 零后缀字面（RULINGS_SUFFIX 零命中——已随波 3 交付，留作回归门），矩阵入参必填可空（`sweep` 零第二参调用）：`null` ⇒ 零封印、`attribute → null` ⇒ 不封，且 T1 的「两形态判定一致」pin 已被「`null` ⇒ 零封印 ＋ 传入矩阵按 `sealed` 列」取代（`carrier-seal.test.ts` 的 9 处调用全补第三参——8 处 keep 为 `[]`、非空 keep 在 `:148`；`round-artifacts.test.ts` 的两处改写成显式 `null`）；orphan 仍零写只显示，且**两级判据都在**（`attribute → null` 一格 + 「round 域载体归主但没有记录认领」一格），第二级的域写死——只收 `draft` / `final` 两行（这两级判据与 spec §2.5 的 (i) / (ii) 及 AC「归属（两级）」逐字同口径——spec v0.10 已按交付回填，实现者与评审者按同一条对账，不各读一面）；**认领两档各一条正例 pin**（spec AC④）：① 身份相等——记录的 `(op, cycle, attempt)` 与名字解出的身份相等 ⇒ 该名字不上 `orphan:`；② `carrierPath` 档——记录带绝对 `carrierPath`、扫描给裸名、身份不等而 basename 相等 ⇒ 同样不上（这一格必须用**带 `carrierPath`** 的记录；pathless legacy 夹具不在这一格，T8 之后它本就落 `orphan:`）；而 `rulings` / `report` / `log` / `crash` / `evidence` 五类与 workspace 四行、doc 四行一样归主即非 orphan（不进 `orphan:`）：`session/__tests__/ledger.test.ts` 的三条已交付 pin——`tasks-6,8-implement-1.json` · `tasks-1-fix-1-a2.json` · `tasks-1-fix-1-a2.c1.json`——逐条仍回 `orphan:`（泛化不许把它们翻成 `[]`）；本任务**不翻**另一组三格——`session/__tests__/ledger.test.ts` 的「carrierPathOf reads `""` for a pathless cycle-less IMPLEMENT record — the pre-P34 rung is gone」·「orphanHandoffs lists a cycle-less implement carrier — a cycle-1 record never claims it」·「lists a pathless legacy fixture's implement carrier — the folded round is cycle 1, the name is cycle-less」（拆 #legacyCarrierName 梯级的 T8 已随波 6/8/10 交付，三格已按用例名改写并各自回 `orphan:` 行，本任务只要求它们仍回 `orphan:` 行）；拼写知识 #1 / #2 的两族六个符号零残留（carrierPattern · `CARRIER` · isCarrierName · #WAVE_CARRIER · #LINE_CARRIER · #handoffOwner，逐符号 grep 门），`round-naming.test.ts` 的 `minted` 断言（`neighbours` 已不在该文件）已按矩阵归属重锚；门的**放行面**成立（矩阵行 / 夹具豁免，矩阵外样本在判定函数上判违例）；两条收紧（字面集封闭 = `session/next.ts` 值位落地后、接受集单源 = `carrier-rulings.ts` 读行声明落地后）显式归 T9，本任务不宣称它们成立。

#### DependsOn

2, 3

### Task 6: `misplaced = block` 门

#### Objective

落 spec §2.3 / §2.4 的判别值与门，按**交付形**记述（波 4/5 已实现，本任务按四个符号对账、不按旧文重写）：`#artifactCellOf(frame)`（`face/lifecycle.ts`，四个符号全树唯一、按本计划自立的口径不钉行号）每派发算**一次**（`op !== "fix"` ⇒ 无 sidecar 值、`carrier-mismatch` ⇒ 完整性臂），`#artifactReadOf(frame, kind)` 只是它按 kind 的一层读取（体内只 `new ArtifactReads(…).read(…)`，不做第二级合成），`#artifactRefusalOf(cell)`（私有）把 cell 翻成拒绝原因，而 `artifactRefusal(frame: OpenFrame): string | null` 是**唯一对外纯读门**（`--dry-run` 与真实派发同源）；prompt 格与门吃同一个 cell，不各读一次；这一处的**合成位置与两级输入**（spec §2.3 逐字）：该读取 = `ArtifactRegistry#read`（名字 / 在场 / `misplaced` / `absent`——矩阵零解析器，这些臂全是它的事实）× `CarrierRulings#verdict`（严格 schema：`sidecarPath` 由矩阵 `locate` 渲染，`carrier` 键读 carrier 自己的事实）；`ok` 与 `invalid` 的 schema 那一半只来自第二级，`invalid.reason` 原样就是今日门里 `rulings sidecar — <reason>` 的那段原因，矩阵因此**永不解析内容**、也不为 schema 造臂；两级**自 T7 起**在 `session/artifact-reads.ts` 的 `ArtifactReads#read` 里合成一次（`#compose`，T7 的 Files 已记下这次搬家），`#artifactReadOf` 只做委托，`#artifactCellOf` 的那一个 cell 是这次合成的唯一承载，prompt 格与门读的就是这个合成后的单一判别值；`misplaced` ⇒ 派发前 `CDD_BLOCKED: artifact-identity`，报文四段（`derived` / `found` / `identity` / `repair`），多候选全列不选，`--dry-run` 同源可见，child 零 spawn，引擎只拒不改。**门的适用范围 = 本轮 `#artifactReadOf` 实际解析到的 kind**（spec §2.4：今日只有 `rulings`）：矩阵里其余 rendered kind 的行照旧答出 `misplaced: "block"`，但没有派发面去解析它们，盘上那些名字差异仍只落 orphan 观察面；载体自身的 kind 不被这道门判——显式 `-a1` 拼写的载体能归主但不是渲染名，派发照旧放行（否则 T9 的 F4 ① pin 永绿不了，两个任务在同一份输入上互斥）。报文的 `derived:` 与 `identity:` 同源：都从 `attribute(path.basename(the --reviews 载体))` 渲染（载体身份，`op` 恒为 `review`），不由本轮（fix 轮）的 `(line, op)` 算。同任务落**迁移夹具的成对两半**：错位 sidecar ⇒ 拦住；在夹具树里改名成 `.c<N>.rulings.json` ⇒ 同一命令 `ok`、prompt 恰一行路径、child spawn 恰一次。同任务按 spec §4.5 钉住 `unreadable` 一格：推导名在盘上但 IO 失败 ⇒ `invalid(path, "unreadable")`，不得读成 `absent`——「读不到」不得授权「没有」，`art:` 行与派发门都不许把它当缺席。

#### Files

- Modify: `packages/cdd-engine/src-next/face/lifecycle.ts`（**已交付随注**——四个符号取代 #rulingsRefusal：`#artifactCellOf`（每派发一次的**唯一**读取）· `#artifactReadOf(frame, kind)`（按 kind 的一层，只委托 `ArtifactReads#read`）· `#artifactRefusalOf(cell)`（私有）· 对外纯读门 `artifactRefusal(frame)`（四个符号全树唯一，不钉行号）；`#valuesOf` 吃同一个 cell；`derived:` / `identity:` 都由载体身份渲染。本任务按这四个符号核账，**不**把 `#artifactReadOf` 读成「唯一读取」——按-kind 的那一层去核会得出「接缝已有」的错判，正是 T7 读数来源缺失的入口）
- Modify: `packages/cdd-engine/src-next/face/words.ts`（`artifact-identity` 词与四段报文）
- Modify: `packages/cdd-engine/src-next/face/preview.ts`（纯读门同源）
- Modify: `packages/cdd-engine/src-next/face/cli.ts`（`--dry-run` 分支问同一纯读门：`--dispatchOf` 交出 `harness`，渲染预测前先问 `harness.artifactRefusal(frame)`；注入式 dispatch 接缝不持 harness ⇒ 无预测，这是接缝的事实、不是漏判）
- Test: `packages/cdd-engine/src-next/face/__tests__/lifecycle.test.ts`（成对：变体在 ⇒ 停；两处都缺 ⇒ 不拦；派发轮 `fix` + 载体 `review` ⇒ 报文 `identity:` 带 `op=review`、`derived:` 不含 `fix-`；推导名在盘上但不可读 ⇒ `invalid` 且 reason 为 `unreadable`；载体拼写 `plan-review-1-a1.json`（能归主、非渲染名）⇒ 零 `CDD_BLOCKED`——门只判本轮解析到的 `rulings`，不判载体自己的 kind；同一派发只读一次 ⇒ `CarrierRulings.verdict` 恰一次调用（门与 prompt 格共用同一判别值）；矩阵读 `ok` 而 schema 回 `absent`（读竞态）⇒ `invalid` 且 reason 为 `unreadable`、零 spawn）
- Test: `packages/cdd-engine/src-next/face/__tests__/cli.test.ts`（`--dry-run` 可见 + child 零 spawn + 迁移后一半：改名 ⇒ `ok`、prompt 一行路径、spawn 一次）
- Test: `packages/cdd-engine/src-next/session/__tests__/carrier-rulings.test.ts`（同一载体：错位名 `read(identity, "rulings", base)` 回 `misplaced`（`derived` = 渲染名、`found` 列全）、渲染名回 `ok`；两者都经 `attribute` 归到同一 `(identity, "rulings")`）

#### Consumes

- Task 5 的 `attribute` 双候选面与归主文法
- `session/preflight.ts` 的在飞门顺序（门须在取在飞记录之前）
- `face/words.ts` 的既有 `CDD_BLOCKED` 词表

#### Produces

- `#artifactCellOf(frame): ArtifactCell`（每派发一次的**唯一**读取）· `#artifactReadOf(frame, kind): ArtifactReadOf`（按 kind 的一层；两级输入 = 矩阵 `read` × `CarrierRulings#verdict`，schema 那一半只来自第二级，`invalid.reason` 原样是 schema 原因、矩阵零解析器）· `#artifactRefusalOf(cell)`（私有，cell → 拒绝原因）· `artifactRefusal(frame): string | null`（唯一对外纯读门，`--dry-run` 与真实派发同源）
- `artifact-identity` 报文四段的词面，`derived:` / `identity:` 同源于载体身份
- `--dry-run` 的 `reads:` / 拒绝同源
- 迁移成对夹具：错位 ⇒ 四段齐 + 零 spawn；改名 ⇒ `ok` + 一行路径 + 一次 spawn
- 门的作用面：只解析本轮 `#artifactReadOf` 拿到的 kind（今日唯一 `rulings`），不扩展到载体自身的 kind

#### Steps

- 写失败测：错位 sidecar ⇒ `CDD_BLOCKED: artifact-identity`、四段齐、`runner.calls` 为空 —— checkable: 跑红
- 实现读取面 + 门 + 报文（`derived:` / `identity:` 从载体身份渲染） —— checkable: `lifecycle.test.ts` 绿
- 写预览同源测 —— checkable: `cli.test.ts` 的 dry-run 用例绿
- 写多候选测（渲染名合法 + 同身份另一个能归主的名字 ⇒ 仍停） —— checkable: 报文列全、不选、不写
- 写迁移成对夹具（同一 carrier、同一命令；前半错位 ⇒ 拦、后半改名 ⇒ `ok` 且 spawn 一次） —— checkable: `lifecycle.test.ts` + `cli.test.ts` 绿
- 写 `unreadable` 一格：推导名在盘上但不可读（权限 / 读竞态） ⇒ `invalid` 且 reason 为 `unreadable`，`art:` 行与派发门都不许把它当缺席 —— checkable: 已交付——矩阵读面在 `session/__tests__/carrier-rulings.test.ts:383`（渲染名打不开 ⇒ `invalid("unreadable")`），门面在 `face/__tests__/lifecycle.test.ts:1406`（stderr 带 `rulings sidecar — unreadable`、零 spawn）；本任务只核两处零回退
- 写门的作用面一格：载体拼写换成 `plan-review-1-a1.json`（能归主、但不是渲染名） ⇒ 派发零 `CDD_BLOCKED`，同一轮 fix 行照 T9 的 F4 ① 印渲染名 —— checkable: 该断言绿（门的读面只解析 `rulings`）

#### Acceptance

成对 pin 成立（变体在 ⇒ 停 / 两处都缺 ⇒ 不拦且 prompt 字节零变）；多候选不二选一、优先于 `ok`（判据是集合式：任一能归主的名字 ≠ 渲染名即 `misplaced`，故「变体在而推导名缺失」同样拦住，不止「≥2」那一格）；`--dry-run` 与真实面同源；child 零 spawn；报文 `identity:` / `derived:` 由载体身份（`op=review`）渲染，派发轮为 `fix` 时零 `fix-` 段；迁移后半证明「改名即成」这一条消费可见事实；推导名在盘上但 IO 失败 ⇒ `invalid(…, "unreadable")`，`art:` 行与门都不当缺席（§4.5 有 pin，不靠 `existsSync` 二分为缺席 / 存在）。**门只判本轮解析到的 kind**（今日唯一 `rulings`）：载体带显式 `-a1` 拼写不触发 `artifact-identity`——其余 rendered kind 的 `misplaced` 是行声明的策略，没有派发面解析它们。

#### DependsOn

2, 5

### Task 7: board 单向投影（`art:` 事实行 + `--artifacts`）

#### Objective

board 加**一族异常事实行** `art:`（`art:` 头行 + `derived` + `found`，字节按 spec §2.6；默认零字节，健康树不新增字符；只在有 `misplaced` **或** `invalid` 时出现），与 `in-flight:` / `crashed:` / `orphan:` 同族，插在行区之后、`next:` / `reason:` 之前（`next:` 与 `reason:` 仍为最后两行）；`art` **不新增列**、不进尾计数格（`art` 是产物盘点轴，尾行的 `+n` 是 findings 计数轴，两个轴）；`--artifacts` 才摊开「一 kind 一列、一轮一行」的排障视图。board **不持有名字规则**，只渲染矩阵判定结果。

板面的**读数来源**与**名字集**同批钉住——这两样是本节唯一新增的接缝，缺了它们 `art:` 的两臂在 `face/board-view.ts` 里没有落点，实现者只剩「新增一个持帧的读口」或「让板子自己从载体 basename 反解坐标再合成一次」两条路，后者正是「视图面零判定权」与 spec §2.3「两级在同一个函数里合成一次」禁止的第二表达式。**合成读提到无帧接缝**：`ArtifactReads`（`Create: session/artifact-reads.ts`；构造收 `(artifacts, base: Workspace)`，唯一方法 `read(kind, carrier: string, digest: string | null): ArtifactReadOf`）承载矩阵 `read` × `CarrierRulings#verdict` 的两级合成，`Lifecycle`（持帧，把自己算出的摘要传进去）与 `BoardView`（不持帧）是这**一个**接缝的两个消费者，板面零第二次合成；载体 id 集经 `CarrierIntegrity.read(carrierAbs, digest ?? null)` 读出（`null` 是「记录无摘要」的既有事实读，不是第二档判定）。**板面读哪一轮**：`rulings` 的坐标是被评审轮，故板面取该文档线自己的记录序列——`Ledger.readProgress()` 的 `RoundRecord`（`op` / `cycle` / `attempt` + `Ledger#carrierPathOf(type, key, record)` 的载体路径 + `carrierDigest`），只取 `op === "review"` 的那些轮，身份由 `attribute(basename(载体))` 归出（`op` 恒 `review`）；`--artifacts` 的「一轮一行」= 这条记录序列（按 `c<cycle>·a<attempt>` 排序），**不是**目录里出现过的名字集合——板面不新开第二次目录扫描，也不从 basename 反解坐标。

#### Files

- Create: `packages/cdd-engine/src-next/session/artifact-reads.ts`（`ArtifactReads` 深类：**无帧**的两级合成读，构造收 `(artifacts, base)`、唯一方法 `read(kind, carrier, digest)`；`ArtifactReadOf` 值类型从 `face/lifecycle.ts` 迁入，两个消费者共用同一套臂）
- Modify: `packages/cdd-engine/src-next/face/lifecycle.ts`（`#artifactReadOf` 改为委托 `new ArtifactReads(this.#artifacts, this.#scene.workspace).read(...)`，只留按 kind 的一层与帧内的摘要 / id 集取面；`#artifactCellOf` / `#artifactRefusalOf` / `artifactRefusal` 三面不动）
- Modify: `packages/cdd-engine/src-next/face/board-view.ts`（`art:` 事实行 + `--artifacts` 视图，**两种板面同样落块**：node board 用 `#artifactScopes` 的 node / program 两 scope，program board 把 overall 行绑到它已持有的 program seat 落一块，`showArtifacts` 贯穿 `BoardView.render` 两臂；`#ledgerOf` 在同一处构造那个 `Workspace` 并让账本与 `ArtifactReads` 共用它——一处构造、零第二次；`#nodeBoard` 已有的 `ledger` / `progress` 就是记录来源；事实行的三个 key 是板面自己的一份常量（§2.6 的字节与门报文的 `derived:  ` 是两个契约），字节由板面断言钉住）
- Modify: `packages/cdd-engine/src-next/face/cli.ts`（旗标接线）
- Modify: `packages/cdd-engine/src-next/face/declare.ts`（`ARGV_CHANNEL` 增 `artifacts` 行（`{ flag: "--artifacts", type: "bool", help }`），`CLI_COMMANDS` 的 `board.keys` 增该项；help / example 是否连带改在同一步判定）
- Test: `packages/cdd-engine/src-next/face/__tests__/board-view.test.ts`（健康树逐字节不变 + 异常仅新增一个 `art:` 事实块）
- Test: `packages/cdd-engine/src-next/face/__tests__/cli.test.ts`（`--artifacts` 展开面）

#### Consumes

- Task 6 的合成判别值 `ArtifactReadOf` 与它的无帧读口 `ArtifactReads.read(kind, carrier, digest)`（板面只读判定结果，不自己合成）；`CarrierIntegrity.read(path, recordedDigest)` 的「记录无摘要 ⇒ 只读事实」一格（`null` 摘要不是第二档判定）
- 板面的记录来源：`Ledger.readProgress()` 的 `RoundRecord`（`op` / `cycle` / `attempt` · `Ledger#carrierPathOf(type, key, record)` 的载体路径 · `carrierDigest`），只取 `op === "review"` 的轮；`#ledgerOf` 构造的那个 `Workspace` 同时是 `ArtifactReads` 的 `base`（一处构造，零第二次）
- 门的作用面即 `art:` 的**判定集合**：本轮 `#artifactReadOf` 实际解析到的 kind（今日唯一 `rulings`）；其余 rendered kind 的名字差异仍只落 `orphan:`，board 不自行遍历全部 rendered 行（否则 `draft` / `final` 的显式 `-a1` 拼写会同时出现在 `art:` 与 `orphan:` 两个面上——同一名字两个观测面）
- `face/board-view.ts` 的 `nextLine` / `reasonLine` / `inFlightRows` 既有事实行形状
- `face/declare.ts` 的 `ARGV_CHANNEL` / `CLI_COMMANDS` 与 `face/__tests__/channel-closure.guard.test.ts` 的两条闭环腿（声明键必须能在 `ARGV_CHANNEL` 解析、非程序级频道键必须被某条命令声明）

#### Produces

- `art:` 事实行的字面与缩进（与 `orphan:` 同款；`misplaced` 与 `invalid` 两臂）
- `ArtifactReads`（`session/artifact-reads.ts`）：**无帧**的两级合成读，`Lifecycle` 与 `BoardView` 两个消费者；`CarrierRulings.verdict(` 在 `src-next` 生产源码内仍**只此一处**（合成搬到接缝，不是复制一份）
- 板面的读数来源与名字集：被观察轮 = 该文档线的 `RoundRecord` 序列里 `op === "review"` 的那些轮，身份由 `attribute(basename(载体))` 归出；`--artifacts` 的「一轮一行」= 这条序列，不是目录名字集（无记录认领的名字仍只落 `orphan:`）
- `cdd board … --artifacts` 的排障视图
- `ARGV_CHANNEL.artifacts` 声明行 + `board.keys` 的接线（频道闭环不破）

#### Steps

- 写失败测：健康树上 board 输出逐字节等于今日（含 `next:` / `reason:` 位置） —— checkable: 先绿（作为守恒基线）
- 写失败测：一处 misplaced ⇒ 输出恰新增一个 `art:` 事实块（`art:` 头行 + `derived` + `found`，字节按 spec §2.6，块内零额外行） —— checkable: 跑红
- 实现事实行（`misplaced` 与 `invalid` 两臂）+ 旗标 —— checkable: 两条测文件绿
- 接线声明面：`ARGV_CHANNEL.artifacts`（`flag: "--artifacts"`）+ `board.keys`，并在此步判定 help / example 是否连带改 —— checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/face/__tests__/channel-closure.guard.test.ts` 绿，且 `cdd board --plan … --artifacts` 不进 usage
- 写接缝与同源 pin：`ArtifactReads` 是唯一合成点（`grep -rn "CarrierRulings.verdict(" packages/cdd-engine/src-next --include=*.ts` 排除 `__tests__` 后只命中 `session/artifact-reads.ts`），同一夹具 carrier 上板面 `art:` 的 `derived` / `found` 与门报文 `derived:` / `found` 段逐字节相等 —— checkable: `face/__tests__/board-view.test.ts` 与 `face/__tests__/lifecycle.test.ts` 各自那一格绿，grep 门零第二命中
- 写名字集一格：同一文档线两轮 `review`（`c1` / `c2`）各带一个错位 sidecar ⇒ `--artifacts` 渲两行（`c1` / `c2` 序）、默认面两个 `art:` 块都在；目录里一个没有任何记录认领的 `*.rulings.json` **不**进 `art:`（它落 `orphan:`） —— checkable: 该断言绿（读数来源 = 记录序列，不是目录名字集）
- 写 `invalid` 一格：schema 非法的侧车 ⇒ `art:` 行带其 reason、其余行零字节变化 —— checkable: 该断言绿

#### Acceptance

健康树零字节变化（P33/P34/P35 的 board pin 全绿）；异常仅新增 `art:` 事实块（`art:` 头行 + `derived` + `found`，字节按 spec §2.6）；`art:` 插在行区之后、`next:` / `reason:` 之前（后两者仍为最后两行），且 `art` 不新增列、不进尾计数格（产物盘点轴与 findings 计数轴不混）；**program board 与 node board 同一投影**：overall 行自己的 review 轮落 `art:`，`--artifacts` 在两种板面上都展开坐标（旗标不是空转）；`misplaced` 与 `invalid` 两臂都能落 `art:`（`invalid` 带其 reason）；`art:` 的判定集合 = 门的那一个 kind 集（今日唯一 `rulings`），其余 kind 的差异仍是 `orphan:`；`--artifacts` 默认关，且旗标宣告在 `ARGV_CHANNEL` 并被 `board` 声明（频道闭环门绿）；`art:` 的判别值来自**无帧接缝** `ArtifactReads`（`Lifecycle` 与 `BoardView` 两个消费者、板面零第二次合成，`CarrierRulings.verdict(` 生产源码内仍只一处），且同一 carrier 上板面的 `derived` / `found` 与门报文 `derived:` / `found` 段逐字节相等；板面的被观察轮 = 该文档线记录里 `op === "review"` 的那些轮（`--artifacts` 的「一轮一行」即这条序列，无记录认领的名字不进 `art:`）。

#### DependsOn

6

### Task 8: legacy 拆族

#### Objective

按 spec §3 拆掉历史拼写读法，**五个符号族 + 一处正则替代项**（不写「N 处」，一律符号枚举）：① RETIRED_SPEC_KEY / RETIRED_SPEC_LINE_KEYS 的行级回退（`session/ledger.ts` 的两个常量 + `Ledger.rowFor` 的 `spec` 回退行 + #retiredSpecApplies）· ② `Ledger#resolveHandoffName` 的 doc 线 alias（`RETIRED_SPEC_LINE_KEYS.has(type)` 那一支）+ `#resolvedCarrierName` 的 `key === RETIRED_SPEC_KEY` 分支 · ③ #retiredCarrierName（`spec-<op>-<round>.json`）及其两个调用点 · ④ #legacyCarrierName（无 cycle 的 `tasks-<n>-implement.json`）· ⑤ #ownerRow 的退役分支与 #lineWord 的退役分支。上述符号全树唯一，一律按符号名定位、不钉行号（T1 落地后行号已整体漂移，钉了就成下一次误读的入口）。另有 #LINE_CARRIER 的 `spec` 替代项——它随 T5 的 `attribute` 接管归属而消失，不在本任务重复拔。拆后旧 workspace 的板面退化为缺行 + orphan，新派发零影响；P34 §2.6 的「历史零迁移可读」收窄为「历史文件不被删除/改写；引擎不再识别历史拼写」。

#### Files

- Modify: `packages/cdd-engine/src-next/session/ledger.ts`（五个符号族全拆：RETIRED_SPEC_KEY / RETIRED_SPEC_LINE_KEYS 常量与 `rowFor` / #retiredSpecApplies / `resolveHandoffName` / `#resolvedCarrierName` 的旧分支、#retiredCarrierName / #legacyCarrierName 删除、#ownerRow / #lineWord 的退役分支删除）
- Modify: `packages/cdd-engine/src-next/session/round-artifacts.ts`（导出 `roundIdentityKey`：矩阵自己的身份 key 成为认领身份档的唯一比较口径）
- Modify: `packages/cdd-engine/src-next/session/dispatch-authority.ts`（签名收敛的两处调用点：`docDriftHashes(target.type, doc, target.type)` 与 `roundCount(line.key, lead, line.type)` / `roundCount(line.key, "fix", line.type)` 各去掉第三参——那个 `identity` 的唯一消费者是 `Ledger.rowFor(data, key, identity)` 的退役键回退，`rowFor` 收成两参后它是死参；其余同批生产调用点（`session/run.ts` · `face/cli.ts` · `face/board-view.ts`）由各自任务的 Files 行覆盖，行为零变化；`session/pipeline.ts` **不**在这一批——它唯一的 `roundCount(key, mode)` 早就是两参、生产代码未被签名收敛波及，本相位对该文件的改动只落在 `session/__tests__/pipeline.test.ts`；测试侧因签名收敛丢参数的夹具 `session/__tests__/pipeline.test.ts` · `dispatch-authority.test.ts` · `doc-revision-body.test.ts` 随各自文件的 `Test:` 行走，不另立 Files 行）
- Not in this task: `packages/cdd-engine/src-next/session/round-naming.ts` —— 拼写知识 #1（carrierPattern / `CARRIER` / isCarrierName）随 T5 的 `attribute` 接管归属整族删除，本任务不再改动该文件
- Test: `packages/cdd-engine/src-next/session/__tests__/ledger.test.ts`（退役面用例删除 / 改写为「旧键不再解析」；并点名三格（按用例名定位、不钉行号）：`carrierPathOf` 读 `""` 的那格（「the pre-P34 rung is gone」），「orphanHandoffs lists a cycle-less implement carrier — a cycle-1 record never claims it」/ 交付后的无 cycle 拼写格「the cycle-less implement spelling is no longer a read rung — the ladder answers the canonical name」（旧名「keeps a round-less family's round at 1」在树上已零命中，本轮不改写它、只把点名换成现存的这两格）；三格改写为「旧 cycle-less 拼写不再是认领对象」——认领两档都落空：身份档按矩阵自己的 `roundIdentityKey` 比（`cycle` 缺席 ≠ `cycle: 1`，只有 `attempt` 缺省折成 1，因渲染器从不铸 `-a1`），`carrierPath` 档的读梯级一拆即回 `""`，文件落 `orphan:`，不再静默翻断言）
- Test: `packages/cdd-engine/src-next/face/__tests__/board-view.test.ts`（旧 workspace 缺行 + orphan 的期望字节）
- Test: `packages/cdd-engine/src-next/session/__tests__/handoff-plane.guard.test.ts`（legacy 载体「派发不被拦」的 pin：盘上同时有 `spec-review-1.json` 与无 cycle 的 `tasks-1-implement.json` ⇒ 派发 exit 0、零 `CDD_BLOCKED`、两文件各落一行 `orphan:`）

#### Consumes

- Task 2 / Task 5 的矩阵（归主文法接管旧名字 → orphan；#LINE_CARRIER 的 `spec` 分支由 `attribute` 取代）
- spec §3.2 的实测命令与数字（31 workspace / 221 行 / 16 行 `spec` / 193 条 `spec-*`）

#### Produces

- 五个符号族的退役分支零残留（逐族 grep 命中为零）
- `Ledger#completedCycles` / `roundCount` / `docDriftHashes` / `#docRevisionPair` / `rowFor` 的 `identity` 形参一并退役（全树调用点今日全两参、零残留）：`rowFor` 只读一个键基，退役键回退随之消失
- 旧 workspace 的新期望字节（缺行 + orphan）

#### Steps

- 写失败测：`wave: "spec"` 的账本行**不再**解析成文档行（读作缺行） —— checkable: 跑红（今日仍解析）
- 拆五个符号族 + 删两个方法 —— checkable: 该测绿
- 改 board 的旧 workspace 期望字节 —— checkable: `board-view.test.ts` 绿
- 写 legacy 放行 pin（`session/__tests__/handoff-plane.guard.test.ts`：两个 legacy 文件在盘上 ⇒ 派发 exit 0、stderr 零 `CDD_BLOCKED`、板面两行 `orphan:`） —— checkable: 该测绿（两文件走**不同出口**：`spec-review-1.json` ⇒ `attribute → null` 的一级；无 cycle 的 `tasks-1-implement.json` ⇒ `attribute` 仍归主（往返 pin），其 `orphan:` 行由**第二级**「round 域载体归主但无记录认领」给出；`misplaced` 只对「同身份另有非渲染名」成立）；三格已交付 pin 的处置同批点明（按用例名定位，不钉行号：`carrierPathOf` 读 `""` 的那格 + 「orphanHandoffs lists a cycle-less implement carrier — a cycle-1 record never claims it」+ 交付后的无 cycle 拼写格「the cycle-less implement spelling is no longer a read rung — the ladder answers the canonical name」）：它们今日回 `[]` 靠的是两处——身份档把 `cycle` 缺省折成 1，以及 #legacyCarrierName 梯级；本任务把身份档改成矩阵自己的 `roundIdentityKey`（`cycle` 缺席 ≠ `cycle: 1`）并拆梯级，两处同时失效后它们成 `orphan:` 行，三格随之改写（不留在「保 legacy 认领臂」与「静默翻断言」之间的第二条路）
- 全仓 grep 门（**逐族各一条，五条都跑**） —— checkable: 扫描面 = 去注释、排除 `__tests__` 的生产源码（沿用 `src-next/__tests__/support/strip-comments.ts` 的既有姿势，与 T5 / T4 的门同一句），匹配按**符号边界**：RETIRED_SPEC_KEY / RETIRED_SPEC_LINE_KEYS 零命中 · `#retiredCarrierName\b` 零命中 · `#legacyCarrierName\b` 零命中 · `#ownerRow\b` 零命中 · `#lineWord\b` 零命中（无边界锚点的 #lineWord 会永久命中 `face/board-view.ts` 里那个**无关的**既有私有成员 `#lineWordOf`（doc 行类型推导，不在本任务的删除面）与 `session/__tests__/ledger.test.ts` 注释里的那条示例，两者都不在扫描面内；#LINE_CARRIER 的 `spec` 替代项由 T5 的门报零）

#### Acceptance

五个符号族的退役分支零残留（grep 逐族点名；扫描面同 T5 / T4——去注释、排除 `__tests__` 的生产源码，按符号边界匹配，`#lineWordOf` 与注释里的示例不在面内）；#LINE_CARRIER 的 `spec` 替代项随 T5 归零；旧 workspace 板面缺行 + orphan；legacy 载体的**派发放行**有 pin（exit 0 · 零 `CDD_BLOCKED` · 两条 `orphan:` 行）；新派发行为零变化（守恒边界仍绿）。

#### DependsOn

2, 5

### Task 9: 词表别名 · 固定前缀读法句 · 读回提示印路径

#### Objective

三处消费面（spec §2.8 / §2.10）：`rulings` 行的 `identifier` 词表已由 T2 声明，读取面**消费那一行**（`finding` / `id` 双向兼容，内部归一 `finding`，未知键仍整份拒，无第二处枚举）；fix / docs-fix 两壳各补**一句**读法（裁定回答某 finding id 并压过该 finding 自身建议 · carrier 只读）；`INPUT_RULINGS` 只印路径——`#rulingsInputOf` 回单行路径、#rulingLine 删除；`FIX_READBACK_SUFFIX` 从「教规则」改为「印已解析路径」（保留导出，句子逐字节固定、路径是值位，由 `Route` 带值、`RouteRenderer` 只填），并按 D74 记 deliberate pin 重锚（四个站点）。同任务收口另两处第二声明：`session/next.ts` 的字面值与 `carrier-rulings.ts` 的接受集枚举——`Route` 的 fix 臂**新增一个值位字段**（路径作为值下行），值由 `Router#next` 按 `attribute(path.basename(carrierPath))` → `render(…, "rulings")` 算出，`RouteRenderer` 只填空、零推导。**无身份臂**：`attribute` 回 `null`（载体是矩阵外的旧拼写——盘上仍在的 `spec-review-1.json` 就是这一现场，T8 的 legacy 放行 pin 也钉它）时不下发 `rulings` 值位，`FIX_READBACK_SUFFIX` 整段省略（不退化印空槽、也不回落旧规则句），fix 行只剩 `cdd fix … --reviews <path>`；同族先例是 `face/route-render.ts` 的 `reviews === undefined` 臂（只印 `fix`），但 fix 行是 D70 裁决面，这一臂必须在计划里写明、不留给实现者临场发明。

#### Files

- Modify: `packages/cdd-engine/src-next/session/carrier-rulings.ts`（读 `rulings` 行的 `identifier` 词表；`id` / `finding` 双向归一，未知键仍整份拒）
- Modify: `packages/cdd-engine/src-next/render/templates.ts`（两壳各一句读法；`INPUT_RULINGS` 行只印路径）
- Modify: `packages/cdd-engine/src-next/face/lifecycle.ts`（`#rulingsInputOf` 只回路径行；#rulingLine 删除；路径由载体身份渲染）
- Modify: `packages/cdd-engine/src-next/session/next.ts`（`FIX_READBACK_SUFFIX` 收回规则句、改为值位模板（保留导出，`<rendered sidecar path>` 是槽位）；`Route` 的 fix 臂（`{ kind: "fix"; reviews?: string }`）新增值位字段（如 `rulings?: string`），`Router#next` 的两个 fix 分支（两个调用点，均委托 `#fixRoute`）按 `attribute(path.basename(carrierPath))` → `render(identity, "rulings")` 算值写进该字段，`attribute → null` 时不写该字段（无身份臂）；文件内零 `.rulings.json` 字面）
- Modify: `packages/cdd-engine/src-next/face/route-render.ts`（五处 fix 行填 `Route` 带来的值——与门 `derived:` 同值、由载体身份算出；`#fixText` 只填 `route.rulings`，零推导；`route.rulings === undefined` ⇒ `FIX_READBACK_SUFFIX` 整段省略，零空槽）
- Modify: `packages/cdd-engine/src-next/session/round-artifacts.ts`（`ArtifactRegistry#reviewedIdentityOf(name)`：被评审轮身份的唯一入口——`attribute(basename(name))` + `op` 恒 `review`，`cycle` / `attempt` 取载体自己的坐标；`ArtifactReads` 与 `Router#next` 两处都调它，`op: "review"` 的身份构造在生产源码内只此一处）
- Modify: `packages/cdd-engine/src-next/__tests__/artifact-literal-door.test.ts`（把 T5 的判定函数门收紧成真树断言：`.rulings.json` 字面集 = 矩阵行 + 夹具，`finding` / `id` 接受集恰一处声明，**被评审轮身份的 `op: "review"` 构造恰一处**（`op: "review" | "fix"` 的类型标注是另一件事实，门排除它））
- Test: `packages/cdd-engine/src-next/session/__tests__/carrier-rulings.test.ts`（`id` 与 `finding` 双向，未知键仍拒）
- Test: `packages/cdd-engine/src-next/render/__tests__/render.test.ts`（两壳各含读法句；`INPUT_RULINGS` 的模板面只固定前缀句，正文零行那条不在这一层断言）
- Test: `packages/cdd-engine/src-next/face/__tests__/lifecycle.test.ts`（侧车**真的带** rulings 时 round context 恰一行 `- \`INPUT_RULINGS\``、零缩进正文行；同一轮里 fix 行印的路径与门报文 `derived:` 段逐字节相等）
- Test: `packages/cdd-engine/src-next/face/__tests__/face.test.ts` + `packages/cdd-engine/src-next/face/__tests__/cli.test.ts` + `packages/cdd-engine/src-next/face/__tests__/capsule.test.ts` + `packages/cdd-engine/src-next/session/__tests__/next.test.ts`（fix 行字面重锚为具体解析出的 sidecar 路径；`next.test.ts` 是本任务改动的常量真正的钉家——两格按**用例名**定位（该文件已两轮因行号漂移被判）：「the fix-route readback suffix is the declared single-source wording — a VALUE slot, never a naming rule」用 `toBe(...)` 钉住 `FIX_READBACK_SUFFIX` 的整句字节（旧句含 `same path with .json replaced by .rulings.json`）、「the readback suffix keeps its literal type at compile time」用字面类型注解钉住编译期形状，两格都是「模板 + 值位」形态的重锚点；`packages/kairos/tests/status-routing-convergence.test.ts` **不在本名单**：它是 skill 文本门（`FORBIDDEN` / `REQUIRED` 两组正则扫三份 `SKILL.md`），全文零 fix 行、零 `FIX_READBACK_SUFFIX`，本任务对它零影响；外加一格**载体拼写 ≠ 渲染名**的 pin——载体 `plan-review-1-a1.json`（渲染器从不铸 `-a1`）⇒ fix 行印渲染名 `plan-review-1.c1.rulings.json`，不是换尾名 `plan-review-1-a1.rulings.json`）

#### Consumes

- Task 2 的 `rulings` 行（含 `identifier` 声明）与其渲染
- Task 6 的判别值（present / absent 两格）与载体身份
- `face/route-render.ts` 的五个 fix 行拼装点
- `session/next.ts` 的 `Route` 判别联合与 `Router#next` 的两个 fix 分支（两个调用点，均委托 `#fixRoute`；全树唯一符号，不钉行号）——值位字段与算值入参的宿主

#### Produces

- `rulings` 行 `identifier` 的唯一读取点（消费行声明，无第二处枚举）
- 两壳的读法句（字节稳定）
- `#rulingsInputOf` 的单行路径形态（#rulingLine 零残留）
- `FIX_READBACK_SUFFIX` 的值位模板（保留导出；句子逐字节固定，路径由 `RouteRenderer` 从 `Route` 填）与新的 `next:` fix 行字面
- `Route` fix 臂的值位字段（名字由 `Router#next` 按载体身份算出，不按文件名换尾）
- 门的三条收紧用例（与 T5 的判定函数同文件）：`.rulings.json` 字面集 = 矩阵行 + 夹具、`finding` / `id` 接受集恰一处声明、被评审轮身份的构造恰一处
- 被评审轮身份的唯一入口 `ArtifactRegistry#reviewedIdentityOf`（sidecar 读接缝与 `Router#next` 两个消费者共用，`op: "review"` 构造在生产源码内单源）
- 无身份臂：`attribute → null` ⇒ `Route` 的 `rulings` 值位缺席、`FIX_READBACK_SUFFIX` 整段省略（零空槽、零回落规则句），fix 行只印 `cdd fix … --reviews <path>`

#### Steps

- 写失败测：`id` 键的 sidecar 被接受、未知键仍拒 —— checkable: 跑红
- 写失败测：侧车带裁定时 round context 恰一行路径、零正文行（夹具的 `rulings` 非空） —— checkable: 跑红（今日每条形一行缩进正文）
- 写失败测：两壳各含读法句 —— checkable: 跑红（模板层）
- 实现五处（carrier-rulings 读行声明 / templates 两壳 + 单行 / lifecycle 单行 / next 的路由器算值 + 值位模板 / route-render 只填值） —— checkable: `carrier-rulings.test.ts` · `render.test.ts` · `lifecycle.test.ts` 三文件绿
- 把门收紧成真树断言（同一文件：`.rulings.json` 字面集 = 矩阵行 + 夹具、`finding` / `id` 接受集恰一处声明） —— checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/__tests__/artifact-literal-door.test.ts` 绿；**红态期望**：`next.ts` 的字面与 `carrier-rulings.ts` 的枚举在本任务前仍在，两条断言先红后绿，事后注入第二处即红
- 写 F4 的两条 pin：① 载体 `plan-review-1-a1.json` ⇒ fix 行印 `plan-review-1.c1.rulings.json`；② 同一轮 fix 行路径与门报文 `derived:` 段逐字节相等 —— checkable: ① 先跑红（今日按文件名换尾得 `plan-review-1-a1.rulings.json`），② 实现后绿
- 写无身份臂 pin：`--reviews spec-review-1.json`（盘上可读、矩阵外的 P34 前拼写）⇒ fix 行印 `cdd fix … --reviews <path>`、零 `.rulings.json` 字面、零空槽、零规则句 —— checkable: 该断言绿（今日该形态回落旧规则句）
- 重锚四个 fix 行 pin（deliberate · D74） —— checkable: `face.test.ts` · `cli.test.ts` · `capsule.test.ts` · `session/__tests__/next.test.ts` 四文件绿（后者按用例名定位的两格——整句 pin 与字面类型 pin——改成「模板 + 值位」形态；`status-routing-convergence.test.ts` 是 skill 文本门、不受影响）

#### Acceptance

`finding` / `id` 双向且未知键仍整份拒、接受集单源；两壳读法句在册且 `INPUT_RULINGS` 恰一行路径、零正文行、#rulingLine 零残留；fix 行印解析后路径、`session/next.ts` 零 `.rulings.json` 字面；四个 pin 站点（`face.test.ts` · `cli.test.ts` · `capsule.test.ts` · `session/__tests__/next.test.ts`，后者两格按用例名点名：整句 pin · 字面类型 pin）按路径重锚；载体拼写 ≠ 渲染名时 fix 行印渲染名（非换尾名），且与门 `derived:` 逐字节相等；载体拼写是矩阵外旧名（`spec-review-1.json`）时 `rulings` 值位缺席、`FIX_READBACK_SUFFIX` 整段省略（零空槽、零回落规则句，与 T8 的 legacy 放行 pin 同一现场）；门的三条收紧断言真树绿；被评审轮身份（`op: "review"`）在生产源码内只有一处构造（`ArtifactRegistry#reviewedIdentityOf`），sidecar 读接缝与路由器都问它；spec AC 第四主站点的替换（`packages/kairos/tests/status-routing-convergence.test.ts` → `session/__tests__/next.test.ts`）记入编排器的 spec 补记清单。

#### DependsOn

2, 6

### Task 10: `docRoots` 零拼接门 + help 示例改形

#### Objective

把 #485 从「修一个分支」变成「结构上不允许写出来」：`docRoots` 只允许出现在三处白名单（`SlugIndex` 扫描根 · runtime/`RepoRoot` 组合（`contract/invariants.ts` 的 `#scanRoots`） · `contract/invariants.ts` 的命名空间派生）；任何以 doc root 为基的模板串或 `path.join` 组合即红。`face/declare.ts` 的四个 help 示例（`implement` / `review` / `base set` / `board`）改成 `--plan <path>` / `--spec <path>` 形，零文档根插值。

#### Files

- Modify: `packages/cdd-engine/src-next/face/declare.ts`（四处示例）
- Create: `packages/cdd-engine/src-next/__tests__/doc-path-door.test.ts`（结构门：源码扫描）
- Test: 同一文件内的正反例（白名单三处放行 / 一处模板串即红）

#### Consumes

- Task 4 删除两条派生后的树（门落地即绿的前提）
- 白名单三项（按 spec §2.9 ④ 的顺序）：① `SlugIndex` 的扫描根——`#scanRoot` 的一处调用（`infra/slug-index.ts:191`，在 `DOC_ROOT_KEYS.map` 里按三根迭代；声明在 `:329`）与静态谓词 `insideDocRoots`（`:150`）· ② runtime / `RepoRoot` 组合——`contract/invariants.ts` 的 `#scanRoots`（全树唯一，按符号名定位）把 `ENGINE_DOC_ROOTS` 的值与根 `path.join` 起来 · ③ 命名空间 / 段派生——`contract/invariants.ts` 的 `DOC_ROOT_NAMESPACE` / `DOC_ROOT_SEGMENTS`（`:56` / `:61`）
- `check:no-bare-functions` 的门形态先例（`scripts/` 的 grep 门）

#### Produces

- 一条可执行的结构门（`doc-path-door.test.ts`）
- 四处 help 示例的新形态（消费可见字节变化，记 D74）

#### Steps

- 写门 + 正反例（先在白名单上跑绿、在注入的模板串上跑红） —— checkable: 门文件自测绿
- 改四处示例 —— checkable: 门绿且 `cli.test.ts` 的 help 断言重锚后绿
- 全仓跑门 —— checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/__tests__/doc-path-door.test.ts` 绿

#### Acceptance

门可红可修：注入一处 `${docRoots.specs}/${slug}` 即红；白名单三处零误报；`declare.ts` 四处示例零文档根插值。

#### DependsOn

4

### Task 11: 消费面三 skill + README 双语迁移段

#### Objective

消费面落点与迁移说明（spec §2.10 / §3.4）：`cdd-dev` / `cdd-plan` / `cdd-spec-writer` 各一条裁决落点指令（挂既有 `## Invariants` 表尾一行，**不改** `skill-anatomy` 的 section registry）；三行编号固定且与今日表尾相邻：`cdd-dev` = `I6` · `cdd-plan` = `I5` · `cdd-spec-writer` = `I4`（**已交付**：三份 `SKILL.md` 的 `## Invariants` 表尾即这三行——`cdd-dev/SKILL.md:62` · `cdd-plan/SKILL.md:83` · `cdd-spec-writer/SKILL.md:77`）；**三者同句**——句子主体逐字节相同：fix 派发若某条 finding 需要裁定，把裁定写到引擎在 `next:` 里印出的那个 sidecar 路径上，编排器永不自行推导该路径；落点一律指向引擎在 `next:` 里印出的那个路径，因此 skill 文本对 `.rulings.json` 字面零命中；cdd-engine README（EN + `.zh-CN.md` **双语同源**）补迁移段：一次性改名命令（对每个 `<line>-<op>-<n>.rulings.json`、其同目录存在终稿 `.c<N>.json` 者改名为 `.c<N>.rulings.json`）+ 「改名后必须复判」一句 + 升级后首次派发会 `CDD_BLOCKED: artifact-identity` 的说明（命令本身通用、不带任何仓的计数：`89` 是 issue 提交方那个**消费仓**的实测，留在 spec §1.1 / §3.4 的依据段——本仓是反向标定（51 个 sidecar 全部落在推导路径上），引擎 README 是消费面文本，写他人仓的数字会被读成本包的事实）；两个 README 的 `## Migration` / `## 迁移` 段由结构测试守住（命令字面与复判句各一条，先红后绿）。母契约 Phase inventory 的 P36 plan Done 格也由本任务拥有并同批登记（文件名 + 日期，零版本字面）——**判据是身份而不是版本**：该格写 `✔ Done（<文件名> · <日期>）`、不带任何版本字面（分支评审 4 的裁定：登记表只记身份与闭合，受控文档的当前版本一律读它自己的 front-matter `version:`——「格里即当前版本」的旧约定正是同一处 blocker 在本相位四次的成因，改回镜像只会再造第五次）；本任务不复述任何「今日」版本数字（写死当轮实测值就是让这条登记每轮失效一次）。「待下一次」这层假定已经两次落空（波 2/3 修复轮推进时母契约未随改），不要把叙述再写成「与计划同版」。

#### Files

- Modify: `packages/kairos/skills/cdd-dev/SKILL.md`（`## Invariants` 表尾加一行 `I6`，句子主体与其他两处逐字节相同）
- Modify: `packages/kairos/skills/cdd-plan/SKILL.md`（同句，表尾 `I5`）
- Modify: `packages/kairos/skills/cdd-spec-writer/SKILL.md`（同句，表尾 `I4`）
- Modify: `packages/cdd-engine/README.md` + `packages/cdd-engine/README.zh-CN.md`（迁移段，双语同源）
- Create: `.changeset/skill-ruling-landing.md`（**已交付随注**：该文件已在盘上，front-matter 声明 `"@oscaner-skills/kairos": minor`，理由 = 三条落点指令进既有 `## Invariants` 表尾；`cdd-engine` 侧**不新写条目**，口径见 Steps 的 changeset 步——复用四份既有 minor 条目的合并读）
- Test: `packages/kairos/tests/skill-anatomy.test.ts`（既有强判：新行不得越出 registry）
- Modify: `docs/kairos/overalls/2026-10-10-engine-doc-tooling-overall.md`（Phase inventory P36 行的 plan Done 格：判据 = 该格以文件名 + 日期记闭合、**不带版本字面**——登记表只记身份与闭合，版本由文档自己的 front-matter `version:` 承担，故本计划升版不再产生待回填的指针；只核判据、不写「今日」数字（design 侧同格同判、本任务不动）；登记动作归编排器，但计划要有一个拥有它的任务，不再挂在 Change history 的「待下一次」里）
- Test: `packages/kairos/tests/presentation-surface.test.ts`（README 双语同步的既有 pin 就在此文件：镜像家庭与逐镜像标题序列；目录不是 pin，不可逐条核。那层 pin 对迁移段整段缺失仍是绿的，故**已交付**两条迁移段结构断言（同一 `RULING_SIDECAR_MIGRATION` 块，`:400-441`）才是它的补丁：`:421` 断 `packages/cdd-engine/README.md` 与 `README.zh-CN.md` 的迁移段各含改名命令行（`<line>-<op>-<n>.rulings.json` → `.c<N>.rulings.json`，且命令非覆盖式 `mv -n`）、`:436` 断「改名后必须复判」一句与 `CDD_BLOCKED: artifact-identity`）
- Test: `packages/kairos/tests/skill-surface-consistency.test.ts`（**已交付**两条文本门：`:194` 让全部 shipped skill 文本——`SKILL.md` 与 skill `docs/*.md`——对 `.rulings.json` 字面零命中；`:174` 断三处落点句**逐字节相同**（取三份 `SKILL.md` 的 `I6` / `I5` / `I4` 行，比行内句子主体））

#### Consumes

- Task 9 的落点语义（裁定文件的路径与读法）
- `contract/skill-anatomy.ts` 的 `## Invariants` 既有 section（宿主）
- AGENTS.md 的语言政策（README 家族 EN + `.zh-CN.md` 同源）

#### Produces

- 三 skill 各一行落点指令（零程序史 / 零相位号 / 零 `.rulings.json` 字面；编号 `I6` / `I5` / `I4`；三处句子逐字节相同）
- README 双语迁移段（命令 + 首次派发行为 + 改名后必须复判）
- 两个包的 changeset 各有拥有者：`.changeset/skill-ruling-landing.md` 承载 `kairos` minor；`cdd-engine` 不新写条目，由今日四份既有 minor 的合并读承载（四处消费可见变化逐项有名，见 Steps 的 changeset 步）

#### Steps

- 写三行指令（同一句、编号 `I6` / `I5` / `I4`） —— checkable: `pnpm -C packages/kairos exec vitest run tests/skill-anatomy.test.ts` 绿
- 写 skill 文本门（`skill-surface-consistency.test.ts` 内两条：全树 skill 文本对 `.rulings.json` 字面零命中；三处落点句逐字节相同——`:194` 是零字面门（基线零命中、注入一处字面即红），`:174` 是同句门（三处句子主体逐字节比对，一处漂移即红）） —— checkable: 该门绿
- 写 README EN 段 + zh-CN 镜像，并在 `presentation-surface.test.ts` 补两条迁移段结构断言（改名命令 + 「改名后必须复判」） —— checkable: 该两条断言落在 `presentation-surface.test.ts:421`（改名命令）与 `:436`（复判句）上并绿，双语 pin 绿；两个 README 的迁移段今日已各带非覆盖式 `mv -n` 改名脚本（`packages/cdd-engine/README.md:91` · `README.zh-CN.md:98`）
- 登记母契约 Phase inventory 的 P36 plan Done 格（文件名 + 日期，零版本字面） —— checkable: `grep -n "engine-doc-tooling-p36.md" docs/kairos/overalls/2026-10-10-engine-doc-tooling-overall.md` 回出的那格是本计划文件名 + 日期，且该格零 `v<major>.<minor>` 字面
- 落 changeset（**已交付**：`.changeset/skill-ruling-landing.md` 已在盘上，`"@oscaner-skills/kairos": minor`，理由点名三条落点指令进既有 `## Invariants`）；`cdd-engine` 侧**不新写条目**——四处消费可见变化已由四份既有 minor 条目逐项承载（`.changeset/artifact-identity-gate.md` = `artifact-identity` 硬停门 · `.changeset/artifact-board-projection.md` = `INPUT_RULINGS` 零正文 + fix `next:` 印 `RESOLVED sidecar path` · `.changeset/plan-identity-read.md` = doc-contract 面两条：`<slug>-design.md` 派生废除、身份才是判据，以及未入册 plan 落未判态 + 一行 `CDD_WARN:` · `.changeset/artifact-matrix-round-doc.md` = round / doc 两域登记：`CarrierRulings.pathFor` 退役（sidecar 名由**被评审轮**身份渲染）、`SlugIndex#identityDoc` / `#planOf` 退役为 `docsOf(slug)` + `hasIdentity(slug)`、doc 域 `read` 对重复身份回 `invalid(found)`），本步只核对映射成立、**不改这四份文件** —— checkable: `grep -l '"@oscaner-skills/kairos"' .changeset/*.md` 非空且该文件声明 `minor`（带引号串在 `.changeset/README.md` 里零命中，不是假阳性基线），四份条目各自命中关键词（`CDD_BLOCKED: artifact-identity` · `INPUT_RULINGS` · `RESOLVED sidecar path` · `spec-absent` / `undecided` · pathFor 退役 / `hasIdentity(slug)`），`pnpm exec vitest run scripts/__tests__/changeset-levels.test.ts` 绿
- 全量门 —— checkable: `pnpm run validate` exit 0

#### Acceptance

三 skill 各一条、编号 `I6` / `I5` / `I4`、**三者同句**（句子主体逐字节相同，由 `skill-surface-consistency.test.ts` 的文本门比对三处 `I<n>` 行），且均在 registry 既有 section 内；skill 文本对 `.rulings.json` 字面零命中（`skill-surface-consistency.test.ts` 的文本门在册，零程序史 / 零相位号同条守卫）；README 双语同源（pin = `packages/kairos/tests/presentation-surface.test.ts`），且迁移段的两条结构断言在该文件先红后绿（改名命令 + 「改名后必须复判」）；母契约 Phase inventory 的 P36 plan Done 格以文件名 + 日期记闭合、不带版本字面（判据是身份不是版本：登记表不镜像受控文档的 `version:`，design 侧同格同判、本任务不动；不复述当轮数字）；`pnpm run validate` exit 0；changeset **两个包各自在册、且各有拥有者**——`kairos` 是新写的一条 `.changeset/skill-ruling-landing.md`（`"@oscaner-skills/kairos": minor`）——`cdd-engine` **不新写条目**、由四份既有 minor 的合并读承载，四处消费可见变化逐项有主（`.changeset/artifact-identity-gate.md` = `artifact-identity` 硬停门 · `.changeset/artifact-board-projection.md` = `INPUT_RULINGS` 零正文 + fix `next:` 行改为印已解析路径（D70 裁决面 · D74） · `.changeset/plan-identity-read.md` = **doc-contract 面两条同条记入**：其中一条是 plan 文件在盘上却缺 `doc-type: plan`——今日健康渲出、落地后落未判态 `(none)` + 一行 `CDD_WARN:`；另一条是同面最该写清的那条升级：`<slug>-design.md` 存在、但它声明的 slug 不是本 plan 的 slug 时，今日放行、落地后判 (b)（身份才是判据，文件名不是——这是本相位唯一一处「今天能派发、落地后被 `CDD_BLOCKED: doc-contract` 挡下」的行为） · `.changeset/artifact-matrix-round-doc.md` = **round / doc 两域登记**：`CarrierRulings.pathFor` 退役（sidecar 名由被评审轮身份渲染）、`SlugIndex#identityDoc` / `#planOf` 退役为 `docsOf(slug)` + `hasIdentity(slug)`、doc 域 `read` 对重复身份回 `invalid(found)`）；`scripts/__tests__/changeset-levels.test.ts` 绿——该文件的两条整表断言是「no changeset declares a major」（全表零 `major`）与「every changeset declares at least one level」（每条至少声明一档），发布级别取全表最高一档（今日 `minor`，零 `major`）。

#### DependsOn

8, 9, 10

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-11-15 | 初稿：11 个任务按 `DependsOn` 成 **6 波**（W1{1} 矩阵骨架+workspace · W2{2,3} round/doc 两域 · W3{4,5} plan-source 三态 + 归属/辨识面 · W4{6,8,10} 门 / legacy 拆除 / docRoots 门 · W5{7,9} board 投影 + 词表与提示面 · W6{11} 消费面与迁移），每波 ≤3 个任务；守恒边界与「引擎只拒不改」写进 Global Constraints。 | [human] 裁定 · Claude（kairos:cdd-plan · 2026-11-15） |
| v0.2 | 2026-11-15 | 计划评审 round 1 全量落地（F1–F18）：**F1** T3 改成 spec §4.4 的读面——doc 域 `read` 判重复身份（`invalid(found:[a,b])`）、`attribute` 回 `Attributed \| null` 无第三态、`identityDoc` / `planOf` 退役为 `docsOf`（0/1/n）+ `hasIdentity`，四个消费者（`planChain` · `Cli#sceneOf` · `BoardView#nodeSources` · `#programBoard`）与 `locate` / `IdentityDomain` 契约各有归属 · **F2** `INPUT_RULINGS` 零正文的改动落点移进 T9 的 Files（`face/lifecycle.ts` 的 `#rulingsInputOf` 单行、#rulingLine 删除），pin 上移到 prompt 层（夹具带裁定，断言恰一行路径、零缩进正文行），`render.test.ts` 只留固定前缀句 · **F3** `rulings` 身份来源写清并同句复述于 T2 / T6 / T9 与 Constraints：`attribute(path.basename(the --reviews 载体))`、`op` 恒 `review`，加「派发轮 fix + 载体 review ⇒ 名字带 review 不含 fix」的 pin · **F4** T1 补齐 `Cli#baseBranchOf`，把「两处 / 三处」换成符号枚举（`InFlight.FILE` · `Artifacts#baseSet` / `#readBase` / BaseGet · `Cli#baseBranchOf` · `Ledger#readProgress` / `#writeProgress`）并让零差 pin 点名覆盖文件 · **F5** 两个不存在的测试路径重指既有文件（`face/__tests__/cli.test.ts` + `infra/__tests__/carrier-seal.test.ts`；`contract/__tests__/judge.test.ts` + `lint.test.ts`）并写明红态 · **F6** `SlugIndex.build` 写成「五处 → 三处」，结构断言改为「这三处之外无命中」 · **F7** `discarded()` 改为按根记录（三根各一对、共六值），点名两个判断各读哪些根，加「脏 specs × 干净 plans ⇒ plan 路径仍 `undeclared`」的混合格 · **F8** T4 补 `CDD_WARN: <plans 根> — <n> discarded candidate(s)` 的观测面与 P35 AC ③ 的 `cli.test.ts` 重锚，changeset 理由在 T11 点名 · **F9** `ArtifactRow` 按 spec §2.1 定形（有 `identifier?` / `policy?`、无 `attribution`），归主文法改写为三条规则 + 逐行答案表 + 枚举 pin，`identifier` 声明落在 `rulings` 行 · **F10** `CarrierRulings` 采用 spec 的 `read(sidecarPath, carrierPath)` / `verdict(sidecarPath, carrierPath, findingIds)`，渲染留在调用方 · **F11** 往返 pin 每 kind 跑两遍（带 / 不带 cycle），补 `rulings` 的无 cycle 形态与其 `misplaced` 收窄 · **F12** T9 补 `face/__tests__/face.test.ts` 与 `capsule.test.ts` 两个重锚站点，并明确 `FIX_READBACK_SUFFIX` 保留导出、改为值位模板 · **F13** T8 删掉计数，按 spec §3.1 枚举五个符号族（#ownerRow / #lineWord 按分支点），点名 #LINE_CARRIER 的 `spec` 替代项随 T5 消失，grep 门逐族各一条 · **F14** 新增 `.rulings.json` 字面与 `finding` / `id` 接受集的唯一构造点门（`__tests__/artifact-literal-door.test.ts`，T5 落） · **F15** T4 统一「字段退役」口径并给出 `planOrphanSpec(slug: string): string` 的报文，加 `infra/` 内派生零命中门 · **F16** T6 补迁移成对夹具（改名前后同一命令：拦 → `ok` + 一次 spawn） · **F17** 计划头补 `## Review Focus`（五类高发输入 + 期望行为 + 归口任务步骤） · **F18** T2 Step 1 从身份写断言（含无 cycle 形态）。 | [human] 裁定 · Claude（kairos:docs-fix · 2026-11-15） |
| v0.3 | 2026-11-15 | 计划评审 round 2 全量落地（F1–F10）：**F1（blocker）** 唯一构造点门按落地时点拆两半——T5 只落判定函数骨架与放行面（矩阵行 / 夹具豁免、`CarrierSeal` 零后缀字面）并写明红态，字面集封闭与 `finding` / `id` 接受集单源两条收紧移进 T9（`session/next.ts` 与 `carrier-rulings.ts` 才是两处第二声明真正消失之处，T9 经 T6 严格晚于 T5、加依赖会成环）· **F2** T1 补矩阵的构造点与注入面（命令前导一次构造、与 T3 之后的单建 `SlugIndex` 同址；`Lifecycle` opts / `Ledger` 构造器 / `CarrierSeal` 与 `BoardView` 显式入参；零模块级默认实例）并写进 Acceptance · **F3** `face/cli.ts` 写进 T4 Files（`#runBoard` / `#boardReadTable` / `#sceneOf` 与两个 `new PlanSource` 点），`PlanSource` 构造收索引成一条 Step 与 Acceptance · **F4** T9 点名 `Route` fix 臂的新值位字段与 `Router#next` 按载体身份算值、`RouteRenderer` 只填，补两条 pin（载体 `plan-review-1-a1.json` 印渲染名而非换尾名 · fix 行路径与门 `derived:` 逐字节相等）· **F5** `face/declare.ts` 写进 T7（`ARGV_CHANNEL.artifacts` + `board.keys`），checkable 加频道闭环门绿 · **F6** `brief` 的生产渲染同期入矩阵（`briefName` / `#brief` 只做委托，`CliGate#renderBrief` / `Preview#readsOf` 随改），T1 Step 4 的结构断言扩到 `tasks-{tasks}-brief.md` · **F7** legacy「派发不被拦」的 pin 落到 T8 的 `session/__tests__/handoff-plane.guard.test.ts`，Review Focus 归口改指真实落点 · **F8** T3 把「`attribute` 维持」改为「索引只答集合、名字 → 身份归 `DocDomain`」（索引侧零 `attribute`、`Attributed` 由 T1 定义），红态与 pin 归属写清 · **F9** T10 的 Consumes 按 spec §2.9 ④ 的三项顺序重写并点名 `#scanRoots`（`contract/invariants.ts:1478`）· **F10** T7 补 `invalid` 一格（`art:` 行带 reason、其余零字节变化）。 | [human] 裁定 · Claude（kairos:docs-fix · 2026-11-15） |
| v0.4 | 2026-11-15 | 计划评审 round 3 全量落地（F1–F9）：**F1** 矩阵的注入面从四个读面扩到**五个**——`NextStepRouter` 构造器也接注入 registry（T1 Objective / Files / Produces / Step 5 / Acceptance 同步），`Ledger#router` 从字段初始化改为构造体内赋值（字段初始化先于构造体，registry 又是构造器入参），`face/cli.ts:1363` 与 `session/run.ts:404` 传同一实例，T9 的 `Router#next` 算值接这条注入 · **F2** 唯一构造点门的扫描面写成**生产源码**（去注释 + 排除 `__tests__`，沿用 `src-next/__tests__/support/strip-comments.ts` 的既有姿势），测试经夹具助手取实例——按字面的「`src-next` 内恰一处」不可满足（T1 自己的测试就要实例化 registry）· **F3** 无 cycle 形态只断**身份**：`draft` 与 `final` 本就同名（既有 pin `round-naming.test.ts:99-105`）、`kind` 归一 `draft`，不再对 `final` 那一格断言 kind；round 域 `attribute`（渲染名反解）明确划给 T2，T5 只加 `misplaced` 一格 · **F4** T5 点名删除拼写知识 #1 / #2 的两族六个符号（carrierPattern · `CARRIER` · isCarrierName · #WAVE_CARRIER · #LINE_CARRIER · #handoffOwner），补逐符号 grep 门与对应 Step，`round-naming.test.ts:515-540` 的 `minted` / `neighbours` 断言按矩阵归属重锚；T8 的「若 `CARRIER` 随拆」条件式改为明写「由 T5 整族删除」· **F5** `SlugIndex.build` 的「一处」定义成每个命令的唯一构造入口（私有 `#indexOf(root)`，`#runBoard` / `#sceneOf` / `#runBase` 共用），「单建一次」= 同一命令内不再二建而非三条命令共享同一对象；Objective / Files / Produces / Step 5 / Acceptance 同步 · **F6** T6 补 §4.5 的 `unreadable` 一格（推导名在盘上但 IO 失败 ⇒ `invalid(reason: "unreadable")`，`art:` 行与门都不当缺席），写进 Objective / Files / Step / Acceptance · **F7** 三处符号枚举的 BaseGet 改为 `Artifacts#baseGet`（树里真实存在的成员）· **F8** T11 的 README pin 从目录改为 `packages/kairos/tests/presentation-surface.test.ts`（镜像集 + 逐镜像标题序列）· **F9** 「skill 文本零 `.rulings.json` 字面」落进 T11 的 Objective / Files / Step / Acceptance，门挂在 `skill-surface-consistency.test.ts`（今日零命中是基线）。 | [human] 裁定 · Claude（kairos:docs-fix · 2026-11-15） |
| v0.5 | 2026-11-15 | 波 1（T1）修复轮全量落地（F1–F6）：**F1** 矩阵**不再绑 workspace**——`locate` / `read` 收 `base: Workspace`（读取时的坐标），一块板一次渲多个节点 workspace 时不再把别的节点的名字解析到这一处；这是对 spec §2.2 契约形状的**显式修订**（同笔记入 T1 Objective / Produces / Acceptance），`IdentityDomain` 加一格 `entries()` 让行集带键。**F2** `ArtifactRegistry.nameOf(kind, tasks)` 显式记成同一行渲染的**模块级入口**（逐字委托 `renderWorkspace`，不是第二拼写），补「两条入口逐 kind 相等」的 pin；BASE_NAME 与 `Cli#baseBranchOf` 的内联缓存改经注入实例的 `render`。**F3** `workspaceName` 对「brief 缺坐标 / 三字面量带坐标」两条入口都抛错，`nameOf` 去默认值（默认值正是非法形态的入口）。**F4** 读取面按 spec §4.5 判：ENOENT ⇒ `absent`；存在但读不出、或不是普通文件 ⇒ `invalid(reason)`；外来域 / 未登记 kind 抛错（与 `render` 同面，不伪装成 `absent`）。**F5** `Lifecycle` 改走 opts 字段注入，删 `Ledger#artifacts()` / `NextStepRouter#artifacts()` 两个「取回注入」的访问器，补两条 pin：记录型矩阵端到端（`base set` 与 `board --plan` 各记录到自己的 kind）与 `CarrierSeal` 的 `sealed: true` 夹具行（`sealed` 列真的被读）。**F6** 行集加 `entries()` 投影，`kind` 可直接断言，T5/T6 不必第二次拼 kind 列表。 | [human] 裁定 · Claude（kairos:cdd-dev · 2026-11-15） |
| v0.6 | 2026-11-15 | 计划评审 round 4 全量落地（F1–F7）：**F1（blocker）** `Ledger#orphanHandoffs` 的泛化写明**两级判据**——候选集换成目录全部文件，orphan ⇔ `attribute → null` 或「能归主但没有任何记录认领」（行键由 `identity.line` 派生、`carrierPathOf` 的 basename 照旧保留），T5 的 Objective / Files / Produces / Steps / Acceptance 同步，并把 `session/__tests__/ledger.test.ts` 加进 T5 的 `Test:` 行、点名 `tasks-6,8-implement-1.json`（`:1037`）· `tasks-1-fix-1-a2.json`（`:1048`）· `tasks-1-fix-1-a2.c1.json`（`:1076`）三条已交付 pin 为守恒守卫（照字面实现会把它们从板上抹掉，并逼实现者翻断言） · **F2** P35 Constraints 的派生条款同批修订落进 T4（Files / Objective / Produces / Step / Acceptance）：前半句改「plan 路径取索引 plan 行的 `rel`」、后半句与扫描谓词原样，并补该文件一行 Change history 与 `version:` 递增 · **F3** 门的**作用面**写进 T6（Objective / Files / Step / Acceptance）：只判本轮 `#artifactReadOf` 解析到的 kind（今日唯一 `rulings`），载体自身的 kind 不由这道门判，并补 pin「载体带显式 `-a1` 拼写不触发 `artifact-identity`」——否则它与 T9 的 F4 ① pin 在同一份输入上互斥 · **F4** T11 点名三行编号（`cdd-dev` = `I6` · `cdd-plan` = `I5` · `cdd-spec-writer` = `I4`）、「三者同句」与句子主体，并把同句断言挂进 `skill-surface-consistency.test.ts` 的文本门（与零 `.rulings.json` 字面同批） · **F5** 行号 pin 按漂移整体处置：全树唯一的符号（carrierPattern · `CARRIER` · isCarrierName · RETIRED_SPEC_KEY / RETIRED_SPEC_LINE_KEYS · `Ledger.rowFor` · #retiredSpecApplies · #retiredCarrierName · #legacyCarrierName · `#resolvedCarrierName` · #ownerRow · #lineWord · #handoffOwner · #WAVE_CARRIER · #LINE_CARRIER · `#scanRoots`）只留符号名、不钉行号，多处共现的站点刷新到今日实测值（`SlugIndex.build` 三处 → `:524` / `:1279` / `:1628` · `new PlanSource` 两处 → `:498` / `:723` · `Router#next` 的两个 fix 分支 → `:353` / `:374`）；`round-naming.test.ts:523` 改正为「`neighbours` 数组里的 `"base.json"`」，不再是「workspace 名清单」 · **F6** Change history 按版本序重排（v0.5 行移到 v0.4 之后）；母契约 Phase inventory P36 的 plan Done 指针（今日 `v0.4`）待下一次登记母契约时随本版改到 `v0.6`——登记是编排器动作，本轮不改总体 · **F7** T11 Acceptance 的 changeset 理由补上第四处（fix `next:` 行改为印已解析路径 · D70 裁决面 · D74）。 | [human] 裁定 · Claude（kairos:docs-fix · 2026-11-15） |
| v0.7 | 2026-11-15 | 计划评审 round 5 全量落地（F1–F7）：**F1（blocker）** T5 补 `sealed` 列接管后的**无矩阵臂**——`CarrierSeal#sweep` 的矩阵入参升为必填（生产唯一调用点已传同一实例），`attribute → null` ⇒ 不封，两文件的 `sweep(dir, [])` 调用改传夹具实例，T1 的「两形态判定一致」pin 由「无矩阵 ⇒ 零封印」**取代**（T1 Acceptance 同批加注，仓里不再并存两条互斥约束）；T5 Objective / Files / Produces / Steps / Acceptance 同步 · **F2** `orphanHandoffs` 二级判据的**域**写死：只有 round 域载体可成 orphan，`progress.json` / `base.json` / `in-flight.json` / `tasks-<n>-brief.md` 与四类文档名归主即非 orphan（按字面实现会让它们各成一行 `orphan:`，并打红 `ledger.test.ts` 三条精确数组断言与健康树 board 的零字节断言），T5 补一格域边界 pin · **F3** T4 的 P35 修订面扩到同一 bullet 的**第三句**（`-design.md` 反查 · 「只探存在性」改为问索引三态），Objective / Files / Produces / Step / Acceptance 同步，checkable 改为「该 bullet 内两处旧口径零命中」 · **F4** T11 的迁移段补可红断言：`presentation-surface.test.ts` 内两条（改名命令行 + 「改名后必须复判」各一），既有 pin 只断镜像家庭与标题序、整段缺失仍绿 · **F5** T9 写明无身份臂（`attribute → null` ⇒ 不下发 `rulings` 值位、`FIX_READBACK_SUFFIX` 整段省略、零空槽、零回落规则句）并补 `--reviews spec-review-1.json` 的 pin · **F6** T2 接管 `round-artifacts.test.ts` 的两格抛错守卫（「未登记 kind ⇒ 抛错」在三域登记齐后永久不可达，改由只登记部分 kind 的夹具域承担；「跨域身份 ⇒ 抛错」保留） · **F7** 母契约 Phase inventory 的 P36 plan 指针写进 T11 的 Files / Steps / Acceptance（从 `v0.4` 改到计划落地版，不再挂在 Change history 的「待下一次」）。 | [human] 裁定 · Claude（kairos:docs-fix · 2026-11-15） |
| v0.8 | 2026-11-15 | 计划评审 round 6 全量落地（F1–F10）：**F1（blocker）** T5 的无矩阵臂二选一写成**必填可空**（`artifacts: ArtifactRegistry \| null`）——`null` ⇒ 零封印、`attribute → null` ⇒ 不封；两文件的 `sweep(` 调用全补第三入参（`carrier-seal.test.ts` 的 8 处、`round-artifacts.test.ts` 的两处写显式 `null`），T1 Acceptance ② 与 T5 Objective / Files / Produces / Steps / Acceptance 同步，「两处无矩阵形态」与「无矩阵调用不再成立」两句话不再并存 · **F2** `misplaced` 的产出面改回 `ArtifactRegistry#read`（`attribute` 恒回 `Attributed \| null`、无第三态）；T2 Objective / Produces / Acceptance、T5 Objective / Files / Consumes / Produces / Step 1、T6 的 pin 五处同步 · **F3** T4 的派生零命中门改成可红的谓词门（扫描面去注释且排除 `__tests__`，断言 `ENGINE_RUNTIME.docRoots.*` 参与模板串或以 `path.join` 作基座零命中；原 grep 对 `infra/` 注释与 `-design` 夹具永远回不到零），`planOrphanSpec` 的报文断言移回 `plan-source.test.ts` 的既有格 · **F4** `discarded()` 六值的 pin 家落 `infra/__tests__/slug-index.test.ts`（加进 T4 Files 与一条 Step），补「只在 `overalls/` 放一个不可读候选 ⇒ 身份反查落 (c)」一格 · **F5** round 行的模块级渲染入口立名 `renderRound(identity, kind)`：`ArtifactRegistry#render` 与静态 `RoundNaming.renderName` 都逐字委托它（`renderName` 是静态方法、八处静态调用）；T1 `nameOf` 的消费方去掉 `RoundNaming`（它只服务 workspace 四行） · **F6** `carrier-seal.test.ts` 的调用点从「六处」改为符号级枚举（全部 8 个 `CarrierSeal.sweep(`，7 处 keep 为 `[]`、`:136` 非空） · **F7** T1 Objective 的 `BoardView.of` 改为树里实有的 `BoardView.render` · **F8** T3 的重复身份括注改为「派发硬停由既有 `SlugIndex#slugVerdict` 的 `duplicated` → `doc-contract` 承担」，不再要求 T6 把 doc 域读结果塞进只判 `rulings` 的门 · **F9** T11 的母契约指针陈述改为今日事实（`v0.7`，`4965dcbe` 已同步），checkable 改为「回出的正是本计划落地版的 `version:`」 · **F10** T7 的 `art:` 新增字节口径统一为一个事实块（头行 + `derived` + `found`，字节按 spec §2.6），Objective / Files / Step / Acceptance 四处同步。 | [human] 裁定 · Claude（kairos:docs-fix · 2026-11-15） |
| v0.9 | 2026-11-15 | 计划评审 round 7 全量落地（F1–F7）：**F1** T5 的 `misplaced` 判据从计数式改为**集合式**——`found` = `base` 里能归主到该 `(identity, kind)` 的全部名字，任一 ≠ 渲染名 ⇒ `misplaced`（`derived` = 渲染名、`found` 列全），恰为 {渲染名} ⇒ `ok`，全空 ⇒ `absent`；「≥2 个」只作最大子情形（spec §4.1 的多候选优先级句原样），迁现场（`<line>-<op>-<n>.rulings.json` 在、无 `.c<N>.rulings.json`）不再是无答案格；T5 Objective / Produces / Step 1 与 T6 Acceptance 同步 · **F2** Review Focus 把两个 legacy 载体的出口拆开写：`spec-review-1.json` ⇒ `attribute → null`（一级 orphan）；无 cycle 的 `tasks-1-implement.json` ⇒ `attribute` 仍归主（spec AC ① 往返 pin），`orphan:` 行由第二级「归主的是 round 域载体、而无记录认领」给出；T8 Step 4 括注同步（照原写法实现会让 `attribute` 回 `null`、直接打红 T2 的往返 pin）；spec §2.5 该格的收口记入编排器的 spec 补记清单 · **F3** T8 的五条 grep 门补上扫描面与匹配口径（去注释、排除 `__tests__` 的生产源码，按符号边界 `#lineWord\b`），Acceptance 同批加注——无边界锚点会永久命中 `face/board-view.ts` 那个无关的 `#lineWordOf` 与测试注释 · **F4** T9 的第四个重锚站点从 `packages/kairos/tests/status-routing-convergence.test.ts`（skill 文本门，零 fix 行）换成 `packages/cdd-engine/src-next/session/__tests__/next.test.ts`，点名 `:186` 的整句字节 pin 与 `:192` 的字面类型 pin 改为「模板 + 值位」形态；Files / Step / Acceptance 三处同步 · **F5** T3 的板面标记名改为树里实有的 `MARK_SLUG_DUPLICATED`（`slug: duplicated (BLOCKED)`，判定沿用 `duplicatedRolesOf`），不再指 `duplicate-identity`（那是 `SlugViolation.kind` 的字符串，板上无此符号） · **F6** T7 的 Consumes / Acceptance 写明 `art:` 的判定集合 = 门的那一个 kind 集（今日唯一 `rulings`），其余 kind 的名字差异仍只落 `orphan:`（否则 `draft` / `final` 的显式 `-a1` 拼写会同时占两个观测面） · **F7** T11 的迁移段去掉 `89`（他人消费仓的实测，留在 spec §1.1 / §3.4 的依据段），改为通用的一次性改名命令（`<line>-<op>-<n>.rulings.json` → 同目录存在终稿 `.c<N>.json` 者改名为 `.c<N>.rulings.json`）。 | [human] 裁定 · Claude（kairos:docs-fix · 2026-11-15） |
| v0.10 | 2026-11-15 | 波 2/3 修复轮全量落地（F1–F11）：**F1（blocker）** 板面两格与 `#programBoard` 的 phase plan 行不再取第一份——`#nodeSources` 改答集合（0 / 1 / n，`DocSlot`），>1 即渲 `MARK_SLUG_DUPLICATED` 加集合内全部 `rel`、不借任何一份的 version / status（单份格字节不变，成对 pin：两份时 `spec` 格零 `v0.1` / 零 `Draft`）；T3 Files / Acceptance 同批写成「读集合端口」而非字面 `read(...)`（`read` 是按声明 `docType` 单值的，身份类跨三型） · **F2** prompt 格与派发门回到**一个**判别值：`#rulingsInputOf` 复用严格 #rulingsVerdict，`artifacts` 形参升为必填（无矩阵不再退化成 `absent`；`HarnessDispatch` 的 44 处夹具补上矩阵） · **F3** `DocDomain#locate` / `read` 依 spec §2.2 回 `entry.rel`（docstring / 实现 / spec 不再三个答案；存活探针仍走 `entry.path`），`Cli#sceneOf` 的 `relativize` 幂等故零下游改动 · **F4** doc 四行取 `DOC_KEYS`（`contract/project.ts`），删掉第二个值域副本 · **F5** 一条命令只剩**一个** registry 实例：`ArtifactRegistry#bindDocIndex` 就地换 doc 域，注入矩阵同样绑定（此前 `#indexOf` 会 `new` 一个新实例，base 面与 scene / board 读两个矩阵；work 命令 + 注入矩阵的 doc 读此前会抛「holds no doc domain」） · **F6** `INPUT_RULINGS` 注释改成与实现同源（sidecar 路径由矩阵 `rulings` 行按被评审载体身份渲染） · **F7** `CarrierSeal` 删 RULINGS_SUFFIX：跳过判据改问矩阵 `attribute` 的 kind，`#isSealedName` 括注同步 · **F8** 矩阵模块头补第三个域（doc 四行、declared、身份来自 `slug:`、`read` 判 duplicate） · **F9** `CarrierRulings.read` 的 `carrier` 键同判（形参不空转） · **F10** 删 `face/cli.ts` 未用的 `type Identity` import · **F11** 不改内容：P38 登记属设计线相位登记，编排器记账时不记作 T2/T3 产物。 | [human] 裁定 · Claude（kairos:cdd-dev · 2026-11-15） |
| v0.11 | 2026-11-15 | 计划评审 round 8 全量落地（F1–F7）：**F1** Review Focus 的 legacy 机制改成**两段式**——#legacyCarrierName 梯级在时（`session/ledger.ts:1762-1785`）`carrierPathOf` 回 legacy 名 ⇒ 文件被认领 ⇒ 今日 `orphanHandoffs()` 是 `[]`；梯级拆除后回 `""` ⇒ 未认领 ⇒ 才成 `orphan:` 行；并点名三格已交付 pin `session/__tests__/ledger.test.ts:699` · `:984-991` · `:1054-1065`（「basename 派生故未认领」这个读法是错的），翻它们的是 T8——T8 Files / Step 4 / Acceptance 与 T5 Acceptance 同批写清，T5 显式不翻 · **F2** `Workspace#names(): readonly string[]` 立为目录名清单的唯一读口（`Ledger#workspaceFiles` 并入它，一次读取供 `read` 的 `found` 与 `orphanHandoffs` 的候选集），T1 Files / Produces / Acceptance 与 T5 Objective / Produces / Step 1 同步——`found` 不再逼实现者自建第二次目录扫描或第二张变体表（spec §2.3 的「不引入新扫描面」） · **F3** 第二级的域边界补全：只对 `draft` / `final` 两行成立，`rulings` / `report` / `log` / `crash` / `evidence` 与 workspace / doc 一样归主即非 orphan（`attribute` 对五者同样回得出 `(identity, kind)`，照字面读会把本 workspace 51 个与消费仓 89 个 `*.rulings.json` 灌成 `orphan:` 行），T5 Objective / Files / Produces / Step 3 / Acceptance 五处同批，域边界 pin 加五类各一条 · **F4** 波 1–3 落地后漂移的行号导航位按本轮实测刷新（`SlugIndex.build` 存活于 `cli.ts:494` + `contract/invariants.ts:332` + `session/preflight.ts:364`，指向它的 `#indexOf(...)` 调用点是 `cli.ts:549` / `:1304` / `:1687` · `new PlanSource` 是 `cli.ts:523` / `:748` · `round-naming.test.ts` 的 `"base.json"` 在 `neighbours` 首段、今日 `:531`，`:523` 已落在 `minted` 数组内），T1 Consumes / T3 Objective+Files / T4 Files+Step 8 六处同步 · **F5** T11 三处（Objective / Files / Acceptance）改按今日事实：母契约 P36 plan 指针是 `v0.9`（`ac93a456` 同步，design 侧 `v0.7` 仍准确）、本计划已 `v0.10`，「待下一次」这层假定已两次落空，本任务直接对齐落地版 · **F6** T9 Acceptance 补记 spec AC 第四主站点替换（`status-routing-convergence.test.ts` → `session/__tests__/next.test.ts`）入编排器的 spec 补记清单 · **F7** T7 的 `art:` 判读句按 spec §2.6 补齐：插在行区之后、`next:` / `reason:` 之前（后两者仍为最后两行），且 `art` 不新增列、不进尾计数格。 | [human] 裁定 · Claude（kairos:docs-fix · 2026-11-15） |
| v0.12 | 2026-11-15 | 波 2/3 修复轮 round 2 全量落地（F1–F3）：**F1** `#nodeSources` 的 `own` 两臂并入集合判定——`cdd board --spec` / `--plan` 命名的文档确实是 `entry`，但它的槽位仍是**该 slug 的同类集合**（spec 格走 `docsOf` 的身份类、plan 格走 plan 类），>1 即渲 `MARK_SLUG_DUPLICATED` + 全部 `rel`；`own` 只剩两种答不了集合的现场（无合法 slug、`doc-type:` 未声明），T3 Files / Test / Acceptance 三条同批写明，pin 补成三组把两条入口都点到（`--spec` 条目 + 第二份 spec、`--spec` 条目 + 第二份 plan） · **F2** 本约束的 spec 版本字面 `v0.7` → `v0.9`（spec 侧已由编排器回填 v0.8 并由 round 5 落到 v0.9，本笔只兑现「spec 版本一变，本约束的字面同笔改」）；T3 Files 的「等价于 doc 域 `read` 的 `duplicate-identity` 判定」改回 spec §4.4 的两臂说法（同型归 `read` 的 `invalid(found)`、跨型归集合口） · **F3** `IdentityDomain#locate` 的接口注释补返回形态：rendered 行回 `base.resolve(<渲染名>)`（绝对）、declared 行回索引条目的 `rel`，调用方不得跨域比较路径。 | [human] 裁定 · Claude（kairos:cdd-dev · 2026-11-15） |
| v0.13 | 2026-11-15 | 计划评审 round 9 全量落地（F1–F7）：**F1（blocker）** T4 补第四格（不属三态）：plan 行 ≥2 ⇒ plan 路径**不答 `undeclared`**——`locate` 对 0 份与 ≥2 份都回 `null`，照 `null` 走会把「两份」答成「没有 plan」（正是 spec §2.7 禁止的「读不出 / 未判态不得授权『没有』」），故 `n === 1` 才取 `rel`、`n ≥ 2` 落身份标记面（`MARK_SLUG_DUPLICATED` + 集合内全部 `rel`、`next:` 零 `kairos:cdd-plan`、派发由既有 `slugVerdict` 的 `duplicated` 挡下、本任务不新开拒绝面），Objective / Produces / Step / Acceptance 四处与三个 pin 家（`plan-source.test.ts` · `board-view.test.ts` · `cli.test.ts`）同步 · **F2** `Workspace#names()` 从未交付，改记为 T5 的交付物（Files 增 `infra/workspace.ts`、含 `Ledger#workspaceFiles` 并入，并补一条交付步与 `grep readdirSync` 门），T1 按交付事实改注（`entries()` / `nameOf` 已交付、`names()` 归 T5；构造器默认域表是 `[new RoundDomain(), new WorkspaceDomain()]`；「零第二处 `readdirSync`」收窄到 workspace 目录清单一面，点名 `carrier-seal.ts#entries` 与 `slug-index.ts#entryNames` 两处） · **F3** T5 的两级 orphan 判据记明为对 spec §2.5 单级定义（与 AC「归属」条）的**显式修订**（第二级只收 `draft` / `final`），并入编排器的 spec 补记清单，Objective / Produces / Acceptance 三处同步 · **F4** T11 的 changeset 理由把 spec §2.7 点名但缺席的第 ① 处补进「四处」的第四条（doc-contract 面两条变化同条记入：`<slug>-design.md` 声明另一个 slug ⇒ 落地后判 (b)；未入册 plan ⇒ 未判态），四处计数自洽 · **F5** T11 的当日事实改成 plan 指针 `v0.9` · design 指针 `v0.9`（两侧已同步）、本计划 `version:` 已更高，结论仍是「只推 plan 指针」 · **F6** T5 的 `sweep` 门从字面 `sweep(dir, [])` 改为按形参判（`grep -rnE "sweep\([^,]+, \[\]\)"`），点名 `:615` 的 `dir` 与 `:647` 的 `bare.dir` 两处 · **F7** 三处已漂移导航位刷新（`slug-index.ts:162-164`；`round-naming.test.ts` 的 `minted` / `neighbours` 数组 `:507-524` / `:529-541`、断言 `:526` / `:547`；RULINGS_SUFFIX 改为「已随波 3 删除、只留零命中验收」）。 | [human] 裁定 · Claude（kairos:docs-fix · 2026-11-15） |
| v0.14 | 2026-11-15 | 计划评审 round 10 全量落地（F1–F4）：**F1** Constraints 的 spec 版本字面 `v0.9` → `v0.11`，并点名 v0.10 / v0.11 的规范增量落点（§2.5 的两级判据与 AC「归属（两级）」的两档认领 pin ⇒ T5、§1.4 的已交付随注 ⇒ T1、§2.2 的无 cycle 例外 ⇒ T2） · **F2** T5 补「认领两档各一条正例 pin」：① 记录的 `(op, cycle, attempt)` 与名字解出的身份相等 ⇒ 该名字不上 `orphan:`；② `carrierPath` 档（记录带绝对路径、扫描给裸名、身份不等而 basename 相等）⇒ 同样不上——这一格必须用**带 `carrierPath`** 的记录，pathless legacy 夹具在 T8 之后本就落 orphan；Files / Steps / Acceptance 三处同步 · **F3** T1 的 workspace 消费面改成**已交付随注**：类名 `Artifacts` 更正为 `CliArtifacts`（`baseSet` / `baseGet` / `#readBase` 经 `#baseName()`）、`readProgress` / `writeProgress` 是**公开**成员且经 `#progressName()`、`#router` 已构造体内赋值；Files / Step / Acceptance 的同一枚举同步 · **F4** T11 的「今日」指针事实改为**与版本无关**的判据（plan Done 指针落后于本计划 front-matter 的 `version:` ⇒ 推到落地版，design 侧已同步不动），Objective / Files / Acceptance 三处不再复述当轮数字。 | [human] 裁定 · Claude（kairos:docs-fix · 2026-11-15） |
| v0.15 | 2026-11-15 | 波 4/5 修复轮（F1–F3）：**F1** 删 `session/round-naming.ts` 里 `renderPath` 上方那段描述已删除的 carrierPattern / `CARRIER` 的文档块（它与紧随其后的真文档块描述同一个方法，且断言「`tasks-1-review.json` 是无名」——与矩阵给该名归主的 `draft` 相反） · **F2** spec 升 v0.12：§1.3 与 AC「#485 面」的两处 `infra/__tests__/plan-source.test.ts` 纯行号 pin 改成格题（波 4/5 的 re-anchor 已使旧区间落到无关格），Constraints 的 spec 字面随版同笔移到 `v0.12` · **F3** `infra/__tests__/plan-source.test.ts` 的「derived plan file is absent」格题改为身份口径（索引无 plan 行 + plans 根干净 ⇒ `undeclared`），并删掉 `expect(fs.existsCalls)` 上方那句与同一断言相反的「One existence probe」注释。 | [human] 裁定 · Claude（kairos:cdd-dev · 2026-11-15） |
| v0.16 | 2026-11-15 | 计划评审 round 11 全量落地（F1–F4，其中 F1 按编排器裁定改**耐久形**）：**F1** `## Constraints` 的 spec 版本字面整条删除——只按路径 + slug 引用，并写明「本轮被消费那一刻的 `version:`」；bullet 只记「哪一节落在哪个任务」、不记版本坐标，故 spec 再升版也不必改这一行，本计划实际消费的那一版（spec v0.13；其前的 v0.12 为纯 pin 重锚、零规范变化）改记在本行；增量落点补两条：AC「`#485` 面」的 (c) 格 coverage pin ⇒ T4、§2.3 的两级合成（`#artifactReadOf` = 矩阵 `read` × `CarrierRulings#verdict`，`invalid.reason` 原样是 schema 原因、矩阵永不解析内容）⇒ T6 的 Objective / Produces · **F2** T4 Files 增 `contract/__tests__/judge.test.ts`，Step 6 的「实现前这两文件对应腿为红」改成可判的「今日该格不存在 ⇒ 先红后绿」并写明断言面（脏 `specs/` 或脏 `overalls/` ⇒ `#contract.validate` 零 `cross-doc-chain@slug` `Finding`，另加三根全干净的 `spec-absent` 对照），Acceptance 同批点名该 pin 的家 · **F3** 波 4/5 交付后的导航位按今日树刷新：#orphanOf → `#lookupOf`（`infra/plan-source.ts:582`）· 两个 `new PlanSource` 生产构造点 `cli.ts:550` / `:762` · P35 design 改记「已交付随注」（今日 `version: v0.37`，其 v0.37 行即该次修订）· `new PlanSource(` 全树三处按符号枚举（删掉「约 150 处」与「先红：今日构造只拿根」两句，夹具助手已传索引）· `carrier-seal.test.ts` 9 个 `sweep` 调用 / 8 处 `[]` / 非空 keep `:148` · `round-artifacts.test.ts` 的 `bare.dir` `:649` · `round-naming.test.ts` 只余 `minted`（`:510` 起、循环 `:531`；`"base.json"` 在 `:550`）· T10 的 `insideDocRoots` `:150` 与 `#scanRoot` 一处调用 `:191` · **F4** 已闭合块的枚举对齐：T3 的 `#indexOf` 调用点由三处改为四处（`cli.ts:546` / `:757` / `:1318` / `:1701`；`#runBoard` / `#runWork` / `#sceneOf` / `#runBase`）、`SlugIndex.build` 字面 `:500`、「单建一次」按 `repoRoot` memo 表述（`board` / work / scene / base 各一次）；T1 Consumes 的 `neighbours` 改按今日符号（`minted` / accepted-orphan 枚举）。 | [human] 裁定 · Claude（kairos:docs-fix · 2026-11-15） |
| v0.17 | 2026-11-15 | 波 6/8/10 修复轮（F1–F4）：**F1** 认领的身份档改读矩阵自己的 `roundIdentityKey`（`session/round-artifacts.ts` 导出；`cycle` 缺席 ≠ `cycle: 1`，只有 `attempt` 缺省折成 1，因渲染器从不铸 `-a1`），无 cycle 的 `tasks-<n>-implement*.json` 不再被 cycle-1 记录静默认领——`session/__tests__/ledger.test.ts` 三格按用例名改写为「旧 cycle-less 拼写不再是认领对象」，T8 Files（增 `round-artifacts.ts`）/ Test / Step 同批 · **F2** T6 的「一次读取」落成**值**：`#artifactCellOf` 每派发算一次，门与 prompt 格吃同一个 cell（`#artifactRefusalOf` / `#rulingsInputOf` 都只读这个值），不再各读一次 sidecar · **F3** 矩阵读 `ok` 而 schema 回 `absent`（读竞态）⇒ `invalid(path, "unreadable")`，不再读成缺席（`#artifactReadOf` 的 `case "absent"`），T6 补两条 pin（`verdict` 恰一次；竞态 ⇒ 零 spawn + `rulings sidecar — unreadable`） · **F4** T6 Files 补 `face/cli.ts`（`--dry-run` 问同一纯读门；注入式 dispatch 接缝不持 harness ⇒ 无预测）。 | [human] 裁定 · Claude（kairos:cdd-dev · 2026-11-15） |
| v0.18 | 2026-11-15 | 计划评审 round 12 全量落地（F1–F5）：**F1（blocker）** T4 的 (c) 链级 coverage pin 未随波 4/5 交付——`grep -rn docRootsClean packages/cdd-engine/src-next/contract/__tests__` 至今零命中，`planChain` 的未判态 `return` 只由 `infra/__tests__/slug-index.test.ts` 间接覆盖，而 T4 已闭合；`## Constraints` 的增量映射、T4 的 `Test:` 行 / Step 6 / Acceptance 四处改按**交付事实**记录（缺口由分支评审 / 后续 issue 承接，并入编排器的 spec 补记清单），不再宣称「(c) pin 住 `judge.test.ts`」 · **F2** 两处「对 spec 的显式修订」已被 spec 回填——spec v0.9 回填了 §2.2 的 `base` 参数、v0.10 回填了 §2.5 的两级判据与 AC「归属（两级）」，故 T1 Objective 与 T5 Objective / Produces / Acceptance 四处改述为「已回填、本任务只做对账」，删掉 T5 的「记入编排器的 spec 补记清单」一句与 Acceptance 的同批括注（§2.7 对 P35、§2.10 对 P31 两处仍与 spec 字面不同，不在本条内） · **F3** `## Review Focus` 的 legacy 段改成交付后语态 + 符号级定位：`Ledger#claimed` 的两档（身份档读 `roundIdentityKey`、路径档读 `carrierPathOf` 的 basename），#legacyCarrierName 梯级已随 T8（波 6/8/10）拆除，三处行号按**用例名**重列（`ledger.test.ts` 已两轮因行号漂移被判），并写明「claims a doc-line carrier … the basename tier」是正例 pin 而非待翻的反例；T5 Acceptance 里同一句陈旧断言（三格「今日回 `[]`」）同批对齐 · **F4** 波 6/8/10 之后漂移的导航位刷新：`#indexOf(...)` 四处 → `cli.ts:546` / `:757` / `:1333` / `:1716`（T3 Objective + Files 两处），夹具助手改记 `packages/cdd-engine/src-next/__tests__/support/plan-source.ts:19`、`planSourceOf(` 计数 164 → 165（T4 Step 8） · **F5** `## Review Focus` 的「同一 slug 两份身份文档」不再把归口挂在 T6 上——改为 T3 的读取面（doc 域 `read` 的 `invalid(found)`）+ 既有 `SlugIndex#slugVerdict` 的 `duplicated`。 | [human] 裁定 · Claude（kairos:docs-fix · 2026-11-15） |
| v0.19 | 2026-11-15 | 计划评审 round 13 全量落地（F1–F4）：**F1（warn）** T7 的两样缺失同批补上——`art:` 的**读数来源**与**名字集**。合成读从持帧的 `Lifecycle` 里提出一个**无帧接缝**（`Create: session/artifact-reads.ts` 的 `ArtifactReads`：构造收 `(artifacts, base: Workspace)`、唯一方法 `read(kind, carrier, digest)`，`ArtifactReadOf` 值类型随之迁入），`Lifecycle` 与 `BoardView` 是两个消费者、板面零第二次合成；载体 id 集走 `CarrierIntegrity.read(path, digest ?? null)`（无摘要 = 既有事实读，不是第二档判定）；板面读哪一轮由记录序列定（`Ledger.readProgress()` 的 `RoundRecord` 的 `op` / `cycle` / `attempt` + `carrierPathOf` 载体路径 + `carrierDigest`，只取 `op === "review"`），`--artifacts` 的「一轮一行」= 这条序列而非目录名字集；T7 的 Objective / Files / Consumes / Produces / Steps / Acceptance 六处同步，并补两条 pin（同一 carrier 上板面 `derived` / `found` 与门报文逐字节相等 · 两轮记录渲两行、无记录认领的名字仍只落 `orphan:`） · **F2** T5 的三条已交付 orphan pin 删掉漂移的行号（`:1037` / `:1048` / `:1076` 今日落在无关格），按载荷对象名定位（`writeJson(<名>, …)` + `orphanHandoffs()` 的精确数组断言成对）——与 v0.9 F4 立的「全树唯一符号只留符号名」同口径 · **F3** T8 的 Test 与 Step 4 点名的「keeps a round-less family's round at 1」在树上已零命中（T8 交付时已按 v0.17 F1 改写），改为交付后现存的两格名（`orphanHandoffs lists a cycle-less implement carrier — a cycle-1 record never claims it` · `the cycle-less implement spelling is no longer a read rung — the ladder answers the canonical name`），并注明旧名零命中、本轮不改写已闭合块 · **F4** T6 的 Objective / Files / Produces 三处按**交付形**改述：`#artifactCellOf`（每派发一次的**唯一**读取）· `#artifactReadOf(frame, kind)`（按 kind 的一层）· `#artifactRefusalOf(cell)`（私有）· `artifactRefusal(frame)`（唯一对外纯读门），删掉「`#artifactReadOf` 是唯一读取」这句——它会让人按-kind 的那层去核「接缝是否已有」，正是 F1 那条 warn 最易被误判为已修的入口。 | [human] 裁定 · Claude（kairos:docs-fix · 2026-11-15） |
| v0.20 | 2026-11-15 | 波 7/9 修复轮（F1–F5）：**F1** program board 与 node board 同一投影——`#programBoard` 把 overall 行绑到它已持有的 program seat 落一个 `art:` scope，`showArtifacts` 贯穿 `BoardView.render` 两臂，`cdd board --spec <overall> --artifacts` 不再是空转（T7 Files / Acceptance 同批）· **F2** `lifecycle.ts` 的死私有 `#carrierPathOf` 删除（接缝抽取后零调用者、noUnusedLocals 关着无人抓），并在 `#carrierRefusal` 写明两处「repo-relative → abs」是**按设计**的两种读（载体自身的摘要读 vs 侧车的 schema / id 集读），不是同一事实的两个名字 · **F3** 被评审轮身份收成一处：`ArtifactRegistry#reviewedIdentityOf(name)`（`attribute(basename(name))` + `op` 恒 `review`）成为 `session/artifact-reads.ts` 与 `session/next.ts` 的共同入口，门增第三条真树断言（`op: "review"` 的身份构造在两处生产源码内只允许一处；`op: "review" \| "fix"` 的类型标注是另一件事实，门排除它）——T9 Files / Produces / Acceptance 同批 · **F4** `art:` 事实行的三个 key 收成板面自己的一份常量并写明与 `Words#artifactIdentity` 的**刻意独立**（§2.6 的 `derived  ` 与 §2.4 的 `derived:  ` 是两个字节契约），标签由板面断言钉住 · **F5** 字面门的谓词写明接受 raw 与已剥注释两种样本（加载期剥一次、判定期再剥是幂等 no-op）。 | [human] 裁定 · Pi（kairos:cdd-dev · fix · 2026-11-15） |
| v0.21 | 2026-11-15 | 计划评审 round 14 全量落地（F1–F3）：**F1（warn）** T11 的 changeset 验收项补上拥有者——Files 增 `.changeset/skill-ruling-landing.md`（`"@oscaner-skills/kairos": minor`，理由 = 三条落点指令进既有 `## Invariants`），Steps 增一步「落 changeset」并**写定 `cdd-engine` 侧口径、不留给实现者临场判断**：复用今日四份既有 minor 的合并读、零新写条目，四处消费可见变化逐项有主（artifact-identity-gate = `artifact-identity` 硬停门 · artifact-board-projection = `INPUT_RULINGS` 零正文 + fix 印 `RESOLVED sidecar path` · plan-identity-read = doc-contract 面两条），Acceptance 同批改写并加 `changeset-levels.test.ts` 绿判据 · **F2** T6 的四个行号锚点删除（`artifactRefusal` / `#artifactCellOf` / `#artifactReadOf` / `#artifactRefusalOf` 只留符号名，与 v0.9 F4 的「全树唯一符号不钉行号」同口径），并补一句「自 T7 起两级在 `session/artifact-reads.ts` 的 `ArtifactReads#read`（`#compose`）合成、`#artifactReadOf` 只做委托」——Objective / Files 两处同步 · **F3** 三处导航位按符号重写：T3 的四个 `#indexOf(...)` 调用点改按 `#runBoard` / `#runWork` / `#sceneOf` / `#runBase` 枚举（Objective / Files 两处）、T4 的第二个 `new PlanSource(` 生产点刷新到 `cli.ts:763`（Files / Step 8 两处）、T9 的「两个 fix 分支」改为两个调用点（均委托 `#fixRoute`，Files / Consumes 两处）并把 `session/__tests__/next.test.ts` 的两格改按**用例名**定位（整句 pin · 字面类型 pin，Test / Step / Acceptance 三处）。 | [human] 裁定 · Pi（kairos:docs-fix · 2026-11-15） |
| v0.22 | 2026-11-15 | 分支评审第 1 轮修复（F1–F4）：**F1（blocker）** AC「`#485` 面」的 (c) 格链级 coverage pin 补交付——`contract/__tests__/judge.test.ts` 新增三格（干净对照恰一条 `cross-doc-chain@slug` 且报文逐字 · 脏 `specs/` 不可读候选 ⇒ 零条 · 脏 `overalls/` 未入册候选 ⇒ 零条），双向可红可修已验；本计划的 Constraints 增量映射、T4 `Test:` 行 / Step 6 / Acceptance 四处随之从「未交付、由后续承接」改记为已交付 · **F2** 三处描述退役口径的文档块改述为现行规则（`session/carrier-rulings.ts` 头注的路径来源与条目标识符、`face/lifecycle.ts#verdictOf` 的两个供应格、`render/templates.ts` 的 `INPUT_RULINGS`）· **F3** `session/round-artifacts.ts` 的 `readRendered` 收参数对象，域内 key 由 `keyOf({identity, kind})` 派生、`"\u0000foreign"` 兜底收成一处 · **F4** `session/ledger.ts` 与 `session/next.ts` 的矩阵注入面补写「与 `CliLifecycle#artifacts` 必填口径为何不同」。 | [human] 裁定 · Claude（kairos:cdd-dev · 2026-11-15） |
| v0.23 | 2026-11-16 | 计划评审 round 15 全量落地（F1–F4）：**F1** 已闭合的 T11 按交付事实改写五处陈述（任务面与 `DependsOn` 不动，只对齐 pin）——三份 `SKILL.md` 的 `## Invariants` 表尾是 `I6` / `I5` / `I4`（`cdd-dev:62` · `cdd-plan:83` · `cdd-spec-writer:77`），同句门是 `skill-surface-consistency.test.ts:174`、零字面门是 `:194`，迁移段两条结构断言是 `presentation-surface.test.ts:421`（改名命令）与 `:436`（复判句），两个 README 的迁移段今日已各带非覆盖式 `mv -n` 脚本（`README.md` · `README.zh-CN.md:98`），`.changeset/skill-ruling-landing.md` 已在盘上 · **F2** T11 的 changeset 映射补齐第四条——`.changeset/artifact-matrix-round-doc.md`（round / doc 两域登记、`CarrierRulings.pathFor` 退役、`identityDoc` / `planOf` 退役为 `docsOf` + `hasIdentity`、doc 域 `read` 判 `invalid(found)`），并把门的口径改成 `changeset-levels.test.ts` 真正断言的两条（全表零 `major` + 每条至少声明一档，发布级别取最高一档），artifact-matrix-workspace 的 `patch` 不计入四份 `minor` · **F3** T3 Acceptance 的退役谓词按符号与扫描面写定——`identityDoc` 全树零命中、`planOf` 只余 `face/route-render.ts` 的 `RouteRenderer#planOf`（同名异物，自 P8 起就在），扫描面 = 去注释生产源码且排除 `__tests__` · **F4** T4 Step 8 删掉会漂的计数，只留符号与夹具助手路径 `packages/cdd-engine/src-next/__tests__/support/plan-source.ts:19`（与 §3.1 / T8 的「计数一律改符号枚举」同口径）。 | [human] 裁定 · Pi（kairos:docs-fix · 2026-11-16） |
| v0.24 | 2026-11-15 | 分支评审第 3 轮修复（F2 · nit）：T8 的 `## Files` 补上唯一被签名收敛波及、却不在任何 Files 行的生产文件 `session/dispatch-authority.ts`——`docDriftHashes(target.type, doc, target.type)` 与两处 `roundCount(…, line.type)` 的第三参在 `Ledger#rowFor` 收成两参后成死参，两处调用点同批去掉；`Produces` 补一句 `Ledger#completedCycles` / `roundCount` / `docDriftHashes` / `#docRevisionPair` / `rowFor` 的 `identity` 形参一并退役。代码侧不动（已交付、行为零变化）；本轮消费的 spec 面未变（v0.13 · 零规范增量），只补计划面的 Files / Produces 缺口。 | [human] 裁定 · Claude（kairos:cdd-fix · 2026-11-15） |
| v0.25 | 2026-11-16 | 计划评审 round 16 全量落地（F1–F3，均为 nit，只对齐已闭合任务的陈述与导航）：**F1** 三处把退役面写成现状的句子改成**交付形态**——T1 `Workspace#names()` 记「随 T5 落地（`infra/workspace.ts:125`）、`Ledger#workspaceFiles` 与其 `readdirSync` 一并消失（`session/ledger.ts` 今日零命中）」（T1 Acceptance 的同句同批改），T2 Consumes 的 RULING_KEYS 换成今日接受集单源 `ArtifactRegistry.identifierOf("rulings")`（另留 `TOP_KEYS` / `#carrierRefusal` 两处），T5 的两条收紧断言记「T9 已把两处第二声明一并拆除、今日 `.rulings.json` 字面只余矩阵模块、接受集只读 `identifierOf`」，只留零命中验收 · **F2** T4 与 T11 的当轮版本字面按**判据**改写（T4 Files / Acceptance：P35 spec 的修订面是 Constraints 半句 + §2.7 正文，核零回退不写 `v0.37`；T11 Files：plan Done 指针只写判据（指针必须等于本计划 `version:`，升版即落后）、不写当轮数字）· **F3** T8 Files 的「同批调用点」删掉 `session/pipeline.ts`——它的 `roundCount(key, mode)` 早就是两参、生产代码未被签名收敛波及，且全计划无任何 Files 行拥有该文件；测试侧丢参数的三个夹具显式点名，随各自 `Test:` 行走、不另立 Files 行。任务面与 `DependsOn` 不动，代码侧不动。 | [human] 裁定 · Pi（kairos:docs-fix · 2026-11-16） |
| v0.26 | 2026-11-16 | 分支评审第 4 轮修复（F1 的裁定形态）：母契约把「格里即当前版本」这条约定整体反转——Phase inventory 的两格改记 `✔ Done（<文件名> · <日期>）`、不带版本字面，登记表只记身份与闭合，版本由文档自己的 front-matter 承担（同一处指针落后在本相位四次 blocker 的成因即镜像本身，没有唯一来源可判）。T11 的四处（Objective / Files / Step / Acceptance）按新口径改写：判据从「指针等于本文件 `version:`」变成「该格是文件名 + 日期且零版本字面」，本计划升版因此不再产生待回填的指针。任务面与 `DependsOn` 不动，代码侧不动。 | [human] 裁定 · Claude（kairos:cdd-fix · 2026-11-16） |
| v0.27 | 2026-11-16 | 计划评审 round 17 全量落地（F1–F2，均为 nit，只对齐已闭合任务的导航与陈述）：**F1** T4 的第二处生产 `PlanSource` 构造点不再钉行号——上一轮的修复把七行插进 `#runWork` 的前导，`cli.ts:763` 因此在同一次提交里漂到 `:770`（该导航位已两度刷新后仍然过期），Files 与 Step 8 两处改按方法名定位（`Cli#runBoard` 内一处、`#runWork` 的命令前导一处），并写明命令前导是随前置步骤增长的那一段；`new PlanSource(` 的三处符号枚举（两处生产面 + 夹具助手 `packages/cdd-engine/src-next/__tests__/support/plan-source.ts:19`）原样保留 · **F2** T6 的 `unreadable` 一格从句首的「今日必红」改述为**交付形**——矩阵读面在 `session/__tests__/carrier-rulings.test.ts:383`（渲染名打不开 ⇒ `invalid("unreadable")`），门面在 `face/__tests__/lifecycle.test.ts:1406`（stderr 带 `rulings sidecar — unreadable`、零 spawn），并删掉「全仓零覆盖 / 无效表只覆盖内容非法」半句（两处 pin 落地后它永不可能再回绿）。任务面与 `DependsOn` 不动，代码侧不动。 | [human] 裁定 · Pi（kairos:docs-fix · 2026-11-16） |
| v0.28 | 2026-11-16 | 分支评审第 5 轮修复（F5）：T11 的 Objective 与 Step 不再把登记基准写成「本计划落地版」，改述为身份判据（该格是文件名 + 日期、零版本字面）——「落地版」是版本坐标式基准，正是上一轮整体反转掉的那层假定，留着它就让目标句与被改述的 checkable 反向读。母契约侧同轮补齐 P25 两格并把这条约定装进结构门，见母契约 Change history。 | [human] 裁定 · Claude（kairos:cdd-fix · 2026-11-16） |
| v0.29 | 2026-11-16 | 计划评审 round 18 全量落地（F1–F2，均为 nit，只对齐已闭合任务的陈述）：**F1** T1 三处把私有 `#brief` 写成委托对的一半，而 `session/round-naming.ts` 里没有这个成员（树内 `#brief` 只落在无关的 `BriefRenderer` 字段上）——交付形态是公开 `brief(tasks)`（`#workspace.resolve(this.briefName(tasks))`）与 `#briefName(tasks)`（`ArtifactRegistry.nameOf("brief", tasks)`），故 Objective / Produces / Step 6 三处改记 `RoundNaming#brief` / `#briefName`，`CliGate#renderBrief` · `Preview#readsOf` 仍为两个消费者，任务边界与 `DependsOn` 不动 · **F2** T2 的 Files 行不再把已退役、全树零命中的 #rulingsVerdict 写成现状：prompt 格与门读同一个 `ArtifactCell`（`#artifactCellOf` 每派发一次），按-kind 的那层是 `#artifactReadOf` → `ArtifactReads.read`，严格 schema 一半是 `CarrierRulings.verdict` 由 `ArtifactReads#compose` 调一次（生产唯一调用点），#rulingsRefusal 只作为 T6 取代的旧成员出现。 | [human] 裁定 · Claude（kairos:docs-fix · 2026-11-16） |
