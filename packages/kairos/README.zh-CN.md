# @oscaner-skills/kairos

> 🔗 **Mirror 同步声明**：本文件（`README.zh-CN.md`）是英文源 [README.md](README.md) 的同步中文 **mirror**——顶层章节集合逐条一致（7 段，节点按位置一一对应）；语义以英文源为准。**同步时间戳**：2026-11-03。

[English](README.md) | [中文](README.zh-CN.md)

六个 `cdd-*` 技能把一次变更从设计带到收口，外加为它们所派发的每一轮做出判定的引擎。以可安装插件形式发布，供 AI 编程 harness 使用（已在 **Claude Code** 与 **Pi** 上验证）。

## kairos 理念导览

kairos 是 cdd-first 方法论的分发载体：它把**持续发现式开发**打包成可安装技能，并在整个流程背后放上确定性的 `cdd` 引擎。方法论本身——推理方式、收敛规则与图表——在仓库 [README](../README.md) 里。

- **cdd 是核心纪律。** 工作沿三模式链运行——implement → review → fix——每个阶段都由同一条收敛规则收口，而不是由截止日期收口。
- **编排是流程层。** 技能承载对话与文档：澄清性提问、在结构化评审下写出的规格与计划、分支收尾。一个阶段以评审结束，而不是以假设结束。
- **引擎是执行层。** `cdd` CLI 让链条确定化——同样的计划、同样的简报、同样的命令、同样的结果。它派发每一轮、裁定终态判定、推演下一个去向，因此没有任何技能重新实现它的机制。

## 技能

六个技能共用 `cdd-*` 家族名。五个承载链条上的一个阶段，`cdd-report` 站在链外。

| 技能 | 类型 | 说明 |
|------|------|------|
| `cdd-design` | 编排器 | 头脑风暴路由（模式/档位/规模门禁）；派发参数化 spec-writer（single-spec / phase-spec / overall charter） |
| `cdd-spec-writer` | Spec-writer | 合并后的 single-spec / phase-spec / overall writer：在同一套参数化流程下撰写、评审并提交目标 spec |
| `cdd-plan` | 编排器 | 计划撰写（回填设计门禁 · 计划写入权）；计划评审-修复节奏；交接给 `cdd-dev` |
| `cdd-dev` | 编排器 + 引擎 | 计划执行器（仅走 CLI）；派发 implement / review / fix 链与 `cdd base` 产物；最终分支评审 |
| `cdd-close` | 编排器 | 分支收尾 / PR；停在收尾门禁与终态；不用 worktree；conventional commits |
| `cdd-report` | 工具 | 为 CDD 会话中的缺陷与改进机会提交一个聚合 GitHub issue（gh CLI，可去重）；一次性链；手动触发 |

每个编排器都会先呈上产物——连同批准它的自检结论——并在首次派发之前停下来等待你的明确批准。

## 安装

```bash
npx -y @oscaner-skills/cdd-engine@latest init --harness=claude
npx -y @oscaner-skills/cdd-engine@latest init --harness=pi
```

`cdd init` 按序安装 `kairos` 及其两个上游包（superpowers、mattpocock-skills），经该 harness 自己的命令渠道——下表前三行即这份安装契约。其后六行是推荐档：这些能力 Claude Code 原生具备，pi 需要相应包，且只在你传入 `--include-recommends` 时才安装。加 `--update` 即刷新已安装集合而不是新装；`cdd` 已全局安装后可省去 `npx -y @oscaner-skills/cdd-engine@latest` 前缀。

不经引擎、手工安装时，请逐条执行单元格中的命令——`；` 只是并列分隔，不是 shell 分隔符；`—` 表示该 harness 不需要这个包：

