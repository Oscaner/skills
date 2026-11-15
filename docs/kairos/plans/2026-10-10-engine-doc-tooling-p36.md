---
title: '引擎文档工具（Engine Doc-Tooling）— P36 计划：身份面收权（身份域 × 产物矩阵 · 缺席有门 · 形状可发现）'
doc-type: plan
version: v0.5
date: 2026-11-15
slug: 2026-10-10-engine-doc-tooling-p36
base: develop
---

## Constraints

- **逐字取 spec**：本计划只实现 `docs/kairos/specs/2026-10-10-engine-doc-tooling-p36-design.md` **现行 version v0.7** 所指的面；spec 版本一变，本约束的字面同笔改。
- **守恒边界**：既有六 kind（`draft` · `final` · `report` · `log` · `crash` · `evidence`）+ 三个工作区字面量（`progress.json` / `base.json` / `in-flight.json`）+ `tasks-{tasks}-brief.md` 的**名字逐字节不变**；P31/P34 已交付 pin 只许新增不许翻。历史拼写的可读性**不在**守恒面（spec §3.3）。
- **`rulings` 身份只有一个源**：坐标 = `attribute(path.basename(the --reviews 载体))` 回出的那个 round 身份——**被评审的那一轮**，`op` 恒为 `review`，`cycle` / `attempt` 取载体自己的坐标。prompt 格、门的 `derived:` / `identity:`、`next:` 的读回值都从这一个身份渲染；**不得**用本轮（fix 轮）的 `(line, op)` 算，那会铸出 `plan-fix-1.c1.rulings.json`——一个没有门看得见、child 却会照着写的第二个表达式（spec §2.1 / §2.4 / §2.10）。
- **引擎只拒不改**：任何产物（载体、sidecar、文档）不得被移动、改写或删除；修复动作归编排器。
- **视图面零判定权**：board / capsule / preview 只渲染矩阵判定结果，不得重新推导名字。
- **零裸函数**：`packages/cdd-engine/src-next` 与 `packages/kairos/tests` 内不写行首 `function `；类或 `const` 箭头。静态面确有必要时带一行 `// biome-ignore lint/complexity/noStaticOnlyClass:` 理由。
- **一次读取**：任何读面（prompt 格、门、板面）读同一个判别值，不各读一次。
- **消费面纯度**：skill 文本零程序史 / 零相位号 / 零引擎内部实现词。

## Review Focus

- **同一 slug 两份身份文档**：读面若仍取第一份，board 与 doc 轮会渲出「这个 slug 没有身份文档」而盘上明明有两份。期望：`read` 回 `invalid(found:[a,b])` 并硬停，`attribute` 仍回身份（歧义在身份侧、不在名字侧）— 由 T3 Step 1 / T3 Acceptance / T6 钉。
- **扫描根不干净但另一根干净**：一个脏 `specs/` 根加一个干净的 `plans/` 根，若两个判断读同一对合计计数，干净 miss 会被误判成未判态（`(none)` + `CDD_WARN:` 换掉 `undeclared` + `kairos:cdd-plan`）。期望：plan 路径的「干净」只读 plans 根那对计数 — 由 T4 Step 2 的混合格与 T4 Acceptance 钉。
- **无 cycle 身份**：`rulings` 与 `final` 同 stem、渲染名不含 `.c<cycle>` 段，`-a1` 从不铸出。期望：每个 rendered kind 的往返 pin 跑两遍（带坐标 / 不带坐标）；该形态下 `draft` 与 `final` 本就同名，故**只断身份**、`kind` 归一 `draft`，`misplaced` 只剩显式 `-a1` 一格 — 由 T2 Step 4 钉。
- **P34 前 legacy 载体仍在盘上**：`spec-review-1.json`、无 cycle 的 `tasks-1-implement.json` 在拆掉读法后必须**不被拦**。期望：`attribute → null` ⇒ orphan 观察面、派发零拒绝 — 由 T8 的 `session/__tests__/handoff-plane.guard.test.ts` pin（exit 0 · 零 `CDD_BLOCKED` · 两文件各落一行 `orphan:`）与 T8 Acceptance 钉。
- **半迁移 workspace（渲染名与变体并存）**：迁移做一半正是「渲染名合法 + 同身份另一个能归主的名字」的现场。期望：多候选优先于 `ok`，报文列全、不选、不写 — 由 T5 Step 1 与 T6 Step 4 钉。

---

### Task 1: 矩阵骨架与 `WorkspaceDomain`

#### Objective

把「名字从哪来」立成一张封闭登记表：`session/round-artifacts.ts` 落 `Kind` / `Identity` / `Attributed` / `ArtifactRead` / `IdentifierVocabulary` / `ArtifactRow` 六个值类型、`IdentityDomain` 契约与 `ArtifactRegistry` 深类（`entries()` · `rows()` · `rowOf(kind)` · `render(identity, kind)` · `attribute(name)` · `locate(identity, kind, base)` · `read(identity, kind, base)`），首批只登记 workspace 四行（`progress` · `base` · `in-flight` · `brief`），并给出往返 pin 的骨架。`brief` 的生产拼写同期改经矩阵（`briefName` / `#brief` 只做委托，两个调用点随改）——否则矩阵行与 `briefName` 就是同一个名字的两个家，而没有任何门会红。矩阵的**唯一构造点与注入面**也由本任务钉住：命令前导一次构造，向下注入**五个**读面——`Lifecycle`（opts 字段）· `Ledger`（构造器第 4 参）· `CarrierSeal#sweep` 与 `BoardView.of`（显式入参）· `NextStepRouter`（构造器注入；`Ledger#router` 与 `Run#router` 的构造点因此改为构造体内赋值——字段初始化先于构造体执行，registry 又是构造器入参，而 `erasableSyntaxOnly` 禁参数属性，T9 的算值入口挂在这条注入上）。矩阵**不绑 workspace**：`locate` / `read` 的 `base` 是读取时的坐标——一块板一次渲多个节点 workspace，绑死一处就会把别的节点的名字解析到这一处（「名字看着合法、坐标是别人的」，本相位要消的正是这一类）；这是对 spec §2.2 契约形状的**显式修订**（签名多一个 `base: Workspace`，语义不变），同笔记入 Produces 与 Acceptance。本任务**不迁移** round / doc 两域（它们是 T2 / T3），但 `Identity` 的判别联合一次写全，`ArtifactRow` 的字段面按 spec §2.1 定形（`identifier?` / `policy?` 在，**无** `attribution` 字段——归主文法不进类型，见 T5）。

#### Files

- Create: `packages/cdd-engine/src-next/session/round-artifacts.ts`（值类型 + `IdentityDomain` + `ArtifactRegistry` + `WorkspaceDomain` 实现；`RoundDomain` / `DocDomain` 由 T2 / T3 登记进同表的同一处）
- Create: `packages/cdd-engine/src-next/session/__tests__/round-artifacts.test.ts`
- Modify: `packages/cdd-engine/src-next/session/inflight.ts`（`InFlight.FILE` 的字面移入矩阵，读点经 registry 取；不改值）
- Modify: `packages/cdd-engine/src-next/face/artifacts.ts`（`Artifacts#baseSet` / `#readBase` / `#baseGet` 的 `base.json` 字面改经 registry；字节不变）
- Modify: `packages/cdd-engine/src-next/face/cli.ts`（`Cli#baseBranchOf` 的 `base.json` 字面改经 registry；命令前导（`#runBoard` / `#runWork`）一次构造 registry 并向下注入五个读面；字节不变）
- Modify: `packages/cdd-engine/src-next/session/round-naming.ts`（`briefName` 只做矩阵渲染的委托；`brief` 走同一渲染）
- Modify: `packages/cdd-engine/src-next/face/gate.ts`（`CliGate#renderBrief` 的 brief 名取同一渲染——委托后的同一个值，零第二模板）
- Modify: `packages/cdd-engine/src-next/face/preview.ts`（`#readsOf` 的 `would re-render` 面读同一渲染）
- Modify: `packages/cdd-engine/src-next/session/ledger.ts`（`Ledger#readProgress` / `#writeProgress` 的 `progress.json` 字面改经 registry；`readonly #router = new NextStepRouter()` 的字段初始化改为构造体内赋值，registry 走构造器第 4 参；字节不变）
- Modify: `packages/cdd-engine/src-next/session/next.ts`（`NextStepRouter` 增构造器接注入 registry——只改构造与字段持有，决策表与 `Route` 的判别联合不动；算值在 T9）
- Modify: `packages/cdd-engine/src-next/session/run.ts`（`#router` 的 `opts.router ?? new NextStepRouter(...)` 与命令前导传同一实例）

#### Consumes

- `session/round-naming.ts` 的 `ArtifactKind` / `RoundArtifact` / `renderName` 既有形状（T2 复用，本任务不依赖其内部）
- `infra/runtime.ts` 的 `ENGINE_RUNTIME`（`brief` 的作者与读面）
- 既有 pin：`face/__tests__/cli.test.ts` 的 `base` 用例（`base.json` 字面）、`session/__tests__/ledger.test.ts` 的 progress 读写、`session/__tests__/round-naming.test.ts:523` 的 workspace 名清单

#### Produces

