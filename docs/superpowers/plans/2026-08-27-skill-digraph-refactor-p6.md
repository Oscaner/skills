# Skill Digraph Refactor — P6: finishing 重构 Implementation Plan

- **Date**: 2026-08-27
- **Spec**: `docs/superpowers/specs/2026-08-27-skill-digraph-refactor-p6-design.md` (v1.0)
- **Overall**: `docs/superpowers/specs/2026-08-24-skill-digraph-refactor-overall.md` (v1.11)
- **Branch**: `skill-digraph-refactor-p6`
- **Author**: [human] · Claude Opus 4.8 (osuperpowers:writing-plans dogfood session)

## Overview

将 `packages/osuperpowers/skills/finishing/SKILL.md` 从 Checklist + Rules 散文 + Red Flags 三重表示重写为节点锚定式（digraph 唯一控制流真相源），同时产出共享文档 `cli-driven-development/docs/base-branch.md`（供 P8 CDD 消费）并同步 finishing 的 zh-CN 镜像。

## Scope

| 任务 | 文件 | 产出类型 |
|---|---|---|
| Task 1 | `packages/osuperpowers/skills/cli-driven-development/docs/base-branch.md` + `.zh-CN.md` | 新建共享文档 |
| Task 2 | `packages/osuperpowers/skills/finishing/SKILL.md` + `SKILL.zh-CN.md` | 重写（节点锚定式）+ 中文镜像 |
| Task 3 | cross-skill anchor 引用 + `pnpm run emit && validate` + 终扫预演 | 扫描 + 验证 + 回归 |

## Global Constraints

- 仓库语言政策：SKILL.md / docs 英文主源 + zh-CN 镜像；本 plan 中文（Strategy B）
- 路径解析 harness-agnostic：不写 `$CLAUDE_PLUGIN_ROOT` 等 harness-specific 变量
- vendored 子模块不可改（`vendors/superpowers/` / `vendors/mattpocock-skills/`）
- **不修改 `cli-driven-development/SKILL.md`**：P6 仅产出共享文档供 P8 消费，不改 CDD 主技能
- 终扫 pattern 必须全部归零（来自 overall spec P10 终扫定义）：`HARD-GATE`、`## Rules`、`## Red Flags`、`## Checklist`、`worktree remove`、`worktree prune`、`Rule: `
- **changeset 策略**：仅 P10 统一建一个 changeset（本 phase 不建）
- CDD execution：通过 `cdd-task.mjs` 派发嵌套 CLI session，不直接执行 plan steps

---

## Task 1: 共享文档 `base-branch.md` 产出（P8 消费）

**目标**：在 `cli-driven-development/docs/` 下新建 `base-branch.md` + `base-branch.zh-CN.md`，作为 finishing（P6）+ CDD（P8）的共享方法论 + artifact schema 文档。

**文件**：
- `packages/osuperpowers/skills/cli-driven-development/docs/base-branch.md`（新建，英文主源）
- `packages/osuperpowers/skills/cli-driven-development/docs/base-branch.zh-CN.md`（新建，中文镜像）

**文档内容（§-by-§）**：

1. **Overview**：文档作用（base 分支推断方法论 + artifact schema）+ 消费方（finishing 的 `read-base` 节点 / CDD 启动阶段）
2. **方法论**：base 分支推断策略（按顺序尝试 3 个来源，取首个可确定 base 的来源）：
   - ① plan 文档的 `base` 字段
   - ② branch upstream：`git rev-parse --abbrev-ref @{u}`
   - ③ 对话上下文（历史消息明确提及的 base）
   - 均无法确定 → 询问用户确认
3. **Artifact Schema**：`.superpowers/<scope>/<slug>/base-branch.json`
   ```json
   {
     "base": "develop",
     "source": "plan-field" | "branch-upstream" | "user-confirmed",
     "confirmed_at": "2026-08-27T..."
   }
   ```
4. **Scope 解析**：
   - CDD-driven 场景：scope = `cdd`，slug = CDD workspace 的 slug
   - Standalone finishing 场景：scope = `standalone`，slug = feature branch 名 sanitize
5. **Slug Sanitize 规则**：lowercase → 非 alphanumeric（`/`、空格、`_`、`.` 等）替换为 `-` → 前后 `-` trim → 连续 `-` 合并 → 截 64 字符。例：
   - `feature/my-branch` → `feature-my-branch`
   - `Bugfix/UI_Fix` → `bugfix-ui-fix`
   - `refs/heads/release-2026.08` → `refs-heads-release-2026-08`
