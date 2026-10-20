---
title: 引擎文档工具（Engine Doc-Tooling）— P15 设计：文档身份面统一为 front-matter `slug:`（board 入口改路径 · 文件名推演与路径声明键整退）
doc-type: phase-spec
version: v0.4
date: 2026-10-20
status: Draft
author: Oscaner M. · Claude（kairos:cdd-design [P15] 会话 · 用户七前提 mandate · grilling settled · 2026-10-20）
parent-program: 2026-10-10-engine-doc-tooling-overall.md
parent-version: v2.65
depends-on: P14（Done · v0.3 · hard——P14 Design Done · overall 依赖图 P14 -> P15）
---

## Design

本 phase 承接 P8/D34 未覆盖的半面：D34 退役了「文件名 → `doc-type`」，但 **slug ↔ 路径反推**（`docsOfSlug` / `slugFromDoc` / `phaseSuffixOf` / `scanPhases`）仍按文件名猜。markji-kit 实案——agent 产出 `…-p1-core(-design).md`，相位后缀文法要求 `-pN`——使 `cdd board <slug>` 盲，消费者无法保证 agent 文件名合法。

**命题（D59 grilling settled）**：文档身份与关联一律 front-matter 声明；文件名推演与路径声明键整退；board 入口改为确定性路径（`--plan` / `--spec`）；board 与派发工作区共用同一把 `slug:` 钥匙。七前提全开 · major breaking · 零 legacy 双读。

### 1. 目标与边界

#### 1.1 设计输入与授权

- 输入：overall D59（注册 + grilling 全裁定）；markji-kit 复现（`board 2026-01-01-markji-kit-p1-core` exit 2 · `board …-p1` 摸到 overall 但 spec/plan none）；P8 design §12 D34；源码面 `infra/workspace.ts`（`slugFromDoc` / `phaseSuffixOf` / `docsOfSlug` / `PHASE_SUFFIX_*`）、`face/board-view.ts`（`hasNode` / `scanPhases` / render）、`face/cli.ts#runBoard` / `#sceneOf`、`face/declare.ts` board 行、`contract/declare.ts` front-matter 键登记、`render/skeleton.ts` link 占位、kairos cdd-design / cdd-spec-writer / cdd-plan author 节点。
- 授权：七前提整评（破坏性 OK · OOP/零裸函数 · 无声明再抄 · 高内聚低耦合 · 消费者心智负担 · 最大收敛简化 · 不造轮子）；破坏性变更许可，不保守、不打补丁。
- 尺寸：单 phase-spec · 内部 wave · 不拆子 phase（主题单一「身份声明化」）。
- hard-dep：P14 Design Done（serial-phase 过）。

#### 1.2 判定基线（源码已确认）

- board 今日零旗标、唯一 positional `<slug>`（`face/declare.ts` board 行 · `cli.ts#runBoard`）。
- `--plan` / `--spec` 已在 `ARGV_CHANNEL`，挂在 implement / review / fix / schema 的 key 行与 base `set` / `get` 的 leaf 行，**未**挂 board。
- 正向：`Workspace.slugFromDoc` 剥 `.md` + 一个 `-(design|plan)` → 工作区键（派发 `#sceneOf` / `base` 共用）。
- 反向：`docsOfSlug` 按 `-pN` 后缀 + `<slug>-design.md` / `<slug>.md` / `<slug>-overall.md` 猜路径；`scanPhases` 按文件名前缀扫相位。
- `parent-program:` / `spec:` 为登记表路径键（skeleton 吐 link 占位）；board **故意不读** overall File paths 表（P8/D32③）。
- D34 已立：`doc-type:` 为类型真源；缺键 BLOCKED。本 phase 把同一理由推到身份/关联面。

判定 pin 表（claim → path:line + 断言面，均已对源码确认）：

