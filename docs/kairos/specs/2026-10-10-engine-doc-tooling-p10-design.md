# 引擎文档工具（Engine Doc-Tooling）— P10 设计：文档头部 front-matter 化 + 登记表驱动正文解析统一（Fork B）
- **Version**: v0.4 · 2026-10-17
- **Doc type**: phase-spec
- **Status**: Draft
- **Author**: Oscar M. · Claude Opus 5（kairos:cdd-design [P10] 会话 · 用户裁定 · 2026-10-17）
- **Parent program**: [引擎文档工具（Engine Doc-Tooling）Overall](2026-10-10-engine-doc-tooling-overall.md)
- **Depends on**: P9（Done · v0.7 · hard——P9 全链闭合后重开文档形态与解析模型统一 · overall 依赖图 D48）

## Design

本 phase 承接 P9 收口后的续 phase（2026-10-17 cdd-design [P10] 会话注册 D48）。**统一命题——一份 CDD 文档的真相是「head 是数据 · body 是结构」**：head（title / doc-type / version / date / status / author / spec / parent-program / depends-on / base）是一组**固定 schema 的标量字段**——它是*数据*；body（section / table / task block / design heading / dependency graph）是 *markdown 结构*。现行引擎把 head 当成「带 anchor 的 markdown 行」建模（`declare.ts` 登记表 anchor 是字面量 token，`project.ts` 编译成 `RegExp` 扫行），**把数据当结构解**——这正是本次要修正的根。

命题由两个入口汇聚：**其一**，头部形态脆弱且违 D26——四类文档的机器判定头部元组以 markdown bullet 行承载（`- **Version**: v2.44 · 2026-10-17` / `- **Status**: Draft` / `- **Author**: …` / `- **Doc type**: overall-spec` + plan 的 `**Spec:**` / `**Parent program**` / `**Depends on**` / `**Base**`），同一事实既编码为 markdown anchor 又编码为登记表 anchor，**两套模型**；且 P9/D42 已实测这类「裸 key + 冒号 + 散文」形态在 YAML/手工解析两头不讨好（`description: the engine's next: line` 致严格 YAML 解析炸）。**其二**，正文结构层同样存在「声明再抄」——`doc.ts` 用 ~5 个手写正则（`contract/doc.ts:382` `/^### Task (\d+):/` · `:407` `/^-\s+\*\*([A-Za-z ]+)\*\*:\s*(.*)$/` · `:425` `/^-\s+(.*)$/` · `:676` `/^### (\d+)\.\s+(.*)$/` · `:683` `/^#### (\d+)\.(\d+)\s+(.*)$/` + 表格 `split("|")`）**重新编码**了登记表已声明的 anchor 结构，同一结构知识存在两份。

由此 `size?` 判得 **oversized**（头部迁移 + 正文解析模型重写 + 登记表扩展 + 骨架渲染 + 全库 21 篇迁移 + 消费面 skill 同步 · 跨 contract/render/face 三面 + docs 平面）。用户裁定 **S1=c 不拆 phase** → 收敛为**单 phase-spec 承载，内部 wave 序列**（承 P5/D18⑩「不拆 phase ≠ 不拆 wave」先例）。

### 1. 目标与边界

#### 1.1 设计输入与授权

- **设计输入**：本会话问答全裁定（kairos:cdd-design [P10] · 用户逐题裁定——front-matter 字段集 = 机器判定头部元组 + Title · 正文结构层维持 markdown 但解析模型统一 · 解析器 `yaml` · 全量迁移 · 消费者自行迁移 · H1 删除 · 登记表接法 α · Fork B）· 已回填 overall D48。
- **重构授权**：用户六前提 mandate（1 允许破坏性变更（可重写代码、重组目录、不保守不打补丁）· 2 高维 OOP 抽象统一零裸函数 · 3 零技术债免散文堆砌免声明再抄 · 4 高内聚低耦合死码空壳清理 · 5 消费心智负担优先 · 6 最大重构整合最大精简）。
- **程序记录**：本 phase 无 out-of-band 热修面——全部裁定归 D48 主题内。

#### 1.2 判定基线（本 phase 的根前提 · 承 D26 法条）

本 phase 的唯一判准 = **一事实一处**（承 P7 D26 法条 · 判定时刻现读 · 副本永不具权威）在**文档形态与解析模型面**的落地。据此，本 phase 的违规面只两类：

| 类 | 义 | 本 phase 实例 |
|---|---|---|
| **数据当结构** | 固定 schema 的标量事实以结构文本（markdown 行）承载并由正则解 | 头部元组 bullet 行 + 头部 anchor RegExp |
| **声明再抄** | 一结构知识有 ≥2 份编码 | `doc.ts` 手写 anchor 正则 ↔ `declare.ts` 登记表 anchor |

收口后的形态唯一：**结构化元数据（front-matter）→ 标准解析器；markdown 正文骨架 → 登记表驱动扫描**——两条线各归其位，零重叠。

#### 1.3 保留面（冻结）

- **判定语义不变**：`invariants.ts` 的判压逻辑（version-lineage · phase-registered · change-history 版本血缘 · cross-doc chain 等）逐条不变——本 phase 只换**事实的承载形态与提取通道**，不改判定规则。此冻结**对头部版本事实的读取通道同样成立**：现行三处把 `**Version**` 当**裸 markdown 行**读（不经任何 DocType 解析器）——`invariants.ts:944` `#headerVersion`（`anchorLines(ctx,"**Version**")`）· `invariants.ts:1236-1247` `#parentLineage`（扫 `(parent as OverallParsed).headerLines` 找 `line.includes("**Version**")`）· `face/gate.ts:161-169` `#docVersionOf`（`line.trimStart().startsWith("- **Version**:")`）。头部迁 front-matter 后这些 bullet 行消失，三处各自返回空 → `SelfBoundedInvariant.evaluate` 在 `headerVersion === null` 早退（`:894`）· `classB` 在 `parentTokens.length === 0` 早退（`:1216`）→ **判压静默自禁（假绿）**。故本 phase 必须把这三处**显式列为改点**并给定 front-matter 替换通道（见 §2.2 / §4.1 / §6 的回归 pin），否则违本冻结。**Class-B 版本 token 血缘判（`classB`）的输入面同属此冻结**：今日 token 从 `**Parent program**` 行刮取（`contract/doc.ts:624` / `:701`），头部标量化后 token 无家 → `parentTokens` 恒空 → 同一 `:1216` 早退。故本 phase 为其设专用承载位 `parent-version:` 标量（§2.1）并把 `doc.ts:624/:701` 的读点重指到它；`classB` 的判定规则（token 须属于 parent overall 血缘）与早退语义零变化。
- **`next:` 字面冻结**：不改 `next:` 行的可执行字面（动作/旗标拼写/后缀/结构 · 承 P5/P9 先例）。
- **退出码表 0/1/2 · CDD_BLOCKED 通道 · 领域 run 语义**不变。
- **D29 黑盒边界守约**：skill 文本零引擎内部实现镜像；对消费面只**同步头部形态表述**，不注入解析实现细节。
- **不发布**：changesets 收尾至可发布态即止（与 P1–P9 一致）。

### 2. A 组 · 头部元组迁 front-matter

#### 2.1 front-matter 形态（唯一规范）

四类文档的机器判定头部元组统一迁至文件顶部 YAML front-matter（`---` 包裹）：

```yaml
---
title: 引擎文档工具（Engine Doc-Tooling）— Overall Spec
doc-type: overall-spec
version: v2.46
date: 2026-10-17
status: Draft
author: "[human] · Claude Opus 5（…）"
---
```

plan 追加五字段（phase-spec 同为 Class-B 载体，追加其中的 `parent-program` · `parent-version` · `depends-on`）：

```yaml
---
title: …
doc-type: plan
version: v0.9
date: 2026-10-17
spec: docs/kairos/specs/2026-10-10-engine-doc-tooling-p10-design.md
parent-program: docs/kairos/specs/2026-10-10-engine-doc-tooling-overall.md
parent-version: v2.46
depends-on: P9
---
```

