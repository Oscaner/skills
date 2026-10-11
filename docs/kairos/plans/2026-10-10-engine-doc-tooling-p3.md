# 引擎文档工具（Engine Doc-Tooling）— P3 实施计划：CLI 框架化收口 + 变更集归并
**Spec:** [2026-10-10-engine-doc-tooling-p3-design.md](docs/kairos/specs/2026-10-10-engine-doc-tooling-p3-design.md)
- **Parent program**: [2026-10-10-engine-doc-tooling-overall](docs/kairos/specs/2026-10-10-engine-doc-tooling-overall.md)
- **Version**: v0.1 · 2026-10-11

## Constraints

- **结构保真**：计划/任务结构 = 声明面派生骨架；编辑器只填不重排
- **语义契约三保不动**（spec §3 · Q6）：退出码表 0/1/2（0 含 `--help` · 更替面仅 §3.4 verb-less `--help` 2→0 + §7.3 missing-required 归属，其余 0/1/2 域不动）· CDD_BLOCKED stderr 通道 · 裸 cdd usage 语义（不含 `--help`/`-h` 退 2）
- **行为语义零动**（spec §1.2）：领域 run（Lifecycle/PreFlight/Capsule/host）内部零动 · doc-contract 判定不变 · `next:` dispatch 字面不变 · 跨程序 rename sweep 面（`src-next` 字面 · D8）
- **数据驱动单源**（spec §2）：ARGV_CHANNEL 行度 → `.option()/.command()` 投影 · 零平行列表 · guard channel-closure（scripts/lib/guard.ts）结构性 pin 保——CLI_COMMANDS 保持可导入、每声明键仍单点声明
- **节点绑定规则**（spec §2.1/F3）：命令级 keys → 该命令节点 `.option()`（`required: true` → `.requiredOption()`）· `scope: "program"` 行 → 程序节点 `.option()` 并随行并入各命令节点（保任意位置接受语义）· help 行（`--help`/`-h`）不投影（对齐 commander 内建 helpOption · 不重复注册）
- **测试 pins 更替 = deliberate**（spec §7.3 清单为准）：三 ID did-you-mean 语义回归 pin 保（零自定义 hint 码 · 结构保真）· 错误消息语义保 · 帮助/usage 字面 pins 更替为新 commander 原生形面（T6 独占）
- **零运行时依赖变化**（除 commander ^15 · D11）：维护文档 05 §4 commander 行重准入注记 · citty 等其余退役行不动
- **变更集**（spec §7.2 · T8）：一个 cdd-engine 合并变更集标 **major**——P1 deferred（review face overall 键 + help 重建 + 词表统一）+ P2 deferred（schema gen + 去流程化）+ P3 框架化（commander ^15 · 形面/错误字节更替 · 架构重写）主题归并 · 存量积压 changesets 留守 · 不发布
- **六前提整 face 许可**（D12）：组合根重建 · OOP 统一零裸函数 · 死码/空壳清理 · 高内聚低耦合 · 消费者心智负担 · 最大精简——销毁面以 spec §6 为界（自研渲染 + hint 引擎 + argv parse 通道删除 · 域词表保留）
- **消费者心智**：cdd 六命令/旗标/值域语义面不动——框架化是引擎内部工程，字节更替以 §5/§6/§7 为界

