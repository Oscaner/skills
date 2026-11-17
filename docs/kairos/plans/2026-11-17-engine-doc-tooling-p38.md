---
title: 'P38 · 派发输入契约：必填表、`none` 表示法与 `dispatch-input` 门'
doc-type: plan
version: v0.11
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
- Modify: `packages/cdd-engine/src-next/render/templates.ts`（`ModePromptRow` / `TemplatePrompt` 类型、四个 row 的 layout、`TemplateAssembler` 构造期的断言入口、可选注入位与行选择读面）——**已落地**（`618417b8`）：`ContextLine` · `RequiredArm` · `ModePromptRow` 的 `serves` · 构造期 `#assertDeclarations` · `layoutOf` 均在树上；#assertShellLayout（本任务删掉的旧方法，全文裸词书写）与 `#gate` 里对它的调用点已随之删除）
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
- `TemplateAssembler` 构造函数调用 `#assertDeclarations()`（私有方法，构造期一次性）；#assertShellLayout 的 shell↔layout 判据搬进它，该方法随之删除——同一事实只有一个家，不留第二份覆盖堆栈
- 行选择与声明表的唯一读面（T2 的门读它，不另写一套 row 选择）：
```ts
layoutOf(values: TemplateValues): readonly ContextLine[];
```
- layoutOf 是「这一轮是哪一行、那一行声明了哪些格」的唯一答案：装配器自己的 `#rowOf` + `row.roundContext` 走它，T2 的门也只走它——row 选择因此只有一个家，门里不出现第二份 review-vs-work 分支

#### Steps
- **Step 1**：写失败测试 `context-lines.test.ts`，七条断言各一个 `it`——(a) 死格：临时构造一条臂，其 type 落在 `fix` row 的 `serves` 之外（`overall`）⇒ 构造抛错且报文点名该 token 与 `overall`；(b) shell↔layout·删声明方向：从 `review` 的 layout 里删掉 `INPUT_SPEC` 那一行（该 row 的 shell 正文仍点名它）⇒ 构造抛错且报文点名 `INPUT_SPEC`；(c) 槽注册·多槽方向：给某 row 的 layout 加一个登记表里没有的 `{{TOKEN}}` 槽 ⇒ 构造抛错且报文点名该槽；(d) zone 覆盖·登记无载体方向：给注入契约的 `tokens` 加一个 zone 为 round-context 的登记名，而任何 row 的 layout 都不携带它 ⇒ 构造抛错且报文点名该 token（(b) 与 (d) 是两个独立方向，把一个写成另一个的逆命题会让两臂同时绿或同时红，任一方向的缺失都测不出来）；(e) `never` 形态合法：`INPUT_RULINGS` 与 `docs-fix` 的 `WAVE` 声明为一条臂且 `types` 为空数组 ⇒ 构造**不**抛（`never` 是合法声明，不是无信息声明）；(f) 预览答案的唯一载体：把 `INPUT_SPEC` 那一格改成 `preview: "satisfied"` ⇒ 构造抛错且报文同时点名该格与 `INPUT_WAVE_BRIEF`——豁免只答命名行写下的那一格，第二个 `satisfied` 格是声明错误，红的时机是装配器建不起来，不是某次预览走到那条路；(g) 在册契约 ⇒ 构造不抛。— **已落地**（`618417b8`；(f) 在 branch-fix-1 轮补入）：绿期属于这些提交之前的树，重进本步读到的是**绿**——「不是红」在这里说的是已交付，不是测试惰性；任何一条变红才是回归。— checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/render/__tests__/context-lines.test.ts` 七条全绿。
- **Step 2**：在 `templates.ts` 定义 RequiredArm / ContextLine（围栏块内的两个 interface），给 `ModePromptRow` 加 `serves`，把四个 row 的每一行改写为声明对象——取值逐行照 spec §1.4 的表：`INPUT_*` 六个读入格 `path: true`；`INPUT_RULINGS` 的 `absent: "none"` 与「一条臂、`types` 为空数组」（spec §1.1 的 `never` = `{ types: [] }`；`docs-fix` 的 `WAVE` 同形），其余 `absent: "drop"`；`INPUT_WAVE_BRIEF` 加 `preview: "satisfied"`；`OUTPUT_*` / `WORKSPACE_*` / `ROLE` / `TARGET_TYPE` / `WAVE` / `BASE_BRANCH` 按表给 `always` 或 type 集；`## Round context` 标题行与空行同样是 `never` 形态（一条臂、`types` 为空数组）；同一批里把 `render.test.ts` 那四处 `roundContext` 形状 pin 改读逐行声明对象的 `.line`（含 `not.toContain` 的反面臂——不改则它检查的是一条永远为真的断言）。— **已落地**（`618417b8`）：这一批改写与那四处 `.line` 读法都在树上。— checkable: `pnpm -C packages/cdd-engine exec tsc --noEmit -p packages/cdd-engine` 无错。
- **Step 3**：实现 `#assertDeclarations()`：五条判据，一处家——(a) 死格：每条臂的 `types` 是 `"always"` 或该 row 的 `serves` 的子集；(b) **槽注册**：任一 row 的 round-context 行里出现的每个 `{{TOKEN}}` 槽，都必须是 `TOKENS` 中 zone 为 round-context 的注册名（一个没登记的槽指向一个永不被供给的值）——这一条让 Step 1(c) 红；(c) **shell↔layout**：该 row 的 shell 正文点名（`INPUT_*` / `OUTPUT_*` / `BASE_BRANCH`）的每个 round-context 名，必须被该 row 自己的 layout ∪ 共享的 return 尾携带——判据就是这一句，没有第二份覆盖堆栈：#assertShellLayout 是本任务删掉的旧方法（全文裸词书写），`#gate` 里对它的调用点已随之删除，构造期的一次断言覆盖每一行，per-render 的全表重跑不再保留；这一条让 Step 1(b) 红（删掉一行声明后 shell 仍在点名它）；(d) **zone 覆盖**：`TOKENS` 里每个 zone 为 round-context 的登记名，至少被一个 row 的 layout 携带（问的是 (b) 的反面：登记的 token 有没有载体）——这一条让 Step 1(d) 红；(e) **预览答案的唯一载体**：`preview: "satisfied"` 只能挂在 `INPUT_WAVE_BRIEF` 那一格上（豁免合成的是命名行写下的那一个值，第二个 `satisfied` 格没有任何命名答案）——这一条让 Step 1(f) 红。**没有第六条**：`never` 形态（一条臂、`types` 为空数组）是合法声明（spec §1.3——构造期唯一的死格是命名了该 row 从不服务的 type），因此一个携带槽的行可以只挂一条空 `types` 的臂；「删掉一行声明」也不再是一条独立的覆盖判据——它由 (c) 的 shell↔layout 兜住，而不是由一条「声明携带自己」的循环判据兜住。同一批里把 `render.test.ts` 那条 shell↔layout 的 per-render 旧钉改写成构造期臂——注入一个带 rogue row 的契约（row 带新的 `serves` 格），断言 `new TemplateAssembler(contract)` 抛同一条报文；不改写它必红：类级 `assembler` 在变异之前就已建成，`render` 不会再抛，而现场新建一个则是构造函数抛。— **已落地**（`618417b8`；(e) 在 branch-fix-1 轮补入）：五条判据与那条构造期臂都在树上；重进本步的判据是「仍绿」，不是「由红转绿」。— checkable: Step 1 的七条测试全绿。
- **Step 4**：让 `#contextLines` 只答 `absent` 这一面，不判 exigibility：值非空 ⇒ 渲染该值；空且 `absent: "drop"` ⇒ 整行消失；空且 `absent: "none"` ⇒ 渲染裸词 `none`。**渲染层没有第四态**：exigible 的空值到不了 `render()`——T2 的门在派发期先拒（`empty-value` / `target-absent`），`when` 的声明既不进 `TemplateValues` 也不进装配器，装配器不新增 exigibility 输入；一个「exigible 却照常渲染为空值」的分支描述的是代码路径到不了的状态，本相位正是要消掉这一类。同一批里翻掉 P31 §2.5 的三处旧钉：`render/__tests__/render.test.ts` 的「无 sidecar ⇒ 零行」与 `face/__tests__/lifecycle.test.ts` 的两处零行断言，改成「行恒在 · 值为裸词 `none`」，两处注释标注 deliberate（D74）——这是本相位点名的一处**故意翻钉**，不是「期望值悄悄变了」。— checkable: 新增三条测试（`INPUT_RULINGS` 空值渲出 `none`；`overall` 面无 `INPUT_SPEC` 整行；**drop 格的数据驱动遍历**——照 Task 2 Step 1(h) 的形状遍历声明表，对每个 `absent: "drop"` 的格各播一个空值，断言该行消失且其余 round context 逐字节不变）与翻新后的三处断言转绿。
- **Step 5**：跑 render 面与翻过钉的 lifecycle 面，确认没有别处依赖旧的 `string[]` 形状。— checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/render/ src-next/face/__tests__/lifecycle.test.ts` 全绿。
- **Step 6**：提交，提交信息点名 P31 §2.5 的 deliberate 翻钉。— checkable: `git log --oneline -1` 显示本任务的提交且信息含 deliberate，`git status --short` 为空。

#### Acceptance
- 死格、shell↔layout（删声明方向）、槽注册（多槽方向）、zone 覆盖（登记无载体方向）、预览答案（非法第二格）五条判据各自在构造期抛错，报文点名 token 与 offending type；`never` 形态（一条臂、`types` 为空数组）不抛；#assertShellLayout 已删除，`#gate` 里对它的调用点一并删除（构造期已覆盖全表，不留 per-render 重跑）。
- 在册契约构造不抛；`templates.ts` 的四份 layout 逐行带声明，`INPUT_RULINGS` 是唯一的 `absent: "none"`，`INPUT_WAVE_BRIEF` 是唯一的 `preview: "satisfied"`——这唯一性不止写在断言里：构造期判据把第二个 `satisfied` 格拦下（报文点名该格与 `INPUT_WAVE_BRIEF`）；挂 `never` 形态（一条臂、`types` 为空数组）的 **token 行**只有 `INPUT_RULINGS` 与 `docs-fix` 的 `WAVE` 两处（`## Round context` 标题与空行同形，但它们没有值可比，不在这一计数里）。
- 渲染层三态逐态可测：非空渲染该值；`none` 态渲成裸词；`drop` 态由整表遍历钉住——每个 `absent: "drop"` 格播空值 ⇒ 该行消失且其余 round context 逐字节不变。第四态（exigible 空值）不在渲染层：渲染层不接收 exigibility 输入，exigible 的空值由 T2 的门钉住。
- P31 §2.5 的三处旧钉翻新并标注 deliberate，本任务的提交信息点名它。
- `pnpm -C packages/cdd-engine exec vitest run src-next/render/ src-next/face/__tests__/lifecycle.test.ts` 绿。
- 以上判据在 `618417b8` 已交付其中四条（构造期四判据 · 构造期臂 · 三处 deliberate 翻新），第五条预览唯一性判据在 `229f35f4` 交付；重进本任务的判据是「仍绿」，不是「由红转绿」——变红即回归。

