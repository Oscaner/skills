---
title: 引擎文档工具（Engine Doc-Tooling）— P3 设计：CLI 框架化收口 + 变更集归并
doc-type: phase-spec
version: v0.14
date: 2026-10-12
status: Draft
author: Oscar M. · Claude Opus 5（kairos:cdd-design [P3] 会话 · 2026-10-11）
parent-program: 2026-10-10-engine-doc-tooling-overall.md
depends-on: P1（Design Done · v0.4 · hard）· P2（Design Done · v0.5 ·
  satisfied——deferred 变更集随本 phase 折叠归并）
---

## Design

本 phase 收口引擎 doc 工具面的第三缺：**CLI 框架化**——引入 mature 框架 commander ^15 接管 parse + help 渲染管线，ARGV_CHANNEL 声明行度进入 `.option()/.command()` 成为命令树的数据驱动单源（`CommandTreeBuilder` 单类 · 零裸函数）；配合六前提整 face 重构（组合根重建 · 领域 run 类经 `.action()` 薄壳 · **值域校验/条件必填全 commander 原生**（v0.6：parseArg + preAction · ValueValidator 退役）），错误消息/帮助形面/usage 字节开放 commander 原生形态（pins 整体重锚 deliberate），语义契约三保不动（退出码 0/1/2 · CDD_BLOCKED 通道 · 裸 cdd usage 语义）。变更集收尾折叠：P1/P2 deferred + 框架化 bump 主题归并标 **major**（不发布 · 存量积压 changesets 留守）。设计输入：kairos:cdd-design [P3] 会话裁定（Q1–Q6 + 六前提 · 2026-10-11）· 用户 v0.6 重审（2026-10-11）· overall v2.0（D12）。

### 1. 目标与边界
#### 1.1 行为语义增量
- 六命令 + 子命令树（implement · review · fix · base set|get · schema get|gen · issue render）的声明从手写 parse + 自研渲染迁到 **commander 单宣言面**；行为语义增量 = 引擎 CLI 面框架化——消费面令牌/旗标/值域语义不动（**负向拼写 `--no-dry-run`/`--no-force` 退役为 deliberate · 用户裁定 2026-10-11**），字节面开放更替（Q5 裁定）
#### 1.2 非目标（域语义零动）
- 领域 run（Lifecycle/PreFlight/Capsule/host）语义零动 · doc-contract 判定语义不变（gate 零例外）· schema gen 渲染（SkeletonAssembler/Projector 代码面不动）· 引擎 vitest 断言面 · 跨程序 rename sweep 面（`src-next` 字面 · D8 拆 pin）· 不发布 · 存量积压 changesets 留守不折

