# P2 — CLI Reviewer Pipeline: cdd-exec→cdd-review + cdd-run→cdd-task + branch-review

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 两个 CLI 入口重命名（`cdd-exec.mjs`→`cdd-review.mjs`、`cdd-run.mjs`→`cdd-task.mjs`）+ 新增 `templates/cdd/branch-review.md` + 全部引用文件（~40 files）同步更新；解决 #146（CLI code-review 路径）和 #153（命名语义区分）。

**Architecture:** 3 条主线——(1) `cdd-exec.mjs` 和 `cdd-run.mjs` 两个文件重命名，内容注释同步；(2) 新增 `branch-review.md` 模板（参数 `{{BASE}}`/`{{HEAD}}`/`{{PLAN}}`）；(3) 代码库中所有 `cdd-exec`/`cdd-run` 引用全局替换为 `cdd-review`/`cdd-task`（engine/gate/tests/docs/SKILL/.agents/外部文件，共 ~40 个文件，150+ 处引用）。

**Tech Stack:** Node.js (.mjs)、JSON、Markdown

## Global Constraints

- 重命名不留别名——`cdd-exec` / `cdd-run` 旧名在文件名和内容中完全消失
- `--mode` 名称（implement / task-review / fix）不再变更
- `cdd-review` = 所有 review 类型的一次性 dispatch；`cdd-task` = per-task 三模式链
- 模板 `{{PLACEHOLDER}}` 语法与 P1 一致；缺失占位符 → 报错退出
- `--template` 和 `--prompt` 互斥（P1 已实现，不变）
- 向后兼容：`cdd-task --mode task-review` = P1 的 `cdd-run --mode task-review`
- `pnpm run emit && pnpm run validate` 全部通过

---
## File Structure

