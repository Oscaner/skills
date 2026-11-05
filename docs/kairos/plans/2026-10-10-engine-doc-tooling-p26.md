---
title: 引擎文档工具（Engine Doc-Tooling）— P26 计划：收口面残余三笔 + 文档形状归属判据
doc-type: plan
version: v0.1
date: 2026-11-05
slug: 2026-10-10-engine-doc-tooling-p26
base: develop
---

## Constraints

- **逐字取 spec**：本计划只实现 `docs/kairos/specs/2026-10-10-engine-doc-tooling-p26-design.md` **现行 `version`**（v0.1）所指的面；spec 版本一变，本约束的字面同笔改。
- **零新状态 / 零迁移**：不改 `progress.json` 行结构；旧 `doc_hash` 行只在下一轮 review/fix 写回时自然改写。
- **`brief-revision` 不动**：wave 线的 D30 投影零改。
- **正文投影定义点唯一**：哈希文档内容的站点只有 `ReviewRefs#docRevision`；投影类住 `contract/`，`session/` 不自行切片。
- **孪生门只读**：`docs/diagrams/*.html` 零写入；禁手改产物。
- **流水线序单源**：交棒目标只进 `PIPELINE_NEXT`；skills 侧不新增「我完了该谁上」节点。
- **`overall` 终点保留**：`PIPELINE_NEXT.overall` 仍是 `{ kind: "done" }`。
- **零模块级裸函数**：投影与守卫读面写成类；静态面带 biome-ignore 与一行理由。
- **changeset**：`@oscaner-skills/cdd-engine` **minor**（消费面 `next:` 字节可见变化按 D74；方法论契约未变）+ `@oscaner-skills/kairos` **minor**（`cdd-design` / `cdd-close` 的节点文本与判定面改变）。
- **波宽**：本计划 `DependsOn` 分层为 {1,2,3} → {4} → {5}，任一不超过 3；不得把 4 / 5 挪进第一层。

## Review Focus

- **无 front-matter / 无 Change history 的文档**：投影不得变成空串——退化成几乎整篇（只剥存在的那一侧）。
- **`## Change history` 出现在代码围栏里**：投影只剥 rank-2 真标题节，不剥围栏样本（用 `MarkdownTree.sections()`，不靠裸正则扫全文）。
- **旧整篇 hash 行**：下一轮写回前仍可能判 drift——接受，不主动回填；测试不得假装已迁移。
- **带 plan 的 single-spec**：frontier 仍可因 open plan 面给出 `task-open`（`run.test.ts:1950` 一带）——与 `PIPELINE_NEXT["single-spec"]` 正交，本相位不得改坏。
- **`verdict: "terminal"` 的通用 pin**：`next.test.ts:464-470` / `:512-521` 钉的是 `terminal` 分支本身，不是 single-spec——断言不动，只改引用 single-spec 的散文。

### Task 1: 正文投影 + `ReviewRefs#docRevision` 只算正文（#417）

#### Objective

让所有 `doc-revision`（plan / spec / branch 三腿）只哈希正文：剥 YAML front-matter 与 `## Change history` 整节。记账性写入不再互踢；正文修订仍 drift。

#### Files

- Create: `packages/cdd-engine/src-next/contract/doc-body.ts`（`DocBodyProjection`）
- Create: `packages/cdd-engine/src-next/contract/__tests__/doc-body.test.ts`
- Modify: `packages/cdd-engine/src-next/session/ledger.ts`（`ReviewRefs#docRevision` · `:477`）
- Modify: `packages/cdd-engine/src-next/face/gate.ts`（`:109` JSDoc · `:119` `#docLineBlock` 模板串）
- Modify: `packages/cdd-engine/src-next/face/__tests__/cli.test.ts`（`:3333` 引用旧文案的注释，若仍在）
- Test: `packages/cdd-engine/src-next/session/__tests__/doc-revision-body.test.ts`（plan/spec 各一对 same/drift；branch 行互踢复现；单一定义结构门）

