# P14 · brainstorming 流程调优（彻底重构版）— Phase Spec

- **Version**: v1.0 · 2026-08-29
- **Status**: Approved
- **Author**: Oscaner Miao · Claude Opus 4.8 (osuperpowers:brainstorming dogfood session)
- **Parent program**: [skill-digraph-refactor-overall](./2026-08-24-skill-digraph-refactor-overall.md) v1.22
- **Depends on**: P11（`osuperpowers:brainstorming` 的 `explore-context` 已改为 CLI 路径，SKILL.md 已稳定）

---

## Section 0: Incremental warning

本 phase 仅改动 `osuperpowers:brainstorming` 一个技能（SKILL.md + 新增 `packages/osuperpowers/skills/brainstorming/docs/add-phase-protocol.md`，含对应 `.zh-CN.md` 镜像：SKILL.zh-CN.md + add-phase-protocol.zh-CN.md），属 overall 的 phase 级增量。整体程序的 Charter / 语言政策 / block 政策 见 [overall](./2026-08-24-skill-digraph-refactor-overall.md) v1.22，冲突时 overall 优先。

---

## Section 1: Constraints pointer

- 节点锚定式格式（[skill-authoring.md](../../../docs/maintainers/skill-authoring.md)）：digraph 为唯一控制流真相源，节点=正文小节，每节点固定 Do/Read/Exit/Fail 四要素。
- block 政策：Read Upstream / Read Sub-Skills 缺失一律显式 BLOCKED 终态，不降级。
- 路径解析 harness-agnostic：不写 `$CLAUDE_PLUGIN_ROOT` 等 harness 专属变量。
- 文档 commit 纪律：brainstorm 收口点（spec 获批）按程序纪律应 commit（Status: Draft→Approved 同一 commit）；**但本仓库 CLAUDE.md 禁止自动 commit，故实际 commit 仍须用户显式确认**（CLAUDE.md 优先于「获批即 commit」简写）。
- 允许破坏性更新（用户指令）：本 phase 可调整 brainstorming 整体流程拓扑，确保最佳实践、不留技术债务。

---

## Section 2: Design body

### 2.0 问题定义

v1.19c 实时反例：P10 仅完成 design spec（未走完 plan→dev→merge），本 session 即并行展开 P14 design spec + 3-pass review——同时违反两条纪律：① 串行纪律（P10 未完成即并行 P14）；② 先 grilling 后落 overall（P14 design 在 P14 phase 行稳定前展开）。

根因：当前 `osuperpowers:brainstorming` 的流是 `explore-context → grilling → … → commit-spec → overall-spec?`，**`grilling` 对任何请求都直接展开，没有「该 phase 是否已登记进 overall Phase inventory」的拓扑闸门**。v1.19b/v1.19c 把约束写成 Boundary rules 散文，但散文可绕过。

### 2.1 目标（彻底重构版）

让「先登记 overall 再 grilling」成为 **digraph 的结构性约束**：grilling 在拓扑上只能从 `claim-phase` 到达，而 `claim-phase` 对未登记的新 phase 强制先走 `sync-overall`。同时把串行纪律固化为 Invariant。

### 2.2 重构后 digraph

```mermaid
flowchart TD
  A[read-upstream] -->|loaded| B[read-sub-skills]
  A -->|missing| Z1((BLOCKED: install superpowers))
  B -->|loaded| C{read-program}
  B -->|missing| Z2((BLOCKED: install mattpocock-skills))
  C -->|mode resolved| D[explore-context]
  C -->|unparseable| Z4((BLOCKED: overall-parse-failed))
  D --> E{claim-phase}
  E -->|phase in overall Phase inventory| F[grilling]
  E -->|phase NOT in inventory (phase-within-program)| S[sync-overall]
  E -->|new-program mode| F
  S -->|four tables consistent| D
  S -->|inconsistent| Z3((BLOCKED: overall-sync-failed))
  E -->|inventory unparseable| Z3
  F -->|mid-grill split / new scope| E
  F --> G[propose-approaches]
  G --> H[present-design]
  H -->|revise section| H
  H --> I{user-approves?}
  I -->|revise| H
  I -->|yes| J[write-spec]
  J --> K[spec-review 3-pass D1/D2/D3]
  K -->|blocker found| K
  K -->|blocker=0| L{user-ok?}
  K -->|pass1 clean (D1 zero findings, skip D2/D3)| L
  L -->|fix selected (after blocker=0, no re-review per Review Stopping)| Q{user-confirm-commit?}
  L -->|approved| Q{user-confirm-commit?}
  Q -->|confirmed| M[commit-spec]
  M --> N{overall-spec?}
  N -->|yes: next phase| O((HANDOFF: brainstorming))
  N -->|no: single spec| P((HANDOFF: writing-plans))
```

