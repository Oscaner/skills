# os-engineering P5 Implementation Plan：CDD 引擎 + CI + 测试脚本迁 Node（单语言终态）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 CDD 引擎（bash）+ ci-validate + 全部 shell/python 测试 + release 辅助迁 Node，可执行面单语言终态。

**Architecture:** `bin/engine/lib/cdd-common.sh`（778 行，28 函数）按 concern 拆 6 个 Node 模块（runner / registry / templates / contract / ledger / exit）+ 4 入口 `.mjs` 壳；`ci-validate.sh` → `scripts/ci-validate.mjs`（保留 12 个 block 子检查）；9 shell 测试 + test-lib + rule-reference.py → node:test；release 辅助 + overrides 测试 → `.mjs`。**CDD 契约不变**（CLI / handoff JSON / exit codes / H6 链 / ledger）—— 逐字节兼容，唯一 sanctioned divergence 是嵌套 CLI 失败时把 stderr 捕获进 handoff blocker。P5 全程用 bash 引擎迁移自己（自举），Node 引擎完成后用契约测试 + 自举 smoke 验证再切默认。

**Tech Stack:** Node.js（`.mjs` + `node:test` + `child_process`）、JSON（harness-registry 保持）、Markdown（templates/cdd/*.md 保持）。

## Global Constraints

- **CDD 契约不变**：CLI 形状 / handoff JSON 字段形状 / exit codes（0/1/2）/ H1 四行 / H6 三模式链 / ledger / plan-constraints / `CDD_*` env —— 逐字节兼容，下游（os-*/cli-* 技能、orchestrator、hooks）零改动。
- **唯一 sanctioned divergence**：嵌套 CLI 失败时把 stderr 捕获进 handoff blocker（落 `contract.mjs`）；契约测试断言字段形状，不断言被吞错误的旧行为。
- **Node 原生 + 清理债**：拆模块 / async child_process / 结构化错误处理；**模块数量固定为 6 + 4 入口，不新增抽象**。
- **保持**：`harness-registry.json`、`templates/cdd/*.md`、`gh-branch-rulesets/{main,develop}.json`、package.json/hooks。
- **自举**：P5 全程用 bash 引擎执行迁移任务；Node 引擎完成后用自举 smoke（H1 + handoff 与 bash 逐字段一致）验证再切默认。
- **全量迁移**：引擎 + ci-validate + 9 shell 测试 + test-lib + rule-reference.py + 2 release 辅助 + overrides 测试（含 manifest-harness.py）→ Node；终态可执行面无 `.sh`/`.py`。
- `pnpm run validate` 每任务后 ALL PASS；conventional commits，无 attribution / co-author trailer；禁 git worktree；零残留。

---

## File Structure

