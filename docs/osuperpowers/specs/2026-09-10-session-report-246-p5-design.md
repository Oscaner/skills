# P5 — CDD 编排硬化：engine 全权 artifact 写平面（base-branch 写入口 + implement 自供应 brief）+ slug 收敛 + 代码/skills 整理

- **Version**: v1.0 · 2026-09-12
- **Status**: Draft
- **Author**: [human] · Claude Opus 5 (1M context) (osuperpowers:brainstorming)
- **Parent program**: [2026-09-10-session-report-246-overall.md](./2026-09-10-session-report-246-overall.md) · v1.15
- **Depends on**: 无（七 phase 独立）；依赖 cdd-engine 当前布局（P1 已重排：bin 薄入口 + lib 分簇 + tests 顶层）与 P4 已合并的 handoff-namespace 单源

---

## Section 0: Incremental warning

> P5 increment only。跨 phase 约定见 [overall](./2026-09-10-session-report-246-overall.md)；冲突以 overall 为准。

---

## Section 1: Constraints pointer

不重复 overall 约定。约束继承：仓库语言政策（SKILL.md / 代码英文主源，本 spec 中文 Strategy B）；vendored 子模块不可改；所有改动过 `pnpm run validate`；改动 SKILL.md 后必须 `pnpm run emit` 再生 `.agents/`；消费方视角核对（base-branch.md / 编排 SKILL 为发布面）。

---

## Section 2: Design body

### 2.1 根因与统一抽象

两 finding 同源语 fail 类：**orchestrator 对 `.superpowers/**` 的 artifact 写入绕过 engine 封装**。

| | base-branch.json | brief |
|---|---|---|
| 现状写作者 | orchestrator `mkdir -p + heredoc`（determine-base / read-base 两处） | orchestrator 显式 `cdd brief --task N --plan --output` 前置调用 |
| engine 拥有？ | **零引用**（grep 全 engine 空）——无写入口、schema 无校验（base-branch.md 表 3 值 vs SKILL schema 4 值 已漂移；在野 11 个 artifact 实测：7 `conversation-context` + 2 `user-confirmed` + 1 `plan-field` + 1 `branch-upstream`——3 值表实际漏 `conversation-context`/`branch-upstream`） | 生成器在 engine（brief.mjs），但由调用方显式触发；run-task 默认路径读但缺失仅「降级例外」（T6 nit2：finalizeHandoff 不实体化） |
| 后果 | 路径易错、schema 无 enforcement、确认语义靠记忆 | 遗忘调用 / 路径不一致 → implement 上下文缺失 |

**统一原则（I6 扩展——artifact 写平面）**：engine 拥有 `.superpowers/**` 下全部 artifact 写入（handoffs / progress / lifecycle 已然）；orchestrator **零写入**，只供语义输入（base 值 / source / plan / task 索引）。两 escape 在此原则下同点收敛。

**统一形态**：
1. **单一权威层 `lib/state/workspace-artifacts.mjs`**（模仿 P4 收敛的 handoff-namespace 单源模式）：base-branch 与 brief 的路径解析 + schema 校验唯一落点（一份实现消灭 base-branch.md 3↔4 值漂移）。
2. **`cdd base-branch set` 写入口**（engine 唯一写作者）：schema 校验 + 幂等 + 自动落点。
3. **`cdd implement` 自供应 brief**：dispatch 时 engine 内建生成，不再是 orchestrator 前置步骤。
4. **幂等规则**：base 相同 → no-op（source 更新为最新，base 才是权威）；base 不同 → 拒绝，`--force` 才覆盖。

### 2.2 `workspace-artifacts.mjs` 单一权威层

**新文件 `packages/cdd-engine/lib/state/workspace-artifacts.mjs`**：

- `baseBranchPath({ workspace })` → `<workspace>/base-branch.json`
- `baseBranchSchema`：`{ base: string(非空), source: enum(4 值), confirmed_at: ISO8601 }`——canonical enum：
  ```
  plan-field | branch-upstream | conversation-context | user-confirmed
  ```
  （修正 base-branch.md schema 表 3 值缺 `conversation-context` 之漂移；SKILL schema 4 值为准。）
