# 依赖升级与 src 更名（Dependency Upgrade & Src Rename）— P1 Design Spec（simple-git 3→4 · node 线锁 24 · 依赖全量对齐）

- **Version**: v1.3 · 2026-10-10
- **Status**: Draft
- **Author**: [human] · Claude Opus 5（kairos:cdd-design [P1] enumerate-then-grill 定案 → cdd-spec-writer）
- **Parent program**: [2026-10-10-upgrade-dependencies-and-src-rename-overall.md v1.5](docs/kairos/specs/2026-10-10-upgrade-dependencies-and-src-rename-overall.md)
- **Depends on**: 无（program 起点 · serial-phase GATE 满足——本 phase 无前置硬依赖，可开线；与改名 phase 并行）

## Design

本 phase 为程序首段：把 **simple-git major 升级（3→4，drop-in 已核零适配）**、**node 版本线锁 24（engines/`.nvmrc`/CI/types 一致性）**、**依赖全量对齐（lockfile 刷新 + 三段式验收）** 与 **maintainers 05 §1 文档同步**一次收口。全程**引擎行为零变更**（Non-goal「引擎行为变更单一归属 P4」的 P1 面约束）——本 phase 只动声明行、锁文件与文档，引擎 vitest 0 语义改动。

### 1. 依赖现状与目标（取证基线）

#### 1.1 声明面盘点

cdd-engine（`packages/cdd-engine/package.json`）：`dependencies.simple-git ^3.36.0`（**唯一运行时依赖**）· `devDependencies` = `@types/node ^26.6.4` · `typescript ^7.0.2` · `vitest ^5.0.3`。根（`package.json`）：`devDependencies` = `@types/node ^26.6.4` + 工具链（`@biomejs/biome ^2.5.15` · `husky ^9.1.7` · `lint-staged ^17.6.0` · `typescript ^7.0.2` · `vitest ^5.0.3` · `yaml ^2.9.1` · `@changesets/cli ^3.0.3` · `@changesets/changelog-github ^1.0.1` · `@changesets/config ^4.0.1` · `@changesets/read ^1.0.1`）。`pnpm-workspace.yaml` 无 catalog（基准：仅 `packages/*` glob + allowBuilds）· 根无 `.npmrc` —— **声明面 = 两处 package.json**；2026-10-10 起 pnpm 自动向 `pnpm-workspace.yaml` 追加 **minimum-release-age 政策注记**（`minimumReleaseAgeExclude` · 语义 §4.2 · 文件面归置 §6.2——机械依赖面，随提交①落盘，不属声明面）。

#### 1.2 registry 事实（npm view 实证 2026-10-10）

simple-git latest **4.0.2**（4.0.x 无 `engines` 声明）· @types/node latest **26.6.5**（26 线）· @types/node@24 线 latest **24.19.2**。`.nvmrc` = v24 · CI setup 默认 `"24"`（`.github/actions/setup/action.yml` `inputs.node-version.default`）——运行时线 = 24，与 types 线现状（^26.6.4）**脱节**：这是「类型 = 运行时」要修的撒谎面。

#### 1.3 pnpm outdated 工具语义（overall v1.2 验收改写之据 · 评审证伪修正）

实测 `pnpm outdated --long` = **零行 exit 0**，但 registry 有明显更新可见 → 当日零行的**唯一成因是本地元数据 cache 陈旧**（26.6.5/4.0.2 对声明不可见），**非工具不收越-range major**：对照实验（/tmp/pnout-test · 声明 `^3.36.0` 解析 3.36.0，`pnpm outdated --long`）实证 fresh 元数据下**必报越-range major**（`simple-git 3.36.0 → 4.0.2` · exit 1）。结论：**「零 stale」不能以字面行数验收**（fresh 元数据下越-range major 必报——升级后 `@types/node latest 26.6.5` 对 `^24.19.2` 越-range 同样必报，属线锁 24 设计意图 · 验收容忍项见 Acceptance criteria），改写为三段式；意图线的真实落位以 registry 交叉核对为证，不以 pnpm 判定。

### 2. simple-git 3 → 4 升级（声明面）

#### 2.1 声明变更

cdd-engine `dependencies.simple-git: ^3.36.0 → ^4.0.2`（caret 精度与既有 `^3.36.0` 惯例一致；锁文件随 §4 刷新落位）。

#### 2.2 drop-in 兼容已核（决策 D7 · 子代理取证）

