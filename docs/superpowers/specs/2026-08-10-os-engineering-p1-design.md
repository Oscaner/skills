# os-engineering P1 阶段设计：插件骨架 + cli-* 家族

## Header

- **Version**: v1.0 · 2026-08-10
- **Status**: Approved
- **Author**: Oscaner Miao · Claude Code (Opus 4.8)
- **Parent program**: [os-engineering 整体设计 v1.4](2026-08-10-os-engineering-overall.md)
- **Depends on**: 无（首阶段）

## §0 Incremental warning

> P1 增量只涉及本阶段。跨阶段约定以 overall v1.4 为准；冲突时 overall 优先。

## §1 Constraints pointer

不重复 overall 约定。P1 生效的 cross-cutting 约束：

- sdd → cdd 全量更名（CDD_* env / cdd-common.sh / cdd-run.sh / .superpowers/cdd/ / cdd-reference.md / templates/cdd/）
- 规则命名：语义名 + 链接引用（`### Rule: <Name>`，无数字/子后缀）
- 过渡期 SDD 链必须持续可用（每个子任务结束 validate 通过）
- 命名：插件 `os-engineering`；技能前缀 `cli-*`；缩写 `cdd` = cli-driven-development

## §2 Design body

### 架构

新增独立插件 `plugins/os-engineering/`，从 superpowers-overrides 迁入并重组 CLI 引擎；overrides 保留编器（spor-sdd）与 gate（过渡期），spor-sdd 的 CLI 派发 retarget 到 os-engineering 的 `cdd-run.sh`。

```
plugins/os-engineering/
  .claude-plugin/plugin.json   # name: os-engineering, version: 0.1.0 (占位)
  skills/
    cli-select/SKILL.md
    cli-task/SKILL.md
    cli-driven-development/SKILL.md
    cli-code-review/SKILL.md
  bin/
    harness-registry.json
    cdd-run.sh
    cdd-select.sh
    lib/cdd-common.sh
  templates/cdd/
    implement.md  review.md  fix.md  _handoff-write-fragment.md
  docs/
    cdd-reference.md
    controller-handoff.md
    handoff-schema.md
  tests/
marketplace/source.json 注册（claude.category=engineering）
```

版本占位 `0.1.0`，不接 changeset / version-packages（P3 接）。

### 组件

#### A. harness registry（bin/harness-registry.json）

精简 schema，每 harness 一个条目：

```json
{
  "claude":       { "cli": "claude",       "invoke": "-p --output-format text --dangerously-skip-permissions", "output": "text",        "review_prefix": "Skill(mattpocock-skills:code-review)", "ship": "full" },
  "cursor-agent": { "cli": "cursor-agent", "invoke": "--print --output-format text --force",                     "output": "text",        "review_prefix": "",  "ship": "full" },
  "droid":        { "cli": "droid",        "invoke": "exec --auto medium --output-format stream-json",           "output": "stream-json", "review_prefix": "",  "ship": "full" },
  "pi":           { "cli": "pi",           "invoke": "-p --no-session --no-approve",                            "output": "text",        "review_prefix": "",  "ship": "full" },
  "codex":        { "cli": "codex",    "ship": "not-supported" },
  "copilot":      { "cli": "copilot",  "ship": "not-supported" },
  "gemini":       { "cli": "gemini",   "ship": "not-supported" }
}
```

- `cli`：二进制名（`command -v` 检测用）
- `invoke`：flags 前缀模板，prompt 追加为 `$1`（runner 拼成 `<cli> <invoke> "$prompt"`）；**review 模式拼装**：`"$review_prefix $prompt"` 作为单个带引号参数追加到 `<cli> <invoke>` 之后
- `output`：`text`（stdout 直接过 H1 grep）| `stream-json`（先 jq 提取 completion.finalText 再 H1 grep）
- `review_prefix`：review 模式注入的 `Skill(...)` 前缀（仅 claude 有；droid/pi/cursor 为空，同 cursor 的 D3a 分歧）
- `ship`：`full`（可用）| `not-supported`（**registry 条目仅用于 cli-select 提示「已安装但不受支持」，无 stub 脚本、不可调用**）

#### B. cdd-common.sh（改名自 sdd-common.sh）+ cdd-run.sh