- `type Kind`（联合：`draft · final · report · log · crash · evidence · rulings · progress · base · in-flight · brief`）
- `type Identity = {domain:"round"; line; op; cycle; attempt} | {domain:"doc"; slug; docType} | {domain:"workspace"; tasks: string | null}`
- `type ArtifactRead = {kind:"absent"} | {kind:"ok"; path} | {kind:"invalid"; path; found?: readonly string[]; reason} | {kind:"misplaced"; derived; found: readonly string[]; identity}`
- `type Attributed = {identity; kind}`
- `type IdentifierVocabulary = {canonical: string; accepts: readonly string[]}`
- `type ArtifactRow`（spec §2.1 逐字形状）：`domain` / `author` / `sealed` / `identifier?` / `policy?` + `{identityFrom:"rendered"; render; misplaced:"block"}` | `{identityFrom:"declared"}`；**零 `attribution` 字段**、零 `absence` 列
- `type MatrixEntry = { kind: Kind; row: ArtifactRow }`（行集带键的投影：`kind` ↔ `row` 的绑定与行同住，读面走封闭集时不必再拼一次 kind 列表）
- `interface IdentityDomain`：`kinds()` · `entries(): readonly MatrixEntry[]` · `attribute(name): Attributed | null`（无第三态）· `locate(identity, kind, base: Workspace): string | null` · `read(identity, kind, base: Workspace): ArtifactRead`
- `class ArtifactRegistry`：矩阵的七个对外方法（`entries` · `rows` · `rowOf` · `render` · `attribute` · `locate` · `read`），按 `Identity.domain` 分派到三个 `IdentityDomain`；构造器收域表（默认 `[new WorkspaceDomain()]`，测试可注入夹具域以看见 `sealed: true` 那一臂），**不绑 workspace**
- `ArtifactRegistry` 的唯一构造点与注入面：命令前导一次 `new ArtifactRegistry()`——就是 `Cli` 构造器里的那一行（`CliOptions.artifacts` 让测试注入一个记录型实例，见 Acceptance），`CliArtifacts` 与 `#sceneOf` / `#runBoard` 都读同一个字段；`Lifecycle`（opts 字段）· `Ledger`（构造器第 4 参）· `NextStepRouter`（构造器）按构造器注入，静态面 `CarrierSeal#sweep` 与 `BoardView.render` 按显式入参接同一实例；`NextStepRouter` 的生产构造点（`face/cli.ts` 的 `#sceneOf` · `session/ledger.ts` 的构造体 · `session/run.ts` 的构造体）传同一实例，`Ledger` 那处从字段初始化改为构造体内赋值——**零模块级默认实例、矩阵外零构造点、无「取回注入」的公开访问器**（`Ledger#artifacts()` / `NextStepRouter#artifacts()` 不设：只为取回注入而存在的读口让「注入掉了」在类型与测试两侧都不红）
- `brief` 的唯一渲染：`render({domain:"workspace", tasks}, "brief")`；`RoundNaming#briefName` / `#brief` 与 `CliGate#renderBrief` / `Preview#readsOf` 都是它的委托
- `ArtifactRegistry.nameOf(kind, tasks)`：同一行渲染的**模块级入口**（无实例的读面——`InFlight.FILE` 这类静态常量、`RoundNaming`——用它），逐字委托行渲染 `renderWorkspace`，不是第二拼写；pin 断言它逐 kind 等于 `render({domain:"workspace", tasks}, kind)`

#### Steps

- 写失败测：`round-artifacts.test.ts` 断言 `rows()` 含四行 workspace kind、每行的 `author` / `sealed` / `identityFrom` 三格非空 —— checkable: 该文件跑红，报 `ArtifactRegistry` 未导出
- 实现六个值类型 + `MatrixEntry` + `IdentityDomain` + `ArtifactRegistry` 壳 + workspace 四行 —— checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/session/__tests__/round-artifacts.test.ts` 绿
- 写往返 pin：四行的 `attribute(render({domain:"workspace"}, kind))` 回到同一 `kind`，且 `render` 出的名字与今日字面逐字节相等（`progress.json` / `base.json` / `in-flight.json` / `tasks-{tasks}-brief.md`） —— checkable: 该断言绿
- 写坐标守卫 pin：`brief` 的 `tasks` 为 `null` / 空串、三个字面量的 `tasks` 非 `null` ⇒ `render` 与 `nameOf` 两条入口都抛错（`it("refuses an identity the row does not carry")`），`nameOf` 不设默认值 —— checkable: 该断言绿
- 写读取面 pin：`locate` / `read` 收 `base`，同一身份在两个 workspace 上解析到各自目录（两个账本共用一个矩阵各读各的 `progress.json`）；存在但读不出的名字回 `invalid(path, "unreadable")`、存在但不是普通文件回另一条 `invalid`，外来域 / 未登记 kind 抛错 —— checkable: 该断言绿
- 把 workspace 字面与 brief 模板逐符号改经 registry：`InFlight.FILE` · `Artifacts#baseSet` / `#readBase` / `#baseGet` · `Cli#baseBranchOf` · `Ledger#readProgress` / `#writeProgress` · `RoundNaming#briefName` / `#brief` · `CliGate#renderBrief` · `Preview#readsOf` —— checkable: 先在 `round-artifacts.test.ts` 写结构断言「`"base.json"` / `"progress.json"` / `"in-flight.json"` / `tasks-{tasks}-brief.md` 在 `src-next` 内只出现在 `session/round-artifacts.ts` 与夹具」（实现前红），再跑 `pnpm -C packages/cdd-engine exec vitest run src-next/session/__tests__/ledger.test.ts src-next/face/__tests__/cli.test.ts src-next/infra/__tests__/carrier-seal.test.ts src-next/session/__tests__/round-naming.test.ts` 绿且零字节差
- 接线：命令前导一次构造 registry 并向下注入五个读面（`Lifecycle` opts 字段 · `Ledger` 构造器第 4 参 · `CarrierSeal#sweep` / `BoardView.render` 显式入参 · `NextStepRouter` 构造器；`Ledger#router` 与 `Run#router` 改为构造体内赋值、传同一实例） —— checkable: `round-artifacts.test.ts` 的结构断言「`new ArtifactRegistry(` 在**生产源码**内恰一处」绿——扫描面 = 去注释并排除 `__tests__`（沿用 `src-next/__tests__/support/strip-comments.ts` 的既有姿势），测试一律经夹具助手取实例；且五个读面读到同一实例

#### Acceptance

`ArtifactRegistry` 可实例化；`entries()` 恰四行 workspace kind（`kind` 直接可断言，不从行形状反推）；`rows()` 与 `entries()` 同序；四行往返 pin 绿；`nameOf(kind, tasks)` 与 `render({domain: "workspace", tasks}, kind)` 逐 kind 相等（同一行渲染的两个入口形态，不是第二拼写）；坐标守卫：`brief` 的 `tasks` 为 `null` / 空串、三个字面量的 `tasks` 非 `null` ⇒ 两条入口都抛错；读取面：`locate` / `read` 收 `base`（同一身份在两个 workspace 上解析到各自目录，两个账本共用一个矩阵各读各的 `progress.json`），存在但读不出的名字回 `invalid(path, "unreadable")`、存在但不是普通文件回另一条 `invalid`，外来域 / 未登记 kind 抛错（不伪装成 `absent`）；workspace 字面的**每个消费符号**（`InFlight.FILE` · `Artifacts#baseSet` / `#readBase` / `#baseGet` · `Cli#baseBranchOf` · `Ledger#readProgress` / `#writeProgress`）都经矩阵读取，且既有 pin 在 `session/__tests__/ledger.test.ts` · `face/__tests__/cli.test.ts`（base 用例）· `infra/__tests__/carrier-seal.test.ts` · `session/__tests__/round-naming.test.ts` 四处逐字节零差（守恒边界覆盖 workspace 面）；五个读面（`Lifecycle` · `Ledger` · `NextStepRouter` · `CarrierSeal#sweep` · `BoardView.render`）读到**同一实例**，且矩阵外零构造点——`new ArtifactRegistry(` 在去注释、排除 `__tests__` 的 `src-next` 生产源码内恰一处（「全树只允许一个字面」不是本门的主张：测试实例经夹具助手取）；端到端两格：① 注入一个记录型矩阵跑 `base set` 与 `board --plan`，前者记录到 `base` 渲染、后者记录到 `progress` 渲染（命令前导的实例经 board → `#ledgerOf` → 账本仍是被注入的那一个）；② `CarrierSeal.sweep(dir, [], 矩阵)` 与 `sweep(dir, [])` 对同一目录判定一致，且一个 `sealed: true` 的夹具行能让同一名字从「不是载体」变成「要封」——`sealed` 列真的被读；`brief` 名字只由矩阵渲染——`tasks-{tasks}-brief.md` 模板字面只在矩阵行，`briefName` / `CliGate#renderBrief` / `Preview#readsOf` 都是委托。

#### DependsOn

none

### Task 2: `RoundDomain` 搬入矩阵 · `rulings` 行 · `pathFor` 删除

#### Objective

把 `RoundNaming` 的六 kind 渲染收进矩阵的 round 行（`identityFrom: "rendered"`），新增 **`rulings`** 行（`author: "orchestrator"`、`sealed: false`、与 `final` 同 stem **由身份渲染**、`identifier: {canonical:"finding", accepts:["finding","id"]}`、`policy` = 缺席合法），并删除 `CarrierRulings.pathFor`——sidecar 路径从此是 `render({domain:"round", …}, "rulings")` 的产物。`rulings` 的身份是**被评审那一轮**的坐标（`attribute(path.basename(the --reviews 载体))`，`op` 恒为 `review`），不是 fix 轮的 `(line, op)`。round 域的 **`attribute`（渲染名反解：名字 → `{identity, kind}`）也在本任务落地**——它是三域里唯一的名字反解实体，T5 只在它之上加 `misplaced` 一格，不另写第二处反解。`RoundNaming` 的旧名保留为别名，六 kind 名字逐字节不变。

#### Files

- Modify: `packages/cdd-engine/src-next/session/round-artifacts.ts`（round 七行登记 + `render` 分派 + round 域 `attribute` 的渲染名反解；`rulings` 行声明 `identifier` 与 `policy`）
- Modify: `packages/cdd-engine/src-next/session/round-naming.ts`（`renderName` 委托 registry；`RoundArtifact` 映射到 `Identity` 的 round 变体）
- Modify: `packages/cdd-engine/src-next/session/carrier-rulings.ts`（`pathFor` 删除；`read(sidecarPath, carrierPath)` / `verdict(sidecarPath, carrierPath, findingIds)`——路径由调用方渲染，`carrier` 键校验仍以 **carrier 的 basename** 为参照）
- Modify: `packages/cdd-engine/src-next/face/lifecycle.ts`（`#rulingsInputOf` / `#rulingsRefusal` 在调用处渲染 sidecar 路径，再走 `CarrierRulings.read` / `verdict`）
- Test: `packages/cdd-engine/src-next/session/__tests__/round-naming.test.ts`（六 kind 名字逐字节不变 + `rulings` 渲染与无 cycle 形态）
- Test: `packages/cdd-engine/src-next/session/__tests__/carrier-rulings.test.ts`（`pathFor` 零残留；`verdict` 对 `carrier` 键仍按其 basename 判）
- Test: `packages/cdd-engine/src-next/face/__tests__/lifecycle.test.ts`（派发轮为 `fix`、载体为 `plan-review-1.c1.json` 时，`INPUT_RULINGS` 的路径带 `review` 段、不含 `fix-` 段）

