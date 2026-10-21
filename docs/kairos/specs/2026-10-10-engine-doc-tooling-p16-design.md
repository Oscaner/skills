---
title: 引擎文档工具（Engine Doc-Tooling）— P16 设计：评审面纪律补强（branch review 策略融入 prompt · 只读 / 单代理 / 三判定点）
doc-type: phase-spec
version: v0.2
date: 2026-10-21
slug: 2026-10-10-engine-doc-tooling-p16
program: 2026-10-10-engine-doc-tooling
status: Draft
author: "[human] · Claude Opus 5（kairos:cdd-design [P16] grilling → cdd-spec-writer · 2026-10-21）"
parent-version: v2.68
---

## Design

本 phase 承接 P15 §7 附录登记的「branch-review skill 调研（本 phase 不施工）」——那次只做了登记，没有施工。本轮把调研做实：盘点本地已装 skill 与权威评审指南的处方，按「可融入 / 冲突 / 已覆盖」三分类，只把**引擎现状缺、且不与引擎自有契约打架**的纪律录进评审 prompt。命题一句话：**评审纪律的单一文本面是引擎的 `REVIEW_ITEM` 与 `REVIEWS` 的分型轴行，不是所派发的 skill**。

### 1. 现状与缺口

#### 1.1 引擎评审 prompt 的文本面

四类评审（wave / branch / spec / plan）共用一套骨架（`render/templates.ts`）：

- `REVIEW_ITEM`（:223）—— 评审规则：读准则面、把 findings 写进 handoff 草稿、**结论由引擎从 findings 派生**（blocker → CHANGES_REQUESTED · warn/nit → REVIEW_FIX · 空 → APPROVED），评审者从不自报状态；
- 每类的 `REVIEWS` 分型轴行（:308-330，经 :333-340 引到各评审变体 :345-408）—— 判定轴与判定方法；
- findings 载体 schema（`session/handoff-schema.ts:47-59`）—— `severity ∈ {blocker, warn, nit}` + `lens`，`section` / `line` / `fix` 可选；
- 九条共享纪律 clause（`templates.ts:142-154` 的 `LICENSE_ITEMS` 块，九条 `{{> cl:…}}` 行在 :145-153）。

branch 面另外派发 `mattpocock-skills:code-review`（`face/host.ts:199`），该 skill 自带的 Fowler 坏味道基线与 Standards/Spec 双轴随之进场。

#### 1.2 缺口与冲突（调查证据）

