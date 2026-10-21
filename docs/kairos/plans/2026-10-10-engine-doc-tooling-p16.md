---
title: 引擎文档工具（Engine Doc-Tooling）— P16 实施计划：评审面纪律补强（只读 · 单代理 · branch 轴三判定点融入评审 prompt）
doc-type: plan
version: v0.1
date: 2026-10-21
slug: 2026-10-10-engine-doc-tooling-p16
base: develop
---

## Constraints

- 七前提整评：破坏性许可（本 phase 用不上，面本身小）；OOP 统一、零裸函数（本变更只动模板数据面的常量字面量，零新增函数）；**一事实一处**——单代理事实只在 `REVIEW_ITEM`，三判定点只在 `REVIEWS.branch.axesGuide`，同一命题不进 `LICENSE_ITEMS` clause 面；散文节制——新增固定前缀句总量 ≤ 4 句，句子承载判定动作、不写理由与方法论；死码随改清理（wave 轴尾重复句即删除，不留注释空壳）；消费者只感「评审 prompt 更严」，引擎内部无 API 面外露；能收敛到既有面则不做平行子系统；不造轮子（零新依赖）。
- **文本逐字取 spec**：三条英文句的唯一来源是 `docs/kairos/specs/2026-10-10-engine-doc-tooling-p16-design.md` v0.2 的 §2.1 / §2.2 / §2.3 引用块——实现期只允许逐字落盘，不得改写措辞、不得删句内子句（`tracked content` / `OUTPUT_*` / `overrides any dispatched skill's parallel-sub-agent default` / `Three things a green run cannot show you` 为必达 token）。
- **冻结面零破**：`session/handoff-schema.ts`（findings 字段与 severity 枚举）· 结论派生规则（blocker → CHANGES_REQUESTED · warn/nit → REVIEW_FIX · 空 → APPROVED）· `face/host.ts`（`DISPATCH.review.*` / `REFS`）· CLI 旗标与退出码表 · `contract/declare.ts` —— 全部零改。
- **契约版本随文本走**：固定前缀文本变更即模板契约变更，`TEMPLATE_PROMPT.$version` 12 → 13 与文本同一次提交落地，不留「文本已改、版本仍 12」的中间态。
- 引擎调用一律本地 `node packages/cdd-engine/src-next/bin.ts`；本计划为内部文档中文主源（Strategy B）；不发布，changeset 收尾到可发布态即止。

### Task 1: 评审面三条纪律文本 + 契约版本 13 + 断言
- **Objective**: `REVIEW_ITEM` 追加「只读」「单代理」两条硬纪律（四类评审共用同一常量，固定前缀自然同源）；`REVIEWS.wave.axesGuide` 尾句 `Single agent, four axes.` 删除；`REVIEWS.branch.axesGuide` 追加三判定点句（设计 / 测试充分性 / 迁移）；`TEMPLATE_PROMPT.$version` 12 → 13 并补版本叙事头注的 v13 行；断言落在 infra 与 render 两个既有用例旁。
- **Files**: Modify `packages/cdd-engine/src-next/render/templates.ts`（`REVIEW_ITEM` :223 · `REVIEWS.wave.axesGuide` :312 尾 · `REVIEWS.branch.axesGuide` :315 尾 · `TEMPLATE_PROMPT.$version` :485 · 版本叙事头注 :477-483）；Test `packages/cdd-engine/src-next/infra/__tests__/infra.test.ts`（:118-143 的 P5 判据用例）· `packages/cdd-engine/src-next/render/__tests__/render.test.ts`（:229-328 的 review-mode 用例）。
- **Consumes**: phase-spec v0.2 §2.1 / §2.2 / §2.3 的三条英文句（逐字）；`REVIEW_VARIANTS` 四个变体已共享 `REVIEW_ITEM` 的组装路径（零改即可四腿同源）。
- **Produces**: 四类评审固定前缀均含 `**Read-only:**` 与 `**Single agent:**` 两句；`REVIEWS.branch.axesGuide` 含 `Three things a green run cannot show you` 及其三个判定点；`REVIEWS.wave.axesGuide` 不含 `Single agent`；`TEMPLATE_PROMPT.$version === 13`；头注含 v13 行。Task 2 不再改源码。
- **Steps**:
  - 写失败断言（infra 面）：在 :141-143 的 dual-evidence 断言块内补 `expect(REVIEWS.wave.axesGuide).not.toContain("Single agent")` 与 `expect(REVIEWS.branch.axesGuide).toContain("Three things a green run cannot show you")`，并逐判定点 pin `design —` / `test adequacy —` / `migration —` — checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/infra/__tests__/infra.test.ts` 现状失败（`Single agent` 仍在 wave 轴、branch 轴无新句）
  - 写失败断言（render 面）：在 review-mode 用例中对 spec / wave / branch / plan 四腿各断言固定前缀含 `**Read-only:**` 与 `**Single agent:**`（wave 腿断言 `toContain("never spawn a subagent")`），并新增 `expect(TEMPLATE_PROMPT.$version).toBe(13)` — checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/render/__tests__/render.test.ts` 现状失败
  - 改 `REVIEW_ITEM`：在 `— a review never declares its own status.` 之后追加 spec §2.1 与 §2.2 两句（句间一个空格，逐字） — checkable: render 四腿的两条纪律断言转绿
  - 删 `REVIEWS.wave.axesGuide` 尾句 ` Single agent, four axes.`（连同其前一空格），并在 `REVIEWS.branch.axesGuide` 尾追加 spec §2.3 那句（前接一个空格） — checkable: infra 新断言转绿；`grep -c "Single agent" packages/cdd-engine/src-next/render/templates.ts` 输出 `1`（仅 `REVIEW_ITEM` 一处）
  - `TEMPLATE_PROMPT.$version` 12 → 13，并在 :477-483 的版本叙事头注补一行 v13 摘要（只读纪律 · 单代理纪律 · branch 轴三判定点），保持既有「倒序逐版」行文 — checkable: `$version === 13` 断言绿；`sed -n '473,486p'` 可见 v13 行且行文与 v12 行同构
  - 跑引擎套件 — checkable: `pnpm -C packages/cdd-engine test` 全绿
  - 提交（`feat(cdd-engine): 评审面纪律补强——只读/单代理硬纪律 + branch 轴三判定点（$version 12→13）`） — checkable: `git log --oneline -1` 单原子提交，diff 只含上述两源码面 + 两测试文件