| 断言（claim） | pin（path:line） | 断言面（assertion face） |
| --- | --- | --- |
| board 零旗标、唯一 positional `<slug>` | `face/declare.ts:280-285` · `face/cli.ts:351` | board 登记行 `keys: []` + `positionals: [{ key: "slug", required: true }]`；`commandNode("board")` 只解 positional |
| `--plan` / `--spec` 在 `ARGV_CHANNEL`，挂载于 implement / review / fix / schema 的 key 行与 base set / base get / schema get 的 leaf 行 | `face/declare.ts:53-55` · `:192-262` | 两行 flag 声明（`--plan` / `--spec`）；implement / review / fix / schema 的 key 行出现 `plan`，base 顶层 `keys: []` 而 `--plan` 在 `set` / `get` leaf 行，board 行 `keys: []` |
| 正向推演 `Workspace.slugFromDoc` | `infra/workspace.ts:131-134` | `path.basename` 剥 `.md` + 一个 `-(design\|plan)` 尾缀（锚定、互斥） |
| 反向推演 `docsOfSlug` / `scanPhases` | `infra/workspace.ts:150-172` · `face/board-view.ts:136-151` | 路径按 `-pN` 后缀拼 `<slug>-design.md` / `<slug>.md` / `<slug>-overall.md` 后 `existsSync`；相位集按 specs 目录**文件名前缀**扫出 |
| `spec:` / `parent-program:` 是路径键，skeleton 吐 link 占位 | `contract/declare.ts:522-534` · `render/skeleton.ts:47-50` | 两元素 `home: "frontmatter"`、`refKind` 为 `spec-ref` / `parent-program`；占位值是 `<docs/…-design.md>` / `<docs/…-overall.md>` 路径形 |
| board 故意不读 overall 的 File paths / Phase inventory 表 | `face/board-view.ts:6` | 面注：两表 NEVER parsed（P8/D32③ · measured stale） |
| D34：`doc-type:` 是类型真源，缺键 BLOCKED 且 board exit 2 | `face/board-view.ts:475-481` · `:405` · `:458` · `face/__tests__/board-view.test.ts:1087` | 缺键 → `doc-type: missing (BLOCKED)` 标记 + `blocked` 置位 → phase / program 板 `return blocked ? 2 : 0`；用例断言 exit 2 |
| 找不到文档 → exit 2（board not-found 面） | `face/cli.ts:367-373` | 缺 positional → `#usage`；`hasNode` 假 → stderr `no docs match slug` + `return 2` |

#### 1.3 保留面（冻结）

- review / fix / implement 的判定语义、`next:` 字面形态（动词/旗标结构）、退出码表 0/1/2、CDD_BLOCKED 通道。
- branch face 绑定的 skill ref（`mattpocock-skills:code-review`）与 `REVIEWS.branch` 四轴——本 phase **不**换接线（调研见附录）。
- `doc-type:` 键与 D34 类型声明模型。
- repoRoot 相对路径基准（P9）——新键值是 slug 字符串，不是路径；路径入参仍走既有漏斗。

#### 1.4 Non-goals

- 模糊/前缀文件名匹配；legacy 双读（旧 slug positional 与新路径入口并存）。
- 相位嵌套树（`-p4.1` 挂 `-p4`）——本 phase 扁平挂 overall。
- 换 branch-review skill ref / 改 review 轴 / merge verdict 字段（附录调研，不施工）。
- 给 `schema get` 增加 `--slug` / `--from-spec` 旗标（编排器已有上下文，CLI 再抄 = 声明再抄）。
- 自动迁移旧 `.kairos/cdd/<旧钥>/` 进度目录。

### 2. 身份与关联模型

#### 2.1 `slug:`（每文档必填）

| 规则 | 定案 |
| --- | --- |
| 谁有 | overall-spec / phase-spec / single-spec / plan 四类皆必填 |
| 合法形 | 可执行 `valuePattern: ^(?=.{1,128}$)[A-Za-z0-9][A-Za-z0-9._-]*$`：首字符字母数字，其余字母数字 / `.` / `_` / `-`；长度上限 128 由前置 lookahead 并入同一模式（登记表元素只有 `valuePattern` 一个形状载体，判据是 `new RegExp(rawPattern).test(value)`，`contract/invariants.ts:484-497`，无独立 length 字段）；**不**强制 `-pN` 形貌。约束理由：`slug:` 同时是工作区目录名——`Workspace` 构造 `path.join(root.path, slug)`（`infra/workspace.ts:126`），故 `.` / `..` / `/` `\` / 空白 / Windows 保留字符（`: * ? " < > \|`）必须在取值面即被拒，不能交给 `path.join` 归一化 |
| 缺/空 | 与缺 `doc-type:` 同级 → doc-contract **硬 BLOCKED**（载体随面：派发面 exit 1 + CDD_BLOCKED · board 纯读面该行渲染 `slug: missing (BLOCKED)` 标记 + exit 2——见 §3.1） |
| 唯一性 | **docRoots 内唯一**：扫 `ENGINE_RUNTIME.docRoots.specs` + `.plans` 两目录（身份文档 overall-spec / phase-spec / single-spec 两两不得同 slug）；plan 与**恰好一份** spec 同 slug 为合法一对。判据单源 = `SlugIndex`（§4.1），扫面**不**越出 docRoots |
| 写入 | authoring 入口给出；编排器校验后写入；**运行时零从文件名/title 派生** |

