# CDD Engine 重构 + 生态完善 — Overall Spec

- **Version**: v1.15 · 2026-09-06
- **Status**: Approved
- **Author**: [human] · Claude Opus 4.8 (osuperpowers:brainstorming)
- **Constraints**:
  - 仓库语言政策：SKILL.md / docs 英文主源；本 spec 中文（Strategy B）
  - 不 commit 除非用户明确要求；changeset 逐 phase 建
  - vendored 子模块不可改
  - 允许破坏性更新，确保最佳实践，不留技术债务

---

## Document scope

Charter only — no implementation detail。

- **Overall approval is not equivalent to any phase started**（GATE）。
- Deviations update here first, then sync to overall。

---

## Program charter

将 CDD engine 从 osuperpowers 内部实现提取为独立 npm package（`@oscaner-skills/cdd-engine`），同时修复 Pζ（post-dogfood-bugfixes-p-zeta 执行期，2026-09-03）执行期间发现的全部 engine bug，并完善 GitHub Actions / scripts 基础设施与 report-issue skill。

**Non-goals**：不修改 vendored 子模块（superpowers / mattpocock-skills / impeccable）；不改变 skill 内容语义（仅修改 engine 调用方式）；不引入 CDD 流程新节点（brainstorming / writing-plans / cli-driven-development 流程本身不变）。

**Cross-cutting constraints**：破坏性更新允许；消费者端改动（安装方式、init 流程）须保持可读性；所有改动须通过 `pnpm run validate`。

---

## Issue inventory