#### Consumes

- Task 1 的 `ArtifactRegistry` / `Identity` / `ArtifactRead` / `ArtifactRow`
- `session/carrier-rulings.ts` 的严格 schema 判定（`TOP_KEYS` / `RULING_KEYS` / `#carrierRefusal`）
- `session/ledger.ts` 的 `carrierPathOf`（`carrier` 键的 basename 参照）

#### Produces

- round 七行登记（六既有 + `rulings`），`rulings` 名字 = `<line>-<op>-<cycle>[-a<n>].c<cycle>.rulings.json`；无 cycle 身份 ⇒ `<line>-<op>.rulings.json`（与 `final` 同 stem，缺省坐标不铸段）
- `rulings` 行的身份来源（唯一一句）：坐标 = `attribute(path.basename(the --reviews 载体))` 回出的 round 身份，`op` 恒为 `review`、`cycle` / `attempt` 取载体自己的坐标
- `rulings` 行携带 `identifier: {canonical:"finding", accepts:["finding","id"]}` 与「缺席合法」的 `policy`（单源声明，读取面消费这一行，无第二处枚举）
- `CarrierRulings.read(sidecarPath, carrierPath)` / `CarrierRulings.verdict(sidecarPath, carrierPath, findingIds)`
- round 域 `attribute`（渲染名反解：三域里唯一的名字 → 身份实体；无 cycle 的 implement 拼写仍认作 `draft`，显式 `-a1` 与省 `.c<cycle>` 等能归主的变体由 T5 接成 `misplaced`）
- `pathFor` 删除后的唯一路径出口：`ArtifactRegistry#render(identity, "rulings")` + 调用方的 `Workspace#resolve`

#### Steps

- 写失败测：`render({domain:"round", line:"plan", op:"review", cycle:1}, "rulings")` 逐字节等于 `plan-review-1.c1.rulings.json`，且等于 `final` 的 stem 加 `.rulings.json`；无 cycle 形态 `render({domain:"round", line:"plan", op:"review"}, "rulings")` 等于 `plan-review.rulings.json`（同样等于该身份 `final` 的 stem + 尾，断言从**身份**写，不是对 `final` 的名字做字符串替换） —— checkable: 跑红（行未登记）
- 登记 round 七行（`rulings` 行带 `identifier` 与 `policy`）并让 `renderName` 委托 —— checkable: `round-naming.test.ts` 六 kind 逐字节绿 + 新 `rulings` 两形态用例绿
- 删 `pathFor`、改 `read` / `verdict` 入参为 `(sidecarPath, carrierPath[, findingIds])` —— checkable: `grep -rn "pathFor" packages/cdd-engine/src-next` 零命中；`carrier-rulings.test.ts` 绿
- 往返 pin 扩到 round 七行，**每个 kind 跑两遍**：带 `cycle` / `attempt` 一遍、无 `cycle` / `attempt` 一遍；无 cycle 形态下 `draft` 与 `final` 渲染**同一个名字**（既有 pin `session/__tests__/round-naming.test.ts:99-105` 断言 draft = final = `tasks-1-implement.json`），而 `attribute(name)` 只回一个 `{identity, kind}` —— 故该形态**只断身份**（`attribute` 回出同一无 cycle 身份），`kind` 按今日 `carrierPattern` 的既有口径归一为 `draft`（「无 cycle 的 implement 是 draft、永不是 final」；该正则由 T5 随 `attribute` 接管后删除，口径以本句为准），不对 `final` 那一格断言 kind；`rulings` 同形态下渲染名是 `<line>-<op>.rulings.json`（等于 `final` 的 stem），其 `misplaced` 集只剩显式 `-a1` 一格 —— checkable: 该断言绿
- 改 `lifecycle` 两处，并写「派发轮 `fix` + 载体 `review`」的 pin —— checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/face/__tests__/lifecycle.test.ts` 绿，且证据里 `INPUT_RULINGS` 值含 `review` 段、不含 `fix-` 段

#### Acceptance

`rulings` 名字由**载体身份**渲染（同一 carrier 在 `fix` 轮与 `review` 轮渲染出同一个名字，`op` 段恒为 `review`）；与 `final` 同 stem（含无 cycle 形态）；`pathFor` 全仓零命中；`verdict` 仍拒 `carrier` 键不符的 sidecar；六 kind 名字逐字节不变；round 域 `attribute` 的渲染名反解在本任务落地（T5 只在它之上加 `misplaced` 一格，无第二处反解）；**往返 pin 覆盖 round 七行、每行两形态**（T1 只覆盖 workspace 四行，本任务补齐另一半；无 cycle 形态只断身份、`kind` 归一 `draft`）；`identifier` / `policy` 只在 `rulings` 行声明一次。

#### DependsOn

1

### Task 3: `DocDomain` + `SlugIndex` 单建一次

#### Objective

文档域进矩阵，但**只做 `attribute` / `locate` / `read`**：身份来自 front-matter `slug:`，路径取 `DocEntry.rel`，**没有 `render`**（spec §2.2 / §1.3）。`attribute` 保持 `Attributed | null`（名字 → 身份是一对一，**不加第三态**）；歧义只在 doc 域 `read` 里判：同 `(slug, docType)` 命中 ≥2 份 ⇒ `invalid(path, found:[a,b], reason:"duplicate-identity")`。`SlugIndex#identityDoc` / `#planOf` 退役为 `docsOf(slug)`（0/1/n，永不选）与 `hasIdentity(slug)`（n ≥ 1 即真），四个消费者按 spec §4.4 改写。`SlugIndex` 的生产调用点从**五处收到三处**：`face/cli.ts` 内一个私有构造入口 `#indexOf(root)`（`:512` 的 `#runBoard` / `:1249` 的 `#sceneOf` / `:1591` 的 `#runBase` 三条命令路径共用它，`SlugIndex.build` 字面因此在 `cli.ts` 只剩一处）+ `session/preflight.ts:364` / `contract/invariants.ts:332` 两处 `?? build` 兜底。「单建一次」的准确含义是**同一命令内不再二建**，不是三条命令共享同一个对象——三条路径各自 `#rootOf()`、互不相交，也没有比它们更早的公共前导。

#### Files

- Modify: `packages/cdd-engine/src-next/infra/slug-index.ts`（`identityDoc` / `planOf` 退役 → `docsOf(slug): readonly DocEntry[]` / `hasIdentity(slug): boolean`；索引**只答集合**，**不新增** `attribute`——今天的索引里没有这个成员、`Attributed` 这个类型全树也不存在（它由 T1 在 `round-artifacts.ts` 定义），名字 → 身份归 `DocDomain`，索引侧零第二个端口；doc 域 `read` 的委托实现：`docsOf(slug)` 命中 ≥2 份 ⇒ `invalid(found)`）
- Modify: `packages/cdd-engine/src-next/session/round-artifacts.ts`（doc 四行登记 `identityFrom: "declared"`；`DocDomain` 实现 `attribute` / `locate` / `read`，全部委托索引）
- Modify: `packages/cdd-engine/src-next/face/cli.ts`（`SlugIndex.build` 三处（`:512` / `:1249` / `:1591`）收进一个私有 `#indexOf(root)` 入口——`#runBoard` / `#sceneOf` / `#runBase` 共用，`cli.ts` 内只剩该字面一处；`#sceneOf` 的 `specLink` / `pipeline.specPath` 改吃 `read({domain:"doc", slug, docType})`）
- Modify: `packages/cdd-engine/src-next/session/preflight.ts`（`#vet` 的 `ctx.slugIndex ?? SlugIndex.build(...)` 兜底保留，吃注入索引）
- Modify: `packages/cdd-engine/src-next/contract/invariants.ts`（`#identityDocOf` → `hasIdentity(slug)`：n ≥ 1 即零 Finding，不取第一份）
- Modify: `packages/cdd-engine/src-next/face/board-view.ts`（`#nodeSources` 的 spec / plan 两格、`#programBoard` 的 phase 板 plan 行改吃 `read(...)`，渲既有 `duplicate-identity` 标记而不是第一份）
- Test: `packages/cdd-engine/src-next/infra/__tests__/slug-index.test.ts`（`docsOf` 的 0 / 1 / n 三格与 `hasIdentity`；索引侧零 `attribute` 成员）
- Test: `packages/cdd-engine/src-next/session/__tests__/round-artifacts.test.ts`（`DocDomain#attribute` 的命中 / 未命中两态；重复身份 ⇒ doc 域 `read` 回 `invalid(found)` 而 `attribute` 仍回身份）
- Test: `packages/cdd-engine/src-next/face/__tests__/cli.test.ts`（`SlugIndex.build` 结构断言「这三处之外无 `SlugIndex.build`」+ `specLink` / `pipeline.specPath` 的读法）
- Test: `packages/cdd-engine/src-next/face/__tests__/board-view.test.ts`（`#nodeSources` / `#programBoard` 在重复身份下渲 `duplicate-identity` 标记）
- Test: `packages/cdd-engine/src-next/contract/__tests__/judge.test.ts`（`planChain` 在 n ≥ 2 身份文档时零 Finding，见 `:723-765` 的既有成对用例）

#### Consumes

- Task 1 的 `ArtifactRegistry` / `Identity` / `Attributed` / `IdentityDomain`
- `infra/slug-index.ts` 的 `#bySlug` / `#judge` / `duplicatedRolesOf(slug)` / `slugVerdict`（多份身份文档已有判定面）
- `contract/invariants.ts:332` 与 `session/preflight.ts:364` 的 `ctx.slugIndex ?? build` 既有先例（升为允许保留的两处兜底）

#### Produces

- doc 四行登记（`overall` · `phase-spec` · `single-spec` · `plan`，`identityFrom: "declared"`，零 `render`）
- `DocDomain` 的 `attribute`（`Attributed | null`）· `locate`（取 `entry.rel`）· `read`（≥2 命中 ⇒ `invalid(found:[a,b], reason:"duplicate-identity")`，歧义的唯一判定处）
- `SlugIndex#docsOf(slug)`（0/1/n，永不选）· `SlugIndex#hasIdentity(slug)`（n ≥ 1）
- `SlugIndex.build` 的三处存活点（`face/cli.ts` 的私有 `#indexOf(root)` 一处字面——`#runBoard` / `#sceneOf` / `#runBase` 共用 + `session/preflight.ts:364` / `contract/invariants.ts:332` 两处 `?? build` 兜底）