#### 2.2 `program:`（仅 phase-spec）

- 值 = 父 overall 的 `slug:`（**slug 引用，不是路径**）。
- **仅 phase-spec 必填**；plan / single-spec / overall **登记表无此键**。
- plan 归属链：plan →（同 slug）spec →（若 phase-spec）`program:` → overall；single-spec 无 `program:`（自己是根）。
- `program:` 指向的 overall slug 在盘上无对应 overall 文档 → **硬 BLOCKED**。

#### 2.3 plan ↔ spec

- **同 slug**；`doc-type:` 区分二者。
- 编排器写 plan 时从已落盘 spec 读 `slug:` 写入 plan——**不是** skeleton CLI 预填特殊逻辑；四类文档的 `slug:` 骨架写法一致（占位 → 编排器填实值）。
- 扫盘：同 slug 的 plan 0 份 → 板上 `plan (none)`（不 BLOCKED）；>1 份 → **硬 BLOCKED**。对称：同 slug 多份 phase-spec/single-spec → 硬 BLOCKED。
- plan 无配对 spec → 板上 `spec (none)`（authoring 中途合法，不 BLOCKED）。

#### 2.4 工作区钥

- `.kairos/cdd/<slug:>/` —— board 与 `implement` / `review` / `fix` / `base` **同一把钥匙**。
- 入口 `--spec` → 读该文档 `slug:`；入口 `--plan` → 读 plan 的 `slug:`（与其 spec 相同）。
- 旧 `.kairos/cdd/<slugFromDoc 剥文件名>/` **不迁、不兼容**；进度是缓存，可重建；文档说明可手删旧目录。

### 3. CLI / board 面

#### 3.1 入口

- `cdd board`：**退役** positional `<slug>`；挂既有 `--plan` / `--spec`，**至少其一**（缺 → usage exit 2）。
- board 是**纯读面**，**不入** CDD_BLOCKED 通道（该通道是派发 pre-flight 的面）：board 的一切拒绝面统一 **exit 2**，按措辞分三类，**不可互相混淆**：
  - **入参冲突**：两者皆给且两文档 `slug:` 不一致 → stderr 携因（两值并列）+ exit 2。
  - **入口不可解析（找不到文档）**：`--plan` / `--spec` 路径在盘上不存在，或不落在 docRoots（specs / plans）之内 → stderr not-found 面 + exit 2（`face/cli.ts:367-373` 既有形）。此面**零文档读取**，不产任何 BLOCKED 标记。
  - **文档违约（文档已读到后才成立）**：标记取违规锚（`slug:` / `program:`）+ `(BLOCKED)` 并 exit 2；缺失类沿用 D34 既有 `missing` 形，重复类单列 `duplicated` 形区分——缺 `slug:`（与缺 `doc-type:` 同级）→ `slug: missing (BLOCKED)` · `program:` 目标 overall 缺失 → `program: missing (BLOCKED)` · 同 slug 多份身份文档 / 多份 plan → `slug: duplicated (BLOCKED)`。
- 「硬 BLOCKED」**载体随面而异，判据同一**：派发面（implement / review / fix / base 的 doc-contract pre-flight）→ exit 1 + CDD_BLOCKED 携因（`face/cli.ts:499-502` 既有形）；board 纯读面 → 行级 `(BLOCKED)` 标记 + exit 2（§2.1–§2.3 的每条硬门都按此分面呈现）。
- 传 overall 路径 → program 板；传 phase-spec / single-spec / plan → 对应节点板（由 `doc-type:` + 关联链判定，不靠文件名）。

#### 3.2 program 板

