# os-engineering 抽离整体设计（Overall）

## Header

- **Version**: v2.2 · 2026-08-10
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

**Goal:** 把 superpowers-overrides 的规则体系抽离为独立 first-party 插件 `engineering`，并新增 CLI 编排家族：

1. `os-*` 家族 = 独立流程编排技能（**非 override**）。每条技能是一条完整流程的总编排，可被直接调用；内部按序**读取**所需上游技能（`superpowers:*`、`mattpocock-skills:*`）作为子步骤，再叠加个人规则。
2. `cli-*` 家族 = 独立 CLI 编排技能。新增 harness 选择（`cli-select`）、通用一次性派发（`cli-task`）、CLI 三模式开发链（`cli-driven-development`）、CLI 代码评审（`cli-code-review`）；droid / pi 作为新增 **full** harness，实现「运行 cli 技能时询问用哪个 cli」。
3. superpowers-overrides 收缩为**薄封装**：spor-* 只做「上游 slash 触发 → 对应 os-*/cli-* 技能」的映射，移除全部规则内容。
4. overall + phase 模板迁入 engineering 插件 docs。

**Non-goals:**

- 不新增/修改上游 superpowers 插件内容（不改上游本体）。
- 不改变 SDD CLI 契约语义（handoff、三模式 implement/review/fix 链、exit codes 0/1/2）。
- P1 不抽离 os-* 家族（推迟到 P2）。
- （P4 起）submodules 迁至 `vendors/` 并纳入统一 npm 发布体系（构建期装配 republish，不编辑上游）（保留上游授权/归属；P4 变更此前的「不改变其余插件归属」约定）。

**Cross-cutting constraints:**

- 过渡期 SDD CLI 链必须持续可用 —— 每个阶段结束时 orchestrator 仍能跑通当前工作流。
- harness 机制迁移后，`pnpm run validate` 断言（validate-overrides-build.sh 等）必须同步更新。
- 命名：插件 `engineering`；技能前缀 `os-*`（流程家族）+ `cli-*`（CLI 家族）；**包名统一 `@oscaner-skills/` 作用域** —— `@oscaner-skills/marketplace`（root）/ `@oscaner-skills/engineering` / `@oscaner-skills/superpowers-overrides`
- **发布架构 v2（P4 落位，包即源）**：每个插件 = 独立 npm 包，`package.json` 是唯一元数据源（name/version/description/pi/hooks/分类）；source.json 降为派生（marketplace 聚合）；marketplace + harness manifests 从 packages 生成；pnpm workspace + changesets 统一版本/发布所有 `@oscaner-skills/*` 包；未来插件 = 加一个 package 目录自动接入 emit + 发布。目录：`packages/`（first-party 维护）+ `vendors/`（上游 submodule 源，**不编辑不维护**，发布时构建期装配 republish，保留上游授权）。
- **gate 模式感知（P2 落地，过渡期留 overrides）**：P2 起 gate 按 `pending.mode` 放行 —— cli 模式严格（repo 编辑只走 CLI shell），in-session/subagent 模式放行 repo 编辑。gate 本体（`cdd-orchestrator-gate.sh`）过渡期留 overrides，P3 随薄封装迁至 engineering。
- **os-init 参数化**：`os-init spor` 初始化 superpowers 自检表；未来可扩展 `os-init <x>`。
- **sdd → cdd 全量更名（P1 落位）**：新插件内 `SDD_*` 环境变量 → `CDD_*`；`sdd-common.sh` → `cdd-common.sh`；`sdd-orchestrator-gate.sh` → `cdd-orchestrator-gate.sh`；通用 runner `cdd-run.sh`；workspace `.superpowers/sdd/` → `.superpowers/cdd/`（内联重实现 workspace resolver，不再调用上游 `sdd-workspace`）；`docs/sdd-h6-reference.md` → `docs/cdd-reference.md`；`templates/sdd-cli/` → `templates/cdd/`。唯一保留的上游名：`task-brief` / `review-package`（submodule 脚本，以显式输出路径指向 cdd workspace 调用）。缩写规范：`cdd` = cli-driven-development（镜像 `sdd` = subagent-driven-development）；skill 家族用 `cli-*` 前缀。
- **规则命名规范（P1 起，全插件生效）**：语义名 + 链接引用 —— 标题 `### Rule: <Semantic Name>`（如 `### Rule: Task Complexity`），无数字、无 a/b/c 子后缀（子规则升为独立语义规则或语义子标题）；跨技能引用用 markdown 链接 `[Rule: <Name>](../<skill>/SKILL.md#rule-<kebab>)`；`rule-reference.test.py` 从正则 `Rule [0-9]+` 改为验证语义名解析（P1 对 cdd 技能、P2 对 os-* 技能落地）。

