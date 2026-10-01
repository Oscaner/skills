# osuperpowers

## 0.2.0

### Minor Changes

- [#281](https://github.com/Oscaner/skills/pull/281) [`7177ae5`](https://github.com/Oscaner/skills/commit/7177ae5e84a9279410bcf075ea33a8325306f637) Thanks [@Oscaner](https://github.com/Oscaner)! - P4.2 consumer-parity 宣讲定位面收尾 + pack 内容面清理（osuperpowers minor）。
  
  - **宣讲定位面（repo 定位改述 cdd 方法论）**：README **三段式骨架（定位 → 理念 → 行为）**——定位句 `A cdd-first methodology: continuously-discovered development as the core discipline, AI coding skills as the distribution vehicle.`（**无 harness 字样**，harness 宣称面维持 P6 B1 中性「多 harness 可消费」，未来加 harness 零约束）+ cdd 理念导览章节（cdd 是什么 · 为什么这样设计 · 三种模式链 implement → review → fix · Review Convergence 等收敛纪律）+ osuperpowers 理念导览；行为面 = P4.1 重写成果原样承接；CLAUDE.md 定位句 + Non-goal [#1](https://github.com/Oscaner/skills/issues/1) 例外（schema get + issue render 双豁免零执法子命令）；zh mirror **三件全量同步**（根 + 两包 `README.zh-CN.md`，语言切换行 `[中文]` 维持不变）。
  - **pack 内容面清理（数据面单源）**：包内 `scripts/` + `bin/` **整删**（`scripts/report-templates.mjs` 迁 engine、`scripts/render-yaml.mjs` 迁 repo 治理面、`bin/utils/exit.mjs` 死代码删除）+ `files` 白名单收敛 **7 项**（`skills/` · `.claude-plugin/` · `.cursor-plugin/` · `README.md` · `README.zh-CN.md` · `CHANGELOG.md` · `package.json`）——零 `tests/`、`bin/`、`scripts/`、`.superpowers/`、`.version-bump.json` 进包；report-issues I5 改「body 由 `cdd issue render` 直出」+ pluginRoot 寻址删除；emit repoint（issue-templates finding-meta 消费改从 engine import）、emit:check 零 drift。
  
  > **Semver 说明**：宣讲面与包内容面为**消费者可见行为变更**（README/CLAUDE.md 宣称面改写 + 发布包 contents 收缩），按 minor 发布（P6 osuperpowers-surface 同尺度先例）；随 pending minors 折叠至 **0.2.0**（0.1.1 基线 + 原生 changesets minor 集合）。

- [#277](https://github.com/Oscaner/skills/pull/277) [`f8b0f41`](https://github.com/Oscaner/skills/commit/f8b0f418cf02672598894a2e2739b5e8f0451d0b) Thanks [@Oscaner](https://github.com/Oscaner)! - P4.3 consumer-parity 宣讲面收口：`--task` → `--tasks` 别名零替换全量完成 + 守卫 fixture 与 consumer-sim 链同步。
  
  **cdd-engine（breaking → major，1.0.0 → 2.0.0）**：
  
  - **`--task` → `--tasks` 全替换零别名（BREAKING）**：dispatch-group 语义下任务派发单位是组（`--tasks <n|n,n,…>`，singleton 组等于原每任务派发）；单数 `--task` 已从 CLI 解析面整删（unknown-option exit 2）。本 changeset 收口最后文档表层：cdd-engine 包 README 族（README.md / README.zh-CN.md 的 implement 表行 + review 选项列举共 4 行）示例迁 `--tasks`，zh-CN mirror 同步。
  - **守卫 fixture 同步**：residue 守卫测试合成 fixture 字面量迁 `--tasks`——retired-`brief` 守卫 argv（`cdd brief --tasks 1 …`，与 cli-shape 退役命令全形断言同构）+ skills 面 `cdd fix` 命令形 fixture，anti-reintroduce 行为断言保留；smoke-cdd consumer-sim fix 链 `--findings` 路径字面量随 Task 2 组命名迁 canonical 形 `tasks-1-review-1.json`（`tasksKey([1])` = `"1"` 派生的 singleton-group handoff 名）。
  
  **osuperpowers（minor，0.1.1 → 0.2.0）**：skills 文本更新——cli-driven-development SKILL.md 面向 dispatch-group 的 `--tasks` 文案面由本 phase 收敛（评审循环 fix 节点命令形 `cdd fix --type task --tasks <n> …`）；consumer-surface purity 归位（CLAUDE.md 铁律）——cli-driven-development SKILL.md 的 `## Full Flow Refactor Rationale` 章节移除、消费面零残留（设计 rationale 迁仓内 maintainer skill-authoring 文档 §9.1 注册表，SKILL.md 不留任何 note/锚），机器断言面同步（digraph-consistency.test.mjs Assertion 3：越界 skill 的 rationale 必须注册在 maintainer 侧 + SKILL.md 零 growth/refactor narrative heading）。
  
  > **semver 说明**：CLI 选项整删/更名（`--task` → `--tasks`）为 breaking，cdd-engine 按 major 发布；消费者迁移面：一切派发命令以 `--tasks <n|n,n,…>` 取代 `--task <n>`，产物名随组键（`tasks-{a}-{b}-*`）不再出现 `task-N-*` 形。

- [#280](https://github.com/Oscaner/skills/pull/280) [`9e76f6d`](https://github.com/Oscaner/skills/commit/9e76f6dab6477350b9ad3ff40f952e10230ee2ce) Thanks [@Oscaner](https://github.com/Oscaner)! - P4.4 consumer-parity 收口——skills 文本语义迁移（三件套：Review Convergence 三段表述 · Pending Acceptance Patch 移除 · task groups 裁定迁移 + loop 更名）。
  
  - **五面 Review Convergence 三段表述（writing-single-spec / writing-overall-spec / writing-phase-spec / writing-plans I1 + cli-driven-development I3）**：`REVIEW_FIX` 状态词汇同名入文本（1.0.0 收口面）——S1 blocker>0 → `cdd fix` 后 re-review（循环至收敛）· S2 blocker=0∧warn/nit>0 → `cdd fix` 收口轮（REVIEW_FIX — 无 re-review）· S3 零 finding → 批准收敛；review/fix 节点路径同步承载三段语义。
  - **Pending Acceptance Patch 移除（[#279](https://github.com/Oscaner/skills/issues/279)）**：writing-plans `## Pending Acceptance Patch` 条件节（finding-tag 约定 · zone shape · Task 14 样例）整删；I3 改为 **Plan Sole Writer**（跨 task 裁决由 orchestrator 直写目标 task 的 **Do** 与 **验收**，fix/implement agents 零 plan 修改权）；cli-driven-development **I6 整条删**；两件 fix 节点「LATER task / targets later task tag」句删；I7 → I6 改指 Plan Sole Writer；五面 Mid-Flight Backfill 尾部路由句改「routes through the orchestrator as Plan Sole Writer」。
  - **task groups 裁定迁移 + loop 更名**：writing-plans author-plan 内 tasks 写毕即**非交互**裁定分组落盘（`## Task Groups` 节 + plan `taskGroups` 声明 · 无 AskUserQuestion · 零分组无节、默认全单组）；cli-driven-development 移除 `adjudicate-task-groups` 节点/定义与 `task-groups-undecided` 拒答终端（`C → D` 直连），**loop 更名 `group-implement-review-fix`**（`implement-group` / `run-group-review` / `fix-group` 节点名 · `more-groups?` 保留 · 组列表 = 声明合并组 ∪ 未覆盖任务单组（经 engine `effectiveGroups` 派生结果），每组分一个 `--tasks`）。
  
  > **Semver 说明**：skill 编排语义迁移为行为变化，osuperpowers 按 minor 发布；消费者迁移面 = orchestration 流程文本按新节点名与三段结案语义执行。

- [#261](https://github.com/Oscaner/skills/pull/261) [`6233932`](https://github.com/Oscaner/skills/commit/62339329cc7d14e1d91c5e8fe81f5e9ca11e8bc1) Thanks [@Oscaner](https://github.com/Oscaner)! - P3 cdd 命令面收敛：`cdd` 子命令由 6 收敛为 4（implement / review / fix / base-branch）。
  
  - **`cdd brief` 删除**：零消费者——engine 已在 implement 的 plan 定稿处自给 brief（`run-task.mjs` F11：`generateBrief` + `CDD_TASK_BRIEF` override 写/读同源 + dir bootstrap）；`lib/brief.mjs#generateBrief` 保留供 run-task。
  - **`cdd research` 删除**：唯一消费者 `cli-research` skill 一并删除（删除命令必须同步其唯一调用方）；`lib/cli/research.mjs`（`RESEARCH_METHODOLOGY` / `buildResearchPrompt` / `writeFindings` / `runResearch`）与 `lib/cli/brief.mjs`（`runBriefCli`）整文件移除。
  - **级联死配置连根**：`DEFAULT_TIMEOUTS.research` / `modeEnv.research`（`CDD_RESEARCH_TIMEOUT`）/ `LEGACY_MODE_ENV` 整表及 `resolveTimeoutMs` 的 legacy 分支 / 零生产者的 `lib/brief.mjs#validateBrief`。
  - **防回渗守卫**：新增 stale-lexicon 两条（命令形 `/\bcdd (brief|research)\b/` + `/RESEARCH_TIMEOUT/`）——命令形刻意非裸词，保留 `/mattpocock-skills:research` 会话调用的合法空间。
  
  > **semver 说明**：`cdd brief` / `cdd research` 的删除实为 **breaking**（如实应为 `cdd-engine` major），本次按 minor 发布。

- [#262](https://github.com/Oscaner/skills/pull/262) [`1d33809`](https://github.com/Oscaner/skills/commit/1d3380989e281130a8fbaafa4479125d512e98f0) Thanks [@Oscaner](https://github.com/Oscaner)! - P4 engine 契约面重构 + skills 面全面重写（含行为兼容性变更）。
  
  **cdd-engine — 契约面重构：**
  
  - **单一坐标系**：CLI 内容路径入参（plan / doc / path 等）统一为**仓根相对**解析，绝对路径直用；不再保留 cwd 相对回落。路径未命中时退出码固定为 1，诊断恒为三行（含实际尝试路径）。
  - **单根收敛**：cwd → 仓根转换在 bin + lib 内收口为唯一一处，子进程与生命周期路径全部自根派生。
  - 失败分支契约回正：BLOCKED 载荷由引擎字面量填充、恢复载荷不依赖对象展开语义、progress 透传与派发输出格式保持一致。
  
  > **semver 说明**：CLI 路径语义由 cwd 相对改为仓根相对**实为 breaking**，本次按 minor 发布。
  
  **osuperpowers — skills 面全面重写（8 个）：**
  
  - 新增三个 spec-writer：writing-single-spec / writing-overall-spec / writing-phase-spec；
  - 委托型重写：brainstorming / writing-plans / finishing；
  - 原生型重写：cli-driven-development + report-issue 精简。
  - **`init` 删除**：技能集收敛为编排型 8 个。

- [#263](https://github.com/Oscaner/skills/pull/263) [`09dee9f`](https://github.com/Oscaner/skills/commit/09dee9faf79f7cb72433588c089edcd9ae4edf51) Thanks [@Oscaner](https://github.com/Oscaner)! - P5 report-issues 聚合形态 + renderer/表单/label 收敛（report-issue → report-issues）。
  
  **改名与聚合流程精炼：**
  
  - `report-issue` → `report-issues`：skill 目录 / SKILL.md frontmatter / context 引用 / finding-meta components / README / emit 产物全面更名，新复数名含防回渗守卫（词边界 `\breport-issue\b`）。
  - findings 聚合流程重构为单趟主动聚合（explore-current-session → collect → reform → confirm → dedup → create-issue? 分支）：中性 topic 直出标题（取消 `[Session report] <slug> <date>` 壳前缀），单新 issue 聚合全部 findings + dedup links；全部 open-dedup 命中 → 不建空 issue、仅报链接清单（report-links-only）。
  - dedup 单趟拉取 + 90 天窗口（运行期物化 ISO 绝对日期查询句）。
  - report-meta 精简至终态 2+1：per-finding `Skill`/`Step` 两字段 + issue 级 `Harness` 一行；`kind`/`date`/`standalone` 语汇删除。
  
  **renderer 单模式重构：**
  
  - 裸调用单入口直出聚合 body（删 `--mode` / renderComment / renderTitle / 模式分派；renderMasterBody 收敛为聚合渲染）；CLI 入参结构校验失败 exit 1 + 违规字段路径。
  
  **ISSUE_TEMPLATE 瘦身 + label 收敛：**
  
  - 表单 3 → 2（删 `session_report.yml` + session-type 下拉 + `sessionTypes` 枚举）；`resolveDropdownOptions` 函数删除，唯一 dropdown 直引 `enums.components`。
  - labels 单点 SOT 迁 `reportDef.labels` = `["osuperpowers","cdd-engine"]`；GitHub label rename `cdd` → `cdd-engine`（历史 issue 随迁）。
  
  **renderYml/yaml 隔离为 emit-only 模块（非依赖新增）：**
  
  - 手写 YAML builder（emitScalar / isPlainUnsafe）替换为 `yaml.stringify`，但其载体 `render-yaml.mjs` 隔离为 **emit-only 模块**（仅 `scripts/emit/*.mjs` 消费）——`yaml` 只入仓库根 devDependencies（emit 工具链），osuperpowers `package.json#dependencies` **零新增**，消费者运行时入口零 `yaml` import、**零新增依赖**。

- [#264](https://github.com/Oscaner/skills/pull/264) [`8281ef4`](https://github.com/Oscaner/skills/commit/8281ef4f7c3304c4e516218580161ab0a2904752) Thanks [@Oscaner](https://github.com/Oscaner)! - P6 插件面收缩（osuperpowers minor）——两个 surface 变更合并发布：
  
  - **能力宣称收缩（T1）**：README / README.zh-CN / CLAUDE.md 移除 8-harness 宣称，收敛为 claude / cursor-agent 两证实 harness + 中性「多 harness 可消费」；README.zh-CN 清理陈旧面（`docs/gate-install.md` 死引用 · 已删 harness 表 · 未证实 harness 行）；`oscaner-plugin.claude.keywords` 去 `droid`/`pi` + 死 `pi` manifest 字段删；`.agents/` emit 面移除（emit 产物集收敛 `.claude-plugin`/`.cursor-plugin`/marketplace/ISSUE_TEMPLATE）。
  - **vendors 自维护面全撤（T2）**：submodule workflows（submodule-sync/bump）+ release `publish-vendor` 步 + `.gitmodules` 三条目 + `vendors/` 目录移除；`scripts/release/{publish-vendor,bump-submodule,submodule-tags,vendor-assembly,vendor-registry}` 整删；marketplace 产物收敛为 osuperpowers 单一 first-party 条目（`resolveVendorVersion` 连带删除，validate 13→12 块）；README/zh 插件表改指上游（保留三个官方安装命令引用）+ stale-lexicon 防回渗守卫。
  
  > **Semver note**: 能力收缩 + vendors 撤除为散发的**消费者可见行为变更**（发现面 keywords / manifest 产物集 / README 宣称 / 安装维护指引），无新增破坏面——按 minor 发布。

### Patch Changes

- Updated dependencies [[`6bf48a3`](https://github.com/Oscaner/skills/commit/6bf48a35c5a2f1b5f87993757a352ed0162cc1b3), [`7177ae5`](https://github.com/Oscaner/skills/commit/7177ae5e84a9279410bcf075ea33a8325306f637), [`75669f7`](https://github.com/Oscaner/skills/commit/75669f7bf3881938722ea0487a88e3c0cacc31e9), [`f8b0f41`](https://github.com/Oscaner/skills/commit/f8b0f418cf02672598894a2e2739b5e8f0451d0b), [`be4432c`](https://github.com/Oscaner/skills/commit/be4432c1900b94540801d5e3293bc8875e8e2e0e), [`ad973c4`](https://github.com/Oscaner/skills/commit/ad973c42d5fcf48ab594aa641222dcd014262e19), [`9e76f6d`](https://github.com/Oscaner/skills/commit/9e76f6dab6477350b9ad3ff40f952e10230ee2ce), [`91bd5e9`](https://github.com/Oscaner/skills/commit/91bd5e9e3f79a274b47dbe8974a2a40fe4bacd18), [`6814592`](https://github.com/Oscaner/skills/commit/68145921e033e0e26388e24e69ddd3f0ca64709a), [`9c6148d`](https://github.com/Oscaner/skills/commit/9c6148dd807b4f64e27fbc8c7c1da818b1e00132), [`6233932`](https://github.com/Oscaner/skills/commit/62339329cc7d14e1d91c5e8fe81f5e9ca11e8bc1), [`1d33809`](https://github.com/Oscaner/skills/commit/1d3380989e281130a8fbaafa4479125d512e98f0), [`09dee9f`](https://github.com/Oscaner/skills/commit/09dee9faf79f7cb72433588c089edcd9ae4edf51), [`8281ef4`](https://github.com/Oscaner/skills/commit/8281ef4f7c3304c4e516218580161ab0a2904752), [`8281ef4`](https://github.com/Oscaner/skills/commit/8281ef4f7c3304c4e516218580161ab0a2904752)]:
  - @oscaner-skills/cdd-engine@1.0.0

## 0.1.1

### Patch Changes

- osuperpowers P1 — plugin skeleton + `cli-*` family + droid/pi harnesses + CLI mode rework.
  
  - Created the os-engineering plugin: marketplace/source.json registration, plugin.json, CI validate integration.
  - Reorganized the SDD harness mechanism: declarative harness registry (JSON: harness → cli_bin / invocation flags / output format / review_prefix / ship level) + a single generic runner `cdd-run.sh` (`--harness <name> --task N --mode …` / `--plan`); deleted per-harness wrapper and stub scripts.
  - Added droid and pi as full harnesses (stream-json parsing / `--auto` level / completion sentinel).
  - Full sdd → cdd rename: `SDD_*` → `CDD_*` env vars, `cdd-common.sh`, `cdd-run.sh`, workspace `.superpowers/sdd/` → `.superpowers/cdd/`, `docs/cdd-reference.md`, `templates/cdd/`.
  - New `cli-*` skills: `cli-select` (installed-harness listing + recommendation), `cli-task` (generic one-shot dispatch), `cli-driven-development` (three-mode chain), `cli-code-review`.

- osuperpowers P2 — `os-*` orchestrator family extraction (core-set audit, 8 skills).
  
  - 8 standalone flow-orchestration skills: `os-brainstorming` / `os-writing-plans` / `os-executing-plans` (three-mode master orchestrator: in-session → upstream executing-plans / subagent → subagent-driven-development / cli → `cli-driven-development`) / `os-finishing` (with worktree refusal) / `os-verification` / `os-debugging` / `os-code-review` / `os-report-issue`.
  - Deliberately non-1:1 mappings: tdd maps directly to mattpocock (seam gate folded into cdd implement), executing-plans maps to os-executing-plans, p0-fallback deleted.
  - Cross-cutting docs (`spor-subagent-lifecycle`, `spor-token-efficient-review-dispatch`) demoted to plugin docs; overall + phase templates moved in.
  - Gate mode-awareness: `pending.mode` (in-session / subagent / cli — cli strictly gated, others allow repo edits).

- osuperpowers P3 — thin router + superpowers-style emission.
  
  - osuperpowers-router reduced to a **trigger router** (plugin-root, claude + cursor): manifest triggers → target table (`spor-*` → `os-*`/`cli-*`/mattpocock tdd), hooks/expansion/self-check point at `os-*`/`cli-*`; all `spor-*` skills deleted; numbered rule-reference mode retired.
  - os-engineering = skills + engine + gate: gate fully migrated (PreToolUse hooks), `os-init` landed (parameterized), independent versioning.
  - Unified emit tool (`pnpm run emit`): generates all first-party products from source.json — thin claude/cursor/codex/kimi/gemini/pi manifests pointing at `skills/` + GEMINI.md + shared `.agents/skills/` + router hooks/self-check + version sync.
  - Dropped rovo/vibe/kiro native emission (no native installer; the gate surface was later restored in P4b).

- osuperpowers P4 — publishing architecture v2 (package-as-source) + gate surface ported to Node.
  
  - Directory rework: `packages/` (first-party) + `vendors/` (upstream submodule sources: superpowers / mattpocock-skills / impeccable — never edited); `package.json#oscaner-plugin` is the single metadata source of truth (marketplace/source.json derived).
  - pnpm workspace + changesets version and publish all `@oscaner-skills/*` packages together (vendored plugins republished via build-time assembly, upstream attribution preserved).
  - Marketplace + harness manifests generated from packages; a future plugin = add a package directory, automatically wired into emit + publishing.
  - Gate surface ported to Node: `cdd-gate-core` + thin CLI (single `gateDecide` implementation); 7 native-hook gate adapters (grok/qoder/trae/codex/gemini/vibe/kiro) + opencode/pi TypeScript adapters (shipped with the package); per-harness gate manifest wiring; ~800 lines of bash eliminated.
  - The `os-init gates` concept landed (later superseded by the P6b `init harness` installer).

- osuperpowers P5 — CDD engine + CI + test scripts ported to Node (single-language closure).
  
  - All bash engine scripts (`cdd-common.sh` / `cdd-run.sh` / `cdd-exec.sh` / `cdd-select.sh` / `cdd-session-activate.sh`, ~3000 lines) migrated to Node (.mjs); core modules (harness registry, exit utils, templates, ledger, runner/contract H6 chain) ported.
  - `ci-validate.mjs` unifies the 12-block validate orchestration.
  - All shell tests and `rule-reference.test.py` migrated to `node:test` (engine + gate + init + utils module trees).
  - End state: single-language Node executable surface (bash/node dual-stack retired).

- osuperpowers P6 — engine/flow hardening + delivery completion (install-and-use honesty).
  
  - **Harness pre-checks (P6a)**: before entering a nested CLI in every mode (implement/review/fix), probe per-harness availability of the required skills plugins (superpowers / mattpocock-skills / `@oscaner-skills/*` — no submodule assumption) plus plan/brief/templates presence; missing → exit 3 (install-and-use channel) / stderr hint (init channel) + per-harness install guidance; spec/plan review now runs through the CLI review mode (cdd-exec dispatch, D1/D2/D3 mapping).
  - **Delivery completion (P6b)**: pi key completed (skills + gate TS extension); gemini mattpocock-extension assembly with error guard; qoder/codex plugin manifests completed → genuine install-and-use; `init harness` per-harness installer (harness-detect → multi-select → native config writes + skills copy + manifest full-sync `{ osuperpowersVersion, files: { path → { hash, source } } }`); grok moved to install-and-use (Claude marketplace).
  - **Research integration (P6c)**: mattpocock-skills:research woven into the brainstorming flow (explore-context delegates to a research agent + findings markdown).

- osuperpowers P7 — brand unification + legacy-naming cleanup (zero tech debt).
  
  **P7a — package dir rename + emit adaptation**: `packages/engineering` → `packages/osuperpowers`, `packages/superpowers-overrides` → `packages/osuperpowers-router`; package.json (name/repository.directory/description), `scripts/emit.mjs`, `scripts/ci-validate.mjs` and emit tests synced; `pnpm run emit` regenerates every derived manifest.
  
  **P7b — skill dir rename + namespace**: 9 `skills/os-*` directories lose the `os-` prefix (`os-brainstorming` → `brainstorming`, etc.); namespace unified to `osuperpowers:*` (router target table, SKILL.md references, `skills/init/` self-check table, `.agents/skills` copies); emit namespace name updated.
  
  **P7c — version management + release pipeline**: `version-packages.mjs` package name → `@oscaner-skills/osuperpowers`; `release.yml` tag prefixes → `osuperpowers-router@`/`osuperpowers@`; opencode config, issue-template labels, GitHub labels, `.changeset/README.md` residual references cleaned; consumed changesets removed.
  
  **P7d — legacy-naming zero-tech-debt purge**: emit function names (`engineeringClaudeHooks`/`engineeringCursorHooks`/`engineeringHooksFor`/`emitOsEngineering` → `osuperpowers*`) + metadata (category/keywords/description); runtime pending root `${TMPDIR}/osuperpowers/pending-cdd` (hard cut — fail-open safe); harness channel `os-init` → `init` (hints unified to `osuperpowers:init harness <name>`); install surface `bin/os-init` → `bin/init`, manifest `~/.osuperpowers/state/`, artifact names `osuperpowers.json`/`osuperpowers.ts`, `osuperpowersVersion`/`OSUPERPOWERS_VERSION`, vibe hook `osuperpowers-cdd-gate`; plugin docs / skill bodies / router docs fully cleaned (incl. deleting the SUPERSEDED `sdd-h6-reference.md`); acceptance lanes redesigned (`-i` token patterns + filename scan + whitelists, replacing the easy-to-miss per-line `-v` grep); historical P7 docs + overall spec closed out (rename-record mapping tables exempt). `version-packages.mjs` gains a real `--dry-run` and rejects unknown arguments.

