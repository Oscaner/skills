---
name: brainstorming
description: 独立 brainstorm 编排器——节点锚定式流程，digraph 为唯一控制流真相源。读取上游 superpowers:brainstorming 作为基线，叠加个人规则（grilling / overall-phase 路由 / spec-review / commit 纪律）。可单独调用；通过 overrides router 由 /brainstorming 触发。
---

# Osuperpowers Brainstorming

完整 brainstorm 流程编排，可单独调用。

## Flow Digraph

```mermaid
flowchart TD
  A[read-upstream] -->|loaded| B[read-sub-skills]
  A -->|missing| Z1((BLOCKED: install superpowers))
  B -->|loaded| C{read-program}
  B -->|missing| Z2((BLOCKED: install mattpocock-skills))
  C -->|mode resolved| D[explore-context]
  C -->|unparseable| Z4((BLOCKED: overall-parse-failed))
  D --> E{claim-phase}
  E -->|phase in overall Phase inventory| F[grilling]
  E -->|phase NOT in inventory (phase-within-program)| S[sync-overall]
  E -->|new-program mode| F
  S -->|four tables consistent| D
  S -->|inconsistent| Z3((BLOCKED: overall-sync-failed))
  E -->|inventory unparseable| Z3
  F -->|mid-grill split / new scope| E
  F --> G[propose-approaches]
  G --> H[present-design]
  H -->|revise section| H
  H --> I{user-approves?}
  I -->|revise| H
  I -->|yes| J[write-spec]
  J --> K[spec-review 3-pass D1/D2/D3]
  K -->|blocker found| K
  K -->|blocker=0| L{user-ok?}
  K -->|pass1 clean (D1 zero findings, skip D2/D3)| L
  L -->|fix selected (after blocker=0, no re-review per Review Stopping)| Q{user-confirm-commit?}
  L -->|approved| Q{user-confirm-commit?}
  Q -->|confirmed| M[commit-spec]
  M --> N{overall-spec?}
  N -->|yes: next phase| O((HANDOFF: brainstorming))
  N -->|no: single spec| P((HANDOFF: writing-plans))
```

## Node Definitions

### `read-upstream`

- **Do**: 读取上游 `superpowers:brainstorming` SKILL.md 作为流程基线。**Read, not Skill-invoke**（Skill-invoke 触发 router 拦截——I1）。解析策略：① 通过 harness plugin 系统定位同级 `superpowers` plugin 的 SKILL.md；② 回退到同 repo 的 vendored 路径。基线仅为 SKILL.md 文件——harness 注入的文档（CLAUDE.md、README、vendor 贡献者指南）不是基线
- **Read**: 上游 `superpowers:brainstorming` SKILL.md 文件
- **Exit**: 文件存在且可读 → `read-sub-skills`；缺失 → BLOCKED（安装 superpowers plugin）
- **Fail**: Skill-invoke 上游 → 违反 I1

### `read-sub-skills`

- **Do**: 读取 `mattpocock-skills` 的 grilling SKILL.md，加载其框架作为 grilling 阶段执行基础。解析策略：① 通过 harness plugin 系统定位同级 `mattpocock-skills` plugin；② 回退到同 repo 的 vendored 路径
- **Read**: grilling SKILL.md 文件
- **Exit**: 加载成功 → `explore-context`；缺失 → BLOCKED（安装 mattpocock-skills）
- **Fail**: 加载失败 → BLOCKED（含安装 mattpocock-skills plugin 指引）

### `read-program`