#### Steps

- 写失败测：同一 slug 两份 phase-spec 时 `docsOf(slug)` 回两条、`read({domain:"doc", slug, docType:"phase-spec"}, "phase-spec")` 回 `invalid` 且 `found` 列全两条，而 `attribute("…")` 仍回身份 —— checkable: 跑红（`docsOf` 未导出）
- 实现 `docsOf` / `hasIdentity`（索引只答集合、零 `attribute`）+ `DocDomain#attribute` / `#read`（红态先写：`attribute` 在索引上零命中、在 `DocDomain` 上回身份）+ 三处判定收紧 —— checkable: `slug-index.test.ts` 与 `round-artifacts.test.ts` 绿
- 登记 doc 四行（无 `render`） —— checkable: `rowOf("plan").identityFrom === "declared"` 且 `render({domain:"doc",…}, "plan")` 抛（declared 域不渲染）
- 改写四个消费者（`planChain` → `hasIdentity`；`Cli#sceneOf` 的 `specLink` / `pipeline.specPath`；`BoardView#nodeSources` spec / plan 两格；`BoardView#programBoard` phase plan 行） —— checkable: `contract/__tests__/judge.test.ts`、`face/__tests__/cli.test.ts`、`face/__tests__/board-view.test.ts` 三文件绿
- 把 `SlugIndex.build` 收成每个命令的唯一构造入口（cli 三处 → 私有 `#indexOf(root)` 一处字面） —— checkable: 结构断言绿——去注释的源码中 `SlugIndex.build` 只余「`cli.ts` 的 `#indexOf(root)` 一处 + `preflight.ts` / `invariants.ts` 两处 `?? build`」，**这三处之外零命中**（不是「全树只允许一个字面」）；且 `board` / scene / `base` 三条命令各自只建一次索引

#### Acceptance

doc 行零 `render`；`DocDomain#attribute` 无第三态（`Attributed | null`），索引侧零 `attribute`（名字 → 身份端口恰一个）；同 slug 多份 ⇒ doc 域 `read` 回 `invalid(found:[a,b])`（派发面 T6 据此硬停）、`hasIdentity` 仍回真、四个消费者都读 `read` / `hasIdentity` 而不再有「取第一份」的读点（`grep -rn "identityDoc\|planOf" packages/cdd-engine/src-next` 在 `infra/` 外零命中）；`SlugIndex.build` 存活点恰三处（`cli.ts` 私有入口一处 + 两处 `?? build`），且「单建一次」= 每条命令内不再二建（`board` / `scene` / `base` 各一次，不共享对象）。

#### DependsOn

1

### Task 4: `plan-source` 正查与反查的三态

#### Objective

`PlanSource` 两条腿都改成**问身份、不问名字**（spec §2.7）：正查（相位 → plan）与反查（plan → 相位 spec）都走索引 + **扫描面干净度**的三态：(a) 命中按 `DocEntry.rel` 读；(b) 未命中且扫描面干净 ⇒ `undeclared` / `spec-absent`；(c) 未命中且扫描面不干净 ⇒ **未判态**（不拒绝、板面照渲 `(none)`、装配面写一行 `CDD_WARN:` 带计数）。`SlugIndex#scanRoot` 暴露**按根**的丢弃计数（三个 doc 根各一对，共六个值）——身份反查读三个根、plan 路径只读 `plans/` 那一对。`<slug>.md` / `<slug>-design.md` 两条派生整条删除；`PlanOrphan` 只留 `cause`（`specPath` **退役**，不是收 `null`）；`planOrphanSpec(slug: string)` 收单参、报文零路径片段；P35 的值 pin、板面 pin 与 AC ③ 按三态重锚。

#### Files

- Modify: `packages/cdd-engine/src-next/infra/plan-source.ts`（`readFor` / `#orphanOf` 重写；`PlanOrphan` 只留 `cause`；未判态在 `warnLine` 通道产一行计数）
- Modify: `packages/cdd-engine/src-next/infra/slug-index.ts`（`#scanRoot` 每根保留一对丢弃计数，随索引暴露为六个值）
- Modify: `packages/cdd-engine/src-next/face/words.ts`（`planOrphanSpec(slug: string): string` 单参、报文字节 = `the slug names no identity document (index clean miss)`，零路径片段）
- Modify: `packages/cdd-engine/src-next/contract/invariants.ts`（`CrossDocChainInvariant#planChain` 吃同一组计数：null 身份 + 任一 doc 根不干净 ⇒ 零 `Finding`）
- Modify: `packages/cdd-engine/src-next/face/cli.ts`（`PlanSource` 的两个生产构造点——`#runBoard` 内 `:486`、命令前导 `:704`——改成注入单建索引；换源调用点 `#runBoard` / `#boardReadTable` / `#sceneOf` 读同一实例）
- Test: `packages/cdd-engine/src-next/infra/__tests__/plan-source.test.ts`（三态六格 + 「slug 自带 `-design`」用例 + 「脏 `specs/` × 干净 `plans/` ⇒ plan 路径仍 `undeclared`」的混合格 + `planOrphanSpec` 的报文字节）
- Test: `packages/cdd-engine/src-next/face/__tests__/board-view.test.ts`（`! no-spec` 只属 (b)；(c) 与今日逐字节相同）
- Test: `packages/cdd-engine/src-next/face/__tests__/cli.test.ts`（P35 AC ③ 重锚：缺 `doc-type: plan` ⇒ plan / wave 行 `(none)`、`next:` 回 `kairos:cdd-plan`、stderr 恰一行 `CDD_WARN:`、零拒绝、exit 0）

#### Consumes

- Task 3 的 `DocsOf` / `hasIdentity` / 单建索引 / doc 域 `read`
- `infra/plan-source.ts` 的 `PlanRead` 三态（`undeclared` / `unreadable` / `ready`）与 `PlanSource` 缝、`warnLine` / `refusal` 通道
- P35 的三条既有 pin（值 pin / 板面 pin / AC ③）

#### Produces

- `PlanSource#readFor(entry)` / `#orphanOf(head)` 的三态裁决（`hit` / `clean-miss` / `indeterminate`）
- `SlugIndex#discarded(): {overalls: {unreadable; unregistered}; specs: {…}; plans: {…}}`（按根六值，与入册结果同一次扫描产出）
- 两个判断各自读的根：身份反查（`#orphanOf` / `planChain`）读三个根；plan 路径（`readFor`）只读 `plans/` 那一对
- 未判态的观测面：一行 stderr `CDD_WARN: <plans 根> — <n> discarded candidate(s)`（`n` 为该根 `unreadable + unregistered`，由既有 `warnPrefix` 通道拼装，零拒绝）
- `PlanSource` 的构造收索引：`new PlanSource(root, index[, fs])`——两条腿（正查 / 反查）都问注入的那一个索引，零自建
- `words.ts` 的新报文（无派生路径）+ `PlanOrphan` 只留 `cause`

#### Steps

- 写失败测：slug 以 `-design` 结尾的相位 + plan ⇒ 正查命中、反查 (a)，**零拒绝** —— checkable: 今日必红（派生 `-design-design.md`）
- 写三态六格测（命中 / 干净缺失 / 脏缺失 × 正查反查）+ 混合格（脏 `specs/`、干净 `plans/` ⇒ plan 路径仍 `undeclared`、零 `CDD_WARN:`） —— checkable: 跑红
- 实现 `discarded()`（按根六值）与 `PlanSource` 重写（含未判态那行 `CDD_WARN:`） —— checkable: `plan-source.test.ts` 绿
- 改 `words.ts` 报文 + `planChain` 吃同一组计数 —— checkable: `contract/__tests__/judge.test.ts` 与 `contract/__tests__/lint.test.ts` 绿，且 (c) 格上 `#contract.validate` 零 `cross-doc-chain@slug` `Finding`（实现前这两文件对应腿为红：它们正是 `cross-doc-chain` 的既有家）
- 重锚 P35 三条 pin，并跑派生零命中门 —— checkable: `face/__tests__/board-view.test.ts` + `face/__tests__/cli.test.ts` 绿，且 `grep -rn "<slug>\|-design" packages/cdd-engine/src-next/infra` 对派生拼不出命中（`planOrphanSpec` / `readFor` 里零路径拼接）
- 构造收索引：`PlanSource` 入参加注入索引，改 `#runBoard` 与 `:704` 两个生产构造点、更新 `#boardReadTable` / `#sceneOf` 的传递，并让测试仓约 150 处 `new PlanSource(...)` 经夹具助手取索引（先红：今日构造只拿根） —— checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/infra/__tests__/plan-source.test.ts src-next/face/__tests__/board-view.test.ts src-next/face/__tests__/cli.test.ts` 绿，且证据里 `PlanSource` 的入参带索引

#### Acceptance

正查 / 反查各三格可判且成对 pin；`-design` 结尾 slug 放行；`(c)` 未判态零拒绝、板面字节与今日相同、恰一行 `CDD_WARN:` 带计数；`PlanOrphan` 只剩 `cause`（`specPath` 字段不存在，不是 `null`）；`planOrphanSpec(slug: string)` 单参且报文字节为零路径片段；plan 路径的「干净」只读 `plans/` 那一对计数（混合格绿）；`infra/` 内派生拼接零命中；`PlanSource` 的构造点只读注入的那一个索引、零自建 `SlugIndex.build`（换源调用点点名 `Cli#runBoard` / `#boardReadTable` / `Cli#sceneOf`）。

#### DependsOn

3

### Task 5: 归主文法 · duplicate ⇒ invalid · 归属泛化 · `sealed` 列

#### Objective

矩阵补两格（spec §2.5 / §2.8 / §2.9 ⑤）：**归主文法**（三条落格规则 + 逐行答案表 + 枚举 pin，**不进类型**）与 **`sealed` 列**（`CarrierSeal` 改读它，`RULINGS_SUFFIX` 退役）；同时把 `Ledger#orphanHandoffs` 泛化成「目录里 `attribute` 认不得的名字即 orphan」（零写只显示），`attribute` 对同 `(identity, kind)` 的 ≥2 名字给 `misplaced`，并把拼写知识 #1 / #2 一并退役（`attribute` 接管归属后它们是零读者的死声明：`RoundNaming#carrierPattern` / `CARRIER` / `#isCarrierName` 与 `Ledger#WAVE_CARRIER` / `#LINE_CARRIER` / `#handoffOwner`），且立**唯一构造点门**的骨架与放行面：判定函数认「矩阵行 + 夹具」为豁免，`CarrierSeal` 零后缀字面亦在本任务验收。两条**收紧**断言（`.rulings.json` 字面集封闭、`finding` / `id` 接受集单源）不在本任务落地：它们的第二声明分别住 `session/next.ts` 的 `.rulings.json` 字面与 `session/carrier-rulings.ts` 的 `RULING_KEYS`，两处的唯一拆除者是 T9（且 T9 经 `T9 → T6 → T5` 严格晚于本任务，无依赖可加），W3 上跑全树封闭必然是红的。

