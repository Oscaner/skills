# 消费者面一致性（Consumer Parity）— P4.1 文档治理 Plan

**Spec:** [2026-09-21-consumer-parity-p4.1-design.md](docs/osuperpowers/specs/2026-09-21-consumer-parity-p4.1-design.md)
**Parent program**: [consumer-parity overall v1.25](docs/osuperpowers/specs/2026-09-21-consumer-parity-overall.md)
**Version**: v1.5 · 2026-09-24
**Depends on**: P3 shipped（[p3-design v1.2](docs/osuperpowers/specs/2026-09-21-consumer-parity-p3-design.md)）；本 session 已产出 overall v1.19/v1.20（P4 拆点分回填）与 [P4.1 design v1.1](docs/osuperpowers/specs/2026-09-21-consumer-parity-p4.1-design.md)
**Base**: develop

## Constraints

### 继承（parent overall v1.25，overall wins on conflict）

- Non-goal #4 已修订：README/CLAUDE.md 全面重写归 P4.1，覆盖全部宣称面（harness 支持面 · 安装/来源宣称 · 行为描述类陈述），重写后与落地行为零分歧；README.zh-CN.md = 同步 mirror（repo 对外宣讲面）
- 四表纪律：**回填 = branch-review 前置义务**（Task 6 closeout backfill-overall，engine 终态欠账硬门）；结构性 mismatch → BLOCK
- 判据三定式（C1 可达性 / C2 结构性 / C3 退化）适用于一切处置判断；超出文档面的分歧 → finding/backfill 上抛，不在本 phase 改代码
- 开发期引擎调用直调：`node packages/cdd-engine/dist/cli.mjs <subcommand>`（禁 global cdd）

### 语言与来源

- 程序文档中文主源（Strategy B）；README / CLAUDE.md / docs/maintainers 英文主源（Strategy A / B extension）；**mirror = 根 `README.zh-CN.md` + 各包宣讲面 `packages/osuperpowers/README.zh-CN.md` · `packages/cdd-engine/README.zh-CN.md`**（政策修订随本 phase 落笔；全仓其余零 `.zh-CN.md`）；术语：first-party 中文译名统一「**第一方**」（「一方」禁用，2026-09-23 用户裁决）
- 值 token（phase-id · 布局路径 · grep 探针）locale-neutral，照字面复制

### 文档面边界

- 本 phase 零 engine 变更、零 scripts/validate 变更；改动限 `docs/maintainers/`、根 `README.md`、`README.zh-CN.md`、`CLAUDE.md` + 范围例外 (1) parent overall backfill-overall（Task 6）(2) `packages/osuperpowers/README.md` 入链引用口径同步（rename 后零断裂所需，非包内容面变更、非 emit 输入面）；v1.4 增补面均在既述面内（docs/maintainers 精简删除重编号 · 根/包级 README 切换行语言清扫 · CLAUDE.md/maintainers 索引的 07 引用移除）
- 本 phase 预期零 emit 输入（误触处置见下节『错误处理 if-then gate』）
- docs/maintainers 整理 = **重新整理重新编号，包括精简与删除**（2026-09-23 用户裁决修正 v1.20「内容保真迁移」口径——非仅换分布，需实质精简裁切与删除；`07-osuperpowers-plugin.md` 删除，其唯一值面 release 流程由 `.changeset/README.md` §Release flow 承载）

### 错误处理 if-then gate（镜像 spec §2 错误处理词表）

- 互链断裂（rename/重组后全族相对 `.md` 链接解析失败，scan 验证不过）→ **task BLOCK**：修复后重跑验证再继续
- 声称漂移（README/CLAUDE.md 写 A、落地行为是 B，宣传面对照表演化举证）→ **task BLOCK**：超出文档面即 finding/backfill 上抛，不在本 phase 改代码
- 重写误伤治理要项（emit 警示 / no-worktree / changeset 义务遗漏）→ **review 层 BLOCK**
- 误触 emit 输入面（SKILL.md / package.json / emit 相关 docs）→ **先回填 overall 再动**