- `SDD_*` env → `CDD_*`（`CDD_WORKSPACE`/`CDD_LEDGER`/`CDD_MODE`/`CDD_TASK_BRIEF`/`CDD_HANDOFF_PATH`/`CDD_PLAN_CONSTRAINTS`/`CDD_FINDINGS`/`CDD_REVIEW_FIXED_POINT`，**全量枚举含** `SDD_MODE_ARG`/`SDD_BLOCKED_REASON`/`SDD_HANDOFF_UNWRITABLE`）；`SDD_DRY_RUN` → `CDD_DRY_RUN`；stderr 标记 `SDD_BLOCKED:`/`SDD_CLI_MISSING:`/`SDD_HARNESS_STUB:` → `CDD_` 前缀；`SDD_GATE_FIXTURES_ROOT` 留 overrides（gate 过渡期）
- 函数改名：`sdd_run_task` → `cdd_run_task`、`sdd_run_plan` → `cdd_run_plan`、`sdd_require_env` → `cdd_require_env`、`sdd_check_cli` → `cdd_check_cli` —— **改名覆盖 cdd-common.sh 全量 `sdd_*`/`_sdd_*` 函数（含 `_sdd_template_value`/`_sdd_emit_h1_*`/`_sdd_plan_from_ledger` 等读取 `SDD_*` 的 reader）**，验收以「零 sdd_* / SDD_* 标识残留」grep 断言
- `_sdd_invoke_cli` 改为由 registry 驱动：`_cdd_invoke_cli` 读 `harness-registry.json`（jq）拼命令并归一化输出：
  - `output=text` → stdout 透传
  - `output=stream-json` → `jq -r 'select(.type=="completion") | .finalText' | tail -1`（**取最后一个 completion 事件**，避免多 completion 拼接歧义；droid-example 可借鉴点），空 → BLOCKED
- `sdd_run_task` 签名从 `(cli_bin review_prefix task_num)` 改为 `(harness task_num)`：cli_bin / invoke / output / review_prefix 全从 registry 取
- `sdd_run_plan` 签名从 `(plan task_script cli_bin label)` 改为 `(plan harness)`
- workspace resolver：内联 `cdd_resolve_workspace`（slug 推导 + `mkdir -p` + 写 `.superpowers/cdd/.gitignore` + 打印路径），**不再调用上游 `sdd-workspace`**；上游 `task-brief` / `review-package` 以显式输出路径指向 `.superpowers/cdd/<plan>/` 调用
- 退出码保留：0 OK / 1 BLOCKED / 2 CLI missing
- `cdd-run.sh` 入口：Mode A `--harness <name> --task N --mode implement|review|fix [--plan PATH]`；Mode B `--harness <name> --plan PATH`；**入口判别规则**：存在 `--task N` 即 Mode A（`--plan` 可选），否则存在 `--plan` 即 Mode B（`--plan` 必选），两者皆无 → usage exit 2
- 语义规则名（cli-driven-development SKILL.md）：`### Rule: <Name>`，如 Rule: Harness Selection / Rule: Three-Mode Chain / Rule: Handoff Contract / Rule: Commit Gate / Rule: Ledger

#### C. cdd-select.sh + cli-select 技能

- `cdd-select.sh`：遍历 registry 全部条目 → `command -v <cli>` → stdout 输出 `available: <csv>`（ship=full 且已装）+ `unsupported_installed: <csv>`（ship=not-supported 但已装，提示性，不参与推荐）+ `recommended: <name>`
- 当前 harness 检测（env 信号）：claude → `CLAUDE_CODE_SESSION_ID` 或 `AI_AGENT=claude-code*`；cursor → `CURSOR_TRACE_ID`
- 推荐逻辑：droid 在 → droid；否则 pi 在 → pi；否则当前 harness（若是 full 条目）；**当前 harness 非 full 条目或未检测到 → 跳过回退**，有 full 安装 → 推荐第一个可用（注册顺序）；无 full 安装 → BLOCKED
- `cli-select` 技能：调 `cdd-select.sh` → AskUserQuestion 列出可用项并标注推荐 → 返回所选 harness；调用方显式传 `--harness <name>`

#### D. cli-task 技能