| File | Responsibility |
|---|---|
| `packages/osuperpowers/bin/engine/cdd-exec.mjs` → `cdd-review.mjs` | (Rename) 一次性 review prompt runner——内容中 "cdd-exec" → "cdd-review" |
| `packages/osuperpowers/bin/engine/cdd-run.mjs` → `cdd-task.mjs` | (Rename) per-task 三模式链 runner——内容中 "cdd-run" → "cdd-task" |
| `packages/osuperpowers/templates/cdd/branch-review.md` | (New) Whole-branch code review 模板——`{{BASE}}`/`{{HEAD}}`/`{{PLAN}}` |
| `packages/osuperpowers/bin/engine/lib/runner.mjs` | Modify: 注释中 `cdd-exec.mjs` → `cdd-review.mjs`（1 处） |
| `packages/osuperpowers/bin/gate/cdd-gate-core.mjs` | Modify: regex `cdd-run.mjs` → `cdd-task.mjs` + 模板字符串 + 注释（3 处） |
| `packages/osuperpowers/bin/gate/tests/*.test.mjs` | Modify: 12 个 gate 测试文件——`cdd-run.mjs` → `cdd-task.mjs` |
| `packages/osuperpowers/bin/engine/tests/exec.test.mjs` → `review.test.mjs` | Rename: `EXEC_MJS`→`REVIEW_MJS`、所有 "cdd-exec"→"cdd-review"（~20 处） |
| `packages/osuperpowers/bin/engine/tests/run.test.mjs` → `task.test.mjs` | Rename: `RUN_MJS`→`TASK_MJS`、所有 "cdd-run"→"cdd-task"（~15 处） |
| `packages/osuperpowers/bin/engine/tests/runner.test.mjs` | Modify: 临时目录 `cdd-runner-` → `cdd-task-runner-`（1 处） |
| `packages/osuperpowers/bin/engine/tests/templates.test.mjs` | Modify: 注释 `cdd-exec` → `cdd-review`（2 处） |
| `packages/osuperpowers/docs/cdd-reference.md` | Modify: `cdd-run.mjs`→`cdd-task.mjs`（~8 处）、`cdd-exec.mjs`→`cdd-review.mjs`（1 处）、`cdd-run*`→`cdd-task*` |
| `packages/osuperpowers/docs/cdd-reference.zh-CN.md` | Modify: 同上 |
| `packages/osuperpowers/docs/review-dispatch.md` | Modify: `cdd-exec` → `cdd-review`（1 处） |
| `packages/osuperpowers/docs/review-dispatch.zh-CN.md` | Modify: 同上 |
| `packages/osuperpowers/skills/cli-driven-development/SKILL.md` | Modify: `cdd-run.mjs` → `cdd-task.mjs`（3 处） |
| `packages/osuperpowers/skills/cli-driven-development/SKILL.zh-CN.md` | Modify: 同上 |
| `packages/osuperpowers/skills/cli-select/SKILL.md` | Modify: `cdd-run.mjs` → `cdd-task.mjs`（1 处） |
| `packages/osuperpowers/skills/cli-select/SKILL.zh-CN.md` | Modify: 同上 |
| `packages/osuperpowers/skills/cli-task/SKILL.md` | Modify: `cdd-exec.mjs`→`cdd-review.mjs`（2 处）、`cdd-run.mjs`→`cdd-task.mjs`（1 处） |
| `packages/osuperpowers/skills/cli-task/SKILL.zh-CN.md` | Modify: 同上 |
| `packages/osuperpowers/skills/cli-code-review/SKILL.md` | Modify: `cdd-exec.mjs` → `cdd-review.mjs`（1 处） |
| `packages/osuperpowers/skills/cli-code-review/SKILL.zh-CN.md` | Modify: 同上 |
| `packages/osuperpowers/skills/brainstorming/SKILL.md` | Modify: `cdd-exec` → `cdd-review`（1 处） |
| `packages/osuperpowers/skills/brainstorming/SKILL.zh-CN.md` | Modify: `cdd-exec`→`cdd-review` + 旧伪代码语法→新 `--template` 语法 |
| `packages/osuperpowers/skills/writing-plans/SKILL.md` | Modify: `cdd-exec` → `cdd-review`（1 处） |
| `packages/osuperpowers/skills/writing-plans/SKILL.zh-CN.md` | Modify: `cdd-exec`→`cdd-review` + 旧伪代码语法→新 `--template` 语法 |
| `packages/osuperpowers/skills/executing-plans/SKILL.md` | Modify: `cdd-run.mjs` → `cdd-task.mjs`（2 处） |
| `packages/osuperpowers/skills/executing-plans/SKILL.zh-CN.md` | Modify: 同上 |
| `packages/osuperpowers/skills/report-issue/SKILL.md` | Modify: `cdd-run.mjs` → `cdd-task.mjs`（3 处） |
| `packages/osuperpowers/skills/report-issue/SKILL.zh-CN.md` | Modify: 同上 |
| `.agents/skills/osuperpowers/*/SKILL.md` + `.zh-CN.md` | Auto-sync: `pnpm run emit` |
| `packages/osuperpowers/templates/cdd/fix.md` | Modify: `cdd-run.mjs` → `cdd-task.mjs`（1 处） |
| `README.md` / `README.zh-CN.md` | Modify: `cdd-run.mjs` → `cdd-task.mjs`（2 处） |
| `packages/osuperpowers/CLAUDE.md` | Modify: `cdd-run.mjs` → `cdd-task.mjs`（1 处） |
| `scripts/ci-validate.mjs` | Modify: `"cdd-run.mjs"`→`"cdd-task.mjs"`、`"cdd-exec.mjs"`→`"cdd-review.mjs"` |
| `packages/osuperpowers-router/tests/validate-overrides-build.mjs` | Modify: 同上 |
| `packages/osuperpowers-router/docs/cross-harness-overrides.md` | Modify: `cdd-run.mjs`→`cdd-task.mjs`（3 处）、`cdd-exec.mjs`→`cdd-review.mjs`（1 处） |

**Files confirmed CLEAN (no refs to cdd-exec/cdd-run):** `cdd-select.mjs`、`cdd-session-activate.mjs`、`contract.mjs`、`registry.mjs`、`templates.mjs`（仅注释无直接引用）、`controller-handoff.md`

### Task 1: 创建 branch-review.md 模板

**Files:**
- Create: `packages/osuperpowers/templates/cdd/branch-review.md`

