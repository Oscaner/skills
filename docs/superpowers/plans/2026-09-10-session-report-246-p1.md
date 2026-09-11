# P1 cdd-engine 进程生命周期统一管理 + 结构重排 — Implementation Plan

**Spec:** [2026-09-10-session-report-246-p1-design.md](docs/superpowers/specs/2026-09-10-session-report-246-p1-design.md)（v1.1：registry 条目 `ownerPid/done` 定案 + 进程内 idle 监视细化——`markAllDispatchesDone`/`startIdleMonitor`/`reapDone` + §2.3 re-org 验证纪律登记（`node --check` 为凭据）+ §2.2 A `CDD_LIFECYCLE_PATH` 并发隔离，plan-review r1 驱动）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 cdd-engine 落地统一进程生命周期所有权（`spawnManaged` / `teardownAll` / `reapStale` / `reapDone`，进程组隔离 + run 级 registry + 进程内 idle 回收 + 跨 run 孤儿回收兜底）并重排 cdd-engine 目录结构（bin 薄入口 + lib 分簇 + tests 顶层），修 F1 驻留累积与结构债。

**Architecture:** 四任务顺序——① 纯机械 re-org（git mv + import 更新 + 路径常数复算 + validate 套件同步；中间步骤以 `node --check` 语法通过为凭据、中间态允许暂时红，Step 4 收敛后恢复全量套件、以 Step 7 全量测试为闭环）先行；② `lib/lifecycle/proc.mjs` + `lib/lifecycle/cli.mjs` 生命周期核心（含单测）；③ 全派生点 wiring + 进程内 idle 监视 + CLI 信号 handler + 跨 run reapStale 启动回收 + 架构守卫测试；④ changeset（`@oscaner-skills/cdd-engine` minor）+ 全量 validate。每个模块只动一次。

**Tech Stack:** Node ESM + execa v9（`detached` 进程组）+ vitest（`packages/cdd-engine`）+ changesets。

## Global Constraints

- **re-org 先行**：Task 1 纯机械 git mv + import 更新。验证纪律与步骤语义一致——中间步骤以 `node --check` 语法通过为凭据（模块图在 Step 2-4 收敛前必然断裂，中间态允许暂时红，禁止提前"修"未收敛中间态），Step 4 收敛后恢复全量套件，以 Step 7 全量测试为闭环 → Task 2-3 落在新布局；每个模块只动一次。**本纪律与 spec §2.3 执行顺序逐字一致（v1.1 已登记：「中间步骤以 `node --check` 语法闭环为凭据——批次 mv 语义下中间态允许暂时红、禁止提前修未收敛中间态；Step 4 收敛后恢复全量套件，Step 7 全量 validate 闭环」），非计划对 spec 验证纪律的单方改写、无未登记偏差**——本计划直接以 spec §2.3 为凭据。
- **exec 契约**：`spawnManaged` 保持 `{ok, code, stdout, stderr, timedOut}` 五字段（合并原 `spawnCapture`，不保留薄封装）；`invokeCli / invokeCliWithRetry` 原样透传。
- **execa 弃用 `cleanup: true`**：execa v9 在 `detached: true` 下 cleanup 钩子不安装（`lib/terminate/cleanup.js` 首行 `if (!cleanup || detached) return;`）——父死回收由「registry 落盘 + 下次启动跨 run reapStale」承担，不再依赖 cleanup。
- **registry 双写 + 条目模型**：run 级 registry 内存 + 落盘 `.superpowers/cdd/lifecycle.json`（跨 run 复用同一路径）；条目 `{ pgid, label, createdAt, ownerPid, done }`（spec §2.2 A——`ownerPid` 支撑跨 run 孤儿判定、`done` = dispatch 已返回，供进程内 idle 监视）。
- **idle backstop 双兜**（spec §2.2 C / §2.4）：进程内低频监视（dispatch 返回后 `markAllDispatchesDone` → `startIdleMonitor` 周期 `reapDone` 清 done+存活组）+ 引擎启动跨 run `reapStale`（回收上次 SIGKILL/crash 残留孤儿组）。
- **发布 CLI 接口（`cdd <subcommand>`）不变**；`package.json#files` → `["bin/","lib/","templates/"]`；`npm pack --dry-run` 不含 tests。
- vendored 子模块不可改；conventional commit 无 attribution trailer；每任务结束前 `pnpm run validate` 全绿。
- 目标布局与破坏面以 spec §2.3 为准（含 bin/parse 分界、contract 全量符号归位、深度派生常数专项、smoke ENGINE/G3 扩列）。

---

### Task 1: cdd-engine 结构重排（mechanical re-org）

<thinking>原子单元：目录迁移 + 包内 import 全量更新 + contract.mjs 符号拆分 + cdd.mjs 薄入口化（lib/cli/ 四 orchestrator + parse.mjs）+ tests 移顶层 + 深度派生常数复算 + package.json/files + .npmignore + residue/smoke 同步。全部机械；既有 engine 测试套件守卫闭环（中间步骤以 `node --check` 语法通过为凭据、中间态允许暂时红，Step 4 收敛后恢复全量套件，以 Step 7 全绿为 closed-loop）。</thinking>

**Files:**
- Move: `bin/lib/*` → `lib/**`（按映射表）；`bin/utils/exit.mjs` → `lib/exit.mjs`；`bin/tests/*` → `tests/*`；`bin/harness-registry.json` → `lib/harness-registry.json`；`bin/cdd.mjs`（原地，Task 1 内薄入口化）
- Split: `bin/lib/contract.mjs` → `lib/contract/commit.mjs` + `lib/handoff/write.mjs` + `lib/handoff/finalize.mjs`（状态派生簇并入）
- Split: `bin/cdd.mjs` → `bin/cdd.mjs`（薄）+ `lib/cli/{review,branch-review,fix,research,parse}.mjs`
- Modify: `package.json`（files）· `.npmignore`（死条目）· `scripts/validate/residue.mjs` · `scripts/validate/smoke-cdd.mjs`

**Interfaces:**
- Consumes: 无（起点任务，现有代码逐符号归位）
- Produces: 新布局稳定树（Task 2-3 落点）；`lib/registry.mjs` 导出统一 `REG_PATH`；`lib/cli/review.mjs` 导出 `detectCurrentHarness`（供测试）

- [ ] **Step 1: git mv 1:1 文件（纯重命名簇）**

```bash
cd /Users/kang/Projects/oscaner-skills/packages/cdd-engine
mkdir -p lib/cli lib/lifecycle lib/runner lib/handoff lib/contract lib/state tests
git mv bin/lib/runner.mjs       lib/runner/run-task.mjs
git mv bin/lib/docs-runner.mjs  lib/runner/run-docs.mjs
git mv bin/lib/review-loop.mjs  lib/runner/review-loop.mjs
git mv bin/lib/cli-shared.mjs   lib/lifecycle/cli.mjs
git mv bin/lib/handoff-naming.mjs    lib/handoff/naming.mjs
git mv bin/lib/handoff-finalize.mjs  lib/handoff/finalize.mjs
git mv bin/lib/schema-utils.mjs      lib/handoff/schema.mjs
git mv bin/lib/progress.mjs          lib/state/progress.mjs
git mv bin/lib/registry.mjs          lib/registry.mjs
git mv bin/lib/templates.mjs         lib/templates.mjs
git mv bin/lib/brief.mjs             lib/brief.mjs
git mv bin/lib/research.mjs          lib/cli/research-core.mjs   # 暂名（runResearch 拆分后并入 lib/cli/research.mjs）
git mv bin/utils/exit.mjs            lib/exit.mjs
git mv bin/harness-registry.json     lib/harness-registry.json
# contract.mjs 与 cdd.mjs 不 git mv —— 它们按 Step 3/4 拆分
# tests 与 fixtures 移顶层（保留 fixtures/ 子目录形态——Step 5/6 的 fixture 引用与 smoke-cdd 断言均按此形态）：
git mv bin/tests/fixtures tests/fixtures
git mv bin/tests/*.mjs tests/ 2>/dev/null
git mv bin/tests/.gitkeep tests/.gitkeep 2>/dev/null
rmdir bin/tests 2>/dev/null || echo "CDD_RESIDUE: bin/tests 非空，待核对"
rmdir bin/utils 2>/dev/null || echo "CDD_RESIDUE: bin/utils 非空，待核对"
```