#### DependsOn
none

### Task 2: `dispatch-input` 纯读门与门序

#### Objective
在 child 存在之前判「这一轮成立吗」：必填格为空、路径格不存在、结构前提声明了却解析不到，各自成一条拒绝，全部违规格一次报完；门是纯读，排在 artifact 门之前，被拒不占轮次、不留 in-flight 记录。

以上已在 `14fe3d12` 交付：`inputRefusal` · `#inputRefusalOf` · `DispatchInputSegment` · `Words#dispatchInput` 与 `dispatch-input.test.ts` 全在树上，本任务重进时核对的是交付后的门与臂，不是再写一遍。

#### Files
- Modify: `packages/cdd-engine/src-next/face/lifecycle.ts`（`CliLifecycle` 的派发前判定面、`DispatchScene` 的两个声明格、`#valuesOf` 的消费点）——**已落地**（`14fe3d12`）：纯读面 `inputRefusal`、私有判定 `#inputRefusalOf` 与两个场景声明格都在树上
- Modify: `packages/cdd-engine/src-next/face/words.ts`（`Words` 的 dispatchInput 报文器）——**已落地**（`14fe3d12`）：`Words#dispatchInput` 在树上
- Modify: `packages/cdd-engine/src-next/face/cli.ts`（`#sceneOf` 交出两个声明格、`#lifecycleOf` 把两个格写进 scene 字面量）——**已落地**（`14fe3d12`）
- Test: `packages/cdd-engine/src-next/face/__tests__/lifecycle.test.ts`（全量 sweep：每个派发 wave 面的 scene 都落盘 brief、给 `baseBranch`）——**已落地**（`14fe3d12`）
- Test: `packages/cdd-engine/src-next/face/__tests__/cli.test.ts`（三类：① `harnessScene` 落盘 brief、给 `baseBranch`，fix 轮 / docs-fix 帧交 reviews 载体；② 内联字面量与 P21 的 `sceneOf` 轮次同属 sweep 面；③ 真 CLI 的 `runArgv` 派发帧先 `cdd base set`——反转 ④ 之后无基准的 wave / branch 评审死在 `BASE_BRANCH` 的 `empty-value`，这条路不经 scene，给 scene 补格到不了它）——**已落地**（`14fe3d12`）
- Test: `packages/cdd-engine/src-next/face/__tests__/preview.test.ts`（要补的是 `runArgv` 帧的输入，不是 `scene()` 工厂的格：工厂喂的是内联 `Preview#render`，从不经过门，补它一格行为也不会变。本文件的真派发帧（`implement` / `review --type wave` 那几处 `runArgv`）与 Step 5(g) 同类，派发前 `cdd base set`；唯一走到预览块的是「consumes no round — the same line's real review still dispatches afterwards」那条 `review --type wave --dry-run` 帧，属第三类（Step 6 登记、Task 3 种基准），缺 `base.json` 就会在预览里报 `BASE_BRANCH` 的 `empty-value` 而它今天期望 exit 0。工厂格只在 wave 帧自己的格真的参与断言时才动）——**已落地**（本层不改动：第三类基准与预览期望归 Task 3）
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
- **Step 1**：写失败测试 `dispatch-input.test.ts`——十三条 `it`（(a)–(l) 加上 (h2) 的豁免活性臂）：(a) 每个 requiredOn 命中的格播空值 ⇒ inputRefusal 非空且报文含该 `row` 与该 `TOKEN`；(b) `path: true` 的非空值指向不存在的文件 ⇒ `target-absent`，且同一臂用 stub `DocFs` 记下它被问到的路径、断言那是绝对路径（`RepoRoot#resolve` 之后那一形态，不是 cwd-relative 拼写）；(c) 同一帧两格违例 ⇒ 报文两段、以 `; ` 连接；(d) `when: "program"` 不命中（身份文档没有 `program:`）⇒ 该格不报；(e) `INPUT_RULINGS` 空值 ⇒ 不报（`absent: "none"`，由 T4 的渲染接手）；(f) 在册帧 ⇒ `null`；(g) branch 帧无 `base.json` ⇒ `BASE_BRANCH` `empty-value`（§2.3 清单的第四处反转）；(h) **数据驱动全覆盖**：遍历声明表，对每个 exigible 的格各播一个空值，断言报文点名该 `row` 与该 `TOKEN`（逐格成对，不靠人肉罗列）——**论域是三个豁免之外的全部 exigible 格**，三个豁免各有自己的家，一个都不住在 (h) 的豁免名单里：① **两个行选择槽** `ROLE` 与 review 行的 `TARGET_TYPE` 由 `layoutOf(values)` 选行，空掉它们时装配器在建行之前就抛、门的报文根本不会被问到（它们的家是 (l) 臂）；② **引擎自算的五个格** `OUTPUT_REPORT` · `OUTPUT_EVIDENCE` · `OUTPUT_HANDOFF` · `WORKSPACE_DIR` · `WORKSPACE_ID`——`requiredOn: always` 却没有任何帧能把它们留空，「每个 exigible 的格播一个空值」对它们没有配方（它们的家是 (h2) 的手写清单与守卫）；③ **`never` 格**从声明表自身推出（没有任何臂能命中 ⇒ 没有任何帧能让它 exigible），不手写、不枚举（它们的家是 (h) 与 (h2) 共读的那份声明表）。把这三个之外的格算进本臂就永远不能绿——按字面实现「每个 exigible 格」只会撞上一条本步没点名的异常，最省事的出路是一个没人写下的 skip；(h2) **豁免的分类与活性**——(h) 的手写豁免不是免检区，本臂两段：第一段是**分类循环**，遍历每条 row 的每一行声明，任一携带槽若既不是行选择槽、也不在引擎自算清单、也不是推导出的 `never` 格、也没有配方 ⇒ 红并点名该 `row` 与该 `TOKEN`（新增一格而没人给它归类，本臂先红）；第二段是**降级守卫**，对清单里每个 token 断言它仍被某条 row 携带（改名或退役的格子留在清单里就是 sweep 上的一处洞），且它没有配方（一个变成可空的引擎自算格就是输入格——唯一的入口是配方，所以「既豁免又可空」正是本臂拒绝默默放过的降级）；(i) **P37 T4 的 ④ 臂**：同 slug 身份文档在盘上、`slug:` 已声明而 `doc-type:` 未声明（`DocEntry.docType` 为 null）⇒ `INPUT_SPEC` 不 exigible、inputRefusal 返回 `null`、派发字节与今日逐字节相同；(j) **反转 ① 的 `program` 腿**：身份文档声明了 `program:` 而其章程解析不到 ⇒ 报文末段为 `INPUT_OVERALL · target-absent`；(k) **反转 ① 的 `identity` 腿**：同 slug 身份文档在盘上、`doc-type:` 声明了（`DocEntry.docType` 非 null）而 `scene.specLink` 为 null ⇒ 报文末段为 `INPUT_SPEC · empty-value`——(j) 与 (k) 只靠 reason 词区分，把两条腿的 reason 互换则两臂同时红；(l) **两个行选择槽的前置条件，不是门的第三条 reason**：把 `ROLE`（以及 review 行的 `TARGET_TYPE`）播成空值 ⇒ `layoutOf(values)` 抛装配器既有的报文 `template work-mode not declared` / `template review type not declared`，inputRefusal 不被问到——臂断言的是**这条既有前提**（异常报文点名该槽），不是门的一段报文；reason 闭集因此仍是 `empty-value` / `target-absent` 两条，不新增第三条（spec §2.3 把这两格记为「永不为空」：空值是装配器的前置条件被破坏，不是合法缺口）。— **已落地**（`14fe3d12`）：(a)–(l) 与 (h2) 的红期属于该提交之前的树，重进本步读到的是**绿**——「不是红」在这里说的是已交付，不是测试惰性；任何一条变红才是回归。— checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/face/__tests__/dispatch-input.test.ts` 全绿（(a)–(l) 与 (h2) 在内），不是由红转绿。
- **Step 2**：在 `Words` 加 dispatchInput（`CAPSULE_WORDS` 同形条目 + 方法），报文由段数组拼装，段内 ` · `、段间 `; `。— **已落地**（`14fe3d12`）：报文器与它的两条 pin 都在树上。— checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/face/__tests__/dispatch-input.test.ts -t "the reported cell"` 绿（报文器的两条 pin 落在本任务声明的测试文件里——(a) 的逐字节 `row · TOKEN · reason` 与 (c) 的 `; ` 连接都在这个 describe 之下。**过滤器必须点中文件里真实存在的标题**：该文件的 describe 全部读作 `the dispatch-input gate — …`，一个 `-t "dispatchInput"` 式的大小写拼写命中 0 条、报 `19 skipped` 并 exit 0，两条格式 pin 一次都不执行；`words.guard.test.ts` 是禁词表守卫，不是报文器测试）。
- **Step 3**：实现 `#inputRefusalOf(values, frame, mode)`：遍历 layoutOf(values) 交出的当前 row 声明行（与渲染器同一份，门里不出现第二套 review-vs-work 行选择）；对每行算「本行在本 type 上是否 exigible」——任一臂的 `types` 命中当前 type 且 `when` 成立，`"program"` 读场景交出的 `program:` 声明格（**不是** `scene.overallLink`），`"identity"` 读同一处交出的 `doc-type:` 声明格（**不是** `scene.specLink`）。判定分支按**臂的种类**分腿，两条腿描述的是两类格、永不竞争同一个 cell：`when: "program"` **命中**而值为空 ⇒ `target-absent`（声明存在、解析失败，spec §2.3 反转 ①）；`when: "identity"` **命中**而值为空 ⇒ `empty-value`（该格 exigible 而引擎没交，spec §2.3 的 `INPUT_SPEC` 行——`target-absent` 的定义要求「该格指向的文档路径不存在，或声明了 `program:` 而章程解析不到」，身份臂两种都不是）；通用 `empty-value` **只属于没有 `when` 的臂**（值被要求而为空）；`when` 未命中的臂不 exigible、不判。两条腿只靠 reason 词可辨：Step 1 的 (j) 与 (k) 各钉一条，把 reason 互换则两臂同时红。`path: true` 且值非空 ⇒ 该值经 `RepoRoot#resolve` 擦成绝对路径后问注入的 `DocFs#exists`，不存在 ⇒ `target-absent`。`mode: "preview"` 只把 `preview: "satisfied"` 的格从**存在性腿**上豁免——空值腿照常判：命名行点名 ⇒ 视为满足，未点名 ⇒ `empty-value`（spec §2.4：预览不许问一个自己不会写下的文件，也不许用这一位豁免一个它并不满足的格）。收集全部段后一次返回。— **已落地**（`14fe3d12`）：门的四条腿与三项豁免都在树上。— checkable: Step 1 的 (a)–(l) 与 (h2) 全绿，不是由红转绿。
- **Step 4**：把门接进派发缝：`#runDispatch` 只调一次 `#valuesOf(frame, artifactCell)`，把**同一个值**先交给 #inputRefusalOf（排在 `#artifactRefusalOf` 之前），artifact 门之后再把这个同一个值交给 prompt 渲染——一处判定两个消费者，不是两次合成（spec §2.1）；拒绝出口与 `#dispatch` 里相邻两道门（carrier-integrity · artifact）**同形**：`#openRoundCarriers(frame)` 已经把本轮自己的两个载体名改成可写，所以先 `this.#sealRoundCarriers(frame);`、再 `#blocked`、再返回 `{ status: "BLOCKED" }`——不 seal 的 BLOCK 会把本轮 draft 留成 0o644，违反「没有终态留下可写的引擎载体」（P31 T5 §2.4）；**不追加 in-flight 记录、不递增轮次**。— **已落地**（`14fe3d12`）：一次合成与 seal 出口都在树上，那两条 `it` 即文件里 `the refused round (§2.1)` 那个 describe 的两条。— checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/face/` 全绿，且该 describe 的两条 `it` 在册：一条断言被拒后 ledger 无本帧 in-flight 记录，一条断言 `-a2` 重试帧（上一轮 draft 已在盘上）被本门拒后那个 draft 的 mode 仍是 0o444。
- **Step 5**：扫派发面既有 fixture——新门在 child 存在之前就判，而这些 fixture 今天依赖 child 真的跑起来，蓝本之外的空格会在派发前被拒。扫的是**三类派发面**，不是三个具名 fixture——一类是 scene 面（两个测试文件里每一个派发 wave 面的 scene），一类是真 CLI 派发帧（端到端 `runArgv`，不经任何 scene），一类是 `--dry-run` 预览帧（走到 `face/cli.ts` 预览块的 `runArgv` 帧，Task 3 让它读同一道门）：(a) `face/__tests__/lifecycle.test.ts` 的 `fixture()` 给 wave 帧交真实输入——`briefPath` 指向 `mkdtemp` 里写好的 brief 文件（`path: true` 问的是存在性），`baseBranch` 给一个分支名（`waveFrame` / `reviewFrame` 都是 wave 面，`[branch, wave]` 臂命中）；(b) `face/__tests__/cli.test.ts` 的 `harnessScene` 同样补盘上 brief 与 `baseBranch`，fix 轮另交一个真实 reviews 载体（`INPUT_REVIEWS` 的 `always` 臂命中，且 `path: true` 要求它存在）；(c) 同文件里那条「§4.2 — every wave frame (implement/review/fix) carries the scene's brief as INPUT_WAVE_BRIEF」（树上该 `it` 的确切标题；14fe3d12 已把它收短到这一句）的 fixture 同样把 brief 落到盘上，并把它的前提重述：它当初拆掉的是派发期那条自己 `existsSync` 的旧守卫，而新门的存在性读是另一件事——真派发那侧 `CliGate#renderBrief` 已先落盘，`path: true` 的读取发问是正确行为，装配器里仍不引入任何磁盘读；(d) **同文件里的内联字面量**：那条「prescribes the implement artifact paths」的测试自己构造 scene，`briefPath` 指向一个没有任何人写下的路径——补一次落盘（或改指 (b) 已落盘的 brief），否则 `INPUT_WAVE_BRIEF` 的 `always` + `path: true` 会让这一轮在派发前就 `target-absent`，`sync.calls` 保持空、prompt 断言抛；(e) **P21 的 `sceneOf` 轮次**：这些 scene 同样派发 implement / review 的 wave 帧，brief 与（branch / wave 评审帧的）`baseBranch` 一并补上；docs-fix 帧则交一个真实 reviews 载体；(f) 不给 scene 开后门：fixture 交真实输入，门照常判，不加豁免分支、不新增 `it.skip`，也不把任何一个 scene 标成「故意被门挡住」——判据是「没有 scene 因为一份它本来就该交出去的输入而被挡」，而不是「期望值恰好没变」；(g) **真 CLI 派发帧种基准**：反转 ④ 之后，没有 `base.json` 的 tree 评审判不出「这轮改了什么」，所以这一类帧在派发前先 `cdd base set`（写下的就是 `base.json`，恢复动作本身就是它）。具名的是「every wave-face dispatch re-extracts the brief from the CURRENT plan」那条 wave 评审、「review --type branch — the live-tree branch face」与 P22 T17 的 (a) · (b) · (c) 三臂各自的 branch 评审；判据是这一类，不是这张名单；(h) **行为被反转的旧 pin 在本任务内翻新**，不留到「既有 `it` 全绿」那句自我证明：本任务翻的是**两条臂**，一条来自反转 ①、一条来自反转 ②，都在 `14fe3d12`（P37 T4 的臂号 ② · ④ 与这里的两处反转号是两套编号，不要互相换算）。**反转 ① 的 `INPUT_OVERALL` 臂**：P37 T4 的 ③ 臂今天写的是「身份文档的 `program:` 解析不到 ⇒ 只掉章程那一行、wave 照常派发」，反转 ① 之后该帧是 `CDD_BLOCKED: dispatch-input · review · INPUT_OVERALL · target-absent`、child 零 spawn，因此该臂改读退出码与拒绝串（不再从 prompt 取断言——fixture helper 在无 child 处就抛），`it` 标题与四臂注释一并重述为「声明了却解析不到 ⇒ 拒」。**反转 ② 的 fix-判据臂**：`cli.test.ts` 的 `(f2)` 臂今天写的是一个**可见的软跳过**（`FIX_DISPOSITIONS_UNRECORDED`，轮次照常收口），反转 ② 之后无载体路径的旧记录与根本没有记录的帧都在 child 存在之前被硬 BLOCK（`INPUT_REVIEWS · empty-value` / `INPUT_REVIEWS · target-absent`），因此该臂改读 `status` 与违例 grade、message，并用 `WAS:` / `NOW:` 注释写下这一翻转（软跳过仍在判据面可达，由 `completion-criterion.test.ts` 钉住）。同系列的 ① 臂与 ⑤ 臂只按 (g) 种基准，P37 T4 的 ② 与 ④ 两臂字节不变。— **已落地**（`14fe3d12`）：三类派发面各交真实输入、反转 ① 的 `INPUT_OVERALL` 臂与反转 ② 的 `(f2)` 臂均已翻新。
- **Step 6**：**预览帧（第三类）**：`--dry-run` 走的是 `face/cli.ts` 的预览块，Task 3 让它读同一道门，于是无 `base.json` 的 wave / branch 预览帧会被 `BASE_BRANCH` 的 `empty-value` 拒，而今天它们期望 exit 0。这一类由**让它红的那个任务**（Task 3）修：本步只登记这一类，不在这里种基准——判据是「每一个走到预览块、且是 wave / branch 面的 `--dry-run` 帧」，不是一张名单；今天可见的成员是「a multi-task wave's phase reads the WAVE row」那条 wave 评审帧，与 `preview.test.ts` 的「consumes no round — the same line's real review still dispatches afterwards」那条 review 帧（同一个 `it` 里先真派发一轮 implement，pre-flight 通过，所以它确实走到预览块）。**不属这一类的是 pre-flight 先拒的帧**：「the clean-tree gate blocks the three verbs on a dirty tree」那条里的 review / fix 两臂走不到预览块——`face/cli.ts` 在 `!verdict.allowed` 处先返回，它们的 `CDD_BLOCKED` + 「commit or discard」由 clean-tree 行给出，与 `base.json` 无关；在那两臂上种基准是空操作，还会把拒绝的归属说错。种基准与退出码 / 渲染行期望写在 Task 3 Step 4。— **已落地**（`14fe3d12` 登记、`692f0ac7` 与 `4c31018a` 兑现）：本步只有登记，基准与期望全在 Task 3 Step 4。— checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/face/` 全绿（`lifecycle.test.ts` · `cli.test.ts` · `preview.test.ts` 三份文件的全部既有 `it` 在内，无新增 `it.skip`，翻新的 ③ 臂按新期望值绿）；Step 4 checkable 里「`src-next/face/` 全绿」那句的兑现就在这一条，不是另一条更弱的说法。
- **Step 7**：提交。— checkable: `git log --oneline -1` 显示本任务提交，`git status --short` 为空。

#### Acceptance
- 十三条判定行为各有测试，其中 (h) 遍历声明表逐格成对，论域是三个豁免之外的全部 exigible 格：① 两个行选择槽 `ROLE` · review 的 `TARGET_TYPE` 由 (l) 钉在装配器的既有前置条件上；② 引擎自算的五个格（`OUTPUT_REPORT` · `OUTPUT_EVIDENCE` · `OUTPUT_HANDOFF` · `WORKSPACE_DIR` · `WORKSPACE_ID`）由 (h2) 的手写清单豁免，清单自身也由 (h2) 守：每条仍被某条 row 携带、且都没有配方；③ `never` 格从声明表推出（没有任何臂能命中），不手写、不枚举；而一张没归类的携带槽与一处「既豁免又可空」的降级各让 (h2) 红——新增一个必填格而不加测试会红；(i) 是「`doc-type:` 未声明 ⇒ 不 exigible」，(j)(k) 是 `program` / `identity` 两条结构前提各自的腿，把 reason 互换则两臂同时红。
- 一次拒绝报**全部**违规格（不 fail-fast）。
- 门序在 artifact 门之前：同一帧同时违 `input` 与 `rulings` 时，报文是 `dispatch-input` 的那条。
- 被拒不占轮次、不留 in-flight 记录。
- `reason` 闭集只有两条，源码里搜不到 `missing-line`。
- 一次派发只合成一次 values：门与 prompt 读同一个值（不是两次 `#valuesOf`）。
- exigibility 读的是两处**声明**（`DocEntry.program` · `DocEntry.docType`），派发期不解析文档。
- 被拒出口先 seal 本轮载体（与相邻两道门同形）：`-a2` 重试帧被拒后既无 in-flight 记录，draft 也仍是 0o444。
- 派发面的既有 fixture **全量**交真实输入，三类各自闭合：scene 面（两个测试文件里每一个派发 wave 面的 scene，含内联字面量与 P21 的 `sceneOf` 轮次）落盘 brief、给 `baseBranch`，docs-fix 帧交 reviews 载体；真 CLI 派发面（wave-face brief 重抽那条、live-tree branch 面、P22 T17 的 (a) · (b) · (c)，以及 `preview.test.ts` 的真派发 `runArgv` 帧）派发前 `cdd base set`；`scene()` 工厂的格不属这条判据——它喂的是内联 `Preview#render`，从不过门，补它是空操作。没有 scene 因为一份它本来就该交出去的输入而被挡。`--dry-run` 预览帧（第三类）同属这条全量判据，其基准与期望值由 Task 3 随预览同源一并种下——预览到那时才读这道门，修复归让它红的那个任务。
- 行为被反转的旧 pin 在同一任务内翻新并重述标题，共两条臂：反转 ① 的 `INPUT_OVERALL` 臂由「解析不到只掉一行」改为 `target-absent` 且 child 零 spawn；反转 ② 的 `(f2)` 臂由「可见软跳过（`FIX_DISPOSITIONS_UNRECORDED`）、轮次照常收口」改为 child 存在之前的硬 BLOCK（无载体旧记录 ⇒ `INPUT_REVIEWS · empty-value`，根本没有记录 ⇒ `INPUT_REVIEWS · target-absent`），两臂都在 `14fe3d12`；P37 T4 的 ② 与 ④ 两臂字节不变；`src-next/face/` 全绿且无新增 `it.skip`。
- 以上判据在 `14fe3d12` 已交付（纯读门 · 报文器 · 一次合成与 seal 出口 · 三类派发面各交真实输入 · `dispatch-input.test.ts` 的全量臂）；重进本任务的判据是「仍绿」，不是「由红转绿」——变红即回归。

