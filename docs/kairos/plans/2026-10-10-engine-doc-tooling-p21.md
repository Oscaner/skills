---
title: 引擎文档工具（Engine Doc-Tooling）— P21 实施计划：引擎作为唯一读写路径
doc-type: plan
version: v0.10
date: 2026-10-28
slug: 2026-10-10-engine-doc-tooling-p21
base: develop
---

## Constraints

- **逐字取 spec**：本计划只实现 `docs/kairos/specs/2026-10-10-engine-doc-tooling-p21-design.md` v0.11 已批准的面。三个抽象名（`InFlight` · `ConsistencyRules` 的规则声明面 · `LineIdentity`）· 波行 `planTasks` 快照 · 门序 `tree-clean → in-flight → graph → plan-ledger → wave → doc-contract` · 三句恢复纪律是既定字节，不得改名或改序。
- **恢复三句的 canonical 字节串（全 phase 同读一串，英文主导）**：`look at the working tree first` · `commit the changes that work` · `discard the ones that are broken`。引擎报文面（`face/words.ts`）与 `packages/kairos/skills/*/SKILL.md` 逐字引用同一串——SKILL.md 英文主导、零中文（AGENTS.md）；中文对译「先看工作树 · 能用的改动 commit · 坏掉的改动丢弃」只是对译，不作第二份真源、不进 SKILL.md。
- **锁与在飞判据**：锁交 `proper-lockfile`（`stale: 12h` · `update: 60s` · `realpath: false` · `retries: 0`）；**门禁判据是记录存在 + pid 存活，锁是否持有一律不作判据**（该包在任何优雅退出上自行删锁，只有 SIGKILL 留锁）；接管只走显式 `--steal-stale`。
- **运行时依赖只加三个**：`write-file-atomic` · `ps-list` · `proper-lockfile`（5 → 8）。**组 CPU 保留 `ps -g`**，收进 `infra/proc.ts` 作为唯一 OS 读面——这是「OS 面优先第三方包」的据实例外（无跨平台成熟包提供进程组累计 CPU），**不引入 `pidusage`**。
- **零裸函数**：新增面全部是类 / 类型 / 常量数据；`pnpm run check:no-bare-functions` 必须零命中。
- **单源纪律**：规则清单只读规则声明面（`Contract` 策略族与 `checked` 面同源派生）；在飞状态只在 `InFlight` 记录；追加判据只读波行 `planTasks` 快照；crash 文件名只读 `RoundNaming`。**任何面都不得存第二份真源**。
- **删除即删除**：`liveness.json` 独立产物 · `Sampler` 的 `TIME_PATTERN` 与 `execFileSync("ps")`（迁入 `proc.ts` 不算保留两份）· `Contract.#buildPolicy` 的 15 个硬编码 `new` · `board-view.ts` 的 `never the stored number` 注释一律退净，不留兼容层。
- **冻结面**：`StallJudge` 的阈值与真值表 · 四类文档的结构（登记表元素与骨架标题树）· 八命令面（`cdd` 仍是 implement / review / fix / base / schema / issue / board / init）· handoff 载体 schema 的声明面（不加字段、不加 plane）· `rounds` 的周期号语义（D28）。
- **brief 正文即指纹**：任何任务都不得给 brief 加头行、版本行或稳定前缀——那会让所有已评审波次的 `brief-revision` 判漂移（D30 门控整体重开）。
- **调用纪律**：引擎一律本地 `node packages/cdd-engine/src-next/bin.ts`；背景派发 + 等完成通知，读全量 stdout/stderr，不过滤。
- **提交门禁**：每任务提交前过 `pnpm run precommit`；Task 8 收尾跑 `env -u AI_AGENT pnpm run validate` 全量（`AI_AGENT` 在场会让既有注入派发 E2E 误红）。

### 未覆盖输入面（Review Focus — 逐条已钉测试或明确不做）

- **跨 slug 并发派发**（另一个 phase 的工作区正在派发）：锁在工作树级，任何 slug 的第二次派发都被拒 —— **Task 6** 钉（两个不同 slug 的 `InFlight` 记录，第二次 `vet` 必拒）。
- **记录损坏 + 活锁**（半截 JSON 与真损坏同形）：按持有处理、唯一出口 `--steal-stale`，**不得被静默清掉** —— **Task 4** 钉三态、**Task 6** 钉报文与出口。
- **全新命名空间首轮被杀**（`.gitignore` 标记尚未发布）：`InFlight` 自己发布标记，被杀后 `git status --porcelain` 必须为空 —— **Task 4** 钉。
- **组长先退 / setsid 孙进程**（组 CPU 读数的语义边界）：`ps -g` 的读法不变，行为与今日逐条一致 —— **Task 1** 以两个形态样本钉住（组长先退后成员仍计入 · `setsid` 孙进程仍计入），两个 pin **必绿、不得 skip**（能力门只允许非 POSIX 宿主整条 skip；macOS / Linux 即 CI 平台必须绿），用例以 `spawn(..., { detached: true })` 起自有进程组（否则「组号 = 子进程 pid」不成立），读数语义与今日 `ps -g` 逐条一致；**明确不做**成员重算。
- **pid 复用**（持有 pid 已是另一个进程）：`ps-list` 的 `startTime` 与记录的 `startedAt` 的容差判定由 `ProcessFacts.live(pid, startedAt)` 承担（`|startTime − startedAt| <= 60_000`）—— **Task 4** 钉容差边界的反例（同 pid、`startedAt` 差 10 分钟 → 判亡），**Task 1 / Task 4** 另钉 `startTime` 读不到（`live` 返回 `null`）时视为持有、`steal` 拒绝。
- **计划领先账本的边界**（恰好编号大于账本最大任务号 / 小于则不是未开工）：**Task 2** 的三条用例（放行 / 滞留 / 变异转红）。
- **brief 内容指纹稳定性**：任何任务都不许改 brief 的渲染字节 —— **Task 7** 的指纹 pin 顺带守（同一计划两次渲染同 hash）。
- **`--steal-stale` 与 `--dry-run` 同现**：预览对锁零写、不接管、不删记录，持锁时 exit 1 —— **Task 6** 钉（锁文件前后字节不变、记录仍在；`--dry-run` 下该旗标无写入通道）。

### Task 1: OS 适配器（`infra/atomic.ts` · `infra/proc.ts` · 单一写缝 · `Sampler` 改调）

- **Objective**: 把引擎里两块手写 OS 面换成成熟包的薄适配：**所有 JSON 产物写入原子化**（`Workspace.writeJson` 是唯一写缝，`progress` / `crash` / `handoff` / in-flight 全走它），**所有进程事实收进一个类**（存活 · PPID 链 · 进程组去重 · 组累计 CPU）。`ps -g` 的读法与 `TIME_PATTERN` 迁入 `infra/proc.ts`，`Sampler` 只组装两条腿——引擎其余面零 `ps` 调用。
- **Files**: Create `packages/cdd-engine/src-next/infra/atomic.ts` · `packages/cdd-engine/src-next/infra/proc.ts` · `packages/cdd-engine/src-next/infra/__tests__/proc.test.ts` · `packages/cdd-engine/src-next/infra/__tests__/atomic.test.ts`; Modify `packages/cdd-engine/src-next/infra/workspace.ts`（`writeJson` 改原子写）· `packages/cdd-engine/src-next/face/termination.ts`（`Sampler` 的 `#groupCpuMs` / `TIME_PATTERN` 迁出，`probe()` 改调 `ProcessFacts`）· `packages/cdd-engine/src-next/face/__tests__/termination.test.ts`（`Sampler` 用例改指 `ProcessFacts`）· `packages/cdd-engine/package.json`（`write-file-atomic` · `ps-list`）
- **Consumes**: `infra/workspace.ts` 的 `Workspace.writeJson(name, data)`（唯一写缝，`mkdir` 已先于写）· `face/termination.ts:265-291` 的 `#groupCpuMs` 现状（`execFileSync("ps", ["-o","time=","-g",pgid])` + `TIME_PATTERN`）。
- **Produces**:
  ```ts
  // infra/atomic.ts
  export class AtomicWriter {
    /** write-file-atomic 的同步面：临时文件 + rename，权限与既有文件对齐。 */
    write(file: string, text: string): void;
  }

  // infra/proc.ts
  export interface ProcRow {
    readonly pid: number;
    readonly ppid: number;
    readonly cmd: string;
    /** 进程启动时刻（epoch ms = `descriptor.startTime?.getTime() ?? null` —— `ps-list` 的
     *  `startTime` 是 `Date`（Windows 上可能 `undefined`），换算只此一处；读不到 → null）。 */
    readonly startTime: number | null;
  }
  export class ProcessFacts {
    /** 全部进程快照（`ps-list` 一次读，含 `startTime`；排序稳定，便于去重判定）。 */
    static async snapshot(): Promise<readonly ProcRow[]>;
    /** 组累计 CPU（ms）。保留 `ps -o time= -g` 的组读法；读不到 → null（fail-open）。 */
    static groupCpuMs(pgid: number): number | null;
    /** 组成员的 pid 集合：以 pgid 为根的 PPID 下降（包装进程与其子进程算一个派发）。 */
    static groupMembers(pgid: number, rows: readonly ProcRow[]): readonly number[];
    /** 存活判定：进程在册且启动时刻与记录的 `startedAt` 相容（±60s）。
     *  进程不在册 → false；在册但启动时刻不相容 → false（pid 复用）；`startTime` 读不到 → null
     *  （null 不得被 `InFlight` 读成「已亡」——见 Task 4 的折成 `alive: true` 裁定）。 */
    static async live(pid: number, startedAt: number): Promise<boolean | null>;
    /** `ps -o time=` 的读数字形（BSD 有厘秒、Linux 整秒）——迁自 Sampler，唯一一份。 */
    static readonly TIME_PATTERN: RegExp;
  }
  ```
- **Steps**:
  - 添加依赖：`pnpm -C packages/cdd-engine add write-file-atomic ps-list` —— checkable: `packages/cdd-engine/package.json#dependencies` 出现两项且 `pnpm -C packages/cdd-engine install` 零报错
  - 写失败测试 `atomic.test.ts`：`new AtomicWriter().write(file, text)` 后内容精确相等，且同目录**零残留临时文件**（`readdirSync` 只含目标文件） —— checkable: FAIL（模块不存在）
  - 写失败测试 `atomic.test.ts`（写失败不改旧值）：目标目录只读 → `write` 抛出，`readFileSync(file)` 仍是上一次的完整内容 —— checkable: FAIL
  - 实现 `AtomicWriter`（`writeFileSync(file, text, { encoding: "utf8" })` 来自 `write-file-atomic`），并让 `Workspace.writeJson` 改调它（保留 `mkdirSync` 先行） —— checkable: 上述两用例转绿，且 `Workspace.writeJson` 方法体内零 `writeFileSync`（`Workspace.writeText` 在 `infra/workspace.ts:188` 仍有一处裸写 —— **刻意不动**，不在本 phase 的写缝面；不要求全文件零命中）
  - 写失败测试 `proc.test.ts`（组 CPU 解析）：起一个真子进程组（`execa` 起 `node -e` 死循环并复用既有 `detachedChild` 夹具形态，即 `spawn(..., { detached: true })` —— `detached` 是「组号 = 子进程 pid」成立的前提，未 detached 的子进程继承父进程组，`ps -g child.pid` 读不到该组），`pgid = child.pid`，`ProcessFacts.groupCpuMs(pgid)` 返回 `>= 0` 的数字；组号不存在 → `null` —— checkable: FAIL（模块不存在）
  - 写失败测试 `proc.test.ts`（PPID 下降去重）：父 `node -e` 再 spawn 一个孙进程 → `snapshot()` 里父与孙都在，`groupMembers(child.pid, rows)` 同时含两者；只含父进程的包装形态（无孙）只返回一项 —— checkable: FAIL
  - 写失败测试 `proc.test.ts`（存活与 pid 复用）：`live(process.pid, Date.now())` → `true`；`live(process.pid, Date.now() - 600_000)` → `false`；`live(<不存在的 pid>, now)` → `false` —— checkable: FAIL
  - 写失败测试 `proc.test.ts`（`startTime` 不可读 → `null`，不得折成「已亡」）：注入一份 `startTime` 缺失的进程行（`snapshot()` 的取行面可注入；非 POSIX 分支以命名 skip 逃生门标名），`live()` 返回 `null` 而非 `false`，且 `InFlight` 侧把它读作「视为持有」（Task 4 的 `alive: true` / `steal` 拒绝由该 pin 背书） —— checkable: FAIL
  - 写失败测试 `proc.test.ts`（样本形态 · 组长先退，必绿）：父 `node -e` 起一个成员子进程后自己 `process.exit(0)`，成员仍存活 → `ProcessFacts.groupCpuMs(pgid)` 为非负且等于同刻 `ps -o time= -g <pgid>` 的逐成员读数之和（父退出后成员被 reparent，仍计入真进程组） —— checkable: FAIL（模块不存在）；本 pin **不得 skip**
  - 写失败测试 `proc.test.ts`（样本形态 · `setsid` 孙进程，必绿）：`spawn(..., { detached: true })` 起的孙进程仍在同一进程组内 → 它被 `ps -g <pgid>` 计入 `groupCpuMs(pgid)`，读数与同刻 `ps -o time= -g` 一致 —— checkable: FAIL；本 pin **不得 skip**；唯一允许的能力门 = 非 POSIX 宿主（Windows）整条用例 skip 并在用例名标明（macOS / Linux 必须绿）
  - 实现 `ProcessFacts`：`snapshot()` 包 `ps-list`（`ProcRow.startTime` 取 `descriptor.startTime?.getTime() ?? null`，不直接搬 `Date`）；`groupCpuMs` 原样迁 `Sampler` 的 `execFileSync("ps", ...)` + `TIME_PATTERN`；`groupMembers` 做 PPID 广搜；`live` = 在册 **且** `|startTime − startedAt| <= 60_000`（不在册 → false；在册但不相容 → false；`startTime` 读不到 → null，绝不折成 false）—— 不引入 `pidusage`，不用 `process.kill(pid, 0)` —— checkable: 上述六组用例转绿
  - `Sampler` 改调：`#groupCpuMs` 删除改 `ProcessFacts.groupCpuMs(this.#pgid)`；`TIME_PATTERN` 从 `Sampler` 移除 —— checkable: 源码面 `grep -rn "execFileSync\|TIME_PATTERN" packages/cdd-engine/src-next --include='*.ts' | grep -v __tests__` 只命中 `infra/proc.ts`（`infra/__tests__/infra.test.ts` 与 `__tests__/smoke.integration.test.ts` 的 `execFileSync("git")` 不在断言面）
  - `termination.test.ts` 的 `Sampler` 用例随迁移改指（保留同断言语义：组号 = 子进程 pid · 读不到 → null） —— checkable: `pnpm -C packages/cdd-engine test src-next/face/__tests__/termination.test.ts` 绿
