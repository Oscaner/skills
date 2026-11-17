---
title: 'P38 · 派发输入契约：必填表、`none` 表示法与 `dispatch-input` 门'
doc-type: plan
version: v0.2
date: 2026-11-17
slug: 2026-11-17-engine-doc-tooling-p38-design
base: develop
---

## Constraints

- **声明只声明，不改字节**：除 §T4 的四句 `scratch/` 与两句 `none` 之外，任何一轮的 dispatch prompt 逐字节不变；`$version` 由 24 递增到 25 是「prompt 字节已变」的唯一机械信号。
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
- Modify: `packages/cdd-engine/src-next/render/templates.ts`（`ModePromptRow` / `TemplatePrompt` 类型、四个 row 的 layout、`TemplateAssembler` 构造期的断言入口与可选注入位）
- Modify: `packages/cdd-engine/src-next/render/__tests__/render.test.ts`（P31 §2.5 的 fix 轮 `INPUT_RULINGS` 零行旧钉，翻成裸词 `none` 并注明 deliberate）
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
  readonly preview?: "satisfied";
}
```
- `ModePromptRow` 增 `readonly serves: readonly TargetType[]`（该 row 真正渲染的 type 集：`implement` → `["wave"]`；`fix` → `["wave", "branch"]`；`docs-fix` → 四个文档面；`review` → 六个），`roundContext` 改为 `readonly ContextLine[]`
- 注入位（断言可写的前提：一个被变异的声明必须能被送进装配器）：
```ts
constructor(contract: TemplatePrompt = TEMPLATE_PROMPT)
```
- `TemplateAssembler` 构造函数调用 `#assertDeclarations()`（私有方法，构造期一次性）

#### Steps
- **Step 1**：写失败测试 `context-lines.test.ts`，五条断言各一个 `it`——(a) 死格：临时构造一条臂，其 type 落在 `fix` row 的 `serves` 之外（`overall`）⇒ 构造抛错且报文点名该 token 与 `overall`；(b) 覆盖缺口·删声明方向：删掉 `review` 某行的声明 ⇒ 构造抛错（该 row 的 layout 仍携带那个 round-context 槽）；(c) 覆盖缺口·多槽方向（spec §4.2 的逐行论域）：给某 row 的 layout 加一个登记表里没有的 round-context 槽 ⇒ 构造抛错；(d) 空臂集合法：`INPUT_RULINGS` 与 `docs-fix` 的 `WAVE` 声明为零条臂 ⇒ 构造**不**抛（`never` 是合法声明，不是无信息声明）；(e) 在册契约 ⇒ 构造不抛。— checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/render/__tests__/context-lines.test.ts` 五条全红（ContextLine 尚未存在，报错或类型缺失）。
- **Step 2**：在 `templates.ts` 定义 RequiredArm / ContextLine（围栏块内的两个 interface），给 `ModePromptRow` 加 `serves`，把四个 row 的每一行改写为声明对象——取值逐行照 spec §1.4 的表：`INPUT_*` 六个读入格 `path: true`；`INPUT_RULINGS` 的 `absent: "none"` 与零条臂（`never`；`docs-fix` 的 `WAVE` 同为零条臂），其余 `absent: "drop"`；`INPUT_WAVE_BRIEF` 加 `preview: "satisfied"`；`OUTPUT_*` / `WORKSPACE_*` / `ROLE` / `TARGET_TYPE` / `WAVE` / `BASE_BRANCH` 按表给 `always` 或 type 集；`## Round context` 标题行与空行零条臂。— checkable: `pnpm -C packages/cdd-engine exec tsc --noEmit -p packages/cdd-engine` 无错。
- **Step 3**：实现 `#assertDeclarations()`：两条判据——(a) 死格：每条臂的 `types` 是 `"always"` 或该 row 的 `serves` 的子集；(b) 逐行覆盖：`TOKENS` 中 zone 为 round-context、且出现在**该 row 自己那份 layout** 里的每个名字，都被该 row 的某条声明携带（spec §4.2 的论域是逐行的，不是全表的）。**没有第三条**：零条臂是合法声明（spec §1.3——构造期唯一的死格是命名了该 row 从不服务的 type），因此一个携带槽的行可以一条臂都不声明。— checkable: Step 1 的五条测试由红转绿。
- **Step 4**：让 `#contextLines` 按四态真值表渲染：值非空 ⇒ 渲染该值；空且 exigible ⇒ 由 T2 的门接手（渲染层不静默丢行，行照常渲染为空值以便诊断）；空且不 exigible 且 `absent: "drop"` ⇒ 整行消失；空且不 exigible 且 `absent: "none"` ⇒ 渲染裸词 `none`。同一批里翻掉 P31 §2.5 的三处旧钉：`render/__tests__/render.test.ts` 的「无 sidecar ⇒ 零行」与 `face/__tests__/lifecycle.test.ts` 的两处零行断言，改成「行恒在 · 值为裸词 `none`」，两处注释标注 deliberate（D74）——这是本相位点名的一处**故意翻钉**，不是「期望值悄悄变了」。— checkable: 新增两条测试（`INPUT_RULINGS` 空值渲出 `none`；`overall` 面无 `INPUT_SPEC` 整行）与翻新后的三处断言转绿。
- **Step 5**：跑 render 面与翻过钉的 lifecycle 面，确认没有别处依赖旧的 `string[]` 形状。— checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/render/ src-next/face/__tests__/lifecycle.test.ts` 全绿。
- **Step 6**：提交，提交信息点名 P31 §2.5 的 deliberate 翻钉。— checkable: `git log --oneline -1` 显示本任务的提交且信息含 deliberate，`git status --short` 为空。

#### Acceptance
- 死格与覆盖缺口（删声明、多槽两个方向）各自在构造期抛错，报文点名 token 与 offending type；零条臂不抛。
- 在册契约构造不抛；`templates.ts` 的四份 layout 逐行带声明，`INPUT_RULINGS` 是唯一的 `absent: "none"`，`INPUT_WAVE_BRIEF` 是唯一的 `preview: "satisfied"`，`INPUT_RULINGS` 与 `docs-fix` 的 `WAVE` 是仅有的两处零条臂。
- 四态真值表逐态可测：`none` 渲成裸词、`drop` 整行消失、非空渲染该值。
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
- Modify: `packages/cdd-engine/src-next/face/cli.ts`（`#sceneOf` 交出两个声明格）
- Create: `packages/cdd-engine/src-next/face/__tests__/dispatch-input.test.ts`

