# 消费者面一致性（Consumer Parity）P1 实施计划 — 分歧面审计 + 判定登记 + shim 清理

**Spec:** [2026-09-21-consumer-parity-p1-design.md](docs/osuperpowers/specs/2026-09-21-consumer-parity-p1-design.md)

- **Parent program**: [2026-09-21-consumer-parity-overall.md v1.8](../specs/2026-09-21-consumer-parity-overall.md)
- **Depends on**: 无（program 起点）；P1 design v1.1 Approved（`ae8d14ba`）
- **Base**: develop（finishing read-base 数据源；consumer-parity-p1 工作分支）

## Constraints

### 口径

P1 是**审计 + 处置 phase**：实现面 = 13 件 frozen 文档 J1 主张改写（4 处）+ J2/J3 保留登记实证（26 命中行/8 文件）+ S5 单行修正（`scripts/run.ts:89`）；**零 engine 源码改动、零新 CLI 子命令、零守卫退役**（退役 = P3）。所有改动 `pnpm run validate` 相关块全绿 + block 12 自检 2/2 + `emit:check` 无 drift（13 件为 specs/plans 不触 emit；S5 为 scripts 文本描述不触 emit）。判定表/shim 清单已随 design 落盘（AC1），不进本 plan 实施面。

### commit 边界机制

dispatch 两端门——入口门（进入 review 前工作树干净：主 agent 产物已提交、dispatch 期零写树）+ 出口门（产生修改的 dispatch 后修改已提交）；主 agent 处理的由主 agent commit；本 plan 各 Task 的 review/fix 环均遵守。**已知缺口**（overall v1.4 P2 登记项）：docs-family fix 通道 commit 义务未 concretize——spec-fix r1 BLOCKED（未提交）/ r2 APPROVED（agent 提交）同契约异行为实证再现（2026-09-21 P1 design 两轮 review）；本 phase fix round 后编排者核验 handoff `commits` 字段，缺失则补提交（canary 实证登记）。

### Flow Atomicity

13 件 J1 改写为**单 task 整批**（Task 1，避免逐处零散提交）；J2/J3 保留面**只登记不改写**（历史叙述不伪造）；S5 独立 task（Task 2）；收口验证 + changeset 裁决独立 task（Task 3）。

### 顺序原则

Task 1（J1 改写 4 处 + grep 零主张实证）→ Task 2（S5 单行）→ Task 3（AC1–AC5 收口复核 + changeset 裁决登记）。Task 1 为本 phase 主体；Task 2/3 为闭环面（先改写主体再收口，避免验证空跑）。

---

### Task 1: 13 件 frozen 文档 J1 主张改写 + 保留面实证（design §2.3/§2.5）

- **Do**: 按 design §2.3 处置表与 §2.5 文字改动面执行 **J1 主张改写 4 处**：
  ① `docs/osuperpowers/specs/2026-09-13-osuperpowers-overhaul-overall.md:106`（Issue inventory P6 行「validate 脚本 maintainer-only 边界」：`overall-consistency` = charter 四表守卫（maintainer-mode dogfood）主张句）→ **改写为历史时态中性句**（当时由 `scripts/validate/` 承担 charter 守卫，已由 consumer-parity 程序归位 engine lifecycle）；表格行结构与 P6 Issue 其余事实保留；
  ② 同文件 `:321`（change-history v1.36 行 ③ 段同主张）→ **同主张中性化**——版本 token `v1.36` 与行结构保持（block 12 守卫：版本严格递增/无重复）；
  ③ `docs/osuperpowers/specs/2026-09-13-osuperpowers-overhaul-p6-design.md:263`（域 G G3 行）→ **改写为历史时态**（G3 当时裁决 = 当时状态；已被 consumer-parity 取代）；
  ④ `docs/osuperpowers/plans/2026-09-13-osuperpowers-overhaul-p6.md:134`（Task 16 ② G3 段）→ **任务叙述保留、守卫归属主张中性化**。
  J2/J3 保留面（22 行）**不改写**——以 design §2.3/§2.3.1 划类登记为实证（p2-plan 9 处 §2.3.1 明细 · overall:121/289/290 · p2-design:50/52/56/113/125 · p3-design:173/185 · p3-plan:773 · p4-plan:191 · p6-plan:166）。
- **验收**: ① 上述 4 处改写落地（`git diff` 仅触及主张句，版本/日期/行结构零破坏）；② `grep -rnE "overall-consistency|plan-spec-anchors" docs/osuperpowers/specs/2026-09-13-* docs/osuperpowers/plans/2026-09-13-*` 命中行每处归入 J1（已改写中性）/ J2（保留登记）/ J3（保留登记）——**零未划类命中、零 J1 现行主张残留**；③ block 12 自检 2/2 canonical overall 仍绿（overhaul overall 表结构完整）；④ J2/J3 保留行与 design §2.3 登记面一致（零漂移）。
- **注**: 本 Task 为 P1 主体；改写仅触及主张句，不改版本/日期/行结构（block 12 + plan-spec-anchors 守卫不破坏）；canary 实证：docs-family fix 通道 commit 义务缺口若再现 → 编排侧补提交 + 登记。

### Task 2: S5 单行修正（design §2.4）

- **Do**: `scripts/run.ts:89` `smoke-cdd` 子命令描述 `(4-command H1 chain)` → `(5-command H1 chain)`（smoke-cdd.ts 实际五命令：implement / review task / fix task / review branch / fix branch；run.ts 描述现为 stale 4-command）。
- **验收**: `scripts/run.ts:89` 描述与 smoke-cdd.ts 五命令一致；`pnpm run validate` scripts unit 面（`scripts/__tests__/run.test.ts` 等）全绿。
- **注**: 单行文本描述；无测试依赖该描述（design §2.4 已核）。

### Task 3: AC1–AC5 收口复核 + changeset 裁决登记

- **Do**: ① AC2 复核——grep 零 J1 现行主张 + block 12 2/2 绿；② AC4 复核——`run.ts:89` 已与五命令一致 + `pnpm run validate`（precommit 12 块子集）全绿；③ AC5 零实现改动断言——`git diff` 变更面 = 13 件 J1 改写 + J2/J3 登记 + `run.ts` 单行，**零 engine 源码 / 零新 CLI / 零守卫退役面**；④ **changeset 裁决**：P1 无发布于包内容变更（`packages/` 零改动；`scripts/` 与 docs 均非发布面——`contentRoot "."` 只发布 `packages/*/`）→ **不建空 changeset**，发布入口归 P4 ×9 旧 changesets 版本化整合（裁决登记，随 overall backfill 或 P4 面承载）。
- **验收**: `pnpm run validate` 全绿（12 块，CI 同口径）；AC1–AC5 逐条可复核；变更面零 package 内容（记录裁决）；block 12 2/2。
- **注**: 若收口复核暴露 J1 残留（grep 未清零）→ 回 Task 1 补改后再复核（不跨 phase）。