检查残留（逐条核对，不用 `|| true` 静默吞失败）：
```bash
ls bin/                  # 应仅剩 cdd.mjs（将拆分）+ .gitkeep + lib/
find bin/lib -type f     # 应仅剩 bin/lib/contract.mjs + .gitkeep（gitkeep 保留入目录族，随 `**/.gitkeep` 排除于发布面，见 Step 6）
git status --porcelain bin/ lib/ tests/ | head -30
```

- [ ] **Step 2: 全量导入路径更新（一次性 sed + 人工校验）**

现有 `bin/lib/X.mjs` 的兄弟 import `./X.mjs`（同目录）迁后变成新族路径。映射表（新路径 → 引用侧需更新的 import）：

| 旧路径（`bin/lib/` 下） | 新路径 | 从 `lib/` 顶层的引用 | 从 `lib/runner/` 的引用 |
|---|---|---|---|
| cli-shared.mjs | `lib/lifecycle/cli.mjs` | `./lifecycle/cli.mjs` | `../lifecycle/cli.mjs` |
| runner.mjs | `lib/runner/run-task.mjs` | `./runner/run-task.mjs` | —（自身） |
| docs-runner.mjs | `lib/runner/run-docs.mjs` | `./runner/run-docs.mjs` | — |
| review-loop.mjs | `lib/runner/review-loop.mjs` | `./runner/review-loop.mjs` | — |
| handoff-naming.mjs | `lib/handoff/naming.mjs` | `./handoff/naming.mjs` | `../handoff/naming.mjs` |
| handoff-finalize.mjs | `lib/handoff/finalize.mjs` | `./handoff/finalize.mjs` | `../handoff/finalize.mjs` |
| schema-utils.mjs | `lib/handoff/schema.mjs` | `./handoff/schema.mjs` | `../handoff/schema.mjs` |
| progress.mjs | `lib/state/progress.mjs` | `./state/progress.mjs` | `../state/progress.mjs` |
| registry.mjs | `lib/registry.mjs` | `./registry.mjs` | `../registry.mjs` |
| templates.mjs | `lib/templates.mjs` | `./templates.mjs` | `../templates.mjs` |
| brief.mjs | `lib/brief.mjs` | `./brief.mjs` | `../brief.mjs` |
| research.mjs | `lib/cli/research-core.mjs` | `./cli/research-core.mjs` | `../cli/research-core.mjs` |
| contract.mjs | `lib/contract/commit.mjs` + `lib/handoff/write.mjs` + `lib/handoff/finalize.mjs`（按符号，见 Step 3） | — | — |
| exit.mjs（`bin/utils/` 下，非 bin/lib/） | `lib/exit.mjs` | `./exit.mjs` | `../exit.mjs` |

> **exit.mjs 消费方（映射表缺该行则 run-task.mjs / lib/cli/ 各拆分模块留红至 Step 7 才发现）**：`bin/lib/runner.mjs` L20 `import { exitOk, exitBlocked, exitCliMissing, exitWithCode } from "../utils/exit.mjs"` → `../exit.mjs`（迁后 run-task.mjs）；`bin/cdd.mjs` L27 `./utils/exit.mjs` → 随 Step 4 拆分落到 `lib/cli/{review,branch-review,fix,research,parse}.mjs` 各 exit 助手 import（`../exit.mjs`）；`tests/exit.test.mjs` 引用改写见下方测试侧清单。残留清零由 Step 7 前统一复扫（含 `utils/exit` 形态）断言，见 Step 7。

> **research 两段式命名，消除两张表对中间/终态的名称冲突**：Step 1 迁 `lib/cli/research-core.mjs`（暂名，Step 1 即存在）；Step 4 与 runResearch 合并成 `lib/cli/research.mjs`（终名）。故本步测试改写清单中 research.test.mjs **先指 `../lib/cli/research-core.mjs`**，Step 4 合并后再改指 `../lib/cli/research.mjs`——Step 2 阶段不落到尚不存在的 research.mjs。

执行：`grep -rnE "from ['\"]\.{1,2}/(lib/)?(cli-shared|runner|docs-runner|review-loop|handoff-naming|handoff-finalize|schema-utils|progress|contract|brief|registry|templates|research)\.mjs|(\.\./)?utils/exit\.mjs" lib/ bin/cdd.mjs tests/` 逐条改（**同一模式同时命中 `./` 与 `../` 前缀**——`../utils/exit.mjs`、`../lib/progress.mjs` 等双点形态单靠 `from "./…"` 扫不到必漏；**scope 含 `tests/`**——测试文件 import 随迁移同步；先只更新 Step 1 已移模块的 import；contract/cdd 相关在 Step 3/4 后统一）。

**tests/ 测试侧引用改写清单**（迁移后测试文件从 `tests/` 顶层加载，`../lib/...` 仍指向 `lib/` 但模块名随新家变化；缺该子步则 Step 7 全绿断言不可达）：

| 测试文件 | 现 import / 引用 | 改指 |
|---|---|---|
| contract.test.mjs | `../lib/contract.mjs` | 按符号拆指 `../lib/contract/commit.mjs`（validateCommitContract 等 commit 五）、`../lib/handoff/write.mjs`（write 三件）、`../lib/handoff/finalize.mjs`（状态派生五） |
| handoff-finalize.test.mjs | 自 `../lib/...` 取 `writeOwnHandoff` | `../lib/handoff/write.mjs` |
| runner.test.mjs / progress-owner.test.mjs | `../lib/runner.mjs` | `../lib/runner/run-task.mjs` |
| runner.test.mjs（progress 行） | `../lib/progress.mjs`（L18 `import { getRound }`） | `../lib/state/progress.mjs` |
| progress.test.mjs / progress-owner.test.mjs（progress 行） | `../lib/progress.mjs`（progress.test.mjs L16；progress-owner.test.mjs L12 `readProgressJSON/incrementRecovery`） | `../lib/state/progress.mjs` |
| cli-shared.test.mjs | `../lib/cli-shared.mjs`（L3 `resolveTimeoutMs`） | `../lib/lifecycle/cli.mjs` |
| exit.test.mjs | `../utils/exit.mjs`（L6 `exitOk/exitBlocked/exitCliMissing`） | `../lib/exit.mjs` |
| review-loop.test.mjs | `../lib/review-loop.mjs`（L3）+ `../lib/handoff-naming.mjs`（L4 `resolveNextRound`） | `../lib/runner/review-loop.mjs` + `../lib/handoff/naming.mjs` |
| handoff-naming.test.mjs | `../lib/handoff-naming.mjs`（L8） | `../lib/handoff/naming.mjs` |
| schema-utils.test.mjs / contract.test.mjs（schema-utils 行） | `../lib/schema-utils.mjs`（schema-utils.test.mjs L5；contract.test.mjs L30 `validateHandoffSchema`） | `../lib/handoff/schema.mjs` |
| templates.content.test.mjs | `../lib/handoff-naming.mjs`（L34 动态 import `familyConfig`）（`../lib/templates.mjs` 不变——templates.mjs 仍驻 lib/ 顶层） | `../lib/handoff/naming.mjs` |
| progress-owner.test.mjs（REG_PATH 常量） | 自算 `new URL("../harness-registry.json", import.meta.url)` 且运行时 `readFileSync(REG_PATH)` | Step 5 统一步骤改从 `../lib/registry.mjs` 导入（缺则读取必抛 ENOENT，Step 7 全绿不可达） |
| docs-runner.test.mjs | `../lib/...` 取 runDocs 侧 | `../lib/runner/run-docs.mjs` |
| research.test.mjs | `../lib/...` 取 buildResearchPrompt / writeFindings | 本步先指 `../lib/cli/research-core.mjs`（Step 1 已存在）；Step 4 与 runResearch 合并后再改指 `../lib/cli/research.mjs`（见下两段式命名） |
| cdd.test.mjs / cli-shape.test.mjs | `../cdd.mjs` / `../lib/handoff-naming.mjs` / `../lib/docs-runner.mjs` | 模块级路径本步改（`../lib/handoff/naming.mjs`、`../lib/runner/run-docs.mjs`）；薄入口后的 seam 专项见 Step 4 同步；**cdd.test.mjs 的 `SMOKE_PLAN`（L17 `packages/cdd-engine/bin/tests/fixtures/smoke-plan.md`）→ `packages/cdd-engine/tests/fixtures/smoke-plan.md`**（fixture 已随 Step 1 移顶层；缺则 CLI 黑盒用例加载旧 fixture 必破，Step 7 全绿不可达——cli-shape 的 SMOKE_PLAN/SMOKE_SPEC 已列 Step 4） |

