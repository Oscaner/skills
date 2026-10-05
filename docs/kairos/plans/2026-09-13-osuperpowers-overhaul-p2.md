# osuperpowers 架构重构 P2 — docs 根落点迁移实施计划

**Spec:** [2026-09-13-osuperpowers-overhaul-p2-design.md](docs/kairos/specs/2026-09-13-osuperpowers-overhaul-p2-design.md)

- **Parent program**: [2026-09-13-osuperpowers-overhaul-overall.md v1.5](../specs/2026-09-13-osuperpowers-overhaul-overall.md)
- **Depends on**: P1 shipped（runtime 布局 `.osuperpowers/cdd` + standalone 移除，2026-09-14）
- **Base**: develop

- **docs 根纠正**: 目标落点已由 `osuperpowers/{specs,plans}` 纠正为 **`docs/osuperpowers/{specs,plans}`**（`docs/maintainers/` 同处 `docs/` 根）。**T1/T2 已按旧根执行完毕，并由本次纠正重落**（`git mv osuperpowers docs/osuperpowers` + 全路径面重写 + validator 常量改 `docs`+`osuperpowers`）；**T3–T6 按本文件现行路径执行**——T3 的 `rootFromDocPath` marker 即 `["docs","osuperpowers"]`（+ `specs`|`plans`）。
- **纠正 commit = `fd6f003`**: 44 rename + validator 常量 + grep-sweep 过滤器重指向；其缺陷面由 T2 task-review-1 findings 驱动修正（7 处 `packages/osuperpowers/*` over-match 已还原为包路径；「`docs/` 仅 maintainers」6 处陈旧措辞、maintainer-doc 相对链接、§2.1 例外注记字面均已同步）。

## Constraints


从 overall + P2 design copy：
- `workspaceRoot` 单源 `.osuperpowers/cdd`（`packages/cdd-engine/templates/handoff-namespace.json`）为 P1 定案，本 phase 不动
- 记录豁免集（§2.7 模式）：`docs/osuperpowers/{specs,plans}/2026-09-13-osuperpowers-overhaul*` + `.changeset/`；其余 live tree 零 `docs/superpowers`
- 39 文件迁移后 `docs/superpowers/` 不存在；`docs/` = `maintainers/` + `osuperpowers/`；`docs/osuperpowers/specs/` = 24、`docs/osuperpowers/plans/` = 20（P2 完成时点）
- 所有改动须过 `pnpm run validate`（13 块）+ `pnpm run emit:check` 无 drift；**emit 唯一入口 = 仓库根 `pnpm run emit`**（`packages/osuperpowers/package.json` 无 scripts 字段）
- changeset：`@oscaner-skills/cdd-engine` minor；osuperpowers 本次不 bump（P4 再计）
- vendored 子模块不可改（`vendors/mattpocock-skills/.../to-tickets/` 物理目录保留，无生产引用即无残留）
- **破坏性重构已授权**：drop `rootFromDocPath` 旧 marker、删 `docs/superpowers/` 目录、tickets 死引用全移除


### Task 1: docs 根迁移 — 39 文件 git-mv + 54 次内容重写 + 空目录清理

- **Objective**: docs 根迁移 — 39 文件 git-mv + 54 次内容重写 + 空目录清理（docs 单根收敛至 `docs/osuperpowers/{specs,plans}`）

- **Consumes**: P2 design §2.1 迁移面

- **Produces**: docs 单根 `docs/osuperpowers/`（specs|plans 两平面，24/20 文件）
- **Produces**: 历史 39 文件内部路径引用指向新根
- **Produces**: `docs/superpowers/` 不存在