调查面：superpowers 7.0.0（`requesting-code-review` 的 SKILL + `code-reviewer.md` · `receiving-code-review` · `finishing-a-development-branch`）· mattpocock-skills 1.3.1（`code-review` · `pr`）· [Google eng-practices 评审清单](https://google.github.io/eng-practices/review/reviewer/looking-for.html)，共 92 条处方。

- **缺口 A · 只读纪律零覆盖**：评审子代理没有任何约束禁止改工作树 / index / HEAD（`templates.ts` 内 `read-only` grep 零命中）。上游是硬纪律——"Review is read-only… never move HEAD on this checkout"。
- **缺口 B · 单代理纪律只在 wave 轴**：wave 轴尾有「Single agent, four axes.」，branch / spec / plan 三面无；而 branch 面派发的 mattpocock skill **硬性要求并行子代理**（Standards 与 Spec 各派一个）。同一份 prompt 里没有任何一处裁决谁说了算。
- **缺口 C · 三个判定点缺失**：四轴覆盖仓内规范（standards）· 计划符合度（spec）· 可构建证据（buildability）· 改动归因（scope），但不判**设计是否合理**（Google 称之为评审里最重要的一项）· **测试是否会因代码坏而红**（buildability 只证明「跑过了」）· **破坏性变更有无迁移路径**。
- **冲突 D · 版式 / 分级 / verdict 双真源**：上游的 Critical/Important/Minor · Strengths/Issues/Recommendations/Assessment 版式 · `Ready to merge?` verdict，与引擎的 `blocker/warn/nit` · findings 载体 · 引擎派生 verdict 各自表达同一件事——写入即第二真源。

### 2. 定案（D60）

#### 2.1 D60-1 只读纪律 → `REVIEW_ITEM`（四类评审共享）

一条硬纪律，语义三点：评审期间不得改 tracked 内容 / index / HEAD / 分支状态；历史只经 `git show` / `git diff` / `git log` 读；要看别的版本另开目录，不在这里移 HEAD。**落点理由**：只读是 review 模式的属性、不是某一类的属性；修复属于 fix 轮，review 面无写权。**边界**：条内点名两个豁免面——既定的 `OUTPUT_*` 草稿是评审唯一的写（评审必须能把 findings 写进 `OUTPUT_HANDOFF`，该路径落在 keep-out 的 `.kairos/` 下），提交归编排面；故共享 `cl:atomic-commit` 在评审面无适用对象（评审轮零 tracked 改动），两条硬指令的边界成文。

**文本（追加到 `REVIEW_ITEM`）**：

> **Read-only:** never mutate tracked content, the index, HEAD, or branch state — the prescribed `OUTPUT_*` artifacts are a review's only writes, and committing belongs to the orchestrator — read history through `git show` / `git diff` / `git log`, and inspect another revision in a separate directory rather than moving HEAD here; repairs belong to the fix round, never to a review.

#### 2.2 D60-2 单代理纪律 → `REVIEW_ITEM`，并收回 wave 轴重复句

一条硬纪律：评审者独自做完整评审，不为 diff 分片或第二意见派子代理；**该纪律压过所派发 skill 的并行子代理默认**。同时删除 `REVIEWS.wave.axesGuide` 尾部的「Single agent, four axes.」——单代理事实此后只有 `REVIEW_ITEM` 一处（一事实一处）。
**落点理由**：lens 与 findings 载体按「一条 finding 一个 lens」建模，多代理聚合会拆散判定权；上下文成本翻倍，而收益（互不污染）在四轴同源时并不成立。

**文本（追加到 `REVIEW_ITEM`）**：

> **Single agent:** do the whole review yourself — never spawn a subagent for part of the diff or for a second opinion; this overrides any dispatched skill's parallel-sub-agent default.

#### 2.3 D60-3 branch 轴三判定点（轴名不变）

在 `REVIEWS.branch.axesGuide` 现有四轴之后追加三个判定点，**不新增轴名、不改 lens 枚举**：

- **设计**：改动的结构是否贴合本仓、是否是解决计划所述问题的最简结构（过度设计是 finding，不是偏好）；
- **测试充分性**：这些测试在代码坏掉时会不会红（跑绿但不能变红的测试不是证据）；
- **迁移**：每一处破坏性变更是否给出未迁移消费者的迁移路径。

**落点理由**：三者都是 branch 级判断（wave 级由 spec 符合度与可构建证据覆盖），且都能挂在现有 standards / buildability / spec 三轴上表达，不引入第五轴。

**文本（追加到 `REVIEWS.branch.axesGuide`）**：

> Three things a green run cannot show you: design — does the changed structure fit this codebase and is it the simplest structure that solves the plan's problem (over-engineering is a finding, not a preference); test adequacy — would these tests fail if the code broke (a run that cannot go red is not evidence); migration — does every breaking change name the path a not-yet-migrated consumer takes.

#### 2.4 拒收与暂缓清单

| 上游处方 | 拒收理由 |
|---|---|
| `Ready to merge? Yes / No / With fixes` | 引擎从 findings 派生结论；finish 是 cdd-close 的人决策面（I3），机器 verdict 会与人的合并决定打架 |
| Critical / Important / Minor 分级、跨轴不重排 | 与 `blocker/warn/nit` + 引擎派生结论双真源 |
| 报告版式（Strengths / Issues / Recommendations / Assessment · 每轴分节 · 词数上限） | 与 findings 载体 schema 双真源 |
| Fowler 12 项坏味道基线 | branch 面派发的 skill 自带，prompt 复述即第二份 |
| 修复方接收纪律（先验证再改 · 不表演式认同…） | 属 fix shell 的文本面，不在本 phase |
| 证据具体性：每条 finding 强制 `line` / `section` / `fix` | **暂缓**——这三个字段在 schema 里保持可选：spec / plan 类评审的 finding 常常没有代码行号，强制会逼出假行号；branch 面如日后需要，在 branch 轴增量加，不动共享面。其中「不对未读代码发言」半句已由 scope 轴「自己跑 `git diff`」隐含覆盖，不另立 |

#### 2.5 版本与打包

- 模板契约 `TEMPLATE_PROMPT.$version` 12 → 13（`render/templates.ts:485` 的声明值；固定前缀文本变更即契约版本变更），并同步 :473-483 的版本叙事头注（补 v13 行——只读纪律 · 单代理纪律 · branch 轴三判定点）；
- changeset **cdd-engine minor**——prompt 行为面收紧，零 API / CLI 旗标 / 退出码 / skill ref 变化；
- kairos 无改动。

### Acceptance criteria

- `REVIEW_ITEM` 携带只读与单代理两条硬纪律；wave / branch / spec / plan 四类评审的固定前缀均含（pin 落 `infra/__tests__/infra.test.ts` 与 `render/__tests__/render.test.ts` 现有断言旁，逐句 `toContain`）。
- `REVIEWS.branch.axesGuide` 含设计 · 测试充分性 · 迁移三个判定点；`lensEnum` 仍为 `standards | spec | buildability`，轴名零变化；wave / spec / plan 三轴判定点零变化（现有断言 `infra/__tests__/infra.test.ts:123-128`——spec/plan 的 URC 判据 + `lensEnum`——保持绿）。
- 单代理事实只在 `REVIEW_ITEM` 一处：`REVIEWS.wave.axesGuide` 尾部不再含「Single agent」（同处新增断言 `expect(REVIEWS.wave.axesGuide).not.toContain("Single agent")`，与 :123-128 的 spec/plan 判据同块）。
- `TEMPLATE_PROMPT.$version === 13`（pin：`render/templates.ts:485` 的声明值）；:473-483 的版本叙事头注含 v13 行（只读纪律 · 单代理纪律 · branch 轴三判定点）。
- 冻结面零破：findings schema 字段与 severity 枚举不变 · 结论派生规则不变 · `DISPATCH.review.*` skill ref 不变 · CLI 旗标与退出码不变。
- `pnpm run validate` ALL PASS（引擎套件 · kairos suite · emit fresh · typecheck ×3 · 零裸函数）。
- changeset cdd-engine **minor** 在册，不发布。

## Constraints

- **一事实一处**：单代理纪律只在 `REVIEW_ITEM`；三个判定点只在 `REVIEWS.branch.axesGuide`；同一命题不进 `LICENSE_ITEMS` clause 面。
- **散文节制**：新增固定前缀文本总量 ≤ 4 句；句子承载判定动作，不写理由与方法论。
- **冻结面**：`session/handoff-schema.ts` · `contract/declare.ts` · `face/host.ts`（DISPATCH / REFS）· CLI 面零改。
- **零新依赖**。

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-10-21 | 初稿——P16 承接 P15 §7 附录调研：录三条（只读 · 单代理 · branch 三判定点）· 拒四条（merge verdict · 分级 · 版式 · Fowler 基线）；模板 `$version` 12 → 13；changeset cdd-engine minor | Oscaner M. · Claude（kairos:cdd-spec-writer [P16]）|
| v0.2 | 2026-10-21 | **spec-fix-1（review-1 findings 收口 · 2 warn + 2 nit）**：① warn——只读条划界：正文改为「不得改 tracked 内容 / index / HEAD / 分支状态」，点名既定 `OUTPUT_*` 草稿是评审唯一的写、提交归编排面，§2.1 补边界句说明共享 `cl:atomic-commit` 在评审面零适用对象（消除与 `REVIEW_ITEM` 草稿写、共享 clause 的两处正面对撞）；② warn——version pin 落地：§2.5 与 AC 点名 `render/templates.ts:485` 为 `$version` pin，并要求 :473-483 版本叙事头注补 v13 行；③ nit——wave/spec/plan 不变量的 pin 由 `infra.test.ts:141-142`（实为 wave/branch 的 dual evidence）改引 :123-128（spec/plan 的 URC 判据 + `lensEnum`），D60-2 删除另在同块新增 `not.toContain("Single agent")` 断言；④ nit——九条共享纪律 clause 的 pin 由 `templates.ts:138-150` 改引 `:142-154`（`LICENSE_ITEMS` 块，九条行 :145-153） | Oscaner M. · Claude（kairos:cdd-spec-writer [P16] spec-fix-1） |
