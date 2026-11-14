---
title: '引擎文档工具（Engine Doc-Tooling）— P35 计划：plan 读取收权（一份读取 · 一个失败值 · 一条拒绝通道）'
doc-type: plan
version: v0.15
date: 2026-11-14
slug: 2026-10-10-engine-doc-tooling-p35
base: develop
---

## Constraints

- **逐字取 spec**：本计划只实现 `docs/kairos/specs/2026-10-10-engine-doc-tooling-p35-design.md` **现行 version v0.21** 所指的面；spec 版本一变，本约束的字面同笔改。
- **plan grammar 语义不动**：`#### DependsOn` 仍只许一节，其余重复节规则与报文措辞逐字节保持；`parse(): PlanParsed` 的签名不变。
- **反查阻塞随读取值走**：相位没有 plan 是合法状态（读作 `undeclared`、渲 `(none)`）；plan 的 slug 找不到 `<slug>-design.md` 是身份破损（主编排器写错），阻塞经 `PlanRead.refusal(words)` 落既有不挂门腿（`reason: doc-contract`）——`PlanRead#orphan()` 只在 `readPath` 的值上可能非 `null`（`ready` 且「派生 spec 不存在」或「plan 自身无 `slug`」）；`readFor(entry)` 恒回 `null`——entry 就是身份文档，`spec-absent` 结构性不可达，`entry.slug === null` 已归 `undeclared`。**不登记 doc-contract 规则、不产 `Finding`、`kind` 词法零新增**；反查**只探存在性**（`DocFs.exists`），不得用 `phaseSpecsOf` / `planOf` 反向拼装。板面渲 `! no-spec` + §2.5 的 hop-less `next:` + 一行 stderr `CDD_WARN:` 且 exit 0。
- **`doc-contract` 判定语义不动**：既有 front-matter 拒绝报文逐字节不变；不新增 gate id、不新增 reason token、不新增 station kind、不动 P27 的十三 token。
- **不动收敛主线**：`session/next.ts` 的 `PIPELINE_NEXT`、`NextStepRouter` 的分级判据、`TargetFaceTable` 的三 kind 与 `session/dispatch-authority.ts` 的 station 词表**零改动**。`BoardNext.of` 的短路用的是既有的 hop-less 分支（`next === null`），不是新路由。
- **一份读取**：`new PlanDocType("plan")` 的合法构造点只留 `contract/doc.ts` 的登记行与 `infra/plan-source.ts`；`BriefRenderer` 的第二处解析**删除**，不开白名单。
- **值携带行为**：`PlanRead` 的访问器各承担一种语义（`text` / `doc` / `graph` / `orphan` / `waves` / `degradedWaveRow` / `cell` / `planLine` / `specLine` / `warnLine` / `refusal` / `failure` 共十二个，外加 `path()`），消费点不写 `switch (read.kind)`；生产者的本分只是降级字面量（健康行 / 健康格返回 `null`，装配者按今日路径渲染）。
- **不重写扫描谓词**：`infra/slug-index.ts` 的 `#scanRoot` 不为 plan 路径新增任何字段——路径由 slug 派生（`ENGINE_RUNTIME.docRoots.plans/<slug>.md`），索引仍不接受不可读候选；`progress` 账本口径与 `recordPlanTasks` 形状不动；`session/run.ts` 的 stall 语义保留。
- **不新增 CLI 动词或旗标**，不重排 board 既有列与 `next:` / `reason:` 字节；`CDD_WARN:` 一律 stderr。
- **不引入新依赖**；changeset 只 `@oscaner-skills/cdd-engine` **minor**（D74）；不发布；波宽 ≤ 3；零模块级裸函数，新类按 OOP-first 落。

## Review Focus

- **「健康字节不变」被写成排除法**：AC 里凡是「除 X 外逐字节相同」，都要先问 X 是否枚举完整——argv 面与派生面的变化点都是**恰好三处**（plan 行、波次格、`next:`），多一处少一处都是缺陷。
- **生产者签名产不出既有字节**：`degradedWaveRow` / `cell` 若只声明四种降级语义，健康 doc 行（`W1 {…}`）与健康程序格（`W1…`）就没有生产者，实现出来会静默丢列。两者的 `null` 逃逸是契约的一部分，不是实现细节。
- **拒绝点的位置被 doc-shape 闸挡住**：`wave` 面是 `audit: { kind: "task-graph" }`、`ctx.doc === null`，把拒绝塞进 `TargetFaceTable.isDocShape` 块内等于 wave 面永远不拒。
- **反查被写成内容判定，或被挂到够不着的位置**：反查是读取事实，只许 `DocFs.exists` 探 `<slug>-design.md` 在不在——用 `phaseSpecsOf` / `planOf` 反向拼装，会把「存在但读不出」误判成孤儿，凭空红掉健康相位；它也不许挂到 `docKey === "plan"` 的规则上，`wave` / `branch` 面的 `audit.kind` 是 `task-graph` / `branch-tree`，那条规则够不着它们，阻塞必须随 `PlanRead.refusal(words)` 在不挂门腿上到达。
- **无身份的值被包成 `DocEntry`**：空 slug 会让 `#entryMark` 回 `MARK_SLUG_MISSING`、`#docCell` 回 `blocked: true`，`#nodeBoard` 的 `return blocked ? 2 : 0` 把降级误判成 exit 2。

---

### Task 1: `DocSyntaxError` 成为 contract 面的值

#### Objective

把「plan body 文法坏结构」从裸 `throw new Error` 升级为类型化错误，并在**有消费者的一层**物化成 `Finding`。`contract/doc.ts` 的 `DocType` 基类旁定义 `DocSyntaxError`（携带 `field` / `message` / `fix`），不设 plan 专属类；`contract/task-block-grammar.ts` 的 `TaskBlockGrammar#assertNoDuplicateKeys` 改抛它，`parse(): PlanParsed` 的签名不变，`assert` 从此只承载编程不变量。同时把 `taskHeadingPattern()` 从 `BriefRenderer` 迁回文档类型——它是**文档的属性，不是渲染器的**：`DocType` 已暴露 `readonly slices: DocSlices`（接口声明在 `contract/project.ts:172`，由 `Projector#projectDocSlices`（`:466`）从 plan registry 的 slice 表填），该访问器（`render/brief.ts:65` 的 `this.#parser.slices.slices.find((slice) => slice.anchor === "### Task N:")?.valuePattern`）搬进 `DocSlices`、经 `PlanDocType#slices` 暴露，两条断言（pattern 仍匹配 `### Task 3:` / `### Task 12:`）随访问器进 `contract/__tests__/doc.test.ts`。判定面按 D26「一事实一处」只在 `validate` / `validateLedger` 物化 `Finding`：`#contextOf` 只负责把 `DocSyntaxError` 带出来（它返回 `JudgeContext`）。投影同一性不许破：`DocSlices` 每次投影都是新对象，而 `contract/__tests__/project.test.ts:441` 用 `expect(projected.slices).toEqual(PROJECTOR.slices())` 比两次独立投影，`toEqual` 按**函数同一性**比函数值——因此 `taskHeadingPattern` 的实现写成**模块作用域的箭头常量**（不在投影里新建闭包；`check:no-bare-functions` 只禁 `function` 声明，箭头常量合法），`Projector#projectDocSlices` 每次投影都塞**同一个实例**，两次投影的比较才仍成立。

#### Files

- Modify: `packages/cdd-engine/src-next/contract/doc.ts`（`DocSyntaxError` 类；`PlanDocType` 继续以 `readonly slices: DocSlices` 暴露表，表本身不在此文件声明）
- Modify: `packages/cdd-engine/src-next/contract/project.ts`（`DocSlices` 接口（`:172`）增 `taskHeadingPattern(): RegExp | undefined`；`Projector#projectDocSlices`（`:466`）从 plan registry 的 slice 表派生该值，与其余 slice 同处一处投影；实现是**模块作用域的箭头常量**，每次投影塞**同一个实例**（`contract/__tests__/project.test.ts:441` 的 `toEqual` 按函数同一性比））
- Modify: `packages/cdd-engine/src-next/contract/task-block-grammar.ts`（`#assertNoDuplicateKeys` 抛 `DocSyntaxError`，`field` 为该节标题、`fix` 为既有修复提示的文字化）
- Modify: `packages/cdd-engine/src-next/contract/judge.ts`（`#contextOf` 不捕获；`validate`（`:144`）/ `validateLedger`（`:157`）包 try/catch，`DocSyntaxError` → 一行 `Finding`，`path` 取 `ContractInput.path`）
- Test: `packages/cdd-engine/src-next/contract/__tests__/doc.test.ts`（`PlanDocType#slices.taskHeadingPattern()` 匹配 `### Task 3:` / `### Task 12:`，两条契约侧断言在本任务新写入；`render/__tests__/render.test.ts:849-850` 的同名两条随转发删除，归 Task 3）
- Test: `packages/cdd-engine/src-next/contract/__tests__/task-block-grammar.test.ts`（重复 `#### DependsOn` 抛 `DocSyntaxError`，`field` / `message` / `fix` 三字段非空；既有报文措辞逐字节不变）
- Test: `packages/cdd-engine/src-next/contract/__tests__/judge.test.ts`（`validate` 对坏 body 产一 Finding：`path` 非空且等于契约路径、`field` 指到该节、`kind === "doc-syntax"`、无异常逃逸）

#### Consumes

- `contract/doc.ts` 的 `DocType` / `DocSlices` / `PlanDocType` 既有形状
- `contract/invariants.ts:70-81` 的 `Finding` 接口（`path` / `field` / `message` / `fix` / `kind`）
- `contract/judge.ts:24-36` 的 `ContractInput`（`path` 是 `Finding.path` 的既有归因源）

#### Produces

- `class DocSyntaxError extends Error { readonly field: string; readonly message: string; readonly fix: string }`（`contract/doc.ts`，`DocType` 旁）
- `DocSlices#taskHeadingPattern(): RegExp | undefined`
- `contract/judge.ts` 的 `validate` / `validateLedger` 对 `DocSyntaxError` 的 `Finding` 物化（`kind: "doc-syntax"`）

#### Steps

- 写失败测（grammar）：一份 `#### DependsOn` 出现两次的 plan 文本，`new PlanDocType("plan").parse(lines)` 抛出的错误 `instanceof DocSyntaxError` 且三字段非空 — checkable: 定向 vitest FAIL（今日抛裸 `Error`）
- 写失败测（judge）：同一份文本喂 `validate`，返回恰一行 `Finding`，`kind === "doc-syntax"`、`path` 等于传入的契约路径 — checkable: FAIL（今日 `#contextOf` 裸抛，判定门被打死）
- 写失败测（slice 访问器）：`new PlanDocType("plan").slices.taskHeadingPattern()` 匹配 `### Task 3:` 与 `### Task 12:` — checkable: FAIL（今日只在 `render/brief.ts` 的私有转发里）
- 实现 `DocSyntaxError` 并让 `#assertNoDuplicateKeys` 抛它 — checkable: grammar 测 PASS
- 让 `#contextOf` 不捕获、`validate` / `validateLedger` 包 try/catch 物化 `Finding` — checkable: judge 测 PASS · `contract/__tests__/judge.test.ts` 既有用例全绿
- 实现 `DocSlices#taskHeadingPattern`，在 `contract/__tests__/doc.test.ts` 写入两条断言（render 侧的同名两条由 Task 3 随转发一起删除，本任务不碰该文件） — checkable: doc 测 PASS
- 投影同一性回归：`projectDocSlices` 两次独立投影的 `slices` 仍 `toEqual` 相等（`taskHeadingPattern` 是模块作用域箭头常量，函数值按同一性比） — checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/contract/__tests__/project.test.ts` exit 0
- 全量回归 — checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/contract` 与 `pnpm exec tsc --noEmit -p packages/cdd-engine` 均 exit 0

#### Acceptance

- 坏 plan 文法抛 `DocSyntaxError`（`field` / `message` / `fix` 非空），`parse(): PlanParsed` 签名不变，既有报文措辞逐字节不变。
- `validate` 对坏 body 产一行 `Finding`：`kind === "doc-syntax"`、`path` 等于 `ContractInput.path`、`field` 指到该节，无异常逃逸；`#contextOf` 本身不物化。
- `PlanDocType#slices.taskHeadingPattern()` 可被外部调用并匹配 `### Task 3:` / `### Task 12:`（`contract/__tests__/doc.test.ts` 两条断言，本任务只认契约侧）；`render/brief.ts` 的转发与它的两条 render 断言归 Task 3，两任务不互相假设对方先做。
- `contract/__tests__/project.test.ts` 在 T1 结束时绿：`taskHeadingPattern` 是模块作用域箭头常量、每次投影塞同一实例，`expect(projected.slices).toEqual(PROJECTOR.slices())` 仍成立（函数值按同一性比）。

#### DependsOn

none

---

### Task 2: `infra/plan-source.ts` — 一个深类、两个入口、一个携带行为的值

#### Objective

把 plan 的 read + parse + classify 收进一处：新增深类 `PlanSource`（家：`infra/plan-source.ts`），构造注入 `DocFs`（默认 `NodeFs`）**与 `RepoRoot`**——路径一律过 `RepoRoot` 的转换对 `this.#root.resolve(this.#root.relativize(rel))`（`RepoPath` 带品牌，`relativize` 是唯一构造入口、`resolve` 是唯一擦除点；`NodeFs` 吃字面路径并按 `process.cwd()` 解析，不经这一对，仓库子目录下的健康 plan 会被读成 `unreadable` / `io`，静默违反「健康 dispatch 报文逐字节不变」），两个入口 `readFor(entry)`（派生面：`entry.slug` → `${ENGINE_RUNTIME.docRoots.plans}/${slug}.md`，先探存在性——不存在即 `undeclared`，存在才读，`read` 回 `null` 即 `unreadable`/`io`）与 `readPath(rel)`（argv 面），同一个 `PlanRead`。派生不咨询索引的内容谓词，因此「存在但读不出」零声明即可达 `cause: "io"`；slug 是唯一身份，路径不进 front matter（见 spec §2.1「没有声明键」）。判别值三态 `undeclared` / `unreadable`（`cause: "io" | "syntax"`）/ `ready`（`path` / `text` / `doc` / `graph`，`graph` 由同一次解析 eager 派生）。spec §2.1 的三态以**类**实现（私有判别字段 + `kind` getter + 十二个访问器加 `path()`），消费面的契约与 spec 逐条一致，不用裸判别联合让七个调用点各写一遍 `switch`。实例在**命令前奏**（`#rootOf()` 之后）构造一次、每命令一实例，经参数下行到 `Cli#runBoard` / `Cli#sceneOf` / `PreFlight`；`Cli.create()` 阶段尚无根，不在那里构造——「一份读取」的口径是**每命令一实例、每文档一次读**，不是进程级单例。`path()` 的返回类型写死 `string | null`：`undeclared` 回 `null`，`unreadable` 与 `ready` 回那条路径（读不出不等于没有路径）——今日「无 plan 面」的判据就是 `=== null`（`session/pipeline.ts` 的 `#planState` 与 `branchLineOpen`），回空串会把 plan 面从「无」变成 `{ type: "plan", id: "", plan: "" }`，在 argv 字节不变的幌子下改掉派生路由。值**携带行为**：`text()` / `doc()` / `graph()` / `orphan()` / `waves()` / `degradedWaveRow(words)` / `cell(words)` / `planLine(words)` / `specLine(words)` / `warnLine(words)` / `refusal(words)` / `failure()`（十二个，外加 `path()`），消费点不写 `switch (read.kind)`。生产者的本分只是降级字面量：`degradedWaveRow` 与 `cell` 在 `ready` 且有波次时均返回 `null`（健康行 / 健康格归装配者）。`failure()` 是 spec §2.2「`unreadable` 自带 `path` / `field` / `message`」的可观测取法，不是新增契约面：non-ready 非 `null`、`ready` 回 `null`；私有状态因此存 `message`（来自 `DocSyntaxError#message`）与 `field: string | null`（来自 `DocSyntaxError#field`，`io` 为 `null`），`refusal(words)` 用它拼报文（含路径与字段名）、`warnLine()` 用它拼诊断行。路径不来自作者：派生值天然是 repo 相对形式，因此没有域可校、没有作者输入可越界。`PlanReadWords` 是 `infra/plan-source.ts` 自己声明的词表端口，由 `face/words.ts` 的 `Words` 实现。