- `validateBaseBranch(obj)` → `{ ok:true }` | `{ ok:false, errors: [] }`
- `writeBaseBranch({ base, source, workspace, force })` → 幂等语义（§2.1-4）：目标文件不存在 → 写 + confirmed_at=now；存在且 base 同 → **重写文件但 base 不变**（source 追新、confirmed_at 保留——语义权威不被破坏，等价 no-op，非不写盘）；存在且 base 异 → 拒绝（`force` 才覆盖）。
- `briefPath({ workspace, task })` → `<workspace>/task-<N>-brief.md`（当前 run-task `CDD_TASK_BRIEF` 默认值同一派生，单一真相）。

### 2.3 `cdd base-branch set` 写入口（F10）

**bin/cdd.mjs + lib/cli/parse.mjs 注册**：

```bash
cdd base-branch set --base <branch> --source <enum> [--plan <path>] [--force]
cdd base-branch get --plan <path> | --scope standalone --slug <slug>
```

- **`set` CDD 场景落点**：`--plan <path>` → `resolveWorkspace(plan)` → `.superpowers/cdd/<slug>/base-branch.json`（slug = workspaceSlug(plan)，§2.4 收敛后 `-plan`/`-design` 后缀均正确归一）。**决策理据（grilling Q3-A）**：base-branch.json 现有双写场景——CDD determine-base 与 standalone finishing read-base——统一入同一 CLI 双落点，schema 校验 + 幂等共用一套，避免 standalone 侧残留手写漏洞面。
- **`set` standalone 落点**（grilling Q3-A 双落点）：`--scope standalone --slug <sanitized>` → `<gitRoot>/.superpowers/standalone/<slug>/base-branch.json`（finishing read-base 推断后委托写入）。
- **`get`**：双场景皆支持（与 `set` 同 flag 语义）；**目标文件缺失 → exit 非零 + 明确报「base-branch artifact 缺失」**（orchestrator 判定未确定 base，走推断链路）；**schema 非法 → exit 非零 + errors**（orchestrator 停车修复，不静默返回坏值）。
- **flag 组合边界**：`--plan`（CDD 场景）与 `--scope standalone --slug`（standalone 场景）互斥；两者均缺 → 默认尝试 `--plan` 语义（无 `--plan` → 校验错 + exit 非零，明确报「CDD 场景需 --plan，standalone 场景需 --scope」）；standalone 组下 `--base`/`--source`（set）/无参件（get）必填。
- 校验失败 → schema error + exit 非零；`base` 相同 → 重写文件但 base 不变（source 追新、confirmed_at 保留，不触发 force——「no-op 等价」指语义权威不被破坏，非不写盘）；`base` 异无 `--force` → 拒绝。

**消费方改写（orchestrator 只读不写）**：
- `cli-driven-development/SKILL.md` `determine-base`：推断逻辑保留（plan-field → branch-upstream → conversation → ask user），**写路径委托 `cdd base-branch set`**。
- `finishing/SKILL.md` `read-base`：推断逻辑保留，**写路径委托 `cdd base-branch set --scope standalone`**。

### 2.4 slug 收敛（用户指令：AI 在 plan 文档加 `-plan.md` 后缀）

`workspaceSlug(doc)`（`lib/handoff/naming.mjs`）现状：去 `.md` → 去尾 `-design`。**扩展为去 `.md` → strip 尾 `-plan` 或 `-design`（单 suffix）**：

```text
xxx-p5.md                 → xxx-p5
xxx-p5-design.md          → xxx-p5
xxx-p5-plan.md            → xxx-p5   （新增覆盖）
```