`GitClient`（`src-next/infra/git.ts`）消费面五操作——`simpleGit({ baseDir })` · `revparse` · `status().isClean()` · `raw(["add","-A"])` · `log({ maxCount })` · `.commit()` —— 4.0.2 **全兼容 · 零适配代码**（对照发布 typings 逐项核过）。行为等价由「**零调用面代码改动 + 引擎 vitest 全绿**」双证证明。

#### 2.3 不引新能力（引擎行为变更零混入 · 能力面归独立整体）

4.x 新特性（缩写 long-form option 拦截 · git env 变量过滤 / `allowEnvironment` 透传）**不进入调用面**——只作文档注记（§5.2）；任何引擎调用面行为变动归**独立整体程序**（引擎 doc-tooling · `2026-10-10-engine-doc-tooling-overall.md` · 2026-10-10 拆出裁定）。

### 3. node 版本线锁 24（版本策略一致性）

#### 3.1 engines 行

cdd-engine `engines.node: >=22.18.0 → >=24`——运行线 min 抬到 24 线（资产生命线 = 类型线 = 运行时线三线合一）。

#### 3.2 types 行（根 + cdd-engine 两处）

两处 `@types/node: ^26.6.4 → ^24.19.2`（floor 钉最新 24.x；`^24.19.2` 随 24 minor 自然漂移 = 跟随运行时线——CI actions/setup-node `"24"` 即最新 24）。**根 + cdd-engine 两处必须同钉**，任一残留 26 线即类型撒谎面未消。

#### 3.3 保持面（零变更）

`.nvmrc` v24 · CI setup 默认 `"24"` 保持不动——**验收只证不比**（不引入新文件、新配置、新 gate）。

#### 3.4 运行线验证

本地 fnm node ≥24 直跑（dev face 现行入口不变）；「类型 = 运行时」实证由 **CI node-24 lane** 承担（validate · 引擎 vitest · typecheck 全在 24 线跑）——overall grilling Q0 定案：不进本地 fnm-exec 验证线（非目标「不新增能力」）。

### 4. 依赖全量对齐（lockfile 刷新）

#### 4.1 刷新动作

两处 package.json 声明编辑后，workspace 刷新锁文件（`pnpm install`——声明面变更后的一次完整解析），把锁文件整体对齐 registry；in-range 尾随更新合规（根工具链 minor/patch 随声明面刷新 = 「升级 = 存量声明对齐」· 非新增依赖 · overall Goal ①「lockfile 全量刷新至 registry 对齐」）。

#### 4.2 结果 pin

刷新后 `pnpm outdated` 除 @types/node 单行越-range（latest **26.6.5** vs 声明 `^24.19.2` · 线锁 24 设计意图 · 必报且验收容忍）外零行 · 两条意图线 registry 交叉核对落位（simple-git **4.0.2** · @types/node **24.19.2** 出现在声明 + 锁文件）· `pnpm install --frozen-lockfile` 保持绿（锁一致性门）。

**minimum-release-age 政策注记（2026-10-10 实证 · 机械依赖面 · 随提交①落盘）**：`@types/node@24.19.2` 发布于 2026-10-09T18:44:25Z，提交时点 < 24h——pnpm ≥11 默认 `minimumReleaseAge` = 1440 分钟（24h）发布窗，非严格模式（`minimumReleaseAgeStrict` 默认 false）下 `pnpm install` 解析 `^24.19.2`（窗内无 age-eligible 且 in-range 的 fallback 版本）向 `pnpm-workspace.yaml` **自动追加** `minimumReleaseAgeExclude: ['@types/node@24.19.2']`（安装版二进制实测输出「Added 1 entry to minimumReleaseAgeExclude …」· 官方 docs 称纯手工维护——以实证为准）；无此 exclude 则窗内 fresh resolution 无 `^24.19.2` 可落（失败/脏树）。`minimumReleaseAgeExcludePrune` 默认 false → 窗过后条目滞留（可安全人工摘除 · pnpm 不自动清理 · 再解析不再需要）。

#### 4.3 网络/环境面零新增

根无 `.npmrc`（registry 概念零新增）· 无环境变量面引入。

### 5. maintainers 05 §1 文档同步

#### 5.1 §1 adopted 表行

simple-git 行 `^3.36.0 → ^4.0.2`（declared / lockfile 两格更新；lockfile 最新值以 §4 刷新后实际落位为准）。

#### 5.2 4.x 前瞻注记（D7 · 只作文档）

