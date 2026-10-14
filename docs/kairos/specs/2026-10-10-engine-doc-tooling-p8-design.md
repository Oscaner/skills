# 引擎文档工具（Engine Doc-Tooling）— P8 设计：`cdd board <slug>` slug 进度板（plan-graph 提级一等公民 · 文件系统唯一真源 · 全节点 verb×round 细粒度 · next 指路到引擎命令与 skill ref）
- **Version**: v0.1 · 2026-10-14
- **Status**: Draft
- **Author**: Oscar M. · Claude Opus 5（kairos:cdd-design [P8] 会话 · 用户裁定 · 2026-10-14）
- **Parent program**: [引擎文档工具（Engine Doc-Tooling）Overall](2026-10-10-engine-doc-tooling-overall.md)
- **Depends on**: P7（Done · v0.9 · hard——P7 全链闭合后 plan-graph 升级一等公民 slug 进度板 · overall 依赖图 D32）

## Design

本 phase 承接 P7 收口后的续观测面能力（程序七 phase 收口后的续 phase · 2026-10-14 cdd-design [P8] 会话注册 D32 · grilling Q1–Q11 全按用户裁定落定）。**统一命题——`cdd` 的第一个「全局态势一面墙」命令 `cdd board <slug>`**：一条命令、slug 为唯一输入，把该 slug 所辖的整棵相位树的态势一次铺开——**定位（slug → overall/spec/plan 路径）· 进度（overall/spec/plan/wave/branch 全节点 · 每节点摊 implement/review/fix 三 verb 的轮次）· 指路（当前该执行的 cdd 命令或 skill ref）**。其来源是 `plan-graph`——它现为 `cdd schema get` 下的一个 **display 路由**（挂在一个*发现*命令上的*显示*路由 = 内聚性污点，且只吃 `--plan`、只看得见 wave 波链），本 phase 把它**升为独立一等公民命令**并扩展为 slug 进度板。

设计输入：kairos:cdd-design [P8] 会话（D32 注册 · grilling Q1–Q11 裁定）· overall v2.32（D32）· recon（引擎 CLI 命令注册面 · `plan-graph` 全触点 grep · `Workspace.slugFromDoc` 逆推导缺口 · 真实 `progress.json` 数据面 · `REFS[ref][host]` 现成 harness 拼写解析机制 · `docs/kairos/{specs,plans}` 相位文件命名实测：`-p3`/`-p3.1`/`-p4.1` 并存而 `-p4` 缺失）。