> **tests/ 深度派生引用专项（随 tests 移顶层深度 −1；列举四类否则 Step 7 全绿不可达）**：
> - `cdd-research.test.mjs` L10：`CLI = path.resolve(import.meta.dirname, "../cdd.mjs")` → `../bin/cdd.mjs`（现 2 级指 bin/tests → 1 级落点 bin/）；
> - REPO_ROOT 深度常量 `path.resolve(HERE, '..','..','..','..')`（4 级：cdd.test L15 / cli-shape L13 / host-detection L15 / docs-task L15 / task.test L21 / branch-review.test L15）→ 减一级（3 级）；
> - fixture 分段/绝对形引用：host-detection L17 `PLAN_FIXTURE`（REPO_ROOT + `bin/tests/fixtures` 分段 join）、cli-shape L15/L19 与 docs-task L17 `SMOKE_PLAN` / `SMOKE_SPEC`（segment join）→ `tests/fixtures/...`（覆盖三种 join 形态）；
> - `templates.test.mjs` L44：`new URL('../../templates/review/reviews.json', import.meta.url)` → `../templates/review/reviews.json`（tests/ 1 级深度）。

**本步不追求语法完成——以最终 `node --check` 全过为闭环凭据。**

- [ ] **Step 3: contract.mjs 符号拆分**

`bin/lib/contract.mjs` 现存导出（13 符号全量归位 —— write 三件 + commit 五 + finalize 五，与源码 13 个 export 一致）：

| 符号 | 新家 |
|---|---|
| `writeHandoff` / `writeOwnHandoff` / `readJson` | `lib/handoff/write.mjs` |
| `validateCommitContract` / `gitToplevel` / `gitRevParseHead` / `gitCatFileCommitExists` / `rewriteHandoffBlocked` | `lib/contract/commit.mjs` |
| `normalizeHandoffStatus` / `classifySeverity` / `rollupStatus` / `deriveReviewStatus` / `applyDerivedStatus` | 并入 `lib/handoff/finalize.mjs`（applyDerivedStatus 本为 finalize 消费方，同簇内聚） |

操作：按上表拆三文件（符号体原样拷贝，import 依赖各自收敛）→ `git rm bin/lib/contract.mjs` → 更新全部引用侧 import（消费方：`lib/handoff/finalize.mjs` 取 applyDerivedStatus + gitRevParseHead（来自 commit.mjs）+ write 三件；`lib/runner/run-task.mjs` 取 write 三件 + gitToplevel/validateCommitContract + normalizeHandoffStatus；`lib/brief.mjs` 取 gitRevParseHead/gitToplevel）。断言各消费方 import 在新树可解析（`node --check`）。

- [ ] **Step 4: cdd.mjs 薄入口化（lib/cli/ 拆分）**

现有 `bin/cdd.mjs`（573 行）按 spec §2.3 布局拆分：

- `lib/cli/review.mjs`：`runReview`（task/branch/spec/plan 四型派发）+ 共享守卫助手（`requireHostHarness` L59 / `detectCurrentHarness` L50 / `resolveTargetDoc` L66 / `reviewStoppingGuard` L124 / `existingRoundHandoff` L89 / `blockerCount` L96 / `stoppedExit3` L106 / `intTask` L78——实际区间 L59-131）——全部顶部导出供 fix/research/parse 复用。**L33-48（`usageError` / `SUBCOMMAND_USAGE`）归 parse.mjs，不属本簇**（消除区间双归属）。
- `lib/cli/branch-review.mjs`：`runBranchReview` + `writeBranchBlocked`。
- `lib/cli/fix.mjs`：`runFix`。
- `lib/cli/research.mjs`：`runResearch`（原 L412-476）+ 并入 `lib/cli/research-core.mjs` 的 `buildResearchPrompt` / `writeFindings` / `RESEARCH_METHODOLOGY`（research-core 可删，符号并入本文件）。
- `lib/cli/parse.mjs`：commander program（`new Command()` 起，L480-573 至 EOF）+ 全部子命令注册与 action（含 implement 动作走 `runTask`）+ `usageError` / `SUBCOMMAND_USAGE` / parse 错误归一（`exitOverride`）。
- `bin/cdd.mjs` 收敛为薄入口：shebang + `import { program } from "../lib/cli/parse.mjs"` + `program.parseAsync()` + isMain 守卫。**零命令定义。**

同步测试 seam（薄入口化后两类 seam 随迁，缺失则 Step 7 全绿不可达）：

- `tests/host-detection.test.mjs`：`import { detectCurrentHarness } from "../cdd.mjs"` → 改指 `../lib/cli/review.mjs`。
- `tests/cdd.test.mjs`：L329/L354 `await import("../cdd.mjs")` 取 `{runReview, runFix}`（薄入口零导出必 break）→ 分别改指 `../lib/cli/review.mjs` / `../lib/cli/fix.mjs`；L68 `vi.mock("../lib/docs-runner.mjs")` → 改指 `../lib/runner/run-docs.mjs`（解析 id 与 review.mjs 内 `../runner/run-docs.mjs` 一致）。
- `tests/cli-shape.test.mjs`：D11 静态源断言 `readFileSync(CDD_MJS)`（4 处引用：L14 常量 + L37 exec + L48/L55 静态读，薄入口零命令定义必红）→ 引入 `PARSE_MJS = lib/cli/parse.mjs`、静态源改读 parse.mjs（命令定义已移此；exec 入口 `CDD_MJS` 仍 `bin/cdd.mjs` 不变）；`SMOKE_PLAN` / `SMOKE_SPEC` → `tests/fixtures/smoke-plan.md` / `smoke-spec.md`；`afterAll` rmSync 的 workspace 路径（`.superpowers/cdd/smoke-plan` / `smoke-spec`）形态不变，随 SMOKE_* 常量同步核对。
- `npm` bin 字段无需改（`./bin/cdd.mjs` 路径不变）。

- [ ] **Step 5: tests 迁移收尾 + 路径常数复算**

- 测试侧 REG_PATH 统一（registry 与 progress-owner 两处同形常量一并改）：`tests/registry.test.mjs` 与 `tests/progress-owner.test.mjs`（同一 `REG_PATH = new URL("../harness-registry.json", import.meta.url)` 常量，后者在用例中运行时 `readFileSync(REG_PATH)` 读该文件）在新深度（tests/ 1 级）均指向不存在的 `packages/cdd-engine/harness-registry.json`（文件已随 Step 1 入 `lib/`）必坏 → **两文件均改从 `../lib/registry.mjs` 导入统一 `REG_PATH`**（本步先落地统一导出，见下）。
- `lib/registry.mjs`：导出统一 `REG_PATH`（`fileURLToPath(new URL("harness-registry.json", import.meta.url))`，与 `lib/harness-registry.json` 相邻）；消费方并列断言：`lib/runner/run-task.mjs` / `lib/cli/review.mjs`（含原 runBranchReview）/ **`lib/cli/research.mjs`（cdd.mjs L429 `loadRegistry(process.env.CDD_REGISTRY_PATH || REG_PATH)` 使用点，迁后 `./harness-registry.json` 落 lib/cli/ 下必坏——运行时 ENOENT 使 `cdd research` 功能性失败）** 改从 `../registry.mjs` 导入（`lib/cli/` 内为 `../registry.mjs`）。
- fixtures 路径：`tests/fixtures/smoke-plan.md` / `smoke-spec.md`（Step 1 已 mv）——引用方改为 `tests/fixtures/...`。
- `lib/templates.mjs` 的 `PKG_ROOT`（现 `path.resolve(__dirname,'..','..')` 深 2 级）→ 改以 `import.meta.url` 相对 `../templates/` 重写：`const PKG_ROOT = fileURLToPath(new URL("../templates", import.meta.url))`（消除深度耦合），并保留 `templates.content.test.mjs` 全套测试作绿灯凭据。
- `lib/handoff/schema.mjs`（原 schema-utils.mjs）PKG_ROOT 深度不变（bin/lib ↔ lib/handoff 均 2 级）——复算确认 `../../templates/` 正确，显式断言。

- [ ] **Step 6: package.json + .npmignore + validate 套件同步**

