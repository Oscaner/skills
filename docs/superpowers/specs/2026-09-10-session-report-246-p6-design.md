# P6 — report-issue 四案：Session context 模型 + evidence 双向契约 + subject 标题 + master 只建不更

- **Version**: v1.0 · 2026-09-10
- **Status**: Draft
- **Author**: [human] · Claude Opus 5 (1M context) (osuperpowers:brainstorming)
- **Parent program**: [2026-09-10-session-report-246-overall.md](./2026-09-10-session-report-246-overall.md) · v1.1
- **Depends on**: 无（七 phase 独立；本 phase 依赖 report-templates.mjs / finding-meta.json 当前状态，均为 develop 已 shipped）

---

## Section 0: Incremental warning

> P6 increment only。跨 phase 约定见 [overall](./2026-09-10-session-report-246-overall.md)；冲突以 overall 为准。

---

## Section 1: Constraints pointer

不重复 overall 约定。约束继承：仓库语言政策（SKILL.md / 代码英文主源，本 spec 中文 Strategy B）；vendored 子模块不可改；所有改动过 `pnpm run validate`；改动 SKILL.md / finding-meta.json 后必须 `pnpm run emit` 再生 `.agents/`；消费方视角核对 README。

---

## Section 2: Design body

### 2.1 根因与统一抽象

report-issue 无一级 Session 身份模型：channel / attach（workspace）/ display identity 三轴被揉进「实时 cwd 下存在 `.superpowers/cdd/*/report-target.json`」这一个环境副产物；标题占位 `<slug|standalone>` 把 attach 轴与 kind 词混在展示位。F2（推导来源：扫 cwd 发现而非按身份定位）与 F4（无 subject 概念退化到 kind 词当展示）同根；F3 为并列的 finding 内容契约（非 session 状态层）。

家族既有先例：cdd-engine `resolveWorkspace(doc)` 已确立「path-anchored、非 cwd-anchored」根解析（`handoff-naming.mjs`）—— P6 使 report-issue 继承同一原则，并统一为下述 Session context 模型。

### 2.2 Session context 模型

报告起点捕获一次快照，下游全部纯函数（SKILL.md 新增权威定义节）：

```
root       = harness 启动 cwd 所在 git 仓库 git top-level
             （`git rev-parse --show-toplevel`，仅在 report 起点捕获一次，之后永不从实时 cwd 重推导）
workspace  = CDD run 的 `.superpowers/cdd/<run-slug>/`，当且仅当本会话为 CDD run
             （run slug = 本次 CDD 运行的 workspace slug；跨仓库复用禁止；
               standalone 无 run slug → 无 workspace）
channel    = program  ⟸ workspace 存在 ∧ report-target.json 命中 program；
              否则 → session
subject    = workspace.slug（program / consumer-cdd）| topic（standalone，模型派生）
             （subject 取值钉死：workspace.slug = run slug 去掉 `<YYYY-MM-DD>-` 日期前缀后的
               phase slug，如 `cdd-engine-overhaul-p4`——磁盘目录与 report-target.json#slug 均为
               `<YYYY-MM-DD>-<phase-slug>` 全称，取其右侧去日期部分，须去除后才作 subject；
               日期由 title 的 `<YYYY-MM-DD>` 占位单独渲染，subject 与 date 两者不重复，
               否则全 slug 直渲染将出现 `[Session report] 2026-09-09-cdd-engine-overhaul-p5 2026-09-09` 式日期重复）
kind(meta) = f(channel, workspace)：program | consumer-cdd | standalone（三值不变，不再叙述化）
```

派生关系（纯函数）：
- title = `renderTitle(masterDef, { subject, date })` → `[Session report] <subject> <YYYY-MM-DD>`
- cache（`report-target.json`）读写准入 = 本会话为 CDD run ∧ 该 run workspace ⊆ root
- kind 仅由 channel × workspace 推出，不是供作者选择的输入