- **Acceptance**: 四类评审固定前缀均含只读与单代理两句（逐句 `toContain` 在册）；branch 轴含三判定点且 `lensEnum` 仍为 `standards | spec | buildability`、轴名零变化；wave 轴尾无「Single agent」；`$version` = 13 且头注含 v13 行；spec/plan 轴判据（:123-128）保持不变且全绿；冻结面零改（`git diff --name-only` 对 `session/handoff-schema.ts` / `contract/declare.ts` / `face/host.ts` 零命中）。
- **DependsOn**: none

### Task 2: changeset + 全量验证
- **Objective**: changeset 以 cdd-engine **minor** 在册，摘要覆盖三条纪律与 `$version` 13；`pnpm run validate` ALL PASS；分支改动面自证可归因（零未声明文件）。
- **Files**: Create `.changeset/p16-review-discipline.md`；零源码改动。
- **Consumes**: Task 1 落地的行为面与 `$version` 13。
- **Produces**: 在册 changeset（不发布）；validate 全绿的证据。
- **Steps**:
  - 写 changeset：front-matter `"@oscaner-skills/cdd-engine": minor`，正文英文摘要点明（a）review 壳新增只读与单代理两条硬纪律、（b）branch 轴新增设计 / 测试充分性 / 迁移三判定点、（c）模板契约 `$version` 13 — checkable: 文件存在、bump 行为 minor、正文三项零遗漏
  - 归因核对：`git diff --name-only origin/develop...HEAD` 仅含 `packages/cdd-engine/src-next/render/templates.ts` · 两个测试文件 · 本 changeset · P16 spec/plan 两篇 — checkable: 输出逐行落在该集合内，`session/handoff-schema.ts` / `contract/declare.ts` / `face/host.ts` / CLI 入口零命中
  - 跑全量验证 — checkable: `pnpm run validate` ALL PASS（emit fresh · 引擎套件 · kairos suite · typecheck ×3 · version-sync · 零裸函数）
  - 提交（`chore(cdd-engine): P16 changeset——评审面纪律补强（minor）`） — checkable: `git log --oneline -1` 单原子提交，diff 只含 changeset 文件
- **Acceptance**: changeset cdd-engine minor 在册且不发布；`pnpm run validate` ALL PASS；分支改动面 100% 可归因。
- **DependsOn**: 1

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-10-21 | 初稿——两任务两波：T1 评审面三条纪律文本 + `$version` 12→13 + infra/render 双面断言；T2 changeset minor + 全量验证 + 归因核对。文本逐字取自 phase-spec v0.2 §2.1–§2.3，冻结面零改 | Oscaner M. · Claude（kairos:cdd-plan [P16]）|