#### Consumes

- `MarkdownTree`（`contract/markdown-tree.ts`）· `ReviewRefs` / `Ledger#docLineVerdict` / `Ledger#recordReviewedRevision`（既有）

#### Produces

- `class DocBodyProjection` · `project(content: string): string`——剥开头 YAML 块（首行 `---` 起至下一行 `---` 止，含两道栅栏；无则原样）与 `## Change history` 整节（`MarkdownTree.sections()` 中标题归一后等于 `Change history` 的那一节整段，含标题行；无则原样）；两侧都无时返回原文（末尾换行策略与输入一致到可哈希）。
- `ReviewRefs#docRevision` 对投影结果求 sha1，不再对整篇。

#### Steps

- [ ] **Step 1: 写投影单测（先红）** — checkable: `doc-body.test.ts` 五格 FAIL——① 仅改 `version:` + 追加 Change history 行 ⇒ `project` 字节相同；② 改某 `### Task` 正文一句 ⇒ 不同；③ 无 front-matter 的文档仍剥 Change history；④ 无 Change history 的文档仍剥 front-matter；⑤ 正文里代码围栏含 `## Change history` 字样 ⇒ 该围栏保留在投影里
- [ ] **Step 2: 实现 `DocBodyProjection`** — checkable: Step 1 五格全绿；类上零裸函数；YAML 块只认文件开头连续栅栏（正文中间的 `---` 不动）
- [ ] **Step 3: `ReviewRefs#docRevision` 改吃投影** — checkable: `docRevision` 内对 `string | Buffer` 先转 utf8，再 `new DocBodyProjection().project(…)`，再 `#hash`；`briefRevision` 零改
- [ ] **Step 4: 漂移行为单测** — checkable: `doc-revision-body.test.ts`——plan 与 phase-spec 样本各一对「只记账 ⇒ `doc_hash` 相同 / 改正文 ⇒ 不同」；branch 行：先 `recordReviewedRevision("branch", refs.docRevision(plan, body1), "branch")`，再只改 front-matter+Change history ⇒ `docLineVerdict("branch", plan2, "branch") === "same"`，再改 Task 正文 ⇒ `"drift"`；plan 行同形各一
- [ ] **Step 5: 单一定义结构门** — checkable: 同文件断言 `session/ledger.ts` 源码里 `createHash("sha1")`（或 `#hash(` 的私有定义）只服务 `ReviewRefs`；`docRevision` 方法体含 `DocBodyProjection`；`session/` 下除 `ledger.ts` 外无第二处对文档全文直接 `#hash`/`docRevision` 外包一层切片
- [ ] **Step 6: 拒审文案** — checkable: `gate.ts:119` 模板为 `amend body to open a new review`；`:109` JSDoc 同字；`cli.test.ts:3333` 若仍引旧句则改；`cli.test.ts:3059` 的 `target revision unchanged` 断言不动仍绿
- [ ] **Step 7: 提交** — checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/contract/__tests__/doc-body.test.ts src-next/session/__tests__/doc-revision-body.test.ts` 绿；`pnpm run precommit` 绿；conventional commit `fix(cdd-engine): doc-revision hashes body only`

#### Acceptance

- Acceptance 1–4（spec）全绿：记账同 hash、正文异 hash、branch/plan 互踢复现形态、单一定义门、拒审文案与 JSDoc 一致。
- `briefRevision` 相关既有用例零改仍绿。

#### DependsOn
none

### Task 2: 六份图源孪生门 + `journey` 语义 pin（#418）

#### Objective

六份图源同权：源 ⇄ HTML 引用证据与文案孪生；`journey` 从零 pin 补到与运行时常量对齐的一腿。

#### Files

- Create: `packages/cdd-engine/src-next/face/__tests__/diagram-twin.guard.test.ts`
- Create: `scripts/__tests__/journey-twin.test.ts`

#### Consumes

- `docs/diagrams/src/{architecture,journey,next-loop}.{en,zh-CN}.json` 与对应 HTML
- `MAX_TASKS_PER_WAVE`（`contract/wave-width.ts:16`）· `TargetType`（`session/faces.ts:26`）· `CliLifecycle.LOGS_DIR`（`face/lifecycle.ts:130`）· `ENGINE_RUNTIME.handoffNamespace.workspaceRoot`（`infra/runtime.ts:127`）
- 先例：`diagrams.guard.test.ts` · `scripts/__tests__/next-loop-twin.test.ts` 的 `DiagramSource` 类

#### Produces

- 孪生门对六份源全覆盖；`journey-twin` 三条语义 pin 可反向红。

#### Steps

- [ ] **Step 1: 孪生门骨架（先对现网绿）** — checkable: `diagram-twin.guard.test.ts` 枚举六份源；每份读 `meta.output` 指向的 HTML；解析 `script#archify-source-evidence-data`；断言 `repository.revision` 等于源 `meta.repository.revision`；`meta.output` 路径与被检 HTML 一致
- [ ] **Step 2: 引用证据归一化** — checkable: 源侧按 `diagram_type` 取根——`architecture` → `components` · `lifecycle`（next-loop）→ `states` · `workflow`（journey）→ `nodes`——收集每节点 `sources[]` 的 `(path, line, end_line)`；HTML 侧遍历 `nodes` 映射下数组的 `(path, line, endLine)`；两侧都投影成 `(path, line, end)` 多重集后深等；`referenceCount` 等于条数；三种 `diagram_type` 在六份里都有覆盖（不得写死只走 `components`）
- [ ] **Step 3: 文案孪生** — checkable: 源中每条 `label` / `sublabel` / `tag` / 卡片 `items[]` 条目，经 HTML 转义后出现在 HTML 文本中（空串跳过）
- [ ] **Step 4: 反向注入各一** — checkable: 临时改 HTML 引用块一行（测后还原）⇒ 引用腿红；临时改源一句 label（测后还原）⇒ 文案腿红——用临时目录拷贝或对解析结果直接断言归一化函数，避免污染工作树；选定方案在测试文件头注写明
- [ ] **Step 5: `journey-twin.test.ts`** — checkable: 复用 `DiagramSource` 类形态（可从 next-loop-twin 抽共享，或文件内自备同类）；两份 journey 源均携带：(1) 波宽陈述，解析出的数字 `=== MAX_TASKS_PER_WAVE`（en「at most three」/ zh「至多三个」）；(2) `--type` 词表含 `phase-spec · overall · plan · single-spec · wave · branch` 且含「retired」/「退役」句，**不含**作为独立 `--type` 值的裸 `spec`（与 `TargetType` 联合一致——读 `faces.ts` 源码断言联合成员）；(3) 日志路径陈述同时含 `ENGINE_RUNTIME.handoffNamespace.workspaceRoot`（`.kairos/cdd`）与 `CliLifecycle.LOGS_DIR`（`logs`）
- [ ] **Step 6: 三条反向红** — checkable: 各有一条「把匹配句改成错值则期望失败」的用例（对拷贝字符串断言，不改仓库源）
- [ ] **Step 7: 提交** — checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/face/__tests__/diagram-twin.guard.test.ts` 绿；`pnpm exec vitest run scripts/__tests__/journey-twin.test.ts` 绿；`diagrams.guard.test.ts` 与 `next-loop-twin.test.ts` 仍绿；commit `test(cdd-engine): pin six diagram twins and journey semantics`

#### Acceptance

- Acceptance 5–6（spec）全绿；既有 `diagrams.guard` / `next-loop-twin` 零改语义仍绿。

#### DependsOn
none

### Task 3: 闭合的 `single-spec` 交棒 `cdd-plan`

#### Objective

撤回 D73 把 `single-spec` 并成程序终点的四处声明；`overall` 保持终点；闭合单规约 spec 的 `next:` 交棒 `cdd-plan`，`reason:` 为 `closed-line`。

#### Files

- Modify: `packages/cdd-engine/src-next/session/next.ts`（`:90` `PipelineKey` · `:111` `PIPELINE_NEXT["single-spec"]` · `:119` `PhaseFaceKey`）
- Modify: `packages/cdd-engine/src-next/face/board-view.ts`（`:190` `docClassOf`）
- Modify: `packages/cdd-engine/src-next/session/run.ts`（`:409-410` `#docClassByType`）
- Modify: `packages/cdd-engine/src-next/session/__tests__/next.test.ts`（`:605-608` · `:612-614`）
- Modify: `packages/cdd-engine/src-next/face/__tests__/capsule.test.ts`（`:435-441`）
- Modify: `packages/cdd-engine/src-next/session/__tests__/run.test.ts`（`:1983-1984`）
- Modify: `packages/cdd-engine/src-next/face/__tests__/board-view.test.ts`（`:990`）
- Create: `.changeset/closeout-debts.md`（若本波未由前两任务创建）