- **Files**: docs/superpowers/specs/*.md, docs/superpowers/plans/*.md, docs/superpowers/

- **Steps**:
  1. 先重写内容（旧目录内，避免误伤 in-flight 豁免记录）：**必须在 git mv 之前**在旧目录内执行——`grep -rl` 若在迁移后按 `docs/osuperpowers/` 扫，会命中须豁免的 in-flight 文档（overall / p1-design / p1-plan / p2-design / 本 plan）。`grep -rl "docs/superpowers" docs/superpowers/ | xargs sed -i '' 's#docs/superpowers#docs/osuperpowers#g'`；`grep -r "docs/superpowers" docs/superpowers/ | wc -l` 期望 0 — checkable: 21 个文件被改写（54 次出现 → 0）。例外注记（design §2.1）：`plans/2026-09-04-cdd-engine-overhaul-p1.md:1084,1539` 与 `plans/2026-09-05-cdd-engine-overhaul-p2.md:580` 为历史代码 literal（断言/命令），机械重写后作为迁移前描述——同批处理，无需特殊分支
  2. git mv 39 文件：`git mv docs/superpowers/specs/*.md docs/osuperpowers/specs/`；`git mv docs/superpowers/plans/*.md docs/osuperpowers/plans/` — checkable: 39 个 rename（21 含内容修改）；目标目录无同名冲突（in-flight 文档命名 `2026-09-13-osuperpowers-overhaul*` 与新迁入历史文件名不同日期前缀）
  3. 清空目录 + 计数验证：`find docs/superpowers -type f` 期望无输出（已移空）；`rm -rf docs/superpowers`；`ls docs/` 期望 maintainers + osuperpowers；`ls docs/osuperpowers/specs/*.md | wc -l` 期望 24（21 历史 + overall + p1-design + p2-design）；`ls docs/osuperpowers/plans/*.md | wc -l` 期望 20（18 历史 + p1 + p2 plan）；`git status --short` 期望 39 rename（21 显示 modified）——前置条件满足时无其他条目 — checkable: `docs/superpowers/` 不存在；`docs/` = maintainers + osuperpowers；specs/plans 计数 24/20；git status 39 rename
  4. plan `**Spec:**` 链接解析验证（行为性）：`for f in docs/osuperpowers/plans/*.md; do t=$(grep -m1 -o '(docs/osuperpowers/specs/[^)]*)' "$f" | tr -d '()'); if [ -n "$t" ] && [ ! -f "$t" ]; then echo "UNRESOLVED: $f → $t"; fi; done` — checkable: 无 `UNRESOLVED` 行（历史 plan 的 `**Spec:**` 链接重写后指向迁移后 spec；P1 plan 用相对 `../specs/` 不匹配该模式，跳过属预期）
  5. 跑 validate：`node scripts/run.mjs validate` — checkable: 全绿。**block 12（overall consistency）本轮预期打印 `SKIP — no docs/superpowers/specs`**——validator 常量仍指旧根（Task 2 收敛为 `docs/osuperpowers/`）；此为本 task 的预期过渡态非缺陷；其余 12 块 + emit freshness 全 OK
  6. Commit：`git add -A docs/`；`git commit -m "refactor(docs): specs/plans 单根迁移 — docs/superpowers → docs/osuperpowers（39 文件 git-mv + 54 处内部路径重写）"`。**前置条件**：在途程序文档（overall v1.6 / p2-design / p2-plan）须已各自 commit（brainstorming 的 `commit-spec` + writing-plans 的 `commit-plan` gate），工作区对 `docs/osuperpowers/` 干净后再执行——否则 `git add -A docs/` 会把无关在途改动卷入迁移 commit — checkable: T1 变更面单提交落盘（conventional）

- **Acceptance**:
  - 21 个文件被改写（54 次出现 → 0）。例外注记（design §2.1）：`plans/2026-09-04-cdd-engine-overhaul-p1.md:1084,1539` 与 `plans/2026-09-05-cdd-engine-overhaul-p2.md:580` 为历史代码 literal（断言/命令），机械重写后作为迁移前描述——同批处理，无需特殊分支
  - 39 个 rename（21 含内容修改）；目标目录无同名冲突（in-flight 文档命名 `2026-09-13-osuperpowers-overhaul*` 与新迁入历史文件名不同日期前缀）
  - `docs/superpowers/` 不存在；`docs/` = maintainers + osuperpowers；specs/plans 计数 24/20；git status 39 rename
  - 无 `UNRESOLVED` 行（历史 plan 的 `**Spec:**` 链接重写后指向迁移后 spec；P1 plan 用相对 `../specs/` 不匹配该模式，跳过属预期）
  - 全绿。**block 12（overall consistency）本轮预期打印 `SKIP — no docs/superpowers/specs`**——validator 常量仍指旧根（Task 2 收敛为 `docs/osuperpowers/`）；此为本 task 的预期过渡态非缺陷；其余 12 块 + emit freshness 全 OK
  - T1 变更面单提交落盘（conventional）

### Task 2: validator 单根收敛 + 新 overall guard 归一

- **Objective**: validator 单根收敛 + 新 overall guard 归一（`SPECS_DIR`/`PLANS_DIR` 单根 + 新 overall canonical 4-table 列归一）

- **Consumes**: Task 1（docs 已落新根）

- **Produces**: `SPECS_DIR`/`PLANS_DIR` = `docs/osuperpowers/`（specs|plans）
- **Produces**: 新 overall 满足 canonical 4-table 守卫
- **Produces**: block 12 恢复启用（3 canonical OK + 1 skip）

- **Files**: scripts/validate/overall-consistency.mjs, docs/osuperpowers/specs/2026-09-13-osuperpowers-overhaul-overall.md

- **Steps**:
  1. 收敛 validator 常量：`scripts/validate/overall-consistency.mjs` 的 `SPECS_DIR` = `join(process.cwd(), "docs", "osuperpowers", "specs")`、`PLANS_DIR` = `join(process.cwd(), "docs", "osuperpowers", "plans")`；line 32 注释 `Standalone (…) scans docs/superpowers/specs/*-overall.md` → `docs/osuperpowers/specs/*-overall.md`；line 461 `SKIP` 文案 `"SKIP — no docs/superpowers/specs"` → `"SKIP — no docs/osuperpowers/specs"` — checkable: `SPECS_DIR`/`PLANS_DIR` 常量 = `docs/osuperpowers/`（specs|plans）两段（grep）
  2. 新 overall canonical 列归一（v1.6 → v1.7）：Phase inventory P1 行 `Implementation plan` 列 `**Done**（2026-09-14 shipped，plan v1.0 5-tasks 全闭环 + branch-review APPROVED）` → 裸 `Done`（canonical 形——`claimKey` 取 `Done`，列须字面等价；详情已存 change-history v1.5）；header `- **Version**: v1.6 · 2026-09-14` → `v1.7 · 2026-09-14`；change-history 追加 v1.7 行（**不得含 `Pending` + `→` 组合**，避免生成伪 claim）。**第二项归一：v1.3 行 claim 句切分**——实测 `checkBackfillClaims` 仍抛 `① 正向 design: P3 Design spec 列需含自身 P1-design token（实际 "[Pending]"）`：v1.3 行末句未被 `；` 切分，`extractClaimRows` 抽出 design claim `P1-design` 而 `phaseIdsIn` 从「P1→P3」同时收进 P3 → P3 被要求命中同一 token（实际 `[Pending]`）→ 抛错。改法：在 ` + Dependency graph` 前插 `；`，使该 claim 句只含 P1 — checkable: 新 overall 过 overall-consistency 四表守卫（block 12 恢复）；change-history 无 `Pending` + `→` 组合
  3. 跑 validator + fixture 测试：`node scripts/run.mjs validate`（block 12 输出 3/4 canonical ALL PASS：skip 2026-08-31-post-dogfood-bugfixes (non-canonical) · OK 2026-09-04-cdd-engine-overhaul (6 phases) · OK 2026-09-10-session-report-246 (7 phases) · OK 2026-09-13-osuperpowers-overhaul (6 phases)——**新 overall 首次入守卫且通过**，design §2.3 / AC6）；`pnpm exec vitest run scripts/validate/overall-consistency.test.mjs`（fixtures 注入 roots，26 tests 全绿） — checkable: block 12 `3/4 canonical` ALL PASS；fixtures 26 tests 全绿
  4. Commit：`git add scripts/validate/overall-consistency.mjs docs/osuperpowers/specs/2026-09-13-osuperpowers-overhaul-overall.md`；`git commit -m "refactor(validate): overall-consistency 单根 docs/osuperpowers/ + 新 overall canonical 列归一（v1.7）"` — checkable: T2 变更面单提交落盘（conventional）

- **Acceptance**:
  - `SPECS_DIR`/`PLANS_DIR` 常量 = `docs/osuperpowers/`（specs|plans）两段（grep）
  - 新 overall 过 overall-consistency 四表守卫（block 12 恢复）；change-history 无 `Pending` + `→` 组合
  - block 12 `3/4 canonical` ALL PASS；fixtures 26 tests 全绿
  - T2 变更面单提交落盘（conventional）

### Task 3: engine — `rootFromDocPath` 新布局识别 + 夹具迁移

- **Objective**: engine `rootFromDocPath` 新布局识别 + 夹具迁移（marker 翻新为 `["docs","osuperpowers"]` 严格配对 + 假路径夹具全迁移）

- **Consumes**: Task 1（新根已落）

- **Produces**: `rootFromDocPath` 识别 `<root>/docs/osuperpowers/`（specs|plans）布局
- **Produces**: 旧 `docs/superpowers` marker 不存在

- **Files**: packages/cdd-engine/lib/handoff/naming.mjs, packages/cdd-engine/tests/handoff-naming.test.mjs, packages/cdd-engine/tests/cdd.test.mjs, packages/cdd-engine/tests/docs-runner.test.mjs

- **Steps**:
  1. 翻新 marker：`naming.mjs` `rootFromDocPath`（line 128-137）——段对 `["docs","superpowers"]` → **`["docs", "osuperpowers"]`（+ `specs`|`plans`）**，严格配对（`osuperpowers` 后须随 `specs`/`plans`）——运行根 `.osuperpowers/cdd/…` 的 `.osuperpowers` 段带前导点 ≠ `osuperpowers`，段相等性天然不串；同步 line 119-121 `resolveWorkspace` 头注释：canonical 布局标记 `docs/superpowers/` → `docs/osuperpowers/{specs,plans}/` — checkable: `rootFromDocPath` 段对 = `["docs","osuperpowers"]`（+ `specs`|`plans` 严格配对）
  2. 迁移 3 个夹具文件假路径 + AC2 反射例：`/repo/root/docs/superpowers/{specs,plans}/…` → `/repo/root/docs/osuperpowers/{specs,plans}/…`（`handoff-naming.test.mjs` 用 `/repo/…` 无 `root`）。**片段形态须与 canonical 布局逐段一致**——`/repo/root/docs/osuperpowers/specs/foo-design.md` 经段对 marker → `/repo/root`（切点在 `docs` 段之前）；`cdd.test.mjs` **四处全改**——`:342`（runReview 的 `spec:`）`/:368`（runFix 的 `spec:`）经 `review.mjs:75` / `fix.mjs:61` 走 `resolveWorkspace(doc)`，假路径无 git → 唯一回落 `rootFromDocPath`，漏改则新 marker 返回 null、`resolveWorkspace` 抛 `not in a git repo` 两用例必红；期望值 `/repo/root/.osuperpowers/cdd/foo` 不变。`docs-runner.test.mjs:159` 断言精确化——workspace 路径含 `osuperpowers` 子串，裸断言 `not.toContain("docs/superpowers")` 会误命中：`expect(callOpts.cwd).not.toContain("/docs/osuperpowers/specs")`。**AC2 反射例（运行根不误匹配）**——`expect(() => resolveWorkspace("/repo/.osuperpowers/cdd/x/review-1.json")).toThrow(/not in a git repo/)` — checkable: 夹具假路径迁移后 `handoff-naming` / `cdd` / `docs-runner` 新布局用例全绿；AC2 反射例断言 `/repo/.osuperpowers/…` 运行根不被识别为 docs 根
  3. 跑 engine 套件：`pnpm --filter @oscaner-skills/cdd-engine test` — checkable: 371 tests 全绿（`handoff-naming` / `cdd` / `docs-runner` 新布局 fixture + rootFromDocPath 新 marker）
  4. Commit：`git add packages/cdd-engine`；`git commit -m "refactor(cdd-engine): rootFromDocPath 识别 docs/osuperpowers/{specs,plans} 布局（drop docs/superpowers 旧 marker）"` — checkable: T3 变更面单提交落盘（conventional）

- **Acceptance**:
  - `rootFromDocPath` 段对 = `["docs","osuperpowers"]`（+ `specs`|`plans` 严格配对）
  - 夹具假路径迁移后 `handoff-naming` / `cdd` / `docs-runner` 新布局用例全绿；AC2 反射例断言 `/repo/.osuperpowers/…` 运行根不被识别为 docs 根
  - 371 tests 全绿（`handoff-naming` / `cdd` / `docs-runner` 新布局 fixture + rootFromDocPath 新 marker）
  - T3 变更面单提交落盘（conventional）

### Task 4: active 约定文档路径同步 + tickets 死引用移除 + emit

- **Objective**: active 约定文档路径同步 + tickets 死引用移除 + emit（零 `docs/superpowers` + 零 `ticket`/`tickets` 引用）

- **Consumes**: Task 1-3

- **Produces**: active 约定文档零 `docs/superpowers`
- **Produces**: tickets 工作流/委托/模板引用全零（vendored 内容清点除外）

- **Files**: packages/osuperpowers/skills/writing-plans/SKILL.md, packages/osuperpowers/skills/brainstorming/SKILL.md, packages/osuperpowers/skills/brainstorming/docs/overall-spec-template.md, packages/osuperpowers/skills/report-issue/templates/finding-meta.json, packages/osuperpowers/README.md, CLAUDE.md, README.md, README.zh-CN.md, docs/maintainers/osuperpowers-plugin.md, scripts/release/publish-vendor.test.mjs

- **Steps**:
  1. skills / template / CLI 文档路径同步：`writing-plans/SKILL.md:34` `docs/superpowers/plans/…` → `docs/osuperpowers/plans/…`（含 spec-link `(docs/superpowers/specs/<name>-design.md)`）；`brainstorming/SKILL.md:67,68` Do + Read 两段 `docs/superpowers/specs/*-overall.md` → `docs/osuperpowers/specs/*-overall.md`；`brainstorming/docs/overall-spec-template.md:36` `docs/superpowers/` → `docs/osuperpowers/`；`finding-meta.json:286` placeholder → `Overall spec: docs/osuperpowers/specs/2026-09-04-cdd-engine-overhaul-overall.md`；`CLAUDE.md:87` Strategy B `docs/superpowers/{specs,plans}/*.md` → `docs/osuperpowers/{specs,plans}/*.md` — checkable: 四处路径文本迁新根（grep）
  2. tickets 死引用移除（10 处）：`overall-spec-template.md:43` 删整行 `| Phase tickets | \`tickets/…-tickets.md\` |`；`osuperpowers/README.md:9` 删示例项「ticket publish redirection」（保留其余示例）、`:17` 删从句「; tickets to `docs/superpowers/tickets/`」；`docs/maintainers/osuperpowers-plugin.md:24` ① 删除 canonical 示例（该 Rule 及 `/to-tickets` 委托当前不存在，partial-delegate 描述保留通用措辞）② `(b)` delegates 列表去 `to-tickets`（`grilling, tdd, to-tickets` → `grilling, tdd`）、`:202` SDD/ticket 段去 ticket 框架改**逐 unit 执行纪律**（approved plan 内，plan 指定 commit 的 unit 完成后直接 commit 不追问；plan 未指定则收尾后一次询问）、`:204` `do not stop after each ticket to ask` → `do not stop after each unit to ask`；`publish-vendor.test.mjs:163` 删 fixture 行 `"./skills/to-tickets"`（合成清单 21 → 20 项）+ **连带阈值同步**——`:373` `expect(pi.skills.length >= 21)` 与 `:444` `expect(pkg.pi.skills.length >= 21)` 改 `>= 20`（实测删行后 `2 failed | 43 passed`，成员数阈值确实依赖该 fixture 集合，不连带改则 validate 13 块全绿不可达）；`README.md:27` vendored 表行去 `to-tickets`；`README.zh-CN.md:27` 精准工具行去 `to-tickets`；`CLAUDE.md:21` `Engineering precision skills (grilling, tdd, to-tickets, research).` → `(grilling, tdd, research).` — checkable: 零 `ticket`/`tickets` 引用（vendored 物理目录 + 在途程序文档的移除叙述豁免）；publish-vendor.test.mjs 阈值 `>= 20` 同步绿
  3. maintainer doc conventions 节路径 + 相对链接：`osuperpowers-plugin.md:38-43` 标题 `## \`docs/superpowers/\` conventions` → `## \`docs/osuperpowers/\` conventions`；链接 `[docs/superpowers/specs/](../../docs/superpowers/specs/)` → `[docs/osuperpowers/specs/](../osuperpowers/specs/)`（`docs/maintainers/` **上溯一级**）；plans 行同 — checkable: maintainer doc 约定节 + 相对链接迁新根（可解析）
  4. emit + validate + grep 复核：`pnpm run emit`（根入口；skills/templates 改动再生 `.agents/` + `.github/ISSUE_TEMPLATE/session_report.yml`）→ `pnpm run emit:check`（drift 0）→ `node scripts/run.mjs validate`（13 块全绿）；grep 复核 `grep -rn "docs/superpowers" packages/osuperpowers/skills packages/osuperpowers/README.md docs/maintainers CLAUDE.md README.md` 期望 0 + `grep -rni "ticket" packages/osuperpowers/skills packages/osuperpowers/README.md docs/maintainers README.md README.zh-CN.md CLAUDE.md` 期望 0（10 处移除后全清） ——本 task 的**全仓 tickets 终态检查不在本 task**：`grep-sweep-regression.test.mjs:14,72` 仍含 `grep -v "docs/superpowers/tickets/"` 字面过滤器（Task 5 Step 3 才删）——全仓口径留至 Task 6 Step 2 — checkable: emit 无 drift；validate 13 块全绿；两 grep 复核 0（豁免面除外）
  5. Commit：`git add packages/osuperpowers CLAUDE.md README.md README.zh-CN.md docs/maintainers scripts/release/publish-vendor.test.mjs .github/ISSUE_TEMPLATE/session_report.yml`；`git status --short` 复核仅列预期文件；`git commit -m "docs(osuperpowers): docs 根路径同步 docs/osuperpowers/ + tickets 死引用全移除（10 处）+ emit"`（emit 派生物 `.agents/` + `ISSUE_TEMPLATE/session_report.yml` 与 canonical 同一次落账） — checkable: T4 变更面单提交落盘（conventional）

- **Acceptance**:
  - 四处路径文本迁新根（grep）
  - 零 `ticket`/`tickets` 引用（vendored 物理目录 + 在途程序文档的移除叙述豁免）；publish-vendor.test.mjs 阈值 `>= 20` 同步绿
  - maintainer doc 约定节 + 相对链接迁新根（可解析）
  - emit 无 drift；validate 13 块全绿；两 grep 复核 0（豁免面除外）
  - T4 变更面单提交落盘（conventional）

### Task 5: residue 守卫 + grep-sweep 过滤收敛

- **Objective**: residue 守卫 + grep-sweep 过滤收敛（`docs/superpowers` stale-lexicon 守卫 + 过滤器重指向新根）

- **Consumes**: Task 1-4（机制 + active 面已清零——守卫在清零后接入）

- **Produces**: `docs/superpowers` stale-lexicon 守卫（机制位置零豁免）
- **Produces**: grep-sweep 过滤器重指向 `docs/osuperpowers/`

- **Files**: scripts/validate/residue.mjs, scripts/validate/residue.test.mjs, packages/osuperpowers/tests/grep-sweep-regression.test.mjs

- **Steps**:
  1. residue.mjs 新增守卫：`STALE_LEXICON_CHECKS` 追加 `{ label: "old docs root (pre-P2)", re: /docs\/superpowers/, scope: [...ALL_MECH_POSITIONS, ...DOC_SURFACE_TARGETS] }`——**label 不含路径字面、regex 以 `\/` 转义**（守卫本体不得把字面 `docs/superpowers` 写回 `scripts/`，否则 Task 6 全仓 grep 出第三类命中）；新增 `DOC_SURFACE_TARGETS` 常量 = `["CLAUDE.md", "README.md", "packages/osuperpowers/README.md", "docs/maintainers"]`（治理文件面——残留最可能回渗点）；`GATE_TARGETS` 与 `DOC_SURFACE_TARGETS` 有 2 项重叠（`docs/maintainers` / 根 `README.md`）——**刻意重叠**（两者服务不同语汇：gate 移除 vs 旧 docs 根），在 `GATE_TARGETS` 旁加注释声明；line 63 GATE 豁免注释同步 `docs/superpowers/` → `docs/osuperpowers/{specs,plans}`（历史文档新落点）；文件头 check 枚举注释追加 `the old docs root (pre-P2)`——本仓 stale-lexicon 以「注释即契约」维护，枚举须与 `STALE_LEXICON_CHECKS` 实现一致 — checkable: `STALE_LEXICON_CHECKS` 含 `old docs root (pre-P2)` 条目（label 无路径字面、re 转义）；`DOC_SURFACE_TARGETS` 导出存在；文件头枚举注释追加
  2. residue.test.mjs 断言 + 标题同步：line 129 `it()` 标题 → `（机制/文档表层零残留；docs/osuperpowers/{specs,plans} 历史文档 + CHANGELOG 豁免）`；新增命中/放行断言——**经字符串拼接构造**（测试同样不得写回字面）：`const OLD_DOCS_ROOT = "docs" + "/superpowers";`、`expect(hasHit([`${OLD_DOCS_ROOT}/specs/foo.md`])).toBe(true)`（新守卫命中）、`expect(hasHit(["docs/osuperpowers/specs/foo.md"])).toBe(false)`（新根放行） — checkable: residue.test.mjs 新命中/放行断言全绿
  3. grep-sweep 过滤器重指向 + tickets 死过滤删除：`grep-sweep-regression.test.mjs` 三处命令（line 14, 65, 72）的 `grep -v` 过滤器由 `docs/superpowers/{specs,plans,tickets}` **重指向 `docs/osuperpowers/{specs,plans,tickets}`**——docs 根纠正后历史文档落 `docs/osuperpowers/`，仍在 sweep scope 内，过滤器**不可删除**（否则 `executing-plans` / `subagent-driven-development` / `docs/cdd-reference` 各 sweep 立即非零命中，实测 17/17/1）；**另删 `tickets` 过滤器**——`docs/superpowers/tickets/` 与 `docs/osuperpowers/tickets/` 两代根下均无该目录（死过滤），且其字面 `tickets` 是 AC5「零 `ticket`/`tickets` 引用」下最后的非豁免命中（全仓实测除外） — checkable: 三处过滤器重指向 `docs/osuperpowers/`（grep-sweep 各 sweep 仍 0 命中）；`tickets` 过滤器删除
  4. 跑测试：`pnpm exec vitest run scripts/validate/residue.test.mjs`（全绿含新断言）+ `node scripts/run.mjs validate`（5b grep-sweep 各 sweep 仍 0 命中、5c stale-lexicon 零命中）+ `grep -rni "ticket"`（命中集 == 在途 2026-09-13-osuperpowers-overhaul* 文档集，grep-sweep 过滤器已重指向） — checkable: residue.test.mjs 全绿；validate 5b/5c 零命中；tickets grep 命中集 == 在途文档集
  5. Commit：`git add scripts/validate/residue.mjs scripts/validate/residue.test.mjs packages/osuperpowers/tests/grep-sweep-regression.test.mjs`；`git commit -m "feat(validate): docs/superpowers stale-lexicon 守卫 + grep-sweep 过滤器重指向"` — checkable: T5 变更面单提交落盘（conventional）

- **Acceptance**:
  - `STALE_LEXICON_CHECKS` 含 `old docs root (pre-P2)` 条目（label 无路径字面、re 转义）；`DOC_SURFACE_TARGETS` 导出存在；文件头枚举注释追加
  - residue.test.mjs 新命中/放行断言全绿
  - 三处过滤器重指向 `docs/osuperpowers/`（grep-sweep 各 sweep 仍 0 命中）；`tickets` 过滤器删除
  - residue.test.mjs 全绿；validate 5b/5c 零命中；tickets grep 命中集 == 在途文档集
  - T5 变更面单提交落盘（conventional）

### Task 6: changeset + 全量收口

- **Objective**: changeset + 全量收口（`@oscaner-skills/cdd-engine` minor changeset；残留 grep 口径校验；validate 13 块 + emit:check）

- **Consumes**: Task 1-5（全量落地）

- **Produces**: changeset（`@oscaner-skills/cdd-engine` minor）
- **Produces**: 残留命中集 == 豁免集

- **Files**: .changeset/p2-docs-root-migration.md

- **Steps**:
  1. 创建 changeset：`.changeset/p2-docs-root-migration.md`（`"@oscaner-skills/cdd-engine": minor`，正文 = P2 docs 根落点迁移：rootFromDocPath 识别 docs/osuperpowers/{specs,plans} 布局（drop docs/superpowers 旧 marker）；overall-consistency 单根收敛；docs/superpowers stale-lexicon 守卫）；文件须 POSIX `\n` 终止；`pnpm run changeset` 交互不可用时手动写（@changesets/cli 依次提示选包与 bump 类型，无人值守 shell 中阻塞 stdin） — checkable: `.changeset/p2-docs-root-migration.md` 存在（cdd-engine minor，POSIX `\n` 结尾）
  2. §2.7 残留 grep 口径校验：`grep -rn "docs/superpowers" docs/osuperpowers/` 命中集 == 在途 2026-09-13-osuperpowers-overhaul* 文件集；全仓 `grep -rn "docs/superpowers"`（exclude vendors/.git/node_modules/.osuperpowers/tmp/.agents）命中集 == 在途文档集 ∪ `.changeset/`；`grep -rni "ticket"`（同排除）命中集 == 在途文档集（移除叙述本身；无第三类）——`tmp/`（gitignored publish-vendor 副本来场）+ `.osuperpowers/`（运行时 handoff 引述面）显式排除 — checkable: 三条命令的命中文件级集合分别恰等于豁免集 ① / ①∪② / ticket 豁免集（无第三类命中）
  3. 全量验证收口：`node scripts/run.mjs validate`（13 块全绿，含 block 12 的 3/4 canonical）+ `pnpm run emit:check`（drift 0）+ `ls docs/`（maintainers + osuperpowers） — checkable: validate 13 块 ALL PASS；emit:check 无 drift；`docs/` = maintainers + osuperpowers
  4. Commit：`git add .changeset`；`git commit -m "chore(cdd-engine): changeset — P2 docs 根落点迁移 (minor)"` — checkable: T6 变更面单提交落盘（conventional）

- **Acceptance**:
  - `.changeset/p2-docs-root-migration.md` 存在（cdd-engine minor，POSIX `\n` 结尾）
  - 三条命令的命中文件级集合分别恰等于豁免集 ① / ①∪② / ticket 豁免集（无第三类命中）
  - validate 13 块 ALL PASS；emit:check 无 drift；`docs/` = maintainers + osuperpowers
  - T6 变更面单提交落盘（conventional）
