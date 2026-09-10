# P5 Gate 移除 + harness 层全面清理 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 删除 cdd-gate 子系统 + 整个 harness 选择/探测/安装层 + `--harness` 参数 + 收敛 channel 到 claude/cursor-agent，实现"宿主即目标"统一抽象，不留技术债务。

**Architecture:** 三层删除（gate 子系统 / harness 基础设施 / 未验证 channel）+ 保留 `detectCurrentHarness` 为唯一 host 事实源（D5/D6）+ registry 两键 manifest + gate 语汇 residue guard（D2）。命令面 `--doc`→`--spec`/`--plan` 统一（D11）。测试用现有 host-marker env 注入判定 host（D12，无新变量）。

**Tech Stack:** Node ESM（`packages/cdd-engine/bin/`）+ osuperpowers skills/emit/validate + vitest/node:test + tinyglobby。

**Spec:** [2026-09-09-cdd-engine-overhaul-p5-design.md](docs/superpowers/specs/2026-09-09-cdd-engine-overhaul-p5-design.md)（v1.2，P5 执行期 D14 追加）

## Global Constraints

- **决策编号 D1–D14** 是权威引用（spec §2.3），task 内引用须一致，禁止错标（D11=命令面统一，D12=测试迁移，D13=vendored gemini 清净，D14=progress 所有权 engine）。
- **D13**：vendored 发布面 gemini 装配清净 —— `vendor-assembly.mjs` 去 mattpocock gemini 分支 + `thinGeminiExtension`/`geminiMarkdown` 整删；superpowers 自带 gemini 产物保留（submodule 不可改）。
- **D14（P5 执行期追加）**：progress.json 所有权收归 engine —— engineRecoveryCount 由 runner 写入（当前零 engine 写入点）；cli-driven-development §engine-recovery/§timeout-decision 去「orchestrator 递增 progress.json」指令；orchestrator 只读不写。证据：orchestrator 手写 tasks 对象 → `progressData.tasks.find is not a function` dispatch 失败（[#232 comment 5612106797](https://github.com/Oscaner/skills/issues/232#issuecomment-5612106797)）。
- **原子提交**：每个 task 的"删文件 + 改产生者 + 清引用/测试"必须在同一 commit —— 删除类变更拆分会导致中间态 validate 红。
- **保留机制不动**（spec §2.5）：`detectCurrentHarness`（扩展空→BLOCK）、registry 两键、`validateCommitContract`/模板 `HARD GATE`/URC Review Stopping、runner runTask 链。
- **residue guard 豁免**：`validateCommitContract` / `HARD GATE` / `cdd-commit-gate-smoke` fixtures 不在 gate 语汇注册表（这些 "gate" 与 cdd-gate 同名不同物）。
- **vendored submodule 不可改**：superpowers/mattpocock/impeccable 自带 per-harness manifests 保留。
- **host-marker 优先级**：CURSOR_TRACE_ID > CLAUDE_CODE_SESSION_ID > AI_AGENT=claude-code*；测试/smoke 注入现有 marker，**不新增** `CDD_HOST_HARNESS`。
- 每个 task 完成前跑 `pnpm run validate` 绿；source/skill/emit 变更须 `pnpm run emit`（.agents 派生）；无 attribution trailer；commit 以 conventional commits。
- `--spec` 语义约束：type=spec 时 = 被审目标（spec 文档），type=plan 时 = 上游 spec 参照（仅注入 `**Spec:**` 头行）。

---

## Phase-0: Baseline 验证

- [ ] **Step 1**: 确认当前 branch = `cdd-engine-overhaul-p5`，HEAD = `a00f7be`（spec commit）
- [ ] **Step 2**: `pnpm run validate` 全绿（baseline before any deletion）
- [ ] **Step 3**: 锁删除面基线：`git ls-files packages/osuperpowers/bin/gate packages/osuperpowers/hooks | wc -l` 记录初值

---

### Task 1: Gate 子系统整体删除（osuperpowers + emit + validate + 产物）

<thinking>原子范围：gate 目录物理删除 + hooks 文件删除 + fixtures 删除 + emit 产生者改造（manifests/osuperpowers/compare）+ emit.test 断言清理 + validate gate-hooks block + ci-validate 断言 + package.json 字段 + 现存 per-harness 产物删除。全部在一个 commit，保证删后 emit/validate 绿。</thinking>

**Files:**
- Delete: `packages/osuperpowers/bin/gate/`（41 文件：cdd-gate-core.mjs + cdd-gate-decide.mjs + adapters/{11 个 + lib.mjs + pi.ts} + configs/ + tests/{63} + README.md）
- Delete: `packages/osuperpowers/hooks/hooks.json` + `hooks/hooks-cursor.json`
- Delete: `packages/osuperpowers/tests/fixtures/cdd-gate/`
- Delete: `scripts/validate/gate-hooks.mjs`
- Delete: `.github/actions/install-harness/`（review blocker F1 —— composite action 硬编码执行 install-harness.mjs）
- Delete: `packages/osuperpowers/.codex-plugin/` `.qoder-plugin/` `.kimi-plugin/` `gemini-extension.json` `GEMINI.md`（现存在产物）
- Modify: `.github/workflows/pr-validate.yml`（第 18 行删 `uses: ./.github/actions/install-harness` step）
- Modify: `scripts/emit/manifests.mjs`
  - **整删** `kimiPluginManifest`（L140 起，无其他消费者）+ `geminiExtension`（L163 起，osuperpowers 专用带 gate hooks）+ **`thinGeminiExtension`（L195）+ `geminiMarkdown`（L205）—— 二者随 vendored gemini 装配清净（D13）成为无消费者死代码，一并整删**
  - 删 gate hook 生成：`cddGatePreToolUseHooks` / `osuperpowersClaudeHooks` / `osuperpowersCursorHooks` / `codexHooksJson` / `qoderHooksJson` / `hooksFor`（codex/qoder hooks 共享底层 helper）/ `osuperpowersHooksFor` / `assertAdapterPathsExist`
  - qoderPluginManifest/codexPluginManifest 去掉 hooks 字段
  - **cursorPluginManifest L89 `m.hooks = plugin.hooks?.cursor ?? './hooks/hooks-cursor.json'` 回退删**（hooks 映射删除后不再回退指向已删文件）
- Modify: `scripts/release/vendor-assembly.mjs`（**D13**：删 `thinGeminiExtension`/`geminiMarkdown` import + `assertNoUpstreamGeminiExtension` 函数 + `stageVendor` 内 mattpocock gemini 补写块；superpowers 自带 gemini 产物原样保留）
- Modify: `scripts/emit/osuperpowers.mjs`（删 hooks write loop + assertAdapterPathsExist 调用 + codex/qoder/kimi/gemini/GEMINI writeJsonDoc 调用；**import 相应收敛**）
- Modify: `scripts/emit/compare.mjs`（BASE_PRODUCT_ROOTS 删 `.codex-plugin`/`.kimi-plugin`/`.qoder-plugin`/`hooks`；productFiles 删 gemini-extension.json + GEMINI.md）
- Modify: `scripts/emit/emit.test.mjs`（删 gate hooks 断言 ~15 处 + **`cursorPluginManifest` L129「hooks 从 cursor 映射解析」用例改「无 hooks 字段」**（W③）+ **`kimiPluginManifest` L241 / `geminiExtension` L253 / `geminiMarkdown` L278 + GEMINI.md 产物 L646 用例删除**（W⑤ + D13））
- Modify: `scripts/release/publish-vendor.test.mjs`（**D13**：thinGeminiExtension 用例 L545/L557 + stageVendor gemini 产物用例 L564/L585 删；其余 stageVendor 断言保留）
- Modify: `scripts/validate/index.mjs`（删 `import { steps as gateHooksSteps }` + 展开；**同步 L4-5 头注释 "13 per-block step descriptors" → 12**）
- Modify: `scripts/run.mjs`（L10 "13-block validate suite" + L48 "(13 blocks)" → 12 —— gate-hooks.mjs = 1 block，移除后 13→12）
- Modify: `CLAUDE.md`（L42 "(13 validation blocks: emit freshness, plugin.json resolution, skill dirs, hooks, rule-reference integrity, engine tests, version sync)" → 12 blocks、删 "hooks," 项；L50 "hooks/ — PreToolUse gate hooks" 行删；**L7/L40 emit-trigger 行的 `hooks/` 引用删**（"After editing ANY file under `skills/*/SKILL.md`, `skills/*/docs/*.md`, `hooks/`, or `package.json`…"））
- Modify: `scripts/validate/engine.mjs`（如有 gate 相关 block 引用）—— 核对实际引用
- Modify: `packages/osuperpowers/tests/ci-validate.test.mjs`（删 5b2 step 断言 + gate suite glob 断言 + `cdd-commit-gate-smoke.sh` fixtures 列表项——注意该 fixtures 是 commit-contract 语义，确认保留后仅删 gate 相关）
- Modify: `packages/osuperpowers/package.json`（删 `main`、`pi.extensions`、`oscaner-plugin.hooks` 映射、`harnesses` 列表收敛、描述 "cross-harness gate" 措辞 → "Standalone osuperpowers skills: orchestration + cli-* family + CDD engine"）
- Modify: `docs/maintainers/osuperpowers-plugin.md`（hooks 矩阵 claude/cursor 行 + gate verify 片段 + H6 gate details 引用）

**Interfaces:**
- Consumes: spec §2.4 ① gate 子系统清单
- Produces: `packages/osuperpowers` 无 gate 引用；emit 不再生成 gate hooks / 被删 harness 产物

- [ ] **Step 1: 写 failing async**（gate 引用业务断言）
  Add `packages/osuperpowers/tests/no-gate.test.mjs`（同目录 ci-validate.test.mjs:10 相为 `../../..` 三层到 repo root，勿四层）:
  ```js
  import { test } from "node:test";
  import assert from "node:assert/strict";
  import { existsSync } from "node:fs";
  import path from "node:path";
  import { fileURLToPath } from "node:url";
  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.resolve(HERE, "..", "..", "..");  // 3 层 → repo root（勿 4 层，会越到 repo 父目录）
  // T1 async：删 gate 后此测试绿；两点断言防只删一半假绿
  test("bin/gate 目录 + hooks.json 均不存在", () => {
    assert.ok(!existsSync(path.join(ROOT, "packages/osuperpowers/bin/gate")));
    assert.ok(!existsSync(path.join(ROOT, "packages/osuperpowers/hooks/hooks.json")));
  });
  ```
- [ ] **Step 2: 运行验证 fail**
  Run: `node --test packages/osuperpowers/tests/no-gate.test.mjs`
  Expected: FAIL（目录仍存在）——确认断言接线
- [ ] **Step 3: 删 gate 目录 + hooks + fixtures + CI action**
  Run: `rm -rf packages/osuperpowers/bin/gate packages/osuperpowers/hooks packages/osuperpowers/tests/fixtures/cdd-gate scripts/validate/gate-hooks.mjs .github/actions/install-harness`
- [ ] **Step 4: 改 emit（manifests.mjs + osuperpowers.mjs + compare.mjs）+ pr-validate.yml**
  - 删 manifests.mjs 中 gate hook 函数；codexPluginManifest/qoderPluginManifest 去掉 hooks 字段；geminiExtension 去掉 hooks.BeforeTool 块（保留 skills/document 结构或整体删若只剩 gate）
  - osuperpowers.mjs 删 hooks write loop 与对应 writeJsonDoc 调用
  - compare.mjs BASE_PRODUCT_ROOTS/productFiles 裁减
  - pr-validate.yml 删 install-harness step（`git grep 'install-harness' .github` 清零）
- [ ] **Step 5: 清 emit.test 断言 + package.json 字段**
- [ ] **Step 6: 删 index.mjs gateHooksSteps 接线 + ci-validate.test 断言**
- [ ] **Step 7: `pnpm run emit` 再生产物** → `.codex/.qoder/.kimi/gemini/GEMINI.md` 不再生成（git status 确认删除生效），`.claude-plugin/plugin.json` / `.cursor-plugin/plugin.json` 保留且无 hooks 字段
- [ ] **Step 8: `pnpm run validate` 绿 + 手动 rm 后第 2 步测试**
- [ ] **Step 9: Commit**
  ```bash
  git add -A
  git commit -m "refactor(osuperpowers): remove cdd-gate subsystem (core + adapters + hooks + emit/validate wiring + per-harness products)"
  ```

---

### Task 2: Harness 选择/探测/安装层删除 + registry 收敛

<thinking>原子范围：cdd select 子命令 + cli-select skill + harness-detect×2 + skills-probe×2 + install-harness/init + 相关 tests / cdd.mjs select wiring / runner DEFAULT_CHANNEL_MAP/probeSkills / harness-detect import + registry 7→2 键 + cli-shared CDD_GATE env。cdd select 删除同时清 cdd.test/select.test 里 select 用例（否则 validate 红）。</thinking>

**Files:**
- Delete: `packages/osuperpowers/skills/cli-select/SKILL.md`（skill 目录）
- Delete: `packages/osuperpowers/bin/utils/harness-detect.mjs` + `bin/utils/skills-probe.mjs` + `bin/utils/skills-probe.config.mjs` + `bin/utils/tests/{harness-detect.test.mjs, skills-probe.test.mjs}`
- Delete: `packages/cdd-engine/bin/utils/harness-detect.mjs` + `bin/utils/skills-probe.mjs` + `bin/utils/skills-probe.config.mjs`
- Delete: `packages/cdd-engine/bin/tests/select.test.mjs` + `bin/tests/skills-gate.test.mjs`
- Delete: `packages/osuperpowers/bin/init/`（install-harness.mjs + tests）
- Modify: `packages/cdd-engine/bin/cdd.mjs`（删 `select` 子命令 + runSelect + detectInstalledHarnesses import + usage `cdd select` 行）
- Modify: `packages/cdd-engine/bin/lib/runner.mjs`（删 DEFAULT_CHANNEL_MAP + probeSkills DI 参数 + step 2.5 块或保留 seam 但无 config？——核对后删）
- Modify: `packages/cdd-engine/bin/tests/runner.test.mjs`（**N④**：~33 处 `probeSkills: NOOP_PROBE,` 传参 + L25-26 NOOP_PROBE 定义删除；保留 ship-gate 两键相关断言 —— no-such-harness/codex → exit 1 用例本就兼容两键 registry）
- Modify: `packages/cdd-engine/bin/lib/cli-shared.mjs`（删 CDD_GATE_WORKSPACE / CDD_GATE_MODE env 注入块 84-104 + 注释；同步删 `docs-runner.mjs` L55-56 指向该注入的陈旧注释）
- Modify: `packages/cdd-engine/bin/tests/cli-shared.test.mjs`（删 describe "invokeCli gate env propagation (Bug O Step 5b)" 整块 3 用例 —— 断言被删行为，T2 删注入后必 FAIL；可选在 T3 fixture 保留 `CDD_SESSION_MODE` 剥离语义断言）
- Modify: `packages/cdd-engine/bin/harness-registry.json`（7 键 → claude/cursor-agent 两键）
- Modify: `packages/cdd-engine/bin/lib/registry.mjs`（registryField resolveInjection 不动；`cliInPath` 保留）
- Modify: `packages/cdd-engine/bin/tests/cdd.test.mjs`（删 select 相关用例 + 引用）
- Modify: `packages/osuperpowers/skills/init/SKILL.md` + `init/harness.md`（收缩 marketplace 指引，删 detect-harness/config/trust 节点）
- Modify: `packages/cdd-engine/bin/tests/registry.test.mjs`（droid/pi/codex/copilot/gemini 断言 → 两键 + not-supported 用例删除或改）
- Modify: `scripts/validate/osuperpowers.mjs`（**B2**：cli-select 删除后 skills-count EXPECTED 8→7 + EMITTERS_LABEL 同步；5b node:test step 裁 gate/init-suite glob 种子与 step 名）
- Modify: `packages/osuperpowers/tests/ci-validate.test.mjs`（node:test 步骤 gate/init-suite glob 断言同步）
- Modify: `scripts/validate/smoke-cdd.mjs`（select 不涉及，仅确认）
- Modify: `packages/osuperpowers/skills/cli-driven-development/SKILL.md`（detect-engine 下 select-harness 节点调用点 —— 见 **Task 5** 整体处理，此 task 只删 cli-select skill 文件本身）

**Interfaces:**
- Consumes: spec §2.4 ② harness 选择/探测/安装层清单
- Produces: `cdd select` 命令消失；无 skills-probe/harness-detect/install-harness

- [ ] **Step 1: 写 failing async**（registry 两键断言，仅新用例）
  Modify `packages/cdd-engine/bin/tests/registry.test.mjs`（vitest 文件，沿用 `it`/`expect` + 既有 `loadRegistry` import）:
  ```js
  it("registry 收敛两键 claude/cursor-agent", () => {
    const reg = loadRegistry(REG_PATH);   // REG_PATH 沿用文件内既有常量
    expect(Object.keys(reg).sort()).toEqual(["claude", "cursor-agent"]);
  });
  ```
  Expected: FAIL（当前 7 键）
- [ ] **Step 2: 删 harness 层文件**
  Run: `rm -rf packages/osuperpowers/skills/cli-select packages/osuperpowers/bin/utils/harness-detect.mjs packages/osuperpowers/bin/utils/skills-probe.mjs packages/osuperpowers/bin/utils/skills-probe.config.mjs packages/osuperpowers/bin/utils/tests/harness-detect.test.mjs packages/osuperpowers/bin/utils/tests/skills-probe.test.mjs packages/cdd-engine/bin/utils/harness-detect.mjs packages/cdd-engine/bin/utils/skills-probe.mjs packages/cdd-engine/bin/utils/skills-probe.config.mjs packages/cdd-engine/bin/tests/select.test.mjs packages/cdd-engine/bin/tests/skills-gate.test.mjs packages/osuperpowers/bin/init`
- [ ] **Step 3: 改 cdd.mjs** 删 select 子命令/runSelect/import + usage
- [ ] **Step 4: 改 runner.mjs** 删 DEFAULT_CHANNEL_MAP/probeSkills；**cli-shared.mjs** 删 CDD_GATE env 注入 + **docs-runner.mjs** 陈旧注释；**cli-shared.test.mjs** 删 gate-env 3 用例
- [ ] **Step 5: registry.json 收敛两键** + registry.test 存量断言更新 + cdd.test select 用例删
- [ ] **Step 6: init skill 收缩 marketplace 指引**（SKILL.md 单节点 + harness.md 删除或并入）
- [ ] **Step 7: `scripts/validate/osuperpowers.mjs` skills-count 8→7 + node:test glob 裁减**（+ ci-validate.test 同步）
- [ ] **Step 8: `pnpm run emit`**（.agents 派生更新：cli-select 消失 + init 新形态）
- [ ] **Step 9: `pnpm run validate` 绿**
- [ ] **Step 10: Commit**
  ```bash
  git add -A
  git commit -m "refactor(cdd-engine): remove harness selection/detection/install layers + converge registry to claude/cursor-agent"
  ```

---

### Task 3: `--harness` 参数删除 + host 检测接线（engine）

<thinking>原子范围：cdd.mjs 4 个子命令删 --harness requiredOption/usage + runReview/runFix/runResearch/implement 的 harness 参数 → detectCurrentHarness 内部判定 + D6 空→BLOCK + cli-shared/registry 链核对。此 task 同时迁移所有 engine 测试与 smoke 的 --harness 调用点（否则 validate 红）→ 与 D12 一起落地。registry 由 host 查找（claude/cursor-agent 两键）。</thinking>

**Files:**
- Modify: `packages/cdd-engine/bin/cdd.mjs`
  - 4 子命令（implement/review/fix/research）删 `requiredOption("--harness")` + usage 字符串 + `opts.harness` 传递
  - `runReview`/`runFix`/`runResearch`/implement action：`const harness = detectCurrentHarness(process.env); if (!harness) { stderr CDD_BLOCKED "no host harness detected (run cdd from within a supported harness)"; exit 1; }`
  - `detectCurrentHarness` 保留（marker 优先级不变），可能 export
- Modify: `packages/cdd-engine/bin/lib/runner.mjs` —— `runTask(harness, taskNum, opts)` 签名：cdd.mjs 传解析后的 host harness（签名不动，cdd.mjs 负责解析）；删除 `(opts.harness, ...)` 相关无需改
- Modify: `packages/cdd-engine/bin/lib/docs-runner.mjs` —— 核对 `checkHarness(reg, harness)` 的 harness 来源（cdd.mjs runReview/runFix 传入 host）
- Modify: `packages/cdd-engine/bin/tests/cdd.test.mjs` / `cdd-research.test.mjs` / `task.test.mjs` / `docs-task.test.mjs` / `branch-review.test.mjs`（~50 处 `--harness` 调用点 → 移除参数，spawn env 注入 `CLAUDE_CODE_SESSION_ID=1` 使 host 判定 claude；`--harness nonexistent` 停闸用例 → 改 env-无-host 断言 BLOCK）
- Modify: `scripts/validate/smoke-cdd.mjs`（四命令链删 `--harness claude`，spawn env 注入 `CLAUDE_CODE_SESSION_ID=1`）
- Modify: `packages/cdd-engine/bin/tests/registry.test.mjs`（核对 ship-gate 调用形态 —— checkHarness 仍按 host 键）
- Modify: `packages/cdd-engine/bin/lib/cli-shared.mjs`（核对注释；spawn env 已无 CDD_GATE）—— Task 2 已删 env 块，此处确认无残留

**Interfaces:**
- Consumes: Task 2（registry 两键 + cdd select 已删）
- Produces: `cdd implement/review/fix/research` 无 `--harness`；host 空 → exit 1；engine 测试/smoke 无残留 `--harness`

- [ ] **Step 1: 写 failing async**（host 空 → BLOCK）
  Add `packages/cdd-engine/bin/tests/host-detection.test.mjs`（vitest；`runCli` helper 与 cdd.test.mjs 同构，**但 no-host 用例的 env 不能照抄仅剥 CDD_* 的 cleanEnv —— 须显式 delete host 三 marker**）:
  ```js
  import { it, expect } from 'vitest';
  const PLAN_FIXTURE = path.join(REPO_ROOT, "packages/cdd-engine/bin/tests/fixtures/smoke-plan.md");
  // runCli(args, { env }): spawnSync(CDD_MJS, 剥离 CDD_* env, 注入 env)；返回 { exitCode, stderr } —— 与 cdd.test.mjs 同构
  const NO_HOST_ENV = () => {
    const e = { PATH: process.env.PATH };
    // B1 blocker：父进程可能自带 CLAUDE_CODE_SESSION_ID / AI_AGENT（本机实测两者均已设）
    // → 必须显式删三 marker，仅剥 CDD_* 的 cleanEnv 会泄漏 host 检测
    delete e.CLAUDE_CODE_SESSION_ID; delete e.CURSOR_TRACE_ID; delete e.AI_AGENT;
    return e;
  };
  it("无 host env → cdd implement BLOCK exit 1 + CDD_BLOCKED", () => {
    const r = runCli(["implement", "--task", "1", "--plan", PLAN_FIXTURE], { env: NO_HOST_ENV() });
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toMatch(/no host harness|CDD_BLOCKED/);
  });
  it("CLAUDE_CODE_SESSION_ID=1 → host 判定成功（dry-run exit 0）", () => {
    const r = runCli(["implement", "--task", "1", "--plan", PLAN_FIXTURE],
      { env: { CLAUDE_CODE_SESSION_ID: "1", CDD_DRY_RUN: "1" } });
    expect(r.exitCode).toBe(0);
  });
  ```
  Expected: FAIL（当前需 --harness）
- [ ] **Step 2: 改 cdd.mjs** 四子命令 harness 删除 + host 解析 + 空 BLOCK
- [ ] **Step 3: 迁移引擎测试 ~50 处**（全量 grep `--harness` IN 修改）
  - 普通用例：删 `--harness claude`，spawn env 注入 `CLAUDE_CODE_SESSION_ID=1`
  - **cdd-research.test.mjs mock-harness E2E（L102/L136/L208 三组）**：`--harness mock-test-harness` + `CDD_REGISTRY_PATH` 临时 registry 键 → **re-key 为 claude**，`cli` 指向 mock 脚本（保留 CDD_REGISTRY_PATH 注入临时 CLI 机制；host 检测由 env `CLAUDE_CODE_SESSION_ID=1` 满足 → registry[claude].cli = mock）；`--harness nonexistent-harness-xyz`（L54 未知 harness BLOCK 用例）→ 删该用例，改 host 空 → BLOCK 断言已由 host-detection.test 覆盖
  - 停闸用例（`--harness nonexistent` 停 harness gate）→ 改 env-无-host 断言 BLOCK
- [ ] **Step 4: smoke-cdd.mjs** 四命令链改 host env 注入
- [ ] **Step 5: 新增 host-detection.test 通过**
- [ ] **Step 6: `grep -rn '--harness' packages/cdd-engine scripts/validate` 为空**
- [ ] **Step 7: `pnpm run validate` 绿**
- [ ] **Step 8: Commit**
  ```bash
  git add -A
  git commit -m "feat(cdd-engine): remove --harness param — engine resolves host harness internally (empty → BLOCK)"
  ```

---

### Task 4: review/fix 命令面 `--doc` → `--spec`/`--plan` 统一（D11）

<thinking>原子范围：cdd.mjs review/fix 命令 option 改 + runReview/runFix 分支归一 + workspace slug 派生改 + 引擎测试 --doc 调用点改 + _docs/review.md 命令引用 + brainstorming/writing-plans skills 调用形态 + cdd-reference + report-issue 措辞。D11 决策：--doc 退役；type=spec→--spec 被审，type=plan→--plan 被审 + --spec 上游参照，type=task/branch→--plan。</thinking>

**Files:**
- Modify: `packages/cdd-engine/bin/cdd.mjs`
  - review：`.option("--doc <path>", ...)` → 按 type 变体（`--spec <path>` 与 `--plan <path>` 皆有；type=spec 要求 --spec，type=plan 要求 --plan，type=task/branch 要求 --plan）
  - runReview：`opts.doc` 来源替换 —— type=spec → `opts.spec`；type=plan → `opts.plan`（被审）+ `opts.spec`（参照）；task/branch → `opts.plan`
  - fix：同 review 逻辑（type=spec → --spec；type=plan → --plan）
  - usage 字符串更新
- Modify: `packages/cdd-engine/bin/tests/docs-task.test.mjs` / `task.test.mjs` / `branch-review.test.mjs` / `cdd.test.mjs`（`--doc` → `--spec`/`--plan` 按 type 调换）
- Modify: `packages/osuperpowers/skills/_docs/review.md`（SSoT 5 处命令引用：run-review Do/Read → `--spec`/`--plan` 形态；cli-fix-all-findings Do → 对应 find/type；Handoff Output）
- Modify: `packages/osuperpowers/skills/brainstorming/SKILL.md`（spec-review 节点 → `cdd review --type spec --spec <path>`；cli-fix-all-findings → `cdd fix --type spec --spec <path>`）
- Modify: `packages/osuperpowers/skills/writing-plans/SKILL.md`（plan-review → `cdd review --type plan --plan <path> --spec <spec>`；fix → `cdd fix --type plan --plan <path>`）
- Modify: `packages/osuperpowers/skills/cli-driven-development/SKILL.md`（dispatch-mode 的 review/branch-review/fix 命令形态 → 去 --harness + --doc→--plan）
- Modify: `packages/osuperpowers/skills/cli-driven-development/docs/cdd-reference.md`（命令引用 + **全文件 gate/select 语汇归零**：gate matrix 整节 L119-148（`bin/gate/cdd-gate-core.mjs`/`gateDecide`/`CDD_GATE_FIXTURES_ROOT`/`tests/fixtures/cdd-gate/`）+ skills-probe 节 L75 + **L96 `pluginRoot()` via `bin/gate/cdd-gate-core.mjs` / `[cli-select]` 引用** → pluginRoot 语义改为「cdd-engine 内 `lib/templates.mjs` 的 pluginRoot 常量（P6 迁入，engine 自包含）」并去 cli-select link + select-harness 命令形态 → 命令改 --spec/--plan）
- Modify: `packages/osuperpowers/skills/report-issue/SKILL.md`（"same discovery as the gate hook" 措辞去 gate 引用 → 仅 pluginRoot 发现语义）
- Modify: `packages/osuperpowers/skills/cli-driven-development/docs/controller-handoff.md`（harness/select 引用清理）
- Delete: `docs/gate-install.md`（整份 CDD gate 用户手册 —— 六删除面均未含，T7 grep 范围扩展 `docs/`）
- Modify: `README.md`（根 repo：gate 11 adapters 行 L25 措辞、per-harness install 表 L68、L94-95 gate-install 链接 → 移除；gate 语汇归零）
- Modify: `docs/maintainers/osuperpowers-plugin.md`（T1 已删 hooks 矩阵/H6 gate；此处 L191-193 `--harness`/`--doc` 命令形态 → `--spec`/`--plan`，T3/T4 后同步）+ Task 5 合并收口

**Interfaces:**
- Consumes: Task 3（无 --harness）+ spec D11
- Produces: review/fix 无 `--doc`；被审目标 type 自解释（`--spec`/`--plan`）

- [ ] **Step 1: 写 failing async**（工作树断言 —— 现 cdd.mjs 同时接受 `--doc` 与 `--spec`，CLI 级运行法旧形态会被静默接受并触发真实 dispatch，改用静态断言避免副作用）
  Add `packages/cdd-engine/bin/tests/cli-shape.test.mjs`（vitest；`runCli` 返回 `{ exitCode, stdout, stderr }`，与 cdd.test.mjs 同构，**env 注入 `CLAUDE_CODE_SESSION_ID: "1"` 判 host 否则 BLOCK**）:
  ```js
  import { it, expect } from 'vitest';
  import { readFileSync } from 'node:fs';
  import path from 'node:path';
  // runCli: spawnSync(CDD_MJS, ...) → { exitCode, stdout, stderr }（同 cdd.test.mjs）
  const HOST_ENV = { CLAUDE_CODE_SESSION_ID: "1" };  // cursor-agent 分支用 { CURSOR_TRACE_ID: "1" }
  // fixtures 目录仅有 smoke-plan.md，无 spec fixture → SMOKE_SPEC 用本 repo 现有 spec 文档路径
  const SMOKE_SPEC = path.join(REPO_ROOT, "docs/superpowers/specs/2026-09-09-cdd-engine-overhaul-p5-design.md");
  const SMOKE_PLAN = path.join(REPO_ROOT, "packages/cdd-engine/bin/tests/fixtures/smoke-plan.md");
  it("review 无 --doc option（D11 退役）", () => {
    const src = readFileSync(CDD_MJS, "utf8");
    expect(src).not.toMatch(/\.option\("--doc <path>"/);
    expect(src).toMatch(/\.option\("--spec <path>"/);
    expect(src).toMatch(/\.option\("--plan <path>"/);
  });
  // 新形态 smoke（dry-run 防真实 dispatch; SMOKE_SPEC/SMOKE_PLAN 仅作参数存在性, dry-run 不读）:
  it("review --type spec --spec 形态 dry-run 可过（new shape）", () => {
    const r = runCli(["review", "--type", "spec", "--spec", SMOKE_SPEC, "--plan", SMOKE_PLAN],
      { env: { ...HOST_ENV, CDD_DRY_RUN: "1" } });
    expect(r.exitCode).toBe(0);
  });
  ```
  Expected: FAIL（现 cdd.mjs 仍含 `--doc` option）
- [ ] **Step 2: 改 cdd.mjs** review/fix option + 分支
- [ ] **Step 3: 迁移引擎测试** `--doc` → type 对应参数 + 补新旧形态转换 green 用例
- [ ] **Step 4: skills/docs 命令引用全改**（`grep -rn -- '--doc' packages/osuperpowers/skills packages/cdd-engine/bin/tests docs/maintainers` 归零 —— 注意保留合法的 `doc_path`/`{{DOC}}` 内部术语）+ 删 `docs/gate-install.md` + 根 README gate 段
- [ ] **Step 5: `pnpm run emit`**
- [ ] **Step 6: `pnpm run validate` 绿**
- [ ] **Step 7: Commit**
  ```bash
  git add -A
  git commit -m "refactor(cdd-engine): review/fix drop --doc — type-self-describing --spec/--plan target param (D11)"
  ```

---

### Task 5: skill 层 harness 概念出清（cli-driven-development / cli-research / init / docs）

<thinking>原子范围：cli-driven-development 删 select-harness 节点 + I1 invariant + dispatch-mode --harness 文本；cli-research 删 select-harness → 直连 prepare-brief（host 引擎内部判定）；README/maintainers docs 清理；init SKILL.md 已 Task 2 收缩，此处确认 skill 文本层 finish。</thinking>

**Files:**
- Modify: `packages/osuperpowers/skills/cli-driven-development/SKILL.md`
  - digraph A→B(select-harness)→C 改为 A→C（detect-engine → determine-base）
  - 删 `select-harness` 节点定义 + BLOCKED:no-harness 失败行
  - 删 I1 **Explicit Propagation** invariant（--harness 已删）
  - dispatch-mode/fix-inline/branch-review 节点命令文本去 harness
- Modify: `packages/osuperpowers/skills/cli-research/SKILL.md`
  - 删 `select-harness` 节点 → prepare-brief 直连（`cdd research --brief ... --output ...`，无 --harness）
- Modify: `packages/osuperpowers/README.md`（**全文收敛 W④**：gate 段删；L12 harness CLI 列表 claude/cursor-agent/droid/pi → 收敛 claude/cursor-agent；L23 init 行「Project initialization (harness config…)」→ marketplace 指引语义；L25 cli-select 技能表行删）
- Modify: `docs/maintainers/osuperpowers-plugin.md`（T1 已删 hooks 矩阵/H6 gate 引用；此处 **`## CDD CLI pre-check (skills-missing gate)` 整节（L197-215：exit-3 行 + 12-harness channel classification + skills-probe.config 引用 + required-plugins probe + H6 link）删除** —— skills-probe 已随 T2 删除）
- Modify: docs/maintainers/osuperpowers-plugin.md（Task 1 已处理 hooks 矩阵，此处 skill 引用清理核对）
- Modify: `packages/osuperpowers/skills/init/SKILL.md`（verify 纯 marketplace 指引单节点形态 + 描述更新）

**Interfaces:**
- Consumes: Task 2（init 收缩）+ Task 3/4（命令形态）
- Produces: skill 层无 harness/select 概念；cli-driven-development digraph 无 select-harness 边

- [ ] **Step 1: 改 cli-driven-development SKILL.md**（digraph + 节点 + invariants）
- [ ] **Step 2: 改 cli-research SKILL.md**
- [ ] **Step 3: init SKILL.md 终态 + osuperpowers 包 README + maintainers 文档**（根 README 已于 T4 处理；`docs/maintainers/osuperpowers-plugin.md` 在此删 `## CDD CLI pre-check (skills-missing gate)` 整节 L197-215）
- [ ] **Step 4: `grep -rn 'select-harness\|--harness' packages/osuperpowers/skills` 归零**（除历史注释）
- [ ] **Step 5: `pnpm run emit` + `pnpm run validate` 绿**
- [ ] **Step 6: Commit**
  ```bash
  git add -A
  git commit -m "refactor(osuperpowers): strip harness concept from skills (cli-driven-development/cli-research/init docs)"
  ```

---

### Task 6: Gate 语汇 residue guard（并入 residue.mjs，零豁免）

<thinking>原子范围：mirror P6 F5 模式——residue.mjs 新增 gate 专属语汇零豁免检查（bin/gate/ 路径、CDD_GATE env、cdd-gate-core、gateDecide、被删 adapter 文件名），潜在压入 check。豁免 `validateCommitContract`/HARD GATE/commit-gate fixtures（合法语义）。residue.test.mjs 增 positive/negative 用例。</thinking>

**Files:**
- Modify: `scripts/validate/residue.mjs`（新增 `GATE_LEXICON_CHECKS` 或并入现有 check；检查 cdd-engine + osuperpowers 文件树）
- Modify: `scripts/validate/residue.test.mjs`（正例：canonical gate-vocab 命中；反例：`validateCommitContract`/`HARD GATE`/`cdd-commit-gate-smoke` 不误报）
- Modify: `scripts/validate/index.mjs`（若新增独立 block 则接线；否则并入 5c）

**Interfaces:**
- Consumes: spec D2 + §2.7 residue AC
- Produces: gate 语汇回归被机械阻断；validate block 全绿

- [ ] **Step 1: 核对前置清理**（T2 Step 4 已删 docs-runner.mjs L55-56 CDD_GATE 注释，此处仅核对无残留；如仍存在则删）
- [ ] **Step 2: 写 failing test**（residue.test.mjs：构造含 `bin/gate/` 引用的临时文件 → 期望命中）
  Expected: FAIL（guard 未实现）
- [ ] **Step 3: 实现 guard**（target：cdd-engine bin/ + osuperpowers skills/ + docs/maintainers + 根 README；**注册豁免**：`docs/superpowers/`（spec/plan 描述删除面必携 gate 语汇）+ `packages/osuperpowers/CHANGELOG.md`（历史记录，非机制位置）—— 与 T7 grep1 口径一致）
- [ ] **Step 4: 反例确认**（合法 `HARD GATE`/`validateCommitContract` 不命中）
- [ ] **Step 5: `pnpm run validate` 绿**
- [ ] **Step 6: Commit**
  ```bash
  git add -A
  git commit -m "test(cdd-engine): gate-lexicon zero-exemption residue guard (mirror P6 F5)"
  ```

---

### Task 7: 全量验证 + 残留清零确认

<thinking>原子范围：机械化 grep 断言删除面全零 + emit/validate 双绿 + per-harness 产物现状核对。这是计划级终验（非新 review）。</thinking>

**Files:**
- Run: 全量 grep 清零清单
- Modify: `scripts/validate/smoke-cdd.mjs`（最终核对）

- [ ] **Step 1: 残留 grep 全零**（范围含 docs/ + 根 README + docs/maintainers；**注册豁免**：`docs/superpowers/`（本 plan/spec 及历史 spec/plan 描述删除面必然携带 gate 语汇）+ `packages/osuperpowers/CHANGELOG.md`（历史 changelog，非机制位置，保留不改）—— T7 grep/T6 guard 均排除）
  ```
  grep -rn 'bin/gate/\|cdd-gate-core\|gateDecide\|CDD_GATE' packages/cdd-engine packages/osuperpowers scripts docs/maintainers README.md   # 0（豁免 docs/superpowers/ + CHANGELOG.md）
  grep -rn -- '--harness' packages/cdd-engine packages/osuperpowers/skills scripts/validate docs/maintainers  # 0
  grep -rn -- '--doc' packages/osuperpowers/skills packages/cdd-engine/bin/cdd.mjs packages/cdd-engine/bin/tests docs/maintainers  # 0（仅内部 doc_path 保留）
  grep -rn 'cli-select\|select-harness' packages/osuperpowers/skills  # 0
  grep -rn 'skills-missing\|skills-probe' docs/maintainers/osuperpowers-plugin.md packages/osuperpowers/README.md  # 0
  grep -n 'cli-select\|droid\|pi' packages/osuperpowers/README.md  # 0
  test ! -e docs/gate-install.md  # 已删
  test ! -e .github/actions/install-harness  # 已删
  ```
- [ ] **Step 2: per-harness 产物现状**：`.claude-plugin/` + `.cursor-plugin/` 存在（保留 harness）；`.codex-plugin/` `.qoder-plugin/` `.kimi-plugin/` `gemini-extension.json` 不存在
- [ ] **Step 3: `pnpm run emit && pnpm run validate` 绿**
- [ ] **Step 4: `git status` 干净 + 分支 commit 历史完整**
- [ ] **Step 5: Commit 若残留修改**
  ```bash
  git add -A
  git commit -m "chore(cdd-engine): P5 deletion-surface zero-residue sweep"
  ```

---

### Task 8: Changeset + overall/plan 状态同步 + closeout

<thinking>原子范围：.changeset 创建（P5 breaking/gate removal — cdd-engine major + osuperpowers major 语义见 spec changeset 说明）；overall P5 行 Implementation plan → Done、Design spec 保持 P5-design；change-history v1.24 行记录 plan；branch 收尾交 finishing。</thinking>

**Files:**
- Create: `.changeset/p5-cdd-engine-overhaul.md`
- Modify: `docs/superpowers/specs/2026-09-04-cdd-engine-overhaul-overall.md`（P5 行 Implementation plan → Done；change-history +v1.25；version v1.25）
- Modify: `docs/superpowers/specs/2026-09-09-cdd-engine-overhaul-p5-design.md`（Status: Draft → Approved/Plan pending → Plan done 标记，§Section 5 review record）

- [ ] **Step 1: 写 changeset**
  ```markdown
  ---
  "@oscaner-skills/cdd-engine": major
  "@oscaner-skills/osuperpowers": major
  ---
  feat(cdd-engine): P5 — remove cdd-gate + harness selection layer, drop --harness/--doc, converge to host-harness model + progress.json engine-owned
  ```
- [ ] **Step 2: overall v1.25 四表 sync**（P5 plan → Done + change-history）
- [ ] **Step 3: `pnpm run validate` 绿**
- [ ] **Step 4: Commit**
  ```bash
  git add -A
  git commit -m "chore(cdd-engine): P5 changeset + overall v1.25 sync"
  ```
- [ ] **Step 5: `osuperpowers:finishing` takeover**（branch review → merge/PR/keep/discard）

---

### Task 9: progress.json 所有权收归 engine（D14，P5 执行期追加）

<thinking>原子范围：engine 补 engineRecoveryCount 写入点（runner BLOCKED/engine-recovery 自增）+ cli-driven-development §engine-recovery/§timeout-decision 去「orchestrator 递增 progress.json」指令 + 确认 orchestrator 只读不写。根因：[#232 comment 5612106797]（orchestrator 手写 tasks 对象当数组 → tasks.find is not a function dispatch 失败；engineRecoveryCount 零 engine 写入点）。v1.25 已登记。</thinking>

**Files:**
- Modify: `packages/cdd-engine/bin/lib/runner.mjs`（engineRecoveryCount 自增：在 BLOCKED/engine-error 判定路径或 engine-recovery 适配点写入；若无天然落点，随 progress.mjs schema 新导出统一写 —— 交接时务实最小改）
- Modify: `packages/cdd-engine/bin/lib/progress.mjs`（如 runner 落点需新 helper：`incrementRecovery(progressDir)` 配套导出 + 注释）
- Modify: `packages/osuperpowers/skills/cli-driven-development/SKILL.md`（§engine-recovery「increment recovery counter in progress.json」→「engine 自递增，orchestrator 只读 engineRecoveryCount 判 retry」；§timeout-decision 同；dispatch-mode 去任何 progress 写入）
- Modify: `packages/cdd-engine/bin/tests/runner.test.mjs`（如有 engineRecoveryCount 相关断言更新）
- Modify: `packages/cdd-engine/bin/tests/progress.test.mjs` 或新测试（engineRecoveryCount 自增断言，TDD）

**Interfaces:**
- Consumes: spec D14 + [#232 comment 5612106797]
- Produces: progress.json 全字段（tasks/timeoutCount/engineRecoveryCount/status）由 engine 单选；skill 层零 orchestrator 写入指令

- [ ] **Step 1: 写 failing async**（engineRecoveryCount 自增断言）
  Add `packages/cdd-engine/bin/tests/progress-owner.test.mjs`（vitest）:
  ```js
  import { describe, it, expect } from 'vitest';
  import { readProgressJSON } from '../lib/progress.mjs';
  // tmp workspace + fresh progress.json；断言 dispatch BLOCKED 后 engineRecoveryCount 由 engine 自增
  it("engine BLOCKED dispatch 后 engineRecoveryCount 自增（engine 写，orchestrator 只读）", () => {
    // 前置：prog.engineRecoveryCount == 0；触发一次 engine-level BLOCKED（如 cdd implement 非法参数）
    // 断言：重读 progress.json engineRecoveryCount == 1（无需 orchestrator 写）
  });
  ```
  Expected: FAIL（当前 engine 无该写入点）
- [ ] **Step 2: runner.mjs 加 engineRecoveryCount 自增点**（+ progress.mjs helper 如需要）
- [ ] **Step 3: cli-driven-development SKILL.md 去 orchestrator 递增指令**（§engine-recovery / §timeout-decision / dispatch-mode）
- [ ] **Step 4: 测试通过 + `grep -rn 'progress.json' packages/osuperpowers/skills` 仅剩只读引用**
- [ ] **Step 5: `pnpm run validate` 绿**
- [ ] **Step 6: Commit**
  ```bash
  git add -A
  git commit -m "refactor(cdd-engine): progress.json engine-owned — engineRecoveryCount engine-write + orchestrator read-only (D14)"
  ```

---

## Self-Review

**1. Spec 覆盖**（spec §2.4 六类删除面 × task 对应）：
- ① gate 子系统 → T1 ✓
- ② harness 选择/探测/安装层 → T2 ✓
- ③ 未验证 harness 收敛 + per-harness 产物 → T1（产物）+ T2（registry 两键）✓
- ④ skill/docs 层 → T4（命令形态）+ T5（概念出清）✓
- ⑤ CI/workflow 面 → T1（`.github/actions/install-harness/` + pr-validate.yml — review blocker F1 内联）✓
- ⑥ 引擎测试/smoke 迁移面 → T3 ✓
- spec §2.3 D1–D14 全覆盖 ✓（**D1→T1（CI action + pr-validate.yml）+ T2（bin/init + install-harness.mjs）**、D2→T6、D3→T2、D4→T2、D5/D6→T3、D7→T2、D8→T2、D9→T2、D10→T3、D11→T4、D12→T3、D13→T1、**D14→T9**）

**2. Placeholder scan**：无 TODO/TBD；所有 step 有明确 Run 命令或 Modify 内容。

**3. Type consistency**：
- `detectCurrentHarness(env)` — cdd.mjs 现有函数，扩展空→BLOCK 语义（内部），签名不变 ✓
- `runTask(harness, taskNum, opts)` — 签名不变，host 由 cdd.mjs 解析传入 ✓
- `runDocsTask({ harness, mode, template, type, doc, ... })` — 内部 `doc` 参数保留（prompt {{DOC}}/handoff doc_path），CLI 层归一 ✓
- changeset 版本语义：cdd-engine major（breaking：--harness/--doc/select 删）+ osuperpowers major（gate 移除）—— 与 P6 先例（cdd-engine major + osuperpowers minor）不同，因 osuperpowers 移除主子系统（hooks/init/select），按破坏面 major 更诚实

**4. 已内联修正**：T1 补 CI/action 面（review blocker F1 教训，已并入 T1 Files/Steps）；T3 整合 D12 测试迁移（避免中间 red）；T8 changeset major。

---

## 审查发现补丁（plan-review round 1 —— 4 blockers / 4 warns / 1 nit 全部并入正文）

- **B1 ⛔** T2 漏 `cli-shared.test.mjs` gate-env 3 用例（删注入后必 FAIL）→ ✓ T2 Files/Step 4
- **B2 ⛔** T1/T2 漏 `scripts/validate/osuperpowers.mjs` skills-count EXPECTED 8→7 → ✓ T2 Files/Step 7
- **B3 ⛔** `docs/gate-install.md` + 根 README gate 段未入删除面 → ✓ T4 Delete/Modify + T7 grep1 范围 `docs/`+README
- **B4 ⛔** T1 no-gate.test ROOT 四层 `..` 越界 + 单断言假绿 → ✓ 三层 `..` + bin/gate+hooks 双断言
- **W ④** cdd-reference "gate matrix 已 Task 1 删" 为假（T1 从未涉及）→ ✓ T4 显式 scrub gate matrix L119-148 + skills-probe L75
- **W ⑤** maintainers L191-193 `--harness`/`--doc` 命令形态过期 + T7 grep 不覆盖 → ✓ T4 Files + T7 grep 范围
- **W ⑥** docs-runner.mjs L55-56 仍含 `CDD_GATE_WORKSPACE` 注释 → guard 落地即 baseline 红 → ✓ T6 前置清理
- **W ⑦** T4 Step 1 旧形态拒绝法：现 cdd.mjs 同时注册 `--doc`+`--spec` 不会被拒 + 非 dry-run 触发真实 dispatch → ✓ 改工作树静态断言 + new-shape dry-run green
- **N ⑧** T2/T3 snippets node:test 风格 vs vitest 文件 + runCli 非共享 → ✓ vitest `it`/`expect` + runCli 内联注

## 审查发现补丁（plan-review round 2 —— 1 blocker / 2 warns / 3 nits 全部并入正文）

- **B1 ⛔** T3 host-detection 用 `.code` 但 runCli 返回 `.exitCode` + implement 缺 `--plan` → ✓ Step 1 snippet 对齐
- **W ①** 13-block 硬编码位（`scripts/run.mjs:10,48` + CLAUDE.md:42）未触达 → ✓ T1 增 run.mjs + CLAUDE.md 12-block 同步
- **W ②** grep1 `docs/` 范围含 P5 plan/spec 本体 gate 语汇 → 机械不可达 → ✓ 注册豁免 `docs/superpowers/`
- **N ③** T2 两个 Step 8 → ✓ 顺延 Step 9/10
- **N ④** runner.test.mjs ~33 处 `probeSkills: NOOP_PROBE` 未列 → ✓ T2 Files/Step 4
- **N ⑤** round-1 补丁头 3/3/3 计数错（实 4/4/1）→ ✓ 已改

## 审查发现补丁（plan-review round 3 —— 2 blockers / 3 warns / 1 nit 全部并入正文）

- **B1 ⛔** host-marker 泄漏：cleanEnv 只剥 CDD_*，dev env 实测 `CLAUDE_CODE_SESSION_ID`/`AI_AGENT` 已设 → no-host 用例须显式 delete 三 marker → ✓ T3 Step 1 `NO_HOST_ENV` 含 delete 三行 + T4 green 用例注入
- **B2 ⛔** `packages/osuperpowers/CHANGELOG.md` 含 `cdd-gate-core`/`gateDecide` → T7 grep1 命中 → ✓ 注册豁免 CHANGELOG（历史记录不改，T6 guard scope 同步）
- **W ③** cursorPluginManifest L89 hooks 回退指向已删文件 → ✓ T1 manifests 增 cursorPluginManifest 修正 + emit.test L129 用例改「无 hooks 字段」
- **W ④** osuperpowers 包 README 残留 droid/pi 列表 + init 过期 + cli-select 行 → ✓ T5 Step 3 全文收敛 + T7 grep `cli-select\|droid\|pi`
- **W ⑤** emit 死代码：`kimiPluginManifest`/`geminiExtension` 整删；`geminiMarkdown` **保留**（vendor-assembly.mjs:311 消费者）→ ✓ T1 Files 精确区分
- **N ⑥** T2 cli-driven-development 引用「见 Task 4」错标（本轮正文清理在 Task 5）→ ✓ 改 Task 5

## 审查发现补丁（plan-review round 4 —— 2 blockers / 2 warns / 2 nits 全部并入正文）

- **B1 ⛔** T4 cli-shape snippet 复现 `.code` 缺陷 + env 无 host → ✓ 改 `cli-shape.test.mjs` 新文件 + `.exitCode` + `HOST_ENV` 注入
- **B2 ⛔** cdd-reference L96 `pluginRoot()` via `bin/gate/cdd-gate-core.mjs` / `[cli-select]` 漏 scrub → ✓ 全文件 gate/select 归零 + pluginRoot 改 templates.mjs 语义
- **W ③** maintainers `## CDD CLI pre-check (skills-missing gate)` 整节（skills-probe 机制）随 T2 删除 → ✓ T5 删整节 + T7 grep `skills-missing\|skills-probe`
- **W ⑦** T3 snippet `PLAN_FIXTURE` 未定义 → ✓ 显式 `path.join(REPO_ROOT, .../fixtures/smoke-plan.md)`
- **N ⑧** T6 Step 1 与 T2 Step 4 重复 → ✓ 改「仅核对无残留」
- **N ⑨** Self-Review D1 mapping 错标（单 T2）→ ✓ D1→T1+T2 联合

## 审查发现补丁（plan-review round 5 —— **blocker=0 APPROVED**，5 warn/nit 全修，不 re-review）

- **W ①** T1 kill list 两个 phantom exports（`osuperpowersCodexHooks`/`osuperpowersQoderHooks` 实际为 `codexHooksJson`/`qoderHooksJson` + 共享 helper `hooksFor`）→ ✓ T1 + spec §2.4 ① 改名
- **W ②** T4 cli-shape snippet `SMOKE_SPEC`/`SMOKE_PLAN` 未声明 → ✓ 显式 `path.join(REPO_ROOT, ...)`（SMOKE_SPEC = 现有 P5 spec 文档）
- **W ③** cdd-research mock-harness E2E（L102/136/208）依赖 `--harness` 注入临时 registry 键 → ✓ T3 re-key claude + CDD_REGISTRY_PATH + env host marker；未知-harness 用例删
- **W ④** CLAUDE.md L7/L40 emit-trigger `hooks/` 行未清 → ✓ T1 CLAUDE.md 清理扩至 L7/L40
- **W ⑤** T7 grep3 `--doc` 范围缺 `packages/cdd-engine/bin/tests` → ✓ 补 tests

## 审查发现补丁（plan-review round 3 增 —— D13 用户决策追加）

- **D13** 用户拍板：vendored 发布面 gemini 清净（mattpocock 补写 gemini = 收敛后未验证通道）→ ✓ T1 增 vendor-assembly.mjs 删分支 + manifests 整删 thinGeminiExtension/geminiMarkdown + publish-vendor.test/emit.test 对应用例 + spec v1.1 + overall v1.24