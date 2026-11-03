---
title: 引擎文档工具（Engine Doc-Tooling）— P23 设计：`cdd init --include-recommends` 推荐包档
doc-type: phase-spec
version: v0.2
date: 2026-11-03
slug: 2026-10-10-engine-doc-tooling-p23
program: 2026-10-10-engine-doc-tooling
author: "[human] · Claude（kairos:cdd-design [P23] grilling → 本会话落 spec · 2026-11-03）"
---

## Design

本相位给第八命令 `cdd init` 增一个可选推荐包档：**核心三包仍是安装契约，推荐六条由 `--include-recommends` 显式选择**。改的是三处——一张表多一个档位字段、一个布尔旗标、一处展平过滤；消费面跟着 README 安装表与 guard。

**一句话的病根**：`cdd init` 今天把「kairos 能跑」等同于「三个插件装好」，而 kairos 六 skill 的编排面还假定宿主具备文件搜索、todo 追踪、结构化提问、网页取用、后台任务与 `AGENTS.md` 注入。

**边界（本相位不越的线）**：不改核心三包行序与 argv · 不改 `--update` 既有语义 · 不新增 CLI 动词 · 引擎不解析 harness 输出（不得据输出自行跳过或继续）· 不默认安装推荐包 · 不动任何 SKILL.md。

### 1. 缺口（取证）

#### 1.1 三包装完 ≠ kairos 跑得动

Claude Code 原生带着六类能力，pi 不带：本仓的 pi 会话正是靠 `@ff-labs/pi-fff` 的 fff 检索工具、`@juicesharp/rpiv-todo` 的 `todo`、`@juicesharp/rpiv-ask-user-question` 的 `ask_user_question`、`pi-web-access` 的取用工具、`pi-background-tasks` 的 `bg_*` 与 `pi-agentsmd` 的指令注入才走得通。装完三包就起 `cdd-design` 的 pi 消费者，会在第一个需要提问或检索的节点上缺工具——而缺工具不是报错，是**静默降级**：编排者改用散文猜测，评审轮没有 `ask_user_question` 就自己替作者裁定。

反过来说，claude 侧今天**一条推荐包都没有**，这不是遗漏：Claude Code 里这六类能力是原生的，装插件反而是噪音。

#### 1.2 为什么必须落数据面

`cdd init` 已有一条 repo 无关的命令面与一张单源表（P20 的 `PLUGINS`），表的行序本身就是执行序与 README 行序。推荐清单若只做本机偏好，立刻长出第二份散清单——一份在引擎、一份在某人的 dotfiles、一份在 README 散文里——而这六条对任何 pi 消费者都是同一个答案。用户裁定：**产品级数据面、所有 pi 消费者共享、由旗标决定装不装**。

### 2. 定案：数据面（`face/plugins.ts` 一张表 + `tier` 字段）

#### 2.1 单表九行：行序即执行序

`PluginRow` 增 `tier: "core" | "recommended"`（导出 `PluginTier` 联合）。**不拆第二张表**：单表承载「行序 = 执行序 = README 行序」这条强承诺，拆表就要跨表再定义一次执行序（谁在前、空表算什么）。

| 行 | tier | pi install argv | claude |
|---|---|---|---|
| superpowers | core | `pi install git:github.com/obra/superpowers` | 既有两步 |
| mattpocock-skills | core | `pi install git:github.com/mattpocock/skills` | 既有两步 |
| kairos | core | `pi install npm:@oscaner-skills/kairos` | 既有两步 |
| pi-fff | recommended | `pi install npm:@ff-labs/pi-fff` | 空 |
| rpiv-todo | recommended | `pi install npm:@juicesharp/rpiv-todo` | 空 |
| rpiv-ask-user-question | recommended | `pi install npm:@juicesharp/rpiv-ask-user-question` | 空 |
| pi-web-access | recommended | `pi install npm:pi-web-access` | 空 |
| pi-background-tasks | recommended | `pi install npm:pi-background-tasks` | 空 |
| pi-agentsmd | recommended | `pi install npm:pi-agentsmd` | 空 |

#### 2.2 六条 argv 与 claude 的空列

- 每行 `update` 形态 = 该行 `install` argv 的 `install` 一词替换为 `update`，逐行在册（`pi update npm:@ff-labs/pi-fff` …）。
- 推荐行的 claude 列是**空数组** `{ install: [], update: [] }`——`PluginRow` 的列集仍由 `HostId` 收口（缺列是类型错），空列不是缺列。将来 claude 真有推荐包，加 argv 即可，零结构变更。
- 行名（`name`）取包名尾段（`pi-fff` · `rpiv-todo` · …），与核心行同形；它同时是步骤头与 README 首列的显示名。

