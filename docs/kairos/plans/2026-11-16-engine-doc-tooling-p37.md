---
title: '引擎文档工具（Engine Doc-Tooling）— P37 计划：分级判据的可核化（功能影响 · 三级边界 · 生成式注册表 · pin 门）'
doc-type: plan
version: v0.1
date: 2026-11-16
slug: 2026-11-16-engine-doc-tooling-p37
base: develop
---

## Constraints

- **逐字取 spec**：本计划只实现 `docs/kairos/specs/2026-11-16-engine-doc-tooling-p37-design.md`（slug `2026-11-16-engine-doc-tooling-p37`）在本轮被消费那一刻的 `version:` 所指的面。本 bullet 只记「哪一节落在哪个任务」，**不记版本坐标**——spec 再升一版也不需要改这一行；本计划实际消费的是哪一版，记在 `## Change history` 里本轮那一行。落点：§1 + §6.1 判据表半边归 T1 · §3 + §6.1 lens 问句半边 + §3.2 归 T2 · §2 全节归 T3 · §4 归 T4 · §5 归 T5 · §7 + §2.3 的第三消费者归 T6。
- **OOP / 零裸函数**：`src-next` 新增文件一律 class 或 `const` 箭头；参数 ≤4；类 ≤200 行；接口先行、协作者构造注入。注册表仿 `contract/completion-criterion.ts` 的 `of(id)` 查不到即抛。
- **pin 写法**：路径 + 符号，不用行号。本计划自身遵守。
- **非目标**：不改 D70 · 不改「任何 findings → fix」路由 · 不重审已闭合相位 · 不动 `packages/kairos/skills` · 不做 docs 全量校验 · 不引入 `impact.kind`（v0.3 ruling 已删）。
- **changeset**：`cdd-engine` **minor**（T6 末交付）；kairos 无。

### Task 1: 判据表 + `SEVERITY_RUBRIC` 生成式装配

#### Objective

落地 §1 的三级边界与 §6.1 判据表半边：判据正文进注册表，`SEVERITY_RUBRIC` 由行按 `body → duty → counterExample` 恒序装配；缺行即抛。标定尾段（同档一致 · 视觉句 · 设而不用 · 致谢）仍由 `reviewGuideOf` 承接，不进判据表。

#### Files

- Create: `packages/cdd-engine/src-next/contract/review-criteria.ts`
- Create: `packages/cdd-engine/src-next/contract/__tests__/review-criteria.test.ts`
- Modify: `packages/cdd-engine/src-next/render/templates.ts`（`SEVERITY_RUBRIC` 改为装配产物）
- Modify: `packages/cdd-engine/src-next/render/__tests__/templates.test.ts`（重锚 rubric 字节 pin）

#### Consumes

none

#### Produces

- `CriteriaRegistry`（或等价类名）· `CRITERIA.of(id: string): CriteriaRow`（查不到即抛）· `CRITERIA.renderRubric(): string`
- `CriteriaRow = { id, tier: "blocker"|"warn"|"nit", body, duty, counterExample, face: "gate"|"test"|"numbered" }`
- 三档各 ≥1 行；blocker 行覆盖功能影响边界 + 场景举证 + 「条款被违反但字节不变 ⇒ warn」反例；warn / nit 行各覆盖其边界 / 举证 / 反例（§1.1–§1.3）

#### Steps

- 写失败测试：`CRITERIA.of("missing")` 抛；完整表装配出的字符串含每档 `duty` 与 `counterExample` 原文；删掉某档 `counterExample` 后装配抛且该句从渲染字节消失 — checkable: 红于「of / renderRubric 未定义」
- 实现 `contract/review-criteria.ts`：判据表 + `of` + `renderRubric`（装配公式：每行 `body + " " + duty + " " + counterExample`，同 tier 相邻，段序 blocker → warn → nit）— checkable: 上面三条测试绿
- 改 `render/templates.ts`：`SEVERITY_RUBRIC` 改为 `CRITERIA.renderRubric()` 的返回值（或由其填充档位主体，尾段仍拼接 `reviewGuideOf` 既有契约）；(a)–(d) 降为 blocker 档 `body` 内的典型实例，不再是独立触发器 — checkable: `templates.test.ts` 的 rubric 锚点重锚后绿；`(severity by your judgment)` 仍在（T2 删）
- 提交 — checkable: `git log -1 --oneline` 含本任务主题

#### Acceptance

AC ① 的判据表半边：三档边界 / 举证 / 反例进字节；缺行装配即抛；`duty` / `counterExample` 删掉即从渲染字节消失。

#### DependsOn

none

### Task 2: lens 问句表 + axesGuide 投影

#### Objective

落地 §3 与 §6.1 lens 半边：19 格问句进第二张表；删两处 `(severity by your judgment)`；wave / branch `lensEnum` 补 `scope`；每类 review 的 `axesGuide` 末尾接编号问句清单。

#### Files