### 2.3 新增节点定义

#### `read-program`（决策节点，新增为 `explore-context` 前置入口）

- **Do**：检测是否存在父 overall spec（约定路径 `docs/superpowers/specs/*-overall.md`；**用户可在本节点显式提供父 overall 路径**——输入通道：用户对话中给出绝对/相对路径，须为 `docs/superpowers/specs/*-overall.md` 格式；先于 explore-context 解析模式）。注：`osuperpowers:brainstorming` 由 harness 经 SKILL.md 调用，无独立 CLI 入口，故父 overall 路径**仅经对话通道**获取（不引入 `--parent-overall` CLI 参数，避免与 brainstorming 调用模型冲突）。多个匹配 overall 文件（glob 命中 >1）时 → 终端 `BLOCKED: overall-parse-failed`（提示用户显式指定唯一父路径）。解析结果为模式：`new-program`（无父 overall）或 `phase-within-program`（有父 overall，本次是某 phase 的 brainstorm）。
- **Read**：`docs/superpowers/specs/*-overall.md`（若存在）+ 用户显式父 overall 路径（可选，须符合上述格式）。
- **Exit**：模式已解析 → `explore-context`（携带模式标记）。
- **Fail**：父 overall 文件存在但无法解析 / 多个匹配无法消歧 → 终端 `BLOCKED: overall-parse-failed`（block with explicit prompt to specify the unique parent; **never** silently downgrade to new-program）。

#### `explore-context`（修订节点，承接 read-program 模式标记）

- **Do**：承接 `read-program` 解析出的模式标记（`new-program` / `phase-within-program`）。在此模式下探索项目上下文（文件 / docs / git log / 已有 research findings）；据此判断「本次请求是否需要新增 phase 或拆分已有 phase」。**可选** research 仍按 Confirm Gate（I2）触发。
- **Read**：项目文件、docs、git log、research findings；父 overall（phase-within-program 模式）。
- **Exit**：探索完成 → `claim-phase`（携带模式标记）。注：`explore-context` 的「是否需新增 phase」仅为**建议性探测**；`claim-phase` 的 Phase inventory 查找是**唯一权威**判定（两者冲突时以 claim-phase 为准）。
- **Fail**：Research agent error/timeout → log stderr，fail-open（不阻流程）；CLI path 失败 → 回退 Agent tool path。

#### `claim-phase`（决策节点，pre-design 门）

- **Do**：根据 `read-program` 的模式标记 + 用户请求中的 phase 标识（如 `/brainstorming P14`），判断该 phase 是否已存在于父 overall 的 **Phase inventory**：
  - `new-program` 模式 → 直接 `grilling`（程序级设计最终走 `overall-spec?`）。
  - `phase-within-program` 模式 + phase **已在** Phase inventory → `grilling`（正常路径）。
  - `phase-within-program` 模式 + phase **不在** Phase inventory（新增 phase / 拆分）→ `sync-overall`。
- **Read**：父 overall 的 Phase inventory 表。
- **Exit**：已在 / new-program → `grilling`；不在 → `sync-overall`。
- **Fail**：Phase inventory 表缺失或无法解析 → 终端 `BLOCKED: overall-sync-failed`（与 sync-overall 同一终态，语义一致）。

#### `sync-overall`（节点）