- **Acceptance**: `atomic.test.ts` 三组用例绿、`proc.test.ts` 三组基础用例绿 + 组长先退 / `setsid` 孙进程两个样本 pin **必绿**（读数语义与今日 `ps -g` 逐条一致；只允许非 POSIX 宿主整条 skip，macOS / Linux 必须绿） · `ProcRow.startTime` 是 `number | null`（`descriptor.startTime?.getTime() ?? null`，量纲为 epoch ms）且 `live()` 的 `null` 不被折成 `false`（有 pin；跳过者以命名 skip 标名） · `Workspace.writeJson` 经 `AtomicWriter`（进程被杀不留半截 JSON，由「写失败不改旧值」用例背书）· 源码面 `execFileSync("ps")` 与 `TIME_PATTERN` 只在 `infra/proc.ts` 一处（`__tests__` 内的 `execFileSync("git")` 不在断言面） · `StallJudge` 阈值与真值表零改（`termination.test.ts` 全绿）· `pnpm -C packages/cdd-engine test` 绿 · 零裸函数门绿
- **DependsOn**: none

### Task 2: `ConsistencyRules`（规则声明面 · 21 行规则族 · `plan-ledger` 门 · 已检清单与被检渲染）

- **Objective**: 把「结构规则」变成**声明面驱动的单一族**：新增规则声明表（规则 id + 适用 docKey + 作用域 doc|ledger + 声明即工厂），`Contract` 的策略族从今天 15 个硬编码 `new` 改为按声明派生。落定后的判定面（**一规则一策略**，无多规则策略）：`change-history-version-unique`（重复版本）· `front-matter-version-in-lineage`（header 版本**必须出现在变更记录里**；只判「缺席」，**不判端点、不判方向**）· `change-history-row-not-in-other-table` · `list-marker-not-doubled` · `task-id-unique` · `phase-id-unique` · `section-order`，加两条 ledger 规则。**版本序腿不落地**（`OrderInvariant` 只留小节序；`SelfBoundedInvariant` 的「header=末行」腿撤除，其「header 不在 lineage」腿改名成 `front-matter-version-in-lineage`）。声明面共 **21 行**：doc **19** + ledger **2**；公共面 **6** 条。`plan-ledger` 门在 preflight 里跑，`checked` 逐条渲染并在**CLI 派发面**（通过与拒绝两条路径）打印，使「检查过」与「通过」在报文上可分。
- **Files**: Create `packages/cdd-engine/src-next/contract/rules.ts` · `packages/cdd-engine/src-next/contract/__tests__/rules.test.ts`; Modify `packages/cdd-engine/src-next/contract/invariants.ts`（拆/撤腿 · 两条新策略 · 两条 ledger 策略 · 基类一个共享 lineage 读面）· `packages/cdd-engine/src-next/contract/judge.ts`（`#buildPolicy` 改派生 · `Contract.policy()` / `ruleRows()` / `validateLedger`）· `packages/cdd-engine/src-next/contract/doc.ts`（四类 parse 记录共用 change-history 读面）· `packages/cdd-engine/src-next/session/preflight.ts`（`plan-ledger` 门 · `checked` · `LedgerFacts`）· `packages/cdd-engine/src-next/face/words.ts`（门与 skipped/info 词行）· `packages/cdd-engine/src-next/face/cli.ts`（`checked` 的派发面渲染，通过 + 拒绝两条路径）· `packages/cdd-engine/src-next/contract/__tests__/judge.test.ts` · `packages/cdd-engine/src-next/session/__tests__/preflight.test.ts` · `packages/cdd-engine/src-next/face/__tests__/cli.test.ts`
- **Consumes**: `contract/declare.ts:53-78` 的 `RegistryElement` / `ElementRegistry` / `DeclaredRegistries`（元素面，与规则面并列而非其成员；**本任务不改它**——规则面住 `contract/rules.ts`）· `contract/judge.ts` 的 `#buildPolicy` 硬编码族（实测 15 个 `new`）· `invariants.ts` 的 `Invariant` 基类（`name` + `evaluate(ctx)`）、`changeHistory(ctx)` 与 `firstVersion` 两个既有共享读面 · `session/preflight.ts` 的 `PreFlightVerdict`（现无 `checked`）· `session/ledger.ts` 的 `closedWaves()` / `rowFor()` / `roundCount()`（ledger 规则数据源）· `session/graph.ts` 的 `batches()`（分层判据）。
- **Produces**:
  ```ts
  // contract/rules.ts — 规则声明面：规则清单的唯一真源（声明即工厂，两类各持一种判据入口）
  export interface DocRuleDeclaration {
    readonly id: string;                       // kebab，等于策略实例的 name（一个概念一个名字）
    readonly docKeys: readonly DocKey[] | "all";
    readonly scope: "doc";
    readonly create: () => Invariant;          // evaluate(ctx: JudgeContext)
  }
  export interface LedgerRuleDeclaration {
    readonly id: string;
    readonly docKeys: readonly DocKey[] | "all";
    readonly scope: "ledger";
    readonly create: () => LedgerRule;         // evaluate(ctx: JudgeContext, ledger: LedgerFacts)
  }
  export type RuleDeclaration = DocRuleDeclaration | LedgerRuleDeclaration;
  export const RULE_REGISTRY: readonly RuleDeclaration[];   // 21 行：doc 19 + ledger 2

  // contract/judge.ts
  export interface LedgerFacts {
    readonly planTasks: readonly number[];
    readonly recordedTasks: readonly number[];
    readonly closedWaves: readonly (readonly number[])[];
    readonly snapshots: readonly { readonly wave: string; readonly planTasks: readonly number[] }[];
    readonly layers: readonly (readonly number[])[];   // TaskGraph.batches() 的层
    readonly maxRecordedTask: number;
  }
  export class Contract {
    static policy(): Record<DocKey, readonly Invariant[]>;                                  // 只吃 doc 型
    static ruleRows(): readonly RuleDeclaration[];                                          // 清单数据面
    validateLedger(input: ContractInput, ledger: LedgerFacts): Finding[];                    // 只吃 ledger 型
  }

  // contract/invariants.ts — 两条 lineage 规则塌成一条（唯一判定：header 缺席）
  export class FrontMatterVersionInLineageInvariant extends Invariant { /* name = "front-matter-version-in-lineage" */ }
  // 删除：FrontMatterLastRowInvariant（header=末行）· ChangeHistoryVersionAscendingInvariant（版本序）
  // 新增：RowHomeInvariant · ListMarkerInvariant · LedgerLayeringRule · LedgerTaskSetRule
  // 共享读面：Invariant 基类的 protected historyVersions(ctx)（两条腿各一份私有副本删除）

  // session/preflight.ts
  export type PreFlightGateName = "tree-clean" | "in-flight" | "graph" | "plan-ledger" | "wave" | "doc-contract";
  export type PreFlightReason = "dirty-tree" | "graph" | WaveGateReason | "doc-contract";  // 零死值：plan-ledger/缺事实包皆不占 reason
  export interface PreFlightVerdict {
    // …既有字段不动…
    /** 已检面：`${gate}` 或 `${ruleId}: ${passed|failed|skipped (原因)|info (提示)}`。 */
    readonly checked: readonly string[];
  }
  ```
