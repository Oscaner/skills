# 引擎文档工具（Engine Doc-Tooling）— P10 设计：文档头部 front-matter 化 + 登记表驱动正文解析统一（Fork B）
- **Version**: v0.7 · 2026-10-17
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

- **判定语义不变**：`invariants.ts` 的判压逻辑（version-lineage · phase-registered · change-history 版本血缘 · cross-doc chain 等）逐条不变——本 phase 只换**事实的承载形态与提取通道**，不改判定规则。此冻结**对头部版本事实的读取通道同样成立**：现行三处把 `**Version**` 当**裸 markdown 行**读（不经任何 DocType 解析器）——`invariants.ts:944` `#headerVersion`（`anchorLines(ctx,"**Version**")`）· `invariants.ts:1236-1250` `#parentLineage`（扫 `(parent as OverallParsed).headerLines` 找 `line.includes("**Version**")`）· `face/gate.ts:161-169` `#docVersionOf`（`line.trimStart().startsWith("- **Version**:")`）。头部迁 front-matter 后这些 bullet 行消失，三处各自返回空 → `SelfBoundedInvariant.evaluate` 在 `headerVersion === null` 早退（`:894`）· `classB` 在 `parentTokens.length === 0` 早退（`:1216`）→ **判压静默自禁（假绿）**。故本 phase 必须把这三处**显式列为改点**并给定 front-matter 替换通道（见 §2.2 / §4.1 / §6 的回归 pin），否则违本冻结。**Class-B 版本 token 血缘判（`classB`）的输入面同属此冻结**：今日 token 从 `**Parent program**` 行刮取（`contract/doc.ts:624` / `:701`），头部标量化后 token 无家 → `parentTokens` 恒空 → 同一 `:1216` 早退。故本 phase 为其设专用承载位 `parent-version:` 标量（§2.1）并把 `doc.ts:624/:701` 的读点重指到它；`classB` 的判定规则（token 须属于 parent overall 血缘）与早退语义零变化。**冻结的唯一例外 = §2.1/§4.1 明列的两处标签漂移判退休**（Class-A `invariants.ts:1166` label==basename 判 · Class-B `lint.ts:234-242` `#crossDocDriftWarns`）：`ChainLink.label` 随标量化整字段退休后无「可漂移的独立事实」，两判的存在前提消失——这是**判据事实面塌缩**，不是判定规则改写；除这两条外 `invariants.ts` 判压逻辑逐条不变。
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
  - 值形态 = `target` 路径（与 `spec:` 同形 · 含 `docs/kairos/…` 相对路径）。三条链判的读点原样成立、零改动：`FileExistenceInvariant` 的 `link.target` 解析（`contract/invariants.ts:986-988` 的 `chainLinks` 循环 → `#targetExists` `:1049-1053` → 单源 `static targetPath` `:1062-1072`）· `SiblingScanInvariant` 的 `path.basename(link.target)`（`:1089`）· `classB` 的 `ctx.chainDocs?.get(parentLink.target)`（`:1217`）。
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
  - `invariants.ts:1236-1250` `#parentLineage`：由扫 `(parent as OverallParsed).headerLines` 改为读 **parent overall 的 front-matter `version` 标量** 加入 lineage（Change-history 行版本照旧）。
  - `face/gate.ts:161-169` `#docVersionOf`：由 `line.trimStart().startsWith("- **Version**:")` 改为解析 front-matter block 的 `version` 标量，产出同一 `v<major>.<minor>` token。
  三处 `versionTokens`/`versionTokensOf` 的 token 语法是共享单一源（`contract/doc.ts`），仅**入口事实**由「裸行」换为「front-matter 标量」，不对判定值形状作任何放宽。
- **Class-B token 读点重指**：`contract/doc.ts:624`（`PlanDocType.chainRoot`）与 `:701`（`PhaseSpecDocType.chainRoot`）的 `parentTokens: parentLine === null ? [] : this.versionTokens(parentLine)` 改读 front-matter 的 `parent-version` 标量（`parentTokens = head.parentVersion === null ? [] : [head.parentVersion]`）——`**Parent program**` 行消失后 token 的唯一来源（§2.1）。token 语法仍走同一 `versionTokens` 单源，判定值形状零放宽。
- **判定通道（front-matter-home 元素不经行扫）**：`home: "frontmatter"` 元素的存在判与值判**一律读 `FrontMatterExtractor` 的 typed head record**，不得走 `ctx.lines` 行扫——`invariants.ts:167-188` 的 `lineCarries` / `occurrenceLines` / `carrierLines` 三原语仅服务结构型 home（section / facet / table / task-* / graph / design-body）。理由：header anchor 变为 YAML key（`version` · `status` · `title`）后，行扫会把正文任意提及 "version" 的散文行当作 carrier——presence 被真空满足（假绿），且该散文行随后被当作 Domain carrier 撞 `^v\d+\.\d+$`（全库假红）。故 `PresenceInvariant`（`:276-299`）· `DomainInvariant`（`:450-477`）· `#headerVersion`（`:944-950`）在 front-matter-home 元素上改走 typed record。
- **head record 的投递缝（三层，必须逐层写明，否则 §4.1 的两条替换通道无法实现）**：今日 `Contract.validate`（`judge.ts:94-96`）只做 `content.split("\n")` → `canonicalize` → 交给 `parse` 与 `ctx.lines`，而 `JudgeContext`（`invariants.ts:95-127`）**没有 head 字段**、`ParsedDoc` 也没有——所以「提取器读 RAW」只够喂判定器的头部值判，喂不到 `ParsedDoc.title`，更喂不到 `#parentLineage` 读的 **parent** 记录。本 phase 的接法是：
  - **(1) `DocType.parse(lines, head: FrontMatterHead | null = null)`**——可选第二参数（`contract/doc.ts:499` / `:599` / `:638` / `:717` 四个 `parse` 覆写同签名）。`ParsedDoc` 四型各增 `head: FrontMatterHead | null` 字段。`title` 改为 `head?.title ?? ""`（§4.1 的替换通道由此成立）；`chainRoot` 的 `parentTokens` 改读 `head.parentVersion`（§2.1），`parentLink` / `specLink` / `dependsOn` 改读 `head.parentProgram` / `head.spec` / `head.dependsOn`。
  - **(2) `Contract.validate` 把同一份 RAW 提取结果同时投给两侧**：先对 `input.content` 原串跑 `FrontMatterExtractor` 得 `head`，再只把 fence 之后的正文行 `canonicalize` 成 `lines`，然后 `docTypeParsers[key].parse(lines, head)`；`JudgeContext`（`invariants.ts:95-127`）增 `head: FrontMatterHead | null` 并由同一变量填充（`PresenceInvariant` / `DomainInvariant` / `#headerVersion` 读它，不再走 `anchorLines`）。
  - **(3) parent 记录的 head 由 chainDocs 的生产者负责**：`#parentLineage`（`invariants.ts:1236-1250`）改读 `(parent as OverallParsed).head?.version`——这意味着 **`ctx.chainDocs` 的每个生产者都必须用同一 `(lines, head)` 双参形式 parse**。本 phase 的在册生产者只有 §6「父血缘判」的单位用例（构造 `chainDocs` 时按双参 parse）；生产链（`session/preflight.ts:205` 不传 `chainDocs`）仍不在本 phase 面——但该缝一旦接线，接线方必须遵守双参约定，此约定写进 `parse` 的 doc comment。
  - **调用点按「实际读什么」分两类，不按「喂 TaskGraph」一刀切**（判据：chain 字段——`specLink` / `parentLink` / `dependsOn` / `parentTokens`——流入消费者的生产者**必须**传 head；head-optional 清单只容确实只读 `taskBlocks` 的读者）：
    - **head-optional（只读 `taskBlocks`）· 六处**：`face/cli.ts:508`（wave 组的 plan task id 集合）· `:695`（split 早退的 `TaskGraph`）· `:805`（scene 装配的 `TaskGraph`）· `face/board-view.ts:558` · `session/preflight.ts:153` · `render/brief.ts:61`（`BriefExtractor` 的 taskBlocks 提取）。六处不读 `title` / `head` / chain 字段，本 phase 不改其调用形态（默认 `null`）。
    - **head-required（读 `chain` 字段）· 一处**：`face/cli.ts:773`——`new PlanDocType("plan").parse(planText.split("\n")).chain.specLink?.target ?? null` 产 `scene.specLink`，经 `face/lifecycle.ts:312` 渲染为 plan-review 轮上下文的 `INPUT_SPEC`（`frame.type === "plan" ? this.#rel(scene.specLink ?? "") : ""`）。`specLink` 迁移后**只**从 `head.spec` 取值（上条 (1)），head 为 `null` 则 `specLink` 恒 `null` → **每次 plan review 的 `INPUT_SPEC` 静默空置**（无编译错，只有行为丢失）。故该点**同批改为双参形态**：对 `planText` 原串跑 `FrontMatterExtractor` 得 `head`，fence 之后的正文行作 `lines`，`parse(lines, head)`；验收 pin = `face/__tests__/cli.test.ts:1785` 与 `:1819`（两处均断言 `- \`INPUT_SPEC\`: docs/kairos/specs/p3-design.md`）。
    - 若将来上述 head-optional 任一点成为 chainDocs 生产者或开始读 chain 字段，则必须补 head（同上条约定）。