**核心转变**：workspace 从「扫实时 cwd 发现」→「按 run-slug + 启动 root 定位」；standalone 结构性无 workspace → **读不到 cache / 走不了 program chain**，误接分支从机制上根除。

### 2.3 SKILL.md 节点重写

**新增定义节**：`## Session context（报告起点捕获，一次性推导）`，落 2.2 模型全文，所有下游节点引用之。

**`resolve-destination`**：
- Session context 在报告起点（analyze 之前）已捕获一次（§2.2），此处仅引用该快照（root 已定格），不再于入口捕获；confirm 等 resolve-destination 之前即使用快照的节点依赖同一捕获锚点。
- 通道判定：本会话为 CDD run → workspace = root/.superpowers/cdd/<run-slug>，cache-first 读 report-target.json（命中 program → program 通道复用 issue；命中 session → session 通道复用 master）；cache miss → program chain（progress.json#plan → plan-header `Spec:` → overall → phase-owning issue）。
- standalone（无 run slug）→ **不读 cache、不经 chain**，直接 session 通道（fail-open 语义保持）。
- 回写 cache 仅限 CDD run。

**`ensure-session`（只建不更，F12）**：
- 查找：cached session target 或「上次创建的 master」按 title（含 subject）。
- 创建：`gh issue create`，labels `session`/`osuperpowers`，title = `renderTitle(masterDef, { subject, date })`，subject = ws.slug | confirm 门已确认的 topic；body = `renderMasterBody({ kind, meta })` 一次性渲染。
- **master 创建后永不 `gh issue edit`/body PATCH**。

**`append-comment`**：
- session 分支删除「PATCH master body」整个子步骤——评论 append-only，不再重渲染 body（消灭 read-modify-write race 与表镜像漂移）。

**`classify`（F3，evidence 双向契约）**：
- evidence 必须同时满足两向：
  - **不写**（排除侧，强化 I6）：消费者环境可识别数据——分支名 / 绝对路径 / 文件名（既有），并新增机器实测类：进程数、RSS、启动目录、会话习惯等（对维护者不可操作、不可定位）。
  - **写**（包含侧，新增）：面向维护者可复现可定位的机制——触发条件、机制描述、期望行为、复现步骤（describe mechanism, not measurement）。
- 双向准则作为定案条文写入 classify Do；省略则 findings 不得过 confirm。

**`confirm`（F3+F4）**：
- I6 由单边排除升级为两条约束（Invariants 表更新）。
- kind=standalone 时，confirm 展示「推荐 subject topic」——AI 由首条 finding 标题派生一句短主题（去 type/component 标签前缀、截断 ≤60 字符）；用户可改可收；确认后 topic 即定（不存在空态：模型必生成）。

**Invariants**：
- I6 改写为两向 Evidence Contract（不写消费者可识别数据 + 写可复现机制）。
- I7（kind 三值枚举）语义不变：kind 为派生值，非输入。

### 2.4 renderer / canonical（破坏性且瘦身）

**`finding-meta.json`**：
- `masterDef.title`: `"[Session report] <slug|standalone> <YYYY-MM-DD>"` → `"[Session report] <subject> <YYYY-MM-DD>"`
- **删除** `masterDef.summaryTable`（cols + placeholder）——不再产生表镜像。

**`report-templates.mjs`**：
- `renderTitle(masterDef, { subject, date })`：删 `slugOrStandalone` 形参，替换 `<subject>`（破坏面：调用方仅为 ensure-session 与 tests）。
- **删除** `renderSummaryTable`（无调用方）。
- `renderMasterBody({ kind, meta })`：删 `findings` 参数与 `## Findings Summary` 段，输出收敛为：
  ```
  ## Session
  - Session: <meta.session | standalone>
  - Kind: <kind>
  - Date: <meta.date>

  _Findings are appended as comments below — this body is created once and not maintained._

  ## Report meta (auto)
  <renderMeta(meta)>
  ```
  （缺失 `meta.session` 时仍回退 standalone；meta 六字段渲染不变。）

