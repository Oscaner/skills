# 引擎文档工具（Engine Doc-Tooling）— P8 设计：`cdd board <slug>` slug 进度板 + 引擎统一 next 面（plan-graph 提级一等公民 · 文件系统唯一真源 · 全节点 verb×round 细粒度 · next 贯穿全 face×verb 到 skill ref）
- **Version**: v0.6 · 2026-10-14
- **Status**: Draft
- **Author**: Oscar M. · Claude Opus 5（kairos:cdd-design [P8] 会话 · 用户裁定 · 2026-10-14）
- **Parent program**: [引擎文档工具（Engine Doc-Tooling）Overall](2026-10-10-engine-doc-tooling-overall.md)
- **Depends on**: P7（Done · v0.9 · hard——P7 全链闭合后 plan-graph 升级一等公民 slug 进度板 · overall 依赖图 D32）

## Design

本 phase 承接 P7 收口后的续观测面能力（程序七 phase 收口后的续 phase · 2026-10-14 cdd-design [P8] 会话注册 D32 · grilling Q1–Q11 全按用户裁定落定）。**统一命题——`cdd` 的第一个「全局态势一面墙」命令 `cdd board <slug>`**：一条命令、slug 为唯一输入，把该 slug 所辖的整棵相位树的态势一次铺开——**定位（slug → overall/spec/plan 路径）· 进度（overall/spec/plan/wave/branch 全节点 · 每节点摊 implement/review/fix 三 verb 的轮次）· 指路（当前该执行的 cdd 命令或 skill ref）**。其来源是 `plan-graph`——它现为 `cdd schema get` 下的一个 **display 路由**（挂在一个*发现*命令上的*显示*路由 = 内聚性污点，且只吃 `--plan`、只看得见 wave 波链），本 phase 把它**升为独立一等公民命令**并扩展为 slug 进度板。

设计输入：kairos:cdd-design [P8] 会话（D32 注册 · grilling Q1–Q11 裁定）· overall v2.32（D32）· recon（引擎 CLI 命令注册面 · `plan-graph` 全触点 grep · `Workspace.slugFromDoc` 逆推导缺口 · 真实 `progress.json` 数据面 · `REFS[ref][host]` 现成 harness 拼写解析机制 · `docs/kairos/{specs,plans}` 相位文件命名实测：`-p3`/`-p3.1`/`-p4.1` 并存而 `-p4` 缺失）。

### 1. 目标与边界
#### 1.1 设计输入与授权
- 设计输入：kairos:cdd-design [P8] 会话（D32 注册 · Q1–Q11 全裁定 · **D33 统一 next 面折入**）· overall v2.32 → v2.33（D33）· recon 报告（引擎命令注册/声明面 · plan-graph 全触点 · slug 逆推导 · progress.json 实况 · REFS harness 拼写 · 相位文件命名实测 · 引擎 next 面接线：`#close`/`Capsule#routeText`/`RouteTarget.type`）
- **授权（六前提 · 用户 mandate）**：允许破坏性变更、重写代码重组目录、不保守不打补丁 · 从高维思考、OOP 抽象统一、零裸函数 · 最佳实践、不留技术债务、避免散文堆砌、避免声明再抄 · 高内聚低耦合、死代码空壳全清 · 消费者心智负担优先（不为完成任务而设计）· 最大程度重构整合、最大程度精简系统
- **不发布**（与 P1–P7 一致）：变更集归并落 pending · tag / publish = 独立动作
#### 1.2 判定基线（本 phase 的根前提）
- **`plan-graph` 是内聚性污点**：它现为 `cdd schema get` 的一个 `--output json` display 路由（`SCHEMA_TYPE_KEYS` 之外的透传特判 · `#parseTypeKey(raw, planGraph)` 的 leaf-level 旁路），消费面读作 `cdd schema get plan-graph --plan <path>`——**一个*显示*面挂在*发现*命令下**，且受限于单 `--plan` 输入、只渲染 wave 波链。本 phase 把它提为独立命令，`schema get` 回归纯 doc-structure 发现面。
- **slug 是一个节点地址 · 点分相位路径任意深度**：`<program-slug>[-p<主>(.<子>)*]`——`-p3` 与 `-p3.1` 与 `-p3.2.1` 同为相位节点，层级可无限衍生。**文件系统是唯一真源**：节点集合由**扫描** `docs/kairos/{specs,plans}` 得出，绝不按命名规则合成盘上不存在的节点（实测：`doc-architecture-v2` 族 `-p4.1` 存在而 `-p4` 缺失 · overall 自己的 File paths 表仍写 `p<N>` 占位符——声明面已与文件面脱节）。
- **进度数据面单一 · 数组身份形**：`progress.json` 的 `rounds[verb]`（**周期号数组** · D28 身份号：`[1,3]` 表第 1、3 轮，非计数）是唯一进度数据源；overall / spec / plan 各是进度行（overall 亦可被评 → 有自身轮次），与 wave 行（波键 `"1,2,5,8"`）、branch 行（键 `"branch"`）同构——**板是各节点自身 `progress.json` 的同一份数据的投影，零新数据、零新判定**。**只有数组形**（旧数字形不兼容 · 历史残留已清 · 用户裁定）。
- **harness 拼写解析现成**：`REFS[ref][host]`（face/host.ts）+ 运行时 host 判出（`lifecycle.ts:253` §）已承载 skill ref 的 per-harness 拼写——board 的 next 渲染 skill ref 时**复用**它，绝不硬编码某个插件的 `/kairos:cdd-plan` 拼写。
- **流水线序在 skills 与引擎各存一份 = 声明再抄**：引擎 `#close` 的 `done` 是无脑终词，而「spec 完该 plan / plan 完该 dev / dev 完该 branch review / branch 完该 close」这套序在 **skills 各存一份**（handoff 节点）。引擎持 `REFS` 全表 + CDD 阶段序——两处声明 = D33 折入的根因（六前提③）。
#### 1.3 保留面（冻结）
- `schema get` 的 doc-structure 发现面（json + skeleton 两 render face）不变——本 phase 仅退其 `plan-graph` display 透传。
- `GraphView` 的波板渲染语义（✔ done / ▶ current wave / ○ pending · W1-first 无零填充）不变——它由独立显示路由**降为 board 的一个 section 渲染器**（组件保留，接线改挂）。
- `Workspace.slugFromDoc`（doc → slug）不变；本 phase **新增其逆**（slug → doc 路径）于同一 `Workspace`（定位职责单源）。
- 六命令（implement / review / fix / base / schema / issue）行为语义零变化；`board` 为**新增第七命令**，纯读、零 enforcement、无副作用。
- `NextStepRouter`（C5 表）语义零变化；board 的 next **消费**它，不修改它。

