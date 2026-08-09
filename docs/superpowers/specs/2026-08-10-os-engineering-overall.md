# os-engineering 抽离整体设计（Overall）

## Header

- **Version**: v1.4 · 2026-08-10
- **Status**: Approved · 2026-08-10（分解经用户批准）
- **Author**: Oscaner Miao · Claude Code (Opus 4.8)
- **Constraints**:
  - Conventional commits，无 attribution / co-author trailer
  - 禁用 git worktree
  - 过渡期 `pnpm run validate` 必须保持通过

## §0 Document scope

- 仅章程，无实现细节、无验收标准。
- **Overall 批准 ≠ 阶段已启动**（SKILL step 4 GATE — 须等待用户显式启动某阶段）。
- 跨阶段偏差先更新本文件（Rule 3b）。

## §1 Program charter

**Goal:** 把 superpowers-overrides 的规则体系抽离为独立 first-party 插件 `os-engineering`，并新增 CLI 编排家族：

1. `os-*` 家族 = 独立流程编排技能（**非 override**）。每条技能是一条完整流程的总编排，可被直接调用；内部按序**读取**所需上游技能（`superpowers:*`、`mattpocock-skills:*`）作为子步骤，再叠加个人规则。
2. `cli-*` 家族 = 独立 CLI 编排技能。新增 harness 选择（`cli-select`）、通用一次性派发（`cli-task`）、CLI 三模式开发链（`cli-driven-development`）、CLI 代码评审（`cli-code-review`）；droid / pi 作为新增 **full** harness，实现「运行 cli 技能时询问用哪个 cli」。
3. superpowers-overrides 收缩为**薄封装**：spor-* 只做「上游 slash 触发 → 对应 os-*/cli-* 技能」的映射，移除全部规则内容。
4. overall + phase 模板迁入 os-engineering 插件 docs。

**Non-goals:**

- 不新增/修改上游 superpowers 插件内容。
- 不改变 SDD CLI 契约语义（handoff、三模式 implement/review/fix 链、exit codes 0/1/2）。
- 不改变其余插件（mattpocock-skills、impeccable）的归属与内容。
- P1 不抽离 os-* 家族（推迟到 P2）。

**Cross-cutting constraints:**

- 过渡期 SDD CLI 链必须持续可用 —— 每个阶段结束时 orchestrator 仍能跑通当前工作流。
- harness 机制迁移后，`pnpm run validate` 断言（validate-overrides-build.sh 等）必须同步更新。
- 命名：插件 `os-engineering`；技能前缀 `os-*`（流程家族）+ `cli-*`（CLI 家族）。
- **gate 模式感知（P2 落地）**：`sdd-orchestrator-gate.sh` 随 cli-driven-development 迁至 os-engineering；P2 起 gate 按模式放行 —— CLI 模式保持严格（repo 编辑只走 CLI shell），in-session 模式放行 repo 编辑。
- **os-init 参数化**：`os-init spor` 初始化 superpowers 自检表；未来可扩展 `os-init <x>`。
- **sdd → cdd 全量更名（P1 落位）**：新插件内 `SDD_*` 环境变量 → `CDD_*`；`sdd-common.sh` → `cdd-common.sh`；`sdd-orchestrator-gate.sh` → `cdd-orchestrator-gate.sh`；通用 runner `cdd-run.sh`；workspace `.superpowers/sdd/` → `.superpowers/cdd/`（内联重实现 workspace resolver，不再调用上游 `sdd-workspace`）；`docs/sdd-h6-reference.md` → `docs/cdd-reference.md`；`templates/sdd-cli/` → `templates/cdd/`。唯一保留的上游名：`task-brief` / `review-package`（submodule 脚本，以显式输出路径指向 cdd workspace 调用）。缩写规范：`cdd` = cli-driven-development（镜像 `sdd` = subagent-driven-development）；skill 家族用 `cli-*` 前缀。
- **规则命名规范（P1 起，全插件生效）**：语义名 + 链接引用 —— 标题 `### Rule: <Semantic Name>`（如 `### Rule: Task Complexity`），无数字、无 a/b/c 子后缀（子规则升为独立语义规则或语义子标题）；跨技能引用用 markdown 链接 `[Rule: <Name>](../<skill>/SKILL.md#rule-<kebab>)`；`rule-reference.test.py` 从正则 `Rule [0-9]+` 改为验证语义名解析（P1 对 cdd 技能、P2 对 os-* 技能落地）。

## §2 Phase inventory