- 扫盘：在 `ENGINE_RUNTIME.docRoots.specs`（及需要时 plans）找 `program:` == 本 overall `slug:` 的 phase-spec；**不**维护 overall 子清单数组。
- 行显示：**相位行主键由 P-id 改为 `slug:`**，旁注 `title:`（截断）。今日主键 `P1` 由 slug 的 `-pN` 尾缀派生（`face/board-view.ts:426`：`node.label.slice(slug.length).replace(/^-p/, "P")`）；本 phase 退役 `phaseSuffixOf`（§3.3）且 §2.1 **不**强制 `-pN` 形貌，新模型里 P-id 没有来源 → 该行字节改写属 **deliberate pin 重锚**（与 Constraints 的 argv 示例重锚同姿态），AC 的 `board-view.test.ts:1022` 只作 program 板形状锚。
- **扁平**：无父相位树；子相位若将来需要另开议题。

#### 3.3 退役面（运行时零残留）

- `Workspace.docsOfSlug` / `slugFromDoc` / `phaseSuffixOf` / `PHASE_SUFFIX_*` / `BoardView.scanPhases`（及一切「文件名像不像 `-pN`」判据）。
- front-matter 路径键 **`spec:`**、**`parent-program:`** 整键退役（登记表 · skeleton · judge · 消费面字面同步）。
- board help/example/README 从 `cdd board <slug>` 改为路径入口。

### 4. 契约 / 骨架 / 编排器

#### 4.1 登记表

- 四类增必填 `slug:`（frontmatter home · `refKind: "none"`——身份标量，形状由 §2.1 的 `valuePattern` 卡、跨文档事实由唯一性门判）；phase-spec 增必填 `program:`（frontmatter home）；删 `spec:` / `parent-program:` 两元素。
- **`RefKind` 处置**（三处同改：union `contract/declare.ts:30-38` · 约束数组 `REF_KIND_VALUES` `:89-98` · 校验点 `:140-142`；今日无「slug 引用」档）：
  - 退休 `spec-ref` 与 `parent-program` 两档：从 union 与 `REF_KIND_VALUES` 同步删除，全部消费点逐点零残留——`contract/declare.ts:525`（`spec:` 元素）与 `:532` / `:783`（`parent-program:` 元素）随键删除；`contract/declare.ts:400`（Design spec cell）改 `refKind: "none"`（人读混合枚举，引擎零解析）、`:474`（Design claim token）改 `refKind: "phase-id"`（`P<n>-design` 是相位 token）；`contract/project.ts:597` 的 link-slot 判（`slug-ref` 并入，见 §4.2）、`contract/invariants.ts` 的 Class-A/Class-B 链、`contract/doc.ts` 的头部链访问子、`contract/frontmatter.ts` 与 `contract/lint.ts` 的 Class-B 标称面同步改/删。
  - **新增 `slug-ref` 一档**（同时进 union 与 `REF_KIND_VALUES`）承载 `program:`：其值是 slug 而**不是**路径，故**不**复用 `markdown-link`（后者的判据是文件存在性，对 slug 无意义）。断言面 = 该值等于 docRoots 内某篇 overall 的 `slug:`（按 slug 键查表，零路径解析、零文件名推演；命中 0 篇 → §2.2 的硬门）；**占位形（`<…>` / `:::fill`）豁免**，沿用既有 `isPlaceholder` 契约（`contract/invariants.ts:1114-1119`，消费点 `:1062` · `:1165` · `:1194`；cross-doc 链 map miss 静默返回 `:1287-1289`）——骨架自己吐出的 `program: <overall-slug>` 不得被该硬门判 BLOCKED。
- **唯一性门的单源与执行点**：判据载体 = `SlugIndex`——扫 `ENGINE_RUNTIME.docRoots.specs` + `.plans` 下全部 `doc-type:` 文档，按 `slug:` 归并（**同一扫描**也供 §3.2 的 `program:` 归并：一次扫盘、一个索引）。判据**一处**，执行点**两处**、零重算：board 渲染读该索引（违规行 `(BLOCKED)` 标记 + exit 2）· 派发面 doc-contract pre-flight 读同一索引判目标文档的唯一性（违约 → CDD_BLOCKED + exit 1）。引擎 suite 只断言 `SlugIndex` 自身判据，**不**起第三套实现。
- doc-contract / Presence 对缺键硬 BLOCKED（面与载体见 §3.1）。

