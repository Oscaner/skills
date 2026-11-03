---
title: 引擎文档工具（Engine Doc-Tooling）— P23 设计：`cdd init --include-recommends` 推荐包档
doc-type: phase-spec
version: v0.6
date: 2026-11-03
slug: 2026-10-10-engine-doc-tooling-p23
program: 2026-10-10-engine-doc-tooling
author: "[human] · Claude（kairos:cdd-design [P23] grilling → 本会话落 spec · 2026-11-03）"
---

## Design

本相位给第八命令 `cdd init` 增一个可选推荐包档：**核心三包仍是安装契约，推荐六条由 `--include-recommends` 显式选择**。改的是四处——一张表多一个档位字段、一个布尔旗标（旗标字面 + 命令声明两行，同一文件）、一处展平过滤、展平产物多一个档位席位；消费面跟着 README 安装表与 guard。

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

`ARGV_CHANNEL`（`face/declare.ts:55`；`harness` :92 · `update` :98 · `dryRun` :103）是旗标字面的唯一住处。`contract/declare.ts` 是别的东西 —— 文档契约登记表（`ElementRegistry` / `DocType` / `declaredRegistries`），全树对 `ARGV_CHANNEL` 的 import 无一指向它（`infra/runtime.ts:26` · `face/cli.ts:79` · `face/projection.ts:26`）。新增一行：`includeRecommends: { flag: "--include-recommends", type: "bool", help: "also install/update the recommended pi capability packages" }`。

让旗标真正存在的是同一文件里 `CLI_COMMANDS` 的 init 行——`keys: [{ key: "harness", required: true }, { key: "update" }]`（`face/declare.ts:320-324`）增一个 `{ key: "includeRecommends" }`（与 `--update` 同形），不是 `face/cli.ts`。漏掉这一增行时 commander 把 `--include-recommends` 当未知旗标拒绝，`channel-closure.guard.test.ts:32-57` 的反向腿（非 program 的 channel 行必须被某命令声明，腿体 `:49-56`）同时转红。

`face/cli.ts` 只承担三件事：`RunInput.includeRecommends?: boolean`（:165-182）、`#runInput` 的映射（:506-528；新增的 `includeRecommends` 行落在该函数的 `return` 对象里，紧邻既有的 `harness` :525 / `update` :526 两行）、init 节点读一次（:387-402）。

#### 3.2 与既有旗标正交

`--harness` / `--update` / `--dry-run` 的任意组合都被接受；`--harness` 仍是 `requiredOption`（`face/declare.ts:323` 的 init 行 `keys` 里 `required: true`），故 `--include-recommends` 不带 `--harness` 由既有缺旗标 usage 面拒绝（exit 2、零 spawn；既有 pin `cli.test.ts:664-673`），不新增第二道门。

### 4. 定案：唯一展平点按档过滤（`face/init.ts`）

#### 4.1 `InitRequest` 一份请求对象

`CliInit#stepsOf`（`face/init.ts:100-108`）是**唯一**展平点。签名收成一份请求对象避免参数膨胀：`InitRequest = { host: HostId, shape: "install" | "update", recommended: boolean }`；`#stepsOf(request)` 在 `recommended === false` 时只取 `tier === "core"` 的行，`true` 时按表序取全部九行。`run` / `preview` 的公开面同收成 `(request)` 一个参数。

展平产物自己带档位：`InitStep`（今日只有 `packageName` / `argv`，`face/init.ts:66-69`）增 `tier: PluginTier`，由 `#stepsOf` 从行上带下来——这是档位事实随步骤旅行的唯一通道。§5.2 的 `<c> core + <r> recommended` 计数与 §5.3 的推荐档失败补行只读这个字段、**零回查 `PLUGINS`**：全相位的档位判据只有 `#stepsOf` 一处。

#### 4.2 预览与实跑同源

`preview()` 与 `run()` 同读这一份展平——预览不可能漂。分支点仍只有「是否调 `StepRunner`」一处；`--dry-run` 依旧零 spawn、零写入、exit 0、不占轮次。

