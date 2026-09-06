# CDD Engine 重构 — P3 URC 引擎架构统一 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将全部 review 收敛为引擎单一 ReviewLoop 闭环（单周期、引擎 round 自增、Review Stopping 强制），五引擎 bin 合并为单一 `cdd` CLI，模板数据化为 `review.md` + `reviews.json`，prompt 注入单一机制（`harness-registry.json` operation×type），`_docs/review.md` 节点锚定 SSoT，并随重写落地 Enh S（deferred 清理）+ Enh T（notes 字段）。

**Architecture:** ReviewLoop 引擎原语（`bin/lib/review-loop.mjs`）拥有 loop/round/Stopping；`bin/cdd.mjs` 为唯一 CLI（git 式子命令：implement / review --type / fix --type / select / research / brief / contract）；`templates/review/review.md` 单一模板 + `reviews.json` per-type 配置（lensEnum/axesGuide/fixTemplate/returnMode/handoffType）；注入经 `harness-registry.json` operation×type（`/` 风格、全 harness、implement/fix→tdd、code-review 单 agent）；`packages/osuperpowers/skills/_docs/docs-review.md` 重命名并重写为节点锚定 `review.md`，brainstorming/writing-plans 审阅节点迁移单周期。

**Tech Stack:** Node.js 24 · Commander v15 · execa · vitest（engine 套件 `packages/cdd-engine`，19 files / 200 tests）· node:test（osuperpowers 侧）· GitHub Actions composites（本项目既有）。

## Global Constraints

- **唯一 CLI 入口**：`package.json` bin 只暴露 `cdd`；`cdd-task/docs-task/branch-review/cdd-select/cdd-research` 五 bin 删除（AC17 残留 grep 兜底：`grep -rnE "cdd-task\.mjs|docs-task\.mjs|branch-review\.mjs|cdd-select\.mjs|cdd-research\.mjs" packages/ .github/ docs/maintainers/` 为空，排除 `docs/superpowers/`、`vendors/`、`.agents/`）。
- **`cdd` 子命令面**（verb×type）：`cdd implement --harness --task N --plan` · `cdd review --type task|branch|spec|plan [--harness] [--task N] [--doc] [--plan] [--base] [--head] [--round N]` · `cdd fix --type task|spec|plan [--harness] [--findings Path] [--doc] [--plan]` · `cdd select` · `cdd research` · `cdd brief --task N --plan --output` · `cdd contract --check-dirty|--check-head|--clear-findings`。**`cdd review-loop` CLI 不进本 phase**。
- **单周期 + 引擎 round**：review = 单次 dispatch；round 由引擎自增（scan `${type}-*.json` → max+1）；同 (type, ref) 且上一 round blocker=0 再 `cdd review` → exit 3 拒绝（Review Stopping）；`--round N` 仅校验回填（冲突报错）。
- **模板数据化**：`templates/review/` 终态 = `review.md` + `reviews.json` + **`doc-fix.md`**（spec/plan 共用 fix 壳，Task 4 新建）；`templates/task/` 终态 `implement.md` + `fix.md`；spec-review/plan-review/branch-review/spec-fix/plan-fix/task-review 六 md 删除。
- **注入单一机制**：prompt 注入只经 `bin/harness-registry.json`；键 `operation × type`；注入文本统一 `/` 风格（`/mattpocock-skills:code-review`、`/mattpocock-skills:tdd`）；全部受支持 harness（claude/cursor-agent/droid/pi）同 set。
- **`_docs/review.md`**：`packages/osuperpowers/skills/_docs/` 内 rename（docs-review.md → review.md）+ 节点锚定重写；D1/D2/D3/pass 词汇清零；brainstorming/writing-plans 审阅节点改单周期单 dispatch。
- **Enh S 豁免清单**：`_docs/review.md` 保留 `(eliminated)` 短语、`tests/fixtures/cdd-gate/**`（P5 域）、`.changeset/` 与 `docs/maintainers/` 不在 grep scope。
- **Enh T**：`templates/schema/cdd-handoff-schema.json` 加可选 `notes`；fix.md 明示证据记录位置；handoff-schema.md（cli-driven-development/docs/）补 notes 行与示例。
- **bin/ 布局**：`bin/` 根仅 `cdd.mjs` + `harness-registry.json`；共享模块归 `bin/lib/`（`review-loop.mjs` 由根迁入）。
- 每 task 结束 `pnpm run validate` 绿；引擎改动不影响 osuperpowers `node:test` 树（`packages/osuperpowers/**` vitest 排除区）。

---

### Task 1: review-loop 原语迁移 + round/Stopping 增强

**Files:**
- Move: `packages/cdd-engine/bin/review-loop.mjs` → `packages/cdd-engine/bin/lib/review-loop.mjs`（`git mv`）
- Modify: `packages/cdd-engine/bin/tests/review-loop.test.mjs`（追加 round/Stopping 测试）

**Interfaces:**
- Consumes: 现有 `runReviewLoop({ runReview, runFix, getBlockers, onRoundDone })`（P1）。
- Produces: `resolveNextRound(workspace, type) → number`（scan `${type}-*.json` → max+1；无 → 1）；`reviewLoopStoppedError(name, round)` 拒绝语义；`runReviewLoop` 接口保持导出（供测试/未来 wrapper；P3 不设 `cdd review-loop` CLI）。

- [ ] **Step 1: 迁移文件（git mv 保留历史）**

```bash
cd packages/cdd-engine
git mv bin/review-loop.mjs bin/lib/review-loop.mjs
# 显式更新 bin/tests/review-loop.test.mjs 既有 import：../review-loop.mjs → ../lib/review-loop.mjs
# （tests 不迁移；同路径 git mv 无意义）
```

- [ ] **Step 2: 扩展 round 解析 + Stopping 拒绝**

修改 `bin/lib/review-loop.mjs`，新增两个导出（保留 `runReviewLoop`）：

```js
import { readdirSync } from "node:fs";
import path from "node:path";

// Round 自增 — type-aware 命名模式（避免破坏既有 handoff 契约）：
//   spec / plan : `<workspace>/<type>-<round>.json`（AC15 指定 spec-1.json / spec-2.json）
//   task         : `<workspace>/task-<taskN>-task-review-<round>.json`（runner 既有 round 命名；`task-N-handoff.json` 不变）
//   branch       : `<workspace>/branch-review-<base7>..<head7>-r<round>.json`（branch-review 既有命名）
export function reviewRoundPattern(type, opts = {}) {
  if (type === "task") return new RegExp(`^task-${opts.task}-task-review-(\\d+)\\.json$`);
  if (type === "branch") return /^branch-review-.*-r(\d+)\.json$/;
  return new RegExp(`^${type}-(\\d+)\\.json$`);
}
export function resolveNextRound(workspace, type, opts = {}) {
  let max = 0;
  try {
    for (const f of readdirSync(workspace)) {
      const m = f.match(reviewRoundPattern(type, opts));
      if (m) max = Math.max(max, Number(m[1]));
    }
  } catch { /* workspace 不存在 → round 1 */ }
  return max + 1;
}

// Review Stopping：同 (type, ref) 上一 round blocker=0 后再次 dispatch → 拒绝。
// ref 为 review 目标签名（如 base..head 或 doc 路径），供引擎判定「目标是否变更」。
export function reviewStoppedError(type, round, ref) {
  return new Error(
    `round ${round} (${type}, ${ref}) already blocker=0 — Review Stopping: do not re-run; change ref to open a new review`,
  );
}
```