- **示例中的引号是 `yaml.stringify` 的产出形态，不是手写模板**：`author` 以 `[` 起首故被引擎引号化，其余值裸标量。任何写侧（迁移脚本 · 骨架装配器）**一律经 `yaml.stringify` 发射**，禁止字符串拼接（细则与验收见 §5.1「发射规则」）。

- **字段全集**：`title` · `doc-type` · `version` · `date` · `status` · `author`（四型按需出现）；plan 追加 `spec` · `parent-program` · `parent-version` · `depends-on` · `base`。
- **`version` 与 `date` 拆两字段**（原 `v2.44 · 2026-10-17` 一字符串）——版本血缘判定只需 `v2.44`，date 独立更可比。
- **`spec` / `parent-program` 只存标量，且标量值是 `target` 路径**（非 label）——今日 `**Spec:**` / `**Parent program**` 行是 `[label](target)` 双事实：链存在性判（`specLink === null` / `parentLink === null` → finding）与 Class-A/B label==basename 漂移判各自读它。标量化后**保留 target、退休 label**：
  - 值形态 = `target` 路径（与 `spec:` 同形 · 含 `docs/kairos/…` 相对路径）。三条链判的读点原样成立、零改动：`FileExistenceInvariant` 的 `link.target` 解析（`contract/invariants.ts:987` → `targetPath`）· `SiblingScanInvariant` 的 `path.basename(link.target)`（`:1088`）· `classB` 的 `ctx.chainDocs?.get(parentLink.target)`（`:1217`）。
  - **退休两处标签漂移判**：`invariants.ts:1166`（Class-A `specLink.label.trim() !== path.basename(specLink.target)`）与 `lint.ts#crossDocDriftWarns`（`:234-242` Class-B label↔basename 漂移 WARN）——`ChainLink`（`contract/doc.ts:98-103`）的 `label` 字段随标量化整字段退休，无可漂移的独立事实 → 两判一并退休，登记进 §4.1 删除集并附 grep pin。
  - **不派生 display label**：本 phase 不新建 label 派生通道；需要显示名时由消费点就地取 `path.basename(target)`，不落盘、不成字段（零新增派生链路）。
- **`parent-version:` = Class-B 版本 token 的专用承载位**：今日 token 从 `**Parent program**` 行刮（`contract/doc.ts:624` / `:701` 的 `parentTokens: … this.versionTokens(parentLine)`），头部标量化后该行消失。本 phase 新增 `parent-version:` 标量（plan / phase-spec 的 front-matter），`chainRoot` 的 `parentTokens` 改由它取值（单值即单元素数组）；`classB`（`contract/invariants.ts:1210-1233`）判定规则与 `:1216` 早退语义零变化。磁盘现状（迁移集实测）：19 条 `**Parent program**` 行中 4 条携带 token（`p1-design` v1.9 · `p2-design` v1.1 · `p1` plan v1.5 · `p2` plan v1.1），迁移脚本把它们搬进 `parent-version:`（无 token 的 15 条不产出该键）。
- **留在正文**：`**Constraints**` 多行散文（见 §2.4）、single-spec 的 `Issues` 散文行（见 §2.3）、以及全部正文结构层。

#### 2.2 解析通道 = `yaml` 引擎 + 薄 fence 切分（选型裁定）

- **选型**：`yaml`（npm）——周下载 242M · 活跃（2026-09 · 维护者 Eemeli Aro）· **零传递依赖** · **本仓已在用**（`scripts/emit.ts` 的 `stringify` · `packages/kairos/tests/skill-anatomy.test.ts` 的 `parse`——即 P9 立的 frontmatter-YAML 合法性门）。**因选它而非 `gray-matter`**：gray-matter / front-matter 停更 3 年（2023-07）+ 拖 `js-yaml@^3` 旧 major；`@11ty/gray-matter` 系维护 fork 但小众（0.8M/周）；`vfile-matter` 引 `vfile` 重依赖。全仓单一 YAML 引擎 = D26「一事实一处」的直接推论。
- **形态**：`---` fence 切分（文件开头 `---` 到下一 `---`）是 ~10 行代码，格式标准稳定，无需 front-matter 专用库。
- **依赖面**：`yaml` 由仓库 devDep 升为 **cdd-engine 运行时依赖**（P3 commander ^15 先例 · 记一笔）。
- **提取器落点**：`FrontMatterExtractor`（值对象类 · 零裸函数）——fence 切分 + `yaml.parse` + typed accessor，产出 typed head record（含 `version` lineage 所需的版本 token）。
- **提取器读 RAW 内容，不经 canonicalize 视图**：front-matter 是**数据，不是结构**。今日 `contract/judge.ts:94-96` 把 `Translator.canonicalize` 逐行作用于 `input.content` 再把该视图同时交给 `parse` 与 `JudgeContext.lines`；若提取器吃同一视图，头部值里任何已登记的中文别名都会被静默改写（实测：`title: … TaskGraph 分组派生 …` → `… TaskGraph 分group派生 …`，别名表在 `face/words.ts`），而**源文件未变**，任何字节 pin 都抓不到。故 `Contract.validate` 的切分顺序定为：**先**对 `input.content` 原串做 `FrontMatterExtractor` 提取（fence 内原文喂 `yaml.parse`），**再**把 fence 之后的正文行过 `canonicalize` 得 `JudgeContext.lines`。head 值判（§2.2 判定通道条）读 RAW 提取结果，正文结构判读 canonicalized 视图——两条线各守其原文。回归 pin：head 值含已登记别名时 `Contract.validate` 提取结果与源串逐字相同，同时正文仍走 canonicalize（同一用例断言两侧）。
- **头部版本读点重指（判定语义不变 · 见 §1.3）**：三处现行「裸行」版本读点全部改走 front-matter typed accessor，判定规则零改动：
  - `invariants.ts:944` `#headerVersion`：由 `anchorLines(ctx,"**Version**")` 改为读 typed head record 的 `version` 标量（经 `FrontMatterExtractor`），返回值即 `v<major>.<minor>` token；
  - `invariants.ts:1236-1247` `#parentLineage`：由扫 `(parent as OverallParsed).headerLines` 改为读 **parent overall 的 front-matter `version` 标量** 加入 lineage（Change-history 行版本照旧）；
  - `face/gate.ts:161-169` `#docVersionOf`：由 `line.trimStart().startsWith("- **Version**:")` 改为解析 front-matter block 的 `version` 标量，产出同一 `v<major>.<minor>` token。
  三处 `versionTokens`/`versionTokensOf` 的 token 语法是共享单一源（`contract/doc.ts`），仅**入口事实**由「裸行」换为「front-matter 标量」，不对判定值形状作任何放宽。
- **Class-B token 读点重指**：`contract/doc.ts:624`（`PlanDocType.chainRoot`）与 `:701`（`PhaseSpecDocType.chainRoot`）的 `parentTokens: parentLine === null ? [] : this.versionTokens(parentLine)` 改读 front-matter 的 `parent-version` 标量（`parentTokens = head.parentVersion === null ? [] : [head.parentVersion]`）——`**Parent program**` 行消失后 token 的唯一来源（§2.1）。token 语法仍走同一 `versionTokens` 单源，判定值形状零放宽。
- **判定通道（front-matter-home 元素不经行扫）**：`home: "frontmatter"` 元素的存在判与值判**一律读 `FrontMatterExtractor` 的 typed head record**，不得走 `ctx.lines` 行扫——`invariants.ts:167-188` 的 `lineCarries` / `occurrenceLines` / `carrierLines` 三原语仅服务结构型 home（section / facet / table / task-* / graph / design-body）。理由：header anchor 变为 YAML key（`version` · `status` · `title`）后，行扫会把正文任意提及 "version" 的散文行当作 carrier——presence 被真空满足（假绿），且该散文行随后被当作 Domain carrier 撞 `^v\d+\.\d+$`（全库假红）。故 `PresenceInvariant`（`:276-292`）· `DomainInvariant`（`:450-467`）· `#headerVersion`（`:944`）在 front-matter-home 元素上改走 typed record。

