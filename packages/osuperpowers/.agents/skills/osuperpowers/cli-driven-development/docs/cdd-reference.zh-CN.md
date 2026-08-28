# CDD CLI Orchestrator Reference (H6–H8)

> Worker discipline 权威来源（SOT）：`../templates/cdd/{implement,task-review,fix}.md` + `_handoff-write-fragment.md`
> Orchestrator gate 纪律：[`controller-handoff.md`](controller-handoff.md) H1–H5
> **Rule 0 checklist 语义契约：** Rule 0 的三阶段 phase 标记与关键 token 不是 line-budget 瘦身目标 —— 瘦身不得删除/压缩 checklist 的 phase 结构或关键 token；`bin/engine/tests/templates.test.mjs` 会断言这一点（issue #52 Guard 1）。

## H6 — CLI 分发（p1）

每个 task 的执行使用 **plugin 内置**（plugin-bundled）的 Node CLI 入口脚本（`bin/engine/*.mjs`）—— 每个 mode 一次 CLI agent 调用；进程退出即销毁上下文。

1. **Detect harness（检测 harness）** → 经 [cli-select](../skills/cli-select/SKILL.md) 选定 harness → `{plugin_root}/bin/engine/cdd-task.mjs --harness <name>`（orchestrator 只选一次；**无** runtime 重新检测）。
2. **Three modes（三种 mode）** —— 每种 mode 一次调用：

| `CDD_MODE` | 职责 |
|------------|----------------|
| `implement` | implementer + `mattpocock-skills:tdd` → report + test-evidence.json + handoff write + H1 四行契约 |
| `task-review` | `review-package` shell（archive diff）；经 `cdd-review.mjs` 直派的 axis 评审（D4；axis 文件；Step 5 覆盖）+ handoff write |
| `fix` | fix implementer + handoff write；读取 open-findings；**+ commit contract**（post-run gate，见下文） |

3. **Env contract（环境变量契约）**（仅路径 —— **绝不**把完整 plan 粘贴进 CLI 环境变量）：

| Variable | 用途 |
|----------|---------|
| `CDD_WORKSPACE` | workspace 根目录 |
| `CDD_TASK_BRIEF` | brief 路径 |
| `CDD_LEDGER` | progress.md |
| `CDD_MODE` | `implement` \| `task-review` \| `fix` |
| `CDD_FINDINGS` | fix mode：open-findings.json |
| `CDD_PLAN_CONSTRAINTS` | `<workspace>/plan-constraints.md`（orchestrator 预写） |
| `CDD_HANDOFF_PATH` | 目标 handoff.json 路径 |
| `CDD_TASK_REVIEW_FIXED_POINT` | task-review：初始取 handoff `commits.base`；fix 循环的 task-review：`FIX_BASE` |

4. **Output（输出）：** 退出前写入/更新 `CDD_HANDOFF_PATH`（默认 `task-N-handoff.json` 或 batch 变体）；stdout = H1 四行作为最后一个 block（task-review mode 可先输出 review-package 的 `wrote <diff>:` 进度行 —— 最后一个 block 仍是 H1）；非零退出且无 handoff → **BLOCKED**。
5. **Forbidden（禁止）：** `--resume` 或任何携带先前 session 历史的 CLI 调用。
6. **Session traceability（会话可追溯性）：** CLI agent 使用一次性 print mode（`--print` / `--output-format text`），不会把 session 注册进 `/resume` 列表或 `~/.claude/sessions/`。

   | 关注点 | 方案 |
   |---------|----------|
   | 审计轨迹（Audit trail） | ledger（`progress.md`）+ handoff 文件（`task-N-handoff.json`）+ 每 task 报告（`task-N-report.md`） |
   | 恢复（Recovery） | 为该 task+mode 重跑 orchestrator shell |
   | 被否定的替代方案 | `--session-id`（仅 resume）、`--name`（print mode 不写 session）、`--background`（daemon，与一次性分发不兼容） |

**典型 per-task CLI 序列（thin orchestrator）：**

```bash
node {pluginRoot}/bin/engine/cdd-task.mjs --harness <name> --task N --mode implement
node {pluginRoot}/bin/engine/cdd-task.mjs --harness <name> --task N --mode task-review
```

Orchestrator / plan 脚本在每次 CLI 调用前设置 `CDD_WORKSPACE` 与路径环境变量；CLI **不会**读取完整 plan 文件。

**Workspace path contract（workspace 路径契约，§2.2a）：**

| Path | 用途 |
|------|---------|
| `<workspace>/progress.md` | ledger（`CDD_LEDGER`） |
| `<workspace>/task-N-brief.md` | task brief（`CDD_TASK_BRIEF`） |
| `<workspace>/task-N-handoff.json` | handoff（单 task） |
| `<workspace>/batch-<first>-<last>-handoff.json` | handoff（batch） |
| `<workspace>/plan-constraints.md` | plan Global Constraints 的 orchestrator 摘录（`CDD_PLAN_CONSTRAINTS`） |

