# CDD Engine 重构 — P6 P4-dogfood 修复 + Handoff 契约统一 设计

- **Version**: v1.3 · 2026-09-08（v1.0 起草 · v1.1 spec-review r1 修正 · v1.2 spec-review r2 blocker=0 修正 · v1.3 writing-plans grilling 高维度：workspace 归入 artifact 契约派生层；详细见 §5 self-review 记录）
- **Status**: Draft
- **Author**: [human] · Claude Opus 4.8 (osuperpowers:brainstorming)
- **Parent program**: [2026-09-04-cdd-engine-overhaul-overall.md](2026-09-04-cdd-engine-overhaul-overall.md) · **v1.21**（起草时 v1.20；§3 deviations 已回写 v1.20 + v1.21）
- **Depends on**: P1–P4 全部已合（HEAD = develop 528d499, P4 PR #244）

---

## Section 0: Incremental warning

P6 increment only。Cross-phase conventions in overall（v1.21）；overall wins on conflict。本 phase 修复 P4 执行期 dogfood 产出的 F1–F6 六个 findings，并基于「允许破坏性更新 / 不留技术债务」将 F3/F6 上探为 **Handoff 契约统一**（见 §1 / §2.3），并在 writing-plans grilling 阶段将 **Workspace 归入同一契约派生层**（见 §2.1。P5（Gate 移除）保持不动。

---

## Section 1: Constraints pointer

- 仓库语言政策：SKILL.md / docs 英文主源；本 spec 中文（Strategy B）
- 不 commit 除非用户明确要求；每 task 结束 `pnpm run validate` 绿；changeset 逐 phase
- vendored 子模块不可改
- 继承 overall 的 review 统一契约（URC / `_docs/review.md` Review Stopping）
- **本 phase 额外决策前提**（用户 grilling 确认）：允许破坏性更新、确保最佳实践、不留技术债务 — 上探层面的命名/契约重构均不为此妥协

---

## Section 2: Design body

### 2.1 Handoff 命名 + Workspace 契约（canonical）— 核心统一（F3/F6 上探）

**根因**：handoff 文件命名由 6 处各自为政的字面量产生（`runner.mjs` buildTaskEnv / prevHandoffPath、`cdd.mjs` spec·plan·branch、`docs-runner.mjs` fallback、`review-loop.mjs` reviewRoundPattern），writer 与 scanner 可在 P3→P4 式迁移时静默分歧；docs fix 命名 `doc-fix-{round}` 丢 type、round 恒 1；task 命名含冗余 `task-review` 段。**Workspace 同样散点**：4 处推导点（cdd.mjs docs/task/branch + runner.mjs）、2 个根（`.superpowers/cdd/<slug>/` 与 flat `.superpowers/docs-review/`）；flat root 无 per-phase 隔离导致跨 phase round 污染（P6 实测：P4 的 `plan-1/2.json` 把 P6 plan review 首轮顶到 3）。

**决策**：新建单一 canonical `packages/cdd-engine/templates/handoff-namespace.json`，一表统治全部 handoff 家族（name / round / status / schema / return / fixFamily / prev）+ **workspace 顶层字段（workspaceRoot / slugRule）**。派生层 `packages/cdd-engine/bin/lib/handoff-naming.mjs` 暴露**五个**纯函数，全部消费 canonical；**name 是唯一真相，roundPattern 由 name 派生；workspace 是唯一真相，slug 由被审文档推出** — writer/scanner 结构上不可能分歧，workspace 不再有第二处推导。

**canonical 结构**（示例形状）：

