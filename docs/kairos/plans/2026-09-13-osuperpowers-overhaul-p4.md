# osuperpowers 架构重构 P4 — engine 契约面收敛 + skills 全面重写实施计划

**Spec:** [2026-09-13-osuperpowers-overhaul-p4-design.md](docs/kairos/specs/2026-09-13-osuperpowers-overhaul-p4-design.md)

- **Parent program**: [2026-09-13-osuperpowers-overhaul-overall.md v1.14](../specs/2026-09-13-osuperpowers-overhaul-overall.md)
- **Depends on**: P3 shipped（命令面四命令收敛 + `cli-research` 删除，PR #261 已 merge 至 develop，2026-09-15）
- **Base**: develop

## Constraints


从 overall v1.14 + P4 design v1.0 copy：

- **单根权威**：engine `bin`+`lib` 内 `process.cwd()` **出现次数 = 1**，且必须位于 `lib/root.mjs#initRoot()`。其余一律 `getRoot()`。全仓零 `rootFromDocPath`、零 `gitToplevel(process.cwd())` **副本**（**「副本」的落实口径 = engine `bin`+`lib` 内除该 canonical 点外零命中**，由 T8 ① 承担；`tests` 面不设常驻守卫——canonical 点自身必然是一条命中，把该 clause 写成「全仓零」会与 T8 Step 3 的 `toEqual([])` 冲突。`tests` 内的两处同名 token 由 T2 **一次性**清零，详见 T8 ⑤ 条目）。
- **单一坐标系**：`--plan` / `--spec` / `--findings` 一律**仓根相对**（绝对路径直用）；**不保留 cwd 相对回落**。未找到 → **exit 1** + BLOCKED **三行**诊断，**两种形态同为三行**（行数即断言锚点，不得增删）：
  - **仓根相对形**：① `CDD_BLOCKED: --<flag> not found: <arg>` ② `  Tried (against repo root <root>): <abs>` ③ `  Hint: cdd resolves paths against the repo root. Verify the path is correct relative to the repo root.`
  - **绝对路径形**：① 同首行（`<arg>` 即该绝对路径）② `  Absolute path does not exist.` ③ `  Hint: pass a repo-root-relative path instead.`
  - 两形态的 ① 逐字同形（首行前缀是 skills 侧唯一的路由读点）；③ 分化是**有意的**——绝对路径形的下一步动作是「改写成仓根相对」，与相对形的「核对相对位置」不是同一指导。两种形态各有一条可区分断言（T2 Step 1）。
- **退出码唯一口径 = design §2.4.2 表**：**0** = OK（正常完成 / `--dry-run` / `--help`）· **1** = 运行期不可继续（路径不存在 · 宿主缺失 · engine 自写 BLOCKED · 计数器终态耗尽）· **2** = 用法 / 环境错（commander 用法错误 · `CDD_CLI_MISSING`）· **3** = Review Stopping。**路径不存在取 1、不取 2**——与既有 `RunBlocked: plan file not found`（exit 1）同义：路径写错属「本次调用不可继续」，不属「命令行用错」。本计划内任何 `process.exit(2)` 凡为路径类 BLOCKED 一律为缺陷。
- **输入闭包五规则**：① 单源 ② 坐标系一 ③ 派生单向（引擎自算值不得回流为输入）④ 无形状推断 ⑤ 隔离经边界（测试用 `mkdtemp` 真 git 仓，**禁止** env 旁路缝）。
- **运行期 context 零落盘**：engine 内零「写 context 到任意路径」的调用。
- **输出契约单源**：提示词注入的 handoff 结构由 `templates/schema/*.json` **原样注入**（`JSON.stringify`，T18 终态；`type` / `enum` / 嵌套形状 / `allOf` 条件随行可见）；**engine 写侧经同一 schema 构造**；校验失败**保留 findings** 且报错含**违规键名**；handoff 序列化统一 `JSON.stringify` 全转义。
- **失败六类**：`TIMEOUT` / `CONTRACT_VIOLATION` / `ENGINE_SELF_WRITTEN` / `EXECUTION_FAILURE` / `UNVERIFIABLE` / `PLAN_CONFLICT`；**仅 `EXECUTION_FAILURE` 消耗 `engineRecoveryCount`**；`CONTRACT_VIOLATION` / `ENGINE_SELF_WRITTEN` 各持独立计数器与终态；**六类均不计入 Review Stopping**（Stopping 只读 review handoff 的 `findings[].severity === "blocker"` 计数）。
- **超时**：`DEFAULT_TIMEOUTS = { task: 5_400_000, review: 3_600_000 }`（90 / 60 分钟）；判定**引擎自持**——**零 `res.timedOut` 单点依赖**。
- **skills 面**：session-call 原语 = `Run a /<plugin>:<skill> session`；**零上游文档 read**（零 `vendors/` 路径、零上游 `SKILL.md` 路径、零 `Read-Upstream` 措辞）；**零 `fix-inline`**（修复一律 `cdd fix`）；**零引擎内部结构依赖**（零 `CDD_*` env 名、零 `progress.json`、零 handoff 文件名模式）——**scope 逐字取自 design AC5 = 7 个编排型 skill**（AC5 全枚举：`brainstorming` / `writing-single-spec` / `writing-overall-spec` / `writing-phase-spec` / `writing-plans` / `cli-driven-development` / `finishing`）；**`report-issue` 按 AC5 的显式例外排除**（其 `progress.json#plan` 读取是 program 通道首跳、非「引擎内部结构依赖」；去留归 P5 目标流程）——T16 守卫 2 的 scope 按此落地，见 T16 Step 4；Review Stopping 入各 skill 的 `## Invariants` 一行。
- **不改变引擎评审语义本体**：Review Stopping 的**判据**、commit-contract、`doc_hash` 双签名不动；P4 只动契约面。
- **测试断言禁假绿**：断言必须用**完整可区分形态**；凡是「删前删后同结果」的断言（如 bare 命令在 Commander required-option 下亦 exit 2）一律不用。
- 所有改动须过 `pnpm run validate`（13 块）+ `pnpm run emit:check` 无 drift；**emit 唯一入口 = 仓库根 `pnpm run emit`**（`packages/osuperpowers/package.json` 无 scripts 字段）。
- **破坏性重构已授权**（用户 2026-09-13 / 2026-09-15：允许破坏性变更、确保最佳实践、不留技术债务、遗留即删）。
- vendored 子模块不可改（`superpowers` / `mattpocock-skills` / `impeccable`）。
- **cdd 命令一律在仓根执行、路径写仓根相对**（本计划所有 `cdd …` 调用均以仓库根为 cwd）。
- changeset：`@oscaner-skills/cdd-engine` minor + `@oscaner-skills/osuperpowers` minor（一条双包）；P1/P2/P3 的 per-phase changeset 保留。

> **§2.9 overall 回填已完成（非本计划任务）**：design §2.9 的四表回填已于 `commit-spec` 前置门落地并提交（overall v1.13 → **v1.14**，commit `50e7c0d`，块 12 `3/4 canonical` 全绿）。实现者无需再改 overall。

> **实现前置（豁免面）**：历史 plan（含本文件）与 `docs/osuperpowers/{specs,plans}/*.md` **不在**任何守卫或 AC 的零残留作用域内；实现者若在历史文档中读到 `cdd brief` / `task-review` / `handoff-schema.md` 等字样，属正常，**勿"顺手清理"**。

> **P4 自伤风险（本计划排序的直接理由）**：段 ② 未落地前，本 phase 自身的 CDD task dispatch 仍可能踩 `additionalProperties` 拒绝（#260[1]）与 `blocker: null` 被拒（#260[5]）——两者都是**确定性**的。故 T1–T8（engine 段）**必须排在 T12 之后的所有 skill/文档工作之前**。


### Task 1: 单根权威 — `lib/root.mjs` + `process.cwd()` 收口 + lifecycle 路径纯派生

- **Objective**: 单根权威 — `lib/root.mjs` + `process.cwd()` 收口为 1 处 + lifecycle 路径纯派生（engine 唯一 cwd 转换点 + `preAction` 钩子定序）
- **DependsOn**: none

- **Consumes**: design §2.4.1；`lib/contract/commit.mjs#gitToplevel`

- **Produces**: `lib/root.mjs` 导出 `initRoot()`（engine 内唯一 `process.cwd()` 调用点，非 git 仓 → `CDD_BLOCKED: not in a git repository` + exit 1）与 `getRoot()`（未初始化即 throw）
- **Produces**: `bin/cdd.mjs` 在 commander 的 `preAction` 钩子内调用 `initRoot()`，`initProcLifecycle` / `reapStale` 同置于该钩子内（仍在任何 action / dispatch 之前）

- **Files**: packages/cdd-engine/lib/root.mjs, packages/cdd-engine/bin/cdd.mjs, packages/cdd-engine/lib/cli/review.mjs, packages/cdd-engine/lib/cli/fix.mjs, packages/cdd-engine/lib/cli/branch-review.mjs, packages/cdd-engine/lib/runner/run-docs.mjs, packages/cdd-engine/lib/runner/run-task.mjs, packages/cdd-engine/tests/docs-runner.test.mjs, packages/cdd-engine/tests/root.test.mjs

- **Steps**:
  1. 写失败测试（红）— 非 git 目录下 `initRoot()` BLOCKED + `cdd --help` 退出码钉住：创建 `packages/cdd-engine/tests/root.test.mjs`——非 git 目录（`mkdtempSync`）`cdd review --type spec --spec x.md` → exit 1 + stderr 匹配 `CDD_BLOCKED: not in a git repository`；**`cdd --help` 钉住用例**——非 git 目录 + `--help` → exit 0 + stdout 匹配 `Usage: cdd`（当前即绿，用于区分「`initRoot()` 前置于 parseAsync」与「`preAction` 延后」两种实现，**不得删**，删后 Step 4 的定序回归无守卫） — checkable: root.test.mjs 两条用例落盘（initRoot BLOCKED 红 + `--help` exit 0 钉住绿）
  2. 跑测试确认红：`pnpm --filter @oscaner-skills/cdd-engine test -- root.test.mjs` — checkable: FAIL（`lib/root.mjs` 不存在 → stderr 不匹配 `not in a git repository`）；**`--help` 用例当前即绿——它是钉住测试，不是红测试，不得删**
  3. 创建 `lib/root.mjs`：`initRoot()` 调 `gitToplevel(process.cwd())`（**全 engine 唯一的 cwd 读取点**，token 只在此行出现、注释一律写成散文——否则计数断言裸 grep 多算 1 行成为假红源），非 git 仓 → stderr `CDD_BLOCKED: not in a git repository` + `process.exit(1)`；`getRoot()` 未初始化即 throw — checkable: root.test.mjs 红转绿（initRoot BLOCKED + `--help` exit 0）
  4. 改 `bin/cdd.mjs` — 唯一调用点在 `preAction` 钩子内 + lifecycle 纯派生：`program.hook("preAction", async () => { const repoRoot = initRoot(); initProcLifecycle({ diskPath: path.join(repoRoot, ".osuperpowers", "cdd", "lifecycle.json") }); await reapStale({ graceMs: 2000 }); })`；**删除**原顶层的 `initProcLifecycle(...)` / `await reapStale(...)` 两行（由钩子承接，不得留两份）；删除 `bin/cdd.mjs:22-23` 两行 `CDD_LIFECYCLE_PATH` 注释；追加 `import { initRoot } from "../lib/root.mjs";` — checkable: `initRoot()` 唯一调用点在 `preAction` 钩子内（`--help` exit 0 钉住用例绿——initRoot 不被前置于 parseAsync；`--version` 不引入 `.version()` 声明，属 unknown option exit 2）
  5. 替换 4 处 `gitToplevel(process.cwd())` → `getRoot()`：`cli/review.mjs:120,141` · `cli/fix.mjs:65` · `cli/branch-review.mjs:46` 改为 `getRoot()`（加 import；文件内 `gitToplevel` 无其它用途则删其 import）；`runner/run-docs.mjs:52` 改为真用调用方传入的 `repoRoot`（`opts.repoRoot ?? getRoot()`）并同步 `:4`/`:44`/`:51` 三处注释旧措辞（注释也是计数断言的命中面）；`runner/run-task.mjs:282` `const cwd = opts.cwd ?? process.cwd();` → `const cwd = getRoot();` — checkable: engine bin/lib 内 `process.cwd()` 命中行数 = 1 且唯一命中文件 = `lib/root.mjs`（改动前实测 10 行 = 7 处真实调用 + 3 行 run-docs 注释）
  6. 同步补 `docs-runner.test.mjs` 的 11 处调用点（`:174,186,203,217,251,281,303,319,344,364,393`）补 `repoRoot: "/repo/root"`——`opts.repoRoot ?? getRoot()` 右支 `getRoot()` 未初始化即 throw（`getRoot` 是模块级单例、无 reset 缝，测试不得调 `initRoot()`；`:203` 的 `rejects.toThrow(/handoffPath required/)` 会被该 throw 抢先）；**`dryRun: true` 的 `:128` 不改**（`repoRoot` 在 `if (dryRun) return` 之后才求值）；跑 engine 套件 + 计数断言（`grep -rn "process\.cwd()" packages/cdd-engine/bin packages/cdd-engine/lib` 期望恰好 1 行且唯一命中文件为 `lib/root.mjs`） — checkable: `grep -rn "process\.cwd()"` bin/lib = 1 行且唯一命中文件 `lib/root.mjs`；engine 套件全绿
  7. Commit：`git add packages/cdd-engine/lib/root.mjs packages/cdd-engine/bin/cdd.mjs packages/cdd-engine/lib/cli packages/cdd-engine/lib/runner packages/cdd-engine/tests/root.test.mjs packages/cdd-engine/tests/docs-runner.test.mjs`；`git commit -m "refactor(cdd-engine): 单根权威 lib/root.mjs — process.cwd() 收口为 1 处 + lifecycle 路径纯派生"` — checkable: T1 变更面单提交落盘（conventional）