#### 4.2 骨架

- 四类 skeleton 吐 `slug:` 占位（等价 fill 槽 `:::fill slug` 即可）；phase-spec 另吐 `program: <overall-slug>` 占位。**槽类必须同批接线**：骨架的 front-matter 槽类判据是 `home === "frontmatter" && (refKind === "parent-program" || refKind === "spec-ref")`（`contract/project.ts:595-599`），link 槽字节来自 `FRONT_MATTER_LINKS`（`render/skeleton.ts:47-50`；缺条目抛 `no skeleton front-matter link placeholder for the … anchor`，`:327-331`），且 link 槽的 `<…>` 占位同时是形状样例（`render/skeleton.ts:37-44`，占位即 fill 契约）。故 `slug-ref`（`program:`）必须并入该 link 槽类判据，并在 `FRONT_MATTER_LINKS` 补 `program: "<docs/kairos/specs/…-overall.md>"` 条目；`slug:` 是 `refKind: "none"` 的 content 槽，落 `:::fill slug`（若保留 `<…>` 形，则同样并入 link 槽类并补条目）。按字面不接线，骨架会吐 `:::fill program` / `:::fill slug`，不是本条的 `<overall-slug>` 形。
- **不加** `schema get` 的 `--slug` / `--from-spec` 旗标。
- 新 overall 骨架：**去掉 File paths 路径表**（身份真源已是 slug + 扫盘）。**四面必须同批处置**（缺任一面则新 overall 骨架过不了契约门）：
  - **骨架**：`render/skeleton.ts:172` 的 `## File paths` 段落删除（连同 `#filePathsTable` 的 `File path row` 探针，`render/skeleton.ts:381-384`；`skeleton.ts` 无 `docsOfSlug` 引用）。
  - **登记表（section）**：`contract/declare.ts:223-229` 的 `## File paths` 由 `presence: "required"` 改 **`optional`**——**不**整条退役：§5 允许历史 overall 保留该表；退役会让存量 overall 的该 heading 失去顺序判据与语义登记（未登记 heading 在 `contract/invariants.ts:656-657` 是静默跳过，不报错）。
  - **登记表（row）**：`contract/declare.ts:434-440` 的 `File path row`（`home: "table"` 在 `:439` · `presence: "required"`）同批改 **`optional`**——它是 overall-spec 的独立 required 元素，也是 `#filePathsTable` 的唯一 probe 点；不改则 `#assertConsumed`（`render/skeleton.ts:141-157`）对新骨架抛 `skeleton composition omits the registered required slot(s): File path row`。该元素的 judge 面属 hollow 而非 presence：`PRESENCE_HOMES`（`contract/invariants.ts:268-278`）不含 `table`，`PresenceInvariant.evaluate` 对非该集 home 直接 `continue`（`:288`）；真正判该表的是 `HollowInvariant.tableHollow`（`contract/invariants.ts:850-868`，经 `overallTableHeadings` 四表名过滤集 `:255`），其处置见下一条「不变量」。历史 overall 已存在的 row 在 optional 下合法；新骨架不再 compose 该 row。
  - **不变量**：`contract/invariants.ts:255` 的四表名过滤集去掉 `"File paths"`，hollow 判据收缩为 `Issue inventory` / `Phase inventory` / `Change history` 三表（否则 optional 表的空段仍被必填态的行判据判）。
- Phase inventory：**保留人读** `Design spec` / `Implementation plan` 两列与 scope / 验收列；新骨架在这两列只吐真值占位（`[Pending]` design / `Pending` plan），**不吐路径**；两元素（`contract/declare.ts:388-402`）保持 `presence: "required"`、取值域不变——历史 overall 的 markdown-link 路径值继续合法（§5 不强制改写），仅 `Design spec cell` 的 `refKind` 由 `spec-ref` 改 `none`（§4.1）。board 零读该表（`face/board-view.ts:6`，与今「不解析 File paths」一致）；引擎只按登记表判其形状 / 链接存在性（`DomainInvariant` 判 cell 行形状 `contract/invariants.ts:501-513` · 链接收集读 `Implementation plan cell` `:1090-1092` · hollow 判其空段 `:850-868`），不据它补身份。

#### 4.3 编排器（kairos）