### 2. commander 声明模型（数据驱动单源）
#### 2.1 ARGV_CHANNEL 行度入 .option()/.command()（投影器类 · 零裸函数 · 校验 commander 原生）
- **投影面 = 单一类 `class CommandTreeBuilder`**（`face/projection.ts` · 构造即组装）——`face/declare.ts` ARGV_CHANNEL 行字段（flag · alias · type · values · scope · help · §2.4 声明单面）投影到 commander `.option()`（**`--no-` 负向拼写退役**：commander 不派生取反 · bool 行**单面注册**正拼写——`dryRun` 行投影 `.option('--dry-run')` · `force` 行投影 `.option('--force')` · 误输 `--no-dry-run`/`--no-force` → commander 原生 `unknown option` + `Did you mean --dry-run?` 建议（受益面 · 比静默接受更诚实）· 退役为 deliberate · 用户裁定 2026-10-11 · 机制实测修正同源）；`face/declare.ts` CLI_COMMANDS 行的 description/usage 投影到命令 `.description()`——**零平行列表**：声明仍是行数据，commander 是消费者
- **值域校验 = commander 原生 parseArg**（v0.6 · 六前提重审 · 用户裁定 2026-10-11：不自造校验轮子）——option/argument 注册携带 **custom parser（类私有 parseArg 方法族）**：值域 enum（`--type`/`--source`）· int-list（`--tasks` 归一化逗号串）· 整数（`--round`）· sha8（`--base`/`--head`）· schema `<type>` 词表（typeKey）——校验失败抛 **`commander.InvalidArgumentError`**（官方扩展点 · 探针实证：错误字节 = commander 原生行 + 值域消息嵌入 · code `commander.invalidArgument` · §3.1 归 usage 域 2 · Q5 一致 · **无第二个错误系统**）；`ValueValidator`/`ValidatorUsageError` 组件退役（b0b87efe 已交付面随重开清理）
- **条件必填组 = commander 原生 `preAction` hook**（真域最小面· §4.2）——按 `--type` 条件必填由程序级 `.hook('preAction')` 承载（探针实证：钩子抛 `InvalidArgumentError` 与 parseArg 同管线）· 组表 = 常量数据 · 缺失 → usage 域 2 · **复刻现状 · 非互斥**
- **节点绑定规则（类私方法族）**：命令级 keys（`CLI_COMMANDS[cmd].keys`）→ 该命令节点 `.option()`（`required: true` → `.requiredOption()`）；`scope: "program"` 行 → 程序节点 `.option()` **并随行并入各命令节点**（保「program flags accepted at any position」语义 · cli.test.ts:494/698 任意位置接受 pin 语义保）· **help 行（`--help`/`-h`）不投影**——对齐 commander 内建 help option（默认 `-h, --help`）不重复注册（守卫不冲突）· **内建 `help [command]` 子命令复用**（commander 原生 · 用户裁定 2026-10-12 反转 v0.8 禁用定裁——六前提⑤⑥/Q5 最大原生化：help 子命令是 .addHelpCommand 默认能力池 · 禁用 = 抵消原生面的控制代码 · 复用为最小面）：`cdd help`/`cdd help <cmd>`/（父命令 `cdd base help`）→ 对应命令面帮助 **exit 0** · `cdd implement help`（leaf 无子命令）→ `commander.excessArguments` · 归 usage 2 · `cdd help <bogus>` → 无效目标 · 程序面帮助 + exit 1 → 2 · Commands 表含 `help [command]` 行（原生布局固有 · §7.3 更替面在册）。命令节点 option 集 = 其 keys + program scopes → §5.3 候选结构保真骨架（出错节点自身注册集 + 祖先链）· **类出口 = `readonly program: Command`**（构造即组装 · 含 §5.1 帮助注入 · usage/语料随 commander 原生产出——**自研 `usageFor()` 语料退役** · 域 run 错误面打 commander 原生 usage（`helpInformation()` 首行 · §7.3 deliberate））· **零模块级行为裸函数**（与全仓纪律统一 · 投影算法全类私方法族）
#### 2.2 guard channel-closure 保
- `scripts/lib/guard.ts` checkChannels 结构性 pin 保（每声明键可解析于 ARGV_CHANNEL）——CLI_COMMANDS/ARGV_CHANNEL 保持可导入（**declare 单面 · §2.4**），投影不破坏声明契约（每键仍单点声明）· 闭包审计 = **单面内自检**（同面两表互查 · v0.7）
#### 2.3 命令树层次
- base/schema/issue 的 leaf 子命令以 commander 子命令注册——**leaf 粒度由构造保证**（get/set 各持自身 option 集）：这是 §5.3 did-you-mean 结构保真的骨架
#### 2.4 声明面单源（face/declare.ts · 高内聚收敛 · v0.7）
- **CLI 面声明收敛单面** `face/declare.ts`（**纯数据+类型 · 零行为 · 零裸函数**）：`ARGV_CHANNEL` 通道行表 · `CLI_COMMANDS` 命令行表 · 全部 CLI 类型（`ChannelValueType`/`ChannelArgRow`/`CliVerb`/`CliLeafName`/`CliValueOverride`/`CliArgSpec`/`CliLeafSpec`/`CliCommandSpec`/`ChannelArg`——`CliCommandSpec` 随 registry.ts 齐迁 · CLI_COMMANDS 行类型）· `REQUIRED_GROUPS` 条件必填组表（preAction 数据面）——同栖一文件，改 CLI 定义不再跨 runtime/registry/argv 四处拼（用户裁定 2026-10-11：声明面七零八落 → 单面收敛 · 六前提④⑥）；**行为类不入 declare**（`CliUsageError` 整类退役 · §6.1 · `ParsedCommand` 随 argv.ts 退役 · §6.2）
- `face/registry.ts` **删除**（职责并入 declare · T2）· `infra/runtime.ts` 瘦身退「纯引擎配置数据面」（`ENGINE_RUNTIME`/`HANDOFF_FAMILIES` · 本就与 CLI 无关）· guard `checkChannels` 改读 declare（§2.2 闭包审计 = **单面内自检** · 语义不变）· 消费方（builder/cli/guard/infra.test）导入改址
- **数据与算法分层**：声明（declare · 数据）→ 投影（`CommandTreeBuilder` · 算法单类）→ 组合根（Cli）——声明流单向，零跨面纠缠；`ChannelArg` 迁 declare（**修正原「迁 infra/runtime.ts」定裁** · argv 退役后归 CLI 面）

