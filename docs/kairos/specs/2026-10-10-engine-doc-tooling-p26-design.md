---
title: 引擎文档工具（Engine Doc-Tooling）— P26 设计：收口面残余三笔 + 文档形状归属判据
doc-type: phase-spec
version: v0.2
date: 2026-11-05
slug: 2026-10-10-engine-doc-tooling-p26
program: 2026-10-10-engine-doc-tooling
parent-version: v3.25
author: '[human] 裁定 · Claude（本会话 · 2026-11-05）'
---

## Design

本相位收四笔互不重叠的残余，共同点是**没有任何自动门会因它变红**：一笔靠多跑评审轮次偿付，一笔靠人工比对发现，一笔让流水线交棒丢了一步，一笔让「文档形状」这件事没有判据也没有门。①②③ 记在 P24/P25 的收尾里（github #417 · #418 · 本会话实证）；④ 是本会话讨论后新增的判据面——它同时解释了本相位为什么从一份游离 single-spec 迁成 phase-spec（§4.5）。

### 1. 正文 doc-revision（#417）

#### 1.1 病根：整篇 hash 把收口登记混进被审面

`plan` 行与 `branch` 行绑的是**同一份 plan 的整篇内容 hash**：

| 行 | 写回点 | 绑定的输入 |
| --- | --- | --- |
| plan 行 | `session/run.ts:746` `#recordReviewedDocRevision`（方法体在 `:766`）→ `#recordDocRevisionOf` | plan 的 `doc-revision` |
| branch 行 | `session/run.ts:784` `#recordReviewedBranchRevision` → 同一 `#recordDocRevisionOf` | **同一份 plan** 的 `doc-revision` |

而 `doc-revision` 今天是**整篇文件**的 sha1（`session/ledger.ts:477` `ReviewRefs#docRevision` 直接吃 `content`）。每一轮 review / fix 收工都会往 plan 写一笔（change-history 行、front-matter `version:` 递增），于是**任一行的 fix 只要动了 plan，另一行立刻判 drift**，互踢直到某一次 fix 恰好不碰 plan 才停。

P24 的实证（同一分支）：`41bf1406`（branch fix 1）⇒ plan 行 drift ⇒ 多跑 `plan review 8`；`b19a312d`（plan fix 8）⇒ branch 行 drift ⇒ 多跑 `branch review 2`；`c5549047`（branch fix 2，只动 `face/board-view.ts`）才收敛。互踢**没有终止保证**——软上限只管同一条线的连续 blocker 轮，不跨线。

**病根不是身份判定本身，而是身份的粒度**：整篇 hash 把「收口登记」（front-matter `version:` / `date:`、`## Change history` 行）与「被审的正文」混成一个值，于是记账性写入与实质修订在门眼里等价。

#### 1.2 裁定与投影规则

**裁定（作者，2026-11-05，issue #417 comment）**：所有 `doc-revision` 只计算**正文**，即排除 front-matter 与 `## Change history`——这两部分常常只是收口登记，因它们触发的重审没有意义。

- **正文投影**：原文去掉「开头 YAML front-matter 块」（连续的 `---` … `---`；无 front-matter 的文档从首行起算）与「`## Change history` 整节」（该 rank-2 标题行至下一个 rank-2 标题或文末）后的剩余行。其余一律计入：`## Constraints`、`## Review Focus`、`### Task N:` 的任务正文都在内。两侧都不存在时投影等于原文（不得退化成空串）。
- **只剥真标题节**：`## Change history` 的定位走 `MarkdownTree.sections()` 的 rank-2 节点，不靠裸正则扫全文——代码围栏里的同名样本不算节。

#### 1.3 落点与继承

