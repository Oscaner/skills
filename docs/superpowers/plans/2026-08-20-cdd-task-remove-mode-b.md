# Delete cdd-task Mode B — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove Mode B (whole-plan runner) from cdd-task.mjs, keeping only per-task Mode A with --plan as optional parameter.

**Architecture:** Delete runPlan/runTaskChain from runner.mjs, strip Mode B branch from cdd-task.mjs argument parser, remove Mode B documentation from two docs, delete two Mode B test cases from task.test.mjs. No new files; no refactoring of Mode A.

**Tech Stack:** Node.js (ESM), node:test, git

## Global Constraints

- 不破坏 Mode A per-task 路径
- `node --test packages/osuperpowers/bin/engine/tests/` 全部通过
- `pnpm run validate` 通过

---

### Task 1: Remove Mode B from engine code and docs

**Files:**
- Modify: `packages/osuperpowers/bin/engine/cdd-task.mjs`
- Modify: `packages/osuperpowers/bin/engine/lib/runner.mjs`
- Modify: `packages/osuperpowers/docs/cdd-reference.md`
- Modify: `packages/osuperpowers-router/docs/cross-harness-overrides.md`
- Modify: `packages/osuperpowers/bin/engine/tests/task.test.mjs`

**Interfaces:**
- Consumes: `runTask` (runner.mjs) — preserved as-is
- Produces: No new exports; runner.mjs exports `runTask` unchanged

- [ ] **Step 1: Remove Mode B branch from cdd-task.mjs**

In `packages/osuperpowers/bin/engine/cdd-task.mjs`, remove the Mode B `else` branch and `runPlan` import. The `--plan` flag stays in Mode A as optional.

Replace the import line:
```javascript
import { runTask, runPlan } from "./lib/runner.mjs";
```
with:
```javascript
import { runTask } from "./lib/runner.mjs";
```

Replace the argument dispatch block (line 75-86):
```javascript
if (taskNum !== "") {
  // Mode A
  if (!modeArg) usage();
  const env = { ...process.env };
  if (planFile) env.PLAN_FILE = planFile;
  // noExit=false：runTask 自行 exit helpers —— 薄壳无需落地退出码。
  await runTask(harness, taskNum, { mode: modeArg, dryRun: DRY_RUN, env });
} else {
  // Mode B
  if (!planFile) usage();
  await runPlan(planFile, harness, { dryRun: DRY_RUN });
}
```
with:
```javascript
// Mode A (per-task only; --plan is optional — sets PLAN_FILE for workspace resolution)
if (!taskNum || !modeArg) usage();
const env = { ...process.env };
if (planFile) env.PLAN_FILE = planFile;
await runTask(harness, taskNum, { mode: modeArg, dryRun: DRY_RUN, env });
```

Update comments and usage/help strings to remove Mode B references:
- File header comment (lines 1-4): `// cdd-task.mjs — osuperpowers single task runner: one mode per invocation.`
- Entry disambiguation comment (lines 9-10) — delete: the `// Entry disambiguation: … Mode B` comment
- PLAN_FILE comment (lines 13-14) — delete: the `// Mode A passes --plan via PLAN_FILE env… 只有 Mode B 恒从 plan 派生 workspace` comment (no longer relevant since only Mode A exists)
- usage(): `usage: ${NAME} --harness <name> --task N --mode implement|task-review|fix [--plan PATH]\n`
- help(): same as usage

- [ ] **Step 2: Delete runPlan/runTaskChain from runner.mjs**

In `packages/osuperpowers/bin/engine/lib/runner.mjs`:

a) Remove `writePlanConstraints` from the ledger import (line 17). Change:
```javascript
import { appendLedger, writePlanConstraints } from "./ledger.mjs";
```
to:
```javascript
import { appendLedger } from "./ledger.mjs";
```

b) Update file header comment (lines 1-8): remove `// runPlan：plan-constraints 写 → pending tasks × 三模式链…` and `// noExit=true 时返回 { exitCode, h1 } 而非 exit helpers —— runPlan 组合 / 单测的 seam。`

c) Delete `runPlan` function (lines 545-589): the entire function body from `export async function runPlan(...)` through its closing `}`.

d) Delete `runTaskChain` helper (lines 605-665): the entire function body from `async function runTaskChain(...)` through its closing `}`.

e) Delete `chainBlocked` helper (lines 593-595): the 3-line function.

