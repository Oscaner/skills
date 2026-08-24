# Dogfood 修复 P5 — 实施计划（三技能收敛 + branch-review CLI）

- **Version**: v1.0 · 2026-08-24
- **Status**: Draft（writing-plans 分节写完，待 3-pass Plan Review via CLI + 用户确认）
- **Author**: Oscaner Miao · Claude Opus 4.8 (1M context)
- **设计规格**: [dogfood-fixes-p5-design.md](../../specs/2026-08-21-dogfood-fixes-p5-design.md)
- **上游宪章**: [dogfood-fixes-overall.md v2.1](../../specs/2026-08-21-dogfood-fixes-overall.md)（P5 全局破坏性授权）
- **语言策略**: Strategy B（plans/ 中文，无镜像）

---

## Section 1：目标与验收

### 1.1 目标

将 osuperpowers 的"执行 plan + review"链路单一收敛到 cli 引擎，移除三层冗余间接：

1. 删除 `executing-plans` / `code-review` / `cli-code-review` 三技能（含 zh-CN 镜像）。
2. `cli-driven-development` 升级为唯一的 plan 执行编排器（cli-only），新增 Rule: Final Review（末尾 `cdd-review.mjs --template branch-review` 整分支 review 收尾，基线 `origin/develop`）。
3. `writing-plans` 交棒目标改指 `cli-driven-development`。
4. `branch-review` 整分支 review 基线统一为 `origin/develop`（替代 `origin/main`）。
5. 清理所有引用，修复 `templates.test.mjs` 对 executing-plans 的硬编码断言。

### 1.2 验收（来自 design spec §4，逐条可核验）

1. 三技能目录（含 zh-CN）已删除；`packages/osuperpowers/skills/` 下无此三目录。
2. 源文件中 `executing-plans` / `cli-code-review` 字面引用及 `osuperpowers:code-review` 引用全清零（§2.5 清零 grep 零命中；vendored / emit 产物 / 历史 plan|specs 文档除外）。
3. `cli-driven-development/SKILL.md` 含 Rule: Final Review（HARD-GATE），description + Red Flags 承担"编排器 + 引擎"；zh-CN 同步。
4. `branch-review` 基线（模板标注 + Final Review 命令）均为 `origin/develop`；无 `origin/main` 残留。
5. `writing-plans` 交棒目标为 `osuperpowers:cli-driven-development`，无"模式选择 / subagent vs inline"措辞；zh-CN 同步。
6. `overrides.manifest.json` 无 executing-plans / code-review 两条 mapping；emit 重生成后 GEMINI.md / .kimi-plugin / build/generated/claude-self-check.md / .agents/ 已清除三技能引用。
7. `bin/engine/tests/templates.test.mjs` 已迁移至 cli-driven-development 且 `pnpm run validate` 全绿。
8. `pnpm run emit` / `emit:check` 无 drift。
9. 独立 changeset：`@oscaner-skills/osuperpowers` major（破坏性移除三公开 skill）；`@oscaner-skills/osuperpowers-router` 若 overrides.manifest 变更则同 major。

### 1.3 破坏性说明

移除三个公开 skill 属 breaking change。用户显式 `/osuperpowers:executing-plans` / `/osuperpowers:code-review` / `/osuperpowers:cli-code-review` 将不再解析（上游 `superpowers:executing-plans` / `superpowers:receiving-code-review` 触发时回落上游自身行为）。changeset 标 major，CHANGELOG 文案明确 "removed: executing-plans / code-review / cli-code-review"。

---

## Section 2：执行步骤

### 2.1 删除三技能目录（Task T1）

复核（已确认存在）：`packages/osuperpowers/skills/{executing-plans,code-review,cli-code-review}/` 各含 `SKILL.md` + `SKILL.zh-CN.md`；`.agents/skills/osuperpowers/` 下有同名派生目录。

命令（git 跟踪删除，不当误用 `git add -f`）：
```bash
git rm -r packages/osuperpowers/skills/executing-plans \
        packages/osuperpowers/skills/code-review \
        packages/osuperpowers/skills/cli-code-review
```
> `.agents/skills/osuperpowers/{executing-plans,code-review,cli-code-review}/` 为 emit 派生产物，本步**不手删**——§2.6 emit 重生成自动清除。若 `git status` 显示其残留，于 §2.6 后由 emit 处理。

