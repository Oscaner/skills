# os-engineering P2 实施计划：os-* 家族抽离（核心集）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 os-engineering 新增 os-\* 家族（8 个独立流程编排器），spor-\* 同步瘦身成薄指针，gate 增加模式感知，cdd implement 加 seam 门。

**Architecture:** 每个 os-\* 技能 = 「Resolve `{superpowers-plugin-root}` → Read 上游 superpowers SKILL.md → 按序 Read 子技能 → 应用个人规则」的独立编排器（**Read 而非 Skill-invoke**，避免 spor 拦截）。spor-\* 薄指针 body 一行 `invoke Skill(os-<X>)` 转发。gate 读 `pending.mode`（in-session|subagent|cli）：cli 严格、其余放行 repo 编辑。tdd 直映 mattpocock（seam 门折进 cdd implement）。

**Tech Stack:** Markdown、Bash、JSON；验证命令 `pnpm run validate`

## Global Constraints

- os-\* 核心集审计（**不做 1:1 对齐**）：8 技能，无 os-testing
- 语义规则名 `### Rule: <Name>` + `#rule-<kebab>` 链接；跨技能引用 markdown 链接 `[Rule: <Name>](../<skill>/SKILL.md#rule-<kebab>)`
- spor-\* 薄指针：frontmatter 保留 4 触发描述 + body 一行 `invoke Skill(os-<X>)`
- gate 模式感知：`pending.mode`（in-session|subagent|cli），cli 严格 / in-session+subagent 放行 repo 编辑，无 mode fail-open
- 过渡期 `pnpm run validate` 每任务后必须 ALL PASS；零 sdd 残留（既有 5c 检查）
- 提交信息 conventional commits，无 attribution/co-author trailer

---

## File Map

| 文件 | 操作 | Task |
|------|------|------|
| `plugins/os-engineering/docs/subagent-lifecycle.md` | Create（自 spor-subagent-lifecycle 降级） | T1 |
| `plugins/os-engineering/docs/review-dispatch.md` | Create（自 spor-token-efficient-review-dispatch 降级） | T1 |
| `plugins/os-engineering/docs/overall-phase-spec-template.md` | Create（自 spor-brainstorming 模板迁移） | T1 |
| `plugins/os-engineering/skills/os-brainstorming/SKILL.md` | Create | T2 |
| `plugins/os-engineering/skills/os-writing-plans/SKILL.md` | Create | T2 |
| `plugins/os-engineering/skills/os-executing-plans/SKILL.md` | Create | T3 |
| `plugins/os-engineering/skills/os-finishing/SKILL.md` | Create | T4 |
| `plugins/os-engineering/skills/os-verification/SKILL.md` | Create | T5 |
| `plugins/os-engineering/skills/os-debugging/SKILL.md` | Create | T5 |
| `plugins/os-engineering/skills/os-code-review/SKILL.md` | Create | T5 |
| `plugins/os-engineering/skills/os-report-issue/SKILL.md` | Create | T6 |
| `plugins/os-engineering/templates/cdd/implement.md` | Modify（seam 门） | T7 |
| `plugins/superpowers-overrides/bin/cdd-session-activate.sh` | Modify（pending.mode） | T8 |
| `plugins/superpowers-overrides/bin/lib/cdd-orchestrator-gate.sh` | Modify（读 pending.mode） | T8 |
| `plugins/superpowers-overrides/tests/sdd-gate-allow-deny-smoke.sh` | Modify（mode fixture） | T8 |
| `plugins/superpowers-overrides/skills/spor-{brainstorming,writing-plans,subagent-driven-development,finishing-a-development-branch,receiving-code-review,systematic-debugging,verification-before-completion,report-issue}/SKILL.md` | Modify（薄指针） | T9 |
| `plugins/superpowers-overrides/skills/spor-executing-plans/SKILL.md` | Modify（映射 os-executing-plans） | T9 |
| `plugins/superpowers-overrides/skills/spor-using-git-worktrees/SKILL.md` | Modify（薄指针→os-finishing） | T9 |
| `plugins/superpowers-overrides/skills/spor-test-driven-development/SKILL.md` | Modify（映射 mattpocock tdd） | T9 |
| `plugins/superpowers-overrides/skills/spor-sdd-p0-fallback/SKILL.md` | Delete | T9 |
| `plugins/superpowers-overrides/skills/spor-subagent-lifecycle/SKILL.md` | Delete（内容已迁 docs） | T9 |
| `plugins/superpowers-overrides/skills/spor-token-efficient-review-dispatch/SKILL.md` | Delete（内容已迁 docs） | T9 |
| `plugins/os-engineering/tests/rule-reference.test.py` | Modify（os-* 语义校验） | T10 |
| `scripts/ci-validate.sh` | Modify（os-* 步骤） | T10 |

---

### Task 1: cross-cutting docs + overall/phase 模板迁移

**Files:**
- Create: `plugins/os-engineering/docs/subagent-lifecycle.md`
- Create: `plugins/os-engineering/docs/review-dispatch.md`
- Create: `plugins/os-engineering/docs/overall-phase-spec-template.md`

