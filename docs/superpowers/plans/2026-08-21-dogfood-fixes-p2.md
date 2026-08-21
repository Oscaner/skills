# Dogfood 修复 P2 — CDD 引擎修复 + brainstorming grilling 加强 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `osuperpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复两项 CDD 引擎违规（#154 brief 机械切分、#155 OUTFILE 路径混用），新增 cdd-review.mjs `--handoff PATH` 参数，并修正 brainstorming/SKILL.md grilling 委托指令、docs-review.md Review Stopping AskUserQuestion 问询、writing-plans/SKILL.md next-step 标签。

**Architecture:** 引擎侧新增 `engine/lib/brief.mjs`（generateBrief + validateBrief），修改 `runner.mjs`（step 2.55 精简 + step 4.5 brief 集成 + OUTFILE 第 4 参数）、`cdd-review.mjs`（--handoff 参数写 handoff.json）；规则文本侧修改 brainstorming/SKILL.md、docs-review.md、writing-plans/SKILL.md 三个文件。引擎变更全部有单元测试覆盖，规则变更通过 `pnpm run emit` + `pnpm run validate` 验证。

**Tech Stack:** Node.js ESM；node:test；node:fs；pnpm run emit / validate；Markdown 文本编辑

## Global Constraints

- 不新建 CLI 入口（cdd-brief.mjs 不创建）
- 不修改 handoff schema，不修改 vendors 子模块
- 存量 `.superpowers/sdd/` 文件保留不处理
- 每个 task 完成后独立 commit（conventional commit，无 AI attribution）
- SKILL.md 修改须为纯英文；zh-CN 镜像文件在同一 task 内同步，不可 defer
- spec 文件：`docs/superpowers/specs/2026-08-21-dogfood-fixes-p2-design.md`

---

## File Structure

| 文件 | 操作 | Task |
|------|------|------|
| `packages/osuperpowers/bin/engine/lib/brief.mjs` | Create | Task 1 |
| `packages/osuperpowers/bin/engine/tests/brief.test.mjs` | Create | Task 1 |
| `packages/osuperpowers/bin/engine/lib/runner.mjs` | Modify — step 2.55 精简 + step 4.5 brief 集成 | Task 2 |
| `packages/osuperpowers/bin/engine/tests/runner.test.mjs` | Modify — setupWorkspace 更新 + brief 集成测试 | Task 2 |
| `packages/osuperpowers/bin/engine/lib/runner.mjs` | Modify — runReviewPackage OUTFILE + export | Task 3 |
| `packages/osuperpowers/bin/engine/tests/runner.test.mjs` | Modify — OUTFILE 测试 | Task 3 |
| `packages/osuperpowers/bin/engine/cdd-review.mjs` | Modify — --handoff PATH | Task 4 |
| `packages/osuperpowers/bin/engine/tests/review.test.mjs` | Modify — handoff 测试 | Task 4 |
| `packages/osuperpowers/skills/brainstorming/SKILL.md` | Modify — grilling 委托 + next-step 标签 | Task 5 |
| `packages/osuperpowers/skills/brainstorming/SKILL.zh-CN.md` | Modify — zh-CN 同步 | Task 5 |
| `packages/osuperpowers/docs/docs-review.md` | Modify — AskUserQuestion Review Stopping | Task 6 |
| `packages/osuperpowers/docs/docs-review.zh-CN.md` | Modify — zh-CN 镜像同步 | Task 6 |
| `packages/osuperpowers/skills/writing-plans/SKILL.md` | Modify — next-step 标签 | Task 7 |
| `packages/osuperpowers/skills/writing-plans/SKILL.zh-CN.md` | Modify — zh-CN 同步 | Task 7 |

---

### Task 1: `engine/lib/brief.mjs` + `brief.test.mjs`（#154 机械切分）

**Files:**
- Create: `packages/osuperpowers/bin/engine/lib/brief.mjs`
- Create: `packages/osuperpowers/bin/engine/tests/brief.test.mjs`

**Interfaces:**
- Produces: `generateBrief(planFile, taskNum, outPath, cwd): void` — 提取 `### Task N:` 段落 + 追加 `TASK_BASE: <sha>` + 写入 outPath
- Produces: `validateBrief(briefPath): boolean` — 检查 brief 含 `TASK_BASE:` 行
- Consumes: `gitRevParseHead(cwd)` from `./contract.mjs`（已有函数）

