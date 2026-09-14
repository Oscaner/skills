# osuperpowers 架构重构 P2 — docs 根落点迁移设计

- **Version**: v1.0 · 2026-09-14
- **Status**: Draft
- **Author**: [human] · Claude Opus 5 (1M context) (osuperpowers:brainstorming)
- **Parent program**: [2026-09-13-osuperpowers-overhaul-overall.md v1.5](./2026-09-13-osuperpowers-overhaul-overall.md)（req 2）
- **Depends on**: P1 shipped（runtime 布局 `.osuperpowers/cdd` + standalone 移除，2026-09-14）

---

## Section 0: Incremental warning

> P2 increment only（docs 根落点迁移）。Cross-phase conventions 见 [overall](./2026-09-13-osuperpowers-overhaul-overall.md)；冲突时 overall 赢。P4（skills 重写）/P5（report-issues）在途程序对此无 cross-phase 依赖。

---

## Section 1: Constraints pointer

- 仓库语言政策：SKILL.md / docs 英文主源；本 spec 中文（Strategy B internal docs）
- 不 commit 除非用户明确要求；changeset 逐 phase 建
- vendored 子模块不可改
- **破坏性重构已授权**（遗留即删）：39 历史文件 git-mv + rootFromDocPath drop 旧 marker + `docs/superpowers/` 目录删除
- 所有改动须过 `pnpm run validate`（13 块）+ `pnpm run emit:check` 无 drift；skills/*.md 与 skills/*/docs/*.md 改动后必跑 `pnpm run emit`
- P1 定案引用：`workspaceRoot` 单源 `.osuperpowers/cdd`（`templates/handoff-namespace.json`）；`.superpowers/sdd/` 保留不属于本 phase 域

---

## Section 2: Design body

### §2.1 迁移面 — 文件清点

**git-mv（39 文件，历史保留）**：

| 源 | 目标 | 计数 |
|---|---|---|
| `docs/superpowers/specs/*.md` | `osuperpowers/specs/` | 21 |
| `docs/superpowers/plans/*.md` | `osuperpowers/plans/` | 18 |

落盘终态（**P2 完成时点**度量）：`osuperpowers/specs/` ＝ 21 历史 + 3 在途（overall + P1-design + **P2-design 自身**）＝ **24**；`osuperpowers/plans/` ＝ 18 历史 + 2 在途（P1 + **P2 plan**——writing-plans 于本 phase 流程内产出）＝ **20**。`docs/superpowers/` 移空后目录自然消失（git 不跟踪空目录）；`docs/` 仅余 `maintainers/`（含 `docs/maintainers/*.md`，保留原地）。

**内容重写（54 次出现 / 53 行）**：21 个历史文件（39 中 21 个含 `docs/superpowers` 字符串，specs/plans 均有）统一机械 `docs/superpowers` → `osuperpowers`（54 次字符串出现分布于 53 行——`2026-09-10-session-report-246-p4-design.md:68` 单行含两处；纯路径字符串；plan 的 `**Spec:**` 跨文件链接指向迁移后 spec ✓；validator 扫描面描述 / 命令豁免示例 / 假路径 fixture 随之指向新根，记录内在有效）。**例外注记（3 处历史代码 literal）**：`plans/2026-09-04-cdd-engine-overhaul-p1.md:1084,1539`（`not.toContain('docs/superpowers')` / `stringContaining('docs/superpowers')` 断言）与 `plans/2026-09-05-cdd-engine-overhaul-p2.md:580`（`--exclude-dir=docs/superpowers` 命令）机械重写后作为**迁移前断言/命令的历史描述**——新布局下 cwd `.osuperpowers/cdd/…` 恒含 `osuperpowers` 子串，其字面语义不可在迁移后成立（活断言在 §2.2 以 `not.toContain('/osuperpowers/specs')` 精确形式迁移）；属 §2.7 记录豁免性质。剩余 18 个文件零引用，纯 git-mv。

### §2.2 engine — `naming.mjs rootFromDocPath` 新布局识别

- **marker 段对变更**：`["docs","superpowers"]` → **严格 `["osuperpowers", "specs"|"plans"]`**——`osuperpowers` 段后必须随 `specs` 或 `plans` 才命中（防 `.osuperpowers/cdd/<slug>/…` 运行根误匹配：`.osuperpowers` 段带前导点 ≠ `osuperpowers`，段相等性天然安全）。
- **drop 旧 marker**：`resolveWorkspace` 真实路径经 `gitToplevel` 优先解析，`rootFromDocPath` 仅服务非 git 假路径（测试 / dry-run）；本程序迁移后零旧布局在途消费者。残留 `docs/superpowers` 路径的 review/fix 调用（若有）本就会在 git 内文件读时失败，非行为回退。
- **engine 测试夹具迁移**：`tests/handoff-naming.test.mjs:63-64`、`tests/cdd.test.mjs:355-357`、`tests/docs-runner.test.mjs` 多处 `/repo/root/docs/superpowers/{specs,plans}/…` 假路径 → `/repo/root/osuperpowers/{specs,plans}/…`。`docs-runner.test.mjs` 的 `expect(callOpts.cwd).not.toContain("docs/superpowers")` 断言须精确化：workspace 路径 `<root>/.osuperpowers/cdd/<slug>` 本身含 `osuperpowers` 子串，改为 `not.toContain("/osuperpowers/specs")`（防文档目录被误判为 cwd）。

### §2.3 validator — `overall-consistency` 单根收敛

- `SPECS_DIR`/`PLANS_DIR`（`scripts/validate/overall-consistency.mjs:39-40`）→ `osuperpowers/{specs,plans}`；line 32 注释 + line 461 `SKIP` 文案（`"no docs/superpowers/specs"` → `"no osuperpowers/specs"`）同步。
- **行为变化（预期）**：单一 `-overall.md` glob 现命中 **4 个 overall**（post-dogfood 非 canonical → skip；cdd-overhaul + session-246 继续受守卫；**新 overall `2026-09-13-osuperpowers-overhaul-overall.md` 首次进入守卫面**——canonical 头 + P1 design/plan 文档存在性已满足）。新 overall 须两项归一（实测：两项齐备后 6 项检查全过）：
  1. **canonical 列归一**：P1 `Implementation plan` 列现为 `**Done**（2026-09-14 shipped…）`，与 ① 回填声明 target key `Done` **字面不等**（`claimKey` 取 `Done`、`columnValue` 留全括号长尾 → checkBackfillClaims 抛错）——归一为裸 `Done`（canonical 形，同 cdd-overhaul P1 列）+ 追加 change-history v1.7 记录；
  2. **change-history v1.3 行 claim 句切分**：该行末句「…P1 Design-spec 列回填（[Pending]→P1-design v1.0）+ Dependency graph P1→P3 边措辞…」未被 `；` 切分，`extractClaimRows` 抽出 design claim `P1-design` 而 `phaseIdsIn` 从「P1→P3」同时收进 P3 → P3 被要求命中同一 token（实际 `[Pending]`）→ ① 正向 design 抛错；在 ` + Dependency graph` 前插 `；` 使该 claim 句只含 P1。
- 测试 fixtures（`scripts/validate/fixtures/overall-consistency/`）零 `docs/superpowers` 字符串、经注入 roots，无需内容迁移（复跑确认）。

### §2.4 residue 守卫 + grep-sweep 过滤收敛

- **residue.mjs 新增 stale-lexicon**（P1 `.superpowers/cdd`/`standalone` 守卫同构）：`{ label: "old docs root (pre-P2)", re: /docs\/superpowers/, scope: ALL_MECH_POSITIONS }`——机制位置（engine bin/lib/templates + osuperpowers skills）零豁免防回渗；历史文档在 `osuperpowers/{specs,plans}` 不在机制扫描面，零误伤。`residue.test.mjs` 增命中/放行断言，**经字符串拼接构造**（`"docs" + "/superpowers"`）——**守卫本体与其测试不得把字面 `docs/superpowers` 写回 `scripts/`**（label 不含路径、regex 以 `\/` 转义已天然规避），否则 §2.7 全仓 grep 出现第三类命中、AC3「其余全零」不可满足。
- **residue.mjs:63 GATE 豁免注释 + residue.test.mjs:129 it() 标题**同步（两处字面 `docs/superpowers` 豁免语义措辞 → 历史文档已迁 `osuperpowers/{specs,plans}`、gate targets 不含之；residue.test.mjs 属 `scripts/` 机制位置，随迁清理其字面引防 §2.7 全仓 grep 额外命中，且其描述的 GATE 豁免语义随迁移同步变化后标题本身过期）。
- **grep-sweep-regression.test.mjs:14,65,72 过滤删除**：`docs/superpowers/{specs,plans,tickets}` 三个 `grep -v` 过滤器移除——迁移后历史文档落 `osuperpowers/` 根下，不在 sweep scope（`packages/ docs/ README.md marketplace/`），过滤器变死代码。grepCount 基线复跑确认各 sweep 仍 0 命中。

### §2.5 active 约定文档路径同步

| 文件 | 变更 |
|---|---|
| `skills/writing-plans/SKILL.md:34` | 落点 `osuperpowers/plans/YYYY-MM-DD-\<feature\>.md`；spec-link 约定 `(osuperpowers/specs/\<name\>-design.md)` |
| `skills/brainstorming/SKILL.md:67,68` | read-program 约定 `docs/superpowers/specs/*-overall.md` → `osuperpowers/specs/*-overall.md` |
| `skills/brainstorming/docs/overall-spec-template.md:36` | `docs/superpowers/` → `osuperpowers/` |
| `skills/report-issue/templates/finding-meta.json:286` | placeholder overall 路径 → `osuperpowers/specs/2026-09-04-cdd-engine-overhaul-overall.md`（迁移后该 overall 真实落此，placeholder 变有效示例） |
| 根 `CLAUDE.md:87` | Strategy B `docs/superpowers/{specs,plans}/*.md` → `osuperpowers/{specs,plans}/*.md` |
| `docs/maintainers/osuperpowers-plugin.md:38-43` | 「`docs/superpowers/` conventions」节 → `osuperpowers/` conventions + 相对链接修正（`docs/maintainers/` → `../../osuperpowers/{specs,plans}/`） |

`packages/osuperpowers/.agents/` 与 `.github/ISSUE_TEMPLATE/session_report.yml` 为 `pnpm run emit` **派生产物**（不手编，随上游 canonical 改动再生）：`.agents/` 镜像 skills；`session_report.yml` 经 `scripts/emit/issue-templates.mjs` 由 finding-meta.json 再生成——其 `:36` placeholder「Overall spec: docs/superpowers/specs/…」与 finding-meta:286 同文，随 §2.5 finding-meta 迁移后 part emit 落新路径。

### §2.6 tickets 死引用全移除（用户 2026-09-14 指令）

tickets 系统经脑暴实证**全死**（writing-plans SKILL.md 无 Rules、无 `/to-tickets` 委托、`digraph-consistency.test` 钉死零 `## Rules` 头、无 tickets 目录、零 tickets artifact）。移除面：

| 位置 | 处置 |
|---|---|
| `skills/brainstorming/docs/overall-spec-template.md:43` | 删 `Phase tickets` 行（template 消费面） |
| `packages/osuperpowers/README.md:9` | 删「ticket publish redirection」示例项（**发布面文件**——根 README 无 ticket 文本） |
| `packages/osuperpowers/README.md:17` | 删「tickets to `docs/superpowers/tickets/`」从句 |
| `docs/maintainers/osuperpowers-plugin.md:24` | ① Tickets Publish Redirect canonical 示例**重写**为真实委托形态——当前 writing-plans 全量委托上游 session 无 tickets 步骤——清除 `docs/superpowers/tickets/…` 路径字符串；② **(b) delegates 列表去 `to-tickets`**（当前无任何 skills 委托之，虚假委托声明） |
| `docs/maintainers/osuperpowers-plugin.md:202` | SDD/ticket execution 规则**去 ticket 框架**：保留执行纪律意图（approved plan 内逐 unit commit 后不追问），措辞改为 task/unit |
| `docs/maintainers/osuperpowers-plugin.md:204` | Execution continuity「each ticket」→ 去 ticket 措辞（保留「plan 运行中不逐问『要继续吗』」discipline） |
| `scripts/release/publish-vendor.test.mjs:163,373,444` | ① 删 fixture 行 `"./skills/to-tickets",`（合成清单 21 → 20 项）；② **连带阈值同步**——`:373`/`:444` 的 `expect(…skills.length >= 21)` → `>= 20`（实测删行后 `2 failed \| 43 passed`；该测试的成员数阈值确依赖此 fixture 集合） |
| `README.md:27` | vendored 表行去 `to-tickets`（`Precision tools -- \`grilling\`, \`tdd\``）——本仓文档只列本体系实际采用的 vendored skills（用户 2026-09-14 补充裁定） |
| `README.zh-CN.md:27` | 同（`精准工具——\`grilling\`、\`tdd\``） |
| `CLAUDE.md:21` | mattpocock-skills 描述行去 `to-tickets`（`Engineering precision skills (grilling, tdd, research)`） |

**范围外**：① `vendors/mattpocock-skills/skills/engineering/to-tickets/` 物理目录——vendored 子模块不可改，无生产引用即无残留；② **在途程序文档**（`osuperpowers/{specs,plans}/2026-09-13-osuperpowers-overhaul*`）——本 phase 的 tickets 移除叙述必现身其中（与 §2.7 同构豁免）。**目标终态 = 全仓（除上述两类 + `tmp/`〔gitignored publish-vendor 副本来场〕+ `.osuperpowers/`〔gitignored 运行时面〕）零 `ticket`/`tickets` 引用**——39 历史文档与 `.changeset/` 实证零提及。铁律：本体系**生产/委托/模板/发布面/文档清单**引用（上表 10 处）全部清除。

### §2.7 记录豁免集（grilling Q1 → 决策 A：务实字面零 + 在途记录豁免，用户 2026-09-14 确认）

「零 `docs/superpowers` 残留」豁免**在途程序文档 + 历史记录**（与 CHANGELOG 同性）——**模式化豁免集**：

- ① `osuperpowers/{specs,plans}/2026-09-13-osuperpowers-overhaul*`（在途 program 全部文档：overall File paths 节 + P1-design/P1-plan「P2 职责」注记 + **本 P2-design 自身的迁移叙述 + P2-plan（writing-plans 后续产出）**——凡在途 program 文档必携迁移前因，一律豁免）
- ② `.changeset/`（历史记录；不在 `osuperpowers/` grep scope 内，仅全仓 grep 时出现）

验证 grep 口径与豁免集**同 scope 相对**（保证「命中集 == 豁免集」字面可满足）：① `grep -rn "docs/superpowers" osuperpowers/` → 命中集 == 豁免集 ①（在途 `2026-09-13-osuperpowers-overhaul*` 文件）；② 全仓 `grep -rn "docs/superpowers" --exclude-dir=vendors --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=.osuperpowers --exclude-dir=tmp` → 命中集 == 豁免集 ①∪②。**`.osuperpowers/` + `tmp/` 显式排除**：前者 gitignored 运行时面（review/fix handoffs 必引述被审文档旧语汇——spec-review-1.json 已含 5 次）；后者 gitignored（publish-vendor 测试反复再生的 vendored 副本，实测全仓 `docs/superpowers` 261 行中 93 行、`ticket` 512 行中 453 行来自 `tmp/`）。**本机 shell 的 grep 包裹行为（respect .gitignore）不可依赖**，故显式传 `--exclude-dir`（等价可用 `git grep` 仅扫 tracked）。**`ticket`/`tickets` 残留同口径**：本 phase 移除叙述必现身于在途程序文档（p2-design / p2-plan），故 `ticket` 度量与 `docs/superpowers` 同构——扫面相同、命中集同样 == 在途 `2026-09-13-osuperpowers-overhaul*`。其余（历史 39 重写后、engine/skills/scripts/README/CLAUDE.md/maintainer、`.agents/` 与 `.github/ISSUE_TEMPLATE/session_report.yml` emit 再生后）全零。**度量口径：文件级**（`grep -rl`；54 次/53 行是 §2.1 重写度量，非残留校验度量）。

### §2.8 changeset 与版本

`@oscaner-skills/cdd-engine` **minor** changeset（rootFromDocPath 新布局识别 + validator 单根收敛 + 守卫；P1–P3 engine-only 惯例，osuperpowers 本次不 bump，P4 再计）。changeset 文件 POSIX `\n` 终止（c2e9b7d 先例）。

### §2.9 验证

1. `pnpm --filter @oscaner-skills/cdd-engine test` — engine suite（handoff-naming / cdd / docs-runner 三个夹具文件新布局）
2. `pnpm run emit`（**根入口** `node scripts/run.mjs emit` 全仓推导 source.json + 各 harness manifest + `.agents/`；`packages/osuperpowers/package.json` 无 scripts 字段、子目录无 emit 入口，不得穿目录执行）— skills/templates 改动后必跑
3. `node scripts/run.mjs validate` — 13 块全绿（5c 新 stale-lexicon 零命中；12 overall-consistency 4 overall 全过）
4. `pnpm run emit:check` — drift 0
5. 残留 grep（§2.7）恰等于记录豁免集
6. `ls docs/` → 仅 `maintainers/`；`docs/superpowers/` 不存在

### Acceptance criteria

- `AC1` `docs/superpowers/` 目录不存在（`ls docs/` 仅 `maintainers/`）；`osuperpowers/specs/` = 24 文件（21 历史 + overall + P1-design + P2-design）、`osuperpowers/plans/` = 20 文件（18 历史 + P1 + P2 plan）——**P2 完成时点**度量；39 文件 git mv 历史保留（`git log --follow` 可追溯）
- `AC2` `rootFromDocPath("/repo/osuperpowers/specs/foo-design.md")` → `/repo`；`rootFromDocPath("/repo/.osuperpowers/cdd/x/review-1.json")` → null（运行根不误匹配）；`naming.mjs` 零 `docs/superpowers` 字符串
- `AC3` 21 个历史文件 54 次 `docs/superpowers` 出现（53 行）已重写为 `osuperpowers`；`grep -rl "docs/superpowers" osuperpowers/` 命中 == 在途 `2026-09-13-osuperpowers-overhaul*` 文件集（§2.7 度量口径）；**全部 plan 的 `**Spec:**` 头链接迁移后均指向存在文件**（行为性断言，实测量 10 处以 plan 阶段为准，不作为计数验收）
- `AC4` `node scripts/run.mjs validate` 13 块全绿；residue 5c 新增 `docs/superpowers` stale-lexicon 机制位置零命中；grep-sweep 各 sweep（old bin 名 / cdd-reference / subagent-driven-development / HARD-GATE / --prompt）在过滤移除后仍 0 命中
- `AC5` active 约定文档（writing-plans / brainstorming SKILL.md、overall-spec-template、finding-meta、根 CLAUDE.md、packages/osuperpowers/README.md、maintainer-doc）零 `docs/superpowers` 路径字符串；tickets 移除面 **10 处**全部落地——零 `ticket`/`tickets` 引用（范围外：vendored 物理目录 + 在途程序文档的移除叙述）
- `AC6` overall-consistency 对 4 个 overall 全过（新 overall 首次入守卫不误报）；`pnpm run emit` fresh / `emit:check` drift 0
- `AC7` engine suite vitest 全绿（handoff-naming / cdd / docs-runner 新布局 fixture）

---

## Section 3: Deviations from overall

| Overall assumption | Phase decision | Overall updated? |
|---|---|---|
| P2 不涉 tickets 概念 | tickets（`overall-spec-template` 行 / README 两处 / maintainer-doc 三处 / publish-vendor fixture）为死残留，随「residue 豁免路径 + README/CLAUDE.md/maintainer docs 同步」scope 一并移除（用户 2026-09-14 指令） | No — 属 P2 scope 内执行细化（零残留 + 路径同步的自然组成），非 cross-phase scope 变更 |
| — | `rootFromDocPath` drop `docs/superpowers` 旧 marker（P1 design line 48/128 预留「P2 职责」） | No — 即 P2 scope 既定内容 |

---

## Section 4: Notes for downstream

- **P4 / P5 / P6**：新 doc 约定 root = `osuperpowers/{specs,plans}`；不得在 skill/template/validator 回引 `docs/superpowers`（新增 stale-lexicon 守卫兜底）。
- **P6**：「maintainer docs 与落地行为一致」收口项接收 `docs/maintainers/osuperpowers-plugin.md` 中 `## Rules`/overrides 架构描述的**更深深陈面**（本 phase 仅清路径字符串 + tickets 死引用，未整体重写 overrides 描述）。
- **record**：in-flight overall + P1 spec/plan 的 `docs/superpowers` 迁移叙述为豁免记录，P2 不动；P3–P6 新增文档不得携带旧路径。

---

## Section 5: Review

Rule: `cdd review --type spec --spec <path>` per Review Stopping（`_docs/review.md`）。spec-1 评审 → findings 全 fix → blocker=0 → user-confirm-commit → commit → writing-plans。