**Interfaces:**
- Consumes: 无
- Produces: os-* 技能引用的跨切面参考文档（os-brainstorming/os-writing-plans 的评审 passes 规则、os-brainstorming 的 overall+phase 规则）

- [ ] **Step 1: 创建 `docs/subagent-lifecycle.md`**

从 `plugins/superpowers-overrides/skills/spor-subagent-lifecycle/SKILL.md` 提取内容（fresh subagent per pass、concurrent iff independent），改写为语义规则名文档：

```markdown
# Subagent Lifecycle

跨切面参考：被 os-* 技能的评审 passes 规则引用。

## Rules

### Rule: Fresh Subagent Per Pass

每次评审 pass 派发一个 fresh subagent，不复用前序 pass 的 agent。原因：避免评审者被前一轮输出锚定。

### Rule: Concurrent iff Independent

多个 pass 仅在相互独立（无数据依赖，即不读前序 pass 的输出）时并发。有依赖则串行。

## Red Flags
- 「复用上一个 reviewer，上下文热」→ fresh subagent 是令牌效率与客观性的平衡（Rule: Fresh Subagent Per Pass）
```

- [ ] **Step 2: 创建 `docs/review-dispatch.md`**

从 `plugins/superpowers-overrides/skills/spor-token-efficient-review-dispatch/SKILL.md` 提取 D1/D2/D3，改写为语义规则名：

```markdown
# Review Dispatch

跨切面参考：多 pass 评审的派发纪律（D1/D2/D3）。被 os-brainstorming / os-writing-plans 的评审 passes 规则引用。

## Rules

### Rule: D1 Escalate-on-Finding

Pass 1 独立先跑。零发现 + 明确扫描清单 → 后续 pass 跳过；否则修复后并发跑后续 pass。

### Rule: D2 Delta Review

中间 pass 只收前一 pass 修复后的变更部分；最终 pass 收全文（全局一致性检查需要跨节可见）。

### Rule: D3 Findings-Only Output

评审 prompt 必须要求 findings-only（无总结、无正面评论）。输出 schema：`{findings: [{lens, severity, section, line?, summary, fix, deferred?}]}`。空数组 = approve。

**Severity 行为锚点：**
- `blocker` — 合并前必须修复（正确性 / 契约违反）
- `warn`/`nit` — 可延期 minor，**必须无条件带 `deferred: true`**
- warn/nit → 结果 `APPROVED` + deferred: true；blocker → `CHANGES_REQUESTED`（不空转 APPROVED）
```

- [ ] **Step 3: 创建 `docs/overall-phase-spec-template.md`**

复制 `plugins/superpowers-overrides/skills/spor-brainstorming/overall-phase-spec-template.md` → `plugins/os-engineering/docs/overall-phase-spec-template.md`（内容原样，文档结构唯一权威）。

- [ ] **Step 4: 提交**

```bash
git add plugins/os-engineering/docs
git commit -m "docs: add cross-cutting reference docs + overall/phase template to os-engineering"
```

> 注：`spor-subagent-lifecycle` / `spor-token-efficient-review-dispatch` 的 SKILL.md **此时保留**（T9 再删），避免 T1 单独删时 rule-reference 校验挂（仍有其他 spor-* 引用它们）。

---

### Task 2: os-brainstorming + os-writing-plans（统一骨架样板）

**Files:**
- Create: `plugins/os-engineering/skills/os-brainstorming/SKILL.md`
- Create: `plugins/os-engineering/skills/os-writing-plans/SKILL.md`

**Interfaces:**
- Consumes: T1 docs（overall-phase-spec-template / review-dispatch / subagent-lifecycle）
- Produces: 两个 os-\* 技能，确立「Read 上游 + 个人规则」统一骨架，供 T3-T6 复用

- [ ] **Step 1: 创建 `plugins/os-engineering/skills/os-brainstorming/SKILL.md`**

```markdown
---
name: os-brainstorming
description: 独立 brainstorm 流程编排器 —— Read 上游 superpowers:brainstorming 作为基线，叠加个人规则（grilling 澄清 / overall+phase / fresh-subagent 评审 passes）。可独立调用；被 /brainstorming 的 spor 薄指针转发。
---

# Osuperpowers Brainstorming

完整 brainstorm 流程编排，可独立调用。

## Rules

### Rule: Read Upstream

Resolve `{superpowers-plugin-root}`（优先 `$CLAUDE_PLUGIN_ROOT/../superpowers`，回退 repo 同级 `plugins/superpowers`，两者皆无 → 报错 + 提示解析路径）。Read `skills/brainstorming/SKILL.md` 作为流程基线。**Read 而非 Skill-invoke**（Skill-invoke 会触发 spor 拦截）。

### Rule: Read Sub-Skills

按需 Read `mattpocock-skills` 的 `skills/productivity/grilling/SKILL.md`（澄清问题委派）。

### Rule: Overall-Phase

大需求（≥3 子系统 / 分几期 / overhaul）先写 overall spec，再分阶段。文档结构见 [overall-phase-spec-template.md](../docs/overall-phase-spec-template.md)。GATE：overall 批准 ≠ 阶段已启动。

### Rule: Fresh-Subagent Review Passes

写出的 spec 用 fresh subagent 评审 passes（Completeness → Consistency & scope → Clarity & YAGNI），派发纪律见 [review-dispatch.md](../docs/review-dispatch.md) + [subagent-lifecycle.md](../docs/subagent-lifecycle.md)。

### Rule: Write Design Doc

spec 存 `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`，用户审阅后 → writing-plans。

## Red Flags

- 「Skill-invoke 上游 brainstorm」→ Read 而非 Skill-invoke（Rule: Read Upstream）
- 「简单项目跳过设计」→ 每个项目都过设计（上游流程要求）
```

