---
title: 引擎文档工具（Engine Doc-Tooling）— P20 设计：`cdd init` harness bootstrap
doc-type: phase-spec
version: v0.3
date: 2026-10-26
slug: 2026-10-10-engine-doc-tooling-p20
program: 2026-10-10-engine-doc-tooling
status: Draft
author: "[human] · Claude（kairos:cdd-design [P20] grilling → cdd-spec-writer · 2026-10-26）"
parent-version: v2.79
---

## Design

### 1. 现状与缺口（取证）

#### 1.1 安装命令只活在散文里，引擎无一等安装面

kairos 与三个上游插件的安装命令只存在于四份 README 的表格与代码块中（`packages/kairos/README.md` 的 Installation / Upstream dependency install 两段 · 根 `README.md` 的安装块）。消费者要自己抄命令、自己判顺序、自己判"已装还要不要重装"。`cdd` 现有七个顶层命令（`implement` / `review` / `fix` / `base` / `schema` / `issue` / `board`）无一能装 —— 第八个正是本期新增的 `init`。

#### 1.2 三个死 / 半死声明面（前提 ④ 命中）

| 声明 | 位置 | 读者 |
|---|---|---|
| `INSTALL_ROWS` | `face/host.ts:128`（jsdoc `:122-127`） | 只有 `face/__tests__/install-rows.guard.test.ts`（唯一读者是门本身） |
| `HostRow.install` | `face/host.ts:78`（jsdoc `:76-77`） | **零生产读者**；pi 行内容只被这道门的注释引用 |
| `ProcessRunner` | `infra/process.ts` | **零生产读者**（只有 `infra/__tests__/infra.test.ts` 自己在跑它） |

`INSTALL_ROWS` 与 `HostRow.install` 是同一件事的两份形态：安装命令的声明面既没有单一主，也没有执行者。`ProcessRunner` 不属这一款 —— 它是通用**缓冲捕获**式子进程缝（`execa` 把 stdout/stderr 收进内存供调用方解析），与安装命令的声明面无关；本期删它只是清偿死码（零生产读者），不是把安装执行者退役。安装面的执行者要的是 inherit 流式透出 + 结构化 argv 的窄缝，见 §2.3 的 `ExecaStepRunner`。

#### 1.3 命令字面面无门（前提 ③ 命中）

- `CLAUDE.md:44` 手写枚举七命令 —— **零门**。
- `packages/kairos/tests/presentation-surface.test.ts:52` 的 `CDD_SUBCOMMANDS` 是硬编码数组（手抄 `CLI_COMMANDS`）。
- `packages/cdd-engine/README.md`(+zh-CN) 的 CLI 表与 kairos README 的 surface 句都靠这份手抄数组钉。

第七→第八个命令正是这套结构拦不住的一次人肉同步。

#### 1.4 外部事实取证（实测，非推测）

| 事实 | 取证 |
|---|---|
| `claude plugin marketplace add <已存在>` 幂等 | 实测 exit 0 + `Marketplace 'mattpocock' already on disk` |
| `claude plugin install <已装>` 幂等 | 实测 exit 0 + `Plugin "kairos@oscaner-skills" is already installed` |
| `claude plugin install/update` 在非 TTY 下需 `-y` | `claude plugin install --help`（`required when stdin or stdout is not a TTY`） |
| `pi update` 无参 = 更新 pi 自身 | `pi update --help`（`Update pi only (default when no target is given)`） |
| `pi update <source>` 单包更新 | `pi update --help`（`pi update <source>  Update one package`） |
| repo 面命令统一过 `#rootOf()`，git root 推不出即退 1 | `face/cli.ts:1049` 的 `#rootOf`；不过该门的只有 `issue render`（`face/cli.ts:352`）与 `schema get` 的 json 面 —— `schema get --output skeleton <target>`（`face/cli.ts:1086`）仍调 `#rootOf()`，非 git 目录下退 1 |

### 2. 定案：`cdd init`（Q1 · Q2 · Q3 · Q5 · Q6 · Q7 · Q8）

#### 2.1 命令面

| 面 | 定案 |
|---|---|
| 动词 | `init` —— 第八个顶层命令 |
| 旗标 | `--harness=<claude\|pi>` 必填 · `--update` 布尔 |
| 值域 | `host.ts` 新增运行时伴生 `HOST_IDS`（`HostId` 由 `(typeof HOST_IDS)[number]` 派生 · `HOSTS` 以 `satisfies Record<HostId, HostRow>` 锁键集）——`ARGV_CHANNEL.harness.values` 直接读 `HOST_IDS`，harness 词表在**生产面**全局唯一，零手抄 |
| host 遍历 | `HostDetect.detect` 的遍历同改读 `HOST_IDS`（`for (const id of HOST_IDS)`）——生产面不再留 `["claude", "pi"]` 字面副本；`face/__tests__` 内的同类字面是测试夹具，不入「词表副本」账（本期保留） |
| 位置参数 | 不设（与既有命令族一致，`cdd init claude` 是 usage 错 → exit 2） |
| 声明落点 | `face/declare.ts`：`ARGV_CHANNEL` 增 `harness` / `update` 两行，`CLI_COMMANDS` 增 `init` 行（`keys: [{key:"harness", required:true}, {key:"update"}]`） |