**Interfaces:**
- Consumes: 上游 `vendors/superpowers/skills/requesting-code-review/code-reviewer.md`（维度参考）
- Produces: `cdd-review --template branch-review --param BASE=... --param HEAD=... --param PLAN=...` 可加载的模板

- [ ] **Step 1: 创建 branch-review.md**

```markdown
# Branch Review

Review the git diff range **{{BASE}}**..**{{HEAD}}** with plan at **{{PLAN}}** for context.

## Context

You are a whole-branch code reviewer. Review completed work across ALL tasks against the plan and code quality standards.

## Git Range

```bash
git diff --stat {{BASE}}..{{HEAD}}
git diff {{BASE}}..{{HEAD}}
```

## What to Check

**Plan alignment:**
- Does the implementation match the plan / requirements?
- Are all planned tasks present?
- Are deviations from the plan justified improvements?

**Code quality:**
- Clean separation of concerns?
- Proper error handling?
- Type safety where applicable?
- DRY without premature abstraction?
- Edge cases handled?

**Architecture:**
- Sound design decisions?
- Reasonable scalability and performance?
- Security concerns?
- Integrates cleanly with surrounding code?

**Testing:**
- Tests verify real behavior, not mocks?
- Edge cases covered?
- Integration tests where they matter?

**Cross-task consistency:**
- Naming consistent across tasks?
- Interfaces between tasks match?
- No leftover work-in-progress or dead code?

## Calibration

Categorize issues by actual severity. Not everything is Critical.
Acknowledge strengths before listing issues.

## Output Format

Return **only** a JSON object:

```json
{
  "findings": [
    {
      "severity": "blocker|warn|nit",
      "file": "repo-relative path",
      "line": 0,
      "summary": "one-line description of the issue",
      "fix": "one-line suggested fix"
    }
  ]
}
```

Empty findings array = approved. No other output.
```

- [ ] **Step 2: Commit**

```bash
git add packages/osuperpowers/templates/cdd/branch-review.md
git commit -m "feat: add branch-review prompt template for cdd-review"
```

### Task 2: cdd-exec.mjs → cdd-review.mjs 重命名

**Files:**
- Rename: `packages/osuperpowers/bin/engine/cdd-exec.mjs` → `packages/osuperpowers/bin/engine/cdd-review.mjs`

**Interfaces:**
- Consumes: P1 的 `renderTemplate` + `invokeCli`（不变）
- Produces: `cdd-review` — 所有 review 类型一次性 dispatch 入口

- [ ] **Step 1: 重命名文件并更新文件头注释**

```bash
git mv packages/osuperpowers/bin/engine/cdd-exec.mjs packages/osuperpowers/bin/engine/cdd-review.mjs
```

编辑 `packages/osuperpowers/bin/engine/cdd-review.mjs`：

Lines 2-4 — 文件描述注释：
```javascript
// cdd-review.mjs — run one prompt via a chosen harness CLI, print normalized output.
// Node port of the legacy bash script; thin shell reusing registry.mjs ship gate + runner.mjs
// invokeCli（registry output 模式归一化：text passthrough / stream-json last finalText）。
```

Line 6 — usage 注释：
```javascript
//   usage: cdd-review.mjs --harness <name> (--prompt <text> | --template <name> [--param KEY=VALUE...])
```

Line 108 — 注释中 "cdd-exec.sh" → 移除（bash 已删）：
```javascript
// 不跳过 CLI 调用（dry-run 下同样做 CLI preflight + invoke）。
```

- [ ] **Step 2: Commit**

```bash
git add packages/osuperpowers/bin/engine/cdd-review.mjs
git commit -m "refactor: rename cdd-exec to cdd-review"
```

### Task 3: cdd-run.mjs → cdd-task.mjs 重命名

**Files:**
- Rename: `packages/osuperpowers/bin/engine/cdd-run.mjs` → `packages/osuperpowers/bin/engine/cdd-task.mjs`

**Interfaces:**
- Consumes: P1 的 `runner.mjs runTask`（不变）
- Produces: `cdd-task` — per-task 三模式链入口

- [ ] **Step 1: 重命名文件并更新文件头注释**