```jsonc
{
  "schema": 1,
  // Workspace 顶层契约：单根 + slug 推导规则（全部 handoff 家族共享）
  "workspaceRoot": ".superpowers/cdd",
  "slugRule": "strip .md, then strip trailing -design",   // 被审文档文件名 → phase slug（spec/plan 收敛同值）
  "families": {
    "implement.task": { "name": "task-{task}-implement.json",   "round": "fixed",   "status": "contract", "schema": "cdd" },
    "review.task":    { "name": "task-{task}-review-{round}.json", "round": "increment", "status": "rollup",  "schema": "cdd",
                        "return": "h1",
                        "fixFamily": "fix.task",   // 该 review 的 fix 落点（fixTemplate 唯一定义在 fix 族）
                        // prev 的 key=轮次档位（round1 / R），value=prev 依赖表达式 `family:round换算`
                        //   round1 = 该 review 的首轮依赖；R = 对任意第 R 轮生效；:R-1 表示「relative round」
                        "prev": { "round1": "implement.task", "roundR": "fix.task:R-1" } },
    "fix.task":       { "name": "task-{task}-fix-{round}.json", "round": "source",  "status": "contract", "schema": "cdd", "fixTemplate": "fix",
                        // source round + prev: 该 fix 的 round 与 依赖从它回应的 review family 解析
                        "prev": { "roundR": "review.task:R" } },
    "review.spec":    { "name": "spec-review-{round}.json",     "round": "increment", "status": "rollup",  "schema": "docs", "return": "json",
                        "fixFamily": "fix.spec" },
    "fix.spec":       { "name": "spec-fix-{round}.json",        "round": "source",  "status": "contract", "schema": "docs", "return": "json", "fixTemplate": "doc-fix",
                        "prev": { "roundR": "review.spec:R" } },
    "review.plan":    { "name": "plan-review-{round}.json",     "round": "increment", "status": "rollup",  "schema": "docs", "return": "json",
                        "fixFamily": "fix.plan" },
    "fix.plan":       { "name": "plan-fix-{round}.json",        "round": "source",  "status": "contract", "schema": "docs", "return": "json", "fixTemplate": "doc-fix",
                        "prev": { "roundR": "review.plan:R" } },
    "review.branch":  { "name": "branch-review-{base7}..{head7}-r{round}.json", "round": "increment", "status": "rollup", "schema": "cdd", "return": "h1" }
  }
}
```
> **fixTemplate 单点**：仅定义在 fix 族；review 派发需要时经 `fixFamily` 引用解析（consumer 也按 §2.2 从 fix 族取）——同字段不双处出现。

**命名统一终态**（type-op-round 自描述）：
- `spec-review-{R}` / `spec-fix-{R}` / `plan-review-{R}` / `plan-fix-{R}`（恢复 P3 时代语义正确的命名 — P4 退化为 `spec-1`/`plan-1`/`doc-fix-1` 是 regression，一并修正）
- `task-{N}-implement` / `task-{N}-review-{R}` / `task-{N}-fix-{R}`（去 `task-review` 冗余段）
- `branch-review-{base7}..{head7}-r{R}` 不变

**round 三语义**：`fixed`（implement 恒 1 单次）· `increment`（resolveNextRound 扫描自增）· `source`（fix 的 round = 源 review handoff 的 round，`--findings spec-review-2` → `spec-fix-2.json`；同轮 BLOCKED 重试写同名同槽，证据即该轮 notes）。

**派生函数（五个，全部消费 canonical）**：
- `handoffName(op, type, params)` → 文件名（填占位，type→family 查找）
- `roundPattern(op, type, opts)` → RegExp，由 `name` 派生（固定段 escape + 占位符按 op/type 映射），**占位符翻译规则两种形态**：
  - **scan 形态**（给 resolveNextRound）：`{round}`→`(\d+)`，`{task}`→`\d+`，`{base7}`/`{head7}`→`[0-9a-f]{7}`，ref-agnostic（branch 的 `{base7}..{head7}` 段→`[0-9a-f]{7}\.\.[0-9a-f]{7}`）——扫描 workspace 找下一 round
  - **concrete 形态**（给 Stopping prev 读取 / `--round` 校验）：占位符经 `opts` 具体化（`{task}`→`5`，`{base7}`→`abc1234`），精确匹配特定 ref——prev 文件路径校验
- `resolveNextRound(workspace, op, type, opts)` → maxR+1（替代 review-loop 现有实现，行为等价，round 语义入表）
- `prevHandoffPath(workspace, op, type, round, opts)` → prev 依赖（替代 runner 的 prevHandoffPath）
- `resolveWorkspace(doc)` → `<repoRoot>/<workspaceRoot>/<slug>/`（第五派生；slug = workspaceSlug(doc) 按 slugRule：被审文档文件名去 `.md`、再去尾 `-design` — spec/plan 收敛同值；只依赖文件名，不依赖 plan 文件存在；替代 cdd.mjs 四处 + runner.mjs resolveWorkspace 的全部推导）
  - **两种 prev 机制划界（同一函数名内含语义拆分）**：
    - **同族 round-1 prev（Review Stopping 判定用）**：review 族对任意 type 的「上一轮 review」= `handoffName(同族, round-1, concreteParams)` 直接算术解析（如 reviewer.spec R 的 prev = `spec-review-(R-1).json`），**不走 canonical prev 表**（review.spec/plan/branch 无 prev 行）
    - **跨族 prev（依赖链用）**：fix → 源 review、task review round1 → implement、task review roundR → fix:R-1 —— 走 canonical `prev` 表 / prevHandoffPath
