---
title: 引擎文档工具（Engine Doc-Tooling）— P13 实施计划：child dispatch 终止面跟进（stdin 闭合 + 终止 ⊥ 结论 + idle 可见性）
doc-type: plan
version: v0.1
date: 2026-10-19
spec: docs/kairos/specs/2026-10-10-engine-doc-tooling-p13-design.md
parent-program: docs/kairos/specs/2026-10-10-engine-doc-tooling-overall.md
depends-on: P12（Done · hard——终止面 `face/termination.ts` 已落地）
base: develop
---

## Constraints

- 终止是一条事实，结论只由 handoff 推出，不由终止状态词推出（承 D27）；升格只限 review 面，且只认「通过载体 schema 校验且含至少一条 finding」的草稿，截断草稿 = 非法草稿。
- D53 常量零变：idle 30 分钟、采样 60 秒、四键预算（implement 6h · review 3h · fix 3h · branch-review 3h）；活面零新旗标、零环境变量、零配置 JSON。
- 引擎活面禁用 `detached` 选项键（会关掉 execa 的 `cleanup`）；进程组回收优先 execa 现成能力，不自研；回收只作用于仍归引擎所有的进程组（spawn 时 `killDescendants` 建立的那个组），不得因 pid/pgid 复用误伤他组。
- OOP 统一、零裸函数（`check:no-bare-functions` 守卫）；摘要键集单源 `Words.capsuleKeys(status, withHandoff)`，渲染点不自加特例；死码随改随清。
- 本 phase 不改 `next:` 字面形态、CLI 旗标面与退出码表 0/1/2 的语义；终止 ⊥ 结论的例外仅限升格轮（D53 Q12 的有意收窄）。
- 引擎调用一律本地 `node packages/cdd-engine/src-next/bin.ts`，不用 npx；SKILL.md 与 docs 英文主源，本计划为内部文档中文主源（Strategy B）；不提交除非用户明确要求；不发布，changeset 收尾到可发布态即止。

### Task 1: child spawn 面——stdin 闭合与进程组回收
- **Objective**: `Terminator.run` 的 execa 调用带 `stdin: 'ignore'`；直接子进程退出后回收其进程组，使占着 stdout / stderr 管道的孙进程不再拖住 `await`；child 自行退出的轮仍是「自行结束」，不产生 termination 事实。
- **Files**: `packages/cdd-engine/src-next/face/termination.ts`（execa 调用约 `:467-473`）；`packages/cdd-engine/src-next/face/__tests__/termination.test.ts`（既有终止面端到端 fixture 所在的测试文件，沿用其 fixture 风格；若 fixture 实际落在 `cli.test.ts`，则在该文件追加）。
- **Consumes**: P12 的 `Terminator.run` 与 `killDescendants` 语义；`cli.test.ts` 的 `engineSourceTexts()` 对 `detached:` 选项键的扫描守卫。
- **Produces**: `Terminator.run` 的 spawn 行为契约——fd 0 连 /dev/null；直接子进程退出后 `await` 及时返回且孙进程被回收；Task 2 起不再触碰 spawn 面。
- **Steps**:
  - 先实机复现：写一个 fixture child——派生一个继承 stdout 的长寿孙进程后自己立即退出——对现状跑，确认 `await` 在 child 退出后挂着；同时记录 macOS 上 `ps -g` 是否覆盖后代进程 — checkable: 复现结论（挂住 / 未挂住、`ps -g` 覆盖面）写进 fixture 测试的注释首行，不另立文档
  - 写失败测试 `reads stdin to EOF without hanging`：fixture child 读 stdin 至 EOF 后写 handoff 并退出，在非 TTY 下断言轮在远小于 idle 窗口内正常结束 — checkable: 现状下测试失败（挂住，以短超时断言）
  - 写失败测试 `reclaims the process group after the direct child exits`：直接子进程退出而孙进程持管道，断言 `Terminator.run` 在有限时间内返回、孙进程已不存活、且一个与引擎无关的旁观进程仍存活 — checkable: 现状下测试失败
  - 在 execa 选项集加 `stdin: 'ignore'`；进程组回收先查 execa 现成选项（版本以 `packages/cdd-engine/package.json` 的 `"execa": "^10.1.1"` 与 lockfile 解析版本为准；以 `killDescendants` 建立的组为准），确无现成能力时才在直接子进程退出后对该组做一次 kill，限定在引擎持有的组内；两种选型择一并在该处注释一行理由 — checkable: 两个新测试通过，`engineSourceTexts()` 的 `detached:` 扫描守卫仍绿
  - 加 `stdin: 'ignore'` 后先跑既有 `termination.test.ts` 与 `cli.test.ts` 的终止用例，排查依赖开放 stdin 管道的既有 fixture 并改为不读 stdin — checkable: `pnpm -C packages/cdd-engine test -- termination` 无因 stdin 变更导致的失败
  - 断言「child 自行退出的轮不产生 termination 事实」（沿用既有终止面断言，不新增字段）— checkable: `pnpm -C packages/cdd-engine test -- termination` 全绿
