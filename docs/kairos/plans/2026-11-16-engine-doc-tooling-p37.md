---
title: '引擎文档工具（Engine Doc-Tooling）— P37 计划：分级判据的可核化（功能影响 · 三级边界 · 生成式注册表 · pin 门）'
doc-type: plan
version: v0.13
date: 2026-11-16
slug: 2026-11-16-engine-doc-tooling-p37
base: develop
---

## Constraints

- **逐字取 spec**：本计划只实现 `docs/kairos/specs/2026-11-16-engine-doc-tooling-p37-design.md`（slug `2026-11-16-engine-doc-tooling-p37`）在本轮被消费那一刻的 `version:` 所指的面。本 bullet 只记「哪一节落在哪个任务」，**不记版本坐标**——spec 再升一版也不需要改这一行；本计划实际消费的是哪一版，记在 `## Change history` 里本轮那一行。落点：§1 + §6.1 判据表半边 + §6.2 判据面观察者归 T1 · §3 + §6.1 lens 问句半边 + §3.2 + §6.2 问句面观察者与 15 行 / 19 格计数归 T2 · §2 归 T3，除 §2.1 的 `RoundFinding` 三格与两个投影（→ T5）与 §2.3 的 `contract.path` 回读（→ T6）· §4 归 T4 · §5 归 T5 · §7.1 pin 定义与三形态 + §7.4 pin 判据行 + §7.2 的后两份语料（被审文档正文 · `contract.path`）+ §2.3 的 `contract.path` 回读 + AC⑦ changeset 归 T6 · §7.3 存量迁移归 T7。§6.2 的三种 `face` 各由创建该执行面的任务核，一律走字面量、不跨任务 import：`numbered` 与语料计数落在承载该表的测试面（T1 判据表 / T2 问句表）；`gate` 落在 T3——它打的 `CDD_BLOCKED: grading-impact-missing` 第二词就是该判据行的 `id`；`test` 落在 T6——`contract/__tests__/pins.guard.test.ts` 里一条格题以字面量点名 `pin-parseability`。§7 的测试面只承接 pin 语料。
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

- `CriteriaRegistry`（或等价类名）· `CRITERIA.of(id: string): CriteriaRow`（查不到即抛）· `CRITERIA.renderRubric(): string`
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
- 类型层那一段的 pin（不进 vitest）：临时从一行的字面量里删掉 `counterExample` 键，`pnpm exec tsc --noEmit -p packages/cdd-engine` 红；恢复即绿。它是 buildability 证据，不在测试里冒充「装配抛」——套件走 esbuild（AGENTS.md 的 trap），删键在运行期只是 `undefined`，抛的是 `TypeError`，两条红法不能互相顶替 — checkable: `tsc --noEmit` 删键前绿 / 删键后红
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

#### Consumes

- T3 的 `contract` 字段

#### Produces

