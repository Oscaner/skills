---
title: 引擎文档工具（Engine Doc-Tooling）— P25 计划：写回判定的单源
doc-type: plan
version: v0.9
date: 2026-11-05
slug: 2026-10-10-engine-doc-tooling-p25
base: develop
---

## Constraints

- **逐字取 spec**：本计划只实现 `docs/kairos/specs/2026-10-10-engine-doc-tooling-p25-design.md` **现行 `version`**（v0.10）所指的面；spec 版本一变，本约束的字面同笔改。
- **纯重构**：任何消费面字节变化都是越界。`preview.test.ts` 的五条 `would record:` 断言（`:79` · `:101` · `:122` · `:144` · `:162`）**一行不改**即证据。
- **判定必须纯（由纯度文本门钉住，spec v0.7 §3）**：`legOf` 不读账本、不读文件、不接 verdict、不接 plan path——只凭 `(phase, kind)` 回答。门读 `reviewed-identity.ts` 时**先剥注释（行注释 + 块注释），再对剥后的代码文本断言**：(a) 无 `node:fs`、无 `readFile` / `readFileSync`（不读文件）；(b) 对 `./run.ts` / `./ledger.ts` 的 import 全是 `import type`（零值导入，拿不到账本）；(c) 代码里不出现 `targetAction` 与 `planPath` 两个词。剥注释是必须的：Step 2 要求在旁注里**点名**这两项不属于判定，不剥注释的门会与那条要求自相矛盾——门管的是**代码**不读它们（与「白名单消失门」不同，那道门计字面量原文**含注释**）。
- **参数类型不得放宽**：`phase: RoundPhase`（`session/ledger.ts:71` = `OpType | "branch-review"`）· `kind: AuditTarget["kind"]`（`session/run.ts:73-80`）。**禁用 `TargetType`**（它没有 `spec` 成员，会诱出第二张 type → 腿映射表）。
- **腿名与写方法 1:1**：`ReviewedLeg` = `doc` · `brief` · `branch`，各自一一对应 `#recordReviewedDocRevision`（`plan` / `spec` 共用，doc 路径从 `frame.target.doc` 取）· `#recordReviewedWaveBrief` · `#recordReviewedBranchRevision`（读 `#planPath`）。故记账侧是按腿派发的 1:1，`#bookkeep` 里**不再残留任何 kind 分支**；`branch` 独享一条腿名，因为它的 plan path 是**输入**而不是判定。
- **未列出的 kind 一律 `null`**：目标联合将来长出新成员时两面同一方式「不写」，绝不落成一次 doc 写回。
- **两处不对称保留并登记，不「修正」**：① `targetAction` 是真跑独有 ② `wave` + `planPath === null` 时真跑不写、预览仍陈述 `reviewedRevision(brief)`。两者都是既有且被字节冻结的行为。
- **结构门必须可红且必须写具体（本相位两条）**：禁用「全仓字面量计数」（会自匹配门自身的 pattern 串与 docstring）。按 spec v0.6 §3：**门①（白名单消失门）**——`frame.phase === "branch-review"` 在 `face/preview.ts` 与 `session/run.ts` 两文件的出现数为 0（`run.ts:844` 的 `phase === "branch-review"` 相位归一无关注，不计入）；**门②（声明单源门）**——`REVIEWED_WRITE_PHASES` 的声明只出现一次，作用域 `src-next/**/*.ts` **排除 `__tests__/`**（排除后门自身的 pattern 串不自匹配）。**结构门①「调用门」已于 spec v0.6 删除**：文件级匹配可被一句 docstring 满足（而本任务恰恰要求把陈旧 docstring 指到 `ReviewedIdentity`），锚到方法体的文本抽取又脆弱易误判——留一个可能是死的门不如不留；「两面真的调了它」改由 T2 的**三值矩阵**（`left == right == expected`）承担。
- **诚实标注门的限度**：换个写法（`includes([...])` / `Set` / 单引号）的副本会绕过字面量门；本相位不加更强的静态分析，限度写进注释。
- **零新依赖 / 零新命令 / 零环境变量**；changeset `@oscaner-skills/cdd-engine` **minor**——T1/T2 是纯重构（零字节变化），但 **T3 改变 fresh plan 的板面/胶囊输出**（`implement --plan …` → `route to /skill:cdd-dev skill`），属消费面可见字节变化；按 D74 取 minor（方法论契约未变，故不是 major）。

## Review Focus