### Task 1: commander ^15 运行时依赖 + 维护文档 05 §4 注记
- **Objective**: cdd-engine 声明并安装 commander ^15（零运行时依赖姿态的 D11 例外）· 维护文档同步重准入注记；T4 起可 `import { Command } from "commander"`。
- **Files**: Modify `packages/cdd-engine/package.json` · `pnpm-lock.yaml`（命令产物）· `docs/maintainers/05-third-party-dependencies.md` §4 · （若存在）依赖面/pin 断言测试
- **Consumes**: —（根任务 · 无需前序）
- **Produces**: `commander@^15` 声明依赖（`dependencies` 与 `simple-git ^4.0.2` 并列）· 05 §4 commander 行重准入注记（反转该行 do-not-re-add · citty 行与其余退役行不动）· 依赖面断言（若 grep `zero-dep|simple-git` 于 `packages/cdd-engine/src-next` 命中依赖面 pin 测试）允许 ruler ^15 例外面外
- **Steps**:
  - `pnpm --filter @oscaner-skills/cdd-engine add commander@^15` 并落 lockfile —— checkable: `packages/cdd-engine/package.json#dependencies` 含 `"commander": "^15.*"`；`git status` 只见 package.json + lockfile 变更
  - `grep -rn "zero-dep\|simple-git" packages/cdd-engine/src-next` 定位依赖面 pin 断言（若有）；其豁免面增扩 commander ^15 —— checkable: 命中测试允许 commander；未命中则跳过
  - 编辑 `docs/maintainers/05-third-party-dependencies.md` §4 commander 行：P5 退役 → **本轮重准入 ^15**（注记 D11 同源 · 反转 do-not-re-add）；citty 行等其余退役行一字不动 —— checkable: §4 commander 行含「re-admitted」语义注记；`git diff` 仅 commander 行 + 无他行改动
  - 运行 `node packages/cdd-engine/src-next/bin.ts --help`（旧形面基线）—— checkable: 仍输出自研形面（T4 前不破）
- **Acceptance**: 依赖声明 + lockfile 绿 · 05 §4 注记落（citty 不动）· 现有引擎 vitest 全绿（未触碰面零回归）
- **DependsOn**: none

### Task 2: 校验组件（ValueValidator · 域语义收口）
- **Objective**: commander 原生不接的域语义独立成类——值域 enum · int-list · 8-char sha · 整数 · 分布组取一；错误进入 usage 域（供 T4 归一退 2）。从 `face/argv.ts` 现有 `#validate`/required 语义移植，T7 删除 parse 通道时保留本组件。
- **Files**: Create `packages/cdd-engine/src-next/face/validate.ts` · `packages/cdd-engine/src-next/face/__tests__/validate.test.ts`
- **Consumes**: `ChannelValueType`/`ChannelArg`（`infra/runtime.ts` ARGV_CHANNEL 类型）
- **Produces**: `class ValueValidator` —— `enum(values: readonly string[], raw: string): string`（域外值 ∈ usage 域错）· `intList(raw: string): number[]`（`n|n,n,…` · 非格式 → usage 域错）· `sha8(raw: string): string`（恰好 8 位 hex）· `int(raw: string): number`· `distribution(groups: Set<flag>, declared: Set<flag>): void`（review/fix 的 `--plan` / `--spec` / `--base --head` 取一语义 —— 三组互斥 · 至少一组）；错误消息引擎自持（值域/分布组语义字节 · spec §4/§7.3 归属校验组件）
- **Steps**:
  - 写 `validate.test.ts` 红用例：enum 接受/域外拒绝 · intList `1,2,3` 接受 / `abc` 拒绝 · sha8 `abcdef12` 接受 / `abc`、`zxyz` 拒绝 · int 接受/拒绝 · distribution（`--spec` 单组过 · `--plan --spec` 冲突拒 · 全空拒）—— checkable: 新测试 FAIL（类不存在）
  - 实现 `ValueValidator`（各方法值/域判 · 错误带 usage 分类标记——`isUsage: true` 面）—— checkable: 新测试 PASS
  - 运行 `node --experimental-strip-types --test` 或 vitest 文件级跑子—— checkable: validate.test.ts 全绿
- **Acceptance**: 五规则全测试绿 · 错误分类统一 usage 域（供 T4 退出归一）
- **DependsOn**: none

