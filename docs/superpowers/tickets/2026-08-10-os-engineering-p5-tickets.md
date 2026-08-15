# Tickets: os-engineering P5（CDD 引擎 + CI + 测试迁 Node，单语言终态）

把 CDD 引擎（bash）+ ci-validate + 全部 shell/python 测试 + release 辅助迁 Node，可执行面单语言终态；CDD 契约（CLI/handoff/exit codes/H6 链）逐字节不变。源计划: [2026-08-10-os-engineering-p5.md](../plans/2026-08-10-os-engineering-p5.md)。

Work the **frontier**：T0 无阻塞；T1 依赖 T0；T2 依赖 T1；T3 依赖 T1；T4 依赖 T2/T3；T5 依赖 T3；T6 依赖 T0-T5。

## T0 引擎基础模块 Node（registry / exit / templates / ledger）+ 单测

**What to build:** 把 cdd-common.sh 的 registry（harness 加载 + ship gate + CLI preflight）、exit（exit codes + blocked 消息）、templates（mode prompt 渲染 + 行预算）、ledger（追加 + plan-constraints）四个基础模块迁为 Node `.mjs`，配模块单测。bash 引擎并行保留（P5 编排仍用它），validate 保持绿。

**Blocked by:** None — can start immediately.

- [ ] `lib/registry.mjs` / `exit.mjs` / `templates.mjs` / `ledger.mjs` 就位（导出契约如计划）
- [ ] 模块单测绿（registry schema / exit codes / templates 行预算真实阈值 / ledger 追加）
- [ ] `pnpm run validate` ALL PASS（bash 未动）

## T1 contract + runner（H6 链核心）→ Node

**What to build:** commit-contract 校验 + handoff 写入（contract.mjs，含嵌套 CLI 失败 stderr-surfacing 唯一分歧）+ H6 三模式链 runner.mjs（runTask/runPlan，H1 四行独占）。契约逐字节不变。

**Blocked by:** T0

- [ ] `contract.test.mjs` / `runner.test.mjs` 绿（commit-gate 16 + severity 30 断言）
- [ ] `validateCommitContract` / `classifySeverity` / `writeHandoff` / `runTask` / `runPlan` 契约符合计划
- [ ] `pnpm run validate` ALL PASS

## T2 4 入口 `.mjs` 壳

**What to build:** cdd-run / cdd-exec / cdd-select / cdd-session-activate 四个 `.mjs` 入口（CLI 契约与 `.sh` 一致；dry-run = `CDD_DRY_RUN=1` env；exec = 一次性 prompt-runner；select = 非交互输出；session-activate = minimal/bind 子命令）。

**Blocked by:** T1

- [ ] 入口测试绿（`node cdd-run.mjs` dry-run H1 DONE 等）
- [ ] CLI 契约与 `.sh` 逐参数一致
- [ ] `pnpm run validate` ALL PASS

## T3 ci-validate.mjs（validate 编排）

**What to build:** `scripts/ci-validate.mjs` 编排全部 12 个 block 子检查（含 5c 零残留 grep 守卫），package.json `validate` → `node scripts/ci-validate.mjs`，结构化失败报告。

**Blocked by:** T1

- [ ] 12 block 全 port（5b2 gate hooks / 5c 零残留不得丢）
- [ ] `pnpm run validate`（node ci-validate.mjs）ALL PASS
- [ ] package.json / CLAUDE.md / CI 引用更新

## T4 行为测试迁 node:test

**What to build:** `packages/engineering/tests/helpers.mjs`（port test-lib.sh + setup_repo fixture）+ `common-functions.test.mjs`（cdd-common-functions 剩余函数家族）。T1-T3 已建的 `bin/engine/tests/` 模块单测是最终产物，本票只迁未覆盖的；ci-validate 5b 两棵树都跑。删 9 个 `.sh` 测试 + test-lib.sh。

**Blocked by:** T2, T3

- [ ] helpers + common-functions node:test 绿
- [ ] 两棵树都进 ci-validate 5b
- [ ] 旧 `.sh` 测试删除 + `pnpm run validate` ALL PASS

## T5 rule-reference + release 辅助 + overrides 测试迁 Node

**What to build:** `rule-reference.test.mjs`（port .py，双调用点更新）+ `cleanup-legacy-release-tags.mjs` / `gh-branch-rulesets.mjs`（读 gh-branch-rulesets/*.json 数据）+ `validate-overrides-build.mjs`（~10 python 子检查全迁）+ `manifest-harness.test.mjs`。删全部对应 `.py`/`.sh`。

**Blocked by:** T3

- [ ] 全部剩余 `.py`/`.sh` 迁完 + 删
- [ ] 各调用点（ci-validate 5b / 5 / rule-reference 双点）更新 `.mjs`
- [ ] `pnpm run validate` ALL PASS

## T6 收尾（自举 smoke + 删 bash + 零残留）

**What to build:** 自举 smoke（`CDD_DRY_RUN=1` Node vs bash 逐字段对照）→ 翻转 ci-validate.mjs 5b2 的 `.sh` 检查为 `.mjs` → 删全部 bash 引擎 + ci-validate.sh → 全仓 `.sh`/`.py` 引用清零（含 CLAUDE.md/docs）→ 可执行面单语言 Node。

**Blocked by:** T0-T5

- [ ] 自举 smoke：Node 与 bash H1 四行 + handoff 逐字段一致
- [ ] 可执行面无 `.sh`/`.py`（grep 验证）
- [ ] `pnpm run validate` + 全部 node:test ALL PASS