- **两面同值但未来只改一面**：矩阵用例（`phase × kind × planPath`，只覆盖**可达格**，两侧都不许走 `legOf`）——左取 `Preview#render` 的 `would record:` 行，右取真跑后的账本绑定（`review` / `branch-review` 格比 ref kind，`fix` 格比 `doc_hash` / `brief_hash` 等不等于该轮判断输入的当前内容哈希——fix 轮已由同 key 的 review 绑过，只比 kind 恒绿）；两侧**共用一张期望表**（单一 oracle），落在**同一个**测试文件里。
- **只有一份**：两条结构门（白名单消失门 / 声明单源）；白名单门**今日必红**（两文件各一处）。「两面真的调了它」由矩阵三值断言承担（见上一条）。
- **判定自身的不变式**：`REVIEWED_WRITE_PHASES` × 每个 kind 的返回值逐格，以及未列出的 kind 与 `implement` × 四个 kind 一律 `null`——这两条是**运行时断言**（类型层不会把测试变红），落在 T1 的门测试里。
- **wave + 无 plan path 的既有不对称**：真跑不写、预览陈述 brief 腿——不得当成失败去「修」，必须单列一条断言把它**钉住**。
- **未列出的 kind**：不得落成 doc 写回（保守链）——由 T1 的**运行时 pin** 钉住（`legOf("review", "bogus" as AuditTarget["kind"])` 必须为 `null`）。
- **判定必须可证纯**：`session/reviewed-identity.ts` 的**代码文本**（剥掉注释后）不得出现 `targetAction` 或 `planPath` 字样；也不得读文件（无 `node:fs` / `readFile*`）、不得取运行时 import（对 `./run.ts` / `./ledger.ts` 只有 `import type`）——这是「判定只收 `(phase, kind)`」的可执行证据，不是口头承诺。**Step 2 的旁注豁免**：注释里点名 `targetAction` 与 plan path 正是要求的（见「两处不对称保留并登记」），门只断言代码。
- **陈旧 docstring**：`preview.ts:147-154`（「a SECOND copy… kept apart on purpose」）· `:165-171`（`#reviewedLegOf` 链描述）· `run.ts:726-745`（phase 门内联叙述）——改完必须不再声称有两份。

### Task 1: `ReviewedIdentity.legOf` + 两个调用点迁移 + 两条结构门 + 两条验收 pin

#### Objective

把「这一轮/这个 target 写不写、写哪条腿」收成一处纯判定，让 `#bookkeep` 与 `#recordsOf` 都调它；两面各自的 phase 白名单字面量与 kind 三分支消失。

#### Files

- Create: `packages/cdd-engine/src-next/session/reviewed-identity.ts`
- Modify: `packages/cdd-engine/src-next/session/run.ts`（`:746-752` 写回白名单 + kind 三分支；`:726-745` 的内联叙述注释）
- Modify: `packages/cdd-engine/src-next/face/preview.ts`（`:159` phase 白名单；`:172-178` `#reviewedLegOf`；`:147-154` 与 `:165-171` 的 docstring）
- Test: `packages/cdd-engine/src-next/session/__tests__/reviewed-identity.guard.test.ts`（新增：两条结构门 + 两条验收文本 pin + 纯度文本门 + `legOf` 与保守链的运行时单元 pin）

#### Consumes

- `RoundPhase`（`session/ledger.ts:71`）· `AuditTarget`（`session/run.ts:73-80`）· `Ledger#recordReviewedRevision` / `recordReviewedBrief`（既有，签名不动）
- **两个类型必须以 `import type` 取**：`session/run.ts` 反向 import `ReviewedIdentity`，值导入会把 `reviewed-identity.ts` → `run.ts` → `reviewed-identity.ts` 变成运行时静态环（`RoundPhase` 从 `ledger.ts` 取同样走 `import type`）。

#### Produces

- `type ReviewedLeg = "doc" | "brief" | "branch"`——三值与三个 `#record…` 方法**1:1**：`doc` → `#recordReviewedDocRevision` · `brief` → `#recordReviewedWaveBrief` · `branch` → `#recordReviewedBranchRevision`
- `REVIEWED_WRITE_PHASES: readonly RoundPhase[]`（判定文件内**唯一**声明：`review` · `branch-review` · `fix`）
- `ReviewedIdentity.legOf(phase: RoundPhase, kind: AuditTarget["kind"]): ReviewedLeg | null`

#### Steps