| Phase | Issue (ref) | Title summary |
|---|---|---|
| P1 | [#231](https://github.com/Oscaner/skills/issues/231) | Bug A — cdd-task.mjs --task N does not parseInt — taskNum string breaks progress.json round lookup |
| P1 | [#232](https://github.com/Oscaner/skills/issues/232#issuecomment-5535076416) | Bug B — branch-review + docs-task.mjs 架构语义不兼容 |
| P1 | [#232](https://github.com/Oscaner/skills/issues/232#issuecomment-5535078229) | Bug C — task-review agent 间歇性不写 handoff（需 2-3 次 retry） |
| P1 | [#232](https://github.com/Oscaner/skills/issues/232#issuecomment-5535079789) | Enhancement D — 独立 branch-review.mjs CLI |
| P1 | [#232](https://github.com/Oscaner/skills/issues/232#issuecomment-5535081386) | Enhancement E — @oscaner-skills/cdd-engine 独立 npm package（全部 CLIs 迁入） |
| P1 | [#232](https://github.com/Oscaner/skills/issues/232#issuecomment-5535083420) | Enhancement F — skills gate：engine 未安装时 BLOCK |
| P1 | [#232](https://github.com/Oscaner/skills/issues/232#issuecomment-5535085063) | Enhancement G — osuperpowers:init 简化为单一 init 命令 |
| P1 | [#232](https://github.com/Oscaner/skills/issues/232#issuecomment-5536037663) | Bug K — docs-task.mjs handoff 写入 doc workspace 而非 `.superpowers/<type>/` |
| P1 | [#232](https://github.com/Oscaner/skills/issues/232#issuecomment-5536039777) | Bug L — docs-runner.mjs subprocess 以 doc workspace 为 cwd 时挂死 |
| P2 | [#232](https://github.com/Oscaner/skills/issues/232#issuecomment-5535213637) | Enhancement H — GitHub Actions：cdd-engine 安装 + harness CLI + 可用性测试 |
| P2 | [#232](https://github.com/Oscaner/skills/issues/232#issuecomment-5535261581) | Enhancement I — GitHub Workflows 重构 + scripts 全面重组 + Issue Templates 统一（scope 扩展：从 scripts/validate 模块化扩大为整个 scripts/ 目录重构，2026-09-05 用户决定） |
| P3 | [#232](https://github.com/Oscaner/skills/issues/232#issuecomment-5535307962) | Enhancement J — report-issue skill 重构（session 聚合 + 无 reopen + overall 模板 comment ref） |
| P3 | [#232](https://github.com/Oscaner/skills/issues/232#issuecomment-5536710343) | Enhancement K — brainstorming explore-context 主动读取 GitHub issue comments（`gh issue view NNN --json body,comments`，fail-open） |
| P2 | [#232](https://github.com/Oscaner/skills/issues/232#issuecomment-5553063867) | Enhancement U — CI 集成两处根因（本地 composite 首步需 checkout + npm global bin 跨 step 继承）；P2 实现期已修复（#237 2689284/b37f47d/3482306/ec5989f），沉淀 workflow 编写约定 |
| P3 | [#232](https://github.com/Oscaner/skills/issues/232#issuecomment-5549870456) | Enhancement R — writing-plans `user-ok?`「Fix selected」死选项移除（与 docs-review Review Stopping 「always fix all findings」对齐） |
| P3 | [#232](https://github.com/Oscaner/skills/issues/232#issuecomment-5552903094) | Enhancement S — cdd-engine review 模板 deferred 孤儿机制清理（P1 Bug M 清理不彻底：task-review.md 仍无条件 defer + contract/progress/schema/docs 引用） |
| P3 | [#232](https://github.com/Oscaner/skills/issues/232#issuecomment-5552904440) | Enhancement T — fix handoff schema 拒 `notes` 字段（fix agent 证据说明丢失；加可选 notes 或放宽 additionalProperties） |
| P3 | [#232](https://github.com/Oscaner/skills/issues/232#issuecomment-5553108929) | Enhancement V — superseded（tasklist 不移入 skill；phase 追踪 canonical = overall 四表；#232 历史 tasklist 保留快照，不生成新 tasklist） |
| P3 | [#232](https://github.com/Oscaner/skills/issues/232#issuecomment-5553110014) | Enhancement W — superseded（finishing 不再 PATCH tasklist；与 Enh V 成对撤销；phase 追踪归 overall 四表） |
| P3 | [#232](https://github.com/Oscaner/skills/issues/232#issuecomment-5559454120) | Enhancement X — Review 架构统一（URC）：ReviewLoop 引擎原语 + 全部引擎 CLI 合并为单一 `cdd`（含 select/research/brief/contract 子命令）+ 模板数据化（reviews.json + prefix/suffix 分层注入）+ `_docs/review.md` 节点锚定 SSoT（闭合 F1 D1 增序违例 + F2 docs-task round 竞态） |
| P1 | [#232](https://github.com/Oscaner/skills/issues/232#issuecomment-5537274607) | Bug M — cli-driven-development SKILL.md deferred/ledger 节点清理 + 引擎层 ledger 写入机制删除（ledger.mjs/ledgerComplete/deriveProgressMD） |
| P1 | [#232](https://github.com/Oscaner/skills/issues/232#issuecomment-5537602084) | Bug N — cli-driven-development SKILL.md handoff-status 未区分 blocker=0 路径，未对齐 Review Stopping 语义 |
| P4 | [#232](https://github.com/Oscaner/skills/issues/232#issuecomment-5549287756) | Enhancement Q — cdd-gate 冗余且不生效 → 整体删除（gate core + 11 adapters + hooks + init/emit 联动 + cli-shared CDD_GATE 注入） |
| P1 | [#232](https://github.com/Oscaner/skills/issues/232#issuecomment-5539077124) | Bug O — cdd-session-activate.mjs 孤儿代码 → 删除；gate 激活改 env 传播 |
| P1 | [#232](https://github.com/Oscaner/skills/issues/232#issuecomment-5539300882) | Enhancement P — harness-registry prefix/suffix 通用注入（per mode，`
` 分隔） |

> **Side-effect closures**（由对应 Enhancement 副效果关闭，不独立追踪）：
> - P1 closes：[#133](https://github.com/Oscaner/skills/issues/133) / [#134](https://github.com/Oscaner/skills/issues/134) / [#132](https://github.com/Oscaner/skills/issues/132)（init 简化 + skills gate）；[#137](https://github.com/Oscaner/skills/issues/137) / [#139](https://github.com/Oscaner/skills/issues/139) / [#109](https://github.com/Oscaner/skills/issues/109)（engine 重构）

### Update trigger conditions

The following 3 scenarios MUST sync Issue inventory + version bump + change history entry:

1. **Phase execution discovers a new issue** (dev stage / dogfood session / plan review) → declare ownership in that phase's design spec / plan (which phase fixes it) + add a new row to overall Issue inventory
2. **Phase pre-consumes another phase's issue** (e.g. P1 pre-consumes P3's fix) → add row to overall Issue inventory + mark "pre-consumed" + note the actual fixing phase and effective timing
3. **Issue re-assignment during phase execution** (e.g. an issue moves from P1 to P2) → update the Phase column in overall Issue inventory + version bump + change history entry

**Missed-update detection**: any phase spec / plan that references a specific issue number (`#NNN`) where that number does not appear in the overall Issue inventory is a violation.

---

## Phase inventory

| # | Phase | Scope | Design spec | Implementation plan | Acceptance criteria | Dependency |
|---|---|---|---|---|---|---|
| P1 | CDD Engine 全面重构：#231 taskNum parseInt + Bug B branch-review 架构修复 + Bug C task-review handoff 加固 + Bug K docs-task handoff 路径修复 + Bug L subprocess cwd 挂死修复 + Enh D branch-review.mjs 独立 CLI + Enh E @oscaner-skills/cdd-engine 独立 npm package（全部 CLIs 迁入：cdd-task / docs-task / branch-review / cdd-select / cdd-session-activate / cdd-research）+ Enh F skills gate + Enh G init 单命令 + Bug M cli-driven-development SKILL.md deferred/ledger 清理 + Bug N handoff-status Review Stopping 对齐 + Bug O cdd-session-activate 删除 + gate env 传播 + Enh P prefix/suffix 通用注入 | Done | Pending | `npm i -g @oscaner-skills/cdd-engine` 可用且包含全部 CLI 入口；osuperpowers 零 engine 代码（纯 skill / hook 插件）；branch-review.mjs 独立语义不共享 docs-task runner；docs-task handoff 写入 `.superpowers/<type>/` 目录；subprocess 从正确 cwd 启动不挂死；skills gate 在 engine 缺失时输出标准 BLOCKED 消息；init 单命令完成 engine 安装 + harness 配置；cli-driven-development SKILL.md 无 deferred/ledger 节点；handoff-status 对齐 Review Stopping（blockers=0→fix→done，blockers>0→fix→re-review）；cdd-session-activate.mjs 删除 + gate 通过 env 传播激活；harness-registry prefix/suffix per-mode 注入 + `\n` 分隔生效；`pnpm run validate` 绿 | 无（program 起点） |
| P2 | 基础设施整治：Enh H composite actions + cdd-engine smoke test + Enh I GitHub Workflows 重命名/重构 + **scripts/ 全面重组**（emit / validate / release / rulesets 域目录化 + entry 命名统一为 `verb-object` + 文件内拆分 + ci-validate 拆分为独立可运行模块；允许破坏性路径迁移 + **采用成熟第三方依赖 commander/execa/ajv/semver/vitest/tinyglobby 替换自维护组件**）+ Issue Templates 更新（component / session-type 下拉 + osuperpowers label + session-report template） | Pending | Pending | composite actions 提取（setup / validate / install-harness / link-cdd-engine）；workflow 命名规范统一（pr-validate / release / submodule-* / sync-*）；`scripts/` 按域重组完成：入口统一 `verb-object` 命名、实现按域目录化、`scripts/validate/*.mjs` 各模块独立可运行且 ci-validate 入口仅组合调用、手写 walk/copyTree 由 tinyglobby/cpSync 替换；validate-marketplace 不再依赖 python(jsonschema)，`requirements-dev.txt` 与 workflow setup-python/pip 步骤删除；scripts 测试统一 vitest；`pnpm run validate`/`emit`/`version` 命令面保持稳定；Issue Templates 含 component + session-type 下拉；CI cdd-engine smoke test 通过（Level 0：dry-run + hermetic init 通道验证，无真实 agent） | P1（hard：CI smoke test 需 cdd-engine 已发布） |
| P4 | Gate 移除 + 简化：Enh Q cdd-gate 整体删除（gate core + 11 adapters + configs + 63 tests + hooks PreToolUse + install-harness gate config + emit/ci-validate gate 套件 + cli-shared CDD_GATE 注入） | Pending | Pending | `packages/osuperpowers/bin/gate/` 目录不存在；hooks.json/hooks-cursor.json 无 PreToolUse gate hook；install-harness 不写 gate config；emit 无 gate hook 生成；ci-validate 无 gate suite；cli-shared.mjs 无 `CDD_GATE` 引用；`pnpm run validate` 绿 | P1（soft：移除 P1 Bug O Step 5b 的 gate env 传播产物） |
| P3 | Skills + 模板重构：Enh J report-issue 重构（消费者会话汇报渠道：双通道 filing — program session 追加到程序 tracking issue（plan→overall 判别）vs 消费者 session 聚合到 `[Session report]` master（复用键 workspace `report-target.json`，branch 不作身份）+ 永不 reopen + closed 引用；派生 report-meta（skill/engine 版本/harness/kind/step/CDD/date，隐私安全源）+ 隐私守则）+ Enh K brainstorming explore-context 主动读取关联 issue comments（`gh issue view NNN --json body,comments`，fail-open）+ Enh R writing-plans `user-ok?` 死选项移除 + Enh S cdd-engine review 模板 deferred 孤儿机制清理 + Enh T fix handoff schema 加可选 `notes` 字段；**.github/ISSUE_TEMPLATE 与 report-issue 模板统一为单一事实源**（`finding-meta.json` canonical + emit 渲染 3 个 yml + 运行时组合，删 4 个 md 重复体；字段 mirror component/session-type）；**Enh V / Enh W superseded**；**+ URC Review 架构统一**（ReviewLoop 引擎原语 + 全部引擎 bin 合并为单一 `cdd`（含 select/research/brief/contract 子命令）+ 模板数据化 `reviews.json`（per-type lensEnum/axesGuide/fixTemplate/returnMode；prompt 注入单机制留 `harness-registry.json`——operation×type、`/` 风格、全 harness 补齐）+ `_docs/review.md` 节点锚定 SSoT + round 自增/Review Stopping 引擎强制） | Pending | Pending | report-issue 新 digraph 无 reopen / 无独立建 issue；双通道判别可解析（program → 程序 issue，实测 #232）；session master title `[Session report] <slug\|standalone> <date>` + 体含 Session 元数据 + Findings Summary 表 + 复用键 report-target.json；每条 finding comment 含派生 report-meta 且无 branch/项目路径自动入文；`finding-meta.json` 唯一 canonical — `pnpm run emit` 生成 .github/ISSUE_TEMPLATE/*.yml + `emit:check` drift 绿 + report-issue/templates/*.md 已删；writing-plans 无 `fix selected` 边；brainstorming explore-context 对全部 #NNN 读 comments（fail-open）；引擎 `deferred` 残留 grep（scope = `packages/cdd-engine packages/osuperpowers/skills`，豁免清单见 P3 设计 §2.4）为空；`cdd-handoff-schema.json` 可选 `notes` + ajv 接受；**URC：单一 `cdd` bin（cdd-task/docs-task/branch-review/cdd-select/cdd-research 五 bin 移除；brief/contract 入子命令）+ review 单周期单 dispatch + 引擎 round 自增（round 竞态闭合）+ blocker=0 强制停机 + `_docs/review.md` 节点锚定（D1/D2/D3/pass 词汇清零）+ `reviews.json` per-type lens/axes/fixTemplate 生效（prompt 注入单机制留 `harness-registry.json`：operation×type、`/` 风格、全 harness 补齐）**；`pnpm run validate` 绿 | P1（hard）；P2（soft：串行管理约定，P3 与 P2 无技术强依赖；P2 已合并 PR #237） |

---

## Dependency graph (ASCII)

```
P1 (CDD Engine 全面重构) ──→ P2 (基础设施整治) ──→ P3 (Skills + 模板重构)
                         └──────────────────────→ P4 (Gate 移除) (soft)
```

**说明**：P1→P2 hard；P1→P3 hard（engine 稳定后 report-issue 才能锁定语义）；P2→P3 soft（串行管理约定，无技术强依赖，可与 P2 并行执行）；P1→P4 soft（P4 移除 P1 的 gate env 传播产物，管理上在 P1 之后执行，无技术强依赖）。

---

## Boundary rules

> Each phase: full brainstorm → plan → dev. Shipped before dependents start.
> Requirement changes arising during a phase (new needs, new issues, new constraints discovered in the dev stage) MUST feed back to this overall spec before implementation proceeds — version bump + change-history entry + sync affected phase acceptance/dependency. Do not implement a mid-phase change whose feedback is not yet synced.

---

## Maintenance

- Update links + change history per phase; no task lists.
- Master spec for cross-phase conventions; phase specs incremental.
- Strategy shifts and splits feed back **immediately** (sync to overall). A mid-phase requirement change is a strategy shift — apply the same immediacy (see Boundary rules).

---

## Change history

| Version | Date | Summary | Author |
|---|---|---|---|
| v1.0 | 2026-09-04 | Initial charter — 3 phases, 10 findings from #231 + #232 (Bugs A–C, Enhancements D–J) | [human] · Claude Opus 4.8 |
| v1.1 | 2026-09-04 | +Bug K (docs-task handoff 路径) + Bug L (subprocess cwd 挂死)；P1 scope + acceptance criteria 更新 | [human] · Claude Opus 4.8 |
| v1.2 | 2026-09-04 | +Enhancement K (brainstorming explore-context 读取 issue comments)；P3 scope + Issue inventory 更新；#232 comment 5536710343 | [human] · Claude Opus 4.8 |
| v1.3 | 2026-09-04 | +Bug M (cli-driven-development SKILL.md deferred/ledger 清理)；P1 scope + Issue inventory 更新；#232 comment 5537274607 | [human] · Claude Opus 4.8 |
| v1.4 | 2026-09-04 | +Bug N (handoff-status Review Stopping 对齐)；P1 scope + Issue inventory 更新；#232 comment 5537602084 | [human] · Claude Opus 4.8 |
| v1.5 | 2026-09-04 | +Bug O (cdd-session-activate 删除 + gate env 传播)；P1 scope + Issue inventory 更新；#232 comment 5539077124 | [human] · Claude Opus 4.8 |
| v1.6 | 2026-09-04 | +Enhancement P (harness-registry prefix/suffix 通用注入)；P1 scope + Issue inventory 更新；#232 comment 5539300882 | [human] · Claude Opus 4.8 |
| v1.7 | 2026-09-05 | Bug M 完成范围扩展（引擎层 ledger 写入机制删除）；#232 comment 5549272087 | [human] · Claude Opus 4.8 |
| v1.8 | 2026-09-05 | +Enhancement Q (cdd-gate 整体删除)；新增 P4 phase；#232 comment 5549287756 | [human] · Claude Opus 4.8 |
| v1.9 | 2026-09-05 | P2 scope 扩展（Enh I 扩展为 scripts/ 全面重组 + 成熟第三方依赖替换自维护组件 + smoke Level 0 决策）；#232 comment 5535261581 | [human] · Claude Opus 4.8 |
| v1.10 | 2026-09-05 | +Enhancement R（writing-plans `user-ok?`「Fix selected」死选项移除，Review Stopping 一致性）；P3 scope + Issue inventory 更新；#232 comment 5549870456 | [human] · Claude Opus 4.8 |
| v1.11 | 2026-09-05 | +Enhancement S（cdd-engine review 模板 deferred 孤儿机制清理）+ Enhancement T（fix handoff schema 加可选 notes 字段）；P3 scope + Issue inventory 更新；#232 comments 5552903094 / 5552904440 | [human] · Claude Opus 4.8 |
| v1.12 | 2026-09-06 | +Enhancement U（CI 集成两处根因：本地 composite 首步需 checkout + npm global bin 跨 step 继承）；P2 实现期已修复（PR #237）；Issue inventory 更新；#232 comment 5553063867 | [human] · Claude Opus 4.8 |
| v1.13 | 2026-09-06 | +Enhancement V（report-issue filing 内嵌 GitHub tasklist）+ Enhancement W（finishing 收官勾选 done）；已 retrofit R/S/T/U 四条 comment tasklist；P3 scope + Issue inventory 更新；#232 comments 5553108929 / 5553110014 | [human] · Claude Opus 4.8 |
| v1.14 | 2026-09-06 | +P3 re-scope（brainstorming 决策）：Enh V/W → **superseded**（tasklist 不移入 skill；phase 追踪 canonical=overall 四表；历史 tasklist 留快照）；P3 scope/acceptance 更新（report-issue 双通道 + 派生 report-meta 隐私 + session master + finding-meta.json 单一事实源 + issue templates 生成 + 永不 reopen + Enh K/R/S/T）；Issue inventory V/W 行 superseded；overall-spec-template/add-phase-protocol 文档化 `#issuecomment-###` 锚点格式 | [human] · Claude Opus 4.8 |
| v1.15 | 2026-09-06 | +**Enhancement X（URC — Review 架构统一）**：spec-review D1 增序违例 + docs-task round 竞态（P3 实测）→ ReviewLoop 引擎原语（round 自增 + Review Stopping 引擎强制）+ **全部引擎 bin（cdd-task/docs-task/branch-review/cdd-select/cdd-research + brief/contract）合并为单一 `cdd`** **+ 模板数据化（`reviews.json` per-type lensEnum/axesGuide/fixTemplate；prompt 注入单机制留 `harness-registry.json`——operation×type、`/` 风格、全 harness 补齐）** + `_docs/review.md` 节点锚定 SSoT + D1/D2/D3/pass 词汇清零；P3 scope/acceptance + Issue inventory 更新；#232 comment 5559454120 | [human] · Claude Opus 4.8 |
