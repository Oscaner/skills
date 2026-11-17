---
title: 'P38 · 派发输入契约：必填表、`none` 表示法与 `dispatch-input` 门'
doc-type: plan
version: v0.5
date: 2026-11-17
slug: 2026-11-17-engine-doc-tooling-p38-design
base: develop
---

## Constraints

- **声明只声明，不改字节**：与 spec 的 Constraints 同形——除 spec §2.3 点名的**四处**反转（① ② ③ ④）与 spec §3.3 / §5.1 的两句 shell 新文本（四份 shell 各带 `scratch/` 那句、`FIX_SHELL` 与 `DOCS_FIX_SHELL` 各带 `none` 半句）之外，任何一轮的 dispatch prompt 逐字节不变；`$version` 由 24 递增到 25 是「prompt 字节已变」的唯一机械信号。T1 Step 4 的 `none` 渲染（反转 ③）与它翻掉的三处旧钉因此写在清单里，而不是被一句「其余不变」吞掉。
- **合法缺席与漏传必须可区分**：`when` 不命中的格是「没有这一格」，requiredOn 命中的空值是 `empty-value`，两者不得塌成同一个状态。
- **不新增 CLI 动词、不改 `next:` 字面**：门的失败面走既有 `CDD_BLOCKED` 通道（`#blocked`）。
- **不加白名单、不加 `census:<id>`、不写全表快照**：三者分别是「用登记代替结构」「用计数代替判据」「用快照代替语义」。
- **pin 写法**：路径 + 符号，不用行号；尚未在源树出现的词汇只进围栏块，行内用裸词（pin 门按源码标识符全集判，写进反引号即红）。
- **前向声明写法**：本计划将创建的文件写在 `- Create: <path>` 行——pin 门的时间面只读这一种形状，因此它是「未来会存在」的声明；既有文件写 `- Modify:`，写入既有测试文件的追加写 `- Test:`。新建的测试文件同样走 `- Create:`，否则它的路径在落地前就是一条死 pin。
- **引擎只拒不改**：门拒绝后不移动、不改写、不删除任何产物；恢复动作归编排器。
- **P39 边界**：本相位不拆 `render/templates.ts` · `face/lifecycle.ts` 的类，只改声明与门；god object 拆分是 P39。
- 零裸函数：新逻辑进类（`biome-ignore lint/complexity/noStaticOnlyClass` 只在真正静态语料面上用），类 ≤200 行、方法 ≤4 参数。

### Task 1: 声明形状：ContextLine 与构造期断言

#### Objective
把每个 mode 的 round context 从 `readonly string[]` 升格为逐行声明，并在装配器构造期断言声明的自洽性——死格与覆盖缺口在**类建不起来**时就红，而不是等到某一次派发。

#### Files
- Modify: `packages/cdd-engine/src-next/render/templates.ts`（`ModePromptRow` / `TemplatePrompt` 类型、四个 row 的 layout、`TemplateAssembler` 构造期的断言入口、可选注入位与行选择读面；`#assertShellLayout` 的判据迁入新入口后，该方法与 `#gate` 里的调用点一并删除）
- Modify: `packages/cdd-engine/src-next/render/__tests__/render.test.ts`（三笔：① P31 §2.5 的 fix 轮 `INPUT_RULINGS` 零行旧钉，翻成裸词 `none` 并注明 deliberate；② `roundContext` 的四处形状 pin 改读逐行声明对象的 `.line`——对象数组上 `join` 得到 `[object Object]`，那条 `not.toContain` 的反面臂不改则转为真空绿；③ shell↔layout 的 per-render 旧钉改写成构造期臂——注入带 rogue row 的契约、断言 `new TemplateAssembler(contract)` 抛同一报文）
- Modify: `packages/cdd-engine/src-next/face/__tests__/lifecycle.test.ts`（同一旧钉的两处零行断言，同一翻新）
- Create: `packages/cdd-engine/src-next/render/__tests__/context-lines.test.ts`

#### Consumes
- `TargetType`（`session/faces.ts`）——`"phase-spec" | "overall" | "plan" | "single-spec" | "wave" | "branch"`
- `WorkMode`（`render/templates.ts`）——`"implement" | "fix" | "review" | "docs-fix"`

#### Produces
```ts
export interface RequiredArm {
  readonly types: "always" | readonly TargetType[];
  readonly when?: "program" | "identity";
}
export interface ContextLine {
  readonly line: string;
  readonly path?: true;
  readonly absent: "drop" | "none";
  readonly requiredOn: readonly RequiredArm[];
  readonly preview?: "value" | "satisfied";
}
```
- `ModePromptRow` 增 `readonly serves: readonly TargetType[]`（该 row 真正渲染的 type 集：`implement` → `["wave"]`；`fix` → `["wave", "branch"]`；`docs-fix` → 四个文档面；`review` → 六个），`roundContext` 改为 `readonly ContextLine[]`
- 注入位（断言可写的前提：一个被变异的声明必须能被送进装配器）：
```ts
constructor(contract: TemplatePrompt = TEMPLATE_PROMPT)
```
- `TemplateAssembler` 构造函数调用 `#assertDeclarations()`（私有方法，构造期一次性）；`#assertShellLayout` 的 shell↔layout 判据搬进它，该方法随之删除——同一事实只有一个家，不留第二份覆盖堆栈
- 行选择与声明表的唯一读面（T2 的门读它，不另写一套 row 选择）：
```ts
layoutOf(values: TemplateValues): readonly ContextLine[];
```
- layoutOf 是「这一轮是哪一行、那一行声明了哪些格」的唯一答案：装配器自己的 `#rowOf` + `row.roundContext` 走它，T2 的门也只走它——row 选择因此只有一个家，门里不出现第二份 review-vs-work 分支

