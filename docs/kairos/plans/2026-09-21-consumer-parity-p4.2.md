# 消费者面一致性（Consumer Parity）— P4.2 发布一致性闭环 Implementation Plan

**Spec:** [2026-09-21-consumer-parity-p4.2-design.md](docs/kairos/specs/2026-09-21-consumer-parity-p4.2-design.md)
- **Parent program**: [consumer-parity overall v1.45](docs/kairos/specs/2026-09-21-consumer-parity-overall.md)
- **Version**: v1.2 · 2026-09-26（mid-backfill：Task 12 plan-constraints 每 TG 再生，2026-09-26 用户裁决）
- **Base**: develop
- **Depends on**: P4.4（shipped · [p4.4-design v1.9](docs/kairos/specs/2026-09-21-consumer-parity-p4.4-design.md)）

- **Interface 转录注记**: 各任务 `- **Consumes**: 刻意留空（树迁移 B 转录决策）——源 Do 散文未承载独立具名输入事实，consumes（Task 记录 interface 可选项）不填充；任务输入由 DependsOn/AtomicWith 声明边与 objective/steps 承载，consumer-parity p1–p4.1 因承接具名输入事实而全量填充。

## Constraints

### 破坏性变更窗口（收口终局）
P4.4 已在 1.0.0 门前收齐全部 breaking（OOP restructure / 4 major deps / REVIEW_FIX 词汇 / PAP 移除）；本 phase **不再开新的 breaking 面**——`cdd issue render` 为**新增面**（Non-goal #1 例外扩入，非 breaking）；版本管线换血为 repo 侧治理变更（不落消费者包 changelog 语义面）；cdd-engine 首次稳定开版 = `0.1.0 + pending majors → 1.0.0`（原生 changesets 自然产出，不起跳 2.0.0）。历史终态不回滚。

### 发布零手工版本
任何版本号不得手写——版本动作 = 原生 `changeset version`（main 上 changesets/action）；本 phase 唯一手动版本动作 = Task 1 的 cdd-engine 声明值降值（修正从未发布的预定值）。`--expect-version` 断言值 1.0.0 由设计定死。

### 依赖方向铁律（repo → engine 单向）
repo 治理面（scripts/emit · scripts/validate · release.yml）可依赖 engine；**shipped 包（osuperpowers / cdd-engine）→ repo scripts 禁止**——finding-meta 迁 engine 后 osuperpowers 包内 scripts/bin 面零残留；render-yaml.mjs 迁 repo 治理面后不再被包消费。

### 四表纪律
回填 = branch-review 前置义务（backfill-overall 由 orchestration 于 branch-review 前执行）；结构性 mismatch → BLOCK；本 plan 终结态（plan complete）落地后 P4.2 行 Design-spec（已完成 v1.1）/ Implementation plan 列按 closeout 规则回填（Task 11 收口位）。

### spec 目标偏离（maintainers 收敛锚）
Task 9 的 **≤53KB** 锚（编辑集推导下限：03-context-caching 活契约保留不动 + 02/05 终态登记净增 = 不可动先验）与已批准 spec（v1.1 freeze）§5 净目标「62.6KB → ~42KB（-33%）」/ §6 Acceptance「62.6KB → ~42KB」**同面异值**——plan 单方重锚了 spec 承诺的验收面（plan-review-1 F2 授权「重锚为可由编辑集推出的值」，未授权取代 spec 验收数字）；spec 冻结无法就地吸收。本声明登记偏离并路由裁决：42KB 上界 46.2KB 在保留 03 活契约 + 02/05 登记净增的先验下**不可达**（删 03 / 砍 02/05 均 out of scope），**待 orchestrator 开 spec fix 轮**将 spec §5/§6 的 42KB（-33%）修订为 ≤53KB 推导值；修订前 Task 9 验收与 Task 11 ⑤ 探针一律以 **plan 锚 ≤53KB** 为判据（不按 spec 旧值判不合格，四表 closeout 口径一致）；spec 修订落盘后回填本声明。

### 语言政策
本 plan 中文主源（Strategy B）；SKILL.md / docs / README 英文主源（Strategy A）——宣讲面（Task 8）为英文原文面，zh mirror 三件全量同步；docs/maintainers 遵循 English-primary。值 token（phase id / tag / SHA / 路径）中立。

### engine 直调与零过滤
`node packages/cdd-engine/dist/cli.mjs`（`pnpm --filter @oscaner-skills/cdd-engine dev:stub` 材料化；不走 global register）；skills 调用 cdd 输出零过滤（禁 `tail`/`head`/`2>&1 |`/`EXIT=$?`）。

### emit 输入面
report-issues SKILL.md I5 改述（**Task 6 ④**：body 由 `cdd issue render` 直出 + pluginRoot 寻址删除；全形 `packages/osuperpowers/skills/report-issues`）+ **Task 7** 包内 `scripts/`+`bin/` 整删 + emit repoint（issue-templates import 重指，不涉技能文本）× README/CLAUDE.md 宣讲面（Task 8）为 emit 输入面/引用面——改动后核对 `pnpm run emit` 需求与 `emit:check` 无 drift；`.claude-plugin/`、`marketplace/` 等产物不手改。

### gh 外发
Task 10 对 GitHub 仓库元信息（description / topics）做外发变更——gh 操作显式 `--repo Oscaner/skills`；homepageUrl 留空非遗漏（无独立站点）。

### 死代码即删
空壳、死代码随拆即删（无过渡 shim · 无别名 · 无历史叙述豁免）；frozen 历史 docs（overhaul 族 / 已 shipped plan 与 overall change-history）不动；pack 白名单包住后留给消费者的面 = 纯技能 + 宣讲 + manifest。


### Task 1: 版本基线准备 — 降值 · 声称改写 · backlog 清除（TG1）

- **Objective**: 版本基线准备 — 降值 · 声称改写 · backlog 清除（TG1）：cdd-engine 声明 1.0.0→0.1.0 + p2-major 声称改写 + backlog ×6 删除

- **Produces**: `cdd-engine/package.json` version = 0.1.0（唯一手动版本动作）；`.changeset/consumer-parity-p2-major.md` 声称改写（1.0.0 首次稳定开版表述）；`backlog-*` ×6 零残留

- **Files**: packages/cdd-engine/package.json, .changeset/consumer-parity-p2-major.md, .changeset/backlog-cdd-engine-major.md, .changeset/backlog-cdd-engine-minor.md, .changeset/backlog-cdd-engine-patch.md, .changeset/backlog-osuperpowers-major.md, .changeset/backlog-osuperpowers-minor.md, .changeset/backlog-osuperpowers-patch.md

- **Steps**:
  1. ① `packages/cdd-engine/package.json` 声明值 `1.0.0 → 0.1.0`（从未发布的包，预定值归真；唯一手动版本动作——见 Constraints「发布零手工版本」） — checkable: `packages/cdd-engine/package.json` version 字段 = `0.1.0`（grep 断言）
  2. ② `.changeset/consumer-parity-p2-major.md` 声称改写——删「`1.0.0 → 2.0.0`；版本化发布动作归 P4」表述，改「P2 breaking 随 0.1.0 基线并入 **1.0.0 首次稳定开版**、不起跳 2.0.0；版本化发布动作归 P4.2」；`major` 类型保持 — checkable: `.changeset/consumer-parity-p2-major.md` 无 `1.0.0 → 2.0.0`、无 `归 P4，` 字样；含「1.0.0 首次稳定开版」表述（grep 断言）
  3. ③ `.changeset/backlog-{cdd-engine,osuperpowers}-{major,minor,patch}.md` 六件占位符 `git rm`（内容已被 overhaul p1–p6 真实 changeset 覆盖；零发布痕迹——不复写、不消费） — checkable: `git ls-files .changeset/backlog-*` = 空（六件占位符零残留）；无 pending changeset 内容被误删（overhaul 族 ×9 + consumer-parity-p4.3 + p4.4 族 ×5 = **15 件原样在场**，与 Task 11 ② 计数同形）

- **AtomicWith**: 2, 3

- **Acceptance**:
  - `packages/cdd-engine/package.json` version 字段 = `0.1.0`（grep 断言）
  - `.changeset/consumer-parity-p2-major.md` 无 `1.0.0 → 2.0.0`、无 `归 P4，` 字样；含「1.0.0 首次稳定开版」表述（grep 断言）
  - `git ls-files .changeset/backlog-*` = 空（六件占位符零残留）
  - 无 pending changeset 内容被误删（overhaul 族 ×9（p1–p6）+ consumer-parity-p4.3 + p4.4 族 ×5 = **15 件原样在场**，与 Task 11 ② 计数同形；backlog ×6 之外零删除；改写后的 `consumer-parity-p2-major.md` 保留）


### Task 2: 自研版本管线整删 + 原生 changeset 接线（TG1）

- **Objective**: 自研版本管线整删 + 原生 changeset 接线（TG1）：version-packages/version-utils/versioned-plugins 整删 + release.yml 原生 version 链

- **Produces**: 自研管线整删（version-packages.ts + version-utils.ts + versioned-plugins.json + run.ts version 子命令 + 相关测试）；release.yml changesets/action `pnpm exec changeset version && pnpm run emit`；.changeset/README + maintainers 随改述

- **Files**: scripts/release/version-packages.ts, scripts/lib/version-utils.ts, .changeset/versioned-plugins.json, scripts/run.ts, .github/workflows/release.yml, .changeset/README.md, docs/maintainers/

- **Steps**:
  1. ① 整删 `scripts/release/version-packages.ts` + `scripts/lib/version-utils.ts`（VersionService）+ `.changeset/versioned-plugins.json` 机制 + `scripts/run.ts` 的 `version` 子命令入口 + 相关测试——无中间态、无转发壳（死代码即删） — checkable: `scripts/release/version-packages.ts` / `scripts/lib/version-utils.ts` 零存在（git ls-files 断言）；`scripts/run.ts version` 入口已退役；`.changeset/versioned-plugins.json` 机制零残留（grep）
  2. ② `.github/workflows/release.yml` 的 changesets/action `version:` 命令改 **`pnpm exec changeset version && pnpm run emit`**（原生 version 消费 changesets + 双包 CHANGELOG + bump package.json；emit 重 stamp osuperpowers 发布产物使 Version PR 上 version-sync 绿；cdd-engine 无 emit 产物、版本只落自身 package.json） — checkable: `.github/workflows/release.yml` `version:` = `pnpm exec changeset version && pnpm run emit`（grep 断言）
  3. ③ `.changeset/README.md`（Release flow 述）与 docs/maintainers 发布面文档随改述原生流程；④ 确认 `changeset version` 在 CI approve-path 可用（工作区 `pnpm exec changeset version --help` 实证；沙箱双腿版本推导引用 spec 已裁决证据——cdd-engine 0.1.0 + major → **1.0.0** · osuperpowers 0.1.1 + minor → **0.2.0**） — checkable: `.changeset/README.md` 与 docs/maintainers 发布面零 version-packages / versioned-plugins / `run.ts version` 字样（grep）；precommit 全绿（删除后 6 组 9 块过）

- **AtomicWith**: 1, 3

- **Acceptance**:
  - `scripts/release/version-packages.ts` / `scripts/lib/version-utils.ts` 零存在（git ls-files 断言）
  - `scripts/run.ts version` 入口已退役（`scripts/run.ts` 无 `version` 子命令声明；run.ts help 面不含）
  - `.changeset/versioned-plugins.json` 机制零残留（grep `.changeset/` + `.github/workflows/release.yml`）
  - `.github/workflows/release.yml` `version:` = `pnpm exec changeset version && pnpm run emit`（grep 断言）
  - `.changeset/README.md` 与 docs/maintainers 发布面无 version-packages / versioned-plugins / `run.ts version` / `node scripts/run.ts version` 字样（grep 断言；release-flow 述只述原生 `changeset version` 流程，`pnpm run version` 已随自研管线整删）
  - precommit 全绿（删除后 `node scripts/run.ts precommit` 6 组 9 块过）


### Task 3: 发布矩阵 + version-sync 补覆盖（TG1）

- **Objective**: 发布矩阵 + version-sync 补覆盖（TG1）：git-tag vs semver 判据 + 双包条目 + version-sync cdd-engine 段

- **Produces**: release.yml 矩阵改 git-tag vs package.json semver 判据（最新 tag 为空 → 显式 versioned=true）+ 双包条目（osuperpowers + cdd-engine）；`version-sync.ts` 增 cdd-engine 段（semver 格式断言；发布态身份断言经 smoke-cdd --expect-version）

- **Files**: .github/workflows/release.yml, scripts/validate/version-sync.ts

- **Steps**:
  1. ① `.github/workflows/release.yml` `release-plugin` 矩阵改 **git-tag vs package.json semver 判据**——对每包 `git tag --list "<tag_prefix>*" | sort -V | tail -1` 得最新 tag，semver 比较当前 package.json version > 最新 tag → versioned=true（否 false，防幽灵 tag/Release）；**最新 tag 为空 → 显式 versioned=true**（零 tag 首版，如 cdd-engine@1.0.0 首发） — checkable: release.yml `release-plugin` 矩阵含 `cdd-engine` 条目（grep 断言）+ versioned-plugins.json 读取逻辑零残留
  2. ② 矩阵扩**双包条目**（osuperpowers tag_prefix `osuperpowers@` + cdd-engine tag_prefix `cdd-engine@`）；③ `scripts/validate/version-sync.ts` 增 cdd-engine 段——package.json 声明 semver 格式断言（`^\d+\.\d+\.\d+$` + 无 prerelease/build）；发布态版本身份断言经 `smoke-cdd --expect-version`（Task 4）承担不重复 — checkable: 判据脚本 dry-run 双态实证（① osuperpowers@0.1.1 现 tag 存在 → version > tag → versioned 自洽；② cdd-engine 零 tag 首版 → **versioned=true** 首版分支起效）；`version-sync.ts` 含 cdd-engine 段断言（对 0.1.0 声明合法、非法格式报错实证）
  3. ④ 注释写明 push 覆盖模型（validate 全覆盖于 PR 面；push→main = emit 新鲜度 + 双 consumer 门） — checkable: `node scripts/run.ts precommit` 全绿

- **AtomicWith**: 1, 2

- **Acceptance**:
  - release.yml `release-plugin` 矩阵含 `cdd-engine` 条目（grep 断言）+ versioned-plugins.json 读取逻辑零残留
  - 判据脚本 dry-run 双态实证：① `osuperpowers@0.1.1` 现 tag 存在 → `version > tag` → versioned 判定自洽（本地 shell 演练）；② cdd-engine 零 tag 首版（`git tag --list "cdd-engine@*" | sort -V | tail -1` 为空）→ **versioned=true** 首版分支起效（本地 shell 演练双态；判据值与 Task 4 ② post 门 `--expect-version 1.0.0` 同值——本组仅演练判据双态，**不执行** `--expect-version`，该参数面属 TG2）
  - `version-sync.ts` 含 cdd-engine 段断言（对 0.1.0 声明合法、非法格式报错实证）
  - `node scripts/run.ts precommit` 全绿


### Task 4: `smoke-cdd --expect-version` + post-version 门（TG2）

- **Objective**: `smoke-cdd --expect-version` + post-version 门（TG2）：tarball/安装态版本身份断言 + release 门接线

- **Produces**: smoke-cdd 可选参数 `--expect-version <semver>`（tarball + 安装态 node_modules version 断言）；release.yml post-version 门（changeset status 判定 + expect-version 1.0.0 于 publish 前）；smoke-cdd 定位说明补位

- **Files**: scripts/validate/smoke-cdd.ts, .github/workflows/release.yml, docs/maintainers/

- **Steps**:
  1. ① `scripts/validate/smoke-cdd.ts` 增可选参数 `--expect-version <semver>`——tarball 内 `package.json` version `==` 期望值才继续；**consumer 安装态版本身份断言**补位：读安装态 `node_modules/@oscaner-skills/cdd-engine/package.json` version `==` 期望值才继续（不满足 → FAIL 带期望/实际双值） — checkable: `node scripts/run.ts smoke-cdd --expect-version 0.1.0`（当前树）全通；`--expect-version 9.9.9` 显式 FAIL（tarball 实际 version 上报）；consumer 安装态断言段同双侧实证
  2. ② `.github/workflows/release.yml` 接线 post-version 门：changesets/action **前**新增 `pnpm exec changeset status --output=<tmp>` 步判定 `hasChangesets=false` → `if:` 限定该 false push 于 action 前执行 `node scripts/run.ts smoke-cdd --expect-version 1.0.0`——Version PR 合并后的再 push（tree 已 1.0.0 发布态）上「发布品即校验品」字面兑现、拦截在 `changeset publish` 之前；true push 不触发 — checkable: release.yml 含 `changeset status` 判定步 + `if:` 门步 + `--expect-version 1.0.0`（grep 断言）；门步位于 action 之前；release.yml YAML 语法有效（`actionlint` 或等价解析实证）
  3. ③ smoke-cdd 定位说明补位（docs/maintainers；Constraints「gh 外发」外——P4.2 dogfood：写明「consumer-sim = cdd-engine 发布品消费者黑盒」）；④ 现有 pre-version 基线门（无 expect-version、action 前）保留 — checkable: docs/maintainers 有 smoke-cdd 定位说明（grep 断言）

- **AtomicWith**: 5

- **Acceptance**:
  - `node scripts/run.ts smoke-cdd --expect-version 0.1.0`（当前树）全通；`--expect-version 9.9.9` 显式 FAIL（tarball 实际 version 上报）——过/堵双向实证；consumer 安装态断言段（已装 `node_modules/@oscaner-skills/cdd-engine/package.json` version == 期望值）同双侧实证
  - release.yml 含 `changeset status` 判定步 + `if:` 门步 + `--expect-version 1.0.0`（grep 断言）；门步位于 action 之前
  - docs/maintainers 有 smoke-cdd 定位说明（grep 断言）
  - release.yml YAML 语法有效（`actionlint` 或等价解析实证）


### Task 5: workflows 三层重构（TG2）

- **Objective**: workflows 三层重构（TG2）：pr-validate 三步 compose + link-cdd-engine 整删 + node 24 统一 + CI 零 npm link

- **Produces**: pr-validate.yml 收敛 checkout → setup → validate 三步 + permissions contents:read；`.github/actions/link-cdd-engine/` 整删；setup action 收口 node 24；CI 零 `npm link` 面

- **Files**: .github/workflows/pr-validate.yml, .github/workflows/release.yml, .github/actions/link-cdd-engine/action.yml, .github/actions/setup/

- **Steps**:
  1. ① `pr-validate.yml` 收敛为 `checkout → actions/setup → actions/validate` 三步 compose（删 link-cdd-engine、删 smoke-cdd——消费者黑盒归 release 门）+ 显式 `permissions: contents: read` — checkable: `pr-validate.yml` = 三步 compose（无 link-cdd-engine、无 smoke-cdd 步骤，grep 断言）+ permissions: contents: read
  2. ② `.github/actions/link-cdd-engine/action.yml` **整删**（`npm link` = 治理违规；P3 后 smoke-cdd 自包含、全局 cdd 零消费者） — checkable: `.github/actions/link-cdd-engine/` 目录零存在（git ls-files 断言）；`.github/workflows/*.yml` + `.github/actions/*/action.yml` 全树 `npm link` 字样零命中（grep 断言）
  3. ③ `actions/setup` 收口 node 24；`release.yml` 删手工 `setup-node node-version: 22`、改复用 setup action（engines 之上全树统一 24）；④ sync-main-to-develop 维持（workflow_call 复用） — checkable: release.yml 无 `node-version` 22 / 无手工 setup-node 指明（改走 setup action；grep 断言）；4 个 workflow YAML 语法有效 + actions compose 引用解析（actionlint 或等价实证）

- **AtomicWith**: 4

- **Acceptance**:
  - `pr-validate.yml` = 三步 compose（无 `link-cdd-engine`、无 `smoke-cdd` 步骤，grep 断言）+ `permissions: contents: read`
  - `.github/actions/link-cdd-engine/` 目录零存在（git ls-files 断言）
  - `.github/workflows/*.yml` + `.github/actions/*/action.yml` 全树 `npm link` 字样零命中（grep 断言）
  - release.yml 无 `node-version` 22 / 无手工 setup-node 的 node 版本指明（改走 setup action；grep 断言）
  - 4 个 workflow YAML 语法有效 + actions compose 引用解析（`actionlint` 或等价实证）


### Task 6: `cdd issue render` — finding-meta 单源 + 渲染器（TG3）

- **Objective**: `cdd issue render` — finding-meta 单源 + 渲染器（TG3）：issue-body.json 迁 engine + IssueReportRenderer + 确定性测试迁

- **Produces**: `templates/report/issue-body.json`（finding-meta 权威迁 engine；DOC_SCHEMA_NAMES 不新增）；`cdd issue render` 子命令（IssueReportRenderer 域服务，stdin findings → stdout body）；report-templates 确定性测试迁 engine（同字节断言）+ `report-templates.test.mjs` 退役；SKILL I5 改述

- **Files**: packages/cdd-engine/templates/report/issue-body.json, packages/cdd-engine/src/domain/issue-renderer.ts, packages/cdd-engine/src/cli/（issue render 子命令）, packages/osuperpowers/skills/report-issues/SKILL.md, packages/osuperpowers/scripts/report-templates.mjs, packages/osuperpowers/tests/report-templates.test.mjs

- **Steps**:
  1. ① `packages/osuperpowers/skills/report-issues/templates/finding-meta.json`（issue body 模板权威）迁至 **cdd-engine** templates 面（`templates/report/issue-body.json`；DOC_SCHEMA_NAMES 不新增 doc-type）；② 渲染逻辑迁为新子命令 **`cdd issue render`**：stdin findings JSON → stdout aggregate issue body，确定性、零执法；按 P4.4 OOP 落 **`IssueReportRenderer`** domain service + cli 子命令路由（Non-goal #1 例外「纯渲染型」落地） — checkable: `node packages/cdd-engine/dist/cli.mjs issue render < findings.json`（合法入参）→ stdout 聚合 body 与原 report-templates 黄金样本**同字节**（含 mixed type / N-finding / dedup 尾收等全断言面）；入参非法 → exit 1 + 字段路径（原契约面零回归）
  2. ③ 原 `report-templates.mjs` 的确定性测试（黄金样本/入参校验/CLI 裸调用）**迁移到 engine 侧** `.test.ts`——同字节断言、字段路径错误面保持；`packages/osuperpowers/tests/report-templates.test.mjs` **整件退役**（renderYml 断言面随 render-yaml 并入 `scripts/emit/__tests__`，退役在 [6,7] 组内原子完成） — checkable: `packages/osuperpowers/skills/report-issues/SKILL.md` 无 `scripts/report-templates.mjs`、无 `pluginRoot` 寻址表述（grep）；I5 指向 `cdd issue render`；engine 测试套件全绿；DOC_SCHEMA_NAMES 零新增
  3. ④ `report-issues/SKILL.md` I5 表述改「body 由 `cdd issue render` 直出」+ **pluginRoot-ascending 文件寻址机制删除**（不再就近找 `.claude-plugin/plugin.json` → scripts/） — checkable: `git ls-files 'packages/osuperpowers/tests/*.mjs'` 无 `report-templates*` 残留（退役件随 [6,7] 组原子落地，Task 7 验收复核）

- **AtomicWith**: 7

- **Acceptance**:
  - `node packages/cdd-engine/dist/cli.mjs issue render < findings.json`（合法入参）→ stdout 聚合 body 与原 report-templates 黄金样本**同字节**（含 mixed type / N-finding / dedup 尾收等全断言面）
  - 入参非法（空 findings / type 非法 / 字段缺失）→ exit 1 + 字段路径（原契约面零回归）
  - `packages/osuperpowers/skills/report-issues/SKILL.md` 无 `scripts/report-templates.mjs`、无 `pluginRoot` 寻址表述（grep 断言）；I5 指向 `cdd issue render`
  - 迁移面落位：`git ls-files 'packages/osuperpowers/tests/*.mjs'` 无 `report-templates*` 残留（退役件随 [6,7] 组原子落地；断言于 Task 7 验收复核）
  - engine 测试套件全绿（`pnpm --filter @oscaner-skills/cdd-engine test`）
  - `DOC_SCHEMA_NAMES` 零新增（schema get 枚举面不变）


### Task 7: osuperpowers 包面清理 + emit repoint（TG3）

- **Objective**: osuperpowers 包面清理 + emit repoint（TG3）：report-templates 删除 + render-yaml 迁 scripts/emit + files 白名单 + 探针

- **Produces**: 包内 `scripts/` + `bin/` 目录整删（report-templates / render-yaml 迁 / exit.mjs 删）；`scripts/emit/issue-templates.ts` 从 engine import finding-meta；files 白名单 7 项；白名单探针进 smoke-cdd；`report-templates.test.mjs` 退役

- **Files**: packages/osuperpowers/scripts/report-templates.mjs, packages/osuperpowers/scripts/render-yaml.mjs, packages/osuperpowers/bin/utils/exit.mjs, scripts/emit/render-yaml.mjs, scripts/emit/issue-templates.ts, scripts/emit/__tests__/issue-templates.test.ts, packages/osuperpowers/package.json, packages/osuperpowers/.superpowers/（开发残留目录）, packages/osuperpowers/tests/report-templates.test.mjs, scripts/validate/smoke-cdd.ts

- **Steps**:
  1. ① `packages/osuperpowers/scripts/report-templates.mjs` 删除；`render-yaml.mjs` **迁 `scripts/emit/render-yaml.mjs`**（落址钉死：emit-only YAML 渲染器，repo 侧 import 不 ship）；`bin/utils/exit.mjs` 删除（死代码：自称供 runner.mjs，旧引擎早已删、全仓零引用）→ 包内 `scripts/` + `bin/` 目录整删 — checkable: `packages/osuperpowers/` 内 `scripts/` + `bin/` 面零残留（grep/ls 断言）+ `.superpowers/` 不存在
  2. ② `scripts/emit/issue-templates.ts` 改从 **engine** import finding-meta 权威（repo → engine 单向依赖铁律）；两处 render-yaml import 重指 `./render-yaml.mjs`；③ `packages/osuperpowers/package.json` 增 **files 白名单 7 项**（skills/ · .claude-plugin/ · .cursor-plugin/ · README.md · README.zh-CN.md · CHANGELOG.md · package.json） — checkable: `scripts/emit/issue-templates.ts` 无 `packages/osuperpowers/...finding-meta.json` 直引（grep）；两处 import 重指 `scripts/emit/render-yaml.mjs`（grep）；`npm pack --dry-run`（osuperpowers）文件集合 == 白名单 7 项
  3. ④ `packages/osuperpowers/.superpowers/` 开发残留目录删除；⑤ 白名单探针进 `smoke-cdd`（osuperpowers pack 审计段：`npm pack --dry-run` 文件集合 == 7 项白名单，零 tests/bin/scripts/.superpowers/.version-bump.json）；⑥ `report-templates.test.mjs` **整件退役** — checkable: `git ls-files 'packages/osuperpowers/tests/*.mjs'` 无 `report-templates*` + `git ls-files packages/osuperpowers/scripts packages/osuperpowers/bin` 为空；`pnpm run emit` 后 `emit:check` 零 drift；`node scripts/run.ts smoke-cdd` 全通 + precommit 全绿

- **AtomicWith**: 6

- **Acceptance**:
  - `packages/osuperpowers/` 内 `scripts/` + `bin/` 面零残留（grep/ls 断言）+ `.superpowers/` 不存在
  - `scripts/emit/issue-templates.ts` 无 `packages/osuperpowers/skills/report-issues/templates/finding-meta.json` 直引（改 engine import；grep 断言）；`issue-templates.ts` + `scripts/emit/__tests__/issue-templates.test.ts` 无 `packages/osuperpowers/scripts/render-yaml.mjs` 直引（两处 import 重指 `scripts/emit/render-yaml.mjs`；grep 断言）
  - `npm pack --dry-run`（osuperpowers）文件集合 == 白名单 7 项（探针实证：零 tests/、bin/、scripts/、.superpowers/、.version-bump.json）
  - `git ls-files 'packages/osuperpowers/tests/*.mjs'` 无 `report-templates*` 残留 + `git ls-files packages/osuperpowers/scripts packages/osuperpowers/bin` 为空（退役件 + 包面整件清零；grep/ls 断言）
  - `pnpm run emit` 后 `emit:check` 零 drift（ISSUE_TEMPLATE 产物重生成同位）
  - `node scripts/run.ts smoke-cdd` 全通（含新增 osuperpowers pack 审计段）
  - `node scripts/run.ts precommit` 全绿（含 osuperpowers node:test 行为树 `node --test packages/osuperpowers/tests/*.test.mjs` + scripts unit vitest `scripts/emit/__tests__` 两处断链面）


### Task 8: 宣讲定位面 — README 三段式 + 定位句 + zh mirror（TG4）

- **Objective**: 宣讲定位面 — README 三段式 + 定位句 + zh mirror（TG4）：定位→理念→行为骨架 + cdd 理念导览

- **Produces**: README 三段式骨架（定位 R8 → 理念 R6 → 行为 P4.1 成果零重写）；定位句落 CLAUDE.md + README（`A cdd-first methodology: continuously-discovered development as the core discipline, AI coding skills as the distribution vehicle.` 无 harness 字样）；cdd 理念导览章节（是什么 · 为什么 · 三模式链 · 收敛纪律）；zh mirror 三件同步

- **Files**: README.md, README.zh-CN.md, packages/osuperpowers/README.zh-CN.md, packages/cdd-engine/README.zh-CN.md, CLAUDE.md

- **Steps**:
  1. ① README 重构为**三段式骨架**：定位（R8）→ 理念（R6）→ 行为（P4.1 成果原样承接零重写）——理念导览成第一读层；② 定位句落 CLAUDE.md + README（English-primary；无 harness 字样；harness 宣称面维持 P6 B1 中性） — checkable: README 三段式骨架 grep 断言（定位句/理念导览/行为承接有序出现）+ 定位句无 harness 字样；CLAUDE.md 含定位句 + Non-goal #1 例外（schema get + `cdd issue render`）+ **单一来源措辞不回归**
  2. ③ **cdd 理念导览章节**：cdd 是什么 · 为什么这样设计 · 三种模式链（implement → review → fix，含收敛纪律闭环）· Review Convergence 等收敛纪律；④ zh mirror 三件全量同步（根 + osuperpowers + cdd-engine；语言切换行维持 `[中文]`） — checkable: cdd 理念导览章节含：是什么 · 设计动机 · 三种模式链 · 收敛纪律（grep 四锚点）；zh mirror 三件与英文主源同步（`emit:check` + mirror 一致性探针）
  3. ⑤ CLAUDE.md 定位句 + Non-goal #1 例外表述 + **单一来源措辞不回归**（spec §4.4 第三子句：定位/宣讲面改动不得弱化「Package-as-source / 单一来源」表述） — checkable: P4.1 行为面零重写回归（README 行为声明与落地行为零分歧，grep/sweep 实证）

- **Acceptance**:
  - README 三段式骨架 grep 断言（定位句/理念导览/行为承接有序出现）+ 定位句无 harness 字样
  - CLAUDE.md 含定位句 + Non-goal #1 例外（schema get + `cdd issue render`）+ **单一来源措辞不回归**（`Package-as-source` / 单一来源核心表述仍存，grep 断言）
  - cdd 理念导览章节含：cdd 是什么 · 设计动机 · 三种模式链 · 收敛纪律（grep 断言四个锚点）
  - zh mirror 三件与英文主源同步（`emit:check` + mirror 一致性探针；P4.1 mirror 集 = 根 + 两包三件零其他）
  - P4.1 行为面零重写回归（README 行为声明与落地行为零分歧，grep/sweep 实证）


### Task 9: docs/maintainers 运维文档精炼（TG5）

- **Objective**: docs/maintainers 运维文档精炼（TG5）：01+02 合并 + 重编号 + 精简 + 互链零断裂

- **Produces**: 01-data-driven-templates + 02-template-doctrine 合并为 01-template-doctrine；剩余五件连续重编号（03→02 · 04→03 · 05→04 · 06→05）；04-program-experience 精简 19.5KB → ~12KB；02/05 更新 P4.4 终态；总字节 62.6KB → ≤53KB（spec 偏离登记）

- **Files**: docs/maintainers/（全族 + README.md 索引）, CLAUDE.md

- **Steps**:
  1. **合并** `01-data-driven-templates.md` + `02-template-doctrine.md` → `01-template-doctrine.md`；剩余五件按 spec §5 显式映射**连续重编号**（03-naming-conventions → 02 · 04-context-caching-doctrine → 03 · 05-program-experience → 04 · 06-third-party-dependencies → 05）；全文引用（index README + CLAUDE.md + 内部链接 + 本 plan 断言）一律用新号 — checkable: docs/maintainers 内容文档 6 → 5（01 合并落盘；五件新号断言；零旧号文件名残留；grep/ls 断言）；收敛前后对照：总字节 62.6KB → **≤53KB**（±10% 容差实证 + 逐文件对照表落于 README.md；spec 净目标 42KB 上界外不可达——偏离登记 Constraints「spec 目标偏离」）
  2. **精简** `04-program-experience.md`（原 05）19.5KB → ~12KB（程序叙事/已过时条目清除、actionable lessons 保留）；**更新** `02-naming-conventions.md`（原 03）到 P4.4 终态 + `05-third-party-dependencies.md`（原 06）到 P4.4 deps 终态；`03-context-caching-doctrine.md`（原 04，仅重编号）内容保留不动 — checkable: `02`/`05`（原 03/06）含 P4.4 终态 token（`REVIEW_FIX` / `group-*` / `biome` / `@types/typescript6` 等 grep 断言）
  3. **互链零断裂**：index README + CLAUDE.md 引用 + 内部链接全迁新号（链接探针）；index README 随链接收敛（条目与字节共同收敛）；smoke-cdd 定位说明（与 Task 4 ③ 同落点） — checkable: 互链完整性探针：`docs/maintainers/` 内 markdown 链接 + CLAUDE.md 引用全部 resolve（重编号新号引用一一可证）；`node scripts/run.ts precommit` 全绿

- **Acceptance**:
  - `docs/maintainers` 内容文档 6 → 5（01 合并落盘；五件新号断言：`01-template-doctrine.md` · `02-naming-conventions.md` · `03-context-caching-doctrine.md` · `04-program-experience.md` · `05-third-party-dependencies.md` 在场，零旧号 `02-template-doctrine.md` / 旧 `03`–`06` 文件名残留；grep/ls 断言）
  - 收敛前后对照：总字节 62.6KB → **≤53KB**（编辑集推导下限：合并 01+02（14,308B → ≤11.5KB · 省 ≥2.8KB）+ 精简 04（19,548B → 12,000B · 省 7.5KB）+ index README 收敛（→ ~2.1KB）+ 03 活契约保留（8,706B）+ 02/05 终态登记净增（→ ~8.3KB / ~10.1KB）≈ **51–53KB**；±10% 容差实证 + 逐文件对照表落盘于 `docs/maintainers/README.md`；spec 净目标 42KB（-33%）上界 46.2KB 外不可达——03-context-caching 活契约保留不动 + 02/05 终态登记净增先验固定，偏离登记 Constraints「spec 目标偏离」（spec 冻结、待 spec fix 轮修订 §5/§6 42KB → ≤53KB；探针判据绑定 plan 锚 ≤53KB，不按 spec 旧值判不合格））
  - `02`/`05`（原 03/06）含 P4.4 终态 token（`REVIEW_FIX` / `group-*` / `biome` / `@types/typescript6` 等 grep 断言）
  - 互链完整性探针：`docs/maintainers/` 内 markdown 链接 + CLAUDE.md 引用全部 resolve（重编号新号引用一一可证——`03`→`02` · `04`→`03` · `05`→`04` · `06`→`05`；浩零断裂）
  - `node scripts/run.ts precommit` 全绿


### Task 10: gh 元信息 + 一致性验证（TG6）

- **Objective**: gh 元信息 + 一致性验证（TG6）：description/topics 外发 + 宣讲面探针全跑

- **Produces**: 仓库 description = `A cdd-first methodology repo — continuously-discovered development as the core discipline, AI coding skills as the carrier.` + topics 六枚 + homepageUrl 留空（gh 显式 `--repo Oscaner/skills`）；README/CLAUDE.md 零分歧验证 + 宣讲面探针

- **Files**: （gh 外发操作——非文件面）, README.md, CLAUDE.md

- **Steps**:
  1. **gh 外发**（显式 `--repo Oscaner/skills`）：仓库 description = `A cdd-first methodology repo — continuously-discovered development as the core discipline, AI coding skills as the carrier.`；topics = `cdd` · `ai-skills` · `ai-agents` · `methodology` · `claude-code` · `cursor`；homepageUrl **留空**（无独立站点，非遗漏） — checkable: `gh repo view Oscaner/skills --json description,topics` = 裁决值（description / topics 实证；homepageUrl 为 null）
  2. ② README/CLAUDE.md 零分歧验证（行为描述 + 宣称面——P4.1 全量保证基线上的增量检视）；③ 宣讲面探针全跑（三段式骨架 · 定位句无 harness · 理念导览四锚点 · zh mirror 一致性）；④ 发版期 gh 元信息在 1.0.0 首版发布时点生效（本 task 先行落地 + 收口复核） — checkable: 宣讲面 grep 探针全绿（spec §4 锚点断言脚本化）；README/CLAUDE.md 与落地行为零分歧；gh 外发操作留档

- **Acceptance**:
  - `gh repo view Oscaner/skills --json description,topics` = 裁决值（description / topics 实证；homepageUrl 为 null）
  - 宣讲面 grep 探针全绿（spec §4 锚点断言脚本化）
  - README/CLAUDE.md 与落地行为零分歧（行为描述 + 宣称面校验论断成立）
  - gh 外发操作留档（PR/issue 或本 plan 变更记录可见）


### Task 11: 首次发布执行 + 收口（TG7）

- **Objective**: 首次发布执行 + 收口（TG7）：变更登记 changeset + 发布预案本地验证 + 收口回填（发布就绪态，外部 post-publish 态登记有主）

- **Produces**: P4.2 变更登记 changeset ×2（cdd-engine minor/pending + osuperpowers patch/minor）；发布预案本地验证（validate 11 块 + smoke-cdd + changeset status 清单）；overall P4.2 行 Implementation plan → Done + change-history（收口回填；外部 post-publish 态 = CI 后程序级外验项）

- **Files**: .changeset/consumer-parity-p4.2-*.md ×2, docs/kairos/specs/2026-09-21-consumer-parity-overall.md

- **Steps**:
  1. ① P4.2 变更登记 changeset——cdd-engine（`cdd issue render` new surface = minor，随 pending majors 集成发版至 1.0.0）+ osuperpowers（宣讲/pack 面 = patch/minor）各一 — checkable: 新增 changeset 落盘（`.changeset/consumer-parity-p4.2-*.md` ×2，规范头 + EOF 换行）
  2. ② **发布预案本地验证**：`pnpm run validate` 11 块全绿 + `node scripts/run.ts smoke-cdd`（pre 基线门形态）全通 + `changeset status` 演练（pending 清单正确：overhaul ×9 + p2-major + p4.3 + p4.4 ×5 + P4.2 ×2；backlog ×6 已清） — checkable: `pnpm run validate` 11 块全绿；`node scripts/run.ts smoke-cdd` 全通；`changeset status` 输出 pending 清单核对一致（backlog 零）
  3. ③ 收口回填：overall P4.2 行 Implementation plan 列 [Pending] → **Done** + change-history 行（backfill-overall，branch-review 前置义务）；`pnpm run changeset` 与 changeset 文件规范；④ 发布执行交棒 main（Version PR → publish → post 门 --expect-version → 双 tag + GH Release ×2 + sync）；本 task 验收 = **发布就绪态 + 收口回填**——spec §6 的**外部 post-publish 态**在 CI 执行前**非本 round 可达**，登记为 CI 后程序级外验项（owner = 收口复核或后续 dispatch） — checkable: overall P4.2 行 Implementation plan 列 = **Done** + change-history v-bump 行（四表 closeout 一致性）；P4.2 交付面 = spec §6 验收探针 **round 内可证子集** 全绿；**外部 post-publish 态登记有主**（= 验收⑥ 登记项，本 round 不执行、不宣称）

- **Acceptance**:
  - `pnpm run validate` 11 块全绿（含 emit:check / version-sync / scripts unit / marketplace）
  - `node scripts/run.ts smoke-cdd` 全通；`changeset status` 输出 pending 清单核对一致（backlog 零）
  - 新增 changeset 落盘（`.changeset/consumer-parity-p4.2-*.md` ×2，规范头 + EOF 换行）
  - overall P4.2 行 Implementation plan 列 = **Done** + change-history v-bump 行（四表 closeout 一致性：plan 列 Done ⇔ round 内可证子集 claim + 外部 post-publish 态有主——见验收⑥，声明源不外扩到未执行面）
  - P4.2 交付面 = spec §6 验收探针 **round 内可证子集** 全绿（版本基线、原生管线实证、issue render 确定性、白名单、workflows、宣讲、**maintainers 收敛（判据 = plan 锚 ≤53KB，绑定 Constraints「spec 目标偏离」声明——spec §6 旧值 42KB 不判不合格，spec 修订以 spec fix 轮落盘为准）**、gh 元信息）
  - **外部 post-publish 态登记有主**：npm 发布实证（`npm view` 可达）+ GitHub Release ×2 落盘 = CI 执行后的程序级外验项（owner = 收口复核 / 后续 dispatch）；本 round 不执行、不宣称，四表 Done 声明范围与此对齐


### Task 12: plan-constraints 每 TG 再生 — 彻底去 generate-once（TG8 · 2026-09-26 mid-backfill 追加）

- **Objective**: plan-constraints 每 TG 再生 — 彻底去 generate-once（TG8 · 2026-09-26 mid-backfill 追加）：无条件再生 + 存在性门收紧

- **Produces**: `materializePlanConstraints` 去 generate-once 早退（无条件重新提取覆写，header 含 plan basename + hash provenance）；implement pre-flight 去 existsSync 跳过（每 TG 起点必调）；`isPlanConstraintsStale` + 其测试删除；generate-once 断言面反转「无条件再生」

- **Files**: packages/cdd-engine/src/dispatch/task.ts, packages/cdd-engine/src/dispatch/__tests__/plan-constraints.test.ts, packages/cdd-engine/src/dispatch/__tests__/runner.test.ts

- **Steps**:
  1. ① `materializePlanConstraints`（`packages/cdd-engine/src/dispatch/task.ts`）**去 generate-once 早退**——无条件从 plan Constraints source 重新提取并**覆写** `plan-constraints.md`（保留确定性 header：plan basename + hash 作 provenance） — checkable: `materializePlanConstraints` 二次调用（同 plan）重写同字节（确定性保持）；`generated:false` / existsSync 早退路径零残留（grep/代码断言）
  2. ② implement pre-flight **去 `existsSync` 跳过**——每次 implement dispatch（每 TG 起点）必调 `materializePlanConstraints`；③ `isPlanConstraintsStale` + 其测试随「无条件再生」成真死代码删除（plan-hash anchor 保留为 provenance，不再作 stale 判定） — checkable: implement pre-flight 无 `existsSync(ctx.constraintsPath)` 跳过（每 dispatch 必调；grep 断言）；`isPlanConstraintsStale` 零残留（src + tests；grep 断言）
  3. ④ `plan-constraints.test.ts` / `runner.test.ts` 的 generate-once 断言面反转为「无条件再生」语义（同 plan 二次调用覆写同字节 = 确定性保持）；T22/§T7.1 注释同步；⑤ 非 breaking 确认（CLI/字段面零变化，仅派生产物再生语义） — checkable: generate-once 断言面全改「无条件再生」语义；`pnpm --filter @oscaner-skills/cdd-engine test` 全绿 + `node scripts/run.ts precommit` 全绿

- **Acceptance**:
  - `materializePlanConstraints` 二次调用（同 plan）重写同字节（确定性保持）；`generated:false` / existsSync 早退路径零残留（grep/代码断言）
  - implement pre-flight 无 `existsSync(ctx.constraintsPath)` 跳过（每 dispatch 必调；grep 断言）
  - `isPlanConstraintsStale` 零残留（src + tests；grep 断言）
  - `plan-constraints.test.ts` / `runner.test.ts` generate-once 断言面全改「无条件再生」语义（接口细节同字节断言在）
  - `pnpm --filter @oscaner-skills/cdd-engine test` 全绿 + `node scripts/run.ts precommit` 全绿