- [ ] **Step 2: 创建 `plugins/os-engineering/skills/os-writing-plans/SKILL.md`**

```markdown
---
name: os-writing-plans
description: 独立写计划流程编排器 —— Read 上游 superpowers:writing-plans 作为基线，叠加个人规则（逐节写 / fresh-subagent 评审 passes / to-tickets 发布重定向）。
---

# Osuperpowers Writing-Plans

完整写计划流程编排，可独立调用。

## Rules

### Rule: Read Upstream

Resolve `{superpowers-plugin-root}`（同 os-brainstorming Rule: Read Upstream），Read `skills/writing-plans/SKILL.md` 作为基线。**Read 而非 Skill-invoke**。

### Rule: Read Sub-Skills

按需 Read `mattpocock-skills` 的 `skills/engineering/to-tickets/SKILL.md`（ticket 拆分 Steps 1-4）。

### Rule: Section-by-Section

计划逐节 Write/Edit（一个 section 一次工具调用），不整篇一次性生成。

### Rule: Fresh-Subagent Review Passes

计划用 fresh subagent 评审 passes（Completeness & spec alignment → Task decomposition → Buildability & type consistency），纪律见 [review-dispatch.md](../docs/review-dispatch.md)。

### Rule: Tickets Publish Redirect

ticket 拆分后发布到本地单文件 `docs/superpowers/tickets/YYYY-MM-DD-<feature>-tickets.md`（不发布远程 tracker）。

## Red Flags

- 「整篇一个 Write」→ 逐节写（Rule: Section-by-Section）
- 「tickets 发 GitHub」→ 本地单文件（Rule: Tickets Publish Redirect）
```

- [ ] **Step 3: 提交**

```bash
git add plugins/os-engineering/skills/os-brainstorming plugins/os-engineering/skills/os-writing-plans
git commit -m "feat: add os-brainstorming + os-writing-plans standalone orchestrators"
```

---

### Task 3: os-executing-plans（三模式总编排器）

**Files:**
- Create: `plugins/os-engineering/skills/os-executing-plans/SKILL.md`

**Interfaces:**
- Consumes: cli-driven-development（cli 模式委托）、T1 docs
- Produces: 总编排器 —— 编排器控制器 Rules 1-8 + 三模式分派；spor-subagent-driven-development / spor-executing-plans 薄指针（T9）指向此

- [ ] **Step 1: 创建 `plugins/os-engineering/skills/os-executing-plans/SKILL.md`**

```markdown
---
name: os-executing-plans
description: 独立执行计划总编排器 —— 用户选择执行模式（in-session / subagent / cli），编排器控制器 Rules 1-8 三模式共用。cli 模式委托 cli-driven-development；in-session/subagent 模式 Read 上游对应技能驱动。
---

# Osuperpowers Executing-Plans

执行书面计划的总编排器。三种模式由用户选择。

## Rules

### Rule: Read Upstream

按用户所选模式 Read 上游：
- **in-session** → `{superpowers-plugin-root}/skills/executing-plans/SKILL.md`
- **subagent** → `{superpowers-plugin-root}/skills/subagent-driven-development/SKILL.md`
- **cli** → [cli-driven-development](../cli-driven-development/SKILL.md)（Skill-invoke 委托，不 Read 上游）

### Rule: Mode Selection

启动时用 `AskUserQuestion` 让用户选模式（in-session | subagent | cli）。选定后调 `cdd-session-activate.sh minimal <session_key> <repo_root> --mode <mode>` 写 `pending.mode`。

### Rule: Task Complexity

每任务先分类：触及 1-2 文件 + 机械实现 → **Simple**；3+ 文件 / 跨模块 / 需设计判断 / 用户要求彻底 → **Complex**。影响 diff scope、测试门、model 层级。

### Rule: Confirm Once

spec+plan 完备 → 最便宜 implementer 层级；首次派发前确认一次。

### Rule: Fix Loop

`CHANGES_REQUESTED` → fix → scoped review → 重复直到 `APPROVED` 或 **5 轮**（超限 STOP + 升级）。

### Rule: Per-Task Review

每任务评审门：读 handoff.json 驱动（plan_conflicts → STOP；CHANGES_REQUESTED → Fix Loop；NEEDS_CONTEXT/unverifiable → STOP）。cli 模式 worker review 在 CLI 子进程内；in-session/subagent 模式评审门在会话内。

### Rule: Quality Invariants

1. 测试证据门（task-N-test-evidence.json）
2. plan_conflicts[] → 人为裁决
3. unverifiable[] 非空 → BLOCKED
4. handoff NEEDS_CONTEXT → STOP

### Rule: D6 Aggregation

全任务 APPROVED 后聚合 deferred → 用户决策（全部 defer / 点名修）→ 有界一次 final fix 波 + scoped re-review。

### Rule: Ledger

`APPROVED` 才在 `CDD_LEDGER` 追加 `Task N: complete`。

## Red Flags

- 「CLI 可用就跳过模式选择」→ 三模式必须询问（Rule: Mode Selection）
- 「in-session 也走 cdd-run.sh」→ in-session 是会话内实现，不走 CLI（Rule: Read Upstream）
- 「把编排器决策塞进 cli-driven-development」→ 引擎只管执行（Rule: Read Upstream 的 cli 分支）
```

