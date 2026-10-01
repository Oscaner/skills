# osuperpowers 架构重构 P1 — runtime 布局实施计划

**Spec:** [2026-09-13-osuperpowers-overhaul-p1-design.md](../specs/2026-09-13-osuperpowers-overhaul-p1-design.md)

**Goal:** cdd-engine 运行时根 `.superpowers/cdd` → `.osuperpowers/cdd`（单源翻转 + 全 literal 迁移），standalone 概念整体移除，旧根死档全量删除，残留守卫防回渗。

**Architecture:** `templates/handoff-namespace.json#workspaceRoot` 是唯一真相（engine 大部分路径经 `naming.mjs workspaceRoot/resolveWorkspace` 派生，翻转即自动随迁）；剩余为硬编码 literal 面（bin lifecycle / engine 源注释 / 13 测试文件 / 7 skills 文档 / validate 脚本 / 根 gitignore），逐一机械迁移。standalone 无真实消费者（零派发伪功能），STANDALONE_ROOT/`--scope`/`--slug` 全删，`cdd base-branch` 单调 `--plan`。残留守卫（residue.mjs stale-lexicon）防旧路径回渗。

**Tech Stack:** Node ESM (engine bin/lib/templates + tests) · Vitest (engine suite) · Commander CLI · tinyglobby scan

## Global Constraints

