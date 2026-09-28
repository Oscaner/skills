# Cdd Review 输出面契约修正实施计划（Cdd Review Output-Contract Fix Implementation Plan）

**Spec:** [2026-09-28-cdd-review-contract-fix.md](docs/osuperpowers/specs/2026-09-28-cdd-review-contract-fix.md)

- **Version**: v1.4 · 2026-09-28
- **Depends on**: single spec v1.2 Approved（`21037fc9`，#302 + #304 合流单 spec 双组件，无 parent overall）
- **Base**: develop

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

- **Do**: `packages/cdd-engine/src/artifacts/return-block.ts` 删 `blocker:` 列并定行数契约——`returnFourLines`（`:49-55`）keys `["status","commits","artifacts","blocker"]` → 3 keys（agent 输出契约）；`assembleReturnBlock`（`:139-150`，引擎 stdout）→ `status/commits/artifacts` + `counters` 4 行、`blocker` 槽消除；`dryRunBlock`（`:127-134`）删 `blocker:` 行；`returnFromHandoff`（`:155-183`）删 `blocker:` 行——缺件/不可解析两分支的兜底理由串（`:158`「handoff missing after commit-contract interception → re-dispatch task …」、`:165`「handoff JSON unparseable …」）显式重定位到 stderr `CDD_BLOCKED:` 单通道写出（M3 载体裁定；`#done` 调用点通用 stderr msg 不承载这两串理由），return-block 兜底块仅剩 3 行 status/commits/artifacts；`blockerDefaultFor`（`:115-122`）与「none」假象源删除；`returnBlocker`（`:104-111`）随 agent 声明通道退役处置。`finalize.ts` 材料化解构（`:558-562`，4 槽 → 3 行）随 3 行契约重接、`blocker` 槽消除，stderr 捕获不到的场合落占领位兜底文案（「implement return status … without blocker」路径可达）。`task-handoff-schema.json` `blocker` 字段（`:171`）空置标注（不再作为 agent 声明通道）、BLOCKED allOf（`:311-318`）调整为仅以 `failure_category` 支撑。agent prompt 模板 `RETURN_STDOUT_BLOCK` 族收敛为 3 行（status/commits/artifacts，agent 永不自产 counters）；外壳契约面同步：`template-contract.json#sections.shell` 共享 Instructions 的 implement 条款「from your return block four lines」（`:37`）改「three lines」、commit-contract 条款「Uncommitted changes at return → `status: BLOCKED` + `blocker:` listing the out-of-scope paths」（`:42`）的出范围路径 `blocker:` 清单重定位为 stderr `CDD_BLOCKED:`（并入任务面 notes，`blocker:` 声明通道随删列退役）。`scripts/validate/smoke-cdd.ts` 输出契约 pin 更新——`:33` 注释与 `:466` 断言 keys 改 4-key（status/commits/artifacts/counters，删 blocker）。engine 单测：return-block 各出口零 `blocker:` 行断言 + task 面任一 BLOCKED 轮理由经 stderr `CDD_BLOCKED:` / `failure_category` 可寻址断言（含 `returnFromHandoff` 两串兜底理由在 stderr 可寻址；非空理由线索不随删列静默丢失）。
- **验收**: return-block 零 `blocker:` 行（单测 + grep `blockerDefaultFor` /「blocker: none」零残存）；外壳模板面措辞 grep pin——「four lines」/「`blocker:` listing」在 `template-contract.json#sections.shell` 共享 Instructions 面零残存；smoke-cdd 断言 4-key（status/commits/artifacts/counters）；finalize 材料化解构 3 行重接无 4 槽错位；task 面 BLOCKED 理由经 stderr/failure_category 可寻址（`returnFromHandoff` 两串兜底理由不静默丢失）；`pnpm run validate` + precommit 全绿（engine 套件 + smoke-cdd 更新面）。
- **注**: docs 面 `result-face.ts` / `result-face.test.ts` 保持不动（M2 计数，C1 ① 互证面）；本任务不改 SKILL.md（判读措辞归 T2）。

### Task 2: C1 ①④ status 路由判据 + skills ×5 重锚 + 等价单测

