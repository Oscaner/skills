# 依赖升级与 src 更名（Dependency Upgrade & Src Rename）— P1 Plan（simple-git 3→4 · node 线锁 24 · 依赖全量对齐）

**Spec:** [2026-10-10-upgrade-dependencies-and-src-rename-p1-design.md](docs/kairos/specs/2026-10-10-upgrade-dependencies-and-src-rename-p1-design.md)
- **Parent program**: [2026-10-10-upgrade-dependencies-and-src-rename-overall.md v1.4](docs/kairos/specs/2026-10-10-upgrade-dependencies-and-src-rename-overall.md)
- **Version**: v1.0 · 2026-10-10
- **Depends on**: 无（program 起点 · 前置 = P1 design spec v1.2 Approved · 2026-10-10）
- **Base**: develop

## Constraints

- **引擎行为变更零混入**：不引 simple-git 4.x 新能力（缩写 long-form option 放行 / git env 变量过滤透传）——引擎能力变更归独立整体程序（engine-doc-tooling · 2026-10-10 拆出）
- **声明 + 锁文件同提交**：`pnpm install --frozen-lockfile` 必须保持绿——声明编辑不落后于锁文件刷新（同一提交面）
- **提交粒度两提交**：① 依赖声明 + 锁文件（机械面 = Wave 1）② maintainers 05 文档同步（文案面 = Wave 2）——两波分列，互不混（spec §6.2）；提交由引擎 implement 一波一提交驱动，计划不写 git commit 步
- **`.nvmrc` v24 / CI setup 默认 "24" 零变更**：验收只证不比——本 phase 不 touch `.nvmrc` · `.github/actions/setup/action.yml`（git diff 零命中）
- **清壳前置（spec §6.1 · F2）**：`packages/cdd-engine/src/` 空壳目录（P2 改名预演遗留 · 0 文件 · git 不可见）先清空，再跑引擎 vitest——包根无 `src`/`config` 残留是 vitest 全绿前提
- **基线先行**：清壳后、声明编辑前跑基线（precommit + 引擎 vitest）——基线全绿是升级对标的起点；升级后 W2 收官对照重跑全量
- **不新增依赖**：升级 = 存量声明对齐（simple-git / @types/node 两行 + 锁文件刷新），非新增第三方包
- **不单开 changeset**：P1 贡献归 P3 主题归并吸收（overall D6 · 依赖升级程序 P3）
- **变更先回填本 overall（backfill-as-version）**：实施期发现复试实况（如再遇 registry/工具语义偏差）先回填 overall + 本 spec，再继续
- **语言纪律**：maintainers 05 英文主源（Strategy A 扩展）· 本 plan 中文（Strategy B）

### Task 1: 环境前置 + 声明面 + 锁文件刷新 + 提交①（依赖声明 + 锁文件）

- **Objective**: 清空 `packages/cdd-engine/src/` 空壳目录（P2 改名预演遗留）后跑基线（precommit + 引擎 vitest 全绿）；随后编辑两处 package.json 声明面（simple-git `^3.36.0 → ^4.0.2` · `@types/node ^26.6.4 → ^24.19.2` 两处 · cdd-engine `engines.node >=22.18.0 → >=24`），`pnpm install` 刷新锁文件至 registry 对齐，完成 pin 验证（两条意图线 registry 交叉核对 · `pnpm outdated` 零行除 @types/node 单行越-range 设计意图 · `--frozen-lockfile` 绿），落 Wave 1 提交①（依赖声明 + 锁文件 · 机械面）
- **Files**: `packages/cdd-engine/src/`（空壳目录 · 清空）· `packages/cdd-engine/package.json`（simple-git · @types/node · engines 三行）· `package.json`（根 devDependencies `@types/node` 行）· `pnpm-lock.yaml`（锁文件刷新）
- **Consumes**: design spec §2/§3/§4 · registry 事实（simple-git 4.0.2 · @types/node 24.19.2 · 无 engines 声明）
- **Produces**: 干净包根（无 `src`/`config` 残留）· 声明面三行变更 · 对齐 registry 的锁文件 · 提交①
- **Steps**:
  - 确认 `packages/cdd-engine/src/` 空壳目录存在且 0 文件、`git status --porcelain` 不显示它（git 不可见 · P2 改名预演遗留）— checkable: `test -d packages/cdd-engine/src` 且目录内零文件
  - 清空空壳目录（`rmdir` 或 `rm -rf packages/cdd-engine/src`）— checkable: `packages/cdd-engine/src` 不存在 · 包根无 `src`/`config` 残留
  - 跑基线：`pnpm run precommit`（doc-contract gate 16 specs/plans 保持）+ 引擎 vitest（`pnpm --filter @oscaner-skills/cdd-engine test`）— checkable: precommit ALL PASS · 引擎 vitest 全绿（清壳后 0 failed · 之前 1 failed 即空壳触发）
  - 编辑 `packages/cdd-engine/package.json`：`dependencies.simple-git` `^3.36.0 → ^4.0.2` · `devDependencies.@types/node` `^26.6.4 → ^24.19.2` · `engines.node` `>=22.18.0 → >=24` — checkable: 三行 diff · 其余字节零变更
  - 编辑根 `package.json`：`devDependencies.@types/node` `^26.6.4 → ^24.19.2`（与 cdd-engine 两处同钉 · 任一残留 26 线 = 类型撒谎面未消）— checkable: 根声明一行 diff
  - `pnpm install`（声明面变更后的 workspace 全量解析刷新锁文件至 registry 对齐 · in-range 尾随更新合规）— checkable: 锁文件 diff 与声明面 + 尾随 in-range 一致
  - pin 验证：`pnpm outdated` **除 @types/node 单行越-range 外零行**（latest 26.6.5 vs 声明 `^24.19.2` · 线锁 24 设计意图 · 必报且验收容忍）· 两条意图线 registry 交叉核对（`npm view simple-git version` = 4.0.2 · `npm view @types/node@24 version` = 24.19.2 · 声明 + 锁文件双双落位）· `pnpm install --frozen-lockfile` 绿（锁一致性）· `.nvmrc`/CI setup 零变更（git diff 无 `.nvmrc`/`.github/actions/setup/action.yml` 命中）— checkable: 全部如上
  - 落提交①（Wave 1 一波一提交 · 消息覆盖本波 scopes：依赖声明 + 锁文件 · 机械面）— checkable: 提交含 `packages/cdd-engine/package.json` + 根 `package.json` + `pnpm-lock.yaml`（不含 maintainers 05）· precommit 钩子绿
