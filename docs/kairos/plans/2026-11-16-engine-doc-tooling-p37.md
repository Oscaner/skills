---
title: '引擎文档工具（Engine Doc-Tooling）— P37 计划：分级判据的可核化（功能影响 · 三级边界 · 生成式注册表 · pin 门）'
doc-type: plan
version: v0.25
date: 2026-11-16
slug: 2026-11-16-engine-doc-tooling-p37
base: develop
---

## Constraints

- **逐字取 spec**：本计划只实现 `docs/kairos/specs/2026-11-16-engine-doc-tooling-p37-design.md`（slug `2026-11-16-engine-doc-tooling-p37`）在本轮被消费那一刻的 `version:` 所指的面。本 bullet 只记「哪一节落在哪个任务」，**不记版本坐标**——spec 再升一版也不需要改这一行；本计划实际消费的是哪一版，记在 `## Change history` 里本轮那一行。落点：§1 + §6.1 判据表半边 + §6.2 判据面观察者归 T1 · §3 + §6.1 lens 问句半边 + §3.2 + §6.2 问句面观察者与 15 行 / 19 格计数归 T2 · §2 归 T3，除 §2.1 的 `RoundFinding` 三格与两个投影（→ T5）与 §2.3 的 `contract.path` 回读（→ T6）· §4 归 T4 · §5 归 T5 · §7.1 pin 定义与三形态 + §7.4 pin 判据行 + §7.2 的后两份语料（被审文档正文 · `contract.path`）+ §2.3 的 `contract.path` 回读 + AC ⑧ changeset 归 T6 · §7.3 存量迁移归 T7（§7.1 路径解析次序的实现、规则 ⑤ / ⑧ 的普查与重处置、以及 §7.3 的时间面跳过表随它同落 T7——判据的文字面仍归 T6）· §7.1 的成员引用形态与其存量迁移 + §8 计数的执行面归 T8（AC ⑦）——§7.1 的三形态仍归 T6，T8 承接的是后加的成员形态那一条。§6.2 的三种 `face` 各由创建该执行面的任务核，一律走字面量、不跨任务 import：`numbered` 与语料计数落在承载该表的测试面（T1 判据表 / T2 问句表）；`gate` 落在 T3——它打的 `CDD_BLOCKED: grading-impact-missing` 第二词就是该判据行的 `id`；`test` 落在 T6——`contract/__tests__/pins.guard.test.ts` 里一条格题以字面量点名 `pin-parseability`。§7 的测试面只承接 pin 语料。
- **OOP / 零裸函数**：`src-next` 新增文件一律 class 或 `const` 箭头；参数 ≤4；类 ≤200 行；接口先行、协作者构造注入。注册表仿 `contract/completion-criterion.ts` 的 `of(id)` 查不到即抛。**类 ≤200 行的上限只约束本相位新建的类**：本相位要动的四个既有文件均远超此限（`session/ledger.ts` · `face/lifecycle.ts` · `face/board-view.ts` · `session/handoff-schema.ts`），按 rule zero 免于该上限，每处改动写一行理由；拆分归 P39（D95 ②），本相位不拆、不借此重开它们。
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

- `CriteriaRegistry`（或等价类名）· `CRITERIA.of(id: string): CriteriaRow`（查不到即抛）· `CRITERIA.renderRubric(): string` · `CRITERIA_ROWS`（`readonly CriteriaRow[]`，导出——T8 的 `criteria.rows` 取它的 `length`，因此本行必须登记它为导出、而不是只登记查表与装配两个函数）
- `CriteriaRow = { id, tier: "blocker"|"warn"|"nit", body, duty, counterExample, face: "gate"|"test"|"numbered" }`
- 判据表五行，三档都有行（§1.1–§1.3），反例句按 §1.3 的序落到**行**上（`counterExample` 是行的格子，不是档位的格子）：blocker 行（`id: "grading-impact-missing"`）覆盖功能影响边界 + 场景举证，其 `counterExample` 是 §1.3 第一条「说得出一处偏离预期，却举不出『哪条合法输入 → 实际是什么 → 预期是什么』⇒ warn」；warn 档行覆盖后果举证，其 `counterExample` 取 §1.3 第三条「一段死码当前无人调用、也不影响任何输出 ⇒ warn，不是 nit」（warn 行承担 warn / nit 的界线，正是 §1 开头点名缺失的那条分界）；nit 档行覆盖「为什么不是 warn」，其 `counterExample` 是 §1.3 第四条「一处命名不一致但同一文件内自洽 ⇒ nit」；`regrade-mark`（nit）与 `pin-parseability`（warn · §7.4）各占一行，后者的 `counterExample` 按 §7.4 写 P28 的反转理由与边界
- §1.3 的第二条「违反了一句写着的话，但消费者拿到的字节不变 ⇒ warn」不独行：§1.4 已把 (a) 降为 blocker 档的典型实例，而这一句正是封住 (a) 那句漏洞的收口句，因此它是 blocker 行 `body` 的末句、随 `body` 进字节，不占 `counterExample` 格
- §6.1 的两段校验契约缺一不可：**行形态是类型**——每行是 `readonly` 字面行，`id` / `tier` / `body` / `duty` / `counterExample` / `face` 六格全必填，删掉任一键是 `tsc` 红（类型层，不是运行时抛）；**格子内容是装配期校验**——装配时任一必填格 `trim()` 后为空即 `renderRubric()` 抛，某一 `tier` 无任何行也抛。两段各自拦一种形态，都不会渲染出少一句的档位片段
- 本相位的 `face` 面额登记在册（§6.2 要求每个非 `numbered` 的值都有行占位）：`numbered` 3 行（warn 档行 · nit 档行 · `regrade-mark`）· `gate` 1 行（blocker 档行，`id: "grading-impact-missing"`——`CDD_BLOCKED: grading-impact-missing` 的第二词就是它，T3 打这个字面量）· `test` 1 行（`pin-parseability`，执行面是 T6 的 `pins.guard.test.ts` 里一条点名它的格题）。`face` 只声明该行额外接上的执行面；三格正文按 §6.1 对**每一行**装配进 rubric 字节，与 `face` 无关
- `pin-parseability` 行：`tier: "warn"` · `face: "test"` · `counterExample` 写 §7.4 的反转理由与边界（只判 pin 的每一段可解析，不判文档结构、不判语义、不做 docs 全量校验；`contract.path` 归交接单回读面的语料，`PinAudit` 永不承接）
- `regrade-mark` 行：`tier: "nit"` · `face: "numbered"` · `body` 是 nit 档的判据句（同一缺陷降档却没写理由 ⇒ 读者分不清这是重判还是换了一个缺陷，而本轮结论不变），因此 nit 段整体读起来是连续的句子；§5.2 的改档标记措辞**不进判据表**，由同一模块导出的 `REGRADE_MARK` 常量承接（T5 的唯一措辞来源，读 `REGRADE_MARK`）——标记是显示面 token、不是判据句，把它当 `body` 只会让一个从句片段插进段落中间；`duty` 与 `counterExample` 照常进 nit 段
- §6.2 判据面结构测试（T1 自己的面）：每行三格逐字出现在 `CRITERIA.renderRubric()` 字节里；`face` 面额钉成常量（`numbered` 三 id · `gate` 一 id · `test` 一 id）——改某行 `face`、删一行或加一行即红。`gate` 的报文面与 `test` 的格题面各在 T3 / T6 自己的测试面成对钉
- 档位连续性 pin（T1 自己的面，§6.1「不会渲染出少一句的档位片段」的第二半）：每档片段是**一条连续串**——按该档声明序把每行 `body` / `duty` / `counterExample` 以单空格拼成期望值，再与 `renderRubric()` 里从该档首行 `body` 起、长度相等的切片逐字相等；且每行每格以大写字母开头、以句末标点收尾。把某行某格换成一个从句片段（例如把标记措辞写回 `body`）⇒ 该 pin 红

#### Steps

- 写失败测试（运行期那一段）：`CRITERIA.of("missing")` 抛；完整表装配出的字符串含每行 `duty` 与 `counterExample` 原文；把某行的 `counterExample` 置 `""`、`body` 与 `duty` 各置空白串 ⇒ `renderRubric()` 抛且该行片段不进字节；让某个 `tier` 零行 ⇒ 装配抛 — checkable: 红于「of / renderRubric 未定义」
- 实现 `contract/review-criteria.ts`：判据表 + `of` + `renderRubric`（装配公式：每行 `body + " " + duty + " " + counterExample`，同 tier 相邻，段序 blocker → warn → nit；装配前逐行逐格 `trim()` 校验，空白格与零行档位即抛）— checkable: 上面运行期那几条测试绿
- 类型层那一段的 pin（不进 vitest）：临时从一行的字面量里删掉 `counterExample` 键，`pnpm exec tsc --noEmit -p packages/cdd-engine` 红；恢复即绿。它是 buildability 证据，不在测试里冒充「装配抛」——套件走 esbuild（AGENTS.md 的 trap），删键在运行期只是 `undefined`，抛的是 TypeError，两条红法不能互相顶替 — checkable: `tsc --noEmit` 删键前绿 / 删键后红
- 改 `render/templates.ts`：`SEVERITY_RUBRIC` 改为 `CRITERIA.renderRubric()` 的返回值（或由其填充档位主体，尾段仍拼接 `reviewGuideOf` 既有契约）；(a)–(d) 降为 blocker 档 `body` 内的典型实例，不再是独立触发器 — checkable: `templates.test.ts` 的 rubric 锚点重锚后绿；`(severity by your judgment)` 仍在（T2 删）
- 加 §6.2 判据面结构测试（`contract/__tests__/review-criteria.test.ts`）：逐行核对三格进字节，并把相位 `face` 面额钉成常量（`numbered` 三 id · `gate` 一 id · `test` 一 id，逐 id 列出）— checkable: 观察者绿；把任一行 `face` 改成别的值、删掉一行、或往表里加一行 ⇒ 该测试红（报文面与格题面不在这条测试里冒充，各自在 T3 / T6 的测试面上钉）
- 加档位连续性 pin（同一条测试面）：按档拼出期望串、与渲染产物里该档切片逐字相等，并钉每格的开头大写与句末标点 — checkable: 把 `regrade-mark` 行的 `body` 换回标记措辞（或在段中插入一个从句片段）⇒ 该 pin 红；恢复 ⇒ 绿。同一处钉 `REGRADE_MARK` 是显示措辞：无任何判据格等于它、`renderRubric()` 不含「句末标点 + 标记 + 空格」那种拼接形态
- 提交 — checkable: `git log -1 --oneline` 含本任务主题

#### Acceptance

AC ① 的判据表半边：三档边界 / 举证 / 反例进字节，§1.3 的四条反例句各有落点（三行 `counterExample` + blocker 行 `body` 末句）；缺行装配即抛；`duty` / `counterExample` 置空串即从渲染字节消失且装配抛，删键则由 `tsc` 拦——§6.1 的两段校验契约各一条 pin，红法不互相顶替。§6.2 判据面观察者在册（`numbered` 进字节 · `gate` / `test` 各一行，并各自指向报文面 / 格题面）；另有一条档位连续性 pin 钉住「每档片段是一条连续句子串」与「显示措辞不进 rubric」，`REGRADE_MARK` 是 §5.2 标记的唯一措辞来源。

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

- `LensQuestionRow = { id, reviewKinds: readonly ReviewKind[], lens, question, face: "numbered" }`——§3.1 的「同一 `id` 的两次引用」在行形态上就是这一格多值：共享行把 `wave` 与 `branch` 一起写进 `reviewKinds`，正文只存一次；单类行是单元素数组，`face` 恒为 `numbered`
- `ReviewKind` 由 `contract/review-criteria.ts` 自己声明，是本平面自己的五 kind 词汇（`"wave" | "branch" | "plan" | "overall" | "spec"`）——`contract/` 不 import `render/`（D95 ① 的边方向，P39 会上门），因此不复用 `render/templates.ts` 的 `ReviewKey`；两处值集相同，`templates.ts` 现有的 `ReviewKey` 值（`REVIEWS` 的键、`reviewGuideOf` / `reviewBodyOf` 的入参）与 `ReviewKind` 结构上互相可赋值，T2 对 `REVIEWS` 的改动照旧用 `ReviewKey` 落地，因此既不需要反向边、也不需要第二处 import
- `LENS_QUESTION_ROWS`（`readonly LensQuestionRow[]`，导出——T8 的 `questions.rows` 取它的 `length`、`questions.cells` 取各行 `reviewKinds.length` 之和，因此本行必须登记它为导出、而不是只登记两个查表函数）
- `LENS_QUESTIONS.of(reviewKind, lens)` / `forReviewKind(reviewKind)`（查不到即抛）：`of` 按 `row.reviewKinds.includes(reviewKind) && row.lens === lens` 命中；`forReviewKind` 把每条共享行按 `reviewKinds` 展开成一类一格，声明序即渲染序
- 物理行 15 · 逻辑格 19，两个数各从一格读、不共用同一个数：物理行 = `LENS_QUESTIONS.rows.length === 15`（15 条声明行，wave/branch 共享行只算一条）；逻辑格 = `rows.reduce((sum, row) => sum + row.reviewKinds.length, 0) === 19`（共享行按 `reviewKinds` 计两次）。`forReviewKind` 的五个投影是同一事实的第三种读法——`wave` 4 条与 `branch` 4 条（同一条共享行在两边各展开一次）、`plan` / `spec` 各 3 条、`overall` 5 条；单值 `reviewKind` 的 15 行表无法让 `forReviewKind("branch")` 非空，因此这一格多值不是可选写法
- §6.2 问句面结构测试（落在 `contract/__tests__/review-criteria.test.ts` 与 `render/__tests__/templates.test.ts`）：每条问句逐字出现在其 `reviewKind` 的 `**Criteria —` 行里；同一测试面另计物理行 15 / 逻辑格 19

#### Steps

- 写失败测试：19 格齐全；把问句塞进判据表或把判据行塞进问句表 ⇒ 查表抛；`REVIEWS.wave.axesGuide` 含 4 条编号问句且零 `(severity by your judgment)`；`lensEnum` 含 `scope` — checkable: 红
- 实现 lens 问句表（§3.1 十九句原文入表：wave/branch 共享行正文只写一次、`reviewKinds` 写两个 kind）+ `of` / `forReviewKind`（共享行按 `reviewKinds` 展开）— checkable: 计数与查表测试绿
- 改 `REVIEWS`：wave/branch 删 judgment 逃逸口、补 `scope`；五类 `axesGuide` 末尾追加 `LENS_QUESTIONS.forReviewKind` 渲染的 `1. …` 清单 — checkable: 投影 pin 绿（wave/branch 各 4 · plan/spec 各 3 · overall 5；wave 与 branch 问句字节同源）
- 加 §6.2 问句面结构测试：逐 `reviewKind` 取 `forReviewKind` 的每条问句，断言其逐字出现在该类 `axesGuide` 折出的 `**Criteria —` 行里，并另计物理行 15（`rows.length`）/ 逻辑格 19（`sum(row.reviewKinds.length)`）两条独立断言 — checkable: 绿；删掉表里任一行 ⇒ 该类 prompt 少一条编号问句且计数红；把共享行的 `reviewKinds` 从两个改成一个 ⇒ 物理行仍 15、逻辑格降到 18、`branch` 的 prompt 少一条问句
- 提交 — checkable: commit 存在

#### Acceptance

AC ③：零 `(severity by your judgment)`；问句投影进 `**Criteria —` 行；两表分开计数；混表即抛。§6.2 问句面观察者在册（逐字进 `**Criteria —` 行 · 15 行 / 19 格），且 15 与 19 由 `rows.length` 与 `sum(reviewKinds.length)` 两条断言各读一次——19 格与 `wave` / `branch` 各 4 条的投影只能由共享行的多值 `reviewKinds` 同时满足。

#### DependsOn

1

### Task 3: `impact` / `regrade` / `contract` 字段 + `gradingViolations`

#### Objective

落地 §2：`FINDING` 增可选 `impact`（`scenario` + 可选 `test`）、`regrade`、`contract`；纯助手 `gradingViolations` 判 blocker 缺场景；交接单回读面打出 `CDD_BLOCKED: grading-impact-missing`；`rollup` 返回类型不变。

#### Files

- Modify: `packages/cdd-engine/src-next/session/handoff-schema.ts`
- Modify: `packages/cdd-engine/src-next/session/__tests__/handoff-schema.test.ts`
- Modify: `packages/cdd-engine/src-next/face/lifecycle.ts`（回读面调用谓词）
- Modify: `packages/cdd-engine/src-next/face/__tests__/lifecycle.test.ts`（`grading-impact-missing` 报文的成对 pin：缺场景 ⇒ 报文含判据行 `id` 与每条违规的 `id`；补场景 ⇒ 无报文）
- Modify: `packages/cdd-engine/src-next/face/__tests__/cli.test.ts`（同一拒绝路径在 CLI 面的成对 pin）

#### Consumes

none

#### Produces

- `HandoffSchema.gradingViolations(findings): readonly { id?: string; summary?: string }[]`
- 失败面字节：`CDD_BLOCKED: grading-impact-missing` + 违规 `id` / `summary` 全列
- 报文第二词与判据表 blocker 行的 `id` 同字面（`grading-impact-missing`）：T3 按字面量写，不 import 注册表——§6.2 的 `gate` 执行面因此在 T3 的报文测试里成对钉（缺场景 ⇒ 该字面出现并带每条违规 `id`；补场景 ⇒ 不出现）

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

落地 §4：wave 与 branch 对齐，四臂按身份文档的形状配对（不强行成对）：身份文档与其 `program:` 母宪章都解析到 ⇒ 两 token 均出现且路径仓根相对可读；身份文档解析到但无 `program:`（身份文档是 single-spec）⇒ 只出 `INPUT_SPEC`，`INPUT_OVERALL` 合法缺席，**不得因此连 spec 锚一起剥**；身份文档缺席或读面为 `invalid` ⇒ 两 token 均不出现；`program:` 指不到母宪章 ⇒ 只丢 `INPUT_OVERALL`（`INPUT_SPEC` 仍在）；branch round-context 整段字节不变。同一个 `#valuesOf` 还供给 wave 的 fix 轮，因此 fix 壳的子句要把这两个锚点写到 wave 行上，不再只归 branch 行。

