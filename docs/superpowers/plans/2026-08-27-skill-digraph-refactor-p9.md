# Skill Digraph Refactor P9 — init + report-issue 重构 + Cursor rule 清理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `osuperpowers:cli-driven-development` to implement this plan task-by-task via `cdd-task.mjs`. Steps use checkbox (`- [ ]`) syntax for tracking. This is a single-phase plan under the 10-phase skill-digraph refactor program.

**Goal:** Rewrite `init` + `report-issue` to node-anchored format, delete `init router`, fix #136 label classification, and remove the Cursor self-check `.mdc` rule (slash interception moves to `cursor-detect.mjs` hooks).

**Architecture:** Three independent skill/engine changes composed into 4 CDD tasks. `init` → 2-entry dispatcher digraph + node-anchored `harness.md`; `report-issue` → 6-step/7-node digraph with component-classified labels; Cursor `.mdc` generation chain deleted and `cursor-detect.mjs` extended to intercept bare slash. Each CDD task dispatches a nested `cdd-task.mjs` session (no in-session manual execution).

**Tech Stack:** Node.js (fnm v24), mermaid digraph in SKILL.md, `gh` CLI, `cdd-task.mjs` / `cdd-review.mjs` engine, `pnpm run emit` + `pnpm run validate`.

## Global Constraints

- 节点锚定式格式权威：`docs/maintainers/skill-authoring.md` v1.0（图节点↔小节一一对应；无独立 Rules 散文堆 / Red Flags 小节 / Checklist）。
- 语言政策：技能 SKILL.md 英文主源 + zh-CN 镜像（编辑英文源即同步 zh-CN，同一 task）；本 plan 中文 Strategy B，无 zh-CN 镜像。
- changeset 仅在 P10 统一建（程序级豁免，本 phase 不建）。
- 引擎改动仅限：#136 report-issue label 组件分类 + `cursor-detect.mjs` slash 拦截扩展（语义层，不改控制流大框架）；删 `cursorSelfCheckMdc` 生成链（纯删，无行为新增）。
- Conventional commits，无 attribution/co-author 行；不 commit 除非用户明确要求（CDD task 由嵌套 CLI 提交）。
- CLI mode 调用必须 background 执行（`run_in_background` 或超时+轮询）。
- Orchestrator handoff 检查义务：cdd-task.mjs 返回后必须读 handoff.json 判断状态，不可凭 stdout 为空判断。
- CDD 启动 determine-base 节点写入 `base-branch.json` artifact；branch-review BASE 从 artifact 读。

---

## File Structure

### §A — init 重构（Task 1）

- Modify: `packages/osuperpowers/skills/init/SKILL.md` — 重写为 2 入口 digraph（harness / no-param）+ BLOCKED（bad-param）
- Modify: `packages/osuperpowers/skills/init/harness.md` — 节点锚定式重写（删 `## Rules`/`## Red Flags`，拆 detect/guide/config/trust/summarize 节点 + Invariants）
- Delete: `packages/osuperpowers/skills/init/router.md` + `packages/osuperpowers/skills/init/router.zh-CN.md`
- Modify: `packages/osuperpowers/skills/init/SKILL.zh-CN.md` — 同步 2 入口（删 spor）
- Create: `packages/osuperpowers/skills/init/harness.zh-CN.md` — harness.md 节点锚定式镜像

### §B — report-issue 重构 + #136（Task 2）

- Modify: `packages/osuperpowers/skills/report-issue/SKILL.md` — 6 步 7 节点 digraph + Failure Modes + Invariants；#136 组件分类 label（classify 节点）；保留 `## Issue Body Templates` prose
- Modify: `packages/osuperpowers/skills/report-issue/SKILL.zh-CN.md` — 同步 7 节点 + 分类

### §C — Cursor self-check rule 清理 + slash 拦截（Task 3）

- Modify: `scripts/lib/emit/overrides.mjs` — 删除 `cursorSelfCheckMdc` 函数
- Modify: `scripts/emit.mjs` — 删除 `cursor-self-check.mdc` 产物 `writeText`（约 338-346 行）及 `readFileSync(self-check.mdc)` 引用
- Delete: `packages/osuperpowers-router/build/templates/self-check.mdc`
- Delete（emit 再生后）: `packages/osuperpowers-router/build/generated/cursor-self-check.mdc`
- Modify: `scripts/templates/cursor-detect.mjs` — 扩展 bare `/<upstream-slug>` slash 拦截（复用 TARGETS 的 `upstream_slug`）；`cursor-detect.test.mjs` 改写 slash 用例 + 新增覆盖
- Modify: `packages/osuperpowers-router/docs/cross-harness-overrides.md` — 删 `.mdc` rule 段落，记 slash 由 hooks 接管；修正 stale `/subagent-driven-development` 行
- Modify: `packages/osuperpowers-router/README.md` + `README.zh-CN.md` — 删 `init router` 指引
- Modify: `packages/osuperpowers/README.md` + `README.zh-CN.md` — `init` 条目改 `harness config`；删 `init router` 表述