- 替换点 3/4/7（Stopping prev 读取）明确用「同族 round-1 算术」而非泛称 prevHandoffPath；替换点 2/9/10（跨族依赖）用 prev 表 —— 避免两机制共用一个函数名造成 reader 全空
- **新增替换点 11 — `cdd.mjs` runFix（spec/plan fix round 链）**：`--findings spec-review-2.json` → `roundPattern("review", type, scan)` 解析 round=2 → `handoffName("fix", type, {round: 2})` 显式传给 runDocsTask 的 handoffPath——fix round = 源 review round 的「两步链」明确归属

**替换点（全部命名字面量站点 — writer + scanner）**：
1. `runner.mjs` buildTaskEnv 的 handoffFile 拼装 → `handoffName(mode→op, "task", ...)`，implement 特例消失
2. `runner.mjs` prevHandoffPath → `prevHandoffPath(...)`
3. `cdd.mjs` spec/plan review 的 `path.join(ws, \`${type}-${round}.json\`)`（write + Stopping prev 读取）→ `handoffName("review", type, {round})` / `prevHandoffPath(...)`
4. `cdd.mjs` branch（write + prev 读取）→ `handoffName("review", "branch", {base7,head7,round})` / `prevHandoffPath(...)`
5. `docs-runner.mjs` fallback（`\`${template}-${round}\``）→ **删除**；cdd.mjs 传参统一显式传 handoffPath（与 review 对称）；`doc-fix` 退位为纯模板名（reviews.json fixTemplate 指向）
6. `review-loop.mjs` reviewRoundPattern/resolveNextRound → `roundPattern`/`resolveNextRound`（统一入口，type-op 两参）
7. **`cdd.mjs` existingRoundHandoff**（`path.join(ws, \`${type}-${round}.json\`)`，spec/plan Stopping prev）→ 派生 prevHandoffPath
8. **`runner.mjs` handoffStatus**（`task-${taskNum}-task-review-${reviewRound}.json` + `rounds["task-review"]` 键，F1 回写与 isTaskPending 的读取面）→ canonical 族名 + `rounds["review"]` 键
9. **`cdd.mjs` task Stopping prev 读取**（`task-${opts.task}-task-review-${prevR}.json`）→ 派生 prevHandoffPath
10. `runner.mjs` 的 task prev 读取（`task-${task}-fix-${round-1}.json`）→ 派生 prevHandoffPath
11. **`cdd.mjs` `docsReviewWorkspace()` 签名删除** → 派生 `resolveWorkspace(doc)`（spec/plan review 传 doc、task/branch 传 plan）
12. **`cdd.mjs` task/branch workspace 拼装**（:173/:217 `path.join(gitToplevel, ".superpowers", "cdd", slug)`）→ `resolveWorkspace(opts.plan)`
13. **`runner.mjs` `resolveWorkspace`**（plan→slug 拼装）→ 复用 `handoff-naming.resolveWorkspace`（或委托同一 workspaceSlug helper）
14. **`docs-runner.mjs` 无 workspace 依赖**（handoffPath 由调用方显式传；workspace 仅作 prompt 注入）→ 不改，cwd 基线仍 gitToplevel

> **reader 侧必清**：命名改 canonical 后，若 reader（existingRoundHandoff / handoffStatus / Stopping prev 读取）仍按旧格式构文件名，spec/plan 与 task 的 Review Stopping prev 解析全空（guard 静默失效）、handoffStatus 恒 MISSING（F1 回写与 pending 判定全断）。「writer 与 scanner 结构上不可能分歧」对 9 个站点全部成立的前提是 reader 全走派生函数。**迁移后残留 grep 必须零命中**：旧 mode 子串 `task-review` 与旧命名 pattern（`spec-1\.json`/`plan-1\.json`/`doc-fix-`）在 `packages/cdd-engine`（bin + templates + tests）中为零（断言规格见 §2.6）。

**round-trip guard（vitest）**：`handoffName` 产出必被 `roundPattern` 匹配；写入 `spec-review-1.json` 后 `resolveNextRound` → 2。file-system 级回环闭合。

### 2.2 `reviews.json` 裁轴

**决策**：`reviews.json` 从混轴（content + artifact）裁为**纯 review 判据契约**：

| 现字段 | 归属 | 去向 |
|---|---|---|
| `lensEnum` / `axesGuide` / `ref` | review 内容 | **留 reviews.json** |
| `returnMode`（h1 vs json） | artifact 回传合同 | **迁 canonical**（`return` 字段） |
| `handoffType`（cdd vs docs） | artifact schema 族 | **迁 canonical**（`schema` 字段） |
| `fixTemplate` | artifact 渲染模板 | **迁 canonical**（fix 族 `fixTemplate`） |

