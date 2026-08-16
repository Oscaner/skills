# os-engineering P6a 阶段设计：引擎/流程加固（harness 前置检查 + spec/plan review 走 cli review）

## Header

- **Version**: v1.0 · 2026-08-16
- **Status**: Draft
- **Author**: Oscaner Miao · Claude Code (Opus 4.8)
- **Parent program**: [os-engineering overall v2.9](2026-08-10-os-engineering-overall.md)
- **Depends on**: P5（CDD 引擎全迁 Node @ 合并后 develop）

## §0 Incremental warning

> P6a 增量。跨阶段约定见 [overall v2.9](2026-08-10-os-engineering-overall.md)；冲突以 overall 为准。

## §1 Constraints pointer

- 不重复 overall 约定；冲突以 overall 为准。
- **cli review 模式（P6a 起）**：spec/plan 的 review 走 cli review 模式（经 `cdd-exec` 派发，替代 in-session subagent），D1/D2/D3 + fresh-pass 独立性原样映射（§2.2）。
- **harness 前置检查（P6a 起）**：task 全 mode（implement/review/fix）进入嵌套 CLI 前检查上游 skills 插件可用性（superpowers / mattpocock-skills / `@oscaner-skills/*`）；缺失 → exit 3 + 安装指引。
- 不改引擎 H6 任务契约（0/1/2 语义不动；exit 3 是新增 skills-missing gate）。
- Conventional commits、无 attribution；禁 git worktree；`pnpm run validate` 保持通过。

## §2 Design body

### 2.0 范围（grilling 确认）

- **item 2**：os-brainstorming Rule 1（spec review）+ os-writing-plans Rule 2（plan review）改经 `cdd-exec` 派发。
- **item 3**：harness 前置检查 —— 按 harness 探测上游 skills 插件可用性（**非 submodule 假设**；端用户经 marketplace/npm/plugin cache 安装）；全 mode 统一执行；缺失 → exit 3 + per-harness 安装指引。

### 2.1 Component 1: skills-missing pre-check（item 3）

`runner.mjs` `runTask` 在进入嵌套 CLI 前（**全 mode：implement/review/fix**）加 skills-missing gate：

```
runTask(任意 mode):
  1. Registry ship gate + CLI preflight（现有）
  2. [新增] skills-missing gate（bin/utils/skills-probe.mjs）：
     (a) 检查 plan/brief/templates 就位（plan 已有 existsSync；补 brief + templates/cdd/*.md）
     (b) probe 目标 harness 是否可用【required plugins：superpowers / mattpocock-skills /
         engineering+overrides 自检（@oscaner-skills/* 自发布）】
     缺失 → exit 3（skills-missing）+ stderr 打印该 harness 安装指引
```

**required plugins（闭合清单，配置驱动）**：`superpowers` + `mattpocock-skills`（os-* 编排 Read 上游 + 委托）+ `engineering` + `superpowers-overrides`（工程自检 —— 当前 harness 能否解析本工程技能）。验收标准与之一致（§2.6）。

**按 harness 探测（最终通道分类，见 P6b §2.5 —— 单一 SOT）**：

| 通道 | harness | 缺失行为 |
|---|---|---|
| **安装即用**（probe → exit 3）| claude / cursor-agent / droid / grok / qoder / codex / gemini / pi | exit 3 + 安装指引 |
| **os-init**（缺失 → 提示）| opencode / trae / vibe / kiro | 提示 `os-init harness <name>`（非故障）|

安装即用通道探测路径（claude plugin list + enabledPlugins + 缓存 glob；cursor/droid/opencode 等 skill-dir glob；pi package-list）—— 实现细节在 `bin/utils/skills-probe.config.mjs`（P6b §2.5 权威，11 harness 集合）。

- **探测顺序**：CLI/list 命令 → 文件系统 glob → hook env 变量（research 建议）。
- **installed vs enabled 区分**（claude 缓存存在 ≠ enabled —— 查 settings `enabledPlugins`）。
- **版本 glob 不 pin**（npm 源解析为 `unknown`）。
- **探测失败 vs 缺失**：缺失 = exit 3（安装即用）/ 提示（os-init）；探测本身失败（CLI 查询错/无权限）= **fail-open allow**（别把可用环境误判缺失）。
- **配置驱动**：required plugins + 每 harness 探测路径/安装指引放 **`bin/utils/skills-probe.config.mjs`**（独立于 engine 内部 harness-registry，保持 bin/utils 自包含；未来加插件 = 加配置条目）。
- **`@oscaner-skills/*` 已通过 npm 自发布（非 P6a 动作）**：Claude 经 npm marketplace source；Pi 天然 npm 通道 —— P6a 只写按通道的安装指引。
- **exit-3 范围（钉死）**：exit 3 仅指 skills 插件缺失；**plan/brief/templates 缺失是任务前置条件错误**（复用既有 `finish(1, ...)` BLOCKED 语义，非 exit 3）。

### 2.2 Component 2: spec/plan review 走 cli review（item 2）

`os-brainstorming` Rule 1 + `os-writing-plans` Rule 2：review passes **从 in-session subagent 派发 → 经 `cdd-exec` 派发**。

```
os-brainstorming Rule 1（spec review）:
  每 pass = 一次 fresh cdd-exec 调用：
    cdd-exec --harness claude --prompt "<spec-document-reviewer 模板 + pass 类别 + 文档路径>"
  Pass 1 completeness → Pass 2 (delta) consistency&scope → Pass 3 (full) clarity&YAGNI
os-writing-plans Rule 2（plan review）:
  同模式，用 plan-document-reviewer 模板
```

