# Dogfood 修复 P5 — 实施计划（三技能收敛 + branch-review CLI）

- **Version**: v1.1 · 2026-08-24（v1.1：重构为 cdd 引擎 `### Task N:` 可消费格式；补 CLI 模式执行协议；Task 1 按实际执行扩围）
- **Status**: Approved（设计已批准；Task 1 已完成 cb14c7c；Task 2–7 经 cdd-task.mjs 链执行）
- **Author**: Oscaner Miao · Claude Opus 4.8 (1M context)
- **设计规格**: [dogfood-fixes-p5-design.md](../../specs/2026-08-21-dogfood-fixes-p5-design.md)
- **上游宪章**: [dogfood-fixes-overall.md v2.1](../../specs/2026-08-21-dogfood-fixes-overall.md)（P5 全局破坏性授权）
- **语言策略**: Strategy B（plans/ 中文，无镜像）

---

## Section 0：CLI 模式执行协议（严格模式，用户已确认）

本计划以**严格 cli 模式**执行（用户决策 A）：

1. 每个 task 经 `{plugin_root}/bin/engine/cdd-task.mjs --harness claude --task N --mode implement --plan docs/superpowers/plans/2026-08-21-dogfood-fixes-p5.md` 派发子进程实现。
2. 子进程按 brief（引擎机械切出 `### Task N:` 段）自含实现：改文件 → 测试/校验 → 一个 conventional commit → 写 handoff 四行。
3. 编排器仅读 `$CDD_HANDOFF_PATH` 做 Per-Task Review 门控（APPROVED 才推进），不在 session 内用 Write/Edit 改仓库交付物（HARD-GATE）。
4. 全部 task APPROVED 后跑 Rule: Final Review（`cdd-review.mjs --template branch-review`，基线 `origin/develop`），再交 `osuperpowers:finishing`。
5. 会话激活：首个派发前 `cdd-session-activate.mjs minimal p5-exec $(pwd) --mode cli` 写 pending（gate 对本会话启用 cli 严格约束）。
6. 纪律记录：首次执行时曾在 session 内直接 Edit 交付物（cli-driven-development/SKILL.md），已 `git checkout` 回退并以引擎链重做——此例外已纠正，后续不再发生。

## Global Constraints

- 不修改 vendors 子模块；不做引擎代码 refactor（design spec §2.6 默认零引擎改动）。
- 所有 SKILL.md/docs 英文源改动必须同 task 同步 zh-CN 镜像（Strategy A）。
- 每个 commit 过 pre-commit 全量 validate（emit freshness / overrides build / engine tests / ci-validate）。
- 清零基线：除 vendored、emit 产物、历史 specs/plans 外，源文件不得残留 `executing-plans` / `cli-code-review` / `osuperpowers:code-review` 字面引用。

---

## Section 1：目标与验收

### 1.1 目标

将 osuperpowers 的"执行 plan + review"链路单一收敛到 cli 引擎：

1. 删除 `executing-plans` / `code-review` / `cli-code-review` 三技能及其全部引用。
2. `cli-driven-development` 升级为唯一 plan 执行编排器（cli-only），新增 Rule: Final Review（branch-review CLI 收尾，基线 `origin/develop`）。
3. `writing-plans` 交棒目标改指 `osuperpowers:cli-driven-development`。
4. `branch-review` 基线统一 `origin/develop`。

### 1.2 验收（来自 design spec §4）

1. 三技能目录（含 zh-CN）已删除；`skills/` 下无此三目录。
2. 源文件清零 grep（§Task 6）零命中。
3. `cli-driven-development/SKILL.md` 含 Rule: Final Review（HARD-GATE）+ orchestrator 定位；zh-CN 同步。
4. `branch-review` 基线标注与 Final Review 命令均为 `origin/develop`。
5. `writing-plans` 交棒目标为 `osuperpowers:cli-driven-development`，无模式选择措辞；zh-CN 同步。
6. emit 重生成后 GEMINI/.kimi/self-check/.agents 无三技能引用；无孤儿目录。
7. `templates.test.mjs` 已迁移至 cli-driven-development；`pnpm run validate` 全绿。
8. 独立 changeset：osuperpowers major + osuperpowers-router major，含 BREAKING CHANGE 说明。