#### Files

- Modify: `packages/cdd-engine/src-next/face/cli.ts`（`#sceneOf` 的 wave 臂与 `plan` / `branch` 同路设 `specLink` / `overallLink`）
- Modify: `packages/cdd-engine/src-next/face/lifecycle.ts`（`#valuesOf` 的两臂各并入 `wave`：`INPUT_SPEC` 今天对 `wave` 短路成空串，`INPUT_OVERALL` 的 `phase-spec` / `plan` / `branch` 臂不含 `wave`——只改 `#sceneOf` 会让两格仍缺，装配器丢行）
- Modify: `packages/cdd-engine/src-next/face/__tests__/cli.test.ts`（wave 成对 pin + 负向 pin + wave fix 轮的成对 pin + branch round-context 整段字节 pin）
- Modify: `packages/cdd-engine/src-next/render/templates.ts`（fix 壳的子句把两个锚点写到 wave 行上；壳字节改动随之升 `TEMPLATE_PROMPT.$version`）
- Modify: `packages/cdd-engine/src-next/render/__tests__/render.test.ts`（fix 壳子句的措辞 pin 与 `$version` pin）

#### Consumes

- `SlugIndex` / `ArtifactRegistry` 的 doc 读面（P36 已交付，零新派生）

#### Produces

- wave 场景上 `specLink` / `overallLink` 与 branch 同源取值规则，且两格各自独立判定：`specLink` 只看身份文档是否解析到，`overallLink` 再看它的 `program:` 是否指得到母宪章（不互相拖带——否则 single-spec 相位会连 spec 锚一起被剥）

#### Steps

- 写失败测试：健康 fixture 下 wave prompt 含 `INPUT_SPEC` 与 `INPUT_OVERALL` 两行且路径可读；single-spec 身份文档（有身份、无 `program:`）下 `INPUT_SPEC` 在而 `INPUT_OVERALL` 不在；身份文档的 `program:` 指不到母宪章时 `INPUT_SPEC` 在而 `INPUT_OVERALL` 不在；身份缺席 / `invalid` 时两 token 均不出现；branch 的 `## Round context` **整段记录下来逐字比对**（不是两根锚点的 `toContain`——那样加一行或换序仍绿）— checkable: 红于 wave 两格仍空；把 branch round-context 的任两行换序 ⇒ 整段 pin 红
- 改 `#sceneOf` 的 wave 臂：与 plan/branch 一样经 `docsOf` / `program:` 取链接；`invalid` 或缺席 ⇒ 保持 null（装配器丢行）— checkable: 成对 / 负向 pin 绿；branch round-context 整段 pin 绿
- 改 fix 壳的子句：`INPUT_SPEC` 与 `INPUT_OVERALL` 都写到 wave / branch 两行上（这两行同源取值），并补一条 wave fix 轮的 dispatch pin（两 token 都在、壳子句点名 wave 行）— checkable: 删掉壳子句里 wave 那半句 ⇒ render.test.ts 的措辞 pin 与 wave fix pin 各红
- 改 `#valuesOf` 的两臂：`INPUT_SPEC` 的 `plan` / `branch` 臂并入 `wave`，`INPUT_OVERALL` 的 `phase-spec` / `plan` / `branch` 臂并入 `wave` — checkable: 与 `#sceneOf` 的改动配对后两行出现；只改 `#sceneOf` 则两格的原子仍缺、成对 pin 红
- 提交 — checkable: commit 存在

#### Acceptance

AC ④ 的四臂全部成对 pin（健康两 token · single-spec 只 `INPUT_SPEC` · `program:` 解析不到只丢 `INPUT_OVERALL` · 身份缺席或 `invalid` 两 token 均无），且「任一环缺席 ⇒ 两 token 均不出现」不作反向 pin；branch 的 `## Round context` 整段与本任务前的记录逐字相等（换序或增删一行即红）；wave fix 轮同样带两个锚点，且 fix 壳子句把两者写到 wave 行上。

#### DependsOn

none

### Task 5: 跨轮改档落账（显示面）

#### Objective

落地 §5：`RoundFinding` 投影携带稳定键与 `impact.scenario`；降档且上一轮同键场景**非空** ⇒ 无 `regrade` 时胶囊与板面各一条可见标记（不进 `findings[]`、不单独逼 `REVIEW_FIX`）；降档但上一轮同键行的 `scenario` **为空** ⇒ 没有参照场景，按缺陷已变处理，不要求 `regrade`、不标记（§5.1 第 4 步）；本轮省略或改写 `scenario` 都不注销义务（匹配键是 `summary`，改写 `impact.scenario` 仍配对）。

#### Files

- Modify: `packages/cdd-engine/src-next/session/ledger.ts`（`RoundFinding` 扩 `id?` / `impact?` / `regrade?`；`Ledger#findingsOf` 投影写入）
- Modify: `packages/cdd-engine/src-next/session/handoff-schema.ts`（`HandoffSchema.findingsOf` 透传三格；丢弃规则不变）
- Modify: `packages/cdd-engine/src-next/face/lifecycle.ts`（标记的生产者：与 `#dispositionsSummary` 同处按 §5.1 比较本轮与上一条 findings 非空的记录，结果写进 `DispatchOutcome.dispositionsSummary`）
- Modify: `packages/cdd-engine/src-next/face/board-view.ts`（`LineCarriers` 补 per-record `findingsOf`，与 `countOf` 共用同一条 digest 校验读、字节只解析一次；`BoardView#summaryToken` 在 `+N` 后接标记）
- Modify: `packages/cdd-engine/src-next/face/__tests__/lifecycle.test.ts`（胶囊 `summary` 槽的成对 pin）
- Modify: `packages/cdd-engine/src-next/face/__tests__/board-view.test.ts`（板面 token 的标记与负向 pin）
- Modify: `packages/cdd-engine/src-next/session/__tests__/ledger.test.ts`（三格投影与比较四步）

#### Consumes

- T3 的 `impact` / `regrade` 字段与 carrier 读面——`impact.scenario` 是 §5.1 第 3、4 步的参照格，`regrade` 是「本轮写没写理由」的那一格，两者都在同一条 findings 投影上读出
- T1 判据表旁的 `REGRADE_MARK` 常量——它是标记措辞的唯一来源（本任务不另写一句，也不复制正文）

#### Produces

- `RoundFinding` 含 `id?` · `impact?`（其 `scenario`）· `regrade?`（或等价命名），两个投影同步带上这三格
- `LineCarriers#findingsOf(record): readonly RoundFinding[]`（per-record findings 读面）与 `countOf` **共用一次读**：同一条 `CarrierIntegrity.read`（含 digest 校验与 `RoundRecords.ownerOf` 归属判定）+ 一次 `JSON.parse`，随后两个投影各取一格——`countOf` 仍取原生 `findings` 数组长度（语义不动，仍是 `+N` 的数字），`findingsOf` 取经 `HandoffSchema.findingsOf` 过滤后的行（未知 severity 仍丢）。同源不同格：`#summaryToken` 的 `+N` 用前者、降档标记用后者，因此 `countOf` 不会因改用 `findingsOf` 而变成无调用者的死码，也没有第二次 carrier 解析
- 胶囊侧走 `Capsule#emit` 既有的 `summary` 槽：`session/run.ts#capsuleLines` 已把 `DispatchOutcome.dispositionsSummary` 原样交给 `emit`，`emit` 签名与键集都不动 ⇒ `face/capsule.ts` 与 `session/run.ts` 都不是改动点；评审轮因此**恰好多一行**——「不新增行」的准确说法是**不新增 finding 行、不新增 carrier 条目、不改本轮结论**
- 显示面标记措辞取自 T1 模块导出的 `REGRADE_MARK`（不另写一句，也不把标记写进任何判据格）；板面把它接在 `+N` 之后，仍是同一个 token

#### Steps

- 写失败测试：同一 `summary` 上轮 blocker+scenario、本轮 warn 无 regrade ⇒ 胶囊与板面各一记；有 regrade ⇒ 两处出现理由；本轮省略场景文本仍出标记；本轮把 `impact.scenario` 改写成本轮的新场景、`summary` 原文不变、无 `regrade` ⇒ 仍配对、仍要求 `regrade`、两处仍出标记（改写不注销义务）；上一轮同键行的 `impact.scenario` 为空、本轮降档且无 `regrade` ⇒ 胶囊该行不出现、板面 token 不带标记（「见降档就标」是假阳性，§5.1 第 4 步要挡的正是它）；中间夹一条 findings 为空的 implement 记录仍配对；标记条数不增加 `findings[]` 长度、不单独把结论打成 `REVIEW_FIX` — checkable: 红
- 扩投影与比较：匹配键先取 `summary` 原文、多行同文时以 carrier `id` 收窄（`id` 是行号不是缺陷身份，不能作首键）；「上一轮」= 同一行上更早的、其 findings 投影非空的那条记录，读面按 §5.1 取 `Ledger#recordsOf` 的整行记录 + `Ledger#readHandoff` 的单轮交接单 + `HandoffSchema.findingsOf` 的投影（implement 记录与空 findings 的 review 记录都投影出空集，因此「紧接着的上一条」会零行匹配、降档静默通过）；比较规则按 §5.1 四步 — checkable: 匹配测试绿
- 渲染标记（display-only）：胶囊侧在 `#dispositionsSummary` 同处产出该行、经既有 `summary` 槽渲出；板面侧在 `+N` 之后接同一句 — checkable: 无降档的评审轮 stdout 与今天逐字节相同、有降档恰好多这一行；板面 token 同样成对；标记不进 `findings[]`、不单独逼 `REVIEW_FIX`；板面每个 record 只解析一次 carrier 字节（`countOf` 与 `findingsOf` 共用一次 `CarrierIntegrity.read` 与一次 `JSON.parse`），把 `findingsOf` 改成第二次独立解析 ⇒ 该 pin 红
- 提交 — checkable: commit 存在

#### Acceptance

AC ⑤ 的全部腿，逐条成对 pin：降档且上一轮同键 `impact.scenario` 非空、无 `regrade` ⇒ 板面 verb token 与胶囊 `summary` 行各一条可见标记（胶囊侧：无降档的评审轮 stdout 与今天逐字节相同、有降档恰好多这一行）；有 `regrade` ⇒ 两处各一次理由；本轮省略场景文本仍出标记；本轮改写 `scenario` 而 `summary` 不变仍出标记（改写不注销义务）；上一轮该行 `scenario` 为空 ⇒ 不要求 `regrade`、不标记；参照对象 pin：中间夹一条 findings 为空的 implement 记录仍配对；负向 pin：标记不进 `findings[]`、不单独把本轮推成 `REVIEW_FIX`。

#### DependsOn

1, 3

### Task 6: pin 可解析性门 + 两份回读语料 + changeset

#### Objective

落地 §7 与 §7.2：pin 可解析性**只有一条判据**，喂给它的是**三份语料**，执行面**两处**。语料一 = §7.1 全语料（`docs/kairos/**/*.md` + README 家族），执行面是引擎套件的结构测试；语料二 = 本轮被审文档的正文，执行面是 `face/lifecycle.ts` 的 `#reconstruct`；语料三 = 交接单 finding 行上的 `contract.path`（§2.3），读点在**同一个 `#reconstruct`**、与语料二注入同一处——两条都先进 `draft.findings` 再算结论，因此那一次 `rollup` 同时读到两份语料，`DraftedOutcome.findings` 的投影与持久化载体也读到同一批行；`#materialize` 是 carrier 的唯一写者（注入行的 `id` 由它的 `#findingsList` 按 carrier 行序写入），判在 `#reconstruct`、写在 `#materialize` 两点合起来才是 §7.2 点名的那条回读面，树里没有第二个文档评审回读面。后两份语料注入的都是真实的 warn 级 finding：进 `findings[]`、被 `rollup` 读到，因此它们的可见后果是文档评审轮落到 `REVIEW_FIX`，而不是停在 `APPROVED`——「不新增拒绝面」说的是不出 `CDD_BLOCKED`，**不是**结论中性。另交付 `cdd-engine` minor changeset。

#### Files

- Create: `packages/cdd-engine/src-next/contract/pins.ts`
- Create: `packages/cdd-engine/src-next/contract/__tests__/pins.guard.test.ts`
- Modify: `packages/cdd-engine/src-next/face/lifecycle.ts`（judge 面回读的两份语料都在 `#reconstruct` 判、都在 `conclusionOf` 与局部 findings 投影之前注入 `draft.findings`：扫被审文档正文 + 判 finding 行的 `contract.path`；被审文档正文的路径取 `frame.target`（三个 doc 型为 `{ kind: "spec", doc }`）、正文走类既有的 repo 读，`#reconstruct` 不建第二个 `SlugIndex`、也不给 `DispatchScene` 加字段；`#materialize` 保持 carrier 写者的角色，不新增判点）
- Modify: `packages/cdd-engine/src-next/face/__tests__/lifecycle.test.ts`（两份回读语料各自的成对 pin）
- Create: `.changeset/p37-grading-boundary.md`（`cdd-engine` minor）
- Modify: `packages/cdd-engine/src-next/render/templates.ts`（`REVIEWS.*.pinLens` 的逐面声明与 `pinLensOf`——注入行的 lens 只从这里来，不写死字面量；`pinLensOf` 与同一份 `lensEnum` 交叉校验、drift 即抛）
- Modify: `packages/cdd-engine/src-next/render/__tests__/templates.test.ts`（drift 的成对格题：drifted `lensEnum` ⇒ `pinLensOf` 抛；每个判据面的注入行恰带 `pinLensOf(type)`）
- **不在本块**：`PinIndex.resolvePath` 的层级 ①→③ 升级、歧义 finding 形态与 §7.3 的时间面跳过表。三处连同规则 ⑧ 的普查与重处置一起落 T7 的 Files——本块的波次已闭合，再也派发不了一次「解析器 + 迁移」；把升级单落在本块，`pins.guard.test.ts` 的语料例题（树上已预置的 `scan(CORPUS_ROOTS)` 零断言，今天红在 7 条待建路径上）会红在当轮普查读到的未重处置歧义词上（读数只记在 ⁨Produces⁩ 的普查行，本行不重复）。本块交的是判据的文字面与首条命中的门

#### Consumes

- T3 的 `contract` 字段

#### Produces