- **Do**: 五份 SKILL.md——`cli-driven-development`（`:59,66,72,86,104,120-124`）+ `writing-single-spec` / `writing-overall-spec` / `writing-phase-spec` / `writing-plans`（I 节）：Review Convergence 与流程 digraph 的 `{blocker=0?}` 判据改述为 **status 判据**（`CHANGES_REQUESTED` ⇒ S1 fix 后必 re-review / `REVIEW_FIX` ⇒ S2 收口 / `APPROVED` ⇒ S3），边缘条件（`entered via blocker>0` / `blocker=0`）改 status 术语，node 定义的 Exit/Do 文字同步；判读指令删「reads only the `status` / `blocker` count」措辞、改「读 `status:` 路由」（output-contract Read 面同步 3 行/4 行契约）；Failure-Modes 表「blocker from output contract」改写为 `status: BLOCKED` + stderr `CDD_BLOCKED:` 理由（M4 语义，cli-driven-development 面）；digraph-consistency 结构断言保持绿（结构调整不破坏节点/边接线面）。engine 等价单测（colocate `finalize.ts` / `convergence.ts`）：构造含 `severity=blocker` findings → 断言 status=CHANGES_REQUESTED（收敛语义 = fix 后必 re-review）；warn/nit-only → REVIEW_FIX；zero findings → APPROVED——status ⟺ severity 汇总等价，防旁路稀释。
- **验收**: 5 份 SKILL.md 零「blocker count」判读措辞、Review Convergence 以 status 锚定（precommit digraph 套件 + 措辞 grep pin 绿）；等价单测通过（`CHANGES_REQUESTED` ⟺ ≥1 `severity=blocker`）。
- **注**: 消费面零程序叙事（iron rule）——skills 文案只承载收敛判据语义、不携带本程序 phase/issue 叙事；digraph 结构调整须过 skill-anatomy 结构断言（边界内，无需 growth registry）。

### Task 3: C1 ③ 命名档案收编

- **Do**: `docs/maintainers/02-naming-conventions.md`——`§3.5`（`:70`）移除 `blocker`（保留词清单去项）；`§3.2` 增 **bounded 映射**行：`blocker` = review finding 严重级（M1，唯一词义）、`BLOCKED` = 轮次状态（M4）、handoff `blocker` 字段（docs 面）= BLOCKED 理由串、task 面理由经 stderr `CDD_BLOCKED:` 单通道、stdout 仅 docs 结果行 `blocker: <n>` 作 M1 计数呈现；`§3.3` mechanismNames 迁移表补一行（stdout return-block `blocker:` 列 → 移除；`blockerDefaultFor` → 删除）。
- **验收**: `§3.2` bounded 行落 + `§3.5` 零 `blocker` + `§3.3` 迁移行齐全；precommit 全绿（maintainers 一致性检查）。
- **注**: 文档 English-primary；「一词一义」Principle 2 正式兑现（F8 时代豁免请求收尾）。

### Task 4: C2 ⑤⑥⑦ claim 判别 + range 语义 + 语法显式化（documents.ts）