- Modify: `packages/cdd-engine/src-next/contract/review-criteria.ts`（加 `LENS_QUESTIONS`）
- Modify: `packages/cdd-engine/src-next/contract/__tests__/review-criteria.test.ts`
- Modify: `packages/cdd-engine/src-next/render/templates.ts`（`REVIEWS.*.lensEnum` / `axesGuide`）
- Modify: `packages/cdd-engine/src-next/render/__tests__/templates.test.ts`

#### Consumes

- T1 的 `contract/review-criteria.ts` 模块骨架与「未登记即抛」形态

#### Produces

- `LensQuestionRow = { id, reviewKind, lens, question, face: "numbered" }`
- `LENS_QUESTIONS.of(reviewKind, lens)` / `forReviewKind(reviewKind)`（查不到即抛）
- 物理行 15 · 逻辑格 19（wave/branch 四格共享 id 双引用）

#### Steps

- 写失败测试：19 格齐全；把问句塞进判据表或把判据行塞进问句表 ⇒ 查表抛；`REVIEWS.wave.axesGuide` 含 4 条编号问句且零 `(severity by your judgment)`；`lensEnum` 含 `scope` — checkable: 红
- 实现 lens 问句表（§3.1 十九句原文入表）+ `forReviewKind` 投影辅助 — checkable: 计数与查表测试绿
- 改 `REVIEWS`：wave/branch 删 judgment 逃逸口、补 `scope`；五类 `axesGuide` 末尾追加 `LENS_QUESTIONS.forReviewKind` 渲染的 `1. …` 清单 — checkable: 投影 pin 绿（wave/branch 各 4 · plan/spec 各 3 · overall 5；wave 与 branch 问句字节同源）
- 提交 — checkable: commit 存在

#### Acceptance

AC ③：零 `(severity by your judgment)`；问句投影进 `**Criteria —` 行；两表分开计数；混表即抛。

#### DependsOn

1

### Task 3: `impact` / `regrade` / `contract` 字段 + `gradingViolations`

#### Objective

落地 §2：`FINDING` 增可选 `impact`（`scenario` + 可选 `test`）、`regrade`、`contract`；纯助手 `gradingViolations` 判 blocker 缺场景；交接单回读面打出 `CDD_BLOCKED: grading-impact-missing`；`rollup` 返回类型不变。

#### Files

- Modify: `packages/cdd-engine/src-next/session/handoff-schema.ts`
- Modify: `packages/cdd-engine/src-next/session/__tests__/handoff-schema.test.ts`
- Modify: `packages/cdd-engine/src-next/face/lifecycle.ts`（回读面调用谓词）
- Modify: `packages/cdd-engine/src-next/face/__tests__/…`（覆盖 `grading-impact-missing` 报文的既有 lifecycle / cli 测试面；若无专用文件则落在现读回拒绝面所在测试）

#### Consumes

none

#### Produces

- `HandoffSchema.gradingViolations(findings): readonly { id?: string; summary?: string }[]`
- 失败面字节：`CDD_BLOCKED: grading-impact-missing` + 违规 `id` / `summary` 全列

#### Steps

- 写失败测试：blocker 无 `impact.scenario` ⇒ `gradingViolations` 非空；有场景 ⇒ 空；warn/nit 无场景 ⇒ 空；回读面报文含 `grading-impact-missing` 与全部违规 id — checkable: 红
- 扩 `FINDING` properties：`impact`（object · `scenario` string · 可选 `test` string）、`regrade` string、`contract`（object · `path` + `anchor` string）；实现 `gradingViolations`；`rollup` 不调用它 — checkable: schema / 谓词测试绿
- 在 `#reconstruct` → `#reject` 路径调用谓词（与其它 schema 拒绝同路），多条全列 — checkable: 回读拒绝测试绿
- 提交 — checkable: commit 存在

#### Acceptance

AC ②：成对 pin；拒绝面只有回读这一处；`rollup` 仍回 `RoundStatus`。

#### DependsOn

none

### Task 4: wave review 注入 `INPUT_SPEC` + `INPUT_OVERALL`

#### Objective

落地 §4：wave 与 branch 对齐——解析到身份文档与其 `program:` ⇒ 两 token 均出现且路径仓根相对可读；缺席或 `invalid` ⇒ 两 token 均不出现；branch 字节不变。

#### Files

- Modify: `packages/cdd-engine/src-next/face/cli.ts`（`#sceneOf` 为 wave 设 `specLink` / `overallLink`）
- Modify: `packages/cdd-engine/src-next/face/lifecycle.ts`（确认 `#valuesOf` 对 wave 放出两格；若已按空串丢弃则只改上游赋值）
- Modify: `packages/cdd-engine/src-next/face/__tests__/cli.test.ts`（wave 成对 pin + 负向 pin）

#### Consumes

- `SlugIndex` / `ArtifactRegistry` 的 doc 读面（P36 已交付，零新派生）

#### Produces

- wave 场景上 `specLink` / `overallLink` 与 branch 同源取值规则

#### Steps