#### DependsOn
1

### Task 3: `--dry-run` 同源与预览答案

#### Objective
让预览与真派发是**同一个返回值的两个消费者**：同一帧下两者的拒绝串逐字节相同；预览不能把引擎合成的那一格（wave brief）读成不存在。

以上已在 `692f0ac7`（预览同源读三道纯读门）与 `4c31018a`（carrier 面的字节等价臂 · `#carrierRefusal` 升为公开纯读）交付：本任务重进时核对的是交付后的字节与臂，不是再写一遍。

#### Files
- Modify: `packages/cdd-engine/src-next/face/cli.ts`（`--dry-run` 的拒绝串读取点，与 `artifactRefusal` 并列，按 `mode: "preview"` 调用）——**已落地**（`692f0ac7`）
- Modify: `packages/cdd-engine/src-next/face/preview.ts`（`Preview#artifactBlock` 的 docblock 认领三臂——carrier-integrity · dispatch-input · artifact-identity；方法本身已是通用的：一条 reason 串加首行拆分）——**已落地**（`4c31018a`）
- Modify: `packages/cdd-engine/src-next/face/lifecycle.ts`（`CliLifecycle#carrierRefusal` 由私有升为公开纯读——与 `artifactRefusal` / `inputRefusal` 同一形态，判定只有一处，两面共用）——**已落地**（`4c31018a`）
- Test: `packages/cdd-engine/src-next/face/__tests__/cli.test.ts`（追加三批：① 字节等价三臂；② 预览帧的基准与期望——`--dry-run` 同样读这道门，无 `base.json` 的 wave / branch 预览会被 `BASE_BRANCH` 的 `empty-value` 拒，见 Step 4；③ carrier 面的字节等价臂——同一 fix 帧，预览 `refused:` 行的值 === 真派发 `RoundViolation.message`）——**已落地**（`692f0ac7` ① ②、`4c31018a` ③）
- Test: `packages/cdd-engine/src-next/face/__tests__/preview.test.ts`（本任务只在这一文件里种基准与补期望——那条走到预览块的 review `--dry-run` 帧，见 Step 4；预览路径的实现只在 `cli.ts` 一处）——**已落地**（`692f0ac7`）

