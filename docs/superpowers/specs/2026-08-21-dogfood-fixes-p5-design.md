# Dogfood 修复 P5 — 设计规格（三技能收敛 + branch-review CLI）

- **Version**: v1.0 · 2026-08-24
- **Status**: Approved（brainstorming 设计已确认，待 3-pass Spec Review via CLI + 用户审）
- **Author**: Oscaner Miao · Claude Opus 4.8 (1M context)
- **上游宪章**: [dogfood-fixes-overall.md v2.1](2026-08-21-dogfood-fixes-overall.md)（P5 破坏性授权见其 §1 例外条款）
- **语言策略**: Strategy B（specs/ 中文，无镜像）

---

## Section 0：本文件范围

本文件为 P5 的实施设计规格，不含跨相程序编排。P5 依赖 overall spec v2.1 的全局破坏性授权（B）：可对 CDD 引擎重构、可引入破坏性更新，覆盖整个 dogfood 程序。本文件所有改动须 `pnpm run validate` 全绿并独立 changeset（破坏性，major）。

---

## Section 1：背景与动机

### 1.1 现状盘点

dogfood 程序 P1–P4 已 shipped，review/执行链路当前存在三层间接：

| 技能 | 类型 | 唯一活调用方 | 引擎依赖 |
|------|------|------------|---------|
| `executing-plans` | Orchestrator | `writing-plans` 交棒目标（Final 步骤调 `osuperpowers:code-review`） | 否（`cdd-session-activate.mjs` 仅其模式选择用，cli 模式由 gate 自动 `--mode cli`） |
| `code-review` | Orchestrator | 仅 `executing-plans` Final 步骤 | 否 |
| `cli-code-review` | CDD Engine 包装 | 仅 `code-review` Rule: Optional CLI Review | 否（`cdd-review.mjs` 是公共入口，不绑定此 skill） |

**关键事实**（grep 核验）：
- 引擎代码（`cdd-task.mjs` / `runner.mjs` / `cdd-review.mjs`）零引用这三个 skill；`overrides.manifest.json` 不含 `cli-code-review`。
- `branch-review.md` 模板**已存在**，`cdd-review.mjs --template branch-review` 已能派发整分支 review。
- `finishing` 不依赖 `code-review`（grep 零命中）——收尾链是 `branch-review CLI → finishing`，不经 `code-review`。
- `GEMINI.md` / `.kimi-plugin/plugin.json` / `build/generated/claude-self-check.md` 为 emit 生成产物，删 skill 后重生成自动清除。
- `bin/engine/tests/templates.test.mjs` 第 104/110/139/163 行**硬编码**断言 `skills/executing-plans/SKILL.md` 存在 + 行数预算 + D6 内容——删目录后此测试必红。

### 1.2 决策（brainstorming 已确认）

- **Q2**：osuperpowers 专注 cli-only，不提供 in-session / subagent 会话编排。
- **Q4=A**：删除 `executing-plans` 后，**不承接**上游 `superpowers:executing-plans`（移除 mapping，回落上游自身行为）。
- **Q5=B**：全局破坏性授权。
- **删除 `cli-code-review` + `code-review`**：评估后冗余，review 链路单一收敛到 `cdd-review.mjs --template {task-review|branch-review}`。

### 1.3 收敛后链路

```
writing-plans ──交棒──▶ cli-driven-development（cli 执行唯一编排器）
                              │
              per-task: cdd-task.mjs --mode implement|task-review|fix（引擎内）
                              │
              Final: cdd-review.mjs --template branch-review ──▶ 汇报用户（不自动 merge）
                              │
                              ▼
                        osuperpowers:finishing
```

用户手动 review feedback 路径：直接触发上游 `superpowers:receiving-code-review`（P5 取消 `osuperpowers:code-review` 拦截），无需中间 skill 包装。

---

## Section 2：改动清单

### 2.1 删除技能目录（3 个，含 zh-CN 镜像）

- `packages/osuperpowers/skills/executing-plans/`（SKILL.md + SKILL.zh-CN.md）
- `packages/osuperpowers/skills/code-review/`（SKILL.md + SKILL.zh-CN.md）
- `packages/osuperpowers/skills/cli-code-review/`（SKILL.md + SKILL.zh-CN.md）

派生目录 `.agents/skills/osuperpowers/{executing-plans,code-review,cli-code-review}/` 由 `pnpm run emit` 重生成自动清除。

### 2.2 `cli-driven-development` 重新定位 + Rule: Final Review

文件：`packages/osuperpowers/skills/cli-driven-development/SKILL.md` + `SKILL.zh-CN.md`

