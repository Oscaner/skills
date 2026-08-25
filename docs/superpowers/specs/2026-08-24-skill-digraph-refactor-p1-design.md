# P1 engine-fixes — Design Spec

- **Version**: v1.0 · 2026-08-24
- **Status**: Approved
- **Author**: [human] · Claude Opus 4.8（osuperpowers:brainstorming dogfood session）
- **Parent program**: [skill-digraph-refactor overall v1.4](./2026-08-24-skill-digraph-refactor-overall.md)
- **Depends on**: 无（首 phase）

---

## Section 0: Incremental warning

> 本 phase 仅覆盖 overall 的 P1 范围：#173 引擎 workspace 解析修复 + #169 删 `--prompt` + 删 cli-task 技能。文档迁移、技能重构等均不在本 phase。冲突时以 overall 为准。

## Section 1: Constraints pointer

- 不改上游 vendored 仓库。
- 输出契约不变：H1 四行、退出码语义（0/1/2/3）、handoff schema 均保持。
- 每 phase 收尾 `pnpm run emit && pnpm run validate` 绿；测试基线 12 文件 124 测试不回退。

---

## Section 2: Design body

### 2.1 repoRoot 统一解析（#173）

**现状缺陷**：引擎内仓库根解析散落且全部从 cwd 取——`resolveWorkspace`（runner.mjs:55 `gitToplevel(cwd)`）、`findSuperpowersScriptsDir`（L249）、`relpathFromRepo`（L283）、`generateBrief`（brief.mjs:18 `gitRevParseHead(cwd)`）、`runReviewPackage` 给 bash 子进程传 `{ cwd }`（上游脚本内部 git 从继承 cwd 解析）。控制器 cd 进技能仓库再调脚本时，工作区/brief/review diff 全部落错仓库（issue #173 场景）。

**设计**：

1. **新函数 `resolveRepoRoot({ planFile, env })`**（contract.mjs 或 runner.mjs 内聚），两条分支语义显式分开：
   - **CDD_WORKSPACE 直设分支**（保持现行为，向后兼容；**单一无条件规则：凡存在有效 plan（opt ‖ env.PLAN_FILE ‖ ledger backfill）一律走 plan 派生分支，无论 CDD_WORKSPACE 是否为 git 目录；仅无任何有效 plan 时进入本分支**）：workspace 取 `env.CDD_WORKSPACE` 原值返回；repoRoot = `gitToplevel(CDD_WORKSPACE)`，允许为 null 不报错——该模式下下游全部容忍无根：`findSuperpowersScriptsDir(null 根)` 跳过 submodule 探测直接走 plugin cache、`relpathFromRepo` 无根时回退绝对路径（现行为）。**CDD_WORKSPACE + 有效 plan 同给的组合**（H6 编排文档化模式）：恒走 plan 派生分支——**workspace 一并由 plan 派生值覆盖（`<planRepoRoot>/.superpowers/cdd/<slug>/`），env.CDD_WORKSPACE 整体被忽略**；此与旧语义（无 planFile opt 时 env 直设）不同，属消费者可见变更记入 Section 3 + P10 breaking 清单；若 plan 不在 git 仓库 → RunBlocked "not in a git repo"（显式失败优于静默落错仓）。**CDD_WORKSPACE-only 基线用例（无 plan）不受影响；「brief 不存在 + plan 可用」用例按 plan 派生分支迁移（plan 目录临时 git init）——见 2.4。**
   - **plan 派生分支**：**有效 plan = planFile(opt) ‖ env.PLAN_FILE ‖ 前置 ledger backfill 结果**——resolveRepoRoot 的分支判断与 "provide --plan" 错误信息均基于该有效 plan（CLI 主入口 cdd-task.mjs 把 --plan 写入 env.PLAN_FILE 而非 planFile opt，故必须合并三来源）。**前置检查保留现行为**：`existsSync(plan)` 不存在 → RunBlocked "plan file not found"，先于 gitToplevel。有有效 plan → repoRoot = `gitToplevel(dirname(plan))`；解析失败 → RunBlocked "not in a git repo"（显式失败优于静默落错仓）；workspace = `<repoRoot>/.superpowers/cdd/<slug>/`。**基线测试迁移**：runner.test.mjs「brief 不存在 + plan 可用」用例现以非 git TMPDIR 作 plan 目录、靠 cwd 取 HEAD——按新语义改为 plan 目录临时 `git init` + 初始 commit（TASK_BASE 取该仓库 HEAD，语义更正确）；其余 CDD_WORKSPACE-only 用例不受影响。
   - **两者皆无** → RunBlocked："cannot resolve repo root: provide --plan or CDD_WORKSPACE"（永不回退 cwd，用户已确认破坏性）。