预期：`packages/osuperpowers/skills/` 下仅剩 cli-driven-development / cli-select / cli-task / brainstorming / writing-plans / debugging / verification / code-review→已删 / finishing / init / report-issue / cli-code-review→已删 / executing-plans→已删。

### 2.2 `cli-driven-development` 重新定位（Task T2）

文件：`packages/osuperpowers/skills/cli-driven-development/SKILL.md` + `SKILL.zh-CN.md`。本任务含三子步，均须 en + zh-CN 同步。

#### 2.2a frontmatter description + 自指 stale ref 清理

> 文案权威来源 = design spec §2.2(a)/(b)。两处 description 位置不同：第 2 行是 frontmatter `description:` 字段，采用 §2.2(a) 全文；第 3 行是 SKILL.md body 里 description 的展开句，采用 §2.2(b) 改写。

- **description（第 2 行 frontmatter）** 改为（采用 spec §2.2(a) 全文，含 cli-only）：
  `Plan executor (cli-only) + orchestrator + engine — drives planned task development via the selected harness CLI three-mode chain (implement / task-review / fix), owns orchestrator responsibilities (task classification / fix loop / quality gate / D6 aggregation / Final branch-review), and a final branch-review CLI pass before finishing.`
- **第 3 行**（body 展开句）`orchestrator responsibilities (task classification / fix loop / quality gate / D6 aggregation) are handled by executing-plans` → `orchestrator responsibilities (task classification / fix loop / quality gate / D6 aggregation / Final branch-review) are owned by this skill`（spec §2.2(b)）。
- **第 8 行** `**This is the engine**: it executes, it does not make orchestrator decisions.` → `**This skill is both orchestrator and engine**: it executes AND makes orchestrator decisions (mode chain, D6 aggregation, Final Review).`
- zh-CN 镜像（`SKILL.zh-CN.md`）对应三处同义改写（第 2/3/8 行附近，以旧文本锚定）。
- **第 43 行 Red Flag 不在此改写**——它属于 §2.2c 的"整条删除"动作（spec §2.2(d) 删除项），此处不重复。

#### 2.2b 新增 Rule: Final Review（HARD-GATE）

在现有 Rules 末尾（Ledger 规则之后）追加（en）：
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
zh-CN 镜像同语义（"执行末尾" / "整分支 review" / "不自动 merge" / "干净后交 osuperpowers:finishing"）。

#### 2.2c Red Flags 更新

- **保留**：第 41 行 `"--resume / -c / any flag that carries historical session" -> forbidden (H6.5), use one-shot print mode`；第 42 行 `"Modify repo files inside an orchestrator session" -> engine chain only goes through cdd-task.mjs; session side is constrained by orchestrator-gate`。
- **删除**（及其 zh-CN）：第 43 行 `"Cram orchestrator decisions into the engine" -> classification / quality gate / D6 belong to the orchestrator (executing-plans), not the engine`（该 skill 现即编排器，反模式失效）。
- **新增**（en + zh-CN）：
  - `"branch-review findings auto-merged" -> findings are reported, never auto-merged (Rule: Final Review)`
  - `"Skip Final Review and go straight to finishing" -> Final Review is a HARD-GATE before \`osuperpowers:finishing\` (Rule: Final Review)`

预期：`cli-driven-development/SKILL.md` 含 Final Review 规则、description 含 orchestrator、Red Flags 无 "Cram orchestrator" 且无 executing-plans 引用。

### 2.3 `branch-review.md` 模板基线标注（Task T3）

文件：`packages/osuperpowers/templates/cdd/branch-review.md`。

在模板顶部（`# Branch Review` 标题下）加一行说明：
```
<!-- Whole-branch review baseline: origin/develop (git merge-base origin/develop HEAD), not origin/main. Aligned with cli-driven-development Rule: Final Review. -->
```
占位符 `{{BASE}}` / `{{HEAD}}` / `{{PLAN}}` 不变。仅文档性标注，不改渲染逻辑。

### 2.4 `writing-plans` 交棒改向（Task T4）

文件：`packages/osuperpowers/skills/writing-plans/SKILL.md` + `SKILL.zh-CN.md`。