- **Steps**:
  - 写失败测试 `rules.test.ts`（声明面自检）：`RULE_REGISTRY` 共 **21** 行（doc 19 + ledger 2）· 每行 `id` 唯一且 kebab · 每行 `create()` 得到一个实例且实例 `name` 逐字等于该行 `id` · doc 行实例是 `Invariant`（一参 `evaluate(ctx)`）、ledger 行实例是 `LedgerRule`（两参 `evaluate(ctx, ledger)`）· 公共面 6 个 id 在册 —— checkable: FAIL（模块不存在）
  - 写失败测试（变更记录版本唯一，四类文档同判）：`phase-spec` / `single-spec` / `plan` / `overall` 各造一份变更记录含两行 `v0.2` → 四类 findings 均含 `kind === "change-history-version-unique"` 且 `field === "Change history"` —— checkable: FAIL（今日只在 overall 生效）
  - 写失败测试（**唯一**的 lineage 判定 = header 缺席，且方向/端点无关）：front-matter `version: v0.9` 而变更记录里从未出现 `v0.9` → 恰好一条 `kind === "front-matter-version-in-lineage"`；**三条绿 pin**——升序（`v0.1, v0.2, v0.3`，header `v0.3`）· 降序（`v0.3, v0.2, v0.1`，header `v0.3`）· 仓内真实非单调冻结形态（`v0.2, v0.3, v0.1, v0.4`，header `v0.4`）各自零 finding 且零 `front-matter-version-in-lineage` —— checkable: FAIL（今日有两条互斥腿且降序/非单调形态会红）
  - 写失败测试（版本序与末行两条腿确已撤除）：`grep -n "matches-last-row\|version-ascending" packages/cdd-engine/src-next/contract --include='*.ts'` 在**非测试**面零命中，且 `Contract.policy()` 的实例集合里无这两个 name —— checkable: FAIL（今日在册）
  - 写失败测试（变更行落位 / 列表标记双写）：`## Phase inventory` 表格里放一行首列 `v0.9` → `kind === "change-history-row-not-in-other-table"` 且 fix 句为「把该行移回 Change history」；正文写 `- - 重复标记` → `kind === "list-marker-not-doubled"` 且 fix 句为「合并为单枚标记」 —— checkable: FAIL
  - 写失败测试（拆腿后的 kind 重锚）：overall 里登记锚点重复 → `kind === "presence"`；plan 里重复 task id → `kind === "task-id-unique"`；overall 里重复 phase id → `kind === "phase-id-unique"`；小节序颠倒 → `kind === "section-order"` —— checkable: FAIL
  - 实现拆/撤腿与新策略（一个策略一个类）：`UniquenessInvariant` 的 heading 重复登记腿并入 `PresenceInvariant`，三条身份腿独立成 `ChangeHistoryVersionUniqueInvariant` / `TaskIdUniqueInvariant` / `PhaseIdUniqueInvariant`；`OrderInvariant` 保留小节序单腿；`SelfBoundedInvariant` 的两条腿塌成 `FrontMatterVersionInLineageInvariant`（只判缺席）；删除 `FrontMatterLastRowInvariant` 与 `ChangeHistoryVersionAscendingInvariant`；新增 `RowHomeInvariant` / `ListMarkerInvariant`；`judge.test.ts` 的 `selfBounded` 断言同批重锚为 kebab id —— checkable: 上述用例转绿
  - 给四类文档补 change-history 读面：`contract/doc.ts` 的三类非 overall parse 记录与 `OverallParsed` 同形暴露 `tables["Change history"]`（同一次 `#tableSection(sections, "## Change history")`），并在 `Invariant` 基类上落**一个** `protected historyVersions(ctx)` 共享读面（两条腿的私有副本删除） —— checkable: `grep -n "this.overall(ctx)" packages/cdd-engine/src-next/contract/invariants.ts` 在 lineage 两处零命中且全文件计数从 9 降到 7
  - 写失败测试（ledger 两条规则与 skipped）：`validateLedger(input, { planTasks: [1,2,3], recordedTasks: [1,2], layers: [[1],[2],[3]], closedWaves: [[1],[2]], snapshots: [], maxRecordedTask: 2 })` → 零 finding；`recordedTasks = [1,2,11] · planTasks = [1,2,3]`（账本记了一个计划里没有的任务）→ 恰好一条 `kind === "planned-tasks-vs-recorded-tasks"`；**绿 pin（本 phase 的真实形态）**：`planTasks = [1..9] · recordedTasks = [1,2,3,4,5,7] · maxRecordedTask = 7` → **零 finding** 且 `checked` 只出 `plan-ledger: info (plan leads ledger by 3 tasks)`（6、8、9 都在等）——「计划有、账本没有」零判压；已闭合波次 `[[1,2]]` 而 layers 为 `[[1],[2]]` → `kind === "ledger-layering"`；整层批 `[[2,3]]` 对 layers `[[1],[2,3]]` → 绿；**层内子集** `[[2]]` 对 layers `[[1],[2,3]]` → 绿（subset 读法与 Task 7 的追加波一致，记在类注释里）；本轮未提供 `LedgerFacts`（非 plan/wave/branch 派发）→ 清单该两行为 `skipped (no ledger facts)` —— checkable: FAIL
  - 实现两条 ledger 策略 + `LedgerFacts` 组装缝（`preflight.ts` 从 `Ledger` + 计划文本 + `TaskGraph.batches()`（`layers`）构造；`snapshots` 读波行 `planTasks`，本任务里可缺省 `[]`，Task 7 接上） —— checkable: 上述用例转绿
  - 实现 `#buildPolicy` 派生 + `Contract.policy()` / `ruleRows()` / `validateLedger`（`policy()` 只取 `scope === "doc"`；`validateLedger` 只取 `scope === "ledger"` 并逐个喂 `(ctx, ledger)`）；删除 15 个硬编码实例化 —— checkable: `grep -n "new .*Invariant()" packages/cdd-engine/src-next/contract/judge.ts` 零命中
  - `PreFlight` 增 `plan-ledger` 门（紧随 `graph` 之后、`wave` 之前）：doc / wave / branch 派发都跑；`checked` 逐条渲染，doc 作用域声明在 wave / branch 派发（`ctx.doc === null`）**19 行各一行** `skipped (no doc target)`，ledger 作用域在缺事实包时渲染 `skipped (no ledger facts)`（`ok: true`、`reason` 缺席）；plan-ledger 拒绝只填 `gate: "plan-ledger"` + 自己的词行，`reason` 缺席（门名承载身份，零死值） —— checkable: `preflight.test.ts` 新用例绿（wave 派发 `checked` 含 19 条 skipped 行；plan-ledger 拒绝的 `reason === undefined`）
  - `checked` 的生产读者（本任务内落，不留成测试独占字段）：`face/cli.ts` 在**通过路径与拒绝路径**都渲染 `checked:` 行（逐条 `${ruleId}: ${outcome}` 与门名，缩进与既有 details 面一致） —— checkable: `cli.test.ts` 新用例断言两条路径的 stdout 均含 `checked:` 行且含一条 `plane`… 具体字节由用例钉死；`grep -rn "checked" packages/cdd-engine/src-next/face packages/cdd-engine/src-next/session --include='*.ts' | grep -v __tests__` 同时命中 preflight 与 cli
  - 变异验证用例：删掉中间一条账本记录（`recordedTasks` 从 `[1,2,3]` 改成 `[1,3]`）→ `plan-ledger` 门必须红 —— checkable: 用例绿（「放宽不得滑成永远绿」的守卫）
  - 窗期放行用例：`planTasks = [1,2,3,4] · recordedTasks = [1,2,3]` → 放行且 `checked` 含 `plan-ledger: info (plan leads ledger by 1 tasks)`，`verdict.ok === true` 且 `verdict.reason` 缺席 —— checkable: 用例绿
- **Acceptance**: 六条公共规则（spec §3.1 表）在四类文档 / plan+账本上各有红 pin · **变更记录历史行原文即为绿**（夹具即真实形态：升序 / 降序 / 非单调冻结形态各一条绿 pin）· header 未出现在 lineage 一条红 pin，且**只有这一条 lineage 判定**（`front-matter-version-matches-last-row` 与 `change-history-version-ascending` 在源码面零命中，无 `version-order` 策略、无其 pin）· 变更行落进别的表格 / 列表标记双写各有红 pin 与点名 fix 句 · 散文「N 任务 / M 波」零判压 · 声明面 **21 行（doc 19 + ledger 2）**，`rules.test.ts` 断言行数、id 唯一且 kebab、`id === 实例 name`、两型判据入口形状 · `plan-ledger` 门在 doc/wave/branch 三面都跑，wave 与 branch 派发的 `checked` 各含 **19** 条 doc 声明的 `skipped (no doc target)` 行 · `PreFlightReason` 零死值（无 `no-ledger-facts` 成员；缺账本事实包只出 skipped 行；plan-ledger 拒绝的 `reason` 缺席）· **`checked` 有生产读者**：CLI 的通过与拒绝两条路径都渲染 `checked:` 行（`cli.test.ts` 钉字节），不留测试独占字段 · 变异用例与窗期用例绿 · `pnpm -C packages/cdd-engine test` 绿 · 零裸函数门绿
- **DependsOn**: none
### Task 3: `LineIdentity`（三种行一个身份面 · branch 身份写回 · `next:` 入参）

- **Objective**: 把今天两套平行的漂移判定合到一个身份面，并补上第三行：branch 线以**其计划文档的 `doc-revision`** 为 reviewed 身份（不新增 ref kind、不引入 commit sha）；`next:` 的发令判据从「branch 面已闭合」改为「该线是否有可派发的 open round」，事实由持 ledger 的一侧入参传入，capsule 保持纯渲染。
- **Files**: Create `packages/cdd-engine/src-next/session/line-identity.ts` · `packages/cdd-engine/src-next/session/__tests__/line-identity.test.ts`; Modify `packages/cdd-engine/src-next/session/ledger.ts`（`docLineVerdict` / `#briefDrift` 改调身份面；`targetLineOpen` 的产出面读既有 `reviewGate` / `lineRoute`，不新增读面）· `packages/cdd-engine/src-next/session/run.ts`（`#bookkeep` 的写回条件 + `targetLineOpen` 的产出与 route 入参）· `packages/cdd-engine/src-next/session/next.ts`（`resolve` 增「目标面 open」入参）· `packages/cdd-engine/src-next/face/capsule.ts`（`routeText` 传参，仍零判定）
- **Consumes**: `session/ledger.ts` 的 `docLineVerdict` 与 `#briefDrift`（两套判定合一的输入，两条均按方法名点名）· `session/ledger.ts` 的 `recordReviewedRevision` / `recordReviewedBrief` / `reviewedRevisionOf` · `session/ledger.ts` 的 `reviewGate(key, doc, type)`（drift-aware 的行门；branch 的 `LedgerKey` 即 `"branch"`，见 `#roundKey`）与 `lineRoute(key, type)`（该线 active C5 route）—— `targetLineOpen` 的**唯一产出面** · `session/run.ts#bookkeep` 的唯一身份写回点（现只对 `frame.phase === "review"`）· `session/next.ts` 的 `Route` / `PIPELINE_NEXT` / `NextStepRouter.resolve`（既有 **static** 入口，返回非空 `Route`）· `face/capsule.ts:139` 与 `session/__tests__/next.test.ts` 的既有非空用法 · `session/run.ts:67-77` 的 `AuditTarget`（**branch 线目标 = `{ kind: "branch" }`，不带 doc**，计划路径来自 lifecycle 的 `#planPath`；`face/cli.ts:135,962` 是同形联合 `WorkScene.target`，不带 doc 的实质主张不变）
- **Produces**:
  ```ts
  // session/line-identity.ts
  export interface CurrentRevision {
    /** 该行「判定输入」的当前修订（doc 行 = 文档内容；wave 行 = 渲染后 brief；branch 行 = 计划文档）。 */
    readonly ref: ReviewedRevisionRef;
  }
  export class LineIdentity {
    /** drift(same|drift|null) —— 三条行共用的唯一判定：记录的身份 vs 判定时刻现读的身份。
     *  null = 无记录 / 读不到（沿用既有的 legacy 闭合面，只有 present facts 才落判定）。 */
    verdict(recorded: ReviewedRevisionRef | null, current: CurrentRevision | null): "same" | "drift" | null;
  }

  // session/next.ts —— 对既有 class 的扩展（不新增并行接口，胶囊侧不存在 null 分支）
  export class NextStepRouter {
    // …既有 next(state, ref) / handoff(key) / render 面不动…
    /** targetLineOpen —— 目标面「是否有可派发的 open round」的**事实入参**（由持 ledger 的一侧
     *  在算 route 时给出；router 只做判定，capsule 只做渲染）。返回**非空** `Route`（今日形状不变）。
     *  `targetLineOpen === false` 且 `key === "wave"` 时返回 branch 面的下一站（复用既有
     *  `NextStepRouter.handoff("branch")` 派生入口）。 */
    static resolve(
      active: Route | null,
      key: PipelineKey | null,
      targetLineOpen?: boolean,
    ): Route;
  }

  // session/run.ts —— targetLineOpen 的唯一产出面（router 只消费一个布尔，零第二份判定）
  // targetLineOpen = `ledger.reviewGate("branch", <计划路径>, "branch").kind === "open"`
  //                ∨ `ledger.lineRoute("branch", "branch") !== null`
  // 判定的是「这一线有没有可派发的 open round」（drift 打开 / 仍持 active hop），
  // **不是** `PipelineFaceState.closed`——后者是 spec §4.2 判为错的面；两个读面均已在册，零新读面。
  ```
- **Steps**:
  - 写失败测试 `line-identity.test.ts`：同 ref → `same`；异 ref 且同 kind → `drift`；异 kind → `drift`；`recorded === null` 或 `current === null` → `null` —— checkable: FAIL（模块不存在）
  - 实现 `LineIdentity`，并把 `Ledger.docLineVerdict` 与 `#briefDrift` 改为委托它（行为逐条不变，`ledger.test.ts` 全绿） —— checkable: `ledger.test.ts` 零改用例全绿（既有断言即行为等价证明）
  - 写失败测试（branch 身份写回）：一次 `branch-review` 轮完成后，`progress.json` 的 `branch` 行带 `reviewedRevision {kind: "doc-revision", doc: <计划路径>, doc_hash}` —— checkable: FAIL（今日 branch 行永不落该字段）
  - 实现写回：`run.ts#bookkeep` 的身份写回条件从「`frame.phase === "review"`」改为「review 或 branch-review」，branch 腿用 `this.#planPath` 的 `docRevision`（与 wave 腿共用 `#planPath`，零新路径源） —— checkable: 上述用例转绿
  - 写失败测试（branch 重开）：branch 线闭合后计划修订前进 → `LineIdentity.verdict` 为 `drift`，行门判 `open` 并允许再开一轮 branch review；计划未动 → `same` 且闭合 —— checkable: FAIL
  - 写失败测试（`next:` 不自相矛盾 · 两向 pin，产出面 = `Ledger.reviewGate("branch", planPath, "branch")` 的 `open` 分支 + `lineRoute("branch", "branch")` 的非空 active route）：① 计划未动（`reviewGate` 判 `same`）且该线无待办轮次（`lineRoute` 为 null）→ `targetLineOpen === false` → `resolve` 返回 branch 面下一站（`kairos:cdd-close`），不再返回 `PIPELINE_NEXT.wave` 的字面；② 计划修订前进（`reviewGate` 判 `open`）→ `targetLineOpen === true` → `resolve` 发 `review --type branch` 字面 —— checkable: FAIL（今日恒返回字面，且无 `targetLineOpen` 的产出面）
  - 实现 `targetLineOpen` 的产出（`run.ts` 算 route 时现读 `reviewGate("branch", #planPath, "branch")` 与 `lineRoute("branch", "branch")` 两个既有面，零新读面、不读 `PipelineFaceState.closed`）与 `static resolve(active, key, targetLineOpen?)`（返回**非空** `Route`）：`key === "wave"` 且 `targetLineOpen === false` 时返回 `NextStepRouter.handoff("branch")` 的下一站（`kairos:cdd-close` 那一站）；其余情形逐字沿用今日行为；`capsule.#routeText` 只多一个布尔入参并原样透传，**不存在 null 分支**（capsule 零 ledger 读、零判定；`face/capsule.ts:139` 与 `session/__tests__/next.test.ts` 的既有非空用法零改） —— checkable: 上述用例转绿；`grep -n "ledger" packages/cdd-engine/src-next/face/capsule.ts` 零命中
