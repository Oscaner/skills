---
title: 'P38 · 派发输入契约：必填表、`none` 表示法与 `dispatch-input` 门'
doc-type: plan
version: v0.1
date: 2026-11-17
slug: 2026-11-17-engine-doc-tooling-p38-design
base: develop
---

## Constraints

- **声明只声明，不改字节**：除 §T4 的四句 `scratch/` 与两句 `none` 之外，任何一轮的 dispatch prompt 逐字节不变；`$version` 由 24 递增到 25 是「prompt 字节已变」的唯一机械信号。
- **合法缺席与漏传必须可区分**：`when` 不命中的格是「没有这一格」，`requiredOn` 命中的空值是 `empty-value`，两者不得塌成同一个状态。
- **不新增 CLI 动词、不改 `next:` 字面**：门的失败面走既有 `CDD_BLOCKED` 通道（`#blocked`）。
- **不加白名单、不加 `census:<id>`、不写全表快照**：三者分别是「用登记代替结构」「用计数代替判据」「用快照代替语义」。
- **pin 写法**：路径 + 符号，不用行号；尚未在源树出现的词汇只进围栏块，行内用裸词（pin 门按源码标识符全集判，写进反引号即红）。
- **引擎只拒不改**：门拒绝后不移动、不改写、不删除任何产物；恢复动作归编排器。
- **P39 边界**：本相位不拆 `render/templates.ts` · `face/lifecycle.ts` 的类，只改声明与门；god object 拆分是 P39。
- 零裸函数：新逻辑进类（`biome-ignore lint/complexity/noStaticOnlyClass` 只在真正静态语料面上用），类 ≤200 行、方法 ≤4 参数。

### Task 1: 声明形状：`ContextLine` 与构造期断言

#### Objective
把每个 mode 的 round context 从 `readonly string[]` 升格为逐行声明，并在装配器构造期断言声明的自洽性——死格与覆盖缺口在**类建不起来**时就红，而不是等到某一次派发。

#### Files
- Modify: `packages/cdd-engine/src-next/render/templates.ts`（`ModePromptRow` / `TemplatePrompt` 类型、四个 row 的 layout、`TemplateAssembler` 构造期的断言入口）
- Test: `packages/cdd-engine/src-next/render/__tests__/context-lines.test.ts`（新建）

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
- `TemplateAssembler` 构造函数调用 `#assertDeclarations()`（私有方法，构造期一次性）

