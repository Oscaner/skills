---
title: 引擎文档工具（Engine Doc-Tooling）— P17 设计：文档类别面收口（doc-type `overall` · `overalls/` 第三 doc root · 评审读面 `INPUT_OVERALL`）
doc-type: phase-spec
version: v0.1
date: 2026-10-21
slug: 2026-10-10-engine-doc-tooling-p17
program: 2026-10-10-engine-doc-tooling
status: Draft
author: "[human] · Claude Opus 5（kairos:cdd-design [P17] grilling → cdd-spec-writer · 2026-10-21）"
parent-version: v2.70
---

## Design

本 phase 治两处**类别面**的错位——不是加能力，是把既有的两处名实不符与一处读面缺链收正。命题一句话：**overall 是 program charter，不是 spec；类别名与目录要照它自己的身份说话，而 phase 的评审者要看得见它自己被注册进的那份 charter。**

一处来自**命名与目录**：overall 文档挂着 `-spec` 后缀、与其余三类 spec 挤在同一 `docs/kairos/specs/` 目录，而它自陈「Charter only, zero implementation detail」——名与实相反。一处来自**评审读面**：引擎自己已经判过「phase 是否注册在父 overall 的 Phase inventory」，但该判据只活在引擎里，评审 child 拿不到父 charter，无从判「这条 phase 是否越出注册 scope」。第三处是这次硬破**亲手制造**的：退役拼写 `overall-spec` 落到 preflight 上会误报「没写 doc-type」。

### 1. 现状与缺口（取证）

#### 1.1 类别名与目录的误称

- `docs/kairos/specs/2026-10-10-engine-doc-tooling-overall.md:12` 自陈 `Charter only, zero implementation detail`；:3 却声明 `doc-type: overall-spec`，与 phase-spec / single-spec 同一命名族。
- 引擎侧该拼写已渗透到**值 / 类型 / 注册表键 / 流水线键 / 判据**五层，共 **47 处 / 10 文件**：`contract/declare.ts:27`（`DocType` 联合）· `:109`（`DOC_TYPE_VALUES`）· `:178`（`OVERALL_SPEC_ELEMENTS`）· `:1060`（注册表键）· `contract/doc.ts:550`（`OverallDocType.docTypeName`）· `:802`（解析器表键）· `contract/project.ts:408`（投影记录键）· `contract/invariants.ts:131/266/291/465/586/763/1027/1144/1318/1418/1434`（11 处 `docKey === "overall-spec"` 判据与类型映射）· `infra/slug-index.ts:199/383` · `face/board-view.ts:254`（板型路由）· `face/words.ts:124`（缺 key 报文词）· `session/next.ts:80/98/107`（`PipelineKey` / `PIPELINE_NEXT` / `PhaseFaceKey` 的 `Exclude`）· `render/skeleton.ts:117/166`。
- 目录侧：`docs/kairos/specs/` 是**同类混放**——17 篇里 1 篇是 charter、16 篇是 phase-spec；`ENGINE_DOC_ROOTS`（`infra/doc-roots.ts:17-29`）只声明两根 `specs` / `plans`。

#### 1.2 评审读面缺链

- 引擎**已经**判这条链：`contract/invariants.ts:1324` `overallChain` 判「dispatch phase 未注册在父 overall 的 Phase inventory」（`:1334` 的 finding 文案）；`:1305` 的 slug-ref 策略判 phase-spec 的 `program:` 是否指向一份在盘 overall。**但这是引擎的判据，不落到 child**。
- spec 评审的 round context 只有 `INPUT_SPEC`：`face/cli.ts:859-870`（spec 线只产 `target.doc`）· `face/lifecycle.ts:329-334`（`INPUT_SPEC` = spec 线的自身文档）· `render/templates.ts:231-247`（`REVIEW_CONTEXT` 的 token 清单，四类评审共享尾）。评审者手上没有父 charter 的锚，判不了「scope 是否越界」——而 `REVIEWS.spec.axesGuide`（`render/templates.ts:321`）的四条判据（URC · writing-plans self-check · 验证证据 · claimed→pin）里也确实没有这一项。

#### 1.3 退役拼写的报文误判