- **Do**: 检测是否存在父 overall spec（约定路径 `docs/superpowers/specs/*-overall.md`；用户也可在本节点显式提供父 overall 路径——输入通道：一条给出绝对/相对路径的对话消息，且必须匹配 `docs/superpowers/specs/*-overall.md`）。注意：`osuperpowers:brainstorming` 由 harness 经 SKILL.md 触发，而非 CLI 入口，因此父 overall 路径仅通过对话通道获取（无 `--parent-overall` CLI 参数，以避免与 brainstorming 的触发模型冲突）。若存在多个匹配的 overall 文件（glob 命中 >1）→ 终端 `BLOCKED: overall-parse-failed`（提示用户指定唯一的父路径）。解析为模式：`new-program`（无父 overall）或 `phase-within-program`（存在父 overall；这是 per-phase 的 brainstorm）。
- **Read**: `docs/superpowers/specs/*-overall.md`（如存在）+ 可选的、用户提供的父 overall 路径（必须符合上述格式）
- **Exit**: 模式解析完成 → `explore-context`（携带模式标记）
- **Fail**: 父 overall 文件存在但不可解析 / 多个匹配无法消歧 → 终端 `BLOCKED: overall-parse-failed`（带明确提示要求指定唯一父路径；切勿静默降级为 new-program）

### `explore-context`

- **Do**: 携带 `read-program` 解析出的模式标记（`new-program` / `phase-within-program`）。在该模式下探索项目上下文（文件 / docs / git log / 既有研究结论）；据此判断当前请求需要新 phase 还是 phase split。可选 research 仍仅经 Confirm Gate（I2）触发
- **Read**: 项目文件、docs、git log、research 结论；父 overall（phase-within-program 模式）
- **Exit**: 探索完成 → `claim-phase`（携带模式标记）。注意：`explore-context` 的"需要新 phase？"判断仅为建议性探针；`claim-phase` 的 Phase inventory 查表才是唯一权威决策（冲突时以 claim-phase 为准）
- **Fail**: research agent 错误/超时 → 记录 stderr，fail-open（不阻塞流程）。CLI 路径失败 → 降级到 Agent tool 路径

### `claim-phase`

- **Do**: 基于 `read-program` 的模式标记 + 用户请求中的 phase 标识符（如 `/brainstorming P14`），判断该 phase 是否已存在于父 overall 的 **Phase inventory**（四表同步流程见 [add-phase-protocol.md](./docs/add-phase-protocol.md)）：
  - `new-program` 模式 → 直接到 `grilling`（program 级设计最终会到达 `overall-spec?`）
  - `phase-within-program` 模式 + phase **已在** Phase inventory → `grilling`（正常路径）
  - `phase-within-program` 模式 + phase **不在** Phase inventory（新 phase / split）→ `sync-overall`
- **Read**: 父 overall 的 Phase inventory 表
- **Exit**: 已在 inventory / new-program → `grilling`；不在 → `sync-overall`
- **Fail**: Phase inventory 表缺失或不可解析 → 终端 `BLOCKED: overall-sync-failed`（与 sync-overall 同终端，语义一致）

### `sync-overall`

- **Do**: 读取父 overall → 执行四表同步（流程 + 清单见 [add-phase-protocol.md](./docs/add-phase-protocol.md)）：
  ① **Issue inventory** — 追加新的 issue 行（`#NNN` + 所属 phase；若仅 split 既有 issue，填写 phase-ownership 列）；
  ② **Phase inventory** — 追加新的 phase 行（scope / design spec / plan / acceptance / dependency）；
  ③ **Dependency graph** — 添加 hard/soft 边（新 phase 对前驱的依赖 + 后继对新 phase 的依赖）；
  ④ **version bump + change-history** 条目（记录原因、用户决策、scope 边界）。
  然后运行 **四表一致性校验**：phase spec/plan 引用的任意 `#NNN` 必须存在于 Issue inventory；Dependency graph 引用的任意 phase 必须存在于 Phase inventory；新 phase 的 hard-dependency 前驱在父 overall 的 Phase inventory 中必须 **Design spec 列 = `Done`**（与 §2.5 中 I7 同列权威；不再依据 plan 单元 / git 状态判断）。
- **Read**: 完整父 overall spec（含 Phase inventory 的 Design spec 列）
- **Exit**: 四表一致 → 回到 `explore-context`（用已登记的 phase 重新评估 scope）→ 经 `claim-phase`（phase 现在已存在）→ `grilling`
- **Fail**: 四表不一致（如依赖 phase 未交付、悬空引用）→ 终端 `BLOCKED: overall-sync-failed`；绝不允许对未登记的 phase 进行 grilling

### `grilling`

