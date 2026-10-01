# P4.2 — 发布一致性闭环

- **Version**: v1.2 · 2026-09-26
- **Status**: Draft
- **Author**: [human] · Claude Opus 5 (1M context)
- **Parent program**: [2026-09-21-consumer-parity-overall.md v1.44](2026-09-21-consumer-parity-overall.md)
- **Depends on**: P4.4（shipped · [p4.4-design v1.9](2026-09-21-consumer-parity-p4.4-design.md)）

## Section 0: Incremental warning

本 spec 只提交 **P4.2 一个 phase** 的增量：发布一致性闭环。它横跨版本管线、发布门/CI、engine 渲染面、宣讲定位面、运维文档与首次发布执行六簇；六簇同属一个 phase 的六组 task groups（phase-size = fit，P4.4 同尺度先例——单 phase spec + task groups 分批），任何拆分/重排 = parent overall 的 phase-inventory 行 + 依赖边 + change-history 先行（backfill-as-version），不是本 spec 的局部编辑。

## Section 1: Constraints pointer

跨 phase 约定看 parent overall（overall wins on conflict）：
- **宪章 Non-goal #1**（**v1.44 修订后**）：不新增 cdd CLI 子命令，唯一例外 = 信息发现型 `cdd schema get <type>` + 纯渲染型 `cdd issue render` **零执法**子命令；除外仍零新增（执法型）子命令
- **宪章宪法语**（v1.44）：repo scripts → engine 单向依赖铁律——repo 治理面可依赖 engine；**shipped 包 → repo scripts 禁止**，shipped 包必须自包含消费者面
- **宪章主句**（v1.44）：repo 定位改述「基于 cdd 理念的方法论」，harness 宣称面维持 P6 B1 中性「多 harness 可消费」，定位叙事零 harness 枚举
- 语言政策：spec/plans 中文（Strategy B）；README/skills/docs 英文-primary（Strategy A）
- 发布纪律：版本动作 = 原生 `changeset version`（main 上 changesets/action）；`.` 手写版本一律不做

## Section 2: Design body

### §1 版本管线重构（R1/R2）

**裁决基线**：自研版本计算整体退役，版本数学全交原生 `changeset version`。技术事实（P4.2 brainstorm 沙箱实证，changesets v3.0.3）：**原生 `changeset version` 对 0.x 包 + `major` changeset 产出 `1.0.0`**（modern changesets 不把 0.x major 折成 minor；`semver.inc("0.1.0","major") = "1.0.0"`）。因此「0.1.0 降值 + 原生 major 集合」= **cdd-engine 1.0.0 首次稳定开版 = 原生自动产出**，既不需要自研折弯，也不产生 2.0.0。

**1.1 降值声明**：`packages/cdd-engine/package.json` version `1.0.0 → 0.1.0`（从未发布的包，声明值先归真；本次为唯一的手动版本动作）。版本 PR 的 diff 里可见 `0.1.0 → 1.0.0` 一次集成发版轨迹。

**1.2 自研管线整删（零债务）**：
- `scripts/release/version-packages.ts` —— 删（其「changesetsForPlugin → computeNextIndependentVersion → prependChangelog → versioned-plugins.json → unlinkSync 消费」链路整体退役）
- `scripts/lib/version-utils.ts` + `VersionService` —— 删（唯一消费者 = version-packages；P4.4「零死代码」规则下无中间态）
- `.changeset/versioned-plugins.json` **机制退役**：release-plugin 矩阵的「本包是否已版本化」判据改 **git-tag vs package.json semver 对比**（`git tag --list "osuperpowers@*" | sort -V | tail -1` → semver 比较当前版本 > 最新 tag → versioned；双包同构）
- `scripts/run.ts version` 子命令入口与 `scripts/release/__tests__`、version-utils 相关测试 —— 同步删除
- 残留对齐：`.changeset/README.md`（Release flow 述）与 docs/maintainers 发布面文档随改述