反查是这次读取的一部分：slug 派生出的 `<slug>-design.md` 是否存在，决定这份 plan 有没有命名一枚相位——它是**读取事实**，不是 doc 形状的违规（不登记规则、不产 `Finding`、`kind` 词法零新增）。

#### Files

- Add: `packages/cdd-engine/src-next/infra/plan-source.ts`（`PlanSource` + `PlanRead` + `PlanReadWords` 端口；不做路径校验——路径由 slug 派生，没有作者输入可校；无模块级裸函数，`catch` 不得为空；另出 `static undeclared(): PlanRead` 工厂——回三态里的 `undeclared`、不触任何文件读取，供三个 doc 面装配取值；构造注入 `DocFs` + `RepoRoot`，每次 `DocFs` 调用前过 `root.resolve(root.relativize(rel))`，`failure().path` 仍回仓库相对形式）
- Modify: `packages/cdd-engine/src-next/face/words.ts`（实现 `PlanReadWords` 七个成员：`planReadWord(cause)` 只承担 `io` / `syntax`；`planEmptyWord()` 回 `(empty plan)`；`cellEmpty` 是**新增**的未声明程序格字面（`""`），与 `planEmptyWord()` 并列而**不是**既有成员——`grep -rn cellEmpty packages/cdd-engine/src-next` 今日零命中；`planOrphanSpec(slug, specPath)` / `planSlugMissing()` / `planOrphanWord()` 三条也是本次新增；`warnPrefix` 取既有 `warn: "CDD_WARN:"` 行）
- Test: `packages/cdd-engine/src-next/infra/__tests__/plan-source.test.ts`（三态 × 两个入口 · 派生边界（slug 为 null / 文件不存在 / 存在读不出）· 访问器语义 · 每次读取只解析一次；全部按**注入式**配方 `new PlanSource(injectedFs, new RepoRoot(tmpDir))` 构造——`injectedFs` 用既有的 memory fs 或根锚定的真实 fs；无参构造 + 默认 `NodeFs` 在 `session/__tests__/preflight.test.ts` 的 `gitRepo()`（`mkdtempSync + git init`、全程不 `chdir`）里只会读 `process.cwd()` 下不存在的文件，产不出 `ready`）

#### Consumes

- `contract/invariants.ts` 的 `DocFs` / `NodeFs`（T1 未动，只读用）
- `infra/slug-index.ts` 的 `DocEntry.slug`（相位文档的身份，只读）与 `infra/doc-roots.ts` 的 `ENGINE_DOC_ROOTS.plans`（全库唯一根值，`infra/runtime.ts` 以 `ENGINE_RUNTIME.docRoots` 暴露）
- `contract/doc.ts` 的 `DocType` 登记表 `docTypeParsers` 与 `DocSyntaxError`（Task 1）、`TaskGraph`（`contract/task-blocks.ts`）
- `face/words.ts` 的 `Words`（被实现方）

#### Produces

- `class PlanSource { constructor(fs: DocFs = new NodeFs(), root: RepoRoot) ; readFor(entry: DocEntry): PlanRead ; readPath(rel: string): PlanRead }`（`root` 必填：根是逐命令事实，没有「无根」的构造）
- `static PlanSource#undeclared(): PlanRead`（工厂：回 `{ kind: "undeclared" }` 的那枚值，不读文件；Task 3 的 doc 面装配唯一使用方）
- `class PlanRead { kind ; path(): string | null ; failure(): { path: string; field: string; message: string } | null ; text(): string | null ; doc(): PlanParsed | null ; graph(): TaskGraph | null ; orphan(): { cause: "spec-absent" | "slug-absent"; specPath: string | null } | null ; waves(): readonly TaskBatch[] ; degradedWaveRow(words): string | null ; cell(words): string | null ; planLine(words): string | null ; specLine(words): string | null ; warnLine(words): string | null ; refusal(words): { gate: "doc-contract"; reason: "doc-contract"; message: string } | null }`
- `interface PlanReadWords { planReadWord(cause: "io" | "syntax"): string ; planEmptyWord(): string ; planOrphanSpec(slug: string, specPath: string): string ; planSlugMissing(): string ; planOrphanWord(): string ; cellEmpty: string ; warnPrefix: string }`（七个成员一次写完，不再拆成「既有 + 新增」两处清单）
- `orphan()` 由 `cell` / `degradedWaveRow` / `planLine` / `specLine` 折叠成同一字面 `! no-spec`（`planOrphanWord()` 是它的唯一来源；`(empty plan)` 只来自 `planEmptyWord()`，`""` 只来自 `cellEmpty`）
- `orphan()` 只在 `readPath` 的值上可能非 `null`；`readFor(entry)` 恒回 `null`（entry 就是身份文档，`spec-absent` 结构性不可达，`entry.slug === null` 已归 `undeclared`）——派生面零探针，argv 面一份 plan 一次
- `failure()` 的三项取法固定：`path` 恒为该 plan 的仓库相对路径（non-ready 也有，来自派生面或 argv 读取点）；`field` 取 `DocSyntaxError#field`（`io` 为 `null`）；`message` 取 `DocSyntaxError#message`（`io` 为读失败原因）。`refusal(words).message` 拼成 `<planReadWord(cause)> <path>: <field>`（`io` 的 `field` 为 `null`，此时只拼 `<word> <path>`，不写出 `null`）；`warnLine()` 与它同源

#### Steps

- 写失败测（三态）：派生路径不存在 → `undeclared`；派生路径存在但 `DocFs.read` 回 `null` → `unreadable`/`io`；存在、读得到、文法坏 → `unreadable`/`syntax`，且 `failure()` 非 `null`、`failure().field` 等于重复节标题、`failure().path` 等于该 plan 路径、`refusal(words).message` 同时含路径与字段名；读得到且合法 → `ready` 且 `graph()` 的 wave 数与 hand-count 相同 — checkable: 定向 vitest FAIL（今日无该类）
- 写失败测（两入口同源）：同一份好 plan，`readFor`（slug 派生）与 `readPath` 产出的 `path` / `waves()` 逐项相同 — checkable: FAIL
- 写失败测（访问器值级表 · `text()` / `doc()` / `graph()`）：`ready`（含零 task block）非 `null`，`undeclared` 与两个 `unreadable` cause 一律 `null` — checkable: FAIL
- 写失败测（访问器值级表 · `orphan()`）：派生 spec 缺失 → `{cause:"spec-absent", specPath}`；plan 自身无 `slug` → `{cause:"slug-absent", specPath:null}`；健康 `ready` 与非 ready 一律 `null` — checkable: FAIL
- 写失败测（访问器值级表 · `waves()`）：`ready` 且有 task block 回非空数组；`ready` 零 task block、`undeclared`、两个 `unreadable` cause、孤儿一律空集 — checkable: FAIL
- 写失败测（访问器值级表 · `degradedWaveRow()` / `cell()`）：`undeclared` → `(none)` / `cellEmpty`；`ready` 零 task block → 两者均 `(empty plan)`；`unreadable` → `! unreadable` / `! unparseable`（按 cause 各一格）；`ready` 且有波次且非孤儿 → 两者均 `null`；孤儿（含零 task block）→ 两者均 `! no-spec`（孤儿判定**先于** `(empty plan)`） — checkable: FAIL
- 写失败测（访问器值级表 · `planLine()` / `specLine()`）：`planLine` 对两个 `unreadable` cause 回 `<repo 相对路径> · <标记>`；对 `undeclared` 回 `null`（plan 行照旧走索引派生项）；**`ready` 一律回 `<repo 相对路径>`（裸、无标记）**；孤儿回 `<repo 相对路径> · ! no-spec`。索引成员性不进这张表，归装配者：`readFor(entry: DocEntry)` 不接受 `SlugIndex`（Acceptance 明写「`SlugIndex` 不出现在 `readFor` 的签名里」），所以「`ready` 且已索引」是 `PlanRead` 观测不到的限定语；Task 5 的优先级已写死「`ready` 且解析到索引项 → `#docCell`」，裸路径只会在未入索引那一格出现——判据在装配者手里，值就只报它看见的事实。`specLine` 只在孤儿回 `! no-spec`，健康 / 非 ready / 未判态一律 `null` — checkable: FAIL
- 写失败测（访问器值级表 · `warnLine()` / `refusal()`）：`warnLine` 对 `undeclared` 与健康 `ready`（含零 task block）回 `null`，对两个 `unreadable` cause 与孤儿回带 `warnPrefix` 的一行；`refusal` 对 `ready` 与 `undeclared` 回 `null`，对 `unreadable` 与孤儿回 `gate: "doc-contract"` / `reason: "doc-contract"` — checkable: FAIL（把这张表删掉，`infra/__tests__/plan-source.test.ts` 应当红）
- 写失败测（派生边界）：`entry.slug === null` → `undeclared`；slug 有值但 `plans/<slug>.md` 不存在 → `undeclared`（今日 `(none)` 的语义）；存在但 `DocFs.read` 回 `null` → `unreadable`/`io`，且该路径**从未经索引**取得（`SlugIndex` 不在 `readFor` 的入参里）— checkable: FAIL
- 写失败测（根锚定）：`process.cwd()` 不在 `tmpDir` 下（全程不 `chdir`），`new PlanSource(injectedFs, new RepoRoot(tmpDir))` 的两入口都读到同一份 plan、`failure().path` 仍是仓库相对形式；把根换成另一个空目录则同一份 plan 读成 `unreadable`/`io`（证明路径确实经 `RepoRoot` 解析，而不是 `process.cwd()`） — checkable: 定向 vitest FAIL
- 写失败测（`path()`）：`undeclared` ⇒ `path() === null`；两个 `unreadable` cause 与 `ready` 回那条仓库相对路径 — checkable: FAIL
- 写失败测（一次解析）：一次 `readPath` 只产生一次 `PlanDocType#parse`（用计数 `DocFs` + 计数解析器 spy 断言） — checkable: FAIL
- 实现 `PlanSource` / `PlanRead`（两个入口、三态分类、eager 派生 `graph`；类上只有这两件事，不做路径校验） — checkable: 上述四组 PASS
- 在 `face/words.ts` 实现 `PlanReadWords` 七行，`planReadWord` 不接受 `planEmpty` 语义 — checkable: 词行断言 PASS · `face/__tests__/words.test.ts` 既有用例全绿
- 出 `PlanSource.undeclared()` 工厂（Task 3 的 doc 面装配消费它；生产者侧一条单测：回 `kind === "undeclared"` 且不调 `DocFs` 的任何方法） — checkable: `infra/__tests__/plan-source.test.ts` PASS
- 全量回归 — checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/infra` 与 `pnpm exec tsc --noEmit -p packages/cdd-engine` 均 exit 0
- 写失败测（反查两因）：`plans/x.md` 的 slug 为 `y` 而 `specs/y-design.md` 不存在 → `orphan()` 回 `{cause:"spec-absent", specPath}`；`specs/y-design.md` 存在 → `orphan()` 回 `null`；plan 自身无 front matter `slug` → `{cause:"slug-absent", specPath:null}` — checkable: 定向 vitest FAIL（今日无此概念）
- 写失败测（只探存在性）：`specs/y-design.md` **存在但 `DocFs.read` 回 `null`** → `orphan()` 仍回 `null`（不因读不出而误判成孤儿） — checkable: FAIL（用索引反向拼装会误判）
- 写失败测（派生面不反查）：`readFor(specEntry)`——该 spec 声明 `slug: X`、文件名非 `<slug>-design.md`（`#scanRoot` 索引任何可读 `*.md`，`-design` 只是布局惯例）、`plans/X.md` 健康 → `kind === "ready"` 且 `orphan() === null` — checkable: 定向 vitest FAIL（派生面也探会把健康 pair 判成假孤儿）

#### Acceptance

- 三态与两入口：`readFor` / `readPath` 走同一条读 + 解析 + 三态分类路径（反查不在这条共用段里，只在 `readPath` 的本入口追加），同一份 plan 产出的 `path` / `waves()` 逐项相同；每次读取只解析一次（`graph` 是 eager 派生，不是第二重惰性事实源）。
- 派生边界：slug 为 `null` 或派生路径不存在 → `undeclared`（今日字节）；派生路径存在但读不出 → `unreadable`/`io`——「存在但读不出」不靠任何作者声明即可达，`SlugIndex` 不出现在 `readFor` 的签名里。
- `degradedWaveRow` / `cell` 在 `ready` 且有波次时均返回 `null`（健康字节归装配者）；四语义字面量各由一条断言覆盖，`(empty plan)` 只取自 `planEmptyWord()`、`""` 只由 `cellEmpty` 产出（程序面上真 undeclared 的格）。孤儿判定**先于** `(empty plan)`：`ready` 且零 task block 的孤儿两面都渲 `! no-spec`；访问器值级表逐格落在 `infra/__tests__/plan-source.test.ts`，删表即红。
- `failure()` 把「`unreadable` 自带 `path` / `field` / `message`」落成唯一取法（non-ready 非 `null`、`ready` 回 `null`）：`field` 来自 `DocSyntaxError#field`、`io` 为 `null`；`refusal(words).message` 与 `warnLine()` 都经它拼出，报文含路径与字段名。
- 文件内无空 `catch`，无模块级裸函数；消费方不需要 `switch (read.kind)` 即可拿到所需事实。
- 反查：`orphan()` 只在 `readPath` 的值上可能非 `null`——`readFor(entry)` 恒回 `null`（entry 就是身份文档，`spec-absent` 结构性不可达，`entry.slug === null` 已归 `undeclared`），派生面因此零探针、不会把健康 pair 判成假孤儿；`readPath` 上仅当「派生 spec 不存在」或「plan 自身无 `slug`」时非 `null`，且只用 `DocFs.exists`；存在但读不出 / 未被索引收进去的 spec 不算孤儿（未判态）。

#### DependsOn

1

---

### Task 3: brief 收值 + 场景切换——三个公开面收 `(text, doc, tasks)`，`WorkScene.planText` 退役为 `plan: PlanRead`

#### Objective

