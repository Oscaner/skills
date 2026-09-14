# osuperpowers 架构重构 P2 — docs 根落点迁移实施计划

**Spec:** [2026-09-13-osuperpowers-overhaul-p2-design.md](docs/osuperpowers/specs/2026-09-13-osuperpowers-overhaul-p2-design.md)

**Goal:** docs 单根收敛——`docs/superpowers/{specs,plans}` 39 历史文件 git-mv → `docs/osuperpowers/{specs,plans}`（54 次内部路径引用重写），`rootFromDocPath` 识别新布局、validator 单 glob、residue 守卫防回渗、active 约定文档同步、tickets 死引用全移除。

**Architecture:** 迁移分两层——**数据层**（39 文件物理移动 + 机械字符串重写，保持跨文件链接与 validator 扫描面内在一致）与**机制层**（engine `rootFromDocPath` marker 翻新 + `overall-consistency` SPECS_DIR/PLANS_DIR 单根 + residue stale-lexicon 新守卫 + grep-sweep 过滤器重指向）。in-flight program 文档（`2026-09-13-osuperpowers-overhaul*`）作为迁移前因记录豁免（与 CHANGELOG 同性）；新 overall 首次进入 guard 面需 canonical 列归一（P1 plan 列 `**Done**（…）` → 裸 `Done`）。

**Tech Stack:** Node ESM (engine lib/tests + validate 脚本) · Vitest (engine + scripts suites) · tinyglobby · git mv/sed

> **docs 根纠正（2026-09-14 / overall v1.8，用户指令）**：目标落点已由 `osuperpowers/{specs,plans}` 纠正为 **`docs/osuperpowers/{specs,plans}`**（`docs/maintainers/` 同处 `docs/` 根）。**T1/T2 已按旧根执行完毕，并由本次纠正重落**（`git mv osuperpowers docs/osuperpowers` + 全路径面重写 + validator 常量改 `docs`+`osuperpowers`）；**T3–T6 按本文件现行路径执行**——T3 的 `rootFromDocPath` marker 即 `["docs","osuperpowers"]`（+ `specs`|`plans`）。
>
> **纠正 commit = `fd6f003`**（44 rename + validator 常量 + grep-sweep 过滤器重指向）；其缺陷面由 T2 task-review-1 findings 驱动修正（7 处 `packages/osuperpowers/*` over-match 已还原为包路径；「`docs/` 仅 maintainers」6 处陈旧措辞、maintainer-doc 相对链接、§2.1 例外注记字面均已同步）。

## Global Constraints

从 overall + P2 design copy：
- `workspaceRoot` 单源 `.osuperpowers/cdd`（`packages/cdd-engine/templates/handoff-namespace.json`）为 P1 定案，本 phase 不动
- 记录豁免集（§2.7 模式）：`docs/osuperpowers/{specs,plans}/2026-09-13-osuperpowers-overhaul*` + `.changeset/`；其余 live tree 零 `docs/superpowers`
- 39 文件迁移后 `docs/superpowers/` 不存在；`docs/` = `maintainers/` + `osuperpowers/`；`docs/osuperpowers/specs/` = 24、`docs/osuperpowers/plans/` = 20（P2 完成时点）
- 所有改动须过 `pnpm run validate`（13 块）+ `pnpm run emit:check` 无 drift；**emit 唯一入口 = 仓库根 `pnpm run emit`**（`packages/osuperpowers/package.json` 无 scripts 字段）
- changeset：`@oscaner-skills/cdd-engine` minor；osuperpowers 本次不 bump（P4 再计）
- vendored 子模块不可改（`vendors/mattpocock-skills/.../to-tickets/` 物理目录保留，无生产引用即无残留）
- **破坏性重构已授权**：drop `rootFromDocPath` 旧 marker、删 `docs/superpowers/` 目录、tickets 死引用全移除

---

### Task 1: docs 根迁移 — 39 文件 git-mv + 54 次内容重写 + 空目录清理

**Files:**
- Move: `docs/superpowers/specs/*.md`（21）→ `docs/osuperpowers/specs/`；`docs/superpowers/plans/*.md`（18）→ `docs/osuperpowers/plans/`
- Modify（重写，21 个历史文件内 54 次出现/53 行）：机械 `docs/superpowers` → `docs/osuperpowers`
- Remove: `docs/superpowers/`（移空后目录）
- Test: shell 计数 + `pnpm run validate`（block 12 本轮预期 SKIP——validator 仍指旧根，Task 2 收敛）