- `PinAudit.scan(roots): readonly PinFinding[]`（路径解析 + 符号索引 + 测试格题）；路径形按 §7.1 的 `path.ext[:line[-line]]`——行号可省，省略时就是裸路径 pin，出现时不得超过该文件的行数，且不比对内容
- **pin 的定义（§7.1，门的一部分）**：一个反引号 token 只在三条同时成立时才是 pin，否则它是散文词汇、不受本门管辖——① **仓根相对**：`path` 不以 `./` / `../` 开头，也不以 `...` 省略号开头；② **不是产物词汇**：workspace 产物名（`progress.json` · `base.json` · `in-flight.json` · `liveness.json` · `tasks-<N>-<op>.json`）、后缀（`.rulings.json`）、模板（`X.md` · `-overall.md` · `-design.md`）**都是词表条目，不是坐标**；③ **不是易逝物**：按设计在发布时被消费删除的 `.changeset/*.md` 引用是记录而非主张。三条排除就是语料能被 T7 清到零的充分条件，因此它们必须随实现落地
- **排除 ② 的两族匹配规则不同，必须分写**：**产物族**（`progress.json` / `base.json` / `in-flight.json` / `liveness.json` / `tasks-<N>-<op>.json` / `*.rulings.json`）按**形状**匹配——它的具体实例是机器本地路径（`plan-fix-1.c1.rulings.json`、`tasks-1-fix-1-a2.c1.json`、`<workspace>/progress.json`），在别的 clone 里永远不会解析，因此凡以这些名字收尾的 token 都不判；**模板族**（`X.md` / `-overall.md` / `-design.md`）只在该 token **就是**该词表条目时排除——一个真实的 `<dir>/<slug>-design.md` 路径仍是被判的坐标，因为它是本轮注入 `INPUT_SPEC` / `INPUT_OVERALL` 的那一份。用后缀规则扫模板族会让 §7.3 的迁移路径类被静默清空：`docs/kairos/plans/2026-10-10-engine-doc-tooling-p17.md` 里的 `docs/kairos/specs/2026-10-10-engine-doc-tooling-overall.md` 以 `-overall.md` 收尾，而它正是过期坐标（P17 已把该档迁到 `overalls/`），必须产出 finding 并被 T7 改写成现行路径
- 语料声明写死在测试里、**没有在册清单**：§7.1 全语料 = `docs/kairos/**/*.md` + README 家族（`README.md` · `README.zh-CN.md` · `packages/*/README*.md`），无基线 / 无白名单 / 无豁免；扫描文件数作为语料规模常量钉住——文档进入或离开语料即红
- 门的可红可修成对 pin：播种一条指向不存在符号的 markdown pin ⇒ 红且指出该 pin ⇒ 移除 ⇒ 绿。**零 finding 不是本任务的 checkable**——语料今天非干净，那条断言由 T7 在同一例题里把扫描非零的断言换成零断言后交付（见 T7 Files）
- `pin-parseability` 的 `test` 面：`pins.guard.test.ts` 里一条以字面量点名 `pin-parseability` 的格题（T1 判据表那一行的 `face: "test"` 由它占位，不 import 注册表）。该名与 §6.2 / §7.4 现在同名（spec v0.10 采纳了 `pins.guard.test.ts`，与仓内 `doc-corpus.guard.test.ts` / `dockey.guard.test.ts` / `phase-inventory.guard.test.ts` 同惯例），因此 v0.4 行记名的那处改名偏差已闭合、不再有偏差可记；本行只钉该执行面落在哪个文件哪条格题上
- 语料二——文档评审回读面（§7.2 第 2 份）：judge 面且为文档评审轮（`TARGET_TYPE` 为 doc 三型）时，在 `#reconstruct` 里对**本轮被审文档的正文**跑一次 markdown 扫描。读缝点名在这里：语料的路径直取 `frame.target`——三个 doc 型（`phase-spec` / `overall` / `single-spec`）的 `frame.target` 是 `{ kind: "spec", doc }`，`doc` 就是那份文档的仓内路径；正文走本类既有的 repo 读（`readFileSync`）。等价路由是 `#artifacts.read({ domain: "doc", slug, docType }, docType, workspace)`：`slug` 来自 `workspace.slug`、`docType` 由 `frame.type` 所指的 doc 型给出，返回的 `path` 与 `frame.target.doc` 在本轮指向同一份文档（`#sceneOf` 已在派发前挡掉重复身份）。身份解析（`--spec` → slug、`SlugIndex` 建索引与回读）发生在 `face/cli.ts#sceneOf`，不属 `#reconstruct`：本条只承接那份解析结果，不重建索引、不把文档正文塞进 `DispatchScene`。`INPUT_SPEC` / `INPUT_OVERALL` 是它的引用，**不是语料**。解析不到的 pin 折算成 `severity: warn` 的 finding 注入 `findings[]`，`summary` 指出失效的 pin；lens 不写死，取该评审面自己声明的 `pinLens`（`render/templates.ts#pinLensOf`，与同一份 `lensEnum` 交叉校验、drift 即抛）——`phase-spec` / `single-spec` 面为 `consistency`，`overall` 面为 `inventory`；它不新增拒绝面（不出 `CDD_BLOCKED`），但**不是结论中性**：warn 按既有语义被 `rollup` 读到，一份带死 pin 的被审文档在文档评审轮落到 `REVIEW_FIX`，而不是停在今天的 `APPROVED`
- 语料三——交接单 finding 行（§7.2 第 3 份）：有 `contract` 则解析其 `path`，失效 ⇒ 追加一条 `severity: warn` 的 finding，lens 同样取该面声明的 `pinLens`（`contract` 这一格在每个判据面上都会出现，因此这一份语料不是 spec 专用：`wave` / `branch` 面为 `standards`、`plan` 面为 `buildability`）（只判 `contract` 这一格，`PinAudit` 的 markdown 扫描永不承接）；追加点与语料二同一处——`#reconstruct` 里、局部 `findings` 取值与 `schema.conclusionOf(plane, draft)` 之前写进 `draft.findings`，因此那一次 `rollup`、`DraftedOutcome.findings` 的投影、载体三处同源；不 BLOCK（无 `CDD_BLOCKED`），本来零 finding 的评审轮因此落到 `REVIEW_FIX` 而不是停在 `APPROVED`。**判点不在 `#materialize`**：`#reconstruct` 先算 `const status = schema.conclusionOf(plane, draft) ?? "BLOCKED"` 再调 `#materialize`，在写者里追加的 warn 会进载体而 `DraftedOutcome.status` 仍是 `APPROVED`——一轮打印一个结论、携带另一个，正是 §2.3「它按 warn 的既有语义参与 `rollup`」与 §7.2「落到 `REVIEW_FIX`，不会停在 `APPROVED`」禁止的形态

#### Steps

