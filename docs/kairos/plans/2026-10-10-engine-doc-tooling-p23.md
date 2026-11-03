---
title: 引擎文档工具（Engine Doc-Tooling）— P23 计划：`cdd init --include-recommends` 推荐包档
doc-type: plan
version: v0.2
date: 2026-11-04
slug: 2026-10-10-engine-doc-tooling-p23
base: develop
---

## Constraints

- **逐字取 spec**：本计划只实现 `docs/kairos/specs/2026-10-10-engine-doc-tooling-p23-design.md` **现行 `version`**（v0.8）所指的面；面与裁决以现行 spec 与 handoff 裁定为准，需要改动即回评审，不在计划里顺手扩面。实现者读该 spec 的 front-matter `version` 即判读基准。
- **数据面单源**：推荐六条的 argv 只住在 `face/plugins.ts` 的 `PLUGINS`。README 表、guard 断言、步骤头都是从它渲染出来的读者；任何第二份清单（散文里的命令、模板副本）都是回归。
- **无旗标产品字节零变**：不带 `--include-recommends` 时步骤头 / 汇总行 / 失败行 / `--update` 提示 / 预览汇总行的每个产品字节保持不变，既有字节 pin **不重锚**。唯一例外是**名册派生的测试基座**（`sequenceOf` / `ROSTER` / `PLUGINS.map(name)` / `INSTALL_ARGV`·`UPDATE_ARGV` 夹具 / `cli.test.ts` 的两处 roster flatMap），它们按 `tier === "core"` 取行——派生辅助的重构不得被当成改产品字节的许可。
- **核心契约不动**：核心三行的 claude argv（`marketplace add` → `marketplace update` 且 owner 前缀变化）、行序、失败语义、`--update` 未安装提示句都是既有契约；本相位只追加档位。
- **引擎零 harness 输出解析**：不得据子进程输出判断「已安装 / 可跳过 / 可继续」；推荐档失败 = 首败即停 + exit 1。
- **claude 列空是事实而非占位**：claude 推荐列写空数组、README 写 `—`；不得为表好看编造 claude 推荐包。
- **门必须可红**：新增的消费面泄漏门只许 `-e` 形命令（`grep -rn --include="*.md" -e "<字面>" …`），**禁**裸内插与 `\-\-` 转义形（落在 TS 模板字符串里 `\-` 求值成 `-`，等同裸内插）；正控必须是本身以 `--` 开头的在册 token（`--plan`，今日 13 命中），断言 ≥1。不可红的门不算门。
- **消费面 purity**：六份 README 只承载旗标用法与「为什么推荐这六条」，不装载程序历史与相位编号；七份 skill 面 markdown（六份 `SKILL.md` + `cdd-dev/docs/base.md`）零变更。
- **零新依赖 / 零新命令 / 零环境变量**：不引入运行时探测依赖，不加 CLI 动词，不用环境变量控制档位。
- **调用与提交纪律**：引擎一律本地 `node packages/cdd-engine/src-next/bin.ts`；每任务提交过 `pnpm run precommit`；末任务跑 `env -u AI_AGENT pnpm run validate`（`AI_AGENT` 在场会让 5 条既有注入派发 E2E 误红）；changeset `cdd-engine` **minor** + `kairos` **patch**（D74），不发布。

## Review Focus

- **无旗标回归**：任何人重跑 `cdd init --harness=pi` 都应看到和今天一模一样的 3 步与 `init: 3 steps ok (pi · install)`——由 Task 1 的既有字节 pin（步骤头 / 汇总 / 预览 / 失败行，全部不重锚）覆盖。
- **`--include-recommends` 不带 `--harness`**：应走既有 usage 面 exit 2、零 spawn，不得新增第二道门——由 Task 2 的用例覆盖。
- **claude + 旗标**：推荐列为空，消费者应看到 6 步 + 一行 `init: no recommended packages for claude`，不得静默——由 Task 2 覆盖。
- **`--update --include-recommends` 的失败面**：推荐包未安装时既有提示与档位补行**两行都在、顺序固定**（失败行 → 档位补行 → 既有提示），消费者据此知道该重跑哪条——由 Task 2 覆盖。
- **README 与名册漂移**：少一行、多一行、空单元格写成空白而非 `—`，guard 守恒 pin 都应红——由 Task 3 覆盖。
- **泄漏门自身假绿**：真有人把 `--include-recommends` 写进 SKILL.md 或 `cdd-dev/docs/base.md` 时门必须红；由 Task 4 的 `--plan` 正控与 `-e` 形共同保证。

