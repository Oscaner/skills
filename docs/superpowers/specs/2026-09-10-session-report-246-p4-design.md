# P4 — overall 四表一致性机械守卫 + 程序文档收敛 — Design

- **Version**: v1.0 · 2026-09-11
- **Status**: Draft
- **Author**: [human] · Claude Opus 5 (1M context) (osuperpowers:brainstorming)
- **Parent program**: [2026-09-10-session-report-246-overall.md](../specs/2026-09-10-session-report-246-overall.md) v1.12
- **Depends on**: 无 hard 依赖（P1/P2/P6 已 shipped，未与其文件族相交）

---

## Section 0: Incremental warning

> P4 increment only。跨 phase 约定在 [overall](2026-09-10-session-report-246-overall.md)；overall 冲突时 overall 胜。本 phase 只动：`scripts/validate/` 新模块 + osuperpowers skills/docs 收敛（add-phase-protocol SSoT / CDD 死档清除）。不动 vendored 子模块；cdd-engine **功能改动仅两处**（§2.6.7 健壮性 hardening：`lib/runner/run-docs.mjs` 读 agent handoff 包 try/catch → BLOCKED；`lib/cli/review.mjs` `existingRoundHandoff` 包 try/catch → null）声明为 Section 3 dev 登记的例外；仅三处 engine **注释** cite（`write.mjs` L2/L22 + `contract.test.mjs` L10）随 handoff-schema 修剪同步（§2.6.5）；`finalize.mjs` L53 cite 指向被保留的 Severity→status mapping 表，不需同步，见 §2.6.5。

---

## Section 1: Constraints pointer

> 不重复 overall 约定。仓库语言政策：spec 中文（Strategy B）。改动须过 `pnpm run validate` 13 块（本 phase 新增第 12 块）；skills/docs 改动后必须 `pnpm run emit`（`.agents/` 是派生产物）。vendored 子模块不可改。changeset 逐 phase（`@oscaner-skills/osuperpowers` **minor**——shipped skills/docs 变更面；`@oscaner-skills/cdd-engine` **patch**——§2.6.7 两处健壮性修复；`scripts/validate` 为 repo 内部自动化不经 changeset）。

---

## Section 2: Design body