#### Files

- Modify: `packages/cdd-engine/src-next/session/round-artifacts.ts`（归主文法三条规则 + 逐行答案表 + `attribute` 的 `misplaced` 一格——反解本体在 T2；**不加 `attribution` 字段**——`identifier` / `policy` 由 T1 定形、`rulings` 行由 T2 声明）
- Modify: `packages/cdd-engine/src-next/infra/carrier-seal.ts`（删 `RULINGS_SUFFIX`；`#isStray` 读 `sealed` 列，`RoundNaming.isCarrierName` 的调用随该列接管而消失）
- Modify: `packages/cdd-engine/src-next/session/round-naming.ts`（删拼写知识 #1：`carrierPattern`（`:41`）/ `CARRIER`（`:56`）/ `RoundNaming#isCarrierName`（`:164`））
- Modify: `packages/cdd-engine/src-next/session/ledger.ts`（`orphanHandoffs` 泛化为矩阵驱动；删拼写知识 #2：`#WAVE_CARRIER`（`:1993`）/ `#LINE_CARRIER`（`:1999`）/ `#handoffOwner`（`:1959`），含 `#LINE_CARRIER` 的 `spec` 替代项）
- Create: `packages/cdd-engine/src-next/__tests__/artifact-literal-door.test.ts`（结构门骨架：一个对源码样本判定的纯函数 + 判定函数层正反例——矩阵行 / 夹具放行，矩阵外样本判违例；**不**在真树上断言封闭集，两条收紧用例在 T9 补进同一文件）
- Test: `packages/cdd-engine/src-next/session/__tests__/round-artifacts.test.ts`（归主文法三格 + 逐行答案表）
- Test: `packages/cdd-engine/src-next/session/__tests__/round-naming.test.ts`（枚举 pin 的家：accepted 与 orphan 两侧各枚举一条，逐行答案显式写「无此格」；原 `minted` / `neighbours` 两组断言（`:515-540`）按矩阵归属重锚——`isCarrierName` 退役后，两组断言改由 `attribute` 的 accepted / orphan 两格承担）
- Test: `packages/cdd-engine/src-next/session/__tests__/carrier-rulings.test.ts`（`misplaced` 一侧的枚举：省 `.c<cycle>` 段 · 显式 `-a1`）
- Test: `packages/cdd-engine/src-next/infra/__tests__/carrier-seal.test.ts`（`sealed` 列驱动；`report` / `log` / `crash` / `evidence` 一律不封）

#### Consumes

- Task 2 的 round 七行（含 `rulings` 的 `identifier` / `policy` 声明）与 round 域 `attribute` 的渲染名反解（本任务只在其上加 `misplaced` 一格）
- `infra/carrier-seal.ts` 的 `sweep` / `seal` / `unseal`
- `session/ledger.ts` 的 `#handoffOwner` 两套正则（本任务由矩阵归主文法取代，符号一并删除）

#### Produces

- 归主文法（三条落格规则 + spec §2.5 的逐行答案表原样 + 枚举 pin：accepted / orphan 在 `round-naming.test.ts`，`misplaced` 在 `carrier-rulings.test.ts`）；**不是字段**，不进 `ArtifactRow`
- `ArtifactRegistry#attribute` 的 `misplaced` 产出面（同 identity × kind ≥2 名字）
- 拼写知识 #1 / #2 的退役面：`carrierPattern` · `CARRIER` · `isCarrierName` · `#WAVE_CARRIER` · `#LINE_CARRIER` · `#handoffOwner` 六个符号零残留
- `CarrierSeal#sweep` 读 `sealed` 列（零后缀字面）
- `artifact-literal-door.test.ts` 的门骨架与放行面（矩阵行 / 夹具豁免）；**收紧断言不在本任务**：`.rulings.json` 字面集封闭与 `finding` / `id` 接受集单源归 T9

#### Steps

- 写失败测：同一 round 的 `.rulings.json` 与 `.c1.rulings.json` 并存 ⇒ `attribute` 报双候选（供 T6 组报文） —— checkable: 跑红
- 实现归主文法 + `sealed` 列 —— checkable: `round-artifacts.test.ts` + `carrier-seal.test.ts` 绿
- 泛化 `orphanHandoffs` —— checkable: `session/__tests__/ledger.test.ts` 的 orphan 面绿；未登记名字出现在板上
- 删两族六个符号（`carrierPattern` · `CARRIER` · `isCarrierName` · `#WAVE_CARRIER` · `#LINE_CARRIER` · `#handoffOwner`），`CarrierSeal#isStray` 改读 `sealed` 列，`round-naming.test.ts:515-540` 的 `minted` / `neighbours` 断言改由 `attribute` 的 accepted / orphan 两格承担 —— checkable: `session/__tests__/round-naming.test.ts` · `infra/__tests__/carrier-seal.test.ts` · `session/__tests__/ledger.test.ts` 绿，且**逐符号** grep 门全零命中（去注释的生产源码内，六个符号各一条）
- 删 `RULINGS_SUFFIX` —— checkable: `grep -rn "RULINGS_SUFFIX" packages/cdd-engine/src-next` 零命中
- 写唯一构造点门的骨架 + 判定函数层正反例（矩阵行与夹具放行；样本里注入一条矩阵外的 `.rulings.json` 字面 ⇒ 判定回违例） —— checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/__tests__/artifact-literal-door.test.ts` 绿且反例红；**红态期望**：本任务只到判定函数这一层——真树上此刻仍有 `session/next.ts` 的字面与 `carrier-rulings.ts` 的接受集枚举，「全树封闭」此刻必红，两条收紧用例随 T9 一起落地（先红后绿）

#### Acceptance

归主文法逐行声明且被枚举 pin（`progress` / `base` / `in-flight` / `brief` 四行显式写「无此格」而非留空）；`ArtifactRow` 零 `attribution` 字段；`CarrierSeal` 零后缀字面（`RULINGS_SUFFIX` 零命中）；orphan 仍零写只显示；拼写知识 #1 / #2 的两族六个符号零残留（`carrierPattern` · `CARRIER` · `isCarrierName` · `#WAVE_CARRIER` · `#LINE_CARRIER` · `#handoffOwner`，逐符号 grep 门），`round-naming.test.ts` 的 `minted` / `neighbours` 断言已按矩阵归属重锚；门的**放行面**成立（矩阵行 / 夹具豁免，矩阵外样本在判定函数上判违例）；两条收紧（字面集封闭 = `session/next.ts` 值位落地后、接受集单源 = `carrier-rulings.ts` 读行声明落地后）显式归 T9，本任务不宣称它们成立。

#### DependsOn

2, 3

### Task 6: `misplaced = block` 门

#### Objective

落 spec §2.3 / §2.4 的判别值与门：`#artifactReadOf(frame, kind)` **一次**算出 `ArtifactRead`，prompt 格与门读同一个值；`misplaced` ⇒ 派发前 `CDD_BLOCKED: artifact-identity`，报文四段（`derived` / `found` / `identity` / `repair`），多候选全列不选，`--dry-run` 同源可见，child 零 spawn，引擎只拒不改。报文的 `derived:` 与 `identity:` 同源：都从 `attribute(path.basename(the --reviews 载体))` 渲染（载体身份，`op` 恒为 `review`），不由本轮（fix 轮）的 `(line, op)` 算。同任务落**迁移夹具的成对两半**：错位 sidecar ⇒ 拦住；在夹具树里改名成 `.c<N>.rulings.json` ⇒ 同一命令 `ok`、prompt 恰一行路径、child spawn 恰一次。同任务按 spec §4.5 钉住 `unreadable` 一格：推导名在盘上但 IO 失败 ⇒ `invalid(path, "unreadable")`，不得读成 `absent`——「读不到」不得授权「没有」，`art:` 行与派发门都不许把它当缺席。

#### Files

- Modify: `packages/cdd-engine/src-next/face/lifecycle.ts`（`#artifactReadOf` + `#artifactRefusal` 取代 `#rulingsRefusal`；`#valuesOf` 读同一值；`derived:` / `identity:` 都由载体身份渲染）
- Modify: `packages/cdd-engine/src-next/face/words.ts`（`artifact-identity` 词与四段报文）
- Modify: `packages/cdd-engine/src-next/face/preview.ts`（纯读门同源）
- Test: `packages/cdd-engine/src-next/face/__tests__/lifecycle.test.ts`（成对：变体在 ⇒ 停；两处都缺 ⇒ 不拦；派发轮 `fix` + 载体 `review` ⇒ 报文 `identity:` 带 `op=review`、`derived:` 不含 `fix-`；推导名在盘上但不可读 ⇒ `invalid` 且 reason 为 `unreadable`）
- Test: `packages/cdd-engine/src-next/face/__tests__/cli.test.ts`（`--dry-run` 可见 + child 零 spawn + 迁移后一半：改名 ⇒ `ok`、prompt 一行路径、spawn 一次）
- Test: `packages/cdd-engine/src-next/session/__tests__/carrier-rulings.test.ts`（同一载体：错位名 `attribute` 回 `misplaced`、渲染名回同一 `(identity, "rulings")`）

#### Consumes

- Task 5 的 `attribute` 双候选面与归主文法
- `session/preflight.ts` 的在飞门顺序（门须在取在飞记录之前）
- `face/words.ts` 的既有 `CDD_BLOCKED` 词表

#### Produces

- `#artifactReadOf(frame, kind): ArtifactRead`（唯一读取）
- `artifact-identity` 报文四段的词面，`derived:` / `identity:` 同源于载体身份
- `--dry-run` 的 `reads:` / 拒绝同源
- 迁移成对夹具：错位 ⇒ 四段齐 + 零 spawn；改名 ⇒ `ok` + 一行路径 + 一次 spawn

