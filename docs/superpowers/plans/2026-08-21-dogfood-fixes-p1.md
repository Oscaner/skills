# Dogfood 修复 P1 — Skills 规则修复 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `osuperpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 6 项 dogfood 流程违规，对 brainstorming / writing-plans / executing-plans 三个 SKILL.md 进行结构性重写并统一骨架；将 review-dispatch.md 重命名为 docs-review.md 并新增 Review 停止机制（循环流程）和 Handoff Output 规则；更新 CLAUDE.md 引用。

**Architecture:** 纯文本规则文件修改，无运行时代码变更。每个任务独立修改文件，Task 5 统一运行 `pnpm run emit` 重新生成派生文件，`pnpm run validate` 验证全链路。

**Tech Stack:** Markdown 文本编辑；`pnpm run emit`；`pnpm run validate`

## Global Constraints

- **语言架构 Strategy A**：SKILL.md 须为纯英文，无中文混入；zh-CN 镜像文件必须在同一 task 内同步更新（非 defer）
- **语言架构 Strategy B**：specs/plans 中文写作，无需镜像
- 不修改 vendors 子模块
- task-review（executing-plans Fix Loop）和 branch-review（cli-code-review）不引用 docs-review.md，维持现有机制
- 每 task 完成后独立 commit（conventional commit 格式，无 AI attribution）
- spec 文件：`docs/superpowers/specs/2026-08-21-dogfood-fixes-p1-design.md`

---

## File Structure

| 文件 | 操作 | Task |
|------|------|------|
| `packages/osuperpowers/docs/review-dispatch.md` | Rename → `docs-review.md` + scope 声明 + Rule: Review Stopping + Rule: Handoff Output | Task 1 |
| `packages/osuperpowers/CLAUDE.md` | Modify — 引用路径 + scope 描述更新 | Task 1 |
| `packages/osuperpowers/skills/brainstorming/SKILL.md` | Rewrite — 纯英文 + 统一骨架 + HARD-GATE + #162 | Task 2 |
| `packages/osuperpowers/skills/brainstorming/SKILL.zh-CN.md` | Update — 同步 Task 2 英文重写内容 | Task 2 |
| `packages/osuperpowers/skills/writing-plans/SKILL.md` | Rewrite — 纯英文 + 统一骨架 + #156 + #163-① + #163-② | Task 3 |
| `packages/osuperpowers/skills/writing-plans/SKILL.zh-CN.md` | Update — 同步 Task 3 英文重写内容 | Task 3 |
| `packages/osuperpowers/skills/executing-plans/SKILL.md` | Rewrite — 纯英文 + 统一骨架 + #163-③ + #163-④ | Task 4 |
| `packages/osuperpowers/skills/executing-plans/SKILL.zh-CN.md` | Update — 同步 Task 4 英文重写内容 | Task 4 |
| `.agents/skills/osuperpowers/*/SKILL.md`（派生） | 由 `pnpm run emit` 重新生成 | Task 5 |
| `.agents/skills/osuperpowers/*/SKILL.zh-CN.md`（派生） | 由 `pnpm run emit` 重新生成 | Task 5 |

---

## Plan Review Protocol

```
① 执行 3-pass Plan Review（completeness / decomposition / buildability）
② blocker 必须修复 → 只重跑产生该 blocker 的那一 pass → blocker=0 → 继续
③ 所有 pass blocker=0 → 将 warn/nit 列表一次性呈现给用户（允许逐项选择）：

   用户选择【不修复】
     └─→ 直接进入下一步（移交 osuperpowers:executing-plans）

   用户选择【修复部分或全部】
     └─→ 修复指定项
     └─→ 询问用户："是否需要重新进行 3-pass review？"
           用户说【不需要】→ 直接进入下一步
           用户说【需要】  → 回到 ①
```

此协议适用于所有 3-pass review（spec-review / plan-review）。

---

### Task 1: review-dispatch.md → docs-review.md（重命名 + scope + Rule: Review Stopping + Rule: Handoff Output）

**Files:**
- Rename + Modify: `packages/osuperpowers/docs/review-dispatch.md` → `docs/docs-review.md`
- Modify: `packages/osuperpowers/CLAUDE.md`

**Interfaces:**
- Consumes: 现有 review-dispatch.md（D1/D2/D3 规则，末行 `blocker → CHANGES_REQUESTED`）
- Produces: `docs-review.md`（scope 限定 spec/plan only + Rule: Review Stopping 循环流程 + Rule: Handoff Output），被 Tasks 2-3 的引用路径消费

- [ ] **Step 1: 重命名文件**

  ```bash
  cd /Users/kang/Projects/oscaner-skills/packages/osuperpowers
  git mv docs/review-dispatch.md docs/docs-review.md
  ```
- [ ] **Step 2: 在文件头插入 scope 声明**

  Read `packages/osuperpowers/docs/docs-review.md`，在标题行 `# Review Dispatch` 之后插入：

  ```markdown
  > **Scope:** Applies to 3-pass AI-orchestrated doc reviews (spec-review / plan-review) only.
  > Task-review uses Fix Loop in `executing-plans/SKILL.md`. Branch-review uses `cli-code-review/SKILL.md`.
  ```