- **Acceptance**: `line-identity.test.ts` 四组用例绿 · `docLineVerdict` 与 `#briefDrift` 两套判定收敛为一次实现（`grep -c "sameRef" packages/cdd-engine/src-next/session/ledger.ts` 不再直接出现于两处）· branch 行终审后落 `reviewedRevision`（`doc-revision` kind，指向计划）· 计划前进可开第二轮、未动保持闭合 · 波线闭合时 `next:` 只在 branch 线可派发时发 `review --type branch` 字面，而 `targetLineOpen` 由 `Ledger.reviewGate("branch", <计划路径>, "branch")` 的 `open` 分支 / `lineRoute("branch", "branch")` 非空算出（两向 pin：计划未动 + 无待办 → `false` 落 `kairos:cdd-close`；计划前进 → `true` 发 `review --type branch`；不读 `PipelineFaceState.closed`） · **`NextStepRouter.resolve` 仍是非空静态面**（零 null 分支：capsule / preview / `next.test.ts` 均不新增空判定）· capsule 零 ledger 读（纯渲染面）· `pnpm -C packages/cdd-engine test` 绿
- **DependsOn**: none

### Task 4: `InFlight`（在飞记录 · 锁 · 三态 · 采样收口 · `--steal-stale`）

- **Objective**: 把在飞状态升格为唯一事实并交出唯一的锁：`InFlight` 记录（pid/pgid · 命令 · slug · startedAt · wave/phase · briefHash · plan · 采样尾迹）在 spawn **之前**写入工作树级 `.kairos/cdd/`；采样循环经同一个类覆写；收工释放；崩溃 / kill / 超时后**记录留档且不由任何退出路径移除**；`liveness.json` 独立产物消灭。同时落 `--steal-stale` 旗标与损坏记录三态。
- **Files**: Create `packages/cdd-engine/src-next/session/inflight.ts` · `packages/cdd-engine/src-next/session/__tests__/inflight.test.ts`; Modify `packages/cdd-engine/src-next/face/lifecycle.ts`（**真派发的唯一写点**：取锁 / 写意图 / 接管 / 释放 · `ChildRun` 换 handle · 删 `liveness.json` 路径）· `packages/cdd-engine/src-next/face/termination.ts`（`SamplingLoop` 写点改调 `InFlight.heartbeat`；`stop()` **删掉 `rmSync(heartbeatPath)` 腿**——记录的移除只归 `release()` / `steal()`，自结束路径不得绕过）· `packages/cdd-engine/src-next/face/__tests__/termination.test.ts`（heartbeat 夹具改指记录文件）· `packages/cdd-engine/src-next/face/declare.ts`（`ARGV_CHANNEL.stealStale` + 三命令 keys）· `packages/cdd-engine/src-next/face/words.ts`（持有 / 可接管 / 损坏 / 恢复三句）· `packages/cdd-engine/package.json`（`proper-lockfile`）
- **Consumes**: `infra/atomic.ts` 的 `AtomicWriter`（Task 1）· `infra/proc.ts` 的 `ProcessFacts.live/groupMembers`（Task 1）· `infra/workspace.ts` 的 `WorkspaceRoot`（`.kairos/cdd` 命名空间根与 `.gitignore` 标记）· `face/termination.ts:359-443` 的 `SamplingLoop`（现直写 `heartbeatPath`）· `face/lifecycle.ts:183` 的 `heartbeatPath` 派生点
- **Produces**:
  ```ts
  // session/inflight.ts
  export interface InFlightRecord {
    readonly pid: number; readonly pgid: number; readonly command: string; readonly slug: string;
    readonly startedAt: number; readonly wave: string | null; readonly phase: string | null;
    readonly briefHash: string | null; /** = acquire 时刻现算的 `ReviewRefs.briefRevision(planPath, 当刻 brief 文本).brief_hash`（同一哈希面，零新哈希面；非 wave 派发为 null）。 */
    readonly plan: string | null;
    readonly sampledAt: number | null; readonly verdict: string | null;
  }
  export type InFlightState =
    | { readonly kind: "absent" }
    | { readonly kind: "held"; readonly record: InFlightRecord; readonly alive: boolean }
    | { readonly kind: "corrupt"; readonly locked: boolean };
  /** `held.alive` 的判据：`ProcessFacts.live` 的 true / false 直取；其 `null`（`startTime` 读不到）
   *  在本边界折成 `true`（宁可拒绝接管，不可误接管）；本字段保持 boolean，不引入三值。 */
  export class InFlight {
    /** 工作树级路径 `.kairos/cdd/in-flight.json` 与其锁（锁载体 = 同目录）。 */
    static readonly FILE: string;
    /** 发布 `.kairos/.gitignore`（`*`）标记——记录写之前的前置条件，不依赖 WorkspaceRoot.ensure 的时点。 */
    ensureMarker(): InFlight;
    /** spawn 之前唯一调用点（**只由真派发路径调用**：门只 `inspect()`，零写），写序固定：`ensureMarker()` → `lock()`
     *  （`stale: 12h · update: 60s · realpath: false · retries: 0`）→ **取锁成功后**
     *  `AtomicWriter` 写记录。`stealStale` 只在此处生效：既有记录判定亡（或损坏且锁在）时先
     *  `steal` 再取锁；否则取锁失败时只**读**既有记录再抛 `HoldingError`
     *  （携带 holder 事实）——此刻对记录零写，活持有者的事实不被挑战者覆盖。 */
    acquire(record: InFlightRecord, options?: { readonly stealStale?: boolean }): void;
    /** 派发期间的采样尾迹覆写（身份字段保持不变）。 */
    heartbeat(sample: { readonly sampledAt: number; readonly verdict: string }): void;
    /** 收工释放（`acquire` 的反序：删记录 → 解锁；唯一的两条移除路径之一）。 */
    release(): void;
    /** 判定时刻现读：三态（absent / held(alive) / corrupt(locked)）。 */
    async inspect(): Promise<InFlightState>;
    /** 显式接管：前提 = 记录 pid 已不存在（或损坏且锁在）；顺手清锁与记录。 */
    async steal(reason: string): Promise<InFlightRecord | null>;
  }
  ```
- **Steps**:
  - 添加依赖 `pnpm -C packages/cdd-engine add proper-lockfile` —— checkable: `package.json#dependencies` 含之，`pnpm -C packages/cdd-engine install` 零报错
  - 写失败测试（取锁即写意图 + 树不脏）：全新临时仓库（无 `.kairos/`）→ `new InFlight(root, slug).acquire(record)` → 记录文件存在且字段齐全；`git status --porcelain` 为空（标记已发布） —— checkable: FAIL（模块不存在）
  - 写失败测试（第二次取锁被拒 + 零写）：对同一根第二次 `acquire` 抛 `HoldingError`，携带 `pid` / `command` / `startedAt` / `wave` / `slug`，且**失败后记录文件字节逐字不变**（失败前 `readFileSync` 取字节快照，失败后比对） —— checkable: FAIL
  - 写失败测试（跨 slug 互斥）：slug A 记录在册 → slug B 的 `acquire` 同样被拒（锁在工作树级） —— checkable: FAIL
  - 写失败测试（收工释放 / 崩溃留档）：`release()` 后记录与锁都没了；模拟崩溃（只写记录、不解锁、进程已亡）→ `inspect()` 返回 `held` 且 `alive === false`，记录仍在 —— checkable: FAIL
  - 写失败测试（损坏三态）：记录写成半截 JSON 且锁在 → `corrupt` 且 `locked === true`；同情形锁不在 → `corrupt` 且 `locked === false`；`steal()` 在前者放行并清锁、在「记录可读但 pid 活着」时**抛错拒绝** —— checkable: FAIL
  - 写失败测试（`briefHash` 单源 · acquire 时现算）：wave 派发时记录里的 `briefHash` === 同时刻 `ReviewRefs.briefRevision(planPath, 当刻 brief 文本).brief_hash`（`briefContent` 取 `scene.briefPath` 的文本，`planPath` 取计划路径）；**本波首次派发（账本里没有该波的 `brief-revision` 记录）时 `briefHash` 仍非 `null`**；doc / branch 派发（非 wave）→ `null`；另立一条 pin：该哈希只经 `ReviewRefs.briefRevision` 一处算出（源码面零新哈希面），`Ledger.reviewedRevisionOf(key)` 的 `brief_hash` 只作**哈希同源**的旁证，不作值相等的断言 —— checkable: FAIL
  - 写失败测试（`startTime` 不可读时不接管）：在册持有者但 `ProcessFacts.live` 返回 `null`（注入缺失 `startTime` 的进程行）→ `inspect()` 返回 `held` 且 `alive === true`，`steal()` **抛错拒绝**（非 POSIX 分支以命名 skip 逃生门标名） —— checkable: FAIL
  - 写失败测试（`acquire` 的 `stealStale` 只在真派发面生效）：持有者 pid 已亡 + `stealStale: true` → `acquire` 先 `steal` 再取锁，记录被新派发覆写；持有者 pid 活 + `stealStale: true` → 仍抛 `HoldingError`（旗标不得越过「活着就不接管」）；未传 `stealStale` → 行为与今日一致 —— checkable: FAIL
  - 写失败测试（pid 复用）：记录 `startedAt` 与在册进程启动时刻差 10 分钟 → `alive === false`（`ProcessFacts.live` 的容差） —— checkable: FAIL
  - 实现 `InFlight`：`acquire` 的写序固定为 `ensureMarker()` → `lock()`（`stale: 12h · update: 60s · realpath: false · retries: 0`）→ **取锁成功后**才 `AtomicWriter` 写记录；取锁失败先**只读**既有记录（`stealStale` 且判定亡则先 `steal`，否则抛 `HoldingError`）——零写；`release()` 走反序（删记录 → 解锁）；`steal` 走「判亡 → 清锁 → 删记录」；`held.alive` 由 `ProcessFacts.live` 直取，其 `null` 折成 `true`（留一句注释说明理由） —— checkable: 上述九组用例转绿（含「第二次 `acquire` 失败后记录字节不变」与两向 `stealStale` 用例）
  - 接线 `CliLifecycle`：派发前 `ensureMarker()` + `acquire(record, { stealStale })`（门只判不写，写入面全在此）；**唯一 `release()` 调用点 = 本轮正常收工**（子进程自然结束且 handoff 读完）；**崩溃 / kill / 超时 / 未捕获异常等一切非正常终止路径零 `release()`**（记录留档，锁由库在优雅退出时移除）；`--dry-run` 从不 `acquire()`，故无 `release()`；门通过到 `acquire` 之间的竞态（另一派发抢先取锁）由 `HoldingError` 上传给 CLI，走与门同一条 `held` BLOCK 报文（Task 6 钉） —— checkable: `termination.test.ts` 的终端态用例全绿，且新增「崩溃后记录仍在」断言
  - `SamplingLoop` 改调 `InFlight.heartbeat`，删除 `heartbeatPath` 直写与 `liveness.json` 派生；`stop()` 的 `rmSync(heartbeatPath)` 腿**删除**（自结束也不碰记录，移除只归 `release()` / `steal()`）；`Sampler.excludesFor` 的排除项改指记录文件 —— checkable: 源码面 `grep -rn "liveness.json" packages/cdd-engine/src-next --include='*.ts' | grep -v __tests__` 零命中，且 `face/termination.ts` 内零 `rmSync`（heartbeat 夹具同任务改指记录文件）；新 pin：自结束轮次在 `release()` 前记录仍在，释放后记录与锁同时消失
  - `declare.ts` 增 `ARGV_CHANNEL.stealStale = { flag: "--steal-stale", type: "bool", help: … }` 并在 implement / review / fix 三命令的 keys 里挂上（命令面仍八条） —— checkable: `cli.test.ts` 的结构 pin 绿（八命令不变）+ 新用例：`cdd implement --steal-stale` 出现在该命令 help 面
  - `words.ts` 补四组词行：持有报文（pid / 命令 / startedAt / 已运行时长 / 波键 / slug）· 可接管提示 · 记录损坏两形 · 恢复三句（canonical 英文串：`look at the working tree first` · `commit the changes that work` · `discard the ones that are broken`，与 Constraints 逐字同一串） —— checkable: `words.guard.test.ts` 绿 + 新用例断言三句逐字在册