- 写失败测试：注入一条指向不存在符号的 markdown pin ⇒ `PinAudit` 非空且指出该 pin，移除 ⇒ 空；扫描文件数等于 §7.1 语料声明；`pins.guard.test.ts` 有一条点名 `pin-parseability` 的格题 — checkable: 红
- 写失败测试（pin 定义的三条排除，各一对）：`./x.ts` 或 `...` 省略形 token ⇒ 零 finding；产物族 token（`progress.json` · `plan-fix-1.c1.rulings.json`）⇒ 零 finding；模板族的裸词（`X.md`）⇒ 零 finding，而同一位置上的真实死引用 `docs/kairos/specs/2026-10-10-engine-doc-tooling-overall.md` ⇒ 恰一条 finding（两族规则不同，这一对就是分界：模板族按后缀匹配会让它是零 finding）；已消费的 `.changeset/*` 引用 ⇒ 零 finding；而同一位置上仓根相对、非产物词汇、非 changeset 的真死引用仍产 finding — checkable: 红于排除未实现（扫描器把词汇当主张）
- 实现三形态解析（§7.1）与缓存符号索引，并把 §7.1 的 pin 定义（三条排除）实现为解析前的筛选；结构测试落在 §7.1 全语料（无在册清单、无基线）— checkable: 播种态红 / 移除后绿，语料规模断言绿，三条排除各一对绿；零 finding 的断言留给 T7
- 语料二的回读（§7.2 第 2 份）：judge 面且为文档评审轮时，对 `frame.target.doc` 指向的本轮被审文档正文（类既有 `readFileSync`）跑 `PinAudit` 的 markdown 扫描，解析不到的 pin 折算成 warn 追加进 `draft.findings`（lens 取该面声明的 `pinLens`，`phase-spec` / `single-spec` 面为 `consistency`）；随后照既有 rollup 出结论——不调用 `#reject`（无 `CDD_BLOCKED`）— checkable: 成对 pin 绿——干净的被审文档 ⇒ 零注入 finding、结论与注入前相同（`APPROVED` 仍 `APPROVED`）；文档里一条解析不到的 pin ⇒ 恰好多一条 warn、零 blocker、结论落 `REVIEW_FIX`
- 语料三的回读（§7.2 第 3 份）：在 `#reconstruct` 里、`schema.conclusionOf` 之前，有 `contract` 则解析 `path`；失败则把 `severity: warn` 的 finding（lens 取该面声明的 `pinLens`）追加进 `draft.findings`（与语料二同一注入点、同一次 `rollup`），不调用 `#reject`；`#materialize` 照常写载体并由 `#findingsList` 给注入行编 `id` — checkable: 成对 pin 绿——零 finding 的评审轮带一条失效 `contract.path` ⇒ 无 `CDD_BLOCKED`、结论 `REVIEW_FIX`（不是 `APPROVED`）；`path` 可解析 ⇒ 结论不变；把注入点挪到 `#materialize` ⇒ 结论那条 pin 红（载体里多一条 warn，而 `DraftedOutcome.status` 仍 `APPROVED`）
- 写 changeset（minor · 简述三级边界 / impact 门 / lens 问句 / wave 注入 / regrade 标记 / pin 门）+ `pnpm run validate` — checkable: validate exit 0；changeset 在册
- 提交 — checkable: commit 存在

#### Acceptance

AC ⑥（一条判据、三份语料、两个执行面；成对 pin 逐条：语料一的门可红可修 · 干净的被审文档 ⇒ 零注入且结论不变 · 一条死 pin ⇒ 恰一条 warn、零 blocker、落 `REVIEW_FIX` · `contract.path` 失效 ⇒ 无 `CDD_BLOCKED` 且落 `REVIEW_FIX` 而非 `APPROVED`——两份回读语料同在 `#reconstruct`、同在 `conclusionOf` 之前注入 `draft.findings`，判与写分属 `#reconstruct` / `#materialize` 而同属一条回读面；pin 定义的三条排除各有成对 pin——排除 ② 的两族各一条：产物族按形状、模板族只判裸词本身，真实 `<dir>/<slug>-overall.md` 死引用仍产 finding）+ AC ⑦。语料声明与规模 pin 在册。全语料零 finding 由 T7 交付，T6 只证明门能红（播种一条坏 pin ⇒ 红 ⇒ 移除 ⇒ 绿）。

#### DependsOn

3

### Task 7: 存量 pin 迁移（按 finding 形态处置：省略与占位去路径化 · 过期引用 · 迁移路径（含缩写补全） · 本仓之外坐标去路径化 · 机器本地产物名去路径化 · 行号收口 · 死符号去反引号）

#### Objective

落地 spec §7.3：把全语料的 pin 清到零 finding，作为门的上线条件。只改坐标与引用句，不改任何结论、裁定或交付记录。处置规则按门**实际产出的 finding 形态**定，不按 §7.3 的三类名定——那三类名只覆盖 `path` 形态的一支，`symbol` 形态在语料里占八成，没有对应规则就等于把规则留给实现者临场发明，而最省力的发明是给整片历史叙述去反引号或者改写句子。

#### Files

- Modify: `docs/kairos/**/*.md` 与 README 家族中携带失效 pin 的文档（按下面七条处置规则；已消费 `.changeset/*` 不在其中——§7.1 的排除 3 已判其为记录，它们产不了 finding；本计划自身也在语料内，迁移波次同时清理它）
- Modify: `packages/cdd-engine/src-next/contract/__tests__/pins.guard.test.ts`（**替换，不是新增**：T6 那条「declares the whole corpus and pins its size — the docs tree plus the README family」例题里的 `expect(audit.scan(CORPUS_ROOTS).length).toBeGreaterThan(0)` 换成零 finding 断言（`toBe(0)`），同一例题里语料规模那条长度 pin 保留；文件头「The corpus is NOT clean today … zero findings is the AFTER-migration condition」那段改写成迁移后的陈述。T6 的播种态红 / 移除后绿仍是**独立例题**，不被这次替换覆盖——两条相反的断言同处一套件会让它永久红，而本任务又要求它绿）

#### Consumes

- T6 的 `PinAudit` 与 pin 定义（三条排除）

#### Produces

- 全语料 `PinAudit` 零 finding；迁移清单（按 finding 形态的七类处置条数 · 残留比对里抹掉被报告 token 后仍报差异的例外行数与逐条点名）记入本任务提交信息

#### Steps