#### 2.3 登记表外头部事实收编

- **`doc-type`**：今天不在 `declare.ts` 登记表，声明由 `face/board-view.ts#docTypeOf`（`:655`，经 `#headerLinesOf` `:641` 扫 `- **Doc type**:` 行）解析。**读点全清单**（收编后须全部重指到登记表的 front-matter `doc-type` 元素）：`board-view.ts:194` `readDocType`（其非测试调用者 `face/capsule.ts:147` · `face/cli.ts:474` 的 plan dispatch），以及 `session/preflight.ts` 的 doc-contract 门——**preflight 自身不扫行**：它消费 `face/cli.ts:474`（`BoardView.readDocType`）交给它的 `doc.docKey`（`preflight.ts:64-69` 只是该字段的 doc comment · `:186-211` 是消费点），故重指落在 **reader（`#docTypeOf`）**，preflight 零改。**board 的头部三元读点同列在册**：`face/board-view.ts:176-183` `readHeader` 读 `**Status**` / `**Version**` / doc-type 三条头部行，其返回值经 `#docLine`（`:567-577`，调用点 `:576`）喂 board 的 version/status/docType 列（`face/__tests__/board-view.test.ts:165-250` pin）——一并重指到同一 typed head record，`BoardNodeHeader` 形状（`{version, status, docType}`）不变，渲染面零改。收编进登记表（`home: "frontmatter"`），**唯一读通道** = 登记表 `doc-type` 元素的 front-matter 标量（`FrontMatterExtractor`），消灭「无门声明事实」。
- **single-spec `Issues`**：今天为自由散文行（不在登记表）。收编进登记表，**key 名 = `issues`**（front-matter 标量），`presence: "optional"`，`valuePattern` = 非空标量（不改写散文内容，仅换承载形态）；登记 anchor 由「`Issues（收口时关闭）` 头部 bullet」改为 `issues` 键名。**迁移集实测：该行今日 0 条**（唯一的 historical single-spec 已随四族清理删除 · `git show dd5bed94^` 可见原形）——即本 phase 的脚本改写分支必须存在但当前 corpus 命中为 0，AC 不作非零计数卡口，改由单元用例（构造一条旧形 `Issues` 头行 → 迁移后落 `issues:` 键）钉住。
- **收编键全集（本 phase 登记表新增/改名的头部事实 · 逐条给 presence 与值形状）**：

  | key | 归属文档型 | presence | valuePattern（YAML 标量形态） | 来源 |
  |---|---|---|---|---|
  | `title` | 四型 | required | 非空标量 | 原 `# Title` 行 |
  | `doc-type` | 四型 | **required** | 原 `DOC_TYPE_VALUES` 元组 | 原头部 bullet（§2.3 首条） |
  | `version` | 四型 | required | `^v\d+\.\d+$` | 原 `**Version**` 行（拆出 date） |
  | `date` | 四型 | **required** | `^\d{4}-\d{2}-\d{2}$` | 原 `**Version**` 行的日期半 |
  | `status` | 四型 | required | 原枚举元组（按型） | 原 `**Status**` 行 |
  | `author` | 四型 | required | 非空标量 | 原 `**Author**` 行 |
  | `spec` | plan | required | 非空标量（target 路径） | 原 `**Spec:**` 行 |
  | `parent-program` | plan · phase-spec | required | 非空标量（target 路径） | 原 `**Parent program**` 行 |
  | `parent-version` | plan · phase-spec | optional | `^v\d+\.\d+$` | 原 `**Parent program**` 行的 token（§2.1） |
  | `depends-on` | plan · phase-spec · single-spec | 按今日（plan optional · phase-spec required · single-spec required） | 非空标量 | 原 `**Depends on**` 行 |
  | `base` | plan | optional | 非空标量 | 原 `**Base**` 行 |
  | `issues` | single-spec | optional | 非空标量 | 原 `Issues（收口时关闭）` 行 |

  其中 `date` · `doc-type` · `parent-version` · `issues` 是 §2.1/§2.3 首次成为机器事实的四项；`presence` 逐项如上表（`doc-type` 定为 **required**——它是引擎自身 doc-class 判别的事实，optional 会让「无声明」与「未填」不可分）。
- **元素数带上限**：`overall-spec` 今日 39 元素（`declare.ts:171-460`），`contract/__tests__/declare.test.ts:54-95` 的 `MAX_ELEMENTS = 40` 是既有守卫。本 phase 的净变化 = `+date` `+doc-type`（overall 侧）`−**Constraints**` 头部行（§2.4 退休它、换 `## Constraints` section 行，net 0）= **41 → 越上限 1**。故本 phase 同批把 `MAX_ELEMENTS` 由 40 上调至 **44**（四条新增头部事实 `date`/`doc-type`/`parent-version`/`issues` 的最大落点余量），理由记入该常量注释：头部 schema 字段化后 overall 的声明面自然增长，band 上限是「声明面规模守卫」而非精确值，上调不放松 MIN 侧。`single-spec` 仍走 lightweight 豁免（其元素数仍 < 20）。
- 收编后头部元组事实**全部在册**（登记表 = 唯一声明根 · D26 成立）。

#### 2.4 Constraints 归一

`**Constraints**` 今天仅在 **overall** 是头部 bullet；plan / phase-spec / single-spec 均已是 `## Constraints` 正文 section。**统一为正文 section**——head 不含 Constraints。一致性修正（六前提③④）。

归一必须同时覆盖**登记表**与**骨架渲染**两侧，否则 overall 的骨架会漏吐自己声明为 required 的 section：

- **登记表**：`declare.ts:202-207` 的 overall `**Constraints**` 头部行退休；overall registry 新增 `anchor: "## Constraints"` 行（`presence: "required"` · `valuePattern: "^## Constraints$"` · `home: "section"`），位置按今日 plan/phase-spec/single-spec 的同类行（`declare.ts:511` / `:774` / `:940`）——**插在 `## Boundary rules` / `## Maintenance` 之间**（overall 今日声明序的 `:252` 与 `:259` 之间）。
- **骨架渲染**：`#renderOverallSpec`（`render/skeleton.ts:154-166`）今日合成的是 Document scope / File paths / Program charter / Issue inventory / Phase inventory / Dependency graph / Boundary rules / Maintenance / Change history——**无 Constraints**（plan `:178` / phase-spec `:222` / single-spec `:245` 都有）。本 phase 同一处补一个 `this.#section("## Constraints", ["- :::fill constraint"], probe, "Constraint delta bullet")`，位置与登记表插入点一致。缺这一步，`#assertConsumed`（`skeleton.ts:130-144`）会抛「composition omits the registered required slot」——骨架自检即失败。
- **语料侧**：迁移脚本把 overall 的 `- **Constraints**:` 及其缩进续行块整体搬为 `## Constraints` 的正文 bullet，**落位 = `## Boundary rules` 与 `## Maintenance` 之间**（与登记表插入点、骨架合成序三处同序——`OrderInvariant` 判 section 声明序，落错位即 order finding）。续行搬移规则见 §5.1「元组键续行」。

### 3. B 组 · 正文解析模型统一（Fork B）

#### 3.1 单结构知识源 = 登记的 `home` 轴

今天引擎有两套结构知识：`declare.ts` 登记表声明「有哪些 anchor + home」，而 `doc.ts` 用 ~5 个正则**重新编码**了同一批 anchor 的结构形态（「声明再抄」）。统一后，结构知识只留在**一处**——登记的 `home` 轴。

`home` 取值：`header`（迁 frontmatter 后为 `frontmatter`）· `section` · `facet` · `table` · `graph` · `task-block` · `task-field` · `task-step` · `design-body` · `conditional`。