6. **消费方集成**：
   - finishing 的 `read-base` 节点（P6）：读 artifact（fallback 询问用户 → 写入 artifact）
   - CDD 启动阶段（P8）：跑 determine-base → 写入 artifact
   - CDD 的 branch-review：读 artifact 作为 `BASE` 参数（取代 `origin/develop` 硬编码）

**验收**：
- 文档结构完整（6 节）
- artifact schema 字段明确（`base` / `source` / `confirmed_at`）
- sanitize 规则 + 3 个示例
- zh-CN 镜像同步（节对节、schema 对 schema）

**原子 commit**：`docs: add shared base-branch methodology doc under cli-driven-development/docs (P6)`

---

## Task 2: finishing SKILL.md 重写（节点锚定式）

**目标**：将 `packages/osuperpowers/skills/finishing/SKILL.md` 从 Checklist + Rules + Red Flags 三重表示重写为节点锚定式。

**文件**：
- `packages/osuperpowers/skills/finishing/SKILL.md`（重写，英文主源）
- `packages/osuperpowers/skills/finishing/SKILL.zh-CN.md`（重写，中文镜像）

**SKILL.md 结构（§-by-§）**：

1. **Front matter**：
   ```yaml
   ---
   name: finishing
   description: Independent finishing orchestrator -- Node-anchored flow with digraph as single control-flow source of truth. Reads upstream superpowers:finishing-a-development-branch as baseline, layers personal rules (no worktrees / conventional commits / typed-discard). Callable standalone; triggered by /finishing via overrides router.
   ---
   ```

2. **Title + 引子**：`# Osuperpowers Finishing` + "Development branch finishing: merge / PR / keep / discard."

3. **Flow Digraph**（mermaid）：
   ```mermaid
   flowchart TD
     A[read-upstream] -->|loaded| B[verify-tests]
     A -->|missing| Z1((BLOCKED: install superpowers))
     B -->|tests pass| C[read-base]
     B -->|tests fail| Z2((BLOCKED: fix tests))
     C -->|base confirmed| D[present-menu]
     C -->|user refuses| Z3((BLOCKED: base undecided))
     D -->|opt1 merge| E[merge-locally]
     D -->|opt2 pr| F[push-and-pr]
     D -->|opt3 keep| G((APPROVED: keep))
     D -->|opt4 discard| H{typed-discard?}
     D -->|3x unrecognized| Z4((BLOCKED: menu exhausted))
     H -->|typed 'discard'| I[force-delete]
     H -->|other input| D
     E --> J((APPROVED: merged))
     F --> K((APPROVED: pr-created))
     I --> L((APPROVED: discarded))
   ```

4. **Node Definitions**（8 个节点，每节点 Do/Read/Exit/Fail 四要素）：
   - `read-upstream`：读上游 SKILL.md（Read, not Skill-invoke）
   - `verify-tests`：运行测试套件（无测试配置视为通过）
   - `read-base`：读/问 base 分支 + 写入 artifact（scope/slug 解析 + sanitize）
   - `present-menu`：4 选项菜单（累计最多 3 次呈现机会）
   - `merge-locally`：checkout base → merge → verify → auto-delete branch
   - `push-and-pr`：push + 创建 PR（含 Conventional Commits 契约）
   - `force-delete`：前置检查未提交改动 + 数据丢失确认 + `git branch -D`
   - `typed-discard?`：字面量 "discard" 校验（retry counter 与 present-menu 共享）

   **Implementer directive**：每节点的 Do/Read/Exit/Fail 完整内容**必须从 spec §3 Node Definitions 逐字派生**，不可仅依本 plan 的 1 行摘要（plan 摘要不含 resolution fallback、counter-sharing edge case、fail-open 语义等关键细节）。

5. **Invariants**（3 条）：
   - I1: No Worktrees（跳过上游 worktree 检测块与 Step 6 cleanup；菜单固定 normal-repo variant）
   - I2: Conventional Commits + No Attribution（merge commit / PR title 规范 + 无 trailers + PR body 仅 Summary/Test Plan）
   - I3: Read, not Skill-invoke（上游只 Read 文件，不 Skill-invoke）

6. **Failure Modes**（8 条 + Fail-open vs BLOCKED 约定小节）：
   - 4 条 BLOCKED（上游缺失 / tests fail / base undecided / menu exhausted）
   - 4 条 implicit fail-open（merge conflict / merged-result tests fail / push rejected / PR 创建失败）

**SKILL.zh-CN.md 镜像要求**：
- 节对节、节点对节点完全对齐英文主源
- description / front matter 翻译
- mermaid 节点 ID 保持英文（与主源一致）

