---
title: '引擎文档工具（Engine Doc-Tooling）— P33 设计：dispatch prompt 判别符进 round context'
doc-type: phase-spec
version: v0.1
date: 2026-11-13
slug: '2026-10-10-engine-doc-tooling-p33'
program: 2026-10-10-engine-doc-tooling
parent-version: v3.52
author: '[human] 裁定 · Claude（kairos:cdd-design · 2026-11-13）'
---

## Design

本相位收口 dispatch prompt 的一处读面缺口：被派发的 child 无法从自己收到的文本里直接读到自己正跑哪种 target type，只能从旁证反推。实测同模式跨类型的 prompt 今天在 fix 面 **100% 字节相同**，在 review 面也仅靠壳内一行 `**Criteria — …:**` 与 lens 集合间接可读。

裁定把类型事实落进 **round context**（拼装序的尾部），标题与六个 shell 一字不动——缓存前缀的跨型复用因此全额保留。塞标题的方案与拆 ROLE 的方案均已实测/结构评估后否决（§1.2、§2.4）。

### 1. 病根

#### 1.1 类型事实没有声明面

三个壳的标题都是常量（review / fix / docs-fix 各一条，居于 `render/templates.ts` 的 `reviewRow`、`FIX_SHELL`、`DOCS_FIX_SHELL`），`WorkMode` 词汇表只有 `implement` / `fix` / `review` / `docs-fix` 四值（`WORK_MODES`），与 target type 是两个正交轴。判别符 `REVIEW_TYPE` 是「supplied but never rendered」的 review 专用槽：它参与行选择（`TemplateAssembler` 的 `#rowOf` 与 `#reviewRow`），却从不进 prompt；且 `face/lifecycle.ts` 的 `#valuesOf` 在非 review 面注入空串。于是 fix / docs-fix 的 prompt 里没有任何一处声明 target type。

可用的只剩三处旁证，且都不可靠：哪些 `INPUT_*` 槽有值（同一 doc 型彼此几乎一致）、`OUTPUT_HANDOFF` 的文件名（wave 线是 `tasks-…`，不含 `wave` 字样）、wave 线的 `WAVE` 键。

#### 1.2 为什么不能塞标题

`TemplateAssembler.render`（`render/templates.ts`）的拼装序是 `shell + return + round-context`。标题是**第 1 字节**，即整条 prompt 前缀的起点；prompt 缓存以最长公共前缀命中。

实测（同一装配器的两次渲染求最长公共前缀）：

| 对比 | 共享前缀 | 分叉点 |
|---|---|---|
| review `phase-spec` vs `plan` | 1675 字符（占全篇约 22%） | 壳内 `**Criteria — …:**` 行 |
| fix 跨类型（`plan` vs `branch`） | **100%**（5969 字符全等） | 无——壳内根本没有类型 |

round context 起始于 5679/5969 位置。结论：类型事实落标题，跨类型共享前缀直接归零（fix 面损失整壳）；落 round context，前缀一字不动。

### 2. 裁定

#### 2.1 判别符改名并渲染

`REVIEW_TYPE` → `TARGET_TYPE`。渲染之后 **token 名就是 child 读到的标签**，fix 轮的 round context 里印一行 `REVIEW_TYPE` 是错语义，故改名不是洁癖而是正确性。

渲染位置：round context 第一段，紧跟 `ROLE`——身份事实聚拢在一处。落点是 `render/templates.ts` 的 `REVIEW_CONTEXT`、以及 `MODE_PROMPTS` 里 fix / docs-fix 两行的 `roundContext` 数组，三处同一行位。

值域沿用 CLI `--type` 词本身（`phase-spec` / `overall` / `plan` / `single-spec` / `wave` / `branch`），不引入第二套拼写（P22 D73 单一词表）。

#### 2.2 注入面：以 ROLE 为键，非 implement 轮都有类型

`face/lifecycle.ts` 的 `#valuesOf` 把 `REVIEW_TYPE: isReview ? frame.type : ""` 改为 `TARGET_TYPE`，取值按该轮的 work-mode（同一个类里的 `#roleOf`）：**implement 轮注入空串，其余轮一律注入 `frame.type`**。空串注入是今天 fix 面「无声明」的根因，除 implement 一线外一并消除。

实现层不需要新分支：round-context 渲染器对空值丢行（`TemplateAssembler` 的 `#contextLines`），而 token 存在性 gate 只要求「有值」、允许空串——implement 因而天然不渲染该行。

#### 2.3 implement 不渲染

implement 的类型集只有一个成员：它唯一的产出点是 `session/ledger.ts` 的 `waveLineRoute`（未实现的波 → `next-wave` → implement 字面），类型恒为 `wave`。常量行零信息量，不渲染。

规则一句话：**类型集多成员的轮带该行，单成员的轮不带**。日后若出现第二个 implement 类型，该行随之出现，无需改规则。

#### 2.4 否决 ROLE 拆值

曾考虑把 `ROLE` 拆成 `overall-review` / `plan-review` 这类值以省掉新行。否决理由：ROLE 是 work-mode（对应 handoff 平面与 face 平面，P4 的四模式 dispatch 表就是这张表），把它拆成 mode × type 会把两个正交轴并成一个，`WORK_MODES` 词汇表、`TEMPLATE_PROMPT.modes` 的表键、装配器的行选择、以及 `workModes()` 的 pins 全部要跟着重写，而收益与 §2.1 完全相同。

### 3. 失败面

#### 3.1 空注入的静默丢行

round-context 渲染器对空值**丢行而不报错**。若注入面回退成空串，该行会凭空消失且引擎不响。以 pin 把门：六型 review、两型 fix、四型 docs-fix 每型各断言该行存在且值等于 `--type` 词。

#### 3.2 改名残留

`REVIEW_TYPE` 出现在装配器的两处错误消息与三处注释里。改名须同步，否则报错文本指向一个不存在的 token，把下一次真缺陷的定位成本抬高。

## Acceptance criteria

- `cdd review --type phase-spec|overall|plan|single-spec|wave|branch` 的 dispatch prompt round context 含 `- \`TARGET_TYPE\`: 该词`；`cdd fix --type wave|branch` 与 docs-fix 的四 doc 型同理。
- implement 轮的 prompt 不含 `TARGET_TYPE` 行。
- 六个 shell 与 fixed prefix 零字节变更（标题与 `**Criteria — …:**` 行不动；跨型共享前缀复用保持）。
- `TARGET_TYPE` 命名单源：装配器与生命周期内 `REVIEW_TYPE` 零残留；非 review 面不再注入空串。
- 引擎 vitest 全绿（新增按型的 round-context 行 pins）；`pnpm run validate` exit 0。
- changeset `cdd-engine` **minor**；不发布。

## Constraints

- 不动 `next:` 字面（D70 收敛主线）。
- 不动 `WORK_MODES` 四模式词汇表与 `TEMPLATE_PROMPT.modes` 的表键（D85 否决 ROLE 拆值）。
- 不改 review 壳内既有的 `**Criteria — …:**` 与 lens 行——与新增行并存，前者是判据标签，后者是声明事实。
- 不引入新依赖；不发布。

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-11-13 | P33 初稿：判别符 `REVIEW_TYPE` → `TARGET_TYPE` 并渲染进 round context；全轮注入真实 type；implement 单成员不渲染；标题与 shell 零改动（D85）。 | '[human] 裁定 · Claude（kairos:cdd-design · 2026-11-13）' |