删除 `render/brief.ts` 的第二处 plan 解析，并**在同一次原子改动里**退掉场景的第二重事实源——两者拆开则无论怎么排波次都编译不过：brief 的 `(text, doc, tasks)` 要 `PlanRead`，而 `WorkScene` 一天不换成 `plan: PlanRead`，`face/gate.ts:145` 就仍在读 `planText`（先改 brief 则取 `scene.plan` 时它还不存在，先退役字段则 `:145` 还在读它）。

`BriefRenderer` 的 parser 协作者整体删除（`constructor(parser = new PlanDocType("plan"))`，默认参数一起没了），`render` / `taskBody` / `extract` 三面同形改收 `(text, doc, tasks)`，`text` 取自 `PlanRead.text()`、`doc` 取自 `PlanRead.doc()`；`#taskBody` 内的 `const parsed = this.#parser.parse(planContent.split("\n"));`（`:70`）删除，块从 `doc.taskBlocks` 取。裸行切片（按 `TaskBlock.range` 取任务段）与 `## Constraints` 节仍读 `text`——brief 被哈希（D30 / P29），按 `fields[].lines` 重建 heading 字节会让已评审波次凭空重开。场景切换与 brief 同批落地：`WorkScene.planText: string | null`（字段声明在 `face/cli.ts:144-145`）退役为 `plan: PlanRead`，`PreFlightContext.planText`（`session/preflight.ts:137`）同批换成 `plan`——两处都只改值形状，判定语义归 Task 4；但 `PreFlightContext` 的三处既有读者必须由本任务机械适配（见下段），否则重命名后本任务的 `tsc` 红在方法体未改上；供值点五处随动——`face/gate.ts:145` 的 `render`、`face/lifecycle.ts:861` 的 `taskBody`、`session/ledger.ts:941` 的 `taskBody` 三个公开面调用，外加 `extract` / `taskBody` 两处内部委托；`session/ledger.ts` 的 `#briefRevision` 因此不再自己 `readFileSync`，改由既有调用链（`session/run.ts` 的 `#recordReviewedWaveBrief` → `recordReviewedBrief(waveKey, …)` → `#briefRevision`）把场景里的 `PlanRead` 传下去；`face/cli.ts` 的两处供值（`:674` 的 `vet` 上下文、`:1285` 的场景装配）同批换成 `plan`。切换写法写死：调用点先以 `read.kind === "ready"` 守卫，再在 `ready` 分支里取 `text()` / `doc()`（该分支里两者必非 `null`），**不写 `!` 非空断言、也不写 `?? ""`**——后者会把「读不出」伪装成空文档（全相位唯一例外是 `#ledgerInputOf` 的 `content` 入参，理由见下段）。

`PreFlightContext` 换名的**三处既有读者由本任务机械适配**，语义与今日逐字等价——判定语义仍归 Task 4，这里只改形状、不改行为：① graph 门 `session/preflight.ts:223-227` 的守卫与解析行按**钉死形状**改编：`if ((ctx.type === "wave" || ctx.type === "plan") && ctx.plan.kind === "ready") { gates.push("graph"); checked.push("graph"); const graph = ctx.plan.graph(); if (graph !== null) { const issues = graph.validate(); … } }`——块内两条 push 与 `validate()` 之后的分类支逐字节不动，**只**换 `planText` 守卫与 `:225` 的 `new TaskGraph(new PlanDocType("plan").parse(ctx.planText.split("\n")))`（改后形状：`const graph = ctx.plan.graph(); if (graph !== null) { … }`）；`graph()` 的返回型是 `TaskGraph | null`，`!== null` 就能收窄，因此**不需要** `kind` getter 的类型收窄、也不写 `!`；今日 `planText === null` 即「读不出」、`ready` 即「读得出」，而 `graph` 由同一次解析 eager 派生，故 `graph() !== null` 与之在 `ready` 上同真——语义等价，而残余的 `new PlanDocType("plan")` 在 T3 消失；② `#ledgerFactsOf`（`:507-509`）改 `const text = ctx.plan.text(); if (ledger === null || text === null) return null;`，再 `new PlanDocType("plan").parse(text.split("\n"))`——不用 `!`、不用 `?? ""`；③ `#ledgerInputOf`（`:577-585`）的 `content: ctx.planText ?? ""` 改 `content: ctx.plan.text() ?? ""`。③ 是**全相位唯一允许的 `?? ""`**：该字段是 ledger 的 content 入参，今日对「无 plan」就取空串，改成别的形状反而改变既有账本字节——后来的评审不要把它读成违反上面那条「不写 `?? ""`」的回归。Task 4 仍拥有这三处的**判定语义**（graph 门的 ready-only 记账、`#ledgerFactsOf` 收 `PlanRead`、拒绝腿），只改行为不改形状。

`planText` 还有第四处读者归本任务：`face/cli.ts:706-711` 的 usage 守卫（`group` 与 `planIds` 的成员判定）改吃场景里那份值——`const doc = scene.plan.doc(); const planIds = doc === null ? [] : doc.taskBlocks.map((block) => block.id);`。今日 `scene.planText !== null` 在 argv 面对 `ready` 同真，在 doc 面因本任务传 `PlanSource#undeclared()` 而 `doc() === null` → `[]`，与今日 `null` 同假，字节面不变；`:709` 的 `new PlanDocType("plan").parse(…)` 随之消失，`face/cli.ts:52` 的 `PlanDocType` import 也随之无主而删除。**这段的唯一归属人是本任务**：`ready` 才跑 planIds 的语义由 `doc() === null` 自动成立，不需要第二个任务再动它。

场景面的**读取与解析转换**同属本任务（它就是「场景切换」的落点，`#sceneOf` 的两行正是本相位要收权的那两行）：`PlanSource` 在**命令前奏**（`#rootOf()` 之后）构造**一次**、每命令一实例，经参数下行到 `#sceneOf` / `#runBoard` / `PreFlight`（不落 `Cli.create()`：那时还没有根，而根由 `#rootOf()` 逐命令产出）；`#sceneOf` 按场景取 `readFor(entry)`（派生面）或 `readPath(rel)`（argv 面）得到 `PlanRead`，`face/cli.ts:1192` / `:1237` 的 `planText = this.#artifacts.readText(...)` 与 `:1262` 的 `new TaskGraph(new PlanDocType("plan").parse(planText!.split("\n")))` 三行删除。**局部载体一并退役**：`let planText: string | null = null`（`:1184`）换成 `let plan: PlanRead = PlanSource.undeclared()`，两个 plan 取读点各自持一枚 `const read = this.#planSource.readPath(planRel)` 并把它交给场景；`#targetSlug`（`:1306`）的形参由 `content: string | null` 换成 `read: PlanRead`——`read.kind !== "ready"` 时**不做 slug 拒绝**（回 `null`），`ready` 时按既有 front-matter 提取取 `slug:` 再走 `index.slugVerdict`（今日 `content === null` 那条 `is unreadable — its declared slug: is the workspace key` 的拒绝因此退出 plan 面；拒绝改由 Task 4 的不挂门腿以 `reason: doc-contract` 说出，报文才指得准）。非 `ready` 时装配身份取索引条目 `index.entryAt(planRel)?.slug`（与 doc 面 `:1214` 的 `index.entryAt(specRel)` 同一条既有取法）：`syntax` 坏的 plan 索引收得下 front matter，场景因此照常装配、Task 4 的拒绝腿能说话；索引也给不出条目（`io` 不可读的 plan 不进索引）时身份同样取 `null`、不做 slug 拒绝——非 ready 的 `PlanRead` 一律交给场景，由 Task 4 的不挂门腿以 `gate: doc-contract` / `reason: doc-contract` 说出，`io` 不可读的 plan 不再以 exit 1 的旧载体抢在 preflight 前拒绝；`#targetSlugText` 因此在 plan 面零调用。另两个 `#targetSlug` 调用点不换语义：doc 面 `:1207` 与 `base` `:1476` 读的是 spec / 无 pre-flight 闸的 plan 目标，方法的文本入口改名 `#targetSlugText(index, rel, content: string | null)`、方法体一字不改（`base` 丢了这条报文就会静默 exit 1）。**判据写死一条：健康 plan 的 wave / plan / branch dispatch 报文逐字节不变**，尤其不得出现 `the target document <rel> is unreadable — its declared slug: is the workspace key`——一条写失败测钉住它（按字面删那两行，健康 plan 会立刻假报 unreadable）。Task 4 只消费这枚已构造好的实例（不再声明构造权）。

doc 面（`phase-spec` / `overall` / `single-spec`）**不读 plan**：那三个分支把 `plan` 留在 `PlanSource.undeclared()`（Task 2 的工厂回 `{ kind: "undeclared" }`），从不派生 `plans/<slug>.md`、也不同 `index.identityDoc(slug)` 拼一条 plan 路径。这个值在 doc 面上**不可观测**（Task 4 的拒绝腿只覆盖 `wave` / `plan` / `branch`，`undeclared` 又不产拒绝），因此不为它立行为判据——「读不读」由生产者决定，不留给实现者二选一。

`planText` 的读取者不止供值点，还有两处**守卫**，它们同样归本任务：`face/cli.ts:808` 的 `if (!parsed.dryRun && type === "wave" && scene.planText !== null)`（`#runWork` 里 brief 渲染的守卫）收成 `scene.plan.kind === "ready"`；`face/cli.ts:1104` 的 `if (rejection.reason === "split" && scene.planText !== null)`（`#renderLineRefusal`）同样收成 `kind === "ready"`，`:1105` 的实参改传 `scene.plan`。这两行不随供值点消失——字段退役后，它们在 `face/cli.ts` 内就是本任务剩下的编译错误来源（另三处读者在 `session/preflight.ts`，见上段）。随之一行**签名移交**：`#renderWaveBoard(scene, read: PlanRead)`（`face/cli.ts:1112`）的形参类型归本任务改，方法体首行 `const graph = new TaskGraph(new PlanDocType("plan").parse(planText.split("\n")))`（`:1113`）也归本任务换成 `const graph = read.graph(); if (graph === null) return;`——签名改了而首行仍按字符串解析，本任务的 `tsc` 就红在方法体未改上，所以这行必须同批；`:1114` 之后（标题 basis 与 `#graphView` 的渲值）归 Task 5，它才是这个方法的主人。

`state` 的退化值由本任务写死，不留给人发明：`#sceneOf` 的 `const state = type === "wave" ? new TaskGraph(new PlanDocType("plan").parse(planText!.split("\n"))) : EMPTY_RUN_STATE`（`:1261-1262`）换成 `const graph = read.kind === "ready" ? read.graph() : null; const state = type === "wave" && graph !== null ? graph : EMPTY_RUN_STATE;`——非 ready 的 wave 场景以空状态装配，不抛。scene 在 `preflight` 之前装配，所以「空状态先出现」不是漏逻辑：Task 4 的不挂门拒绝腿在 dispatch 之前就把它拦下，真派路径到不了 `state` 的使用点。也不再包 `try/catch`：读取已收权到 `PlanRead`，装配期没有可抛的点（今日唯一可抛的点是 `planText!` 的解析，随本任务删除）。`read.graph()` 的返回型是 `TaskGraph | null`（Task 2 的值级表：`ready` 非 `null`），故先 `kind` 守卫、再按值非空收窄，不写 `!`。

`Lifecycle` 的载体同批写清：构造项新增 `plan: PlanRead`（取代 `session/run.ts:357` 的 `#planPath: string | null`；需要 argv 路径字面处取 `path()`——`#pipelineInput()`（`:986-991`）的 `planPath: this.#planPath` 同批改成 `planPath: this.#plan.path()`，而 `PipelineFrontierInput.planPath` 这个**键**保留，退休的只是 `#planPath` 私有字段），供值点在 `face/cli.ts:812` 的 `new Lifecycle({…})`；`face/lifecycle.ts:855-869` 的 `#briefHashOf` 与 `session/run.ts:887-889` 的 `readFileSync` 一律改吃这份值：`run.ts` 侧吞掉读取的 `try/catch` 随读取点消失而删除（stall 语义不变：非 ready 仍不记快照），`face/lifecycle.ts` 侧则**保留 `catch`、只保 `BriefRenderer#taskBody` 的抛点**——`task${n} not found in the plan`（`render/brief.ts:103-110`）在「波次编译后 plan 被改动」下是合法场景，语义仍是「只记在场事实」；保留后 `session/ledger.ts:936-952` 与它对该投影的失败面一致（都回 `null`），不会一处抛、一处回 null。

#### Files

