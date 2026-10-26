---
title: 引擎文档工具（Engine Doc-Tooling）— P20 设计：`cdd init` harness bootstrap
doc-type: phase-spec
version: v0.1
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

kairos 与三个上游插件的安装命令只存在于四份 README 的表格与代码块中（`packages/kairos/README.md` 的 Installation / Upstream dependency install 两段 · 根 `README.md` 的安装块）。消费者要自己抄命令、自己判顺序、自己判"已装还要不要重装"。`cdd` 八面无一能装。

#### 1.2 三个死 / 半死声明面（前提 ④ 命中）

| 声明 | 位置 | 读者 |
|---|---|---|
| `INSTALL_ROWS` | `face/host.ts:122` | 只有 `face/__tests__/install-rows.guard.test.ts`（唯一读者是门本身） |
| `HostRow.install` | `face/host.ts:84` | **零生产读者**；pi 行内容只被这道门的注释引用 |
| `ProcessRunner` | `infra/process.ts` | **零生产读者**（只有 `infra/__tests__/infra.test.ts` 自己在跑它） |

三者叠起来是同一件事的三份形态：安装命令的声明面既没有单一主，也没有执行者。

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
| repo 面命令统一过 `#rootOf()`，git root 推不出即退 1 | `face/cli.ts:1049`（`#rootOf`）；`schema` / `issue` 走 `CliArtifacts` 不过该门（repo 无关命令的既定形态） |

### 2. 定案：`cdd init`（Q1 · Q2 · Q3 · Q5 · Q6 · Q7 · Q8）

#### 2.1 命令面

| 面 | 定案 |
|---|---|
| 动词 | `init` —— 第八个顶层命令 |
| 旗标 | `--harness=<claude\|pi>` 必填 · `--update` 布尔 |
| 值域 | `host.ts` 新增运行时伴生 `HOST_IDS`（`HostId` 由 `(typeof HOST_IDS)[number]` 派生 · `HOSTS` 以 `satisfies Record<HostId, HostRow>` 锁键集）——`ARGV_CHANNEL.harness.values` 直接读 `HOST_IDS`，harness 词表全局唯一，零手抄 |
| 位置参数 | 不设（与既有命令族一致，`cdd init claude` 是 usage 错 → exit 2） |
| 声明落点 | `face/declare.ts`：`ARGV_CHANNEL` 增 `harness` / `update` 两行，`CLI_COMMANDS` 增 `init` 行（`keys: [{key:"harness", required:true}, {key:"update"}]`） |

#### 2.2 语义

- **无 `--update`**：执行该 harness 的**安装序列**（`claude plugin marketplace add` → `claude plugin install`；pi 单条 `pi install`）。
- **有 `--update`**：执行该 harness 的**更新序列**（`claude plugin marketplace update` → `claude plugin update`；pi 单条 `pi update <source>`）。
- **`--update` 只更新，不隐式安装**：目标包未装时该步非零退出 → 整体退 1，stderr 提示"先跑不带 `--update` 的 init"。
- **幂等交给 harness 自己**：引擎零预检、零跳过逻辑（实测 add/install 幂等退 0）。引擎不解析 harness 输出。

#### 2.3 执行面

```
StepRunner (interface)          — run(argv: readonly string[]): Promise<number>
  └─ ExecaStepRunner (class)    — execa(stdout/stderr: inherit) · fail-open 返回退出码
CliInit (class)                 — 面类，持 PLUGINS 行 + 注入的 StepRunner + io
```

- **串行**执行该序列；**遇首个非零退出立即停**，后续步骤不跑。
- 整体退出码：全绿 `0` · 任一步失败 `1` · 用法错 `2`（commander 原生，无自研校验）。
- 失败报文（stderr）：`<step i/n> · <argv join(" ")> · exit <code>`，不重排、不吞子进程输出。
- **缺 harness 二进制**不走专门探测：spawn 失败即该步非零退出，走同一失败面（报错里带 harness CLI 名，消费者能判「没装 claude/pi」）。
- **零 shell 拼接**：argv tuple 直接交 `execa`（`sh -c` 零出现）。
- **不共享 `Terminator` 的执行机器**：dispatch 的超时/预算/组杀/心跳/stall 判官不进安装面（前提 ⑥）。

#### 2.4 仓库独立性

- `init` **不过 `#rootOf()`**（沿用 `schema` / `issue` 的 repo 无关形态）：非 git 目录、任意 cwd 均可跑。
- 零 workspace 写入 · 不建 `.kairos/` · 不占轮次 · 不写 ledger · 不读任何文档。

#### 2.5 输出面

```
init[1/2] claude · superpowers · install
<子进程输出原样透出>
init[2/2] claude · mattpocock-skills · install
…
init: 6 steps ok (claude · install)
```

step 头先于子进程输出（消费者知道当前进行到哪一步）；全绿时一行汇总。

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

/** 一行插件 —— 列按 HostId 收口（少一个 host 是类型错，不是运行期漏装）。 */
export interface PluginRow {
  readonly name: string;
  readonly claude: PluginCommands;
  readonly pi: PluginCommands;
}

/** 插件名册 —— 数组而非对象：**行序即执行序、即 README 行序**（顺序是一等事实，
 *  不依赖对象键序）。依赖先行（上游先于 kairos）是此序的判据。 */
