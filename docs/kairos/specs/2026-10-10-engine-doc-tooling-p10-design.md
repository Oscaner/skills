# 引擎文档工具（Engine Doc-Tooling）— P10 设计：文档头部 front-matter 化 + 登记表驱动正文解析统一（Fork B）
- **Version**: v0.1 · 2026-10-17
- **Doc type**: phase-spec
- **Status**: Draft
- **Author**: Oscar M. · Claude Opus 5（kairos:cdd-design [P10] 会话 · 用户裁定 · 2026-10-17）
- **Parent program**: [引擎文档工具（Engine Doc-Tooling）Overall](2026-10-10-engine-doc-tooling-overall.md)
- **Depends on**: P9（Done · v0.7 · hard——P9 全链闭合后重开文档形态与解析模型统一 · overall 依赖图 D48）

## Design

本 phase 承接 P9 收口后的续 phase（2026-10-17 cdd-design [P10] 会话注册 D48）。**统一命题——一份 CDD 文档的真相是「head 是数据 · body 是结构」**：head（title / doc-type / version / date / status / author / spec / parent-program / depends-on / base）是一组**固定 schema 的标量字段**——它是*数据*；body（section / table / task block / design heading / dependency graph）是 *markdown 结构*。现行引擎把 head 当成「带 anchor 的 markdown 行」建模（`declare.ts` 登记表 anchor 是字面量 token，`project.ts` 编译成 `RegExp` 扫行），**把数据当结构解**——这正是本次要修正的根。

命题由两个入口汇聚：**其一**，头部形态脆弱且违 D26——四类文档的机器判定头部元组以 markdown bullet 行承载（`- **Version**: v2.44 · 2026-10-17` / `- **Status**: Draft` / `- **Author**: …` / `- **Doc type**: overall-spec` + plan 的 `**Spec:**` / `**Parent program**` / `**Depends on**` / `**Base**`），同一事实既编码为 markdown anchor 又编码为登记表 anchor，**两套模型**；且 P9/D42 已实测这类「裸 key + 冒号 + 散文」形态在 YAML/手工解析两头不讨好（`description: the engine's next: line` 致严格 YAML 解析炸）。**其二**，正文结构层同样存在「声明再抄」——`doc.ts` 用 ~5 个手写正则（`/^### Task (\d+):/` · `/^-\s+\*\*([A-Za-z ]+)\*\*:\s*(.*)$/` · 表格 `split("|")` · `/^### (\d+)\.\s+(.*)$/` · `/^#### (\d+)\.(\d+)\s+(.*)$/`）**重新编码**了登记表已声明的 anchor 结构，同一结构知识存在两份。

由此 `size?` 判得 **oversized**（头部迁移 + 正文解析模型重写 + 登记表扩展 + 骨架渲染 + 全库 64 篇迁移 + 消费面 skill 同步 · 跨 contract/render/face 三面 + docs 平面）。用户裁定 **S1=c 不拆 phase** → 收敛为**单 phase-spec 承载，内部 wave 序列**（承 P5/D18⑩「不拆 phase ≠ 不拆 wave」先例）。

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