- **Checklist 第 6 行** `Execution Handoff → hand off to osuperpowers:executing-plans` → `osuperpowers:cli-driven-development`。
- **Rule: Next-Step Routing**（第 54–62 行）：
  - 第 56 行 `invoke **osuperpowers:executing-plans** (not upstream ...)` → `invoke **osuperpowers:cli-driven-development**`。
  - 第 60 行交棒文本去掉 "for mode selection and execution"，改为 "for CLI execution"；整句：`> "Plan complete and saved to ... Ready to execute — I'll hand off to osuperpowers:cli-driven-development for CLI execution."`
  - 删除第 62 行 `Do NOT offer a subagent-vs-inline choice — ...` 及对应 "handles mode selection" 措辞。
- **3 条 Red Flags**（第 68/69/72 行）**：左右两侧（坏模式 + 修正侧）都须改指 `cli-driven-development`，去掉 "subagent vs inline / in-session / mode selection" 措辞，使清零 grep 零命中：
  - **第 68 行**：左 `"Invoke superpowers:subagent-driven-development / superpowers:executing-plans"` → `"Invoke superpowers:subagent-driven-development"`；右 `→ invoke **osuperpowers:executing-plans** (Rule: Next-Step Routing)` → `→ invoke **osuperpowers:cli-driven-development** (Rule: Next-Step Routing)`。
  - **第 69 行**：左 `"Offer subagent vs inline choice"` → `"Offer mode choice"`；右 `→ osuperpowers:executing-plans handles mode selection (Rule: Next-Step Routing)` → `→ osuperpowers:cli-driven-development handles execution (Rule: Next-Step Routing)`。
  - **第 72 行**：整条改写为确定新文本——左 `"Display subagent / in-session / CLI three-option choice"` → `"Display execution-mode choice"`；右 `→ use Execution Handoff text, hand off to osuperpowers:executing-plans (Rule: Next-Step Routing)` → `→ use Execution Handoff text, hand off to osuperpowers:cli-driven-development (Rule: Next-Step Routing)`。
- zh-CN 镜像同 task 同步（第 17/56/60/62/68/69/72 行附近，旧文本锚定；修正侧同步改指 cli-driven-development）。

> 实施提示：writing-plans 的 Next-Step Routing 仍保留 "invoke superpowers:subagent-driven-development" 的反模式红线（指向 cli-driven-development 上游 superpowers 对应项），仅去掉 executing-plans 引用。

### 2.5 引用清理（Task T5，源文件手改）

> 行号仅导航，权威锚点为"旧→新文本串"。router/bin 下 `.mjs` / `.ts` 已核实为手写（无 render 源），均手改同步。