**Interfaces:**
- Consumes: P2 design §2.1 迁移面
- Produces: docs 单根 `docs/osuperpowers/{specs,plans}`（24/20 文件）；历史 39 文件内部路径引用指向新根；`docs/superpowers/` 不存在
- **前置条件**：在途程序文档（overall v1.6 / p2-design / p2-plan）须**已各自 commit**（brainstorming 的 `commit-spec` + writing-plans 的 `commit-plan` gate），工作区对 `docs/osuperpowers/` 干净后再执行——否则 `git add -A docs/` 会把无关在途改动卷入迁移 commit。

- [ ] **Step 1: 先重写内容（旧目录内，避免误伤 in-flight 豁免记录）**

**必须在 git mv 之前**在旧目录内执行——`grep -rl` 若在迁移后按 `docs/osuperpowers/` 扫，会命中须豁免的 in-flight 文档（overall / p1-design / p1-plan / p2-design / 本 plan）。

```bash
cd /Users/kang/Projects/oscaner-skills
grep -rl "docs/superpowers" docs/superpowers/ | xargs sed -i '' 's#docs/superpowers#docs/osuperpowers#g'
grep -r "docs/superpowers" docs/superpowers/ | wc -l   # 期望 0
```
Expected: 21 个文件被改写（54 次出现 → 0）。**例外注记（design §2.1）**：`plans/2026-09-04-cdd-engine-overhaul-p1.md:1084,1539` 与 `plans/2026-09-05-cdd-engine-overhaul-p2.md:580` 为历史代码 literal（断言/命令），机械重写后作为迁移前描述——同批处理，无需特殊分支。

- [ ] **Step 2: git mv 39 文件**

```bash
git mv docs/superpowers/specs/*.md docs/osuperpowers/specs/
git mv docs/superpowers/plans/*.md docs/osuperpowers/plans/
```
Expected: 39 个 rename（21 含内容修改）。目标目录无同名冲突（in-flight 文档命名 `2026-09-13-osuperpowers-overhaul*` 与新迁入历史文件名不同日期前缀）。

- [ ] **Step 3: 清空目录 + 计数验证**

```bash
find docs/superpowers -type f | head     # 期望：无输出（已移空）
rm -rf docs/superpowers
ls docs/                                   # 期望：maintainers + osuperpowers
ls docs/osuperpowers/specs/*.md | wc -l         # 期望 24（21 历史 + overall + p1-design + p2-design）
ls docs/osuperpowers/plans/*.md | wc -l         # 期望 20（18 历史 + p1 + p2 plan）
ls docs/osuperpowers/specs/2026-09-13-osuperpowers-overhaul-p2-design.md   # 存在
ls docs/osuperpowers/plans/2026-09-13-osuperpowers-overhaul-p2.md          # 存在
git status --short                         # 期望：39 rename（21 显示 modified）——前置条件满足时无其他条目
```

- [ ] **Step 4: plan `**Spec:**` 链接解析验证（行为性）**

```bash
for f in docs/osuperpowers/plans/*.md; do
  t=$(grep -m1 -o '(docs/osuperpowers/specs/[^)]*)' "$f" | tr -d '()')
  if [ -n "$t" ] && [ ! -f "$t" ]; then echo "UNRESOLVED: $f → $t"; fi
done
```
Expected: 无 `UNRESOLVED` 行（历史 plan 的 `**Spec:**` 链接重写后指向迁移后 spec；P1 plan 用相对 `../specs/` 不匹配该模式，跳过属预期）。

- [ ] **Step 5: 跑 validate**

```bash
node scripts/run.mjs validate
```
Expected: 全绿。**block 12（overall consistency）本轮预期打印 `SKIP — no docs/superpowers/specs`**——validator 常量仍指旧根（Task 2 收敛为 `docs/osuperpowers/`）；此为本 task 的预期过渡态，非缺陷。其余 12 块 + emit freshness 全 OK。

- [ ] **Step 6: Commit**

```bash
git add -A docs/
git commit -m "refactor(docs): specs/plans 单根迁移 — docs/superpowers → docs/osuperpowers（39 文件 git-mv + 54 处内部路径重写）"
```

