# 引擎文档工具（Engine Doc-Tooling）— P8 设计：`cdd board <slug>` slug 进度板 + 引擎统一 next 面（plan-graph 提级一等公民 · 文件系统唯一真源 · 全节点 verb×round 细粒度 · next 贯穿全 face×verb 到 skill ref）
- **Version**: v1.7 · 2026-10-15
- **Doc type**: phase-spec
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
  - **host 源（(a) 定案）**：把 host 判定**上提为 `host.ts` 的模块级判定**——检测行数据（`HOSTS`）本已在该文件，把判定逻辑从 `CliLifecycle.detectHost` 抽为模块级纯判定（零裸函数纪律下即 `HostContract` 上的类/常量成员调用）；**其输入类型不得复用 `ProcessEnvLike`**——该 type 现 homed 于 `face/lifecycle.ts:86`，而 `lifecycle.ts:29-36` 正 `import` **自** `host.ts`；若新判定签名引 `ProcessEnvLike`，则 `host.ts` 反引 `lifecycle.ts` = **新增反向 import 边（环）**。定案：模块级判定取**内联结构类型** `Record<string, string | undefined>`（与 `ProcessEnvLike` 结构同形，零跨模块 type 依赖 · 环不成立）；`CliLifecycle` 改为**委托**该模块级判定（行为零变化 · 消重复），组合根 `#runWork` 构造 `Capsule` 时以 `process.env` 调用同一判定并**把结果 host 穿线进 `Capsule`**（构造注入 · 与 `words`/`ARGV_CHANNEL` 同层）。如此 host 源在**所有路径（含 `--dry-run` 合成 step）恒可达**——不需 per-verb 方法、不需构造 `CliLifecycle`。使 spec/plan/branch 三行的 skill ref 能渲 `/kairos:cdd-plan`（claude/cursor）或 `/skill:cdd-plan`（pi）形。**不硬编码**。
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
- **loop-shape 不变式被重定义，且必须 scope-aware（非单一全局常量改）**：契约现强制「每个 loop-family skill 的 digraph 携带一个 `handoff-*` 终端」——`loopHubNode.rowPrefixes: ["handoff-"]`（skill-anatomy.ts:151）· `nextLoopConditions: ["until next=done", "next=done", "no next"]`（:156）· `loopShapeRule`（:214-215 · 「…+ a handoff-* terminal」）· `edgeConditionRule`（:218）。handoff 溶解**只废弃「流水线衔接」域的 `handoff-*` 终端强制，不动 design 域**，故这些字段须**按 skill 的 handoff 域改定义**。**契约增 `SKILL_ROSTER` 的 per-skill handoff 域事实**——`cdd-spec-writer`/`cdd-plan`/`cdd-dev` = `pipeline`（流水线衔接 · handoff 溶解域）· `cdd-design` = `design`（design 续环 · 不动域）；**`role` 无法作判据**（cdd-design 与 cdd-plan 同为 `{role:"orchestrator", family:"loop"}` · skill-anatomy.ts:127），故须新事实而非复用现有字段。四个契约常量按该域取值：
  - `loopHubNode.rowPrefixes`：**收为 per-scope record**（非单一全局 `["handoff-"]`）——`pipeline` 域 → `[]`（NEXT-LOOP 不再有 handoff 行前缀）；`design` 域 → 保留 `["handoff-"]`（cdd-design 的 `handoff-next` 是合法终端）。
  - `nextLoopConditions`：**词表不窄化**——**保留全部三成员** `["until next=done", "next=done", "no next"]`。理由：`design` 域（cdd-design）仍携 `next=done` 闭合出口边，`:419` 的 out-edge 词表断言（读 `conditions = anatomy.digraph.nextLoopConditions` · :383）对该域逐边校验，**删 `next=done` 成员即把 cdd-design 打红**。故「退化」不是词表缩水，而是**形状要求按域分家**（见下）。
- **溶解后 NEXT-LOOP hub 出边形状按域固定**：契约现硬断言 hub 恰携**三条**出边（`skill-anatomy.test.ts:410` 的 `out.length === 3`）——`until next=done` 自环（`:392`）· `next=done` 闭合出口入终端（`:390`/`:398`）· `no next` BLOCKED 面（`:406`）。handoff 溶解 + `next=done` 闭合出口废弃**仅作用于 `pipeline` 域**，故形状常量**按域取值**：
  - **`pipeline` 域（cdd-spec-writer/cdd-plan/cdd-dev）**：收敛为**两条**出边——`until next=done` 自环 + `no next` → BLOCKED 终端（闭合出口那条删）。
  - **`design` 域（cdd-design）**：**保持三条**出边不变——`until next=done` 自环 + `next=done` → `handoff-next` 闭合出口 + `no next` → BLOCKED。
  - checker 常量同步：`out.length` 断言（:410）**按域**——`pipeline` → `=== 2` · `design` → `=== 3`；闭合出口断言块（`doneExit` 查找 + 其 terminal 目标断言 · :390/:398 及对应 finding 文案）**仅对 `design` 域运行**（`pipeline` 域该块不触发）；自环标签断言（:392 · `until next=done`）**两域皆保留**；词表断言（:419 经 `conditions = anatomy.digraph.nextLoopConditions` :383）两域皆读**未窄化**的三成员词表。
- **出边集未定的对照面**：`pipeline` 域的 `handoff-*` 行删除后，契约中「每个 loop-family skill 必携 `handoff-*` 行」的注册断言（`skill-anatomy.test.ts:322` 遍历 `rowPrefixes`）须**按域**触发——`pipeline` 域不再要求 · `design` 域仍要求（cdd-design 的 `handoff-next` 保留）——三 skill 的 `handoff-*` 行删除后注册表零残留。
  - `loopShapeRule`：拆为两句——`pipeline` 域删「+ a handoff-* terminal」子句；`design` 域保留该子句。
  - `edgeConditionRule`：**`pipeline` 域**的 `handoff-*` 出边条件断言随溶解删除；`design` 域保留。
- **cdd-design 的 `handoff-next` 不在本 phase 范围**——它是 design 会话内部的续环（转下 phase 的 design = 跨 phase，恰是 next 不参与的域 · §6.3）；本 phase 只溶解**流水线衔接**的 handoff（cdd-spec-writer/cdd-plan/cdd-dev），并据此把 loop-shape 各常量**按域分家**（`pipeline` 域两出边无 handoff 终端 · `design` 域三出边保留 `handoff-next`）——**非**单一全局常量改，故 cdd-design 不因本 phase 变红。cdd-design/cdd-close 的终端语义不动。
- 溶解后 **`pipeline` 域** NEXT-LOOP 的出边应统一为「照引擎 `next:` 字面执行」（单一出口 · 无条件词表分支）；`design` 域形状不动。
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
- **六命令结构性 pins 重锚（第七命令把 `toEqual` 精确列表打红）**：`face/__tests__/cli.test.ts:388`（`expect(CLI_COMMANDS.map(n => n.name)).toEqual([implement,review,fix,base,schema,issue])`）与 `face/__tests__/projection.test.ts:57`（`expect(program.commands.map(n => n.name())).toEqual([...same six])`）——两者皆为 `toEqual` 精确列表，`board` 第七行加入即红，须重锚为**七行**（`board` 按 `CLI_COMMANDS` 声明位追加）。**无需重锚**：`--help` 的逐 verb 循环（`cli.test.ts:990` 的 hardcoded `["implement","review","fix","base","schema","issue"]` 与遍历 `CLI_COMMANDS` 的动态循环）不因第七行翻红，仅精确列表断言属重锚集。
- **既有 `next: done` byte pins（§6.6 同一 deliberate pin break 的既有 pin · 须重锚）**：`face/__tests__/cli.test.ts:1451/1630/1782/1860/1907/2082/2104/2905/3461`——D33 的 `case "done"` 改查表后，wave 线闭合（如 `cli.test.ts:1451` tasks-1 全闭合）现渲 branch-review 字面，spec/plan 线闭合现渲 skill ref，**这些 `next: done` 断言逐条翻转**（**非「每个」**）。`cli.test.ts:2905` 是 dry-run real-chain 测试（`review --type wave --tasks 2` on `planFor(repoRoot, 2)`）的 wave-2 闭合，`expect(nextOf()).toBe("done")`——与所列 `:1451` 同属 wave 线闭合翻转类（该闭合按 §6.3/§6.6 重渲 branch-review 字面）；它逃逸历轮字面 grep 的根因是经 `nextOf()` helper 取载荷、从不携带 `next: done` 字面，故 **§9.3 的翻转集清点须扫 helper 取出的 next 断言，非仅字面 grep**。**例外（不翻转，保持绿）**：`face/__tests__/face.test.ts:91/235/287` 与 `cli.test.ts:2772/2794` 皆以**无 target** 的 `{kind: "done"}` 调 `emit`/`literalOf`——按 §6.4 的缺 target 兜底（回退裸词 `done`），doc-class 键不可派生，字面**逐字节不变**，非重锚（与 `cli.test.ts:2340` 同属「保持绿」）；`cli.test.ts:1826` 是 overall 线（`review --type spec --spec o1-overall.md`）——按 §6.3 的 doc-class 规则 overall 闭合仍渲 `done`，其 `toContain("next: done")` 不在翻转集内（登记为**唯一不翻转的 doc-line pin**）；`cli.test.ts:2340` 是 `not.toContain("next: done")` 的否定断言，亦不在翻转集内。逐一登记为 deliberate re-anchor（非回归）。
- **统一 next 面 pins（新）**：doc 线（spec/plan）闭合 → `next:` 渲 skill ref（非 `done`）· overall 线闭合 → `done`（跨 phase 不参与）· branch 线闭合 → `/kairos:cdd-close` · wave 线闭合 → `review --type branch --plan <plan>`（前缀省略 · 与 capsule 逐字节一致）· 无 target 的 `{kind:"done"}` → 兜底裸词 `done` · skill ref 按 harness 拼写（claude/pi 两形）。