- 一次性：`cli-task <prompt>` → 经 cli-select 选 harness → 选定 CLI print 模式 → 返回最终输出（H1 或 final text）
- `--loop`：同一 base prompt 迭代；**每轮 prompt = base prompt + `[Iteration N — previous result: <上一轮 final text>]`**（回喂上一轮输出作为变化量，避免无状态 print CLI 每轮输出相同）；输出含 sentinel（默认 `<promise>NO MORE TASKS</promise>`，`--sentinel` 可改）或达 `--max`（默认 20）则停
- brief 路径：用户提供 brief 路径 → 走 handoff 契约（单任务）；**模式（implement/review/fix）由用户指定，默认 implement；用户 brief 即 task brief（cli-task 不做 transform）**
- 复用 cdd 引擎（registry + runner），无 ledger/plan 编器职责

#### E. cli-driven-development 技能（引擎模式）

- 文档化并驱动：harness 选择（cli-select）、三模式链（implement/review/fix）、handoff 契约、commit gate、ledger（Mode B plan driver）
- **不装编器 Rules 1-8**（任务分类/fix loop/质量门/D6 聚合留在 spor-sdd，P2 移 os-executing-plans）

#### F. cli-code-review 技能

- 独立任意 diff 评审：`cli-code-review <base>..<head>`（或当前分支 vs origin/main）→ 经 cli-select 选 harness → code-review 模板 → findings 报告
- 与 cdd 链内 review 模式区分：cli-code-review 可评任意 diff，不限于计划内任务

#### G. 过渡耦合（overrides 侧）

- **gate 留在 overrides**：`bin/lib/sdd-orchestrator-gate.sh` → `bin/lib/cdd-orchestrator-gate.sh`、`bin/sdd-session-activate.sh` → `bin/cdd-session-activate.sh`、adapters（override-claude/cursor-sdd-gate.sh）同步改 lib 引用；workspace 扫描路径 `.superpowers/sdd/` → `.superpowers/cdd/`；**不迁移到 os-engineering**（随编器 P2/P3 迁，hooks 不跨插件）
- **spor-sdd retarget**：Rule 7 派发改为**完整命令转发** —— 任务路径 `{os-engineering}/bin/cdd-run.sh --harness <name> --task N --mode implement|review|fix [--plan PATH]`；计划驱动路径（旧 `sdd-run-plan-<harness>.sh` 派发）`cdd-run.sh --harness <name> --plan PATH`；编器 Rules 1-8 内容不变
- **gate 两层机制澄清**：orchestrator-gate（overrides，会话期 PreToolUse 前置门）与 cdd 引擎内 commit gate（后置校验）是**两层不同机制** —— orchestrator-gate 过渡期留 overrides（P1），commit gate 随引擎迁 os-engineering；两者独立作用于不同阶段，不与 cdd-run.sh 调用耦合
- **templates**：迁入 os-engineering `templates/cdd/`，`{{PLACEHOLDER}}` token 保留，env 改 `CDD_*`；`_handoff-write-fragment.md` 同迁
- **docs**：`docs/sdd-h6-reference.md` → os-engineering `docs/cdd-reference.md`（harness 映射表改 registry + cdd-run.sh；H6/H7/H8 语义保留）；`spor-token-efficient-controller-handoff` H1-H5 → `docs/controller-handoff.md`；`spor-handoff-writer` → `docs/handoff-schema.md`
- **rule-reference.test.py**：双模式共享（数字 `Rule N` 过渡期 + 语义 `Rule: Name`），迁至 os-engineering，同时校验 overrides + os-engineering 技能；cross-ref 用 markdown 链接 `[Rule: <Name>](../x/SKILL.md#rule-<kebab>)`
- **validate-overrides-build.sh**：删「10 harness 脚本存在」断言，加「registry 存在 + schema 合法 + cdd-run.sh 可执行」断言
- **测试迁移**：引擎测试（sdd-cli-dry-run-smoke → cdd 版、sdd-commit-gate-smoke、sdd-common-functions、sdd-severity-contract 的模板部分）随引擎迁 os-engineering；gate/hook 测试（sdd-gate-allow-deny-smoke、override-*-gate.test.sh、override-cursor-detect/enforce、override-prompt-expansion、trigger-patterns、manifest-harness、line-budget）留 overrides
- **ci-validate.sh**：新增 os-engineering 步骤（plugin.json / skills / registry schema / cdd tests）；overrides 步骤保留（gate + hook 测试）

