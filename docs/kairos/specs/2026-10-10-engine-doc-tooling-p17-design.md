---
title: 引擎文档工具（Engine Doc-Tooling）— P17 设计：文档类别面收口（doc-type `overall` · `overalls/` 第三 doc root · 评审读面 `INPUT_OVERALL`）· 承载面统一（D62）
doc-type: phase-spec
version: v0.5
date: 2026-10-21
slug: 2026-10-10-engine-doc-tooling-p17
program: 2026-10-10-engine-doc-tooling
status: Draft
author: "[human] · Claude Opus 5（kairos:cdd-design [P17] grilling → cdd-spec-writer · 2026-10-21）"
parent-version: v2.72
---

## Design

本 phase 治两处**类别面**的错位——不是加能力，是把既有的两处名实不符与一处读面缺链收正。命题一句话：**overall 是 program charter，不是 spec；类别名与目录要照它自己的身份说话，而 phase 的评审者要看得见它自己被注册进的那份 charter。**

一处来自**命名与目录**：overall 文档挂着 `-spec` 后缀、与其余三类 spec 挤在同一 `docs/kairos/specs/` 目录，而它自陈「Charter only, zero implementation detail」——名与实相反。一处来自**评审读面**：引擎自己已经判过「phase 是否注册在父 overall 的 Phase inventory」，但该判据只活在引擎里，评审 child 拿不到父 charter，无从判「这条 phase 是否越出注册 scope」。第三处是这次硬破**亲手制造**的：退役拼写 `overall-spec` 落到 preflight 上会误报「没写 doc-type」。

### 1. 现状与缺口（取证）

#### 1.1 类别名与目录的误称

- `docs/kairos/specs/2026-10-10-engine-doc-tooling-overall.md:13` 自陈 `Charter only, zero implementation detail`；:3 却声明 `doc-type: overall-spec`，与 phase-spec / single-spec 同一命名族。
- 引擎侧该拼写已渗透到**值 / 类型 / 注册表键 / 流水线键 / 判据**五层，共 **47 处 / 10 文件**：`contract/declare.ts:27`（`DocType` 联合）· `:109`（`DOC_TYPE_VALUES`）· `:178`（`OVERALL_SPEC_ELEMENTS`）· `:1060`（注册表键）· `contract/doc.ts:550`（`OverallDocType.docTypeName`）· `:802`（解析器表键）· `contract/project.ts:408`（投影记录键）· `contract/invariants.ts:131/266/291/465/586/763/1027/1144/1318/1418/1434`（11 处 `docKey === "overall-spec"` 判据与类型映射）· `infra/slug-index.ts:199/383` · `face/board-view.ts:254`（板型路由）· `face/words.ts:124`（缺 key 报文词）· `session/next.ts:80/98/107`（`PipelineKey` / `PIPELINE_NEXT` / `PhaseFaceKey` 的 `Exclude`）· `render/skeleton.ts:117/166` · `face/declare.ts:289`（schema 类型词表的注释面）。
- 目录侧：`docs/kairos/specs/` 是**同类混放**——18 篇里 1 篇是 charter、17 篇是 phase-spec；`ENGINE_DOC_ROOTS`（`infra/doc-roots.ts:17-29`）只声明两根 `specs` / `plans`。

#### 1.2 评审读面缺链

- 引擎**已经**判这条链：`contract/invariants.ts:1324` `overallChain` 判「dispatch phase 未注册在父 overall 的 Phase inventory」（`:1334` 的 finding 文案）；`:1305` 的 slug-ref 策略判 phase-spec 的 `program:` 是否指向一份在盘 overall。**但这是引擎的判据，不落到 child**。
- spec 评审的 round context 只有 `INPUT_SPEC`：`face/cli.ts:859-870`（spec 线只产 `target.doc`）· `face/lifecycle.ts:329-334`（`INPUT_SPEC` = spec 线的自身文档）· `render/templates.ts:231-247`（`REVIEW_CONTEXT` 的 token 清单，四类评审共享尾）。评审者手上没有父 charter 的锚，判不了「scope 是否越界」——而 `REVIEWS.spec.axesGuide`（`render/templates.ts:321`）的四条判据（URC · writing-plans self-check · 验证证据 · claimed→pin）里也确实没有这一项。

#### 1.3 退役拼写的报文误判

- `session/preflight.ts:218` 的 `doc.docKey === null` 把**两种情形同判**：① 文档没写 `doc-type:` 键；② 写了但值在域外。两者都走 `:223` 的 `routeWord("docType")`，报文是 `face/words.ts:124` 的 `the doc declares no \`doc-type:\` key — add \`doc-type: <overall-spec|phase-spec|single-spec|plan>\``。
- `docKey` 的来源是**域约束后的读值**：`face/cli.ts:543` `docKey: BoardView.readDocType(...)` → `face/board-view.ts:141-143` 的 `#docTypeOf` 把域外值收成 `null`。故硬破后，凡把 overall 留在 `doc-type: overall-spec` 的消费者，第一步撞上的是一条**说反了**的报文（文档明明声明了）。

### 2. 定案（D61）

#### 2.1 D61-1 doc-type `overall-spec` → `overall`（全拼写一次改到底）