- **Acceptance**: execa 选项含 `stdin: 'ignore'`；孙进程占管道的端到端 fixture 通过且旁观进程无损；活面无 `detached:` 选项键；D53 常量零变。
- **DependsOn**: none

### Task 2: 终止事实载体与 crash record 新字段
- **Objective**: 终止事实以 `DispatchOutcome.termination` 为唯一承载，由 `face/lifecycle.ts` 的单一派生点填入；`timeoutCount` 递增判据改为该字段非空；crash record 增 `promoted` 与 `idleMs`。
- **Files**: `packages/cdd-engine/src-next/session/run.ts`（`DispatchOutcome`，约 `:97`）；`packages/cdd-engine/src-next/face/lifecycle.ts`（派生点约 `:521`，`#reject`）；`packages/cdd-engine/src-next/face/cli.ts`（`:653-656`，递增位于 `lastStatus === BLOCKED || TIMEOUT` 失败块内）；`packages/cdd-engine/src-next/session/ledger.ts`（`CrashRecord`，约 `:192-213`）；测试 `face/__tests__/cli.test.ts`（`:2259` 失败面测试，pin 注入式失败 dispatch 后 `timeoutCount` 递增；`:4500`、`:4543` 的 `toEqual({ status: 'TIMEOUT' })`，pin 终止轮 outcome 仅含状态词）。
- **Consumes**: Task 1 无接口依赖；既有 `TerminationCause`、`SampleRecord` 类型（`ledger.ts`）。
- **Produces**: `DispatchOutcome.termination?: { cause: TerminationCause; idleMs: number; lastSample: SampleRecord | null }`（类型名由该字段内联或具名接口承载，Task 3 与 Task 4 读之）；`CrashRecord.promoted: boolean` 与 `CrashRecord.idleMs: number | null`（非终止的 crash record 取 `false` / `null`）；`cli.ts` 的递增判据改为读该步 outcome 的 `termination` 非空，且位于失败状态块之外（升格轮为非失败状态也递增）；`step` 的返回值把 `outcome.termination` 透出给 `cli.ts`。
- **Steps**:
  - 先翻新 pin：`cli.test.ts:4500`、`:4543` 的 `toEqual({ status: 'TIMEOUT' })` 改为断言 `status` 为 `TIMEOUT` 且 `termination` 带 `cause` / `idleMs` / `lastSample`；`:2259` 失败面测试的注入式 dispatch 带 `termination` 事实后断言 `timeoutCount` 递增 — checkable: 三处测试因字段缺失而失败
  - 在 `DispatchOutcome` 增可选 `termination` 字段（含 TSDoc 一行：终止是事实，与结论正交）；`lifecycle.ts` 单一派生点在终止分支填入，idle 时长取判官的终止时刻读数，`lastSample` 取内存中的末样本 — checkable: `:4500`、`:4543` 通过
  - 在 `ledger.ts` 的 `CrashRecord` 增 `promoted` 与 `idleMs`，`#reject` 写 crash record 时填入（终止轮取 termination 事实，非终止失败取 `false` / `null`）；修正所有既有 `CrashRecord` 构造点的类型 — checkable: 引擎 typecheck 通过
  - `cli.ts:653-656` 把 `incrementTimeoutCount` 从 `lastStatus === BLOCKED || TIMEOUT` 失败块中提出，改为在该块之前读 `step` 透出的 `outcome.termination` 非空即递增，不再看 status 词（升格轮非失败状态也必须递增，退出码仍 0）；新增测试：升格轮递增 `timeoutCount` 且退出 0；顺带核对 `session/run.ts` 的 `#bookkeep` 无需改动（升格轮 carrier 非失败，仍过 `:436` 门）— checkable: `:2259` 与升格轮递增测试通过，`pnpm -C packages/cdd-engine test` 无回归