**`header` → `frontmatter` 为改名（retire 旧值，非并存）**：`header` 是活 union 成员（`declare.ts:42-52` `Home` union · `HOME_VALUES` `:100-111`）且有 23 处 `home: "header"` 用例，并被 presence 不变量的 `PRESENCE_HOMES` 集（`invariants.ts:263-273`）引用。本 phase 统一：`Home` union 与 `HOME_VALUES` 中 `"header"` **改名为 `"frontmatter"`**，23 处用例随之改，`PRESENCE_HOMES` 同步把 `"header"` 换为 `"frontmatter"`——不留 `header` 并存值（并存即「两套头部模型」· 违 §1.2 与 D26）。

#### 3.2 home 驱动的泛型提取器（一族一方法）

每个 home 对应**一个泛型提取器类**，它读登记表里该 home 的 anchor 集合，而**不硬编码字面量**：

- `home: "frontmatter"` → `FrontMatterExtractor`（§2.2）。
- `section` / `facet` → 标题扫描器（heading rank 由 anchor 的 `#` 数派生）。
- `task-block` / `task-field` / `task-step` → 任务提取器（「`### Task N:` 是块头、其体是 `- **Key**:` 字段」这条规则**只有一份**，泛型化，不再逐 anchor 写正则）。
- `table` → 表格提取器（列头 + 数据行 · anchor 声明列语义）。
- `graph` → 边线提取器（`P1 -> P2` 形态）。
- `design-body` → 编号标题提取器（`### N.` / `#### N.M`）。

**关键**：每个 home 的**结构规则是固定代码**（一个方法），**哪些 anchor 属于该 home 来自登记表**。于是登记表仍是唯一声明根（D26 成立），`doc.ts` 的手写 anchor 正则**整类死亡**。

#### 3.3 登记表接法（α）

头部元素登记为 `home: "frontmatter"`，其 anchor 即 **front-matter key 名**（`title` / `doc-type` / …）；`project.ts` 的 slices 投影对 `frontmatter`-home 元素改用「YAML key 查表」而非 RegExp 编译。正文元素照旧走 home 提取器（§3.2）。**登记表仍是唯一真源**（合 D26）——非「头部单抽一套 schema」（β · 两套模型 · 违六前提+ D26）。

**anchor token 改名表（23 行 header-home 元素的逐行归宿 · 本 phase 必须显式落的登记表编辑，不是「把 `home` 翻成 `frontmatter`」的副作用）**：今日 23 行 header-home 元素的 anchor **全是 bullet/heading 字面量，没有一行是 YAML key**，故 `anchor == key` 必须靠逐行改名成立。改名后 `schema` 的 `properties`/`required` 键、`tokens` 的 carry 字面量、`skeletonSlotOf` 的分类键、`slices` 的查表键**四处同时变成 key 形态**——只翻 `home` 不翻 anchor 会留下「文档写 `version:`、登记表找 `**Version**`」的全库假红。

| 文档型 | 今日 anchor（`declare.ts` 行） | 改名为 | 备注 |
|---|---|---|---|
| overall | `# Title`（`:174`） | `title` | |
| overall | `**Version**`（`:181`） | `version` | 日期半拆出独立 `date` 行（§2.1） |
| overall | `**Status**`（`:188`） | `status` | |
| overall | `**Author**`（`:195`） | `author` | |
| overall | `**Constraints**`（`:202`） | — | **退休**：转 `## Constraints` section 行（§2.4） |
| plan | `# Title`（`:468`） | `title` | |
| plan | `**Spec:**`（`:475`） | `spec` | |
| plan | `**Parent program**`（`:482`） | `parent-program` | token 另落 `parent-version`（§2.1） |
| plan | `**Version**`（`:489`） | `version` | |
| plan | `**Depends on**`（`:496`） | `depends-on` | 保留 `refKind: "phase-id"` |
| plan | `**Base**`（`:503`） | `base` | |
| phase-spec | `# Title`（`:688`） | `title` | |
| phase-spec | `**Version**`（`:695`） | `version` | |
| phase-spec | `**Status**`（`:702`） | `status` | |
| phase-spec | `**Author**`（`:709`） | `author` | |
| phase-spec | `**Parent program**`（`:716`） | `parent-program` | |
| phase-spec | `**Depends on**`（`:723`） | `depends-on` | |
| phase-spec | `Depends on ref`（`:730-735`） | — | **退休**：见下条 |
| single-spec | `# Title`（`:883`） | `title` | |
| single-spec | `**Version**`（`:890`） | `version` | |
| single-spec | `**Status**`（`:897`） | `status` | |
| single-spec | `**Author**`（`:904`） | `author` | |
| single-spec | `**Depends on**`（`:911`） | `depends-on` | |

上表 23 行 → 21 行改名为 key · 2 行退休（overall `**Constraints**` · phase-spec `Depends on ref`）；另有 **11 条新增 key 行**（`doc-type` ×4 · `date` ×4 · `parent-version` ×2 · `issues` ×1），键集与 presence/值形状见 §2.3 的收编表。

- **`Depends on ref` 的归宿 = 退休（不留替代判）**：该行 `presence: "conditional"` · `refKind: "phase-id"` · `valuePattern: "^P\\d+(\\.\\d+)*"`，但它的 anchor 从不出现在任何文档字面里（文档写的是 `- **Depends on**: …`），其「判」实为对整篇的行扫兜底，且**零消费点**——全树 grep `Depends on ref` 仅命中 `declare.ts:730` 自身，无 invariant、无渲染、无测试读它；`ResidueInvariant` 也只处理 `home: "conditional"` 且 anchor 以 `## ` 起首的行（`invariants.ts:772`），与它无关。故本 phase 删除该行，`phase-id` 这一参考类别由 plan 的 `depends-on` 行（`refKind: "phase-id"` 既有）承载；phase-spec 侧今日 `depends-on` 的 `refKind` 即 `"none"`，语义零变化。§6 增一条 grep pin：`Depends on ref` 在 `declare.ts` 零命中。

**投影涟漪全清单（anchor 字面量是 key 的不止 slices）**：

| 投影面 | 落点 | `frontmatter`-home 元素的处理 |
|---|---|---|
| slices | `project.ts:448-461` `#projectDocSlices` | anchor 即 YAML key → 改用 key 查表；`anchorPattern`/`valuePattern` 两 RegExp 编译对 header 腿停用 |
| schema | `project.ts:428/434` `#projectDocSchema`（`properties[element.anchor]` · `required.push(element.anchor)`） | key 直接进 `properties`/`required`（已是 key 形态）——`properties` 的 `pattern` 改吐 front-matter 值形状 |
| tokens | `project.ts:468` `#projectDocTokens`（carry anchor） | anchor 即 key，无需 RegExp，字面量照carry |
| skeleton/pattern-truth | `project.ts:497-522` `#projectDocSkeleton` / `:543-577` `#skeletonSlotOf`（按 anchor 分类） | 分类键由 bullet anchor token（如 `**Version**`）改为 YAML key（如 `version`） |
| judgment（判定通道） | `invariants.ts:167-188` `lineCarries` / `occurrenceLines` / `carrierLines` → `PresenceInvariant`（`:276-292`）· `DomainInvariant`（`:450-467`）· `#headerVersion`（`:944`） | front-matter-home 元素改读 `FrontMatterExtractor` 的 typed head record；三行扫原语仅留结构型 home（细则见 §2.2 的判定通道条） |