- **定义点唯一**：投影在 `ReviewRefs#docRevision`（`session/ledger.ts:477`）内部完成，`doc_hash` 改由「正文投影」的 sha1 得出。ref 的 kind、两层结构（`doc` 路径层 + `doc_hash` 层）、ledger 行结构三者**一律不动**——无新字段、无迁移。
- **一处定义、三腿继承**：doc 腿（plan / spec 行）、branch 腿、以及所有漂移判定（`session/ledger.ts:906` `docLineVerdict`、`:1303` `docReopens`、`session/pipeline.ts:156` `branchLineOpen`、`session/run.ts:583`/`:592`、`face/gate.ts:71` `lineGate`）全走同一个 `docRevision`，不新增第二套比较。
- **投影类住 `contract/`**：段落/节区间的读面在契约面（`MarkdownTree` 的既有先例），`session/` 不自行切片。

#### 1.4 行为后果与随动字节

- **明确接受**：只改 front-matter 或只追加 change-history 行的 fix 之后，该行判 `same`——`cdd review` 会以「already reviewed … target revision unchanged」拒绝重审（anti-spin 的正例），branch 行也不再被对向 fix 踢开。**实质正文修订仍然 drift**，这是要保留的语义。
- **随动的字节（唯一一处）**：`face/gate.ts:119` 的 BLOCK 文案「amend body/version to open a new review」在新规则下不再成立，改为「amend body to open a new review」；`:109` 引用旧文案的 JSDoc 同笔改。既有用例不字面 pin 该子句（`cli.test.ts:3059` 只断言 `target revision unchanged`），故断言本身不动。

#### 1.5 不采纳的两条路

- **分支行身份收窄为「任务集」**：会丢掉「plan 正文动了分支该重开」这条 P21 §4.1 语义，且仍留下反方向的踢。
- **封顶重开次数**：只限制不除根，还要新状态字段。正文投影同时解决两个方向且零新状态。

### 2. 六份图源常驻孪生门（#418）

#### 2.1 现状：一半没腿，一对零 pin

`docs/diagrams/src/` 下六份图源（`architecture` · `journey` · `next-loop`，各 en / zh-CN），每份都有一份被 git 跟踪的生成 HTML，承载的是引擎语义的散文断言（「八条命令」「`next:` 是运行最后一行」这类会被相位推进推翻的句子）。

| 源 | 语义 pin（源级） | 源 ⇄ HTML 孪生 | 结论 |
| --- | --- | --- | --- |
| `architecture.{en,zh-CN}` | `face/__tests__/diagrams.guard.test.ts`（八条命令面 + 引用跨度 + revision pin） | 同一条守卫的 HTML 腿（残留检查） | 两腿 |
| `next-loop.{en,zh-CN}` | `scripts/__tests__/next-loop-twin.test.ts`（三条判收敛断言 + 周期数与运行时常量对齐） | 无 | 只有源腿 |
| `journey.{en,zh-CN}` | 无 | 无 | **零 pin** |

`docs/diagrams/README.md` 要求「改源必须用 Archify finalize 重生成 HTML，禁手改」——**这条纪律没有任何自动检查**。P24 踩过一次：`next-loop.zh-CN.html` 曾读作「最后一一行」而源写「最后一行」，所有门全绿，人工比对才发现；`journey` 两份连这种偶然发现的机会都没有。

#### 2.2 引用证据孪生（形状与归一化）

新增 `face/__tests__/diagram-twin.guard.test.ts`，六份同权。引用腿的载荷形状必须先说清，否则会只覆盖一种图：

- **HTML 侧**：`script#archify-source-evidence-data` 的载荷是 `{ repository, referenceCount, nodes }`——引用不在顶层 `sources` 里，而在 `nodes` **映射**下的逐节点数组中，元素形如 `{ path, line, endLine }`。
- **源侧**：引用集合挂在**按 `diagram_type` 而定的根**上——`components`（`architecture`）、`states`（`lifecycle`，即 `next-loop`）、`nodes`（`workflow`，即 `journey`），跨度结束字段拼作 `end_line`。
- **一次归一化**：两条腿都投影成 `(path, line, end)` 三元组的多重集（`end_line` ↔ `endLine` 在此映射），再判等。判据三条：`repository.revision` 等于源 `meta.repository.revision`；归一化后的引用多重集与源侧相等；`referenceCount` 等于引用条数。
- **配对**：源 `meta.output` 必须指向被检查的那份 HTML，源与产物不许错位。

