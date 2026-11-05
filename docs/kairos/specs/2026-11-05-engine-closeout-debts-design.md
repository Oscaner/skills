---
title: '两条收尾债的收口：文档身份只算正文 · 六份图源常驻孪生门'
doc-type: single-spec
version: v0.1
date: 2026-11-05
slug: 2026-11-05-engine-closeout-debts
author: '[human] 裁定 · Claude（本会话 brainstorming → 本会话落 spec · 2026-11-05）'
issues: '#417 #418'
---

## Background & root cause

两笔债各自独立，共同点是**没有任何自动门会因它变红**：一笔靠多跑评审轮次偿付，一笔靠人工比对发现。

### 一 · 两条行绑同一个身份文档（#417）

`plan` 行与 `branch` 行绑的是**同一份 plan 的整篇内容 hash**：

| 行 | 写回点 | 绑定的输入 |
| --- | --- | --- |
| plan 行 | `session/run.ts:746` `#recordReviewedDocRevision`（方法体在 `:766`）→ `#recordDocRevisionOf` | plan 的 `doc-revision` |
| branch 行 | `session/run.ts:784` `#recordReviewedBranchRevision` → 同一 `#recordDocRevisionOf` | **同一份 plan** 的 `doc-revision` |

而 `doc-revision` 今天是**整篇文件**的 sha1（`session/ledger.ts:477` `ReviewRefs#docRevision` 直接吃 `content`）。每一轮 review / fix 收工都会往 plan 写一笔（change-history 行、front-matter `version:` 递增），于是**任一行的 fix 只要动了 plan，另一行立刻判 drift**，互踢直到某一次 fix 恰好不碰 plan 才停。

P24 的实证（同一分支）：`41bf1406`（branch fix 1）⇒ plan 行 drift ⇒ 多跑 `plan review 8`；`b19a312d`（plan fix 8）⇒ branch 行 drift ⇒ 多跑 `branch review 2`；`c5549047`（branch fix 2，只动 `face/board-view.ts`）才收敛。互踢**没有终止保证**——软上限只管同一条线的连续 blocker 轮，不跨线。

**病根不是身份判定本身，而是身份的粒度**：整篇 hash 把「收口登记」（front-matter `version:` / `date:`、`## Change history` 行）与「被审的正文」混成一个值，于是记账性写入与实质修订在门眼里等价。

### 二 · 六份图源，一半没有门（#418）

`docs/diagrams/src/` 下六份图源（`architecture` · `journey` · `next-loop`，各 en / zh-CN），每份都有一份被 git 跟踪的生成 HTML，承载的是引擎语义的散文断言（「八条命令」「`next:` 是运行最后一行」这类会被相位推进推翻的句子）。

覆盖现状：

| 源 | 语义 pin（源级） | 源 ⇄ HTML 孪生 | 结论 |
| --- | --- | --- | --- |
| `architecture.{en,zh-CN}` | `face/__tests__/diagrams.guard.test.ts`（八条命令面 + 引用跨度 + revision pin） | 同一条守卫的 HTML 腿（残留检查） | 两腿 |
| `next-loop.{en,zh-CN}` | `scripts/__tests__/next-loop-twin.test.ts`（三条判收敛断言 + 周期数与运行时常量对齐） | 无 | 只有源腿 |
| `journey.{en,zh-CN}` | 无 | 无 | **零 pin** |

`docs/diagrams/README.md` 要求「改源必须用 Archify finalize 重生成 HTML，禁手改」——**这条纪律没有任何自动检查**。P24 踩过一次：`next-loop.zh-CN.html` 曾读作「最后一一行」而源写「最后一行」，所有门全绿，人工比对才发现；`journey` 两份连这种偶然发现的机会都没有。

## Design decisions

### 1 · doc-revision 只算正文（#417）

**裁定（作者，2026-11-05，issue #417 comment）**：所有 `doc-revision` 都应只计算**正文**，即排除 front-matter 与 `## Change history`——这两部分常常只是收口登记，因它们触发的重审没有意义。

落点与规则：