#### Steps
- **Step 1**：写失败测试 `context-lines.test.ts`，四条断言各一个 `it`——(a) 死格：临时构造一行 `requiredOn: [{ types: ["overall"] }]` 放进 `fix` row（其 `serves` 不含 `overall`）⇒ 构造抛错且报文点名该 token 与 `overall`；(b) 覆盖缺口：删掉 `review` 某行的 `requiredOn` ⇒ 构造抛错；(c) `ReviewItem` 注入：`requiredOn` 为空数组 ⇒ 构造抛错（空集合是无信息声明）；(d) 在册契约 ⇒ 构造不抛。— checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/render/__tests__/context-lines.test.ts` 四条全红（`ContextLine` 尚未存在，报错或类型缺失）。
- **Step 2**：在 `templates.ts` 定义 `RequiredArm` / `ContextLine`，给 `ModePromptRow` 加 `serves`，把四个 row 的每一行改写为 `{ line, path?, absent, requiredOn }`——取值逐行照 spec §1.4 的表：`INPUT_*` 路径行 `path: true`；`INPUT_RULINGS` `absent: "none"`，其余 `absent: "drop"`；`INPUT_WAVE_BRIEF` 加 `preview: "satisfied"`；`OUTPUT_*` / `WORKSPACE_*` / `ROLE` / `WAVE` / `TARGET_TYPE` / `BASE_BRANCH` 行 `requiredOn: [{ types: "always" }]` 或按表给 type 集；`## Round context` 标题行与空行 `requiredOn: []` 以外的一切照写。— checkable: `pnpm -C packages/cdd-engine exec tsc --noEmit -p packages/cdd-engine` 无错。
- **Step 3**：实现 `#assertDeclarations()`：三条判据——(a) 每行要么是纯文本（无 `{{TOKEN}}`）要么带非空 `requiredOn`；(b) 每条臂的 `types` 是 `"always"` 或 `serves` 的子集（死格判据）；(c) `TOKENS` 中 zone 为 `round-context` 的每个名字，至少被某个 row 的一行携带。— checkable: Step 1 的四条测试由红转绿。
- **Step 4**：让 `#contextLines` 按四态真值表渲染：值非空 ⇒ 渲染该值；空且 exigible ⇒ 由 T2 的门接手（渲染层不静默丢行，行照常渲染为空值以便诊断）；空且不 exigible 且 `absent: "drop"` ⇒ 整行消失；空且不 exigible 且 `absent: "none"` ⇒ 渲染裸词 `none`。— checkable: 新增两条测试（`INPUT_RULINGS` 空值渲出 `none`；`overall` 面无 `INPUT_SPEC` 整行）转绿。
- **Step 5**：跑周边测试确认没有别处依赖旧的 `string[]` 形状。— checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/render/` 全绿。
- **Step 6**：提交。— checkable: `git log --oneline -1` 显示本任务的提交，且 `git status --short` 为空。

#### Acceptance
- 死格、覆盖缺口、空 `requiredOn` 三种坏声明各自在构造期抛错，报文点名 token 与 offending type。
- 在册契约构造不抛；`templates.ts` 的四份 layout 逐行带声明，`INPUT_RULINGS` 是唯一的 `absent: "none"`，`INPUT_WAVE_BRIEF` 是唯一的 `preview: "satisfied"`。
- 四态真值表逐态可测：`none` 渲成裸词、`drop` 整行消失、非空渲染该值。
- `pnpm -C packages/cdd-engine exec vitest run src-next/render/` 绿。

#### DependsOn
none

### Task 2: `dispatch-input` 纯读门与门序

#### Objective
在 child 存在之前判「这一轮成立吗」：必填格为空、路径格不存在各自成一条拒绝，全部违规格一次报完；门是纯读，排在 artifact 门之前，被拒不占轮次、不留 in-flight 记录。

#### Files
- Modify: `packages/cdd-engine/src-next/face/lifecycle.ts`（`CliLifecycle` 的派发前判定面与 `#valuesOf` 的消费点）
- Modify: `packages/cdd-engine/src-next/face/words.ts`（`Words` 的 `dispatchInput` 报文器）
- Test: `packages/cdd-engine/src-next/face/__tests__/dispatch-input.test.ts`（新建）

#### Consumes
- Task 1 的 `ContextLine` / `RequiredArm` / `ModePromptRow.serves` 与 `TemplateAssembler`
- `TemplateValues`、`OpenFrame`、`ArtifactCell`（`face/lifecycle.ts` 既有）
- `DocFs`（`contract/invariants.ts`）——存在性读
- `DocEntry.program`（`infra/slug-index.ts`）——`when: "program"` 的唯一声明源

#### Produces
```ts
// CliLifecycle 的公开纯读面（与既有 artifactRefusal 并列）
inputRefusal(frame: OpenFrame): string | null;
// 私有判定：判定对象是即将渲染的那份 values
#inputRefusalOf(values: TemplateValues, frame: OpenFrame): string | null;
// Words 的新报文器
dispatchInput(facts: { segments: readonly DispatchInputSegment[] }): string;
```
- 报文形如 `CDD_BLOCKED: dispatch-input · <row> · <TOKEN> · <reason>; <row> · <TOKEN> · <reason>`
- `reason` 闭集：`empty-value` · `target-absent`