#### 2.3 登记表外头部事实收编

- **`doc-type`**：今天不在 `declare.ts` 登记表，声明由 `face/board-view.ts#docTypeOf`（`:655`，经 `#headerLinesOf` `:641` 扫 `- **Doc type**:` 行）解析。**读点全清单**（收编后须全部重指到登记表的 front-matter `doc-type` 元素）：`board-view.ts:194` `readDocType`（其非测试调用者 `face/capsule.ts:147` · `face/cli.ts:474` 的 plan dispatch），以及 `session/preflight.ts` 的 doc-contract 门——**preflight 自身不扫行**：它消费 `face/cli.ts:474`（`BoardView.readDocType`）交给它的 `doc.docKey`（`preflight.ts:64-69` 只是该字段的 doc comment · `:186-211` 是消费点），故重指落在 **reader（`#docTypeOf`）**，preflight 零改。**board 的头部三元读点同列在册**：`face/board-view.ts:176-183` `readHeader` 读 `**Status**` / `**Version**` / doc-type 三条头部行，其返回值经 `#docLine`（方法体 `:567-577`，调用点 `:232` / `:234` / `:235`）喂 board 的 version/status/docType 列（`face/__tests__/board-view.test.ts:165-250` pin）——一并重指到同一 typed head record，`BoardNodeHeader` 形状（`{version, status, docType}`）不变，渲染面零改。收编进登记表（`home: "frontmatter"`），**唯一读通道** = 登记表 `doc-type` 元素的 front-matter 标量（`FrontMatterExtractor`），消灭「无门声明事实」。
- **single-spec `Issues`**：今天为自由散文行（不在登记表）。收编进登记表，**key 名 = `issues`**（front-matter 标量），`presence: "optional"`，`valuePattern` = 非空标量（不改写散文内容，仅换承载形态）；登记 anchor 由「`Issues（收口时关闭）` 头部 bullet」改为 `issues` 键名。**迁移集实测：该行今日 0 条**（唯一的 historical single-spec 已随四族清理删除 · `git show dd5bed94^` 可见原形）——即本 phase 的脚本改写分支必须存在但当前 corpus 命中为 0，AC 不作非零计数卡口，改由单元用例（构造一条旧形 `Issues` 头行 → 迁移后落 `issues:` 键）钉住。
- **收编键全集（本 phase 登记表新增/改名的头部事实 · 逐条给 presence 与值形状）**：

  | key | 归属文档型 | presence（**逐型，不按「四型」一刀切**） | valuePattern（YAML 标量形态） | 来源 |
  |---|---|---|---|---|
  | `title` | 四型 | 四型 required | 非空标量 | 原 `# Title` 行 |
  | `doc-type` | 四型 | 四型 **required** | 原 `DOC_TYPE_VALUES` 元组 | 原头部 bullet（§2.3 首条） |
  | `version` | 四型 | 四型 required | `^v\d+\.\d+$` | 原 `**Version**` 行（拆出 date） |
  | `date` | 四型 | 四型 **required** | `^\d{4}-\d{2}-\d{2}$` | 原 `**Version**` 行的日期半 |
  | `status` | overall · phase-spec · single-spec | 三型 required · **plan 缺席**（无该键，非 optional） | 原枚举元组（按型） | 原 `**Status**` 行 |
  | `author` | overall · phase-spec · single-spec | 三型 required · **plan 缺席**（无该键，非 optional） | 非空标量 | 原 `**Author**` 行 |
  | `spec` | plan | required | 非空标量（target 路径） | 原 `**Spec:**` 行 |
  | `parent-program` | plan · phase-spec | required | 非空标量（target 路径） | 原 `**Parent program**` 行 |
  | `parent-version` | plan · phase-spec | optional | `^v\d+\.\d+$` | 原 `**Parent program**` 行的 token（§2.1） |
  | `depends-on` | plan · phase-spec · single-spec | 按今日（plan optional · phase-spec required · single-spec required） | 非空标量 | 原 `**Depends on**` 行 |
  | `base` | plan | optional | 非空标量 | 原 `**Base**` 行 |
  | `issues` | single-spec | optional | 非空标量 | 原 `Issues（收口时关闭）` 行 |

  其中 `date` · `doc-type` · `parent-version` · `issues` 是 §2.1/§2.3 首次成为机器事实的四项；`presence` 逐项逐型如上表（`doc-type` 定为 **required**——它是引擎自身 doc-class 判别的事实，optional 会让「无声明」与「未填」不可分）。

- **`status` / `author` 在 plan 侧缺席是今日事实，不是新收窄**：`declare.ts` 的 plan 头部集实测为 `# Title` · `**Spec:**` · `**Parent program**` · `**Version**` · `**Depends on**` · `**Base**`，无 Status / Author 两行；磁盘 9 篇 plan 的上述两行计数均为 **0**，而 11 篇 spec（1 overall + 10 phase-spec）各 **2** 行。故 plan 的 front-matter 键集就是 §2.1 示例与 §4.2 发射清单里的 **9 键**（`title` · `doc-type` · `version` · `date` · `spec` · `parent-program` · `parent-version` · `depends-on` · `base`），**不含** `status` / `author`。若把两键写成 plan required，则 9 篇 plan × 2 = 18 个无值来源的必填键：既破 §5.1 的「迁移前后 finding 集合逐条同集」与「在册语料零 finding」，也破 §4.2 的骨架合成（required 键必须有值来源），还会把 `declare.test.ts` 的 `Required<RegistryElement>` 五字段守卫压到 plan 从不填充的元素上。
- **本表与 §5.1 的 129 标量算术互相对账**（表即权威，算术只是它的合计）：`version` 20 + `date` 20 + `status` 11 + `author` 11 + `parent-program` 19 + `depends-on` 13 + `spec` 9 + `base` 2 + `parent-version` 4 + `doc-type` 20 = **129**。`status` / `author` 各 11（只有 11 篇 spec 产出该键）正是「plan 缺席」的直接算术后果——任何把两键改成「四型 required」的读法都会令合计变成 147 并与 §5.1 冲突。
- **元素数带上限（重算式）**：`overall-spec` 今日 39 元素（`declare.ts:171-460`），`contract/__tests__/declare.test.ts:55`（同文件 `:54` 是 `MIN_ELEMENTS = 20`，`:55-96` 是 `MAX_ELEMENTS` 的声明与断言区）的 `MAX_ELEMENTS = 40` 是既有守卫。本 phase 的净变化按 **39 − 1 + 2 + date + doc-type = 42** 计：`−1` = 退休 `**Constraints**` 头部行；`+2` = §2.4 的成对新增（`## Constraints` section 行 + `Constraint delta bullet` body anchor）；`+1` = `date`；`+1` = `doc-type`。**不是** §2.4 之前的「net 0」读法——那是只算 section 行、漏算 body anchor 的旧算式，与上一轮新增的成对声明不一致。**42 → 越 40 上限 2**。故本 phase 同批把 `MAX_ELEMENTS` 由 40 上调至 **44**（四条新增头部事实 `date`/`doc-type`/`parent-version`/`issues` 的最大落点余量 + 成对 Constraint 元素），理由记入该常量注释：头部 schema 字段化后 overall 的声明面自然增长，band 上限是「声明面规模守卫」而非精确值，上调不放松 MIN 侧。**四型逐型重算（与 `MAX_ELEMENTS` 同句对账，实测基数为 `declaredRegistries` 今日值 39 / 28 / 25 / 13）**：`overall-spec` 39 − 1（退休 `**Constraints**` 头部行）+ 2（`## Constraints` section 行 + `Constraint delta bullet`）+ `date` + `doc-type` = **42**；`plan` 28 + `doc-type` + `date` + `parent-version` = **31**（plan 无 `status` / `author` / `issues`，故只加三）；`phase-spec` 25 − 1（退休 `Depends on ref`）+ `doc-type` + `date` + `parent-version` = **27**；`single-spec` 13 + `doc-type` + `date` + `issues` = **16**（三者中 `issues` 为 optional，但 registry 计元素不按 presence 折扣——plan 的 optional `depends-on` / `base` 今日同样计数）。四型全部 ≤ 44（44 是上限里 overall 的余量基准，其余三型的实际落点如上）。`single-spec` 仍走 lightweight 豁免：**16 < MIN 20**，豁免成立且离下界尚有余量；single-spec 的 `## Constraints` 今日只有 section 行、无 `Constraint delta bullet`，本 phase 不为它补。
- 收编后头部元组事实**全部在册**（登记表 = 唯一声明根 · D26 成立）。