- **Acceptance**: 记录在 spawn 之前即存在且字段齐全 · **写序 = 锁先于记录**：第二次 `acquire` 被拒时对记录零写（记录字节逐字不变，持有者事实不被覆盖）；`stealStale` 只在此写点生效（pid 亡则接管、pid 活仍拒）· `briefHash` = acquire 时刻现算的 `ReviewRefs.briefRevision(planPath, 当刻 brief 文本).brief_hash`（本波首次派发 – 账本无记录 – 时仍非 `null`；该哈希零新面，`reviewedRevisionOf` 只作同源旁证；非 wave 派发为 `null`）· 唯一 `release()` 调用点 = 正常收工（子进程自然结束且 handoff 读完）；崩溃 / kill / 超时 / 未捕获异常零 `release()`；`--dry-run` 不 acquire 故无 release（记录不由任何退出路径移除——`SamplingLoop.stop()` 不再 `rmSync` 记录，自结束轮次在 `release()` 前记录仍在、释放后记录与锁同时消失；锁由库在优雅退出时移除）· 跨 slug 互斥生效 · pid 复用判亡（`startedAt` 容差）· `startTime` 读不到时视为持有（`alive: true`、`steal` 拒绝，有 pin）· 损坏三态与 `steal` 的拒绝/放行 · 全新命名空间被杀后 `git status --porcelain` 为空 · `liveness.json` 零残留（源码面）· 恢复三句以 canonical 英文串在 `words.ts` 在册 · `--steal-stale` 在 implement/review/fix 帮助面在册 · `pnpm -C packages/cdd-engine test` 绿 · 零裸函数门绿
- **DependsOn**: 1

### Task 5: 崩溃身份单源（`RoundNaming` · `dispatchBase` / `commitsSince` · 迟到落盘提示）

- **Objective**: 让 crash 记录的两处身份（文件名与 `attemptedHandoff`）从 frame 的单一派生面出来，修掉「wave 号与真实崩溃波不符」「`attemptedHandoff` 指向另一个任务」；给 `CrashRecord` 增 `dispatchBase`（派发前 HEAD）与 `commitsSince`（此后新增提交），并补 kill / 超时后的迟到落盘提示。
- **Files**: Modify `packages/cdd-engine/src-next/session/round-naming.ts`（增 crash 名/路径派生）· `packages/cdd-engine/src-next/session/ledger.ts`（`CrashRecord` 两字段 · `writeCrash` / `readCrash` 收名字面）· `packages/cdd-engine/src-next/session/run.ts`（`#capsuleLines` 的 crash 读面改调 `RoundNaming`、删 `lane` 局部量）· `packages/cdd-engine/src-next/face/lifecycle.ts`（crash 写点改调 `RoundNaming` · 捕获 dispatch 前 HEAD · 计算 `commitsSince`）· `packages/cdd-engine/src-next/face/words.ts`（迟到落盘提示词行）· 测试 `session/__tests__/round-naming.test.ts` · `session/__tests__/ledger.test.ts`
- **Consumes**: `session/round-naming.ts` 现有的 `report` / `evidence` / `brief` 派生与 `op(frame)` / `prefix(frame)`（crash 与它们同源）· `session/ledger.ts` 的 `crashName/crashPath(lane, round)` 与 `CrashRecord` · `face/lifecycle.ts` 的 `writeCrash(\`${op}.${frame.type}\`, …)` 与 `attemptedHandoff` · `session/run.ts#capsuleLines` 的 `const lane = \`${op}.${frame.type}\`` 局部量与 `readCrash(lane, frame.round)` / `crashPath(lane, frame.round)` 两个调用点
- **Produces**:
  ```ts
  // session/round-naming.ts
  export class RoundNaming {
    // …既有报告 / 证据 / brief 派生不动…
    /** crash 记录的 workspace 相对名：`crash-{line}-{op}-{round}.json`——`line` 由 frame 的
     *  单一身份派生（wave → `tasks-{tasks}`；branch → `branch`；doc → `spec` / `plan`），
     *  `op` 保留 verb（同波同轮的 implement 与 review 两条崩溃记录不得互相覆盖）。 */
    crashName(frame: OpenFrame): string;
    crashPath(frame: OpenFrame): string;
  }

  // session/ledger.ts
  export interface CrashRecord {
    // …既有字段不动…
    /** 派发前的 HEAD（事后诊断面；进程未 spawn 或非 git 仓库 → null）。 */
    readonly dispatchBase: string | null;
    /** 派发前 HEAD 之后新增的提交（`{sha} {subject}` 逐条；无新增 / 非 git → 空数组）。 */
    readonly commitsSince: readonly string[];
  }
  export class Ledger {
    /** 写 crash 恢复记录 —— 名字由 RoundNaming 给出（单源），本面不再派生 lane。 */
    writeCrash(name: string, record: CrashRecord): void;
    readCrash(name: string): CrashRecord | null;
  }
  ```
- **Steps**:
  - 写失败测试 `round-naming.test.ts`（crash 名与 frame 同源，verb 不丢）：wave 帧 `{type: "wave", params: {tasks: "3,4"}, round: 2}` 的 `crashName` 在 implement 轮为 `crash-tasks-3,4-implement-2.json`、在 review 轮为 `crash-tasks-3,4-review-2.json`；branch 帧 → `crash-branch-review-2.json`；doc 帧 → `crash-plan-review-2.json`；且 `crashPath` 与 `crashName` 同一派生（`path.endsWith(name)`） —— checkable: FAIL（今日名字由 `lifecycle.ts` 的字符串模板给出）
  - 写失败测试（同波同轮两类崩溃并存）：同一波的 implement-2 与 review-2 各崩一次 → 磁盘上两条记录并存（`crash-tasks-3,4-implement-2.json` 与 `crash-tasks-3,4-review-2.json`），`readCrash` 各读到自己的那份、互不覆盖 —— checkable: FAIL
  - 实现 `RoundNaming.crashName/crashPath`（`op` 复用既有 `RoundNaming.op(frame)`）并在 `lifecycle.ts` 改调；`Ledger.writeCrash/readCrash` 收 name；删除 `lane` 形参与 `crashName(lane, round)` 旧签名 —— checkable: 上述两组用例转绿 + 源码面 `grep -rn 'crash-\${lane}' packages/cdd-engine/src-next --include='*.ts' | grep -v __tests__` 零命中
  - `session/run.ts#capsuleLines` 的 crash 读面改调 `RoundNaming.crashName/crashPath(frame)` 并删 `const lane = \`${op}.${frame.type}\`` 局部量（capsule 的 failure 手背面与 lifecycle 的写面用同一个名字） —— checkable: 源码面 `grep -rn 'frame\.type}' packages/cdd-engine/src-next --include='*.ts' | grep -v __tests__ | grep -v round-naming` 零命中，且 `session/run.ts` 的调用形如 `readCrash(RoundNaming.crashName(frame))`（单参数、frame 派生）且全树零双参 `readCrash(` 调用（`grep -rn "readCrash([^)]*," packages/cdd-engine/src-next --include='*.ts' | grep -v __tests__` 零命中）
  - 写失败测试（身份一致性 pin）：一次真实崩溃（子进程未写 handoff 即退出）后，磁盘上的 crash 文件名解析出的 wave/round 与 `progress.json` 里本次轮次的键完全一致，且 `attemptedHandoff` 等于本次 frame 的 handoff 路径 —— checkable: FAIL
  - 写失败测试（`dispatchBase` / `commitsSince`）：子进程先 `git commit` 一次再崩溃 → crash 记录的 `dispatchBase` 是派发前的 HEAD、`commitsSince` 含那条提交（`{sha} {subject}`）；无新增提交 → 空数组 —— checkable: FAIL
  - 实现：`CliLifecycle` 在派发前读 HEAD（`simple-git` 的 `revparse(["HEAD"])`），crash 写点时算 `git log --oneline {base}..HEAD` —— checkable: 上述用例转绿
  - `words.ts` 增迟到落盘词行（「可能有迟到落盘，先检查工作树再进评审」）并挂在 kill / 超时 / 崩溃三类终端态的报文尾 —— checkable: 新用例断言三类终端态报文均含该句
- **Acceptance**: crash 名与 `attemptedHandoff` 与真实 frame 同源（一条 pin 断言两者）· 名字保留 verb（`crash-tasks-3,4-implement-2.json` / `crash-plan-review-2.json`），同波同轮的 implement 与 review 两条记录并存不覆盖 · `CrashRecord` 含 `dispatchBase` / `commitsSince`（kill 前的提交在记录里可见）· 三类终端态报文含迟到落盘提示 · lane 形参退役：`lane` 局部量零残留，`session/run.ts` 只以 `readCrash(RoundNaming.crashName(frame))` 的形式读 CrashRecord、全树零双参 `readCrash(` 调用，capsule 的 failure 手背面与 lifecycle 的写面同走一个名字 · `pnpm -C packages/cdd-engine test` 绿 · 零裸函数门绿
- **DependsOn**: 1

### Task 6: in-flight 门（`PreFlight` 第二道）· `--dry-run` holder 行 · `board` 在读飞行与孤儿

- **Objective**: 把在飞事实接进派发门序（`tree-clean → in-flight → graph → plan-ledger → wave → doc-contract`），门**只判不写**：持有时点名持有者并如实报「可接管 / 不可」，真正的接管与写意图由真派发路径（`CliLifecycle.acquire(record, { stealStale })`，门通过之后）执行；`--dry-run` 与真派发同判、只读门给出的持有者事实并 exit 1（`--steal-stale` 在 `--dry-run` 下作废）；门通过到 `acquire` 的竞态由 `HoldingError` 走同一条 `held` BLOCK 报文渲染；`board` 给出在飞行、孤儿 handoff 与按周期语义渲染的轮次列。
- **Files**: Modify `packages/cdd-engine/src-next/session/preflight.ts`（`in-flight` 门（**只 `inspect()`，零写**）· `PreFlightContext.inflight` / `stealStale`）· `packages/cdd-engine/src-next/face/cli.ts`（构造 `InFlight` · 门通过后把旗标交给 lifecycle 真派发路径的 `acquire` · `HoldingError` 与门同一条 held 报文 · 拒派发报文）· `packages/cdd-engine/src-next/face/preview.ts`（holder 行 + exit 1，零写）· `packages/cdd-engine/src-next/face/board-view.ts`（在飞行 / 孤儿 / 周期号）· 测试 `session/__tests__/preflight.test.ts` · `face/__tests__/preview.test.ts` · `face/__tests__/board-view.test.ts`
- **Consumes**: Task 4 的 `InFlight`（`inspect` / 三态 / `acquire(record, { stealStale })` 与词行；门只读不写） · Task 2 的门序（`plan-ledger` 位次；`plan-ledger` 门的 `checked` 行位次就在本任务断言）· `face/cli.ts` 的拒绝报文面（`the line holds no open round` 那条）· `face/preview.ts` 的预览行渲染面 · `face/board-view.ts` 的 `roundsCell`（今日只渲 `${verb}×${value.length}`，`never the stored number` 注释在 `:210-211`）
- **Produces**:
  ```ts
  // session/preflight.ts
  export interface PreFlightContext {
    // …既有字段不动…
    /** 在飞事实的**只读**面（门只 `inspect()`：不 acquire、不 steal、不 release；**必填** ——
     *  类型层无缺省位，未接线不可静默成立）。 */
    readonly inflight: InFlight;
    /** 显式接管旗标：true 时门对「pid 已亡 / 损坏且锁在」的记录**放行**（接管本身由真派发的
     *  `acquire(record, { stealStale })` 执行）；`--dry-run` 下本旗标作废（预览面从不 `acquire`）。 */
    readonly stealStale?: boolean;
  }
  export type PreFlightReason = /* …Task 2 的值… */ | "held" | "corrupt-record";

  // face/board-view.ts
  export class BoardView {
    /** 按周期号渲染（`review×1,2,3 · fix×2,3`）—— D28 的身份号，不是序号。
     *  ⚠ deliberate pin break：反转 `roundsCell` 注释里 “never the stored number” 的既有裁定。 */
    static roundsCell(rounds: Record<string, number[]>): string;
    /** 在飞行（null = 无人）+ 孤儿 handoff（无对应终态轮次的草稿）；在飞行行在
     *  `alive === false` 时补「可 `--steal-stale` 接管」。 */
    static inFlightRows(state: InFlightState, orphans: readonly string[]): readonly string[];
  }
  ```