### 3. 定案：旗标（`ARGV_CHANNEL` + `RunInput`）

#### 3.1 旗标单源

`ARGV_CHANNEL`（`contract/declare.ts`）是旗标字面的唯一住处，`harness` / `update` / `dryRun` 都已在那张表里。新增一行：`includeRecommends: { flag: "--include-recommends", type: "bool", help: "also install/update the recommended pi capability packages" }`。init 命令声明读这一行把旗标声明在本命令上（与 `--update` 同形），`RunInput` 增 `includeRecommends?: boolean`，init 节点读一次。

#### 3.2 与既有旗标正交

`--harness` / `--update` / `--dry-run` 的任意组合都被接受；`--harness` 仍是 `requiredOption`，故 `--include-recommends` 不带 `--harness` 由既有缺旗标 usage 面拒绝（exit 2、零 spawn），不新增第二道门。

### 4. 定案：唯一展平点按档过滤（`face/init.ts`）

#### 4.1 `InitRequest` 一份请求对象

`CliInit#stepsOf` 是**唯一**展平点。签名收成一份请求对象避免参数膨胀：`InitRequest = { host: HostId, shape: "install" | "update", recommended: boolean }`；`#stepsOf(request)` 在 `recommended === false` 时只取 `tier === "core"` 的行，`true` 时按表序取全部九行。`run` / `preview` 的公开面同收成 `(request)` 一个参数。

#### 4.2 预览与实跑同源

`preview()` 与 `run()` 同读这一份展平——预览不可能漂。分支点仍只有「是否调 `StepRunner`」一处；`--dry-run` 依旧零 spawn、零写入、exit 0、不占轮次。

### 5. 定案：输出面

#### 5.1 步骤头字节零变

步骤头仍是 `init[<i>/<n>] <host> · <package> · <argv 去可执行名>`，**不加档标**：包名（`pi-fff` / `rpiv-todo` …）已足够辨识，档标带来的信息量与它重复，却要重锚既有步骤头 pin。

#### 5.2 汇总与预览分档

- 不带旗标 —— 原字节不动：`init: <n> steps ok (<host> · <install|update>)`
- 带旗标 —— `init: <n> steps ok (<host> · <install|update> · <c> core + <r> recommended)`
- 带旗标且 `r === 0`（今天 = claude）—— 追加一行 `init: no recommended packages for <host>`
- 预览面 `would run: <argv join>` 每步一行不变，汇总行 `init: <n> steps (<host> · <install|update>[ · <c> core + <r> recommended]) — dry run, nothing executed`，`r === 0` 时同样追加那句 info

那行 info 是硬要求：静默接受一个什么都没做的旗标，正是让人以为装过了的那种坑。

#### 5.3 失败面与空档 info 行

既有行 `init[<i>/<n>] · <argv join> · exit <code>` 不变，首败即停、exit 1 不变。推荐步永远排在核心之后，所以推荐档失败时核心集已经装完——硬停不会让消费者更糟，而软失败会让「装了一半」看不见。

推荐档失败时**额外**追加一行 `init: <package> is a recommended package — run cdd init --harness=<host> --include-recommends without --update to install it`。`--update` 的既有未安装提示（`if the package is not installed, run cdd init --harness=<host> without --update first`）**字节不改**、两档共用：它在推荐档并不谎（确实要先装），而逐档改写这句话会把一条 pin 变成两条。

### 6. 定案：消费面文档

#### 6.1 六份 README

- `packages/kairos/README.md` + `README.zh-CN.md`：安装段 lead-in 分档一句（前三行是安装契约，后六行是推荐档，`--include-recommends` 才装）+ 安装表扩到九行（推荐行 claude 单元格写 `—`）+ 表下六条一组讲推荐理由（**不逐行成列**，逐行理由会把表撑到读不动）+ 一句 `--update --include-recommends` 的用法。
- 根 `README.md` + `README.zh-CN.md`：Installation 一句提及旗标，不复制包清单。
- `packages/cdd-engine/README.md` + `README.zh-CN.md`：CLI 表 `init` 行改 `cdd init --harness=<claude\|pi> [--update] [--include-recommends]`。

#### 6.2 SKILL.md 零变更

安装面归 README，skill 只管流程。推荐包缺失以工具缺失的形式暴露，不改任何 skill 的步骤形状；六份 SKILL.md 本相位零变更（也让本相位不碰消费面纯净纪律与 anatomy pin）。