> **T1 review-1 follow-up（非本任务缺陷，记录供下游）**：implement handoff 的 `commits.base` 与 `head` 同值（= 任务自身提交 `f672add`）——正确 base 应为 `f672add^`（`bbeec5c`；同任务的 `task-1-test-evidence.json` 与 `report` 均正确记录 `TASK_BASE`）。后果是**行为性**：任何从 `task-N-implement.json` 推导 review range 的消费者（重派 task-review / branch-review / report-issue resolve-destination）会看到 `f672add..HEAD` 空 diff 而对 39 文件迁移静默放行。**P1 程序 task-4 handoff（db3c4f2/db3c4f2）同形 → 疑系统性**（implement 记 base 时取自身提交，或 runner 实体化以 post-commit HEAD 为 base）。本 task artifact 已就地修正；系统性根因（runner base 解析 / implement 提示词契约）留 **P6 或独立 follow-up**。 **T2 task-review-2 warn 扩展（2026-09-14）**：同形亦出现在 **brief 物化**——`task-2-brief.md` 的 `TASK_BASE` == HEAD，使 round-2 声明 range `TASK_BASE..HEAD` 为空 diff（7 文件修复不可见）。即根因不止 implement handoff，已触及 **review range**；follow-up 范围相应扩为「**materialization（handoff + brief）记 post-commit HEAD 为 base/TASK_BASE**」。该 round owning base 按实取 `fd6f003`（`298f473^`）。

> **T1 遗留告警（过渡态，Task 4 收口）**：`docs/maintainers/osuperpowers-plugin.md:42,43` 现为**悬空相对链接**（`../../docs/superpowers/specs/` 目标目录已不存在）——Task 4 Step 3 正是重写这两行的动作；branch-review 前须确认 Task 4 已落地。

---

### Task 2: validator 单根收敛 + 新 overall guard 归一

**Files:**
- Modify: `scripts/validate/overall-consistency.mjs:32,39,40,461`
- Modify: `docs/osuperpowers/specs/2026-09-13-osuperpowers-overhaul-overall.md`（header version、P1 Phase inventory plan 列、change-history v1.3 行 claim 句切分、change-history 追加 v1.7）
- Test: `node scripts/run.mjs validate`（block 12）+ `pnpm exec vitest run scripts/validate/overall-consistency.test.mjs`

**Interfaces:**
- Consumes: Task 1（docs 已落新根）
- Produces: `SPECS_DIR`/`PLANS_DIR` = `docs/osuperpowers/{specs,plans}`；新 overall 满足 canonical 4-table 守卫；block 12 恢复启用（3 canonical OK + 1 skip）

- [ ] **Step 1: 收敛 validator 常量**

`scripts/validate/overall-consistency.mjs`：
```js
const SPECS_DIR = join(process.cwd(), "docs", "osuperpowers", "specs");
const PLANS_DIR = join(process.cwd(), "docs", "osuperpowers", "plans");
```
- line 32 注释：`Standalone (…) scans docs/superpowers/specs/*-overall.md` → `docs/osuperpowers/specs/*-overall.md`
- line 461 `SKIP` 文案：`"SKIP — no docs/superpowers/specs"` → `"SKIP — no docs/osuperpowers/specs"`

- [ ] **Step 2: 新 overall canonical 列归一**

> 注：本 phase 开始前 overall 已达 **v1.6**（2026-09-14 用户补充的 §writing-plans design 回填步骤，与本 task 无关；见 change-history v1.6）。本 task 的归一即 **v1.6 → v1.7**。

`docs/osuperpowers/specs/2026-09-13-osuperpowers-overhaul-overall.md`：
- Phase inventory P1 行 `Implementation plan` 列：`**Done**（2026-09-14 shipped，plan v1.0 5-tasks 全闭环 + branch-review APPROVED）` → 裸 `Done`（canonical 形——`claimKey` 取 `Done`，列须字面等价；详情已存 change-history v1.5）
- header：`- **Version**: v1.6 · 2026-09-14` → `v1.7 · 2026-09-14`
- Change history 追加一行（**不得含 `Pending` + `→` 组合**，避免生成伪 claim）：
```markdown
| v1.7 | 2026-09-14 | **P2 canonical 列归一**：P1 `Implementation plan` 列由 `**Done**（2026-09-14 shipped…）` 收敛为裸 `Done`——① 回填声明 target key 与列字面等价（canonical 形同 cdd-overhaul P1 列），令新 overall 通过 overall-consistency 四表守卫；交付详情见 v1.5（v1.6→v1.7） | [human] · Claude Opus 5 (1M context) |
```