| 文件 | 旧文本 / 位置 | 新文本 / 动作 |
|------|--------------|--------------|
| `packages/osuperpowers-router/overrides.manifest.json` | 第 8 行 `{ "name": "osuperpowers:executing-plans", ... }`、第 13 行 `{ "name": "osuperpowers:code-review", ... }` | 删除两整行 entry |
| `packages/osuperpowers/README.md` | 第 21 行 `\| \`executing-plans\` \| Orchestrator \| Three-mode executor (in-session / subagent / cli) \|` | 改为 `\| \`cli-driven-development\` \| Orchestrator + Engine \| Plan executor (cli-only) + Final branch-review CLI \|`（不删列留空） |
| `packages/osuperpowers/README.md` | 第 25 行 `\| \`code-review\` \| Orchestrator \| ... \|`、第 31 行 `\| \`cli-code-review\` \| CDD Engine \| ... \|` | 删除两整行 |
| `packages/osuperpowers/skills/cli-select/SKILL.md` + zh-CN | description 末句 `Referenced by cli-driven-development / cli-task / cli-code-review / executing-plans.` | 改为 `Referenced by cli-driven-development / cli-task / cli-code-review.`（去掉 executing-plans；cli-code-review 将在 T1 删除，此处一并去掉）→ 最终 `Referenced by cli-driven-development / cli-task.` |
| `packages/osuperpowers/skills/init/router.md` | 第 35 行 `/executing-plans` 行、第 40 行 `/receiving-code-review` → `Skill(osuperpowers:code-review)` 行 | 删除两整行 |
| `packages/osuperpowers/docs/gate-install.md` | 第 251 行 `Start a CDD task (/subagent-driven-development, /executing-plans, …)` | 去掉 `/executing-plans`，→ `Start a CDD task (/subagent-driven-development, …)` |
| `packages/osuperpowers/bin/gate/cdd-gate-core.mjs` | 第 250 行 `See executing-plans Rule: Orchestrator Checklist.` | `See cli-driven-development Rule: Final Review.` |
| `docs/maintainers/osuperpowers-router-plugin.md` + zh-CN | 第 36 行 `superpowers:executing-plans` 映射行、第 41 行 `superpowers:receiving-code-review` → `osuperpowers:code-review` 映射行 | 删除两整行 |
| `packages/osuperpowers-router/bin/prompt-expansion.mjs` | 第 24–25 行 `superpowers:executing-plans` / `/executing-plans` 映射 | 删除两行（上游触发回落自身行为） |
| `packages/osuperpowers-router/bin/cursor-detect.mjs` | `TARGETS` 数组中 `osuperpowers:executing-plans` 对象 | 删除该对象 |
| `packages/osuperpowers-router/bin/cursor-enforce.mjs` | `READ_RES` 中 `osuperpowers:executing-plans` 键 | 删除该键 |
| `packages/osuperpowers-router/bin/pi-router.ts` | 第 8 行 `"executing-plans": "osuperpowers:executing-plans"`、第 13 行 `"receiving-code-review": "osuperpowers:code-review"` | 删除两行 |
| `packages/osuperpowers/docs/controller-handoff.md` + zh-CN | "The discipline by which the orchestrator (executing-plans) drives the cdd engine" | "The discipline by which the orchestrator (cli-driven-development) drives the cdd engine" |
| `packages/osuperpowers/docs/docs-review.md` + zh-CN | 第 4 行 "Task-review uses Fix Loop in `executing-plans/SKILL.md`. Branch-review uses `cli-code-review/SKILL.md`." | "Task-review uses Fix Loop in `cli-driven-development/SKILL.md`. Branch-review uses `cli-driven-development` + `cdd-review.mjs` (--template branch-review)." |
| `packages/osuperpowers/docs/cdd-reference.md` + zh-CN | code-review / cli-code-review 行文提及 | 清理（如 "code-review skill" 等指向已删技能的措辞） |
| `packages/osuperpowers/docs/subagent-lifecycle.md` + zh-CN | code-review 提及 | 清理 |

> `GEMINI.md` / `build/generated/claude-self-check.md` 为 emit 生成产物，本步不手改——§2.6 emit 自动重生成清除。

### 2.6 emit 重生成 + 测试修复（Task T6）

1. 跑 `pnpm run emit` 重生成 `.agents/` / `GEMINI.md` / `.kimi-plugin/plugin.json` / `build/generated/claude-self-check.md`，自动清除三技能引用。
2. 修复 `packages/osuperpowers/bin/engine/tests/templates.test.mjs`：
   - 第 104 行 `wcLines("skills/executing-plans/SKILL.md")` → `wcLines("skills/cli-driven-development/SKILL.md")`
   - 第 110 行：保留 `lineBudget("sdd")` 键（预算 map 无 `cli` 键），仅改左侧 `wcLines("skills/executing-plans/SKILL.md")` → `wcLines("skills/cli-driven-development/SKILL.md")`；若 cli-driven-development 实际行数 > 160，上调 `LINE_BUDGETS.sdd`（在 `bin/engine/lib/templates.mjs`）并记理由。
   - 第 139 行 `readRel("skills/executing-plans/SKILL.md")` → `readRel("skills/cli-driven-development/SKILL.md")`
   - 第 163 行注释 `D6 end semantics（executing-plans Rule: D6 Aggregation）` → `cli-driven-development Final Review 收尾语义`
3. 复核 `packages/osuperpowers/tests/rule-reference.test.mjs` 无对三技能的硬引用（前述 grep 显示无）；若有则同步改指 cli-driven-development。

### 2.7 验证（Task T7）

