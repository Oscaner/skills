# CLI Reviewer Pipeline — Overall Spec

- **Version**: v2.0 . 2026-08-20
- **Status**: Draft
- **Author**: Oscaner Miao . Claude Opus 4.8 (1M context)
- **Constraints**:
  - 模板文件使用与现有 `templates/cdd/` 一致的 `{{PLACEHOLDER}}` 双花括号插值语法
  - CLI 入口命名自文档化其职责——AI 无需查文档即可推断使用场景
  - 重命名不留别名/兼容层

## Section 0: Document scope

此 overall spec 覆盖三个 issue 的联合分解：

- [#140 — spec-review 与 plan-review 的 reviewer prompt 模板缺失，且 CLI 插值语法不可执行](https://github.com/Oscaner/skills/issues/140)
- [#146 — cdd: 无 CLI code-review 路径——T3 review 和 final whole-branch review 均绕过 engine 用 Agent](https://github.com/Oscaner/skills/issues/146)
- [#153 — cdd-exec 与 cdd-run 命名语义无区分——"exec" vs "run" 是同义词](https://github.com/Oscaner/skills/issues/153)

Overall approval 不等于各 phase 启动（GATE）。偏差先更新此文件（sync to overall）。

## Section 1: Program charter

**目标：** 建立统一的 reviewer CLI 体系——四种 review 类型统一走 `cdd-review --template`；per-task 三模式链走 `cdd-task --mode`。CLI 入口命名自文档化：`cdd-review` = 做 review 的，`cdd-task` = 做 task 的。

**非目标：**
- 不改动 `osuperpowers:code-review` skill（已存在，处理 review 反馈）
- 不引入新的 harness CLI 工具

**CLI 入口体系（P2 最终态）：**

| CLI | 职责 | 调用 |
|---|---|---|
| `cdd-task` | per-task 三模式链（implement / task-review / fix） | `cdd-task --task N --mode implement\|task-review\|fix` |
| `cdd-review` | 所有 review 类型的一次性 dispatch | `cdd-review --template spec-review\|plan-review\|branch-review --param ...` |
| `cdd-select` | harness 检测（不变） | `cdd-select` |

**四种 review 命名体系：**

| 类型 | CLI 入口 | 模板 | 语义 |
|---|---|---|---|
| spec-review | `cdd-review --template spec-review` | `spec-review.md` | 文档审查：spec 文件 |
| plan-review | `cdd-review --template plan-review` | `plan-review.md` | 文档审查：plan 文件 |
| task-review | `cdd-task --mode task-review` | `task-review.md` | 代码审查：单 task diff（CDD 链内） |
| branch-review | `cdd-review --template branch-review` | `branch-review.md` | 代码审查：跨 task / whole-branch diff |

**重命名映射：**

| 旧名 | 新名 | 理由 |
|---|---|---|
| `cdd-exec.mjs` | `cdd-review.mjs` | "exec" 与 "run" 同义——`cdd-review` 自文档化：做 review 的 |
| `cdd-run.mjs` | `cdd-task.mjs` | 与 `cdd-review` 对称——`cdd-task` 自文档化：做 task 的 |

## Section 2: Phase inventory

| # | Phase | Design spec | Implementation plan | Issue |
|---|---|---|---|---|
| P1 | **Prompt 模板落地 + cdd-exec 可执行插值 + review→task-review 重命名** — 创建 `spec-review.md`、`plan-review.md`；`cdd-exec.mjs` 增加 `--template <name> --param KEY=VALUE...`；`review` → `task-review` 全量重命名（CLI/模板/env/harness registry/cdd-reference/SKILL.md/测试）；brainstorming / writing-plans SKILL.md 调用语法更新为可执行形式。 | [2026-08-20-cli-reviewer-pipeline-p1-design.md](2026-08-20-cli-reviewer-pipeline-p1-design.md) | [Shipped] | #140 |
| P2 | **cdd-exec→cdd-review 重命名 + cdd-run→cdd-task 重命名 + branch-review 模板** — 解决 #153 和 #146：两个 CLI 入口重命名（`cdd-exec.mjs`→`cdd-review.mjs`、`cdd-run.mjs`→`cdd-task.mjs`）；新增 `templates/cdd/branch-review.md`；所有引用文件同步更新（runner/registry/templates/docs/SKILL/测试/gate/cdd-select） | [Pending] | [Pending] | #146 + #153 |

## Section 3: Dependency graph (ASCII)

```
P1 (templates + --template + task-review 重命名)
│
└── P2 (cdd-exec→cdd-review + cdd-run→cdd-task + branch-review 模板)
```

P2 依赖 P1 的模板插值基础设施和 `task-review` 命名稳定性。P2 同时解决 #153（命名）和 #146（branch-review），因为命名方案直接决定了 branch-review 的 CLI 入口归属。

## Section 4: Boundary rules

> 每个 phase：完整 brainstorming → design → plan → dev。依赖 phase 须在其上游 shipped 后启动。
> P1 解决 #140；P2 解决 #146 + #153。
> 各 phase spec 不重复 overall constrains，冲突时 overall 胜出。
> 重命名不留别名——`cdd-exec` / `cdd-run` 旧名在 CLI/模板/代码中完全消失。
> `--mode` 名称（implement / task-review / fix）不再变更。

## Section 5: Maintenance

- CLI entry：`packages/osuperpowers/bin/engine/cdd-task.mjs`（原 cdd-run.mjs）、`cdd-review.mjs`（原 cdd-exec.mjs）、`cdd-select.mjs`
- Runner core：`packages/osuperpowers/bin/engine/lib/runner.mjs`、`registry.mjs`、`templates.mjs`
- 模板文件：`packages/osuperpowers/templates/cdd/`
- Harness registry：`packages/osuperpowers/bin/engine/harness-registry.json`
- Gate：`packages/osuperpowers/bin/gate/cdd-gate-core.mjs`（Shell allowlist 中的 `cdd-run.mjs` 引用）
- 受影响 SKILL.md：`skills/brainstorming/`、`skills/writing-plans/`、`skills/cli-driven-development/`、`skills/cli-task/`、`skills/cli-code-review/`
- cdd-select.mjs（harness 推荐算法引用）
- 测试文件：`bin/engine/tests/` + `bin/gate/tests/`
- 文档：`docs/cdd-reference.md` (+ zh-CN)、`docs/review-dispatch.md`

## Section 6: Change history

- 2026-08-20 — v1.0 initial draft
- 2026-08-20 — v1.1 重构命名体系：四种 review 结构化命名，`review` → `task-review` 全量重命名
- 2026-08-20 — v2.0 合并 #153（cdd-exec/cdd-run 重命名）入 overall scope，P2 scope 扩展为：CLI 入口重命名 + branch-review 模板，P1 状态更新为 Shipped