# 消费者面一致性（Consumer Parity）— P4.2 发布一致性闭环 Implementation Plan

**Spec:** [2026-09-21-consumer-parity-p4.2-design.md](docs/osuperpowers/specs/2026-09-21-consumer-parity-p4.2-design.md)
- **Parent program**: [consumer-parity overall v1.45](docs/osuperpowers/specs/2026-09-21-consumer-parity-overall.md)
- **Version**: v1.0 · 2026-09-26
- **Base**: develop
- **Depends on**: P4.4（shipped · [p4.4-design v1.9](docs/osuperpowers/specs/2026-09-21-consumer-parity-p4.4-design.md)）

## Constraints

### 破坏性变更窗口（收口终局）
P4.4 已在 1.0.0 门前收齐全部 breaking（OOP restructure / 4 major deps / REVIEW_FIX 词汇 / PAP 移除）；本 phase **不再开新的 breaking 面**——`cdd issue render` 为**新增面**（Non-goal #1 例外扩入，非 breaking）；版本管线换血为 repo 侧治理变更（不落消费者包 changelog 语义面）；cdd-engine 首次稳定开版 = `0.1.0 + pending majors → 1.0.0`（原生 changesets 自然产出，不起跳 2.0.0）。历史终态不回滚。

### 发布零手工版本
任何版本号不得手写——版本动作 = 原生 `changeset version`（main 上 changesets/action）；本 phase 唯一手动版本动作 = Task 1 的 cdd-engine 声明值降值（修正从未发布的预定值）。`--expect-version` 断言值 1.0.0 由设计定死。

### 依赖方向铁律（repo → engine 单向）
repo 治理面（scripts/emit · scripts/validate · release.yml）可依赖 engine；**shipped 包（osuperpowers / cdd-engine）→ repo scripts 禁止**——finding-meta 迁 engine 后 osuperpowers 包内 scripts/bin 面零残留；render-yaml.mjs 迁 repo 治理面后不再被包消费。

### 四表纪律
回填 = branch-review 前置义务（backfill-overall 由 orchestration 于 branch-review 前执行）；结构性 mismatch → BLOCK；本 plan 终结态（plan complete）落地后 P4.2 行 Design-spec（已完成 v1.1）/ Implementation plan 列按 closeout 规则回填（Task 11 收口位）。

### 语言政策
本 plan 中文主源（Strategy B）；SKILL.md / docs / README 英文主源（Strategy A）——宣讲面（Task 8）为英文原文面，zh mirror 三件全量同步；docs/maintainers 遵循 English-primary。值 token（phase id / tag / SHA / 路径）中立。

### engine 直调与零过滤
`node packages/cdd-engine/dist/cli.mjs`（`pnpm --filter @oscaner-skills/cdd-engine dev:stub` 材料化；不走 global register）；skills 调用 cdd 输出零过滤（禁 `tail`/`head`/`2>&1 |`/`EXIT=$?`）。

### emit 输入面
skills/report-issues 技能文本改述（Task 7；全形 `packages/osuperpowers/skills/report-issues`）× README/CLAUDE.md 宣讲面（Task 8）为 emit 输入面/引用面——改动后核对 `pnpm run emit` 需求与 `emit:check` 无 drift；`.claude-plugin/`、`marketplace/` 等产物不手改。

### gh 外发
Task 10 对 GitHub 仓库元信息（description / topics）做外发变更——gh 操作显式 `--repo Oscaner/skills`；homepageUrl 留空非遗漏（无独立站点）。

### 死代码即删
空壳、死代码随拆即删（无过渡 shim · 无别名 · 无历史叙述豁免）；frozen 历史 docs（overhaul 族 / 已 shipped plan 与 overall change-history）不动；pack 白名单包住后留给消费者的面 = 纯技能 + 宣讲 + manifest。

## Task Groups

**有效分区 = 七个 dispatch 单位**：[1,2,3] · [4,5] · [6,7] · [8] · [9] · [10] · [11] —— 本节声明仅列合并组（1,2,3 / 4,5 / 6,7）；未覆盖任务（8 · 9 · 10 · 11）以**隐式单组**补全（按 task 号序）。