- `session/preflight.ts:218` 的 `doc.docKey === null` 把**两种情形同判**：① 文档没写 `doc-type:` 键；② 写了但值在域外。两者都走 `:223` 的 `routeWord("docType")`，报文是 `face/words.ts:124` 的 `the doc declares no \`doc-type:\` key — add \`doc-type: <overall-spec|phase-spec|single-spec|plan>\``。
- `docKey` 的来源是**域约束后的读值**：`face/cli.ts:543` `docKey: BoardView.readDocType(...)` → `face/board-view.ts:141-143` 的 `#docTypeOf` 把域外值收成 `null`。故硬破后，凡把 overall 留在 `doc-type: overall-spec` 的消费者，第一步撞上的是一条**说反了**的报文（文档明明声明了）。

### 2. 定案（D61）

#### 2.1 D61-1 doc-type `overall-spec` → `overall`（全拼写一次改到底）

一条类别名，引擎内**零残留**——值 · 类型联合 · 注册表键 · schema CLI 键 · 流水线键 · docKey 判据，一处不留（一事实一处）。四处 `valuePattern`（`contract/declare.ts:191/518/740/952`）由 `DOC_TYPE_VALUES` 插值派生，自动跟随，无需手改。

**随改清理（死名随行）**：`contract/declare.ts:178` `OVERALL_SPEC_ELEMENTS` → `OVERALL_ELEMENTS` · `render/skeleton.ts:166` `#renderOverallSpec` → `#renderOverall`——两处常量/方法名里的 `Spec` 随本次改名一并收正，不留「值改了、名还叫 Spec」的中间态。类名 `OverallDocType`（`contract/doc.ts:546`）**不改**：它本就只说 Overall，不含 `Spec` 字样。

**拒收**：`phase-spec` / `single-spec` 不改名（本次只动 overall 这一类，两型的 `-spec` 后缀是准确的）；不做别名/双读（见 2.3）。

#### 2.2 D61-2 `overalls` 成第三 doc root

`infra/doc-roots.ts:17-22` 的 `DocRoots` 接口与 `:26-29` 的 `ENGINE_DOC_ROOTS` 增 `overalls: "docs/kairos/overalls"`（放在 `specs` 之前——charter 在文档序上先于 spec）。四个读者自动跟随，零手改：

| 读者 | 跟随方式 |
|---|---|
| `infra/slug-index.ts:159-160` | `build` 增一路 `#scanRoot(repoRoot, ENGINE_RUNTIME.docRoots.overalls, fs)` |
| `contract/invariants.ts:1266` | `Object.values(ENGINE_DOC_ROOTS).map(...)` 的 sibling 扫描面自动含新根 |
| `contract/invariants.ts:44` | `DOC_ROOT_NAMESPACE = path.dirname(ENGINE_DOC_ROOTS.specs)` 仍为 `docs/kairos`（三根同命名空间） |
| `packages/kairos/tests/skill-surface-consistency.test.ts:103` | SKILL 路径字面合法集 `...Object.values(ENGINE_RUNTIME.docRoots)` **白得** `docs/kairos/overalls` |

**需手改两处**：`infra/slug-index.ts:121-123` 的 `insideDocRoots`——现显式列 `[docRoots.specs, docRoots.plans]` 两根（改读 `Object.values`，并把注释的「either doc root」改为「any doc root」）；`packages/kairos/tests/grep-sweep-regression.test.ts:17` 的 `DOC_ROOT_EXCLUDE_PATHS` 补 `"overalls"`。

**派生文案的 deliberate pin break**：`contract/invariants.ts:49` 的 `DOC_ROOT_SEGMENTS`（`Object.values(...).map(path.basename).join("/")`）输出由 `specs/plans` 变 `overalls/specs/plans`——sibling-scan finding 文案随变，属本 phase 的既定 pin break，测试断言同步更替。

#### 2.3 D61-3 仓内迁移与消费面更替（硬破 · 无窗口）

**硬破、无双读窗口**（提前例：P10 front-matter 化 · P15 slug 身份化，两役均以 major 落地）。落地点：