- 统一 strip 守卫：两个 suffix 均仅剥离一次（`-design.md` / `-plan.md` 尾部），不级联（防 `xxx-plan-plan`）。
- **两处派生点全部收敛到 `workspaceSlug`**（单一来源，缺一就会制造「Stopping prev 读 A、runner 写 B」的互找失败）：
  1. `lib/runner/run-task.mjs` `resolveWorkspace`（L94 `path.basename(plan, ".md")`）——**所有 implement/review/fix dispatch 的实际 workspace 真源**：
     ```js
     const slug = workspaceSlug(plan);   // 原 path.basename(plan, ".md") 改指
     ```
  2. `lib/cli/review.mjs` task 路径（L199 `path.basename(opts.plan, ".md")`）→ 改走同一 `workspaceSlug(opts.plan)`。
  （review.mjs 与 run-task.mjs 同源收敛后，`xxx-plan.md` plan 的 task/review workspace 恒一致。）
- base-branch.md 的 slug 表述同步见 §2.7.3（CDD workspace slug 适用 workspaceSlug 规则，与 standalone 分支名 sanitize 分列）。

**P4 守卫交叉面（validator sync）**：`scripts/validate/overall-consistency.mjs` `checkDocExistence` 的 `planSuffix` glob 现为 `-<slug>-<id>.md`（仅匹配 `…-p5.md` 无后缀形）；`anchorScanFiles`（L435，④a scan 面）的同款正则 `-${slug}-p\d+(?:-design)?\.md$` 亦不命中 `-plan` 变体。`-plan` 命名约定下 plan 文档将为 `…-<id>-plan.md`，check ② 必抛 `missing plan doc`、④a 扫描面漏 on-plan 文档。**本 phase 同步扩展两处为双形**：

```js
// checkDocExistence
const planSuffixes = (id) => [`-${slug}-${id.toLowerCase()}.md`, `-${slug}-${id.toLowerCase()}-plan.md`];
// hits = endsWith(任一 s)；>1 命中（无后缀形 + -plan 形并存）→ duplicate
// anchorScanFiles —— 同 slug 全部 phase 文档：`-p\d+` + 尾 `-design` / `-plan` / 无后缀
const re = new RegExp(`-${slug}-p\\d+(?:-design|-plan)?\\.md$`);
const designRe = new RegExp(`-${slug}-p\\d+-design\\.md$`);   // ④a design 专用仍可用专属形
```

（`-design.md` 文档 glob 同理不受影响；该同步列入 §2.8 acceptance 与 §2.9 测试矩阵。）

### 2.5 implement 自供应 brief（F11）

`lib/runner/run-task.mjs`：plan 定稿后（`resolveRepoRoot` 得出有效 plan——含 `--plan`/`PLAN_FILE`/ledger backfill 三源）dispatch 前插入 `generateBrief(plan, taskNum, briefPath, repoRoot)`：

- **触发**：**有效 plan 存在（三源任一）→ 每次自动重新生成**（grilling Q4-A 决策理据：机械提取幂等——同 plan + 同 HEAD 内容恒定；re-dispatch 自动追平 HEAD 与 plan 演进，review/fix 读 current brief；B 案「缺失才生成」会留 TASK_BASE 陈旧，C 案「失败硬阻断」对纯 workspace 过狠）。
- 缺省 plan（纯 `CDD_WORKSPACE` 模式）→ 跳过生成、读既有 brief（兼容保持）。
- 失败语义：生成错误（plan 缺失 / task 越界）→ BLOCKED（不再静默降级——T6 nit2 的「brief 缺失 → finalizeHandoff 不实体化」降级路径在 plan 已知时不再可达）。
- `cdd brief` 独立 CLI 保留（research / manual 场景）——`runBriefCli` 迁 `lib/cli/brief.mjs`（§2.7.3），生成器仍是 `lib/brief.mjs:generateBrief`。

### 2.6 代码目录/文件/CLI 整理（用户指令：迭代后目录/文件/CLI 变乱）