**值形状（valuePattern）重规格**：四类文档头部的 `valuePattern` 今日为 **bullet 形态正则**（`declare.ts:183/491/697/892` 的 `^- \*\*Version\*\*: v\d+\.\d+ · \d{4}-\d{2}-\d{2}$` · `:190` `^- \*\*Status\*\*: (Draft|Approved|…)` · `:176` `^# \S.*$` 等），**无法作用于 YAML 标量值**。本 phase 将 header 元素（`home: "frontmatter"`）的 `valuePattern` 全部**重规格为 YAML 标量形状**：`version` → `^v\d+\.\d+$` · `date` → ISO 日期 `^\d{4}-\d{2}-\d{2}$` · `status` → 原枚举元组 · `doc-type` → 原 `DOC_TYPE_VALUES` 元组 · `title`/`author` → 非空标量。或（择一）把值形状判定整体移交 `FrontMatterExtractor`，登记表仅留 `presence`/`home`/`refKind` 与 key 名。无论哪条，**schema / tokens / slices / skeleton 四面与全部 header valuePattern 一处同步改**，不留 bullet 形态正则残留。

### 4. 死代码清理与骨架渲染

#### 4.1 死头代码清理（六前提④）

- `render/skeleton.ts` 的 `HEADER_FORMS` 硬编码（`:32` · `"- **Version**: v0.1 · {date}"` 等）· `LINK_SLOTS`（`:45`）。
- `contract/doc.ts` 的 header-line 提取（`headerLines` / `HeadingBlock` 头部腿）。
- **`ParsedDoc.title` 的四个 `lines[0]` 读取点**：`doc.ts:500`（overall）· `:600`（plan）· `:639`（phase-spec）· `:718`（single-spec）四处 `const title = lines[0] ?? ""` 一并退休——H1 删除后首行是 `---` fence，实测对迁移形态的 plan 解析得 `title: "---"`、`headerLines: ["", "- a", ""]`，而该字段的 doc comment 明写「the `# Title` line verbatim」（`:131` / `:181` / `:210` / `:221`），四份注释同步改写。**替换通道 = `FrontMatterExtractor` 的 `title` 标量**（`ParsedDoc.title` 的形状不变，仍是字符串）。回归 pin：`contract/__tests__/doc.test.ts:147` 现断言 `parsed.title === "# 文档架构方法论 v2 — 测试 Overall"`，改锚到 front-matter 头形态，断言 `parsed.title` 等于 head 的 `title` 值且**不等于** `"---"`。
- `face/board-view.ts#headerLinesOf`（`:641`） / `#docTypeOf`（`:655`）的头部行扫描；`readHeader`（`:176-183`）内的 `**Status**` / `**Version**` 两条裸读（改读 typed head record，见 §2.3）。
- 头部 anchor 的 RegExp 编译（`project.ts#projectDocSlices` `:448-461` 对 header 腿）。
- **头部「裸行」版本读点**（§1.3 · §2.2）：`invariants.ts:944` `#headerVersion` 的 `anchorLines(ctx,"**Version**")` 扫描 · `invariants.ts:1236-1247` `#parentLineage` 的 `headerLines` 扫描 · `face/gate.ts:161-169` `#docVersionOf` 的 `- **Version**:` 行扫描——三处裸行扫描全删，改走 front-matter 标量。
- **标签漂移判**（§2.1）：`invariants.ts:1166` Class-A label==basename 判 · `lint.ts:234-242` `#crossDocDriftWarns` Class-B label↔basename 漂移判——标量形态下退化为恒真，一并退休。
- **`ChainLink.label` 字段整面退休（不是只退接口）**：`ChainLink`（`contract/doc.ts:98-103`）塌缩为只带 `target` 的值对象（或直接退化为 `string`）。生产点 `#linksOnLine`（`doc.ts:244-252`）与它的全部调用者同批改：`invariants.ts:1003-1020` 的 `chainLinks`（overall 的 Phase-inventory design/plan cell 也由它造 link，供 file-existence / sibling-scan 用，与两条漂移判无关）· plan 腿的 `data.chain.specLink` / `parentLink`。**两处漂移判的退休是这条改动的后果，不是它的全部范围**——只退接口而留 `linksOnLine` 产 label，仍是一处无消费者的死字段。
- 全部删除，零残留（grep pin）。

#### 4.2 骨架渲染器改吐 front-matter 头

- `SkeletonAssembler` 头部段改吐 front-matter（`yaml.stringify`）——字段按四型注册表的 front-matter-home 槽位序输出：`title` 为填槽、`version`/`date`/`status`/`doc-type` 为 generator-truth（`doc-type` 取装配器自身的 `#docType`）、`author`/`spec`/`parent-program`/`parent-version`/`depends-on`/`base` 为填槽。
- **`doc-type` 与 `base` 必须在册**：`doc-type` 是引擎自身 preflight（`session/preflight.ts:205` 的 doc-contract 门）赖以判别文档类的声明——骨架若漏吐它，则产出的骨架过不了自己的门（`render/__tests__/skeleton.test.ts:464-470` 的 self-preflight pin 即钉此）。今日它在 `render/skeleton.ts:268` 作为 `- **Doc type**: <key>` 结构性行紧跟在 Version 行后发射，且 `:254-262` 的类注释把它写成「deliberately NOT a registered slot … composed structurally and never probed」——front-matter 化后该理由作废：`doc-type` 进登记表（§2.3），骨架按 front-matter 键发射。**该注释为同批编辑点**，随改动重写。自检 pin（`render/__tests__/skeleton.test.ts:464-482`）**用例体不改**——它已通过 `BoardView.readDocType` 读回，而该 reader 本 phase 改为读 front-matter `doc-type`，故 pin 自动覆盖新通道；只需在用例注释里把「Doc type line」的表述同步为 front-matter 键（断言本身零改：仍须 `readDocType(skeleton) === key` 对四型全成立）。`base` 是 plan 的既有注册字段（`declare.ts:503-508`），同按 front-matter 键发射。
- **front-matter 头的发射不走 slot 通道（槽位规则显式化）**：今日 `#projectDocSkeleton` 只对 `presence === "required"` 的元素压槽（`project.ts:497-508`），故 `**Base**`（`optional`）与 `**Depends on**`（plan 侧 `optional`）**永远不进 skeleton slots**——实测 plan 骨架头为 `# :::fill title / **Spec:** / **Parent program** / **Version** / **Doc type**`，无 `Depends on`、无 `Base`；且 `#assertConsumed`（`skeleton.ts:130-144`）对任何不在槽集内的 probe 抛 `skeleton composition emits the unregistered anchor`，所以「在槽通道外顺手发一个 `base`」必炸。本 phase 的机制因此定为：
  - **front-matter 头 = 独立的发射清单**，不走 `#slots`：`SkeletonAssembler` 增一个 front-matter 行集（按 §2.3 收编表逐型声明：必填键 + 该型的可选键），经 `yaml.stringify` 一次成块；该块**不参与 probe 集**，`#assertConsumed` 的覆盖域收缩为 **body slots**（`home !== "frontmatter"` 的 required 元素），前 n 条 `unemitted` 断言只查 body。
  - **`presence` 不因此上调**：`base` / `depends-on`（plan）保持 `optional`——上调会强制全库补值，把可选的作者事实变成必填，超出本 phase 面。`doc-type` 的 `presence` 定为 `required`（§2.3），但它由 front-matter 清单而非 slot 通道发射。
  - **AC 与 §4.2 口径一致**：AC 的「含 `doc-type` 与 `base`」按上面这条机制兑现——`base` 若该 plan 骨架的 front-matter 清单含 `base:` 键（值仍可为空/待填），而非断言它出现在 body 段。
- body 段骨架逻辑（section 序列 · 表列头 · task block 首块 · change-history 表）保留。
- `schema get <type> --output skeleton <target>` 输出 = front-matter 头 + markdown body。

### 5. 迁移与消费面

#### 5.1 全量迁移（迁移时刻在册的文档集）