**(a) frontmatter description** 改为（英文，zh-CN 同步）：
> Plan executor (cli-only) + orchestrator + engine — drives planned task development via the selected harness CLI three-mode chain (implement / task-review / fix), owns orchestrator responsibilities (task classification / fix loop / quality gate / D6 aggregation / Final branch-review), and a final branch-review CLI pass before finishing.

**(b) 清理既有自指 stale ref（删除 executing-plans 后这些行会变成引用已删技能）** —— 改 `cli-driven-development/SKILL.md` 当前内容：
- 第 3 行 description 中 `orchestrator responsibilities (task classification / fix loop / quality gate / D6 aggregation) are handled by executing-plans` → `orchestrator responsibilities (task classification / fix loop / quality gate / D6 aggregation / Final branch-review) are owned by this skill`。
- 第 8 行 `**This is the engine**: it executes, it does not make orchestrator decisions.` → `**This skill is both orchestrator and engine**: it executes AND makes orchestrator decisions (mode chain, D6 aggregation, Final Review).`
- 第 43 行 Red Flag `classification / quality gate / D6 belong to the orchestrator (executing-plans), not the engine`：**整条删除**（与 §2.2(d) 删除项一致，不再改写——该 skill 现即编排器，此反模式已失效）。
- 上述三处 zh-CN 镜像（`SKILL.zh-CN.md`）同 task 同步。

**(c) 新增 Rule: Final Review（HARD-GATE）** —— 置于现有 Rules 末尾（Ledger 之后）：

英文：
```
### Rule: Final Review

<HARD-GATE>
After ALL tasks return APPROVED and the ledger is complete, you MUST run a
whole-branch review via the selected harness CLI before handing off to
`osuperpowers:finishing`. Do NOT skip this pass. Do NOT auto-merge its findings.
</HARD-GATE>

Run:
  {plugin_root}/bin/engine/cdd-review.mjs --harness <name> \
    --template branch-review \
    --param BASE=<git merge-base origin/develop HEAD> \
    --param HEAD=<head> \
    --param PLAN=<plan-path>

BASE is the integration branch point (`origin/develop`), not `origin/main` — this
repo integrates into `develop`. Report the findings to the user; do NOT auto-merge.
When clean, hand off to `osuperpowers:finishing`.
```

zh-CN 镜像同 task 同步（语义一致）。

**(d) Red Flags 更新**：
- **保留项**（仍有效）：`"--resume / -c / any flag that carries historical session" -> forbidden (H6.5), use one-shot print mode`；`"Modify repo files inside an orchestrator session" -> engine chain only goes through cdd-task.mjs; session side is constrained by orchestrator-gate`。
- **删除项**（及其 zh-CN）：`"Cram orchestrator decisions into the engine" -> classification / quality gate / D6 belong to the orchestrator (executing-plans), not the engine`（该 skill 现在就是编排器，此反模式已失效）。
- **新增项**（en + zh-CN）：
  - `"branch-review findings auto-merged" -> findings are reported, never auto-merged (Rule: Final Review)`
  - `"Skip Final Review and go straight to finishing" -> Final Review is a HARD-GATE before \`osuperpowers:finishing\` (Rule: Final Review)`

### 2.3 `branch-review.md` 模板基线标注

文件：`packages/osuperpowers/templates/cdd/branch-review.md`

- `{{BASE}}` 默认语义在模板顶部加一行注释/说明：整分支 review 基线为 `origin/develop`（`git merge-base origin/develop HEAD`），与 `cli-driven-development` Rule: Final Review 对齐；不默认 `origin/main`。
- 仅文档性标注，模板 `{{BASE}}` / `{{HEAD}}` / `{{PLAN}}` 占位符不变。若实现中发现需把默认值硬编码进模板，属 §2.6 引擎重构范畴（须带单测）。

### 2.4 `writing-plans` 交棒改向

文件：`packages/osuperpowers/skills/writing-plans/SKILL.md` + `SKILL.zh-CN.md`

- **Checklist 第 6 行**：`Execution Handoff → hand off to osuperpowers:executing-plans` → `osuperpowers:cli-driven-development`
- **Rule: Next-Step Routing**（第 54–62 行）：调用目标改为 `osuperpowers:cli-driven-development`；去掉"非上游 subagent-driven-development 或 executing-plans"措辞；交棒文本去掉"for mode selection and execution"，改为"for CLI execution"；去掉"Do NOT offer a subagent-vs-inline choice"及"handles mode selection"。
- **3 条 Red Flags**（第 68/69/72 行）：改指 `cli-driven-development`；去掉"subagent vs inline / in-session / mode selection"措辞。
- zh-CN 镜像同 task 同步。

### 2.5 引用清理（删除执行后字面引用清零）