一条类别名，引擎内**零残留**——值 · 类型联合 · 注册表键 · schema CLI 键 · 流水线键 · docKey 判据，一处不留（一事实一处）。四处 `valuePattern`（`contract/declare.ts:191/518/740/952`）由 `DOC_TYPE_VALUES` 插值派生，自动跟随，无需手改。

**随改清理（死名随行）**：`contract/declare.ts:178` `OVERALL_SPEC_ELEMENTS` → `OVERALL_ELEMENTS` · `render/skeleton.ts:166` `#renderOverallSpec` → `#renderOverall`——两处常量/方法名里的 `Spec` 随本次改名一并收正，不留「值改了、名还叫 Spec」的中间态。类名 `OverallDocType`（`contract/doc.ts:549`）**不改**：它本就只说 Overall，不含 `Spec` 字样。

**报文与注释面同扫**：退役拼写不止活在值/键面——`contract/invariants.ts:1291-1292` 的两处 finding 文案（`names no on-disk overall-spec document` → `overall`）与 `:1360` 的允许域列表（`its doc-type is overall-spec / phase-spec / single-spec` → `overall / phase-spec / single-spec`）是同类值/域误称，本 phase 一并收正。引擎源码里点名该类别的注释随值同更（`contract/declare.ts:4/16/176` · `face/declare.ts:289` · `face/board-view.ts:4/229` · `contract/invariants.ts:1346/1400` · `infra/slug-index.ts:170/196` · `render/skeleton.ts:162/165` · `session/next.ts:105`）——注释点名的是活类别名，不留旧拼写。零残留的扫描面因此是全部非测试行（含模板字面与注释），而非仅双引号字面（见 Acceptance）。

**快照面随键更替**：`contract/__tests__/__snapshots__/project.{schema,shape}.overall-spec.snap` 两档的文件名由 `DOC_KEYS` 插值（`contract/__tests__/project.test.ts:99/156`），新键下测试写出 `project.{schema,shape}.overall.snap`；旧两档**手工删除**（vitest 不清理孤儿快照）。四份 `project.schema.*.snap` 的 `"pattern": "^(overall-spec|plan|phase-spec|single-spec)$"` 行（各 `:15`）随 `DOC_TYPE_VALUES` 重生成。

**拒收**：`phase-spec` / `single-spec` 不改名（本次只动 overall 这一类，两型的 `-spec` 后缀是准确的）；不做别名/双读（见 2.3）。

#### 2.2 D61-2 `overalls` 成第三 doc root

`infra/doc-roots.ts:17-22` 的 `DocRoots` 接口与 `:26-29` 的 `ENGINE_DOC_ROOTS` 增 `overalls: "docs/kairos/overalls"`（放在 `specs` 之前——charter 在文档序上先于 spec）。三个读者自动跟随，零手改：

| 读者 | 跟随方式 |
|---|---|
| `contract/invariants.ts:1266` | `Object.values(ENGINE_DOC_ROOTS).map(...)` 的 sibling 扫描面自动含新根 |
| `contract/invariants.ts:44` | `DOC_ROOT_NAMESPACE = path.dirname(ENGINE_DOC_ROOTS.specs)` 仍为 `docs/kairos`（三根同命名空间） |
| `packages/kairos/tests/skill-surface-consistency.test.ts:103` | SKILL 路径字面合法集 `...Object.values(ENGINE_RUNTIME.docRoots)` **白得** `docs/kairos/overalls` |

**需手改三处**：`infra/slug-index.ts:121-123` 的 `insideDocRoots`——现显式列 `[docRoots.specs, docRoots.plans]` 两根（改读 `Object.values`，并把注释的「either doc root」改为「any doc root」）；`infra/slug-index.ts:159-160` 的 `build`——逐根显式枚举 `#scanRoot`（不自派生自 `ENGINE_DOC_ROOTS`），须增第三路 `#scanRoot(repoRoot, ENGINE_RUNTIME.docRoots.overalls, fs)`，漏改则 overalls 永不入索引、原子迁移静默失败；`packages/kairos/tests/grep-sweep-regression.test.ts:17` 的 `DOC_ROOT_EXCLUDE_PATHS` 补 `"overalls"`。

**派生文案的 deliberate pin break**：`contract/invariants.ts:49` 的 `DOC_ROOT_SEGMENTS`（`Object.values(...).map(path.basename).join("/")`）输出由 `specs/plans` 变 `overalls/specs/plans`——sibling-scan finding 文案随变，属本 phase 的既定 pin break，测试断言同步更替。

#### 2.3 D61-3 仓内迁移与消费面更替（硬破 · 无窗口）

**硬破、无双读窗口**（提前例：P10 front-matter 化 · P15 slug 身份化，两役均以 major 落地）。落地点：