- `package.json#files`：`["bin/","templates/"]` → `["bin/","lib/","templates/"]`。
- `.npmignore`：仅删 `bin/tests/`（tests 移顶层）；**保留 `**/.gitkeep`**——`bin/.gitkeep` / `bin/lib/.gitkeep` 仍驻 bin/lib 目录族（Step 3 后 bin/lib/ 以 gitkeep 标记保持目录族版本控制），files 白名单（`["bin/","lib/","templates/"]`）下若无该排除，空目录标记会随包发布（实测 `npm pack` tarball 含 `bin/.gitkeep`）——该条是活过滤器而非死条目；隔离由 `files` 白名单 + `**/.gitkeep` 双承担（spec §2.3 定案）。
- `scripts/validate/residue.mjs`：**全部机制位置 scope 常量统一扩为 bin+lib+templates**（re-org 后机制文件移入 `lib/`，仅扩 `RESIDUE_TARGETS` 则 stale-lexicon / gate-lexicon 对 engine 覆盖静默缩小，spec AC4「residue 机制位置 → bin+lib+templates」只兑现一半）：
  - `CDD_ENGINE_BIN`：`["packages/cdd-engine/bin"]` → `["packages/cdd-engine/bin","packages/cdd-engine/lib"]`；
  - 派生族 `CDD_ENGINE`（=`[...CDD_ENGINE_BIN, "packages/cdd-engine/templates"]`）、`ALL_MECH_POSITIONS`（=`[...OSKILLS, ...CDD_ENGINE]`）、`RESIDUE_TARGETS` 随之 → bin+lib+templates；
  - `GATE_TARGETS`（=`[...CDD_ENGINE_BIN, ...OSKILLS, "docs/maintainers", "README.md"]`）随之 → bin+lib + osuperpowers + docs/maintainers + README；
  - `lib/` 不含 cli-shape 等自称豁免的测试文件（tests/ 已移顶层天然出域）、templates/ 已含在 CDD_ENGINE 旧 scope，扩宽零误报风险；注释同步；
  - 核对 `packages/osuperpowers/tests/ci-validate.test.mjs` wiring guard 对 grepTargets 的断言集（现为 `includes("packages/cdd-engine/bin")` + `includes("packages/cdd-engine/templates")` + osuperpowers 两条，无全等断言，加 `lib` 不破坏）——并补 `includes("packages/cdd-engine/lib")` 断言钉死新位置。
- `scripts/validate/smoke-cdd.mjs`：① entry `packages/cdd-engine/bin/cdd.mjs` 不变（薄入口仍在此）；② fixture 路径 → `packages/cdd-engine/tests/fixtures/smoke-plan.md`；③ `checkDeletionSurface` 的 `ENGINE` 作用域 const → `["packages/cdd-engine/bin","packages/cdd-engine/lib"]`（G2 --harness 词表随 parse.mjs 移入 lib/）；④ G3 --doc 扫描的独立单文件路径 `path.join("packages","cdd-engine","bin","cdd.mjs")` → 改指 `lib/cli/parse.mjs`。

- [ ] **Step 7: 全量验证 + commit**

```bash
cd /Users/kang/Projects/oscaner-skills
# 残留复扫（旧扁平路径 / 旧 fixture 引用清零；任一 grep 有输出则 Step 7 全绿断言不成立——缺该子步
# 则 cli-shared/exit/progress/review-loop/handoff-naming/schema-utils/contract/utils 的漏改 import
# 在测试跑动时才炸，按清单字面执行不可达"23 文件 301 用例全绿"）：
grep -rnE "from ['\"]\.\.?/(lib/)?(cli-shared|runner|docs-runner|review-loop|handoff-naming|handoff-finalize|schema-utils|progress|contract|research)\.mjs|\.\./utils/exit\.mjs" lib/ bin/cdd.mjs tests/   # 期望零输出
grep -rn "packages/cdd-engine/bin/tests/fixtures" tests/   # 期望零输出（SMOKE_PLAN/SMOKE_SPEC 已改 tests/fixtures；单字符串字面量形）
grep -rnE "['\"]packages['\"]\s*,\s*['\"]cdd-engine['\"]" tests/   # 期望零输出（segment/path.join 分形 fixture 引用清零）
grep -rnE "new URL\('\.\./(\.\./)+templates|path\.resolve\(HERE, '\.\." tests/   # 期望零输出（templates.test URL 深度 / REPO_ROOT 级数残留）
grep -rn "\.\./cdd\.mjs\|\.\./utils/" tests/   # 期望零输出（cdd-research CLI 入口 / exit 助手旧路径）
pnpm -C packages/cdd-engine test   # 既有 23 文件 301 用例全绿（新布局）
pnpm run validate                  # 12 块全绿（residue/smoke 新路径断言通过）
npm pack --dry-run --prefix packages/cdd-engine 2>&1 | grep -c "tests/"   # = 0：tests 不再随包发布
git add -A packages/cdd-engine scripts/validate/residue.mjs scripts/validate/smoke-cdd.mjs
git commit -m "refactor(cdd-engine): directory re-org — thin bin entry + lib clusters (lifecycle/runner/handoff/contract/state/cli) + top-level tests, npm publish no longer ships tests"
```

Expected: 全部绿。若 vitest 因测试文件位置变化发现不了 → 检查 `vitest.config.mjs` include（默认 glob 覆盖 `**/*.test.mjs`，位置无关，无需改）。

---

### Task 2: Process-Lifecycle Manager（`lib/lifecycle/proc.mjs` + `lib/lifecycle/cli.mjs`）

<thinking>原子单元：新生命周期核心模块（spawnManaged / teardownAll / reapStale / reapDone + idle 监视 / registry 双写）+ cli.mjs 重构（spawn 底层经 proc.mjs）+ 配套单测。这是 P1 的心脏——进程组隔离 + 统一回收点 + 进程内 idle 监视 + 跨 run 兜底四者同文件实现（spec §2.2 A-D），单测用真进程树验证。测试先行（red→green）。</thinking>

**Files:**
- Create: `packages/cdd-engine/lib/lifecycle/proc.mjs`
- Modify: `packages/cdd-engine/lib/lifecycle/cli.mjs`（ex cli-shared.mjs，spawn 底层改经 proc.mjs；删除 spawnCapture 薄封装）
- Modify: `packages/cdd-engine/lib/cli/research.mjs`（spawnCapture 删除的同步消费方改写：runResearch 直调 spawnManaged + markAllDispatchesDone——见 Step 3）
- Create: `packages/cdd-engine/tests/lifecycle.proc.test.mjs`
- Create: `packages/cdd-engine/tests/fixtures/proc-oracle-engine.mjs`（跨 run 父死回收测试的外部引擎 fixture）
- Modify: `packages/cdd-engine/tests/runner.test.mjs`（spawnCapture 用例改指 spawnManaged）

**Interfaces:**
- Consumes: Task 1 的新布局；execa（已依赖）
- Produces: `spawnManaged(command, args, opts)` → `{ok, code, stdout, stderr, timedOut}`（五字段不变）；`teardownAll({graceMs})`；`reapStale({graceMs})`（跨 run 孤儿兜底）；`markAllDispatchesDone()` / `startIdleMonitor({intervalMs})` / `stopIdleMonitor()` / `reapDone({graceMs})`（进程内 idle 监视）；`persistRegistry()` / `initProcLifecycle({diskPath})`——Task 3 接线消费方

> **registry 条目字段登记**（与 spec §2.2 A 定案一致）：`{ pgid, label, createdAt, ownerPid, done }`——弃设计初稿的 `dispatch` 字段（类型/结束语义在回收决策中被 `pgidAlive` 消费覆盖，`createdAt`+`label` 已足诊断），增 `ownerPid`（跨 run 孤儿判定：`ownerPid ≠ process.pid` 即视为引擎已换/被杀）与 `done`（dispatch 已返回，供 idle 监视 `reapDone` 回收）。条目仅在 `spawnManaged` 的 execa dispatch resolve 后写入——registry 恒为「dispatch 已返回」集合，idle 监视波及不到 in-flight 组。overall v1.6 / spec v1.1 已登记，本计划不另造字段。

- [ ] **Step 1: 写失败测试（red）**

创建 `tests/lifecycle.proc.test.mjs`：