- Modify: `packages/cdd-engine/src-next/render/brief.ts`（删 parser 协作者与默认参数、删 `taskHeadingPattern` 转发、删 `#taskBody` 内的解析、三面改签名）
- Modify: `packages/cdd-engine/src-next/session/preflight.ts`（值形状与三处读者同批：`PreFlightContext.planText`（`:137`）→ `plan: PlanRead`；graph 门的守卫与解析行（`:223-227`）按钉死形状改编——守卫收 `ctx.plan.kind === "ready"`，`:225` 的 `new TaskGraph(new PlanDocType("plan").parse(ctx.planText.split("\n")))` 换成 `const graph = ctx.plan.graph(); if (graph !== null) { … }`（两条 push 与 `validate()` 之后的分类支逐字节不动、不写 `!`）；`#ledgerFactsOf`（`:507-509`）取 `ctx.plan.text()` 后按 `text === null` 早退（不用 `!`、不用 `?? ""`）；`#ledgerInputOf`（`:577-585`）的 `content: ctx.plan.text() ?? ""`（全相位唯一允许的 `?? ""`）。闸门与判定语义仍归 Task 4，本任务只做逐字等价的机械适配。`WorkScene` 的字段声明不在这个文件——见 cli.ts 条目）
- Modify: `packages/cdd-engine/src-next/face/gate.ts`（`:145` 的 `render` 传三值：先 `read.kind === "ready"` 守卫，再取 `text()` / `doc()`，不写 `!`、不写 `?? ""`）
- Modify: `packages/cdd-engine/src-next/face/lifecycle.ts`（`:861` 的 `taskBody` 传三值；`#briefHashOf`（`:855-869`）改吃 `scene.plan`，删 `readFileSync` 与读取守卫，**保留** `BriefRenderer#taskBody` 抛点（`render/brief.ts:103-110`）的 `catch → null`——与 `session/ledger.ts:936-952` 同一条失败面）
- Modify: `packages/cdd-engine/src-next/session/ledger.ts`（`:941` 的 `#briefRevision` 收 `PlanRead` 而不再自己读文件；`readonly #brief = new BriefRenderer();`（`:668`）不再传解析器）
- Modify: `packages/cdd-engine/src-next/session/run.ts`（`Lifecycle` 构造项 `plan: PlanRead` 取代 `#planPath`；`#pipelineInput()`（`:986-991`）的 `planPath: this.#planPath` → `planPath: this.#plan.path()`——`PipelineFrontierInput.planPath` **保留**（`session/pipeline.ts:66` 另有五处读者：`:147`、`:156-158`、`:206-210`、`:236-238`、`:246-250`），`#planPath` 退休 ≠ `planPath` 键退休，只有 `planGraph` 在 Task 4 退役；`#recordReviewedWaveBrief` 的调用链把这份值传给 `recordReviewedBrief`；`#recordPlanSnapshot` 改吃同一值，删 `readFileSync` 与吞掉读取的 `try/catch`——非 ready 仍不记快照，stall 语义不变）
- Modify: `packages/cdd-engine/src-next/face/cli.ts`（`WorkScene.planText: string | null`（`:144-145`）的字段声明退役为 `plan: PlanRead`；`PlanSource` 在**命令前奏**（`#rootOf()` 之后）构造一次、每命令一实例，经参数下行到 `#sceneOf` / `#runBoard` / `PreFlight`（`Cli.create()` 阶段尚无根，不在那里构造）；`#sceneOf` 改取 `readFor(entry)` / `readPath(rel)`，删 `:1192` / `:1237` 的 `planText = this.#artifacts.readText(...)`、`:1184` 的 `let planText: string | null = null` 与 `:1262` 的 `new TaskGraph(new PlanDocType("plan").parse(...))`，`state` 按退化值装配（非 ready 的 wave 场景 → `EMPTY_RUN_STATE`）；`#targetSlug`（`:1306`）形参换 `read: PlanRead`（非 ready 不做 slug 拒绝）、文本入口改名 `#targetSlugText(index, rel, content: string | null)` 供 doc 面 `:1207` 与 `base` `:1476`（方法体一字不改）；三个 doc 面分支把 `PlanSource.undeclared()` 留在场景里（不派生 `plans/<slug>.md`）；两处供值 `:674`（`vet` 上下文）与 `:1285`（场景装配）的 `planText` → `plan`；`:706-711` 的 usage 守卫改吃 `scene.plan.doc()`（`const doc = scene.plan.doc(); const planIds = doc === null ? [] : doc.taskBlocks.map((block) => block.id);`，`:709` 的 `new PlanDocType("plan").parse(…)` 删除，`:52` 的 `PlanDocType` import 随最后两处构造点消失而删除）；`:808` 与 `:1104` 两处守卫收成 `scene.plan.kind === "ready"`、`:1105` 实参改传 `scene.plan`，`#renderWaveBoard` 形参改 `read: PlanRead` 且首行取 `read.graph()`（渲值语义归 Task 5）；`:805` 的注释同批改称 `plan`）
- Test: `packages/cdd-engine/src-next/render/__tests__/render.test.ts`（三面新签名的 harness 改造；`render/__tests__/render.test.ts:849-850` 的两条 `taskHeadingPattern` 断言随 `render/brief.ts` 的转发连同删除（断言本体已在 Task 1 落到 `contract/__tests__/doc.test.ts`）；brief 字节不变量仍绿）
- Test: `packages/cdd-engine/src-next/session/__tests__/preflight.test.ts`（三处 `planText:` 键改 `plan:`：`:274` 用 `PlanSource#undeclared()`，`:255` / `:640` 用 `new PlanSource(injectedFs, new RepoRoot(tmpDir)).readPath(rel)` 得到 `ready` 值（**注入式配方**：`injectedFs` 用既有 memory fs 或根锚定的真实 fs；`gitRepo()` 是 `mkdtempSync + git init`、全程不 `chdir`，无参构造 + 默认 `NodeFs` 只会读 `process.cwd()` 下不存在的文件，产不出 `ready`），测试里不手搓 `PlanRead`——工厂面只留 `undeclared()` 这一支是 spec 的决定；三处都留给本任务换，否则重命名后 tsconfig include 的 `src-next` 会一并类型检查而红）
- Test: `packages/cdd-engine/src-next/face/__tests__/gate.test.ts`、`packages/cdd-engine/src-next/face/__tests__/lifecycle.test.ts`、`packages/cdd-engine/src-next/session/__tests__/ledger.test.ts`（供值点各一条：`text` 与 `doc` 来自同一个 `PlanRead`；非 `ready` 时调用点走守卫分支、brief 事实不记而不是抛出）

#### Consumes

- `PlanSource` / `PlanRead` 的 `readFor` / `readPath` / `text()` / `doc()` / `kind` / `path()`（Task 2；本任务只接线与取值，不改三态分类）
- `WorkScene` / `PreFlight` 上下文里既有的 `planText` 供值点（`face/cli.ts:674` / `:1285`），本任务把它们换名并下行
- `TaskBlock.range` 与 `doc.taskBlocks`（`contract/task-blocks.ts`）

#### Produces

- `BriefRenderer#render(text: string, doc: PlanParsed, tasks: readonly string[])`
- `BriefRenderer#taskBody(text: string, doc: PlanParsed, tasks: readonly string[])`
- `BriefRenderer#extract(text: string, doc: PlanParsed, tasks: readonly string[])`
- `BriefRenderer` 无解析器协作者、无 `constructor` 默认参数
- `WorkScene.plan: PlanRead`（`planText: string | null` 在 `face/cli.ts:144-145` 退役），`PreFlightContext` 同形为 `plan`
- `#targetSlug(index, rel, read: PlanRead)`（plan 面：非 ready 回 `null`、不做 slug 拒绝）与 `#targetSlugText(index, rel, content: string | null)`（doc 面与 `base`：今日报文逐字节不变）
- `Ledger#recordReviewedBrief(waveKey, read: PlanRead)` 与 `#briefRevision(waveKey, read)` 收值（`session/run.ts` 的既有调用链传入）
- `PlanSource` 的**命令前奏实例**（每命令一实例、经参数下行到 `#sceneOf` / `#runBoard` / `PreFlight`）与 `#sceneOf` 的两入口取读（派生面 `readFor` / argv 面 `readPath`）
- `#usage` 前的 `planIds` 取自 `scene.plan.doc()`（`face/cli.ts:706-711`；`ready` 才跑由 `doc() === null` 自动成立，Task 4 不再触碰这段）
- `Lifecycle` 构造项 `plan: PlanRead`（取代 `#planPath`；`face/cli.ts:812` 供值）

#### Steps

- 写失败测（无解析可抛）：给 `render` / `taskBody` / `extract` 一份坏文法的 `text` 与一份从**另一份 plan** 取来的 `PlanParsed`，断言不抛 `cdd: task 27 carries the reserved section`（brief 不再解析）；`null` 形状不在这三面的签名里（`doc: PlanParsed`），「非 ready 不进调用点」由访问器值级表（Task 2）与调用点的 `ready` 守卫覆盖 — checkable: 定向 vitest FAIL（今日内部会解析并抛）
- 写失败测（签名）：三面各一次调用只带 `(text, doc, tasks)`，传递的 `doc.taskBlocks` 被使用 — checkable: FAIL（今日 `taskBody` 只收 `(planContent, tasks)`）
- 删除 parser 协作者与默认参数、改三面签名、删内部解析 — checkable: 上述两组 PASS · `render/__tests__/render.test.ts` 的 brief 字节不变量仍绿
- 在命令前奏（`#rootOf()` 之后）构造一次 `PlanSource`，经参数下行到 `#sceneOf` / `#runBoard` / `PreFlight`；`#sceneOf` 改从它取 `PlanRead`（派生面 `readFor` / argv 面 `readPath`），删那三行自读自解析，`state` 按退化值装配（`read.kind === "ready" ? read.graph() : null`，再 `type === "wave" && graph !== null ? graph : EMPTY_RUN_STATE`） — checkable: `PlanSource#readFor` / `#readPath` 的调用点在场景装配段存在；`grep -n "PlanDocType" packages/cdd-engine/src-next/face/cli.ts` **零命中**（`:708-709` 与 `:1262` 的构造、以及不再使用的 import 同批删除）；`new TaskGraph(` 的命中面只剩 `#renderWaveBoard`（`:1113`，归 Task 5）一段，其余零命中
- 写失败测（健康 dispatch 报文逐字节）：健康 plan 上 `implement --type wave` / `--type plan` / `--type branch`（含各自 `--dry-run`）与 `review` / `fix` 同面，报文与改动前逐字节相同，尤其**不出现** `the target document … is unreadable — its declared slug: is the workspace key` — checkable: 定向 vitest FAIL（若把非 ready 又摔回 slug 拒绝，健康 plan 会立刻假报 unreadable）
- 写失败测（io 不可读不再由 slug 载体拒）：`#targetSlug(read)` 对 `read.kind === "unreadable"` 回 `null`（不发拒绝、plan 面零 `#targetSlugText` 调用），场景装配段不以 exit 1 退出；`cdd implement --type plan --plan <io 不可读>` 的 stderr 不含 `is unreadable — its declared slug: is the workspace key` 旧字面、也不含裸 `cdd: ` 报文 — checkable: 定向 vitest FAIL（今日这条拒绝住在 `#targetSlug` 里）
- `#targetSlug`（`:1306`）形参换 `read: PlanRead`：非 ready 直回 `null`、不做 slug 拒绝；文本入口改名 `#targetSlugText`，doc 面 `:1207` 与 `base` `:1476` 的报文逐字节不变；`#sceneOf` 的 `let planText`（`:1184`）换成 `let plan: PlanRead = PlanSource.undeclared()`，两个取读点各持一枚 `const read = this.#planSource.readPath(planRel)`，非 ready 时装配身份取 `index.entryAt(planRel)?.slug`（索引无条目即 `null`，同样不做 slug 拒绝） — checkable: `grep -n "let planText" packages/cdd-engine/src-next/face/cli.ts` **零命中** · `pnpm exec tsc --noEmit -p packages/cdd-engine` exit 0
- doc 面传 `PlanSource.undeclared()`：`phase-spec` / `overall` / `single-spec` 三个分支不派生 `plans/<slug>.md`、也不同 `index.identityDoc(slug)` 拼 plan 路径 — checkable: `readFor(` 的命中面只在 plan 携带面 · `pnpm exec tsc --noEmit -p packages/cdd-engine` exit 0
- `face/cli.ts:808` 与 `:1104` 两处守卫收成 `scene.plan.kind === "ready"`，`:1105` 实参改传 `scene.plan`；`#renderWaveBoard(scene, read: PlanRead)` 的形参同批改、方法体首行换成 `const graph = read.graph(); if (graph === null) return;` — checkable: `grep -n "planText" packages/cdd-engine/src-next/face/cli.ts` 在 `:808` / `:1104` / `:1105` / `:1112` / `:1113` 上零命中 · `pnpm exec tsc --noEmit -p packages/cdd-engine` exit 0（签名、实参与首行在同一任务内改完，不留红）
- `Lifecycle` 构造项 `plan: PlanRead` 落地（`face/cli.ts:812` 供值），`#pipelineInput()`（`session/run.ts:986-991`）的 `planPath` 取 `this.#plan.path()`（`planPath` 键本身留着），`session/run.ts:887-889` 与 `face/lifecycle.ts:861` 的两处 `readFileSync` 删除，`run.ts` 侧的 `try/catch` 一并删除，`face/lifecycle.ts` 的 `#briefHashOf` 保留 `catch`、只捕 `taskBody` 的抛点 — checkable: 非 ready 不记快照、brief 哈希与 `#briefRevision` 取自同一份值且对同一投影同回 `null`
- 五个调用点传三值（含两处内部委托）：`face/gate.ts:145` 先以 `read.kind === "ready"` 守卫再取 `text()` / `doc()`；`session/ledger.ts` 的 `#briefRevision` 收 `PlanRead` 而不再自己读文件 — checkable: gate / lifecycle / ledger 三处供值测 PASS
- `WorkScene.planText` 与 `PreFlight` 上下文的 `planText` 退役为 `plan: PlanRead`，`face/cli.ts:674` / `:1285` 两处供值同批改；`session/preflight.ts` 的三处读者同批机械适配（`:223-227` graph 门收 `ctx.plan.kind === "ready"`、`:225` 换成 `ctx.plan.graph()` 的 `!== null` 收窄、`:507-509` `#ledgerFactsOf` 取 `text()`、`:577-585` `#ledgerInputOf` 的 `content: ctx.plan.text() ?? ""`） — checkable: `grep -n "planText" packages/cdd-engine/src-next/session/preflight.ts` **零命中** · `pnpm exec tsc --noEmit -p packages/cdd-engine` exit 0（签名与最后一个消费者在同一任务内改完，不再跳任务边界）
- `face/cli.ts:706-711` 的 usage 守卫改吃场景里那份值：`const doc = scene.plan.doc(); const planIds = doc === null ? [] : doc.taskBlocks.map((block) => block.id);`，`:709` 的 `new PlanDocType("plan").parse(…)` 与 `:52` 的 import 一起消失 — checkable: `pnpm exec tsc --noEmit -p packages/cdd-engine` exit 0（守卫值与 `scene.plan` 同型，不留第二份事实源）
- 本任务归属面查残留 — checkable: `grep -rn "planText" packages/cdd-engine/src-next/session/preflight.ts packages/cdd-engine/src-next/face/cli.ts packages/cdd-engine/src-next/face/gate.ts packages/cdd-engine/src-next/face/lifecycle.ts packages/cdd-engine/src-next/session/ledger.ts | grep -v __tests__` **零命中**（命中面见本步枚举；整体零命中门归 Task 7）
- 全量回归 — checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/render src-next/face src-next/session` 与 `pnpm exec tsc --noEmit -p packages/cdd-engine` 均 exit 0

#### Acceptance

- `BriefRenderer` 内不再出现 plan 解析，也没有只被测试使用的构造参数；三面同形，`extract` 亦收 `doc`，块来自 `doc.taskBlocks`。
- brief 的字节不变量保持：任务段与 `## Constraints` 节仍按 `text` 的裸行切片，已评审波次不因本改动重开。
- `face/gate.ts` 不再有 `scene.planText!` 之类的非空断言，也不以 `?? ""` 把「读不出」伪装成空文档：调用点先以 `read.kind === "ready"` 守卫；非 `ready` 时 brief 事实不记（本地 `catch → null` 语义留在 `#briefRevision`）；`face/lifecycle.ts` 的 `#briefHashOf` 保留 `catch`、只捕 `BriefRenderer#taskBody` 的抛点，两个哈希对同一投影都回 `null`。
- `WorkScene` 与 `PreFlight` 上下文只有一份 plan 事实源（`plan: PlanRead`）；`planText` 在本任务归属面（`face/cli.ts` 全文、`face/gate.ts`、`face/lifecycle.ts`、`session/ledger.ts`）零命中，`session/preflight.ts` 的字段声明与三处读者（`:223-227` / `:507-509` / `:577-585`）同批清零，`grep` 证据随本任务落地——整体零命中门在 Task 7 收口。
- `PreFlightContext` 的三处读者是**机械适配**：`:223-227` 的守卫条件与 `:225` 的解析行（换成 `ctx.plan.graph()` + `!== null` 收窄）、`:507-509` 的早退条件、`:577-585` 的 `content` 入参与今日逐字等价（`planText === null` ↔ `!ready`；`?? ""` 仅 `#ledgerInputOf` 一处，理由写在 Objective 里），判定语义的改动全部留给 Task 4。
- 场景面的读取与解析转换在本任务收口：`#sceneOf` 从命令前奏落地的 `PlanSource` 取 `PlanRead`（派生面 `readFor(entry)` / argv 面 `readPath(rel)`），`planText = this.#artifacts.readText(...)` 与 `new TaskGraph(new PlanDocType("plan").parse(...))` 两行已删；`PlanSource#readFor` / `#readPath` 的调用点在 T3 结束后必须存在（否则说明构造物没接线）。
- `face/cli.ts` 里 `PlanDocType` 在 T3 收尾时**零命中**（`:708-709` 与 `:1262` 的构造与 import 同批删除），`new TaskGraph(` 只剩 `#renderWaveBoard`（`:1113`，归 Task 5）一段之外**零命中**——`planIds` 段的构造点已在本任务退役，不留给 Task 4。
- `scene.planText` 的每一处读取都在本任务内改完：`:674` / `:1285` 两处供值、`:706-711` 的 `planIds` 守卫、`:808` 与 `:1104` 两处守卫、`:1105` 实参、`:1112` 形参；`#sceneOf` 的 `state` 装配写出退化值（非 ready 的 wave 场景 → `EMPTY_RUN_STATE`），不抛、不用 `!`，理由（scene 先于 `preflight` 装配、Task 4 的拒绝腿在 dispatch 前拦下）写在 Objective 里。
- `render/__tests__/render.test.ts:849-850` 的两条 `taskHeadingPattern` 断言已删、`render/brief.ts` 不再有该访问器与转发（本任务是渲染侧的唯一归属人；断言本体在 Task 1 已落到 `contract/__tests__/doc.test.ts`，两任务不互相假设对方先做）。
- 健康 plan 的 wave / plan / branch dispatch 报文逐字节不变，不出现 `the target document … is unreadable — its declared slug: is the workspace key`：`#targetSlug` 的非 ready 分支回 `null` 而不发拒绝，坏 plan 的拒绝由 Task 4 的 `doc-contract` 腿说出。
- `#sceneOf` 里没有局部 `planText` 载体（`let planText` 零命中），两个取读点各持一枚 `PlanRead`；doc 面分支留在 `PlanSource.undeclared()`，不派生 `plans/<slug>.md`，此值在 doc 面上不可观测、不立判据。