- **两 canonical 各守一轴**：handoff-namespace.json = artifact 契约（name / round / status / schema / return / fixTemplate / prev）；reviews.json = 内容契约（lens / axes / ref）
- consumer 同步改读源：`cdd.mjs` runFix 从 canonical fix 族取 fixTemplate；`templates.mjs`/`cdd.mjs` 从 canonical review 族取 schema/return；`docs-runner` HANDOFF_STUB 注入从 canonical 取 schema 族
- 不删 reviews.json（仍是 review 判据 SSoT，P3 合并六文件的成果保留）

### 2.3 status 单一权威（F1 + F3 合并）

**原则**：`status` 是 **engine 派生的元数据，不是 agent 自由文本** — 所有模式统一为「engine 是 status 唯一权威」，但派生规则按模式区分：

| 模式 | status 来源 | 证据通道 |
|---|---|---|
| review 型（task/spec/plan/branch） | `rollupStatus(findings, unverifiable, planConflicts)` | findings 裁决（agent 产出 findings，engine 推 verdict） |
| work 型（implement/fix） | agent 声明 + **engine 契约校验否决** | commit-contract 结构校验（validateCommitContract：dirty / head mismatch → rewrite BLOCKED） |

**为什么 work 型不 rollup**（语义论证）：
- implement 的 `findings` 结构恒 `[]` → rollupStatus 恒 APPROVED，**空派生无信息**
- fix 的 `findings` 是**剩余书签**（留给 re-review 的输入），不是 fix 自己的裁决；「修复质量」恰是 URC 隔离给 re-review 的职责
- 分水岭 = 是否存在可验证工件：review 输出即 findings（verdict 可去冗余）；implement/fix 输出是工作本身（engine 只能验证 commit-contract 结构，不能判正确性）

**实现面**：
1. `contract.mjs` `rollupStatus`（现死代码）在生产路径激活：docs-runner（spec/plan review）+ runner（task-task-review）+ cdd.mjs（branch）在 agent 写回 handoff、engine 读回时重算 status 并覆写持久化
   - **覆写豁免集（SP-4 失败轮次防护，必须）**：engine 仅对「exit-0 且 findings 载体现存」的 handoff 做 rollup；以下一律**不覆写**：
     - engine 自写 BLOCKED/TIMEOUT（docs-runner 缺文件/schema 无效分支、runner 8.5/8.8/10/10.5）
     - agent status ∈ {`BLOCKED`, `TIMEOUT`}（agent 自我声明失败的合法可重发轮次）
   - 触发条件收紧为：`findings.length > 0` **且** status ∈ {`APPROVED`, `CHANGES_REQUESTED`} 时才 rollup 覆写（`findings:[]` 的空载 handoff 不做 rollup，防 `rollupStatus([])→APPROVED` 把失败轮次误判为通过 → reviewStoppingGuard 误锁重发）
   - §2.9 risk #3 回归清单补：SP-4 失败轮次（BLOCKED/TIMEOUT + findings:[]）在 rollup 覆写后仍保持原 status、可重发
2. 两个 handoff schema（cdd-handoff-schema.json / docs-handoff-schema.json）`status` 改 conditional：review 型可缺省（engine 填充）或允许 agent 写（engine 覆写）；implement/fix 仍 required
3. review.md Self-validate 不强求 agent 写与 findings 一致的 status（findings 是内容，status 是派生）
4. `reviewStoppingGuard` / SKILL handoff-status 路由 / H1 全读派生值 — **F3 的「status 与 severity 漂移」整类消失**

### 2.4 implement handoff 实体化 + review/fix HARD GATE（F4）

**根因**：Bug C 族反复发作的根因是「agent 被要求写一个重复 H1 的 JSON 文件」——implement 的 handoff 字段几乎全部是 engine 已知 state（task/phase/commits/base= TASK_BASE/head=git、findings=[]），只有 status/artifacts/blocker 是 H1 内容。让 agent 写文件 = 双写 + 遗漏面。

