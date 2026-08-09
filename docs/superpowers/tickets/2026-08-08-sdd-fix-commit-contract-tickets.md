# Tickets: SDD fix 提交契约 + H6 CLI harness 统一

修复 SDD H6 `fix` 模式缺提交契约的问题（issue #49）并消除 Full harness（task/plan × claude/cursor）脚本镜像：fix 返回时工作区脏 → BLOCKED，implement/fix 提交契约强制层，共享 run-loop 行为单一来源。源 spec/plan：[spec](../specs/2026-08-08-sdd-fix-commit-contract-design.md) · [plan](../plans/2026-08-08-sdd-fix-commit-contract.md)。

Work the **frontier**: any ticket whose blockers are all done. 串行依赖：T0 → T2 → T3 → T4，T1 并行，T5 收尾。

## T0 — 共享库地基（5 个函数）

**What to build:** `sdd-common.sh` 新增 5 个共享函数（render+review 前缀、CLI 预检、提交契约校验、task run-loop、plan run-loop），行为单一来源，供所有 Full harness 壳调用。

**Blocked by:** None — can start immediately.

- [ ] `sdd_render_mode_prompt` 渲染模板 + review 前缀注入（claude 有 / cursor 空）
- [ ] `sdd_check_cli` 预检（DRY_RUN 跳过，缺失 exit 2）
- [ ] `sdd_validate_commit_contract` 脏树 → 改写 handoff BLOCKED + 打印 SDD_BLOCKED + 返回 1；review/非 git/干净树 → 通过
- [ ] `sdd_run_task` 吸收 task 流程，H1-from-handoff（拦截 → 输出 BLOCKED H1 + 退出非零）
- [ ] `sdd_run_plan` 吸收 plan 流程，no-pending 消息保留 stderr
- [ ] 函数名与现有 `sdd_*` 无冲突

## T1 — fix.md step 5 提交契约

**What to build:** fix 模式模板新增 Commit (base/head contract) 步骤：fix 范围改动必须提交（无署名尾注），无改动则不提交，未提交改动 → BLOCKED。

**Blocked by:** None — can start immediately.

- [ ] step 5 措辞与 spec §4.1 逐字一致
- [ ] 步骤编号连续（5/6 → 6/7 顺延）
- [ ] `{{FIXED_POINT}}` 被 `_sdd_template_value` 支持

## T2 — task 壳瘦壳（claude + cursor）

**What to build:** 两个 task 脚本瘦身为壳，只保留参数解析 + CLI 调用（`_sdd_invoke_cli`），其余逻辑全部走 `sdd_run_task`；两 harness 行为一致（除 CLI flags 与 review 前缀）。

**Blocked by:** T0

- [ ] claude 壳 `sdd_run_task claude "Skill(mattpocock-skills:code-review)"`
- [ ] cursor 壳 `sdd_run_task cursor-agent ""`（cli_bin = `cursor-agent`，非 `cursor`）
- [ ] dry-run H1 输出与改前一致
- [ ] review 模式 cursor 仍无 `Skill()` 前缀

## T3 — plan 壳瘦壳（claude + cursor）

**What to build:** 两个 plan 脚本瘦身为壳，逻辑走 `sdd_run_plan`；fix-loop cap 5、ledger append、pending 循环保持。

**Blocked by:** T0, T2

- [ ] claude 壳 `sdd_run_plan "$PLAN_FILE" "…/sdd-run-task-claude.sh" claude "claude"`
- [ ] cursor 壳 `sdd_run_plan "$PLAN_FILE" "…/sdd-run-task-cursor.sh" cursor-agent "cursor"`
- [ ] fix-loop cap 5 + ledger 行为与改前一致
- [ ] no-pending 消息保留 stderr

## T4 — 测试（commit-gate smoke + dry-run 加 cursor）

**What to build:** 一个验证提交契约强制层行为的测试：脏树 fix → BLOCKED、干净 fix → DONE + head==HEAD、非 git fail-open、implement 脏树 → BLOCKED；dry-run 测试加 cursor 循环。

**Blocked by:** T2, T3

- [ ] 脏树 fix → H1 `status: BLOCKED` + 退出非零 + handoff.status=BLOCKED
- [ ] 干净树 fix 控制组 → `DONE` 且 `commits.head == git rev-parse HEAD`
- [ ] 非 git workspace → fail-open（DONE 保持）
- [ ] implement 脏树 → BLOCKED
- [ ] dry-run 测试 cursor 循环通过
- [ ] 挂入 `scripts/ci-validate.sh`

## T5 — 文档 + changeset

**What to build:** 文档同步共享 run-loop + commit gate，CHANGELOG 由 changeset 生成，全量验证收尾。

**Blocked by:** T1, T2, T3

- [ ] h6-reference 补「+ commit contract」+ post-run commit gate 小节
- [ ] cross-harness 补共享 run-loop + gate 说明
- [ ] README ×2 补共享库一行
- [ ] `pnpm changeset` 描述 #49 修复 + harness 统一
- [ ] `pnpm run validate` 全量零失败