- **Task 1, 2, 3**: 版本管线重构 —— 基线准备（降值/声称改写/backlog 清除）· 自研管线整删 + 原生 changeset 接线 · 发布矩阵 + version-sync（同域原子变更，render/version 面同批 review）
- **Task 4, 5**: 发布门 + workflows 重构 —— `smoke-cdd --expect-version` + post-version 门接线 · 三层重构（release.yml / pr-validate.yml / actions 面同批）
- **Task 6, 7**: engine 渲染面迁移 —— `cdd issue render` + finding-meta 单源 · osuperpowers 包面清理 + emit repoint（迁移原子性：渲染器落地与包内退役同批）

### Task 1: 版本基线准备 — 降值 · 声称改写 · backlog 清除（TG1）

- **Do**: ① `packages/cdd-engine/package.json` 声明值 `1.0.0 → 0.1.0`（从未发布的包，预定值归真；唯一手动版本动作——见 Constraints「发布零手工版本」）② `.changeset/consumer-parity-p2-major.md` 声称改写——删「`1.0.0 → 2.0.0`；版本化发布动作归 P4」表述，改「P2 breaking 随 0.1.0 基线并入 **1.0.0 首次稳定开版**、不起跳 2.0.0；版本化发布动作归 P4.2」；`major` 类型保持 ③ `.changeset/backlog-{cdd-engine,osuperpowers}-{major,minor,patch}.md` 六件占位符 `git rm`（内容已被 overhaul p1–p6 真实 changeset 覆盖；零发布痕迹——不复写、不消费）
- **验收**:
  - `packages/cdd-engine/package.json` version 字段 = `0.1.0`（grep 断言）
  - `.changeset/consumer-parity-p2-major.md` 无 `1.0.0 → 2.0.0`、无 `归 P4，` 字样；含「1.0.0 首次稳定开版」表述（grep 断言）
  - `git ls-files .changeset/backlog-*` = 空（六件占位符零残留）
  - 无 pending changeset 内容被误删（overhaul 族 ×9（p1–p6）+ consumer-parity-p4.3 + p4.4 族 ×5 = **15 件原样在场**，与 Task 11 ② 计数同形；backlog ×6 之外零删除；改写后的 `consumer-parity-p2-major.md` 保留）

### Task 2: 自研版本管线整删 + 原生 changeset 接线（TG1）

- **Do**: ① 整删 `scripts/release/version-packages.ts` + `scripts/lib/version-utils.ts`（`VersionService`）+ `.changeset/versioned-plugins.json` 机制 + `scripts/run.ts` 的 `version` 子命令入口 + `scripts/release/__tests__` 与 version-utils 相关测试——无中间态、无转发壳（死代码即删）② `.github/workflows/release.yml` 的 changesets/action `version:` 命令改 **`pnpm exec changeset version && pnpm run emit`**（原生 version 消费 changesets + 双包 CHANGELOG + bump package.json；emit 重 stamp osuperpowers 发布产物使 Version PR 上 version-sync 绿；cdd-engine 无 emit 产物、版本只落自身 package.json）③ `.changeset/README.md`（Release flow 述）与 docs/maintainers 发布面文档随改述原生流程 ④ 确认 `changeset version` 在 CI approve-path 可用（Dev:stub 树实测 `changeset version --help` / 沙箱验证 0.1.0 + major → 1.0.0）
- **验收**:
  - `scripts/release/version-packages.ts` / `scripts/lib/version-utils.ts` 零存在（git ls-files 断言）
  - `scripts/run.ts version` 入口已退役（`scripts/run.ts` 无 `version` 子命令声明；run.ts help 面不含）
  - `.changeset/versioned-plugins.json` 机制零残留（grep `.changeset/` + `.github/workflows/release.yml`）
  - `.github/workflows/release.yml` `version:` = `pnpm exec changeset version && pnpm run emit`（grep 断言）
  - `.changeset/README.md` 与 docs/maintainers 发布面无 version-packages / versioned-plugins / `run.ts version` / `node scripts/run.ts version` 字样（grep 断言；release-flow 述只述原生 `changeset version` 流程，`pnpm run version` 已随自研管线整删）
  - precommit 全绿（删除后 `node scripts/run.ts precommit` 6 组 9 块过）