- [ ] **Step 2: 提交**

```bash
git add plugins/os-engineering/skills/os-executing-plans
git commit -m "feat: add os-executing-plans 3-mode orchestrator"
```

---

### Task 4: os-finishing（吸收 worktree 拒绝）

**Files:**
- Create: `plugins/os-engineering/skills/os-finishing/SKILL.md`

**Interfaces:**
- Consumes: 无
- Produces: 收尾流程编排器（吸收 spor-finishing-a-development-branch + spor-using-git-worktrees）；spor-finishing-a-development-branch / spor-using-git-worktrees 薄指针（T9）指向此

- [ ] **Step 1: 创建 `plugins/os-engineering/skills/os-finishing/SKILL.md`**

```markdown
---
name: os-finishing
description: 独立收尾流程编排器 —— Read 上游 superpowers:finishing-a-development-branch 作为基线，叠加个人规则（禁 worktree / conventional commit / 无 attribution / Option4 输入 discard）。
---

# Osuperpowers Finishing

开发分支收尾：合并 / PR / 保留 / 丢弃。

## Rules

### Rule: Read Upstream

Resolve `{superpowers-plugin-root}`（同 os-brainstorming Rule: Read Upstream 的解析+报错子句），Read `skills/finishing-a-development-branch/SKILL.md` 作为基线。**Read 而非 Skill-invoke**。

### Rule: No Worktrees

**禁 worktree**（用户策略）。跳过上游 worktree 检测块，用 Standard 4 options（normal-repo 变体）。若意外检测到 worktree 状态 → STOP + 报告用户。跳过上游 Step 6（worktree remove/prune）。

### Rule: Conventional Commits

合并 commit / PR title 遵循 conventional commits；**禁止任何 attribution/co-author/AI-generation 行**（trailers、footers、inline 都不行）。PR body 只用 `## Summary` + `## Test Plan`，不追加 attribution 段。

### Rule: Option4 Typed Discard

Option 4（丢弃分支）要求用户**输入 discard 字面量**确认，不用多选菜单。摩擦是防误删。

## Red Flags

- 「跑一下 worktree 检测也无害」→ 禁 worktree，跳过检测块（Rule: No Worktrees）
- 「PR body 加 Claude attribution 是标配」→ 用户策略禁止（Rule: Conventional Commits）
```

- [ ] **Step 2: 提交**

```bash
git add plugins/os-engineering/skills/os-finishing
git commit -m "feat: add os-finishing with worktree refusal absorbed"
```

---

### Task 5: os-verification + os-debugging + os-code-review（跨切面三件套）

**Files:**
- Create: `plugins/os-engineering/skills/os-verification/SKILL.md`
- Create: `plugins/os-engineering/skills/os-debugging/SKILL.md`
- Create: `plugins/os-engineering/skills/os-code-review/SKILL.md`

**Interfaces:**
- Consumes: 无
- Produces: 三个跨切面流程编排器；spor-verification-before-completion / spor-systematic-debugging / spor-receiving-code-review 薄指针（T9）指向此

- [ ] **Step 1: 创建 `plugins/os-engineering/skills/os-verification/SKILL.md`**

```markdown
---
name: os-verification
description: 独立完成前验证编排器 —— Read 上游 superpowers:verification-before-completion 作为基线，叠加个人规则（pre-claim gate / 软化语言自检）。
---

# Osuperpowers Verification

完成前验证：证据先于断言。

## Rules

### Rule: Read Upstream
Resolve `{superpowers-plugin-root}`（同 os-brainstorming Rule: Read Upstream 的解析+报错子句），Read `skills/verification-before-completion/SKILL.md` 作为基线。**Read 而非 Skill-invoke**。

### Rule: Pre-Claim Gate
任何声称「完成 / 已修 / 通过」的输出前，先调上游验证流程（触发时机 = 模型内部决定「可以说完成了」之前，非输出后拦截）。

### Rule: Softening-Language Self-Check
输出前扫描软化语言：状态类（"should pass"/"looks good"/"appears correct"）、规避类。发现 → 视为未验证声称，补证据。