### 5. 定案：输出面

#### 5.1 步骤头字节零变

步骤头仍是 `init[<i>/<n>] <host> · <package> · <argv 去可执行名>`（今日由 `face/init.ts:127-131` 写出，输出面整体 `:127-143`：步骤头 / 失败行 / 汇总；既有 pin：`init.test.ts:48-55` 的 `CLAUDE_INSTALL_HEADS` 六条 claude 步骤头（使用点 `:242` · `:333`）· `cli.test.ts:631` / `:657` / `:702` 的汇总与预览字节），**不加档标**：包名（`pi-fff` / `rpiv-todo` …）已足够辨识，档标带来的信息量与它重复，却要重锚既有步骤头 pin。

#### 5.2 汇总与预览分档

- 不带旗标 —— 原字节不动：`init: <n> steps ok (<host> · <install|update>)`
- 带旗标 —— `init: <n> steps ok (<host> · <install|update> · <c> core + <r> recommended)`
- 带旗标且 `r === 0`（今天 = claude）—— 追加一行 `init: no recommended packages for <host>`
- 预览面 `would run: <argv join>` 每步一行不变，汇总行 `init: <n> steps (<host> · <install|update>[ · <c> core + <r> recommended]) — dry run, nothing executed`，`r === 0` 时同样追加那句 info

`<c>` / `<r>` 只从步骤的 `tier` 字段（§4.1）计数，不回查名册；失败面同理。

**写口与行序**：那句 info 走 `#header` 同步写口（与步骤头 / 汇总同一面，`face/init.ts:127` · `:143`；测试侧是 `headers` 数组），**排在汇总行之后**——`run` 面与 `preview` 面同侧序，`r > 0` 时该面零新增行。

那行 info 是硬要求：静默接受一个什么都没做的旗标，正是让人以为装过了的那种坑。

#### 5.3 失败面与空档 info 行

既有行 `init[<i>/<n>] · <argv join> · exit <code>`（`face/init.ts:131-135`）不变，首败即停、exit 1 不变。推荐步永远排在核心之后，所以推荐档失败时核心集已经装完——硬停不会让消费者更糟，而软失败会让「装了一半」看不见。

推荐档失败时**额外**追加一行，且随 `shape` 分形——`--update` 形态的补救句在 install 形态下等于「去跑你刚跑的那条命令」：同一条命令、同一个失败原因（npm 404 / 网络），既不自证也不推进，与 §5.2 拒绝的「静默接受一个什么都没做的旗标」等价。

- `--update` 形态：`init: <package> is a recommended package — run cdd init --harness=<host> --include-recommends without --update first`
- `install` 形态：`init: <package> is a recommended package — the core plugin set is already installed`

**写口与行序**：推荐档失败补行走 `io.stderr`（与既有失败行 `face/init.ts:132` 同面），行序 = 既有失败行 → 推荐档补行 →（`--update` 形态）既有未安装提示；`install` 形态只有前两行。

`--update` 的既有未安装提示（`if the package is not installed, run cdd init --harness=<host> without --update first`，`face/init.ts:136-139`）**字节不改**、两档共用：它在推荐档并不谎（确实要先装），而逐档改写这句既有提示会把一条 pin 变成两条。

### 6. 定案：消费面文档

#### 6.1 六份 README

- `packages/kairos/README.md` + `README.zh-CN.md`：安装段 lead-in 分档一句（前三行是安装契约，后六行是推荐档，`--include-recommends` 才装）+ 安装表扩到九行（推荐行 claude 单元格写 `—`）+ 表下六条一组讲推荐理由（**不逐行成列**，逐行理由会把表撑到读不动）+ 一句 `--update --include-recommends` 的用法。
- 根 `README.md` + `README.zh-CN.md`：Installation 一句提及旗标，不复制包清单。
- `packages/cdd-engine/README.md` + `README.zh-CN.md`：CLI 表 `init` 行改 `cdd init --harness=<claude\|pi> [--update] [--include-recommends]`。