### Task 3: 发布矩阵 + version-sync 补覆盖（TG1）

- **Do**: ① `.github/workflows/release.yml` `release-plugin` 矩阵改 **git-tag vs package.json semver 判据**——对每包 `git tag --list "<tag_prefix>*" | sort -V | tail -1` 得最新 tag，semver 比较当前 package.json version > 最新 tag → versioned=true（否 false，防幽灵 tag/Release）；**最新 tag 为空 → 显式 versioned=true**（零 tag 首版，如 cdd-engine@1.0.0 首发——无「最小 tag」可比，当前 version 即首版起效；与「防幽灵 tag」同一注释声明）② 矩阵扩**双包条目**：`osuperpowers`（tag_prefix `osuperpowers@`）+ `cdd-engine`（tag_prefix `cdd-engine@`）③ `scripts/validate/version-sync.ts` 增 cdd-engine 段——package.json 声明 semver 格式断言（`^\d+\.\d+\.\d+$` + 无 prerelease/build）；发布态版本身份断言经 `smoke-cdd --expect-version`（Task 4）承担不重复 ④ 注释写明 push 覆盖模型（validate 全覆盖于 PR 面；push→main = emit 新鲜度 + 双 consumer 门）
- **验收**:
  - release.yml `release-plugin` 矩阵含 `cdd-engine` 条目（grep 断言）+ versioned-plugins.json 读取逻辑零残留
  - 判据脚本 dry-run 双态实证：① `osuperpowers@0.1.1` 现 tag 存在 → `version > tag` → versioned 判定自洽（本地 shell 演练）；② cdd-engine 零 tag 首版（`git tag --list "cdd-engine@*" | sort -V | tail -1` 为空）→ **versioned=true** 首版分支起效（本地 shell 演练双态，`--expect-version` 断言值 1.0.0 落地）
  - `version-sync.ts` 含 cdd-engine 段断言（对 0.1.0 声明合法、非法格式报错实证）
  - `node scripts/run.ts precommit` 全绿

### Task 4: `smoke-cdd --expect-version` + post-version 门（TG2）

- **Do**: ① `scripts/validate/smoke-cdd.ts` 增可选参数 `--expect-version <semver>`——tarball 内 `package.json` version 字段 `==` 期望值才继续（tarball 断言段新增；不满足 → FAIL 带期望/实际双值）② `.github/workflows/release.yml` 接线 post-version 门（spec §2.2 构造钉死）：changesets/action **前**新增 `pnpm exec changeset status --output=<tmp>` 步判定 `hasChangesets=false`（JSON `changesets` 数组空）→ `if:` 限定该 false push 于 action 前执行 `node scripts/run.ts smoke-cdd --expect-version 1.0.0`——Version PR 合并后的再 push（tree 已 1.0.0 发布态）上「发布品即校验品」字面兑现、拦截在 `changeset publish` 之前；true push 不触发 ③ smoke-cdd 定位说明补位（docs/maintainers；Constraints「gh 外发」外——P4.2 dogfood：owner 不确定其用途 → 写明「consumer-sim = cdd-engine 发布品消费者黑盒」）④ 现有 pre-version 基线门（无 expect-version、action 前）保留
- **验收**:
  - `node scripts/run.ts smoke-cdd --expect-version 0.1.0`（当前树）全通；`--expect-version 9.9.9` 显式 FAIL（tarball 实际 version 上报）——过/堵双向实证
  - release.yml 含 `changeset status` 判定步 + `if:` 门步 + `--expect-version 1.0.0`（grep 断言）；门步位于 action 之前
  - docs/maintainers 有 smoke-cdd 定位说明（grep 断言）
  - release.yml YAML 语法有效（`actionlint` 或等价解析实证）

### Task 5: workflows 三层重构（TG2）

