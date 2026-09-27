# osuperpowers 架构重构 P3 — cdd 命令面与契约收敛实施计划

**Spec:** [2026-09-13-osuperpowers-overhaul-p3-design.md](docs/osuperpowers/specs/2026-09-13-osuperpowers-overhaul-p3-design.md)

**Goal:** `cdd` 命令面由 6 子命令收敛为 4（implement / review / fix / base-branch）——删除零消费者的 `cdd brief`（engine 已由 `run-task.mjs:313` F11 自给）与 `cdd research`（唯一消费者 `cli-research` skill 一并删除），级联死配置连根，防回渗守卫钉死，存量 changeset backlog 归并。

**Architecture:** 按**删除面**分任务（命令 × 包 × 层）：T1/T2 各负责一条命令的**全量**移除（engine 源码 + 级联死配置 + 关联测试 + 陈旧注释枚举，含该命令的退役回归断言——真红→真绿）；T3 收口命令面形态断言；T4 清 skills 面（`cli-research`，emit 自动 prune `.agents/` 派生副本，**并同步块 5b 的 skills 目录计数常量**——字符串面查不到的耦合）；T5 加 stale-lexicon 守卫（命令形正则）；T6 建 changeset 并归并存量 backlog。删除安全性不变量已由 `tests/task.test.mjs:94/109/128` 钉死（implement 自给 brief），本 phase 不新增该面回归。

**Tech Stack:** Node ESM（cdd-engine lib/bin/tests）· Vitest（engine suite + scripts suite）· Commander v15 · tinyglobby · git rm / emit

## Global Constraints

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

---

### Task 1: `cdd research` 全量移除 — 命令面 + 级联死配置 + 关联测试 + 注释枚举

**Files:**
- Delete: `packages/cdd-engine/lib/cli/research.mjs`（`RESEARCH_METHODOLOGY` / `buildResearchPrompt` / `writeFindings` / `runResearch`）
- Delete: `packages/cdd-engine/tests/research.test.mjs`（4 例）、`packages/cdd-engine/tests/cdd-research.test.mjs`（13 例）
- Modify: `packages/cdd-engine/lib/cli/parse.mjs:3`（文件头 action 枚举去 `runResearch`）、`:9`（import）、`:19`（SUBCOMMAND_USAGE 键）、`:39`（description 去 `research`）、`:83-92`（命令块）
- Modify: `packages/cdd-engine/lib/lifecycle/cli.mjs:7`（`DEFAULT_TIMEOUTS`）、`:9`（`LEGACY_MODE_ENV` 整表）、`:20`（注释枚举）、`:23`（`modeEnv`）、`:38-44`（legacy 分支）
- Modify: `packages/cdd-engine/lib/lifecycle/proc.mjs:176-177`（六→五，**L177 的「6 文件」同步**）、`packages/cdd-engine/lib/cli/review.mjs:5`（4 消费方→3）
- Modify: `packages/cdd-engine/bin/cdd.mjs:3`（action 枚举分句）、`:8`（命令清单注释行）
- Modify: `packages/cdd-engine/tests/lifecycle.wiring.test.mjs:2,45,52,53-56`
- Modify: `packages/cdd-engine/tests/host-detection.test.mjs:2`
- Modify: `packages/cdd-engine/tests/cdd.test.mjs:3`（头注释）、删 `dry-run research → exit 0` 用例
- Modify: `packages/cdd-engine/tests/cli-shape.test.mjs`（追加退役断言）

**Interfaces:**
- Consumes: P3 design §2.3 / §2.4 / §2.5
- Produces: `cdd` 子命令集合 6→5；`lib/cli/research.mjs` 不存在；`DEFAULT_TIMEOUTS` = `{ task, review }`；`modeEnv` = `{ task, review }`；`LEGACY_MODE_ENV` 与其消费分支不存在。T5 的守卫 check 2 依赖本任务清空 `CDD_RESEARCH_TIMEOUT` / `RESEARCH_TIMEOUT` 字面
- **前置**：无（首个任务）

- [ ] **Step 1: 写失败断言（红）— `cdd research` 完整形态 → unknown command exit 2**

追加到 `packages/cdd-engine/tests/cli-shape.test.mjs` 末尾（既有 `review 传已被删除的 --doc` 用例之后、同一 `describe` 内）：

```js
  // P3 退役子命令：完整调用形态（bare 形态在删前亦 exit 2——Commander required-option 缺省——是假绿）
  it('cdd research（完整形态）→ unknown command exit 2（子命令退役）', () => {
    const r = runCli(['research', '--brief', SMOKE_PLAN, '--output', '/tmp/p3-retired-research.md'],
      { env: { ...HOST_ENV, CDD_DRY_RUN: '1' } });
    expect(r.exitCode).toBe(2);
    expect(r.stderr).toMatch(/usage: cdd/);
  });
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm --filter @oscaner-skills/cdd-engine exec vitest run tests/cli-shape.test.mjs -t 'cdd research（完整形态）'`
Expected: FAIL —— 删前 `cdd research` 存在，`CDD_DRY_RUN=1` 短路 → exitCode 0 ≠ 2

- [ ] **Step 3: 删命令注册（parse.mjs）**

删 L9 整行：

```js
import { runResearch } from "./research.mjs";
```

删 L19（`SUBCOMMAND_USAGE` 内）：

```js
  research: "usage: cdd research --brief <path> --output <path>",
```

L39 描述去 `research` 分句：

```js
  .description("CDD engine CLI — implement/review/fix/brief/base-branch")
```

删 L83-92 整块（含上方注释的 `research remains` 分句；`select removed (T2)` 分句保留）：

```js
// --- select removed (T2): harness selection/detection/install layer deleted — registry
//     converged to claude/cursor-agent; research remains (inline action logic; no library module).
program
  .command("research")
  .description("Standalone research runner (independent of implement/review)")
  .requiredOption("--brief <path>", "path to research brief markdown")
  .requiredOption("--output <path>", "path to write findings markdown")
  .action(async (opts) => {
    await runResearch(opts);
  });
```

替换为（注释保留但与陈述解耦）：

```js
// --- select removed (T2): harness selection/detection/install layer deleted — registry
//     converged to claude/cursor-agent.
```

- [ ] **Step 4: 删 CLI 处理器**

Run:

```bash
git rm packages/cdd-engine/lib/cli/research.mjs
```

- [ ] **Step 5: 级联死配置连根（lib/lifecycle/cli.mjs）**

L7：

```js
const DEFAULT_TIMEOUTS = { task: 1_800_000, review: 1_800_000 };
```

删 L9 整行：

```js
const LEGACY_MODE_ENV = { research: 'RESEARCH_TIMEOUT' };
```

L20 注释枚举收敛（**本行是 T5 守卫 check 2 的命中面**）：

```js
// per-mode env（CDD_TASK_TIMEOUT / CDD_REVIEW_TIMEOUT）契约单位为秒 ——
```

L23：

```js
  const modeEnv = { task: 'CDD_TASK_TIMEOUT', review: 'CDD_REVIEW_TIMEOUT' };
```