- **判定语义不变**：`invariants.ts` 的判压逻辑（version-lineage · phase-registered · change-history 版本血缘 · cross-doc chain 等）逐条不变——本 phase 只换**事实的承载形态与提取通道**，不改判定规则。
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
version: v2.45
date: 2026-10-17
status: Draft
author: "[human] · Claude Opus 5（…）"
---
```

plan 追加四字段：

```yaml
---
title: …
doc-type: plan
version: v0.9
date: 2026-10-17
spec: docs/kairos/specs/2026-10-10-engine-doc-tooling-p10-design.md
parent-program: 引擎文档工具（Engine Doc-Tooling）Overall
depends-on: P9
---
```

- **字段全集**：`title` · `doc-type` · `version` · `date` · `status` · `author`（四型按需出现）；plan 追加 `spec` · `parent-program` · `depends-on` · `base`。
- **`version` 与 `date` 拆两字段**（原 `v2.44 · 2026-10-17` 一字符串）——版本血缘判定只需 `v2.44`，date 独立更可比。
- **`spec` / `parent-program` 只存标量**（路径 / label），不存 `[label](target)` markdown 链——链 target 是机器事实，label 由 basename/兄弟扫描派生（引擎已有此链路）。
- **留在正文**：`**Constraints**` 多行散文（见 §2.4）、single-spec 的 `Issues` 散文行（见 §2.3）、以及全部正文结构层。

#### 2.2 解析通道 = `yaml` 引擎 + 薄 fence 切分（选型裁定）

- **选型**：`yaml`（npm）——周下载 242M · 活跃（2026-09 · 维护者 Eemeli Aro）· **零传递依赖** · **本仓已在用**（`scripts/emit.ts` 的 `stringify` · `packages/kairos/tests/skill-anatomy.test.ts` 的 `parse`——即 P9 立的 frontmatter-YAML 合法性门）。**因选它而非 `gray-matter`**：gray-matter / front-matter 停更 3 年（2023-07）+ 拖 `js-yaml@^3` 旧 major；`@11ty/gray-matter` 系维护 fork 但小众（0.8M/周）；`vfile-matter` 引 `vfile` 重依赖。全仓单一 YAML 引擎 = D26「一事实一处」的直接推论。
- **形态**：`---` fence 切分（文件开头 `---` 到下一 `---`）是 ~10 行代码，格式标准稳定，无需 front-matter 专用库。
- **依赖面**：`yaml` 由仓库 devDep 升为 **cdd-engine 运行时依赖**（P3 commander ^15 先例 · 记一笔）。
- **提取器落点**：`FrontMatterExtractor`（值对象类 · 零裸函数）——fence 切分 + `yaml.parse` + typed accessor，产出 typed head record（含 `version` lineage 所需的版本 token）。

#### 2.3 登记表外头部事实收编

- **`doc-type`**：今天不在 `declare.ts` 登记表，由 `face/board-view.ts#docTypeOf` 单读（board 判 doc 类 · capsule 判 doc-class）。收编进登记表（`home: "frontmatter"`），消灭「无门声明事实」。
- **single-spec `Issues`**：今天为自由散文行（不在登记表）。收编进登记表。
- 收编后头部元组事实**全部在册**（登记表 = 唯一声明根 · D26 成立）。

#### 2.4 Constraints 归一

`**Constraints**` 今天仅在 **overall** 是头部 bullet；plan / phase-spec / single-spec 均已是 `## Constraints` 正文 section。**统一为正文 section**——head 不含 Constraints。一致性修正（六前提③④）。

### 3. B 组 · 正文解析模型统一（Fork B）

#### 3.1 单结构知识源 = 登记的 `home` 轴

今天引擎有两套结构知识：`declare.ts` 登记表声明「有哪些 anchor + home」，而 `doc.ts` 用 ~5 个正则**重新编码**了同一批 anchor 的结构形态（「声明再抄」）。统一后，结构知识只留在**一处**——登记的 `home` 轴。

`home` 取值：`header`（迁 frontmatter 后为 `frontmatter`）· `section` · `facet` · `table` · `graph` · `task-block` · `task-field` · `task-step` · `design-body` · `conditional`。

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

### 4. 死代码清理与骨架渲染

#### 4.1 死头代码清理（六前提④）

- `render/skeleton.ts` 的 `HEADER_FORMS` 硬编码（`"- **Version**: v0.1 · {date}"` 等）· `LINK_SLOTS`。
- `contract/doc.ts` 的 header-line 提取（`headerLines` / `HeadingBlock` 头部腿）。
- `face/board-view.ts#headerLinesOf` / `#docTypeOf` 的头部行扫描。
- 头部 anchor 的 RegExp 编译（`project.ts#projectDocSlices` 对 header 腿）。
- 全部删除，零残留（grep pin）。

#### 4.2 骨架渲染器改吐 front-matter 头

- `SkeletonAssembler` 头部段改吐 front-matter（`yaml.stringify`）——`title` 为填槽、`version`/`date`/`status` 为 generator-truth、`author`/`spec`/`parent-program`/`depends-on` 为填槽。
- body 段骨架逻辑（section 序列 · 表列头 · task block 首块 · change-history 表）保留。
- `schema get <type> --output skeleton <target>` 输出 = front-matter 头 + markdown body。

