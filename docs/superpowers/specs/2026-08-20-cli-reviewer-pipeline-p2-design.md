# P2 — cdd-exec→cdd-review + cdd-run→cdd-task 重命名 + branch-review 模板

- **Version**: v1.0 . 2026-08-20
- **Status**: Draft
- **Author**: Oscaner Miao . Claude Opus 4.8 (1M context)
- **Parent program**: [CLI Reviewer Pipeline Overall](../specs/2026-08-20-cli-reviewer-pipeline-overall.md) v2.0
- **Depends on**: P1（Shipped —— `templates.mjs` `renderModePrompt`、`cdd-exec --template`、`task-review` 重命名已完成）

## Section 0: Incremental warning

> P2 increment only。Cross-phase 约定见 [overall](../specs/2026-08-20-cli-reviewer-pipeline-overall.md)；冲突时 overall 胜出。

## Section 1: Constraints pointer

> 不重复 overall 约定。Overall 胜出。重点约束：
> - 重命名不留别名——`cdd-exec` / `cdd-run` 旧名完全消失
> - `--mode` 名称（implement / task-review / fix）不再变更
> - `cdd-review` = 所有 review 类型的一次性 dispatch；`cdd-task` = per-task 三模式链

## Section 2: Design body

### 2.1 架构总览

```
cdd-review --template <name> --param KEY=VALUE...
    │
    ├── 复用 P1 的 renderTemplate + invokeCli
    ├── template 名 → templates/cdd/<name>.md
    └── 支持：spec-review / plan-review / branch-review（新增）

cdd-task --task N --mode implement|task-review|fix
    │
    ├── 复用 runner.mjs runTask
    └── 行为与 P1 的 cdd-run.mjs 完全一致（仅文件重命名）
```

### 2.2 文件重命名

| 旧路径 | 新路径 |
|---|---|
| `bin/engine/cdd-exec.mjs` | `bin/engine/cdd-review.mjs` |
| `bin/engine/cdd-run.mjs` | `bin/engine/cdd-task.mjs` |

两个文件内容同步更新：文件头注释中的路径引用、`const NAME` 从 `path.basename(...)` 自动获取新名称（无需手动改 NAME 赋值）。

### 2.3 新增模板

#### `templates/cdd/branch-review.md`

Whole-branch code review prompt 模板。参数化：

| 占位符 | 含义 | 来源 |
|---|---|---|
| `{{BASE}}` | git base ref（merge-base 或起始 commit） | `--param BASE=<sha>` |
| `{{HEAD}}` | git head ref（默认 "HEAD"） | `--param HEAD=<sha>` |
| `{{PLAN}}` | plan 文件路径（必传；无 plan 时传空字符串 `""`） | `--param PLAN=<path>` |

审查维度（从上游 `code-reviewer.md` 借取）：
- Plan alignment
- Code quality（separation of concerns、error handling、type safety、DRY、edge cases）
- Architecture（design decisions、scalability、security、integration）
- Testing（real behavior、edge cases、integration tests）
- Production readiness（migration、backward compatibility、docs、bugs）

输出 D3 findings-only JSON：`{"findings": [{"severity": "blocker|warn|nit", "file": "...", "line": N, "summary": "...", "fix": "..."}]}`

### 2.4 波及文件全量重命名

按模块分类：

#### 2.4.1 Engine core

| 文件 | 变更 |
|---|---|
| `bin/engine/cdd-exec.mjs` | 重命名 → `cdd-review.mjs`；注释中 "cdd-exec.mjs" → "cdd-review.mjs"、"cdd-exec.sh" → 移除（bash 已删）；`const NAME` 自动按新文件名推导 |
| `bin/engine/cdd-run.mjs` | 重命名 → `cdd-task.mjs`；注释中 "cdd-run.mjs" → "cdd-task.mjs"、"cdd-run.sh" → 移除；`const NAME` 自动按新文件名推导 |
| `bin/engine/lib/runner.mjs` | 注释 `cdd-exec.mjs` → `cdd-review.mjs`（1 处，行 161）；`cdd-run.mjs` 引用移除（仅注释）；`cdd-runner-` → `cdd-task-`（测试临时目录名不在此文件） |

#### 2.4.2 Gate（cdd-gate-core.mjs + 测试）