- **Steps**:
  - 写失败测试 `preflight.test.ts`（门序与拒绝 · 门零写）：在飞记录在册且 pid 活 → `vet` 返 `ok: false`、`gate === "in-flight"`、`reason === "held"`、报文含 pid / 命令 / startedAt / 波键 / slug、`checked` 顺序为 `tree-clean → in-flight`；且 `vet` 前后锁文件与记录文件字节逐字不变（门只判不写） —— checkable: FAIL
  - 写失败测试（接管判定 · 门只判不写）：记录在册且 pid 已亡 → 无 `stealStale` 时仍拒（`reason === "held"` 且报文含「可 `--steal-stale` 接管」）；`stealStale: true` 时门**放行**（`ok: true`）但**对记录与锁零写**（字节快照前后相等）——接管本身由真派发路径的 `acquire(record, { stealStale })` 执行（Task 4 的两向用例背书） —— checkable: FAIL
  - 写失败测试（损坏三态 · 门零写）：`corrupt + locked` → 拒（`reason === "corrupt-record"`），`stealStale` 则门放行且字节不变；`corrupt + 未锁` → 放行并点名（零写） —— checkable: FAIL
  - 写失败测试（三面 `checked` 必含 `in-flight` 行）：doc / wave / branch 三种派发的 `checked` 各含 `in-flight:` 行（类型层已无缺省位，未接线不可静默成立） —— checkable: FAIL
  - 实现 `in-flight` 门（紧随 `tree-clean`，**零写**：只 `inspect()` 并按三态 + 旗标判定）与 `PreFlightContext` 两字段（`inflight` **必填**、`stealStale` 可选）；`cli.ts` 构造 `InFlight`，门通过后把旗标交给 lifecycle 的 `acquire(record, { stealStale })`（测试侧注入临时根本的实例） —— checkable: 上述四组转绿（含「`vet` 后记录与锁字节不变」）
  - 写失败测试（门通过 → `acquire` 的竞态）：门判 `absent` 后另一派发抢先写入并取锁 → `CliLifecycle.acquire` 抛 `HoldingError` → CLI 渲染与门**同一条** `held` BLOCK 报文（持有者字段同一套词行），exit 非零，且先到者的记录字节不被覆写 —— checkable: FAIL
  - 写失败测试 `preview.test.ts`（预览同判 + 零写）：持锁时 `--dry-run` 输出含 `lock: held by pid …` 且 exit 1；记录 pid 已亡时打印同句「可 `--steal-stale` 接管」；无锁时既有预览字节不变；锁文件在预览前后字节相同 —— checkable: FAIL
  - 写失败测试 `preview.test.ts`（孤儿 handoff 在 `reads:` 面列出）：放一个从未入账的 handoff 草稿 → `--dry-run` 的 `reads:` 面（现 `face/preview.ts:62`）列出该文件名，且运行前后目录内容与各文件 mtime 不变 —— checkable: FAIL
  - 写失败测试（`--steal-stale --dry-run` 同现）：记录 pid 已亡且两旗标同现 → 只打印接管提示、不接管、锁文件字节不变、记录不被删、exit 1（预览面在 dispatch 之前早退且从不调 `acquire`，故该旗标在 `--dry-run` 下**无写入通道**） —— checkable: FAIL
  - 实现预览面的 holder 行与退 1、死 pid 的接管提示、`reads:` 面的孤儿列出（不取锁、不接管、不释放、零写） —— checkable: 上述四组用例转绿
  - 写失败测试 `board-view.test.ts`（在飞行与接管提示）：`inFlightRows({ kind: "held", record, alive: false }, [])` 的渲染含「可 `--steal-stale` 接管」，`alive: true` 时不含该句；且 `cdd board` 运行前后锁文件字节不变 —— checkable: FAIL
  - 写失败测试 `board-view.test.ts`（周期号渲染）：`{review: [1,3], fix: [3]}` → `review×1,3 · fix×3`（旧断言 `review×2` 作废 —— deliberate pin break） —— checkable: FAIL
  - 实现 `roundsCell` 按周期号渲染 + `inFlightRows`（在飞行 + 孤儿；`alive === false` 的在飞行行补「可 `--steal-stale` 接管」）；孤儿判定 = workspace 里 `handoff` 家族文件在 `progress.json` 无对应终态轮次 —— checkable: 上述两组用例转绿
  - 写失败测试（孤儿零写）：存在孤儿 handoff 时 `cdd board` 后该文件 mtime 不变、目录内容不变、锁文件字节不变 —— checkable: FAIL → 实现后绿
- **Acceptance**: 门序 `tree-clean → in-flight → graph → plan-ledger → wave → doc-contract` 在 `checked` 上逐条可读（doc / wave / branch 三面都含 `in-flight` 行）· **门只判不写**（每次 `vet` 后锁文件与记录文件字节不变）· 持有报文含 pid / 命令 / startedAt / 波键 / slug · `--steal-stale` 在 pid 活时同样被拒、pid 亡时门放行（接管由真派发路径的 `acquire(record, { stealStale })` 执行）· 门通过到 `acquire` 的竞态由 `HoldingError` 走同一条 `held` BLOCK 报文（有 pin）· 损坏三态与「不得静默清活锁」 · `board` 与 `--dry-run` 在死 pid 时报出「可 `--steal-stale` 接管」且两面对锁零写（字节不变）· `--steal-stale --dry-run` 同现零写、不接管、记录不删、exit 1（`--dry-run` 下该旗标无写入通道） · `--dry-run` 同判 exit 1 且锁字节不变 · board 的周期号渲染（deliberate pin break，旧断言同批重锚）· 孤儿在 `board` 与 `--dry-run` 的 `reads:` 面列出且零写（mtime 不变）· `PreFlightReason` 无死值（死 pid 面统一用 `held`）· `pnpm -C packages/cdd-engine test` 绿 · 零裸函数门绿
- **DependsOn**: 2, 4

### Task 7: 计划文档面（波行 `planTasks` 快照 · 追加判据 · Task 块骨架结构化）

- **Objective**: 让「追加」成为受支持路径，并让计划文档对 AI 更可写：账本每个波行在**闭合时**记下当时的计划任务集合，`WaveGate` 的 `mixed-batch` 据此区分**追加**（放行成新波）与**滞留**（维持 BLOCK），计划领先账本的窗口不再靠人肉解释；同时**零新字段**地把 Task 块的骨架收紧（step 样例从一条改两条、字段键序固定、不加 continuation 行）。
- **Files**: Modify `packages/cdd-engine/src-next/session/ledger.ts`（`ProgressRow.planTasks` · 闭合时落快照 · 读面）· `packages/cdd-engine/src-next/session/run.ts`（闭合点调用 · 计划任务集合来源）· `packages/cdd-engine/src-next/session/wave.ts`（`mixed-batch` 收窄）· `packages/cdd-engine/src-next/session/preflight.ts`（`LedgerFacts.snapshots` 接上）· `packages/cdd-engine/src-next/render/skeleton.ts`（Task 块两条 step 样例 · 键序 pin）· Create `packages/cdd-engine/src-next/render/__tests__/brief.test.ts`（brief 指纹稳定性 pin 的落点；`render/__tests__/render.test.ts` 的既有 `BriefRenderer` 用例不动）· 测试 `session/__tests__/wave.test.ts` · `session/__tests__/ledger.test.ts` · `render/__tests__/skeleton.test.ts`
- **Consumes**: Task 2 的 `LedgerFacts`（`snapshots` 字段）· `session/wave.ts` 的 `WaveGate.vet`（`mixed-batch` 判据现居 `split` 之前）· `session/graph.ts` 的 `batches()` / `frontier()` · `render/skeleton.ts` 的 `#taskBlock`（今日只渲一条 step 样例）· `session/run.ts` 的 `#markTerminal`（波闭合点）与 `#planPath`（计划文本来源）· `contract/doc.ts` 的 `PlanDocType.parse`（任务 id 集的解析面）
- **Produces**:
  ```ts
  // session/ledger.ts
  export interface ProgressRow {
    // …既有字段不动…
    /** 该波闭合当刻的计划任务集合（历史事实，永不更新；计划可变而它不可再生）。 */
    planTasks?: readonly number[];
  }
  export class Ledger {
    /** 波闭合时落快照（幂等：已存在则不覆盖）。 */
    recordPlanTasks(waveKey: LedgerKey, planTasks: readonly number[]): void;
    /** 读快照（null = 历史波行 / 未闭合）。 */
    planTasksOf(waveKey: LedgerKey): readonly number[] | null;
  }

  // session/wave.ts
  export type WaveGateReason = "mixed-batch" | "split" | "wrong-phase"; // 词表不变，mixed-batch 的判据收窄
  ```
- **Steps**:
  - 写失败测试 `ledger.test.ts`（快照幂等）：`recordPlanTasks("3,4", [1,2,3,4])` 后再调 `recordPlanTasks("3,4", [1,2,3,4,5])` → 仍是 `[1,2,3,4]`（闭合当刻的事实不改写） —— checkable: FAIL
  - 实现 `ProgressRow.planTasks` + `recordPlanTasks` / `planTasksOf`，并在 `run.ts#markTerminal` 的波闭合点调用；计划任务集合的来源写死为「用 `#planPath` 读盘 → `new PlanDocType("plan").parse(lines)` → 取 `taskBlocks` 的 id 集」；读盘 / 解析失败时**跳过落快照**（present facts only，不写 `[]`、不报错） —— checkable: 上述用例转绿 + 新用例：不可读的计划路径下闭合波行不带 `planTasks` 字段
  - 写失败测试 `wave.test.ts`（追加放行）：静态批 `{3,4}` 中 3 已闭合、4 未开工，且 3 闭合时的快照**不含** 4（`planTasks: [1,2,3]`）→ `vet({4}, "implement", …)` 放行（`open` 为 `[4]`） —— checkable: FAIL（今日 `mixed-batch` 恒拦）
  - 写失败测试（滞留仍拦）：同上但快照**含** 4（`planTasks: [1,2,3,4]`）→ 仍 `mixed-batch` BLOCK，报文点名批次与两侧 —— checkable: FAIL
  - 写失败测试（缺快照保守）：历史波行无 `planTasks` → 维持 `mixed-batch` BLOCK（向后兼容，零迁移） —— checkable: FAIL
  - 实现 `mixed-batch` 判据收窄：取该批已闭合成员**最近一次闭合**的快照；未开工成员不在快照 → 追加（放行）；在快照或快照缺失 → 滞留（BLOCK） —— checkable: 上述三组转绿
  - 接线 `LedgerFacts.snapshots`（`preflight.ts` 从 `planTasksOf` 读全部波行） —— checkable: Task 2 的 ledger 规则用例在真实快照下仍绿
  - 写失败测试 `brief.test.ts`（brief 指纹稳定性，守 Review Focus）：同一计划经 `BriefRenderer` 渲染两次得到同 hash（与账本 `brief-revision` 同源），且 brief 首行仍是 `### Task …`（零头行） —— checkable: 用例绿（防止任何任务顺手加版本头）
  - 写失败测试 `skeleton.test.ts`（Task 块样例与键序）：骨架渲染出**两条** step 样例（今日一条；第二条形如 `- **Steps**:` 下的第二行）且字段键序固定为 Objective → Files → Consumes → Produces → Steps → Acceptance → DependsOn；渲染结果里不存在含 `<…>` 尖括号 token 的行（`expect(lines.filter((l) => /<[^>]+>/.test(l))).toEqual([])`） —— checkable: FAIL（今日一条 step 样例）
  - 实现骨架改动：`#taskBlock` 输出两条 step 样例、键序不变式加一条顺序断言；`contract/declare.ts:641-647` 的 `Step checkable` 值形零改（既已成立，本任务只补骨架与 pin） —— checkable: 上述用例转绿