- `PinAudit.scan(roots): readonly PinFinding[]`（路径解析 + 符号索引 + 测试格题）；路径形按 §7.1 的 `path.ext[:line[-line]]`——行号可省，省略时就是裸路径 pin，出现时不得超过该文件的行数，且不比对内容；**路径解析按三级优先，次序本身就是判据的一半**——① **精确条目命中优先**：token 与某条仓内条目逐字相等即取该条（`README.md` 因此解析到仓根那份 142 行的文件，而不是 51 行的 `.changeset/README.md`）· ② 否则**唯一后缀命中**即取该条（中段尾形如 `face/declare.ts` 因此唯一落到同一份文件）· ③ 两条都不成立即**歧义**：报一条 finding、`summary` 点名该 pin 与两个候选，**不得**静默取第一条（§7.1 的「唯一」是路径形判据的一半，不是修辞：同一 basename 在根与嵌套各有一份时，取首条命中会让行号按那份更短的文件算，于是一条合法 pin 被判成越界，而另一份文件里的同号行反而通过）；**精确优先不消灭歧义**——只由 basename 写成的 token 走完层级 ① 仍落层级 ③，因此歧义分支一上线，语料里就有一批 finding 等 T7 规则 ⑧ 收口，「全语料零 finding」是那一轮之后的状态，不是本块的交付状态；层级 ①→③ 的实现与歧义 finding 形态因此不在本块（见 Files 的「不在本块」），那一块在同一提交里交付解析器 + 普查 + 重处置。歧义读数只作证据、不登记为判据（语料每轮改写自己），口径按 **remedy** 分成两簇，两簇 remedy 不同、不许并读：**⑧ 簇 165 处 / 4 个 basename**（run.ts 75 · declare.ts 62 · SKILL.md 21 · CHANGELOG.md 7，每个 basename 含自己的 `:line` 形）按规则 ⑧ 写全现行路径；**⑤ 簇 22 处 / 4 个 token**（那一轮的 spec 评审产物 12 · 那一轮的 implement 取证产物 4 · 那一轮的 branch 取证产物 3 · 那一轮的 spec 修复产物 3）是 §7.1 产物词表之外的机器本地 workspace 产物名，按规则 ⑤ 去路径化到族名。两簇合计 187 处 · 49 个 token · 38 个文件（本行定稿后的读数，口径含本行自己——语料每轮改写自己的正文，本计划也在语料内，因此这两个总数是当轮证据而不是目标，且与 T7 第 1 步「绝对条数不登记」的口径同源；只作 T7 的分簇输入）；⑤ 簇是本级解析新浮出来的——首条命中那一轮解析到第一个候选就静默通过，这批从未进入清单，因此规则 ⑤ 必须在 T7 这一轮按三级优序普查重跑
- **pin 的定义（§7.1，门的一部分）**：一个反引号 token 只在三条同时成立时才是 pin，否则它是散文词汇、不受本门管辖——① **仓根相对**：`path` 不以 `./` / `../` 开头，也不以 `...` 省略号开头；② **不是产物词汇**：workspace 产物名（`progress.json` · `base.json` · `in-flight.json` · `liveness.json` · `tasks-<N>-<op>.json`）、后缀（`.rulings.json`）、模板（`X.md` · `-overall.md` · `-design.md`）**都是词表条目，不是坐标**；③ **不是易逝物**：按设计在发布时被消费删除的 `.changeset/*.md` 引用是记录而非主张。三条排除就是语料能被 T7 清到零的充分条件，因此它们必须随实现落地
- **排除 ② 的两族匹配规则不同，必须分写**：**产物族**（`progress.json` / `base.json` / `in-flight.json` / `liveness.json` / `tasks-<N>-<op>.json` / `*.rulings.json`）按**形状**匹配——它的具体实例是机器本地路径（`plan-fix-1.c1.rulings.json`、`tasks-1-fix-1-a2.c1.json`、`<workspace>/progress.json`），在别的 clone 里永远不会解析，因此凡以这些名字收尾的 token 都不判；**模板族**（`X.md` / `-overall.md` / `-design.md`）只在该 token **就是**该词表条目时排除——一个真实的 `<dir>/<slug>-design.md` 路径仍是被判的坐标，因为它是本轮注入 `INPUT_SPEC` / `INPUT_OVERALL` 的那一份。用后缀规则扫模板族会让 §7.3 的迁移路径类被静默清空：`docs/kairos/plans/2026-10-10-engine-doc-tooling-p17.md` 里的 docs/kairos/specs/2026-10-10-engine-doc-tooling-overall.md 以 `-overall.md` 收尾，而它正是过期坐标（P17 已把该档迁到 `overalls/`），必须产出 finding 并被 T7 改写成现行路径
- 语料声明写死在测试里、**没有在册清单**：§7.1 全语料 = `docs/kairos/**/*.md` + README 家族（`README.md` · `README.zh-CN.md` · `packages/*/README*.md`），无基线 / 无白名单 / 无豁免；扫描文件数作为语料规模常量钉住——文档进入或离开语料即红
- 门的可红可修成对 pin：播种一条指向不存在符号的 markdown pin ⇒ 红且指出该 pin ⇒ 移除 ⇒ 绿。**零 finding 不是本任务的 checkable**——语料例题的零断言与「The corpus IS clean」那段文件头都已在树上预置，而它今天红在 7 条待建路径上（宪章 3 条与计划 4 条，全部落在 T8 的 `Create:` 行声明的 `census` 登记面与它的结构测试上；按 §7.3 的时间面本应跳过，而那张跳过表还不存在）；T7 交付时间面 + 解析器升级 + 迁移后它才绿（见 T7 Files / Steps）
- `pin-parseability` 的 `test` 面：`pins.guard.test.ts` 里一条以字面量点名 `pin-parseability` 的格题（T1 判据表那一行的 `face: "test"` 由它占位，不 import 注册表）。该名与 §6.2 / §7.4 现在同名（spec v0.10 采纳了 `pins.guard.test.ts`，与仓内 `doc-corpus.guard.test.ts` / `dockey.guard.test.ts` / `phase-inventory.guard.test.ts` 同惯例），因此 v0.4 行记名的那处改名偏差已闭合、不再有偏差可记；本行只钉该执行面落在哪个文件哪条格题上
- 语料二——文档评审回读面（§7.2 第 2 份）：judge 面且为文档评审轮（`TARGET_TYPE` 为 doc 三型）时，在 `#reconstruct` 里对**本轮被审文档的正文**跑一次 markdown 扫描。读缝点名在这里：语料的路径直取 `frame.target`——三个 doc 型（`phase-spec` / `overall` / `single-spec`）的 `frame.target` 是 `{ kind: "spec", doc }`，`doc` 就是那份文档的仓内路径；正文走本类既有的 repo 读（`readFileSync`）。等价路由是 `#artifacts.read({ domain: "doc", slug, docType }, docType, workspace)`：`slug` 来自 `workspace.slug`、`docType` 由 `frame.type` 所指的 doc 型给出，返回的 `path` 与 `frame.target.doc` 在本轮指向同一份文档（`#sceneOf` 已在派发前挡掉重复身份）。身份解析（`--spec` → slug、`SlugIndex` 建索引与回读）发生在 `face/cli.ts#sceneOf`，不属 `#reconstruct`：本条只承接那份解析结果，不重建索引、不把文档正文塞进 `DispatchScene`。`INPUT_SPEC` / `INPUT_OVERALL` 是它的引用，**不是语料**。解析不到的 pin 折算成 `severity: warn` 的 finding 注入 `findings[]`，`summary` 指出失效的 pin；lens 不写死，取该评审面自己声明的 `pinLens`（`render/templates.ts#pinLensOf`，与同一份 `lensEnum` 交叉校验、drift 即抛）——`phase-spec` / `single-spec` 面为 `consistency`，`overall` 面为 `inventory`；它不新增拒绝面（不出 `CDD_BLOCKED`），但**不是结论中性**：warn 按既有语义被 `rollup` 读到，一份带死 pin 的被审文档在文档评审轮落到 `REVIEW_FIX`，而不是停在今天的 `APPROVED`
- 语料三——交接单 finding 行（§7.2 第 3 份）：有 `contract` 则解析其 `path`，失效 ⇒ 追加一条 `severity: warn` 的 finding，lens 同样取该面声明的 `pinLens`（`contract` 这一格在每个判据面上都会出现，因此这一份语料不是 spec 专用：`wave` / `branch` 面为 `standards`、`plan` 面为 `buildability`）（只判 `contract` 这一格，`PinAudit` 的 markdown 扫描永不承接）；追加点与语料二同一处——`#reconstruct` 里、局部 `findings` 取值与 `schema.conclusionOf(plane, draft)` 之前写进 `draft.findings`，因此那一次 `rollup`、`DraftedOutcome.findings` 的投影、载体三处同源；不 BLOCK（无 `CDD_BLOCKED`），本来零 finding 的评审轮因此落到 `REVIEW_FIX` 而不是停在 `APPROVED`。**判点不在 `#materialize`**：`#reconstruct` 先算 `const status = schema.conclusionOf(plane, draft) ?? "BLOCKED"` 再调 `#materialize`，在写者里追加的 warn 会进载体而 `DraftedOutcome.status` 仍是 `APPROVED`——一轮打印一个结论、携带另一个，正是 §2.3「它按 warn 的既有语义参与 `rollup`」与 §7.2「落到 `REVIEW_FIX`，不会停在 `APPROVED`」禁止的形态

#### Steps

- 写失败测试：注入一条指向不存在符号的 markdown pin ⇒ `PinAudit` 非空且指出该 pin，移除 ⇒ 空；扫描文件数等于 §7.1 语料声明；`pins.guard.test.ts` 有一条点名 `pin-parseability` 的格题 — checkable: 红
- 写失败测试（pin 定义的三条排除，各一对）：`./x.ts` 或 `...` 省略形 token ⇒ 零 finding；产物族 token（`progress.json` · `plan-fix-1.c1.rulings.json`）⇒ 零 finding；模板族的裸词（`X.md`）⇒ 零 finding，而同一位置上的真实死引用 docs/kairos/specs/2026-10-10-engine-doc-tooling-overall.md ⇒ 恰一条 finding（两族规则不同，这一对就是分界：模板族按后缀匹配会让它是零 finding）；已消费的 `.changeset/*` 引用 ⇒ 零 finding；而同一位置上仓根相对、非产物词汇、非 changeset 的真死引用仍产 finding — checkable: 红于排除未实现（扫描器把词汇当主张）
- 跑一次三级优序普查（一次性脚本：层级 ① 精确条目优先 → 层级 ② 唯一后缀 → 层级 ③ 歧义）并落读数，按 remedy 分成 ⑧ 簇与 ⑤ 簇——读数只作 T7 的输入，不登记为判据 — checkable: 两簇之和等于普查总数、无 token 落在两簇之外（总数是当轮读数，不是判据——本条不重复登记数字，读数只写在 Produces 的普查行，语料每轮改写自己，钉一个数只会让下一轮读到一条过期断言）；⑤ 簇的每个 token 都是 §7.1 产物词表之外的机器本地名（那一轮的 spec 评审产物 一族，4 个 token），⑧ 簇的每个 token 都只由 basename 写成（4 个 basename）；把某个 ⑤ 簇 token 归进 ⑧ 簇 ⇒ 计数断言红
- 实现三形态解析（§7.1）与缓存符号索引，并把 §7.1 的 pin 定义（三条排除）实现为解析前的筛选；结构测试落在 §7.1 全语料（无在册清单、无基线）— checkable: 播种态红 / 移除后绿，语料规模断言绿，三条排除各一对绿；解析优序的三格、§7.3 的时间面跳过表与零 finding 的断言都不在本块——T7 在同一提交里交付解析器升级、三级优序普查、⑧ 重处置与那张跳过表（见 Files 的「不在本块」）
- 语料二的回读（§7.2 第 2 份）：judge 面且为文档评审轮时，对 `frame.target.doc` 指向的本轮被审文档正文（类既有 `readFileSync`）跑 `PinAudit` 的 markdown 扫描，解析不到的 pin 折算成 warn 追加进 `draft.findings`（lens 取该面声明的 `pinLens`，`phase-spec` / `single-spec` 面为 `consistency`）；随后照既有 rollup 出结论——不调用 `#reject`（无 `CDD_BLOCKED`）— checkable: 成对 pin 绿——干净的被审文档 ⇒ 零注入 finding、结论与注入前相同（`APPROVED` 仍 `APPROVED`）；文档里一条解析不到的 pin ⇒ 恰好多一条 warn、零 blocker、结论落 `REVIEW_FIX`；把注入行的 lens 改成字面量、或让某面 `pinLens` 与其 `lensEnum` 不一致 ⇒ `templates.test.ts` 的 drift 格题红
- 语料三的回读（§7.2 第 3 份）：在 `#reconstruct` 里、`schema.conclusionOf` 之前，有 `contract` 则解析 `path`；失败则把 `severity: warn` 的 finding（lens 取该面声明的 `pinLens`）追加进 `draft.findings`（与语料二同一注入点、同一次 `rollup`），不调用 `#reject`；`#materialize` 照常写载体并由 `#findingsList` 给注入行编 `id` — checkable: 成对 pin 绿——零 finding 的评审轮带一条失效 `contract.path` ⇒ 无 `CDD_BLOCKED`、结论 `REVIEW_FIX`（不是 `APPROVED`）；`path` 可解析 ⇒ 结论不变；把注入点挪到 `#materialize` ⇒ 结论那条 pin 红（载体里多一条 warn，而 `DraftedOutcome.status` 仍 `APPROVED`）
- 写 changeset（minor · 简述三级边界 / impact 门 / lens 问句 / wave 注入 / regrade 标记 / pin 门）+ `pnpm run validate` — checkable: validate exit 0；changeset 在册
- 提交 — checkable: commit 存在

#### Acceptance

AC ⑥（一条判据、三份语料、两个执行面；成对 pin 逐条：语料一的门可红可修 · 干净的被审文档 ⇒ 零注入且结论不变 · 一条死 pin ⇒ 恰一条 warn、零 blocker、落 `REVIEW_FIX` · `contract.path` 失效 ⇒ 无 `CDD_BLOCKED` 且落 `REVIEW_FIX` 而非 `APPROVED`——两份回读语料同在 `#reconstruct`、同在 `conclusionOf` 之前注入 `draft.findings`，判与写分属 `#reconstruct` / `#materialize` 而同属一条回读面；pin 定义的三条排除各有成对 pin——排除 ② 的两族各一条：产物族按形状、模板族只判裸词本身，真实 `<dir>/<slug>-overall.md` 死引用仍产 finding）+ AC ⑧（`validate` 全绿 · changeset `cdd-engine` minor）。语料声明与规模 pin 在册。注入行的 lens 不由本块写死：每面取自己声明的 `pinLensOf(type)`，drift 的成对格题在 `render/__tests__/templates.test.ts`（drifted `lensEnum` ⇒ `pinLensOf` 抛；每个判据面的注入行恰带 `pinLensOf(type)`）。**零 finding 的读数按判据分级，两级不并读**：`pins.guard.test.ts` 的语料例题已是 `expect(audit.scan(CORPUS_ROOTS).length).toBe(0)`、文件头已是迁移后的陈述——两处都预置在树上，而 T6 交付时那条题红在 7 条 finding 上（实测：宪章 3 条与计划 4 条，全部落在 T8 的 `Create:` 行声明的 `census` 登记面与它的结构测试上），全部由同 slug 计划声明、树中缺席、`Implementation plan` 格仍 `[Pending]`，按 §7.3 的时间面本应跳过；这 7 条是 T7 之前的前像，不再作门的上线读数。**层级 ①→③ 判据下、79 文件语料上的零已是交付读数**——T7 已落地（时间面跳过表 · `PinIndex.resolvePath` 的升级 · 规则 ⑧ 的重处置同处一条提交），语料例题今天绿、规模 pin 同时绿。那一级由 T7 一次交付的三件事共同给出：§7.3 的时间面跳过表 · `PinIndex.resolvePath` 的层级 ①→③ 升级（层级 ① 精确条目优先 · 层级 ② 唯一后缀 · 层级 ③ 歧义）· 规则 ⑧ 的重处置；三件同处一条提交因此能一起变绿。因此 T6 只证明门能红（播种一条坏 pin ⇒ 红 ⇒ 移除 ⇒ 绿），不宣称语料已零；T8 的 `census:pin.total = 0` 因此只有一个来源——T7 那一级读数，加上 T8 自己那次成员迁移之后同一次扫描的零（同一个函数的一次读数，先后见 T8 · Steps 第 4 步的 ③ 与 ④）。§7.1 在 spec v0.18 又添了成员引用形态与 `::` 测试 pin 两项判据：后者随测试形态已在树（`PinShape` 的 `test` 值），前者由 T8 承接（见 T8 · Files 第 3 条），本块的字面面不回溯认领。

#### DependsOn

3

### Task 7: 存量 pin 迁移（按 finding 形态处置：省略 · 被举作字符串的示例去路径化 · 过期引用 · 迁移路径（含缩写补全） · 本仓之外坐标去路径化 · 机器本地产物名去路径化 · 行号收口 · 死符号去反引号 · 歧义 basename 写全路径）

#### Objective

落地 spec §7.3：把全语料的 pin 清到零 finding，作为门的上线条件。只改坐标与引用句，不改任何结论、裁定或交付记录。处置规则按门**实际产出的 finding 形态**定，不按 §7.3 的三类名定——那三类名只覆盖 `path` 形态的一支，而门今天在这份语料上产出的**全是 `path`**——写本文时实测 `symbol` 0 条 · `path` 7 条（见第 1 步），`symbol` 形态今天一条也没有；没有对应规则就等于把规则留给实现者临场发明，而最省力的发明是给整片历史叙述去反引号或者改写句子。规则 ⑦ 因此是给此后仍会出现的 `symbol` 形态留的处置面，不是今天清单的主体。本任务另承接同一判据的实现半边——`PinIndex.resolvePath` 的层级 ①→③ 升级、歧义 finding 形态，以及 §7.3 的**时间面跳过表**（三件同在 `contract/pins.ts`、同一次提交）——不动结论面。时间面挂在这里而不在 T6 / T8：它判的是同一次扫描的读数，而本任务正是让那条读数归零的那一轮；T8 只消费它的结果（`pin.total`），不另造一套。

#### Files

- Modify: `docs/kairos/**/*.md` 与 README 家族中携带失效 pin 的文档（按下面八条处置规则；已消费 `.changeset/*` 不在其中——§7.1 的排除 3 已判其为记录，它们产不了 finding；本计划自身也在语料内，迁移波次同时清理它）
- Modify: `packages/cdd-engine/src-next/contract/__tests__/pins.guard.test.ts`（**这两处已经是预置的迁移后形态，本任务只让它们变绿，不重写这两处字节**：语料例题已是 `expect(audit.scan(CORPUS_ROOTS).length).toBe(0)`、文件头已是「The corpus IS clean, and this file holds it there」；而那条题今天红在 7 条 finding 上（宪章 3 条 · 本计划 4 条，全部落在 T8 的 `Create:` 行声明的 `census` 登记面与它的结构测试上），全部由 §7.3 的时间面跳过——同 slug 计划声明 · 树中缺席 · `Implementation plan` 格仍 `[Pending]`；同一例题里的语料规模长度 pin 保留。本任务另在同一文件接上三格（与解析器同提交）：层级 ① 精确优先（`README.md` ⇒ 仓根那份）· 层级 ② 唯一尾形（`face/declare.ts`）· 层级 ③ 真歧义（declare.ts 一条点名全部候选的 finding），再接一条时间面的成对 pin（见 Steps 第 4 步）。T6 的播种态红 / 移除后绿仍是**独立例题**，不被这次动作覆盖——两条相反的断言同处一套件会让它永久红，而本任务又要求它绿）
- Modify: `packages/cdd-engine/src-next/contract/pins.ts`（**两件事同一提交**：① `PinIndex.resolvePath` 由 `entries().find(...)` 的首条命中改为层级 ① 精确条目 → 层级 ② 唯一后缀 → 层级 ③ 歧义，并新增歧义 finding 形态（一条 finding 点名该 pin 与全部候选）；② §7.3 的时间面跳过表——三条同时成立即跳过，判定只发生在 `PinAudit` 一处，待建路径表在判定前一次算好，`scan` / `scanText` / `pathResolves` 三份语料读同一张表。三件缺一不可：只修解析器会让上面那条零断言红在当轮普查读到的未重处置歧义词上（读数见 T6 · Produces 的普查行），只做 ⑧ 则歧义产不出 finding，时间面缺席则 T8 的 `Create:` 行让那条零断言红在今天这 7 条上）
- Modify: `packages/cdd-engine/src-next/face/lifecycle.ts`（语料三的调用点这一半：`#contractPinRows` 今天只把 pin 递给 `PinAudit.pathResolves`，被审身份因此到不了时间面——本任务把该轮的 judged 文档一并传入 `pathResolves(pinPath, judged)`（`spec` / `plan` 面取 `frame.target.doc`，`wave` / `branch` 面传 `null`）；`scan` / `scanText` 的 `source` 已是那份被判文档，签名不动。这次改动落在 `#reconstruct` 既有的注入点里，不建第二个判点、不改 `#materialize`；本文件按 rule zero 免于类上限）
- Modify: `packages/cdd-engine/src-next/face/__tests__/lifecycle.test.ts`（时间面在调用点的成对 pin：同一个被判文档 + 一条待建 `contract.path` ⇒ 该轮零注入 finding；判据不变、把 `judged` 传成 `null` ⇒ 同一 pin 产一条 warn、结论落 `REVIEW_FIX`）
- Modify: `.changeset/p37-grading-boundary.md`（pin 门段落写明本轮交付的判据（层级 ①→③）与它此刻度量的那一级零）