#### Consumes
- Task 1 的 ContextLine / RequiredArm / `ModePromptRow` 的 serves 格与 `TemplateAssembler`
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
// Words 的新报文器
dispatchInput(facts: { segments: readonly DispatchInputSegment[] }): string;
```
- 报文形如 `CDD_BLOCKED: dispatch-input · <row> · <TOKEN> · <reason>; <row> · <TOKEN> · <reason>`
- `reason` 闭集：`empty-value` · `target-absent`
- 场景两格：`DispatchScene` 新增「`program:` 声明字面量」与「`doc-type:` 声明形状」两格，由 `#sceneOf`（`face/cli.ts`）从文档域那次读交出，与 `specLink` · `overallLink` 并列——门在派发期不解析任何文档，只读这两格
- 一次合成：`#runDispatch` 只调一次 `#valuesOf(frame, artifactCell)`，同一个值先给门、再给 prompt

#### Steps
- **Step 1**：写失败测试 `dispatch-input.test.ts`——十条 `it`：(a) 每个 requiredOn 命中的格播空值 ⇒ inputRefusal 非空且报文含该 `row` 与该 `TOKEN`；(b) `path: true` 的非空值指向不存在的文件 ⇒ `target-absent`；(c) 同一帧两格违例 ⇒ 报文两段、以 `; ` 连接；(d) `when: "program"` 不命中（身份文档没有 `program:`）⇒ 该格不报；(e) `INPUT_RULINGS` 空值 ⇒ 不报（`absent: "none"`，由 T4 的渲染接手）；(f) 在册帧 ⇒ `null`；(g) branch 帧无 `base.json` ⇒ `BASE_BRANCH` `empty-value`（§2.3 清单的第四处反转）；(h) **数据驱动全覆盖**：遍历声明表，对每个 exigible 的格各播一个空值，断言报文点名该 `row` 与该 `TOKEN`（逐格成对，不靠人肉罗列）；(i) **P37 T4 的 ④ 臂**：同 slug 身份文档在盘上、`slug:` 已声明而 `doc-type:` 未声明（`DocEntry.docType` 为 null）⇒ `INPUT_SPEC` 不 exigible、inputRefusal 返回 `null`、派发字节与今日逐字节相同；(j) **反转 ①**：身份文档声明了 `program:` 而其章程解析不到 ⇒ 报文末段为 `INPUT_OVERALL · target-absent`。— checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/face/__tests__/dispatch-input.test.ts` 十条全红。
- **Step 2**：在 `Words` 加 dispatchInput（`CAPSULE_WORDS` 同形条目 + 方法），报文由段数组拼装，段内 ` · `、段间 `; `。— checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/face/__tests__/dispatch-input.test.ts -t "dispatchInput"` 绿（报文器的两条 pin 落在本任务声明的测试文件里；`words.guard.test.ts` 是禁词表守卫，不是报文器测试）。
- **Step 3**：实现 `#inputRefusalOf(values, frame, mode)`：遍历当前 row 的声明行；对每行算「本行在本 type 上是否 exigible」——任一臂的 `types` 命中当前 type 且 `when` 成立，`"program"` 读场景交出的 `program:` 声明格（**不是** `scene.overallLink`），`"identity"` 读同一处交出的 `doc-type:` 声明格（**不是** `scene.specLink`）。判定分支：exigible 且值为空 ⇒ `empty-value`；臂由 `when: "program"` 命中、而该格交出的已解析值为空 ⇒ `target-absent`（声明了却解析不到，spec §2.3 反转 ①）；`path: true` 且值非空 ⇒ 用注入的 `DocFs#exists` 判存在，不存在 ⇒ `target-absent`。`mode: "preview"` 只把 `preview: "satisfied"` 的格从**存在性腿**上豁免——空值腿照常判：命名行点名 ⇒ 视为满足，未点名 ⇒ `empty-value`（spec §2.4：预览不许问一个自己不会写下的文件，也不许用这一位豁免一个它并不满足的格）。收集全部段后一次返回。— checkable: Step 1 的 (a)–(j) 转绿。
- **Step 4**：把门接进派发缝：`#runDispatch` 只调一次 `#valuesOf(frame, artifactCell)`，把**同一个值**先交给 #inputRefusalOf（排在 `#artifactRefusalOf` 之前），artifact 门之后再把这个同一个值交给 prompt 渲染——一处判定两个消费者，不是两次合成（spec §2.1）；拒绝时走既有 `#blocked` 通道返回 `{ status: "BLOCKED" }`，**不追加 in-flight 记录、不递增轮次**。— checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/face/` 全绿，且新增一条 `it` 断言「被拒后 ledger 无本帧 in-flight 记录」。
- **Step 5**：提交。— checkable: `git log --oneline -1` 显示本任务提交，`git status --short` 为空。

