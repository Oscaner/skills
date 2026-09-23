# 消费者面一致性（Consumer Parity）— P4.1 文档治理 Plan

**Spec:** [2026-09-21-consumer-parity-p4.1-design.md](docs/osuperpowers/specs/2026-09-21-consumer-parity-p4.1-design.md)
**Parent program**: [consumer-parity overall v1.20](docs/osuperpowers/specs/2026-09-21-consumer-parity-overall.md)
**Version**: v1.0 · 2026-09-23
**Depends on**: P3 shipped（[p3-design v1.2](docs/osuperpowers/specs/2026-09-21-consumer-parity-p3-design.md)）；本 session 已产出 overall v1.19/v1.20（P4 拆点分回填）与 [P4.1 design v1.1](docs/osuperpowers/specs/2026-09-21-consumer-parity-p4.1-design.md)
**Base**: develop

## Constraints

### 继承（parent overall v1.20，overall wins on conflict）

- Non-goal #4 已修订：README/CLAUDE.md 全面重写归 P4.1，覆盖全部宣称面（harness 支持面 · 安装/来源宣称 · 行为描述类陈述），重写后与落地行为零分歧；README.zh-CN.md = 同步 mirror（repo 对外宣讲面）
- 四表纪律：**回填 = branch-review 前置义务**（Task 6 closeout backfill-overall，engine 终态欠账硬门）；结构性 mismatch → BLOCK
- 判据三定式（C1 可达性 / C2 结构性 / C3 退化）适用于一切处置判断；超出文档面的分歧 → finding/backfill 上抛，不在本 phase 改代码
- 开发期引擎调用直调：`node packages/cdd-engine/dist/cli.mjs <subcommand>`（禁 global cdd）

### 语言与来源

- 程序文档中文主源（Strategy B）；README / CLAUDE.md / docs/maintainers 英文主源（Strategy A / B extension）；**mirror 仅 README.zh-CN.md**（政策修订随 CLAUDE.md 重写落笔）
- 值 token（phase-id · 布局路径 · grep 探针）locale-neutral，照字面复制

### 文档面边界

- 本 phase 零 engine 变更、零 scripts/validate 变更；改动限 `docs/maintainers/`、根 `README.md`、`README.zh-CN.md`、`CLAUDE.md` + 范围例外 (1) parent overall backfill-overall（Task 6）(2) `packages/osuperpowers/README.md` 入链引用口径同步（rename 后零断裂所需，非包内容面变更、非 emit 输入面）
- 误触 emit 输入面（SKILL.md / package.json / emit 相关）→ 先回填 overall 再动；本 phase 预期零 emit 输入
- 内容保真迁移（v1.20 口径）：弃章节**分布**、内容原样迁移，非弃内容

### 验收探针规范

- grep 探针显式带 `-E`；防白绿——语义名/现名全命中 + 旧名/反例全 miss 双面断言
- node 断言探针（互链解析 · section 编号连续 · 骨架标题镜像）落 `scripts/validate/__tests__/` 或临时 node 脚本，随 Task 5 复跑
- `pnpm run validate`（11 块）与 `pnpm run emit:check` 每任务收尾复跑；dirty-tree 黑盒注意（提交后再跑全量）

### commit 边界机制

- 每 task 输出独立 conventional commit（`docs(...):`）；spec/plan 文档改动除外不 commit（用户无请求时零 commit）
- 不 push；不建 PR（integration 决策归用户 / finishing）
- 禁止 git worktree；禁止 attribution trailer

### Task 1: docs/maintainers 文件名编号迁移（rename + 索引编号表 + 互链全量更新）

- **Do**: 将 8 件内容文件重命名为 `NN-name.md`（两位零填充；分组序——doctrine 族：data-driven-templates · template-doctrine · naming-conventions · context-caching-doctrine；mechanism 族：program-experience · skill-authoring · osuperpowers-plugin · third-party-dependencies）。`README.md` 保持原名，重建为 00-索引：全族编号表（每件一行：编号 · 文件名 · 一句话定位 · 读者块）。全族相对 `.md` 链接（现状 11 处，8 处集中于 README.md）与族外入链 `packages/osuperpowers/README.md`「Docs for maintainers」节同批更新指向新文件名。零 emit 输入面触碰。
- **验收**: `docs/maintainers/` 下内容文件全部命中 `^[0-9]{2}-`（8 件，grep -E，反例零）且 `README.md` 未编号；`README.md` 含编号表（表头一行 + ≥8 数据行）；node 遍历 `docs/maintainers/` 与 `packages/osuperpowers/README.md` 全部相对 `.md` 链接目标存在（零断裂）；`packages/osuperpowers/README.md` 的 maintainers 链接指向新文件名（grep 命中 >=1）

### Task 2: docs/maintainers 章节重组 + 内容保真迁移