### Task 3: 声明投影（buildProgram · 数据驱动单源）
- **Objective**: 声明 → commander 程序构建器：CLI_COMMANDS 行 + ARGV_CHANNEL 行 → commander `Command` 树（§2.1 绑定规则 · §2.3 leaf 子命令）；T4 组合根消费其结果。CLI_USAGE 六行字面**只在此处退役**（描述/usage 语义并入投影 · 不另建平行列表）。
- **Files**: Create `packages/cdd-engine/src-next/face/projection.ts` · `packages/cdd-engine/src-next/face/__tests__/projection.test.ts` · Modify `packages/cdd-engine/src-next/face/registry.ts`（CLI_USAGE 行删除 · CLI_COMMANDS 行保留为声明源）
- **Consumes**: `CLI_COMMANDS`/`CliCommandSpec`/`CliLeafSpec`（`face/registry.ts`）· `ARGV_CHANNEL`/`ChannelArg`（`infra/runtime.ts`） · `Command`（commander ^15 · T1）
- **Produces**: `buildProgram(): Command` —— 顶层 `cdd` 程序 · 六命令 `.command(name)`（`description` 来自 CLI_COMMANDS 行 description）· leaf 子命令（base set|get · schema get|gen · issue render）嵌套 `.command()`；**绑定规则**：命令级 `keys` → 该命令节点 `.option()`（`required: true` → `.requiredOption()`）· `scope: "program"` 行 → 程序节点 `.option()` 且**随行并入每命令节点的 `options` 接受面**（任意位置语义 · 不重复注册）· help 行（`--help`/`-h`）不投影（内建 helpOption 默认）；选项描述/值域按 §5.2 合成（`--type <wave|branch|spec|plan>` 形态）
- **Steps**:
  - 写 `projection.test.ts` 红用例：六命令存在 · review 节点含 `--type`/`--tasks`/`--plan`/`--spec`/`--base`/`--head`/`--round`/`--root`（命令级 keys → `.option()`）· `--type` 为 `.requiredOption()`（`required: true`）· program 节点含 `--dry-run`/`--no-dry-run`（scope:program）· 各命令节点可用 `--dry-run` · `-h`/`--help` 未重复注册（helpOption 内建）· base 节点有 `set`/`get` 子命令且各持自身 keys（set 含 `--force` · get 不含）· schema 有 `get`/`gen` · issue 有 `render`—— checkable: FAIL
  - 实现 `buildProgram()` 于 `projection.ts`（遍历 CLI_COMMANDS × ARGV_CHANNEL · 绑定规则）；删 `registry.ts` CLI_USAGE 六行（guard/argv 引用同步改调 projection 产物）—— checkable: projection.test.ts 全绿
  - 运行 `grep -rn "CLI_USAGE" packages/cdd-engine/src-next` —— checkable: 零命中（argv.ts 的 parse 通道 T7 才删——若 argv.ts 仍引用 CLI_USAGE 先引 projection 提供等价 usage 面）
  - 运行引擎 vitest 既有面 —— checkable: 除 T6 清单内旧形面 pins 外全绿（T3 不应引入破坏 · 若 cli.test.ts 因 CLI_USAGE 删除 break · 属预期 subset）
- **Acceptance**: 绑定规则测试全绿 · CLI_USAGE 零引用（argv parse 通道内旧引用在 T4 落定）
- **DependsOn**: 1