#### DependsOn

1, 2

---

### Task 4: dispatch 面收口——不挂门的结构拒绝、ready-only 的 graph 门、缺证据不授权

#### Objective

让坏 plan 在**所有携带 plan 的面**上死在一条既有通道里，而不是死在渲染或裸崩里。`session/preflight.ts` 新增一道**不挂门的独立判定**：位置在 in-flight 之后、graph 门之前，依据场景里的 `PlanRead`（不是 `ctx.doc`——wave 面 `ctx.doc === null`、`TargetFaceTable.isDocShape` 为假、`session/faces.ts` 给它 `audit: { kind: "task-graph" }`），`wave` / `plan` / `branch` 三面都执行（`branch` 与 `plan` 共用 `case "plan"` fallthrough、`face/cli.ts:1237` 同一处读取、`#targetSlug` 消费它、`session/preflight.ts:509` 的 `#ledgerFactsOf` 对三面无 try/catch 解析）；`refusal(words)` 非 `null` → 与既有块同一 `gate: "doc-contract"` / `reason: "doc-contract"`，报文恒含 plan 路径（语法坏时另含字段名；`io` 无字段可取，不写 `null`）。门的记账按 **type** 写清：这道拒绝到达 `wave` / `plan` / `branch` 三个 type 面，其中只有 `--type plan` 的文档形状本身就在 gate 计划里（`doc-contract`），故只有它的这次拒绝同时入 `checked`；`--type wave` 与 `--type branch` 没计划过这道门，**不入** `checked`（不许声称跑过）。graph 门的 ready-only 记账归本任务：守卫与 `:225` 的解析行已由 Task 3 退休（`session/preflight.ts:223-227` 只剩 `ctx.plan.kind === "ready"` 守卫与 `ctx.plan.graph()`），本任务定的是它的**语义**——非 ready 时整段跳过，既不进 `gates` 也不进 `checked`，更不新造一行记账（`checked:` 的字节集因此与今日逐字节相同，既有 BLOCKED 报文不变），且它只可能在 `ready` 时到达（`refusal(words)` 的拒绝腿在它之前返回）。`PlanSource` 的构造归 Task 3（命令前奏 `#rootOf()` 之后、每命令一实例，经参数下行），本任务只**复用**这枚实例——场景装配、`Cli#runBoard` 与本任务的判定腿都不 new 第二个；`PlanRead` 是值、不是场景成员（场景上的 `plan: PlanRead` 由 Task 3 落地，板面不为它建 `WorkScene`），`PreFlight#vet`、`#ledgerFactsOf`、`#ledgerInputOf`、`session/pipeline.ts` 的 `#waveState` / `#wavesExhausted`、`session/dispatch-authority.ts` 的 `#waveStation` 各判定腿改吃它——`undeclared` 保留今日语义（未进入 / 没关门 / 无站牌），两个 `unreadable` cause 在真派路径上由结构拒绝先一步拦下；`Lifecycle#recordPlanSnapshot` 的**读取替换**已在 Task 3 的载体里落地（本任务只 pin「非 ready 不记快照」「缺快照读作 stall」这两条语义）。usage 校验的 `planIds` 成员判定在 Task 3 已由 `doc() === null` 收窄到 `ready`（不是以「集合为空」为信号），本任务不再触碰它——它今日排在 `#renderPreflightBlocked` 之前，若非 ready 的空集跑到 `face/cli.ts:706-716`，每个请求 id 都会走 `#usage`（`error:` + exit 2），AC #3 的 `CDD_BLOCKED:` 就没机会渲出。

`PipelineFrontierInput` 的图输入在本任务退役——图输入就是 `#waveState` / `#wavesExhausted` 入参的另一半，只是换了字段名：`session/pipeline.ts:57-70` 的 `readonly planGraph: TaskGraph | null`（`:69`）换成 `readonly plan: PlanRead`，`:229` 的 `const graph = input.planGraph` 改取 `input.plan.graph()`；`session/dispatch-authority.ts:353` 的 `const graph = facts.pipeline.planGraph` 同为 `facts.pipeline.plan.graph()`。所有字面量同批改：`face/cli.ts:1274-1279` 的 `planGraph: state instanceof TaskGraph ? state : BoardView.planGraph(hopPlanPath)` 换成 `plan: read`——Task 3 不改这一行（它只改场景自身的读取与字段），所以 T3 落地后该字面量仍能编译；本任务退役它之后 `BoardView.planGraph` 才真正无人调用，`session/run.ts` 的 `#planGraph`（`:366`）与 `Lifecycle` 构造项 `planGraph`（`:397` / `:414` / `:991` 的 `#pipelineInput()`）随之退役，`#pipelineInput()` 回 `plan: this.#plan`（Task 3 落地的 `Lifecycle` 构造项）；`face/cli.ts:837` 的 `planGraph: scene.pipeline.planGraph` 同删。**只退 `planGraph`、不退 `planPath`**：`PipelineFrontierInput.planPath`（`session/pipeline.ts:66`）保留它的五处读者（`:147`、`:156-158`、`:206-210`、`:236-238`、`:246-250`），`#pipelineInput()` 的 `planPath` 行已在 Task 3 改取 `this.#plan.path()`——两个键不在同一条退休线上，读到 `#pipelineInput()` 的相邻两行时不要把它们一起删。

板面只剩一处**桥**：`face/board-view.ts:883` 的 `planGraph: BoardView.planGraph(planPath)`（`static pipelineFacts(index, entry, root)` 的 input 字面量）换成 `plan: read`，`pipelineFacts` 与 `BoardNext.of` 各加一个 `read: PlanRead` 形参（`:988` 是 `pipelineFacts` 唯一的调用点），`face/cli.ts:535` 的 `BoardNext.of(index, entry, root)` 由 `this.#planSource.readFor(entry)`（Task 3 在 `Cli` 上落地的字段）供值——`BoardView.render` 是静态方法、`BoardNext` 沿 `pipelineFacts` 一起走，所以只有两处形参和一个调用点。这是本任务为「接口退役后 `tsc` 仍绿」付的移交价：Task 5 用 argv 四步归类与板面自己的读取表替掉它，`BoardView.planGraph` 的声明（`:892`）与 `#waveLines` 的调用（`:946`）留到 Task 5 整段删除。

#### Files

- Modify: `packages/cdd-engine/src-next/session/preflight.ts`（新增不挂门的结构拒绝判定；graph 门的 ready-only 记账语义（守卫与 `:225` 的解析行已由 Task 3 连同字形一起退休，本任务只承接记账与账本两处）；`#ledgerFactsOf`（`:507-509`）收 `PlanRead` 的判定语义；**`#ledgerInputOf`（`:577-585`）是本文件的第三处读者**——`content` 取 `plan.text() ?? ""`，与 Task 3 落地的形状一致（全相位唯一允许的 `?? ""`，理由见 Task 3），本任务不重新发明；`WorkScene.plan` / `PreFlight` 上下文的 `plan` 由 Task 3 落地，本任务只消费）
- Modify: `packages/cdd-engine/src-next/session/pipeline.ts`（`PipelineFrontierInput` **只退 `planGraph`**：`planGraph: TaskGraph | null` → `plan: PlanRead`（`:57-70`），`planPath: string | null`（`:66`）与它的五处读者（`:147`、`:156-158`、`:206-210`、`:236-238`、`:246-250`）原样保留；`#waveState` / `#wavesExhausted` 取 `plan.graph()`，`undeclared` 语义不变；模块头 `:12-15` 与接口注释 `:56-57` 里的 `planGraph` 提及同批改称 `plan`——管线仍零读盘、`plan` 仍是注入值）
- Modify: `packages/cdd-engine/src-next/session/dispatch-authority.ts`（`#waveStation` 收 `PlanRead`，`undeclared` 回 `null`，三 kind 不动；`:353` 的图输入改取 `facts.pipeline.plan.graph()`）
- Modify: `packages/cdd-engine/src-next/session/run.ts`（只 pin 语义，不新增构造：`#recordPlanSnapshot` 的读取替换与 `Lifecycle` 构造项已归 Task 3；`#planGraph` 单元随 `PipelineFrontierInput` 退役——`#pipelineInput()` 回 `plan: this.#plan`，`Lifecycle` 构造项的 `planGraph` 删掉；`#pipelineInput()` 的 `planPath` 行由 Task 3 改取 `this.#plan.path()`、本任务不动（`planPath` 键不随 `planGraph` 一起退））
- Modify: `packages/cdd-engine/src-next/face/cli.ts`（`planIds` 段已由 Task 3 收口、本任务不触碰；`PlanSource` 复用 Task 3 在命令前奏落地的实例——本任务与 `Cli#runBoard` 都不构造第二个，场景的两处供值归 Task 3；`#sceneOf` 的 `PipelineFrontierInput` 字面量（`:1274-1279`）换 `plan: read`、`#runWork` 的 `Lifecycle` 供值（`:837`）删 `planGraph`、`#runBoard` 的 `BoardNext.of`（`:535`）传 `this.#planSource.readFor(entry)`——这三处是 T5 的桥，T5 替换）
- Modify: `packages/cdd-engine/src-next/face/board-view.ts`（移植面：`pipelineFacts` / `BoardNext.of` 各加 `read: PlanRead` 形参、`:883` 的 input 字面量换 `plan: read`；`BoardView.planGraph` 的声明与 `#waveLines` 的调用**留到 Task 5** 删除）
- Test: `packages/cdd-engine/src-next/session/__tests__/preflight.test.ts`（三面各一条坏 plan 拒绝、`checked` 记账、graph 门在非 `ready` 上根本不运行（`checked` 里不出现 `graph` 行））
- Test: `packages/cdd-engine/src-next/session/__tests__/pipeline.test.ts`、`packages/cdd-engine/src-next/session/__tests__/dispatch-authority.test.ts`、`packages/cdd-engine/src-next/session/__tests__/run.test.ts`（`undeclared` 语义逐条不变；非 ready 不记快照）
- Test: `packages/cdd-engine/src-next/face/__tests__/cli.test.ts`（`planIds` 在非 ready 时跳过——不出现 `task <id> not found in the plan`）

#### Consumes

- `PlanRead` / `refusal(words)`（Task 2）
- `WorkScene.plan` 与 `PreFlight` 上下文的 `plan`（Task 3 落地的唯一事实源）
- `TargetFaceTable` 的 `isDocShape` / `audit.kind`（`session/faces.ts:118-141`，只读）
- 既有 `#refusal` 形状（`session/preflight.ts` 的 `gate` / `reason` / `message` 三件）

#### Produces

- `PreFlight` 的不挂门结构拒绝（`gate: "doc-contract"` / `reason: "doc-contract"`，`wave` / `plan` / `branch` 三面可达）
- `PreFlight#ledgerFactsOf` / `PreFlight#ledgerInputOf` / `PipelineFrontier#waveState` / `#wavesExhausted` / `DispatchAuthority#waveStation` 的 `PlanRead` 入参（`#ledgerInputOf` 的 `content` 在非 ready 时仍是空串，与 Task 3 落地形状一致）
- `PipelineFrontierInput.plan: PlanRead`（`planGraph` 字段退役，三处字面量与 `Lifecycle#planGraph` 单元同批改）

#### Steps

