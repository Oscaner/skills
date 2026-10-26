---
title: 引擎文档工具（Engine Doc-Tooling）— P20 实施计划：`cdd init` harness bootstrap
doc-type: plan
version: v0.2
date: 2026-10-26
slug: 2026-10-10-engine-doc-tooling-p20
base: develop
---

## Constraints

- **逐字取 spec**：本计划只实现 `docs/kairos/specs/2026-10-10-engine-doc-tooling-p20-design.md` v0.5 已批准的面。表头两标签 `Claude Code` / `Pi`、`SPAWN_FAILURE_CODE = 127`、step 头形态 `init[<i>/<n>] <harness> · <pkg> · <argv.slice(1).join(" ")>`、失败报文两行、`PLUGINS` 行序（superpowers → mattpocock-skills → kairos）均为 spec 定值，实现期不得改写。
- **零新增运行时依赖**：只用已在册的 `commander` / `execa`；不为安装面引入 step-UI / 表格库。
- **零裸函数**：新增面全部是类 / 类型 / 常量数据（`CliInit` · `ExecaStepRunner` · `PLUGINS` · `HOST_IDS`）；`check:no-bare-functions` 必须零命中。
- **单源纪律**：命令字节只在 `PLUGINS`；`--harness` 值域只读 `HOST_IDS`；命令枚举只读 `CLI_COMMANDS`；README 与 pin 都是**渲染面 + 门**，不存第二份真源。`argv` 里的 `claude` / `pi` 是命令字面本身，不是 host 词表副本。
- **删除即删除**：`INSTALL_ROWS` / `HostRow.install` / `infra/process.ts`（`ProcessRunner`）本 phase 退净，不留兼容层、不留「将来可能用」的壳。
- **不碰 dispatch 执行机器**：`face/termination.ts` 的超时 / 预算 / 组杀 / 心跳 / stall 判官零改；`init` 的执行面是独立窄缝。
- **repo 无关面**：`init` 不过 `#rootOf()`、不建 `.kairos/`、不写 ledger、不读文档；同时**拒绝** `--dry-run`（`#assertDryRunScope`，usage 退 2）—— 预览旗标下零 spawn。
- **冻结面**：`contract/` 的 `project.ts:318`（投影方法计数）与 `render/skeleton.ts:197,455`（task 字段计数）的 `seven` 与命令面无关，零改；`face/__tests__` 内 7 处 `["claude", "pi"]` 字面是测试夹具，保留。
- **调用纪律**：引擎一律本地 `node packages/cdd-engine/src-next/bin.ts`；内部文档中文主源（Strategy B），消费面 README 英主源 + zh 镜像同步。
- **提交门禁**：每任务提交过 `pnpm run precommit`；Task 6 收尾跑 `pnpm run validate` 全量。不发布、不打 tag。

### 未覆盖输入面（Review Focus — 逐条已钉测试或明确不做）

- **非 TTY / 管道下的 harness 交互提示**：引擎零预判（spec §2.6）——该步非零即走既有失败面、harness 报文原样透出，**明确不做**。
- **`--update` 与 `--dry-run` 同现**：`--dry-run` 在 `CliInit` 之前被 `#assertDryRunScope` 拒（usage 退 2），由 **Task 2 Step 8** 的用例覆盖（替身 `calls` 为空、零 spawn）。
- **重复执行 `init` 的幂等**：交给 harness 自己（spec §2.2，实测 add / install 幂等退 0），引擎零预检、零跳过——**明确不做**。
- **序列中途 SIGINT / Ctrl-C**：步骤串行、无清理面、无 ledger 写入——**明确不做**。
- **`cdd init <positional>` 用法错**：commander 原生退 2（零声明位置参数），不入自研校验——**明确不做**。

### Task 1: 命令数据面归一（`face/plugins.ts` · `HOST_IDS` · 两处死亡声明退役）

- **Objective**: 把「往 harness 里装什么」从两个半死声明（claude 专用 `INSTALL_ROWS` + 零读者的 `HostRow.install`）归一到一个包为轴的单一表 `PLUGINS`，并让 host 词表只有 `HOST_IDS` 一个源（`HostId` 由它派生、`Hosts` 键集由 `satisfies` 锁死、`--harness` 值域与 `HostDetect.detect` 遍历都读它）。
- **Files**: Create `packages/cdd-engine/src-next/face/plugins.ts`; Modify `packages/cdd-engine/src-next/face/host.ts`（`+HOST_IDS` / `HostId` 派生 · `−INSTALL_ROWS` · `−HostRow.install` · `HostDetect.detect` 遍历改读 `HOST_IDS`）; Delete `packages/cdd-engine/src-next/face/__tests__/install-rows.guard.test.ts`; Test Create `packages/cdd-engine/src-next/face/__tests__/plugins.test.ts` · Modify `packages/cdd-engine/src-next/face/__tests__/host.test.ts`
- **Consumes**: spec §3.1（`PLUGINS` 形状 + 九条 install / 九条 update 命令行）· §2.1 的 `HOST_IDS` 单一源行 · §3.2 的两处退役。
- **Produces**:
  ```ts
  export type Command = readonly string[];
  export interface PluginCommands { readonly install: readonly Command[]; readonly update: readonly Command[]; }
  export type PluginRow = { readonly name: string } & Readonly<Record<HostId, PluginCommands>>;
  export const PLUGINS = [superpowers, mattpocockSkills, kairos] as const satisfies readonly PluginRow[];
  // 序即执行序：superpowers · mattpocock-skills · kairos；`satisfies` 让列集合随 HostId 自动闭合（缺列 = 编译失败）
  export const HOST_IDS: readonly ["claude", "pi"];         // host.ts
  export type HostId = (typeof HOST_IDS)[number];           // host.ts，删手写联合
  ```