#### Consumes

- `PIPELINE_NEXT` · `DocClassVerdict` · host `REFS["kairos:cdd-plan"]`（`face/host.ts`）· `Words` 的 handoff 渲染

#### Produces

- `PipelineKey` 含 `single-spec`；`PhaseFaceKey` / `PIPELINE_FACES` 仍四面且不含它；`PIPELINE_NEXT["single-spec"] = { kind: "ref", ref: "kairos:cdd-plan" }`。

#### Steps

- [ ] **Step 1: 改四处声明** — checkable: `PIPELINE_NEXT["single-spec"]` 与 `phase-spec` 同值；`PipelineKey` 不再排除 `single-spec`；`PhaseFaceKey` 从 `PipelineKey` 去掉 `overall` 与 `single-spec`；`docClassOf` / `#docClassByType` 对 `single-spec` 返回 `"single-spec"` 而非 `"terminal"`；`overall` 行仍 `done`
- [ ] **Step 2: 翻 `next.test.ts` 终端 pin** — checkable: `:605-608` 标题与断言改为「`overall` 是终端 · `single-spec` 与 `phase-spec` 同交棒 `kairos:cdd-plan`」；`:612-614` 改为断言 `PipelineKey` **包含** `single-spec` 的源码字面（或导出类型的运行时可观察后果），且 `PIPELINE_FACES.not.toContain("single-spec")`、长度仍 4
- [ ] **Step 3: 翻裸 single-spec 三处 pin** — checkable: `capsule.test.ts:435-441`——`to` 为 `PIPELINE_NEXT["single-spec"]`，`reason` 为 `closed-line`，`nextOf` 为 `next: route to /kairos:cdd-plan skill`（测试宿主词表若固定 claude 拼写则钉该串；另补或参数化 pi 的 `/skill:cdd-plan`）；`run.test.ts:1983-1984` 同形；`board-view.test.ts:990` 的 `nextOf` 从 `done` 改为交棒指向（与 capsule 同值）
- [ ] **Step 4: 红 pin——折回 terminal 即红** — checkable: 既有或新增断言：`BoardView.docClassOf` 在声明为 `single-spec` 时返回 `"single-spec"`；源码门断言 `board-view.ts` 与 `run.ts` 不再含把 `single-spec` 折成 `terminal` 的三元式
- [ ] **Step 5: 回归正交面** — checkable: `next.test.ts` 里 `verdict: "terminal"` 通用用例仍绿；`run.test.ts` 带 plan 的 single-spec `task-open` 用例仍绿；plan / wave / branch 的 `next:` 字节用例全绿
- [ ] **Step 6: changeset + 提交** — checkable: `.changeset/closeout-debts.md` 声明 `cdd-engine` minor（正文点名：body-only doc-revision · 六图孪生门 · single-spec→cdd-plan）；`pnpm -C packages/cdd-engine exec vitest run src-next/session/__tests__/next.test.ts src-next/session/__tests__/run.test.ts src-next/face/__tests__/capsule.test.ts src-next/face/__tests__/board-view.test.ts` 绿；`pnpm run validate` 绿；commit `fix(cdd-engine): hand a closed single-spec to cdd-plan`

