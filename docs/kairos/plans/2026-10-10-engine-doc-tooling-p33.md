---
title: 引擎文档工具（Engine Doc-Tooling）— P33 计划：dispatch prompt 判别符 + 参照面校准
doc-type: plan
version: v0.6
date: 2026-11-13
slug: 2026-10-10-engine-doc-tooling-p33
base: develop
---

## Constraints

- **逐字取 spec**：本计划只实现 `docs/kairos/specs/2026-10-10-engine-doc-tooling-p33-design.md` **现行 `version` v0.5** 所指的面；spec 版本一变，本约束的字面同笔改。
- **标题与标签行零字节**：`reviewRow` / `FIX_SHELL` / `DOCS_FIX_SHELL` 的首行标题一字不动；`**Criteria — …:**` 的**标签**与 `**Lens labels:**` 行零字节；而 criteria **体**可在 I/J/K 需要处改（改动对共享该体的变体一致）。§2.5 允许改的句子是 `REVIEW_ITEM`、`FIX_SHELL` 的 fix 句、`DOCS_FIX_SHELL` 的 docs-fix 句。
- **不动四模式词汇表**：`WORK_MODES`、`TEMPLATE_PROMPT.modes` 的表键、`#rowOf` 的行选择结构保持（D85 否决 ROLE 拆值）。
- **不新增门**：`#assertShellLayout` 只保留「名字 ⊆ layout」这一条结构校验，不引入名字↔所指的语义门（P28 同向）。
- **`TEMPLATE_PROMPT.$version` 20 → 21**：token 登记表与 round-context 面变更按既有惯例 bump；`render.test.ts` 的版本 pin 同步。
- **不改 `session/next.ts`**（D70 收敛主线），不改 `next:` 字面。
- changeset 只 `@oscaner-skills/cdd-engine` **minor**；不发布；波宽 ≤ 3；零模块级裸函数。
- **`LICENSE_ITEMS` 保持单一共享块**：不拆成按模式的 clause 集合（D87 的 α）；G/H 的修法是两句自我限定，不是按壳分家。

## Review Focus

- **注入按 `isReview` 分键的旧形残留**：写成 `isReview ? frame.type : ""` 就让 implement 注入 `wave` 并多渲一行——AC 的「implement 不含该行」直接红。键必须是 work-mode。
- **`#rowOf` 与注入面共用一个 token**：implement 注入空串后，若某个分支把空串当未知类型抛错，`#gate` 会在 implement 轮炸；空串必须仍满足「token 有值」。
- **共享句里的 `BASE_BRANCH` 被改成无条件引用**：非 branch 面该槽为空、行被丢——既有 pin（branch 渲出 `BASE_BRANCH`、spec / wave 面不渲）是本条的回归面；句子本身必须保留条件式（「the branch review judges … against `BASE_BRANCH`」）。
- **overall 面 `INPUT_SPEC` 置空后取错目标**：docs-fix 的「judged doc」若仍按 `INPUT_SPEC` 取路径，overall 的 docs-fix 会拿到空串或改错文件——overall 行的目标必须是 `INPUT_OVERALL`。
- **只改 pin 不改 prose**：`$version` 与 `REVIEW_TYPE` 的注释/报错文案若只改测试不改实现侧文案，模板契约的文件级说明与实际 token 表不符，下一轮改名会再踩一次。
- **自我限定写成反向收窄**：把 freeze 改成「任何轮都不得改」或把 capability 一起限定，会让 docs-fix 自己拒绝工作（本轮的全部工作就是原地改文档）。限定只能加在 freeze 一侧。
- **program-conformance 句限定过宽**：若把「phase-spec only」写成对整个 `spec` 体的限定，phase-spec 自己的 program conformance 也会被摘掉——限定必须只包住那一句。

---

### Task 1: 类型判别符 `TARGET_TYPE` 进 round context

#### Objective

把 `REVIEW_TYPE` 改名为 `TARGET_TYPE` 并渲染成 round context 的一行，位置紧跟 `ROLE`。注入按 work-mode 分键：implement 注入空串（该行由其 layout 不携带 + 空值丢行双重保证不出现），其余轮注入 `frame.type`。标题与判据行一字不动。

#### Files