- 写失败测（三面拒绝）：坏 plan 上 `implement --type wave` / `--type plan` / `--type branch` 各产出 `CDD_BLOCKED:` 与 `reason: doc-contract`，报文含路径与字段名，stderr 不含裸 `cdd: task 27 carries…` — checkable: 定向 vitest FAIL（今日 wave 面不拒、三面裸崩）
- 写失败测（io 不可读走同一条腿）：`cdd implement --type plan --plan <io 不可读>` 输出 `CDD_BLOCKED:` 且含 `reason: doc-contract`，报文含该 plan 路径、不含字段名（`io` 无字段，不得写 `null`）；stderr 不含 `is unreadable — its declared slug: is the workspace key` 旧字面，也不含裸 `cdd: ` 报文；exit 码仍为 1 — checkable: 定向 vitest FAIL（今日由 `#targetSlug` 的旧载体先拒、报文无 `reason:` 行）
- 写失败测（记账）：`--type plan` 的这次拒绝入 `checked`；`--type wave` 与 `--type branch` 的 gate 行不含 `doc-contract`，也不入 `checked` — checkable: FAIL
- 写失败测（graph 门 ready-only）：非 ready 时 `checked` 里**不出现** `graph` 行，且 `checked:` 的字节集与今日逐字节相同；plan 面观察到的第一处拒绝恒为 `doc-contract`（不是 `graph`） — checkable: FAIL
- 写失败测（`planIds` 跳过）：坏 plan 上 `implement --task 3` 的 stderr 不含 `task 3 not found in the plan` — checkable: FAIL
- 写失败测（缺证据不授权）：`undeclared` 时 `#waveState` / `#wavesExhausted` / `#waveStation` 与今日逐项相同（回归 pin）；`#recordPlanSnapshot` 非 ready 不记快照 — checkable: FAIL（今日入参不是 `PlanRead`）
- 写失败测（`planPath` 派生路由回归）：`undeclared` 时 `session/pipeline.ts:206-210` 的 `#planState` 与 `:147` 的 `branchLineOpen` 仍按 `planPath === null` 分出「无 plan 面」，派生路由与今日逐字节相同——`PlanRead#path()` 对 `undeclared` 回 `null` 是这条 pin 的前提（回空串会把 plan 面从 `null` 变成 `{ type: "plan", id: "", plan: "" }`，在 argv 字节不变的情况下改掉派生路由） — checkable: FAIL（今日入参不是 `PlanRead`）
- 实现不挂门拒绝、记账、graph 门 ready-only — checkable: 前三组 PASS
- 各消费者（`#ledgerFactsOf` / `#ledgerInputOf` / `#waveState` / `#wavesExhausted` / `#waveStation`）改吃场景里那份 `PlanRead` — checkable: 全组 PASS · `face/__tests__/cli.test.ts` 既有用例全绿
- 退役 frontier 的图输入：`PipelineFrontierInput.planGraph` → `plan: PlanRead`，`#waveState` / `#waveStation` 取 `plan.graph()`，`Lifecycle` 的 `planGraph` 单元同批改，板面补 `read` 形参（桥） — checkable: `grep -rn "planGraph" packages/cdd-engine/src-next | grep -v __tests__` 只剩 `face/board-view.ts` 的两处——`:892` 的 `BoardView.planGraph` 声明与 `#waveLines` 的 `:946` 调用（供 Task 5 删除），frontier 输入里零命中；字段注释里的 `planGraph` 提及也同批改称 `plan`（`session/pipeline.ts` 的两段、`session/run.ts:364-365` / `:396`），否则这条 grep 不会只剩两处 · `pnpm exec tsc --noEmit -p packages/cdd-engine` exit 0
- 本任务归属面查残留 — checkable: `grep -rn "planText" packages/cdd-engine/src-next/session/preflight.ts packages/cdd-engine/src-next/face/cli.ts | grep -v __tests__` **零命中**（两个文件的 `planText` 读者都已由 Task 3 机械适配并清零，本任务只 pin 零命中与 graph 门 / `#ledgerFactsOf` / `#ledgerInputOf` 的判定语义；`#renderWaveBoard` 的渲值段归 Task 5，整体零命中门归 Task 7）
- 全量回归 — checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/session src-next/face` 与 `pnpm exec tsc --noEmit -p packages/cdd-engine` 均 exit 0
- 写失败测（孤儿与坏 plan 同一条腿）：孤儿 plan 上 `refusal(words)` 先回拒绝，`implement --type plan|wave|branch --plan <孤儿>`、`review --type plan`、`fix --type plan|wave|branch` 与各自 `--dry-run` 一律 `CDD_BLOCKED` + `reason: doc-contract`，报文取 `planOrphanSpec` — checkable: 定向 vitest FAIL（今日无孤儿概念）

#### Acceptance

- 坏 plan 在 `wave` / `plan` / `branch` 三面上均 `CDD_BLOCKED:` + `reason: doc-contract`，报文含 plan 路径（语法坏时另含字段名）；stderr 无裸 `cdd: ` 文法报文，也无 usage 拒绝。语法坏与 `io` 不可读两个 cause 都走这一条腿：`cause: "io"` 的 plan 不再由 `#targetSlug` 的旧载体先拒（那会抢在 preflight 前 exit 1 并丢掉 `reason:` 行），它的可观察量是 `CDD_BLOCKED:` 含 `reason: doc-contract`、报文含该 plan 路径、stderr 不含 `is unreadable — …` 旧字面、exit 码仍为 1。
- 拒绝不依赖 doc-shape 块：`--type wave`（`audit: { kind: "task-graph" }`、`doc: null`）同样可达；`checked` 记账按 type 区分（只有 `--type plan` 入，`--type wave` / `--type branch` 不入）。
- graph 门只在 `ready` 时进入 gate 计划，非 ready 时既不进 `gates` 也不进 `checked`——`checked:` 的字节集与今日相同，既有 BLOCKED 报文逐字节不变；孤儿与坏 plan 都由不挂门拒绝腿在 graph 门之前返回，因此 graph 门在三个面上只可能以 `ready` 到达。`#ledgerFactsOf` 不再有裸解析，`#ledgerInputOf` 的 `content` 在非 ready 时仍取空串（与 Task 3 同一形状，不让读失败伪装成空文档的例外只有这一处）。
- `undeclared` 的三处 frontier 语义与今日逐字节相同；`#recordPlanSnapshot` 非 ready 不记快照且 stall 语义保留。
- `undeclared` 的派生路由逐字节不变：`#pipelineInput().planPath` 走 `this.#plan.path()` 回 `null`，`session/pipeline.ts` 的 `#planState`（`:206-210`）与 `branchLineOpen`（`:147`）的「无 plan 面」分支与今日相同，空串形态不可达。
- 场景只有一份 plan 事实源（Task 3 落地的 `plan: PlanRead`），本任务不新增第二个读取点——`Cli#runBoard` 的 `readFor(entry)` 是 T5 读取表的占位，与场景同一 `PlanSource` 实例，不是第二处构造；`--dry-run` 与真派同批拒绝（preview 不降级）。
- frontier 的图输入只有一份：`PipelineFrontierInput` 不再有 `planGraph`，`plan: PlanRead` 由三处供值（`#sceneOf` 的读取、`Lifecycle#plan`、板面传进来的读取）；`face/board-view.ts` 的 `read` 形参与 `cli.ts:535` 的 `readFor(entry)` 是本任务给 T5 的移交点，T5 换成 argv 四步归类与板面读取表；`grep -rn "planGraph" packages/cdd-engine/src-next | grep -v __tests__` 在 T4 结束时只剩 `BoardView.planGraph` 的声明与 `#waveLines` 的调用两处。
- 孤儿与文法坏 plan 走**同一条**不挂门结构腿：任一带 plan 的面（`plan` / `wave` / `branch` + `--dry-run`）都不放行，`gate` / `reason` 不新增 token。

#### DependsOn

2, 3

---

### Task 5: board 面收口——删掉视图面的读取权

#### Objective

`face/board-view.ts` 的 `BoardView.planGraph`（`catch { return null; }`）删除，板面不再自己读盘：`Cli#runBoard` 内部构造 `PlanRead`（`--plan` 走 `readPath`、`--spec` 走 `readFor`；overall 视图按 `index.phaseSpecsOf(slug)` 的行序形成一张有序值表），以**参数**传给 `BoardNext.of` 与 `BoardView.pipelineFacts`；`BoardView.render` / `#programBoard` / `#waveLines` 仍是静态方法，但收值不再自读。渲染按 spec §2.4 的四语义落地：doc 面先问 `degradedWaveRow(words)`（`null` 才按今日路径渲健康行：`waves()` + `graph.report(ledger.closedWaves())` + `#rowRounds` + `LineCarriers`，一字不改），程序面先问 `cell(words)`（`null` 才渲 `waves[0]!.label.split(" ")[0] + "…"`），plan 行的优先级按**状态优先**写，不是索引优先（状态是 `kind` 与 `orphan()`，索引只决定渲法）：`kind !== "ready" || orphan() !== null` → `planLine(words)`（路径 + 标记，`#docCell` 与 `#entryMark` 一律不参与；它回 `null` 时按今日的索引派生项渲，`undeclared` 即走这一格）；`ready` 且 `PlanRead.path` 解析到索引 `DocEntry` → `#docCell`（今日字节不变）；`ready` 但未入索引 → `planLine(words)`（只有路径、无标记）。理由：**正文语法坏的 plan 仍是索引文档**（`infra/slug-index.ts` 只读 front matter、不解析正文），索引优先会让 AC #1 的 `  plan     <路径> · ! unparseable` 变成 `#docCell` 的 `name  version · status`，与 spec AC #1 的字节面直接冲突。消歧：plan 行的 `kind !== "ready"` 决定渲法（进 `planLine(words)` 的路径 + 标记），而路由授权的短路谓词是 `kind === "unreadable"`，两者不是同一个判断——把两者写成同一个表达式，正是本次缺陷的成因。board 收到 `unreadable` 或孤儿的 `PlanRead` 时不派生任何波次路由：`BoardNext.of` 的短路谓词与 spec §2.3 同一对 `read.kind === "unreadable" || read.orphan() !== null`，短路到既有 hop-less 形态 `  next:    (none)`、不出 `reason:` 行；`undeclared` 不在短路之列（「已写 spec、尚无 plan」仍是 `kairos:cdd-plan` 路由）。诊断走 `Cli#runBoard` 写 stderr 的 `CDD_WARN:`（overall 板每个坏 plan 与每个孤儿各一行、行内带相位 id；程序面同理、行内带 `slug:`；**`undeclared` 零行**），stdout 的 wave 块零字节变化、退出码仍 0。行数恒等式写死：整体板与程序板的诊断行数**恒等于「坏 plan 数 + 孤儿数」**——`undeclared` 是「这一相位还没写计划」的日常状态，给它发告警等于让常态板每次刷一屏噪音，且 `warnLine()` 对 `undeclared` 本来就回 `null`（Task 2）。argv 归类顺序写死：① `SlugIndex.insideDocRoots` + `existsSync` 不过 → 既有 `#boardNotFound`（`no docs match`，exit 2）；② 存在则读字节，读失败 → `cdd board: cannot read --plan <path>`（exit 2，不出板面）。报文**逐字**如此、**无原因尾段**：`DocFs.read` 只回 `string | null`、不携带 errno，接缝上已无原因可取，硬造一个就是消费者可见的臆造字面；`cause: "io"` / `"syntax"` 的区分走 `CDD_WARN:` 行与 `planReadWord` 词行，不进这条报文；③ 字节到手后由索引成员性裁决 → 不在索引即 `no docs match`（exit 2）；④ 只有已入索引的 plan 才走文法判决（`! unparseable` 渲板面、exit 0）。重叠取此序（solo `--plan` 内）：存在但读不出 ∧ 不在索引 → `cannot read`；读得到 ∧ 不在索引 ∧ 文法坏 → `no docs match`。**② 与 ③ 只适用于 solo `--plan`**：`cdd board --spec Y` 与 `cdd board --plan X --spec Y` 的 plan 读取都来自 Y 的派生面（`readFor(specEntry)`），`--plan X` 只保留既有两项职责——判定 ① 的存在性探针与 `no docs match` 的旗标归因，**不读 X 的字节**；因此「X 存在但读不出 + Y 健康」必须出健康板面、exit 0，而不是 `cannot read --plan` exit 2。

#### Files

- Modify: `packages/cdd-engine/src-next/face/board-view.ts`（删 `BoardView.planGraph`；`#waveLines` / `#nodeBoard` / `#programBoard` / `pipelineFacts` / `BoardNext.of` 改收值；plan 行按状态优先的渲法（`planLine` 先于 `#docCell`）；`BoardNext.of` 的非 ready 短路）
- Modify: `packages/cdd-engine/src-next/face/cli.ts`（`Cli#runBoard` 构造 `PlanRead` / 有序值表、写 `CDD_WARN:`；argv 归类四步（②③ 仅 solo `--plan`）；`#renderWaveBoard` 用同一读取）
- Test: `packages/cdd-engine/src-next/face/__tests__/board-view.test.ts`（四语义格面、健康行与健康格逐字节、hop-less `next:`、既有 `  wave     (none)` 与 `(empty plan)` 相邻两条）
- Test: `packages/cdd-engine/src-next/face/__tests__/cli.test.ts`（argv 面三处变化点与逐字节对照、`cannot read` 与 `no docs match` 的次序、派生面 `! unreadable`、`cannot read` 不出板面、`undeclared` 相位零 `CDD_WARN:`）

#### Consumes

- `PlanRead` 的十二个访问器加 `path()`（Task 2；`orphan()` / `specLine()` 是反查两面的渲值入口）
- `Session` 侧的 `PlanRead` 形状（Task 3 落地的 `scene.plan`；只读形状，不重复构造）
- 既有 `#docCell` / `#entryMark` / `LABEL_WIDTH` / `#rowRounds` / `LineCarriers.ofLedger`

#### Produces

- `BoardView#waveLines(read, progress, ledger)` / `#nodeBoard(...)` / `#programBoard(table, ...)` / `pipelineFacts(read, …)` / `BoardNext.of(read, …)` 的收值签名
- `Cli#runBoard` 的 `CDD_WARN:` 写者与 argv 四步归类

#### Steps

- 写失败测（argv 面三处）：背景 fixture（重复 `#### DependsOn`）与单波健康对照相比恰好三处不同（plan 行 `  plan     <repo 相对路径> · ! unparseable`、波次格 `! unparseable`、`next:` 为 `  next:    (none)`），其余逐字节相同，stdout 不含 `  wave     (none)`，stderr 恰一行 `CDD_WARN:`，exit 0 — checkable: 定向 vitest FAIL（今日 `(none)` + 照常 `next:`）
- 写失败测（派生面 `! unreadable`）：权限拒绝的 plan 经派生面到达，`! unreadable` + plan 行为派生路径 + `next: (none)` + stderr 词行，exit 0 — checkable: FAIL
- 写失败测（健康字节不变）：健康单波板面、`next:`、`reason:` 与今日逐字节相同，程序面健康相位的波次格仍为 `wave W1…` — checkable: 基线快照 PASS（防回归）
- 写失败测（四语义格面）：`(none)`（真 undeclared）/ `(empty plan)` / `! unparseable` / `! unreadable` 四行相邻且互不混同；程序面 undeclared 的格是 `""` — checkable: FAIL
- 写失败测（argv 归类次序）：两条重叠用例（存在但读不出 ∧ 不在索引 → `cannot read`；读得到 ∧ 不在索引 ∧ 文法坏 → `no docs match`），拒绝报文整行逐字节等于 `cdd board: cannot read --plan <path>`（含「无尾段」，不是「含 cannot read」的子串断言），ghost-path pin 不变 — checkable: FAIL
- 实现收值签名与四语义渲染，删除 `planGraph` — checkable: 前五组 PASS
- 实现 `Cli#runBoard` 的 `CDD_WARN:` 与 argv 四步归类 — checkable: 全组 PASS · `face/__tests__/cli.test.ts` 既有用例全绿
- `cli.ts` 本任务归属面查残留 — checkable: `grep -rn "planText" packages/cdd-engine/src-next/face/cli.ts | grep -v __tests__` **零命中**（T3 收场景装配段、`planIds` 段与 `:808` / `:1104` 两处守卫，T4 只 pin graph 门 / ledger 段的判定语义，本任务收 `#renderWaveBoard` 段；三归属人合起来清空 `cli.ts`，全仓零命中门在 Task 7）
- 全量回归 — checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/face` 与 `pnpm exec tsc --noEmit -p packages/cdd-engine` 均 exit 0
- 写失败测（孤儿板面）：`cdd board --plan <孤儿>` 的 spec 行渲 `! no-spec`（经 `specLine(words)` 绕开 `#entryMark` / `#docCell` 记账 ⇒ **exit 0**）、`next:` 为 `  next:    (none)`、stderr 恰一行 `CDD_WARN:` — checkable: FAIL
- 写失败测（名字宽度保位）：同一张孤儿板面里 `nameWidth` 仍由 plan 行的 basename 参与取 max（plan 行只换 cell、**不**从 `docRows` 里剔出），overall / spec 行补白与健康板逐字节相同 — checkable: FAIL（整行剔出会让最宽名变化）
- 写失败测（读源优先序）：`cdd board --plan X --spec Y`（同 slug）走 `readFor(specEntry)`，健康字节与单 `--spec` 板逐字节相同；两旗标 slug 不同仍走既有 exit 2 冲突拒 — checkable: 基线 PASS（防回归）
- 写失败测（混合场景不读 `--plan` 字节）：`cdd board --plan <存在但读不出> --spec <健康>` → 板面与单 `--spec` 逐字节相同、exit 0，stderr 无 `cannot read`、也无坏的 X 带出的 `CDD_WARN:`（它不是板面的读取源） — checkable: 定向 vitest FAIL（②③ 不分区就会读 X 的字节并 exit 2）
- 写失败测（程序面逐坏相位诊断）：一张程序板里一个文法坏的 plan 相位 + 一个健康相位——坏相位波次格 `! unparseable`、健康相位仍 `wave W1…`，stderr **恰一行** `CDD_WARN:` 且行内含坏相位的 `slug:`、健康相位零行，stdout 零字节变化，exit 0 — checkable: 定向 vitest FAIL（今日无逐相位词行）
- 写失败测（overall 板逐相位诊断）：overall 板下两个非 ready 相位（一个文法坏、一个读不出）各出一行 `CDD_WARN:`，行内带各自的相位 id — checkable: FAIL
- 写失败测（`undeclared` 零行）：整体板上一条健康相位、一条 `undeclared` 相位、一条坏 plan 相位 → stdout 与 stderr 里 `CDD_WARN:` **恰一行**（坏 plan 那条），`undeclared` 相位零行 — checkable: FAIL
- 写失败测（未索引的 ready plan 行）：plan 在派生路径上、读得到、文法合法，但未被索引收进去（`SlugIndex` 无对应条目）→ plan 行渲 `PlanRead.planLine(words)` 的**裸仓库相对路径**（不出现 `#entryMark` 的 `! unknown-slug` 标记、不进 `#docCell` 的 blocked），波次行仍为健康 `W1 {…}`，exit 0 — checkable: FAIL（今日 plan 行只有 `#docCell` 一条渲法）
- 写失败测（真 undeclared 的 `next:` 不被短路吃掉）：`cdd board --spec <尚无 plan 的相位文档>` 的 `next:` 逐字节等于今日 `PIPELINE_NEXT["phase-spec"]` 渲出的 `kairos:cdd-plan` 路由，stdout 不含 `  next:    (none)` — checkable: 定向 vitest FAIL（把 `undeclared` 并进短路就会渲成假 hop-less）
- 写失败测（派生面不反查 · 板面半）：spec 声明 `slug: X`、文件名非 `<slug>-design.md`、`plans/X.md` 健康 → `cdd board --spec <该 spec>` 的 spec 行不是 `! no-spec`、`next:` 非 hop-less、stderr 零 `CDD_WARN:`、exit 0 — checkable: 定向 vitest FAIL（派生面也反查会把健康 pair 渲成假孤儿）