| Package | Claude Code | Pi |
|---------|-------------|-----|
| superpowers | `claude plugin marketplace add obra/superpowers-marketplace；claude plugin install superpowers@superpowers-marketplace` | `pi install git:github.com/obra/superpowers` |
| mattpocock-skills | `claude plugin marketplace add mattpocock/skills；claude plugin install mattpocock-skills@mattpocock` | `pi install git:github.com/mattpocock/skills` |
| kairos | `claude plugin marketplace add oscaner/skills；claude plugin install kairos@oscaner-skills` | `pi install npm:@oscaner-skills/kairos` |
| pi-fff | — | `pi install npm:@ff-labs/pi-fff` |
| rpiv-todo | — | `pi install npm:@juicesharp/rpiv-todo` |
| rpiv-ask-user-question | — | `pi install npm:@juicesharp/rpiv-ask-user-question` |
| pi-web-access | — | `pi install npm:pi-web-access` |
| pi-background-tasks | — | `pi install npm:pi-background-tasks` |
| pi-agentsmd | — | `pi install npm:pi-agentsmd` |

### 推荐档

Claude Code 原生具备六类能力，pi 则需要为每一类装一个包——文件搜索、todo 跟踪、结构化提问、网页取用、后台任务与 `AGENTS.md` 注入：

- `pi-fff` — 文件搜索
- `rpiv-todo` — todo 跟踪
- `rpiv-ask-user-question` — 结构化提问
- `pi-web-access` — 网页取用
- `pi-background-tasks` — 后台任务
- `pi-agentsmd` — 工作流所依赖的 `AGENTS.md` 项目指令注入

它们是可选档：`cdd init --harness=pi --include-recommends` 会把它们连同核心三行一起装上，`cdd init --harness=pi --update --include-recommends` 刷新已装集合。Claude Code 既不需要这个旗标，也不需要这些包。

## 快速开始

1. 用 `cdd init --harness=<claude|pi>` 安装插件集——见[安装](#安装)。
2. 调用第一个编排器。它会依次交接给 `cdd-spec-writer`、`cdd-plan`、`cdd-dev`、`cdd-close`，每一步都跟随引擎的 `next:` 行。
3. 需要看板时，`cdd board --plan <path>` 会把同一个判定渲染成进度板。

在 Claude Code 中按限定名调用技能；pi 使用裸形式：

```bash
# Claude Code
/kairos:cdd-design    # 开始一个阶段：设计对话
/kairos:cdd-plan      # 或直接从计划重新进入

# pi
/skill:cdd-design
```

其余无需配置。每个技能都按需获取引擎，运行态保存在 `.kairos/cdd/` 下——工作区会在首次派发时自发布 `.kairos/.gitignore`（内容 `*`），因此运行产物既不进你的提交，也不会被引擎读取的干净树门禁看见。

## CDD 引擎 CLI

引擎以独立 `@oscaner-skills/cdd-engine` 包发布；其唯一 CLI 运行器是 `cdd`（implement / review / fix / base / schema / issue / board / init）。它通过引擎内嵌的 harness 注册表（逐 harness 的调用与输出契约）把每个阶段派发给宿主 harness CLI：

| 标识符 | CLI 二进制 | 宿主 marker | 交付状态 |
|--------|------------|-------------|----------|
| claude | `claude` | `CLAUDE_CODE_SESSION_ID` | full |
| pi | `pi` | `AI_AGENT=pi` | full |

`cdd schema get <type>` 直出引擎的 canonical 文档结构 schema（发现型、与原 schema 文件同字节）；`cdd issue render` 依据 stdin 发现渲染聚合 issue 正文（纯渲染、零执法）。完整参考见 [cdd-engine README](../cdd-engine/README.zh-CN.md)。

## 与上游插件共存

kairos 把每个技能都放在 `cdd-*` 家族名下，所以共存是构造性的而非约定性的：pi 的扁平命名空间没有限定语法，而唯一的裸名让每个 kairos 技能在任意上游插件旁都无可歧义。inline 引用按 harness 条件化——Claude Code 会把 `/superpowers:*` 这类插件限定引用解析到属主包，pi 只调用裸 `/skill:<name>`，由 `cdd-*` 的唯一性承担同样的保证。

仓库架构与开发者/引擎旅程见双语[图表集](../../docs/diagrams/index.html)。

## 许可

MIT
