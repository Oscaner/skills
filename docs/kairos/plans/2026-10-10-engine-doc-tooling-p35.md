---
title: '引擎文档工具（Engine Doc-Tooling）— P35 计划：plan 读取收权（一份读取 · 一个失败值 · 一条拒绝通道）'
doc-type: plan
version: v0.7
date: 2026-11-14
slug: 2026-10-10-engine-doc-tooling-p35
base: develop
---

## Constraints

- **逐字取 spec**：本计划只实现 `docs/kairos/specs/2026-10-10-engine-doc-tooling-p35-design.md` **现行 version v0.14** 所指的面；spec 版本一变，本约束的字面同笔改。
- **plan grammar 语义不动**：`#### DependsOn` 仍只许一节，其余重复节规则与报文措辞逐字节保持；`parse(): PlanParsed` 的签名不变。
- **反查阻塞随读取值走**：相位没有 plan 是合法状态（读作 `undeclared`、渲 `(none)`）；plan 的 slug 找不到 `<slug>-design.md` 是身份破损（主编排器写错），阻塞经 `PlanRead.refusal(words)` 落既有不挂门腿（`reason: doc-contract`）——`PlanRead#orphan()` 只在「派生 spec 不存在」或「plan 自身无 `slug`」时非 `null`。**不登记 doc-contract 规则、不产 `Finding`、`kind` 词法零新增**；反查**只探存在性**（`DocFs.exists`），不得用 `phaseSpecsOf` / `planOf` 反向拼装。板面渲 `! no-spec` + §2.5 的 hop-less `next:` + 一行 stderr `CDD_WARN:` 且 exit 0。
- **`doc-contract` 判定语义不动**：既有 front-matter 拒绝报文逐字节不变；不新增 gate id、不新增 reason token、不新增 station kind、不动 P27 的十三 token。
- **不动收敛主线**：`session/next.ts` 的 `PIPELINE_NEXT`、`NextStepRouter` 的分级判据、`TargetFaceTable` 的三 kind 与 `session/dispatch-authority.ts` 的 station 词表**零改动**。`BoardNext.of` 的短路用的是既有的 hop-less 分支（`next === null`），不是新路由。
- **一份读取**：`new PlanDocType("plan")` 的合法构造点只留 `contract/doc.ts` 的登记行与 `infra/plan-source.ts`；`BriefRenderer` 的第二处解析**删除**，不开白名单。
- **值携带行为**：`PlanRead` 的访问器各承担一种语义（`text` / `doc` / `graph` / `orphan` / `waves` / `degradedWaveRow` / `cell` / `planLine` / `specLine` / `warnLine` / `refusal` 共十一个，外加 `path()`），消费点不写 `switch (read.kind)`；生产者的本分只是降级字面量（健康行 / 健康格返回 `null`，装配者按今日路径渲染）。
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

把「plan body 文法坏结构」从裸 `throw new Error` 升级为类型化错误，并在**有消费者的一层**物化成 `Finding`。`contract/doc.ts` 的 `DocType` 基类旁定义 `DocSyntaxError`（携带 `field` / `message` / `fix`），不设 plan 专属类；`contract/task-block-grammar.ts` 的 `TaskBlockGrammar#assertNoDuplicateKeys` 改抛它，`parse(): PlanParsed` 的签名不变，`assert` 从此只承载编程不变量。同时把 `taskHeadingPattern()` 从 `BriefRenderer` 迁回文档类型——它是**文档的属性，不是渲染器的**：`DocType` 已暴露 `readonly slices: DocSlices`（接口声明在 `contract/project.ts:172`，由 `Projector#projectDocSlices`（`:466`）从 plan registry 的 slice 表填），该访问器（`render/brief.ts:65` 的 `this.#parser.slices.slices.find((slice) => slice.anchor === "### Task N:")?.valuePattern`）搬进 `DocSlices`、经 `PlanDocType#slices` 暴露，两条断言（pattern 仍匹配 `### Task 3:` / `### Task 12:`）随访问器进 `contract/__tests__/doc.test.ts`。判定面按 D26「一事实一处」只在 `validate` / `validateLedger` 物化 `Finding`：`#contextOf` 只负责把 `DocSyntaxError` 带出来（它返回 `JudgeContext`）。

#### Files

- Modify: `packages/cdd-engine/src-next/contract/doc.ts`（`DocSyntaxError` 类；`PlanDocType` 继续以 `readonly slices: DocSlices` 暴露表，表本身不在此文件声明）
- Modify: `packages/cdd-engine/src-next/contract/project.ts`（`DocSlices` 接口（`:172`）增 `taskHeadingPattern(): RegExp | undefined`；`Projector#projectDocSlices`（`:466`）从 plan registry 的 slice 表派生该值，与其余 slice 同处一处投影）
- Modify: `packages/cdd-engine/src-next/contract/task-block-grammar.ts`（`#assertNoDuplicateKeys` 抛 `DocSyntaxError`，`field` 为该节标题、`fix` 为既有修复提示的文字化）
- Modify: `packages/cdd-engine/src-next/contract/judge.ts`（`#contextOf` 不捕获；`validate`（`:144`）/ `validateLedger`（`:157`）包 try/catch，`DocSyntaxError` → 一行 `Finding`，`path` 取 `ContractInput.path`）
- Test: `packages/cdd-engine/src-next/contract/__tests__/doc.test.ts`（`PlanDocType#slices.taskHeadingPattern()` 匹配 `### Task 3:` / `### Task 12:`，两条断言从 `render/__tests__/render.test.ts:849-850` 迁入）
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
- 实现 `DocSlices#taskHeadingPattern`，把两条断言从 render 测试迁到 `contract/__tests__/doc.test.ts` — checkable: doc 测 PASS
- 全量回归 — checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/contract` 与 `pnpm exec tsc --noEmit -p packages/cdd-engine` 均 exit 0

#### Acceptance

- 坏 plan 文法抛 `DocSyntaxError`（`field` / `message` / `fix` 非空），`parse(): PlanParsed` 签名不变，既有报文措辞逐字节不变。
- `validate` 对坏 body 产一行 `Finding`：`kind === "doc-syntax"`、`path` 等于 `ContractInput.path`、`field` 指到该节，无异常逃逸；`#contextOf` 本身不物化。
- `PlanDocType#slices.taskHeadingPattern()` 可被外部调用并匹配 `### Task 3:` / `### Task 12:`；`render/brief.ts` 不再有该访问器的转发。