## Red Flags
- 「简单改动不用验证」→ pre-claim gate 覆盖所有流程（Rule: Pre-Claim Gate）
```

- [ ] **Step 2: 创建 `plugins/os-engineering/skills/os-debugging/SKILL.md`**

```markdown
---
name: os-debugging
description: 独立系统化调试编排器 —— Read 上游 superpowers:systematic-debugging 作为基线，叠加个人规则（无诊断证据不提案 / 委派 diagnosing-bugs）。
---

# Osuperpowers Debugging

系统化调试：证据先于修复提案。

## Rules

### Rule: Read Upstream
Resolve `{superpowers-plugin-root}`（同 os-brainstorming Rule: Read Upstream 的解析+报错子句），Read `skills/systematic-debugging/SKILL.md` 作为基线。**Read 而非 Skill-invoke**。

### Rule: No-Fix-Without-Evidence
修复提案前，当前轮必须有诊断工具输出（Read/Bash/Grep 用于信息收集）或对先前诊断结果的显式引用。否则**拒绝输出修复提案**，先完成根因调查。豁免：用户明确说已知根因。

### Rule: Delegate Diagnosis
诊断循环委派 `mattpocock-skills:diagnosing-bugs`（Skill-invoke），不重实现。

## Red Flags
- 「先猜再验证」→ 无证据不提案（Rule: No-Fix-Without-Evidence）
```

- [ ] **Step 3: 创建 `plugins/os-engineering/skills/os-code-review/SKILL.md`**

```markdown
---
name: os-code-review
description: 独立接收评审反馈编排器 —— Read 上游 superpowers:receiving-code-review 作为基线，叠加个人规则（grilling 澄清 / tdd 委派）。可选调 cli-code-review 派发评审。
---

# Osuperpowers Code Review

处理评审反馈：验证证据、拒绝表演式附和。

## Rules

### Rule: Read Upstream
Resolve `{superpowers-plugin-root}`（同 os-brainstorming Rule: Read Upstream 的解析+报错子句），Read `skills/receiving-code-review/SKILL.md` 作为基线。**Read 而非 Skill-invoke**。

### Rule: Understand
上游 RESPONSE 模式的 UNDERSTAND 步：反馈项不清晰 → 委派 `mattpocock-skills:grilling` 澄清，全部项达成共识才进 VERIFY。

### Rule: Implement
IMPLEMENT 步：每个 fix 委派 `mattpocock-skills:tdd`（红-绿循环）。豁免：纯机械编辑（无行为/schema/config 变化——重命名、空白、注释重排）。可疑时用 TDD。

### Rule: Optional CLI Review
需派发评审时可调 [cli-code-review](../cli-code-review/SKILL.md)（任意 diff 经选定 harness CLI）。

## Red Flags
- 「模糊反馈靠猜」→ grilling 澄清（Rule: Understand）
```

- [ ] **Step 4: 提交**

```bash
git add plugins/os-engineering/skills/os-verification plugins/os-engineering/skills/os-debugging plugins/os-engineering/skills/os-code-review
git commit -m "feat: add os-verification/os-debugging/os-code-review cross-cutting orchestrators"
```

---

### Task 6: os-report-issue（repo 开发工具）

**Files:**
- Create: `plugins/os-engineering/skills/os-report-issue/SKILL.md`

**Interfaces:**
- Consumes: 无
- Produces: repo 开发工具（分析 SDD 会话 + 提 issue）；spor-report-issue 薄指针（T9）指向此

- [ ] **Step 1: 创建 `plugins/os-engineering/skills/os-report-issue/SKILL.md`**

从 `plugins/superpowers-overrides/skills/spor-report-issue/SKILL.md` 迁移内容（会话分析 + 提 GitHub issue），改写为语义规则名：

```markdown
---
name: os-report-issue
description: 分析当前 spor/os 会话的 bug 与增强机会，经 gh CLI 对 Oscaner/skills 提 GitHub issue。repo 开发工具，非常规工作流技能。
---

# Osuperpowers Report Issue

分析 SDD 会话（.superpowers/sdd/*/progress.md + git log）找出 bug 与增强，提 issue。

## Rules

### Rule: Analyze Session
读 `.superpowers/sdd/*/progress.md` ledger + git log，找 bug（deferred 残留、validate 缺口）与增强机会。

### Rule: Offer Issues
用 AskUserQuestion 列出候选，用户选择要提的；经 `gh issue create` 提交（针对 Oscaner/skills）。

### Rule: Keyword Examples
issue 关键字示例用当前工具名（`cdd-run.sh` 而非已删的 `sdd-run-task-*.sh`）。
```

- [ ] **Step 2: 提交**

```bash
git add plugins/os-engineering/skills/os-report-issue
git commit -m "feat: add os-report-issue repo dev tool"
```

---

### Task 7: cdd implement seam 门

**Files:**
- Modify: `plugins/os-engineering/templates/cdd/implement.md`

**Interfaces:**
- Consumes: 无
- Produces: tdd 调用前的 seam 确认门（tdd 直映 mattpocock 后唯一保留的 tdd 个人规则）