### §D — emit + validate + close #136（Task 4）

- Run: `pnpm run emit` 再生 `.agents/`（含删 `.mdc` 产物）
- Run: `pnpm run validate` 绿
- Close: #136（评论附 P9 commit）

---

## §A — init 重构

### Task 1: init 2-entry dispatcher + node-anchored harness.md + delete init router

**Files:**
- Modify: `packages/osuperpowers/skills/init/SKILL.md`
- Modify: `packages/osuperpowers/skills/init/harness.md`
- Delete: `packages/osuperpowers/skills/init/router.md`, `packages/osuperpowers/skills/init/router.zh-CN.md`
- Modify: `packages/osuperpowers/skills/init/SKILL.zh-CN.md`
- Create: `packages/osuperpowers/skills/init/harness.zh-CN.md`

**Interfaces:**
- Consumes: 无（独立 task）
- Produces: `init/SKILL.md` 2 入口 digraph；`init/harness.md` 节点锚定式

- [ ] **Step 1: 重写 `init/SKILL.md` 为 2 入口 digraph（英文主源）**

  严格按 design spec §3.1 写。要点（完整内容以 spec §3.1 为权威源）：
  - frontmatter `name: init` + description 改为仅 harness/no-param（删 `init router` 措辞）。
  - Flow Digraph：`dispatch` → `param=harness`→`run-harness`；`no param`→`list-harness`；`unknown param`→`BLOCKED: bad-param`；`run-harness`→`APPROVED: harness-installed`；`list-harness`→`APPROVED: harness-installed`。
  - 3 节点 `dispatch` / `run-harness` / `list-harness` 各含 Do/Read/Exit/Fail 四要素（spec §3.1 给出逐字段文本）。
  - `dispatch` Do 明确：`--harness` 等 flag 必须跟在 `harness` 子命令后；`init --harness foo` 无子命令 → BLOCKED（bad-param）。

- [ ] **Step 2: 重写 `init/harness.md` 为节点锚定式（英文主源）**

  删 `## Rules`/`## Red Flags` 头；严格按 design spec §3.2 改为 Flow Digraph + Node Definitions（detect/guide/config/trust/summarize）+ Invariants（§3.3）+ Failure Modes（§3.4）。关键：install-and-use 通道 harness 在 `config` 节点为 no-op/skip、`trust` 节点跳过（spec §3.2 有明确表述）；终态统一 `APPROVED: harness-installed`（与外层 dispatcher 一致）。

- [ ] **Step 3: 删除 `init/router.md` + `init/router.zh-CN.md`**

  ```bash
  git rm packages/osuperpowers/skills/init/router.md packages/osuperpowers/skills/init/router.zh-CN.md
  ```

- [ ] **Step 4: 同步 `init/SKILL.zh-CN.md` + 创建 `init/harness.zh-CN.md`**

  `SKILL.zh-CN.md` 镜像 Step 1 的 2 入口 digraph（删 spor 入口）。`harness.zh-CN.md` 镜像 Step 2 的节点锚定式（中文）。

- [ ] **Step 5: 校验节点锚定式合规（skill-authoring §8 四清单）**

  确认：图中节点（dispatch/run-harness/list-harness + harness.md 的 detect/guide/config/trust/summarize）均有对应小节；无孤立小节；无 `## Rules`/`## Red Flags`/`## Checklist` 头；rules 归属节点或 Invariants。

- [ ] **Step 6: 提交（嵌套 CLI 自动提交；手写 brief 时本步为 task-review 前的 implement 产物）**

  由 `cdd-task.mjs --mode implement` 在返回时写 handoff；本 task 不手动 commit。

---

## §B — report-issue 重构 + #136

### Task 2: report-issue 6-step/7-node digraph + component-label classification

**Files:**
- Modify: `packages/osuperpowers/skills/report-issue/SKILL.md`
- Modify: `packages/osuperpowers/skills/report-issue/SKILL.zh-CN.md`

**Interfaces:**
- Consumes: 无（独立 task；#136 label 逻辑在 classify 节点内）
- Produces: report-issue 节点锚定式 SKILL.md

