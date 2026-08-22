# Dogfood 修复程序 — Overall Spec

- **Version**: v1.9 · 2026-08-22
- **Status**: Approved
- **Author**: Oscaner Miao · Claude Opus 4.8 (1M context)
- **Constraints**:
  - 不修改上游 vendors 子模块
  - 不引入新功能或扩展现有能力边界
  - 不重构引擎整体架构
  - 每相完成后独立 changeset
  - **语言架构 Strategy A**：`skills/*/SKILL.md` 和 `docs/*.md` 须为纯英文，zh-CN 镜像必须在同一 task 内同步更新；不得在英文文件内掺入中文内容
  - **语言架构 Strategy B**：`docs/superpowers/specs/` 和 `docs/superpowers/plans/` 为中文，无需镜像

---

## Section 0：文档范围

本文件为程序宪章，不含实施细节。

- Overall 批准 ≠ 任何 Phase 已开始（GATE）
- 跨相规范以本文件为准；Phase spec 与本文件冲突时，本文件优先
- 策略变更先更新本文件，再同步到对应 Phase spec

---

## Section 1：程序宪章

**目标**：修复 6 项 dogfood 违规，覆盖三个子系统——技能规则文本（SKILL.md）、CDD 引擎（runner.mjs）、文档翻译（zh-CN）；并将本次会话新增实践固化至模板与流程文档（P4）。每项修复的可验证完成条件定义在对应 Phase 的 design spec 中。

**Issue 清单**：