- **Steps**:
  - 写失败测试 `plugins.test.ts`（结构 pin）：`PLUGINS.map((r) => r.name)` 精确等于 `["superpowers", "mattpocock-skills", "kairos"]`；每行除 `name` 外的键集精确等于 `[...HOST_IDS]`；`row[id].install.length === row[id].update.length`（同形态同步数）；`row.claude.install` 恒 2 条、`row.pi.install` 恒 1 条 —— checkable: FAIL（模块不存在）
  - 写失败测试 `plugins.test.ts`（字节 pin，两形态各自独立）：逐行断言 9 条 update argv 精确等于 spec §3.1 表格的 update 列，**同一用例**再逐行断言 9 条 install argv 精确等于该表 install 列 —— 数据面自钉，不靠 Task 4 的 README 门反向覆盖（那道门的期望值由 `PLUGINS` 现算、实测值来自 Task 3 手抄的 README 单元格，同源同错时照绿）—— checkable: FAIL
  - 写失败测试 `plugins.test.ts`（零 shell）：遍历全部 18 条 argv，`argv[0] === HOSTS[id].cli` 且 `argv` 不含 `"-c"` / `"sh"` —— checkable: FAIL
  - 编译期 pin（列闭合，零指令）：`PLUGINS` 的声明形即 `as const satisfies readonly PluginRow[]`；新增第三个 `HostId` 时每行因缺该列**编译失败**，正是要的列闭合。断言面不落 `@ts-expect-error` 夹具——该词在 `face/words.ts:187` 的 `GUARD_BAN_WORDS.stale` 里，`words.guard.test.ts` 扫 `src-next/` 全域 `.ts`（含 `face/__tests__/`），只有 `face/words.ts` / `face/host.ts` 两个 release home 的引号数据行放行；新 `plugins.test.ts` 不在名单，一行即红，任何形态都不得出现。行为面的键集 pin 由 Step 1 的运行时断言（`Object.keys(row).filter((k) => k !== "name")` === `[...HOST_IDS]`）承担 —— checkable: 删一行的一个 host 列 → `pnpm run typecheck` 红；复原 → 绿
  - 写失败测试 `host.test.ts`（detect 单源行为）：对 `HOST_IDS` 迭代，用该 host 自己的 `HOSTS[id].detect` 行构造 env（`env[row.env] = row.value ?? (row.aiAgentPrefix ? `${row.aiAgentPrefix}-x` : "x")`），断言 `HostDetect.detect(env) === id` —— checkable: FAIL / PASS（该用例证明的是「每个 host 自己的 detect 行都能识别该 host」，**不是**「遍历读 `HOST_IDS`」—— 本 phase 只有两个 host，`for (const id of ["claude","pi"] as const)` 与 `for (const id of HOST_IDS)` 的可观测行为完全相同；遍历的单源判据由 Acceptance 的 grep 承担）
  - 实现 `plugins.ts`：九条 install 与九条 update 按 spec §3.1 表格逐字落 argv tuple（claude 每包两条：`marketplace add` → `plugin install`；update 面 `marketplace update <marketplace>` → `plugin update <plugin@marketplace>`；pi 每包一条）—— checkable: 前三个用例转绿
  - 实现 `host.ts`：`HOST_IDS` + 派生 `HostId`，`HOSTS` 保持 `satisfies Readonly<Record<HostId, HostRow>>`；删 `INSTALL_ROWS` 与 `HostRow.install` 字段；`HostDetect.detect` 的 `for (const id of ["claude", "pi"] as const)` 改 `for (const id of HOST_IDS)` —— checkable: detect 用例转绿
  - 删除 `install-rows.guard.test.ts`（其断言面由 Task 4 的 `plugins.guard.test.ts` 接管）—— checkable: `pnpm -C packages/cdd-engine test` 无 import 失败
  - 跑 `pnpm -C packages/cdd-engine test` 与 `pnpm run typecheck`—— checkable: 全绿（`host.ts` 内 `INSTALL_ROWS` / `.install` 零残留）
  - 提交：`git commit -m "refactor(cdd-engine)!: single-source the plugin roster on PLUGINS + HOST_IDS"` —— checkable: `pnpm run precommit` 过