- **定义点唯一**：投影在 `ReviewRefs#docRevision`（`session/ledger.ts:477`）内部完成，`doc_hash` 改由「正文投影」的 sha1 得出。ref 的 kind、两层结构（`doc` 路径层 + `doc_hash` 层）、ledger 行结构三者**一律不动**——无新字段、无迁移。
- **正文投影**：原文去掉「开头 YAML front-matter 块」（连续的 `---` … `---`；无 front-matter 的文档从首行起算）与「`## Change history` 整节」（该 rank-2 标题行至下一个 rank-2 标题或文末）后的剩余行。其余一律计入：`## Constraints`、`## Review Focus`、`### Task N:` 的任务正文都在内。
- **一处定义、三腿继承**：doc 腿（plan / spec 行）、branch 腿、以及所有漂移判定（`session/ledger.ts:906` `docLineVerdict`、`:1303` `docReopens`、`session/pipeline.ts:156` `branchLineOpen`、`session/run.ts:583`/`:592`、`face/gate.ts:71` `lineGate`）全走同一个 `docRevision`，不新增第二套比较。
- **行为后果（明确接受）**：只改 front-matter 或只追加 change-history 行的 fix 之后，该行判 `same`——`cdd review` 会以「already reviewed … target revision unchanged」拒绝重审（anti-spin 的正例），branch 行也不再被对向 fix 踢开。**实质正文修订仍然 drift**，这是要保留的语义。
- **随动的字节**：`face/gate.ts:119` 的 BLOCK 文案「amend body/version to open a new review」在新规则下不再成立，改为「amend body to open a new review」。这是本 spec 唯一允许改变的 `next:` / `reason:` 相邻字节。
- **不采纳的两条路**：分支行身份收窄为「任务集」——会丢掉「plan 正文动了分支该重开」这条 P21 §4.1 语义，且仍留下反方向的踢；「封顶重开次数」——只限制不除根，还要新状态字段。正文投影同时解决两个方向且零新状态。

### 2 · 六份图源的常驻孪生门（#418）

**裁定（作者，2026-11-05，本会话三选一取 A）**：六份同权，不引入 Archify 依赖。

- **新守卫** `face/__tests__/diagram-twin.guard.test.ts`：对六份源逐一配对它的 HTML，跑两条腿：
  - **引用证据孪生**：解析 HTML 内嵌的 `script#archify-source-evidence-data`，其载荷形状是 `{ repository, referenceCount, nodes }`——引用不在顶层 `sources` 里，而在 `nodes` **映射**下的逐节点数组中，每个元素形如 `{ path, line, endLine }`；源侧的引用集合则挂在**按 `diagram_type` 而定的根**上：`components`（`architecture`）、`states`（`lifecycle`，即 `next-loop`）、`nodes`（`workflow`，即 `journey`），且源侧的跨度结束字段拼作 `end_line`，不是 `endLine`。比较前必须先做**一次归一化**：两条腿都投影成 `(path, line, end)` 三元组的多重集（`end_line` ↔ `endLine` 在此映射），再判等。判据三条：`repository.revision` 等于源 `meta.repository.revision`；归一化后的引用多重集与源侧引用多重集相等；`referenceCount` 等于引用条数。⇒「源改了没重生成」「手改 HTML 里的引用块」都红。
  - **文案孪生**：源里每条 `label` / `sublabel` / `tag` / 摘要卡片条目，必须在该 HTML 中逐字出现（HTML 转义后比较）。⇒「源文案改了没重生成」红。
  - 另外断言源的 `meta.output` 指向被检查的那份 HTML，源与产物不许配对错位。
