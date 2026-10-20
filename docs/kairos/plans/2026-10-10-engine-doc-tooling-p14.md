---
title: 引擎文档工具（Engine Doc-Tooling）— P14 实施计划：one-shot CDD child 同步收工契约（handoff-absent + contractViolationCount）
doc-type: plan
version: v0.2
date: 2026-10-20
spec: docs/kairos/specs/2026-10-10-engine-doc-tooling-p14-design.md
parent-program: docs/kairos/specs/2026-10-10-engine-doc-tooling-overall.md
depends-on: P13（Done · hard——终止面与升格已落地 · overall D58）
base: develop
---

## Constraints

- 七前提整评：破坏性许可；OOP 统一、零裸函数；提示硬句单源、禁止声明再抄；死码随改清理；消费者只感「能收口」，禁令不进消费 skill；能收敛到既有 clause/计数对称面则不做平行子系统；宿主 bg 能力不在引擎重造。
- 机器因只认可观察读回事实（缺稿 / 不合格稿），不做法医 yield 证明；契约违约计数 ⊥ 终止计数（两套计数、两套因，resume 都不读）。
- 脏树恢复 ⊥ 引擎：门可以硬，手不能伸——零 stash / 临时 commit / dirty-resume。
- P13 终止/升格/`timeoutCount`/capsule 键集语义零变；CLI 旗标 / 退出码表 0/1/2 / `next:` 字面零破。
- 记账缝按 design §3.2：**优先**在 `#reject`/`#writeCrash` 内按 `cause ∈ {handoff-absent, contract-violation}` 调用唯一 Ledger 写点；**禁止**只靠 `status === "BLOCKED"` 递增。
- 引擎调用一律本地 `node packages/cdd-engine/src-next/bin.ts`；本计划为内部文档中文主源（Strategy B）；不发布，changeset 收尾到可发布态即止。

### Task 1: 同步收工硬句——提示面单源
- **Objective**: 所有会写 handoff 的 one-shot 派发（implement / review / fix 及共享该壳的 docs-fix / branch 线）渲染出**同一**同步收工硬句；单源落在 `CLAUSES` + `LICENSE_ITEMS`（或等价共享槽），无三处 shell 长文复制；必达 token：`bg_run`、`bg_delegate`、handoff 前禁止 yield 式结束回合、嵌套活同回合同步完成。
- **Files**: `packages/cdd-engine/src-next/render/templates.ts`（`CLAUSES` · `LICENSE_ITEMS` · 必要时 `$version` 注释 bump）；`packages/cdd-engine/src-next/render/__tests__/render.test.ts`（或既有组装断言所在测试——若无 clause 注入断言则在此文件追加）。
- **Consumes**: design §2.1 英文候选句；既有 `{{> cl:…}}` 解析路径。
- **Produces**: 新 clause 键（建议 `cl:sync-completion`）及其在共享 license 列表中的挂载；三腿渲染字节含同一硬句；Task 2+ 不改提示面。
- **Steps**:
  - 写失败测试：对 implement / review / fix（各取一条代表性 `TemplateAssembler.render` 输入）断言渲染文本同时包含 `bg_run`、`bg_delegate`，以及「handoff 前禁止 yield 式结束回合 / 嵌套活同回合同步」语义（可用子串 `before the handoff` / `synchronously` / `same turn` 等与最终措辞一致的 pin）— checkable: 现状失败
  - 新增 `CLAUSES["cl:sync-completion"]`，最终英文措辞由本任务锁定（以 design 候选为底，可微调标点，不可删必达 token）；挂入 `LICENSE_ITEMS`；若 `$version` 注释约定「契约面变更须 bump」则随注释同步 — checkable: 三腿渲染断言通过；`grep` 三处 shell 无独立复制长文
  - 断言消费面 skills 路径未改（本任务 diff 不含 `packages/kairos/skills/**`）— checkable: `git diff --name-only` 对该任务提交零 skills 命中
- **Acceptance**: 三腿（及共享壳）提示含同一硬句；单源 clause；消费 skill 零禁令文案；无新旗标/环境变量。
- **DependsOn**: none