### 验收探针规范

- grep 探针显式带 `-E`；防白绿——语义名/现名全命中 + 旧名/反例全 miss 双面断言
- node 断言探针（互链解析 · section 编号连续 · 骨架标题镜像）一律以**临时 node 脚本**落 `.osuperpowers/cdd/2026-09-21-consumer-parity-p4.1/probes/`（gitignored、**不 commit**；输出节录存档于 Task 5 提交说明）——本 phase 零 `scripts/validate` 变更，不新增提交式探针测试
- `pnpm run validate`（11 块）与 `pnpm run emit:check` 每任务收尾复跑；dirty-tree 黑盒注意（提交后再跑全量）

### commit 边界机制

- 每 task 输出独立 conventional commit（`docs(...):`）；spec/plan 文档改动**一般不** commit（用户无请求时零 commit）——**唯 Task 6 的 backfill-overall 产物豁免此条，独立提交**（`docs(program):` 前缀 conventional commit；overall v1.21 需在树可见以作 branch-review 复核基线）；**v1.4 收尾修正回填（overall v1.24 + design v1.4 + plan v1.4）同豁免，独立提交**（移除 07 live 引用后 branch-review 复核基线所需）
- 不 push；不建 PR（integration 决策归用户 / finishing）
- 禁止 git worktree；禁止 attribution trailer

### Task 1: docs/maintainers 文件名编号迁移（rename + 索引编号表 + 互链全量更新）

- **Do**: 将 8 件内容文件重命名为 `NN-name.md`（两位零填充；分组序——doctrine 族：data-driven-templates · template-doctrine · naming-conventions · context-caching-doctrine；mechanism 族：program-experience · skill-authoring · osuperpowers-plugin · third-party-dependencies）。**编号映射钉死：doctrine 族 01-04、mechanism 族 05-08 按上述分组序**——01-data-driven-templates · 02-template-doctrine · 03-naming-conventions · 04-context-caching-doctrine · 05-program-experience · 06-skill-authoring · 07-osuperpowers-plugin · 08-third-party-dependencies。`README.md` 保持原名，重建为 00-索引：全族编号表（每件一行：编号 · 文件名 · 一句话定位 · 读者块）。全族相对 `.md` 链接（现状 11 处，8 处集中于 README.md）与族外入链 `packages/osuperpowers/README.md`「Docs for maintainers」节同批更新指向新文件名。零 emit 输入面触碰。
- **验收**: `docs/maintainers/` 下内容文件全部命中 `^[0-9]{2}-`（8 件，grep -E，反例零）且 `README.md` 未编号；`README.md` 含编号表（表头一行 + ≥8 数据行）；node 遍历 `docs/maintainers/` 与 `packages/osuperpowers/README.md` 全部相对 `.md` 链接目标存在（零断裂）；`packages/osuperpowers/README.md` 的 maintainers 链接指向新文件名（grep 命中 >=1）

### Task 2: docs/maintainers 章节重组 + 内容保真迁移

- **Do**: **step-0 先冻结每文件目标骨架表**（每文件重组后的顶层 section 布局 + `NN.` 节号、含顶级序号连续性——先定式后操作再动内容，而非事后补清单）；逐文件弃现有章节分布，按新骨架重排（doctrine 族「先定式后操作」序；mechanism 族操作手册序）；文件内 section 编号落地（`NN.` 层级节号，含顶级序号连续性）；章节跨文件搬移日内容原样移动（零改述丢句）；重组后互链复核零断裂。产出旧 section → 新文件/编号映射清单，**落定 `.osuperpowers/cdd/2026-09-21-consumer-parity-p4.1/task-2-migration-manifest.md`**（review 记档，gitignored、不 commit；每行一条源 section → 目标文件 + `NN.` 节号，供 review 层逐一核对迁移保真）。
- **验收**: 每文件顶层 section 编号连续无缺号（node 断言）；`docs/maintainers/` 全族互链零断裂（Task 1 探针复跑全绿）；`pnpm run emit:check` 无 drift；映射清单已产出并落定 `.osuperpowers/cdd/2026-09-21-consumer-parity-p4.1/task-2-migration-manifest.md`，含全部源 section → 新文件/编号逐行（grep 对账表头 + 行数，review 层以其逐一核对迁移保真）