### 3. 适配层与语义契约（Q6 三保）
#### 3.1 退出码表 0/1/2（exitOverride 归一）
- commander 原生错经 `exitOverride()` 归一：**usage 域**（`commander.unknownOption/unknownCommand/invalidArgument`（parseArg/preAction 抛 · 值域校验面）· `excessArguments`（leaf help 参数等）· `missingMandatoryOptionValue/missingArgument`… → 2）· 运行失败 → 1 · **帮助面按 `err.exitCode` 分流**（探针实证 · v0.9）：`commander.helpDisplayed`（显式 `--help` 旗标）→ 0 · `commander.help` + `exitCode 0`（显式 `help`/`help <cmd>` 子命令请求 · 任意层级——v0.9 复用内建 help 子命令 · 反转 v0.8 禁用）→ 0 · `commander.help` + `exitCode 非 0`（裸跑 cdd · 缺子命令 · `help <bogus>`）→ 2；`bin.ts` 薄 pass-through 不变（头注释断言表语义保）
#### 3.2 CDD_BLOCKED 通道
- 引擎域拒绝面（脏树 · plan-graph · wave gate · doc-contract · read-back 违约）自持 stderr 机器通道（words.ts CAPSULE_WORDS 锚）——与 parse 无关 · 不经 commander
#### 3.3 裸 cdd usage 语义
- 无命令调用（**不含** `--help`/`-h`）= usage 错：**退出 2**（语义保）· 消息/帮助字节 = commander 原生形态（形面更替）
- 无命令 + `--help`/`-h` 不落入本域——走 §3.4（程序面帮助 · 退出 0）
#### 3.4 --help 任意位置
- commander 原生支持任意位置/任意层级（含子命令与 verb-less）`--help`/`-h`——渲染对应命令面帮助并退出 0（含程序面）
- verb-less `cdd --help`/`cdd -h` 退出 **2→0 为 deliberate 更替**：现存 pin（cli.test.ts:563 `runArgv(["--help"])` → 2 · missing-command 面）随本 phase 翻转——`--help` 域退出 0 与 §3.3 无命令 usage 退 2 以是否携带帮助旗标划分 · 更替面列 §7.3
- **内建 `help [command]` 子命令复用**（v0.9 · 反转 v0.8 禁用裁定 · 用户裁定 2026-10-12——commander 原生能力池不裁剪）：`cdd help`/`cdd help <cmd>`/（父命令 `cdd base help`）任意层级 → 对应命令面帮助退出 **0**（判别 = `err.exitCode` 0 · §3.1）· `cdd help <bogus>` → 程序面帮助 + exit 1 → 2 · `cdd implement help`（leaf）→ `excessArguments` · 归 2
#### 3.5 re-review gate 统一判据（doc 修订判定 · v0.11 · 判据主导化 v0.12）
- **review gate = doc 内容修订判定（判据主导 · 六前提重审升级）**（用户裁定 2026-10-12 · 并入本 phase）：`reviewedDocRevision`（上次 review 的 doc hash）与当前 doc hash **不一致 → 新 review 合法**——fix 后 · backfill 后 · 用户裁定后为**同一种情况**（统一判据 · 修复被卡路径：fix 中止后 review 报「next round is fix」而旧 findings 已过期——此前流程手工重置 wave 状态的根因）· 新 round = `rounds.review++` + 更新修订快照 + **旧 findings/pending-fix 自动失效**（findings 绑定所审 doc hash · doc 修订即失效 · **pending-fix 无独立状态**——由「doc 相同 + 未 APPROVED」动态派生 · 零新增状态字段）· **doc 未修订 → 维持拒绝重复 review**（防空转 · Review Convergence「new ref opens a new review」语义保 · 不动）
- **状态面精简**：`rounds` 完成计数保留（消费面实证：findings 文件名 `-{type}-{round}` · reviewRange 派生）· gate 判定/推进 = **`Ledger` 方法族**（`session/ledger.ts` 状态读写属主 · 判定序 = doc 修订优先 · 类化统一 · 零裸函数）· 现 `cli.ts` 判定调用点（`reviewedDocRevisionOf` 读）收敛到方法族

### 4. 值域校验与条件必填（commander 原生 · v0.6 重审）
#### 4.1 值域校验 = parseArg + InvalidArgumentError
- **零自研校验组件**（`ValueValidator` 退役 · 用户裁定 2026-10-11：不自造轮子）——值域语义全部经 commander 官方扩展点：**option/argument custom parser**（`parseArg` · §2.1）抛 `commander.InvalidArgumentError`（code `commander.invalidArgument` · 错误字节 commander 原生行 + 值域消息嵌入 · §3.1 归 usage 域 2）· 覆盖面：值域 enum（`--type` wave|branch|spec|plan · `--source` plan-field|branch-upstream|conversation-context|user-confirmed）· int-list（`--tasks` n,n,… → 归一化逗号串 `1,2,3`）· 整数（`--round`）· 8-char sha（`--base`/`--head`）· **schema `<type>` 类型词表**（typeKey：primary 拼写（overall/plan/phase-spec）· `phaseSpec` 别名归一 · bogus → 拒 · docKeys/plan-graph 路由承接 argv 面）
#### 4.2 条件必填组 = preAction hook（复刻现状 · 非互斥）
- **按 `--type` 条件必填（复刻现状语义 · 修正 2026-10-11）**：review `{plan}` / `{spec}` / `{base, head}` · fix `{plan}` / `{spec}` / `{findings}`（fix branch face = `--findings` · fix 无 `--base`/`--head` 声明面）——程序级 `.hook('preAction')` 承载（commander 原生钩子 · 组表常量数据单面声明 · 缺失抛 `InvalidArgumentError` 同管道）；**非互斥**——`review --type wave --plan X --spec Y` 保持接受（互斥为新拒绝面故不引入）