- [ ] **Step 1: 写两条门（先红）** — checkable: 门①「白名单消失门」今日 FAIL（实测 `preview.ts:159` 与 `run.ts:747` 各一处 `frame.phase === "branch-review"`）；门②「声明单源门」今日 FAIL（`REVIEWED_WRITE_PHASES` 不存在）；两门作用域按 Constraints（门②排除 `__tests__/`）
- [ ] **Step 2: 建判定文件** — checkable: `reviewed-identity.ts` 含 `ReviewedLeg`（三值）· `REVIEWED_WRITE_PHASES`（`review` / `branch-review` / `fix`）· `legOf`；类上带 `// biome-ignore lint/complexity/noStaticOnlyClass: <理由>`（先例 `faces.ts:137` 的 `TargetFaceTable`），并一句话写明「为什么是类而非箭头常量对象」；`legOf` **旁边**并列写明**三处**同址事实：① `targetAction` 是真跑独有、不属于判定 ② plan path 是**输入**而非判定（`branch` 因此独享一条腿名）③ `wave` + `planPath === null` 时真跑不写、预览仍陈述 `reviewedRevision(brief)`（既有、本相位保留）；`AuditTarget` / `RoundPhase` 用 `import type` 取
- [ ] **Step 3: 记账侧迁移** — checkable: `run.ts:746-752` 改写为**语句式**（不得写「条件里赋值」——`lint/suspicious/noAssignInExpressions` 会让 `pnpm run precommit` 直接红）：先 `const leg = record.verdict.targetAction ? ReviewedIdentity.legOf(frame.phase, frame.target.kind) : null;`，再 `if (leg !== null)` 按 `leg` 分派（`switch (leg)` 或 `if` 均可）；派发与三个 `#record…` 方法是 **1:1**，`run.ts` 里**不再残留任何 kind 分支**（`#recordReviewedDocRevision` 体内既有的 kind 收窄守卫保留不动——那是写方法自己的防御，不是判定）；三个方法本体**不动**（它们做写，不做判定）
- [ ] **Step 4: 预览侧迁移** — checkable: `preview.ts:159` 的 phase 白名单与 `:172-178` 的 kind 三分支改为 `const leg = ReviewedIdentity.legOf(frame.phase, frame.target.kind)`，`#reviewedLegOf` 退化成「腿 → 字符串」的渲染映射（`doc` / `branch` → `reviewedRevision(doc)`，`brief` → `reviewedRevision(brief)`）；`branch` 的 `#scene.planPath === null` 守卫**保留**在渲染映射里（那是输入，不是判定），故五条既有 `would record:` 行的字节不变
- [ ] **Step 5: 改写陈旧 docstring** — checkable: 三处不再声称「a SECOND copy … kept apart on purpose」（`preview.ts:147-154` · `:165-171` · `run.ts:726-745`），改为「判定在 `ReviewedIdentity.legOf`，两面共用；`targetAction` 与 plan path 是两面各自的输入；`wave` + 无 plan path 的不对称仍保留」。**硬约束（N1）**：改写后的 docstring **按相位名叙述**（review / branch-review / fix 这几个词），**不得复述** `frame.phase === "branch-review"` 这类比较式字面量——白名单消失门数的是**字面量原文，含注释**，注释里抄一句就把门留在红。
- [ ] **Step 6: 两条门转绿 + 两条验收 pin + 保守链与纯度 pin + 限度注释** — checkable: ① 两条结构门（白名单消失门 / 声明单源门）在 `reviewed-identity.guard.test.ts` 内全绿；② **验收文本 pin ①（`#bookkeep` 零 kind 分支）**——方法体切片自**签名行**起：用正则 `/^  #bookkeep\(frame: OpenFrame/m` 定位（`run.ts:675`），至下一个恰为 `  }` 的行止；**不得**按 `#bookkeep(` 的首次文本出现去切（`run.ts:463` 的 `this.#bookkeep(frame, …)` 是**调用点**，不是签名，按首现切会切错片）；切片先自检非空且含 `ReviewedIdentity.legOf(`，让切错的方法体**响亮失败**而不是空片恒绿，再断言片内 `frame.target.kind ===` 的出现数为 **0**；③ **验收文本 pin ②（零值导入）**——`reviewed-identity.ts` 中对 `./run.ts` 与 `./ledger.ts` 的每一条 import 行都以 `import type {` 开头，`run.ts` 反方向若需要 `ReviewedLeg` 这个类型必须用 `type` 修饰符形式（`import { ReviewedIdentity, type ReviewedLeg }`），不用普通具名导入；④ **纯度文本门**——读 `reviewed-identity.ts`，**先剥注释（行注释与块注释）再对代码文本断言**：(a) 无 `node:fs`、无 `readFile` / `readFileSync`；(b) 对 `./run.ts` / `./ledger.ts` 只有 `import type`；(c) 剥后的代码不出现 `targetAction` 与 `planPath`——**Step 2 要求的旁注因此豁免**，门管代码、不管注释；⑤ **`legOf` 运行时单元 pin（全仓唯一被允许直接调 `legOf` 的测试）**——逐格期望写成**手写字面表**，**不得**由 `REVIEWED_WRITE_PHASES` 迭代推导（那会让期望从被测常量里长出来，常量一错期望跟着错）；字面表的期望为三个白名单相位 `review` / `branch-review` / `fix` × 每个 kind 同形——`wave` → `brief`、`plan` → `doc`、`spec` → `doc`、`branch` → `branch`（相位只在白名单里起作用，kind → 腿的映射与相位无关），另单列一格断言 `REVIEWED_WRITE_PHASES` 恰等于 `["review", "branch-review", "fix"]`，并且 **`implement` × {`wave`, `branch`, `plan`, `spec`} 四格全 `null`**（`implement` 不是 `REVIEWED_WRITE_PHASES` 成员——这四格就是「相位不在白名单即不写」的 pin，归本步，不归 T2）；⑥ **保守链运行时 pin**——`legOf("review", "bogus" as AuditTarget["kind"])` 为 `null`；⑦ **限度注释**——写明「字面量门挡不住换写法的副本（`includes([...])` / `Set` / 单引号）」。
- [ ] **Step 7: 字节零变** — checkable: `preview.test.ts` 五条 `would record:` 断言**一行不改**仍绿；`pnpm -C packages/cdd-engine exec vitest run src-next` 全绿
- [ ] **Step 8: 提交** — checkable: `pnpm run precommit` 绿；`git commit -m "refactor(cdd-engine): one home for the write-back judgment"`