### 1. 目标与边界
#### 1.1 设计输入与授权
- 设计输入：kairos:cdd-design [P8] 会话（D32 注册 · Q1–Q11 全裁定）· overall v2.32 · recon 报告（引擎命令注册/声明面 · plan-graph 全触点 · slug 逆推导 · progress.json 实况 · REFS harness 拼写 · 相位文件命名实测）
- **授权（六前提 · 用户 mandate）**：允许破坏性变更、重写代码重组目录、不保守不打补丁 · 从高维思考、OOP 抽象统一、零裸函数 · 最佳实践、不留技术债务、避免散文堆砌、避免声明再抄 · 高内聚低耦合、死代码空壳全清 · 消费者心智负担优先（不为完成任务而设计）· 最大程度重构整合、最大程度精简系统
- **不发布**（与 P1–P7 一致）：变更集归并落 pending · tag / publish = 独立动作
#### 1.2 判定基线（本 phase 的根前提）
- **`plan-graph` 是内聚性污点**：它现为 `cdd schema get` 的一个 `--output json` display 路由（`SCHEMA_TYPE_KEYS` 之外的透传特判 · `#parseTypeKey(raw, planGraph)` 的 leaf-level 旁路），消费面读作 `cdd schema get plan-graph --plan <path>`——**一个*显示*面挂在*发现*命令下**，且受限于单 `--plan` 输入、只渲染 wave 波链。本 phase 把它提为独立命令，`schema get` 回归纯 doc-structure 发现面。
- **slug 是一个节点地址 · 点分相位路径任意深度**：`<program-slug>[-p<主>(.<子>)*]`——`-p3` 与 `-p3.1` 与 `-p3.2.1` 同为相位节点，层级可无限衍生。**文件系统是唯一真源**：节点集合由**扫描** `docs/kairos/{specs,plans}` 得出，绝不按命名规则合成盘上不存在的节点（实测：`doc-architecture-v2` 族 `-p4.1` 存在而 `-p4` 缺失 · overall 自己的 File paths 表仍写 `p<N>` 占位符——声明面已与文件面脱节）。
- **进度数据面单一**：`progress.json` 的 `rounds[verb]`（周期号集合 · D28 身份号）是唯一进度数据源，spec/plan 自己也是进度行（doc 线键 `"spec"`/`"plan"`），与 wave 行（波键 `"1,2,5,8"`）、branch 行（键 `"branch"`）同构——**板是全节点的同一份数据的投影，零新数据、零新判定**。
- **harness 拼写解析现成**：`REFS[ref][host]`（face/host.ts）+ 运行时 host 判出（`lifecycle.ts:253` §）已承载 skill ref 的 per-harness 拼写——board 的 next 渲染 skill ref 时**复用**它，绝不硬编码某个插件的 `/kairos:cdd-plan` 拼写。
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
- `session/preflight.ts`：`PreFlightGateName`（:38）的 `"plan-graph"` → `"graph"`；`PreFlightVerdict` 的 gate/reason 腿同步；`gates.push("plan-graph")`（:147）→ `"graph"`；verdict 的 `gate: "plan-graph"`/`reason: "plan-graph"`（:153-154）→ `"graph"`；注释段（:6/:10/:142）叙事随改。
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
#### 5.1 数据源（单源投影）
- 板读该 slug 工作区的 `progress.json`（`Ledger`）——每行摊 `implement×N · review×N · fix×N`（`progress.rounds[verb]` 周期号集合的大小或逐号列出 · D28 身份号）。**spec/plan 线**（doc 线键 `"spec"`/`"plan"`）· **wave 线**（波键 `"1,2,5,8"`）· **branch 线**（键 `"branch"`）全部来自 `rounds`。
- overall 为 charter，无自身 round → 该行留空（不特殊化逻辑，只是该行无数据）。
#### 5.2 wave 行：每波一行 + 波链与明细同现（Q8(b)）
- wave 行**每波一行**：波号 + 该波在 `GraphView` 波链中的 ✔/▶/○ 标记 + 该波键的 `implement×N · review×N · fix×N` 明细。多波不发散内联（每波独立一行），避免行宽爆炸。
- 波链标记与明细取自同一 `TaskGraph.report(closedWaves())`（`GraphView` 复用）+ 该波 `progress` 行——**同一 `closedWaves()` 读**（与 preflight gate 同源 · 一处实况）。
#### 5.3 布局（Q8 · 用户确认形状）
```
cdd board: <slug>

  overall  <path>  v2.32 · Draft
  spec     <path>  v0.14 ✔ Done   review×6 · fix×5
  plan     <path>  v0.9  ✔ Done   review×2 · fix×2
  wave     W1 ✔  implement×1 · review×1 · fix×1
           W2 ✔  implement×1 · review×2 · fix×1
           W3 ▶  implement×1 · review —
           …
  branch   ✔ closed   branch-review×1 · fix×1

  next:    <最长可推进动作，或 done>
```
- 固定 legend 尾行（同 `GraphView` 现风格）：`progress: ✔ done · ▶ current · ○ pending`。
- 缺 plan 的中间层级节点：wave 段留空（不报错）；无 overall：overall 段留空（降级不报错）。

