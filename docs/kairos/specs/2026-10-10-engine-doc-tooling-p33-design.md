---
title: '引擎文档工具（Engine Doc-Tooling）— P33 设计：dispatch prompt 判别符 + 参照面校准'
doc-type: phase-spec
version: v0.6
date: 2026-11-13
slug: '2026-10-10-engine-doc-tooling-p33'
program: 2026-10-10-engine-doc-tooling
parent-version: v3.56
author: '[human] 裁定 · Claude（kairos:cdd-design · 2026-11-13）'
---

## Design

本相位收口 dispatch prompt 的一处读面缺口：被派发的 child 无法从自己收到的文本里直接读到自己正跑哪种 target type，只能从旁证反推。fix 面壳内没有一个字节把类型当成声明来印（类型只从证物文件名这类旁证反推），同模式跨类型的 prompt 在注入的 `## Handoff schema` 之前逐字节相同；review 面也仅靠壳内一行 `**Criteria — …:**` 与 lens 集合间接可读。

裁定把类型事实落进 **round context**（拼装序的尾部）：标题不动，参照面四处校准（§2.5）与主体面五处校准（§2.6）改的是**同模式内全类型一致**的句子。两件都不破坏跨型共享前缀。塞标题的方案与拆 ROLE 的方案均经结构评估后否决（§1.2、§2.4）。

### 1. 病根

#### 1.1 类型事实没有声明面

三个壳的标题都是常量（review / fix / docs-fix 各一条，居于 `render/templates.ts` 的 `reviewRow`、`FIX_SHELL`、`DOCS_FIX_SHELL`），`WorkMode` 词汇表只有 `implement` / `fix` / `review` / `docs-fix` 四值（`WORK_MODES`），与 target type 是两个正交轴。判别符 `REVIEW_TYPE` 是「supplied but never rendered」的 review 专用槽：它参与行选择（`TemplateAssembler` 的 `#rowOf` 与 `#reviewRow`），却从不进 prompt；且 `face/lifecycle.ts` 的 `#valuesOf` 在非 review 面注入空串。于是 fix / docs-fix 的 prompt 里没有任何一处声明 target type。

可用的只剩三处旁证，且都不可靠：哪些 `INPUT_*` 槽有值（同一 doc 型彼此几乎一致）、`OUTPUT_HANDOFF` 的文件名（wave 线是 `tasks-…`，不含 `wave` 字样）、wave 线的 `WAVE` 键。

#### 1.2 为什么不能塞标题

`TemplateAssembler.render`（`render/templates.ts`）的拼装序是 `shell + return + round-context`。标题是**第 1 字节**，即整条 prompt 前缀的起点；prompt 缓存以最长公共前缀命中。

三个壳的标题都是常量，一个字都不随类型变；注入 `## Handoff schema` 之前的壳内类型字节只有 review 壳的 `**Criteria — <type>:**` 行（标签 + 其后的 axesGuide 体）与 `**Lens labels:**` 行。这两点不是测量值，而是 `render()` 的拼装序与 `reviewRow` / `FIX_SHELL` / `DOCS_FIX_SHELL` 三个常量标题的直接后果。注入的 `## Handoff schema` 同样在壳内，其证据文件名取自 `RoundNaming#prefix`（wave 线 `tasks` · branch 线 `branch`），所以 fix 面的类型分化落在 schema 段——共享前缀只覆盖到它之前。

因此本节只钉**必须成立的条件**，可机器判的那一半落在 Acceptance criteria 的对应条目上：标题零字节变更，`**Criteria — <type>:**` 的标签与 `**Lens labels:**` 行零字节变更（criteria 体按 I / J / K 的要求改），且 §2.5 / §2.6 的句子修改对同模式内全类型一致。两条同时成立时，同模式跨类型的共享前缀按字节复用；标题带类型则把类型字节放到第 1 位，这条复用在 fix 面整壳归零。round context 在拼装序尾部，改它不动前缀。

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

#### 2.5 参照面四处校准（D86）

全类型注入矩阵（六 review · 两 fix · 四 docs-fix · implement，按 `#valuesOf` 真实槽规则渲染）选出四处「round context 的名字都带了、但映射到错的对象」。四处的共同盲区：`TemplateAssembler#assertShellLayout` 只校验「shell 提到的名字是否被该 mode 的 layout 携带」，不校验名字所指——结构门对这类缺陷恒绿。