#### 2.4 Constraints 归一

`**Constraints**` 今天仅在 **overall** 是头部 bullet；plan / phase-spec / single-spec 均已是 `## Constraints` 正文 section。**统一为正文 section**——head 不含 Constraints。一致性修正（六前提③④）。

归一必须同时覆盖**登记表**与**骨架渲染**两侧，否则 overall 的骨架会漏吐自己声明为 required 的 section：

- **登记表（两行，不是一行）**：`declare.ts:202-207` 的 overall `**Constraints**` 头部行退休；overall registry 新增
  - `anchor: "## Constraints"`（`presence: "required"` · `valuePattern: "^## Constraints$"` · `home: "section"`），位置按今日 plan/phase-spec/single-spec 的同类行（`declare.ts:511` / `:774` / `:940`）——**插在 `## Boundary rules` / `## Maintenance` 之间**（overall 今日声明序的 `:252` 与 `:259` 之间）；
  - `anchor: "Constraint delta bullet"`（`presence: "required"` · `valuePattern: "^- "` · `home: "section"`），镜像 plan 的成对声明（`declare.ts:511-523`）——**这是骨架体的 body anchor，必须先在册**。overall 今日只有 `**Constraints**` 一个 Constraint 名元素，`Constraint delta bullet` 在 plan（`:518`）与 phase-spec（`:781`）有、overall 与 single-spec 无。
- **骨架渲染（两行登记齐备后才合法）**：`#renderOverallSpec`（`render/skeleton.ts:154-166`）今日合成的是 Document scope / File paths / Program charter / Issue inventory / Phase inventory / Dependency graph / Boundary rules / Maintenance / Change history——**无 Constraints**（plan `:176-183` / phase-spec `:222` / single-spec `:245` 都有）。本 phase 在该方法内补一个 `this.#section("## Constraints", ["- :fill constraint"], probe, "Constraint delta bullet")`，**插在 `## Boundary rules`（`skeleton.ts:163`）与 `## Maintenance`（`:164`）之间**，与登记表插入点同序。**前置条件是上面第 (b) 行**：`#section` 的 varargs 逐个 `probe.add(anchor)`（`skeleton.ts:310-317`），而 `#assertConsumed`（`skeleton.ts:130-144`）对任何不在 required 槽集内的 probe 抛 `skeleton composition emits the unregistered anchor: …`。只加 `## Constraints` 不加 `Constraint delta bullet`，overall 骨架即无法渲染——正是 §4.2 `#assertConsumed` 收窄要防的那类缺陷。
- **自检 pin（AC 必须显式点名，防 plan wave 静默丢行）**：渲染四型骨架并断言 `#assertConsumed` 不抛——`render/__tests__/skeleton.test.ts:413-417` 已对四型全覆盖（`expect(() => renderOf(key)).not.toThrow()`），本 phase 不改其用例体，只需在注释里点明它同时是 overall Constraints 三处同序的 tripwire。
- **语料侧**：迁移脚本把 overall 的 `- **Constraints**:` 及其缩进续行块整体搬为 `## Constraints` 的正文 bullet，**落位 = `## Boundary rules` 与 `## Maintenance` 之间**（与登记表插入点、骨架合成序三处同序——`OrderInvariant` 判 section 声明序，落错位即 order finding）。**续行搬移必须剥离两个前导空格**（10 行，`overall.md:8-17`）——否则 `Constraint delta bullet` 的载体 `^- ` 一行都不命中，见 §5.1「元组键续行」的裁定与验收。

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

- `render/skeleton.ts` 的 `HEADER_FORMS` 硬编码（`:32` · `"- **Version**: v0.1 · {date}"` 等）· `LINK_SLOTS`（`:45`）· `TRUTH_LINES["**Status**"]`（`:59`）· `#headerLine` 的 Status 分支（`:287-289`）——**后两者是生产头路径上最后两个 `**Status**` 形字面量**，漏列则「grep 完成度检查」可在字面量存活时通过（review-6 nit ⑤d）。
- `contract/doc.ts` 的 header-line 提取（`headerLines` / `HeadingBlock` 头部腿）。**逐项点名死成员，让 grep pin 能覆盖**：`markerLine`（`:449-452`）与其唯一调用家族（三个 `chainRoot` 的 `doc.ts:615/617/619` · `:694/696` · `:733`）· `markerValue`（`:455-459`，同族；调用点 `:626` / `:703` / `:740`）· `headerLines` 本身（生产者 `:363` 与四个 `parse` 消费点 `:502/602/641/720`）——它最后剩下的读者是 `invariants.ts:1239` 的 `#parentLineage`，该判改读 `head.version` 后 `headerLines` 零消费，整链退休。`linksOnLine`（`:245-252`）**不在此列**（§2.1 的链接原语保留）。
- **`ParsedDoc.title` 的四个 `lines[0]` 读取点**：`doc.ts:500`（overall）· `:600`（plan）· `:639`（phase-spec）· `:718`（single-spec）四处 `const title = lines[0] ?? ""` 一并退休——H1 删除后首行是 `---` fence，实测对迁移形态的 plan 解析得 `title: "---"`、`headerLines: ["", "- a", ""]`，而该字段的 doc comment 明写「the `# Title` line verbatim」（`:131` / `:181` / `:210` / `:221`），四份注释同步改写。**替换通道 = `FrontMatterExtractor` 的 `title` 标量**（`ParsedDoc.title` 的形状不变，仍是字符串）。回归 pin：`contract/__tests__/doc.test.ts:147` 现断言 `parsed.title === "# 文档架构方法论 v2 — 测试 Overall"`，改锚到 front-matter 头形态，断言 `parsed.title` 等于 head 的 `title` 值且**不等于** `"---"`。
- **`#phaseId` 的手抄文法（`:576`）**：`row.find((cell) => /^P\d+(\.\d+)*$/.test(cell.trim()))` 是 `Phase id token` 元素已声明 `valuePattern`（`declare.ts:358-362`）的字面副本——属同一「声明再抄」类，改写为读 `sliceOf("Phase id token")?.valuePattern` 判各 cell（与 `sectionConforms` `:474-478` 应用已声明形状的形态同构），`^P\d+(\.\d+)*$` 字面只留在登记表一处（§6 结构 pin 退役集的第 7 条）。
- `face/board-view.ts#headerLinesOf`（`:641`） / `#docTypeOf`（`:655`）的头部行扫描；`readHeader`（`:176-183`）内的 `**Status**` / `**Version**` 两条裸读（改读 typed head record，见 §2.3）。
- 头部 anchor 的 RegExp 编译（`project.ts#projectDocSlices` `:448-461` 对 header 腿）。
- **头部「裸行」版本读点**（§1.3 · §2.2）：`invariants.ts:944` `#headerVersion` 的 `anchorLines(ctx,"**Version**")` 扫描 · `invariants.ts:1236-1250` `#parentLineage` 的 `headerLines` 扫描 · `face/gate.ts:161-169` `#docVersionOf` 的 `- **Version**:` 行扫描——三处裸行扫描全删，改走 front-matter 标量。
- **标签漂移判**（§2.1）：`invariants.ts:1166` Class-A label==basename 判 · `lint.ts:234-242` `#crossDocDriftWarns` Class-B label↔basename 漂移判——标量形态下退化为恒真，一并退休。**pin 两文件同批改（不只产线两处点名）**：`contract/__tests__/lint.test.ts:225-267`（Class-B 漂移 describe 三用例，含 `:239` `field === "**Parent program**"`）· `contract/__tests__/judge.test.ts:623-632`（`withKind(findings, "cross-doc-chain", "**Spec:**")`）——这两份断言敬的是「漂移会产 finding」，退休裁定时必须同批改写为「漂移不再产 finding」（见 §6 退休 pin 的行为断言），否则落地即「登了退休、套件却断言漂移存在」的自相矛盾红。
- **`ChainLink.label` 字段整面退休（不是只退接口）**：`ChainLink`（`contract/doc.ts:98-103`）塌缩为只带 `target` 的值对象（或直接退化为 `string`）。生产点 `#linksOnLine`（`doc.ts:244-252`）与它的全部调用者同批改：`invariants.ts:1003-1020` 的 `chainLinks`（overall 的 Phase-inventory design/plan cell 也由它造 link，供 file-existence / sibling-scan 用，与两条漂移判无关）· plan 腿的 `data.chain.specLink` / `parentLink`。**两处漂移判的退休是这条改动的后果，不是它的全部范围**——只退接口而留 `linksOnLine` 产 label，仍是一处无消费者的死字段。
- 全部删除，零残留（grep pin）。