### Task 2: `handoff-absent` 归因 + `contractViolationCount` 唯一写点
- **Objective**: exit 0 + 缺稿 → crash `cause: "handoff-absent"`；畸形/schema 仍 `"contract-violation"`；两类均使 `contractViolationCount` +1；写点唯一且落在 `#reject`/`#writeCrash` 按 cause 观察的缝上；同步改写 `CrashCause` JSDoc。
- **Files**: `packages/cdd-engine/src-next/session/ledger.ts`（`CrashCause` · JSDoc · `incrementContractViolationCount`）；`packages/cdd-engine/src-next/face/lifecycle.ts`（缺稿 `#reject` 显式 cause · `#writeCrash`/`#reject` 内计数调用）；测试 `face/__tests__/cli.test.ts`（既有缺稿 pin 约 `:4421`/`:4451` 等）、`session/__tests__/ledger.test.ts`（若有 counter 面）。
- **Consumes**: Task 1 无接口依赖；既有 `#reject` 默认参与 `#writeCrash` 签名；`incrementTimeoutCount` 为对称范本。
- **Produces**: `CrashCause` 含 `"handoff-absent"`；`Ledger.incrementContractViolationCount(): number`（唯一生产写点）；缺稿路径显式 `cause: "handoff-absent"`；契约违约计数在 cause ∈ 集合时 +1。
- **Steps**:
  - 翻新 pin：`cli.test.ts` 中「exit 0 无 handoff」用例将 `crash.cause` 从 `"contract-violation"` 改为期望 `"handoff-absent"`；新增/翻新断言：该路径后 `ledger.counterOf("contractViolationCount") === 1`；保留畸形/schema 用例期望 `"contract-violation"` 且计数 +1 — checkable: 缺稿用例因旧 cause 失败
  - 扩展 `CrashCause` 并**改写 JSDoc**：`handoff-absent` = 缺稿；`contract-violation` = 有稿但不合格（畸形/schema）；禁止继续把「无稿或 schema」并写在旧词下 — checkable: typecheck；注释人工可读与 design §3.1 表一致
  - 实现 `incrementContractViolationCount`（镜像 `incrementTimeoutCount`：read → +=1 → write → return）；活面禁止第二写入路径 — checkable: ledger 单测或源扫描仅一处方法体写该字段
  - 缺稿分支 `#reject(..., { exitCode: 0, cause: "handoff-absent", termination: null })`；在 `#writeCrash`（或 `#reject` 紧邻、仍持有最终 cause 处）当 `cause ∈ {handoff-absent, contract-violation}` 且非 termination 覆盖时调用唯一写点一次 — checkable: 缺稿/畸形用例 cause+计数通过
  - 负例 pin：`child-exit`、纯 TIMEOUT（termination）、成功轮、无 crash 的 BLOCKED、evidence-gate 改写 BLOCKED —— `contractViolationCount` 不变；TIMEOUT 仍只动 `timeoutCount` — checkable: 相关 cli/lifecycle 断言绿
- **Acceptance**: 归因表与 design §3.1 一致；计数缝不靠 status 字面；JSDoc 已同步；P13 timeout 语义零回归。
- **DependsOn**: none

### Task 3: dirty-tree 文案收窄 + 交付
- **Objective**: dirty-tree 门语义不变；`preflight.dirtyTree` 文案明示恢复归编排器、引擎只拒绝不自动清脏；补 changeset；全量验证。
- **Files**: `packages/cdd-engine/src-next/face/words.ts`（`preflight.dirtyTree`）；`packages/cdd-engine/src-next/session/__tests__/preflight.test.ts`（现 pin `toContain("commit or discard")`）；`.changeset/` 新增 cdd-engine **minor** changeset。
- **Consumes**: Task 1–2 已合入的行为面。
- **Produces**: 更新后的 dirty-tree 英文文案（仍指导 commit/discard，并点明 orchestrator 侧恢复、引擎不 stash/不清树/不对脏树 resume）；changeset；validate 绿。
- **Steps**:
  - 翻新 preflight 测试对 message 的子串断言，使其匹配新文案必达语义（保留 `dirty` / 拒绝意图；加入 orchestrator 或等价「引擎不自动恢复」信号）— checkable: 旧文案断言失败
  - 改 `CAPSULE_WORDS.preflight.dirtyTree` 一字面量；不改 `PreFlight.vet` 门序与 `reason: "dirty-tree"` — checkable: preflight 脏树用例全绿；源扫描无 stash/dirty-resume 新路径
  - 新增 changeset（cdd-engine minor；摘要覆盖同步收工硬句 · `handoff-absent` · 契约计数 · dirty-tree 文案；不发布）— checkable: changeset 文件存在且 bump 为 minor
  - 跑 `pnpm -C packages/cdd-engine test` 与 `pnpm run validate` — checkable: 全绿 / ALL PASS
- **Acceptance**: 门仍 BLOCK；文案归编排器；skills 零改；CLI/`next:`/退出码零破；changeset minor · 不发布。
- **DependsOn**: 1, 2

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-10-20 | 初稿——P14 三任务：T1 提示面 `cl:sync-completion` 单源硬句；T2 `handoff-absent` + `incrementContractViolationCount` 于 `#reject`/`#writeCrash` 按 cause 记账；T3 dirty-tree 文案 + changeset + validate；承 design v0.2 / D58 / #368。 | Oscar M. · Claude（kairos:cdd-plan [P14]） |
| v0.2 | 2026-10-20 | closeout（cdd-close）——P14 全链闭合登记：两波实现链全绿（W1={1,2} → W2={3}；W1 经一轮 fix 收口——W1 implement `64dcf5da` · wave-review-1 REVIEW_FIX（1 nit · CrashCause JSDoc 落点）→ wave-fix-1 `e53d3077` · W2 implement `00da0d34` · wave-review APPROVED） · 分支终审 APPROVED（branch-review-1 · 零 branch-fix） · 文档链（注册 `96a48b98` · phase-spec `c47943e6` · docs-fix `2c711c32` · plan `35209eb5`） · 验收：`pnpm run validate` exit 0（cdd-engine 782/782 · kairos 83/83 · root 10/10 · typecheck ×3 · emit-check fresh · version-sync kairos 1.1.2 · cdd-engine 3.1.0 · 零裸函数）· changeset cdd-engine minor pending · 不发布 · **未验证面（如实记录）**：真实 pi `-p` child 上 `bg_run`/`bg_delegate` yield 路径导致缺稿的端到端实机路径未跑（提示面/lifecycle/ledger 单测与渲染 pin 已绿） · 父 overall → v2.64（P14 行 Done） | Oscar M. · Claude（kairos:cdd-close · closeout-backfill · 2026-10-20） |