### 6. next 面：全 line × 全 verb 状态机（严格线序）
#### 6.1 线序常量（单一来源）
- 线序 **spec → plan → wave → branch**（CDD 固有阶段序，**严格不可跳**）。该序**从 `targetFaces`（session/faces.ts）派生顺序**，不另写一张表（避免声明再抄）。
#### 6.2 每条线的「下一动作」
- **该线有 round** → 取最新 round 过 `NextStepRouter`（C5 表）→ route（review 有 findings→fix · review 无 findings→close · fix blocker>0→review · fix→close）。
- **该线无 round（未开始）** → 起始动作：doc 线（spec/plan）= `review`；wave 线 = 首个未闭合波（`TaskGraph.frontier`/`readyBatch`）的 `implement`；branch 线 = `branch-review`。
#### 6.3 全局 next（第一条未闭合线）
- 按线序遍历，取**第一条 route ≠ done 的线**的动作——你举的三例全部自然落在此规则下：spec 闭合→跳 plan；wave1 闭合→取 wave2 的 implement；review 有 findings→取该线 fix。
- **skill ref 交叉点（Q7 · 用户裁定）**：**spec 线 review-fix **全闭合** → next = `/kairos:cdd-plan`（skill ref）；plan 线 review-fix 全闭合 → next = `/kairos:cdd-dev`（skill ref）**。即：一条 doc 线闭合后，推进到「该由 skill 承担」的下一环（author plan / run dev），而非引擎命令。
- 其余动作是**完整可执行引擎命令**（Q10 · 用户裁定「完整」）：如 wave frontier 非空 → `cdd implement --type wave --tasks <ready> --plan <plan>`；doc 线未闭合 → `cdd review --type spec --spec <path>` 等——与引擎既有 `next:` 字面同款完整命令（复用 `Capsule#routeText` 的拼装）。
#### 6.4 skill ref 的 harness 拼写
- `REFS[ref][host]`（face/host.ts）+ 运行时 host 判出（`lifecycle.ts:253` 同款）——claude/cursor 渲 `/kairos:cdd-plan`，pi 渲 `/skill:cdd-plan`。**不硬编码插件拼写**（引擎对 skill 是黑盒 · D29）。
- 全 done → `next: done`。

### 7. 六前提重构整合（破坏性 · 重组 · 零裸函数 · 死码清理 · 最大精简）
#### 7.1 组件升降与目录
- `GraphView`（face/graph-view.ts）由「独立显示路由的渲染器」降为「board 的 section 渲染器」——文件保留（组件仍有价值），接线改挂到 board 组合面。
- 新增 board 组合面（渲染器）——**OOP 类**（零裸函数），持：slug 解析（§4）· 节点树装配 · 各 section 渲染 · next 派生（§6）。board 与 `Capsule`/`GraphView` 的分工：`Capsule` 渲「一轮的输出胶囊」，`GraphView` 渲「一波板」，board 渲「一 slug 的全局墙」——三者同层，board 组合其余两者。
#### 7.2 死码/空壳清理
- `plan-graph` display 路由的 leaf 分支、`#parseTypeKey` 的 `planGraph` 参数、`SCHEMA_TYPE_KEYS` 注释旁路——全删（§2.3）。`plan-graph` 门名改（§3.1）。
#### 7.3 零裸函数
- 新增/改动面全为类成员（`Workspace.docsOfSlug` · board 渲染类的方法）——合 `check:no-bare-functions`（全局 `^export function|^function` 零命中）。
#### 7.4 声明再抄抑制
- slug → 路径从 slug 推导（不解析 overall 表）；线序从 `targetFaces` 派生（不另写表）；skill ref 从 `REFS` 表取（不硬编码）。零平行声明。

### 8. 消费面同步
#### 8.1 六命令引用更新（六 → 七）
- `packages/kairos/README.md`：命令清单（:71 · `implement / review / fix / base / schema / issue`）增 `board`；`packages/kairos/README.zh-CN.md` 同改。
- `packages/kairos/tests/presentation-surface.test.ts`：`CDD_SUBCOMMANDS`（:51）增 `"board"`；相关 README 断言随改。
- `packages/kairos/tests/skill-anatomy.test.ts`：命令捕获正则（:253 · `cdd (implement|review|fix|base|schema|issue)`）若无 `board` 引用需求则不动；若 skills 文本引用 board 则需增。
#### 8.2 消费面 skill 文本
- 若有 skill 引用 `plan-graph` 或需引导用 `cdd board`——由 author 节点表述承载（消费面指引归 skills）。recon 确认 skills 文本当前零 `plan-graph` 引用（无需改）。
#### 8.3 pin 重锚（破坏性 · deliberate）
- `face/__tests__/cli.test.ts` 的 plan-graph pins（unknown schema type 报错文本含 `, plan-graph`（:627/:2951/:3361）· skeleton 拒绝（:664-675）· `schema get plan-graph` 读（:2636/:2661/:3403-3412））——全量重锚为 `board` 命令断言 + unknown schema type 报错文本去 `, plan-graph`。
- `face/__tests__/projection.test.ts` 的 `plan-graph passes through`（:185-193）· `face/__tests__/graph-view.test.ts` 的 title 字面（:22/:25）——随 `graph` 门名/board 重锚。
- `session/__tests__/preflight.test.ts` 的 gate 名 pins（若有 `plan-graph` 字面）——重锚为 `graph`。