**1.3 changesets/action version 命令**：由 `node scripts/run.ts version` 改 **`pnpm exec changeset version && pnpm run emit`**——原生 version 消费 changesets + 写 CHANGELOG（双包）+ 各包 package.json bump；emit 重 stamp osuperpowers 发布产物（marketplace / .claude-plugin / .cursor-plugin 等）使 Version PR 上 version-sync 校验绿——cdd-engine 侧无 emit 产物（其版本只落自身 package.json，由原生 `changeset version` 直接写），不涉及 emit 重 stamp。changesets/action 在 version 命令退出后统一 commit（Version PR）。

**1.4 `consumer-parity-p2-major.md` 声称改写**：prose 层的「`1.0.0 → 2.0.0`；版本化发布动作归 P4」改写为「P2 breaking 随 0.1.0 基线并入 **1.0.0 首次稳定开版**、不起跳 2.0.0；版本化发布动作归 P4.2」。changeset 的 `major` 类型保持（breaking 语义面正确；1.0.0 的 changelog 会写 `Major Changes` 段——发布记录内无版本轨迹谎话）。

**1.5 backlog ×6 占位符清除**：`backlog-{cdd-engine,osuperpowers}-{major,minor,patch}.md` 六件 `git rm`——其内容已被 overhaul p1–p6 真实 changeset 覆盖，清除 = 零发布痕迹（不消费、不写 changelog）。

**1.6 version-sync 补 cdd-engine 覆盖（原生管线下）**：`scripts/validate/version-sync.ts` 增 cdd-engine 段——(a) package.json 声明 semver 格式断言；(b) 发布态版本身份断言经 `smoke-cdd --expect-version`（§2.2）承担，不重复造产物（cdd-engine 无 emit 产物，不伪造 sync 面）。

### §2 发布门 + workflows 三层重构（R3）

**2.1 consumer-sim 定位**：`smoke-cdd`（scripts/validate/smoke-cdd.ts）消费者黑盒**专属 cdd-engine**（真实 build → pack → tarball 断言 → 消费者仓安装 → 五命令 dry-run 链 → return-block 契约）。osuperpowers **走正常 npm 发版**（为 pi 类 npm-harness 预留的通道），其发布品校验 = §3 pack 内容面审计 + emit 产物 + version-sync，不做插件安装面的伪消费者模拟。

**2.2 `smoke-cdd --expect-version <ver>`**：新增可选参数——tarball 内 `package.json` 的 version 字段 == 期望值才继续（发布态版本身份断言）。接线 release.yml 的 **post-version 门**，构造钉死：changesets/action 的 `version` + `publish` 同 action，`hasChangesets` 只有 action 运行后才能知——门放 action 后 = `publish` 后（门失去拦截力），∴ 门必须在 action **前**独立成步，以早判定把 false/true push 区分开。具体：release job 在 changesets/action **之前**新增一步 `pnpm exec changeset status --output=<tmp>`（JSON `changesets` 数组空 = 无未消费 changesets = `hasChangesets=false` push）→ `--expect-version` 门步 `if:` 限定该 false push 并置于 action 前执行 `node scripts/run.ts smoke-cdd --expect-version 1.0.0`——Version PR 合并后的再 push（tree 已是 1.0.0 发布态）上「发布品即校验品」字面兑现，且拦截在 `changeset publish` 之前；`hasChangesets=true` push（Version PR 产生前、tree 仍 0.1.0）不触发断言，不破坏首次 version push。pre-version 基线门（现已有、无 expect-version）保留现有 pre-action 位置——Version PR 产生前失败 → 干净回退。