- **Acceptance**: `plugins.test.ts` 四用例绿（行序 / 两形态步数 / install + update 双字节 pin / 零 shell）· `host.test.ts` 的 per-host detect 迭代绿 · `packages/cdd-engine/src-next` 非测试面 `grep -rn "INSTALL_ROWS\|\.install\b"` 零命中（`plugins.ts` 的 `install` 字段本身除外）· 生产面 host 字面零副本：`grep -rnE '\["claude", "pi"\]' packages/cdd-engine/src-next --include='*.ts' | grep -v __tests__` 零命中（`face/__tests__` 内 7 处夹具保留）· engine 套件与 `typecheck ×3` 绿。
- **DependsOn**: none

### Task 2: `cdd init` 第八命令（`init.ts` · declare/cli 接线 · 结构 pin 重锚 · `ProcessRunner` 退役）

- **Objective**: 落地 `cdd init --harness=<claude|pi> [--update]`：第八个顶层动词，真 spawn 该 harness 自己的安装 / 更新序列（`stdio: "inherit"` 三流继承、串行、首败即停、`127` spawn 失败码），repo 无关且拒绝 `--dry-run`；同时把「命令数 七 → 八」的结构 pin 与注释一次改到底。本任务**两次提交**：先 `refactor(cdd-engine)!: retire the unused ProcessRunner seam`（死码清偿），再 `feat(cdd-engine)!: add cdd init for harness plugin bootstrap`（命令 + 接线 + 结构 pin）—— 两者形态互不替代（spec §2.3：缓冲捕获 vs inherit 流式），任一半可被单独否掉。
- **Files**: Create `packages/cdd-engine/src-next/face/init.ts` · `packages/cdd-engine/src-next/face/__tests__/init.test.ts`; Modify `packages/cdd-engine/src-next/face/declare.ts`（`ARGV_CHANNEL` + `harness` / `update` · `CLI_COMMANDS` + `init` · `CliVerb` += `init` · 注释 `seven`→`eight`）· `packages/cdd-engine/src-next/face/cli.ts`（`#init` 装配 + `.action` 薄壳 + 注释 `seven`→`eight`）· `packages/cdd-engine/src-next/face/projection.ts`（注释 `seven`→`eight`，逻辑零改）· `packages/cdd-engine/src-next/face/__tests__/cli.test.ts`（结构 pin 重锚 + init 接线用例）· `packages/cdd-engine/src-next/face/__tests__/projection.test.ts`（七→八）· `packages/cdd-engine/src-next/infra/__tests__/infra.test.ts`（删 `ProcessRunner` 用例）; Delete `packages/cdd-engine/src-next/infra/process.ts`
- **Consumes**: Task 1 的 `PLUGINS` / `HOST_IDS` / `PluginCommands`；`face/artifacts.ts` 的 repo 无关薄壳形态（`issue render` 先例）；`face/cli.ts:474` 的 `#assertDryRunScope`。
- **Produces**:
  ```ts
  export const STDIO = "inherit" as const;                                  // execa 三流继承的唯一落点
  export const SPAWN_FAILURE_CODE = 127;                                    // spawn 失败码
  export interface StepRunner { run(argv: readonly string[]): Promise<number>; }
  export class ExecaStepRunner implements StepRunner { /* execa(argv, { stdio: STDIO })，ENOENT → SPAWN_FAILURE_CODE */ }
  export interface CliInitOptions { io: CliIo; runner: StepRunner; header: (line: string) => void; }
  export class CliInit { constructor(opts: CliInitOptions); async run(host: HostId | undefined, update: boolean): Promise<number>; }
  // run 首行：if (host === undefined) this.#usage(...) —— commander 之后的最后一道防线（`--harness` 在类型面仍是 HostId | undefined）
  // cli.ts：`CliOptions` 增 `initRunner?: StepRunner` / `initHeader?: (line: string) => void`（测试注入缝）；
  //          `RunInput` 增 `harness?: HostId` / `update?: boolean`（`#runInput` 从 commander opts 读出的已归一值）；
  //          `#runInput` 的收窄：harness = HOST_IDS.find((id) => id === raw)（禁 `as HostId` 断言），update = globals.update === true
  // declare.ts：ARGV_CHANNEL.harness = { flag: "--harness", type: "enum", values: HOST_IDS, help: … }
  //            ARGV_CHANNEL.update  = { flag: "--update", type: "bool", help: … }
  ```
- **Steps**:
  - 第一次提交（死码退役，先落一次独立的绿）：删 `packages/cdd-engine/src-next/infra/process.ts` 与 `packages/cdd-engine/src-next/infra/__tests__/infra.test.ts` 里的 `ProcessRunner` 用例 → `git commit -m "refactor(cdd-engine)!: retire the unused ProcessRunner seam"` —— checkable: `grep -rn ProcessRunner packages/cdd-engine/src-next` 零命中 且 `pnpm -C packages/cdd-engine test` 绿
  - 写失败测试 `init.test.ts`（序列，替身 runner）：
    ```ts
    class RecordingRunner implements StepRunner {
      readonly calls: (readonly string[])[] = [];
      readonly code: number;
      constructor(code = 0) { this.code = code; }
      async run(argv: readonly string[]): Promise<number> { this.calls.push(argv); return this.code; }
    }
    ```
    （夹具用显式字段 + 构造器体赋值：两个 tsconfig 都开了 `erasableSyntaxOnly: true`（`packages/cdd-engine/tsconfig.json:17` · `packages/kairos/tests/tsconfig.json:9`），`constructor(private readonly code = 0)` 这类参数属性不可擦除 → `TS1294`；全仓现零参数属性。）
    claude install → `calls` 展平后精确等于 `PLUGINS.flatMap((r) => r.claude.install)`；pi install 同理 —— checkable: FAIL（`init.ts` 不存在）
  - 写失败测试（`--update` 走 update 序列）：`calls` 精确等于 `PLUGINS.flatMap((r) => r.claude.update)`，且 `calls` 里零条来自 `install` —— checkable: FAIL
  - 写失败测试（首败即停 + 报文两行）：runner 头两次返回 0、第三次返回 9 → `run()` 返回 1，`calls.length === 3`，`io.stderr` 收到 `init[3/6] · claude plugin marketplace add mattpocock/skills · exit 9`；`--update` 形态再断言第 2 行 `if the package is not installed, run cdd init --harness=claude without --update first` 存在、非 `--update` 形态零第 2 行 —— checkable: FAIL
  - 写失败测试（step 头形态 + 同步写 seam）：`header` 收集到的第一行精确等于 `init[1/6] claude · superpowers · plugin marketplace add obra/superpowers-marketplace`，第 2 行等于 `init[2/6] claude · superpowers · plugin install superpowers@superpowers-marketplace`（同包两行不同字节）；全绿时 `header` 末行为 `init: 6 steps ok (claude · install)`；pi 面 `/3` —— checkable: FAIL
  - 写失败测试（真 spawn，不伪造）：`new ExecaStepRunner().run([process.execPath, "-e", "process.exit(3)"])` 返回 3；`run(["cdd-no-such-binary-" + Date.now(), "x"])` 返回 `SPAWN_FAILURE_CODE`（127）；`STDIO === "inherit"` —— checkable: FAIL
  - 实现 `init.ts`：`CliInit.run` 按 `PLUGINS` 展平出生序 → 逐条 `header(...)` 同步写 → `runner.run(argv)` → 非零即停并写失败报文 → 全绿写汇总行；`ExecaStepRunner` 用 `execa(argv, { stdio: STDIO, reject: false })` 并对 spawn 失败（无 `exitCode`）返回 `SPAWN_FAILURE_CODE` —— checkable: 上述用例转绿
  - 实现 `declare.ts`：`ARGV_CHANNEL` 增 `harness`（`type: "enum"`, `values: HOST_IDS`）与 `update`（`type: "bool"`）；`CliVerb` 增 `"init"`；`CLI_COMMANDS` 增 `{ name: "init", description: "install or update the kairos plugin set for a harness", example: "cdd init --harness=claude", keys: [{ key: "harness", required: true }, { key: "update" }] }` —— checkable: `channel-closure.guard.test.ts` 绿（前向 / 反向闭包均成立）
  - 实现 `cli.ts` 接线：构造期 `this.#init = new CliInit({ io, runner: opts.initRunner ?? new ExecaStepRunner(), header: opts.initHeader ?? ((line) => writeSync(1, `${line}\n`)) })`；`#wireActions` 增 `commandNode("init").action(async (_opts, command) => { this.#assertDryRunScope(command, this.#dryRunOf(command)); const parsed = this.#runInput(null, command); this.#exitCode = await this.#init.run(parsed.harness, parsed.update ?? false); })`——**不调用 `#rootOf()`** —— checkable: `cli.test.ts` 新用例绿
  - 写失败/转绿测试（`cli.test.ts` 接线组）：`cdd init --harness=pi` 走替身 runner 且零 FS 读（临时非 git 目录 `chdir` 后仍退出 0）；缺 `--harness` → exit 2；`--harness=cursor` → exit 2；`cdd init --harness=claude --dry-run` → exit 2 且替身 `calls` 为空 —— checkable: 先 FAIL 后 PASS
  - 结构 pin 重锚（同一提交，缺一即红）：`cli.test.ts:501-510` 的 `CLI_COMMANDS.map(name)` → 八项（`init` 居末）；`cli.test.ts:1102` 的逐命令循环名集加 `init`；`cli.test.ts:1109` 的 `toHaveLength(7)` → `8`；`projection.test.ts:55-65` 的 `program.commands.map(name)` 八项 —— checkable: `pnpm -C packages/cdd-engine test` 绿
  - 注释与死码清扫（第二次提交内）：`face/cli.ts:5,11` · `face/projection.ts:3,6` · `face/declare.ts:2,148,191` 与测试面 `cli.test.ts:3,500,501,935,1123,1134` · `projection.test.ts:55` 的 `seven` 全部改 `eight` 或去数字 —— checkable: `grep -rn seven packages/cdd-engine/src-next/face --include='*.ts'` 零命中；`grep -rn ProcessRunner packages/cdd-engine/src-next` 零命中（由第一次提交保证）
  - 第二次提交：`git commit -m "feat(cdd-engine)!: add cdd init for harness plugin bootstrap"` —— checkable: `pnpm run precommit` 过（typecheck ×3 + 零裸函数门）