- **既有语义守卫不动**：`diagrams.guard.test.ts` 继续 pin `architecture` 两条的八条命令面与三处引用跨度，不并入孪生门（语义 pin 与孪生门是两种判据，混在一起会让失败原因不可分）。
- **`journey` 从零 pin 补到一腿**：新增 `scripts/__tests__/journey-twin.test.ts`，把 `journey` 两份的散文断言钉到运行时常量上——至少三条：(1) 波宽「至多三个任务」⇄ `contract/wave-width.ts:16` 的 `MAX_TASKS_PER_WAVE`；(2) `--type` 词表不含已退役的 `spec` ⇄ `session/faces.ts:26` 的 `TargetType` 联合；(3) 每轮派发的日志落在 `.kairos/cdd/<slug>/logs/` ⇄ 两个具名符号：`face/lifecycle.ts:130` 的 `CliLifecycle.LOGS_DIR`（`"logs"`）与 `infra/runtime.ts:127` 的 `ENGINE_RUNTIME.handoffNamespace.workspaceRoot`（`.kairos/cdd`）。任一侧改动即红。
- **不采纳的两条路**：只补 `journey` 源级 pin（HTML 腿仍靠人记）；把重生成塞进 `emit`（CI 要引 Archify 的 finalize 链路，稳定性与耗时全得重裁——留作后续独立议题，不在本 spec 内）。

## Acceptance

1. **正文投影**：`ReviewRefs#docRevision` 对「仅追加 change-history 行 + 递增 `version:`」的前后两份内容给出**相同** `doc_hash`；对「正文改一句」给出**不同** `doc_hash`。以单测钉住两种情形（plan 与 spec 各一）。
2. **互踢消失（#417 的实证形态复现）**：分支行已绑定 plan 身份后，只改 plan 的 front-matter 与 Change history ⇒ `docLineVerdict("branch", plan)` 判 `same`；改 plan 的某条 Task 正文 ⇒ 判 `drift`。plan 行同理。
3. **单一定义**：结构守卫断言 `session/ledger.ts` 里对文档内容求 hash 的站点只有一处（`ReviewRefs#docRevision`），且正文投影由 `contract` 面的投影类产生，`session` 面不再自行切片。
4. **拒审文案更新**：`face/gate.ts` 的 doc 行 BLOCK 文案为「amend body to open a new review」——改的是 `:119` `#docLineBlock` 的模板串，以及 `:109` 那句引用旧文案的 JSDoc（两处必须一致）。既有用例**不**字面 pin 「amend body/version」子句（`cli.test.ts:3059` 只断言 `target revision unchanged`），所以随动的只是引用旧文案的注释（`cli.test.ts:3333`）；只有新增或既有 expect 真的 pin 了该子句时才需要改断言。其余 `next:` / `reason:` 字节零变化（由既有字节级用例守住）。
5. **六份孪生门全绿**：`diagram-twin.guard.test.ts` 对六份源全部通过，且引用腿在两个方向上对三种 `diagram_type` 复用同一套归一化（`components` / `states` / `nodes` 三个根都覆盖）；手工把任一份 HTML 的引用块改一行、或把任一份源改一句文案后不重生成，该门即红（两种反向注入各一条用例）。
6. **`journey` 语义 pin 全绿且可反向红**：三条断言各有一条「把源改成错值即红」的用例，`MAX_TASKS_PER_WAVE` 由源文本解析后与常量比较（与 `next-loop-twin` 的周期数同一手法）。
7. `pnpm run validate` 全绿；`packages/cdd-engine` 与 `packages/kairos` 有行为改动 ⇒ 附一条 minor changeset。

## Constraints

- 不改 `progress.json` 的行结构、不加字段、不做迁移；既有已绑定的旧 hash 行只需在下一轮 review/fix 完成时自然改写，不主动回填。
- 不改 `brief-revision`（wave 线）的语义——D30 的「渲染 brief」投影已经是对的，本 spec 只统一 doc 线的粒度。
- 不放宽任何重开判据：正文修订仍然 drift，只把「收口登记」从身份里摘出去。
- 孪生门**只读**生成产物，绝不写 HTML；`docs/diagrams/*.html` 仍由 Archify finalize 产出，禁手改。
- 新的守卫读 `docs/diagrams` 与 `packages/cdd-engine` 两个面，按既有先例（语义守卫的跨面读）落在 engine 套件；`journey` 的语义 pin 与 `next-loop-twin` 同落在 `scripts/` 根套件。
- 零模块级裸函数：投影与守卫的读面写成类（`MarkdownTree` / 既有守卫的 `DiagramSource` 类的先例）。

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-11-05 | 初版：两笔收尾债（#417 文档身份只算正文 · #418 六份图源常驻孪生门）的裁定、落点与验收 | [human] 裁定 · Claude（本会话） |
