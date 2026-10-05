# osuperpowers 架构重构 P3 — cdd 命令面与契约收敛实施计划

**Spec:** [2026-09-13-osuperpowers-overhaul-p3-design.md](docs/kairos/specs/2026-09-13-osuperpowers-overhaul-p3-design.md)

- **Parent program**: [2026-09-13-osuperpowers-overhaul-overall.md v1.10](../specs/2026-09-13-osuperpowers-overhaul-overall.md)
- **Depends on**: P1 shipped（runtime 布局 `.osuperpowers/cdd` + standalone 移除，2026-09-14）；P2 shipped（docs 单根，2026-09-14）
- **Base**: develop

## Constraints


从 overall v1.11 + P3 design v1.2 copy：
- **命令面目标集合** = `{implement, review, fix, base-branch}`（`lib/cli/parse.mjs` 顶层命令集合恰为此四）。**`--help` 计数陷阱**：Commander 自动注册的 `help [command]` 只进 `--help` 文本的 Commands 段、**不进 `program.commands`**，故删 brief/research 后实跑 `cdd --help` 的 Commands 段为 **5 行**而非 4——集合判定只能取实例断言，任何基于 `--help` 文本的「恰为四」计数都是假阴性陷阱（详见 T3 Interfaces）
- **零残留作用域**（AC2/AC3）= engine 机制位置 `packages/cdd-engine/{bin,lib,templates}` 零字面残留 + `packages/osuperpowers/skills` 零 `cli-research`；`.agents/` 由 emit 派生收敛（其源即 skills，不手改）；历史 `docs/osuperpowers/{specs,plans}/*.md` 豁免
- **守卫取命令形**：`/\bcdd (brief|research)\b/` + `/RESEARCH_TIMEOUT/`；**绝不裸词** —— 裸 `research` 会误伤 P4 合法的 `/mattpocock-skills:research`（`vendors/mattpocock-skills/skills/engineering/research/` 实存），裸 `brief` 会误伤活体文本 `packages/osuperpowers/skills/cli-driven-development/SKILL.md:66` 的 `brief-dependent plan sections`
- **测试断言禁假绿**：黑盒退役断言必须用**完整调用形态**（`cdd research --brief x --output y` / `cdd brief --task 1 --plan x --output y`）——bare 形态在删前亦 exit 2（Commander required-option 缺省），是假绿
- 所有改动须过 `pnpm run validate`（13 块）+ `pnpm run emit:check` 无 drift；**emit 唯一入口 = 仓库根 `pnpm run emit`**（`packages/osuperpowers/package.json` 无 scripts 字段）
- **破坏性重构已授权**（2026-09-13 用户显式：允许破坏性变更、确保最佳实践、不留技术债务、遗留即删）：两处命令删除、级联死配置连根（含 `LEGACY_MODE_ENV` 整表与 `resolveTimeoutMs` legacy 分支、零生产者的 `validateBrief`）、存量 changeset 归并
- **不改变引擎评审语义本体**：review/fix/handoff 生命周期、Stopping 判定、commit-contract、doc_hash 双签名不动
- vendored 子模块不可改（`vendors/mattpocock-skills/.../research/` 物理目录保留，非本 phase 域）
- changeset：`@oscaner-skills/cdd-engine` minor + `@oscaner-skills/osuperpowers` minor（一条双包）；本程序 P1/P2/P3 各一条 per-phase 保留（P6「各 phase changeset 齐备无遗漏」复核粒度，非债务）

> **§2.9 overall 回填已完成（非本计划任务）**：design §2.9 的四表回填已于 write-spec 的 `commit-spec` 前置门落地并提交（overall v1.10 → **v1.11**，commit `6f3f9dd`，块 12 `3/4 canonical` 全绿）。实现者无需再改 overall。

> **实现前置（§2.7 记录豁免的对称面）**：历史 plan（含本文件）与 design 文档**不在**任何守卫或 AC 的零残留作用域内；实现者若在历史文档中读到 `cdd brief` / `cdd research` 字样，属正常，勿"顺手清理"。


### Task 1: `cdd research` 全量移除 — 命令面 + 级联死配置 + 关联测试 + 注释枚举

- **Objective**: `cdd research` 全量移除 — 命令面 + 级联死配置 + 关联测试 + 注释枚举（命令注册 / `lib/cli/research.mjs` / 两测试文件 / timeout 级联死配置 / 注释枚举全删）

- **Consumes**: P3 design §2.3 / §2.4 / §2.5

- **Produces**: `cdd` 子命令集合 6→5
- **Produces**: `lib/cli/research.mjs` 不存在
- **Produces**: `DEFAULT_TIMEOUTS` 与 `modeEnv` 收敛为 task/review 两键（零 `research`）；`LEGACY_MODE_ENV` 与其消费分支不存在
- **Produces**: T5 的守卫 check 2 依赖本任务清空 `CDD_RESEARCH_TIMEOUT` / `RESEARCH_TIMEOUT` 字面