#### 2.2 语义

- **无 `--update`**：执行该 harness 的**安装序列**（`claude plugin marketplace add` → `claude plugin install`；pi 单条 `pi install`）。
- **有 `--update`**：执行该 harness 的**更新序列**（`claude plugin marketplace update` → `claude plugin update`；pi 单条 `pi update <source>`）。
- **`--update` 只更新，不隐式安装**：目标包未装时该步非零退出 → 整体退 1；stderr 在 §2.3 的固定失败报文之后追加第 2 行 `if the package is not installed, run cdd init --harness=<id> without --update first`（`<id>` = 本次调用的 harness id；无 `--update` 时零提示行）。该行是**条件式**措辞：引擎零解析 harness 输出，无从判定失败是否源于「未安装」——网络失败、权限失败、marketplace 缺失同样会走到这一行，不得把不可知原因说成已知。
- **幂等交给 harness 自己**：引擎零预检、零跳过逻辑（实测 add/install 幂等退 0）。引擎不解析 harness 输出。

#### 2.3 执行面

```
StepRunner (interface)          — run(argv: readonly string[]): Promise<number>
  └─ ExecaStepRunner (class)    — execa(stdout/stderr: inherit) · fail-open 返回退出码
CliInit (class)                 — 面类，持 PLUGINS 行 + 注入的 StepRunner + io
```

- `ExecaStepRunner` **不复用** `ProcessRunner`：后者是缓冲捕获面（stdout/stderr 收进内存供调用方解析），安装面要的是 inherit 流式透出（消费者实时看到 harness 输出）+ 结构化 argv 透传；两者形态不同，故新立窄缝而非改造旧缝。
- **串行**执行该序列；**遇首个非零退出立即停**，后续步骤不跑。
- 整体退出码：全绿 `0` · 任一步失败 `1` · 用法错 `2`（commander 原生，无自研校验）。
- 失败报文（stderr）第 1 行固定三段：`init[<i>/<n>] · <argv join(" ")> · exit <code>`，不重排、不吞子进程输出；`<i>/<n>` 与 §2.5 的 step 头**同一口径**（全局步序号 / 全局步总数）。**仅 `--update` 形态**追加第 2 行 `if the package is not installed, run cdd init --harness=<id> without --update first`。
- **缺 harness 二进制**不走专门探测：spawn 失败即该步非零退出，走同一失败面（报错里带 harness CLI 名，消费者能判「没装 claude/pi」）。
- **零 shell 拼接**：argv tuple 直接交 `execa`（`sh -c` 零出现）。
- **不共享 `Terminator` 的执行机器**：dispatch 的超时/预算/组杀/心跳/stall 判官不进安装面（前提 ⑥）。

#### 2.4 仓库独立性

- `init` **不过 `#rootOf()`**（沿用 `issue render` 的 repo 无关形态）：非 git 目录、任意 cwd 均可跑 —— 它是第一个**完全** repo 无关的动词（`schema get --output skeleton <target>` 仍过 `#rootOf()`，只有无 target 的 `schema get` 不过）。
- 零 workspace 写入 · 不建 `.kairos/` · 不占轮次 · 不写 ledger · 不读任何文档。

#### 2.5 输出面

```
init[1/6] claude · superpowers · install
<子进程输出原样透出>
init[2/6] claude · superpowers · install
init[3/6] claude · mattpocock-skills · install
…
init: 6 steps ok (claude · install)
```

- **计数口径（唯一）**：step 头与失败报文一律用**全局步序号 / 全局步总数** —— 分母是该 harness 序列的总步数，不按包重置：claude 为 `/6`（3 包 × 2 条命令），pi 为 `/3`（3 包 × 1 条命令）；`install` 与 `update` 两形态同分母（步序与条数一致，只有动词与 `<install|update>` 标记变）。
- step 头先于子进程输出（消费者知道当前进行到哪一步）；全绿时一行汇总 `<n> steps ok (<harness> · <install|update>)`。
- `--update` 形态样例：头 `init[1/6] claude · superpowers · update`，小结行 `init: 6 steps ok (claude · update)`（pi 面 `init: 3 steps ok (pi · update)`）。

#### 2.6 非目标