- **Acceptance**:
  - root.test.mjs 两条用例落盘（initRoot BLOCKED 红 + `--help` exit 0 钉住绿）
  - FAIL（`lib/root.mjs` 不存在 → stderr 不匹配 `not in a git repository`）；**`--help` 用例当前即绿——它是钉住测试，不是红测试，不得删**
  - root.test.mjs 红转绿（initRoot BLOCKED + `--help` exit 0）
  - `initRoot()` 唯一调用点在 `preAction` 钩子内（`--help` exit 0 钉住用例绿——initRoot 不被前置于 parseAsync；`--version` 不引入 `.version()` 声明，属 unknown option exit 2）
  - engine bin/lib 内 `process.cwd()` 命中行数 = 1 且唯一命中文件 = `lib/root.mjs`（改动前实测 10 行 = 7 处真实调用 + 3 行 run-docs 注释）
  - `grep -rn "process\.cwd()"` bin/lib = 1 行且唯一命中文件 `lib/root.mjs`；engine 套件全绿
  - T1 变更面单提交落盘（conventional）

### Task 2: 单一坐标系 — `resolveDocArg` + `resolveWorkspace(doc, root)` + 删 `rootFromDocPath`

- **Objective**: 单一坐标系 — `resolveDocArg` + `resolveWorkspace(doc, root)` + 删 `rootFromDocPath`（路径类实参唯一归一 + 全部机制位置清零）
- **DependsOn**: 1

- **Consumes**: T1 的 `getRoot()`

- **Produces**: `resolveDocArg(arg， root， flag)`（绝对路径直用；否则 `path.join(root， arg)`；不存在 → exit 1 + 三行诊断）
- **Produces**: `resolveWorkspace(doc， root): string`（签名变更——新增第二参 root；无 root 即 throw）
- **Produces**: `runReview(opts)` / `runFix(opts)` 增 `opts.root` 注入位（`opts.root ?? getRoot()`）
- **Produces**: 全仓零 `rootFromDocPath` / `resolveRepoRoot`（含 tests 与 scripts）

- **Files**: packages/cdd-engine/lib/root.mjs, packages/cdd-engine/lib/handoff/naming.mjs, packages/cdd-engine/lib/cli/shared.mjs, packages/cdd-engine/lib/cli/review.mjs, packages/cdd-engine/lib/cli/fix.mjs, packages/cdd-engine/lib/cli/branch-review.mjs, packages/cdd-engine/lib/cli/base-branch.mjs, packages/cdd-engine/tests/docs-runner.test.mjs, packages/cdd-engine/tests/root.test.mjs, packages/cdd-engine/tests/handoff-naming.test.mjs, packages/cdd-engine/tests/cdd.test.mjs, scripts/lib/doc-root.mjs

- **Steps**:
  1. 写失败测试（红）— 子目录 + 仓根相对路径不再产生幽灵根；负例给三行诊断：追加到 `tests/root.test.mjs`——自给自足 mkdtemp 真 git 仓 + 真 doc 文件，子目录 cwd 下 `cdd review --type spec --spec <rel>`（`CDD_DRY_RUN=1` 过渡态）→ exit 0 + **子目录下零幽灵根 `.osuperpowers/`**；不存在的仓根相对路径 → exit 1 + BLOCKED **三行**诊断（`CDD_BLOCKED: --spec not found: …` + `Tried (against repo root …)` + `Hint: cdd resolves paths against the repo root.`）；不存在的绝对路径 → exit 1 + 三行（绝对路径形措辞 `Absolute path does not exist.` + `Hint: pass a repo-root-relative path instead.`，不出现 `Tried (against repo root`） — checkable: 三用例落盘且现行为红（子目录用例产生幽灵根；负例 stderr 为 `RunBlocked: plan file not found` 不匹配）
  2. 跑测试确认红：`pnpm --filter @oscaner-skills/cdd-engine test -- root.test.mjs` — checkable: FAIL（现行为：子目录用例产生幽灵根；负例行数/文案不匹配）
  3. 追加 `resolveDocArg` 到 `lib/root.mjs`：`path.isAbsolute(arg)` → 存在直用，不存在 → 三行诊断（`CDD_BLOCKED: --<flag> not found: <arg>` + `Absolute path does not exist.` + `Hint: pass a repo-root-relative path instead.`）；否则 `path.join(root, arg)` → 存在返回，不存在 → 三行（`Tried (against repo root <root>): <abs>` + `Hint: cdd resolves paths against the repo root.`）；一律 `process.exit(1)`（§2.4.2：路径不存在取 1，不取 2） — checkable: `resolveDocArg` 三行诊断两形态（相对/绝对）落位
  4. 改 `handoff/naming.mjs#resolveWorkspace` — 收注入 root，删 `rootFromDocPath`：`resolveWorkspace(doc, root)` 无 root 即 throw `resolveWorkspace: root required (injected from lib/root.mjs)`；**整段删除** `rootFromDocPath`（含注释块与「与 `scripts/lib/doc-root.mjs` 同步」交叉引用注）；同步删 `gitToplevel` / `path` 相关 import（若无其它用途）。**同一步清零 ⑤ 的其余命中点**——`tests/docs-runner.test.mjs:141` 用例名去 `gitToplevel(process.cwd())` 字面、`:155` 行尾注释改「repoRoot 由调用方注入并真被使用」、`:162` 注释去 `rootFromDocPath` 字面；`scripts/lib/doc-root.mjs:7-9` 删「⚠️ 引擎内独立副本」整段（引擎侧已无第二份实现，留着即指向已删函数的悬空治理文本） — checkable: `resolveWorkspace` 单参 → `toThrow(/root required/)`；全仓零 `rootFromDocPath`（packages/cdd-engine + scripts 两面，历史文档豁免）
  5. 归一入口接线：`cli/shared.mjs#resolveTargetDoc(opts, verb)` 返回前过 `resolveDocArg(doc, opts.root ?? getRoot(), opts.type === "spec" ? "spec" : "plan")`；`cli/fix.mjs` 的 `--findings` 过 `resolveDocArg(opts.findings, opts.root ?? getRoot(), "findings")`；`cli/review.mjs:141` 与 `cli/fix.mjs` 的 `--plan` 分支确保送入 `resolveWorkspace` 的 doc 已是绝对路径；**`cli/base-branch.mjs#resolveBaseBranchWorkspace`**：`opts.plan` **先**过 `resolveDocArg(opts.plan, root, "plan")`、**再**入 `resolveWorkspace(normalizedPlan, root)`——**这是 `lib/cli/**` 内的第 4 条归一 call site，最易漏**（base-branch 不经 `resolveTargetDoc`，是独立入口；只补第二参等于让该命令保留第二套坐标系）；`runReview` / `runFix` 顶部加 `const root = opts.root ?? getRoot();` — checkable: `--plan`/`--spec`/`--findings` 每个读取点（§2.4.2 read point 7 处）均有对应 `resolveDocArg` 调用（T8 ④ 的正向核对面）
  6. 测试侧迁移：`handoff-naming.test.mjs:63,64` 传仓根字面量（正例）；`:70,72` 改为单参 → `toThrow(/root required/)`（旧派生行为已删的可区分断言）；`cdd.test.mjs:331,333` 传仓根字面量；`cdd.test.mjs` 两条 **in-process 用例**改 mkdtemp 真仓 + 真 doc + `root: repo` 注入（期望值由 repo 计算，原 `/repo/root/...` 字面量作废；dry-run 过渡态 `process.env.CDD_DRY_RUN` 保留、T3 换 `setDryRun(true)`）；测试**不得**调 `initRoot()`、不得 `process.chdir()` — checkable: 迁移后 engine 套件全绿（含两条 in-process 用例合规通道）
  7. 跑测试 + 全仓零残留：`pnpm --filter @oscaner-skills/cdd-engine test`；`grep -rn "rootFromDocPath" packages/cdd-engine scripts` 零命中；`grep -rnF "gitToplevel(process.cwd())" packages/cdd-engine/tests` 零命中；`grep -rnE "resolveWorkspace\(|resolveDocArg\(" packages/cdd-engine/lib`（剔除整行注释）每一条命中都在命中台账内（定义行 / 生产调用点四点 / 帮助文本子串 / 第二实现） — checkable: engine 套件全绿；`rootFromDocPath` / `gitToplevel(process.cwd())`（tests 面）零命中；resolveWorkspace/resolveDocArg 调用点 ⊆ 台账
  8. Commit：`git add packages/cdd-engine/lib packages/cdd-engine/tests scripts/lib/doc-root.mjs`；`git commit -m "refactor(cdd-engine): 单一坐标系 resolveDocArg + resolveWorkspace 收注入 root + 删 rootFromDocPath"`（`scripts/lib/doc-root.mjs` 必须一并 add——它是 ⑤ 的命中面，只 add engine 会让它留在工作区成为未提交面） — checkable: T2 变更面单提交落盘（conventional）

- **Acceptance**:
  - 三用例落盘且现行为红（子目录用例产生幽灵根；负例 stderr 为 `RunBlocked: plan file not found` 不匹配）
  - FAIL（现行为：子目录用例产生幽灵根；负例行数/文案不匹配）
  - `resolveDocArg` 三行诊断两形态（相对/绝对）落位
  - `resolveWorkspace` 单参 → `toThrow(/root required/)`；全仓零 `rootFromDocPath`（packages/cdd-engine + scripts 两面，历史文档豁免）
  - `--plan`/`--spec`/`--findings` 每个读取点（§2.4.2 read point 7 处）均有对应 `resolveDocArg` 调用（T8 ④ 的正向核对面）
  - 迁移后 engine 套件全绿（含两条 in-process 用例合规通道）
  - engine 套件全绿；`rootFromDocPath` / `gitToplevel(process.cwd())`（tests 面）零命中；resolveWorkspace/resolveDocArg 调用点 ⊆ 台账
  - T2 变更面单提交落盘（conventional）

### Task 3: 环境面收口（γ）— 9 项去 env 化 + `PLAN_FILE` 改参数 + `CDD_DRY_RUN` 升 argv + 缝删净 + 测试脚手架改真仓

- **Objective**: 环境面收口 — 9 项去 env 化 + `PLAN_FILE` 改参数 + `CDD_DRY_RUN` 升 program 级 argv + 测试缝删净 + 测试脚手架改真仓
- **DependsOn**: 2

- **Consumes**: T1 `getRoot()`、T2 `resolveDocArg`

- **Produces**: `buildTaskEnv()` 不复存在（拆为 `buildCtx(root， taskNum， opts)` 返回 `{workspace， handoffPath， briefPath， ledgerPath， constraintsPath， findingsPath， mode， harness， fixedPoint}`、`buildPromptParams(ctx， taskNum)`、子进程 env = 宿主 env）
- **Produces**: `runTask(harness， task， opts)` 的 options 集 = `{ mode， planFile， root， dryRun， env， noExit， registryPath， findingsPath， pluginRoot }`
- **Produces**: `DRY_RUN()` 读 program 级解析结果（写入侧导出 `setDryRun(enabled)`）；`resolveRepoRoot` / `backfillPlanFromLedger` 删除
- **Produces**: 引擎 env 取值直读键 ⊆ 白名单（7 键）；六键名零命中（`CDD_LIFECYCLE_PATH` / `CDD_REGISTRY_PATH` / `NODE_ENV` / `CDD_DRY_RUN` / `PLAN_FILE` / `CDD_HANDOFF_PATH`）；`TEST_SEAM` 缝删净

- **Files**: packages/cdd-engine/lib/runner/run-task.mjs, packages/cdd-engine/lib/cli/parse.mjs, packages/cdd-engine/lib/cli/fix.mjs, packages/cdd-engine/lib/cli/review.mjs, packages/cdd-engine/lib/cli/shared.mjs, packages/cdd-engine/bin/cdd.mjs, packages/cdd-engine/lib/templates.mjs, packages/cdd-engine/lib/contract/commit.mjs, packages/cdd-engine/lib/registry.mjs, packages/cdd-engine/lib/lifecycle/proc.mjs, packages/cdd-engine/tests/helpers.mjs, packages/cdd-engine/tests/env-surface.test.mjs, packages/cdd-engine/tests/runner.test.mjs, packages/cdd-engine/tests/progress-owner.test.mjs, packages/cdd-engine/tests/task.test.mjs, packages/cdd-engine/tests/docs-task.test.mjs, packages/cdd-engine/tests/cdd.test.mjs, packages/cdd-engine/tests/cli-shape.test.mjs, packages/cdd-engine/tests/host-detection.test.mjs, packages/cdd-engine/tests/branch-review.test.mjs, packages/cdd-engine/tests/base-branch.test.mjs, packages/cdd-engine/tests/lifecycle.wiring.test.mjs, packages/cdd-engine/tests/root.test.mjs, packages/cdd-engine/tests/lifecycle.proc.test.mjs, scripts/validate/smoke-cdd.mjs