- **仓内 overall 一份随迁**：`docs/kairos/specs/2026-10-10-engine-doc-tooling-overall.md` → `docs/kairos/overalls/2026-10-10-engine-doc-tooling-overall.md`，其 `doc-type:` 改 `overall`，其 `## File paths` 表首行改 `overalls/2026-10-10-engine-doc-tooling-overall.md`（该格的实际机判只有 `File path row` 的 `valuePattern`——反引号包裹的裸路径形，`contract/declare.ts:449-455`，`refKind: "none"`；link-shape 判据 `contract/invariants.ts:1076/1106` 只判 chain link，不触达此格。裸相对路径是文档约定，不是该判据的约束）。
- **文件名保留 `-overall.md`**：doc-type 已改叫 `overall`，后缀不再误称 spec；改名零语义收益，且 `*-overall.md` 的引用面由引擎测试夹具、冻结 spec/plan 正文与骨架占位示例构成——其中没有必须随文件改名的活面（判据是引用面的构成，不是其条数）。
- **消费面（shipped）全更替**：`packages/kairos/skills/{cdd-design,cdd-spec-writer,cdd-plan,cdd-report}/SKILL.md` · `packages/kairos/README.md` + `README.zh-CN.md` · `packages/cdd-engine/README.md:44` + `README.zh-CN.md:46`（镜像同步）· `CLAUDE.md:75`（Strategy B 的 `docs/kairos/specs/*.md` 句补 `overalls/`）。
- **不在编辑面**：`packages/kairos/tests/presentation-surface.test.ts` 无本 phase 的 SKILL 文本 pin——其唯一的 `overall-spec` 出现是 `OLD_KAIROS_SKILL_NAMES`（`:419-429`）里的 `writing-overall-spec`，属退役 skill 身份的封禁行，**冻结不改**；该文件只作验收必绿面，非编辑目标。
- **冻结历史不动**：过往 16 篇 phase-spec / 16 篇 plan 正文里的路径与拼写引用是 Strategy B 内部文档的历史面，零改（P15 的窄授权先例）。
- **`contract/invariants.ts:1076/1106` 的示例路径**更替为 `docs/kairos/overalls/…-overall.md`。

**原子性约束（判据面硬理由）**：拼写变更与 overall 迁移**必须同一次提交落地**。引擎一旦不再认 `overall-spec`，`SlugIndex.overallOf`（`infra/slug-index.ts:197-201`）对未迁移的 overall 读 `null`，则**仓内每一篇** phase-spec 的 `program:` slug-ref 判据（`contract/invariants.ts:1305`）当场转红、preflight doc-contract 全线 BLOCK——分两次提交会造出一个自伤的中间态。

#### 2.4 D61-4 `INPUT_OVERALL` 镜像 `INPUT_SPEC`

**规则一句话**：`INPUT_OVERALL` 与 `INPUT_SPEC` 同生共死——凡 round context 带 `INPUT_SPEC` 的腿，同带父 charter；无 `program:` 则空槽由装配器丢弃（`face/lifecycle.ts:283` 的「空值键被丢弃」既有语义，零新增机制）。零 per-type 特判。

| 落点 | 改法 |
|---|---|
| `render/templates.ts:437` 邻位 | `TOKENS` 增 `{ name: "INPUT_OVERALL", zone: "round-context" }` |
| `render/templates.ts:231-247` | `REVIEW_CONTEXT`（四类评审共享尾）在 `INPUT_SPEC` 行后增 `- \`INPUT_OVERALL\`: {{INPUT_OVERALL}}` |
| `render/templates.ts:267`（fix）· `:286`（docs-fix） | 两 mode 的 `roundContext` 同增该行（implement 面不带 `INPUT_SPEC`，故不带） |
| `face/lifecycle.ts:329-334` 邻位 | `#valuesOf` 增 `INPUT_OVERALL` 槽，供值条件与 `INPUT_SPEC` 逐条对齐（spec 线 = 自身 · plan/branch 线 = 同 slug 身份文档 · 其余空） |
| `face/lifecycle.ts:67-78`（`DispatchScene`）· `face/cli.ts:125-135`（`WorkScene`） | 两接口各增 `overallLink: string | null`（`WorkScene` 继承 `DispatchScene`，与 `specLink` 同位）——`#valuesOf` 读的是 `DispatchScene`，只改 `WorkScene` 则该值不可达 |
| `face/cli.ts:744-751`（`#dispatchOf`） | scene 组装处补 `overallLink: scene.overallLink`（`specLink` 同处的 hand-off） |
| `face/cli.ts:859-870` · `:892-893` | spec 线取 `index.entryAt(specRel)` 的 `program`，plan/branch 线取 `specEntry`（`:892` 已有）的 `program` → `index.overallOf(program)` → `root.relativize(entry.path)`；无 `program:` 或目标不在盘 → `null` |
| `render/templates.ts:224`（`REVIEW_ITEM`） | 枚举尾补半句，点名该 token 的存在条件（否则评审者分不清「空 = 无父 charter」与「空 = 不适用」） |

**RULE 文本（追加到 `REVIEW_ITEM` 现有枚举之后）**：

> and a face whose spec carries a `program:` also carries the parent charter at `INPUT_OVERALL`.

**边界**：`overallOf` 读的是**已扫索引**（`face/cli.ts:843` 的 `index` 已在手），零二次扫描、零新增 IO；`program:` 指向一份不在盘的 overall 时该 token 空置——那条链的错由既有的 slug-ref 判据（`contract/invariants.ts:1305`）报告，本 token 不新增第二个报告者（不重复报告同一事实）。

#### 2.5 D61-5 spec 轴 program conformance 判据句

**落点理由**：只补 token 而不给判据，等于交给评审者一个没人用的输入——P16 的判据面纪律同理（没写明判定动作的轴不会被判）。引擎已能机械判「注册与否」，child 要判的是它判不了的那半：**语义 scope 是否越出注册格**。

**文本（插入到 `REVIEWS.spec.axesGuide`，`render/templates.ts:321`——作为 `+` 链的末项，落在 claimed→pin 句之后、`The reviewed spec is a vision…` / severity 校准两句元说明之前）**：