#### Consumes
- Task 2 的 `inputRefusal(frame, "preview")` 与 dispatchInput 报文器（`preview` 判别位就在门的签名上，预览路径不再自带第二套判据）
- `RoundNaming` 的 brief 命名行（`session/round-naming.ts`）——预览里 satisfied 格的命名来源，读取点在门的预览分支，本任务只负责把 `mode` 传对

#### Produces
- 预览与真派发读**同一组三道预派发门**，顺序逐一同序：carrier-integrity（`CliLifecycle#carrierRefusal`，本任务把它由私有升为公开纯读）→ dispatch-input（`inputRefusal(frame, "preview")`）→ artifact-identity（`artifactRefusal`）；交给 `Preview#artifactBlock` 的是这三道里第一个非空的返回值，预览不新增第四道门、也不重排顺序
- `--dry-run` 在违例帧上把门的拒绝串原样交给 `Preview#artifactBlock`，落在既有的 `  refused:  <reason>` 行里——两个消费者读同一条串；`CDD_BLOCKED: ` 前缀仍只由 `#blocked` 加（预览不复制它），既有的预览输出行集一格不变（spec §2.4 钉的是 reason 字节，不是打印出来的那一行）
- 预览对 `preview: "satisfied"` 的格按「命名行点名即满足」处理，不做存在性读、不写盘