### 数据流

```
spor-sdd (编器) → cli-select 询问 (选 harness)
  → cdd-run.sh --harness <name> --task N --mode implement|review|fix
  → registry 拼命令 → CLI 子进程 (claude/droid/pi/cursor-agent)
  → 输出归一化 (text 透传 / stream-json → finalText)
  → H1 四行 → commit gate → handoff.json → ledger
```

### 错误处理

| 场景 | 行为 |
|------|------|
| 选定 harness CLI 不在 PATH | `cdd_check_cli` exit 2 → orchestrator BLOCKED |
| 指定 not-supported harness | cdd-run.sh BLOCKED（exit 1），报 not-supported 名称 |
| 无 full harness 安装 | cdd-select BLOCKED，报缺失清单 |
| stream-json 无 completion 事件 | BLOCKED + 报 raw 前几行 |
| 工作区脏树返回 | commit gate 重写 handoff `BLOCKED` + 非零退出 |
| registry 缺失/非法 | cdd-run.sh BLOCKED + 报解析错误 |

### 测试

- registry schema 校验测试（字段合法、ship 值域、**full 条目必有完整 invoke、not-supported 条目豁免 invoke**）
- cdd-run.sh dry-run smoke（`CDD_DRY_RUN=1` 跳过真实 CLI）
- commit gate smoke（脏/净树）
- cdd-select 检测 + 推荐测试（mock PATH）
- rule-reference 双模式自测（数字 + 语义）
- `pnpm run validate` ALL PASS

### 验收标准

- [ ] `plugins/os-engineering/` 结构完整，`.claude-plugin/plugin.json` 可解析，skills 全解析
- [ ] `harness-registry.json` 含 7 条目（4 full + 3 not-supported），schema 校验通过
- [ ] `cdd-run.sh` Mode A/B 从 registry 拼命令、按 output 归一化、exit 0/1/2 正确
- [ ] 4 个 cli-* SKILL.md 存在，语义规则名 + 链接引用通过 rule-reference 校验
- [ ] `cdd-select.sh` 正确检测 installed full harness + 推荐（droid>pi>当前）
- [ ] overrides 的 spor-sdd retarget 到 `cdd-run.sh --harness`；gate 内部改名 + `.superpowers/cdd/`
- [ ] overrides bin/ 下 10 个 per-harness 包装/stub 脚本（`sdd-run-task-{claude,cursor,codex,copilot,gemini}.sh` + `sdd-run-plan-{同}.sh`）**已物理删除**
- [ ] 迁移后的 cdd-common.sh / cdd-run.sh / cdd-select.sh / templates / cdd-reference.md 中**零 `sdd_*` / `SDD_*` / `sdd-run-` 标识残留**（grep 断言）
- [ ] templates / cdd-reference.md / controller-handoff.md / handoff-schema.md 迁移完成，`CDD_*` env
- [ ] rule-reference.test.py 双模式，同时校验两插件
- [ ] validate-overrides-build.sh 更新（删 10-script 断言、加 registry/cdd-run 断言）
- [ ] `pnpm run validate` ALL PASS
- [ ] 4 个 cli-* 技能可被 Claude Code 解析（plugin 已注册 marketplace）

## §3 Deviations from overall

| Overall 假设 | 阶段决定 | Overall 已更新? |
|---|---|---|
| gate 改名在 P1 | gate 不仅改名还明确**留在 overrides**（不迁），随编器 P2/P3 迁 | 是（v1.4 约束「gate 模式感知 P2」；迁移时机为阶段细化，不冲突） |

## §4 Notes for downstream（P2/P3）

- P2：gate 随编器迁至 os-engineering + 模式感知；os-* 家族引用 cli-* 技能；编器 Rules 1-8 从 spor-sdd 移入 os-executing-plans
- P3：os-engineering 完整版本化（changeset + version-packages 扩展）；overrides 薄封装；rule-reference 数字模式失效

## §5 Review

Rule 1 passes（Completeness → Consistency & scope → Clarity & YAGNI）before user review and writing-plans。