```bash
pnpm run emit:check      # 无 drift
pnpm run validate        # 全绿（含 templates.test.mjs）
```
清零校验（源文件，与 spec 验收 #2 对齐——不扫裸 `code-review`，避免误伤 mattpocock-skills:code-review 委派与引擎 code-review variant）：
```bash
grep -rn "executing-plans\|cli-code-review" packages/osuperpowers/skills packages/osuperpowers/README.md packages/osuperpowers/bin packages/osuperpowers/docs packages/osuperpowers-router docs/maintainers
grep -rn "osuperpowers:code-review" packages/osuperpowers packages/osuperpowers-router
```
孤儿目录检查（emit 应 prune）：`ls packages/osuperpowers/.agents/skills/osuperpowers/` 下无 `executing-plans` / `code-review` / `cli-code-review` 目录。
两条均零命中（vendored / emit 产物 / 历史 plan|specs 文档除外）。

### 2.8 changeset（Task T8）

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
docs: sync zh-CN mirrors; remove three deleted-skill references across README/router/gate/docs
BREAKING CHANGE: removed public skills executing-plans, code-review, cli-code-review
```
> `@oscaner-skills/osuperpowers-router` major 仅当 §2.5 改了 overrides.manifest.json / router bin 时成立（本计划改动成立，故列 major）。

---

## Section 3：任务清单（ticketing）

| Task | 范围 | 文件 | 校验 |
|------|------|------|------|
| T1 | 删三技能目录 | `skills/{executing-plans,code-review,cli-code-review}/` | `skills/` 下无三目录 |
| T2 | cli-driven-development 重写 | `cli-driven-development/SKILL.md` + zh-CN | 含 Final Review + orchestrator description + 无 executing-plans 引用 |
| T3 | branch-review 基线标注 | `templates/cdd/branch-review.md` | 顶部注释 `origin/develop` |
| T4 | writing-plans 交棒改向 | `writing-plans/SKILL.md` + zh-CN | 交棒目标 cli-driven-development |
| T5 | 引用清理（源文件） | overrides.manifest / README / cli-select / init/router / gate-install / cdd-gate-core / router-plugin / router bin(.mjs/.ts) / controller-handoff / docs-review / cdd-reference / subagent-lifecycle | §2.7 清零 grep 零命中 |
| T6 | emit 重生成 + 测试修复 | `.agents/`/GEMINI/.kimi/self-check（emit）+ `templates.test.mjs` | emit 产物无三技能引用；test 迁移 |
| T7 | 验证 | emit:check + validate + 清零 grep | 全绿 + 零命中 |
| T8 | changeset | `.changeset/dogfood-fixes-p5.md` | major，三包移除文案 |

---

## Section 4：依赖与顺序

- T1 → T2 → T3 → T4 → T5 顺序执行（T5 依赖 T1 删除后文件状态稳定）。
- T6 必须在 T1–T5 之后（emit 重生成依赖源文件终态；templates.test.mjs 改依赖 T2 目标文件）。
- T7 必须在 T6 之后（validate 依赖 emit 产物 + 测试修复）。
- T8 独立，可在 T7 通过后写（commit 前）。
- 无跨任务硬阻塞；单线程顺序即可。

---

## Section 5：风险与回滚

- **引擎改动护栏（遵循 design spec §2.6 默认姿态）**：P5 **不做引擎重构**。`branch-review` 保持为 skill 规则文本驱动的手动 `cdd-review.mjs --template branch-review` 调用，不提升为 `cdd-task.mjs` 第一类 `--mode`、不扩展 `contract.mjs`。实施者不得自行发起引擎 refactor 任务（B 授权允许但不强制，本计划不采用）。

- **emit drift**：若 T5 手改后 emit 产物（`.agents/` 等）未重生成，emit:check 会报 diff——T6 必须跑 emit 后再 emit:check。
- **templates.test.mjs 红**：sdd 预算 160 可能不够（cli-driven-development 加 Final Review 后行数增长）——T6 实测行数，超则上调 `LINE_BUDGETS.sdd` 并同步 `templates.mjs`。
- **清零 grep 漏网**：T5 表格外若仍有引用（如某 doc 未列），T7 清零 grep 会暴露——以旧→新文本串补改，不绕过。
- **回滚**：本计划为文件删除 + 改写，git 跟踪；若中途失败，`git checkout -- .` 或 `git restore` 对应文件即可回退到 T1 前；emit 产物可 `pnpm run emit` 重建。
- **破坏性发布**：changeset major 触发版本 bump；CHANGELOG 须含 "removed" 文案（emit/version 流程生成，人工补 removed 说明）。