```js
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { spawn, execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const TESTS_DIR = path.dirname(fileURLToPath(import.meta.url));

// 延迟导入，便于每用例重建 registry 状态
let proc;
async function loadModule() {
  proc = await import("../lib/lifecycle/proc.mjs");
}

const markerAlive = m => Number(execSync(`pgrep -f ${m} | wc -l`).toString().trim());
const waitFor = async (fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn()) return; await new Promise(r => setTimeout(r, 100)); } throw new Error("waitFor timeout"); };

describe("proc-lifecycle spawnManaged", () => {
  beforeEach(async () => {
    await loadModule();
    proc.__resetForTest?.();
    proc.initProcLifecycle({ diskPath: path.join(os.tmpdir(), `p1lifecycle-${process.pid}.json`) });
  });
  afterEach(async () => { await proc.teardownAll(); });

  it("派生组触发隔离：teardownAll 后孙进程必死", async () => {
    // child 触发孙进程（P1LLWC 标记）后驻留——组内后代验证
    const script = `const{spawn}=require('child_process');spawn(process.execPath,['-e','setTimeout(()=>{},60000)','P1LLWC']).unref();setInterval(()=>{},10000)`;
    const r = await proc.spawnManaged("node", ["-e", script], { timeoutMs: 5000 });
    expect(typeof r.code).toBe("number");
    const before = execSync("pgrep -f P1LLWC | wc -l").toString().trim();
    expect(Number(before)).toBeGreaterThan(0);
    await proc.teardownAll({ graceMs: 500 });
    const after = execSync("pgrep -f P1LLWC | wc -l").toString().trim();
    expect(Number(after)).toBe(0);
  });

  it("teardownAll 后 registry 为空", async () => {
    await proc.spawnManaged("sleep", ["10"], {});
    await proc.teardownAll();
    expect(proc.__registryForTest().length).toBe(0);
  });

  it("reapStale 对已消失组 fail-open", async () => {
    await proc.spawnManaged("sleep", ["0.1"], {});
    await new Promise(r => setTimeout(r, 300));   // 组已自然退出
    await expect(proc.reapStale()).resolves.toBeUndefined();  // 不抛
  });

  it("reapStale 对存活超时组执行回收（非仅 fail-open）", async () => {
    // P1LLWC 派生孙组后 leader 退出 → 组存活留 registry；reapStale 走 stale 分支连根回收
    const script = `const{spawn}=require('child_process');spawn(process.execPath,['-e','setTimeout(()=>{},60000)','P1LLWC']).unref();process.exit(0)`;
    await proc.spawnManaged("node", ["-e", script], { timeoutMs: 5000 });
    expect(markerAlive("P1LLWC")).toBeGreaterThan(0);
    await proc.reapStale({ graceMs: 500 });
    expect(markerAlive("P1LLWC")).toBe(0);
  });

  it("reapDone 清 dispatch 已返回仍存活组（idle 监视语义）", async () => {
    const script = `const{spawn}=require('child_process');spawn(process.execPath,['-e','setTimeout(()=>{},60000)','P1LLWC']).unref();process.exit(0)`;
    await proc.spawnManaged("node", ["-e", script], { timeoutMs: 5000 });
    await proc.markAllDispatchesDone();            // dispatch 返回 → 组标 done
    expect(proc.__registryForTest().every(g => g.done)).toBe(true);
    await proc.reapDone({ graceMs: 500 });
    expect(markerAlive("P1LLWC")).toBe(0);
    expect(proc.__registryForTest().length).toBe(0);
  });

  it("跨 run 父死回收：外部引擎落盘 registry 被 SIGKILL → 新 proc 实例 reapStale 连根回收", async () => {
    const disk = path.join(os.tmpdir(), `p1oracle-${process.pid}-${Date.now()}.json`);
    // 1) 独立引擎子进程（tests/fixtures/proc-oracle-engine.mjs）：initProcLifecycle(disk) →
    //    spawnManaged 派生标记驻留组（P1ORPHAN）→ persistRegistry → 引擎驻留模拟「引擎被杀前仍活着」
    const engine = spawn(process.execPath, [path.join(TESTS_DIR, "fixtures", "proc-oracle-engine.mjs"), disk]);
    await waitFor(() => markerAlive("P1ORPHAN") > 0, 8000);
    expect(JSON.parse(readFileSync(disk, "utf8"))[0].ownerPid).toBe(engine.pid);
    engine.kill("SIGKILL");                        // 模拟引擎被杀：无 teardown 执行
    await new Promise(r => setTimeout(r, 500));
    // 2) 本进程以新 proc 模块实例回收（ownerPid 异 → 命中 orphans 分支）
    await proc.initProcLifecycle({ diskPath: disk });
    await proc.reapStale({ graceMs: 500 });
    expect(markerAlive("P1ORPHAN")).toBe(0);       // 孤儿组（含孙代 session server）被连根收回
  });
});
```

Run: `pnpm -C packages/cdd-engine test -- lifecycle.proc`
Expected: FAIL（`proc.mjs` 不存在 → import 失败）。macOS 无 `/proc` 影响：守护断言用 `pgrep -f`（已用）；若 CI/macOS 环境隔离不可用，对进程组/信号/跨 run 用例加 `describe.skipIf(process.platform !== "darwin")` 保护并注明。`tests/fixtures/proc-oracle-engine.mjs` fixture 随后创建：

```js
// tests/fixtures/proc-oracle-engine.mjs — 独立「引擎」：模拟被 SIGKILL 前已落盘 registry 的外部引擎进程
import { initProcLifecycle, spawnManaged, persistRegistry } from "../../lib/lifecycle/proc.mjs";
const disk = process.argv[2];
await initProcLifecycle({ diskPath: disk });
await spawnManaged(process.execPath, ["-e", "const{spawn}=require('node:child_process');spawn(process.execPath,['-e','setTimeout(()=>{},60000)','P1ORPHAN']).unref();process.exit(0)"], { timeoutMs: 5000 });
await persistRegistry();
setInterval(() => {}, 60_000);   // 引擎驻留——测试以 SIGKILL 模拟被杀（无 teardown 路径可走）
```

- [ ] **Step 2: 实现 `lib/lifecycle/proc.mjs`（green）**