- cdd-design / cdd-spec-writer / cdd-plan 的 author 落盘节点：写入 `slug:`；phase-spec 另写 `program:`（编排器已握父 overall 的 slug）；写 plan 时从 spec 继承 `slug:`。
- skill 字面去掉 `spec:` / `parent-program:` / `board <slug>`；**不**改 digraph 拓扑、不增新 skill。
- cdd-dev / cdd-close 无独立身份算法——跟随引擎工作区钥与 `next:`。

### 5. 迁移

- **本仓语料全量**：`docs/kairos/{specs,plans}` 每篇补 `slug:`；phase-spec 补 `program:`；删除 `spec:` / `parent-program:`。
- **迁移期一次性**可用旧文件名茎派生初值（形态可对齐今日 `slugFromDoc`）；写入后**运行时永不再派生**。撞名/非法字符 → 迁移门失败，人工改实值。
- 消费者自行迁移说明进 README（major breaking · 零双读）。
- 历史 overall 正文里的 File paths / 路径列：**不强制改写**；新骨架不再产出。

### 6. 变更集与验证

- changeset：`cdd-engine` **major** + `kairos` **minor**；**不发布**（与 P8–P14 同姿态）。
- 验收门：引擎 vitest 全绿 · kairos suite 全绿 · `pnpm run validate` ALL PASS · 文件名推演符号零残留 grep pin · 旧路径键活面零残留 · `RefKind` 面 `spec-ref` / `parent-program` 字面零残留 + `slug-ref` 在册 · board 路径入口行为 pin（双旗标冲突 exit 2 · 缺 `slug:` 行标记 + exit 2 · 找不到文档 not-found exit 2 · `program:` 缺失 · 0 plan）· `SlugIndex` 唯一性判据 pin（同 slug 多身份文档 / 多 plan）· 派发工作区钥与 board 同钥 pin。

### 7. 附录 · branch-review skill 调研（本 phase 不施工）

调研结论（2026-10-20 · 只读）：

- **已接线**：引擎 branch face → `mattpocock-skills:code-review`（`face/host.ts` DISPATCH/REFS）；引擎 `REVIEWS.branch` 固定前缀补 standards/spec/buildability/scope + `branch-review-N.json` 载体。
- **未接线、prompt 更贴 merge 裁决**：`superpowers:requesting-code-review` 的 `code-reviewer.md`（Critical/Important/Minor · Declined-to-judge · Ready to merge?）。
- **相邻非评审**：`mattpocock-skills:pr`（写 PR body）；`superpowers:receiving-code-review`（收反馈纪律）；`superpowers:finishing-a-development-branch`（已由 cdd-close 消费）。
- **真缺口不在 skill 覆盖**：merge verdict 字段、findings 载体契约、spec/plan 引用锚、base 锚、双证据义务——引擎已部分自给。换 ref 需改 DISPATCH/REFS 且须保留引擎固定前缀，**另开 phase/issue**。

### Acceptance criteria