#### Steps
- **Step 1**：写失败测试 `context-lines.test.ts`，六条断言各一个 `it`——(a) 死格：临时构造一条臂，其 type 落在 `fix` row 的 `serves` 之外（`overall`）⇒ 构造抛错且报文点名该 token 与 `overall`；(b) shell↔layout·删声明方向：从 `review` 的 layout 里删掉 `INPUT_SPEC` 那一行（该 row 的 shell 正文仍点名它）⇒ 构造抛错且报文点名 `INPUT_SPEC`；(c) 槽注册·多槽方向：给某 row 的 layout 加一个登记表里没有的 `{{TOKEN}}` 槽 ⇒ 构造抛错且报文点名该槽；(d) zone 覆盖·登记无载体方向：给注入契约的 `tokens` 加一个 zone 为 round-context 的登记名，而任何 row 的 layout 都不携带它 ⇒ 构造抛错且报文点名该 token（(b) 与 (d) 是两个独立方向，把一个写成另一个的逆命题会让两臂同时绿或同时红，任一方向的缺失都测不出来）；(e) `never` 形态合法：`INPUT_RULINGS` 与 `docs-fix` 的 `WAVE` 声明为一条臂且 `types` 为空数组 ⇒ 构造**不**抛（`never` 是合法声明，不是无信息声明）；(f) 在册契约 ⇒ 构造不抛。— checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/render/__tests__/context-lines.test.ts` 六条全红（ContextLine 尚未存在，报错或类型缺失）。
- **Step 2**：在 `templates.ts` 定义 RequiredArm / ContextLine（围栏块内的两个 interface），给 `ModePromptRow` 加 `serves`，把四个 row 的每一行改写为声明对象——取值逐行照 spec §1.4 的表：`INPUT_*` 六个读入格 `path: true`；`INPUT_RULINGS` 的 `absent: "none"` 与「一条臂、`types` 为空数组」（spec §1.1 的 `never` = `{ types: [] }`；`docs-fix` 的 `WAVE` 同形），其余 `absent: "drop"`；`INPUT_WAVE_BRIEF` 加 `preview: "satisfied"`；`OUTPUT_*` / `WORKSPACE_*` / `ROLE` / `TARGET_TYPE` / `WAVE` / `BASE_BRANCH` 按表给 `always` 或 type 集；`## Round context` 标题行与空行同样是 `never` 形态（一条臂、`types` 为空数组）；同一批里把 `render.test.ts` 那四处 `roundContext` 形状 pin 改读逐行声明对象的 `.line`（含 `not.toContain` 的反面臂——不改则它检查的是一条永远为真的断言）。— checkable: `pnpm -C packages/cdd-engine exec tsc --noEmit -p packages/cdd-engine` 无错。
- **Step 3**：实现 `#assertDeclarations()`：四条判据，一处家——(a) 死格：每条臂的 `types` 是 `"always"` 或该 row 的 `serves` 的子集；(b) **槽注册**：任一 row 的 round-context 行里出现的每个 `{{TOKEN}}` 槽，都必须是 `TOKENS` 中 zone 为 round-context 的注册名（一个没登记的槽指向一个永不被供给的值）——这一条让 Step 1(c) 红；(c) **shell↔layout**：该 row 的 shell 正文点名（`INPUT_*` / `OUTPUT_*` / `BASE_BRANCH`）的每个 round-context 名，必须被该 row 自己的 layout ∪ 共享的 return 尾携带——判据逐字搬自 `#assertShellLayout`，搬完**删掉该方法**，并**删除** `#gate` 里对它的调用点——构造期的一次断言已经覆盖每一行，不保留 per-render 的全表重跑；这一条让 Step 1(b) 红（删掉一行声明后 shell 仍在点名它）；(d) **zone 覆盖**：`TOKENS` 里每个 zone 为 round-context 的登记名，至少被一个 row 的 layout 携带（问的是 (b) 的反面：登记的 token 有没有载体）——这一条让 Step 1(d) 红。**没有第五条**：`never` 形态（一条臂、`types` 为空数组）是合法声明（spec §1.3——构造期唯一的死格是命名了该 row 从不服务的 type），因此一个携带槽的行可以只挂一条空 `types` 的臂；「删掉一行声明」也不再是一条独立的覆盖判据——它由 (c) 的 shell↔layout 兜住，而不是由一条「声明携带自己」的循环判据兜住。同一批里把 `render.test.ts` 那条 shell↔layout 的 per-render 旧钉改写成构造期臂——注入一个带 rogue row 的契约（row 带新的 `serves` 格），断言 `new TemplateAssembler(contract)` 抛同一条报文；不改写它必红：类级 `assembler` 在变异之前就已建成，`render` 不会再抛，而现场新建一个则是构造函数抛。— checkable: Step 1 的六条测试由红转绿。
- **Step 4**：让 `#contextLines` 只答 `absent` 这一面，不判 exigibility：值非空 ⇒ 渲染该值；空且 `absent: "drop"` ⇒ 整行消失；空且 `absent: "none"` ⇒ 渲染裸词 `none`。**渲染层没有第四态**：exigible 的空值到不了 `render()`——T2 的门在派发期先拒（`empty-value` / `target-absent`），`when` 的声明既不进 `TemplateValues` 也不进装配器，装配器不新增 exigibility 输入；一个「exigible 却照常渲染为空值」的分支描述的是代码路径到不了的状态，本相位正是要消掉这一类。同一批里翻掉 P31 §2.5 的三处旧钉：`render/__tests__/render.test.ts` 的「无 sidecar ⇒ 零行」与 `face/__tests__/lifecycle.test.ts` 的两处零行断言，改成「行恒在 · 值为裸词 `none`」，两处注释标注 deliberate（D74）——这是本相位点名的一处**故意翻钉**，不是「期望值悄悄变了」。— checkable: 新增三条测试（`INPUT_RULINGS` 空值渲出 `none`；`overall` 面无 `INPUT_SPEC` 整行；**drop 格的数据驱动遍历**——照 Task 2 Step 1(h) 的形状遍历声明表，对每个 `absent: "drop"` 的格各播一个空值，断言该行消失且其余 round context 逐字节不变）与翻新后的三处断言转绿。
- **Step 5**：跑 render 面与翻过钉的 lifecycle 面，确认没有别处依赖旧的 `string[]` 形状。— checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/render/ src-next/face/__tests__/lifecycle.test.ts` 全绿。
- **Step 6**：提交，提交信息点名 P31 §2.5 的 deliberate 翻钉。— checkable: `git log --oneline -1` 显示本任务的提交且信息含 deliberate，`git status --short` 为空。

#### Acceptance
- 死格、shell↔layout（删声明方向）、槽注册（多槽方向）、zone 覆盖（登记无载体方向）四条判据各自在构造期抛错，报文点名 token 与 offending type；`never` 形态（一条臂、`types` 为空数组）不抛；`#assertShellLayout` 已删除，`#gate` 里对它的调用点一并删除（构造期已覆盖全表，不留 per-render 重跑）。
- 在册契约构造不抛；`templates.ts` 的四份 layout 逐行带声明，`INPUT_RULINGS` 是唯一的 `absent: "none"`，`INPUT_WAVE_BRIEF` 是唯一的 `preview: "satisfied"`；挂 `never` 形态（一条臂、`types` 为空数组）的 **token 行**只有 `INPUT_RULINGS` 与 `docs-fix` 的 `WAVE` 两处（`## Round context` 标题与空行同形，但它们没有值可比，不在这一计数里）。
- 渲染层三态逐态可测：非空渲染该值；`none` 态渲成裸词；`drop` 态由整表遍历钉住——每个 `absent: "drop"` 格播空值 ⇒ 该行消失且其余 round context 逐字节不变。第四态（exigible 空值）不在渲染层：渲染层不接收 exigibility 输入，exigible 的空值由 T2 的门钉住。
- P31 §2.5 的三处旧钉翻新并标注 deliberate，本任务的提交信息点名它。
- `pnpm -C packages/cdd-engine exec vitest run src-next/render/ src-next/face/__tests__/lifecycle.test.ts` 绿。