- **Do**: ① `pr-validate.yml` 收敛为 `checkout → actions/setup → actions/validate` 三步 compose（删 link-cdd-engine、删 smoke-cdd——消费者黑盒归 release 门）+ 显式 `permissions: contents: read` ② `.github/actions/link-cdd-engine/action.yml` **整删**（`npm link` = CLAUDE.md「npm link 已移除」治理违规；P3 后 smoke-cdd 自包含、全局 cdd 零消费者）③ `actions/setup` 收口 node 24（维持默认）；`release.yml` 删手工 `setup-node node-version: 22`、改复用 setup action（engines `>=22.12.0` 之上全树统一 24）④ sync-main-to-develop 维持（workflow_call 复用）⑤ CI 零 `npm link` 面达成
- **验收**:
  - `pr-validate.yml` = 三步 compose（无 `link-cdd-engine`、无 `smoke-cdd` 步骤，grep 断言）+ `permissions: contents: read`
  - `.github/actions/link-cdd-engine/` 目录零存在（git ls-files 断言）
  - `.github/workflows/*.yml` + `.github/actions/*/action.yml` 全树 `npm link` 字样零命中（grep 断言）
  - release.yml 无 `node-version` 22 / 无手工 setup-node 的 node 版本指明（改走 setup action；grep 断言）
  - 4 个 workflow YAML 语法有效 + actions compose 引用解析（`actionlint` 或等价实证）

### Task 6: `cdd issue render` — finding-meta 单源 + 渲染器（TG3）

- **Do**: ① `packages/osuperpowers/skills/report-issues/templates/finding-meta.json`（issue body 模板权威）迁至 **cdd-engine** templates 面（如 `templates/report/issue-body.json`；`DOC_SCHEMA_NAMES` **不新增** doc-type——模板唯一消费者 = 渲染器）② 渲染逻辑迁为新子命令 **`cdd issue render`**：stdin findings JSON → stdout aggregate issue body，确定性、零执法；按 P4.4 OOP 落 **`IssueReportRenderer`** domain service + cli 子命令路由（Non-goal #1 例外「纯渲染型」落地）③ 原 `packages/osuperpowers/scripts/report-templates.mjs` 的确定性测试（黄金样本/入参校验/CLI 裸调用）**迁移到 engine 侧** `.test.ts`——同字节断言、字段路径错误面保持；`packages/osuperpowers/tests/report-templates.test.mjs` **整件退役**（黄金样本/入参校验/CLI 裸调用三面随迁 engine；renderYml 断言面随 render-yaml 并入 `scripts/emit/__tests__`——见 Task 7 ①，退役在 [6,7] 组内原子完成）④ `packages/osuperpowers/skills/report-issues/SKILL.md` I5 表述改「body 由 `cdd issue render` 直出」+ **pluginRoot-ascending 文件寻址机制删除**（不再就近找 `.claude-plugin/plugin.json` → scripts/）
- **验收**:
  - `node packages/cdd-engine/dist/cli.mjs issue render < findings.json`（合法入参）→ stdout 聚合 body 与原 report-templates 黄金样本**同字节**（含 mixed type / N-finding / dedup 尾收等全断言面）
  - 入参非法（空 findings / type 非法 / 字段缺失）→ exit 1 + 字段路径（原契约面零回归）
  - `packages/osuperpowers/skills/report-issues/SKILL.md` 无 `scripts/report-templates.mjs`、无 `pluginRoot` 寻址表述（grep 断言）；I5 指向 `cdd issue render`
  - 迁移面落位：`git ls-files 'packages/osuperpowers/tests/*.mjs'` 无 `report-templates*` 残留（退役件随 [6,7] 组原子落地；断言于 Task 7 验收复核）
  - engine 测试套件全绿（`pnpm --filter @oscaner-skills/cdd-engine test`）
  - `DOC_SCHEMA_NAMES` 零新增（schema get 枚举面不变）

### Task 7: osuperpowers 包面清理 + emit repoint（TG3）