- [ ] **Step 1: 修改 `templates/cdd/implement.md`**

在现有「Invoke mattpocock-skills:tdd」指令前，插入 seam 确认门。当前 implement.md 的相关段：

```markdown
2. Invoke **`mattpocock-skills:tdd`** (Read the skill via `agent_skills` fullPath) to implement per the brief.
```

替换为：

```markdown
2. **Confirm seams first (blocking):** Propose the test boundaries — "I'll test at these seams: [X, Y]. Not testing: [Z]. Does this look right?" — and **wait for explicit user approval** before invoking tdd. Silence is not approval. Once approved:
3. Invoke **`mattpocock-skills:tdd`** (Read the skill via `agent_skills` fullPath) to implement per the brief, with the confirmed seams in context.
```

> 后续步骤重编号（原 3-6 → 4-7）。

- [ ] **Step 2: 提交**

```bash
git add plugins/os-engineering/templates/cdd/implement.md
git commit -m "feat: add seam-confirmation gate to cdd implement template"
```

---

### Task 8: gate 模式感知（pending.mode）

**Files:**
- Modify: `plugins/superpowers-overrides/bin/cdd-session-activate.sh`
- Modify: `plugins/superpowers-overrides/bin/lib/cdd-orchestrator-gate.sh`
- Modify: `plugins/superpowers-overrides/tests/sdd-gate-allow-deny-smoke.sh`

**Interfaces:**
- Consumes: 无
- Produces: gate 按 `pending.mode` 放行 —— cli 严格 / in-session+subagent 放行 repo 编辑；os-executing-plans（T3）写 mode，cli-driven-development 无 mode 默认 fail-open

- [ ] **Step 1: `cdd-session-activate.sh` 写 pending.mode**

给 `cdd-session-activate.sh` 增加 `--mode <in-session|subagent|cli>` 参数 **且** 读 `CDD_SESSION_MODE` env（两者都实现，`--mode` 优先；**不用 `CDD_MODE`** —— 那是任务模式契约 implement|review|fix，域冲突；T3 os-executing-plans 调 `--mode`，env 兼容非参数调用），写 pending JSON 时带 `mode` 字段：

```bash
# usage 追加: cdd-session-activate.sh <minimal|bind> <session_key> <repo_root> [--mode <in-session|subagent|cli>]
# pending JSON 增加: "mode": "${CDD_SESSION_MODE:-}"
```

**hook 自动激活保持严格（关键，load-bearing）**：改两个 **render 源** `build/render-hook.sh`（生成 `override-prompt-expansion.sh`）+ `build/render-cursor-hooks.sh`（生成 `override-cursor-detect.sh`），在其 `cdd-session-activate.sh` 调用点补 `--mode cli`（legacy `superpowers:*` 自动激活会话经此保持 cli 严格），再重跑 `pnpm run generate:overrides` 重新生成输出（**不直接手改生成产物**，否则 regenerate 会回退）。

> 无 `--mode` / `CDD_SESSION_MODE` 时 `mode` 字段省略 → **fail-open（spec §E：无 mode / 无 pending 都放行）**。cli 严格仅靠 hook 写 `--mode cli` 保证，故 hook 改动不可省。

- [ ] **Step 2: `cdd-orchestrator-gate.sh` 读 pending.mode**

在 `cdd_gate_decide` 读取 pending 后：

```bash
# 解析 pending.mode（缺省空）。pending 变量已是解析后的 JSON 字符串（非文件路径）。
local mode=""
if command -v jq >/dev/null 2>&1 && [[ -n "$pending" ]]; then
  mode="$(printf '%s' "$pending" | jq -r '.mode // empty' 2>/dev/null || true)"
fi

# 模式感知（spec §E）：
# - mode == cli        → 严格（repo 编辑只走 cdd-run.sh / workspace）
# - mode == in-session / subagent → 放行 repo 编辑（Write/Edit 任何 repo 路径 allow），
#                                  但仍 keep 只读 git Bash 白名单
# - mode 空 / 无 pending → fail-open（allow）
```

放行分支放在现有 Write/Edit 判定之前（mode 命中 in-session/subagent → allow；mode 空 → allow 即 fail-open）。

- [ ] **Step 3: gate mode 测试**

在 `tests/sdd-gate-allow-deny-smoke.sh` 增加 fixture 场景：
- `in-session` pending → Write 到任意 repo 路径 **allow**
- `subagent` pending → Write 到任意 repo 路径 **allow**
- `cli` pending → Write 到 workspace 外 repo 路径 **deny**
- 无 mode 字段 pending → **allow**（fail-open，spec §E）
- 无 pending → allow（fail-open）

（fixture 复用现有 `CDD_GATE_FIXTURES_ROOT` 机制。注意：env 变量名是 **`CDD_GATE_FIXTURES_ROOT`**（P1 已从 `SDD_GATE_FIXTURES_ROOT` 改名）。**pending 文件需完整 JSON**（fresh detected_at、repo_root、session_key、trigger、mode）—— 裸 `{"mode": ...}` 缺 detected_at/repo_root 会被 gate 视为过期/缺失而 allow，断言全部失效。建议直接调 `cdd-session-activate.sh minimal <key> <root> --mode <mode>` 构造，或写全字段。）