### Task 3: CLAUDE.md 全面重写（5 段骨架 + 语言政策修订）

- **Do**: 弃现有章节分布与内容，按 §2 目标骨架落笔：仓库目的 → ⚠️ emit 产物是派生（置顶警示，repo 最常错）→ 关键命令表（emit / emit:check / validate / changeset / version）→ 架构（包即源 · 语言政策【修订：mirror 仅 README.zh-CN.md】· **流程规范零承载**——skill/engine 流程规范不落 CLAUDE.md，单源 SKILL.md + engine，细剥除见 Task 6）→ 提交与维护约定（Git 约定 · changeset 义务 · memory → docs/maintainers）。治理要项零丢失核对：emit-after-change · 零 session-memory 写入 · no worktree · 不 commit 除非请求 · 消费者视角（consumer 环境无 monorepo 布局）。**语言口径同步核对（spec §4 义务，核出 mismatch 即在本 task 修正）**：核 `docs/maintainers/skill-authoring.md` 语言主张（English-primary · 零 `.zh-CN.md` mirror）与 `packages/osuperpowers/README.md` 引用口径（属范围例外 (2) 面，修正不越文档面边界）。
- **验收**: `CLAUDE.md` 目标顶层 5 段标题（仓库目的 / emit / 命令 / 架构 / 约定——按 section 名 grep 全命中、旧式冗余章节标题零残留）；治理关键词 `emit` · `memory` · `worktree` · `changeset` 各 ≥1 mention；语言政策「mirror 仅 README.zh-CN.md」表述命中（grep）；**流程规范零散文**（Review Convergence 定义式 / entry gate 机制描述在 CLAUDE.md 零命中或仅指向——用户裁决 2026-09-23，断言面由 Task 6 探针执行）；`skill-authoring.md` 语言主张与 `packages/osuperpowers/README.md` 引用口径核对结果记档（提交说明节录；核出 mismatch 已在本 task 修正）

### Task 4: README.md 全面重写（8 段骨架）+ README.zh-CN.md 同步 mirror

- **Do**: 弃现有章节分布与内容，按 §2 目标骨架落笔 8 段：定位 → 插件表（包 / 版本 / 来源）→ 安装（插件市场 · npm · 上游插件 · per-harness 对照）→ 快速开始 → 架构（packages 布局 + emit 派生链）→ 各包文档 → 开发（常用操作 · 新增第一方插件 · 分支流程——**流程规范引用式**：命令/指向，不重述 skill/engine 流程规范，同裁决 2026-09-23）→ License。宣称面与落地行为一致（三类专项逐条对照并记档）：harness 支持面（实证两家：Claude Code + Cursor）· 安装/来源声明（安装命令 + 来源声明——osuperpowers 第一方 / superpowers 等上游，合并一类）· **行为描述类陈述**（骨架中的行为断言逐条对应落地行为，断言形态 = 每条陈述 → 对应行为证据行，记档于对照表）。`README.zh-CN.md` 同步翻译（章节集合镜像 README.md；头部 mirror 声明行：mirror 关系 + 同步时间戳）。
- **验收**: `README.md` 目标顶层 8 段标题逐条 grep 命中；`README.zh-CN.md` 头部含 mirror 声明行（grep `mirror`）；`README.zh-CN.md` 顶层章节标题集合与 `README.md` 一致（node 断言镜像）；宣称面对照表（harness 支持面 · 安装/来源声明 · 行为描述类陈述 3 类）逐条核对完成（完成断言与记档唯一归属本 task——记档于 task 提交说明或 review 记档；Task 5 仅合入复核）；README 开发节零 skill/engine 流程规范散文（grep 零命中或仅指向）