**验收**：
- 8 个节点 ID 与 digraph 节点一一对应（图正文一致性校验清单——skill-authoring §8 规则 1：节点覆盖）
- 正文每小节标题与某节点 ID 对齐（skill-authoring §8 规则 2：小节对齐）
- 每节点含 Do/Read/Exit/Fail 四要素（skill-authoring §8 规则 3：无独立 Rules 散文堆）
- 无 `## Red Flags` 小节（skill-authoring §8 规则 4：无 Red Flags 小节）
- 3 Invariants 数量 ≤ 5（skill-authoring §4 上限）
- 8 Failure Modes 与 digraph 边对齐

**原子 commit**：`refactor: rewrite finishing to node-anchored format (P6)`（含 zh-CN + cross-skill anchor 更新 + emit 后的 `.agents/` 衍生）

---

## Task 3: cross-skill anchor 更新 + emit + validate + 终扫预演

**目标**：更新所有引用 finishing SKILL.md 旧 anchor 的 cross-skill 引用；运行 emit + validate 保证衍生文件同步；运行终扫 pattern 验证旧格式关键词归零。

### 3.1 cross-skill anchor 引用扫描

**命令**：
```bash
grep -rn 'finishing/SKILL.md#' packages/osuperpowers/skills/
```

**预期**：零匹配（当前无其他 skill deep-link 到 finishing 节点）。

**若发现匹配**：
- 旧 anchor（如 `#rule-no-worktrees`、`#rule-conventional-commits`、`#rule-option4-typed-discard`）→ 映射到新节点 ID（`#invariants` 或具体节点如 `#merge-locally`）
- 若映射无法直接确定（如旧 anchor 指向已删除概念）→ 删除引用或改写为 prose 描述

**本任务为 safety sweep**：预期零匹配，不是 actionable discovery step。

### 3.2 P8 base-branch.json 写入接口检查（defer to P8）

**目的**：检查 `packages/osuperpowers/skills/cli-driven-development/SKILL.md` 是否需要为 `base-branch.json` 写入预留接口（节点 / 占位说明）。

**命令**：
```bash
grep -n 'base-branch\|base branch\|BASE=' packages/osuperpowers/skills/cli-driven-development/SKILL.md
```

**预期**：发现 `Rule: Final Review` 中的 `BASE=<git merge-base origin/develop HEAD>` 硬编码（P8 修复目标）。

**P6 动作**：**不修改** `cli-driven-development/SKILL.md`（P8 负责）。仅在 plan 中显式声明：

> P6 产出共享文档 `base-branch.md` + artifact schema，P8 重构 `cli-driven-development/SKILL.md` 时负责：
> - 新增 CDD 启动 determine-base 步骤（写入 `base-branch.json`）
> - `Rule: Final Review` 的 `BASE` 参数改为读 artifact（移除 `origin/develop` 硬编码）

### 3.3 emit + validate

**命令**：
```bash
pnpm run emit && pnpm run validate
```

**预期**：
- emit freshness check 绿（`pnpm run emit:check` 通过）
- plugin.json skills resolve 绿
- skill dir has SKILL.md 绿
- rule-reference integrity 绿
- engine tests 绿
- version sync 绿

**若失败**：依错误类型分别修复（emit 失败 → 检查 SKILL.md front matter；validate 失败 → 依错误信息定位具体测试）

### 3.4 终扫预演

**命令**（对 `packages/osuperpowers/skills/finishing/` 目录验证旧格式关键词已清零）：

```bash
grep -r 'HARD-GATE' packages/osuperpowers/skills/finishing/
grep -r '## Rules' packages/osuperpowers/skills/finishing/
grep -r '## Red Flags' packages/osuperpowers/skills/finishing/
grep -r '## Checklist' packages/osuperpowers/skills/finishing/
grep -r 'worktree remove' packages/osuperpowers/skills/finishing/
grep -r 'worktree prune' packages/osuperpowers/skills/finishing/
grep -r 'Rule: ' packages/osuperpowers/skills/finishing/
```

**预期**：7 条 grep 全部零匹配。

**若发现匹配**：
- `HARD-GATE` / `## Rules` / `## Red Flags` / `## Checklist` → 节点锚定式重写遗漏，回 Task 2 修复
- `worktree remove` / `worktree prune` → No Worktrees invariant 未完全移除上游 cleanup 步骤，回 Task 2 修复
- `Rule: ` → Rules 散文堆残留，回 Task 2 修复

### 3.5 commit 策略

**原子 commit**：与 Task 2 合并为一个 commit（详见 Execution Strategy：CDD Task 2 = plan Task 2 + Task 3）——cross-skill anchor 更新、emit 衍生、终扫零化均为 Task 2 重写的直接产物，分开 commit 会破坏原子性。