- [ ] **Step 4: 运行 gate 测试 + validate**

```bash
./plugins/superpowers-overrides/tests/sdd-gate-allow-deny-smoke.sh
pnpm run validate
```

预期：gate smoke（含新增 mode 场景）+ validate ALL PASS。

- [ ] **Step 5: 提交**

```bash
git add plugins/superpowers-overrides/bin/cdd-session-activate.sh plugins/superpowers-overrides/bin/lib/cdd-orchestrator-gate.sh plugins/superpowers-overrides/tests/sdd-gate-allow-deny-smoke.sh
git commit -m "feat: gate mode-awareness via pending.mode (in-session/subagent relax, cli strict)"
```

---

### Task 9: spor-* 薄指针 + 映射 + cross-cutting 删除

**Files:**
- Modify（薄指针）: `spor-brainstorming` / `spor-writing-plans` / `spor-subagent-driven-development` / `spor-finishing-a-development-branch` / `spor-receiving-code-review` / `spor-systematic-debugging` / `spor-verification-before-completion` / `spor-report-issue` SKILL.md（均在 `plugins/superpowers-overrides/skills/`）
- Modify（映射）: `spor-executing-plans` / `spor-using-git-worktrees` / `spor-test-driven-development` SKILL.md
- Delete: `spor-sdd-p0-fallback` / `spor-subagent-lifecycle` / `spor-token-efficient-review-dispatch` SKILL.md

**Interfaces:**
- Consumes: T2-T6 os-\* 技能就位、T1 docs
- Produces: overrides 侧只余薄指针/映射（触发拦截经 frontmatter 保留）；rule-reference 双模式通过

- [ ] **Step 1: 8 个被抽离的 spor-* → 薄指针**

对每个 `spor-<X>/SKILL.md`：**保留 frontmatter 完整（4 触发描述 + Applies personal overrides 尾部改为「delegates to os-<Y>」）**，body 整块替换为：

```markdown
# <Title>（薄指针）

## Rules

### Rule: Delegate

invoke Skill(os-<Y>)。本技能为过渡期薄指针，规则内容已移至 os-engineering。

<!-- Additional rules … -->  # 保留插入点注释

## Red Flags
- 「在薄指针里补规则」→ 规则应进 os-<Y>，不是这里

## Common Rationalizations
| Excuse | Reality |
|--------|---------|
| 「薄指针没内容，直接跟进上游」| 规则在 os-<Y>，先转发（Rule: Delegate）|
```

映射：
| spor-* | → os-* |
|---|---|
| spor-brainstorming | os-brainstorming |
| spor-writing-plans | os-writing-plans |
| spor-subagent-driven-development | os-executing-plans |
| spor-finishing-a-development-branch | os-finishing |
| spor-receiving-code-review | os-code-review |
| spor-systematic-debugging | os-debugging |
| spor-verification-before-completion | os-verification |
| spor-report-issue | os-report-issue |

- [ ] **Step 2: 映射型薄指针（executing-plans / using-git-worktrees / tdd）**

- `spor-executing-plans`：body → `invoke Skill(os-executing-plans)`（原重定向存根，直接映射）
- `spor-using-git-worktrees`：body → `invoke Skill(os-finishing)`（规则已并入 os-finishing Rule: No Worktrees）
- `spor-test-driven-development`：body → `invoke Skill(mattpocock-skills:tdd)`（seam 门已折进 cdd implement；frontmatter 保留 4 触发）。**frontmatter description 尾部**「confirms seams with user before starting (blocking)」改为「delegates to mattpocock-skills:tdd; seam confirmation gate lives in templates/cdd/implement.md」

- [ ] **Step 3: 删除 3 个死/已迁移 SKILL**

```bash
cd plugins/superpowers-overrides/skills
git rm -r spor-sdd-p0-fallback spor-subagent-lifecycle spor-token-efficient-review-dispatch
```

> 前提：T2-T6 的 os-\* 引用 docs（非 SKILL），薄指针 body 不引用 cross-cutting → 删除后 rule-reference 不应有悬挂引用。**注意 5 个 frontmatter**：spor-brainstorming / spor-receiving-code-review / spor-systematic-debugging / spor-test-driven-development / spor-writing-plans 的 frontmatter 链接到 spor-subagent-lifecycle Rule 2/3 —— Step 1 保留 frontmatter 时同步清掉这些链接（改指 os-engineering docs/subagent-lifecycle.md 或删除）。

- [ ] **Step 4: 更新硬编码已删技能的校验脚本（blocker）**

3 个校验脚本硬编码 `spor-sdd-p0-fallback` / `spor-subagent-lifecycle` / `spor-token-efficient-review-dispatch`，删除后 `pnpm run validate` 必挂。同步更新：