---

## Section 2：任务分解（cdd 引擎可消费格式）

### Task 1: 删除三技能目录及全部强制配套

**状态：已完成，commit cb14c7c。**

实际执行范围（较原计划扩围，删除的强制配套）：
- `git rm -r` 三技能目录（skills/executing-plans、code-review、cli-code-review）
- 删 `overrides.manifest.json` 两条 mapping（第 8、13 行）
- `packages/osuperpowers-router/tests/validate-overrides-build.mjs` targets 断言 10→8
- `scripts/lib/emit/emit.test.mjs` loadTargets 断言 10→8
- `scripts/ci-validate.mjs` skills-count 断言 13→10
- `init/router.md` 删 `/executing-plans`、`/receiving-code-review` 两行
- `bin/engine/tests/templates.test.mjs` 行预算宿主改 cli-driven-development；D6 断言随 executing-plans 退役（Final Review 断言归 Task 2 落地时加入）
- `pnpm run emit` 重生成（GEMINI/hooks.json/self-check/.agents prune 孤儿）

验证：pre-commit 全量 validate ALL PASS。

### Task 2: 重写 cli-driven-development（orchestrator + Final Review）

文件：`packages/osuperpowers/skills/cli-driven-development/SKILL.md` + `SKILL.zh-CN.md`

**(a) frontmatter description** 整行替换为：
```
description: Plan executor (cli-only) + orchestrator + engine — drives planned task development via the selected harness CLI three-mode chain (implement / task-review / fix), owns orchestrator responsibilities (task classification / fix loop / quality gate / D6 aggregation / Final branch-review), and a final branch-review CLI pass before finishing.
```

**(b) 正文首段** `**This is the engine**: it executes, it does not make orchestrator decisions.` 替换为：
```
**This skill is both orchestrator and engine**: it executes AND makes orchestrator decisions (mode chain, D6 aggregation, Final Review).
```
zh-CN 对应句「**这是引擎**：它执行，不做编器决策。」→「**本技能同时是编器与引擎**：既执行也做编器决策（模式链、D6 聚合、Final Review）。」

**(c) Ledger 规则之后、Red Flags 之前新增**（en 版全文）：
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
zh-CN 同语义版本：
```
### Rule: Final Review（终局评审）

<HARD-GATE>
全部 task 返回 APPROVED 且 ledger 完成后，必须在交接给 `osuperpowers:finishing` 前，
经选定 harness CLI 跑一次整分支 review。禁止跳过该 pass；禁止自动 merge 其 findings。
</HARD-GATE>

命令：
  {plugin_root}/bin/engine/cdd-review.mjs --harness <name> \
    --template branch-review \
    --param BASE=<git merge-base origin/develop HEAD 的结果> \
    --param HEAD=<head> \
    --param PLAN=<plan-path>

BASE 是集成分支点（`origin/develop`），不是 `origin/main`——本仓库集成进 `develop`。
findings 汇报给用户；不自动 merge。通过后交接 `osuperpowers:finishing`。
```

**(d) Red Flags**：保留前两条（--resume 禁止；orchestrator 会话禁改 repo）；删除第三条 `"Cram orchestrator decisions into the engine"` 及 zh-CN「把编器决策塞进引擎」整行；新增两条：
```
- "branch-review findings auto-merged" -> findings are reported, never auto-merged (Rule: Final Review)
- "Skip Final Review and go straight to finishing" -> Final Review is a HARD-GATE before `osuperpowers:finishing` (Rule: Final Review)
```
zh-CN：
```
- 「branch-review findings 被自动 merge」→ findings 仅汇报，绝不自动 merge（Rule: Final Review）
- 「跳过 Final Review 直接 finishing」→ Final Review 是 `osuperpowers:finishing` 前的 HARD-GATE（Rule: Final Review）
```