```bash
git mv packages/osuperpowers/bin/engine/cdd-run.mjs packages/osuperpowers/bin/engine/cdd-task.mjs
```

编辑 `packages/osuperpowers/bin/engine/cdd-task.mjs`：

Lines 2-4 — 文件描述注释：
```javascript
// cdd-task.mjs — osuperpowers single task runner: one mode per invocation (Mode A)
// or plan driver (Mode B). Node port of the legacy bash script; thin shell delegating to
// runner.mjs runTask / runPlan.
```

Lines 6-7 — usage 注释：
```javascript
//   Mode A:  cdd-task.mjs --harness <name> --task N --mode implement|task-review|fix [--plan PATH]
//   Mode B:  cdd-task.mjs --harness <name> --plan PATH
```

Line 13 — 注释中 "cdd-run.sh" → 移除（bash 已删）：
```javascript
// Mode A passes --plan via PLAN_FILE env（aligns with legacy bash：cdd_run_task 无 plan-file
```

- [ ] **Step 2: Commit**

```bash
git add packages/osuperpowers/bin/engine/cdd-task.mjs
git commit -m "refactor: rename cdd-run to cdd-task"
```

### Task 4: engine core + gate + engine tests 引用更新

**Files:**
- Modify: `packages/osuperpowers/bin/engine/lib/runner.mjs`
- Modify: `packages/osuperpowers/bin/gate/cdd-gate-core.mjs`
- Modify: `packages/osuperpowers/bin/gate/tests/*.test.mjs`（12 个文件）
- Modify: `packages/osuperpowers/bin/engine/tests/runner.test.mjs`
- Modify: `packages/osuperpowers/bin/engine/tests/templates.test.mjs`

**Interfaces:**
- Consumes: Task 2/3 的重命名文件
- Produces: 所有 engine/gate 内部代码指向新文件名

- [ ] **Step 1: runner.mjs 注释更新**

编辑 `packages/osuperpowers/bin/engine/lib/runner.mjs`：

Line 161 — 注释：
```javascript
// 导出供 cdd-review.mjs（一次性 prompt-runner）复用 —— 归一化逻辑单一来源。
```

> runner.mjs 本身无 `cdd-runner-` 引用——`cdd-runner-` 是 `runner.test.mjs` 的临时目录（Step 4 处理）。

- [ ] **Step 2: cdd-gate-core.mjs — regex + 模板字符串 + 注释**

编辑 `packages/osuperpowers/bin/gate/cdd-gate-core.mjs`：

Line 70-71 — 注释：
```javascript
// cdd_shell_allowed：cdd-task / sdd-workspace / task-brief / review-package 直接放行，
// 否则落到只读 git 白名单。引擎入口为 cdd-task.mjs。
```

Line 74 — regex：
```javascript
if (/(^|\/)cdd-task\.mjs|sdd-workspace|task-brief|review-package/.test(command)) return true;
```

Line 240 — 模板字符串（deny 消息）：
```javascript
${osRoot}/bin/engine/cdd-task.mjs --harness ${harness}
```

Line 247 — 模板字符串（deny 消息带 task）：
```javascript
${osRoot}/bin/engine/cdd-task.mjs --harness ${harness} --task ${taskNum} --mode implement
```

- [ ] **Step 3: 12 个 gate 测试文件更新**

12 个文件中 `cdd-run.mjs` → `cdd-task.mjs`（每个文件 1 处 regex 匹配）：

```bash
# 批量替换（每个文件只有 regex 中的 cdd-run.mjs 引用）
cd packages/osuperpowers/bin/gate/tests
```

| 文件 | 变更 |
|---|---|
| `pi-gate.test.mjs` | `/cdd-run.mjs/` → `/cdd-task.mjs/` |
| `trae.test.mjs` | 同上 |
| `kiro.test.mjs` | 同上 |
| `opencode.test.mjs` | 同上 |
| `gemini.test.mjs` | 同上 |
| `qoder.test.mjs` | 同上 |
| `vibe.test.mjs` | 同上 |
| `cdd-gate-core.test.mjs` | `/cdd-run/` → `/cdd-task/` |
| `codex.test.mjs` | `/cdd-run.mjs/` → `/cdd-task.mjs/` |
| `claude.test.mjs` | 同上 |
| `cursor.test.mjs` | 同上 |
| `droid.test.mjs` | 同上 |