删 L38-44 的 legacy 分支整段（`LEGACY_MODE_ENV` 表已删，该段不可达）：

```js
  const legacyKey = LEGACY_MODE_ENV[mode];
  const legacy = legacyKey ? env[legacyKey] : undefined;
  if (legacy !== undefined) {
    const n = Number(legacy);
    if (Number.isNaN(n)) return DEFAULT_TIMEOUTS[mode];
    return scaleToMs(n);
  }
```

- [ ] **Step 6: 注释枚举收敛（非守卫命中面，保留不删会静默留存陈旧说明）**

`lib/cli/parse.mjs:3`（文件头 action 枚举——Step 3 已删 `runResearch` 的静态导入，本行须同一次收敛）：

```js
// usageError（parse 错误归一）归本文件；runReview/runFix 为静态导入的 action 主体。
```

`lib/lifecycle/proc.mjs:176-177`（**同一次编辑内两行**——L177 的计数 6 与本行同一陈述，只改 L176 会留下陈旧说明）：

```js
// 五个派发模块（run-task / run-docs / review / branch-review / fix）统一经此出口，
// 清除各模块重复的 finally 双行样板；wiring guard 断言使用而非 token 匹配 5 文件。
```

`lib/cli/review.mjs:5`：

```js
// 3 消费方（fix/parse/branch-review）与本文件经 shared 复用（单一 host 事实源）。
```

`bin/cdd.mjs:3`：

```js
// (review/fix actions + shared harness/Stopping guards in lib/cli/*). Zero command
```

删 `bin/cdd.mjs:8`：

```js
//   cdd research --brief <path> --output <path>
```

- [ ] **Step 7: 测试面同步（删两文件 + 改写两处）**

Run:

```bash
git rm packages/cdd-engine/tests/research.test.mjs packages/cdd-engine/tests/cdd-research.test.mjs
```

`tests/cdd.test.mjs`：删 `dry-run research → exit 0` 整个 `it(...)` 块；L3 头注释去 `select/research` 旧命令叙述：

```js
// 覆盖：帮助/用法、review 的 round+Stopping 接线（dry-run smoke）、fix --findings 接线、
// brief/contract 模块转发。CDD_DRY_RUN=1 跳过真实 harness 调用。
```

`tests/lifecycle.wiring.test.mjs`：L2 去计数（**plan 期 design 回填点**，出处/计数不可核验）：

```js
// spec §2.6：引擎全派生点全部经 spawnManaged（execxa 直接 import 仅允许 lib/lifecycle/proc.mjs）；
```

L45 六→五；删 L52 与列表项：

```js
    // 五个派发模块统一用 withLifecycle（startIdleMonitor → fn → finally stop + teardownAll）——
```

```js
    const fix = readFileSync(path.join(LIB, "cli", "fix.mjs"), "utf8");
    for (const [name, src] of [["run-task", runTask], ["run-docs", runDocs], ["review", review],
                               ["branch-review", branchReview], ["fix", fix]]) {
```

`tests/host-detection.test.mjs:2`：

```js
// cdd implement/review/fix no longer take a harness flag — the harness is resolved from
```

- [ ] **Step 8: 运行确认通过 + 全量 engine suite**

Run:

```bash
pnpm --filter @oscaner-skills/cdd-engine exec vitest run tests/cli-shape.test.mjs
pnpm --filter @oscaner-skills/cdd-engine test
pnpm exec vitest run
```