- 跑 `PinAudit` 全量扫描并落清单——**按 finding 形态分，不按 §7.3 的三类名分**：门今天只产出两种形态，`symbol`（裸符号）与 `path`（路径 / 带行号范围）。首次全语料扫描以已交付的 `PinAudit` 实测，形态比例是 `symbol` 约八成 · `path` 约两成；**绝对条数不登记**——语料每一轮 fix 都会改写它自己的正文（本计划与 spec 也在语料内），任何固定读数下一轮就过期，登记它只给下游一个不可核的数，量级因此只写比例。这些是规模参考、不是预登记的目标：迁移的判据是重扫归零，不是把某个数改对 — checkable: 清单里每一条 finding 都能落到下面七条规则中一条的触发词或 remedy 上（两者命中其一即算归属——缩写只命中 remedy；仍归不进 ①–⑤ 的由末条兜底按 ④ 的 remedy 处置），无一条落空；`symbol` 那一千余条与 `path` 的每一支（省略与占位 · 目标已消失 · 搬迁或缩写 · 本仓之外坐标 · 机器本地产物名 · 越界行号）各有一条点名它的规则，不是留给实现者临场发明
- 按 finding 形态处置：**先给每个 `path` token 定一条路径规则**（①–⑤，按下列顺序取第一条命中），**再对处置后仍带行号的 pin 统一收口**（⑥），`symbol` token 走 ⑦：① `path` · 省略号截断或示例占位——U+2026 形、夹在路径中间的 `...`（以 `...` 开头的 token 已由 §7.1 排除 ① 挡在门外）、以及从未存在过的示意路径与示例占位名 ⇒ 去路径化并保留「当时取的是哪一类文档 / 哪一份产物」这个事实，**不得**写成「目标已按设计消失」——它从来不是坐标，只是一段截短的叙述 · ② `path` · 目标已按设计消失（已删的 doc 目录 · 已退役的脚本 · 已退役的产物名）⇒ 改为不指路径的表述、保留「当时做了什么」（§7.3 过期引用删除）· ③ `path` · 目标已搬迁或改名，或只是被写成了现行文件的缩写（省略前导目录 / 代号的简写，目标从未搬过）⇒ 写全现行路径（§7.3 迁移路径修正；本相位把缩写并入本条 remedy——触发词判「搬过或改过名」，remedy 判「写全就行」，缩写只命中 remedy）· ④ `path` · 本仓之外的坐标（第三方包内部文件 · 兄弟插件的 agent / skill 文件 · 不带目录的包外裸文件名）⇒ 去路径化：点名包或插件与它对外的入口，不写包内文件——这类路径随依赖版本消失，在别的 clone 里不可维护（本相位新立；§7.3 未列，因为它不是本仓的坐标）· ⑤ `path` · 机器本地 workspace 产物名，且不在 §7.1 的产物词表内（`tasks-<N>-<op>.json` 之外的评审 / 取证产物名）⇒ 去路径化到族名（只说「那一轮的评审产物」，不写文件名），不许把机器本地名原样留下。**扩产物词表这条路本相位不走**：§7.1 的产物词表由 P36 的产物矩阵（`session/round-artifacts.ts` 的 `DEFAULT_DOMAINS`，经 `ArtifactRegistry.ownsName` 判名）拥有，那是一张带自己身份门与轮回 pin 的闭集，把机器本地名教进去等于在「重扫归零」这件被它判的事上挪动判据——判据与它判的对象会挤进同一个任务，且那个文件不在本任务的 Files 内、新条目也没有成对 pin 覆盖。去路径化到族名是唯一一条路，也是够用的一条（本相位新立；六名词表没覆盖它，门因此把它当坐标）· ⑥ 行号收口（与路径规则叠加，不与它们竞争）：处置之后仍带行号的 pin 一律改成路径 + 符号、不留行号（§7.3 行号越界修正）——路径可解析、只是行号越界的由本条单独收口；既缩写又越界的先由 ③ 写全路径、再由本条去掉行号 · ⑦ `symbol` · 裸符号解析不到（已改名 / 已删除的标识符 · 只活在历史叙述里的常量 · 语言内置的全局名）⇒ 去反引号，让它从主张退回散文词汇；若它仍指今天树里的某个符号、只是名字过了时，改为今天的符号名。末了一条是兜底而不是裁量：任何仍归不进 ①–⑤ 的 `path` token 按 ④ 的 remedy 处置（点名所属包 / 仓库与它对外的入口、保留事实），并把该形状补回本清单——remedy 已钉死，实现者只补形状、不补做法。七条都只动坐标与引用句，结论面一个字不动 — checkable: 重扫 finding 归零，且清单上每条 finding 的处置可逐条对照（删的删、改的改），没有一条是靠改写句子「看起来清掉」的
- 残留比对（保存边界的一次性核验，不是新门——§7.4 的窄形态不变）：对每个改动文件，取迁移前提交里的同一路径作前像、工作副本作后像，两侧各剥掉行内代码段（`git show` 前像 · 一次性脚本剥段），**并在两侧把清单上该文件被报告的 token 抹成空白**，然后逐行比对——token 自己的位移（去反引号、写全路径、去路径化）因此不产生差异，而同一行上任何散文改动仍会显形。残留差异必须为空；例外**只按点名从句成立、不按子串成立**：剥段并把该文件被报告的 token 抹白之后，再在两侧各删掉这条 finding 逼出来的那处引用从句（每一处在迁移清单里挨着它的 finding `id` 点名，写出改前 / 改后的句子），余下的字节必须逐字相同；落在这处点名从句之外的任何残留 ⇒ 红。子串判法不可用：规则 ① ② ④ ⑤ 的 remedy 全都是在原路径位置上**加一个从句**，而「抹 token 后的差异串是被删部分的子串」只认删除，会把这几条规则要求的改写全部判红，于是最省力的绿是停用这条核验。「该行迁移前带过一条被报告的 finding」不自动获得例外资格——抹 token、删点名从句之后仍报差异的行才算例外，逐条点名也只在这些行上做 — checkable: 播种一对后像——同一行只去反引号 ⇒ 零残留差异、不占例外名额；同一行按规则 ② 把一处指向已退役目录的引用改写成不指路径的表述（路径位置上换成一个从句）⇒ 抹 token 并删掉该处点名从句后余量为空、绿；同一行再在这处点名从句之外把「三条」改成「两条」⇒ 残留落在点名从句之外、无例外资格 ⇒ 比对红。清单的例外条数 = 比对报出的例外行数，每一处都点得出它清掉的是哪条 finding
- 跑 pin 门与 doc 契约的六条腿，逐条点名文件而不是写一个 `vitest run` 认不得的族名（`doc-contract` 是 `contract/rules.ts` 里的门概念，不是套件）：`pnpm -C packages/cdd-engine exec vitest run src-next/contract/__tests__/pins.guard.test.ts src-next/contract/__tests__/doc-corpus.guard.test.ts src-next/contract/__tests__/dockey.guard.test.ts src-next/contract/__tests__/phase-inventory.guard.test.ts src-next/contract/__tests__/structure-pin.test.ts src-next/contract/__tests__/change-history-header.test.ts` — 这五条 doc 契约腿分别是语料清单 · doc 键 · 相位标识 · 结构 pin · 变更史表头，迁移会同时动到它们所判的字节 — checkable: 六条命令全绿，且文档结构 / 变更史 / 相位标识未被迁移破坏
- 提交 — checkable: commit 信息含七类处置条数与残留比对的例外条数