**Issues**: F6（[#246#issuecomment-5616300332](https://github.com/Oscaner/skills/issues/246#issuecomment-5616300332)）——overall 四表状态漂移无机械守卫；F13（P6 closeout 实测，无独立 comment）——phase shipped 后四表未自动回填（P6 plan 列 [Pending] 至人工提醒）。

### §2.1 根因（高维度：四表 → 可机械验证的状态权威）

四表（Issue inventory / Phase inventory / Dependency graph / Change history）是程序的**状态权威**（F6 本旨）。现状：各 phase closeout 只写 change-history entry，不回填 Phase inventory 状态列；无任何机械守卫 → P6 式漏回填（closeout 跑了、列没动）只能靠人工审计发现。

仓库实证（三 overall 全部结构**异构**）：

| Overall | 状态 | Phase inventory 头 | 守卫形态 |
|---|---|---|---|
| cdd-engine-overhaul v1.27 | 已 shipped | canonical 7 列（`…Implementation plan…`） | 必须放行 |
| session-report-246 v1.12 | in-flight | canonical 7 列 | 必须放行 |
| post-dogfood-bugfixes v1.25 | Pδ/Pζ 仍 Pending | 异构 8 列（`Plan\|Status\|Deliverables`）、行错位、change-history v1.23 重复 | 严格守卫必误报 |

**Fix direction（逐问拍板）**：
1. **守卫面（Q1）**：仅 canonical 7 列头（含 `Implementation plan` 列名）的 overall 被守；非 canonical 格式打日志跳过，不做多格式解析（post-dogfood 非 canonical 被自然豁免；新程序用 canonical 头即自动守备）。
2. **shipped 判定（Q2）**：**不回填声明 ↔ Phase inventory 列双向一致性**——change-history 行凡含「该 phase 的 plan/design 列 → Done/具名」的**回填声明**，则 Phase inventory 对应列必须匹配；反向：列 = Done 但全史无声明 → 漂移。声明文本即语义（yyds 无需 shipped 动词启发式——「最新提及 + ship 动词」方案会误判在途 phase，实测否决）。
3. **issue 引用（Q3，高维度上探）**：**声明式 issue 注册域（declared issue universe）**——Issue inventory 表 = 程序注册域；引用语法定级：`#NNN#issuecomment-<digits>` 锚点 = 机器无歧义 issue 引用（唯一被守卫扫描的形式）；纯 `#NNN` prose = 语义过载（AC 编号 / PR / legacy / issue 共用 token，实证 `AC#14`、`#236` PR）→ 不可机械判定，文档化边界。任何 membership 强扫会双杀现有 shipped 程序 + 自家在途程序（实证：session-246 整体文档引用 #240-242/#117-118/#230 等未注册 Related/legacy 编号；cdd-overhaul 引用 #109/137/139 + PR #237）→ 不做全量 #NNN 扫描。
4. **作用面开放（用户指令）**：允许破坏性更新；变更面 = skill（add-phase-protocol SSoT + templates/SKILL.md 委托）+ engine-side（validate 新块）+ 文档收敛（登记规则 4 处重复 → 1 SSoT；CDD 死档清除）。hooks 不需新增——既有 pre-commit hook + pr-validate CI 已是 validate 门，守卫自动入闸。

### §2.2 设计决策（含破坏性更新许可下的取舍）

- **canonical 头判定**：正则 `^\|\s*#\s*\|\s*Phase\s*\|.*Implementation plan`（头行同时含 `#|Phase` 与 `Implementation plan`）。
- **回填声明解析器**（§2.3.2）：phase token `P\d+(?![0-9])[a-z]?`（数字边界——防未来 P10/P11 前缀误匹配 P1）+ 区间展开（`P1–P4/P6` → P1..P4 + P6，分隔 `[–—-]`；区间端点同带边界）；plan-claim = 行含 `plan`/`计划` **且** `Pending\s*→` 且目标非 Pending（明确**括号可选**：`（[Pending]→Done）` 与 `Pending → Done` 同构，覆盖 `plan 列回填（[Pending]→Done）`、`Implementation plan Pending → Done`、`Implementation plan 列 Pending → Done` 三实证形态）；design-claim = 行含 `Design[- ]spec` **且** `Pending\s*→`（目标非 Pending 态，覆盖 `Design-spec 列（[Pending]→P1-design v1.0）`、`Design spec 列 Pending → P2-design`）。**v1.7 行「Design-spec 列 v1.1→v1.2（v1.6→v1.7）」无 `Pending` → 非 claim 不误报**（实证行，非 v1.8——v1.8 行为 v1.2→v1.3）。
- **④ 反向的取舍**：plan 列反向（列 Done + 无 claim → 报）——两 canonical 程序全 phase 均成立（cdd v1.26/27、session-246 v1.3/9/12），保留；**design 列反向不做**——cdd-overhaul P3 design 列具名（`P3-design §2.6+§2.4`）但全史无「Pending→」声明（旧程序记录 style），强制会误报 shipped 程序 → design 仅正向（声明 → 列非 [Pending]）。
- **plan 列语义**：canonical 程序 plan 列取值 = `Done` / `[Pending]` 二值；「shipped」= 非 `[Pending]`。F13 在途容忍：plan 文档已写、列仍 `[Pending]`、无声明 → 合法（不报）。
- **文档存在性派生（BLOCKER 修复：日期无关 slug 后缀 glob）**：以 overall 文件名剥去前导日期 + 尾部 `-overall.md` 后的 **slug** 为根（`cdd-engine-overhaul` / `session-report-246`），计划/设计文档用后缀 glob `*-(slug)-p<n>{,-design}.md` 定位（允许独立于 overall 日期的每-phase 文件日期）。实证：cdd-overhaul p2–p6 各自携带独立日期（p2=2026-09-05、p3=2026-09-06、p4=2026-09-08、p6=2026-09-08、p5=2026-09-09），按 `<X>-p<n>` 日期前缀推导会全 404 → 伪报 shipped 程序；slug 后缀 glob 将 cdd p2 正确解析到 `plans/2026-09-05-cdd-engine-overhaul-p2.md`。plan 列 shipped → glob 命中一处文档存在断言；design 列具名 → **仅取该 phase 自身的 `P<n>-design` token**（phase-id 匹配；cell 中其他 `P\d+-design` 为跨引用不入 glob——实证 cdd P4 design 列 `P4-design §2.2–§2.5（源 P3-design §2.2 + §2.3 + §2.5）` 只断言 p4-design 文档）；glob >1 → FAIL（歧义）；`Done`/`[Pending]` design 列 → 不断言（`Done` 为旧程序 legacy 形态无可派生名，实证 cdd P1）。
- **注册域扫描面**：overall + `docs/superpowers/{specs,plans}/*-(slug)-p*.md`（同日期无关 glob）的 `#NNN#issuecomment-\d+` 锚点；`#NNN` ∈ Issue inventory block 全 token 集。
- **撤销无候选**：不做「版本行感知 / 全局 #NNN 强制 / marker sidecar / allowlist」——四者或依赖较弱纪律（版本头）、或在 GH 共享编号空间下不可成立（PR/issue 同号）、或新增 artifact 增加写义务（yyds 声明文本已在 change-history）。
- **改动面最小化**：新块单模块只读；index.mjs 追加一行 spread；既有模块零改动。

### §2.3 组件与数据流

1. **`scripts/validate/overall-consistency.mjs`**（新，导入-only + 独立可运行）：导出 `steps`（`{name: "12. overall consistency", run}`）+ `runIfMain` 守卫（模式同 version-sync.mjs）。`main()`：发现 `docs/superpowers/specs/*-overall.md` → 逐文件 parse → 检查 ①-④ → 全过打 `OK — <file> (N phases)`；任一 fail → throw（runner 转 exit 1 + `== FAIL ==`）。scan-set 空 → SKIP（无 overall 不 fail）。
2. **检查 ① 回填声明 ↔ 列**（§2.2 shipped 判定落地）：
   ```
   // change-history 每行 summary：
   //  plan-claim(X)：行含 P1 类 token（展开区间）+ plan 标志 + [Pending]→Done
   //  design-claim(X)：行含 token + Design-spec 标志 + Pending→(非Pending)
   // 正向：claim → assertPhaseCol(X)
   //  plan-claim → X.plan == "Done"-ish；design-claim → X.design ≠ [Pending]
   // 反向（仅 plan）：X.plan shipped ∧ 无任何行含 plan-claim(X) → FAIL（无 shipping 记录却宣称 Done）
   ```
3. **检查 ② 文档存在性（slug 后缀 glob）**：对每 phase——plan 列 shipped → `docs/superpowers/plans/*-<slug>-p<n>.md` glob 命中 1 处（含独立日期，如 cdd p2 → `2026-09-05-cdd-engine-overhaul-p2.md`）；design 列具名 → `docs/superpowers/specs/*-<slug>-p<n>-design.md` glob 命中；glob >1 → FAIL（歧义）。
4. **检查 ③ change-history 升序**：行版本 `v<major>.<minor>` 严格递增（tuple 比较）+ 版本不重复 + 版本/日期列非空。
5. **检查 ④ 交叉引用**：
   - **④a 注册域**：overall + `docs/superpowers/{specs,plans}/*-<slug>-p*.md`（同日期无关 glob）的 `#NNN#issuecomment-\d+` 锚点 → `#NNN` ∈ Issue inventory token 集（未注册 → FAIL）。纯 `#NNN` 不扫。
   - **④b**：Dependency graph ASCII block 全部 `P\d+` token ∈ Phase ids；Phase inventory Dependency 列 `P\d+` 前驱 ∈ Phase ids。
   - **④c**：Issue inventory 每行 ref 列**宽松读取**——以 `#\d+` 起始（可带尾随说明文字，实证：session-246 F12/F13 行 `#246（session master body…）`/`#246（P6 closeout 实测…）`）或含 `#issuecomment-\d+`，或纯 `none`/`(…)` 文本；Phase 列 ∈ Phase ids。
6. **非 canonical 跳过**：头行不匹配 → `CDD_INFO: skip <file> (non-canonical phase inventory header)` 日志 + continue（不 exit）。

### §2.4 错误处理

| 情形 | 行为 |
|---|---|
| 任一检查 fail | throw（runner `== FAIL: 12. overall consistency ==` + exit 1） |
| 无 `*-overall.md` | OK-SKIP（不 fail） |
| 非 canonical 头 | 日志 skip（不 fail；post-dogfood 实证豁免） |
| overall 文件读失败/损坏（表不可 parse） | `CDD_INFO: malformed <file> — skipped`（不 exit；守卫对不可解析整体不武断判死，防误报在途写作态） |
| change-history 某行版本解析失败 | 该行 flagged（行 well-formed 断言，③） |

### §2.5 测试

- **单元矩阵**（`scripts/validate/overall-consistency.test.mjs`，vitest 自动收编进 block 7；fixture 置 `scripts/validate/fixtures/overall-consistency/{specs,plans}/`，路径相对禁用系统根，全部走 fixture 结构）：
  1. clean canonical → pass（全检查绿）
  2. plan-claim 但列 [Pending] → fail（①正向）
  3. plan 列 Done 但文档缺 → fail（②）
  4. change-history 降序 / 版本重复 → fail（③）
  5. Dependency graph 悬挂 P9 → fail（④b）
  6. Issue inventory ref 畸形 → fail（④c）
  7. phase 文档锚点 `#999#issuecomment-…` 不在注册域 → fail（④a）
  8. design-claim 但列 [Pending] → fail（①正向）
  9. plan 列 Done 但全史无 claim → fail（①反向）
  10. 非 canonical 头 → skip + 不 fail
  11. 声明混合行：plan 区间 `P1–P4/P6` 展开 + design 正向声明（cdd v1.27 形态，同一行内）→ 逐 phase 断言（无 design 反向语义）
  12. 跨日期 phase 文档（fixture 内 p2 文档 vs overall 不同日期）→ slug 后缀 glob 命中，② 通过（防 BLOCKER 回归）
- **实证绿**（测试内对 `docs/superpowers/specs/` 三个真实 overall）：cdd-overhaul + session-246 → pass；post-dogfood → skip（非 canonical 头断言）。
- **集成**：`ci-validate.test.mjs` 增「12. overall consistency 步骤存在」接线断言；计数同步（见 §2.7）。

### §2.6 文档（skill + docs 收敛）

**登记规则「4 处重复」显式枚举与处置**：

| # | 站点 | 处置 |
|---|---|---|
| 1 | `brainstorming/docs/overall-spec-template.md` §Update trigger conditions（3 场景） | 删除独立表述 → 委托 add-phase-protocol §注册域；3 场景语义（执行期新发现 / pre-consume / re-assign）**并入协议**，不丢指导 |
| 2 | 同上 §Missed-update detection | 删除 → 委托 add-phase-protocol §注册域 |
| 3 | `brainstorming/docs/add-phase-protocol.md` §1 checklist item #1 | 保留为 SSoT 本体（增补注册域语义） |
| 4 | `brainstorming/SKILL.md` commit-spec 节点 4-table 清单 Issue inventory 行 | 删除独立表述 → 委托 add-phase-protocol（列表短链接，摘要保留） |
| 5 | `brainstorming/SKILL.md` **sync-overall** 节点内联四表清单 ①-④ + consistency check | 与 #4 同构 → 委托 add-phase-protocol（保留「four tables consistent → 回 re-explore；inconsistent → BLOCKED」流程摘要，注册语义归协议） |

1. **add-phase-protocol.md = 登记规则唯一 SSoT**：增「§注册域：issue 引用语法定级」——锚点形式（`#NNN#issuecomment-…`）= canonical 机器可判 issue 引用（新 issue 必注册）；纯 `#NNN` = 歧义非判定物（AC/PR/legacy 共用 token），机械守卫只扫锚点；**继承 template 的 3 触发场景**（执行期新发现 → 声明归属 + 加行；pre-consume → 加行 + 标 pre-consumed；re-assign → 更新 Phase 列）。
2. **overall-spec-template.md**：§Update trigger conditions / §Missed-update detection 独立表述删除 → 委托 add-phase-protocol §注册域（去重 + 消歧义）。
3. **brainstorming/SKILL.md** `commit-spec` 节点 Issue inventory 清单行委托 add-phase-protocol（上表 #4）；其余 3 项清单（Phase inventory / Dependency graph / Change history）保留本地。
4. **program overall 自身段落回填**：session-report-246 overall 的 §Update trigger conditions / §Missed-update detection 段落（L64-69，含「P4 机械守卫落地前由人工检测把握」）随 **v1.13 同步**改为委托 add-phase-protocol §注册域（守卫落地后原人工措辞过期）；cdd-overhaul 为 frozen shipped 程序，其自身段落**豁免**（不触碰 shipped 程序全文——§2.4 非 canonical 同理的边界）。
5. **CDD 死档清除**（用户 flag 的文档臃肿）：
   - 删 `cli-driven-development/docs/cdd-reference.md`（103 行，0 **live** 外部引用死簇成员——4 份 frozen shipped 历史文档（post-dogfood p-epsilon design/plan、cdd-overhaul p3 plan/design）含路径提及，为冻结快照、删除被接受；stale：`progress.md`/`CDD_LEDGER`——engine 实为 `progress.json`；`../templates/{implement,task-review,fix}.md` 指向不存在目录；legacy H 锚点/旧 spec 段落引用）
   - 删 `cli-driven-development/docs/controller-handoff.md`（42 行，同上死簇成员）
   - `cli-driven-development/docs/handoff-schema.md` **修剪到当前 reality**（被 engine `lib/handoff/write.mjs` L2/L22 + `tests/contract.test.mjs` L10 的注释 cite）：去 batch `tasks[]` 段（engine 无 batch）；补 round 命名表（`task-N-review-R.json` 族）；模板链改指 `packages/cdd-engine/templates/`（task/review/schema）；SOT 明确 `templates/handoff-namespace.json` + `templates/schema/*.json`；progress 指 `progress.json`；保留 status/severity→status 映射（handoff-namespace.json 不承载该语义）；**引言行（L1/L3）联动**——去掉 `[controller-handoff.md](controller-handoff.md)` cite（随删除失效）+ `../templates/{implement,task-review,fix}.md` 模板链改指 `packages/cdd-engine/templates/`（原相对路径不存在）
   - **engine 注释 cite 同步（3 处）**：`write.mjs` L2/L22 + `contract.test.mjs` L10 改同时指 `handoff-namespace.json`（纯注释，0 功能变更）；**明示不需同步的第 4 处**：`lib/handoff/finalize.mjs` L53 cite 指向被保留的 Severity→status mapping 表——修剪保留该表，cite 继续有效，实现者 grep「handoff-schema」时不得误改/漏改
6. **validate block 集成**：`scripts/validate/index.mjs` 引入 `overall-consistency.mjs` steps 追加至尾（submodule 后）；计数同步：index.mjs 注释×2、`scripts/run.mjs` 注释 + commander desc、CLAUDE.md「12 validation blocks」→ 13。
7. **engine 健壮性 hardening（P4 自身 spec-review dogfood 发现，2026-09-11）**：review agent 手写 handoff 时把 spec 文本中的正则记号 `#\d+` 原样写入（`\d` 非法 JSON 转义）→ `run-docs.mjs:89` 读 agent handoff JSON.parse 未包裹直接 throw → review 派发 exit 2、无 BLOCKED handoff、无 progress 记录（轮次静默丢失）；gate 侧 `review.mjs` `existingRoundHandoff` 读 corrupted prev 同样 throw。两个健壮性缺口：
   - `run-docs.mjs:89`：handoff 读入包 try/catch，SyntaxError → `writeBlocked`（blocker = "handoff JSON unparseable: <msg> → fix the handoff or re-run review"）——与既有「handoff 未写 / schema 无效」BLOCKED 分支同构（含 doc_hash 载体）
   - `review.mjs` `existingRoundHandoff`：JSON.parse 包 try/catch，corrupted prev → 返回 `null`（fail-open：不因 corrupted prev 锁死重审；最坏多一轮 review，绝不自锁）
   - docs-runner 测试：agent 写坏 JSON → BLOCKED handoff（非 throw exit 2）

### §2.7 Acceptance criteria

- `node scripts/validate/overall-consistency.mjs` 对两个 canonical 真实整体 = pass、post-dogfood = skip-log；任一 fixture 突变 → exit 1（throw + `== FAIL ==`）
- `pnpm run validate` 13 块全绿（含新块 12. overall consistency）；无 overall 时 SKIP 不 fail
- cdd-overhaul + session-report-246 现有四表形态零误报；在途 P3/4/5/7（plan 文档未写、列 [Pending]）不被误报；**跨日期 phase 文档绿色**：cdd-overhaul 六 phase 的 plan/design 文档（p2–p6 独立日期）经 slug 后缀 glob 全部命中（BLOCKER 回归门）
- P6 式漏回填实证捕获：closeout 行声明 plan Done ↔ 列表 [Pending] → exit 1（① 双向）；**声明文本即语义、无独立 shipped 启发式**——v1.4「F13 登记」行不含 `Pending→` 声明 → 不触发断言（在途 P4 不被误报）
- 登记规则 5 处重复（§2.6 表，含 sync-overall 节点）→ 1 SSoT（add-phase-protocol §注册域承载注册域语义 + 锚点语法定级 + 继承 template 3 触发场景）；template/SKILL.md commit-spec + sync-overall 委托引用、session-246 overall 自身段落随 v1.13 委托、cdd-overhaul 段落 frozen 豁免——无残留重复表述、无场景指导丢失（§2.6 表每行处置可逐条核验，sync-overall 一致性流程摘要保留）
- ④c 宽松读取：session-246 F12/F13 行（`#246（…）`尾随说明）实证放行
- CDD 死档清除：`cdd-reference.md`、`controller-handoff.md` 删除（含 emit 产物 `.agents/` 对应项随 emit 消失）；`handoff-schema.md` 修剪到当前 reality（无 batch `tasks[]`、无 `progress.md`、模板链有效）；3 处 engine 注释 cite 已同步
- `pnpm run emit` 已跑（emit drift 无）；sort-count 同步（13 块）
- changeset（`@oscaner-skills/osuperpowers` minor + `@oscaner-skills/cdd-engine` patch）落盘，关 #246 F5→F6/F13
- overall P4 Phase inventory scope/acceptance 更新 + change-history v1.13 记账（pre-start scope 扩展）

---

## Section 3: Deviations from overall

| Overall assumption | Phase decision | Overall updated? |
|---|---|---|
| P4 scope = 四表一致性机械校验（4 项检查） | P4 执行期（brainstorm 定稿）扩展两项：登记规则 4→1 SSoT 文档收敛（§2.6.1-4）+ CDD 死档清除（§2.6.5-7 含 engine hardening）——用户「skills/docs 臃肿，看一下」指令 + P4 自身 spec-review dogfood 发现的结果，破坏性更新许可内 | Yes — 随 commit-spec 同步 v1.13（P4 scope/acceptance 行更新 + change-history） |
| 全程零 engine 功能改动 | §2.6.7 engine 健壮性 hardening 为**唯一 engine 功能改动例外**（`run-docs.mjs` handoff 读包 try/catch → BLOCKED + `review.mjs` `existingRoundHandoff` 包 try/catch → null）；其余只动 engine 注释（§2.6.5 三处）或不动 | Yes — 随 commit-spec 同步 v1.13（Section 0 已声明；changeset 增 `@oscaner-skills/cdd-engine` patch） |
| ③ change-history 版本升序 | 仅 strict 升序 + 不重复；post-dogfood 的整体豁免来自 **non-canonical 头 → 全文件 skip（不跑检查 ①–④）**（§2.2 Q1 守卫面，非检查 ① 单独豁免），故其 v1.23 重复不触发 ③ 误报 | Yes — 随 commit-spec 同步 v1.13 |
| — | — | — |

---

## Section 4: Notes for downstream

- P4 首个 plan/相位为「守卫落地」：因本 phase 会以自身为对象验证（session-246 overall 是 canonical 被守者），closeout 期 P4 自身 shipped 后的 plan 列回填 + change-history claim 即成为守卫的自我契约（验证周期 ① 双向）。
- P3（fix-mode 存续决策）与此正交，不冲突。
- 未来新程序：用 canonical 7 列头 + 锚点形式引用 + closeout 行携带回填声明 → 自动被 P4 守卫全检。

---

## Section 5: Review

Rule: Fresh-Subagent Review Passes (cdd review --type spec) 必须全过才进入用户 review 与 writing-plans。