| 文件 | 责任 | Task |
|---|---|---|
| `packages/engineering/bin/engine/lib/runner.mjs` | `cdd_run_task` / `cdd_run_plan` / H6 三模式链 / env / **H1 四行输出** | T2 |
| `packages/engineering/bin/engine/lib/registry.mjs` | harness-registry 加载 + `cdd_check_harness`（ship gate / CLI preflight）| T1 |
| `packages/engineering/bin/engine/lib/templates.mjs` | `cdd_render_mode_prompt`（渲染 templates/cdd/*.md + handoff-write 片段，不写文件）| T1 |
| `packages/engineering/bin/engine/lib/contract.mjs` | commit-contract 校验 + **handoff JSON 写入**（含 stderr-surfacing）| T2 |
| `packages/engineering/bin/engine/lib/ledger.mjs` | ledger 追加 / plan-constraints / 任务排序 | T1 |
| `packages/engineering/bin/engine/lib/exit.mjs` | exit codes（0/1/2）/ blocked 消息 / harness stub | T1 |
| `packages/engineering/bin/engine/cdd-run.mjs` / `cdd-exec.mjs` / `cdd-select.mjs` / `cdd-session-activate.mjs` | 4 入口薄壳（Mode A/B 分派等）| T3 |
| `scripts/ci-validate.mjs` | validate 编排（12 个 block 子检查，含 5c 零残留 grep）| T4 |
| `packages/engineering/tests/*.test.mjs` + `helpers.mjs` | 引擎/ci-validate node:test（9 shell 测试 + test-lib 迁移）| T5 |
| `packages/engineering/tests/rule-reference.test.mjs` | 语义规则名解析（port rule-reference.py）| T6 |
| `scripts/cleanup-legacy-release-tags.mjs` / `gh-branch-rulesets.mjs` | release 辅助迁 Node | T6 |
| `packages/superpowers-overrides/tests/validate-overrides-build.mjs` / `manifest-harness.test.mjs` | overrides 测试迁 Node | T6 |
| 删除 | `bin/engine/*.sh`、`lib/cdd-common.sh`、`scripts/ci-validate.sh`、`tests/*.sh`、`*.py`、release `.sh` | T7 |
| `CLAUDE.md` / docs | `.sh` → `.mjs` 引用更新 | T7 |

---

### Task 1: 基础模块（registry / exit / templates / ledger）→ Node + 单测

**Files:**
- Create: `packages/engineering/bin/engine/lib/registry.mjs`、`exit.mjs`、`templates.mjs`、`ledger.mjs`
- Test: `packages/engineering/bin/engine/tests/registry.test.mjs`、`exit.test.mjs`、`templates.test.mjs`、`ledger.test.mjs`
- （`bin/engine/lib/cdd-common.sh` **保留** —— bash 引擎并行运行，P5 任务仍用它；Node 模块独立单测）

**Interfaces:**
- Consumes: 无（cdd-common.sh 为移植源，行为为准）
- Produces: 4 个基础模块导出 —— T2（runner/contract）依赖

> **测试树约定（钉死，消除 T1-T3 vs T5 重复）**：`bin/engine/tests/` = **模块单测**（unit tier，T1-T3 直接写最终位置）；`packages/engineering/tests/` = **行为/集成测试**（integration tier，T5 迁 shell 测试）；ci-validate.mjs 5b **两棵树都跑**。T1-T3 的模块测试是**最终产物**，不是临时脚手架；T5 只迁 T1-T3 未覆盖的 shell 测试（common-functions 剩余 + helpers + 删 `.sh`）。

- [ ] **Step 1: 写失败测试（port 现有 shell 断言）**

`registry.test.mjs`：harness-registry 读取（7 harness）、`checkHarness` ship gate（unknown/not-supported → blocked）、CLI preflight（missing cli → exit 2）、registry 字段读取。`exit.test.mjs`：exit codes + blocked 消息。`templates.test.mjs`：`renderModePrompt` 输出包含 mode 模板 + env 替换 + handoff-write 片段；**行预算用真实阈值**（port `cdd-orchestrator-line-budget.test.sh`：sdd≤160 / ctrl≤110 / tier1≤225 / tier2≤350，非 121/165）。`ledger.test.mjs`：ledger 追加格式 + deferred roll-up。

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadRegistry, checkHarness } from "../lib/registry.mjs";
test("checkHarness: claude 通过 ship gate", () => {
  const reg = loadRegistry("packages/engineering/bin/engine/harness-registry.json");
  assert.equal(checkHarness(reg, "claude").cli, "claude");
});
test("checkHarness: not-supported harness → blocked", () => {
  const reg = loadRegistry("packages/engineering/bin/engine/harness-registry.json");
  assert.throws(() => checkHarness(reg, "codex"));
});
```

- [ ] **Step 2: 跑测试确认 FAIL** → `node --test packages/engineering/bin/engine/tests/`
- [ ] **Step 3: 实现 4 个模块**（从 `cdd-common.sh` 对应函数移植）

- `registry.mjs`：`loadRegistry(path)`（读 harness-registry.json）+ `checkHarness(reg, harness)`（ship gate：unknown/not-supported → `exitBlocked`；CLI 存在校验）+ `registryField(reg, harness, field)`。port 自 `cdd_check_harness` / `_cdd_registry_field`。
- `exit.mjs`：`exitOk()` / `exitBlocked(msg)`（exit 1 + H1 blocker）/ `exitCliMissing(harness)`（exit 2）。port 自 `cdd_exit_*`。**H1 四行输出仍由 runner.mjs 独占**（T2）—— exit.mjs 只提供 exit code + 消息文本。
- `templates.mjs`：`renderModePrompt(mode, env)`（读 `templates/cdd/<mode>.md` + `_handoff-write-fragment.md`，env 变量替换）+ `lineBudget(tier)`。port 自 `cdd_render_mode_prompt` / `cdd_render_template`。
- `ledger.mjs`：`appendLedger(ledgerPath, task, status, range, deferred)`（port `_append_ledger` deferred roll-up）+ `writePlanConstraints(plan, out)`（port `_cdd_write_plan_constraints`）。

- [ ] **Step 4: 跑测试 PASS + validate**

```bash
node --test packages/engineering/bin/engine/tests/
pnpm run validate
```

Expected: 新单测 PASS；validate ALL PASS（bash 引擎未动，旧 shell 测试仍绿）。

- [ ] **Step 5: 提交**

```bash
git add packages/engineering/bin/engine/lib packages/engineering/bin/engine/tests
git commit -m "feat: port engine base modules to Node (registry/exit/templates/ledger)"
```

---

### Task 2: contract + runner 模块（H6 链核心）→ Node

**Files:**
- Create: `packages/engineering/bin/engine/lib/contract.mjs`、`runner.mjs`
- Test: `packages/engineering/bin/engine/tests/contract.test.mjs`、`runner.test.mjs`
- （`cdd-common.sh` 保留；bash 引擎并行）

**Interfaces:**
- Consumes: T1（registry/exit/templates/ledger）
- Produces: `runTask(harness, taskNum, opts)` / `runPlan(planFile, harness)`（T3 入口壳调用）+ `writeHandoff(...)`（contract，H6 链写 handoff）

- [ ] **Step 1: 写失败测试（port cdd-commit-gate-smoke + severity-contract）**

`contract.test.mjs`（port `cdd-commit-gate-smoke.sh` 16 断言 + `cdd-severity-contract.sh` 30 断言）：commit-contract 校验 —— dirty-tree → blocked + handoff.status=BLOCKED；head-mismatch → blocked；no-handoff → exit 2；clean-tree → pass；`findings[].deferred` roll-up（warn/nit → APPROVED，never → CHANGES_REQUESTED）。`runner.test.mjs`（port `cdd-cli-dry-run-smoke`）：`runTask` dry-run H1 四行 + handoff 写。

```js
import { validateCommitContract } from "../lib/contract.mjs";
test("commit-contract: dirty tree → BLOCKED", () => {
  const r = validateCommitContract("implement", "/tmp/fake-repo-dirty");
  assert.equal(r.ok, false);
});
test("severity: warn/nit → APPROVED + deferred", () => {
  assert.equal(classifySeverity("warn"), "deferred");
});
```

- [ ] **Step 2: 跑测试确认 FAIL** → `node --test packages/engineering/bin/engine/tests/`
- [ ] **Step 3: 实现 `contract.mjs`**（port 自 `cdd_validate_commit_contract` + handoff 写入）

- `validateCommitContract(mode, repoRoot)`：git 状态校验（`git status --porcelain` 干净？HEAD 匹配 handoff.commits.head？）→ `{ ok, blocker }`。
- `writeHandoff(handoffPath, data)`：按 handoff JSON schema 写（`{ task, phase, status, commits, complexity, review_scope, artifacts, test_evidence, findings[], unverifiable[], plan_conflicts[] }`）。**嵌套 CLI 失败时把 stderr 捕获进 blocker**（唯一 sanctioned divergence，§spec 2.1）。
- `classifySeverity(sev)` **返回契约钉死**：`"blocker"` → `CHANGES_REQUESTED`；`"warn"|"nit"` → `"deferred"`（APPROVED 且 findings deferred）；`"unverifiable"` / NEEDS_CONTEXT → `"STOP"`（BLOCKED）。测试断言 `classifySeverity("warn") === "deferred"`、`classifySeverity("blocker") === "CHANGES_REQUESTED"`。

**注**：`validateCommitContract` 测试需 git fixture（`setup_repo` port 自 `cdd-commit-gate-smoke.sh` —— 非 git 目录 fail-open `ok: true`，不 assert `false`）。

- [ ] **Step 4: 实现 `runner.mjs`**（port 自 `cdd_run_task` / `cdd_run_plan`，**H1 四行输出独占**）

- `runTask(harness, taskNum, opts)`：ordered contract —— registry ship gate → CLI preflight → env 设置 → ledger PLAN_FILE backfill → review fixed-point → `renderModePrompt` → **async `child_process.spawn` 调嵌套 CLI**（`$cli $invoke "$prompt_arg"`，捕获 stderr 而非 `2>/dev/null` 吞）→ commit-contract 校验 → H1 四行 → handoff 处理。
- `runPlan(planFile, harness)`：plan-constraints 写 → pending tasks × 三模式链 → ledger 追加。
- env：`CDD_*` 变量设置与 bash 一致。

- [ ] **Step 5: 跑测试 PASS + validate**

```bash
node --test packages/engineering/bin/engine/tests/
pnpm run validate
```

Expected: 新单测 PASS（contract + runner dry-run）；validate ALL PASS（bash 引擎未动）。

- [ ] **Step 6: 提交**

```bash
git add packages/engineering/bin/engine/lib packages/engineering/bin/engine/tests
git commit -m "feat: port runner/contract to Node (H6 chain core + handoff)"
```

---

### Task 3: 4 入口 `.mjs` 壳

**Files:**
- Create: `packages/engineering/bin/engine/cdd-run.mjs`、`cdd-exec.mjs`、`cdd-select.mjs`、`cdd-session-activate.mjs`
- Test: `packages/engineering/bin/engine/tests/run.test.mjs`、`exec.test.mjs`、`select.test.mjs`、`session-activate.test.mjs`
- （bash `.sh` 入口保留到 T7 —— P5 编排仍用 bash；Node 入口经 node:test 验证）

**Interfaces:**
- Consumes: T2（runTask/runPlan）+ T1 模块
- Produces: 4 个可执行 `.mjs` 入口（T4/T5 测试 + T7 切默认消费）；CLI 契约与 `.sh` 一致

- [ ] **Step 1: 写失败测试（port cdd-exec/select 测试）**

`run.test.mjs`：`node cdd-run.mjs --harness claude --task 1 --mode implement --plan <path>` dry-run → H1 四行 + exit 0（port `cdd-cli-dry-run-smoke`）。`exec.test.mjs` / `select.test.mjs` / `session-activate.test.mjs`：port `cdd-exec.test.sh` / `cdd-select.test.sh` / session-activate 行为（CLI 参数分派、harness 选择输出、pending 写）。`#!/usr/bin/env node` + `chmod +x`。

```js
import { execFileSync } from "node:child_process";
test("cdd-run.mjs dry-run implement → H1 status DONE", () => {
  const out = execFileSync("node", ["packages/engineering/bin/engine/cdd-run.mjs", "--harness", "claude", "--task", "1", "--mode", "implement", "--plan", "docs/superpowers/plans/2026-08-10-os-engineering-p5.md"], { env: { ...process.env, CDD_DRY_RUN: "1", CDD_WORKSPACE: "/tmp/p5-dry-run" }, encoding: "utf8" });
  assert.match(out, /status: DONE/);
});
```

- [ ] **Step 2: 跑测试确认 FAIL** → `node --test packages/engineering/bin/engine/tests/`
- [ ] **Step 3: 实现 4 个入口**（薄壳，调 runner/contract/registry；**port 描述以实际 `.sh` 为准**）

- `cdd-run.mjs`：解析 args（`--harness` / `--task` / `--mode` / `--plan`），Mode A → `runTask`，Mode B → `runPlan`；usage/help → exit 2 / 0。dry-run = `CDD_DRY_RUN=1` env（**非 `--dry-run` flag**）。
- `cdd-exec.mjs`：**一次性 prompt-runner**（port `cdd-exec.sh`：`--harness --prompt` 直跑嵌套 CLI，输出按 registry `output` 模式归一化 —— stream-json 取最后 completion finalText / text 直通；**不跑任务链**）。
- `cdd-select.mjs`：harness 选择（port `cdd-select.sh`：**非交互**，读 registry + `command -v` 列已装，输出 `available:` / `unsupported_installed:` / `recommended:` 行）。
- `cdd-session-activate.mjs`：pending 写（port `cdd-session-activate.sh`：**`minimal` / `bind` 位置参数子命令** + `CDD_PENDING_ROOT` 写）。

- [ ] **Step 4: 跑测试 PASS + validate**

```bash
node --test packages/engineering/bin/engine/tests/
pnpm run validate
```

Expected: 新测试 PASS；validate ALL PASS（bash 入口仍被 P5 编排用 + 旧 shell 测试）。

- [ ] **Step 5: 提交**

```bash
git add packages/engineering/bin/engine/cdd-run.mjs packages/engineering/bin/engine/cdd-exec.mjs packages/engineering/bin/engine/cdd-select.mjs packages/engineering/bin/engine/cdd-session-activate.mjs packages/engineering/bin/engine/tests
git commit -m "feat: Node entry shells (run/exec/select/session-activate)"
```

---

### Task 4: ci-validate.mjs（validate 编排）

**Files:**
- Create: `scripts/ci-validate.mjs`
- Modify: `package.json`（`validate` → `node scripts/ci-validate.mjs`）、`.github/workflows/ci.yml`（如引用 `.sh`）、`CLAUDE.md`（validate 命令描述）
- Test: `packages/engineering/tests/ci-validate.test.mjs`（port `ci-validate-wiring.test.sh`）

**Interfaces:**
- Consumes: T1-T3（Node 引擎 + node:test）
- Produces: `node scripts/ci-validate.mjs` 全绿（T5/T6 测试并入 + T7 收尾）

- [ ] **Step 1: port ci-validate.sh 全部 12 个 block 子检查**

`ci-validate.mjs` 保留：step 0 初始化 / 1 plugin.json resolve / 2 skills SKILL.md / 3 orphan / 4 hooks 可执行 / 5 overrides build / 5b engineering validate（node:test gate+engine）/ **5b2 gate hooks 可执行** / **5c engine+router 零残留 grep（sdd_/spor-，不得丢）** / 6 marketplace / 7 lib 单元测试 / 8–10 version sync / 11 submodule resolvable。Node 用 `execFileSync` 调 emit/version 脚本 + `node:test` 聚合 + 结构化失败（`console.error` 步骤 + `process.exit(1)`）。`ci-validate-wiring.test.sh` 断言 → `ci-validate.test.mjs`（步骤接线 + 失败传播）。

- [ ] **Step 2: package.json `validate` 改指 `.mjs`**

```json
"validate": "node scripts/ci-validate.mjs"
```

- [ ] **Step 3: 验证**

```bash
pnpm run validate
```

Expected: ALL PASS（ci-validate.mjs 编排全部 12 block，含旧 shell 测试仍通过 —— bash 引擎 + 旧 shell 测试未删）。

- [ ] **Step 4: 提交**

```bash
git add scripts/ci-validate.mjs package.json .github CLAUDE.md
git commit -m "feat: ci-validate.mjs — Node validate orchestration (12 blocks)"
```

---

### Task 5: 行为/集成测试迁 node:test（T1-T3 未覆盖的 shell 测试）

**Files:**
- Create: `packages/engineering/tests/helpers.mjs`（port `test-lib.sh` —— 核实：test-lib.sh 只有 `harness_free_path`；`setup_repo`/fixture git 布局在 `cdd-commit-gate-smoke.sh` 内，一并 port）
- Create: `packages/engineering/tests/common-functions.test.mjs`（port `cdd-common-functions.test.sh` 剩余函数家族：`cdd_plugin_root` / `cdd_superpowers_scripts_dir` / env 校验等 —— 按函数家族命名，不用「剩余」）
- Delete: 9 个 `.sh` 测试 + `test-lib.sh`

**Interfaces:**
- Consumes: T1-T4（Node 引擎 + ci-validate.mjs；T1-T3 已在 `bin/engine/tests/` 建模块单测）
- Produces: 行为测试全 node:test（T7 删 bash 的依据）

> **树关系（沿用 T1 钉死）**：`bin/engine/tests/`（T1-T3 模块单测）+ `packages/engineering/tests/`（本任务行为/集成测试）是**两层**，不重复 —— runner/contract/exec/select/templates/registry 的行为断言已在 T1-T3 模块测试覆盖，**本任务不重写**；ci-validate.mjs 5b **两棵树都跑**。

- [ ] **Step 1: `helpers.mjs` + `common-functions.test.mjs`** —— port `test-lib.sh`（`harness_free_path` + `setup_repo` fixture）+ `cdd-common-functions.test.sh` 剩余函数家族。
- [ ] **Step 2: ci-validate.mjs 的 5b 步骤接 node:test 两棵树**（`packages/engineering/tests/` + `packages/engineering/bin/engine/tests/`）。
- [ ] **Step 3: 删 9 个 `.sh` + `test-lib.sh` + validate**

```bash
rm packages/engineering/tests/*.sh
node --test packages/engineering/tests/ packages/engineering/bin/engine/tests/
pnpm run validate
```

Expected: 全部 node:test PASS；validate ALL PASS（旧 shell 测试删除后 ci-validate.mjs 5b 跑 node:test 两棵树）。

- [ ] **Step 4: 提交**

```bash
git add -A packages/engineering/tests
git commit -m "test: migrate remaining shell tests to node:test"
```

---

### Task 6: rule-reference.py + release 辅助 + overrides 测试迁 Node

**Files:**
- Create: `packages/engineering/tests/rule-reference.test.mjs`（port `rule-reference.test.py`）
- Create: `scripts/cleanup-legacy-release-tags.mjs`、`scripts/gh-branch-rulesets.mjs`（port 两个 `.sh`）
- Create: `packages/superpowers-overrides/tests/validate-overrides-build.mjs`、`manifest-harness.test.mjs`（port `.sh` + `.py`）
- Delete: `rule-reference.test.py`、`cleanup-legacy-release-tags.sh`、`gh-branch-rulesets.sh`、`validate-overrides-build.sh`、`manifest-harness.test.py`

**Interfaces:**
- Consumes: T4（ci-validate.mjs 步骤引用这些）
- Produces: 剩余 bash/python 迁 Node（T7 零残留的前提）

- [ ] **Step 1: `rule-reference.test.mjs`** —— port `rule-reference.test.py`（语义规则名解析：`### Rule: <Semantic Name>` + `#rule-<kebab>` 链接验证，13 skills）。**ci-validate.mjs 5b 的 rule-reference 调用点更新为 `.mjs`**。
- [ ] **Step 2: `cleanup-legacy-release-tags.mjs` / `gh-branch-rulesets.mjs`** —— port（`execFileSync` gh/git，同逻辑；`gh-branch-rulesets.mjs` 继续读 `gh-branch-rulesets/{main,develop}.json` 数据）。这两个脚本不在任何 package.json scripts 里（仅 CLAUDE.md 引用）→ **不加 scripts 条目，只 port + CLAUDE.md 更新（T7）**。
- [ ] **Step 3: `validate-overrides-build.mjs`** —— port `validate-overrides-build.sh`（内嵌 ~10 个 python3 子检查全迁 Node：manifest schema / canonical target names / hooks matchers / hooks-cursor.json / os-init lockstep / self-check version stamps / dogfood stamps）+ `manifest-harness.test.mjs`（port `manifest-harness.test.py`）。ci-validate.mjs step 5 引用 + **rule-reference 在 overrides 侧的调用点**都更新为 `.mjs`。
- [ ] **Step 4: 删 `.py` + `.sh` + validate**

```bash
rm packages/engineering/tests/rule-reference.test.py scripts/cleanup-legacy-release-tags.sh scripts/gh-branch-rulesets.sh packages/superpowers-overrides/tests/validate-overrides-build.sh packages/superpowers-overrides/tests/manifest-harness.test.py
pnpm run validate
```

Expected: ALL PASS（全部迁移后 validate 仍绿）。

- [ ] **Step 5: 提交**

```bash
git add -A scripts packages/engineering packages/superpowers-overrides/tests
git commit -m "refactor: port rule-reference/release helpers/overrides tests to Node"
```

---

### Task 7: 收尾（零残留 + 自举 smoke + 切默认）

**Files:**
- Delete: `packages/engineering/bin/engine/lib/cdd-common.sh`、`bin/engine/cdd-run.sh` / `cdd-exec.sh` / `cdd-select.sh` / `cdd-session-activate.sh`
- Modify: `CLAUDE.md` / docs（`.sh` → `.mjs` 引用清零，含对 `ci-validate.sh`/`validate-overrides-build.sh`/`gh-branch-rulesets.sh`/`cleanup-legacy-release-tags.sh` 的引用）

**Interfaces:**
- Consumes: T1-T6
- Produces: 可执行面单语言 Node + 自举验证 —— P5 验收

- [ ] **Step 1: 自举 smoke（切默认前）**—— 用 Node 引擎跑一个 implement/review dry-run 任务（**`CDD_DRY_RUN=1` env，非 `--dry-run` flag**），H1 四行 + handoff 字段与 bash 引擎输出**逐字段一致**（bash 仍存在，并行对照）。

```bash
CDD_DRY_RUN=1 node packages/engineering/bin/engine/cdd-run.mjs --harness claude --task 1 --mode implement --plan docs/superpowers/plans/2026-08-10-os-engineering-p5.md
# 对照 bash（同 env + args）:
CDD_DRY_RUN=1 ./packages/engineering/bin/engine/cdd-run.sh --harness claude --task 1 --mode implement --plan docs/superpowers/plans/2026-08-10-os-engineering-p5.md
```

Expected: 两者 H1 四行 + handoff 字段一致。

- [ ] **Step 2: 翻转 ci-validate.mjs 5b2 的 `.sh` 检查 → `.mjs` + 删 bash + 全仓引用清零**

删 bash 前，先把 `ci-validate.mjs` 5b2 里 port 的 `[ -x ...cdd-session-activate.sh ]`（及任何内部 `.sh` 引用）改为对应 `.mjs`，否则删完 validate 红。

```bash
rm packages/engineering/bin/engine/cdd-run.sh packages/engineering/bin/engine/cdd-exec.sh packages/engineering/bin/engine/cdd-select.sh packages/engineering/bin/engine/cdd-session-activate.sh packages/engineering/bin/engine/lib/cdd-common.sh scripts/ci-validate.sh
# grep 验证无 .sh/.py 引用（含 CLAUDE.md / docs / workflows / package.json）
if grep -rnE '\.sh\b|\.py\b' scripts packages/engineering packages/superpowers-overrides .github docs CLAUDE.md README.md README.zh-CN.md 2>/dev/null | grep -vE '\.sh:.*[#//]' | grep -vE 'vendors/|CHANGELOG|\.md:' ; then echo "RESIDUE"; exit 1; fi
```

- [ ] **Step 3: 终验**

```bash
pnpm run validate && node --test packages/engineering/bin/engine/tests packages/engineering/tests packages/superpowers-overrides/tests
```

Expected: ALL PASS；可执行面无 `.sh`/`.py`。

- [ ] **Step 4: 提交**

```bash
git add -A
git commit -m "chore: remove bash engine — executable surface is single-language Node (P5 complete)"
```

> 对照 spec §2.7 验收逐条勾验：契约等价（回归 + 自举 smoke）/ 无 .sh/.py / ci-validate 全绿 / 零残留。