- `cdd board --plan <path>` 与 `cdd board --spec <path>`（至少其一）渲染 phase/program 板；身份与关联只读 front-matter `slug:` / `program:` / `doc-type:`，不读文件名文法。**「与改前等价」的客观锚** = 既有渲染断言——`face/__tests__/board-view.test.ts:426`（phase 板头 + 行 + 固定 legend 尾）· `:1087`（present 无声明相位 → exit 2）· `face/__tests__/cli.test.ts:3289`（board 命令面 describe）· `:3311`（有效输入 → stdout + exit 0）：这些用例改写入参（`<slug>` → 路径旗标）与语料 key 后，**断言面的行文 / 进度标记 / `next:` / legend 逐字节不变**。`:1022` 只作 **program 板形状锚**（一行相位摘要 + `next: done`）；其相位行主键按 §3.2 由 P-id 改为 `slug:`，属 deliberate pin 重锚，不要求字节等价。
- positional `<slug>` 与 `docsOfSlug` / `slugFromDoc` / `phaseSuffixOf` / `scanPhases` / `PHASE_SUFFIX_*` 生产面零残留（grep pin）。
- front-matter 活面零 `spec:` / `parent-program:`；登记表 · skeleton · judge · 消费面字面同步；`RefKind` 面 `spec-ref` / `parent-program` 零残留（`Design spec cell` → `none` · `Design claim token` → `phase-id`）且 `slug-ref` 在 union 与 `REF_KIND_VALUES` 在册（`program:` 走 slug 键查表，非文件存在判）。
- `--plan` 与 `--spec` 同给且 `slug:` 不一致 → board 拒绝面 exit 2（stderr 携因）；缺二者 → usage exit 2；两者路径皆不在盘上 → not-found 面 exit 2（无 BLOCKED 标记）。
- 同 slug 多 plan 或多身份文档 → 硬 BLOCKED（派发面 CDD_BLOCKED + exit 1 · board 面 `(BLOCKED)` 行标记 + exit 2，判据同源 `SlugIndex`）；0 plan → 板上 `plan (none)`；plan 无配对 spec → 板上 `spec (none)`；`program:` 目标缺失 → 硬 BLOCKED（载体同上双面）。
- `implement` / `review` / `fix` / `base` 工作区目录 = `.kairos/cdd/<slug:>/`，与 board 同钥。
- 仅 phase-spec 必填 `program:`；plan/single/overall 无该键。
- 骨架占位不被硬门判：skeleton 吐出的 `slug:` / `program:` 占位（`<…>` / `:::fill`）不触发缺键或 `slug-ref` 命中 0 篇的硬门（沿用 `isPlaceholder` 豁免）。
- `slug:` 合法面 pin：合法值（如 `2026-10-10-engine-doc-tooling-p15`）通过；非法值 `.` / `..` / 含 `/` `\` 空白 / 空串 / 超 128 字符 / Windows 保留字符 → 硬 BLOCKED（载体同 §3.1 双面）；`valuePattern` 断言覆盖 `.` / `..` 两个目录逃逸值。
- 编排器落盘写入 `slug:`（plan 从 spec 继承）；phase-spec 写入 `program:`；skill 字面无旧键与 `board <slug>`。
- 本仓语料迁移全绿；新 overall 骨架无 `## File paths` 段与该表 `File path row`（登记表的 `## File paths` 与 `File path row` 均 `presence: optional` · hollow 不变量过滤集收缩为 `Issue inventory` / `Phase inventory` / `Change history` 三表）；历史 overall 保留该表与其 row 不报错；消费者迁移说明在册。
- 引擎 vitest 全绿 · kairos suite 全绿 · `pnpm run validate` ALL PASS。
- changeset：cdd-engine **major** + kairos **minor** · 不发布。
- 附录调研不进入实现面；branch skill ref 零改。

## Constraints