- Modify: `packages/cdd-engine/src-next/render/templates.ts`（`TOKENS` 登记项改名，`zone` 保持 `round-context` · `REVIEW_CONTEXT` 与 `MODE_PROMPTS.fix` / `MODE_PROMPTS["docs-fix"]` 的 `roundContext` 各加一行 · `#rowOf` / `#reviewRow` / `#gate` 读 `values.TARGET_TYPE` · 两处报错文案与**六处**注释同改（:96 区说明、:499 `TOKENS` 的「supplied but never rendered」行、:604 / :643 / :675 / :730）· `$version` 20 → 21）
- Modify: `packages/cdd-engine/src-next/face/lifecycle.ts`（`#valuesOf` 的 `REVIEW_TYPE` 槽改 `TARGET_TYPE`，取值按 `#roleOf` 分键）
- Test: `packages/cdd-engine/src-next/render/__tests__/render.test.ts`（十二变体矩阵 + implement 缺席 + `$version` pin）
- Test: `packages/cdd-engine/src-next/face/__tests__/cli.test.ts`（四条注入面端到端）
- Test: `packages/cdd-engine/src-next/infra/__tests__/infra.test.ts`（:122 夹具注释里的 `REVIEW_TYPE` 同改——spec §3.2 把 infra 测试夹具算在改名面内）

#### Consumes

- `TemplateAssembler` 的 `#rowOf` / `#gate` / `#reviewRow` / `#contextLines`（`render/templates.ts`）
- `CliLifecycle#roleOf`（`face/lifecycle.ts`）——判别 work-mode 的既有单源
- `cli.test.ts` 既有的 `promptOf(argv)` 夹具

#### Produces

- `TOKENS` 项 `{ name: "TARGET_TYPE", zone: "round-context" }`（替下 `REVIEW_TYPE`；该 token 随 round context 渲染，与今日 `REVIEW_TYPE` 同区）
- round-context 行 `- \`TARGET_TYPE\`: {{TARGET_TYPE}}`，位置紧跟 `- \`ROLE\`: {{ROLE}}`，携带者 = `REVIEW_CONTEXT` + `MODE_PROMPTS.fix` + `MODE_PROMPTS["docs-fix"]`（`MODE_PROMPTS.implement` 不携）
- `#valuesOf` 的槽值 = `role === "implement" ? "" : frame.type`
- `TEMPLATE_PROMPT.$version` = 21

#### Steps

- 写失败测（十二变体矩阵）：在 `render.test.ts` 里对六型 review、两型 fix、四型 docs-fix 各渲一次，断言 `- \`TARGET_TYPE\`: 该型词` 在场且值等于传入的 `TARGET_TYPE` — checkable: 定向 vitest FAIL（今日无该行）
- 写失败测（implement 缺席）：`ROLE: "implement"` 的渲染结果不含 `TARGET_TYPE` — checkable: 定向 vitest FAIL
- 写失败测（注入面端到端，四条）：`promptOf(["review","--type","phase-spec","--spec",…])` 含 `- \`TARGET_TYPE\`: phase-spec`；`promptOf(["fix","--type","wave","--plan",…])` 含 `wave`；`promptOf(["fix","--type","plan","--plan",…])` 含 `plan`；`promptOf(["implement","--plan",…])` 不含 `TARGET_TYPE` — checkable: 四条各自 FAIL（今日注入空串或该行不存在）。**flag 判据**：`--type plan` 消费 `--plan`，`--spec` 只属 phase-spec / single-spec / overall 三个 spec 型——`#sceneOf` 的 plan/branch 分支在 `planPath` 为 null 时以 `cdd ${verb} --type ${type}: missing required --plan <path>` 硬拒，故 plan 线一律走 `--plan`（既有 pin `cli.test.ts:2626` 即此形）
- 在 `render/templates.ts` 改 token 登记与三处 round context（`REVIEW_CONTEXT` 与 fix / docs-fix 两个 `roundContext` 数组），并把 `#rowOf` / `#reviewRow` / `#gate` 的读取与两处报错文案切到 `TARGET_TYPE` — checkable: 矩阵测前端 PASS
- 在 `face/lifecycle.ts#valuesOf` 把槽改 `TARGET_TYPE`，取值 `role === "implement" ? "" : frame.type`（复用已解构的 `role`，不额外调用 `#roleOf`）— checkable: 四条注入面端到端 PASS
- 同笔把 `TEMPLATE_PROMPT.$version` 20 → 21，并把 `render.test.ts` 的版本 pin 与 `templates.ts` 头部 `$version` 纪事行改为 21 的说明（token 面变更）— checkable: 版本 pin PASS
- 零残留核查 — checkable: `grep -rn "REVIEW_TYPE" packages/cdd-engine/src-next` 零命中（含注释、测试夹具注释与报错文案——该 grep 的域就是 Acceptance 的零残留域）
- 全量回归 — checkable: `pnpm -C packages/cdd-engine exec vitest run` 与 `pnpm exec tsc --noEmit -p packages/cdd-engine` 均 exit 0
- 提交 — checkable: `git log -1 --oneline` 含本任务主题