#### Acceptance
- 十条判定行为各有测试，其中 (h) 遍历声明表逐格成对——新增一个必填格而不加测试会红；(i)(j) 是 spec 的两条结构前提各自的可见行为。
- 一次拒绝报**全部**违规格（不 fail-fast）。
- 门序在 artifact 门之前：同一帧同时违 `input` 与 `rulings` 时，报文是 `dispatch-input` 的那条。
- 被拒不占轮次、不留 in-flight 记录。
- `reason` 闭集只有两条，源码里搜不到 `missing-line`。
- 一次派发只合成一次 values：门与 prompt 读同一个值（不是两次 `#valuesOf`）。
- exigibility 读的是两处**声明**（`DocEntry.program` · `DocEntry.docType`），派发期不解析文档。

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
- `--dry-run` 在违例帧上打印与真派发完全相同的 `CDD_BLOCKED: dispatch-input …` 行，且不新增任何输出行
- 预览对 `preview: "satisfied"` 的格按「命名行点名即满足」处理，不做存在性读、不写盘

#### Steps
- **Step 1**：写失败测试——(a) 同一违例帧，预览字符串 === 真派发 `RoundViolation` 的 reason（逐字节 `toBe`）；(b) wave 帧在 brief 尚未落盘时预览 **不** 报 `target-absent`；(c) 预览的输出行集与改动前一致（无新增行）。— checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/face/__tests__/cli.test.ts -t "dispatch-input"` 三条红。
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
- Test: `packages/cdd-engine/src-next/render/__tests__/templates.test.ts`（追加）
- Test: `packages/cdd-engine/src-next/face/__tests__/board-view.test.ts`（追加孤儿成对 pin——`orphan:` 行本来就在这里断言）

#### Consumes
- spec §5.1 / §3.3 里固定的两句英文原句（围栏块内的确切字节）
- `WORKSPACE_DIR` 与 `OUTPUT_HANDOFF` 两个 token——`scratch/` 那句从后者取 stem、以 `WORKSPACE_DIR` 为基

#### Produces
- `IMPLEMENT_SHELL` · `REVIEW_ITEM` · `FIX_SHELL` · `DOCS_FIX_SHELL` 各含同一句 `scratch/` 纪律（`REVIEW_ITEM` 的注入使六个 review row 一致得到它）
- `FIX_SHELL` · `DOCS_FIX_SHELL` 的读入指令含 `none` 半句
- `$version` 24 → 25

#### Steps
- **Step 1**：写失败测试——(a) 四个 shell 断言各含 `scratch/<round-id>` 那句话（按子串 `scratch/` + `OUTPUT_HANDOFF` 双条件，避免只测一个词）；(b) `FIX_SHELL` 与 `DOCS_FIX_SHELL` 含 `the literal \`none\``；(c) `IMPLEMENT_SHELL` 与 `REVIEW_ITEM` **不含** `none` 半句（半句只属于有 `INPUT_RULINGS` 的两面）；(d) `$version === 25`。— checkable: 四条红。
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
- **Step 1**：按 spec §6 第 8 项逐条改字节（三处 + 版本 + change-history）。— checkable: `node packages/cdd-engine/src-next/bin.ts board --spec docs/kairos/specs/2026-11-17-engine-doc-tooling-p38-design.md` 报 `overall … v4.08` 且 `next:` 不变。
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