> + program conformance — judge the phase against its parent overall at `INPUT_OVERALL` (the charter its `program:` names): the phase must sit inside the scope the overall's Phase inventory registered for it, and a phase that reaches beyond it is a completeness finding

**不新增 lens**：该判定落在既有的 `completeness` lens 下，`REVIEWS.spec.lensEnum` 保持 `completeness | consistency | clarity`，轴名零变化。

#### 2.6 D61-6 退役拼写报文拆分

`session/preflight.ts:218-226` 的单一分支拆两形，判据取已在手的 `head.docType`（`:202` 的 `FrontMatterExtractor.split(content).head`）：

- `head.docType === null`（真·缺键）→ 走原词 `routeWord("docType")`（`face/words.ts:124`），文案仅随值域更替为 `<overall|phase-spec|single-spec|plan>`；
- `head.docType` 非空但 `docKey === null`（值在域外）→ 走新词 `routeWord("docTypeValue")`，**点名该值 + 列出允许域**。

**新词文本（`face/words.ts` 的 `routeWords`）**：

> the doc declares `doc-type: {value}`, which is outside the declared domain — use one of {domain} and re-run

`{domain}` 由 `DOC_TYPE_VALUES`（`contract/declare.ts:109`）插值——单一事实源，不手写第二份词表（`face/words.ts` 已可读 contract 面，零新依赖）。

#### 2.7 版本与打包

- 模板契约 `TEMPLATE_PROMPT.$version` 14 → 15（`render/templates.ts:492` 的声明值；固定前缀文本变更即契约版本变更），并同步 `:473-491` 的版本叙事头注（补 v15 行：`INPUT_OVERALL` 读面 + spec 轴 program conformance 判据句）；
- changeset **cdd-engine major**（breaking：doc-type 值退役 + doc root 增改 + 模板契约版本）+ **kairos** 同步（SKILL 文本与 README 家族路径更替）；
- 不发布——changesets 收尾到可发布态即止。

### 3. 定案（D62）——承载面统一（用户裁定并入 · 2026-10-21）

**由来**：Task 3 闭合后，用户提出「review 的产物是 findings、implement / fix 的产物是 delivery，应该更合理」。追查代码后，真正的切分轴不是「评审 vs 干活」，而是**结论怎么来**与**有没有测试证据**；且 fix 载体的残余 findings 是只写不读的死数据。用户裁定把该收口**并入 P17**（原拟独立注册 P18），overall / phase-spec / plan 一起落。

**取证三条**（决定下面的形状）：

1. `session/next.ts:169-205` —— `case "fix"` 的判据只有软上限、`#blockerCount(ref)`、`readyBatch()`；`ref.status` 全程只在 `:171` 被 `FAILED_STATUS`（`{BLOCKED, TIMEOUT}`）读一次。`REVIEW_FIX` / `APPROVED` / `CHANGES_REQUESTED` 三种在 fix 轮**等价**。
2. `session/next.ts:190` 数的 `ref.findings`，在 fix 轮取自 **review** carrier（`ledger.ts:1104`）；fix carrier 的唯一读者是 `ledger.ts:1096`，只做一次 `conclusionOf`（`:1103`）——fix carrier 里的残余 findings **零消费**。
3. `face/lifecycle.ts:557` / `:798` 的证据门判据是 `face === "delivery"`——这是「文档修复不能走 delivery」的唯一硬理由，也是 `render/templates.ts:209` 让 docs-fix 去写一个**不存在**的 `status` 槽的根因。

#### 3.1 D62-1 一份声明，两条投影

现状：`CARRIER_DELIVERY`（`handoff-schema.ts:69-78`）与 `CARRIER_FINDINGS`（`:85-93`）是两张互斥表，`BY_FACE`（`:124-127`）选择，`HandoffSchemaFace`（`:33`）是二者的联合。

改为：单份 `CARRIER` 声明四槽 `status` / `findings` / `artifacts` / `notes`（**声明序即投影序**：`status` · `findings` · `artifacts` · `notes`），`#writable(plane)` 按平面投影出可写子集（properties ∩ 平面槽 + 平面 required）。**prompt fence · `violations` · `droppedKeys` 三处同读这一投影**——零第二份表。

#### 3.2 D62-2 平面由 op 派生，不声明

`CarrierPlane = "work" | "judge"`；`planeOf(op)`：`implement` / `fix` → `work`，`review` → `judge`。

`HandoffFamily.schema`（`infra/runtime.ts:51`）删除，`HANDOFF_FAMILIES`（`:81-121`）九行退化为纯命名真相 `{ name }`——与「类别名只在 `DOC_TYPE_VALUES` 声明」同构。

`ledger.handoffFaceOf(op, type)`（`ledger.ts:906-908`）→ `HandoffSchema.planeOf(op)`：**参数由二降一**——`type` 与平面无关（wave / branch / spec / plan 都不改变 work / judge 的归属）。

#### 3.3 D62-3 必填集与可写槽

| plane | required | writable |
| --- | --- | --- |
| work | `status` · `artifacts` | `status` · `artifacts` · `notes` |
| judge | `findings` | `findings` · `artifacts` · `notes` |

`status` 枚举仍 `APPROVED | BLOCKED`——work 轮不产生 `REVIEW_FIX` / `CHANGES_REQUESTED`，路由在 fix 轮本就不读它们（取证 1）。