#### Acceptance

- 两条结构门存在且**今日必红**：**①白名单消失门**——`frame.phase === "branch-review"` 在 `face/preview.ts` 与 `session/run.ts` 两文件的出现数为 **0**（今日 `preview.ts:159` 与 `run.ts:747` 各一处 ⇒ 红），改完转绿，加回副本即重新红；**②声明单源门**——`REVIEWED_WRITE_PHASES` 的声明在 `src-next/**/*.ts`（**排除 `__tests__/`**）**恰一处**且落在 `session/reviewed-identity.ts`（今日无声明 ⇒ 红）。「两面真的调了它」**不**由结构门承担（调用门已按 spec v0.6 §3 删除），由 T2 的三值矩阵承担。
- `#bookkeep` 与 `#recordsOf` 都调 `ReviewedIdentity.legOf`；两文件再无 phase 白名单字面量。
- `ReviewedLeg` 三值与三个 `#record…` 方法 1:1，`#bookkeep` 里除 `switch (leg)` 外零 kind 判断——由 `reviewed-identity.guard.test.ts` 的文本 pin 钉住（`#bookkeep` 方法体内 `frame.target.kind ===` 计数为 0），不是只靠评审目检。
- `legOf` 是纯函数：不读账本 / 文件 / verdict / plan path——由**纯度文本门**（剥注释后无 `node:fs` / `readFile*`、对 `./run.ts` / `./ledger.ts` 只有 `import type`、代码不出现 `targetAction` / `planPath`）钉住，不是只写在旁注里；其运行时单元 pin 用**手写字面表**覆盖 `REVIEWED_WRITE_PHASES` × kind 全格、**`implement` × {`wave`, `branch`, `plan`, `spec`} 四格全为 `null`**（相位不在白名单即不写），以及未列出的 kind（→ `null`）；`REVIEWED_WRITE_PHASES` 另有一格断言恰等于 `["review", "branch-review", "fix"]`。
- `reviewed-identity.ts` 以 `import type` 取 `AuditTarget`（`./run.ts`）/ `RoundPhase`（`./ledger.ts`），无运行时静态环——同样是文本 pin：该文件对这两个模块的 import 行必须以 `import type {` 开头；`run.ts` 反方向取 `ReviewedLeg` 时必须用 `type` 修饰符（`ReviewedIdentity` 本身是值，值导入是本相位的调用前提）。
- 五条既有 `would record:` 断言零改动仍绿（纯重构判据）。
- 三处陈旧 docstring 不再声称有两份。
- `pnpm run precommit` 绿。

#### DependsOn

none

### Task 2: 三轴矩阵 + 两处不对称的显式断言 + changeset

#### Objective

证明「两面同值」而不依赖 `legOf`，并**钉住**两处既有不对称（不修正它们），最后落一条 patch changeset。

#### Files

- Create: `packages/cdd-engine/src-next/session/__tests__/reviewed-identity.matrix.test.ts`（矩阵 + 两处不对称断言；左右两侧共用**一张**期望表）
- Create: `.changeset/p25-one-write-back-judgment.md`
- Modify: `packages/cdd-engine/src-next/face/__tests__/preview.test.ts`——**只新增**一条 `branch` + `scene({ planPath: null })` 的 preview pin（spec v0.6 §4 的既有要求）；五条既有 `would record:` 断言**一字不改**，故「纯重构」判据仍成立
- 不动: `packages/cdd-engine/src-next/session/__tests__/run.test.ts`——矩阵**不**落进它，否则就是两张各写一遍的期望表，把要防的漂移搬进了测试

> 矩阵的家只有一个：`reviewed-identity.matrix.test.ts`（spec v0.6 §4）。证据形状取 spec §3（左取预览真实输出、右取真跑后的账本事实、两侧都不走 `legOf`）；`preview.test.ts` 按 §4 保留五条既有 pin **并新增一条**，不是矩阵的落点。

#### Consumes

- `Preview#render(op, frame)`（`preview.test.ts` 既有做法：内联 `DispatchScene` + 内联 `OpenFrame`，`planPath` 走 `scene({ planPath: … })`）· `Ledger#reviewedDocRevisionOf` / `reviewedRevisionOf`（既有）· `Lifecycle` + `targetFaces`（`run.test.ts` 既有做法：hermetic 临时 workspace + `planDoc` / `task` / `taskGraph` / `stub`）· `BriefRenderer`（可渲染的 brief 源）

#### Produces

- 无代码导出；测试矩阵、两处不对称断言与发行条目。

#### Steps