- **Acceptance**: 终止事实唯一承载于 `DispatchOutcome.termination`；`timeoutCount` 只由该字段驱动；crash record 带 `promoted`、`idleMs`，既有 `lastSample` 不动；失败面行为与 P12 一致。
- **DependsOn**: none

### Task 3: review 面终止轮升格
- **Objective**: 被终止的 review 面轮先读 child 的 handoff 草稿；草稿合法且含至少一条 finding 即升格——走正常读回、持久化、`recordRound`、结论派生，退出码 0，stderr 一条 `CDD_WARN`，crash record 带 `promoted: true`；其余终止轮保持 TIMEOUT 失败面。
- **Files**: `packages/cdd-engine/src-next/face/lifecycle.ts`（`#dispatch` `:148-209` 的终止分支、`#reconstruct` `:391-474`、`#reject` `:490-522`；crash record 写入拆为独立方法）；`packages/cdd-engine/src-next/face/words.ts`（`CDD_WARN` 文案词条，沿用既有 `warn` station 词表，不另立第二张表）；测试落在 `face/__tests__/cli.test.ts`（终止轮端到端用例，沿用 `termination.test.ts` 的 fixture 风格；`face/__tests__/` 下无 `lifecycle.test.ts`，不新建）。
- **Consumes**: Task 2 的 `DispatchOutcome.termination` 与 `CrashRecord.promoted` / `idleMs`；既有 `#reconstruct` 的草稿校验（载体 schema）与 `HandoffSchema.conclusionOf`。
- **Produces**: 终止分支的两条出路——升格轮返回非失败 outcome（带 carrier、findings、`termination`）；非升格轮返回 TIMEOUT outcome（带 `termination`，行为同 P12）；升格 `CDD_WARN` 词条经 `Words` 渲染，由 lifecycle 唯一输出（CLI 层不输出）；`#probeDraft` 非拒绝草稿探针；独立的 crash record 写入方法（升格不打印 `CDD_BLOCKED`、不返回失败 outcome）。
- **Steps**:
  - 写失败测试 `promotes a terminated review round whose draft is valid and has findings`：review 面被终止、草稿合法含 findings，断言 outcome 非 TIMEOUT 词、`recordRound` 已记、`blocker:` 为真实计数、`next:` 给出、退出码 0、stderr 含 `CDD_WARN`、`timeoutCount` 递增、crash record `promoted: true` 且带 `idleMs` — checkable: 现状下失败
  - 写失败测试组 `does not promote`：implement 轮被终止、fix 轮被终止、review 面草稿缺失、草稿截断（非法 JSON）、草稿合法但零 findings，各断言仍 TIMEOUT 失败面（无 `next:`、不记账、退出码 1）且 `timeoutCount` 仍递增 — checkable: 现状下通过或因 `termination` 缺字段而失败，实现后全绿
  - 写失败测试 `a promoted round makes cdd fix --reviews accepted`：升格后 `fix` 门禁不再拒绝（`roundCount(review) > 0`） — checkable: 现状下失败
  - 重构 `#reconstruct`：抽出非拒绝草稿探针 `#probeDraft`（读草稿 + `schema.violations` + `findings.length >= 1`，只返回可升格 / 不可升格，不调用 `#reject`、不产生 outcome）；终止分支仅对 review 面调用该探针；可升格才走既有持久化与结论派生路径（复用既有校验与持久化，不新写第二套草稿解析）；不可升格（草稿缺失 / 非法 / 零 findings）落回既有 TIMEOUT `#reject`，携带 termination 事实，不得经 `#reconstruct` 的 `contract-violation` 拒绝路径 — checkable: `does not promote` 组全绿，非升格轮 crash record 的 cause 为终止原因而非 `contract-violation`
  - 把 crash record 写入从 `#reject` 拆为独立方法：`#reject` 调用它后再打印 `CDD_BLOCKED` 并返回失败 outcome；升格轮只调用该方法（`promoted: true`，带 `idleMs`）并由 lifecycle 输出唯一一条 `CDD_WARN`，该行含终止原因、`idleMs` 与末样本裁决及 findings 自草稿恢复；CLI 层不输出 `CDD_WARN` — checkable: 升格测试断言 stderr 恰有一条 `CDD_WARN` 且无 `CDD_BLOCKED`；上述三类测试通过
  - 清理终止分支中因本改动而冗余的直接 `#reject` 路径与注释 — checkable: `pnpm -C packages/cdd-engine test` 无回归，`check:no-bare-functions` 通过