### 5. 帮助形面（commander 原生 · Q1-A/Q5）
#### 5.1 三件套落（builder 构造内注入 · commander API 承载）
- **命令表短描述**（`.description()` 投影 · 含值域/用途）· **Usage/Options/Examples 段首**（commander 原生 Usage/Options/Commands 布局 + `.addHelpText()` 注入 Examples 与程序旗标尾注——载体 = commander API · 实现于 `CommandTreeBuilder` 构造内（§2.1 类化 · T2 面））· **描述位序**（按 ARGV_CHANNEL 行序注册 = 现命令表序）· **尾注仅程序自定义旗标**（`--dry-run`——`-h, --help` 已内建 Options 显示 · 冗余列裁除 · 六前提死面清理 · v0.6 重审）
#### 5.2 值域并入选项描述
- 选项描述携带值域（`<wave|branch|spec|plan>` · `<n|n,n,…>` · `<sha>` · `<path>`）——P1 重建的信息面（旗标级说明 + 值域）从自研渲染迁移到 commander 描述字符串
#### 5.3 did-you-mean 结构保真
- commander 原生 suggestion（自身 option 集 + 祖先链内 options 近邻）——命令树正确注册下**三 ID 用例零自定义 hint 码**：`base get --forc` 无提示（get 面无 --force）· `base set --forc` → did you mean --force? · `implement --spel` 无 --spec 候选；用例降为**语义回归 pin**（行为断言 · 字节随 commander 锚定）
- **pre-verb 泛型分支处置**：程序级 unknown option 候选集 = 出错节点自身注册 options（含内建 helpOption）+ 祖先链 → 收窄至程序作用域（`--dry-run`/`-h`/`--help`——负向拼写退役不入候选 · 用户裁定 2026-10-11）；现存 `#nearestFlag` surface-undefined 分支的完整 channel-table merge（`cdd --taks` → 提示 `--tasks`）随 hint 引擎删除（§6.1）**deliberate 消失**——与三 ID 用例 leaf 粒度互斥（程序级全量注册通道表会污染全部命令的祖先链候选），零自定义 hint 码下选边 = 程序作用域候选，属 §1.1 Q5 字节面开放更替边界；pre-verb 拒绝语义零动（cli.test.ts:424 `parse(["--root", "x", "implement"])` → unknown option · §7.3）

### 6. 销毁面（最大精简 · Q5）
#### 6.1 自研渲染 + hint 引擎删除
- `#renderHelp`/`#optionLines`/`#overview`/`#typeDomain`/`#leafTokens`/`#domainOf` · `#usageHint`/`#nearestFlag`/`#distance` · `CliUsageError`（整类 · 含 `.surface`——usage 错误面全 commander 原生 · 无自研错误类型）· CLI_USAGE 六行字面——整组删除（usage/描述语义并入声明投影 · §2.1）
- **域拒绝消息面保留（非死面 · 核对 · v0.9）**：`#renderPreflightBlocked`（preflight BLOCKED 消息渲染）· `#phaseHint`（域错误消息 phase 提示）**不清理**——CDD_BLOCKED 通道/域拒绝消息 = 引擎自持机器通道（§3.2 · 与 parse 无关 · 不经 commander · 行为语义零动）· 与 help 自研死面严格区分（用户裁定核对 2026-10-12：自研 help 退役后死面全清 · 域拒绝消息面为有意保留）
#### 6.2 argv.ts/validate.ts 收纳 · registry.ts 删除
- 手写 tokenize/validate 通道删除——parse 通道职责整体移交 commander（§4）· argv.ts parse 通道退役后**文件级删除**（类型已 T2 迁 `face/declare.ts` · §2.4 · **修正原「迁 infra/runtime.ts」定裁**）· **`ParsedCommand` 随 argv.ts 整面退役**（parse 结果类型 · parse 面移交 commander · 无平行回购类型 · 不迁 declare）· `face/registry.ts` 随声明单面收敛删除（T2 · 职责并入 `face/declare.ts`）· **`face/validate.ts` 整文件删除**（内容已全部分配殆尽：`ValueValidator`/`ValidatorUsageError` 退役（§4.1）· `REQUIRED_GROUPS` → declare（§2.4）· `SCHEMA_TYPE_KEYS` 词表 → builder parseArg（§2.1））
#### 6.3 words.ts 归一
- 帮助面向词表并入声明；域词表保留（CAPSULE_WORDS · GUARD_BAN_WORDS · ISSUE_LABEL_WORDS · CHARTER_WORDS）