#### 2.3 文案孪生

源里每条 `label` / `sublabel` / `tag` / 卡片 `title` 与卡片条目（`items[]` 各条 `<li>` 文本），必须在该 HTML 中逐字出现（HTML 转义后比较）。卡片 `title` 属于同一面：只改一条 `title` 而不重生成，同样必须红。⇒「源文案改了没重生成」红。

#### 2.4 journey 从零 pin 到一腿

新增 `scripts/__tests__/journey-twin.test.ts`（与 `next-loop-twin` 同为仓库级 pin），把 `journey` 两份的散文断言钉到运行时常量上：

1. 波宽「至多三个任务」 ⇄ `contract/wave-width.ts:16` 的 `MAX_TASKS_PER_WAVE`（由源文本解析出数字再与常量比较，与 `next-loop-twin` 的周期数同一手法）；
2. `--type` 词表 ⇄ `session/faces.ts:26` 的 `TargetType` 联合（含已退役的 `spec` 不在其中）；
3. 每轮派发的日志落在 `.kairos/cdd/…/logs/` ⇄ 两个具名符号：`face/lifecycle.ts:130` 的 `CliLifecycle.LOGS_DIR`（`"logs"`）与 `infra/runtime.ts:127` 的 `ENGINE_RUNTIME.handoffNamespace.workspaceRoot`（`.kairos/cdd`）。

任一侧改动即红；三条各配一条反向红用例。

#### 2.5 不引入 Archify

既有的语义守卫不动（语义 pin 与孪生门是两种判据，混在一起会让失败原因不可分）。**不采纳**：把重生成塞进 `emit`——CI 要引 Archify 的 finalize 链路，稳定性与耗时全得重裁，留作后续独立议题。

### 3. spec 面闭合交棒 cdd-plan

#### 3.1 四处声明把 single-spec 定成程序终点

本相位的评审收口（`cdd review --type single-spec`）打印了 `next: done` · `reason: face-closed`，而流水线的下一站本该是 `cdd-plan`。根因不是流水线走丢，是**四处声明把 `single-spec` 定成「程序级终点」**：

| 位置 | 内容 |
| --- | --- |
| `session/next.ts:111` | `"single-spec": { kind: "done" }` |
| `session/next.ts:90` | `PipelineKey` 由 `TargetType` 派生并排除 `single-spec`——它连「可交接的站」都不是 |
| `face/board-view.ts:190` | `docClassOf`：`declared === "single-spec" ? "terminal" : declared` |
| `session/run.ts:409-410` | `#docClassByType`：`target.type === "single-spec" ? "terminal" : target.type` |

walk 于是这样落地：`pipeline.ts` 全闭合 → `#terminal` → 最后进入的面其 target 是 `single-spec` → `#exitRoute` 查 `PIPELINE_NEXT[target.type]` → `done`。

**四处的源头是 D73（2026-11-03 裁定）**：「`PipelineKey` 由 `TargetType` 派生，**`overall` / `single-spec` 为程序级终点**（`PIPELINE_NEXT` 两行 `{kind:"done"}`）」。而 D33（P8）的原话没有这个例外：「**spec 线全闭合 → `/kairos:cdd-plan`（skill ref）**」——`single-spec` 是在词表统一时与 `overall` 并成一类才被带走的。

#### 3.2 落点

`overall` 是程序章程，闭合即程序终点；`single-spec` 是「没有父程序的 spec」，是 spec 线的一种载体，不是章程。