- **Acceptance**: 升格条件三项（review 面 · 草稿合法 · ≥1 finding）全部满足才升格；截断 = 非法；implement / fix 轮永不升格；升格轮 `blocker:` 为真实计数、退出码 0、`timeoutCount` 递增、crash record `promoted: true`。
- **DependsOn**: 2

### Task 4: 失败摘要行去伪值与按状态键集
- **Objective**: TIMEOUT 与 BLOCKED 摘要行不输出 `blocker:` 键；`handoff:` 仅当该轮写了 crash record 时输出并指向之（no-host BLOCKED 属无 crash record，不带该栏）；键集单源改为 `words.capsuleKeys(status)`。
- **Files**: `packages/cdd-engine/src-next/face/words.ts`（`CAPSULE_WORDS.keys` 与 `capsuleKeys()`，约 `:238`）；`packages/cdd-engine/src-next/face/capsule.ts`（`emit`）；`packages/cdd-engine/src-next/session/run.ts`（`#capsuleLines`，约 `:560-580`）；测试 `face/__tests__/face.test.ts`（`:32`、`:73`、`:221` 当前 pin 无条件键表；`:199` pin 失败 capsule 的现有输出）、`session/__tests__/next.test.ts`（pin TIMEOUT 路由的 `next:`）。
- **Consumes**: Task 2 的 crash record 写入事实（`ledger.readCrash` 是否非空决定 `handoff:` 栏是否输出）；既有 `Capsule.emit` 与 `CapsuleKey` 类型。
- **Produces**: `Words.capsuleKeys(status: string, withHandoff: boolean): readonly CapsuleKey[]`——status 与 withHandoff 的纯函数，键集单源于 `CAPSULE_WORDS` 内一张声明表；成功状态返回 `status · blocker · handoff`，失败状态（TIMEOUT / BLOCKED）返回 `status`，仅当 `withHandoff` 时加 `handoff`；`Capsule.emit` 接收同一 `withHandoff` 标志，按该键集渲染，不自加特例。
- **Steps**:
  - 先翻新 pin：`face.test.ts:32`、`:73`、`:221` 由无条件键表改为按状态断言；`:199` 失败 capsule 断言 `status: TIMEOUT · handoff: crash-…json`（有 crash record）与 `status: BLOCKED`（无 crash record，无 `handoff:`）；`next.test.ts` 的 TIMEOUT 路由断言随之调整 — checkable: 这些测试因签名 / 输出变化而失败
  - 实现 `Words.capsuleKeys(status, withHandoff)`：键集数据以单一声明承载于 `CAPSULE_WORDS`，成功状态与失败状态各一行，不复制键名；`Capsule.emit` 按其渲染 — checkable: `face.test.ts` 通过
  - `#capsuleLines` 对失败状态不再计算 `blocker`，并以 `ledger.readCrash` 是否非空决定 `handoff` 入参（指向 `ledger.crashPath`）；`readCrash(lane, round)` 的 lane 取当前帧的 lane、round 取刚派发的那一轮；no-host BLOCKED（`lifecycle.ts:150-154`）不写 crash record，故不带 `handoff:` — checkable: 失败 capsule 零 `blocker:` 键，`cli.test.ts` 相关断言通过
  - 全局搜索 `capsuleKeys()` 无参调用点并迁移到双参签名，清除遗留的无参重载与死数据 — checkable: `grep -rn "capsuleKeys()" packages/cdd-engine/src-next` 零命中，`check:no-bare-functions` 通过
