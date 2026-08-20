# cdd-run: 删除 --plan Mode B

- **Version**: v1.0, 2026-08-20
- **Status**: Draft
- **Author**: Oscaner Miao, Claude Opus 4.8 (1M context)
- **Constraints**: 不破坏 Mode A per-task 路径；测试全部通过

## 背景

CDD engine 的 `cdd-task.mjs` 支持两种模式：

- **Mode A**：`--harness <name> --task N --mode implement|task-review|fix`（per-task，orchestrator 显式调用）
- **Mode B**：`--harness <name> --plan PATH`（whole-plan runner，自动遍历所有 pending task）

Mode B 在 runner.mjs 中实现为 `runPlan` + `runTaskChain`。问题在于它绕过了 CDD 的核心约束——per-task 可见性。Orchestrator 在每个 task 边界都需要看到 H1 四行输出、handoff 状态，并决定是否进入 fix loop。Mode B 一次性跑完所有 task，orchestrator 失去了这些决策点。

## 方案

删除 Mode B，`cdd-task.mjs` 只保留 Mode A（per-task 显式调用）。`--plan` 参数降级为 Mode A 的可选参数（通过 `PLAN_FILE` env 传递 plan 文件绝对路径给 `runTask`，用于 workspace 解析和 task-review 的 review-package 调用）。

### 变更清单

| 文件 | 操作 | 变更 |
|---|---|---|
| `bin/engine/cdd-task.mjs` | 修改 | 移除 Mode B 分支（`else { // Mode B }`）；usage/help 字符串移除 `\| --plan PATH` 变体；`--plan` 仅作为 Mode A 的可选参数（仅当 `--task` 存在时有效），检测到 `--plan` 且无 `--task` → usage + exit 2 |
| `bin/engine/lib/runner.mjs` | 修改 | 删除 `runPlan`、`runTaskChain`、`chainBlocked`、`chainRunTaskFailed` 四个函数；移除 `writePlanConstraints` import（其唯一调用点即 `runPlan`；函数定义保留在 `ledger.mjs` 中，`writePlanConstraints` 的测试继续有效） |
| `docs/cdd-reference.md` | 修改 | 删除 "Mode B (opt-in / AFK)" 整个独立章节（位于 H7 之前，无其他章节交叉引用） |
| `osuperpowers-router/docs/cross-harness-overrides.md` | 修改 | 删除 Mode B 描述段落（"Mode B (plan driver / AFK)"）和示例命令（`--plan <path>`） |
| `bin/engine/tests/task.test.mjs` | 修改 | 删除 "Mode B dry-run 无 pending task" 和 "Mode B dirty-tree 实现" 两个测试用例 |

### 不修改

- `bin/engine/tests/runner.test.mjs` — 测试 `runTask`、构建块纯函数、`invokeCli`、`findSuperpowersScriptsDir`，均不依赖 Mode B
- `taskNumbersFromPlan`、`isTaskPending`、`handoffStatus` 纯函数保留在 `runner.mjs` 中（仅被测试引用，保留作为未来 orchestrator 可能的构建块）
- `writePlanConstraints` 函数定义保留在 `ledger.mjs` 中，测试继续有效
- `cdd-review.mjs` — 独立的一次性 prompt-runner，不依赖 `--plan`/Mode B 路径
- `cross-harness-overrides.md` 中的 Mode B 内容独立段落，删除后不影响同一文件中的 Mode A 描述

## 验收标准

1. `cdd-task.mjs --harness claude --plan <path>`（无 `--task`）→ usage stderr + exit 2
2. `cdd-task.mjs --harness claude --task 1 --mode implement --plan <path>`（Mode A + --plan）→ 正常运行
3. `cdd-task.mjs --harness claude --task 1 --mode implement`（Mode A 不带 --plan）→ 正常运行
4. `pnpm run validate` 通过
5. `node --test packages/osuperpowers/bin/engine/tests/` 全部通过