#### Consumes

- T6 的 `PinAudit` 与 pin 定义（三条排除）

#### Produces

- 全语料 `PinAudit` 零 finding——它是本任务一次交付的三件事共同给出的读数：三级优序解析 · 规则 ⑧ 的重处置 · §7.3 的时间面跳过表（待建路径在作者态被跳过、落地后解析得到，两态同一个读数，见 Acceptance）。迁移清单按「谁读」分两处落：**八类处置条数与例外总条数**进本任务提交信息（一段可读的开场披露，与前几轮同形）；**例外行的逐条点名**（file · line · rule · token · clause 五格，条数与提交信息那段相等）落在本任务工作区的实现报告 `tasks-7-implement-1-report.md` 的边界核验表里。那张表是「结论一个字未动」这条界线的唯一可复现载体：提交信息只有总条数，重核者需要逐行对得上才验得了这条界线，因此报告名写在这里，并与本轮的记录（交接单的 `artifacts`）互相指认；**提交信息只承条数与残留段落**，表名不写进去——提交信息没有这个槽，承诺它只会让重核者在历史里找不到（工作区产物不入库，只写表名而不写报告名等于没写）
- **§7.3 的时间面跳过表（本任务新增的面，落在 `PinAudit` 一处）**：三条同时成立才跳过——① **声明**：该路径按 §7.1 的后缀形态，是某份计划文档某条 `Create:` 行所写路径的后缀或全等，且该计划与被审文档共一个身份键（被审文档的 `slug:` 等于该计划的 `slug:`，或等于该计划身份文档声明的 `program:`，两个键都只读 front-matter 的声明值，经 `SlugIndex#docsOf` / `SlugIndex#overallOf` 取，不按文件名推演）；② **缺席**：§7.1 的三级优序解析不到；③ **未关闭**：该计划尚未被闭合登记面点名——母宪章 `## Phase inventory` 的 `Implementation plan` 格写成 `✔ Done（…）`，且该文件名在 `SlugIndex#entries` 的 `DocEntry.rel` 文件名部分命中恰一份并与计划同 `slug:`（零命中与不唯一命中同判「已关闭」）；`program:` 缺席、`program:` 解析不到母宪章、或母宪章无 `## Phase inventory` 时，跳过以**声明本身**为界：计划仍在树上且仍写着这条 `Create:` 行即算未关闭。待建路径表在判定前**一次算好**，`scan`（全语料）· `scanText`（被审文档正文）· `pathResolves`（交接单 finding 行的 `contract.path`）读同一张表——因此同一条待建路径在三份语料上得到同一答案，T8 的 `pin.total` 也就是这一次扫描的读数；跳过只在 `PinAudit` 判，调用方不各自再判一次
- **被审身份的接口面（同一处判据，不在调用方补判）**：条件 ① 要「该计划与被审文档共一个身份键」，身份因此必须到得了判据——`scan` 与 `scanText` 的 `source` 已经是那份被判文档，`pathResolves` 补第二参 `judged: string | null`（被判文档的仓内路径，`null` = 本轮没有被判文档），三份语料因此读同一张表、判同一个身份；`face/lifecycle.ts#contractPinRows` 在 `frame.target.kind` 为 `spec` / `plan` 时传 `frame.target.doc`（两者都是 `AuditTarget` 的带 `doc` 形态）
- **`null` 是判定的答案，不是漏参**：`wave` / `branch` 面的 `AuditTarget` 不带 `doc`（`{ kind: "wave"; tasks }` / `{ kind: "branch" }`），条件 ① 无主语、跳过不成立，该轮的 `contract.path` 只按解析结果判——一条 `Create:` 声明的待建路径在 wave / branch 轮**产** finding，这正是 §7.2 的 `standards` 臂要的：finding 的 `contract` 主张要落在今天是仓里的面上。§7.3 要拆的那个环是「文档评审在相位落地前不可能收敛」，wave / branch 不是文档评审，不受这条豁免；「三份语料同一个答案」按同一个被判身份成立，不跨身份

#### Steps

- 跑 `PinAudit` 全量扫描并落清单——**按 finding 形态分，不按 §7.3 的三类名分**：门今天只产出两种形态，`symbol`（裸符号）与 `path`（路径 / 带行号范围）。首次全语料扫描以已交付的 `PinAudit` 实测，写本文时的读数是 `symbol` 0 条 · `path` 7 条（79 文件；宪章 3 条 · 本计划 4 条，全部落在 T8 的 `Create:` 行声明的 `census` 登记面与它的结构测试上，正是本任务的时间面要跳过的那一批）；v0.20 之前记的「`symbol` 约八成 · `path` 约两成」是文档重写前那一轮的读数，已失效、撤回。解析器升级之后另加歧义普查的一批，分簇读数只登记在 T6 · Produces 的普查行，本行不重复。**这些数都是当轮证据、不是预登记的目标**——语料每一轮 fix 都会改写它自己的正文（本计划与 spec 也在语料内），迁移的判据是重扫归零，不是把某个数改对 — checkable: 清单里每一条 finding 都能落到下面八条规则中一条的触发词或 remedy 上（两者命中其一即算归属——缩写只命中 remedy；仍归不进 ①–⑤ 的由末条兜底按 ④ 的 remedy 处置；⑧ 一类由本轮的解析器升级触发（见第 3 步），清单必须有它的条目，为零时明写「⑧ 0 处」而不是省略这一类），无一条落空；`path` 的每一支（省略 · 被举作字符串的示例与占位 · 目标已消失 · 搬迁或缩写 · 本仓之外坐标 · 机器本地产物名 · 越界行号）各有一条点名它的规则，`symbol` 今天为 0 条、由规则 ⑦ 承接（形态 0 条即明写「⑦ 0 处」，不省略这一类），不是留给实现者临场发明
- 按 finding 形态处置：**先给每个 `path` token 定一条路径规则**（①–⑤，按下列顺序取第一条命中），**再对处置后仍带行号的 pin 统一收口**（⑥），`symbol` token 走 ⑦，**走完层级 ① 的精确条目优先后同一后缀仍命中多条候选的 `path` token 走 ⑧**：① `path` · **被当作字符串举出来的字符串**——从不是坐标，或是被引作它所要举例的那条的过去坐标（U+2026 形 · 夹在路径中间的 `...`（以 `...` 开头的 token 已由 §7.1 排除 ① 挡在门外）· 从未存在过的示意路径与示例占位名 · 一份曾经真实、如今已过期却被引作某条规则之例证的坐标）⇒ 去路径化并保留「当时取的是哪一类文档 / 哪一份产物」这个事实，**不得**写成「目标已按设计消失」——它从来不是坐标，只是一段被举出来的字符串。**改写这类 token 是禁止动作**：把例证字符串改写成本轮现行坐标，例证与它要说明的那件事就变成同一个东西，读者再也看不出那是一条过期坐标；因此这类 token 不能归入 ③，即便它在今天已可被写全 · ② `path` · 目标已按设计消失（已删的 doc 目录 · 已退役的脚本 · 已退役的产物名）⇒ 改为不指路径的表述、保留「当时做了什么」（§7.3 过期引用删除）· ③ `path` · 目标已搬迁或改名，或只是被写成了现行文件的缩写（省略前导目录 / 代号的简写，目标从未搬过）⇒ 写全现行路径（§7.3 迁移路径修正；本相位把缩写并入本条 remedy——触发词判「搬过或改过名」，remedy 判「写全就行」，缩写只命中 remedy）· ④ `path` · 本仓之外的坐标（第三方包内部文件 · 兄弟插件的 agent / skill 文件 · 不带目录的包外裸文件名）⇒ 去路径化：点名包或插件与它对外的入口，不写包内文件——这类路径随依赖版本消失，在别的 clone 里不可维护（本相位新立；§7.3 未列，因为它不是本仓的坐标）· ⑤ `path` · 机器本地 workspace 产物名，且不在 §7.1 的产物词表内（`tasks-<N>-<op>.json` 之外的评审 / 取证产物名）⇒ 去路径化到族名（只说「那一轮的评审产物」，不写文件名），不许把机器本地名原样留下。**扩产物词表这条路本相位不走**：§7.1 的产物词表由 P36 的产物矩阵（`session/round-artifacts.ts` 的 `DEFAULT_DOMAINS`，经 `ArtifactRegistry.ownsName` 判名）拥有，那是一张带自己身份门与轮回 pin 的闭集，把机器本地名教进去等于在「重扫归零」这件被它判的事上挪动判据——判据与它判的对象会挤进同一个任务，且那个文件不在本任务的 Files 内、新条目也没有成对 pin 覆盖。去路径化到族名是唯一一条路，也是够用的一条（本相位新立；六名词表没覆盖它，门因此把它当坐标）。**本轮必须按三级优序普查重跑 ⑤**：首条命中那一轮的 ⑤ 只处置了 7 处（它跑的是首条命中普查），那一轮的 spec 评审产物 一族 4 个 token · 22 处各自静默解析到第一个候选、从未被报出，因此这批在本轮首次进入清单，不得因「上一轮已清过 ⑤」而跳过· ⑥ 行号收口（与路径规则叠加，不与它们竞争）：处置之后仍带行号的 pin 一律改成路径 + 符号、不留行号（§7.3 行号越界修正）——路径可解析、只是行号越界的由本条单独收口；既缩写又越界的先由 ③ 写全路径、再由本条去掉行号；**行号本身不是越界证据**——判越界只能按层级 ① / 层级 ② 解析出的那份文件的行数（取首条命中得来的「越界」是判据的错，不是坐标的错，本条因此不为它写回填动作） · ⑦ `symbol` · 裸符号解析不到（已改名 / 已删除的标识符 · 只活在历史叙述里的常量 · 语言内置的全局名）⇒ 去反引号，让它从主张退回散文词汇；若它仍指今天树里的某个符号、只是名字过了时，改为今天的符号名 · ⑧ `path` · **歧义**——规则 ①–⑤ 都不认领（token 是一条现存的仓内坐标，不是示例、不是已消失目标、不是缩写、不是包外坐标、不是机器本地产物名），而走完层级 ① 的精确条目优先后同一后缀仍命中多条仓内条目（只由 basename 写成的 declare.ts · run.ts · SKILL.md · CHANGELOG.md 及其 `:line` 形是本簇的全部四组；机器本地名那批归 ⑤，见上条）⇒ **写全现行路径**，把它钉到上下文所指的那一份（remedy 与 ③ 同形，触发词不同：③ 判「搬过 / 改过名 / 写成缩写」，⑧ 判「同时有多份现存候选」，同一 token 只命中其中一条）。⑧ **不是已交付的一类**：首次匹配那一轮的解析器取首条命中，歧义 token 从未进入迁移清单，也不许在这一类上补记已完成的处置；而交付态树里 `pins.guard.test.ts` 的语料例题已经断言零 finding——`PinIndex.resolvePath` 的层级 ①→③ 升级因此必须在本次迁移的同一提交里落地（`contract/pins.ts` 与本任务同在 Files 内，见 T6 Files 的「不在本块」与下面第 3 步）——只修解析器会让那条零断言红在这批 token 上，只做 ⑧ 而解析器仍取首条命中则歧义产不出 finding、⑧ 无从触发。本轮起手先跑一次经三级优序的歧义普查（读数不登记为判据，理由同第 1 步），口径是**零歧义 token**，不是某个固定条数。末了一条是兜底而不是裁量：任何仍归不进 ①–⑤ 的 `path` token 按 ④ 的 remedy 处置（点名所属包 / 仓库与它对外的入口、保留事实），并把该形状补回本清单——remedy 已钉死，实现者只补形状、不补做法。八条都只动坐标与引用句，结论面一个字不动 — checkable: 重扫 finding 归零，且清单上每条 finding 的处置可逐条对照（删的删、改的改），没有一条是靠改写句子「看起来清掉」的
- 升级 `PinIndex.resolvePath` 与歧义 finding 形态，并给 `pins.guard.test.ts` 接上三格（层级 ① 精确优先 · 层级 ② 唯一尾形 · 层级 ③ 真歧义）：① `README.md` 解析到仓根那份、行号按它的行数判（取首条命中会落到更短的那份，一条合法行号 pin 因此被判越界）；② `face/declare.ts` 落到唯一那份；③ declare.ts 产出恰一条点名两个候选的 finding，而不是静默取第一条给出「可解析」的判词 — checkable: 三格全绿且语料零断言仍绿；把 `PinIndex#resolve` 换回首条命中 ⇒ 前两格红、第三格不再产出 finding（歧义 disappeared 也是一个信号：那一格必须红，不是绿）
- 实现 §7.3 的时间面跳过表并给它一条成对 pin（与上面那条同提交）：待建路径表按三条判一次，`scan` / `scanText` / `pathResolves` 共用。pin 的两格方向相反：一份 single-spec + 同 slug 计划的 fixture 里（被判文档就是那份 single-spec），计划的 `Create:` 行声明一条树上不存在的路径 ⇒ 三份语料**都不产** finding；**把这条 `Create:` 行从计划里删掉** ⇒ 同一路径**产** finding（无 `program:` 时边界就是声明本身，spec 没有 per-slug 关闭标记可设）。`program:` fixture 另有一格：身份文档声明 `program:` 指向带 `## Phase inventory` 的宪章时，同一路径在那行的 `Implementation plan` 格写成 `✔ Done（…）` 之后产 finding；再叠两格：**三份语料同答案**——三份语料以同一个被判身份调用（`scan` 扫描到的那份文件即被判文档、`scanText` 的 `source` 同它、`pathResolves` 的 `judged` 同它），三处读数各自记（`scan` 的清单里不出现这条 · `scanText` 结果为空 · `pathResolves` 返回 `true`），把 `pathResolves` 的 `judged` 传成 `null` ⇒ 只有它把该路径判成不解析、另两份读数不变；把跳过判定挑到调用方、让 `scanText` 自己再判一次 ⇒ 同答案那一格红——`pin.total` 的同源 pin 不在本块：那个读数由 T8 的 `PinAudit.census()` 供，本块跑在它之前（见 T8 第 3 步）；**身份不同即不跳过**——同一个被判文档换成另一份 `slug:` 不同的计划声明同一条路径 ⇒ 跳过不成立、该路径产 finding（`judged` 传进来才判得动这一格）— checkable: 成对的两格方向相反，任一格绿另一格红即失败；`program:` 那格把 `✔ Done（…）` 改回 `[Pending]` ⇒ 恢复为零
- 残留比对（保存边界的一次性核验，不是新门——§7.4 的窄形态不变）：对每个改动文件，取迁移前提交里的同一路径作前像、工作副本作后像，两侧各剥掉行内代码段（`git show` 前像 · 一次性脚本剥段），**并在两侧把清单上该文件被报告的 token 抹成空白**，然后逐行比对——token 自己的位移（去反引号、写全路径、去路径化）因此不产生差异，而同一行上任何散文改动仍会显形。残留差异必须为空；例外**只按点名从句成立、不按子串成立**：剥段并把该文件被报告的 token 抹白之后，再在两侧各删掉这条 finding 逼出来的那处引用从句（每一处在迁移清单里挨着它的 finding `id` 点名，写出改前 / 改后的句子），余下的字节必须逐字相同；落在这处点名从句之外的任何残留 ⇒ 红。子串判法不可用：规则 ① ② ④ ⑤ 的 remedy 全都是在原路径位置上**加一个从句**，而「抹 token 后的差异串是被删部分的子串」只认删除，会把这几条规则要求的改写全部判红，于是最省力的绿是停用这条核验。「该行迁移前带过一条被报告的 finding」不自动获得例外资格——抹 token、删点名从句之后仍报差异的行才算例外，逐条点名也只在这些行上做 — checkable: 播种一对后像——同一行只去反引号 ⇒ 零残留差异、不占例外名额；同一行按规则 ② 把一处指向已退役目录的引用改写成不指路径的表述（路径位置上换成一个从句）⇒ 抹 token 并删掉该处点名从句后余量为空、绿；同一行再在这处点名从句之外把「三条」改成「两条」⇒ 残留落在点名从句之外、无例外资格 ⇒ 比对红。清单的例外条数 = 比对报出的例外行数，每一处都点得出它清掉的是哪条 finding
- 跑 pin 门与 doc 契约的六条腿，逐条点名文件而不是写一个 `vitest run` 认不得的族名（`doc-contract` 是 `contract/rules.ts` 里的门概念，不是套件）：`pnpm -C packages/cdd-engine exec vitest run src-next/contract/__tests__/pins.guard.test.ts src-next/contract/__tests__/doc-corpus.guard.test.ts src-next/contract/__tests__/dockey.guard.test.ts src-next/contract/__tests__/phase-inventory.guard.test.ts src-next/contract/__tests__/structure-pin.test.ts src-next/contract/__tests__/change-history-header.test.ts` — 这五条 doc 契约腿分别是语料清单 · doc 键 · 相位标识 · 结构 pin · 变更史表头，迁移会同时动到它们所判的字节 — checkable: 六条命令全绿，且文档结构 / 变更史 / 相位标识未被迁移破坏
- 提交 — checkable: commit 信息含八类处置条数（⑧ 单独记、不并入 ③；本条若为零须明写「⑧ 0 处 · 歧义普查 N 个 token」，让零是记账的一行而不是漏项）与残留比对的例外条数；实现报告的表名不写进提交信息——它记在本轮的记录里（交接单的 `artifacts` 与本任务工作区的 `tasks-7-implement-1-report.md`，见 Produces）

#### Acceptance

