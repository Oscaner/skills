# Dogfood 修复程序 — Overall Spec

- **Version**: v1.4 · 2026-08-21
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
| P3 | [#152](https://github.com/Oscaner/skills/issues/152) | cdd-reference.zh-CN.md 翻译不完整 |
| P4 | 无 issue（依据 dogfood 会话 2026-08-21 决策） | overall-phase-spec-template.md + brainstorming Rule: Overall-Phase 更新，固化本次会话新增实践 |

**非目标**：
- 不引入新功能或扩展现有能力边界
- 不修改上游 vendors 子模块
- 不重构引擎整体架构

**跨相约束**：
- P1 技能规则变更不得破坏现有 engine 测试（`pnpm run validate` 全绿）
- P2 引擎变更必须覆盖新增行为的单元测试
- P3 翻译不得改动英文源文件（`cdd-reference.md`）
- 每相完成后独立 changeset

---

## Section 2：Phase 清单

| # | Phase | 范围 | Design spec | Implementation plan |
|---|-------|------|-------------|---------------------|
| P1 | Skills 规则修复 | writing-plans / brainstorming / executing-plans / code-review / cli-code-review SKILL.md + review-dispatch.md 规则文本变更（#156 / #162 / #163）；Review 停止机制（blocker 必修，warn/nit 问用户，决策后不再重跑 3 pass）；所有 review 类型 handoff.json 规则定义 | [Approved](2026-08-21-dogfood-fixes-p1-design.md) | [Pending] `plans/2026-08-21-dogfood-fixes-p1.md` |
| P2 | CDD 引擎修复 | runner.mjs brief 自动生成 + 结构校验；runReviewPackage OUTFILE 修复（#154 / #155）；cdd-review.mjs 新增 `--handoff PATH` 参数（使 spec/plan/branch review 统一输出 handoff.json） | [Pending] `specs/2026-08-21-dogfood-fixes-p2-design.md` | [Pending] `plans/2026-08-21-dogfood-fixes-p2.md` |
| P3 | 文档翻译补全 | cdd-reference.zh-CN.md H7 之后约 60 行补全翻译（#152） | [Pending] `specs/2026-08-21-dogfood-fixes-p3-design.md` | [Pending] `plans/2026-08-21-dogfood-fixes-p3.md` |
| P4 | 模板与流程更新 | `overall-phase-spec-template.md` + `brainstorming/SKILL.md` Rule: Overall-Phase 更新，固化本次会话新增实践（issue 清单表、路径命名约定、Phase acceptance criteria、软/硬依赖区分）；补充"每个 Phase 必须经完整 brainstorming 循环生成 Phase spec，Overall 批准后直接进入实施是违规" | [Pending] `specs/2026-08-21-dogfood-fixes-p4-design.md` | [Pending] `plans/2026-08-21-dogfood-fixes-p4.md` |
| P5 | executing-plans 统一 + branch-review CLI | 删除 `executing-plans/SKILL.md`（及 zh-CN 镜像），将编排职责统一至 `cli-driven-development/SKILL.md`；执行末尾改为 branch-review CLI 而非调用 `osuperpowers:code-review` skill | [Pending] `specs/2026-08-21-dogfood-fixes-p5-design.md` | [Pending] `plans/2026-08-21-dogfood-fixes-p5.md` |

**P1 → P2 软依赖**：P2 引擎新增 `cdd-review.mjs --handoff PATH`，为 P1 中"所有 review 输出 handoff.json"规则提供引擎侧实现；P1 规则可先落地，P2 提供执行保障。P1 可独立交付，P2 强化其可执行性。P2 可在 P1 评审期间并行推进，但最终实现应对齐 P1 已确定的规则。P3 与 P1/P2 完全独立。P4 修改 `brainstorming/SKILL.md`（Rule: Overall-Phase 节），与 P1 同文件，建议 P1 shipped 后再启动 P4 实现，避免并行编辑冲突。**P5 依赖 P1**：P5 删除 executing-plans/SKILL.md，P1 已建立的规则（HARD-GATE、Checklist）需先迁移至 cli-driven-development，建议 P1 shipped 后启动 P5。

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
> **P5 验收标准**：`executing-plans/SKILL.md`（及 zh-CN）已删除；`cli-driven-development/SKILL.md` 已整合原 executing-plans 编排规则（HARD-GATE / Checklist / Rules）；执行末尾改用 branch-review CLI（如 task-review 风格），不再调用 `osuperpowers:code-review` skill；`pnpm run validate` 全绿；详细条件见 P5 design spec。
>
> **P1 验收标准**：5 个 SKILL.md + review-dispatch.md 规则变更落地；Review 停止机制（blocker 必修、warn/nit 问用户、决策后不再重跑 3 pass）写入 review-dispatch.md；所有 review 类型 handoff.json 规则写入 review-dispatch.md 及各引用方；`pnpm run validate` 全绿；详细条件见 P1 design spec。
>
> **P2 验收标准**：runner.mjs brief 自动生成 + 结构校验逻辑有单元测试覆盖；runReviewPackage diff 输出到 `.superpowers/cdd/`（存量 `.superpowers/sdd/` 文件保留不处理，属 gitignore 临时文件，由用户手动清理）；cdd-review.mjs `--handoff PATH` 参数实现并有单元测试覆盖；`pnpm run validate` 全绿；详细条件见 P2 design spec。
>
> **P3 验收标准**：从 `## H7 — No consumer-repo CLI scripts` 节至文件末尾的所有英文段落翻译为中文，diff 中无英文正文残留、与英文源 `cdd-reference.md` 对照确认无漏译、`pnpm run validate` 全绿。P3 无代码变动，不需要单元测试覆盖。
>
> **P4 验收标准**：`packages/osuperpowers/docs/overall-phase-spec-template.md` 新增 issue 清单表、路径命名约定、Phase acceptance criteria、软/硬依赖区分四项实践；`packages/osuperpowers/skills/brainstorming/SKILL.md` 的 Rule: Overall-Phase 节新增指向该模板的引用行、内联四项检查点，并明确"每个 Phase 必须经完整 brainstorming 循环生成 Phase spec，Overall 批准后直接进入实施是违规"；`pnpm run validate` 全绿。

---

## Section 5：维护规则

- 每相完成后更新 Phase 清单对应行（Design spec / Implementation plan 列补链接，plan 列加完成标记）
- 跨相约束变更先更新 Overall spec，再同步到对应 Phase spec
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
