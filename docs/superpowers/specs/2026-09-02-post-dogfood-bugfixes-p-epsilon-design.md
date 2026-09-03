# Pε — Cleanup + Simplification — Design Spec

- **Version**: v1.0 · 2026-09-02
- **Status**: Approved
- **Author**: [human] · Claude Opus 4.8 (osuperpowers:brainstorming dogfood session)
- **Constraints**:
  - 仓库语言政策：SKILL.md / docs 英文主源；Pε 后删除 `packages/osuperpowers/skills/` + `docs/maintainers/` 下全部 zh-CN 镜像；仓库级 README.zh-CN.md 保留（Strategy B for repo docs）
  - 不 commit 除非用户明确要求；changeset 逐 phase 建
  - vendored 子模块不可改

---

## Document scope

Phase design — cleanup + simplification + 设计债务修复（router 删除、zh-CN 清理、writing-plans 简化、report-issue 重构、review 流程强化）。

---

## §1 — Router 删除级联

### #209 osuperpowers-router 插件完全删除

router 插件不再需要，从代码库中完全移除。

#### Task 1 — 物理删除

删除以下文件/目录（不保留任何 router 物理文件）：

| 目标 | 类型 |
|------|------|
| `packages/osuperpowers-router/` | 目录（25 文件） |
| `scripts/sync-router-versions.mjs` | 文件 |
| `scripts/lib/emit/overrides.mjs` | 文件 |
| `scripts/templates/cursor-detect.mjs` | 文件 |
| `scripts/templates/cursor-enforce.mjs` | 文件 |
| `docs/maintainers/osuperpowers-router-plugin.md` | 文件 |
| `docs/maintainers/osuperpowers-router-plugin.zh-CN.md` | 文件 |