## §2 Phase inventory

| # | Phase | Design spec | Implementation plan |
|---|---|---|---|
| P1 | **插件骨架 + cli-* 家族 + droid/pi + harness 选择 + cli 模式重组**。创建 engineering 插件（marketplace/source.json 注册、plugin.json、CI validate 接入）；迁入并**重组** SDD harness 机制：声明式 harness registry（JSON：harness → cli_bin / invocation flags / output format / review_prefix / ship level）+ 单一通用 runner `cdd-run.sh`（`--harness <name> --task N --mode …` 或 `--plan`），**删除 per-harness 包装脚本与 stub 脚本**；新增 droid / pi 两个 full harness（分析并合并 `tmp/droid-example.sh` 可借鉴点：stream-json 解析 / `--auto` 级别 / completion sentinel）；迁入 `templates/sdd-cli/`、`docs/sdd-h6-reference.md`；cross-cutting `spor-token-efficient-controller-handoff`（H1–H5）与 `spor-handoff-writer` 降为插件 docs（并入 cli-driven-development 契约）；新增 `cli-select`（读 registry + `command -v` 列出已装 full harness + 询问 + 推荐 droid>pi>当前 harness）、`cli-task`（通用一次性派发）、`cli-driven-development`（三模式链）、`cli-code-review`。过渡期同步 superpowers-overrides 的 spor-sdd 引用指向新位置；全量 sdd→cdd 更名（CDD_* env / cdd-common.sh / cdd-run.sh / .superpowers/cdd/ / cdd-reference.md / templates/cdd/）。 | [Pending] | [Pending] |
| P2 | **os-* 家族抽离（核心集审计，8 技能）**。`os-brainstorming` / `os-writing-plans` / `os-executing-plans`（总编器：编器控制器 Rules 1-8 三模式共用 + 分派 —— in-session→Read upstream executing-plans / subagent→Read upstream subagent-driven-development / cli→委托 `cli-driven-development`）/ `os-finishing`（含 worktree 拒绝，吸收 spor-using-git-worktrees）/ `os-verification` / `os-debugging` / `os-code-review` / `os-report-issue`。**不建 os-***（非 1:1 对齐）：tdd 直映 mattpocock（seam 门折进 cdd implement）、executing-plans 直映 os-executing-plans、p0-fallback 删除。cross-cutting `spor-subagent-lifecycle`、`spor-token-efficient-review-dispatch` 降为插件 docs；overall + phase 模板迁入；**gate 模式感知**（`pending.mode`：in-session|subagent|cli，cli 严格 / 其余放行 repo 编辑）。 | [Pending] | [Pending] |
| P3 | **薄封装 + superpowers 模式发射**。superpowers-overrides 收缩为**触发路由器**（plugin-root，claude+cursor）：manifest 触发→目标表（spor-\* → os-\*/cli-\*/mattpocock tdd），hooks/expansion/自检表指向 os-\*/cli-\*，**spor-\* 全部删除**，rule-reference 数字模式退役。engineering = 技能 + 引擎 + gate：gate 全迁（PreToolUse hooks）、`os-init` 落位（参数化）、独立版本化、**统一 emit 工具**（`pnpm run emit` 从 source.json 生成 first-party 全部产物：claude/cursor/codex/kimi/gemini/pi **薄 manifest 指向 `skills/`** + GEMINI.md + `.agents/skills/` 共享 + overrides hooks/自检表 + 版本同步，仿 superpowers `.version-bump.json`）。**丢弃 rovo/vibe/kiro**（无原生安装器）。 | [Pending] | [Pending] |
| P4 | **发布架构 v2 + 跨 harness gate + 重运行时产物**。**发布架构 v2（包即源）**：目录重组 `packages/`（engineering + superpowers-overrides）+ `vendors/`（mattpocock-skills / impeccable / superpowers 上游 submodule 源，不编辑）；package.json 为唯一元数据源（source.json 派生）；pnpm workspace + changesets 统一版本/发布所有 `@oscaner-skills/*` 包（含 vendors 构建期装配 republish `@oscaner-skills/superpowers` / `@oscaner-skills/mattpocock-skills` / `@oscaner-skills/impeccable`，保留上游授权）；marketplace + harness manifests 从 packages 生成；未来插件 = 加包目录自动接入。**跨 harness gate adapters**：Grok / Qoder / Codex / Gemini / Vibe / Kiro 的 PreToolUse/BeforeTool（各需原生配置 + 信任仪式；Copilot 因 matcher 忽略延后）；重运行时产物（opencode runtime 插件 / pi TS 扩展 —— engineering 纯 markdown 目前不需要）；Trae 原生 extension（格式待研）。 | [Pending] | [Pending] |