```js
// packages/cdd-engine/lib/lifecycle/proc.mjs — Process-Lifecycle Manager.
// 引擎全部派生点的出生与回收单点：spawnManaged（detached 进程组 + run 级 registry）
// / teardownAll（run 边界 + CLI 信号连根回收）/ reapDone（进程内 idle 监视低频回收）
// / reapStale（跨 run 孤儿兜底）。registry 双写内存 + 落盘（.superpowers/cdd/lifecycle.json），
// 父死场景由下次启动跨 run 扫回。
import { execa } from "execa";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";

const KILL_SIGNAL = "SIGTERM";
const FORCE_SIGNAL = "SIGKILL";

// ---- registry（内存 + 落盘双写）----
// 条目 { pgid, label, createdAt, ownerPid, done } —— ownerPid 支撑跨 run 孤儿判定、
// done = dispatch 已返回（idle 监视回收依据）。弃设计初稿的 dispatch 字段（spec §2.2 A v1.1 定案）。
let registry = [];            // [{ pgid, label, createdAt, ownerPid, done }]
let diskPath = "";            // initProcLifecycle 设置；未设置则不落盘（测试内省态）
let idleTimer = null;

export function initProcLifecycle({ diskPath: dp }) {
  diskPath = dp ?? "";
}

export function __registryForTest() { return registry; }
export function __resetForTest() { registry = []; stopIdleMonitor(); }

export async function persistRegistry() {
  if (!diskPath) return;
  try {
    mkdirSync(path.dirname(diskPath), { recursive: true });
    writeFileSync(diskPath, JSON.stringify(registry, null, 2) + "\n");
  } catch { /* 落盘失败 fail-open：下一 run 靠 ps 扫描兜底 */ }
}

function pgidAlive(pgid) {
  try { process.kill(-pgid, 0); return true; } catch { return false; }
}

function killGroup(pgid, signal) {
  try { process.kill(-pgid, signal); } catch { /* 组已亡：幂等 */ }
}

function cleanEnv(env) {
  const e = { ...env };
  delete e.CLAUDE_CODE_SUBAGENT_MODEL;
  delete e.ANTHROPIC_API_KEY;
  return e;
}

// 统一工厂：detached 进程组 + 注册。保持五字段契约 {ok, code, stdout, stderr, timedOut}。
export async function spawnManaged(command, args, opts = {}) {
  const { cwd, env, timeoutMs } = opts;
  const res = await execa(command, args, {
    cwd,
    env: cleanEnv(env ?? process.env),
    timeout: timeoutMs,
    forceKillAfterDelay: 5000,
    detached: true,            // 独立进程组：pgid = 子 PID，孙代同组
    reject: false,
    all: false,
  });
  registry.push({
    pgid: res.pid,
    label: `${command} ${(args ?? []).join(" ")}`.slice(0, 80),
    createdAt: Date.now(),
    ownerPid: process.pid,
    done: false,
  });
  await persistRegistry();
  const timedOut = res.timedOut ?? false;
  return { ok: res.exitCode === 0 && !timedOut, code: res.exitCode ?? 1, stdout: res.stdout ?? "", stderr: res.stderr ?? "", timedOut };
}

// dispatch（含 retry 的每个 attempt）返回后调用：组标 done，供 idle 监视 reapDone 回收。
// registry 恒为「dispatch 已返回」集合（spawnManaged 在 execa resolve 后才 push）。
// **显式不变式（spec §2.2 C，lifecycle 层集中此语义）**：派发严格串行——任一时刻 in-flight
// 组至多一批（invokeCli 每 dispatch 单 spawn）。「全量标记 = 标记刚返回的这批组」仅在该不变式
// 下成立；未来若引入重迭派发，须改按 spawnManaged 返回的组标识精确标 done，否则进程内 idle
// 监视的 reapDone 会误标并连根回收 in-flight 组。断言在打破不变式时立即炸出，而非静默泄漏。
export function markAllDispatchesDone() {
  const inFlight = registry.filter(g => !g.done);
  if (inFlight.length > 1) {
    throw new Error(
      "CDD_ASSERT: markAllDispatchesDone assumes strictly serial dispatch — " +
      `${inFlight.length} in-flight groups (concurrency requires pgid-exact marking)`);
  }
  for (const g of inFlight) g.done = true;
  if (registry.length) { void persistRegistry(); }
}

// 回收一组：SIGTERM → 宽限（cap 1s/组）→ SIGKILL；组已亡幂等。
async function reapGroup(g, graceMs) {
  if (!pgidAlive(g.pgid)) { g.done = true; return; }
  killGroup(g.pgid, KILL_SIGNAL);
  await new Promise(r => setTimeout(r, Math.min(graceMs, 1000)));
  killGroup(g.pgid, FORCE_SIGNAL);
  g.done = true;
}

// 统一回收点：SIGTERM → 宽限 graceMs → SIGKILL，批内全部组；registry 清空（幂等、reentrant）。
// 抛错不吞主流程（spec §2.5）：内部 catch 全部异常 + stderr 记录，调用方流程不受影响。
export async function teardownAll({ graceMs = 5000 } = {}) {
  const groups = [...registry];
  registry = [];
  try {
    for (const g of groups) killGroup(g.pgid, KILL_SIGNAL);
    if (graceMs > 0) await new Promise(r => setTimeout(r, graceMs));
    for (const g of groups) killGroup(g.pgid, FORCE_SIGNAL);
    await persistRegistry();
  } catch (err) {
    process.stderr.write(`CDD_WARN: teardownAll partial failure: ${err?.message ?? err}\n`);
  }
}

// 进程内 idle 监视（spec §2.2 C / §2.4）：run 入口 startIdleMonitor 启动低频定时器，
// 周期 reapDone 清 done+存活组——长 run 中 retry 失败 attempt / 残留 server 不等到 run 边界。
export function startIdleMonitor({ intervalMs = 30_000 } = {}) {
  if (idleTimer) return;                 // 幂等：已启动 no-op
  idleTimer = setInterval(() => {
    reapDone({ graceMs: 1000 }).catch(err =>
      process.stderr.write(`CDD_WARN: reapDone tick failed: ${err?.message ?? err}\n`));
  }, intervalMs);
  idleTimer.unref?.();
}

export function stopIdleMonitor() {
  if (idleTimer) { clearInterval(idleTimer); idleTimer = null; }
}

// 回收 done 且存活的组（idle 监视语义）；注销 + 落盘。
export async function reapDone({ graceMs = 1000 } = {}) {
  const targets = registry.filter(g => g.done);
  for (const g of targets) await reapGroup(g, graceMs);
  registry = registry.filter(g => !g.done);
  await persistRegistry();
}

// 跨 run 孤儿兜底 + 存活超时组清理：读落盘 registry，两类——
// orphans（foreign AND owner 确证已死 = 引擎被杀；并发引擎在途组经 owner liveness 排除，branch-review warn 4）
// + stale（owner → 本进程，dispatch 已返回仍存活）。
// 引擎启动时调用兜上次 SIGKILL 残留；组 leader 已死而组仍存活者在此连根回收。
export async function reapStale({ graceMs = 5000 } = {}) {
  let pending = [];
  try {
    if (diskPath && existsSync(diskPath)) {
      pending = JSON.parse(readFileSync(diskPath, "utf8")) ?? [];
    }
  } catch { pending = []; }
  // 语义：orphans 与 stale 两集合交汇后统一连根回收（组内全部进程随 pgid 清除）。
  const orphans = pending.filter(g => g.ownerPid !== process.pid && !pidAlive(g.ownerPid));
  const stale = pending.filter(g => g.ownerPid === process.pid && pgidAlive(g.pgid));
  const targets = [];
  for (const g of [...orphans, ...stale]) {
    if (pgidAlive(g.pgid)) {
      killGroup(g.pgid, KILL_SIGNAL);
      await new Promise(r => setTimeout(r, Math.min(graceMs, 1000)));
      killGroup(g.pgid, FORCE_SIGNAL);
      targets.push(g);
    }
  }
  await waitForDeath(targets, 2000);
  // 收完写回：仅保留「尚未确认消亡」条目（SIGKILL 未遂 / D-state）供下次启动再兜 —— 语义定案 71d8952。
  const survivors = pending.filter(g => pgidAlive(g.pgid));
  if (diskPath) {
    try { writeFileSync(diskPath, JSON.stringify(survivors, null, 2) + "\n"); } catch {}
  }
}
```

> 说明：`pgid` 复用风险（PID 重用）由 `ownerPid + createdAt` 双字段缓解；未命中即 fail-open。`reapStale` 过滤语义：`orphans`（ownerPid 非本进程）+ `stale`（本进程 dispatch 已返回仍存活）两集合交汇，跨 run 孤儿与超时残余一并连根回收；`reapDone` 为 idle 监视专用变体（仅清 `done` 已标且存活组）。

- [ ] **Step 3: `lib/lifecycle/cli.mjs` 重构（spawn 底层经 proc.mjs）**

保留 `cli-shared.mjs` 的导出面与五字段契约，spawn 底层改调 proc.mjs：

```js
// packages/cdd-engine/lib/lifecycle/cli.mjs — invoke 契约层（ex cli-shared.mjs）。
// 注入/超时/重试/NDJSON 解析保留；spawn 派生统一收敛到 spawnManaged（proc.mjs）。
import { resolveInjection, resolveSuffix } from "../registry.mjs";
import { spawnManaged, markAllDispatchesDone } from "./proc.mjs";
// ...（resolveTimeoutMs / scaleToMs / MAX_TIMEOUT_MS / extractStreamJsonFinal 原样保留）...

// 不保留 spawnCapture 薄封装（spec §2.2 D：合并原 spawnCapture 后无透传层）——
// invoke 路径全部直调 spawnManaged，本文件不再有第二出生点。

export async function invokeCli(entry, prompt, params, env, cwd, timeoutMs) {
  // ... 与现实现一致，仅将底层派生换成 spawnManaged ...
  const res = await spawnManaged(cli, args, { cwd, env: cleanEnv(env ?? process.env), timeoutMs });
  markAllDispatchesDone();      // dispatch（含 retry 每 attempt）返回 → 组标 done（spec §2.2 C idle 监视依据）
  // ... stream-json 分支不变 ...
}
```

`cleanEnv` 若原 cli-shared.mjs 已定义则随迁（本文件内部副本）；proc.mjs 内部另有剥离（双保险）。

**出入 seam 同步**（`spawnCapture` 删除后）：
- `lib/runner/run-task.mjs`：删原 `re-export { spawnCapture }`（ex bin/lib/runner.mjs 外部暴露面，测试经其转出）；runner 直调点改 `spawnManaged`（见 Task 3 Step 2）。
- `lib/cli/research.mjs`：**spawnCapture 的直接消费方，须与 cli.mjs 删导出同一步改写**——`runResearch` 原 `spawnCapture(cli, cliArgs, ...)` → `spawnManaged(cli, cliArgs, ...)`（import 换源 `../lifecycle/proc.mjs`）+ dispatch 返回后 `markAllDispatchesDone()`。**若两项拆到 Task 3 Step 3 才做**，则 Task 2 提交后 `lib/cli/parse.mjs` 顶层 `import { runResearch } from "./research.mjs"` → 命名导出因模块加载 `spawnCapture` 缺失直接失败（模块级 import 缺失导出 = 模块链接期抛 SyntaxError，整个模块图加载失败）→ 全部 `cdd <subcommand>` CLI 不可用，cdd-research / cdd.test CLI 黑盒 / cli-shape smoke / task / docs-task / branch-review 六组测试在 Task 2 提交后集体红，违反每任务结束前 validate 全绿。故改写必须提前至此步。
- `tests/runner.test.mjs`：L17 `import { spawnCapture, buildTaskEnv } from "../lib/runner.mjs"` → `buildTaskEnv` 改自 `../lib/runner/run-task.mjs`；L403/L411 两例 spawnCapture env 剥离断言 → import `spawnManaged`（from `../lib/lifecycle/proc.mjs`），断言语义不变（CLAUDE_CODE_SUBAGENT_MODEL / ANTHROPIC_API_KEY 剥离、CDD_CUSTOM_VAR 保留）。