- [ ] **Step 1: 写矩阵（行为面，只覆盖可达格）** — checkable: **一张**共享 oracle 表同时驱动左右两侧，表列为 `{ phase, kind, planPath, preview, ledgerKey, ledgerKind, moved }`（`moved` 只有 `fix` 格为 `true`，其余为 `—`）；每格断言 **`preview == ledgerKind == 期望腿`**（三值，期望腿取自本表；`fix` 格把中间的 `== ledgerKind` 换成 `== 哈希 pin`，见下）——只做 `preview == ledgerKind` 不够：两面都流经 `legOf`，`legOf` 若返回错值两者仍同值。`preview` 是**渲染面的词**（`"doc"` / `"brief"` / `null`）：左侧据此断言 `would record:` 行以 ` · reviewedRevision(<preview>)` 收尾（`null` ⇒ 行里无 `reviewedRevision`）；**右侧按相位分两种判据**：`review` / `branch-review` 格断言 `ledger.reviewedRevisionOf(<ledgerKey>)?.kind === <ledgerKind>`（`doc` / `branch` 腿 ⇒ `"doc-revision"`，`branch` 取 key `branch`；`brief` 腿 ⇒ `"brief-revision"`，取 key `1`；`null` ⇒ 无写回）；**`fix` 格断言哈希，不断言 kind**——`reviewedDocRevisionOf(<ledgerKey>)?.doc_hash === sha1(<该格判断输入的当前内容>)`，wave 面同形取 `reviewedRevisionOf(<waveKey>)?.brief_hash === sha1(<该轮渲染出的 brief>)`。**这条哈希 pin 就是「fix 写回被丢掉」的探针（B1）**：`fix` 轮是绕过已完成的 `review` 轮到达的，而那条 review 已经用同一个 key、同一个 ref kind 绑过一次——真跑侧无论把 fix 写回全丢了、还是只丢了一半，`reviewedRevisionOf(<key>).kind` 都**恒绿**；哈希才说出「写回停在哪一轮」。doc 格的 `ledgerKey` 是该格所用 face 的 key（`kind: "plan"` → `"plan"`，`kind: "spec"` → `"phase-spec"`）；**两侧都不许调用 `legOf`**。可达格（`implement` 只在 wave 线派发，`branch-review` 只在 branch 线派发）：

  | 相位 | 可达 kind | `planPath` 有 | `planPath` 无 |
  | --- | --- | --- | --- |
  | `implement` | `wave` | 无腿 · 无写回 | 无腿 · 无写回 |
  | `review` | `wave` | `brief` · `brief-revision` | **不对称 ②**：`brief` · 无写回 |
  | `review` | `plan` · `spec` | `doc` · `doc-revision` | 同格（`planPath` 轴对 doc kind 无意义，不重复断言） |
  | `fix` | `wave` | `brief` · `brief-revision` | **不对称 ②**：`brief` · 无写回 |
  | `fix` | `plan` · `spec` | `doc` · `doc-revision` | 同格 |
  | `branch-review` | `branch` | `doc` · `doc-revision` | 无腿 · 无写回（**本相位新增的独立 pin**，断言里显式写 `scene({ planPath: null })`） |
  | `fix` | `branch` | `doc` · `doc-revision` | 无腿 · 无写回 |

  跳过格**按名列出并给原因**，不静默省略：`implement × branch|plan|spec`（`implement` 只在 wave 线派发）· `branch-review × wave|plan|spec`（`branch-review` 只在 branch 线派发）· `plan` / `spec` 的 `planPath` 轴（同格，不重复断言）。
  夹具：wave 格必须给出**可渲染的 plan 与 brief 源**（`planDoc` + `task` + 一个真实存在的 `planPath`，让 `#recordReviewedWaveBrief` 走真写回），否则真跑侧落进「无 plan fact」分支，测的就不是判定；`fix` 格靠 `stub` 让 review 完成轮带一条 `warn` finding，再 `advance()` 到 fix 轮；**并且 `fix` 格的判断输入必须真的移动**（`moved: true`）——在 review 完成之后改写被审的 `plan` / `spec` 内容，wave 面改写该 wave 的任务段或 plan 的 `## Constraints`，让渲染出的 brief 变。移动点二选一，以真跑路由为准：落 review→fix 的空隙（若改文档会让 `advance()` 改道回 review 就不行）或由 fix 轮的 `stub` 在返回裁决前完成（clean-tree 门在派发前，轮内改动不堵路由）。用例先钉一句 **`reviewHash !== fixHash`**：输入没动，该格就是惰性的，必须**响亮失败**而不是静默变绿。
