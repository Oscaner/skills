# 消费者面一致性（Consumer Parity）— P4.1 文档治理 Design Spec

- **Version**: v1.3 · 2026-09-23
- **Status**: Draft
- **Author**: [human] · Claude Opus 5 (1M context)（osuperpowers:brainstorming → writing-phase-spec）
- **Parent program**: [consumer-parity overall v1.20](2026-09-21-consumer-parity-overall.md)
- **Depends on**: P3（shipped · [p3-design v1.2](2026-09-21-consumer-parity-p3-design.md)）

## Section 0: Incremental warning

P4 已按用户裁决拆点分 `P4.1`（文档治理）/ `P4.2`（发布闭环），本次 spec 只承载 **P4.1 增量**；P4.2 发布面（版本基准整备 · ×9 changesets 版本化整合 · consumer-sim release 门实测 · pack 内容面审计）落入独立 `…-p4.2-design.md`。本 phase 不再拆分；范围变更需先回填 parent overall（backfill-as-version）再继续。

## Section 1: Constraints pointer

Cross-phase 规则以 parent overall v1.20 为准（overall wins on conflict）：

- Charter Non-goal #4 已修订（v1.19/v1.20）：README/CLAUDE.md 全面重写归 P4.1 承担，覆盖全部宣称面（harness 支持面 · 安装/来源宣称 · 行为描述类陈述），重写后与落地行为零分歧；README.zh-CN.md = 同步 mirror（repo 对外宣讲面）
- 判据三定式（C1 可达性 / C2 结构性 / C3 退化）适用于本 phase 一切处置判断
- 四表纪律：回填 = branch-review 前置义务；结构性 mismatch → BLOCK
- 语言政策：程序文档中文主源（Strategy B）；maintainers / README / CLAUDE.md 英文主源（Strategy A / B extension），**mirror = 根 `README.zh-CN.md` + 各包宣讲面（osuperpowers / cdd-engine 各 `README.zh-CN.md`），全仓其余零 `.zh-CN.md`**（政策修订随本 phase 落笔）
- 本 phase 零 engine 变更、零 scripts/validate 变更——纯文档面；改动限 `docs/maintainers/`、根 `README.md`、`README.zh-CN.md`、`CLAUDE.md` + **包级宣讲面**（`packages/osuperpowers/README.md` 重写 · `packages/osuperpowers/README.zh-CN.md` 新建 · `packages/cdd-engine/README.md` 新建 · `packages/cdd-engine/README.zh-CN.md` 新建），均非 emit 派生输入（scripts/emit grep 零 README 引用实证；aff5c809 实证：docs/maintainers 修改后 precommit emit freshness 全绿）。**范围例外一条**（原二条中 (2) 升格为主面，见 §3 deviation）：(1) parent overall（`2026-09-21-consumer-parity-overall.md`）的 backfill-overall / v-bump 更新——AC6 · 四表纪律的 branch-review 前前置义务；包级 README 的 maintainers 入链引用口径同步随其重写一体承办

## Section 2: Design body

**工作分解：三块 + 一个前置**——A. charter v1.20 基线确认（程内已落地；本案撰写期不再 bump 版本、按需履行四表保卫——overall 版本变动统一由 branch-review 前的 backfill-overall 承担，见 AC6）；B. `docs/maintainers/` 重组 + 编号；C. `README.md` / `CLAUDE.md` 全面重写 + `README.zh-CN.md` 同步 mirror。

**docs/maintainers 重组设计**——现状 9 件：`README.md`（索引）· `context-caching-doctrine.md` · `data-driven-templates.md` · `naming-conventions.md` · `template-doctrine.md` · `osuperpowers-plugin.md` · `program-experience.md` · `skill-authoring.md` · `third-party-dependencies.md`。

- 编号方案：内容文件一律 `NN-name.md`（两位零填充编号前缀）；`README.md` 保持原名（git host 目录自动渲染）作 **00-索引**——内置全族编号表（每件一行：编号 + 文件名 + 一句话定位 + 读者块）；文件重命名 + 每文件内 section 编号（`NN.` 层级节号）
- **内容保真迁移**（v1.20 修订口径：弃**章节分布**、内容原样迁移，非弃内容）：跨文件搬移时日内容整体移动、章节按新骨架重排、互链同步更新
- 分组与编号建议（族内「先定式后操作」序；具体分配由 plan 的任务设计定稿，spec 定约束）：
  - doctrine 族：data-driven-templates · template-doctrine · naming-conventions · context-caching-doctrine
  - mechanism 族：program-experience · skill-authoring · osuperpowers-plugin · third-party-dependencies