- [ ] **Step 4: 跑测试验证 green**

Run: `pnpm -C packages/cdd-engine test -- lifecycle.proc`
Expected: 六条用例全过（进程组/信号/跨 run 用例需 macOS/Linux 进程组环境；否则 skip 并注明）。随后全量 `pnpm -C packages/cdd-engine test` 既有 23 文件仍绿 + 新增 `lifecycle.proc` 全绿（cli.mjs 重构 + research.mjs 直调改写未破坏 invoke 契约；runner.test env 剥离两例经 `spawnManaged` 仍绿；cdd-research / cdd.test CLI 黑盒 / cli-shape smoke 等消费 spawnCapture→spawnManaged 的六组测试不再因命名导出缺失集体红——见 Step 3 的 research.mjs 同步改写）。

- [ ] **Step 5: commit**

```bash
cd /Users/kang/Projects/oscaner-skills
pnpm run validate                  # Global Constraints「每任务结束前 validate 全绿」；本品类未触 emit/skills/docs 输入面，全量以 engine vitest + residue/smoke 断言为准
git add -A packages/cdd-engine
git commit -m "feat(cdd-engine): process-lifecycle manager — spawnManaged detached process groups + teardownAll/reapStale + disk-persisted registry (F1)"
```

---

### Task 3: 全派生点 wiring + CLI 信号 + 跨 run 启动回收 + 架构守卫

<thinking>原子单元：五派生点全部经 spawnManaged/生命周期接线（spawnCapture 直接消费方仅剩 runner review-package bash 改直调——research 直调已在 Task 2 Step 3 随 cli.mjs 删导出同一步完成）+ run 入口 idle 监视 + finally teardownAll + CLI SIGINT/SIGTERM/SIGHUP handler + 启动跨 run reapStale + registry 落盘路径 init + 架构违例守卫测试。Task 2 提供核心，本任务让引擎真实持有它。</thinking>

**Files:**
- Modify: `packages/cdd-engine/lib/runner/run-task.mjs`（review-package bash 直调 → spawnManaged；runTask 入口 startIdleMonitor + finally stopIdleMonitor/teardownAll）
- Modify: `packages/cdd-engine/lib/cli/review.mjs` / `lib/cli/branch-review.mjs` / `lib/cli/fix.mjs` / `lib/cli/research.mjs`（runRunner 出口 finally + idle 监视；research 直调 spawnManaged + markAllDispatchesDone 已在 Task 2 Step 3 完成，本任务仅补研究出口 finally → stopIdleMonitor + teardownAll，见 Step 3）
- Modify: `packages/cdd-engine/lib/runner/run-docs.mjs`（finally → stopIdleMonitor + teardownAll）
- Modify: `packages/cdd-engine/bin/cdd.mjs`（initProcLifecycle + 启动 reapStale + 信号 handler）
- Create: `packages/cdd-engine/tests/lifecycle.wiring.test.mjs`（架构违例守卫 + CLI 信号路径）

**Interfaces:**
- Consumes: Task 2 的 `spawnManaged` / `teardownAll` / `reapStale` / `reapDone` / `markAllDispatchesDone` / `startIdleMonitor` / `stopIdleMonitor` / `initProcLifecycle`
- Produces: 引擎全派生生命周期强制接线；`bin/cdd.mjs` 信号安全的 CLI 出口

- [ ] **Step 1: 写架构违例守卫测试（red）**

创建 `tests/lifecycle.wiring.test.mjs`：

```js
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, rmSync, writeFileSync, mkdtempSync } from "node:fs";
import { spawn, execSync } from "node:child_process";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const LIB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "lib");
const REPO_ROOT = path.resolve(LIB, "..", "..", "..");
const alive = m => Number(execSync(`pgrep -f ${m} | wc -l`).toString().trim());
const waitFor = async (fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn()) return; await new Promise(r => setTimeout(r, 100)); } throw new Error("waitFor timeout"); };

describe("架构违例守卫：引擎全部派生经 spawnManaged", () => {
  it("execa 直接 import 仅允许出现在 lib/lifecycle/proc.mjs", () => {
    const files = readdirSync(LIB, { recursive: true }).filter(f => String(f).endsWith(".mjs"));
    const offenders = [];
    for (const f of files) {
      const src = readFileSync(path.join(LIB, f), "utf8");
      // 仅匹配真实 import 语句（`import ... from "execa"`）——注释/文档中的 "execa" 字样不当 offenders，
      // 否则 cli.mjs 等派生点注释提及 execa 历史（迁移叙事、spawnCapture 说明）会造成误伤。
      if (/^\s*import\b[^;]*\bfrom\s*["']execa["']/m.test(src) && f !== "lifecycle/proc.mjs") {
        offenders.push(`${f}: ${src.match(/^\s*import\b[^;]*execa[^;]*;?/m)?.[0]?.trim() ?? "execa import"}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("全部引擎派发出口含 teardownAll + idle 监视接线", () => {
    // runner.runTask 与 docs-runner 的 finally/return 路径须调用 teardownAll；run 入口须装 idle 监视
    const runTask = readFileSync(path.join(LIB, "runner", "run-task.mjs"), "utf8");
    const runDocs = readFileSync(path.join(LIB, "runner", "run-docs.mjs"), "utf8");
    const cliMjs = readFileSync(path.join(LIB, "lifecycle", "cli.mjs"), "utf8");
    expect(runTask).toMatch(/teardownAll/);
    expect(runTask).toMatch(/startIdleMonitor/);       // §2.2 C 进程内 idle 监视
    expect(runDocs).toMatch(/teardownAll/);
    expect(cliMjs).toMatch(/markAllDispatchesDone/);   // dispatch 返回落 done
    expect(cliMjs).not.toMatch(/^(?:export|const)[^\n]*spawnCapture/m);  // §2.2 D 无死导出（注释提及不受影响）
  });

  it.each([["SIGINT", 130], ["SIGTERM", 143], ["SIGHUP", 129]])(
    "CLI 信号安全出口 %s → teardownAll 连根回收 + 退出码 %i（128+signo）",
    async (sig, expectCode) => {
    // 用 PATH 遮蔽 harness（既有技术：cdd.test.mjs 以 PATH 遮蔽 registry cli 名）→ 真实 dispatch
    // 经 spawnManaged 派生 P1SIG 标记驻留组；对 bin/cdd.mjs 发 %s 断言组连根退出（三信号全覆盖，spec §2.6）。
    const stubDir = mkdtempSync(path.join(os.tmpdir(), "p1-stub-"));
    writeFileSync(path.join(stubDir, "claude"),
      `#!/usr/bin/env bash\nnode -e "const{spawn}=require('node:child_process');spawn(process.execPath,['-e','setTimeout(()=>{},60000)','P1SIG']).unref();setInterval(()=>{},1000)"`,
      { mode: 0o755 });
    const child = spawn(process.execPath, [
      "packages/cdd-engine/bin/cdd.mjs", "review", "--type", "plan",
      "--plan", "packages/cdd-engine/tests/fixtures/smoke-plan.md",
    ], { cwd: REPO_ROOT, env: { ...process.env, PATH: `${stubDir}:${process.env.PATH}`, CLAUDE_CODE_SESSION_ID: "1", CDD_LIFECYCLE_PATH: path.join(stubDir, "lifecycle.json") }, stdio: ["ignore", "pipe", "pipe"] });
    await waitFor(() => alive("P1SIG") > 0, 10_000);
    child.kill(sig);
    const [code, signal] = await new Promise(res => child.on("exit", (c, s) => res([c, s])));
    // handler 拦截后正常 exit（signal = null），退出码 = 128 + signo（SIGINT→130 / SIGTERM→143 / SIGHUP→129）；
    // signal 非 null 仅容 handler 未装（注册失败/竞态）的退化路径。
    expect(code === expectCode || signal === sig).toBe(true);
    await waitFor(() => alive("P1SIG") === 0, 10_000);   // 组随 teardownAll 连根退出
    rmSync(stubDir, { recursive: true, force: true });
  });
});
```

Run: `pnpm -C packages/cdd-engine test -- lifecycle.wiring`
Expected: FAIL（run-task/run-docs 尚无 teardownAll/idle 监视接线、cli.mjs 尚未接 markAllDispatchesDone、信号路径未实现）。

> **CDD_LIFECYCLE_PATH 注入（spec §2.2 A / §2.6）**：信号用例为每个 cdd 子进程注入唯一 `CDD_LIFECYCLE_PATH`（stubDir 内 tmp）——vitest `pool:'forks'` 下并发 fork 的 CLI 用例若共用 `<cwd>/.superpowers/cdd/lifecycle.json`，任一 fork 启动 `reapStale` 读到另一 fork 刚落盘的 in-flight 组（ownerPid ≠ 本 cdd）会按 orphan 连根误杀 → 信号用例 `waitFor(P1SIG)` 超时或 CLI 派发中断的 flake。Step 4 实现侧支持该覆盖（`process.env.CDD_LIFECYCLE_PATH ?? <cwd> 相对路径`），生产默认不变。

- [ ] **Step 2: run-task.mjs / run-docs.mjs 接线**

```js
// run-task.mjs 顶部：import { spawnManaged, teardownAll, markAllDispatchesDone,
//                       startIdleMonitor, stopIdleMonitor } from "../lifecycle/proc.mjs";
// 显式派发路径经 invokeCli（cli.mjs 内已 markAllDispatchesDone）；直调点无中转须手动标 done——
// review-package bash 直调（原 spawnCapture("bash", ...)）改：
const res = await spawnManaged("bash", [reviewPkg, plan, base, head, outFile], { cwd: repoRoot, env });
markAllDispatchesDone();

