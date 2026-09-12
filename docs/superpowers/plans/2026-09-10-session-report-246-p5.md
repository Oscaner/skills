# P5 CDD 编排硬化 — Implementation Plan

**Spec:** [2026-09-10-session-report-246-p5-design.md](docs/superpowers/specs/2026-09-10-session-report-246-p5-design.md)（v1.0：engine 全权 `.superpowers/**` artifact 写平面——workspace-artifacts 单源 + `cdd base-branch set/get` 双场景写入口 + implement 自供应 brief + slug 收敛（`-design`/`-plan` trim）+ 代码目录/文件/CLI 整理 + skills/docs 死说明收敛 + P4 守卫双形 glob 交叉面）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 消除 orchestrator 对 `.superpowers/**` artifact 的手工写入（F10 base-branch heredoc 无校验 / F11 brief 显式触发脆弱），实现 engine 全权写平面——`cdd base-branch set/get` 唯一写入口 + implement 自供应 brief；连带收敛 workspace slug 派生（`-design`/`-plan` 双 suffix trim，防 AI 加 `-plan.md` 后缀分叉）、整理 cdd-engine 代码目录/CLI 结构、收敛编排 skills/docs 死说明。

**Architecture:** 八任务顺序——① slug 收敛（workspaceSlug 双 suffix strip + run-task/review 双派生点同源）；② workspace-artifacts 单一权威层（baseBranchPath/briefPath + schema 校验 4 值 enum + 幂等写）；③ `cdd base-branch set/get` CLI（parse 注册 + 双场景落点 + SUBCOMMAND_USAGE）；④ implement 自供应 brief（resolveRepoRoot plan 定稿处生成）；⑤ 代码整理（删 bin 双 .gitkeep + 拆 cli/shared.mjs + runBriefCli 归 lib/cli/brief.mjs + tests 迁移）；⑥ P4 守卫交叉（checkDocExistence/anchorScanFiles 双形 glob + fixture）；⑦ skills/docs 收敛（SKILL determine-base/dispatch-mode/read-base 委托 + base-branch.md + _docs/review.md slug 同步）+ emit；⑧ changeset + 全量 validate + overall 终态收口。模块触碰纪律：`lib/cli/review.mjs` 在 Task 1/6 各动一次派生点、Task 5 拆分守卫，顺序执行避免冲撞。

**Tech Stack:** Node ESM + vitest（`packages/cdd-engine/tests/*.test.mjs`）+ commander（parse.mjs）+ changesets。

## Global Constraints

- **slug 收敛**（spec §2.4）：`workspaceSlug(doc)` = 去 `.md` → strip 尾 `-design` **或** `-plan`（单 suffix，不级联）；`lib/runner/run-task.mjs` `resolveWorkspace`（`path.basename(plan, ".md")`）与 `lib/cli/review.mjs` task 路径（`path.basename(opts.plan, ".md")`）**双派生点同源改指 `workspaceSlug`**——分叉会让 Stopping prev 与 runner 写读不一致（r2 blocker 实证）。
- **写平面统一**（spec §2.1-2.3）：`.superpowers/**/base-branch.json` 唯一写作者 = `cdd base-branch set`；schema 4 值 enum `plan-field|branch-upstream|conversation-context|user-confirmed`（修正 base-branch.md 3 值表漂移）；幂等 = base 同 → source 追新/confirmed_at 保留（语义权威不被破坏，非不写盘）、base 异 → 拒绝须 `--force`；`get` 双场景皆支持，缺失/schema 非法 → exit 非零。
- **implement 自供应 brief**（spec §2.5）：有效 plan（`--plan`/`PLAN_FILE`/ledger backfill 三源任一）存在 → **每次重新生成** `task-N-brief.md`（TASK_BASE=current HEAD，机械提取幂等）；纯 `CDD_WORKSPACE` → 跳过、读既有；生成错误 → BLOCKED 不静默降级。
- **P4 守卫交叉**（spec §2.4 BLOCKER 同步）：`scripts/validate/overall-consistency.mjs` `checkDocExistence` planSuffix 与 `anchorScanFiles` 正则改双形（无后缀 + `-plan` 变体）；改动后 `pnpm run validate` 块 12 全绿（cdd/session-246 实证 + P5 自身 plan 文档经双形通过）。
- **代码整理**（spec §2.6）：删 `bin/.gitkeep` + `bin/lib/.gitkeep`；`lib/cli/shared.mjs` 承接外部消费守卫集（detect/requireHostHarness/DRY_RUN/intTask/resolveTargetDoc/reviewStoppingGuard），`stoppedExit3`/`existingRoundHandoff`/`blockerCount` 留 review.mjs 内部私有；`runBriefCli` → `lib/cli/brief.mjs`，`tests/brief.test.mjs` `execFileSync(node, lib/brief.mjs)` 两例改指新路径，迁移后删 lib/brief.mjs 直调 guard；`tests/host-detection.test.mjs` seam 同步改指 shared。
- **skills/docs**（spec §2.7）：`cli-driven-development/SKILL.md` dispatch-mode 删 brief 前置步、determine-base/branch-review 委托；`finishing/SKILL.md` read-base 委托；`base-branch.md` enum 4 值 + CLI 用法 + 双 slug 机制分列 + 删 dead P8 引用；`_docs/review.md` §Handoff Output slug 描述同步 `-plan`；**改后必 `pnpm run emit`**。
- vendored 子模块不可改；specs/plans/changeset 不触发 emit；本 plan 文档自身在 ④a 扫描面——fixture 指令不得含 `#\d+#issuecomment-\d+` 字面量（写文件用变量拼装）。
- conventional commit 无 attribution trailer；每任务结束前 `pnpm run validate` 全绿；changeset `@oscaner-skills/osuperpowers` minor + `@oscaner-skills/cdd-engine` patch。