### 7. 维护文档 · 变更集 · 测试 pins 处置
#### 7.1 维护文档 05 退役（deliberate · 用户裁定 2026-10-11 · **已落地**）
- `docs/maintainers/05-third-party-dependencies.md` **整文件删除**——第三方依赖不留存运维文档说明（用户裁定 · post-approval backfill · 变原「§4 commander 行重准入注记」为「整文件退役」）· **退役已在树内实施**（现存无 05 文件 · CONTENT_DOCS = 01–04 + 06-skill-node-discipline 留编号 · README 重排「Numbered 01–04 and 06」· 测试头注释已同步家族）——**T1 重定位为核验而非执行**：`packages/kairos/tests/maintainers-docs.test.ts`（doc 05 零引用 · convergence ledger 硬编码数组零 05 残留 · 05-deps carries 测试零残留 · 头注释 01–04 + 06 家族一致）· `docs/maintainers/README.md`（index 表零 05 行 · P4.2 ledger 零 05 行 · Total After 已含刷新）· **依赖面断言载体居 `package.json#dependencies`**（已迁 · 声明面守卫 · 运维文档面退役）· 历史 docs 提及（P1/P4.2/P5 plans/specs）不改
#### 7.2 合并变更集 major
- 一个 cdd-engine 变更集 · 主题归并：P1 deferred（review face overall 键 · help 重建 · 词表统一）+ P2 deferred（schema gen 模板写作 · 去流程化）+ P3 框架化（commander ^15 · 形面/错误字节更替 · 架构重写）——标 **major**（breaking 段叙事 · 终版 2.0.0 由存量 major 决定 · 不发布）· 存量积压 changesets 留守
#### 7.3 测试 pins 更替面
- 更替（deliberate）：CLI_USAGE 六行字节 pin · help/usage 字面 pin（`"usage: cdd"` ×8 · `"commands:"`/`"subcommands:"` 等 · 程序旗标尾注（**仅 `--dry-run`** · v0.6 裁 `--help` 冗余列））· **`usageFor()` 自研语料退役**——域 run 错误面 usage 提示改 **commander 原生**（`helpInformation()` 首行 · `usage: cdd <verb> [options]` 形态 · smoke 锚/usage pins 同步更替 deliberate · v0.6）· smoke-cdd `usage: cdd implement` 锚 · **verb-less `--help`/`-h` 退出 2→0**（cli.test.ts:563 · missing-command 面字节 → commander 原生程序面帮助 · §3.4）· pre-verb unknown option pin（cli.test.ts:424 `parse(["--root", "x", "implement"])` → unknown option · 归属程序节点校验 · 拒绝语义保 · 字节随 commander 更替）· **`Cli#parse()` 退役**（37 处 `.parse([` 中语义保用例重锚 `runArgv` 级断言 · 字面字节随 commander 更替）· **三处 parse 级新更替面**（退出码均不变）：unknown command 原生命令名建议（`implementt` → Did you mean implement? · 现面无命令名建议——新增面）· 缺子命令（`base` 独跑）→ commander 原生**所属命令节点帮助**（`base` 节点自身子命令列表 set/get · 非顶层程序面 · 更替现状 missing subcommand — set | get）· `-h` pre-verb → 程序面帮助（更替现状渲染 verb 面帮助 · exit 均 0）· **内建 help 子命令复用（v0.9 · 反转 v0.8 禁用 · 用户裁定 2026-10-12）**：`cdd help`/`cdd help <cmd>`/`cdd base help` → 对应命令面帮助 **exit 0**（code `commander.help` · `err.exitCode 0` → 判别 0）· `cdd implement help`（leaf）→ `commander.excessArguments`（`error: too many arguments for 'implement'. Expected 0 arguments but got 1: help.` · 归 usage 2）· `cdd help <bogus>` → 程序面帮助 + exit 1 → 2 · Commands 表含 `help [command]` 行（原生布局固有）· **`cdd help` 现行为更替**（自研 parse：unknown command 退 2 → 原生帮助退 0 · deliberate）· **负向拼写退役**（`--no-dry-run`/`--no-force` · cli.test.ts:500/512-513 pin 重锚为 unknown-option + `Did you mean --dry-run?` 断言 · 零消费隐藏拼写删除 · 用户裁定 2026-10-11）
- 语义保（断言形态更替）：退出码表 · 三 ID did-you-mean 用例 · 裸 cdd 行为（退 2 + 原生程序面帮助 · **无 missing-command 定制文本** · 字节随 commander）· schema `<type>` 词表语义（unknown-schema-type 拒绝重锚 · phaseSpec 别名归一 · plan-graph 路由）· bin.test 头断言表 · **missing-required 族**（cli.test.ts:783 `missing required --tasks`/`expected --tasks <n|n,n,…>` · bin.test.ts:65 `missing required --plan`）——语义保 · 字节归属 `.requiredOption()`（`required: true` · §2.1）更替，值域/类型词表/`--type` 条件必填组 = **parseArg + preAction hook**（§4 · 零自研校验组件 · 错误字节 commander 原生）

### Acceptance criteria

