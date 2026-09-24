# @oscaner-skills/cdd-engine

> 🔗 **Mirror 同步声明**：本文件（`README.zh-CN.md`）是英文源 [README.md](README.md) 的同步中文 **mirror**——顶层章节集合逐条一致，节点按位置一一对应；本文为对外宣讲面的中文口径，语义以英文源为准。**同步时间戳**：2026-09-23。

[English](README.md) | [中文](README.zh-CN.md)

CDD 引擎 CLI——osuperpowers `cli-driven-development` 技能背后的任务运行器、文档/分支评审器与 harness 派发器。以独立包发布，使引擎（`cdd`）可单独安装与调用。

## 包定位

引擎针对计划文件运行 CDD 工作流的 implement / review / fix 阶段，写出派发的 handoff 产物，读写 `base-branch` 产物，并通过其内嵌的 harness 注册表将每个阶段派发给宿主 harness CLI。它被 [osuperpowers 插件](https://www.npmjs.com/package/@oscaner-skills/osuperpowers)的 `cli-driven-development` 技能消费，也可直接从命令行使用。

## 安装

需要 Node.js `>= 22.12.0`。

```bash
# 全局 CLI（提供 `cdd` 二进制）
npm install -g @oscaner-skills/cdd-engine

# 或作为依赖
npm install @oscaner-skills/cdd-engine
```

## CLI

全局选项：`--dry-run`——模拟派发而不写 handoff 产物。

`cdd help` 打印引擎的资源发现路径：CLI 入口目录、文档 schema 目录（spec/plan 编写 schemas）与模板根目录。

| 子命令 | 用法 | 用途 |
|--------|------|------|
| `implement` | `cdd implement --task=<n> [--plan=<path>]` | 运行任务 implement 阶段 |
| `review` | `cdd review --type=<task\|branch\|spec\|plan>` | 运行评审——task、branch、spec 或 plan |
| `fix` | `cdd fix --type=<task\|branch\|spec\|plan>` | 修复评审发现——task、branch、spec 或 plan |
| `base-branch` | `cdd base-branch set\|get` | 读写 `base-branch.json` 产物（单一 CDD `--plan` 目标） |
| `help` | `cdd help` | 打印 CLI + 文档资源目录发现（schemas/templates） |

用 `cdd <command> --help` 查看某命令的完整选项列表（例如 `cdd review --task` / `--base` / `--head` / `--spec` / `--round`）。

## 开发说明

包位于 [Oscaner/skills](https://github.com/Oscaner/skills) monorepo 的 `packages/cdd-engine`（TypeScript，unbuild 构建，vitest 测试；测试与源码同地放置于 `src/**/__tests__/**/*.test.ts`）。

```bash
pnpm --filter @oscaner-skills/cdd-engine dev:stub   # 重建 jiti 即时加载开发 stub
node packages/cdd-engine/dist/cli.mjs help          # 从工作树直接调用引擎
pnpm --filter @oscaner-skills/cdd-engine test       # 运行引擎测试套件
```

仓库开发期间引擎须从工作树直接调用（`dist/cli.mjs`）——绝不要经全局安装或链接，可能过期。

## 许可

MIT