#### DependsOn

none

---

### Task 2: `infra/plan-source.ts` — 一个深类、两个入口、一个携带行为的值

#### Objective

把 plan 的 read + parse + classify 收进一处：新增深类 `PlanSource`（家：`infra/plan-source.ts`），构造注入 `DocFs`（默认 `NodeFs`），两个入口 `readFor(entry)`（派生面：`entry.slug` → `${ENGINE_RUNTIME.docRoots.plans}/${slug}.md`，先探存在性——不存在即 `undeclared`，存在才读，`read` 回 `null` 即 `unreadable`/`io`）与 `readPath(rel)`（argv 面），同一个 `PlanRead`。派生不咨询索引的内容谓词，因此「存在但读不出」零声明即可达 `cause: "io"`；slug 是唯一身份，路径不进 front matter（见 spec §2.1「没有声明键」）。判别值三态 `undeclared` / `unreadable`（`cause: "io" | "syntax"`）/ `ready`（`path` / `text` / `doc` / `graph`，`graph` 由同一次解析 eager 派生）。spec §2.1 的三态以**类**实现（私有判别字段 + `kind` getter + 十一个访问器加 `path()`），消费面的契约与 spec 逐条一致，不用裸判别联合让七个调用点各写一遍 `switch`。值**携带行为**：`text()` / `doc()` / `graph()` / `orphan()` / `waves()` / `degradedWaveRow(words)` / `cell(words)` / `planLine(words)` / `specLine(words)` / `warnLine(words)` / `refusal(words)`（十一个，外加 `path()`），消费点不写 `switch (read.kind)`。生产者的本分只是降级字面量：`degradedWaveRow` 与 `cell` 在 `ready` 且有波次时均返回 `null`（健康行 / 健康格归装配者）。路径不来自作者：派生值天然是 repo 相对形式，因此没有域可校、没有作者输入可越界。`PlanReadWords` 是 `infra/plan-source.ts` 自己声明的词表端口，由 `face/words.ts` 的 `Words` 实现。

反查是这次读取的一部分：slug 派生出的 `<slug>-design.md` 是否存在，决定这份 plan 有没有命名一枚相位——它是**读取事实**，不是 doc 形状的违规（不登记规则、不产 `Finding`、`kind` 词法零新增）。

#### Files

- Add: `packages/cdd-engine/src-next/infra/plan-source.ts`（`PlanSource` + `PlanRead` + `PlanReadWords` 端口；不做路径校验——路径由 slug 派生，没有作者输入可校；无模块级裸函数，`catch` 不得为空）
- Modify: `packages/cdd-engine/src-next/face/words.ts`（实现 `PlanReadWords` 七个成员：`planReadWord(cause)` 只承担 `io` / `syntax`；`planEmptyWord()` 回 `(empty plan)`；`cellEmpty` 是**新增**的未声明程序格字面（`""`），与 `planEmptyWord()` 并列而**不是**既有成员——`grep -rn cellEmpty packages/cdd-engine/src-next` 今日零命中；`planOrphanSpec(slug, specPath)` / `planSlugMissing()` / `planOrphanWord()` 三条也是本次新增；`warnPrefix` 取既有 `warn: "CDD_WARN:"` 行）
- Test: `packages/cdd-engine/src-next/infra/__tests__/plan-source.test.ts`（三态 × 两个入口 · 派生边界（slug 为 null / 文件不存在 / 存在读不出）· 访问器语义 · 每次读取只解析一次）

#### Consumes

- `contract/invariants.ts` 的 `DocFs` / `NodeFs`（T1 未动，只读用）
- `infra/slug-index.ts` 的 `DocEntry.slug`（相位文档的身份，只读）与 `infra/doc-roots.ts` 的 `ENGINE_DOC_ROOTS.plans`（全库唯一根值，`infra/runtime.ts` 以 `ENGINE_RUNTIME.docRoots` 暴露）
- `contract/doc.ts` 的 `DocType` 登记表 `docTypeParsers` 与 `DocSyntaxError`（Task 1）、`TaskGraph`（`contract/task-blocks.ts`）
- `face/words.ts` 的 `Words`（被实现方）

#### Produces

- `class PlanSource { constructor(fs?: DocFs) ; readFor(entry: DocEntry): PlanRead ; readPath(rel: string): PlanRead }`
- `class PlanRead { kind ; path() ; text(): string | null ; doc(): PlanParsed | null ; graph(): TaskGraph | null ; orphan(): { cause: "spec-absent" | "slug-absent"; specPath: string | null } | null ; waves(): readonly TaskBatch[] ; degradedWaveRow(words): string | null ; cell(words): string | null ; planLine(words): string | null ; specLine(words): string | null ; warnLine(words): string | null ; refusal(words): { gate: "doc-contract"; reason: "doc-contract"; message: string } | null }`
- `interface PlanReadWords { planReadWord(cause: "io" | "syntax"): string ; planEmptyWord(): string ; planOrphanSpec(slug: string, specPath: string): string ; planSlugMissing(): string ; planOrphanWord(): string ; cellEmpty: string ; warnPrefix: string }`（七个成员一次写完，不再拆成「既有 + 新增」两处清单）
- `orphan()` 由 `cell` / `degradedWaveRow` / `planLine` / `specLine` 折叠成同一字面 `! no-spec`（`planOrphanWord()` 是它的唯一来源；`(empty plan)` 只来自 `planEmptyWord()`，`""` 只来自 `cellEmpty`）