- [ ] **Step 2: 补 `preview.test.ts` 的新 pin（W2）** — checkable: `face/__tests__/preview.test.ts` 新增**一条** `it(...)`：`branch` 面 + `branch-review` 相位 + `new Preview({ scene: scene({ planPath: null }), env: {} })`，断言 `would record:` 行止于本轮记录、**不带** ` · reviewedRevision(...)`（无 plan fact ⇒ 无腿），且 `reads:` 行不出现 plan 路径；五条既有 `would record:` 断言一字不改
- [ ] **Step 3: 登记并断言两处不对称** — checkable: ① `targetAction === false`（`stub` 返回 `BLOCKED`）时真跑不写、预览仍陈述腿——一条断言钉住 ② `wave` + `planPath: null` 是 oracle 表里的一格（`preview: "brief"` · `ledgerKind: null`），另在用例里单列一句断言陈述「预览陈述 brief 腿 · 账本无写回」；两者都写明「这是既有行为，本相位不修正」
- [ ] **Step 4: 未列出的 kind 不建格** — checkable: 矩阵不为目标联合之外的 kind 建格（派发不产生），保守链由 T1 的 `reviewed-identity.guard.test.ts` 用**运行时断言**钉住（`legOf("review", "bogus" as AuditTarget["kind"])` 与 `legOf("implement", "wave")` 均为 `null`），本任务不重复
- [ ] **Step 5: changeset** — checkable: `.changeset/p25-one-write-back-judgment.md` front-matter 为 `"@oscaner-skills/cdd-engine": patch`，正文说明「纯重构：写回判定收成一处纯判定，消费面字节零变」
- [ ] **Step 6: 全量验收** — checkable: `env -u AI_AGENT pnpm run validate` 退出码 0
- [ ] **Step 7: 提交** — checkable: `git commit -m "test(cdd-engine): pin the two write-back faces to one judgment"`；`git status --porcelain` 为空

#### Acceptance

- 矩阵只覆盖上表的**可达格**；跳过格按名列出并给出原因，不再声称「`4 phase × 4 kind × 2 planPath` 逐格」——派发形状由 `faces.ts` 的 `product.reviewLead` 决定，不可达的格在真跑侧根本建不出来。
- 左右两侧共用**同一张**期望表（单文件 `reviewed-identity.matrix.test.ts`），两侧都**不经** `legOf`；`review` / `branch-review` 格改动前后**同值**（今日两面恰好一致，故它们是防「未来只改一面」的回归 pin，不是必红）。
- **`fix` 格可红在「fix 写回被丢掉」上**：夹具让判断输入在 review 与 fix 之间移动（先断言 `reviewHash !== fixHash`，否则该格惰性且必须响亮失败），右侧断言 `doc_hash` / `brief_hash` 等于 fix 轮输入内容的哈希——只比 ref kind 的 `fix` 格是**惰性**的（B1），矩阵里不许留。
- `preview.test.ts` 只**新增**一条 `branch` + `planPath: null` 的 pin，五条既有 `would record:` 断言零改动（纯重构判据不被新 pin 动摇）。
- 两处既有不对称各有一条断言钉住（① `targetAction === false` ② `wave` + `planPath: null`），注释写明「不修正」；`branch-review × branch × planPath: null` 一格有独立 pin。
- 未列出的 kind 的保守链由 T1 门测试的运行时断言覆盖（矩阵不重复）。
- changeset 为 `patch`。
- `env -u AI_AGENT pnpm run validate` 退出码 0。

#### DependsOn

1

### Task 3: wave 面的「未进入」判据（§6 · 面层、active 与 target 同时清空）

#### Objective

让 `PipelineFrontier` 不再把「wave 面从未进入」读成「该面已进入」：**面层**进入判据为「该 plan 的任务图存在且任一波有任何轮记录」，为假时 wave 面 `active` 与 `target` **同时置 null**，frontier 于是走 `#pipeline` 规则③（未进入 ⇒ 取前一个已进入面的 exit），渲 plan 面的出口 = `route to /skill:cdd-dev skill`；一旦有任一 wave 轮记账，两面恢复为 `waveLineRoute(...)` 与「该批次的 wave target」。

**为什么必须同时清 `target`**（review 4 的 blocker）：`#pipeline` 的规则② 判「`active === null` 且 `target !== null`」⇒ 渲**该面自己的 exit**（`PIPELINE_NEXT.wave` = `review --type branch --plan <plan>`），不是规则③。只清 `active` 会让 fresh plan 印出 branch review 字面，而不是 `cdd-dev`。

**为什么判据必须在面层**（review 4 的第二个 blocker）：`#waveKeyOf` 是 ready batch，批次 1 闭合后批次 2 的 key 自然零轮记录；若按 key 判，每个**批次之间**都会误退回 handoff。面层判据用「任一波有轮记录」，避免这个抖动。

#### Files

- Modify: `packages/cdd-engine/src-next/session/pipeline.ts`（`#waveState`：`active` 与 `target` 的产出条件）
- Test: `packages/cdd-engine/src-next/session/__tests__/pipeline.test.ts`（必红 + 孪生回归 + 批次间不抖）

#### Consumes

- `Ledger#roundCount(key, mode, identity?)`（`session/ledger.ts:716-719`）——**key 用该波的行键 `String(waveKey)`**（与 `waveLineRoute(waveKey)` 同一把钥匙），`identity` **不传**（wave 行不带 type identity，传了会走 `rowFor` 的 retired-spec 回退）
- `TaskGraph#batches()` / `#frontier`（既有，经 `PipelineFrontierInput.planGraph`）· `Ledger#waveLineRoute(waveKey)`（既有）

#### Produces

- 无新导出；行为变化——wave 面未进入时 `active` 与 `target` 均为 `null`。