- [ ] **Step 3: 测试**

在 `bin/tests/review-loop.test.mjs` 追加：

```js
import { resolveNextRound, reviewStoppedError } from "../lib/review-loop.mjs";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

it("resolveNextRound: per-type 命名模式", () => {
  const ws = mkdtempSync(join(tmpdir(), "rloop-"));
  writeFileSync(join(ws, "spec-1.json"), "{}");
  writeFileSync(join(ws, "spec-2.json"), "{}");
  expect(resolveNextRound(ws, "spec")).toBe(3);
  writeFileSync(join(ws, "task-2-task-review-1.json"), "{}");
  writeFileSync(join(ws, "task-2-task-review-3.json"), "{}");
  expect(resolveNextRound(ws, "task", { task: 2 })).toBe(4); // task 用既有 round 命名
  writeFileSync(join(ws, "branch-review-abc1234..def5678-r1.json"), "{}");
  expect(resolveNextRound(ws, "branch")).toBe(2);
  expect(resolveNextRound(join(ws, "nope"), "spec")).toBe(1);
});

it("reviewStoppedError: 携带 type/round/ref 的 Error", () => {
  const e = reviewStoppedError("spec", 2, "docs/x.md");
  expect(e.message).toMatch(/blocker=0/);
});
```

- [ ] **Step 4: 跑测试 + 全量 validate**

```bash
cd packages/cdd-engine && pnpm exec vitest run bin/tests/review-loop.test.mjs
cd /Users/kang/Projects/oscaner-skills && pnpm run validate
```

- [ ] **Step 5: Commit**

```bash
git add packages/cdd-engine/bin/review-loop.mjs packages/cdd-engine/bin/lib/review-loop.mjs packages/cdd-engine/bin/tests/review-loop.test.mjs
git commit -m "refactor: review-loop 迁 bin/lib + resolveNextRound/Review Stopping 拒绝"
```

---

### Task 2: `cdd` CLI 骨架 + 全部子命令

**Files:**
- Create: `packages/cdd-engine/bin/cdd.mjs`
- Test: `packages/cdd-engine/bin/tests/cdd.test.mjs`（新增）

**Interfaces:**
- Consumes: `runTask`（`bin/lib/runner.mjs`）· `runDocsTask`（`bin/lib/docs-runner.mjs`）· `runReviewLoop`（`bin/lib/review-loop.mjs`）· `loadRegistry`/`checkHarness`（`bin/lib/registry.mjs`）· `resolveNextRound`（Task 1）· branch-review 逻辑（`bin/branch-review.mjs` 现 CLI 的 action 体）· select/research/brief/contract 的 action 逻辑。
- Produces: `bin/cdd.mjs` 主入口（Commander），子命令分发 `implement/review/fix/select/research/brief/contract`；`--type` 决定模板/reviews.json 路由（Task 4 前先路由到现有模板：type=task→task-review、branch→branch-review、spec→spec-review、plan→plan-review）。
- 旧 5 bin **本 Task 保留**（双活），Task 3 切换调用方后删除。

- [ ] **Step 1: 写 `cdd.mjs` 骨架（commander，isMain 守卫对齐现有 CLI）**

```js
#!/usr/bin/env node
// bin/cdd.mjs — 唯一的 CDD engine CLI（URC 合并面）。Commander v15。
// 子命令 = 操作 × (type | 无 type)。所有旧 bin（cdd-task/docs-task/branch-review/cdd-select/cdd-research）自此收敛。
import { Command } from "commander";
import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";

const program = new Command();
program
  .name("cdd")
  .description("CDD engine CLI — implement/review/fix/select/research/brief/contract")
  .helpOption("-h, --help", "display help for command");

// --- implement（原 cdd-task --mode implement）---
program
  .command("implement")
  .requiredOption("--harness <name>", "harness name")
  .requiredOption("--task <n>", "task number")
  .option("--plan <path>", "plan file path")
  .action(async (opts) => {
    const { runTask } = await import("./lib/runner.mjs");
    await runTask(opts.harness, parseInt(opts.task, 10), {
      mode: "implement",
      dryRun: process.env.CDD_DRY_RUN === "1",
      env: { ...process.env, ...(opts.plan ? { PLAN_FILE: opts.plan } : {}) },
    });
  });

// --- review（原 cdd-task --mode task-review / docs-task review / branch-review）---
program
  .command("review")
  .requiredOption("--type <t>", "task|branch|spec|plan")
  .requiredOption("--harness <name>", "harness name")
  .option("--task <n>", "task number (type=task)")
  .option("--doc <path>", "document path (type=spec|plan)")
  .option("--plan <path>", "plan path")
  .option("--base <sha>", "base commit (type=task|branch)")
  .option("--head <sha>", "head commit (type=task|branch)")
  .option("--round <n>", "round backfill (validate against engine auto-increment)")
  .action(async (opts) => {
    await runReview(opts);
  });

// --- fix（原 cdd-task --mode fix / docs-task fix）---
program
  .command("fix")
  .requiredOption("--type <t>", "task|spec|plan")
  .requiredOption("--harness <name>", "harness name")
  .option("--task <n>", "task number (type=task)")
  .option("--findings <path>", "findings handoff path for this fix round")
  .option("--doc <path>", "document path (type=spec|plan)")
  .option("--plan <path>", "plan path")
  .action(async (opts) => {
    await runFix(opts);
  });

// --- select / research / brief / contract（注册见 Step 3；select/research 内联、brief/contract 模块导入）---
// （Step 1 不重复注册 brief/contract——由 Step 3 统一注册，避免 Commander "command already exists"）
```

- [ ] **Step 2: 实现 `runReview`/`runFix` 分发（round 接线 + Branch Stopping；Task 4 前旧模板，Task 4 后 reviews.json）**

