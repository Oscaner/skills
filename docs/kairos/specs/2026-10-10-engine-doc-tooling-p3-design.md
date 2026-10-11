# 引擎文档工具（Engine Doc-Tooling）— P3 设计：CLI 框架化收口 + 变更集归并
- **Version**: v0.2 · 2026-10-11
- **Status**: Draft
- **Author**: Oscar M. · Claude Opus 5（kairos:cdd-design [P3] 会话 · 2026-10-11）
- **Parent program**: [2026-10-10-engine-doc-tooling-overall](2026-10-10-engine-doc-tooling-overall.md)
- **Depends on**: P1（Design Done · v0.4 · hard）· P2（Design Done · v0.5 · satisfied——deferred 变更集随本 phase 折叠归并）

## Design

本 phase 收口引擎 doc 工具面的第三缺：**CLI 框架化**——引入 mature 框架 commander ^15 接管 parse + help 渲染管线，ARGV_CHANNEL 声明行度进入 `.option()/.command()` 成为命令树的数据驱动单源；配合六前提整 face 重构（组合根重建 · 领域 run 类经 `.action()` 薄壳 · 校验组件收口域语义），错误消息/帮助形面/usage 字节开放 commander 原生形态（pins 整体重锚 deliberate），语义契约三保不动（退出码 0/1/2 · CDD_BLOCKED 通道 · 裸 cdd usage 语义）。变更集收尾折叠：P1/P2 deferred + 框架化 bump 主题归并标 **major**（不发布 · 存量积压 changesets 留守）。设计输入：kairos:cdd-design [P3] 会话裁定（Q1–Q6 + 六前提 · 2026-10-11）· overall v2.0（D12）。

### 1. 目标与边界
#### 1.1 行为语义增量
- 六命令 + 子命令树（implement · review · fix · base set|get · schema get|gen · issue render）的声明从手写 parse + 自研渲染迁到 **commander 单宣言面**；行为语义增量 = 引擎 CLI 面框架化——消费面令牌/旗标/值域语义不动，字节面开放更替（Q5 裁定）
#### 1.2 非目标（域语义零动）
- 领域 run（Lifecycle/PreFlight/Capsule/host）语义零动 · doc-contract 判定语义不变（gate 零例外）· schema gen 渲染（SkeletonAssembler/Projector 代码面不动）· 引擎 vitest 断言面 · 跨程序 rename sweep 面（`src-next` 字面 · D8 拆 pin）· 不发布 · 存量积压 changesets 留守不折

### 2. commander 声明模型（数据驱动单源）
#### 2.1 ARGV_CHANNEL 行度入 .option()/.command()
- `infra/runtime.ts` ARGV_CHANNEL 行字段（flag · alias · type · values · scope · help）投影到 commander `.option()`（`--no-` 取反由 commander 原生派生）；`face/registry.ts` CLI_COMMANDS 行的 description/usage 投影到命令 `.description()`——**零平行列表**：声明仍是行数据，commander 是消费者
- **节点绑定规则**：命令级 keys（`CLI_COMMANDS[cmd].keys`）→ 该命令节点 `.option()`（`required: true` → `.requiredOption()`）；`scope: "program"` 行 → 程序节点 `.option()` **并随行并入各命令节点**（保「program flags accepted at any position」语义 · cli.test.ts:494/698 任意位置接受 pin 语义保）· **help 行（`--help`/`-h`）不投影**——对齐 commander 内建 help option（默认 `-h, --help`）不重复注册（守卫不冲突）。命令节点 option 集 = 其 keys + program scopes → §5.3 候选结构保真骨架（出错节点自身注册集 + 祖先链）
#### 2.2 guard channel-closure 保
- `scripts/lib/guard.ts` checkChannels 结构性 pin 保（每声明键可解析于 ARGV_CHANNEL）——CLI_COMMANDS 保持可导入，投影不破坏声明契约（每键仍单点声明）
#### 2.3 命令树层次
- base/schema/issue 的 leaf 子命令以 commander 子命令注册——**leaf 粒度由构造保证**（get/set 各持自身 option 集）：这是 §5.3 did-you-mean 结构保真的骨架

### 3. 适配层与语义契约（Q6 三保）
#### 3.1 退出码表 0/1/2（exitOverride 归一）
- commander 原生错（unknown option/command · missing required argument 等）经 `exitOverride()` 归一：usage 域 → 2 · 运行失败 → 1 · `--help` → 0；`bin.ts` 薄 pass-through 不变（头注释断言表语义保）
#### 3.2 CDD_BLOCKED 通道
- 引擎域拒绝面（脏树 · plan-graph · wave gate · doc-contract · read-back 违约）自持 stderr 机器通道（words.ts CAPSULE_WORDS 锚）——与 parse 无关 · 不经 commander
#### 3.3 裸 cdd usage 语义
- 无命令调用（**不含** `--help`/`-h`）= usage 错：**退出 2**（语义保）· 消息/帮助字节 = commander 原生形态（形面更替）
- 无命令 + `--help`/`-h` 不落入本域——走 §3.4（程序面帮助 · 退出 0）
#### 3.4 --help 任意位置
- commander 原生支持任意位置/任意层级（含子命令与 verb-less）`--help`/`-h`——渲染对应命令面帮助并退出 0（含程序面）
- verb-less `cdd --help`/`cdd -h` 退出 **2→0 为 deliberate 更替**：现存 pin（cli.test.ts:563 `runArgv(["--help"])` → 2 · missing-command 面）随本 phase 翻转——`--help` 域退出 0 与 §3.3 无命令 usage 退 2 以是否携带帮助旗标划分 · 更替面列 §7.3

