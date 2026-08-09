# SDD 语义守卫 — Rule 0 checklist 锚点 + Rule N 交叉引用校验

- **Version**: v1.0 · 2026-08-09
- **Status**: Draft
- **Author**: oscaner · Claude
- **Issue**: [Oscaner/skills#52](https://github.com/Oscaner/skills/issues/52)
- **Scope**: `plugins/superpowers-overrides` 测试链 + SDD skill 文件 + 相关文档

## §1 Problem

`plugins/superpowers-overrides` 的 SDD 技能链有两个「只能靠 review 发现、CI 不拦」的回归缺口：

1. **Rule 0 checklist 语义守卫缺失**。`sdd-orchestrator-line-budget.test.sh` 只统计行数，不验证 Rule 0 三阶段 checklist（Setup / Per-task / Final + H6 chain + no-in-session 不变式）的结构是否在瘦身中存活。`p1-slim.3` 期间 Task 3 实现（`ca3aaa1`）曾把三阶段 checklist 压成单行，靠 review 拦下后由 `7fc1864` 恢复 —— 没有任何自动化守卫。
2. **标题改名后交叉引用悬空**。`Rule 0a → Rule 0` 改名（`7c1a7b8`）后，4 个文件遗留 ~8 处对已退役 `Rule 0a` / `Rule 0b` ID 的引用，CI 不拦，review 只以 WARN 捕捉；其中 `spor-SDD` L95 Red Flag 标签至今仍是陈旧的 `Rule 0a`。

## Goal

为上述两类失败模式各加一个自动化守卫，使它们被 CI 捕获而非 review：

1. **Guard 1（checklist 语义锚点）**：line-budget 测试断言 Rule 0 三阶段标记 + 关键 token 存活。
2. **Guard 2（交叉引用 resolver）**：全插件扫描，任何 `Rule N` 正文引用要么解析到标题，要么在显式 allowlist 中，否则 FAIL。
3. 作为 Guard 2 通过的先决条件，修掉现有 ~8 处陈旧引用 + 3 处 exit-2 文档漂移，并让 `spor-sdd-p0-fallback` 明确标记为 dormant。

## Constraints

- **不改** line-budget 测试的既有 AC#（AC#1 p0-fallback 存在 + Rule 3 锚点、AC#2 H6 表格、Task 4 D3/D6 断言）。
- **不改** p1-slim.3 AC#9：`spor-sdd-p0-fallback` 保留在磁盘、不进 `overrides.manifest.json` targets。
- **不删** p0-fallback 文件（保留为 p0 参考）。
- **不新增** override slash target。
- 锚点断言限定在 Rule 0 块内（`sed` 提取），避免 token 在别处出现造成假通过。
- Guard 2 扫描 `skills/*/SKILL.md`（含 frontmatter `description:`）；`docs/` 参考文档不扫（用 `§`/H 编号体系，非 `Rule N` 形态）。

## Design

### 2.1 Guard 1 — Rule 0 checklist 语义锚点

**位置**：追加进 `tests/sdd-orchestrator-line-budget.test.sh` 末尾（新 AC# 块）。

**作用域**：`sed -n '/^### Rule 0 /,/^### Rule 1/p' "$SKILLS/spor-subagent-driven-development/SKILL.md"` 提取 Rule 0 块。

**锚点集合**（约 13 个，全部 `grep -qF`）：

| 类别 | 锚点 |
|------|------|
| 三阶段标记 | `**Setup (once):**`、`**Per-task:**`、`**Final:**`（各自成行） |
| Setup 内容 | `sdd-workspace`、`plan-constraints.md`、`ledger` |
| Per-task 内容 | `TASK_BASE`、`H6 chain`、`implement`、`review`、`handoff.json`、`APPROVED`、`Rule 5a`、`Rule 6` |
| 无会话内改仓库不变式 | `**Never** edit repo deliverables`、`H6 CLI only` |
| Final | `requesting-code-review`、`finishing-a-development-branch` |

`ca3aaa1` 式单行压缩同时失去三个独立成行的 phase 标记与大部分 token → FAIL。

**明确不锚**：`Shell 契約：` 块（gate-matrix 指针，非 issue 所述三阶段）；`pre-flight`（太容易被合理改写删掉）。

### 2.2 Guard 2 — 交叉引用 resolver

**新文件** `tests/rule-reference.test.py`（Python，先例 `manifest-harness.test.py` / `trigger-patterns.test.py`）。

**算法**：

1. **建索引**：对每个 override skill，`^#{3,4} (Rule [A-Za-z0-9]+)` 提取标题 ID；正则也处理复数形式 `Rules N, M, K`。
2. **提取正文引用**：`\bRule [A-Za-z0-9]+`，去掉标题行后扫 body + frontmatter。
3. **逐条解析**，顺序：
   - 同文件标题 → OK；
   - 恰好一个其他文件拥有该 ID（唯一跨文件）→ OK（如 executing-plans `Rule 5b` → p0-fallback；controller-handoff `Rule 7` → spor-SDD）；
   - 外部 allowlist（按文件列，注明目标）→ OK；
   - 否则 **FAIL**，输出 文件 + 行 + 引用。

**allowlist 全集**（修复陈旧引用后，其余全部为 upstream/to-tickets 外部引用）：

| 文件 | allowlist 条目 | 目标 |
|------|---------------|------|
| spor-brainstorming | Rule 4, 5 | upstream `superpowers:brainstorming` |
| spor-executing-plans | Rule 4, 5 | upstream executing-plans |
| spor-finishing-a-development-branch | Rule 4, 5 | upstream |
| spor-receiving-code-review | Rule 3, 4 | upstream |
| spor-subagent-lifecycle | Rule 4 | upstream |
| spor-systematic-debugging | Rule 3, 4 | upstream |
| spor-test-driven-development | Rule 3, 4 | upstream |
| spor-using-git-worktrees | Rule 3, 4 | upstream |
| spor-verification-before-completion | Rule 3, 4 | upstream |
| spor-writing-plans | Rule 3a, 3b, 3c + Rule 4, 5 | upstream writing-plans + `to-tickets` 步骤 |

**自检**：测试末尾内嵌 fixture —— 构造含悬空引用的临时文件，断言 resolver 报 FAIL，证明守卫有效（dogfood）。

### 2.3 前置修复（Guard 2 通过的先决条件）

新 resolver 会在现有 ~8 处陈旧引用上立即 FAIL，故本次一并修复（修复 = Guard 2 通过，不对陈旧引用做 allowlist 兜底）：

**1. 机械改名 `Rule 0a → Rule 0`（2 处）**
- `skills/spor-subagent-driven-development/SKILL.md:95` — Red Flag 标签 → `Rule 0`
- `skills/spor-executing-plans/SKILL.md:28` — `SDD Rule 0a` → `SDD Rule 0`（`Rule 5b (p0)` 保留，唯一跨文件解析）

**2. review-dispatch 一处**（`skills/spor-token-efficient-review-dispatch/SKILL.md:51`）
- `(Rule 0b)` → `(p0 path)`，去掉对已删除 Rule 0b 的引用

**3. p0-fallback 休眠化**（`skills/spor-sdd-p0-fallback/SKILL.md`，4 处）
- frontmatter description：`Read only when spor-SDD Rule 0b triggers` → `dormant since CLI-mandatory (7c1a7b8); retained as p0 reference`
- Rule 3 内 `When Rule 0a applies, skip this rule` → `When Rule 0 applies (CLI default), skip — templates/sdd-cli is SOT`（`Rule 0` 唯一跨文件解析）
- Rule 5b 内同样 → `When Rule 0 applies (CLI default), skip`
- Rule 5c 内同样 → `When Rule 0 applies (CLI default), skip`
- Rule 3 内 `Rule 0b / p0 path` 措辞 → `p0 path`

**4. exit-2 文档漂移（3 处）** — CHANGELOG 已声明 CLI-mandatory，权威行为是 BLOCKED：
- `docs/sdd-h6-reference.md:110` — `exit 2 → p0 fallback` → `exit 2 → orchestrator BLOCKED`
- `README.md:119`、`README.zh-CN.md:118` — 同样 → BLOCKED

**不动**：p0-fallback 文件本身、line-budget 测试 AC#1 的 p0-fallback 断言。

### 2.4 接线与文档注记

- Guard 1 → `tests/sdd-orchestrator-line-budget.test.sh` 末尾新 AC# 块。
- Guard 2 → `tests/rule-reference.test.py`，在 `tests/validate-overrides-build.sh` 的 line-budget 调用后加一行挂载。
- 两者经 `pnpm run validate` → `scripts/ci-validate.sh` → CI（PR 到 develop/main 均触发）。
- **文档注记**（issue 建议 #3）：`docs/sdd-h6-reference.md` 顶部加一句 —— Rule 0 checklist 项是语义契约，不是 line-budget 瘦身目标；瘦身不得删除/压缩 phase 或关键 token；`sdd-orchestrator-line-budget.test.sh` 会断言。

## §3 Acceptance criteria

1. `pnpm run validate` exit 0（含新 resolver 与 Guard 1）。
2. Guard 1 负例：临时删除任一 phase 标记 → line-budget 测试 FAIL。
3. Guard 2 负例：resolver 自带悬空引用 fixture → 断言 FAIL。
4. 重跑陈旧引用扫描：dangling 只剩 allowlist 覆盖的 upstream/to-tickets 条目，`Rule 0a` / `Rule 0b` 全部清零。
5. `spor-sdd-p0-fallback` 仍在磁盘、仍不在 `overrides.manifest.json` targets[]，frontmatter 标注 dormant。
6. 三处 exit-2 文档与 spor-SDD Rule 7 一致（BLOCKED）。
7. `pnpm run validate:overrides` + `./plugins/superpowers-overrides/tests/validate-overrides-build.sh` 通过。

## §4 Non-goals

- 删除 `spor-sdd-p0-fallback`（p1-slim.3 AC#9 保留）。
- 扫描 `docs/` 参考文档的 `Rule N` 引用（`§`/H 编号体系不适用）。
- 重写合法裸引用为强制 Markdown 链接（resolver 用「同文件优先 + 唯一跨文件 + allowlist」覆盖）。
- 给陈旧引用做 allowlist 兜底（那是文档 bug，应修复而非豁免）。

## §5 Grilling record

| # | 决策 | 选择 |
|---|------|------|
| 1 | 修复范围 | 两个缺口都覆盖（checklist 守卫 + 交叉引用 resolver） |
| 2 | checklist 守卫机制 | 子串 / 标题断言（非 golden hash、非仅文档） |
| 3 | 交叉引用守卫机制 | 全插件 resolver（heading 索引 + 跨文件解析 + allowlist） |
| 4 | 测试落位 | 拆分 — 锚点进 line-budget 测试；resolver 独立 `rule-reference.test.py` |
| 5 | 锚点深度 | 三阶段标记 + ~13 个关键 token（非仅标记、非全量枚举） |
| 6 | 陈旧引用修复 | 全修 + p0-fallback 休眠化 + exit-2 漂移一并修正 |
| 7 | resolver 裸引用策略 | 同文件优先；唯一跨文件 OK；碰撞 ID 需同文件或 allowlist |
| 8 | env-unset 锚点 | 对齐现有 checklist（`unset SDD_` 视为举例，不加新步骤） |

用户设计批准：2026-08-09（第 1–4 节逐节确认）。