#### Steps
- **Step 1**：写失败测试 `dispatch-input.test.ts`——六条 `it`：(a) 每个 `requiredOn` 命中的格播空值 ⇒ `inputRefusal` 非空且报文含该 `row` 与该 `TOKEN`；(b) `path: true` 的非空值指向不存在的文件 ⇒ `target-absent`；(c) 同一帧两格违例 ⇒ 报文两段、以 `; ` 连接；(d) `when: "program"` 不命中（`program` 未声明）⇒ 该格不报；(e) `INPUT_RULINGS` 空值 ⇒ 不报（`absent: "none"`，由 T4 的渲染接手）；(f) 在册帧 ⇒ `null`；(g) branch 帧无 `base.json` ⇒ `BASE_BRANCH` `empty-value`（§2.3 清单的第四处反转）；(h) **数据驱动全覆盖**：遍历声明表，对每个 exigible 的格各播一个空值，断言报文点名该 `row` 与该 `TOKEN`（逐格成对，不靠人肉罗列）。— checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/face/__tests__/dispatch-input.test.ts` 六条全红。
- **Step 2**：在 `Words` 加 `dispatchInput`（`CAPSULE_WORDS` 同形条目 + 方法），报文由段数组拼装，段内 ` · `、段间 `; `。— checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/face/__tests__/words.test.ts` 绿。
- **Step 3**：实现 `#inputRefusalOf(values, frame)`：遍历当前 row 的 `ContextLine`；对每行算「本行在本 type 上是否 exigible」（任一臂的 `types` 命中当前 type 且 `when` 成立——`"program"` 读 `DocEntry.program`，`"identity"` 读同 slug 身份文档是否存在），exigible 且值为空 ⇒ `empty-value`；`path: true` 且值非空时用注入的 `DocFs#exists` 判存在，不存在 ⇒ `target-absent`；收集全部段后一次返回。— checkable: Step 1 的 (a)–(f) 转绿。
- **Step 4**：把门接进派发缝：在 `#artifactRefusalOf` 之前调用 `inputRefusal`，拒绝时走既有 `#blocked` 通道返回 `{ status: "BLOCKED" }`，**不追加 in-flight 记录、不递增轮次**。— checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/face/` 全绿，且新增一条 `it` 断言「被拒后 ledger 无本帧 in-flight 记录」。
- **Step 5**：提交。— checkable: `git log --oneline -1` 显示本任务提交，`git status --short` 为空。

#### Acceptance
- 八条判定行为各有测试，其中 (h) 遍历声明表逐格成对——新增一个必填格而不加测试会红。
- 一次拒绝报**全部**违规格（不 fail-fast）。
- 门序在 artifact 门之前：同一帧同时违 `input` 与 `rulings` 时，报文是 `dispatch-input` 的那条。
- 被拒不占轮次、不留 in-flight 记录。
- `reason` 闭集只有两条，源码里搜不到 `missing-line`。

#### DependsOn
1

### Task 3: `--dry-run` 同源与预览答案

#### Objective
让预览与真派发是**同一个返回值的两个消费者**：同一帧下两者的拒绝串逐字节相同；预览不能把引擎合成的那一格（wave brief）读成不存在。

#### Files
- Modify: `packages/cdd-engine/src-next/face/cli.ts`（`--dry-run` 的拒绝串读取点，与 `artifactRefusal` 并列）
- Test: `packages/cdd-engine/src-next/face/__tests__/cli.test.ts`（追加）

#### Consumes
- Task 2 的 `inputRefusal(frame)` / `dispatchInput` 报文器
- `RoundNaming#briefName`（`session/naming.ts` 或 `#naming` 暴露的命名行）——预览里 brief 格的合成来源

#### Produces
- `--dry-run` 在违例帧上打印与真派发完全相同的 `CDD_BLOCKED: dispatch-input …` 行，且不新增任何输出行
- 预览对 `preview: "satisfied"` 的格按「命名行点名即满足」处理，不做存在性读、不写盘