### 4. 校验组件（域语义收口）
#### 4.1 commander 不接的语义
- 值域 enum（`--type` wave|branch|spec|plan · `--source` plan-field|branch-upstream|conversation-context|user-confirmed）· int-list 格式（`--tasks` n,n,… · `--round` 整数）· 8-char sha（`--base`/`--head`）· **分布组取一语义**（review/fix 的 `--plan` / `--spec` / `--base --head`）
#### 4.2 错误分类
- 校验失败 → usage 域错误 → 退出 2；`CliUsageError` 面携带字段删除（did-you-mean 落 commander · §5.3），消息字节 commander 原生

### 5. 帮助形面（commander 原生 · Q1-A/Q5）
#### 5.1 三件套落
- **命令表短描述**（`.description()` 投影 · 含值域/用途）· **Usage/Options/Examples 段首**（commander 原生 Usage/Options/Commands 布局 + `.addHelpText()` 注入 Examples 与程序旗标尾注）· **描述位序**（按 ARGV_CHANNEL 行序注册 = 现命令表序）
#### 5.2 值域并入选项描述
- 选项描述携带值域（`<wave|branch|spec|plan>` · `<n|n,n,…>` · `<sha>` · `<path>`）——P1 重建的信息面（旗标级说明 + 值域）从自研渲染迁移到 commander 描述字符串
#### 5.3 did-you-mean 结构保真
- commander 原生 suggestion（单命令 option 集内近邻）——命令树正确注册下**三 ID 用例零自定义 hint 码**：`base get --forc` 无提示（get 面无 --force）· `base set --forc` → did you mean --force? · `implement --spel` 无 --spec 候选；用例降为**语义回归 pin**（行为断言 · 字节随 commander 锚定）
- **pre-verb 泛型分支处置**：程序级 unknown option 候选集 = 出错节点自身注册 options（含内建 helpOption）+ 祖先链 → 收窄至程序作用域（`--dry-run`/`--no-dry-run`/`-h`/`--help`）；现存 `#nearestFlag` surface-undefined 分支的完整 channel-table merge（`cdd --taks` → 提示 `--tasks`）随 hint 引擎删除（§6.1）**deliberate 消失**——与三 ID 用例 leaf 粒度互斥（程序级全量注册通道表会污染全部命令的祖先链候选），零自定义 hint 码下选边 = 程序作用域候选，属 §1.1 Q5 字节面开放更替边界；pre-verb 拒绝语义零动（cli.test.ts:424 `parse(["--root", "x", "implement"])` → unknown option · §7.3）

### 6. 销毁面（最大精简 · Q5）
#### 6.1 自研渲染 + hint 引擎删除
- `#renderHelp`/`#optionLines`/`#overview`/`#typeDomain`/`#leafTokens`/`#domainOf` · `#usageHint`/`#nearestFlag`/`#distance` · `CliUsageError.surface` · CLI_USAGE 六行字面——整组删除（usage/描述语义并入声明投影 · §2.1）
#### 6.2 argv.ts 收纳
- 手写 tokenize/validate 通道删除；保留组件化的域语义校验（§4）——parse 通道职责整体移交 commander
#### 6.3 words.ts 归一
- 帮助面向词表并入声明；域词表保留（CAPSULE_WORDS · GUARD_BAN_WORDS · ISSUE_LABEL_WORDS · CHARTER_WORDS）

### 7. 维护文档 · 变更集 · 测试 pins 处置
#### 7.1 维护文档 05 §4
- commander 行重准入注记（D11 同源：P5 退役 → 本轮重准入 ^15 · 反转该行 do-not-re-add）· citty 行与其余退役行不动
#### 7.2 合并变更集 major
- 一个 cdd-engine 变更集 · 主题归并：P1 deferred（review face overall 键 · help 重建 · 词表统一）+ P2 deferred（schema gen 模板写作 · 去流程化）+ P3 框架化（commander ^15 · 形面/错误字节更替 · 架构重写）——标 **major**（breaking 段叙事 · 终版 2.0.0 由存量 major 决定 · 不发布）· 存量积压 changesets 留守
#### 7.3 测试 pins 更替面
- 更替（deliberate）：CLI_USAGE 六行字节 pin · help/usage 字面 pin（`"usage: cdd"` ×8 · `"commands:"`/`"subcommands:"` 等 · 程序旗标尾注正则 ×6）· smoke-cdd `usage: cdd implement` 锚 · **verb-less `--help`/`-h` 退出 2→0**（cli.test.ts:563 · missing-command 面字节 → commander 原生程序面帮助 · §3.4）· pre-verb unknown option pin（cli.test.ts:424 `parse(["--root", "x", "implement"])` → unknown option · 归属程序节点校验 · 拒绝语义保 · 字节随 commander 更替）
- 语义保（断言形态更替）：退出码表 · 三 ID did-you-mean 用例 · missing command/unknown option 行为 · bin.test 头断言表 · **missing-required 族**（cli.test.ts:783 `missing required --tasks`/`expected --tasks <n|n,n,…>` · bin.test.ts:65 `missing required --plan`）——语义保 · 字节归属 `.requiredOption()`（`required: true` · §2.1）更替，值域/分布组校验仍留校验组件（§4）