- **Acceptance**: `init.test.ts` 五组用例绿（序列 / update / 首败即停+两行报文 / step 头与汇总字节 / 真 spawn 与 127）· `cli.test.ts` 接线组绿（含 `--dry-run` → exit 2 且零 argv、非 git 目录跑通）· 结构 pin 四处重锚绿 · `grep -rn seven …/face` 与 `grep -rn ProcessRunner` 零命中 · 死码退役与 `init` 落地各为一次独立提交（`refactor` / `feat`），四波依赖序不变 · engine 套件 + `typecheck ×3` 绿。
- **DependsOn**: 1

### Task 3: 消费面文档同步（四份 README + `CLAUDE.md`）

- **Objective**: 让文档与第八命令对齐并同时**再精简**：kairos README 的安装段由「两段 + 四行逐 harness 命令块」收敛为「一条命令 + 一句 `--update` + 一张表」；根 README 的安装面收敛为一条命令 + 表指针；impeccable 在消费面零残留；`CLAUDE.md` 的 `seven-command` 与上游枚举同步。
- **Files**: Modify `packages/kairos/README.md` · `packages/kairos/README.zh-CN.md` · `README.md` · `README.zh-CN.md` · `CLAUDE.md` · `packages/cdd-engine/README.md` · `packages/cdd-engine/README.zh-CN.md`
- **Consumes**: Task 1 的 `PLUGINS`（表行序与命令字节）；spec §3.3（段落落点 / 表形）与 §4.3（同步面清单）。
- **Produces**: 四份 README 的安装段字节与 CLI 表（Task 4 的门逐格断言的对象）；`CLAUDE.md:44` 的八命令枚举（序 = `CLI_COMMANDS`）与 `CLAUDE.md:9` 的上游枚举（去 impeccable）。
- **Steps**:
  - `packages/kairos/README.md`：删整个 `### From pi` / `### Upstream dependency install` 子节（标题 + 代码块 + 其后的 pi settings 散文 —— `packages/kairos/README.md:50` / zh `:52` 的 `Installs the latest release and writes pi's project settings. …` 属子节正文、不在 bash 代码块内，只删代码块会留下残句）；`## Installation` 就地改为「`npx -y @oscaner-skills/cdd-engine@latest init --harness=<claude|pi>`（已全局装 `cdd` 可省前缀）+ **一句「装什么」**（`cdd init` installs `kairos` and its two upstream packages (superpowers, mattpocock-skills)；zh 同句「按序安装 kairos 及其两个上游包（superpowers、mattpocock-skills）」，条数以 `PLUGINS.map((row) => row.name)` 的行数为准、README 不另存条数真源）+ 一句 `--update` + 参考表」；表头逐字 `| Package | Claude Code | Pi |`、行序 = superpowers / mattpocock-skills / kairos、格 = install argv 逐条 `join(" ")` 后 `join("；")`；`## Quick start` 第 1 步改指该命令；`## CDD engine CLI` 段 surface 句补 `init` 且序 = `CLI_COMMANDS` —— checkable: 表与 `PLUGINS` 逐格一致（Task 4 门即验）、`impeccable` 零命中、`claude plugin marketplace add` 仍只在表中出现、`writes pi's project settings` 零命中
  - `packages/kairos/README.zh-CN.md` 同步同形（段名 `## 安装` / `## CDD 引擎 CLI`；删整个 `### 从 pi 安装` / `### 上游依赖安装` 子节 —— 标题 + 代码块 + 散文，同 en 面）—— checkable: 与 en 面结构逐项对应
  - 根 `README.md` / `README.zh-CN.md`：`## Installation`（en `:47` / zh `:51`）收敛为「一条 `npx -y … init --harness=<claude|pi>` + 一句『手动安装见 `packages/kairos/README.md` 的表』」，删逐 harness 命令块与「Upstream plugins install from their own publishers」散文；删 Upstream 表的 impeccable 行；Quick start 第 1 步同形 —— checkable: 两文件 `claude plugin marketplace add` / `pi install` 零命中、`impeccable` 零命中
  - `CLAUDE.md`：`:44` 改 `the eight-command \`cdd\` CLI: implement / review / fix / base / schema / issue / board / init`（序 = `CLI_COMMANDS`）；`:9` 删 `, and impeccable`（成 `Superpowers and mattpocock-skills are upstream third-party plugins`）—— checkable: `grep -n "seven-command" CLAUDE.md` 零命中、`grep -n eight-command CLAUDE.md` 命中
  - `packages/cdd-engine/README.md` / `README.zh-CN.md`：CLI 表增 `init` 行（`cdd init --harness=<claude\|pi> [--update]` · purpose = 装 / 更新该 harness 的插件集）；全局 option 段零改 —— checkable: 表行集 = 八项
  - 提交：`git commit -m "docs: document cdd init and trim the install surfaces"` —— checkable: `pnpm run precommit` 过