- 不加 `--dry-run`（测试用注入 `StepRunner` 覆盖；用户预览面 = README 表）。
- 不加 `--yes` / 不透传 `-y`（行就是人类手敲的字面；非 TTY 场景该步退 1 并原样透出 harness 报文 —— 后续如需再加）。
- 不动 `schema` / `issue` / `board` / `implement` / `review` / `fix` / `base` 的任何行为面与退出码。
- 不引入新运行时依赖（`commander` / `execa` 已在 `package.json#dependencies`）。
- 不改 dispatch / 模板 / 文档契约 / ledger 面。

### 3. 定案：命令数据面归一（Q1 · Q2 · Q4）

#### 3.1 新模块 `face/plugins.ts` —— 包为轴的单一表

```ts
/** 一条安装命令 —— 结构化 argv，零 shell 字符串。 */
export type Command = readonly string[];

/** 一个包在一个 harness 上的两形态命令。 */
export interface PluginCommands {
  readonly install: readonly Command[];
  readonly update: readonly Command[];
}

/** 一行插件 —— 列集合由 `HostId` 派生（列 = `HostId` 全集）：少一个 host 是类型错，
 *  新增第三个 host 而不补列同是类型错 —— host 词表不在本模块留第二份副本。 */
export type PluginRow = { readonly name: string } & Readonly<Record<HostId, PluginCommands>>;

/** 插件名册 —— 数组而非对象：**行序即执行序、即 README 行序**（顺序是一等事实，
 *  不依赖对象键序）。依赖先行（上游先于 kairos）是此序的判据。 */
export const PLUGINS: readonly PluginRow[] = [superpowers, "mattpocock-skills", kairos];
```

`HostId` / `HOST_IDS` / `HOSTS` 自 `face/host.ts` 导入（§2.1 的单一源）；本模块不另立 host 字面。

行内容（install / update 两形态，逐条 argv）：

| 包 | claude install | claude update | pi install | pi update |
|---|---|---|---|---|
| superpowers | `claude plugin marketplace add obra/superpowers-marketplace` · `claude plugin install superpowers@superpowers-marketplace` | `claude plugin marketplace update superpowers-marketplace` · `claude plugin update superpowers@superpowers-marketplace` | `pi install git:github.com/obra/superpowers` | `pi update git:github.com/obra/superpowers` |
| mattpocock-skills | `claude plugin marketplace add mattpocock/skills` · `claude plugin install mattpocock-skills@mattpocock` | `claude plugin marketplace update mattpocock` · `claude plugin update mattpocock-skills@mattpocock` | `pi install git:github.com/mattpocock/skills` | `pi update git:github.com/mattpocock/skills` |
| kairos | `claude plugin marketplace add oscaner/skills` · `claude plugin install kairos@oscaner-skills` | `claude plugin marketplace update oscaner-skills` · `claude plugin update kairos@oscaner-skills` | `pi install npm:@oscaner-skills/kairos` | `pi update npm:@oscaner-skills/kairos` |

`kairos` 行位最后（上游先行）——与今日 README 表序相反，是 deliberate；README 与执行共用这一个序。

#### 3.2 三退（前提 ① ④）

| 退役面 | 动作 |
|---|---|
| `INSTALL_ROWS`（`face/host.ts`） | 删除；内容迁入 `PLUGINS` |
| `HostRow.install` 字段 + pi 散装行（`face/host.ts`） | 删除（零生产读者） |
| `infra/process.ts` 整文件（`ProcessRunner`）+ `infra/__tests__/infra.test.ts` 中其用例 | 删除（零生产读者 · 通用缓冲式子进程缝的纯死码清偿，不是安装执行者退役 —— 安装执行面见 §2.3 的 `ExecaStepRunner`） |

#### 3.3 README 面：一条命令 + 一张表（Q4 追加：再精简）

`packages/kairos/README.md`(+zh-CN) 的安装面**就地重排**为「一条命令 + 一句 `--update` + 一张表」，段落点与 zh 映射钉死：

| EN | zh-CN | 处置 |
|---|---|---|
| `## Installation`（`:35`） | `## 安装`（`:37`） | 就地扩容为「一条命令 + 一句 `--update` + 一张表」 |
| `### From pi`（`:44`） | `### 从 pi 安装`（`:46`） | 删除（pi 安装命令已进 `PLUGINS` 表） |
| `### Upstream dependency install`（`:80`） | `### 上游依赖安装`（`:82`） | 删除，内容并入安装段的表 |
| `## Co-existing with upstream plugins`（`:76`） | `## 与上游插件共存`（`:78`） | 保留为**纯散文**（`cdd-*` 唯一性与 harness 条件化 inline 引用的共存论证），零安装内容 |