- **仓内 overall 一份随迁**：`docs/kairos/specs/2026-10-10-engine-doc-tooling-overall.md` → `docs/kairos/overalls/2026-10-10-engine-doc-tooling-overall.md`，其 `doc-type:` 改 `overall`，其 `## File paths` 表首行改 `overalls/2026-10-10-engine-doc-tooling-overall.md`（该格受 link-shape 判据约束——裸相对路径，非 markdown 链接，见 `contract/invariants.ts:1076/1106`）。
- **文件名保留 `-overall.md`**：doc-type 已改叫 `overall`，后缀不再误称 spec；改名零语义收益，而活文档引用面要牵 61 处 `*-overall.md` 字面（多为历史 spec/plan 正文与骨架占位示例）。
- **消费面（shipped）全更替**：`packages/kairos/skills/{cdd-design,cdd-spec-writer,cdd-plan,cdd-report}/SKILL.md` · `packages/kairos/README.md` + `README.zh-CN.md` · `packages/cdd-engine/README.md:44` · `CLAUDE.md:75`（Strategy B 的 `docs/kairos/specs/*.md` 句补 `overalls/`）· `packages/kairos/tests/presentation-surface.test.ts` 的 SKILL 文本 pin。
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
| `face/cli.ts:77`（`WorkScene` 邻位）· `:859-870` · `:892-893` | `WorkScene` 增 `overallLink: string | null`；spec 线取 `index.entryAt(specRel)` 的 `program`，plan/branch 线取 `specEntry`（`:892` 已有）的 `program` → `index.overallOf(program)` → `root.relativize(entry.path)`；无 `program:` 或目标不在盘 → `null` |
| `render/templates.ts:224`（`REVIEW_ITEM`） | 枚举尾补半句，点名该 token 的存在条件（否则评审者分不清「空 = 无父 charter」与「空 = 不适用」） |

**RULE 文本（追加到 `REVIEW_ITEM` 现有枚举之后）**：

> and a face whose spec carries a `program:` also carries the parent charter at `INPUT_OVERALL`.

**边界**：`overallOf` 读的是**已扫索引**（`face/cli.ts:843` 的 `index` 已在手），零二次扫描、零新增 IO；`program:` 指向一份不在盘的 overall 时该 token 空置——那条链的错由既有的 slug-ref 判据（`contract/invariants.ts:1305`）报告，本 token 不新增第二个报告者（不重复报告同一事实）。

#### 2.5 D61-5 spec 轴 program conformance 判据句

**落点理由**：只补 token 而不给判据，等于交给评审者一个没人用的输入——P16 的判据面纪律同理（没写明判定动作的轴不会被判）。引擎已能机械判「注册与否」，child 要判的是它判不了的那半：**语义 scope 是否越出注册格**。

**文本（追加到 `REVIEWS.spec.axesGuide`，`render/templates.ts:321`）**：

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

### Acceptance criteria

- 引擎源码 `overall-spec` 字面零残留：`grep -rn '"overall-spec"' packages/cdd-engine/src-next --include='*.ts' | grep -v __tests__` 零命中（值 · `DocType` 联合 :27 · `DOC_TYPE_VALUES` :109 · 注册表键 :1060 · `docTypeName` doc.ts:550 · 解析器表键 :802 · 投影键 project.ts:408 · 11 处 docKey 判据 · slug-index :199/:383 · board-view :254 · words :124 · next.ts :80/:98/:107 · skeleton :117）。
- `OVERALL_SPEC_ELEMENTS`（declare.ts:178）与 `#renderOverallSpec`（skeleton.ts:166）两处死名随行收正（`OVERALL_ELEMENTS` / `#renderOverall`），`grep -rn "OVERALL_SPEC_ELEMENTS\|renderOverallSpec" packages/cdd-engine/src-next` 零命中。
- `ENGINE_DOC_ROOTS.overalls === "docs/kairos/overalls"`；`SlugIndex.build` 扫描三根、`insideDocRoots` 认三根（pin 落 `infra/__tests__` 既有 doc-roots/索引用例旁）。
- `cdd schema get overall` 可用，`overall-spec` 落 `unknown schema type` 拒绝面（pin：`face/__tests__` 既有 schema 值域用例 + `SCHEMA_PRIMARY_KEYS` 派生自 `SCHEMA_TYPE_KEYS`，`face/projection.ts:41/234`）。
- 真实仓冒烟：`node packages/cdd-engine/src-next/bin.ts review --type spec --spec docs/kairos/overalls/2026-10-10-engine-doc-tooling-overall.md --dry-run` 与 `... board --spec docs/kairos/overalls/2026-10-10-engine-doc-tooling-overall.md` 均通过（前者四门纯读、后者渲染 program 板）——三根扫描 + `insideDocRoots` 的端到端证据。
- 四类评审 + fix / docs-fix 轮的 round context 均含 `INPUT_OVERALL` 行；有 `program:` 的腿非空（spec 线 = 自身 chain）、无 `program:` 的腿空槽丢弃（pin：`render/__tests__/render.test.ts` 的 review-mode 用例 + `face/__tests__/cli.test.ts` 的 round-context token 集断言，同处扩 8-token → 9-token 面）。
- `REVIEWS.spec.axesGuide` 含 `program conformance` 与 `INPUT_OVERALL` 两 token，`REVIEWS.spec.lensEnum` 仍为 `completeness | consistency | clarity`（pin：`infra/__tests__/infra.test.ts` 的 P5 判据用例）。
- `REVIEW_ITEM` 含 `the parent charter at \`INPUT_OVERALL\``；四腿固定前缀均含（pin：`render/__tests__/render.test.ts` 四腿 `toContain`）。
- `TEMPLATE_PROMPT.$version === 15`（pin：`render/templates.ts:492` 的声明值）+ `:473-491` 版本叙事头注含 v15 行。
- 域外 doc-type 的 preflight 报文点名该值 + 列允许域；缺 key 仍走原词（pin：`face/__tests__/cli.test.ts` 与 `session/__tests__` 的 doc-contract gate 用例，两形各一断言）。
- 仓内 overall 迁至 `docs/kairos/overalls/` 且 `doc-type: overall`，其 `## File paths` 首行为裸相对路径 `overalls/…-overall.md`；`cdd review --type spec --spec <新路径> --dry-run` 通过（doc-contract 全绿）。
- 消费面路径字面全更替：`packages/kairos/tests/{presentation-surface,skill-surface-consistency,grep-sweep-regression}.test.ts` 全绿；`grep -rn "overall-spec" packages/kairos/skills packages/kairos/README.md packages/kairos/README.zh-CN.md packages/cdd-engine/README.md CLAUDE.md` 零命中（`CHANGELOG.md` 冻结历史不计）。
- 冻结面零破：findings 载体 schema / severity 枚举 / `REVIEWS.*.lensEnum` / 结论派生规则（blocker → CHANGES_REQUESTED · warn/nit → REVIEW_FIX · 空 → APPROVED）/ `DISPATCH.review.*` skill ref / CLI 旗标与退出码表 —— 全部零改。
- `pnpm run validate` ALL PASS（emit fresh · root 套件 · kairos 套件 · 引擎套件 · typecheck ×3 · version-sync · 零裸函数）。
- changeset cdd-engine **major** + kairos 在册，不发布。