- **Acceptance**: 波行闭合即记 `planTasks` 且幂等（永不更新；计划不可读时跳过落快照）· 混合批里「不在快照 → 追加放行」「在快照 / 缺快照 → 滞留 BLOCK」三组各一 pin · `LedgerFacts.snapshots` 与 `planTasksOf` 同源 · brief 内容指纹稳定（同一计划两次渲染同 hash、零头行；pin 落 `render/__tests__/brief.test.ts`）· 骨架两条 step 样例 + 字段键序 pin + 零尖括号 token（零新字段，`### Task N:` 标题形态零改）· `pnpm -C packages/cdd-engine test` 绿 · 零裸函数门绿
- **DependsOn**: 2

### Task 8: 消费面 recipe · changeset · 全量校验

- **Objective**: 把行为契约落到消费面（`cdd-plan` 的追加 recipe · `cdd-dev` 的「计划领先账本」与恢复三句），出 changeset（cdd-engine minor + kairos patch），跑全量校验收口。
- **Files**: Modify `packages/kairos/skills/cdd-plan/SKILL.md`（author 节点补追加 recipe）· `packages/kairos/skills/cdd-dev/SKILL.md`（implement 节点补「计划领先账本」与恢复三句）· Create `packages/kairos/tests/recovery-wording.test.ts`（grep 回归门）; Create `.changeset/p21-sole-read-write-path.md`
- **Consumes**: Task 4 / Task 2 / Task 7 的消费者可见行为（`--steal-stale` · `plan leads ledger by N tasks` · 追加任务的真依赖边）· `packages/kairos/tests/skill-anatomy.test.ts`（SKILL.md 结构契约：heading 白名单与零程序史）
- **Produces**:
  ```ts
  // packages/kairos/tests/recovery-wording.test.ts — 回归门（断言的是「不引入」）
  // 1) 六份 `packages/kairos/skills/*/SKILL.md` 交集零命中：/\bpgrep\b/ · /\bgit stash\b/ · /checkout --/
  //    —— 改文前即为绿（基线证据）
  // 2) 至少一份 SKILL.md 含恢复三句的 canonical 英文片段（逐字，与 Constraints / `words.ts` 同一串）：
  //    `look at the working tree first` · `commit the changes that work` · `discard the ones that are broken`
  //    —— 改文后才转绿（SKILL.md 英文主导、零中文，AGENTS.md）
  ```
- **Steps**:
  - 写 `recovery-wording.test.ts` 的**负向断言**（六份 SKILL.md 上 `pgrep` / `git stash` / `checkout --` 零命中），不带正向断言先跑绿 —— checkable: 改文前该文件单独跑绿（基线证据）
  - 改 `packages/kairos/skills/cdd-plan/SKILL.md`：author 节点补三句（追加任务用真实 `DependsOn` 边另起一波 · 禁止改写已关闭任务的内容 · 追加任务照常写 `Acceptance`），零内部 token —— checkable: `pnpm -C packages/kairos test` 的 `skill-anatomy.test.ts` 绿
  - 改 `packages/kairos/skills/cdd-dev/SKILL.md`：implement 节点补「计划领先账本是提示不是错误」+ 恢复三句（canonical 英文串 `look at the working tree first` · `commit the changes that work` · `discard the ones that are broken`，零中文、零内部 token） —— checkable: 同上
  - 两份 SKILL.md 改完后给 `recovery-wording.test.ts` 加**正向断言**（至少一份 SKILL.md 逐字命中上面三个 canonical 英文片段）并跑绿 —— checkable: 负向断言改文前绿 · 正向断言改文后绿
  - 写 changeset `.changeset/p21-sole-read-write-path.md`：cdd-engine **minor**（新旗标 `--steal-stale` · 新增结构规则 · 门序扩展 · board 读面更替）+ kairos **patch**（skill 文本） —— checkable: `pnpm exec changeset status` 无报错
  - 跑全量 `env -u AI_AGENT pnpm run validate` —— checkable: ALL PASS（emit fresh · root/kairos/engine 三套绿 · typecheck ×3 · version-sync · 零裸函数）
  - 复核冻结面零漂移（源码面，测试夹具不计）：`grep -rn "liveness.json\|pidusage\|never the stored number" packages/cdd-engine/src-next --include='*.ts' | grep -v __tests__` 零命中，且 `packages/cdd-engine/package.json#dependencies` 恰八项（`commander` · `execa` · `jsonc-parser` · `simple-git` · `yaml` · `write-file-atomic` · `ps-list` · `proper-lockfile`，零 `pidusage`） —— checkable: 零命中 + 依赖清单逐字八项
- **Acceptance**: 两份 SKILL.md 的 recipe 在册且过 `skill-anatomy` 契约 · 消费面 skill 零 `pgrep` / `stash` / `checkout --`（负向断言改文前即绿 · 正向断言改文后绿）· 恢复三句以 canonical 英文串在 SKILL.md 逐字在册（与 `words.ts` 同一串）· changeset 标 cdd-engine minor + kairos patch · `env -u AI_AGENT pnpm run validate` ALL PASS · 冻结面零漂移（源码面零 `liveness.json` / `pidusage` / `never the stored number`，依赖面仍八项）
- **DependsOn**: 1,2,3,4,5,6,7,9

### Task 9: 计划 Task 块契约（标题分节 · `mdast` 块级 reader · 三个读者换源）

- **Objective**: 把计划 Task 块从「字段项目符号」改成「标题分节」，并把这一面的结构解析换成 `mdast`（`mdast-util-from-markdown`）：新增 `PlanTaskBlocksReader` 作为块结构的**唯一**解析面，`session/graph.ts` 的 `DependsOn`、`render/brief.ts` 的任务段切片、`render/skeleton.ts` 的渲染全部换源；旧项目符号形作为读得懂的兼容输入（归一化是 reader 的一个方法，**不是第二份声明**），仓内冻结计划零改；骨架只吐新形；允许任意扩展 `####` 节（不得与七个保留键重名，非保留节只作正文）。`render/brief.ts#rawSection`（遇任何 `^#` 行即截断）随节点区间删除——漏了这条，`####` 子节会让 brief 静默截成一行标题而门全绿。
- **Files**: Create `packages/cdd-engine/src-next/contract/task-blocks.ts` · `packages/cdd-engine/src-next/contract/__tests__/task-blocks.test.ts`; Modify `packages/cdd-engine/src-next/contract/declare.ts`（plan 的七个 task 字段元素改 heading 形 · 扩展节的允许面）· `packages/cdd-engine/src-next/contract/doc.ts`（`PlanDocType.taskBlocks` 委托 reader · 保留旧字段名以零破坏）· `packages/cdd-engine/src-next/session/graph.ts`（`DependsOn` 读 reader）· `packages/cdd-engine/src-next/render/brief.ts`（按 AST 节点区间切片 · 删 `#rawSection`）· `packages/cdd-engine/src-next/render/skeleton.ts`（`#taskBlock` 吐新形 + 两条 step 样例）· 对应 `__tests__`（`graph` / `brief` / `skeleton`）
- **Consumes**: `contract/doc.ts` 的 `PlanDocType.parse` 与 `TaskBlock` 现记录（`id` / `heading` / `fields` / `steps`）· `render/brief.ts:90-104` 的 `#rawSection`（截断缺陷所在）· `session/graph.ts` 的 `DependsOn` 读法 · `render/skeleton.ts:455-483` 的 `#taskBlock`（七字段 + 一条 step 样例）· Task 2 的登记面与 `RULE_REGISTRY`（字段元素的 `home`/`presence` 由它驱动）
- **Produces**:
  ```ts
  // contract/task-blocks.ts —— 块结构的唯一解析面（mdast 节点 → TaskBlock）
  export interface TaskField { readonly key: string; readonly lines: readonly string[]; }
  export interface TaskStep { readonly action: string; readonly checkable: string | null; }
  export interface TaskBlock {
    readonly id: number;
    readonly heading: string;          // `### Task N: <title>` 原文
    readonly fields: readonly TaskField[];   // 七个保留键按文档序 + 扩展节一并收（key 即节标题）
    readonly steps: readonly TaskStep[];
    /** 节点区间（行号，1-based 起止）——brief 切片用，替代 `#rawSection` 的 ^# 扫描。 */
    readonly range: { readonly start: number; readonly end: number };
    /** 该块用的是新形（heading）还是兼容形（list），供门与诊断区分。 */
    readonly shape: "heading" | "legacy";
  }
  export class PlanTaskBlocksReader {
    static readonly RESERVED: readonly string[];   // Objective · Files · Consumes · Produces · Steps · Acceptance · DependsOn
    /** 一次解析：两种节点（heading / list item）归一成同一份 TaskBlock。 */
    parse(content: string): readonly TaskBlock[];
    /** 单块的 `DependsOn` 值（首行；`none` → 空集）。 */
    dependsOn(block: TaskBlock): readonly number[];
  }
  ```
- **Steps**:
  - 添加依赖：`pnpm -C packages/cdd-engine add mdast-util-from-markdown` —— checkable: `package.json#dependencies` 出现，`pnpm -C packages/cdd-engine install` 零报错
  - 写失败测试 `task-blocks.test.ts`（新形）：一块 `### Task 1: x` + 七个 `#### Key` 子节 + `#### DependsOn` 体首行 `2, 3` → `fields` 七项按文档序、`dependsOn === [2,3]`、`shape === "heading"`、`range` 恰为该块首行到下一 `###` 前一行 —— checkable: FAIL
  - 写失败测试（兼容形）：同一份内容的旧项目符号形 → `fields` 与 `steps` 与新形**逐字段相等**、`shape === "legacy"`、`dependsOn` 同值 —— checkable: FAIL（兼容窗口的核心断言）
  - 写失败测试（扩展节）：块内出现 `#### Risks` 与 `#### Migration Notes` → 收进 `fields`（key 即节标题）且**不触发**任何必填/值形 finding；出现 `#### Objective` 之外的保留键重复 → 报重复键 —— checkable: FAIL
  - 实现 `PlanTaskBlocksReader`（`mdast-util-from-markdown` 一次解析 → 遍历 heading 节点取 `### Task N:` 块 → 子 heading 与顶层 list 两种节点归一到 `fields`；`position` 换行号） —— checkable: 上述三组用例转绿
  - 换源 `contract/doc.ts`：`PlanDocType.taskBlocks` 委托 reader（对外记录形状不变） —— checkable: `contract` 既有测试同批转绿（除本任务新增的形断言）
  - 换源 `session/graph.ts`：`DependsOn` 经 `reader.dependsOn` 读取（旧形同值） —— checkable: `graph.test.ts` 全绿 + 一条「旧形计划与新形计划派生同一批 wave」的 pin
  - 换源 `render/brief.ts`：任务段按 `block.range` 切片，删除 `#rawSection` 与其 `^#` 扫描 —— checkable: `brief.test.ts` 新用例——带 `####` 子节的任务块，brief 内容**逐字节包含**该子节（旧实现会截断），且与 `## Constraints` 段的拼接顺序不变
  - 改 `render/skeleton.ts#taskBlock`：吐新形（七个 `####` 子节 + 两条 step 样例） —— checkable: `skeleton.test.ts` 断言渲染结果的子节标题序列与保留键顺序一致、且含两条 `— checkable:` 样例
  - `contract/declare.ts`：plan 的七个 task 字段元素改 heading 形（**一份声明**；`valuePattern` 判 `^#### Key$`），并登记「任意 `####` 扩展节允许」这一面（非保留节不参与必填/值形） —— checkable: 一份**新形**计划与一份**旧形**计划各自过 `Contract.validate` 零 finding（兼容窗口的文档面断言）