| 文件 | 变更 |
|---|---|
| `bin/gate/cdd-gate-core.mjs` | `cdd-run\.mjs` → `cdd-task\.mjs`（regex 行 74）；模板字符串 `bin/engine/cdd-run.mjs` → `bin/engine/cdd-task.mjs`（行 240、247）；注释 `cdd-run` → `cdd-task`（行 70、71） |
| `bin/gate/tests/pi-gate.test.mjs` | `cdd-run.mjs` → `cdd-task.mjs` |
| `bin/gate/tests/trae.test.mjs` | 同上 |
| `bin/gate/tests/kiro.test.mjs` | 同上 |
| `bin/gate/tests/opencode.test.mjs` | 同上 |
| `bin/gate/tests/gemini.test.mjs` | 同上 |
| `bin/gate/tests/qoder.test.mjs` | 同上 |
| `bin/gate/tests/vibe.test.mjs` | 同上 |
| `bin/gate/tests/cdd-gate-core.test.mjs` | `cdd-run` → `cdd-task`（第 72 行 regex 匹配） |
| `bin/gate/tests/codex.test.mjs` | 同上 |
| `bin/gate/tests/claude.test.mjs` | 同上 |
| `bin/gate/tests/cursor.test.mjs` | 同上 |

#### 2.4.3 Engine tests

| 文件 | 变更 |
|---|---|
| `bin/engine/tests/exec.test.mjs` | 文件重命名 → `review.test.mjs`；常量 `EXEC_MJS` → `REVIEW_MJS`（路径 → `cdd-review.mjs`）；所有 "cdd-exec" 字符串 → "cdd-review"（约 20 处）；临时目录 `cdd-exec-mock-` → `cdd-review-mock-` |
| `bin/engine/tests/run.test.mjs` | 文件重命名 → `task.test.mjs`；常量 `RUN_MJS` → `TASK_MJS`（路径 → `cdd-task.mjs`）；所有 "cdd-run" → "cdd-task"（约 15 处）；临时目录 `cdd-run-cli-` → `cdd-task-cli-` |
| `bin/engine/tests/runner.test.mjs` | 临时目录 `cdd-runner-` → `cdd-task-runner-`（1 处） |
| `bin/engine/tests/templates.test.mjs` | 注释 `cdd-exec` → `cdd-review`（2 处） |

#### 2.4.4 文档

| 文件 | 变更 |
|---|---|
| `docs/cdd-reference.md` | `cdd-run.mjs` → `cdd-task.mjs`（约 8 处）；`cdd-exec.mjs` → `cdd-review.mjs`（1 处）；H7 "No consumer-repo CLI scripts" 规则中 `cdd-run*` → `cdd-task*`；Mode B 章节（`cdd-task.mjs --plan`）保留内容但 #151 待删除 |
| `docs/cdd-reference.zh-CN.md` | 同上 |
| `docs/review-dispatch.md` | `cdd-exec` → `cdd-review`（1 处） |
| `docs/review-dispatch.zh-CN.md` | 同上（1 处） |
| `docs/controller-handoff.md` | `cdd-run.mjs` 引用检查——当前无直接引用 |
| `docs/controller-handoff.zh-CN.md` | 同上 |

#### 2.4.5 SKILL.md（skills/ + .agents/skills/）

| 文件 | 变更 |
|---|---|
| `skills/cli-driven-development/SKILL.md` | `cdd-run.mjs` → `cdd-task.mjs`（3 处） |
| `skills/cli-driven-development/SKILL.zh-CN.md` | 同上（3 处） |
| `skills/cli-select/SKILL.md` | `cdd-run.mjs` → `cdd-task.mjs`（1 处） |
| `skills/cli-select/SKILL.zh-CN.md` | 同上（1 处） |
| `skills/cli-task/SKILL.md` | `cdd-exec.mjs` → `cdd-review.mjs`（2 处）；`cdd-run.mjs` → `cdd-task.mjs`（1 处） |
| `skills/cli-task/SKILL.zh-CN.md` | 同上 |
| `skills/cli-code-review/SKILL.md` | `cdd-exec.mjs` → `cdd-review.mjs`（1 处） |
| `skills/cli-code-review/SKILL.zh-CN.md` | 同上 |
| `skills/brainstorming/SKILL.md` | `cdd-exec` CLI 调用示例（1 处） |
| `skills/brainstorming/SKILL.zh-CN.md` | `cdd-exec` → `cdd-review` + 旧伪代码语法 → 新 `--template` 语法（1 处） |
| `skills/writing-plans/SKILL.md` | `cdd-exec` CLI 调用示例（1 处） |
| `skills/writing-plans/SKILL.zh-CN.md` | `cdd-exec` → `cdd-review` + 旧伪代码语法 → 新 `--template` 语法（1 处） |
| `skills/executing-plans/SKILL.md` | `cdd-run.mjs` → `cdd-task.mjs`（2 处） |
| `skills/executing-plans/SKILL.zh-CN.md` | 同上（2 处） |
| `skills/report-issue/SKILL.md` | `cdd-run.mjs` → `cdd-task.mjs`（3 处） |
| `skills/report-issue/SKILL.zh-CN.md` | 同上（3 处） |
| `.agents/skills/osuperpowers/*/SKILL.md` | `pnpm run emit` 重新同步（所有上述 SKILL.md 的 .agents 镜像） |
| `.agents/skills/osuperpowers/*/SKILL.zh-CN.md` | 同上 |