**A · `FIX_SHELL` 的 `INPUT_SPEC` 子句指向一个到不了的面。** 文档型 fix 走 `DOCS_FIX_SHELL`，故 fix 面永不出现 spec line。而 branch fix 确实带 `INPUT_SPEC`，值是设计 spec 参考（`#valuesOf` 的 `specLink`），不是被判文档。现句子把参考说成 the spec document——孩子可能越界编辑它，触发 doc-revision drift 重审。改为按面点名：wave 线带 `INPUT_WAVE_BRIEF`；branch 线带 `INPUT_PLAN`（计划文档）与 `INPUT_SPEC`（设计 spec，conformance 参考而非被判对象）。

**B · `REVIEW_ITEM` 把 branch 归进 plan review。** 共享句写 the plan/branch reviews judge the plan at `INPUT_PLAN`，而同一条 prompt 的 branch criteria 正文写 branch review IS the full diff、判定面是 `BASE_BRANCH` 的 diff。两者互斥。branch 的被判对象是活的树，计划只是 conformance 参考。改为把 branch 单列：判定活的树对 `BASE_BRANCH`，`INPUT_PLAN` 是其 plan-conformance 参考。

**C · overall 面两个锤指向同一文件（C2）。** 该面 `INPUT_SPEC` 与 `INPUT_OVERALL` 注入同一路径，共享句于是要求拿 charter 对照它自己。根因：P17 把 doc-type `overall-spec` 改名 `overall` 时，被判文档锤没跟着改名（`lifecycle.ts` 注释自白 the charter line's own charter is its spec anchor）。修法 C2：该面只留 `INPUT_OVERALL`、`INPUT_SPEC` 置空，家族词归位；`REVIEW_ITEM` 与 `DOCS_FIX_SHELL` 各补一句 overall 锤名。

**D · docs-fix 的 plan 面没给 `INPUT_SPEC` 定性。** plan-doc 行同时带 `INPUT_PLAN`（目标）与 `INPUT_SPEC`（参考），而句子只在 spec-doc line 时给后者定性。补一句：该参考不在本轮编辑范围内。

**E · 不并入（nit）。** `**Single agent:**` 说覆盖被派发 skill 的并行默认，而只有 wave / branch review 挂 skill，其余四型空转——留着无害，不占本相位。

#### 2.6 主体面五处校准（D87）

把 round context 以外的共享主体逐块摊开——`FRAME_ITEMS` · `WORK_CAPABILITY` · 每模式指令句 · lens 行 · criteria 体 · `LICENSE_ITEMS` · rubric 槽——选出五处。其中两处的共同根因是 `LICENSE_ITEMS` 是无条件拼进每个壳的单一共享块（注释自陈 the same bytes, one per shell），而各模式的语义（docs-fix 的授权与原地编辑 · review 的只读）在这块之前就已分化，这块却无条件拼入。

**G · docs-fix 壳三句互斥。** 同一个 prompt 里：`capability: may.amend = content` 声明本轮**可**改 spec 与 plan 的内容面；`**docs-fix:**` 指令它**原地**把 findings 应用到被判文档；而共享 clause `cl:plan-freeze` 写「Approved plan/spec files are frozen — zero modification authority … never edited in place」。一句授权、一句下令、一句绝对禁止。冲突不限于 docs-fix：`WORK_CAPABILITY` 与 `LICENSE_ITEMS` 的 clause 同样拼进 implement 与 fix 壳，故这三句的对冲落在三张 work 壳上，交付改动与验证面都须覆盖 implement · fix · docs-fix。

**H · review 壳的提交纪律与只读对冲。** 同一个壳里 `cl:atomic-commit` 要求「Commit each round's change as one atomic conventional commit」而 `**Read-only:**` 写 committing belongs to the orchestrator。review 轮本无改动可提交。

**I · single-spec 被要求对照一个不存在的父。** `spec` 判据体由 phase-spec 与 single-spec 共用，其 program-conformance 句要求对 `INPUT_OVERALL` 判；而 single-spec 无 `program:`、该行被丢，且它不是一个 phase。

**J · branch 判据体用退役词。** 「Same four axes as task」——task 已在 T26 重命名为 wave，CLI 里不存在 `--type task`。

**K · overall 的 rubric 槽仍是 spec。** `REVIEW_BODY_TEXT.overall` 的 `artifact` 是 `spec`、`audience` 是 `downstream author`，于是 charter 的 prompt 里出现 the reviewed spec … a reasonable downstream author。与 C 同根（P17 `overall-spec` → `overall` 的残留），只是落在 rubric 槽值上。