**决策（Y 分层正确）**：
- **implement**：agent 只返回 H1 四行（它本来就必出）；**runner 从 H1 + TASK_BASE（brief）+ git HEAD 实体化 `task-{N}-implement.json`**。implement.md 删「手写 JSON 到 {{HANDOFF}}」块 → 「implement 缺 handoff」结构上不可能。
  **commits 单一权威 / H1 双源闭合**：实体化时 `commits.base` **明示取 brief TASK_BASE**（agent H1 的 base 不作权威）、`commits.head` 取 git HEAD（引擎读，非 agent 声称）→ implement 内部 `handoff.commits.head === 实际 HEAD` 恒等，**commit-contract 对 implement 收敛为 dirty-only**（与 task-review 同，head 校验对 implement 无信息量）；head 校验仅对 fix（agent-written head，存在供应商声称）保留。**H1 输出改用 `h1FromHandoff` 从实体化 handoff 重发**（对齐 §2.3 item 4「H1 全读派生值」，杜绝 H1/handoff commits 双源分歧）。
  **evidence-gate 保留落点**：原 implement.md「Segment: implement」的 evidence-gate 契约（Complex/behavior_change:true → hard：require command/passed/exit_code；Simple → soft WARN）**前移到 runner 实体化读回路径** —— runner 实体化 handoff 时读取 `task-{N}-test-evidence.json`，按 brief 复杂度档位校验（hard 缺字段 → 覆写 BLOCKED「test_evidence gate: hard 要求 command/passed/exit_code」；soft 缺 → 仅 H1 侧 WARN 记录）。模板侧相应删去 handoff JSON 手写指示，保留 evidence-gate 指引段（说明 engine 读回校验行为）——gate 语义不从模板丢失。
- **review/fix**：findings 是大载荷（spec 大文档 review 若走 stdout 有截断风险），文件写保留；但按 fix.md 已实证的 HARD GATE 归一契约形状：**`⚠️ HARD GATE — Write {{HANDOFF}} BEFORE outputting H1`（h1 returnMode）／`…BEFORE outputting the JSON return`（json returnMode）**补进 review.md（spec/plan 的 return 是 stdout JSON、无 H1，措辞须按 returnMode 分写，不得照搬 H1 锚句）
- runner 10.5 兜底：对 implement 因文件必在而自然失效；review/fix 保留 + 文档化为**预期 retry 语义**（exit 0 无 handoff → BLOCKED → engine-recovery retry<2 → 重发，非 engine bug）

**分级**：implement 实体化为 engine 代码（runner.mjs）；模板侧 review/fix 补 HARD GATE + 文档化。

### 2.5 `cdd contract` 删除 + 提交契约 engine 归位（F1 附带）

**根因**：提交门禁从未真正落到 engine——`validateCommitContract`（定义+测试完备，文档声称 post-run 执行）是**死代码**；orchestrator 靠 `cdd contract --check-dirty` 重复兜底 + 一个语义错误的 `--check-head`（dispatch-head vs post-commit-head 恒不等，空字段才不炸）；`--clear-findings` 零调用者（deferred 已删）。

**决策（Q1/B）**：
- **`cdd contract` 子命令整体删除**（cdd.mjs contract command + runContractCli 的 check-dirty/check-head/clear-findings 全灭）
- **`validateCommitContract` 接进 engine，扩展为全模式** — **但 dirty 断言仅适用于 runner 的 task 三 mode；docs 通道（spec/plan review/fix）不做 dirty 断言**（docs 流程常态即树 dirty：doc-fix 的直接产出是修改后的未提交 doc、commit 由 finishing/changeset 在 phase 末统一完成；docs review 派发时外层工作树普遍 dirty（spec/plan 正被草写 / overall 同步中）——dirty→BLOCKED 对 docs 通道自废）。接线点按 runner 架构分明确：
  - **runner.mjs（task 三 mode）**：post-run 调用 `validateCommitContract(mode, repoRoot, {handoffPath})` — implement/fix 校验 dirty + `handoff.commits.head vs 实际 HEAD`；task-review 校验 dirty（head 校验不适用——task-review handoff 的 commits 语义为被审 commit，非本 dispatch 产物）
  - **docs-runner.mjs（spec/plan review/fix）**：**不接 dirty 断言**（docs 流程常态 dirty，见上）；commit-contract 对 docs 通道不适用，维持现状（no commit-contract/no ledger 定位不变）
- **SKILL cli-driven-development handoff-status 节点删除两步手动 contract 调用**（engine 已用 BLOCKED handoff 表达同一信号）
- **死字段删除**：progress.json schema + `createEmptyProgress` 删 `lastDispatchHead`（唯一消费者 --check-head 已删）与 `degradationLog`（无写无读）
- **`task.status=complete` 由 runner 写**：task-review 返回 APPROVED 后回写（F1 本体；P3/P4 跨 run 不一致自此消失 — P3 的 complete 是 orchestrator 手写，非 engine）
- `engine-recovery`/`timeout-decision` 读 progress 的 timeoutCount/engineRecoveryCount 逻辑不变

### 2.6 stale-lexicon 守卫脚本化（F5）→ 并入 residue.mjs 结构断言