#### Steps

- [ ] **Step 1: 写必红用例** — checkable: 夹具 = plan 已收口 + 有任务图 + **任一波零轮记录**；断言 `PipelineFrontier.next(...)` 的 route 为 `{ kind: "handoff", entry: { ref: "kairos:cdd-dev" } }`——今日为 `{ kind: "next-wave", tasks: "1" }` ⇒ FAIL
- [ ] **Step 2: 写批次间不抖用例** — checkable: 构造「批次 1 已闭合、批次 2 零轮记录」（面已进入，因为波 1 有轮记录），断言 route 仍为 `{ kind: "next-wave", tasks: "<batch2>" }`，**不得**退回 `handoff`
- [ ] **Step 3: 写孪生回归用例** — checkable: 同一「从未进入」夹具里记一条 wave 轮（`implement`，`targetAction` 任意）后，route 回到 `next-wave` / `review` 字面
- [ ] **Step 4: 实现面层进入判据** — checkable: `#waveState` 增 `entered = graph !== null && <任一波 roundCount_sum > 0>`；`active = entered && waveKey !== null ? ledger.waveLineRoute(waveKey) : null`；`target = !entered || input.planPath === null ? null : { type: "wave", id: waveKey ?? "", plan: input.planPath }`。任一波的扫描用 `graph.batches()`（或既有 ready-batch 派生）逐批取 key 再 `roundCount` 求和
- [ ] **Step 5: 板面侧同源** — checkable: 同一夹具下 `cdd board` 的 `next:` 行为 `route to /skill:cdd-dev skill`、`reason:` 为 **`closed-line`**（`reasonOf` 对 handoff 路由映射到 `closedLine`，评审自身的指导词 `task-open` 已在 W1 实现后成立，但装配层跟换为 `PipelineFrontier` 后该路由的 reason 改为 `closed-line`）
- [ ] **Step 6: 跑套件 + 提交** — checkable: `pipeline.test.ts` / `board-view.test.ts` / `capsule.test.ts` / `cli.test.ts` 全绿；**既有 `next:` 断言若依赖「fresh plan 印 implement」，逐条重锚并在提交信息里点名**；`pnpm run precommit` 绿；`git commit -m "fix(cdd-engine): an unentered wave face hands off to cdd-dev"`
- [ ] **Step 7: 本波验收** — checkable: `env -u AI_AGENT pnpm run validate` 退出码 0

#### Acceptance

- plan 已收口 + 有任务图 + 任一波零轮记录 ⇒ route 为 `handoff → kairos:cdd-dev`（改动前必红）；板面 `next:` 同值、`reason:` 为 **`closed-line`**（规则③ 走 `handoff` 路由 ⇒ `reasonOf` 映射到 `closedLine`）。
- **批次间不误退**：批次 1 闭合、批次 2 零轮记录时 route 仍为 `next-wave`（面层判据，不是 per-key）。
- 记一条 wave 轮之后 ⇒ 恢复 `implement` / `review` 字面（孪生回归 pin）。
- `planGraph === null` / `planPath === null` 的既有分支行为零变。
- 既有 `next:` 断言若有依赖「fresh plan 印 implement」的，重锚逐条在册。
- `env -u AI_AGENT pnpm run validate` 退出码 0。


#### DependsOn