#### Steps

- 写失败测（三态）：不存在声明 → `undeclared`；声明了但 `DocFs.read` 回 `null` → `unreadable`/`io`；声明了、读得到、文法坏 → `unreadable`/`syntax` 且 `field` 指向重复节；读得到且合法 → `ready` 且 `graph()` 的 wave 数与 hand-count 相同 — checkable: 定向 vitest FAIL（今日无该类）
- 写失败测（两入口同源）：同一份好 plan，`readFor`（slug 派生）与 `readPath` 产出的 `path` / `waves()` 逐项相同 — checkable: FAIL
- 写失败测（访问器语义）：`ready` 且有波次时 `degradedWaveRow` 与 `cell` 均回 `null`；`ready` 且零 task block 时两者都回 `planEmptyWord()`；`undeclared` 时前者 `(none)`、后者 `cellEmpty`；`unreadable` 时两者为 `! unparseable` / `! unreadable`，`text()` / `doc()` 为 `null` — checkable: FAIL
- 写失败测（派生边界）：`entry.slug === null` → `undeclared`；slug 有值但 `plans/<slug>.md` 不存在 → `undeclared`（今日 `(none)` 的语义）；存在但 `DocFs.read` 回 `null` → `unreadable`/`io`，且该路径**从未经索引**取得（`SlugIndex` 不在 `readFor` 的入参里）— checkable: FAIL
- 写失败测（一次解析）：一次 `readPath` 只产生一次 `PlanDocType#parse`（用计数 `DocFs` + 计数解析器 spy 断言） — checkable: FAIL
- 实现 `PlanSource` / `PlanRead`（两个入口、三态分类、eager 派生 `graph`；类上只有这两件事，不做路径校验） — checkable: 上述四组 PASS
- 在 `face/words.ts` 实现 `PlanReadWords` 七行，`planReadWord` 不接受 `planEmpty` 语义 — checkable: 词行断言 PASS · `face/__tests__/words.test.ts` 既有用例全绿
- 全量回归 — checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/infra` 与 `pnpm exec tsc --noEmit -p packages/cdd-engine` 均 exit 0
- 写失败测（反查两因）：`plans/x.md` 的 slug 为 `y` 而 `specs/y-design.md` 不存在 → `orphan()` 回 `{cause:"spec-absent", specPath}`；`specs/y-design.md` 存在 → `orphan()` 回 `null`；plan 自身无 front matter `slug` → `{cause:"slug-absent", specPath:null}` — checkable: 定向 vitest FAIL（今日无此概念）
- 写失败测（只探存在性）：`specs/y-design.md` **存在但 `DocFs.read` 回 `null`** → `orphan()` 仍回 `null`（不因读不出而误判成孤儿） — checkable: FAIL（用索引反向拼装会误判）

#### Acceptance

- 三态与两入口：`readFor` / `readPath` 走同一条读 + 解析 + 分类路径，同一份 plan 产出的 `path` / `waves()` 逐项相同；每次读取只解析一次（`graph` 是 eager 派生，不是第二重惰性事实源）。
- 派生边界：slug 为 `null` 或派生路径不存在 → `undeclared`（今日字节）；派生路径存在但读不出 → `unreadable`/`io`——「存在但读不出」不靠任何作者声明即可达，`SlugIndex` 不出现在 `readFor` 的签名里。
- `degradedWaveRow` / `cell` 在 `ready` 且有波次时均返回 `null`（健康字节归装配者）；四语义字面量各由一条断言覆盖，`(empty plan)` 只取自 `planEmptyWord()`、`""` 只由 `cellEmpty` 产出（程序面上真 undeclared 的格）。
- 文件内无空 `catch`，无模块级裸函数；消费方不需要 `switch (read.kind)` 即可拿到所需事实。
- 反查：`orphan()` 仅在「派生 spec 不存在」或「plan 自身无 `slug`」时非 `null`，且只用 `DocFs.exists`；存在但读不出 / 未被索引收进去的 spec 不算孤儿（未判态）。

#### DependsOn

1

---

### Task 3: brief 收值 + 场景切换——三个公开面收 `(text, doc, tasks)`，`WorkScene.planText` 退役为 `plan: PlanRead`

#### Objective

删除 `render/brief.ts` 的第二处 plan 解析，并**在同一次原子改动里**退掉场景的第二重事实源——两者拆开则无论怎么排波次都编译不过：brief 的 `(text, doc, tasks)` 要 `PlanRead`，而 `WorkScene` 一天不换成 `plan: PlanRead`，`face/gate.ts:145` 就仍在读 `planText`（先改 brief 则取 `scene.plan` 时它还不存在，先退役字段则 `:145` 还在读它）。

`BriefRenderer` 的 parser 协作者整体删除（`constructor(parser = new PlanDocType("plan"))`，默认参数一起没了），`render` / `taskBody` / `extract` 三面同形改收 `(text, doc, tasks)`，`text` 取自 `PlanRead.text()`、`doc` 取自 `PlanRead.doc()`；`#taskBody` 内的 `const parsed = this.#parser.parse(planContent.split("\n"));`（`:70`）删除，块从 `doc.taskBlocks` 取。裸行切片（按 `TaskBlock.range` 取任务段）与 `## Constraints` 节仍读 `text`——brief 被哈希（D30 / P29），按 `fields[].lines` 重建 heading 字节会让已评审波次凭空重开。场景切换与 brief 同批落地：`WorkScene.planText: string | null` 退役为 `plan: PlanRead`（`session/preflight.ts` 的场景类型），`PreFlight` 上下文的 `planText` 同批换成 `plan`；供值点五处随动——`face/gate.ts:145` 的 `render`、`face/lifecycle.ts:861` 的 `taskBody`、`session/ledger.ts:941` 的 `taskBody` 三个公开面调用，外加 `extract` / `taskBody` 两处内部委托；`session/ledger.ts` 的 `#briefRevision` 因此不再自己 `readFileSync`，改由既有调用链（`session/run.ts` 的 `#recordReviewedWaveBrief` → `recordReviewedBrief(waveKey, …)` → `#briefRevision`）把场景里的 `PlanRead` 传下去；`face/cli.ts` 的两处供值（`:674` 的 `vet` 上下文、`:1285` 的场景装配）同批换成 `plan`。切换写法写死：调用点先以 `read.kind === "ready"` 守卫，再在 `ready` 分支里取 `text()` / `doc()`（该分支里两者必非 `null`），**不写 `!` 非空断言、也不写 `?? ""`**——后者会把「读不出」伪装成空文档。