### 10. 回归更正：author 入口的骨架 bootstrap 字面（D29 判定补正 · 用户裁定）
#### 10.1 缺陷现场（P7/D29 引入的消费面回归）
- **现象**：`cdd-spec-writer` 的 `author-spec`（single-spec / phase-spec / overall-spec 三变体）与 `cdd-plan` 的 `author-plan` 两个 **author 节点**，其 **Do** 只**用散文复述结构**（"the plan carries the task-heading colon form · `## Constraints` · `### Task N:`…"），**丢失了那条产出骨架的强制命令** `<engine> schema get <type> --output skeleton <target path>`。触发面 = kairos 流程产出的**每一份 spec / plan / overall / charter 的首次落笔**。
- **回归源头**：P7 提交 `9d6f4e27`（`docs(kairos): skill ⇄ engine 黑盒边界 … (D29)`）明文「`author-plan` … 删 `schema get --output skeleton` 语法 · `cdd-spec-writer`：`author-spec` 删 skeleton 语法」。此前（P5 `f45e25a9` / P6 `fdd339c4`）两节点均载「generate the canonical skeleton first (…) and fill its slots in place」——**曾被正确使用的能力被删**。
#### 10.2 根因（D29 按「形状」切，未按「角色」切）
- D29 自己的裁定明文携带 **bootstrap 例外**：「每条 flow 的**入口节点**保留唯一一条字面命令（首个 `next:` 之前必须有人发起）；其余全部走 `next:`」（`2026-10-10-engine-doc-tooling-p7-design.md` §8.10）。`author-spec`/`author-plan` **正是每条 flow 里产出物的唯一入口节点**，其骨架命令就是该例外所指的 bootstrap 字面。
- 但 §8.10 的**剥离清单**把 `schema get … --output skeleton` **长得像内部语法**（一条 CLI 命令 + 槽位名）而归入「内部实现镜像 → 剥」，**与自己刚立的 bootstrap 例外直接对撞，清单赢了**。同一条命令在 cdd-dev 的 `determine-base`/`set-base` 被当 bootstrap 正确保留，在 author 节点被当语法错误删除——**一条规则、两种结论，因为规则键在形状上**。
- **次级根因**：删命令后 skill 以**散文复述结构补位**，恰恰重演 D29 要消灭的东西——一份会漂移的第二结构真相，只是从「命令镜像」换成「散文镜像」。
- **逃逸面**：`contract/skill-anatomy.ts` 只注册 NEXT-LOOP hub / 节点名 / 禁叙述标题，**无「author 节点必携 bootstrap 字面」这条**；全库 tests 零测试锚定该命令 → 静默回归，P7 后续四轮 review 全过。
#### 10.3 更正后的判定（一事实一处 · 回填 owning doc）
- **`schema get <type> --output skeleton <target path>` 在 author 入口节点是 bootstrap 字面（D29 例外），保留**；被 D29 正确剥离的只是**槽位名 / `:::fill` 结构复述**等**内部结构镜像**。判据从「形状」修正为「角色」：**入口节点的发起命令 = 例外面；其余内部语法 = 剥离面**。
- 本更正**不改 P7 已 Done 的历史**（frozen）——**P8 是本更正的 owning doc**（用户裁定：backfill 到 P8）。P8 §7 的 handoff 溶解（face 间 next 折入引擎）与本节正交：§7 删的是 **handoff 节点**（face 间转移的 skill 侧副本），本节恢复的是 **author 节点的 bootstrap 入口命令**（产出物的发起面）——两者边界清晰，勿混。
#### 10.4 热修（用户裁定：恢复命令 + 回归 pin）
- **恢复面**：`author-spec`（三变体）与 `author-plan` 恢复入口 bootstrap 字面——`<engine> schema get <single-spec|phase-spec|overall-spec|plan> --output skeleton <target path>`，**拿到骨架再填**（`structure stays as generated`）。**只恢复「命令 + fill in place」纪律，不复述槽位名**（守住 D29 的真实意图：命令是入口行为契约，槽位名是内部实现镜像）。
- **删除面**：两 author 节点的**散文结构复述**（"the plan carries the task-heading colon form…"）**删除**——骨架是结构契约的唯一权威（与 reviewer 读同一份 `schema get <type>` 契约），散文复述是会漂移的第二真相。
- **回归 pin（防再次静默回归）**：在 `contract/skill-anatomy.ts` 的契约事实 + `SkillAnatomyCheck`（`packages/kairos/tests/skill-anatomy.test.ts`）补一条断言——**每个 author 节点（`cdd-spec-writer` 的 `author-spec` · `cdd-plan` 的 `author-plan`）必携其 skeleton bootstrap 字面**（`schema get … --output skeleton`）。契约携带「哪些节点是 author 入口 + 其 bootstrap 命令面」的事实，检查器断言 live SKILL.md 命中，二者同源；此 pin 使本类回归（入口命令被剥）**不可能再静默通过**。

### 11. 措辞更正：fix 路由载体动作括注（D28 措辞补正 · skills 内部镜像剥离 · 用户裁定 2026-10-15）
#### 11.1 现场与根因
- **现场**：fix 路由的 `next:` 字面尾随括注 `FIX_READBACK_SUFFIX`（`session/next.ts:62` 单源 · capsule 逐字渲染）现为 `(confirm the findings · annotate the carrier with the adjudications)`——P7/D28（`cd617faf` 批次 · 载体动作 `backfill user adjudications` → `annotate the carrier with the adjudications` 术语分家）引入。该括注随 `next:` 到达编排器，**同时被逐字复写进四个 SKILL.md**（cdd-dev NEXT-LOOP/I2 · cdd-plan NEXT-LOOP/I1 · cdd-spec-writer NEXT-LOOP/I1 · cdd-design I2）。
- **根因（D29 判据适用）**：SKILL.md 里的括注是**引擎渲染面的内部镜像**——括注由引擎在运行时渲进 `next:` 字面、编排器照字面执行，skill 文本无需也不应自持这份措辞副本；复写即 D29 要消灭的「会漂移的第二真相」（措辞一改，引擎与 skills 两处各改一遍，历史已证明会漏）。
#### 11.2 更正后的判定（用户裁定 2026-10-15 · 两点 · 措辞经消费者视角复议定案）
- **措辞更正**：括注改为 **`(confirm the findings · if a finding needs a ruling, record the ruling in the findings file)`**。措辞经两轮用户裁定收敛：初拟 `annotate the handoff carrier with the adjudications if needed` 被用户指出 **`if needed` 的判据是「findings 是否需要裁定」**，且经消费者视角复议——冷启动编排器无本 repo 运维文档，`handoff carrier`/`adjudications` 是无法解引用的内部词汇——定案改用行为语言：`verify/confirm` 动作直述 + 判据（`a finding needs a ruling`）+ 目标（`the findings file`——`--findings <path>` 的命令行邻接位自明）全部自足，零 repo 内部词汇。单源常量一处改，capsule 逐字渲染自动跟随。
- **skills 镜像剥离**：四个 SKILL.md **整句括注删除**（非改写）——skills 只保留「fix 派发消费 findings handoff · 照 `next:` 字面执行」的纪律句；`FIX_READBACK_SUFFIX` 随 `next:` 给到编排器，就是编排器需要的全部说明（用户裁定：skills 里不需要留引擎内部信息）。本更正与 §7 handoff 溶解正交：§7 删的是 face 间转移节点，本节删的是 fix 括注的 skill 侧措辞副本。
- **命名登记随改**：`docs/maintainers/02-naming.md` §2.2 `annotate` 行措辞随定案同步（if-needed ruling 回写 findings file），登记源仍是 `FIX_READBACK_SUFFIX` 单源。
#### 11.3 热修面（W1 implement 之前落定）
- **引擎**：`session/next.ts` `FIX_READBACK_SUFFIX` 值 + 头注措辞（§11.2 定案句）· `face/capsule.ts` `#routeText` 注释行随改（渲染面零逻辑变化——常量插值）。
- **literal pins**：`session/__tests__/next.test.ts` 两处字面 pin（值 pin + 编译期 literal 类型 pin）随改；`face/__tests__/*` 的 suffix 断言经 import 跟随，零改动。
- **skills**：四 SKILL.md 括注删（`grep -rn "annotate the carrier" packages/kairos/skills/` 零命中）· `pnpm run emit` 重生成。
- **P8 计划关系**：本节热修是**独立更正**，不增删 P8 任务；T6（skills 溶解）落地时本括注已不存在，T6 的零残留 checkable 天然覆盖。