- **Do**: 按 grilling SKILL.md 框架如实执行——逐一追问用户，每次一个问题，等待回答后继续。代码可查的事实自己查，决策问题留给用户。grilling 前需确认 `claim-phase` 已释放本 phase（结构保证——在 Do 字段中显式声明）
- **Read**: grilling SKILL.md 框架（从 `read-sub-skills` 加载）
- **Exit**: 达到 shared understanding → `propose-approaches`
- **Fail**: 以选项菜单/结构化选择列表替代 grilling 框架 → 违反 invariant。grilling 中途检测到 phase split / 新 scope → 路由回 `claim-phase`（与 I6 配对）

### `propose-approaches`

- **Do**: 提出 2-3 个方案含 trade-off 与推荐。YAGNI ruthlessly
- **Read**: grilling 收集的决策 + research findings（如有）
- **Exit**: 方案呈现完毕 → `present-design`
- **Fail**: —

### `present-design`

- **Do**: 逐节呈现设计，每节获得用户确认后再呈现下一节。节复杂度决定长度
- **Read**: 方案选择 + 全部 grilling 决策
- **Exit**: 用户全部节确认 → `user-approves?`；用户要求修改 → 修订后重新呈现该节
- **Fail**: —

### `user-approves?`

- **Do**: 判断用户对整体设计的批准状态
- **Exit**: approved → `write-spec`；revise → 回到 `present-design`
- **Fail**: —

### `write-spec`

- **Do**: 将设计写入 `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`。Overall spec 使用 [overall-spec-template.md](./docs/overall-spec-template.md)；phase spec 使用 [phase-spec-template.md](./docs/phase-spec-template.md)
- **Read**: 全部设计决策
- **Exit**: 文件写入完成 → `spec-review`
- **Fail**: —

### `spec-review`

- **Do**: 执行 3-pass spec review（completeness / consistency&scope / clarity&YAGNI），每 pass 派发独立 `cdd-review` CLI 调用：`node {pluginRoot}/bin/engine/cdd-review.mjs --harness <name> --template spec-review --param PASS=<pass-type> --param DOC=<path>`。遵循 [docs-review.md](./docs/docs-review.md) 的 D1/D2/D3 规则。Review Stopping：① 运行 3-pass → ② 发现 blocker → 修复 → 仅重跑该 pass → 循环直到 blocker=0 → ③ 全部 pass blocker=0 → 呈现 warn/nit 给用户 → 继续。Pass 1 零发现（D1）→ 跳过后续 pass → `commit-spec`。仅 Pass 2 为 delta-scoped；Pass 3 始终 full-doc
- **Read**: spec 文档 + [docs-review.md](./docs/docs-review.md)
- **Exit**: blocker=0 → `user-ok?`（呈现 warn/nit）；Pass 1 clean（D1）→ 跳到 `commit-spec`
- **Fail**: blocker=0 后重跑 review → 违反 I5。为新 warn/nit 发起新 cdd-review → 违反 I5

### `user-ok?`

- **Do**: 呈现 spec-review 输出的 warn/nit 列表。用户选项：① Proceed to commit ② Fix selected warns/nits。blocker=0 后不提供重跑
- **Read**: spec-review 输出的 warn/nit findings（从已有输出读取；不发新 cdd-review）
- **Exit**: proceed → `commit-spec`；fix selected → 修复后 → `commit-spec`（不重跑 review）
- **Fail**: 重跑 review → 违反 I5

### `commit-spec`

- **Do**: 将 spec 文档提交到 git。spec 获批即 commit（I4）；不等 dev 合并。

  **Commit 前 overall spec 四表同步校验**（仅当本 phase 是 overall 程序的子 phase 时；single-spec 项目跳过此校验）：
  - Issue inventory：本 phase spec 或 plan 中提及的所有 `#NNN` issue 编号均已在 overall Issue inventory 中登记（新增或更新）
  - Phase inventory：本 phase 行的 scope / design spec / plan / acceptance criteria / dependency 字段已更新到最新状态
  - Dependency graph：若本 phase 新增或移除依赖关系，ASCII 图已同步
  - Change history：本 phase 的变更已 append 一行（含 version + 日期 + 摘要）

  任何一表未同步 → 视为 spec commit 违规，**不得 commit**，必须先同步再提交