- **Acceptance**: kairos README 安装段 = 一条命令 + **一句「装什么」**（en「`kairos` and its two upstream packages」/ zh「kairos 及其两个上游包」，条数同 `PLUGINS` 行数）+ 一句 `--update` + 一张表（旧 `### From pi` / `### Upstream dependency install` / `### 从 pi 安装` / `### 上游依赖安装` 零残留，且 en `writes pi's project settings` 与 zh 对应句零命中）· 根 README 双语 `claude plugin marketplace add` / `pi install` 零命中 · `impeccable` 在四份 README 与 `CLAUDE.md` 全零残留 · `CLAUDE.md` `seven-command` 零命中 / `eight-command` 命中 · cdd-engine README 双语 CLI 表八行。
- **DependsOn**: 1

### Task 4: 门（`plugins.guard.test.ts` + `presentation-surface.test.ts` 单源派生与双语）

- **Objective**: 把 Task 1/Task 3 的事实变成机械断言：新的 `plugins.guard.test.ts` 钉 PLUGINS ↔ 四份 README（install 表逐格 + 表头逐格 + 命令字节）；`presentation-surface.test.ts` 的 `CDD_SUBCOMMANDS` 改为 `CLI_COMMANDS` 派生，并把三门扩为双语、补 `CLAUDE.md` 的序列 + `eight-command` 判据。
- **Files**: Create `packages/cdd-engine/src-next/face/__tests__/plugins.guard.test.ts`; Modify `packages/kairos/tests/presentation-surface.test.ts`
- **Consumes**: Task 1 的 `PLUGINS`；Task 2 的 `CLI_COMMANDS`（八项）；Task 3 的四份 README 字节。
- **Produces**: `plugins.guard.test.ts`（引擎套件，四组合逐格）· `CDD_SUBCOMMANDS` 派生面 + 三门双语断言。
- **Steps**:
  - 写 `plugins.guard.test.ts`（失败优先：先对当前 README 跑，应红）—— 断言一：kairos README(en/zh) 的 install 表行键集与顺序 == `PLUGINS.map((r) => r.name)`；断言二：每行 claude / pi 单元格 == 该行该 host 的 `install` argv 逐条 `join(" ")` 后 `join("；")` —— checkable: FAIL（当前仍是四行含 impeccable）
  - 断言三：表头逐格 == `["Package", "Claude Code", "Pi"]`（两标签唯一落笔点，禁标签映射）—— checkable: FAIL / 绿
  - 断言四：四份 README（根 en/zh + kairos en/zh）各含 `npx -y @oscaner-skills/cdd-engine@latest init --harness=claude` 与 `… --harness=pi` 两条命令字节（逐文件 × 逐值循环）—— checkable: FAIL 后转绿
  - 改写 `presentation-surface.test.ts:52` 的 `CDD_SUBCOMMANDS` 为 `CLI_COMMANDS.map((c) => c.name)`（删手抄数组）；把 `:278-287` 的引擎 README CLI 表门从**集合**判定改为**行序**判定（按 `## CLI` 段表的行序抽命令名数组，`toEqual(CDD_SUBCOMMANDS)`），en + zh-CN 两文件各判一次 —— 现行 `for (const cmd of CDD_SUBCOMMANDS) expect(cli).toMatch(...)` 对行序零断言（`init` 行插到表首、或 en/zh 两表行序不一致都照绿），而 spec §4.2 判的是「表行集 == 派生集（含 `init` 行，顺序同 `CLI_COMMANDS`）」—— checkable: 门绿且数组不再是字面
  - 让 `:366-369` 的 kairos README surface 句门跑 en + zh-CN 两文件（zh `## CDD 引擎 CLI` 段），补 `CLAUDE.md:44` 门：命令枚举 `join(" / ")` 字符串相等 + `eight-command` 命中 / `seven-command` 零命中（扩展 `:137-145` 既有用例，保留其定位句与单源措辞断言；并把该用例 `:143-145` 的注释改成新事实 —— `CLAUDE.md` 的引擎行只承载八命令枚举与计数字样，消费者面的完整 CLI 参考仍在 README 家族、门在下方 —— 否则同一条用例一边宣称「`CLAUDE.md` 不再承载 cdd CLI 叙述」一边断言 CLI 枚举序列，自相矛盾）—— checkable: 三门 × 双语全绿
  - 提交：`git commit -m "test: gate the plugin roster and the eight-command surface"` —— checkable: `pnpm -C packages/kairos test` + `pnpm -C packages/cdd-engine test` 绿