## Constraints

- **一事实一处**：类别名只在 `DOC_TYPE_VALUES` 声明一次（四处 `valuePattern`、schema 词表、报文域都由它派生）· doc root 只在 `ENGINE_DOC_ROOTS` 声明一次（四个读者派生）· `INPUT_OVERALL` 只在 `REVIEW_CONTEXT` / 两个 mode 的 round context 各一行，值源只经 `SlugIndex.overallOf` 一处。
- **原子落地**：2.3 的拼写 + 迁移同一次提交（自伤中间态见 2.3 的判据面硬理由）；四个缓存面（`src-next` 引擎源码 · 引擎测试 · kairos 测试 · 消费面文档）同批更替。
- **散文节制**：新增固定前缀文本 = `REVIEW_ITEM` 半句 + `REVIEWS.spec.axesGuide` 一句 + 一条新报文词；句子承载判定动作与事实，不写理由与方法论。
- **冻结面**：`session/handoff-schema.ts` · findings severity 枚举 · `lensEnum` · 结论派生规则 · `face/host.ts`（`DISPATCH` / `REFS`）· CLI 旗标与退出码表 —— 零改。
- **硬破无窗口**：不做 `overall-spec` 别名读、不作废期告警、不留双根扫描。
- **零新依赖**；引擎调用一律本地 `node packages/cdd-engine/src-next/bin.ts`。
- 本计划为内部文档中文主源（Strategy B）；不发布，changeset 收尾到可发布态即止。

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-10-21 | 初稿——P17 承接用户 mandate 两项（doc-type `overall-spec` → `overall` + 目录 `specs/` → `overalls/`；phase spec review 补 `INPUT_OVERALL`）。定案六条：D61-1 全拼写一次改到底（含 `OVERALL_SPEC_ELEMENTS` / `#renderOverallSpec` 两处死名随行）· D61-2 `overalls` 第三 doc root（四读者派生 + 两处手改 + `DOC_ROOT_SEGMENTS` 文案 pin break）· D61-3 硬破迁移与消费面更替（含拼写+迁移的原子性硬理由）· D61-4 `INPUT_OVERALL` 镜像 `INPUT_SPEC` · D61-5 spec 轴 program conformance 判据句 · D61-6 退役拼写报文拆分；模板 `$version` 14 → 15；changeset cdd-engine major + kairos | Oscaner M. · Claude（kairos:cdd-spec-writer [P17]）|