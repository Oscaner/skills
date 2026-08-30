# P14 · brainstorming 流程调优（彻底重构版）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use osuperpowers:cli-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将「先登记 overall 再 grilling」从散文约束升级为 `osuperpowers:brainstorming` digraph 的拓扑级结构闸门（read-program / claim-phase / sync-overall 三节点）+ Invariant I6/I7 固化串行纪律，并配套 add-phase-protocol 参考文档。

**Architecture:** 纯技能文档重构（节点锚定式 SKILL.md + 一份参考文档 + zh-CN 镜像），无引擎代码改动。grilling 在拓扑上仅能经 claim-phase 到达；claim-phase 对新 phase 强制先走 sync-overall（四表同步 + 一致性校验 + 硬 BLOCKED）。

**Tech Stack:** Node-anchored SKILL.md 格式（digraph = 控制流真相源；节点 = 正文小节；Do/Read/Exit/Fail 四要素）；`pnpm run emit`（再生 `.agents/` 镜像）；`pnpm run validate`（governance 校验）。

## Global Constraints

- 节点锚定式格式：digraph 为唯一控制流真相源，节点=正文小节，每节点固定 Do/Read/Exit/Fail 四要素（skill-authoring.md）。
- block 政策：Read Upstream / Read Sub-Skills 缺失一律显式 BLOCKED 终态，不降级。
- 路径解析 harness-agnostic：不写 `$CLAUDE_PLUGIN_ROOT` 等 harness 专属变量。
- 语言政策：SKILL.md / 参考文档 EN-primary；`*.zh-CN.md` 为镜像，改动 EN 源须同步 zh-CN（Strategy A）。
- 允许破坏性更新（用户指令）：可调整 brainstorming 整体流程拓扑，不留技术债务。
- CLI background execution：所有 CLI 调用（cdd-task.mjs / cdd-review.mjs / emit / validate）以 background 方式运行。
- 不 commit 除非用户显式确认（CLAUDE.md）。

---

### Task 1: 重写 brainstorming SKILL.md（digraph + 三节点 + Invariant I6/I7）

**Files:**
- Modify: `packages/osuperpowers/skills/brainstorming/SKILL.md`（digraph 段 + 节点定义段 + Invariants 段 + Failure Modes 段）

**Interfaces:**
- Consumes: 当前 SKILL.md 的 read-upstream / read-sub-skills / explore-context / grilling 节点（保留为修订节点）
- Produces: 含 read-program / claim-phase / sync-overall / user-confirm-commit? 四节点 + Invariant I6/I7 的新 SKILL.md（Task 3 的 zh-CN 镜像与 Task 2 的协议文档引用此结构）

- [ ] **Step 1: 替换 Flow Digraph 段**

  打开 `packages/osuperpowers/skills/brainstorming/SKILL.md`，将 `## Flow Digraph` 段内的 mermaid `flowchart TD` 整体替换为以下 3 节点 + 双确认门拓扑（注意 `read-program` / `claim-phase` 为 decision rhombus `{}`，`user-confirm-commit?` 为 `{}`）：

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