### 2. 命令面：`cdd board <slug>` 一等公民
#### 2.1 命令注册（`CliVerb` 六 → 七）
- `face/declare.ts`：`CliVerb` 联合类型（:154）增 `"board"`；`CLI_COMMANDS` 数组增 `board` 行——`name: "board"` · `description`（如 `"render the slug progress board (overall/spec/plan/wave/branch)"`）· `keys` 含通用 `root` · `positionals` 含必填 `slug` · `example`（如 `cdd board 2026-10-10-engine-doc-tooling-p7`）。
- 命令落根为**扁平第七叶子**（与 `schema`/`issue` 同级），无嵌套子命令。
- `slug` 为**必填位置参数**（它就是全部输入，位置参数最自然）；`--root` 为通用 repo 根覆盖（与 `implement/review/fix/base` 一致）。
#### 2.2 纯读命令分派（`#runBoard`）
- 在组合根 `face/cli.ts` 增 `#runBoard(node, parsed)`。它**无 preflight gate**（board 是纯观测面，不派发 child、不写树、不写 ledger）：逻辑 = slug 解析 → 节点树装配 → 板渲染 →（可选）next 派生 → stdout。返回退出码 `0`（成功）/ `2`（用法错）。
- 无匹配文件 → exit `2`（board 是实况工具，对着不存在的节点铺墙即撒谎）；缺 slug → usage（exit `2`）。
#### 2.3 `plan-graph` display 路由整体退役
- `#runPlanGraph`（cli.ts:756）删；`#runSchema` 的 `if (type === "plan-graph")` 分支（:751）与 skeleton 面 plan-graph 拒绝分支（:737-741）删；`SCHEMA_TYPE_KEYS`（declare.ts:289）注释的 plan-graph 旁路叙述删；`projection.ts #parseTypeKey(raw, planGraph)` 的 `planGraph` 参数整体删（签名收为 `#parseTypeKey(raw)`），其 `available:` 报错的 `", plan-graph"` 拼接删。
- **`plan-graph` 作为词从引擎消失**：显示路由退 + 内部 preflight **门名**同步改名（§3.1）。

### 3. 内部面：`plan-graph` 门名退役（一概念一名）
#### 3.1 preflight 门名 `plan-graph` → `graph`
- `session/preflight.ts`：`PreFlightGateName`（:38）的 `"plan-graph"` → `"graph"`；**`PreFlightReason`（:41-43）是独立联合、另携自身的 `"plan-graph"` 成员——该成员同步改 `"graph"`**（AC 的「`plan-graph` 字面零命中」要求两联合皆改）；`PreFlightVerdict` 的 gate/reason 腿同步；`gates.push("plan-graph")`（:147）→ `"graph"`；verdict 的 `gate: "plan-graph"`/`reason: "plan-graph"`（:153-154）→ `"graph"`；注释段（:6/:10/:142）叙事随改。
- `face/words.ts`：`planGraph` 词条键（:72/:111）→ `graph`（模板文本「the plan graph has {count} edge violation(s) — fix the **DependsOn** edges first」不变，仅键名对齐）。
- 该门是**对 plan 的 `DependsOn` 图做结构校验**（missing-edge / missing-id / self-loop / cycle），`graph` 一词直觉准确。按 D29 黑盒边界，门名非消费面可见——内部改名 + colocated pin 更新。
- **连带**：`cli.ts #renderPreflightBlocked` 对 `verdict.gate === "wave"` 的判分支不变；`plan-graph`/`wave` 两 gate 的既有 refusal face 语义零变化（仅 gate 名改）。

### 4. 定位面：slug → 节点树（文件系统唯一真源）
#### 4.1 doc-root 常量单源
- `infra/runtime.ts`（`ENGINE_RUNTIME`）增 doc-root 常量——`specs: "docs/kairos/specs"` · `plans: "docs/kairos/plans"`（与 skills 现约定字面一致）。**不发明 config/env 覆盖面**（引擎 config 面全是编译期常量、零文件读、零 env——发明覆盖违架构）。
#### 4.2 `Workspace` 逆推导（slug → doc 路径）
- 现 `Workspace.slugFromDoc(doc)` 是 doc → slug（strip `.md` + 一个尾 `-design`/`-plan`）。新增其**逆**——`Workspace.docsOfSlug(slug, root)`（类成员 · 零裸函数）：解析 slug 的相位后缀 `-p<主>(.<子>)*$`——
  - **程序 slug**（无相位后缀）：`overall = <root>/docs/kairos/specs/<slug>-overall.md`（若存在）；子相位 = 扫盘 `specs/<slug>-p*.md` 的相位后缀集合。
  - **相位 slug**（有相位后缀 `<N>`）：`overall = 剥整段 -p… 后的程序根` 的 `<program>-overall.md`；`spec = specs/<slug>-design.md`；`plan = plans/<slug>.md`；**不解析 overall 的 File paths 声明表**（消声明再抄）。
  - 相位后缀树化：扫盘命中的文件按点分相位路径**建真实存在的节点树**——不合成盘上不存在的父节点（`-p4.1` 存在而 `-p4` 缺失时，`p4.1` 直接挂程序根，其父级仅作显示层级）。
#### 4.3 扫描即真源
- 节点集合、每个 artifact 的存在性，全部来自**文件系统扫描**（`readdirSync`），绝不来自解析 overall 的 Phase inventory 表（该表已实测陈旧）。
#### 4.4 artifact 头块读取（版本/Status）
- 每个存在的文档读其头块——`**Version**`/`**Status**`（复用 `doc.ts` 的 header-line parse 面 · `HeaderParsed.headerLines`）。overall 行同构展示 Version · Status（不特殊化）。