测试证据：`node --test bin/engine/tests/templates.test.mjs`（在 packages/osuperpowers 下）全绿；并在 templates.test.mjs 的 D3/review/fix 语义锚点测试尾部补 Final Review 断言（readRel cli-driven-development 含 `### Rule: Final Review` / `origin/develop` / `osuperpowers:finishing`）。
提交：一个 `feat:` conventional commit。

### Task 3: branch-review.md 模板基线标注

文件：`packages/osuperpowers/templates/cdd/branch-review.md`

在 `# Branch Review` 标题行之后插入一行：
```
<!-- Whole-branch review baseline: origin/develop (git merge-base origin/develop HEAD), not origin/main. Aligned with cli-driven-development Rule: Final Review. -->
```
占位符不变。测试证据：`node --test bin/engine/tests/templates.test.mjs` 全绿（模板 ≤60 行守卫仍过）。提交：一个 `docs:` commit。

### Task 4: writing-plans 交棒改向

文件：`packages/osuperpowers/skills/writing-plans/SKILL.md` + `SKILL.zh-CN.md`

- Checklist 第 6 条：`hand off to \`osuperpowers:executing-plans\`` → `` hand off to `osuperpowers:cli-driven-development` ``（zh-CN 第 17 条同步）。
- Rule: Next-Step Routing：invoke 目标改 `osuperpowers:cli-driven-development`；交棒文本改为 `> "Plan complete and saved to \`docs/superpowers/plans/<filename>.md\`. Ready to execute — I'll hand off to \`osuperpowers:cli-driven-development\` for CLI execution."`；删除 `Do NOT offer a subagent-vs-inline choice — ...` 整行。
- 三条 Red Flags 左右两侧都改（使 executing-plans 字面清零）：
  - `"Invoke superpowers:subagent-driven-development / superpowers:executing-plans"` → `"Invoke superpowers:subagent-driven-development"`；修正侧 `→ invoke **osuperpowers:executing-plans** (Rule: Next-Step Routing)` → `→ invoke **osuperpowers:cli-driven-development** (Rule: Next-Step Routing)`
  - `"Offer subagent vs inline choice"` → `"Offer mode choice"`；修正侧 `→ osuperpowers:executing-plans handles mode selection (Rule: Next-Step Routing)` → `→ osuperpowers:cli-driven-development handles execution (Rule: Next-Step Routing)`
  - `"Display subagent / in-session / CLI three-option choice"` → `"Display execution-mode choice"`；修正侧 `→ use Execution Handoff text, hand off to osuperpowers:executing-plans (Rule: Next-Step Routing)` → `→ use Execution Handoff text, hand off to osuperpowers:cli-driven-development (Rule: Next-Step Routing)`
- zh-CN 镜像全部同步（同位置同语义）。

测试证据：grep 该两文件无 `executing-plans` 命中。提交：一个 `feat:` commit。

### Task 5: 清扫剩余源文件引用

逐文件旧→新（行号仅导航，以文本锚定）：