- **Acceptance**: `plugins.guard.test.ts` 四组断言绿（行序 / 逐格 / 表头 / 四 README 字节）· `CDD_SUBCOMMANDS` 为派生值（`grep -n 'CDD_SUBCOMMANDS = \['` 零命中）· 三门双语断言绿（含 `CLAUDE.md` 序列相等 + `eight-command`）。
- **DependsOn**: 1, 2, 3

### Task 5: 架构图同步（双语源 JSON + Archify 重生成 + evidence 重锚）

- **Objective**: 架构图的命令枚举与 evidence citation 跟随本 phase：en/zh 源 JSON 的 tag 与 detail 句改八命令并补 `init`，三处节点 citation 重锚到本 phase 之后仍成立的声明块，再按 Archify CLI 重生成两份 HTML（生成物禁手改）。
- **Files**: Modify `docs/diagrams/src/architecture.en.json`（`:99` tag · `:251` detail · `:64` / `:82` / `:102` 的 `sources`）· `docs/diagrams/src/architecture.zh-CN.json`（同四处）; Create `packages/cdd-engine/src-next/face/__tests__/diagrams.guard.test.ts`; Regenerate `docs/diagrams/architecture.en.html` · `docs/diagrams/architecture.zh-CN.html`
- **Consumes**: Task 1 的 `face/plugins.ts`（`PLUGINS` 声明块位置）与 `host.ts`（`HOSTS` 保留段）· Task 2 的 `face/cli.ts`（`commandNode("init").action(...)` 薄壳块）· `docs/diagrams/README.md` 的 Archify 生成流程。
- **Produces**: 两份源 JSON（八命令、重锚后的 citation）· 两份重生成的 HTML · `diagrams.guard.test.ts`（图源 pin：tag 逐字 / detail 含 `init` / citation 区间含命名标识符）。
- **Steps**:
  - en 源：`:99` 节点 tag `7 commands` → `8 commands`；`:251` detail 句 `The engine runs seven commands: …` → `eight` 且枚举补 `init` —— checkable: `grep -n "7 commands"` 零命中
  - zh 源：`:99` tag `7 条命令` → `8 条命令`；`:251` 「引擎提供七条命令…」同改 —— checkable: `grep -nE '7[[:space:]]*(commands|条命令)|七条命令' docs/diagrams/src/architecture.*.json` 零命中
  - evidence 重锚（两源同改）：upstream 节点 → `face/plugins.ts` 的 `PLUGINS` 声明块区间；kairos 节点 → `face/host.ts` 的 `HOSTS` 声明块保留段；engine 节点 → `face/cli.ts` 中 `commandNode("init").action(...)` 薄壳块的区间 —— checkable: 每个 citation 的 `line..end_line` 落在所命名声明内，且该区间文本含所命名标识符（`PLUGINS` / `HOSTS` / `commandNode("init")`）；此判据落在下一步新建的测试文件里机检，**不依赖 Archify finalize**（它只校验「范围存在」—— 旧范围在删块后仍然存在、会静默指错）
  - 写 `face/__tests__/diagrams.guard.test.ts`（图源 pin，引擎套件；跨面读先例：被删的 `install-rows.guard.test.ts` 读 README）：读 `docs/diagrams/src/architecture.en.json` 与 `…zh-CN.json`，断言三条 —— ① 两源 engine 节点 `tag` 逐字等于 `8 commands` / `8 条命令`，且两源全文零 `7 commands` / `7 条命令` / `七条命令` 三拼写；② 两源 `Execution` / `执行` 条首句含 `init`；③ 三处 citation 的 `line..end_line` 落在命名声明区间内且区间文本含 `PLUGINS` / `HOSTS` / `commandNode("init")` —— checkable: 先 FAIL（旧 tag / 旧范围）后 PASS
  - 按 `docs/diagrams/README.md` 用 Archify CLI 重生成两份 HTML 并跑 `finalize --repo-root .`—— checkable: 生成物含 `8 commands` / `8 条命令` 且 citation 校验通过（生成物零手改）
  - 提交：`git commit -m "docs(diagrams): sync the architecture diagrams to eight commands"` —— checkable: 两份 HTML 与源 JSON 同提交