### Task 4: 组合根重建（commander 管线 + .action 薄壳 + 退出归一）
- **Objective**: `cli.ts` 组合根从手写 parse/help 迁到 T3 程序 + T2 校验 + 领域 run——`runArgv` 公共入口签名不变（bin.ts/tests/guard 消费面不动）；退出码 0/1/2 归一（§3.1）· 裸 cdd usage（§3.3）· verb-less `--help` → 0（§3.4）· CDD_BLOCKED 路径零动（§3.2）。
- **Files**: Modify `packages/cdd-engine/src-next/face/cli.ts`（组合根 · 大改）· `packages/cdd-engine/src-next/face/argv.ts`（parse 通道保留至 T7 · 先供 validator 隔离）· bin.ts 不改
- **Consumes**: `buildProgram()`（T3）· `ValueValidator`（T2）· 领域 run（`Lifecycle`/`PreFlight`/`Capsule`/`host` · 零动）· `runArgv` 既有公共入口
- **Produces**: `Cli#runArgv(argv: string[]): Promise<number>` 行为面——program.parse 前 `--help`/`-h` 任一 → 打印对应对面帮助 · 退 0；bare `cdd`（无命令无旗标）→ commander 原生程序面帮助 + missing-command 错误 · **退 2**（§3.3 · 字节 commander 原生）；`.action(opts)` 薄壳 → `ValueValidator` 域校验 → 领域 run（`#runWork`/`#runSchema`/`#runSchemaGen`/`#runBase`/`#runIssue` 对应物——`--dry-run` 合成批准路径同现语义）· 运行失败 → 1；`exitOverride` 归一：usage 域错 → 2 · 运行失败 → 1 · help → 0；CDD_BLOCKED stderr 通道输出面原样（Capsule）
- **Steps**:
  - 写行为探针红用例（`cli.test.ts` 新块或独立 describe）：`runArgv([])` → 2 且 stdout 含 commander 程序面帮助 + missing-command；`runArgv(["--help"])` → **0**（§3.4 翻转）· stdout 程序面帮助；`runArgv(["review", "--type", "bogus"])` → 2（枚举域错 · usage 域）；`runArgv(["schema", "get", "phase-spec"])` → 0 且 stdout 含 schema 声明；`runArgv(["base", "get", "--plan", "<tmp plan>"])` → 0 域读路径；`runArgv(["review", "--type", "spec", "--dry-run", ...])` → 合成批准路径成型（dry-run 不 spawn）—— checkable: FAIL
  - 重写 `cli.ts` 组合根：T3 程序装配 → T2 校验接线 → `.action` 薄壳 → 领域 run 调用；删除原 runArgv 内手写 parse/help/错误归一通路（保留公共签名与领域 run 引用）—— checkable: 行为探针 PASS
  - 运行引擎 vitest 既有面—— checkable: 除 T6 清单（旧 help/usage 字面 · verb-less --help 2 pin · missing-required 字节）外全绿；CDD_BLOCKED 路径（脏树/无 host/doc-contract 拒绝）零动
- **Acceptance**: 行为探针绿 · 退出码表语义 ✅（0=help/OK · 2=usage · 1=运行失败）· 领域 run 实径（schema get/base get/dry-run review）成型 · bin.ts 入口不变
- **DependsOn**: 2, 3

### Task 5: 帮助形面三件套 + 值域描述 + smoke 锚
- **Objective**: commander 原生帮助形面落地（§5）——命令表短描述 · Usage/Options/Examples 段首 · 描述位序 · 值域并入选项描述 · 程序旗标尾注；`smoke-cdd.ts` 稳定锚更替。
- **Files**: Modify `packages/cdd-engine/src-next/face/cli.ts`（帮助装饰：`.description`/`.addHelpText`/选项描述合成）· `scripts/smoke-cdd.ts`（第 121 行锚）· 新帮助形面断言（`cli.test.ts` 帮助 describe 块）
- **Consumes**: T4 组合根 · `buildProgram` 描述面（T3 投影的 description 字串）
- **Produces**: `cdd --help` = commander 原生布局：`Usage: cdd [options] [command]` · `Commands:` 表（六命令短描述 = CLI_COMMANDS 行 description 投影）· `Options:`（程序作用域 `--dry-run`/`--no-dry-run` 等）· `.addHelpText('before'|'after')` 注入 Examples 段（沿用 P1 例句：`cdd review --type spec --spec docs/...` 等）与程序旗标尾注（`--dry-run · --help / -h` 形态）· 各命令/子命令 `--help` 原生输出；选项描述含值域（`--type <wave|branch|spec|plan>` … §5.2）· 描述位序 = ARGV_CHANNEL 行序注册（现命令表序）；`smoke-cdd.ts` 锚 → 新稳定字面（如 `Usage: cdd` + 命令表 `implement`/`review`/`fix` 行）
- **Steps**:
  - 写帮助形面断言红用例：`cdd --help` 含 `Usage: cdd` · `Commands:` · `implement`/`review`/`fix`/`base`/`schema`/`issue` 短描述行 · 选项含 `<wave|branch|spec|plan>` 值域（review 面）· Examples 段首在册 · 程序旗标尾注 `--dry-run`/`--help`/`-h`；子命令面（`schema --help` 含 `get`/`gen` · `base get --help` 含 `--plan` 且**不含** `--force`）—— checkable: FAIL
  - 实现在 cli.ts（命令/选项描述投影 + addHelpText 三段注入 + 尾注）—— checkable: 断言 PASS
  - `scripts/smoke-cdd.ts` 第 121 行锚更替为新形面稳定字面—— checkable: `node scripts/run.ts smoke-cdd` 绿（程序既有 smoke 通道）