- [ ] **Step 1: 重写 `report-issue/SKILL.md` 为 6 步 7 节点 digraph（英文主源）**

  frontmatter `name: report-issue` + description 更新。结构：Flow Digraph（analyze→classify→confirm→dedup→{resolve-hit}→file→report）+ Node Definitions（7 节点，严格按 design spec §4.1）+ Failure Modes（§4.3）+ Invariants（§4.4）+ `## Issue Body Templates`（prose payload，原 4 段模板正文原样保留，不节点化）。

  `classify` 节点 Do 字段含 #136 组件分类（§4.2）：① 组件 ∈ `packages/osuperpowers/` → `osuperpowers`；② 组件 ∈ `packages/osuperpowers-router/` → `osuperpowers-router`；③ 跨插件/无法确定 → 默认 `osuperpowers`（不新增交互 prompt，用户可在 `confirm` 纠正）。`cdd` 维度：涉及 CDD/cdd-task.mjs/orchestrator/handoff 追加 `cdd`。

- [ ] **Step 2: 同步 `report-issue/SKILL.zh-CN.md`**

  镜像 7 节点 digraph + #136 分类（中文）。

- [ ] **Step 3: 校验节点锚定式合规 + #136 分类可读**

  确认图节点↔小节一一对应；`classify` 节点明确组件分类三规则；`gh issue create --label "<type>,dogfood,<component>[,cdd]"` 非硬编码 `osuperpowers-router`。

- [ ] **Step 4: 提交（嵌套 CLI 自动提交）**

---

## §C — Cursor self-check rule 清理 + slash 拦截

### Task 3: remove cursor .mdc generation + extend cursor-detect slash interception

**Files:**
- Modify: `scripts/lib/emit/overrides.mjs` — 删 `cursorSelfCheckMdc` 函数（约 264-273 行）
- Modify: `scripts/emit.mjs` — 删 `cursor-self-check.mdc` 的 `writeText` 块（约 338-346 行）及 `readFileSync(..., "self-check.mdc")` 引用
- Delete: `packages/osuperpowers-router/build/templates/self-check.mdc`
- Modify: `scripts/templates/cursor-detect.mjs` — 扩展 bare slash 拦截
- Modify: `packages/osuperpowers-router/tests/cursor-detect.test.mjs` — 改写 slash 用例 + 新增覆盖
- Modify: `packages/osuperpowers-router/docs/cross-harness-overrides.md` — 删 `.mdc` rule 段落，记 slash 由 hooks 接管；修正 stale `/subagent-driven-development`
- Modify: `packages/osuperpowers-router/README.md` + `README.zh-CN.md` — 删 `init router` 指引
- Modify: `packages/osuperpowers/README.md` + `README.zh-CN.md` — `init` 条目改 harness config

**Interfaces:**
- Consumes: `overrides.manifest.json` 的 targets（emit 渲染时注入 TARGETS，slash 扩展复用其 `upstream_slug`）
- Produces: `.mdc` 不再生成；`cursor-detect.mjs` 拦 slash（写 pending，`trigger: "slash"`）

- [ ] **Step 1: 删 `cursorSelfCheckMdc` 生成链**

  `scripts/lib/emit/overrides.mjs` 删除 `cursorSelfCheckMdc` 函数定义（约 264-273 行）。`scripts/emit.mjs` 删除 `writeText(outRoot, ..., cursorSelfCheckMdc(...))` 块（约 338-346 行）及对应的 `readFileSync(join(pluginDir, "build/templates/self-check.mdc"), "utf8")` 引用。

  ```bash
  git rm packages/osuperpowers-router/build/templates/self-check.mdc
  rm -f packages/osuperpowers-router/build/generated/cursor-self-check.mdc
  ```

- [ ] **Step 2: 扩展 `scripts/templates/cursor-detect.mjs` 拦 bare slash**

  在 `cursor-detect.mjs` 现有 attach 拦截之后、末尾 `process.stdout.write({continue:true})` 之前，新增 slash 检测：解析 `data.prompt`（UserPromptSubmit 的 prompt 文本），匹配 **两种形态**（对齐 spec §5.2）：① bare `^/<upstream_slug>$`；② 行内 ` /<upstream_slug>`（slug 取自已注入的 TARGETS 的 `upstream_slug` 集合；slug 列表同 Claude `hooks.json` 第二 matcher：brainstorming / writing-plans / subagent-driven-development / finishing-a-development-branch / test-driven-development / using-git-worktrees）。命中 → 写 pending（`override` = 对应 `osuperpowers:*` name，`trigger: "slash"`）。attach 拦截逻辑不变。

  注意：`scripts/templates/cursor-detect.mjs` 是 emit 渲染源；修改后需 `pnpm run emit` 再生 `packages/osuperpowers-router/bin/cursor-detect.mjs`。