### 5. 进度面：全节点 verb×round 细粒度板
#### 5.1 数据源（每节点读自身工作区 · 单源投影）
- 板**按节点读各自的 `progress.json`**（`Ledger`）：**overall 读 `<program>-overall/` 工作区 · 每个 phase 读 `<program>-p<N>/` 工作区**（节点 → 工作区目录由 slug 派生 · §4.2）。每行摊 `implement×N · review×N · fix×N`（`progress.rounds[verb]` 的**周期号数组** · D28 身份号：数组元素 = 第几轮（如 `[1,3]` 表第 1、3 轮），**非计数**）。**overall 线**（overall 可被 `cdd review --type spec --spec <overall>` 评审 → 有自身 review/fix 轮次）· **spec/plan 线** · **wave 线**（波键 `"1,2,5,8"`）· **branch 线**（键 `"branch"`）全部同构展示，**overall 不特殊化**。
- **rounds 只有数组形**（身份面 · 用户裁定）——`{ "review": [1,3] }`；旧的数字形（纯次数 `{ "review": 3 }`）**不兼容**（历史残留已清 · 无兼容层 · 消技术债 六前提③）。
#### 5.2 wave 行：每波一行 + 波链与明细同现（Q8(b)）
- wave 行**每波一行**：波号 + 该波在 `GraphView` 波链中的 ✔/▶/○ 标记 + 该波键的 `implement×N · review×N · fix×N` 明细。多波不发散内联（每波独立一行），避免行宽爆炸。
- 波链标记与明细取自同一 `TaskGraph.report(closedWaves())`（`GraphView` 复用）+ 该波 `progress` 行——**同一 `closedWaves()` 读**（与 preflight gate 同源 · 一处实况）。
#### 5.3 布局（Q8 · 用户确认形状）
- **phase 板**（slug 带 `-p<N>`）：
```
cdd board: 2026-10-10-engine-doc-tooling-p7

  overall  <path>  v2.33 · Draft
  spec     <path>  v0.14 ✔ Done   review×6 · fix×5
  plan     <path>  v0.9  ✔ Done   review×2 · fix×2
  wave     W1 ✔  implement×1 · review×1 · fix×1
           W2 ✔  implement×1 · review×2 · fix×1
           W3 ▶  implement×1 · review —
           …
  branch   ✔ closed   branch-review×1 · fix×1

  next:    done
```
- **program 板**（slug 无相位后缀）：展 overall 行（**含其自身 review/fix 轮**）+ 每个 phase 一行——
```
cdd board: 2026-10-10-engine-doc-tooling

  overall  <path>  v2.33 · Draft   review×4

  phase P1  ✔ Done   spec review×N · plan review×N · wave W1… · branch …
  phase P2  ✔ Done   …
  phase P7  ✔ Done   …
  phase P8  ○ Pending

  next:    done          ← 跨 phase 不参与 next（F4'(a)）
```
- overall 行**含自身 rounds**（F1 更正：overall 也可被评审 → 有 review/fix 轮）；program 板的 phase 行是**该 phase 的态势摘要**，其 `next` 不由 program 板递归下发（跨 phase 不参与 · F4'(a)）。
- **program 板 / phase 板的 `next` 字面与引擎 next 面一致**（F4'(a) · 消费同一 `PIPELINE_NEXT` 渲染 · §6）。
- 固定 legend 尾行（同 `GraphView` 现风格）：`progress: ✔ done · ▶ current · ○ pending`。
- 缺 plan 的中间层级节点：wave 段留空（不报错）；无 overall：overall 段留空（降级不报错）。

### 6. 引擎统一 next 面：`next:` 贯穿全 face×verb（D33）
#### 6.1 命题（引擎成为唯一流水线路由器）
- 现状：引擎的 next 只有**face 内转移**（C5 表）——doc 线（spec/plan）与 branch 线恒无 ready batch → 耗尽即渲 `next: done`（无脑终词）；而 **face 间转移**（spec 耗尽该 plan、plan 耗尽该 dev、wave 耗尽该 branch review、branch 耗尽该 close）**在 skills 各存一份**（cdd-spec-writer 的 `handoff-cdd-plan` 节点 · cdd-plan 的 `handoff-cdd-dev` · cdd-dev 的交接）——与引擎将持的同一条接线**重复声明**（六前提③ 声明再抄）。
- 裁定（D33）：**补上引擎缺的 face 间接线面**——一台新 `PIPELINE_NEXT` 表按 face 线型把「耗尽 → 下一 face 入口」编码进引擎；引擎成为唯一路由器，skills 侧 handoff 节点溶解。
#### 6.2 两台转移表（face 内 vs face 间 · 职责分家）
- 统一 next 面由**两台表**组成，不再有第三处：
  | 表 | 域 | 转移 | 状态 |
  |---|---|---|---|
  | **C5 表**（`NextStepRouter` · session/next.ts） | **face 内** | `review⇄fix` · wave 的 `wave_i → wave_{i+1}`（`next-wave`）· 闭合（`done`） | **已存在 · 本 phase 不动** |
  | **`PIPELINE_NEXT` 表**（新） | **face 间** | 一 face 耗尽（`done`）→ **下一 face 的入口字面** | **本 phase 新增 · 单源** |
- 本 phase 的实质是**补 face 间的接线面**——face 内转移（含 review 有无 findings→fix、wave 波推进）**系统已有**，不重述、不改（消声明再抄 · 六前提③）。
#### 6.3 face 间接线面（本 phase 的焦点 · 完整链）
- 完整流水线与**各接线点**（`→` 为 face 间 = `PIPELINE_NEXT` 表的一行；`⋯` 为 face 内 = C5 表）：

  ```
  [spec face]  ─done→  /kairos:cdd-plan   ──→  [plan face]
     ⋯ review⇄fix (C5)                            ⋯ review⇄fix (C5)
  [plan face]  ─done→  /kairos:cdd-dev    ──→  [wave faces]
     ⋯ implement→review⇄fix · wave1→wave2→…→waveN (C5 next-wave)
  [wave faces] ─done→  review --type branch --plan <plan>  ──→  [branch face]
     ⋯ branch-review⇄branch-fix (C5)
  [branch face]─done→  /kairos:cdd-close
  ```
- **接线语义**：一 face 的 C5 表走到 `done`（该 face 内无可推进动作）时，`PIPELINE_NEXT` 按**该 face 的线型**给出**下一 face 的入口**——引擎命令（wave→branch review）或 skill ref（其余三处）。这是**唯一新增的路由职责**。
- 一张 `PIPELINE_NEXT` 常量表，**单址定于 `session/next.ts`**（与 `NextStepRouter` 同居——两张转移表同文件 = face 内/face 间路由单源；类成员/常量 · 零裸函数）：
  | 耗尽 face | 接线字面（下一 face 入口） | 形态 |
  |---|---|---|
  | spec | `/kairos:cdd-plan` | skill ref（`REFS` 取 per-harness 拼写） |
  | plan | `/kairos:cdd-dev` | skill ref |
  | wave（全波闭合 · C5 表 `done`） | `review --type branch --plan <plan>` | 引擎命令（前缀省略 · 与 `Capsule#routeText` 字面逐字节一致） |
  | branch | `/kairos:cdd-close` | skill ref |