---

### Task 1: slug 收敛——workspaceSlug 双 suffix strip + run-task/review 双派生点同源

<thinking>核心：`lib/handoff/naming.mjs` `workspaceSlug` 去 `.md` 后 strip 尾 `-plan` 或 `-design`（单 suffix，不级联）；两个派生点（run-task `resolveWorkspace` + review.mjs task 路径）改指同一函数。这是全 phase 的地基——后续 Task 3 base-branch 落点与 Task 4 self-brief 都依赖稳定 slug。先引 failing test 定契约。</thinking>

- [ ] **1a. 写 failing test**：`tests/handoff-naming.test.mjs` 追加 `workspaceSlug` 双 suffix 用例——`workspaceSlug("xxx-p5.md")` = `workspaceSlug("xxx-p5-design.md")` = `workspaceSlug("xxx-p5-plan.md")` = `xxx-p5`；单 suffix 不级联（`workspaceSlug("xxx-a-plan.md")` = `xxx-a`，`workspaceSlug("xxx-plan-plan.md")` 保留「仅 strip 一层」语义 = `xxx-plan`）。**外加双派生点行为回归**（spec §2.9 rows 2/6 对齐——防 review.mjs 与 run-task.mjs 未来派生分叉不被测出）：`tests/runner.test.mjs` 追加 `resolveWorkspace({plan:"xxx-p5-plan.md",…})` 与 `resolveWorkspace({plan:"xxx-p5.md",…})` slug 收敛同值；`tests/cli-shared.test.mjs` 追加 review.mjs task 派生点用例（`workspaceSlug("xxx-p5-plan.md")` 供 task 路径 = `xxx-p5`）。
- [ ] **1b. 红验证**：`npx vitest run tests/handoff-naming.test.mjs`——新用例 fail（现 `workspaceSlug("xxx-p5-plan.md")` 返回 `xxx-p5-plan`）。
- [ ] **1c. 实现 workspaceSlug**：`lib/handoff/naming.mjs` `workspaceSlug(doc)` 改 `base = path.basename(doc).replace(/\.md$/, "")` 后：`/[-](?:design|plan)$/` 单匹配 strip（`base.replace(/-(?:design|plan)$/, "")`——`-design`/`-plan` 互斥单次，天然不级联）。
- [ ] **1d. run-task 派生点收敛**：`lib/runner/run-task.mjs` `resolveWorkspace` 内 `const slug = path.basename(plan, ".md")` → `const slug = workspaceSlug(plan)`（从 `../handoff/naming.mjs` import，与 included `slug` 校验保留）。
- [ ] **1e. review.mjs task 派生点收敛**：`lib/cli/review.mjs` L199 `const slug = path.basename(opts.plan, ".md")` → `const slug = workspaceSlug(opts.plan)`（import 已在 review.mjs 侧？——解析 `handoff-naming` 现有 import 面，若未引则加）。
- [ ] **1f. 绿验证 + 回归**：`npx vitest run tests/handoff-naming.test.mjs tests/runner.test.mjs tests/cli-shared.test.mjs tests/task.test.mjs tests/cli-shared.test.mjs`——新用例绿 + run-task/review 既有用例不破；`node scripts/run.mjs validate` 全绿。
- [ ] **1g. commit**：`fix(cdd-engine): workspaceSlug strips -design/-plan single suffix; run-task/review derive points converge`