#### Files

- Modify: `packages/cdd-engine/src-next/render/brief.ts`（删 parser 协作者与默认参数、删 `taskHeadingPattern` 转发、删 `#taskBody` 内的解析、三面改签名）
- Modify: `packages/cdd-engine/src-next/session/preflight.ts`（只改值形状：`WorkScene.planText` 与 `PreFlight` 上下文的 `planText` → `plan: PlanRead`；本任务不动 gate 与判定逻辑，那是 Task 4）
- Modify: `packages/cdd-engine/src-next/face/gate.ts`（`:145` 的 `render` 传三值：先 `read.kind === "ready"` 守卫，再取 `text()` / `doc()`，不写 `!`、不写 `?? ""`）
- Modify: `packages/cdd-engine/src-next/face/lifecycle.ts`（`:861` 的 `taskBody` 传三值）
- Modify: `packages/cdd-engine/src-next/session/ledger.ts`（`:941` 的 `#briefRevision` 收 `PlanRead` 而不再自己读文件；`readonly #brief = new BriefRenderer();`（`:668`）不再传解析器）
- Modify: `packages/cdd-engine/src-next/session/run.ts`（`#recordReviewedWaveBrief` 的调用链把场景里的 `PlanRead` 传给 `recordReviewedBrief`；本任务不碰 `#recordPlanSnapshot`，那是 Task 4）
- Modify: `packages/cdd-engine/src-next/face/cli.ts`（两处供值 `:674`（`vet` 上下文）与 `:1285`（场景装配）的 `planText` → `plan`）
- Test: `packages/cdd-engine/src-next/render/__tests__/render.test.ts`（三面新签名的 harness 改造；`taskHeadingPattern` 两条断言已迁出，此处只留调用面；brief 字节不变量仍绿）
- Test: `packages/cdd-engine/src-next/face/__tests__/gate.test.ts`、`packages/cdd-engine/src-next/face/__tests__/lifecycle.test.ts`、`packages/cdd-engine/src-next/session/__tests__/ledger.test.ts`（供值点各一条：`text` 与 `doc` 来自同一个 `PlanRead`；非 `ready` 时调用点走守卫分支、brief 事实不记而不是抛出）

#### Consumes

- `PlanRead` 的 `text()` / `doc()` / `kind`（Task 2；本任务只取值，不改读取面）
- `WorkScene` / `PreFlight` 上下文里既有的 `planText` 供值点（`face/cli.ts:674` / `:1285`），本任务把它们换名并下行
- `TaskBlock.range` 与 `doc.taskBlocks`（`contract/task-blocks.ts`）

#### Produces

- `BriefRenderer#render(text: string, doc: PlanParsed, tasks: readonly string[])`
- `BriefRenderer#taskBody(text: string, doc: PlanParsed, tasks: readonly string[])`
- `BriefRenderer#extract(text: string, doc: PlanParsed, tasks: readonly string[])`
- `BriefRenderer` 无解析器协作者、无 `constructor` 默认参数
- `WorkScene.plan: PlanRead`（`planText: string | null` 退役），`PreFlight` 上下文同形
- `Ledger#recordReviewedBrief(waveKey, read: PlanRead)` 与 `#briefRevision(waveKey, read)` 收值（`session/run.ts` 的既有调用链传入）

#### Steps

- 写失败测（无解析可抛）：给 `render` / `taskBody` / `extract` 一份坏文法的 `text` 与 `null` 的 `doc`，断言不抛（由调用点处理 `null`），而不是 `cdd: task 27 carries the reserved section` — checkable: 定向 vitest FAIL（今日内部会解析并抛）
- 写失败测（签名）：三面各一次调用只带 `(text, doc, tasks)`，传递的 `doc.taskBlocks` 被使用 — checkable: FAIL（今日 `taskBody` 只收 `(planContent, tasks)`）
- 删除 parser 协作者与默认参数、改三面签名、删内部解析 — checkable: 上述两组 PASS · `render/__tests__/render.test.ts` 的 brief 字节不变量仍绿
- 五个调用点传三值（含两处内部委托）：`face/gate.ts:145` 先以 `read.kind === "ready"` 守卫再取 `text()` / `doc()`；`session/ledger.ts` 的 `#briefRevision` 收 `PlanRead` 而不再自己读文件 — checkable: gate / lifecycle / ledger 三处供值测 PASS
- `WorkScene.planText` 与 `PreFlight` 上下文的 `planText` 退役为 `plan: PlanRead`，`face/cli.ts:674` / `:1285` 两处供值同批改 — checkable: `pnpm exec tsc --noEmit -p packages/cdd-engine` exit 0（签名与最后一个消费者在同一任务内改完，不再跳任务边界）
- 全量查残留 — checkable: `grep -rn "planText" packages/cdd-engine/src-next --include="*.ts" | grep -v __tests__` **零命中**（「还有谁在读」不靠人记）
- 全量回归 — checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/render src-next/face src-next/session` 与 `pnpm exec tsc --noEmit -p packages/cdd-engine` 均 exit 0

#### Acceptance

- `BriefRenderer` 内不再出现 plan 解析，也没有只被测试使用的构造参数；三面同形，`extract` 亦收 `doc`，块来自 `doc.taskBlocks`。
- brief 的字节不变量保持：任务段与 `## Constraints` 节仍按 `text` 的裸行切片，已评审波次不因本改动重开。
- `face/gate.ts` 不再有 `scene.planText!` 之类的非空断言，也不以 `?? ""` 把「读不出」伪装成空文档：调用点先以 `read.kind === "ready"` 守卫；非 `ready` 时 brief 事实不记（本地 `catch → null` 语义留在 `#briefRevision`）。
- `WorkScene` 与 `PreFlight` 上下文只有一份 plan 事实源（`plan: PlanRead`）；`planText` 在 `packages/cdd-engine/src-next`（`__tests__` 除外）零命中，`grep` 证据随本任务落地。
- `render/__tests__/render.test.ts` 不再出现 `taskHeadingPattern` 的断言（已迁入 `contract/__tests__/doc.test.ts`）。