```js
// 引擎 round 自增 + Review Stopping + --round 校验（AC15 接线点）。
async function runReview(opts) {
  const { resolveNextRound, reviewStoppedError } = await import("./lib/review-loop.mjs");
  const { runTask } = await import("./lib/runner.mjs");
  const { runDocsTask } = await import("./lib/docs-runner.mjs");

  // type=branch：独立分支（不走 docs-task 路径）。
  if (opts.type === "branch") return await runBranchReview(opts);

  // spec/plan：round = 引擎自增；--round 仅校验回填（冲突 exit 2）。
  if (opts.type === "spec" || opts.type === "plan") {
    const ws = docsReviewWorkspace();
    const round = resolveNextRound(ws, opts.type);
    if (opts.round && Number(opts.round) !== round) {
      process.stderr.write(`--round ${opts.round} ≠ engine round ${round}\n`); process.exit(2);
    }
    const prev = existingRoundHandoff(ws, opts.type, round - 1);
    // Stopping 仅对「同 ref（doc）且上一 round blocker=0」拒绝；ref 变更 = 新审阅。
    if (prev && (prev.doc_path ?? "") === opts.doc && blockerCount(prev) === 0) {
      stoppedExit3(opts.type, round, opts.doc, prev?.blocker);
    }
    // pre-Task-4：旧 spec-review/plan-review 模板必需 {{PASS}} —— 传 PASS（+SPEC 参照）占位避免 renderTemplate 抛缺参；
    //   Task 4 后改传 review.md 的 TYPE/LENS_GUIDE/AXES 等（params 形状随模板切换）。
    const template = opts.type === "spec" ? "spec-review" : "plan-review";
    const extra = { PASS: opts.type === "spec" ? "completeness" : "completeness" };   // 占位防缺参；Task 4 后删除
    await runDocsTask({ harness: opts.harness, mode: "review", template, doc: opts.doc,
      round, handoffPath: path.join(ws, `${opts.type}-${round}.json`),
      params: extra, workspace: ws, repoRoot: await gitToplevel(process.cwd()),
      dryRun: process.env.CDD_DRY_RUN === "1" });
    return;
  }

  // type=task：任务审阅（runner 内部已追踪 task-N-task-review-{R}.json）。
  // workspace slug 由 plan 文件名派生；task Stopping 读「最新 task-{N}-task-review-{R}.json」blocker=0 → 拒绝。
  const { readFileSync, readdirSync, existsSync } = await import("node:fs");
  const slug = path.basename(opts.plan, ".md");                       // plan 文件名 → workspace slug
  const taskWs = path.join(await gitToplevel(process.cwd()), ".superpowers", "cdd", slug);
  const reviewFiles = existsSync(taskWs)
    ? readdirSync(taskWs).filter((f) => f.match(new RegExp(`^task-${opts.task}-task-review-(\\d+)\\.json$`)))
    : [];
  const latestRound = reviewFiles
    .map((f) => Number(f.match(/(\d+)\.json$/)[1]))
    .sort((a, b) => a - b).at(-1);
  if (latestRound) {
    const th = JSON.parse(readFileSync(path.join(taskWs, `task-${opts.task}-task-review-${latestRound}.json`), "utf8"));
    if (blockerCount(th) === 0) stoppedExit3("task", latestRound, opts.plan, th?.blocker);   // round 传数字
  }
  await runTask(opts.harness, parseInt(opts.task, 10), {
    mode: "task-review", dryRun: process.env.CDD_DRY_RUN === "1",
    env: { ...process.env, ...(opts.plan ? { PLAN_FILE: opts.plan } : {}) },
  });
}

async function runFix(opts) {
  const { runTask } = await import("./lib/runner.mjs");
  const { runDocsTask } = await import("./lib/docs-runner.mjs");
  // type=task fix：--findings 经 runTask 新 opt `findingsPath` 显式生效——
//   runner 在 fix mode 会以 prevHandoffPath 无条件覆盖 env.CDD_FINDINGS → 需在 runTask 入口增 findingsPath，
//   于 buildTaskEnv（l.122-124）覆盖前优先采用（否则 --findings 为死码，smoke dry-run 测不出）。
//   实现 checklist：runTask(harness, task, { mode, findingsPath, … })；buildTaskEnv 在 findingsPath 设定时
//   以 env.CDD_FINDINGS = findingsPath（跳过 prevHandoffPath 覆盖），未设定时走原逻辑。
    await runTask(opts.harness, parseInt(opts.task, 10), {
      mode: "fix", dryRun: process.env.CDD_DRY_RUN === "1",
      findingsPath: opts.findings,                                 // → runner env.CDD_FINDINGS（优先 prevHandoffPath）
      env: { ...process.env, ...(opts.plan ? { PLAN_FILE: opts.plan } : {}) },
    });
    return;
  }
  // spec/plan：fix 模板经 reviews.json fixTemplate（Task 4 建 doc-fix.md；Task 4 前 reviewTypeConfig 尚不存在 → fallback 旧模板）。
  let template;
  try {
    const { reviewTypeConfig } = await import("./lib/templates.mjs");   // 动态 import 置于 try 内（Task 4 前该导出缺失 → 安全 fallback）
    template = reviewTypeConfig(opts.type).fixTemplate;
  } catch {
    template = opts.type === "spec" ? "spec-fix" : "plan-fix";
  }
  await runDocsTask({ harness: opts.harness, mode: "fix", template, doc: opts.doc,
    findingsPath: opts.findings, workspace: docsReviewWorkspace(),
    repoRoot: await gitToplevel(process.cwd()), dryRun: process.env.CDD_DRY_RUN === "1" });
}
```

- [ ] **Step 2b: helpers（runReview 依赖）**

> 前置：把 `bin/branch-review.mjs` 的 action 体（含 dry-run 写 handoff + H1 四行）**内联为 `runBranchReview`**（Task 3 即删源文件）；branch 的 Stopping helper 为新增 `branchPrevHandoff(ws, base7, head7)` —— 按 `branch-review-{base7}..{head7}-r{n}.json` 过滤上一轮（ref 变更 = 新审阅，不得误拒）。

```js
// docsReviewWorkspace / gitToplevel / existingRoundHandoff / blockerCount / stoppedExit3
import { gitToplevel } from "./lib/contract.mjs";              // 已有导出
export function docsReviewWorkspace() {
  return path.join(gitToplevel(process.cwd()), ".superpowers", "docs-review");
}
export function existingRoundHandoff(ws, type, round) {
  if (round < 1) return null;
  const p = path.join(ws, `${type}-${round}.json`);
  return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null;
}
export function blockerCount(handoff) {
  return (handoff?.findings ?? []).filter((f) => f?.severity === "blocker").length;
}
export function stoppedExit3(type, round, ref, blocker) {
  process.stderr.write(
    `${ref} round ${round} (${type}) already blocker=0 — Review Stopping: do not re-run (exit 3)\n` +
    (blocker ? `last blocker: ${blocker}` : ""));
  process.exit(3);
}
// runBranchReview：内联自 branch-review.mjs 的 action 体（--plan --base --head --round）。
//   branch 路径同样接线：round = resolveNextRound(ws,"branch")（branch-review-*-r{round} 模式）、
//   --round 校验回填（冲突 exit 2）、上一 branch handoff（branch-review-*-r{round-1}）blocker=0 → stoppedExit3。
//   Stopping 的上一轮查找须按「当前 base7..head7 嵌入文件名」过滤（ref 变更 = 新审阅，不得误拒）。
//   Task 4 单周期改造：既有 branch「multi-lens loop」整体替换为「单次 review.md+reviews.json type=branch dispatch
//   （lensEnum standards/spec 内嵌 + H1 returnMode）+ fix/review 循环由 orchestrator 按 Review Stopping 驱动」。
```

（Task 4 后 `runReview` 的 spec/plan 分支将模板切换为 `review.md` + `reviews.json`（type 配置），round/Stopping 接线保持不变。）

- [ ] **Step 3: select/research 内联 + brief/contract 模块导入**