#### Acceptance

全语料零 finding（无基线 / 无白名单 / 无豁免）；doc 契约全绿；七条处置规则覆盖清单上的每一条 finding（触发词或 remedy 命中，无一条落空；仍归不进 ①–⑤ 的由末条兜底处置，remedy 钉死）；迁移未改动任何结论或交付记录——这条边界有一步核验而不是只有一句承诺：每个改动文件的行内代码段剥掉后、再抹掉该文件被报告的 token，与其迁移前副本逐行比对，残留差异为空；例外只许落在迁移清单里点名的那处引用从句内部（抹 token 之后再在两侧删掉该从句，余量逐字相同），且只在这些行上逐条点名、条数相等；落在点名从句之外的残留一律红。「该行迁移前带过 finding」本身不是例外资格：同一行只去反引号 ⇒ 零残留差异、不占名额；同一行按规则 ② 换成一个从句（规则 remedy 的常态是加从句而不是删）⇒ 删掉点名从句后余量为空、绿；再在这处从句之外把「三条」改成「两条」⇒ 残留落在点名从句之外 ⇒ 核验红，而 pin 门与 doc 契约套件在这处改动上都是绿的（这正是要这条核验来兜的那一类改动）。「doc 契约全绿」落到五条具体腿上（语料清单 · doc 键 · 相位标识 · 结构 pin · 变更史表头），不写族名。

#### DependsOn