#### 6.2 SKILL.md 零变更

安装面归 README，skill 只管流程。推荐包缺失以工具缺失的形式暴露，不改任何 skill 的步骤形状；六份 SKILL.md 本相位零变更（也让本相位不碰消费面纯净纪律与 anatomy pin）。

这条「零变更」是可判事实而非承诺，落点是 `packages/kairos/tests/grep-sweep-regression.test.ts` 增一条 SKILL.md-only 漏断言——与该文件既有的 `SKILL_ONLY_TOKENS` 腿同形（`grep -rn <token> packages/kairos/skills/ --include="SKILL.md"` 命中数为 0），字面集 = `--include-recommends` 加推荐六条包名（`pi-fff` · `rpiv-todo` · `rpiv-ask-user-question` · `pi-web-access` · `pi-background-tasks` · `pi-agentsmd`）。断言只扫 `packages/kairos/skills/`：同相位的六份 README 必然携带这些字面（§6.1），扫全树那条门会自伤。今日实测零命中，故它一落地就是绿的。波次归 W3（见 §8.2）。

### 7. 定案：guard 分档（`plugins.guard.test.ts`）

#### 7.1 核心行断言原样

「README 安装表 ↔ 名册」门今日把表逐格钉在 `PLUGINS` 上（`plugins.guard.test.ts:96-134`：`installTable` :67-86 从表体第一条包名行读到第一条非表行为止，`renderCell` :90-94 直接按 README 行号 `PLUGINS[rowIndex]!` 解引用）。分档后表体从三行变九行，**切分必须是双侧的**：

- 核心 span = 表体第 1–3 行，对 `tier === "core"` 的名册。行名 + 顺序 + 双列 install argv 全角 `；` 连接 + 表头三格断言**逐格原样保留**；唯一改动是 `renderCell` 改吃**行对象**（`row[host].install`），不再用 README 行号索引 `PLUGINS`。
- 推荐 span = 余下第 4–9 行，对 `tier === "recommended"` 的名册（§7.2）。
- 两侧 span 的行数之和必须等于表体行数（`rows.length === core.length + recommended.length`）：少一行或多一行即红。这条守恒 pin 与推荐 span 断言一起排到 W3（与 kairos README 九行同波落地，见 §8.2）——W1 时表体仍三行，core 3 + recommended 6 = 9 ≠ 3，此时落地即结构性红，故不属 W1 的收工判据。

「逐格原样保留」与「只改名册侧」两句不能只改单侧：只改名册侧时核心行名断言 `rows.map((row) => row[0])`（:101）会拿九行去比三个 core 名，逐格循环（:108-121）从第 4 行起取到 core 名册之外，直接抛错。

#### 7.2 推荐行断言与 `—`

推荐行断言：首列 = `name`、顺序 = 名册序、claude 单元格 = `—`、pi 单元格 = install argv 全角 `；` 连接。`—` 是空单元格的**唯一**写法（写进断言字面），guard 把它认作空档而不是缺失（行对象侧就是空的 install 数组 → 渲染成 `—`）。四份 README 的 `cdd init` 命令字节断言保留（`plugins.guard.test.ts:33` 的双语安装表 · `:36` 的四份 `INIT_SURFACES` · `:136-145` 的 claim-surface 腿）；新增一处：引擎 README 双语的 `init` usage 行携带 `[--include-recommends]`。

### 8. 落点、依赖与发行

#### 8.1 落点与测试基座