### 12. Doc type 声明上收 + 文件名推导退役（D34 · 用户裁定 2026-10-15）
#### 12.1 现场与根因（文件名承载类型语义）
- **现场**：doc 类型（`DocKey` 四值）现由**文件名后缀规则**派生——`Contract.deriveDocType`（`contract/judge.ts:103`，validate 门与 preflight 共用）与 W1 落地的 `BoardView.#docKeyOf`（`face/board-view.ts:95`，board 读面）**两处平行重抄同一后缀表**（`-overall.md`/`-single-spec.md` 判定逐行重复）——`deriveDocType`/`#docKeyOf` 重复声明的根因不是漏看，而是「文件名承载类型语义」这一设计本身允许（并持续生产）第二真相。
- **根因（六前提 lens）**：文件名是「这个文档是什么」的**派生副本**，真值在文档实质结构里；派生规则必须被每个 author agent 心智复刻（命名规则完美复刻不可保证，premise 5），规则一改所有消费点同改（premise 3 的声明再抄温床）。类型语义是**声明性事实**，应随文档本体声明，不应由文件名猜。
#### 12.2 判定（用户裁定 2026-10-15 · 三点定案）
- **声明上收**：header 增一行 **`- **Doc type**: <overall-spec|phase-spec|single-spec|plan>`**——值域 = 现有四值 `DocKey` 枚举（零新概念；skeleton 值域校验有先例 `**Status** → Draft`），由 `schema get --output skeleton` 生成（author 的 bootstrap 纪律保证新 doc 天然携带，author 零额外心智）。**不做作者侧别名层**。
- **文件名推导整体退役（死码清理，非修复）**：`deriveDocType` 的后缀规则与 `BoardView.#docKeyOf` **删除**——重复声明问题不是被修复，是被**消灭**：剩一个声明读取面（薄 header marker 扫描，**不选 parser**——header 块是全 doc type 共享的统一 marker 面，读一个 marker 行无需先知类型， parsers-by-type 的循环依赖是伪装的）。validate 门 / preflight / board 三消费点读**同一方法**（D26 单源）。文件名退化为人类导航标签，slug 扫描只按前缀+目录分组，不再承载类型。
- **缺声明 = 硬 BLOCKED + 存量 sweep**：无 `- **Doc type**:` 行 → 消费点 BLOCKED（present facts · **零「声明优先文件名兜底」双读层**——双读是永久模糊兼容层，规则永远说不清哪个赢）。存量 doc 一次性机械 sweep：每份的类型由现推导可知（推导这次用于迁移，非运行时面），sweep commit 落完即退役完成。
- **一致性校验随门走**：声明了某 doc type 的文档，doc-contract 门按该 type 的 shape 硬校验——声明错误被结构性抓住，**不引入文件名 cross-check 第二真相**。
#### 12.3 落地面（Plan Sole Writer 修订 · W1 派发返回后落定）
- **spec**：本节 + AC + Constraints + change history。
- **plan**（T2/T4/T5 修订）：T2 头块读增 `- **Doc type**:` marker 提取（`{ version, status, docType }` 三事实）· T4 投影携带声明类型 · T5 board/`#runBoard` 读声明类型，`#docKeyOf` 删除 · 依赖面（T3 `#docClassKey` 的 `-overall.md`/`-design.md` 后缀判别 → 改读声明）与 T7 pin 面同步。
- **存量 sweep**：全库 doc（overall ×1 · phase-spec ×N · single-spec ×N · plan ×N）补声明行，单 commit。
- **破坏性**：`deriveDocType`/`#docKeyOf` 公共/私有签名删除属破坏性变更（premise 1 允许 · deliberate pin break 与 P8 既有破坏面同级登记）。

### 13. 自环词表更正 + branch 节点消融（D35 · 用户裁定 2026-10-15）
#### 13.1 现场与根因（`until next=done` 是 D33 前的旧世界观）
- **现场**：W1 落地后四 skill 的 NEXT-LOOP 自环标签仍为 `until next=done`，但 D33 后引擎 next 面的 `done` 只在两处出现——overall 线闭合（`PIPELINE_NEXT` overall-spec 行）与无 target 兜底。cdd-plan（plan 线闭合 → `/kairos:cdd-dev`）· cdd-dev（wave 闭合 → branch review · branch 闭合 → `/kairos:cdd-close`）· cdd-design（消费 spec 线序列 → skill ref）的 next 序列里 **done 永不出现**——`until` 条件永假，正常出口在字面上不存在（实际由 `no next` BLOCKED 异常面兜底）。cdd-spec-writer 仅 overall 变体能读到 done，phase 变体同样永假。
- **W1 附带缺陷**：T6 溶解后 cdd-dev 的 `branch-review`/`branch-fix` 成**孤岛**（wave→branch 入边已由引擎字面承载删除，digraph 断为两个连通分量；现有 checker 只查双向完备 + 独立闭环存在，**不查连通性**，故静默通过）。
- **根因**：`until next=done` 语义是 D33 之前的「done = 本线耗尽」；D33 之后 done = 「跨 face 续程被引擎接管，流水线终点」。本 skill 的循环退出条件实为「**引擎字面把编排器交出去**」（skill ref / 引擎命令字面）或 `done`（overall/终点）——即 **terminal**，不是 done。
#### 13.2 判定（用户裁定 2026-10-15 · 四点）
- **branch 节点消融**：cdd-dev 的 `branch-review`/`branch-fix` 节点删除——接线职责已被引擎 C5 + `PIPELINE_NEXT` 完全承载（branch review findings → `next: fix --type branch --findings …` 字面完整可执行；branch 闭合 → `/kairos:cdd-close`），编排器零 branch 专属路由知识。branch 线专属事实（BASE_BRANCH 引擎注入 · soft cap 走 `SOFT_CAP_SUGGESTION` · blocker 持久 fail-open）收进 NEXT-LOOP 的 Do 一句话 + Failure Modes 表。消融后 cdd-dev = 四个 bootstrap/首派发节点 + 单一 NEXT-LOOP（二出边形状不变，pipeline 域 `out.length === 2` pin 不破）。
- **自环标签统一更正**：四流水线 skill（cdd-spec-writer/cdd-plan/cdd-dev）+ cdd-design 的自环标签 `until next=done` → **`until next is terminal`**（terminal = `done` 或 skill ref/引擎命令字面——引擎字面把编排器交出去即本 skill 循环使命终结；cdd-spec-writer 的 overall 变体读 done 亦被 terminal 覆盖）。
- **cdd-design 闭合出口改名**：其 `next=done → handoff-next` 出边标签改 **`until session closes → handoff-next`**（design 续环转下 phase 的 design 不是引擎字面消费者，D33 明文不在 next 内——不得蹭 done 语义）。design 域保持三出边形状不变。
- **契约同步**：`nextLoopConditions` 词表随新标签改（`until next is terminal` 替换 `until next=done`；`next=done` 成员随 cdd-design 出边改名收敛为 `until session closes`）· `loopShapeRule`/`edgeConditionRule` 断言文本随改 · **branch 独立闭环断言块退役**（`skill-anatomy.test.ts:442-461` 的 branch-review↔branch-fix 闭环断言 + `skill-anatomy.ts:264-266` 两条 branch 专论规则）· `out.length` 域规则（pipeline 2 / design 3）不动 · 双向完备性检查自动覆盖消融后形状。
#### 13.3 落地面（Plan Sole Writer 修订 · T6 后置任务）
- **skills**：cdd-dev（branch 双节点删 + hub Do 收编 branch 事实 + Failure Modes 增 branch blocker fail-open 行）· 四 skill 自环标签改 · cdd-design 出边标签改。
- **contract**：`skill-anatomy.ts` 词表/规则文本随改 + branch 专论删 · `skill-anatomy.test.ts` branch 闭环断言块删 + 新标签断言。
- **plan**：新任务（依赖 T6 · 消费面 pin 归 T7 扩集）+ T7 的 skill-anatomy pin 面同步。