- `session/next.ts:111`：`single-spec` 行改 `{ kind: "ref", ref: "kairos:cdd-plan" }`，与 `phase-spec` 行同值。
- `session/next.ts:90`：`PipelineKey` 收进 `single-spec`（它成了可交接的站）。
- `session/next.ts:119`：`PhaseFaceKey` 相应改为「`PipelineKey` 去掉 `overall` 与 `single-spec`」——`PhaseFaceKey` / `PIPELINE_FACES` 仍是四面 `phase-spec · plan · wave · branch`，`single-spec` **永不进面序**；但它仍是自成一体的 `TargetType` 与 ledger 行键，**不是** `phase-spec` 的别名——两者只共享 `PIPELINE_NEXT` 的交棒目标。
- `face/board-view.ts:190` 与 `session/run.ts:409-410`：`docClassOf` / `#docClassByType` 不再把 `single-spec` 折成 `terminal`，改回传声明值本身。

**不动的三处**：`overall` 行仍是 `{ kind: "done" }` · `DocClassVerdict` 的 `terminal` 值保留（无 target 的裸终点仍靠它）· D33 ③「引擎 next 止于 `cdd-close`、不跨 phase」原样不动。

#### 3.3 reason 必然跟变（机制，不是选择）

`NextStepRouter.#reasonOf`（`session/next.ts:403`）只在 `route === null || verdict === "terminal"` 时返回 `face-closed`；`#entryOf`（`session/next.ts:386`）也以 `verdict === "blocked" || verdict === "terminal"` 为前提之一返回空站点。`single-spec` 一旦不再折成 `terminal`，闭合后就走与 `phase-spec` 同一条路：`to` 是 `PIPELINE_NEXT["single-spec"]`（非空），`reason` 落 **`closed-line`**。所以这两处**零源码改动**——行为由上述四处声明自动跟随。

闭合的 single-spec 评审的 `next:` 由 `done` 变为 host 渲染的 cdd-plan 指令串（claude `route to /kairos:cdd-plan skill` · pi `route to /skill:cdd-plan skill`）。这是本相位允许的第二处字节变化。

#### 3.4 链成立的前提（已核对）

plan 的 front-matter 没有 `spec:` 键，plan 与它的 spec 靠**同 slug** 相连，所以 single-spec 交棒后的 plan 走 `docs/kairos/plans/` 下同 slug 的那一份，不需要新链键。

同一个 slug 也让交棒后的 plan / branch 评审照旧拿得到 spec 锚点：这两行的 `INPUT_SPEC` 取 `SlugIndex#identityDoc(slug)` 解析出的**路径**（`face/cli.ts:1073-1074` 产出 `specLink`，`face/lifecycle.ts:760-762` 读它），与 `spec:` 标量无关、与 `program:` 无关——single-spec 交棒后该槽仍然非空。被空槽丢弃的是 `INPUT_OVERALL`（父章程）：它读**同一份身份文档的 `program:`**（`face/cli.ts:1077-1078` 产出 `overallLink`，`face/lifecycle.ts:773-777` 读它），single-spec 无 `program:` ⇒ 空槽丢弃（既有行为，非新增例外）。故「不新增链键」的结论不变。

### 4. single-spec ⇄ phase-spec 归属判据

#### 4.1 两问判定表（先归属，后形状）

| 先判归属：这需求落在某个在册程序的 charter scope 内吗？ | 再定形状 |
| --- | --- |
| **属于** | **`phase-spec`**——`program:` 必需，且必须在父 overall 的 Phase inventory 占一行 |
| **不属于**（或只借用同一个仓库，与该程序 scope 不相干） | **`single-spec`**——游离：无 `program:`、不登记、不进任何 Phase inventory |
| 它是「一台程序整体」 | **`overall`**（charter） |

**尺寸不再参与判定**，只影响文档篇幅与任务切分。这条与本相位的取舍自洽：既然 single-spec 永不登记，「占不占行」就不是可选项，而是归属的机械后果——归属 ⇒ 占行 ⇒ phase-spec；不归属 ⇒ 不占行 ⇒ single-spec。

#### 4.2 cdd-design：`mode?` 改判归属、`size?` 收窄