#### Steps
- **Step 1**：写失败测试——(a) 同一违例帧，预览 `refused:` 行的值 === 真派发 `RoundViolation.message`（逐字节 `toBe`；`RoundViolation` 的字段是 `grade` · `cause` · `message`，没有 `reason`）；(b) wave 帧在 brief 尚未落盘时预览 **不** 报 `target-absent`；(c) 预览的输出行集与改动前一致（无新增行）。— **已落地**（`692f0ac7`）：三条臂的红期属于该提交之前的树，重进本步读到的是绿，变红才是回归。— checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/face/__tests__/cli.test.ts -t "dispatch-input"` 绿（树上该 describe 标题为 `cdd <verb> --dry-run — the dispatch-input gate (P38 T3)`，过滤器真实命中）。
- **Step 2**：在 `cli.ts` 的预览路径上按真派发的顺序取门——`harness.carrierRefusal(frame)` → `harness.inputRefusal(frame, "preview")` → `harness.artifactRefusal(frame)`（三道纯读，与 `#runDispatch` 的判定顺序逐一同序），把第一个非空返回值原样渲染。— **已落地**（`692f0ac7`）。— checkable: (a)(c) 绿，且 carrier 面的字节等价臂绿（`4c31018a`）。
- **Step 3**：确认预览路径不另起一次判定：`mode: "preview"` 是门上的唯一差异位，预览不合成第二个 `TemplateValues`、不写盘、不 extract brief。— **已落地**（`692f0ac7`）。— checkable: (b) 绿，且既有 `--dry-run` 零写入断言仍绿。
- **Step 4**：种预览帧的基准（第三类派发面，Task 2 Step 6 登记的那一类）：枚举 `cli.test.ts` 与 `preview.test.ts` 里**真正走到预览块**的 wave / branch `--dry-run` 帧（pre-flight 通过的帧），派发前先 `cdd base set`（写下的就是 `base.json`，恢复动作本身就是它），并给每帧补**退出码 + 渲染行**两条期望：wave 评审帧仍是 exit 0 且无 `refused:` 行。**预期被拒的帧不在此列**：「the clean-tree gate blocks the three verbs on a dirty tree」那条里的 review / fix 两臂由 pre-flight 在预览块之前拒（`!verdict.allowed` 先返回），期望一个字节都不改（`CDD_BLOCKED` + 「commit or discard」），也不种基准——种了既不改变判据，还让「谁在拒」说不清。判据是这一类，不是这张名单：任何走到预览块、缺基准的 wave / branch 帧都会在 Task 6 的 `validate` 里红。— **已落地**（`692f0ac7`）：两文件的预览帧已种基准并带期望。— checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/face/__tests__/cli.test.ts src-next/face/__tests__/preview.test.ts` 全绿，且每条被种基准的帧都带退出码与渲染行期望。
- **Step 5**：提交。— checkable: `git log --oneline -1` 显示本任务提交，`git status --short` 为空。

#### Acceptance
- 字节等价 pin 存在且真能红：把 inputRefusal 的返回值篡改一个字节 ⇒ 该测试红。
- 三面同序：同一个 `fix` 帧两面被 carrier-integrity 与 dispatch-input 同时判时，两面拒绝串逐字节相同（carrier 先判），预览不会预报一个真派发会拒的轮次。
- 预览零新增输出行、零写入（既有 `--dry-run` 零写入断言仍绿）。
- wave 帧在 brief 未落盘时预览不误报；`satisfied` 只豁免存在性腿，空值腿照判。
- 预览帧的基准：每一个走到预览块、且是 wave / branch 面的 `--dry-run` 帧都在派发前 `cdd base set`，并带退出码与渲染行期望——这一类由本任务修，不留到 Task 6 的 `validate`；pre-flight 先拒的帧（`!verdict.allowed` 在预览块之前返回）不在此列，它们的拒绝归属与期望值一个字节都不改。
- 以上判据在 `692f0ac7`（同源预览 · 三臂顺序 · 预览帧基准）与 `4c31018a`（carrier 面的字节等价臂与 docblock）已交付；重进本任务的判据是「仍绿」，不是「由红转绿」——变红即回归。

#### DependsOn
2

### Task 4: 四段 shell 文本与 `$version`

#### Objective
四个 shell 正文各带一句 `scratch/` 纪律；`fix` 与 `docs-fix` 的读入指令各带半句 `none`；`$version` 递增。字节 pin 断言这四句与两句的确切文本存在。以上已在 `618417b8` 交付：本任务重进时核对的是交付后的字节，不是再写一遍。

#### Files
- Modify: `packages/cdd-engine/src-next/render/templates.ts`（`IMPLEMENT_SHELL` · `REVIEW_ITEM` · `FIX_SHELL` · `DOCS_FIX_SHELL` · `$version`——**已落地**（`618417b8`）：四份 shell 正文各带 `SCRATCH_DISCIPLINE`，`FIX_SHELL` / `DOCS_FIX_SHELL` 的读入指令各带 `none` 半句）
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
- **Step 1**：写失败测试——(a) 四个 shell 断言各含 `scratch/<round-id>` 那句话（按子串 `scratch/` + `OUTPUT_HANDOFF` 双条件，避免只测一个词）；(b) `FIX_SHELL` 与 `DOCS_FIX_SHELL` 含 `the literal \`none\``；(c) `IMPLEMENT_SHELL` 与 `REVIEW_ITEM` **不含** `none` 半句（半句只属于有 `INPUT_RULINGS` 的两面）；(d) `render.test.ts` 里 `$version` 的 pin 断言 `TEMPLATE_PROMPT` 的 `$version` 为 25（24 → 25 的翻新已在 `618417b8` 与 (a)–(c) 同一提交完成；同一常量只有一个家，不在 `templates.test.ts` 新建第二个）。— **已落地**（`618417b8`）：四条的红期已过去，重进本步读到的是绿；任何一条变红才是回归。— checkable: 四条绿。
- **Step 2**：四句与两句的措辞逐字取 spec 的围栏块，`$version` 为 25——**已落地**（`618417b8`）：本步重进时没有待写的字节，只有核对交付后的形态。— checkable: 四条绿，`TEMPLATE_PROMPT` 的 `$version` 仍为 25。
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