#### Acceptance

- Acceptance 7–10（spec）全绿：`next:` 交棒、`reason: closed-line`、terminal 只留无 target / 章程、`PhaseFaceKey` 四面、validate + minor changeset。

#### DependsOn
none

### Task 4: 归属判据落两 skill 文本（`cdd-design` · `cdd-close`）

#### Objective

让「先判归属、再定形状」成为技能侧可执行的判定与失败面，而不是只在 spec 里的一段话。

#### Files

- Modify: `packages/kairos/skills/cdd-design/SKILL.md`（`mode?` 节点 → 归属判定 · `size?` 收窄 · Failure Modes 增行）
- Modify: `packages/kairos/skills/cdd-close/SKILL.md`（`closeout-backfill` 两分支 · I4 措辞）
- Test: `packages/kairos/tests/`（既有 anatomy / presentation-surface / grep-sweep 面；仅在旧句被 pin 时同笔改）

#### Consumes

- `docs/kairos/specs/2026-10-10-engine-doc-tooling-p26-design.md` §4.1 判定表 · §4.2 · §4.3

#### Produces

- `cdd-design`：`mode?` 节点的判据改为**归属判定**（读父 overall 的在册程序与 charter scope，判定本需求落点程序可能为 none）；`size?` 只剩 charter 与否；Failure Modes 增一行「`phase-within-program` 路径产出 `single-spec` ⇒ BLOCKED（形状与归属不符）」。
- `cdd-close`：`closeout-backfill` 显式两分支（有相位行 → Done + 交付证据；游离 single-spec → 只收口 spec 自身版本行 + change history + 关 issue）；I4 措辞同步。