- **算术按迁移时刻计**：四族过期文档清理落定后（`dd5bed94`：consumer-parity · pi-harness · doc-architecture-v2 · cdd-review-contract-fix 共 45 篇删除 · 删除判据 = 文档引用的代码路径在本树已不存在），迁移集 = `docs/kairos/specs/*.md` **11**（1 overall-spec + 10 phase-spec design，**含本 p10 design 自身**）· `docs/kairos/plans/*.md` **9** + **本程序的 p10 实施计划**（由本程序的 plan wave 在迁移 wave 之前产出，届时按旧 bullet 头形态落盘、是迁移对象）→ 合计 **21**。迁移脚本按 glob 全量改写，不按硬编码清单，故计数推进不改变施工面。
- **验收基准 = 迁移时刻在册的文档集（21 篇），不是历史全集**：清理前全库 65 篇判压为 206 findings / 33 篇（`presence` 108 · `continuity` 30 · `crosslink` 24 · `domain` 18 · `hollow` 12 · `section-scoped-domain` 11 · `order` 2 · `cross-doc-chain` 1），是**判定语料**的存量债务，与本 phase 的头部形态无关（§1.3 冻结判定语义 → 本 phase 无权也不该修它们）。清理后实测：**21 → 20 篇（p10 plan 尚未产出）判压 0 finding**（`Contract.validate` × `BoardView.readDocType`，退出即零）。故本 phase 的 `全绿` 断言是可兑现的，且**基线与复现命令固定**：`node packages/cdd-engine/src-next/bin.ts board 2026-10-10-engine-doc-tooling-p10` + 逐篇 `Contract.validate` 脚本（见 §6 判定回归 pin）。
- 本仓 **11 spec + 10 plan（迁移时刻）** 一次性机械改写头部为 front-matter（脚本可安全批改——同源模板 · 头部块形态一致）；正文 H1 删除（`title:` 唯一源）。
- **发射规则 = 一律 `yaml.stringify`，零字符串拼接（硬要求）**：语料里存在非法裸标量，直接用 `key: <value>` 拼串会**硬解析失败或静默截断**，后者对任何 `##` section 级断言都不可见。以仓库自带 `yaml@2.9.1` 实测。**迁移集当前 20 篇的头部元组行 106 条**（Version 20 · Doc type 20 · Status 11 · Author 11 · Constraints 1 · Parent program 19 · Depends on 13 · Spec 9 · Base 2），对应 **129 个 front-matter 标量** = `version` 20 + `date` 20（Version 行一拆二）+ 其余 85 条各 1 + `parent-version` 4；`Constraints` 1 条退休为 section、产 0 个：
  - `author:` 以 `[` 起首的值 **3 处** → `Unexpected scalar at node end`（硬失败）；
  - `parent-program:` / `spec:` 仍为 markdown 链接形的值 **28 处** → `Nested mappings are not allowed in compact mappings`（硬失败）——正是 §2.1「只存 target 标量」要消除的形态，但**迁移脚本必须先把 `[label](target)` 拆成 `target` 再发射**，不能原地搬字面；
  - 历史全库（清理前）另有 6 篇 title 含 ASCII `": "`、4 篇 `Depends on` 含 `" #"`（静默截断）、1 篇 `Issues` 以 `#302` 起首（整行读成注释 → `null`）——迁移集今日 0 处，但脚本规则按**通用**写（不按当前数据特判）。
  - **规则**：所有 head 值经 `yaml.stringify` 发射（与 §4.2 骨架同一引擎）；**回环断言** `yaml.parse(yaml.stringify(head))` 与原 head record 深相等，逐篇跑；并对上述三类形状保留计数卡口（`[` 起首 **3** · 链接形 **28** · 截断类 **0**），迁移后各自 shape 正确且值不丢字节（link 形例外：按 §2.1 只保 target，label 主动退休）。
- **非元组头部 bullet 的处置（迁移不可静默丢弃）**：清理后迁移集的头部**非元组 bullet 实测为 0**（清理前 14 篇 / 18 条的样本已随四族删除消失；`Issues（收口时关闭）` 的唯一历史实例亦在其列）。规则仍须写在脚本里并按通用形态实现：
  - 非登记 bullet → **逐字节原样保留**，紧随 front-matter fence 之后、首个 `##` 之前（不搬进 section、不改文案）；判定语义对这些行零依赖（不在册即不判），但作者写下的约束不丢。脚本只改写登记元组对应的键，其余头部行一律透传。
  - `Issues（收口时关闭）` → 收编形态改写（§2.3 的 `issues` 键）。
  - **验收**：迁移前后「非元组头部行集合」逐行 `diff` 零差异；当前计数卡口为 **0 条 / 0 篇**，非零即视为语料漂移须人工裁定；`issues` 改写分支由单元用例覆盖（构造一条旧形头行，断言落地为 `issues:` 键）。
- **元组键的续行随键搬移（overall `**Constraints**` 块）**：`- **Constraints**:` 在 overall 下挂缩进子 bullet 续行——迁移集实测 **10 行 / 1 篇**（`2026-10-10-engine-doc-tooling-overall.md`；清理前的另三篇 overall 已删）。§2.4 退休该键，故这 10 行**整体搬为 `## Constraints` 的正文 bullet**（逐字节，不改文案、不重排），落位见 §2.4。**验收**：续行块搬移的计数卡口 **10 行 / 1 篇** + 迁移前后该块内容逐字节 `diff` 零差异——上一条「非元组头部行」规则只管非登记 bullet，盖不住这条，故单列。
- 迁移后引擎 `board` / `review` / `fix` 对在册文档判压全绿（`readDocType` 从 front-matter `doc-type` 读）；`全绿` 的范围 = 迁移时刻在册的 21 篇（见上第二条）。
- **一次提交**（头部形态迁移独立于实现 · Mid-Flight Backfill 纪律）。

#### 5.2 消费者面（major breaking · 自行迁移）

- 引擎是发布物；消费者仓已有旧格式文档。换格式后消费者升级引擎再跑 `cdd review` 会解析失败 → **major breaking · 零 legacy 兼容**（不做「读不到 front-matter 时回退旧 bullet 头」的双格式兼容——正是本程序要消灭的「两套头部模型」）。
- 消费者**自行迁移**（按迁移说明重写头部，或 `schema get … --output skeleton` 重吐头部）。
- 消费面 skill（cdd-spec-writer / cdd-plan）「先 gen 后填」纪律不变；skill 文本对头部形态的表述同步（不注入解析实现 · 守 D29）。
- **引擎自身的 BLOCKED 文案也必须同步（不止 skill 文本）**：`face/words.ts:100-101` 的 `routeWords.docType` 今日为「the doc declares no `- **Doc type**:` line — add `- **Doc type**: <…>` to the doc's header (spec §12) and re-run」，经 `session/preflight.ts:201` 与 `face/capsule.ts:125` 在 BLOCKED 路径发出（`face/__tests__/cli.test.ts:1971` · `capsule.test.ts:279` · `preflight.test.ts:443` 三处 pin）。它是**引擎输出**，不是 skill 文本，§5.2 的 skill 同步够不到它——若不同步，迁移后引擎会指导每个消费者去修一份**本 phase 正在退休的** bullet 头形态。**同一批编辑点**：`routeWords.docType` 改为 front-matter 表述（形如「the doc declares no `doc-type:` front-matter key — add `doc-type: <overall-spec|phase-spec|single-spec|plan>` to the doc's YAML front-matter and re-run」），并把三处 pin 文案同步重锚。**message 文本 pin 保住**：任何头部形态相关 message 不再出现 bullet 头字面。

### 6. 不变量与 pin

