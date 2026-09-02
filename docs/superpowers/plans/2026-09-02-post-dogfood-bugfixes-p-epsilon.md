# Pε — Cleanup + Simplification — Implementation Plan

- **Spec**: [2026-09-02-post-dogfood-bugfixes-p-epsilon-design.md](../specs/2026-09-02-post-dogfood-bugfixes-p-epsilon-design.md)
- **Base**: develop
- **Date**: 2026-09-02

---

### Task 1 — 物理删除 router 代码

**依赖**：无

删除以下文件/目录：

```bash
rm -rf packages/osuperpowers-router/
rm -f scripts/sync-router-versions.mjs
rm -f scripts/lib/emit/overrides.mjs
rm -f scripts/templates/cursor-detect.mjs
rm -f scripts/templates/cursor-enforce.mjs
rm -f docs/maintainers/osuperpowers-router-plugin.md
rm -f docs/maintainers/osuperpowers-router-plugin.zh-CN.md
```

验证：`pnpm run emit:check` 会报 drift（预期，待 Task 2 修复）。`git status` 确认仅删除文件。

---

### Task 2 — emit pipeline 清理

**依赖**：Task 1

#### scripts/emit.mjs

1. 移除 `productRoots` 数组中 6 个 router 路径：
   - `packages/osuperpowers-router/.claude-plugin`
   - `packages/osuperpowers-router/.cursor-plugin`
   - `packages/osuperpowers-router/.codex-plugin`
   - `packages/osuperpowers-router/hooks`
   - `packages/osuperpowers-router/bin`
   - `packages/osuperpowers-router/build/generated`

2. 删除 `emitOverrides()` 函数定义（~88 行）

3. 移除 `emitOverrides` 的 import/require 语句

4. `emitAll` 循环中移除 `if (plugin.name === "osuperpowers-router") emitOverrides(outRoot, plugin);`

#### scripts/ci-validate.mjs

1. 删除 `checkOverridesPluginSkills()` 函数 + 调用（Step 1）
2. 删除 `checkSkillsMarkdown()` 中 router 检查逻辑（Step 2）
3. 删除 `checkNoOrphanSkills()` 中 router 检查逻辑（Step 3）
4. 删除 `checkOverridesHooks()` 函数 + 调用（Step 4）
5. 删除 `validate-overrides-build.mjs` 子进程调用（Step 5）
6. `RESIDUE_TARGETS` 数组移除 3 个 router 路径：
   - `packages/osuperpowers-router/bin`
   - `packages/osuperpowers-router/hooks`
   - `packages/osuperpowers-router/build/generated`

验证：`node scripts/ci-validate.mjs` 不应因 router 缺失报错。

---

### Task 3 — version scripts 清理

**依赖**：Task 1

| 文件 | 变更 |
|------|------|
| `scripts/version-packages.mjs` | 移除 router 版本段（~37 行，lines 71-108）+ `versioned.push("osuperpowers-router")` |
| `scripts/validate-version-sync.mjs` | 移除 router 校验段（~19 行，lines 9-27） |
| `scripts/bump-submodule.mjs` | 移除 router CHANGELOG 写入（lines 42-43）+ router version bump 段（lines 61-73） |

---

### Task 4 — osuperpowers 内部引用清理

**依赖**：Task 1

#### skills-probe

- `bin/utils/skills-probe.config.mjs`：`requiredPlugins` 从 `["superpowers", "mattpocock-skills", "osuperpowers", "osuperpowers-router"]` → `["superpowers", "mattpocock-skills", "osuperpowers"]`

#### Tests + emit 工具库清理

| 文件 | 变更 |
|------|------|
| `bin/utils/tests/skills-probe.test.mjs` | 断言改为 3 元素数组，移除 router fixture |
| `tests/ci-validate.test.mjs` | 移除 router zero-residue 断言 |
| `tests/grep-sweep-regression.test.mjs` | 移除 router 目标和排除项 |
| `scripts/lib/emit/emit.test.mjs` | 移除 router fixture 和断言 |
| `scripts/lib/first-party-publish.test.mjs` | 移除 router |
| `scripts/lib/bump-chain.test.mjs` | 移除 router fixtures |
| `scripts/lib/version-utils.test.mjs` | 移除 router fixture |
| `scripts/lib/marketplace-utils.mjs` | 移除 router 查找逻辑 |