#### Acceptance

- 六型 review、两型 fix、四型 docs-fix 的 dispatch prompt round context 均含 `- \`TARGET_TYPE\`: 该型词`，值等于 CLI `--type`。
- implement 的 prompt 不含该行。
- `REVIEW_TYPE` 在 `packages/cdd-engine/src-next` 零残留（含注释、测试夹具注释与报错文案）——与零残留核查步的 grep 同域。
- 三个壳的首行标题、`**Criteria — …:**` 行的标签与 `**Lens labels:**` 行三者均零字节变更。
- `$version` = 21；引擎 vitest 与 typecheck 全绿。

#### DependsOn

none

---

### Task 2: 参照面四处校准 + changeset

#### Objective

按 spec §2.5 校准四处参照面：`REVIEW_ITEM` 把 branch 从 plan review 拆出并补 overall 锚句；`FIX_SHELL` 的 `INPUT_SPEC` 子句改点名 branch 线并定性为参考；`DOCS_FIX_SHELL` 给 plan-doc 行的 `INPUT_SPEC` 定性并补 overall 行；`#valuesOf` 在 overall 面把 `INPUT_SPEC` 置空（C2）。收尾落 changeset。

#### Files

- Modify: `packages/cdd-engine/src-next/render/templates.ts`（`REVIEW_ITEM` · `FIX_SHELL` 的 fix 句 · `DOCS_FIX_SHELL` 的 docs-fix 句 · `REVIEW_CONTEXT` 的 doc 注释（:257-261 的参照面映射句））
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
- `REVIEW_CONTEXT` 的 doc 注释：映射句改写为 A/B/C2 之后的实况（wave → `INPUT_WAVE_BRIEF`；plan → `INPUT_PLAN` + `INPUT_SPEC` 参考；branch → 活的树对 `BASE_BRANCH` + `INPUT_PLAN` 参考；spec → `INPUT_SPEC`；overall → `INPUT_OVERALL`）
- `#valuesOf` 的 `INPUT_SPEC`：overall 面为空串（空值丢行 → 该面只剩 `INPUT_OVERALL` 一个 charter 锚）
- `.changeset/p33-prompt-discriminant-and-referents.md`：`@oscaner-skills/cdd-engine` **minor**

#### Steps