- **表的键是 doc-class 键、不是 `RouteTarget.type` 单值**：overall-spec 与 phase-spec 皆携 `type: "spec"`（overall 亦以 `review --type spec --spec <overall>` 评审），单靠 `type` 无法区分二者。`PIPELINE_NEXT` 的查表键取**由 target 路径派生的 doc-class**（overall-spec vs phase-spec —— 由 `<program>-overall` 文件名判定），**非 `RouteTarget.type` 裸值**：(a) phase-spec 耗尽 → spec 行 → `/kairos:cdd-plan`；(b) **overall 线耗尽 → `done`**（overall 是 program 级文档，其闭合后的推进 = 跨 phase，**不在 next 内** —— 与「止于 close · 不跨 phase」一致 · F4'(a)）。
- **接线字面一律前缀省略**：表内 wave 行的引擎命令去掉 `cdd` 前缀——引擎既有的 `next:` 字面皆无 `cdd` 前缀（`Capsule#routeText` 渲 `implement`/`review`/`fix` 裸动词），board 的 `next:` 须与引擎字面逐字节一致（§6.5），故 PIPELINE_NEXT 亦写 `review --type branch --plan <plan>`（不含 `cdd`），否则 board 与 capsule 因 `cdd` token 分叉。
- **链尾**：`/kairos:cdd-close`（**引擎 next 止于此 · 不跨 phase** · 用户裁定：任何目标是 `cdd-design` 的推进 = 跨 program/phase，不在 next 内；`overall→下一 phase` 亦属跨 phase · 线序不由 `targetFaces` 猜而是显式此表）。
#### 6.4 渲染落点（face 间转移落 `done` 的渲染 · 最小改动面）
- `done` 的**渲染**在 `Capsule#routeText(route, target)`（face/capsule.ts:117）——该处已收到 `RouteTarget`（含 `.type`）。**`case "done"` 由 `words.routeWord("done")` 改为查 `PIPELINE_NEXT[<doc-class 键>]`**（按线型渲下一 face 入口 · 键语义见 §6.3）。
- **渲染面须持 host**：`Capsule` 现构造为 `new Capsule(words, ARGV_CHANNEL)`（cli.ts:467），**不持 host**；host 检测今仅在 `CliLifecycle.detectHost()`（lifecycle.ts:152 · 唯一调用者即其自身 `#dispatch` :180）内，从 `cli.ts` **不可达**（cli.ts 零 `detectHost` 引用）；`cli.ts` 的工作入口是**单一** `#runWork`（:379 · 分派于 :318）——**无 per-verb 的 `#runImplement/#runReview/#runFix` 方法**；且 **`--dry-run` 路径**（`#dispatchOf` cli.ts:558）返回注入/合成 step 而**根本不构造 `CliLifecycle`**，而 module byte pin 皆跑 `--dry-run`，故该路径下当前无 host 可检测。
  - **host 源（(a) 定案）**：把 host 判定**上提为 `host.ts` 的模块级判定**——检测行数据（`HOSTS`）本已在该文件，把判定逻辑从 `CliLifecycle.detectHost` 抽为模块级纯判定（输入 `ProcessEnvLike` · 零裸函数纪律下即 `HostContract` 上的类/常量成员调用）；`CliLifecycle` 改为**委托**该模块级判定（行为零变化 · 消重复），组合根 `#runWork` 构造 `Capsule` 时以 `process.env` 调用同一判定并**把结果 host 穿线进 `Capsule`**（构造注入 · 与 `words`/`ARGV_CHANNEL` 同层）。如此 host 源在**所有路径（含 `--dry-run` 合成 step）恒可达**——不需 per-verb 方法、不需构造 `CliLifecycle`。使 spec/plan/branch 三行的 skill ref 能渲 `/kairos:cdd-plan`（claude/cursor）或 `/skill:cdd-plan`（pi）形。**不硬编码**。
  - **无 host / dry-run 兜底拼写**：判定返回空串（无 host session env，如 CI/`--dry-run`）时，skill ref 渲**默认 harness 拼写**（claude 形 `/kairos:cdd-plan` · 即取 `REFS[ref]` 的 claude 列）——host 为空回退 claude 形，**绝不硬编码单插件拼写、绝不抛错**（与 §6.4 末的「无 target 兜底裸词 `done`」同为无损降级）。（备选 (b)：把 `PIPELINE_NEXT` 查表搬到持 host 的 face——本 spec 采 (a)，因 host 源抽到模块级后 `Capsule` 单点注入即最小改动面。）
- **`case "done"` 的缺 target 兜底**：现有 byte pins `face.test.ts:91/235/287` 以**无 target** 的 `{kind: "done"}` 调 `emit`——此时 `target` 为 `null`/`undefined`，doc-class 键不可派生。兜底 = **回退渲裸词 `done`**（`words.routeWord("done")`，即现状字面）——无 target 即无 face 线型可路由，渲终词是唯一无歧义选择；有 target 才查表。
- **C5 表零改动**——face 内转移（`next-wave` 渲下一波 `cdd implement --type wave --tasks <tasks> --plan <plan>` · `review`/`fix` 渲原字面）**不变**；只有 `case "done"` 这一个渲染分支改成查表（`next-wave` 与 `done` 在 `route.kind` 层已区分 · 零歧义 · 消 v0.1 悬案）。
- skill ref 的 per-harness 拼写：`REFS[ref][host]`（face/host.ts · `lifecycle.ts:253` 同款机制），claude/cursor 渲 `/kairos:cdd-plan`，pi 渲 `/skill:cdd-plan`。**不硬编码插件拼写**（引擎持 `REFS` 全表 = 非新耦合 · D29 黑盒边界不破：引擎只发"下一 face 入口 ref"，不碰 skill 内部）。
#### 6.5 board 的 next（face 间表的黑盒消费者 · 字面一致）
- board **不自建 next 表**——其 `next:` 行**与引擎 next 面字面一致**（F4'(a) 用户裁定）：按线序（spec→plan→wave→branch）对每条 face 求「该 face 走到 `done` 时的 `PIPELINE_NEXT` 入口」，取**第一条未耗尽 face 的动作**。
- **统一 next 正好给 board 当消费验证**（A 用户裁定：不拆 P9——board 是 face 间接线表的黑盒消费者，其渲染正确性即该表的验证）。
- **program 板**：`next:` 与引擎 next 面字面一致，**跨 phase 不参与**（F4'(a)）——program 板恒 `done`（单 phase 的 next 由其 phase 板承载）。
#### 6.6 `next:` 是编排器的唯一驱动（Next-Loop · C 用户裁定）
- **next 都是字面**——编排器（skill）**基于 `next:` 字面执行下一步计划**，此即 Next-Loop：如 spec face 的 next 渲 `/kairos:cdd-plan` → 编排器据此调起 cdd-plan。**引擎 next 面 = 编排器的唯一驱动源**，skills 不再自持 face 间接线（handoff 节点溶解 · §7）。
- 后果：engine 的 `next:` **从"face 内回合一格"升为"face 间下一站"**——这是对 **P5 冻结的「`next:` 字面」契约的 deliberate pin break**（显式登记 · 与 P1 usage 重写 / P3 commander 原生化同级 · 实现期不被当回归拦下）。
- **既有 `next: done` byte pins 翻转**：D33 的 `case "done"` 改查表后，**既有 `next: done` 断言在 phase-spec/plan 线与 wave 线闭合处翻转**——wave 线闭合（如 `cli.test.ts:1451` tasks-1 全闭合）现渲 branch-review 字面，phase-spec/plan 线闭合现渲 skill ref（**overall 线例外**：其闭合按 §6.3 的 doc-class 规则仍渲 `done`，`cli.test.ts:1826` 保持绿 · 非「每条 doc 线皆翻转」）。这些是**同一 deliberate pin break 的既有 pin**，须在 §9.3 与 plan-graph pins 一并重锚为「非 `done`」新字面（见 §9.3）。