- `cdd select` / `cdd research`：把 `bin/cdd-select.mjs` / `bin/cdd-research.mjs` 的 action 逻辑**内联进 `cdd.mjs`**（两者为 bin 根文件，合并后根只留 `cdd.mjs`；逻辑复制后旧文件由 Task 3 删除）。`cdd select` 输出 `{cli, name, installed}` 建议；`cdd research` 走 `--harness --brief --output`。
- `cdd brief` / `cdd contract`：**import 自 `bin/lib/brief.mjs` / `bin/lib/contract.mjs`**（库模块保留；把它们各自的 CLI entry 块抽成 `runBriefCli(argv)` / `runContractCli(argv)` 导出，`cdd` 子命令调用之）。

```js
// cdd.mjs 尾部
const { runBriefCli } = await import("./lib/brief.mjs");
const { runContractCli } = await import("./lib/contract.mjs");
program.command("brief").requiredOption("--task <n>").requiredOption("--plan <path>")
  .option("--output <path>").action(() => runBriefCli(process.argv.slice(3)));
program.command("contract")
  .option("--check-dirty").option("--check-head").option("--handoff <path>").option("--progress <path>").option("--clear-findings")
  .action(() => runContractCli(process.argv.slice(3)));
```

- [ ] **Step 4: `cdd.test.mjs`：子命令帮助 + dry-run**

```js
import { execaSync } from "execa";
const REPO_ROOT = "/Users/kang/Projects/oscaner-skills";   // 显式 cwd（vitest 默认 cwd=packages/cdd-engine，相对 smoke-plan 不可达）
describe("cdd CLI", () => {
  it("-h → help", () => {
    const r = execaSync("node", ["packages/cdd-engine/bin/cdd.mjs", "--help"], { cwd: REPO_ROOT });
    expect(r.stdout).toMatch(/implement|review|fix|select|research|brief|contract/);
  });
  it("review missing --type → usage exit 2", () => {
    expect(() => execaSync("node", ["packages/cdd-engine/bin/cdd.mjs", "review"], { cwd: REPO_ROOT, env: { ...process.env, CDD_DRY_RUN: "1" } }))
      .toThrow(/required option|--type/);
  });
  it("dry-run review --type task → H1 + exit 0", () => {
    const r = execaSync("node", ["packages/cdd-engine/bin/cdd.mjs", "review", "--type", "task",
      "--harness", "claude", "--task", "1", "--plan", "packages/cdd-engine/bin/tests/fixtures/smoke-plan.md"],
      { cwd: REPO_ROOT, env: { ...process.env, CDD_DRY_RUN: "1" } });
    expect(r.stdout).toMatch(/status: APPROVED/);
  });
});
```

- [ ] **Step 5: report-issue**（旧 5 bin 仍在，validate 应绿）

```bash
cd /Users/kang/Projects/oscaner-skills && pnpm run validate
```

- [ ] **Step 6: Commit**

```bash
git add packages/cdd-engine/bin/cdd.mjs packages/cdd-engine/bin/tests/cdd.test.mjs packages/cdd-engine/bin/cdd-select.mjs packages/cdd-engine/bin/cdd-research.mjs packages/cdd-engine/bin/lib/brief.mjs packages/cdd-engine/bin/lib/contract.mjs
git commit -m "feat(cdd-engine): 合并面 — bin/cdd.mjs 单一 CLI 骨架（implement/review/fix/select/research/brief/contract）"
```

---

### Task 3: 引擎侧调用方切换 + 五旧 bin 移除

**Files:**
- Modify: `packages/cdd-engine/package.json`（bin：只暴露 `cdd`）· `.github/actions/link-cdd-engine/action.yml`（`command -v cdd`）· `scripts/validate/smoke-cdd.mjs`（4 命令链）· `packages/osuperpowers/bin/init/install-harness.mjs`（若有引擎 bin 引用）· `packages/osuperpowers/bin/gate/adapters/*`（如有）· 引擎测试 `bin/tests/{task,docs-task,select,branch-review,cdd-research}.test.mjs`（invoke `node bin/cdd.mjs <subcommand>`）
- Modify: **skill 调用方**（五 skill + 关联 docs）：`packages/osuperpowers/skills/{cli-select, cli-research, cli-driven-development}/SKILL.md` dispatch 行 + `cli-driven-development/docs/*` 与 Invariants 表中旧 bin 引用 · `packages/osuperpowers/docs/cdd-reference.md`（若有旧 bin，改 `cdd`）
- Modify: **影响面其余**：`README.md` / `README.zh-CN.md` · `docs/maintainers/osuperpowers-plugin.md` · `.changeset/README.md` · `bin/lib/cli-shared.mjs` 注释 · `report-issue/SKILL.md` 示例字面（l.55 附近）· **`packages/osuperpowers/skills/init/{SKILL.md, harness.md}`**（`command -v cdd-task` → `command -v cdd`——无 `.mjs` 后缀，AC17正则未覆盖，需显式）
- Delete: `packages/cdd-engine/bin/cdd-task.mjs` `bin/docs-task.mjs` `bin/branch-review.mjs` `bin/cdd-select.mjs` `bin/cdd-research.mjs`（select/research 逻辑已在 `cdd.mjs` 内）
- Check: AC17 grep `grep -rnE "cdd-task\.mjs|docs-task\.mjs|branch-review\.mjs|cdd-select\.mjs|cdd-research\.mjs" packages/ .github/ docs/maintainers/ --exclude-dir=node_modules`（排除 `docs/superpowers/`、`vendors/`、`.agents/`）为空

**Interfaces:**
- Consumes: Task 2 的 `cdd` 子命令面。
- Produces: 全引擎侧调用方走 `cdd`；五旧 bin 无引用（引擎测试亦改）；AC17 引擎侧满足。

- [ ] **Step 1: package.json bin 收敛**

`packages/cdd-engine/package.json` → `"bin": { "cdd": "bin/cdd.mjs" }`（删除 cdd-task/docs-task/branch-review/cdd-select/cdd-research 五键）。

- [ ] **Step 2: link-cdd-engine 断言更新**

```yaml
# .github/actions/link-cdd-engine/action.yml 内
- run: command -v cdd && cdd --help
```

- [ ] **Step 3: smoke-cdd 4 命令链**

`scripts/validate/smoke-cdd.mjs` 的 `ENTRIES` 与命令序列改为：

```js
const ENTRIES = { cdd: "packages/cdd-engine/bin/cdd.mjs" };
// 4 命令链（各断言 H1 四行合同 + status: APPROVED）：
//   cdd implement --harness claude --task 1 --plan <smoke-plan>
//   cdd review --type task  --harness claude --task 1 --plan <smoke-plan>
//                         → 产出 .superpowers/cdd/<smoke-plan-slug>/task-1-task-review-1.json
//   cdd fix --type task    --harness claude --task 1 --plan <smoke-plan> \
//                          --findings .superpowers/cdd/<smoke-plan-slug>/task-1-task-review-1.json   # parseReview→fix 经 --findings（dry-run 不实读，仅验证接线）
//   cdd review --type branch --harness claude --plan <smoke-plan> --base $(git rev-parse HEAD) --head $(git rev-parse HEAD)
```

- [ ] **Step 4: engine 测试引用切换**