### Task 2: workspace-artifacts 单一权威层（baseBranchPath/briefPath + schema + 幂等写）

<thinking>spec §2.2——`lib/state/workspace-artifacts.mjs` 承载 base-branch 与 brief 的路径解析 + schema 校验唯一落点。纯 lib 无 CLI 面，可独立测试。先定义 failing 契约再实现。</thinking>

- [ ] **2a. 写 failing test**：新 `tests/workspace-artifacts.test.mjs`——`baseBranchPath({workspace})` 返回 `<ws>/base-branch.json`；`briefPath({workspace, task})` 返回 `<ws>/task-1-brief.md`；`validateBaseBranch` 合法 4 值对象 → ok、非法 source / 缺 base / base 空串 → `{ok:false, errors}` 含具体 message；`writeBaseBranch` 幂等矩阵：不存在 → 写 + confirmed_at ISO；同 base → source 追新 / confirmed_at 保真（不破坏权威）；异 base 无 force → reject；`--force` → 覆盖。
- [ ] **2b. 红验证**：`npx vitest run tests/workspace-artifacts.test.mjs`——fail（模块不存在）。
- [ ] **2c. 实现模块**：`lib/state/workspace-artifacts.mjs`——`BASE_BRANCH_SOURCES` 4 值 const + `baseBranchPath` + `briefPath` + `validateBaseBranch`（返回 `{ok}|{ok:false, errors}`）+ `writeBaseBranch({base, source, workspace, force})`（ISO confirmed_at `new Date().toISOString()`；同 base 保留原 confirmed_at、更新 source）。**含 workspace 目录 bootstrap**：写入前 `mkdirSync(dirname, {recursive:true})`——determine-base 在 implement 前跑，workspace 目录届时尚不存在（naming.resolveWorkspace 不 mkdir，仅 run-task 本地惰性建），否则首秀 set 即 ENOENT。
- [ ] **2d. 绿验证**：`npx vitest run tests/workspace-artifacts.test.mjs`——全绿；`node scripts/run.mjs validate` 块 5b1（engine suite）绿。
- [ ] **2e. commit**：`feat(cdd-engine): workspace-artifacts single authority — base-branch schema (4-value enum) + idempotent write + brief path`

### Task 3: `cdd base-branch set/get` CLI（parse 注册 + 双场景落点）

<thinking>spec §2.3——CLI 面。`cdd base-branch set --base --source [--plan | --scope standalone --slug] [--force]` + `cdd base-branch get`。依赖 Task 2 模块。orchestrator（determine-base/read-base）此后只读 + 委托此 CLI（SKILL 改写入 Task 7）。</thinking>

- [ ] **3a. 写 failing test**：`tests/base-branch.test.mjs`——CLI 契约：`set --base develop --source plan-field --plan <plan>` → 文件落于 `resolveWorkspace(plan)` + exit 0；`set --scope standalone --slug <s>` → `<gitRoot>/.superpowers/standalone/<s>/base-branch.json`；非法 source → exit 非零 + errors；异 base 无 force → 拒绝 + exit 非零；`--force` 覆盖成功；`get --plan` 双场景读 + JSON 往返；缺 target（CDD 无 plan）→ exit 非零 + 明确报错；`get` 目标缺失 / schema 非法 → exit 非零。
- [ ] **3b. 红验证**：`npx vitest run tests/base-branch.test.mjs`——fail（子命令未注册）。
- [ ] **3c. 实现 CLI**：`lib/cli/parse.mjs` 注册 `.command("base-branch")` 二级 `.command("set")` / `.command("get")`（flag 边界：`--plan` 与 `--scope standalone --slug` 互斥；standalone 组 `--base/--source` 必填；均缺 → 默认 CDD 语义 + 明确报错）；`lib/cli/base-branch.mjs` action 主体（复用 workspace-artifacts 模块 + `resolveWorkspace(plan)` CDD 落点 / standalone 手工 `gitToplevel(cwd)/.superpowers/standalone/<slug>`）；SUBCOMMAND_USAGE 补 `base-branch` **单词键**（`usage: cdd base-branch <set|get> …`——usageError 只读 `process.argv[2]` 首 token，双词键 `base-branch set` 永不可达，落单词键后坏 flag/缺子命令统一回退该行）；CLI help 标题含 base-branch。
- [ ] **3d. 绿验证 + 回归**：`npx vitest run tests/base-branch.test.mjs tests/cdd.test.mjs tests/cli-shape.test.mjs`——全绿；`node scripts/run.mjs validate` 全绿。
- [ ] **3e. commit**：`feat(cdd-engine): cdd base-branch set/get — dual-scope writer + schema validation + idempotency + force`