### 7. skills 侧 handoff 节点溶解（D33）
#### 7.1 溶解面
- `packages/kairos/skills/cdd-spec-writer/SKILL.md`：`handoff-cdd-plan` 节点删（其「交接给 `/kairos:cdd-plan`」语义折入引擎 next 的 spec 行）；NEXT-LOOP 退化为「读 `next:` → 照抄执行/交接」（`next: done` 不再出现于 doc 线，改为 skill ref）。
- `packages/kairos/skills/cdd-plan/SKILL.md`：`handoff-cdd-dev` 节点删（同折入）。
- `packages/kairos/skills/cdd-dev/SKILL.md`：交接节点溶解（wave 闭合 → branch review 命令由引擎发；branch 闭合 → `/kairos:cdd-close`）。
- `packages/kairos/skills/cdd-close/SKILL.md`：入口即由引擎 next（`/kairos:cdd-close`）抵达——其自身无 outgoing handoff 节点需删（它就是终点）。
#### 7.2 skill-anatomy 契约同步（**硬阻塞** · 非"可能"）
- `contract/skill-anatomy.ts` 的 digraph 契约 + `SkillAnatomyCheck`（packages/kairos/tests/skill-anatomy.test.ts）：handoff 节点溶解后，**本文档的节点注册表与 NEXT-LOOP 出边断言必须同步**——否则 skill-anatomy 机器检查红。这是 handoff 溶解的**前置契约同步**（非可选）。实测现状：skills 的 handoff 节点**仍在**（v0.2 时点 · `handoff-cdd-plan`/`handoff-cdd-dev`/`handoff-cdd-close`/cdd-design 的 `handoff-next`），故 §7.1 的溶解是**待实现面**。
- **loop-shape 不变式本身被重定义**（非仅「注册表 + 出边断言」重同步）：契约现强制「每个 loop-family skill 的 digraph 携带一个 `handoff-*` 终端」——`loopHubNode.rowPrefixes: ["handoff-"]`（skill-anatomy.ts:151）· `nextLoopConditions: ["until next=done", "next=done", "no next"]`（:156）· `loopShapeRule`（:214-215 · 「…+ a handoff-* terminal」）· `edgeConditionRule`（:218）。handoff 溶解**直接废弃 `handoff-*` 终端这一强制**，故这些字段须**改定义**，本 phase 显式登记：
  - `loopHubNode.rowPrefixes`：`["handoff-"]` → 空（NEXT-LOOP 不再有 handoff 行前缀）。
  - `nextLoopConditions`：`next=done` 由「闭合出口」重定义为**退化**——doc 线的 `next: done` 不再出现（改为 skill ref），NEXT-LOOP 退化为单一出口「照引擎 `next:` 字面执行」；条件词表随之重写（**删 `next=done` 成员** · 保留 `no next` BLOCKED 面），成为 `["until next=done", "no next"]`（自环 **+** BLOCKED 两面）。
- **溶解后 NEXT-LOOP 的出边形状（显式固定）**：契约现硬断言 hub 恰携**三条**出边（`skill-anatomy.test.ts:410` 的 `out.length === 3`）——`until next=done` 自环（`:392`）· `next=done` 闭合出口入终端（`:390`/`:398`）· `no next` BLOCKED 面（`:406`）。handoff 溶解 + `next=done` 闭合出口废弃后，形状收敛为**两条**出边：**`until next=done` 自环 + `no next` → BLOCKED 终端**（闭合出口那条删）。故 checker 常量同步为：`out.length === 3` → `=== 2`（:410）；闭合出口断言块（`doneExit` 查找 + 其 terminal 目标断言 · :390/:398 及对应 finding 文案）**整体删**；自环标签断言（:392 · `until next=done`）**保留**（自环语义不变，仍表「循环照 `next:` 字面执行」）；词表断言（:419 经 `conditions = anatomy.digraph.nextLoopConditions` :383）随 `nextLoopConditions` 去 `next=done` 成员后自动收窄为两面。
- **出边集未定的对照面**：`loopHubNode.rowPrefixes` 改空后，契约中「每个 loop-family skill 必携 `handoff-*` 行」的注册断言（`skill-anatomy.test.ts:322` 遍历 `rowPrefixes`）对流水线衔接 skill 不再触发——三 skill 的 `handoff-*` 行删除后注册表零残留。
  - `loopShapeRule`：删「+ a handoff-* terminal」子句——**NEXT-LOOP 退化为单一「执行引擎 `next:` 字面」出口**。
  - `edgeConditionRule`：`handoff-*` 出边条件的断言随溶解删除。
- **cdd-design 的 `handoff-next` 不在本 phase 范围**——它是 design 会话内部的续环（转下 phase 的 design = 跨 phase，恰是 next 不参与的域 · §6.3）；本 phase 只溶解**流水线衔接**的 handoff（cdd-spec-writer/cdd-plan/cdd-dev），cdd-design/cdd-close 的终端语义不动。故 `rowPrefixes` 改空仅作用于「流水线衔接 handoff」域，其余终端语义不动。
- 溶解后 NEXT-LOOP 的出边应统一为「照引擎 `next:` 字面执行」（单一出口 · 无条件词表分支）。
#### 7.3 消费面文本
- 消费面 NEXT-LOOP 不再复述任何 `next:` 字面（本就已 P5 精简）——本 phase 进一步**删去 handoff 节点**，字面更少。