#### 3.4 D62-4 结论派生

`conclusionOf(plane, carrier)`：judge → `rollup(findings)`（blocker → `CHANGES_REQUESTED` · 有 → `REVIEW_FIX` · 空 → `APPROVED`）；work → 声明的 `status`（缺 → `undefined`；越域 → `BLOCKED`）。语义与今日逐条一致。

#### 3.5 D62-5 文档修复获得 `status`（洞闭合）

`fix.spec` / `fix.plan` 现可写 `status`，`docs-fix` 前缀改报本轮结论；**残余 findings 的编码整条删除**。

今天 `templates.ts:209` 同时要求「残余 findings 推结论」与「draft 写失败 → `status: BLOCKED`」，而 `CARRIER_FINDINGS` 没有 `status` 槽（写了会被 `materialize` 当未声明键丢弃）——自相矛盾随本条消灭。

#### 3.6 D62-6 证据门按 scope 派生

`evidence = op ∈ {implement, fix} && type ∈ {wave, branch}`。删除 `lifecycle.ts:557` / `:798` 的 `face === "delivery"` 两处判据。

**行为零变**：wave / branch 轮有证据文件、spec / plan 轮无——与今日 family 表逐一对应。「代码域 / 文档域」由 family key（`op.type`）承载，**不新增声明位**。

#### 3.7 D62-7 死字段清理

`failure_category`：全仓唯一写入点是 `lifecycle.ts:721-722`（自我拷贝）与 `:727`（常量），**零消费者**。删除声明槽（`handoff-schema.ts:74`）、`CarrierValue` 条目（`:135`）、搬运代码与 `IMPLEMENT_SHELL`（`templates.ts:168`）的 `+ \`failure_category\`` 子句。BLOCKED 的理由已由 `notes` 承载（`reason` 入 `draftNotes`）。

#### 3.8 D62-8 文本与契约版本

修改 / 新增的固定前缀文本（逐字落盘，不得改写）：

- `IMPLEMENT_SHELL`（`templates.ts:168`）末段：`status` (APPROVED once applied, else BLOCKED + the reason in `notes`) and `artifacts`（该句其余字句不变）。
- `DOCS_FIX_SHELL`（`:209`）整句改为：

  > **docs-fix:** apply `INPUT_REVIEWS` (all severities) directly to the judged doc — `INPUT_PLAN` on a plan-doc line, `INPUT_SPEC` on a spec-doc line — removing fixed findings; record the path in `artifacts.doc` and report the round in `status` (APPROVED once every finding is applied, else BLOCKED + the reason in `notes`). Fix + write the draft at `OUTPUT_HANDOFF` per `## Handoff schema` in one process; retry = full re-run (idempotent).

- `DOCS_FIX_SHELL` 的 Draft fields 句（`:217`）收为与 work shell **同一句**：

  > **Draft fields:** every top-level field of the draft comes from the `## Handoff schema` declared `properties` — the declaration is the field source, zero extra keys.

- `TEMPLATE_PROMPT.$version`（`:492`）15 → 16，版本叙事头注（`:473-491`）补 v16 行（`handoff carrier 单平面（op 派生 work/judge）· docs-fix 拿到 status`）。
- **review 面前缀与 fence 字节不变**：judge 投影的槽集与顺序（`findings` · `artifacts` · `notes`）与今日 `CARRIER_FINDINGS` 一致。

#### 3.9 非目标

- 不合并 `implement` 与 `fix` 两个 op——CLI 动词是消费者接触面，合并只换来内部整齐。
- fix 轮的 `status` 仍自报，不从 evidence 派生（会把既有的 flaky 失败混同为本轮失败，另案）。
- severity / lens 枚举 / `DISPATCH` / `REFS` / CLI 旗标与退出码零改。
- 不做旧 carrier 的兼容读：`.kairos` 内的 in-flight 会话不跨版本续跑（硬破）。

### 4. 定案（D63）——波门静态批次守卫（hotfix · 2026-10-21）

**缺口**：`WaveGate.vet`（`session/wave.ts:70-113`）的 open wave 是**动态前沿** `graph.frontier(closedWaves())`，只读「未闭合且依赖全闭合」的任务。于是当一次 plan 修订把新任务放进一个**已部分闭合**的静态批次（`TaskGraph.batches()`，`session/graph.ts:252-267`）时，余下任务会被当成一个独立 wave 放行——本 phase 实测：Task 3 闭合后，Task 4 被 `implement --tasks 4` 单独派发而未被拦。

**为什么是缺陷**：静态批次由 `DependsOn` 派生，批次内任务共享一个提交纪律窗口（本 phase：Task 3「diff 只含 changeset 文件」与 Task 4「单原子提交」互斥）。开闭混合意味着该窗口已被拆散，而引擎的设计是波次**整体开闭**（wave-unitary：一行一轮，`ledger.closedWaves()` 按 wave 行判）。

**定案**：`vet` 在 exact 判定**之前**先判静态批次——`batches().find((b) => b.some((id) => requested.has(id)))`；若该批次同时含已闭合与未闭合任务，返回新的 `mixed-batch` BLOCK，不进入 phase 判定。`WaveGateReason` 增 `"mixed-batch"`。

**报文（`face/words.ts` 的 `CAPSULE_WORDS.waveGate.mixedBatch`，逐字）**：