- 七前提全开：破坏性变更 · OOP 统一零裸函数 · 无声明再抄 · 高内聚低耦合死码清理 · 消费者心智负担 · 最大精简 · 不造轮子。
- **一事实一处**：身份 = `slug:`；归属 = phase-spec 的 `program:`；类型 = `doc-type:`；工作区钥 = `slug:`。禁止文件名第二套算法、禁止 overall 子清单与扫盘双真源。
- major breaking · **零 legacy 双读**（无「旧 slug 入口仍可用」过渡期）。
- 迁移期文件名派生**只允许在迁移脚手架**；写入后运行时零派生。
- D29 黑盒边界：消费面 skill 不镜像引擎内部类名/推演函数名；只承载行为契约（读 `slug:` / 写 `slug:` / board 路径入口）。
- `next:` 字面形态冻结（P5/P9）；本 phase 只改 board 入参形面与路径键退役后的 argv 示例字节（deliberate pin 重锚）。
- hard-dep P14；serial-phase 已过。

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-10-20 | 初稿：D59 grilling settled 全形状落入 phase-spec（身份/关联/board/退役/契约/编排器/迁移/附录调研） | Oscaner M. · Claude（kairos:cdd-spec-writer [P15]） |
| v0.2 | 2026-10-20 | **spec-fix-1（review-1 findings 收口 · 3 blocker + 2 warn + 2 nit）**：① blocker——§1.2 补判定 pin 表（8 条 claim → path:line + 断言面，含 board 入口 / ARGV 挂载 / 双向推演 / 路径键 / D34 缺键 exit 2 / not-found 面）；② blocker——§4.2 补 File paths 三面同批处置（骨架删段 · 登记表 `presence: optional` · hollow 不变量过滤集收缩为三表）；③ blocker——§4.1 补 `RefKind` 处置（退休 `spec-ref`/`parent-program` 两档 + 消费点逐点，新增 `slug-ref` 承载 `program:`）；④ warn——§3.1 定 board 纯读面退出码（三类拒绝面统一 exit 2 · 「缺 `slug:`」与「找不到文档」区分 · 硬 BLOCKED 载体随面而异）；⑤ warn——唯一性面统一为 docRoots 内扫描 + `SlugIndex` 单源双执行点（§2.1/§4.1/§6）；⑥ nit——front-matter `depends-on` 依赖边改 `P14 -> P15`（D59 仍只在 §1.1 输入面引用）；⑦ nit——AC 补「与改前等价」的基线 pin（`board-view.test.ts:426`/`:1022`/`:1087` · `cli.test.ts:3289`/`:3311`） | Oscaner M. · Claude（kairos:cdd-spec-writer [P15] spec-fix-1） |
| v0.3 | 2026-10-20 | **spec-fix-2（review-2 findings 收口 · 1 blocker + 3 warn + 3 nit）**：① blocker——File paths 处置补第四面：`File path row`（`contract/declare.ts:433-438`）同批 `presence: optional`，并说明 `#assertConsumed` / `PresenceInvariant` 的失败面与历史 row 合法性，AC 同步；② warn——`RefKind` 清单补全：点名 `:400`（Design spec cell → `none`）· `:474`（Design claim token → `phase-id`）· union/`REF_KIND_VALUES`/校验点三处，并写明 `slug-ref` 同时入闭集数组；③ warn——§2.1 合法形落成可执行 `valuePattern`（首字符字母数字，拒 `.`/`..`/分隔符/Windows 保留字符），以「slug 即工作区目录名」为约束理由，AC 补非法值 pin；④ warn——Phase inventory 两列去留定案（保留 required、新骨架只吐真值占位、历史 markdown-link 值继续合法）；⑤ nit——§1.2 pin 表改述 `--plan`/`--spec` 精确挂载面（implement/review/fix/schema key 行 · base set/get leaf 行 · board `keys: []`）；⑥ nit——删去「skeleton 的 `docsOfSlug` 探针」误述，改指 `#filePathsTable` 的 `File path row` probe；⑦ nit——§4.2「不整条退役」理由改为真实约束（未登记 heading 静默跳过，不报错；退役只失去顺序判据与语义登记） | Oscaner M. · Claude（kairos:cdd-spec-writer [P15] spec-fix-2） |
| v0.4 | 2026-10-20 | **spec-fix-3（review-3 findings 收口 · 4 warn + 5 nit）**：① warn——§3.2 定案相位行主键由 P-id 改为 `slug:`（今日 P-id 由 `-pN` 尾缀派生，`face/board-view.ts:426`），属 deliberate pin 重锚；AC 字节清单收窄为板头 / 进度标记 / `next:` / legend，`board-view.test.ts:1022` 只作 program 板形状锚；② warn——§4.2 `File path row` 的 judge 半句由 `PresenceInvariant` 改指 hollow（`PRESENCE_HOMES` 不含 `table`，`PresenceInvariant` 直接 `continue`；`HollowInvariant.tableHollow` `contract/invariants.ts:850-868` · `:255`）；③ warn——§4.2 补骨架槽类接线（`slug-ref` 并入 `contract/project.ts:595-599` 的 link 槽判 + `FRONT_MATTER_LINKS` 补 `program:` 条目，否则骨架吐 `:::fill`）；④ warn——§4.1 `slug-ref` 断言面补占位豁免（`isPlaceholder` `contract/invariants.ts:1114-1119`），AC 补骨架字节不被硬门判；⑤ nit——§2.1 `valuePattern` 并入长度上限（`^(?=.{1,128}$)…`）；⑥ nit——§4.2 零读断言收窄为「board 零读，引擎只判形状 / 链接存在性」；⑦ nit——§1.2 旗标挂载枚举补 schema，与 pin 表对齐；⑧ nit——§3.1 重复类单列 `slug: duplicated (BLOCKED)` 形；⑨ nit——pin 范围改到元素边界（`contract/declare.ts:388-402` · `:434-440`） | Oscaner M. · Claude（kairos:cdd-spec-writer [P15] spec-fix-3） |