#### Steps

- [ ] **Step 1: 改 `mode?` 判据** — checkable: 节点 Do/Read/Exit 三栏都写归属（Read 明写「父 overall 的 Phase inventory + charter scope」），Exit 两分支穷举（属于 ⇒ `phase-within-program`；不属于 ⇒ `new-program`）；digraph 节点 id 与边同步（保留 `mode?` 这个 id 以免正文与图不一致，改写其语义并在 Do 首句点明判据已从「有没有父 overall」改为「归不归属某在册程序」）
- [ ] **Step 2: 收窄 `size?`** — checkable: `phase-within-program` 路径上不再出现 `single-spec`（只留 `fit` → phase-spec / `oversized` → charter）；`new-program` 路径保留 `single-spec`（游离小程序）与 charter 两出口；节点文本明写「尺寸不再是 single-spec ⇄ phase-spec 的判据」
- [ ] **Step 3: 失败面** — checkable: Failure Modes 表新增一行，reason 为「形状与归属不符」，行为 BLOCKED，与 spec §4.2 同字
- [ ] **Step 4: `cdd-close` 两分支** — checkable: `closeout-backfill` 的 Do 显式两分支；I4 措辞覆盖两分支（有相位行 / 无相位行）；关闭 issue 的读面同时覆盖两分支（游离 single-spec 的 issue 来源 = spec 的 `issues:`）
- [ ] **Step 5: 跑技能面门** — checkable: `pnpm -C packages/kairos exec vitest run` 全绿（anatomy / presentation-surface / grep-sweep 全绿）；若某条文本 pin 引用改掉的旧句，同笔改 pin 而不放宽断言
- [ ] **Step 6: 提交** — checkable: `pnpm run precommit` 绿；commit `docs(kairos): judge belonging before spec shape`

#### Acceptance