- **Acceptance**: 新形与旧形解析结果逐字段相等（`shape` 与 `range` 除外）· 七个保留键一份声明（`declare.ts` 里旧项目符号形的 task-field 元素删除，归一化只在 reader 内）· `DependsOn` 新旧形派生同一批 wave · 带 `####` 子节的任务块 brief 逐字节完整（`#rawSection` 已删除，零 `^#` 截断残留）· 骨架吐新形且含两条 step 样例 · 扩展 `####` 节零 finding · 冻结计划零改（`git diff` 对 `docs/kairos/plans/*` 无改动）· `pnpm -C packages/cdd-engine test` 绿 · typecheck ×3 · 零裸函数门绿
- **DependsOn**: 7

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-10-28 | P21 首版实施计划：八任务四波（W1={1,2,3} 适配器 / 规则声明面 / 行身份 · W2={4,5,7} InFlight / 崩溃身份 / planTasks 与骨架 · W3={6} in-flight 门与 board 面 · W4={8} 消费面与 changeset），逐任务带 `checkable` 步骤与验收 pin | [human] · Claude（kairos:cdd-plan · 2026-10-28） |
| v0.2 | 2026-10-28 | plan-review-1 修订（12 条 findings + 编排器裁定全部落地）：① `validateLedger(input, LedgerFacts)` 两参入口，`ContractInput` 零新增字段（对齐 spec v0.6） ② `ps-list` 的 `startTime` 承接 pid 复用判据（`ProcRow.startTime` · `abs(startTime - startedAt) <= 60s`），删 `process.kill(pid, 0)` 与 `pidusage` 语义措辞 ③ `AtomicWriter` 的 checkable 收窄到 `Workspace.writeJson` 方法体（`writeText:188` 刻意不动） ④ `RuleRow` 改名 `RuleDeclaration` 且声明即工厂（`create()`），规则 id 取 spec §3.1 的 kebab id，`kind` 仍取策略名，两条 ledger 策略类名 `ledger-layering` / `ledger-task-set` ⑤ `release()` 唯一调用点 = 正常收工，崩溃 / kill / 超时 / 未捕获异常零 `release()`，`--dry-run` 不 acquire 故无 release ⑥ Task 6 补 board / `--dry-run` 死 pid 接管提示、孤儿 `reads:` 面与两面对锁零写 pin ⑦ Task 1 补组长先退 / `setsid` 孙进程两个组 CPU 样本 pin（不可稳定构造时落显式 skip 能力门） ⑧ Task 8 的恢复措辞回归门拆成负向前置 + 正向后置 ⑨ 消费面路径改 `packages/kairos/skills/*` ⑩ pin 精度修正（`termination.ts:359-443` · `:265-291` · `AuditTarget` → `session/run.ts:67-77` · `skeleton.ts:455-483`） ⑪ `PreFlightContext.inflight` 改必填 + 三面派发 `checked` 必含 `in-flight` 行 ⑫ `briefHash` 由账本 `brief-revision` 同源派生、删 `stale-holder` 死值、补 `--steal-stale --dry-run` 同现用例 | [human] · Claude（kairos:cdd-plan · 2026-10-28） |
| v0.3 | 2026-10-28 | plan-review-2 修订（17 条 findings + 编排器裁定全部落地）：① `InFlight.acquire` 写序改为「`ensureMarker()` → `lock()` → **取锁成功后**才写记录」，取锁失败先只读记录再抛 `HoldingError`（零写），`release()` 反序（删记录 → 解锁），补「第二次 `acquire` 失败后记录字节逐字不变」pin ② **一规则一策略**：声明面 doc 21 行（既有 15 拆腿后 18 + 新增 3）+ ledger 2 行 = 23 行，每行 `id` 即策略 `name`；`UniquenessInvariant` / `OrderInvariant` 拆腿，heading 重复登记腿并入 `presence`（「登记元素恰出现一次」的重复侧，与缺失侧同一条规则），wave / branch 的 skipped 断言改 21 行 ③ `LedgerFacts` 增 `layers`（`TaskGraph.batches()` 供数）+ `closed-wave-fits-depends-on-layers` 的红 / 绿 pin 与变异用例 ④ Task 2 Files 增 `contract/doc.ts`，四条变更记录策略改经共用 `changeHistory(ctx)`（`this.overall(ctx)` 命中不新增，`historyOrder` 那处被替换） ⑤ Task 5 Files 增 `session/run.ts`（`#capsuleLines` 改调 `RoundNaming`、删 `lane` 局部量） ⑥ crash 名改 `crash-{line}-{op}-{round}.json`（verb 不丢），pin 与「同波 implement-2 / review-2 两条记录并存」用例同批更新 ⑦ 三条 grep checkable 收窄到源码面（`| grep -v __tests__`），`face/__tests__/termination.test.ts` 列进 Task 1 / Task 4 Files ⑧ `NextStepRouter` 回到对既有 class 的扩展：`static resolve(...): Route` **非空**，capsule 只多一个布尔入参、零 null 分支 ⑨ 恢复三句定 canonical 英文串（`words.ts` 与 SKILL.md 同读一串，中文只作对译、不进 SKILL.md） ⑩ 组长先退 / `setsid` 孙进程两个样本 pin **必绿**，能力门只允许非 POSIX 宿主 ⑪ 五处易漂 pin 改「文件 + 方法名」形态（`docLineVerdict` · `#briefDrift` · `CrashRecord` · `WaveGate.vet` · `the line holds no open round` 报文） ⑫ `briefHash` 的比较面点名公开面 `reviewedRevisionOf(key)` 的 `brief_hash` 与 `ReviewRefs.briefRevision` ⑬ Task 7 的 brief 指纹 pin 落 `render/__tests__/brief.test.ts`，计划任务集合来源写死（`#planPath` 读盘 + `PlanDocType.parse`，读盘失败跳过落快照） ⑭ skeleton 占位符断言换成可判形态（渲染结果零 `<…>` token 行） ⑮ 冻结面复核 needle 改 `pidusage` 并纳入 `package.json#dependencies` 八项清单 ⑯ Task 6 `DependsOn: 2, 4`（分层不变，W3={6}） ⑰ 删 `PreFlightReason` 的 `plan-ahead` 死值（窗期提示落 `checked` 的 `info` 行、`reason` 缺席），`checked` 取值补 `info (提示)`；约束里的 spec 引用改 v0.7 | [human] · Claude（kairos:cdd-plan · 2026-10-28） |
| v0.4 | 2026-10-28 | plan-review-3 修订（12 条 findings + 编排器裁定全部落地；spec 已回填 v0.8）：① AC 的「五条」与 21 行算术统一为 21（与 §3.4/§6.4 一致），约束里的 spec 引用改 v0.8 ② 声明面分两型——`DocRuleDeclaration`（`create(): Invariant`，判据入口 `evaluate(ctx)`）与 `LedgerRuleDeclaration`（`create(): LedgerRule`，`evaluate(ctx, ledger)`），`Contract.policy()` 只吃 doc 型、`validateLedger` 只吃 ledger 型，`rules.test.ts` 对两型分别断言工厂产出与判据入口签名（零新增 `ContractInput` 字段） ③ `front-matter-version-matches-lineage-end` 不再是新策略：既有 `SelfBoundedInvariant` 按两条既存判据拆成该 id 的 lineage 腿与 `self-bounded-id-not-in-lineage`，两腿互斥（同一偏差一条 finding），新增降为两条（`change-history-row-not-in-other-table` · `list-marker-not-doubled`），doc 行数仍 21（15 → 19 → 21） ④ 两腿 id 均为 kebab：`judge.test.ts` 的 6 处 `withKind(findings, "selfBounded", "version")` 同批重锚（deliberate pin break），`rules.test.ts` 的「id 唯一且 kebab」可机械成立 ⑤ `briefHash` pin 改为「记录值 === `ReviewRefs.briefRevision(planPath, 当刻 brief 文本).brief_hash`（acquire 时现算）」+ 零新哈希面 pin + 本波首次派发仍非 null 用例，`reviewedRevisionOf` 只作同源旁证 ⑥ 门只判不写：`in-flight` 门只 `inspect()`，`acquire(record, { stealStale })` / `steal` 收进 `CliLifecycle`；门通过到 acquire 的竞态由 `HoldingError` 走同一条 `held` BLOCK 报文（有 pin），`--steal-stale` 在 `--dry-run` 下作废（无写入通道） ⑦ `targetLineOpen` 的产出面写死为 `Ledger.reviewGate("branch", planPath, "branch")` 的 `open` 分支 / `lineRoute("branch", "branch")` 非空（不是 `PipelineFaceState.closed`），两向 pin ⑧ 删 `PreFlightReason` 的 `no-ledger-facts`（缺事实包只出 `skipped (no ledger facts)` 行，`reason` 缺席） ⑨ `ProcRow.startTime` 取 `descriptor.startTime?.getTime() ?? null`；`live` 的 `null` 在 `InFlight` 边界折成 `alive: true`（steal 拒绝），补「`startTime` 不可读不接管」pin ⑩ Task 5 的 grep 收窄为「`readCrash(RoundNaming.crashName(frame))` + 全树零双参 `readCrash(`」 ⑪ 组 CPU 用例写明 `detached: true`（复用既有 `detachedChild` 夹具形态） ⑫ `SamplingLoop.stop()` 删掉 `rmSync(heartbeatPath)` 腿（移除只归 `release()` / `steal()`），补「自结束轮次 release 前记录仍在、释放后记录与锁同时消失」pin | [human] · Claude（kairos:cdd-plan · 2026-10-28） |
| v0.5 | 2026-10-28 | W1 评审触发的 plan 修订（spec 回填 v0.9）：两条 lineage 规则改为方向无关——`change-history-version-monotone`（同向贯穿，来回 = 违例）与 `front-matter-version-matches-lineage-end`（header 与首行或末行一致）；Acceptance 增「升序 doc 与降序 doc 各自一条绿 pin」+「来回跳 / header 两端皆不符」两条红 pin；约束里的 spec 引用改 v0.9 | [human] · Claude（kairos:cdd-dev · plan write authority · 2026-10-28） |
| v0.6 | 2026-10-28 | W1 review-2 触发的 plan 修订（spec 回填 v0.10）：**版本序腿整体撤销**（`change-history-version-monotone` 删除；`front-matter-version-matches-lineage-end` → `front-matter-version-in-lineage`，只判「header 必须出现在变更记录里」）；声明面 23 → 22 行（doc 20 + ledger 2）、wave/branch 的 skipped 面同步 20 行；Task 2 的 pin 重写为「header 未在 lineage 红 + 升序/降序/非单调冻结形态三绿」，并消掉 v0.5 里红色 pin 与降序绿 pin 的自相矛盾 | [human] · Claude（kairos:cdd-dev · plan write authority · 2026-10-28） |
| v0.7 | 2026-10-28 | Task 2 块整体重写（spec 回填 v0.11 · W1 review-3 的自我矛盾收敛）：**唯一的 lineage 判定 = header 缺席**（`front-matter-version-in-lineage`），`front-matter-version-matches-last-row` 与 `change-history-version-ascending` 两条腿一并删除；声明面 **21 行（doc 19 + ledger 2）**、公共面 6 条——Objective / Produces / Steps / Acceptance 四处算术与措辞同时对齐（此前 23/21 与 22/20 并存）；补 `checked` 的**生产读者**（CLI 通过 + 拒绝两条路径渲染 `checked:` 行）；`contract/declare.ts` 从 Task 2 Files 移除（规则面住 `contract/rules.ts`）；layer 规则写明 subset 读法与对应绿 pin；plan-ledger 拒绝的 `reason` 缺席 | [human] · Claude（kairos:cdd-dev · plan write authority · 2026-10-28） |
| v0.8 | 2026-10-28 | **追加 Task 9：计划 Task 块契约面（spec §7 · D65）**——`PlanTaskBlocksReader`（`mdast-util-from-markdown`）成为块结构唯一解析面，旧项目符号形作兼容输入（归一化只在 reader 内），`graph` / `brief` / `skeleton` 换源，`brief.ts#rawSection` 随 AST 节点区间删除；Task 8 的 `DependsOn` 接到 `1,2,3,4,5,6,7,9`。**波次形态**：Task 9 依赖 7 → 层 3，与 Task 6（`DependsOn: 2,4` → 层 3）同批，故派生为 W1={1,2,3} · W2={4,5,7} · W3={6,9} · W4={8}（真依赖算出来的，未加调度边） | [human] · Claude（kairos:cdd-dev · scope append · 2026-10-28） |
| v0.9 | 2026-10-28 | Task 2 的 ledger 规则修订（spec 回填 v0.13 · W2 派发被自身规则拦下的 dogfood 缺陷）：`LedgerFacts` 增 `deps`（任务 → `DependsOn` 边）；`planned-tasks-vs-recorded-tasks` 的判据从「编号大于账本最大任务号」改为「**依赖全已入账却仍未入账**」（滞留），待开工任务一律放行——编号不表达顺序，波次按层派生。pin 补一条本 phase 真实形态的绿 pin（记 `{1,2,3,4,5,7}`、Task 6 待开工） | [human] · Claude（kairos:cdd-dev · dogfood backfill · 2026-10-28） |
| v0.10 | 2026-10-28 | ledger 规则再收敛（spec v0.14）：**撤 `LedgerFacts.deps`**（依赖判据不成立——任务 6 依赖已入账但它是下一波）；`planned-tasks-vs-recorded-tasks` 只判单向「账本记录的每个任务必须仍在计划里」，「计划有、账本没有」零判压、只出 info 行。pin 改为：账本记 `11` 而计划无 → 红；本 phase 真实形态（计划 1..9 · 账本 1,2,3,4,5,7）→ 零 finding + `info (plan leads ledger by 3 tasks)` | [human] · Claude（kairos:cdd-dev · dogfood backfill 其二 · 2026-10-28） |