- **第二项归一：v1.3 行 claim 句切分**（仅列归一不足——实测 `checkBackfillClaims` 仍抛 `① 正向 design: P3 Design spec 列需含自身 P1-design token（实际 "[Pending]"）`）。v1.3 行末句「overall 同步：P1 scope/acceptance 措辞更新 + P1 Design-spec 列回填（[Pending]→P1-design v1.0）+ Dependency graph P1→P3 边措辞（standalone CLI 面归 P1）+ change-history（v1.2→v1.3）」未被 `；` 切分，`extractClaimRows` 抽出 design claim `P1-design` 而 `phaseIdsIn` 从「P1→P3」同时收进 P3 → P3 被要求命中同一 token（实际 `[Pending]`）→ 抛错。

  **改法**：在 ` + Dependency graph` 前插 `；`，使该 claim 句只含 P1：
```
overall 同步：P1 scope/acceptance 措辞更新 + P1 Design-spec 列回填（[Pending]→P1-design v1.0）；Dependency graph P1→P3 边措辞（standalone CLI 面归 P1）+ change-history（v1.2→v1.3）
```

- [ ] **Step 3: 跑 validator + fixture 测试**

```bash
node scripts/run.mjs validate                                   # block 12 恢复
pnpm exec vitest run scripts/validate/overall-consistency.test.mjs   # fixtures（注入 roots，无需迁移）
```
Expected: block 12 输出
```
CDD_INFO: skip 2026-08-31-post-dogfood-bugfixes-overall.md (non-canonical phase inventory header)
OK — 2026-09-04-cdd-engine-overhaul-overall.md (6 phases)
OK — 2026-09-10-session-report-246-overall.md (7 phases)
OK — 2026-09-13-osuperpowers-overhaul-overall.md (6 phases)
ALL PASS — 3/4 canonical overall files consistent
```
（**新 overall 首次入守卫且通过**——design §2.3 / AC6）。fixtures 26 tests 全绿。

- [ ] **Step 4: Commit**

```bash
git add scripts/validate/overall-consistency.mjs docs/osuperpowers/specs/2026-09-13-osuperpowers-overhaul-overall.md
git commit -m "refactor(validate): overall-consistency 单根 docs/osuperpowers/ + 新 overall canonical 列归一（v1.7）"
```

---

### Task 3: engine — `rootFromDocPath` 新布局识别 + 夹具迁移

**Files:**
- Modify: `packages/cdd-engine/lib/handoff/naming.mjs:119-121,128-137`
- Modify: `packages/cdd-engine/tests/handoff-naming.test.mjs:63-64`
- Modify: `packages/cdd-engine/tests/cdd.test.mjs:342,355,357,368`
- Modify: `packages/cdd-engine/tests/docs-runner.test.mjs:149,159,171,183,200,214,248,278,316`
- Test: `packages/cdd-engine/tests/` vitest suite

**Interfaces:**
- Consumes: Task 1（新根已落）
- Produces: `rootFromDocPath` 识别 `<root>/docs/osuperpowers/{specs,plans}/…`；旧 `docs/superpowers` marker 不存在

- [ ] **Step 1: 翻新 marker**

`naming.mjs` `rootFromDocPath`（line 128-137）——段对 `["docs","superpowers"]` → **`["docs", "osuperpowers"]`（+ `specs`|`plans`）**：
```js
// canonical 布局推导：<root>/docs/osuperpowers/{specs,plans}/… 中 `docs`+`osuperpowers` 段之前的路径即 gitRoot。
// 严格配对（`osuperpowers` 后须随 `specs`/`plans`）——运行根 `.osuperpowers/cdd/…` 的 `.osuperpowers`
// 段带前导点 ≠ `osuperpowers`，段相等性天然不串。
function rootFromDocPath(doc) {
  const segments = path.resolve(doc).split(path.sep);
  for (let i = 0; i < segments.length - 1; i++) {
    if (segments[i] === "docs" && segments[i + 1] === "osuperpowers" && ["specs", "plans"].includes(segments[i + 2])) {
      return segments.slice(0, i).join(path.sep) || path.sep;
    }
  }
  return null;
}
```
同步 line 119-121 `resolveWorkspace` 头注释：canonical 布局标记 `docs/superpowers/` → `docs/osuperpowers/{specs,plans}/`。

- [ ] **Step 2: 迁移 3 个夹具文件假路径 + AC2 反射例**