- **Steps**:
  1. 写失败测试（红）— 引擎 env 面闭集：创建 `packages/cdd-engine/tests/env-surface.test.mjs`——取值直读键 ⊆ 白名单（`CURSOR_TRACE_ID` / `CLAUDE_CODE_SESSION_ID` / `AI_AGENT` / `PATH` / `CDD_CLI_TIMEOUT` / `CDD_TASK_TIMEOUT` / `CDD_REVIEW_TIMEOUT` 七键；匹配 `process.env.X` / `process.env["X"]` / `env.X` 三形）；零 spread 注入（`grep -rnE '\.\.\.process\.env' bin lib` = 0）；六个已删键名零命中（`grep -rnE 'CDD_LIFECYCLE_PATH|CDD_REGISTRY_PATH|NODE_ENV|CDD_DRY_RUN|PLAN_FILE|CDD_HANDOFF_PATH' bin lib` = 0） — checkable: env-surface.test.mjs 三断言落盘且红（`CDD_DRY_RUN` / `CDD_LIFECYCLE_PATH` / 等命中）
  2. 跑测试确认红：`pnpm --filter @oscaner-skills/cdd-engine test -- env-surface.test.mjs` — checkable: FAIL（六个键名命中、spread 三处命中）
  3. `--plan` 改显式参数 + `CDD_DRY_RUN` 升 program 级 argv + `buildTaskEnv` 拆三产物：`parse.mjs`/`fix.mjs`/`review.mjs` 的 `env: { ...process.env, ...(opts.plan ? { PLAN_FILE: opts.plan } : {}) }` → `planFile: opts.plan`（spread 整段消失）；`lib/cli/parse.mjs` program 级声明 `program.option("--dry-run", …)`（`--help` 同一实例；flag 位于子命令之前，子命令内不重复声明）；`bin/cdd.mjs` **只**在 preAction 钩子内 `setDryRun(program.opts().dryRun === true)`；`DRY_RUN()` 读模块态并导出 `setDryRun(enabled)`（in-process 用例的唯一合规通道）；`templates.mjs:131` `renderTemplate` 收显式 `planFile` 实参，`PLAN_LINE: planFile ? `**Plan:** ${planFile}` : ''`（不引入 `PLAN_FILE` 插值键）；`resolveRepoRoot` 删除 + `backfillPlanFromLedger` 整段删除；`buildTaskEnv` 拆为 `buildCtx` / `buildPromptParams` / 宿主 env child；`runTask` 增 root 注入位 `const root = opts.root ?? getRoot();`；~25 处 `env.CDD_*` 读取改读 `ctx.*`；**注释清理**（六键零命中的必要面）：`run-task.mjs:4` / `:359` 去 `PLAN_FILE` + `resolveRepoRoot` 字样、`:260` 去 `CDD_DRY_RUN=1` 字样 — checkable: env-surface.test.mjs 红转绿（六键零命中含注释行）
  4. 删 `CDD_WORKSPACE` 直设分支与 `commit.mjs` 回流：`resolveRepoRoot` / `resolveWorkspace` 的 `env.CDD_WORKSPACE` 分支整段删除；`contract/commit.mjs:67` `opts.handoffPath ?? process.env.CDD_HANDOFF_PATH ?? ""` → `opts.handoffPath ?? ""`；`:62` 注释同步单一来源；`registry.mjs:41` 删 `CDD_REGISTRY_PATH` 死注释、`:69` 删 `CDD_DRY_RUN=1` 死注释 — checkable: 六键零命中（含注释）在 bin+lib 成立
  5. `CDD_LIFECYCLE_PATH` + `TEST_SEAM` 删净 + 测试脚手架改真仓：① 删 `tests/helpers.mjs` 的 `LIFECYCLE_PATH` 常量与 `forkLifecyclePath` 导出 + 8 个 `*.test.mjs` 的 `CDD_LIFECYCLE_PATH` 注入；② `lib/lifecycle/proc.mjs` 的 `TEST_SEAM` **整块**删除（`:6-7` 与 `:27-33` 两处注释块 + `TEST_SEAM` 常量（`:29`，含唯一 `process.env.NODE_ENV` 读取）+ `__registryForTest` / `__resetForTest` 两导出）；`tests/lifecycle.proc.test.mjs` 改经真实边界重建（`beforeEach` 内 `initProcLifecycle({ diskPath })` + 真实 spawn/teardown 一轮），**不得**为测试重开任何 `__*ForTest` 后门；③ `CDD_DRY_RUN` → argv 前置 `--dry-run`（`cdd` / `cli-shape` / `docs-task` / `host-detection` / `branch-review` / `task` + `root.test.mjs` 子目录用例 + `fixtures/smoke-spec.md` 注释；**例外**：`cdd.test.mjs` 两条 in-process 用例改 `setDryRun(true)`，argv 对它们物理不适用）；`CDD_WORKSPACE` 注入点（`task` / `docs-task`）改真仓 + `--plan`；④ **仓工具链消费方**：`scripts/validate/smoke-cdd.mjs` 四条命令改 argv 前置 `--dry-run`（program 级 flag 必须在子命令之前）、`:60` env 收敛为 `{ ...process.env, CLAUDE_CODE_SESSION_ID: "1" }`、`:3-5` 头注释改 argv 口径；⑤ **`buildTaskEnv` 测试面迁移**：`tests/runner.test.mjs` import 换 `buildCtx`/`buildPromptParams`、5 个调用点（`:377,385,847,853,865`）断言面由 `env.CDD_*` → `ctx.*`、四条用例名与两条分节标题同步；`tests/task.test.mjs:107` 注释同步 — checkable: engine 套件全绿（含迁移后断言面）；六键零命中；`TEST_SEAM` 零残留
  6. 跑全量 + 闭集断言：`pnpm --filter @oscaner-skills/cdd-engine test` + `pnpm run validate` — checkable: engine 套件全绿（host-detection / cli-shape 并发 flake 按 owner-liveness 论证排查，不得降级跳过）；validate 13 块全绿
  7. Commit：`git add packages/cdd-engine scripts/validate/smoke-cdd.mjs`；`git commit -m "refactor(cdd-engine): 环境面收口 γ — 9 项派生值去 env 化 + PLAN_FILE 改参数 + 测试缝删净"` — checkable: T3 变更面单提交落盘（conventional）

- **Acceptance**:
  - env-surface.test.mjs 三断言落盘且红（`CDD_DRY_RUN` / `CDD_LIFECYCLE_PATH` / 等命中）
  - FAIL（六个键名命中、spread 三处命中）
  - env-surface.test.mjs 红转绿（六键零命中含注释行）
  - 六键零命中（含注释）在 bin+lib 成立
  - engine 套件全绿（含迁移后断言面）；六键零命中；`TEST_SEAM` 零残留
  - engine 套件全绿（host-detection / cli-shape 并发 flake 按 owner-liveness 论证排查，不得降级跳过）；validate 13 块全绿
  - T3 变更面单提交落盘（conventional）

### Task 4: `context-contract.json` canonical + `lib/context.mjs` 运行期组合

- **Objective**: `context-contract.json` canonical + `lib/context.mjs` 运行期组合（timeout 默认值 / per-mode env 名单源）
- **DependsOn**: 3

- **Consumes**: T3 的 `ctx` 形态

- **Produces**: `context-contract.json` = `{ channels: { argv， git， env }， derived: {...}， transport: {...}， timeouts: { defaults: { task: 5400000， review: 3600000 }， perModeOverride， globalOverride } }`
- **Produces**: `lib/context.mjs` 导出 `loadContract()`（唯一导出）

- **Files**: packages/cdd-engine/templates/context-contract.json, packages/cdd-engine/lib/context.mjs, packages/cdd-engine/lib/lifecycle/cli.mjs, packages/cdd-engine/tests/env-surface.test.mjs, packages/cdd-engine/tests/cli-shared.test.mjs, packages/cdd-engine/tests/context.test.mjs

- **Steps**:
  1. 写失败测试（红）— canonical 承重：创建 `packages/cdd-engine/tests/context.test.mjs`——timeout 默认值取自 canonical（`c.timeouts.defaults.task` = 5_400_000 / `review` = 3_600_000，`resolveTimeoutMs({}, mode) === c.timeouts.defaults[mode]`）；per-mode env 优先于全局覆写、全局覆写取整到 stepSeconds；env 白名单取自 canonical 且恰为 7 键（`Object.values(c.channels.env).flatMap(v => v.var ? [v.var] : v.markers)`） — checkable: context.test.mjs 三断言落盘且红（`loadContract` 不存在）
  2. 跑测试确认红：`pnpm --filter @oscaner-skills/cdd-engine test -- context.test.mjs` — checkable: FAIL（`loadContract` 未导出——导入/调用即红）
  3. 写 canonical：`templates/context-contract.json`——`channels.argv` 键集 = `lib/cli/parse.mjs` 内全部 `.option()` / `.requiredOption()` 声明 ∪ program 级 `--dry-run` ∩ `program.helpOption("-h, --help")`（**含 `--source` / `--force` 与 `help`**，缺任一即 T8 ⑨「usage flag ⊆ canonical argv」不可满足）+ `channels.git` / `channels.env`（3 宿主识别 markers + `PATH` + 3 timeouts）+ `derived`（root / slug / workspace / handoffPath / briefPath / ledgerPath / constraintsPath / findingsPath / fixedPoint）+ `transport.childEnv` + `timeouts`（defaults 5400000/3600000，perModeOverride / globalOverride stepSeconds 1800） — checkable: canonical JSON 落盘；`channels.argv` 键集与 parse.mjs 声明逐条比对无缺
  4. 写 `lib/context.mjs`（运行期组合）：读 canonical 构造内存 context，**只导出 `loadContract()`**（`buildContext` 有意不交付——派生构造点已由 T3 的 `buildCtx` 唯一承担，再立一个即同一事实的第二实现）；`lib/lifecycle/cli.mjs` 的 timeout 默认值 / per-mode env 名改从 `loadContract()` 读取（删除硬编码）；`:6` 的 30 分钟注释同步改写（注释也是口径载体）；**同步 `tests/cli-shared.test.mjs:20-22`**——`default task timeout is 90min`（5_400_000）+ 新增 `default review timeout is 60min`（3_600_000）两条同 commit（只改 task 侧则 review 默认值零断言；与 context.test 的 canonical 引用同源同值） — checkable: `loadContract()` 导出；cli-shared 两断言绿（90/60 分钟）；env 白名单派生同源
  5. 跑测试：`pnpm --filter @oscaner-skills/cdd-engine test -- context.test.mjs cli-shared.test.mjs` — checkable: 两文件全绿（cli-shared 是本任务唯一会红的既有用例，只跑 context.test 会让该红延迟到全量绿处暴露）
  6. Commit：`git add packages/cdd-engine/templates/context-contract.json packages/cdd-engine/lib/context.mjs packages/cdd-engine/lib/lifecycle/cli.mjs packages/cdd-engine/tests/context.test.mjs packages/cdd-engine/tests/cli-shared.test.mjs packages/cdd-engine/tests/env-surface.test.mjs`；`git commit -m "feat(cdd-engine): context-contract canonical + 运行期组合（timeout/env 名单源）"` — checkable: T4 变更面单提交落盘（conventional）

- **Acceptance**:
  - context.test.mjs 三断言落盘且红（`loadContract` 不存在）
  - FAIL（`loadContract` 未导出——导入/调用即红）
  - canonical JSON 落盘；`channels.argv` 键集与 parse.mjs 声明逐条比对无缺
  - `loadContract()` 导出；cli-shared 两断言绿（90/60 分钟）；env 白名单派生同源
  - 两文件全绿（cli-shared 是本任务唯一会红的既有用例，只跑 context.test 会让该红延迟到全量绿处暴露）
  - T4 变更面单提交落盘（conventional）

### Task 5: 输出契约单源 — schema 注入 + 写侧同源 + 校验失败保留 findings + 序列化

- **Objective**: 输出契约单源 — schema 注入 + 写侧同源 + 校验失败保留 findings + 序列化（`renderHandoffStub` 手写 render 由 T18 取代；本任务交付四面存续）
- **DependsOn**: 4

- **Consumes**: T4 canonical

- **Produces**: `renderHandoffStub(schema， mode， taskNum， opts)` 注入内容携带允许键集 / `type` / `enum` / 嵌套形状 / `allOf` 条件
- **Produces**: `validateHandoffSchema` 失败返回 `{ valid:false， reason， property? }`（`property` = 违规键名；`valid` / `reason` 键名与消费方不变）
- **Produces**: `normalizeHandoff(obj， schemaName)` 归一化单点（task / docs / branch 三个 runner 同源消费）
- **Produces**: 序列化单点（`JSON.stringify(obj， null， 2)` 全转义）