`bin/tests/{task,docs-task,select,branch-review,cdd-research}.test.mjs` 中所有 `node bin/cdd-task.mjs ...` → `node bin/cdd.mjs implement/review --type task ...`（按各测试语义映射）；`docs-task` 用例 → `cdd review --type spec/plan` / `cdd fix --type spec/plan`；`select` → `cdd select`；`branch-review` → `cdd review --type branch`；`cdd-research` → `cdd research`。

- [ ] **Step 5: 删除五旧 bin + 全量 validate**

```bash
git rm packages/cdd-engine/bin/cdd-task.mjs packages/cdd-engine/bin/docs-task.mjs packages/cdd-engine/bin/branch-review.mjs packages/cdd-engine/bin/cdd-select.mjs packages/cdd-engine/bin/cdd-research.mjs
cd /Users/kang/Projects/oscaner-skills && pnpm run validate
```

- [ ] **Step 5b: skill 调用方 + 影响面更新（AC17/AC9）**

```bash
# 五 skill dispatch 行 → cdd（cli-select→`cdd select`；cli-research→`cdd research`；
#   cli-driven-development→`cdd implement`/`cdd review --type task`/`cdd fix --type task`；
#   brainstorming/writing-plans 的 review 节点由 Task 6 一并重写为 `cdd review --type spec|plan`）
# cli-driven-development SKILL.md 全量调用点枚举（裸 bin 名 + 直接 lib 调用，AC17 .mjs grep 捕获不到，须显式）：
#   - `command -v cdd-task`（engine 检测）→ `command -v cdd`
#   - `branch-review --harness …`（裸 bin）→ `cdd review --type branch …`
#   - `node …/lib/brief.mjs` / `node …/lib/contract.mjs` → `cdd brief` / `cdd contract`（spec §2.6.1「skill 不再 node …/bin/lib/*.mjs」）
# 同步 cli-driven-development/docs/* 与 Invariants 表中旧 bin 字面
# README.md/README.zh-CN.md/docs/maintainers/osuperpowers-plugin.md/.changeset/README.md 旧 bin 引用改 `cdd`
# report-issue/SKILL.md 示例字面同步
grep -rnE "cdd-task\.mjs|docs-task\.mjs|branch-review\.mjs|cdd-select\.mjs|cdd-research\.mjs" \
  packages/ .github/ docs/maintainers/ --exclude-dir=node_modules || echo clean
# 额外：裸 `cdd-task`/`docs-task`/`branch-review`（无 .mjs，AC17 正则覆盖不到）grep 兜底
grep -rnE "(^|[[:space:]])cdd-task|docs-task\.mjs|branch-review([[:space:]])" \
  packages/osuperpowers/skills --include="*.md" --exclude-dir=node_modules || echo clean
```

**Gate 核心同步（必改，非「如有」）**：`packages/osuperpowers/bin/gate/cdd-gate-core.mjs` 放行正则（l.77 `/(^|\s)(cdd-task|docs-task|branch-review)(\s|$)/`）改为识别 `cdd`（含子命令）；reason 文案同步；`packages/osuperpowers/tests/*.test.mjs` 中 gate 断言（pi-gate/kiro/opencode/gemini 等 `cdd-task --harness <h>`）改 `cdd review/implement …`。否则五 bin 移除后 gate deny 文案与测试全挂 validate。

（影响应的 `docs/superpowers/` 历史 spec/plan 与 `vendors/`、`.agents/` 排除在 AC17 grep 外；本步不改写历史文档。AC17 grep 须 `--exclude-dir=node_modules`——否则 `packages/osuperpowers/node_modules/.bin/*` cmd-shims 会被五-bin 正则命中而永不 clean。）

- [ ] **Step 5c: emit（SKILL.md/docs 改动后必须）**

```bash
cd /Users/kang/Projects/oscaner-skills && pnpm run emit && pnpm run emit:check
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(cdd-engine): 五旧 bin 移除 — 引擎/CI/测试全部走 cdd（smoke 4 命令链 + link-cdd-engine）"
```

---

### Task 4: 模板数据化（review.md + reviews.json）

**Files:**
- Create: `packages/cdd-engine/templates/review/review.md` `packages/cdd-engine/templates/review/reviews.json`
- Delete: `templates/review/{spec-review,plan-review,branch-review,spec-fix,plan-fix}.md` `templates/task/task-review.md`
- Modify: `packages/cdd-engine/bin/lib/templates.mjs`（review 模板占位渲染路径）

**Interfaces:**
- Consumes: 现有 `renderTemplate(name, params, programName)` + `renderHandoffStub`。
- Produces: `reviews.json`（下方 schema）；`review.md` 共享壳；`templates.mjs.reviewTemplate(type)` 解析（`readJson(reviews.json)[type]` 驱动占位渲染）。

- [ ] **Step 1: 写 `templates/review/reviews.json`（per-type 配置）**

```jsonc
{
  "task":   { "lensEnum": ["standards","spec"], "ref": "TASK_BASE..HEAD",
              "axesGuide": "standards 轴（仓库编码规范 + code-review smell baseline）+ spec 轴（task brief / 计划要求）；单 agent 双轴、禁并行 sub-agents",
              "returnMode": "h1", "handoffType": "cdd", "fixTemplate": "task-fix" },
  "branch": { "lensEnum": ["standards","spec"], "ref": "BASE..HEAD",
              "axesGuide": "同 task 双轴（全分支健康度：diff BASE..HEAD + 计划符合性）",
              "returnMode": "h1", "handoffType": "cdd", "fixTemplate": null },
  "spec":   { "lensEnum": ["completeness","consistency","clarity"], "ref": "doc vs spec",
              "axesGuide": "URC 规则指针：遵循 _docs/review.md 单周期、findings 带 lens 标签（完整性/一致性/清晰度三视角内嵌）",
              "returnMode": "json", "handoffType": "docs", "fixTemplate": "doc-fix" },
  "plan":   { "lensEnum": ["completeness","decomposition","buildability"], "ref": "doc vs spec",
              "axesGuide": "URC 规则指针：spec 覆盖（completeness）/ task 边界与接口（decomposition）/ 类型一致与占位扫描（buildability）",
              "returnMode": "json", "handoffType": "docs", "fixTemplate": "doc-fix" }
}
```

- [ ] **Step 2: 写 `templates/review/review.md`（共享壳 + 占位 `{{LENS_GUIDE}}`/`{{REFERENCE}}`/`{{AXES}}`/`{{HANDOFF}}`）**

```markdown
# CDD review — {{TYPE}} ({{LENS_GUIDE}})

**Workspace:** {{WORKSPACE}}

**Reference:** {{REFERENCE}}

## Review focus

{{AXES}}

## Findings output

Return findings only, JSON: `{"findings":[{ "lens": "'{{LENS_GUIDE}}'任一", "severity": "blocker|warn|nit", "section": "...", "line": 0, "summary": "...", "fix": "..." }]}`.
每条 finding 必须带 lens（防混排）；空数组 = approved。

## Handoff

Write handoff JSON to `{{HANDOFF}}`（schema: {{HANDOFF_TYPE}}; returnMode: {{RETURN_MODE}}）。
{{H1_BLOCK}}
```

（`{{H1_BLOCK}}` 仅 returnMode=h1 时渲染——task/branch 的四行 H1 合同；spec/plan 不渲染。）