安装段的内容与形状（下游作者无需再设计结构）：

1. **一条命令（零前置可执行）**：`npx -y @oscaner-skills/cdd-engine@latest init --harness=<claude|pi>` —— 与 kairos 技能同款的按需取引擎形态（新消费者手上没有 `cdd`，首条命令不得依赖全局安装）；紧跟一句「已全局安装 `cdd` 时可省 `npx -y @oscaner-skills/cdd-engine@latest` 前缀」。说明它按序装 kairos + 三个上游包。
2. **一句 `--update`**：同命令加 `--update` 即刷新已装包（更新序列**不进** README 表，argv 由引擎单测钉死，见 §3.4）。
3. **一张参考表**（由 `PLUGINS` 渲染，供免引擎 / 手工安装时照抄），形状定形如下：列 = `Package | Claude Code | Pi`（两 host 两列，**不单列 update**）· **列位序** = `HOST_IDS` 序（`claude` 列在前、`pi` 列在后；手抄的只有两个显示标签，它们就此钉死，禁自造 `{claude: "Claude Code"}` 标签映射）· 行 = `PLUGINS.map((row) => row.name)`，**行序即表序**（`kairos` 居末）· 单元格 = 该 host 的 `install` argv 逐条 `join(" ")` 后以 `；` 连接：

| Package | Claude Code | Pi |
|---------|-------------|-----|
| superpowers | `claude plugin marketplace add obra/superpowers-marketplace；claude plugin install superpowers@superpowers-marketplace` | `pi install git:github.com/obra/superpowers` |
| mattpocock-skills | `claude plugin marketplace add mattpocock/skills；claude plugin install mattpocock-skills@mattpocock` | `pi install git:github.com/mattpocock/skills` |
| kairos | `claude plugin marketplace add oscaner/skills；claude plugin install kairos@oscaner-skills` | `pi install npm:@oscaner-skills/kairos` |

4. 删除与 `packages/cdd-engine/README.md` 重复的安装散文（`pi` 项目设置说明等 —— 引擎 README 已有安装面）。
5. `## Quick start` 第 1 步（`packages/kairos/README.md:54` / `README.zh-CN.md:56`：从 marketplace 装 superpowers / kairos / mattpocock-skills）改写为本段的那条命令（或整步删除，把「装什么」留在安装段一处）—— 该句与安装段重复同一事实，重排后还会指向已删除的逐 harness 手工安装；双语同步。

根 `README.md`(+zh-CN)：`## Installation`（en `:47` / zh `:51`）**就地收敛**为一条命令 `npx -y @oscaner-skills/cdd-engine@latest init --harness=<claude|pi>`（同「已装 `cdd` 可省前缀」句）+ 一句「手动 / 逐 harness 安装见 `packages/kairos/README.md` 的表」；删该段的逐 harness 命令块（`claude plugin marketplace add oscaner/skills` / `claude plugin install kairos@oscaner-skills` / `pi install npm:@oscaner-skills/kairos`）与「Upstream plugins install from their own publishers」散文 —— 否则根 README 仍教一套只装 kairos 的手工流程，与新安装段「一条命令装 kairos + 三个上游包」并存，违反「同一事实只写一次」。Quick start 第 1 步同指这条命令（同「已装 `cdd` 可省前缀」句）；Plugins 上游表保留（那是仓库生态说明，不是 cdd 依赖面），但其 impeccable 行随本 phase 退役。**impeccable 退役扩到消费面全集**：kairos 安装表行 + `README.md:43` / `README.zh-CN.md:47` 的 Upstream impeccable 行 + `CLAUDE.md:9` 上游枚举里的 impeccable 一并删除（"（superpowers / mattpocock-skills / impeccable）" 句随 kairos 表退役）；历史 spec / plan 不改。

#### 3.4 门：`plugins.guard.test.ts`（替换 `install-rows.guard.test.ts`）

按 `PLUGINS` 渲染 §3.3 的**同一张表**（install 形态），与 `packages/kairos/README.md`(+zh-CN) 逐格比对：

- 行键集 == `PLUGINS.map((row) => row.name)`（**含顺序**）；
- 列**位序** == `HOST_IDS` 序（`claude` / `pi` 两列，按列位比对；零手抄的是列序，不映射显示标签 —— `HOST_IDS` 的值 `claude` / `pi` 推不出 `Claude Code` / `Pi`，自造标签映射正是本 phase 要消灭的第二份 host 词表）；表头两标签由本 spec 显式钉死为 `Claude Code` / `Pi`；
- 单元格 == 该行该 host 的 `install` argv 逐条 `join(" ")` 后以 `；` 连接；
- 覆盖 = 同一张表 × 两 host × 两 README = **四组合**逐格比对。