### Task 4: implement 自供应 brief（resolveRepoRoot plan 定稿处生成）

<thinking>spec §2.5——F11 核心。run-task 在有效 plan 定稿后、dispatch 前插入 `generateBrief`。三源 plan（--plan/PLAN_FILE/ledger backfill）任一存在即生成。缺省 plan（纯 CDD_WORKSPACE）跳读既有。</thinking>

- [ ] **4a. 写 failing test**：`tests/task.test.mjs` 追加——dry-run/fake-harness `implement --plan <p>` 且**无前置 brief 文件** → runTask 后 `<ws>/task-N-brief.md` 存在 + 含 `TASK_BASE:`；plan 越界（缺 Task N）→ BLOCKED（不静默降级）；纯 `CDD_WORKSPACE` 无 plan → 不生成、读既有 brief（兼容）。
- [ ] **4b. 红验证**：`npx vitest run tests/task.test.mjs`——新用例 fail（现 runTask 不生成 brief）。
- [ ] **4c. 实现**：`lib/runner/run-task.mjs`——plan 定稿处（resolveRepoRoot 后，runTask 主流程前）`if (plan)` `generateBrief(plan, taskNum, defaultBriefPath, repoRoot)`（defaultBriefPath = `workspace-artifacts.briefPath({workspace, task})`；generateBrief 自 lib/brief.mjs import）；生成错误 → 走 BLOCKED 路径（复用现有 RunBlocked/writeBlocked 机制）。
- [ ] **4d. 绿验证 + 回归**：`npx vitest run tests/task.test.mjs tests/runner.test.mjs tests/brief.test.mjs`——全绿；`node scripts/run.mjs validate` 全绿。
- [ ] **4e. commit**: `feat(cdd-engine): cdd implement self-provisions task brief (three-source plan; BLOCKED on generation failure)`

### Task 5: 代码整理——删 bin 双 .gitkeep + 拆 cli/shared.mjs + runBriefCli 归位

<thinking>spec §2.6——用户「目录/文件/CLI 变乱」指令。三合一：死空目录清理、守卫宿主分离、brief CLI 处理器归 cli 簇。共享守卫拆出后 review/fix/parse/branch-review/research 4 消费方 + host-detection seam 改指 shared。brief CLI 迁移涉及 brief.test 两例改 execFileSync 目标。</thinking>