- `commander ^15 运行时依赖落 cdd-engine package.json（与 simple-git 并列）· 维护文档 05 整文件删除 + 周边同步全绿（test 面 · ledger · live 引用零残留 · 历史 docs 提及不改）`
- `帮助形面三件套落（命令表短描述 · Usage/Options/Examples 段首 · 描述位序 · commander 原生形态）· 值域并入选项描述（--type/<wave|branch|spec|plan> 等）· 程序旗标尾注（仅 --dry-run）`
- `语义契约回归全绿：退出码 0/1/2（exitOverride）· CDD_BLOCKED 通道 · 裸 cdd usage 退 2（不含 --help/-h · verb-less --help 退 0 更替在册）· did-you-mean 三 ID 用例 = 命令树结构保真（零自定义 hint 码）· --help/-h 任意位置 · 内建 help [command] 子命令复用（cdd help/help <cmd>/父命令 help → exit 0 · help <bogus> → 2 · leaf help 参数 → excessArguments 归 2 · Commands 表含 help [command] 行 · §2.1/§3.4/§7.3 同步锚）· 值域/条件必填组语义 = parseArg + preAction hook（零自研校验组件）· **re-review gate 统一判据（doc 修订 → 新 review 合法 · 相同 doc 重复 review 仍拒 · rounds 完成计数保留（findings `-{type}-{round}` 文件名消费面）· 旧 findings 自动失效 · 零新增状态字段（pending-fix 由「doc 相同 + 未 APPROVED」动态派生）· §3.5）**`
- `零自研校验轮子（ValueValidator 退役 · parseArg + InvalidArgumentError 吸收 · 错误字节 commander 原生）· 投影面零模块级行为裸函数（CommandTreeBuilder 单类 · 构造即组装 · 与全仓纪律统一）`
- `错误消息/帮助/usage pins 全更替（deliberate）· 自研渲染 + hint 引擎销毁面 grep 零残留（#renderHelp/#nearestFlag/CLI_USAGE 六行/ValueValidator/ValidatorUsageError 等）`
- `CLI 面声明单源落（declare.ts 同栖 · registry.ts 删除 · runtime.ts 瘦身 · guard 闭包 = 单面内自检）· ARGV_CHANNEL/CLI_COMMANDS 单源零平行列表（guard channel-closure 全绿）· 命令树声明投影无手写 parse 残留 · 领域 run 语义零动（引擎 vitest 全绿作证 · 452+ 面）`
- `pnpm exec changeset status 无 empty 条目 · pnpm run validate ALL PASS · EOF 全绿 · 不发布`

## Constraints