`/repo/root/docs/superpowers/{specs,plans}/…` → `/repo/root/docs/osuperpowers/{specs,plans}/…`（`handoff-naming.test.mjs` 用 `/repo/…` 无 `root`）。**片段形态须与 canonical 布局逐段一致**——`/repo/root/docs/osuperpowers/specs/foo-design.md` 经段对 marker → `/repo/root`（**切点在 `docs` 段之前**）；`cdd.test.mjs` **四处全改**——`:342`（runReview 的 `spec:`）/ `:368`（runFix 的 `spec:`）两处经 `review.mjs:75` / `fix.mjs:61` 走 `resolveWorkspace(doc)`，假路径无 git → 唯一回落 `rootFromDocPath`；**漏改则新 marker 返回 null、`resolveWorkspace` 抛 `not in a git repo` 两用例必红**。期望值 `/repo/root/.osuperpowers/cdd/foo` 不变（`/repo/root` + `.osuperpowers/cdd/foo`）。

`docs-runner.test.mjs:159` 断言精确化——workspace 路径 `<root>/.osuperpowers/cdd/<slug>` 含 `osuperpowers` 子串，裸断言会误命中：
```js
expect(callOpts.cwd).not.toContain("/docs/osuperpowers/specs");   // 原 not.toContain("docs/superpowers")
```

**AC2 反射例（运行根不误匹配）**——`handoff-naming.test.mjs` 的 resolveWorkspace 用例旁补：
```js
// AC2：严格配对（osuperpowers 后须随 specs|plans）下，运行根 `.osuperpowers/…` 不被识别为 docs 根
expect(() => resolveWorkspace("/repo/.osuperpowers/cdd/x/review-1.json")).toThrow(/not in a git repo/);
```

- [ ] **Step 3: 跑 engine 套件**

```bash
pnpm --filter @oscaner-skills/cdd-engine test
```
Expected: 371 tests 全绿（`handoff-naming` / `cdd` / `docs-runner` 新布局 fixture + rootFromDocPath 新 marker）。

- [ ] **Step 4: Commit**

```bash
git add packages/cdd-engine
git commit -m "refactor(cdd-engine): rootFromDocPath 识别 docs/osuperpowers/{specs,plans} 布局（drop docs/superpowers 旧 marker）"
```

---

### Task 4: active 约定文档路径同步 + tickets 死引用移除 + emit

**Files:**
- Modify: `packages/osuperpowers/skills/writing-plans/SKILL.md:34`
- Modify: `packages/osuperpowers/skills/brainstorming/SKILL.md:67,68`
- Modify: `packages/osuperpowers/skills/brainstorming/docs/overall-spec-template.md:36,43`
- Modify: `packages/osuperpowers/skills/report-issue/templates/finding-meta.json:286`
- Modify: `packages/osuperpowers/README.md:9,17`
- Modify: `CLAUDE.md:21,87`
- Modify: `README.md:27`
- Modify: `README.zh-CN.md:27`
- Modify: `docs/maintainers/osuperpowers-plugin.md:24,38-43,202,204`
- Modify: `scripts/release/publish-vendor.test.mjs:163,373,444`
- Test: `pnpm run emit` + `pnpm run emit:check` + `pnpm run validate` + grep 复核

**Interfaces:**
- Consumes: Task 1-3
- Produces: active 约定文档零 `docs/superpowers`；tickets 工作流/委托/模板引用全零（vendored 内容清点除外）

- [ ] **Step 1: skills / template / CLI 文档路径同步**

- `writing-plans/SKILL.md:34`：`docs/superpowers/plans/YYYY-MM-DD-<feature>.md` → `docs/osuperpowers/plans/…`；spec-link `(docs/superpowers/specs/<name>-design.md)` → `(docs/osuperpowers/specs/<name>-design.md)`
- `brainstorming/SKILL.md:67,68`：`docs/superpowers/specs/*-overall.md` → `docs/osuperpowers/specs/*-overall.md`（Do + Read 两段）
- `brainstorming/docs/overall-spec-template.md:36`：`docs/superpowers/` → `docs/osuperpowers/`
- `finding-meta.json:286`：placeholder → `Overall spec: docs/osuperpowers/specs/2026-09-04-cdd-engine-overhaul-overall.md`
- `CLAUDE.md:87`：Strategy B `docs/superpowers/specs/*.md` / `docs/superpowers/plans/*.md` → `docs/osuperpowers/specs/*.md` / `docs/osuperpowers/plans/*.md`