### 5. 迁移与消费面

#### 5.1 全量迁移（本仓 64 篇）

- 本仓 **34 spec + 30 plan** 一次性机械改写头部为 front-matter（脚本可安全批改——同源模板 · 头部块形态一致）；正文 H1 删除（`title:` 唯一源）。
- 迁移后引擎 `board` / `review` / `fix` 对历史文档判压全绿（`readDocType` 从 front-matter `doc-type` 读）。
- **一次提交**（头部形态迁移独立于实现 · Mid-Flight Backfill 纪律）。

#### 5.2 消费者面（major breaking · 自行迁移）

- 引擎是发布物；消费者仓已有旧格式文档。换格式后消费者升级引擎再跑 `cdd review` 会解析失败 → **major breaking · 零 legacy 兼容**（不做「读不到 front-matter 时回退旧 bullet 头」的双格式兼容——正是本程序要消灭的「两套头部模型」）。
- 消费者**自行迁移**（按迁移说明重写头部，或 `schema get … --output skeleton` 重吐头部）。
- 消费面 skill（cdd-spec-writer / cdd-plan）「先 gen 后填」纪律不变；skill 文本对头部形态的表述同步（不注入解析实现 · 守 D29）。

### 6. 不变量与 pin

- **结构 pin**：`doc.ts` 手写 anchor 正则零命中（`grep -nE '\.match\(/\^#'` 类）；登记表含 `frontmatter` home + `doc-type` + `Issues`。
- **形态 pin**：四类文档头部元组全在 front-matter（正文 bullet 头零残留 grep）；正文 H1 零残留。
- **判定回归 pin**：迁移后全部历史文档过 doc-contract（`invariants` 判压零 finding）——判定语义零变化。
- **依赖 pin**：`yaml` 落 cdd-engine `package.json#dependencies`。
- **门归属**：引擎内部事实门进 **engine suite**；引擎 ⇄ 消费面对照门进 **kairos suite**（镜像 P5/P9 归域）。

### Acceptance criteria

- `四类文档头部元组全在 front-matter（正则残留零 grep pin）`
- `正文 H1 零残留（title 唯一标题源）`
- `doc.ts 手写 anchor 正则零命中（登记表 home 驱动提取器替换）`
- `登记表含 frontmatter home + Doc type + Issues 收编（无门事实归零）`
- `Constraints 归一为正文 section（overall 头部 bullet 零残留）`
- `死头代码零残留（HEADER_FORMS · #headerLinesOf · header-line 提取）`
- `skeleton 吐 front-matter 头（yaml stringify）+ body 骨架保留`
- `本仓 64 篇文档全量迁移（引擎 board/review 判压历史文档全绿 · 判定语义零变化）`
- `消费面迁移说明在册（major breaking · 零 legacy 兼容）`
- `引擎 vitest 全绿 + kairos suite 全绿 + pnpm run validate ALL PASS · 不发布`
- `零裸函数（grep 零命中）· EOF 恰一 newline · English-primary（SKILL.md/docs）· specs/plans 中文（Strategy B）`

## Constraints

- **判定语义不变**：`invariants.ts` 判压逻辑逐条不变——本 phase 只换承载形态与提取通道，不改判定规则；退出码表 0/1/2 · CDD_BLOCKED 通道 · 领域 run 语义 · `next:` 字面形态零变化。
- **两组分界（唯一规范）**：结构化元数据（front-matter）→ 标准解析器（`yaml`）；markdown 正文骨架 → 登记表驱动轻量扫描。**正文层不引 AST 解析器**（避第二套模型 · 守六前提⑤心智负担 · `declare.ts` 登记表 anchor 保持字面量 token 形态）。
- **登记表仍是唯一声明根**：头部元素 `home: "frontmatter"`（anchor = YAML key）· 正文元素 home 提取器；零「头部单抽 schema」双模型。
- **`yaml` 升 engine 运行时依赖**：由仓库 devDep 升 cdd-engine `dependencies`（P3 commander 先例 · 记一笔）。
- **迁移 = 全量 · 零 legacy 兼容**：本仓 64 篇一次性改写；消费者自行迁移；major breaking。不引入双格式头兼容层（违 D26「两套模型」）。
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