`update` 形态**不入 README 表**（README 只留 §3.3 第 2 条那一句提示）：其 argv 由 `CliInit` 的引擎单元测试钉死（替身 `StepRunner` 断言 update 序列、install 命令零出现），README 面不存 update 的第二份真源。

### 4. 定案：消费面同步与命令字面面的门（Q5）

#### 4.1 单源派生

`packages/kairos/tests/presentation-surface.test.ts` 的 `CDD_SUBCOMMANDS` 改为**派生**：`CLI_COMMANDS.map((c) => c.name)`（引擎声明是唯一源，手抄数组消失）。

#### 4.2 三处门 + 结构 pin 重锚

| 门 | 断言 |
|---|---|
| `cdd-engine` README CLI 表 | 表行集 == 派生集（含 `init` 行） |
| kairos README surface 句 | 含派生集 `join(" / ")` |
| `CLAUDE.md:44` 引擎行 | 命令枚举**序列相等**于派生集（`join(" / ")` 字符串相等，非集合相等）——**今日无门 → 新增**；`CLAUDE.md:44` 的枚举序随 `CLI_COMMANDS` 重排为 implement / review / fix / base / schema / issue / board / init，改的是文档序，不是声明序 |

结论判据：加第九个命令而不改文档 ⇒ 测试红。

**门的归属**：三门同栖 `packages/kairos/tests/presentation-surface.test.ts` —— 该文件已在读 `CLAUDE.md`（`:137-145` 只钉定位句与单源措辞），`CLAUDE.md` 新门就地替换 / 扩展那一条用例（同一读文件、同一断言文件），不新开第二处 `CLAUDE.md` 读取面；另两门沿用文件内既有面（`:281-285` 引擎 README CLI 表 · `:366-369` kairos README surface 句）。

**第八命令的结构 pin 重锚**（既有精确列表断言随 `init` 升级，缺一处即红）：

| 面 | 位置 | 动作 |
|---|---|---|
| `CliVerb` 联合 | `face/declare.ts:150` | 七值 → 八值，增 `init` |
| 命令面精确列表 | `face/__tests__/cli.test.ts:501-510` | `CLI_COMMANDS.map((c) => c.name)` 的 `toEqual` 由七项改八项（`init` 居末） |
| 投影面精确列表 | `face/__tests__/projection.test.ts:55-65` | `program.commands.map((c) => c.name())` 的 `toEqual` 由七项改八项（同序） |
| help 表行数断言 | `face/__tests__/cli.test.ts:935` / `:1123` | 七命令表 → 八命令表（名字集含 `init`） |
| 逐命令 help legend 面 | `face/__tests__/cli.test.ts:1102` / `:1109` | 循环名集加 `init`（七值 → 八值）· `expect(io.stdoutText.match(legend) ?? []).toHaveLength(7)` → `8` —— legend 由 `projection.ts:78-80` 的 `addHelpText("afterAll", …)` 挂在**每个**命令的 help 上，`init` 一进命令树即变 8，两处必须同步改 |
| `seven` 注释 | 生产面 `face/cli.ts:5,11` · `face/projection.ts:3,6` · `face/declare.ts:2,148,191`（七处）· 测试面 `face/__tests__/cli.test.ts:3,500,501,935,1123,1134` · `face/__tests__/projection.test.ts:55`（七处） | 十四处全改 `eight` 或去数字（叙述改「the declared command rows」）—— 测试面漏改会留下「描述说七、断言八」的注释 |

#### 4.3 文档同步面

`CLAUDE.md`（七 → 八命令：`:44` 枚举序按 `CLI_COMMANDS` 重排 · `:9` 上游枚举删 impeccable）· `packages/cdd-engine/README.md`(+zh-CN)（CLI 表加 `init` 行 + 全局 option 段不动）· `packages/kairos/README.md`(+zh-CN)（§3.3）· 根 `README.md`(+zh-CN)（`## Installation` 收敛 + Quick start 第 1 步 + Upstream impeccable 行）。

**架构图随命令枚举同步（两源两值，各自钉死）**：