### Task 5: 包级 README 重写/新建 + 「一方→第一方」术语清扫（osuperpowers / cdd-engine 宣讲面）

- **Do**: （用户裁决 2026-09-23：包级 README 纳入 P4.1 scope；mirror 政策扩展 = 根 + 各包宣讲面；first-party 中文译名「一方」→「第一方」）① `packages/osuperpowers/README.md` 全面重写（English-primary；宣称面逐条与落地行为对照，纪律同 Task 4 三类专项）——现「Docs for maintainers」互链保持指向新文件名；② 新建 `packages/osuperpowers/README.zh-CN.md`（包级 mirror：章节集合镜像其 `.md` + 头部 mirror 声明行：mirror 关系 + 同步时间戳）；③ 新建 `packages/cdd-engine/README.md`（English-primary：包定位 · 安装/CLI 使用（`cdd help` → schemas 发现面）· 子命令/行为宣称与落地 engine 零分歧（抽样对照记档）· 开发说明；不重述 skill/engine 内部流程规范散文——同 Task 7 零散文原则）与 `packages/cdd-engine/README.zh-CN.md`（mirror，同步时间戳）；④ 「一方→第一方」术语清扫：宣称面文档（README 族 · CLAUDE.md · docs/maintainers）与 specs/plans 的**用法性**「一方」（一方插件 · 一方来源，非第三方）→「第一方」（specs/plans 的禁用式引用「『一方』禁用」保留），`03-naming-conventions.md` registry 补 zh 译名 gloss（first-party → 第一方，「一方」禁用）；⑤ 语言政策行同步：`docs/maintainers/06-skill-authoring.md` 语言主张更新（零 `.zh-CN.md` mirror → 根 + 两包三件集）；CLAUDE.md 政策行由 Task 7 一并更新。
- **验收**: 四件包级文件存在（ls）；`packages/osuperpowers/README.zh-CN.md` 章节标题集合与其 `.md` 一致（node 断言镜像）；`packages/cdd-engine/README.md` 宣称面与落地 cdd CLI 零分歧（`cdd help` 子命令面抽样对照记档）；宣称面 docs（README 族 · CLAUDE.md · docs/maintainers）grep「一方」（显式 `-E`，排除第三方）零命中（含根 zh-CN）；specs/plans 零用法性「一方」（禁用式引用除外）；`03-naming-conventions.md` 含第一方 zh gloss 行（grep）；`pnpm run emit:check` 零 drift（四件均非 emit 输入，scripts/emit grep 零 README 引用实证）

### Task 6: 验收探针落地 + 宣称面对照 + 全量校验

- **Do**: 落定/复跑全部机械断言面（文件名编号 grep · 互链 node 解析 · section 编号连续 · zh-CN 唯一性——全仓 `.zh-CN.md` = 根 `README.zh-CN.md` + 两包 `packages/osuperpowers/README.zh-CN.md` · `packages/cdd-engine/README.zh-CN.md` 三件，零其他 · 骨架标题命中/镜像（根 + 各包）；node 探针按探针规范以临时脚本落 `.osuperpowers/cdd/2026-09-21-consumer-parity-p4.1/probes/` 复跑，不 commit）；**合入 Task 4/5 宣称面对照表并复核完成态**（逐条断言唯一归属 Task 4/5，此处仅复核合入、不重复逐条核对）；`pnpm run validate` 全量 11 块 + `pnpm run emit:check` 无 drift 复跑。
- **验收**: 各探针命令产出零 FAIL（输出节录存档于提交说明）；`pnpm run validate` 输出 ALL PASS；`pnpm run emit:check` 零 drift、exit 0；全仓 `.zh-CN.md` = 根 + 两包三件零其他（grep 三分命中）；Task 4/5 宣称面对照表完成态复核并合入 review 记档（记档）