- [ ] **5a. 拆 `lib/cli/shared.mjs`**：守卫归属按**闭包完备性**定（reviewStoppingGuard 内部调用 stoppedExit3 + blockerCount + reviewStoppedError，三者须随迁避免 shared→review 反向 import）——shared 迁出集：`detectCurrentHarness`/`requireHostHarness`/`DRY_RUN`/`intTask`/`resolveTargetDoc`/`blockerCount`/`stoppedExit3`/`reviewStoppingGuard`（含其依赖 `reviewStoppedError` 自 `runner/review-loop.mjs` import）；`existingRoundHandoff` 只被 runReview 消费 → 留 review.mjs 私有。共享守卫簇全闭环，shared 零反向依赖。
- [ ] **5b. 4 消费方改指**：`fix.mjs`/`parse.mjs`/`branch-review.mjs`/`research.mjs` 从 `./review.mjs` import 的守卫 ⇒ `./shared.mjs`（runReview 仍留 review.mjs）；`tests/host-detection.test.mjs` seam `from "../lib/cli/review.mjs"` → `"../lib/cli/shared.mjs"`。
- [ ] **5c. runBriefCli 归位**：`runBriefCli` 从 `lib/brief.mjs` 迁 `lib/cli/brief.mjs`（import `generateBrief` from `../brief.mjs`）；`parse.mjs` import 改指 `./brief.mjs`；`lib/brief.mjs` 删直调 guard 段 + `exit/ExitRequested` 相关 import（残留无效引用清理）。
- [ ] **5d. brief.test 迁移**：`tests/brief.test.mjs` `BRIEF_MJS` const 改 `lib/cli/brief.mjs`；两 CLI 用例（L123/L139）保持断言；补断言「`node lib/brief.mjs` 无直调 guard → 无 CLI 行为」。
- [ ] **5e. 删死目录**：`git rm bin/.gitkeep bin/lib/.gitkeep`（两个 initial scaffold 空洞残留，smoke/发布无关）。
- [ ] **5f. 绿验证 + 回归**：`npx vitest run tests/brief.test.mjs tests/cli-shared.test.mjs tests/host-detection.test.mjs tests/cdd.test.mjs tests/cli-shape.test.mjs tests/review-loop.test.mjs tests/docs-runner.test.mjs`——全绿；`node scripts/run.mjs validate` 全绿（含 5c engine zero-residue——旧直调 guard 无残留）。
- [ ] **5g. commit**：`refactor(cdd-engine): split cli/shared.mjs guard host, relocate runBriefCli to lib/cli, rm bin .gitkeep pair`

### Task 6: P4 守卫交叉——checkDocExistence/anchorScanFiles 双形 glob

<thinking>spec §2.4 BLOCKER 同步——P5 的 `-plan` 命名约定要求 P4 守卫的 plan 文档 glob 兼容无后缀 + `-plan` 两形，否则 P5 closeout plan 必抛 missing。改 `scripts/validate/overall-consistency.mjs` + fixture + 测试。</thinking>

- [ ] **6a. fixture + failing test**：`scripts/validate/fixtures/overall-consistency/plans/` 增 `<date>-fixture-<slug>-p1-plan.md`（守现有 plan 已 shipped 路径）；`overall-consistency.test.mjs` 追加——`planSuffix` 双形 glob：无后缀 plan 命中、`-plan.md` 命中、两形并存 → duplicate；`anchorScanFiles` 含 `-plan` 变体文件。
- [ ] **6b. 红验证**：`npx vitest run scripts/validate/overall-consistency.test.mjs`——新用例 fail（现 glob 只认无后缀）。
- [ ] **6c. 实现双形**：`overall-consistency.mjs` `planSuffix(id)` → `planSuffixes(id)` 双数组（`-<slug>-<id>.md` + `-<slug>-<id>-plan.md`）；`anchorScanFiles` 正则 → `-${slug}-p\\d+(?:-design|-plan)?\\.md$`；duplicate 语义覆盖跨形并存。
- [ ] **6d. 绿验证 + 实证**：`npx vitest run scripts/validate/overall-consistency.test.mjs`——全绿；`node scripts/validate/overall-consistency.mjs`——cdd-overhaul + session-246（现含 P5 无后缀 plan 前仍绿，若 plan 文档未存在则 OK 判定按当前列状态）；`node scripts/run.mjs validate` 全绿。
- [ ] **6e. commit**：`fix(validate): overall-consistency planSuffix/anchorScanFiles dual-form globs (bare + -plan variant)`

### Task 7: skills/docs 收敛 + emit

<thinking>spec §2.7——用户「减死说明 + 臃肿态」指令。四处 SKILL/docs 委托 + `_docs/review.md` slug 同步；改后必须 `pnpm run emit` 再生 `.agents/`。</thinking>