- **tag**：`architecture.en.json:99` 的 `engine` 节点 `"tag": "7 commands"` → `"8 commands"`；`architecture.zh-CN.json:99` 同节点 `"tag": "7 条命令"` → `"8 条命令"`（zh 源逐字携带 `7 条命令`，生成物 `architecture.zh-CN.html:5407/5408/5416` 随重生成更新）。
- **detail 句**：`architecture.en.json:251` 的 `Execution` 条 `The engine runs seven commands: …` 补 `init`（八条）；`architecture.zh-CN.json:251` 的「引擎提供七条命令：…」同改八条并补 `init`。
- **evidence 重锚**（§3.2 三退掏空了三处 citation —— 只改 tag / detail 会让图静默指向别的代码）：`architecture.{en,zh-CN}.json:64` 的 `upstream` 节点现指 `face/host.ts:125-142`，正是被删的 `INSTALL_ROWS` 块 → 改指 `face/plugins.ts` 的 `PLUGINS` 行块（删除来源即迁移来源）；`:82` 的 `host` 节点现指 `host.ts:144-186`（`HOSTS` 行，其 `install` 列本 phase 删）→ 改指 `HOSTS` 的保留段；`:102` 的 `engine` 节点现指 `face/cli.ts:327-357`（`.action` 薄壳区，§5 在此插入 `init` 壳）→ 改指 `init` 薄壳段。Archify 的 `--repo-root` 只校验 path / line 范围**存在**（range 不存在才降级为 plain reference）：旧范围在删除后仍存在 → citation 会静默指错，故必须显式重锚。
- **生成**：按 `docs/diagrams/README.md` 用 Archify CLI 重生成 `architecture.{en,zh-CN}.html`，并带 `--repo-root .` 跑 `finalize` 让 citation 校验通过 —— 生成物禁手改，改源 JSON 再重生成。

### 5. 五平面影响

| 平面 | 改动 |
|---|---|
| contract | 零动（无新 doc 类型 / 元素 / 词汇） |
| session | 零动（无 ledger / round / next 面变化） |
| face | `declare.ts`（+`harness` / `update` channel 行 · +`init` 命令行 · `CliVerb` += `init`）· `init.ts`（新 · `CliInit` + `StepRunner` / `ExecaStepRunner`）· `plugins.ts`（新 · `PLUGINS`）· `host.ts`（−`INSTALL_ROWS` · −`HostRow.install` · +`HOST_IDS` · `HostDetect.detect` 遍历改读 `HOST_IDS`）· `cli.ts`（`.action` 薄壳 + `CliInit` 装配；`init` 分支不过 `#rootOf()`） |
| infra | −`process.ts`（`ProcessRunner` 整文件） |
| render | 零动（README 渲染在 repo 文档面，不在引擎内） |

### Acceptance criteria

