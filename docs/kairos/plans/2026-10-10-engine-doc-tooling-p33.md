---
title: 引擎文档工具（Engine Doc-Tooling）— P33 计划：dispatch prompt 判别符 + 参照面校准
doc-type: plan
version: v0.1
date: 2026-11-13
slug: 2026-10-10-engine-doc-tooling-p33
base: develop
---

## Constraints

- **逐字取 spec**：本计划只实现 `docs/kairos/specs/2026-10-10-engine-doc-tooling-p33-design.md` **现行 `version` v0.3** 所指的面；spec 版本一变，本约束的字面同笔改。
- **标题与判据行零字节**：`reviewRow` / `FIX_SHELL` / `DOCS_FIX_SHELL` 的首行标题一字不动；`**Criteria — …:**` 行一字不动。§2.5 允许改的只有 `REVIEW_ITEM`、`FIX_SHELL` 的 fix 句、`DOCS_FIX_SHELL` 的 docs-fix 句。
- **不动四模式词汇表**：`WORK_MODES`、`TEMPLATE_PROMPT.modes` 的表键、`#rowOf` 的行选择结构保持（D85 否决 ROLE 拆值）。
- **不新增门**：`#assertShellLayout` 只保留「名字 ⊆ layout」这一条结构校验，不引入名字↔所指的语义门（P28 同向）。
- **`TEMPLATE_PROMPT.$version` 20 → 21**：token 登记表与 round-context 面变更按既有惯例 bump；`render.test.ts` 的版本 pin 同步。
- **不改 `session/next.ts`**（D70 收敛主线），不改 `next:` 字面。
- changeset 只 `@oscaner-skills/cdd-engine` **minor**；不发布；波宽 ≤ 3；零模块级裸函数。

## Review Focus

- **注入按 `isReview` 分键的旧形残留**：写成 `isReview ? frame.type : ""` 就让 implement 注入 `wave` 并多渲一行——AC 的「implement 不含该行」直接红。键必须是 work-mode。
- **`#rowOf` 与注入面共用一个 token**：implement 注入空串后，若某个分支把空串当未知类型抛错，`#gate` 会在 implement 轮炸；空串必须仍满足「token 有值」。
- **共享句里的 `BASE_BRANCH` 被改成无条件引用**：非 branch 面该槽为空、行被丢——既有 pin（branch 渲出 `BASE_BRANCH`、spec / wave 面不渲）是本条的回归面；句子本身必须保留条件式（「the branch review judges … against `BASE_BRANCH`」）。
- **overall 面 `INPUT_SPEC` 置空后取错目标**：docs-fix 的「judged doc」若仍按 `INPUT_SPEC` 取路径，overall 的 docs-fix 会拿到空串或改错文件——overall 行的目标必须是 `INPUT_OVERALL`。
- **只改 pin 不改 prose**：`$version` 与 `REVIEW_TYPE` 的注释/报错文案若只改测试不改实现侧文案，模板契约的文件级说明与实际 token 表不符，下一轮改名会再踩一次。

---

### Task 1: 类型判别符 `TARGET_TYPE` 进 round context

#### Objective

把 `REVIEW_TYPE` 改名为 `TARGET_TYPE` 并渲染成 round context 的一行，位置紧跟 `ROLE`。注入按 work-mode 分键：implement 注入空串（该行由其 layout 不携带 + 空值丢行双重保证不出现），其余轮注入 `frame.type`。标题与判据行一字不动。

#### Files

- Modify: `packages/cdd-engine/src-next/render/templates.ts`（`TOKENS` 登记项改名并移入 shell 区 · `REVIEW_CONTEXT` 与 `MODE_PROMPTS.fix` / `MODE_PROMPTS["docs-fix"]` 的 `roundContext` 各加一行 · `#rowOf` / `#reviewRow` / `#gate` 读 `values.TARGET_TYPE` · 两处报错文案与三处注释同改 · `$version` 20 → 21）
- Modify: `packages/cdd-engine/src-next/face/lifecycle.ts`（`#valuesOf` 的 `REVIEW_TYPE` 槽改 `TARGET_TYPE`，取值按 `#roleOf` 分键）
- Test: `packages/cdd-engine/src-next/render/__tests__/render.test.ts`（十二变体矩阵 + implement 缺席 + `$version` pin）
- Test: `packages/cdd-engine/src-next/face/__tests__/cli.test.ts`（四条注入面端到端）

#### Consumes

- `TemplateAssembler` 的 `#rowOf` / `#gate` / `#reviewRow` / `#contextLines`（`render/templates.ts`）
- `CliLifecycle#roleOf`（`face/lifecycle.ts`）——判别 work-mode 的既有单源
- `cli.test.ts` 既有的 `promptOf(argv)` 夹具

#### Produces