#### Acceptance

- argv 面与派生面在坏 plan 上的变化点都**恰好三处**（plan 行、波次格、`next:`），其余逐字节相同；`next:` 为 hop-less `  next:    (none)`、无 `reason:` 行、不得等于健康 plan 的波次派生路由。
- 健康 plan 的板面、`next:`、`reason:`、程序面健康格 `wave W1…` 逐字节不变；真 undeclared 仍渲 `  wave     (none)` 且 exit 0。
- 四语义各一条 pin 且互不混同；`(empty plan)` 取自 `planEmptyWord()`，`""` 只属程序面的真 undeclared。
- argv 归类按 ①存在性 ②读字节 ③成员性 ④文法 的次序裁决，但 ②③ **只适用于 solo `--plan`**（`--spec` 在场时 plan 读取来自 Y 的派生面，`--plan X` 只保留 ① 与 `no docs match` 归因、不读 X 的字节）；拒绝报文逐字为 `cdd board: cannot read --plan <path>`（无原因尾段；`io` / `syntax` 只出现在 `CDD_WARN:` 行与 `planReadWord` 词行；测试断言整行而非子串）、不出板面（exit 2），`no docs match` 只承担两种非读取失败；`--plan <存在但读不出> --spec <健康>` 出健康板面、exit 0、stderr 无 `cannot read`。
- `CDD_WARN:` 由 `Cli#runBoard` 写 stderr（overall 板逐坏 plan / 逐孤儿一行带 id，程序面同理带 `slug:`），行数**恒等于坏 plan 数 + 孤儿数**，`undeclared` 与健康相位都零行，stdout 零字节变化；`BoardView.render` 仍是纯函数、不持 io 通道。
- `undeclared` 零告警：整体板「健康 + `undeclared` + 坏 plan」三相位只出恰一行 `CDD_WARN:`；行数恒等式由测试 pin（不是「非 ready 相位数」）。
- plan 行按状态优先裁决：非 ready 与孤儿一律先问 `planLine(words)`（路径 + 标记，`#docCell` / `#entryMark` 不参与；回 `null` —— 即 `undeclared` —— 才按今日的索引派生项渲）；`ready` 且入索引才 `#docCell`（今日字节）；`ready` 未入索引走 `planLine(words)` 的裸相对路径——不触发 `#entryMark`、不进 `#docCell` 的 blocked，波次行与 exit 0 不受影响。正文文法坏的 plan 仍是索引文档，因此它渲 `! unparseable` 而不是 `#docCell`。
- `BoardView.planGraph` 不存在，板面没有第二个读取点；`pipelineFacts` / `BoardNext.of` 收到的 `read` 由 `Cli#runBoard` 自己的读取表供值（Task 4 的 `readFor(entry)` 桥已替换）。
- 反查三条：spec 行 `! no-spec`（非阻塞通道 ⇒ exit 0）、`next:` hop-less（`BoardNext` 的短路谓词与 §2.3 同一对：`read.kind === "unreadable" || read.orphan() !== null`）、一行 stderr `CDD_WARN:`；格字面只有 `! no-spec` 一个，`spec-absent` 与 `slug-absent` 只是词法差别。
- 真 undeclared 的 `next:` 不被短路吃掉：`cdd board --spec <尚无 plan 的相位文档>` 的 `next:` 逐字节等于今日 `PIPELINE_NEXT["phase-spec"]` 的 `kairos:cdd-plan` 路由、stdout 不含 `  next:    (none)`——短路谓词是 `kind === "unreadable"`，`undeclared` 不在其中；plan 行的 `kind !== "ready"` 决定渲法，与这条路由授权不是同一个判断。
- 反查只属 argv 面：spec 声明 `slug: X`、文件名非 `<slug>-design.md`、`plans/X.md` 健康时，`cdd board --spec <该 spec>` 的 spec 行不是 `! no-spec`、`next:` 非 hop-less、stderr 零 `CDD_WARN:`、exit 0（`readFor(entry)` 恒回 `orphan() === null`）。
- 读源优先序：`--spec` 在场走 `readFor(specEntry)`（两旗标 slug 不同时既有 exit 2 先拦），只有 `--plan` 时走 `readPath`；`nameWidth` 的取 max 恒由 plan 行 basename 参与。

#### DependsOn

2, 4

---

### Task 6: 唯一构造点门

#### Objective

按 `docTypeParsers` 的**登记行为参数**落一条守卫：每个 doc key 的构造拼写（`new` + 该型的 `DocType` 类名 + 该 key 字面量）只许出现在两处——它自己的登记行，以及该 doc 型指定的唯一读取点（plan 的是 `infra/plan-source.ts`）。规则通用，plan 只是第一个受益者：防复发靠规则，不靠再写一条 plan 专属 grep。扫描面是生产源码（`**/__tests__/**` 排除——测试合法地直接构造解析器），同一测试另禁 `infra/plan-source.ts` 出现空 `catch`。此门在**其依赖闭包内为绿**——`plan` 的四处残余构造点（`face/cli.ts:708`、`session/preflight.ts:227`、`session/preflight.ts:509`、`face/board-view.ts:896`）全部退役之后（Task 3 收 `face/cli.ts:708`、删 brief 的第二处解析并退休 `session/preflight.ts:225` 的解析行，Task 4 只承接 graph 门的记账与 `session/preflight.ts:509` 的账本语义，Task 5 收 `face/board-view.ts:896`）；「改动前的树上为绿」不是判据，它把一处不可能写成前提。

#### Files

- Add: `packages/cdd-engine/src-next/infra/__tests__/plan-source.guard.test.ts`（按登记行参数化的构造点白名单 + 空 `catch` 禁令）

#### Consumes

- `contract/doc.ts` 的导出 `docTypeParsers`（登记表是守卫的参数源，不写死 doc key 清单）
- 生产源码目录（`packages/cdd-engine/src-next`，排除 `**/__tests__/**`）

#### Produces

- 一条对全部 doc key 生效的构造点守卫，及 plan-source 的空 `catch` 禁令

#### Steps