- `cdd init --harness=claude` 逐条执行 install 序列（替身 `StepRunner` 记录 argv，断言顺序与条数 = `PLUGINS[].claude.install` 展平）· `--harness=pi` 同。
- `--update` 只走 update 序列（替身断言 install 命令零出现）；`--update` 失败面 = 两行（第 1 行三段报文 `init[<i>/<n>] · <argv> · exit <code>` + 第 2 行 `if the package is not installed, run cdd init --harness=<id> without --update first`），无 `--update` 时零提示行；计数为 §2.5 的全局口径（claude `/6`、pi `/3`，`--update` 同分母）。
- 非法 `--harness` / 缺 `--harness` → exit 2（commander 原生报文）。
- 某步非零 → 后续步骤零执行 · 整体 exit 1 · stderr 含 `init[<i>/<n>]` 与 argv 与退出码；缺 harness 二进制走同一失败面（替身返回非零即可覆盖）。
- 非 git 目录内可跑（`chdir` 到临时非仓库目录，序列照跑，零 BLOCKED）。
- 零 shell 拼接：`grep` 断言 `sh -c` 零命中；argv tuple 直接进 `StepRunner`。
- `grep` 零残留：`INSTALL_ROWS` / `HostRow.install` / `ProcessRunner` 在生产面与测试面全零。
- `PLUGINS` 行类型 = `{ readonly name: string } & Readonly<Record<HostId, PluginCommands>>`，列集合随 `HostId` 自动闭合（类型级断言：删一列、新增 host 不补列均报错）；`HOST_IDS` 是 `HostId` / `HOSTS` 键集 / `--harness` 值域三者的唯一源（少一项是类型错）。
- 生产面 host 字面无第二份副本：`grep -nE '\["claude", "pi"\]' packages/cdd-engine/src-next/` 零命中（`HostDetect.detect` 遍历 `HOST_IDS`）；`face/__tests__` 内的 8 处同类字面为测试夹具，不计入（缺这条时，`--harness` 值域会随 `HOST_IDS` 自动接受新 host，而 detect 的遍历不跟随 —— 类型也拦不住的静默漏判）。
- `plugins.guard.test.ts` 四组合全绿（同一张表 × claude/pi 两 host × README 双语，install 形态）；`update` argv 由 `CliInit` 单测钉死（README 面零 update 副本）；`install-rows.guard.test.ts` 已删。
- `CDD_SUBCOMMANDS` 派生自 `CLI_COMMANDS`；`CLAUDE.md` / `cdd-engine` README CLI 表 / kairos README surface 句三门全绿（`CLAUDE.md` 门为**序列相等**，枚举序已按 `CLI_COMMANDS` 重排）。
- 结构 pin 重锚全绿：`CliVerb` 含 `init` · `cli.test.ts` / `projection.test.ts` 两处精确列表为八项（`init` 居末）· `cli.test.ts:935/1123` help 表随行 · `cli.test.ts:1102/1109` 逐命令 help legend 循环含 `init` 且 `toHaveLength(8)` · `grep -n seven` 零命中（生产面 7 处 + 测试面 7 处；若刻意保留测试面任何一处字样，须同段留 `eight` 断言并注明理由）。
- kairos README 安装段就地重排为「一条命令 + 一张表」（旧 `### From pi` / `### Upstream dependency install`、上游安装散文、Quick start 第 1 步旧安装句零残留）· 表头 = `Package | Claude Code | Pi`（列位序 == `HOST_IDS` 序）· Quick start 第 1 步与安装段同一条命令（或该步已删）。
- **安装命令可执行性（本期判据）**：本地源形态 `node packages/cdd-engine/src-next/bin.ts init --harness=<claude|pi>` 在**零全局 `cdd`** 的临时**非 git** 目录内跑通（与 §2.4 的 repo 无关面同一用例）；两份 README 安装段的命令字节 == `npx -y @oscaner-skills/cdd-engine@latest init --harness=<claude|pi>`（门按字节 pin，`<claude|pi>` 两值各一条）。
- **发布后置（不入本期验收面）**：published `@latest` 形态的 `init` 可执行性登记进 changeset 说明 —— 发布前 `@latest` 尚无 `init`，照字面执行会 `unknown command 'init'` 退 2，属预期而非本期缺口。
- 根 README `## Installation` 收敛为同一条命令 + 一句「手动安装见 `packages/kairos/README.md` 的表」；双语 `claude plugin marketplace add` / `claude plugin install` / `pi install` 字面零残留（根 README 不再教只装 kairos 的手工流程）。
- impeccable 在 kairos 安装表、根 `README.md`(+zh-CN) Upstream 表与 `CLAUDE.md:9` 全零残留。
- 架构图同步：`grep -nE '7[[:space:]]*(commands|条命令)|七条命令' docs/diagrams/src/architecture.{en,zh-CN}.json` 零命中（覆盖 `7 commands` / `7 条命令` / `七条命令` 三种拼写）；两源两值各自钉死 —— en `tag` == `8 commands`、zh `tag` == `8 条命令`，两 detail 句枚举均含 `init`；三处 evidence citation 已重锚（`PLUGINS` 行块 / `HOSTS` 保留段 / `cli.ts` init 薄壳段）且 Archify `finalize --repo-root .` 的 citation 校验通过；`architecture.{en,zh-CN}.html` 由 Archify CLI 重生成（生成物零手改）。
- engine vitest 全绿 · typecheck ×3 · `pnpm run validate` ALL PASS · 零裸函数门绿。
- changeset：`cdd-engine` **minor**（新命令）· `kairos` **patch**（README 文本）。

## Constraints