- **Acceptance**: TIMEOUT 与 BLOCKED 摘要行零 `blocker:` 键；`handoff:` 仅在写了 crash record 时输出并指向之；键集单源 `Words.capsuleKeys(status, withHandoff)`；`next:` 字面形态不变。
- **DependsOn**: 2

### Task 5: 终止时 idle 可见性与交付
- **Objective**: 终止时把 `idleMs` 与末样本写入 TIMEOUT 的 stderr 与 crash record；补 changeset；全量验证收口。
- **Files**: `packages/cdd-engine/src-next/face/lifecycle.ts`（`#reject` 的终止分支，stderr 的唯一发射点；CLI 层不输出，故不改 `cli.ts`）；`packages/cdd-engine/src-next/face/words.ts`（终止诊断词条）；`.changeset/` 下新增 changeset 文件（slug 如 `engine-child-termination-followup.md`）；测试 `face/__tests__/cli.test.ts`。
- **Consumes**: Task 2 的 `termination.idleMs` / `lastSample`；Task 3 的升格 `CDD_WARN`（本任务不重复输出）；Task 4 的失败摘要行。
- **Produces**: 非升格终止轮的终止诊断——不新增 stderr 行，而是在 `lifecycle.ts` `#reject` 终止分支已打印的那一条 `CDD_BLOCKED` / `TIMEOUT` 行上扩展，追加原因、`idleMs` 与末样本裁决（升格轮的同类信息已在 Task 3 的唯一 `CDD_WARN` 中，不重复输出，故每轮 stderr 至多一行，可直接计数断言）；cdd-engine minor changeset；交付态可发布。
- **Steps**:
  - 写失败测试 `terminated round reports idle duration and last sample on stderr and in the crash record`：非升格终止轮断言 stderr 的那一条扩展后的 `CDD_BLOCKED` / `TIMEOUT` 行含 idle 时长与末样本且该轮 stderr 仅此一行、crash record 含 `idleMs` 与 `lastSample`；升格轮断言 crash record 含二者、stderr 仅 Task 3 的一条 `CDD_WARN` — checkable: 现状下失败
  - 实现终止诊断输出，词条走 `Words`（一张表）；不加中途进度行、不加第二窗口 — checkable: 测试通过
  - 手写 `.changeset/` 条目：`@oscaner-skills/cdd-engine` **minor**，正文英文，记录 stdin 闭合、进程组回收、review 面终止轮升格、失败摘要行去 `blocker:`、终止时 idle 可见性 — checkable: `pnpm exec changeset status` 识别该条目
  - 全量验证：`pnpm run emit` 后 `pnpm run emit:check`，再 `pnpm run validate`（先提交再跑含 tree 依赖黑盒的完整面——提交需用户明确同意）— checkable: `pnpm run validate` ALL PASS；引擎 vitest 全绿
- **Acceptance**: 终止时 crash record 与 stderr 带 `idleMs` 与 `lastSample`；D53 常量零变，活面无新旗标 / 环境变量 / 配置 JSON；changeset minor 就位；`pnpm run validate` ALL PASS；不发布。
- **DependsOn**: 1, 3, 4

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-10-19 | 初稿——P13 实施计划：T1 spawn 面（stdin `ignore` + 进程组回收）· T2 终止事实载体与 crash record 新字段 · T3 review 面终止轮升格 · T4 失败摘要行去伪值与按状态键集 · T5 idle 可见性与交付（changeset minor · validate）。 | Oscar M. · Claude Opus 5（kairos:cdd-plan [P13]） |