#### DependsOn
none

### Task 2: `dispatch-input` 纯读门与门序

#### Objective
在 child 存在之前判「这一轮成立吗」：必填格为空、路径格不存在、结构前提声明了却解析不到，各自成一条拒绝，全部违规格一次报完；门是纯读，排在 artifact 门之前，被拒不占轮次、不留 in-flight 记录。

#### Files
- Modify: `packages/cdd-engine/src-next/face/lifecycle.ts`（`CliLifecycle` 的派发前判定面、`DispatchScene` 的两个声明格、`#valuesOf` 的消费点）
- Modify: `packages/cdd-engine/src-next/face/words.ts`（`Words` 的 dispatchInput 报文器）
- Modify: `packages/cdd-engine/src-next/face/cli.ts`（`#sceneOf` 交出两个声明格、`#lifecycleOf` 把两个格写进 scene 字面量）
- Test: `packages/cdd-engine/src-next/face/__tests__/lifecycle.test.ts`（全量 sweep：每个派发 wave 面的 scene 都落盘 brief、给 `baseBranch`）
- Test: `packages/cdd-engine/src-next/face/__tests__/cli.test.ts`（三类：① `harnessScene` 落盘 brief、给 `baseBranch`，fix 轮 / docs-fix 帧交 reviews 载体；② 内联字面量与 P21 的 `sceneOf` 轮次同属 sweep 面；③ 真 CLI 的 `runArgv` 派发帧先 `cdd base set`——反转 ④ 之后无基准的 wave / branch 评审死在 `BASE_BRANCH` 的 `empty-value`，这条路不经 scene，给 scene 补格到不了它）
- Test: `packages/cdd-engine/src-next/face/__tests__/preview.test.ts`（`scene()` 工厂补两格声明与 `baseBranch`：预览面同样判空值腿，wave 帧缺 `baseBranch` 会在预览里报 `BASE_BRANCH` 的 `empty-value`，而这一文件的既有 pin 断言的是无拒绝）
- Create: `packages/cdd-engine/src-next/face/__tests__/dispatch-input.test.ts`

#### Consumes
- Task 1 的 ContextLine / RequiredArm / `ModePromptRow` 的 serves 格（行选择与声明行一律经 `TemplateAssembler` 的 layoutOf(values) 读，门里不重写 row 选择）与 `TemplateAssembler`
- `TemplateValues`、`OpenFrame`、`ArtifactCell`（`face/lifecycle.ts` 既有）
- `DocFs`（`contract/invariants.ts`）——存在性读
- `DocEntry.program` 与 `DocEntry.docType`（`infra/slug-index.ts`）——`when` 两条前提的**唯一**声明源；两个已解析值（`scene.overallLink` · `scene.specLink`）只供值，不判 exigibility
- `RoundNaming` 的 brief 命名行（`session/round-naming.ts`）——预览面 `preview: "satisfied"` 格的答案来源（命名行点名即满足）