| # | 乱点 | 现状 | 整理 |
|---|---|---|---|
| 2.6.1 | `bin/lib/` 死空目录 | initial scaffold `.gitkeep` 空洞残留（P1 re-org 后未清；`.npmignore` 已排除） | `git rm bin/lib/.gitkeep` + 同源兄弟 `bin/.gitkeep`（`bin/` 现含 cdd.mjs，keep 同为 0 字节空洞残留，`git ls-files` 在册）一并删——两个 keep 皆入本 phase 清理面 |
| 2.6.2 | 共享守卫宿主错位 | `lib/cli/review.mjs` = review 派发 + **守卫事实源**（4 个 lib 消费方从它 import，实测依赖集：research `(requireHostHarness, DRY_RUN)` · branch-review `(DRY_RUN, reviewStoppingGuard)` · parse `(runReview, requireHostHarness, intTask, DRY_RUN)` · fix `(requireHostHarness, resolveTargetDoc, DRY_RUN)`；`stoppedExit3`/`existingRoundHandoff`/`blockerCount` 仅 review.mjs 内部使用）；另 `tests/host-detection.test.mjs` L17 **测试 seam 直指 review.mjs 的 `detectCurrentHarness`** | 拆 **`lib/cli/shared.mjs`**：detect/requireHostHarness + DRY_RUN + intTask + resolveTargetDoc + Stopping 守卫（reviewStoppingGuard）全归一为外部消费集；`stoppedExit3`/`existingRoundHandoff`/`blockerCount` 随 review.mjs 保留内部私有；4 lib 消费方改指 shared；`tests/host-detection.test.mjs` seam 同步改指 shared（注释「守卫簇移 review.mjs」→ shared）；review.mjs 收敛纯 review 派发 |
| 2.6.3 | `lib/brief.mjs` 职责混住 | 生成器 `generateBrief`/`validateBrief` + CLI 处理器 `runBriefCli` + 直调 guard 同文件（runBriefCli 已是 parse 官方入口，但 `tests/brief.test.mjs` `cliRun` helper **依赖 `node lib/brief.mjs` 直调 guard** 跑 2 个 CLI-entry 测试——L123 success / L139 missing-task——guard 非死码，移除即 2 测试红） | `lib/brief.mjs` 只留生成器（implement 自供应 / brief CLI / research 三消费方复用）；`runBriefCli` → **`lib/cli/brief.mjs`**；`tests/brief.test.mjs` `execFileSync(node, lib/brief.mjs)` 两处改指 `lib/cli/brief.mjs`（BRIEF_MJS const 一处改）；迁移后 `lib/brief.mjs` 的直调 guard 与 dead import 方随同删除 |
| 2.6.4 | 子命令组织 | `implement/review/fix/research/brief` 平铺；P5 新增 base-branch 为纯 artifact 命令 | **`cdd base-branch set/get`** 动词化，与 `review/fix` 风格一致；SUBCOMMAND_USAGE 补 base-branch 行；CLI 标题改 `implement/review/fix/research/brief/base-branch` |
| 2.6.5 | tests 布局 | tests 顶层平铺（P1 定案不破） | `tests/base-branch.test.mjs`（新）；`tests/brief.test.mjs` CLI 入口三例随 `runBriefCli` 迁 `lib/cli/brief.mjs`（同文件改 execFileSync 目标，不挪断言文件） |

### 2.7 skills/docs 收敛（用户指令：减少死说明 + 臃肿态）

#### 2.7.1 `cli-driven-development/SKILL.md`

| 节点 | 现状（臃肿/死说明） | 收敛 |
|---|---|---|
| `determine-base` | 内联完整 schema `{base, source:…}` + 4-值枚举 + slug 规则 | 委托 [base-branch.md](./docs/base-branch.md)；sink 路径：推断 → `cdd base-branch set --base --source --plan` |
| `dispatch-mode` | step 1「Generate brief: cdd brief --task N --plan …」——implement 前置手动触发（F11 靶） | **删除**，implement 自供应（§2.5）；step 重新编号 |
| `branch-review` | Do 内 base 来源描述 | 委托 base-branch.md（`cdd base-branch get` 读路径） |
| HTML 注释/死残留 | — | 全 SKILL 扫一遍，清理编辑残留（如 §D/§E 过长历史注解折叠或标注有效） |

#### 2.7.2 `finishing/SKILL.md` `read-base`