- **Do**: ① `packages/osuperpowers/scripts/report-templates.mjs` 删除（Task 6 已迁）；`packages/osuperpowers/scripts/render-yaml.mjs` **迁 `scripts/emit/render-yaml.mjs`**（落址钉死：emit-only YAML 渲染器，repo 侧 import 不 ship；消费者全在 scripts/emit 面且测试 colocated——原「`scripts/emit/` 或 `scripts/lib/`」双开收敛为 `scripts/emit/`）；`packages/osuperpowers/bin/utils/exit.mjs` 删除（死代码：自称「供 runner.mjs」，旧引擎早已删、全仓零引用）→ 包内 `scripts/` + `bin/` 目录整删 ② `scripts/emit/issue-templates.ts`（生成 `.github/ISSUE_TEMPLATE/*.yml`）改从 **engine** import finding-meta 权威（repo → engine 单向依赖铁律）；`issue-templates.ts` + `scripts/emit/__tests__/issue-templates.test.ts` 两处 `render-yaml` import 重指 `./render-yaml.mjs`（随 ① 落址，零 `packages/osuperpowers/scripts/` 直引）③ `packages/osuperpowers/package.json` 增 **files 白名单 7 项**：`skills/` · `.claude-plugin/` · `.cursor-plugin/` · `README.md` · `README.zh-CN.md` · `CHANGELOG.md` · `package.json` ④ `packages/osuperpowers/.superpowers/` 开发残留目录删除 ⑤ 白名单探针进 `smoke-cdd`（osuperpowers pack 审计段：`npm pack --dry-run` 文件集合 == 7 项白名单，零 `tests/`/`bin/`/`scripts/`/`.superpowers/`/`.version-bump.json`）⑥ `packages/osuperpowers/tests/report-templates.test.mjs` **整件退役**（原三点 import `../scripts/report-templates.mjs` · `../scripts/render-yaml.mjs` · `../skills/report-issues/templates/finding-meta.json` 随加载面消失；黄金样本/入参校验/CLI 裸调用面已由 Task 6 ③ 迁 engine `.test.ts`，renderYml 断言面并入 `scripts/emit/__tests__`——osuperpowers node:test 行为树零断链）
- **验收**:
  - `packages/osuperpowers/` 内 `scripts/` + `bin/` 面零残留（grep/ls 断言）+ `.superpowers/` 不存在
  - `scripts/emit/issue-templates.ts` 无 `packages/osuperpowers/skills/report-issues/templates/finding-meta.json` 直引（改 engine import；grep 断言）；`issue-templates.ts` + `scripts/emit/__tests__/issue-templates.test.ts` 无 `packages/osuperpowers/scripts/render-yaml.mjs` 直引（两处 import 重指 `scripts/emit/render-yaml.mjs`；grep 断言）
  - `npm pack --dry-run`（osuperpowers）文件集合 == 白名单 7 项（探针实证：零 tests/、bin/、scripts/、.superpowers/、.version-bump.json）
  - `git ls-files 'packages/osuperpowers/tests/*.mjs'` 无 `report-templates*` 残留 + `git ls-files packages/osuperpowers/scripts packages/osuperpowers/bin` 为空（退役件 + 包面整件清零；grep/ls 断言）
  - `pnpm run emit` 后 `emit:check` 零 drift（ISSUE_TEMPLATE 产物重生成同位）
  - `node scripts/run.ts smoke-cdd` 全通（含新增 osuperpowers pack 审计段）
  - `node scripts/run.ts precommit` 全绿（含 osuperpowers node:test 行为树 `node --test packages/osuperpowers/tests/*.test.mjs` + scripts unit vitest `scripts/emit/__tests__` 两处断链面）

### Task 8: 宣讲定位面 — README 三段式 + 定位句 + zh mirror（TG4）