- **Acceptance**:
  - `packages/cdd-engine/src/` 空壳已清（包根无 `src`/`config` 残留）
  - 基线（清壳后 · 声明前）precommit + 引擎 vitest 全绿
  - 声明面三行（simple-git `^4.0.2` · 两处 `@types/node ^24.19.2` · engines `>=24`）落位 · `.nvmrc`/CI setup 零 diff
  - `pnpm outdated` 除 @types/node 单行越-range（设计意图 · 验收容忍）外零行 · 两条意图线 registry 交叉核对落位（4.0.2 / 24.19.2 · 声明 + 锁文件）· `--frozen-lockfile` 绿
  - 提交① = 依赖声明 + 锁文件（机械面 · 不含文档面）
- **DependsOn**: none

### Task 2: maintainers 05 §1 同步 + 收口对照 + 提交②（文案面）

- **Objective**: 同步 `docs/maintainers/05-third-party-dependencies.md` §1（simple-git 行版本 `^3.36.0 → ^4.0.2` · 4.x 前瞻注记两行只作文档 · 工具链段 `@types/node` 行 `^26.6.4 → ^24.19.2`），落 Wave 2 提交②（文案面）；随后升级后全量对照（tsc ×3 · 引擎 vitest · validate ALL PASS · 引擎行为零变更 pin）
- **Files**: `docs/maintainers/05-third-party-dependencies.md`（§1 adopted 表 simple-git 行 · 4.x 前瞻注记 · 工具链段 @types/node 行）
- **Consumes**: T1 锁文件实际落位（lockfile 格值以 `pnpm-lock.yaml` 刷新后为准）· design spec §5
- **Produces**: maintainers 05 §1 三处同步 · 提交②
- **Steps**:
  - §1 adopted 表 simple-git 行：`^3.36.0` → `^4.0.2`（declared 格 + lockfile 格——lockfile 值以 T1 实际落位为准）— checkable: 表行 diff
  - 4.x 前瞻注记两行：**缩写 long-form option 拦截**（4.x 对缩写选项行为收口 · 若启用须显式全拼）· **git env 变量过滤**（`allowEnvironment` 默不过滤 · 受限 git 环境须显式声明）——只作文档记录 · 不启用 · 不引能力 — checkable: 两行存在 · 引擎调用面零 diff
  - 工具链段 `@types/node (^26.6.4)` → `(^24.19.2)`（消费面文字与声明面同步 · 防文档撒谎）— checkable: 段行 diff
  - 落提交②（Wave 2 一波一提交 · 消息覆盖本波 scopes：maintainers 05 文档同步 · 文案面）— checkable: 提交仅 `docs/maintainers/05-third-party-dependencies.md`
  - 升级后收口对照：`tsc --noEmit` 三项目 · 引擎 vitest 全绿（干净工作树前提已足 · 0 语义改动）· `pnpm run validate` ALL PASS（emit 新鲜 / channel audit / residue 零回归）· `pnpm run precommit` 过（doc-contract gate 16 specs/plans 保持）— checkable: 全部门禁绿 · 引擎行为零变更 pin（guard 三件套零回归 · residue 零新词）
- **Acceptance**:
  - maintainers 05 §1 simple-git 4.x 行 + 前瞻注记两行 + `@types/node` 行全部落位（英文主源 · 无中文）
  - 提交② = 仅文档面 · 与提交① 互不混
  - 升级后全量门禁：tsc ×3 · 引擎 vitest · `pnpm run validate` ALL PASS · `pnpm run precommit` 过
  - 引擎行为零变更 pin：vitest 0 语义改动 · guard 三件套零回归（引擎 diff 只应是声明行）
- **DependsOn**: 1

## Change history

| Version | date | summary | author |
|---|---|---|---|
| v1.0 | 2026-10-10 | P1 实现计划：两波两提交（Wave 1 = 清壳 + 声明面 + 锁刷新 + 提交① · Wave 2 = maintainers 05 §1 同步 + 提交② + 收口对照）· 任务解自 design spec v1.2（§2–§6 · F1 三段式验收 · F2 清壳前置 · F3 计数 16）· 波序与提交粒度由「frozen-lockfile 绿」+「两提交不混」双约束驱动 | [human] · Claude Opus 5（kairos:cdd-plan · writing-plans import） |