#### Steps

- 写失败测：错位 sidecar ⇒ `CDD_BLOCKED: artifact-identity`、四段齐、`runner.calls` 为空 —— checkable: 跑红
- 实现读取面 + 门 + 报文（`derived:` / `identity:` 从载体身份渲染） —— checkable: `lifecycle.test.ts` 绿
- 写预览同源测 —— checkable: `cli.test.ts` 的 dry-run 用例绿
- 写多候选测（渲染名合法 + 同身份另一个能归主的名字 ⇒ 仍停） —— checkable: 报文列全、不选、不写
- 写迁移成对夹具（同一 carrier、同一命令；前半错位 ⇒ 拦、后半改名 ⇒ `ok` 且 spawn 一次） —— checkable: `lifecycle.test.ts` + `cli.test.ts` 绿
- 写 `unreadable` 一格：推导名在盘上但不可读（权限 / 读竞态） ⇒ `invalid` 且 reason 为 `unreadable`，`art:` 行与派发门都不许把它当缺席 —— checkable: 该断言绿（今日必红：全仓对 `unreadable` 侧车零覆盖，`carrier-rulings.test.ts` 的无效表只覆盖内容非法）

#### Acceptance

成对 pin 成立（变体在 ⇒ 停 / 两处都缺 ⇒ 不拦且 prompt 字节零变）；多候选不二选一、优先于 `ok`；`--dry-run` 与真实面同源；child 零 spawn；报文 `identity:` / `derived:` 由载体身份（`op=review`）渲染，派发轮为 `fix` 时零 `fix-` 段；迁移后半证明「改名即成」这一条消费可见事实；推导名在盘上但 IO 失败 ⇒ `invalid(…, "unreadable")`，`art:` 行与门都不当缺席（§4.5 有 pin，不靠 `existsSync` 二分为缺席 / 存在）。

#### DependsOn

2, 5

### Task 7: board 单向投影（`art:` 事实行 + `--artifacts`）

#### Objective

board 加**一条异常事实行** `art:`（默认零字节；健康树不新增字符；只在有 `misplaced` **或** `invalid` 时出现），与 `in-flight:` / `crashed:` / `orphan:` 同族，插在行区之后、`next:` 之前；`--artifacts` 才摊开「一 kind 一列、一轮一行」的排障视图。board **不持有名字规则**，只渲染矩阵判定结果。

#### Files

- Modify: `packages/cdd-engine/src-next/face/board-view.ts`（`art:` 事实行 + `--artifacts` 视图）
- Modify: `packages/cdd-engine/src-next/face/cli.ts`（旗标接线）
- Modify: `packages/cdd-engine/src-next/face/declare.ts`（`ARGV_CHANNEL` 增 `artifacts` 行（`{ flag: "--artifacts", type: "bool", help }`），`CLI_COMMANDS` 的 `board.keys` 增该项；help / example 是否连带改在同一步判定）
- Test: `packages/cdd-engine/src-next/face/__tests__/board-view.test.ts`（健康树逐字节不变 + 异常仅新增一行）
- Test: `packages/cdd-engine/src-next/face/__tests__/cli.test.ts`（`--artifacts` 展开面）

#### Consumes

- Task 6 的 `ArtifactRead`（板面只读判定结果）
- `face/board-view.ts` 的 `nextLine` / `reasonLine` / `inFlightRows` 既有事实行形状
- `face/declare.ts` 的 `ARGV_CHANNEL` / `CLI_COMMANDS` 与 `face/__tests__/channel-closure.guard.test.ts` 的两条闭环腿（声明键必须能在 `ARGV_CHANNEL` 解析、非程序级频道键必须被某条命令声明）

#### Produces

- `art:` 事实行的字面与缩进（与 `orphan:` 同款；`misplaced` 与 `invalid` 两臂）
- `cdd board … --artifacts` 的排障视图
- `ARGV_CHANNEL.artifacts` 声明行 + `board.keys` 的接线（频道闭环不破）

#### Steps

- 写失败测：健康树上 board 输出逐字节等于今日（含 `next:` / `reason:` 位置） —— checkable: 先绿（作为守恒基线）
- 写失败测：一处 misplaced ⇒ 输出恰新增 `art:` 三行 —— checkable: 跑红
- 实现事实行（`misplaced` 与 `invalid` 两臂）+ 旗标 —— checkable: 两条测文件绿
- 接线声明面：`ARGV_CHANNEL.artifacts`（`flag: "--artifacts"`）+ `board.keys`，并在此步判定 help / example 是否连带改 —— checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/face/__tests__/channel-closure.guard.test.ts` 绿，且 `cdd board --plan … --artifacts` 不进 usage
- 写 `invalid` 一格：schema 非法的侧车 ⇒ `art:` 行带其 reason、其余行零字节变化 —— checkable: 该断言绿

#### Acceptance

健康树零字节变化（P33/P34/P35 的 board pin 全绿）；异常仅新增 `art:` 事实行；`misplaced` 与 `invalid` 两臂都能落 `art:`（`invalid` 带其 reason）；`--artifacts` 默认关，且旗标宣告在 `ARGV_CHANNEL` 并被 `board` 声明（频道闭环门绿）。

#### DependsOn

6

### Task 8: legacy 拆族

#### Objective

按 spec §3 拆掉历史拼写读法，**五个符号族 + 一处正则替代项**（不写「N 处」，一律符号枚举）：① `RETIRED_SPEC_KEY` / `RETIRED_SPEC_LINE_KEYS` 的行级回退（`Ledger.rowFor` 的 `spec` 行 + `#retiredSpecApplies`，`session/ledger.ts:362` / `:370` / `:767` / `:774`）· ② `Ledger#resolveHandoffName` 的 doc 线 alias（`:1738`，`RETIRED_SPEC_LINE_KEYS.has(type)`）+ `#resolvedCarrierName` 的 `key === RETIRED_SPEC_KEY` 分支（`:1868`）· ③ `#retiredCarrierName`（`:1882`，`spec-<op>-<round>.json`）及其两个调用点 · ④ `#legacyCarrierName`（`:1754`，无 cycle 的 `tasks-<n>-implement.json`）· ⑤ `#ownerRow` 的退役分支（`:1927` / `:1931`）与 `#lineWord` 的退役分支（`:1937` / `:1938`）。另有 `#LINE_CARRIER`（`:1999`）的 `spec` 替代项——它随 T5 的 `attribute` 接管归属而消失，不在本任务重复拔。拆后旧 workspace 的板面退化为缺行 + orphan，新派发零影响；P34 §2.6 的「历史零迁移可读」收窄为「历史文件不被删除/改写；引擎不再识别历史拼写」。

#### Files

- Modify: `packages/cdd-engine/src-next/session/ledger.ts`（五个符号族全拆：`RETIRED_SPEC_KEY` / `RETIRED_SPEC_LINE_KEYS` 常量与 `rowFor` / `#retiredSpecApplies` / `resolveHandoffName` / `#resolvedCarrierName` 的旧分支、`#retiredCarrierName` / `#legacyCarrierName` 删除、`#ownerRow` / `#lineWord` 的退役分支删除）
- Not in this task: `packages/cdd-engine/src-next/session/round-naming.ts` —— 拼写知识 #1（`carrierPattern` / `CARRIER` / `isCarrierName`）随 T5 的 `attribute` 接管归属整族删除，本任务不再改动该文件
- Test: `packages/cdd-engine/src-next/session/__tests__/ledger.test.ts`（退役面用例删除 / 改写为「旧键不再解析」）
- Test: `packages/cdd-engine/src-next/face/__tests__/board-view.test.ts`（旧 workspace 缺行 + orphan 的期望字节）
- Test: `packages/cdd-engine/src-next/session/__tests__/handoff-plane.guard.test.ts`（legacy 载体「派发不被拦」的 pin：盘上同时有 `spec-review-1.json` 与无 cycle 的 `tasks-1-implement.json` ⇒ 派发 exit 0、零 `CDD_BLOCKED`、两文件各落一行 `orphan:`）

#### Consumes

- Task 2 / Task 5 的矩阵（归主文法接管旧名字 → orphan；`#LINE_CARRIER` 的 `spec` 分支由 `attribute` 取代）
- spec §3.2 的实测命令与数字（31 workspace / 221 行 / 16 行 `spec` / 193 条 `spec-*`）

#### Produces

- 五个符号族的退役分支零残留（逐族 grep 命中为零）
- 旧 workspace 的新期望字节（缺行 + orphan）

#### Steps

- 写失败测：`wave: "spec"` 的账本行**不再**解析成文档行（读作缺行） —— checkable: 跑红（今日仍解析）
- 拆五个符号族 + 删两个方法 —— checkable: 该测绿
- 改 board 的旧 workspace 期望字节 —— checkable: `board-view.test.ts` 绿
- 写 legacy 放行 pin（`session/__tests__/handoff-plane.guard.test.ts`：两个 legacy 文件在盘上 ⇒ 派发 exit 0、stderr 零 `CDD_BLOCKED`、板面两行 `orphan:`） —— checkable: 该测绿（`misplaced` 只对能归主的名字成立，`attribute → null` 一律 orphan）
- 全仓 grep 门（**逐族各一条，五条都跑**） —— checkable: `RETIRED_SPEC_KEY|RETIRED_SPEC_LINE_KEYS` 零命中 · `#retiredCarrierName` 零命中 · `#legacyCarrierName` 零命中 · `#ownerRow` 零命中 · `#lineWord` 零命中（`#LINE_CARRIER` 的 `spec` 替代项由 T5 的门报零）

#### Acceptance

五个符号族的退役分支零残留（grep 逐族点名）；`#LINE_CARRIER` 的 `spec` 替代项随 T5 归零；旧 workspace 板面缺行 + orphan；legacy 载体的**派发放行**有 pin（exit 0 · 零 `CDD_BLOCKED` · 两条 `orphan:` 行）；新派发行为零变化（守恒边界仍绿）。

#### DependsOn

2, 5

### Task 9: 词表别名 · 固定前缀读法句 · 读回提示印路径

#### Objective