### 14. Host 通道完整性：宿主进程通道改 execaSync（D36 · 用户裁定 2026-10-15）
#### 14.1 现场与根因（`execFileSync` 的 1 MiB 缓冲天花板）
- **现场**：P8 W1 执行期两次 `CDD_BLOCKED: child claude returned no status line`——两次都是**长任务 child**（implement/fix 实际改码+提交），工作面完好（提交在树上 · handoff 载体已写盘 `status: APPROVED`），唯独 stdout 尾部的 `RETURN_STDOUT_BLOCK` 状态块未到达引擎；两次成功的都是短复核 child（输出小）。形态 = **尾部截断**，非 child 违约。
- **根因（双证）**：`SyncRunner`（`face/lifecycle.ts:65`）以 `execFileSync` 同步收集 child stdout，**未传 `maxBuffer`**——Node 默认 1 MiB，超限即截断/杀进程，尾部先丢；联网检索证实同族已知问题（claude-code `--print` 长输出被 exec 族包裹截断 · anthropics/claude-code #6279/#15813/#17197；Node `child_process` `maxBuffer` 语义）。`--output-format text` 的全量缓冲模式加剧暴露（长会话叙述+状态块全走一条缓冲流）。
#### 14.2 判定（用户裁定 2026-10-15 · 根本修非补丁）
- **不自造轮子，用成熟进程库**：`SyncRunner` 弃 Node 内建 `execFileSync`，改 **execa** 的同步面 `execaSync`——`maxBuffer` 默认**无上限**（缓冲上限的**整个类别被消灭** · premise 1/6），而非抬高 Node 默认 1 MiB 一格（那是补丁形态 · premise 3），也非自造 worker-线程并发机器（premise 2「避免自造轮子」反对）。face 零变：仍同步、仍返回 `{code, stdout, stderr}`、`--output-format text` 与 `RETURN_STDOUT_BLOCK` 契约零动（消费者心智零增 · premise 5）。
- **为何非自造流式 pump**：曾一度定案 `spawn` + worker-线程 `Atomics.wait` 同步流式聚合——它引入约 118 行并发机器（主线程 park 在 `Atomics.wait` 时无法 drain `message` 事件装载握手，且双管道排水靠 worker 自己的 event loop），既是自造轮子（premise 2）、又把排水的正确性重担放回引擎（premise 3/4）。execa 的同步面已把**双管道并发排水**（stdout 与 stderr 同时写满不死锁）内建 `spawnSync` 承载，无需引擎介入。
- **零裸函数纪律**：收集逻辑收在 `SyncRunner` 私有方法 `#collect`（零新裸函数 · premise 2）。
- **回归观测登记**：两次截断事件记入本节（观测面），引擎侧不为此增重试逻辑——`retry = full re-run (idempotent)` 契约本就覆盖；本修复使截断类别不再发生，而非掩盖。
#### 14.3 热修面（形状定案 · 取证后落定）
- **为何非 Node 内建 `spawnSync`**：`spawnSync` 同样携带 `maxBuffer`（换汤不换药 · 需手传 `maxBuffer` 常量，仍是把正确性押在一个易漏参数上）；**为何非 async 化/自造 stream pump**：引擎 dispatch 契约全同步（`DispatchStep = (frame) => DispatchOutcome` · `Lifecycle.advance()`/`peekNext()` 同步 · run.ts:113/233/242），为一次 IO 异步化会撕开整个 lifecycle 类型面（premise 3 反对），而自造同步流式聚合把排水正确性重担放回引擎（见 14.2）。
- **定案**：`SyncRunner` 改 `execaSync(command, args, {cwd, reject:false, stripFinalNewline:false})`——**`reject:false`**（失败 child 返回结果不抛 · fail-open）、**`stripFinalNewline:false`**（stdout 字节级原样，尾块零动）、**默认无上限 `maxBuffer`**（截断类别退役）。结果回读为既有 `{code, stdout, stderr}` face：`exitCode ?? 1`（spawn 失败如 ENOENT 时 exitCode 为 `undefined` → 1）；stderr 为 child 自身流，异常 child 走 execa 的 `shortMessage` 诊断（fail-open face 保留原因文本，绝不空块）。face 零变（同步 · `{code, stdout, stderr}`）。
- **回归 pin**：colocated 单测——超大输出（> 1 MiB，恰覆盖旧默认天花板的字节数）完整到达 + `RETURN_STDOUT_BLOCK` 尾块完整 + stderr 同 face + fail-open 保持——本类截断不可能再静默通过。
- changeset（`@oscaner-skills/cdd-engine` patch · 新增依赖 `execa`）。

### 15. cdd-design hub 消融 + onepass 归类（D37 · 用户裁定 2026-10-15）
#### 15.1 现场与根因（NEXT-LOOP hub 无生产者 = 死节点）
- **现场**：cdd-design 的 `NEXT-LOOP` hub 自环 `until next is terminal` 永无重入来源——引擎统一 next 面（`NextStepRouter` + `PIPELINE_NEXT`，`session/next.ts`）**零 design 路由**：表只产 `kairos:cdd-plan`/`kairos:cdd-dev`/`kairos:cdd-close` 三 ref，`REFS`（`face/host.ts`）里的 `kairos:cdd-design` 行**零消费者**。此即 D33 明文（§13.1）「design 续环不是引擎字面消费者」。唯一入边是委托的 `run-cdd-spec-writer`，而 writer flow 在**自身** NEXT-LOOP 内部消化 spec 的 review-fix `next:` 字面、闭合即 hand off（→cdd-plan），**不回投 design**。
- **结构**：hub 的汇合身份仅剩「一条入边 + 死自环 + 闭合出口 + `no next`」——与 D35 消融的 cdd-dev `branch-review`/`branch-fix` 孤岛**同构**（无活流量，checker 不查连通性故静默通过）。
#### 15.2 判定（用户裁定 2026-10-15 · 两点）
- **hub 消融**：`cdd-design/SKILL.md` 删 `NEXT-LOOP` 节点块 + digraph 三出边；`run-cdd-spec-writer` 的 Exit 直接收口 `handoff-next`（对齐 `run-cdd-charter → handoff-next`）。design 分支收敛为一条直边（`W --> H`）。
- **家族重分类**：cdd-design `family: loop → onepass`（无自环 · 分叉路由非线性链）——`onepass` 语义由「one-shot toolchain」**一般化**为「one-pass · 无自环」，覆盖线性工具链（cdd-report）与分叉路由（cdd-design）两形（premise 6 复用优先 · 不为单一 skill 增族）。
#### 15.3 契约同步（design-scope hub 机械整体退役）
- `SKILL_ROSTER` cdd-design family 改 `onepass` · **`handoff` 字段整体移除**（消融后其唯一读者是 loop hub 的 design-scope 检查——零读者即死码，premise 4/6）· `loopHubNode.rowPrefixes` 退役（全 loop skill 皆 pipeline 域 · 前缀循环退为死码）· `nextLoopConditions`/`edgeConditionWords` 去 `until session closes`（design 域专属词）· `loopShapeRule`/`edgeConditionRule` 去 design 子句 · `enderShapeRule` 补 cdd-design（无自环例外）· **`registry.crossings["cdd-design"]` 移除**（消融后 12 节点 / 16 边，均回限内，不再越界）。
- checker（`skill-anatomy.test.ts`）：`#familyShapeFindings` 的前缀循环删 · `#edgeConditionFindings` 的 designScope 分支删（`expectedOut` 恒 2 · 闭合出口断言块删）。
#### 15.4 落地面（Plan Sole Writer 修订）
- **skills**：cdd-design（hub 节点删 + digraph 重接 + Exit 改指 handoff-next）。
- **contract**：`skill-anatomy.ts` 家族/词表/规则文本随改 + design-scope 机械删。
- **plan**：**新任务 T11**（`DependsOn: 9` · 与 T9 同面后续——T9 刚落 cdd-design 自环标签与契约词表，T11 在其上消融）· T7 `DependsOn += 11`（pin 重锚覆盖 T11 后的契约终态）。

### 16. cdd-design 节点改名 + handoff 分裂（D38 · 用户裁定 2026-10-15）
#### 16.1 现场与根因（一名两义）
- **现场**：cdd-design 的 `run-cdd-spec-writer`（single-spec / phase-spec）与 `run-cdd-charter`（overall-spec）的 Exit **同指** `handoff-next`，而 `handoff-next` 现语义是 design 域续环（hand off 到 `/compact` 或下一 phase 的 `kairos:cdd-design` [Px program]）。D37 消融 hub 后二线语义**分叉**：spec 线应交引擎统一 next 面（spec 闭合 → `PIPELINE_NEXT` 的 `phase-spec → kairos:cdd-plan`），charter 线才交 design 域续环。
- **命名**：`run-cdd-spec-writer` 与 `run-cdd-charter` 是同族二分（前者走 single/phase-spec，后者走 overall-spec），命名不对称（`-writer` 后缀赘余）。
#### 16.2 判定（用户裁定 2026-10-15 · 三点）
- **改名**：`run-cdd-spec-writer` → `run-cdd-spec`（与 `run-cdd-charter` 对标）。
- **`handoff-next` 重定义**：`run-cdd-spec → handoff-next`——此 `handoff-next` = **遵循引擎 `next:` 字面规范**（承接引擎统一 next 面，字面即 `kairos:cdd-plan`）。
- **新终端 `handoff-phase-design`**：`run-cdd-charter → handoff-phase-design`——承接**原 `handoff-next` 的 design 域行为**（hand off 到 `/compact` 或下一 phase 的 `kairos:cdd-design` [Px program]）。
#### 16.3 契约同步（节点 12 → 13 · 边 16 不变）
- cdd-design digraph 节点 **12 → 13**（+`handoff-phase-design`）· 边数 **16 不变**（`W → handoff-next` 保留、`C → handoff-phase-design` 仅改边 target，零新增边）· 节点块：`run-cdd-spec` 改名 · `handoff-next` Node Definition 按新义重写 · `handoff-phase-design` 新增块（承接原 handoff-next 文本）。13 节点仍回 growth 限内。契约（`skill-anatomy.ts`）零改（通用节点名规则不枚举 handoff-* 名字 · 消融后 `handoff` 字段已零读者）。
#### 16.4 落地面（Plan Sole Writer 修订）
- **skills**：cdd-design（节点改名 + `handoff-next` 重写 + `handoff-phase-design` 新增）。
- **plan**：**新任务 T12**（`DependsOn: 11` · D37 消融终态之上的收口）· T7 `DependsOn += 12`（pin 重锚覆盖 cdd-design 改名后终态）。