## §3 Dependency graph (ASCII)

```
P1（插件骨架 + cli-* 家族 + droid/pi + 选择）──▶ P2（os-* 家族）──▶ P3（薄封装 + superpowers 模式发射）──▶ P4（跨 harness gate + 重运行时产物）
```

- P1 → P2：插件存在、模式确立、harness 机制与 cli-driven-development 就位后，os-* 才能引用它们。
- P2 → P3：薄封装需要 os-* 目标全部存在才能映射。
- P3 → P4：跨 harness gate adapters 与重运行时产物建立在 P3 的统一 emit 工具 + gate 基础设施之上。

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
- v1.5 · 2026-08-10 · P2 范围细化（grilling 审计）：os-* 核心集 8 技能（剔除 os-testing，tdd 直映 mattpocock + seam 门折进 cdd implement；executing-plans 直映；p0-fallback 删除；report-issue 保留）；os-executing-plans 为三模式总编器（in-session/subagent/cli）共用编器控制器 Rules 1-8；gate 模式感知（pending.mode）过渡期留 overrides，P3 随薄封装迁
- v1.6 · 2026-08-10 · P2 执行完成（14 commits，os-* 8 技能 + 薄指针化 + gate 模式感知）；执行中 plan_conflict：seam 门从 implement.md 阻塞式移到编器层（os-executing-plans 确认 + CONFIRMED_SEAMS 写 brief，模板非阻塞）—— P2 spec §F 已同步修订
- v1.7 · 2026-08-10 · P3 范围定稿（grilling）：终态边界 = overrides 触发路由器（plugin-root，claude+cursor，无技能体，spor-* 全删）/ os-engineering 技能+引擎+gate+全 harness emit；gate 全迁 os-engineering；os-init 参数化；os-engineering 独立版本化；**impeccable 模式多 harness 发射**（build.js + PROVIDERS，12 技能 → ~15 harness + 上游 superpowers 连带就位）；去掉 cursor-plugins wrapper emit
- v1.8 · 2026-08-10 · P3 范围确认（研究）：harness marketplace/hooks 全量调查（docs/research/2026-08-10-harness-marketplace-hooks.md）—— 12 技能发射到 **14 非 claude harness**（`.agents/skills/` 一等目标，9 harness 读取）+ per-harness self-check/README（路由器 hooks 仅 claude+cursor）+ 上游整目录连带；**新增 P4**：Gemini/Codex/Qoder/Pi/Grok/Trae 原生插件清单 + Grok/Qoder/Codex/Gemini/Vibe/Kiro gate adapters（Copilot 延后）
- v1.9 · 2026-08-10 · P3 发射模式改为 **superpowers 模式统一**（复盘 superpowers 插件结构）：不做 per-harness 技能副本，改 **canonical `skills/` + 薄 manifest 指向它**（claude/cursor/codex/kimi/gemini/pi）+ GEMINI.md + `.agents/skills/` 共享；**统一 emit 工具**（`pnpm run emit` 从 source.json 生成 first-party 全部产物 + 版本同步）；原生清单并入 P3，P4 缩为跨 harness gate adapters + 重运行时产物；**丢弃 rovo/vibe/kiro**
- v2.0 · 2026-08-10 · 插件 rename：`os-engineering` → `engineering`（目录/插件名/命名空间 `engineering:*`，技能 os-*/cli-* 前缀保留）；**包名统一 `@oscaner-skills/` 作用域**（marketplace / engineering / superpowers-overrides）；**全 first-party npm 发布归 P4**（engineering + superpowers-overrides，root 保持 private）
- v2.1 · 2026-08-10 · P4 范围扩大（grilling）：submodules 迁至 `plugins/_vendor/`（区分 vendored vs first-party）；**submodule npm 重发布** 统一纳入 `@oscaner-skills/` 发布体系（superpowers/mattpocock-skills/impeccable，保留上游授权）；non-goal「不改变其余插件归属」改由 P4 变更
- v2.2 · 2026-08-10 · 发布架构 v2（A/C 合流）：包即源 —— 每个插件 = 独立 npm 包，package.json 唯一元数据源（source.json 派生）；目录 `packages/`（first-party）+ `vendors/`（上游 submodule 源，不编辑）；pnpm workspace + changesets 统一发布所有 @oscaner-skills/* 包（vendors 构建期装配 republish）；marketplace 从 packages 生成