1, 2

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-11-05 | 初稿：两任务两波——T1 判定本体 + 两调用点迁移 + 三条结构门（门②今日必红）· T2 三轴矩阵（两侧不经 `legOf`）+ 两处不对称钉住 + patch changeset | Oscaner M. · Claude（kairos:cdd-plan · 2026-11-05） |
| v0.2 | 2026-11-05 | **评审第 1 轮 fix（九条 findings 全接受 · 作者裁定入文）**：① 腿类型三值 `doc`/`brief`/`branch`，与三个 `#record…` 方法 1:1，记账侧不再残留 kind 分支（spec §2 同笔改 v0.4）② Step 3 改语句式，去掉条件内赋值（biome `noAssignInExpressions` 会红）③ 三条门按 D26 锚到 `#bookkeep` / `#recordsOf` 方法体，写明门③只扫判定文件、两消费者文件零 `REVIEWED_WRITE_PHASES` ④⑤ 矩阵改「可达格 + 显式跳格清单 + 单文件单 oracle」，删掉 `4×4×2 = 32 格`算术 ⑥ `legOf` 的运行时单元 pin 落 T1 门测试（含未列出的 kind → `null`）⑦ Step 2 列三处同址事实，plan path 那条写在 `legOf` 旁边 ⑧ `import type` 避开运行时静态环 ⑨ 补文件末尾换行 | Oscaner M. · Claude（kairos:cdd-plan · 2026-11-05） |
| v0.3 | 2026-11-05 | **吸收 spec v0.5（编排器对齐）**：① 范围锁 v0.4 → **v0.5** ② **结构门三条 → 两条**（删「调用门」——文件级匹配可被 docstring 满足、锚方法体又脆弱；「两面真的调了它」改由矩阵承担） ③ 门② 作用域钉死 `src-next/**/*.ts` 排除 `__tests__/` ④ 矩阵纪事由「两侧同值」改 **三值 `preview == ledgerKind == 期望腿`**（`legOf` 返回错值时两者仍同值，必须三值才封住） ⑤ Acceptance 同步 ⑥ 签名 `\| null` 已在 spec v0.5 §4 补齐（落点：Constraints · Review Focus · Task 1 S1/S6 · Task 2 S1 · Acceptance · Change history） | Oscaner M. · Claude（kairos:cdd-plan · 对齐回填 · 2026-11-05） |
| v0.4 | 2026-11-05 | **评审第 2 轮 fix（六条 findings 全接受 · 作者裁定入文）**：① **B1 矩阵右侧 oracle 从「ref kind」改「哈希」**——`fix` 格断言 `doc_hash` / `brief_hash` 等于该轮判断输入的当前内容哈希；fix 轮经 review 轮先进、同 key 同 kind 已绑过，kind 判据看不丢写回；夹具必须让 fix 输入移动并先断言两侧哈希不等（spec §3 同笔改 v0.6）② **W1** Task 1 Acceptance 改两条门 + 正确归属（白名单消失门今日必红；调用门已删）③ **W2** `preview.test.ts` 由「不动」改「新增一条 `branch` + 无 plan path 的 pin」，删掉 spec §4 落点的陈旧引注 ④ **N1** Task 1 Step 5 补「按相位名叙述、不复述比较字面量」⑤ **N2** 本表 v0.3 行（实为八格，`\| null` 未转义又劈了两格）改回四格 ⑥ **N3** 两条缺 pin 的验收各补一条文本 pin（`#bookkeep` 体内零 `frame.target.kind ===` · `reviewed-identity.ts` 的 import type） | Oscaner M. · Claude（kairos:cdd-plan · plan fix 2 · 2026-11-05） |
| v0.5 | 2026-11-05 | **吸收 spec v0.7**：① 范围锁 v0.6 → **v0.7** ② 补**两条 pin**（spec 第 3 轮 W1）：**纯度文本门**（`reviewed-identity.ts` 不含 `targetAction` / `planPath` 字样、不 import 状态读取面）+ **保守链运行时 pin**（未列举 kind 返回 `null`——矩阵碰不到它，因为矩阵禁止调 `legOf`）③ 落点：Constraints · Task 1 S6 · Acceptance · 本表 | Oscaner M. · Claude（kairos:cdd-plan · 对齐回填 · 2026-11-05） |
| v0.6 | 2026-11-05 | **plan 评审第 3 轮 fix（五条 findings 全接受 · 作者裁定入文）**：① **W1 纯度门先剥注释再断言**——Constraints / Review Focus / Step 6 三处统一为 spec v0.7 §3 的口径（先剥行注释与块注释，再对代码文本断言不含 `targetAction` / `planPath`），并补齐 spec §3 的两条子断言（无 `node:fs` / `readFile*`；对 `./run.ts` / `./ledger.ts` 只有 `import type`），明确 Step 2 的旁注豁免 ② **W2** 补 `implement` 四格（`wave` / `branch` / `plan` / `spec` → `null`）的所有者：Task 1 Step 6 与 Acceptance（不归 T2）③ **N1** 本表 v0.5 行五格 → 四格（落点并入 summary）；**并立规矩：`docs/kairos` 的 change-history 行一律四格** ④ **N2** 锚点 `preview.ts:147-158` → **`:147-154`**（Review Focus · Files · Step 5 三处；`:155-158` 已是 `#recordsOf` 代码起始）⑤ **N3** `#bookkeep` 切片锚到**签名行 `run.ts:675`**（正则定位，点名 `run.ts:463` 是**调用点**），且 `legOf` 逐格期望改为**手写字面表** + `REVIEWED_WRITE_PHASES` 恒等于三值 | Oscaner M. · Claude（kairos:cdd-plan · plan fix 3 · 2026-11-05） |
| v0.7 | 2026-11-05 | **范围追加（用户裁定 · 对齐 spec v0.8 §6）**：新增 **Task 3**「wave 面的未进入判据」——`PipelineFrontier` 的 wave `active` 在 `roundCount` 三 op 之和为 0 时置 `null`，使 fresh plan 渲 `route to /skill:cdd-dev skill` 而非 `implement`；必红 + 孪生回归 + 既有断言重锚逐条在册；changeset 级别 patch → **minor**；`DependsOn: 1, 2` ⇒ 新波 W3 |
| v0.8 | 2026-11-05 | 吸收 spec v0.9/v0.10（面层进入判据）: Task 3 由 per-key 改为面层（补批次间不抖用例 · `roundCount` 拼法注明 · 锁改 v0.10） | Oscaner M. · Claude（kairos:cdd-plan · 2026-11-05） |
| v0.9 | 2026-11-05 | B1 changeset minor，B2 `reason: closed-line`，W2 删游离的 `1, 2`，N1 v0.8 行改四格 | Oscaner M. · Claude（kairos:cdd-plan · 2026-11-05） |