#### 4.2 骨架渲染器改吐 front-matter 头

- `SkeletonAssembler` 头部段改吐 front-matter（`yaml.stringify`）——字段按四型注册表的 front-matter-home 槽位序输出：`title` 为填槽、`version`/`date`/`status`/`doc-type` 为 generator-truth（`doc-type` 取装配器自身的 `#docType`）、`author`/`spec`/`parent-program`/`depends-on`/`base` 为填槽、`parent-version` **不发射**（optional shape-typed 键，见下条占位符约定；消费者按需自填）。
- **front-matter 值的占位符约定（必须显式定，否则骨架「by construction 绿」落空）**：front-matter 头不走 probe 集，故没有任何 `:::fill` 残余断言能落在头上——`skeleton.test.ts:307-315` 只断言整篇 `rendered` 出现过 `/:::fill \S+/`，`:390-399` 的 `STRUCTURE_LINES` 也没有 front-matter 行。于是占位符形态不写明，骨架就可能吐一个过不了自身 `Contract.validate` 的头。本 phase 定：
  - **link 型键**（`spec` · `parent-program`）→ 发 `<…>` 形态（`<spec path>` / `<parent path>`），令 `invariants.ts:1037-1042` 的 `isPlaceholder` 豁免链（`/^<[^>]+>$/`）原样生效：file-existence / sibling-scan 不对骨架的占位目标判存在性。
  - **content 型键**（`title` · `author` · `base` · `depends-on`）→ 发 `:::fill <slot>` 形态，与 body 的填槽词法一致（同一套消费心智：`:::fill` 就是「待填」）。这两类形态的选择依据是 `isPlaceholder` 的实际豁免面——它只认空串 / `Pending` / `[Pending]` / `<…>`，**不认** `:::fill …`，故 content 键不能用 `<…>`（会被当真实值判 domain）。
  - **`parent-version` 是第三类：shape-typed truth-or-fill，且不进骨架的 front-matter 行集**。它既不是 link 型（无 `<…>` 豁免语义——它的值不是路径），也不是 content 型（`:::fill parent-version` 与 `<parent version>` **两种形态都过不了**已声明的 `^v\d+\.\d+$`：`isPlaceholder` 不认 `:::fill …`，`/^v\d+\.\d+$/` 也不认 `<…>`——任一形态都会在 plan / phase-spec 骨架上落一个 `domain` finding）。裁定 = **省略**：`parent-version` 是 `presence: "optional"`（§2.3 收编表），optional 键无槽位义务——与本节对 `base` / `depends-on` 的论证同构（可选键不因骨架缺席而红）。骨架不发射该键，值由消费者在给定 parent overall 版本时自行填入；若将来改为发射，必须发**形状合法字面量**（如 `v0.1`，与脚手架版本一致）而非 fill 占位，并在此处记明它为何同时逃逸两类占位约定。
  - 实测校验（本轮现跑）：`yaml.stringify` 对上述两类值均产出裸标量，`yaml.parse` 逐个回读一致（`title: :::fill title` · `spec: <spec path>`），无引号化副作用。
- **新增 pin（补上今天缺的那条）**：渲染后对骨架字节跑 **`Contract.validate` 并断言零 finding**——本轮实测四型骨架现均为 **0 finding**（`overall-spec` / `plan` / `phase-spec` / `single-spec` 各 0），所以这是个可达且必须保持的基线，不是新造的红线。同时把 `skeleton.test.ts:307-315` 的 `:::fill` 残余断言与 `:390-399` 的 `STRUCTURE_LINES` **扩到 front-matter 块**（`---` 之间的行）：truth 键（`doc-type` · `version` · `date` · `status`）不得含 `:::fill`，content 键必须含。
- **`doc-type` 与 `base` 必须在册**：`doc-type` 是引擎自身 preflight（`session/preflight.ts:205` 的 doc-contract 门）赖以判别文档类的声明——骨架若漏吐它，则产出的骨架过不了自己的门（`render/__tests__/skeleton.test.ts:464-470` 的 self-preflight pin 即钉此）。今日它在 `render/skeleton.ts:268` 作为 `- **Doc type**: <key>` 结构性行紧跟在 Version 行后发射，且 `:254-262` 的类注释把它写成「deliberately NOT a registered slot … composed structurally and never probed」——front-matter 化后该理由作废：`doc-type` 进登记表（§2.3），骨架按 front-matter 键发射。**该注释为同批编辑点**，随改动重写。自检 pin（`render/__tests__/skeleton.test.ts:464-482`）**用例体不改**——它已通过 `BoardView.readDocType` 读回，而该 reader 本 phase 改为读 front-matter `doc-type`，故 pin 自动覆盖新通道；只需在用例注释里把「Doc type line」的表述同步为 front-matter 键（断言本身零改：仍须 `readDocType(skeleton) === key` 对四型全成立）。**与之相邻的另一条 pin 必须改写，不能混为一谈**：`skeleton.test.ts:452-462` 断言字面行 `- **Doc type**: <key>` 存在、且紧跟在 `- **Version**: ` 行之后——front-matter 化后两行都不存在（`indexOf` 返回 −1），该用例**必须重写为读 front-matter 的 `doc-type` 键**，并保留「键位序」断言（`doc-type` 与 `version` 在 front-matter 块内的相对次序）。§4.2 的「pin 稳定」只对 `:464-482` 成立，`:452-462` 属**必改集**。`base` 是 plan 的既有注册字段（`declare.ts:503-508`），同按 front-matter 键发射。
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
- **迁移面还包括引擎自身的测试夹具与两处生产字面量（不是只有 21 篇文档）**：登记表把 `**Version**` 翻成 `version`、三处裸行读点改走 front-matter 后，每一个 bullet 头夹具都会同时失效。**census 方法 = bullet 字面量 grep，故编辑面必须再加一类「不含 bullet 字面量、但按旧 anchor token 断言」的文件**（这类文件对上面的 grep 不可见，漏列即交付一棵过不了 typecheck 的树）：
  - **第一类 · bullet 字面量夹具（grep 可见）**：实测 `grep -rn --include=*.test.ts -F -- '- **Version**:'` = **44 行 / 9 个测试文件**（`doc.test.ts` 3 · `judge.test.ts` 11 · `lint.test.ts` 1 · `board-view.test.ts` 9 · `capsule.test.ts` 2 · `cli.test.ts` 5 · `skeleton.test.ts` 9 · `smoke.integration.test.ts` 2 · `preflight.test.ts` 2）；`- **Doc type**:` 夹具 = **77 行 / 5 个测试文件**；**第三线 · 其余登记头字面量族**（`**Spec:**` / `- **Parent program**:` / `- **Depends on**:` / `- **Base**:` / `- **Status**:` / `- **Author**:`）：`grep -rlE --include=*.test.ts '\*\*Spec:\*\*|- \*\*Parent program\*\*|- \*\*Depends on\*\*|- \*\*Base\*\*|- \*\*Status\*\*|- \*\*Author\*\*'` = **14 个测试文件**，三线并集 = **14**（Version 线 9 ⊂ 并集）。**Version/Doc-type 两条 census 结构性看不见 4 个 plan 夹具**——它们只带 `**Spec:**` + `- **Parent program**:`、零 `- **Version**:` 行：`render/__tests__/render.test.ts:332-333` · `session/__tests__/graph.test.ts:27-28` · `session/__tests__/run.test.ts:56-57` · `session/__tests__/wave.test.ts:48-49`（各喂 `PlanDocType` parse，其 chain 字段随 head record 迁移；漏列即交付「登记表已改、套件全红」的半态）。
  - **第二类 · anchor token 断言（grep 不可见 · 必须单列）**：`contract/__tests__/declare.test.ts:41-52` 持有一份**本地 `HOME_VALUES` 副本**（`as const satisfies readonly Home[]`），内含 `"header"` 且在 `:113` 断言 registry 的 `home` 落在其中——§3.1 把 `"header"` 从 `Home` union 移除后，该字面量**不再满足类型**，`tsc --noEmit -p packages/cdd-engine` 失败（这是 typecheck 失败，不只是用例失败）。该副本是**刻意的第二份声明**（与 `declare.ts` 的 `HOME_VALUES` 并存），改法二选一须在 plan wave 显式裁定：改名 `"frontmatter"`（保副本）或改为从 `declare.ts` 导入（消副本）。`contract/__tests__/project.test.ts` 同样按旧 bullet anchor 断言：`:185` `anchorPattern.source === "# Title"` · `:187` `"\\*\\*Version\\*\\*"` · `:310-327` 的 `**Spec:**` / `**Parent program**` 判 `link` slot（含 `:318` 的 `expect(element?.home).toBe("header")`）· `:347-360` 的 `**Status**` 判 `generator-truth` · `:362-375` 的 `**Version**` 判 `scaffold` · `:377-386` 的 `truthAnchors`（content 槽自由态断言，其内的 `"**Status**"` 同属字面量）——**五组**断言全部改锚到 key 形态（或改写为对 `declaredRegistries` 的派生断言，从此不再重打 anchor 字面量）。
  - **第三类 · 生产字面量（2 处）**：`face/gate.ts:164` 的 `line.trimStart().startsWith("- **Version**:")`（`:1` 只是路径注释，**无需编辑**）· `render/skeleton.ts:32` 起的 `HEADER_FORMS` 表（其 `:34` 的 `"**Version**": "- **Version**: v0.1 · {date}"` 条目），两者都在 §4.1/§2.2 的退休名单上。
  - 故本 phase 的编辑面 = **21 篇语料 + 上述 bullet 字面量测试文件（三线并集 14 个，含 4 个仅 `**Spec:**`/`- **Parent program**:` 的 plan 夹具：`render.test.ts` · `graph.test.ts` · `run.test.ts` · `wave.test.ts`）+ 2 个 anchor-token 测试文件（`declare.test.ts` · `project.test.ts`）+ 2 处生产字面量**，与登记表改动同批落盘。漂移判与 finding 面字面量散布的 `judge.test.ts` · `lint.test.ts` · `doc.test.ts` · `cli.test.ts` 已在上述并集内，其断言重锚见 §4.1（标签漂移判）· §5.2（finding 面）· §6（退休 pin 行为断言与 finding 面 grep）。
  - **`session/__tests__/preflight.test.ts:120-149` 的 `CONFORMING_SPEC` 逐条点名**（数组在 `:149` 的 `].join("\n")` 收尾）：它以 bullet 元组原样构造一份「零结构 finding」的 phase-spec，是本 phase 后最先红的一份夹具——同一批改成 front-matter 头 + `## Design` 起始的正文。
  - **`contract/__tests__/doc.test.ts:147` 的 `parsed.title` 断言**（§4.1）已列在替换通道内：改锚到 front-matter 头形态。
  - **夹具改写不是「顺带」而是迁移定义的一部分**：`§1.3` 冻结的是**判定语义**，不是夹具字节；夹具若留在旧形态，本 phase 交付的是「登记表已改、套件全红」的半态。