- [ ] **7a. `cli-driven-development/SKILL.md`**：`determine-base` Do 内联 schema/枚举/推断序列 → 委托 `[base-branch.md](./docs/base-branch.md)` + sip 讲「推断 → `cdd base-branch set --base --source --plan`」；`dispatch-mode` step 1「Generate brief: `cdd brief --task N --plan --output`」整步删除（implement 自供应），step 重新编号（原 2/3/4 → 1/2/3）；`branch-review` Do 的 base 来源描述委托 base-branch.md（`cdd base-branch get` 读）；**7a-extra 全 SKILL 扫查**（spec §2.7.1 第四行「HTML 注释/死残留」）：dispatch-mode 既有 §D（progress engineRecoveryCount）/§E（exit-0-no-handoff）历史注解逐条核验——仍有效则保留并标注有效、失效则折叠为一行现状句，删同文件编辑残留。
- [ ] **7b. `finishing/SKILL.md` `read-base`**：内联推断序列（① ② ③ ④）+ slug sanitize 五步全文 → 委托 base-branch.md 一条 + 写路径「`cdd base-branch set --scope standalone --slug <sanitized>`」；schema 内联删（指向 base-branch.md）。
- [ ] **7c. `cli-driven-development/docs/base-branch.md`**：schema 表 `source` 修 **4 值 enum**（补 `conversation-context`）；新增 **CLI 用法节**（set/get 双场景 + 幂等/--force/校验失败 error + flag 边界）；**双 slug 机制分列**（Scope Resolution CDD 行 → workspaceSlug 规则；Slug Sanitize Rules 段只留分支名五步）；删 dead `Consumer Integration` P8 引用。
- [ ] **7d. `_docs/review.md`**：§Handoff Output workspace slug 句「`.md` and a trailing `-design` stripped」→「`.md` + trailing `-design` / `-plan` (single) stripped」；收敛示例注释对齐。
- [ ] **7e. emit 再生**：`pnpm run emit` → `.agents/skills/**` 再生成；`pnpm run emit:check` 绿（CI drift 门）。
- [ ] **7f. 绿验证 + 回归**：`node scripts/run.mjs validate` 全绿（13 块，含 0 emit freshness + 5b rule-reference 语义锚点——SKILL 改动后 anchor 引用完整）+ engine suite 绿。
- [ ] **7g. commit**：`docs(osuperpowers): orchestration skill convergence — dispatch-mode drops brief pre-step, determine-base/read-base delegate to base-branch CLI, base-branch.md 4-enum + dual-slug split, review.md slug sync (+emit)`

### Task 8: changeset + 全量 validate + overall 终态收口

<thinking>spec §2.8 / §2.9——phase 收口。changeset（osuperpowers minor + cdd-engine patch）+ 全量 validate + overall P5 终态（plan 列回填 Done + change-history v1.17）。</thinking>

- [ ] **8a. changeset**：`.changeset/p5-session-report-246-orchestration-hardening.md`——`@oscaner-skills/osuperpowers` minor（SKILL 行为收敛）+ `@oscaner-skills/cdd-engine` patch（set/get 新子命令 + self-brief + slug 收敛 + shared 拆分——加显式 note：`cdd base-branch set/get` 可用、orchestrator 旧 `cdd brief` 前置调用兼容可删）。
- [ ] **8b. 全量 validate**：`pnpm run validate` —— 13 块全绿 + `pnpm run emit:check` 绿 + engine suite 全绿（契约面：`cdd --help` 含 base-branch、`bin/lib`/`bin/.gitkeep` 不在、shared 守卫导出齐）。
- [ ] **8c. overall 终态**：`docs/superpowers/specs/2026-09-10-session-report-246-overall.md`——P5 Phase inventory `Implementation plan` 列回填（[Pending]→Done）+ change-history 追加 v1.17（P5 dev shipped：8 task 全 APPROVED + branch-review + changeset + PR）；F13 closeout 检查点执行（守卫对自身五 phase ① 双向自证）。
- [ ] **8d. 终态验证**：`node scripts/validate/overall-consistency.mjs` —— session-246 OK（P5 plan 列 Done ↔ closeout 行声明一致）；`pnpm run validate` 全绿。
- [ ] **8e. commit**：`docs(superpowers): F13 closeout — P5 plan column Done + change-history v1.17 (guard self-proof)`

---

## Out of Scope（不动）

- `packages/osuperpowers/skills/brainstorming` / `writing-plans` / `cli-research` / `report-issue` / `init`——base-branch/brief 语义不入其 Node（spec §2.7.4 清查背书，仅确认无残留，不编辑）。
- vendored 子模块（superpowers / mattpocock-skills / impeccable）不可改。
- `cdd brief` 视觉保留（research / manual 场景消费方在），仅迁实现位置不改 CLI 契约。
- base-branch.md「plan-field 推断」在 engine set 侧不实现自动读取（orchestrator 推断、engine 写——inference 责任在编排侧，spec §2.3 定案）。