| 文件 | 动作 |
|------|------|
| `packages/osuperpowers/README.md` | 第 21 行 executing-plans 表行 → `` \| `cli-driven-development` \| Orchestrator + Engine \| Plan executor (cli-only) + Final branch-review CLI \| ``；删 code-review 表行（第 25）、cli-code-review 表行（第 31）；zh-CN README（README.zh-CN.md）同步 |
| `packages/osuperpowers/skills/cli-select/SKILL.md` + zh-CN | description 末句 → `Referenced by cli-driven-development / cli-task.` |
| `packages/osuperpowers/docs/gate-install.md` | `/subagent-driven-development, /executing-plans, …` → `/subagent-driven-development, …` |
| `packages/osuperpowers/bin/gate/cdd-gate-core.mjs` | `See executing-plans Rule: Orchestrator Checklist.` → `See cli-driven-development Rule: Final Review.` |
| `docs/maintainers/osuperpowers-router-plugin.md` + zh-CN | 删 executing-plans 映射行、receiving-code-review→code-review 映射行 |
| `packages/osuperpowers-router/bin/prompt-expansion.mjs` | 删 `superpowers:executing-plans` 与 `/executing-plans` 两映射行 |
| `packages/osuperpowers-router/bin/cursor-detect.mjs` | TARGETS 数组删 `osuperpowers:executing-plans` 对象 |
| `packages/osuperpowers-router/bin/cursor-enforce.mjs` | READ_RES 删 `osuperpowers:executing-plans` 键 |
| `packages/osuperpowers-router/bin/pi-router.ts` | 删 `"executing-plans"` 与 `"receiving-code-review"` 两映射行 |
| `packages/osuperpowers/docs/controller-handoff.md` + zh-CN | `the orchestrator (executing-plans)` → `the orchestrator (cli-driven-development)` |
| `packages/osuperpowers/docs/docs-review.md` + zh-CN | 头部注记 → `Task-review uses Fix Loop in \`cli-driven-development/SKILL.md\`. Branch-review uses \`cli-driven-development\` + \`cdd-review.mjs\` (--template branch-review).` |
| `packages/osuperpowers/docs/cdd-reference.md` + zh-CN | 清理指向已删技能的措辞（如 code-review variant 提法若指向 cli-code-review 则改述为 cdd-review.mjs 直派） |
| `packages/osuperpowers/docs/subagent-lifecycle.md` + zh-CN | code-review 提及改为上游 receiving-code-review 或删除 |

router bin 改后跑 `pnpm run emit`（self-check/generated 同步）。提交：一个 `refactor:` commit。

### Task 6: 终验（emit / validate / 清零 / 孤儿）

```bash
pnpm run emit && pnpm run emit:check && pnpm run validate
grep -rn "executing-plans\|cli-code-review" packages/osuperpowers/skills packages/osuperpowers/README.md packages/osuperpowers/bin packages/osuperpowers/docs packages/osuperpowers-router docs/maintainers
grep -rn "osuperpowers:code-review" packages/osuperpowers packages/osuperpowers-router
ls packages/osuperpowers/.agents/skills/osuperpowers/   # 无三孤儿目录
```
全绿 + 零命中才算 DONE；发现漏网按旧→新补改后再验。提交：若有补改一个 `fix:` commit，否则无变更即 DONE（handoff status DONE，blocker none）。

### Task 7: changeset

写 `.changeset/dogfood-fixes-p5.md`：
```
---
'@oscaner-skills/osuperpowers': major
'@oscaner-skills/osuperpowers-router': major
---

feat: converge executing-plans/code-review/cli-code-review into cli-driven-development (cli-only)
feat: add Rule: Final Review to cli-driven-development (branch-review CLI pass, baseline origin/develop)
fix: route writing-plans handoff to osuperpowers:cli-driven-development (drop mode selection)
fix: unify branch-review baseline to origin/develop (was origin/main)
docs: sync zh-CN mirrors; remove deleted-skill references across README/router/gate/docs
BREAKING CHANGE: removed public skills executing-plans, code-review, cli-code-review
```
提交：`chore: add changeset for P5 three-skill convergence`。

---

## Section 3–5：顺序 / 风险（要点保留）

- 顺序：Task 2 → 3 → 4 → 5 → 6 → 7 单线程；Task 1 已完成。
- 风险：sdd 行预算 160 可能被 Task 2 新增 Final Review 撑破——超则上调 `LINE_BUDGETS.sdd` 并记理由；emit drift 由 Task 6 兜底；清零漏网由 Task 6 grep 暴露。
- 回滚：各 task 独立 commit，`git revert` 即可；引擎代码零改动承诺不变。