- **Do**：读父 overall → 执行四表同步：
  ① **Issue inventory** 追加新 issue 行（`#NNN` + 归属 phase；若本次仅拆分已有 issue 则补 phase 归属列）；
  ② **Phase inventory** 追加新 phase 行（scope / design spec / plan / acceptance / dependency）；
  ③ **Dependency graph** 补硬/软边（新 phase 对前置 phase 的依赖 + 后续 phase 对新 phase 的依赖）；
  ④ **version bump + change-history** 条目（记录新增原因 + 用户决策 + 范围边界）。
  随后跑**四表一致性校验**：phase spec/plan 引用的 `#NNN` 必在 Issue inventory；Dependency graph 引用的 phase 必在 Phase inventory；新 phase 的硬依赖边对应 phase 在 overall Phase inventory 中 **Design spec 列 = `Done`**（与 §2.5 I7 同一权威列，不再以 plan 格 / git 状态作判据）。该 `Design spec` 列即 overall v1.22 Phase inventory 表头（见本程序 overall v1.22 P14 行：该 phase 的 Design spec 格为 `Done`、plan 格为 `Pending`，证明列真实存在且命名一致）。
- **Read**：父 overall spec 全文（Phase inventory 的 Design spec 列）。
- **Exit**：四表一致 → 回 `explore-context`（以已登记 phase 重新评估 scope）→ 经 `claim-phase`（此刻 phase 已存在）→ `grilling`。
- **Fail**：四表不一致（如依赖 phase 未 ship、引用悬空）→ 终端 `BLOCKED: overall-sync-failed`，**绝不**放行 grill 未登记 phase。

### 2.4 grilling 纪律（消灭反模式）

- **新 Invariant I6 `Register-before-grill`**（scope：`phase-within-program` 模式）：grilling 只对「已存在于 overall Phase inventory 的 phase」展开。`new-program` 模式因无父 overall，经 `claim-phase` 节点但**跳过 inventory 检查**直接到达 grilling（digraph `E →|new-program mode| F`）。`phase-within-program` 模式下，grilling 中途若发现 phase 需拆分 / 新 issue 涌现 → 路由回 `claim-phase` → `sync-overall`，**绝不** grill 未登记 scope。
- `grilling` 节点 **Fail 字段**补：mid-grill 检测到 phase 拆分 / 新 scope → 回 `claim-phase`（与 I6 对应）。
- `grilling` 节点 **Do 字段**补：开 grill 前确认 `claim-phase` 已放行（结构性保证，Do 字段显式声明）。

### 2.5 串行纪律（P10→P11→P12→P14→P13）

- **新 Invariant I7 `Serial-phase`**：`sync-overall` 登记新 phase 时，校验其硬依赖边对应 phase 在 overall Phase inventory 中 Design spec 列标记为 **`Done`**（见 overall v1.22 Phase inventory：已 ship 的 phase 该行 Design spec 格为 `Done`、plan/acceptance 为 `Pending`/具体值）。**未 ship（Design spec 列 ≠ `Done`）→ 硬 BLOCKED：overall-sync-failed**（与 §2.3 同终态，绝不放行未达标 phase 的 grill——这正是 v1.19c 反模式要阻断的核心：P10 未 ship 即并行 P14）。此硬阻与 §2.3 四表一致性校验终态统一。
- 单次会议无法跨 session 强制「同时仅一个 phase 活跃」，故串行纪律以 **Invariant I7 硬 BLOCKED + 四表一致性校验** 形式固化；元纪律仍由 orchestrator 遵守（overall Boundary rules v1.19c 已写）。

### 2.6 参考文档 `add-phase-protocol.md`

- 新增 `packages/osuperpowers/skills/brainstorming/docs/add-phase-protocol.md`（EN）+ `.zh-CN.md`。
- 内容：① 四表同步清单（Issue / Phase / Dependency / Change-history 各自更新触发条件与格式）；② 反例（v1.19c 实时案例：P10 未 ship 即并行 P14 → 串行纪律 + 先落 overall 双违规）；③ 流程（detect → claim-phase → sync-overall → re-explore → grilling）。

### 2.7 zh-CN 同步