- 互链迁移：全族现 11 处相对 `.md` 链接（8 处集中在 README.md）、零 wiki 链接——rename 后全量更新、零断裂（断裂 = BLOCK）；族外入链 `packages/osuperpowers/README.md`「Docs for maintainers」节的 maintainers 链接同批同步（§1 例外 (2)）
- 语言：全英文主源（`docs/maintainers/` 属 Strategy B extension，English-primary、零 `.zh-CN.md` mirror）；不随 package 发布（contentRoot 为 `"."`，`packages/*/` 才发布）

**README / CLAUDE.md 重写设计**——

- `README.md`（英文主源，弃现有章节分布）：目标骨架 8 段——定位段（一段话：多 harness AI 编码技能市场 + 第一方/上游来源声明）→ 插件表（包 / 版本 / 来源）→ 安装（插件市场 · npm · 上游插件 · per-harness 对照）→ 快速开始 → 架构（packages 布局 + emit 派生链）→ 各包文档 → 开发（常用操作 · 新增第一方插件 · 分支流程）→ License；`README.zh-CN.md` 为同步翻译 mirror，头部声明 mirror 关系 + 同步时间戳
- **包级 README（用户裁决 2026-09-23 纳入 scope）**：`packages/osuperpowers/README.md` 全面重写（含 maintainers 入链指向新文件名）+ `packages/cdd-engine/README.md` 新建（English-primary：包定位 · 安装/CLI 使用（`cdd help` → schemas 发现面）· 行为宣称与落地 engine 零分歧；不重述 skill/engine 流程规范散文，同零散文原则）+ 各包 `README.zh-CN.md` mirror（章节集合镜像 + 头部声明行）；**术语**：first-party 中文译名统一「第一方」（「一方」禁用，2026-09-23 用户裁决）
- `CLAUDE.md`（弃现有章节分布）：目标骨架 5 段——仓库目的 → ⚠️ emit 产物是派生（置顶，repo 最常错警示）→ 关键命令表（emit / emit:check / validate / changeset / version）→ 架构（包即源 · 语言政策）→ 提交与维护约定（Git 约定 · changeset 义务 · memory → docs/maintainers）。**流程规范零散文（用户裁决 2026-09-23）：CLAUDE.md 与 docs/maintainers 不承载 skills/cdd-engine 流程规范**（Review Convergence 纪律 · cdd 直调链路机制 · entry gate / handoff 契约，散文复制不可机检即无法验证准确性）——单源 = SKILL.md + engine schema；此类文档仅 repo 事实 · 命令级引用 · 指向性链接
- 宣称面零分歧校核（本 phase 验收核心）：harness 支持面（实证两家：Claude Code + Cursor）、安装/来源声明、行为描述类陈述——与落地行为逐条对照；约定事项（emit-after-change · 零 memory 写入 · no worktree · changeset 逐 phase）不得在重写中丢失
- 超出文档面的分歧（engine/产物行为与文字不符）→ finding/backfill 上抛记档，不在 P4.1 内改代码（上抛触发：重写核校确认既有行为与文字宣称不符、且无法在文字侧对齐；判据按程序判据面 triage——宣称面在消费者环境同样执法，C1 可达性；C3 退化仅处置本仓侧 charter 执法依赖去留，不适用此处）

**错误处理**——互链断裂 = BLOCK（rename 扫描验证）；声称漂移（README 说 A、落地是 B） = BLOCK（宣传面对照表）；重写误伤治理要项（emit 警示 / no-worktree / changeset 义务遗漏） = review 层 BLOCK；误触 emit 输入面（SKILL.md / package.json / emit 相关 docs） = 先回填 overall 再动。

**测试面**——机械守卫：`pnpm run validate` 全绿（11 块含 emit freshness）、`pnpm run emit:check` 无 drift；断言面：文件名编号 grep 断言、相对链接 node 解析断言、`.zh-CN.md` 唯一性 grep 断言、目标骨架章节标题命中断言；人工抽检：宣称面对照表逐条。

### Acceptance criteria

- `docs/maintainers/` 内容文件全部为 `NN-name.md` 形式（`^[0-9]{2}-` 两位零填充编号；`README.md` 例外为索引），`README.md` 内含全族编号表（编号 · 文件名 · 定位 · 读者块）
- docs/maintainers 全族相对 `.md` 链接（`](….md)`）全部解析到存在文件、零断裂，既有 11 处全部迁移（node 遍历断言）
- `README.md` / `CLAUDE.md` / `README.zh-CN.md` + 包级 README（osuperpowers / cdd-engine 各 `.md` / `.zh-CN.md`）按 §2 目标骨架重写/新建落地（目标顶层章节标题逐条命中：grep 断言 8 段 / 5 段骨架 / 包级骨架）
- 根 + 两包三件 `README.zh-CN.md` 头部含 mirror 声明行（mirror 关系 + 同步时间戳）；全仓 `.zh-CN.md` = 三件零其他（grep 断言）
- `pnpm run validate` 全绿（11 块）+ `pnpm run emit:check` 无 drift（重写未动 emit 派生面）
- 本 spec 的 Parent program v1.20 版本行 lineage 合法；P4.1 行 Design-spec / Implementation plan 列随 phase 推进正确回填（backfill-overall，branch-review 前完成）
- 重写后 README/CLAUDE.md/包级 README 宣称面（harness 支持面 · 安装/来源 · 行为描述）与落地行为零分歧（逐条人工对照 + review 记档）