- [ ] **Step 3: templates.mjs 解析 reviews.json**

```js
// bin/lib/templates.mjs 追加（路径用 PKG_ROOT → packages/cdd-engine/templates/review/）
import { readFileSync } from "node:fs";
import path from "node:path";
// PKG_ROOT 已在 templates.mjs 内定义（bin/ 的上一级）；沿用，不 new URL 相对解析。
export function loadReviews() {
  return JSON.parse(readFileSync(path.join(PKG_ROOT, "templates", "review", "reviews.json"), "utf8"));
}
export function reviewTypeConfig(type) {
  const cfg = loadReviews()[type];
  if (!cfg) throw new Error(`unknown review type: ${type}`);
  return cfg;
}
```

- [ ] **Step 4: runner/docs-runner review 模板路由改走 review.md + reviews.json**

**前置（Task 4 内）**：`templates.mjs` 的 `MODE_GROUPS` 补齐 `review` 与 `doc-fix`（映射到 `templates/review/`），否则 `renderTemplate("review")` / `renderTemplate("doc-fix")` 抛 unknown template；统一导出命名 `reviewTypeConfig`（Task 4 Step 3 即此，Interfaces 的 `reviewTemplate` 表述以 `reviewTypeConfig` 为准）。路由事实：`runDocsTask` 经 `renderTemplate(name, ...)`（非 `renderModePrompt`）——`renderModePrompt` 仅任务侧复用；doc 侧直接把 `template="review"` 喂 `renderTemplate`，Type/lens 等经 `params` 注入。

**post-URC runReview/runFix（Task 4 后）**：

```js
// spec/plan（post-URC）：仍经 runDocsTask，但 template="review"（共享壳）+ handoffPath=<ws>/<type>-{round}.json
//   注入 params: { TYPE, LENS_GUIDE: cfg.lensEnum.join(" · "), REFERENCE: cfg.ref,
//       AXES: cfg.axesGuide, RETURN_MODE: cfg.returnMode, HANDOFF_TYPE: cfg.handoffType, H1_BLOCK: "" }
//   runDocsTask 的 renderModePrompt 经 reviews.json 路由（不再读 spec-review/plan-review）。
// task/branch：runner 内部，runner 在 task-review/fix 路径把模板解析切到 reviews.json type=task/branch 配置：
//   注入 H1 四行合同（returnMode=h1）、open-findings（CDD_FINDINGS）、commit-contract 行为保持（runner 层逻辑未动）。
// env 数据流：cdd.mjs → runDocsTask({template:"review", params}) / runTask(mode, env) → renderModePrompt(...) → reviews.json 补全 params。
```

`cdd.mjs` 的 `runReview`：type=task/branch/spec/plan 全部经 `reviewTypeConfig(type)` → `renderTemplate("review", { TYPE, LENS_GUIDE, REFERENCE, AXES, HANDOFF, HANDOFF_TYPE, RETURN_MODE, H1_BLOCK })`；doc 侧用 `handoffType: "docs"` 的 stub，task/branch 用 `cdd` stub + H1。**`templates.mjs.renderModePrompt` 的 review 分支（task-review 等）改经 `reviews.json` 路由**（不再读旧 `templates/task/task-review.md`；`fix`/`implement` 保持旧模板）。旧模板删除后无残留引用。

- [ ] **Step 5: 新建 doc-fix.md + 删除六旧模板文件 + 测试（含 templates.content.test.mjs 改写）**

```bash
# 新建共享 docs fix 模板：先以现存 spec-fix.md/plan-fix.md 内容合并为 templates/review/doc-fix.md
# （doc 修复壳：{{FINDINGS}} → 修复 {{DOC}} → 更新 handoff（doc_path）+ self-validate；spec/plan 共用），
# 确认无 spec/plan 专属差异后再 git rm 旧文件。
# 同时改写 bin/tests/templates.content.test.mjs：其 readFileSync 旧 templates/task/task-review.md 与
#   templates/review/branch-review.md 的 describe 块随删除而移除/改写（否则 git rm 后 vitest 5b1 必红）。
git rm packages/cdd-engine/templates/review/spec-review.md packages/cdd-engine/templates/review/plan-review.md packages/cdd-engine/templates/review/branch-review.md packages/cdd-engine/templates/review/spec-fix.md packages/cdd-engine/templates/review/plan-fix.md packages/cdd-engine/templates/task/task-review.md
```