### 17. handoff draft 读面宽容解析（D39 · 用户裁定 2026-10-15）
#### 17.1 现场与根因（LLM 手写 draft 的尾逗号一票否决）
- **现场**：引擎 `Workspace.readJson` 用裸 `JSON.parse`——子代理（LLM）手写的 handoff draft（`tasks-*-implement.json` 等 carrier，`schema: "work"`）偶发**尾逗号**（LLM 从散文生成 JSON 的固有噪声）→ `{kind:"malformed"}` → `#reject` → **整轮 implement+review 作废**（W3 `{5,11}` 实例：`tasks-5,11-implement.json` 的 `notes` 数组尾逗号，工作面/载体其余完好）。
- **调研**（实测 · 2026-10-15）：`jsonc-parser`（Microsoft 官方 `node-jsonc-parser` · 2026-07 更新 · 74.2M/wk · **零传递依赖** · ESM+CJS）`{allowTrailingComma:true}` **精确**容忍尾逗号/注释、仍对真错误（缺闭合括号等）报错 + 精确错误码；`json5`（240M/wk 但仓库休眠 2023-03 · 容忍**过度**——单引号/无引号键/hex）· `@humanwhocodes/momoa`（3.45M/wk）默认均**不容**尾逗号（实测三库对真实畸形 draft：仅 json5 开箱通过）。
#### 17.2 判定（用户裁定 2026-10-15）
- **载体**：**jsonc-parser** + `{allowTrailingComma:true}`（最活跃且官方 · 零依赖 · 宽容精准——只吞尾逗号/注释，不吞真损坏）。
- **作用域**：**仅子代理手写的 handoff draft 读面**（引擎自写文件经 `JSON.stringify` 恒合法，严格读；宽容只护 LLM 噪声，不污染 JSON 契约）。
#### 17.3 落地面（Plan Sole Writer 修订）
- **engine**：`infra/workspace.ts` 增 draft 宽容读面 + `packages/cdd-engine/package.json` 依赖 `jsonc-parser`。
- **plan**：**新任务 T13**（`DependsOn: 11` · 引擎 IO 面 · 与 T12 同后置波——D38/D39 均在 `{5,11}` 落定后实施）。

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
- **skill-anatomy 契约同步**（`SkillAnatomyCheck` 节点注册表 + NEXT-LOOP 出边断言随 handoff 溶解更新 · 硬前置）：**loop-shape 不变式被 scope-aware 重定义**——增 `SKILL_ROSTER` per-skill handoff 域事实（`pipeline` = cdd-spec-writer/cdd-plan/cdd-dev · `design` = cdd-design；`role` 不可作判据）· `loopHubNode.rowPrefixes` 收为 per-scope record（`pipeline` → `[]` · `design` → `["handoff-"]`）· `nextLoopConditions` **保留三成员不窄化**（`design` 域仍用 `next=done`）· `loopShapeRule`/`edgeConditionRule` 按域分句（`pipeline` 删 handoff 子句 · `design` 保留）· **溶解后 NEXT-LOOP hub 出边形状按域固定**（`pipeline` = 两条：`until next=done` 自环 + `no next`→BLOCKED · `design` = 三条不变，保留 `next=done`→`handoff-next`）· checker 常量**按域**同步（`skill-anatomy.test.ts:410` `out.length` `pipeline`→`2` · `design`→`3` · 闭合出口断言块 `:390/:398` **仅对 `design` 域运行** · 自环 `:392` 两域保留 · 词表断言 `:419` 读未窄化的三成员词表）
- `plan-graph` 作为词从引擎消失：`schema get` display 路由退（leaf 分支零命中）· `SCHEMA_TYPE_KEYS` 旁路注释零命中 · `#parseTypeKey` 的 `planGraph` 参数零命中 · preflight 门名 `graph`（`plan-graph` 字面零命中）
- `cdd board` 无副作用（零写树 · 零写 ledger · 零 child 派发）· 缺 slug / 无匹配文件 → exit 2
- `CliVerb` 七值 · `CLI_COMMANDS` 含 board 行 · 消费面六→七命令引用同步（kairos README ×2 + presentation-surface.test）
- 零裸函数（全局 `^export function|^function` 零命中）· 引擎 vitest 全绿（含 board colocated pins + **七命令结构 pins 重锚**（`cli.test.ts:388` + `projection.test.ts:57` 精确列表由六行改七行）+ plan-graph pins 重锚 + 统一 next 面 pins）
- `pnpm run validate` ALL PASS · 不发布
- **author 入口 bootstrap 字面恢复（§10）**：`cdd-spec-writer` 的 `author-spec`（三变体）与 `cdd-plan` 的 `author-plan` 皆载 `<engine> schema get <type> --output skeleton <target path>`（拿到骨架再填）；散文结构复述删除
- **author bootstrap 回归 pin**：`skill-anatomy` 契约 + 检查器断言两 author 节点必携 skeleton bootstrap 字面（本类回归不可再静默通过）
- **fix 路由载体括注（§11）**：`FIX_READBACK_SUFFIX` = `(confirm the findings · if a finding needs a ruling, record the ruling in the findings file)` · 四 SKILL.md 括注零残留（`grep -rn "annotate the carrier" packages/kairos/skills/` 零命中）· `02-naming.md` annotate 行随改
- **Doc type 声明上收（§12 · D34）**：每份 doc 的 header 携 `- **Doc type**: <DocKey 四值>`（skeleton 生成）· `deriveDocType` 后缀规则 + `BoardView.#docKeyOf` 零残留（推导面整体退役）· validate/preflight/board 三消费点读同一声明读取方法 · 缺声明 BLOCKED · 存量 sweep 单 commit · 声明类型即 doc-contract 门的校验键（零文件名 cross-check）
- **自环词表 + branch 消融（§13 · D35）**：四 skill 自环标签 `until next is terminal`（cdd-design 部分经 §15 · D37 再修订——hub 整体消融）· cdd-dev branch 双节点消融（`branch-review`/`branch-fix` 零残留 · 单 hub 二出边）· branch 独立闭环断言块退役 · `nextLoopConditions`/`loopShapeRule`/`edgeConditionRule` 随新词表同步 · `out.length` 域规则不动
- **cdd-design hub 消融（§15 · D37）**：cdd-design 的 `NEXT-LOOP` 节点 + 三出边消融（无生产者=死节点）· `run-cdd-spec-writer` Exit 直收 `handoff-next` · cdd-design `family: loop→onepass` · design-scope hub 机械整体退役（`handoff` 字段/`rowPrefixes`/design out-length=3/`until session closes` 词/闭合出口断言块/`registry.crossings["cdd-design"]` 零残留）· `enderShapeRule` 补 cdd-design 无自环例外
- **cdd-design 节点改名 + handoff 分裂（§16 · D38）**：`run-cdd-spec-writer` → `run-cdd-spec`（与 `run-cdd-charter` 对标）· `run-cdd-spec → handoff-next`（= 遵循引擎 `next:` 字面规范）· `run-cdd-charter → handoff-phase-design`（新终端 · 承接原 handoff-next 的 design 域行为）· digraph 12 → 13 节点（边 16 不变）· 契约（`skill-anatomy.ts`）零改
- **handoff draft 读面宽容解析（§17 · D39）**：子代理手写 handoff draft 读面用 `jsonc-parser` + `{allowTrailingComma:true}`（尾逗号/注释容忍 · 真错误仍报错）· 引擎自写文件严格读 · 宽容**仅限**子代理手写 draft 读面（不污染 JSON 契约）· 新依赖 `jsonc-parser`