#### DependsOn

1, 2

---

### Task 4: dispatch 面收口——不挂门的结构拒绝、ready-only 的 graph 门、缺证据不授权

#### Objective

让坏 plan 在**所有携带 plan 的面**上死在一条既有通道里，而不是死在渲染或裸崩里。`session/preflight.ts` 新增一道**不挂门的独立判定**：位置在 in-flight 之后、graph 门之前，依据场景里的 `PlanRead`（不是 `ctx.doc`——wave 面 `ctx.doc === null`、`TargetFaceTable.isDocShape` 为假、`session/faces.ts` 给它 `audit: { kind: "task-graph" }`），`wave` / `plan` / `branch` 三面都执行（`branch` 与 `plan` 共用 `case "plan"` fallthrough、`face/cli.ts:1237` 同一处读取、`#targetSlug` 消费它、`session/preflight.ts:509` 的 `#ledgerFactsOf` 对三面无 try/catch 解析）；`refusal(words)` 非 `null` → 与既有块同一 `gate: "doc-contract"` / `reason: "doc-contract"`，报文含 plan 路径与字段名。门的记账写清：doc 面本来就在 gate 计划里故这次拒绝同时入 `checked`；wave 面与 `branch` 面**不入** `checked`（它们没计划过这道门，不许声称跑过）。graph 门只在 `read.kind === "ready"` 时进入 gate 计划：`session/preflight.ts:224-226` 的守卫不成立即整段跳过——既不进 `gates`，也不进 `checked`，更不新造一行记账（`checked:` 的字节集因此与今日逐字节相同，既有 BLOCKED 报文不变）。`PlanSource` 在组合根 `Cli.create()` 构造一次并作为 `Cli` 字段持有，场景装配与 `Cli#runBoard` 都**复用它**、不 new 第二个；`PlanRead` 是值、不是场景成员（场景上的 `plan: PlanRead` 由 Task 3 落地，板面不为它建 `WorkScene`），`PreFlight#vet`、`#ledgerFactsOf`、`session/pipeline.ts` 的 `#waveState` / `#wavesExhausted`、`session/dispatch-authority.ts` 的 `#waveStation`、`session/run.ts` 的 `#recordPlanSnapshot` 同批改吃它——`undeclared` 保留今日语义（未进入 / 没关门 / 无站牌），两个 `unreadable` cause 在真派路径上由结构拒绝先一步拦下；`#recordPlanSnapshot` 非 ready 不记快照、「缺快照读作 stall」原样保留。usage 校验的 `planIds` 成员判定以 `read.kind === "ready"` 为**执行前提**（不是以「集合为空」为信号）——它今日排在 `#renderPreflightBlocked` 之前，若让非 ready 的空集跑到 `face/cli.ts:706-716`，每个请求 id 都会走 `#usage`（`error:` + exit 2），AC #3 的 `CDD_BLOCKED:` 就没机会渲出。

#### Files

- Modify: `packages/cdd-engine/src-next/session/preflight.ts`（新增不挂门的结构拒绝判定；graph 门 ready-only；`#ledgerFactsOf` 收 `PlanRead`；`WorkScene.plan` / `PreFlight` 上下文的 `plan` 由 Task 3 落地，本任务只消费）
- Modify: `packages/cdd-engine/src-next/session/pipeline.ts`（`#waveState` / `#wavesExhausted` 收 `PlanRead`，`undeclared` 语义不变）
- Modify: `packages/cdd-engine/src-next/session/dispatch-authority.ts`（`#waveStation` 收 `PlanRead`，`undeclared` 回 `null`，三 kind 不动）
- Modify: `packages/cdd-engine/src-next/session/run.ts`（`#recordPlanSnapshot` 收 `PlanRead`；非 ready 不记快照、stall 语义保留；`#briefRevision` 的调用链归 Task 3）
- Modify: `packages/cdd-engine/src-next/face/cli.ts`（`planIds` 成员判定加 `read.kind === "ready"` 前提；`PlanSource` 的单次构造（`Cli.create()` 里作为 `Cli` 字段持有）与 `Cli#runBoard` 的复用归本任务，场景的两处供值归 Task 3）
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
- `PreFlight#ledgerFactsOf` / `PipelineFrontier#waveState` / `#wavesExhausted` / `DispatchAuthority#waveStation` / `Lifecycle#recordPlanSnapshot` 的 `PlanRead` 入参

#### Steps