### 2.5 tests（`scripts/emit/issue-templates.test.mjs`）

- `renderTitle`：改为 `<subject>` 契约——slug 路径与 topic 路径各一条断言。slug 路径具体期望串：`renderTitle(masterDef, { subject: "cdd-engine-overhaul-p4", date: "2026-09-10" })` → `[Session report] cdd-engine-overhaul-p4 2026-09-10`（subject 为去日期前缀 phase slug，与 `date` 不重复）；topic 路径：`renderTitle(masterDef, { subject: <topic>, date })` → `[Session report] <topic> <YYYY-MM-DD>`。
- `renderMasterBody`：结构断言重写（Session 块 + 静态注释行 + Report meta，无 Findings Summary）；保留 `meta.session` 缺省回退测试。
- **删除** `renderSummaryTable` 测试与 `masterDef.summaryTable.cols` 断言。
- canonical 断言新增：`masterDef.title` 不含 `<slug|standalone>`、`masterDef` 无 `summaryTable` 键。

### 2.6 消费方视角核对

`packages/osuperpowers/README.md` report-issue 段：若描述 master body 结构 / Findings Summary / title 模板，须同步为「comments 即 findings 聚合、body 只建不更、title 含 subject」；若无相关描述则不改（仅核对）。SKILL.md 为英文主源（禁止中文内容）。

### 2.7 Acceptance criteria

- report-issue 不再把 standalone 会话路由到无关程序 issue：standalone 会话（无 run slug）执行 report-issue 全流程，`resolve-destination` 直接 session 通道，不读取任何 `report-target.json`、不解析 program chain。
- issue 携带可复现机制且无消费者环境数据：classify/confirm 两向契约落文案，生成 finding 通过阅读理解校验（机制可复现、无机器实测数据）。
- standalone 标题含内容线索可辨识：`renderTitle` 对 standalone subject 输出含 topic 的 `[Session report] <topic> <YYYY-MM-DD>`；`<subject>` 契约测试绿；kind 词 `standalone` 不传入 renderTitle（master 标题不渲染 kind 词；`renderMasterBody` 的 `- Kind: <kind>` 行仍恒渲染，不受此 acceptance 约束）。
- master body 只建不更：`renderMasterBody({ kind, meta })` 无 `findings` 参数、无 Findings Summary 段；SKILL.md `append-comment` 无 body PATCH；`pnpm run validate` 全绿。

---

## Section 3: Deviations from overall

| Overall assumption | Phase decision | Overall updated? |
|---|---|---|
| P6 = report-issue 三案（F2/F3/F4） | P6 = report-issue 四案：新增 F12（master body 只建不更、废除 Findings Summary 表格镜像） | Yes — v1.1 · 2026-09-10 |

v1.1 已同步 Issue inventory（F12 行）+ Phase inventory（P6 scope/acceptance）+ Change history；Dependency graph 无边变更。

---

## Section 4: Notes for downstream

- #246 现存 master body 的 Findings Summary 表（F1–F9，漏 F10/F11）为历史漂移样本：本 phase 不回溯重写历史 issue（re-reporting 通道另立），仅从语义上杜绝未来漂移。
- F5（cdd review 内容演进）与 P6 有 soft 关联：spec/plan 演进重审通道（P2）落地后，P6 的后续迭代可开新 review cycle。
- 后续 phase（若有）如需 master 结构，以其为「创建即定、comments 聚合」为准。

---

## Section 5: Review

Rule per [Review Stopping](../_docs/review.md#rule-review-stopping)：单次 `cdd review --type spec --spec <path>`；blocker=0 → `cdd fix --type spec --findings <handoff>` 修全部 findings → user-confirm-commit；不 re-review。