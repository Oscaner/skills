# @oscaner-skills/osuperpowers

> 🔗 **Mirror 同步声明**：本文件（`README.zh-CN.md`）是英文源 [README.md](README.md) 的同步中文 **mirror**——顶层章节集合逐条一致，节点按位置一一对应；本文为对外宣讲面的中文口径，语义以英文源为准。**同步时间戳**：2026-09-24。

[English](README.md) | [中文](README.zh-CN.md)

个人 AI 编程技能——osuperpowers 编排、`cli-*` CDD 引擎家族与 report-issues 仓库工具——打包为可安装插件，供多种 AI 编程 harness 消费（已在 **Claude Code** 与 **Cursor Agent** 上验证）。

## 插件定位

三个技能家族：

- **osuperpowers 编排**——读取上游 `superpowers` 基线的流程编排器，并应用本插件的个人规则（经 `grilling` 澄清问题、经全新子代理 pass 做 spec 评审等）
- **`cli-*` CDD 引擎家族**——计划执行器外加 `cdd` 引擎 CLI（`@oscaner-skills/cdd-engine`）：implement / review / fix 三模链与 base-branch 产物，将每个阶段派发给宿主 harness CLI
- **report-issues**——仓库开发工具，为 CDD 会话的缺陷与改进机会聚合生成一个 GitHub issue（gh CLI、去重感知、手动触发）

## 技能

| 技能 | 类型 | 说明 |
|------|------|------|
| `brainstorming` | Orchestrator | 委派发现给 `grilling`；子代理 spec 评审；路由到 overall/phase spec 写入器 |
| `writing-overall-spec` | Orchestrator | 从设计会话写出程序宪章（overall spec）；cdd spec 评审-修复；交接下一阶段 |
| `writing-phase-spec` | Orchestrator | 写阶段 spec 增量；先同步 scope 变更到父 overall；cdd spec 评审-修复；交接 `writing-plans` |
| `writing-single-spec` | Orchestrator | 自由形式写单一（非阶段）spec；cdd spec 评审-修复；交接 `writing-plans` |
| `writing-plans` | Orchestrator | 逐节撰写计划 + 评审 |
| `cli-driven-development` | Orchestrator + Engine | 计划执行器（仅 CLI）；派发三模链（`cdd implement` / `cdd review` / `cdd fix`）+ `cdd base-branch` 产物；最终分支评审 |
| `finishing` | Orchestrator | 分支收尾 / PR；禁用 worktree；conventional commits |
| `report-issues` | Utility | 为 CDD 会话的缺陷与改进机会聚合生成一个 GitHub issue（gh CLI、去重感知）；手动触发 |

## 安装

```bash
npm install @oscaner-skills/osuperpowers
```

或从 oscaner-skills Claude Code 插件市场安装：

```bash
/plugin marketplace add oscaner/skills
/plugin install osuperpowers@oscaner-skills
```

## 快速开始

1. 从市场安装 `superpowers`、`osuperpowers` 与 `mattpocock-skills`（逐 harness 安装见仓库 README）。
2. 确保 `cdd` 引擎 CLI 在 `PATH` 上（`command -v cdd`）；若缺失，运行 `npm i -g @oscaner-skills/cdd-engine`。`cli-driven-development` 技能的 `detect-engine` 节点会在 dispatch 时重新检查。
3. 调用 osuperpowers 技能——Claude Code 用 `/osuperpowers:<skill>`，Cursor 用裸斜杠命令：

```bash
# Claude Code
/osuperpowers:brainstorming    # → brainstorming
/osuperpowers:writing-plans    # → writing-plans

# Cursor
/brainstorming    # → brainstorming（裸上游斜杠）
/writing-plans    # → writing-plans
```

## CDD 引擎 CLI

CDD 引擎以独立 `@oscaner-skills/cdd-engine` 包发布；其唯一 CLI 运行器是 `cdd`（implement / review / fix / base-branch / schema）。它通过引擎内嵌的 harness 注册表（逐 harness 的调用与输出契约）将每个阶段派发给宿主 harness CLI：

| Harness | CLI 二进制 | 交付状态 |
|---------|------------|----------|
| claude | `claude` | Full |
| cursor-agent | `cursor-agent` | Full |

`cdd schema get <type>` 直出引擎的 canonical 文档结构 schema（发现型、与原 schema 文件同字节）。完整 CLI 参考见 [cdd-engine README](../cdd-engine/README.zh-CN.md)。

## 维护者文档

本单仓开发者的仓库内部维护文档（不随插件发布）。[docs/maintainers 索引](../../docs/maintainers/README.md) 链接编号族文档——如 [program experience](../../docs/maintainers/05-program-experience.md)（程序经验）、[skill authoring](../../docs/maintainers/06-skill-authoring.md)（技能撰写）与 [data-driven templates](../../docs/maintainers/01-data-driven-templates.md)（数据驱动模板惯例，约束 emit 派生产物）。

## 许可

MIT