- 写失败测（三面拒绝）：坏 plan 上 `implement --type wave` / `--type plan` / `--type branch` 各产出 `CDD_BLOCKED:` 与 `reason: doc-contract`，报文含路径与字段名，stderr 不含裸 `cdd: task 27 carries…` — checkable: 定向 vitest FAIL（今日 wave 面不拒、三面裸崩）
- 写失败测（记账）：doc 面的这次拒绝入 `checked`；wave 面与 branch 面的 gate 行不含 `doc-contract` — checkable: FAIL
- 写失败测（graph 门 ready-only）：非 ready 时 `checked` 里**不出现** `graph` 行，且 `checked:` 的字节集与今日逐字节相同；plan 面观察到的第一处拒绝恒为 `doc-contract`（不是 `graph`） — checkable: FAIL
- 写失败测（`planIds` 跳过）：坏 plan 上 `implement --task 3` 的 stderr 不含 `task 3 not found in the plan` — checkable: FAIL
- 写失败测（缺证据不授权）：`undeclared` 时 `#waveState` / `#wavesExhausted` / `#waveStation` 与今日逐项相同（回归 pin）；非 ready 不记 plan 快照 — checkable: FAIL（今日入参不是 `PlanRead`）
- 实现不挂门拒绝、记账、graph 门 ready-only — checkable: 前三组 PASS
- 四个消费者（`#ledgerFactsOf` / `#waveState` / `#wavesExhausted` / `#waveStation`）与 `#recordPlanSnapshot` 改吃场景里那份 `PlanRead`，`planIds` 加 ready 前提 — checkable: 全组 PASS · `face/__tests__/cli.test.ts` 既有用例全绿
- 全量回归 — checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/session src-next/face` 与 `pnpm exec tsc --noEmit -p packages/cdd-engine` 均 exit 0
- 写失败测（孤儿与坏 plan 同一条腿）：孤儿 plan 上 `refusal(words)` 先回拒绝，`implement --type plan|wave|branch --plan <孤儿>`、`review --type plan`、`fix --type plan|wave|branch` 与各自 `--dry-run` 一律 `CDD_BLOCKED` + `reason: doc-contract`，报文取 `planOrphanSpec` — checkable: 定向 vitest FAIL（今日无孤儿概念）

#### Acceptance

- 坏 plan 在 `wave` / `plan` / `branch` 三面上均 `CDD_BLOCKED:` + `reason: doc-contract`，报文含 plan 路径与字段名；stderr 无裸 `cdd: ` 文法报文，也无 usage 拒绝。
- 拒绝不依赖 doc-shape 块：wave 面（`audit: { kind: "task-graph" }`、`doc: null`）同样可达；`checked` 记账按面区分（doc 面入，wave / branch 不入）。
- graph 门只在 `ready` 时进入 gate 计划，非 ready 时既不进 `gates` 也不进 `checked`——`checked:` 的字节集与今日相同，既有 BLOCKED 报文逐字节不变；孤儿与坏 plan 都由不挂门拒绝腿在 graph 门之前返回，因此 graph 门在三个面上只可能以 `ready` 到达。`#ledgerFactsOf` 不再有裸解析。
- `undeclared` 的三处 frontier 语义与今日逐字节相同；`#recordPlanSnapshot` 非 ready 不记快照且 stall 语义保留。
- 场景只有一份 plan 事实源（Task 3 落地的 `plan: PlanRead`），本任务不新增第二个读取点；`--dry-run` 与真派同批拒绝（preview 不降级）。
- 孤儿与文法坏 plan 走**同一条**不挂门结构腿：任一带 plan 的面（`plan` / `wave` / `branch` + `--dry-run`）都不放行，`gate` / `reason` 不新增 token。

#### DependsOn

2, 3

---

### Task 5: board 面收口——删掉视图面的读取权

#### Objective

`face/board-view.ts` 的 `BoardView.planGraph`（`catch { return null; }`）删除，板面不再自己读盘：`Cli#runBoard` 内部构造 `PlanRead`（`--plan` 走 `readPath`、`--spec` 走 `readFor`；overall 视图按 `index.phaseSpecsOf(slug)` 的行序形成一张有序值表），以**参数**传给 `BoardNext.of` 与 `BoardView.pipelineFacts`；`BoardView.render` / `#programBoard` / `#waveLines` 仍是静态方法，但收值不再自读。渲染按 spec §2.4 的四语义落地：doc 面先问 `degradedWaveRow(words)`（`null` 才按今日路径渲健康行：`waves()` + `graph.report(ledger.closedWaves())` + `#rowRounds` + `LineCarriers`，一字不改），程序面先问 `cell(words)`（`null` 才渲 `waves[0]!.label.split(" ")[0] + "…"`），plan 行的事实源恒为 `PlanRead.path`——该路径解析到索引 `DocEntry` 就用既有 `#docCell`（今日字节不变），否则用 `planLine(words)`（不包 `DocEntry`、不进 `#entryMark`、不进 `#docCell` blocked）。board 收到非 ready 时不派生任何波次路由：`BoardNext.of` 短路到既有 hop-less 形态 `  next:    (none)`、不出 `reason:` 行，`undeclared` 不在短路之列。诊断走 `Cli#runBoard` 写 stderr 的 `CDD_WARN:`（overall 板每个非 ready 相位各一行、行内带相位 id；程序面每个坏 plan 相位各一行、行内带 `slug:`），stdout 的 wave 块零字节变化、退出码仍 0。argv 归类顺序写死：① `SlugIndex.insideDocRoots` + `existsSync` 不过 → 既有 `#boardNotFound`（`no docs match`，exit 2）；② 存在则读字节，读失败 → `cdd board: cannot read --plan <path>: <原因>`（exit 2，不出板面）；③ 字节到手后由索引成员性裁决 → 不在索引即 `no docs match`（exit 2）；④ 只有已入索引的 plan 才走文法判决（`! unparseable` 渲板面、exit 0）。重叠取此序：存在但读不出 ∧ 不在索引 → `cannot read`；读得到 ∧ 不在索引 ∧ 文法坏 → `no docs match`。

#### Files