### 7. 定案：guard 分档（`plugins.guard.test.ts`）

#### 7.1 核心行断言原样

「README 安装表 ↔ 名册」门今日把表逐格钉在 `PLUGINS` 上。分档后：核心行断言**逐格原样保留**（行名 + 顺序 + 双列 install argv 全角 `；` 连接 + 表头三格），只是在名册侧按 `tier === "core"` 取行。

#### 7.2 推荐行断言与 `—`

推荐行断言：首列 = `name`、顺序 = 名册序、claude 单元格 = `—`、pi 单元格 = install argv 全角 `；` 连接。`—` 是空单元格的**唯一**写法（写进断言字面），guard 把它认作空档而不是缺失。四份 README 的 `cdd init` 命令字节断言保留；新增一处：引擎 README 双语的 `init` usage 行携带 `[--include-recommends]`。

### 8. 落点、依赖与发行

#### 8.1 落点与测试基座

| 面 | 落点 |
|---|---|
| 数据面 | `face/plugins.ts`（`PluginTier` + `tier` 字段 + 六行） |
| 旗标 | `contract/declare.ts`（`ARGV_CHANNEL` 一行）· `face/cli.ts`（命令声明 + `RunInput.includeRecommends` + init 节点读一次） |
| 展平与输出 | `face/init.ts`（`InitRequest` + 分档过滤 + 分档汇总 / info 行 / 推荐档失败补行） |
| 测试 | `init.test.ts` · `plugins.test.ts` · `plugins.guard.test.ts` · `cli.test.ts` |
| 文档 | 六份 README（根 / kairos / 引擎，各双语） |

测试基座跟随数据面：`plugins.test.ts` 的 `PLUGINS.map(name)` 三值断言改为九值（core 三 + recommended 六）；`init.test.ts` 的 `sequenceOf` 与 `ROSTER` 派生按 `tier === "core"` 取行（无旗标面）并新增推荐面用例。**产品字节 pin 不动**（`init[1/3] pi · …` · `init: 3 steps ok (pi · install)` · claude 六条步骤头）。

#### 8.2 依赖与发行

**依赖**：`P22` hard，已 Done（serial-phase 门通过）。**发行**：changeset `cdd-engine` **minor** + `kairos` **patch**（D74：方法论契约不变，新增可选旗标与数据行），不发布。**波次**：预计两波——数据面 + 旗标/展平面；输出面 + 文档面 + guard，每波 ≤3 任务。

### 9. 非目标

- 改核心三包行序或 argv · 改 `--update` 语义 · 新增 CLI 动词 · 引擎解析 harness 输出并据此跳过/继续 · 默认安装推荐包。
- 推荐行的逐行理由列 · 六份 SKILL.md 变更 · 架构图与 `cdd` 八命令字面变更（命令数不变）。
- 运行时探测「已安装则跳过」（引擎零 harness 输出解析）· 给 claude 编造推荐包（原生能力不重复安装）。

### Acceptance criteria

- `数据面`：`PLUGINS` 单表九行、`tier` 字段与 `PluginTier` 联合在册 · 三行 core 在前、六行 recommended 在后且推荐序 = §2.1 表序 · 推荐行 claude 列为空数组而非缺列（类型层与运行层各一条 pin）· 每行 `update` argv = `install` argv 的 `install` → `update` 替换（逐行 pin）
- `旗标`：`ARGV_CHANNEL.includeRecommends` 在册且 `flag === "--include-recommends"` · `cdd init --harness=pi --include-recommends --dry-run` exit 0 · 不带 `--harness` 带旗标 → usage exit 2 且零 spawn · 既有 harness 值域拒绝面不回归
- `展平`：`--harness=pi` 无旗标 = 3 步、有旗标 = 9 步且前 3 步与无旗标逐字节相同 · `--harness=claude` 有旗标 = 6 步（与无旗标同 argv 序列）· `--update` 两档各走 update 序列且零 install argv · `preview()` 与 `run()` 同一请求下共用同一展平（独立源比对，不从运行反推）· 名册派生面跟随：`plugins.test.ts` 行名断言九值、`init.test.ts` 的 `sequenceOf` / `ROSTER` 按 `tier === "core"` 取行
- `输出面`：无旗标时**产品字节零变**——步骤头（`init[1/3] pi · …` · `init[1/6] claude · …` 六条）、汇总行（`init: 3 steps ok (pi · install)`）、失败行、`--update` 提示、预览汇总行全部原样，既有字节 pin **不重锚**（仅名册派生辅助按 core 档重构，见 §8.1）· 带旗标汇总行含 `<c> core + <r> recommended` · claude 带旗标两面各出 `init: no recommended packages for claude` · 推荐档失败 → 首败即停 exit 1 且追加一行点名该包属推荐档 · `--dry-run --include-recommends` 预览 9 行 `would run:` + 分档汇总 + 零 spawn、零写入、exit 0
- `消费面`：kairos README 双语九行安装表（推荐行 claude 单元格 `—`）+ 分档 lead-in + 六条一组理由段 + `--update --include-recommends` 用法句 · 根 README 双语 Installation 提及旗标 · 引擎 README 双语 `init` usage 行含 `[--include-recommends]` · 六份 SKILL.md 零变更（grep pin）
- `guard`：核心行断言原样（按 `tier === "core"` 取行）· 推荐行逐格断言（首列 / 顺序 / `—` / `；` 连接）· 引擎 README `init` usage 行 `[--include-recommends]` 断言 · 任一 README 少一行或多一行 → 红
- `全量`：`cdd` 仍八命令（结构 pin 不变）· engine vitest 全绿 · typecheck ×3 · `env -u AI_AGENT pnpm run validate` exit 0 · `pnpm run emit:check` fresh（无生成物触发器触碰）· changeset `cdd-engine` minor + `kairos` patch，不发布