| # | Phase | Design spec | Implementation plan |
|---|---|---|---|
| P1 | **插件骨架 + cli-* 家族 + droid/pi + harness 选择 + cli 模式重组**。创建 os-engineering 插件（marketplace/source.json 注册、plugin.json、CI validate 接入）；迁入并**重组** SDD harness 机制：声明式 harness registry（JSON：harness → cli_bin / invocation flags / output format / review_prefix / ship level）+ 单一通用 runner `cdd-run.sh`（`--harness <name> --task N --mode …` 或 `--plan`），**删除 per-harness 包装脚本与 stub 脚本**；新增 droid / pi 两个 full harness（分析并合并 `tmp/droid-example.sh` 可借鉴点：stream-json 解析 / `--auto` 级别 / completion sentinel）；迁入 `templates/sdd-cli/`、`docs/sdd-h6-reference.md`；cross-cutting `spor-token-efficient-controller-handoff`（H1–H5）与 `spor-handoff-writer` 降为插件 docs（并入 cli-driven-development 契约）；新增 `cli-select`（读 registry + `command -v` 列出已装 full harness + 询问 + 推荐 droid>pi>当前 harness）、`cli-task`（通用一次性派发）、`cli-driven-development`（三模式链）、`cli-code-review`。过渡期同步 superpowers-overrides 的 spor-sdd 引用指向新位置；全量 sdd→cdd 更名（CDD_* env / cdd-common.sh / cdd-run.sh / .superpowers/cdd/ / cdd-reference.md / templates/cdd/）。 | [Pending] | [Pending] |
| P2 | **os-* 家族抽离**。`os-brainstorming` / `os-writing-plans` / `os-executing-plans`（总编排：用户选择 CLI → 委托 `cli-driven-development`，或 in-session 路径）/ `os-finishing`（含 worktree 拒绝，吸收 spor-using-git-worktrees）/ `os-code-review` / `os-debugging` / `os-testing` / `os-verification` / `os-report-issue`。cross-cutting `spor-subagent-lifecycle`、`spor-token-efficient-review-dispatch` 降为插件 docs 引用；overall + phase 模板迁入；**gate 模式感知落地**（in-session 放行 repo 编辑）。 | [Pending] | [Pending] |
| P3 | **薄封装**。superpowers-overrides 的 spor-* 全部改为「触发 → 目标」映射并移除规则内容；`os-init` 落位（参数化 `os-init spor`）；删除死技能（spor-sdd-p0-fallback、spor-executing-plans 已删）；hooks / 生成器 / 自检表按新映射重写（spor-init 生成表指向 os-*/cli-*）；README / cross-harness-overrides 文档更新；os-engineering 独立版本化 + 发布链调整。 | [Pending] | [Pending] |

## §3 Dependency graph (ASCII)

```
P1（插件骨架 + cli-* 家族 + droid/pi + 选择）──▶ P2（os-* 家族）──▶ P3（薄封装）
```

- P1 → P2：插件存在、模式确立、harness 机制与 cli-driven-development 就位后，os-* 才能引用它们。
- P2 → P3：薄封装需要 os-* 目标全部存在才能映射。

## §4 Boundary rules

> 每阶段：完整 brainstorming → plan → dev。依赖方在依赖就绪后才启动。

## §5 Maintenance

- 每阶段更新链接 + 变更历史；无任务列表。
- 本文件为跨阶段约定主文档；阶段 spec 增量。
- 策略偏移 / 拆分立即反馈本文件（Rule 3b）。

## §6 Change history

- v1.0 · 2026-08-10 · 初稿（分解 P1 cli 家族 → P2 os 家族 → P3 薄封装）
- v1.1 · 2026-08-10 · P1 范围扩为「cli 模式重组」：声明式 harness registry + 单一通用 runner（cli-run.sh）替代 per-harness 包装脚本与 stub 脚本（用户确认的清理无用代理决定）
- v1.2 · 2026-08-10 · 完整迁移清单落定：17 个 spor-* 技能全部归类（os-* 9 / cli-* 4 / docs 4 / 删除 2 / os-init 参数化 + os-report-issue 迁移）；gate 模式感知定在 P2；os-init 支持参数化（init spor / init <x>）
- v1.3 · 2026-08-10 · sdd → cdd 全量更名落定（P1）：CDD_* env / cdd-common.sh / cdd-run.sh / .superpowers/cdd/ / cdd-reference.md / templates/cdd/；内联重实现 workspace resolver，仅保留上游 task-brief/review-package 脚本名。缩写规范：cdd = cli-driven-development（镜像 sdd），skill 家族用 cli-* 前缀
- v1.4 · 2026-08-10 · 规则命名规范定稿：语义名 + 链接引用（`### Rule: <Name>`，无数字/子后缀），rule-reference.test.py 改为验证语义名