- 写失败测（白名单）：遍历 `docTypeParsers` 的每个 key，断言其构造拼写只出现在登记行与指定读取点；在临时构造一处越界拼写的夹具上先红 — checkable: 定向 vitest PASS/FAIL 双向验证（用夹具证明这条门会红）
- 写失败测（空 catch）：`infra/plan-source.ts` 不含空 `catch` 块 — checkable: PASS（今日无该文件新写法，File 由 Task 2 落地）
- 实现守卫（参数化 + 源码扫描 + 测试目录排除） — checkable: 全绿，且在**其依赖闭包内**为绿（四处残余构造点退役之后）
- 全量回归 — checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/infra` 与 `pnpm exec tsc --noEmit -p packages/cdd-engine` 均 exit 0

#### Acceptance

- 守卫按 `docTypeParsers` 全行参数化：新增 doc 型自动进入扫描面，不需要改守卫。
- plan 的合法构造点恰两处（登记行 + `infra/plan-source.ts`）；`render/brief.ts` 不在其中（parser 协作者已删）。
- `**/__tests__/**` 排除生效（测试构造解析器不误报）；越界拼写的夹具能让守卫变红。
- `infra/plan-source.ts` 无空 `catch`。

#### DependsOn

3, 5

---

### Task 7: 三面一致性 + 验收收口

#### Objective

把「板面渲染的 wave 行 == `PreFlight` 判定所用 graph 的 wave 集 == frontier 路由的 wave 键」钉成一条结构测试（单进程内三集合都可达，不需要一次 CLI 调用同时看见三层），健康 plan 与坏 plan 各一条；随后逐条落 AC 的可见字节断言（`wave --task` / `branch` 面的 `CDD_BLOCKED:`、`--dry-run` 同在坏 plan 上 BLOCKED、`(empty plan)` 与 `(none)` 相邻 pin、`W1…` 健康格），收口全局 `planText` 零命中门（T3 / T4 / T5 各自的 scoped gate 先行，残留在此定位到归属人），补 changeset，跑完整 `pnpm run validate`。

#### Files

- Add: `packages/cdd-engine/src-next/session/__tests__/plan-read-consistency.test.ts`（三面逐格相等，健康 / 坏各一条）
- Modify: `packages/cdd-engine/src-next/face/__tests__/cli.test.ts`（AC 剩余可见字节断言：`wave` / `branch` 面拒绝、`--dry-run` BLOCKED、slug 与文件名不一致时的 `(none)` 边界）
- Modify: `packages/cdd-engine/src-next/face/__tests__/board-view.test.ts`（`(empty plan)` 与 `(none)` 相邻；四语义不混同的最终 pin）
- Add: `.changeset/p35-plan-read-authority.md`（`@oscaner-skills/cdd-engine` minor，D74——新增拒绝面与一格渲染字面属消费可见字节变化）

#### Consumes

- Task 4 的 `PreFlight` / `pipeline` `PlanRead` 入参、Task 5 的板面渲值接口（Task 2 的访问器）
- `scripts/__tests__/changeset-levels.test.ts` 的级别判据（`major` 机器禁止）

#### Produces

- `session/__tests__/plan-read-consistency.test.ts`（三面一致性）
- `.changeset/p35-plan-read-authority.md`（cdd-engine minor）
- `pnpm run validate` 全绿的验收面

#### Steps

- 写失败测（三面一致性 · 健康）：同一份好 plan，板面 wave 行标签序列、`PreFlight` 的 graph wave 集、frontier 的 wave 键逐格相等 — checkable: 定向 vitest FAIL（今日三处各读一次，无共同事实源）
- 写失败测（三面一致性 · 坏）：坏 plan 上三面同时「不产出波次」而不是互不一致（板面 `! unparseable`、判定拒绝、frontier 不派生）— checkable: FAIL
- 写失败测（AC 剩余字节）：`--type wave` / `--type branch` 的 `CDD_BLOCKED:` 与 `reason: doc-contract`、`--dry-run` 同批 BLOCKED、slug 与 plan 文件名不一致时读作 `undeclared`（`  wave     (none)` + exit 0） — checkable: FAIL（未实现前）
- 写失败测（反查只问存在性 · 板面半）：phase-spec 的 slug 解得开、文件也在，但 `DocFs.read` 回 `null`（或索引没把它收成一枚身份）→ spec 行仍渲 `(none)`（未判态）而不红成 `! no-spec`，plan 行与波次行与健康板逐字节相同，stderr 零 `CDD_WARN:`，exit 0 — checkable: FAIL（今日无「存在但读不出」的 pin）
- 跑三面一致性 + AC 组 — checkable: 全绿
- 全局零命中门 — checkable: `grep -rn "planText" packages/cdd-engine/src-next | grep -v __tests__` **整体零命中**（每个任务的 scoped gate 已先收，剩残留在此定位到具体归属人）
- 补 changeset（cdd-engine minor） — checkable: `scripts/__tests__/changeset-levels.test.ts` 绿
- 全量验收 — checkable: `pnpm run validate` exit 0（含 `emit:check`、root / kairos / engine 三套测试、typecheck ×3、`check:dist-smoke`、`version-sync`、`check:no-bare-functions`）

#### Acceptance

- 三面一致性两条用例（健康 / 坏）在同进程内逐格相等，坏 plan 上三面同时降级而不互不一致。
- AC 的可见字节断言齐全：argv 与派生面各三处变化、`wave` / `branch` 面拒绝、`--dry-run` BLOCKED、四语义格面互不混同、`cannot read` 与 `no docs match` 的次序两条重叠用例。
- 全局 `planText` 零命中门在 Task 7 收口：`grep -rn planText packages/cdd-engine/src-next | grep -v __tests__` 无输出（T3 / T4 / T5 各自的 scoped gate 先行）。
- `.changeset/p35-plan-read-authority.md` 存在且级别为 cdd-engine **minor**。
- 反查的「只问存在性」两半都有 pin：`orphan()` 侧（Task 2）与板面侧（spec 行停留在 `(none)`、零 `CDD_WARN:`、exit 0）——存在但读不出永不红成孤儿。
- `pnpm run validate` exit 0。

#### DependsOn

4, 5, 6

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-11-14 | 初稿：按 spec v0.9 拆八个任务、五波（T1 契约面 `DocSyntaxError` + `DocSlices#taskHeadingPattern` + judge 物化；T2 `plan:` 声明进索引；T3 `PlanSource` / `PlanRead` / `PlanReadWords`；T4 brief 删解析；T5 dispatch 面不挂门拒绝 + 三步 frontier 收值；T6 board 面删 `planGraph` + 四语义 + argv 四步归类；T7 构造点门；T8 三面一致性 + 验收收口） | Claude（kairos:cdd-plan · 2026-11-14） |
| v0.2 | 2026-11-14 | 作者裁定（设计回填 v0.10 随动）：**删除「`plan:` 声明」任务**——slug 是唯一身份，plan 路径由 `ENGINE_RUNTIME.docRoots.plans/<slug>.md` 派生，不写进 front matter；`PlanSource` 的派生面入口改名 `readFor(entry)`（不再收 `SlugIndex`、不再读 `entry.declaredPlan`），越域校验与 `planPathInvalid` 词行随之消失，「存在但读不出」改为「派生路径存在、读回 `null`」；任务由八条重排为七条（旧 T3–T8 → T2–T7），依赖边同步，波次 `W1 {1} · W2 {2,3} · W3 {4,6} · W4 {5} · W5 {7}` | Claude（kairos:cdd-plan · 2026-11-14） |
| v0.3 | 2026-11-14 | 作者裁定（设计回填 v0.12 随动 · D91）：**新增 Task 7「反查」**——plan 的 slug 必须命名一份 `<slug>-design.md`：规则 `plan-slug-names-spec` 落 doc-contract 面（只对 `docKey === "plan"`，派生 `${ENGINE_DOC_ROOTS.specs}/<slug>-design.md` 后**只**探 `DocFs.exists`），`review`/`implement`/`fix` 一律 `CDD_BLOCKED`；板面 spec 行渲 `! no-spec` + hop-less `next:` + stderr `CDD_WARN:` 且 exit 0；旧 Task 7（三面一致性 + 验收收口）顺延为 **Task 8**、`DependsOn` 改 `5, 6, 7` 并补反查三条 AC 的写失败测；Constraints 加「正查不阻塞、反查阻塞」一条，「逐字取 spec」的版本字面校到 v0.12；Review Focus 把过时的 `plan:` 声明条换成「反查被写成内容判定」 | Claude（kairos:cdd-plan · 2026-11-14） |
| v0.4 | 2026-11-14 | 作者裁定（设计 v0.13/v0.14 随动 · 反查的落地形态）：**取消独立的「反查」任务**，把它的三处切面还给各自的主人——`PlanRead` 携带 `orphan()`（`spec-absent` / `slug-absent`，只探 `DocFs.exists`）与三条词法归 **Task 2**；阻塞不登记 doc-contract 规则，随 `refusal(words)` 落 **Task 4** 既有不挂门腿（本就覆盖 `plan`/`wave`/`branch` + `--dry-run`）；规格行 `! no-spec`、`BoardNext` 短路谓词、`nameWidth` 保位、读源优先序（`--spec` 胜）归 **Task 5**。任务由八条回到七条，波次随依赖重排 | Claude（kairos:cdd-plan · 2026-11-14） |
| v0.5 | 2026-11-14 | 评审轮 plan-review-1 落地（F1–F12，F1–F4 按裁决）：graph 门在非 ready 上**整段不运行**（删掉「非 ready 时立一行记账」的四处表述，判据改为 `checked:` 字节集与今日相同、`graph` 不出现在 `checked` 里）；Constraints 与 Review Focus 换成 spec v0.13/v0.14 的读值形态（`orphan()` 只探存在性、阻塞随 `refusal(words)` 落既有不挂门腿；不登记规则、不产 `Finding`、`kind` 零新增，并点明位置错判这个坑）；Task 3 与旧 Task 4 的场景切换合并为一条原子任务「brief 收值 + 场景切换」（`WorkScene.planText` 与它最后一个消费者 `face/gate.ts:145` 同批退役，五个供值点 + `face/cli.ts` 两处一并切换），原 Task 4 余下部分收窄为 dispatch 面，`grep -rn "planText"` 零命中写进 T3 验收；Task 2 的访问器清单补到十一个加 `path()`、`PlanReadWords` 七个成员一次写完、`cellEmpty` 标明为新增而非既有、删掉「类上还带路径校验」的措辞（路径由 slug 派生、没有作者输入可校）；`DocSlices` 的家改到 `contract/project.ts`；board 程序面逐相位 `CDD_WARN:`、未索引的 ready plan 行、spec 存在但读不出三条补写失败测；过期 Task 号与 `argv` 的拼写笔误同批校订 | Claude（kairos:cdd-fix · 2026-11-14） |
| v0.6 | 2026-11-14 | 编排器结构面提交（fix 1 的 rejected 两半）：依赖边按 D 裁决重排——`Task 3` 的 `DependsOn` 由 `1` 改为 `1, 2`（消费 Task 2 的 `PlanRead`），`Task 4` 由 `2` 改为 `2, 3`（消费 Task 3 落地的 `scene.plan`）。结构面不属评审轮（引擎把 `DependsOn` 集当结构基线，`face/lifecycle.ts:344` 快照、`:586-604` 比对），故由编排器单独提交 | Claude（kairos:cdd-plan · 2026-11-14） |
| v0.7 | 2026-11-14 | 复评轮 plan-review-1（同一轮的重跑）校订两处随 F3/F4 合并而失效的任务归因：Task 5 的 Consumes 把 `scene.plan` 的产地由 Task 4 改回 **Task 3**；Task 4 的 `face/cli.ts` 文件条目拆清——`PlanSource` 的单次构造与 `Cli` 字段持有归本任务，场景两处供值归 Task 3。结构面（任务 id 集与 `DependsOn` 集）零改动，其余内容与 v0.6 一致 | Claude（kairos:cdd-fix · 2026-11-14） |
| v0.8 | 2026-11-14 | 复审轮 plan-review-2 落地（F1–F7，全部按裁决）：场景面的读取与解析转换归 **Task 3**（`PlanSource` 在 `Cli.create()` 单次构造并作为 `Cli` 字段持有，`#sceneOf` 改取 `readFor(entry)` / `readPath(rel)`，删 `planText = this.#artifacts.readText(...)` 与 `new TaskGraph(new PlanDocType("plan").parse(...))` 三行；新增 `Lifecycle` 构造项 `plan: PlanRead` 取代 `#planPath`，`session/run.ts` 与 `face/lifecycle.ts` 两处 `readFileSync` 及其 `catch` 随之消失），Task 4 只复用该实例、不再声明构造权；Task 5 的诊断行数改为**恒等于「坏 plan 数 + 孤儿数」**（`undeclared` 零行，并补反向测）；Task 2 的访问器契约升为值级表、孤儿判定先于 `(empty plan)`；Task 3 删掉 `doc: null` 的测；`planText` 零命中门按文件归属拆到 T3 / T4 / T5、整体门留 T7；全文统一改称「派生面」（旧的错误称谓清零）。结构面零改动 | Claude（kairos:cdd-fix · 2026-11-14） |
| v0.9 | 2026-11-14 | 复审轮 plan-review-3 落地（F1–F4，全部按裁决）：`planText` 两个漏网的**读取者**（`:808` / `:1104` 两处守卫）归 **Task 3**——收成 `scene.plan.kind === "ready"`、`:1105` 实参改传 `scene.plan`，`#renderWaveBoard` 形参改 `read: PlanRead` 并附一行签名移交（方法体渲值语义仍归 Task 5，否则 T3 的 `tsc` 就红在方法体未改上）；`#sceneOf` 的 `state` 写出退化值（非 ready 的 wave 场景以 `EMPTY_RUN_STATE` 装配，不包 `try/catch`、不写 `!`，理由随句写明）；`PipelineFrontierInput.planGraph` 的退役归 **Task 4**（三处字面量与 `Lifecycle#planGraph` 单元同批改，板面经 `pipelineFacts` / `BoardNext.of` 的 `read` 形参过桥、T5 替换并删除 `BoardView.planGraph`），验收补一条 `planGraph` 残留 grep；T3 的 scoped 判据据实改（`#sceneOf` / `planIds` / `#renderWaveBoard` 三段之外零命中，不再把 T4 的段落写进 T3 的判据）。结构面零改动 | Claude（kairos:cdd-fix · 2026-11-14） |
| v0.10 | 2026-11-14 | 编排器结构面提交（plan-review-4 F2）：**Task 6（唯一构造点门）`DependsOn` `2, 3` → `3, 5`**——参数化守卫要在 `plan` 的四处残余构造点（`face/cli.ts:708`、`session/preflight.ts:227`/`:509`、`face/board-view.ts:896`）全部退役之后才可能为绿，而它们分别归 Task 4 与 Task 5；原依赖把「此门在改动前的树上为绿」写成不可能 | Claude（kairos:cdd-plan · 2026-11-14） |
| v0.11 | 2026-11-14 | docs-fix 轮 plan-review-4 落地（F1–F7，全按裁决）：F1 `#targetSlug` 收 `PlanRead`（非 ready 不做 slug 拒绝，改由 T4 的 `reason: doc-contract` 腿说话；文本入口改名 `#targetSlugText` 保管 doc 面与 `base` 的报文），`#sceneOf` 的 `let planText` 载体退役、健康 dispatch 报文逐字节由一条写失败测钉住；F2 T6 判据改为「此门在其依赖闭包内为绿」；F3 `#briefHashOf` 保留 `catch`、只保 `taskBody` 抛点；F4 `taskHeadingPattern` 定为模块作用域箭头常量（投影 `toEqual` 仍成立）；F5 `WorkScene` 字段归属据实落到 `face/cli.ts:144-145`；F6 doc 面传 `PlanSource.undeclared()`；F7 change history 按版本升序重排并补本行 | Claude（kairos:cdd-fix · 2026-11-14） |
| v0.12 | 2026-11-14 | docs-fix 轮 plan-review-5 落地（F1–F6，全按裁决）：F1 三处 `PreFlightContext.planText` 读者归 **Task 3 机械适配、语义与今日逐字等价**（graph 门收成 `ctx.plan.kind === "ready"`；`#ledgerFactsOf` 取出 `text` 后判 `null`、不用 `!` 也不写 `?? ""`；`#ledgerInputOf` 的 `content: ctx.plan.text() ?? ""` 是全相位唯一例外并写明理由），Task 4 只留判定语义；F2 plan 行改为**状态优先**（非 ready 与孤儿一律 `planLine(words)`，ready 且入索引才 `#docCell`，正文语法坏但仍是索引文档所以渲 `! unparseable`）；F3 `PlanRead#failure()` 把 §2.2「自带 path/field/message」落成可观测取法（`refusal(words)` 与 `warnLine()` 都经它拼报文，T2 的断言改经 `failure().field`）；F4 argv 的 ②③ 只适用于 solo `--plan`（`--plan X --spec Y` 不读 X 的字节，X 读不出 + Y 健康出健康板面 exit 0，补混合场景写失败测）；F5 Task 4 的 Files 与 Produces 点名 `session/preflight.ts:577-585` 的 `#ledgerInputOf` 并钉死非 ready 形状；F6 Task 3 补 `#pipelineInput()` 的 `planPath: this.#plan.path()`，并写明「`#planPath` 退休 ≠ `planPath` 键退休」 | Claude（kairos:cdd-fix · 2026-11-14） |
| v0.13 | 2026-11-14 | docs-fix 轮 plan-review-6 落地（F1–F2，全按裁决）：F1 `planIds` 守卫归 **Task 3**（改吃 `const doc = scene.plan.doc(); const planIds = doc === null ? [] : doc.taskBlocks.map((block) => block.id);`，`:709` 的 `new PlanDocType("plan").parse(…)` 与 `:52` 的 import 随之消失；Task 4 里那句 `planIds` 归属删除，`ready` 才跑 planIds 由 `doc() === null` 自动成立）；T3 Files 补 `face/cli.ts:706-711`、Test 补 `session/__tests__/preflight.test.ts`（三处 `planText:` 键改 `plan:`，`:274` 用 `PlanSource#undeclared()`、`:255` / `:640` 用 `readPath(临时 fixture 相对路径)`），T3 全量 grep 的括注整句删掉、只留「命中面见本步枚举」；F2 `planLine` 值级表改成值自己判得出来的形状（**`ready` 一律回裸 `<repo 相对路径>`**，`undeclared` 回 `null`，索引成员性归装配者；理由写在表下：`readFor(entry: DocEntry)` 不接受 `SlugIndex`） | Claude（kairos:cdd-fix · 2026-11-14） |
| v0.14 | 2026-11-14 | docs-fix 轮 plan-review-7 落地（F1–F6，全按裁决）：F1 `PlanSource` 构造注入 `DocFs` **与 `RepoRoot`**，路径过 `resolve(relativize(rel))`（`RepoPath` 品牌：`relativize` 唯一构造、`resolve` 唯一擦除），构造点改到**命令前奏** `#rootOf()` 之后、每命令一实例经参数下行到 `#sceneOf` / `#runBoard` / `PreFlight`（`Cli.create()` 阶段尚无根，不再构造），T2 的 Files / Produces / 三组写失败测同步（根锚定 + 注入式配方 `new PlanSource(injectedFs, new RepoRoot(tmpDir))`——`gitRepo()` 不 `chdir`，无参构造 + 默认 `NodeFs` 产不出 `ready`）；F2 `session/preflight.ts:225` 的解析行归 **T3**，钉死 `const graph = ctx.plan.graph(); if (graph !== null) { … graph.validate() … }`（`!== null` 收窄、不写 `!`、不动 `PlanRead` 类判别），「块字节不变」改写为「两条 push 与 `validate()` 之后的分类支不变」，T4 只承接 ready-only 记账与 `#ledgerFactsOf` / `#ledgerInputOf` 两处，T6 归属句改为 `:225` 在 T3 已退休；F3 `path(): string \| null` 进 T2 接口行与值级表（`undeclared` → `null`，`unreadable` / `ready` → 那条路径；理由：`#planState` / `branchLineOpen` 以 `=== null` 认「无 plan 面」，回空串即改掉派生路由），T2 补 `undeclared ⇒ path() === null`、T4 补派生路由回归格；F4 argv 拒绝报文**去掉原因尾段**、逐字为 `cdd board: cannot read --plan <path>`（`DocFs.read` 只回 `string \| null`、不带 errno，`io` / `syntax` 走 `CDD_WARN:` 与 `planReadWord`），T5 断言整行而非子串；F5 归属切干净（T1 只认契约侧 `taskHeadingPattern` 两条断言，`render/brief.ts` 的转发与 `render.test.ts:849-850` 两条断言归 T3），两任务不再互相假设；F6 记账句改点名 type（只有 `--type plan` 入 `checked`，`--type wave` / `--type branch` 不入），句中不再用「doc 面」。结构面零改动 | Claude（kairos:cdd-fix · 2026-11-14） |
| v0.15 | 2026-11-14 | docs-fix 轮 plan-review-8 落地（F1–F3）：F1 短路谓词改成 spec §2.3 同一对 `read.kind === "unreadable" \|\| read.orphan() !== null`（`undeclared` 不在其中），Task 5 增「`cdd board --spec <尚无 plan 的相位文档>` 的 `next:` 逐字节等于 `PIPELINE_NEXT["phase-spec"]` 的 `kairos:cdd-plan` 路由」写失败测与 Acceptance，并补「渲法 vs 路由授权」消歧句；F2 反查限定在 argv 面（`readFor(entry)` 恒回 `null`，`spec-absent` 结构性不可达），`:14` / Task 2 Produces / Task 2 Acceptance 三处补限定，`:138` 的共用路径改为三态分类段共用，Task 2 与 Task 5 各补一条派生面不反查的写失败测；F3 删掉 io 不可读 plan 的旧 `#targetSlugText` 回落，改由 Task 4 的不挂门腿以 `reason: doc-contract` 说出（`CDD_BLOCKED:` 含 `reason:` 行、报文含 plan 路径、stderr 无 `is unreadable — …` 旧字面、exit 码仍 1），Task 3 与 Task 4 各补一条对应写失败测。结构面零改动 | Claude（kairos:cdd-fix · 2026-11-14） |