### Task 5: 章程 `v4.08` · `v4.09` · `v4.10` 回填（已交付）与语料计数核对

#### Objective
本任务记录**已交付的拆分**，不再重发写入：`618417b8` 落了 spec §6 第 8 项那三笔字节（requiredOn 的臂形态域、`path: true` 位、反转计数 3 → 4 并点名 `BASE_BRANCH`）与章程 `v4.08` 的 change-history 行；phase-spec 轮随后落地第 9 项（章程 `v4.09`，spec §6 第 9 项的验收 ① 改述）；`79b34aae` 落地第 10、11 项（章程 `v4.10`）——第 10 项把 `v4.08` 行 ③ 的状态名更正为 `spec-absent`（`v4.08` 行本身按历史不动，更正写进新的 `v4.10` 行），第 11 项把验收 ① 的穷尽性方向改成「round-context zone 里每个已登记 token 必须被某份 row 的 layout 携带」。语料那一格同样已落地——本计划自身是第 81 个文件，`CORPUS_SIZE` 已是 81。因此本任务的判据落在**当前字节**上：`board` 报 `overall … v4.10`、`CORPUS_SIZE === 81`、「三处反转」零次；树上没有待改的字节，重进本任务等于一次对齐核对。

#### Files
- Modify: `docs/kairos/overalls/2026-10-10-engine-doc-tooling-overall.md`（D94 行 · Phase inventory 的 P38 行详情格与 Scope ① 段的计数 · front-matter `version:` · change-history 行）——**已落地**：`v4.08` 在 `618417b8`，`v4.09` 由 phase-spec 轮落地，`v4.10`（第 10、11 项）在 `79b34aae`
- Modify: `packages/cdd-engine/src-next/contract/__tests__/pins.guard.test.ts`（`CORPUS_SIZE` 79 → 81：phase-spec 与 plan 各自是语料文件，两个都在本相位落仓，所以起点是 79 而不是 80）——**已落地**

#### Consumes
- `docs/kairos/specs/2026-11-17-engine-doc-tooling-p38-design.md` §6 第 8 项至第 11 项（原文与改法逐字给定；四项都已标为落地）

#### Produces
- 章程当前 `version: v4.10`，change-history 的 `v4.08` · `v4.09` · `v4.10` 三行在册（分别对应第 8、第 9 项与第 10、11 项）
- D94 行与 P38 详情格的 requiredOn 域是臂形态、声明表条目带 `path: true`；P38 Scope ① 段的计数是「四处反转」，第四个点名为「无 `base.json` 时的 `BASE_BRANCH` `empty-value`（恢复动作 `cdd base set`）」，该处的 `spec:` 一半已撤——以上均为当前字节
- `CORPUS_SIZE === 81`，pin 门与 census 门全绿
- 本任务**不新增字节**：树上已无待写的三笔回填