## Constraints
- **文件系统唯一真源**：节点集合、artifact 存在性全来自扫描，绝不合成盘上不存在的节点，绝不解析 overall 的 Phase inventory / File paths 声明表
- **一概念一名**：`plan-graph` 作为词整体消失（显示路由 + preflight 门名）；board 是新词
- **skill ⇄ engine 黑盒边界（D29 · 含 §10 补正）**：board 的 next 渲染 skill ref 经 `REFS[ref][host]`，不硬编码插件拼写；**D29 的剥离判据按「角色」非「形状」**——入口节点的发起命令 = 例外面（author 的 skeleton bootstrap 字面保留），内部结构镜像（槽位名 / `:::fill` 复述）= 剥离面
- **判定面单源（D26 家族）**：board 的进度读是 `progress.json` 单源投影，波链与 preflight gate 同 `closedWaves()` 读；next 消费 `NextStepRouter` 不修改它
- **统一 next 面单源（D33）**：face 间接线从 `PIPELINE_NEXT` 一张表取（**单址 `session/next.ts`** · board §6.5 消费它，字面一致，不另建序）；C5 表（face 内）**不动**，face 间 `done`→下一入口的渲染落 `Capsule#routeText` 渲染层（**doc-class 键判别**——overall-spec vs phase-spec 由路径派生，非 `RouteTarget.type` 裸值；无 target 兜底裸词 `done`）· 接线字面**前缀省略**（`review --type branch --plan <plan>` 无 `cdd`）
- **引擎 next 止于 `/kairos:cdd-close`**（不跨 phase · 任何目标是 `cdd-design` 的推进 = 跨 phase，不在 next 内）
- **`next:` 字面 deliberate pin break**（破 P5 冻结契约 · 显式登记）
- **rounds 只有数组身份形**（旧数字形不兼容 · 无兼容层）
- **零声明再抄**：slug→路径从 slug 推导 · face 间接线序从 `PIPELINE_NEXT` 单表取 · skill ref 从 `REFS` 取
- **纯读无副作用**：board 不写树 / 不写 ledger / 不派发 child
- **不发布**：变更集归并落 pending
- **触碰历史 pin「cdd CLI 零新子命令」**：board 为新增第七命令，连带修订（文档先行——本 spec 即该修订落点）
- **fix 路由括注单源（§11）**：载体动作措辞只在 `FIX_READBACK_SUFFIX` 一处声明，capsule 逐字渲染；skills 不复写引擎措辞（D29 判据——运行时字面即编排器的说明）
- **doc type 声明单源（§12 · D34）**：doc 类型是文档声明的声明性事实（header `- **Doc type**:`），**不是文件名的派生事实**——零文件名→类型推导面（`deriveDocType` 后缀规则/`#docKeyOf` 退役）· 零双读层（缺声明 = BLOCKED，不兜底）· 零文件名 cross-check（声明类型即 doc-contract 门校验键）· slug 扫描只按前缀+目录分组，不承载类型
- **digraph 边条件 = 引擎字面世界观的镜像（§13 · D35）**：skill digraph 的边条件词必须与引擎 next 面的实际字面序列一致——`done` 只渲在引擎真给 done 的位置（overall 闭合/流水线终点），编排器循环退出条件是 **terminal**（字面交出编排权），不是 done；编排器零 branch 专属路由知识（引擎字面即全部）
- **hub 只承载活流量（§15 · D37）**：一个 NEXT-LOOP hub 的存续以「有生产者」为判据——引擎 next 面封顶于 `/kairos:cdd-close`（不跨 phase），任何 design-scope hub 无 next 生产者即死节点，整体消融（编排器集合是双向完备的直边 DAG，非强制每 skill 一个 hub）；家族分类反映真实形状（无自环 → `onepass`）