- Modify: `packages/cdd-engine/src-next/face/board-view.ts`（删 `BoardView.planGraph`；`#waveLines` / `#nodeBoard` / `#programBoard` / `pipelineFacts` / `BoardNext.of` 改收值；plan 行两条渲法；`BoardNext.of` 的非 ready 短路）
- Modify: `packages/cdd-engine/src-next/face/cli.ts`（`Cli#runBoard` 构造 `PlanRead` / 有序值表、写 `CDD_WARN:`；argv 归类四步；`#renderWaveBoard` 用同一读取）
- Test: `packages/cdd-engine/src-next/face/__tests__/board-view.test.ts`（四语义格面、健康行与健康格逐字节、hop-less `next:`、既有 `  wave     (none)` 与 `(empty plan)` 相邻两条）
- Test: `packages/cdd-engine/src-next/face/__tests__/cli.test.ts`（argv 面三处变化点与逐字节对照、`cannot read` 与 `no docs match` 的次序、声明面 `! unreadable`、`cannot read` 不出板面）

#### Consumes

- `PlanRead` 的十一个访问器加 `path()`（Task 2；`orphan()` / `specLine()` 是反查两面的渲值入口）
- `Session` 侧的 `PlanRead` 形状（Task 3 落地的 `scene.plan`；只读形状，不重复构造）
- 既有 `#docCell` / `#entryMark` / `LABEL_WIDTH` / `#rowRounds` / `LineCarriers.ofLedger`

#### Produces

- `BoardView#waveLines(read, progress, ledger)` / `#nodeBoard(...)` / `#programBoard(table, ...)` / `pipelineFacts(read, …)` / `BoardNext.of(read, …)` 的收值签名
- `Cli#runBoard` 的 `CDD_WARN:` 写者与 argv 四步归类

#### Steps

- 写失败测（argv 面三处）：背景 fixture（重复 `#### DependsOn`）与单波健康对照相比恰好三处不同（plan 行 `  plan     <repo 相对路径> · ! unparseable`、波次格 `! unparseable`、`next:` 为 `  next:    (none)`），其余逐字节相同，stdout 不含 `  wave     (none)`，stderr 恰一行 `CDD_WARN:`，exit 0 — checkable: 定向 vitest FAIL（今日 `(none)` + 照常 `next:`）
- 写失败测（声明面 `! unreadable`）：权限拒绝的 plan 经相位声明到达，`! unreadable` + plan 行为声明路径 + `next: (none)` + stderr 词行，exit 0 — checkable: FAIL
- 写失败测（健康字节不变）：健康单波板面、`next:`、`reason:` 与今日逐字节相同，程序面健康相位的波次格仍为 `wave W1…` — checkable: 基线快照 PASS（防回归）
- 写失败测（四语义格面）：`(none)`（真 undeclared）/ `(empty plan)` / `! unparseable` / `! unreadable` 四行相邻且互不混同；程序面 undeclared 的格是 `""` — checkable: FAIL
- 写失败测（argv 归类次序）：两条重叠用例（存在但读不出 ∧ 不在索引 → `cannot read`；读得到 ∧ 不在索引 ∧ 文法坏 → `no docs match`），ghost-path pin 不变 — checkable: FAIL
- 实现收值签名与四语义渲染，删除 `planGraph` — checkable: 前五组 PASS
- 实现 `Cli#runBoard` 的 `CDD_WARN:` 与 argv 四步归类 — checkable: 全组 PASS · `face/__tests__/cli.test.ts` 既有用例全绿
- 全量回归 — checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/face` 与 `pnpm exec tsc --noEmit -p packages/cdd-engine` 均 exit 0
- 写失败测（孤儿板面）：`cdd board --plan <孤儿>` 的 spec 行渲 `! no-spec`（经 `specLine(words)` 绕开 `#entryMark` / `#docCell` 记账 ⇒ **exit 0**）、`next:` 为 `  next:    (none)`、stderr 恰一行 `CDD_WARN:` — checkable: FAIL
- 写失败测（名字宽度保位）：同一张孤儿板面里 `nameWidth` 仍由 plan 行的 basename 参与取 max（plan 行只换 cell、**不**从 `docRows` 里剔出），overall / spec 行补白与健康板逐字节相同 — checkable: FAIL（整行剔出会让最宽名变化）
- 写失败测（读源优先序）：`cdd board --plan X --spec Y`（同 slug）走 `readFor(specEntry)`，健康字节与单 `--spec` 板逐字节相同；两旗标 slug 不同仍走既有 exit 2 冲突拒 — checkable: 基线 PASS（防回归）
- 写失败测（程序面逐坏相位诊断）：一张程序板里一个文法坏的 plan 相位 + 一个健康相位——坏相位波次格 `! unparseable`、健康相位仍 `wave W1…`，stderr **恰一行** `CDD_WARN:` 且行内含坏相位的 `slug:`、健康相位零行，stdout 零字节变化，exit 0 — checkable: 定向 vitest FAIL（今日无逐相位词行）
- 写失败测（overall 板逐相位诊断）：overall 板下两个非 ready 相位（一个文法坏、一个读不出）各出一行 `CDD_WARN:`，行内带各自的相位 id — checkable: FAIL
- 写失败测（未索引的 ready plan 行）：plan 在派生路径上、读得到、文法合法，但未被索引收进去（`SlugIndex` 无对应条目）→ plan 行渲 `PlanRead.planLine(words)` 的**裸仓库相对路径**（不出现 `#entryMark` 的 `! unknown-slug` 标记、不进 `#docCell` 的 blocked），波次行仍为健康 `W1 {…}`，exit 0 — checkable: FAIL（今日 plan 行只有 `#docCell` 一条渲法）

#### Acceptance