三处消费面（spec §2.8 / §2.10）：`rulings` 行的 `identifier` 词表已由 T2 声明，读取面**消费那一行**（`finding` / `id` 双向兼容，内部归一 `finding`，未知键仍整份拒，无第二处枚举）；fix / docs-fix 两壳各补**一句**读法（裁定回答某 finding id 并压过该 finding 自身建议 · carrier 只读）；`INPUT_RULINGS` 只印路径——`#rulingsInputOf` 回单行路径、`#rulingLine` 删除；`FIX_READBACK_SUFFIX` 从「教规则」改为「印已解析路径」（保留导出，句子逐字节固定、路径是值位，由 `Route` 带值、`RouteRenderer` 只填），并按 D74 记 deliberate pin 重锚（四个站点）。同任务收口另两处第二声明：`session/next.ts` 的字面值与 `carrier-rulings.ts` 的接受集枚举——`Route` 的 fix 臂**新增一个值位字段**（路径作为值下行），值由 `Router#next` 按 `attribute(path.basename(carrierPath))` → `render(…, "rulings")` 算出，`RouteRenderer` 只填空、零推导。

#### Files

- Modify: `packages/cdd-engine/src-next/session/carrier-rulings.ts`（读 `rulings` 行的 `identifier` 词表；`id` / `finding` 双向归一，未知键仍整份拒）
- Modify: `packages/cdd-engine/src-next/render/templates.ts`（两壳各一句读法；`INPUT_RULINGS` 行只印路径）
- Modify: `packages/cdd-engine/src-next/face/lifecycle.ts`（`#rulingsInputOf` 只回路径行；`#rulingLine` 删除；路径由载体身份渲染）
- Modify: `packages/cdd-engine/src-next/session/next.ts`（`FIX_READBACK_SUFFIX` 收回规则句、改为值位模板（保留导出，`<rendered sidecar path>` 是槽位）；`Route` 的 fix 臂（`:54` 的 `{ kind: "fix"; reviews?: string }`）新增值位字段（如 `rulings?: string`），`Router#next`（`:342` / `:363`）按 `attribute(path.basename(carrierPath))` → `render(identity, "rulings")` 算值写进该字段；文件内零 `.rulings.json` 字面）
- Modify: `packages/cdd-engine/src-next/face/route-render.ts`（五处 fix 行填 `Route` 带来的值——与门 `derived:` 同值、由载体身份算出；`#fixText` 只填 `route.rulings`，零推导）
- Modify: `packages/cdd-engine/src-next/__tests__/artifact-literal-door.test.ts`（把 T5 的判定函数门收紧成真树断言：`.rulings.json` 字面集 = 矩阵行 + 夹具，`finding` / `id` 接受集恰一处声明）
- Test: `packages/cdd-engine/src-next/session/__tests__/carrier-rulings.test.ts`（`id` 与 `finding` 双向，未知键仍拒）
- Test: `packages/cdd-engine/src-next/render/__tests__/render.test.ts`（两壳各含读法句；`INPUT_RULINGS` 的模板面只固定前缀句，正文零行那条不在这一层断言）
- Test: `packages/cdd-engine/src-next/face/__tests__/lifecycle.test.ts`（侧车**真的带** rulings 时 round context 恰一行 `- \`INPUT_RULINGS\``、零缩进正文行；同一轮里 fix 行印的路径与门报文 `derived:` 段逐字节相等）
- Test: `packages/cdd-engine/src-next/face/__tests__/face.test.ts` + `packages/cdd-engine/src-next/face/__tests__/cli.test.ts` + `packages/cdd-engine/src-next/face/__tests__/capsule.test.ts` + `packages/kairos/tests/status-routing-convergence.test.ts`（fix 行字面重锚为具体解析出的 sidecar 路径；外加一格**载体拼写 ≠ 渲染名**的 pin——载体 `plan-review-1-a1.json`（渲染器从不铸 `-a1`）⇒ fix 行印渲染名 `plan-review-1.c1.rulings.json`，不是换尾名 `plan-review-1-a1.rulings.json`）

#### Consumes

- Task 2 的 `rulings` 行（含 `identifier` 声明）与其渲染
- Task 6 的判别值（present / absent 两格）与载体身份
- `face/route-render.ts` 的五个 fix 行拼装点
- `session/next.ts` 的 `Route` 判别联合与 `Router#next` 的两个 fix 分支（`:342` / `:363`）——值位字段与算值入参的宿主

#### Produces

- `rulings` 行 `identifier` 的唯一读取点（消费行声明，无第二处枚举）
- 两壳的读法句（字节稳定）
- `#rulingsInputOf` 的单行路径形态（`#rulingLine` 零残留）
- `FIX_READBACK_SUFFIX` 的值位模板（保留导出；句子逐字节固定，路径由 `RouteRenderer` 从 `Route` 填）与新的 `next:` fix 行字面
- `Route` fix 臂的值位字段（名字由 `Router#next` 按载体身份算出，不按文件名换尾）
- 门的两条收紧用例（与 T5 的判定函数同文件）：`.rulings.json` 字面集 = 矩阵行 + 夹具、`finding` / `id` 接受集恰一处声明

#### Steps

- 写失败测：`id` 键的 sidecar 被接受、未知键仍拒 —— checkable: 跑红
- 写失败测：侧车带裁定时 round context 恰一行路径、零正文行（夹具的 `rulings` 非空） —— checkable: 跑红（今日每条形一行缩进正文）
- 写失败测：两壳各含读法句 —— checkable: 跑红（模板层）
- 实现五处（carrier-rulings 读行声明 / templates 两壳 + 单行 / lifecycle 单行 / next 的路由器算值 + 值位模板 / route-render 只填值） —— checkable: `carrier-rulings.test.ts` · `render.test.ts` · `lifecycle.test.ts` 三文件绿
- 把门收紧成真树断言（同一文件：`.rulings.json` 字面集 = 矩阵行 + 夹具、`finding` / `id` 接受集恰一处声明） —— checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/__tests__/artifact-literal-door.test.ts` 绿；**红态期望**：`next.ts` 的字面与 `carrier-rulings.ts` 的枚举在本任务前仍在，两条断言先红后绿，事后注入第二处即红
- 写 F4 的两条 pin：① 载体 `plan-review-1-a1.json` ⇒ fix 行印 `plan-review-1.c1.rulings.json`；② 同一轮 fix 行路径与门报文 `derived:` 段逐字节相等 —— checkable: ① 先跑红（今日按文件名换尾得 `plan-review-1-a1.rulings.json`），② 实现后绿
- 重锚四个 fix 行 pin（deliberate · D74） —— checkable: `face.test.ts` · `cli.test.ts` · `capsule.test.ts` · `status-routing-convergence.test.ts` 四文件绿

#### Acceptance

`finding` / `id` 双向且未知键仍整份拒、接受集单源；两壳读法句在册且 `INPUT_RULINGS` 恰一行路径、零正文行、`#rulingLine` 零残留；fix 行印解析后路径、`session/next.ts` 零 `.rulings.json` 字面；四个 pin 站点（`face.test.ts` · `cli.test.ts` · `capsule.test.ts` · `status-routing-convergence.test.ts`）按路径重锚；载体拼写 ≠ 渲染名时 fix 行印渲染名（非换尾名），且与门 `derived:` 逐字节相等；门的两条收紧断言真树绿。

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
- 白名单三项（按 spec §2.9 ④ 的顺序）：① `SlugIndex` 的扫描根——`#scanRoot` 的三次调用与 `insideDocRoots`（`infra/slug-index.ts:124` / `:160-162`）· ② runtime / `RepoRoot` 组合——`contract/invariants.ts:1478` 的 `#scanRoots` 把 `ENGINE_DOC_ROOTS` 的值与根 `path.join` 起来 · ③ 命名空间 / 段派生——`contract/invariants.ts` 的 `DOC_ROOT_NAMESPACE` / `DOC_ROOT_SEGMENTS`（`:56` / `:61`）
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

消费面落点与迁移说明（spec §2.10 / §3.4）：`cdd-dev` / `cdd-plan` / `cdd-spec-writer` 各一条裁决落点指令（挂既有 `## Invariants` 表一行，**不改** `skill-anatomy` 的 section registry）；落点一律指向引擎在 `next:` 里印出的那个路径，因此 skill 文本对 `.rulings.json` 字面零命中；cdd-engine README（EN + `.zh-CN.md` **双语同源**）补迁移段：89 个错位 sidecar 的一次性改名命令 + 升级后首次派发会 `CDD_BLOCKED: artifact-identity` 的说明。

#### Files

- Modify: `packages/kairos/skills/cdd-dev/SKILL.md`（`## Invariants` 一条）
- Modify: `packages/kairos/skills/cdd-plan/SKILL.md`（同上）
- Modify: `packages/kairos/skills/cdd-spec-writer/SKILL.md`（同上）
- Modify: `packages/cdd-engine/README.md` + `packages/cdd-engine/README.zh-CN.md`（迁移段，双语同源）
- Test: `packages/kairos/tests/skill-anatomy.test.ts`（既有强判：新行不得越出 registry）
- Test: `packages/kairos/tests/presentation-surface.test.ts`（README 双语同步的既有 pin 就在此文件：镜像家庭与逐镜像标题序列；目录不是 pin，不可逐条核）
- Test: `packages/kairos/tests/skill-surface-consistency.test.ts`（新增一条文本门：全部 shipped skill 文本——`SKILL.md` 与 skill `docs/*.md`——对 `.rulings.json` 字面零命中）

#### Consumes

- Task 9 的落点语义（裁定文件的路径与读法）
- `contract/skill-anatomy.ts` 的 `## Invariants` 既有 section（宿主）
- AGENTS.md 的语言政策（README 家族 EN + `.zh-CN.md` 同源）

#### Produces

- 三 skill 各一行落点指令（零程序史 / 零相位号 / 零 `.rulings.json` 字面）
- README 双语迁移段（命令 + 首次派发行为 + 改名后必须复判）

#### Steps

- 写三行指令 —— checkable: `pnpm -C packages/kairos exec vitest run tests/skill-anatomy.test.ts` 绿
- 写 skill 文本门（`skill-surface-consistency.test.ts` 内一条：全树 skill 文本对 `.rulings.json` 字面零命中；今日零命中是基线，注入一处字面即红） —— checkable: 该门绿
- 写 README EN 段 + zh-CN 镜像 —— checkable: 双语 pin 绿
- 全量门 —— checkable: `pnpm run validate` exit 0

#### Acceptance