- [ ] **Step 2: tickets 死引用移除（10 处）**

- `overall-spec-template.md:43`：删整行 `| Phase tickets | \`tickets/YYYY-MM-DD-<feature>-<phase-id>-tickets.md\` |`
- `packages/osuperpowers/README.md:9`：删示例项「ticket publish redirection」（保留其余示例）
- `packages/osuperpowers/README.md:17`：删从句「; tickets to `docs/superpowers/tickets/`」
- `docs/maintainers/osuperpowers-plugin.md:24`：① 删除「(writing-plans Rule: Tickets Publish Redirect … `docs/superpowers/tickets/<date>-<feature>-tickets.md`, keeping the upstream single-file shape)」canonical 示例（该 Rule 及 `/to-tickets` 委托当前不存在），partial-delegate 描述保留通用措辞；② `(b)` delegates 列表去掉 `to-tickets`（`grilling, tdd, to-tickets` → `grilling, tdd`）
- `docs/maintainers/osuperpowers-plugin.md:202`：`**SDD / ticket execution:**` 段去 ticket 框架——改为**逐 unit 执行纪律**（approved plan 内，plan 指定 commit 的 unit 完成后直接 commit 不追问；plan 未指定则收尾后一次询问）
- `docs/maintainers/osuperpowers-plugin.md:204`：`do not stop after each ticket to ask` → `do not stop after each unit to ask`
- `scripts/release/publish-vendor.test.mjs:163,373,444`：① 删 fixture 行 `        "./skills/to-tickets",`（合成清单 21 → 20 项）；② **连带阈值同步**——:373 `expect(pi.skills.length >= 21)` 与 :444 `expect(pkg.pi.skills.length >= 21)` 改 `>= 20`（实测删行后 `2 failed | 43 passed`；**成员数阈值确实依赖该 fixture 集合**，不连带改则 Task 4 Step 4 / Task 6 Step 3 的「validate 13 块全绿」不可达）
- `README.md:27`：vendored 表行 `Precision tools -- \`grilling\`, \`tdd\`, \`to-tickets\`` → `Precision tools -- \`grilling\`, \`tdd\``（只列本体系实际采用的 vendored skills）
- `README.zh-CN.md:27`：`精准工具——\`grilling\`、\`tdd\`、\`to-tickets\`` → `精准工具——\`grilling\`、\`tdd\``
- `CLAUDE.md:21`：`Engineering precision skills (grilling, tdd, to-tickets, research).` → `Engineering precision skills (grilling, tdd, research).`

- [ ] **Step 3: maintainer doc conventions 节路径 + 相对链接**

`docs/maintainers/osuperpowers-plugin.md:38-43`：
- 标题 `## \`docs/superpowers/\` conventions` → `## \`docs/osuperpowers/\` conventions`
- 链接 `[docs/superpowers/specs/](../../docs/superpowers/specs/)` → `[docs/osuperpowers/specs/](../osuperpowers/specs/)`（`docs/maintainers/` **上溯一级**）；plans 行同

- [ ] **Step 4: emit + validate + grep 复核**

```bash
pnpm run emit            # 根入口；skills/templates 改动再生 .agents/ + .github/ISSUE_TEMPLATE/session_report.yml
pnpm run emit:check      # drift 0
node scripts/run.mjs validate
```
Expected: emit 无 drift；validate 13 块全绿。grep 复核：
```bash
grep -rn "docs/superpowers" packages/osuperpowers/skills packages/osuperpowers/README.md docs/maintainers CLAUDE.md README.md   # 期望 0
grep -rni "ticket" packages/osuperpowers/skills packages/osuperpowers/README.md docs/maintainers README.md README.zh-CN.md CLAUDE.md   # 期望 0（10 处移除后全清）
```
> **全仓 tickets 终态检查不在本 task**：`packages/osuperpowers/tests/grep-sweep-regression.test.mjs:14,72` 仍含 `grep -v "docs/superpowers/tickets/"` 字面过滤器（Task 5 Step 3 才删），故全仓 tickets 口径留至 **Task 6 Step 2**（过滤器已删、守卫已入）。

- [ ] **Step 5: Commit**

