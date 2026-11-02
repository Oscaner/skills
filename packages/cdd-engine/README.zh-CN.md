# @oscaner-skills/cdd-engine

> 🔗 **Mirror 同步声明**：本文件（`README.zh-CN.md`）是英文源 [README.md](README.md) 的同步中文 **mirror**——顶层章节集合逐条一致，节点按位置一一对应；本文为对外宣讲面的中文口径，语义以英文源为准。**同步时间戳**：2026-11-03。

[English](README.md) | [中文](README.zh-CN.md)

CDD 引擎 CLI——kairos `cdd-dev` 技能背后的任务运行器、文档/分支评审器与 harness 派发器。以独立包发布，使引擎（`cdd`）可单独安装与调用。

## 包定位

引擎针对计划文件运行 CDD 工作流的 implement / review / fix 阶段，写出派发的 handoff 产物，读写 `base` 产物，并通过其内嵌的 harness 注册表将每个阶段派发给宿主 harness CLI。它被 [kairos 插件](https://www.npmjs.com/package/@oscaner-skills/kairos)的 `cdd-dev` 技能消费，也可直接从命令行使用。

## 安装

需要 Node.js `>= 24`。

```bash
# 全局 CLI（提供 `cdd` 二进制）
npm install -g @oscaner-skills/cdd-engine

# 或作为依赖
npm install @oscaner-skills/cdd-engine
```

## CLI

全局选项：`--dry-run`——预览下一步派发及其预期产物 — 对 repo 零写入、不占轮次（仅限 implement/review/fix/init）。

| 子命令 | 用法 | 用途 |
|--------|------|------|
| `implement` | `cdd implement --tasks=<n> [--plan=<path>]` | 运行任务 implement 阶段 |
| `review` | `cdd review --type=<wave\|branch\|phase-spec\|overall\|plan\|single-spec>` | 运行评审——wave、branch、phase-spec、overall、plan 或 single-spec |
| `fix` | `cdd fix --type=<wave\|branch\|phase-spec\|overall\|plan\|single-spec>` | 修复评审发现——wave、branch、phase-spec、overall、plan 或 single-spec |
| `base` | `cdd base set\|get` | 读写 `base.json` 产物（单一 CDD `--plan` 目标） |
| `schema` | `cdd schema get <type>` | 打印 canonical 文档结构 schema（发现型、零执法） |
| `issue` | `cdd issue render` | 依据 stdin 发现渲染聚合 issue 正文（纯渲染、零执法） |
| `board` | `cdd board --plan <path> / --spec <path>` | 渲染入口文档的进度板（overall/phase-spec/single-spec/plan/wave/branch；纯读、零执法） |
| `init` | `cdd init --harness=<claude\|pi> [--update]` | 为指定 harness 安装或更新 kairos 插件集（与 repo 无关，三流继承） |

用 `cdd <command> --help` 查看某命令的完整选项列表（例如 `cdd review --tasks` / `--spec` / `--plan` / `--round`）。

### 每轮日志

三个派发动词（`implement` / `review` / `fix`）一律把子进程的 stdout 与 stderr 落进该轮自己的 append 日志文件——`.kairos/cdd/<slug>/logs/<stem>.log`——且从不回显到引擎自身的输出面。文件名取该轮的 report stem，故重派带 `-a{attempt}` 后缀，绝不覆盖首次 attempt 的日志。`--dry-run` 不派发，故不落日志。一轮自身被拒或被杀时，stderr 上那条 `CDD_BLOCKED` 行点名该轮的日志路径：诊断一轮只需打开一个文件，而不必从外部读 `ps`。pre-flight 拒绝（dirty tree · in-flight · doc-contract）不点名日志——那一轮根本没派发。

### 波内任务上限

一波至多三个任务（`MAX_TASKS_PER_WAVE`），形态是硬门，带两条具名拒绝：派生出的开放波宽于上限即 `wave-too-wide`，`--tasks` 点名多于上限即 `too-many-tasks`；两者都点名越界的任务 id。引擎绝不切块、截断或重排波次——修法在计划的形状：把多出的任务用 `DependsOn` 串成链，依赖层自然变窄。计划评审会把同一形状报成 `wave-width-at-most-three`，故缺陷在首次派发之前就可见。部分闭合的批次可能让派生 frontier 跨两层变宽；该形状吃到同一条 `wave-too-wide` 拒绝，而不是被悄悄裁剪。

### fix 的逐条处置

fix 轮逐条回答请求方 review 载体的 finding：每条 finding 一条处置，键为该 finding `summary` 的原文，值为 `{ "status": "fixed" | "rejected", "reason"?: "…" }`（`rejected` 必须带理由）。该映射走本轮 work 载体的 `dispositions` 槽。槽缺失、键集与输入集不等、键不属于输入集、请求方载体不可读、`rejected` 缺理由——任一即判该轮失败。请求方 review 载体除在其 `notes` 追加裁定行外保持只读；其 `findings` 永不改写。

### 复审软上限

软上限是预算，不是收敛机制：连续 `REVIEW_CYCLE_CAP` 个 blocker 周期之后，引擎不再建议下一跳，把该决定交给人裁（`soft-cap`）。收敛本身只由 findings 的档位决定——出现任一 blocker 就把线推回 fix 再重审，只有 warn/nit 则修完即收口、不进重审，零 findings 即通过。

## 迁移

文档身份即 front-matter 的 `slug:` 键。这退役了「按文件名推演文档身份」：属于 **major breaking** 变更，且**零双读**——旧键不再被读取，旧入口形也不再被接受。

- **board 入口改为文档路径**：`cdd board --plan <path>` / `cdd board --spec <path>` 取代退役的 positional slug 形。
- **身份是声明出来的，不是推演出来的**：文档由 front-matter 所写的 `slug:` 定位，文件名不承载任何身份含义。旧路径键不再被读取（留着是惰性的，不报错）；plan 的程序链经「与它同 slug 的身份文档」解析——phase-spec 的 `program:` 指向其 overall，而 overall / single-spec 自身即链根。
- **按 run 的工作区随键走**：`.kairos/cdd/<slug>/` 目录以 plan 文档的 `slug:` 为键。遗留在旧键命名下的目录**不复用**——没有 run 会续用或迁移它。但报告会话的台账扫描仍会读其记录，故在不再需要那段历史时手动删除。

## 开发说明

包位于 [Oscaner/skills](https://github.com/Oscaner/skills) monorepo 的 `packages/cdd-engine`（TypeScript，`tsc -p tsconfig.build.json` 发布构建，vitest 测试；测试与源码同地放置于 `src-next/**/__tests__/**/*.test.ts`）。

```bash
node packages/cdd-engine/src-next/bin.ts schema get plan # 从工作树源面直接调用引擎（Node ≥22.18 原生类型剥离）
pnpm --filter @oscaner-skills/cdd-engine test       # 运行引擎测试套件
pnpm --filter @oscaner-skills/cdd-engine build      # tsc 构建发布产物 dist/bin.js
```

仓库开发期间引擎须从源面直调（`node packages/cdd-engine/src-next/bin.ts`）——绝不要经全局安装或链接，可能过期。

## 许可

MIT
