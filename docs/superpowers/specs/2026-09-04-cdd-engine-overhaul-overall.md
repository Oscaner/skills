# CDD Engine 重构 + 生态完善 — Overall Spec

- **Version**: v1.6 · 2026-09-04
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
| P2 | [#232](https://github.com/Oscaner/skills/issues/232#issuecomment-5535261581) | Enhancement I — GitHub Workflows 重构 + scripts 重构 + Issue Templates 统一 |
| P3 | [#232](https://github.com/Oscaner/skills/issues/232#issuecomment-5535307962) | Enhancement J — report-issue skill 重构（session 聚合 + 无 reopen + overall 模板 comment ref） |
| P3 | [#232](https://github.com/Oscaner/skills/issues/232#issuecomment-5536710343) | Enhancement K — brainstorming explore-context 主动读取 GitHub issue comments（`gh issue view NNN --json body,comments`，fail-open） |
| P1 | [#232](https://github.com/Oscaner/skills/issues/232#issuecomment-5537274607) | Bug M — cli-driven-development SKILL.md 包含已删除的 deferred 节点和 ledger 概念（与 6b8b192 引擎变更不同步） |
| P1 | [#232](https://github.com/Oscaner/skills/issues/232#issuecomment-5537602084) | Bug N — cli-driven-development SKILL.md handoff-status 未区分 blocker=0 路径，未对齐 Review Stopping 语义 |
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
| P2 | 基础设施整治：Enh H composite actions + cdd-engine smoke test + Enh I GitHub Workflows 重命名/重构 + scripts/validate/ 模块化（ci-validate.mjs 内部拆分）+ Issue Templates 更新（component / session-type 下拉 + osuperpowers label + session-report template） | Pending | Pending | composite actions 提取（setup / validate / install-harness / link-cdd-engine）；workflow 命名规范统一（pr-validate / release / submodule-* / sync-*）；`scripts/validate/*.mjs` 各模块独立可运行，ci-validate.mjs 仅组合调用；Issue Templates 含 component + session-type 下拉；CI cdd-engine smoke test 通过 | P1（hard：CI smoke test 需 cdd-engine 已发布） |
| P3 | Skills + 模板重构：Enh J report-issue session master issue + findings 以 comment 追加 + 永不 reopen + overall spec 模板 Issue inventory 附 comment URL（`#issuecomment-NNN` 锚点格式）；Enh K brainstorming explore-context 主动读取关联 issue comments（`gh issue view NNN --json body,comments`，fail-open） | Pending | Pending | 同 session findings 全部 comment 追加到 session master issue，不新建独立 issue；closed issue 命中时创建新 comment + reference，永不 reopen；overall spec 模板 Issue ref 列支持 comment URL 锚点；本 overall 自身 Issue inventory 已按新格式填写；brainstorming 在 phase-within-program 模式下主动读取 overall Issue inventory 中所有 `#NNN` 的 comments | P1（hard）；P2（soft：串行管理约定，P3 与 P2 无技术强依赖） |

---

## Dependency graph (ASCII)

```
P1 (CDD Engine 全面重构) ──→ P2 (基础设施整治) ──→ P3 (Skills + 模板重构)
                         └──────────────────────→ (soft)
```

**说明**：P1→P2 hard；P1→P3 hard（engine 稳定后 report-issue 才能锁定语义）；P2→P3 soft（串行管理约定，无技术强依赖，可与 P2 并行执行）。

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