#### 文档

- `docs/maintainers/osuperpowers-plugin.md`：重写 architecture/hooks 章节，移除全部 router 引用（~16 处）
- `cli-driven-development/docs/cdd-reference.md`：skills-missing gate 文字移除 `osuperpowers-router`
- `report-issue/SKILL.md`：`classify` 节点移除全部 3 条组件分类规则（① ② ③），component 固定 `osuperpowers`。**scope 边界**：Task 4 仅做分类规则删除 + component 硬编码；Task 5 在此基础上重构整个 classify 节点（简化 label 逻辑、移除交互式确认等）。两 task 的 classify 改动有意重叠——Task 4 保证 router 删除后 CI 不报错，Task 5 做完整重构。

验证：`node scripts/ci-validate.mjs` 全绿。

---

### Task 5 — report-issue 重构

**依赖**：Task 4

#### 模板外提

创建 `packages/osuperpowers/skills/report-issue/templates/` 目录，写入 4 个模板文件：

- `bug-en.md` — Bug template (English)
- `bug-zh.md` — Bug template (Chinese)
- `enhancement-en.md` — Enhancement template (English)
- `enhancement-zh.md` — Enhancement template (Chinese)

模板使用变量占位符（`{{CONTEXT}}`、`{{PROBLEM}}`、`{{IMPACT}}`、`{{SUGGESTED_FIX}}`），不用 HTML 注释。

模板内容结构（以 bug-en.md 为例，zh/en 和 bug/enhancement 变化标题和占位符名称）：

```markdown
## Context

{{CONTEXT}}

## Problem

{{PROBLEM}}

## Impact

{{IMPACT}}

## Suggested fix

{{SUGGESTED_FIX}}
```

enhancement 模板结构：`## Context` / `## Current behavior` / `## Desired behavior` / `## Suggested approach`。占位符映射同上，`{{SUGGESTED_FIX}}` 改为 `{{SUGGESTED_APPROACH}}`。

#### confirm 节点简化

移除组件分类确认逻辑。新 Do 字段：仅展示 findings 列表 + 问 "Is this accurate overall? Any additions or removals?"，不再提示 `osuperpowers` / `osuperpowers-router` / `cdd` 分类标签供用户纠正。

#### SKILL.md 重构

- `analyze` 节点加脱敏指令：不粘贴 API key/token/secret，匹配到 `API_KEY=...` / `TOKEN=...` / `SECRET=...` / `PASSWORD=...` 时替换为 `[REDACTED]`
- `classify` 节点：移除全部 3 条组件分类规则（① ② ③），label 固定 `dogfood,<type>`（CDD 关联时加 `cdd`）
- `file` 节点：Read 对应模板 → 填充占位符 → 构造 issue body
- 模板选择映射：`(en, bug)` → `bug-en.md`；`(en, enhancement)` → `enhancement-en.md`；`(zh, bug)` → `bug-zh.md`；`(zh, enhancement)` → `enhancement-zh.md`
- `confirm` 节点：简化，不再需交互式确认组件分类
- Issue Body Templates 章节：整段删除（已外提到 templates/）

SKILL.zh-CN.md 随 Task 7 一并删除，不单独处理。

---

### Task 6 — 清除 skill 文档中的 issue 编号

**依赖**：Task 4

从以下文件的**行为逻辑**中移除 issue 编号括号注释（保留 change-history / plan / spec 中的历史引用）。

判断标准：行文中形如 `(#NNN)` 的括号注释，出现在 Do/Read/Exit/Fail/invariant/failure-mode 描述中的，属于行为逻辑，需移除。出现在 Change history、plan task 列表、design spec 引用中的，属于历史记录，保留。

| 文件 | 移除的编号 | 具体位置 |
|------|-----------|---------|
| `cli-driven-development/SKILL.md` | `#207`、`#181`（×4）、`#185` | dispatch-mode/task-complete?/branch-review/Invariants 的行为描述 |
| `cli-driven-development/docs/cdd-reference.md` | `#52` | Rule 0 checklist 语义契约描述 |
| `cli-driven-development/docs/handoff-schema.md` | `#186` | commits.head 校验行为描述 |
| `brainstorming/docs/overall-spec-template.md` | `#136` | Phase pre-consumes 反模式描述 |

