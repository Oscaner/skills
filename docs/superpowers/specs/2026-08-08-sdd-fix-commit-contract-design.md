# SDD fix 提交契约 + H6 CLI harness 统一设计

> fixes [#49](https://github.com/Oscaner/skills/issues/49)
>
> 决策记录：见 `## Change History`

## 1. 问题

**Issue #49（核心缺陷）：** H6 `fix` 模式缺少提交契约。`templates/sdd-cli/fix.md` 的 Instructions 只覆盖 open-findings、test evidence、report 更新——没有 `implement.md` step 5 那样的 **Commit (base/head contract)**。dogfood（p1-slim.3）观察到：fix 工人恢复了 `spor-subagent-driven-development` Rule 0a checklist，但**没有提交**；返回 `status: DONE` 时 `commits: base=<sha> head=<same-sha>`、工作区脏。下游基于 `FIX_BASE..HEAD` 的 scoped 复审因此看不到任何 fix 提交（`git diff FIX_BASE...HEAD` 为空）。

**连带缺陷（镜像漂移）：** `sdd-run-task-claude.sh` 与 `sdd-run-task-cursor.sh` 是逐行镜像（差异仅 CLI 二进制、review 模式 `Skill()` 注入、dry-run 分支、调用行）；`sdd-run-plan-{claude,cursor}.sh` 同理。镜像导致两 harness 行为容易漂移——本次修复若再各写一份校验逻辑，就是第三处镜像，下次改一处漏一处。

**相邻已知差异（`docs/superpowers/plans/2026-08-08-sdd-h6-cli-cold-start.md` §4.3 已文档化）：** cursor task 脚本**无** `Skill(mattpocock-skills:code-review)` 前缀注入——这是 `#88` 的有意设计（cursor-agent 无 `Skill(...)` 机制），不是遗漏。统一时必须保留此差异，而非强行对齐。

## 2. 设计目标

| 目标 | 描述 |
|------|------|
| 首要 | fix 模式返回 `DONE` 时工作区必须干净、`commits.head` 反映真实 HEAD——修复 #49 |
| 次要 | 消除 Full harness（task/plan × claude/cursor）脚本镜像，行为单一来源 |
| 不变量 | review 技能注入差异保持（cursor 无 `Skill()` 机制，文档化现状）；stub harness 不变 |
| 不变量 | 入口脚本文件名不变（gate 白名单 `*sdd-run-task-*`、validate、测试按名引用） |
| 范围 | `templates/sdd-cli/fix.md`、`bin/lib/sdd-common.sh`、`bin/sdd-run-task-{claude,cursor}.sh`、`bin/sdd-run-plan-{claude,cursor}.sh`、测试、文档 |

## 3. 核心决策

### D1 — fix 模式要求提交（提示层）

`fix.md` 新增 step 5（镜像 `implement.md` step 5 结构）：

- `base` = `{{FIXED_POINT}}`（fix 派发时的 `FIX_BASE`，即上次 handoff `commits.head`；已由 `_sdd_template_value` 支持）。
- 修复验证通过后：若本轮已产生**一个或多个**常规提交覆盖 fix 范围改动 → `head` = `git rev-parse HEAD`（不重复提交）。
- 否则：创建**一个**常规提交（`fix:` 为主，或匹配改动的 `feat:`/`refactor:`），subject 对齐 fix 范围；**无署名 / co-author / AI 生成尾注**；然后 `head` = `git rev-parse HEAD`。
- 本轮无 fix 范围改动（相对 `FIX_BASE` 无 diff）→ 不提交，`head` 保持原样。
- 返回时仍有未提交改动 → `status: BLOCKED`（shell 强制层会兜底）。

原 step 5/6 顺延为 6/7。

### D2 — shell 强制校验层（唯一且精确的信号 = 脏工作区）

`implement` 和 `fix` 两个模式返回后、退出前，跑共享 `sdd_validate_commit_contract`：

- `repo_root = git -C "${SDD_WORKSPACE:-.}" rev-parse --show-toplevel`（CWD 无关，与 gate 同模式）。
- `git -C "$repo_root" status --porcelain` 输出非空 → 拦截。
- 非 git 仓库 / `git` 报错 → **fail-open**（跳过，返回 0；保持 dry-run 兼容，不误伤）。
- 拦截时：有 handoff.json + jq → 改写 `.status=BLOCKED`、`.blocker=<原因>`（审计真实）；**无 jq 也照常拦截**（打印 `SDD_BLOCKED` + 退出非零，不因 jq 缺失漏检）。
- 打印 `SDD_BLOCKED: <原因>` 到 stderr、退出非零。plan driver `set -e` 随之停止。

**同时堵住 implement 模式**：implement 现在只有提示层（step 5）、无强制层——与 fix 之前是同一隐患。统一时一并加上。

**信号完备性论证：** 脏工作区是**唯一且精确**的信号：

- 工人有改动 → 要么提交（树干净）要么不提交（树脏 → BLOCKED）。不存在「树干净但该提交没提交」的情形。
- 工人本轮无改动 → 树净 + `head==base` 合法。
- 因此无需额外的 `head==base` 判定；`git status --porcelain` 任一输出（含 staged `M `、unstaged ` M`、untracked `??`）即触发拦截。

**严格版 untracked 无误报论证：** 前置条件由上游 `sdd-workspace` 保证——它在 `.superpowers/sdd/` 写入 `*` `.gitignore`，workspace 产物永不进 porcelain。implement 模式的 gate 保证任务开始时树是干净的（脏 → 早已 BLOCKED）。因此 fix 返回时出现任何 `??` 或改动，**必然是工人新建/改的**——正是要抓的漂移。

### D3 — 消除 harness 镜像：共享 run-loop + 瘦壳

**`bin/lib/sdd-common.sh` 新增 5 个共享函数：**

| 函数 | 职责 |
|------|------|
| `sdd_render_mode_prompt <mode> <review_prefix>` | 渲染模板；review 模式且 prefix 非空时前置注入 |
| `sdd_check_cli <cli_bin>` | CLI 预检；`SDD_DRY_RUN=1` 跳过；缺失 → exit 2 |
| `sdd_validate_commit_contract <mode>` | **D2 核心**：implement/fix 返回后跑 porcelain；脏 → 改写 handoff + 打印 `SDD_BLOCKED` + 返回 1；review → no-op |
| `sdd_run_task <cli_bin> <review_prefix> <task_num>` | 吸收 task 脚本全部 post-argparse 流程（env、review-package、render、调 `_sdd_invoke_cli`、**契约校验**、H1 四行输出、agent_rc/handoff 处理）。**顺序约束：契约校验在 H1 输出之前，H1 从（可能被改写为 BLOCKED 的）handoff 读取状态**——瘦壳重构时不得调反 |
| `sdd_run_plan <plan_file> <task_script> <cli_bin> <label>` | 吸收 plan 脚本全部流程（constraints、resolve、`_run_task_chain`、fix-loop、ledger） |

**task 壳 → ~15 行：** 参数解析 + 定义一行 `_sdd_invoke_cli()`（各自的 CLI flags——这是**唯一不可消除的 harness 差异**）+ 一行 `sdd_run_task`。

**plan 壳 → ~15 行：** `--plan` 解析 + 一行 `sdd_run_plan`。

**入口脚本名不变**；**stub 脚本（codex/copilot/gemini task+plan）不动**（3 行最小实现，非镜像债务）。

#### D3a — Review 技能注入参数化

共享 `sdd_render_mode_prompt` 收 `review_prefix` 参数——claude 传 `Skill(mattpocock-skills:code-review)`（保持现状），cursor 传空（保持文档化现状）。注入逻辑只写一处，harness 差异作为显式参数保留。

#### D3b — Untracked 严格度（同时覆盖 implement + fix）

严格版——`git status --porcelain` 任一输出 → BLOCKED；同时应用到 implement + fix 两模式。**implement 模式此次同时获得强制层，是对 #49 同类隐患（提示层存在但无 shell 强制层）的主动覆盖**，而非仅修 fix 一条路径。

### D4 — 测试策略

- **新增 `tests/sdd-commit-gate-smoke.sh`**（自含临时 git 仓库，沿用 `sdd-gate-test-lib.sh` 隔离模式）：脏树 fix → H1 `status: BLOCKED` + 退出非零 + handoff.status=BLOCKED；干净树 fix 控制组 → `status: DONE` **且 `handoff.commits.head == git rev-parse HEAD`**（否则「树干净但 head 错误」的漂移测试抓不住）；非 git workspace → fail-open；implement 脏树 → BLOCKED。
- **改 `tests/sdd-cli-dry-run-smoke.sh`**：加 cursor 循环（与 claude 并列验证瘦壳 glue）。
- 挂入 `scripts/ci-validate.sh`。

## 4. 技术设计

### 4.1 `fix.md` step 5 措辞

```markdown
5. **Commit (base/head contract):**
   - `base` = `{{FIXED_POINT}}`（fix 派发时的 `FIX_BASE`，即上次 handoff `commits.head`）。
   - 修复验证通过后：若本轮已产生**一个或多个**常规提交覆盖 fix 范围改动 → `head` = `git rev-parse HEAD`（不重复提交）。
   - 否则：创建**一个**常规提交（`fix:` 为主，或匹配改动的 `feat:`/`refactor:`），subject 对齐 fix 范围；无署名 / co-author / AI 生成尾注；然后 `head` = `git rev-parse HEAD`。
   - 本轮无 fix 范围改动（相对 `FIX_BASE` 无 diff）→ 不提交，`head` 保持原样。
   - 返回时仍有未提交改动 → `status: BLOCKED`（`sdd-run-task-*` 会强制校验）。
```

### 4.2 `sdd_validate_commit_contract` 伪代码

```bash
sdd_validate_commit_contract() {
  local mode="$1"
  [[ "$mode" == "implement" || "$mode" == "fix" ]] || return 0      # review → no-op
  local repo_root porcelain
  repo_root="$(git -C "${SDD_WORKSPACE:-.}" rev-parse --show-toplevel 2>/dev/null)" || return 0  # 非 git → fail-open
  porcelain="$(git -C "$repo_root" status --porcelain 2>/dev/null)" || return 0  # git 报错 → fail-open
  [[ -z "$porcelain" ]] && return 0                                   # 干净 → 通过
  # 拦截：改写 handoff（有 jq）→ 打印 SDD_BLOCKED → 返回 1
  if [[ -f "${SDD_HANDOFF_PATH:-}" ]] && command -v jq >/dev/null 2>&1; then
    local tmp; tmp="$(mktemp)"
    jq --arg b "uncommitted changes at return (${mode}): dirty working tree" \
       '.status="BLOCKED" | .blocker=$b' "${SDD_HANDOFF_PATH}" >"$tmp" && mv "$tmp" "${SDD_HANDOFF_PATH}"
  fi
  printf 'SDD_BLOCKED: uncommitted changes at return (%s) — dirty working tree\n' "$mode" >&2
  return 1
}
```

### 4.3 瘦壳脚本骨架

```bash
# bin/sdd-run-task-claude.sh
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/sdd-common.sh"
# 参数解析 → TASK_NUM / SDD_MODE_ARG / PLAN_FILE（不变）
# harness 特有：CLI 调用
_sdd_invoke_cli() {
  claude -p "$1" --output-format text --dangerously-skip-permissions 2>/dev/null
}
sdd_run_task claude "Skill(mattpocock-skills:code-review)" "$TASK_NUM"
```

```bash
# bin/sdd-run-task-cursor.sh
_sdd_invoke_cli() {
  cursor-agent --print --output-format text --force "$1" 2>/dev/null
}
sdd_run_task cursor-agent "" "$TASK_NUM"
```

```bash
# bin/sdd-run-plan-claude.sh
sdd_run_plan "$PLAN_FILE" "${SCRIPT_DIR}/sdd-run-task-claude.sh" claude "claude"
```

### 4.4 文档更新

- `plugins/superpowers-overrides/docs/sdd-h6-reference.md` — fix 模式行补「+ commit contract」；新增「post-run commit gate」小节（模式、信号、fail-open、前置条件 `.superpowers/` 被 gitignore）。
- `plugins/superpowers-overrides/docs/cross-harness-overrides.md` — 共享 run-loop + gate 说明。
- `plugins/superpowers-overrides/README.md` / `plugins/superpowers-overrides/README.zh-CN.md` — harness 共享库一行说明。
- `CHANGELOG` — release 时由 changeset 自动生成。

## 5. 实施顺序

| # | 改动 | 依赖 |
|---|------|------|
| T1 | `lib/sdd-common.sh` 新增共享函数 | — |
| T2 | `fix.md` step 5 提交契约 | —（可与 T1 并行） |
| T3 | task 脚本瘦壳（claude + cursor） | T1 |
| T4 | plan 脚本瘦壳（claude + cursor） | T1, T3 |
| T5 | 测试（新 commit-gate smoke + dry-run 加 cursor） | T1–T4 |
| T6 | 文档 + `pnpm changeset` | T2–T4 |

## 6. 验证矩阵

| 验证 | 命令 |
|------|------|
| 全量 CI（含生成器漂移、submodule、版本三连） | `pnpm run validate` |
| gate 回归 | `./plugins/superpowers-overrides/tests/sdd-gate-allow-deny-smoke.sh` |
| dry-run（claude + cursor） | `./plugins/superpowers-overrides/tests/sdd-cli-dry-run-smoke.sh` |
| 新 commit-gate 测试 | `./plugins/superpowers-overrides/tests/sdd-commit-gate-smoke.sh` |
| 门禁单测 | `override-claude-sdd-gate.test.sh` / `override-cursor-sdd-gate.test.sh` |

**通过标准：** 全量 `pnpm run validate` 零失败；新测试「脏树 fix → BLOCKED」「干净 fix → DONE」「implement 脏树 → BLOCKED」「非 git fail-open」全绿。

## 7. 边界情形

| 场景 | 行为 |
|------|------|
| workspace 非 git / `git` 报错 | fail-open（跳过，返回 0） |
| `??` untracked | 严格版抓（`.superpowers/sdd/*.gitignore` 保证 workspace 永不进 porcelain） |
| handoff.json + jq | 改写 `.status=BLOCKED`、`.blocker=`，再打印 `SDD_BLOCKED` 退出 |
| handoff.json、无 jq | 打印 `SDD_BLOCKED` + 退出非零（不静默放过） |
| review 模式 | no-op（直接通过） |
| `SDD_DRY_RUN=1` | 契约**照跑**（跑的是 `git status`，不需要 CLI）——正是测试能验证它的方式 |
| 只 staged 未 commit | porcelain `M `（staged）→ 被抓（porcelain 覆盖 staged + unstaged） |
| 提交后有遗留 untracked | `??` → 被抓 → BLOCKED |
| 本轮无改动 | 树净 + `head==base` 合法通过 |
| agent 退出非零 | 保持现有逻辑：有 handoff → 用其状态；无 handoff → BLOCKED。校验在 agent 返回后、退出前运行 |

## Change History

| 版本 | 变更 | 原因 |
|------|------|------|
| v0 | 初版 | — |
| v1 | 范围从「fix.md + claude 侧校验」扩为「全 harness 统一」 | 用户要求「整体统一，不留技术债务」；镜像导致的 harness 间行为不一致一并解决 |
| v2 | 决策 D 定为参数化（cursor 保持无 `Skill()` 注入）；决策 E 定为严格版并**同时应用到 implement + fix** | 核实 `2026-08-08-sdd-h6-cli-cold-start.md` §4.3 确认 cursor 差异是文档化设计；发现 implement 模式同隐患，一并堵死 |
| v3 | 采纳 pass-1 自检建议：D3 拆为 D3a（review 注入参数化）/ D3b（untracked 严格度）；干净 fix 控制组补 `commits.head` 断言；`sdd_run_task` 标注「契约校验先于 H1 输出」顺序约束；D3b 标注 implement 是主动覆盖 | 决策编号引用一致性 + 测试覆盖「树干净但 head 错误」漂移 + 防止瘦壳重构调反顺序 |