**2.3 workflows 三层重构**：
- **Tier 1 PR 门**：`pr-validate.yml` 收敛为 `checkout → actions/setup → actions/validate` 三步 compose（**删 link-cdd-engine、删 smoke-cdd**——消费者黑盒归 release 门，PR 提速一个全链）；显式 `permissions: contents: read`
- **link-cdd-engine/action.yml 整删**：`npm link` 是 CLAUDE.md 明令「npm link 已移除」的治理违规；P3 后的 smoke-cdd 已自包含（消费者 tarball 内自解析），全局 `cdd` 零消费者——整个 action 无存在理由
- **node 全树统一 24**：`actions/setup` 保持默认 24；release.yml 删手工 `setup-node node-version: 22`，改复用 setup action（与 engines `>=22.12.0` 一致；消 22/24 双版本漂移）
- **release-plugin 矩阵双包**：`osuperpowers` + `cdd-engine` 两条目（tag_prefix `osuperpowers@` / `cdd-engine@`）；判据 = §1.2 git-tag/semver；tag + GitHub Release ×2
- **push 覆盖模型**：validate 在 PR 面全覆盖（develop→main PR + changeset-release/* 的 base-main PR 都跑 pr-validate）；push→main 本身不跑 validate——发布面 = emit 新鲜度（release.yml 预步）+ 双 consumer 门（pre 基线 + post --expect-version）；覆盖边界写入 release.yml 注释与 docs/maintainers
- **sync-main-to-develop**：维持（workflow_call 复用，释放回流）

### §3 pack 内容面审计 → 数据面单源（R4）

**根因**（P4.2 brainstorm 实证）：`packages/osuperpowers` 现整包含 `tests/` ×6 + 包内 `scripts/`（report-templates.mjs · render-yaml.mjs）+ `bin/utils/exit.mjs` 死代码 + `.version-bump.json` + **开发残留 `.superpowers/cdd/skill-digraph-refactor-p1/`（gitignored 但 `npm pack` 照装）**。其中 `scripts/report-templates.mjs` 是 **shipped 技能 `report-issues` 的运行期依赖**（I5 契约：`node "${pluginRoot}/scripts/report-templates.mjs"` 直出 body）——scope 原文「scripts/ 治理残件」表述错误，根修 = **迁 engine**（依赖方向铁律）。

**3.1 权威迁移**：
- `skills/report-issues/templates/finding-meta.json`（issue body 模板权威）→ **cdd-engine**（templates/ 面；`DOC_SCHEMA_NAMES` **不新增** doc-type——模板唯一消费者 = 渲染器，emit 经 repo→engine 方向 import，无发现型消费者）
- 渲染逻辑 → **新子命令 `cdd issue render`**（P4.2 命名裁决：object-verb 与 `cdd schema get` 同构；`report`/`issue-report` 被 task/session report 词义污染弃用）：stdin findings JSON → stdout aggregate issue body，确定性、零执法；P4.4 OOP 下落 **`IssueReportRenderer`** domain service + cli 条目路由
- 技能面：`skills/report-issues/SKILL.md` I5 表述改「body 由 `cdd issue render` 直出」；**pluginRoot-ascending 文件寻址机制删除**（不再就近找 `.claude-plugin/plugin.json` → scripts/）

**3.2 包内 scripts/bin 整删**：
- `scripts/report-templates.mjs` —— 删（迁 engine）
- `scripts/render-yaml.mjs` —— **迁 repo 治理面**（emit-only YAML 渲染器，迁 `scripts/emit/` 或 `scripts/lib/`；repo 侧 import，不 ship）
- `bin/utils/exit.mjs` —— 删（死代码：自称「供 runner.mjs」，旧引擎早已删除，全仓零引用）
- `packages/osuperpowers/scripts/` + `bin/` 目录空 → 整体删除

**3.3 emit repoint**：`scripts/emit/issue-templates.ts`（生成 `.github/ISSUE_TEMPLATE/*.yml`）的 finding-meta 消费改从 **engine** import（repo → engine 方向合法）；产物重生成 → `emit:check` 零 drift。

**3.4 files 白名单**（`packages/osuperpowers/package.json` 增 `files`）：`skills/` · `.claude-plugin/` · `.cursor-plugin/` · `README.md` · `README.zh-CN.md` · `CHANGELOG.md` · `package.json` —— 共 7 项。

**3.5 残留清除**：`packages/osuperpowers/.superpowers/`（gitignored 开发工作区残留）目录删除；白名单包住后即使再生也不会进包。

**3.6 Non-goal #1 例外修订**：已随 overall v1.44 同步（「唯一 = schema get」→「发现型 schema get + 纯渲染型 issue render」）——本 phase 落地其一。

### §7 plan-constraints 再生语义（2026-09-26 mid-backfill 追加）

**根因**：T22/§T7.1 的 plan-constraints.md 材料化为 **generate-once**——implement pre-flight（`task.ts` line ~487）为纯 `existsSync` 门：TG1 生成后，后续 TG 全部跳过（`materializePlanConstraints` 自身也是 `if (existsSync) return {generated:false}`）。`isPlanConstraintsStale`（plan-hash anchor 比对）已实现但**零接线**——plan Constraints 的 mid-backfill 更新永远不会刷进派生产物。

**处置（彻底去 generate-once · 非 breaking）**：
- `materializePlanConstraints` 去 generate-once 早退：每 dispatch 无条件从 plan Constraints source 重新提取 + **覆写** plan-constraints.md（保留确定性 header：plan basename + hash 作 provenance；`generated` 返回若成恒真随代码简化）
- implement pre-flight 去 `existsSync` 跳过：**每次 implement dispatch（= 每 TG 起点）必调 materializePlanConstraints**
- `isPlanConstraintsStale` + 其测试 = 真死代码随删（锚点保留作 provenance，不再作 stale 判定）
- plan-constraints.test.ts / runner.test.ts 的 generate-once 断言面反转为「无条件再生」语义（同 plan 二次调用覆写同字节 = 确定性保持）；T22 注释同步
- 非 breaking：CLI/字段面零变化，仅派生产物再生语义

### §4 宣讲定位面（R5/R6/R8）

**4.1 README 三段式骨架**：**定位（R8）→ 理念（R6）→ 行为（P4.1 成果）**——理念导览成第一读层：
- **定位句**（CLAUDE.md + README 共用，English-primary）：`A cdd-first methodology: continuously-discovered development as the core discipline, AI coding skills as the distribution vehicle.`（无 harness 字样；未来加 harness 零约束）
- **理念导览章节**：cdd 是什么 · 为什么这样设计 · 三种模式链（implement→review→fix）· Review Convergence 等收敛纪律
- **行为面**：P4.1 重写成果原样承接，零重写（只验零分歧）

**4.2 gh 元信息**（2026-09-26 裁决）：description = `A cdd-first methodology repo — continuously-discovered development as the core discipline, AI coding skills as the carrier.`；topics = `cdd` · `ai-skills` · `ai-agents` · `methodology` · `claude-code` · `cursor`；**homepage 留空**（无独立站点，README 即门面；有 site 再挂）。

**4.3 zh mirror 三件全量同步**：根 `README.zh-CN.md` + `packages/osuperpowers/README.zh-CN.md` + `packages/cdd-engine/README.zh-CN.md`（宣讲面重写 = 三件同步 mirror；语言切换行维持 `[中文]`，P4.1 裁决不变）。

**4.4 CLAUDE.md 定位句**：同步改述（repo 定位句 + Non-goal #1 例外表述 + 单一来源措辞不回归）。

### §5 运维文档精炼（R7）

- **合并**：`01-data-driven-templates.md` + `02-template-doctrine.md` → 单文档 `01-template-doctrine.md`（template 面一个文档；02 槽位随合并消失）
- **重编号**：剩余五件**连续重编号 01-05**（有意不留断号）——`03-naming-conventions.md` → **02** · `04-context-caching-doctrine.md` → **03** · `05-program-experience.md` → **04** · `06-third-party-dependencies.md` → **05**；下文与 Acceptance 引用一律用新号 → 内容文档 6 → **5**
- **精简**：`04-program-experience.md`（原 05）19.5KB → ~12KB（程序叙事/已过时条目清除，actionable lessons 保留）
- **更新**：`02-naming-conventions.md`（原 03）到 P4.4 终态（REVIEW_FIX / group-* / `--tasks` / `issue` 词表）；`05-third-party-dependencies.md`（原 06）到 P4.4 deps 终态（biome · ts7 + @types/typescript6 shim · execa 10 等登记）
- **保留**：`03-context-caching-doctrine.md`（原 04；engine cache-profile 活契约，不动）
- **互链零断裂**：index README + CLAUDE.md 引用 + 内部链接迁移完整（链接探针，含重编号对应编号引用同步：03→02 / 06→05 等）
- **补位**：smoke-cdd 定位说明（P4.2 dogfood：owner 不确定其用途 → 在 docs/maintainers 写明「consumer-sim = cdd-engine 发布品消费者黑盒」）
- **净目标**：62.6KB → ~42KB（-33%）、6 → 5 内容文档；验收 = 收敛前后对照 + 链接探针

### §6 首次发布执行（R1–R8 收口）

版本目标推导——**cdd-engine**：现声明 0.1.0（1.1 降值）+ 累计 major changesets → 原生 `changeset version` 产出 **1.0.0**（§1 裁决基线，0.x major 不前折）；**osuperpowers**：现声明 **0.1.1**（已发布、npm + git tag 均存在）+ 累计 minor changesets（p3 / p4 / p5-report-issues / p6-osuperpowers-surface，及 p4.3 / p4.4 系列，均 osuperpowers minor）→ minor 折叠 → **0.2.0**（沙箱实证 Method 与 §1 同源：changesets v3.0.3，`0.1.0 + major → 1.0.0`、`0.1.1 + minor → 0.2.0`）。

流程（全部配方细则 §1–§5）走一遍，产出：
1. cdd-engine **1.0.0**（首次稳定）/ osuperpowers **0.2.0** —— 原生 changesets 一次集成发版，双 CHANGELOG 成文
2. post 门 `smoke-cdd --expect-version 1.0.0` 过 → npm publish（双包）
3. tag `cdd-engine@1.0.0` + `osuperpowers@0.2.0` + GitHub Release ×2
4. gh 元信息应用（description/topics）
5. sync-main-to-develop 回流
6. 验收探针全绿（见下）

### Acceptance criteria

- `packages/cdd-engine/package.json` 声明值 = `0.1.0`（降值落盘）；`pnpm exec changeset version` 双包一次过（cdd-engine → 1.0.0 · osuperpowers → 0.2.0，DRY 层可验）
- `scripts/release/version-packages.ts` / `scripts/lib/version-utils.ts` / `.changeset/versioned-plugins.json` 机制零残留（grep 断言）；`scripts/run.ts version` 入口已退役
- `.changeset/consumer-parity-p2-major.md` 无 `1.0.0 → 2.0.0` / `归 P4，` 字样；`backlog-*` ×6 零残留（git ls-files 断言）
- `cdd issue render` 确定性实证：原 repo 侧 report-templates 黄金样本迁移到 engine（同字节）；`packages/osuperpowers` 内 `scripts/` + `bin/` 面零残留（grep 断言）+ `.superpowers/` 已清除
- `scripts/emit/issue-templates.ts` 从 engine import finding-meta 权威（无 `packages/osuperpowers/skills/.../finding-meta.json` 直引）+ emit 重生成后 `emit:check` 零 drift
- 白名单 probe：`npm pack --dry-run`（osuperpowers）文件集合 == 7 项白名单（零 `tests/`、`bin/`、`scripts/`、`.superpowers/`、`.version-bump.json`）
- workflows：`pr-validate.yml` = checkout + setup + validate 三步 compose（零 link-cdd-engine、零 smoke-cdd）；`.github/actions/link-cdd-engine/` 已删除；release.yml 无 `npm link` 字样（grep `.github/` 断言）+ 无 node-version 22 + 复用 setup action + release-plugin 矩阵含 `cdd-engine` 双条目
- `smoke-cdd --expect-version` 接线实证：tarball version 断言 + release.yml publish 前 post-version 门存在 + 安装后版本身份断言
- README 三段式骨架（定位 → 理念 → 行为，grep 断言）+ 定位句无 harness 字样 + gh 元信息（description/topics 值与裁决一致，gh 实证）+ zh mirror 三件同步（emit:check / 一致性探针）
- `docs/maintainers` 6 → 5 内容文档（01+02 合并为 `01-template-doctrine`，剩余连续重编号 01-05：naming→02 / context-caching→03 / program-experience→04 / third-party-dependencies→05）、62.6KB → ~42KB（收敛前后对照）+ `02`/`05`（原 03/06）更新到 P4.4 终态 + 互链零断裂（含重编号编号引用同步，链接探针）+ smoke-cdd 定位说明存在
- **plan-constraints 每 TG 再生实证（mid-backfill 追加）**：`materializePlanConstraints` 无 generate-once 早退 · implement pre-flight 无 `existsSync` 跳过（每 implement dispatch 必调）· `isPlanConstraintsStale` 零残留（grep 断言）· 同 plan 二次调用覆写同字节（确定性保持）· engine 测试全绿（`pnpm --filter @oscaner-skills/cdd-engine test`）
- 首次发布执行：`cdd-engine@1.0.0` / `osuperpowers@0.2.0` 双 tag + GH Release ×2 + npm 发布实证（`npm view` 可达）

## Section 3: Deviations from overall

| Overall assumption | Phase decision | Overall updated? |
|---|---|---|
| Non-goal #1：唯一例外 = `cdd schema get`（发现型信息子命令） | 例外扩为「信息发现型 schema get + 纯渲染型 `cdd issue render`」零执法子命令 | Yes — v1.44 · 2026-09-26 |
| pack 内容面审计：不含仓内 tests/、scripts/ 治理残件，补 files 白名单 | 「scripts/ 治理残件」表述修正——report-templates 实为 shipped 技能运行期依赖；升级为数据面单源（迁 engine + `cdd issue render` + 包内 scripts/bin 整删） | Yes — v1.44 · 2026-09-26 |
| consumer-sim release 门实测通过（发布品即校验品，隐含双包覆盖） | consumer-sim 专属 cdd-engine；osuperpowers 走正常 npm 发版（npm-harness 预留）+ pack 审计；post-version 门 `smoke-cdd --expect-version` | Yes — v1.44 · 2026-09-26 |
| version-sync 块补 cdd-engine 覆盖（防 P6 遗留「engine changeset 记录不落地」） | 自研版本管线整删、版本数学交原生 changeset version；version-sync 语义 = 声明 semver + 发布态版本身份断言 | Yes — v1.44 · 2026-09-26 |
| README 定位/宣讲承接 v1.31 理念篇幅 + v1.33 repo 改述（记录待分析） | 三段式骨架（定位→理念→行为）+ 定位句（无 harness 字样）+ gh 元信息（description/topics，homepage 留空） | Yes — v1.44 · 2026-09-26 |

## Section 4: Notes for downstream

- consumer-parity 后续（如有 P4.x）：repo 定位改述的宣讲面承接在 README 理念导览之上增量；homepage 站点未来上线时挂 gh 元信息——本 phase 明确留空非遗漏
- `cdd issue render` 的 future：若未来出现第二个纯渲染消费者，Non-goal #1「纯渲染型」例外是**原则性**豁免（非逐案枚举）——同一形态直接扩，不需再走宪章讨论
- smoke-cdd 的 `--expect-version` 与 pack 白名单探针 = 发布门机械化；日常开发 PR 面已无消费者黑盒（validate 足矣），恢复语句见 docs/maintainers

## Section 5: Review

- 基线：committed tree（overall v1.44 已单独提交）
- 评审轮：P4.2 发布一致性闭环 · Review Convergence（blocker > 0 → fix 全部 → re-review；blocker = 0 → fix 全部 → 收敛，无 re-review）