- argv 面与声明面在坏 plan 上的变化点都**恰好三处**（plan 行、波次格、`next:`），其余逐字节相同；`next:` 为 hop-less `  next:    (none)`、无 `reason:` 行、不得等于健康 plan 的波次派生路由。
- 健康 plan 的板面、`next:`、`reason:`、程序面健康格 `wave W1…` 逐字节不变；真 undeclared 仍渲 `  wave     (none)` 且 exit 0。
- 四语义各一条 pin 且互不混同；`(empty plan)` 取自 `planEmptyWord()`，`""` 只属程序面的真 undeclared。
- argv 归类按 ①存在性 ②读字节 ③成员性 ④文法 的次序裁决；`cannot read` 不出板面（exit 2），`no docs match` 只承担两种非读取失败。
- `CDD_WARN:` 由 `Cli#runBoard` 写 stderr（overall 板逐相位一行带 id，程序面逐坏相位一行带 `slug:`），行数等于非 ready 相位数、健康相位零行，stdout 零字节变化；`BoardView.render` 仍是纯函数、不持 io 通道。
- plan 不在索引内时 plan 行走 `planLine(words)` 的裸相对路径：不触发 `#entryMark`、不进 `#docCell` 的 blocked，波次行与 exit 0 不受影响。
- `BoardView.planGraph` 不存在，板面没有第二个读取点。
- 反查三条：spec 行 `! no-spec`（非阻塞通道 ⇒ exit 0）、`next:` hop-less（`BoardNext` 的短路谓词与 §2.3 同一对：`kind !== "ready" || orphan() !== null`）、一行 stderr `CDD_WARN:`；格字面只有 `! no-spec` 一个，`spec-absent` 与 `slug-absent` 只是词法差别。
- 读源优先序：`--spec` 在场走 `readFor(specEntry)`（两旗标 slug 不同时既有 exit 2 先拦），只有 `--plan` 时走 `readPath`；`nameWidth` 的取 max 恒由 plan 行 basename 参与。

#### DependsOn

2, 4

---

### Task 6: 唯一构造点门

#### Objective

按 `docTypeParsers` 的**登记行为参数**落一条守卫：每个 doc key 的构造拼写（`new` + 该型的 `DocType` 类名 + 该 key 字面量）只许出现在两处——它自己的登记行，以及该 doc 型指定的唯一读取点（plan 的是 `infra/plan-source.ts`）。规则通用，plan 只是第一个受益者：防复发靠规则，不靠再写一条 plan 专属 grep。扫描面是生产源码（`**/__tests__/**` 排除——测试合法地直接构造解析器），同一测试另禁 `infra/plan-source.ts` 出现空 `catch`。此门在**未改动文件上为绿**（Task 3 已删 brief 的第二处解析），这是它与「先落门再改代码」的分界。

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
- 实现守卫（参数化 + 源码扫描 + 测试目录排除） — checkable: 全绿，且在改动前的树上为绿
- 全量回归 — checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/infra` 与 `pnpm exec tsc --noEmit -p packages/cdd-engine` 均 exit 0

#### Acceptance

- 守卫按 `docTypeParsers` 全行参数化：新增 doc 型自动进入扫描面，不需要改守卫。
- plan 的合法构造点恰两处（登记行 + `infra/plan-source.ts`）；`render/brief.ts` 不在其中（parser 协作者已删）。
- `**/__tests__/**` 排除生效（测试构造解析器不误报）；越界拼写的夹具能让守卫变红。
- `infra/plan-source.ts` 无空 `catch`。

#### DependsOn

2, 3

---

### Task 7: 三面一致性 + 验收收口

#### Objective

把「板面渲染的 wave 行 == `PreFlight` 判定所用 graph 的 wave 集 == frontier 路由的 wave 键」钉成一条结构测试（单进程内三集合都可达，不需要一次 CLI 调用同时看见三层），健康 plan 与坏 plan 各一条；随后逐条落 AC 的可见字节断言（`wave --task` / `branch` 面的 `CDD_BLOCKED:`、`--dry-run` 同在坏 plan 上 BLOCKED、`(empty plan)` 与 `(none)` 相邻 pin、`W1…` 健康格），补 changeset，跑完整 `pnpm run validate`。

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
- 补 changeset（cdd-engine minor） — checkable: `scripts/__tests__/changeset-levels.test.ts` 绿
- 全量验收 — checkable: `pnpm run validate` exit 0（含 `emit:check`、root / kairos / engine 三套测试、typecheck ×3、`check:dist-smoke`、`version-sync`、`check:no-bare-functions`）

#### Acceptance

- 三面一致性两条用例（健康 / 坏）在同进程内逐格相等，坏 plan 上三面同时降级而不互不一致。
- AC 的可见字节断言齐全：argv 与声明面各三处变化、`wave` / `branch` 面拒绝、`--dry-run` BLOCKED、四语义格面互不混同、`cannot read` 与 `no docs match` 的次序两条重叠用例。
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
| v0.7 | 2026-11-14 | 复评轮 plan-review-1（同一轮的重跑）校订两处随 F3/F4 合并而失效的任务归因：Task 5 的 Consumes 把 `scene.plan` 的产地由 Task 4 改回 **Task 3**；Task 4 的 `face/cli.ts` 文件条目拆清——`PlanSource` 的单次构造与 `Cli` 字段持有归本任务，场景两处供值归 Task 3。结构面（任务 id 集与 `DependsOn` 集）零改动，其余内容与 v0.6 一致 | Claude（kairos:cdd-fix · 2026-11-14） |
| v0.6 | 2026-11-14 | 编排器结构面提交（fix 1 的 rejected 两半）：依赖边按 D 裁决重排——`Task 3` 的 `DependsOn` 由 `1` 改为 `1, 2`（消费 Task 2 的 `PlanRead`），`Task 4` 由 `2` 改为 `2, 3`（消费 Task 3 落地的 `scene.plan`）。结构面不属评审轮（引擎把 `DependsOn` 集当结构基线，`face/lifecycle.ts:344` 快照、`:586-604` 比对），故由编排器单独提交 | Claude（kairos:cdd-plan · 2026-11-14） |