> the derived batch ({batch}) mixes closed and open tasks ({closed} closed, {open} open) — a wave closes as a unit; re-declare the **DependsOn** edges so no task joins an already-executed batch

**边界**：未入批的任务（依赖幻影 / 环）不触发本判定（`batch === undefined`），仍走既有 `split` 面；整批开放照常放行；整批闭合本就不进 open wave。

**同一裁定里的 plan 形状修正**：Task 4 的 `DependsOn` 由 `1, 2` 改为 `1, 2, 3`——产生混合态的源头要一起消灭，守卫只负责不再复发。

### Acceptance criteria

- 引擎源码 `overall-spec` 零残留：`grep -rn "overall-spec" packages/cdd-engine/src-next --include='*.ts' | grep -v __tests__` 零命中——扫描面含模板字面与注释（注释随值同更，见 2.1）；命中面覆盖值 · `DocType` 联合 :27 · `DOC_TYPE_VALUES` :109 · 注册表键 :1060 · `docTypeName` doc.ts:550 · 解析器表键 :802 · 投影键 project.ts:408 · 11 处 docKey 判据 · slug-index :199/:383 · board-view :254 · words :124 · next.ts :80/:98/:107 · skeleton :117 · 允许域与 finding 文案 invariants.ts:1291-1292/:1360。
- 快照面随键更替：`grep -rn "overall-spec" packages/cdd-engine/src-next --include='*.snap'` 零命中；`contract/__tests__/__snapshots__/` 下无 `project.{schema,shape}.overall-spec.snap` 孤儿，旧档已删、`project.{schema,shape}.overall.snap` 已生成，`pnpm -C packages/cdd-engine test` 通过。
- `OVERALL_SPEC_ELEMENTS`（declare.ts:178）与 `#renderOverallSpec`（skeleton.ts:166）两处死名随行收正（`OVERALL_ELEMENTS` / `#renderOverall`），`grep -rn "OVERALL_SPEC_ELEMENTS\|renderOverallSpec" packages/cdd-engine/src-next` 零命中。
- `ENGINE_DOC_ROOTS.overalls === "docs/kairos/overalls"`；`SlugIndex.build` 扫描三根、`insideDocRoots` 认三根（pin 落 `infra/__tests__` 既有 doc-roots/索引用例旁）。
- `cdd schema get overall` 可用，`overall-spec` 落 `unknown schema type` 拒绝面（pin：`face/__tests__` 既有 schema 值域用例 + `SCHEMA_PRIMARY_KEYS` 派生自 `SCHEMA_TYPE_KEYS`，`face/projection.ts:41/234`）。
- 真实仓冒烟：`node packages/cdd-engine/src-next/bin.ts review --type spec --spec docs/kairos/overalls/2026-10-10-engine-doc-tooling-overall.md --dry-run` 与 `... board --spec docs/kairos/overalls/2026-10-10-engine-doc-tooling-overall.md` 均通过（前者四门纯读、后者渲染 program 板）——三根扫描 + `insideDocRoots` 的端到端证据。
- 四类评审 + fix / docs-fix 轮的 round context 均**声明** `INPUT_OVERALL` 槽；渲染行只在父 charter 解析得到时出现（空槽被装配器丢弃）——有 `program:` 的腿非空（spec 线 = 自身 chain）、无 `program:` 的腿不出现该行（pin：`render/__tests__/render.test.ts` 的 review-mode 用例 + `face/__tests__/cli.test.ts` 的 round-context token 集断言，同处扩 8-token → 9-token 面）。
- `REVIEWS.spec.axesGuide` 含 `program conformance` 与 `INPUT_OVERALL` 两 token，`REVIEWS.spec.lensEnum` 仍为 `completeness | consistency | clarity`（pin：`infra/__tests__/infra.test.ts` 的 P5 判据用例）。
- `REVIEW_ITEM` 含 `the parent charter at \`INPUT_OVERALL\``；四腿固定前缀均含（pin：`render/__tests__/render.test.ts` 四腿 `toContain`）。
- `TEMPLATE_PROMPT.$version === 15`（pin：`render/templates.ts:492` 的声明值）+ `:473-491` 版本叙事头注含 v15 行。
- 域外 doc-type 的 preflight 报文点名该值 + 列允许域；缺 key 仍走原词（pin：`face/__tests__/cli.test.ts` 与 `session/__tests__` 的 doc-contract gate 用例，两形各一断言）。
- 仓内 overall 迁至 `docs/kairos/overalls/` 且 `doc-type: overall`，其 `## File paths` 首行为裸相对路径 `overalls/…-overall.md`；`cdd review --type spec --spec <新路径> --dry-run` 通过（doc-contract 全绿）。
- 消费面路径字面全更替：`packages/kairos/tests/{presentation-surface,skill-surface-consistency,grep-sweep-regression}.test.ts` 全绿（`presentation-surface` 为必绿面，冻结不改；后两者为编辑面）；`grep -rn "overall-spec" packages/kairos/skills packages/kairos/README.md packages/kairos/README.zh-CN.md packages/cdd-engine/README.md packages/cdd-engine/README.zh-CN.md CLAUDE.md` 零命中（`CHANGELOG.md` 冻结历史不计）。
- 冻结面零破：findings 载体 schema / severity 枚举 / `REVIEWS.*.lensEnum` / 结论派生规则（blocker → CHANGES_REQUESTED · warn/nit → REVIEW_FIX · 空 → APPROVED）/ `DISPATCH.review.*` skill ref / CLI 旗标与退出码表 —— 全部零改。
- `pnpm run validate` ALL PASS（emit fresh · root 套件 · kairos 套件 · 引擎套件 · typecheck ×3 · version-sync · 零裸函数）。
- changeset cdd-engine **major** + kairos 在册，不发布。
- **承载面统一（D62）**：handoff carrier 只有一份声明——`grep -rn "CARRIER_DELIVERY\|CARRIER_FINDINGS\|BY_FACE\|HandoffSchemaFace" packages/cdd-engine/src-next` 零命中；`HandoffFamily` 只余 `name`（`grep -n "schema" packages/cdd-engine/src-next/infra/runtime.ts` 零命中）；`planeOf` 由 op 派生（`implement` / `fix` → work · `review` → judge；pin：`session/__tests__/handoff-schema.test.ts` 三值断言）。
- 文档修复 carrier 落 `status`、不再写残余 findings（pin：`face/__tests__/cli.test.ts` 的 docs-fix 轮 carrier 键集 + `conclusionOf("work", …)` 的缺省 / 越域两形）。
- 证据门行为不变：wave / branch 轮缺证据 → BLOCKED，spec / plan 轮无证据文件仍按声明 status 收口（pin：`face/__tests__/cli.test.ts` 既有 evidence 用例 + docs-fix 无证据新用例）。
- `failure_category` 零残留（`grep -rn "failure_category" packages/cdd-engine/src-next` 零命中，抽查面含模板与测试）。
- review 面 `## Handoff schema` fence 与 review 前缀**字节不变**（pin：既有 render / cli 用例不改即绿）。
- `TEMPLATE_PROMPT.$version === 16`（pin：`render/__tests__/render.test.ts`）。
- **波门静态批次守卫（D63）**：任一静态批次不得开闭混合——`vet` 返回 `mixed-batch` 且报文点名批次与两侧成员（pin：`session/__tests__/wave.test.ts` 两用例：混合批次 → BLOCK · 整批开放 → 放行）；`WaveGateReason` 含 `"mixed-batch"`；`WaveGateWords` 含 `mixedBatch` 行。