2. **runTask 入口顺序修正 + backfill 前置条件**：ledger backfill 提到 workspace 解析之前，但**只读 `baseEnv.CDD_LEDGER`（调用方显式注入）**——与 cdd-reference H6 env 契约一致（orchestrator 重跑时设 CDD_LEDGER）；未注入且无 planFile/PLAN_FILE → plan 不可用，维持后续既有 BLOCK 行为（implement 的 brief 缺失 BLOCK / task-review 的 plan 必需 BLOCK），不做静默兜底。**行为收紧**：此前「直设 CDD_WORKSPACE 且靠 `<workspace>/progress.md` 默认派生路径 backfill」的调用方将 BLOCK——消费者可见变更，记入 Section 3 偏差表 + P10 breaking 清单。
3. **全量下传 repoRoot**：
   - `resolveWorkspace` 改签名收 repoRoot
   - `findSuperpowersScriptsDir(repoRoot)` —— submodule 探测从项目仓库找 vendors
   - `relpathFromRepo(abs, repoRoot)` —— handoff artifacts 相对路径基于项目仓库
   - `generateBrief(plan, taskNum, briefPath, repoRoot)` —— TASK_BASE 取项目仓库 HEAD
   - `runReviewPackage(..., { cwd: repoRoot, ... })` —— bash 子进程在项目仓库内执行，上游脚本的 git log/diff 正确落在项目 A
4. **invokeCli 保持 cwd 不变**：嵌套 CLI agent 的工作目录语义与 git 解析无关（CLI 在哪个目录启动由调用方环境决定），不在本次范围。
5. **probeSkills 保持 cwd 不变（non-goal）**：skills-probe 探测的是**技能安装环境**（当前 harness 会话的 .agents/skills / plugin cache），其正确锚点是控制器会话环境而非项目仓库——#173 修的是「产物写入落错仓」，探测目标本就该跟会话走，语义不同不下传 repoRoot。

### 2.2 删除 `--prompt`（#169）

- cdd-review.mjs：删 `--prompt` case 分支（L69-71）、互斥校验（L103-107 改为仅 `--template` 必填校验）、usage/help 字符串两处（L43/L50）与**文件头注释 usage 示例（L6）**改为 `--harness <name> --template <name> [--param KEY=VALUE...] [--handoff PATH]`。
- 测试改写（review.test.mjs 15 个）：所有 `--prompt` 用例改走 `--template spec-review --param DOC=... --param PASS=...` 等价形式；「缺 prompt/未知 flag」用例改为「缺 template → exit 2」；互斥用例删除；新增「`--prompt` 为 unknown flag → exit 2」断言防回归。
- cli-task 技能随 2.3 删除后无消费者残留；全仓 grep `--prompt` 归零（排除清单对齐 overall P10 终扫：docs/superpowers/{specs,plans,tickets}/ 历史文档、**bin/engine/tests/ 中防回归断言字面量（已回写 P10 终扫排除清单）**——见验收条目）。

### 2.3 删除 cli-task 技能

