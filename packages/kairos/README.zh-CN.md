# @oscaner-skills/kairos

> 🔗 **Mirror 同步声明**：本文件（`README.zh-CN.md`）是英文源 [README.md](README.md) 的同步中文 **mirror**——顶层章节集合逐条一致，节点按位置一一对应；本文为对外宣讲面的中文口径，语义以英文源为准。**同步时间戳**：2026-10-01。

[English](README.md) | [中文](README.zh-CN.md)

个人 AI 编程技能——kairos 编排、`cdd-*` CDD 引擎家族与 cdd-report 仓库工具——打包为可安装插件，供多种 AI 编程 harness 消费（已在 **Claude Code**、**Cursor Agent** 与 **Pi** 上验证）。

## kairos 理念导览

kairos 是 cdd-first 方法论的分发载体：它将**持续发现式开发（continuously-discovered development）**的实践打包为可安装技能，并以确定性的 `cdd` 引擎支撑整个流程（完整方法论见仓库 [README](../README.md)）。

- **cdd 为核心理念。** 开发经由三种模式链——implement → review → fix——由计划驱动，每个阶段都在同一条收敛规则下收口。
- **编排为流程层。** 编排器技能承载流程：澄清问题、带结构化评审的 spec 与计划撰写、分支收尾——每个阶段由评审收口，而非靠假设。
- **引擎为执行层。** `cdd` CLI 让链条确定化——同样的计划、同样的简报、同样的命令、同样的结果。引擎把每个阶段派发给宿主 harness 并写入 handoff 产物；技能从不重造引擎的机制。

## 功能

三个技能家族：

- **kairos 编排**——读取上游 `superpowers` 基线的流程编排器，并应用本插件的个人规则（经 `grilling` 澄清问题、经全新子代理 pass 做 spec 评审等）
- **`cdd-*` CDD 引擎家族**——计划执行器外加 `cdd` 引擎 CLI（`@oscaner-skills/cdd-engine`）：implement / review / fix 三模链与 base-branch 产物，将每个阶段派发给宿主 harness CLI
- **cdd-report**——仓库开发工具，为 CDD 会话的缺陷与改进机会聚合生成一个 GitHub issue（gh CLI、去重感知、手动触发）

## 技能

| 技能 | 类型 | 说明 |
|------|------|------|
| `cdd-design` | Orchestrator | 委派发现给 `grilling`；子代理 spec 评审；路由到 overall/phase spec 写入器 |
| `cdd-charter` | Orchestrator | 从设计会话写出程序宪章（overall spec）；cdd spec 评审-修复；交接下一阶段 |
| `cdd-phase` | Orchestrator | 写阶段 spec 增量；先同步 scope 变更到父 overall；cdd spec 评审-修复；交接 `cdd-plan` |
| `cdd-spec` | Orchestrator | 自由形式写单一（非阶段）spec；cdd spec 评审-修复；交接 `cdd-plan` |
| `cdd-plan` | Orchestrator | 逐节撰写计划 + 评审 |
| `cdd-dev` | Orchestrator + Engine | 计划执行器（仅 CLI）；派发三模链（`cdd implement` / `cdd review` / `cdd fix`）+ `cdd base-branch` 产物；最终分支评审 |
| `cdd-close` | Orchestrator | 分支收尾 / PR；禁用 worktree；conventional commits |
| `cdd-report` | Utility | 为 CDD 会话的缺陷与改进机会聚合生成一个 GitHub issue（gh CLI、去重感知）；手动触发 |

## 安装

```bash
npm install @oscaner-skills/kairos
```

或从 oscaner-skills Claude Code 插件市场安装：

```bash
/plugin marketplace add oscaner/skills
/plugin install kairos@oscaner-skills
```

### 从 pi 安装

```bash
pi install npm:@oscaner-skills/kairos
```

安装最新发布版并写入 pi 的 project settings。随后八个 `cdd-*` 技能以裸名出现在 pi 的扁平命名空间中——`cdd-design`、`cdd-plan` 等。

## 快速开始

1. 从市场安装 `superpowers`、`kairos` 与 `mattpocock-skills`（逐 harness 安装见仓库 README）。
2. 确保 `cdd` 引擎 CLI 在 `PATH` 上（`command -v cdd`）；若缺失，运行 `npm i -g @oscaner-skills/cdd-engine`。`cdd-dev` 技能的 `detect-engine` 节点会在 dispatch 时重新检查。
3. 调用 kairos 技能——Claude Code 用 `/kairos:<skill>`，Cursor 用裸斜杠命令：

```bash
# Claude Code
/kairos:cdd-design    # → cdd-design
/kairos:cdd-plan    # → cdd-plan

# Cursor
/cdd-design    # → cdd-design
/cdd-plan    # → cdd-plan
```

## CDD 引擎 CLI

CDD 引擎以独立 `@oscaner-skills/cdd-engine` 包发布；其唯一 CLI 运行器是 `cdd`（implement / review / fix / base-branch / schema / issue）。它通过引擎内嵌的 harness 注册表（逐 harness 的调用与输出契约）将每个阶段派发给宿主 harness CLI：

| 标识符 | CLI 二进制 | 宿主 marker | 交付状态 |
|--------|------------|-------------|----------|
| claude | `claude` | `CLAUDE_CODE_SESSION_ID` | full |
| cursor | `cursor-agent` | `CURSOR_TRACE_ID` | full |
| pi | `pi` | `AI_AGENT=pi` | full |

`cdd schema get <type>` 直出引擎的 canonical 文档结构 schema（发现型、与原 schema 文件同字节），`cdd issue render` 依据 stdin 发现渲染聚合 issue 正文（纯渲染、零执法）。完整 CLI 参考见 [cdd-engine README](../cdd-engine/README.zh-CN.md)。

## 与上游插件共存

kairos 将每个技能都命名为 `cdd-*`，因此该家族与上游插件可无冲突并存——这是构造保证：pi 的扁平命名空间没有命名空间修饰语法，而 `cdd-*` 裸名的唯一性让每个 kairos 技能在任意上游插件旁都无可歧义。inline skill 引用按 harness 条件化——Claude Code 与 Cursor Agent 支持插件限定引用（如 `/superpowers:*`），恒解析到属主包；pi 只能以裸 `/skill:<name>` 调用，`cdd-*` 唯一性同样保证引用目标无歧义。

### 上游依赖安装

编排技能会以 inline 导入上游 flow 作为本次会话基线（superpowers / mattpocock-skills / impeccable）。按 harness 从各自发布方安装——kairos 经由各 harness 自有渠道安装：

| Package | Claude Code | Cursor Agent | Pi |
|---------|-------------|--------------|-----|
| kairos | `/plugin marketplace add oscaner/skills → /plugin install kairos@oscaner-skills` | pending | `pi install npm:@oscaner-skills/kairos` |
| superpowers | pending | pending | pending |
| mattpocock-skills | pending | pending | pending |
| impeccable | pending | pending | pending |

标记为 `pending` 的命令从插件的官方渠道安装（见仓库 [Plugins](../README.zh-CN.md#插件列表) 表——每个上游插件链接其 GitHub 主页，当前安装命令就在其上发布）。

## 维护者文档

本单仓开发者的仓库内部维护文档（不随插件发布）。[docs/maintainers 索引](../../docs/maintainers/README.md) 链接编号族文档——如 [program experience](../../docs/maintainers/04-program-experience.md)（程序经验）与 [template doctrine](../../docs/maintainers/01-template-doctrine.md)（模板惯例，约束 emit 派生产物）。

## 许可

MIT