## Change history
| Version | date | summary | author |
|---|---|---|---|
| v0.1 | 2026-10-14 | P8 设计实写——`cdd board <slug>` 一等公民：plan-graph 提级（显示路由 + 门名退役 §2/§3）· slug → 节点树文件系统唯一真源（§4）· 全节点 verb×round 细粒度板（§5）· next 全 line×全 verb 严格线序 + skill ref 交叉点（§6）· 六前提重构整合（§7）· 消费面同步（§8）· grilling Q1–Q11 全按用户裁定 | Oscar M. · Claude Opus 5 |
| v0.2 | 2026-10-14 | **统一 next 面折入（D33 · 用户 in-flight 需求 backfill）**：命题升为「`cdd board` slug 进度板 + 引擎统一 next 面」——引擎 `next: done` 由「本线链条耗尽」升为「**CDD 流水线的下一站**」（spec→`/kairos:cdd-plan` · plan→`/kairos:cdd-dev` · wave→`cdd review --type branch` · branch→`/kairos:cdd-close` · 止于 close 不跨 phase · skill ref 按 harness 渲拼写）· 新增 §6 引擎统一 next 面（`PIPELINE_NEXT` 单表 · 渲染落 `Capsule#routeText` · router 不动）+ §7 skills handoff 节点溶解 · 原 §7/§8 顺延 §8/§9 · board 的 next 改为**消费**引擎统一 next 面（不再自建表）| Oscar M. · Claude Opus 5（P8 编排器方案回填 · 用户确认） |
| v0.3 | 2026-10-14 | **六前提复盘校订（用户裁定 A/C + F1/F3/F4' 更正）**：① **F1 更正**——overall **也有 rounds**（可被评 → 有自身 review/fix 轮）· board **按节点读各自工作区**（overall 读 `<program>-overall/` · phase 读 `<program>-p<N>/`）· overall 行不特殊化（§5.1/§5.3）· ② **F3 更正**——`rounds[verb]` **只有数组身份形**（`[1,3]` = 第 1、3 轮），旧数字形不兼容（历史残留已清）· ③ **F4' 定案 (a)**——**next 绝不跨 phase**（任何目标是 `cdd-design` = 跨 phase，不在 next 内）；program 板 next 与引擎 next 字面一致（恒 `done`）· ④ **A 不拆 P9**——统一 next 面正好充 board 的消费验证 · ⑤ **C**——`next:` 是编排器唯一驱动（Next-Loop）；显式登记 **`next:` 字面 deliberate pin break**（破 P5 冻结契约 · §6.5）· ⑥ **F2 消矛盾**——§6.3 删「wave 的 done 仍渲 done」例外（按线型查表统一）· ⑦ **F5 悬案收口**——wave 线 `next-wave`（有波）vs `done`（全闭合）在 route.kind 层判 · 方案 (a) 落定（零新 route kind）· ⑧ **F8 升级硬阻塞**——skill-anatomy 契约同步为前置（非"可能"）；实测 handoff 节点仍在（待实现溶解）；cdd-design `handoff-next` 不在本 phase 范围 | Oscar M. · Claude Opus 5（P8 编排器复盘回填 · 用户确认） |
| v0.4 | 2026-10-14 | **§6 重构为「两台转移表」框架（用户裁定 · 声明再抄校正）**：用户指出「review 有无 findings 的 next 逻辑系统已存在，不需重述」——§6 由「复述 C5 表 + 混述」改为**职责分家**：**C5 表 = face 内转移**（review⇄fix · wave 波推进 · 已存在不动）· **`PIPELINE_NEXT` 表 = face 间转移**（face 耗尽 `done` → 下一 face 入口 · 本 phase 新增）。§6.3 给**完整流水线接线图**（`spec─→/cdd-plan─→plan─→/cdd-dev─→wave1→…→waveN─→branch review─→branch─→/cdd-close`，`→` = face 间接线 · `⋯` = face 内 C5）。§6 各节重排（6.1 命题 · 6.2 两台表 · 6.3 face 间接线面焦点 · 6.4 渲染落点 · 6.5 board 消费 · 6.6 Next-Loop）；删「线序从 `targetFaces` 派生」（改显式 `PIPELINE_NEXT` 表）；交叉引用与 Constraints 同步 | Oscar M. · Claude Opus 5（P8 编排器方案校正 · 用户确认） |
| v0.5 | 2026-10-14 | **spec-review-1 八 findings 修复（v0.4 URC 单循环评审）**：§6.3 `PIPELINE_NEXT` 键由 `RouteTarget.type` 裸值改为 **doc-class 键**（overall-spec vs phase-spec 由路径派生——overall 闭合 → `done`，跨 phase 不参与）· wave 行接线字面一律**前缀省略**（`review --type branch --plan <plan>`，与 capsule 逐字节一致）· §6.3 `PIPELINE_NEXT` **单址定于 `session/next.ts`**（消 either/or）· §6.4 渲染面**穿线 host**（`Capsule` 增持 host，经 `detectHost()`）+ 无 `target` 的 `case "done"` **兜底裸词 `done`**（既有 `face.test.ts:91/235/287` 无 target pin）· §6.6/§9.3 现有 **`next: done` byte pins 逐一登记为重锚**（`cli.test.ts:1451/1630/1782/1826/1860/1907/2082/2104/3461` · `face.test.ts:91/235/287`）· §7.2 loop-shape 不变式**显式重定义**（`loopHubNode.rowPrefixes`/`nextLoopConditions`/`loopShapeRule`/`edgeConditionRule`）· §3.1 增 **`PreFlightReason` 成员改名** · §9.1 消费面同步增 **`packages/cdd-engine/README.md` ×2 镜像**（`presentation-surface.test.ts:278-286`）+ kairos README 命令清单须按 `CDD_SUBCOMMANDS` 成员序；AC/Constraints 同步 | Oscar M. · Claude Opus 5（P8 docs-fix round 1） |
| v0.6 | 2026-10-14 | **spec-review-2 四 findings 修复（v0.5 URC 单循环评审）**：① **B3（blocker）**——§9.3 增**六命令结构性 pins 重锚**（`cli.test.ts:388` + `projection.test.ts:57` 两处 `toEqual` 精确列表，第七行 `board` 即红 → 重锚为七行；动态循环 `:995` 不翻红，非重锚集）；② **W7（warn）**——§6.4 host 源锚点**改写为可实施**：`detectHost()` 是 `CliLifecycle` 实例方法（lifecycle.ts:152 · 唯一调用者 :180）、`cli.ts` 不可达、工作入口是单一 `#runWork`（:379 · 无 per-verb 方法）、`--dry-run` 的 `#dispatchOf`（:558）不构造 `CliLifecycle` → 改定案**把 host 判定上提为 `host.ts` 模块级判定**（`CliLifecycle` 委托 · 组合根以 `process.env` 调用并穿线入 `Capsule` · 全路径含 dry-run 恒可达）+ **无 host 兜底 claude 形拼写**；③ **W8（warn）**——§7.2 固定**溶解后 NEXT-LOOP 出边形状为两条**（`until next=done` 自环 + `no next`→BLOCKED · 闭合出口删）并列 **checker 常量同步**（`skill-anatomy.test.ts:410` `out.length` 3→2 · 闭合出口断言 :390/:398 删 · 自环 :392 保留 · 词表 :419 随 `nextLoopConditions` 收窄）；④ **N3（nit）**——§6.6/§9.3 去**「每个 `next: done` 翻转」假全称**：`cli.test.ts:1826` 是 overall 线（doc-class 规则保持 `done`），移出翻转集并登记为**唯一不翻转的 doc-line pin**；AC/历史同步 | Oscar M. · Claude Opus 5（P8 docs-fix round 2） |
| v0.7 | 2026-10-14 | **spec-review-3 四 findings 修复（v0.6 URC 单循环评审）**：① **B1（blocker）**——§7.2 loop-shape 重定义改为 **scope-aware**：`cdd-design` 亦注册 `{role:"orchestrator", family:"loop"}`（contract :127）且其 `handoff-next`（skills/cdd-design/SKILL.md:32）明确在 scope 外，故单一全局 `out.length 3→2` + 窄化 `nextLoopConditions` 会把 cdd-design 打红。定案——增 `SKILL_ROSTER` per-skill handoff 域事实（`pipeline` = 三流水线 skill · `design` = cdd-design）· `rowPrefixes` 收为 per-scope record · `nextLoopConditions` **保留三成员不窄化** · `loopShapeRule`/`edgeConditionRule` 按域分句 · `out.length` 按域（pipeline 2 · design 3）· 闭合出口断言块仅对 design 域运行；② **W2（warn）**——§9.3 把 `face.test.ts:91/235/287` 移出翻转集：其均以无 target 的 `{kind:"done"}` 调 `emit`，按 §6.4 缺 target 兜底字面逐字节不变，登记为与 `cli.test.ts:2340` 同属「保持绿」；③ **W3（warn）**——§6.4 host 源输入类型**不得复用 `ProcessEnvLike`**（homed `lifecycle.ts:86` · `lifecycle.ts:29-36` 反 import `host.ts` —— 复用即新增 `host.ts`→`lifecycle.ts` 环）；定案取内联结构类型 `Record<string, string | undefined>`；④ **N4（nit）**——§9.3 六动词列表锚点 `:995`→`:990`（`:995` 是 `toHaveLength(6)` legend 计数）；AC/历史同步 | Oscar M. · Claude Opus 5（P8 docs-fix round 3） |
| v0.8 | 2026-10-15 | **spec-review-4 两 findings 修复（v0.7 URC 单循环评审）**：① **W（warn）**——§9.3 既有 `next: done` byte pin 翻转集**补 `cli.test.ts:2905`**：dry-run real-chain 测试的 wave-2 闭合（`review --type wave --tasks 2` on `planFor(repoRoot, 2)`，`expect(nextOf()).toBe("done")`），与所列 `:1451` 同属 wave 线闭合翻转类（§6.3/§6.6 wave 闭合重渲 branch-review 字面）；其逃逸历轮字面 grep 的根因是经 `nextOf()` helper 取载荷、从不携带 `next: done` 字面，故翻转集清点须扫 helper 取出的 next 断言（盲区修正）；② **Nit**——§9.3 「不翻转保持绿」例外枚举**补 `cli.test.ts:2772/2794`**：二者均 `literalOf({kind:"done"})` 无 target，按 §6.4 缺 target 兜底渲裸词 `done`，与所列 `face.test.ts:91/235/287` 同属「保持绿」，令例外列表对称 | Oscar M. · Claude Opus 5（P8 docs-fix round 4） |
| v0.9 | 2026-10-15 | **回归更正 backfill（用户裁定 · D29 判定补正 · in-flight）**：用户发现 `author-spec`/`author-plan` 丢失骨架 bootstrap 命令——**P7/D29 回归**（`9d6f4e27` 明文删 `schema get … --output skeleton` 语法；P5/P6 曾载「generate the canonical skeleton first … fill its slots in place」）。**根因**：D29 按「形状」切而非「角色」切——`schema get … --output skeleton` 长得像内部语法而被剥，却正是 D29 自己 bootstrap 例外（入口节点唯一字面命令）所指；剥离清单与例外对撞，清单赢了；删后以散文复述补位 = 重演 D29 要消灭的第二真相。**逃逸面**：skill-anatomy 契约无「author 节点必携 bootstrap 字面」pin → 四轮 review 全过。**更正**：判据从「形状」改「角色」——入口发起命令 = 例外面（保留），内部结构镜像 = 剥离面（§10.3）；P7 历史 frozen 不动，**P8 为本更正 owning doc**。**热修（用户裁定）**：恢复两 author 节点的 bootstrap 字面（只命令 + fill in place · 不复述槽位名）+ 删散文结构复述 + 在 skill-anatomy 契约/检查器补回归 pin。新增 §10 + AC 2 条 + Constraints 1 行 | Oscar M. · Claude Opus 5（P8 编排器 backfill · 用户裁定） |
| v1.0 | 2026-10-15 | **fix 路由载体括注措辞更正 backfill（用户裁定 2026-10-15 · D28 措辞补正 · in-flight）**：`FIX_READBACK_SUFFIX` 由 `(confirm the findings · annotate the carrier with the adjudications)` 改 **`(confirm the findings · if a finding needs a ruling, record the ruling in the findings file)`**（用户裁定：`if needed` 判据 = findings 是否需要裁定；措辞经消费者视角复议定案为行为语言——冷启动编排器无 repo 运维文档，`handoff carrier`/`adjudications` 内部词汇不可解引用，定案句零黑话自足）；**skills 侧括注整句剥离**（cdd-dev/cdd-plan/cdd-spec-writer/cdd-design 四文件——括注是引擎渲染面的内部镜像，运行时随 `next:` 字面给到编排器，skill 文本自持措辞副本 = D29 要消灭的会漂移第二真相；用户裁定：skills 只需「照 next 字面执行」）。P7/D28 历史 frozen 不动，**P8 为本更正 owning doc**（§10 同判例）。热修面：`next.ts` 常量值 + 注释 · `capsule.ts` 注释 · `next.test.ts` 两 literal pin · 四 SKILL.md 括注删 · `02-naming.md` annotate 行随改 · emit 重生成。新增 §11 + AC 1 条 + Constraints 1 行 | Oscar M. · Claude Opus 5（P8 编排器 backfill · 用户裁定） |
| v1.1 | 2026-10-15 | **Doc type 声明上收 + 文件名推导退役 backfill（用户裁定 2026-10-15 · D34 · in-flight）**：用户指出 `deriveDocType`/`BoardView.#docKeyOf` 重复声明 + 「文件名判断 doc type 容易出错（agent 不能保证完美复刻命名规则）」。**根因**：重复声明只是症状，「文件名承载类型语义」是病灶——文件名是类型的派生副本（声明再抄温床 · premise 3），命名规则须被每个 author agent 心智复刻（premise 5），规则一改全消费点同改。**定案（三点）**：① header 增 `- **Doc type**:` 声明行（值域 = 现有四值 DocKey · skeleton 生成 · 零别名层）· ② 文件名推导**整体退役**（`deriveDocType` 后缀规则 + `#docKeyOf` 删除——重复声明被消灭非修复；剩一个声明读取面，validate/preflight/board 三消费点单源；header marker 扫描不选 parser——parsers-by-type 循环依赖是伪装的）· ③ 缺声明硬 BLOCKED + 存量单 commit sweep（零双读兜底层）。**并入 P8**（W1 已落 `#docKeyOf`，实现中修订，premise 1 破坏性允许）。新增 §12 + AC 1 条 + Constraints 1 行；plan 修订随落（T2/T4/T5 + T3 依赖面 + T7 pin 面） | Oscar M. · Claude Opus 5（P8 编排器 backfill · 用户裁定） |
| v1.2 | 2026-10-15 | **自环词表更正 + branch 节点消融 backfill（用户裁定 2026-10-15 · D35 · in-flight）**：用户指出四 skill 的 `until next=done` 在 D33 后全失真（cdd-plan/cdd-dev/cdd-design 的 next 序列 done 永不出现——until 永假，正常出口字面缺失；spec-writer 仅 overall 变体可达 done）+ W1 落地的 cdd-dev branch-review/branch-fix 成孤岛（wave→branch 入边已由引擎字面承载，digraph 断为两连通分量；checker 不查连通性故静默通过）。**定案（四点）**：① cdd-dev branch 双节点消融（引擎 C5 + PIPELINE_NEXT 已完全承载 branch 接线 · branch 专属事实收 hub Do + Failure Modes · 单 hub 二出边 pin 不破）· ② 四 skill 自环标签 → `until next is terminal`（terminal = done 或 skill ref/引擎命令字面）· ③ cdd-design 闭合出口 → `until session closes → handoff-next`（design 续环非引擎字面，不蹭 done 语义 · design 域三出边不变）· ④ 契约同步（`nextLoopConditions`/`loopShapeRule`/`edgeConditionRule` 随新词表 · branch 独立闭环断言块退役 · `out.length` 域规则不动）。新增 §13 + AC 1 条 + Constraints 1 行；plan 后置任务随落 | Oscar M. · Claude Opus 5（P8 编排器 backfill · 用户裁定） |
| v1.3 | 2026-10-15 | **host 通道完整性 backfill（用户裁定 2026-10-15 · D36 · in-flight）**：W1 执行期两次 `CDD_BLOCKED: child claude returned no status line`（两次皆长任务 child——工作面完好、载体已写 APPROVED、唯 stdout 尾部状态块丢失；短 child 零事）。**根因（双证）**：`SyncRunner` 的 `execFileSync` 未传 `maxBuffer`（Node 默认 1 MiB · 超限尾部截断）+ 联网检索证实同族已知问题（anthropics/claude-code #6279/#15813/#17197 · `--print` 长输出被 exec 族包裹截断）。**定案（根本修非补丁 · 六前提）**：`SyncRunner` 弃 `execFileSync` 改 `spawn` + 同步流式聚合（`data` 事件增量收集 + `Atomics.wait` 阻塞至 EOF）——`maxBuffer` 天花板的整个类别被消灭；`spawnSync`（同样带 maxBuffer）与 async 化（撕开全同步 dispatch 契约）双否决；face 零变（`{code,stdout,stderr}` · `--output-format text` · `RETURN_STDOUT_BLOCK` 契约零动）· stderr 同法聚合 · 回归 pin（>1 MiB 输出完整到达）。新增 §14 + changeset | Oscar M. · Claude Opus 5（P8 编排器 backfill · 用户裁定） |
| v1.4 | 2026-10-15 | **host 通道载体由「自造 spawn 流式」改为 execaSync（用户裁定 2026-10-15 · D36 修订）**：v1.3 定案的 `spawn` + worker-线程同步流式聚合被用户裁定改向——联网核查发现成熟活跃的第三方进程库 **execa**（sindresorhus · v10.1.1 · engines≥22），其同步面 `execaSync` **默认 `maxBuffer` 无上限**，且把**双管道并发排水**内建承于 `spawnSync`。自造 pump（约 118 行 worker 并发机器）既是自造轮子（premise 2），又把排水正确性重担放回引擎（premise 3/4）。**定案修订**：`SyncRunner` 改 `execaSync(command, args, {cwd, reject:false, stripFinalNewline:false})`——face 零变（同步 · `{code,stdout,stderr}` · fail-open 保持 · `RETURN_STDOUT_BLOCK` 契约零动）· 结果回读 `exitCode ?? 1` + stderr 走 `shortMessage` 诊断 · 新增依赖 `execa`（传递依赖 12 个，用户知情下裁定）。§14.2/§14.3 重定向 + 回归 pin 不变 | Oscar M. · Claude Opus 5（P8 编排器 backfill · 用户裁定） |
| v1.5 | 2026-10-15 | **cdd-design NEXT-LOOP hub 消融 + onepass 归类 backfill（用户裁定 2026-10-15 · D37 · in-flight）**：用户问「cdd-design 的 next-loop 节点有没有用」——查证发现其 hub 自环 `until next is terminal` **无生产者**（引擎 `PIPELINE_NEXT` 只产 cdd-plan/cdd-dev/cdd-close 三 ref · `REFS` 里 `kairos:cdd-design` 行零消费者 → 零 design 路由 = D33 明文的「design 不在 next 内」），唯一入边（委托 writer flow）在其自身 NEXT-LOOP 内消化 spec next 字面后 hand off，不回投——与 D35 消融的 cdd-dev branch 孤岛**同构**（死流量 · checker 不查连通性故静默通过）。**定案（两点）**：① hub 整体消融（`run-cdd-spec-writer` Exit 直收 `handoff-next`，对齐 `run-cdd-charter`）· ② cdd-design `family: loop→onepass`（`onepass` 语义由「one-shot toolchain」一般化为「one-pass · 无自环」）。**契约同步**：design-scope hub 机械整体退役（`handoff` 字段整体移除（零读者=死码）· `rowPrefixes` · design out-length=3 · `until session closes` 词 · 闭合出口断言块 · `registry.crossings["cdd-design"]`（消融后 12 节点/16 边均回限内））。新增 §15 + AC 1 条 + Constraints 1 行 · **新 T11**（DependsOn 9）+ T7 DependsOn += 11 | Oscar M. · Claude Opus 5（P8 编排器 backfill · 用户裁定） |
| v1.6 | 2026-10-15 | **cdd-design 节点改名 + handoff 分裂 backfill（用户裁定 2026-10-15 · D38 · in-flight）**：D37 消融 hub 后 `handoff-next` 一名两义——spec 线应交引擎统一 next 面（`PIPELINE_NEXT` 的 `phase-spec → kairos:cdd-plan`），charter 线才交 design 域续环（`/compact` 或下一 phase 的 `kairos:cdd-design` [Px]）。**定案（三点）**：① `run-cdd-spec-writer` → `run-cdd-spec`（与 `run-cdd-charter` 对标 · 去 `-writer` 赘余）· ② `run-cdd-spec → handoff-next`（此 `handoff-next` = **遵循引擎 `next:` 字面规范**）· ③ `run-cdd-charter → handoff-phase-design`（新终端 · 承接**原 handoff-next 的 design 域行为**——hand off 到 `/compact` 或下一 phase 的 `kairos:cdd-design` [Px]）。**契约同步**：cdd-design digraph **12 → 13 节点**（+`handoff-phase-design`）· **边 16 不变**（`C → handoff-phase-design` 仅改边 target，`W → handoff-next` 保留）· 契约（`skill-anatomy.ts`）零改（通用节点名规则不枚举 handoff-* 名字）。新增 §16 + AC 1 条 · **新 T12**（DependsOn 11）+ T7 DependsOn += 12 | Oscar M. · Claude Opus 5（P8 编排器 backfill · 用户裁定） |
| v1.7 | 2026-10-15 | **handoff draft 读面宽容解析 backfill（用户裁定 2026-10-15 · D39 · in-flight）**：W3 `{5,11}` implement 轮 BLOCKED——`tasks-5,11-implement.json`（子代理 LLM 手写的 carrier）`notes` 数组尾逗号，裸 `JSON.parse` 一票否决整轮。用户指出「这不是严重 JSON 问题 · JSON5 类库可解析」。**调研（实测）**：`jsonc-parser`（Microsoft 官方 · 2026-07 更新 · 74.2M/wk · **零传递依赖** · ESM+CJS）`{allowTrailingComma:true}` 精确容忍尾逗号/注释、仍对真错误报错 + 精确错误码；`json5`（休眠 2023-03 · 容忍过度）· `momoa`（3.45M/wk）默认均不容尾逗号。**定案（两点）**：① 载体 **jsonc-parser + `allowTrailingComma:true`**（最活跃且官方 · 零依赖 · 宽容精准——消灭 LLM 手写噪声，不放过真损坏）· ② 作用域**仅子代理手写 handoff draft 读面**（引擎自写文件经 `JSON.stringify` 恒合法，严格读；宽容不污染 JSON 契约）。新增 §17 + AC 1 条 · **新 T13**（DependsOn 11） | Oscar M. · Claude Opus 5（P8 编排器 backfill · 用户裁定） |