#### 新增 anti-pattern 规则

写入 `docs/maintainers/skill-authoring.md` Anti-patterns 章节末尾（独立段落，不归入现有分类）：

> **Anti-pattern: Issue-Number as Behavioral Baseline**
>
> SKILL.md、templates、docs 中的行为逻辑不得以 GitHub issue 编号为参考依据。Issue 是设计讨论的场所，结论固化到文档后，issue 编号应从行为逻辑中移除。变更历史中的 issue 引用不受此限。

---

### Task 7 — 删除全部 .zh-CN.md

**依赖**：无

删除 `packages/osuperpowers/skills/` 下 17 个 + `docs/maintainers/` 下 2 个，共 19 个 .zh-CN.md 文件。

packages/osuperpowers/skills/ 下 17 个：
- `init/SKILL.zh-CN.md`、`init/harness.zh-CN.md`
- `finishing/SKILL.zh-CN.md`
- `cli-select/SKILL.zh-CN.md`
- `cli-research/SKILL.zh-CN.md`
- `_docs/docs-review.zh-CN.md`
- `brainstorming/SKILL.zh-CN.md`
- `brainstorming/docs/overall-spec-template.zh-CN.md`
- `brainstorming/docs/phase-spec-template.zh-CN.md`
- `brainstorming/docs/add-phase-protocol.zh-CN.md`
- `cli-driven-development/SKILL.zh-CN.md`
- `cli-driven-development/docs/controller-handoff.zh-CN.md`
- `cli-driven-development/docs/base-branch.zh-CN.md`
- `cli-driven-development/docs/cdd-reference.zh-CN.md`
- `cli-driven-development/docs/handoff-schema.zh-CN.md`
- `writing-plans/SKILL.zh-CN.md`
- `report-issue/SKILL.zh-CN.md`

docs/maintainers/ 下 2 个：
- `osuperpowers-plugin.zh-CN.md`
- `skill-authoring.zh-CN.md`

验证：`find packages/osuperpowers/skills docs/maintainers -name '*.zh-CN.md'` 应返回空。`pnpm run emit` 重新生成 `.agents/` 时自然不再包含 zh-CN 文件。

---

### Task 8 — CLAUDE.md + README 更新

**依赖**：Task 1 + Task 7

#### CLAUDE.md

- Plugin 数量 5 → 4，移除 osuperpowers-router 条目
- Architecture details 移除 `packages/osuperpowers-router/hooks/` 等路径
- Per-package documentation 移除 router 链接
- **语言策略重写**：Strategy A 整段重写——从 "英文主源 + zh-CN 镜像" 改为 "英文唯一，无中文镜像"；删除所有 `.zh-CN.md` 行条目；保留 `*.zh-CN.md` 作为已废弃例外说明（如有）
- Strategy B extension 维护者 docs 部分同步更新（移除 zh-CN 镜像引用）

#### README.md

- npm badge 移除 `@oscaner-skills/osuperpowers-router`
- Plugin table 移除 router 行
- Install commands 移除 `/plugin install osuperpowers-router@oscaner-skills`
- npm install 移除 `@oscaner-skills/osuperpowers-router`
- Directory links 移除 `packages/osuperpowers-router/`
- License lines 移除 router

#### README.zh-CN.md

同步英文版变更（保留文件，移除 router 引用）

#### packages/osuperpowers/README.md + README.zh-CN.md

install 文字移除 router

#### .github/

- `workflows/release.yml`：matrix 移除 `{ name: osuperpowers-router, tag_prefix: "osuperpowers-router@" }`
- `ISSUE_TEMPLATE/enhancement.yml` + `bug_report.yml`：label 文字移除 `osuperpowers-router`

#### docs/gate-install.md

- 移除 `packages/osuperpowers-router/docs/cross-harness-overrides.md` 链接
- 移除 "(`osuperpowers-router`) is a separate plugin; routing is hook-driven" 描述

---

### Task 9 — writing-plans I2 移除