- **Acceptance**: 两源零 `7 commands` / `7 条命令` / `七条命令` 残留；en tag == `8 commands`、zh tag == `8 条命令`，两 `:251` detail 句含 `init`；三处 citation 区间落在命名的声明块内且文本含该标识符；`diagrams.guard.test.ts` 三条断言绿（不依赖 Archify finalize）；两份 HTML 由 Archify 重生成且 `finalize --repo-root .` 通过。
- **DependsOn**: 1, 2

### Task 6: changeset、发布后置登记与全量校验

- **Objective**: 把本 phase 收口到可发布态：cdd-engine minor（新命令）+ kairos patch（README 文本）的 changeset，登记 published `@latest` 形态的后置核验项；跑通全量 `pnpm run validate`。
- **Files**: Create `.changeset/p20-cdd-init.md`; Modify（如需）`packages/kairos/CHANGELOG` 面零改（changesets 生成）
- **Consumes**: Task 2 的命令面、Task 3 的文档面、Task 4 的门、Task 5 的图面。
- **Produces**: `.changeset/p20-cdd-init.md`（双包）与一次全绿 `pnpm run validate` 记录。
- **Steps**:
  - 写 changeset：`cdd-engine` **minor**（新增 `cdd init` 第八命令 · `PLUGINS` 数据面归一 · `INSTALL_ROWS` / `HostRow.install` / `ProcessRunner` 退役 · 八命令结构 pin）· `kairos` **patch**（README 安装段重写 + kairos 安装表减至三行）—— checkable: `pnpm exec changeset status` 列出两包
  - 在 changeset 正文写**发布后置**项：published `@latest` 的 `cdd init` 可执行性留待发布后核验（本 phase 明列不发布，README 首条命令即该形态）—— checkable: changeset 含该句
  - 跑 `pnpm run validate`（emit check · root vitest · kairos 套件 · engine 套件 · typecheck ×3 · version-sync · 零裸函数）—— checkable: ALL PASS
  - 复核 spec 的 AC 全表（含手工项：**本地源形态** `node packages/cdd-engine/src-next/bin.ts init --harness=<claude|pi>` 在**零全局 `cdd`** 的临时**非 git** 目录内跑 install 与 `--update` 各一次作发布前核验，不入 CI —— 与 Step 2 的 published `@latest` 后置项是**两条不同的核验**：前者验本 phase 的源码（也是仓库 AGENTS.md 的引擎调用纪律），后者验发布产物；不要写成裸 `cdd init`，那会在一台已装全局 `cdd` 的机器上验到旧版本）—— checkable: 每条 AC 有对应证据或明确登记为发布后置
  - 提交：`git commit -m "chore: changeset for cdd init (cdd-engine minor, kairos patch)"` —— checkable: `pnpm run precommit` 过