### Task 1: 名册落九行 + 展平按档过滤 + guard 核心 span + 名册派生基座

#### Objective
`PLUGINS` 从三行扩到九行（core 3 + recommended 6，每行带 `tier`），`#stepsOf` 收成一份 `InitRequest` 并按 `tier === "core"` 过滤，使无旗标路径与今日逐字节等价；guard 的核心 span 改为吃行对象（不再用 README 行号索引名册），名册派生的测试基座按 core 取行。这一波收工时 `pnpm -C packages/cdd-engine test` 必须自证全绿。

#### Files
- Modify: `packages/cdd-engine/src-next/face/plugins.ts`（`PluginTier` · `tier` 字段 · 六行推荐）· `packages/cdd-engine/src-next/face/init.ts`（`InitRequest` · `#stepsOf` 过滤 · `run`/`preview` 收成单参）· `packages/cdd-engine/src-next/face/cli.ts`（两处调用点传 `{ recommended: false }`）
- Test: `packages/cdd-engine/src-next/face/__tests__/plugins.test.ts` · `plugins.guard.test.ts` · `init.test.ts` · `cli.test.ts`
- Modify (diagram evidence): `docs/diagrams/src/architecture.en.json` · `docs/diagrams/src/architecture.zh-CN.json`（`upstream` 节点的 `plugins.ts` citation 重锚）· 重生成的 `docs/diagrams/architecture.en.html` / `docs/diagrams/architecture.zh-CN.html`（Archify 产物，禁手改）

#### Consumes
spec §2.1（九行表与行序）· §2.2（推荐行的 `update` = `install` 换一词；claude 列空数组）· §4.1（`InitRequest = { host, shape, recommended }`）· §7.1（guard 核心 span 双侧切分、`renderCell` 吃行对象）· §8.1（测试基座与四处标题）· §8.2（W1 判据与五处既有字节 pin 的站名）· `diagrams.guard.test.ts:119-124` 的 `upstream` 锚点与标识符（`^export const PLUGINS = \[$` → `^\] as const satisfies readonly PluginRow\[\];$`，identifier `PLUGINS`）。

#### Produces
- `export type PluginTier = "core" | "recommended"`；`PluginRow` 增 `readonly tier: PluginTier`；`PLUGINS` 九行（superpowers · mattpocock-skills · kairos · pi-fff · rpiv-todo · rpiv-ask-user-question · pi-web-access · pi-background-tasks · pi-agentsmd）。
- `export interface InitRequest { readonly host: HostId; readonly shape: "install" | "update"; readonly recommended: boolean }`；`CliInit#stepsOf(request: InitRequest): InitStep[]`（`recommended === false` ⇒ 只 core）；`run(request)` / `preview(request)`。
- `plugins.guard.test.ts` 的 `renderCell(row, host)` 吃行对象；核心 span 断言按 `tier === "core"` 取行。
- 两份架构图源 JSON 的 `upstream` citation 落在新的 `export const PLUGINS = [` 块内（en / zh-CN 各一处），`meta.repository.revision` 钉到含该行的提交；两份 HTML 由 Archify finalize 重生成。