| Phase | Issue | 标题摘要 |
|-------|-------|----------|
| P1 | [#156](https://github.com/Oscaner/skills/issues/156) | writing-plans Section-by-Section 被误解为逐节确认 |
| P1 | [#162](https://github.com/Oscaner/skills/issues/162) | brainstorming 多次触发后跳过完整流程 |
| P1 | [#163](https://github.com/Oscaner/skills/issues/163) | writing-plans + executing-plans CLI 模式多项流程违规 |
| P2 | [#154](https://github.com/Oscaner/skills/issues/154) | task brief 应由脚本机械切分，消除 AI token 消耗 |
| P2 | [#155](https://github.com/Oscaner/skills/issues/155) | review-package diff 输出到 `.superpowers/sdd/` 路径混用 |
| P2 | 无 issue（dogfood 会话 2026-08-21 P2 brainstorming 发现） | grilling 技能读取后未被正确应用，AI 用自身提问框架替代了技能指令 |
| P2 | 无 issue（dogfood 会话 2026-08-21 P2 review 发现） | Review Stopping 重跑询问应用 AskUserQuestion + 提示 Next step，不应为纯文本问句 |
| P3 | [#152](https://github.com/Oscaner/skills/issues/152) | cdd-reference.zh-CN.md 翻译不完整 |
| P3 | 无 issue（dogfood 会话 2026-08-22 P3 brainstorming 发现） | Rule: Read Upstream 措辞未排除"harness 注入的 vendored 仓库文档（CLAUDE.md / README）"被误当流程基线的失败模式，须在正典定义处澄清并加反模式 |
| P3 | 无 issue（dogfood 会话 2026-08-22 P3 brainstorming 发现） | `packages/*/CLAUDE.md` 随插件发布（contentRoot="."），内容却全为 monorepo 维护指南，对消费者环境是噪音；须拆分重组（维护者内容移出 packages/，落 docs/maintainers/） |
| P4 | 无 issue（依据 dogfood 会话 2026-08-21 决策） | overall-phase-spec-template.md + brainstorming Rule: Overall-Phase 更新，固化本次会话新增实践 |
| P4 | 无 issue（dogfood 会话 2026-08-22 P2 执行发现） | phase 进行中发生需求变更时须回馈 Overall Spec（P2 执行中新增 3 项：grilling 委托 v1.5 / Review Stopping v1.6 / Rule: Scope v1.7） |
| P5 | 无 issue（dogfood 会话 2026-08-22 whole-branch review 发现） | cli-code-review Rule: Scope 基线为 `origin/main`，本仓库集成分支为 `develop`，应改为 `origin/develop` |

**非目标**：
- 不引入新功能或扩展现有能力边界
- 不修改上游 vendors 子模块
- 不重构引擎整体架构

**跨相约束**：
- P1 技能规则变更不得破坏现有 engine 测试（`pnpm run validate` 全绿）
- P2 引擎变更必须覆盖新增行为的单元测试
- P3 翻译不得改动英文源文件（`cdd-reference.md`）；文档拆分不得改动任何 SKILL.md 运行时行为语义
- 每相完成后独立 changeset

---

## Section 2：Phase 清单

| # | Phase | 范围 | Design spec | Implementation plan |
|---|-------|------|-------------|---------------------|
| P1 | Skills 规则修复 | writing-plans / brainstorming / executing-plans / code-review / cli-code-review SKILL.md + review-dispatch.md 规则文本变更（#156 / #162 / #163）；Review 停止机制（blocker 必修，warn/nit 问用户，决策后不再重跑 3 pass）；所有 review 类型 handoff.json 规则定义 | [Approved](2026-08-21-dogfood-fixes-p1-design.md) | [Pending] `plans/2026-08-21-dogfood-fixes-p1.md` |
| P2 | CDD 引擎修复 + brainstorming grilling 加强 + docs-review Review Stopping 问询改进 | runner.mjs brief 自动生成 + 结构校验；runReviewPackage OUTFILE 修复（#154 / #155）；cdd-review.mjs 新增 `--handoff PATH` 参数（使 spec/plan/branch review 统一输出 handoff.json）；brainstorming/SKILL.md Rule: Read Sub-Skills 加强 grilling 委托指令（grilling 发现）；docs-review.md Rule: Review Stopping 重跑询问改为 AskUserQuestion + Next step 提示（review 发现） | [Approved](2026-08-21-dogfood-fixes-p2-design.md) | [Approved](../plans/2026-08-21-dogfood-fixes-p2.md) |
| P3 | 文档与规则文本修正 | cdd-reference.zh-CN.md 全文翻译补全 + Mode B 漂移节清除（#152，边界从 H7→EOF 扩为全文）；Rule: Read Upstream 措辞澄清（brainstorming 正典追加 + 5 个引用方短句 + executing-plans 短句与反模式；7 个 zh-CN 镜像同步）；CLAUDE.md 拆分重组（packages/*/CLAUDE.md 删除，维护者内容迁 docs/maintainers/，根 CLAUDE.md 指针更新 + 使用者视角维护规则） | [Approved](2026-08-22-dogfood-fixes-p3-design.md) | [Approved](../plans/2026-08-22-dogfood-fixes-p3.md) |
| P4 | 模板与流程更新 | `overall-phase-spec-template.md` + `brainstorming/SKILL.md` Rule: Overall-Phase 更新，固化本次会话新增实践（issue 清单表、路径命名约定、Phase acceptance criteria、软/硬依赖区分、**phase 中需求变更须回馈 Overall**）；补充"每个 Phase 必须经完整 brainstorming 循环生成 Phase spec，Overall 批准后直接进入实施是违规" | [Pending] `specs/2026-08-21-dogfood-fixes-p4-design.md` | [Pending] `plans/2026-08-21-dogfood-fixes-p4.md` |
| P5 | executing-plans 统一 + branch-review CLI | 删除 `executing-plans/SKILL.md`（及 zh-CN 镜像），将编排职责统一至 `cli-driven-development/SKILL.md`；执行末尾改为 branch-review CLI 而非调用 `osuperpowers:code-review` skill；cli-code-review Rule: Scope 基线改为 `origin/develop`（dogfood 发现） | [Pending] `specs/2026-08-21-dogfood-fixes-p5-design.md` | [Pending] `plans/2026-08-21-dogfood-fixes-p5.md` |

**P1 → P2 软依赖**：P2 引擎新增 `cdd-review.mjs --handoff PATH`，为 P1 中"所有 review 输出 handoff.json"规则提供引擎侧实现；P1 规则可先落地，P2 提供执行保障。P1 可独立交付，P2 强化其可执行性。P2 可在 P1 评审期间并行推进，但最终实现应对齐 P1 已确定的规则。P3 与 P1/P2 完全独立（共享文件见下）。P3 改 `brainstorming/SKILL.md` Rule: Read Upstream 节（P4 改同文件 Rule: Overall-Phase 节，两节不重叠）、给 `executing-plans/SKILL.md` 追加基线短句（临时性加固，P5 删除该文件时一并迁移）——顺序约束：**P3 先于 P4/P5 落地**。P4 修改 `brainstorming/SKILL.md`（Rule: Overall-Phase 节），与 P1 同文件，建议 P1 shipped 后再启动 P4 实现，避免并行编辑冲突。**P5 依赖 P1**：P5 删除 executing-plans/SKILL.md，P1 已建立的规则（HARD-GATE、Checklist）需先迁移至 cli-driven-development，建议 P1 shipped 后启动 P5。

---

## Section 3：依赖图

```
推荐执行顺序（箭头 = "建议先于"，非硬性阻塞）：

P1 (Skills 规则修复) ──建议先于──▶ P2 (CDD 引擎修复，最终实现对齐 P1 规则)

P1 (Skills 规则修复) ──建议先于──▶ P5 (executing-plans 统一，迁移 P1 规则后删除)

P3 (文档翻译补全)  ── 完全独立，可任意顺序交付

P4 (模板与流程更新) ── P1 shipped 后启动（避免与 P1 并行修改 brainstorming/SKILL.md），程序末尾执行

P5 (executing-plans 统一 + branch-review CLI) ── P1 shipped 后启动
```

P1 和 P3 可并行启动；P2 可在 P1 评审期间并行推进，但最终实现需对齐 P1 已确定规则；P4、P5 在 P1 shipped 后启动。

---

## Section 4：边界规则

> 每个 Phase 走完整循环：brainstorming → plan → executing-plans。Overall 批准 ≠ 任何 Phase 已开始。每个 Phase 的 design spec 需独立批准后方可进入 writing-plans。
>
> **顺序建议（软依赖）**：P2 可在 P1 评审期间并行推进，但最终实现应对齐 P1 已确定的规则。P3 与 P1/P2 完全独立，可与 P1 并行或在任意时间启动。P4、P5 建议在 P1 shipped 后再启动（P4 与 P1 共享 brainstorming/SKILL.md；P5 需先有 P1 规则作为迁移源），程序末尾执行。
>
> **P5 验收标准**：`executing-plans/SKILL.md`（及 zh-CN）已删除；`cli-driven-development/SKILL.md` 已整合原 executing-plans 编排规则（HARD-GATE / Checklist / Rules）；执行末尾改用 branch-review CLI（如 task-review 风格），不再调用 `osuperpowers:code-review` skill；cli-code-review Rule: Scope 基线改为 `origin/develop`；`pnpm run validate` 全绿；详细条件见 P5 design spec。
>
> **P1 验收标准**：5 个 SKILL.md + review-dispatch.md 规则变更落地；Review 停止机制（blocker 必修、warn/nit 问用户、决策后不再重跑 3 pass）写入 review-dispatch.md；所有 review 类型 handoff.json 规则写入 review-dispatch.md 及各引用方；`pnpm run validate` 全绿；详细条件见 P1 design spec。
>
> **P2 验收标准**：runner.mjs brief 自动生成 + 结构校验逻辑有单元测试覆盖；runReviewPackage diff 输出到 `.superpowers/cdd/`（存量 `.superpowers/sdd/` 文件保留不处理，属 gitignore 临时文件，由用户手动清理）；cdd-review.mjs `--handoff PATH` 参数实现并有单元测试覆盖；brainstorming/SKILL.md Rule: Read Sub-Skills 含 grilling 委托指令加强（读取后须完整执行 grilling 技能指令，不得替换为自身框架）并补 Red Flag，zh-CN 镜像同步更新；docs-review.md Rule: Review Stopping 重跑询问改为 AskUserQuestion 格式并含 Next step 提示；`pnpm run validate` 全绿；详细条件见 P2 design spec。
>
> **P3 验收标准**：① 翻译——`cdd-reference.zh-CN.md` 每个 `##` 节与英文源一一对应，无整段英文正文残留（代码块/路径/专有名词除外），漂移残留 `Mode B` 节不存在，英文源零改动；② Read Upstream——7 个 SKILL.md 分层修改落地（brainstorming 正典追加+Red Flag；code-review/finishing/debugging/verification/writing-plans 各加短句；executing-plans 短句+Red Flag），7 个 zh-CN 镜像同 task 同步，全文无"注入文档=基线"表述残留；③ CLAUDE.md 拆分（结构基准）——`packages/osuperpowers/` 与 `packages/osuperpowers-router/` 目录树内无任何 `CLAUDE.md`/`AGENTS.md`，维护者内容位于 `docs/maintainers/` 且开头有读者定位段，根 CLAUDE.md 指针无失效链接；（语义基准，仅约束 P3 变更引入/改动的措辞，存量豁免）——消费者可见产物（两包 README、随包 docs/*.md、根 CLAUDE.md 新增行）措辞不假设 `vendors/` 存在、不假设 monorepo 布局；④ `pnpm run emit` + `emit:check` 无 drift，`pnpm run validate` 全绿，独立 changeset。详细条件见 P3 design spec。
>
> **P4 验收标准**：`packages/osuperpowers/docs/overall-phase-spec-template.md` 新增 issue 清单表、路径命名约定、Phase acceptance criteria、软/硬依赖区分、**phase 中需求变更回馈 Overall** 五项实践；`packages/osuperpowers/skills/brainstorming/SKILL.md` 的 Rule: Overall-Phase 节新增指向该模板的引用行、内联五项检查点，并明确"每个 Phase 必须经完整 brainstorming 循环生成 Phase spec，Overall 批准后直接进入实施是违规"；`pnpm run validate` 全绿。

---

## Section 5：维护规则

- 每相完成后更新 Phase 清单对应行（Design spec / Implementation plan 列补链接，plan 列加完成标记）
- 跨相约束变更先更新 Overall spec，再同步到对应 Phase spec
- **使用者视角**：规则文本与随插件发布的文档变更须从发布后使用者角度审视——消费者环境无 `vendors/`、无 monorepo 布局、无本仓库开发工具链
- 子模块变更（vendors/）不属于本程序范围，不在此维护
- Overall spec Status 字段：用户明确批准后从 Draft 改为 Approved，批准事件记录至 Section 6

---

## Section 6：变更历史

| 日期 | 事件 |
|------|------|
| 2026-08-21 | Overall spec 初稿创建，Status: Draft |
| 2026-08-21 | v1.1：新增 P4（模板与流程更新），更新 Phase 清单、依赖图、边界规则 |
| 2026-08-21 | v1.2：P1/P2 scope 扩展（Review 停止机制、所有 review 输出 handoff.json、code-review/cli-code-review 引用 review-dispatch.md、cdd-review.mjs --handoff） |
| 2026-08-21 | P1 design spec 用户批准，Phase 清单 Design spec 列更新为 Approved |
| 2026-08-21 | v1.3：新增语言架构约束（Strategy A/B） |
| 2026-08-21 | v1.4：新增 P5（executing-plans 统一 + branch-review CLI），更新 Phase 清单、依赖图、边界规则 |
| 2026-08-21 | v1.5：P2 新增 grilling 委托违规 issue（brainstorming Rule: Read Sub-Skills 加强），更新 Issue 清单、Phase 清单、P2 验收标准 |
| 2026-08-21 | v1.6：P2 新增 Review Stopping AskUserQuestion issue（docs-review.md Rule: Review Stopping 改进），更新 Issue 清单、Phase 清单、P2 验收标准 |
| 2026-08-21 | P2 design spec 用户批准，Phase 清单 Design spec 列更新为 Approved |
| 2026-08-22 | v1.7：P5 新增 cli-code-review Rule: Scope `origin/main` → `origin/develop` issue（dogfood 发现），更新 Issue 清单、Phase 清单、P5 验收标准 |
| 2026-08-22 | v1.8：P4 新增 phase 中需求变更回馈 Overall 实践（dogfood 发现），更新 Issue 清单、Phase 清单、P4 验收标准 |
| 2026-08-22 | v1.9：P3 范围扩展为「文档与规则文本修正」（翻译扩全文 + Read Upstream 措辞澄清 + CLAUDE.md 拆分重组，dogfood 会话 2026-08-22 P3 brainstorming 发现），新增使用者视角维护规则；更新 Issue 清单、Phase 清单、跨相约束、依赖说明、P3 验收标准 |
| 2026-08-23 | P3 实施完成（cdd-reference zh-CN 全文补全 / Read Upstream 基线澄清 / CLAUDE.md 拆分重组），Phase 清单 P3 行 Design spec 与 Implementation plan 列更新为 Approved |