内联推断序列（① ② ③ ④）+ slug sanitize 五规则全文重复 base-branch.md（两处漂移面）→ **委托 base-branch.md 一条**；standalone 写路径 → `cdd base-branch set --scope standalone --slug <sanitized>`。`base-branch.json` schema 引用删内联（指向 base-branch.md）。

#### 2.7.3 `cli-driven-development/docs/base-branch.md`

- schema 表修 **4 值 enum**（补 `conversation-context`，修漂移）；
- **新增 CLI 用法节**：`cdd base-branch set/get` 双场景（CDD `--plan` / standalone `--scope`），写入口语义（幂等 / --force / 校验失败 error）；
- **两个 slug 机制分列**（不再同段混写）：
  - Scope Resolution 表的「CDD workspace slug」行 → 指向 engine `workspaceSlug` 规则（去 `.md` + 尾 `-design`/`-plan` 单 strip，§2.4）；
  - Slug Sanitize Rules 段 → 仅保留 standalone 分支名 → 路径段的 sanitize 五步（lowercase/replace/trim/collapse/truncate），不混入 workspaceSlug。
- 删死说明：`Consumer Integration` 的 CDD startup phase (P8) 引用与当前架构对齐（determine-base 已是 SKILL 节点非独立 phase）。

#### 2.7.4 死说明全局清查（本次改动触及面）

新指令「update it → 同时整理 skills 死说明」，扫描全集：
- 所有 `cdd brief` 显式前置触发描述 → 改为 implement 自供应描述（仅 `cli-driven-development/SKILL.md` 命中，见 2.7.1）。
- `base-branch.json` heredoc / 手工落盘描述 → 全量改为 CLI 委托（`cli-driven-development` + `finishing` + docs 已列）。
- **`skills/_docs/review.md` §Handoff Output 的 workspace slug 描述**（spec-review/plan-review 跨切引用的规则句）：「slug = reviewed doc filename with `.md` and a trailing `-design` stripped」→ 同步为「`.md` + 尾 `-design`/`-plan` 之一 strip」（与 §2.4 workspaceSlug 新规则一致；该文件同样被本 phase 触及，属 §2.7 收敛面）。
- 其他 skill（brainstorming / writing-plans / report-issue / cli-research / init）确认与本次变更交集为 0（base-branch/brief 语义不入其 Node），仅在本节背书「清查无残留」，**不动**（YAGNI）。

### 2.8 acceptance criteria

- 每次 CDD 起点 `.superpowers/cdd/<slug>/base-branch.json` 由 `cdd base-branch set` 产出（orchestrator 角色零 heredoc）；`determine-base` / `read-base` SKILL 文档不再出现 heredoc 写入指令。
- `cdd base-branch set/get` schema 校验：非法 source / 缺 target → exit 非零 + errors；幂等矩阵全绿（新建 / 同 base source 追新不破坏权威 / base 异拒 / `--force` 覆盖 / standalone 落点 / `get` 缺失 exit 非零）。
- `cdd implement --plan <path>` 无前置 brief 调用仍产出 `task-N-brief.md`（含 TASK_BASE）；纯 workspace 模式兼容。
- `--plan` 传 `xxx-p5-plan.md` → workspace slug `xxx-p5`（run-task `resolveWorkspace` 与 review.mjs task 路径同源收敛，task-review 不因后缀分叉丢 Stopping；review.mjs 与 runner workspace 写读一致）。
- P4 守卫交叉：overall-consistency `checkDocExistence` planSuffix glob 双形（无后缀 + `-plan` 变体）全绿（P5 自身 closeout plan 命名经 either 形通过，duplicate 断言覆盖并存）。
- skills 面：`dispatch-mode` 无 brief 前置步；`determine-base`/`read-base` 委托 base-branch.md；base-branch.md enum 4 值、无 heredoc 残留；`_docs/review.md` §Handoff Output slug 描述同步 `-plan` 单 strip。
- 代码面：`bin/lib/` 与 `bin/.gitkeep` 不存在；`lib/cli/shared.mjs` 为唯一守卫源（4 lib 消费方 + host-detection 测试 seam 无 review.mjs 直指守卫）；`lib/brief.mjs` 无 CLI/直调 guard 且 tests/brief.test.mjs CLI 两例已迁移 lib/cli/brief.mjs。
- `cdd --help` 含 base-branch；SUBCOMMAND_USAGE 覆盖。
- `pnpm run validate` 全绿（13 块）+ emit 无 drift + cdd-engine suite 全绿。