§1 补 4.x 前瞻注记两行：**缩写 long-form option 拦截**（4.x 对 `--` 缩写选项行为收口——future 若启用须显式全拼）· **git env 变量过滤**（`allowEnvironment` 默不过滤——consumer 面若涉及受限 git 环境须显式声明）。**只作文档记录 · 不启用 · 不引入能力**（若未来决议启用 → 独立整体程序引擎 doc-tooling 承接）。

#### 5.3 工具链段行

§1 repo toolchain 段 `@types/node (^26.6.4)` → `(^24.19.2)`（消费面文字与声明面同步，防文档撒谎）。

### 6. 门禁与执行序

#### 6.1 验证面（顺序）

前置：`packages/cdd-engine/` 包根无 `src`/`config` 残留（清空 P2 改名预演遗留的空壳目录——git 不可见 · 实测残留于当前工作树）后，先跑基线 `pnpm run precommit` + 引擎 vitest，**基线全绿是升级对标的起点**。

基线后顺序：`pnpm run precommit`（树无关子集 · doc-contract gate **16** specs/plans 保持——评审后引擎 new overall 落地 +1 的实值）→ `tsc --noEmit` 三项目 → 引擎 vitest（`pnpm --filter @oscaner-skills/cdd-engine test` · 以干净工作树为前提）→ `pnpm run validate` ALL PASS（emit 新鲜 / channel audit / residue 零回归）。

#### 6.2 提交粒度

两提交，互不混：① 依赖声明 + 锁文件 + **`pnpm-workspace.yaml` minimum-release-age 政策注记（机械依赖面 · §4.2）** ② maintainers 05 文档同步（文案面）。任一违反 = 提交污染。

#### 6.3 引擎行为零变更 pin

引擎 vitest **0 语义改动** · guard 三件套（anatomy / word-face / channel）零回归 · residue 零新词 —— 升级若有任何引擎行为漂移，即本 phase 违约（引擎能力变更面 → 独立整体程序引擎 doc-tooling 诊断，不在此修）。

### Acceptance criteria

- `pnpm outdated` 除 @types/node 单行越-range 外零行（升级后 · 全树；@types/node latest **26.6.5** vs 声明 `^24.19.2` 属线锁 24 设计意图 · 必报且验收容忍）
- 两条意图线 registry 交叉核对：simple-git **4.0.2**（声明 + 锁文件）· @types/node **24.19.2**（根 + cdd-engine 两处声明 + 锁文件）——以 `npm view` fresh 元数据比对，不以 pnpm 判定为准
- in-range 刷新实证：新鲜元数据下 wanted==current 全树（声明面经 `pnpm ls` 抽查）
- `engines.node >=24` 就位（cdd-engine package.json）
- `tsc --noEmit` 三项目全绿（engine / scripts / kairos-tests）
- 引擎 vitest 全绿（`pnpm --filter @oscaner-skills/cdd-engine test` · 0 语义改动 · 以干净工作树为前提——包根无 `src`/`config` 残留）
- `pnpm run validate` ALL PASS（emit 新鲜 / channel audit / residue 零回归）
- `pnpm run precommit` 过（含 doc-contract gate 16 specs/plans 保持）
- maintainers 05 §1 落（simple-git 4.x 行 + 前瞻注记两行 + @types/node 行）

## Constraints

- **引擎行为变更零混入**：P1 不引入 simple-git 4.x 新能力（缩写 long-form option 放行 / git env 变量过滤透传）——前瞻注记仅作文档；任何引擎 CLI 行为变动归 P4 单一归属（overall Non-goal ②）
- **`.nvmrc`/CI setup 零变更**：v24 · 默认 `"24"` 保持——验收只证不比，不新增 gate/配置
- **不新增依赖**：升级 = 存量声明对齐（simple-git/@types/node 两行 + 锁文件刷新），非新增第三方包
- **变更先回填本 overall**：backfill-as-version 先行（本 phase 已有先例：overall v1.2 定案同步）再继续实现
- **基线先行**：任何升级前先跑验证基线（precommit/validate），升级后重跑对照——diff 只应是依赖行，行为差异即违约
- **语言纪律**：内部 docs 中文（本 spec · Strategy B）· maintainers 05 英文主源（Strategy A 扩展）

## Deviations