- 删 `skills/cli-task/` 目录（SKILL.md + zh-CN）。
- README.md / README.zh-CN.md：删表格行。
- docs/controller-handoff.md L3：「cli-task / cli-select」→「cli-select」；**同步镜像 controller-handoff.zh-CN.md 同行**。
- skills/cli-select/SKILL.md description：「Referenced by cli-driven-development / cli-task」→「Referenced by cli-driven-development」；**同步镜像 SKILL.zh-CN.md description**。
- **scripts/lib/emit/manifests.mjs kimiInstructions 硬编码文案**：「(cli-select, cli-task, cli-driven-development)」→「(cli-select, cli-driven-development)」（随 emit 写入 .kimi-plugin/plugin.json 对外发布）。
- **scripts/lib/emit/emit.test.mjs geminiMarkdown fixture**：同步去掉 cli-task 行（P10 终扫不含 scripts/，本 phase 必须自清）。
- **GEMINI.md、.kimi-plugin/plugin.json、.agents/skills/** 由 emit 再生自动消失。

### 2.4 回归测试

**基线迁移（2 处）**：
1. runner.test.mjs「brief 不存在 + plan 可用 → auto-generate」——plan 目录由裸 TMPDIR 改为临时 `git init` 仓库 **+ 至少一个初始 commit（`git commit --allow-empty`，供 gitToplevel 解析与 generateBrief 的 HEAD/TASK_BASE——裸 init 无 HEAD 会 BLOCK 'cannot resolve HEAD'）**，TASK_BASE 断言取该仓库 HEAD。
2. runner.test.mjs「task-review review-package 不可执行」——现依赖 buildTaskEnv 从 workspace 派生的默认 CDD_LEDGER 完成 plan backfill；backfill 前置且只读显式注入后需完整迁移：fixture 的 plan 目录同样 `git init` + 初始 commit（有有效 plan 后走派生分支，workspace 落 `<repoRoot>/.superpowers/cdd/<slug>/`），baseEnv 显式注入 `CDD_LEDGER`（指向已写好的 progress.md），并**显式指定 CDD_TASK_BRIEF 到新派生 workspace 路径**（预写 brief 不在旧 env workspace 下）；到达原有「review-package not executable」断言。

其余 CDD_WORKSPACE-only 基线用例零改动。

新增（runner.test.mjs 或新建 workspace.test.mjs）：
1. **跨仓核心用例**：temp 下 init git 仓库 A、B（各含初始 commit）；plan 写入 A，`cwd=B`；dry-run runTask 断言 workspace 创建于 `<A>/.superpowers/cdd/<slug>/` 且 B 内无 `.superpowers/`。
2. **brief 归属**：同上场景 implement 模式 auto-generate brief，TASK_BASE == A 的 HEAD。
3. **BLOCKED 用例**：无 plan、无 CDD_WORKSPACE → exit 1 + "cannot resolve repo root"。
4. **CDD_WORKSPACE 直设**：temp 目录 `git init` + 初始 commit 后 env 指向它 → 断言 repoRoot 等于该目录 toplevel、workspace=env 原值；**另补裸 TMPDIR（非 git）变体**：断言 repoRoot 为 null 且流程不阻塞（容忍语义）。
5. review-package 子进程 cwd：DI scriptsDir override + 记录 spawn 时 cwd 参数断言等于 repoRoot。
6. **CDD_WORKSPACE + plan 同给用例**：env.CDD_WORKSPACE 指向目录 X、plan 在 git 仓库 A → 断言 workspace 落于 `<A>/.superpowers/cdd/<slug>/`（X 被忽略），固化 both-given 语义。
7. **plan 不存在用例**：有效 plan 路径指向不存在的文件 → RunBlocked "plan file not found"（existsSync 前置保留的直接断言）。

### Acceptance criteria

- `pnpm run validate` 绿（引擎测试经其 glob 展开入口执行，含新增 ≥5 用例；不裸用 `node --test <目录>` 形式——目录会被当作模块加载）。
- `grep -rn '\-\-prompt' packages/osuperpowers/bin` **排除 `bin/engine/tests/`**（防回归断言字面量豁免）后零命中；`packages/osuperpowers/skills packages/osuperpowers/docs scripts/lib/emit/` 零命中（模板占位 `{{...}}` 与 task_review_prefix 语义不受影响）。
- `skills/cli-task/` 不存在；README×2 / controller-handoff×2（含 zh-CN 镜像）/ cli-select description×2 / emit manifests.mjs kimiInstructions / emit.test.mjs fixture 无 cli-task 字样；**验收 grep 显式覆盖 `*.zh-CN.md` 与 `scripts/lib/emit/`**（.kimi-plugin/plugin.json 经 emit 再生后一并核验）。
- 跨仓场景手动冒烟：plan 在 A、cwd 在 B → `.superpowers/cdd/<slug>/` 只出现在 A。
- `pnpm run emit && pnpm run validate` 绿。
- 关联 #173 / #169 于 commit message。

---

## Section 3: Deviations from overall

| Overall assumption | Phase decision | Overall updated? |
|---|---|---|
| 「只修 resolveWorkspace 一处」（issue 建议粒度） | 实际 bug 模式影响 5 处，统一入口解析+全量下传 | Yes — P1 scope 含全量下传（grilling 决策，用户确认） |
| （未言明回退链） | repoRoot 永不回退 cwd；无 plan 无 workspace 即 BLOCKED（破坏性） | Yes — 同上 |
| （未言明 CDD_WORKSPACE-only 语义） | CDD_WORKSPACE 直设分支保持现语义（无 plan 时 workspace=env 值，repoRoot 允许 null 容忍下游），保基线测试不回退 | No — phase 内澄清 |
| CDD_WORKSPACE+plan 同给语义 | 旧：无 planFile opt 时 env 直设 workspace——**无论 plan 经何种来源给出（含 env.PLAN_FILE），env workspace 均不被覆盖**；新：有有效 plan 时 workspace 一并由 plan 派生值覆盖、env 被忽略（消费者可见变更） | Yes — 记入 P10 breaking 清单 |
| （未言明 backfill 来源） | ledger backfill 收紧为仅显式注入 baseEnv.CDD_LEDGER——直设 workspace 靠默认派生路径 backfill 的调用方将 BLOCK（破坏性，对齐 H6 env 契约） | Yes — 记入 P10 breaking 清单 |
| invokeCli cwd 语义 | 明确不动（与 git 解析无关），写入 non-goal | No — 澄清性记录 |

## Section 4: Notes for downstream

- P8（cli-driven-development 重构）的 deferred-disposition 门依赖本 phase 的 ledger roll-up 行为不变——已约束输出契约不变。
- P3 文档迁移时 controller-handoff.md 将搬入 skills/cli-driven-development/，届时 L3 提及行以迁移后文本为准。
- 上游 superpowers 的 sdd-workspace/review-package bash 脚本仍有同源 bug（vendored 不可改）；upstream PR 另行跟进，不在本程序。

## Section 5: Review

Rule: Fresh-Subagent Review Passes must all pass before reaching user review and writing-plans.