#### Steps
- [ ] **Step 1: 先写红用例（数据面与基座）** —— 在 `plugins.test.ts` 断言：行名序列为九值（core 三在前、推荐六按 §2.1 序）· `tier` 值逐行正确 · 推荐行 claude 列 `install`/`update` 均为空数组 · 每行 `update` 与 `install` 等长 · 元组总数 30（install 15 + update 15）· 夹具 `INSTALL_ARGV` / `UPDATE_ARGV` 补六条；四处带计数的标题与文件头 docstring 一并改成新事实。 — checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/face/__tests__/plugins.test.ts` 先红（行名仍三值）
- [ ] **Step 2: 落数据面** —— `plugins.ts` 增 `PluginTier` 与 `tier`、补六行推荐（pi 列 `["pi","install","npm:<pkg>"]` / `["pi","update","npm:<pkg>"]`，claude 列 `{ install: [], update: [] }`）。 — checkable: Step 1 的用例转绿
- [ ] **Step 3: 收展平面** —— `init.ts` 引入 `InitRequest`，`#stepsOf` 按 `recommended` 过滤，`run`/`preview` 收成单参；`cli.ts` 两处调用点传 `{ recommended: false }`；`init.test.ts` 的 `sequenceOf` / `ROSTER` 按 `tier === "core"` 取行，`cli.test.ts` 的两处 roster flatMap 同样处理。 — checkable: `init.test.ts` / `cli.test.ts` / `preview.test.ts` 全绿，且 `init: 3 steps ok (pi · install)` 等既有字节 pin 未改一字
- [ ] **Step 4: 新增档位展平的单元用例** —— 取证面走公开面（`#stepsOf` 是 `#` 私有成员，测试取不到）：`preview({ host: "pi", shape: "install", recommended: true })` 得 9 条 `would run:` 行且前 3 条 argv 序列与 core 路径逐项相等；`preview({ host: "claude", shape: "install", recommended: true })` 得 6 条（推荐列空）。汇总行字节归 Task 2，本步不比它。 — checkable: 两条新用例绿，且断言比的是 argv 序列而非步骤头字节（分母随总步数变）
- [ ] **Step 5: guard 核心 span 改吃行对象** —— `installTable` 返回表体行；`renderCell` 改吃行对象；核心 span = 表体第 1–3 行对 core 名册，逐格断言（行名 / 顺序 / 双列 `；` 连接 / 表头三格）保持原样；不得引入「两侧行数之和 = 表体行数」的守恒 pin（W1 表体仍三行，那条排到 Task 3）。 — checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/face/__tests__/plugins.guard.test.ts` 绿
- [ ] **Step 6: 架构图证据重锚 + 重生成（`plugins.ts` 侧）** —— 按 `diagrams.guard.test.ts:119-124` 的同源锚点重算 `upstream` 节点 citation 的 `line` / `end_line`（`^export const PLUGINS = \[$` → `^\] as const satisfies readonly PluginRow\[\];$`，今日 40-92，落 `tier` 后首行下移），en `:122-124` 与 zh-CN `:122-124` 各一处；先提交 Task 1 的源码与 JSON，再取该提交的 40-hex（须已在本地 clone）钉进两份 JSON 的 `meta.repository.revision`；最后按 `docs/diagrams/README.md:16` 的 Archify finalize 命令（`node <archify>/bin/archify.mjs finalize architecture docs/diagrams/src/architecture.<lang>.json docs/diagrams/architecture.<lang>.html --repo-root . --quality showcase --json`）重生成两份 HTML——`plugins.ts#L40-L92` 这类证据链接嵌在产物里，**禁止手改 HTML**。 — checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/face/__tests__/diagrams.guard.test.ts` 四条腿全绿（含 `revision` 腿）
- [ ] **Step 7: 全量跑绿 + 提交** —— `pnpm -C packages/cdd-engine test` → PASS。 — checkable: 套件 exit 0（含 `diagrams.guard.test.ts` 四条腿），`pnpm run precommit` 通过后提交

#### Acceptance
`PLUGINS` 九行且 `tier` 在册 · 推荐序 = §2.1 序 · 推荐行 claude 列为空数组（类型层与运行层各一条 pin）· 元组总数 30 · 无旗标 `--harness=pi` 仍 3 步、`claude` 仍 6 步，步骤头 / 汇总 / 失败 / 预览字节零变（既有 pin 未重锚；字面对象 = `cli.test.ts:631` / `:657` / `:702` · `init.test.ts:184-186` / `:193-198` / `:269` · `preview.test.ts:408` / `:430`）· `recommended: true` 的 pi 展平 = 9 步且前 3 步 argv 序列与 core 相同 · `upstream` citation 落在新的 `PLUGINS` 块内、`revision` 钉到含新行的提交、两份 HTML 由 Archify 重生成（零手改）· guard 核心 span 绿且 `renderCell` 不再索引名册 · engine 套件全绿。