- `TOKENS` 项 `{ name: "TARGET_TYPE", zone: "shell" }`（替下 `REVIEW_TYPE`）
- round-context 行 `- \`TARGET_TYPE\`: {{TARGET_TYPE}}`，位置紧跟 `- \`ROLE\`: {{ROLE}}`，携带者 = `REVIEW_CONTEXT` + `MODE_PROMPTS.fix` + `MODE_PROMPTS["docs-fix"]`（`MODE_PROMPTS.implement` 不携）
- `#valuesOf` 的槽值 = `role === "implement" ? "" : frame.type`
- `TEMPLATE_PROMPT.$version` = 21

#### Steps

- 写失败测（十二变体矩阵）：在 `render.test.ts` 里对六型 review、两型 fix、四型 docs-fix 各渲一次，断言 `- \`TARGET_TYPE\`: 该型词` 在场且值等于传入的 `TARGET_TYPE` — checkable: 定向 vitest FAIL（今日无该行）
- 写失败测（implement 缺席）：`ROLE: "implement"` 的渲染结果不含 `TARGET_TYPE` — checkable: 定向 vitest FAIL
- 写失败测（注入面端到端，四条）：`promptOf(["review","--type","phase-spec","--spec",…])` 含 `- \`TARGET_TYPE\`: phase-spec`；`promptOf(["fix","--type","wave","--plan",…])` 含 `wave`；`promptOf(["fix","--type","plan","--spec",…])` 含 `plan`；`promptOf(["implement","--plan",…])` 不含 `TARGET_TYPE` — checkable: 四条各自 FAIL（今日注入空串或该行不存在）
- 在 `render/templates.ts` 改 token 登记与三处 round context（`REVIEW_CONTEXT` 与 fix / docs-fix 两个 `roundContext` 数组），并把 `#rowOf` / `#reviewRow` / `#gate` 的读取与两处报错文案切到 `TARGET_TYPE` — checkable: 矩阵测前端 PASS
- 在 `face/lifecycle.ts#valuesOf` 把槽改 `TARGET_TYPE`，取值 `role === "implement" ? "" : frame.type`（复用已解构的 `role`，不额外调用 `#roleOf`）— checkable: 四条注入面端到端 PASS
- 同笔把 `TEMPLATE_PROMPT.$version` 20 → 21，并把 `render.test.ts` 的版本 pin 与 `templates.ts` 头部 `$version` 纪事行改为 21 的说明（token 面变更）— checkable: 版本 pin PASS
- 零残留核查 — checkable: `grep -rn "REVIEW_TYPE" packages/cdd-engine/src-next` 零命中（含注释与报错文案）
- 全量回归 — checkable: `pnpm -C packages/cdd-engine exec vitest run` 与 `pnpm exec tsc --noEmit -p packages/cdd-engine` 均 exit 0
- 提交 — checkable: `git log -1 --oneline` 含本任务主题

#### Acceptance

- 六型 review、两型 fix、四型 docs-fix 的 dispatch prompt round context 均含 `- \`TARGET_TYPE\`: 该型词`，值等于 CLI `--type`。
- implement 的 prompt 不含该行。
- `REVIEW_TYPE` 在 `render/templates.ts` 与 `face/lifecycle.ts` 零残留（含注释与报错文案）。
- 三个壳的首行标题与 `**Criteria — …:**` 行零字节变更。
- `$version` = 21；引擎 vitest 与 typecheck 全绿。

#### DependsOn

none

---

### Task 2: 参照面四处校准 + changeset

#### Objective

按 spec §2.5 校准四处参照面：`REVIEW_ITEM` 把 branch 从 plan review 拆出并补 overall 锚句；`FIX_SHELL` 的 `INPUT_SPEC` 子句改点名 branch 线并定性为参考；`DOCS_FIX_SHELL` 给 plan-doc 行的 `INPUT_SPEC` 定性并补 overall 行；`#valuesOf` 在 overall 面把 `INPUT_SPEC` 置空（C2）。收尾落 changeset。

#### Files

- Modify: `packages/cdd-engine/src-next/render/templates.ts`（`REVIEW_ITEM` · `FIX_SHELL` 的 fix 句 · `DOCS_FIX_SHELL` 的 docs-fix 句）
- Modify: `packages/cdd-engine/src-next/face/lifecycle.ts`（`#valuesOf` 的 `INPUT_SPEC` 在 overall 面置空 · 相邻注释同改）
- Test: `packages/cdd-engine/src-next/render/__tests__/render.test.ts`（三句的字节 pin + overall 锚矩阵）
- Test: `packages/cdd-engine/src-next/face/__tests__/cli.test.ts`（overall review / overall docs-fix 两条端到端）
- Create: `.changeset/p33-prompt-discriminant-and-referents.md`

#### Consumes

- Task 1 落地的 `TARGET_TYPE` 行与 `#valuesOf` 槽结构
- `REVIEWS.branch.axesGuide`（`render/templates.ts`）——branch 判定面的既有单源
- `#valuesOf` 的 `INPUT_OVERALL` 分键（overall 面已取 `docPath`）