- **发射规则 = 一律 `yaml.stringify`，零字符串拼接（硬要求）**：语料里存在非法裸标量，直接用 `key: <value>` 拼串会**硬解析失败或静默截断**，后者对任何 `##` section 级断言都不可见。以仓库自带 `yaml@2.9.1` 实测。**迁移集当前 20 篇的头部元组行 106 条**（Version 20 · Doc type 20 · Status 11 · Author 11 · Constraints 1 · Parent program 19 · Depends on 13 · Spec 9 · Base 2），对应 **129 个 front-matter 标量** = `version` 20 + `date` 20（Version 行一拆二）+ 其余 85 条各 1 + `parent-version` 4；`Constraints` 1 条退休为 section、产 0 个：
  - `author:` 以 `[` 起首的值 **3 处** → `Unexpected scalar at node end`（硬失败）；
  - `parent-program:` / `spec:` 仍为 markdown 链接形的值 **28 处** → `Nested mappings are not allowed in compact mappings`（硬失败）——正是 §2.1「只存 target 标量」要消除的形态，但**迁移脚本必须先把 `[label](target)` 拆成 `target` 再发射**，不能原地搬字面；
  - 历史全库（清理前）另有 6 篇 title 含 ASCII `": "`、4 篇 `Depends on` 含 `" #"`（静默截断）、1 篇 `Issues` 以 `#302` 起首（整行读成注释 → `null`）——迁移集今日 0 处，但脚本规则按**通用**写（不按当前数据特判）。
  - **规则**：所有 head 值经 `yaml.stringify` 发射（与 §4.2 骨架同一引擎）；**回环断言** `yaml.parse(yaml.stringify(head))` 与原 head record 深相等，逐篇跑；并对上述三类形状保留计数卡口（`[` 起首 **3** · 链接形 **28** · 截断类 **0**），迁移后各自 shape 正确且值不丢字节（link 形例外：按 §2.1 只保 target，label 主动退休）。
- **非元组头部 bullet 的处置（迁移不可静默丢弃）**：清理后迁移集的头部**非元组 bullet 实测为 0**（清理前 14 篇 / 18 条的样本已随四族删除消失；`Issues（收口时关闭）` 的唯一历史实例亦在其列）。规则仍须写在脚本里并按通用形态实现：
  - 非登记 bullet → **逐字节原样保留**，紧随 front-matter fence 之后、首个 `##` 之前（不搬进 section、不改文案）；判定语义对这些行零依赖（不在册即不判），但作者写下的约束不丢。脚本只改写登记元组对应的键，其余头部行一律透传。
  - `Issues（收口时关闭）` → 收编形态改写（§2.3 的 `issues` 键）。
  - **验收**：迁移前后「非元组头部行集合」逐行 `diff` 零差异；当前计数卡口为 **0 条 / 0 篇**，非零即视为语料漂移须人工裁定；`issues` 改写分支由单元用例覆盖（构造一条旧形头行，断言落地为 `issues:` 键）。
- **元组键的续行随键搬移（overall `**Constraints**` 块）**：`- **Constraints**:` 在 overall 下挂缩进子 bullet 续行——迁移集实测 **10 行 / 1 篇**（`2026-10-10-engine-doc-tooling-overall.md:8-17`；清理前的另三篇 overall 已删），**全部以两个空格起首**（`  - **…`）。§2.4 退休该键，故这 10 行**整体搬为 `## Constraints` 的正文 bullet**，落位见 §2.4。
  - **缩进显式剥离（逐字节与 `^- ` 载体的冲突必须在此裁定，不留隐式）**：§2.4 新增的 `Constraint delta bullet` 声明 `valuePattern: "^- "`，`PresenceInvariant` 经 `occurrenceLines`（`invariants.ts:177-179`）→ `lineCarries`（`:167-169`）判**原始行**、不做 `trimStart`；`^- ` 对 10 行缩进行全部不命中。故「逐字节原样搬」会让唯一一篇 overall 落一个**必然的 presence finding**（§6 的「finding 集合逐条同集」与本节 AC 同时失效）。本 phase 裁定：**搬移时剥离每行的两个前导空格**（`  - **…` → `- **…`，行内文案字节零改、顺序零改），令 `^- ` 载体成立；不采用「放宽 `valuePattern` 为 `^\s*- `」——那会把缩进容忍面同样扩散到 plan / phase-spec 的同名元素，把一条本该收紧的格式契约变成松的。
  - **验收**：续行块计数卡口 **10 行 / 1 篇** + 搬移前后该块**逐行 `trimStart()` 后字节 diff 零差异**（文案不变、仅剥离缩进）+ 迁移后 overall 的 `## Constraints` 体行**全部命中 `^- `**（新增 pin）。上一条「非元组头部行」规则只管非登记 bullet，盖不住这条，故单列。
- 迁移后引擎 `board` / `review` / `fix` 对在册文档判压全绿（`readDocType` 从 front-matter `doc-type` 读）；`全绿` 的范围 = 迁移时刻在册的 21 篇（见上第二条）。
- **一次提交**（头部形态迁移独立于实现 · Mid-Flight Backfill 纪律）。

#### 5.2 消费者面（major breaking · 自行迁移）