> 行号锚点为写时快照，仅作导航；权威锚点是"旧→新文本串"。实施时先按旧文本定位，再替换，避免行号漂移。

| 文件 | 行/位置 | 改动 |
|------|--------|------|
| `packages/osuperpowers-router/overrides.manifest.json` | 第 8 行（executing-plans）、第 13 行（code-review） | 删除两条 mapping entry |
| `packages/osuperpowers/GEMINI.md` | — | emit 生成产物，无需手改；删三技能目录后 `pnpm run emit` 自动重生成清除引用 |
| `packages/osuperpowers/README.md` | 第 21 行（executing-plans）、第 25 行（code-review）、第 31 行（cli-code-review） | 第 21 行改为 `cli-driven-development` 编排说明（不删列留空）；第 25、31 行删除 |
| `packages/osuperpowers/skills/cli-select/SKILL.md` + zh-CN | description 末句 | 去掉 `cli-code-review / executing-plans` 引用 |
| `packages/osuperpowers/skills/init/router.md` | 第 35 行（executing-plans）、第 40 行（code-review） | 删除两行 |
| `packages/osuperpowers/docs/gate-install.md` | 第 251 行 | 去掉 `/executing-plans` 提及 |
| `packages/osuperpowers/bin/gate/cdd-gate-core.mjs` | 第 250 行 `'See executing-plans Rule: Orchestrator Checklist.'` | 改为 `See cli-driven-development Rule: Final Review.` |
| `docs/maintainers/osuperpowers-router-plugin.md` + zh-CN | 第 36 行（executing-plans 映射）、第 41 行（code-review 映射） | 删除两行 |
| `packages/osuperpowers-router/bin/{prompt-expansion,cursor-detect,cursor-enforce}.mjs` | executing-plans / code-review 字面引用 | **手改同步**（已核实 router/bin 下 `.mjs` 为手写、无 render 源生成）；删除三文件中的 `osuperpowers:executing-plans` / `osuperpowers:code-review` 字面引用 |
| `packages/osuperpowers-router/bin/pi-router.ts` | 第 8 行（`"executing-plans": "osuperpowers:executing-plans"`）、第 13 行（`"receiving-code-review": "osuperpowers:code-review"`） | 手改：删除两 mapping 行（据 Q4=A，上游 `superpowers:executing-plans` / `superpowers:receiving-code-review` 触发时回落上游自身行为） |
| `packages/osuperpowers/docs/controller-handoff.md` + zh-CN | "orchestrator (executing-plans)" | → `cli-driven-development` |
| `packages/osuperpowers/docs/docs-review.md` + zh-CN | "Task-review uses Fix Loop in executing-plans"、"Branch-review uses cli-code-review" | → `cli-driven-development`；branch-review 改用 `cli-driven-development` + `cdd-review.mjs` 直接派发 |
| `packages/osuperpowers/docs/cdd-reference.md` + zh-CN | code-review / cli-code-review 行文提及 | 清理 |
| `packages/osuperpowers/docs/subagent-lifecycle.md` + zh-CN | code-review 提及 | 清理 |
| `build/generated/claude-self-check.md` | — | emit 生成产物，无需手改；删三技能目录后 `pnpm run emit` 自动重生成清除引用 |

**清零校验（源文件）**：删改完成后，对**源文件**（不含 emit 生成产物 `.agents/` / `GEMINI.md` / `.kimi-plugin/` / `build/generated/`，以及 vendored 子模块与历史 `docs/superpowers/plans|specs` 文档）运行：
```
grep -rn "executing-plans\|cli-code-review" packages/osuperpowers/skills packages/osuperpowers/README.md packages/osuperpowers/bin packages/osuperpowers-router docs/maintainers
grep -rn "osuperpowers:code-review" packages/osuperpowers packages/osuperpowers-router
```
- 第二条对 `code-review` 用**词边界** `osuperpowers:code-review`（避免误伤 `mattpocock-skills:code-review` 等无关节点）。
- 源文件命中应全清零；生成产物由 `pnpm run emit` 重生成覆盖（验收 #6）。

### 2.6 引擎重构授权（B 解锁，默认最小姿态）

- **默认姿态：引擎零改动**。`branch-review` 模板已存在、`cdd-review.mjs` 已能派发、Final Review 作为 skill 规则文本驱动手动 `cdd-review.mjs` 调用即可。
- B 允许但**不强制**的升级（仅当实现中发现更优形态时采用，且须带单测，遵循 P2 "引擎变更须有单测"纪律）：
  - 将 `branch-review` 提升为 `cdd-task.mjs` 第一类 `--mode branch-review`（与 implement/task-review/fix 并列），让整分支 review 成为链的一环而非独立手动调用；
  - 扩展 `bin/engine/lib/contract.mjs` 的 `--handoff` 输出契约以承载 branch-review 报告。