f) Delete `chainRunTaskFailed` helper (lines 598-603): the 4-line function.

- [ ] **Step 3: Delete Mode B section from cdd-reference.md**

In `packages/osuperpowers/docs/cdd-reference.md`, delete lines 119-121:
```
## Mode B (opt-in / AFK)

**Mode B (opt-in / AFK):** `{plugin_root}/bin/engine/cdd-task.mjs --harness <name> --plan <path>` reads plan + ledger; for each **pending task** runs the same 3-mode chain. Pending = no `Task N: complete` ledger line and handoff not `APPROVED` (or handoff missing). Batch blocks dispatch the entire batch's 3-mode chain once.
```

Also remove the `(mode A)` qualifier in H6 heading — change `### H6 — CLI dispatch (p1)` content to remove the Mode A/Mode B distinction. Specifically, update the "Typical per-task CLI sequence" heading comment from `(mode A — thin orchestrator)` to `(per-task — thin orchestrator)`.

- [ ] **Step 4: Delete Mode B section from cross-harness-overrides.md**

In `packages/osuperpowers-router/docs/cross-harness-overrides.md`:

a) Line 190: Remove ` / runPlan (pending tasks × 3-mode chain)` from the shared library description. Change:
```
**and the shared task/plan run-loop** `runTask` (one mode per invocation) / `runPlan` (pending tasks × 3-mode chain)
```
to:
```
**and the shared task run-loop** `runTask` (one mode per invocation)
```

b) Same line: Remove `| --plan <path>` from the CLI runner description. Change:
```
(`--harness <name> --task N --mode M` | `--plan <path>`)
```
to:
```
(`--harness <name> --task N --mode M`)
```

c) Delete lines 200-207: the entire Mode B description block including trailing blank line and closing code fence:
```
**Mode B (plan driver / AFK):** batch pending tasks from plan + ledger:

```bash
{osuperpowers}/bin/engine/cdd-task.mjs --harness <name> --plan <path>
```

Plan driver runs the 3-mode chain per pending task. Ledger append on APPROVED only.

```

- [ ] **Step 5: Delete Mode B test cases from task.test.mjs**

In `packages/osuperpowers/bin/engine/tests/task.test.mjs`:

a) Delete test case "cdd-task.mjs: Mode B dry-run 无 pending task → exit 0 + no-pending stderr" (lines 106-119).

b) Delete test case "cdd-task.mjs: Mode B dirty-tree 实现 → 链错误路径 CDD_BLOCKED stderr + exit 1" (lines 121-137).

c) Delete the `execFileSyncQuiet` helper (lines 139-141) — only used by the two deleted Mode B tests. Also remove `execFileSync` from the line 7 import:
```javascript
import { spawnSync, execFileSync } from "node:child_process";
```
Change to:
```javascript
import { spawnSync } from "node:child_process";
```

d) Update the file header comment (lines 1-3): remove `+ Mode B no-pending`.

e) Add a new test case confirming that `--plan` without `--task` triggers usage error:
```javascript
test("cdd-task.mjs: --plan without --task → usage stderr + exit 2", () => {
  const ws = mkdtempSync(path.join(tmpdir(), "cdd-plan-notask-"));
  writeFileSync(path.join(ws, "plan.md"), "# Plan\n");
  const res = run(
    ["--harness", "claude", "--plan", path.join(ws, "plan.md")],
    { CDD_DRY_RUN: "1" },
  );
  assert.equal(res.status, 2, `stderr: ${res.stderr}`);
  assert.match(res.stderr, /^usage: /);
});
```

- [ ] **Step 6: Run engine tests**

```bash
node --test packages/osuperpowers/bin/engine/tests/
```
Expected: all tests pass.

- [ ] **Step 7: Run full validation**

```bash
pnpm run validate
```
Expected: emit check, plugin resolution, and all validation blocks pass.

- [ ] **Step 8: Commit**

```bash
git add packages/osuperpowers/bin/engine/cdd-task.mjs \
        packages/osuperpowers/bin/engine/lib/runner.mjs \
        packages/osuperpowers/docs/cdd-reference.md \
        packages/osuperpowers-router/docs/cross-harness-overrides.md \
        packages/osuperpowers/bin/engine/tests/task.test.mjs
git commit -m "feat: remove Mode B whole-plan runner from cdd-task, keep per-task Mode A only"
```