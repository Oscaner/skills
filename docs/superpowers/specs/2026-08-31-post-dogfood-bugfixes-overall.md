# Post-Dogfood Bugfixes + Anti-Pattern Elimination — Overall Spec

- **Version**: v1.4 · 2026-08-31
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

---

## Phase inventory

| # | Phase | Scope | Design spec | Plan | Status | Deliverables | Downstream |
|---|---|---|---|---|---|---|---|
| Pα | engine-fixes：#200 phantom SHA 校验 + #176 跨任务边界约束 + #175 task-review mode 守卫 + #191 deferred-sweep 清零 | Done | Done | [plan](../plans/2026-08-31-post-dogfood-bugfixes-p-alpha.md) | Pending | ① `gitCatFileCommitExists` 导出 + 单测；② runner.mjs 集成测试；③ implement.md/fix.md 边界约束；④ runner.mjs mode-phase 守卫 + 单测；⑤ task-review.md findings 写入指令；⑥ sweep 收口 findings 清空；⑦ validate 绿 | Pβ |
| Pβ | skill-fixes：#198/#184 task heading 强制 + #195/#196 docs-review 重写 + #194 report-issue dedup 扩展 | Pending | Pending | Pending | Pending | 见 phase spec | Pγ |
| Pγ | anti-patterns + brainstorming 重写：#206 spec-review 跳过修复 + #205 phase planning before overall + #204 grilling 执行检查点 + skill-authoring Anti-patterns §10 + brainstorming 反模式消除 | Pending | Pending | Pending | Pending | 见 phase spec | 无 |

---

## Dependency graph (ASCII)

```
Pα (engine-fixes) ──→ Pβ (skill-fixes) ──→ Pγ (anti-patterns + brainstorming)
```

**说明**：Pα→Pβ→Pγ 串行依赖。Pγ 的 brainstorming 重写范围最广（含 #205 流程修复），在前序 phase 验证通过后执行，确保重写基于已修复的 engine/skills 基础。

---

## Change history

| Version | Date | Summary | Author |
|---|---|---|---|
| v1.0 | 2026-08-31 | Initial charter — 10 issues + skill-authoring | [human] · Claude Opus 4.8 |
| v1.1 | 2026-08-31 | Added #205 brainstorming flow violation;串行 dependency 修正 | [human] · Claude Opus 4.8 |
| v1.2 | 2026-08-31 | Pα design spec written (Done)；Phase inventory acceptance criteria 具体化 | [human] · Claude Opus 4.8 |
| v1.3 | 2026-08-31 | Added #206 spec-review 3-pass 跳过 issue；Pγ scope 更新 | [human] · Claude Opus 4.8 |
| v1.4 | 2026-08-31 | 3-pass spec review fixes：Phase inventory 拆列（Design spec/Plan/Status/Deliverables/Downstream）；#184 标记 duplicate；Pα Design spec = Done | [human] · Claude Opus 4.8 |