- **结构保真**：本骨架 = 声明面派生（`schema gen phase-spec`）· 编辑器只填不重排——违反 = 保真破坏，视为 defect
- **语义契约三保不动**（退出码表 0/1/2 域 · CDD_BLOCKED 通道 · 裸 cdd usage 语义）——commander 原生为形态载体，语义是消费面硬契约；**退出码表更替边界逐条列明**：verb-less `--help`/`-h` 2→0（§3.4/§7.3）· **内建 `help [command]` 复用面**：`cdd help`/`cdd help <cmd>`/父命令 `cdd base help` → 对应命令面帮助 2→0（deliberate · 与 §2.1/§3.1 同源）· leaf `help` 参数 → excessArguments 归 2 · `help <bogus>` → 程序面帮助归 2（§7.3）· missing-required 字节归属 `.requiredOption()`（§2.1/§7.3）——其余 0/1/2 域不动
- **行为语义零动**：领域 run（Lifecycle/PreFlight/Capsule/host）· doc-contract 判定 · `next:` dispatch 字面 · 跨程序 rename sweep 面
- **数据驱动单源**：CLI 面声明收敛单面 `face/declare.ts`（§2.4 · v0.7）——ARGV_CHANNEL/CLI_COMMANDS/类型/`REQUIRED_GROUPS` 同栖 · 行度 → `.option()/.command()` 投影 · 零平行列表 · guard 结构性 pin 保（单面内自检）
- **测试 pins 更替 = deliberate**（三 ID 语义回归 pin 保 · 错误消息语义保）——更替面以本设计 §5/§6/§7 为界
- **零运行时依赖变化**（除 commander ^15 · D11 例外）· 维护文档 05 退役为 deliberate（用户裁定 2026-10-11 · 第三方依赖不留存运维文档面）· 依赖面断言载体迁 package.json#dependencies
- **变更集 major 归并**（P1/P2 deferred + 框架化 · 存量积压 changesets 留守 · 不发布）
- **gate 零例外**：doc-contract 判定语义不变——骨架 by construction 绿 · 填后终判兜底
- **六前提整 face 许可**（P3 与 P1/P2 同款 · D12）：组合根重建 · OOP 统一零裸函数 · 死码/空壳清理 · 高内聚低耦合 · 消费者心智负担 · 最大精简
- **校验全 commander 原生**（v0.6 重审 · 用户裁定 2026-10-11）：值域/类型词表 = parseArg + `InvalidArgumentError`（官方扩展点 · 错误字节 commander 原生）· `--type` 条件必填组 = `preAction` hook · **零自研校验组件**（`ValueValidator` 退役）· 自研 usage 语料（`usageFor`）退役——usage 提示面 = commander 原生产出（deliberate · §7.3）
- **消费者心智**：cdd 六命令/旗标/值域语义面不动（**负向拼写 `--no-dry-run`/`--no-force` 退役为 deliberate**）——框架化是引擎内部工程，消费面感知帮助/错误字节更替 + 负向拼写移除

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-10-11 | P3 设计 v0.1——CLI 框架化收口 + 变更集归并：commander ^15 数据驱动单源 · 六前提整 face 重构 · commander 原生为基（Q5）· 语义契约三保（Q6）· 变更集 major（P1/P2 deferred + 框架化归并 · 存量留守 · 不发布） | Oscar M. · Claude Opus 5（kairos:cdd-design [P3] · 2026-10-11） |
| v0.2 | 2026-10-11 | P3 设计 v0.2——spec review round 1 fix：verb-less `--help`/`-h` 退出 2→0 deliberate 更替定裁（§3.3 域限制 · §3.4 · §7.3 · Constraints 退出码表更替边界）· pre-verb 泛型 did-you-mean 候选收窄定裁（§5.3）· 节点绑定规则补（§2.1 · `required: true` → `.requiredOption()` · help 行不投影）· missing-required 族字节归属 `.requiredOption()`（§7.3） | Oscar M. · Claude Opus 5（kairos:cdd-design [P3] · 2026-10-11） |
| v0.3 | 2026-10-11 | P3 设计 v0.3——plan review round 1 漂移归口回填（编排器 · spec 冻结解除）：`--no-` 取反机制实测修正（commander 15.0.0 不派生 · bool 行双侧显式注册 · §2.1 标注）· §4.1 校验组改按 type 条件必填（复刻现状 · 非互斥 · fix branch = `--findings`）· schema `<type>` 词表承接（`typeKey` · phaseSpec 别名 · plan-graph 路由）· §7.3 更替清单扩列 `Cli#parse()` 退役 + 三处 parse 级新面（unknown command 命令名建议 · 缺子命令程序面 · `-h` pre-verb 程序面）· 语义保条对齐裸 cdd 行为（无 missing-command 定制文本） | Oscar M. · Claude Opus 5（kairos:cdd-plan 归口 · 2026-10-11） |
| v0.4 | 2026-10-11 | P3 设计 v0.4——用户裁定：负向拼写 `--no-dry-run`/`--no-force` 退役（零消费隐藏拼写 · 死面清理 · 六前提 + 消费心智）——§2.1 双侧注册改**单面注册**（bool 行只认正拼写 · 误输获 commander 原生 `Did you mean --dry-run?` 建议）· §5.3 pre-verb 候选面除负向拼写 · §7.3 更替清单加负向拼写重锚（cli.test.ts:500/512-513 → unknown-option + 建议断言）· §1.1/Constraints 消费面语义不动 + 负向拼写退役例外 | Oscar M. · Claude Opus 5（kairos:cdd-design · 用户裁定 · 2026-10-11） |
| v0.5 | 2026-10-11 | P3 设计 v0.5——用户裁定 backfill（post-approval deliberate · 用户 2026-10-11）：维护文档 05 整文件退役（第三方依赖不留存运维文档说明）——§7.1 从「§4 注记」改「整文件删除」· 周边同步三件套入 T1 · Acceptance/Constraints 同步 · 依赖面断言载体迁 package.json#dependencies | Oscar M. · Claude Opus 5（kairos:cdd-design · 用户裁定 · 2026-10-11） |
| v0.6 | 2026-10-11 | P3 设计 v0.6——用户裁定（六前提重审 · 2026-10-11 · T2/T3 面重构）：commander 集成面**最大原生化**——§2.1 投影面单类 `CommandTreeBuilder`（构造即组装 · 零模块级裸函数 · T3 裸函数面重审）· §4 整节改「值域校验 = parseArg + InvalidArgumentError · 条件必填 = preAction hook」（**ValueValidator 退役** · 不自造校验轮子 · T2 面重审）· §5.1 帮助注入收 builder 构造 · 尾注裁 `--help` 冗余列 · usageFor 自研语料退役（域 run 错误面 = commander 原生 usage · §7.3 deliberate） | Oscar M. · Claude Opus 5（kairos:cdd-design · 用户裁定 · 2026-10-11） |
| v0.7 | 2026-10-11 | P3 设计 v0.7——用户裁定（声明面七零八落 → 单面收敛 · 2026-10-11 · 六前提④⑥）：§2.4 声明面单源 `face/declare.ts`（ARGV_CHANNEL/CLI_COMMANDS/类型/REQUIRED_GROUPS 同栖 · 纯数据零行为）· registry.ts 删除 · runtime.ts 瘦身退纯引擎配置面（ENGINE_RUNTIME/HANDOFF_FAMILIES）· guard 闭包审计 = 单面内自检 · ChannelArg 迁 declare（**修正原「迁 runtime」定裁**）· 数据/算法分层（declare → builder → cli 单向） | Oscar M. · Claude Opus 5（kairos:cdd-design · 用户裁定 · 2026-10-11） |
| v0.8 | 2026-10-11 | P3 设计 v0.8——spec review round 2 fix（v0.7 面评审回填）：内建 `help [command]` 子命令处置定裁（`.addHelpCommand(false)` 程序级 + 各级父命令节点 · §2.1/§3.1 同步 · `help` 不入动词面）· §2.4 类型枚举补 `CliCommandSpec` · `ParsedCommand`/`CliUsageError` 退役去向言明（§6.1 整类退役 · §6.2 随 argv.ts）· `face/validate.ts` 整文件删除入 §6.2 + Acceptance grep 清单加 ValueValidator/ValidatorUsageError · §7.1 05 退役重定位为核验（**已落地** · T1 非执行）· §7.3 缺子命令措辞改「所属命令节点帮助」 | Oscar M. · Claude Opus 5（kairos:cdd-design · spec review round 2 · 2026-10-11） |
| v0.9 | 2026-10-12 | P3 设计 v0.9——用户裁定（2026-10-12 · 反转 v0.8 禁用定裁）：**内建 `help [command]` 子命令复用**（commander 原生能力池不裁剪 · 六前提⑤⑥/Q5 最大原生化——禁用 = 抵消原生面的控制代码 · 复用为最小面）——§2.1 删 `.addHelpCommand(false)` 改复用注记（`cdd help`/`help <cmd>`/父命令 help → 面帮助 exit 0 · leaf `help` 参数 → excessArguments · `help <bogus>` → exit 1 → 2 · Commands 表含 help 行）· §3.1 帮助判别改按 **`err.exitCode`** 分流（探针实证：显式 help exit 0 → 0 · 裸跑/无效目标 exit 非 0 → 2）· §3.4 · §7.3 更替面扩列（`cdd help` 现行为更替 · unknown command 2 → 帮助 0 deliberate） | Oscar M. · Claude Opus 5（kairos:cdd-design · 用户裁定 · 2026-10-12） |
| v0.10 | 2026-10-12 | P3 设计 v0.10——spec review round 2 fix（v0.9 面评审回填）：Acceptance 语义契约回归清单补**内建 help [command] 子命令复用契约**（cdd help/help <cmd>/父命令 help → exit 0 · help <bogus> → 2 · leaf help 参数 → excessArguments 归 2 · Commands 表含 help [command] 行 · §2.1/§3.4/§7.3 同步锚）· §5.3 did-you-mean 候选措辞改「**自身 option 集 + 祖先链内 options 近邻**」（commander 15.0.0 suggestSimilar 实证 · 与 §2.1 候选骨架及同节下行对齐） | Oscar M. · Claude Opus 5（kairos:cdd-design · spec review round 2 · 2026-10-12） |
| v0.11 | 2026-10-12 | P3 设计 v0.11——用户裁定（2026-10-12 · 需求分析并入）：**re-review gate 统一判据**（§3.5）——review gate = doc 内容修订判定（doc hash ≠ reviewedDocRevision → 新 review 合法 · fix 后/backfill 后/用户裁定后同一种情况 · 旧 pending-fix 过期降级 · 相同 doc 维持拒绝防空转 · Review Convergence 语义保）· Acceptance 补 gate 判据 · plan T8 落 | Oscar M. · Claude Opus 5（kairos:cdd-design · 用户裁定 · 2026-10-12） |
| v0.12 | 2026-10-12 | P3 设计 v0.12——用户核查（六前提重审 T8 方案 · 2026-10-12）：**判据主导化升级**——§3.5 doc 修订判定为 gate 主判据（既有 `reviewedDocRevision` 读点实证 `cli.ts:1450` · 卡点 = 判定序/状态模型而非缺判据）· **pending-fix 无独立状态**（doc 相同 + 未 APPROVED 动态派生 · 零新增状态字段）· `rounds` 完成计数保留（findings 文件名/`-round` 消费面实证）· 判定/推进 = `Ledger` 方法族（类化 · 零裸函数） | Oscar M. · Claude Opus 5（kairos:cdd-design · 用户核查 · 2026-10-12） |
| v0.13 | 2026-10-12 | P3 设计 v0.13——spec review round 3 fix（spec-review-1 复核 · 3 条受理）：Constraints 更替边界枚举补内建 `help [command]` 复用面（`cdd help`/`cdd help <cmd>`/父命令 help → 对应命令面帮助 2→0 · deliberate · 与 §2.1/§3.1 同源）· leaf `help` 参数 → excessArguments 归 2 · `help <bogus>` → 程序面帮助归 2 ——与 plan v0.11 F1 同法收口（§3.4/§7.3 同步锚）· Acceptance「分布组」术语改「条件必填组」（与 §4/§7.3 对齐）· Acceptance gate 锚补状态面非回归项（rounds 完成计数保留 · 旧 findings 自动失效 · 零新增状态字段） | Oscar M. · Claude Opus 5（kairos:cdd-design · spec review round 3 · 2026-10-12） |
| v0.14 | 2026-10-12 | **P3 closeout（cdd-close）**：实现全链闭合——引擎面 W1–W7 波次链全绿（T2 declare 单面收敛 + CommandTreeBuilder（parseArg 值域/preAction 条件必填/帮助注入/内建 help 复用）· T3 组合根重建（.action 薄壳 · exitOverride · err.exitCode 判别）· T4 帮助接受面 + T8 统一 re-review gate（Ledger 方法族 · doc 修订判据主导 · 推进于 round 完成时）· T5 pins 重锚（parse 级 runArgv 化）· T6 销毁面（argv/validate/registry 文件级删除 · 9 方法 + CLI_USAGE/ValueValidator/CliUsageError/ParsedCommand 零残留）· T7 合并变更集 major）· 分支终审 4 findings → 分支 fix（域 run 错误面 commander 原生 usage 行恢复 · implement-help 两段判定序 pin 实证 · 词表单源派生 · 死导出删除）· Acceptance 全项交付（engine vitest 488/488 · validate ALL PASS · 不发布）· 父 overall v2.2 登记 P3 → Done | [human] · Claude Opus 5（kairos:cdd-close · closeout-backfill） |