```bash
git add packages/osuperpowers CLAUDE.md README.md README.zh-CN.md docs/maintainers scripts/release/publish-vendor.test.mjs .github/ISSUE_TEMPLATE/session_report.yml
git status --short   # 复核仅列预期文件；emit 派生物（.agents/ + ISSUE_TEMPLATE/session_report.yml）与 canonical 同一次落账
git commit -m "docs(osuperpowers): docs 根路径同步 docs/osuperpowers/ + tickets 死引用全移除（10 处）+ emit"
```

---

### Task 5: residue 守卫 + grep-sweep 过滤收敛

**Files:**
- Modify: `scripts/validate/residue.mjs:3-10,44-58,63`
- Modify: `scripts/validate/residue.test.mjs:129`（+ 新命中断言）
- Modify: `packages/osuperpowers/tests/grep-sweep-regression.test.mjs:14,65,72`
- Test: `pnpm exec vitest run scripts/validate/residue.test.mjs` + `pnpm run validate`（5b/5c）

**Interfaces:**
- Consumes: Task 1-4（机制 + active 面已清零——守卫在清零后接入）
- Produces: `docs/superpowers` stale-lexicon 守卫（机制位置零豁免）；grep-sweep 过滤器重指向 `docs/osuperpowers/`

- [ ] **Step 1: residue.mjs 新增守卫**

`STALE_LEXICON_CHECKS` 追加（`ALL_MECH_POSITIONS` = osuperpowers skills + cdd-engine bin/lib/templates）。**label 不含路径字面、regex 以 `\/` 转义**——守卫本体不得把字面 `docs/superpowers` 写回 `scripts/`（否则 Task 6 全仓 grep 出第三类命中）：
```js
{ label: "old docs root (pre-P2)", re: /docs\/superpowers/, scope: [...ALL_MECH_POSITIONS, ...DOC_SURFACE_TARGETS] },
```
并新增文档表层 target 常量（治理文件面——残留最可能回渗点）：
```js
export const DOC_SURFACE_TARGETS = ["CLAUDE.md", "README.md", "packages/osuperpowers/README.md", "docs/maintainers"];
```
`GATE_TARGETS`（`residue.mjs:68`）与 `DOC_SURFACE_TARGETS` 有 2 项重叠（`docs/maintainers` / 根 `README.md`）——**刻意重叠**（两者服务不同语汇：gate 移除 vs 旧 docs 根；且根 `README.md` 对 stale-lexicon 属新增覆盖，`GATE_TARGETS` 仅被 `GATE_LEXICON_CHECKS` 消费）。在 `GATE_TARGETS` 旁加一行注释声明该刻意重叠，使命中面**同步重指向**、不静默漂移。
```
line 63 GATE 豁免注释同步：`docs/superpowers/` → `docs/osuperpowers/{specs,plans}`（历史文档新落点；gate targets 不含之）。

**另：文件头 3-10 行的 check 枚举注释**（「…old docs-review filenames, PASS=< lens params, D1|D2|D3 lens names, resolve-hit / gh issue reopen resolver vocabulary, the task-review mode, and P4 degraded filenames…」）追加 `the old docs root (pre-P2)`——本仓 stale-lexicon 以「注释即契约」维护，枚举须与 `STALE_LEXICON_CHECKS` 实现一致（P6 收口项会读该枚举）。

- [ ] **Step 2: residue.test.mjs 断言 + 标题同步**

- line 129 `it()` 标题：`（机制/文档表层零残留；docs/superpowers + CHANGELOG 豁免）` → `（机制/文档表层零残留；docs/osuperpowers/{specs,plans} 历史文档 + CHANGELOG 豁免）`
- 新增命中/放行断言——**经字符串拼接构造**（测试同样不得写回字面）：
```js
const OLD_DOCS_ROOT = "docs" + "/superpowers";
expect(hasHit([`${OLD_DOCS_ROOT}/specs/foo.md`])).toBe(true);   // 新守卫命中
expect(hasHit(["docs/osuperpowers/specs/foo.md"])).toBe(false);      // 新根放行
```

- [ ] **Step 3: grep-sweep 过滤器重指向（已随 docs 根纠正落地，本 task 复跑确认）**

`grep-sweep-regression.test.mjs` 三处命令（line 14, 65, 72）的 `grep -v` 过滤器由 `docs/superpowers/{specs,plans,tickets}` **重指向 `docs/osuperpowers/{specs,plans,tickets}`**——docs 根纠正（overall v1.8）后历史文档落 `docs/osuperpowers/`，**仍在 sweep scope（`packages/ docs/ README.md marketplace/`）内**，过滤器**不可删除**（否则 `executing-plans` / `subagent-driven-development` / `docs/cdd-reference` 各 sweep 立即非零命中，实测 17/17/1）。该重指向已随 docs 根纠正提交落地；本 Step 仅复跑确认。

- [ ] **Step 4: 跑测试**

```bash
pnpm exec vitest run scripts/validate/residue.test.mjs
node scripts/run.mjs validate
grep -rni "ticket" --exclude-dir=vendors --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=.osuperpowers --exclude-dir=tmp --exclude-dir=.agents .   # 命中集 == 在途 2026-09-13-osuperpowers-overhaul*（grep-sweep 过滤器已在本 Step 3 重指向）
```
Expected: residue.test.mjs 全绿（含新增命中/放行断言）；validate 5b grep-sweep 各 sweep 仍 0 命中、5c stale-lexicon 零命中；tickets 全仓 grep 命中集恰为在途程序文档（p2-design / p2-plan 的移除叙述）。

- [ ] **Step 5: Commit**

```bash
git add scripts/validate/residue.mjs scripts/validate/residue.test.mjs packages/osuperpowers/tests/grep-sweep-regression.test.mjs
git commit -m "feat(validate): docs/superpowers stale-lexicon 守卫 + grep-sweep 过滤器重指向"
```

---

### Task 6: changeset + 全量收口

**Files:**
- Create: `.changeset/p2-docs-root-migration.md`（cdd-engine minor）
- Test: `node scripts/run.mjs validate` + `pnpm run emit:check` + §2.7 残留 grep

**Interfaces:**
- Consumes: Task 1-5（全量落地）
- Produces: changeset（`@oscaner-skills/cdd-engine` minor）；残留命中集 == 豁免集

- [ ] **Step 1: 创建 changeset**

```bash
cd /Users/kang/Projects/oscaner-skills && pnpm run changeset
```
内容（minor；文件须 POSIX `\n` 终止）：
```
---
"@oscaner-skills/cdd-engine": minor
---