- 写失败测试：健康 fixture 下 wave prompt 含 `INPUT_SPEC` 与 `INPUT_OVERALL` 两行且路径可读；身份缺席 / `invalid` 时两 token 均不出现；branch prompt 字节与本任务前快照一致 — checkable: 红于 wave 两格仍空
- 改 `#sceneOf` 的 wave 臂：与 plan/branch 一样经 `docsOf` / `program:` 取链接；`invalid` 或缺席 ⇒ 保持 null（装配器丢行）— checkable: 成对 / 负向 pin 绿；branch 快照绿
- 提交 — checkable: commit 存在

#### Acceptance

AC ④。

#### DependsOn

none

### Task 5: 跨轮改档落账（显示面）

#### Objective

落地 §5：`RoundFinding` 投影携带稳定键与 `impact.scenario`；降档且上一轮同键场景非空 ⇒ 无 `regrade` 时胶囊与板面各一条可见标记（不进 `findings[]`、不单独逼 `REVIEW_FIX`）；省略或改写场景不注销义务。

#### Files

- Modify: `packages/cdd-engine/src-next/session/ledger.ts`（`RoundFinding` 扩字段；投影写入）
- Modify: `packages/cdd-engine/src-next/session/handoff-schema.ts`（`findingsOf` 透传 id / scenario / regrade）
- Modify: `packages/cdd-engine/src-next/face/capsule.ts`
- Modify: `packages/cdd-engine/src-next/face/board-view.ts`
- Modify: 对应 `__tests__`（capsule / board-view / ledger）

#### Consumes

- T3 的 `impact` / `regrade` 字段与 carrier 读面

#### Produces

- `RoundFinding` 含 `id?` · `impactScenario?` · `regrade?`（或等价命名）
- 显示面标记措辞取自判据表某 `numbered` 行（不另写一句）

#### Steps

- 写失败测试：同 id 上轮 blocker+scenario、本轮 warn 无 regrade ⇒ 胶囊与板面各一记；有 regrade ⇒ 两处出现理由；本轮省略 scenario 仍出标记；标记条数不增加 `findings[]` 长度、不单独把结论打成 `REVIEW_FIX` — checkable: 红
- 扩投影与比较：稳定键 = carrier `id`，缺则 `summary` 原文；比较规则按 §5.1 四步 — checkable: 匹配测试绿
- 胶囊小计与板面 finding 行渲染标记（display-only）— checkable: 显示 / 负向 pin 绿
- 提交 — checkable: commit 存在

#### Acceptance

AC ⑤。

#### DependsOn

3

### Task 6: pin 可解析性门 + `contract.path` 回读消费者 + changeset

#### Objective

落地 §7 与 §2.3 第三消费者：`PinAudit` 扫 markdown 三形态；交接单回读校验 finding 的 `contract.path`（失效 ⇒ 追加 warn、不阻断）；交付 `cdd-engine` minor changeset。

#### Files

- Create: `packages/cdd-engine/src-next/contract/pins.ts`
- Create: `packages/cdd-engine/src-next/contract/__tests__/pins.guard.test.ts`
- Modify: `packages/cdd-engine/src-next/face/lifecycle.ts` 或 `session/handoff-schema.ts`（`contract.path` 回读）
- Modify: 对应 handoff / lifecycle 测试
- Create: `.changeset/p37-grading-boundary.md`（`cdd-engine` minor）

#### Consumes

- T3 的 `contract` 字段

#### Produces

- `PinAudit.scan(roots): readonly PinFinding[]`（路径解析 + 符号索引 + 测试格题）
- 语料零 finding 的结构测试；handoff 上 `contract.path` 失效 ⇒ warn finding

#### Steps

- 写失败测试：注入不存在符号的 markdown pin ⇒ `PinAudit` 非空；在册语料 ⇒ 空；finding 带坏 `contract.path` ⇒ 回读追加 warn 且轮次不 BLOCK — checkable: 红
- 实现三形态解析（§7.1）与缓存符号索引；结构测试钉在册语料 — checkable: 门测试绿
- 回读面：有 `contract` 则解析 `path`；失败则追加 lens=`consistency` · severity=`warn` 的 finding，不调用 `#reject` — checkable: 回读测试绿
- 写 changeset（minor · 简述三级边界 / impact 门 / lens 问句 / wave 注入 / regrade 标记 / pin 门）+ `pnpm run validate` — checkable: validate exit 0；changeset 在册
- 提交 — checkable: commit 存在

#### Acceptance

AC ⑥ + AC ⑦。

#### DependsOn

3

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-11-16 | 初稿：六任务两波——T1 判据表+rubric 装配 · T2 lens 问句+axesGuide 投影（DependsOn 1）· T3 impact/regrade/contract+gradingViolations · T4 wave 注入 · T5 改档显示面（DependsOn 3）· T6 pin 门+contract.path 回读+changeset（DependsOn 3）；消费 spec `2026-11-16-engine-doc-tooling-p37` 当时 `version:` | Oscaner M. · Claude（kairos:cdd-plan · 2026-11-16） |