- [ ] **Step 4: engine tests 更新**

编辑 `packages/osuperpowers/bin/engine/tests/runner.test.mjs`：

Line 26 — 临时目录名：
```javascript
const ws = mkdtempSync(path.join(tmpdir(), "cdd-task-runner-"));
```

编辑 `packages/osuperpowers/bin/engine/tests/templates.test.mjs`：

Lines 60-70 — 注释中 `cdd-exec` → `cdd-review`（2 处）：
```javascript
test("renderModePrompt: spec-review 模板可加载但占位符由 cdd-review renderTemplate 处理", () => {
  ...
  // DOC 不在 PLACEHOLDERS 中，保留原样（由 cdd-review renderTemplate 替换）
});
```

- [ ] **Step 5: Commit**

```bash
git add packages/osuperpowers/bin/engine/lib/runner.mjs
git add packages/osuperpowers/bin/gate/cdd-gate-core.mjs
git add packages/osuperpowers/bin/gate/tests/
git add packages/osuperpowers/bin/engine/tests/runner.test.mjs
git add packages/osuperpowers/bin/engine/tests/templates.test.mjs
git commit -m "refactor: update engine/gate references from cdd-exec/cdd-run to cdd-review/cdd-task"
```

### Task 5: engine tests 文件重命名 + 全量引用更新

**Files:**
- Rename: `packages/osuperpowers/bin/engine/tests/exec.test.mjs` → `review.test.mjs`
- Rename: `packages/osuperpowers/bin/engine/tests/run.test.mjs` → `task.test.mjs`

**Interfaces:**
- Consumes: Task 2/3 的重命名（cdd-exec→cdd-review, cdd-run→cdd-task）
- Produces: 测试文件指向新 CLI 入口文件名

- [ ] **Step 1: exec.test.mjs → review.test.mjs**

```bash
git mv packages/osuperpowers/bin/engine/tests/exec.test.mjs packages/osuperpowers/bin/engine/tests/review.test.mjs
```

编辑 `packages/osuperpowers/bin/engine/tests/review.test.mjs`：

Line 1-2 — 文件头注释：
```javascript
// engine/tests/review.test.mjs — T3: cdd-review.mjs 一次性自由任务入口行为（hermetic mock PATH）。
// Node port of the legacy bash test（6 scenarios）：参数分派、text passthrough、stream-json
```

Line 17 — 常量：
```javascript
const REVIEW_MJS = path.join(ENGINE_DIR, "cdd-review.mjs");
```

Lines 20 — 注释：
```javascript
// 测试 env：清掉外部会话可能继承的 CDD_*（cdd-review 读 CDD_MODE 做 task-review-prefix）。
```

Lines 57-177 — 所有 test 名称和注释中的 "cdd-exec.mjs" / "cdd-exec" → "cdd-review.mjs" / "cdd-review"（约 17 个 test）：

| 旧字符串 | 新字符串 |
|---|---|
| `cdd-exec-mock-`（临时目录） | `cdd-review-mock-`（4 处） |
| `cdd-exec.mjs:`（test 名称） | `cdd-review.mjs:`（12 处） |
| `cdd-exec`（注释中） | `cdd-review`（~5 处） |
| `cdd-exec.sh` | 移除/改写 |

- [ ] **Step 2: run.test.mjs → task.test.mjs**

```bash
git mv packages/osuperpowers/bin/engine/tests/run.test.mjs packages/osuperpowers/bin/engine/tests/task.test.mjs
```

编辑 `packages/osuperpowers/bin/engine/tests/task.test.mjs`：

Line 1 — 文件头注释：
```javascript
// engine/tests/task.test.mjs — T3: cdd-task.mjs 入口壳 CLI 契约（Node port of cdd-cli-dry-run-smoke.sh）。
```

Line 15 — 常量：
```javascript
const TASK_MJS = path.join(REPO_ROOT, "packages/osuperpowers/bin/engine/cdd-task.mjs");
```