// runTask 主流程包 try/finally：进程内 idle 监视（§2.2 C / §2.4：长 run 低频清理 dispatch 已返回
// 仍存活的超时孤儿/残留 server，不等到 run 边界）+ teardownAll 双兜（覆盖全部 exit 路径——含 timeout/BLOCKED）：
export async function runTask(harness, taskNum, opts = {}) {
  startIdleMonitor({ intervalMs: 30_000 });   // 幂等（已启动 no-op）
  try {
    // ... 既有 runTask 全部逻辑原样 ...（review-package 等直调点按上改）
  } finally {
    stopIdleMonitor();
    await teardownAll({ graceMs: 5000 });
  }
}
```

`run-docs.mjs`（`runDocsTask`）同 pattern：import startIdleMonitor/stopIdleMonitor/teardownAll + try/finally 包裹 invokeCli 段（idle 监视与 teardownAll 双兜）。注意 `dryRun` 路径不注册任何组（无 spawn），startIdleMonitor 幂等、teardownAll 自然空转。

- [ ] **Step 3: lib/cli/ 出口接线 + research 出口 finally**

- `lib/cli/review.mjs` / `lib/cli/branch-review.mjs` / `lib/cli/fix.mjs`：各 run* 函数 try/finally → stopIdleMonitor + teardownAll（review 的 spec/plan 支路走 runDocsTask 已有 finally；task/branch 支路本层兜一层）。
- `lib/cli/research.mjs`：spawn 底改已在 Task 2 Step 3 随 cli.mjs 删导出同一步完成（`runResearch` → `spawnManaged` + 返回后 `markAllDispatchesDone`，见 Task 2 Step 3 出入 seam 同步）——本步仅补 research 出口 finally → stopIdleMonitor + teardownAll（不再有 spawn 底改，避免重复动作）。

- [ ] **Step 4: bin/cdd.mjs CLI 信号 + 跨 run 启动回收**

```js
// bin/cdd.mjs 薄入口顶部（program.parseAsync() 之前）：
import { initProcLifecycle, reapStale, teardownAll } from "../lib/lifecycle/proc.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const cwd = process.cwd();
// 落盘路径默认 <cwd>/.superpowers/cdd/lifecycle.json（相对启动 cwd，跨 run 复用）；测试/多进程
// 并发经 CDD_LIFECYCLE_PATH 覆盖（spec §2.2 A 定案：vitest pool:'forks' 各 fork 注入唯一 tmp
// 路径，避免共享文件时启动 reapStale 读到另一 fork 刚落盘的 in-flight 组、ownerPid 异判为
// orphan 连根误杀）。生产默认仍走 cwd 相对路径不变。
const lifecyclePath = process.env.CDD_LIFECYCLE_PATH ?? path.join(cwd, ".superpowers", "cdd", "lifecycle.json");
// 启动跨 run 兜底：回收上一次引擎被杀（SIGKILL/crash）残留的孤儿组。
initProcLifecycle({ diskPath: lifecyclePath });
await reapStale({ graceMs: 2000 });

// 信号安全出口：SIGINT/SIGTERM/SIGHUP → teardownAll → 按信号映射的退出码退出。
// 退出码 = 128 + signo，对齐 shell 约定（SIGINT=2→130、SIGTERM=15→143、SIGHUP=1→129）——
// 一律 130 仅对 SIGINT 成立，SIGTERM/SIGHUP 须各按 128+signo 定，不得复用常量 130。
const SIGNAL_EXIT = { SIGINT: 130, SIGTERM: 143, SIGHUP: 129 };
for (const [sig, code] of Object.entries(SIGNAL_EXIT)) {
  process.on(sig, async () => {
    process.stderr.write(`CDD: caught ${sig} — teardownAll + exit ${code}\n`);
    try { await teardownAll({ graceMs: 2000 }); } finally { process.exit(code); }
  });
}

import { program } from "../lib/cli/parse.mjs";
program.parseAsync();
```

（`await reapStale()` 在 module top-level await 下可用——Node ESM 支持；或包一层 `main()` 函数。）

**既有 CLI 用例 fork 隔离同步（spec §2.2 A / §2.6）**：Task 3 落地启动 reapStale 后，既有 `cwd=REPO_ROOT` 的 CLI 用例（`tests/cli-shape.test.mjs` smoke、`tests/cdd.test.mjs` CLI 黑盒）与新信号用例均在 vitest `pool:'forks'` 并发 fork 中运行——各 fork 须为 CDD 子进程注入唯一 `CDD_LIFECYCLE_PATH`（每 fork 独立 tmp 路径，信号用例已在 Step 1 注入；smoke/黑盒用例在 Step 5 前一并注入），或对相关文件用 `fileSequential` 串行。`pool:'forks'` 本身不变（spec §2.6）。

- [ ] **Step 5: 跑守卫 + 全量 + commit**

Run: `pnpm -C packages/cdd-engine test -- lifecycle.wiring` → green；`pnpm -C packages/cdd-engine test` 全量绿；`pnpm run validate` 全绿。

```bash
cd /Users/kang/Projects/oscaner-skills
git add -A packages/cdd-engine
git commit -m "feat(cdd-engine): wire process-lifecycle across all spawn points + CLI signal teardown + cross-run reapStale + architecture guard (F1)"
```

---

### Task 4: 批次收尾 —— changeset + 全量 validate

<thinking>P1 特性作为一个 changeset 落盘（@oscaner-skills/cdd-engine minor；历史 p*-cdd-engine-overhaul.md 同族先例）。手动写 .changeset/<slug>.md（避免交互式 CLI）。</thinking>

**Files:**
- Create: `packages/cdd-engine/README.md` 复核（如触及；否则不改）
- Create: `.changeset/<slug>.md`（slug 如 `warm-plums-drop.md`，追加随机段）

**Interfaces:**
- Consumes: Task 1-3 全部产物
- Produces: 可发布 changeset；`pnpm run validate` 全绿

- [ ] **Step 1: 写 changeset**

创建 `.changeset/two-seas-repair.md`：

```markdown
---
'@oscaner-skills/cdd-engine': minor
---

cdd-engine: 进程生命周期统一管理 —— 全部派生点纳入进程组所有权（spawnManaged detached 进程组 + teardownAll run 边界连根回收 + 跨 run reapStale 孤儿兜底，续跑会话随组退出），修长时间运行后 `claude -p` 驻留进程累积；目录结构重排（bin 薄入口 + lib 分簇 + tests 顶层，npm 发布不再含 tests）—— closes #246 F1
```

- [ ] **Step 2: 全量 validate + npm pack 断言**

```bash
cd /Users/kang/Projects/oscaner-skills
pnpm run validate                    # 12 块全绿（emit fresh + 5b1 engine vitest + residue/smoke 新断言 + version sync）
npm pack --dry-run --prefix packages/cdd-engine 2>&1 | grep -E "tests/|\.gitkeep" | wc -l   # = 0
```

- [ ] **Step 3: commit**

```bash
git add .changeset
git commit -m "chore(cdd-engine): P1 changeset — process-lifecycle manager + directory re-org"
```