`templates.test.mjs`/`cdd.test.mjs` 增断言：`loadReviews()` 四 type 齐、`review.md` 渲染 type=task 含 `{{AXES}}`→code-review 焦点（Task 5 后补注入断言）；`pnpm run validate` 绿。

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(cdd-engine): review 模板数据化 — review.md + reviews.json，删六旧模板"
```

---

### Task 5: harness-registry operation×type 注入

**Files:**
- Modify: `packages/cdd-engine/bin/harness-registry.json`（prefix/suffix 键扩展 + 全 harness 补齐）· `bin/lib/registry.mjs` · `bin/lib/cli-shared.mjs`（`invokeCli` 签名 mode → `(op, type)` + 全部调用点迁移）
- Modify: `bin/lib/runner.mjs`（invokeCli 调用点：定性 `task-review`→`("review","task")`、`implement`→`("implement",null)`、`fix`→`("fix","task")`）· `bin/lib/docs-runner.mjs`（`review`/`fix` → `("review"/"fix", opts.type)`——post-Task-4 template="review"/"doc-fix" 无模板名可依，runDocsTask 增 `type` opt 传递）· **`bin/cdd.mjs`**（内联的 runBranchReview / research dispatch 调用点——branch-review.mjs / cdd-research.mjs 已在 Task 3 删除，迁移目标在此）· `invokeCliWithRetry` 签名同步透传 `(op, type)`
- Test: `bin/tests/registry.test.mjs`（扩展）+ `bin/tests/cli-shared.test.mjs`（如已有注入断言）

**Interfaces:**
- Consumes: `invokeCli(entry, prompt, mode, env, cwd, timeoutMs)`（现 `prefix?.[mode]`）。
- Produces: `entry.prefix[op][type?]` 解析（operation=implement|review|fix；review 子键 type）；`invokeCli` 按 `(op, type)` 注入；`/` 风格文本；全 harness 同 set。

- [ ] **Step 1: harness-registry.json 键结构（claude 示范，其余同 set）**

```jsonc
{
  "claude": {
    "cli": "claude", "invoke": "-p --output-format text --dangerously-skip-permissions", "output": "text", "ship": "full",
    "prefix": {
      "implement": "/mattpocock-skills:tdd",
      "review": { "task": "/mattpocock-skills:code-review（单 agent 双轴，禁并行 sub-agents）",
                  "branch": "/mattpocock-skills:code-review（单 agent 双轴，禁并行 sub-agents）",
                  "spec": "<遵循 URC 规则：_docs/review.md 单周期、findings 带 lens>",
                  "plan": "<遵循 URC 规则：_docs/review.md 单周期、findings 带 lens>" },
      "fix": "/mattpocock-skills:tdd"
    },
    "suffix": {}
  },
  "cursor-agent": { /* cli/invoke/output/ship + prefix 同 claude set */ },
  "droid":      { /* 同 set */ },
  "pi":         { /* 同 set */ }
  // codex/copilot/gemini: "not-supported"，不补
}
```

- [ ] **Step 2: registry.mjs / cli-shared.mjs 解析**

```js
// cli-shared.invokeCli（entry, prompt, params, env, cwd, timeoutMs）— params={op, type?}
export function resolveInjection(entry, op, type) {
  const p = entry?.prefix?.[op] ?? "";
  if (p && typeof p === "object") return type ? (p[type] ?? "") : "";
  return typeof p === "string" ? p : "";
}
// 调用点 mode→(op,type) 映射（评审新增/既有全部调用点）：
//   runner.mjs: task-review→("review","task") · implement→("implement",null) · fix→("fix","task")
//   docs-runner.mjs: review→("review", opts.type) · fix→("fix", opts.type)   # post-Task-4 template="review"/"doc-fix" 无模板名可依
//                    → runDocsTask 增 `type` opt（或经 opts.params.TYPE 传递）解析后喂 invokeCli（替换旧模板名映射）
//   cdd-research.mjs: ("research",null)（无 prefix 需求，缺省空）
// 兜底：op 仍缺省时回退 mode 键查找（旧 "task-review" 等键）避免静默空注入。
```

`registry.test.mjs` 增：`resolveInjection(reg.claude, "review", "task")` = code-review 注入；`resolveInjection(reg.claude, "implement")` = tdd；`pi/droid/cursor` 同 set 非空。**`cli-shared.test.mjs` 既有注入/签名断言改写**（首行 `Skill(mattpocock-skills:tdd)` 断言与位置 mode 参数 → `/` 风格 + `(op, type)` 签名）。

- [ ] **Step 3: 跑测试 + validate**

```bash
cd /Users/kang/Projects/oscaner-skills && pnpm run validate
```

- [ ] **Step 4: Commit**

```bash
git add packages/cdd-engine/bin/harness-registry.json packages/cdd-engine/bin/lib/registry.mjs packages/cdd-engine/bin/lib/cli-shared.mjs packages/cdd-engine/bin/tests/registry.test.mjs
git commit -m "feat(cdd-engine): harness-registry operation×type 注入 — / 风格 + 全 harness + implement/fix→tdd"
```

---

### Task 6: `_docs/review.md` 节点锚定 + skill 审阅节点单周期迁移

**Files:**
- Rename: `packages/osuperpowers/skills/_docs/docs-review.md` → `packages/osuperpowers/skills/_docs/review.md`（重写为节点锚定）
- Modify: `packages/osuperpowers/skills/brainstorming/SKILL.md`（spec-review? 节点）· `packages/osuperpowers/skills/writing-plans/SKILL.md`（plan-review 节点 + user-ok? 提示词指向）· 相关 `_docs`/`docs` 中 D1/D2/D3/pass 引用

**Interfaces:**
- Consumes: Task 2-5 的 `cdd review --type spec|plan`（单次）。
- Produces: `_docs/review.md`（digraph + Node Definitions（run-review / cli-fix-all-findings）+ Rules + Invariants + Failure Modes）；brainstorming/writing-plans 审阅节点 = 单 dispatch + lens-tag + Review Stopping。

- [ ] **Step 1: git mv + 重写 `_docs/review.md`（节点锚定）**

```bash
git mv packages/osuperpowers/skills/_docs/docs-review.md packages/osuperpowers/skills/_docs/review.md
```

`review.md` 内容骨架（保留 `# Rule: Review Stopping` 锚点供引用）：

```markdown
# Review (URC — Unified Review Contract)

> Applies to all reviews: task / branch / spec / plan. Single-cycle, single-dispatch.
> 历史多轮并发审阅机制（分轮）已废弃（见 §Eliminated）。

## Digraph
flowchart TD
  A[run-review] --> B{blocker=0?}
  B -->|yes| C[cli-fix-all-findings] --> D((done))
  B -->|no| C --> A

## Node Definitions
### run-review
一次 dispatch（cdd review --type X）；findings 带 lens 标签；status APPROVED/CHANGES_REQUESTED/BLOCKED。
### cli-fix-all-findings
全量 findings 入 cdd fix --type X；blocker=0 → done；blocker>0 → run-review（round=引擎自增）。

## Rules
单周期 · lens-tag · Review Stopping（blocker=0 不再重跑，引擎 layer 拒绝）· Handoff Output（round 命名）。
## Invariants
不重跑于 blocker=0 · 每 cycle 单 dispatch · findings 恒全量 · lens 必填。
## Failure Modes
handoff 缺失 → BLOCKED 重发；引擎 Stopping 拒绝 → 换 ref 新审。
## §Eliminated
多轮并发审阅（分轮）机制 · deferred channel —— 均不再使用。
```

- [ ] **Step 2: brainstorming `spec-review?` 节点改单周期**

`packages/osuperpowers/skills/brainstorming/SKILL.md` 的 `spec-review?` Do 从 3-pass 改为：

```markdown
- **Do**: Execute one review per cycle: `cdd review --type spec --harness <name> --doc <path> [--round N]`
  （覆盖 completeness/consistency/clarity，findings 带 lens 标签）。
  Run-review → cli-fix-all-findings（all findings via `cdd fix --type spec --findings <handoff>`）
  → blocker>0 → 再 review（round 引擎自增）/ blocker=0 → done（不重跑）。
  Follow _docs/review.md（节点锚定 SSoT）。
```

- [ ] **Step 3: writing-plans `plan-review` 节点同型单周期**（同上，`--type plan`）

- [ ] **Step 4: D1/D2/D3/pass 词汇清零 + docs-review.md 引用面迁移**

`review.md` §Eliminated 用不含字面令牌的表述（如「历史多轮并发审阅机制（分轮）已废弃；lens 由单次 review 内嵌」）——避免命中 AC14 grep `D1\|D2\|D3\|PASS=<`。
枚举并迁移全部 `../_docs/docs-review.md` 引用点 → `_docs/review.md`（`#rule-review-stopping` 锚点保留）：`writing-plans/SKILL.md`（Read 行 + I4 表）· `brainstorming/SKILL.md`（spec-review? 节点 + I5 表 + §read 行）· `CLAUDE.md` 引用（若有）· `docs/maintainers/*`（如提及）。
规则项：`grep -rn "docs-review.md\|D1\|D2\|D3\|PASS=<" packages/osuperpowers/skills packages/cdd-engine/templates CLAUDE.md`（除 `_docs/review.md` §Eliminated 的临时代词）为空。**`cli-driven-development/docs/cdd-reference.md` 的 "D3b strictness"（含 D3 子串）改措辞或显式豁免**（本步列出该文件，替换表述后 grep 空）。`packages/osuperpowers/tests/rule-reference.test.mjs`（**单数 rule-reference**）的 `_docs/review.md#rule-review-stopping` 锚点断言仍在。

- [ ] **Step 5: emit + 全量 validate**

```bash
cd /Users/kang/Projects/oscaner-skills && pnpm run emit && pnpm run validate
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(skills): _docs/review.md 节点锚定 + brainstorming/writing-plans 审阅节点单周期迁移"
```

---

### Task 7: Enh T notes 字段 + Enh S deferred 残留清理