Line 38 — 临时目录：
```javascript
const ws = mkdtempSync(path.join(tmpdir(), "cdd-task-cli-"));
```

Lines 43-127 — 所有 test 名称和注释中的 "cdd-run" / "cdd-run.mjs" → "cdd-task" / "cdd-task.mjs"（约 10 个 test）：

| 旧字符串 | 新字符串 |
|---|---|
| `cdd-run.mjs:`（test 名称） | `cdd-task.mjs:`（8 处） |
| `cdd-run`（注释中） | `cdd-task`（~5 处） |
| `cdd-run.sh` | 移除/改写 |
| Mode B `--plan` 引用 | 保留内容但 #151 待删除 |

- [ ] **Step 3: Commit**

```bash
git add packages/osuperpowers/bin/engine/tests/review.test.mjs
git add packages/osuperpowers/bin/engine/tests/task.test.mjs
git commit -m "refactor: rename engine test files to cdd-review/cdd-task naming"
```

### Task 6: SKILL.md + 文档 + 外部文件 + 模板全量引用更新

**Files:**
- Modify: `packages/osuperpowers/skills/brainstorming/SKILL.md` + `.zh-CN.md`
- Modify: `packages/osuperpowers/skills/writing-plans/SKILL.md` + `.zh-CN.md`
- Modify: `packages/osuperpowers/skills/cli-driven-development/SKILL.md` + `.zh-CN.md`
- Modify: `packages/osuperpowers/skills/cli-select/SKILL.md` + `.zh-CN.md`
- Modify: `packages/osuperpowers/skills/cli-task/SKILL.md` + `.zh-CN.md`
- Modify: `packages/osuperpowers/skills/cli-code-review/SKILL.md` + `.zh-CN.md`
- Modify: `packages/osuperpowers/skills/executing-plans/SKILL.md` + `.zh-CN.md`
- Modify: `packages/osuperpowers/skills/report-issue/SKILL.md` + `.zh-CN.md`
- Modify: `packages/osuperpowers/docs/cdd-reference.md` + `.zh-CN.md`
- Modify: `packages/osuperpowers/docs/review-dispatch.md` + `.zh-CN.md`
- Modify: `packages/osuperpowers/templates/cdd/fix.md`
- Modify: `README.md` + `README.zh-CN.md`
- Modify: `packages/osuperpowers/CLAUDE.md`
- Modify: `scripts/ci-validate.mjs`
- Modify: `packages/osuperpowers-router/tests/validate-overrides-build.mjs`
- Modify: `packages/osuperpowers-router/docs/cross-harness-overrides.md`
- Auto-sync: `pnpm run emit`（`.agents/skills/` 镜像）

**Interfaces:**
- Consumes: Task 2-5 的所有重命名
- Produces: 全代码库无 `cdd-exec` / `cdd-run` 引用残留

- [ ] **Step 1: SKILL.md 文件（skills/ 目录）**

16 个 SKILL.md 文件，每个文件按以下映射全局替换：

| 旧引用 | 新引用 |
|---|---|
| `cdd-exec.mjs` | `cdd-review.mjs` |
| `cdd-exec` | `cdd-review` |
| `cdd-run.mjs` | `cdd-task.mjs` |
| `cdd-run` | `cdd-task` |

**特别注意——zh-CN 伪代码修复：**

`brainstorming/SKILL.zh-CN.md` Line 60-61：

旧：
```markdown
spec review 分 3 类 pass（completeness / consistency&scope / clarity&YAGNI），每 pass 一次 fresh `cdd-exec` 派发：
  cdd-exec --harness claude --prompt "<spec-document-reviewer 模板 + pass 类别 + 文档路径>"
```

新：
```markdown
spec review 分 3 类 pass（completeness / consistency&scope / clarity&YAGNI），每 pass 一次 fresh `cdd-review` 派发：
  cdd-review --harness claude --template spec-review --param PASS=<completeness|consistency|clarity> --param DOC=<path>
```

`writing-plans/SKILL.zh-CN.md` Line 26-27：