- `mode?` 今天的判据是「有没有父 overall」，这正是本相位走错的地方——程序存在（P1–P25 全 Done）不等于本需求属于它。改为**归属判定**：判定落点程序（可能为 none），有 ⇒ `phase-within-program` 再走注册门；none ⇒ `new-program`。
- 失败面：`phase-within-program` 路径产出 `single-spec` ⇒ BLOCKED（形状与归属不符）。
- `size?` 收窄：只剩「这台程序整体要不要拆成多相位」（new-program：单规约 ⇒ single-spec ／ 多相位 ⇒ overall charter）与「本相位一份 spec 装不装得下」（fit ／ oversized ⇒ charter）。

#### 4.3 cdd-close：closeout 显式两分支

`closeout-backfill` 显式两分支，让「本会话有没有相位行」不再靠操作者临场判断：

- **有相位行** ⇒ 翻 Done + 交付证据（现状不变）；
- **无行（游离 single-spec）** ⇒ 只收口 spec 自身的版本行 + `## Change history` 行 + 关 issue，不碰任何 overall 的 Phase inventory。

#### 4.4 机检门：Phase inventory 的 Design spec 必须 phase-spec

新增一条 doc-contract 规则：**父 overall 的 Phase inventory 行里，Design spec 单元指向的文档必须声明 `doc-type: phase-spec`**；指向 `single-spec` ⇒ 红，点名该行与修法（要么把它注册成相位并改成 phase-spec，要么把它从台账里摘出去）。这条把 §4.1 的「归属」变成可执行判据，而不是只靠惯例。判定面复用既有的链链接解析（`FileExistenceInvariant.targetPath` 的同一套读法），落 `doc` 作用域、`docKeys: ["overall"]`。

#### 4.5 本相位自身的归属（为什么从 single-spec 迁来）

本相位的四笔（正文 doc-revision · 图源孪生门 · `next:` 交棒 · 归属判据）全在 engine-doc-tooling 的 charter scope 内，按 §4.1 属该程序 ⇒ 应是 `phase-spec`。因此本设计由一份游离 single-spec 迁移而来：slug 由 `2026-11-05-engine-closeout-debts` 改为 `2026-10-10-engine-doc-tooling-p26`，补 `program:` 与 `parent-version:`，并按 phase-spec 骨架重排；同名 plan 的 slug 同笔跟随。旧 single-spec 文件删除，其内容面（含已过三轮评审的判据与落点）原样迁入本设计的 §1–§3。

### Acceptance criteria