- **Files**: packages/cdd-engine/lib/templates.mjs, packages/cdd-engine/templates/task/fix.md, packages/cdd-engine/templates/review/review.md, packages/cdd-engine/templates/review/doc-fix.md, packages/cdd-engine/lib/handoff/schema.mjs, packages/cdd-engine/lib/handoff/finalize.mjs, packages/cdd-engine/lib/runner/run-task.mjs, packages/cdd-engine/lib/runner/run-docs.mjs, packages/cdd-engine/lib/cli/branch-review.mjs, packages/cdd-engine/lib/handoff/write.mjs, packages/cdd-engine/tests/handoff-stub.test.mjs

- **Steps**:
  1. 写失败测试（红）— stub 携带 schema 全形：创建 `packages/cdd-engine/tests/handoff-stub.test.mjs`——`renderHandoffStub` 携带 `commits` 嵌套形状与 `status` 枚举（`/^\s*commits:/m` + 缩进 `base:` + `not.toMatch(/^\s*head:/m)`——`commits.head` 是 H1 行引擎回读量、非本 schema 契约键，**不得**为让断言转绿而给 schema 补 head）；`allOf` 条件约束可见（cdd 形 enum 措辞 `when phase ∈ [review, branch-review]…` / docs 形 const 措辞 `when phase = review…` + `doc_path` + 反向 `not.toMatch(/commits|complexity|review_scope/)`——只测 cdd 形则 docs 面零守卫：`run-docs.mjs:64` 注入的正是 docs 形）；stub 不含 schema 未声明的键（反向断言防「全键罗列」）；注释行载体 = jsonc fence 之内 — checkable: handoff-stub.test.mjs 断言落盘且红（现 stub 只含 required 空键）
  2. 跑测试确认红：`pnpm --filter @oscaner-skills/cdd-engine test -- handoff-stub.test.mjs` — checkable: FAIL（现 stub 只含 `required` 空键）
  3. 重写 `renderHandoffStub` — 从 schema 派生：遍历 `schema.properties`（不只 `required`），按 `type` / `enum` / `properties` / `items` 递归生成带类型注释的骨架；`allOf` 每条条件分支渲染为固定措辞注释行（由 `allOf[i].if.properties` 与 `else.required` **求值生成**——**同时处理 enum 与 const 两形**：`enum` → `// when phase ∈ [v1, v2] → status may be omitted; otherwise status is required`，`const` → `// when phase = v → …`，只认 enum 会让 docs 形得到 undefined）；输出 fence 由 json → **jsonc**、注释行渲染在 fence 之内（位置即断言面）；三份模板的 `HANDOFF_STUB` 段补固定措辞 `The stub above is JSONC — the // lines are illustrative; write valid JSON without comments to the HANDOFF target.` — checkable: handoff-stub.test.mjs 红转绿（全形派生 + jsonc 载体）
  4. 校验报错携带违规键名：`lib/handoff/schema.mjs` 的 ajv 错误 `params.additionalProperty` 与 `instancePath` 拼入 `reason`，并把违规键名落到新增的 `property` 键上（返回形态仍是 `{ valid, reason }` + 新增 `property`，**不改名**——三个 lib 消费方与四个测试全部按 `.valid` 判定） — checkable: `validateHandoffSchema({…review_notes…})` 返回 `{ valid: false, property: "review_notes" }` 且 `reason` 含违规键名；通过时 `{ valid: true }`
  5. 校验失败 → 归一化重校验（保留 findings）— 三个 runner 同一单点：`lib/handoff/schema.mjs` 新增 `normalizeHandoff(obj, schemaName)`（剥除 `additionalProperties` 违规键、`blocker: null` → 省略、按 mode 补 status（复用 `rollupStatus`）；最多一轮，不循环）；`run-task.mjs:411-508`、`run-docs.mjs:21-32`（`writeBlocked`，被不可解析 `:96-100` 与 schema 无效 `:103-107` 两处调用）、`cli/branch-review.mjs:19-25`（`writeBranchBlocked` 增 `findings` 入参，默认 `[]`；`:107`/`:115` 无解析 findings 的两处保持 `[]`）——失败分支**一律不再**整份改写为 `status: BLOCKED, findings: []`，归一化后仍失败才写 BLOCKED 且**保留已解析出的原 findings** — checkable: task / docs / branch 三路径归一化重校验 + 保留 findings（`CONTRACT_VIOLATION` 类目级恢复策略非仅 task 派发）
  6. 序列化单点 + 模板散文去重：`lib/handoff/write.mjs` 统一以 `JSON.stringify(obj, null, 2)` 落盘（全转义）；三份模板删除与 schema 重复的规则句（**注意区分**：Step 3 新增的 `The stub above is JSONC — …` 一句是载体指令，不是与 schema 重复的规则句，**不得**在去重中删掉） — checkable: 序列化单点落位；模板散文去重完成且载体指令保留
  7. 跑测试 + engine 套件：`pnpm --filter @oscaner-skills/cdd-engine test` — checkable: 全绿
  8. Commit：`git add packages/cdd-engine`；`git commit -m "feat(cdd-engine): 输出契约单源 — stub 由 schema 全形派生 + 校验失败保留 findings + 报错含违规键名"` — checkable: T5 变更面单提交落盘（conventional）

- **Acceptance**:
  - handoff-stub.test.mjs 断言落盘且红（现 stub 只含 required 空键）
  - FAIL（现 stub 只含 `required` 空键）
  - handoff-stub.test.mjs 红转绿（全形派生 + jsonc 载体）
  - `validateHandoffSchema({…review_notes…})` 返回 `{ valid: false, property: "review_notes" }` 且 `reason` 含违规键名；通过时 `{ valid: true }`
  - task / docs / branch 三路径归一化重校验 + 保留 findings（`CONTRACT_VIOLATION` 类目级恢复策略非仅 task 派发）
  - 序列化单点落位；模板散文去重完成且载体指令保留
  - 全绿
  - T5 变更面单提交落盘（conventional）

### Task 6: 失败类目 canonical + 六类化 + 配额隔离 + 超时判定自持

- **Objective**: 失败类目 canonical + 六类化 + 配额隔离 + 超时判定自持（`failure-categories.json` + `lib/failure.mjs` 承重 + 孤立计数器 + 自持计时）
- **DependsOn**: 5

- **Consumes**: T5 的 `validateHandoffSchema` 失败形态（`{ valid: false， reason， property }`）

- **Produces**: `failure-categories.json` = `{ categories: [{ id， countsTowardStopping: false， counter， terminal }] }`（六条）
- **Produces**: `lib/failure.mjs` 导出 `FAILURE_CATEGORIES` / `counterFor` / `terminalFor` / `isIncompleteDispatch` / `counters()`（engine 内零手写类目字符串）
- **Produces**: 超时判定自持（`spawnManaged` 除 `res.timedOut` 外自持计时 + exit 143/SIGTERM 判定）

- **Files**: packages/cdd-engine/templates/failure-categories.json, packages/cdd-engine/lib/failure.mjs, packages/cdd-engine/templates/schema/cdd-handoff-schema.json, packages/cdd-engine/templates/schema/docs-handoff-schema.json, packages/cdd-engine/lib/cli/shared.mjs, packages/cdd-engine/lib/lifecycle/proc.mjs, packages/cdd-engine/lib/lifecycle/cli.mjs, packages/cdd-engine/lib/runner/run-task.mjs, packages/cdd-engine/lib/state/progress.mjs, packages/cdd-engine/tests/failure-categories.test.mjs, packages/cdd-engine/tests/progress.test.mjs

- **Steps**:
  1. 写失败测试（红）— 超时不再消耗 recovery；六类计数器独立：创建 `packages/cdd-engine/tests/failure-categories.test.mjs`——六类齐备且仅 `EXECUTION_FAILURE` 消耗 `engineRecoveryCount`（`CAT.categories.filter(c => c.counter === "engineRecoveryCount").map(c => c.id)` = `["EXECUTION_FAILURE"]`）；六类均不计入 Review Stopping（`every(c => c.countsTowardStopping === false)`） — checkable: failure-categories.test.mjs 两断言落盘且红（canonical 不存在）
  2. 跑测试确认红：`pnpm --filter @oscaner-skills/cdd-engine test -- failure-categories.test.mjs` — checkable: FAIL（canonical 不存在——读取即红）
  3. 写 canonical + `lib/failure.mjs` 承重读取：`templates/failure-categories.json` 按目标类目表逐行落盘（六条，含 `counter` / `terminal` / `countsTowardStopping: false`；`ENGINE_SELF_WRITTEN` / `CONTRACT_VIOLATION` 补 `dispatchIncomplete: true`；`counter` 非空的四条另带 `h1Label`——`timeout` / `contract-violation` / `engine-self-written` / `recovery`，这是 T7 `h1CountersLine` 零手写标签的前提）；`lib/failure.mjs` 读 canonical 构造（`FAILURE_CATEGORIES` / `counterFor` / `terminalFor` / `isIncompleteDispatch` / `counters()`） — checkable: failure-categories.test.mjs 红转绿；`lib/failure.mjs` 六类名零字面量（唯一声明点 = canonical）
  4. 超时判定自持：`lib/lifecycle/proc.mjs#spawnManaged`——spawn 时记录起点，返回时若 `Date.now() - start >= timeoutMs - ε` **或** `res.code === 143` / `res.signal === "SIGTERM"` 一律置 `timedOut: true`；删除 `res.timedOut` 作为唯一来源 — checkable: 超时判定自持（零 `res.timedOut` 单点依赖）
  5. 六类分派 + 计数器隔离：`run-task.mjs` 失败分支按类目写入对应计数器（`incrementRecovery` **只**在 `EXECUTION_FAILURE` 调用）；`state/progress.mjs` 增 `contractViolationCount` / `engineSelfWrittenCount` 两字段（初值 0）+ `migrateIfNeeded` 对存量四键补齐两键并**仅在确有补齐时回写**；**同步三处**：① `tests/progress.test.mjs:32-35` 精确键集断言改六键词法序（`contractViolationCount` / `engineRecoveryCount` / `engineSelfWrittenCount` / `plan` / `tasks` / `timeoutCount`）② `PROGRESS_SCHEMA` 死常量整块删除（`:9-12`，全仓零消费方——留着它只会把「同步加两键」变成无可观察差异的指令）③ 补齐的可区分断言：写不含两键的存量 progress.json（四键旧形）→ `migrateIfNeeded` → 返回对象含两键且值为 0 **且**磁盘已回写为六键形（只断内存不断回写会让「补齐未落盘」蒙对） — checkable: progress.test 六键词法序断言绿；`PROGRESS_SCHEMA` 零存在；补齐 + 回写断言绿
  6. `failure_category` 入 schema + Stopping 排除：两份 schema（`templates/schema/cdd-handoff-schema.json` / `docs-handoff-schema.json`）的 `properties` 各增 `"failure_category": { "enum": ["TIMEOUT","CONTRACT_VIOLATION","ENGINE_SELF_WRITTEN","EXECUTION_FAILURE","UNVERIFIABLE","PLAN_CONFLICT"] }`（`additionalProperties: false` 下不入 schema 会被自身校验拒绝）；`cli/shared.mjs#reviewStoppingGuard` 增未完成-dispatch 排除——`const incomplete = isIncompleteDispatch(prev?.failure_category); if (!incomplete && prev && prev.status === "APPROVED" && blockerCount(prev) === 0) stoppedExit3(...)`（**判定经 `lib/failure.mjs#isIncompleteDispatch`，不手写类目名**）；**补 engine 测试（AC7 唯一控制流修法，落点 = `tests/failure-categories.test.mjs` 的追加组 `describe("reviewStoppingGuard — 未完成 dispatch 排除")`）**——三例必须可区分：`ENGINE_SELF_WRITTEN` 同形 → 不 exit 3；`CONTRACT_VIOLATION` 同形 → 不 exit 3；**对照组** `EXECUTION_FAILURE` 同形 → 仍 exit 3（无此例则「排除」退化为「凡带 failure_category 即不 exit 3」恒真断言）；**§2.8 properties 计数口径（消除两读，与 T8 逐字同源）**：`counters` 四取值名在两份 schema 的 `properties` 内零命中 + 除 `failure_category` 外 properties 计数不变（`cdd-handoff-schema.json` = **14**、`docs-handoff-schema.json` = **9**） ——T8 落守卫时按此两条实现，不得按 §2.8 字面写「13 / 8」（与 `failure_category` 入 schema 互斥） — checkable: reviewStoppingGuard 三例可区分断言绿；`failure_category` 入两份 schema；properties 计数 14/9 + counters 零命中口径与 T8 同源
  7. 跑测试 + 全量：`pnpm --filter @oscaner-skills/cdd-engine test && pnpm run validate` — checkable: 全绿
  8. Commit：`git add packages/cdd-engine`；`git commit -m "feat(cdd-engine): 失败六类化 + 配额隔离 + 超时判定自持 + failure_category 入 schema（timeout 90/60 分钟）"` — checkable: T6 变更面单提交落盘（conventional）