## Section 3: Deviations from overall

| Overall assumption | Phase decision | Overall updated? |
|---|---|---|
| Non-goal #4：不改 README/CLAUDE.md 的 harness 宣称类内容 | P4.1 全面重写（含宣称面），废除旧限制、改正向零分歧约束 | Yes — v1.19/v1.20 · 2026-09-23 |
| P4 = 发布一致性闭环（原 scope，单 phase） | P4 拆点分 P4.1 文档治理 / P4.2 发布闭环（phase-id 语法 A 点分） | Yes — v1.19 · 2026-09-23 |
| maintainers 重组「弃现有章节分布与内容」 | 弃章节分布、**内容保真迁移**（v1.20 spec-review-4 修正口径，非弃内容） | Yes — v1.20 · 2026-09-23 |
| CLAUDE.md 骨架承载 cdd-engine 直调开发链路 + Review Convergence 流程规范 | **流程规范零散文**（用户裁决 2026-09-23）：CLAUDE.md / maintainers 不承载 skills/cdd-engine 流程规范，单源 SKILL.md + engine schema，仅 repo 事实 · 命令引用 · 指向 | No（phase 内内容修正——overall P4.1 scope 未涉 CLAUDE.md 骨架细则） |
| mirror 仅根 `README.zh-CN.md`（语言政策 v1.20） | mirror 扩展 = 根 + 各包宣讲面（osuperpowers / cdd-engine 各 `README.zh-CN.md`，全仓其余零）——用户裁决 2026-09-23 | No（phase 内 scope 细化——overall P4.1 scope 未逐文件枚举） |
| P4.1 scope 未含包级 README（仅根 README 三件 + CLAUDE.md） | `packages/osuperpowers/README.md` 重写 + `packages/cdd-engine/README.md` 新建（+ 各包 zh-CN mirror）入列；原 §1 例外 (2) 升格主面（互链随重写一体承办） | No（同上） |

## Section 4: Notes for downstream

- P4.2（发布闭环）消费 P4.1 重写产物：README/CLAUDE.md 一致性验收已前移至 P4.1；P4.2 保留版本基准整备（cdd-engine `1.0.0 → 0.1.0` 降值 · p2-major 声称改写 · backlog-6 清除 · version-sync 补 cdd-engine）与 pack 审计（osuperpowers files 白名单）——改后 P4.2 相对独立
- 语言政策修订（mirror 仅 README.zh-CN）随 CLAUDE.md 重写落笔；需同步核 `docs/maintainers/skill-authoring.md` 语言主张与 `packages/osuperpowers/README.md` 中的引用口径——核出 mismatch 即在本 phase 修正（`packages/osuperpowers/README.md` 入链更新属 §1 例外 (2)，不属包内容面变更）
- 本 phase 不动 emit 输入（SKILL.md / package.json / emit 相关）；如推进中必须触及，先回填 overall 再动
- **用户裁决 2026-09-23（流程规范零散文）**：CLAUDE.md / docs/maintainers 零 skill/engine 流程规范散文（Review Convergence · cdd 直调链路机制 · entry gate/handoff 契约）——单源 SKILL.md + engine；只留 repo 事实 + 命令引用 + 指向。落地：新 Task 7（剥除断言面）+ Task 3 文案修正 + README 开发节引用式（Task 4）
- **用户裁决 2026-09-23（包级 README + 术语）**：packages/osuperpowers + packages/cdd-engine 各 README.md/.zh-CN 重写/新建（宣讲面一体，mirror 政策扩为根 + 各包，全仓 `.zh-CN.md` 三件零其他）；first-party 中文译名统一「第一方」（「一方」禁用）。落地：新 Task 5 + 探针 zh-CN 三件集 + CLAUDE.md/06-skill-authoring 政策行同步

## Section 5: Review

基于已提交树的 fresh-subagent review（`cdd review --type spec --spec …p4.1-design.md`）→ Review Convergence：blocker=0 → fix 全部 findings（blocker + warn + nit）不再 re-review。spec 经 cdd 链 review 后 commit 即交付 writing-plans。