#### Produces
```ts
// CliLifecycle 的公开纯读面（与既有 artifactRefusal 并列）
// mode 缺省 dispatch：没有人能静默拿到更弱的那一读
inputRefusal(frame: OpenFrame, mode: "dispatch" | "preview" = "dispatch"): string | null;
// 私有判定：判定对象是即将渲染的那份 values
#inputRefusalOf(
  values: TemplateValues,
  frame: OpenFrame,
  mode: "dispatch" | "preview",
): string | null;
// 报文的一段：row · TOKEN · reason
interface DispatchInputSegment {
  readonly row: string;
  readonly token: string;
  readonly reason: "empty-value" | "target-absent";
}
// Words 的新报文器
dispatchInput(facts: { segments: readonly DispatchInputSegment[] }): string;
```
- 报文形如 `CDD_BLOCKED: dispatch-input · <row> · <TOKEN> · <reason>; <row> · <TOKEN> · <reason>`
- `reason` 闭集：`empty-value` · `target-absent`
- 场景两格：`DispatchScene` 新增「`program:` 声明字面量」与「`doc-type:` 声明形状」两格，两处编辑点——`#sceneOf`（`face/cli.ts` 里那次 `DocEntry` 读，从文档域交出两格）与 `#lifecycleOf`（同一个文件里构造 `DispatchScene` 字面量的地方，把两格写进 scene；两格经 `WorkScene` 中转，`#sceneOf` 不直接构造 `DispatchScene`）——与 `specLink` · `overallLink` 并列，门在派发期不解析任何文档，只读这两格
- 两格的形态**可选且可空**，与 `specLink` · `overallLink` 同形：`program`（身份文档的 `program:` 字面量）与 `docType`（`DocEntry.docType` 的形状）都声明为 `?: ... | null`。可选让既有 scene 字面量继续编译（缺格即「未声明」，正是门对它的读法），可空让「声明了却解析不到」与「没声明」在声明面上可分辨；生产面与预览 fixture 因此携带**同一副**声明面——一个表达不出「已声明」的 fixture 测的是另一道门
- 构造器注入位：`fs?: DocFs`，缺省 `new NodeFs()`（与既有 `git` / `proc` / `env` / `inflight` 同一个注入面）——`path: true` 格的存在性腿读它，测试不碰真实文件系统。**问它之前先擦成绝对路径**：路径格的值是 repoRoot-relative 的 `RepoPath`（`#rel` 渲染出来的那一形态，也是 round context 印给孩子的那一形态），经 `RepoRoot#resolve` 换成绝对路径再问 `DocFs#exists`（`#repoRootValue()` 上的同一个擦除点，与 `#carrierRefusal` 同形）；`NodeFs#exists` 就是 `existsSync(p)`（cwd-relative），拿 repoRoot-relative 的拼写去问，一个从子目录发起的合法派发会把每个落盘的路径读成缺席
- 一次合成：`#runDispatch` 只调一次 `#valuesOf(frame, artifactCell)`，同一个值先给门、再给 prompt