- **Acceptance**: 三件套断言绿（命令表短描述 · 段首 · 位序 · 值域 · 尾注）· leaf 面不泄漏 sibling options（`base get` 无 `--force`）· smoke 绿
- **DependsOn**: 4

### Task 6: 测试 pins 更替 + 语义回归 pin（deliberate · §7.3）
- **Objective**: 旧 help/usage 字面 pins 整体更替为新 commander 原生形面 · 语义回归 pin 保（get/set leaf 粒度 · 三 ID 用例 · 错误消息语义 · 退出码表）；T4/T5 期间预期红的旧 pins 在此归拢翻绿。
- **Files**: Modify `packages/cdd-engine/src-next/face/__tests__/cli.test.ts`（更替清单内 pin 行）· `packages/cdd-engine/src-next/__tests__/bin.test.ts`
- **Consumes**: T5 定型形面（新字节唯一真源）
- **Produces**: 更替（deliberate）——CLI_USAGE ×6（消除）· `"usage: cdd"` ×8 · `"commands:"`/`"subcommands:"` · 程序旗标尾注正则 ×6 → 新原生字面 · `smoke-cdd` 锚已 T5 更替 · verb-less `--help`/`-h` 2→0（cli.test.ts:563 旧 pin → 0 断言）；**语义回归 pin（保）**——退出码表（bin.test 头断言）· 三 ID did-you-mean：`base get --forc` 无 suggestion · `base set --forc` → did you mean `--force`? · `implement --spel` 无 `--spec` 提示 · pre-verb `--taks`（程序 face unknown option）→ 候选收窄至程序作用域（**无 `--tasks` 提示** · §5.3 选边）· `missing required --tasks`/`--plan` 语义（字节 = `.requiredOption()` 原生形态）· unknown option/command 行为 · 裸 cdd missing-command 行为
- **Steps**:
  - 逐条更替 cli.test.ts 更替面 pins（旧字面 → T5 原生活面字面）—— checkable: 每更替断言绿
  - 重锚语义回归 pin（三 ID · pre-verb 收窄 · missing-required `.requiredOption()` 字节）—— checkable: 语义断言绿且无死胡同（get 面不引 sibling）
  - bin.test.ts 退出码表 + usage/错误断言按新形面更替 —— checkable: bin.test.ts 全绿
  - 运行 `node packages/cdd-engine/src-next/bin.ts --help` 与全 cli.test.ts —— checkable: 帮助输出与断言字节一致 · 全文件绿
- **Acceptance**: cli.test.ts + bin.test.ts 全绿（旧形面字面零残留 · 语义用例保行为）
- **DependsOn**: 5