- **结构 pin（正向断言，不是负向 grep）**：`doc.ts` 内的**结构正则全部来自登记表声明**，不是「某个 `^#` 家族零命中」。今日 `doc.ts` 有 7 处正则/切分：`:278` 表格 `split("|")` · `:382` `^### Task (\d+):` · `:407` `^-\s+\*\*([A-Za-z ]+)\*\*:\s*(.*)$` · `:425` `^-\s+(.*)$` · `:481` `^(#+)\s`（heading-rank 原语）· `:676` `^### (\d+)\.\s+(.*)$` · `:683` `^#### (\d+)\.(\d+)\s+(.*)$`。旧 pin `grep -nE '\.match\(/\^#'` 只命中 `:382/:676/:683`，**漏掉 `:407/:425`** 两条——只改 `^#` 家族的实现能过旧 pin 而把 task-field / task-step 的结构知识留在手写态。新 pin = **显式 allowlist**：`doc.ts` 内允许出现的正则/切分仅两处原语——heading-rank（`^(#+)\s`）与表格切分（`split("|")`），其余 5 条 anchor 结构性正则零命中（pin 断言：`doc.ts` 内 `RegExp` / `.match(` / `.matchAll(` 的命中集 ⊆ 上述 allowlist 的两处）；同时**登记表的 header-home anchor 集 = key 形态集**（不是「含 `frontmatter` + `doc-type` + `issues` 就算过」）：该 pin 断言四型 registry 中 `home === "frontmatter"` 的 `anchor` 全集 ⊆ §3.3 改名表的 key 集（`title` / `doc-type` / `version` / `date` / `status` / `author` / `spec` / `parent-program` / `parent-version` / `depends-on` / `base` / `issues`），且**不含任何 bullet/heading 字面量**（`**…**` 与 `# ` 前缀零命中）；`Depends on ref` 在 `declare.ts` 零命中（§3.3 退休）；退休判零残留（`invariants.ts` label==basename 判 · `lint.ts#crossDocDriftWarns` grep 零命中）。
- **形态 pin**：四类文档头部元组全在 front-matter（正文 bullet 头零残留 grep）；正文 H1 零残留；front-matter 块内 `yaml.parse` 零错误（迁移脚本的回环断言进 engine suite 后逐篇跑）。
- **判定回归 pin（两种断言，不混为一谈）**：
  - **语料零 finding（范围 = 迁移时刻在册的 21 篇）**：迁移后逐篇 `Contract.validate({docKey: BoardView.readDocType(...), …})` 零 finding。**基线是实测而非假设**：清理后当前 20 篇（p10 plan 未产出）已跑得 0 finding / 0 篇有 finding；迁移前如若有非零项，按 §5.1 的基线口径记录并排除，**不以零 finding 作为迁移正确性的前提**。
  - **判定集合等价（迁移正确性的真判据）**：对每篇文档，**迁移前后 finding 集合逐条同集**（空集 → 空集也是同集）——机械改头不改判定语义。这条排除了「迁移顺手把某判静默关掉」的假绿，比「全绿」更强（全绿在存量有 finding 的文档上不可达）。
  - **判压仍触发（§1.3 假绿回归 · 各一条 negative-case 用例，载体逐条具名）**：
  - **版本血缘判**：头 `version:` 落在 Change-history 血缘之外须仍产 finding（`SelfBoundedInvariant`）——单位用例构造 front-matter 头 + 不含该版号的 Change-history 表。
  - **父血缘判（Class-B）**：`parent-version:` token 不在 parent 血缘须仍产 finding。**载体 = 单位级用例**：构造 `ContractInput` 并注入 `chainDocs`（`{parentLink.target → 解析后的 overall ParsedDoc}`），走 `contract/judge.ts:49/:106` 的 `chainDocs` 缝——**生产链今日不接该缝**：唯一生产调用点 `session/preflight.ts:205` 不传 `chainDocs`，故 `classB` 在 `invariants.ts:1217-1218` 提前返回。**生产接线（preflight 装配 chainDocs map）不在本 phase 面**——本 phase 只保证 `parentTokens` 的载体迁移后非空、判定逻辑与缝形状不变；§6「语料零 finding」的冻结声明据此只覆盖已接线通道，Class-B 的生产生效待接线 phase。
  - **front-matter presence / 值判通道**：两个 negative 用例——(a) 缺 `status:` 键的文档须仍产 presence finding；(b) `status: Bogus`（枚举外）须仍产 domain finding。二者证明判定确实走 `FrontMatterExtractor` typed record（§2.2 判定通道条），而非被行扫真空满足。
  - **RAW 提取通道**：一条 positive 用例——head 值含已登记中文别名（如 `组`）时，`Contract.validate` 提取出的 head 值与源串逐字相同，而同用例的正文行仍被 canonicalize（断言两侧）；证明提取器未吃 canonicalized 视图（§2.2）。
- **依赖 pin**：`yaml` 落 cdd-engine `package.json#dependencies`。
- **门归属**：引擎内部事实门进 **engine suite**；引擎 ⇄ 消费面对照门进 **kairos suite**（镜像 P5/P9 归域）。

### Acceptance criteria

- `四类文档头部元组全在 front-matter（正文 bullet 头零残留 grep · front-matter 块 yaml.parse 零错误）`
- `正文 H1 零残留（title 唯一标题源 · ParsedDoc.title 读到 head 标量而非 "---"）`
- `doc.ts 手写 anchor 结构正则零命中（登记表 home 驱动提取器替换 · 正则/切分命中集 ⊆ heading-rank + 表格 split 两处 allowlist）`
- `登记表含 frontmatter home + 收编键全集（doc-type · date · parent-version · issues）+ 23 行 header anchor 改名落定 + Depends on ref 退休（无门事实归零）`
- `Constraints 归一为正文 section（overall 头部 bullet 零残留 · 登记表行 + #renderOverallSpec 合成位 + 语料落位三处同序）`
- `死头代码零残留（HEADER_FORMS · #headerLinesOf · #docTypeOf · readHeader 两条裸读 · header-line 提取 · ParsedDoc.title 四处 lines[0] · 三处裸行版本读点 · 两处标签漂移判 · ChainLink.label 及其 linksOnLine 生产点 · 引擎 BLOCKED 文案的 bullet 头表述）`
- `skeleton 吐 front-matter 头（yaml.stringify · 按 front-matter 行集发射 doc-type 与 base，不经 slot 通道）+ body 骨架保留（#assertConsumed 覆盖域 = body slots · 骨架自身过 preflight）`
- `本仓 21 篇文档全量迁移（迁移时刻在册：11 spec + 10 plan，含 p10 design/plan · 迁移前后 finding 集合逐条同集 · 在册语料零 finding（基线实测 20 篇 0 finding）· 版本血缘判 / 父血缘判 / presence / domain negative-case 仍触发 · RAW 提取通道 positive-case · 非元组头部行 0 条（清理后实测）· overall Constraints 续行 10 行 / 1 篇逐字节搬移 · yaml 回环断言逐篇通)`
- `消费面迁移说明在册（major breaking · 零 legacy 兼容）`
- `引擎 vitest 全绿 + kairos suite 全绿 + pnpm run validate ALL PASS · 不发布`
- `零裸函数（grep 零命中）· EOF 恰一 newline · English-primary（SKILL.md/docs）· specs/plans 中文（Strategy B）`

## Constraints