Expected: cli-shape PASS（含 Step 1 新例）；engine suite 全绿（用例数较 P2 末态下降：`research.test.mjs` 4 + `cdd-research.test.mjs` 13 + `cdd.test.mjs` 1 = 18）；根 vitest（scripts/**）全绿

- [ ] **Step 9: Commit**

```bash
git add -A packages/cdd-engine
git commit -m "refactor(cdd-engine): T1 — cdd research 全量移除（命令面 + 级联 timeout 死配置 + 关联测试 + 注释枚举）"
```

---

### Task 2: `cdd brief` 全量移除 — 命令面 + `validateBrief` 零生产者导出 + 测试裁剪

**Files:**
- Delete: `packages/cdd-engine/lib/cli/brief.mjs`（`runBriefCli` + `node lib/cli/brief.mjs` 直调 guard）
- Modify: `packages/cdd-engine/lib/cli/parse.mjs`（**下列行号 = T1 前基准；T1 已删 L9 / L19 与其研究命令块 8 行 → 锚点非均匀前移，一律按引用文本定位，勿按行号**）：`:11`→T1 后 `:10`（import `runBriefCli`）、`:20`→T1 后 `:18`（`SUBCOMMAND_USAGE.brief` 键）、`:39`→T1 后 `:37`（description 去 `brief`）、`:94-105`→T1 后 `:84-95`（brief 命令块）
- Modify: `packages/cdd-engine/lib/brief.mjs:1`（文件头 `generator + validator` → `generator`）、`:4`（`validateBrief` 注释行）、`:5-6`（CLI 迁移段）、`:27-30`（`validateBrief` 函数）
- Modify: `packages/cdd-engine/bin/cdd.mjs:9`（命令清单注释行）
- Modify: `packages/cdd-engine/tests/brief.test.mjs`（裁剪为 generateBrief-only）
- Modify: `packages/cdd-engine/tests/cdd.test.mjs`（删 `brief --task --plan --output` 用例）
- Modify: `packages/cdd-engine/tests/cli-shape.test.mjs`（追加退役断言）

**Interfaces:**
- Consumes: T1 的 parse.mjs 末态（description = `implement/review/fix/brief/base-branch`）
- Produces: `cdd` 子命令集合 5→4；`lib/cli/brief.mjs` 不存在；`lib/brief.mjs` 仅导出 `generateBrief`（`run-task.mjs:17` 消费面不变）。T3 的 help 断言与 T4/T5 依赖本任务完成
- **保留面**：`lib/brief.mjs#generateBrief` 及其 `repoRoot` 第 4 参数（#173）不动——它正是 `cdd brief` 可删的依据

- [ ] **Step 1: 写失败断言（红）— `cdd brief` 完整形态 → unknown command exit 2**

追加到 `packages/cdd-engine/tests/cli-shape.test.mjs`（Step 1 of Task 1 的新例之后）：

```js
  it('cdd brief（完整形态）→ unknown command exit 2（子命令退役）', () => {
    const r = runCli(['brief', '--task', '1', '--plan', SMOKE_PLAN, '--output', '/tmp/p3-retired-brief.md']);
    expect(r.exitCode).toBe(2);
    expect(r.stderr).toMatch(/usage: cdd/);
  });
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm --filter @oscaner-skills/cdd-engine exec vitest run tests/cli-shape.test.mjs -t 'cdd brief（完整形态）'`
Expected: FAIL —— 删前该形态生成 brief → exitCode 0 ≠ 2

- [ ] **Step 3: 删命令注册（parse.mjs）**

删 import `runBriefCli` 整行（按引用文本定位；T1 前 L11 / T1 后 L10）：

```js
import { runBriefCli } from "./brief.mjs";
```

删 `SUBCOMMAND_USAGE.brief` 键整行（按文本定位；T1 前 L20 / T1 后 L18）：

```js
  brief: "usage: cdd brief --task <n> --plan <path> [--output <path>]",
```

description 行去 `brief` 分句（按文本定位；T1 前 L39 / T1 后 L37。本 phase 命令面终态）：

```js
  .description("CDD engine CLI — implement/review/fix/base-branch")
```

删 brief 命令块整块（含上方 `--- brief (delegated to lib module CLI entry…)` 注释；按文本定位，T1 前 L94-105 / T1 后 L84-95）。**边界警告**：该块**下一条即** base-branch 注释块（`// --- base-branch (P5 spec §2.3): 纯 artifact 命令 …`）——按陈旧行号 `:105` 定位会越界误删之，删除终点以 `  ]));` 与随后的块间空行为界：

```js
// --- brief (delegated to lib module CLI entry; Commander opts → 结构化 argv，不二次解析 process.argv) ---
program
  .command("brief")
  .requiredOption("--task <n>", "task number")
  .requiredOption("--plan <path>", "plan path")
  .option("--output <path>", "brief output path")
  .action((opts) => runBriefCli([
    "--task", String(opts.task),
    "--plan", opts.plan,
    ...(opts.output ? ["--output", opts.output] : []),
  ]));
```

- [ ] **Step 4: 删 CLI 处理器**

Run:

```bash
git rm packages/cdd-engine/lib/cli/brief.mjs
```

- [ ] **Step 5: `lib/brief.mjs` 去死面（`validateBrief` 零生产者 —— 全仓唯一引用是待删的 3 个测试用例）**

文件头 L1 去 `+ validator` 半句（`validateBrief` 删除后该半句失真）：

```js
// packages/cdd-engine/lib/brief.mjs — CDD task brief generator（纯库模块）。
```

删 L4：

```js
// validateBrief: check brief contains TASK_BASE: line.
```

L5-6 的 CLI 迁移段整段删除（指向已删文件的陈旧说明）：

```js
// CLI 处理器（runBriefCli + 直调 guard）已迁 lib/cli/brief.mjs（spec §2.6 归 cli 簇）——本文件
// 无 process.argv 直调 guard：`node lib/brief.mjs` 是 inert 库加载（无 CLI 行为）。
```

删 L27-30 函数：

```js
export function validateBrief(briefPath) {
  if (!existsSync(briefPath)) return false;
  return readFileSync(briefPath, "utf8").split("\n").some((l) => l.startsWith("TASK_BASE:"));
}
```

**L7 import 行不动**——`existsSync` 仍被**保留面** `generateBrief` 使用（L11 `if (!existsSync(planFile)) throw …`）：

```js
import { existsSync, readFileSync, writeFileSync } from "node:fs";
```

（勿收敛为 `{ readFileSync, writeFileSync }`：那会使 `generateBrief` 每次调用即 `ReferenceError`，打断 `run-task.mjs` 的 brief self-provision（F11）与 `tests/brief.test.mjs` 全部 `generateBrief` 用例。）

- [ ] **Step 6: `bin/cdd.mjs` 命令清单注释**

删 L9：

```js
//   cdd brief --task <n> --plan <path> [--output <path>]
```

- [ ] **Step 7: 测试面裁剪**

`tests/cdd.test.mjs`：删 `brief --task --plan --output → 生成 brief + {brief} JSON` 整个 `it(...)` 块（含其 `mkdtempSync` 包装）。

`tests/brief.test.mjs`：删 CLI 用例组（`--- CLI entry point tests ---` 分隔线与 `BRIEF_MJS` / `LIB_BRIEF_MJS` / `cliRun` helper）、`CLI --task N --plan --output` / `CLI --task N: missing task` / `node lib/brief.mjs 直跑` 三例、`validateBrief` 三例（含文件头 `validateBrief：…` 说明行）。

导入面**逐项**核过（保留面 `generateBrief` 用例仍消费 `execFileSync` L79 与 `realpathSync` L69-70——**勿整行删**）：

- 删 `existsSync`（唯一用处是待删的 `node lib/brief.mjs 直跑` 用例 L164）→ `node:fs` 收敛为 `import { mkdtempSync, writeFileSync, readFileSync, realpathSync } from "node:fs";`
- 删 `validateBrief` → `../lib/brief.mjs` 导入收敛为 `import { generateBrief } from "../lib/brief.mjs";`
- **保留** `import { execFileSync } from "node:child_process";`（`generateBrief #173` 用例 `git rev-parse HEAD` 仍需）
- **保留** `realpathSync`（同上用例 L69-70 的 `realpathSync(mkdtempSync(...))`）
- **保留** `gitCommit` / `gitInit` / `HERE` / `REPO_ROOT` / `path` / `fileURLToPath` / `tmpdir`（generateBrief 用例仍需 git repo 与 `REPO_ROOT` 作第 4 参数）

文件头 4 行（L1-4，含 L4 的 `validateBrief：…` 说明行）收敛为：

```js
// engine/tests/brief.test.mjs — brief 生成模块单测（Node port）。
// generateBrief：从 plan 机械提取 ### Task N: 段落，追加 TASK_BASE: <sha>，写入 brief。
//   plan 缺失 → throw；task 段落缺失 → throw；git HEAD 不可取 → throw。
//   （`cdd brief` CLI 与校验导出已于 P3 移除——本文件仅覆盖保留面 generateBrief。）
```

- [ ] **Step 8: 运行确认通过 + 全量 engine suite**

Run:

```bash
pnpm --filter @oscaner-skills/cdd-engine exec vitest run tests/cli-shape.test.mjs
pnpm --filter @oscaner-skills/cdd-engine test
```

Expected: cli-shape PASS（含两例退役断言）；engine suite 全绿；`brief.test.mjs` 仅剩 generateBrief 家族（12 例 → 6 例：删 3 CLI 用例 + 3 `validateBrief` 用例）

- [ ] **Step 9: Commit**

```bash
git add -A packages/cdd-engine
git commit -m "refactor(cdd-engine): T2 — cdd brief 全量移除（命令面 + validateBrief 死导出 + 测试裁剪为 generateBrief-only）"
```

---

### Task 3: 命令面形态收口 — 顶层命令集合静态断言 + `-h` help 断言

**Files:**
- Modify: `packages/cdd-engine/tests/cli-shape.test.mjs`（追加顶部 import + 顶层命令集合断言）
- Modify: `packages/cdd-engine/tests/cdd.test.mjs:80`（`-h → help` 断言）

**Interfaces:**
- Consumes: T1 + T2 的 parse.mjs 末态（顶层命令恰为四）
- Produces: AC1 的机器判定——`program.commands.map(c=>c.name())` 集合相等断言（**不用文本正则**：`base-branch` 经 `const baseBranch = program` 换行链式注册，`program` 不在行首；无锚正则会把嵌套 `set`/`get` 收进集合）
- **`--help` 计数陷阱（勿按文本集合计数）**：Commander 自动注册的 `help [command]` **只出现在 `--help` 文本的 Commands 段，`program.commands` 不含它**（实测：`new Command()` + 两次 `.command()` 后 `program.commands` 为 `['foo','bar']`，而 `helpInformation()` 的 Commands 段为 `foo` / `bar` / `help [command]` 三行）。故 design §2.10「`cdd --help` 实跑：子命令集合恰为四」须按其操作口径读作实例断言：实跑删 brief/research 后的 `cdd --help`，Commands 段为 **5 行**（四命令 + 隐式 `help`）。任何基于 `--help` 文本的「恰为四」计数都会数到 5 而**假失败**；本任务 Step 3 的 `-h` 断言刻意只用正向 `/implement\/review\/fix\/base-branch/` + 负向 `\bbrief\b|\bresearch\b`，不做集合计数
- **依赖**：必须在 T1/T2 之后（T1/T2 完成前集合为 6/5，断言必红）

- [ ] **Step 1: 写顶层命令集合断言（红/绿由 T1+T2 决定）**

`packages/cdd-engine/tests/cli-shape.test.mjs` 顶部 import 区追加：

```js
import { program } from '../lib/cli/parse.mjs';
```

文件末尾（既有 `describe` 之后）追加：

```js
// P3：命令面收敛为四（implement / review / fix / base-branch）。
// 静态实例断言优先于文本正则——commander 的 program.commands 只含**直接**子命令，
// 嵌套的 baseBranch.command("set") / ("get") 自然不入集（parse.mjs 文件头明载
// 「本文件可被测试静态读（cli-shape），import 后无副作用」；parseAsync 由 bin 薄入口 isMain 触发）。
// 注意：Commander 隐式注册的 help [command] 只进 `--help` 文本的 Commands 段、不入 program.commands
// ——故集合判据只能取下面的实例断言，任何基于 `--help` 文本的「恰为四」计数会数到 5 项而假失败。
describe('P3 命令面收敛：顶层子命令恰为四', () => {
  it('program.commands 名称集合 === {base-branch, fix, implement, review}', () => {
    expect(program.commands.map((c) => c.name()).sort()).toEqual(
      ['base-branch', 'fix', 'implement', 'review'],
    );
  });

  it('源码面无 .command("brief") / .command("research") 注册', () => {
    const src = readFileSync(PARSE_MJS, 'utf8');
    expect(src).not.toMatch(/\.command\("brief"\)/);
    expect(src).not.toMatch(/\.command\("research"\)/);
  });
});
```

- [ ] **Step 2: 运行确认通过**

Run: `pnpm --filter @oscaner-skills/cdd-engine exec vitest run tests/cli-shape.test.mjs`
Expected: PASS（若集合仍含 `brief` 或 `research` → T1/T2 未完成，先回补）

- [ ] **Step 3: `-h → help` 断言改写（cdd.test.mjs:80）**

```js
  it("-h → help", () => {
    const r = execaSync(NODE, [CDD_MJS, "--help"], { cwd: REPO_ROOT, env: cleanEnv(), extendEnv: false });
    expect(r.stdout).toMatch(/implement\/review\/fix\/base-branch/);
    expect(r.stdout).not.toMatch(/\bbrief\b|\bresearch\b/);
  });
```

（第二条是**真断言**：T1/T2 前 `--help` 列出 `research` / `brief` 两命令与描述文本，必红。）

- [ ] **Step 4: 运行确认通过 + 全量 engine suite**

Run:

```bash
pnpm --filter @oscaner-skills/cdd-engine test
```

Expected: 全绿

- [ ] **Step 5: Commit**

```bash
git add -A packages/cdd-engine
git commit -m "test(cdd-engine): T3 — 顶层命令集合恰为四（静态实例断言）+ -h help 断言去 brief/research"
```

---

### Task 4: `cli-research` skill 删除 + emit（`.agents/` 派生副本自动 prune）

**Files:**
- Delete: `packages/osuperpowers/skills/cli-research/`（整目录：`SKILL.md`）
- Modify（emit 派生，自动）: `packages/osuperpowers/.agents/skills/osuperpowers/cli-research/SKILL.md`（删除）
- Modify: `scripts/validate/osuperpowers.mjs:46-47`（**skills 目录计数耦合**——`EXPECTED` 7→6、`EMITTERS_LABEL` → `"5 emitters + init"`、L46 注释同步登记 P3 删除）

**Interfaces:**
- Consumes: T1/T2（命令已不存在，skill 的 `cdd research` 调用链已断）
- Produces: `packages/osuperpowers/skills/` 零 `cli-research`；`.agents/` 派生副本同步消失；块 5b 的 skills-count 常量收敛后计 6。**T5 的守卫 check 1 依赖本任务**（其 scope 含 `OSKILLS` = `packages/osuperpowers/skills`）
- **零注册面（字符串面已实测，但有一处计数耦合 —— 非「无需同步注册」）**：`packages/osuperpowers/package.json` 无 skill 枚举（目录扫描发现）/ `marketplace/source.json` / 根 `README.md` / `packages/osuperpowers/README.md` / `docs/maintainers/*.md` / `packages/osuperpowers/tests/digraph-consistency.test.mjs`（走 `readdirSync(SKILLS_DIR)`，无硬编码清单）**字符串面**均无 `cli-research` 引用。**但 `scripts/**` 存在一处字符串不可循的耦合**：`scripts/validate/osuperpowers.mjs:46-47` 的 `EXPECTED = 7` / `EMITTERS_LABEL = "6 emitters + init"` 是**目录计数**断言（块 5b，L53/L59/L64 三处 `assert(n === EXPECTED)`；`plugin.json#skills: "./skills/"` 走 string 分支 → `countSkillsWithMarkdown` 实数 7）。删 `cli-research` 后实数 6 → **命名 grep 查不到，不查计数必红**（which = "零引用" 自检方法的盲区）。先例：P5 `cli-select` 删除同形（8→7 + label 同步）；design §2.6 注册面口径补充已单列此项
- **路径口径**：emit 产物落点是 `packages/osuperpowers/.agents/skills/osuperpowers/`（**全仓相对路径**）；本仓根**不存在** `.agents/`（根相对写法会落到不存在的路径上 → 恒真假通过）

- [ ] **Step 1: 删 skill 目录**

```bash
git rm -r packages/osuperpowers/skills/cli-research
```

- [ ] **Step 2: skills-count 常量收敛（`scripts/validate/osuperpowers.mjs` —— 否则块 5b 必红）**

`EXPECTED` 7→6、`EMITTERS_LABEL` 同步（`6 emitters + init` → `5 emitters + init`）：

```js
  const EXPECTED = 6; // 5 emitters + init (T2 removed cli-select; P5 removed three legacy skills; P3 removed cli-research)
  const EMITTERS_LABEL = "5 emitters + init";
```

- [ ] **Step 3: emit 重生成派生面**

Run: `pnpm run emit`
Expected: `packages/osuperpowers/.agents/skills/osuperpowers/cli-research/` 消失。机制（`scripts/emit/osuperpowers.mjs:78-84`）：`pruneStaleAgentsNamespaces` 后对整 namespace `rmSync(dest)` + `cpSync(sourceRoot, dest)` —— 源目录删除即随之消失，**无需手写清理**

- [ ] **Step 4: 验证 prune 生效（对抗性：断言落在真实路径上）**

Run:

```bash
test ! -e packages/osuperpowers/skills/cli-research && echo "OK skills"
test ! -e packages/osuperpowers/.agents/skills/osuperpowers/cli-research && echo "OK agents"
git status --porcelain packages/osuperpowers/.agents
```

Expected: 两行 OK；`git status` 显示 `.agents/skills/osuperpowers/cli-research/SKILL.md` 为 **D**（deleted，emit 已将其从工作树移除且为 git 跟踪文件）

- [ ] **Step 5: emit drift 校验 + 全量 validate**

Run:

```bash
pnpm run emit:check
pnpm run validate
```

Expected: 无 drift；13 块全绿（块 5b 输出为 `OK — 6 osuperpowers skills (directory ./skills/)`——若仍报 `expected 7 … got 6`，即 Step 2 未落地）

- [ ] **Step 6: Commit**

```bash
git add -A packages/osuperpowers scripts/validate/osuperpowers.mjs
git commit -m "refactor(osuperpowers): T4 — 删除 cli-research skill（随 cdd research 移除，唯一调用方同步）+ skills-count 常量收敛 + emit"
```

---

### Task 5: 防回渗守卫 — 已删 cdd 子命令（命令形）+ research timeout env

**Files:**
- Modify: `scripts/validate/residue.mjs`（`STALE_LEXICON_CHECKS` 追加两条 + 文件头语义枚举）
- Modify: `scripts/validate/residue.test.mjs`（追加 describe 块 + 临时文件扫描用例）

**Interfaces:**
- Consumes: T1（清空 engine 内 `cdd research` / `CDD_RESEARCH_TIMEOUT` / `RESEARCH_TIMEOUT` 全部字面）+ T2（清空 `cdd brief`）+ T4（清空 skills 内 `cli-research`）
- Produces: 与 P1（`.superpowers/cdd` / `standalone`）、P2（`docs/superpowers`）同族的第三条 stale-lexicon 守卫；`collectStaleLexiconHits()` live-repo 零残留（block 5c）覆盖之
- **依赖**：T1/T2/T4 全部完成后本任务才能绿（live-repo 零残留是硬条件）

- [ ] **Step 1: 写失败断言（红）— 守卫行为 + live-repo 零残留**

`scripts/validate/residue.test.mjs` 追加（既有 `stale-lexicon：old docs root 守卫（Task 5）` describe 之后）：

```js
// Task 5（P3）：已删 cdd 子命令守卫。字面经字符串拼接构造（P2 先例）——本文件不在任何
// 守卫 scope 内（守卫 scope = OSKILLS + CDD_ENGINE + DOC_SURFACE_TARGETS，无 scripts/），
// 但守卫测试保持零字面，可在 scope 未来扩张时不反噬自身。
describe("stale-lexicon：removed cdd subcommand 守卫（Task 5）", () => {
  const CDD = "cd" + "d";
  it("命令形命中；裸 research / brief 放行（P4 合法调用面）", () => {
    expect(hasHit([`Run \`${CDD} research --brief x --output y\``])).toBe(true);
    expect(hasHit([`Run \`${CDD} brief --task 1 --plan p --output o\``])).toBe(true);
    expect(hasHit(["/mattpocock-skills:research 会话调用"])).toBe(false);
    expect(hasHit(["brief-dependent plan sections"])).toBe(false);
    expect(hasHit(["cddr research"])).toBe(false);        // 词边界：非 `cdd ` 前缀
  });
  it("research timeout env 命中；task/review timeout 放行", () => {
    expect(hasHit([`${"CDD_RESEARCH"}_TIMEOUT=2700`])).toBe(true);
    expect(hasHit([`${"RESEARCH"}_TIMEOUT=2700`])).toBe(true);
    expect(hasHit(["CDD_TASK_TIMEOUT=60"])).toBe(false);
    expect(hasHit(["CDD_REVIEW_TIMEOUT=60"])).toBe(false);
  });
  it("含命令形的临时文件被 collectStaleLexiconHits 命中（扫描面在扫）", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "residue-p3-"));
    const f = path.join(dir, "note.md");
    writeFileSync(f, `Run \`${CDD} research --brief b\`\n`, "utf8");
    try {
      const hits = collectStaleLexiconHits([dir]);
      expect(hits).toHaveLength(1);
      expect(hits[0].label).toBe("removed cdd subcommand (pre-P3)");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm exec vitest run scripts/validate/residue.test.mjs`
Expected: FAIL —— `hasHit` 尚未含新 check（正例返 `false`），label 未定义

- [ ] **Step 3: 加守卫（residue.mjs）**

`STALE_LEXICON_CHECKS` 数组内、P2 的 `old docs root (pre-P2)`条目之后追加：

```js
  // Task 5（P3）：已删 cdd 子命令（**命令形**，非裸词——P4 合法的 /mattpocock-skills:research
  // 会话调用与活体文本 cli-driven-development/SKILL.md:66 的 `brief-dependent plan sections`
  // 均须放行）+ research 专属 timeout env（随 LEGACY_MODE_ENV/modeEnv.research 连根删除）。
  { label: "removed cdd subcommand (pre-P3)", re: /\bcdd (brief|research)\b/, scope: [...ALL_MECH_POSITIONS, ...DOC_SURFACE_TARGETS] },
  { label: "removed research timeout env", re: /CDD_RESEARCH_TIMEOUT|RESEARCH_TIMEOUT/, scope: CDD_ENGINE },
```

文件头语义枚举（L2-12）追加一处收尾分句（该头注释是 P4/P6 迁移终态的单一索引）：

```
// the old docs root (pre-P2), the removed cdd subcommands `brief` / `research` (pre-P3,
// command-form only — bare words stay legal), and the removed research timeout envs
```

- [ ] **Step 4: 运行确认通过（守卫行为）**

Run: `pnpm exec vitest run scripts/validate/residue.test.mjs`
Expected: PASS（含既有 `collectStaleLexiconHits() === []` live-repo 用例）

- [ ] **Step 5: 确认 live-repo 零残留（若红，回补 T1/T2/T4）**

Run:

```bash
node scripts/validate/residue.mjs
```

Expected: `ALL PASS`。若报 `removed cdd subcommand (pre-P3)` 命中 → 输出中的文件即遗漏面（engine 面回 T1/T2，skills 面回 T4）

- [ ] **Step 6: Commit**

```bash
git add scripts/validate/residue.mjs scripts/validate/residue.test.mjs
git commit -m "test(validate): T5 — stale-lexicon 守卫：已删 cdd 子命令（命令形）+ research timeout env"
```

---

### Task 6: changeset — 本 phase 双包声明 + 存量 backlog 归并（14 → 6）

**Files:**
- Create: `.changeset/p3-cdd-command-surface.md`（本 phase，双包）
- Create: `.changeset/backlog-osuperpowers-major.md` / `backlog-osuperpowers-minor.md` / `backlog-osuperpowers-patch.md` / `backlog-cdd-engine-major.md` / `backlog-cdd-engine-minor.md` / `backlog-cdd-engine-patch.md`
- Delete: 14 条历史 backlog changeset（见 Step 3）

**Interfaces:**
- Consumes: T1–T5 的全部交付面（命令面四收敛 + skill 删除 + 守卫）
- Produces: `.changeset/` 内本程序 per-phase 三条（`p1-cdd-runtime-layout-singleton` / `p2-docs-root-migration` / `p3-cdd-command-surface`）+ 归并六条；`pnpm run version --dry-run` 的 next 版本仍为 **1.0.0**
- **归并轴 = (package × bump level)**：文件的 bump 级决定其渲染到的 changelog 段落，故跨包文件被拆到对应的两个文件；`@oscaner-skills/cdd-engine` 不在 `.changeset/versioned-plugins.json` 内 → 其 changeset 是**声明性**的（不产生版本效果），归并仅为整洁与消除裸包名缺陷

- [ ] **Step 1: 写本 phase changeset**

创建 `.changeset/p3-cdd-command-surface.md`：

```markdown
---
"@oscaner-skills/cdd-engine": minor
"@oscaner-skills/osuperpowers": minor
---

P3 cdd 命令面收敛：`cdd` 子命令由 6 收敛为 4（implement / review / fix / base-branch）。

- **`cdd brief` 删除**：零消费者——engine 已在 implement 的 plan 定稿处自给 brief（`run-task.mjs` F11：`generateBrief` + `CDD_TASK_BRIEF` override 写/读同源 + dir bootstrap）；`lib/brief.mjs#generateBrief` 保留供 run-task。
- **`cdd research` 删除**：唯一消费者 `cli-research` skill 一并删除（删除命令必须同步其唯一调用方）；`lib/cli/research.mjs`（`RESEARCH_METHODOLOGY` / `buildResearchPrompt` / `writeFindings` / `runResearch`）与 `lib/cli/brief.mjs`（`runBriefCli`）整文件移除。
- **级联死配置连根**：`DEFAULT_TIMEOUTS.research` / `modeEnv.research`（`CDD_RESEARCH_TIMEOUT`）/ `LEGACY_MODE_ENV` 整表及 `resolveTimeoutMs` 的 legacy 分支 / 零生产者的 `lib/brief.mjs#validateBrief`。
- **防回渗守卫**：新增 stale-lexicon 两条（命令形 `/\bcdd (brief|research)\b/` + `/RESEARCH_TIMEOUT/`）——命令形刻意非裸词，保留 `/mattpocock-skills:research` 会话调用的合法空间。

> **semver 说明**：`cdd brief` / `cdd research` 的删除实为 **breaking**（如实应为 `cdd-engine` major），本次按 minor 发布。
```

- [ ] **Step 2: 写归并声明（六条，内容 = 14 条历史 backlog 的去重合并；`closes #NNN` 全保留）**

`.changeset/backlog-osuperpowers-major.md`：

```markdown
---
"@oscaner-skills/osuperpowers": major
---

引擎独立化 + gate/harness 选择层整体移除（**BREAKING**，含 `cdd-engine` 侧同名声明）：

- **`@oscaner-skills/cdd-engine` 抽为独立包**（v1.0.0，5 CLI + lib + templates 单独发布）：osuperpowers 删除 `bin/engine/`，改依赖 `@oscaner-skills/cdd-engine`（workspace:* → 发布时转 npm）。Commander v15 / execa v9 取代手写子进程 / ajv v8 schema 校验 / semver / Vitest v3 取代 node:test。Bug A–P 修复与增强：`--task` parseInt 强制（A）、standalone branch-review CLI（B/D）、task-review 模板节点序（C）、docs-task workspace 与子进程 cwd=git toplevel（K/L）、删 cdd-session-activate + gate 激活改 `CDD_GATE_WORKSPACE`/`CDD_GATE_MODE`（O）、cli-driven-development 去 deferred/ledger 节点并对齐 Review Stopping（M/N）、detect-engine gate（F）、init 单命令（G）、per-mode prefix/suffix 模板注入（P）；`#137`（子进程 env 剥离 ANTHROPIC_API_KEY + execa timeout）、`#139`（NDJSON 行解析器取代手写 stream-json 扫描）、`#109`（`invokeCliWithRetry`）。模板重组为 `templates/{task,review,schema}/`。
- **gate 子系统 + harness 选择/探测/安装层整体删除**：`bin/gate/`（core + 11 adapters + configs/tests + `tests/fixtures/cdd-gate/**`）、PreToolUse gate hooks、`bin/init/` + install-harness + `.github/actions/install-harness/` + pr-validate 引用、`cdd select` 子命令 + `cli-select` skill + `harness-detect.mjs`（双份）+ skills-probe（双份）。`--harness` 删除（宿主即目标：`detectCurrentHarness(env)`，空 → BLOCK exit 1；marker 优先级 CURSOR_TRACE_ID > CLAUDE_CODE_SESSION_ID > AI_AGENT=claude-code*）；`--doc` 退役（D11：`--spec`/`--plan` 目标参数统一）；`harness-registry.json` 7→2 键（claude / cursor-agent），per-harness emit 产物（.codex/.qoder/.kimi/gemini/GEMINI.md）删除；`progress.json` 所有权收归 engine（D14）。osuperpowers 侧：`init` 收缩为 single-node marketplace 指引、`cli-driven-development` / `cli-research` 去 select-harness 节点与 I1 Explicit Propagation invariant、brainstorming / writing-plans 审阅节点改 `--spec`/`--plan` 形态。
```

`.changeset/backlog-osuperpowers-minor.md`：

```markdown
---
"@oscaner-skills/osuperpowers": minor
---

- CDD engine 重构：薄 `runner.mjs` 派发器、`handoff-schema.json`、模板重组、`progress.json`、编排侧业务逻辑归位。
- **单 bin + URC review contract + harness operation×type 注入**：五个 legacy bin（cdd-task / docs-task / branch-review / cdd-select / cdd-research）删除，实现/review×{task,branch,spec,plan}/fix/select/research/brief/contract 全部经单一 Commander 入口；六个 legacy review/fix 模板收敛为 `templates/review/` = `review.md` 共享壳 + `reviews.json` per-type 配置 + `doc-fix.md`，`templates/task/` = `implement.md` + `fix.md`；Review Stopping（URC）单周期单派发 + always-fix-all（APPROVED/blocker=0 拒绝同 ref 重派 → exit 3）；`harness-registry.json` prefix/suffix 按 `(op, type)` 解析；handoff schema 增可选 `notes`（Enh T）、删 `markDeferred` 残留（Enh S）；规则 SSoT 收敛到 `skills/_docs/review.md`（取代 docs-review.md，D1/D2/D3/`PASS=<` 旧语汇清除）。
- **report-issue 双通道重构 + finding-meta 渲染器 + 方法论规范 + Enh K 全量回顾**：程序通道（→ phase-owning issue）vs 会话通道（→ find-or-create `[Session report] <slug|standalone> <date>` master，labels `session`, `osuperpowers`）；新 digraph `analyze → classify → confirm → resolve-destination → {program · session} → dedup → append-comment → report`；无 resolve-hit / `gh issue reopen` / `dogfood,<type>[,cdd]` labels；`.superpowers/cdd/<slug>/report-target.json` 缓存（CDD scope only）；never-reopen dedup；派生 report-meta 六字段 + 隐私码（不含 branch/绝对路径/文件名）；gh 操作一律 `--repo Oscaner/skills`。`report-issue/templates/finding-meta.json` 单一权威 → `scripts/report-templates.mjs` 纯渲染器 → emit 生成 `.github/ISSUE_TEMPLATE/*.yml`。brainstorming `explore-context` 全量 issue 回顾（含 Side-effect closures，读全 body + 全部评论，fail-open）。Enh R 预消费、Enh V/W 证实被取代。
- **skills 面收口（p6-cdd-engine-overhaul 的 osuperpowers 侧）**：`cli-select` failure-mode recovery 去「same labels as above」——显式 no-manual-labels（仅 session master 携带 `session`, `osuperpowers`）；`writing-plans` 的 `write-plan` 节点钉死 plan 头 `**Spec:**` 二行约定 —— `**Spec:** [<name>-design.md](docs/superpowers/specs/<name>-design.md)`，与 `plan-review --spec` 指针同源（report-issue `resolve-destination` program 链首跳）。
- **report-issue session context 模型 + evidence 双向契约 + master 只建不更（p6-report-issue-session-context）**：session context（root / workspace / channel / subject）由纯函数派生 —— standalone 不再误路由到程序 issue；evidence 撰稿双向契约（consumer-neutral + maintainer-reproducible，取代 I6 排除清单）；master 标题 subject 化（standalone 带 topic，kind 词不入标题）；master 只建不更（废除 Findings Summary 表镜像，findings 一律评论 append-only）（Closes `#246` F2/F3/F4/F12）。
- **overall 四表机械守卫 + 登记规则收敛 + CDD 死档清除（p4-session-report-246 的 osuperpowers 侧）**：validate block 12（Closes `#246` F6/F13）。
- **skills/docs 编排收敛（p5-session-report-246 的 osuperpowers 侧）**：`dispatch-mode` 删 brief 前置步、`determine-base` / `read-base` 委托只读、`base-branch.md` 4 值 enum + 双 slug 拆分、`_docs/review.md` slug 同步（Closes `#246` F10/F11）。
```

`.changeset/backlog-osuperpowers-patch.md`：

```markdown
---
"@oscaner-skills/osuperpowers": patch
---

- refactor(brainstorming)：mode-aware digraph 重构——grilling 决策节点、propose-phase-approaches、charter-approves?、I8 invariant；docs(skill-authoring)：新增 §10 Anti-patterns（Node-anchored SKILL.md）。
- cleanup：清 router 死代码（插件已移除）；退役 zh-CN mirror 政策；report-issue 隐私擦除；writing-plans I2 移除；CDD handoff phase 字段修复（`#208` `#209` `#71` `#216` `#217` `#218`）。
- refactor(report-issue)：closed issue 去重检测、reopen+comment 流程；refactor(brainstorming)：Review Stopping I5 措辞更新 + Failure Modes 条目；refactor(writing-plans)：H3 invariant（I5）+ Review Stopping（I4）；refactor：docs-review.md 迁 `_docs/`（跨 skill 共享）；docs：强化 CLAUDE.md 的 emit-after-edit 规则。
```

`.changeset/backlog-cdd-engine-major.md`：

```markdown
---
"@oscaner-skills/cdd-engine": major
---

- **包抽离（v1.0.0）**：新包 `@oscaner-skills/cdd-engine`——5 CLI（cdd-task / docs-task / branch-review / cdd-select / cdd-research）+ `lib/` + `templates/` 独立发布；Commander v15 / execa v9 / ajv v8 / semver / Vitest v3 落位。Bug A–P 与 Enh F/G/P 修复见 osuperpowers major 条目（同批变更的双包声明）。`#137` `#139` `#109`。
- **单 bin + URC review contract（BREAKING）**：五个 legacy bin 删除，收敛为单一 `bin/cdd.mjs` Commander 入口；模板数据化（`templates/review/` + `reviews.json`）；Review Stopping 单周期单派发 + always-fix-all + per-type round 序列（`resolveNextRound`）；`harness-registry.json` 按 `(op,type)` 注入；`cdd contract --check-dirty/--check-head/--clear-findings`；`CDD_DRY_RUN=1` dry-run。
- **去 gate + harness 选择层（BREAKING）**：`cdd-gate` 子系统整体删除；`--harness` / `--doc` 参数删除；host 判定自包含（宿主即目标）；`progress.json` engine-owned（D14：`engineRecoveryCount` 由 runner 自写，orchestrator 只读）。
- **handoff 契约统一 + review mode 归一 + stale-lexicon 守卫（BREAKING）**：`cdd contract` 子命令删除；implement handoff 改由 runner 实体化（agent 不再手写 handoff）；`task-review` mode → `review`（`CDD_MODE` / `VALID_MODES` / progress `rounds["review"]` / handoff `phase`；schema phase enum → `["implement","review","fix","branch-review"]`）；handoff 命名 canonical 单一权威（`templates/handoff-namespace.json`，`{type}-{op}[-{round}]`）；workspace 单根 `.superpowers/cdd/<slug>/`（flat `.superpowers/docs-review/` 退役）；status 由 `rollupStatus(findings)` 派生（SP-4 失败轮豁免）；`writeOwnHandoff` 全量覆写定稿统一 + post-run commit-contract；`scripts/validate/residue.mjs` stale-lexicon 零豁免守卫入 5c 步。
```

`.changeset/backlog-cdd-engine-minor.md`：

```markdown
---
"@oscaner-skills/cdd-engine": minor
---

- `cdd review --type spec|plan` 的 Stopping ref 升级为 (doc_path, doc_hash) 内容状态双签名：内容实质演进即新 ref、可开新 review cycle；未变内容仍 exit 3；legacy handoff 硬停保留（Closes `#246` F5）。
- 进程生命周期统一管理：全部派生点纳入进程组所有权（`spawnManaged` detached 进程组 + `teardownAll` run 边界连根回收 + 跨 run `reapStale` 孤儿兜底），修长时间运行后 `claude -p` 驻留进程累积；目录结构重排（bin 薄入口 + lib 分簇 + tests 顶层，npm 发布不再含 tests）（Closes `#246` F1）。
```

`.changeset/backlog-cdd-engine-patch.md`：

```markdown
---
"@oscaner-skills/cdd-engine": patch
---

- overall 四表机械守卫（validate block 12）+ 登记规则收敛 + CDD 死档清除；无记录 handoff 读健壮性修复（坏 JSON → BLOCKED / corrupt prev → fail-open）（Closes `#246` F6/F13）。
- CDD 编排硬化：`cdd base-branch set/get` 子命令（base-branch artifact 由 engine 唯一写入，schema 4 值 enum + `confirmed_at` 必填 + 幂等 + `--force` + CDD 落点）；implement dispatch 自供应 brief（`cdd implement --plan` 单次调用拿全实现上下文）；workspace slug 收敛（strip 单一 `-design`/`-plan` suffix）；代码目录/CLI 整理（删 bin `.gitkeep`、拆 `cli/shared`）；`cdd brief` 前置调用兼容保留、可以安全删除（P3 已兑现）（Closes `#246` F10/F11）。
```

- [ ] **Step 3: 删 14 条历史 backlog changeset**

```bash
git rm .changeset/p-delta-cdd-refactor.md .changeset/p-epsilon-cleanup.md \
  .changeset/p-gamma-brainstorming-restructure.md .changeset/p-zeta-cdd-engine-cli-shared.md \
  .changeset/p2-session-report-246-stopping-ref.md .changeset/p3-cdd-engine-overhaul.md \
  .changeset/p4-cdd-engine-overhaul.md .changeset/p4-session-report-246-overall-consistency.md \
  .changeset/p5-cdd-engine-overhaul.md .changeset/p5-session-report-246-orchestration-hardening.md \
  .changeset/p6-cdd-engine-overhaul.md .changeset/p6-post-dogfood-skill-fixes.md \
  .changeset/p6-report-issue-session-context.md .changeset/two-seas-repair.md
```

- [ ] **Step 4: 校验归并未改变版本结果（机器判定）**

Run:

```bash
pnpm run version --dry-run 2>&1 | tail -6
```

Expected: `[dry-run] write packages/osuperpowers/package.json: version → 1.0.0`（**与归并前一致**——osuperpowers 最高 bump 级仍为 major）；`would consume changesets` 列表 = 本程序 3 条 + 归并 6 条 = **9 条**

- [ ] **Step 5: 校验零裸包名 + `closes #NNN` 无丢失**

Run:

```bash
grep -rn '^"osuperpowers"\|^'"'"'osuperpowers'"'"'' .changeset/*.md ; echo "exit=$? (1 = 零命中，期望)"
grep -c '#246\|#137\|#139\|#109\|#208\|#209\|#71\|#216\|#217\|#218' .changeset/backlog-*.md
cat .changeset/backlog-*.md | tr -d '`' | grep -o '#246 F[0-9]*\(/F[0-9]*\)*' | sort | uniq -c
```

Expected:

- **第一条**零命中（裸包名缺陷消解）。
- **第二条**（命中**行数**）：`osuperpowers-major` 1 / `osuperpowers-minor` **3** / `osuperpowers-patch` 1 / `cdd-engine-major` 1 / `cdd-engine-minor` 2 / `cdd-engine-patch` 2 —— 合计 **10**。**注意 10 ≠ 归并前的 8，且这是正确的**：`p4-session-report-246` 与 `p5-session-report-246` 是**双包声明**，按 (package × bump) 轴被拆到 `cdd-engine-patch` 与 `osuperpowers-minor` 各一份（各 +1）；`p-zeta` 同理拆到 `osuperpowers-major` + `cdd-engine-major`（2→2 不变）。**故原判据「各归并文件计数之和 = 归并前的引用总数」是错的**——会把设计内的 +2 误报为丢失；真正的判据是下一条。
- **第三条**（`#246` finding 编号**多重集** —— 本核验式的要点，防假绿）：`F1` ×1、`F2/F3/F4/F12` ×1、`F5` ×1、`F6/F13` ×2、`F10/F11` ×2。归并前为 `F1` ×1、`F2/F3/F4/F12` ×1、`F5` ×1、`F6/F13` ×1、`F10/F11` ×1——`F6/F13` 与 `F10/F11` 的 1→2 同为上述双包拆分；`F1` / `F2/F3/F4/F12` / `F5` 必须严格 **1→1**，任一变 0 即丢声明。

> **grep 陷阱**：正文引用写作 `` `#246` F2/F3/F4/F12 ``（`#246` 带反引号），故 `grep -o '#246 F…'` 恒零命中——第三条刻意先 `tr -d '`'` 去反引号再匹配。
>
> **scope 说明**：`#246` 的 F 声明归并后分布于 **3 文件 / 7 条**——`backlog-osuperpowers-minor.md` 3 条（F2/F3/F4/F12、F6/F13、F10/F11）、`backlog-cdd-engine-minor.md` 2 条（F1、F5）、`backlog-cdd-engine-patch.md` 2 条（F6/F13、F10/F11）。**F7 / F8 / F9 不在本归并面**：F7/F8 归 P7 程序（其 changeset 不在 14 条内）、F9 为 P3 决策项（无 changeset 源）。核验若写作「`#246` 在四个条」即漏掉 `osuperpowers-minor` 的三条 F 声明——**那正是裸包名缺陷吞掉的部分**（`p-delta` / `p-epsilon` 因 `changesetsForPlugin` 按精确名过滤而不进 changelog 段落却被 unlink 消费）→ 该核验自身假绿。

- [ ] **Step 6: 全量 validate + emit check**

Run:

```bash
pnpm run validate
pnpm run emit:check
```

Expected: 13 块全绿；无 drift

- [ ] **Step 7: Commit**

```bash
git add -A .changeset
git commit -m "chore(changeset): T6 — P3 双包 changeset（cdd-engine/osuperpowers minor）+ 存量 backlog 归并 14→6（含裸包名静默丢声明修复）"
```

---

## Execution handoff

计划完成。执行方式由 `osuperpowers:cli-driven-development` 接管（每 Task 串行闭环：`cdd implement` → `cdd review` → `cdd fix` … → review 输出 blocker=0 + findings 全 fix 后才进下一 Task）。

**已记录的 follow-up（非本 phase 阻塞）**：
- `implement`/`brief` 物化记 post-commit HEAD 为 base → 声明 range 空 diff（**系统性**，P1 task-4 / P2 T1/T2 同形；归 **P6**）
- engine changeset 的版本效果不落地（`version-packages.mjs` 只处理 osuperpowers；P1/P2/P3 同形；归 **P6**）
- smoke-cdd 共享 workspace 并发脆弱 + vitest fork 并发 flake（承 P1/P2）
- **`66774ae` 为 orchestrator 越序（out-of-band）commit**（2026-09-15 overall v1.12「templates JSON 结构面单源」需求登记——用户指令的 program 级 Boundary-rules 回填），其**落在 T5 的声明 review 区间 `c213d73..41a469a` 之内**。T5 的交接账目（`task-5-report.md` §5「exactly 2」/ `task-5-test-evidence.json` `commits: 1`）按 brief File list 记，**不含**该 commit——**branch-review / phase 收口聚合 T5 交付面时须剔除它**。（T5 review-1 nit 记录；未改引擎侧 artifact 以守 I6 No Controller Bypass。）
- phase design 版本惯例外：P1/P2 design 均定格 v1.0（含 review 修正后未 bump），P3 沿用 v1.2 内联记录（不 bump 于 plan 期回填）——若 P6 要统一，需一并定案