- 引擎是发布物；消费者仓已有旧格式文档。换格式后消费者升级引擎再跑 `cdd review` 会解析失败 → **major breaking · 零 legacy 兼容**（不做「读不到 front-matter 时回退旧 bullet 头」的双格式兼容——正是本程序要消灭的「两套头部模型」）。
- 消费者**自行迁移**（按迁移说明重写头部，或 `schema get … --output skeleton` 重吐头部）。
- 消费面 skill（cdd-spec-writer / cdd-plan）「先 gen 后填」纪律不变；skill 文本对头部形态的表述同步（不注入解析实现 · 守 D29）。**plan 头约定被 skill 文本与 pin 测试双重钉住，`words.ts:100-101` 同批编辑**：`packages/kairos/skills/cdd-plan/SKILL.md:44`（`**Spec:**` on line 2、紧接 `# Title`）· `packages/kairos/skills/cdd-report/SKILL.md:37`（workspace plan record → plan 头 `**Spec:**` → overall 的 program-attribution 第一跳）· pin 测试 `packages/kairos/tests/cdd-plan-spec.test.ts:30-39`（`author-plan` node body 断言 `/\*\*Spec:\*\*/` 与 `/line 2/`，并点名 `cdd-report` first-hop 依赖）。**改写目标 = `spec:` front-matter key**：H1 删除后「line-2-after-# Title」形态不存在，plan 头约定由 `spec:` 键承载（与 review 的 `--spec` 指针同源）；测试**重锚到 front-matter 措辞而非删除**——AC 要求 kairos suite 全绿，此 pin 与两个 skill 文本必须填入消费者面同步清单。
- **引擎自身的 BLOCKED 文案也必须同步（不止 skill 文本）**：`face/words.ts:100-101` 的 `routeWords.docType` 今日为「the doc declares no `- **Doc type**:` line — add `- **Doc type**: <…>` to the doc's header (spec §12) and re-run」，经 `session/preflight.ts:201` 与 `face/capsule.ts:125` 在 BLOCKED 路径发出（`face/__tests__/cli.test.ts:1971` · `capsule.test.ts:279` · `preflight.test.ts:443` 三处 pin）。它是**引擎输出**，不是 skill 文本，§5.2 的 skill 同步够不到它——若不同步，迁移后引擎会指导每个消费者去修一份**本 phase 正在退休的** bullet 头形态。**同一批编辑点**：`routeWords.docType` 改为 front-matter 表述（形如「the doc declares no `doc-type:` front-matter key — add `doc-type: <overall-spec|phase-spec|single-spec|plan>` to the doc's YAML front-matter and re-run」），并把三处 pin 文案同步重锚。**finding 面同批（`routeWords.docType` 只是引擎输出的一处，不是全部）**：`Finding.field` 的值本身就是 anchor 字面量（`invariants.ts:901/911/1022/1024/1030/1161/1170/1180/1199/1225` 全在 §3.3 改名表内），固定 message 内嵌 bold 头散文（`:903/913/1162-1163/1171/1181-1182/1200-1201/1226`），`PreFlight` 以 `kind@field: message` 原样发到消费者（`session/preflight.ts:219` → `face/cli.ts:689/693`）——这三面**必须同批键化**：`Finding.field` 值改为 front-matter key（或 key 派生显示形），固定 message 去掉 `**…**` 字面；断言侧另有 **24 处引号 anchor 字面量**散布在 `judge.test.ts` 15 · `project.test.ts` 5 · `doc.test.ts` 2 · `cli.test.ts` 1 · `lint.test.ts` 1（`withKind` / `slot.anchor` / field 断言），五文件同批重锚（均在 §5.1 编辑面并集内）。**message 文本 pin 保住并扩维**：任何头部形态相关 message 不再出现 bullet 头字面；生产面 grep 见 §6 形态 pin 的 finding 面 grep 条。
- **子代理 prompt 里的头部形态表述同属引擎输出（同一批编辑点）**：`render/templates.ts:325` 的 plan-review `axesGuide` 写着「the plan is judged against its design spec at `INPUT_SPEC` (the plan's `**Spec:**` anchor)」——`**Spec:**` 是本次退休的 bullet 头形态，这段文本会随 child prompt 发给评审代理。**同一批改写**为 front-matter 表述（形如「(the plan's `spec` front-matter target)」）。**pin 覆盖情况**：`face/__tests__/cli.test.ts:1780-1785` 只钉了 `INPUT_SPEC` 的**传值**（`- \`INPUT_SPEC\`: docs/…`）与「不含 `BASE_BRANCH`」，**没有**钉 `axesGuide` 的措辞；故改写不破现有 pin，但也无 pin 兜底——本 phase 不新增 prompt 文本 pin（`axesGuide` 是一段散文，逐字 pin 只会固化噪音），改由同批 grep 口径覆盖：迁移后引擎源码里 `the plan's \`**Spec:**\` anchor` 零命中。

### 6. 不变量与 pin

- **结构 pin（正向断言，不是负向 grep）· 两条互补断言**：`doc.ts` 内的**结构正则全部来自登记表声明**，不是「某个 `^#` 家族零命中」。
  - **(a) 退役集零命中**：本 phase 删除的 **7 条 anchor 结构性 / 手抄文法正则**逐条零命中——`:382` `^### Task (\d+):` · `:407` `^-\s+\*\*([A-Za-z ]+)\*\*:\s*(.*)$` · `:425` `^-\s+(.*)$` · `:676` `^### (\d+)\.\s+(.*)$` · `:683` `^#### (\d+)\.(\d+)\s+(.*)$` · `:459` `payload.replace(/^:\s*/, "")`（`markerValue` 同族，§4.1 死名单）· `:576` `row.find((cell) => /^P\d+(\.\d+)*$/.test(cell.trim()))`。旧 pin `grep -nE '\.match\(/\^#'` 只命中 `:382/:676/:683`，**漏掉 `:407/:425`** 两条——只改 `^#` 家族的实现能过旧 pin 而把 task-field / task-step 的结构知识留在手写态。
  - **`:576` 是必须单列的一处（手抄文法，pin 词表原本看不见）**：`#phaseId` 用 `/^P\d+(\.\d+)*$/` 判定 Phase-inventory 数据行的 id 单元——这是 `Phase id token` 元素已声明 `valuePattern`（`declare.ts:358-362`）的**字面副本**，正是本 phase 要消灭的「声明再抄」。它既不在 (a) 的原五条里，也不在 (b) 的保留原语里；更关键的是它用 `.test(`，**不命中旧 pin 的四个关键词**（`RegExp` / `.match(` / `.matchAll(` / `.split(`），所以只实现 (a)+(b) 的实现能在留下它的情况下让 pin 保持绿。**裁定 = 退休**：`#phaseId` 改为读 `sliceOf("Phase id token")?.valuePattern` 判各 cell（形态与 `sectionConforms` `:474-478` 对已声明 `valuePattern` 的应用同构），字面文法归登记表单源。
  - **(b) 保留集 = 声明式 allowlist（按集合断言，不按计数）**：`doc.ts` 内**全部正则 / 切分原语**（词表 = `RegExp` · `.match(` · `.matchAll(` · `.split(` · `.test(` · `.replace(`，**已扩维**）的命中集 **恰好等于**下列原语集，逐条给出 home 归属——不是「只剩 heading-rank + 表格 split 两处」：

    | 原语 | 今日落点 | home / 保留理由 |
    |---|---|---|
    | heading-rank `^(#+)\s` | `:481` | 全部 section/facet/design-body home 的公共秩原语 |
    | 表格切分 `split("|")` | `:278` | `table` home 的列切分（同一方法 `:276` 的分隔行判 `/^\|[\s:\|-]+\|$/.test(...)` 是同一原语的内联守卫，随行保留、不单列） |
    | 链接文法 `/\[([^\]]*)\]\(([^)]+)\)/g` | `:248` | `markdown-link` 原语——`#linksOnLine` 由 §4.1 保留为生产点（file-existence / sibling-scan 的输入面） |
    | 版本 token 文法 `/v\d+\.\d+/g` | `:261` | **§2.2 明确保留的单源**（`MarkdownPrimitives.versionTokensOf`；`face/gate.ts:161-169` 的 `#docVersionOf` 与 §2.2 的 `versionTokens` 同读它） |
    | 图边文法 `/^P(\d+(?:\.\d+)*)\s*->\s*P(\d+(?:\.\d+)*)$/` | `:539` | `graph` home 的边线原语（§3.2 列为 graph home keeper） |
    | 已声明 `valuePattern` 的应用 `slice.valuePattern.test(...)` | `:476` | 不是文法字面量——`sectionConforms` 消费登记表已声明的形状（`#phaseId` 改写后归此形态，**落点由 1 处变 2 处，仍属同一原语**） |

  - 今日实测（扩维词表 `grep -nE 'RegExp\|\.match\(\|\.matchAll\(\|\.split\(\|\.test\(\|\.replace\(' contract/doc.ts`）= **14 命中**：`:248` `:261` `:276` `:278` `:382` `:407` `:425` `:459` `:476` `:481` `:539` `:576` `:676` `:683`。(a) 的 **7 条退役集**（`:382 :407 :425 :459 :576 :676 :683`）与 (b) 的 **7 条保留集**（`:248 :261 :276 :278 :476 :481 :539`，表中 `:276` 折入 `:278` 行）**恰好互补、并集为全集 14 命中**——「每一条正则字面量都落到退役或保留之一，无第三种状态」由此可证。写成「⊆ {heading-rank, table split}」会让 pin 只在删掉 `:248/:261/:539` 后才绿，而这三条是本 spec 别处**要求保留**的，等于 AC 自证不可满足。
  - **(c) 断言形式**：保留集按 **集合相等**断言，且断言对象是**原语身份**而非行号（`new Set(hits)` 的每条命中都必须归入上表 6 条原语之一）——因为第 6 条原语在迁移后有两处落点（`:476` 的 `sectionConforms` 与改写后的 `#phaseId`），按行号集合断言会随改写漂移。不按命中计数：计数会把「换一条等价正则」误判为漂移，也会把「多一条无关正则」误判为通过。(a) 与 (b) 必须合在同一条用例里，否则单看 (b) 的实现可以在删光 `:407/:425` 的同时新增一条手写 `^-\s+\*\*…` 变体。**词表必须含 `.test(` 与 `.replace(`**：漏掉这两个关键词，`:576`（`.test(`）与 `:459`（`.replace(`）这两条手写文法对 pin 完全隐形——本轮实测即如此（10 命中而非 14）。**迁移后的期望形态**：保留原语落点 = `:248` `:261` `:276` `:278` `:476` `:481` `:539` + 改写后的 `#phaseId`（归第 6 条原语），退役 7 条全部消失——pin 按「每条命中都归入 6 原语之一」判，不硬编码改写后的行号。
  - **(d) 登记表侧**：**header-home anchor 集 = key 形态集**（不是「含 `frontmatter` + `doc-type` + `issues` 就算过」）：该 pin 断言四型 registry 中 `home === "frontmatter"` 的 `anchor` 全集 ⊆ §3.3 改名表的 key 集（`title` / `doc-type` / `version` / `date` / `status` / `author` / `spec` / `parent-program` / `parent-version` / `depends-on` / `base` / `issues`），且**不含任何 bullet/heading 字面量**（`**…**` 与 `# ` 前缀零命中）；`Depends on ref` 在 `declare.ts` 零命中（§3.3 退休）；退休判零残留 pin 从「生产符号 grep 零命中」**升级为行为断言**：`invariants.ts` label==basename 判 · `lint.ts#crossDocDriftWarns` 生产符号 grep 零命中之外，`contract/__tests__/lint.test.ts:225-267` 的 Class-B 漂移三用例与 `contract/__tests__/judge.test.ts:623-632` 的 `cross-doc-chain` 漂移用例改写后**各自断言零 finding**——漂移判退休后 drift 不再产 finding；符号消失但判据残留（旧用例仍断言漂移产 finding）的中间态过不了这条。