- **Acceptance**:
  - failure-categories.test.mjs 两断言落盘且红（canonical 不存在）
  - FAIL（canonical 不存在——读取即红）
  - failure-categories.test.mjs 红转绿；`lib/failure.mjs` 六类名零字面量（唯一声明点 = canonical）
  - 超时判定自持（零 `res.timedOut` 单点依赖）
  - progress.test 六键词法序断言绿；`PROGRESS_SCHEMA` 零存在；补齐 + 回写断言绿
  - reviewStoppingGuard 三例可区分断言绿；`failure_category` 入两份 schema；properties 计数 14/9 + counters 零命中口径与 T8 同源
  - 全绿
  - T6 变更面单提交落盘（conventional）

### Task 7: `progress.json#plan` 透传 + `counters` 输出行

- **Objective**: `progress.json#plan` 透传 + `counters` 输出行（plan 恒等于 `--plan` 入参 + H1 块新增 counters 第 5 行）
- **DependsOn**: 6

- **Consumes**: T6 的计数器字段

- **Produces**: `progress.json#plan` 恒等于 `--plan` 入参（绝对路径）
- **Produces**: H1 块新增 `counters: timeout=<n> contract-violation=<n> engine-self-written=<n> recovery=<n>`——三个 H1 生产者同源于 `lib/state/progress.mjs#h1CountersLine(workspace)`（唯一构造点）：`h1FourLines` / `h1FromHandoff` / `branch-review.mjs:76` 的 dry-run 块
- **Produces**: std stdout（`noExit:false`）与 `res.h1`（`noExit:true`）两侧同为 5 行

- **Files**: packages/cdd-engine/lib/state/progress.mjs, packages/cdd-engine/lib/runner/run-task.mjs, packages/cdd-engine/lib/failure.mjs, packages/cdd-engine/lib/cli/branch-review.mjs, packages/cdd-engine/tests/progress-owner.test.mjs, packages/cdd-engine/tests/runner.test.mjs, packages/cdd-engine/tests/task.test.mjs, scripts/validate/smoke-cdd.mjs

- **Steps**:
  1. 写失败测试（红）：追加到 `tests/progress-owner.test.mjs`——`gitInit` mkdtemp 真仓 + 真 plan 文件 + `runTask("claude", 1, { mode: "implement", dryRun: true, planFile, root: repo, noExit: true })` → 读 `<repo>/.osuperpowers/cdd/x/progress.json` 断言 `p.plan` = `path.join(repo, planRel)`（**导入不得重复声明**——本文件顶部已有 node:fs/tmpdir import，本步只把 `mkdirSync` 并入既有具名导入，新增 `gitInit` 除外；`noExit` 属 T3 options 集成员，本条只使用其中 mode/dryRun/planFile/root/noExit 五键） — checkable: 新用例落盘且红（现 `plan` 恒为 `""`）
  2. 跑测试确认红：`pnpm --filter @oscaner-skills/cdd-engine test -- progress-owner.test.mjs` — checkable: FAIL（现 `plan` 恒为 `""` 不匹配断言）
  3. 透传 plan：`progress.mjs` `readProgressJSON(progressDir, plan)` → 迁移分支透传 `migrateIfNeeded(progressDir, plan)` → `createEmptyProgress(plan || "")`（`plan` 为可选第二参——既有单参消费方语义不变）；`run-task.mjs:352`（workspace 解析后的初始化点）改 `readProgressJSON(progressDir, plan)`（传已解析的绝对 plan——T3 `resolveDocArg` 出口值）；`:440`（timeout 分支）与 `:582`（review 成功路径）**保持单参**（workspace 与 progress.json 均已建立，plan 不再参与派生）+ 代码注释写明该判断 — checkable: progress-owner 新用例红转绿（`progress.json#plan` = `--plan` 入参）
  4. `counters` 输出行（三个 H1 生产者 + 「恰四行」断言同步）：`lib/state/progress.mjs` 新增 `h1CountersLine(workspace)`——读 `<workspace>/progress.json` 四字段（文件缺失 / 损坏 / 键缺失一律按 `0` 兜底不抛），按 canonical 序渲染整行，字段名与 H1 标签一律经 `lib/failure.mjs#counters()` 取自 canonical（**零手写计数器名 / 零手写标签**）；三个 H1 生产者各在末尾追加该行（`h1FourLines(raw, workspace)` / `h1FromHandoff(handoffPath, workspace)`——八个调用点逐点补第二参 / **`lib/cli/branch-review.mjs:76` 的 `DRY_RUN()` 块**——现硬编码四行直接 `process.stdout.write`，改由数组拼接并追加 `h1CountersLine(workspace)`；`finish(exitCode, h1, …)` **只是打印**，不是追加点）；**「恰四行」与位置断言改法**：stdout 侧 `toBe(4)` → `toBe(5)` + 可区分形态（`lines.filter(l => /^(status|commits|artifacts|blocker|counters):/.test(l)).length` = 5 且第 5 行 `/^counters: timeout=\d+ contract-violation=\d+ engine-self-written=\d+ recovery=\d+$/`；**禁止** `toBeGreaterThanOrEqual(4)` 恒真断言）；`res.h1` 侧 `:115`/`:1036` `toBe(5)` + `res.h1[4]` 逐键断言；`runner.test.mjs:805` 的 `res.h1.at(-1)` 恒为 counters 行 → 改 `at(-2)` 匹配 `^blocker:` + `at(-1)` 匹配 `^counters: `；口径载体同步（用例名与文件头注释的 `4-line` → `5-line`）；**`scripts/validate/smoke-cdd.mjs`**——`:5` 头注释补 `counters`、`:62-64` 的 Authoritative emitters 注释改真实三个落点 + 注明 `h1CountersLine` 派生、`:69` 报错文案 5 行口径、**新增第 5 条 counters presence 断言**（`&& /^counters: timeout=\d+ …$/m.test(lastBlock)`——第 4 条命令即 `cdd review --type branch --dry-run`，是第三个生产者的唯一自动化覆盖点；不得顺手改既有四条、不加行数断言） — checkable: 三 H1 生产者均 5 行 + 位置/逐键断言绿；smoke 第 5 条 counters presence 断言绿
  5. 跑测试 + Commit：`pnpm --filter @oscaner-skills/cdd-engine test`；`git add packages/cdd-engine scripts/validate/smoke-cdd.mjs`；`git commit -m "fix(cdd-engine): progress.json#plan 透传 + 派发输出 counters 行"` — checkable: engine 套件全绿；T7 变更面单提交落盘（conventional）

- **Acceptance**:
  - 新用例落盘且红（现 `plan` 恒为 `""`）
  - FAIL（现 `plan` 恒为 `""` 不匹配断言）
  - progress-owner 新用例红转绿（`progress.json#plan` = `--plan` 入参）
  - 三 H1 生产者均 5 行 + 位置/逐键断言绿；smoke 第 5 条 counters presence 断言绿
  - engine 套件全绿；T7 变更面单提交落盘（conventional）

### Task 8: 守卫块（单一 validate 块）— design §2.8 全 21 行落点（本任务落 12 条 engine 侧，其余 9 行显式指派他任务）

- **Objective**: 守卫块（单一 validate 块）— design §2.8 全 21 行落点（`collectChannelAuditHits()` 本任务落 12 条 engine 侧，其余 9 行显式指派）
- **DependsOn**: 7

- **Consumes**: T1–T7 的全部形态

- **Produces**: `collectChannelAuditHits()` 的 **12 条 engine 侧断言**——编号与 design §2.8 行号一一对应（① `process.cwd()` 计数 = 1 且唯一命中 `lib/root.mjs` ② env 取值直读 ⊆ canonical 白名单 ③ 整表透传点 ⊆ 清单 + 零 spread + 六键零命中 ④ 路径类实参全部经 `resolveDocArg`（read point 7 处）⑤ 全仓零 `rootFromDocPath` / `resolveRepoRoot`（含 tests 与 scripts）⑥ 测试零旁路缝（`filteredEnv`/`baseEnv`/`__\w*ForTest`）⑦ 零手写 handoff 字面量 / 零 `res.timedOut` 单点 ⑧ 零「写 context 到任意路径」⑨ usage flag ⊆ canonical argv ⑩ context.mjs 内 canonical 键名零硬编码 ⑪ 零残留回读 ⑫ counters 行由 canonical 派生 + 六类名零手写 + counters 不进 handoff 契约）

- **Files**: scripts/validate/residue.mjs, scripts/validate/residue.test.mjs, scripts/validate/index.mjs, packages/osuperpowers/tests/ci-validate.test.mjs

- **Steps**:
  1. 写失败单测（红）：注入临时目录构造各违规形态，逐条断言命中——③ 的 spread 形与六个键名（含注释行形）、④ 的未过 resolver 读取点、⑥ 的三类补丁模式（含 lib 侧 `__\w*ForTest`）、⑦ 的裸对象字面量与 `res.timedOut`、⑩ 的硬编码键名、⑪ 的残留回读；同时给反射例（`cdd-handoff-schema.json` / `docs-handoff-schema.json` 文件名、`docs/osuperpowers/{specs,plans}` 历史文档面不命中） — checkable: 单测落盘且红（`collectChannelAuditHits` 未实现）
  2. 实现 `collectChannelAuditHits()`：与 `collectStaleLexiconHits` 同构（`scanTargets` 复用）；**12 条各一独立收集函数** + 一条 live-repo 零残留断言（行 14 的 `(?<!-)handoff-schema` **不在本组**——归 T11，见 Interfaces） — checkable: `collectChannelAuditHits` 实现 12 条收集函数
  3. 跑 live-repo 断言：`expect(collectChannelAuditHits()).toEqual([])` — checkable: live-repo 零残留（若红 → 回补 T1–T7 相应面）
  4. 跑 `pnpm run validate`（含 5c `collectStaleLexiconHits` 零残留） — checkable: 13 块全绿
  5. Commit：`git add scripts/validate/residue.mjs scripts/validate/residue.test.mjs scripts/validate/index.mjs packages/osuperpowers/tests/ci-validate.test.mjs`；`git commit -m "chore(validate): 守卫块 §2.8 全行落点（单根权威 / env 白名单 / 零形状推断 / 零落盘 / 输出契约）"` — checkable: T8 变更面单提交落盘（conventional）

- **Acceptance**:
  - 单测落盘且红（`collectChannelAuditHits` 未实现）
  - `collectChannelAuditHits` 实现 12 条收集函数
  - live-repo 零残留（若红 → 回补 T1–T7 相应面）
  - 13 块全绿
  - T8 变更面单提交落盘（conventional）

### Task 9: `finding-meta.json` 枚举单源 + 渲染器注入 + 取值同步

- **Objective**: `finding-meta.json` 枚举单源 + 渲染器注入 + 取值同步（枚举只留顶层 + `renderYml(formDef, enums)` 注入）
- **DependsOn**: 8

- **Consumes**: 无（可与段 ① 并行，但排在段 ① 后以保持 engine-first 序）

- **Produces**: `renderYml(formDef， enums)`；`finding-meta.json` 的 form 定义内零 `options` 数组；新测试的「同一 canonical 枚举输入 → 同字节」（§2.6.1 渲染器侧 round-trip）