- **Do**: ① README 重构为**三段式骨架**：定位（R8）→ 理念（R6）→ 行为（P4.1 成果原样承接零重写）——理念导览成第一读层 ② 定位句落 CLAUDE.md + README（English-primary）：`A cdd-first methodology: continuously-discovered development as the core discipline, AI coding skills as the distribution vehicle.`（无 harness 字样；harness 宣称面维持 P6 B1 中性「多 harness 可消费」）③ **cdd 理念导览章节**：cdd 是什么 · 为什么这样设计 · 三种模式链（implement → review → fix，含收敛纪律闭环）· Review Convergence 等收敛纪律 ④ zh mirror 三件全量同步（根 `README.zh-CN.md` + `packages/osuperpowers/README.zh-CN.md` + `packages/cdd-engine/README.zh-CN.md`；语言切换行维持 `[中文]`）⑤ CLAUDE.md 定位句 + Non-goal #1 例外表述（schema get + `cdd issue render`）+ **单一来源措辞不回归**（spec §4.4 第三子句：CLAUDE.md 定位/宣讲面改动不得弱化「Package-as-source / 单一来源」表述——emit 输入面引用语义不回归）
- **验收**:
  - README 三段式骨架 grep 断言（定位句/理念导览/行为承接有序出现）+ 定位句无 harness 字样
  - CLAUDE.md 含定位句 + Non-goal #1 例外（schema get + `cdd issue render`）+ **单一来源措辞不回归**（`Package-as-source` / 单一来源核心表述仍存，grep 断言）
  - cdd 理念导览章节含：cdd 是什么 · 设计动机 · 三种模式链 · 收敛纪律（grep 断言四个锚点）
  - zh mirror 三件与英文主源同步（`emit:check` + mirror 一致性探针；P4.1 mirror 集 = 根 + 两包三件零其他）
  - P4.1 行为面零重写回归（README 行为声明与落地行为零分歧，grep/sweep 实证）

### Task 9: docs/maintainers 运维文档精炼（TG5）

- **Do**: ① **合并** `01-data-driven-templates.md` + `02-template-doctrine.md` → 单文档 `01-template-doctrine.md`（template 面一个文档）；剩余五件按 spec §5 显式映射**连续重编号**（有意不留断号）——`03-naming-conventions.md` → **02** · `04-context-caching-doctrine.md` → **03** · `05-program-experience.md` → **04** · `06-third-party-dependencies.md` → **05**；全文引用（index README + CLAUDE.md + docs/maintainers 内部链接 + 本 plan 断言）一律用新号 ② **精简** `04-program-experience.md`（原 05）19.5KB → ~12KB（程序叙事/已过时条目清除、actionable lessons 保留；consumer-parity 规范节保留）③ **更新** `02-naming-conventions.md`（原 03）到 P4.4 终态（REVIEW_FIX / group-* / `--tasks` / `issue` 词表）+ `05-third-party-dependencies.md`（原 06）到 P4.4 deps 终态（biome · ts7 + `@types/typescript6` shim · execa 10 · vitest 5 登记）④ `03-context-caching-doctrine.md`（原 04，仅重编号）内容保留不动（engine cache-profile 活契约）⑤ **互链零断裂**：index README + CLAUDE.md 引用 + 内部链接全迁新号（链接探针）；index README 随链接收敛（条目与字节共同收敛）；smoke-cdd 定位说明（与 Task 4 ③ 同落点）
- **验收**:
  - `docs/maintainers` 内容文档 6 → 5（01 合并落盘；五件新号断言：`01-template-doctrine.md` · `02-naming-conventions.md` · `03-context-caching-doctrine.md` · `04-program-experience.md` · `05-third-party-dependencies.md` 在场，零旧号 `02-template-doctrine.md` / 旧 `03`–`06` 文件名残留；grep/ls 断言）
  - 收敛前后对照：总字节 62.6KB → **≤53KB**（编辑集推导下限：合并 01+02（14,308B → ≤11.5KB · 省 ≥2.8KB）+ 精简 04（19,548B → 12,000B · 省 7.5KB）+ index README 收敛（→ ~2.1KB）+ 03 活契约保留（8,706B）+ 02/05 终态登记净增（→ ~8.3KB / ~10.1KB）≈ **51–53KB**；±10% 容差实证 + 逐文件对照表落盘于 `docs/maintainers/README.md`；spec 净目标 42KB（-33%）上界 46.2KB 外不可达——03-context-caching 活契约保留不动 + 02/05 终态登记净增先验固定，对照表记偏离原因）
  - `02`/`05`（原 03/06）含 P4.4 终态 token（`REVIEW_FIX` / `group-*` / `biome` / `@types/typescript6` 等 grep 断言）
  - 互链完整性探针：`docs/maintainers/` 内 markdown 链接 + CLAUDE.md 引用全部 resolve（重编号新号引用一一可证——`03`→`02` · `04`→`03` · `05`→`04` · `06`→`05`；浩零断裂）
  - `node scripts/run.ts precommit` 全绿