**Files:**
- Modify: `packages/cdd-engine/templates/schema/cdd-handoff-schema.json`（加可选 `notes`）· `packages/cdd-engine/templates/task/fix.md`（证据位置）· `packages/osuperpowers/skills/cli-driven-development/docs/handoff-schema.md`（notes 行+示例）· `packages/cdd-engine/bin/lib/contract.mjs`（删 markDeferred；classifySeverity warn/nit→APPROVED；header 注释）· `bin/tests/contract.test.mjs`（header 注释改写 + 断言）· `bin/lib/progress.mjs`（删 scopeEnum deferred-sweep）· `packages/osuperpowers/skills/report-issue/SKILL.md`（analyze 扫描词去 deferred）

**Interfaces:**
- Consumes: 现有 `validateHandoffSchema`（ajv，schema additionalProperties:false）。
- Produces: `notes` 可选字段为 schema 接受；`markDeferred` 从 contract.mjs 消失；`classifySeverity` warn/nit → `"APPROVED"`；AC9 grep（豁免清单见 Global Constraints）为空。

- [ ] **Step 1: schema + fix.md + handoff-schema.md（Enh T）**

`cdd-handoff-schema.json` properties 增：`"notes": { "type": "string" }`。
`fix.md` Handoff Output 段追加：

```markdown
证据说明（为什么这么修 / test-evidence 重录说明）写入 `notes` 字段（可选 string）；
命令输出文件经 `test_evidence` / `artifacts` 引用，勿内嵌正文。
```

`handoff-schema.md`（`skills/cli-driven-development/docs/`）Severity→status 表后补：

```markdown
`notes`: 可选 string — fix 阶段证据说明（Enh T）。
```

**同时（Enh S patch in same step）** 清除该文档全部 deferred 痕迹：Severity→status 表「Only warn/nit (deferred)」行与标注段（现 l.19/24）→ 改为「Only warn/nit → APPROVED（将在后续 fix 修复）」；示例 findings 去 `deferred: true`（l.57/76）；`findings[]` 描述去 `deferred?` 字段（l.118/120）。（`grep -rn "deferred" packages/osuperpowers/skills/cli-driven-development/docs/` 为空。）

- [ ] **Step 2: contract.mjs（Enh S）**

删除 `markDeferred`；`classifySeverity` 的 warn/nit 分支返回值 `"deferred"` → `"APPROVED"`；header 注释（首行区）与 `rollupStatus` 注释去掉 deferred 描述。
`bin/tests/contract.test.mjs`：lines 6/8 header 注释改写；`classifySeverity("warn")` 断言改 `APPROVED`；删/换 markDeferred 测试；**新增 AC10 断言：`validateHandoffSchema({task:1,phase:"fix",status:"APPROVED",artifacts:{},findings:[],notes:"..."})` → valid（notes 可选字段被 ajv 接受）**。

- [ ] **Step 3: progress.mjs + report-issue 扫描词**

`progress.mjs`：`scopeEnum: ["deferred-sweep", "blocker-only"]` → 删除（无写入者）。
`report-issue/SKILL.md` `analyze`：扫描词 `deferred` 移除（保留 `fix round`/`BLOCKED`/`parked`/`CHANGES_REQUESTED`）。

- [ ] **Step 4: grep 清零 + 测试 + validate**

```bash
grep -rn "deferred" packages/cdd-engine packages/osuperpowers/skills \
  | grep -v "review.md\|fixtures/cdd-gate" || echo "clean"
cd /Users/kang/Projects/oscaner-skills && pnpm run emit && pnpm run validate
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(cdd-engine)+refactor: Enh T notes 字段 + Enh S deferred 孤儿清理（contract/progress/report-issue 引用）"
```

---

### Task 8: 全量验收 + 收尾

**Files:**
- Verify-only（若发现遗漏再改）。

**Interfaces:**
- Consumes: AC 12-17 + AC 9-11 引擎项（P3 归属）。

- [ ] **Step 1: AC 逐条执行**

```bash
# AC12 单一 cdd bin + 子命令可运行
node packages/cdd-engine/bin/cdd.mjs --help
node packages/cdd-engine/bin/cdd.mjs review --type spec --harness claude --doc ...   # 或 CDD_DRY_RUN=1 node packages/cdd-engine/bin/cdd.mjs review --type task ...
# dry-run 无 --dry-run 标志——一律 CDD_DRY_RUN=1 环境变量（见 Task 2）
# AC13 模板终态：templates/review/ = review.md + reviews.json + doc-fix.md（3 文件）；templates/task/ = implement.md + fix.md
ls packages/cdd-engine/templates/review/
ls packages/cdd-engine/templates/task/
# AC14 规则 SSoT + 词汇清零
ls packages/osuperpowers/skills/_docs/review.md
grep -rn "D1\|D2\|D3\|PASS=<" packages/osuperpowers/skills packages/cdd-engine/templates || echo clean
# AC15 round 自增：CDD_DRY_RUN 下 runDocsTask 不写 handoff、无法演示 → 用显式 seed 文件路径验证：
#   a) 手工写 .superpowers/docs-review/spec-1.json（blocker>0：status CHANGES_REQUESTED + 1 blocker finding）→
#      cdd review --type spec …（非 dry-run 或注入 resolveNextRound 单测）→ 得 round=2 / 写 spec-2.json；
#   b) seed spec-1.json blocker=0（status APPROVED）→ 再 dispatch → exit 3（Stopping 拒绝）。
#   （resolveNextRound 的纯函数单测见 Task 1；此处验证 round 递增与 Stopping 拒绝接线。）
# AC16 注入断言（registry.test 已覆盖 + 实际 prompt 渲染抽查）
# AC17 旧 bin 残留
grep -rnE "cdd-task\.mjs|docs-task\.mjs|branch-review\.mjs|cdd-select\.mjs|cdd-research\.mjs" packages/ .github/ docs/maintainers/ || echo clean
# AC9 引擎 deferred 残留可执行物
grep -rn "deferred" packages/cdd-engine/bin packages/cdd-engine/templates || echo clean
# AC10 notes 可选 + ajv 接受（contract.test 覆盖）
# smoke 新 4 命令链实测
node scripts/run.mjs smoke-cdd
```

- [ ] **Step 2: bin/ 布局确认**

```bash
ls packages/cdd-engine/bin/   # 根= cdd.mjs harness-registry.json
ls packages/cdd-engine/bin/lib/  # 含 review-loop.mjs
```

- [ ] **Step 3: 全量 validate + emit:check**

```bash
cd /Users/kang/Projects/oscaner-skills && pnpm run validate
```

- [ ] **Step 3b: changeset（spec §1「changeset 逐 phase 建」）**

```bash
cd /Users/kang/Projects/oscaner-skills && pnpm run changeset
# 或手写 .changeset/<p3-urc>.md（type: minor / major，包名 @oscaner-skills/cdd-engine + @oscaner-skills/osuperpowers）
```

- [ ] **Step 4: Commit（如 verify 中有遗漏修复）**

```bash
git add -A && git commit -m "test(cdd-engine): P3 URC 全量验收 sweep — AC12-17 + AC9-11 引擎项，smoke 新链"
```