- [ ] **Step 1: 写 brief.test.mjs（先写测试）**

```js
// packages/osuperpowers/bin/engine/tests/brief.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateBrief, validateBrief } from "../lib/brief.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "../../../../..");

function makePlan(tasks) {
  return tasks.map(([n, body]) => `### Task ${n}: Task${n}\n${body}`).join("\n\n") + "\n";
}

test("generateBrief: 提取 Task 1 段落，含 TASK_BASE:，不含 Task 2", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "brief-test-"));
  const planFile = path.join(dir, "plan.md");
  writeFileSync(planFile, makePlan([[1, "Do task 1\n"], [2, "Do task 2\n"]]));
  const outPath = path.join(dir, "task-1-brief.md");
  generateBrief(planFile, 1, outPath, REPO_ROOT);
  const content = readFileSync(outPath, "utf8");
  assert.match(content, /^### Task 1:/m);
  assert.match(content, /^TASK_BASE: [0-9a-f]{40}$/m);
  assert.doesNotMatch(content, /^### Task 2:/m);
});

test("generateBrief: task 不存在 → throw task N not found", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "brief-test-"));
  const planFile = path.join(dir, "plan.md");
  writeFileSync(planFile, makePlan([[1, "body\n"]]));
  assert.throws(
    () => generateBrief(planFile, 99, path.join(dir, "out.md"), REPO_ROOT),
    /task 99 not found/,
  );
});

test("generateBrief: plan 不存在 → throw plan file not found", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "brief-test-"));
  assert.throws(
    () => generateBrief(path.join(dir, "missing.md"), 1, path.join(dir, "out.md"), REPO_ROOT),
    /plan file not found/,
  );
});

test("validateBrief: 含 TASK_BASE: → true", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "brief-test-"));
  const f = path.join(dir, "brief.md");
  writeFileSync(f, "### Task 1: Foo\nDo something\nTASK_BASE: abc123\n");
  assert.equal(validateBrief(f), true);
});

test("validateBrief: 无 TASK_BASE: → false", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "brief-test-"));
  const f = path.join(dir, "brief.md");
  writeFileSync(f, "### Task 1: Foo\nDo something\n");
  assert.equal(validateBrief(f), false);
});