**例外**：若 Task 2 已 commit 后才发现 anchor 引用问题（如 `.agents/` 衍生未包含），允许追加 `chore: sync .agents/ derived files for finishing rewrite` commit。

---

## Acceptance Criteria

对齐 P6 design spec §7：

1. ✅ 符合 skill-authoring.md v1.0（图节点与小节一一对应、无独立 Rules 散文堆、无独立 Red Flags 小节、无 Checklist）
2. ✅ 上游缺失路径为显式 BLOCKED 节点含安装指引
3. ✅ 4 选项显式入 digraph（menu hub + `typed-discard?` decision）
4. ✅ `typed-discard?` 节点要求字面量 `"discard"`（大小写敏感、无前后空白），非字面量输入回退 `present-menu`（共享 3 次呈现计数器）
5. ✅ No-Worktrees 在 Invariants 声明（不在节点）
6. ✅ Conventional Commits + No Attribution 在 Invariants 声明
7. ✅ `merge-locally` 成功后**自动** `git branch -d` feature 分支
8. ✅ `read-base` 节点消费 `base-branch.json` artifact（fallback 询问用户 → 写入 artifact）
9. ✅ 共享文档 `cli-driven-development/docs/base-branch.md` + `.zh-CN.md` 产出（artifact schema + 方法论）
10. ✅ finishing `SKILL.zh-CN.md` 同步
11. ✅ emit + validate 绿
12. ✅ CDD execution: workspace 存在 + 全 task handoff.json + ledger 全 APPROVED + Final Review 产物（`cdd-review.mjs --template branch-review` 的 handoff JSON + findings 列表；产物存在性检查，不要求端到端冒烟）

---

## Execution Strategy

**2 个 CDD task**：

### CDD Task 1：共享文档产出

**对应 plan Task 1**

**Brief 范围**：
- 新建 `packages/osuperpowers/skills/cli-driven-development/docs/base-branch.md`（6 节结构）
- 新建 `.zh-CN.md` 中文镜像

**Task-level review 重点**：
- artifact schema 字段完整性
- sanitize 规则 + 3 个示例
- zh-CN 镜像节对节对齐

### CDD Task 2：finishing 重写 + anchor 更新 + emit + validate + 终扫

**对应 plan Task 2 + Task 3**

**Brief 范围**：
- 重写 `packages/osuperpowers/skills/finishing/SKILL.md`（节点锚定式，按 Task 2 §结构）
- 重写 `SKILL.zh-CN.md`（中文镜像，节对节对齐）
- cross-skill anchor 引用扫描 + 更新（预期零匹配，safety sweep）
- P8 base-branch.json 写入接口检查（仅声明 defer，不修改 `cli-driven-development/SKILL.md`）
- `pnpm run emit && pnpm run validate` 绿
- 终扫预演（7 条 grep pattern 全部零匹配）

**Task-level review 重点**：
- 8 节点 + digraph 一一对应（图正文一致性校验）
- 每节点 4 要素完整（Do/Read/Exit/Fail，从 spec §3 逐字派生）
- 3 Invariants ≤ 5 上限
- 8 Failure Modes 与 digraph 边对齐
- zh-CN 镜像节对节对齐
- emit + validate 绿
- 终扫 7 条 grep 全部零匹配

**CDD Task 2 commit message**：`refactor: rewrite finishing to node-anchored format (P6)`（覆盖 plan Task 2 + Task 3 范围）

---

## Plan Document Commit

**Plan 文档本身**：单独 commit `docs: add P6 finishing implementation plan`（按 commit 纪律：plan 获批即 commit，不等 dev 合并）

---

## Risk & Mitigation

| 风险 | 缓解 |
|---|---|
| cross-skill anchor 引用超出预期范围 | grep 扫描先行；若发现大量引用，评估是否需拆分 anchor 更新为独立 Task |
| `cli-driven-development/SKILL.md` 当前引用 `base-branch.md`（尚未存在） | P6 仅产出共享文档，不改 CDD 主技能；P8 重构时再接入 |
| emit 失败因 SKILL.md front matter 不合规 | 依 emit 错误信息定位 front matter 字段，对齐 P4/P5 的 finishing SKILL.md front matter 模式 |
| 终扫 pattern 漏网（如 `worktree` 相关引用残留） | 7 条 grep 全部覆盖；若发现残留，回 Task 2 修复后重扫 |
| nested CLI stdout 不可靠（P5 dogfood 教训） | 使用 overall spec v1.10 的「orchestrator handoff 检查义务」：cdd-task.mjs 返回后必须读 handoff.json 判断状态；CLI 调用使用 background 模式 |