**根因**：AC14 把 `dogfood` 当「中毒词平文禁用」→ 守卫只在 P4 plan 里是人工 grep 步骤（Task 7 Step 1），validate 13 块无机械检查；P4 两次复跑计次漂移（22→21→19）。高维度审视后发现**守卫前提错误**：今天的 19 个命中全部是合法领域语汇（finding-meta.json 的下拉 + 模板描述、overall-spec-template 的「dogfood session」），真正毒词（`labels…dogfood` label 语法）已清零。

**决策**：
- **不建第 14 块、不建豁免注册表** — 并入 `scripts/validate/residue.mjs`（5c 引擎零残留 grep 同族），**RESIDUE_TARGETS 扩展为含 `packages/cdd-engine`（bin + templates + tests）**（现仅 `packages/osuperpowers/bin` + `skills`；canonical 命名断言须防 cdd-engine 侧回渗）
- **grep 只查机制位置、不查平文词**（每条断言钉死 target 集与 regex）：
  - label 语法位（osuperpowers skills）：`labels[^,\n]*dogfood` / `"dogfood"`（json label 值）／ `dogfood,(?:cdd|bug|enhancement)` — `dogfood` 仅在「作为 label 值」的语法位置才报；**不得误报 `finding-meta.json` 的 `dogfood (CDD session)` 下拉**（该值非裸 `"dogfood"`、不命中 `"dogfood"` 模式）
  - 旧文档名（skills + cdd-engine + templates）：`docs-review\.md`（→ `review.md`）、`PASS=<`、词边界 `D1|D2|D3`（不误伤 D13）
  - resolver/gateway（skills + cdd-engine）：`resolve-hit`、`gh issue reopen`
  - 旧 mode 名 / P4 退化名（cdd-engine bin + templates）：旧 mode 子串 `task-review`（修正 §2.5 grep 笔误 `task-review|`）、`spec-1\.json`／`plan-1\.json`／`doc-fix-`（canonical 命名族断言；templates 亦须防 doc-fix 残名回渗）
  - **flat workspace 回落断言（cdd-engine bin）**：`.superpowers/docs-review` 路径零引用（§2.8 单根收编后防回落）；`resolveWorkspace` 为唯一 workspace 推导入口
  - **cdd/ 根杂讯目录一次性清理**（非 grep 断言，Phase-0 动作）：`.superpowers/cdd/{p,plan,smoke-plan,smoke-test,test-plan-br,.tmp-smoke-plan,.test-fixtures}` 移入 archive 或删除（测试残留，弃置性 state）
- **零豁免注册表**（现实命中全是 canonical 合法语汇/历史注释 — `dogfood (CDD session)` 是产品语汇不是 label 残渣）
- **清 cli-select 悬空引用**：`same labels as above`（line 49 recovery 列指代式引用、指向 line 48 的久远 label 条款）→ 改写为写明白的 recovery 文案（「Invoke `osuperpowers:report-issue`（无 manual labels — per-finding comments carry none；仅 session master 带 `session, osuperpowers`）」）。理由 = **指代式引用可读性差**（同 find-row 近义残留，未来行序/条款变动易恍参照对象），非「引用已删除条款」

### 2.7 F2 — writing-plans 产出 `**Spec:**` 头

**决策**（Enh F2 建议原样采纳）：`write-plan` 节点照写 plan 时，头部产出 `**Spec:** [<name>-design.md](…)` 行（与 plan-review `--spec` 同源）；resolve-destination 程序链已按该字段解析（cache miss 首跳）。writing-plans SKILL.md 的 write-plan 节点「Do」字段 + skill-authoring 规范补此约定。

**P4 plan 已在执行期手动补了该行**（`**Spec:** [2026-09-08-cdd-engine-overhaul-p4-design.md](…)`）— 即本轮修复要规范化的正是 P4 曾缺、后手动补的同一处。P2/P3 历史 plan 不回填（历史锚定，report-issue 解析对其已完成 phase 无实际影响）。

### 2.8 F6 — 收口（Workspace 单一化 + flat root 废弃）