从 overall + P1 design copy：
- workspaceRoot 单源在 `templates/handoff-namespace.json#workspaceRoot`；engine 不得新增硬编码布局 literal（§2.2）
- `.superpowers/sdd/` 保留（superpowers 所属，不在本 phase 迁移域）；`rootFromDocPath` 的 `docs/superpowers` fallback **不改**（P2 职责）
- report-issue 的 `kind: "standalone"` report-target 分类与「a standalone run has no run slug」prose **保留**（rename 归 P5）（§2.3 ruling）
- **删除时序**：旧根删除任务必须在 workspaceRoot flip 的代码变更 commit 之后执行（§2.4）
- 存量删除后 `.superpowers/` 下仅存 `sdd/`；engine 运行期零 `.superpowers` 写入（§2.4 acceptance）
- 所有改动须过 `pnpm run validate`（13 块）+ `pnpm run emit:check` 无 drift；skills/*.md 与 skills/*/docs/*.md 改动后必跑 `pnpm run emit`
- changeset：cdd-engine minor；osuperpowers 本次不 bump（P4 再计）
- vendored 子模块不可改

---

### Task 1: runtime 单源翻转 — `.superpowers/cdd` → `.osuperpowers/cdd` 全迁移

**Files:**
- Modify: `packages/cdd-engine/templates/handoff-namespace.json:3`（`"workspaceRoot": ".superpowers/cdd"` → `".osuperpowers/cdd"`）
- Modify: `packages/cdd-engine/bin/cdd.mjs:25,27`（lifecycle 路径）
- Modify: `packages/cdd-engine/lib/handoff/naming.mjs:4,13`（源注释）
- Modify: `packages/cdd-engine/lib/lifecycle/proc.mjs:4`（源注释）
- Modify: `packages/cdd-engine/lib/runner/run-task.mjs:67,87,91`（源注释；`100-102` workspace 收编 base 派生自单源，自动随迁）
- Modify: `packages/cdd-engine/lib/cli/review.mjs:20`、`packages/cdd-engine/lib/cli/branch-review.mjs:50`、`packages/cdd-engine/lib/cli/base-branch.mjs:3-4`（源注释——base-branch.mjs 的 standalone 逻辑行留给 Task 2 删除）
- Modify: 13 个测试文件 `.superpowers/cdd` literal → `.osuperpowers/cdd`（**行号清单为 indicative 上锚、非穷尽索引**——cdd.test.mjs:20,135,194,277 为注释/参数/路径命中、docs-runner.test.mjs:79,95,151,173,185,216,236,249,279,300,318,338,361 等；base-branch.test.mjs:8 与 runner.test:278 为裸 `.superpowers` 行。**Step 2 的文件级机械 sweep + Step 4 grep 检查是唯一权威完成判据**）：
  `tests/runner.test.mjs`、`tests/cli-shape.test.mjs`、`tests/cli-shared.test.mjs`、`tests/docs-runner.test.mjs`、`tests/docs-task.test.mjs`、`tests/cdd.test.mjs`、`tests/cdd-research.test.mjs`、`tests/host-detection.test.mjs`、`tests/helpers.mjs`、`tests/branch-review.test.mjs`、`tests/handoff-naming.test.mjs`、`tests/base-branch.test.mjs`（**standalone 用例留给 Task 2 删除**）、`tests/task.test.mjs`
- Modify: 7 个 skills/docs 路径文本（`.superpowers/cdd` → `.osuperpowers/cdd`）：
  `packages/osuperpowers/skills/finishing/SKILL.md:51`（Read 段）、`packages/osuperpowers/skills/_docs/review.md:49`（Handoff Output 段）、`packages/osuperpowers/skills/cli-driven-development/docs/base-branch.md:20,72`（:46,50 standalone 行留 Task 2）、`packages/osuperpowers/skills/cli-driven-development/docs/handoff-schema.md:55-57`、`packages/osuperpowers/skills/cli-driven-development/SKILL.md:55,56,141`、`packages/osuperpowers/skills/report-issue/SKILL.md:8,33,46,47,70,72,74`、`packages/osuperpowers/skills/cli-research/SKILL.md:35`
- Modify: `scripts/validate/smoke-cdd.mjs:43,52`（`.superpowers/cdd` → `.osuperpowers/cdd`；`rmSync` 清理 slug 失配修复见 Step 3）
- Modify: 根 `.gitignore`（`.superpowers` 保留 + 增 `.osuperpowers`）
- Test: `packages/cdd-engine/tests/` vitest suite（engine 376 tests）

**Interfaces:**
- Consumes: P1 design §2.2 迁移面
- Produces: engine 运行期全部产物（handoff / progress / lifecycle / base-branch / report-target）落 `.osuperpowers/cdd/<slug>/`；`handoff-namespace.json#workspaceRoot` = `.osuperpowers/cdd`

- [ ] **Step 1: 翻转单源 + engine 代码面**

改 `packages/cdd-engine/templates/handoff-namespace.json` line 3：
```json
"workspaceRoot": ".osuperpowers/cdd",
```
改 `packages/cdd-engine/bin/cdd.mjs` line 25/27 注释 + 代码：
```js
// 生产默认 <cwd>/.osuperpowers/cdd/lifecycle.json（相对启动 cwd，跨 run 复用）。
const lifecyclePath = process.env.CDD_LIFECYCLE_PATH ?? path.join(cwd, ".osuperpowers", "cdd", "lifecycle.json");
```
更新 8 处 engine 源注释（naming.mjs / proc.mjs / run-task.mjs / review.mjs / branch-review.mjs / base-branch.mjs 的 `.superpowers/cdd` → `.osuperpowers/cdd`；base-branch.mjs:3-4 的 standalone 路径描述保留原文、仅 cdd 段迁移，standalone 段随 Task 2 整体删除）。只替换 `.superpowers/cdd` 出现处，**不**动 `.superpowers/sdd` 与其他。

- [ ] **Step 2: 迁移 13 个测试文件 literal**

逐文件将 `.superpowers`/`cdd` 两段式 `path.join(repoA, ".superpowers", "cdd", ...)` → `.osuperpowers`，字符串 `".superpowers/cdd/..."` → `".osuperpowers/cdd/..."`。`base-branch.test.mjs` 只迁移 CDD 落点断言（:60 `cdd app` 路径），standalone 用例（:64,87）本 Task **不迁不删**（留给 Task 2）。迁移后 grep 验证：engine tests 中 `.superpowers` 仅剩 standalone 相关与 sdd 语义位置。

- [ ] **Step 3: 迁移 skills/docs + validate + gitignore**

7 个 skills/docs 文件 `.superpowers/cdd` → `.osuperpowers/cdd`（路径文本）。**特殊：report-issue SKILL.md 的 brace-glob `{repo}/.superpowers/{sdd,cdd}/*/progress.md` 须显式分裂为 `{repo}/.superpowers/sdd/*/progress.md` + `{repo}/.osuperpowers/cdd/*/progress.md`**——sdd 保留在 `.superpowers/` 而 cdd 移往 `.osuperpowers/`，机械替换 `.superpowers/cdd` 命中不了 brace 形式，保留原样会导致 Task 4 删旧根后 report-issue 丢全部 CDD progress 源。`cli-research/SKILL.md:35` 的 `.superpowers/` 目录描述 → `.osuperpowers/`（research brief 落点随引擎 workspace 变化）。`smoke-cdd.mjs` 两处 `.superpowers/cdd` → `.osuperpowers/cdd`，并**修复 cleanup slug 失配**——`slug = path.basename(plan, ".md")` 得 `smoke-plan`，但 engine 派生 slug 实为 `smoke`（strip 尾 `-plan`），导致清理路径失配、stale rounds 累积；改为与 `workspaceSlug` 一致的派生：
```js
const planBase = path.basename(plan, ".md");
const slug = planBase.replace(/-(?:design|plan)$/, ""); // smoke-plan.md → smoke（与 engine workspaceSlug 同规则）
```
根 `.gitignore` line 4 `.superpowers` 后新增一行 `.osuperpowers`。

- [ ] **Step 4: emit + 全量跑 engine 套件 + validate**

本 Task 改动了 7 个 `packages/osuperpowers/skills/**` 文件（SKILL.md + skills/*/docs/*.md），按 Global Constraints 必须先 `pnpm run emit` 才可 validate（validate 第一块即 emit freshness）。

```bash
pnpm --filter @oscaner-skills/cdd-engine test  # vitest 376 tests → 迁移后全绿
cd packages/osuperpowers && pnpm run emit && cd ../..   # skills SKILL.md/docs 改动 → 再生 .agents/ + source.json
node scripts/run.mjs validate                  # 13 块全绿（含 emit freshness）
```
Expected: engine suite PASS；emit 无 drift；validate ALL PASS。grep 复核：
```bash
grep -rn "\.superpowers/cdd\|\.superpowers/{sdd,cdd}" packages/cdd-engine/bin packages/cdd-engine/lib packages/cdd-engine/templates packages/osuperpowers/skills  # 期望 0（sdd 分裂形式/standalone 预留位除外）
```

- [ ] **Step 5: Commit**

```bash
git add packages/cdd-engine/templates packages/cdd-engine/bin packages/cdd-engine/lib packages/cdd-engine/tests packages/osuperpowers/skills scripts/validate/smoke-cdd.mjs .gitignore docs/osuperpowers/plans/2026-09-13-osuperpowers-overhaul-p1.md
git commit -m "refactor(cdd-engine): runtime root .superpowers/cdd → .osuperpowers/cdd (single-source flip + full literal migration)"
```
（Plan 自身文件可在 Task 1 一并 commit 或独立 commit，任选；plan 文档不属 engine 产物。）

---

### Task 2: standalone 收缩 — `cdd base-branch` 单调 `--plan`

**Files:**
- Modify: `packages/cdd-engine/lib/cli/base-branch.mjs`（STANDALONE_ROOT + resolveBaseBranchWorkspace standalone 分支删除；**顺带删掉 line 7 `path` 与 line 11 `gitToplevel` 两个 dead imports**——删除 standalone 分支后 gitToplevel 唯一调用点消失、`path.join(root, STANDALONE_ROOT, slug)` 唯一 path 使用点消失）
- Modify: `packages/cdd-engine/lib/cli/parse.mjs:23,107-109,112,119-120,127-128`（SUBCOMMAND_USAGE + description + `--scope`/`--slug` flags）
- Modify: `packages/cdd-engine/tests/base-branch.test.mjs`（standalone 用例删除 + 头部双 scope 注释 line 4 同步收敛为单一 `--plan` 落点描述）
- Modify: `packages/osuperpowers/skills/finishing/SKILL.md:50`（read-base standalone 落盘 → 推断后不落盘语义）
- Modify: `packages/osuperpowers/skills/cli-driven-development/docs/base-branch.md:46,50,70,72,83`（standalone 行删除 + flag 表单调）
- Modify: `packages/osuperpowers/skills/cli-driven-development/SKILL.md:55,56`（**残留「dual-scope slug resolution」措辞 → 单一 `--plan` 落点；`determine-base` 节点不再提 standalone**）
- Test: `packages/cdd-engine/tests/base-branch.test.mjs` vitest

**Interfaces:**
- Consumes: Task 1（engine 已落新根；base-branch CDD 侧随单源自动新根）
- Produces: `cdd base-branch set|get` 仅 `--plan <path>` 目标；`STANDALONE_ROOT` 常量不存在；`--scope`/`--slug` flag 不存在

- [ ] **Step 1: 删除 engine standalone 代码面**

`lib/cli/base-branch.mjs`：
- 删 line 14-16 STANDALONE_ROOT 常量与注释
- `resolveBaseBranchWorkspace` 删 standalone 分支（`opts.scope != null || opts.slug != null` 块内 scope/slug 处理、gitToplevel 分支），保留 plan 目标 + 「均缺 → 明确报错 exit 2」
- 文件头注释改为「`cdd base-branch set/get` 纯 artifact 命令——唯一目标 `--plan <path>` → resolveWorkspace(plan)」

`lib/cli/parse.mjs`：
- line 23 SUBCOMMAND_USAGE base-branch 行 → `usage: cdd base-branch <set|get> --plan <path> [set: --base <branch> --source <source>] [--force]`
- line 107-109 / 112 注释与 description：standalone 措辞删除
- line 119-120 set 的 `--scope`/`--slug` 两个 option、line 127-128 get 的两个 option 删除

- [ ] **Step 2: 更新 base-branch.test.mjs 删除 standalone 用例**

删除以下用例（standalone scope 全军覆没）：
- `set --scope standalone --slug → <gitRoot>/.superpowers/standalone/<slug>/base-branch.json`
- `set standalone --force → 覆盖成功`
- `standalone 组缺 --base/--source → exit 非零`
- `缺 target（CDD 无 plan / 无 scope）` → 改写为「缺 --plan → exit 非零 + 明确报『CDD 需 --plan』」
- `flag 边界：--plan 与 --scope/--slug 并存 → 互斥 exit 2` → 删除（flag 已不存在）
- `--scope 非 standalone → exit 2` → 删除
- `get --scope standalone --slug 读回 JSON 往返` → 删除
保留并验证 CDD `--plan` 单调路径全部通过（set 幂等/force 矩阵、get 往返、缺失/schema 非法、坏 flag usage 行）。

- [ ] **Step 3: 更新 finishing read-base + base-branch.md + dual-scope 措辞 sweep**

`finishing/SKILL.md:50` read-base：改为「有 cdd artifact → 读 `.osuperpowers/cdd/<slug>/base-branch.json`；**无 artifact（手工 feature 分支、无 plan）→ 推断 base（①plan field ②branch upstream ③conversation context ④ask user）后直接传给 present-menu，不落盘任何 base-branch.json**」；`:51` Read 段 `.superpowers/{cdd,standalone}` → `.osuperpowers/cdd`。

`cli-driven-development/SKILL.md:55,56` determine-base：去除「dual-scope slug resolution」措辞——双 scope 概念已删除，收敛为「单一 `--plan` 落点（engine 经 resolveWorkspace 派生 slug）」。

`cli-driven-development/docs/base-branch.md`：
- line 20 artifact 路径 `.superpowers/<scope>/<slug>/base-branch.json` → `.osuperpowers/cdd/<slug>/base-branch.json`
- line 46 scope resolution 表删 standalone 行（只剩 CDD 行）
- line 50「Feature branch names are sanitized before use as the standalone-slug path segment」段整段删除（含 slug sanitize 规则）
- line 70/72/73 flag 表收敛为 CDD `--plan` 单调；line 83 flag 边界「`--plan` 与 `--scope/--slug` 互斥；standalone 组必填」→ 「missing --plan → 明确报错」

- [ ] **Step 4: 跑 engine 套件 + emit + validate**

```bash
pnpm --filter @oscaner-skills/cdd-engine test   # base-branch.test 全绿
cd packages/osuperpowers && pnpm run emit && cd ../..   # skills SKILL.md/docs 改动 → 再生 .agents/
node scripts/run.mjs validate
```
Expected: engine suite PASS；emit 无 drift；validate 13 块 ALL PASS。grep 复核 engine bin/lib + skills 机制位置零 `.superpowers/standalone`。

- [ ] **Step 5: Commit**

```bash
git add packages/cdd-engine packages/osuperpowers
git commit -m "refactor(cdd-engine): standalone scope 整体移除 — cdd base-branch 单调 --plan (STANDALONE_ROOT/--scope/--slug 删除)"
```

---

### Task 3: 残留守卫 — residue.mjs stale-lexicon 防回渗

**Files:**
- Modify: `scripts/validate/residue.mjs`（STALE_LEXICON_CHECKS 新增两条）
- Modify: `scripts/validate/residue.test.mjs`（:54 负向断言翻转 + 新命中/放行断言 + sdd 放行）
- Test: `scripts/validate/residue.test.mjs` vitest（node --test）

**Interfaces:**
- Consumes: Task 1（`.superpowers/cdd` 已从机制位置清空）、Task 2（`.superpowers/standalone` 已从机制位置清空）
- Produces: 新增两条 stale-lexicon 守卫，机制位置零豁免；`.superpowers/sdd` 不设守卫

- [ ] **Step 1: residue.mjs 新增守卫条目**

`STALE_LEXICON_CHECKS` 数组追加两条（复用 `ALL_MECH_POSITIONS`）：
```js
{ label: "old runtime root .superpowers/cdd", re: /\.superpowers\/cdd/, scope: ALL_MECH_POSITIONS },
{ label: "deleted standalone root", re: /\.superpowers\/standalone/, scope: ALL_MECH_POSITIONS },
```
注：现有 `{ label: "flat docs-review root 回退", re: /\.superpowers\/docs-review/, scope: CDD_ENGINE_BIN }` 保留不动（docs-review 删除后仍防复发）。

- [ ] **Step 2: residue.test.mjs 翻转负向断言 + 新增**

`scripts/validate/residue.test.mjs` 的「flat docs-review root 回退路径命中」用例中：
```js
expect(hasHit([".superpowers/cdd/foo/spec-review-1.json"])).toBe(false); // 规范家族名不误报
```
改为（新 `.superpowers/cdd` 守卫下翻转）：
```js
expect(hasHit([".superpowers/cdd/foo/spec-review-1.json"])).toBe(true); // 新 <cdd> 守卫命中
expect(hasHit([".superpowers/sdd/foo/progress.json"])).toBe(false);      // sdd 保留面放行
```
新增断言 `.superpowers/standalone/x/base-branch.json` → `toBe(true)`（standalone 守卫命中）。

- [ ] **Step 3: 跑 residue 测试 + 全量 validate**

```bash
node --test scripts/validate/residue.test.mjs   # 23 tests 全绿（含新断言）
node scripts/run.mjs validate                   # block 5c stale-lexicon zero + 全部绿
```
Expected: 5c 的 checkStaleLexicon 零命中（机制位置已迁移清空）→ OK。

- [ ] **Step 4: Commit**

```bash
git add scripts/validate/residue.mjs scripts/validate/residue.test.mjs
git commit -m "feat(validate): stale-lexicon guard — .superpowers/cdd + .superpowers/standalone 防回渗 (sdd 放行)"
```

---

### Task 4: 存量处置 — 旧根死档全量删除

**Files:**
- Delete (runtime, gitignored — 无 git 痕迹): `.superpowers/cdd/*`（19 workspace + lifecycle.json + smoke/ + .gitignore + .archive-*）、`.superpowers/docs-review/`
- Test: shell 验证 `.superpowers/` 仅存 `sdd/`；`.osuperpowers/cdd/smoke` 已由 smoke-cdd 产出

**Interfaces:**
- Consumes: Task 1（flip 已 commit，resolveWorkspace 全走新根——**删除时序约束满足**）
- Produces: `.superpowers/` 下仅存 `sdd/`；engine 运行期零 `.superpowers` 写入

- [ ] **Step 1: 确认前置时序**

git log 确认 Task 1 的 flip commit 已提交（`handoff-namespace.json#workspaceRoot = ".osuperpowers/cdd"` 生效）。前置不满足 → 停止，先回 Task 1。

- [ ] **Step 2: 删除旧根死档**

```bash
rm -rf .superpowers/cdd .superpowers/docs-review
```
（`.superpowers/cdd/` 整树含 19 workspace + lifecycle.json + smoke + .gitignore + `.archive-*`；`.superpowers/docs-review/` 整树。`.superpowers/sdd/` 保留。）

- [ ] **Step 3: 验证存量面**

```bash
ls .superpowers/          # 仅 sdd/
ls .superpowers/sdd/      # 保留（.gitignore `*` 仍在）
git status                # 干净（全部 gitignored，无 git 痕迹）
node scripts/run.mjs smoke-cdd   # 重建 smoke 于 .osuperpowers/cdd/smoke（新根）
ls .osuperpowers/cdd/smoke       # 期望含 branch-review-<base7>..<head7>-r1.json（smoke 在 CDD_DRY_RUN 下唯一写入的 branch-review handoff；无 plan-review-1.json）
```
Expected: `.superpowers/` 仅 `sdd/`；`.osuperpowers/cdd/smoke/` 由 smoke-cdd 产出（非空目录 + branch-review handoff）；git status clean。

- [ ] **Step 4: 零 `.superpowers` 写入验证（dry-run，不派发活 agent）**

用 smoke-cdd 同款 dry-run 模式验证落点（`CDD_DRY_RUN=1` 不 spawn review agent，仅解析 workspace 显示落点——不产生新 review round/findings；若取真实 review 会派发 agent 且给 findings 无处理契约，故禁）：
```bash
CDD_DRY_RUN=1 CLAUDE_CODE_SESSION_ID=1 node packages/cdd-engine/bin/cdd.mjs review --type spec --spec docs/osuperpowers/specs/2026-09-13-osuperpowers-overhaul-p1-design.md
```
Expected: **exit 0 静默返回**（spec/plan 型 dry-run 经 run-docs.mjs `if (dryRun)` 早返回，不打印 4 行 H1——仅 implement/task-review/fix/branch-review 四型才打印），仅验证：落点解析至 `.osuperpowers/cdd/<slug>/`（新根）+ 运行期零 `.superpowers` 写入 + stdout 无 `.superpowers` 路径段；不产生新 review round。engine 运行期零 `.superpowers` 写入由构造保证（resolveWorkspace 全走新根）。

- [ ] **Step 5: 全量 validate**

```bash
node scripts/run.mjs validate
```
Expected: 13 块全绿。

- [ ] **Step 6: Commit（无 git 增量时仅确认状态）**

删除动作本身无 git 痕迹（gitignored）；若本 Task 无新增 commit，验证 git status clean 即完成。若 plan/spec 文档有同步改动则一并 commit：
```bash
git status --short   # 空 = 本 task 无 commit（runtime 删除仅文件系统）
```

> **T4 review-1 follow-up（非本任务缺陷，记录供下游）**：smoke-cdd.mjs:44 对共享 gitignored workspace（`.osuperpowers/cdd/smoke/`）的 `rmSync` 在同机多 claude 会话并发时可能误删他会话证据（T4 review 期间实测发生一次）。建议后续为 smoke-cdd 加并发保护（进程锁或写入后即时不可变命名），或 review 前以重跑复现为验证手段。落 P6 或独立 follow-up 处理。

---

### Task 5: changeset + 全量收口

> **T5 review-1 follow-up（非本任务缺陷，记录供下游）**：vitest 多 worker 并行下 fork 出的 cdd CLI 偶发 5b1 flake（host-detection `CLAUDE_CODE_SESSION_ID=1 → exit 1`，370 passed/1 failed 一次，隔离复跑 371 全绿 + 手工重复 exit 0）。根因 = 基线并发脆弱点（fork CLI 启动期 reapStale 互踩 lifecycle/workspace）。建议后续统一 per-fork 隔离（`CDD_LIFECYCLE_PATH` 唯一化 + 每 fork 独立 workspace slug）或 engine 套件 worker 串行。

**Files:**
- Create: `.changeset/<slugs>.md`（cdd-engine minor）
- Test: `node scripts/run.mjs validate` + `pnpm run emit:check` + `node scripts/run.mjs version --dry-run`（可选）
- Note: changeset 文件必须 POSIX 结尾换行（`\n` 终止；缺失会触发 `No newline at end of file` nit——c2e9b7d 先例复发，T5 review nit 已修）

**Interfaces:**
- Consumes: Task 1-4（全量落地）
- Produces: changeset（`@oscaner-skills/cdd-engine` minor）；osuperpowers 本次不 bump

- [ ] **Step 1: 创建 changeset**

```bash
cd /Users/kang/Projects/oscaner-skills && pnpm run changeset
```
changeset 内容（minor）：
```
---
"@oscaner-skills/cdd-engine": minor
---

P1 runtime 布局: workspace 根 .superpowers/cdd → .osuperpowers/cdd（handoff/progress/lifecycle/base-branch/report-target 全随迁）; standalone scope 整体移除（cdd base-branch 单调 --plan）; 旧根 dead-workspace 清理。
```
（若 pnpm run changeset 交互不可用，手动写 `.changeset/<kebab-slug>.md`。）

- [ ] **Step 2: 全量验证收口**

```bash
node scripts/run.mjs validate    # 13 块全绿
pnpm run emit:check              # 无 drift
```
Expected: ALL PASS + drift 0。

- [ ] **Step 3: Commit**

```bash
git add .changeset
git commit -m "chore(cdd-engine): changeset — P1 runtime 布局单根化 + standalone 移除 (minor)"
```

---

## Execution handoff

Plan complete. Execute via `osuperpowers:cli-driven-development`（每 Task 全串行闭环：implement → task-review → fix loop → review 输出 blocker=0 才进下一 Task；全部完成后 branch-review → finishing）。<token>100k</token>