export const PLUGINS: readonly PluginRow[] = [superpowers, "mattpocock-skills", kairos];
```

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
| `infra/process.ts` 整文件（`ProcessRunner`）+ `infra/__tests__/infra.test.ts` 中其用例 | 删除（零生产读者） |

#### 3.3 README 面：一张表 + 一条命令（Q4 追加：再精简）

`packages/kairos/README.md`(+zh-CN) 的 `## Installation` 与 `### Upstream dependency install` 两段**合并为一段**：

1. 一条命令：`cdd init --harness=<claude|pi>`（`--update` 刷新），说明它装 kairos + 三个上游包。
2. 一张**由 `PLUGINS` 渲染的参考表**（install 一行 · update 一行），供免引擎 / 手工安装时照抄。
3. 删除与 `packages/cdd-engine/README.md` 重复的安装散文（"From pi" 代码块、`pi` 项目设置说明等——引擎 README 已有安装面）。

根 `README.md`(+zh-CN) 的 Quick start 第 1 步换成 `cdd init --harness=<claude|pi>`（Plugins 上游表保留：那是仓库生态说明，不是 cdd 依赖面）；impeccable 从 kairos 安装表与"（superpowers / mattpocock-skills / impeccable）"句中删除，根 README 的 Upstream 清单不动。

#### 3.4 门：`plugins.guard.test.ts`（替换 `install-rows.guard.test.ts`）

按 `PLUGINS` 渲染 install / update 两张表，与 `packages/kairos/README.md`(+zh-CN) 逐格比对：

- 行键集 == `PLUGINS.map(name)`（**含顺序**）；
- 每行 claude 单元格 == `install`（或 `update`）argv `join(" ")` 以 `；` 连接；
- 每行 pi 单元格 == 同一渲染规则；
- 两形态 × 两 host × 两 README 四组合全覆盖（今日只钉 claude 列）。

### 4. 定案：消费面同步与命令字面面的门（Q5）

#### 4.1 单源派生

`packages/kairos/tests/presentation-surface.test.ts` 的 `CDD_SUBCOMMANDS` 改为**派生**：`CLI_COMMANDS.map((c) => c.name)`（引擎声明是唯一源，手抄数组消失）。

#### 4.2 三处门

| 门 | 断言 |
|---|---|
| `cdd-engine` README CLI 表 | 表行集 == 派生集（含 `init` 行） |
| kairos README surface 句 | 含派生集 `join(" / ")` |
| `CLAUDE.md:44` 引擎行 | 命令枚举 == 派生集（**今日无门 → 新增**） |

结论判据：加第九个命令而不改文档 ⇒ 测试红。

#### 4.3 文档同步面

`CLAUDE.md`（七 → 八命令）· `packages/cdd-engine/README.md`(+zh-CN)（CLI 表加 `init` 行 + 全局 option 段不动）· `packages/kairos/README.md`(+zh-CN)（§3.3）· 根 `README.md`(+zh-CN)（Quick start 第 1 步）。**架构图零动**（命令枚举不在图内）。

### 5. 五平面影响

| 平面 | 改动 |
|---|---|
| contract | 零动（无新 doc 类型 / 元素 / 词汇） |
| session | 零动（无 ledger / round / next 面变化） |
| face | `declare.ts`（+`harness` / `update` channel 行 · +`init` 命令行）· `init.ts`（新 · `CliInit` + `StepRunner` / `ExecaStepRunner`）· `plugins.ts`（新 · `PLUGINS`）· `host.ts`（−`INSTALL_ROWS` · −`HostRow.install`）· `cli.ts`（`.action` 薄壳 + `CliInit` 装配；`init` 分支不过 `#rootOf()`） |
| infra | −`process.ts`（`ProcessRunner` 整文件） |
| render | 零动（README 渲染在 repo 文档面，不在引擎内） |

### Acceptance criteria

- `cdd init --harness=claude` 逐条执行 install 序列（替身 `StepRunner` 记录 argv，断言顺序与条数 = `PLUGINS[].claude.install` 展平）· `--harness=pi` 同。
- `--update` 只走 update 序列（替身断言 install 命令零出现）。
- 非法 `--harness` / 缺 `--harness` → exit 2（commander 原生报文）。
- 某步非零 → 后续步骤零执行 · 整体 exit 1 · stderr 含 `<step i/n>` 与 argv 与退出码；缺 harness 二进制走同一失败面（替身返回非零即可覆盖）。
- 非 git 目录内可跑（`chdir` 到临时非仓库目录，序列照跑，零 BLOCKED）。
- 零 shell 拼接：`grep` 断言 `sh -c` 零命中；argv tuple 直接进 `StepRunner`。
- `grep` 零残留：`INSTALL_ROWS` / `HostRow.install` / `ProcessRunner` 在生产面与测试面全零。
- `PLUGINS` 列类型覆盖 `HostId` 全集（类型级断言失败样例在册）；`HOST_IDS` 是 `HostId` / `HOSTS` 键集 / `--harness` 值域三者的唯一源（少一项是类型错）。
- `plugins.guard.test.ts` 四组合全绿（install/update × claude/pi × README 双语）；`install-rows.guard.test.ts` 已删。
- `CDD_SUBCOMMANDS` 派生自 `CLI_COMMANDS`；`CLAUDE.md` / `cdd-engine` README CLI 表 / kairos README surface 句三门全绿。
- kairos README 安装段合并为「一条命令 + 一张表」（旧 "From pi" 代码块与上游安装散文零残留）；根 README Quick start 第 1 步为 `cdd init`；impeccable 在 kairos 安装表零残留。
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