### 8. 六前提重构整合（破坏性 · 重组 · 零裸函数 · 死码清理 · 最大精简）
#### 8.1 组件升降与目录
- `GraphView`（face/graph-view.ts）由「独立显示路由的渲染器」降为「board 的 section 渲染器」——文件保留（组件仍有价值），接线改挂到 board 组合面。
- 新增 board 组合面（渲染器）——**OOP 类**（零裸函数），持：slug 解析（§4）· 节点树装配 · 各 section 渲染 · next 派生（§6）。board 与 `Capsule`/`GraphView` 的分工：`Capsule` 渲「一轮的输出胶囊」，`GraphView` 渲「一波板」，board 渲「一 slug 的全局墙」——三者同层，board 组合其余两者。
#### 8.2 死码/空壳清理
- `plan-graph` display 路由的 leaf 分支、`#parseTypeKey` 的 `planGraph` 参数、`SCHEMA_TYPE_KEYS` 注释旁路——全删（§2.3）。`plan-graph` 门名改（§3.1）。
#### 8.3 零裸函数
- 新增/改动面全为类成员（`Workspace.docsOfSlug` · board 渲染类的方法）——合 `check:no-bare-functions`（全局 `^export function|^function` 零命中）。
#### 8.4 声明再抄抑制
- slug → 路径从 slug 推导（不解析 overall 表）；face 间接线序（含下一站字面）从 `PIPELINE_NEXT` 单表取（不另写表 · 不由 `targetFaces` 猜）；skill ref 从 `REFS` 表取（不硬编码）。零平行声明。

### 9. 消费面同步
#### 9.1 六命令引用更新（六 → 七）
- `packages/cdd-engine/README.md`：**CLI 表**（`## CLI` 段 :23）增 `board` 行——机器检查 `presentation-surface.test.ts:278-286` 迭代 `CDD_SUBCOMMANDS` 对**引擎 README 的 `## CLI` 段**断言每命令一行（`^\|\s*`board``）；漏此则「ALL PASS」不可满足。`packages/cdd-engine/README.zh-CN.md` 镜像同改。
- `packages/kairos/README.md`：命令清单（:71 · `implement / review / fix / base / schema / issue`）增 `board`；**顺序须与 `CDD_SUBCOMMANDS` 成员序一致**——机器检查把该清单断言为 `CDD_SUBCOMMANDS.join(" / ")`（`presentation-surface.test.ts:291`），故 `board` 须按常量的声明位追加，非仅「增 board」。`packages/kairos/README.zh-CN.md` 同改。
- `packages/kairos/tests/presentation-surface.test.ts`：`CDD_SUBCOMMANDS`（:51）增 `"board"`；相关 README 断言（:278-286 引擎 README CLI 表断言 · :291 kairos README 全命令面断言）随改。
- `packages/kairos/tests/skill-anatomy.test.ts`：命令捕获正则（:253 · `cdd (implement|review|fix|base|schema|issue)`）若无 `board` 引用需求则不动；若 skills 文本引用 board 则需增。
#### 9.2 消费面 skill 文本
- 若有 skill 引用 `plan-graph` 或需引导用 `cdd board`——由 author 节点表述承载（消费面指引归 skills）。recon 确认 skills 文本当前零 `plan-graph` 引用（无需改）。
#### 9.3 pin 重锚（破坏性 · deliberate）
- `face/__tests__/cli.test.ts` 的 plan-graph pins（unknown schema type 报错文本含 `, plan-graph`（:627/:2951/:3361）· skeleton 拒绝（:664-675）· `schema get plan-graph` 读（:2636/:2661/:3403-3412））——全量重锚为 `board` 命令断言 + unknown schema type 报错文本去 `, plan-graph`。
- `face/__tests__/projection.test.ts` 的 `plan-graph passes through`（:185-193）· `face/__tests__/graph-view.test.ts` 的 title 字面（:22/:25）——随 `graph` 门名/board 重锚。
- `session/__tests__/preflight.test.ts` 的 gate 名 pins（若有 `plan-graph` 字面）——重锚为 `graph`。
- **六命令结构性 pins 重锚（第七命令把 `toEqual` 精确列表打红）**：`face/__tests__/cli.test.ts:388`（`expect(CLI_COMMANDS.map(n => n.name)).toEqual([implement,review,fix,base,schema,issue])`）与 `face/__tests__/projection.test.ts:57`（`expect(program.commands.map(n => n.name())).toEqual([...same six])`）——两者皆为 `toEqual` 精确列表，`board` 第七行加入即红，须重锚为**七行**（`board` 按 `CLI_COMMANDS` 声明位追加）。**无需重锚**：`--help` 的逐 verb 循环（`cli.test.ts:995` 的 hardcoded `["implement","review","fix","base","schema","issue"]` 与遍历 `CLI_COMMANDS` 的动态循环）不因第七行翻红，仅精确列表断言属重锚集。
- **既有 `next: done` byte pins（§6.6 同一 deliberate pin break 的既有 pin · 须重锚）**：`face/__tests__/face.test.ts:91/235/287` · `face/__tests__/cli.test.ts:1451/1630/1782/1860/1907/2082/2104/3461`——D33 的 `case "done"` 改查表后，wave 线闭合（如 `cli.test.ts:1451` tasks-1 全闭合）现渲 branch-review 字面，spec/plan 线闭合现渲 skill ref，**这些 `next: done` 断言逐条翻转**（**非「每个」**）。**例外（不翻转，保持绿）**：`cli.test.ts:1826` 是 overall 线（`review --type spec --spec o1-overall.md`）——按 §6.3 的 doc-class 规则 overall 闭合仍渲 `done`，其 `toContain("next: done")` 不在翻转集内（登记为**唯一不翻转的 doc-line pin**）；`cli.test.ts:2340` 是 `not.toContain("next: done")` 的否定断言，亦不在翻转集内。逐一登记为 deliberate re-anchor（非回归）。
- **统一 next 面 pins（新）**：doc 线（spec/plan）闭合 → `next:` 渲 skill ref（非 `done`）· overall 线闭合 → `done`（跨 phase 不参与）· branch 线闭合 → `/kairos:cdd-close` · wave 线闭合 → `review --type branch --plan <plan>`（前缀省略 · 与 capsule 逐字节一致）· 无 target 的 `{kind:"done"}` → 兜底裸词 `done` · skill ref 按 harness 拼写（claude/pi 两形）。

