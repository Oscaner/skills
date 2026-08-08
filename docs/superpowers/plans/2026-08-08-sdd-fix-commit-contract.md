# SDD Fix 提交契约 + H6 CLI Harness 统一实现计划

> Spec: [2026-08-08-sdd-fix-commit-contract-design.md](../specs/2026-08-08-sdd-fix-commit-contract-design.md)
> Fixes: [#49](https://github.com/Oscaner/skills/issues/49)
> Branch: `issue-49`

## Scope

修复 H6 `fix` 模式缺提交契约的问题（返回 `DONE` 时工作区脏、`head==base`），并消除 Full harness（task/plan × claude/cursor）脚本镜像。

- **核心修复：** `fix.md` 新增 step 5 Commit (base/head contract)；共享 `sdd_validate_commit_contract` 在 implement/fix 返回后强制校验脏工作区 → BLOCKED。
- **连带统一：** task/plan 脚本瘦壳为共享 run-loop（`sdd_run_task` / `sdd_run_plan`），行为单一来源，消除 claude/cursor 镜像漂移。

**9 文件改动：** `lib/sdd-common.sh`（共享函数）、`templates/sdd-cli/fix.md`、`bin/sdd-run-task-{claude,cursor}.sh`（瘦壳）、`bin/sdd-run-plan-{claude,cursor}.sh`（瘦壳）、`tests/sdd-commit-gate-smoke.sh`（新增）、`tests/sdd-cli-dry-run-smoke.sh`（加 cursor 循环）、`scripts/ci-validate.sh`（挂新测试）。文档 4 处 + changeset 收尾。

## Global Constraints

- 行为单一来源：`bin/lib/sdd-common.sh` 是唯一实现点；harness 壳只保留**不可消除的差异**（CLI 调用 flags、review 前缀参数、plan 的 task 脚本路径 + label）。
- 入口脚本文件名不变（gate 白名单 `*sdd-run-task-*`、validate、测试按名引用）。
- stub 脚本（codex/copilot/gemini task+plan）**不动**——3 行最小实现，非镜像债务。
- Cursor 保持**无** `Skill(mattpocock-skills:code-review)` 前缀注入（文档化现状，spec D3a）——通过 `review_prefix` 参数保留差异，不强行对齐。
- `sdd_run_task` **顺序约束：契约校验在 H1 输出之前，H1 从（可能被改写为 BLOCKED 的）handoff 读取状态**——瘦壳重构时不得调反（spec v3）。
- `SDD_DRY_RUN=1` 契约校验照跑（跑的是 `git status`，不需要 CLI）——这正是新测试的验证途径。
- `set -euo pipefail` + `sdd-common.sh` source 契约保持。
- 无署名 / co-author / AI 生成尾注在提交消息与 PR body（全局 Git 约定）。

## Tasks

### Task 1: 新增 `sdd-common.sh` 共享函数（地基）

**What:** 在 `bin/lib/sdd-common.sh` 末尾追加 5 个共享函数，行为单一来源。实现遵循 spec §4.2 伪代码 + §4.3 骨架。

1. `sdd_render_mode_prompt <mode> <review_prefix>` — 调现有 `sdd_render_template` 渲染模板；`mode == review` 且 `review_prefix` 非空时，在模板前加 `printf '%s\n\n%s' "$review_prefix" "$rendered"`。
2. `sdd_check_cli <cli_bin>` — `SDD_DRY_RUN != 1` 且 `! command -v <cli_bin>` → `sdd_exit_cli_missing "<cli_bin> not found in PATH"`。
3. `sdd_validate_commit_contract <mode>` — **核心（spec §4.2 伪代码）**：
   - `mode` 非 `implement`/`fix` → `return 0`（review no-op）。
   - `repo_root="$(git -C "${SDD_WORKSPACE:-.}" rev-parse --show-toplevel 2>/dev/null)"` 失败 → `return 0`（fail-open，非 git）。
   - `porcelain="$(git -C "$repo_root" status --porcelain 2>/dev/null)"` 失败 → `return 0`（fail-open，git 报错）。
   - `[[ -z "$porcelain" ]]` → `return 0`（干净树通过）。
   - 拦截：`SDD_HANDOFF_PATH` 存在且有 jq → 临时文件改写 `.status="BLOCKED"`、`.blocker="uncommitted changes at return (<mode>): dirty working tree"` 后原子 mv；无论有无 jq，打印 `SDD_BLOCKED: uncommitted changes at return (<mode>) — dirty working tree` 到 stderr 并 `return 1`。
4. `sdd_run_task <cli_bin> <review_prefix> <task_num>` — 吸收现 task 脚本 post-argparse 全部流程：
   - CLI 预检（`sdd_check_cli`）→ `_sdd_set_task_env` → ledger 回填 `PLAN_FILE` → review 模式 fixed-point/plan 校验 + `_sdd_run_review_package` → `sdd_require_env` → `sdd_render_mode_prompt` → 调 `_sdd_invoke_cli "$prompt"`（harness 壳定义，唯一 CLI 差异）→ **`sdd_validate_commit_contract "$SDD_MODE"`** → **H1 输出** → agent_rc/handoff 处理。**顺序不可调反**。
   - **H1-from-handoff 机制（关键，spec v3 / plan pass-1 修复）：** 现有 `_sdd_emit_h1_four_lines` 读的是 agent stdout 明文（`$agent_out`），不读 handoff。契约校验可能已把 handoff 改写为 `status=BLOCKED`，若 H1 仍从 `$agent_out` 输出会打出 `DONE`。因此 `sdd_run_task` 内的 H1 输出改为**从 `SDD_HANDOFF_PATH`（可能被改写的 handoff.json）读取状态**：
     - validator 返回 1（拦截）→ 直接输出 H1 四行：`status: BLOCKED`、`commits: base=<handoff.commits.base> head=<handoff.commits.head>`、`artifacts: <handoff.artifacts 各路径>`、`blocker: <handoff.blocker>`（用 jq 从改写后的 handoff 取）。
     - validator 返回 0（干净树 / fail-open / review）→ 保留现有行为：从 `$agent_out` 输出 H1（dry-run 分支或 agent 真实返回）。
     - validator 的调用必须 `if sdd_validate_commit_contract "$SDD_MODE"; then …; else …; fi` 包裹（不能用裸调用——`set -e` 下 return 1 会 abort，H1 永远不输出）。
   - 现有逻辑中 dry-run 分支、`_sdd_repo_root`、`_sdd_relpath_from_repo`、`_sdd_plan_from_ledger`、`_sdd_resolve_workspace`、`_sdd_run_review_package`、`_sdd_set_task_env`、`_sdd_emit_h1_four_lines` 迁入此处（这些是**共享逻辑**，非 harness 差异）。
5. `sdd_run_plan <plan_file> <task_script> <cli_bin> <label>` — 吸收现 plan 脚本全部流程：CLI 预检、`_sdd_write_plan_constraints`、`_resolve_workspace`、`_task_numbers_from_plan`、`_ledger_complete`、`_handoff_status`、`_task_pending`、`_run_task_mode`、`_append_ledger`、`_run_task_chain`（含 fix-loop cap 5）、pending 循环。末尾「no pending tasks」消息用 `printf 'sdd-run-plan-%s: no pending tasks\n' "$label"`。

**Files:** `bin/lib/sdd-common.sh` (MODIFY)

**Accepts:** 5 函数可被瘦壳脚本调用；`sdd_validate_commit_contract` 在非 git workspace / 干净树 / 脏树三态行为正确；**H1-from-handoff：validator 拦截时 H1 输出 `status: BLOCKED`（从改写后 handoff 读），validator 通过时 H1 保持从 `$agent_out` 输出**；函数名不与现有 `sdd_*` 冲突。

**Dependencies:** None

---

### Task 2: `fix.md` 新增 step 5 提交契约

**What:** 在 `templates/sdd-cli/fix.md` 的 Instructions 中、现有 step 4（更新 implementer report）之后插入 step 5，原文见 spec §4.1：

```
5. **Commit (base/head contract):**
   - `base` = `{{FIXED_POINT}}`（fix 派发时的 `FIX_BASE`，即上次 handoff `commits.head`）。
   - 修复验证通过后：若本轮已产生**一个或多个**常规提交覆盖 fix 范围改动 → `head` = `git rev-parse HEAD`（不重复提交）。
   - 否则：创建**一个**常规提交（`fix:` 为主，或匹配改动的 `feat:`/`refactor:`），subject 对齐 fix 范围；无署名 / co-author / AI 生成尾注；然后 `head` = `git rev-parse HEAD`。
   - 本轮无 fix 范围改动（相对 `FIX_BASE` 无 diff）→ 不提交，`head` 保持原样。
   - 返回时仍有未提交改动 → `status: BLOCKED`（`sdd-run-task-*` 会强制校验）。
```

现有 step 5（写 handoff）/ step 6（不写 ledger）顺延为 step 6 / step 7。H1 返回块不变。

**Files:** `templates/sdd-cli/fix.md` (MODIFY)

**Accepts:** step 5 措辞与 spec §4.1 逐字一致；步骤编号连续无跳号；`{{FIXED_POINT}}` 已被 `_sdd_template_value` 支持（fix 模式下 `SDD_REVIEW_FIXED_POINT` 即 FIX_BASE）。

**Dependencies:** None（可与 Task 1 并行）

---

### Task 3: task 脚本瘦壳（claude + cursor）

**What:** 将 `bin/sdd-run-task-claude.sh` 与 `bin/sdd-run-task-cursor.sh` 瘦身为壳，只保留 harness 特有部分，其余逻辑全部走 `sdd_run_task`（Task 1 共享函数）。spec §4.3 骨架：

```bash
# bin/sdd-run-task-claude.sh（壳）
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/sdd-common.sh"

# 参数解析：--task / --mode / --plan → TASK_NUM / SDD_MODE_ARG / PLAN_FILE
# （保留现有 usage、handoff-mode 拒绝、`--segment` 拒绝——这些是入口契约）

# harness 特有：CLI 调用（唯一不可消除差异）
_sdd_invoke_cli() {
  claude -p "$1" --output-format text --dangerously-skip-permissions 2>/dev/null
}
sdd_run_task claude "Skill(mattpocock-skills:code-review)" "$TASK_NUM"
```

```bash
# bin/sdd-run-task-cursor.sh（壳）
_sdd_invoke_cli() {
  cursor-agent --print --output-format text --force "$1" 2>/dev/null
}
sdd_run_task cursor "" "$TASK_NUM"
```

**具体删除（从两个壳移入共享库，不重复实现）：** `_sdd_repo_root`、`_sdd_relpath_from_repo`、`_sdd_plan_from_ledger`、`_sdd_resolve_workspace`、`_sdd_set_task_env`、`_sdd_emit_h1_four_lines`、`_sdd_run_review_package`、dry-run 分支、agent_rc/handoff 处理、review 模式 fixed-point/plan 校验逻辑。

**保留在壳（harness 特有）：** 参数解析、usage/handoff 拒绝、`_sdd_invoke_cli`（含各自 CLI flags 与 `2>/dev/null`）、`sdd_run_task` 调用行（含各自 `cli_bin` 与 `review_prefix`）。

**Files:** `bin/sdd-run-task-claude.sh` (MODIFY), `bin/sdd-run-task-cursor.sh` (MODIFY)

**Accepts:** 两壳行为与改前一致（除新增契约校验）；dry-run 模式 H1 输出不变；review 模式 cursor 仍无 `Skill()` 前缀（`review_prefix=""`）；`_sdd_invoke_cli` 是唯一 CLI 调用点。

**Dependencies:** Task 1

---

### Task 4: plan 脚本瘦壳（claude + cursor）

**What:** 将 `bin/sdd-run-plan-claude.sh` 与 `bin/sdd-run-plan-cursor.sh` 瘦身为壳，逻辑走 `sdd_run_plan`（Task 1 共享函数）。spec §4.3 骨架：

```bash
# bin/sdd-run-plan-claude.sh（壳）
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/sdd-common.sh"

# --plan 参数解析 → PLAN_FILE（保留 usage）
# 文件存在校验 → 无则 sdd_exit_blocked

sdd_run_plan "$PLAN_FILE" "${SCRIPT_DIR}/sdd-run-task-claude.sh" claude "claude"
```

```bash
# bin/sdd-run-plan-cursor.sh（壳）
sdd_run_plan "$PLAN_FILE" "${SCRIPT_DIR}/sdd-run-task-cursor.sh" cursor-agent "cursor"
```

**具体删除（移入共享库）：** `_sdd_write_plan_constraints`、`_resolve_workspace`、`_task_numbers_from_plan`、`_ledger_complete`、`_handoff_status`、`_task_pending`、`_run_task_mode`、`_append_ledger`、`_run_task_chain`、pending 循环、CLI 预检、末尾 no-pending 消息。

**保留在壳：** `--plan` 解析、usage、`sdd_run_plan` 调用行。

**Files:** `bin/sdd-run-plan-claude.sh` (MODIFY), `bin/sdd-run-plan-cursor.sh` (MODIFY)

**Accepts:** 两壳行为与改前一致；`sdd_run_plan` 的 `task_script` 参数指向正确的 sibling 脚本；CLI 预检用 `cli_bin` 参数（cursor 传 `cursor-agent`）。

**Dependencies:** Task 1, Task 3（plan 依赖 task 壳验证通过）

---

### Task 5: 测试（新 commit-gate smoke + dry-run 加 cursor）

**What:**

1. **新增 `tests/sdd-commit-gate-smoke.sh`**（自含临时 git 仓库，沿用 `sdd-gate-test-lib.sh` 隔离模式：拷贝、git-init、注入真实 SHA）：
   - **fixture 注意：** `sdd-gate-test-lib.sh` 的 `<SHA>` 注入只改写 `TASK_BASE: <SHA>` 的 brief，**不碰 handoff.json**。干净控制组断言 `handoff.commits.head == git rev-parse HEAD` 需要 handoff fixture 自带真实 SHA——测试必须在 git-init 后、用 copy 自身的 HEAD 创建/seed `task-1-handoff.json`。
   - 脏树 fix → `SDD_DRY_RUN=1` 跑 `sdd-run-task-claude.sh --mode fix`，断言 H1 `status: BLOCKED`、退出非零、handoff.status=BLOCKED。
   - 干净树 fix 控制组 → `status: DONE` **且 `handoff.commits.head == git rev-parse HEAD`**（spec v3：防「树干净但 head 错误」漂移）。
   - 非 git workspace → fail-open（`status: DONE` 保持，不误伤）。
   - implement 脏树 → BLOCKED（D3b 主动覆盖验证）。
   - 挂入 `scripts/ci-validate.sh`。
2. **改 `tests/sdd-cli-dry-run-smoke.sh`**：在现有 claude 循环旁加 cursor 循环，验证瘦壳 glue（cursor 侧 dry-run 用 `cursor-agent` 不可用时需跳过 CLI PATH 检查——沿用现有 `SDD_DRY_RUN=1` 跳过逻辑）。

**Files:** `tests/sdd-commit-gate-smoke.sh` (NEW), `tests/sdd-cli-dry-run-smoke.sh` (MODIFY), `scripts/ci-validate.sh` (MODIFY)

**Accepts:** 4 个断言组全绿；cursor dry-run 与 claude 并列通过；`pnpm run validate` 全量零失败。

**Dependencies:** Task 1–4

---

### Task 6: 文档 + changeset

**What:**

1. `docs/sdd-h6-reference.md` — fix 模式行补「+ commit contract」；新增「post-run commit gate」小节（模式 implement/fix、信号 `git status --porcelain`、fail-open、前置条件 `.superpowers/` 被 `*` gitignore）。
2. `docs/cross-harness-overrides.md` — SDD CLI harness 段落补共享 run-loop + commit gate 说明。
3. `README.md` + `README.zh-CN.md` — harness 表格下补一行「共享库 `bin/lib/sdd-common.sh` 承载 task/plan run-loop」。
4. `pnpm changeset` — 描述：#49 fix commit contract + H6 harness 统一。合并到 develop。

**Files:** 4 docs (MODIFY) + 1 changeset (NEW)

**Accepts:** 文档与实现一致；changeset 存在且描述准确；`pnpm run validate` 通过。

**Dependencies:** Task 2–4

---

### Task 7: 全量验证 + 收尾

**What:**

1. `pnpm run validate` 全量零失败（含生成器漂移、submodule 解析、版本三连）。
2. 新 commit-gate 测试 + 改后 dry-run 测试独立跑通。
3. `finishing-a-development-branch`：PR `develop → main`（本项目日常 flow）。

**Files:** None

**Accepts:** 全量 CI 绿；新/改测试全绿；PR 描述无 AI 署名尾注。

**Dependencies:** Task 6

---