#### DependsOn
none

### Task 2: 旗标两行 + `InitStep.tier` 席位 + 输出面三句

#### Objective
让 `--include-recommends` 真正存在并且可见：`ARGV_CHANNEL` 一行旗标、`CLI_COMMANDS` 的 init 行 `keys` 增一行、`RunInput` 一字段与 `#runInput` 映射、init 节点读取；展平产物带上 `tier` 席位，输出面给出分档汇总、空档 info 行与推荐档失败补行（install / update 两形）。

#### Files
- Modify: `packages/cdd-engine/src-next/face/declare.ts`（`ARGV_CHANNEL.includeRecommends` · `CLI_COMMANDS` init 行 `keys`）· `packages/cdd-engine/src-next/face/cli.ts`（`RunInput.includeRecommends?` · `#runInput` 映射 · init 节点读一次并透传）· `packages/cdd-engine/src-next/face/init.ts`（`InitStep.tier` · 分档汇总 · 空档 info 行 · 推荐档失败补行）
- Test: `packages/cdd-engine/src-next/face/__tests__/init.test.ts` · `cli.test.ts` · `channel-closure.guard.test.ts`（若其反向腿要求声明）
- Modify (diagram evidence): `docs/diagrams/src/architecture.en.json` · `docs/diagrams/src/architecture.zh-CN.json`（`engine` 节点的 `cli.ts` citation 重锚 + `meta.repository.revision` 重钉）· 重生成的 `docs/diagrams/architecture.en.html` / `docs/diagrams/architecture.zh-CN.html`（Archify 产物，禁手改）

#### Consumes
Task 1 的 `InitRequest` / `#stepsOf` / `PLUGINS` 与 `tier` · spec §3.1（`ARGV_CHANNEL` 与 `CLI_COMMANDS` 两处落点）· §3.2（正交与 usage 面）· §5.2（分档汇总与空档 info）· §5.3（失败面与两形补行）· §8.1（`#runInput` 的 `:506-528`、init 节点 `:387-402`）· `diagrams.guard.test.ts:133-137` 的 `engine` 锚点与标识符（`^ {4}commandNode\("init"\)\.action\(` → `^ {4}\}\);$`，identifier `commandNode("init")`）。

#### Produces
- `ARGV_CHANNEL.includeRecommends = { flag: "--include-recommends", type: "bool", help: "also install/update the recommended pi capability packages" }`；`CLI_COMMANDS` init 行 `keys` 得 `{ key: "includeRecommends" }`。
- `InitStep` 增 `readonly tier: PluginTier`；`#stepsOf` 用它渲染，零回查名册。
- 汇总行三形：无旗标 `init: <n> steps ok (<host> · <shape>)`（原字节）· 带旗标 `… · <c> core + <r> recommended)` · `r === 0` 时追加 `init: no recommended packages for <host>`（走 `#header`、排在汇总行之后）。
- 预览汇总同形（`— dry run, nothing executed` 尾巴不变）。
- 推荐档失败补行（`io.stderr`，行序 = 既有失败行 → 补行 →（update 形态）既有未安装提示）：install 形态 `init: <package> is a recommended package — the core plugin set is already installed`；update 形态 `… — run cdd init --harness=<host> --include-recommends without --update first`。
- 两份架构图源 JSON 的 `engine` citation 落在新的 `commandNode("init").action(` 块内（en / zh-CN 各一处），`meta.repository.revision` 重钉到同时含两处新锚点的提交；两份 HTML 由 Archify finalize 重生成。