全语料零 finding（无基线 / 无白名单 / 无豁免）——**今日哪一级都不是零，因此这一句只在本任务这一轮可判**：`pins.guard.test.ts` 的语料例题已预置成 `toBe(0)`，而它今天红在 7 条 forward path 上（宪章 3 条 · 本计划 4 条，全部落在 T8 的 `Create:` 行声明的 `census` 登记面与它的结构测试上）。因此本任务同一提交里要交齐三件才能让那条题变绿：`PinIndex.resolvePath` 的层级 ①→③ 升级、三级优序普查与 ⑧ 的重处置、以及 §7.3 的时间面跳过表（待建路径在作者态被跳过、落地后解析得到，两态同一个读数）；缺哪一件就红在它自己没交付的那一半上（缺时间面 ⇒ 红在今天这 7 条；缺解析器 ⇒ 红在歧义词上；缺迁移 ⇒ 红在未处置的 token 上）。解析优序的三条腿逐条成对 pin：层级 ① 精确条目优先（`README.md` ⇒ 仓根那份、行号按它的行数判；取首条命中落到更短那份 ⇒ 红）· 层级 ② 唯一后缀命中（`face/declare.ts` ⇒ 唯一那份、行号按命中那份判）· 层级 ③ 两条都不成立 ⇒ 一条点名全部候选的 finding；时间面逐条成对 pin：跳过 ⇒ 三份语料都不产 finding · 删掉声明的 `Create:` 行 ⇒ 同一路径产 finding（无 `program:` 时边界就是声明本身，不引入 spec 未声明的关闭标记）· `program:` fixture 上 `Implementation plan` 格写成 `✔ Done（…）` ⇒ 跳过失效、同一路径产 finding · 三份语料以同一个被判身份读同一张表（把 `pathResolves` 的 `judged` 传成 `null` ⇒ 只有它将同一路径判成不解析、另两份读数不变；把跳过判定挑到调用方 ⇒ 同答案那条 pin 红）· 被判文档换成一个 `slug:` 不同的计划声明同一条路径 ⇒ 跳过不成立、该路径产 finding · `wave` / `branch` 轮（`judged` 为 `null`）一条待建 `contract.path` ⇒ 产 finding 一条 warn（`face/__tests__/lifecycle.test.ts` 成对：`judged` 有值 ⇒ 零注入）；doc 契约全绿；八条处置规则覆盖清单上的每一条 finding（触发词或 remedy 命中，无一条落空；仍归不进 ①–⑤ 的由末条兜底处置，remedy 钉死）——规则 ① 的触发词是「被当作字符串举出来的字符串」（从不是坐标，或过去坐标被引作例证），这类 token 的 remedy 不含「写全现行坐标」，因此语料里被引作例证的过去坐标不归 ③、也不会被迁移写回现行路径；迁移未改动任何结论或交付记录——这条边界有一步核验而不是只有一句承诺：每个改动文件的行内代码段剥掉后、再抹掉该文件被报告的 token，与其迁移前副本逐行比对，残留差异为空；例外只许落在迁移清单里点名的那处引用从句内部（抹 token 之后再在两侧删掉该从句，余量逐字相同），且只在这些行上逐条点名、条数相等；落在点名从句之外的残留一律红。「该行迁移前带过 finding」本身不是例外资格：同一行只去反引号 ⇒ 零残留差异、不占名额；同一行按规则 ② 换成一个从句（规则 remedy 的常态是加从句而不是删）⇒ 删掉点名从句后余量为空、绿；再在这处从句之外把「三条」改成「两条」⇒ 残留落在点名从句之外 ⇒ 核验红，而 pin 门与 doc 契约套件在这处改动上都是绿的（这正是要这条核验来兜的那一类改动）。「doc 契约全绿」落到五条具体腿上（语料清单 · doc 键 · 相位标识 · 结构 pin · 变更史表头），不写族名。发布说明同步收口：`.changeset/p37-grading-boundary.md` 的 pin 门段落点明本轮交付的判据（层级 ①→③）与它此刻度量的那一级零——发布说明宣称的零必须是包真正度量的那一级。

#### DependsOn

6

### Task 8: 计数的执行面（`contract/census.ts` + `census:` 门）

#### Objective

落地 spec §8：把 `count` claim 从写作规范变成可核引用——`census:<id> = <n>` 由门解析到登记面并比对导出值，不等即红、未知 id 即抛。首个登记项是 `PinAudit.census()`。本块同时承接 §7.1 的成员引用形态（spec v0.18 的判据），因此还要把该判据上线后暴露的存量成员 token 迁到零——「语料绿」这个读数由本块自己挣回来，不是继承来的。

#### Files

- Create: `packages/cdd-engine/src-next/contract/census.ts`
- Create: `packages/cdd-engine/src-next/contract/__tests__/census.guard.test.ts`
- Modify: `packages/cdd-engine/src-next/contract/pins.ts`（**三件事同一提交**：① **语料声明的单一来源**——§7.1 的语料根从测试文件移进本模块，落成**纯函数** `corpusOf(root)`：README 半边在调用时按 `packages/` 展开（仍是规则、不是清单），`scan` / `filesOf` / `census` 与结构测试因此读同一份声明；**根从调用方来、声明在 import 时惰性**——`contract/pins.ts` 已在 `face/lifecycle.ts` 的 import 图上（每条 `cdd` 命令都载入它），模块作用域的文件系统读在 `src-next` 零先例，且消费方装进 `node_modules` 后其下没有 `packages/` 树，import 期展开会让每条命令在载入时抛（`check:dist-smoke` 在仓内跑，看不见这一类）；规模常量仍留在测试文件里作长度 pin，不由 `filesOf` 反算——反算出来的数只是同义反复，文档进出语料就不再变红；② 导出 `census(roots)`：四个读数 `symbol` / `path` / `total` / `files`——`symbol` 与 `path` 按形类别计数，其中 **`path` 覆盖 `PinShape` 的 `"path"` 与 `"test"` 两值**（只数 `"path"` 会让 `total` 少掉每一条死题名），`total` 是扫描条数（等于 `scan` 的 length，不是第三次数），`files` 取 `filesOf` 的语料文件数（体积，不是 finding 数）；与 `scan` 同源，不二次解析；`roots` 由调用方传入它已解析的那份语料——测试面与 `pins.guard.test.ts` 同一个根来源（`import.meta.url` 推出仓根 → `new PinAudit(root)` → `corpusOf(root)`），生产侧若读它，根的唯一来源是 `face/cli.ts#rootOf()`；③ §7.1 的**成员引用形态**（spec v0.18 新增的判据，此前无主）：`PinShape` 今天只有 `"path" | "symbol" | "test"`、没有成员分支，载体 + 成员连写成一枚 token 时要么整枚落成散文、要么只报出前半，本块把它落成裸符号形态的连写——尾随的 `(...)` 实参先剥；token 里有 `#` 时以**最后一个** `#` 为界（路径载体自己带点），否则以**第一个** `.` 为界；前半是载体，按裸路径或裸符号形态过筛（路径仍走三级优序，过不了筛即散文），后半过**同一套**符号形状判据；**两半都过筛而任一半解析不到 ⇒ 该 token 产一条 finding**；**空载体不是成员引用**——以 `#` 开头的 token 取最后一个 `#` 时界就在首位、载体是空串，此时**不进入成员分支**，回落到底下的裸符号形态按整枚 token 判（`#` 在这里是它自己的符号前缀，不是载体与成员之间的分隔符）：语料里以 `#` 开头的裸符号正是靠这条回落解析的，死成员连写也要靠它才产得出 finding——少了这条守卫，两种都被判成散文、一批 token 静默失去覆盖。这条守卫是 §7.1 成员段的缺口：该段今天只写到「过不了筛即散文」，本块把它的判据意图写实；spec 侧同一句随 spec 面的修复轮补，落地面以本句为准。形态仍是 `"symbol"`，`PinShape` 不新增取值，三行计数的口径因此不变；形状判据也不被分隔符改写，小写成员名与裸小写词同判散文）
- Modify: `packages/cdd-engine/src-next/contract/__tests__/pins.guard.test.ts`（三件事：① 语料根改为 import `contract/pins.ts` 的 `corpusOf(root)`，本地那份 `PACKAGE_READMES` 声明删掉，`CORPUS_SIZE` 的长度 pin 保留为本地字面量；② §7.1 成员形态的成对格题——两半都在索引里的连写（`HandoffSchema.gradingViolations`）⇒ 零 finding；载体在、成员不在（写成 HandoffSchema.ZzNoMemberQq）⇒ 恰一条 finding 点名该 token；成员在、载体不在（写成 ZzNoCarrierQq#summaryToken）⇒ 恰一条 finding；小写成员名（`impact.scenario`）⇒ 零 finding；尾随实参（`BoardView#summaryToken()`）⇒ 剥掉 `()` 后与不带实参那一格同判；空载体的两格（成对）——一枚以 `#` 开头、成员名不在索引里的 token（死成员名在测试里现写，本体不入语料）⇒ 恰一条 `symbol` finding 点名该 token，而一枚以 `#` 开头、成员在索引里的 token（`#reconstruct`）⇒ 零 finding；两格方向相反：把「空载体即散文」实现进去，死成员那格由「恰一条」掉到零因而红，活成员那格两读法都绿——正是死成员那一格把两种读法分开；③ 语料身份的一道成对 pin——同一份语料的两处读数不得分叉：登记表的 `pin.files` 等于本地 `CORPUS_SIZE` 那个字面量、`pin.total` 等于同一 `PinAudit` 在 `corpusOf(root)` 上的 `scan(...)` length；把语料换成空集、或让两处各读一份声明 ⇒ 该格红，一个量不到文件的 census 因此不许静默全绿）
- Modify: **成员引用形态上线后在 §7.1 语料里落成 finding 的存量文档**（`docs/kairos/**/*.md` 与 README 家族都在扫描根内；本块**不预先登记文件清单与条数**——§7.3 的原则是「首次扫描的 finding 集就是待改清单」，完成的判据是同一扫描的零）：remedy 只沿用 T7 已建立的那一套（规则 ⑦ 的三支，一支不减）——载体与成员都还在 ⇒ 写成现行的成员名；载体在、成员今天仍存在、只是名字过了时 ⇒ **改成今天的符号名**；载体在、成员已从树上消失 ⇒ 去反引号退回散文，保留「当时指什么」而不留死号。中间那一支不是可省的：把它并进第三支，一条仍站得住的坐标就被降级成散文，「T7 升级的是哪个方法」这件事随之从文档里消失，而本行要处理的正是这一支的存量。零结论、零裁定、零交付记录改动（§7.3 对 D22 的反转边界逐字适用）。**与 Files 里 `pins.ts` 那一条的 ③ 同一提交**：成员判据先落地会让语料例题的 `expect(audit.scan(...).length).toBe(0)` 红在一批成员 token 上，迁移在同一次提交里把它收回到零。本计划自己就是中间那一支的实例：`PinIndex.resolvePath` 这一形在本文里出现若干处（含本行这一处），而今天的成员名是 `PinIndex#resolve`——T7 · Steps 第 3 步已按今天的名字写着它；迁移时这些 token 全部落到中间那一支，写成今天的成员名，而不是按第三支退回散文。本行把这个实例写出来不构成一处新造的死坐标：它就是待迁清单上的一枚，迁移后与其余各处同为今天的名字
- Modify: `.changeset/p37-grading-boundary.md`（续写一段 `census:` 门的消费者说明：门比什么（`census:<id> = <n>` 与登记项的导出值，不等即红、未知 id 抛）· 七个登记 id 各是什么 · 它此刻度量的那一级；版本级别不动——这份 note 已由 T6 建成 minor、T7 补过 pin 门一段，本块只续写，不另开文件、不改级别）
- Modify: `docs/kairos/specs/2026-11-16-engine-doc-tooling-p37-design.md`（§7.3 的作者态读数写成 `census:pin.total = 0`——这条引用**本计划自己已经写着九处**（落笔读倒数；spec 里 0 处），而门读的是语料整体、不是 spec 一份：③ 的成员判据一落地，那九处就在断言零、`pin.total` 却读到成员 finding，红在任何 spec 改动之前已是既定事实。因此 §7.3 这一句是**既成引用的对齐，不是实现者手上还能调时序的杠杆**——它与 ③ ④ 同一次提交，早写晚写都不改门是否红，唯一能把它变绿的是 ④ 那一轮迁移；语料里其余的 `census:` 引用分布在 §1.3 · §3.1 · §6.1 · §6.2 · AC ③ · AC ⑦ 与本计划，本任务只让门比对它们，其中 §1.3 / §3.1 / §6.1 的同 id 复述已由 T1 / T2 在册）；**这一句自带血缘义务**——正文改动与 spec 的 `## Change history` 行（`v0.19`，写明 §7.3 的作者态读数现在带引用）以及 front-matter `version:` 的抬版同一次编辑落地。今天没有任何 doc 契约腿把正文与血缘对齐（`change-history-latest-matches-front-matter` 只读 front-matter 与最新行两格，`change-history-version-unique` / `front-matter-version-in-lineage` 只读行与行），因此漏写这一行不会红；而本计划的 Constraints 按 `version:` 消费 spec 的面，不带血缘行的正文改动会让 `v0.18` 同时指两个面。仓内先例是 spec 自己的 `v0.11` 与 `v0.15`，那两行由 `cdd-dev` 的实现侧回填补齐）——**本计划的规模陈述不在改动面**：它的 187 处 · 49 个 token · 38 个文件是歧义普查的当轮读数（T6 · Produces 已声明「绝对条数不登记」），§8.2 没有为它声明供值面，理由见 Steps

#### Consumes

- T6 的 `PinAudit`（同一扫描结果，不另算一套）
- T7 的处置规则集（成员 token 的迁移 remedy 唯一来源：规则 ⑦ 的三支——写成现行的成员名 / 改成今天的符号名 / 去反引号退回散文；本块不新立规则）
- T1 的 `CRITERIA_ROWS`（`criteria.rows` 的供应面：该数就是 `CRITERIA_ROWS.length`，T1 · Produces 已把它登记为导出）
- T2 的 `LENS_QUESTION_ROWS`（`questions.rows` 与 `questions.cells` 的供应面：前者是它的 `length`、后者是各行 `reviewKinds.length` 之和；T2 · Produces 已把它登记为导出）。这两条供给面的 `DependsOn` 边（`1` 与 `2`）属结构面，本轮 `capability: may.amend = content` 不得改，由编排器补——与 v0.6 给 T5 补 `1` 同形

#### Produces

- `CENSUS.of(id)`（未登记即抛）· `CensusRow = { id, measure(): number }`——**一行一个数**：门只比 `census:<id> = <n>` 右侧那一个数，因此 `measure()` 不返回记录；返回记录的行会让门的 `<n>` 比较没有语义（§8.2 明确不要子键语法），且它在类型层就该红
- 七个登记 id，各带自己的供值面（§8.2）：`pin.symbol`（§7.1 符号形态的 finding 数）· `pin.path`（§7.1 路径形态**含测试 pin**的 finding 数——它覆盖 `PinShape` 的 `"path"` 与 `"test"` 两值，两值合读才是 §8.2 的 `pin.path`）· `pin.total`（`pin.symbol + pin.path`，即 §7.3 时间面判定之后同一次扫描的 finding 数）· `pin.files`（`PinAudit.filesOf` 给出的 §7.1 语料文件数）——这四行取自 `PinAudit.census()`，与 `scan` 同源、不二次计算；`criteria.rows`（`CRITERIA_ROWS.length`）· `questions.rows`（`LENS_QUESTION_ROWS.length`）· `questions.cells`（各行 `reviewKinds.length` 之和）—— 这三行取自 T1 / T2 的表，其引用已由 §6.1 / §3.1 在册
- `PinAudit.census(roots)` 返回那四个读数（`symbol` · `path` · `total` · `files`）：`roots` 是语料入口，四个读数因此量的是同一批文件——`total` 不是第二个计算，`files` 不是 finding 数而是体积，四行各是一个可复述的读数；登记面上这四行是**闭包而不是签名扩宽**——登记表那一行的 `measure()` 不收参数，pin 四行在 `contract/census.ts` 里持**调用方交来的**那个 `PinAudit` 与 `corpusOf(root)` 的结果并调 `census(roots)`；持有关系由调用方在组合点建立、不由模块作用域建立（登记表因此是那里构造的实例，`CENSUS` 是它在那里的名字，`of(id)` 语义不变——未登记即抛；它不能是 import 时就要一份根的模块单例），语料声明因此仍只有一处
- **存量成员 token 的迁移（本块的交付物，不是别人的面）**：成员判据一上线，语料里已有的成员连写 token 就不再落成散文、而是 finding——载体还在、成员名早已改名或消失的连写在今天的索引里成批存在，因此「语料零 finding」这个读数必须由本块自己挣回来：清单就是首次扫描的 finding 集（§7.3 的原则），判据是同一扫描的零。这一项**不写成 `census:` 引用**——迁移规模与 §7.3 一样不预登记，写一个条数就是把当轮读数钉成目标，下一轮语料一动就红
- **§7.1 的成员引用形态（spec v0.18 的判据，本块承接）**：尾随实参先剥 · `#` 取最后一个、否则取第一个 `.` 为界 · 前半按裸路径或裸符号过筛 · 后半过同一套符号形状判据 · 两半都过筛而任一半解析不到即一条 finding · **空载体不是成员引用**（以 `#` 开头的 token 界在首位、载体是空串 ⇒ 回落裸符号形态按整枚判，`#` 是它自己的符号前缀而不是分隔符）；它判成 `"symbol"`，所以 `pin.symbol` / `pin.path` / `pin.total` 三行的口径一条不改。六格成对题落在 `pins.guard.test.ts`（见 Files 第 2 条的 ②）
- 门：`census:<id> = <n>` 与导出值比对——`<n>` 只从等号右侧读，不等即红、未知 id 抛
- **门的引用形态（`<id>` / `<n>` 的文法，判据的一半）**：只有 `<id>` 合 `^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$`（点分小写、至少一个点）且 `<n>` 是十进制整数（`^\d+$`）的 `census:` 字样才是**引用**；形态不合的 `census:` 字样是散文里的形式说明，不解析、不比对、不抛——语料里写成 `census:<id> = <n>` 的占位形正落在门自己的扫描根内（本计划、本 spec 与本行自己都在其中），不认这条文法，第 5 步一跑就抛 `<id>`。**这是文法而不是过滤器**：不合文法的不判，合文法而未登记的仍抛，因此 §8.3 的下限不会被「凡带元字符的 `census:` 一律跳过」那种做法悄悄削弱
- **下限 pin（§8.3）**：语料里至少一处真实 `census:<id> = <n>` 被比对过——门把「比对过的引用条数」作为读数交出来，测试断言它 **≥ 1**，下限因此机械可判、不靠人工删文档（零引用全绿等于没门）；底座的具体实例是语料里那些引用：§1.3 · §3.1 · §6.1 · §6.2 · AC ③ · AC ⑦ 与本计划（§6.1 / §1.3 / §3.1 的同 id 复述同属这条底座）。**删光的动作覆盖全部符合文法的引用**，只删点名三节里的那几处不会红——别处的引用仍在被比对