**修法裁定（α）：两句自限定，不拆共享块。** G/H 都是「共享 clause 没有被告知当前轮的权限」。修法让它们**自己限定**：freeze 句限定到本轮声明的 `capability: may.amend` 之外（无声明即不得原地改，这与 review 的现有语义一致），commit 句补一句「只读轮无提交 · 其写入仅 `OUTPUT_*`」。保留 `LICENSE_ITEMS` 单一共享块（与每轮的指令句、能力声明各就各位），不拆成按模式的集合（β 的维护面翻倍，换来的只是同源性的形式化）。自限定以轮声明的 `capability` 为界，故该声明的措辞成为承重面：它须点名被判文档族本身（phase-spec / single-spec / overall charter / plan），否则 docs-fix 的 overall 变体（`cdd fix --type overall` 走 docs-fix；K 又裁定 charter 不是 spec）会落成「下令原地改 charter、冻结句却判它是 spec」的自相矛盾。I / J / K 为纯文本修正。

### 3. 失败面
#### 3.1 空注入的静默丢行

round-context 渲染器对空值**丢行而不报错**。若注入面回退成空串，该行会凭空消失且引擎不响。以 pin 把门：六型 review、两型 fix、四型 docs-fix 每型各断言该行存在且值等于 `--type` 词。

#### 3.2 改名残留

`REVIEW_TYPE` 的改写面就是 Acceptance criteria 里「零残留」那条判据的全部范围，不多不少：token 登记表（`TOKENS`）· 装配器的行选择与门与报错路径（`TemplateAssembler#rowOf` / `#gate` / `#reviewRow`）· 注入面（`face/lifecycle.ts#valuesOf`）· 以及与之同址的 render / infra 测试夹具。改名须在这个范围里全量同步，否则报错文本指向一个不存在的 token，把下一次真缺陷的定位成本抬高。

#### 3.3 结构门看不见名字所指

`#assertShellLayout` 是「名字 ⊆ layout」的结构校验。本轮四处缺陷的名字全部被携带，因此门恒绿。**本相位不新增门**（与 P28「易变事实不设门」同向）：校准后的句子由评审读，pins 只钉可机器判的两件事——每个变体的 round context 行集（§2.1 / §2.2 / §2.5 的锤名与类型行），以及 shell 里出现的 `INPUT_*` / `BASE_BRANCH` 名字仍在其 layout 内（既有门）。名字↔对象的正确性不设门。

### Acceptance criteria

- `cdd review --type phase-spec|overall|plan|single-spec|wave|branch` 的 dispatch prompt round context 含 `- \`TARGET_TYPE\`: 该词`；`cdd fix --type wave|branch` 与 docs-fix 的四 doc 型同理。
- implement 轮的 prompt 不含 `TARGET_TYPE` 行。
- 标题零字节变更；`**Criteria — <type>:**` 的标签与 `**Lens labels:**` 行零字节变更；criteria 体可在 I / J / K 要求处改，且对共享该体的变体一致；§2.5 与 §2.6 的句子修改对同模式内全类型一致，故跨型共享前缀复用保持。
- `TARGET_TYPE` 命名单源：装配器与生命周期内 `REVIEW_TYPE` 零残留；非 review 面不再注入空串。
- 引擎 vitest 全绿（新增按型的 round-context 行 pins）；`pnpm run validate` exit 0。
- changeset `cdd-engine` **minor**；不发布。
- **A**：fix 面的句子不再声称 `INPUT_SPEC` 是被判文档——branch 线把它定性为设计 spec 参考，wave 线连提都不提。
- **B**：共享句与 branch criteria 的判定面一致（活的树 + 计划参考），二者不再互斥。
- **C2**：overall 面的 round context 只有一个 charter 锤且名为 `INPUT_OVERALL`，`INPUT_SPEC` 在该面为空；review 与 docs-fix 两面同判；`REVIEW_ITEM` 与 `DOCS_FIX_SHELL` 各含一句 overall 锤名。
- **D**：plan-doc 行明示 `INPUT_SPEC` 为不可在本轮编辑的参考。
- **G**：三张 work 壳（implement · fix · docs-fix）都不再「授权同时禁止」同一内容面——`cl:plan-freeze` 限定到本轮声明的 `capability: may.amend` 范围之外，且该声明点名被判文档族（phase-spec / single-spec / overall charter / plan），使 docs-fix 四型与冻结句一致；docs-fix 壳的原地编辑指令不再与之互斥。
- **H**：review 壳的 commit clause 明示只读轮无提交、写入仅 `OUTPUT_*`；与 `**Read-only:**` 不再对冲。
- **I**：single-spec 的 prompt 不再要求对照一个被丢弃的 `INPUT_OVERALL`——program-conformance 句显式限定 phase-spec。
- **J**：branch 判据体不再出现退役词 task。
- **K**：overall 的 rubric 槽为 charter / phase author，不再把 charter 叫 spec。