- 写失败测（三句字节 pin）：`render.test.ts` 断言 `REVIEW_ITEM` 含「the branch review judges the live tree」且不含「the plan/branch reviews judge the plan」；`FIX_SHELL` 的 fix 句不含「the spec line」且含「never the judged document」；docs-fix 句含「never edited here」与「`INPUT_OVERALL` on the overall line」 — checkable: 三条各自 FAIL
- 写失败测（overall 锚矩阵）：overall 的 review 与 docs-fix 两面渲染结果含 `- \`INPUT_OVERALL\`:` 且**不含** `- \`INPUT_SPEC\``；phase-spec / single-spec / plan / branch 四面仍含 `INPUT_SPEC` — checkable: 两面 FAIL（今日两面都带 INPUT_SPEC）
- 写失败测（端到端两条）：`promptOf(["review","--type","overall","--spec",…])` 与 `promptOf(["fix","--type","overall","--spec",…])` 均含 `INPUT_OVERALL` 路径且不含 `INPUT_SPEC` 行 — checkable: 两条 FAIL
- 改 `REVIEW_ITEM`（branch 单列 + overall 锚句 + 保留 `program:` 条件句）— checkable: 三句 pin 的第一条 PASS
- 改 `FIX_SHELL` 的 fix 句（删掉 spec line 子句，branch 线的 `INPUT_SPEC` 定性为参考）— checkable: 第二条 PASS
- 改 `DOCS_FIX_SHELL` 的 docs-fix 句（plan-doc 行的 `INPUT_SPEC` 定性 + 补 overall 行）— checkable: 第三条 PASS
- 改 `REVIEW_CONTEXT` 的 doc 注释：把「Each review type carries its own judged-doc referent（wave → `INPUT_WAVE_BRIEF`；plan/branch → `INPUT_PLAN`；spec → `INPUT_SPEC`）」改写成 A/B/C2 之后的映射（wave → `INPUT_WAVE_BRIEF`；plan → `INPUT_PLAN` + `INPUT_SPEC` 参考；branch → 活的树对 `BASE_BRANCH` + `INPUT_PLAN` 参考；spec → `INPUT_SPEC`；overall → `INPUT_OVERALL`），保留 `BASE_BRANCH` 与空值丢行两句 — checkable: `grep -c "plan/branch → \`INPUT_PLAN\`" packages/cdd-engine/src-next/render/templates.ts` = 0（旧映射句已无；`FIX_SHELL` / `REVIEW_ITEM` 里的 plan/branch 行指称按各自步骤改）
- 改 `#valuesOf` 的 `INPUT_SPEC`：在 doc 型兜底之前插入 `frame.type === "overall" ? "" :`，并把该槽的注释从「charter 的锚也是 spec」改写为 C2 的表述 — checkable: overall 锚矩阵与端到端两条 PASS
- 跑全类型矩阵回归，确认九张壳（六 review + 三 work）的首行标题、`**Criteria — …:**` 行的标签与 `**Lens labels:**` 行与 Task 1 后字节一致 — checkable: 定向 vitest PASS（标题/Criteria 标签/Lens 行字节 pin）
- 写 changeset `@oscaner-skills/cdd-engine` **minor** — checkable: `pnpm exec changeset status` 无 empty 条目
- 全量回归 — checkable: `pnpm -C packages/cdd-engine exec vitest run` · `pnpm -C packages/kairos exec vitest run` · `pnpm exec vitest run` · `pnpm exec tsc --noEmit -p packages/cdd-engine` · `-p packages/kairos/tests` · `-p scripts` 全 exit 0
- 提交 — checkable: `git log -1 --oneline` 含本任务主题
- 整门 validate（spec AC 的 `pnpm run validate` exit 0）— checkable: 提交后的干净树上 `pnpm run validate` exit 0，其构成 = `emit:check` · root vitest · kairos suite · engine suite · typecheck ×3 · `version-sync` · `check:no-bare-functions`（引擎黑盒 dispatch 测需干净树，故本步排在提交之后）

#### Acceptance

- `REVIEW_ITEM` 与 `REVIEWS.branch.axesGuide` 对 branch 的判定面一致（活的树 + 计划参考），二者不再互斥。
- `FIX_SHELL` 不再出现 spec line；branch 线的 `INPUT_SPEC` 被定性为参考。
- docs-fix 的 plan-doc 行明示 `INPUT_SPEC` 为不可编辑参考。
- overall 面 round context 只有一个 charter 锚且名为 `INPUT_OVERALL`；`INPUT_SPEC` 在该面为空（review 与 docs-fix 同判）。
- `REVIEW_CONTEXT` 的 doc 注释映射与 `REVIEW_ITEM` / `FIX_SHELL` / `DOCS_FIX_SHELL` 三句的参照面一致，不再出现 plan/branch 合写的旧映射。
- phase-spec / single-spec / plan / branch 四面参照面零回归。
- changeset `cdd-engine` minor 在册；三套 vitest + 三套 typecheck 全绿；提交后 `pnpm run validate` exit 0（含 `check:no-bare-functions` 与 `emit:check`）。

#### DependsOn

1

---

### Task 3: 主体面五处校准（G/H/I/J/K）

#### Objective

按 spec §2.6 校准共享主体五处：`cl:plan-freeze` 与 `cl:atomic-commit` 两句自我限定（限定到本轮声明的 capability 之外 / 明示只读轮无提交），program-conformance 句限定 phase-spec，branch 判据体换掉退役词 task，overall 的 rubric 槽改 charter / phase author。`LICENSE_ITEMS` 仍是单一共享块。