## Constraints

- **一事实一处**：类别名只在 `DOC_TYPE_VALUES` 声明一次（四处 `valuePattern`、schema 词表、报文域都由它派生）· doc root 只在 `ENGINE_DOC_ROOTS` 声明一次（`DOC_ROOT_NAMESPACE` / sibling 扫描 / SKILL 路径合法集自动派生，`build` / `insideDocRoots` 两处显式枚举）· `INPUT_OVERALL` 只在 `REVIEW_CONTEXT` / 两个 mode 的 round context 各一行，值源只经 `SlugIndex.overallOf` 一处。
- **原子落地**：2.3 的拼写 + 迁移同一次提交（自伤中间态见 2.3 的判据面硬理由）；四个缓存面（`src-next` 引擎源码 · 引擎测试 · kairos 测试 · 消费面文档）同批更替。D62 同理：载体形状 · 两份前缀文本 · `$version` 16 落**同一次提交**——`#writable` 一改，fence 与版本同一事实源。
- **散文节制**：新增固定前缀文本 = `REVIEW_ITEM` 半句 + `REVIEWS.spec.axesGuide` 一句 + 一条新报文词；D62 只**改写** implement / docs-fix 两条既有前缀（逐字见 3.8），不新增散文面。句子承载判定动作与事实，不写理由与方法论。
- **冻结面**：findings severity 枚举 · `lensEnum` · 结论派生规则（rollup 三段语义）· `face/host.ts`（`DISPATCH` / `REFS`）· CLI 旗标与退出码表 —— 零改；`session/handoff-schema.ts` 由 D62 收口（face 二分 → op 派生单平面），其 carrier 槽语义与结论派生语义不变。
- **硬破无窗口**：不做 `overall-spec` 别名读、不作废期告警、不留双根扫描。
- **零新依赖**；引擎调用一律本地 `node packages/cdd-engine/src-next/bin.ts`。
- 本计划为内部文档中文主源（Strategy B）；不发布，changeset 收尾到可发布态即止。

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-10-21 | 初稿——P17 承接用户 mandate 两项（doc-type `overall-spec` → `overall` + 目录 `specs/` → `overalls/`；phase spec review 补 `INPUT_OVERALL`）。定案六条：D61-1 全拼写一次改到底（含 `OVERALL_SPEC_ELEMENTS` / `#renderOverallSpec` 两处死名随行）· D61-2 `overalls` 第三 doc root（四读者派生 + 两处手改 + `DOC_ROOT_SEGMENTS` 文案 pin break）· D61-3 硬破迁移与消费面更替（含拼写+迁移的原子性硬理由）· D61-4 `INPUT_OVERALL` 镜像 `INPUT_SPEC` · D61-5 spec 轴 program conformance 判据句 · D61-6 退役拼写报文拆分；模板 `$version` 14 → 15；changeset cdd-engine major + kairos | Oscaner M. · Claude（kairos:cdd-spec-writer [P17]）|
| v0.2 | 2026-10-21 | **spec-fix-1（review-1 findings 收口 · 7 warn + 4 nit）**：① warn——§2.4 落表补 `DispatchScene`（`face/lifecycle.ts:67-78`）与 `#dispatchOf` hand-off（`face/cli.ts:744-751`），`WorkScene` pin 改 `:125-135`；② warn——§2.3 `File paths` 格改引 `contract/declare.ts:449-455`（`File path row` · `refKind: "none"`），link-shape 判据不触达该格、裸相对路径降为约定；③ warn——D61-1 纳入报文/注释面（`invariants.ts:1291-1292/:1360` + 引擎注释行），Acceptance 零残留 grep 放宽到全非测试行；④ warn——D61-3 消费面补 `packages/cdd-engine/README.zh-CN.md:46` 并进验收 grep；⑤ warn——快照面入 D61-1/Acceptance（两档 `*.overall-spec.snap` 改名并手工删旧、四份 schema snap 的 pattern 行重生成）；⑥ warn——`presentation-surface.test.ts` 移出编辑面（`OLD_KAIROS_SKILL_NAMES` 冻结），只作必绿面；⑦ warn——§2.2 `build` 由自动跟随表移入手改清单（「需手改三处」），漏改即静默失败；⑧ nit——§2.5 轴句写明插入点（`+` 链末项、两句元说明之前）；⑨ nit——两处 pin 校正（overall.md:13 · doc.ts:549）；⑩ nit——AC 的 `INPUT_OVERALL` 断言改为「声明槽 + 条件渲染」；⑪ nit——目录计数 18/1/17，删去「61 处」改记引用面构成 | Oscaner M. · Claude（kairos:cdd-spec-writer [P17] spec-fix-1）|
| v0.3 | 2026-10-21 | **范围扩并：承载面统一（D62 · 用户裁定 · cdd-dev 实施期并入）**。新增 §3 九条定案：D62-1 一份 `CARRIER` 声明 + `#writable(plane)` 唯一投影（删 `CARRIER_DELIVERY` / `CARRIER_FINDINGS` / `BY_FACE` / `HandoffSchemaFace`）· D62-2 `CarrierPlane = work \| judge` 由 op 派生，`HandoffFamily` 退化为 `{ name }`，`handoffFaceOf(op, type)` → `planeOf(op)` · D62-3 必填集 / 可写槽按平面 · D62-4 结论派生语义不变 · D62-5 文档修复获得 `status`（残余 findings 死路径删除、`templates.ts:209` 自相矛盾消灭）· D62-6 证据门按 scope（wave / branch）派生，行为零变 · D62-7 死字段 `failure_category` 删除 · D62-8 两份前缀逐字改写 + `$version` 15 → 16 · §3.9 非目标（不合并 op · status 仍自报 · 特效面零改 · 无兼容读）。取证三条钉在 `next.ts:169-205` / `ledger.ts:1096+1104` / `lifecycle.ts:557+798`。Acceptance 补六条、Constraints 的冻结面与原子落地随之修订。`parent-version` v2.70 → v2.71 | Oscaner M. · Claude（kairos:cdd-dev [P17] · 用户裁定并入 · I4 backfill）|
| v0.4 | 2026-10-21 | **hotfix 并入：波门静态批次守卫（D63 · 用户裁定）**。新增 §4：`WaveGate.vet` 的 open wave 是动态前沿 `frontier(closedWaves())`，当 plan 修订把新任务放进已部分闭合的静态批次（`TaskGraph.batches()`）时，余下任务会被当作独立 wave 放行（本 phase 实测：Task 3 闭合后 Task 4 被单独派发）。定案：`vet` 在 exact 判定前先判静态批次，开闭混合 → 新增 `mixed-batch` BLOCK（`WaveGateReason` + `WaveGateWords.mixedBatch` 词表行，报文逐字在 §4）；未入批任务不触发、整批开放放行。同一裁定把 Task 4 的 `DependsOn` 由 `1, 2` 改为 `1, 2, 3`（消灭混合态源头）。Acceptance 补两条。`parent-version` v2.71 → v2.72 | Oscaner M. · Claude（kairos:cdd-dev [P17] · 用户裁定 hotfix）|
| v0.5 | 2026-10-22 | **closeout（cdd-close）**：P17 全链闭合——三块定案（D61 类别面收口 · D62 承载面统一 · D63 波门守卫）全部落地并经评审：六任务六波全绿（W1 `115714b0` · W2 `bdd0c1c6` · W3 `6926baab` · W4 `e869714e` + wave-fix `9b8e7e72` · W5 `f07fcc04` · W6 `6e72cd86` + wave-fix `5e46c064`）· 分支终审 branch-review-1 REVIEW_FIX（1 nit：changeset 的 legacy-path 承诺超出引擎实际行为——`SlugIndex.build` 三根均匀扫描、身份只认 front-matter `doc-type:`）→ branch-fix-1 APPROVED（`1ebcf3f0`）· 本文档链：v0.1 `2ac4f246` → spec-fix-1 `8d6304ad`（v0.2）→ D62 并入 `d3434a1a`（v0.3）→ D63 并入 `f24a3cd7`（v0.4）· 验收 `pnpm run validate` exit 0（cdd-engine 44 files/815 tests · kairos 87/87 · root 10/10 · typecheck ×3 · emit fresh · version-sync）· changeset cdd-engine **major** + kairos **minor** pending · 不发布 | Oscaner M. · Claude（kairos:cdd-close · closeout-backfill）|