| Overall assumption | Phase decision | Overall updated? |
|---|---|---|
| 「pnpm outdated 零 stale」字面可测（overall v1.1 原始验收行） | 三段式改写：`pnpm outdated` 除 @types/node 单行越-range（26.6.5 vs `^24.19.2` · 设计意图）外零行 + 两条意图线 registry 交叉核对（simple-git 4.0.2 · @types/node 24.19.2）+ in-range 刷新实证（wanted==current 全树）——取证：零行**唯一成因是本地元数据 cache 陈旧**（对照实验实证 fresh 元数据下 pnpm outdated **必报越-range major** · exit 1 · 原「不报越-range」因果证伪），字面验收空洞 | Yes |

## Notes for downstream

- **P2（src-next → src 改名）会改写本 spec 的 `src-next` 字面量**（Q3→b 历史面全改覆盖 docs/kairos specs+plans）——P1 实施期的 dev face 引用 `node packages/cdd-engine/src-next/bin.ts` 在 P2 落地后统一变 `src/bin.ts`，无需本 phase 预改
- **本 phase 不单开 changeset**：simple-git bump · node 线策略贡献归 P3 主题归并吸收（overall Constraints「changesets 托收整理」· D6 发布边界）
- **前瞻注记两行（§5.2）若未来决议启用**，属引擎能力变更 → 独立整体程序引擎 doc-tooling（P2 模板写作同程序）承接，不在此 phase 引入
- **P1 验收全程在 current src-next 树上**（P2 改名前的路径面）——改名保真审计在 P2 单独承担

## Change history

| Version | date | summary | author |
|---|---|---|---|
| v1.0 | 2026-10-10 | P1 设计 spec：simple-git `^3.36.0 → ^4.0.2`（drop-in 已核 · 不引新能力）+ node 线锁 24（engines `>=24` · types 两处 `^24.19.2` · `.nvmrc`/CI 保持）+ 依赖全量对齐（三段式验收）+ maintainers 05 §1 同步（4.x 前瞻注记）· 增量为父 overall v1.2 注册面的展开（Q0 覆盖确认 · Q1/Q2 grilling 定案） | [human] · Claude Opus 5（kairos:cdd-design [P1] enumerate-then-grill → cdd-spec-writer） |
| v1.1 | 2026-10-10 | **程序结构回填（P4 拆出 · 2026-10-10 用户裁定「这个问题和 P4 其实是同一类的吧？」）**：父子整体 `engine-doc-tooling` 成立（review-face 键 + schema gen 同属引擎 doc-tooling 能力类）——本 spec 引擎行为引用（§2.3 / §5.2 / §6.3 / Notes）从「P4 赛道」改指独立整体程序；Parent program 版本 v1.2 → v1.3 | [human] · Claude Opus 5（kairos:cdd-design 拆出裁定） |
| v1.2 | 2026-10-10 | **spec-review-1 修正（3 findings 全修）**：F1「pnpm outdated 不报越-range major」证伪——§1.3/§4.2/Acceptance/Deviations 因果改「零行唯一成因 = 本地元数据 cache 陈旧 · fresh 元数据必报越-range major · 验收容忍项 = @types/node 单行越-range（26.6.5 vs `^24.19.2` · 设计意图）」（父 overall v1.4 同语 backfill 已落）· F2 §6.1 补环境前置（包根无 `src`/`config` 残留 · 引擎 vitest 全绿以干净工作树为前提）· F3 doc-contract gate 14 → 16 specs/plans（评审时实值 15 · 引擎 new overall `93cb4664` 落地后当前树实值 16 · 按 operate 时实值钉） | [human] · Claude Opus 5（P1 spec-review-1 fix 轮统一落） |
| v1.3 | 2026-10-10 | **P1 spec-fix-1 回填（F1 warn · backfill-as-version）**：实施期 `pnpm install` 自动向 `pnpm-workspace.yaml` 追加 `minimumReleaseAgeExclude: ['@types/node@24.19.2']`（2026-10-09T18:44:25Z 发布 · 提交时 <24h · 非严格模式自动注记）——§1.1「无目录级版本陷阱」前提改写（政策注记 · 机械依赖面 · 声明面仍 = 两处 package.json）· §4.2 补 minimum-release-age 语义注记（pnpm ≥11 默认 24h 窗 · 窗内无 in-range age-eligible fallback · 无 exclude 则 fresh resolution 不可落 · `minimumReleaseAgeExcludePrune` 默认 false）· §6.2 提交①验收面补 `pnpm-workspace.yaml` · 父 overall v1.5 同语 backfill 已落 | [human] · Claude Opus 5（P1 spec-fix-1 轮统一落） |