- **全部 handoff 收编 `.superpowers/cdd/<slug>/`**：spec-review/plan-review/spec-fix/plan-fix + task-*/branch-review/progress/briefs/report-target/base-branch 同住一个 phase 域（slug 由被审文档推出，见 §2.1 `resolveWorkspace`）。`.superpowers/docs-review/` flat root **整体删除**（一次性归档后废弃，engine 不再产出/reference 该路径）。
- 新 named canonical 族 = P3 时代的正确名（spec-review-1 等）— **P4 的 spec-1/plan-1/doc-fix-1 是退化名**
- **归档范围 = P6 迁移前 `.superpowers/docs-review/` 全部现有 handoff 产物**（含 P3 时代的 `spec-review-1.json`/`plan-review-1.json` 这类与 canonical **同名同形**的旧文件）一次性移入 `archive-<date>/`（gitignored 本地 state，保历史，不上代码）。**不能只清退化名**：canonical pattern（`^spec-review-(\d+)$` 等）会命中 P3 旧文件 → resolveNextRound 从 2 起跳、Stopping prev 会把陈年 P3 文件当 prev 解析 — 必须整体归档让 workspace 从空开始，由本 phase 新引擎在 **per-slug 新 workspace** 重新产生干净产物
- **`.superpowers/cdd/<slug>/` 现存 task 族产物处置**：为弃置性本地 state（随 session 弃置、无 resume 契约），**不纳入归档**（改名后旧 `task-{N}-task-review-*.json` 对 roundPattern 不可匹配 → 安全孤儿，与 spec-1.json 同论证）；但若未来引入 resume 语义，须补 progress rounds 键迁移（`rounds["task-review"]` → `rounds["review"]`），本 phase 记录此悬项不再扩散
- **round 扫描只认 canonical pattern**：`^spec-review-(\d+)$` 等；legacy `spec-1.json` 不匹配 → 结构上成为不可误捕的孤儿
- residue 断言（§2.6）防退化名回渗 + 防 flat root 回落（engine 代码 `.superpowers/docs-review` 零引用）+ cdd/ 根杂讯目录（`p|plan|smoke-*|test-plan-br|.tmp-*|.test-fixtures`）一次性清理

### 2.9 依赖与风险

- **依赖**：无新外部依赖。P1–P4 合流后 develop = HEAD
- **风险（最高 → 低）**：
  1. **命名合同迁移 diff 面大**：6 处生产字面量 + ~20 处测试断言 + smoke-cdd → 计划按「canonical 先行 → 消费者替换 → 测试更新 → 迁移归档」分任务，每 task 独立 validate
  2. **F4 实体化改 handoff 语义**：runner 单测 + contract 语义测试大改（handoff 由 runner 写，contractH1 读回路径变化）— 高价值高风险，用 TDD 钉死
  3. **status 覆写与 Stopping 交互**：reviewStoppingGuard 读 `prev.status==="APPROVED"` — engine 覆写后此判据正确性提升（不再被 agent 脏 status 破解），需回归 spec/plan/task/branch 四型 + **SP-4 失败轮次豁免回归**（engine 自写 BLOCKED/TIMEOUT 与 agent status ∈ {BLOCKED, TIMEOUT} 均不得被 rollup 覆写为 APPROVED，否则 Stopping 误锁重发 → 失败 review 变终态死锁）
  4. **reviews.json 字段迁出**：若 consumer 改读源遗漏 → 悬空（templates.mjs HANDOFF_STUB / cdd.mjs fixTemplate / docs-runner schema）— canonical 先行 + 全测试绿为门槛
- **验收红线**：全 task 结束 `pnpm run validate` 绿（engine 236 + scripts vitest + emit fresh）；changeset 逐 phase

---

## Section 3: Deviations from overall

| Overall assumption | Phase decision | Overall updated? |
|---|---|---|
| P6 F1 验收：「runner 回写 progress task status=complete + lastDispatchHead」 | F1 收敛为「task.status=complete 回写」；**删除 lastDispatchHead**（check-head 删除后零消费者） | **Yes — v1.20 · 2026-09-08** |
| P6 验收缺 F4 条（overall 稿遗漏） | 补 F4 验收：runner 实体化 implement handoff / review+fix HARD GATE / retry 语义文档化 | **Yes — v1.20** |
| P6 F5 验收：「`pnpm run validate` 含 stale-lexicon 检查（豁免清单数据化）」 | 上探：stale-lexicon 并入 residue.mjs 结构断言、**零豁免注册表**（豁免数据化 → 被判定为清单债，取消） | **Yes — v1.20** |
| P6 F6 验收：「doc-review workspace 无 plan-review-*/spec-review-* 旧产物」 | 上探：命名合同单点化（handoff-namespace.json）+ `doc-fix` 残名清除；F6 从「归档遗留」升级为「命名契约统一」 | **Yes — v1.20** |
| P6 scope 只含 6 findings | +**handoff-namespace canonical / reviews.json 裁轴 / status 单一权威 / cdd contract 删除**（F3/F6 上探 + F1 附带） | **Yes — v1.20** |
| P6 F6 workspace 模型沿用 `.superpowers/docs-review/` flat root（仅改归档范围） | **Workspace 归入 artifact 契约派生层（v1.3 上探）**：canonical 增 `workspaceRoot`/`slugRule` 顶层字段 + 派生五函数新增 `resolveWorkspace(doc)`；spec/plan/task/branch 全部 handoff 收编 `.superpowers/cdd/<slug>/`；flat `.superpowers/docs-review/` 整体删除（一次性归档后废弃）；跨 phase round 污染结构性消失 | **Yes — v1.21 · 2026-09-08** |