P2 docs 根落点迁移: rootFromDocPath 识别 docs/osuperpowers/{specs,plans} 布局（drop docs/superpowers 旧 marker）; overall-consistency 单根收敛; docs/superpowers stale-lexicon 守卫。
```
（若 `pnpm run changeset` 交互不可用——@changesets/cli 依次提示选包与 bump 类型，在无人值守 shell 中阻塞 stdin——手动写 `.changeset/p2-docs-root-migration.md`，内容如上。）

- [ ] **Step 2: §2.7 残留 grep 口径校验**

```bash
grep -rn "docs/superpowers" docs/osuperpowers/                     # 命中集 == 在途 2026-09-13-osuperpowers-overhaul* 文件集
grep -rn "docs/superpowers" --exclude-dir=vendors --exclude-dir=.git --exclude-dir=node_modules \
  --exclude-dir=.osuperpowers --exclude-dir=tmp --exclude-dir=.agents .   # 命中集 == 在途文档集 ∪ .changeset/
grep -rni "ticket" --exclude-dir=vendors --exclude-dir=.git --exclude-dir=node_modules \
  --exclude-dir=.osuperpowers --exclude-dir=tmp --exclude-dir=.agents .   # 命中集 == 在途文档集（移除叙述本身；无第三类）
```
Expected: 三条命令的命中**文件级**集合分别恰等于豁免集 ① / ①∪② / `ticket` 豁免集（design §2.7 同口径模式）；**无第三类命中**。`tmp/`（gitignored publish-vendor 副本来场）+ `.osuperpowers/`（运行时 handoff 引述面）显式排除——本机 shell 的 grep 包裹行为不可依赖。

- [ ] **Step 3: 全量验证收口**

```bash
node scripts/run.mjs validate    # 13 块全绿（含 block 12 的 3/4 canonical）
pnpm run emit:check              # drift 0
ls docs/                         # maintainers + osuperpowers
```

- [ ] **Step 4: Commit**

```bash
git add .changeset
git commit -m "chore(cdd-engine): changeset — P2 docs 根落点迁移 (minor)"
```

---

## Execution handoff

Plan complete. Execute via `osuperpowers:cli-driven-development`（每 Task 全串行闭环：implement → task-review → fix loop → review 输出 blocker=0 才进下一 Task；全部完成后 branch-review → finishing）。