| 面 | 落点 |
|---|---|
| 数据面 | `face/plugins.ts`（`PluginTier` + `tier` 字段 + 六行） |
| 旗标 | `face/declare.ts`（`ARGV_CHANNEL` 一行 :55 + `CLI_COMMANDS` init 行的 `keys` 增行 :320-324，两处同一文件）· `face/cli.ts`（`RunInput.includeRecommends` + `#runInput` 映射 + init 节点读一次） |
| 展平与输出 | `face/init.ts`（`InitRequest` + `#stepsOf` 分档过滤 + `InitStep.tier` + 分档汇总 / info 行 / 推荐档失败补行） |
| 测试 | 引擎侧 `init.test.ts` · `plugins.test.ts` · `plugins.guard.test.ts` · `cli.test.ts` · kairos 侧 `packages/kairos/tests/grep-sweep-regression.test.ts`（SKILL.md 零推荐字面漏断言） |
| 文档 | 六份 README（根 / kairos / 引擎，各双语） |

测试基座跟随数据面（现状 pin：`plugins.test.ts:69` 三值行名 · `:74` 列集 · `:87-88` 每行步数 · `:118` 十八元组与 :93 的 describe 标题 · `:68` 行序与 `:79` 每行步数两条描述性 `it` 标题 · `init.test.ts:36-41` 的 `ROSTER` / `sequenceOf` · `cli.test.ts:629` / `:649` 的 roster flatMap）：

- `plugins.test.ts`：行名断言改九值（core 三 + recommended 六）· 列集断言 `Object.keys(row).filter((key) => key !== "name")` 需同时排除 `tier`（断言值回到 `[claude, pi]`）· 每行步数 pin 分档（core 行 claude 2 / pi 1，推荐行 claude 0 / pi 1）· 元组计数 `toHaveLength(18)` 改 **30**（`install` 15 + `update` 15：核心三行各 6 元组 = 18，推荐六行各 claude 空 + pi 2 元组 = 12），并同步两级标题字面——describe `:93` 改「the fifteen update tuples and the fifteen install tuples」、`it` `:114` 改「all thirty argv tuples」· `INSTALL_ARGV`（`:18-40`）/ `UPDATE_ARGV`（`:43-65`）逐行查表补六行，断言侧是 `:94-110` · 同文件带退役事实的描述面**四处同波**（W1 名册派生基座）改写，不得只改其中一处——头注释（`plugins.test.ts:3-7`）+ `it` `:68` + `it` `:79` + 两级计数标题 `:93` / `:114`。`:68` 现标题「the rows are exactly superpowers → mattpocock-skills → kairos (upstream first, kairos last)」描述的是已不存在的三行名录，改「the rows are exactly core three then recommended six (superpowers → mattpocock-skills → kairos → pi-fff → …)」；`:79` 现标题「the two shapes carry the same step count per row — claude 2 steps, pi 1 step」的字尾与它两行之下落地的分档 pin 直接矛盾，去掉字尾、只留「the two shapes carry the same step count per row」，分档计数交给断言。三处旧表述一并更正：行序（core 三 → recommended 六，不再是「superpowers → mattpocock-skills → kairos」的九行整体序）、每行步数（core claude 2 / pi 1、推荐 claude 0 / pi 1，不再是每行同构）、元组计数（fifteen install + fifteen update，不再是 nine / nine）。
- `init.test.ts`：`ROSTER` 与 `sequenceOf` 按 `tier === "core"` 取行（无旗标面）并新增推荐面用例。
- `cli.test.ts`：`:629` / `:649` 的 `roster` flatMap 改取 core 行；`:631` / `:657` / `:702` 的汇总字节 pin（`init: 3 steps ok (pi · install)` · `init: 6 steps ok (claude · update)` · `init: 6 steps (claude · install) — dry run, nothing executed`）**保持字面不变**。
- `packages/kairos/tests/grep-sweep-regression.test.ts`：新增一条 SKILL.md-only 漏断言（§6.2），零命中字面集 = `--include-recommends` + 推荐六条包名；今日实测零命中，W3 落地。

**产品字节 pin 不动**（`init[1/3] pi · …` · `init: 3 steps ok (pi · install)` · claude 六条步骤头）。

#### 8.2 依赖与发行