- **Do**: `packages/cdd-engine/src/rules/documents.ts` 判别/range/语法收口——⑤ **判别结构性规则**：claim 声明仅认可 clause 头部 token `Pending`/`[Pending]`（`CLAIM_SCAN_RE` `:1411-1413` 收到 `claimTarget` 的 `^` 锚 `:207` 头部语义）+ **非括注内联**；括注内（`（…）`）或非头部位置的字面命中 = prose hint、不声明、不参与收敛审计（引导词「链接形态」「例如」「方式」不作词典成员判定）。⑥ **range 语义**：声明位 `P3.10.1-P3.10.5` = 多目标声明（个相位逐一为目标）；prose 位 = 描述性列举不声明；解析产出携带**展开相位清单**（`phaseIdsIn` `:217` range 展开位产出，诊断可见，防静默批量误配）。⑦ **语法显式化**：字母后缀（`P3.10a`）不再静默吞入父行——报**非法 phase-id** 错误态（语法判定，不进父行、解析相位槽位止于错误态）；合法形态指引（点分式 `P3.10.1`）为规则语义目标，指引/可执行动作文案由 T5 三件套载荷层组装。判别/range 消费位锚点落齐：判别门消费面 = `claimTarget`/`claimKey`（`:207`/`:245`）与 `claimWindows`（`:322`，括注内/非头部字面命中归 stray 的判别消费区）、range 展开位 = `phaseIdsIn`（`:217`）；`proseHintSuffix`（`:460`，消费于 `:800`/`:823` backfill claim failures）是 T5 三件套的替换对象，T4 判别门不触碰诊断替换面。engine 单测：#274 残留形态回归 pin（括注「（Pending → p3.10.1 链接形态）」不声明）；头部 `Pending → P3.1` 命中；非头部字面命中不声明；range 声明位多目标 / prose 位不展开 + 展开相位清单载荷断言；`P3.10a` → 非法 phase-id 错误态（不进父行、解析相位槽位止于错误态，#304(b) 实测链回归，原吞父行行为断言不复现），合法形态指引文案断言在 T5 载荷层。
- **验收**: 判别/range/语法三面 engine 单测全绿；#274 残留形态回归 pin 成立；字母后缀报非法而非吞父行（#304(b) 实测链精确回归）。
- **注**: 语法显式化承接「P3.10a-e → P3.10.1-.5」正名债；本任务仅做判别、range 展开与解析载荷，不产诊断文案（指引/可执行动作文案由 T5 三件套载荷层组装）。

### Task 5: C2 ⑧ 诊断三件套

- **Do**: doc-contract BLOCKED / mismatch 输出（docs 派发面，`documents.ts` 审计 + 报错载体）升级为三件套——(1) **肇事上下文**：触发 claim 的 clause 摘录 + claim 解析到的相位 + 解析机理（如「P3.10a → 非法 phase-id（字母后缀）：不回退父行，合法形态指引 P3.10.1」——非法形态下解析相位槽位止于错误态；历史吞父行旧机制仅作排障史标注，不放入解析相位槽位）；range 声明（声明位）的肇事上下文另含**展开相位清单**（与 T4 解析产出同一载荷，避免静默批量误配，⑥ 验收「诊断附展开清单」在输出面可测）；(2) **按类别分派建议**：语法类 → 合法 phase-id 形态 + 定位（表格行/单元格）；prose 类 → 肇事 clause 摘录 + 建议措辞；(3) **可执行动作**：每条错误至少一个可直接执行的定位/修复动作（如「将 `P3.10a` 改为 `P3.10.1`」）。三件套落地位：forward-mismatch 的 `proseHintSuffix`（`:460`，消费于 `:800`/`:823` backfill claim failures）——现行「isolate prose with `；`」单行 hint 为其替换对象。engine 单测：mismatch/BLOCKED 输出载荷断言（clause 摘录 + 解析相位 + 机理 + 类别分派 + 可执行动作五要素齐备）+ range 声明（声明位）诊断面「列出展开相位清单」断言成立。
- **验收**: 诊断载荷单测全绿（五要素断言）；range 声明（声明位）诊断面列出展开相位清单（⑥ 验收「诊断附展开清单」逐字可测）；排障引导面直达根因——语法类引导到合法形态与定位、prose 类引导到肇事原文（零误导错误信息兑现，#304(b) 三轮盲修实证消除）。
- **注**: T5 完成后由 orchestrator 建双包 changeset（`cdd-engine` patch + `osuperpowers` patch）并跑 `pnpm run validate` 全量核对；issue #302 + #304 + #305 + #306 于 finishing 收口关闭。

### Task 6: C3 branch-review 通道契约收口（spec v1.3 backfill：#305 + #306）