三 skill 各一条且在 registry 既有 section 内；skill 文本对 `.rulings.json` 字面零命中（`skill-surface-consistency.test.ts` 的文本门在册，零程序史 / 零相位号同条守卫）；README 双语同源（pin = `packages/kairos/tests/presentation-surface.test.ts`）；`pnpm run validate` exit 0；changeset `cdd-engine` minor + `kairos` minor 在册，且 `cdd-engine` 的理由点名三处消费可见变化（`artifact-identity` 硬停门 · `INPUT_RULINGS` 零正文 · 未入册 plan 由「健康渲出」改为未判态 `(none)` + 一行 `CDD_WARN:`）。

#### DependsOn

8, 9, 10

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-11-15 | 初稿：11 个任务按 `DependsOn` 成 **6 波**（W1{1} 矩阵骨架+workspace · W2{2,3} round/doc 两域 · W3{4,5} plan-source 三态 + 归属/辨识面 · W4{6,8,10} 门 / legacy 拆除 / docRoots 门 · W5{7,9} board 投影 + 词表与提示面 · W6{11} 消费面与迁移），每波 ≤3 个任务；守恒边界与「引擎只拒不改」写进 Global Constraints。 | [human] 裁定 · Claude（kairos:cdd-plan · 2026-11-15） |
| v0.2 | 2026-11-15 | 计划评审 round 1 全量落地（F1–F18）：**F1** T3 改成 spec §4.4 的读面——doc 域 `read` 判重复身份（`invalid(found:[a,b])`）、`attribute` 回 `Attributed \| null` 无第三态、`identityDoc` / `planOf` 退役为 `docsOf`（0/1/n）+ `hasIdentity`，四个消费者（`planChain` · `Cli#sceneOf` · `BoardView#nodeSources` · `#programBoard`）与 `locate` / `IdentityDomain` 契约各有归属 · **F2** `INPUT_RULINGS` 零正文的改动落点移进 T9 的 Files（`face/lifecycle.ts` 的 `#rulingsInputOf` 单行、`#rulingLine` 删除），pin 上移到 prompt 层（夹具带裁定，断言恰一行路径、零缩进正文行），`render.test.ts` 只留固定前缀句 · **F3** `rulings` 身份来源写清并同句复述于 T2 / T6 / T9 与 Constraints：`attribute(path.basename(the --reviews 载体))`、`op` 恒 `review`，加「派发轮 fix + 载体 review ⇒ 名字带 review 不含 fix」的 pin · **F4** T1 补齐 `Cli#baseBranchOf`，把「两处 / 三处」换成符号枚举（`InFlight.FILE` · `Artifacts#baseSet` / `#readBase` / `BaseGet` · `Cli#baseBranchOf` · `Ledger#readProgress` / `#writeProgress`）并让零差 pin 点名覆盖文件 · **F5** 两个不存在的测试路径重指既有文件（`face/__tests__/cli.test.ts` + `infra/__tests__/carrier-seal.test.ts`；`contract/__tests__/judge.test.ts` + `lint.test.ts`）并写明红态 · **F6** `SlugIndex.build` 写成「五处 → 三处」，结构断言改为「这三处之外无命中」 · **F7** `discarded()` 改为按根记录（三根各一对、共六值），点名两个判断各读哪些根，加「脏 specs × 干净 plans ⇒ plan 路径仍 `undeclared`」的混合格 · **F8** T4 补 `CDD_WARN: <plans 根> — <n> discarded candidate(s)` 的观测面与 P35 AC ③ 的 `cli.test.ts` 重锚，changeset 理由在 T11 点名 · **F9** `ArtifactRow` 按 spec §2.1 定形（有 `identifier?` / `policy?`、无 `attribution`），归主文法改写为三条规则 + 逐行答案表 + 枚举 pin，`identifier` 声明落在 `rulings` 行 · **F10** `CarrierRulings` 采用 spec 的 `read(sidecarPath, carrierPath)` / `verdict(sidecarPath, carrierPath, findingIds)`，渲染留在调用方 · **F11** 往返 pin 每 kind 跑两遍（带 / 不带 cycle），补 `rulings` 的无 cycle 形态与其 `misplaced` 收窄 · **F12** T9 补 `face/__tests__/face.test.ts` 与 `capsule.test.ts` 两个重锚站点，并明确 `FIX_READBACK_SUFFIX` 保留导出、改为值位模板 · **F13** T8 删掉计数，按 spec §3.1 枚举五个符号族（`#ownerRow` / `#lineWord` 按分支点），点名 `#LINE_CARRIER` 的 `spec` 替代项随 T5 消失，grep 门逐族各一条 · **F14** 新增 `.rulings.json` 字面与 `finding` / `id` 接受集的唯一构造点门（`__tests__/artifact-literal-door.test.ts`，T5 落） · **F15** T4 统一「字段退役」口径并给出 `planOrphanSpec(slug: string): string` 的报文，加 `infra/` 内派生零命中门 · **F16** T6 补迁移成对夹具（改名前后同一命令：拦 → `ok` + 一次 spawn） · **F17** 计划头补 `## Review Focus`（五类高发输入 + 期望行为 + 归口任务步骤） · **F18** T2 Step 1 从身份写断言（含无 cycle 形态）。 | [human] 裁定 · Claude（kairos:docs-fix · 2026-11-15） |
| v0.3 | 2026-11-15 | 计划评审 round 2 全量落地（F1–F10）：**F1（blocker）** 唯一构造点门按落地时点拆两半——T5 只落判定函数骨架与放行面（矩阵行 / 夹具豁免、`CarrierSeal` 零后缀字面）并写明红态，字面集封闭与 `finding` / `id` 接受集单源两条收紧移进 T9（`session/next.ts` 与 `carrier-rulings.ts` 才是两处第二声明真正消失之处，T9 经 T6 严格晚于 T5、加依赖会成环）· **F2** T1 补矩阵的构造点与注入面（命令前导一次构造、与 T3 之后的单建 `SlugIndex` 同址；`Lifecycle` opts / `Ledger` 构造器 / `CarrierSeal` 与 `BoardView` 显式入参；零模块级默认实例）并写进 Acceptance · **F3** `face/cli.ts` 写进 T4 Files（`#runBoard` / `#boardReadTable` / `#sceneOf` 与两个 `new PlanSource` 点），`PlanSource` 构造收索引成一条 Step 与 Acceptance · **F4** T9 点名 `Route` fix 臂的新值位字段与 `Router#next` 按载体身份算值、`RouteRenderer` 只填，补两条 pin（载体 `plan-review-1-a1.json` 印渲染名而非换尾名 · fix 行路径与门 `derived:` 逐字节相等）· **F5** `face/declare.ts` 写进 T7（`ARGV_CHANNEL.artifacts` + `board.keys`），checkable 加频道闭环门绿 · **F6** `brief` 的生产渲染同期入矩阵（`briefName` / `#brief` 只做委托，`CliGate#renderBrief` / `Preview#readsOf` 随改），T1 Step 4 的结构断言扩到 `tasks-{tasks}-brief.md` · **F7** legacy「派发不被拦」的 pin 落到 T8 的 `session/__tests__/handoff-plane.guard.test.ts`，Review Focus 归口改指真实落点 · **F8** T3 把「`attribute` 维持」改为「索引只答集合、名字 → 身份归 `DocDomain`」（索引侧零 `attribute`、`Attributed` 由 T1 定义），红态与 pin 归属写清 · **F9** T10 的 Consumes 按 spec §2.9 ④ 的三项顺序重写并点名 `#scanRoots`（`contract/invariants.ts:1478`）· **F10** T7 补 `invalid` 一格（`art:` 行带 reason、其余零字节变化）。 | [human] 裁定 · Claude（kairos:docs-fix · 2026-11-15） |
| v0.4 | 2026-11-15 | 计划评审 round 3 全量落地（F1–F9）：**F1** 矩阵的注入面从四个读面扩到**五个**——`NextStepRouter` 构造器也接注入 registry（T1 Objective / Files / Produces / Step 5 / Acceptance 同步），`Ledger#router` 从字段初始化改为构造体内赋值（字段初始化先于构造体，registry 又是构造器入参），`face/cli.ts:1363` 与 `session/run.ts:404` 传同一实例，T9 的 `Router#next` 算值接这条注入 · **F2** 唯一构造点门的扫描面写成**生产源码**（去注释 + 排除 `__tests__`，沿用 `src-next/__tests__/support/strip-comments.ts` 的既有姿势），测试经夹具助手取实例——按字面的「`src-next` 内恰一处」不可满足（T1 自己的测试就要实例化 registry）· **F3** 无 cycle 形态只断**身份**：`draft` 与 `final` 本就同名（既有 pin `round-naming.test.ts:99-105`）、`kind` 归一 `draft`，不再对 `final` 那一格断言 kind；round 域 `attribute`（渲染名反解）明确划给 T2，T5 只加 `misplaced` 一格 · **F4** T5 点名删除拼写知识 #1 / #2 的两族六个符号（`carrierPattern` · `CARRIER` · `isCarrierName` · `#WAVE_CARRIER` · `#LINE_CARRIER` · `#handoffOwner`），补逐符号 grep 门与对应 Step，`round-naming.test.ts:515-540` 的 `minted` / `neighbours` 断言按矩阵归属重锚；T8 的「若 `CARRIER` 随拆」条件式改为明写「由 T5 整族删除」· **F5** `SlugIndex.build` 的「一处」定义成每个命令的唯一构造入口（私有 `#indexOf(root)`，`#runBoard` / `#sceneOf` / `#runBase` 共用），「单建一次」= 同一命令内不再二建而非三条命令共享同一对象；Objective / Files / Produces / Step 5 / Acceptance 同步 · **F6** T6 补 §4.5 的 `unreadable` 一格（推导名在盘上但 IO 失败 ⇒ `invalid(reason: "unreadable")`，`art:` 行与门都不当缺席），写进 Objective / Files / Step / Acceptance · **F7** 三处符号枚举的 `BaseGet` 改为 `Artifacts#baseGet`（树里真实存在的成员）· **F8** T11 的 README pin 从目录改为 `packages/kairos/tests/presentation-surface.test.ts`（镜像集 + 逐镜像标题序列）· **F9** 「skill 文本零 `.rulings.json` 字面」落进 T11 的 Objective / Files / Step / Acceptance，门挂在 `skill-surface-consistency.test.ts`（今日零命中是基线）。 | [human] 裁定 · Claude（kairos:docs-fix · 2026-11-15） |