- **Do**: 逐文件弃现有章节分布，按新骨架重排（doctrine 族「先定式后操作」序；mechanism 族操作手册序）；文件内 section 编号落地（`NN.` 层级节号，含顶级序号连续性）；章节跨文件搬移日内容原样移动（零改述丢句）；重组后互链复核零断裂。产出旧 section → 新文件/编号映射清单（供 review 层核对保真）。
- **验收**: 每文件顶层 section 编号连续无缺号（node 断言）；`docs/maintainers/` 全族互链零断裂（Task 1 探针复跑全绿）；`pnpm run emit:check` 无 drift；映射清单已产出（grep 一次 —— `docs/osuperpowers/` 下工作产物或 review 记档，标为迁移对照表）

### Task 3: CLAUDE.md 全面重写（5 段骨架 + 语言政策修订）

- **Do**: 弃现有章节分布与内容，按 §2 目标骨架落笔：仓库目的 → ⚠️ emit 产物是派生（置顶警示，repo 最常错）→ 关键命令表（emit / emit:check / validate / changeset / version）→ 架构（包即源 · cdd-engine 直调开发链路 · 语言政策【修订：mirror 仅 README.zh-CN.md】· Review Convergence）→ 提交与维护约定（Git 约定 · changeset 义务 · memory → docs/maintainers）。治理要项零丢失核对：emit-after-change · 零 session-memory 写入 · no worktree · 不 commit 除非请求 · 消费者视角（consumer 环境无 monorepo 布局）。
- **验收**: `CLAUDE.md` 目标顶层 5 段标题（仓库目的 / emit / 命令 / 架构 / 约定——按 section 名 grep 全命中、旧式冗余章节标题零残留）；治理关键词 `emit` · `memory` · `worktree` · `changeset` 各 ≥1 mention；语言政策「mirror 仅 README.zh-CN.md」表述命中（grep）

### Task 4: README.md 全面重写（8 段骨架）+ README.zh-CN.md 同步 mirror

- **Do**: 弃现有章节分布与内容，按 §2 目标骨架落笔 8 段：定位 → 插件表（包 / 版本 / 来源）→ 安装（插件市场 · npm · 上游插件 · per-harness 对照）→ 快速开始 → 架构（packages 布局 + emit 派生链）→ 各包文档 → 开发（常用操作 · 新增一方插件 · 分支流程）→ License。宣称面与落地行为一致：harness 支持面（实证两家：Claude Code + Cursor）、安装命令、来源声明（osuperpowers 一方 / superpowers 等上游）逐条对照。`README.zh-CN.md` 同步翻译（章节集合镜像 README.md；头部 mirror 声明行：mirror 关系 + 同步时间戳）。
- **验收**: `README.md` 目标顶层 8 段标题逐条 grep 命中；`README.zh-CN.md` 头部含 mirror 声明行（grep `mirror`）；`README.zh-CN.md` 顶层章节标题集合与 `README.md` 一致（node 断言镜像）；宣称面对照表（harness 支持面 / 来源 / 安装 3 类）逐条核对完成（记档于 task 提交说明或 review 记档）

### Task 5: 验收探针落地 + 宣称面对照 + 全量校验

- **Do**: 落定/复跑全部机械断言面（文件名编号 grep · 互链 node 解析 · section 编号连续 · zh-CN 唯一性——全仓除 `README.zh-CN.md` 外零 `*.zh-CN.md` · 骨架标题命中/镜像）；宣称面逐条人工对照闭环（含 Task 4 对照表的合入）；`pnpm run validate` 全量 11 块 + `pnpm run emit:check` 无 drift 复跑。
- **验收**: 各探针命令产出零 FAIL（输出节录存档于提交说明）；`pnpm run validate` 输出 ALL PASS；`pnpm run emit:check` 零 drift、exit 0；全仓 `*.zh-CN.md` 仅 `README.zh-CN.md`（grep 单命中）；宣称面对照表三类逐条核对完（记档）

### Task 6: closeout backfill-overall（branch-review 前置义务）

- **Do**: backfill-overall：overall v1.21——P4.1 行 Design-spec 列回填 `[Pending]→[p4.1-design v1.1](2026-09-21-consumer-parity-p4.1-design.md)` · Implementation plan 列回填 `[Pending]→Done` · Clause 增补 change-history v1.21 行（P4.1 shipped 回填声明 + 日期）；同步核对 Issue inventory P4.1 行无现时时态主张。版本行 v1.20→v1.21。
- **验收**: overall 版本行 v1.21（grep）；change-history v1.21 行存在且含 P4.1 回填声明（grep）；P4.1 行 Design-spec 列为 link、Implementation plan 列为 `Done`（grep/目检）；change-history 升序无重复（v1.20→v1.21 相邻）