- 两份 skill 的 digraph 与节点文本自洽（`skill-anatomy` 门全绿，无新节标题、无 registry 外标题）。
- `grep -n "single-spec" packages/kairos/skills/cdd-design/SKILL.md` 的每一处都落在「游离 ⇒ single-spec」语境（不存在把程序内工作判成 single-spec 的句子）。
- `cdd-close` 的两分支与 I4 在册且互不矛盾；`close-issues` 的读面覆盖游离 single-spec。

#### DependsOn
3

### Task 5: 新 doc-contract 门——Phase inventory 的 Design spec 必须 `phase-spec`

#### Objective

把「归属决定形状」落成可执行判据：父 overall 的相位行若把 Design spec 指向一份 `doc-type: single-spec` 文档，门即红并点名该行。

#### Files

- Modify: `packages/cdd-engine/src-next/contract/invariants.ts`（新增 invariant 类）
- Modify: `packages/cdd-engine/src-next/contract/` 的规则登记面（若规则清单由登记表派生，则同笔登记；否则只加 import + 清单项）
- Test: `packages/cdd-engine/src-next/contract/__tests__/judge.test.ts`（红/绿/跳过三条）

#### Consumes

- `FileExistenceInvariant.targetPath` 的链接解析（同一套读法，不新写路径解析）· `JudgeContext.fs` 的读面 · 目标文档 front-matter 的 `doc-type` 读

#### Produces

- 规则名 `phase-design-spec-is-phase-spec`（或同义名），`docKeys: ["overall"]`，`scope: doc`，finding 的 fix 文案指明两条修法。

#### Steps

- [ ] **Step 1: 写红用例** — checkable: `judge.test.ts` 造一份 overall，Phase inventory 的某行 Design spec 单元指向 `doc-type: single-spec` 文档 ⇒ 期望一条 finding；今日无该规则 ⇒ 用例 FAIL
- [ ] **Step 2: 实现规则** — checkable: 逐行读 Phase inventory 的 Design spec 单元 → 取链接目标（`targetPath` 解析）→ 读目标文档 front-matter 的 `doc-type`；`doc-type` 不是 `phase-spec` ⇒ finding（点名行号/相位 id 与两条修法）；目标不可读或单元是 `[Pending]` / `Done` 之类非链接值 ⇒ **不判**（present facts only，且 file-existence 已管缺失）
- [ ] **Step 3: 绿用例** — checkable: 同形 overall 但单元指向 `phase-spec` ⇒ 零 finding；单元为 `[Pending]` ⇒ 零 finding（未注册的设计尚未存在）
- [ ] **Step 4: 登记与清单** — checkable: 规则出现在 `cdd review --type overall` 的 `checked:` 清单里（登记表派生则自动；硬编码则同笔加）
- [ ] **Step 5: 跑引擎套件** — checkable: `pnpm exec tsc --noEmit -p packages/cdd-engine` 绿；`pnpm -C packages/cdd-engine exec vitest run src-next/contract` 绿；`mkdir` 的临时语料用完清理
- [ ] **Step 6: 提交** — checkable: commit `feat(cdd-engine): a phase row must point its design spec at a phase-spec`

#### Acceptance

- 红/绿/跳过三条用例在册；把任一相位行的 Design spec 指向 single-spec ⇒ 门红且 finding 点名该行；指向 phase-spec 或 `[Pending]` ⇒ 绿。
- 规则出现在 overall 评审的 `checked:` 清单；`validate` 绿。
- 不新写第二套路径解析（复用 `targetPath`）；不判 Implementation plan 单元。

#### DependsOn
4

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-11-05 | 初版（slug 随 spec 迁入 P26）：五任务三层——T1 正文 doc-revision · T2 六图孪生+journey pin · T3 single-spec 交棒 cdd-plan（同层无边）· T4 归属判据落两 skill 文本 · T5 新 doc-contract 门 | Claude（本会话 cdd-plan） |