### Acceptance criteria
- `cdd board <slug>` 输出全局态势板：overall/spec/plan/wave/branch 五行 + 各 `implement×N · review×N · fix×N` + wave 每波一行（波链 ✔▶○ + 明细）+ 固定 legend + `next:` 行
- slug → 三文档路径以**文件系统为唯一真源**：扫描 `docs/kairos/{specs,plans}` 命中 `<slug>*` 树化 · **不合成盘上不存在父节点**（`doc-architecture-v2` 族 `-p4.1` 存在而 `-p4` 缺失场景正确树化）· **不解析 overall File paths 表**
- 点分相位路径任意深度：`-p3` · `-p3.1` · `-p3.2.1` 同为相位节点
- next 全 line × 全 verb 严格线序（spec→plan→wave→branch）：spec 闭合 → 取 plan 线动作 · wave1 闭合 → 取 wave2 的 implement · review 有 findings → 取该线 fix
- **引擎统一 next 面（D33）**：`next:` 由「本线回合一格」升为「CDD 流水线下一站」——spec 线（**phase-spec · doc-class 键**）全闭合 → `/kairos:cdd-plan`（skill ref）· plan 线全闭合 → `/kairos:cdd-dev`（skill ref）· wave 线全闭合 → `review --type branch --plan <plan>`（引擎命令 · **前缀省略 · 与 capsule 逐字节一致**）· branch 线全闭合 → `/kairos:cdd-close`（skill ref）· **overall 线闭合 → `done`（跨 phase 不参与）**· **止于 `/kairos:cdd-close`（不跨 phase）**
- **next 是编排器唯一驱动**（C）：编排器基于 `next:` 字面执行下一步（Next-Loop）· **board 的 next 与引擎 next 面字面一致**（F4'(a)）
- **skill ref 按 harness 渲拼写**：claude/cursor → `/kairos:cdd-plan` 形 · pi → `/skill:cdd-plan` 形（经 `REFS[ref][host]` + **模块级 host 判定**（`host.ts` · `CliLifecycle` 委托同一判定 · 组合根 `#runWork` 以 `process.env` 调用并穿线入 `Capsule`）· **全路径（含 `--dry-run` 合成 step）恒可达**）；**无 host 回退 claude 形 · 不抛错**
- 引擎命令型 next 为**完整可执行命令**（`cdd implement --type wave --tasks <ready> --plan <plan>` 等）
- **wave 线 next-wave/done 判别**：`next-wave`（有未闭合波）→ 下一波 implement · `done`（全波闭合）→ branch review（渲染层按 route.kind 判别 · 零歧义）
- **skills 侧 handoff 节点溶解**（cdd-spec-writer/`cdd-plan`/`cdd-dev` 的流水线衔接节点；cdd-design/cdd-close 终端语义不动）：节点零残留；NEXT-LOOP 退化为同一句「照 `next:` 字面执行」
- **skill-anatomy 契约同步**（`SkillAnatomyCheck` 节点注册表 + NEXT-LOOP 出边断言随 handoff 溶解更新 · 硬前置）：**loop-shape 不变式被重定义**——`loopHubNode.rowPrefixes`（`["handoff-"]` → 空）· `nextLoopConditions`（删 `next=done` 闭合出口语义）· `loopShapeRule`（删「+ a handoff-* terminal」子句）· `edgeConditionRule`（删 `handoff-*` 出边条件）四处契约字段同步改定义（非仅注册表/断言重同步）· **溶解后 NEXT-LOOP hub 出边形状固定为两条**（`until next=done` 自环 + `no next`→BLOCKED；闭合出口删）· checker 常量同步（`skill-anatomy.test.ts:410` `out.length` `3`→`2` · 闭合出口断言块 `:390/:398` 删 · 自环 `:392` 保留 · 词表断言 `:419` 随 `nextLoopConditions` 收窄）
- `plan-graph` 作为词从引擎消失：`schema get` display 路由退（leaf 分支零命中）· `SCHEMA_TYPE_KEYS` 旁路注释零命中 · `#parseTypeKey` 的 `planGraph` 参数零命中 · preflight 门名 `graph`（`plan-graph` 字面零命中）
- `cdd board` 无副作用（零写树 · 零写 ledger · 零 child 派发）· 缺 slug / 无匹配文件 → exit 2
- `CliVerb` 七值 · `CLI_COMMANDS` 含 board 行 · 消费面六→七命令引用同步（kairos README ×2 + presentation-surface.test）
- 零裸函数（全局 `^export function|^function` 零命中）· 引擎 vitest 全绿（含 board colocated pins + **七命令结构 pins 重锚**（`cli.test.ts:388` + `projection.test.ts:57` 精确列表由六行改七行）+ plan-graph pins 重锚 + 统一 next 面 pins）
- `pnpm run validate` ALL PASS · 不发布

## Constraints
- **文件系统唯一真源**：节点集合、artifact 存在性全来自扫描，绝不合成盘上不存在的节点，绝不解析 overall 的 Phase inventory / File paths 声明表
- **一概念一名**：`plan-graph` 作为词整体消失（显示路由 + preflight 门名）；board 是新词
- **skill ⇄ engine 黑盒边界（D29）**：board 的 next 渲染 skill ref 经 `REFS[ref][host]`，不硬编码插件拼写
- **判定面单源（D26 家族）**：board 的进度读是 `progress.json` 单源投影，波链与 preflight gate 同 `closedWaves()` 读；next 消费 `NextStepRouter` 不修改它
- **统一 next 面单源（D33）**：face 间接线从 `PIPELINE_NEXT` 一张表取（**单址 `session/next.ts`** · board §6.5 消费它，字面一致，不另建序）；C5 表（face 内）**不动**，face 间 `done`→下一入口的渲染落 `Capsule#routeText` 渲染层（**doc-class 键判别**——overall-spec vs phase-spec 由路径派生，非 `RouteTarget.type` 裸值；无 target 兜底裸词 `done`）· 接线字面**前缀省略**（`review --type branch --plan <plan>` 无 `cdd`）
- **引擎 next 止于 `/kairos:cdd-close`**（不跨 phase · 任何目标是 `cdd-design` 的推进 = 跨 phase，不在 next 内）
- **`next:` 字面 deliberate pin break**（破 P5 冻结契约 · 显式登记）
- **rounds 只有数组身份形**（旧数字形不兼容 · 无兼容层）
- **零声明再抄**：slug→路径从 slug 推导 · face 间接线序从 `PIPELINE_NEXT` 单表取 · skill ref 从 `REFS` 取
- **纯读无副作用**：board 不写树 / 不写 ledger / 不派发 child
- **不发布**：变更集归并落 pending
- **触碰历史 pin「cdd CLI 零新子命令」**：board 为新增第七命令，连带修订（文档先行——本 spec 即该修订落点）