- `SKILL.zh-CN.md` 节点新增 `read-program` / `claim-phase` / `sync-overall` + Invariant I6/I7 同步。
- `add-phase-protocol.zh-CN.md` 同步产出。

### 2.8 验收（对应 overall line 94 ①-⑦）

1. digraph 含 `sync-overall` + `explore-context` pre-design 门（`claim-phase`，即「detect 新 phase」节点）+ `sync-overall` 回边（claim-phase→sync-overall→re-explore）。
2. grilling 纪律在 Invariant I6 + Fail 字段（禁止 overall 未同步前 grill 新 phase）。
3. 串行纪律 Invariant I7 + sync-overall 硬 BLOCKED（硬依赖 phase Design spec 列 ≠ `Done` 不放行）。
4. `add-phase-protocol.md` 产出（含四表清单 + 反例 + v1.19c）。
5. zh-CN 同步。
6. `pnpm run emit && pnpm run validate` 绿。
7. CDD execution（本 phase 为 brainstorm-only，按精神执行，不实际跑 CDD dev）：须产出本 phase 的 workspace（` .superpowers/cdd/<slug>/`）+ 本 phase handoff（status: APPROVED）+ ledger 含 `Task 1: complete` 行 + Final Review 产物（branch-review 或等价门），证明 `osuperpowers:brainstorming` 自身经 claim-phase 闸门跑通了一次完整 brainstorm→spec。

### 2.9 commit 收口确认门（对应 §1 CLAUDE.md 禁止自动 commit）

digraph 在 `L{user-ok?}` 之后、进入 `M[commit-spec]` 之前插入 `Q{user-confirm-commit?}` 门：spec 收口点（无论 D1 跳过 D2/D3 还是全 3-pass 通过）**都必须经用户显式确认才 commit**（CLAUDE.md 禁止自动 commit 优先于「spec 获批即 commit」简写）。`pass1 clean` 边现指向 `L{user-ok?}`（再经 `Q` → `M`），故 D1 零发现**不**豁免用户确认（仍过 user-ok? + user-confirm-commit? 双门）。

---

## Section 3: Deviations from overall

| Overall assumption | Phase decision | Overall updated? |
|---|---|---|
| 原 P14 row（overall v1.21 line 94）描述「explore-context pre-design 决策门 + sync-overall + add-phase 子图 + grilling 纪律强化 + add-phase-protocol.md」 | 升级为彻底重构：新增 `read-program` + `claim-phase` 两节点，使 grilling 在拓扑上仅能从 claim-phase 到达（结构性闸门，非散文约束）；`sync-overall` 扩展为四表一致性校验 + 终态 BLOCKED；新增 Invariant I6/I7 | Yes — v1.22 · 2026-08-29（P14 row 重写 scope/acceptance） |

---

## Section 4: Notes for downstream

- P13 终扫须确认：本 phase 新增的 `read-program` / `claim-phase` / `sync-overall` 节点不残留旧格式（`HARD-GATE` / `## Rules` / `## Red Flags`）；`add-phase-protocol.md` 无旧格式关键词。
- 本 phase 改 `brainstorming/SKILL.md` 后，后续任何 phase 的 brainstorm 都强制走 claim-phase 闸门，v1.19c 反模式在工具层面被阻断。

---

## Section 5: Review

Rule: Fresh-Subagent Review Passes（spec-review 3-pass，D1/D2/D3）。**D1 零发现时按 [docs-review.md](../../../docs/maintainers/skill-authoring.md) D1 规则跳过 D2/D3**（digraph 中 `pass1 clean → L` 边即此语义——D1 clean 跳过 D2/D3 但仍经 `user-ok?` + `user-confirm-commit?` 双门，是对 overall「3-pass 必须全过」规则的显式覆盖，已在 §2.2/§2.9 注明）。Review Stopping：重跑仅由 blocker 驱动；blocker=0 后 `user-ok?` 不允许任何重跑。无论 D1 跳过与否，commit 前必过 `user-confirm-commit?` 门（§2.9，CLAUDE.md 禁止自动 commit）。