### Task 7: skill/engine 流程规范零散文剥除（CLAUDE.md + maintainers audit）

- **Do**: （用户裁决 2026-09-23：CLAUDE.md 与 docs/maintainers 不承载 skills/cdd-engine 流程规范——单源 = SKILL.md + engine schema，散文复制不可机检即无法验证准确性；本 task 在 Task 7 closeout 之前执行，shipped 声明才诚实）① `CLAUDE.md`——删「### Review convergence」小节，改指向性一行（各 orchestrator skill 的 `## Invariants` 承载，见 `packages/osuperpowers/skills/*/SKILL.md`）；`### Development-time CDD invocation` 压为命令级事实（`pnpm --filter @oscaner-skills/cdd-engine dev:stub` 生成 stub + `node packages/cdd-engine/dist/cli.mjs <subcommand>` 直调 + 禁 global cdd，删机制散文）；`### Validation and commit flows` + 黑盒段落压为 repo 事实（precommit = 树无关 9 块子集 · 全量 11 块在 CI 干净检出 · 本地先 commit 再全量 validate），删 entry gate / CDD_WARN 机制描述；② `docs/maintainers/` audit——`07-osuperpowers-plugin.md` 的 URC / review digraph / `cdd review --type` 重述剥为指向（单源 = 各 orchestrator SKILL.md Invariants + engine schema / engine 文档），doctrine / naming-registry / program-experience 等机制知识文档保留（非流程规范散文）；③ 全仓 grep 复核零残留（node/grep 探针按 Task 2 探针规范落 `.osuperpowers/cdd/2026-09-21-consumer-parity-p4.1/probes/`，不 commit）；④ `CLAUDE.md` 语言政策行更新为新 mirror 面（mirror = 根 `README.zh-CN.md` + 各包 `packages/osuperpowers/README.zh-CN.md` · `packages/cdd-engine/README.zh-CN.md`，全仓其余零）。
- **验收**: `CLAUDE.md` grep：`Review Convergence` 仅指向引用零定义式、entry gate / `entryGateCleanTree` 机制描述零命中；`docs/maintainers/` grep：`cdd review --type` / review digraph 重述零命中（仅指向）；`pnpm run emit:check` 零 drift（CLAUDE.md / docs/maintainers 非 emit 输入）；`pnpm run validate` 11 块全绿；探针输出节录存档提交说明

### Task 8: closeout backfill-overall（branch-review 前置义务）

- **Do**: backfill-overall：overall **v1.22**（基线 v1.21，见 Pending Acceptance Patch）——P4.1 行 Design-spec 列回填 `[Pending]→[p4.1-design v1.1](2026-09-21-consumer-parity-p4.1-design.md)` · Implementation plan 列回填 `[Pending]→Done` · Clause 增补 change-history **v1.22** 行（P4.1 shipped 回填声明 + 日期）；同步核对 Issue inventory P4.1 行无现时时态主张。版本行 **v1.21→v1.22**。
- **验收**: **accepts pending-acceptance-patch**（task-ref `### Task 8:` · patch: backfill-overall 基线 = overall **v1.21**（P4.3 注册已 bump）→ 产出 **v1.22**，change-history v1.22 行含 P4.1 shipped 回填声明，升序相邻 v1.21→v1.22）；overall 版本行 **v1.22**（grep）；change-history **v1.22** 行存在且含 P4.1 回填声明（grep）；P4.1 行 Design-spec 列为 link、Implementation plan 列为 `Done`（grep/目检）；change-history 升序无重复（**v1.21→v1.22** 相邻）

### Task 9: docs/maintainers 重新整理（精简 + 删除 + 重编号）+ 07 删除 + 引用清扫