#### Steps
- **Step 1**：写失败测试 `dispatch-input.test.ts`——十条 `it`：(a) 每个 requiredOn 命中的格播空值 ⇒ inputRefusal 非空且报文含该 `row` 与该 `TOKEN`；(b) `path: true` 的非空值指向不存在的文件 ⇒ `target-absent`，且同一臂用 stub `DocFs` 记下它被问到的路径、断言那是绝对路径（`RepoRoot#resolve` 之后那一形态，不是 cwd-relative 拼写）；(c) 同一帧两格违例 ⇒ 报文两段、以 `; ` 连接；(d) `when: "program"` 不命中（身份文档没有 `program:`）⇒ 该格不报；(e) `INPUT_RULINGS` 空值 ⇒ 不报（`absent: "none"`，由 T4 的渲染接手）；(f) 在册帧 ⇒ `null`；(g) branch 帧无 `base.json` ⇒ `BASE_BRANCH` `empty-value`（§2.3 清单的第四处反转）；(h) **数据驱动全覆盖**：遍历声明表，对每个 exigible 的格各播一个空值，断言报文点名该 `row` 与该 `TOKEN`（逐格成对，不靠人肉罗列）；(i) **P37 T4 的 ④ 臂**：同 slug 身份文档在盘上、`slug:` 已声明而 `doc-type:` 未声明（`DocEntry.docType` 为 null）⇒ `INPUT_SPEC` 不 exigible、inputRefusal 返回 `null`、派发字节与今日逐字节相同；(j) **反转 ①**：身份文档声明了 `program:` 而其章程解析不到 ⇒ 报文末段为 `INPUT_OVERALL · target-absent`。— checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/face/__tests__/dispatch-input.test.ts` 十条全红。
- **Step 2**：在 `Words` 加 dispatchInput（`CAPSULE_WORDS` 同形条目 + 方法），报文由段数组拼装，段内 ` · `、段间 `; `。— checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/face/__tests__/dispatch-input.test.ts -t "dispatchInput"` 绿（报文器的两条 pin 落在本任务声明的测试文件里；`words.guard.test.ts` 是禁词表守卫，不是报文器测试）。
- **Step 3**：实现 `#inputRefusalOf(values, frame, mode)`：遍历 layoutOf(values) 交出的当前 row 声明行（与渲染器同一份，门里不出现第二套 review-vs-work 行选择）；对每行算「本行在本 type 上是否 exigible」——任一臂的 `types` 命中当前 type 且 `when` 成立，`"program"` 读场景交出的 `program:` 声明格（**不是** `scene.overallLink`），`"identity"` 读同一处交出的 `doc-type:` 声明格（**不是** `scene.specLink`）。判定分支按**前提**先分腿，两条腿描述的是两类格、永不竞争同一个 cell：`when` 条件**命中**的臂，其已解析值为空 ⇒ `target-absent`（声明存在、解析失败，spec §2.3 反转 ①），这一腿在 `when` 命中时先于任何通用空值判；通用 `empty-value` **只属于没有 `when` 的臂**（值被要求而为空）；`when` 未命中的臂不 exigible、不判。`path: true` 且值非空 ⇒ 该值经 `RepoRoot#resolve` 擦成绝对路径后问注入的 `DocFs#exists`，不存在 ⇒ `target-absent`。`mode: "preview"` 只把 `preview: "satisfied"` 的格从**存在性腿**上豁免——空值腿照常判：命名行点名 ⇒ 视为满足，未点名 ⇒ `empty-value`（spec §2.4：预览不许问一个自己不会写下的文件，也不许用这一位豁免一个它并不满足的格）。收集全部段后一次返回。— checkable: Step 1 的 (a)–(j) 转绿。
- **Step 4**：把门接进派发缝：`#runDispatch` 只调一次 `#valuesOf(frame, artifactCell)`，把**同一个值**先交给 #inputRefusalOf（排在 `#artifactRefusalOf` 之前），artifact 门之后再把这个同一个值交给 prompt 渲染——一处判定两个消费者，不是两次合成（spec §2.1）；拒绝出口与 `#dispatch` 里相邻两道门（carrier-integrity · artifact）**同形**：`#openRoundCarriers(frame)` 已经把本轮自己的两个载体名改成可写，所以先 `this.#sealRoundCarriers(frame);`、再 `#blocked`、再返回 `{ status: "BLOCKED" }`——不 seal 的 BLOCK 会把本轮 draft 留成 0o644，违反「没有终态留下可写的引擎载体」（P31 T5 §2.4）；**不追加 in-flight 记录、不递增轮次**。— checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/face/` 全绿，且新增两条 `it`：一条断言被拒后 ledger 无本帧 in-flight 记录，一条断言 `-a2` 重试帧（上一轮 draft 已在盘上）被本门拒后那个 draft 的 mode 仍是 0o444。
- **Step 5**：扫派发面既有 fixture——新门在 child 存在之前就判，而这些 fixture 今天依赖 child 真的跑起来，蓝本之外的空格会在派发前被拒。扫的是**两类派发面**，不是三个具名 fixture——一类是 scene 面（两个测试文件里每一个派发 wave 面的 scene），一类是真 CLI 派发帧（端到端 `runArgv`，不经任何 scene）：(a) `face/__tests__/lifecycle.test.ts` 的 `fixture()` 给 wave 帧交真实输入——`briefPath` 指向 `mkdtemp` 里写好的 brief 文件（`path: true` 问的是存在性），`baseBranch` 给一个分支名（`waveFrame` / `reviewFrame` 都是 wave 面，`[branch, wave]` 臂命中）；(b) `face/__tests__/cli.test.ts` 的 `harnessScene` 同样补盘上 brief 与 `baseBranch`，fix 轮另交一个真实 reviews 载体（`INPUT_REVIEWS` 的 `always` 臂命中，且 `path: true` 要求它存在）；(c) 同文件里那条「§4.2 — every wave frame（implement/review/fix）carries the scene's brief as INPUT_WAVE_BRIEF, never a disk-existence read」的 fixture 同样把 brief 落到盘上，并把它的前提重述：它当初拆掉的是派发期那条自己 `existsSync` 的旧守卫，而新门的存在性读是另一件事——真派发那侧 `CliGate#renderBrief` 已先落盘，`path: true` 的读取发问是正确行为，装配器里仍不引入任何磁盘读；(d) **同文件里的内联字面量**：那条「prescribes the implement artifact paths」的测试自己构造 scene，`briefPath` 指向一个没有任何人写下的路径——补一次落盘（或改指 (b) 已落盘的 brief），否则 `INPUT_WAVE_BRIEF` 的 `always` + `path: true` 会让这一轮在派发前就 `target-absent`，`sync.calls` 保持空、prompt 断言抛；(e) **P21 的 `sceneOf` 轮次**：这些 scene 同样派发 implement / review 的 wave 帧，brief 与（branch / wave 评审帧的）`baseBranch` 一并补上；docs-fix 帧则交一个真实 reviews 载体；(f) 不给 scene 开后门：fixture 交真实输入，门照常判，不加豁免分支、不新增 `it.skip`，也不把任何一个 scene 标成「故意被门挡住」——判据是「没有 scene 因为一份它本来就该交出去的输入而被挡」，而不是「期望值恰好没变」；(g) **真 CLI 派发帧种基准**：反转 ④ 之后，没有 `base.json` 的 tree 评审判不出「这轮改了什么」，所以这一类帧在派发前先 `cdd base set`（写下的就是 `base.json`，恢复动作本身就是它）。具名的是「every wave-face dispatch re-extracts the brief from the CURRENT plan」那条 wave 评审、「review --type branch — the live-tree branch face」与 P22 T17 的 (a) · (b) · (c) 三臂各自的 branch 评审；判据是这一类，不是这张名单；(h) **行为被反转的旧 pin 在本任务内翻新**，不留到「既有 `it` 全绿」那句自我证明：P37 T4 的 ③ 臂今天写的是「身份文档的 `program:` 解析不到 ⇒ 只掉章程那一行、wave 照常派发」，反转 ① 之后该帧是 `CDD_BLOCKED: dispatch-input · review · INPUT_OVERALL · target-absent`、child 零 spawn，因此该臂改读退出码与拒绝串（不再从 prompt 取断言——fixture helper 在无 child 处就抛），`it` 标题与四臂注释一并重述为「声明了却解析不到 ⇒ 拒」；同系列的 ① 臂与 ⑤ 臂只按 (g) 种基准，② 与 ④ 两臂字节不变。— checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/face/` 全绿（`lifecycle.test.ts` · `cli.test.ts` · `preview.test.ts` 三份文件的全部既有 `it` 在内，无新增 `it.skip`，翻新的 ③ 臂按新期望值绿）；Step 4 checkable 里「`src-next/face/` 全绿」那句的兑现就在这一条，不是另一条更弱的说法。
- **Step 6**：提交。— checkable: `git log --oneline -1` 显示本任务提交，`git status --short` 为空。

#### Acceptance
- 十条判定行为各有测试，其中 (h) 遍历声明表逐格成对——新增一个必填格而不加测试会红；(i)(j) 是 spec 的两条结构前提各自的可见行为。
- 一次拒绝报**全部**违规格（不 fail-fast）。
- 门序在 artifact 门之前：同一帧同时违 `input` 与 `rulings` 时，报文是 `dispatch-input` 的那条。
- 被拒不占轮次、不留 in-flight 记录。
- `reason` 闭集只有两条，源码里搜不到 `missing-line`。
- 一次派发只合成一次 values：门与 prompt 读同一个值（不是两次 `#valuesOf`）。
- exigibility 读的是两处**声明**（`DocEntry.program` · `DocEntry.docType`），派发期不解析文档。
- 被拒出口先 seal 本轮载体（与相邻两道门同形）：`-a2` 重试帧被拒后既无 in-flight 记录，draft 也仍是 0o444。
- 派发面的既有 fixture **全量**交真实输入，两类各自闭合：scene 面（两个测试文件里每一个派发 wave 面的 scene，含内联字面量与 P21 的 `sceneOf` 轮次）落盘 brief、给 `baseBranch`，docs-fix 帧交 reviews 载体，预览 fixture 同补两格声明与 `baseBranch`；真 CLI 派发面（wave-face brief 重抽那条、live-tree branch 面、P22 T17 的 (a) · (b) · (c)）派发前 `cdd base set`。没有 scene 因为一份它本来就该交出去的输入而被挡。
- 行为被反转的旧 pin 在同一任务内翻新并重述标题：P37 T4 的 ③ 臂由「解析不到只掉一行」改为 `INPUT_OVERALL` 的 `target-absent` 且 child 零 spawn，② 与 ④ 两臂字节不变；`src-next/face/` 全绿且无新增 `it.skip`。