- [ ] **Step 2: 在 `read-sub-skills` 节点定义后插入 `read-program` 决策节点**

  在 `### read-sub-skills` 小节之后、`### explore-context` 小节之前插入：

  ```markdown
  ### read-program

  - **Do**: Detect whether a parent overall spec exists (convention path `docs/superpowers/specs/*-overall.md`; the user may supply the parent overall path explicitly in this node — input channel: a conversation message giving an absolute/relative path, which must match `docs/superpowers/specs/*-overall.md`). Note: `osuperpowers:brainstorming` is invoked by the harness via SKILL.md, not a CLI entry, so the parent overall path is obtained only via the conversation channel (no `--parent-overall` CLI param, to avoid conflicting with the brainstorming invocation model). If multiple matching overall files exist (glob hit >1) → terminal `BLOCKED: overall-parse-failed` (prompt the user to specify the unique parent path). Resolve to a mode: `new-program` (no parent overall) or `phase-within-program` (has a parent overall; this is a per-phase brainstorm).
  - **Read**: `docs/superpowers/specs/*-overall.md` (if present) + optional user-supplied parent overall path (must match the format above).
  - **Exit**: mode resolved → `explore-context` (carrying the mode marker).
  - **Fail**: parent overall file exists but is unparseable / multiple matches cannot be disambiguated → terminal `BLOCKED: overall-parse-failed` (block with explicit prompt to specify the unique parent; never silently downgrade to new-program).
  ```

- [ ] **Step 3: 修订 `explore-context` 节点定义**

  将现有 `### explore-context` 小节的 Do/Exit 改为承接 read-program 模式标记 + 建议性探测（claim-phase 为权威）：

  ```markdown
  ### explore-context

  - **Do**: Carry the mode marker resolved by `read-program` (`new-program` / `phase-within-program`). Explore project context in that mode (files / docs / git log / existing research findings); from this, judge whether the current request needs a new phase or a phase split. Optional research still triggers only via the Confirm Gate (I2).
  - **Read**: project files, docs, git log, research findings; parent overall (phase-within-program mode).
  - **Exit**: exploration complete → `claim-phase` (carrying the mode marker). Note: `explore-context`'s "needs new phase?" judgment is only a suggestive probe; `claim-phase`'s Phase inventory lookup is the sole authoritative decision (on conflict, claim-phase wins).
  - **Fail**: Research agent error/timeout → log stderr, fail-open (do not block flow). CLI path failure → fall back to Agent tool path.
  ```

- [ ] **Step 4: 在 `explore-context` 后插入 `claim-phase` 决策节点**

  ```markdown
  ### claim-phase

  - **Do**: Based on `read-program`'s mode marker + the phase identifier in the user request (e.g. `/brainstorming P14`), judge whether that phase already exists in the parent overall's **Phase inventory** (the four-table sync procedure is in [add-phase-protocol.md](./docs/add-phase-protocol.md)):
    - `new-program` mode → straight to `grilling` (program-level design ultimately reaches `overall-spec?`).
    - `phase-within-program` mode + phase **already in** Phase inventory → `grilling` (normal path).
    - `phase-within-program` mode + phase **not in** Phase inventory (new phase / split) → `sync-overall`.
  - **Read**: parent overall's Phase inventory table.
  - **Exit**: in inventory / new-program → `grilling`; not in → `sync-overall`.
  - **Fail**: Phase inventory table missing or unparseable → terminal `BLOCKED: overall-sync-failed` (same terminal as sync-overall, consistent semantics).
  ```

- [ ] **Step 5: 在 `claim-phase` 后插入 `sync-overall` 节点**

  ```markdown
  ### sync-overall

  - **Do**: Read the parent overall → perform the four-table sync (procedure + checklist in [add-phase-protocol.md](./docs/add-phase-protocol.md)):
    ① **Issue inventory** — append a new issue row (`#NNN` + owning phase; if this only splits an existing issue, fill the phase-ownership column);
    ② **Phase inventory** — append a new phase row (scope / design spec / plan / acceptance / dependency);
    ③ **Dependency graph** — add hard/soft edges (the new phase's dependency on predecessors + successors' dependency on the new phase);
    ④ **version bump + change-history** entry (record the reason, user decision, scope boundary).
    Then run the **four-table consistency check**: any `#NNN` referenced by the phase spec/plan must be in Issue inventory; any phase referenced by the Dependency graph must be in Phase inventory; the hard-dependency predecessor of the new phase must have **Design spec column = `Done`** in the parent overall's Phase inventory (same authority column as I7 in §2.5; no longer judged by plan cell / git state).
  - **Read**: full parent overall spec (the Design spec column of Phase inventory).
  - **Exit**: four tables consistent → back to `explore-context` (re-evaluate scope with the now-registered phase) → through `claim-phase` (phase now exists) → `grilling`.
  - **Fail**: four tables inconsistent (e.g. dependency phase not shipped, dangling reference) → terminal `BLOCKED: overall-sync-failed`; never allow grilling an unregistered phase.
  ```

- [ ] **Step 6: 修订 `grilling` 节点（Do + Fail 补串行/登记纪律）**

  在现有 `### grilling` 小节：
  - Do 字段补：`Before grilling, confirm `claim-phase` has released this phase (structural guarantee — state explicitly in the Do field).`
  - Fail 字段补：`Mid-grill detects a phase split / new scope → route back to `claim-phase` (pairs with I6).`

- [ ] **Step 7: 在 `overall-spec?` 节点前插入 `user-confirm-commit?` 节点**

  ```markdown
  ### user-confirm-commit?

  - **Do**: At the spec closeout point, explicitly request commit confirmation from the user (CLAUDE.md forbids auto-commit, so a `user-confirm-commit?` gate is required before `commit-spec`).
  - **Read**: none (pure confirmation).
  - **Exit**: user confirms → `commit-spec`; user declines → hold (no commit; spec retained for later).
  - **Fail**: — (confirmation gate has no failure branch)
  ```

- [ ] **Step 8: 更新 Invariants 表（新增 I6 / I7，保留 I1–I5）**

  在 `## Invariants` 表末尾追加两行（I1–I5 不变）：

  ```markdown
  | I6 | **Register-before-grill** (scope: `phase-within-program` mode) — grilling runs only for phases already present in the overall Phase inventory. `new-program` mode passes through the `claim-phase` node but **skips the inventory check** to reach grilling directly (digraph `E -->|new-program mode| F`). In `phase-within-program` mode, if mid-grill a phase split / new issue emerges → route back to `claim-phase` → `sync-overall`; never grill unregistered scope. |
  | I7 | **Serial-phase** — when `sync-overall` registers a new phase, verify its hard-dependency predecessor has **Design spec column = `Done`** in the overall Phase inventory; if not shipped (Design spec ≠ `Done`) → hard `BLOCKED: overall-sync-failed` (same terminal as §2.3; never release grilling for an unmet phase — this is exactly the v1.19c anti-pattern to block). |
  ```

- [ ] **Step 9: 更新 Failure Modes 表（新增两终端 + 解析失败）**

  在 `## Failure Modes` 表追加三行（保留原有 5 行）：

  ```markdown
  | Parent overall spec unparseable / multiple matches | BLOCKED (overall-parse-failed) | mode resolution cannot proceed | prompt user to specify the unique parent overall path |
  | Phase inventory missing or unparseable | BLOCKED (overall-sync-failed) | claim-phase / sync-overall cannot gate | user supplies or fixes the overall Phase inventory |
  | Four-table sync inconsistent (dependency not shipped / dangling ref) | BLOCKED (overall-sync-failed) | refuse to grill an unregistered / unmet-dependency phase | fix the overall four tables, then re-run sync-overall |
  ```

- [ ] **Step 10: 运行 emit + validate 验证 SKILL.md 合规**

  Run: `pnpm run emit && pnpm run validate`
  Expected: emit fresh, validate green (rule-reference integrity + node-anchored format checks pass). Fix any drift.

- [ ] **Step 11: Commit**

  ```bash
  git add packages/osuperpowers/skills/brainstorming/SKILL.md
  git commit -m "refactor(brainstorming): add read-program/claim-phase/sync-overall gates + I6/I7 serial discipline"
  ```

---

### Task 2: 新增 add-phase-protocol.md 参考文档 + zh-CN 镜像

**Files:**
- Create: `packages/osuperpowers/skills/brainstorming/docs/add-phase-protocol.md`（EN）
- Create: `packages/osuperpowers/skills/brainstorming/docs/add-phase-protocol.zh-CN.md`（zh-CN 镜像）

**Interfaces:**
- Consumes: Task 1 的 SKILL.md 节点结构（read-program / claim-phase / sync-overall 命名）+ overall v1.22 四表 schema
- Produces: 消费者在 brainstorming 中补新 phase 时遵循的协议文档（被 SKILL.md explore-context / claim-phase 节点引用）

- [ ] **Step 1: 写 `add-phase-protocol.md`（EN）**

  创建 `packages/osuperpowers/skills/brainstorming/docs/add-phase-protocol.md`，含三节：

  ```markdown
  # Add-Phase Protocol

  Reference for adding a new phase to a multi-phase program inside `osuperpowers:brainstorming`. The overall spec is the single source of truth (SOT); a phase must be registered in the overall before its design is grilled.

  ## 1. Four-table sync checklist

  When `sync-overall` runs, update all four tables in the parent overall spec and then verify consistency:

  - **Issue inventory** — append a row per new issue: `| P<new> | [#NNN](url) | one-line summary |`. If an existing issue is merely re-owned, update its Phase column instead of adding a row.
  - **Phase inventory** — append a row: `| P<new> | [scope] | [Pending]/link | [Pending]/link | [verifiable acceptance] | [hard block or soft, ref graph] |`. Fill Design spec / plan cells as the phase progresses.
  - **Dependency graph** — add the edge(s): `P<pred> -> P<new>` (hard block) and `P<new> -> P<succ>` if successors depend on it. Use `-> (soft)` only for non-blocking ordering convenience.
  - **Change history** — append one row: `- vX.Y · YYYY-MM-DD — <reason: user decision + scope boundary>`.

  Consistency check (must all hold before `sync-overall` exits):
  1. Every `#NNN` referenced by the new phase spec/plan exists in Issue inventory.
  2. Every phase referenced by the Dependency graph exists in Phase inventory.
  3. Every hard-dependency predecessor of the new phase has **Design spec column = `Done`** (not shipped → hard BLOCKED).

  ## 2. Anti-pattern (live example, v1.19c)

  While writing v1.19c, P10 had only completed its design spec (not yet plan→dev→merge), yet this session parallel-expanded P14's design spec + 3-pass review — violating two disciplines at once:
  - **Serial discipline**: started P14 before P10 shipped.
  - **Register-before-grill**: grilled P14's design before the P14 phase row was stable in the overall.

  Both are exactly the anti-patterns this protocol exists to block. The structural gates (claim-phase → sync-overall → re-explore → grilling) make the violation impossible at the tool level.

  ## 3. Flow

  detect (explore-context probe) → claim-phase (inventory lookup = authority) → [if not registered] sync-overall (four-table sync + consistency check, hard BLOCKED on failure) → re-explore (claim-phase, now registered) → grilling.
  ```

- [ ] **Step 2: 写 `add-phase-protocol.zh-CN.md`（zh-CN 镜像）**

  同上 EN 内容的中文镜像，文件名 `add-phase-protocol.zh-CN.md`。标题：`# 新增 Phase 协议`。三节标题：① 四表同步清单 ② 反模式（v1.19c 实时案例）③ 流程。内容须与 EN 一一对应（Strategy A 镜像，非独立源）。

- [ ] **Step 3: 运行 validate 验证文档链接**

  Run: `pnpm run validate`
  Expected: rule-reference integrity clean (the new docs/ link resolves).

- [ ] **Step 4: Commit**

  ```bash
  git add packages/osuperpowers/skills/brainstorming/docs/add-phase-protocol.md packages/osuperpowers/skills/brainstorming/docs/add-phase-protocol.zh-CN.md
  git commit -m "docs(brainstorming): add add-phase-protocol reference (EN + zh-CN)"
  ```

---

### Task 3: 同步 SKILL.zh-CN.md 镜像

**Files:**
- Modify: `packages/osuperpowers/skills/brainstorming/SKILL.zh-CN.md`（digraph 段 + 节点定义段 + Invariants 段 + Failure Modes 段）

**Interfaces:**
- Consumes: Task 1 的 EN SKILL.md 新结构（命名 / 节点 / Invariant I6/I7）
- Produces: 与 EN 一一对应的 zh-CN 镜像（emit 再生 `.agents/` 时以此源为准）

- [ ] **Step 1: 对照 EN SKILL.md 同步 zh-CN 的 digraph + 四节点**

  打开 `SKILL.zh-CN.md`，按 Task 1 Step 1–7 的 EN 内容做中文镜像：
  - digraph 拓扑与 EN 完全一致（节点名/边标签可中文，但 `read-program` / `claim-phase` / `sync-overall` / `user-confirm-commit?` 锚点名与 EN 相同，保证跨文件 anchor 一致）。
  - `read-program` / `claim-phase` / `sync-overall` / `user-confirm-commit?` 四节点 Do/Read/Exit/Fail 中文镜像。
  - `grilling` 节点 Do/Fail 补中文（登记/串行纪律）。

- [ ] **Step 2: 同步 Invariants 表（I6/I7）+ Failure Modes 三终端**

  按 Task 1 Step 8–9 的中文镜像追加 I6/I7 两行 + 三终端 Failure Modes 行。

- [ ] **Step 3: 运行 emit 再生 .agents/ 镜像**

  Run: `pnpm run emit`
  Expected: emit fresh（`.agents/skills/brainstorming/SKILL.md` + `SKILL.zh-CN.md` 由源再生，无 drift）。

- [ ] **Step 4: Commit**

  ```bash
  git add packages/osuperpowers/skills/brainstorming/SKILL.zh-CN.md
  git commit -m "docs(brainstorming): sync zh-CN mirror for P14 gates + I6/I7"
  ```

---

### Task 4: emit + validate 收口 + CDD 精神执行（workspace/handoff/ledger/Final Review）

**Files:**
- Modify: workspace artifacts under `.superpowers/cdd/2026-08-29-skill-digraph-refactor-p14/`（由 cli-driven-development 引擎在 dev 阶段生成）

**Interfaces:**
- Consumes: Task 1–3 产出的 SKILL.md（含 claim-phase 闸门）+ add-phase-protocol 文档
- Produces: 本 phase 的 CDD 执行产物（workspace + handoff status:APPROVED + ledger + Final Review），证明 `osuperpowers:brainstorming` 自身经 claim-phase 闸门跑通一次完整 brainstorm→spec（验收⑦）

- [ ] **Step 1: 运行 emit + validate 全套收口校验**

  Run: `pnpm run emit && pnpm run validate`
  Expected: emit fresh + validate green（governance：节点锚定格式、rule-reference integrity、engine tests 均过）。

- [ ] **Step 2: CDD 精神执行 — 手工创建 workspace + handoff（status: APPROVED，不调用引擎）**

  按 spec §2.8⑦「按精神执行，不实际跑 CDD dev」——**不调用** `osuperpowers:cli-driven-development` 引擎，仅手工创建等价的 CDD 产物，证明 claim-phase 闸门闭环：
  - workspace：`.superpowers/cdd/2026-08-29-skill-digraph-refactor-p14/`
  - 每 task handoff `task-N-handoff.json`：含 `{"status":"APPROVED", ...}`（4 个文件）
  - ledger（`progress.md`）：含 `Task 1: complete` … `Task 4: complete` 行
  - 证明 `osuperpowers:brainstorming` 自身经 claim-phase 闸门（read-program 解析 mode → claim-phase 识别 P14 已在 overall Phase inventory Design spec=`Done` → 直达 grilling）跑通了一次完整 brainstorm→spec 循环。

- [ ] **Step 3: Final Review（branch-review 或等价门）**

  Run: `node packages/osuperpowers/bin/engine/cdd-review.mjs --harness claude --template branch-review --param BASE=develop --param HEAD=<head> --param PLAN=docs/superpowers/plans/2026-08-29-skill-digraph-refactor-p14.md`
  Expected: 0 blocker（仅 warn/nit 可留用户决策）。持久化 branch-review.diff + report 到 workspace。

- [ ] **Step 4: 全 phase 收口 — 不编辑 overall（plan 格推进留待 ship）**

  本程序 changeset 策略为「仅 P10 统一建」（overall Cross-cutting constraints），故本 phase **不单独建 changeset**、**也不在此编辑 overall v1.22 P14 行**。overall P14 行的 Design spec 列已是 `Done`（spec 收口时写入）、plan 格为 `Pending`——plan 格推进到 Shipped 发生在本 phase 实际 merge 到 develop 之后，由后续收尾统一处理，不在本 plan 的执行步骤内。