#### Produces

- `REVIEW_ITEM` 的参照面句：wave → `INPUT_WAVE_BRIEF`；plan → `INPUT_PLAN`；branch → 活的树对 `BASE_BRANCH`、`INPUT_PLAN` 为其 plan-conformance 参考；spec → `INPUT_SPEC`；overall → `INPUT_OVERALL`；`program:` 带来的父 charter 条件句保留
- `FIX_SHELL` 的 fix 句：wave 线带 `INPUT_WAVE_BRIEF`；branch 线带 `INPUT_PLAN`（计划文档）与 `INPUT_SPEC`（设计 spec，conformance 参考、永不判对象），不再出现 spec line
- `DOCS_FIX_SHELL` 的 docs-fix 句：plan-doc 行的 `INPUT_SPEC` 定性为不可在本轮编辑的参考；补 `INPUT_OVERALL` on the overall line
- `#valuesOf` 的 `INPUT_SPEC`：overall 面为空串（空值丢行 → 该面只剩 `INPUT_OVERALL` 一个 charter 锚）
- `.changeset/p33-prompt-discriminant-and-referents.md`：`@oscaner-skills/cdd-engine` **minor**

#### Steps

- 写失败测（三句字节 pin）：`render.test.ts` 断言 `REVIEW_ITEM` 含「the branch review judges the live tree」且不含「the plan/branch reviews judge the plan」；`FIX_SHELL` 的 fix 句不含「the spec line」且含「never the judged document」；docs-fix 句含「never edited here」与「`INPUT_OVERALL` on the overall line」 — checkable: 三条各自 FAIL
- 写失败测（overall 锚矩阵）：overall 的 review 与 docs-fix 两面渲染结果含 `- \`INPUT_OVERALL\`:` 且**不含** `- \`INPUT_SPEC\``；phase-spec / plan / branch 三面仍含 `INPUT_SPEC` — checkable: 两面 FAIL（今日两面都带 INPUT_SPEC）
- 写失败测（端到端两条）：`promptOf(["review","--type","overall","--spec",…])` 与 `promptOf(["fix","--type","overall","--spec",…])` 均含 `INPUT_OVERALL` 路径且不含 `INPUT_SPEC` 行 — checkable: 两条 FAIL
- 改 `REVIEW_ITEM`（branch 单列 + overall 锚句 + 保留 `program:` 条件句）— checkable: 三句 pin 的第一条 PASS
- 改 `FIX_SHELL` 的 fix 句（删掉 spec line 子句，branch 线的 `INPUT_SPEC` 定性为参考）— checkable: 第二条 PASS
- 改 `DOCS_FIX_SHELL` 的 docs-fix 句（plan-doc 行的 `INPUT_SPEC` 定性 + 补 overall 行）— checkable: 第三条 PASS
- 改 `#valuesOf` 的 `INPUT_SPEC`：在 doc 型兜底之前插入 `frame.type === "overall" ? "" :`，并把该槽的注释从「charter 的锚也是 spec」改写为 C2 的表述 — checkable: overall 锚矩阵与端到端两条 PASS
- 跑全类型矩阵回归，确认六 shell 的首行标题与 `**Criteria — …:**` 行与 Task 1 后字节一致 — checkable: 定向 vitest PASS（标题/Criteria 字节 pin）
- 写 changeset `@oscaner-skills/cdd-engine` **minor** — checkable: `pnpm exec changeset status` 无 empty 条目
- 全量回归 — checkable: `pnpm -C packages/cdd-engine exec vitest run` · `pnpm -C packages/kairos exec vitest run` · `pnpm exec vitest run` · `pnpm exec tsc --noEmit -p packages/cdd-engine` · `-p packages/kairos/tests` · `-p scripts` 全 exit 0
- 提交 — checkable: `git log -1 --oneline` 含本任务主题

#### Acceptance

- `REVIEW_ITEM` 与 `REVIEWS.branch.axesGuide` 对 branch 的判定面一致（活的树 + 计划参考），二者不再互斥。
- `FIX_SHELL` 不再出现 spec line；branch 线的 `INPUT_SPEC` 被定性为参考。
- docs-fix 的 plan-doc 行明示 `INPUT_SPEC` 为不可编辑参考。
- overall 面 round context 只有一个 charter 锚且名为 `INPUT_OVERALL`；`INPUT_SPEC` 在该面为空（review 与 docs-fix 同判）。
- phase-spec / single-spec / plan / branch 四面参照面零回归。
- changeset `cdd-engine` minor 在册；三套 vitest + 三套 typecheck 全绿。

#### DependsOn

1

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-11-13 | P33 初稿：T1 类型判别符 `TARGET_TYPE` 进 round context（implement 不渲）· T2 参照面四处校准 A/B/C2/D + changeset。 | '[human] 裁定 · Claude（kairos:cdd-plan · 2026-11-13）' |
