# Tickets: SDD review severity→status 映射 + deferred minors 治理

修复 SDD review 的 severity→status 决策（issue #50）：`warn`/`nit`（minor）findings 不再触发 `CHANGES_REQUESTED`，仅 `blocker` 进 fix loop；deferred minors 跨轮保留、ledger roll-up、终盘聚合呈现给用户决策。源 spec/plan：[spec](../specs/2026-08-09-sdd-review-minor-defer-design.md) · [plan](../plans/2026-08-09-sdd-review-minor-defer.md)。

Work the **frontier**: any ticket whose blockers are all done. 依赖：T0 先；T1 ∥ T2；T3←T2、T4←T1、T5←T1；T6←T5；T7←T1–T6；T8 收尾。

## T0 — 文档基建（spec + plan 落地）

**What to build:** 本次改动的 spec 与实现 plan 文档落地并提交，作为后续所有 ticket 的共享源头。

**Blocked by:** None — can start immediately.

- [ ] `docs/superpowers/specs/2026-08-09-sdd-review-minor-defer-design.md` 提交（含 D1–D7 + 三轮自审修复）
- [ ] `docs/superpowers/plans/2026-08-09-sdd-review-minor-defer.md` 提交（8 tasks + 三轮自审修复）

## T1 — schema SOT：severity→status 映射表 + `deferred` 字段

**What to build:** `templates/sdd-handoff-schema.md` 成为 severity→status 映射的单一真源：`blocker`→`CHANGES_REQUESTED`、`warn`/`nit`→`APPROVED`、`unverifiable`/`plan_conflicts`→`BLOCKED`；`findings[]` 加可选 `deferred` 字段（warn/nit 无条件 `deferred: true`）。

**Blocked by:** T0

- [ ] severity→status 映射表（含「无条件标 deferred」附注）
- [ ] `findings[]` 描述含 `deferred` 可选字段 + roll-up 用 `filter(.deferred == true)`
- [ ] 单任务 JSON 示例补一条 deferred finding
- [ ] 既有字段（`task`/`tasks[]`、`commits.base` 对齐表、`unverifiable[]`、`plan_conflicts[]`）不被改动

## T2 — fragment review/fix 段 severity-aware 决策

**What to build:** `_handoff-write-fragment.md` 是 #50 核心修复：review 段 7-step（merge-not-replace、无条件标 deferred、severity→status）、fix 段 4-step（preserve deferred）；旧「Empty findings → APPROVED; otherwise → CHANGES_REQUESTED」删除。

**Blocked by:** T0

- [ ] review 段 7-step 与 spec §4.1 逐字一致（merge 非 replace；warn/nit 无条件 deferred）
- [ ] fix 段 4-step（preserve deferred）与 spec §4.1 一致
- [ ] 旧「Empty findings → APPROVED; otherwise → CHANGES_REQUESTED」措辞消失
- [ ] step 6 severity→status restatement 引用 schema SOT（Task 1），不重定义

## T3 — review.md + fix.md 措辞同步

**What to build:** 两个 review/fix 模式模板同步 severity-aware 散文：`review.md` step 5 改 severity 决策；`fix.md` 补 open-findings 只含 blocker + deferred ride-across-rounds。

**Blocked by:** T2

- [ ] `review.md` step 5 无「empty → APPROVED」旧措辞，含 severity-aware 决策
- [ ] `fix.md` 含「open-findings 只含 blocker」+「deferred」说明
- [ ] 步骤编号不跳号

## T4 — D3 severity 行为锚点 + spor-handoff-writer 同步

**What to build:** `spor-token-efficient-review-dispatch` D3 段补三个 severity 行为锚点（blocker 合并前必修 / warn 可延期 / nit 纯风格）+ deferral 语义；`spor-handoff-writer` Review segment parsing 段引用 schema SOT。

**Blocked by:** T1

- [ ] D3 段含三行为锚点 + deferral 语义 + `deferred` 字段
- [ ] `spor-handoff-writer` Review segment parsing 段与 schema SOT 一致（引用非重定义）
- [ ] D3 现有输出 schema（`{findings: [...]}`）不被破坏

## T5 — `_append_ledger` deferred 分支

**What to build:** `sdd-common.sh` `_append_ledger` 三态：有 jq + findings 含 deferred → `K deferred: …`；无 deferred → `review clean`；no-jq → 诚实降级措辞（不假称 review clean）。

**Blocked by:** T1

- [ ] jq 分支 deferred 检测（`select(.deferred == true)`）→ `K deferred: <one-liners>`
- [ ] no-jq fallback → `deferred not enumerated — jq missing`
- [ ] 无 deferred → `review clean` 保持
- [ ] `_run_task_chain` 不改动（前置守卫由调用点保证）

## T6 — SDD 终盘聚合 + 用户决策门

**What to build:** `spor-subagent-driven-development` 补终盘小节：全部 APPROVED 后聚合 ledger deferred → 呈现用户 → 决策（defer 或修）→ 有界一次 final fix 波 + scoped re-review。

**Blocked by:** T5

- [ ] 聚合 ledger `deferred` 行（含 no-jq 降级行的 `deferred` 子串）→ 呈现用户
- [ ] 用户决策门：全部 defer 或指定要修
- [ ] 有界 final fix 波终点语义（re-review 干净 → status 保持 APPROVED 不重写；新 blocker → 修完无条件呈报）
- [ ] Mode B 说明（读 ledger，不新增 shell 打印）；round cap 5 不适用跨任务 fix 波

## T7 — 模板契约测试 + fixture deferred 示例

**What to build:** `tests/sdd-severity-contract.test.sh` 锁定全部散文决策（grep 断言 + 负面旧措辞）；fixture 补 deferred 示例；挂入 `scripts/ci-validate.sh`。

**Blocked by:** T1–T6

- [ ] 契约测试断言 fragment/schema/ledger/review.md/fix.md/D3/handoff-writer/SDD-skill 的新措辞 + 旧措辞负面断言
- [ ] 测试自带 `fail()`、`chmod +x`
- [ ] fixture 补 deferred 示例，`status: APPROVED`/`commits` 结构不变（不破坏 gate smoke）
- [ ] 挂入 `scripts/ci-validate.sh`；`pnpm run validate` 全绿

## T8 — 全量验证 + changeset + 收尾

**What to build:** 全量 `pnpm run validate` 绿；`pnpm changeset` 描述 #50 修复，PR 合并到 `develop`；收尾。

**Blocked by:** T7

- [ ] `pnpm run validate` 全量零失败
- [ ] changeset 存在，描述准确
- [ ] PR 目标 `develop`（非 `main`），PR 描述无 AI 署名尾注