旧：
```markdown
计划 review 分 3 类 pass（completeness & spec alignment / task decomposition / buildability & type consistency），每 pass 一次 fresh `cdd-exec` 派发：
  cdd-exec --harness claude --prompt "<plan-document-reviewer 模板 + pass 类别 + 文档路径>"
```

新：
```markdown
计划 review 分 3 类 pass（completeness & spec alignment / task decomposition / buildability & type consistency），每 pass 一次 fresh `cdd-review` 派发：
  cdd-review --harness claude --template plan-review --param PASS=<completeness|decomposition|buildability> --param DOC=<plan-path> --param SPEC=<spec-path>
```

- [ ] **Step 2: 文档文件**

编辑 `packages/osuperpowers/docs/cdd-reference.md` + `.zh-CN.md`：

| 位置 | 旧 | 新 |
|---|---|---|
| H6 entry 注释 | `cdd-run.mjs --harness <name>` | `cdd-task.mjs --harness <name>` |
| CLI 示例 | `cdd-run.mjs --harness <name> --task N --mode implement` | `cdd-task.mjs ...` |
| H7 规则 | `cdd-run*` | `cdd-task*` |
| H7 脚本列表 | `cdd-run.mjs` / `cdd-exec.mjs` | `cdd-task.mjs` / `cdd-review.mjs` |
| H8 注册表说明 | `cdd-run.mjs` | `cdd-task.mjs` |
| Mode B（保留） | `cdd-run.mjs --plan` | `cdd-task.mjs --plan` |
| Gate allowlist | `cdd-run.mjs` | `cdd-task.mjs` |
| Gate shell contract | `cdd-run.mjs` | `cdd-task.mjs` |

编辑 `packages/osuperpowers/docs/review-dispatch.md` + `.zh-CN.md`：

`cdd-exec` → `cdd-review`（各 1 处）

- [ ] **Step 3: 模板文件**

编辑 `packages/osuperpowers/templates/cdd/fix.md`：

```
cdd-run.mjs → cdd-task.mjs（1 处）
```

- [ ] **Step 4: 外部文件**

编辑 `README.md` + `README.zh-CN.md`：
```
cdd-run.mjs → cdd-task.mjs（2 处）
```

编辑 `packages/osuperpowers/CLAUDE.md`：
```
cdd-run.mjs → cdd-task.mjs（1 处）
```

编辑 `scripts/ci-validate.mjs`：
```javascript
"bin/engine/cdd-run.mjs" → "bin/engine/cdd-task.mjs",
"bin/engine/cdd-exec.mjs" → "bin/engine/cdd-review.mjs",
```

编辑 `packages/osuperpowers-router/tests/validate-overrides-build.mjs`：
```javascript
["cdd-run.mjs" → "cdd-task.mjs", "cdd-select.mjs", "cdd-exec.mjs" → "cdd-review.mjs"]
```

编辑 `packages/osuperpowers-router/docs/cross-harness-overrides.md`：
```
cdd-run.mjs → cdd-task.mjs（3 处）
cdd-exec.mjs → cdd-review.mjs（1 处）
```

- [ ] **Step 5: Emit + Commit**

```bash
pnpm run emit
git add -A
git commit -m "docs: update all SKILL.md, docs, templates, and configs for cdd-review/cdd-task rename"
```

### Task 7: 全量验证

**Files:**
- （不修改文件——仅运行验证命令）

- [ ] **Step 1: Emit freshness check**

```bash
pnpm run emit:check
```

- [ ] **Step 2: 全量验证**

```bash
pnpm run validate
```

预期：ALL PASS

- [ ] **Step 3: 残留引用扫描**

```bash
# 代码库中不应有任何 cdd-exec 或 cdd-run 引用
grep -rn 'cdd-exec\|cdd-run' --include='*.mjs' --include='*.md' --include='*.json' packages/ scripts/ *.md .claude-plugin/ 2>/dev/null | grep -v node_modules | grep -v '.git/' | grep -v CHANGELOG | grep -v 'docs/superpowers/'
```

预期：CLEAN（仅 CHANGELOG 中历史引用保留；`docs/superpowers/specs/`、`docs/superpowers/plans/`、`docs/superpowers/tickets/` 中 spec/plan/ticket 文档作为历史引用也允许保留）