- `ReviewRefs#docRevision` 对「仅追加 change-history 行 + 递增 `version:`」的前后两份内容给出**相同** `doc_hash`；对「正文改一句」给出**不同** `doc_hash`（plan 与 spec 各一对单测）。
- **互踢复现门**：分支行已绑定 plan 身份后，只改 plan 的 front-matter 与 Change history ⇒ `docLineVerdict("branch", plan)` 判 `same`；改 plan 的某条 Task 正文 ⇒ 判 `drift`；plan 行同形各一。
- **单一定义**：结构守卫断言 `session/ledger.ts` 里对文档内容求 hash 的站点只有一处（`ReviewRefs#docRevision`），且正文投影由 `contract` 面的投影类产生，`session` 面不再自行切片。
- **拒审文案**：`face/gate.ts` 的 doc 行 BLOCK 文案为「amend body to open a new review」，`:109` JSDoc 同字；`cli.test.ts:3059` 的 `target revision unchanged` 断言不动仍绿；除 §3 交棒面（closed single-spec 的 `next:` / `reason:`）外，其余 `next:` / `reason:` 字节零变化——本条不约束 §3 的随动字节。
- **六份孪生门**：`diagram-twin.guard.test.ts` 对六份源全绿，引用腿对三种 `diagram_type`（`components` / `states` / `nodes`）复用同一套归一化；三种反向注入（改 HTML 引用块一行 / 改源 `sublabel` 不重生成 / 只改一条卡片 `title` 不重生成）各一条红用例。
- **journey 语义 pin**：三条断言全绿，各配一条「把源改成错值即红」的用例；`MAX_TASKS_PER_WAVE` 由源文本解析后与常量比较。
- **closed single-spec 交棒**：`cdd review --type single-spec` 收口后 `next:` 为 host 渲染的 cdd-plan 指令串（claude 与 pi 两种拼写各一条 pin），`reason:` 为 `closed-line`；既有裸 single-spec 的 `face-closed` / `next: done` pin 同笔改判（`capsule.test.ts:435` · `run.test.ts:1983-1984` · `board-view.test.ts:990`）；`next.test.ts:605-608` 与 `:612-614` 两条类型/pin 同笔翻转；`cdd board --spec` 对同一份文档打印同一指向。
- **终点语义只留章程**：`overall` 行的 `next:` 仍是 `done`；`single-spec` 不再是 `terminal`（`docClassOf` 与 `#docClassByType` 各一条红 pin）；`PhaseFaceKey` 仍是四面、`single-spec` 不进面序（编译期字面 pin）；plan / wave / branch 三行 `next:` 字节零变化。
- **归属判据落文本**：`cdd-design` 的 `mode?` 判据为归属判定、`size?` 收窄、`phase-within-program` 产出 single-spec 记 BLOCKED；`cdd-close` 的 `closeout-backfill` 两分支在册；两份 skill 的 digraph 与节点文本自洽（skill-anatomy 门全绿）。
- **新门可红**：把任一条 Phase inventory 行的 Design spec 指向一份 `doc-type: single-spec` 的文档 ⇒ 该门红并点名该行；指向 `phase-spec` ⇒ 绿。
- `pnpm run validate` exit 0；`packages/cdd-engine` minor + `packages/kairos` minor changeset（消费面 `next:` 字节与 skill 文本均变）。

## Constraints

- 不改 `progress.json` 的行结构、不加字段、不做迁移；既有已绑定的旧 `doc_hash` 行只需在下一轮 review/fix 完成时自然改写，不主动回填。
- 不改 `brief-revision`（wave 线）的语义——D30 的「渲染 brief」投影已经是对的，本相位只统一 doc 线的粒度。
- 不放宽任何重开判据：正文修订仍然 drift，只把「收口登记」从身份里摘出去。
- 孪生门**只读**生成产物，绝不写 HTML；`docs/diagrams/*.html` 仍由 Archify finalize 产出，禁手改；不引入 Archify 依赖。
- 流水线序仍只在引擎一处声明：交棒目标进 `PIPELINE_NEXT`（数据表），skills 侧不新增「我完了该谁上」的节点或句子——D33 的裁定面不回退。
- 归属判据只落文本与一条门，**不新增** `single-spec` 的 `program:` 元素——单规约永不登记，登记了就不是 single-spec。
- 新门落 `doc` 作用域、`docKeys: ["overall"]`，只判 Phase inventory 行的 Design spec 单元；不扩到 Implementation plan 单元（那里的 cell 形态允许 `[Pending]`，判据不同）。
- 零模块级裸函数：投影与守卫的读面写成类；静态面带 biome-ignore 与一行理由。
- 波宽 ≤ 3：本相位任务的 `DependsOn` 分层任一不超过 3。

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-11-05 | 初版（由游离 single-spec v0.2 迁入并补 §4）：四笔收口面残余——正文 doc-revision（#417）· 六份图源孪生门（#418）· spec 闭合交棒 cdd-plan · single-spec ⇄ phase-spec 归属判据 + 机检门；§1–§3 沿已过三轮评审的 single-spec 文本 | [human] 裁定 · Claude（本会话） |
| v0.2 | 2026-11-05 | 按首轮评审更正内容面：§3.4 改为 `INPUT_SPEC` = 同 slug 身份文档路径（交棒后仍非空），空槽归属 `INPUT_OVERALL` 的 `program:`；§2.3 文案孪生补卡片 `title`；验收的零变化子句收窄到 §3 交棒面外 | Claude（本会话） |