**依赖**：无（独立）

**`writing-plans/SKILL.md`**：

1. `write-plan` 节点 Do 字段：移除 "Each section uses one tool call (Section-By-Section — I2)"，改为 "Write the complete plan document"
2. Invariants 表：删除 I2 行，后续 invariant 重新编号（I3→I2, I4→I3）
3. 更新 I1 rationale：移除 "(triggers router interception)" 过时引用（依赖 Task 1-4 完成后 router 引用不再有意义）
4. Failure Modes 表同步更新编号引用

upstream（vendored submodule）不改。

---

### Task 10 — 收尾

**依赖**：Task 1-9 全部完成

1. `pnpm run emit` 重新生成所有派生文件（`.agents/`、`marketplace/source.json`、`.claude-plugin/`、`.cursor-plugin/` 等）
2. `pnpm run validate` 确保全绿
3. 更新 overall spec Phase inventory：Pε Design spec = Done, Plan = Done, Deliverables 填充
4. 更新 overall spec Constraints 行（line 8）语言政策：移除 "zh-CN 镜像" 字样
5. 手动清理 `.changeset/versioned-plugins.json` 移除 `"osuperpowers-router"` 条目
6. 删除 `.changeset/p13-closure-unified.md`（引用已删除的 router 包）
7. `.changeset/` 创建 changeset

---

### Task 11 — review 3-pass 强制执行 + Review Stopping 语义修正

**依赖**：无（独立，与 Task 9 编辑同一文件的不同节点，可并行）

重构 `brainstorming` 和 `writing-plans` 的 review 流程。

#### 变更 1：3-pass 强制执行（移除 D1 skip）

**`brainstorming/SKILL.md`**：
- 流程图：移除 `pass1 clean (D1 zero findings, skip D2/D3)` 边
- `spec-review` 节点 Do 字段：移除 "Pass 1 zero findings (D1) → skip subsequent passes"
- `spec-review` 节点 Exit 字段：移除 "Pass 1 clean → `user-ok?`"

**`writing-plans/SKILL.md`**：
- 流程图：移除 `pass1 clean` 边
- `plan-review` 节点 Do 字段：移除 "Pass 1 zero findings (D1) → skip subsequent passes"
- `plan-review` 节点 Exit 字段：移除 "Pass 1 clean (D1) → skip to `commit-plan`"

> **注意**：writing-plans 行号在 Task 9（I2 移除 + invariant 重编号）之后会偏移。Task 11 实施时应以内容匹配（Do/Exit/Invariant 字段名）定位，不依赖行号。

#### 变更 2：Review Stopping 语义修正

**旧语义**：修复后 `blocker=0` → 停止（"我认为修复了"= blocker=0）
**新语义**：修复后 re-review → re-review **输出**的 blocker=0 → 停止（必须实际重跑该 pass，由 cdd-review CLI 输出判定）

**`brainstorming/SKILL.md`**：
- `spec-review` 节点 Do 字段："loop until blocker=0" → "loop until re-review output shows blocker=0"
- Invariant I5：`re-run driven only by blockers; no re-run after all passes are blocker=0` → `re-run driven only by blockers; stop only when re-review output (cdd-review CLI) shows 0 blockers for that pass — fixing locally and declaring blocker=0 without re-running cdd-review on that pass is insufficient`
- Failure Modes："Agent re-runs review after all passes are blocker=0" → "Agent declares blocker=0 after fixing without re-running cdd-review on that pass"

**`writing-plans/SKILL.md`**（Task 9 重编号后定位）：
- `plan-review` 节点 Do 字段：同上
- Invariant（Task 9 重编号后为 I3）：同 brainstorming I5 语义修正
- Failure Modes（同上重编号后定位）：同上

#### 不变

Review Stopping 的其他语义保留：re-run only that pass（不重跑全部 pass）；warn/nit 不触发 re-run。

> **注意**：writing-plans 行号在 Task 9（I2 移除 + invariant 重编号）之后会偏移。Task 11 实施时应以内容匹配（Do/Exit/Invariant 字段名）定位，不依赖行号。若 Task 9 与 Task 11 并行执行，需在 Task 9 完成后再合并 writing-plans/SKILL.md 的变更。