6

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-11-16 | 初稿：六任务两波——T1 判据表+rubric 装配 · T2 lens 问句+axesGuide 投影（DependsOn 1）· T3 impact/regrade/contract+gradingViolations · T4 wave 注入 · T5 改档显示面（DependsOn 3）· T6 pin 门+contract.path 回读+changeset（DependsOn 3）；消费 spec `2026-11-16-engine-doc-tooling-p37` 当时 `version:` | Oscaner M. · Claude（kairos:cdd-plan · 2026-11-16） |
| v0.2 | 2026-11-16 | docs-fix round 1（plan-review-1 · F1–F3 全受理）：F1 Constraints 落点补 §6.2 并显式声明本相位判据表的 `face` 用法（`numbered` 进字节 · `test` 有格题 · `gate` 空集）⇒ T1 增判据面结构测试、T2 增问句逐字投影与 15 行 / 19 格计数；F2 T1 产出 `regrade-mark`（`nit` · `numbered`）行，T5 Consumes 取该行 `body` 作改档标记唯一措辞来源；F3 T6 补 §7.2 第 2 消费者（文档评审回读注入 `PinAudit` 语料 finding、不改结论），Files/Steps 为两个消费者各点名 colocated 测试 | Oscaner M. · Claude（kairos:cdd-plan plan-fix-1 · 2026-11-16） |
| v0.3 | 2026-11-16 | docs-fix round 2（plan-review-2 · F1–F6 全受理）：F1 T6 撤掉不存在的「在册」概念——语料写死为 §7.1 全语料、扫描文件数作规模 pin、零 finding 归 T7，T6 的 checkable 改为播种可红可修；F2+F4 判据表补 `pin-parseability`（warn · `test`）行承载 §7.4 的理由与边界，`face` 面额补成 `numbered` 3 · `gate` 1（blocker 行 `id` 即报文第二词）· `test` 1，T1 的结构测试改钉面额与字节，`gate` / `test` 各自在 T3 / T6 的测试面成对钉；F3 T5 点名标记的四处缝（ledger 投影 → lifecycle 生产者 → `DispatchOutcome.dispositionsSummary` → `run.ts#capsuleLines` 的既有 `summary` 槽），胶囊那行明示为设计里唯一新增可见字节，`capsule.ts` / `run.ts` 因此不是改动点；F5 T4 把 `#valuesOf` 的 `INPUT_SPEC` / `INPUT_OVERALL` 两臂点名为必改点，删掉条件对冲；F6 T3 点名 `lifecycle.test.ts` / `cli.test.ts` 两个具体测试文件 | Oscaner M. · Claude（kairos:cdd-plan plan-fix-2 · 2026-11-16） |
| v0.4 | 2026-11-16 | docs-fix round 3（plan-review-3 · F1–F8 全受理）· 消费 spec `2026-11-16-engine-doc-tooling-p37-design` 的 `v0.8`：F1 T6 按 §7.2 重述为一条判据 · 三份语料 · 两个执行面，第 2 份语料改为**本轮被审文档正文**（`INPUT_SPEC` / `INPUT_OVERALL` 是它的引用，不是语料），两份回读语料的后果改准为 warn 进 `findings[]` ⇒ `REVIEW_FIX`（不出 `CDD_BLOCKED`，但不是结论中性），补 AC ⑥ 的三条成对 pin（干净文档零注入且结论不变 · 一条死 pin ⇒ 恰一条 warn、落 `REVIEW_FIX` · `contract.path` 失效 ⇒ 无 `CDD_BLOCKED` 且落 `REVIEW_FIX`），Acceptance 的「三个消费者」改为「一条判据、三份语料、两个执行面」；F2 T7 把已消费 `.changeset/*` 移出迁移清单与计数（§7.1 排除 3 已判其为记录），清单回到过期引用 / 迁移路径 / 行号越界三类；F3 T4 补齐 AC ④ 的四臂（single-spec 只出 `INPUT_SPEC` · `program:` 解析不到只丢 `INPUT_OVERALL`）并逐臂 pin，两格各自独立判定；F4 T1 按 §1.3 的序把反例句落到行上（blocker 行 ← 第一条 · warn 行 ← 第三条 · nit 行 ← 第四条 · 第二条作为 (a) 实例的收口句进 blocker 行 `body`）；F5 T1 补 §6.1 的两段校验契约——空白格与零行档位走装配期抛，删键走 `tsc`，两条红法不互相顶替；F6 T6 Produces 点名 §7.1 的 pin 定义（三条排除）并为每条约一条成对 pin；F7 本行记录消费的 spec 版本（`v0.8`）；F8 保留 `pins.guard.test.ts`（与仓内 `*.guard.test.ts` 同惯例），作为对 spec 当时字面路径的有意改名记名于此——该偏差已由 spec v0.10 采纳本写法而闭合，见 v0.13 行 | Oscaner M. · Claude（kairos:cdd-plan plan-fix-3 · 2026-11-16） |
| v0.5 | 2026-11-16 | docs-fix round 4（plan-review-4 · F1–F4）· 仍消费 spec `2026-11-16-engine-doc-tooling-p37-design` 的 `v0.8`：F1 T6 把语料三的判点从 `#materialize` 移回 `#reconstruct`——`#reconstruct` 先算 `status = conclusionOf(plane, draft)` 再调 `#materialize`，在写者里追加的 warn 会进载体而结论仍 `APPROVED`，因此两份回读语料同在 `conclusionOf` 与局部 findings 投影之前注入 `draft.findings`，`#materialize` 只留 carrier 写者的角色（注入行的 `id` 由 `#findingsList` 编），并补一条把注入点挪回写者即红的 checkable；F2 T5 补两条 checkable（上一轮同键 `impact.scenario` 为空 ⇒ 不要求 `regrade`、不标记；本轮改写 `scenario` 而 `summary` 不变 ⇒ 仍配对、仍出标记）与 Objective 的第 4 步分支，Acceptance 由「AC ⑤」改为 AC ⑤ 的全部腿逐条列出；F4 T2 的 `LensQuestionRow` 由单值 `reviewKind` 改为多值 `reviewKinds`（wave/branch 共享行正文只存一次），物理行 15 与逻辑格 19 由 `rows.length` 与 `sum(reviewKinds.length)` 两条独立断言各读一次，`forReviewKind` 按 `reviewKinds` 展开；F3 只落内容面——T5 的 Consumes 记清「哪一格由哪个前置供给」，`DependsOn` 集属结构面、本轮 `capability: may.amend = content` 不得改，T5 对 T1 的 `1` 这条边留待编排器补 | Oscaner M. · Claude（kairos:cdd-plan plan-fix-4 · 2026-11-16） |
| v0.6 | 2026-11-16 | **结构面补齐（评审 F3 的编排器半边）**：T5 的 `DependsOn` 由 `3` 改为 `1, 3`——T5 消费 T1 的 `regrade-mark` 行（标记措辞唯一来源）与 T3 的 `impact` / `regrade` 字段，图里此前缺 T5 -> T1 这条边。fix 轮正确地把结构面交回编排器（`may.amend = content`），故由本提交落地；内容面已由 `01130594`（v0.5）完成，消费的 spec 版本为 `2026-11-16-engine-doc-tooling-p37` v0.8 | Oscaner M. · Claude（编排器 · 2026-11-16） |
| v0.7 | 2026-11-16 | docs-fix round 5（plan-review-5 · F1–F4 全受理）· 仍消费 spec `2026-11-16-engine-doc-tooling-p37-design` 的 `v0.8`：F1 Constraints 的 OOP 上限补上 spec §Constraints 的豁免——≤200 行只约束本相位新建的类，四个既有文件（`session/ledger.ts` · `face/lifecycle.ts` · `face/board-view.ts` · `session/handoff-schema.ts`）按 rule zero 免于该上限、每处改动写一行理由、拆分归 P39（D95 ②），约束不再诱使实现者在本相位拆神对象；F2 T6 的语料二点名读缝——路径取自 `frame.target`（三个 doc 型为 `{ kind: "spec", doc }`）、正文走类既有 `readFileSync`，`#artifacts.read({ domain: "doc", … })` 为等价路由，并撤掉「`SlugIndex` 在 `#reconstruct` 解析到」的错挂（该解析在 `face/cli.ts#sceneOf`），`#reconstruct` 不建第二个索引；F3 Constraints 的落点表把「§2 全节归 T3」改准为「§2 归 T3，除 §2.1 的 `RoundFinding` 三格与两个投影 → T5、§2.3 的 `contract.path` 回读 → T6」，T6 那条同步收紧为回读面；F4 T5 点名板面那次读的两格投影——`countOf` 与 `findingsOf` 共用一次 digest 校验读与一次 `JSON.parse`，`countOf` 仍取原生 `findings` 数组长度（`+N` 的数字）、`findingsOf` 取过滤后的行，无第二次解析、也不留无调用者的死码 | Oscaner M. · Claude（kairos:cdd-plan plan-fix-5 · 2026-11-16） |
| v0.8 | 2026-11-16 | fix round 1（wave 1,3,4 · review-1 的 F1–F3 全受理）· 仍消费 spec `2026-11-16-engine-doc-tooling-p37-design` 的 `v0.8`：F1（§6.1 / §5.2）改档标记的措辞不再充当判据行的 `body`——`body` 换成 nit 档的判据句，标记措辞改由同一模块导出的 `REGRADE_MARK` 承接（T5 的措辞来源随之改为读该常量），并新增一条档位连续性 pin：每档片段是一条连续句子串、每格首字母大写且以句末标点收尾，把一个从句片段写回 `body` 即红；F2（T4）branch 的字节 pin 由两根锚点的 `toContain` 改为「`## Round context` 整段记录后逐字比对」，加一行或换序即红；F3（T4）fix 壳的子句把 `INPUT_SPEC` / `INPUT_OVERALL` 写到 wave 与 branch 两行上（wave fix 轮此前带两格而指令只归 branch 行），`TEMPLATE_PROMPT.$version` 23 → 24，并补 wave fix 轮的 dispatch pin；本行随 fix 轮的 `capability: may.amend = content` 落地，`DependsOn` 集未动 | Oscaner M. · Claude（kairos:cdd-fix · 2026-11-16） |
| v0.9 | 2026-11-16 | docs-fix round 6（plan-review-6 · F1–F2 全受理）· 仍消费 spec `2026-11-16-engine-doc-tooling-p37-design` 的 `v0.8`：F1 T6 的 pin 定义补回 §7.1 的收口句「都是词表条目，不是坐标」，并把排除 ② 拆成两族规则——产物族（`progress.json` / `base.json` / `in-flight.json` / `liveness.json` / `tasks-<N>-<op>.json` / `*.rulings.json`）按形状匹配，因为它的实例是机器本地路径；模板族（`X.md` / `-overall.md` / `-design.md`）只在该 token 就是词表条目时排除，一个真实的 `<dir>/<slug>-overall.md` 路径仍是坐标，否则 §7.3 的迁移路径类会被后缀规则静默清空（`2026-10-10-engine-doc-tooling-p17.md` 里指向 `specs/2026-10-10-engine-doc-tooling-overall.md` 的过期坐标就是那一类），Steps 与 Acceptance 各补一条让差异变红的成对 pin；F2 T2 的 Produces 点明 `ReviewKind` 由 `contract/review-criteria.ts` 自己声明（`contract/` 不 import `render/`，D95 ① 的边方向），`templates.ts` 的 `ReviewKey` 与之结构互 assign、不需要反向边 | Oscaner M. · Claude（kairos:cdd-plan plan-fix-6 · 2026-11-16） |
| v0.10 | 2026-11-16 | docs-fix round 7（plan-review-7 · F1–F3 全受理）· 仍消费 spec `2026-11-16-engine-doc-tooling-p37-design` 的 `v0.8`：F1 T7 的处置规则改按门**实际产出的 finding 形态**定，不再按 §7.3 的三类名——首次全语料扫描是 79 文件 / 2016 条 finding（1616 symbol · 400 path）、落在 69 文件上，三类名只覆盖 path 的一支，于是补两条规则（死裸符号去反引号 · 第三方包内路径去路径化），并把清单判据从「三类条数之和等于 finding 数」改为「每条 finding 都对得上一条处置规则、重扫归零」（旧判据在首跑就是红的，因 1616 条 symbol 无处置）；F2 T7 交付零 finding 断言的方式由「补」改为「替换」——`pins.guard.test.ts` 那条语料例题里的扫描非零断言换成零断言、文件头「corpus is NOT clean」那段改写成迁移后陈述，播种态那一对保留为独立例题（T6 的同句同步收紧），否则两条相反断言同处一套件会永久红；F3 保存边界补一条可执行步骤——每个改动文件剥掉行内代码段后与迁移前副本比对，残留差异为空，例外只许落在迁移前就带 finding 的行上且逐条点名、条数相等，Acceptance 同步点名这条核验 | Oscaner M. · Claude（kairos:cdd-plan plan-fix-7 · 2026-11-16） |
| v0.11 | 2026-11-16 | docs-fix round 8（plan-review-8 · F1–F3 全受理）· 仍消费 spec `2026-11-16-engine-doc-tooling-p37-design` 的 `v0.8`：F1 T7 的处置规则重排为七条并声明取用顺序与分工——① 省略号截断与示例占位（去路径化并保留「当时取的是哪一类文档」这个事实，明写不得写成「目标已按设计消失」）· ② 目标已按设计消失 · ③ 搬迁 / 改名 / 现行文件的缩写（触发词判搬过，remedy 判写全，缩写只命中 remedy）· ④ 本仓之外的坐标（第三方包内部文件 · 兄弟插件的 agent / skill 文件 · 不带目录的包外裸文件名）· ⑤ 机器本地产物名不在 §7.1 产物词表内（去路径化到族名，或在 T6 面扩产物词表，二选一）· ⑥ 行号收口作为叠加规则（处置后仍带行号的一律改成路径 + 符号，越界行号由此收口，路径可解析而只有行号越界的也归本条）· ⑦ 裸符号去反引号；末条兜底把仍归不进 ①–⑤ 的 `path` token 按 ④ 的 remedy 处置、把形状补回清单，remedy 钉死、只补形状不补做法；清单自检由「每条 finding 对得上五条中的一条」改为「每一条 finding 都能落到一条规则的触发词或 remedy 上」；F2 残留比对改为两侧剥段并抹掉被报告 token 后再比（token 位移因此不产生差异，同句散文改动仍显形），例外收紧为「抹 token 后的差异串落在因 finding 改写的引用从句内部」，逐条点名只对抹 token 后仍报差异的行，Acceptance 同步（同一行只去反引号 ⇒ 零残留；另改一个散文词 ⇒ 红）；F3 删掉两个错子计数（「33 条指向包内部」按本计划自己的括注实为 35，「86 条带行号范围」是 finding 条数而非 distinct token 数），只保留可复现的 79 文件 · 2016 条 finding · 1616 symbol · 400 path · 69 文件。本行随 fix 轮的 `capability: may.amend = content` 落地，`DependsOn` 集未动 | Oscaner M. · Claude（kairos:cdd-plan plan-fix-8 · 2026-11-16） |
| v0.12 | 2026-11-16 | fix round 3（wave 2,5,6 · review-3 的 F1–F2 受理）· 消费 spec `2026-11-16-engine-doc-tooling-p37-design` 的 `v0.9`：F1 T6 的两份回读语料不再写死 `lens: consistency`——注入行取该评审面自己声明的 `pinLens`（`render/templates.ts#pinLensOf`，与 `lensEnum` 同处一行并交叉校验、drift 即抛），逐面取值 `phase-spec` / `single-spec` = `consistency` · `overall` = `inventory` · `plan` = `buildability` · `wave` / `branch` = `standards`（语料三在每个判据面上都跑，故不是 spec 专用），语料二 / 语料三的 Steps 与 Acceptance 同步改写；F2 属 T5 的读面无行为变化，不改本计划的任务内容。本行随 fix 轮的 `capability: may.amend = content` 落地，`DependsOn` 集未动 | Oscaner M. · Claude（kairos:cdd-fix · 2026-11-16） |
| v0.13 | 2026-11-16 | docs-fix round 9（plan-review-9 · F1–F5 全受理）· 消费面由 spec `v0.9` 抬到 `v0.10`，本行记下随之继承的四处 delta 与各自的落点：§6.2 / §7.4 的 `test` 面已与本计划同名（`pins.guard.test.ts`）· §5.1 的「上一轮」读面为 `Ledger#recordsOf` + `Ledger#readHandoff` + `HandoffSchema.findingsOf` · §7.1 的路径形为 `path.ext[:line[-line]]`（裸路径同样是 pin，行号不得超过文件行数）· §1.3 的判据表五行普查。F1：T6 的 `test` 面改记该命名偏差已被 spec v0.10 采纳而闭合——v0.4 行里那处「对 spec 字面路径的有意改名」不再成立，两处旧字面名（T6 的那条 bullet 与 v0.4 行）一并撤下，语料里因此不再有指向已消失目标名的引用；T5 的 Steps 补上 §5.1 的读面点名；T6 的 Produces 补上 §7.1 的路径形。F2：T7 的残留比对把例外从子串判法改为点名从句判法——抹 token 之后再在两侧删掉清单里点名的那处引用从句，余量逐字相同即绿，落在从句之外即红；子串只认删除，会把规则 ① ② ④ ⑤ 加从句的 remedy 全部判红，Acceptance 同步，播种对改为「规则 ② 改写 ⇒ 绿 · 同一行在点名从句之外把三条改成两条 ⇒ 红」。F3：T7 的规则 ⑤ 只留去路径化一条路，删掉「扩产物词表」那条——词表由 P36 的产物矩阵拥有（`session/round-artifacts.ts` · `DEFAULT_DOMAINS` · `ArtifactRegistry.ownsName`），在判它的同一件事上挪判据，既不在本任务的 Files 内，也没有成对 pin 覆盖新条目。F4：T7 的首次扫描读数不再登记绝对条数（79 文件 · 2016 条是 v0.11 那一轮的读数，而语料每一轮 fix 都改写自己），只留 `symbol` 约八成 · `path` 约两成的量级与「重扫归零」这条判据。F5：T7 的验收命令逐条点名五条 doc 契约腿（`doc-corpus.guard.test.ts` · `dockey.guard.test.ts` · `phase-inventory.guard.test.ts` · `structure-pin.test.ts` · `change-history-header.test.ts`），不再写 `doc-contract` 这个 `contract/rules.ts` 里的门概念，也不写 `vitest run` 认不得的族名。本行随 fix 轮的 `capability: may.amend = content` 落地，`DependsOn` 集未动 | Oscaner M. · Claude（kairos:cdd-fix · 2026-11-16） |