自限定以本轮声明的 capability 为界，故 **`WORK_CAPABILITY` 的措辞成为承重面**：它必须点名被判文档族本身（phase-spec / single-spec / overall charter / plan）——否则 overall 的 docs-fix 会落成「下令改 charter、冻结句却判它是 spec」。三句的对冲落在 implement / fix / docs-fix 三张 work 壳上，验证面须同时覆盖三张。

#### Files

- Modify: `packages/cdd-engine/src-next/render/templates.ts`（`CLAUSES` 的 `cl:plan-freeze` 与 `cl:atomic-commit` · `WORK_CAPABILITY` 点名被判文档族 · `docNarrativeAxes` 的 program-conformance 句 · `REVIEWS.branch.axesGuide` 首句 · `REVIEW_BODY_TEXT.overall` 两槽）
- Test: `packages/cdd-engine/src-next/render/__tests__/render.test.ts`（五条字节 pin + 三壳覆盖面）

#### Consumes

- Task 2 落地的 `REVIEW_ITEM` 与 docs-fix 句（同壳，需并读不冲突）
- `SEVERITY_RUBRIC` 与 `reviewGuideOf(key)`（`render/templates.ts`）——rubric 槽的唯一消费点
- `CLAUSES` 容器与 `{{> cl:…}}` 解析（`TemplateAssembler#fill`）

#### Produces

- `CLAUSES` 的 `cl:plan-freeze` = Approved plan/spec files are frozen **beyond the round's declared `capability: may.amend` scope** — without that declaration a needed change goes out through findings, never an in-place edit; the structure face is outside amending authority in every round.
- `CLAUSES` 的 `cl:atomic-commit` = 原句 + A read-only round has nothing to commit: its only writes are the prescribed `OUTPUT_*` artifacts, and committing belongs to the orchestrator.
- `WORK_CAPABILITY` 点名被判文档族 = phase-spec / single-spec / overall charter / plan（结构面禁令一字不动）
- `docNarrativeAxes` 的 program-conformance 句显式限定 phase-spec（single-spec 无 `program:`、无 `INPUT_OVERALL`，且不是 phase）
- `REVIEWS.branch.axesGuide` 首句 Same four axes as the wave review
- `REVIEW_BODY_TEXT.overall` = `{ artifact: "charter", audience: "phase author" }`

#### Steps

- 写失败测（五条字节 pin + 三壳覆盖面）：implement / fix / docs-fix 三张壳的 freeze 句含 beyond the round's declared 且不含 zero modification authority，三张壳的 capability 句**同时含 phase-spec / single-spec / overall charter / plan 四个族名**（逐一 substring，不是只断 overall charter）；review 渲染物的 commit 句含 has nothing to commit；single-spec 的 program-conformance 句含 phase-spec only；branch 的 Criteria 行含 Same four axes as the wave review 且不含 as task；overall 的渲染物含 The reviewed charter is a vision — checkable: 五组各自一 FAIL
- 改 `CLAUSES` 的 freeze 与 commit 两条（只改文案，不拆块）— checkable: freeze / commit 两组 PASS
- 改 `WORK_CAPABILITY`：把 the spec's and the plan's content face 改为点名被判文档族（phase-spec / single-spec / overall charter / plan），结构面禁令不动 — checkable: 三壳 capability pin（四个族名逐一定位）PASS
- 改 `docNarrativeAxes` 的 program-conformance 句（限定只包住这一句）— checkable: 第三条 PASS
- 改 `REVIEWS.branch.axesGuide` 首句 — checkable: 第四条 PASS
- 改 `REVIEW_BODY_TEXT.overall` 两槽 — checkable: 第五条 PASS
- 零残留核查 — checkable: `grep -rn "as task" packages/cdd-engine/src-next/render/templates.ts` 零命中；`grep -rn "zero modification authority" packages/cdd-engine/src-next` 零命中
- 收尾字节 pin（三行 × 九壳）：一圈回圈遍历六张 review 变体 + 三张 work 壳，逐面重断首行标题、`**Criteria — …:**` 的标签与 `**Lens labels:**` 行仍与 Task 1 / Task 2 后字节一致（criteria **体**可改，本轮改过体，故须重断标签与 Lens 行）— checkable: 定向 vitest PASS
- 全量回归 + 整门 validate — checkable: 三套 vitest · 三套 typecheck · `pnpm run validate` exit 0
- 提交 — checkable: `git log -1 --oneline` 含本任务主题

#### Acceptance

