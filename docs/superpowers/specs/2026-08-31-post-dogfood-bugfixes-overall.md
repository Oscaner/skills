# Post-Dogfood Bugfixes + Anti-Pattern Elimination — Overall Spec

- **Version**: v1.12 · 2026-08-31
- **Status**: Approved
- **Author**: [human] · Claude Opus 4.8 (osuperpowers:brainstorming dogfood session)
- **Constraints**:
  - 仓库语言政策：SKILL.md / docs 英文主源 + zh-CN 镜像；本 spec 中文（Strategy B）
  - 不 commit 除非用户明确要求；changeset 逐 phase 建
  - vendored 子模块不可改
  - Skill-authoring Anti-patterns 规范同步更新（§2.9）

---

## Document scope

Charter only — no implementation detail。

- **Overall approval is not equivalent to any phase started**（GATE）。
- Deviations update here first, then sync to overall。

---

## Issue inventory

| Phase | Issue | Title summary |
|---|---|---|
| Pα | [#200](https://github.com/Oscaner/skills/issues/200) | runner.mjs 不校验 commits.head 可达性——phantom SHA 导致 review-package 失败 |
| Pα | [#176](https://github.com/Oscaner/skills/issues/176) | implement.md 缺跨任务边界提交约束——agent 越界提交导致 F1 拦截 |
| Pα | [#175](https://github.com/Oscaner/skills/issues/175) | task-review 被 implement 语义 commit-contract 误拦——findings 丢失 |
| Pα | [#191](https://github.com/Oscaner/skills/issues/191) | CDD deferred-sweep 通道语义歧义——纯 nit 行为不确定 + status 瞬态混乱 |
| Pβ | [#198](https://github.com/Oscaner/skills/issues/198) | writing-plans plan headings H2 vs brief.mjs H3 mismatch |
| Pβ | [#184](https://github.com/Oscaner/skills/issues/184) | writing-plans plan Task 头部级别未对齐 brief.mjs（duplicate of #198） |
| Pβ | [#195](https://github.com/Oscaner/skills/issues/195) | review re-review 规则统一——仅 blocker 触发重跑 |
| Pβ | [#196](https://github.com/Oscaner/skills/issues/196) | plan review Pass 3 blocker 修复后未 re-run——#195 的具体实例 |
| Pβ | [#194](https://github.com/Oscaner/skills/issues/194) | report-issue dedup 缺 closed issue 检测——回归 issue 需 reopen+comment |
| Pγ | [#206](https://github.com/Oscaner/skills/issues/206) | brainstorming spec-review 3-pass 审查完全跳过——write-spec 后直接 commit |
| Pγ | [#204](https://github.com/Oscaner/skills/issues/204) | grilling 纪律违反——brainstorming orchestrator 未遵守 baseline |
| Pγ | [#205](https://github.com/Oscaner/skills/issues/205) | brainstorming overall spec 产出前进行了 phase-level 详细设计（阶段划分跳过） |
| Pγ | (skill-authoring) | skill-authoring.md 缺 Anti-patterns 规范 |
| Pγ | (brainstorming) | brainstorming SKILL.md 反模式消除（Rule Duplication / Bare Compliance / Insufficient Granularity） |
| Pδ | [#207](https://github.com/Oscaner/skills/issues/207) | CDD 执行流程完全未遵守：跳过 select-harness/determine-base/dispatch-mode，直接手写代码 |
| Pδ | [#210](https://github.com/Oscaner/skills/issues/210) | deferred-sweep 被 commit-contract F1 误拦：sweep 运行时 HEAD 已前进导致 handoff commits.head mismatch |
| Pδ | [#211](https://github.com/Oscaner/skills/issues/211) | cli-driven-development 重构：engine 契约修复 + agent 文件定向加固 + degradation 标准化（三模式链不简化，所有任务强制执行） |
| Pε | [#208](https://github.com/Oscaner/skills/issues/208) | report-issue skill + issue templates 缺消费者隐私数据脱敏指引 |
| Pε | [#209](https://github.com/Oscaner/skills/issues/209) | 删除 osuperpowers-router 插件（不再需要 trigger router） |
| Pε | [#71](https://github.com/Oscaner/skills/issues/71) | writing-plans Section-by-Section I2 规则与 Edit 锚点重复冲突——移除 I2，尊重上游编写规范 |
| Pε | (zh-CN cleanup) | 删除 packages/osuperpowers/skills 下所有 .zh-CN.md 镜像文件 |
| Pε | [#216](https://github.com/Oscaner/skills/issues/216) | writing-plans write-plan Do 字段缺显式 `### Task N:` 冒号格式要求——agent 产出 em dash 导致 brief.mjs 提取失败 |
| Pε | [#217](https://github.com/Oscaner/skills/issues/217) | Pε CDD Task 1/2 原子性违反——agent 删除 overrides.mjs 后运行 emit，import 未清理导致 ERR_MODULE_NOT_FOUND |
| Pε | [#218](https://github.com/Oscaner/skills/issues/218) | runner.mjs: BLOCKED handoff 写入时缺 `phase` 字段——下次 dispatch 时 schema validation 循环无法退出 |
| Pζ | [#219](https://github.com/Oscaner/skills/issues/219) | CDD handoff schema 缺乏 unit test 覆盖——runner 写入路径、agent 模板、workspace slug 一致性均无测试，仅靠 dogfood 发现 |
| Pζ | [#220](https://github.com/Oscaner/skills/issues/220) | cdd-task.mjs task-review mode：agent 退出 0 但不写 handoff——H1 output missing，runner 保留旧 implement handoff |
| Pζ | [#221](https://github.com/Oscaner/skills/issues/221) | CDD handoff templates 旁路 schema SOT——required fields 在 prose 中手动维护而非从 handoff-schema.json 派生 |

---

## Phase inventory

| # | Phase | Scope | Design spec | Plan | Status | Deliverables | Downstream |
|---|---|---|---|---|---|---|---|
| Pα | engine-fixes：#200 phantom SHA 校验 + #176 跨任务边界约束 + #175 task-review mode 守卫 + #191 deferred-sweep 清零 | Done | Done | [plan](../plans/2026-08-31-post-dogfood-bugfixes-p-alpha.md) | Done | ① `gitCatFileCommitExists` 导出 + 单测；② runner.mjs 集成测试；③ implement.md/fix.md 边界约束；④ runner.mjs mode-phase 守卫 + 单测；⑤ task-review.md findings 写入指令；⑥ sweep 收口 findings 清空；⑦ validate 绿 | Pβ |
| Pβ | skill-fixes：#198/#184 task heading 强制 + #195/#196 docs-review 重写 + #194 report-issue dedup 扩展 | Done | [design](./2026-08-31-post-dogfood-bugfixes-p-beta-design.md) | [plan](../plans/2026-08-31-post-dogfood-bugfixes-p-beta.md) | Pending | 见 phase spec | Pγ |
| Pγ | anti-patterns + brainstorming 重写：#206 spec-review 跳过修复 + #205 phase planning before overall + #204 grilling 执行检查点 + skill-authoring Anti-patterns §10 + brainstorming 反模式消除 | Done | [design](./2026-08-31-post-dogfood-bugfixes-p-gamma-design.md) | [plan](../plans/2026-08-31-post-dogfood-bugfixes-p-gamma.md) | Done | 见 phase spec | Pδ |
| Pδ | CDD 重构：#207 CDD 执行流程绕过修复 + #210 commit-contract scope-aware（F1/D2 适配 deferred-sweep）+ #211 engine 契约修复 + agent 文件定向加固 + degradation 标准化（三模式链不简化） | [design](./2026-09-01-post-dogfood-bugfixes-p-delta-design.md) | [plan](../plans/2026-09-01-post-dogfood-bugfixes-p-delta.md) | Done | Pending | 见 phase spec | Pε |
| Pε | cleanup + simplification：#208 report-issue 隐私脱敏 + #209 删除 osuperpowers-router + #71 writing-plans I2 移除 + zh-CN 镜像清理 + issue 编号清理 + review 3-pass 强制 + #216 heading 格式防回归 + #217 Task1/2 原子性约束 + #218 runner BLOCKED handoff phase 修复 | [design](./2026-09-02-post-dogfood-bugfixes-p-epsilon-design.md) | [plan](../plans/2026-09-02-post-dogfood-bugfixes-p-epsilon.md) | Pending | 见 phase spec | Pζ |
| Pζ | CDD handoff schema + templates 全流程重构：#219 unit test 全覆盖 + #220 task-review handoff 写入修复 + #221 schema SOT 统一（stub injection 或 schema reference，消除 templates prose 重复）+ implement/task-review/fix templates 重构 + runner 写入路径审计 + workspace slug 一致性；允许全面重构，不留技术债务 | Pending | Pending | Pending | 见 phase spec | — |

---

## Dependency graph (ASCII)

```
Pα (engine-fixes) ──→ Pβ (skill-fixes) ──→ Pγ (anti-patterns + brainstorming) ──→ Pδ (CDD refactoring) ──→ Pε (cleanup + simplification) ──→ Pζ (handoff schema 深度修复)
```

**说明**：Pα→Pβ→Pγ→Pδ→Pε→Pζ 串行依赖。Pζ 为深度修复 phase：全面重构 CDD handoff schema 验证体系 + templates 重构，修复 #219 unit test 缺口 + #220 task-review handoff 写入，允许重构，不留技术债务。

---

## Change history

| Version | Date | Summary | Author |
|---|---|---|---|
| v1.0 | 2026-08-31 | Initial charter — 10 issues + skill-authoring | [human] · Claude Opus 4.8 |
| v1.1 | 2026-08-31 | Added #205 brainstorming flow violation;串行 dependency 修正 | [human] · Claude Opus 4.8 |
| v1.2 | 2026-08-31 | Pα design spec written (Done)；Phase inventory acceptance criteria 具体化 | [human] · Claude Opus 4.8 |
| v1.3 | 2026-08-31 | Added #206 spec-review 3-pass 跳过 issue；Pγ scope 更新 | [human] · Claude Opus 4.8 |
| v1.4 | 2026-08-31 | 3-pass spec review fixes：Phase inventory 拆列（Design spec/Plan/Status/Deliverables/Downstream）；#184 标记 duplicate；Pα Design spec = Done | [human] · Claude Opus 4.8 |
| v1.5 | 2026-08-31 | Added #207 CDD 执行流程绕过 issue；Pγ scope 更新 | [human] · Claude Opus 4.8 |
| v1.6 | 2026-08-31 | Added #210 deferred-sweep F1 + #211 CDD refactoring；新增 Pδ phase；dependency graph 更新为 4-phase 串行 | [human] · Claude Opus 4.8 |
| v1.7 | 2026-08-31 | Removed CDD 简化路径 from Pδ scope（三模式链不简化，所有任务强制执行） | [human] · Claude Opus 4.8 |
| v1.8 | 2026-08-31 | Pβ Design spec = Done（brainstorming complete）；#198 H3 + #195 Review Stopping + #194 dedup + _docs/ directory restructure | [human] · Claude Opus 4.8 |
| v1.9 | 2026-08-31 | Pβ Plan = Done（writing-plans complete）；6-task implementation plan committed | [human] · Claude Opus 4.8 |
| v1.10 | 2026-08-31 | Scope reorganization：#207 CDD 执行流程绕过 从 Pγ 移入 Pδ（与 CDD 重构同 phase 解决） | [human] · Claude Opus 4.8 |
| v1.11 | 2026-08-31 | Pγ Design spec = Done（brainstorming complete）；mode-aware branching + skill-authoring §10 Anti-patterns | [human] · Claude Opus 4.8 |
| v1.12 | 2026-08-31 | Pγ Plan = Done（writing-plans complete）；7-task implementation plan committed | [human] · Claude Opus 4.8 |
| v1.13 | 2026-09-01 | Pδ Design spec = Done（brainstorming complete）；三层架构重划分 + handoff schema 重构 + 模板目录重组 + progress 结构化 | [human] · Claude Opus 4.8 |
| v1.14 | 2026-09-02 | 新增 Pε（cleanup + simplification）：#208 report-issue 隐私脱敏 + #209 router 删除 + #71 I2 移除 + zh-CN 清理；串行依赖 Pδ→Pε | [human] · Claude Opus 4.8 |
| v1.15 | 2026-09-02 | Pε Design spec = Done（brainstorming complete）；11-task plan：router 删除 + emit/version 清理 + osuperpowers 内部引用 + report-issue 重构 + issue 编号清理 + zh-CN 删除 + CLAUDE.md + writing-plans I2 + review 3-pass 强制 | [human] · Claude Opus 4.8 |
| v1.16 | 2026-09-02 | Pε Plan = Done（writing-plans complete）；11-task implementation plan committed | [human] · Claude Opus 4.8 |
| v1.17 | 2026-09-02 | Pε +#216 writing-plans heading format bug；plan hotfix（em dash → colon）+ Task 12 added | [human] · Claude Opus 4.8 |
| v1.18 | 2026-09-02 | Pε +#217 Task 1/2 原子性违反——overrides.mjs 删除后 emit import 未清理；spec + plan 加 Task 1/2 原子性约束 | [human] · Claude Opus 4.8 |
| v1.19 | 2026-09-02 | Pε +#218 runner.mjs BLOCKED handoff 缺 phase 字段——schema validation 循环；spec + plan 加 Task 13 修复 | [human] · Claude Opus 4.8 |
| v1.20 | 2026-09-02 | 新增 Pζ（handoff schema 深度修复）：#219 全面重构验证体系；Pε Downstream → Pζ；依赖链更新 | [human] · Claude Opus 4.8 |
| v1.21 | 2026-09-02 | Pζ scope 扩展：+#220 task-review handoff 写入修复 + templates 全流程重构；Pζ Phase inventory 更新 | [human] · Claude Opus 4.8 |
| v1.22 | 2026-09-02 | Pζ +#221 schema SOT bypass——templates prose 重复 required fields；Pζ scope 更新为 schema stub injection 方案 | [human] · Claude Opus 4.8 |