> ⚠️ **Task 1/2 原子性约束（见 [#217](https://github.com/Oscaner/skills/issues/217)）**：Task 1 删除 `overrides.mjs` 后，`scripts/emit.mjs` 仍 import 该文件（该 import 由 Task 2 移除）。因此 Task 1 完成后**不可运行 `pnpm run emit` 或 `pnpm run validate`**——会报 `ERR_MODULE_NOT_FOUND`。Task 1 验证仅限 `git status`；emit 验证推迟到 Task 2 完成后。

#### Task 2 — emit pipeline 清理

**`scripts/emit.mjs`**：
- `productRoots` 数组移除 6 个 router 路径
- 删除 `emitOverrides()` 函数定义
- `emitAll` 循环中移除 `if (plugin.name === "osuperpowers-router") emitOverrides(...)` 分发

**`scripts/ci-validate.mjs`**：
- 删除 Step 1 `checkOverridesPluginSkills()` 函数 + 调用
- 删除 Step 2 `checkSkillsMarkdown()` 的 router 检查
- 删除 Step 3 `checkNoOrphanSkills()` 的 router 检查
- 删除 Step 4 `checkOverridesHooks()` 函数 + 调用
- 删除 Step 5 `validate-overrides-build.mjs` 子进程调用
- `RESIDUE_TARGETS` 数组移除 3 个 router 路径

#### Task 3 — version scripts 清理

| 文件 | 变更 |
|------|------|
| `scripts/version-packages.mjs` | 移除 router 版本段（~37 行）+ `versioned.push("osuperpowers-router")` |
| `scripts/validate-version-sync.mjs` | 移除 router 校验段（~19 行） |
| `scripts/bump-submodule.mjs` | 移除 router CHANGELOG + version bump 段 |

---

## §2 — osuperpowers 内部引用 + report-issue 重构 + issue 编号清理

### Task 4 — osuperpowers 内部引用清理

**skills-probe**：
- `bin/utils/skills-probe.config.mjs`：`requiredPlugins` 从 4 元素数组移除 `"osuperpowers-router"`

**Tests + emit 工具库清理**：

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

**文档**：
- `docs/maintainers/osuperpowers-plugin.md`：重写 architecture/hooks 章节，移除全部 router 引用（~16 处）
- `cli-driven-development/docs/cdd-reference.md`：skills-missing gate 文字移除 `osuperpowers-router`
- `report-issue/SKILL.md`：`classify` 节点移除全部 3 条组件分类规则（① ② ③），component 固定 `osuperpowers`

### Task 5 — report-issue 重构

#### 模板外提

模板移至 `packages/osuperpowers/skills/report-issue/templates/`：

```
templates/
  bug-en.md
  bug-zh.md
  enhancement-en.md
  enhancement-zh.md
```

#### 模板重写原则

- HTML 注释 → **变量占位符**（`{{CONTEXT}}`、`{{PROBLEM}}`、`{{IMPACT}}`、`{{SUGGESTED_FIX}}`）
- 段落标题用简洁英文/中文
- 不引用任何 issue 编号
- `file` 节点根据 session language × finding type Read 对应模板，用 findings 内容填充占位符
- 模板占位符映射：`{{CONTEXT}}` ← finding 的 file/line/branch；`{{PROBLEM}}` ← summary；`{{IMPACT}}` ← failure_scenario；`{{SUGGESTED_FIX}}` ← suggested fix（如有）或 "Under investigation"
- 模板选择映射：`(en, bug)` → `bug-en.md`；`(en, enhancement)` → `enhancement-en.md`；`(zh, bug)` → `bug-zh.md`；`(zh, enhancement)` → `enhancement-zh.md`

#### classify 节点简化

- 移除 #136 组件分类逻辑
- label 固定 `dogfood,<type>`（CDD 关联时加 `cdd`）
- 不再需要 interactive prompt 确认组件分类

#### analyze 节点加脱敏指令

> 提取 findings 时：不要粘贴环境变量、API key、token 等凭据。遇到 `API_KEY=...` / `TOKEN=...` / `SECRET=...` / `PASSWORD=...` 模式时替换为 `[REDACTED]`。

#### SKILL.zh-CN.md

随 Task 7 一并删除，不单独处理。

### Task 6 — 清除 skill 文档中的 issue 编号

从以下文件的**行为逻辑**中移除 issue 编号括号注释（保留 change-history / plan / spec 中的历史引用）。

判断标准：行文中形如 `(#NNN)` 的括号注释，出现在 Do/Read/Exit/Fail/invariant/failure-mode 描述中的，属于行为逻辑，需移除。出现在 Change history、plan task 列表、design spec 引用中的，属于历史记录，保留。

| 文件 | 移除的编号 |
|------|-----------|
| `cli-driven-development/SKILL.md` | `#207`、`#181`（×4）、`#185` — 出现在 dispatch-mode/task-complete?/branch-review/Invariants 的行为描述中 |
| `cli-driven-development/docs/cdd-reference.md` | `#52` — 出现在 Rule 0 checklist 语义契约描述中 |
| `cli-driven-development/docs/handoff-schema.md` | `#186` — 出现在 commits.head 校验行为描述中 |
| `brainstorming/docs/overall-spec-template.md` | `#136` — 出现在 Phase pre-consumes 反模式描述中 |

#### 新增 anti-pattern 规则

写入 `docs/maintainers/skill-authoring.md` Anti-patterns 章节：

> **Anti-pattern: Issue-Number as Behavioral Baseline**
>
> SKILL.md、templates、docs 中的行为逻辑不得以 GitHub issue 编号为参考依据。Issue 是设计讨论的场所，结论固化到文档后，issue 编号应从行为逻辑中移除。变更历史中的 issue 引用不受此限。

---

## §3 — zh-CN 清理 + CLAUDE.md + writing-plans + 收尾

### Task 7 — 删除全部 .zh-CN.md

#### packages/osuperpowers/skills/ + docs/maintainers/（共 19 个，不含 Task 1 已删除的 router zh-CN）

packages/osuperpowers/skills/ 下 17 个：

| 路径 |
|------|
| `init/SKILL.zh-CN.md` |
| `init/harness.zh-CN.md` |
| `finishing/SKILL.zh-CN.md` |
| `cli-select/SKILL.zh-CN.md` |
| `cli-research/SKILL.zh-CN.md` |
| `_docs/docs-review.zh-CN.md` |
| `brainstorming/SKILL.zh-CN.md` |
| `brainstorming/docs/overall-spec-template.zh-CN.md` |
| `brainstorming/docs/phase-spec-template.zh-CN.md` |
| `brainstorming/docs/add-phase-protocol.zh-CN.md` |
| `cli-driven-development/SKILL.zh-CN.md` |
| `cli-driven-development/docs/controller-handoff.zh-CN.md` |
| `cli-driven-development/docs/base-branch.zh-CN.md` |
| `cli-driven-development/docs/cdd-reference.zh-CN.md` |
| `cli-driven-development/docs/handoff-schema.zh-CN.md` |
| `writing-plans/SKILL.zh-CN.md` |
| `report-issue/SKILL.zh-CN.md` |

#### docs/maintainers/ 下 2 个（非 router、非 skills 目录下的独立 maintainer zh-CN）：

| 路径 |
|------|
| `osuperpowers-plugin.zh-CN.md` |
| `skill-authoring.zh-CN.md` |

共 19 个文件删除（17 skills + 2 maintainers）。`emitAgentsSkillsCopy()` 递归复制无需改动——源文件删除后，`pnpm run emit` 重新生成 `.agents/` 时自然不再包含 zh-CN 文件。

### Task 8 — CLAUDE.md + README 更新

#### CLAUDE.md

- Plugin 数量 5 → 4，移除 osuperpowers-router 条目
- Architecture details 移除 router 路径
- Per-package documentation 移除 router 链接
- **语言策略重写**：Strategy A 从 "英文主源 + zh-CN 镜像" 改为 "英文唯一，无中文镜像"
- Strategy B extension 维护者 docs 部分同步更新

#### README.md

- npm badge / Plugin table / Install commands / npm install / Directory links / License 移除 router

#### README.zh-CN.md

**不删除**（保留文件），但同步英文版变更移除 router 引用。Task 7 的 zh-CN 删除范围仅限 `packages/osuperpowers/skills/` + `docs/maintainers/`，不包括 README.zh-CN.md——仓库级 README 跟随 Strategy B（repo docs），保持双语。

#### packages/osuperpowers/README.md + packages/osuperpowers/README.zh-CN.md

install 文字移除 router

#### .github/

- `workflows/release.yml`：matrix 移除 router entry
- `ISSUE_TEMPLATE/enhancement.yml` + `bug_report.yml`：label 文字移除 `osuperpowers-router`

#### docs/gate-install.md

移除 router 引用

### Task 9 — writing-plans I2 移除

**`writing-plans/SKILL.md`**：
- `write-plan` 节点 Do 字段：移除 "Each section uses one tool call (Section-By-Section — I2)"，改为 "Write the complete plan document"
- Invariants 表：删除 I2 行，后续 invariant 重新编号（I3→I2, I4→I3）
- 更新 I1 rationale：移除 "(triggers router interception)" 过时引用（依赖 Task 1-4 完成后 router 引用不再有意义）
- Failure Modes 表同步更新编号引用

upstream（vendored submodule）不改。

### Task 10 — 收尾

1. `pnpm run emit` 重新生成所有派生文件
2. `pnpm run validate` 确保全绿
3. 更新 overall spec Phase inventory：Pε Design spec = Done, Plan = Done, Deliverables 填充
4. 更新 overall spec Constraints 行（line 8）语言政策：移除 "zh-CN 镜像" 字样
5. 手动清理 `.changeset/versioned-plugins.json` 移除 `"osuperpowers-router"` 条目
6. 删除 `.changeset/p13-closure-unified.md`（引用已删除的 router 包）
7. `.changeset/` 创建 changeset

### Task 11 — review 3-pass 强制执行 + Review Stopping 语义修正

重构 `brainstorming` 和 `writing-plans` 的 review 流程，同时修正 Review Stopping 语义。

#### 变更 1：3-pass 强制执行（移除 D1 skip）

移除"Pass 1 零 findings 跳过后续 pass"逻辑，3 pass 永远全部执行。

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

> **scope 说明**：Review Stopping 语义修正不属于 Pβ #195/#196 的范畴（Pβ 修的是"re-run 只跑 blocker pass"语义）。Task 11 修正的是"blocker=0 判定标准"——当前规范中"修复后自认为 blocker=0"与"re-review CLI 实际输出 blocker=0"之间的歧义，是本次 brainstorming 发现的设计债务，归入 Pε scope。

**旧语义**：修复后 `blocker=0` → 停止（"我认为修复了"= blocker=0）
**新语义**：修复后 re-review → re-review **输出**的 blocker=0 → 停止（必须实际重跑该 pass，由 cdd-review CLI 输出判定）

改动点：

**`brainstorming/SKILL.md`**：
- `spec-review` 节点 Do 字段："loop until blocker=0" → "loop until re-review output shows blocker=0"
- Invariant I5：`re-run driven only by blockers; no re-run after all passes are blocker=0` → `re-run driven only by blockers; stop only when re-review output (cdd-review CLI) shows 0 blockers for that pass — fixing locally and declaring blocker=0 without re-running cdd-review on that pass is insufficient`
- Failure Modes："Agent re-runs review after all passes are blocker=0" → "Agent declares blocker=0 after fixing without re-running cdd-review on that pass"

**`writing-plans/SKILL.md`**：
- `plan-review` 节点 Do 字段：同上
- Invariant I4（Task 9 重编号后为 I3，实施时以内容匹配定位）：同 brainstorming I5 语义修正
- Failure Modes（同上重编号后定位）：同上

### Task 12 — writing-plans 标题格式防回归

**`writing-plans/SKILL.md`** — `write-plan` 节点 Do 字段：
将 "Write the complete plan document" 改为：

> Write the complete plan document. Task headings MUST use `### Task N:` colon format — matching brief.mjs extraction pattern (`/^### Task \d+:/`). Em dash (`—`), Chinese colon (`：`), or any other delimiter will cause brief extraction failure at CDD dispatch time.

这是 Pβ #184/#198 的防回归措施：#198 当初只在 invariant I5 声明格式要求，但没有在 `write-plan` 执行节点中显式要求。本次 dogfood 发现 writing-plans agent 产出时仍会出现 em dash 格式，证明仅靠 invariant 约束不够——执行节点必须包含显式的格式指令。

### Task 13 — runner.mjs BLOCKED handoff 缺 phase 字段修复

**`packages/osuperpowers/bin/engine/lib/runner.mjs`** — step 8.8 schema validation BLOCKED 写入路径（line 495）：

```js
// Before（缺 phase — 导致下次 dispatch schema validation 循环）
writeHandoff(env.CDD_HANDOFF_PATH, { status: "BLOCKED", blocker: sv.reason });

// After
writeHandoff(env.CDD_HANDOFF_PATH, { status: "BLOCKED", phase: mode, blocker: sv.reason });
```

**同时检查**：runner.mjs 中所有其他 `writeHandoff` BLOCKED 写入路径是否同样缺少 `phase` 字段，一并修复。

**防回归**：在 `packages/osuperpowers/bin/engine/tests/` 中补充测试——当 schema validation 触发 BLOCKED 时，写入的 handoff 必须包含 `phase` 字段。

> **注意**：本 task 已在 CDD 执行中作为 out-of-band 紧急修复（dogfood 发现立即修）。Task 13 的 CDD dispatch 验证该修复的完整性（其他写入路径 + 测试覆盖）。（见 [#218](https://github.com/Oscaner/skills/issues/218)）

---

## 依赖关系

```
Task 1 (纯删除) ──→ Task 2 (emit pipeline)
                ──→ Task 3 (version scripts)
                ──→ Task 4 (内部引用) ──→ Task 5 (report-issue 重构)
                                     ──→ Task 6 (issue 编号清理)
Task 7 (zh-CN 删除) ──→ Task 8 (CLAUDE.md + README) ←── Task 1 (router 引用)
Task 9 (I2 移除，独立) ──→ Task 12 (标题格式防回归)
Task 9 (I2 移除，独立) ──→ Task 13 (runner BLOCKED handoff phase 修复)
Task 11 (review 3-pass 重构，独立)
Task 10 (收尾，等全部完成)
```

Task 1/7/9/11 无前置依赖可并行。Task 8 依赖 Task 1 + Task 7（需 Task 1 完成后 router 引用才可清理，需 Task 7 完成后语言策略才可更新）。