1. `plugins/superpowers-overrides/tests/validate-overrides-build.sh`（L65「cross-cutting skills exist」、L105）：删/改对三个已删技能的断言
2. `plugins/superpowers-overrides/tests/sdd-orchestrator-line-budget.test.sh`：除删技能引用（L11-12/30/44-45/54），还需处理 **spor-subagent-driven-development 自身 body 断言**（L93-142：Rule 8 D6 提取、Rule 0 checklist、rule-heading 存在、controller-handoff 引用）—— 这些在 Step 1 薄指针化后立即断（L94 提前 exit）。把 spor-SDD 的 D6/Rule 0/rule-heading 断言 repoint 到 `os-engineering/skills/os-executing-plans/SKILL.md`（D6 Aggregation + 编排器 checklist 宿主），并确保锚点匹配 os-executing-plans 措辞
3. `plugins/os-engineering/tests/cdd-severity-contract.test.sh`：L68 是 DISPATCH 段（引 `spor-token-efficient-review-dispatch`，已删）→ repoint 到 `os-engineering/docs/review-dispatch.md`（D3 锚点，见 T1 补全）；**L112-117 section 8 断言 `### Rule 8 — 终盘聚合` 在 spor-subagent-driven-development（Step 1 变薄指针）→ repoint 到 os-executing-plans 的 Rule: D6 Aggregation**（或删除该段断言）
4. `plugins/os-engineering/tests/rule-reference.test.py`：`ALLOWLIST_NUM` 中 2 个 spor-sdd-p0-fallback 死条目（`spor-executing-plans` 5b、`spor-sdd-p0-fallback` 0）删除

**文档清理（同 commit）**：README.md / README.zh-CN.md / `plugins/superpowers-overrides/docs/cross-harness-overrides.md` 删已删技能行（spor-sdd-p0-fallback / spor-subagent-lifecycle / spor-token-efficient-review-dispatch），repo CLAUDE.md「Cross-cutting skills」节改为指向 os-engineering/docs。

- [ ] **Step 5: 运行 rule-reference + validate**

```bash
python3 plugins/os-engineering/tests/rule-reference.test.py --skills os-engineering/skills:semantic superpowers-overrides/skills:numeric
pnpm run validate
```

预期：rule-reference 双模式通过（os-* 语义 + overrides 数字），validate ALL PASS。

- [ ] **Step 6: 提交**

```bash
git add -A plugins/superpowers-overrides/skills
git commit -m "refactor: thin-pointerize extracted spor-* + delete dead cross-cutting skills"
```

---

### Task 10: rule-reference 扩展 + ci-validate + 终检

**Files:**
- Modify: `plugins/os-engineering/tests/rule-reference.test.py`（os-* 语义校验确认/扩展）
- Modify: `scripts/ci-validate.sh`（os-* 技能步骤）
- Modify（可选）: `plugins/os-engineering/tests/cdd-severity-contract.test.sh`（implement.md seam 门断言）

**Interfaces:**
- Consumes: T1-T9 全部就位
- Produces: os-\* 语义规则名通过校验；ci-validate 覆盖 os-\*；validate ALL PASS

- [ ] **Step 1: rule-reference 扩展校验 os-\***

确认 `rule-reference.test.py` 双模式覆盖 `os-engineering/skills:semantic`（P1 已支持），并验证 os-\* 技能的：
- 语义规则标题 `### Rule: <Name>` 解析
- 跨技能链接 `[Rule: <Name>](../<skill>/SKILL.md#rule-<kebab>)` 锚点解析
- 对 os-engineering docs 的 `#rule-<kebab>` 引用（如 os-executing-plans → cli-driven-development）

若有缺失分支（如 os-\* 引用 docs 的锚点未校验），扩展解析器并在 self_test() 加用例。

- [ ] **Step 2: ci-validate.sh 加 os-\* 技能步骤**

在 `scripts/ci-validate.sh` 的「== 5b. os-engineering plugin validation ==」块：目录发现已数全部 SKILL.md（含新 os-\*），只需**加一个数量断言**：

```python
# 断言 os-engineering skills 数 = 12（4 cli-* + 8 os-*）
```

（不改计数逻辑，只加硬断言。）

- [ ] **Step 3: implement.md seam 门测试**

`cdd-severity-contract.test.sh`（或新增模板断言）检查 `templates/cdd/implement.md` 含「Confirm seams first」段，且步骤编号连续（seam 插入后无断号）。

- [ ] **Step 4: 终检（零残留 + ALL PASS）**

```bash
# 迁移引擎零 sdd 残留（既有 5c）
grep -rnE '\b(sdd_|_sdd_|SDD_|sdd-run-)' plugins/os-engineering/bin plugins/os-engineering/templates plugins/os-engineering/docs/cdd-reference.md || echo "OK — zero residue"
pnpm run emit
pnpm run validate
```

预期：ALL PASS（os-* 12 技能解析、rule-reference 双模式、gate mode 测试、seam 门测试全过）。

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "ci: validate os-* semantic rules + seam gate + final all-pass"
```

> 全 plan 完成后：overall v1.5 的 P2 行标完成（Rule 3e ship 时更新 overall + 变更历史）。


---


---


---


---


---


---


---


---


---


---