## Change history
| Version | date | summary | author |
|---|---|---|---|
| v0.1 | 2026-10-14 | P8 设计实写——`cdd board <slug>` 一等公民：plan-graph 提级（显示路由 + 门名退役 §2/§3）· slug → 节点树文件系统唯一真源（§4）· 全节点 verb×round 细粒度板（§5）· next 全 line×全 verb 严格线序 + skill ref 交叉点（§6）· 六前提重构整合（§7）· 消费面同步（§8）· grilling Q1–Q11 全按用户裁定 | Oscar M. · Claude Opus 5 |
| v0.2 | 2026-10-14 | **统一 next 面折入（D33 · 用户 in-flight 需求 backfill）**：命题升为「`cdd board` slug 进度板 + 引擎统一 next 面」——引擎 `next: done` 由「本线链条耗尽」升为「**CDD 流水线的下一站**」（spec→`/kairos:cdd-plan` · plan→`/kairos:cdd-dev` · wave→`cdd review --type branch` · branch→`/kairos:cdd-close` · 止于 close 不跨 phase · skill ref 按 harness 渲拼写）· 新增 §6 引擎统一 next 面（`PIPELINE_NEXT` 单表 · 渲染落 `Capsule#routeText` · router 不动）+ §7 skills handoff 节点溶解 · 原 §7/§8 顺延 §8/§9 · board 的 next 改为**消费**引擎统一 next 面（不再自建表）| Oscar M. · Claude Opus 5（P8 编排器方案回填 · 用户确认） |
| v0.3 | 2026-10-14 | **六前提复盘校订（用户裁定 A/C + F1/F3/F4' 更正）**：① **F1 更正**——overall **也有 rounds**（可被评 → 有自身 review/fix 轮）· board **按节点读各自工作区**（overall 读 `<program>-overall/` · phase 读 `<program>-p<N>/`）· overall 行不特殊化（§5.1/§5.3）· ② **F3 更正**——`rounds[verb]` **只有数组身份形**（`[1,3]` = 第 1、3 轮），旧数字形不兼容（历史残留已清）· ③ **F4' 定案 (a)**——**next 绝不跨 phase**（任何目标是 `cdd-design` = 跨 phase，不在 next 内）；program 板 next 与引擎 next 字面一致（恒 `done`）· ④ **A 不拆 P9**——统一 next 面正好充 board 的消费验证 · ⑤ **C**——`next:` 是编排器唯一驱动（Next-Loop）；显式登记 **`next:` 字面 deliberate pin break**（破 P5 冻结契约 · §6.5）· ⑥ **F2 消矛盾**——§6.3 删「wave 的 done 仍渲 done」例外（按线型查表统一）· ⑦ **F5 悬案收口**——wave 线 `next-wave`（有波）vs `done`（全闭合）在 route.kind 层判 · 方案 (a) 落定（零新 route kind）· ⑧ **F8 升级硬阻塞**——skill-anatomy 契约同步为前置（非"可能"）；实测 handoff 节点仍在（待实现溶解）；cdd-design `handoff-next` 不在本 phase 范围 | Oscar M. · Claude Opus 5（P8 编排器复盘回填 · 用户确认） |
| v0.4 | 2026-10-14 | **§6 重构为「两台转移表」框架（用户裁定 · 声明再抄校正）**：用户指出「review 有无 findings 的 next 逻辑系统已存在，不需重述」——§6 由「复述 C5 表 + 混述」改为**职责分家**：**C5 表 = face 内转移**（review⇄fix · wave 波推进 · 已存在不动）· **`PIPELINE_NEXT` 表 = face 间转移**（face 耗尽 `done` → 下一 face 入口 · 本 phase 新增）。§6.3 给**完整流水线接线图**（`spec─→/cdd-plan─→plan─→/cdd-dev─→wave1→…→waveN─→branch review─→branch─→/cdd-close`，`→` = face 间接线 · `⋯` = face 内 C5）。§6 各节重排（6.1 命题 · 6.2 两台表 · 6.3 face 间接线面焦点 · 6.4 渲染落点 · 6.5 board 消费 · 6.6 Next-Loop）；删「线序从 `targetFaces` 派生」（改显式 `PIPELINE_NEXT` 表）；交叉引用与 Constraints 同步 | Oscar M. · Claude Opus 5（P8 编排器方案校正 · 用户确认） |
| v0.5 | 2026-10-14 | **spec-review-1 八 findings 修复（v0.4 URC 单循环评审）**：§6.3 `PIPELINE_NEXT` 键由 `RouteTarget.type` 裸值改为 **doc-class 键**（overall-spec vs phase-spec 由路径派生——overall 闭合 → `done`，跨 phase 不参与）· wave 行接线字面一律**前缀省略**（`review --type branch --plan <plan>`，与 capsule 逐字节一致）· §6.3 `PIPELINE_NEXT` **单址定于 `session/next.ts`**（消 either/or）· §6.4 渲染面**穿线 host**（`Capsule` 增持 host，经 `detectHost()`）+ 无 `target` 的 `case "done"` **兜底裸词 `done`**（既有 `face.test.ts:91/235/287` 无 target pin）· §6.6/§9.3 现有 **`next: done` byte pins 逐一登记为重锚**（`cli.test.ts:1451/1630/1782/1826/1860/1907/2082/2104/3461` · `face.test.ts:91/235/287`）· §7.2 loop-shape 不变式**显式重定义**（`loopHubNode.rowPrefixes`/`nextLoopConditions`/`loopShapeRule`/`edgeConditionRule`）· §3.1 增 **`PreFlightReason` 成员改名** · §9.1 消费面同步增 **`packages/cdd-engine/README.md` ×2 镜像**（`presentation-surface.test.ts:278-286`）+ kairos README 命令清单须按 `CDD_SUBCOMMANDS` 成员序；AC/Constraints 同步 | Oscar M. · Claude Opus 5（P8 docs-fix round 1） |
| v0.6 | 2026-10-14 | **spec-review-2 四 findings 修复（v0.5 URC 单循环评审）**：① **B3（blocker）**——§9.3 增**六命令结构性 pins 重锚**（`cli.test.ts:388` + `projection.test.ts:57` 两处 `toEqual` 精确列表，第七行 `board` 即红 → 重锚为七行；动态循环 `:995` 不翻红，非重锚集）；② **W7（warn）**——§6.4 host 源锚点**改写为可实施**：`detectHost()` 是 `CliLifecycle` 实例方法（lifecycle.ts:152 · 唯一调用者 :180）、`cli.ts` 不可达、工作入口是单一 `#runWork`（:379 · 无 per-verb 方法）、`--dry-run` 的 `#dispatchOf`（:558）不构造 `CliLifecycle` → 改定案**把 host 判定上提为 `host.ts` 模块级判定**（`CliLifecycle` 委托 · 组合根以 `process.env` 调用并穿线入 `Capsule` · 全路径含 dry-run 恒可达）+ **无 host 兜底 claude 形拼写**；③ **W8（warn）**——§7.2 固定**溶解后 NEXT-LOOP 出边形状为两条**（`until next=done` 自环 + `no next`→BLOCKED · 闭合出口删）并列 **checker 常量同步**（`skill-anatomy.test.ts:410` `out.length` 3→2 · 闭合出口断言 :390/:398 删 · 自环 :392 保留 · 词表 :419 随 `nextLoopConditions` 收窄）；④ **N3（nit）**——§6.6/§9.3 去**「每个 `next: done` 翻转」假全称**：`cli.test.ts:1826` 是 overall 线（doc-class 规则保持 `done`），移出翻转集并登记为**唯一不翻转的 doc-line pin**；AC/历史同步 | Oscar M. · Claude Opus 5（P8 docs-fix round 2） |