#### DependsOn
1

### Task 3: `--dry-run` 同源与预览答案

#### Objective
让预览与真派发是**同一个返回值的两个消费者**：同一帧下两者的拒绝串逐字节相同；预览不能把引擎合成的那一格（wave brief）读成不存在。

#### Files
- Modify: `packages/cdd-engine/src-next/face/cli.ts`（`--dry-run` 的拒绝串读取点，与 `artifactRefusal` 并列，按 `mode: "preview"` 调用）
- Test: `packages/cdd-engine/src-next/face/__tests__/cli.test.ts`（追加）

#### Consumes
- Task 2 的 `inputRefusal(frame, "preview")` 与 dispatchInput 报文器（`preview` 判别位就在门的签名上，预览路径不再自带第二套判据）
- `RoundNaming` 的 brief 命名行（`session/round-naming.ts`）——预览里 satisfied 格的命名来源，读取点在门的预览分支，本任务只负责把 `mode` 传对

#### Produces
- `--dry-run` 在违例帧上把门的拒绝串原样交给 `Preview#artifactBlock`，落在既有的 `  refused:  <reason>` 行里——两个消费者读同一条串；`CDD_BLOCKED: ` 前缀仍只由 `#blocked` 加（预览不复制它），既有的预览输出行集一格不变（spec §2.4 钉的是 reason 字节，不是打印出来的那一行）
- 预览对 `preview: "satisfied"` 的格按「命名行点名即满足」处理，不做存在性读、不写盘

#### Steps
- **Step 1**：写失败测试——(a) 同一违例帧，预览 `refused:` 行的值 === 真派发 `RoundViolation.message`（逐字节 `toBe`；`RoundViolation` 的字段是 `grade` · `cause` · `message`，没有 `reason`）；(b) wave 帧在 brief 尚未落盘时预览 **不** 报 `target-absent`；(c) 预览的输出行集与改动前一致（无新增行）。— checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/face/__tests__/cli.test.ts -t "dispatch-input"` 三条红。
- **Step 2**：在 `cli.ts` 的预览路径上取 `harness.inputRefusal(frame, "preview")`（与既有 `artifactRefusal` 同一处、同一写法的相邻调用），把返回值原样渲染。— checkable: (a)(c) 转绿。
- **Step 3**：确认预览路径不另起一次判定：`mode: "preview"` 是门上的唯一差异位，预览不合成第二个 `TemplateValues`、不写盘、不 extract brief。— checkable: (b) 转绿，且既有 `--dry-run` 零写入断言仍绿。
- **Step 4**：提交。— checkable: `git log --oneline -1` 显示本任务提交，`git status --short` 为空。

#### Acceptance
- 字节等价 pin 存在且真能红：把 inputRefusal 的返回值篡改一个字节 ⇒ 该测试红。
- 预览零新增输出行、零写入（既有 `--dry-run` 零写入断言仍绿）。
- wave 帧在 brief 未落盘时预览不误报；`satisfied` 只豁免存在性腿，空值腿照判。

#### DependsOn
2

### Task 4: 四段 shell 文本与 `$version`

#### Objective
四个 shell 正文各带一句 `scratch/` 纪律；`fix` 与 `docs-fix` 的读入指令各带半句 `none`；`$version` 递增。字节 pin 断言这四句与两句的确切文本存在。

#### Files
- Modify: `packages/cdd-engine/src-next/render/templates.ts`（`IMPLEMENT_SHELL` · `REVIEW_ITEM` · `FIX_SHELL` · `DOCS_FIX_SHELL` · `$version`）
- Test: `packages/cdd-engine/src-next/render/__tests__/templates.test.ts`（追加四句 `scratch/` 与两句 `none` 的字节 pin——`$version` 不在这里另开第二个家）
- Test: `packages/cdd-engine/src-next/render/__tests__/render.test.ts`（`$version` 旧钉 24 → 25：这一事实唯一的家）
- Test: `packages/cdd-engine/src-next/face/__tests__/board-view.test.ts`（追加孤儿成对 pin——`orphan:` 行本来就在这里断言）

#### Consumes
- spec §5.1 / §3.3 里固定的两句英文原句（围栏块内的确切字节）
- `WORKSPACE_DIR` 与 `OUTPUT_HANDOFF` 两个 token——`scratch/` 那句从后者取 stem、以 `WORKSPACE_DIR` 为基

#### Produces
- `IMPLEMENT_SHELL` · `REVIEW_ITEM` · `FIX_SHELL` · `DOCS_FIX_SHELL` 各含同一句 `scratch/` 纪律（`REVIEW_ITEM` 的注入使六个 review row 一致得到它）
- `FIX_SHELL` · `DOCS_FIX_SHELL` 的读入指令含 `none` 半句
- `$version` 24 → 25

#### Steps
- **Step 1**：写失败测试——(a) 四个 shell 断言各含 `scratch/<round-id>` 那句话（按子串 `scratch/` + `OUTPUT_HANDOFF` 双条件，避免只测一个词）；(b) `FIX_SHELL` 与 `DOCS_FIX_SHELL` 含 `the literal \`none\``；(c) `IMPLEMENT_SHELL` 与 `REVIEW_ITEM` **不含** `none` 半句（半句只属于有 `INPUT_RULINGS` 的两面）；(d) 在 `render.test.ts` 翻新既有的 `$version` 旧钉 24 → 25（同一常量只有一个家；不在 `templates.test.ts` 新建第二个）。— checkable: 四条红。
- **Step 2**：写入四句与两句，措辞逐字取 spec 的围栏块；`$version` 改 25。— checkable: 四条转绿。
- **Step 3**：跑全 render 面测试确认 prompt 字节断言只在预期处变化。— checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/render/` 绿；若有既有字节 pin 因两句变化而红，逐条更新并在提交信息里点名。
- **Step 4**：写「结构而非白名单」的成对 pin：在临时工作区根播一个裸文件 ⇒ `board` 落一条 `orphan:`；把同一文件移入 `scratch/<round-id>/` ⇒ 该行消失、其余行不变。这条 pin **落地即绿**：`Workspace#names()` 只回 `isFile()`、不递归，所以子目录里的文件今天对 `orphanHandoffs()` 已经结构性不可见（spec §5.4 的 P37 实测：16 个脚本移入后归零、零代码改动）。它是 characterization pin，不是红→绿：它只在有人让 `names()` 开始递归的那天红。— checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/face/__tests__/board-view.test.ts` 绿（绿即通过，无红期）。
- **Step 5**：提交。— checkable: `git log --oneline -1` 显示本任务提交，`git status --short` 为空。