- **Do**: `cli/review.ts`（`:95,122-126`）branch channel `ctx.repoRoot` 由 `opts.root ?? null` 改**解析后 root**（`:95` 已解析值）——黑盒路径恒真、`base.ts:218` 的缺根 WARN 零触发。`dispatch/base.ts`（`:217-220`）doc-contract 缺根面升级——**真实 mode `→ CDD_BLOCKED` + exit 1（严禁缺根 WARN + exit 0 空转）、dry-run → 保持 WARN**（I7：dry-run 永不阻塞；`ctx.dryRun` 判定）。`cli/parse.ts`（implementCmd/reviewCmd/fixCmd，`:167-195` 一带）三命令统一声明 `root` flag（`--root`，对齐内部 `opts.root ?? getRoot()` 注入契约）。`dispatch/branch.ts` branch-review **真实 mode** `normalizeResult`（`:460-479`）补 result-line——经 `returnFromHandoff(this.handoffPath, this.workspace)` **单点 emit return block**（吃 T1 的 4 行新契约 status/commits/artifacts + counters，无 `blocker:`），与 dry-run `assembleReturnBlock`（`:393-402`）、docs face、task return block 同源对齐。engine 单测：branch-review 真实 mode 父进程 stdout 有契约行（调 `runReview` 或黑盒断言）+ 缺根双 lane（真实 → `CDD_BLOCKED` + exit 1 / dry-run → WARN）+ `--root` CLI 白名单可注入 + doc-audit 门在 branch-review 黑盒路径实跑（不 WARN-skip）。
- **验收**: branch-review 真实 mode stdout 含 return block（status/commits/artifacts + counters，零 `blocker:`）单测断言；缺根真实 mode → `CDD_BLOCKED` + exit 1、dry-run → WARN（双 lane）；`cdd review/fix/implement --root <path>` 可用（parse 白名单）；branch-review 黑盒路径零「doc contract validation skipped (no repo root)」WARN（doc-audit 门实跑——C2 审计面在终闸生效）；`pnpm run validate` + precommit 全绿（engine 套件 + smoke-cdd 更新面）。
- **注**: 依赖 = T6 必须在本程序终闸 branch-review 之前落地（spec C3：C2 审计被跳过 + C1 status 路由无信号则本程序验收无法完成）；本任务不改 return-block.ts/finalize 载体面（T1 域）；`returnFromHandoff` 的 `blockerDefaultFor` 删除随 T1 已收敛，T6 消费其 4 行产出。

### Task 7: C4 branch-fix 收据契约（spec v1.4 backfill：#307）

- **Do**: `src/artifacts/handoff/finalize.ts` `finalizeHandoff` mode `"fix"`（`:429-436`）从**原样透传 agentHandoff** 改 **engine 事实重造**（与 `finalizeImplement` `:416-427` 同构）：commits（git facts `base`/`head`）+ phase + status（commit-contract 判定）为权威，agent 原始 handoff 为输入（findings/notes 保留、未知键与 `$schema` 剥离）；**修已 commit（commits.head 前移）且无代码面错误 → 收据自愈 APPROVED**，不再硬闸于收据形状；真正失败面（无 commit / 代码面错误）仍 BLOCKED。`src/render/templates.ts` `renderHandoffSchemaJson`（`:191-193` / `#shellFor` `:229`）注入面收敛为**可写子集**——剥 `$schema` 元键 + 剥 dispatch-盖章字段（`review_scope`「not authored」族）。仍败面（`src/dispatch/branch.ts:288,291`）blocker 附**期望形态**（承 #306 引导号召；现状已含字段名）。engine 单测：构造「修已 commit + agent handoff 带 `$schema`/坏 `review_scope`/坏 `notes`」→ 断言收据自愈 APPROVED（非 BLOCKED）；注入 schema 零 `$schema`/零 `review_scope`（grep）；仍败面带字段名 + 期望形态。
- **验收**: branch-fix 修已 commit + 无代码面错误 → APPROVED 收据（单测断言，不 BLOCKED）；注入 schema 可写子集（grep `$schema`/`review_scope` 注入面零命中）；仍败面 blocker 附期望形态；`pnpm run validate` + precommit 全绿（engine 套件 + smoke-cdd 更新面）。
- **注**: 依赖 = T7 必须在本程序终闸 branch-fix 之前落地（spec C4：终闸 branch-review 通过后的 branch-fix 同撞收据闸）；与 T1 共享 finalize 单点（消费 4 行新契约），零文件冲突——T1=return-block/finalize 载体面已收敛，本任务=finalize 重造路径 + render 注入面。

### Task 8: C5 engine core — `next:` 输出面（spec v1.5 backfill）