- **Files**: packages/osuperpowers/skills/report-issue/templates/finding-meta.json, packages/osuperpowers/scripts/report-templates.mjs, scripts/emit/issue-templates.mjs, scripts/emit/issue-templates.test.mjs, .github/ISSUE_TEMPLATE/*.yml, packages/osuperpowers/tests/report-templates.test.mjs

- **Steps**:
  1. 写失败测试（红）：新建 `packages/osuperpowers/tests/report-templates.test.mjs`（node:test，**落 5b 面**——`packages/osuperpowers/scripts/**` 不在任何测试收集面内，放那里永不执行，写失败测试也拿不到红/绿信号）：`renderYml` 收 `enums` 注入；同一枚举输入 → 同字节。跑 `node --test packages/osuperpowers/tests/report-templates.test.mjs` 确认红（当前 `renderYml` 不收 `enums`） — checkable: 新测试落盘（5b 面）且红（renderYml 不收 enums）
  2. 收敛 canonical：顶层 `components` 为唯一来源；`report-issue` 保留旧名（P5 改） — checkable: finding-meta 顶层单源（form 定义内零 options 数组）
  3. 渲染器注入：`renderYml` 对 `type === "dropdown" && (id === "component" || id === "session-type")` 用 canonical 枚举填充 — checkable: renderYml 注入面落位
  4. `pnpm run emit` + `emit:check` + 步骤 1 转绿；`node --test packages/osuperpowers/tests/report-templates.test.mjs` — checkable: 红→绿两侧都有信号（同一 canonical 枚举输入 → 同字节）；emit 无 drift
  5. Commit：`git add packages/osuperpowers scripts/emit .github/ISSUE_TEMPLATE`；`git commit -m "refactor(osuperpowers): finding-meta 枚举单源（三写→一写）+ 渲染器注入 + 取值同步"` — checkable: T9 变更面单提交落盘（conventional）

- **Acceptance**:
  - 新测试落盘（5b 面）且红（renderYml 不收 enums）
  - finding-meta 顶层单源（form 定义内零 options 数组）
  - renderYml 注入面落位
  - 红→绿两侧都有信号（同一 canonical 枚举输入 → 同字节）；emit 无 drift
  - T9 变更面单提交落盘（conventional）

### Task 10: `init` 删除 + 版本戳机制删除 + 反向守卫

- **Objective**: `init` 删除 + 版本戳机制删除 + 反向守卫（`skills/init/` 删除 + `osuperpowers-version` 戳删除 + shipped 面零版本字面量 / 零 `/init` 引用）
- **DependsOn**: 9

- **Consumes**: 无

- **Produces**: `skills/init/` 不存在；`osuperpowers-version` 戳机制不存在；shipped 面 + 协作者面零 `/init` 引用；shipped 非 emit 面零版本字面量；`validate` 5b skills-count 预期值 = **5**

- **Files**: packages/osuperpowers/skills/init/, scripts/release/version-packages.mjs, scripts/validate/version-sync.mjs, scripts/validate/osuperpowers.mjs, .changeset/README.md, README.md, packages/osuperpowers/README.md, scripts/validate/residue.mjs

- **Steps**:
  1. 写失败测试（红）：`version-sync` 不再读 init；`residue` 断言 shipped 面零版本字面量 + shipped/协作者面零 `/init` 引用（§2.8 行 19/20） — checkable: 新断言落盘且红
  2. 删 init 目录 + stamp 写读两处：`git rm -r packages/osuperpowers/skills/init`；`version-packages.mjs:122-139` 删 stamp 循环；`version-sync.mjs:67-79` 删 init stamp 块 — checkable: `skills/init/` 不存在；stamp 读写两处删除
  3. README / `.changeset/README.md` 同步：`.changeset/README.md:24`；`README.md:63`、`packages/osuperpowers/README.md:20,34` 的 `/init` 引用改为 marketplace 安装指引 + engine 检查 — checkable: 三件文档零 `/init` 引用
  4. `pnpm run emit`（`.agents/skills/osuperpowers/init/` 自动 prune） — checkable: emit 产出零 init；emit:check 无 drift
  5. `scripts/validate/osuperpowers.mjs:46` `EXPECTED = 5`（与 Step 2 同 commit；否则 5b 块红——计数耦合前移拆分：T10 改 5、T12 改 8） — checkable: EXPECTED = 5（5b 块绿）
  6. 跑 `pnpm run validate` + `pnpm run version --dry-run` — checkable: validate 全绿；version --dry-run 正常
  7. Commit：`git add packages/osuperpowers scripts/validate scripts/release .changeset/README.md README.md`；`git commit -m "refactor(osuperpowers): init 删除 + 版本戳机制删除 + 反向守卫"` — checkable: T10 变更面单提交落盘（conventional）

- **Acceptance**:
  - 新断言落盘且红
  - `skills/init/` 不存在；stamp 读写两处删除
  - 三件文档零 `/init` 引用
  - emit 产出零 init；emit:check 无 drift
  - EXPECTED = 5（5b 块绿）
  - validate 全绿；version --dry-run 正常
  - T10 变更面单提交落盘（conventional）

### Task 11: `handoff-schema.md` 删除 + 连带引用（行 14 守卫同 commit；行 21 守卫归 T15）

- **Objective**: `handoff-schema.md` 删除 + 连带引用（`(?<!-)handoff-schema` 零命中守卫同 commit）
- **DependsOn**: 10

- **Consumes**: 无

- **Produces**: 零 `handoff-schema.md`；**`(?<!-)handoff-schema` 零命中**（覆盖裸名形与路径形；负向后顾豁免 `cdd-handoff-schema.json` / `docs-handoff-schema.json`）；**行 14 归属**——`(?<!-)handoff-schema` 零命中由本任务唯一承接（T8 已删去原 ⑬ 按 12 条实现）

- **Files**: packages/osuperpowers/skills/cli-driven-development/docs/handoff-schema.md, packages/cdd-engine/lib/handoff/write.mjs, packages/cdd-engine/lib/handoff/finalize.mjs, packages/cdd-engine/tests/contract.test.mjs, docs/maintainers/osuperpowers-plugin.md, scripts/validate/residue.mjs, scripts/validate/residue.test.mjs

- **Steps**:
  1. 写失败测试（红）：`residue.test.mjs` 的 `(?<!-)handoff-schema` 正例 / 反射例单测（裸名形与路径形命中、`cdd-handoff-schema.json` / `docs-handoff-schema.json` 不命中）**。不写** `task-review` 守卫的单测——该守卫新形态归 T15 Step 4b — checkable: 单测落盘且红（守卫未实现）
  2. 删文件 + 四处引用改指：`git rm packages/osuperpowers/skills/cli-driven-development/docs/handoff-schema.md`；`write.mjs:2,22` / `finalize.mjs:53` / `contract.test.mjs:10` 引用注释改指 engine canonical；`docs/maintainers/osuperpowers-plugin.md:173` 死路径 → `packages/cdd-engine/templates/schema/docs-handoff-schema.json` — checkable: `handoff-schema.md` 删除；四处引用改指（`.agents/` 副本由 emit prune）
  3. `(?<!-)handoff-schema` 新条目（design §2.8 行 14；该条目由本任务唯一承接，删除动作与守卫同 commit）——scope 含 `packages/cdd-engine/{bin,lib,tests}` 与 `packages/osuperpowers` — checkable: 守卫条目落位；`(?<!-)handoff-schema` 命中 / 豁免反射例绿
  4. `pnpm run emit` + 定向校验（**不跑 `pnpm run validate`**）：`grep -rnP '(?<!-)handoff-schema' packages/cdd-engine/bin packages/cdd-engine/lib packages/cdd-engine/tests packages/osuperpowers --include='*.mjs' --include='*.md' --include='*.json'` 期望 0；`pnpm --filter @oscaner-skills/cdd-engine test -- contract.test.mjs` 全绿。**此处刻意不跑全量 validate**——本任务时点 validate 的红绿与本任务无关（行 21 守卫尚未扩容归 T15、skills 面守卫归 T16、行 19/20 归 T10），全量绿由 T14/T15/T16 各自承接 — checkable: 定向 grep = 0；`contract.test.mjs` 全绿（刻意不跑全量 validate——判据在本任务内不可达）
  5. Commit：`git add packages/osuperpowers packages/cdd-engine docs/maintainers scripts/validate`；`git commit -m "refactor(osuperpowers): handoff-schema.md 删除 + 引用改指 engine canonical（行 14 守卫同 commit）"` — checkable: T11 变更面单提交落盘（conventional）

- **Acceptance**:
  - 单测落盘且红（守卫未实现）
  - `handoff-schema.md` 删除；四处引用改指（`.agents/` 副本由 emit prune）
  - 守卫条目落位；`(?<!-)handoff-schema` 命中 / 豁免反射例绿
  - 定向 grep = 0；`contract.test.mjs` 全绿（刻意不跑全量 validate——判据在本任务内不可达）
  - T11 变更面单提交落盘（conventional）

### Task 12: 新树骨架 — 3 个 spec-writer 新建 + 模板迁移

- **Objective**: 新树骨架 — 3 个 spec-writer（writing-single-spec / writing-overall-spec / writing-phase-spec）新建 + 模板就近迁移
- **DependsOn**: 11

- **Consumes**: design §2.7.1 / §2.7.2 的骨架与四项差异表

- **Produces**: 三 skill 的共享骨架 digraph（`run-writing-spec-session` → `read-template` → `B2{scope changed?}` →（phase 变体：`sync-overall`）→ `author-spec` → `spec-review` / `fix-spec` 循环 → `commit-spec` → `handoff-spec`）+ 各 `## Invariants` 含 Review Stopping 一行
- **Produces**: 三 skill 的 Review Stopping 行本体在本任务落（T15 只补 `writing-plans` 与 `cli-driven-development` 两处）

- **Files**: packages/osuperpowers/skills/writing-single-spec/SKILL.md, packages/osuperpowers/skills/writing-overall-spec/SKILL.md, packages/osuperpowers/skills/writing-overall-spec/docs/overall-spec-template.md, packages/osuperpowers/skills/writing-overall-spec/docs/add-phase-protocol.md, packages/osuperpowers/skills/writing-phase-spec/SKILL.md, packages/osuperpowers/skills/writing-phase-spec/docs/phase-spec-template.md, packages/osuperpowers/skills/brainstorming/SKILL.md, scripts/validate/osuperpowers.mjs

- **Steps**:
  1. 写 `writing-single-spec/SKILL.md`（骨架 + single 差异列；**每个非决策、非终态 mermaid 节点立一个 `### \`<mermaid label>\`` 小节（Do / Read / Exit / Fail 四要素）**；N/A 记在 `## Skeleton deltas` 差异表内（`read-template: N/A` / `scope changed?: N/A` / `sync-overall: N/A`），**不为 N/A 立 `###` 小节**（`digraph-consistency.test.mjs` 的 section-alignment 断言会把无图节点的小节判为 orphan）；`handoff-spec` 物化为 `handoff-writing-plans`） — checkable: SKILL.md 含骨架 digraph + 节点小节四要素 + 差异表 N/A + Invariants ≤5（含 Review Stopping 一行）
  2. 写 `writing-overall-spec/SKILL.md`（同载体口径）+ `git mv packages/osuperpowers/skills/brainstorming/docs/{overall-spec-template.md,add-phase-protocol.md}` → 该 skill 的 `docs/` — checkable: SKILL.md + 两模板迁移；同载体口径
  3. 写 `writing-phase-spec/SKILL.md`（同载体口径 + `B2{scope changed?}` 位于 `read-template` 与 `author-spec` 之间 + `sync-overall` 节点）+ `git mv …/brainstorming/docs/phase-spec-template.md` → 该 skill 的 `docs/` — checkable: SKILL.md + 模板迁移；`B2`/`sync-overall` 图位正确（overall v1.4 定序）
  4. `brainstorming/SKILL.md` 去模板引用（模板已迁走） — checkable: brainstorming 零模板引用
  5. `scripts/validate/osuperpowers.mjs:46` `EXPECTED = 8`（与 Step 1–3 同 commit；否则 5b skills-count 块红） — checkable: EXPECTED = 8（5b 块绿）
  6. `pnpm run emit` + `node --test packages/osuperpowers/tests/digraph-consistency.test.mjs`（三新 skill 须过 §8 四清单） — checkable: emit 无 drift；digraph-consistency 全绿
  7. Commit：`git add packages/osuperpowers scripts/validate/osuperpowers.mjs`；`git commit -m "feat(osuperpowers): 新树骨架 — writing-{single,overall,phase}-spec + 模板就近迁移"` — checkable: T12 变更面单提交落盘（conventional）

- **Acceptance**:
  - SKILL.md 含骨架 digraph + 节点小节四要素 + 差异表 N/A + Invariants ≤5（含 Review Stopping 一行）
  - SKILL.md + 两模板迁移；同载体口径
  - SKILL.md + 模板迁移；`B2`/`sync-overall` 图位正确（overall v1.4 定序）
  - brainstorming 零模板引用
  - EXPECTED = 8（5b 块绿）
  - emit 无 drift；digraph-consistency 全绿
  - T12 变更面单提交落盘（conventional）

### Task 13: 委托型重写 — brainstorming / writing-plans / finishing

- **Objective**: 委托型重写 — brainstorming / writing-plans / finishing（模式感知门禁 + 节点定义小节 + Invariants 收敛）
- **DependsOn**: 12

- **Consumes**: T12 骨架形

- **Produces**: 三 skill 零上游文档 read；`brainstorming` 含**模式感知**门禁（`new-program` 直连 grilling，`phase-within-program` 才过 `phase-registered?`）与 I7 硬依赖 Fail 判据；`finishing` 保留 personal-rule 层（I1 No Worktrees / I2 Conventional Commits）

- **Files**: packages/osuperpowers/skills/brainstorming/SKILL.md, packages/osuperpowers/skills/writing-plans/SKILL.md, packages/osuperpowers/skills/finishing/SKILL.md, packages/osuperpowers/tests/writing-plans-spec.test.mjs

- **Steps**:
  1. 重写 `brainstorming`（目标 digraph：`run-brainstorming-session` → `explore-context` → `C{mode?}` →（`new-program` 直连 `run-grilling-session` / `phase-within-program` 过 `P{phase-registered?}`）→ `D{scope-size?}` → `run-writing-single-spec`/`run-writing-overall-spec`、`F{phase-size?}` → `run-writing-phase-spec`/`run-writing-overall-spec`；节点定义小节载体同一口径——须立小节者共 7 个（`run-brainstorming-session` / `explore-context` / `run-writing-overall-spec · sync` / `run-grilling-session` / `run-writing-single-spec` / `run-writing-overall-spec` / `run-writing-phase-spec`）；决策节点可有可无、终态不得立小节；两条 size 判据分开成两节点各写各的 Do/Exit；删除的 legacy 节点不复述；`## Invariants` 行集：I3 Design first + I4 Spec commit discipline——**Review Stopping 不在此 skill**（职责已迁入三个 spec-writer，T12 已落，本步不得追加该行） — checkable: brainstorming 重写落盘（模式感知 digraph + 7 小节 + Invariants 不含 Review Stopping 行）；digraph-consistency 绿
  2. 重写 `writing-plans`（`run-writing-plans-session` → `backfill-design` → plan review-fix 循环 → `commit-plan` → handoff；节点定义小节同载体；`## Invariants` = I2 Plan commit discipline——**Review Stopping 一行由 T15 Step 1 追加，本步不写**） — checkable: writing-plans 重写落盘（节点小节四要素 + 注释）
  3. 重写 `finishing`（`run-finishing-session` 收敛 `verify-tests`/`read-base`/`present-menu`/`merge-locally`/`push-and-pr`/`typed-discard?`/`force-delete` + `backfill-overall` + `close-issues`；节点定义小节同载体；Invariants 保留 **I1 No Worktrees** / **I2 Conventional Commits + No Attribution**） — checkable: finishing 重写落盘（节点小节 + personal-rule 层）
  4. `pnpm run emit` + `digraph-consistency` + `rule-reference.test`（此时仍应能跑；T16 删除） — checkable: emit 无 drift；digraph-consistency 绿；rule-reference 仍绿
  5. Commit：`git add packages/osuperpowers`；`git commit -m "refactor(osuperpowers): 委托型 skill 重写 — brainstorming / writing-plans / finishing"` — checkable: T13 变更面单提交落盘（conventional）

- **Acceptance**:
  - brainstorming 重写落盘（模式感知 digraph + 7 小节 + Invariants 不含 Review Stopping 行）；digraph-consistency 绿
  - writing-plans 重写落盘（节点小节四要素 + 注释）
  - finishing 重写落盘（节点小节 + personal-rule 层）
  - emit 无 drift；digraph-consistency 绿；rule-reference 仍绿
  - T13 变更面单提交落盘（conventional）

### Task 14: 原生型重写 — cli-driven-development + report-issue 形态精简

- **Objective**: 原生型重写 — cli-driven-development + report-issue 形态精简（digraph 与整体主干同形 + 零裸 mode 名 + Invariants 收敛 ≤5）
- **DependsOn**: 13

- **Consumes**: T7 的 `counters` 输出行、T6 的 `failure-categories.json` 类目集

- **Produces**: `cli-driven-development` digraph 与 overall 主干同形（`fix-task` / `branch-fix` 两条路径均经 `cdd fix`，**零 `fix-inline`**）；Read 字段零 `CDD_*` / `progress.json` / handoff 文件名；短 Failure Modes 表类目名 ⊆ canonical；`report-issue` Invariants 收敛至 ≤5
- **Produces**: 重写后 `cli-driven-development/SKILL.md` 内**零裸 `task-review`**（四个 mode 一律写 `implement` / `review` / `fix`，唯一允许含该子串的形态是新图节点名 `run-task-review`）

- **Files**: packages/osuperpowers/skills/cli-driven-development/SKILL.md, packages/osuperpowers/skills/report-issue/SKILL.md, packages/osuperpowers/skills/cli-driven-development/docs/base-branch.md

- **Steps**:
  1. 重写 `cli-driven-development` digraph + 节点定义（目标 digraph：`detect-engine` → `determine-base` → `set-base-branch` → `implement-task` → `run-task-review` → `{blocker=0?}` → `fix-task` → `{more-tasks?}` → `branch-review` → `{blocker=0?}` → `branch-fix` → `handoff-finishing`；须立小节者共 9 个；决策节点可有可无、终态 `Z0` 不得立小节；节点定义要点——`determine-base` 按 plan base 字段 → branch upstream → 对话上下文，无法抉择 AskUserQuestion；`run-task-review`/`fix-task`/`branch-fix` 的 cdd 命令形；`handoff-finishing` 确保 base-branch.json 就位） — checkable: cli-driven-development 重写落盘（digraph + 9 小节）+ 零裸 `task-review`（`/(?<!run-)task-review/` 豁免）
  2. Read 字段改写：从输出契约取 `status` / `artifacts`（绝对路径）/ `blocker` / `counters`；base branch 经 `cdd base-branch get`；零 `CDD_*` / `progress.json` / handoff 文件名 — checkable: Read 字段零引擎内部结构
  3. 短 Failure Modes 表（类目名 ⊆ canonical）+ Invariants ≤5：**表形 = 六行手写短表，首列即六个类目名**（逐行取 `failure-categories.json` 的 `categories[].id`；状态枚举值与终态名不进首列——落节点 Fail 字段或次列；**T16 守卫 4 ① 的扫面恰为该表首列**）；类目名集合 ⊆ canonical 六类、**不复述**类目语义（是否计入 Stopping / 计数器 / 恢复策略）；Invariants 含「三模式链完整性」（写 `review` 不写旧 mode 名 `task-review`）——**Review Stopping 一行由 T15 Step 1 追加，本步不写**（5 个承载者中三个 spec-writer 归 T12、本 skill 与 writing-plans 归 T15） — checkable: 短 Failure Modes 表首列 = 六类目名 ⊆ canonical；Invariants ≤5 不含 Review Stopping 行
  4. `report-issue` 形态精简（Invariants 6 → 5）：**降级 `I4` Never Reopen 为 `dedup` 节点的 Do/Exit 字段**（规则本体 `--state all` 全量查询 · 关闭态匹配绝不重开 · `related` = Regression/follow-up 已逐字写在 dedup Do 内，降级即消除重复陈述、规则本体零丢失），保留 `I1` / `I3` / `I5` / `I6` / `I7` 五条（**`I5` Renderer Determinism 必须保留在表内**——跨节点规则，降级丢一条跨节点约束）；**本步不动 report-issue 的 program-chain 读取**（`:70`/`:74` 的 `progress.json#plan`——AC5 已登记为设计内例外，去留归 P5） — checkable: report-issue Invariants = 保留集（I1/I3/I5/I6/I7，I4 降级进 dedup Do、I5 在）
  5. `pnpm run emit` + `digraph-consistency` + 零裸 mode 名 grep + `pnpm run validate`（`grep -rnP '(?<!run-)task-review' packages/osuperpowers/skills/cli-driven-development` 期望 0） — checkable: emit 无 drift；digraph-consistency 绿；零裸 mode 名 grep = 0；validate 13 块全绿（行 21 守卫尚未扩容、skills 面守卫尚未上线，本步的绿可达）
  6. Commit：`git add packages/osuperpowers`；`git commit -m "refactor(osuperpowers): 原生型 skill 重写 — cli-driven-development + report-issue 精简"` — checkable: T14 变更面单提交落盘（conventional）

- **Acceptance**:
  - cli-driven-development 重写落盘（digraph + 9 小节）+ 零裸 `task-review`（`/(?<!run-)task-review/` 豁免）
  - Read 字段零引擎内部结构
  - 短 Failure Modes 表首列 = 六类目名 ⊆ canonical；Invariants ≤5 不含 Review Stopping 行
  - report-issue Invariants = 保留集（I1/I3/I5/I6/I7，I4 降级进 dedup Do、I5 在）
  - emit 无 drift；digraph-consistency 绿；零裸 mode 名 grep = 0；validate 13 块全绿（行 21 守卫尚未扩容、skills 面守卫尚未上线，本步的绿可达）
  - T14 变更面单提交落盘（conventional）

### Task 15: `_docs/review.md` 删除 + Review Stopping 入 Invariants（+ 行 21 守卫同 commit）

- **Objective**: `_docs/review.md` 删除 + Review Stopping 入 Invariants（+ 行 21 old mode task-review 守卫扩容同 commit）
- **DependsOn**: 14

- **Consumes**: T14

- **Produces**: 零 `_docs/review.md` 引用（含 `#rule-review-stopping` 锚点形与裸提及）；`### Rule:` 标题数 = 0；Review Stopping 5 个承载者全部落行且各只一行；**`old mode task-review` 守卫为旧 mode 名形（`/(?<!run-)task-review/`）且 scope = `ALL_MECH_POSITIONS`**（design §2.8 行 21 的落点）

- **Files**: packages/osuperpowers/skills/_docs/review.md, packages/osuperpowers/skills/writing-plans/SKILL.md, packages/osuperpowers/skills/cli-driven-development/SKILL.md, packages/cdd-engine/lib/harness-registry.json, CLAUDE.md, docs/maintainers/osuperpowers-plugin.md, scripts/validate/residue.mjs, scripts/validate/residue.test.mjs

- **Steps**:
  1. 补 Review Stopping Invariant 行——**仅 `writing-plans` / `cli-driven-development` 两处**（三个 spec-writer 已由 T12 落；不重复写） — checkable: 两 skill Invariants 各含一行 Review Stopping；三个 spec-writer 无重复追加
  2. 删 skills 面链接与裸提及——**以字符串/正则断言驱动，不用行号清单**：`grep -rnE '_docs/review\.md|rule-review-stopping' packages/osuperpowers/skills` 计数 = 0（T13/T14 重写可能已自然消除部分，也可能带出新引用，一律以 grep 实测为准） — checkable: skills 面零 `_docs/review.md` / `rule-review-stopping` 命中
  3. engine 注入面 + 治理入口面清零（与 Step 2 同属一次动作）：`packages/cdd-engine/lib/harness-registry.json:12-13,29-30` 两个 harness 条目（claude / cursor-agent）的 `prefix.review.spec` / `prefix.review.plan` 四串去掉文件 cite（改为 `Follow URC: single-cycle, lens-tagged findings (completeness/consistency/clarity)` / `(completeness/decomposition/buildability)`——**保留 lens 措辞本体**，仅去掉文件 cite，不得改为指向不随包发布的 maintainer 文档）；`CLAUDE.md:56` 的 `_docs/review.md` 引用 → 指向各 skill 的 `## Invariants` 行；`docs/maintainers/osuperpowers-plugin.md` 承接 Handoff Output / round / `doc_hash` 技术契约 — checkable: engine 注入面四串零文件 cite；CLAUDE.md 零 `_docs/review.md`；maintainer doc 承接契约
  4. `git rm packages/osuperpowers/skills/_docs/review.md` + `pnpm run emit` — checkable: `_docs/review.md` 删除；emit prune 派生副本
  5. **行 21 的 `old mode task-review` 守卫扩容（与 Step 4 同 commit）**：`scripts/validate/residue.mjs:59` 的 `{ label: "old mode task-review", re: /task-review/, scope: CDD_ENGINE }` 改为 `re: /(?<!run-)task-review/`、`scope: ALL_MECH_POSITIONS`（同步该条上方注释）；**`ALL_MECH_POSITIONS` 不得就地改写**（被另外 6 条 check 共享）；`residue.test.mjs` 补正例（裸 `task-review`、`CDD_MODE = "task-review"` → 命中）与反射例（`run-task-review` → 不命中）；wiring 面只钉 scope 不钉正则（ci-validate 无需随迁）。**为何不在 T11**：该守卫 scope 扩至 `ALL_MECH_POSITIONS` 即扫 skills 面，该面内裸 `task-review` 分三批消失（handoff-schema.md 3 处 T11 删 → SKILL.md 16 处 T14 重写 → `_docs/review.md` 1 处本步删）——本步是最后一个命中面消失的位置，守卫与本步同 commit 才能让 validate 在该 commit 即绿 — checkable: 行 21 守卫取旧 mode 名形 + scope ALL_MECH_POSITIONS；正例/反射例绿；`pnpm run validate` 全绿（行 21 在该 commit 转绿）
  6. Commit：`git add packages/osuperpowers packages/cdd-engine CLAUDE.md docs/maintainers scripts/validate`；`git commit -m "refactor(osuperpowers): _docs/review.md 删除 + Review Stopping 入各 skill Invariants + task-review 守卫取旧 mode 名形（行 21）"` — checkable: T15 变更面单提交落盘（conventional）

- **Acceptance**:
  - 两 skill Invariants 各含一行 Review Stopping；三个 spec-writer 无重复追加
  - skills 面零 `_docs/review.md` / `rule-review-stopping` 命中
  - engine 注入面四串零文件 cite；CLAUDE.md 零 `_docs/review.md`；maintainer doc 承接契约
  - `_docs/review.md` 删除；emit prune 派生副本
  - 行 21 守卫取旧 mode 名形 + scope ALL_MECH_POSITIONS；正例/反射例绿；`pnpm run validate` 全绿（行 21 在该 commit 转绿）
  - T15 变更面单提交落盘（conventional）

### Task 16: `skill-authoring.md` 重写 + 治理测试同步 + skills 面守卫

- **Objective**: `skill-authoring.md` 重写 + 治理测试同步 + skills 面守卫（唯一执法点判据 + rule-reference 删除 + 五条 skills 面守卫）
- **DependsOn**: 15

- **Consumes**: T15（零 `### Rule:` 前提）

- **Produces**: 8 skill 全受 §8 四清单约束；`rule-reference.test.mjs` 与接线不存在；**skills 面守卫组 5 条上线**（§2.8 行 12/15/16/17/18——零上游 read · 零引擎内部结构（scope = AC5 7 个编排型 skill，`report-issue` 显式排除）· 零 fix-inline · 失败类目名 ⊆ canonical + 语义零复述 · 零 `_docs/` 引用）

- **Files**: docs/maintainers/skill-authoring.md, packages/osuperpowers/tests/rule-reference.test.mjs, scripts/validate/osuperpowers.mjs, packages/osuperpowers/tests/digraph-consistency.test.mjs, packages/osuperpowers/tests/ci-validate.test.mjs, packages/osuperpowers/tests/grep-sweep-regression.test.mjs, scripts/validate/residue.mjs, scripts/validate/residue.test.mjs

- **Steps**:
  1. 重写 `skill-authoring.md`（唯一执法点判据：机检部分只留一句 + 指向 `digraph-consistency.test.mjs`；文档承载 session-call 原语 + 委托型/原生型两类形态 + §6 BLOCKED 语义 + §10 反模式；**删 §7/§9**；§4 删「上限 5 + 依 spec 授权例外」的例外口子） — checkable: skill-authoring 重写落盘（唯一执法点 + session-call + 两类形态）
  2. rule-reference 的**三处接线同 commit 删除**：① `git rm packages/osuperpowers/tests/rule-reference.test.mjs`；② 删 `scripts/validate/osuperpowers.mjs:70-73` 的 `subprocessStep("5b. rule-reference.test.mjs …")` 接线（+ `:6-7` 头注释 suite 枚举去 rule-reference）；③ 删 `packages/osuperpowers/tests/ci-validate.test.mjs:85-92` 的 rule-reference 用例并**原位替换为反向断言**——`assert.ok(!steps.some((s) => s.name.includes("rule-reference")), "rule-reference step must be removed with the suite")` — checkable: `rule-reference.test.mjs` 不存在；三处接线删除（漏一处即 AC13 不可达）；反向断言绿
  3. `scripts/validate/osuperpowers.mjs:47`：`EMITTERS_LABEL` 去枚举（改纯计数标签）；`digraph-consistency.test.mjs:13-17` 删 `ent.name !== "init"` 豁免（**`EXPECTED` 的 6→5→8 已分别随 T10/T12 落地，本步不重复改**） — checkable: EMITTERS_LABEL 去枚举；digraph init 豁免删除
  4. 五条 skills 面守卫 + 单测（`collectSkillSurfaceHits()`，与 `collectChannelAuditHits` 同构）：① 零上游文档 read（skills 面 `/vendors\//`、`/\bsuperpowers\/.*SKILL\.md/`、`/Read[- ]Upstream/i`、`/\bread upstream\b/i` 零命中 + 上游引用一律 `/[/a-z-]+:[a-z-]+/` 斜杠形）② **零引擎内部结构依赖——scope 逐字 = AC5 的 7 个编排型 skill 显式数组**（`brainstorming` / `writing-single-spec` / `writing-overall-spec` / `writing-phase-spec` / `writing-plans` / `cli-driven-development` / `finishing`；**逐名列出不用 `skills/**` 通配**；`/\bCDD_[A-Z_]+\b/`、`/\bprogress\.json\b/`、handoff 文件名模式零命中；**`report-issue` 显式排除**——AC5 例外（program 通道首跳，归 P5），排除写法 = 目标集是 7 个文件路径的显式数组，不得用「扫描全部再减法」）③ 零 `fix-inline`（skills 面 `/fix-inline/` 零命中 + 每个评审循环节点须出现 `cdd fix` 命令形）④ 失败类目名与语义——**抽取面 = `cli-driven-development/SKILL.md` 的 `## Failure Modes` 短表数据行首列**（每行首列 `.trim()` → 候选集 ⊆ canonical 的 `categories[].id` ∪ handoff 状态枚举白名单 `APPROVED`/`BLOCKED`/`CHANGES_REQUESTED`/`TIMEOUT`）② **类目语义零复述**（`countsTowardStopping` / `counter` / `terminal` 关键词在 skills 面零命中）⑤ 零 `_docs/` 引用（skills 面 `/_docs\//`、`/_docs\/review\.md/`、`/rule-review-stopping/` 零命中；T15 一次性删除的常驻化）；新增测试落 `packages/osuperpowers/tests/`（5b node:test 面）+ live-repo 零残留 — checkable: `collectSkillSurfaceHits()` 五条守卫 + 正例/反射例单测全绿；live-repo 零残留
  5. `grep-sweep-regression.test.mjs`：删陈旧的 `cli-driven-development/docs/cdd-reference` 排除项（该文件已不存在） — checkable: 陈旧排除项删除
  6. `pnpm run emit` + `pnpm run validate`（13 块全绿）+ `emit:check` — checkable: emit 无 drift；validate 13 块 ALL PASS
  7. Commit：`git add docs/maintainers packages/osuperpowers scripts/validate`；`git commit -m "docs(osuperpowers): skill-authoring 按唯一执法点重写 + 治理测试同步 + skills 面守卫"` — checkable: T16 变更面单提交落盘（conventional）

- **Acceptance**:
  - skill-authoring 重写落盘（唯一执法点 + session-call + 两类形态）
  - `rule-reference.test.mjs` 不存在；三处接线删除（漏一处即 AC13 不可达）；反向断言绿
  - EMITTERS_LABEL 去枚举；digraph init 豁免删除
  - `collectSkillSurfaceHits()` 五条守卫 + 正例/反射例单测全绿；live-repo 零残留
  - 陈旧排除项删除
  - emit 无 drift；validate 13 块 ALL PASS
  - T16 变更面单提交落盘（conventional）

### Task 17: changeset — 本 phase 双包声明

- **Objective**: changeset — 本 phase 双包声明（cdd-engine minor + osuperpowers minor）
- **DependsOn**: 16

- **Consumes**: T16

- **Produces**: `@oscaner-skills/cdd-engine: minor` + `@oscaner-skills/osuperpowers: minor`；正文记录「engine 契约面重构（行为兼容性：CLI 路径语义由 cwd 相对改为仓根相对，**实为 breaking**）+ 8 skill 重写 + init 删除」；**不含本仓内部路径 / 工单号**（changeset 会被渲染进发布包的 `CHANGELOG.md`）

- **Files**: .changeset/p4-engine-contract-and-skills-overhaul.md

- **Steps**:
  1. 写 changeset（面向发布者、消费者中立） — checkable: `.changeset/p4-engine-contract-and-skills-overhaul.md` 落盘（双包 minor + 契约面重构叙述 + 零内部路径/工单号）
  2. `pnpm run version --dry-run` 复核 next 版本 — checkable: version --dry-run next 版本复核
  3. Commit：`git add .changeset`；`git commit -m "chore(changeset): P4 双包声明（cdd-engine minor + osuperpowers minor）"` — checkable: T17 变更面单提交落盘（conventional）

- **Acceptance**:
  - `.changeset/p4-engine-contract-and-skills-overhaul.md` 落盘（双包 minor + 契约面重构叙述 + 零内部路径/工单号）
  - version --dry-run next 版本复核
  - T17 变更面单提交落盘（conventional）

### Task 18: templates 结构与命名单源 — schema 原样注入 + 共享 Handoff/Return 壳 + schema description

- **Objective**: templates 结构与命名单源 — schema 原样注入 + 共享 Handoff/Return 壳 + schema description（取代 T5 的 renderer；T5 交付四面存续）
- **DependsOn**: 17

- **Consumes**: T5 的 `normalizeHandoff` / `recoverHandoff`（存续）

- **Produces**: `renderHandoffStub(schema)` 返回 ```json\n<JSON.stringify(schema， null， 2)>\n```（零 render、零解释器、零第二校验器）；4 模板同骨架；共享 `## Handoff` / `## Return` 壳；schema 前缀统一（`task-` / `docs-`）

- **Files**: packages/cdd-engine/lib/templates.mjs, packages/cdd-engine/templates/task/implement.md, packages/cdd-engine/templates/task/fix.md, packages/cdd-engine/templates/review/review.md, packages/cdd-engine/templates/review/doc-fix.md, packages/cdd-engine/templates/schema/cdd-handoff-schema.json, packages/cdd-engine/lib/handoff/schema.mjs, packages/cdd-engine/templates/fix/docs.md, packages/cdd-engine/templates/review/reviews.json, packages/cdd-engine/tests/templates.test.mjs, packages/cdd-engine/tests/handoff-stub.test.mjs, packages/cdd-engine/tests/schema-utils.test.mjs, packages/cdd-engine/tests/docs-runner.test.mjs

- **Steps**:
  1. 写失败测试（红）— 模板同骨架 + 零手写 render + schema 有 description：追加到 `tests/templates.test.mjs`——4 模板（`task/implement.md` / `task/fix.md` / `review/review.md` / `fix/docs.md`）同一骨架：每份含且仅含 Instructions / Handoff / Return 三个二级段（`[...src.matchAll(/^## (.+)$/gm)].map(m => m[1])` 恰为 `["Instructions", "Handoff", "Return"]`）；Handoff 段为 schema 原样注入（`JSON.parse(stub.replace(/^```json\n|\n```$/g, ""))` 等于 `loadHandoffSchema("task")`）；零手写 render 符号（`stubAnnotation` / `satisfiesProp` / `patternSample` / `requiredKeys` / `stubScalar` / `renderAllOfConditions` 零命中） — checkable: 三断言落盘且红（段名/段序不一、stub ≠ schema、符号仍在）
  2. 跑测试确认红：`pnpm --filter @oscaner-skills/cdd-engine test -- templates.test.mjs` — checkable: FAIL（段名/段序不一、stub ≠ schema、六个符号仍在）
  3. `renderHandoffStub` 改为原样注入：`return '```json\n' + JSON.stringify(schema, null, 2) + '\n```';`；**删除** `stubAnnotation` / `satisfiesProp` / `patternSample` / `requiredKeys` / `stubScalar` / `stubSkeletonLines` / `renderAllOfConditions` 全部函数与其调用面；`ctx.values` 真值注入面随之删除 — checkable: `renderHandoffStub(schema)` 原样注入（`JSON.parse(stub) === schema`）；六个符号零命中
  4. schema 补 `description`（写协议规则迁入）：两份 schema 顶层加 description、逐 property 加 description——迁移清单（源 = 模板散文中被删的规则句）：`status` ← `Write findings, not status — the engine derives status from findings`（engine 由 `findings[]` 派生 status；review 族可省略）· `findings` ← `[{lens, severity, section|file, line?, summary, fix}]` + severity 枚举语义 · `artifacts` ← `point at files, do not embed report bodies` · `commits.head` ← `full 40-char SHA；never --short` · `blocker` ← 无阻塞时省略（非 null）· `doc_path` / `doc_hash` ← docs 族的 review 目标与内容状态 token — checkable: 两份 schema 顶层 + 逐 property description 落位（模板规则句迁入）
  5. 4 模板收敛为同一骨架：每份改为 `# <Title>` / `## Instructions`（原功能内容全量保留，唯一差异段）/ `## Handoff`（共享壳：`HARD_GATE` 令牌 + `HANDOFF_STUB` 令牌 + 一句 `Write/update HANDOFF per the schema above`）/ `## Return`（共享壳，task 族 = `H1_BLOCK` 令牌；docs 族 = JSON return 说明）；`task/implement.md` 的 `## Evidence gate` 并入 `## Instructions`；`review/review.md` 的 `## Review focus` / `## Return contract` 并入 Instructions / Return、`## Self-validate` 并入 Handoff；`review/doc-fix.md` 补齐 `## Return`（现状缺失）并迁至 `templates/fix/docs.md` — checkable: 4 模板同骨架（段名/段序一致）；`fix/docs.md` 含 `## Return`
  6. 改名与映射随迁：`git mv templates/schema/cdd-handoff-schema.json templates/schema/task-handoff-schema.json`；`lib/handoff/schema.mjs` 路径映射改 `cdd:` → `task:`；`reviews.json` 的模板名与 `fixTemplate` 随 `doc-fix.md` → `fix/docs.md` 同步；全仓零 `cdd-handoff-schema` 残留 — checkable: `task-handoff-schema.json` 改名 + 映射随迁；全仓零 `cdd-handoff-schema` 残留（后接 .json 的豁免为 docs-handoff-schema）
  7. 跑 engine 套件 + validate：`pnpm --filter @oscaner-skills/cdd-engine test && pnpm run validate` — checkable: 全绿；`grep -rn "cdd-handoff-schema\|stubScalar\|satisfiesProp\|stubAnnotation\|patternSample\|requiredKeys\|renderAllOfConditions" packages/cdd-engine/lib packages/cdd-engine/templates` = 0（机制面 lib/ + templates/；tests 面排除——零命中断言用拼接构造 token）
  8. Commit：`git add packages/cdd-engine`；`git commit -m "refactor(cdd-engine): templates 结构与命名单源 — schema 原样注入（删手写 render）+ 共享 Handoff/Return 壳 + description 补全"` — checkable: T18 变更面单提交落盘（conventional）

- **Acceptance**:
  - 三断言落盘且红（段名/段序不一、stub ≠ schema、符号仍在）
  - FAIL（段名/段序不一、stub ≠ schema、六个符号仍在）
  - `renderHandoffStub(schema)` 原样注入（`JSON.parse(stub) === schema`）；六个符号零命中
  - 两份 schema 顶层 + 逐 property description 落位（模板规则句迁入）
  - 4 模板同骨架（段名/段序一致）；`fix/docs.md` 含 `## Return`
  - `task-handoff-schema.json` 改名 + 映射随迁；全仓零 `cdd-handoff-schema` 残留（后接 .json 的豁免为 docs-handoff-schema）
  - 全绿；`grep -rn "cdd-handoff-schema\|stubScalar\|satisfiesProp\|stubAnnotation\|patternSample\|requiredKeys\|renderAllOfConditions" packages/cdd-engine/lib packages/cdd-engine/templates` = 0（机制面 lib/ + templates/；tests 面排除——零命中断言用拼接构造 token）
  - T18 变更面单提交落盘（conventional）