#### Steps
- [ ] **Step 1: 先写红用例（命令面）** —— `--harness=pi --include-recommends` 得 9 步、`--harness=claude --include-recommends` 得 6 步 + info 行、不带 `--harness` 带旗标 exit 2 零 spawn、`--dry-run --include-recommends` 预览 9 行 `would run:` 且零 spawn；`--update --include-recommends` 成功面两档各一条：`preview({ host: "pi", shape: "update", recommended: true })` = 9 条 update argv、`preview({ host: "claude", shape: "update", recommended: true })` = 6 条 update argv，argv 序列按名册 update 列独立取期望并与同行 install argv 零交集（不从 install 列反推），claude 同时出 info 行。 — checkable: 先红（commander 现在把该旗标当未知选项拒绝）
- [ ] **Step 2: 让旗标存在** —— `declare.ts` 增 `ARGV_CHANNEL` 行与 `CLI_COMMANDS` init 行 `keys` 项；`cli.ts` 增 `RunInput.includeRecommends?` 与 `#runInput` 映射，init 节点读一次后透传进 `InitRequest.recommended`。 — checkable: Step 1 的四条用例里命令面三条转绿，`channel-closure.guard.test.ts` 绿
- [ ] **Step 3: 档位随步骤旅行** —— `InitStep` 增 `tier`，`#stepsOf` 填它；`run()` / `preview()` 只读展平产物，零 `PLUGINS` 回查。 — checkable: 源码面 `grep` 显示 `run()`/`preview()` 体内零 `PLUGINS` 引用（`tier` 判据只住 `#stepsOf`）
- [ ] **Step 4: 输出面三句** —— 分档汇总（含预览）、空档 info 行走 `#header` 排汇总后、推荐档失败补行按 shape 分形走 `io.stderr`；无旗标路径零字节改动。 — checkable: `init.test.ts` 的既有输出面用例全绿未改；新增用例覆盖三句字节与两形行序
- [ ] **Step 5: 架构图证据重锚 + 重生成（`cli.ts` 侧）** —— 按 `diagrams.guard.test.ts:133-137` 的同源锚点重算 `engine` 节点 citation 的 `line` / `end_line`（`^ {4}commandNode\("init"\)\.action\(` → `^ {4}\}\);$`，今日 387-402，落 `RunInput.includeRecommends` 与 `#runInput` 映射后首行下移），en `:208-210` 与 zh-CN `:208-210` 各一处；先提交本任务的源码改动，把 `meta.repository.revision` 重钉到**同时含两处新锚点**的那次提交（40-hex，须已在本地 clone），再按 `docs/diagrams/README.md:16` 的 Archify finalize 命令重生成两份 HTML——产物里的证据链接随 citation 走，**禁止手改 HTML**。 — checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/face/__tests__/diagrams.guard.test.ts` 四条腿全绿（含 `revision` 腿）
- [ ] **Step 6: 全量跑绿 + 提交** —— `pnpm -C packages/cdd-engine test` → PASS。 — checkable: 套件 exit 0（含 `diagrams.guard.test.ts` 四条腿），`pnpm run precommit` 通过后提交

#### Acceptance
`ARGV_CHANNEL.includeRecommends` 在册且 `flag === "--include-recommends"` · pi + 旗标 = 9 步、claude + 旗标 = 6 步且出 `init: no recommended packages for claude` · `--update --include-recommends` 两个 harness 各走 update 序列（pi 9 条 / claude 6 条 argv）且与同行 install argv 零交集 · 不带 `--harness` 带旗标 usage exit 2 且零 spawn · 分档汇总与预览汇总同形 · 推荐档失败两形各一条字节 pin 且行序固定（失败行 → 补行 → 既有提示）· 无旗标三面字节零变（既有 pin 不重锚）· `--dry-run --include-recommends` 零 spawn、零写入、exit 0 · `engine` citation 落在新的 init 节点块内、`revision` 钉到含两处新锚点的提交、两份 HTML 由 Archify 重生成（零手改）· engine 套件全绿。

#### DependsOn
1

### Task 3: 六份 README 九行 + guard 推荐 span 与守恒 pin

#### Objective
把推荐档写进消费面：kairos README 双语（分档 lead-in + 九行安装表 + 六条一组理由段 + `--update --include-recommends` 用法句）、根 README 双语 Installation 一句、引擎 README 双语 `init` usage 行；并让 guard 的推荐 span 与「两侧行数之和 = 表体行数」守恒 pin 同波落地。

#### Files
- Modify: `packages/kairos/README.md` · `packages/kairos/README.zh-CN.md` · `README.md` · `README.zh-CN.md` · `packages/cdd-engine/README.md` · `packages/cdd-engine/README.zh-CN.md`
- Test: `packages/cdd-engine/src-next/face/__tests__/plugins.guard.test.ts`（推荐 span + 守恒 pin + 引擎 README usage 行断言）

#### Consumes
Task 1 的 `PLUGINS` 九行与 argv · spec §6.1（六份 README 的三处内容）· §7.2（推荐 span 逐格断言与 `—` 的写法）· §7.1 的守恒 pin。

#### Produces
- 安装表九行：推荐行首列 = `name`、claude 单元格 = `—`、pi 单元格 = install argv 全角 `；` 连接。
- guard 两个新断言：推荐 span 逐格；`rows.length === core.length + recommended.length`。
- 四份 README 的 `cdd init` 命令字节断言保留，新增引擎 README 双语 usage 行含 `[--include-recommends]`。

#### Steps
- [ ] **Step 1: 先写红用例（guard）** —— 推荐 span 逐格断言 + 守恒 pin + 引擎 README usage 行断言。 — checkable: 先红（README 表仍三行、usage 行无旗标）
- [ ] **Step 2: kairos README 双语** —— lead-in 分档一句（前三行安装契约 / 后六行推荐档 / `--include-recommends` 才装）+ 表扩到九行（推荐行 claude 列 `—`）+ 表下六条一组理由段（文件搜索 / todo / 结构化提问 / 网页取用 / 后台任务 / `AGENTS.md` 注入，Claude Code 原生而 pi 需自装）+ 用法句 `--update --include-recommends`。 — checkable: 双语段结构逐段对应，guard 的 kairos 侧断言转绿
- [ ] **Step 3: 根 README 与引擎 README 双语** —— 根 Installation 一句提及旗标（不复制包清单）；引擎 CLI 表 `init` 行改 `cdd init --harness=<claude\|pi> [--update] [--include-recommends]`。 — checkable: guard 的 usage 行断言转绿
- [ ] **Step 4: 全量跑绿 + 提交** —— `pnpm -C packages/cdd-engine test` → PASS（含 guard 全绿）。 — checkable: 套件 exit 0，`pnpm run precommit` 通过后提交

#### Acceptance
kairos 双语九行表（推荐行 `—`）· 分档 lead-in 与六条一组理由段在册（英文主源 + zh 镜像同步）· `--update --include-recommends` 用法句在册 · 根双语各一句旗标 · 引擎双语 usage 行含旗标 · guard 推荐 span 逐格 + 守恒 pin 绿 · README 表少一行/多一行/空单元格非 `—` 均红。

#### DependsOn
1

### Task 4: 消费面泄漏门（可红）+ changeset + 全量验收

#### Objective
用一条**能红的**门把「skill 面不出现安装字面」变成可判事实，并收尾发行面。

#### Files
- Modify: `packages/kairos/tests/grep-sweep-regression.test.ts`（新增消费面 markdown 漏断言）· `.changeset/p23-include-recommends.md`（新）
- 无源码改动。

#### Consumes
spec §6.2（七份消费面 markdown、`-e` 形命令、`--plan` 正控）· §8.1（落点与波次）· Task 3 的 README 字面（作为「README 该有、skill 不该有」的对照）。

#### Produces
- 一条测试：对 `packages/kairos/skills/` 全树 `--include="*.md"`，命令形状固定为 `grep -rn --include="*.md" -e "<字面>" … | wc -l`；断言 `--include-recommends` 与推荐六条包名各为 0，且同一形状下 `--plan` ≥ 1（可红证明）。
- `.changeset/p23-include-recommends.md`：`cdd-engine` **minor** + `kairos` **patch**。

#### Steps
- [ ] **Step 1: 先写红用例（可红证明先行）** —— 断言 `--plan` 命中 ≥ 1（今日 13）；把旗标字面写进一个临时探针文件（或断言当前 0 命中后再反证探针可被检出），确认门能红。 — checkable: 探针存在时该腿红、移除后绿
- [ ] **Step 2: 落门** —— 七条字面（旗标 + 六条包名）走 `-e` 形断 0；`--plan` 正控断 ≥1；源码里不得出现裸内插与 `\-\-` 转义形。 — checkable: `pnpm -C packages/kairos exec vitest run tests/grep-sweep-regression.test.ts` 绿
- [ ] **Step 3: changeset** —— 写 `.changeset/p23-include-recommends.md`（`cdd-engine` minor · `kairos` patch），说明新增可选旗标与数据行、无既有字节破坏。 — checkable: `pnpm run version-sync` 不报错
- [ ] **Step 4: 全量验收 + 提交** —— `env -u AI_AGENT pnpm run validate` → ALL PASS，`pnpm run emit:check` fresh。 — checkable: validate exit 0（emit · root · kairos · engine · typecheck ×3 · version-sync · 零裸函数），然后提交

#### Acceptance
泄漏门在册且**可红**（`--plan` 正控 ≥1、七条字面 0、命令形状只许 `-e` 形）· 七份消费面 markdown（六份 `SKILL.md` + `cdd-dev/docs/base.md`）零命中 · changeset `cdd-engine` minor + `kairos` patch 在册 · `env -u AI_AGENT pnpm run validate` exit 0 · `pnpm run emit:check` fresh · `cdd` 仍八命令（结构 pin 不变）。

#### DependsOn
3

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.2 | 2026-11-04 | 评审回填（无结构变更，内容面）：① blocker 收下——架构图证据面入册：Task 1 / Task 2 的 Files 增两份 `docs/diagrams/src/architecture.{en,zh-CN}.json` 与重生成的 HTML，各自新增「证据重锚 + 重生成」步骤（`plugins.ts` 的 `upstream` citation、`cli.ts` 的 `engine` citation，各 en / zh 两处），`meta.repository.revision` 随提交重钉，Task 1 / Task 2 的收尾 step checkable 与两份 Acceptance 补 `diagrams.guard.test.ts` 四条腿全绿（结构面零改动：Task id 集与 `DependsOn` 集不动，改动落在原任务的文件与步骤内）· ② warn 收下——Task 2 Step 1 补 `--update --include-recommends` 两档成功面（pi 9 / claude 6 条 update argv，与 install 列零交集），Acceptance 同名 · ③ nit——Task 1 Step 4 由私有 `#stepsOf` 改走公开 `preview({ host, shape, recommended })` 面 · ④ nit——Task 1 Consumes 补 §8.2，Acceptance 列出五处既有字节 pin 的实测行号（`cli.test.ts:631` / `:657` / `:702` · `init.test.ts:184-186` / `:193-198` / `:269` · `preview.test.ts:408` / `:430`） | [human] · Claude（kairos:cdd-plan [P23] · 2026-11-04） |
| v0.1 | 2026-11-04 | P23 实施计划：四任务三波——**W1** `PLUGINS` 落九行 + `InitRequest` 按档过滤（无旗标字节零变）+ guard 核心 span 改吃行对象 + 名册派生基座按 core 取行；**W2（T2 ‖ T3）**——T2 = 旗标两行（`ARGV_CHANNEL` + `CLI_COMMANDS` `keys`）+ `InitStep.tier` 席位 + 输出面三句（分档汇总 / 空档 info / 分形失败补行），T3 = 六份 README 九行 + guard 推荐 span 与守恒 pin（两者只依赖 T1，文件面不重叠）；**W3**——T4 = 可红的消费面泄漏门（`-e` 形 + `--plan` 正控）+ changeset + `env -u AI_AGENT pnpm run validate` 全量验收（依赖 T3 的 README 字面） | [human] · Claude（kairos:cdd-plan [P23] · 2026-11-04） |