- [ ] **Step 3: 替换 warn/nit 末行并追加 Rule: Review Stopping**

  将末行（Edit，old_string = 末行全文，new_string = 末行 + 以下内容）：

  old_string:
  `- warn/nit do not enter the fix loop — handoff records \`APPROVED\` + \`deferred: true\`; blocker → \`CHANGES_REQUESTED\``

  new_string（追加在末行之后）：

      - warn/nit: see Rule: Review Stopping below

      ### Rule: Review Stopping

      Applies to spec-review and plan-review (3-pass AI-orchestrated doc reviews):

      Loop flow:
        ① Run 3-pass review
        ② blocker: must fix → re-run only the failing pass → blocker=0 → continue
        ③ All passes blocker=0 → present warn/nit list to user (per-item selection allowed):

           User says [don't fix]
             └─→ review complete, proceed to next step

           User says [fix some/all]
             └─→ fix selected items
             └─→ ask user: "Do you want to re-run 3-pass review?"
                   User says [no]  → review complete, proceed to next step
                   User says [yes] → go back to ①

      When presenting warn/nit: read from the already-captured output of the current
      3-pass review cycle. Do not issue any new review call to obtain them.

- [ ] **Step 4: 追加 Rule: Handoff Output**

  在 Rule: Review Stopping 之后追加：

      ### Rule: Handoff Output

      **Scope:** spec-review and plan-review only. Task-review uses $CDD_HANDOFF_PATH
      (unchanged). Branch-review: out of scope for this rule. `[Engine pending P2]`

      Path convention (enforced by P2 engine — `cdd-review.mjs --handoff PATH`):
        - spec-review: `<cdd-workspace>/spec-review-handoff.json`
        - plan-review: `<cdd-workspace>/plan-review-handoff.json`

      `<cdd-workspace>` = `.superpowers/cdd/<plan-slug>/`

      handoff.json schema: `{ "status": "APPROVED|CHANGES_REQUESTED", "findings": [...], "deferred": [...] }`

- [ ] **Step 5: 更新 CLAUDE.md**

  Read `packages/osuperpowers/CLAUDE.md`，将：
  ```
  - [docs/review-dispatch.md](docs/review-dispatch.md) -- **D1 escalate-on-finding**...Cited by every review-pass rule in the osuperpowers skills.
  ```
  替换为：
  ```
  - [docs/docs-review.md](docs/docs-review.md) -- **D1 escalate-on-finding**, **D2 delta review**, **D3 findings-only output**, **Rule: Review Stopping** (loop flow for warn/nit user decision), **Rule: Handoff Output** `[Engine pending P2]`. Cited by spec-review (brainstorming) and plan-review (writing-plans) only. Task-review and branch-review use their own mechanisms.
  ```

- [ ] **Step 6: 自检**

  重读 `docs/docs-review.md`：
  - 文件头 scope 声明存在
  - Rule: Review Stopping 包含完整 ①→②→③ 循环流程
  - Rule: Handoff Output 含 `[Engine pending P2]` 标注、scope 限定 spec/plan only
  - 原有 D1/D2/D3 规则未改动

- [ ] **Step 7: 运行局部验证**

  ```bash
  cd /Users/kang/Projects/oscaner-skills && fnm use && pnpm run test
  ```
  预期：engine tests 全绿

- [ ] **Step 8: Commit**

  ```bash
  git add packages/osuperpowers/docs/docs-review.md packages/osuperpowers/CLAUDE.md
  git commit -m "docs: rename review-dispatch.md to docs-review.md, add scope declaration, Rule: Review Stopping, Rule: Handoff Output"
  ```

---

### Task 2: brainstorming/SKILL.md — structured rewrite (#162)

**Files:**
- Rewrite: `packages/osuperpowers/skills/brainstorming/SKILL.md` (English only)
- Update: `packages/osuperpowers/skills/brainstorming/SKILL.zh-CN.md` (Chinese mirror)

**Interfaces:**
- Consumes: current brainstorming/SKILL.md (7 Rules, 5 Red Flags)
- Produces: unified skeleton rewrite (English); matching zh-CN mirror

- [ ] **Step 1: Read current file**

  Read `packages/osuperpowers/skills/brainstorming/SKILL.md` to confirm current state.

- [ ] **Step 2: Write English rewrite (SKILL.md)**

  Write the following content to `packages/osuperpowers/skills/brainstorming/SKILL.md`:

  ```
  ---
  name: brainstorming
  description: Independent brainstorm orchestrator -- Reads upstream superpowers:brainstorming as baseline, layers personal rules (grilling clarification / overall+phase / cli review passes). Callable standalone; triggered by /brainstorming via overrides router.
  ---

  # Osuperpowers Brainstorming

  Full brainstorm flow orchestration, callable standalone.

  <HARD-GATE>
  After brainstorming is triggered, you MUST complete ALL of the following steps in order,
  regardless of change size, whether input already contains a proposal, or whether an issue exists:

  1. Read upstream superpowers:brainstorming SKILL.md (Rule: Read Upstream)
  2. Read grilling SKILL.md (Rule: Read Sub-Skills)
  3. Explore project context (files, docs, recent commits)
  4. Grilling — ask one question at a time, wait for each answer before continuing
  5. Propose 2-3 approaches with trade-offs and recommendation
  6. Present design section by section; get user confirmation after each section
  7. Write design doc
  8. 3-pass Spec Review via CLI (Rule: Spec Review via CLI)
  9. User reviews spec; iterate as needed
  10. Hand off to osuperpowers:writing-plans (Rule: Next-Step Routing)

  No implementation actions allowed until step 6 (design approved by user) is complete.
  </HARD-GATE>

  ## Checklist

  1. Read upstream superpowers:brainstorming SKILL.md (Rule: Read Upstream)
  2. Read grilling SKILL.md (Rule: Read Sub-Skills)
  3. Explore project context (files, docs, recent commits)
  4. Grilling — ask one question at a time, wait for each answer before continuing
  5. Propose 2-3 approaches with trade-offs and recommendation
  6. Present design section by section; get user confirmation after each section
  7. Write design doc
  8. 3-pass Spec Review via CLI (Rule: Spec Review via CLI)
  9. User reviews spec; iterate as needed
  10. Hand off to osuperpowers:writing-plans (Rule: Next-Step Routing)

  ## Rules

  ### Rule: Read Upstream

  Read upstream `superpowers:brainstorming` SKILL.md as the process baseline **when available** (claude / cursor has superpowers plugin installed). **Read, not Skill-invoke** (Skill-invoke triggers the router interception).

  Resolve paths (`{plugin-root}` = this plugin's osuperpowers root):
  1. **Sibling plugin root**: claude `$CLAUDE_PLUGIN_ROOT/../superpowers/skills/brainstorming/SKILL.md` (same for cursor)
  2. **Fallback same-repo relative path**: `<repo-root>/vendors/superpowers/skills/brainstorming/SKILL.md`

  Upstream unavailable (non-claude harness / superpowers plugin not installed) → **no error**: execute this skill's own Rules as the complete flow directly.

  ### Rule: Read Sub-Skills

  **Must** read `mattpocock-skills` `skills/productivity/grilling/SKILL.md` (mandatory step — clarification question delegation).
  On failure (file not found / read error) → **report error + ask the user for next steps**; user may skip grilling and continue, or abort the flow.
  Load failure protocol: see [subagent-lifecycle.md](../docs/subagent-lifecycle.md#rule-delegate-load-failure).

  ### Rule: Research Delegation

  When the explore-context phase discovers questions requiring primary source research (upstream API behavior, harness CLI specs, package internals, cross-harness differences):

  1. **Identify + ask the user**: list questions, ask "trigger research?" — user confirms → spawn; user declines → skip, normal flow continues
  2. **Spawn background agent**: one mattpocock-skills:research agent per question (parallel). Prompt = question + cite sources instruction.
  3. **Continue explore-context** (code exploration is not interrupted)
  4. **Wait for completion** before entering grilling
  5. **Output**: findings written to `docs/research/YYYY-MM-DD-<topic>.md`
  6. **Consumption**: research findings referenced as primary sources in grilling + approach selection + design

  Trigger failure (research agent error/timeout) → log stderr, do not block flow (fail-open).

  ### Rule: Overall-Phase

  Large requirements (>=3 subsystems / multi-phase / overhaul) write an overall spec first, then phase out. Document structure: see [overall-phase-spec-template.md](../docs/overall-phase-spec-template.md). GATE: overall approval != phase started.

  ### Rule: Spec Review via CLI

  Spec review has 3 pass types (completeness / consistency&scope / clarity&YAGNI), each pass dispatches a fresh `cdd-review`:
    cdd-review --harness claude --template spec-review --param PASS=<completeness|consistency|clarity> --param DOC=<path>
  Dispatch discipline: see [docs-review.md](../docs/docs-review.md) (D1/D2/D3 + fresh-pass, mapped verbatim to cli; Review Stopping loop + Handoff Output `[Engine pending P2]`).

  ### Rule: Next-Step Routing

  After brainstorming completes, invoke **`osuperpowers:writing-plans`** (not upstream `superpowers:writing-plans`). The osuperpowers wrapper adds section-by-section writing, cli review passes, and ticket publish redirect on top of the upstream baseline.

  ### Rule: Write Design Doc

  Spec saved to `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`, after user review → writing-plans.

  ## Red Flags

  - "Skill-invoke upstream brainstorm" → Read instead of Skill-invoke (Rule: Read Upstream)
  - "Skip design for simple projects" → every project goes through design (HARD-GATE flow Step 6)
  - "Research auto-triggers without asking user" → user confirmation is a hard gate (Rule: Research Delegation)
  - "Research blocks explore-context" → background parallel (Rule: Research Delegation)
  - "Invoke writing-plans / superpowers:writing-plans" → invoke **`osuperpowers:writing-plans`** (Rule: Next-Step Routing)
  - "Input already contains a proposal, skip grilling and go straight to design" → violates HARD-GATE flow Step 4
  - "Change is simple, skip design and implement directly" → violates HARD-GATE flow Step 6
  - "Overall approved, start implementation directly (skipping Phase brainstorming)" → violates HARD-GATE flow Steps 1-10 (entire flow)
  - "Auto-fix warn/nit and re-run review after blocker=0" → violates Review Stopping (docs-review.md); present to user, re-run only if user requests
  - "Issue new cdd-review call to obtain warn/nit content" → violates Review Stopping; read from already-captured output of current 3-pass cycle
  ```

- [ ] **Step 3: Write Chinese mirror (SKILL.zh-CN.md)**

  Write the following content to `packages/osuperpowers/skills/brainstorming/SKILL.zh-CN.md`:

  ```
  ---
  name: brainstorming
  description: 独立 brainstorm 编排器——读取上游 superpowers:brainstorming 作为基线，叠加个人规则（grilling 澄清 / overall+phase / CLI review pass）。可单独调用；通过 overrides router 由 /brainstorming 触发。
  ---

  # Osuperpowers Brainstorming

  完整 brainstorm 流程编排，可单独调用。

  <HARD-GATE>
  触发 brainstorming 后，必须按序完成以下全部步骤，
  无论改动规模大小、输入是否已含方案、是否已有 issue 描述：

  1. 读取上游 superpowers:brainstorming SKILL.md（Rule: Read Upstream）
  2. 读取 grilling SKILL.md（Rule: Read Sub-Skills）
  3. Explore project context（文件、文档、近期 commits）
  4. Grilling——逐一追问，每次只问一个问题，等待回答后继续
  5. 提出 2-3 个方案，含 trade-off 与推荐
  6. 逐节呈现设计，每节获得用户确认
  7. 写入 design doc
  8. 3-pass Spec Review via CLI（Rule: Spec Review via CLI）
  9. 用户审阅 spec，按需迭代
  10. 移交 osuperpowers:writing-plans（Rule: Next-Step Routing）

  在步骤 6（design 用户批准）完成前，禁止任何实施行动。
  </HARD-GATE>

  ## Checklist

  1. 读取上游 superpowers:brainstorming SKILL.md（Rule: Read Upstream）
  2. 读取 grilling SKILL.md（Rule: Read Sub-Skills）
  3. Explore project context（文件、文档、近期 commits）
  4. Grilling——逐一追问，每次只问一个问题，等待回答后继续
  5. 提出 2-3 个方案，含 trade-off 与推荐
  6. 逐节呈现设计，每节获得用户确认
  7. 写入 design doc
  8. 3-pass Spec Review via CLI（Rule: Spec Review via CLI）
  9. 用户审阅 spec，按需迭代
  10. 移交 osuperpowers:writing-plans（Rule: Next-Step Routing）

  ## Rules

  ### Rule: Read Upstream

  有上游时读取 `superpowers:brainstorming` SKILL.md 作为基线（claude / cursor 已安装 superpowers plugin）。**读取，不 Skill-invoke**（Skill-invoke 会触发 router 拦截）。

  路径解析（`{plugin-root}` = 本 plugin 的 osuperpowers 根）：
  1. **同级 plugin 根目录**：claude `$CLAUDE_PLUGIN_ROOT/../superpowers/skills/brainstorming/SKILL.md`（cursor 同）
  2. **回退到 repo 内相对路径**：`<repo-root>/vendors/superpowers/skills/brainstorming/SKILL.md`

  上游不可用（非 claude harness / superpowers plugin 未安装）→ **不报错**：直接执行本 skill 的 Rules 作为完整流程。

  ### Rule: Read Sub-Skills

  **必须**读取 `mattpocock-skills` `skills/productivity/grilling/SKILL.md`（强制步骤——澄清问题委托）。
  失败（文件不存在/读取错误）→ **报告错误 + 询问用户下一步**；用户可跳过 grilling 继续或中止流程。
  加载失败协议：见 [subagent-lifecycle.md](../docs/subagent-lifecycle.md#rule-delegate-load-failure)。

  ### Rule: Research Delegation

  当 explore-context 阶段发现需要主源研究的问题（上游 API 行为、harness CLI 规格、包内部结构、跨 harness 差异）：

  1. **识别 + 询问用户**：列出问题，询问"是否触发 research？"——用户确认 → spawn；用户拒绝 → 跳过，正常流程继续
  2. **派发后台 agent**：每个问题一个 mattpocock-skills:research agent（并行）。Prompt = 问题描述 + 引用来源指令。
  3. **继续 explore-context**（代码探索不中断）
  4. 进入 grilling 前**等待完成**
  5. **输出**：写入 `docs/research/YYYY-MM-DD-<topic>.md`
  6. **消费**：在 grilling + 方案选择 + 设计中作为主源引用

  触发失败（agent 错误/超时）→ 记录 stderr，不阻塞流程（fail-open）。

  ### Rule: Overall-Phase

  大型需求（≥3 个子系统 / 多阶段 / 大改）先写 overall spec，再 phase out。文档结构见 [overall-phase-spec-template.md](../docs/overall-phase-spec-template.md)。GATE：overall 批准 ≠ phase 已开始。

  ### Rule: Spec Review via CLI

  Spec review 有 3 种 pass 类型（completeness / consistency&scope / clarity&YAGNI），每个 pass 派发一次新的 `cdd-review`：
    cdd-review --harness claude --template spec-review --param PASS=<completeness|consistency|clarity> --param DOC=<path>
  派发纪律见 [docs-review.md](../docs/docs-review.md)（D1/D2/D3 + fresh-pass，原样映射到 cli；Review Stopping 循环 + Handoff Output `[Engine pending P2]`）。

  ### Rule: Next-Step Routing

  brainstorming 完成后，调用 **`osuperpowers:writing-plans`**（非上游 `superpowers:writing-plans`）。osuperpowers wrapper 在上游基线之上叠加了逐节写入、CLI review pass 和 ticket 发布重定向。

  ### Rule: Write Design Doc

  Spec 保存到 `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`，用户审阅后 → writing-plans。

  ## Red Flags

  - "Skill-invoke 上游 brainstorm" → 读取而非 Skill-invoke（Rule: Read Upstream）
  - "跳过简单项目的设计" → 每个项目都要经过设计（HARD-GATE 流程型 Step 6）
  - "Research 在未询问用户的情况下自动触发" → 用户确认是硬性门控（Rule: Research Delegation）
  - "Research 阻塞 explore-context" → 后台并行（Rule: Research Delegation）
  - "调用 writing-plans / superpowers:writing-plans" → 调用 **`osuperpowers:writing-plans`**（Rule: Next-Step Routing）
  - "输入已含方案，跳过 grilling 直接设计" → 违反 HARD-GATE 流程型 Step 4
  - "改动简单，跳过 design 直接实施" → 违反 HARD-GATE 流程型 Step 6
  - "Overall 批准后直接开始实施（跳过 Phase brainstorming）" → 违反 HARD-GATE 流程型 Steps 1-10（整个流程）
  - "blocker=0 后自动修复 warn/nit 并重跑 review" → 违反 Review Stopping 规则（docs-review.md），应呈现给用户，用户决策后视需求决定是否重跑
  - "为获取 warn/nit 内容额外发起新的 cdd-review 调用" → 违反 Review Stopping 规则，从本次 3-pass cycle 已有输出读取
  ```

- [ ] **Step 4: Self-check**

  Verify against spec Section 2.3:
  - SKILL.md has NO Chinese content (all English, including HARD-GATE, Checklist, Red Flags)
  - zh-CN file has Chinese translation of all content
  - Top-level HARD-GATE present with 10 steps, final line "No implementation actions allowed until step 6"
  - Checklist 10 items match HARD-GATE
  - 7 Rules retained (no step-listing process descriptions in rule bodies)
  - Rule: Spec Review via CLI references `docs-review.md` (not review-dispatch.md)
  - New Red Flags: input has proposal / simple change / Overall approved + implementation / Review Stopping × 2
  - Original 5 Red Flags retained (5 original + 5 new = 10 total)

- [ ] **Step 5: Run partial validation**

  ```bash
  cd /Users/kang/Projects/oscaner-skills && fnm use && pnpm run test
  ```
  Expected: engine tests pass

- [ ] **Step 6: Commit**

  ```bash
  git add packages/osuperpowers/skills/brainstorming/SKILL.md packages/osuperpowers/skills/brainstorming/SKILL.zh-CN.md
  git commit -m "feat: rewrite brainstorming/SKILL.md (English-only) and sync zh-CN mirror (#162)"
  ```

---

### Task 3: writing-plans/SKILL.md — structured rewrite (#156 / #163-① / #163-②)

**Files:**
- Rewrite: `packages/osuperpowers/skills/writing-plans/SKILL.md` (English only)
- Update: `packages/osuperpowers/skills/writing-plans/SKILL.zh-CN.md` (Chinese mirror)

**Interfaces:**
- Consumes: current writing-plans/SKILL.md (6 Rules, 4 Red Flags)
- Produces: unified skeleton rewrite (English) + matching zh-CN mirror

- [ ] **Step 1: Read current file**

  Read `packages/osuperpowers/skills/writing-plans/SKILL.md`.

- [ ] **Step 2: Write English rewrite (SKILL.md)**

  Write the following content to `packages/osuperpowers/skills/writing-plans/SKILL.md`:

  ```
  ---
  name: writing-plans
  description: Independent plan-writing orchestrator -- Reads upstream superpowers:writing-plans as baseline, layers personal rules (section-by-section writing / cli review passes / to-tickets publish redirect).
  ---

  # Osuperpowers Writing-Plans

  Full plan-writing flow orchestration, callable standalone.

  ## Checklist

  1. Read upstream `superpowers:writing-plans` SKILL.md (Rule: Read Upstream)
  2. Read spec file to understand design constraints
  3. Write plan section by section — one tool call per section (Rule: Section-by-Section)
  4. 3-pass Plan Review via CLI (completeness / decomposition / buildability)
  5. Present completed plan to user in one message for confirmation
  6. Execution Handoff → hand off to `osuperpowers:executing-plans`

  ## Rules

  ### Rule: Read Upstream

  Read upstream `superpowers:writing-plans` SKILL.md as the process baseline **when available** (resolution priority + unavailability fallback same as [Rule: Read Upstream](../brainstorming/SKILL.md#rule-read-upstream)). **Read, not Skill-invoke**.

  ### Rule: Read Sub-Skills

  On demand, Read `mattpocock-skills` `skills/engineering/to-tickets/SKILL.md` (ticket splitting Steps 1-4). Load failure protocol: see [subagent-lifecycle.md](../docs/subagent-lifecycle.md#rule-delegate-load-failure).

  ### Rule: Section-by-Section

  Write/Edit the plan section by section (one tool call per section), not as a single bulk generation.

  Writing granularity and confirmation timing are decoupled: each section is written in one independent tool call (writing granularity); after all sections are written, present to the user in one message (confirmation timing). **Prohibited**: pausing after each section to wait for user response.

  ### Rule: Plan Review via CLI

  <HARD-GATE>
  After the plan is written, you MUST execute three cdd-review CLI passes in order
  (completeness / decomposition / buildability).
  Inline self-check is NOT a substitute. All passes must complete before Execution Handoff.
  </HARD-GATE>

  Plan review has 3 pass types (completeness & spec alignment / task decomposition / buildability & type consistency), each pass dispatches a fresh `cdd-review`:
    cdd-review --harness claude --template plan-review --param PASS=<completeness|decomposition|buildability> --param DOC=<plan-path> --param SPEC=<spec-path>
  **Template resolution reuses** [Rule: Read Upstream](#rule-read-upstream) path rules (`{plugin-root}` = osuperpowers root). Dispatch discipline: see [docs-review.md](../docs/docs-review.md) (D1/D2/D3 + fresh-pass, mapped verbatim to cli; Review Stopping loop + Handoff Output `[Engine pending P2]`).

  ### Rule: Tickets Publish Redirect

  After ticket splitting, publish to a single local file `docs/superpowers/tickets/YYYY-MM-DD-<feature>-tickets.md` (do not publish to remote tracker).

  ### Rule: Next-Step Routing

  After plan review passes, invoke **`osuperpowers:executing-plans`** (not upstream `superpowers:subagent-driven-development` or `superpowers:executing-plans`).

  **Execution handoff text:**

  > "Plan complete and saved to `docs/superpowers/plans/<filename>.md`. Ready to execute — I'll hand off to `osuperpowers:executing-plans` for mode selection and execution."

  Do NOT offer a subagent-vs-inline choice — `osuperpowers:executing-plans` does that.

  ## Red Flags

  - "Write the whole thing at once" → section-by-section writing (Rule: Section-by-Section)
  - "Publish tickets to GitHub" → single local file (Rule: Tickets Publish Redirect)
  - "Invoke superpowers:subagent-driven-development / superpowers:executing-plans" → invoke **`osuperpowers:executing-plans`** (Rule: Next-Step Routing)
  - "Offer subagent vs inline choice" → `osuperpowers:executing-plans` handles mode selection (Rule: Next-Step Routing)
  - "Ask user after each section whether to continue" → write all sections first, then confirm (Rule: Section-by-Section)
  - "Replace Plan Review CLI with inline self-check" → violates HARD-GATE Plan Review; must call CLI three times
  - "Display subagent / in-session / CLI three-option choice" → use Execution Handoff text, hand off to `osuperpowers:executing-plans` (Rule: Next-Step Routing)
  - "Auto-fix warn/nit and re-run review after blocker=0" → violates Review Stopping (docs-review.md); present to user, re-run only if user requests
  - "Issue new cdd-review call to obtain warn/nit content" → violates Review Stopping; read from already-captured output of current 3-pass cycle
  ```

- [ ] **Step 3: Write Chinese mirror (SKILL.zh-CN.md)**

  Write the following content to `packages/osuperpowers/skills/writing-plans/SKILL.zh-CN.md`:

  ```
  ---
  name: writing-plans
  description: 独立 plan 写作编排器——读取上游 superpowers:writing-plans 作为基线，叠加个人规则（逐节写入 / CLI review pass / tickets 发布重定向）。
  ---

  # Osuperpowers Writing-Plans

  完整 plan 写作流程编排，可单独调用。

  ## Checklist

  1. 读取上游 `superpowers:writing-plans` SKILL.md（Rule: Read Upstream）
  2. 读取 spec 文件，理解设计约束
  3. 逐节写入 plan——每节一次 tool call（Rule: Section-by-Section）
  4. 3-pass Plan Review via CLI（completeness / decomposition / buildability）
  5. 将写完的 plan 一次性呈现给用户确认
  6. Execution Handoff → 移交 `osuperpowers:executing-plans`

  ## Rules

  ### Rule: Read Upstream

  有上游时读取 `superpowers:writing-plans` SKILL.md 作为基线（解析优先级 + 不可用回退同 [Rule: Read Upstream](../brainstorming/SKILL.md#rule-read-upstream)）。**读取，不 Skill-invoke**。

  ### Rule: Read Sub-Skills

  按需读取 `mattpocock-skills` `skills/engineering/to-tickets/SKILL.md`（ticket 拆分步骤 1-4）。加载失败协议见 [subagent-lifecycle.md](../docs/subagent-lifecycle.md#rule-delegate-load-failure)。

  ### Rule: Section-by-Section

  逐节写入/编辑 plan（每节一次 tool call），而非一次性批量生成。

  写入粒度与确认时机解耦：每节独立 tool call 写入（写入粒度）；所有节写入完成后一次性呈现给用户（确认时机）。**禁止**每节完成后暂停等待用户回应。

  ### Rule: Plan Review via CLI

  <HARD-GATE>
  Plan 写完后，必须按序执行三次 cdd-review CLI pass
  （completeness / decomposition / buildability），
  不可用内联自检替代，全部通过后方可进入 Execution Handoff。
  </HARD-GATE>

  Plan review 有 3 种 pass 类型（completeness & spec 对齐 / task 分解 / buildability & 类型一致性），每个 pass 派发一次新的 `cdd-review`：
    cdd-review --harness claude --template plan-review --param PASS=<completeness|decomposition|buildability> --param DOC=<plan-path> --param SPEC=<spec-path>
  **模板解析复用** [Rule: Read Upstream](#rule-read-upstream) 的路径规则（`{plugin-root}` = osuperpowers 根）。派发纪律见 [docs-review.md](../docs/docs-review.md)（D1/D2/D3 + fresh-pass，原样映射到 cli；Review Stopping 循环 + Handoff Output `[Engine pending P2]`）。

  ### Rule: Tickets Publish Redirect

  ticket 拆分后，发布到单一本地文件 `docs/superpowers/tickets/YYYY-MM-DD-<feature>-tickets.md`（不发布到远程 tracker）。

  ### Rule: Next-Step Routing

  plan review 通过后，调用 **`osuperpowers:executing-plans`**（非上游 `superpowers:subagent-driven-development` 或 `superpowers:executing-plans`）。

  **Execution handoff 文本：**

  > "Plan complete and saved to `docs/superpowers/plans/<filename>.md`. Ready to execute — I'll hand off to `osuperpowers:executing-plans` for mode selection and execution."

  不提供 subagent vs inline 选择——`osuperpowers:executing-plans` 自行处理模式选择。

  ## Red Flags

  - "一次性写入全部内容" → 逐节写入（Rule: Section-by-Section）
  - "发布 tickets 到 GitHub" → 单一本地文件（Rule: Tickets Publish Redirect）
  - "调用 superpowers:subagent-driven-development / superpowers:executing-plans" → 调用 **`osuperpowers:executing-plans`**（Rule: Next-Step Routing）
  - "提供 subagent vs inline 选择" → `osuperpowers:executing-plans` 处理模式选择（Rule: Next-Step Routing）
  - "每节写完后询问用户是否继续" → 写完所有节再确认（Rule: Section-by-Section）
  - "用内联自检替代 Plan Review cdd-review CLI" → 违反 HARD-GATE Plan Review，必须调用三次 CLI
  - "展示 subagent / in-session / CLI 三选一选项" → 使用 Execution Handoff 文本，移交 `osuperpowers:executing-plans`（Rule: Next-Step Routing）
  - "blocker=0 后自动修复 warn/nit 并重跑 review" → 违反 Review Stopping 规则（docs-review.md），应呈现给用户，用户决策后视需求决定是否重跑
  - "为获取 warn/nit 内容额外发起新的 cdd-review 调用" → 违反 Review Stopping 规则，从本次 3-pass cycle 已有输出读取
  ```

- [ ] **Step 4: Self-check**

  Verify against spec Section 2.4:
  - SKILL.md has NO Chinese content
  - Checklist 6 items (English)
  - Rule: Section-by-Section contains "Writing granularity and confirmation timing are decoupled" + "Prohibited: pausing after each section" (#156)
  - Rule: Plan Review via CLI has embedded HARD-GATE (English) (#163-①); references `docs-review.md`
  - Red Flag "Replace Plan Review CLI with inline self-check" present (#163-①)
  - Red Flag "Display three-option choice" present (#163-②)
  - Review Stopping × 2 Red Flags present
  - Execution Handoff text correct (not three-option)
  - zh-CN file is full Chinese translation

- [ ] **Step 5: Run partial validation**

  ```bash
  cd /Users/kang/Projects/oscaner-skills && fnm use && pnpm run test
  ```
  Expected: engine tests pass

- [ ] **Step 6: Commit**

  ```bash
  git add packages/osuperpowers/skills/writing-plans/SKILL.md packages/osuperpowers/skills/writing-plans/SKILL.zh-CN.md
  git commit -m "feat: rewrite writing-plans/SKILL.md (English-only) and sync zh-CN mirror (#156 #163)"
  ```

---

### Task 4: executing-plans/SKILL.md — structured rewrite (#163-③ / #163-④)

**Files:**
- Rewrite: `packages/osuperpowers/skills/executing-plans/SKILL.md` (English only)
- Update: `packages/osuperpowers/skills/executing-plans/SKILL.zh-CN.md` (Chinese mirror)

**Interfaces:**
- Consumes: current executing-plans/SKILL.md (11 Rules, 7 Red Flags)
- Produces: unified skeleton rewrite (English) + matching zh-CN mirror. Note: Fix Loop does NOT reference docs-review.md (task-review uses its own Fix Loop mechanism)

- [ ] **Step 1: Read current file**

  Read `packages/osuperpowers/skills/executing-plans/SKILL.md`.

- [ ] **Step 2: Write English rewrite (SKILL.md)**

  Write the following content to `packages/osuperpowers/skills/executing-plans/SKILL.md`:

  ```
  ---
  name: executing-plans
  description: Independent plan execution orchestrator -- User selects execution mode (in-session / subagent / cli), orchestrator controller rule set (11 semantic rules, shared across three modes). cli mode delegates to cli-driven-development; in-session/subagent mode Reads the corresponding upstream skill.
  ---

  # Osuperpowers Executing-Plans

  Master orchestrator for executing written plans. Three modes chosen by the user.

  <HARD-GATE>
  The FIRST action at startup MUST be AskUserQuestion to select mode (in-session | subagent | cli),
  before any repo tool call. Do NOT accept a mode pre-selection from a prior skill's handoff — the orchestrator always asks directly.
  </HARD-GATE>

  ## Checklist

  1. AskUserQuestion to select mode (in-session / subagent / cli)
  2. Read corresponding upstream SKILL.md (Rule: Read Upstream)
  3. Setup (workspace / ledger / plan / plan-constraints / pre-flight)
  4. Per-task loop: Task Complexity → Confirm Once → Confirm Seams → implement → **Per-Task Review** → ledger
  5. D6 Aggregation (aggregate deferred items → user decision)
  6. `osuperpowers:code-review` → `osuperpowers:finishing`

  ## Rules

  ### Rule: Read Upstream

  Resolve upstream based on user-selected mode (resolution priority + unavailability fallback same as [Rule: Read Upstream](../brainstorming/SKILL.md#rule-read-upstream)):
  - **in-session** → resolve `executing-plans` SKILL.md path, Read as baseline (when available)
  - **subagent** → resolve `subagent-driven-development` SKILL.md path, Read as baseline (when available)
  - **cli** → [cli-driven-development](../cli-driven-development/SKILL.md) (Skill-invoke delegation, do not Read upstream)

  ### Rule: Mode Selection

  <HARD-GATE>
  At startup, BEFORE any other action (before reading plan, before setup, before ANY tool call that touches the repo), use `AskUserQuestion` to let the user choose a mode (in-session | subagent | cli). Do NOT accept a mode pre-selection from a prior skill's handoff — the orchestrator always asks directly. After selection, call `cdd-session-activate.mjs minimal <session_key> <repo_root> --mode <mode>` to write `pending.mode`.
  </HARD-GATE>

  <HARD-GATE>
  After CLI mode is selected, this session is PROHIBITED from using Write/Edit tools to modify repository deliverables (all git-tracked files and skill artifacts).
  All code changes must go through cdd-task.mjs H6 chain. Stop immediately and report to user if a violation is detected.
  </HARD-GATE>

  ### Rule: Task Complexity

  Classify each task first: touches 1-2 files + mechanical implementation → **Simple**; 3+ files / cross-module / requires design judgment / user requests thoroughness → **Complex**. Affects diff scope, test gate, model tier.

  ### Rule: Confirm Once

  spec+plan complete → cheapest implementer tier; confirm once before first dispatch.

  ### Rule: Fix Loop

  `CHANGES_REQUESTED` → fix → scoped review → repeat until `APPROVED` or **5 rounds** (exceeded → STOP + escalate).

  ### Rule: Confirm Seams

  Before dispatching a tdd implement worker, the orchestrator confirms test boundaries (seam) with the user in-session, writing the confirmation result `CONFIRMED_SEAMS: <...>` into the task brief. cli mode is fire-and-forget print-mode CLI that cannot block — `templates/cdd/implement.md` applies non-blocking ("if brief contains `CONFIRMED_SEAMS`, apply it"), seam confirmation is exclusive to the orchestrator layer.

  ### Rule: Per-Task Review

  <HARD-GATE>
  After each task implementation completes, you MUST read `$CDD_HANDOFF_PATH` (handoff.json) to execute the Per-Task Review gate.
  Only after APPROVED can you write to the ledger and advance to the next task.
  Prohibited: skipping handoff read to proceed directly to the next task or compilation verification.
  Applies to all modes: in-session / subagent / cli.
  </HARD-GATE>

  Per-task review gate: read handoff.json driven (plan_conflicts → STOP; CHANGES_REQUESTED → Fix Loop; NEEDS_CONTEXT/unverifiable → STOP). cli mode worker review runs inside the CLI subprocess; in-session/subagent mode review gate runs in-session. Discipline: see [controller-handoff.md](../../docs/controller-handoff.md) H1-H5.

  ### Rule: Quality Invariants

  1. Test evidence gate (task-N-test-evidence.json)
  2. plan_conflicts[] → human adjudication
  3. unverifiable[] non-empty → BLOCKED
  4. handoff NEEDS_CONTEXT → STOP

  ### Rule: Orchestrator Checklist

  The orchestrator's three-phase loop per plan (shared skeleton across three modes; cli mode differences noted in Per-task parentheses):

  **Setup (once):** in-session/subagent → `sdd-workspace`; cli → delegate workspace to [cli-driven-development](../cli-driven-development/SKILL.md) (built inside cdd-task.mjs H6 chain). Unified follow-up: ledger → read plan once → `plan-constraints.md` → pre-flight → todo per task.

  **Per-task:** Rule: Task Complexity → Rule: Confirm Once → Rule: Confirm Seams (before tdd implement dispatch) → append `TASK_BASE: <sha>` to brief → execution chain (cli mode shell H6 chain: implement → review → fix per Rule: Fix Loop; in-session/subagent mode in-session implementation + review) → Read `handoff.json` only → Rule: Per-Task Review + Rule: Quality Invariants → `APPROVED` → ledger. cli mode **Never** edits repo deliverables in this session — H6 CLI only.

  **Final:** [osuperpowers:code-review](../code-review/SKILL.md) whole-branch in-session → clean → [osuperpowers:finishing](../finishing/SKILL.md).

  ### Rule: D6 Aggregation

  After all tasks APPROVED, aggregate deferred items (grep `deferred` substring, including no-jq fallback line `deferred not enumerated -- jq missing`) → **present to user** → **user decision gate** (all defer / name specific ones to fix) → if fix requested then **bounded final fix wave (one pass)**: one fix agent + scoped re-review.

  End semantics:
  - re-review clean → done, handoff `status` stays `APPROVED` (**not rewritten**), ledger keeps complete line (may append a line noting K items fixed)
  - new blocker exposed → still one fix wave, then **unconditionally report to the user** (clean or not) — **no cross-task fix loop**; remaining items are not silently dropped, report ends
  - **round cap 5 applies only to single-task fix loop, not to cross-task final fix wave**

  Mode B: user reads ledger after run ends to aggregate deferred; shell side has no extra end-of-run print.

  ### Rule: Ledger

  Only `APPROVED` appends `Task N: complete` to `CDD_LEDGER`.

  ## Red Flags

  - "CLI is available so skip mode selection" → all three modes must be asked (Rule: Mode Selection)
  - "in-session also uses cdd-task.mjs" → in-session is in-session implementation, no CLI (Rule: Read Upstream)
  - "Shove orchestrator decisions into cli-driven-development" → engine only handles execution (Rule: Read Upstream — cli branch)
  - "User already chose subagent/inline in writing-plans handoff" → Mode Selection is a HARD-GATE, always ask directly (Rule: Mode Selection)
  - "Start executing without calling AskUserQuestion" → Mode Selection must be the first action, before any repo tool call (Rule: Mode Selection)
  - "Load from state with prior mode selection" → session restored with cached mode must still call AskUserQuestion (Rule: Mode Selection)
  - "Use superpowers:subagent-driven-development / superpowers:executing-plans" → upstream references must be mapped to osuperpowers counterparts
  - "Use Write/Edit to modify repository deliverables in CLI mode" → violates HARD-GATE Mode Selection (CLI prohibits inline editing); execute through cdd-task.mjs
  - "Proceed directly to next task or compilation after implementation completes" → violates HARD-GATE Per-Task Review (gate); must first read `$CDD_HANDOFF_PATH`
  - "Treat Per-Task Review as a 3-pass review to run" → Per-Task Review is a handoff.json read gate, not a 3-pass review from docs-review.md
  - "Fix Loop must also follow docs-review.md stopping mechanism" → Fix Loop is task-review (APPROVED/CHANGES_REQUESTED); does not use docs-review.md
  ```

- [ ] **Step 3: Write Chinese mirror (SKILL.zh-CN.md)**

  Write the following content to `packages/osuperpowers/skills/executing-plans/SKILL.zh-CN.md`:

  ```
  ---
  name: executing-plans
  description: 独立 plan 执行编排器——用户选择执行模式（in-session / subagent / cli），编排器控制器规则集（11 条语义规则，三种模式共用）。cli 模式委托给 cli-driven-development；in-session/subagent 模式读取对应的上游 skill。
  ---

  # Osuperpowers Executing-Plans

  执行已写 plan 的主编排器。用户选择三种模式之一。

  <HARD-GATE>
  启动时第一个动作必须是 AskUserQuestion 选择模式（in-session | subagent | cli），
  在此之前禁止任何 repo tool call。不接受来自先前 skill handoff 的预选模式——编排器必须直接询问。
  </HARD-GATE>

  ## Checklist

  1. AskUserQuestion 选择模式（in-session / subagent / cli）
  2. 读取对应上游 SKILL.md（Rule: Read Upstream）
  3. Setup（workspace / ledger / plan / plan-constraints / pre-flight）
  4. Per-task 循环：Task Complexity → Confirm Once → Confirm Seams → 执行 → **Per-Task Review** → ledger
  5. D6 Aggregation（deferred items 聚合 → 用户决策）
  6. `osuperpowers:code-review` → `osuperpowers:finishing`

  ## Rules

  ### Rule: Read Upstream

  根据用户选择的模式解析上游（解析优先级 + 不可用回退同 [Rule: Read Upstream](../brainstorming/SKILL.md#rule-read-upstream)）：
  - **in-session** → 解析 `executing-plans` SKILL.md 路径，读取作为基线（有上游时）
  - **subagent** → 解析 `subagent-driven-development` SKILL.md 路径，读取作为基线（有上游时）
  - **cli** → [cli-driven-development](../cli-driven-development/SKILL.md)（Skill-invoke 委托，不读取上游）

  ### Rule: Mode Selection

  <HARD-GATE>
  启动时，在任何其他动作之前（在读取 plan 之前、setup 之前、任何接触 repo 的 tool call 之前），使用 `AskUserQuestion` 让用户选择模式（in-session | subagent | cli）。不接受来自先前 skill handoff 的预选模式——编排器必须直接询问。选择后，调用 `cdd-session-activate.mjs minimal <session_key> <repo_root> --mode <mode>` 写入 `pending.mode`。
  </HARD-GATE>

  <HARD-GATE>
  CLI 模式选定后，本 session 禁止使用 Write/Edit 工具修改仓库交付物（所有 git-tracked 文件及 skill 产物）。
  所有代码变更必须通过 cdd-task.mjs H6 chain 执行。发现违规立即停止并报告用户。
  </HARD-GATE>

  ### Rule: Task Complexity

  先分类每个 task：涉及 1-2 个文件 + 机械性实施 → **Simple**；3+ 个文件 / 跨模块 / 需要设计判断 / 用户要求彻底 → **Complex**。影响 diff 范围、测试门控、模型层级。

  ### Rule: Confirm Once

  spec+plan 完成 → 最低档实施层；在第一次 dispatch 前确认一次。

  ### Rule: Fix Loop

  `CHANGES_REQUESTED` → 修复 → 范围 review → 重复直到 `APPROVED` 或 **5 轮**（超过 → STOP + 上报）。

  ### Rule: Confirm Seams

  在 dispatch tdd implement worker 之前，编排器在 session 中与用户确认测试边界（seam），将确认结果 `CONFIRMED_SEAMS: <...>` 写入 task brief。cli 模式是 fire-and-forget print-mode CLI，不能阻塞——`templates/cdd/implement.md` 应用非阻塞方式（"若 brief 含 `CONFIRMED_SEAMS`，则应用"），seam 确认专属于编排器层。

  ### Rule: Per-Task Review

  <HARD-GATE>
  每个 task 实施完成后，必须读取 `$CDD_HANDOFF_PATH`（handoff.json）执行 Per-Task Review 门控，
  判定 APPROVED 后才可写入 ledger 并推进下一 task。
  禁止跳过 handoff 读取直接进入下一 task 或编译验证。适用于 in-session / subagent / cli 全部模式。
  </HARD-GATE>

  Per-task review 门控：由 handoff.json 驱动（plan_conflicts → STOP；CHANGES_REQUESTED → Fix Loop；NEEDS_CONTEXT/unverifiable → STOP）。cli 模式 worker review 在 CLI 子进程内运行；in-session/subagent 模式 review 门控在 session 中运行。规程见 [controller-handoff.md](../../docs/controller-handoff.md) H1-H5。

  ### Rule: Quality Invariants

  1. 测试证据门控（task-N-test-evidence.json）
  2. plan_conflicts[] → 人工裁决
  3. unverifiable[] 非空 → BLOCKED
  4. handoff NEEDS_CONTEXT → STOP

  ### Rule: Orchestrator Checklist

  编排器的三阶段循环（三种模式共用骨架；Per-task 中注明 cli 模式差异）：

  **Setup（一次）：** in-session/subagent → `sdd-workspace`；cli → 委托 workspace 给 [cli-driven-development](../cli-driven-development/SKILL.md)（内置在 cdd-task.mjs H6 chain 中）。统一后续：ledger → 读取 plan 一次 → `plan-constraints.md` → pre-flight → 逐 task todo。

  **Per-task：** Rule: Task Complexity → Rule: Confirm Once → Rule: Confirm Seams（tdd implement dispatch 之前）→ 在 brief 追加 `TASK_BASE: <sha>` → 执行链（cli 模式 shell H6 chain：implement → review → fix per Rule: Fix Loop；in-session/subagent 模式 session 内实施 + review）→ 仅读取 `handoff.json` → Rule: Per-Task Review + Rule: Quality Invariants → `APPROVED` → ledger。cli 模式本 session **绝不**编辑仓库交付物——仅 H6 CLI。

  **Final：** [osuperpowers:code-review](../code-review/SKILL.md) whole-branch in-session → clean → [osuperpowers:finishing](../finishing/SKILL.md)。

  ### Rule: D6 Aggregation

  所有 task APPROVED 后，聚合 deferred items（grep `deferred` 子字符串，含无 jq 的回退行 `deferred not enumerated -- jq missing`）→ **呈现给用户** → **用户决策门控**（全部 defer / 指定要修复的）→ 若要求修复则**有限最终修复波（一次 pass）**：一个 fix agent + 范围 re-review。

  结束语义：
  - re-review 通过 → 完成，handoff `status` 保持 `APPROVED`（**不重写**），ledger 保留完整行（可追加注明修复了 K 项的行）
  - 暴露新 blocker → 仍是一次修复波，然后**无条件向用户报告**（通过与否均报告）——**无跨 task 修复循环**；剩余项目不静默丢弃，报告结束
  - **5 轮上限仅适用于单 task 修复循环，不适用于跨 task 最终修复波**

  Mode B：run 结束后用户读取 ledger 以聚合 deferred；shell 侧在 run 结束时无额外打印。

  ### Rule: Ledger

  仅 `APPROVED` 向 `CDD_LEDGER` 追加 `Task N: complete`。

  ## Red Flags

  - "CLI 可用所以跳过模式选择" → 三种模式都必须询问（Rule: Mode Selection）
  - "in-session 也使用 cdd-task.mjs" → in-session 是 session 内实施，无 CLI（Rule: Read Upstream）
  - "把编排器决策塞入 cli-driven-development" → 引擎只处理执行（Rule: Read Upstream — cli branch）
  - "用户已在 writing-plans handoff 中选择了 subagent/inline" → Mode Selection 是 HARD-GATE，必须直接询问（Rule: Mode Selection）
  - "不调用 AskUserQuestion 就开始执行" → Mode Selection 必须是第一个动作，在任何 repo tool call 之前（Rule: Mode Selection）
  - "从有先前模式选择的状态加载" → session 恢复时有缓存模式仍须调用 AskUserQuestion（Rule: Mode Selection）
  - "使用 superpowers:subagent-driven-development / superpowers:executing-plans" → 上游 superpowers:* 引用必须显式映射到 osuperpowers 对应项
  - "CLI 模式下使用 Write/Edit 修改仓库交付物" → 违反 HARD-GATE Mode Selection（CLI 禁止内联编辑），通过 cdd-task.mjs 执行
  - "实施完成后直接进入下一 task 或编译验证" → 违反 HARD-GATE Per-Task Review（门控），必须先读 `$CDD_HANDOFF_PATH`
  - "实施完以后把 Per-Task Review 当成 3-pass review 来跑" → Per-Task Review 是 handoff.json 读取门控，不是 docs-review.md 的 3-pass review
  - "Fix Loop 也要遵循 docs-review.md 停止机制" → Fix Loop 是 task-review（APPROVED/CHANGES_REQUESTED），不使用 docs-review.md
  ```

- [ ] **Step 4: Self-check**

  Verify against spec Section 2.5:
  - SKILL.md has NO Chinese content
  - Top-level HARD-GATE (Mode Selection startup constraint) present in English
  - Rule: Mode Selection has embedded CLI-prohibits-inline-editing HARD-GATE (English) (#163-③)
  - Rule: Per-Task Review has embedded Per-Task Review gate HARD-GATE (English) (#163-④)
  - Rule: Fix Loop does NOT reference docs-review.md
  - Checklist 6 items (English)
  - 11 Rules retained
  - Red Flags: 7 original + 4 new (CLI inline editing / Per-Task skip / Per-Task vs 3-pass confusion / Fix Loop vs docs-review confusion) = 11
  - zh-CN file is full Chinese translation

- [ ] **Step 5: Run partial validation**

  ```bash
  cd /Users/kang/Projects/oscaner-skills && fnm use && pnpm run test
  ```
  Expected: engine tests pass

- [ ] **Step 6: Commit**

  ```bash
  git add packages/osuperpowers/skills/executing-plans/SKILL.md packages/osuperpowers/skills/executing-plans/SKILL.zh-CN.md
  git commit -m "feat: rewrite executing-plans/SKILL.md (English-only) and sync zh-CN mirror (#163)"
  ```

---



**Files:**
- Rewrite: `packages/osuperpowers/skills/brainstorming/SKILL.md`

**Interfaces:**
- Consumes: 现有 brainstorming/SKILL.md（7 条 Rules，5 条 Red Flags）
- Produces: 统一骨架重写版本；顶层 HARD-GATE（10 步流程型）+ Checklist（10 项）+ 7 条精简 Rules（引用路径更新为 docs-review.md）+ 10 条 Red Flags

- [ ] **Step 1: 读取现有文件**

  Read `packages/osuperpowers/skills/brainstorming/SKILL.md`，记录现有 7 条 Rules 名称和 5 条 Red Flags（用于自检对照）。

- [ ] **Step 2: 写入重写版本**

  完整替换文件（Write）：

  ```markdown
  ---
  name: brainstorming
  description: Independent brainstorm orchestrator -- Reads upstream superpowers:brainstorming as baseline, layers personal rules (grilling clarification / overall+phase / cli review passes). Callable standalone; triggered by /brainstorming via overrides router.
  ---

  # Osuperpowers Brainstorming

  Full brainstorm flow orchestration, callable standalone.

  <HARD-GATE>
  触发 brainstorming 后，必须按序完成以下全部步骤，
  无论改动规模大小、输入是否已含方案、是否已有 issue 描述：

  1. 读取上游 superpowers:brainstorming SKILL.md（Rule: Read Upstream）
  2. 读取 grilling SKILL.md（Rule: Read Sub-Skills）
  3. Explore project context（文件、文档、近期 commits）
  4. Grilling——逐一追问，每次只问一个问题
  5. 提出 2-3 个方案，含 trade-off 与推荐
  6. 逐节呈现设计，每节获得用户确认
  7. 写入 design doc
  8. 3-pass Spec Review via CLI（Rule: Spec Review via CLI）
  9. 用户审阅 spec，按需迭代
  10. 移交 osuperpowers:writing-plans（Rule: Next-Step Routing）

  在步骤 6（design 用户批准）完成前，禁止任何实施行动。
  </HARD-GATE>

  ## Checklist

  1. 读取上游 superpowers:brainstorming SKILL.md（Rule: Read Upstream）
  2. 读取 grilling SKILL.md（Rule: Read Sub-Skills）
  3. Explore project context（文件、文档、近期 commits）
  4. Grilling——逐一追问，每次只问一个问题
  5. 提出 2-3 个方案，含 trade-off 与推荐
  6. 逐节呈现设计，每节获得用户确认
  7. 写入 design doc
  8. 3-pass Spec Review via CLI（Rule: Spec Review via CLI）
  9. 用户审阅 spec，按需迭代
  10. 移交 osuperpowers:writing-plans（Rule: Next-Step Routing）

  ## Rules

  ### Rule: Read Upstream

  Read upstream `superpowers:brainstorming` SKILL.md as the process baseline **when available** (claude / cursor has superpowers plugin installed). **Read, not Skill-invoke** (Skill-invoke triggers the router interception).

  Resolve paths (`{plugin-root}` = this plugin's osuperpowers root):
  1. **Sibling plugin root**: claude `$CLAUDE_PLUGIN_ROOT/../superpowers/skills/brainstorming/SKILL.md` (same for cursor)
  2. **Fallback same-repo relative path**: `<repo-root>/vendors/superpowers/skills/brainstorming/SKILL.md`

  Upstream unavailable (non-claude harness / superpowers plugin not installed) → **no error**: execute this skill's own Rules as the complete flow directly.

  ### Rule: Read Sub-Skills

  **Must** read `mattpocock-skills` `skills/productivity/grilling/SKILL.md` (mandatory step — clarification question delegation).
  On failure (file not found / read error) → **report error + ask the user for next steps**; user may skip grilling and continue, or abort the flow.
  Load failure protocol: see [subagent-lifecycle.md](../docs/subagent-lifecycle.md#rule-delegate-load-failure).

  ### Rule: Research Delegation

  When the explore-context phase discovers questions requiring primary source research (upstream API behavior, harness CLI specs, package internals, cross-harness differences):

  1. **Identify + ask the user**: list questions, ask "trigger research?" — user confirms → spawn; user declines → skip, normal flow continues (explore-context → grilling)
  2. **Spawn background agent**: one mattpocock-skills:research agent per question (parallel). Prompt = question + cite sources instruction.
  3. **Continue explore-context** (code exploration is not interrupted)
  4. **Wait for completion** before entering grilling
  5. **Output**: findings written to `docs/research/YYYY-MM-DD-<topic>.md`
  6. **Consumption**: research findings referenced as primary sources in grilling + approach selection + design

  Trigger failure (research agent error/timeout) → log stderr, do not block flow (fail-open).

  ### Rule: Overall-Phase

  Large requirements (>=3 subsystems / multi-phase / overhaul) write an overall spec first, then phase out. Document structure: see [overall-phase-spec-template.md](../docs/overall-phase-spec-template.md). GATE: overall approval != phase started.

  ### Rule: Spec Review via CLI

  Spec review has 3 pass types (completeness / consistency&scope / clarity&YAGNI), each pass dispatches a fresh `cdd-review`:
    cdd-review --harness claude --template spec-review --param PASS=<completeness|consistency|clarity> --param DOC=<path>
  Dispatch discipline: see [docs-review.md](../docs/docs-review.md) (D1/D2/D3 + fresh-pass, mapped verbatim to cli). Stopping: Rule: Review Stopping in docs-review.md. Handoff output: Rule: Handoff Output in docs-review.md `[Engine pending P2]`.

  ### Rule: Next-Step Routing

  After brainstorming completes, invoke **`osuperpowers:writing-plans`** (not upstream `superpowers:writing-plans`). The osuperpowers wrapper adds section-by-section writing, cli review passes, and ticket publish redirect on top of the upstream baseline.

  ### Rule: Write Design Doc

  Spec saved to `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`, after user review → writing-plans.

  ## Red Flags

  - "Skill-invoke upstream brainstorm" → Read instead of Skill-invoke (Rule: Read Upstream)
  - "Skip design for simple projects" → every project goes through design (HARD-GATE 流程型 Step 6)
  - "Research auto-triggers without asking user" → user confirmation is a hard gate (Rule: Research Delegation)
  - "Research blocks explore-context" → background parallel (Rule: Research Delegation)
  - "Invoke writing-plans / superpowers:writing-plans" → invoke **`osuperpowers:writing-plans`** (Rule: Next-Step Routing)
  - "输入已含方案，跳过 grilling 直接设计" → 违反 HARD-GATE 流程型 Step 4
  - "改动简单，跳过 design 直接实施" → 违反 HARD-GATE 流程型 Step 6
  - "Overall 批准后直接开始实施（跳过 Phase brainstorming）" → 违反 HARD-GATE 流程型 Steps 1-10（整个流程）
  - "blocker=0 后自动修复 warn/nit 并重跑 review" → 违反 Rule: Review Stopping（docs-review.md），应呈现给用户，用户决策后视需求决定是否重跑
  - "为获取 warn/nit 内容额外发起新的 cdd-review 调用" → 违反 Rule: Review Stopping，从本次 3-pass cycle 已有输出读取
  ```

- [ ] **Step 3: 自检**

  对照 spec Section 2.3 验证：
  - 顶层 HARD-GATE 存在，包含 10 步流程，末行"在步骤 6 完成前禁止任何实施行动"
  - Checklist 10 条与 HARD-GATE 一致
  - 7 条 Rules 保留（Rule 体内无步骤列举过程描述）
  - Rule: Spec Review via CLI 引用 `docs-review.md`（非 review-dispatch.md）
  - 新增 Red Flags：输入已含方案 / 改动简单 / Overall 批准后直接实施 / Review Stopping × 2
  - 原有 5 条 Red Flags 保留（共 5 条原有 + 5 条新增 = 10 条）

- [ ] **Step 4: 运行局部验证**

  ```bash
  cd /Users/kang/Projects/oscaner-skills && fnm use && pnpm run test
  ```
  预期：engine tests 全绿

- [ ] **Step 5: Commit**

  ```bash
  git add packages/osuperpowers/skills/brainstorming/SKILL.md
  git commit -m "feat: rewrite brainstorming/SKILL.md with unified skeleton and HARD-GATE (#162)"
  ```

---

### Task 5: emit + 全量 validate + changeset

**Files:**
- Regenerate: `.agents/skills/osuperpowers/brainstorming/SKILL.md`
- Regenerate: `.agents/skills/osuperpowers/writing-plans/SKILL.md`
- Regenerate: `.agents/skills/osuperpowers/executing-plans/SKILL.md`

**Interfaces:**
- Consumes: Tasks 1-4 修改的所有源文件
- Produces: 更新后的 .agents/ 派生文件；validate 全绿；changeset

- [ ] **Step 1: 运行 emit**

  ```bash
  cd /Users/kang/Projects/oscaner-skills && fnm use && pnpm run emit
  ```
  预期：无报错，.agents/skills/osuperpowers/ 下对应文件更新

- [ ] **Step 2: 运行 emit:check 确认无 drift**

  ```bash
  pnpm run emit:check
  ```
  预期：exit 0

- [ ] **Step 3: 运行完整 validate**

  ```bash
  pnpm run validate
  ```
  预期：全绿（12 个 validation blocks 全部通过）

- [ ] **Step 4: 抽查派生文件**

  Read `.agents/skills/osuperpowers/brainstorming/SKILL.md`，确认顶层 HARD-GATE 存在。
  Read `.agents/skills/osuperpowers/executing-plans/SKILL.md`，确认 Rule: Mode Selection 内嵌 CLI 禁止内联编辑 HARD-GATE，Rule: Per-Task Review 内嵌门控 HARD-GATE。

- [ ] **Step 5: 创建 changeset（非交互式）**

  `pnpm run changeset` 是交互式 TTY，agentic 模式下直接手写 changeset 文件：

  ```bash
  # 生成随机 slug（如 happy-dogs-fix）
  SLUG=$(node -e "process.stdout.write(require('crypto').randomBytes(4).toString('hex'))")
  cat > /Users/kang/Projects/oscaner-skills/.changeset/${SLUG}.md << 'EOF'
  ---
  "@oscaner/osuperpowers": patch
  ---

  fix: rewrite brainstorming/writing-plans/executing-plans SKILL.md with unified skeleton and HARD-GATE; rename review-dispatch.md to docs-review.md with Rule: Review Stopping and Rule: Handoff Output (#156 #162 #163)
  EOF
  ```

- [ ] **Step 6: Commit**

  ```bash
  git add .agents/ .changeset/
  git commit -m "chore: regenerate .agents/ derived skill files and add changeset for P1 SKILL.md rewrites"
  ```