- **Acceptance**: `.changeset/p20-cdd-init.md` 存在（cdd-engine minor + kairos patch + 发布后置句）· `pnpm run validate` ALL PASS · spec 的 AC 全表逐条有证据或已登记为发布后置 · 不应用版本、不打 tag、不发布。
- **DependsOn**: 4, 5

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-10-26 | P20 实施计划：六任务四波（W1 数据面归一 `PLUGINS`/`HOST_IDS` 与两处死声明退役 · W2 `cdd init` 第八命令（真 spawn · 三流继承 · 首败即停 · 127 · repo 无关 · 拒 `--dry-run`）+ 结构 pin 重锚与 `ProcessRunner` 退役 / 四份 README 与 `CLAUDE.md` 文档同步（安装段合并精简）· W3 门（`plugins.guard.test.ts` + `CDD_SUBCOMMANDS` 派生与三门双语）/ 架构图双语源 + Archify 重生成 + evidence 重锚 · W4 changeset 与全量校验）；逐字取 spec v0.5，零新依赖，零裸函数 | [human] · Claude（kairos:cdd-plan [P20] · 2026-10-26） |
| v0.2 | 2026-10-26 | **plan-fix-1（review-1 findings 收口 · 1 blocker + 5 warn + 7 nit + 5 裁定）**：① blocker/裁定 R1——删掉 `@ts-expect-error` 夹具（`GUARD_BAN_WORDS.stale` 明文禁词，`words.guard.test.ts` 扫 `src-next/` 全域），`PLUGINS` 改 `as const satisfies readonly PluginRow[]` 承担列闭合的编译期 pin，行为面键集 pin 留在 Step 1 的运行时断言，Step 4 checkable 改「删一列 → typecheck 红」；② nit/裁定 R2——install 面与 update 面同落 9 条字面 pin，不再靠 Task 4 的 README 门反向覆盖（同源同错照绿）；③ warn/裁定 R5——`CliInit.run(host: HostId \| undefined, update: boolean)`，`run` 首行 `if (host === undefined) this.#usage(...)`，`#runInput` 用 `HOST_IDS.find` 收窄（禁 `as HostId`）、`update = globals.update === true`，接线片段改 `run(parsed.harness, parsed.update ?? false)`；④ warn——Task 2 替身夹具改显式字段 + 构造器体赋值（两个 tsconfig 的 `erasableSyntaxOnly` 禁参数属性 → TS1294）；⑤ warn/裁定 R4——图源 pin 单列 `face/__tests__/diagrams.guard.test.ts` 三条断言（tag 逐字 / detail 含 `init` / citation 区间含标识符），Task 5 Files、Produces、Steps、Acceptance 同步；⑥ warn——Task 1 Acceptance 增生产面 host 字面零副本 grep，Step 5 的自述改为它真能证明的事实（per-host detect 行识别该 host）；⑦ warn——Task 3 安装段增「装什么」字节句（条数由 `PLUGINS` 行数派生），Step 1 与 Acceptance 同判 en / zh；⑧ nit——Task 6 手工核验改本地源形态（`node …/bin.ts init`，零全局 `cdd`、临时非 git 目录），与 changeset 的 `@latest` 后置项显式区分为两条核验；⑨ nit——`### From pi` / `### 从 pi 安装` 改为删整个子节（标题 + 代码块 + pi settings 散文），Acceptance 增 `writes pi's project settings` 零命中；⑩ nit——Constraints 末尾增「未覆盖输入面（Review Focus）」段（TTY 交互 / `--update --dry-run` / 幂等 / SIGINT / 位置参数，逐条已钉测试或明确不做）；⑪ nit——Task 4 Step 5 明写把 `:143-145` 的注释改成新事实（引擎行只承载八命令枚举，完整 CLI 参考在 README 家族）；⑫ nit/裁定 R3——Task 2 两次提交（先 `refactor(cdd-engine)!: retire the unused ProcessRunner seam`，再 `feat(cdd-engine)!: add cdd init…`），不新增任务、四波依赖序不变；⑬ nit——Task 4 Step 4 引擎 README CLI 表门改行序判定（`toEqual(CDD_SUBCOMMANDS)`，en + zh 各一次） | Claude（kairos:cdd-dev [P20] plan-fix round 1 · 2026-10-26） |
