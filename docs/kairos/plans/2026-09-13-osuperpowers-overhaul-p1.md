# osuperpowers 架构重构 P1 — runtime 布局实施计划

**Spec:** [2026-09-13-osuperpowers-overhaul-p1-design.md](docs/kairos/specs/2026-09-13-osuperpowers-overhaul-p1-design.md)

- **Parent program**: [2026-09-13-osuperpowers-overhaul-overall.md v1.4](../specs/2026-09-13-osuperpowers-overhaul-overall.md)
- **Depends on**: 无（program 起点）
- **Base**: develop

## Constraints


从 overall + P1 design copy：
- workspaceRoot 单源在 `templates/handoff-namespace.json#workspaceRoot`；engine 不得新增硬编码布局 literal（§2.2）
- `.superpowers/sdd/` 保留（superpowers 所属，不在本 phase 迁移域）；`rootFromDocPath` 的 `docs/superpowers` fallback **不改**（P2 职责）
- report-issue 的 `kind: "standalone"` report-target 分类与「a standalone run has no run slug」prose **保留**（rename 归 P5）（§2.3 ruling）
- **删除时序**：旧根删除任务必须在 workspaceRoot flip 的代码变更 commit 之后执行（§2.4）
- 存量删除后 `.superpowers/` 下仅存 `sdd/`；engine 运行期零 `.superpowers` 写入（§2.4 acceptance）
- 所有改动须过 `pnpm run validate`（13 块）+ `pnpm run emit:check` 无 drift；skills/*.md 与 skills/*/docs/*.md 改动后必跑 `pnpm run emit`
- changeset：cdd-engine minor；osuperpowers 本次不 bump（P4 再计）
- vendored 子模块不可改


### Task 1: runtime 单源翻转 — `.superpowers/cdd` → `.osuperpowers/cdd` 全迁移

- **Objective**: runtime 单源翻转 — `.superpowers/cdd` → `.osuperpowers/cdd` 全迁移（`templates/handoff-namespace.json#workspaceRoot` 单源翻转 + 全 literal 迁移；standalone 概念整体移除、旧根死档全量删除、残留守卫防回渗）
- **DependsOn**: none
- **AtomicWith**: none

- **Consumes**: P1 design §2.2 迁移面

- **Produces**: engine 运行期全部产物（handoff / progress / lifecycle / base-branch / report-target）落 `.osuperpowers/cdd/<slug>/`
- **Produces**: `handoff-namespace.json#workspaceRoot` = `.osuperpowers/cdd`

- **Files**: packages/cdd-engine/templates/handoff-namespace.json, packages/cdd-engine/bin/cdd.mjs, packages/cdd-engine/lib/handoff/naming.mjs, packages/cdd-engine/lib/lifecycle/proc.mjs, packages/cdd-engine/lib/runner/run-task.mjs, packages/cdd-engine/lib/cli/review.mjs, packages/cdd-engine/lib/cli/branch-review.mjs, packages/cdd-engine/lib/cli/base-branch.mjs, packages/cdd-engine/tests/runner.test.mjs, packages/cdd-engine/tests/cli-shape.test.mjs, packages/cdd-engine/tests/cli-shared.test.mjs, packages/cdd-engine/tests/docs-runner.test.mjs, packages/cdd-engine/tests/docs-task.test.mjs, packages/cdd-engine/tests/cdd.test.mjs, packages/cdd-engine/tests/cdd-research.test.mjs, packages/cdd-engine/tests/host-detection.test.mjs, packages/cdd-engine/tests/helpers.mjs, packages/cdd-engine/tests/branch-review.test.mjs, packages/cdd-engine/tests/handoff-naming.test.mjs, packages/cdd-engine/tests/base-branch.test.mjs, packages/cdd-engine/tests/task.test.mjs, packages/osuperpowers/skills/finishing/SKILL.md, packages/osuperpowers/skills/_docs/review.md, packages/osuperpowers/skills/cli-driven-development/docs/base-branch.md, packages/osuperpowers/skills/cli-driven-development/docs/handoff-schema.md, packages/osuperpowers/skills/cli-driven-development/SKILL.md, packages/osuperpowers/skills/report-issue/SKILL.md, packages/osuperpowers/skills/cli-research/SKILL.md, scripts/validate/smoke-cdd.mjs, .gitignore

- **Steps**:
  1. 翻转单源 + engine 代码面：改 `packages/cdd-engine/templates/handoff-namespace.json` line 3 为 `"workspaceRoot": ".osuperpowers/cdd"`；改 `packages/cdd-engine/bin/cdd.mjs` line 25/27 的 lifecycle 注释 + 代码（`path.join(cwd, ".osuperpowers", "cdd", "lifecycle.json")`）；更新 8 处 engine 源注释（naming.mjs / proc.mjs / run-task.mjs / review.mjs / branch-review.mjs / base-branch.mjs 的 `.superpowers/cdd` → `.osuperpowers/cdd`；base-branch.mjs:3-4 的 standalone 路径描述保留原文、仅 cdd 段迁移，standalone 段随 Task 2 删）——只替换 `.superpowers/cdd` 出现处，**不**动 `.superpowers/sdd` 与其他 — checkable: `handoff-namespace.json#workspaceRoot = ".osuperpowers/cdd"`；engine bin/lib/templates 内机件位 `.superpowers/cdd` 零命中（`.superpowers/sdd` 保留面除外）
  2. 迁移 13 个测试文件 literal：逐文件将 `.superpowers`/`cdd` 两段式 `path.join(repoA, ".superpowers", "cdd", ...)` 与字符串 `".superpowers/cdd/..."` 两段式 → `.osuperpowers`（base-branch.test.mjs 只迁移 CDD 落点断言 `:60 cdd app` 路径，standalone 用例 `:64,87` 本 Task 不迁不删，留给 Task 2）——迁移后 grep 验证 engine tests 中 `.superpowers` 仅剩 standalone 相关与 sdd 语义位置 — checkable: engine tests 中 `.superpowers/cdd` 零命中（standalone 相关与 sdd 语义位置除外）
  3. 迁移 skills/docs + validate + gitignore：7 个 skills/docs 文件路径文本 `.superpowers/cdd` → `.osuperpowers/cdd`；**特殊**——report-issue SKILL.md 的 brace-glob `{repo}/.superpowers/{sdd,cdd}/*/progress.md` 须显式分裂为 `{repo}/.superpowers/sdd/*/progress.md` + `{repo}/.osuperpowers/cdd/*/progress.md`（sdd 保留在 `.superpowers/` 而 cdd 移往 `.osuperpowers/`，机械替换命中不了 brace 形式）；cli-research/SKILL.md:35 的 `.superpowers/` 目录描述 → `.osuperpowers/`；smoke-cdd.mjs 两处 `.superpowers/cdd` → `.osuperpowers/cdd` 并**修复 cleanup slug 失配**——`slug = path.basename(plan, ".md")` 得 `smoke-plan` 但 engine 派生 slug 实为 `smoke`（strip 尾 `-plan`），改为 `planBase.replace(/-(?:design|plan)$/, "")` 与 workspaceSlug 同规则；根 `.gitignore` line 4 `.superpowers` 后新增一行 `.osuperpowers` — checkable: 根 `.gitignore` 含 `.osuperpowers`；smoke-cdd slug 派生与 engine workspaceSlug 同规则；7 文件路径文本迁新根（grep 复核，sdd 分裂形/standalone 预留位除外）
  4. emit + 全量跑 engine 套件 + validate：本 Task 改动了 7 个 `packages/osuperpowers/skills/**` 文件（SKILL.md + skills/*/docs/*.md），按 Global Constraints 必须先 `pnpm run emit` 才可 validate（validate 第一块即 emit freshness）；`pnpm --filter @oscaner-skills/cdd-engine test`（vitest 376 tests → 迁移后全绿）→ `pnpm run emit` → `node scripts/run.mjs validate`（13 块全绿，含 emit freshness）；grep 复核 `grep -rn "\.superpowers/cdd\|\.superpowers/{sdd,cdd}" packages/cdd-engine/bin packages/cdd-engine/lib packages/cdd-engine/templates packages/osuperpowers/skills` → 期望 0（sdd 分裂形式/standalone 预留位除外） — checkable: engine suite PASS；emit 无 drift；validate 13 块 ALL PASS；grep 复核 0（豁免面除外）
  5. Commit：`git add packages/cdd-engine/templates packages/cdd-engine/bin packages/cdd-engine/lib packages/cdd-engine/tests packages/osuperpowers/skills scripts/validate/smoke-cdd.mjs .gitignore docs/osuperpowers/plans/2026-09-13-osuperpowers-overhaul-p1.md`；`git commit -m "refactor(cdd-engine): runtime root .superpowers/cdd → .osuperpowers/cdd (single-source flip + full literal migration)"`（plan 自身文件可在 Task 1 一并 commit 或独立 commit，任选；plan 文档不属 engine 产物） — checkable: T1 变更面单提交落盘（conventional）

- **Acceptance**:
  - `handoff-namespace.json#workspaceRoot = ".osuperpowers/cdd"`；engine bin/lib/templates 内机件位 `.superpowers/cdd` 零命中（`.superpowers/sdd` 保留面除外）
  - engine tests 中 `.superpowers/cdd` 零命中（standalone 相关与 sdd 语义位置除外）
  - 根 `.gitignore` 含 `.osuperpowers`；smoke-cdd slug 派生与 engine workspaceSlug 同规则；7 文件路径文本迁新根（grep 复核，sdd 分裂形/standalone 预留位除外）
  - engine suite PASS；emit 无 drift；validate 13 块 ALL PASS；grep 复核 0（豁免面除外）
  - T1 变更面单提交落盘（conventional）

### Task 2: standalone 收缩 — `cdd base-branch` 单调 `--plan`

- **Objective**: standalone 收缩 — `cdd base-branch` 单调 `--plan`（STANDALONE_ROOT + standalone 分支删除、`--scope`/`--slug` flag 删除、相关用例裁剪）
- **DependsOn**: none
- **AtomicWith**: none

- **Consumes**: Task 1（engine 已落新根；base-branch CDD 侧随单源自动新根）

- **Produces**: `cdd base-branch set|get` 仅 `--plan <path>` 目标；`STANDALONE_ROOT` 常量不存在；`--scope`/`--slug` flag 不存在

- **Files**: packages/cdd-engine/lib/cli/base-branch.mjs, packages/cdd-engine/lib/cli/parse.mjs, packages/cdd-engine/tests/base-branch.test.mjs, packages/osuperpowers/skills/finishing/SKILL.md, packages/osuperpowers/skills/cli-driven-development/docs/base-branch.md, packages/osuperpowers/skills/cli-driven-development/SKILL.md

- **Steps**:
  1. 删 engine standalone 代码面：`lib/cli/base-branch.mjs` 删 line 14-16 STANDALONE_ROOT 常量与注释、`resolveBaseBranchWorkspace` 删 standalone 分支（`opts.scope != null || opts.slug != null` 块内 scope/slug 处理、gitToplevel 分支），保留 plan 目标 + 「均缺 → 明确报错 exit 2」；文件头注释改为「`cdd base-branch set/get` 纯 artifact 命令——唯一目标 `--plan <path>` → resolveWorkspace(plan)」；顺带删 line 7 `path` 与 line 11 `gitToplevel` 两个 dead imports（standalone 分支删除后唯一调用/使用点消失）；`lib/cli/parse.mjs` line 23 SUBCOMMAND_USAGE base-branch 行 → `usage: cdd base-branch <set|get> --plan <path> [set: --base <branch> --source <source>] [--force]`、line 107-109/112 注释与 description 去 standalone 措辞、line 119-120 set 与 line 127-128 get 的 `--scope`/`--slug` 四个 option 删除 — checkable: `STANDALONE_ROOT` 常量不存在；`--scope`/`--slug` flag 不存在；base-branch usage 单调 `--plan <path>`
  2. 更新 base-branch.test.mjs 删除 standalone 用例：删 `set --scope standalone --slug → <gitRoot>/.superpowers/standalone/<slug>/base-branch.json`、`set standalone --force → 覆盖成功`、`standalone 组缺 --base/--source → exit 非零`、`flag 边界：--plan 与 --scope/--slug 并存 → 互斥 exit 2`、`--scope 非 standalone → exit 2`、`get --scope standalone --slug 读回 JSON 往返` 全部用例；`缺 target（CDD 无 plan / 无 scope）` 改写为「缺 --plan → exit 非零 + 明确报『CDD 需 --plan』」；头部双 scope 注释 line 4 同步收敛为单一 `--plan` 落点描述；保留并验证 CDD `--plan` 单调路径全部通过（set 幂等/force 矩阵、get 往返、缺失/schema 非法、坏 flag usage 行） — checkable: base-branch.test.mjs 全绿且 standalone 用例零残留（CDD `--plan` 单调路径全通过）
  3. 更新 finishing read-base + base-branch.md + dual-scope 措辞 sweep：`finishing/SKILL.md:50` read-base 改为「有 cdd artifact → 读 `.osuperpowers/cdd/<slug>/base-branch.json`；**无 artifact（手工 feature 分支、无 plan）→ 推断 base（①plan field ②branch upstream ③conversation context ④ask user）后直接传给 present-menu，不落盘任何 base-branch.json**」；`:51` Read 段 `.superpowers/{cdd,standalone}` → `.osuperpowers/cdd`；`cli-driven-development/SKILL.md:55,56` determine-base 去除「dual-scope slug resolution」措辞——双 scope 概念已删除，收敛为「单一 `--plan` 落点（engine 经 resolveWorkspace 派生 slug）」；`cli-driven-development/docs/base-branch.md` artifact 路径 `.superpowers/<scope>/<slug>/base-branch.json` → `.osuperpowers/cdd/<slug>/base-branch.json`、scope resolution 表删 standalone 行、standalone-slug sanitize 段整段删除、flag 表收敛为 CDD `--plan` 单调、flag 边界改写「missing --plan → 明确报错」 — checkable: 机制位置零 `.superpowers/standalone`（grep）；finishing/base-branch.md 无 standalone 措辞
  4. 跑 engine 套件 + emit + validate：`pnpm --filter @oscaner-skills/cdd-engine test` → `pnpm run emit` → `node scripts/run.mjs validate`；grep 复核 engine bin/lib + skills 机制位置零 `.superpowers/standalone` — checkable: engine suite PASS；emit 无 drift；validate 13 块 ALL PASS
  5. Commit：`git add packages/cdd-engine packages/osuperpowers`；`git commit -m "refactor(cdd-engine): standalone scope 整体移除 — cdd base-branch 单调 --plan (STANDALONE_ROOT/--scope/--slug 删除)"` — checkable: T2 变更面单提交落盘（conventional）

- **Acceptance**:
  - `STANDALONE_ROOT` 常量不存在；`--scope`/`--slug` flag 不存在；base-branch usage 单调 `--plan <path>`
  - base-branch.test.mjs 全绿且 standalone 用例零残留（CDD `--plan` 单调路径全通过）
  - 机制位置零 `.superpowers/standalone`（grep）；finishing/base-branch.md 无 standalone 措辞
  - engine suite PASS；emit 无 drift；validate 13 块 ALL PASS
  - T2 变更面单提交落盘（conventional）

### Task 3: 残留守卫 — residue.mjs stale-lexicon 防回渗

- **Objective**: 残留守卫 — residue.mjs stale-lexicon 新增两条（`.superpowers/cdd` + `.superpowers/standalone`）防回渗（`.superpowers/sdd` 保留面不设守卫）
- **DependsOn**: none
- **AtomicWith**: none

- **Consumes**: Task 1（`.superpowers/cdd` 已从机制位置清空）、Task 2（`.superpowers/standalone` 已从机制位置清空）

- **Produces**: 新增两条 stale-lexicon 守卫，机制位置零豁免；`.superpowers/sdd` 不设守卫

- **Files**: scripts/validate/residue.mjs, scripts/validate/residue.test.mjs

- **Steps**:
  1. residue.mjs 新增守卫条目：`STALE_LEXICON_CHECKS` 数组追加两条（复用 `ALL_MECH_POSITIONS`）——`{ label: "old runtime root .superpowers/cdd", re: /\.superpowers\/cdd/, scope: ALL_MECH_POSITIONS }` + `{ label: "deleted standalone root", re: /\.superpowers\/standalone/, scope: ALL_MECH_POSITIONS }`；既有 `flat docs-review root 回退`（`/\.superpowers\/docs-review/`, `CDD_ENGINE_BIN`）条目保留不动 — checkable: `STALE_LEXICON_CHECKS` 含新两条（label + re 逐字断言）
  2. residue.test.mjs 翻转负向断言 + 新增：`hasHit([".superpowers/cdd/foo/spec-review-1.json"])` 由 `toBe(false)` 翻为 `toBe(true)`（新 `<cdd>` 守卫命中）+ `hasHit([".superpowers/sdd/foo/progress.json"])` → `toBe(false)`（sdd 保留面放行）+ 新增 `.superpowers/standalone/x/base-branch.json` → `toBe(true)`（standalone 守卫命中） — checkable: residue.test.mjs 23 tests 全绿（含新断言）
  3. 跑 residue 测试 + 全量 validate：`node --test scripts/validate/residue.test.mjs`（23 tests 全绿，含新断言）；`node scripts/run.mjs validate`（5c 的 checkStaleLexicon 零命中——机制位置已迁移清空） — checkable: residue 23 tests PASS；validate 全绿（5c 零命中）
  4. Commit：`git add scripts/validate/residue.mjs scripts/validate/residue.test.mjs`；`git commit -m "feat(validate): stale-lexicon guard — .superpowers/cdd + .superpowers/standalone 防回渗 (sdd 放行)"` — checkable: T3 变更面单提交落盘（conventional）

- **Acceptance**:
  - `STALE_LEXICON_CHECKS` 含新两条（label + re 逐字断言）
  - residue.test.mjs 23 tests 全绿（含新断言）
  - residue 23 tests PASS；validate 全绿（5c 零命中）
  - T3 变更面单提交落盘（conventional）

### Task 4: 存量处置 — 旧根死档全量删除

- **Objective**: 存量处置 — 旧根死档全量删除（`.superpowers/cdd/*` 与 `.superpowers/docs-review/` 运行时删除，gitignored 无 git 痕迹）
- **DependsOn**: none
- **AtomicWith**: none

- **Consumes**: Task 1（flip 已 commit，resolveWorkspace 全走新根——删除时序约束满足）

- **Produces**: `.superpowers/` 下仅存 `sdd/`；engine 运行期零 `.superpowers` 写入

- **Files**: .superpowers/cdd/*, .superpowers/docs-review/

- **Steps**:
  1. 确认前置时序：git log 确认 Task 1 的 flip commit 已提交（`handoff-namespace.json#workspaceRoot = ".osuperpowers/cdd"` 生效）；前置不满足 → 停止，先回 Task 1 — checkable: Task 1 flip commit 在 git log 中
  2. 删除旧根死档：`rm -rf .superpowers/cdd .superpowers/docs-review`（`.superpowers/cdd/` 整树含 19 workspace + lifecycle.json + smoke + .gitignore + `.archive-*`；`.superpowers/docs-review/` 整树；`.superpowers/sdd/` 保留） — checkable: `.superpowers/cdd` 与 `.superpowers/docs-review` 不存在；`.superpowers/sdd/` 保留
  3. 验证存量面：`ls .superpowers/` 仅 `sdd/`；`ls .superpowers/sdd/` 保留（`.gitignore` `*` 仍在）；`git status` 干净（全部 gitignored）；`node scripts/run.mjs smoke-cdd` 重建 smoke 于 `.osuperpowers/cdd/smoke/`（新根）——含 branch-review-<base7>..<head7>-r1.json（smoke 在 CDD_DRY_RUN 下唯一写入的 branch-review handoff；无 plan-review-1.json） — checkable: `.superpowers/` 仅 `sdd/`；`.osuperpowers/cdd/smoke/` 由 smoke-cdd 产出（非空目录 + branch-review handoff）；git status clean
  4. 零 `.superpowers` 写入验证（dry-run，不派发活 agent）：`CDD_DRY_RUN=1 CLAUDE_CODE_SESSION_ID=1 node packages/cdd-engine/bin/cdd.mjs review --type spec --spec docs/osuperpowers/specs/2026-09-13-osuperpowers-overhaul-p1-design.md` —— **exit 0 静默返回**（spec/plan 型 dry-run 经 run-docs.mjs `if (dryRun)` 早返回，不打印 4 行 H1——仅 implement/task-review/fix/branch-review 四型才打印），仅验证：落点解析至 `.osuperpowers/cdd/<slug>/`（新根）+ 运行期零 `.superpowers` 写入 + stdout 无 `.superpowers` 路径段；不产生新 review round；engine 运行期零 `.superpowers` 写入由构造保证（resolveWorkspace 全走新根） — checkable: dry-run exit 0 静默返回；运行期零 `.superpowers` 写入（构造保证）；stdout 无 `.superpowers` 路径段
  5. 全量 validate：`node scripts/run.mjs validate` → 13 块全绿 — checkable: validate 13 块 ALL PASS
  6. Commit（无 git 增量时仅确认状态）：删除动作本身无 git 痕迹（gitignored）；本 Task 无新增 commit 时验证 `git status --short` 空（runtime 删除仅文件系统）即完成；若 plan/spec 文档有同步改动则一并 commit — checkable: git status clean（删除面 runtime-only，零 git 增量）

- **Acceptance**:
  - Task 1 flip commit 在 git log 中
  - `.superpowers/cdd` 与 `.superpowers/docs-review` 不存在；`.superpowers/sdd/` 保留
  - `.superpowers/` 仅 `sdd/`；`.osuperpowers/cdd/smoke/` 由 smoke-cdd 产出（非空目录 + branch-review handoff）；git status clean
  - dry-run exit 0 静默返回；运行期零 `.superpowers` 写入（构造保证）；stdout 无 `.superpowers` 路径段
  - validate 13 块 ALL PASS
  - git status clean（删除面 runtime-only，零 git 增量）

### Task 5: changeset + 全量收口

- **Objective**: changeset + 全量收口（`@oscaner-skills/cdd-engine` minor changeset 落盘；validate 13 块 + emit:check 收口）
- **DependsOn**: none
- **AtomicWith**: none

- **Consumes**: Task 1-4（全量落地）

- **Produces**: changeset（`@oscaner-skills/cdd-engine` minor）；osuperpowers 本次不 bump

- **Files**: .changeset/<slug>.md

- **Steps**:
  1. 创建 changeset：`pnpm run changeset`（contents = `"@oscaner-skills/cdd-engine": minor`，正文 = P1 runtime 布局：workspace 根 `.superpowers/cdd` → `.osuperpowers/cdd`（handoff/progress/lifecycle/base-branch/report-target 全随迁）；standalone scope 整体移除（cdd base-branch 单调 --plan）；旧根 dead-workspace 清理）；若 `pnpm run changeset` 交互不可用（无人值守 shell 阻塞 stdin），手动写 `.changeset/<kebab-slug>.md`（同内容）——changeset 文件必须 POSIX 结尾换行（`\n` 终止；缺失会触发 `No newline at end of file` nit） — checkable: `.changeset/` 含 P1 changeset（cdd-engine minor，正文含 P1 runtime 布局叙述，POSIX `\n` 结尾）
  2. 全量验证收口：`node scripts/run.mjs validate`（13 块全绿）+ `pnpm run emit:check`（无 drift） — checkable: validate 13 块 ALL PASS；emit:check 无 drift
  3. Commit：`git add .changeset`；`git commit -m "chore(cdd-engine): changeset — P1 runtime 布局单根化 + standalone 移除 (minor)"` — checkable: T5 变更面单提交落盘（conventional）

- **Acceptance**:
  - `.changeset/` 含 P1 changeset（cdd-engine minor，正文含 P1 runtime 布局叙述，POSIX `\n` 结尾）
  - validate 13 块 ALL PASS；emit:check 无 drift
  - T5 变更面单提交落盘（conventional）