#### 2.4.6 外部文件

| 文件 | 变更 |
|---|---|
| `README.md` | `cdd-run.mjs` → `cdd-task.mjs`（2 处） |
| `README.zh-CN.md` | 同上 |
| `CLAUDE.md` | `cdd-run.mjs` → `cdd-task.mjs`（1 处） |
| `scripts/ci-validate.mjs` | `"cdd-run.mjs"` → `"cdd-task.mjs"`；`"cdd-exec.mjs"` → `"cdd-review.mjs"` |
| `packages/osuperpowers-router/tests/validate-overrides-build.mjs` | `"cdd-run.mjs"` → `"cdd-task.mjs"`；`"cdd-exec.mjs"` → `"cdd-review.mjs"` |
| `packages/osuperpowers-router/docs/cross-harness-overrides.md` | `cdd-run.mjs` → `cdd-task.mjs`（3 处）；`cdd-exec.mjs` → `cdd-review.mjs`（1 处） |
| `templates/cdd/fix.md` | `cdd-run.mjs` → `cdd-task.mjs`（1 处） |

### 2.5 brainstorming/SKILL.zh-CN.md 和 writing-plans/SKILL.zh-CN.md 特别修复

这两个文件在 P1 中未被完全更新——仍保留旧的 `--prompt "<...>"` 伪代码语法。P2 一并修复为：

```bash
# brainstorming/SKILL.zh-CN.md
cdd-review --harness claude --template spec-review --param PASS=<completeness|consistency|clarity> --param DOC=<path>

# writing-plans/SKILL.zh-CN.md
cdd-review --harness claude --template plan-review --param PASS=<completeness|decomposition|buildability> --param DOC=<plan-path> --param SPEC=<spec-path>
```

### 2.6 branch-review 模板设计

模板 `templates/cdd/branch-review.md` 内容：

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

### 2.7 错误处理

与 P1 的 `cdd-exec --template` 相同：模板不存在 → exit 1；占位符缺失 → exit 1；`--template` + `--prompt` 互斥 → exit 2。

### 2.8 Acceptance Criteria

1. `cdd-exec.md` / `cdd-run.mjs` 文件名在代码库中完全消失
2. `cdd-review --template spec-review --param DOC=... --param PASS=...` 正常执行
3. `cdd-review --template plan-review --param DOC=... --param SPEC=... --param PASS=...` 正常执行
4. `cdd-review --template branch-review --param BASE=... --param HEAD=...` 正常执行
5. `cdd-task --task N --mode implement|task-review|fix` 行为与重命名前的 `cdd-run` 完全一致
6. Gate `cdd_shell_allowed` regex 匹配 `cdd-task.mjs`（不放行 `cdd-run.mjs`）
7. Gate deny 消息中恢复指引指向 `cdd-task.mjs`
8. 所有 SKILL.md 的 CLI 调用示例指向新文件名
9. brainstorming/writing-plans SKILL.zh-CN.md 的伪代码语法修复为 `--template` 形式
10. `pnpm run validate` 全部通过

## Section 3: Deviations from overall

无——P2 严格按照 overall v2.0 执行，范围包括 #146 + #153。

## Section 4: Notes for downstream

P2 是 CLI Reviewer Pipeline 的最后一个 phase。完成后四种 review 全部就位：
- `cdd-review --template spec-review` + `cdd-review --template plan-review`（P1）
- `cdd-task --mode task-review`（P1）
- `cdd-review --template branch-review`（P2）

后续可能的迭代（不在本 program scope 内）：
- #151 删除 Mode B（--plan whole-plan runner）
- #154 task brief bash 提取工具
- #155 SDD/CDD workspace 路径统一

## Section 5: Review

TBD — spec self-review 后填入结果。