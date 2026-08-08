# SDD H6 CLI 冷启动优化设计

> fixes [#88](https://github.com/Oscaner/skills/issues/88)
>
> 决策记录：见 `## Change History`

## 1. 问题

SDD CLI 执行中每个 task 的每个 mode（implement / handoff / review / fix）都是独立 `claude -p` 调用。每次 `-p` 冷启动加载完整 system context（`~/.claude/CLAUDE.md`、项目 `CLAUDE.md`、插件 marketplace + 60+ skills frontmatter、session 相关 skill 正文、PreToolUse hook），任务 prompt 仅 ~36 lines (~200 tokens)。实际工作远小于 system context。

**最简单任务（改 1 行注释）也需 4 mode × N task 次完整进程启动。**

## 2. 设计目标

| 目标 | 描述 |
|------|------|
| 首要 | **降低 token 总消耗** — 减少 `claude -p` 冷启动次数 |
| 次要 | 伴随降低 wall-clock 耗时 |
| 不变量 | implementer 不能 self-review（review 仍是独立 `claude -p`） |
| 范围 | Claude + Cursor harness（full）；stub harness 不变 |

## 3. 核心决策

### D1 — 破坏性 mode 合并

删除独立 `--mode handoff`。handoff 是机械操作（读已有文件 → 按 schema 写 JSON），不需要独立判断。内联到其上游 mode 的末尾：

```
旧链 (每 task 4–8 进程):
  claude -p implement → claude -p handoff(i) → review-package(shell) → claude -p review → claude -p handoff(r) → [claude -p fix → claude -p review → claude -p handoff(f)]

新链 (每 task 2–4 进程):
  claude -p implement+h(i) → review-package(shell) → claude -p review+h(r) → [claude -p fix+h(f) → review-package(shell) → claude -p review+h(rr)]
```

> **Note:** review-package 位置不变——仍然在 implement 完成后、review 启动前由 shell 侧执行（生成 diff archive），不在 `claude -p` 内部。


- 优化：每 task 最少 4 → 2 进程（-50%），含 fix 8 → 4 进程（-50%）
- 质量门保持：implementer 不能 self-review
- review-package 保持在 shell 侧（不消耗 LLM token），fail fast

### D2 — handoff write 模板内联

handoff-writer 逻辑直接写入 implement/review/fix 模板 Instructions 尾部，引用共享 `_handoff-write-fragment.md` 片段。

- handoff-writer SKILL.md **保持**作为 schema reference doc
- `templates/sdd-handoff-schema.md` 保持作为 schema SOT
- handoff-writer SKILL.md frontmatter description 降级注明 "reference doc, no longer independently dispatched"

### D3 — shell 侧直接删除 handoff mode

`--mode handoff` 和 `--segment` 参数删除。传入时报错退出。

- `sdd_assert_handoff` 函数删除（验证逻辑在 implement 模板内自检 `jq .` + 必填 key 检查）
- `SDD_HANDOFF_SEGMENT` 废弃（env var 层面：`sdd-common.sh` 不再验证）
- orchestrator gate 不变（`*sdd-run-task-*` 仍匹配所有 task script）

### D4 — handoff-writer dispatch template 删除

- `templates/sdd-handoff-writer-prompt.md` 删除
- spor-SDD Rule 0 checklist 从 `implement → handoff/implement → review → handoff/review` 改为 `implement → review`

### D5 — 测试策略

复用 gate test fixture 模式（git-init'ed 临时目录 + stub 文件 + 占位 SHA 注入），新增 dry-run 冒烟测试覆盖：

- implement/review/fix mode H1 输出验证
- handoff mode 拒绝验证
- handoff.json 写入验证

## 4. 技术设计

### 4.1 模式映射

| 旧 Mode | 新 Mode | 内部包含 |
|----------|---------|----------|
| `implement` | `implement` | implement + handoff write |
| `handoff --segment implement` | **删除** | — |
| `review` | `review` | code-review + handoff write |
| `handoff --segment review` | **删除** | — |
| `fix` | `fix` | fix + handoff write |
| `handoff --segment fix` | **删除** | — |

### 4.2 `_handoff-write-fragment.md` 内容

```markdown
## Handoff write

Write/update handoff per `templates/sdd-handoff-schema.md` from file paths only (per [`spor-token-efficient-controller-handoff`](../plugins/superpowers-overrides/skills/spor-token-efficient-controller-handoff/SKILL.md) H1–H2 file-only discipline).

### Segment: implement

1. Read `{{WORKSPACE}}/task-{{TASK}}-test-evidence.json` for test_evidence fields (omit `behavior_change` in handoff).
2. Gate: complexity Complex or `behavior_change: true` → require `command`, `passed`, `exit_code`; missing → blocker finding. Simple → WARN finding on missing fields (non-blocker).
3. Set `status: DONE` on success (blocker finding → `status: BLOCKED`).

### Segment: review

1. Read existing handoff.json + axis report files (`task-N-review-standards.md`, `task-N-review-spec.md`).
2. Parse `## Findings (D3)` JSON block (`{"findings": [...]}`) from each axis; merge into handoff `findings[]`.
3. Scan report text for "cannot verify" / "unverifiable" → `unverifiable[]`. Non-empty → `status: BLOCKED`.
4. Deliberate plan/brief violations → `plan_conflicts[]` (orchestrator STOPs).
5. Empty findings → `status: APPROVED`; non-empty → `status: CHANGES_REQUESTED`.
6. On **CHANGES_REQUESTED**: also write open-findings JSON beside handoff (same stem, `-open-findings.json`).

### Segment: fix

1. Read existing handoff.json + open-findings.json.
2. Update findings per resolved issues.
3. Update status per fix outcome.

### Self-validate

Run before returning H1 contract: `jq . {{HANDOFF}}` then check required keys (status, commits.base, commits.head) are non-null. On failure → `status: BLOCKED` with blocker line describing the validation error.

### Atomicity

Implement+handoff runs in a single `claude -p` process: if implement succeeds but handoff write fails, the H1 contract returns `status: BLOCKED`. The orchestrator's retry re-runs the entire implement+handoff mode — the implementer should be idempotent (committed changes are re-applied safely by TDD).

> `{{HANDOFF}}`, `{{WORKSPACE}}`, `{{TASK}}` template variables: the handoff-write fragment is included inline into each enclosing template (implement/review/fix.md), which already define these variables through their own `sdd_template_var` calls. The fragment itself does not need separate variable handling — it inherits the parent template's expansion scope.
```

### 4.3 CLI 脚本变更点

#### `sdd-run-task-claude.sh`

- 删除：`--segment` 解析、`SDD_SEGMENT`、`_sdd_claude_skill_prefix`、handoff `sdd_assert_handoff`
- `usage()`: `implement|review|fix`（无 handoff）
- `_sdd_claude_prepare_prompt`: 仅 review → `Skill(mattpocock-skills:code-review)`
- handoff mode 接收 → 报错退出 `"handoff mode removed: handoff write is now inline"`
- 不变：review-package shell 调用、`_sdd_emit_h1_four_lines`

#### `sdd-run-task-cursor.sh`

与 claude.sh 完全相同的变更集。

#### `sdd-run-plan-claude.sh` / `sdd-run-plan-cursor.sh`

`_run_task_chain` 简化：

```
旧: implement → handoff implement → review → handoff review → [fix → review → handoff fix]
新: implement → review → [fix → review]
```

handoff status 读取（`_handoff_status`）逻辑保持——现在 implement 完成后直接读 handoff.json（mode 内联写了）。

#### `sdd-common.sh`

- 删除 `sdd_assert_handoff` 函数
- `sdd_require_env`: 删除 `handoff)` case 的 `SDD_HANDOFF_SEGMENT` 验证
- mode valid set: `implement|review|fix`
- `sdd_template_var`: 删除 `HANDOFF)` / `SEGMENT)` cases

#### 6 个 stub scripts（codex/copilot/gemini task + plan）

无代码变更。纯 stub（`sdd_stderr_harness_stub` + `sdd_exit_blocked`）。

### 4.4 受影响文件的增删改汇总（20 个文件）

**Shell 脚本（5 个变更）：**
```
bin/sdd-run-task-claude.sh           MODIFY — 删除 handoff mode/--segment/skill prefix
bin/sdd-run-task-cursor.sh           MODIFY — 同上
bin/sdd-common.sh                    MODIFY — 删除 sdd_assert_handoff、handoff segment 验证、mode set 更新
bin/sdd-run-plan-claude.sh           MODIFY — 4-mode 链缩为 2-mode 链
bin/sdd-run-plan-cursor.sh           MODIFY — 同上
bin/sdd-run-task-codex.sh            NO CHANGE — stub
bin/sdd-run-task-copilot.sh          NO CHANGE — stub
bin/sdd-run-task-gemini.sh           NO CHANGE — stub
bin/sdd-run-plan-codex.sh            NO CHANGE — stub
bin/sdd-run-plan-copilot.sh          NO CHANGE — stub
bin/sdd-run-plan-gemini.sh           NO CHANGE — stub
```

**模板（5 个变更）：**
```
templates/sdd-cli/handoff.md             DELETE
templates/sdd-cli/_handoff-write-fragment.md  NEW
templates/sdd-cli/implement.md           MODIFY — Step 6 "Write handoff"
templates/sdd-cli/review.md              MODIFY — Step 5 "Write handoff" + review segment parsing
templates/sdd-cli/fix.md                 MODIFY — Step 5 "Write handoff" + fix segment
templates/sdd-handoff-writer-prompt.md   DELETE
templates/sdd-handoff-schema.md          NO CHANGE — schema SOT
```

**技能文件（4 个变更）：**
```
skills/spor-handoff-writer/SKILL.md                      MODIFY — 降级 schema reference
skills/spor-subagent-driven-development/SKILL.md         MODIFY — Rule 0/1/2/4/7
skills/spor-sdd-p0-fallback/SKILL.md                     MODIFY — Rule 5c/D4
skills/spor-token-efficient-controller-handoff/SKILL.md  MODIFY — H5
```

**文档（3 个变更）：**
```
docs/sdd-h6-reference.md           MODIFY — H6 table 4→3 mode，shell 序列更新
docs/cross-harness-overrides.md    MODIFY — mode 列表、模板表更新
README.md / README.zh-CN.md        MODIFY — mode 列表、handoff-writer 注记
```

**测试（1 个新增）：**
```
tests/sdd-run-task-claude-dry-run.sh  NEW — implement/review/fix dry-run + handoff 拒绝
```

**不变（2 个）：**
```
build/generated/*                  NO CHANGE — manifest 不变
.claude-plugin/plugin.json         NO CHANGE — skills[] 不变
```

## 5. Non-goals

- Daemon / background agent 模式 — 架构改动过大，p1 的核心约束仍然是独立的 `claude -p` 调用，本次只减少调用次数而非改变调用模型。该方向单独评估
- `--no-session-persistence` 调优 — 属于 Claude Code 平台优化，不在本次 scope
- 轻量 implement 模板 — 模板体积不是问题根因；SDD quality gate（TDD + report）应在 implement 模板保留
- Review mode claude `-p` 内部展开多个 subagent 调用的 token 优化 — 属于 code-review skill 层面
- `spor-executing-plans/SKILL.md` — 不引用 handoff mode/segment

## 6. Risks

| Risk | Mitigation |
|------|-----------|
| orchestrator gate 的 allowlist 依赖 mode 名称 | allowlist 是 `*sdd-run-task-*` 通配，不依赖具体 mode |
| p0 fallback 路径的 handoff dispatch 仍在 Rule 5c/D4 中 | Rule 5c/D4 同步更新为 "handoff write is inline in implement/review/fix" |
| handoff 写入质量下降（没有独立 process 的 context 隔离） | implement/review/fix 的 H4 fix loop + re-review 不变——错误会被 review 发现；schema self-validate 提供机械层保障 |
| Mode B (plan script) 依赖 `_handoff_status` 判断 APPROVED | 函数不变——implement mode 内联写了 handoff.json，plan script 读到的 JSON 结构不变 |

## 7. Change History

| Version | Date | Change |
|---------|------|--------|
| v1.0 | 2026-08-08 | Initial spec |