#### Acceptance
- 四句 `scratch/` 与两句 `none` 各带字节 pin；`IMPLEMENT_SHELL` / `REVIEW_ITEM` 不含 `none` 半句。
- 孤儿成对 pin 成立：裸文件被报、移入 `scratch/<round-id>/` 后行消失，且其余 `orphan:` 行不变（证明是结构而非白名单）；它按 characterization 记录，不假装有红期。
- `$version === 25` 有 pin。
- prompt 其余字节零变化（既有 pin 全部仍绿，除两句引入的差异）。

#### DependsOn
none

### Task 5: 章程 `v4.08` 回填与语料增长修复

#### Objective
落地 spec §6 第 8 项那笔未应用字节：requiredOn 的臂形态域、`path: true` 位、反转计数 3 → 4 并点名 `BASE_BRANCH`；章程版本递增并追加 change-history 行。同时把本计划自身带进语料后涨出来的那一格计数修好——语料从 80 个文件变成 81，而 `CORPUS_SIZE` 还是 80。

#### Files
- Modify: `docs/kairos/overalls/2026-10-10-engine-doc-tooling-overall.md`（D94 行 · Phase inventory 的 P38 行详情格与 Scope ① 段的计数 · front-matter `version:` · change-history 行）
- Modify: `packages/cdd-engine/src-next/contract/__tests__/pins.guard.test.ts`（`CORPUS_SIZE` 80 → 81：本计划自身是语料的第 81 个文件）

#### Consumes
- `docs/kairos/specs/2026-11-17-engine-doc-tooling-p38-design.md` §6 第 8 项（原文与改法逐字给定）

#### Produces
- 章程 `version: v4.08`，change-history 追加一行
- D94 行与 P38 详情格的 requiredOn 域写成臂形态；声明表条目带 `path: true`
- P38 Scope ① 段的计数由「三处反转」改为「四处反转」，第四个点名为「无 `base.json` 时的 `BASE_BRANCH` `empty-value`（恢复动作 `cdd base set`）」，并撤掉该处 `spec:` 那一半
- `CORPUS_SIZE === 81`，pin 门与 census 门回到全绿