### Task 10: gh 元信息 + 一致性验证（TG6）

- **Do**: ① **gh 外发**（显式 `--repo Oscaner/skills`）：仓库 description = `A cdd-first methodology repo — continuously-discovered development as the core discipline, AI coding skills as the carrier.`；topics = `cdd` · `ai-skills` · `ai-agents` · `methodology` · `claude-code` · `cursor`；homepageUrl **留空**（无独立站点，非遗漏）② README/CLAUDE.md 零分歧验证（行为描述 + 宣称面——P4.1 全量保证基线上的增量检视）③ 宣讲面探针全跑（三段式骨架 · 定位句无 harness · 理念导览四锚点 · zh mirror 一致性）④ 发版期 gh 元信息在 1.0.0 首版发布时点生效（本 task 先行落地 + 收口复核）
- **验收**:
  - `gh repo view Oscaner/skills --json description,topics` = 裁决值（description / topics 实证；homepageUrl 为 null）
  - 宣讲面 grep 探针全绿（spec §4 锚点断言脚本化）
  - README/CLAUDE.md 与落地行为零分歧（行为描述 + 宣称面校验论断成立）
  - gh 外发操作留档（PR/issue 或本 plan 变更记录可见）

### Task 11: 首次发布执行 + 收口（TG7）

- **Do**: ① P4.2 变更登记 changeset——cdd-engine（`cdd issue render` new surface = minor，随 pending majors 一次集成发版至 1.0.0）+ osuperpowers（宣讲/pack 面 = patch/minor）各一 ② **发布预案本地验证**：`pnpm run validate` 11 块全绿 + `node scripts/run.ts smoke-cdd`（pre 基线门形态）全通 + `changeset status` 演练（pending changesets 清单正确：overhaul ×9 + p2-major + p4.3 + p4.4 ×5 + P4.2 ×2；backlog ×6 已清）③ 收口回填：overall P4.2 行 Implementation plan 列 [Pending] → **Done** + change-history 行（backfill-overall，branch-review 前置义务）；`pnpm run changeset` 与 changeset 文件规范 ④ 发布执行交棒 main（Version PR → publish → post 门 --expect-version → 双 tag + GH Release ×2 + sync）作为 CI 流程；本 task 验收 = **发布就绪态 + 收口回填**——spec §6 Acceptance 的**外部 post-publish 态**（npm 发布实证 `npm view` 可达 / GitHub Release ×2 落盘）在 CI 执行前**非本 round 可达**，不宣称全绿，登记为 CI 执行后的程序级外验项（owner = 收口复核或后续 dispatch）
- **验收**:
  - `pnpm run validate` 11 块全绿（含 emit:check / version-sync / scripts unit / marketplace）
  - `node scripts/run.ts smoke-cdd` 全通；`changeset status` 输出 pending 清单核对一致（backlog 零）
  - 新增 changeset 落盘（`.changeset/consumer-parity-p4.2-*.md` ×2，规范头 + EOF 换行）
  - overall P4.2 行 Implementation plan 列 = **Done** + change-history v-bump 行（四表 closeout 一致性：plan 列 Done ⇔ round 内可证子集 claim + 外部 post-publish 态有主——见验收⑥，声明源不外扩到未执行面）
  - P4.2 交付面 = spec §6 验收探针 **round 内可证子集** 全绿（版本基线、原生管线实证、issue render 确定性、白名单、workflows、宣讲、maintainers 收敛、gh 元信息）
  - **外部 post-publish 态登记有主**：npm 发布实证（`npm view` 可达）+ GitHub Release ×2 落盘 = CI 执行后的程序级外验项（owner = 收口复核 / 后续 dispatch）；本 round 不执行、不宣称，四表 Done 声明范围与此对齐
