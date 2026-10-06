# Cdd Review 输出面契约修正实施计划（Cdd Review Output-Contract Fix Implementation Plan）

**Spec:** [2026-09-28-cdd-review-contract-fix.md](docs/kairos/specs/2026-09-28-cdd-review-contract-fix.md)

- **Version**: v1.4 · 2026-09-28
- **Depends on**: single spec v1.2 Approved（`21037fc9`，#302 + #304 合流单 spec 双组件，无 parent overall）
- **Base**: develop

- **Interface 转录注记**: 各任务 `- **Consumes**: 刻意留空（树迁移 B 转录决策）——源 Do 散文未承载独立具名输入事实，consumes（Task 记录 interface 可选项）不填充；任务输入由 DependsOn/AtomicWith 声明边与 objective/steps 承载，consumer-parity p1–p4.1 因承接具名输入事实而全量填充。

## Constraints

### 口径

- **status 路由判据**：S1/S2/S3 收敛判据 = `status`（`CHANGES_REQUESTED` ⟺ ≥1 `severity=blocker` finding，`finalize.ts` 汇总编码）——orchestrator 读 `status:` 行路由，不再判读 stdout `blocker` 字段；findings 全文仍只经 `cdd fix --findings <handoff>` 交 fix-agent（I5 零新增 carve-out）。engine 侧 `reviewConvergenceGuard` / `blockerCount` 机器守门不变。
- **一义一词（blocker）**：`blocker` 一词全仓唯一锚定 review finding 严重级（M1）；BLOCKED 状态（M4）与 docs 面结果行 `blocker: <n>`（M2 计数）随 spec ③ bounded 映射；stdout return-block `blocker:` 行与 `blockerDefaultFor`/「none」删除。
- **M3 载体裁定**：task/branch 面 BLOCKED 理由单一化为 stderr `CDD_BLOCKED:` + `failure_category`（task handoff `blocker` 字段空置、schema allOf 仅 failure_category 支撑）；docs 面 handoff `blocker` 字段保持（allOf 不变）。删列后任一 BLOCKED 轮非空理由线索不静默丢失（engine 单测断言）。
- **行数契约**：agent 输出契约 = 3 行（`status:` / `commits:` / `artifacts:`，agent 永不自产 counters）；引擎 stdout = 4 行（+ `counters:`，`returnCountersLine` 独占构造点）。`RETURN_STDOUT_BLOCK` 族随之收敛，防 prompt 更新者按 4 行要求 agent 自产 counters。
- **判别结构性**：claim 声明判别 = clause 头部 token（`Pending`/`[Pending]`，`^` 锚语义）+ 非括注内联——结构性规则，引导词不作词典成员判定；range 由判别前置（声明位=多目标、prose 位不声明）。
- **语法不宽容**：字母后缀 phase-id（`P3.10a`）报非法 + 引导合法点分式（`P3.10.1`），不回退父行——「P3.10a-e → P3.10.1-.5」正名债随行兑现，不反向放宽正则。
- **等价单测唯一锚**：status ↔ severity 等价断言锚 `finalize.ts` rollup / convergence 单测（防 SP-4 pass-through 等旁路稀释语义）。
- **changeset 义务**：本 program 双包各一 changeset（`pnpm run changeset`）——`@oscaner-skills/cdd-engine` patch + `@oscaner-skills/osuperpowers` patch（skills 文档随包）；收口时建（实现 commit 后 orchestrator 落）。
- **C3 通道契约（v1.2 backfill）**：branch-review 输出通道两条裁定（spec C3）——C3-a 递归 root 注入（`cli/review.ts` branch ctx `repoRoot` = 解析后 root，黑盒恒真；`base.ts` 缺根真实 mode BLOCK/dry-run WARN；`parse.ts` 三命令 `--root` 白名单）；C3-b result-line 存在性（branch-review 真实 mode 经 `returnFromHandoff` emit return block，吃 4 行新契约）。**T6 须在本程序终闸 branch-review 前落地**（否则 C2 审计被跳过 + C1 status 路由无信号）。
- **C4 收据契约（v1.3 backfill）**：branch-fix 关闭 handoff 由 engine 从机器事实重造（spec C4）——`finalizeHandoff` mode "fix" 透传 → 事实重造（commits/phase/status 权威 + agent 输入剥离）；修已 commit + 无代码面错误 → 收据自愈 APPROVED；注入 schema 收敛可写子集（剥 `$schema` + dispatch-盖章字段）。**T7 须在本程序终闸 branch-fix 前落地**（否则终闸 branch-fix 同撞收据闸）。
- **C5 next-step 统一抽象（v1.4 backfill）**：三输出面（docs face / task / branch return block——branch 面消费 T6 emit 层）各追加 `next:` 建议行（spec C5）——C5-0 suggestion 语义（非 hard action，mid-backfill / Plan Sole Writer / 用户裁决可覆盖）+ C5-1 责任单一（**fix 面为 re-review/收口的唯一判定点**——按输入 `--findings` 严重级给 `next: review` 或 `next: none` 收口）+ C5-2 **零新 CLI 参数**（`next-step.ts` 纯读既有 ctx/opts + `convergence.blockerCount`）+ soft-cap 标记。**T8（engine core）/ T9（skills 精简）须在终闸前落地**（T8 依赖 T6 emit 层）。

### commit 边界机制

- 实现提交按任务粒度（conventional commits，无 attribution trailers）
- spec/plan 文档仅由 orchestrator（Plan Sole Writer）与 cdd fix-agent 修改；implement agent 零文档修改权
- C1 engine 变更与 C2 `documents.ts` 变更分任务落地，不混 commit；docs 面 `result-face.ts` / `result-face.test.ts` 保持不动（M2 计数）
- SKILL.md / maintainers 文档 English-primary（消费面零程序叙事 iron rule）；spec/plan 中文（Strategy B 豁免）
- 引擎 `.mjs` plane zero：新测试 node:test `*.test.mjs` 或 colocated vitest `__tests__/*.test.ts`（随被覆盖模块）
- 不触 emit 面（`pnpm run emit:check` 保持 fresh）——本 program 无 emit 产物变更

### Flow Atomicity

- T1 契约破坏先行——return-block 删列与 smoke-cdd pin / finalize 重接 / 单测同任务内落地，validate/precommit 全绿后才进入 T2
- 单任务原子：实测与 spec 不符 → 不符点记录为任务产出报告交 orchestrator 判定（Plan Sole Writer），不「带伤闭合」
- 串行 dispatch：T1→T2→T3→T4→T5→T6→T7→T8→T9 全 singleton 组（无 `## Task Groups` 合并）

### 顺序原则

- T1（engine kernel：删列 + M3 载体裁定 + smoke-cdd pin）→ T2（status 路由 + skills ×5 重锚 + 等价单测）→ T3（命名档案收编）→ T4（C2 判别/range/语法）→ T5（C2 诊断三件套）→ T6（C3 branch-review 通道契约收口，v1.2 backfill）→ T7（C4 branch-fix 收据契约，v1.3 backfill）→ T8（C5 engine core：`next:` 输出面）→ T9（C5 skills 精简）：T2 依赖 T1 世界态（判读措辞引用新行数契约）、T3 依赖 T2 语义、T4/T5 独立于 C1 面但串行收口、**T6 必须在终闸 branch-review 前落地**（spec C3 依赖裁定）、**T7 必须在终闸 branch-fix 前落地**（spec C4 依赖裁定）、**T8 依赖 T6 emit 层 + 终闸前落地**、**T9 依赖 T8 且终闸前落地**（spec C5 依赖裁定）
- 每任务 end-to-end：实现 → 该任务面测试绿 → 相关 validate 面绿

### 仓库纪律

- node：`fnm use`（.nvmrc v24）；引擎调用 `node packages/cdd-engine/dist/cli.mjs` 直调（`dev:stub` 后），不走 global cdd
- 引擎调用直接读完整 stdout/stderr，零输出过滤（无 `tail`/`head`/`2>&1 |`/`EXIT=$?` 捕获）
- 预提交门 `pnpm run precommit`；完整 12 块 validate 在 CI 净检出上跑，本地提交后 `pnpm run validate` 全量核对


### Task 1: C1 ② return-block 删 `blocker:` 列 + M3 载体裁定（engine kernel）

- **Objective**: C1 ② return-block 删 `blocker:` 列 + M3 载体裁定（engine kernel）：三行契约 + CDD_BLOCKED 单通道 + schema/模板面同步
- **DependsOn**: none
- **AtomicWith**: none

- **Produces**: `returnFourLines` 3 keys / `assembleReturnBlock` + `counters` / `dryRunBlock` 删行 / `returnFromHandoff` 删行 + 兜底理由重定位 stderr；`blockerDefaultFor`/`returnBlocker` 删除；task-handoff-schema `blocker` 空置 + allOf 仅 failure_category；agent 模板 RETURN_STDOUT_BLOCK 三行化；smoke-cdd 4-key pin；engine 单测

- **Files**: packages/cdd-engine/src/artifacts/return-block.ts, packages/cdd-engine/src/artifacts/handoff/finalize.ts, packages/cdd-engine/templates/schema/task-handoff-schema.json, packages/cdd-engine/config/template-contract.json, scripts/validate/smoke-cdd.ts

- **Steps**:
  1. `packages/cdd-engine/src/artifacts/return-block.ts` 删 `blocker:` 列并定行数契约——`returnFourLines` keys `["status","commits","artifacts","blocker"]` → 3 keys；`assembleReturnBlock` → status/commits/artifacts + counters 4 行；`dryRunBlock` 删 `blocker:` 行；`returnFromHandoff` 删 `blocker:` 行——缺件/不可解析两分支的兜底理由串显式重定位到 stderr `CDD_BLOCKED:` 单通道写出；`blockerDefaultFor` 与「none」假象源删除；`returnBlocker` 随 agent 声明通道退役处置 — checkable: return-block 零 `blocker:` 行（单测 + grep `blockerDefaultFor`/「blocker: none」零残存）
  2. `finalize.ts` 材料化解构（4 槽 → 3 行）随 3 行契约重接、`blocker` 槽消除，stderr 捕获不到的场合落占领位兜底文案；`task-handoff-schema.json` `blocker` 字段空置标注（不再作为 agent 声明通道）、BLOCKED allOf 调整为仅以 `failure_category` 支撑 — checkable: finalize 材料化解构 3 行重接无 4 槽错位；schema allOf BLOCKED 仅 failure_category 支撑
  3. agent prompt 模板 `RETURN_STDOUT_BLOCK` 族收敛为 3 行（status/commits/artifacts，agent 永不自产 counters）；外壳契约面同步：`template-contract.json#sections.shell`「from your return block four lines」改「three lines」、commit-contract「`blocker:` listing the out-of-scope paths」重定位为 stderr `CDD_BLOCKED:` — checkable: 外壳模板面措辞 grep pin——「four lines」/「`blocker:` listing」在 shell 共享 Instructions 面零残存
  4. `scripts/validate/smoke-cdd.ts` 输出契约 pin 更新——注释+断言 keys 改 4-key（status/commits/artifacts/counters，删 blocker）；engine 单测：return-block 各出口零 `blocker:` 行断言 + task 面任一 BLOCKED 轮理由经 stderr `CDD_BLOCKED:` / `failure_category` 可寻址断言 — checkable: smoke-cdd 断言 4-key；task 面 BLOCKED 理由经 stderr/failure_category 可寻址（`returnFromHandoff` 两串兜底理由不静默丢失）；`pnpm run validate` + precommit 全绿（注：docs 面 result-face.ts / result-face.test.ts 保持不动——M2 计数面；本任务不改 SKILL.md）

- **Acceptance**:
  - return-block 零 `blocker:` 行（单测 + grep `blockerDefaultFor` /「blocker: none」零残存）；外壳模板面措辞 grep pin——「four lines」/「`blocker:` listing」在 `template-contract.json#sections.shell` 共享 Instructions 面零残存；smoke-cdd 断言 4-key（status/commits/artifacts/counters）；finalize 材料化解构 3 行重接无 4 槽错位；task 面 BLOCKED 理由经 stderr/failure_category 可寻址（`returnFromHandoff` 两串兜底理由不静默丢失）；`pnpm run validate` + precommit 全绿（engine 套件 + smoke-cdd 更新面）。


### Task 2: C1 ①④ status 路由判据 + skills ×5 重锚 + 等价单测

- **Objective**: C1 ①④ status 路由判据 + skills ×5 重锚 + 等价单测（Review Convergence / 流程 digraph 的 `{blocker=0?}` 判据改 status 术语）
- **DependsOn**: none
- **AtomicWith**: none

- **Produces**: 五份 SKILL.md 改 status 判据（CHANGES_REQUESTED ⇒ S1 必 re-review / REVIEW_FIX ⇒ S2 收口 / APPROVED ⇒ S3）+ 输出契约 Read 面 3/4 行同步 + Failure-Modes M4 语义；engine 等价单测（status ⟺ severity 汇总）

- **Files**: packages/osuperpowers/skills/cli-driven-development/SKILL.md, packages/osuperpowers/skills/writing-single-spec/SKILL.md, packages/osuperpowers/skills/writing-overall-spec/SKILL.md, packages/osuperpowers/skills/writing-phase-spec/SKILL.md, packages/osuperpowers/skills/writing-plans/SKILL.md, packages/cdd-engine/src/artifacts/handoff/finalize.ts（等价单测）

- **Steps**:
  1. 五份 SKILL.md——`cli-driven-development` + `writing-single-spec` / `writing-overall-spec` / `writing-phase-spec` / `writing-plans`（I 节）：Review Convergence 与流程 digraph 的 `{blocker=0?}` 判据改述为 **status 判据**（`CHANGES_REQUESTED` ⇒ S1 fix 后必 re-review / `REVIEW_FIX` ⇒ S2 收口 / `APPROVED` ⇒ S3），边缘条件改 status 术语，node 定义 Exit/Do 文字同步；判读指令改「读 `status:` 路由」；Failure-Modes 表「blocker from output contract」改写为 `status: BLOCKED` + stderr `CDD_BLOCKED:` 理由 — checkable: 5 份 SKILL.md 零「blocker count」判读措辞、Review Convergence 以 status 锚定（precommit digraph 套件 + 措辞 grep pin 绿）
  2. engine 等价单测（colocate finalize.ts / convergence.ts）：构造含 `severity=blocker` findings → 断言 status=CHANGES_REQUESTED；warn/nit-only → REVIEW_FIX；zero findings → APPROVED——status ⟺ severity 汇总等价，防旁路稀释 — checkable: 等价单测通过（`CHANGES_REQUESTED` ⟺ ≥1 `severity=blocker`）（注：消费面零程序叙事——skills 文案只承载收敛判据语义；digraph 结构调整须过 skill-anatomy 结构断言）

- **Acceptance**:
  - 5 份 SKILL.md 零「blocker count」判读措辞、Review Convergence 以 status 锚定（precommit digraph 套件 + 措辞 grep pin 绿）；等价单测通过（`CHANGES_REQUESTED` ⟺ ≥1 `severity=blocker`）。


### Task 3: C1 ③ 命名档案收编

- **Objective**: C1 ③ 命名档案收编（naming-conventions §3.2 bounded 映射 + §3.3 mechanismNames 迁移行 + §3.5 去 blocker）
- **DependsOn**: none
- **AtomicWith**: none

- **Produces**: `docs/maintainers/02-naming-conventions.md` §3.2 bounded 映射行（blocker = M1 唯一词义 / BLOCKED = M4 / handoff blocker 字段 / CDD_BLOCKED 单通道 / docs 结果行计数）+ §3.3 迁移行 + §3.5 零 blocker

- **Files**: docs/maintainers/02-naming-conventions.md

- **Steps**:
  1. `docs/maintainers/02-naming-conventions.md`——`§3.5` 移除 `blocker`（保留词清单去项）；`§3.2` 增 **bounded 映射**行（`blocker` = review finding 严重级（M1，唯一词义）、`BLOCKED` = 轮次状态（M4）、handoff `blocker` 字段（docs 面）= BLOCKED 理由串、task 面理由经 stderr `CDD_BLOCKED:` 单通道、stdout 仅 docs 结果行 `blocker: <n>` 作 M1 计数呈现）；`§3.3` mechanismNames 迁移表补一行（stdout return-block `blocker:` 列 → 移除） — checkable: `§3.2` bounded 行落 + `§3.5` 零 `blocker` + `§3.3` 迁移行齐全；precommit 全绿（maintainers 一致性检查）（注：文档 English-primary；「一词一义」Principle 2 正式兑现）

- **Acceptance**:
  - `§3.2` bounded 行落 + `§3.5` 零 `blocker` + `§3.3` 迁移行齐全；precommit 全绿（maintainers 一致性检查）。


### Task 4: C2 ⑤⑥⑦ claim 判别 + range 语义 + 语法显式化（documents.ts）

- **Objective**: C2 ⑤⑥⑦ claim 判别 + range 语义 + 语法显式化（documents.ts）
- **DependsOn**: none
- **AtomicWith**: none

- **Produces**: 判别结构性规则（`Pending`/`[Pending]` 头部 token + 非括注内联）；range 声明位多目标 + prose 位不声明（phaseIdsIn 展开清单）；字母后缀 phase-id 报非法（不进父行归 #304(b) precis）

- **Files**: packages/cdd-engine/src/rules/documents.ts, docs/kairos/specs/2026-09-28-cdd-review-contract-fix.md（回归 pin 面）

- **Steps**:
  1. `packages/cdd-engine/src/rules/documents.ts` 判别/range/语法收口——⑤ **判别结构性规则**：claim 声明仅认可 clause 头部 token `Pending`/`[Pending]`（`^` 锚）+ **非括注内联**；括注内或非头部字面命中 = prose hint、不声明；⑥ **range 语义**：声明位 `P3.10.1-P3.10.5` = 多目标声明；prose 位 = 描述性列举不声明；解析产出携带**展开相位清单**（`phaseIdsIn` range 展开位）；⑦ **语法显式化**：字母后缀（`P3.10a`）报**非法 phase-id** 错误态（不进父行、解析相位槽位止于错误态）；合法形态指引（点分式 `P3.10.1`）为规则语义目标，指引文案由 T5 载荷层组装 — checkable: 判别/range/语法三面 engine 单测全绿；#274 残留形态回归 pin 成立；字母后缀报非法而非吞父行（#304(b) 实测链精确回归）（注：本任务仅做判别/range/解析载荷，不产诊断文案——指引由 T5 三件套组装）

- **Acceptance**:
  - 判别/range/语法三面 engine 单测全绿；#274 残留形态回归 pin 成立；字母后缀报非法而非吞父行（#304(b) 实测链精确回归）。


### Task 5: C2 ⑧ 诊断三件套

- **Objective**: C2 ⑧ 诊断三件套（肇事上下文 + 按类别分派建议 + 可执行动作）落地 documents.ts 输出面
- **DependsOn**: none
- **AtomicWith**: none

- **Produces**: mismatch/BLOCKED 输出升级三件套（clause 摘录 + 解析相位 + 机理 · 类别分派建议 · 可执行动作）；range 声明诊断附展开相位清单；`proseHintSuffix` 替换

- **Files**: packages/cdd-engine/src/rules/documents.ts, docs/kairos/specs/2026-09-28-cdd-review-contract-fix.md

- **Steps**:
  1. doc-contract BLOCKED / mismatch 输出升级为三件套——(1) **肇事上下文**：触发 claim 的 clause 摘录 + 解析到的相位 + 解析机理（如「P3.10a → 非法 phase-id：不回退父行，合法形态指引 P3.10.1」）；range 声明（声明位）另含**展开相位清单**；(2) **按类别分派建议**：语法类 → 合法形态 + 定位；prose 类 → 肇事 clause 摘录 + 建议措辞；(3) **可执行动作**：每条错误至少一个可直接执行的定位/修复动作；三件套落地位 = forward-mismatch 的 `proseHintSuffix`（`；` 单行 hint 为替换对象） — checkable: 诊断载荷单测全绿（五要素断言）；range 声明（声明位）诊断面列出展开相位清单；排障引导面直达根因（语法类引到合法形态与定位、prose 类引到肇事原文——#304(b) 三轮盲修实证消除）
  2. T5 完成后由 orchestrator 建双包 changeset（cdd-engine patch + osuperpowers patch）并跑 `pnpm run validate` 全量核对；issue #302+#304+#305+#306 于 finishing 收口关闭（注） — checkable: changeset 裁决由 orchestrator 收口时建（注：本任务为纯输出面改动，无独立验收外项）

- **Acceptance**:
  - 诊断载荷单测全绿（五要素断言）；range 声明（声明位）诊断面列出展开相位清单（⑥ 验收「诊断附展开清单」逐字可测）；排障引导面直达根因——语法类引导到合法形态与定位、prose 类引导到肇事原文（零误导错误信息兑现，#304(b) 三轮盲修实证消除）。


### Task 6: C3 branch-review 通道契约收口（spec v1.3 backfill：#305 + #306）

- **Objective**: C3 branch-review 通道契约收口（spec v1.3 backfill：#305 + #306）——repoRoot 注入 + 缺根 BLOCK/dry-run WARN + `--root` 白名单 + branch-review result-line
- **DependsOn**: none
- **AtomicWith**: none

- **Produces**: `cli/review.ts` branch ctx repoRoot = 解析后 root；`dispatch/base.ts` 缺根面真实 mode BLOCK / dry-run WARN；`cli/parse.ts` 三命令 `--root` flag；`dispatch/branch.ts` branch-review 真实 mode 经 returnFromHandoff emit return block

- **Files**: packages/cdd-engine/src/cli/review.ts, packages/cdd-engine/src/dispatch/base.ts, packages/cdd-engine/src/cli/parse.ts, packages/cdd-engine/src/dispatch/branch.ts

- **Steps**:
  1. `cli/review.ts` branch channel `ctx.repoRoot` 由 `opts.root ?? null` 改**解析后 root**（黑盒路径恒真、缺根 WARN 零触发）；`dispatch/base.ts` doc-contract 缺根面升级——**真实 mode `→ CDD_BLOCKED` + exit 1（严禁缺根 WARN + exit 0 空转）、dry-run → 保持 WARN**（I7） — checkable: 缺根双 lane（真实 → `CDD_BLOCKED` + exit 1 / dry-run → WARN）+ `--root` CLI 白名单可注入
  2. `cli/parse.ts` 三命令统一声明 `root` flag（`--root`，对齐内部 `opts.root ?? getRoot()` 注入契约）；`dispatch/branch.ts` branch-review **真实 mode** `normalizeResult` 补 result-line——经 `returnFromHandoff(...)` **单点 emit return block**（吃 T1 的 4 行新契约，无 `blocker:`） — checkable: branch-review 真实 mode stdout 含 return block（status/commits/artifacts + counters，零 `blocker:`）单测断言 + doc-audit 门在 branch-review 黑盒路径实跑（不 WARN-skip）（注：依赖 = T6 必须在本程序终闸 branch-review 之前落地；不改 return-block/finalize 载体面）

- **Acceptance**:
  - branch-review 真实 mode stdout 含 return block（status/commits/artifacts + counters，零 `blocker:`）单测断言；缺根真实 mode → `CDD_BLOCKED` + exit 1、dry-run → WARN（双 lane）；`cdd review/fix/implement --root <path>` 可用（parse 白名单）；branch-review 黑盒路径零「doc contract validation skipped (no repo root)」WARN（doc-audit 门实跑——C2 审计面在终闸生效）；`pnpm run validate` + precommit 全绿（engine 套件 + smoke-cdd 更新面）。


### Task 7: C4 branch-fix 收据契约（spec v1.4 backfill：#307）

- **Objective**: C4 branch-fix 收据契约（spec v1.4 backfill：#307）——finalizeHandoff 事实重造 + 注入 schema 可写子集
- **DependsOn**: none
- **AtomicWith**: none

- **Produces**: `finalizeHandoff` mode "fix" 从原样透传改 engine 事实重造（commits/phase/status 权威 + agent 输入剥离）；修已 commit + 无代码面错误 → 收据自愈 APPROVED；`renderHandoffSchemaJson` 注入面收敛可写子集（剥 `$schema` + dispatch-盖章字段）

- **Files**: packages/cdd-engine/src/artifacts/handoff/finalize.ts, packages/cdd-engine/src/render/templates.ts, packages/cdd-engine/src/dispatch/branch.ts

- **Steps**:
  1. `finalizeHandoff` mode `"fix"` 从**原样透传 agentHandoff** 改 **engine 事实重造**（与 finalizeImplement 同构）：commits（git facts）+ phase + status（commit-contract 判定）为权威，agent 原始 handoff 为输入（findings/notes 保留、未知键与 `$schema` 剥离）；**修已 commit 且无代码面错误 → 收据自愈 APPROVED**，不再硬闸于收据形状；真正失败面（无 commit / 代码面错误）仍 BLOCKED — checkable: 构造「修已 commit + agent handoff 带 `$schema`/坏 `review_scope`/坏 `notes`」→ 断言收据自愈 APPROVED（非 BLOCKED）；仍败面带字段名 + 期望形态（#306 引导）
  2. `renderHandoffSchemaJson` / `#shellFor` 注入面收敛为**可写子集**——剥 `$schema` 元键 + 剥 dispatch-盖章字段（`review_scope`「not authored」族） — checkable: 注入 schema 零 `$schema`/零 `review_scope`（grep）；`pnpm run validate` + precommit 全绿（注：依赖 = T7 必须在本程序终闸 branch-fix 之前落地；与 T1 共享 finalize 单点，零文件冲突）

- **Acceptance**:
  - branch-fix 修已 commit + 无代码面错误 → APPROVED 收据（单测断言，不 BLOCKED）；注入 schema 可写子集（grep `$schema`/`review_scope` 注入面零命中）；仍败面 blocker 附期望形态；`pnpm run validate` + precommit 全绿（engine 套件 + smoke-cdd 更新面）。


### Task 8: C5 engine core — `next:` 输出面（spec v1.5 backfill）

- **Objective**: C5 engine core — `next:` 输出面（spec v1.5 backfill）：nextStepFor 纯派生 + 三输出面统一追加 next 行 + smoke-cdd 5-key
- **DependsOn**: none
- **AtomicWith**: none

- **Produces**: `rules/next-step.ts` `nextStepFor(ctx)`（零新 CLI 参数）；task/docs/branch 三输出面各含 `next:` 行；`scripts/validate/smoke-cdd.ts` 4-key → 5-key（+next）；engine 单测全表

- **Files**: packages/cdd-engine/src/rules/next-step.ts, packages/cdd-engine/src/cli/review.ts, packages/cdd-engine/src/dispatch/task.ts, packages/cdd-engine/src/dispatch/branch.ts, scripts/validate/smoke-cdd.ts

- **Steps**:
  1. 新 `packages/cdd-engine/src/rules/next-step.ts` 纯派生模块 `nextStepFor(ctx)`——输入 = 既有 dispatch ctx/opts 字段（op/type/group/round/ref/status/findings/workspace/plan/commits.base-head），**零新 CLI 参数**（C5-2：parse/usage/白名单零变更）；对 review：有 findings → `next: cdd fix --type <t> [--tasks <n>] --plan <p> --findings <h>`、零 findings → `next: none`/剩余组 implement/全部收罄 branch-review；对 **fix**（C5-1 责任单一判定点）：含 blocker>0 → `next: cdd review …`、仅 warn/nit → `next: none`（收口）、连续 S1 达 soft cap → `next: BLOCKED: review-cycle-cap`；自身 BLOCKED 不产 `next:`；**suggestion 语义（C5-0）**注释明示可覆盖 — checkable: nextStepFor 全表（review 有/零 findings × fix 输入 blocker>0/仅 warn-nit/cap × 收口轮）单测绿 + 三输出面各含 `next:` 行断言 + BLOCKED 面不产 `next:`；`parse.ts`/usage 零变更（grep `--next` 零命中）
  2. 三输出面统一追加 `next:` 行：docs result face · task return block · branch return block（T6 已落地的 normalizeResult emit 层消费）；`scripts/validate/smoke-cdd.ts` 输出契约 4-key → 5-key（+next） — checkable: smoke-cdd 5-key pin 绿（注：BLOCKED 轮走既有 failure-mode 通道，`next:` 非 exit 码控制器，exit 语义不变）

- **Acceptance**:
  - 三输出面（docs face / task / branch return block）各含 `next:` 行（单测 + smoke-cdd 5-key pin）；fix 面下一跳判定全表单测绿（输入 blocker>0 → `next: review` / 仅 warn/nit → `next: none` 收口 / cap → `next: BLOCKED: review-cycle-cap`）；`parse.ts`/usage 零变更（grep `--next` 零命中）；`pnpm run validate` + precommit 全绿（engine 套件 + smoke-cdd 更新面）。


### Task 9: C5 skills ×5 精简（spec v1.5 backfill，T8 世界态）

- **Objective**: C5 skills ×5 精简（spec v1.5 backfill，T8 世界态）：S1/S2/S3 路由散文坍缩为 `next:` 共享引用
- **DependsOn**: none
- **AtomicWith**: none

- **Produces**: 五份 SKILL.md 零 S1/S2/S3 路由复述（判读措辞统一「读 `next:` 建议」；五处长散文收编为一处共享引用；I5/I7/I2 不变式与 digraph 原样保留）

- **Files**: packages/osuperpowers/skills/cli-driven-development/SKILL.md, packages/osuperpowers/skills/writing-single-spec/SKILL.md, packages/osuperpowers/skills/writing-overall-spec/SKILL.md, packages/osuperpowers/skills/writing-phase-spec/SKILL.md, packages/osuperpowers/skills/writing-plans/SKILL.md

- **Steps**:
  1. 五份 SKILL.md：S1/S2/S3 fix/review 路由散文坍缩为共享引用「**`next:` 是 engine 给出的默认下一跳建议；直接继续则按它派发，mid-backfill / 用户裁决落地后以当前世界态为准**」——每节点 Do/Exit 依 T8 输出的 `next:` 载荷路由；判读措辞统一「读 `next:` 建议」；五处「review closes in three segments…」长散文收编为一处共享引用（I1/I3 不变式保留「是什么」、去掉「怎么做」复述）；I5/I7/I2 不变式与 digraph 结构原样保留 — checkable: 5 份 SKILL.md 零 S1/S2/S3 路由复述（grep pin——仅保留不变式中的收敛语义引用）；判读措辞统一引用 `next:` 建议；precommit digraph 套件 + 措辞 grep pin 全绿（注：依赖 = T9 须在 T8 之后 + 终闸前落地；本任务零 engine 代码面改动）

- **Acceptance**:
  - 5 份 SKILL.md 零 S1/S2/S3 路由复述（grep pin——仅保留不变式中的收敛语义引用）；判读措辞统一引用 `next:` 建议（含 I6 mid-backfill 兼容句）；precommit digraph 套件 + 措辞 grep pin 全绿。