#### Steps
- **Step 1**：按 spec §6 第 8 项逐条改字节（三处 + 版本 + change-history）。requiredOn 的臂形态域写成「一格一条臂，或几条合取臂」，并写明一条臂的 `types` 可以是空数组——`never` 的规范形态就是 `{ types: [] }`，所以 `INPUT_RULINGS` 与 `docs-fix` 的 `WAVE` 只挂这一条臂，落在域内，不是在域外多出一种「零条臂」。— checkable: `node packages/cdd-engine/src-next/bin.ts board --spec docs/kairos/specs/2026-11-17-engine-doc-tooling-p38-design.md` 报 `overall … v4.08` 且 `next:` 不变。
- **Step 2**：把 `CORPUS_SIZE` 由 80 改成 81，并跑文档契约与 pin 门。— checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/contract/__tests__/pins.guard.test.ts src-next/contract/__tests__/census.guard.test.ts` 全绿（语料条数 81，`pin.total` 为 0）。
- **Step 3**：提交。— checkable: `git log --oneline -1` 显示本任务提交，`git status --short` 为空。

#### Acceptance
- 章程 `v4.08`，三处字节逐字落地，change-history 有一行对应。
- 文档契约腿与 pin 门绿，`CORPUS_SIZE` 是 81（不是「条数不变」）。
- `grep -c "三处反转"` 在章程里为 0。

#### DependsOn
none

### Task 6: changeset 与全量门禁

#### Objective
补齐 release 声明并证明整条链绿：`cdd-engine` minor changeset；`pnpm run validate` exit 0。

#### Files
- Create: `.changeset/p38-dispatch-input.md`
- Modify: 无（若门禁暴露缺陷，回归到拥有该缺陷的任务修）

#### Consumes
- Task 1–5 的全部交付

#### Produces
- `.changeset/p38-dispatch-input.md`：`"@oscaner-skills/cdd-engine": minor`，正文按 `.changeset/README.md` 的 D74 判据说明「methodology 未变、消费面可见的字节变化 ⇒ minor」
- `pnpm run validate` 的绿色输出

#### Steps
- **Step 1**：写 changeset 文件。— checkable: `pnpm exec vitest run scripts/__tests__/changeset-levels.test.ts` 绿（无 major、有 level）。
- **Step 2**：跑全量门禁。— checkable: `pnpm run validate` exit 0；红则记录失败的那个 job 并把修复落回拥有它的任务。
- **Step 3**：提交。— checkable: `git log --oneline -1` 显示本任务提交，`git status --short` 为空。

#### Acceptance
- changeset 在册且 level 为 minor。
- `pnpm run validate` exit 0（八项全绿）。

#### DependsOn
1, 2, 3, 4, 5

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-11-17 | 初稿：六个任务——声明形状（ContextLine 对象 + 三条构造期断言）· 纯读门与门序（原因闭集两条、一次报全部）· `--dry-run` 字节等价与预览答案 · 四段 shell 与 `$version` · 章程 `v4.08` 回填 · changeset 与全量门禁。波次由 `DependsOn` 派生：W1 {1,4,5} → W2 {2} → W3 {3} → W4 {6} | Oscaner M. · Claude（kairos:cdd-plan · 2026-11-17） |
| v0.2 | 2026-11-17 | plan-review-1 docs-fix 轮（F1–F13 全部落地）：Task 1 去掉「空臂集即无信息声明」的判据——`never` 是合法声明，构造期唯一的死格是命名了该 row 从不服务的 type；穷尽性论域改为逐行（`TOKENS` 的 round-context zone ∩ 该 row 自己的 layout）并补一条能红的 pin，另补 `- Create:` 前向声明与构造器注入位 · Task 2 的 `identity` 臂改读 `DocEntry.docType`（文档在盘但读不出形状 ⇒ 不 exigible）、补「`program:` 声明了却解析不到 ⇒ `target-absent`」的反转 ①、场景交出两个声明格并把 `face/cli.ts` 列进 Files、门签名带 dispatch / preview 模式（`satisfied` 格只豁免存在性腿）、一次合成 values 供门与 prompt 共用 · Task 1 补 P31 §2.5 三处旧钉的 deliberate 翻新 · Task 2 与 Task 4 的测试归位到已声明的文件、孤儿 pin 改述为 characterization · Task 5 增语料增长修复（`CORPUS_SIZE` 80 → 81）· 新建文件走 `- Create:` 行、未落地词汇改裸词（本计划自身要过 pin 门）| Oscaner M. · Claude（kairos:cdd-dev · 2026-11-17） |
| v0.3 | 2026-11-17 | plan-review-2 docs-fix 轮（F1–F10 全部落地）：Task 1 的构造期断言改为四条判据一处家——死格 · 槽注册 · shell↔layout（从 `#assertShellLayout` 迁入并删除该方法，同一事实不再两处）· round-context zone 覆盖，并写明「删一行声明」由 shell↔layout 兜住、不再有一条循环判据 · Task 1 补 drop 格的数据驱动遍历（每个 `absent: "drop"` 格播空值 ⇒ 该行消失且其余行逐字节不变）并订正零条臂的计数口径（只数 token 行）· Task 2 规定 `when` 命中而值为空 ⇒ `target-absent`、通用 `empty-value` 只留给无 `when` 的臂，拒绝出口补 `#sealRoundCarriers`（与相邻两道门同形），派发面 fixture（lifecycle · cli 的 brief 落盘与 `baseBranch`、fix 轮 reviews 载体）独立成步并入 Files，Produces 补 DispatchInputSegment 与 `fs?: DocFs` 注入位并点名 `#sceneOf` · `#lifecycleOf` 两处编辑点 · Task 3 预览改为把门的 reason 原样交给既有 `refused:` 行（不复制 `CDD_BLOCKED: ` 前缀），字节等价 pin 改钉 `RoundViolation.message` | Oscaner M. · Claude（kairos:cdd-dev · 2026-11-17） |
| v0.4 | 2026-11-17 | plan-review-3 docs-fix 轮（F1–F7 全部落地）：Task 1 Step 4 删掉「exigible 空值照常渲染为空值」那条——渲染层只答 `absent` 这一面（空值按声明丢行或印裸词 `none`），exigible 的空值由门先拒、到不了 `render()`，装配器不新增 exigibility 输入 · Task 1 的构造期断言补第六臂（登记了 round-context token 而任何 row 都不携带 ⇒ 抛），与 shell↔layout 分列两个方向 · Task 1 Produces 声明 layoutOf(values) 作为行选择与声明表的唯一读面，Task 2 Consumes 与 Step 3 改读它 · Task 2 的路径格写明 repoRoot-relative 基线与 `RepoRoot#resolve` 擦除（`DocFs#exists` 只被问绝对路径），Step 1(b) 的 stub 断言该形态 · Task 2 Step 5 由三个具名 fixture 改为两个测试文件的全量扫描（内联字面量、P21 的 `sceneOf` 轮次、docs-fix 的 reviews 载体一并点名） · `INPUT_RULINGS` 与 docs-fix 的 `WAVE` 由「零条臂」改记为 `never` 的规范形态一条空 `types` 臂（Task 5 的章程句子随之写明该形态在域内） · `#gate` 里的 `#assertShellLayout` 调用点明确删除 | Oscaner M. · Claude（kairos:cdd-dev · 2026-11-17） |
| v0.5 | 2026-11-17 | plan-review-4 docs-fix 轮（F1–F7 全部落地，F4 与 F5 的裁定均 ACCEPTED）：守恒条款改为清单的补集形态——除 spec §2.3 点名的四处反转与 spec §3.3 / §5.1 两句 shell 新文本外逐字节不变，与 spec 的 Constraints 同形（F4） · Task 2 Step 5 拆成两类派发面：真 CLI 的 `runArgv` 帧派发前 `cdd base set` 种基准（wave-face brief 重抽 · live-tree branch 面 · P22 T17 的 (a)(b)(c)），行为被反转的 P37 T4 ③ 臂在同一任务内翻新为 `INPUT_OVERALL` 的 `target-absent` 且 child 零 spawn、标题与四臂注释重述，「不给测试开后门」收窄为「没有 scene 因本该交出去的输入被挡」（F1） · Task 1 把 shell↔layout 的 per-render 旧钉改写成构造期臂（注入带 rogue row 的契约、断言构造函数抛），并点名 `roundContext` 四处形状 pin 改读逐行声明对象的 `.line`（含反面臂，否则真空绿）（F2 · F3） · 场景两格声明为可选且可空（`program` 与 `docType` 都带问号与 null），预览 fixture 同补两格与 `baseBranch`（F5） · `preview` 域补回 `value`（F6） · `$version` 翻新落在它唯一的家 `render.test.ts`，不在 `templates.test.ts` 另开第二个（F7） | Oscaner M. · Claude（kairos:cdd-dev · 2026-11-17） |