**依赖**：`P22` hard，已 Done（serial-phase 门通过）。**发行**：changeset `cdd-engine` **minor** + `kairos` **patch**（D74：方法论契约不变，新增可选旗标与数据行），不发布。**波次**：三波，每波 ≤3 任务，判据是「每波跑完能自证收工」——**W1** 数据面九行 + `#stepsOf` 的 `tier === "core"` 过滤 + guard 核心 span（`renderCell` 吃行对象 + core 过滤 + 核心行名/顺序/核心单元格）+ 名册派生测试基座：落行的同波必须带上这道过滤，否则无旗标 `--harness=pi` 就是 9 步，五处字节 pin 当场红（`cli.test.ts:631` · `init.test.ts:184-186` / `:193-198` / `:269` · `preview.test.ts:430`），名称侧同样红（`init.test.ts:40-41` 的 `sequenceOf` 走 core 过滤即 3 条，而 run 跑 9 条）；该过滤不改产品字节（无旗标仍 3 / 6 步），正是「无旗标字节零变」的桥 · **W2** 旗标两行 + `InitStep.tier` 席位 + 推荐路径展平 + 输出面（分档汇总 / 空档 info / 推荐档失败补行）· **W3** 六份 README 九行 + kairos 安装表分档断言，同波落地 guard 的推荐 span 断言、「两侧行数之和 = 表体行数」守恒 pin 与 kairos 套件的 SKILL.md 零推荐字面漏断言（§6.2）。

### 9. 非目标

- 改核心三包行序或 argv · 改 `--update` 语义 · 新增 CLI 动词 · 引擎解析 harness 输出并据此跳过/继续 · 默认安装推荐包。
- 推荐行的逐行理由列 · 六份 SKILL.md 变更 · 架构图与 `cdd` 八命令字面变更（命令数不变）。
- 运行时探测「已安装则跳过」（引擎零 harness 输出解析）· 给 claude 编造推荐包（原生能力不重复安装）。

### Acceptance criteria