### Acceptance criteria

- `commander ^15 运行时依赖落 cdd-engine package.json（与 simple-git 并列）· 维护文档 05 §4 commander 行重准入注记落（citty 等其余退役行不动）`
- `帮助形面三件套落（命令表短描述 · Usage/Options/Examples 段首 · 描述位序 · commander 原生形态）· 值域并入选项描述（--type/<wave|branch|spec|plan> 等）· 程序旗标尾注（--dry-run · --help/-h）`
- `语义契约回归全绿：退出码 0/1/2（exitOverride）· CDD_BLOCKED 通道 · 裸 cdd usage 退 2（不含 --help/-h · verb-less --help 退 0 更替在册）· did-you-mean 三 ID 用例 = 命令树结构保真（零自定义 hint 码）· --help/-h 任意位置 · 值域/分布组语义 = 校验组件`
- `错误消息/帮助/usage pins 全更替（deliberate）· 自研渲染 + hint 引擎销毁面 grep 零残留（#renderHelp/#nearestFlag/CLI_USAGE 六行等）`
- `ARGV_CHANNEL 单源零平行列表（guard channel-closure 全绿）· 命令树声明投影无手写 parse 残留 · 领域 run 语义零动（引擎 vitest 全绿作证 · 452+ 面）`
- `pnpm exec changeset status 无 empty 条目 · pnpm run validate ALL PASS · EOF 全绿 · 不发布`

## Constraints

- **结构保真**：本骨架 = 声明面派生（`schema gen phase-spec`）· 编辑器只填不重排——违反 = 保真破坏，视为 defect
- **语义契约三保不动**（退出码表 0/1/2 域 · CDD_BLOCKED 通道 · 裸 cdd usage 语义）——commander 原生为形态载体，语义是消费面硬契约；**退出码表更替边界逐条列明**：verb-less `--help`/`-h` 2→0（§3.4/§7.3）· missing-required 字节归属 `.requiredOption()`（§2.1/§7.3）——其余 0/1/2 域不动
- **行为语义零动**：领域 run（Lifecycle/PreFlight/Capsule/host）· doc-contract 判定 · `next:` dispatch 字面 · 跨程序 rename sweep 面
- **数据驱动单源**：ARGV_CHANNEL 行度 → `.option()/.command()` 投影 · 零平行列表 · guard 结构性 pin 保
- **测试 pins 更替 = deliberate**（三 ID 语义回归 pin 保 · 错误消息语义保）——更替面以本设计 §5/§6/§7 为界
- **零运行时依赖变化**（除 commander ^15 · D11 例外）· 维护文档 05 §4 citty 等其余退役行不动
- **变更集 major 归并**（P1/P2 deferred + 框架化 · 存量积压 changesets 留守 · 不发布）
- **gate 零例外**：doc-contract 判定语义不变——骨架 by construction 绿 · 填后终判兜底
- **六前提整 face 许可**（P3 与 P1/P2 同款 · D12）：组合根重建 · OOP 统一零裸函数 · 死码/空壳清理 · 高内聚低耦合 · 消费者心智负担 · 最大精简
- **消费者心智**：cdd 六命令/旗标/值域语义面不动——框架化是引擎内部工程，消费面只感知帮助/错误字节更替

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-10-11 | P3 设计 v0.1——CLI 框架化收口 + 变更集归并：commander ^15 数据驱动单源 · 六前提整 face 重构 · commander 原生为基（Q5）· 语义契约三保（Q6）· 变更集 major（P1/P2 deferred + 框架化归并 · 存量留守 · 不发布） | Oscar M. · Claude Opus 5（kairos:cdd-design [P3] · 2026-10-11） |
| v0.2 | 2026-10-11 | P3 设计 v0.2——spec review round 1 fix：verb-less `--help`/`-h` 退出 2→0 deliberate 更替定裁（§3.3 域限制 · §3.4 · §7.3 · Constraints 退出码表更替边界）· pre-verb 泛型 did-you-mean 候选收窄定裁（§5.3）· 节点绑定规则补（§2.1 · `required: true` → `.requiredOption()` · help 行不投影）· missing-required 族字节归属 `.requiredOption()`（§7.3） | Oscar M. · Claude Opus 5（kairos:cdd-design [P3] · 2026-10-11） |