- **Read**: spec 文件路径
- **Exit**: commit 完成 → `overall-spec?`
- **Fail**: git 错误 → report + fail-open（不阻塞用户审阅 spec）

### `user-confirm-commit?`

- **Do**: 在 spec 收尾点，显式向用户请求 commit 确认（CLAUDE.md 禁止 auto-commit，因此在 `commit-spec` 之前需要 `user-confirm-commit?` 关卡）
- **Read**: 无（纯确认）
- **Exit**: 用户确认 → `commit-spec`；用户拒绝 → 挂起（不 commit；spec 保留待后用）
- **Fail**: —（确认关卡无失败分支）

### `overall-spec?`

- **Do**: 判断当前 spec 是 overall spec（多 phase）还是单 phase spec
- **Exit**: overall spec → HANDOFF: brainstorming（下一 phase 的完整 brainstorm→plan→dev 循环）；单 phase spec → HANDOFF: writing-plans
- **Fail**: overall 批准后直接进 writing-plans（跳过 phase 级 brainstorming）→ 违反 overall spec 边界规则

## Invariants

| # | Invariant |
|---|---|
| I1 | **Read, not Skill-invoke** — 上游 skill 文件只 Read，不 Skill-invoke（触发 router 拦截） |
| I2 | **Research 需用户确认** — spawn research agent 前必须用户明确确认，不自动触发 |
| I3 | **Design first** — design 获用户批准前禁止任何实施行动 |
| I4 | **Spec commit 纪律** — spec 获批即 commit；不等 dev 合并 |
| I5 | **Review Stopping** — 重跑仅由 blocker 驱动；blocker=0 后不重跑；不为获取 warn/nit 发起新 cdd-review |
| I6 | **Register-before-grill**（scope：`phase-within-program` 模式）— grilling 仅对已存在于 overall Phase inventory 的 phase 运行。`new-program` 模式会经过 `claim-phase` 节点但 **跳过 inventory 检查** 直达 grilling（digraph `E -->|new-program mode| F`）。在 `phase-within-program` 模式下，若 grilling 中途出现 phase split / 新 issue → 路由回 `claim-phase` → `sync-overall`；绝不对未登记的 scope 进行 grilling |
| I7 | **Serial-phase** — 当 `sync-overall` 登记新 phase 时，校验其 hard-dependency 前驱在 overall Phase inventory 中 **Design spec 列 = `Done`**；若未交付（Design spec ≠ `Done`）→ 硬 `BLOCKED: overall-sync-failed`（与 §2.3 同终端；绝不为未满足的 phase 释放 grilling——这正是要阻断的 v1.19c anti-pattern） |

## Failure Modes

| failure | behavior | reason |
|---|---|---|
| 上游 superpowers:brainstorming SKILL.md 缺失 | BLOCKED（含安装 superpowers plugin 指引） | block 政策：不静默 fallback |
| grilling SKILL.md 缺失 | BLOCKED（含安装 mattpocock-skills 指引） | block 政策：子技能缺失不降级 |
| research agent 错误/超时 | fail-open（记录 stderr，不阻塞流程） | research 是可选增强 |
| git commit 错误 | report + fail-open | 不阻塞用户审阅 spec |
| CLI 路径失败 | 降级到 Agent tool 路径 | CLI 不可用但默认路径可用 |
| 父 overall spec 不可解析 / 多匹配 | BLOCKED（overall-parse-failed） | 模式解析无法继续 | 提示用户指定唯一父 overall 路径 |
| Phase inventory 缺失或不可解析 | BLOCKED（overall-sync-failed） | claim-phase / sync-overall 无法把关 | 用户补充或修复 overall Phase inventory |
| 四表同步不一致（依赖未交付 / 悬空引用） | BLOCKED（overall-sync-failed） | 拒绝为未登记 / 依赖未满足的 phase 进行 grilling | 修复 overall 四表后重跑 sync-overall |