- **Do**: （用户裁决 2026-09-23 · PR #275 评审回馈：运维文档没有做整理——要求是**重新整理重新编号，包括精简和删除**，纠正 v1.20 起「内容保真迁移」口径；基线 = 现有 01-08 + README 索引）① 逐文件精简/删除：裁除与 CLAUDE.md / 各包 README / 他文重复的散文，删除死机制/退役陈述（flow-spec 零散文原则延续——不重述 skill/engine 流程规范，点指向）；明确同类项合并成篇；naming 术语表 · engine 依赖表 · 领域规范等权威注册内容零丢句；② **删除 `docs/maintainers/07-osuperpowers-plugin.md`**（用户裁决「没什么必要可以删除」；其唯一值面 release 流程已由 `.changeset/README.md` §Release flow 全量承载）——live 引用清扫：`CLAUDE.md` 两处 07 指引行（改指 `.changeset/README.md` / 移除）、`packages/osuperpowers/README.md`「Docs for maintainers」节 07 链接移除、`docs/maintainers/README.md` 索引行移除；frozen specs/plans 历史引用豁免；③ 重编号为连续 `NN-name.md`（删除/合并后全族按序补位，`08-…` 回填到 `07-…` 等）、`README.md` 索引表同步（编号 · 文件名 · 一句话定位 · 读者块）；④ 互链 + 族外入链零断裂复核（Task 1/2 探针复跑：node 遍历 `docs/maintainers/` 与 `packages/osuperpowers/README.md` 相对 `.md` 链接全解析）；⑤ 清扫 token 复核（07 §3 dissolution 陈述随删除消失）——node/grep 探针落 `.osuperpowers/cdd/2026-09-21-consumer-parity-p4.1/probes/`，不 commit；`pnpm run validate` 11 块 + `pnpm run emit:check` 零 drift。
- **验收**: `docs/maintainers/` 内容文件编号连续无缺号（`^[0-9]{2}-` 全命中、反例零），总件数 < 现状 8 件（精简实证）；`docs/maintainers/07-osuperpowers-plugin.md` 不存在（ls 反例）；live 面（CLAUDE.md · packages README · docs/maintainers）grep `07-osuperpowers-plugin|osuperpowers-plugin.md` 零命中（显式 `-E`；frozen specs/plans 豁免——其历史引用可留）；`.changeset/README.md` 含 §Release flow 全量步骤（grep Release flow ≥1）；互链零断裂（node 探针全绿）；`pnpm run emit:check` exit 0 · `pnpm run validate` 11 块 ALL PASS

### Task 10: 英文 README 语言切换行维持 `[中文]`（用户裁决：language switch 不用改）

- **Do**: （原方向撤销——用户裁决 2026-09-24：language switch 不用改；`[中文]` 为语言切换 UI 的合法原生标签，不构成「英文 README 混有中文」违规）① 三件 English `README.md`（根 + 两包）line 3 语言切换行**维持原样** `[English](README.md) | [中文](README.zh-CN.md)`——零改动（本 task 先前提交的 `[Simplified Chinese]` 改动随裁决回滚，恢复 `[中文]`，已由编排者回滚 commit 落地）；② `.zh-CN.md` mirror（根 + 两包）**不动**；③ 零 emit 输入面接触（README 族非 emit 输入，实证同 Task 4/5）；node/grep 探针落 `.osuperpowers/cdd/2026-09-21-consumer-parity-p4.1/probes/` 不 commit；`pnpm run emit:check` + `pnpm run validate` 收尾复跑。
- **验收**: 根 + 两包三件 `README.md` 的 line 3 语言切换行 = `[English](README.md) | [中文](README.zh-CN.md)`（node 断言三件一致；grep `[中文](README.zh-CN.md)` 命中 3）；`Simplified Chinese` 字面在三件 English README 零命中（显式 `-E`）；三件 `.zh-CN.md` 无 diff（git diff 空）；`pnpm run emit:check` exit 0 · `pnpm run validate` 11 块全绿