- **零新增运行时依赖**：`commander`（解析 + enum 校验）· `execa`（流式 spawn）均已在册；不为 init 引入 step-UI / CLI-table 类库。
- **零裸函数**：新增面全为类 / 类型 / 常量数据（`CliInit` · `ExecaStepRunner` · `PLUGINS`），与仓库既有纪律一致。
- **安装数据单源**：命令只活在 `PLUGINS`；README 是渲染面 + 门，引擎不读 README，README 不另存真源。
- **不碰 dispatch 执行机器**：`Terminator` / 预算 / 组杀 / 心跳零改；init 的执行面是独立的窄缝。
- **不碰文档契约与流水线**：`init` 不进 `next:` / `PIPELINE_NEXT` / `REFS`（bootstrap 不是 CDD 流程节点）。
- **README 精简原则**：同一事实只写一次；引擎面的安装说明归 `packages/cdd-engine/README.md`，插件名册归 kairos README 的表。
- **消费面语言纪律**：README 英主源 + zh 镜像同步（三份 README 家族）；内部 docs 中文。
- 变更先回填 P20 注册行（overall v2.79 已在册），spec 落地后按 CDD 纪律提交。

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-10-26 | P20 设计定稿：`cdd init --harness=<claude\|pi> [--update]` 第八命令（真 spawn · 串行 · 首败即停 · repo 独立）· 数据面归一 `face/plugins.ts` 的 `PLUGINS`（包为轴 · 行序即执行序 · install/update 两形态 argv tuple）· 三退（`INSTALL_ROWS` / `HostRow.install` / `ProcessRunner`）· README 安装段合并精简 + `plugins.guard` 四组合 · 命令字面面升为 `CLI_COMMANDS` 单源派生 + 三门（含 CLAUDE.md 新门）· changeset cdd-engine minor / kairos patch | [human] · Claude（kairos:cdd-design [P20] grilling → cdd-spec-writer · 2026-10-26） |
| v0.2 | 2026-10-26 | **spec-fix-1（review-1 findings 收口 · 1 blocker + 6 warn + 5 nit）**：① blocker——架构图纳入同步面（`architecture.{en,zh-CN}.json` 的 `7 commands` → `8 commands` + 枚举补 `init`，Archify CLI 重生成 HTML），§4.3 删除「零动」裁定，AC 增图面断言；② warn——§4.2 增「结构 pin 重锚」表（`CliVerb` += `init` · `cli.test.ts:501-510` / `projection.test.ts:55-65` 精确列表七→八 · `cli.test.ts:935/1123` help 表 · 七处 `seven` 注释）；③ warn——§3.3 参考表定形（列 `Package \| Claude Code \| Pi` · 行序 = `PLUGINS` 序 · 格 = install argv `join(" ")` 后 `；` 连接），§3.4 改为同一张表 × 两 host × 两 README 四组合，update argv 归单测；④ warn——§3.3 钉死 EN/zh 段落点与映射（`## Installation` / `## 安装` 就地扩容，删 `### From pi` / `### 从 pi 安装` 与 `### Upstream dependency install` / `### 上游依赖安装`，`## Co-existing with upstream plugins` / `## 与上游插件共存` 保留纯散文）；⑤ warn——impeccable 退役扩到消费面全集（根 `README.md:43` / `README.zh-CN.md:47` 行 + `CLAUDE.md:9` 枚举）；⑥ warn——`PluginRow` 改派生式 `{ name } & Readonly<Record<HostId, PluginCommands>>`；⑦ warn——安装段首条命令改零前置形态 `npx -y …@latest init`（跟「已装 `cdd` 可省前缀」句）；⑧ nit——失败面定形（第 1 行三段 + 仅 `--update` 追加提示行）；⑨ nit——`CLAUDE.md:44` 门判据定为**序列相等**并重排枚举序；⑩ nit——§1.1 改「现有七个顶层命令…第八个即本期 `init`」；⑪ nit——行号 pin 修正（`HostRow.install` → `host.ts:78` · `INSTALL_ROWS` → `host.ts:128`）；⑫ nit——§1.4 repo 无关先例窄化（只 `issue render` 与 `schema get` json 面），§2.4 改「沿用 `issue render` 形态」 | Claude（kairos:cdd-dev [P20] docs-fix round 1 · 2026-10-26） |
| v0.3 | 2026-10-26 | **spec-fix-2（review-2 findings 收口 · 1 blocker + 6 warn + 5 nit + 5 裁定）**：① blocker——zh 图源 `architecture.zh-CN.json:99` 的 `7 条命令` 入同步面（→ `8 条命令`），AC 残留判据改覆盖 `7 commands` / `7 条命令` / `七条命令` 三拼写，两源两值各自钉死；② warn——§4.3 增 evidence 重锚（`upstream` → `PLUGINS` · `host` → `HOSTS` 保留段 · `engine` → `cli.ts` init 薄壳段）+ Archify `finalize --repo-root .`；③ warn/裁定 R1——`HostDetect.detect` 遍历改读 `HOST_IDS`，生产面 `["claude", "pi"]` 字面零命中入 AC（测试面夹具保留并注明）；④ warn——根 README `## Installation` 就地收敛（删逐 harness 命令块与上游散文），AC 增双语字面零残留；⑤ warn——结构 pin 表补逐命令 help legend 面（`cli.test.ts:1102/1109`），`seven` 面扩为生产 7 + 测试 7，AC grep 去限定；⑥ warn/裁定 R2——README 表按**列位**比对（列序 == `HOST_IDS` 序），表头显示名在 spec 钉死，禁标签映射；⑦ warn/裁定 R3——安装可执行性 AC 拆两判据（本地源形态可验 + published `@latest` 发布后置登记 changeset）；⑧ nit/裁定 R4——计数口径统一为全局步序号/总数（claude `/6` · pi `/3`），补 `--update` 样例行；⑨ nit/裁定 R5——`--update` 提示行改条件式措辞（引擎零解析 harness 输出）；⑩ nit——§4.2 注明三门同栖 `presentation-surface.test.ts` 并替换/扩展 `:137-145`；⑪ nit——kairos README Quick start 第 1 步改为同一条命令（或删除）；⑫ nit——`ProcessRunner` 从「三份形态」移出单列为死码清偿，§2.3 补 `ExecaStepRunner` 选型理由 | Claude（kairos:cdd-dev [P20] docs-fix round 2 · 2026-10-26） |