**Batching（§2.2b —— 继承 p0 §2.3）：**

Batch 块仍然运行 **一条** 3-mode CLI 链；文件名使用 batch 前缀：

| 项目 | 约定 |
|------|------------|
| Handoff | `batch-<first>-<last>-handoff.json` |
| open-findings | `batch-<first>-<last>-open-findings.json` |
| Review 报告 | `batch-*-review-standards.md` / `batch-*-review-spec.md` |
| Diff 范围 | `FIRST_TASK_BASE..LAST_HEAD` |

**Exit codes（退出码）：** `0` = OK；`1` = BLOCKED / 不支持的 harness（stderr 输出 `CDD_BLOCKED:`）；`2` = CLI 缺失 → orchestrator **BLOCKED**（无 p0 fallback）；`3` = skills 缺失 → install-and-use 通道缺上游插件 → stderr 输出 `CDD_BLOCKED: missing skills: <plugins>` + 每插件 install 提示，orchestrator **BLOCKED**（区别于 2 = harness CLI 不存在；exit 3 = CLI 存在但 skills 插件未安装）。嵌套 CLI 失败且无 handoff → exit **1**（与 bash `cdd_exit_blocked` 对齐）+ stderr `CDD_BLOCKED:` 诊断；Node 额外写入一个 BLOCKED handoff，把 CLI stderr 放进 `blocker` —— 这是唯一获准的偏差（spec §2.1 stderr 上浮）。

**Skills-missing gate（skills 缺失门控）**（runTask 第 2.5 步，`bin/utils/skills-probe.mjs` + `skills-probe.config.mjs`）：所有 mode（implement/task-review/fix）进入嵌套 CLI 前，按 harness 探测所需插件（`superpowers` + `mattpocock-skills` + `osuperpowers` + `osuperpowers-router`，配置驱动）：

| 通道 | Harnesses | 缺失行为 |
|------|-----------|----------|
| install-and-use | claude / cursor-agent / droid / grok / qoder / codex / gemini / pi | **exit 3** + stderr per-plugin install hint（不进入嵌套 CLI） |
| init | opencode / trae / vibe / kiro | stderr 提示 `init harness <name>`（非 exit 3），任务照跑 |

探测路径按 harness：plugin-list（claude/grok）、skill-dir（cursor-agent/droid/qoder/codex/gemini）、package-list（pi）。探测本身失败（CLI 查询错/无权限）→ **fail-open allow**（exit 0 + warn）。`skills-probe.config.mjs` 的 `harnesses` 集合 = 12 个，MUST 与 P6b §2.5 通道分类逐一一致。

**Post-run commit gate（运行后 commit 门控）**（Node 模块 `bin/engine/lib/contract.mjs` —— `validateCommitContract`，spec §4.2）：**implement** 与 **fix** mode 在返回时校验；**task-review** 为 no-op。信号是相对 workspace 解析出的仓库执行 `git status --porcelain` —— **工作树脏**（untracked 文件也算脏，D3b 严格性）会把 handoff 改写为 `status: BLOCKED`（`rewriteHandoffBlocked`）、向 stderr 打印 `CDD_BLOCKED:` 并以非零退出；随后 H1 读取改写后的 handoff（`h1FromHandoff`），因此即使 agent 上报 DONE，`status: BLOCKED` 仍会到达 orchestrator。

- **Fail-open（故障放行）：** 非 git workspace 或 `git` 出错 → 校验通过（返回 0）—— 门控绝不会因工具故障而拦截。
- **Precondition（前置条件）：** `.superpowers/cdd/` 已被 `*` gitignore（repo `.gitignore` 中的 `.superpowers` 一行），因此 workspace 本身永远不会触发脏检查。
- **Ordering（顺序，spec v3）：** commit-contract 校验在 H1 输出**之前**运行 —— H1 必须读取可能已被改写的 handoff，而不是 agent 的 stdout。

**Ledger：** orchestrator 在 handoff `APPROVED` 后追加 ledger 行。CLI 子进程**不**写 ledger。

## H7 — consumer-repo 内不放置 CLI 脚本

Orchestrator / skill **不得**在 consumer repo 中创建 `cdd-task*` 或 `scripts/cdd-*`。

所有 CLI 入口脚本都在 `packages/osuperpowers/bin/engine/`（`cdd-task.mjs` / `cdd-review.mjs` / `cdd-select.mjs` / `cdd-session-activate.mjs`）；模板在 `packages/osuperpowers/templates/cdd/`。版本随插件发布同步。`{plugin_root}` 经 `pluginRoot()`（`bin/gate/cdd-gate-core.mjs`）/ [cli-select](../skills/cli-select/SKILL.md) 解析。

## H8 — CLI opt-in / opt-out