test("validateBrief: 文件不存在 → false", () => {
  assert.equal(validateBrief("/nonexistent/no-such-brief.md"), false);
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
node --test packages/osuperpowers/bin/engine/tests/brief.test.mjs
```
Expected: FAIL (brief.mjs 不存在)

- [ ] **Step 3: 实现 `engine/lib/brief.mjs`**

```js
// packages/osuperpowers/bin/engine/lib/brief.mjs — CDD task brief generator + validator.
// generateBrief: mechanically extract ### Task N: section from plan, append TASK_BASE, write file.
// validateBrief: check brief contains TASK_BASE: line.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { gitRevParseHead } from "./contract.mjs";

export function generateBrief(planFile, taskNum, outPath, cwd) {
  if (!existsSync(planFile)) throw new Error(`plan file not found: ${planFile}`);
  const lines = readFileSync(planFile, "utf8").split("\n");
  const header = `### Task ${taskNum}:`;
  let start = -1;
  let end = lines.length;
  for (let i = 0; i < lines.length; i++) {
    if (start < 0 && lines[i].startsWith(header)) { start = i; continue; }
    if (start >= 0 && /^### Task \d+:/.test(lines[i])) { end = i; break; }
  }
  if (start < 0) throw new Error(`task ${taskNum} not found in plan: ${planFile}`);
  const sha = gitRevParseHead(cwd);
  if (!sha) throw new Error("cannot resolve HEAD: not in a git repo");
  const content = lines.slice(start, end).join("\n").replace(/\n+$/, "") + "\nTASK_BASE: " + sha + "\n";
  writeFileSync(outPath, content, "utf8");
}

export function validateBrief(briefPath) {
  if (!existsSync(briefPath)) return false;
  return readFileSync(briefPath, "utf8").split("\n").some((l) => l.startsWith("TASK_BASE:"));
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
node --test packages/osuperpowers/bin/engine/tests/brief.test.mjs
```
Expected: all 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/osuperpowers/bin/engine/lib/brief.mjs packages/osuperpowers/bin/engine/tests/brief.test.mjs
git commit -m "feat: add engine/lib/brief.mjs (generateBrief + validateBrief) (#154)"
```

---

### Task 2: `runner.mjs` brief 集成（step 2.55 + step 4.5，#154）

**Files:**
- Modify: `packages/osuperpowers/bin/engine/lib/runner.mjs`
- Modify: `packages/osuperpowers/bin/engine/tests/runner.test.mjs`

**Interfaces:**
- Consumes: `generateBrief`, `validateBrief` from `./brief.mjs`（Task 1 产物）

- [ ] **Step 1: 在 runner.test.mjs 中更新 setupWorkspace + 写集成测试**

更新 `setupWorkspace`（找到已有函数定义，修改 task-1-brief.md 内容，加入 `TASK_BASE:` 行）：

```js
function setupWorkspace() {
  const ws = mkdtempSync(path.join(tmpdir(), "cdd-task-runner-"));
  writeFileSync(path.join(ws, "progress.md"), "# CDD ledger — plan: /tmp/plan.md\n");
  writeFileSync(path.join(ws, "plan-constraints.md"), "constraints\n");
  writeFileSync(path.join(ws, "task-1-brief.md"), "# task 1\nTASK_BASE: abc123\n"); // ← 加 TASK_BASE
  return ws;
}
```

在文件顶部 imports 处追加（`REPO_ROOT` 供 cwd 注入；`existsSync` 和 `readFileSync` 已在 import 中）：

```js
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "../../../../..");
```

**注意**：`baseEnv()` 主动清除所有 `CDD_*`（只保留 `CDD_WORKSPACE`）。step 4.5 的 `if (briefPath)` 依赖 `env.CDD_TASK_BRIEF`，因此每个新测试的 env 必须通过 `baseEnv(ws, { CDD_TASK_BRIEF: path.join(ws, 'task-1-brief.md') })` 显式传入；否则 brief 校验分支不会执行。

在文件末尾追加以下 4 个新测试（每个均含 `CDD_TASK_BRIEF`）：

```js
test("runTask: brief 已存在 + 含 TASK_BASE: → pass（dry-run exit 0）", async () => {
  const ws = setupWorkspace(); // brief 已含 TASK_BASE: abc123
  const res = await runTask("claude", 1, {
    mode: "implement", dryRun: true, probeSkills: NOOP_PROBE,
    env: baseEnv(ws, { CDD_TASK_BRIEF: path.join(ws, "task-1-brief.md") }), noExit: true,
  });
  assert.equal(res.exitCode, 0);
  assert.equal(res.h1[0], "status: DONE");
});

test("runTask: brief 已存在 + 缺 TASK_BASE: → BLOCKED exit 1", async () => {
  const ws = mkdtempSync(path.join(tmpdir(), "cdd-task-runner-"));
  writeFileSync(path.join(ws, "progress.md"), "# CDD ledger — plan: /tmp/plan.md\n");
  writeFileSync(path.join(ws, "plan-constraints.md"), "constraints\n");
  writeFileSync(path.join(ws, "task-1-brief.md"), "# task 1\n"); // no TASK_BASE
  const res = await runTask("claude", 1, {
    mode: "implement", dryRun: true, probeSkills: NOOP_PROBE,
    env: baseEnv(ws, { CDD_TASK_BRIEF: path.join(ws, "task-1-brief.md") }), noExit: true,
  });
  assert.equal(res.exitCode, 1);
});

test("runTask: brief 不존재 + plan 可用 → auto-generate + exit 0", async () => {
  const ws = mkdtempSync(path.join(tmpdir(), "cdd-task-runner-"));
  writeFileSync(path.join(ws, "progress.md"), "# CDD ledger\n"); // no plan in ledger
  writeFileSync(path.join(ws, "plan-constraints.md"), "constraints\n");
  // no brief file
  const planDir = mkdtempSync(path.join(tmpdir(), "plan-"));
  const planFile = path.join(planDir, "plan.md");
  writeFileSync(planFile, "# Plan\n\n### Task 1: Do something\nTask body\n");
  const env = baseEnv(ws, {
    CDD_TASK_BRIEF: path.join(ws, "task-1-brief.md"),
    PLAN_FILE: planFile,
  });
  const res = await runTask("claude", 1, {
    mode: "implement", dryRun: true, probeSkills: NOOP_PROBE,
    env, cwd: REPO_ROOT, noExit: true,
  });
  assert.equal(res.exitCode, 0);
  assert.ok(existsSync(path.join(ws, "task-1-brief.md")), "brief should be auto-generated");
  assert.match(readFileSync(path.join(ws, "task-1-brief.md"), "utf8"), /^TASK_BASE: /m);
});

test("runTask: brief 不存在 + plan 不可用 → BLOCKED exit 1", async () => {
  const ws = mkdtempSync(path.join(tmpdir(), "cdd-task-runner-"));
  writeFileSync(path.join(ws, "progress.md"), "# CDD ledger\n"); // no plan
  writeFileSync(path.join(ws, "plan-constraints.md"), "constraints\n");
  // no brief, no plan
  const res = await runTask("claude", 1, {
    mode: "implement", dryRun: true, probeSkills: NOOP_PROBE,
    env: baseEnv(ws, { CDD_TASK_BRIEF: path.join(ws, "task-1-brief.md") }), noExit: true,
  });
  assert.equal(res.exitCode, 1);
});
```

- [ ] **Step 2: 运行全量 runner 测试确认失败（现有通过，新增中测试 2、3 失败）**

```bash
node --test packages/osuperpowers/bin/engine/tests/runner.test.mjs
```
Expected: 现有测试 PASS（setupWorkspace 已含 TASK_BASE），新增 4 个测试中测试 1 PASS（校验通过路径），测试 2 和 3 FAIL（runner 尚未集成 brief.mjs），测试 4 PASS（已有 step 2.55 brief-missing 兜底）

- [ ] **Step 3: 修改 runner.mjs — import + step 2.55 精简 + step 4.5 新增**

在文件顶部 import 区域追加：

```js
import { generateBrief, validateBrief } from "./brief.mjs";
```

找到 step 2.55 代码块（`// 2.55 Brief/templates existence check`），移除 brief 存在性检查：

```js
  // 2.55 Templates existence check — BLOCKED exit 1 if missing (not exit 3).
  {
    try {
      const tplDir = path.join(pluginRootFn(), "templates", "cdd");
      if (!existsSync(tplDir)) {
        return finish(1, [], `templates missing: ${tplDir}`, noExit);
      }
    } catch {
      return finish(1, [], "templates missing: osuperpowers plugin root not found", noExit);
    }
  }
```

在 step 4（`// 4. Ledger PLAN_FILE backfill`）之后、step 5（`// 5. Task-review fixed-point`）之前插入：

```js
  // 4.5 Brief 生成 / 校验（plan backfill 之后，task-review fixed-point 之前）
  // plan、taskNum、cwd 均为本函数现有作用域变量
  {
    const briefPath = env.CDD_TASK_BRIEF;
    if (briefPath) {
      if (!existsSync(briefPath)) {
        if (!plan) return finish(1, [], "brief missing and plan unavailable: cannot auto-generate brief", noExit);
        try {
          generateBrief(plan, taskNum, briefPath, cwd);
        } catch (e) {
          return finish(1, [], `brief auto-generation failed: ${e.message}`, noExit);
        }
      } else if (!validateBrief(briefPath)) {
        return finish(1, [], `brief missing TASK_BASE: line: ${briefPath}`, noExit);
      }
    }
  }
```

- [ ] **Step 4: 运行全量 runner 测试确认全部通过**

```bash
node --test packages/osuperpowers/bin/engine/tests/runner.test.mjs
```
Expected: 所有测试 PASS（含新增 4 个）

- [ ] **Step 5: Commit**

```bash
git add packages/osuperpowers/bin/engine/lib/runner.mjs packages/osuperpowers/bin/engine/tests/runner.test.mjs
git commit -m "feat: integrate brief.mjs into runner.mjs (step 2.55 + step 4.5) (#154)"
```

---

### Task 3: `runner.mjs` `runReviewPackage` OUTFILE 修复（#155）

**Files:**
- Modify: `packages/osuperpowers/bin/engine/lib/runner.mjs`（export + OUTFILE 第 4 参数 + shortSha）
- Modify: `packages/osuperpowers/bin/engine/tests/runner.test.mjs`（OUTFILE 测试）

**Interfaces:**
- Produces: `export async function runReviewPackage(...)` — 新增 export 供测试直接调用
- Produces: `runReviewPackage` opts 新增 `scriptsDir` DI 参数（override `findSuperpowersScriptsDir`）

- [ ] **Step 1: 在 runner.test.mjs 顶部 import 追加 runReviewPackage + 末尾追加 OUTFILE 测试**

在文件顶部 import 行追加 `runReviewPackage`（`chmodSync` 已在现有 import 中）：

```js
import { runTask, invokeCli, taskNumbersFromPlan, isTaskPending, handoffStatus,
         findSuperpowersScriptsDir, byVersion, runReviewPackage } from "../lib/runner.mjs";
```

在文件末尾追加：

```js
test("runReviewPackage: 传第 4 参数 OUTFILE = <workspace>/review-<base7>..<head7>.diff", async () => {
  const ws = mkdtempSync(path.join(tmpdir(), "cdd-outfile-"));
  const mockDir = mkdtempSync(path.join(tmpdir(), "mock-scripts-"));

  // mock review-package: capture $4 → file, create the diff file, output "wrote $4: 1 commit(s), 10 bytes"
  const captureFile = path.join(ws, "captured-outfile.txt");
  writeFileSync(
    path.join(mockDir, "review-package"),
    `#!/bin/sh\nprintf '%s' "$4" > "${captureFile}"\nmkdir -p "$(dirname "$4")"\ntouch "$4"\nprintf 'wrote %s: 1 commit(s), 10 bytes\\n' "$4"\n`,
  );
  chmodSync(path.join(mockDir, "review-package"), 0o755);

  const planFile = path.join(ws, "plan.md");
  writeFileSync(planFile, "# Plan\n");
  const handoffPath = path.join(ws, "task-1-handoff.json");
  writeFileSync(handoffPath, "{}");

  // base/head are full SHAs; shortSha = first 7 chars
  const base = "abc1234abcdefabc1234abcdefabc1234abcdefab";
  const head = "def5678defabcdef5678defabcdef5678defabcd";

  await runReviewPackage(planFile, base, head, handoffPath, {
    cwd: ws,
    env: process.env,
    scriptsDir: mockDir,
  });

  const captured = readFileSync(captureFile, "utf8");
  assert.match(captured, /review-abc1234\.\.def5678\.diff$/);
  assert.ok(captured.startsWith(ws), `expected captured path to start with workspace: ${captured}`);
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
node --test packages/osuperpowers/bin/engine/tests/runner.test.mjs 2>&1 | tail -10
```
Expected: OUTFILE 测试 FAIL（runReviewPackage 未 export，无 OUTFILE 参数，无 scriptsDir DI）

- [ ] **Step 3: 修改 runner.mjs — export + scriptsDir DI + shortSha + OUTFILE**

a. 将 `async function runReviewPackage` 改为 `export async function runReviewPackage`，并在 destructured opts 中加入 `scriptsDir` DI：

```js
export async function runReviewPackage(plan, base, head, handoffPath, { cwd, env, scriptsDir: scriptsDirOverride }) {
  const scriptsDir = scriptsDirOverride ?? findSuperpowersScriptsDir(cwd);
```

b. 在函数体内（`const reviewPkg =` 之前）新增：

```js
  function shortSha(sha) { return String(sha).slice(0, 7); }
  const wsDir = path.dirname(handoffPath);
  const outFile = path.join(wsDir, `review-${shortSha(base)}..${shortSha(head)}.diff`);
```

c. 将 `spawnCapture` 调用改为：

```js
  const res = await spawnCapture("bash", [reviewPkg, plan, base, head, outFile], { cwd, env });
```

d. `outLine` 解析保持不变。当前 `runReviewPackage` 中 `diffPath` 来自解析 stdout 末行 `wrote <path>:` 格式（`outLine.match(/^wrote ([^:]+):/)?.[1]`）。由于我们已将 outFile 作为第 4 参数传入，upstream 脚本会将其原样输出为 `wrote ${outFile}:`，因此 `diffPath === outFile`，无需改名，`existsSync(diffPath)` 检查自然通过。

- [ ] **Step 4: 运行全量 runner 测试**

```bash
node --test packages/osuperpowers/bin/engine/tests/runner.test.mjs
```
Expected: 所有测试 PASS

- [ ] **Step 5: Commit**

```bash
git add packages/osuperpowers/bin/engine/lib/runner.mjs packages/osuperpowers/bin/engine/tests/runner.test.mjs
git commit -m "fix: runReviewPackage pass explicit OUTFILE to review-package (#155)"
```

---

### Task 4: `cdd-review.mjs` `--handoff PATH`

**Files:**
- Modify: `packages/osuperpowers/bin/engine/cdd-review.mjs`
- Modify: `packages/osuperpowers/bin/engine/tests/review.test.mjs`

**Interfaces:**
- Consumes: `writeHandoff` from `./lib/contract.mjs`（已有函数）

- [ ] **Step 1: 在 review.test.mjs 末尾追加 3 个 handoff 测试**

在文件顶部 import 区域追加（若未引入）：

```js
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
```

追加测试：

```js
test("cdd-review.mjs: --handoff + mock exit 0 → handoff 含 status DONE", () => {
  const mock = mkdtempSync(path.join(tmpdir(), "cdd-review.mock-"));
  const handoffDir = mkdtempSync(path.join(tmpdir(), "cdd-handoff-"));
  makeMock(mock, "claude", 'printf "ok\\n"');
  const fp = harnessFreePath();
  const handoffPath = path.join(handoffDir, "test-handoff.json");
  const res = runExec(
    ["--harness", "claude", "--prompt", "hello", "--handoff", handoffPath],
    { mockPath: `${mock}${path.delimiter}${fp}` },
  );
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  assert.ok(existsSync(handoffPath), "handoff file should exist");
  const h = JSON.parse(readFileSync(handoffPath, "utf8"));
  assert.equal(h.status, "DONE");
});

test("cdd-review.mjs: --handoff + mock exit 1 → handoff 含 status BLOCKED + blocker", () => {
  const mock = mkdtempSync(path.join(tmpdir(), "cdd-review.mock-"));
  const handoffDir = mkdtempSync(path.join(tmpdir(), "cdd-handoff-"));
  makeMock(mock, "claude", 'printf "error output\\n" >&2; exit 1');
  const fp = harnessFreePath();
  const handoffPath = path.join(handoffDir, "test-handoff.json");
  const res = runExec(
    ["--harness", "claude", "--prompt", "hello", "--handoff", handoffPath],
    { mockPath: `${mock}${path.delimiter}${fp}` },
  );
  assert.notEqual(res.status, 0);
  assert.ok(existsSync(handoffPath), "handoff file should exist even on failure");
  const h = JSON.parse(readFileSync(handoffPath, "utf8"));
  assert.equal(h.status, "BLOCKED");
  assert.ok(h.blocker, "blocker field should be non-empty");
});

test("cdd-review.mjs: 无 --handoff → 不写文件", () => {
  const mock = mkdtempSync(path.join(tmpdir(), "cdd-review.mock-"));
  makeMock(mock, "claude", 'printf "ok\\n"');
  const fp = harnessFreePath();
  const handoffPath = path.join(mkdtempSync(path.join(tmpdir(), "cdd-handoff-")), "should-not-exist.json");
  runExec(["--harness", "claude", "--prompt", "hello"], { mockPath: `${mock}${path.delimiter}${fp}` });
  assert.equal(existsSync(handoffPath), false, "handoff file should NOT exist without --handoff");
});
```

- [ ] **Step 2: 运行 review 测试确认失败**

```bash
node --test packages/osuperpowers/bin/engine/tests/review.test.mjs 2>&1 | tail -10
```
Expected: 新增 3 个测试 FAIL

- [ ] **Step 3: 修改 cdd-review.mjs — import + 参数解析 + handoff 写入 + usage 更新**

a. 在文件顶部 import 区域追加：

```js
import { writeHandoff } from "./lib/contract.mjs";
```

b. 在变量声明区域（`let harness = ""; let prompt = "";` 等处）追加：

```js
let handoffPath = "";
```

c. 在 for 循环 switch 语句中追加（与其他 case 并列）：

```js
    case "--handoff":
      if (i + 1 >= args.length) usage();
      handoffPath = args[++i];
      break;
```

d. 在 `invokeCli` 调用之后、`if (!res.ok)` 判断之前插入 handoff 写入：

```js
if (handoffPath) {
  writeHandoff(handoffPath, res.ok
    ? { status: "DONE" }
    : { status: "BLOCKED", blocker: (res.stderr.split("\n")[0] || "").trim() || `cli exited ${res.code}` });
}
```

e. 更新 `usage()` 和 `help()` 中的文本：

```
usage: cdd-review.mjs --harness <name> (--prompt <text> | --template <name> [--param KEY=VALUE...]) [--handoff PATH]
```

- [ ] **Step 4: 运行全量 review 测试**

```bash
node --test packages/osuperpowers/bin/engine/tests/review.test.mjs
```
Expected: 所有测试 PASS

- [ ] **Step 5: Commit**

```bash
git add packages/osuperpowers/bin/engine/cdd-review.mjs packages/osuperpowers/bin/engine/tests/review.test.mjs
git commit -m "feat: add --handoff PATH to cdd-review.mjs"
```

---

### Task 5: `brainstorming/SKILL.md` grilling 委托 + next-step 标签

**Files:**
- Modify: `packages/osuperpowers/skills/brainstorming/SKILL.md`
- Modify: `packages/osuperpowers/skills/brainstorming/SKILL.zh-CN.md`

- [ ] **Step 1: 修改 `brainstorming/SKILL.md`**

a. 在 **Rule: Read Sub-Skills** 内，找到「On failure (file not found / read error) → **report error + ask the user for next steps**...」段落之后追加：

```
After reading the grilling SKILL.md, execute its instructions as the grilling framework verbatim — do not substitute with a self-organized interview format, option menus, or structured choice lists.
```

b. 在 **Rule: Spec Review via CLI** 内，找到「Dispatch discipline: see [docs-review.md]...」段落之后追加：

```
Review Stopping next-step label for this skill: `"User review of spec"`.
```

c. 在 **Red Flags** 末尾无条件追加（当前 brainstorming/SKILL.md 中该条 Red Flag 尚不存在）：

```
- "Presents Option A / Option B choices instead of following grilling skill" → violates Rule: Read Sub-Skills (grilling delegation); apply grilling SKILL.md instructions verbatim
```

- [ ] **Step 2: 同步更新 `brainstorming/SKILL.zh-CN.md`**

对应中文翻译，与英文源文件结构对齐：

- Rule: Read Sub-Skills 追加：「读取 grilling SKILL.md 后，须将其指令作为 grilling 阶段的执行框架如实执行，不得以自行组织的提问格式、选项菜单或结构化选择列表替代。」
- Rule: Spec Review via CLI 追加：「Review Stopping next-step 标签（本技能）：`"用户审阅 spec"`。」
- Red Flags 追加：「"以选项 A / 选项 B 形式替代 grilling 技能" → 违反 Rule: Read Sub-Skills（grilling 委托）；须如实执行 grilling SKILL.md 指令」

- [ ] **Step 3: 运行 emit + 校验**

```bash
pnpm run emit
pnpm run emit:check
```
Expected: emit 成功，emit:check 无 drift

- [ ] **Step 4: 运行测试**

```bash
node --test packages/osuperpowers/bin/engine/tests/*.test.mjs
```
Expected: 全部 PASS

- [ ] **Step 5: Commit**

```bash
git add packages/osuperpowers/skills/brainstorming/SKILL.md packages/osuperpowers/skills/brainstorming/SKILL.zh-CN.md .agents/
git commit -m "fix: strengthen brainstorming Rule: Read Sub-Skills grilling delegation + next-step label"
```

---

### Task 6: `docs-review.md` Rule: Review Stopping AskUserQuestion 改进

**Files:**
- Modify: `packages/osuperpowers/docs/docs-review.md`
- Modify: `packages/osuperpowers/docs/docs-review.zh-CN.md`

- [ ] **Step 1a: 替换 Rule: Review Stopping 循环结构**

找到 Rule: Review Stopping 下 `Loop flow:` 开始到 `When presenting warn/nit:` 前的循环结构（大约 15 行），整体替换为：

```
Loop flow:
  ① Run 3-pass review
  ② blocker: must fix → re-run only the failing pass → blocker=0 → continue
  ③ All passes blocker=0 → present warn/nit list to user (per-item selection allowed):

     AskUserQuestion with two options:
       "Proceed: <next-step>" (caller provides next-step label)
         → review complete, go to next step
       "Fix selected warns/nits"
         → fix selected items → review complete, go to next step

     Re-run is never offered after ③.
```

- [ ] **Step 1b: 在循环结构之后追加说明段落**

在上方循环结构之后追加（不替换现有「When presenting warn/nit:」说明）：

```
`<next-step>` label is provided by the calling skill (e.g., brainstorming → "User review of spec";
writing-plans → "Execution Handoff").

Re-run is never offered after all passes are blocker=0: re-running without changes produces
identical results; re-running after fixes adds no value. Step ② blocker re-run is the only re-run.
```

- [ ] **Step 2: 同步更新 `docs-review.zh-CN.md`**

找到 Rule: Review Stopping 下以「① 执行 3-pass review」开始的循环结构（定位锚：`用户说【不修复】` 和 `用户说【修复部分或全部】` 两个子段），整体替换为：

```
循环流程：
  ① 执行 3-pass review
  ② blocker：必须修复 → 只重跑产生该 blocker 的那一 pass → blocker=0 → 继续
  ③ 所有 pass blocker=0 → 将 warn/nit 列表呈现给用户（允许逐项选择）：

     使用 AskUserQuestion，两个选项：
       「继续：<next-step>」（由调用方技能提供标签）
         → review 完成，进入下一步
       「修复选定 warn/nit」
         → 修复选定项 → review 完成，进入下一步

     ③ 之后不提供重跑选项。
```

在循环结构之后追加：「`<next-step>` 标签由调用方技能提供（如 brainstorming → "用户审阅 spec"；writing-plans → "Execution Handoff"）。blocker 重跑（步骤 ②）是唯一的重跑；③ 之后不重跑。」

- [ ] **Step 3: 运行 emit + 校验**

```bash
pnpm run emit
pnpm run emit:check
```
Expected: emit 成功，emit:check 无 drift

- [ ] **Step 4: Commit**

```bash
git add packages/osuperpowers/docs/docs-review.md packages/osuperpowers/docs/docs-review.zh-CN.md .agents/
git commit -m "fix: docs-review.md Rule: Review Stopping use AskUserQuestion with next-step label"
```

---

### Task 7: `writing-plans/SKILL.md` next-step 标签 + 全量 validate + changeset

**Files:**
- Modify: `packages/osuperpowers/skills/writing-plans/SKILL.md`
- Modify: `packages/osuperpowers/skills/writing-plans/SKILL.zh-CN.md`

- [ ] **Step 1: 修改 `writing-plans/SKILL.md`**

在 **Rule: Plan Review via CLI** 内，找到「Dispatch discipline: see [docs-review.md]...」段落之后追加：

```
Review Stopping next-step label for this skill: `"Execution Handoff"`.
```

- [ ] **Step 2: 同步更新 `writing-plans/SKILL.zh-CN.md`**

对应中文翻译追加：「Review Stopping next-step 标签（本技能）：`"Execution Handoff"`。」

- [ ] **Step 3: 运行 emit + 全量 validate**

```bash
pnpm run emit
pnpm run validate
```
Expected: emit 成功；validate 全绿（12 blocks 全部 OK）

- [ ] **Step 4: 创建 changeset**

```bash
pnpm run changeset
```
在 changeset 中选择 `osuperpowers` package，bump type `patch`，描述：

```
fix: P2 dogfood fixes — brief auto-generation (#154), review-package OUTFILE (#155), cdd-review --handoff, grilling delegation, docs-review AskUserQuestion
```

- [ ] **Step 5: Commit**

```bash
git add packages/osuperpowers/skills/writing-plans/SKILL.md packages/osuperpowers/skills/writing-plans/SKILL.zh-CN.md .agents/ .changeset/
git commit -m "fix: writing-plans Rule: Plan Review via CLI add next-step label; add changeset"
```