- 任何引擎改动须同步 `tests/` 下对应单测（`templates.test.mjs`、`review.test.mjs`、`runner.test.mjs`、`contract.test.mjs`），保持 `pnpm run validate` 全绿。

---

## Section 3：测试修复

`packages/osuperpowers/bin/engine/tests/templates.test.mjs`：
- 第 104 行 `wcLines("skills/executing-plans/SKILL.md")` → `skills/cli-driven-development/SKILL.md`
- 第 110 行 `lineBudget("sdd")` 断言：保留 `sdd` 预算键（该阈值原即承载 executing-plans 行数上限），仅将左侧 `wcLines("skills/executing-plans/SKILL.md")` 改为 `wcLines("skills/cli-driven-development/SKILL.md")`；`sdd` 阈值 160 须 ≥ cli-driven-development 实际行数（加 Final Review 后若超 160，则上调 `LINE_BUDGETS.sdd` 值并在 `templates.mjs` 同步，记录理由），**不得**写 `lineBudget("cli")`（预算 map 无此键，会抛 unknown tier）。
- 第 139 行 `readRel("skills/executing-plans/SKILL.md")` → `skills/cli-driven-development/SKILL.md`
- 第 163 行注释 "D6 end semantics（executing-plans Rule: D6 Aggregation）" → 改为 `cli-driven-development` Final Review 收尾语义（D6 聚合内容现属该 skill 的 Final 收尾语义）

`packages/osuperpowers/tests/rule-reference.test.mjs`：前述 grep 显示无对三技能的硬引用，实现时复核；若有则同步改指 `cli-driven-development`。

---

## Section 4：验收标准（Acceptance）

1. `executing-plans` / `code-review` / `cli-code-review` 三技能目录（含 zh-CN）已删除；`packages/osuperpowers/skills/` 下无此三目录。
2. 除 vendored 子模块、emit 生成产物（`.agents/` / `GEMINI.md` / `.kimi-plugin/` / `build/generated/`）与历史 `docs/superpowers/plans|specs` 文档外，**源文件**中 `executing-plans` / `cli-code-review` 字面引用及 `osuperpowers:code-review` 引用全清零（§2.5 清零校验命令零命中）。
3. `cli-driven-development/SKILL.md` 含 Rule: Final Review（HARD-GATE），description 与 Red Flags 已承担"编排器 + 引擎"双重角色；zh-CN 镜像同步。
4. `branch-review` 整分支 review 基线（模板标注 + Final Review 命令）均为 `origin/develop`；无 `origin/main` 残留。
5. `writing-plans` 交棒目标为 `osuperpowers:cli-driven-development`，无"模式选择 / subagent vs inline"措辞；zh-CN 同步。
6. `overrides.manifest.json` 无 executing-plans / code-review 两条 mapping；emit 重生成后 `GEMINI.md` / `.kimi-plugin` / `build/generated/claude-self-check.md` 已清除三技能引用；`.agents/skills/osuperpowers/` 下无 `{executing-plans,code-review,cli-code-review}` 孤儿目录（emit:check 须 prune 孤儿，T7 复核）。
7. `bin/engine/tests/templates.test.mjs` 已迁移至 `cli-driven-development` 且 `pnpm run validate` 全绿。
8. `pnpm run emit` / `emit:check` 无 drift。
9. 独立 changeset：`@oscaner-skills/osuperpowers` 类型 **major**（破坏性移除三个公开 skill），`@oscaner-skills/osuperpowers-router` 若 overrides.manifest 变更则同 major。

---

## Section 5：边界与风险

- **破坏性**：移除三个公开 skill 属 breaking change，changeset 须标 major；CHANGELOG 须记录（emit/version 流程自动生成，但文案须明确"removed: executing-plans / code-review / cli-code-review"）。
- **`cdd-session-activate.mjs` 保留**：cli 模式由 gate 自动 `--mode cli` 激活，不依赖 executing-plans；删除不影响引擎。
- **上游回落**：取消 `osuperpowers:code-review` 与 `executing-plans` mapping 后，上游 `superpowers:receiving-code-review` / `superpowers:executing-plans` 触发时回落上游自身行为（含 in-session 编排）——与 osuperpowers cli-only 初衷一致，可接受。
- **emit 顺序**：引用清理后必须跑 `pnpm run emit` 再生 `.agents/` / `GEMINI.md` / `.kimi-plugin` / `build/generated`，再跑 `emit:check` 校验无 drift，最后 `pnpm run validate`。
- **B 授权纪律**：引擎重构（§2.6）默认不做；若做，须带单测且 `validate` 全绿，不趁机翻修无关子系统。