> 全部 deviations 已回写 overall v1.20 + v1.21（overall 四表 + change history）。完成后本表全 Yes。

---

## Section 4: Notes for downstream

- **P5**（Gate 移除）不受影响 — 本 phase 不触碰 `packages/osuperpowers/bin/gate/`
- **未来 phase 新增 review/fix 类型**（如 `review.api`）：往 handoff-namespace.json 加一族即可，无需再改 runner/cdd-mjs/docs-runner 命名逻辑；**workspace 自动获得**（`resolveWorkspace` 从 doc 推出，不依赖 family 配置）
- **消费者升级路径**：旧 `.superpowers/docs-review/` 的 `spec-1.json`（P4 退化名）不会被新 roundPattern 匹配 → 安全孤儿；P6 执行期一次性归档后 flat root 废弃，新产物全部落在 `.superpowers/cdd/<slug>/`
- **`task-review` 模式名剔除**：CDD_MODE/VALID_MODES/progress rounds key 从 `task-review` 归一为 `review`（op 维度）；**handoff `phase` 字段同步归一**（cdd-handoff-schema theme 的 phase enum `["implement","task-review","fix","branch-review"]` → `["implement","review","fix","branch-review"]`，renderHandoffStub 以 mode 填 phase 的分支同步改；docs-handoff-schema 的 phase enum `["review","fix"]` 不变且与归一后一致）；**canonical 表同步增补 `phase` 列**（= 该族 op 在 handoff 内 phase 字段的值），§2.3 item 2 的 status conditional 判定键 = `phase ∈ review 族则 status 可缺省/可覆写，implement/fix 仍 required`。两轴分离后 reviews.json（type 键）与 canonical（op+type）无命名冲突；`reviews.json` 仍以 type 键（task/branch/spec/plan）组织内容契约。

---

## Section 5: Review

Rule: URC — `cdd review --type spec --harness <name> --doc <path>` 单周期；Rule Review Stopping：blocker>0 → `cdd fix` → 重审；blocker=0 → fix all → done（不重跑）。通过后再交用户 review、进入 writing-plans。

**self-review / spec-review 记录（按 URC 单周期）**：
- **spec-review round 1（spec-3.json，CHANGES_REQUESTED）**：2 blockers + 5 warn + 3 nit。blocker ① 替换点漏 scanner 侧 4 处（existingRoundHandoff / handoffStatus / task Stopping prev / branch prev）→ §2.1 补全 10 站点 + reader 侧必清 + 残留 grep；blocker ② rollup 覆写撞 SP-4 失败轮次（findings:[] 被覆写为 APPROVED → Stopping 误锁重发）→ §2.3 补覆写豁免集 + §2.9 risk #3。warn/nit 依此修复（reviews.json 裁轴字段归位、P3 同名旧文件归档范围、v1.19→v1.20、fixTemplate 单点、HARD GATE returnMode 分写、cli-select 指代理由改写）
- **spec-review round 2（spec-4.json，blocker=0）**：6 warn + 1 nit，全部修复（review 停止 → 不重跑）：
  ① docs 通道 dirty 断言自废（docs fix 产出未提交 doc 属常态）→ §2.5 收敛为「dirty 仅 runner task 三 mode；docs 不接」
  ② roundPattern 占位符 + scan/concrete 两种形态 + runFix round 链归属 → §2.1 派生函数规粐 + 替换点 11
  ③ 同族 round-1 prev vs 跨族 prev 表两种机制混写 → §2.1 划界 + 替换点 3/4/7 拆分
  ④ implement 实体化 head 恒等 + H1/handoff commits 双源 → §2.4 commits 单一权威 + h1FromHandoff 重发
  ⑤ residue scope 未含 cdd-engine + grep 笔误 → §2.6 扩展 RESIDUE_TARGETS + 修正 regex
  ⑥ phase 字段归一未明 + canonical 无 phase 列 → §4 归一 + §2.3 conditional 判定键
  ⑦ task workspace 归档范围 + rounds 键迁移悬项 → §2.8 补处置说明
- **v1.3（writing-plans grilling 高维度上探，用户「统一规划抽象」）**：workspace 归入 artifact 契约派生层 — canonical 增 `workspaceRoot`/`slugRule`、派生五函数新增 `resolveWorkspace`、全部产物收编 `.superpowers/cdd/<slug>/`、flat `.superpowers/docs-review/` 删除；overall 同步 v1.21；§2.1/§2.6/§2.8/§3/§4 相应更新