**Opt-in（默认）：** 选定的 harness CLI 在 PATH 中且 registry 为 `ship: full` → CDD H6 三-mode 链为**强制**。

**Opt-out 优先级（高 → 低）：**

1. Orchestrator 显式 `--no-cli`
2. 环境变量 `CDD_NO_CLI=1`
3. （可选）项目 `.superpowers/cdd/config.json` 的 `"cli": false`

任一 opt-out 命中 → 回退 **p0** in-session 执行（Rule 5/6 + H1–H5）。

**Harness registry（harness 注册表）：** `{plugin_root}/bin/engine/harness-registry.json` 声明每 harness 的 `cli` / `invoke` / `output` / `task_review_prefix` / `ship`，engine 经 `{plugin_root}/bin/engine/cdd-task.mjs` 读取（不再有 per-harness 脚本）。

| Ship | Harnesses |
|------|-----------|
| **Full** | claude, cursor-agent, droid, pi |
| **Not-supported** | codex, copilot, gemini |

选定 not-supported harness → exit 1 → orchestrator **BLOCKED**（无 p0 fallback）。选定 harness 的 CLI 不在 PATH → exit 2 → orchestrator **BLOCKED**。

## CDD gate matrix

orchestrator 的 PreToolUse gate（Node 核心 `packages/osuperpowers/bin/gate/cdd-gate-core.mjs`，P4b 迁到 Node）在 task 激活期间阻止直接编辑 repo。判定是单一决策点 —— `gateDecide` 只解析一次 active workspace（先绑定 `pending.workspace`，仅在未绑定时才扫描 `findActiveWorkspace`），并把同一个 workspace 贯穿 phase 检查与 write 检查。

在 active task 解析完成之前，gate 是 fail-open 的（spec 安全属性 / data-flow 第 1 步）：

| Tool | 条件 | 决策 |
|------|-----------|----------|
| any | adapter 异常 —— adapter 捕获并返回 allow（stderr 被记录） | **allow**（fail-open） |
| any | 该 session 无 pending 文件 | **allow**（fail-open） |
| any | pending 过期（>24h）→ 清除 pending | **allow**（fail-open） |
| Write/Edit | 路径在 `active_ws` 下 | **allow** |
| Write/Edit | 路径在 `.superpowers/cdd/**` 下且 phase 为 `orchestrating` | **allow** |
| Write/Edit | phase 为 `inactive` / `task_complete` | **allow** |
| Write/Edit | 其他任何 repo 路径 | **deny** |
| Bash/Shell | allowlist（`cdd-task.mjs --harness <name>` / `task-brief` / `review-package`） | **allow** |
| Bash/Shell | 只读 git 动词（见下方 allowlist） | **allow** |
| Bash/Shell | 其他任何情况 —— 变更 git、`ls`/`echo`、heredoc 写入、复合命令 | **deny** |
| Bash/Shell | phase 为 `inactive` / `task_complete` | **allow** |
| 其他工具 | — | allow |

**Shell contract（shell 契约）：**

- 每个 phase 都允许只读 git 诊断：`git status` / `git diff` / `git log` / `git show` / `git rev-parse` / `git branch`（只读 flag 仅 `-a|-r|-v|--show-current`）/ `git remote`（仅只读 flag）/ `git ls-files` / `git diff-tree`。可接受形式：`git <verb> …`、`git -C <path> <verb> …`、`git --git-dir=<path> <verb> …`。其他任何情况 —— 复合命令（`` && | ; > < $( ` ``）、`git -C <path> -c k=v <verb>`、未知 flag、或 verb token 或 branch/remote 参数中带引号 —— 动词提取失败 → **deny**（fail-closed）。
- Repo 变更**只**经 H6 implement shell（`node {pluginRoot}/bin/engine/cdd-task.mjs --harness <name> --task N --mode implement`）或对已绑定 workspace 的 Write 进行 —— 绝不经 Bash（heredoc 会被拒绝）。
- 非 git 的只读命令（`ls`、`echo`、…）仍被有意拒绝（精简只读集合的决策；见 spec §Non-goals）。

**Anti-hijack（防劫持，stale workspace）：** task brief 仅在其 `TASK_BASE` 是真实 git 对象时才激活 —— `git -C <repo> cat-file -e <sha>`（与 CWD 无关）。Stub SHA（`TASK_BASE: abc`）绝不会激活 workspace。当 session 已绑定（`pending.workspace`）时，绑定的 workspace 优先，gate 绝不扫描无关的 workspace。

**Test override（测试覆盖）：** `CDD_GATE_FIXTURES_ROOT` 替换 `findActiveWorkspace` / `gateDecide` 中 `.superpowers/cdd` 的解析 —— Node gate 测试把它指向 `tests/fixtures/cdd-gate/` 的临时副本（已 git init，注入 brief `<SHA>` 占位符），绝不动真实树。见 `packages/osuperpowers/bin/gate/tests/cdd-gate-core.test.mjs`。