### Task 7: 销毁面 + 全量校验（§6）
- **Objective**: 自研渲染 + hint 引擎 + argv parse 通道删除（最大精简）· 残留 grep pin 落 · guard channel-closure 全绿 · 引擎 vitest + validate 全量绿。
- **Files**: Modify `packages/cdd-engine/src-next/face/cli.ts`（删渲染/提示方法）· `packages/cdd-engine/src-next/face/argv.ts`（parse 通道删除 · 保留并被引用的 ValueValidator 隔绝——如已移入 T2 则文件瘦身为位或删）· `packages/cdd-engine/src-next/face/words.ts`（帮助面向词表行删除 · 域词表 CAPSULE_WORDS/GUARD_BAN_WORDS/ISSUE_LABEL_WORDS/CHARTER_WORDS 保留）· `packages/cdd-engine/src-next/face/registry.ts`（CLI_COMMANDS 保留 · 已 T3 删 CLI_USAGE）
- **Consumes**: T6 稳定面
- **Produces**: `#renderHelp`/`#optionLines`/`#overview`/`#typeDomain`/`#leafTokens`/`#domainOf` 删除 · `#usageHint`/`#nearestFlag`/`#distance` 删除 · `CliUsageError.surface` 字段删除（did-you-mean 落 commander）· argv parse 通道删除（tokenize/help 预扫/required 扫描整体退役 · ValueValidator 承接语义）· words.ts 帮助词表归一入声明；**残留 pin**：`grep -rn "#renderHelp\|#nearestFlag\|#usageHint\|#optionLines\|#overview\|CLI_USAGE"` 于 src-next 零命中 · guard channel-closure（checkChannels）全绿
- **Steps**:
  - 删除 cli.ts 渲染/提示方法组与 surface 字段；argv.ts parse 通道退役（ValueValidator 承接校验）—— checkable: 残留 grep 零命中（除 T2 validate.ts 允许面）
  - words.ts 帮面向词表行删除（域词表保留）—— checkable: 引用的域词表测试全绿
  - 运行 `pnpm --filter @oscaner-skills/cdd-engine test`（vitest run · 引擎套件）—— checkable: 全绿（含 T2/T3/T4/T5/T6 新增）
  - 运行 `node scripts/run.ts validate` —— checkable: ALL PASS 退出 0（emit 裸检 · kairos guards（channel-closure 含）· vitest · marketplace · 版本同步）
- **Acceptance**: 残留 grep 零命中 · guard channel-closure 绿 · 引擎 vitest 全绿 · `pnpm run validate` ALL PASS
- **DependsOn**: 6

### Task 8: 合并变更集（major）+ EOF 收尾
- **Objective**: 一个 cdd-engine 合并变更集落 `.changeset/`——三主题归并 · **major**（breaking 段叙事）· 不发布；库存健康（无 empty · 存量积压留守）。
- **Files**: Create `.changeset/<slug>-engine-cli-framework.md`
- **Consumes**: T7 终态
- **Produces**: changeset frontmatter `"@oscaner-skills/cdd-engine": major` · 主题归并：**P1 deferred**（review face overall 键 · help 展示面重建 · docKey 词表统一）+ **P2 deferred**（schema gen 模板写作 · CLAUDE.md 去流程化）+ **P3 框架化**（commander ^15 重准入 · 帮助/错误字节 commander 原生更替 · 组合根架构重写 · 适配层语义契约三保）——breaking 段如实叙事 · 存量积压 changesets 原样
- **Steps**:
  - 手写 `.changeset/<slug>-engine-cli-framework.md`（frontmatter major + 三主题 breaking/feature 叙事 · EOF 恰一个 `\n`）—— checkable: `tail -c 1` 为 `\n` 且无尾随空行
  - `pnpm exec changeset status` —— checkable: 无 empty/无效条目 · 退出 0
  - 终验 `pnpm run validate` + `node packages/cdd-engine/src-next/bin.ts --help` 抽查 —— checkable: ALL PASS 退出 0 · 形面为新 commander 原生活
- **Acceptance**: changeset status 无 empty · 合并变更集 major 主题完整（三主题 + breaking 段）· validate ALL PASS · EOF 全绿 · 不发布
- **DependsOn**: 7

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-10-11 | P3 实施计划 v0.1——CLI 框架化收口 + 变更集归并：8 任务波次链（T1 依赖/文档 → T2 校验组件 ‖ T3 声明投影 → T4 组合根重建 → T5 帮助形面 → T6 pins 更替 → T7 销毁面+全量校验 → T8 合并变更集）· 任务面 = spec v0.2 §2–§7 · 约束面 = spec Constraints | Oscar M. · Claude Opus 5（kairos:cdd-plan · 2026-10-11） |