- **判定语义不变**：`invariants.ts` 判压逻辑逐条不变——本 phase 只换承载形态与提取通道，不改判定规则；退出码表 0/1/2 · CDD_BLOCKED 通道 · 领域 run 语义 · `next:` 字面形态零变化。
- **两组分界（唯一规范）**：结构化元数据（front-matter）→ 标准解析器（`yaml`）；markdown 正文骨架 → 登记表驱动轻量扫描。**正文层不引 AST 解析器**（避第二套模型 · 守六前提⑤心智负担 · `declare.ts` 登记表 anchor 保持字面量 token 形态）。
- **登记表仍是唯一声明根**：头部元素 `home: "frontmatter"`（anchor = YAML key）· 正文元素 home 提取器；零「头部单抽 schema」双模型。
- **`yaml` 升 engine 运行时依赖**：由仓库 devDep 升 cdd-engine `dependencies`（P3 commander 先例 · 记一笔）。
- **迁移 = 全量 · 零 legacy 兼容**：本仓迁移时刻在册的 21 篇一次性改写（四族 45 篇过期文档已于 `dd5bed94` 删除，不在迁移集）；消费者自行迁移；major breaking。不引入双格式头兼容层（违 D26「两套模型」）。
- **H1 删除**：`title:` 是唯一标题源，正文自 `## Document scope`/`## Design` 起。
- **D29 黑盒边界守约**：skill 文本零引擎内部实现镜像；消费面只同步头部形态表述。
- **门归属分域**：引擎内部事实门进 engine suite；引擎 ⇄ 消费面对照门进 kairos suite。
- **零裸函数**：`^export function|^function` 零命中；新增/改动面全为类成员或声明常量。
- **不在本 phase 面**：判定语义、`next:` 字面、退出码、投影面其余、AST 解析器引入。
- **不破坏 P9 路径面**：`RepoRoot`/`RepoPath` 值对象 · 渲染/回显面 repoRoot 相对 · `yaml` 契约面保持（P9 立）。
- **变更先回填 parent overall**（backfill-as-version）。
- **不发布**：changeset（cdd-engine major breaking）按既有归并落 pending；tag / publish = 独立动作。
- **English-primary**（SKILL.md / `docs/*.md`）· **specs/plans 中文**（Strategy B）· emit 产物派生（`pnpm run emit`）· EOF 恰一 newline。

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-10-17 | 初稿：P10 文档头部 front-matter 化 + 登记表驱动正文解析统一（Fork B）——头部元组迁 YAML front-matter（`yaml` 引擎 + 薄 fence 切分 · 正文 H1 删）+ 正文结构层登记表 home 驱动泛型提取器（消 `doc.ts` 手写 anchor 正则）+ 登记表增 frontmatter home + `Doc type`/`Issues` 收编 + Constraints 归一 + 死头代码清理 + 骨架吐 front-matter 头 + 全量迁移 64 篇 + 消费者自行迁移（major breaking）· 尺寸 oversized 单 phase 内部波次 · 会话裁定回填 overall D48 | Oscar M. · Claude Opus 5（kairos:cdd-design [P10]） |
| v0.2 | 2026-10-17 | **spec-fix-1（review-1 findings 收口 · 1 blocker + 5 warn + 1 nit）**：① blocker——补三处「裸行」版本读点（`invariants.ts:944` `#headerVersion` · `:1236-1247` `#parentLineage` · `gate.ts:161-169` `#docVersionOf`）的 front-matter 替换通道（§1.3 · §2.2 · §4.1）并加迁移后回归 pin（版本血缘判 / 父血缘判仍触发 · 防假绿）；② warn——补 `spec`/`parent-program` 标量化的标签漂移判退休（`invariants.ts:1166` · `lint.ts#crossDocDriftWarns` · §2.1/§4.1）；③ warn——迁移计数 64 → **65**（35 spec + 30 plan · 含本 p10 design 自身）· §5.1/AC/Constraints 对账；④ warn——补全 `doc-type` 读点清单（`readDocType` + capsule/cli/callers + `preflight.ts` doc-contract 门 · §2.3）；⑤ warn——补全登记表接法 α 的投影涟漪（schema/tokens/slices/skeleton 四面 + header valuePattern 重规格为 YAML 标量形 · §3.3）；⑥ warn——为承重行为断言补 `path:line` 引证；⑦ nit——`header` → `frontmatter` 定为**改名 retire**（`Home` union + `HOME_VALUES` + 23 用例 + `PRESENCE_HOMES` · §3.1） | Oscar M. · Claude Opus 5（kairos:cdd-design [P10] spec-fix-1） |
| v0.3 | 2026-10-17 | **spec-fix-2（review-2 findings 收口 · 1 blocker + 7 warn + 1 nit）**：① blocker——Class-B 版本 token 血缘判的输入面收口：新增 `parent-version:` 标量承载位（`doc.ts:624/:701` 读点重指 · §1.3/§2.1/§2.2），chainRoot 不再刮 `**Parent program**` 行；② warn——§2.1 `spec`/`parent-program` 标量值定为 **target 路径**（示例改路径）、退休 `ChainLink.label` 字段、删除无依据的「引擎已有 label 派生链路」表述；③ warn——§4.2 front-matter 字段表补 `doc-type` / `base`，并把 `skeleton.ts:257-262` 的「not a registered slot」注释列为同批编辑点（自 preflight pin 同步）；④ warn——§3.3 增 judgment 涟漪行 + §2.2 判定通道条：front-matter-home 元素的 presence/domain 判改走 typed head record，`lineCarries`/`occurrenceLines`/`carrierLines` 只留结构型 home，并补两条 presence/domain negative pin；⑤ warn——§2.3/§4.1 补 `board-view.ts:176-183` `readHeader` 三元裸读（board 列数据源）；⑥ warn——§6 Class-B pin 具名载体为单位级 `ContractInput`+注入 `chainDocs`，并声明生产接线（preflight 不传 chainDocs）不在本 phase 面；⑦ warn——§5.1/AC/Constraints 迁移计数 65 → **66**（35 spec + 31 plan · p10 实施计划届时已是迁移对象），并补 14 篇 18 条非元组头部行（`Interface 转录注记` 11 · 授权/工具链行 3 · `程序形态` · `全树基线修正声明` · `开线 GATE` 共 17 条逐字保留 · `Issues` 1 条按收编形态改写）的处置规则与字节核对卡口；⑧ nit——`classB` 早退 pin 1219 → `invariants.ts:1216` | Oscar M. · Claude Opus 5（kairos:cdd-design [P10] spec-fix-2） |
| v0.4 | 2026-10-17 | **spec-fix-3（review-3 findings 收口 · 2 blocker + 9 warn + 2 nit）**：① blocker——`全绿` 验收基准重定：清理后迁移集体量 21 篇（11 spec + 10 plan）· 实测基线记入 §5.1（清理前 65 篇 206 findings/33 篇；清理后 20 篇 0 finding）· 真判据改为「迁移前后 finding 集合逐条同集」+「在册语料零 finding」，并把判定语料存量债务明确划出本 phase（§5.1/§6/AC/Constraints 对账）；② blocker——§3.3 补 23 行 header anchor 逐行改名表（`**Version**` → `version` 等）+ `Depends on ref` 退休（零消费点，`Resolved` 见条内实证）；③ warn——§5.1 增发射规则硬要求（一律 `yaml.stringify`，禁拼串）+ 回环断言 + 三类非法标量形状的实测计数卡口（`[` 起首 3 · 链接形 28 · 截断类 0）；④ warn——§4.2 显式化 front-matter 发射不走 slot 通道（`base`/`depends-on` 为 optional 永不进 slots · `#assertConsumed` 覆盖域收缩为 body），`doc-type` presence 定为 required；⑤ warn——§2.4 补 overall `## Constraints` 的登记表行 + `#renderOverallSpec` 合成位 + 语料落位三处同序；⑥ warn——§2.3 补收编键全集表（`doc-type`/`date`/`parent-version`/`issues` 逐项 presence + valuePattern）+ `MAX_ELEMENTS` 40 → 44 的重定基理由；⑦ warn——§4.1 补 `ParsedDoc.title` 四处 `lines[0]` 读点与 `doc.test.ts:147` 重锚；⑧ warn——§2.2 定 `FrontMatterExtractor` 读 RAW（先提取后 canonicalize）+ RAW 通道 positive pin；⑨ warn——§5.2 补 `words.ts:100-101` BLOCKED 文案与三处 pin 的同步（引擎输出非 skill 文本）；⑩ warn——§6 结构 pin 换成正向 allowlist（`doc.ts` 正则命中集 ⊆ heading-rank + 表格 split，旧 `^#` grep 漏 `:407/:425`）；⑪ warn——§5.1 补元组键续行搬移规则（overall Constraints 10 行 / 1 篇，逐字节）；⑫ nit——§4.1 `ChainLink.label` 退休面扩到 `linksOnLine` 全部调用者（`:1003-1020`）；⑬ nit——§2.3 preflight 措辞改准（消费 `cli.ts:474` 交来的 `docKey`，自身零行扫） | Oscar M. · Claude Opus 5（kairos:cdd-design [P10] spec-fix-3） |