- **Files**: packages/cdd-engine/lib/cli/research.mjs, packages/cdd-engine/tests/research.test.mjs, packages/cdd-engine/tests/cdd-research.test.mjs, packages/cdd-engine/lib/cli/parse.mjs, packages/cdd-engine/lib/lifecycle/cli.mjs, packages/cdd-engine/lib/lifecycle/proc.mjs, packages/cdd-engine/lib/cli/review.mjs, packages/cdd-engine/bin/cdd.mjs, packages/cdd-engine/tests/lifecycle.wiring.test.mjs, packages/cdd-engine/tests/host-detection.test.mjs, packages/cdd-engine/tests/cdd.test.mjs, packages/cdd-engine/tests/cli-shape.test.mjs

- **Steps**:
  1. 写失败断言（红）— `cdd research` 完整形态 → unknown command exit 2：追加到 `packages/cdd-engine/tests/cli-shape.test.mjs` 末尾（既有 `review 传已被删除的 --doc` 用例之后、同一 `describe` 内）——完整调用形态 `runCli(['research', '--brief', SMOKE_PLAN, '--output', '/tmp/p3-retired-research.md'], { env: { ...HOST_ENV, CDD_DRY_RUN: '1' } })`，断言 exitCode 2 + stderr 匹配 `usage: cdd`；**bare 形态在删前亦 exit 2（Commander required-option 缺省）是假绿，不得用** — checkable: 新例（完整形态 → unknown command exit 2）PASS
  2. 运行确认失败：`pnpm --filter @oscaner-skills/cdd-engine exec vitest run tests/cli-shape.test.mjs -t 'cdd research（完整形态）'` — checkable: FAIL——删前 `cdd research` 存在，`CDD_DRY_RUN=1` 短路 → exitCode 0 ≠ 2
  3. 删命令注册（parse.mjs）：删 L9 整行 `import { runResearch } from "./research.mjs";`；删 L19（`SUBCOMMAND_USAGE` 内）`research: "usage: cdd research --brief <path> --output <path>"` 键；L39 描述去 `research` 分句；删 L83-92 research 命令块整块（含上方注释的 `research remains` 分句，`select removed (T2)` 分句保留）替换为去 `research` 陈述的注释 — checkable: parse.mjs 零 `runResearch` import / `research` SUBCOMMAND_USAGE 键 / `research` 命令块
  4. 删 CLI 处理器：`git rm packages/cdd-engine/lib/cli/research.mjs` — checkable: `lib/cli/research.mjs` 不存在
  5. 级联死配置连根（`lib/lifecycle/cli.mjs`）：L7 `const DEFAULT_TIMEOUTS = { task: 1_800_000, review: 1_800_000 };`；删 L9 整行 `const LEGACY_MODE_ENV = { research: 'RESEARCH_TIMEOUT' };`；L20 注释枚举收敛（**本行是 T5 守卫 check 2 的命中面**）→ `// per-mode env（CDD_TASK_TIMEOUT / CDD_REVIEW_TIMEOUT）契约单位为秒 ——`；L23 `const modeEnv = { task: 'CDD_TASK_TIMEOUT', review: 'CDD_REVIEW_TIMEOUT' };`；删 L38-44 的 legacy 分支整段（`LEGACY_MODE_ENV` 表已删，该段不可达） — checkable: `LEGACY_MODE_ENV` 常量与 legacy 分支不存在；`DEFAULT_TIMEOUTS`/`modeEnv` 收敛为 task/review 两键（零 research）
  6. 注释枚举收敛（非守卫命中面，保留不删会静默留存陈旧说明）：`lib/cli/parse.mjs:3` 文件头 action 枚举去 `runResearch`（Step 3 已删静态导入，本行须同一次收敛）；`lib/lifecycle/proc.mjs:176-177` **同一次编辑内两行**（L177 的计数 6 与本行同一陈述）→「五个派发模块（run-task / run-docs / review / branch-review / fix）统一经此出口，清除各模块重复的 finally 双行样板；wiring guard 断言使用而非 token 匹配 5 文件」；`lib/cli/review.mjs:5` →「3 消费方（fix/parse/branch-review）与本文件经 shared 复用（单一 host 事实源）」；`bin/cdd.mjs:3` 注释 + 删 `:8` 的 `//   cdd research --brief <path> --output <path>` 命令清单行 — checkable: engine bin/lib 注释枚举零 `research` 残留（陈旧说明清零）
  7. 测试面同步（删两文件 + 改写两处）：`git rm packages/cdd-engine/tests/research.test.mjs packages/cdd-engine/tests/cdd-research.test.mjs`；`tests/cdd.test.mjs` 删 `dry-run research → exit 0` 整个 `it(...)` 块 + L3 头注释去 `select/research` 旧命令叙述；`tests/lifecycle.wiring.test.mjs` L2 去计数（**plan 期 design 回填点**，出处/计数不可核验 → 收敛为去计数）+ L45 六→五、删 L52 与列表项（`[["run-task", runTask], ["run-docs", runDocs], ["review", review], ["branch-review", branchReview], ["fix", fix]]`）；`tests/host-detection.test.mjs:2` 头注释同步 `cdd implement/review/fix no longer take a harness flag` — checkable: 两测试文件删除；cdd.test 零 research dry-run 用例；lifecycle.wiring 五派发接线断言绿
  8. 运行确认通过 + 全量 engine suite：`pnpm --filter @oscaner-skills/cdd-engine exec vitest run tests/cli-shape.test.mjs` → `pnpm --filter @oscaner-skills/cdd-engine test` → `pnpm exec vitest run` — checkable: cli-shape PASS（含 Step 1 新例）；engine suite 全绿（用例数较 P2 末态下降：`research.test.mjs` 4 + `cdd-research.test.mjs` 13 + `cdd.test.mjs` 1 = 18）；根 vitest（scripts/**）全绿
  9. Commit：`git add -A packages/cdd-engine`；`git commit -m "refactor(cdd-engine): T1 — cdd research 全量移除（命令面 + 级联 timeout 死配置 + 关联测试 + 注释枚举）"` — checkable: T1 变更面单提交落盘（conventional）

- **Acceptance**:
  - 新例（完整形态 → unknown command exit 2）PASS
  - FAIL——删前 `cdd research` 存在，`CDD_DRY_RUN=1` 短路 → exitCode 0 ≠ 2
  - parse.mjs 零 `runResearch` import / `research` SUBCOMMAND_USAGE 键 / `research` 命令块
  - `lib/cli/research.mjs` 不存在
  - `LEGACY_MODE_ENV` 常量与 legacy 分支不存在；`DEFAULT_TIMEOUTS`/`modeEnv` 收敛为 task/review 两键（零 research）
  - engine bin/lib 注释枚举零 `research` 残留（陈旧说明清零）
  - 两测试文件删除；cdd.test 零 research dry-run 用例；lifecycle.wiring 五派发接线断言绿
  - cli-shape PASS（含 Step 1 新例）；engine suite 全绿（用例数较 P2 末态下降：`research.test.mjs` 4 + `cdd-research.test.mjs` 13 + `cdd.test.mjs` 1 = 18）；根 vitest（scripts/**）全绿
  - T1 变更面单提交落盘（conventional）

### Task 2: `cdd brief` 全量移除 — 命令面 + `validateBrief` 零生产者导出 + 测试裁剪

- **Objective**: `cdd brief` 全量移除 — 命令面 + `validateBrief` 零生产者导出 + 测试裁剪为 generateBrief-only

- **Consumes**: T1 的 parse.mjs 末态（description = `implement/review/fix/brief/base-branch`）

- **Produces**: `cdd` 子命令集合 5→4
- **Produces**: `lib/cli/brief.mjs` 不存在
- **Produces**: `lib/brief.mjs` 仅导出 `generateBrief`（`run-task.mjs:17` 消费面不变）
- **Produces**: T3 的 help 断言与 T4/T5 依赖本任务完成

- **Files**: packages/cdd-engine/lib/cli/brief.mjs, packages/cdd-engine/lib/cli/parse.mjs, packages/cdd-engine/lib/brief.mjs, packages/cdd-engine/bin/cdd.mjs, packages/cdd-engine/tests/brief.test.mjs, packages/cdd-engine/tests/cdd.test.mjs, packages/cdd-engine/tests/cli-shape.test.mjs

- **Steps**:
  1. 写失败断言（红）— `cdd brief` 完整形态 → unknown command exit 2（Step 1 of Task 1 的新例之后）：`runCli(['brief', '--task', '1', '--plan', SMOKE_PLAN, '--output', '/tmp/p3-retired-brief.md'])` → exitCode 2 + stderr 匹配 `usage: cdd` — checkable: 新例 PASS
  2. 运行确认失败：`pnpm --filter @oscaner-skills/cdd-engine exec vitest run tests/cli-shape.test.mjs -t 'cdd brief（完整形态）'` — checkable: FAIL——删前该形态生成 brief → exitCode 0 ≠ 2
  3. 删命令注册（parse.mjs，**按引用文本定位，勿按行号**——T1 已删 L9/L19 与研究命令块 8 行 → 锚点非均匀前移）：删 `import { runBriefCli } from "./brief.mjs";`（T1 前 L11 / T1 后 L10）；删 `SUBCOMMAND_USAGE.brief` 键（T1 前 L20 / T1 后 L18）；description 行去 `brief` 分句（**本 phase 命令面终态** `implement/review/fix/base-branch`）；删 brief 命令块整块（含上方 `--- brief (delegated to lib module CLI entry…)` 注释）——**边界警告**：块下一条即 base-branch 注释块，删除终点以 `  ]));` 与块间空行为界，按陈旧行号 `:105` 定位会越界误删 base-branch — checkable: parse.mjs 零 `runBriefCli` / `brief` 命令块 / `SUBCOMMAND_USAGE.brief` 键；description = `implement/review/fix/base-branch`；base-branch 命令块未误伤
  4. 删 CLI 处理器：`git rm packages/cdd-engine/lib/cli/brief.mjs` — checkable: `lib/cli/brief.mjs` 不存在
  5. `lib/brief.mjs` 去死面（`validateBrief` 零生产者——全仓唯一引用是待删的 3 个测试用例）：文件头 L1 去 `+ validator` 半句；删 L4 `// validateBrief: check brief contains TASK_BASE: line.`；L5-6 的 CLI 迁移段整段删除（指向已删文件的陈旧说明）；删 L27-30 `validateBrief` 函数——**L7 import 行不动**（`existsSync` 仍被保留面 `generateBrief` 使用 L11 `if (!existsSync(planFile)) throw …`；勿收敛为 `{ readFileSync, writeFileSync }`——那会使 `generateBrief` 每次调用即 `ReferenceError`，打断 run-task.mjs 的 brief self-provision（F11）与 brief.test.mjs 全部 generateBrief 用例） — checkable: `lib/brief.mjs` 零 `validateBrief`；仅导出 `generateBrief`；`existsSync` import 保留
  6. `bin/cdd.mjs` 命令清单注释：删 L9 `//   cdd brief --task <n> --plan <path> [--output <path>]` — checkable: bin/cdd.mjs 命令清单零 `brief` 行
  7. 测试面裁剪：`tests/cdd.test.mjs` 删 `brief --task --plan --output → 生成 brief + {brief} JSON` 整个 `it(...)` 块（含其 `mkdtempSync` 包装）；`tests/brief.test.mjs` 删 CLI 用例组（`--- CLI entry point tests ---` 分隔线与 `BRIEF_MJS` / `LIB_BRIEF_MJS` / `cliRun` helper）、`CLI --task N --plan --output` / `CLI --task N: missing task` / `node lib/brief.mjs 直跑` 三例、`validateBrief` 三例（含文件头 `validateBrief：…` 说明行）；导入面逐项核过（保留面 `generateBrief` 用例仍消费 `execFileSync` L79 与 `realpathSync` L69-70——**勿整行删**）：删 `existsSync`（唯一用处是待删直跑用例 L164）、删 `validateBrief`，保留 `execFileSync`/`realpathSync`/`gitCommit`/`gitInit`/`HERE`/`REPO_ROOT`/`path`/`fileURLToPath`/`tmpdir` — checkable: brief.test.mjs 12 → 6 例（删 3 CLI 用例 + 3 `validateBrief` 用例），保留面 generateBrief 家族全绿
  8. 运行确认通过 + 全量 engine suite：`pnpm --filter @oscaner-skills/cdd-engine exec vitest run tests/cli-shape.test.mjs` → `pnpm --filter @oscaner-skills/cdd-engine test` — checkable: cli-shape PASS（含两例退役断言）；engine suite 全绿
  9. Commit：`git add -A packages/cdd-engine`；`git commit -m "refactor(cdd-engine): T2 — cdd brief 全量移除（命令面 + validateBrief 死导出 + 测试裁剪为 generateBrief-only）"` — checkable: T2 变更面单提交落盘（conventional）

- **Acceptance**:
  - 新例 PASS
  - FAIL——删前该形态生成 brief → exitCode 0 ≠ 2
  - parse.mjs 零 `runBriefCli` / `brief` 命令块 / `SUBCOMMAND_USAGE.brief` 键；description = `implement/review/fix/base-branch`；base-branch 命令块未误伤
  - `lib/cli/brief.mjs` 不存在
  - `lib/brief.mjs` 零 `validateBrief`；仅导出 `generateBrief`；`existsSync` import 保留
  - bin/cdd.mjs 命令清单零 `brief` 行
  - brief.test.mjs 12 → 6 例（删 3 CLI 用例 + 3 `validateBrief` 用例），保留面 generateBrief 家族全绿
  - cli-shape PASS（含两例退役断言）；engine suite 全绿
  - T2 变更面单提交落盘（conventional）

### Task 3: 命令面形态收口 — 顶层命令集合静态断言 + `-h` help 断言

- **Objective**: 命令面形态收口 — 顶层命令集合静态断言 + `-h` help 断言（`program.commands` 集合相等 + help 正负向断言）

- **Consumes**: T1 + T2 的 parse.mjs 末态（顶层命令恰为四）

- **Produces**: AC1 的机器判定——`program.commands.map(c=>c.name())` 集合相等断言（**不用文本正则**：`base-branch` 经 `const baseBranch = program` 换行链式注册，`program` 不在行首；无锚正则会把嵌套 `set`/`get` 收进集合）
- **Produces**: `-h` help 断言（正向 `implement/review/fix/base-branch` + 负向 `\bbrief\b|\bresearch\b`，不做「恰为四」文本计数——Commander 隐式 `help [command]` 计数陷阱，见下方对 `--help` 的注记）

- **Files**: packages/cdd-engine/tests/cli-shape.test.mjs, packages/cdd-engine/tests/cdd.test.mjs

- **Steps**:
  1. 写顶层命令集合断言（红/绿由 T1+T2 决定）：`tests/cli-shape.test.mjs` 顶部 import 区追加 `import { program } from '../lib/cli/parse.mjs';`；文件末尾追加 `describe('P3 命令面收敛：顶层子命令恰为四', ...)`——`expect(program.commands.map((c) => c.name()).sort()).toEqual(['base-branch', 'fix', 'implement', 'review'])`（静态实例断言优先于文本正则——commander 的 `program.commands` 只含直接子命令，嵌套 set/get 天然不入集；parse.mjs 文件头明载「本文件可被测试静态读（cli-shape），import 后无副作用」）+ 源码面无 `.command("brief")` / `.command("research")` 注册断言 — checkable: 新断言 PASS（集合恰为四 + 源码零注册）
  2. 运行确认通过：`pnpm --filter @oscaner-skills/cdd-engine exec vitest run tests/cli-shape.test.mjs` — checkable: cli-shape PASS（若集合仍含 brief 或 research → T1/T2 未完成，先回补）
  3. `-h → help` 断言改写（cdd.test.mjs:80）：`execaSync(NODE, [CDD_MJS, "--help"], { cwd: REPO_ROOT, env: cleanEnv(), extendEnv: false })` → stdout 匹配 `/implement\/review\/fix\/base-branch/`（正向）+ `not.toMatch(/\bbrief\b|\bresearch\b/)`（负向——**真断言**：T1/T2 前 `--help` 列出 research/brief 两命令与描述文本，必红）。**`--help` 计数陷阱（勿按文本集合计数）**：Commander 自动注册的 `help [command]` 只出现在 `--help` 文本的 Commands 段、`program.commands` 不含它——实跑删 brief/research 后的 `cdd --help`，Commands 段为 **5 行**（四命令 + 隐式 help），任何基于 `--help` 文本的「恰为四」计数都会数到 5 而假失败；本步 `-h` 断言刻意只用正向 + 负向、不做集合计数 — checkable: `-h → help` 新断言 PASS（正向命中 + 负向零命中）
  4. 运行确认通过 + 全量 engine suite：`pnpm --filter @oscaner-skills/cdd-engine test` — checkable: engine suite 全绿
  5. Commit：`git add -A packages/cdd-engine`；`git commit -m "test(cdd-engine): T3 — 顶层命令集合恰为四（静态实例断言）+ -h help 断言去 brief/research"` — checkable: T3 变更面单提交落盘（conventional）

- **Acceptance**:
  - 新断言 PASS（集合恰为四 + 源码零注册）
  - cli-shape PASS（若集合仍含 brief 或 research → T1/T2 未完成，先回补）
  - `-h → help` 新断言 PASS（正向命中 + 负向零命中）
  - engine suite 全绿
  - T3 变更面单提交落盘（conventional）

### Task 4: `cli-research` skill 删除 + emit（`.agents/` 派生副本自动 prune）

- **Objective**: `cli-research` skill 删除 + emit（`.agents/` 派生副本自动 prune + skills-count 常量收敛）

- **Consumes**: T1/T2（命令已不存在，skill 的 `cdd research` 调用链已断）

- **Produces**: `packages/osuperpowers/skills/` 零 `cli-research`
- **Produces**: `.agents/` 派生副本同步消失
- **Produces**: 块 5b 的 skills-count 常量收敛后计 6
- **Produces**: T5 的守卫 check 1 依赖本任务（其 scope 含 `OSKILLS` = `packages/osuperpowers/skills`）

- **Files**: packages/osuperpowers/skills/cli-research/, packages/osuperpowers/.agents/skills/osuperpowers/cli-research/SKILL.md, scripts/validate/osuperpowers.mjs

- **Steps**:
  1. 删 skill 目录：`git rm -r packages/osuperpowers/skills/cli-research` — checkable: 目录不存在。**零注册面（字符串面已实测，但有一处计数耦合）**：`packages/osuperpowers/package.json`（目录扫描发现）/ `marketplace/source.json` / 根 `README.md` / `packages/osuperpowers/README.md` / `docs/maintainers/*.md` / `digraph-consistency.test.mjs`（走 `readdirSync(SKILLS_DIR)`，无硬编码清单）均无 `cli-research` 引用；但 `scripts/validate/osuperpowers.mjs:46-47` 的 `EXPECTED = 7` / `EMITTERS_LABEL = "6 emitters + init"` 是**目录计数**断言（块 5b，L53/L59/L64 三处 `assert(n === EXPECTED)`；`plugin.json#skills` 走 string 分支 → `countSkillsWithMarkdown` 实数 7），删后实数 6 → 命名 grep 查不到、不查计数必红（先例：P5 `cli-select` 删除同形 8→7 + label 同步）
  2. skills-count 常量收敛（`scripts/validate/osuperpowers.mjs`——否则块 5b 必红）：`EXPECTED` 7→6、`EMITTERS_LABEL` `"6 emitters + init"` → `"5 emitters + init"`（文件头注释同步登记 P3 删除） — checkable: `EXPECTED = 6`、`EMITTERS_LABEL = "5 emitters + init"`
  3. emit 重生成派生面：`pnpm run emit` — checkable: `packages/osuperpowers/.agents/skills/osuperpowers/cli-research/` 消失（机制 `scripts/emit/osuperpowers.mjs`：`pruneStaleAgentsNamespaces` 后对整 namespace `rmSync(dest)` + `cpSync(sourceRoot, dest)`——源目录删除即随之消失，无需手写清理）
  4. 验证 prune 生效（对抗性：断言落在真实路径上）：`test ! -e packages/osuperpowers/skills/cli-research && echo "OK skills"`；`test ! -e packages/osuperpowers/.agents/skills/osuperpowers/cli-research && echo "OK agents"`；`git status --porcelain packages/osuperpowers/.agents` — checkable: 两行 OK；`git status` 显示 `.agents/skills/osuperpowers/cli-research/SKILL.md` 为 **D**（deleted，emit 已将其从工作树移除且为 git 跟踪文件）
  5. emit drift 校验 + 全量 validate：`pnpm run emit:check` + `pnpm run validate` — checkable: 无 drift；13 块全绿（块 5b 输出为 `OK — 6 osuperpowers skills (directory ./skills/)`——若仍报 `expected 7 … got 6`，即 Step 2 未落地）
  6. Commit：`git add -A packages/osuperpowers scripts/validate/osuperpowers.mjs`；`git commit -m "refactor(osuperpowers): T4 — 删除 cli-research skill（随 cdd research 移除，唯一调用方同步）+ skills-count 常量收敛 + emit"` — checkable: T4 变更面单提交落盘（conventional）

- **Acceptance**:
  - 目录不存在。**零注册面（字符串面已实测，但有一处计数耦合）**：`packages/osuperpowers/package.json`（目录扫描发现）/ `marketplace/source.json` / 根 `README.md` / `packages/osuperpowers/README.md` / `docs/maintainers/*.md` / `digraph-consistency.test.mjs`（走 `readdirSync(SKILLS_DIR)`，无硬编码清单）均无 `cli-research` 引用；但 `scripts/validate/osuperpowers.mjs:46-47` 的 `EXPECTED = 7` / `EMITTERS_LABEL = "6 emitters + init"` 是**目录计数**断言（块 5b，L53/L59/L64 三处 `assert(n === EXPECTED)`；`plugin.json#skills` 走 string 分支 → `countSkillsWithMarkdown` 实数 7），删后实数 6 → 命名 grep 查不到、不查计数必红（先例：P5 `cli-select` 删除同形 8→7 + label 同步）
  - `EXPECTED = 6`、`EMITTERS_LABEL = "5 emitters + init"`
  - `packages/osuperpowers/.agents/skills/osuperpowers/cli-research/` 消失（机制 `scripts/emit/osuperpowers.mjs`：`pruneStaleAgentsNamespaces` 后对整 namespace `rmSync(dest)` + `cpSync(sourceRoot, dest)`——源目录删除即随之消失，无需手写清理）
  - 两行 OK；`git status` 显示 `.agents/skills/osuperpowers/cli-research/SKILL.md` 为 **D**（deleted，emit 已将其从工作树移除且为 git 跟踪文件）
  - 无 drift；13 块全绿（块 5b 输出为 `OK — 6 osuperpowers skills (directory ./skills/)`——若仍报 `expected 7 … got 6`，即 Step 2 未落地）
  - T4 变更面单提交落盘（conventional）

### Task 5: 防回渗守卫 — 已删 cdd 子命令（命令形）+ research timeout env

- **Objective**: 防回渗守卫 — 已删 cdd 子命令（命令形）+ research timeout env（第三条 stale-lexicon 守卫）

- **Consumes**: T1（清空 engine 内 `cdd research` / `CDD_RESEARCH_TIMEOUT` / `RESEARCH_TIMEOUT` 全部字面）+ T2（清空 `cdd brief`）+ T4（清空 skills 内 `cli-research`）

- **Produces**: 与 P1（`.superpowers/cdd` / `standalone`）、P2（`docs/superpowers`）同族的第三条 stale-lexicon 守卫；`collectStaleLexiconHits()` live-repo 零残留（block 5c）覆盖之

- **Files**: scripts/validate/residue.mjs, scripts/validate/residue.test.mjs

- **Steps**:
  1. 写失败断言（红）— 守卫行为 + live-repo 零残留：`scripts/validate/residue.test.mjs` 追加 `describe("stale-lexicon：removed cdd subcommand 守卫（Task 5）")`（既有 `stale-lexicon：old docs root 守卫（Task 5）` describe 之后）——字面经字符串拼接构造（P2 先例——守卫测试保持零字面，可在 scope 未来扩张时不反噬自身）：命令形命中 / 裸 research・brief 放行（`hasHit([`Run \`${CDD} research --brief x --output y\``])` true；`hasHit([`Run \`${CDD} brief --task 1 --plan p --output o\``])` true；`hasHit(["/mattpocock-skills:research 会话调用"])` false；`hasHit(["brief-dependent plan sections"])` false；`hasHit(["cddr research"])` false 词边界）；research timeout env 命中 / task・review timeout 放行（`hasHit([`${"CDD_RESEARCH"}_TIMEOUT=2700`])` true；`hasHit(["CDD_TASK_TIMEOUT=60"])` false）；含命令形的临时文件被 `collectStaleLexiconHits` 命中（`mkdtempSync` 临时文件写 `Run \`${CDD} research --brief b\`` → 1 命中，label `removed cdd subcommand (pre-P3)`） — checkable: 追加组三例断言（红——`hasHit` 尚未含新 check，正例返 false、label 未定义）
  2. 运行确认失败：`pnpm exec vitest run scripts/validate/residue.test.mjs` — checkable: FAIL（正例返 false、label 未定义）
  3. 加守卫（residue.mjs）：`STALE_LEXICON_CHECKS` 数组内 P2 的 `old docs root (pre-P2)` 条目之后追加两条——`{ label: "removed cdd subcommand (pre-P3)", re: /\bcdd (brief|research)\b/, scope: [...ALL_MECH_POSITIONS, ...DOC_SURFACE_TARGETS] }`（**命令形**，非裸词——P4 合法的 `/mattpocock-skills:research` 会话调用与活体文本 cli-driven-development/SKILL.md:66 的 `brief-dependent plan sections` 均须放行）+ `{ label: "removed research timeout env", re: /CDD_RESEARCH_TIMEOUT|RESEARCH_TIMEOUT/, scope: CDD_ENGINE }`；文件头语义枚举（L2-12）追加收尾分句 `// the old docs root (pre-P2), the removed cdd subcommands \`brief\` / \`research\` (pre-P3, command-form only — bare words stay legal), and the removed research timeout envs` — checkable: `STALE_LEXICON_CHECKS` 含两条（命令形 + timeout env）；文件头枚举注释追加
  4. 运行确认通过（守卫行为）：`pnpm exec vitest run scripts/validate/residue.test.mjs` — checkable: PASS（含既有 `collectStaleLexiconHits() === []` live-repo 用例）
  5. 确认 live-repo 零残留（若红，回补 T1/T2/T4）：`node scripts/validate/residue.mjs` — checkable: `ALL PASS`；若报 `removed cdd subcommand (pre-P3)` 命中 → 输出中的文件即遗漏面（engine 面回 T1/T2，skills 面回 T4）
  6. Commit：`git add scripts/validate/residue.mjs scripts/validate/residue.test.mjs`；`git commit -m "test(validate): T5 — stale-lexicon 守卫：已删 cdd 子命令（命令形）+ research timeout env"` — checkable: T5 变更面单提交落盘（conventional）

- **Acceptance**:
  - 追加组三例断言（红——`hasHit` 尚未含新 check，正例返 false、label 未定义）
  - FAIL（正例返 false、label 未定义）
  - `STALE_LEXICON_CHECKS` 含两条（命令形 + timeout env）；文件头枚举注释追加
  - PASS（含既有 `collectStaleLexiconHits() === []` live-repo 用例）
  - `ALL PASS`；若报 `removed cdd subcommand (pre-P3)` 命中 → 输出中的文件即遗漏面（engine 面回 T1/T2，skills 面回 T4）
  - T5 变更面单提交落盘（conventional）

### Task 6: changeset — 本 phase 双包声明 + 存量 backlog 归并（14 → 6）

- **Objective**: changeset — 本 phase 双包声明 + 存量 backlog 归并（14 → 6，含裸包名静默丢声明修复）

- **Consumes**: T1–T5 的全部交付面（命令面四收敛 + skill 删除 + 守卫）

- **Produces**: `.changeset/` 内本程序 per-phase 三条（`p1-cdd-runtime-layout-singleton` / `p2-docs-root-migration` / `p3-cdd-command-surface`）+ 归并六条
- **Produces**: `pnpm run version --dry-run` 的 next 版本仍为 **1.0.0**

- **Files**: .changeset/p3-cdd-command-surface.md, .changeset/backlog-osuperpowers-major.md, .changeset/backlog-osuperpowers-minor.md, .changeset/backlog-osuperpowers-patch.md, .changeset/backlog-cdd-engine-major.md, .changeset/backlog-cdd-engine-minor.md, .changeset/backlog-cdd-engine-patch.md

- **Steps**:
  1. 写本 phase changeset：创建 `.changeset/p3-cdd-command-surface.md`（双包 minor：`"@oscaner-skills/cdd-engine": minor` + `"@oscaner-skills/osuperpowers": minor`），正文含 P3 cdd 命令面收敛叙述（6 → 4）+ `cdd brief` / `cdd research` 删除语义 + 级联死配置连根 + 防回渗守卫 + semver 说明（brief/research 删除实为 breaking，本次按 minor 发布） — checkable: `.changeset/p3-cdd-command-surface.md` 落盘（双包 minor，正文含命令面收敛 + brief/research 删除 + 死配置 + 守卫）
  2. 写归并声明（六条，内容 = 14 条历史 backlog 的去重合并；`closes #NNN` 全保留）：`backlog-osuperpowers-major.md` / `backlog-osuperpowers-minor.md` / `backlog-osuperpowers-patch.md` / `backlog-cdd-engine-major.md` / `backlog-cdd-engine-minor.md` / `backlog-cdd-engine-patch.md`——**归并轴 = (package × bump level)**：文件的 bump 级决定其渲染到的 changelog 段落，跨包文件被拆到对应两文件；`@oscaner-skills/cdd-engine` 不在 `.changeset/versioned-plugins.json` 内 → 其 changeset 是**声明性**的（不产生版本效果），归并仅为整洁与消除裸包名缺陷 — checkable: 六条归并 changeset 落盘（(package × bump) 轴分配；逐条正文含去重合并叙述与全部 `closes #NNN`）
  3. 删 14 条历史 backlog changeset：`git rm` 下列文件——`.changeset/p-delta-cdd-refactor.md` `.changeset/p-epsilon-cleanup.md` `.changeset/p-gamma-brainstorming-restructure.md` `.changeset/p-zeta-cdd-engine-cli-shared.md` `.changeset/p2-session-report-246-stopping-ref.md` `.changeset/p3-cdd-engine-overhaul.md` `.changeset/p4-cdd-engine-overhaul.md` `.changeset/p4-session-report-246-overall-consistency.md` `.changeset/p5-cdd-engine-overhaul.md` `.changeset/p5-session-report-246-orchestration-hardening.md` `.changeset/p6-cdd-engine-overhaul.md` `.changeset/p6-post-dogfood-skill-fixes.md` `.changeset/p6-report-issue-session-context.md` `.changeset/two-seas-repair.md` — checkable: 14 条历史 backlog changeset 全部删除（git rm 零报错）
  4. 校验归并未改变版本结果（机器判定）：`pnpm run version --dry-run 2>&1 | tail -6` — checkable: `[dry-run] write packages/osuperpowers/package.json: version → 1.0.0`（**与归并前一致**——osuperpowers 最高 bump 级仍为 major）；`would consume changesets` 列表 = 本程序 3 条 + 归并 6 条 = **9 条**
  5. 校验零裸包名 + `closes #NNN` 无丢失：`grep -rn '^"osuperpowers"\|^'"'"'osuperpowers'"'"'' .changeset/*.md` 期望 exit 1（零命中）；`grep -c '#246\|#137\|#139\|#109\|#208\|#209\|#71\|#216\|#217\|#218' .changeset/backlog-*.md`（命中行数：osuperpowers-major 1 / osuperpowers-minor 3 / osuperpowers-patch 1 / cdd-engine-major 1 / cdd-engine-minor 2 / cdd-engine-patch 2 合计 10——**10 ≠ 归并前 8 且是正确的**：p4-session-report-246 与 p5-session-report-246 是双包声明按轴拆分各 +1）；`cat .changeset/backlog-*.md | tr -d '`' | grep -o '#246 F[0-9]*\(/F[0-9]*\)*' | sort | uniq -c`（`F6/F13` 与 `F10/F11` 1→2 同拆分；`F1` / `F2/F3/F4/F12` / `F5` 必须严格 1→1，任一变 0 即丢声明）——第三条刻意先 `tr -d '`'` 去反引号再匹配（正文引用写作 `` `#246` F2/F3/F4/F12 ``） — checkable: 裸包名零命中（exit 1）；`closes #NNN` 计数按 (package × bump) 拆分预期（合计 10）；`F1`/`F2/F3/F4/F12`/`F5` 多重集 1→1 严格
  6. 全量 validate + emit check：`pnpm run validate` + `pnpm run emit:check` — checkable: 13 块全绿；无 drift
  7. Commit：`git add -A .changeset`；`git commit -m "chore(changeset): T6 — P3 双包 changeset（cdd-engine/osuperpowers minor）+ 存量 backlog 归并 14→6（含裸包名静默丢声明修复）"` — checkable: T6 变更面单提交落盘（conventional）

- **Acceptance**:
  - `.changeset/p3-cdd-command-surface.md` 落盘（双包 minor，正文含命令面收敛 + brief/research 删除 + 死配置 + 守卫）
  - 六条归并 changeset 落盘（(package × bump) 轴分配；逐条正文含去重合并叙述与全部 `closes #NNN`）
  - 14 条历史 backlog changeset 全部删除（git rm 零报错）
  - `[dry-run] write packages/osuperpowers/package.json: version → 1.0.0`（**与归并前一致**——osuperpowers 最高 bump 级仍为 major）；`would consume changesets` 列表 = 本程序 3 条 + 归并 6 条 = **9 条**
  - 裸包名零命中（exit 1）；`closes #NNN` 计数按 (package × bump) 拆分预期（合计 10）；`F1`/`F2/F3/F4/F12`/`F5` 多重集 1→1 严格
  - 13 块全绿；无 drift
  - T6 变更面单提交落盘（conventional）