## Constraints

- 不动 `next:` 字面（D70 收敛主线）。
- 不动 `WORK_MODES` 四模式词汇表与 `TEMPLATE_PROMPT.modes` 的表键（D85 否决 ROLE 拆值）。
- 不改 review 壳内既有的判据标签 `**Criteria — <type>:**` 与 `**Lens labels:**` 行——与新增行并存，前者是判据标签，后者是声明事实；criteria 体按 I / J / K 的要求改。
- 不引入新依赖；不发布。

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-11-13 | P33 初稿：判别符 `REVIEW_TYPE` → `TARGET_TYPE` 并渲染进 round context；全轮注入真实 type；implement 单成员不渲染；标题与 shell 零改动（D85）。 | '[human] 裁定 · Claude（kairos:cdd-design · 2026-11-13）' |
| v0.2 | 2026-11-13 | 并入参照面四处校准（D86）：A `FIX_SHELL` 的 `INPUT_SPEC` 子句改按面点名；B `REVIEW_ITEM` 把 branch 从 plan review 拆出；C2 overall 面只留 `INPUT_OVERALL`、`INPUT_SPEC` 置空（补完 P17 的改名）；D docs-fix plan 面给 `INPUT_SPEC` 定性。§3.3 记明结构门看不见名字所指，本相位不新增门。 | '[human] 裁定 · Claude（kairos:cdd-design · 2026-11-13）' |
| v0.3 | 2026-11-13 | 并入 phase-spec-review-1 全部四条：F1 §1.2 的 LCP 实测值撤出正文，改述为必须成立的条件（标题与 `**Criteria — …:**` 行零字节 · §2.5 句子同模式内全类型一致）；F2 §3.2 的改名残留面改按 AC「零残留」判据全量列出（`TOKENS` · `#rowOf`/`#gate`/`#reviewRow` · `#valuesOf` · 测试夹具）；F3 parent-version 对齐 v3.54（overall 侧已由编排器回填）；F4 新增 §3.3 标题，结构门盲区说明独立成节。 | '[human] 裁定 · Claude（kairos:cdd-design · 2026-11-13）' |
| v0.4 | 2026-11-13 | 并入主体面五处（D87）：G docs-fix 的 freeze/capability/指令三句互斥 · H review 的 commit/只读对冲 · I single-spec 被要求对照被丢弃的 `INPUT_OVERALL` · J branch 判据体的退役词 task · K overall rubric 槽仍是 spec。修法取 α（clause 自我限定，保住 `LICENSE_ITEMS` 单一共享块）。 | '[human] 裁定 · Claude（kairos:cdd-design · 2026-11-13）' |
| v0.5 | 2026-11-13 | 并入 phase-spec-review-2 全部六条：F1 冻结面收窄为标签（标题 · `**Criteria — <type>:**` 标签 · `**Lens labels:**` 行零字节，criteria 体可在 I/J/K 需要处改）并 parent-version 对齐 v3.56；F2 §1.2 撤掉「壳内唯一随类型变化」的过宽断言，点名注入 `## Handoff schema` 的 `RoundNaming#prefix` 分化；F3 G 扩到三张 work 壳并让 AC3 的均匀句覆盖 §2.6；F4 α 自限定须点名被判文档族；F5 §2.6 导语的根因句改为「分化在前、块无条件拼入」；F6 历史表按版本序重排。 | '[human] 裁定 · Claude（kairos:cdd-spec-writer · P33 review 2 fix · 2026-11-13）' |
| v0.6 | 2026-11-13 | **closeout 登记（cdd-close）**：P33 全链闭合——三波 W1{1} · W2{2} · W3{3} 各 implement→review；W1 一轮 fix（1 nit：changeset EOF）、W2 一轮 fix（3 warn + 1 nit：两处 referent 注释、缺 render 整体锚矩阵、EOF），**W3 零 finding**；分支终审 **0 finding**。交付与本文逐节对应：§2.1–§2.3 判别符渲染且 implement 不渲 · §2.5 A/B/C2/D 四句参照面 · §2.6 G/H/I/J/K 主体面五处（freeze/commit 自我限定、capability 点名四族、program-conformance 限 phase-spec、branch 改口 wave、rubric 槽 charter / phase author）。`TEMPLATE_PROMPT.$version` 20 → 23 · `pnpm run validate` exit 0（root 34 · kairos 96 · engine 1614 · typecheck ×3 · emit fresh · version-sync · 零裸函数）· changeset `cdd-engine` **minor** 单条 · 不发布。 | '[human] 裁定 · Claude（kairos:cdd-close · 2026-11-13）' |