- [ ] **Step 3: 改写 `cursor-detect.test.mjs` slash 用例**

  原 line 90 测试「bare `/brainstorming` with no attachments writes no pending」改为：bare `/brainstorming` → 写 pending（`trigger: "slash"`，`override: "osuperpowers:brainstorming"`）。新增 6 slug 覆盖测试（每个 upstream_slug 一次）。attach 用例保留。

- [ ] **Step 4: 更新文档**

  `cross-harness-overrides.md`：删「Self-check rules (both harnesses)」「Init does not install hooks — `init router` only refreshes …」「Project `CLAUDE.md` self-check (from `init router`) is fallback」等 `.mdc` rule 段落；改为「Cursor slash 由 `cursor-detect.mjs` 的 `beforeSubmitPrompt` hook 直接拦截（与 Claude `UserPromptExpansion` 同语义）」；修正 line 67 的 `/subagent-driven-development` → `/cli-driven-development`。`README.md` + `README.zh-CN.md`（router + osuperpowers）删 `init router` 指引，`init` 条目改为 `harness config`。

- [ ] **Step 5: 校验 emit 不再生成 `.mdc` + 测试通过**

  ```bash
  pnpm run emit
  node packages/osuperpowers-router/tests/cursor-detect.test.mjs
  test -f packages/osuperpowers-router/build/generated/cursor-self-check.mdc && echo "FAIL: still generated" || echo "OK: no .mdc"
  ```

- [ ] **Step 6: 提交（嵌套 CLI 自动提交）**

---

## §D — emit + validate + close #136

### Task 4: emit + validate + close #136

**Files:**
- Run: `pnpm run emit`, `pnpm run validate`
- Close: issue #136

**Interfaces:**
- Consumes: Task 1-3 的全部改动
- Produces: `.agents/` 再生；validate 绿；#136 closed

- [ ] **Step 1: `pnpm run emit` 再生 `.agents/`**

  确认 `init/router.md`/`.zh-CN` 从 `.agents/` 消失；`init/harness.md`/`.zh-CN` 出现；`report-issue` 节点锚定式同步；`.mdc` 不再生成。

- [ ] **Step 2: `pnpm run validate` 绿**

  全 12 block 通过（emit freshness / plugin resolve / skill dirs / overrides hooks + bin executable / overrides build / rule-reference / engine tests / version sync）。

- [ ] **Step 3: 关闭 #136**

  在 #136 评论附 P9 commit（`3e91eca` design spec + 本 plan commit + 4 个 dev commit），说明 #136 引擎层修复已在 P9 完成（report-issue label 组件分类 + cursor-detect slash 扩展）。

- [ ] **Step 4: 提交（嵌套 CLI 自动提交）**

---

## Execution Strategy

- **4 CDD tasks**：Task 1 (§A) / Task 2 (§B) / Task 3 (§C) / Task 4 (§D)，每个一原子 commit。
- **Brief 手工组合约定**：本 plan 不含 `### Task N:` heading（plan 工作块 §A-§D ≠ 4 CDD task，避免 brief.mjs 错误提取）。orchestrator 对每个 CDD task 手工写 brief 文件（`.superpowers/cdd/<slug>/task-N-brief.md`）：从 §A-§D 提取对应工作块内容 + 追加 `TASK_BASE: <sha>` 行（`git rev-parse HEAD`）。参考 P7/P8 session 的 `task-N-brief.md` 模式。
- **CLI background execution**：所有 `cdd-task.mjs` / `cdd-review.mjs` 调用 background 运行；返回后读 handoff.json 判断状态。
- **3-pass Plan Review**：completeness / decomposition / buildability，各 dispatch 一次 fresh `cdd-review`（background）。仅 blocker 驱动重跑；blocker=0 后 warn/nit 留用户决策门，不重跑。
- **CDD engine dispatch**：harness 选择（claude）→ workspace 创建 → brief 生成 → `cdd-task.mjs --harness claude --task N --mode implement` → handoff → task-review → fix（如需）→ ledger append（仅 APPROVED）→ Final Review（branch-review HARD-GATE）。
- **changeset**：P10 统一建（程序级豁免）。
- **deferred-disposition**：Final Review 后聚合 `findings[].deferred=true`，用户选 fix-now / carry-skip。

---

## Self-Review Notes

- Spec coverage: §1-§9 全部有对应 task（init→Task1；report-issue+#136→Task2；cursor rule+slash→Task3；emit+validate+close→Task4）。
- Placeholder scan: 无 TBD/TODO；每个 step 含具体文件/命令/节点定义。
- Type consistency: 节点名（dispatch/run-harness/list-harness；detect/guide/config/trust/summarize；analyze/classify/confirm/dedup/resolve-hit/file/report）在 spec 与 plan 一致；终态统一 `APPROVED: harness-installed`（init）/ `APPROVED: report`（report-issue）。