### 2.9 test matrix

| 用例 | 文件 | 断言 |
|---|---|---|
| doc 派生 | `tests/handoff-naming.test.mjs` | `workspaceSlug("xxx-p5.md")` = `workspaceSlug("xxx-p5-design.md")` = `workspaceSlug("xxx-p5-plan.md")` = `xxx-p5`；单 suffix 不级联 |
| runner workspace 同源 | `tests/runner.test.mjs` | `resolveWorkspace({plan:"xxx-p5-plan.md",…})` 与 `resolveWorkspace({plan:"xxx-p5.md",…})` slug 收敛同值 |
| base-branch 写 | `tests/base-branch.test.mjs` | 新建写 + confirmed_at; 同 base source 追新（base 权威不变）; base 异拒绝; `--force` 覆盖; standalone 落点; schema 非法 exit 非零; flag 互斥/缺参边界; `get` 缺失/schema 非法 exit 非零 |
| CLI set/get | `tests/cdd.test.mjs` | `cdd base-branch set --base develop --source plan-field --plan <p>` → 文件 + exit 0; `get` JSON 往返; SUBCOMMAND_USAGE 含 base-branch |
| implement 自 brief | `tests/task.test.mjs` | `cdd implement --task N --plan <p>` 无前置 brief → brief 落盘 + TASK_BASE 存在 |
| review task slug | `tests/cli-shared.test.mjs` | `--plan xxx-p5-plan.md` → task workspace `cdd/xxx-p5`（Stopping prev 命中） |
| brief CLI 迁移 | `tests/brief.test.mjs` | `execFileSync(node, lib/cli/brief.mjs)` CLI 两例全绿（L123 success / L139 missing-task）；`node lib/brief.mjs` 无直调 guard（无静默 exit 0） |
| validator glob | `tests/overall-consistency` fixture | plan doc `…-p1-plan.md` 经 planSuffix 双形 glob → 无 missing/duplicate |
| 死码清理 | `tests/cli-shape.test.mjs` | `bin/lib` + `bin/.gitkeep` 不存在; `lib/brief.mjs` 无直调 guard; shared 守卫导出齐 |

---

## Section 3: Deviations from overall

| Overall assumption | Phase decision | Overall updated? |
|---|---|---|
| P5 scope：base-branch 显式写入口 + implement 内建 brief | 高维统一：engine 全权 artifact 写平面（workspace-artifacts 单一权威 + 双场景写入口 + 幂等规则）；扩展 slug 收敛（用户指令：`-plan.md` 后缀 trim）+ 代码目录/文件/CLI 整理 + skills 死说明清理（用户指令：迭代后变乱/臃肿） | Yes — 随 commit-spec 同步 overall v1.16（本 spec §2.9 各 acceptance 验收时点与 change-history 条目一致） |

---

## Section 4: Notes for downstream

- P3（fix mode 存续）独立性不受影响；P4 守卫不感知本 phase 新增 artifact（base-branch.json 不被 overall-consistency 扫描——其扫描面为 overall + 同 slug phase 文档，非 workspace 工件）。
- `cdd base-branch set/get` 命令名与 `review/fix` 动词风格对齐；未来如需更多 base 操作（如 `--update-source`）在 `set` 下加 flag，不新开命令。
- 消费方视角：已发布插件客户端的 orchestrator 现假设 `cdd brief` 前置调用——升级后该调用可保留（无破坏，brief 被重新生成但内容恒定）或删除（推荐）。

---

## Section 5: Review

Rule: Fresh-Subagent Review Passes must all pass before reaching user review and writing-plans.