## Constraints

- **数据面单源**：推荐六条的 argv 只住在 `face/plugins.ts`。README 表、guard 断言、步骤头全是从它渲染出来的读者；出现第二份清单（散文里的命令、dotfiles 复制、模板里的副本）即本相位点名禁止的回归
- **无旗标字节零变**：不带 `--include-recommends` 时，`cdd init` 的三面（步骤头 / 汇总 / 失败）与 `--dry-run` 预览的每个产品字节保持不变，既有字节 pin **不重锚**。**例外仅限名册派生的测试辅助**（`sequenceOf` / `ROSTER` / `PLUGINS.map(name)`）——数据面多出六行，派生函数必须按 `tier === "core"` 取行（无旗标面）才有意义；把派生辅助的重构当成允许改产品字节是禁止的滑坡
- **引擎零 harness 输出解析**：不得据子进程输出判断「已安装 / 可跳过 / 可继续」。推荐档失败就是首败即停 + exit 1；「装了一半」的可见性由分档汇总行与推荐档失败补行承担
- **核心契约不动**：核心三包的行序、argv、失败语义、`--update` 提示句都是既有契约；本相位只追加档位，不重排、不改写
- **claude 列空是事实而非占位**：Claude Code 原生具备六类能力，故 claude 推荐列写空数组、README 写 `—`；不得为了表好看编造 claude 推荐包
- **消费面 purity**：README 只承载旗标用法与「为什么推荐这六条」，不装载程序历史、相位编号与重构理由；SKILL.md 零变更
- **零新依赖 / 零新命令 / 零环境变量**：不引入运行时探测依赖，不加 CLI 动词，不用环境变量控制档位
- **语言纪律**：README 英文主源 + `.zh-CN.md` 镜像逐段同步；SKILL 面英文；本 spec 为内部开发者文档（中文）
- **不改写历史**：已注册的 overall 表行、已入账的相位与 plan 行、冻结文档里的旧字节一律不回改；注册回填已单独提交（`4551e75d`）

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-11-03 | P23 初始设计：`cdd init --include-recommends` 推荐包档——`PLUGINS` 单表增 `tier` 字段（core 3 + recommended 6，claude 列空）· `ARGV_CHANNEL` 一行旗标 + `RunInput` 一字段 · `CliInit#stepsOf(InitRequest)` 唯一展平按档过滤 · 输出面分档汇总 + claude 空档 info 行 + 推荐档失败补行（无旗标产品字节零变）· kairos/根/引擎 README 双语同步 + guard 分档断言 · SKILL.md 零变更 · changeset cdd-engine minor + kairos patch | [human] · Claude（kairos:cdd-design [P23] · 2026-11-03） |
| v0.2 | 2026-11-03 | 结构回填（doc-contract `presence` 门）：group 标题补 `#### N.M` 条目层（§1–§8 各二至三条），缺口拆成「三包装完 ≠ kairos 跑得动」与「为什么必须落数据面」两条取证，落点面改表载 + 测试基座单列。内容面零语义变更（九行数据面 / 旗标 / 展平 / 输出面 / 文档面 / guard 六块定案不变） | [human] · Claude（kairos:cdd-design [P23] · 2026-11-03） |