#### Steps
- **Step 1**：写失败测试——(a) 同一违例帧，预览字符串 === 真派发 `RoundViolation` 的 reason（逐字节 `toBe`）；(b) wave 帧在 brief 尚未落盘时预览 **不** 报 `target-absent`；(c) 预览的输出行集与改动前一致（无新增行）。— checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/face/__tests__/cli.test.ts -t "dispatch-input"` 三条红。
- **Step 2**：在 `cli.ts` 的预览路径上取 `harness.inputRefusal(frame)`（与既有 `artifactRefusal` 同一处、同一写法的相邻调用），把返回值原样渲染。— checkable: (a)(c) 转绿。
- **Step 3**：在预览的 values 合成路径上把 `preview: "satisfied"` 的格按命名行点名视为满足（brief 路径来自命名行，不写盘、不 extract）。— checkable: (b) 转绿。
- **Step 4**：提交。— checkable: `git log --oneline -1` 显示本任务提交，`git status --short` 为空。

#### Acceptance
- 字节等价 pin 存在且真能红：把 `inputRefusal` 的返回值篡改一个字节 ⇒ 该测试红。
- 预览零新增输出行、零写入（既有 `--dry-run` 零写入断言仍绿）。
- wave 帧在 brief 未落盘时预览不误报。

#### DependsOn
2

### Task 4: 四段 shell 文本与 `$version`

#### Objective
四个 shell 正文各带一句 `scratch/` 纪律；`fix` 与 `docs-fix` 的读入指令各带半句 `none`；`$version` 递增。字节 pin 断言这四句与两句的确切文本存在。

#### Files
- Modify: `packages/cdd-engine/src-next/render/templates.ts`（`IMPLEMENT_SHELL` · `REVIEW_ITEM` · `FIX_SHELL` · `DOCS_FIX_SHELL` · `$version`）
- Test: `packages/cdd-engine/src-next/render/__tests__/templates.test.ts`（追加）

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
- **Step 4**：写「结构而非白名单」的成对 pin：在临时工作区根播一个裸文件 ⇒ `board` 落一条 `orphan:`；把同一文件移入 `scratch/<round-id>/` ⇒ 该行消失、其余行不变。— checkable: 该测试红→绿（红在第二步之前，因为先写断言）。
- **Step 5**：提交。— checkable: `git log --oneline -1` 显示本任务提交，`git status --short` 为空。

#### Acceptance
- 四句 `scratch/` 与两句 `none` 各带字节 pin；`IMPLEMENT_SHELL` / `REVIEW_ITEM` 不含 `none` 半句。
- 孤儿成对 pin 成立：裸文件被报、移入 `scratch/<round-id>/` 后行消失，且其余 `orphan:` 行不变（证明是结构而非白名单）。
- `$version === 25` 有 pin。
- prompt 其余字节零变化（既有 pin 全部仍绿，除两句引入的差异）。

#### DependsOn
none

### Task 5: 章程 `v4.08` 回填

#### Objective
落地 spec §6 第 8 项那笔未应用字节：`requiredOn` 的臂形态域、`path: true` 位、反转计数 3 → 4 并点名 `BASE_BRANCH`；章程版本递增并追加 change-history 行。

#### Files
- Modify: `docs/kairos/overalls/2026-10-10-engine-doc-tooling-overall.md`（D94 行 · Phase inventory 的 P38 行详情格与 Scope ① 段的计数 · front-matter `version:` · change-history 行）

#### Consumes
- `docs/kairos/specs/2026-11-17-engine-doc-tooling-p38-design.md` §6 第 8 项（原文与改法逐字给定）

#### Produces
- 章程 `version: v4.08`，change-history 追加一行
- D94 行与 P38 详情格的 `requiredOn` 域写成臂形态；声明表条目带 `path: true`
- P38 Scope ① 段的计数由「三处反转」改为「四处反转」，第四个点名为「无 `base.json` 时的 `BASE_BRANCH` `empty-value`（恢复动作 `cdd base set`）」，并撤掉该处 `spec:` 那一半

#### Steps
- **Step 1**：按 spec §6 第 8 项逐条改字节（三处 + 版本 + change-history）。— checkable: `node packages/cdd-engine/src-next/bin.ts board --spec docs/kairos/specs/2026-11-17-engine-doc-tooling-p38-design.md` 报 `overall … v4.08` 且 `next:` 不变。
- **Step 2**：跑文档契约与 pin 门。— checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/contract/__tests__/pins.guard.test.ts src-next/contract/__tests__/census.guard.test.ts` 全绿（语料条数不变）。
- **Step 3**：提交。— checkable: `git log --oneline -1` 显示本任务提交，`git status --short` 为空。

#### Acceptance
- 章程 `v4.08`，三处字节逐字落地，change-history 有一行对应。
- 文档契约腿与 pin 门绿；`grep -c "三处反转"` 在章程里为 0。

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
| v0.1 | 2026-11-17 | 初稿：六个任务——声明形状（`ContextLine` + 三判据构造期断言）· 纯读门与门序（原因闭集两条、一次报全部）· `--dry-run` 字节等价与预览答案 · 四段 shell 与 `$version` · 章程 `v4.08` 回填 · changeset 与全量门禁。波次由 `DependsOn` 派生：W1 {1,4,5} → W2 {2} → W3 {3} → W4 {6} | Oscaner M. · Claude（kairos:cdd-plan · 2026-11-17） |