#### Steps

- 写失败测试：改一个数字不改实现 ⇒ 红；未知 id ⇒ 抛；`measure()` 返回记录 ⇒ `tsc` 红（类型层，不是运行时才炸）；七个 id 全在册且各取到一个数；`pin.total` 等于 `pin.symbol + pin.path`、也等于当次 `scan(...)` 的 length（同源 pin）；占位形（`census:<id> = <n>`，本计划、本 spec 与本步自己都在门的语料内）⇒ 不解析、不比对、不抛，语料绿；把一处真实引用的 id 改成一个合文法却未登记的点分小写名 ⇒ 抛；在册语料 ⇒ 绿 — checkable: 红于计数登记面不存在；占位形被当成引用 ⇒ 第 5 步一跑就抛 `<id>`（绿转红的那一格，不是「语料不干净」）；合文法而未登记的名仍抛（形态收窄没有把「未知 id 抛」一起收掉）；§7.1 成员形态的六格先写成对的失败题（见 Files 第 2 条的 ②）——两半都在 ⇒ 零 finding、载体在成员不在 ⇒ 恰一条、成员在载体不在 ⇒ 恰一条、小写成员名 ⇒ 零、带尾随实参 ⇒ 与不带实参那一格同判、空载体的死成员连写 ⇒ 恰一条 `symbol`（同一位置的活成员连写 ⇒ 零：空载体回落的是裸符号形态，两格方向相反）；语料身份那一道也先写成对的失败题——`pin.files` 对测试文件里的长度 pin、`pin.total` 对同一扫描在其语料上的 length，语料换成空集 ⇒ 红（一个量不到文件的 census 不许绿）
- 下限 pin（§8.3）：语料里至少一处 `census:<id> = <n>` 真被比对——门把「比对过的引用条数」交出来，测试断言 **≥ 1**，下限因此机械可判；反方向仍靠人工删：把语料里**全部**符合文法的引用删掉 ⇒ 红，恢复 ⇒ 绿 — checkable: 方向相反的两格，只删其中一处、或只删 §6.1 / §1.3 / §3.1 里的那几处 ⇒ 仍绿（门比的是值，别处的引用仍在被比对），删到引用计数为零 ⇒ 红；删光的判定按计数不按节名——`grep -rho 'census:[a-z][a-z0-9]*\(\.[a-z][a-z0-9]*\)* = [0-9]\+' docs/kairos README.md README.zh-CN.md packages/*/README*.md` 无输出即零引用
- 时间面的计数读数（跳过表本身与它的成对 pin 属 T7 的 Files / Produces / Steps，本任务不引入 spec 未声明的关闭标记）：`PinAudit.census(CORPUS_ROOTS)` 与 `scan` 同源——`pin.total` 等于 `pin.symbol + pin.path`、也等于当次 `scan(...)` 的 length；作者态语料在该时间面判定之后的读数是零（§7.3 写成 `census:pin.total = 0`）— checkable: 同源 pin 在**一份带量的 fixture 上**红得起来——语料今天是零条 finding，`0 = 0 + 0 = 0` 对正确实现与漏计 `"test"` 的实现同时成立，所以这条 pin 自带一份临时语料（一个 `path` 形死 pin · 一个 `symbol` 形死 pin · 一条题名不在文件里的测试 pin）：`census` 读 `symbol` 1 · `path` 2 · `total` 3，三个数各对得上 `scan` 的分类与 length；把 `path` 收窄成只数 `"path"` 一值 ⇒ `path` 1、`total` 2 ≠ 3 ⇒ 红；把 `census()` 改成第二次扫描 ⇒ 同源 pin 红；`pin.total` 与 §7.3 的引用不等 ⇒ 门红
- 实现四件同一提交：① 语料根移进 `contract/pins.ts` 落成纯函数 `corpusOf(root)`（README 半边在调用时展开、import 时不碰文件系统），`pins.guard.test.ts` 改为 import 并删掉本地那份清单；② `census(roots)` 的四个读数（复用同一扫描，不二次解析）与 `contract/census.ts` 的七行登记表（pin 四行持调用方交来的 `PinAudit` 与 `corpusOf(root)`，`measure()` 不收参数，登记表不是模块单例）；③ §7.1 的成员形态判定（含空载体回落的守卫）与它的六格成对题；④ **存量成员 token 的迁移**——③ 让它从散文变成 finding，本步在同一提交里把它还掉：跑一次全语料扫描、把 finding 集当清单逐条处置，remedy 只走 T7 的规则 ⑦ 三支（载体与成员都在 ⇒ 写成现行的成员名；只剩旧名而今天有同义符号 ⇒ 改成今天的符号名；成员已消失 ⇒ 去反引号退回散文），零结论、零裁定、零交付记录改动；③ 与 ④ 分开落地会让语料例题长期红在未迁移的 token 上，因此是硬约束而不是建议 — checkable: 上面几条绿；迁移前跑一次读数为非空、`pins.guard.test.ts` 的语料例题因此红，迁移后同一次扫描为零、例题绿、`census:` 门绿；把一条已迁走的连写写回语料 ⇒ 例题与门同时红（不是只红一处）；把语料根在测试文件里再声明一份 ⇒ 两处规模读数可分叉（结构测试的长度 pin 与 `pin.files` 各说一套），该格红；把语料声明写回 import 期求值 ⇒ 载入即抛（消费方安装下它的根里没有 `packages/` 树）
- doc 侧只改 §8.2 真正供值的那几处：在 spec §7.3 把作者态读数写成 `census:pin.total = 0`（时间面判定之后的零；这条引用本计划已写着九处、spec 里 0 处，而门读的是语料整体 ⇒ 它与第 4 步的 ③ ④ 同一次提交——红的来源是成员 finding 与那批已存在的引用的差值，不是这句 spec 文字的时序，先写与后写一样红），并把这一处正文改动登记成 spec 的 `v0.19` 行、front-matter `version:` 同步抬到 `v0.19`——正文、血缘行与版本号三处同一次编辑落地，doc 契约腿不比正文与血缘、漏写不红，而 Constraints 按 `version:` 消费 spec 的面；`census:criteria.rows = 5` / `census:questions.rows = 15` / `census:questions.cells = 19` 已由 T1 / T2 的改动在册，本步只让门比对它们；发布说明侧在同一份 note 里续写 census 一段（门比什么 · 七个登记 id · 此刻度量的那一级），版本级别不动。**本计划的规模陈述不动**：187 处 · 49 个 token · 38 个文件是歧义普查的当轮读数（T6 · Produces 已声明「绝对条数不登记」），§8.2 没有为它声明供值面——把它写成 `census:<id> = <n>` 只能得到一个未登记 id（查表即抛）或一条与 §7.3「迁移规模不在此预登记」冲突的断言 — checkable: 门绿；§7.3 的引用与 `PinAudit.census()` 的 `total` 一致；把 187 写成一条 `census:` 引用 ⇒ 查表即抛
- 提交 — checkable: `git log -1 --oneline` 含 census

#### Acceptance

AC ⑦（计数面成对 pin）：七行各一个数（`pin.symbol` · `pin.path` · `pin.total` · `pin.files` · `criteria.rows` · `questions.rows` · `questions.cells`，`measure(): number`）；**`pin.path` 含测试 pin**（覆盖 `PinShape` 的 `"path"` 与 `"test"` 两值）；`pin.total` 与 `scan` 同源（等于 `pin.symbol + pin.path`、也等于当次 `scan(...)` 的 length），这条同源 pin 由一份带量 fixture 供红（`symbol` 1 · `path` 2 · `total` 3，只数 `"path"` 一值 ⇒ `total` 2 ⇒ 红）——语料今天是零条，不带 fixture 的 `0 = 0 + 0 = 0` 对正确与错误实现同时成立；四个读数取 `census(roots)`，语料由 `contract/pins.ts` 的 `corpusOf(root)` 单处给出、`pins.guard.test.ts` import 它并删掉本地清单，声明在 import 时不碰文件系统（消费方安装的那棵树里没有 `packages/`）；两处语料读数不得分叉——`pin.files` 等于测试文件里那条长度 pin 的字面量、`pin.total` 等于同一 `PinAudit` 在该语料上的 `scan(...)` length，语料落空 ⇒ 红。门比对 `census:<id> = <n>` 的 `<n>`（不一致即红 · 未知 id 抛）；下限 pin——门交出比对过的引用条数、测试断言 ≥ 1，把语料里全部符合文法的引用删光 ⇒ 红（引用分布在 §1.3 · §3.1 · §6.1 · §6.2 · AC ③ · AC ⑦ 与本计划，只删点名三节里的那几处 ⇒ 仍绿）。**成员形态上线后的存量成员 token 由本块自己迁移**：清单就是首次扫描的 finding 集（§7.3 的原则，不预登记条数），remedy 沿用 T7 的规则集，判据是同一扫描的零；`pins.guard.test.ts` 的语料例题零断言与 §7.3 的 `census:pin.total = 0` 都只在这批迁移落地之后才可认领——先落判据后迁移，两处同时红。**§7.1 的成员引用形态随本块交付**（spec v0.18 的判据此前无主）：`pins.guard.test.ts` 六格成对——两半都在索引里的连写 ⇒ 零 finding · 成员不在索引 ⇒ 恰一条 · 载体不在索引 ⇒ 恰一条 · 小写成员名 ⇒ 零 · 尾随实参剥后与不带实参同判 · 空载体的死成员连写 ⇒ 恰一条 `symbol`，同一位置的活成员连写 ⇒ 零（空载体不进入成员分支，回落裸符号形态是语料里以 `#` 开头的裸符号与死成员连写共用的那一条路）。doc 与发布说明侧只让 §8.2 真正供值的那几处带引用，本计划的规模陈述不在改动面；`.changeset/p37-grading-boundary.md` 续写 census 一段（不改级别、不另开文件）。作为最后一块复跑 `pnpm run validate` exit 0——AC ⑧ 的 changeset 由 T6 建成 minor、T7 补过 pin 门一段，本块在同一份 note 里续写，不重复认领版本级别。

#### DependsOn