- `数据面`：`PLUGINS` 单表九行、`tier` 字段与 `PluginTier` 联合在册 · 三行 core 在前、六行 recommended 在后且推荐序 = §2.1 表序 · 推荐行 claude 列为空数组而非缺列（类型层与运行层各一条 pin）· `update` argv = 同行 `install` argv 的 `install` → `update` 替换，限 **pi 列九行 + 推荐行 claude 列（空 → 空真）**，逐行 pin；核心三行的 claude `update` argv 是既有契约（`marketplace add` → `marketplace update` 且 owner 前缀变化：`obra/superpowers-marketplace` → `superpowers-marketplace` 等），本相位零改动、不设该句式 pin（沿用 `plugins.test.ts:18-65` 夹具）
- `旗标`：`ARGV_CHANNEL.includeRecommends`（`face/declare.ts`）在册且 `flag === "--include-recommends"` · `CLI_COMMANDS` 的 init 行 `keys` 携带该键（`channel-closure.guard.test.ts:32-57` 的双向闭合在家）· `cdd init --harness=pi --include-recommends --dry-run` exit 0 · 不带 `--harness` 带旗标 → usage exit 2 且零 spawn · 既有 harness 值域拒绝面不回归
- `展平`：`--harness=pi` 无旗标 = 3 步、有旗标 = 9 步，前 3 步的 **argv 序列**与无旗标逐字节相同（步骤头形如 `init[<i>/<n>]`，分母随总步数 3→9 变，故头部只改 `<n>`、不比步骤头字节）· `--harness=claude` 有旗标 = 6 步（与无旗标同 argv 序列）· `--update` 两档各走 update 序列且零 install argv · `preview()` 与 `run()` 同一请求下共用同一展平（独立源比对，不从运行反推）· `InitStep.tier` 由 `#stepsOf` 从行上键入、汇总计数与失败补行零回查名册 · 名册派生面跟随：`plugins.test.ts` 行名断言九值、`init.test.ts` 的 `sequenceOf` / `ROSTER` 按 `tier === "core"` 取行
- `输出面`：无旗标时**产品字节零变**——步骤头（`init[1/3] pi · …` · `init[1/6] claude · …` 六条）、汇总行（`init: 3 steps ok (pi · install)`）、失败行、`--update` 提示、预览汇总行全部原样，既有字节 pin **不重锚**（仅名册派生辅助按 core 档重构，见 §8.1）· 带旗标汇总行含 `<c> core + <r> recommended` · claude 带旗标两面各出 `init: no recommended packages for claude` · 推荐档失败 → 首败即停 exit 1 且追加一行点名该包属推荐档：`--update` 形态为 `init: <package> is a recommended package — run cdd init --harness=<host> --include-recommends without --update first`、install 形态为 `init: <package> is a recommended package — the core plugin set is already installed`（两形态各一条字节断言，行序 = 既有失败行 → 补行 →（update 形态）既有未安装提示，写口见 §5.3）· `--dry-run --include-recommends` 预览 9 行 `would run:` + 分档汇总 + 零 spawn、零写入、exit 0
- `消费面`：kairos README 双语九行安装表（推荐行 claude 单元格 `—`）+ 分档 lead-in + 六条一组理由段 + `--update --include-recommends` 用法句 · 根 README 双语 Installation 提及旗标 · 引擎 README 双语 `init` usage 行含 `[--include-recommends]` · 六份 SKILL.md 零变更，机检落点 = `packages/kairos/tests/grep-sweep-regression.test.ts` 的 SKILL.md-only 漏断言：`packages/kairos/skills/` 六份 SKILL.md 全文零 `--include-recommends` 字面、零推荐六条包名字面（`pi-fff` · `rpiv-todo` · `rpiv-ask-user-question` · `pi-web-access` · `pi-background-tasks` · `pi-agentsmd`），W3 落地
- `guard`：核心 span = 表体第 1–3 行对 core 名册，断言逐格原样（行名 / 顺序 / 双列 `；` 连接 / 表头三格）· 推荐 span = 第 4–9 行对 recommended 名册逐格断言（首列 / 顺序 / `—` / `；` 连接）· 两侧行数之和 = 表体行数 · 引擎 README `init` usage 行 `[--include-recommends]` 断言 · kairos 双语安装表少一行或多一行 → 红（根 README 只做命令字节断言，没有行级门）
- `全量`：`cdd` 仍八命令（结构 pin 不变）· engine vitest 全绿 · typecheck ×3 · `env -u AI_AGENT pnpm run validate` exit 0 · `pnpm run emit:check` fresh（无生成物触发器触碰）· changeset `cdd-engine` minor + `kairos` patch，不发布

## Constraints

