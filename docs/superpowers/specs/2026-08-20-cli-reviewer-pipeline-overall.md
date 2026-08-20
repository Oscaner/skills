# CLI Reviewer Pipeline — Overall Spec

- **Version**: v1.1 . 2026-08-20
- **Status**: Draft
- **Author**: Oscaner Miao . Claude Opus 4.8 (1M context)
- **Constraints**:
  - 模板文件使用与现有 `templates/cdd/` 一致的 `{{PLACEHOLDER}}` 双花括号插值语法
  - `cdd-exec.mjs` 参数扩展不影响现有 `--prompt` 使用方式
  - 四种 review 命名语义明确，AI 可无歧义区分

## Section 0: Document scope

此 overall spec 覆盖两个 issue 的联合分解：

- [#140 — spec-review 与 plan-review 的 reviewer prompt 模板缺失，且 CLI 插值语法不可执行](https://github.com/Oscaner/skills/issues/140)
- [#146 — cdd: 无 CLI code-review 路径——T3 review 和 final whole-branch review 均绕过 engine 用 Agent](https://github.com/Oscaner/skills/issues/146)

Overall approval 不等于各 phase 启动（GATE）。偏差先更新此文件（sync to overall）。

## Section 1: Program charter

**目标：** 建立统一的 reviewer CLI 体系——四种 review 类型（spec-review / plan-review / task-review / branch-review），命名结构化，AI 可无歧义区分调用方式。`cdd-exec --template` 提供可插值的模板化 prompt 调度；`cdd-run --mode` 扩展支持 task-review（重命名）和 branch-review（新增）。

**非目标：**
- 不改动 `osuperpowers:code-review` skill（已存在，处理 review 反馈）
- 不引入新的 harness CLI 工具

**命名体系（四种 review）：**

| 类型 | CLI 入口 | 模板 | 语义 |
|---|---|---|---|
| spec-review | `cdd-exec --template spec-review` | `spec-reviewer.md` | 文档审查：spec 文件 |
| plan-review | `cdd-exec --template plan-review` | `plan-reviewer.md` | 文档审查：plan 文件 |
| task-review | `cdd-run --mode task-review` | `task-review.md` | 代码审查：单 task diff（CDD 链内） |
| branch-review | `cdd-run --mode branch-review` | `branch-review.md` | 代码审查：跨 task / whole-branch diff |

**`review` → `task-review` 重命名（零技术债）：**

波及所有层面——CLI entry、env 变量、模板文件名、harness registry、handoff fragment、cdd-reference、SKILL.md、测试文件。不留旧名别名/兼容层。

## Section 2: Phase inventory

| # | Phase | Design spec | Implementation plan |
|---|---|---|---|
| P1 | **Prompt 模板落地 + cdd-exec 可执行插值 + review→task-review 重命名** — 创建 `spec-review.md`、`plan-review.md`；`cdd-exec.mjs` 增加 `--template <name> --param KEY=VALUE...`；`review` → `task-review` 全量重命名（CLI/模板/env/harness registry/cdd-reference/SKILL.md/测试）；brainstorming / writing-plans SKILL.md 调用语法更新为可执行形式。解决 [#140](https://github.com/Oscaner/skills/issues/140)。 | [Pending] | [Pending] |
| P2 | **cdd-run 新增 --mode branch-review** — 新增 `templates/cdd/branch-review.md` + `templates/cdd/branch-review.md`（reviewer prompt）；`cdd-run.mjs` `VALID_MODES` 扩展 `branch-review`；`runner.mjs` 适配新模式；`cli-driven-development/SKILL.md` 更新。解决 [#146](https://github.com/Oscaner/skills/issues/146)。 | [Pending] | [Pending] |

## Section 3: Dependency graph (ASCII)

```
P1 (templates + cdd-exec --template + review→task-review)
│
└── P2 (--mode branch-review + cdd-run)
```

P2 依赖 P1 的模板插值基础设施和重命名后的 `task-review` 模式一致性。P1 可独立交付（解决 #140）。

## Section 4: Boundary rules

> 每个 phase：完整 brainstorming → design → plan → dev。依赖 phase 须在其上游 shipped 后启动。
> P1 解决 #140；P2 解决 #146。
> 各 phase spec 不重复 overall constrains，冲突时 overall 胜出。
> 重命名不留别名——`review` 旧值在 CLI/模板/代码中全部消失。

## Section 5: Maintenance

- 模板文件：`packages/osuperpowers/templates/cdd/`
- CLI entry：`packages/osuperpowers/bin/engine/cdd-exec.mjs`、`cdd-run.mjs`
- Runner core：`packages/osuperpowers/bin/engine/lib/runner.mjs`、`registry.mjs`、`templates.mjs`
- Harness registry：`packages/osuperpowers/bin/engine/harness-registry.json`
- 受影响 SKILL.md：`skills/brainstorming/`、`skills/writing-plans/`、`skills/cli-driven-development/`
- 文档：`docs/cdd-reference.md`、`docs/review-dispatch.md`
- Cross-phase 模板插值约定在 overall 定义，各 phase spec 不重复

## Section 6: Change history

- 2026-08-20 — v1.0 initial draft
- 2026-08-20 — v1.1 重构命名体系：四种 review 结构化命名，`review` → `task-review` 全量重命名