7

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-11-16 | 初稿：六任务两波——T1 判据表+rubric 装配 · T2 lens 问句+axesGuide 投影（DependsOn 1）· T3 impact/regrade/contract+gradingViolations · T4 wave 注入 · T5 改档显示面（DependsOn 3）· T6 pin 门+contract.path 回读+changeset（DependsOn 3）；消费 spec `2026-11-16-engine-doc-tooling-p37` 当时 `version:` | Oscaner M. · Claude（kairos:cdd-plan · 2026-11-16） |
| v0.2 | 2026-11-16 | docs-fix round 1（plan-review-1 · F1–F3 全受理）：F1 Constraints 落点补 §6.2 并显式声明本相位判据表的 `face` 用法（`numbered` 进字节 · `test` 有格题 · `gate` 空集）⇒ T1 增判据面结构测试、T2 增问句逐字投影与 15 行 / 19 格计数；F2 T1 产出 `regrade-mark`（`nit` · `numbered`）行，T5 Consumes 取该行 `body` 作改档标记唯一措辞来源；F3 T6 补 §7.2 第 2 消费者（文档评审回读注入 `PinAudit` 语料 finding、不改结论），Files/Steps 为两个消费者各点名 colocated 测试 | Oscaner M. · Claude（kairos:cdd-plan plan-fix-1 · 2026-11-16） |
| v0.3 | 2026-11-16 | docs-fix round 2（plan-review-2 · F1–F6 全受理）：F1 T6 撤掉不存在的「在册」概念——语料写死为 §7.1 全语料、扫描文件数作规模 pin、零 finding 归 T7，T6 的 checkable 改为播种可红可修；F2+F4 判据表补 `pin-parseability`（warn · `test`）行承载 §7.4 的理由与边界，`face` 面额补成 `numbered` 3 · `gate` 1（blocker 行 `id` 即报文第二词）· `test` 1，T1 的结构测试改钉面额与字节，`gate` / `test` 各自在 T3 / T6 的测试面成对钉；F3 T5 点名标记的四处缝（ledger 投影 → lifecycle 生产者 → `DispatchOutcome.dispositionsSummary` → `run.ts#capsuleLines` 的既有 `summary` 槽），胶囊那行明示为设计里唯一新增可见字节，`capsule.ts` / `session/run.ts` 因此不是改动点；F5 T4 把 `#valuesOf` 的 `INPUT_SPEC` / `INPUT_OVERALL` 两臂点名为必改点，删掉条件对冲；F6 T3 点名 `lifecycle.test.ts` / `cli.test.ts` 两个具体测试文件 | Oscaner M. · Claude（kairos:cdd-plan plan-fix-2 · 2026-11-16） |
| v0.4 | 2026-11-16 | docs-fix round 3（plan-review-3 · F1–F8 全受理）· 消费 spec `2026-11-16-engine-doc-tooling-p37-design` 的 `v0.8`：F1 T6 按 §7.2 重述为一条判据 · 三份语料 · 两个执行面，第 2 份语料改为**本轮被审文档正文**（`INPUT_SPEC` / `INPUT_OVERALL` 是它的引用，不是语料），两份回读语料的后果改准为 warn 进 `findings[]` ⇒ `REVIEW_FIX`（不出 `CDD_BLOCKED`，但不是结论中性），补 AC ⑥ 的三条成对 pin（干净文档零注入且结论不变 · 一条死 pin ⇒ 恰一条 warn、落 `REVIEW_FIX` · `contract.path` 失效 ⇒ 无 `CDD_BLOCKED` 且落 `REVIEW_FIX`），Acceptance 的「三个消费者」改为「一条判据、三份语料、两个执行面」；F2 T7 把已消费 `.changeset/*` 移出迁移清单与计数（§7.1 排除 3 已判其为记录），清单回到过期引用 / 迁移路径 / 行号越界三类；F3 T4 补齐 AC ④ 的四臂（single-spec 只出 `INPUT_SPEC` · `program:` 解析不到只丢 `INPUT_OVERALL`）并逐臂 pin，两格各自独立判定；F4 T1 按 §1.3 的序把反例句落到行上（blocker 行 ← 第一条 · warn 行 ← 第三条 · nit 行 ← 第四条 · 第二条作为 (a) 实例的收口句进 blocker 行 `body`）；F5 T1 补 §6.1 的两段校验契约——空白格与零行档位走装配期抛，删键走 `tsc`，两条红法不互相顶替；F6 T6 Produces 点名 §7.1 的 pin 定义（三条排除）并为每条约一条成对 pin；F7 本行记录消费的 spec 版本（`v0.8`）；F8 保留 `pins.guard.test.ts`（与仓内 `*.guard.test.ts` 同惯例），作为对 spec 当时字面路径的有意改名记名于此——该偏差已由 spec v0.10 采纳本写法而闭合，见 v0.13 行 | Oscaner M. · Claude（kairos:cdd-plan plan-fix-3 · 2026-11-16） |
| v0.5 | 2026-11-16 | docs-fix round 4（plan-review-4 · F1–F4）· 仍消费 spec `2026-11-16-engine-doc-tooling-p37-design` 的 `v0.8`：F1 T6 把语料三的判点从 `#materialize` 移回 `#reconstruct`——`#reconstruct` 先算 `status = conclusionOf(plane, draft)` 再调 `#materialize`，在写者里追加的 warn 会进载体而结论仍 `APPROVED`，因此两份回读语料同在 `conclusionOf` 与局部 findings 投影之前注入 `draft.findings`，`#materialize` 只留 carrier 写者的角色（注入行的 `id` 由 `#findingsList` 编），并补一条把注入点挪回写者即红的 checkable；F2 T5 补两条 checkable（上一轮同键 `impact.scenario` 为空 ⇒ 不要求 `regrade`、不标记；本轮改写 `scenario` 而 `summary` 不变 ⇒ 仍配对、仍出标记）与 Objective 的第 4 步分支，Acceptance 由「AC ⑤」改为 AC ⑤ 的全部腿逐条列出；F4 T2 的 `LensQuestionRow` 由单值 `reviewKind` 改为多值 `reviewKinds`（wave/branch 共享行正文只存一次），物理行 15 与逻辑格 19 由 `rows.length` 与 `sum(reviewKinds.length)` 两条独立断言各读一次，`forReviewKind` 按 `reviewKinds` 展开；F3 只落内容面——T5 的 Consumes 记清「哪一格由哪个前置供给」，`DependsOn` 集属结构面、本轮 `capability: may.amend = content` 不得改，T5 对 T1 的 `1` 这条边留待编排器补 | Oscaner M. · Claude（kairos:cdd-plan plan-fix-4 · 2026-11-16） |
| v0.6 | 2026-11-16 | **结构面补齐（评审 F3 的编排器半边）**：T5 的 `DependsOn` 由 `3` 改为 `1, 3`——T5 消费 T1 的 `regrade-mark` 行（标记措辞唯一来源）与 T3 的 `impact` / `regrade` 字段，图里此前缺 T5 -> T1 这条边。fix 轮正确地把结构面交回编排器（`may.amend = content`），故由本提交落地；内容面已由 `01130594`（v0.5）完成，消费的 spec 版本为 `2026-11-16-engine-doc-tooling-p37` v0.8 | Oscaner M. · Claude（编排器 · 2026-11-16） |
| v0.7 | 2026-11-16 | docs-fix round 5（plan-review-5 · F1–F4 全受理）· 仍消费 spec `2026-11-16-engine-doc-tooling-p37-design` 的 `v0.8`：F1 Constraints 的 OOP 上限补上 spec §Constraints 的豁免——≤200 行只约束本相位新建的类，四个既有文件（`session/ledger.ts` · `face/lifecycle.ts` · `face/board-view.ts` · `session/handoff-schema.ts`）按 rule zero 免于该上限、每处改动写一行理由、拆分归 P39（D95 ②），约束不再诱使实现者在本相位拆神对象；F2 T6 的语料二点名读缝——路径取自 `frame.target`（三个 doc 型为 `{ kind: "spec", doc }`）、正文走类既有 `readFileSync`，`#artifacts.read({ domain: "doc", … })` 为等价路由，并撤掉「`SlugIndex` 在 `#reconstruct` 解析到」的错挂（该解析在 `face/cli.ts#sceneOf`），`#reconstruct` 不建第二个索引；F3 Constraints 的落点表把「§2 全节归 T3」改准为「§2 归 T3，除 §2.1 的 `RoundFinding` 三格与两个投影 → T5、§2.3 的 `contract.path` 回读 → T6」，T6 那条同步收紧为回读面；F4 T5 点名板面那次读的两格投影——`countOf` 与 `findingsOf` 共用一次 digest 校验读与一次 `JSON.parse`，`countOf` 仍取原生 `findings` 数组长度（`+N` 的数字）、`findingsOf` 取过滤后的行，无第二次解析、也不留无调用者的死码 | Oscaner M. · Claude（kairos:cdd-plan plan-fix-5 · 2026-11-16） |
| v0.8 | 2026-11-16 | fix round 1（wave 1,3,4 · review-1 的 F1–F3 全受理）· 仍消费 spec `2026-11-16-engine-doc-tooling-p37-design` 的 `v0.8`：F1（§6.1 / §5.2）改档标记的措辞不再充当判据行的 `body`——`body` 换成 nit 档的判据句，标记措辞改由同一模块导出的 `REGRADE_MARK` 承接（T5 的措辞来源随之改为读该常量），并新增一条档位连续性 pin：每档片段是一条连续句子串、每格首字母大写且以句末标点收尾，把一个从句片段写回 `body` 即红；F2（T4）branch 的字节 pin 由两根锚点的 `toContain` 改为「`## Round context` 整段记录后逐字比对」，加一行或换序即红；F3（T4）fix 壳的子句把 `INPUT_SPEC` / `INPUT_OVERALL` 写到 wave 与 branch 两行上（wave fix 轮此前带两格而指令只归 branch 行），`TEMPLATE_PROMPT.$version` 23 → 24，并补 wave fix 轮的 dispatch pin；本行随 fix 轮的 `capability: may.amend = content` 落地，`DependsOn` 集未动 | Oscaner M. · Claude（kairos:cdd-fix · 2026-11-16） |
| v0.9 | 2026-11-16 | docs-fix round 6（plan-review-6 · F1–F2 全受理）· 仍消费 spec `2026-11-16-engine-doc-tooling-p37-design` 的 `v0.8`：F1 T6 的 pin 定义补回 §7.1 的收口句「都是词表条目，不是坐标」，并把排除 ② 拆成两族规则——产物族（`progress.json` / `base.json` / `in-flight.json` / `liveness.json` / `tasks-<N>-<op>.json` / `*.rulings.json`）按形状匹配，因为它的实例是机器本地路径；模板族（`X.md` / `-overall.md` / `-design.md`）只在该 token 就是词表条目时排除，一个真实的 `<dir>/<slug>-overall.md` 路径仍是坐标，否则 §7.3 的迁移路径类会被后缀规则静默清空（`2026-10-10-engine-doc-tooling-p17.md` 里指向 specs/2026-10-10-engine-doc-tooling-overall.md 的过期坐标就是那一类），Steps 与 Acceptance 各补一条让差异变红的成对 pin；F2 T2 的 Produces 点明 `ReviewKind` 由 `contract/review-criteria.ts` 自己声明（`contract/` 不 import `render/`，D95 ① 的边方向），`templates.ts` 的 `ReviewKey` 与之结构互 assign、不需要反向边 | Oscaner M. · Claude（kairos:cdd-plan plan-fix-6 · 2026-11-16） |
| v0.10 | 2026-11-16 | docs-fix round 7（plan-review-7 · F1–F3 全受理）· 仍消费 spec `2026-11-16-engine-doc-tooling-p37-design` 的 `v0.8`：F1 T7 的处置规则改按门**实际产出的 finding 形态**定，不再按 §7.3 的三类名——首次全语料扫描是 79 文件 / 2016 条 finding（1616 symbol · 400 path）、落在 69 文件上，三类名只覆盖 path 的一支，于是补两条规则（死裸符号去反引号 · 第三方包内路径去路径化），并把清单判据从「三类条数之和等于 finding 数」改为「每条 finding 都对得上一条处置规则、重扫归零」（旧判据在首跑就是红的，因 1616 条 symbol 无处置）；F2 T7 交付零 finding 断言的方式由「补」改为「替换」——`pins.guard.test.ts` 那条语料例题里的扫描非零断言换成零断言、文件头「corpus is NOT clean」那段改写成迁移后陈述，播种态那一对保留为独立例题（T6 的同句同步收紧），否则两条相反断言同处一套件会永久红；F3 保存边界补一条可执行步骤——每个改动文件剥掉行内代码段后与迁移前副本比对，残留差异为空，例外只许落在迁移前就带 finding 的行上且逐条点名、条数相等，Acceptance 同步点名这条核验 | Oscaner M. · Claude（kairos:cdd-plan plan-fix-7 · 2026-11-16） |
| v0.11 | 2026-11-16 | docs-fix round 8（plan-review-8 · F1–F3 全受理）· 仍消费 spec `2026-11-16-engine-doc-tooling-p37-design` 的 `v0.8`：F1 T7 的处置规则重排为七条并声明取用顺序与分工——① 省略号截断与示例占位（去路径化并保留「当时取的是哪一类文档」这个事实，明写不得写成「目标已按设计消失」）· ② 目标已按设计消失 · ③ 搬迁 / 改名 / 现行文件的缩写（触发词判搬过，remedy 判写全，缩写只命中 remedy）· ④ 本仓之外的坐标（第三方包内部文件 · 兄弟插件的 agent / skill 文件 · 不带目录的包外裸文件名）· ⑤ 机器本地产物名不在 §7.1 产物词表内（去路径化到族名，或在 T6 面扩产物词表，二选一）· ⑥ 行号收口作为叠加规则（处置后仍带行号的一律改成路径 + 符号，越界行号由此收口，路径可解析而只有行号越界的也归本条）· ⑦ 裸符号去反引号；末条兜底把仍归不进 ①–⑤ 的 `path` token 按 ④ 的 remedy 处置、把形状补回清单，remedy 钉死、只补形状不补做法；清单自检由「每条 finding 对得上五条中的一条」改为「每一条 finding 都能落到一条规则的触发词或 remedy 上」；F2 残留比对改为两侧剥段并抹掉被报告 token 后再比（token 位移因此不产生差异，同句散文改动仍显形），例外收紧为「抹 token 后的差异串落在因 finding 改写的引用从句内部」，逐条点名只对抹 token 后仍报差异的行，Acceptance 同步（同一行只去反引号 ⇒ 零残留；另改一个散文词 ⇒ 红）；F3 删掉两个错子计数（「33 条指向包内部」按本计划自己的括注实为 35，「86 条带行号范围」是 finding 条数而非 distinct token 数），只保留可复现的 79 文件 · 2016 条 finding · 1616 symbol · 400 path · 69 文件。本行随 fix 轮的 `capability: may.amend = content` 落地，`DependsOn` 集未动 | Oscaner M. · Claude（kairos:cdd-plan plan-fix-8 · 2026-11-16） |
| v0.12 | 2026-11-16 | fix round 3（wave 2,5,6 · review-3 的 F1–F2 受理）· 消费 spec `2026-11-16-engine-doc-tooling-p37-design` 的 `v0.9`：F1 T6 的两份回读语料不再写死 `lens: consistency`——注入行取该评审面自己声明的 `pinLens`（`render/templates.ts#pinLensOf`，与 `lensEnum` 同处一行并交叉校验、drift 即抛），逐面取值 `phase-spec` / `single-spec` = `consistency` · `overall` = `inventory` · `plan` = `buildability` · `wave` / `branch` = `standards`（语料三在每个判据面上都跑，故不是 spec 专用），语料二 / 语料三的 Steps 与 Acceptance 同步改写；F2 属 T5 的读面无行为变化，不改本计划的任务内容。本行随 fix 轮的 `capability: may.amend = content` 落地，`DependsOn` 集未动 | Oscaner M. · Claude（kairos:cdd-fix · 2026-11-16） |
| v0.13 | 2026-11-16 | docs-fix round 9（plan-review-9 · F1–F5 全受理）· 消费面由 spec `v0.9` 抬到 `v0.10`，本行记下随之继承的四处 delta 与各自的落点：§6.2 / §7.4 的 `test` 面已与本计划同名（`pins.guard.test.ts`）· §5.1 的「上一轮」读面为 `Ledger#recordsOf` + `Ledger#readHandoff` + `HandoffSchema.findingsOf` · §7.1 的路径形为 `path.ext[:line[-line]]`（裸路径同样是 pin，行号不得超过文件行数）· §1.3 的判据表五行普查。F1：T6 的 `test` 面改记该命名偏差已被 spec v0.10 采纳而闭合——v0.4 行里那处「对 spec 字面路径的有意改名」不再成立，两处旧字面名（T6 的那条 bullet 与 v0.4 行）一并撤下，语料里因此不再有指向已消失目标名的引用；T5 的 Steps 补上 §5.1 的读面点名；T6 的 Produces 补上 §7.1 的路径形。F2：T7 的残留比对把例外从子串判法改为点名从句判法——抹 token 之后再在两侧删掉清单里点名的那处引用从句，余量逐字相同即绿，落在从句之外即红；子串只认删除，会把规则 ① ② ④ ⑤ 加从句的 remedy 全部判红，Acceptance 同步，播种对改为「规则 ② 改写 ⇒ 绿 · 同一行在点名从句之外把三条改成两条 ⇒ 红」。F3：T7 的规则 ⑤ 只留去路径化一条路，删掉「扩产物词表」那条——词表由 P36 的产物矩阵拥有（`session/round-artifacts.ts` · `DEFAULT_DOMAINS` · `ArtifactRegistry.ownsName`），在判它的同一件事上挪判据，既不在本任务的 Files 内，也没有成对 pin 覆盖新条目。F4：T7 的首次扫描读数不再登记绝对条数（79 文件 · 2016 条是 v0.11 那一轮的读数，而语料每一轮 fix 都改写自己），只留 `symbol` 约八成 · `path` 约两成的量级与「重扫归零」这条判据。F5：T7 的验收命令逐条点名五条 doc 契约腿（`doc-corpus.guard.test.ts` · `dockey.guard.test.ts` · `phase-inventory.guard.test.ts` · `structure-pin.test.ts` · `change-history-header.test.ts`），不再写 `doc-contract` 这个 `contract/rules.ts` 里的门概念，也不写 `vitest run` 认不得的族名。本行随 fix 轮的 `capability: may.amend = content` 落地，`DependsOn` 集未动 | Oscaner M. · Claude（kairos:cdd-fix · 2026-11-16） |
| v0.14 | 2026-11-16 | docs-fix round 10（plan-review-10 · F1–F3 全受理）· 仍消费 spec `2026-11-16-engine-doc-tooling-p37-design` 的 `v0.10`：F1 T6 的路径形补回 §7.1 的「**唯一**」——同一个后缀命中多条即报歧义、不得静默取第一条，并补一条成对 pin（同 basename 在仓根与嵌套各有一份 ⇒ 解析到唯一那条、行号按命中那份判；真歧义 ⇒ 一条点名两个候选的 finding），Steps 新增该对、Acceptance 的 AC ⑥ 同步加这条腿；T7 规则 ⑥ 同时声明越界只按唯一命中那份文件的行数判，按首条命中截掉的行号必须还原（被截的不是越界坐标、是合法坐标）。解析器本身的修复属代码面，本行只把判据写回文档。F2 T7 的规则 ① 触发词改准为「被当作字符串举出来的字符串」——从不是坐标，或过去坐标被引作某条规则之例证——并明写改写这类 token 是禁止动作（否则例证与它要说明的事变成同一个东西），因此这类 token 不归 ③；任务标题、清单自检的 `path` 分支枚举与 Acceptance 同步对齐。F3 T7 的 Produces 按「谁读」拆两处落：七类处置条数与例外总条数留在提交信息，例外行的逐条点名（file · line · rule · token · clause 五格）落在本任务工作区实现报告 `tasks-7-implement-1-report.md` 的边界核验表，报告名写进计划、提交信息同时点名它一次，重核者按名取表。本行随 fix 轮的 `capability: may.amend = content` 落地，`DependsOn` 集未动 | Oscaner M. · Claude（kairos:cdd-fix · 2026-11-16） |
| v0.15 | 2026-11-16 | docs-fix round 11（plan-review-11 · F1–F4 全受理）· 仍消费 spec `2026-11-16-engine-doc-tooling-p37-design` 的 `v0.10`：F1+F2 T6 的路径解析补上三级优序——① 精确条目命中优先（`README.md` ⇒ 仓根那份，不是 51 行的 `.changeset/README.md`）→ ② 唯一后缀命中（`face/declare.ts`）→ ③ 歧义（一条点名两个候选的 finding），次序本身写进判据；歧义因此有了归属：T7 新增规则 ⑧（歧义 basename 写全现行路径，remedy 与 ③ 同形、触发词判「同时有多份现存候选」），任务标题与 Files / Produces / Steps / 提交 / Acceptance 由七条、七类改为八条、八类；T6 Steps 的 fixture 原来要求「同 basename 根与嵌套各一份 ⇒ 唯一命中」，与同一句的「命中多条即歧义」互斥，改写成三格（`README.md` 精确优先 · `face/declare.ts` 唯一尾形 · `contract/declare.ts` 真歧义），AC ⑥ 同步用同一次序。F3 把唯一 / 歧义两半记成欠账的代码面：`PinIndex.resolvePath` 仍是首条命中、无歧义分支，`pins.guard.test.ts` 也无一条格题点名它，于是 T6 Files 补两行 Modify（欠账面 · 修复轮）并把它与规则 ⑧ 绑定同一轮，避免只修解析器让零断言红在未迁移的 token 上、只做 ⑧ 又触发不了；AC ⑥ 与 T7 Acceptance 的「全语料零 finding」拆成两级——首条命中判据下的零已随迁移交付，三级优序判据下的零待那一轮，两者不再合成一句。F4 T7 规则 ⑥ 删掉「按首条命中截掉的行号必须还原」，只留它真正建立的判据：行号不是越界证据，判越界只按 ①→③ 解析出的那份文件的行数。本行随 fix 轮的 `capability: may.amend = content` 落地，`DependsOn` 集未动 | Oscaner M. · Claude（kairos:cdd-fix · 2026-11-16） |
| v0.16 | 2026-11-16 | docs-fix round 12（plan-review-12 · F1–F7 全受理）· 仍消费 spec `2026-11-16-engine-doc-tooling-p37-design` 的 `v0.10`：F1 T6 的歧义普查改按 **remedy** 分簇并改准读数——⑧ 簇 159 处 / 4 个 basename（run.ts 74 · declare.ts 60 · SKILL.md 20 · CHANGELOG.md 5，各含自己的 `:line` 形）· ⑤ 簇 22 处 / 4 个 token（那一轮的 spec 评审产物 12 · 那一轮的 implement 取证产物 4 · 那一轮的 branch 取证产物 3 · 那一轮的 spec 修复产物 3）；「最大四组」的说法撤下（旧行把四个 basename 的计数与四个机器本地名混排，且把 ⑤ 簇整个漏掉），规则 ⑧ 的「机器本地名由 ⑤ 先认领」改成「⑤ 必须按三级优序普查重跑」——首条命中那一轮的 ⑤ 只处置了 7 处，这批在首条命中普查下各自静默解析到第一个候选、从未被报出；F2 解析器升级的归属从 T6 的「欠账面 · 修复轮」移到 T7 的 Files（唯一开着的块），连同级 ①→③ 的三格、普查步与 AC ⑥ 的三条解析腿一起搬到 T7（T6 的波次已闭合，再也派发不了一次「解析器 + 迁移」；升级单落 T6 会让已交付的语料零断言红在 181 处未重处置的歧义词上），「同一轮」的说法改为指向 T7 自己；F3 T6 Files 补 `render/templates.ts` 与 `render/__tests__/templates.test.ts`，Acceptance 补一条 checkable（drifted `lensEnum` ⇒ `pinLensOf` 抛；每个判据面的注入行恰带 `pinLensOf(type)`）；F4 提交 checkable 的八类条数改成 ⑧ 的零也要明写（「⑧ 0 处 · 歧义普查 N 个 token」），deferral 与漏项不再同一副面孔；F5 T7 Produces 的报告名义务改为「计划点名、交接单与本轮报告互指」——提交信息只承条数与残留段落，不再承诺一个它没有的槽；F6 changeset 的 pin 门段落收口到 T7（Files 加 `.changeset/p37-grading-boundary.md`、Acceptance 加一条发布说明腿），发布说明宣称的零必须是包真正度量的那一级；F7 T7 的两组数字分开命名——规则仍 ①–⑧，解析优序一律写「层级 ① / 层级 ② / 层级 ③」。本行随 fix 轮的 `capability: may.amend = content` 落地，`DependsOn` 集与 Task id 集未动 | Oscaner M. · Claude（kairos:cdd-fix · 2026-11-16） |
| v0.17 | 2026-11-16 | 新增 T8 计数的执行面（并入 P37 的 ⑨ · 独立第 4 波 · `DependsOn 7`）：`contract/census.ts` 登记 `{ id, measure() }`、未登记即抛；`PinAudit.census()` 与 `scan` 同源；门核对 `census:<id> = <n>` 与导出值（不等即红）；doc 侧把 spec §7.3 与本计划的规模陈述改成带引用形态。消费 spec v0.11 | Oscaner M. · Claude（编排器 · 2026-11-16） |
| v0.18 | 2026-11-16 | T8 补时间面的消费者成对 pin（用户裁定：时间面钉 `slug:` 而非 `program:`）：single-spec + 同 slug 计划的 fixture 下，待建路径在三份语料都不产 finding；该 slug 关闭后同一路径产 finding。消费 spec v0.15 | Oscaner M. · Claude（编排器 · 2026-11-16） |
| v0.19 | 2026-11-16 | docs-fix round 12 重跑（plan-review-12 · F1–F7 逐条复核）· 消费 spec `2026-11-16-engine-doc-tooling-p37-design` 的 `v0.17`：七条 finding 的正文已在 v0.16 落地，本轮逐条重核后仍成立（F1 按 remedy 分两簇、无「最大四组」、规则 ⑤ 声明必须重跑 · F2 解析器升级与规则 ⑧ 同归 T7 的 Files、T6 只留「不在本块」· F3 `render/templates.ts` 与 `render/__tests__/templates.test.ts` 在 Files 内、drift 格题在 Acceptance · F4 ⑧ 的零也明写 · F5 提交信息只承条数与残留段落 · F6 `.changeset/p37-grading-boundary.md` 归 T7 并在 Acceptance 收口 · F7 解析优序写「层级 ①→③」）。本轮唯一的正文变化是 F1 的普查读数：v0.17 / v0.18 追加 T8 的文字后语料变了，重测为 ⑧ 簇 165 处 / 4 个 basename（run.ts 75 · declare.ts 62 · SKILL.md 21 · CHANGELOG.md 7）· ⑤ 簇 22 处 / 4 个 token，两簇合计 187 处 · 49 个 token · 38 个文件，v0.16 的 181 与 37 陈下；同时把 T6 普查步的 checkable 从固定条数改为「两簇之和等于普查总数、无 token 落在两簇之外」——F1 的 fix 要求读数只作本轮证据、不得被读成登记的目标，而一条把 181 钉成断言的红法正是把它变成目标（当轮读数 183 即红）；T7 Files 与 T6 Files 的同一处整数一律改为指向 T6 · Produces 的读数行，不再各存一份会漂的数。本行随 fix 轮的 `capability: may.amend = content` 落地，Task id 集与 `DependsOn` 集未动 | Oscaner M. · Claude（kairos:cdd-plan plan-fix-12 · 2026-11-16） |
| v0.20 | 2026-11-16 | docs-fix round 13（plan-review-13 · F1–F5 全受理）· 仍消费 spec `2026-11-16-engine-doc-tooling-p37-design` 的 `v0.17`：F1 §7.3 的时间面跳过表此前无主——T8 第 2 步以消费面用它的结果、T6 的 Acceptance 又声称「首条命中判据下的零已随迁移交付」，而树上 `pins.guard.test.ts` 的语料例题今天红在 7 条 finding 上（实测：宪章 3 条与计划 4 条，全部落在 T8 的 `Create:` 行声明的 `census` 登记面与它的结构测试上），全部是 T8 的待建路径、按 §7.3 的时间面本应跳过。本轮把时间面归入 T7 的 Files / Produces / Steps / Acceptance（与 `PinIndex.resolvePath` 的升级同文件、同提交），补一条三份语料共用一张待建表的成对 pin；T6 的 Produces / Steps / Acceptance 与 T7 Files 的预置态同步改准——两处预置产物（`toBe(0)` 与迁移后的文件头）已在树上，T7 让它们变绿而不是重写；T8 第 2 步改为经 `census()` 复读，不再造第二份 fixture。F2 AC 标号收口：Constraints 与 T6 的 Acceptance 把 validate / changeset 腿改记为 AC ⑧（⑦ 归计数面），落点表补 `§8 → T8` 一行，T8 的 Acceptance 只复跑 validate、不重复认领 ⑧。F3 T8 的 `measure()` 收窄为 `number`（一行一个数），点名七个 id 与各自供值面，`pins.ts` 的 `census()` 扩成四个读数（`symbol` / `path` / `total` / `files`），Steps 与 Acceptance 补 AC ⑦ 的删光引用下限 pin。F4 T8 第 4 步重锚到 §8.2 真正供值的处——spec §7.3 落 `census:pin.total = 0`，三处注册表引用由 T1 / T2 在册；本计划的规模陈述移出改动面（187 是当轮歧义普查读数，§8.2 无供值面）。F5 T8 原「把该 slug 标为关闭」的红腿改为 spec 的措辞——删掉计划那条 `Create:` 行即去掉跳过、同一路径产 finding；`Implementation plan` 格写 `✔ Done（…）` 那条臂只留给 `program:` fixture，两条腿都落在 T7 的成对 pin 里。本行随 fix 轮的 `capability: may.amend = content` 落地，Task id 集与 `DependsOn` 集未动 | Oscaner M. · Claude（kairos:cdd-fix · 2026-11-16） |
| v0.21 | 2026-11-16 | docs-fix round 14（plan-review-14 · F1–F4 全受理）· 仍消费 spec `2026-11-16-engine-doc-tooling-p37-design` 的 `v0.17`：F1 §7.3 的跳过条件 ① 要「该计划与被审文档共一个身份键」，而 `PinAudit.pathResolves(pinPath)` 不带被判文档、唯一调用点 `face/lifecycle.ts#contractPinRows` 只递 pin，且 `#injectPinFindings` 在每个判据面都跑语料三——wave / branch 轮的 `AuditTarget` 不带 `doc`，身份到不了判据。本轮把身份写进接口面：`pathResolves` 补第二参 `judged`（被判文档的仓内路径，或 `null` 表示本轮没有被判文档，见本行下文）——`scan` / `scanText` 的 `source` 已是那份被判文档，签名不动，`spec` / `plan` 面传 `frame.target.doc`、`wave` / `branch` 面传 `null`，并明写 `null` 是判定的答案而不是漏参——条件 ① 无主语、跳过不成立，该轮的 `contract.path` 只按解析结果判，§7.2 的 `standards` 臂正是要它落在今天是仓里的面上；T7 的 Files 因此补 `face/lifecycle.ts`（调用点这一半）与 `face/__tests__/lifecycle.test.ts`（成对 pin），Step 4 与 Acceptance 补「三份语料以同一个被判身份调用」与「身份不同即不跳过」两格。F2 T8 的门把「每个 `census:<id>` 都解析」收成一条准入文法：id 合点分小写、右侧是十进制整数才是引用，占位形 `census:<id> = <n>` 是散文（本计划、本 spec 与本节自己都在门的语料内，不认这条文法第 5 步一跑就抛 `<id>`），并明写这是文法而不是过滤器——合文法而未登记的仍抛，§8.3 的下限不被「凡带元字符一律跳过」削弱。F3 T7 第 1 步的形态比例重测：写本文时 `symbol` 0 条 · `path` 7 条（79 文件，宪章 3 条 · 本计划 4 条，正是时间面要跳过的那一批），v0.20 之前记的「`symbol` 约八成 · `path` 约两成」是重写前那一轮的读数、撤回，解析器升级后的歧义普查读数仍只登记在 T6 · Produces 的普查行。F4 T7 第 4 步的同源腿改用三份语料各自的读数（`scan` 清单里不出现 · `scanText` 结果为空 · `pathResolves` 返回 `true`），`pin.total` 的同源 pin 留在 T8 第 3 步——那个读数由 `PinAudit.census()` 供，本块跑在它之前。本行随 fix 轮的 `capability: may.amend = content` 落地，Task id 集与 `DependsOn` 集未动 | Oscaner M. · Claude（kairos:cdd-fix · 2026-11-16） |
| v0.22 | 2026-11-16 | docs-fix round 15（plan-review-15 · F1–F5 全受理）· **消费面由 spec `v0.17` 抬到 `v0.18`**——T7 已按 `8d913569` 落地、spec 已按 `39cd123f` 升版，本行记下这一版的两处新增与各自的落点（`::` 测试 pin 形随测试形态已在树，成员引用形态由 T8 承接）：F1 §7.1 的成员引用形态此前无主——T6 的字面面已闭合、T7 只承解析器与迁移、T8 只写计数，而树上的 `PinShape` 仍只有三值、没有成员分支，两个成员 token 因此只产散文（载体在、成员不在与载体不在、成员在两种都静默）；本轮把它交给唯一开着的块：T8 的 Files 补 `contract/pins.ts` 的第三件事（成员连写判定）与 `pins.guard.test.ts` 的五格成对题，Produces 补判据面，Steps 第 1 / 4 步与 Acceptance 同步；形态仍判成 `"symbol"`、`PinShape` 不新增取值，三行计数口径不变。F2 T8 的 census 面缺语料入口——`pin.files` 与 `pin.total` 都要语料，而语料根当时只在 `pins.guard.test.ts` 里声明一份，`census()` 无参、`measure()` 也传不进 roots；本轮把语料根移进 `contract/pins.ts` 并导出 `CORPUS_ROOTS`，`census(roots)` 收它、`pins.guard.test.ts` 改为 import（Files 补该测试文件），登记表的 `measure()` 仍不收参数——pin 四行在 `contract/census.ts` 里闭包持语料，声明仍只有一处。F3 `pin.path` 恢复「含测试 pin」的口径——`PinShape` 的 `test` 值不被数进 `path` 会让 `pin.total` 少掉每一条死题名；Steps 第 3 步与 Acceptance 改带量 fixture（`path` 1 · `symbol` 1 · 测试形 1 ⇒ `symbol` 1 · `path` 2 · `total` 3），因为语料今天是零条，`0 = 0 + 0 = 0` 对正确实现与漏计 `test` 的实现同时成立，那条红今天不可达。F4 T6 的 Acceptance 改成交付分级——它仍写「零 finding 今天在任何一级都不成立」，而 T7 已落地、语料例题今天绿在 79 文件的层级 ①→③ 判据下；本轮把 7 条读数记为 T7 之前的前像，层级 ①→③ 下的零记为交付读数，并点明 `census:pin.total = 0` 只有一个来源；同时记下 §7.1 的成员形态归 T8、`::` 形已在树，T6 的字面面不回溯认领。F5 T8 的 Files 补 `.changeset/p37-grading-boundary.md`——T6 建了那份 note、T7 补过 pin 门一段，最后一块的 census 门是唯一没写进去的面；本轮在同一份 note 里续写一段（门比什么 · 七个登记 id · 此刻度量的那一级），版本级别不动。本行随 fix 轮的 `capability: may.amend = content` 落地，Task id 集与 `DependsOn` 集未动 | Oscaner M. · Claude（kairos:cdd-fix · 2026-11-16） |
| v0.23 | 2026-11-16 | docs-fix round 16（plan-review-16 · F1–F3 全受理）· 仍消费 spec `2026-11-16-engine-doc-tooling-p37-design` 的 `v0.18`：F1 §7.1 的成员引用形态在 v0.22 交给了 T8，但 T8 只承判据、没有存量迁移——判据一上线，语料里成批的成员连写 token（载体在、成员名已改名或消失）就从散文变成 finding，而 T8 同时声称语料零：`pins.guard.test.ts` 的语料例题断言 `scan.length === 0`、`census:pin.total = 0` 已在语料里出现多次，于是 `validate` 不可能 exit 0，AC ⑦ 自己就红。本轮按 §7.3 的同一原则把迁移归入 T8：Files 新增一条「存量文档」的 Modify 行（清单=首扫 finding 集、不预登记文件与条数、remedy 沿用 T7 两条），Files 的 `pins.ts` 行声明 ③ 与迁移同一提交，Steps 第 4 步由「三件」改为「四件」（④ 迁移）、doc 步与 Files 的 spec 行加前置「只在迁移已收回零之后写 `census:pin.total = 0`」，Acceptance 补这条交付腿（例题零断言与该引用都只在迁移落地后认领），T6 · Acceptance 的「零只有一个来源」补上 T8 那次迁移。F2 census 四行的语料入口没点名根来源——模块作用域的 `CORPUS_ROOTS` 会在 import 时展开 README 半边，而 `contract/pins.ts` 已在 `face/lifecycle.ts` 的 import 图上、消费方安装后其根下没有 `packages/` 树；本轮把声明落成纯函数 `corpusOf(root)`（调用时展开、import 惰性），点名根从调用方来（测试面仓根来自 `import.meta.url`，生产侧唯一来源 `face/cli.ts#rootOf()`），登记表由组合点以交来的 `PinAudit` 与 `corpusOf(root)` 构造而不是模块单例，并补一条语料身份成对 pin（`pin.files` 等于测试文件的长度 pin、`pin.total` 等于同一扫描的 length，语料落空即红）。F3 §8.3 的下限 pin 只点名三节——符合文法的引用在 §1.3 · §3.1 · §6.1 · §6.2 · AC ③ · AC ⑦ 与本计划都出现，只删三节仍绿、声明的红不会发生（当轮读数不登记：本条自身也带引用，写一个总条数就是把它钉成目标）；本轮把下限改成机械可判（门交出比对过的引用条数、测试断言 ≥ 1），删光动作覆盖全部符合文法的引用，Files / Steps / Acceptance 的节名列表一并改准。本行随 fix 轮的 `capability: may.amend = content` 落地，Task id 集与 `DependsOn` 集未动 | Oscaner M. · Claude（kairos:cdd-fix · 2026-11-16） |
| v0.24 | 2026-11-16 | docs-fix round 17（plan-review-17 · F1–F3 全受理）· 仍消费 spec `2026-11-16-engine-doc-tooling-p37-design` 的 `v0.18`：F1 §7.1 成员段的空载体缺口——以 `#` 开头的 token 取最后一个 `#` 时界在首位、载体是空串，载体筛必然不过，于是这一形（§7.1 自己的裸符号拼法之一）被整枚判成散文，死成员因此产不出 finding，而语料里以 `#` 开头的裸符号靠同一处解析。本轮把守卫写进 T8 的 ③：**空载体不是成员引用**，回落裸符号形态按整枚 token 判（`#` 是它自己的符号前缀，不是分隔符），并把成员格由五格补到六格——新增「空载体的死成员连写 ⇒ 恰一条 `symbol`」与它的反向面「同一位置的活成员连写 ⇒ 零」，Files / Produces / Steps / Acceptance 四处同步；spec §7.1 的同一句尚未写这条守卫，spec 面的修复轮按本句补，落地面以本计划这一句为准。F2 T8 那处前置由「先写就红」的时序叙事改回事实：这条引用本计划自己已写着九处、spec 里 0 处，门读的是语料整体，③ 一落地那批引用就在断言零而 `pin.total` 读到成员 finding ⇒ 红在 spec 改动之前已既定，spec 那一句与 ③ ④ 同一次提交，不能当时序杠杆（第 4 步的「硬约束而不是建议」原样保留）。F3 Constraints 的落点表把 §7.1 的成员引用形态与其存量迁移写进 T8 的 row（§7.1 的三形态仍归 T6），读者按这张表问「哪一节无主」时不再看到 T8 只承 AC ⑦。本行随 fix 轮的 `capability: may.amend = content` 落地，Task id 集与 `DependsOn` 集未动 | Oscaner M. · Claude（kairos:cdd-plan plan-fix-17 · 2026-11-16） |
| v0.25 | 2026-11-16 | docs-fix round 18（plan-review-18 · F1–F3 全受理）· 仍消费 spec `2026-11-16-engine-doc-tooling-p37-design` 的 `v0.18`：F1 T8 的迁移 remedy 恢复规则 ⑦ 的中间支——载体在、成员今天仍存在只是名字过了时 ⇒ 改成今天的符号名，只有已消失的成员才退回散文；两条分支的合并会把一条仍站得住的坐标降级成散文，而本行要处理的正是这一支的存量。同时把实例点进该行（本计划里的 `PinIndex.resolvePath` 那一形 ⇒ 今天的 `PinIndex#resolve`，T7 · Steps 第 3 步已按今天的名字写着它），本轮由此新增的这几枚也在同一张待迁清单上（清单是当轮扫描的 finding 集，不预登记条数），并撤掉「本行因此不写任何这类 token 的字面」那句已被本文自身证伪的话；Steps 第 4 步的「T7 那两条」同步改成规则 ⑦ 的三支。F2 T8 的三个登记数（`criteria.rows` · `questions.rows` · `questions.cells`）此前只活在消费侧的句子里：本轮在 T1 / T2 的 Produces 登记 `CRITERIA_ROWS` / `LENS_QUESTION_ROWS` 为导出，并在 T8 的 Consumes 补两条供给面行，供应面因此不再只由消费者自述；T8 对 T1 / T2 的 `DependsOn` 边属结构面，本轮 `capability: may.amend = content` 不得改，留待编排器补（先例 v0.6 给 T5 补 `1`）。F3 T8 对 spec §7.3 的正文改动补上血缘义务——同一句与 spec 的 `## Change history` 行（`v0.19`）、front-matter `version:` 的抬版同一次编辑落地：doc 契约腿只比对 front-matter 与最新行、行与行，不比对正文与血缘，漏写不会红，而本计划的 Constraints 按 `version:` 消费 spec 的面，不带血缘行的正文改动会让 `v0.18` 同时指两个面；仓内先例是 spec 自己的 `v0.11` / `v0.15`。本行随 fix 轮的 `capability: may.amend = content` 落地，Task id 集与 `DependsOn` 集未动 | Oscaner M. · Claude（kairos:cdd-plan plan-fix-18 · 2026-11-16） |