- **数据面单源**：推荐六条的 argv 只住在 `face/plugins.ts`。README 表、guard 断言、步骤头全是从它渲染出来的读者；出现第二份清单（散文里的命令、dotfiles 复制、模板里的副本）即本相位点名禁止的回归
- **无旗标字节零变**：不带 `--include-recommends` 时，`cdd init` 的三面（步骤头 / 汇总 / 失败）与 `--dry-run` 预览的每个产品字节保持不变，既有字节 pin **不重锚**。**唯一例外是一类而非一处：凡镜像无旗标行为的测试基座派生，一律按 `tier === "core"` 取行**（无旗标面）——数据面多出六行，派生断言、辅助函数、计数、逐行 argv 查表都要跟随。评审点名的 `sequenceOf` / `ROSTER` / `PLUGINS.map(name)` / `plugins.test.ts:74` 列集 / `:87-88` 每行步数 / `:118` 元组计数 / `INSTALL_ARGV` 逐行查表 / `cli.test.ts:629` `:649` 的 roster flatMap 是实例，不是穷举。把基座重构当成允许改产品字节是禁止的滑坡
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
| v0.3 | 2026-11-03 | 评审回填（无结构变更，内容面）：旗标落点更正为 `face/declare.ts`（`ARGV_CHANNEL:55` + `CLI_COMMANDS` init 行 `keys:320-324`，`face/cli.ts` 只留 `RunInput` / 映射 / 节点读取）· `InitStep` 增 `tier` 席位（档位随步骤旅行、零回查）· §1 三处改四处 · guard 分档写成双侧 span + `renderCell` 吃行对象 + 两侧行数之和 pin · 无旗标例外由三处封闭枚举改成「凡名册派生按 core 取行」的规则并点名 `plugins.test.ts` / `cli.test.ts:629,649` 两文件面 · 推荐档失败补行按 `shape` 分形（install 形态不再劝重跑同一命令），两形态各一条字节断言 · AC 展平条改「前 3 步 argv 序列逐字节相同」 · AC guard 条收窄到 kairos 双语安装表 · 现状主张补 `path:line` pin | [human] · Claude（kairos:cdd-design [P23] · 2026-11-03） |
| v0.4 | 2026-11-03 | 评审回填（无结构变更，内容面）：`plugins.test.ts` 元组计数 42 → **30**（install 15 + update 15）并写出两级标题新字面（describe `:93`「fifteen … fifteen」· `it` `:114`「thirty」）· AC `数据面` 的 `update` = `install` 替换句式限定为 pi 列九行 + 推荐行 claude 空列，核心三行 claude 既有 argv 零改 · §8.2 波次重切为三波（W1 数据面 + guard 核心 span + 名册派生基座 · W2 旗标 + `tier` 席位 + 输出面 · W3 六份 README + 安装表分档断言）· §5.2 / §5.3 补写口与行序（info 行走 `#header` 排在汇总行后 · 推荐档失败补行走 `io.stderr`，顺序 = 失败行 → 补行 →（update）既有提示）· 三处 `path:line` pin 更正（`init.test.ts:48-55` 用点 `:242` · `:333` · `plugins.guard.test.ts:136-145` · 夹具 `INSTALL_ARGV:18-40` / `UPDATE_ARGV:43-65`，断言 `:94-110`）· `channel-closure.guard.test.ts:39-58` 收成 `:32-57` | [human] · Claude（kairos:cdd-design [P23] · 2026-11-03） |
| v0.5 | 2026-11-03 | 评审回填（无结构变更，内容面）：§8.2 三波再切，判据写成「每波跑完能自证收工」——`#stepsOf` 的 `tier === "core"` 过滤从 W2 移入 **W1**（同波落九行不带过滤即无旗标 9 步，五处字节 pin 全红，并点名 `sequenceOf` 名称侧），guard 的推荐 span 断言与「两侧行数之和 = 表体行数」守恒 pin 明确排到 **W3**（W1 表体仍三行，守恒结构性红），W2 保留旗标两行 + `InitStep.tier` 席位 + 推荐路径展平 + 输出面 · 四处 `path:line` 按实测更正：`plugins.guard.test.ts` describe `:95-130` → `:96-134` · `installTable` `:67-88` → `:67-86` · `renderCell` `:90-95` → `:90-94` · `face/cli.ts` 的 `#runInput` `:506-520` → `:506-528`（并点明新增映射落在其 return 对象、紧邻 `update` :526） | [human] · Claude（kairos:cdd-design [P23] · 2026-11-03） |
| v0.6 | 2026-11-03 | 评审回填（无结构变更，内容面）：`消费面` AC 的「六份 SKILL.md 零变更」补机检落点与波次——`packages/kairos/tests/grep-sweep-regression.test.ts` 的 SKILL.md-only 漏断言（零 `--include-recommends` 字面 + 零推荐六条包名字面，W3），并写进 §6.2 / §8.1 落点表 `测试` 行 / §8.1 测试基座 / §8.2 W3 · §8.1 的 `plugins.test.ts` bullet 描述面由「头注释 + 两级标题」扩为**四处**（头注释 + `it` `:68` + `it` `:79` + 计数标题 `:93`/`:114`），并写出 `:68` / `:79` 的新标题字面 | [human] · Claude（kairos:cdd-design [P23] · 2026-11-03） |