#### Steps
- **Step 1**：核对 spec §6 第 8 项至第 11 项在章程里的落地位置，逐项读当前字节——第 8、9 项在 D94 行 · P38 行详情格 · P38 行验收 ① · Scope ① 段的「四处反转」（臂形态域写成「一格一条臂，或几条合取臂」，一条臂的 `types` 可以是空数组——`never` 的规范形态就是 `{ types: [] }`，所以 `INPUT_RULINGS` 与 `docs-fix` 的 `WAVE` 只挂这一条臂，落在域内，不是在域外多出一种「零条臂」）；第 10 项在 change-history 的 `v4.10` 行（`v4.08` 行 ③ 的 `undeclared` 措辞按历史原样保留，`spec-absent` 的更正与「`v4.08` 行不改」的理由同写在这一行）；第 11 项在 P38 行验收 ①（穷尽性方向为「zone 里每个已登记 token 必须被某份 row 的 layout 携带」）与同一条 `v4.10` 行的 ⑪ 段。— checkable: `node packages/cdd-engine/src-next/bin.ts board --spec docs/kairos/specs/2026-11-17-engine-doc-tooling-p38-design.md` 报 `overall … v4.10` 且 `next:` 不变；**任何其他版本值都是漂移**——报 `v4.10` 之上的版本要读新行的落地项、报 `v4.09` 或更低说明第 10、11 项被回退，两条都落回拥有它的任务修，不把当前版本当成漂移重写成旧值、也不重发该版本的写入。
- **Step 2**：核对语料计数：`CORPUS_SIZE` 是 81，文档契约与 pin 门全绿。— checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/contract/__tests__/pins.guard.test.ts src-next/contract/__tests__/census.guard.test.ts` 全绿（语料条数 81，`pin.total` 为 0）。
- **Step 3**：无漂移则不产生提交（本任务的交付已在 `618417b8` 与 phase-spec 轮的提交里）；有漂移则提交一次只含该漂移修复的提交，不夹带其他内容。— checkable: `git status --short` 为空；有漂移时 `git log --oneline -1` 显示该提交且随后 `git status --short` 为空。

#### Acceptance
- 章程当前 `version: v4.10`，第 8 项的三笔字节、第 9 项的验收 ① 改述、第 10 项的状态名更正（`v4.08` 行按历史不动，`undeclared` → `spec-absent` 的更正写进 `v4.10` 行）与第 11 项的穷尽性方向逐字在树上，change-history 的 `v4.08` · `v4.09` · `v4.10` 三行各自对应第 8、第 9 项与第 10、11 项。
- 文档契约腿与 pin 门绿，`CORPUS_SIZE` 是 81（不是「条数不变」）。
- `grep -c "三处反转"` 在章程里为 0。
- 本任务不重发 `v4.08` 写入、不把验证搬进别的任务：无漂移时它零字节产出。

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
| v0.3 | 2026-11-17 | plan-review-2 docs-fix 轮（F1–F10 全部落地）：Task 1 的构造期断言改为四条判据一处家——死格 · 槽注册 · shell↔layout（从 #assertShellLayout 迁入并删除该方法，同一事实不再两处）· round-context zone 覆盖，并写明「删一行声明」由 shell↔layout 兜住、不再有一条循环判据 · Task 1 补 drop 格的数据驱动遍历（每个 `absent: "drop"` 格播空值 ⇒ 该行消失且其余行逐字节不变）并订正零条臂的计数口径（只数 token 行）· Task 2 规定 `when` 命中而值为空 ⇒ `target-absent`、通用 `empty-value` 只留给无 `when` 的臂，拒绝出口补 `#sealRoundCarriers`（与相邻两道门同形），派发面 fixture（lifecycle · cli 的 brief 落盘与 `baseBranch`、fix 轮 reviews 载体）独立成步并入 Files，Produces 补 DispatchInputSegment 与 `fs?: DocFs` 注入位并点名 `#sceneOf` · `#lifecycleOf` 两处编辑点 · Task 3 预览改为把门的 reason 原样交给既有 `refused:` 行（不复制 `CDD_BLOCKED: ` 前缀），字节等价 pin 改钉 `RoundViolation.message` | Oscaner M. · Claude（kairos:cdd-dev · 2026-11-17） |
| v0.4 | 2026-11-17 | plan-review-3 docs-fix 轮（F1–F7 全部落地）：Task 1 Step 4 删掉「exigible 空值照常渲染为空值」那条——渲染层只答 `absent` 这一面（空值按声明丢行或印裸词 `none`），exigible 的空值由门先拒、到不了 `render()`，装配器不新增 exigibility 输入 · Task 1 的构造期断言补第六臂（登记了 round-context token 而任何 row 都不携带 ⇒ 抛），与 shell↔layout 分列两个方向 · Task 1 Produces 声明 layoutOf(values) 作为行选择与声明表的唯一读面，Task 2 Consumes 与 Step 3 改读它 · Task 2 的路径格写明 repoRoot-relative 基线与 `RepoRoot#resolve` 擦除（`DocFs#exists` 只被问绝对路径），Step 1(b) 的 stub 断言该形态 · Task 2 Step 5 由三个具名 fixture 改为两个测试文件的全量扫描（内联字面量、P21 的 `sceneOf` 轮次、docs-fix 的 reviews 载体一并点名） · `INPUT_RULINGS` 与 docs-fix 的 `WAVE` 由「零条臂」改记为 `never` 的规范形态一条空 `types` 臂（Task 5 的章程句子随之写明该形态在域内） · `#gate` 里的 #assertShellLayout 调用点明确删除 | Oscaner M. · Claude（kairos:cdd-dev · 2026-11-17） |
| v0.5 | 2026-11-17 | plan-review-4 docs-fix 轮（F1–F7 全部落地，F4 与 F5 的裁定均 ACCEPTED）：守恒条款改为清单的补集形态——除 spec §2.3 点名的四处反转与 spec §3.3 / §5.1 两句 shell 新文本外逐字节不变，与 spec 的 Constraints 同形（F4） · Task 2 Step 5 拆成两类派发面：真 CLI 的 `runArgv` 帧派发前 `cdd base set` 种基准（wave-face brief 重抽 · live-tree branch 面 · P22 T17 的 (a)(b)(c)），行为被反转的 P37 T4 ③ 臂在同一任务内翻新为 `INPUT_OVERALL` 的 `target-absent` 且 child 零 spawn、标题与四臂注释重述，「不给测试开后门」收窄为「没有 scene 因本该交出去的输入被挡」（F1） · Task 1 把 shell↔layout 的 per-render 旧钉改写成构造期臂（注入带 rogue row 的契约、断言构造函数抛），并点名 `roundContext` 四处形状 pin 改读逐行声明对象的 `.line`（含反面臂，否则真空绿）（F2 · F3） · 场景两格声明为可选且可空（`program` 与 `docType` 都带问号与 null），预览 fixture 同补两格与 `baseBranch`（F5） · `preview` 域补回 `value`（F6） · `$version` 翻新落在它唯一的家 `render.test.ts`，不在 `templates.test.ts` 另开第二个（F7） | Oscaner M. · Claude（kairos:cdd-dev · 2026-11-17） |
| v0.6 | 2026-11-17 | plan-review-5 docs-fix 轮（F1–F4 全部落地，F1 与 F4 的裁定均 ACCEPTED）：Task 5 由「重发 `v4.08` 写入」改为**对齐块**——`618417b8` 已落 spec §6 第八项与章程 `v4.08`，phase-spec 轮随后落 `v4.09`（第九项），判据改钉当前字节（`board` 报 `overall … v4.09` · `CORPUS_SIZE === 81` · 「三处反转」零次），不重发旧版本、不把验证搬进别的任务（F1） · Task 1 / Task 4 的 Step 1–2 记为 `618417b8` 已交付，checkable 改钉交付后状态（构造期 `#assertDeclarations` · `TEMPLATE_PROMPT` 的 `$version` 为 25），并把「判据逐字搬自旧 shell↔layout 方法」那句换成判据自身的描述——该方法已随声明升格退役（F2） · Task 2 Step 5 与 Task 3 补第三类派发面：`--dry-run` 预览帧，wave / branch 帧先 `cdd base set`、每帧带退出码与渲染行期望，修复归让它红的 Task 3 而不留到 `validate`（F3） · `when` 命中而值为空按**臂的种类**分腿——`program` ⇒ `target-absent`、`identity` ⇒ `empty-value`（spec §2.3），Step 1 补 (k) 臂，两条腿只靠 reason 词区分（F4） | Oscaner M. · Claude（kairos:cdd-dev · 2026-11-17） |
| v0.7 | 2026-11-17 | plan-review-6 docs-fix 轮（F1–F4 全部落地，F1 的裁定 ACCEPTED）：Task 2 Step 1 的 (h) 把论域收为「两个行选择槽之外的全部 exigible 格」——`ROLE` 与 review 行的 `TARGET_TYPE` 由 `layoutOf(values)` 选行、空掉即在建行之前抛，改由新增的 (l) 臂钉装配器既有报文（`work-mode not declared` / `review type not declared`）那条前置条件，门不新增第三条 reason，Step 1 由十一条增至十二条（F1） · 预览帧这一类删去「clean-tree 门那条 review / fix 两臂」并写明它们是 pre-flight 先拒、走不到预览块，改举 `preview.test.ts` 的「consumes no round」帧为可见成员（Task 2 Step 6 · Task 3 Step 4）（F2） · `preview.test.ts` 的 Files 注与 Acceptance 由 `scene()` 工厂格改指 `runArgv` 帧：真派发帧种基准，工厂格只在 wave 帧自己的格参与断言时才动（F3） · 预览帧由 Step 5 的兄弟项升为自带 checkable 的 Step 6，提交步顺延为 Step 7，Acceptance 改点名 (i)(j)(k)（F4） | Oscaner M. · Claude（kairos:cdd-dev · 2026-11-17） |
| v0.8 | 2026-11-17 | wave-3 review-fix 轮（F1–F3 全部落地，F1 与 F2 的裁定均 ACCEPTED）：预览与真派发共用三道预派发门而非两道——`CliLifecycle#carrierRefusal` 升为公开纯读（判定仍只有一处），预览按 `#runDispatch` 的顺序取 carrier-integrity → dispatch-input → artifact-identity，carrier 面补一条字节等价臂（F2） · `Cli#runWork` 的 harness 回传注释与 `Preview#artifactBlock` 的 docblock 同述三臂与判定顺序，`mode: "preview"` 由「更强的一臂」改正为「唯一更宽松的一臂」（F1 · F3） · Files 增补 `preview.ts`（docblock）与 `lifecycle.ts`（纯读升格） | Oscaner M. · Claude（kairos:cdd-fix · 2026-11-17） |
| v0.9 | 2026-11-17 | plan-review-7 docs-fix 轮（F1–F4 全部落地）：Task 2 与 Task 3 按 Task 1 / 4 / 5 的记法标为已交付——Files 逐行点名 `14fe3d12`（门 · 报文器 · 一次合成与 seal 出口）与 `692f0ac7` · `4c31018a`（预览同源 · 三道门同序 · carrier 面的字节等价臂），Steps 与 Acceptance 改钉交付后状态（「仍绿，不是由红转绿」）（F1） · Task 2 Step 1(h) 的论域改为三个豁免——两个行选择槽（家是 (l)）· 引擎自算的五个格（家是 (h2) 的手写清单）· 从声明表推出的 `never` 格；新增 (h2) 臂承担分类循环（未归类的携带槽红）与降级守卫（清单里的 token 仍被携带、且无配方），Step 1 与 Acceptance 由十二条增至十三条（F2） · Task 2 Step 2 的 checkable 由命中 0 条的 `-t "dispatchInput"` 改为文件真实标题 `-t "the reported cell"`，并写明误用过滤器会报 `19 skipped` 而 exit 0 (F3) · Task 3 Produces 补第三道门与判定顺序——carrier-integrity → dispatch-input → artifact-identity，与 Steps / Acceptance 同述（F4） | Oscaner M. · Claude（kairos:cdd-fix · 2026-11-17） |
| v0.10 | 2026-11-17 | branch-fix-1 轮（F1–F5 全部落地，F1 与 F4 的裁定均 ACCEPTED）：Task 1 的构造期判据由四条增至五条——`preview: "satisfied"` 只准挂在 `INPUT_WAVE_BRIEF` 那一格上（第二个 `satisfied` 格在装配器建不起来时红，报文点名该格与 `INPUT_WAVE_BRIEF`），Step 1 由六条增至七条（新增 (f) 那个方向，原在册契约臂顺延为 (g)），Acceptance 同批改（F4） · Task 5 的语料起点订正为 79 → 81——phase-spec 与 plan 都在本相位落仓，起点不是 80，落地的 81 与它自己的 pin 不变（F5） · F1 的三处 docblock（`#baseBranchOf` · `#valuesOf` 的 `INPUT_RULINGS` 注释 · `#reviewsPath`）改写成 `WAS: … NOW: …` 形态并点名 ② ③ ④ 三处反转，同一标准下同族的另三处一并订正（`#valuesOf` 头注的「空值一律丢行」 · `#rulingsInputOf` 对同一格的描述 · `INPUT_OVERALL` 注释里「空值即丢格」）；F2 在 `lifecycle.test.ts` 补回 P34 §2.10 的 attempt ≥ 2 臂（记录无评审 ⇒ 家族名只拼 cycle，`tasks-1-review-1.json` 在盘 ⇒ 本轮成立），F3 订正 `dispatch-input.test.ts` 表头为十三条 | Oscaner M. · Claude（kairos:cdd-fix · 2026-11-17） |
| v0.11 | 2026-11-17 | plan-review-8 docs-fix 轮（F1–F3 全部落地）：Task 5 由 `v4.09` 对齐到 `v4.10`——标题 · Objective · Files · Consumes · Produces · Steps · Acceptance 一并改名，并把 spec §6 第 10、11 项写进拥有它们的任务（`79b34aae`：`v4.08` 行旁的 `spec-absent` 更正与验收 ① 的穷尽性方向），Step 1 的 checkable 改钉 `overall … v4.10`、并写明任何其他版本值都是漂移（报得更高要读新行、报 `v4.09` 或更低说明两项被回退），改写章程旧版本为漂移只是把 `v4.10` 行删掉（F1） · Task 2 Step 5(h) 与 Acceptance 把本任务翻新的臂由一条补齐为两条：反转 ① 的 `INPUT_OVERALL` 臂与反转 ② 的 `(f2)` 臂（可见软跳过 `FIX_DISPOSITIONS_UNRECORDED` 改为 child 存在之前的硬 BLOCK），并写明 P37 T4 的臂号与反转号是两套编号（F2） · Task 1 Acceptance 由「构造期四判据均在 `618417b8`」改为五条并拆开坐标：四条在 `618417b8`、预览唯一性判据在 `229f35f4`（F3） | Oscaner M. · Claude（kairos:cdd-fix · 2026-11-17） |