- **Do**: 新 `packages/cdd-engine/src/rules/next-step.ts` 纯派生模块 `nextStepFor(ctx)`——输入 = **既有 dispatch ctx/opts 对象字段**（op/type/group/round/ref/status/findings/workspace/plan/commits.base-head），零新 CLI 参数（C5-2 显式约束：`parse.ts`/usage/白名单零变更）；对 review：有 findings → `next: cdd fix --type <t> [--tasks <n>] --plan <p> --findings <h>`、零 findings → `next: none`/剩余组 implement/全部收罄 branch-review；对 **fix**（C5-1 责任单一判定点）：按 `--findings` 内容 `convergence.blockerCount`——含 blocker>0 → `next: cdd review …`（re-review 新 ref）、仅 warn/nit → `next: none`（收口轮自然化）、连续 S1 达 soft cap → `next: BLOCKED: review-cycle-cap — user adjudicates`；自身 BLOCKED 不产 `next:`（走 failure-mode stderr 面）。**suggestion 语义（C5-0）**：载荷为「默认下一跳建议」，注释明示 mid-backfill / Plan Sole Writer / 用户裁决可覆盖。三输出面统一追加 `next:` 行：docs result face（`cli/review.ts:205-211`）· task return block · branch return block（**T6 已落地的 `normalizeResult` emit 层消费**——T8 在 T6 世界态上直挂）。`scripts/validate/smoke-cdd.ts`（`:33,466`）输出契约 4-key → 5-key（+next）。engine 单测：nextStepFor 全表（review 有/零 findings × fix 输入 blocker>0/仅 warn-nit/cap × 收口轮）+ 三输出面各含 `next:` 行断言 + BLOCKED 面不产 `next:`。
- **验收**: 三输出面（docs face / task / branch return block）各含 `next:` 行（单测 + smoke-cdd 5-key pin）；fix 面下一跳判定全表单测绿（输入 blocker>0 → `next: review` / 仅 warn/nit → `next: none` 收口 / cap → `next: BLOCKED: review-cycle-cap`）；`parse.ts`/usage 零变更（grep `--next` 零命中）；`pnpm run validate` + precommit 全绿（engine 套件 + smoke-cdd 更新面）。
- **注**: 依赖 = T8 须在本程序终闸 branch-review/fix 之前落地（spec C5 依赖裁定）+ 消费 T6 emit 层（branch 面）；BLOCKED 轮走既有 failure-mode 通道，`next:` 非 exit 码控制器（仅建议，exit 语义不变）。

### Task 9: C5 skills ×5 精简（spec v1.5 backfill，T8 世界态）

- **Do**: 五份 SKILL.md（`cli-driven-development` + `writing-single-spec` / `writing-overall-spec` / `writing-phase-spec` / `writing-plans`）：S1/S2/S3 fix/review 路由散文坍缩为共享引用「**`next:` 是 engine 给出的默认下一跳建议；直接继续则按它派发，mid-backfill / 用户裁决落地后以当前世界态为准**」——每节点 Do/Exit 依 T8 输出的 `next:` 载荷路由（不再自述 S1→fix→re-review / S2→closing 判定）；判读措辞统一「读 `next:` 建议」；五处「review closes in three segments…」长散文收编为一处共享引用（I1/I3 不变式保留「是什么」、去掉「怎么做」复述）；I5（不 bypass）/ I7（dry-run 模拟）/ I2（commit 纪律）不变式与 digraph 结构原样保留；消费面零程序叙事（iron rule）。digraph-consistency 结构断言保持绿（结构调整不破坏节点/边接线面）。
- **验收**: 5 份 SKILL.md 零 S1/S2/S3 路由复述（grep pin——仅保留不变式中的收敛语义引用）；判读措辞统一引用 `next:` 建议（含 I6 mid-backfill 兼容句）；precommit digraph 套件 + 措辞 grep pin 全绿。
- **注**: 依赖 = T9 须在 T8 之后（消费 engine 已印 `next:` 的世界态）+ 终闸前落地（spec C5 依赖裁定）；本任务零 engine 代码面改动（纯 skills 文档精简）。