## Acceptance criteria
- `cdd board <slug>` 输出全局态势板：overall/spec/plan/wave/branch 五行 + 各 `implement×N · review×N · fix×N` + wave 每波一行（波链 ✔▶○ + 明细）+ 固定 legend + `next:` 行
- slug → 三文档路径以**文件系统为唯一真源**：扫描 `docs/kairos/{specs,plans}` 命中 `<slug>*` 树化 · **不合成盘上不存在父节点**（`doc-architecture-v2` 族 `-p4.1` 存在而 `-p4` 缺失场景正确树化）· **不解析 overall File paths 表**
- 点分相位路径任意深度：`-p3` · `-p3.1` · `-p3.2.1` 同为相位节点
- next 全 line × 全 verb 严格线序（spec→plan→wave→branch）：spec 闭合 → 取 plan 线动作 · wave1 闭合 → 取 wave2 的 implement · review 有 findings → 取该线 fix
- **skill ref 交叉点**：spec 线全闭合 → next = `/kairos:cdd-plan`（按 harness 渲拼写）· plan 线全闭合 → next = `/kairos:cdd-dev`（按 harness 渲拼写）
- 引擎命令型 next 为**完整可执行命令**（`cdd implement --type wave --tasks <ready> --plan <plan>` 等）· 全闭合 → `next: done`
- `plan-graph` 作为词从引擎消失：`schema get` display 路由退（leaf 分支零命中）· `SCHEMA_TYPE_KEYS` 旁路注释零命中 · `#parseTypeKey` 的 `planGraph` 参数零命中 · preflight 门名 `graph`（`plan-graph` 字面零命中）
- `cdd board` 无副作用（零写树 · 零写 ledger · 零 child 派发）· 缺 slug / 无匹配文件 → exit 2
- `CliVerb` 七值 · `CLI_COMMANDS` 含 board 行 · 消费面六→七命令引用同步（kairos README ×2 + presentation-surface.test）
- 零裸函数（全局 `^export function|^function` 零命中）· 引擎 vitest 全绿（含 board colocated pins + plan-graph pins 重锚）
- `pnpm run validate` ALL PASS · 不发布

## Constraints
- **文件系统唯一真源**：节点集合、artifact 存在性全来自扫描，绝不合成盘上不存在的节点，绝不解析 overall 的 Phase inventory / File paths 声明表
- **一概念一名**：`plan-graph` 作为词整体消失（显示路由 + preflight 门名）；board 是新词
- **skill ⇄ engine 黑盒边界（D29）**：board 的 next 渲染 skill ref 经 `REFS[ref][host]`，不硬编码插件拼写
- **判定面单源（D26 家族）**：board 的进度读是 `progress.json` 单源投影，波链与 preflight gate 同 `closedWaves()` 读；next 消费 `NextStepRouter` 不修改它
- **零声明再抄**：slug→路径从 slug 推导 · 线序从 `targetFaces` 派生 · skill ref 从 `REFS` 取
- **纯读无副作用**：board 不写树 / 不写 ledger / 不派发 child
- **不发布**：变更集归并落 pending
- **触碰历史 pin「cdd CLI 零新子命令」**：board 为新增第七命令，连带修订（文档先行——本 spec 即该修订落点）

## Change history
| Version | date | summary | author |
|---|---|---|---|
| v0.1 | 2026-10-14 | P8 设计实写——`cdd board <slug>` 一等公民：plan-graph 提级（显示路由 + 门名退役 §2/§3）· slug → 节点树文件系统唯一真源（§4）· 全节点 verb×round 细粒度板（§5）· next 全 line×全 verb 严格线序 + skill ref 交叉点（§6）· 六前提重构整合（§7）· 消费面同步（§8）· grilling Q1–Q11 全按用户裁定 | Oscar M. · Claude Opus 5 |