- **形态 pin（定型 grep 形式 · 与 §5.1/§5.2 的 census 同形，不可真空通过）**：四类文档头部元组全在 front-matter——`grep -rnE '^\s*-?\s*\*\*(Version|Status|Author|Spec:|Parent program|Depends on|Base|Constraints)\*\*:' docs/kairos/specs docs/kairos/plans` 期望**零命中**；**正面断言** = 逐篇迁移文档**首个非空行是 `---`** 且 `yaml.parse` 得到完整键集（无形式时「零残留」可因只数线起始行而真空绿、或因正文散文误报红——两条必须同列）。**两侧计数可见漂移**：今天 `docs/kairos` 全树该 anchor 族共 **222 处** = **106 行线起始头部行**（§5.1 tuple census：97 行 `- ` 前缀行 + 9 行 plan 裸 `**Spec:**`）+ **116 处正文散文/code-span 提及**——上述形式的线起始命中今天为 77 行（8 键 dash 行；`Doc type` 20 行与裸 `**Spec:**` 9 行由 §5.1 三条 census 计数与回环断言覆盖）；迁移后头部行 → 0、正文提及保持 116。正文 H1 零残留；front-matter 块内 `yaml.parse` 零错误（迁移脚本的回环断言进 engine suite 后逐篇跑）。**finding 面 grep pin（§5.2 同步，限定非测试生产文件）**：`grep -rnE '\*\*(Version|Status|Author|Spec:|Parent program|Depends on|Base)\*\*' packages/cdd-engine/src-next --include='*.ts'`（排除 `__tests__`）期望退役/改写清单之外的**零命中**——今日实测 **101 命中 / 11 个生产文件**（登记表 anchor · `doc.ts` marker 族 · `Finding.field` · 固定 message · `skeleton.ts` 的 `HEADER_FORMS`/`TRUTH_LINES`/`#headerLine` · `words.ts` · `templates.ts`），全部落在 §3.3/§4.1/§4.2/§5.2 的退役与改写清单内。**Constraints 载体 pin（§2.4 / §5.1 的缩进裁定落地断言）**：迁移后 overall 的 `## Constraints` 体行全部命中 `Constraint delta bullet` 的声明载体 `^- `（无一行残留两个前导空格）。
- **`INPUT_SPEC` 保活 pin（head-required 调用点的行为断言 · §2.2）**：plan-review 轮上下文的 `INPUT_SPEC` 仍解析为 plan 的 `spec` 目标——载体即 `face/__tests__/cli.test.ts:1785` 与 `:1819`（两处均断言 `- \`INPUT_SPEC\`: docs/kairos/specs/p3-design.md`），用例体不改、随 `face/cli.ts:773` 的双参 parse 迁移自动覆盖新通道。
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
- `doc.ts 手写 anchor 结构正则零命中（登记表 home 驱动提取器替换 · 含 #phaseId 手抄文法 :576 与 markerValue 的 :459）+ 保留集 = 6 条声明原语 / 7 个落点（heading-rank :481 · 表格 split :276+:278 · 链接文法 :248 · 版本 token 文法 :261 · 图边文法 :539 · 已声明 valuePattern 的应用 :476）按集合相等断言，词表含 .test( / .replace(（退役 7 条与保留 7 落点互补 = 全集 14 命中））`
- `登记表含 frontmatter home + 收编键全集（doc-type · date · parent-version · issues）+ 23 行 header anchor 改名落定 + Depends on ref 退休（无门事实归零）+ 收编键表逐型 presence（status / author 在 plan 侧缺席 · 合计 129 标量与 §5.1 对账）`
- `Constraints 归一为正文 section（overall 头部 bullet 零残留 · 登记表成对两行（## Constraints + Constraint delta bullet）+ #renderOverallSpec 合成位（Boundary rules 与 Maintenance 之间）+ 语料落位三处同序 · 续行 10 行剥两格缩进搬移（trimStart 后逐行字节 diff 零差异 · 迁移后体行全部命中 Constraint delta bullet 的载体正则可）· 四型骨架 #assertConsumed 不抛 · 四型元素数逐型落点 42 / 31 / 27 / 16（39−1+2+date+doc-type · 28+3 · 25−1+3 · 13+3）≤ MAX_ELEMENTS 44 · single-spec 16 < MIN 20 豁免成立）`
- `死头代码零残留（HEADER_FORMS · #headerLinesOf · #docTypeOf · readHeader 两条裸读 · header-line 提取含 markerLine/markerValue/headerLines 生产者 · ParsedDoc.title 四处 lines[0] · 三处裸行版本读点 · 两处标签漂移判 · ChainLink.label 及其 linksOnLine 生产点 · #phaseId 的 :576 手抄文法 · 引擎 BLOCKED 文案的 bullet 头表述 · render/templates.ts:325 的 `**Spec:**` anchor 表述）`
- `skeleton 吐 front-matter 头（yaml.stringify · 按 front-matter 行集发射 doc-type 与 base，不经 slot 通道 · 占位符约定：link 型键发 <…> 走 isPlaceholder 豁免、content 型键发 :::fill、parent-version 不发射（optional shape-typed 键，fill 与 <…> 两形都过不了 ^v\d+\.\d+$））+ body 骨架保留（#assertConsumed 覆盖域 = body slots · 骨架自身过 preflight · 骨架字节跑 Contract.validate 零 finding · :::fill 残余与 STRUCTURE_LINES 断言扩到 front-matter 块）`
- `本仓 21 篇文档全量迁移（迁移时刻在册：11 spec + 10 plan，含 p10 design/plan · 迁移前后 finding 集合逐条同集 · 在册语料零 finding（基线实测 20 篇 0 finding）· 版本血缘判 / 父血缘判 / presence / domain negative-case 仍触发 · RAW 提取通道 positive-case · 非元组头部行 0 条（清理后实测）· overall Constraints 续行 10 行 / 1 篇搬移（剥两格缩进 · 文案字节与行序零改）· yaml 回环断言逐篇通）+ 引擎夹具同批迁移（bullet 字面量三线并集 **14 个测试文件**：44 行 Version bullet / 9 个测试文件 · 77 行 Doc type bullet / 5 个测试文件 · 其余登记头字面量族 14 个文件——其中 **4 个只带 `**Spec:**`/`- **Parent program**:` 的 plan 夹具显式在册**：`render.test.ts:332-333` · `graph.test.ts:27-28` · `run.test.ts:56-57` · `wave.test.ts:48-49` · **漂移判 pin 两文件** `lint.test.ts:225-267` / `judge.test.ts:623-632` 改写后断言零 finding · **finding 面 24 处引号字面量**（judge 15 · project 5 · doc 2 · cli 1 · lint 1）随 `Finding.field` 键化重锚 · anchor-token 断言类 2 个文件：declare.test.ts 本地 HOME_VALUES 副本改 frontmatter（或改为导入 declare.ts）且 tsc 通过 · project.test.ts 五组 bullet-anchor 断言（含 :377-386 truthAnchors）改 key 形态 · preflight.test.ts 的 CONFORMING_SPEC · skeleton.test.ts:452-462 重写为 front-matter 键序）`
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
| v0.5 | 2026-10-17 | **spec-fix-4（review-4 findings 收口 · 2 blocker + 4 warn + 2 nit）**：① blocker——§2.3 收编键表改**逐型 presence**：`status` / `author` 在 overall · phase-spec · single-spec 为 required、**plan 侧缺席**（实测 plan registry 六键头部集无此两行 · 9 篇 plan 各 0 行 · 11 篇 spec 各 2 行），并列 §5.1 的 129 标量对账（20+20+11+11+19+13+9+2+4+20），堵住「四型 required」与算术/§4.2/`Required<RegistryElement>` 守卫的三向矛盾；② blocker——§6 结构 pin 改为**两条互补断言**：退役 5 条 anchor 结构性正则零命中 + 保留集 = 5 条声明原语（heading-rank · 表格 split · `:248` 链接文法 · `:261` 版本 token 文法 · `:539` 图边文法）按集合相等断言（实测全集 10 命中，5+5 互补），废掉「⊆ {heading-rank, table split}」这条删掉 spec 明令保留的 `:248/:261/:539` 才可能绿的伪 AC；③ warn——§2.4 登记表补**成对两行**（`## Constraints` + `Constraint delta bullet`，同步 `#renderOverallSpec` 在 `skeleton.ts:163/164` 之间插位），并把 `#assertConsumed` tripwire（`skeleton.test.ts:413-417`）点名进 AC，元素算术重算为 `39 − 1 + 2 + date + doc-type = 42`（废「net 0」）；④ warn——§4.2 定 front-matter **占位符约定**（link 型键 `<…>` 走 `isPlaceholder` 豁免 · content 型键 `:::fill`）+ 新增「骨架字节过 `Contract.validate` 零 finding」pin（本轮实测四型各 0）+ `:::fill`/`STRUCTURE_LINES` 断言扩到 front-matter 块；⑤ warn——§2.2 补 **head record 三层投递缝**：`parse(lines, head?)` 可选第二参 + `ParsedDoc.head` + `JudgeContext.head`，并声明 chainDocs 生产者必须同形双参（否则 `#parentLineage` / `ParsedDoc.title` 无通道）；⑥ warn——§5.1 把**引擎夹具**纳入迁移面（44 行 Version bullet / 9 测试文件 · 77 行 Doc type bullet / 5 测试文件 · 2 行生产字面量），点名 `preflight.test.ts` 的 `CONFORMING_SPEC`，并把 §4.2 两条相邻 pin 拆开（`:464-482` 用例体不改 vs `:452-462` 必重写为 front-matter 键序）；⑦ nit——四处行号校正（`#docLine` 调用点 `:232/234/235` · `targetPath` 名与 `:1062-1072` · sibling-scan `:1089` · `#parentLineage` `:1236-1250`），并在 §1.3 补冻结的唯一例外（两处标签漂移判退休）；⑧ nit——§4.1 死名单点名 `markerLine`/`markerValue`/`headerLines` 生产者，§5.2 补 `render/templates.ts:325` 的 `**Spec:**` anchor 表述与 grep 口径 | Oscar M. · Claude Opus 5（kairos:cdd-design [P10] spec-fix-4） |
| v0.6 | 2026-10-17 | **spec-fix-5（review-5 findings 收口 · 2 blocker + 4 warn + 1 nit）**：① blocker——§2.2 的 `parse` 调用点清单改为**按「实际读什么」二分**：`face/cli.ts:773` 读 `chain.specLink` 并喂 `face/lifecycle.ts:312` 的 `INPUT_SPEC`，故列为 **head-required**（双参 parse + `FrontMatterExtractor`，pin = `cli.test.ts:1785` / `:1819`）；head-optional 清单补 `render/brief.ts:61` 并归为六处只读 `taskBlocks` 的点；② blocker——§5.1 元组键续行搬移**显式裁定缩进**：overall `**Constraints**` 的 10 行续行（`overall.md:8-17`，全部两格缩进）搬移时**剥离两个前导空格**（文案字节与行序零改），令 §2.4 新增的 `Constraint delta bullet` 载体 `^- ` 成立（`lineCarries` 判原始行、不做 `trimStart`），AC 改写为「`trimStart()` 后逐行字节 diff 零差异」+ 新增「体行全部命中 `^- `」pin，并说明不采用放宽 `valuePattern` 为 `^\s*- ` 的理由；③ warn——§4.2 把 `parent-version` 显式列为**第三类 shape-typed 键**并裁定**不进骨架 front-matter 行集**（optional 无槽位义务；`:::fill` 与 `<…>` 两形都过不了 `^v\d+\.\d+$`，任一形态都会落 domain finding）；④ warn——§2.3 元素数带补**四型逐型重算**（39−1+2+2=42 · 28+3=31 · 25−1+3=27 · 13+3=16，16 < MIN 20 豁免成立）；⑤ warn——§5.1 编辑面补**第二类 anchor-token 断言文件**（`declare.test.ts` 的本地 `HOME_VALUES` 副本移除 `"header"` 后**过不了 typecheck** · `project.test.ts` 四组 bullet-anchor 断言），并声明 census 方法 = bullet 字面量 grep、此类文件对 grep 不可见；⑥ warn——§6 结构 pin 扩维：退役集加 `:576` `#phaseId` 手抄文法与 `:459` `markerValue` 的 `.replace(`，保留集加 `:476` 已声明 `valuePattern` 的应用，**词表补 `.test(` / `.replace(`**（旧四关键词看不见 `:576`），实测全集 10 → **14 命中**、退役 7 + 保留 7 互补，§4.1 同步点名 `#phaseId` 的改写；⑦ nit——`face/gate.ts:1` 模块注释更正为 `:164` 的 `startsWith("- **Version**:")` 扫描（`:1` 只是路径注释，无需编辑）| Oscar M. · Claude Opus 5（kairos:cdd-design [P10] spec-fix-5） |
| v0.7 | 2026-10-17 | **spec-fix-6（review-6 findings 收口 · 4 warn + 1 nit · 零 blocker；遵照 orchestrator 复核裁定全部按常规修复落地，不复开 fix-5 的两条裁定）**：① warn——§5.1 第一类 census 补**第三线**（其余登记头字面量族 `**Spec:**`/`- **Parent program**:`/`- **Depends on**:`/`- **Base**:`/`- **Status**:`/`- **Author**:`：grep 并集 **14 个测试文件**），并点名 **4 个只带 `**Spec:**` + `- **Parent program**:`、对 Version/Doc-type 两条 census 不可见**的 plan 夹具（`render.test.ts:332-333` · `graph.test.ts:27-28` · `run.test.ts:56-57` · `wave.test.ts:48-49`），编辑面（9 → 14 并集）与 AC 同列；② warn——§5.2 消费面点名 plan 头约定的**双钉**（`cdd-plan/SKILL.md:44` · `cdd-report/SKILL.md:37` · pin 测试 `cdd-plan-spec.test.ts:30-39`）与改写目标（`spec:` front-matter key · 测试重锚不删）；③ warn——§4.1 标签漂移判点名片测试（`lint.test.ts:225-267` 三用例 · `judge.test.ts:623-632`），§6 退休 pin **升级为行为断言**（改写后漂移用例各自断言零 finding）；④ warn——§5.2 BLOCKED 文案扩到 **finding 面**（`Finding.field` 十处锚字面量键化 · 固定 message 去 `**…**` · 五测试文件 24 处引号字面量重锚 · §6 增非测试生产文件 grep pin，今日实测 101 命中 / 11 文件全在退役清单内）；⑤ warn——§6 形态 pin **定型 grep 形式** + 正面断言（首行 `---` · yaml.parse 键集）+ 两侧计数（222 = 106 头部行 + 116 正文提及）；⑥ nit——四处引证校正（`declare.test.ts` MAX 在 `:55`、`:54` 是 MIN · `project.test.ts` 第五组 `:377-386` truthAnchors（四组 → 五组）· `preflight.test.ts` CONFORMING_SPEC 至 `:149` · `skeleton.ts:59/:287-289` 的 `TRUTH_LINES["**Status**"]` 与 Status 分支入 §4.1 死名单） | Oscar M. · Claude Opus 5（kairos:cdd-design [P10] spec-fix-6） |