- 五组 pin（含三壳覆盖面与四个族名）全绿。
- 九张壳的标题 / Criteria 标签 / Lens 行在 T1–T3 三笔改动后仍字节一致（收尾 pin 覆盖 criteria 体被改的六张 review 变体）。
- 三张 work 壳（implement · fix · docs-fix）的 freeze / capability / 指令三句不再互斥：freeze 限定到声明范围之外，capability 点名四族（phase-spec / single-spec / overall charter / plan 全在）。
- review 壳的 commit 句与 `**Read-only:**` 不再对冲。
- single-spec 不再被要求对照 `INPUT_OVERALL`；phase-spec 的行为不变（program conformance 仍在）。
- `LICENSE_ITEMS` 仍是单一共享块（未拆成按模式的集合）。
- 退役词 task 在判据体零残留；`zero modification authority` 零残留。
- 三套 vitest + 三套 typecheck + `pnpm run validate` exit 0。

#### DependsOn

2

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-11-13 | P33 初稿：T1 类型判别符 `TARGET_TYPE` 进 round context（implement 不渲）· T2 参照面四处校准 A/B/C2/D + changeset。 | '[human] 裁定 · Claude（kairos:cdd-plan · 2026-11-13）' |
| v0.2 | 2026-11-13 | 并入 plan-review-1 全部三条：F1 `TARGET_TYPE` 的 `zone` 保持 `round-context`，撤掉登记项“移入 shell 区”的说法，与 Objective / spec §2.1 对齐；F2 T2 收尾补 `pnpm run validate` 整门步骤（提交后干净树）并同步进 Acceptance；F3 overall 锚矩阵补 single-spec 面，与 Acceptance 的四面表述对齐。 | '[human] 裁定 · Claude（kairos:cdd-plan · 2026-11-13）' |
| v0.3 | 2026-11-13 | 追加 T3：主体面五处校准（G/H/I/J/K · D87 · 修法取 α）· `DependsOn 2`；Constraints 增「`LICENSE_ITEMS` 单一共享块」；Review Focus 增两条（自我限定反向收窄、限定过宽摘掉 phase-spec 自己的判据）；spec 同步升至 v0.4。 | '[human] 裁定 · Claude（kairos:cdd-design · 2026-11-13）' |
| v0.4 | 2026-11-13 | 对齐 spec v0.5（phase-spec-review-2 的 F1/F3/F4）：Constraints 的冻结面从「Criteria 行」收窄为「标签 + Lens 行，体可改」；T3 增 `WORK_CAPABILITY` 点名被判文档族（承重面），验证面由 docs-fix 单面扩为 implement / fix / docs-fix 三壳。 | '[human] 裁定 · Claude（kairos:cdd-design · 2026-11-13）' |
| v0.5 | 2026-11-13 | 并入 plan-review-2 全部五条：F1 T1 端到端 pin 的 plan 线改为 `--plan`（`--type plan` 消费 `--plan`，`--spec` 只属三个 spec 型）；F2 T1 Files 补 `infra/__tests__/infra.test.ts`、注释计数改为六处并点名 `TOKENS` 的「supplied but never rendered」行，Acceptance 的零残留域展到 grep 全域；F3 T2 把 `REVIEW_CONTEXT` 的 doc 注释纳入改名面并改写 A/B/C2 后的映射；F4 字节 pin 从标题 + Criteria 展到 `**Lens labels:**` 行，T3 增九壳收尾 pin；F5 T3 capability pin 从 overall charter 展为四族名逐一断言。 | '[human] 裁定 · Claude（kairos:cdd-plan · 2026-11-13）' |
| v0.6 | 2026-11-13 | **closeout 登记（cdd-close）**：三任务全部交付——Task 1 `a9baeb13`（判别符 + 十二面矩阵 + 四条端到端）与 `8803e23a`（changeset EOF）· Task 2 `10d2f17b`（三句参照面 + C2 + 整体锚矩阵）与 `d4549028`（两处 referent 注释 + render 矩阵 + EOF）· Task 3 `bdf70aeb`（主体面五组 pin，该波零 finding）；编排器另落 `97a5d4ef`（三条 changeset 归并为一条）。计划与实现一致，无回填；任务 id 集与 `DependsOn` 图一字未动。`pnpm run validate` exit 0（root 34 · kairos 96 · engine 1614）。 | '[human] 裁定 · Claude（kairos:cdd-close · 2026-11-13）' |