**D1/D2/D3 + fresh-pass 独立性原样映射**（review-dispatch.md 为准，不是 paraphrase）：
- **fresh**：每 pass 独立 `cdd-exec` 调用（无状态嵌套会话）—— subagent-lifecycle「每 pass 新 agent」不变。
- **D1 escalate-on-finding（按 review-dispatch 原文）**：Pass 1 独立先跑。**零发现 + 明确扫描清单 → 后续 pass 跳过**；否则**修复后并发**跑后续 pass（并发 iff 独立，subagent-lifecycle Rule 1）。
- **D2 delta review**：**中间 pass（Pass 2）**的 prompt 限定 delta 范围；**Pass 3 恒为 full-doc**（不 delta）。
- **D3 findings-only**：prompt 要求 `{findings: [{lens, severity, section|file, line?, summary, fix, deferred?}]}` 空=approve。
- **Pass 3 extent（钉死）**：Pass 3（clarity&YAGNI）恒为 full-doc；D1 只决定「是否跳过后续 pass」（零发现时），不改 extent —— 避免「Pass 2 发现 blocker 时 Pass 3 跑 full 还是 delta」歧义。

依赖：`cdd-exec.mjs` 已存在（一次性 prompt-runner，P5 T3）—— 无需新入口；review 模板（spec/plan-document-reviewer-prompt.md）**位于上游** `vendors/superpowers/skills/{brainstorming,writing-plans}/`（os-brainstorming Rule: Read Upstream 解析路径，orchestrator Read 后内联进 `cdd-exec --prompt`）—— 本阶段不新建模板文件。review 仍由 orchestrator 在流程中触发，只是派发载体从 subagent 换 cli。

### 2.3 utils/lib 结构（审计 + 决策）

- `bin/utils/` = **跨 bin 面共享的通用工具**：`exit.mjs`（已有）+ `skills-probe.mjs`（新增，通用探测库）。
- `bin/engine/lib/` = **引擎内部实现**（CDD 编排专用）：runner/registry/templates/contract/ledger —— 审计确认**无一通用**（gate/os-init 不 import），全部留在 engine/lib。
- 命名决策：`utils/` 语义 = 共享通用（gate/os-init 可复用）；不引入根 `bin/lib/`（与 `bin/engine/lib/` 混淆）。

### 2.4 错误处理

- skills-missing → exit 3（区别于 CLI-missing exit 2 / BLOCKED exit 1）+ stderr 打印安装指引。
- 探测失败（CLI 查询错误/无权限）→ fail-open allow（不阻塞）。
- cdd-exec 派发 review 失败 → 沿用引擎既有 stderr-surfacing（进 blocker）。

### 2.5 非目标

- ❌ 不自动安装插件（只探测 + 指引）。
- ❌ 不改引擎 H6 任务契约（exit 3 是新 gate，不碰现有 0/1/2 语义）。
- ❌ 不新增 harness 探测硬编码（配置驱动）。
- ❌ 不迁移 gate/os-init 到新的 lib 结构（除非共用 utils）。

### 2.6 验收标准

- [ ] implement/review/fix 全 mode：安装即用通道（claude/cursor-agent/droid/grok/qoder/codex/gemini/pi）缺 **superpowers / mattpocock-skills / engineering / superpowers-overrides** 任一 → 提前 exit 3 + 打印该 harness 安装指引（不进入嵌套 CLI）。
- [ ] os-init 通道（opencode/trae/vibe/kiro）缺失 → **提示** `os-init harness <name>`（非 exit 3）。
- [ ] plan/brief/templates 就位检查（缺失 = BLOCKED exit 1，非 exit 3）。
- [ ] claude（plugin list + enabledPlugins + 缓存 glob 区分未安装/禁用）/ cursor-agent / droid / pi / grok / qoder / codex / gemini 探测路径正确（实现细节在 skills-probe.config）。
- [ ] installed-vs-enabled 区分（claude settings enabledPlugins；available = enabled，缓存 glob 非 gate 条件）。
- [ ] required plugins 列表为**配置驱动**（`bin/utils/skills-probe.config.mjs`，改配置即换列表无需改码）。
- [ ] exit 3 与 H6 0/1/2 无冲突（新增 gate，现有语义不动）。
- [ ] `bin/utils/skills-probe.mjs` 就位；engine/lib 结构不动。
- [ ] os-brainstorming Rule 1 + os-writing-plans Rule 2 的 review 走 cdd-exec，D1/D2/D3 按 review-dispatch 原文映射（Pass 2 delta / Pass 3 full）。
- [ ] `pnpm run validate` ALL PASS。

## §3 Deviations from overall

| Overall assumption | Phase decision | Overall updated? |
|---|---|---|
| P6a = 前置检查（submodule-init 3 类，仅 implement）+ cli review（overall v2.9 原述）| 前置检查改**按 harness 探测插件可用性**（非 submodule 假设）+ **全 mode**；required 集 = superpowers/mattpocock/engineering/overrides | Yes — v2.8 · 2026-08-16 |
| overall non-goal「exit codes 0/1/2」| 新增 **exit 3（skills-missing）**，0/1/2 语义不动 | Yes — v2.8（§1 约束「exit 3 新增」）|

## §4 Notes for downstream

- **P6b 依赖**：前置检查的 skills-probe 矩阵按 P6b 最终通道分类（安装即用 vs os-init）—— P6b 前或并行，但引用最终分类。
- **P6c/P6d**：research 集成（P6c）、文档 l10n（P6d）—— 沿 P6a/P6b 落定终态。
- research 文档 `docs/research/2026-08-16-harness-plugin-availability.md` 是探测路径的 source of truth。
- `@oscaner-skills/*` npm 源：Claude 需 npm marketplace source；Pi 天然 —— 安装指引按通道。

## §5 Review

Rule 1 三个 subagent pass 通过后交用户 review，再进入 writing-plans。
