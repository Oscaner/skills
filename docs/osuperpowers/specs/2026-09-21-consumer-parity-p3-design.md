# 消费者面一致性（Consumer Parity）— P3 Design Spec

- **Version**: v1.2 · 2026-09-22（spec-review r1 两轮 findings 已合流——`490e49b2`/`190d0ad7`，v1.15/v1.16 回填、overall v1.16 同步；本版 = spec-fix-4：review-4 AC4 探针实证修正（尾 `\b` 吞点边界断 → `[A-Za-z(]` 正向后缀 + node 断言）+ overall v1.17 同步）
- **Status**: Draft
- **Author**: [human] · Claude Opus 5 (1M context)
- **Parent program**: [2026-09-21-consumer-parity-overall.md](./2026-09-21-consumer-parity-overall.md) · v1.17
- **Depends on**: P2（shipped，PR #272 `39ed65a8`）；P2 design v1.4 Approved；grilling 合流（2026-09-22，v1.14 回填）

---

## Section 0: Incremental warning

> P3 增量仅限本 phase。跨 phase 约定见 [overall v1.17](./2026-09-21-consumer-parity-overall.md)；overall 冲突时 overall 胜。

本 spec 只做 **P3（本仓校验面重建）** 的设计增量：repo 侧四表守卫退役（S1/S2 + 42 用例 + `canary-dogfood.test.ts`）· validate 接线净化（steps 语义名、无四表 block、12→11 块）· canonical phase-id 语法 A · S3 残留簇改写 · F8a 盲区自消 · consumer-sim 升级挂 release 门 · skills 输出零过滤 + fix 边界条款 · **docs-family 命令出口统一（结果可见性 + exit.ts 出口）** · 运维规范落档。engine 判据面（P2 产物）与发布动作（P4）不属于本 phase，仅以「已就绪输入 / 下流交接物」形式出现。

## Section 1: Constraints pointer

> 不重复 overall 约定；overall 冲突时 overall 胜。

引下列 overall v1.17 条目，不重述正文：
- **判据定式**（C1 可达性 / C2 结构性 / C3 退化——useless 必删、无历史叙述豁免）：overall v1.8 Cross-cutting「判据定式」段
- **Non-goals**：不新增 cdd CLI 子命令（唯一例外 `cdd help` 已于 P2 落地）· 不改 emit/marketplace/changeset 内部流水 · 不把本仓 GitHub issue 注册语义强加消费者 · 不改 README/CLAUDE.md harness 宣称类
- **约束**：允许 breaking · 唯一执法面 = engine lifecycle（本仓无 scripts 侧兜底）· spec/plan 结构定义同源派生（canonical schema 单源）· engine 零文档写入 · 本仓=canary（运行期形态）
- **语言**：Strategy B（spec/plan 中文）
- **2026-09-22 用户裁决（binding，v1.14/v1.15/v1.16 回填）**：unit/e2e 测试 = 功能性验证，**零本仓产物为 fixture**（产物删即测试废 = 耦合病）· **零编号 anchor**（`5b0/5b1/5b/12.` 族退役，steps 语义名，不利运维）· **canonical phase-id 语法严格 A**（`^P\d+(\.\d+)*$` 点分分层，弃字母后缀）· **零 legacy 豁免死代码**（C3 直接命中）· 运维规范落档 docs/maintainers · **skills 调用 cdd 输出零过滤**（禁 `tail`/`head`/`2>&1 \|`/`EXIT=$?`——cdd 已自身优化输出长度，v1.15 补充）· **命令级出口统一走 exit.ts**（引擎所有运行函数成功路径禁止裸 `return;`，exit.ts 统一出口族 + 结果可见性——§2.9，v1.16 补充）

## Section 2: Design body

本 phase 增量 = **repo 侧四表守卫整面删除 + validate 净化 + canonical phase-id 语法 A + 残留改写 + consumer-sim**。核心命题：**四表判据面唯一实现 = engine lifecycle（P2 已建），本仓运行期每步 dispatch 自身被审——canary 实证回归其运行期本位，不落测试、不进 validate**。

### 2.1 判据面现状清算（退役面 vs 唯一实现面）

**退役面（本 phase 删除）**：

| 面 | 文件 | 规模 | 判据面覆盖 |
|---|---|---|---|
| S1 | `scripts/validate/overall-consistency.ts` | 543 行、block 12 | 四表审计（change-history 升序 / dep-graph 成员 / issue ref well-formed / backfill claim↔列双向 / doc-existence glob / anchor registry / row-shape） |
| S2 | `scripts/validate/plan-spec-anchors.ts` | 314 行、Class A/B/C | Class A（`**Spec:**` label==basename）+ Class B（Parent program → overall + version lineage）+ Class C（general file-path anchors + legacy 豁免） |
| 42 用例 | `scripts/validate/__tests__/{overall-consistency,plan-spec-anchors}.test.ts` | 27 + 15 | 同判据面的 repo 侧函数级断言 |
| canary-dogfood | `packages/cdd-engine/src/rules/__tests__/canary-dogfood.test.ts` | 79 行 | **产物耦合**：硬编码本仓真实文档路径为 fixture（P2 T6④ 的测试化形态） |

**唯一实现面（判据面所在，P3 不动判据、只删 repo 侧）**：
- 运行时：`docContractValidate`（dispatch/base.ts base 默认 hook）——本仓程序每步 dispatch 自身链被全量审计
- 测试面：engine 5b1 套件——`rules/__tests__/documents.test.ts`（mkdtemp 自造链，face ①–⑥ + row-shape + version ascending + split-phase 全函数级覆盖）· `doc-contract-channels.test.ts`（dispatch 级四表 BLOCK 断言）· `closeout.test.ts`（终态欠账 + 声明源→列双向）· `lifecycle-validation.test.ts`（lineage 触发 / 自审边界）

**42 行逐案对照表（本 design 产物，P3 执行面复核）**：`scripts/validate/__tests__/` 的 42 条 repo 断言逐一映射到 engine 对应用例（文件:行），判定「判据面已由 engine 测试覆盖 → 删」——证实删面零功能损失。对照表**✔ 已落盘（P3 T2）**——42 行映射见本 design §2.1 后 `### Appendix: 42-row cross-reference`（overall v1.14 规约；T2 落表、零迁入），AC1「42 行逐案对照表落盘本 design」复核由 T2 验收承接，非笼统「并入或删除」。

### Appendix: 42-row cross-reference（AC1 逐案论证物，P3 T2 落盘）

`scripts/validate/__tests__/` 的 42 条 repo 断言（27 overall-consistency + 15 plan-spec-anchors）逐条映射到 engine 对应用例（`文件:行`），判定「判据面已由 engine 测试覆盖 → 删」——证实删面零功能损失、零迁入。行号均已 `sed -n` 复验存在；映射以 engine 测试自造链语义为准（不要求 repo 断言与 engine 用例逐字对应）。engine 路径缩写：D = `packages/cdd-engine/src/rules/__tests__/documents.test.ts` · CC = `packages/cdd-engine/src/dispatch/__tests__/doc-contract-channels.test.ts` · CO = `packages/cdd-engine/src/rules/__tests__/closeout.test.ts` · LV = `packages/cdd-engine/src/dispatch/__tests__/lifecycle-validation.test.ts` · K = `packages/cdd-engine/src/rules/documents.ts`（判据唯一实现 kernel）· SCH = `packages/cdd-engine/src/documents/schema/overall.json`（canonical claimPatterns 单源）。

> **注（恢复读取时点）**：T1 实际拆两提交——`ca444529` 主退役（守卫 + 42 用例删除落点）+ `6281f77f` 收尾（T2 起始 HEAD 即此提交）。故 `git show HEAD^:` 报 path does not exist；本表恢复读取用 `git show 3c1a29c3:`（= HEAD^^，删除前紧邻提交）取两文件，映射内容与由 plan 初记的预期一致（文件已删，内容不变）。

**A. `scripts/validate/__tests__/overall-consistency.test.ts`（27 条）**

| # | repo 断言（`it` 标题） | engine 对应用例（`文件:行`） | 覆盖判定 |
|---|---|---|---|
| 1 | canonical 头 → canonical=true + phases 解析（id/design/plan 三列） | D:266（audit-clean 链：canonical 头 + P1/P2 phases 全解析零失败）+ D:490（非 canonical 头 failure 逆面）+ K:507-516（header/列解析） | 判据面已由 engine 测试覆盖 → 删 |
| 2 | 行形守卫：同文件 phase 行 cell 数不一致 → phaseShapeErrors + checker throw（shape-drift） | D:507（overall row-shape drift → failure）+ K:531（shapeDrift 收集、错位行跳过） | 判据面已由 engine 测试覆盖 → 删 |
| 3 | slug 由文件名剥离日期前缀 + -overall 后缀 | K:712 fileNameSlug（剥离日期前缀 + `-overall` 后缀，同语义）+ D:266（fixture `2026-09-21-plan-*.md` 日期前缀 slug 实测） | 判据面已由 engine 测试覆盖 → 删 |
| 4 | Version: vX.Y + 升序（v1.0→v1.1→v1.2）→ 通过 | D:266（AUDIT_OVERALL 三段升序零失败）+ K:593（ascending 规则） | 判据面已由 engine 测试覆盖 → 删 |
| 5 | 升序破坏（v1.1 后 v1.0）→ throw | D:530（change-history not ascending → failure）+ K:593-594 | 判据面已由 engine 测试覆盖 → 删 |
| 6 | 版本重复（两行 v1.1）→ throw（③ 重复检测） | K:591（duplicate version 收集）+ K:677（versionProblems 同 field 上抛）+ D:530（同一「Change history」field 钉死；fix = strictly ascending unique, K:683） | 判据面已由 engine 测试覆盖 → 删 |
| 7 | 表损坏 → loadOverallFile 返回 ok=false（§2.4 malformed skip，main 不 exit） | LV:150（overall invalid → blocked with guidance）+ LV:171（dry-run WARN lane：不 exit 1）+ K:500-516（unreadable / no header → kernelOk=false） | 判据面已由 engine 测试覆盖 → 删 |
| 8 | 非 canonical 头 → canonical=false（不 throw） | D:490 + LV:150（非 canonical 头 → 结构化 failure，非 crash） | 判据面已由 engine 测试覆盖 → 删 |
| 9 | graph 引用 P9（inventory 无）→ throw（④b） | D:361（face ③ graph 悬垂 P9 → failure）+ K:930（graph token 成员判定） | 判据面已由 engine 测试覆盖 → 删 |
| 10 | dependency 列传 P1 前驱 → 通过（④b） | D:369（④逆面：dependency cell 前驱 P9 → failure）+ D:266（`P1 ->(hard)` 前驱 ∈ ids 零失败）+ K:940-953 | 判据面已由 engine 测试覆盖 → 删 |
| 11 | issue ref 畸形（#246#issuecomment-abc）→ throw（④c） | K:879-888（`#issuecomment-` 后非数字 → malformed）+ D:480（`#12x` → issue field failure） | 判据面已由 engine 测试覆盖 → 删 |
| 12 | ④c 宽松：`#246（session master body）` + `none` 行放行 | K:878（`none` 跳过）+ K:890（bare `#NNN` 后缀非标识符 → 放行，`（session master body）` 属此后缀）+ D:266（none 行零失败） | 判据面已由 engine 测试覆盖 → 删 |
| 13 | issue ref Phase 列 ∈ phaseIds → 通过（④c） | K:866-875（issue row phase ∈ ids 判定）+ D:472（④逆面 P9 → failure）+ D:266（P1 ∈ ids 零失败） | 判据面已由 engine 测试覆盖 → 删 |
| 14 | ①正向：plan-claim 列 [Pending] → throw | D:271（face ① forward：claim Done vs 列 [Pending] → failure）+ K:797-804（plan-link claim 提取） | 判据面已由 engine 测试覆盖 → 删 |
| 15 | ①括号可选：`Implementation plan Pending → Done` 实为 claim → 列 Done 通过（无 claim 报错） | K:758（`(?:Pending\|\[Pending\])` 括号可选显式支持）+ D:271（claim→列比较机制）+ D:266（claim 形态零失败） | 判据面已由 engine 测试覆盖 → 删 |
| 16 | ①区间展开：P1–P4/P6 声明 → P1..P4+P6 全列 Done 断言 | K:768-785 phaseIdsIn（RANGE_RE 区间端点展开 P1–P4 → P1..P4）+ D:271/304（claim 解析机制） | 判据面已由 engine 测试覆盖 → 删 |
| 17 | ①单行混合（cdd v1.27 形态）：同一行 plan 区间 + design 声明 → 全断言 | K:795-815 extractClaimRows（单 summary 分句遍历 plan + design 双 link word）+ D:271/292（plan/design claim 面） | 判据面已由 engine 测试覆盖 → 删 |
| 18 | ①CLAIM_RE 尾随标点防御（warn fix 回归）：`Pending → Done。` / `→ Done——` 目标不含标点 | SCH `claimPatterns.claimClause.pattern`（target 停集含 `。`/`——` 等 CJK 标点）+ K:748-752 claimKey（尾随闭合括号剥离）+ D:304（claim 解析成功面） | 判据面已由 engine 测试覆盖 → 删 |
| 19 | ①design-claim 列 [Pending] → throw（指定 §2.5 item 8） | D:292（face ① design：claim 钉 token 列未带 → failure）+ K:806-813（design-link claim 提取） | 判据面已由 engine 测试覆盖 → 删 |
| 20 | ①反向：plan 列 Done 但全史无 plan-claim → throw | D:281（face ① reverse：plan 列 Done 无对应 claim → failure）+ K:787-804 | 判据面已由 engine 测试覆盖 → 删 |
| 21 | ②文档存在：slug glob 命中跨日期文档（overall 2026-09-05 → p2 2026-09-07）→ 通过 | D:354（②逆面：non-pending plan 列无 doc → failure）+ D:266（glob 命中跨日期文档零失败）+ K:960-963（plan 双形 glob） | 判据面已由 engine 测试覆盖 → 删 |
| 22 | ②design 跨引用忽略：P2 列含 `（源 P3-design）` 只断言 p2 design 文档 | K:735-740 ownDesignToken（`（源 P3-design）` 跨引用非 own token）+ D:266（own token 断言零失败）+ D:347（②逆面：own token 缺 doc → failure） | 判据面已由 engine 测试覆盖 → 删 |
| 23 | ④a：phase 文档锚点 #999#issuecomment-… 不在注册域 → throw | D:457（face ⑤：phase doc 锚点不在 Issue inventory → failure）+ K:902-926（anchor registry 扫描） | 判据面已由 engine 测试覆盖 → 删 |
| 24 | ②plan 双形：无后缀 plan 命中（既有 shipped 路径 span-mixed 回归）→ 通过 | K:962 plansHit（bare 形 glob）+ D:354/266（②面契约：plan doc 存在性） | 判据面已由 engine 测试覆盖 → 删 |
| 25 | ②plan 双形：`-plan.md` 变体命中（planvar p2 仅 -plan 形）→ 通过 | K:962 plansHit（`-plan` 变体形 glob）+ D:354（②面契约：plan doc 存在性） | 判据面已由 engine 测试覆盖 → 删 |
| 26 | ②plan 双形：两形并存（bare + -plan）→ duplicate（跨形并存重复检测） | K:981-988（hits>1 → cross-form duplicate failure）+ D:354/266（②面契约） | 判据面已由 engine 测试覆盖 → 删 |
| 27 | ④a anchorScanFiles 双形：scan 面含 -plan 变体 + bare 形，跨 slug 不串 | K:822-831 anchorScanFiles（`-${slug}-p\d+(?:-design\|-plan)?` 双形 + slug 隔离）+ D:457/467（anchor 扫描面） | 判据面已由 engine 测试覆盖 → 删 |

**B. `scripts/validate/__tests__/plan-spec-anchors.test.ts`（15 条）**

| # | repo 断言（`it` 标题） | engine 对应用例（`文件:行`） | 覆盖判定 |
|---|---|---|---|
| 28 | clean：repo-root 形 + 相对形 Spec 链接（label==basename）→ 零漂移 | D:115（valid chain 零失败）+ D:120（无 `**Spec:**` → failure 逆面）+ D:138（label≠basename → failure 逆面） | 判据面已由 engine 测试覆盖 → 删 |
| 29 | 目标文档不存在 → spec-unresolved | D:129（`**Spec:**` target 不 resolve → failure） | 判据面已由 engine 测试覆盖 → 删 |
| 30 | 目标存在但 label≠basename → spec-label | D:138（label drift → failure）+ K:346-352（label==basename 判定） | 判据面已由 engine 测试覆盖 → 删 |
| 31 | clean：../specs/ 相对形 + v1.1/v1.2 行迹 → 零漂移 | D:115（validSpec 相对形 parent + lineage v1.0 匹配零失败）+ D:561（pinned token ∈ lineage → 零失败）+ CO:122（overallPath 暴露 Class B lineage） | 判据面已由 engine 测试覆盖 → 删 |
| 32 | 目标文档不存在 → parent-unresolved | D:185（Parent program target unresolvable → chain truncation） | 判据面已由 engine 测试覆盖 → 删 |
| 33 | 目标存在但非 -overall.md → parent-notoverall | D:190（Parent program 非 `*-overall.md` → chain truncation）+ K:621（`-overall.md` 判定） | 判据面已由 engine 测试覆盖 → 删 |
| 34 | 行内 vX.Y ∉ 目标 overall 版本行迹（header ∪ Change history）→ parent-version | D:553（spec 钉 v9.9 → OVERALL face 失败，单一实现）+ K:686-701（merged version-lineage） | 判据面已由 engine 测试覆盖 → 删 |
| 35 | path-miss：死锚报 path-unresolved，存活兄弟（repo-root 形自链）不报 | D:129（引用不 resolve → failure 契约）+ K:103-111 isPlaceholderOrTemplateTarget（URL/占位/机制非锚）+ D:159（`{{> partial}}` 豁免——机制引用面） | 判据面已由 engine 测试覆盖 → 删 |
| 36 | clean → 不抛 | D:115（valid chain → 零失败，checkPlanSpecAnchors 聚合面等价） | 判据面已由 engine 测试覆盖 → 删 |
| 37 | drift → 抛 ANCHOR DRIFT（含 kind/file:line/target） | D:129/138（failure 带 artifact/file/field/missing/fix guidance）+ D:609（failure line 形状钉死） | 判据面已由 engine 测试覆盖 → 删 |
| 38 | isPlaceholderOrTemplateTarget — 模板/正则/方案/锚点/空格非锚 | D:159（`{{…}}` → failure；`{{> partial}}` → 豁免）+ K:103-111（同名谓词实现） | 判据面已由 engine 测试覆盖 → 删 |
| 39 | isPlaceholderOrTemplateTarget — 真实相对路径非占位 | D:115（repo-root + 相对形 link 解析成功）+ K:119-138（isFile / resolveFromBase / resolveAny） | 判据面已由 engine 测试覆盖 → 删 |
| 40 | isLegacyRef — 已删/迁面（_docs/ · pre-P2 docs/superpowers/ · controller-handoff.md）豁免 | K:822-831（审扫面仅 `-${slug}-p\d+` 阶段文档——pre-P2/`_docs/` 迁面路径不落审扫面，消费者环境无此存量）+ K:103-111（占位/机制非锚判定类）+ D:159（机制豁免用例） | 判据面已由 engine 测试覆盖 → 删 |
| 41 | makeBasenameIndex + isRescuedByBasename — 迁入 governed 面同名文档 rescues | K:346-352 resolveSpecFromPlan（label==basename 身份判定——basename 机制）+ D:138（label drift 逆面）+ D:115（成功面） | 判据面已由 engine 测试覆盖 → 删 |
| 42 | 既有 spec/plan 全量锚对实态零漂移（A/B/C 三类） | CC:140（clean four tables → gate 通过）+ D:266（audit-clean 零失败）+ §2.2 运行期 canary（P3 自身链全程 dispatch 审计 = 实态零漂移的续存形态） | 判据面已由 engine 测试覆盖 → 删 |

### 2.2 canary 回归运行期本位（canary-dogfood.test.ts 删除）

**病灶**：P2 T6④ 把「本仓 = canary 自证」从**一次性发布期实证**做成**常驻测试**（硬编码 `docs/osuperpowers/specs/2026-09-21-*.md` 三条真实路径 + 断言存在 + 断言过审计）。产物删除/改名/程序完结归档 → 测试验证一个不存在的产品 = 死断言。

**处置**：删除 `canary-dogfood.test.ts` 整文件。其逐条断言的功能面已由自造链测试承载：
- lineage 解析（plan→design→overall）→ `documents.test.ts` face ④ + `parentOverallOf` 用例
- 四表合法 → 审计零失败 → `documents.test.ts`「fully audit-clean overall」用例
- plan-header 解析语义（taskNumberRe / Form-A Constraints）→ `documents.test.ts` + `plan-constraints.test.ts`
- schema 声明的 header 字段（Spec/Parent 标记）→ `documents.test.ts` schema-derivation 用例

**canary 实证续存形态**：**程序运行期**——P3 自身的 plan/design/overall 文档链经 P3 全程（author → review → fix → backfill → branch-review）dispatch 被 engine 审计，零失败即为 canary 实证（P3 acceptance 字面）。**P3 不新增任何读本仓产物的测试**。

**fix 边界条款（2026-09-22 用户裁决，缺陷②修复）**：编排 skill 的 `fix-spec`/`fix-plan`/`fix-task`/`fix-branch` 节点补边界——「review 后编排者**只读 status / blocker 计数**（stdout result 面，§2.9）；**findings 全文由 `cdd fix` 的 fix-agent 消费**（`--findings <handoff>`）；编排者**不得**自行应用 findings as inline edits」——消除「编排者读了 findings 就自己改」的湿滑斜坡（本 P3 的 dogfood 实证：spec-review r1 后 inline 编辑本 spec，绕过 fix 通道）。落点 = `cli-driven-development` + `writing-*` 四件的 fix 节点 Do 措辞。

**验收线（grep 实证）**：`packages/cdd-engine/src/**/__tests__/**/*.ts` 中 `2026-09-21-consumer-parity`（本仓程序产物标识）引用 = 0（engine 测试面零本仓产物 fixture）。**排除口径**：`docs/osuperpowers` **布局字符串**不属产物引用——14 个 engine 测试文件（handoff-naming / progress-owner / cdd / lifecycle-validation / docs-runner / plan-constraints / doc-contract-channels / helpers / runner / root / infra.root / templates.cache / closeout-fixtures / documents）以 `docs/osuperpowers/specs/...` 相对路径在 mkdtemp 临时仓内**复刻消费者等效布局**，是合成 fixture 不是本仓产物——此面合法保留、不属删除面。

### 2.3 canonical phase-id 语法 A（2026-09-22 用户裁决）

**现状缺陷**（canonical overall.json 实测）：
```
phaseId     `^P\d+(?![0-9])[a-z]?$`   ← 只许单个字母后缀（P1a/P2b）
idFormat    `^P\d+(?![0-9])[a-z]?$`
designToken `^P\d+(?![0-9])[a-z]?-design$`
range       `^P\d+(?![0-9])[a-z]?\s*[-–—]\s*P\d+(?![0-9])[a-z]?$`
```
子变体 `P2.a` / `P2.b` / `P2.1` / `P2.2` / `P2-1` 全部不兼容（`.1` 漏出 token 外、range 解析断、依赖图成员误判）。拆子 phase 是普遍工程实践（用户举证「很多项目拆 Pxa/Pxb/Px.a/Px.b/Px.1/Px.2」）——语法不得卡死。

**目标语法（严格 A）**：
```
phaseId  `^P\d+(\.\d+)*$`
```
- 点分数字分层：`P1` · `P2.1` · `P2.2` · `P2.2.3`；任意层级
- **弃用字母后缀**（`P2a` 等不再合法——基于本仓存量全 bare：P1–P4 零字母后缀，无存量迁移）
- **排序/比较**：`(major, [segments…])` 自然序；`P2.1 < P2.2`、`P2 < P2.1` 由比较函数承载
- **范围**：`P1–P4` · `P2.1–P2.3` 端点包含
- 大小写：前缀 `P` 大写 + segment 数字（无字母段 → 无大小写面）

**schema 落点（C2 单源）**：`packages/cdd-engine/src/documents/schema/overall.json` **全部 phase-id 承载 pattern（实测 8 处）**单点迁移为语法 A：
1. `issueInventory.row.phaseId`（:109）
2. `phaseInventory.rowShape.idFormat`（:165）
3. `phaseInventory.rowShape.cells.dependency`（:201，`^P\d+…->…` 边 token）
4. `dependencyGraph.hardEdge`（:214）
5. `dependencyGraph.softEdge`（:219）
6. `claimPatterns.designToken`（:314）
7. `claimPatterns.phaseReference.single`（:323）
8. `claimPatterns.phaseReference.range`（:328，由 single 派生 `\s*[-–—]\s*` 连接）

→ `tokens.ts deriveDocTokens` 现推导链（phaseIdScanRe / phaseTokenScanRe / claimPhaseRefToken / designDocTail）同构承接，零硬编码第二处。**不留旧语法并存**——1–5 处（含 dependency cell / hardEdge / softEdge）若为死 pattern 则显式删除，若活则迁移；C2「新旧并存」违背禁止。

**schema description 写明（用户明确要求）**：
- phaseId: "Phase id — canonical form `P<digits>(.digits)*`（例：`P1` · `P2.1` · `P2.2.3`）。点分数字表示子 phase 层级（`P2.1` 是 `P2` 的一个子 phase）；层级语义 = 拆分/收敛操作的注册单位。字母后缀（`P2a`）与连字符（`P2-1`）不合法。排序按 (major, segments…) 自然序。"
- range/designToken/idFormat/dependency-cell/hardEdge/softEdge 同源补注（同一 phase-id 形式，语义随承载面：dependency cell = 边 token）。
- 新增依赖边新用例：dependency cell `P2.1 -> P2.2`（cells.dependency 迁移断言）· hardEdge `P2.1 -> P2.2` · softEdge `P2.1 -> (soft) P2.2`——「语法变更的初衷面」= 子 phase 依赖图。

**engine 消费面改造**：
- `documents.ts ownDesignToken`（现 `P1a-design` 特判）→ 改由 designToken pattern 派生、segment-join 语义（`P2.1-design` 归属 P2.1，非 P2）
- split-phase 测试改造：`documents.test.ts:304`（`P1a` claim 用例）· `:399`（`…-p1a.md` dispatch plan）→ 改 `P2.1` / `…-p2.1.md`
- `phaseIdFromPlan` basename-scan（`…-p<digits>`）→ segment 感知（`…-p2.1.md`）
- 文件名尾：`-p<digits>(.digits)*.md`（plan）· `-p<digits>(.digits)*-design.md`（design）——与 phaseId 同源小写化
- 本仓存量文档（overall P1–P4 · 各 phase spec/plan 头）——全 bare，零迁移

### 2.4 validate 接线净化（零接线 + steps 语义名）

**目标形状**：validate **无四表 block**（判据面唯一实现 = engine dispatch + 套件，repo 侧不落第二个触发点）——12 块 → 11 块。

**step 名语义化（零编号 anchor）**——现状 12 名含 6 类编号 anchor（`5b×`/`5c`/`6`/`7`/`8-10`/`12.`，源自 osuperpowers-overhaul 内部编号）全部退役，改语义名：

| 现名 | 语义名 |
|---|---|
| 0. unified emit freshness (emit-check) | `emit freshness (checked against regenerated products)` |
| 5b. osuperpowers plugin validation | `osuperpowers plugin resolution` |
| 5b. osuperpowers skills-count | `osuperpowers skills inventory count` |
| 5b. node:test behavior | `osuperpowers node:test behavior tree` |
| 5b. wiring guard: ci-validate.test.mjs | `validate wiring guard (ci-validate.test.mjs)` |
| 5b0. cdd-engine stub materialization (dev:stub) | `cdd-engine dev stub materialization` |
| 5b1. cdd-engine Vitest engine suite | `cdd-engine engine test suite (vitest)` |
| 5c. engine zero-residue + channel-audit grep | `engine zero residue + channel audit` |
| 6. marketplace validate | `marketplace manifests validate` |
| 7. scripts unit tests (vitest) | `scripts unit tests (vitest)` |
| 8-10. version sync | `package version sync` |
| ~~12. overall consistency~~ | **删除**（四表判据面归 engine） |

**钉死面同步**：
- `packages/osuperpowers/tests/ci-validate.test.mjs`：`assert.equal(steps.length, 12)` → 11；`"12. overall consistency step present"` 用例删除（改「无四表 block」断言或删）
- `scripts/validate/__tests__/pre-commit.test.ts`：`fullSteps toHaveLength(12)` → 11；组成表去 `12. overall consistency` 项
- `scripts/validate/index.ts` 顶部注释「12 块字面」+ 组合数组：去 `...overallConsistencySteps`
- `scripts/validate/pre-commit.ts`：去 `import overallConsistencySteps` + 组成项 + 注释
- `scripts/validate/overall-consistency.ts` / `plan-spec-anchors.ts`：整文件删除（含 exports）
- `engine.ts` / `osuperpowers.ts` / 其余 step 定义文件：仅改 `name` 字段，不动 run 逻辑

**block 数语义**：11 = emit / osuperpowers(4) / engine(2) / residue(1) / marketplace(1) / scripts-unit(1) / version-sync(1) = 11；ci-validate 钉死 11。

### 2.5 S3 残留簇 + F8a（守卫退役后的执法位表述改写）

**S3 活文档残留簇**（P1 design §2.2 登记 file:line；P3 删除后改写）：

| 位 | 现主张 | 改写后 |
|---|---|---|
| overall v1.14 自身四条（cross-cutting「本仓四表仍受 scripts 校验直至 P3」· issue 行 · phase 行 · maintenance 行） | 「直至 P3 退役该守卫」 | P3 落地 = 守卫已退役 → 改写为「本仓文档合规 = engine lifecycle 审计（dispatch 运行时 + engine 套件），无 repo 侧守卫」 |
| `docs/maintainers/osuperpowers-plugin.md:116-120` | 「charter-level guard is overall-consistency (maintainer-mode dogfood)」分类段 | 改写为 engine 执法位表述 + 历史时态（守卫已于 P3 退役） |
| `CLAUDE.md:47` | pre-commit 组成「…/ 12 overall consistency」 | 去 12 项 → 11 项语义名清单 |
| `packages/osuperpowers/skills/writing-overall-spec/SKILL.md:54` | 「A repo-local `scripts/validate` guard is maintainer-mode dogfood only, not a consumer surface — consumers have the engine lifecycle, not the repo toolchain」（现时态把 repo-local guard 述为现存物） | 改写为历史时态 + engine 位：「本仓文档合规判定与消费者同引擎路径——engine lifecycle audit + engine 套件（canary 实证运行期）；repo-local `scripts/validate` guard 已于 P3 退役」 |

**F8a（`\bH1\b` 守卫扫面盲区）**：盲区 = `ALL_MECH_POSITIONS` 不含 `scripts/`（residue.ts）——退役词写回 scripts/ 不漏扫。**处置（v1.14 裁）**：不扩 `ALL_MECH_POSITIONS`（扩面引入守卫自豁免复杂化）——P3 删除整体守卫文件（`overall-consistency.ts` / `plan-spec-anchors.ts`）后，`scripts/validate/` 面上的 charter 退役词 `H1` 随文件消失；残留扫面语义 = **「scripts/ 面不再持有 charter 退役词 H1 的使用（守卫自身 `\bH1\b` 定义与测试除外——`residue.ts` / `residue.test.ts` 是 H1 语汇守卫本体，不属于残留）」**。

### 2.6 consumer-sim（smoke-cdd 升级）

**形态**：`scripts/validate/smoke-cdd.ts` 重写为 consumer-sim——**消费者视角黑盒**。

**pack 前提（review r1–r3 实证，机制已修正）**：cdd-engine `files: ['dist/','templates/']`。**裸 `pnpm pack` 会在打包前重跑 `prepare: pnpm run dev:stub`**——tarball 内 `dist/cli.mjs` 重新变成 614B 的 jiti 桩（`createJiti` + 打包机绝对路径，仅本仓 `node_modules/.pnpm` store 可解析，非可独立运行产品），**工作树 dist/ 亦随 pack 被重桩**（副作用；`pnpm publish` 同理——发布路径同险）。**r1 修复采用的「先 build 后 pack」机制错误（本 design review-3 实证驳回）**：实测 build 产物 71.7 kB → 直接 pack 后 tarball 与工作树 dist 均重桩回 614B——build 不规避 prepare 钩子，AC6 白绿面仍不可达。**主修（P3）**：从 `packages/cdd-engine/package.json` **移除 `prepare: dev:stub` 钩子**——dev 桩改显式 `dev:stub` 调用（validate 5b0 `pnpm -C packages/cdd-engine dev:stub` 与 smoke-cdd 自给门**已显式调用**，与本仓文档化直接 dev 调用链一致；`pnpm install` 后不再自动桩化 dist，本地单跑 cli 黑盒测试需先显式 dev:stub——接线变化登记，P3 plan 落实）；`pnpm pack` / `pnpm publish`（changesets 发布流）**均不再触碰 dist**，发布品 = 显式 build 门的真实产物。**压实备选（若未来 reintroduce prepare）**：`pnpm pack --config.ignore-scripts=true`（实证有效：tarball 与工作树 dist 均保持 71.7 kB 真实产物）。**登记失效机制（防再采白绿）**：`pnpm pack --ignore-scripts` 旗标不受支持（Unknown option）· `npm_config_ignore_scripts=1` 环境变量无效 · `pnpm pack packages/cdd-engine`（相对路径）在 workspace root 被解析为 registry spec（`ERR_PNPM_PACKAGE_VERSION_NOT_FOUND`）——pack 须从包目录运行。**consumer-sim 必须先建真实产物再 pack**：
1. `pnpm --filter @oscaner-skills/cdd-engine build`（真实 unbuild 产物入 dist，实测 71.7 kB）→ 包目录 `cd packages/cdd-engine && pnpm pack --pack-destination <out>`（prepare 已移除；备防加 `--config.ignore-scripts=true`）→ tarball（含真实 `dist/cli.mjs` + `templates/` + `dist/documents/schema/`；**tarball 内容断言见 AC6**；隔离兜底：consumer-sim 亦可从临时克隆执行 pack，彻底隔离任何工作树残留）
2. mkdtemp 临时仓 `npm install <tarball>`（消费者布局，零仓内路径依赖）
3. 消费者 cwd 跑安装的引擎链：`node <installed>/dist/cli.mjs`（或 `node_modules/.bin/cdd`）+ `cdd help`（发现通道实证：CLI 绝对目录 = `<installed>/dist/cli.mjs`；schema 目录可寻址 = `<installed>/dist/documents/schema/`（canonical overall/plan/phase-spec/add-phase-protocol）+ `<installed>/templates/schema/`（handoff 契约 schema）——均 files 面产物、绝对路径可寻址）
4. 5-command dry-run 链（implement / review task / fix task / review branch / fix branch）——**fixture plan 由临时仓内生成**（`smoke-plan.md` 不在 tarball——`src/cli/__tests__/fixtures/` 不属 files 面；consumer-sim 从 tarball 内置 schema/templates 派生一份合法 plan 写入临时仓，或把 smoke-plan 移入 `templates/`（files 含之）后由安装面读取——二选一在 P3 plan 定，本 design 明示两选项）
5. 断言每命令 return-block 契约（status/commits/artifacts/blocker/counters）
6. 输出消费者等效结果——**不依赖 repo 布局、零仓内路径依赖**（不读 `docs/osuperpowers/`、不引用本仓 node_modules）；删「不依赖 `dist/` 预生成」旧表述：`dist/` = consumer-sim 第一步显式 build 门生成的**发布品**（机制本身，非前提假设）——「**先 build 后 pack，tarball = 发布品**」

**入口**（run.ts `smoke-cdd` 子命令保留同名，语义 = consumer-sim；不新增子命令——Non-goal#1 尊重，`smoke-cdd` 是既有 repo 运维子命令非 cdd CLI 面）。

**挂点**（Q6 v1.14 裁）：
- **release 门**：`.github/workflows/release.yml` `release` job 内、`changesets/action` 之前插 `node scripts/run.ts smoke-cdd`——发布动作前黑盒跑消费者链
- **PR 门**：`pr-validate.yml` 现有 `node scripts/run.ts smoke-cdd` step 保留（快反馈）

**验收**：consumer-sim 在发布门可跑并输出消费者等效结果（pack → install → 消费者链全绿）；`npm pack` 内容 = 发布品即校验品。

### 2.7 运维规范落档（docs/maintainers）

运维规范落档（**八项**——grilling 六项裁决 + v1.15 cdd 输出零过滤 + v1.16 docs-family 命令出口统一；新 section 或 program-experience 条目扩展；**sequencing：第 8 项在 §2.9 落地后写入**——结果面与出口实现在场才可落档，与 overall 落档八项口径一致）：

1. **零产物 fixture**——unit/e2e = 功能性验证，不允许以本仓产物路径为测试 fixture（canary-dogfood 病灶）；canary 实证归运行期 dispatch
2. **零编号 anchor**——validate step 名 = 语义名，退役 `5b0/5b1/12.` 族（overhaul 内部编号不利运维）
3. **零 legacy 豁免死代码**——C3 命中即删（plan-spec-anchors Class C + isLegacyRef 豁免 = 本仓专属面，消费者零意义）
4. **phase-id 语法 A**——`P<digits>(.digits)*` 点分分层、弃字母/连字符，《拆子 phase 的命名纪律》
5. **唯一执法面**——四表判据 = engine lifecycle，repo 侧零第二触发点（结合 C1/C3）
6. **steps 语义名 + block 数 = 11** 的 validate 结构快照
7. **cdd 输出零过滤**——任何调用 cdd CLI 的 skill 禁止 `tail` / exit-code 包装 / `2>&1 |` 等过滤；cdd 已对输出做信息长度优化（2026-09-22 用户裁决，见 §2.8）
8. **docs-family 命令出口统一（结果可见性 · exit.ts 出口单源）**——docs-family review 完成后 stdout 含 result 面（`status:`/`blocker:`/`handoff:` 行，编排者可直读、不翻 handoff 文件）；命令级出口统一走 `exit.ts` 族（成功路径禁裸 `return;`）——2026-09-22 用户裁决（v1.16 补充，§2.9）；落档指令与 §2.9 同源、sequenced 于 §2.9 之后

落点：`docs/maintainers/program-experience.md`（新条目 + `docs/maintainers/skill-authoring.md` 若涉 skill 面）——英文主源（Strategy B extension）。

### 2.8 skills 调用 cdd 输出零过滤（2026-09-22 用户裁决，P3 补充需求）

**裁决**：cdd CLI 已对命令输出做信息长度优化——任何 skill 在调用 cdd 时，**禁止 `| tail` / `| head` / `2>&1 |` / `; echo "EXIT=$?"` 等过滤包装**；编排者直读完整 stdout/stderr，cdd 自身裁剪。

**改动面**：全部编排 skill（`cli-driven-development` / `writing-*` 四件 / `brainstorming` / `finishing` / `report-issues`）中凡含 cdd 调用指引的节点：
- 删「capture last block」「tail the output」类表述（若存）
- 增「direct invocation — read the full output; cdd truncates its own output」指引（若缺）
- grep 实证：`packages/osuperpowers/skills/*/SKILL.md` 中 `\b(cdd|cdd-engine).*(tail|head|EXIT=)` 零命中

**scope 限定**：本需求针对 **skill 指引面**（SKILL.md 散文 + 节点 Do 措辞）；repo 侧 `scripts/`（run.ts/smoke-cdd）自身调用不受此规约约束（脚本内部 pipe 是程序逻辑，非指引）；不新增 CLI。rules 面（engine 黑盒）不涉。

**验收**：grep 零命中（见上）；`pnpm run validate` 全绿；emit 产物重生成（SKILL.md 是 emit 源）零 drift。

### 2.9 docs-family 命令出口统一：结果可见性 + exit.ts 出口（2026-09-22 用户裁决，P3 补充）

**背景（P3 spec-review r1 实证）**：docs-family `cdd review --type spec|plan` 完成后 **stdout 零结果面**（`review.ts:170` 裸 `return;`，`cdd.test.ts:121` 只断 exit 0 不断 stdout）——编排者必须翻 `.osuperpowers/cdd/*/spec-review-1.json` 才知道 status/findings，与 task-family 的 return-block stdout 契约（`cdd.test.ts:127` 断言 `status: APPROVED`）不对称。本次偏离根因之一：**编排者看不到 review 结果 → 被迫读 handoff 文件 → 读到 findings 后「自己改」的湿滑斜坡**。

**裁决 ① 结果可见性**：docs-family review 完成后，CLI 层打印一行 result 面到 stdout——`status: <s> · blocker: <n> · handoff: <path>`（与 task 通道对齐；findings 详情仍留 handoff 由 `cdd fix --findings` 消费，编排者不读全文）。`cdd.test.ts` docs-family 断言面同步（stdout 断 status/blocker/handoff 行）。

**裁决 ② 全出口走 exit.ts**：**命令级出口禁止裸 `return;`**（engine 所有 `run*` 函数——runReview/runFix——的成功路径必须经 `exit.ts` 统一出口族）；dispatch 层函数控制流 return 保持（非命令出口）。dval 修改：
- `review.ts:170`（docs review 完成裸 return）+ `fix.ts:48`（task fix 完成裸 return）→ 改调统一出口（打印结果面 + `exitOk()`/`exitWithCode(0)`）
- 全仓 grep 实证：`cli/*.ts` 层 `^\s*return;$` 零命中（命令级）

**裁决 ③ exit.ts 统一抽象**：`exit.ts` 现有 `exitOk/exitBlocked/exitCliMissing/exitWithCode/cliUsageError` 一族成功/失败出口——评估补一个 `exitOkWith(resultLine: string)`（成功 + stdout 结果面一次调用，屏弃「先 stdout.write 后 exit」的分散写法）或让结果面由统一出口承载；命名/形态在 P3 plan 定，原则 = **所有命令出口单一来源 exit.ts，exit code 表 0/1/2/3 不变**。

**与 §2.8 关系**：同族——「编排者可读到的结果面」是「cdd 输出自身优化」的另一半；§2.8 管 skills 不 filter，§2.9 管 engine 保证结果真在 stdout。

**验收**：docs-family review/fix 完成后 stdout 含 result 面（`status:` 行可 grep）；`cli/*.ts` 命令级裸 return 零命中（`grep -rn "^\s*return;$" packages/cdd-engine/src/cli/*.ts` = 0）；`exit.ts` 统一出口族为 cli 层唯一出口调用面（grep 实证）；exit table 0/1/2/3 不变；engine vitest 全绿（含 cdd.test docs-family stdout 断言面更新）。

### 2.10 mid-flight backfill 协议（2026-09-22 用户裁决，P3 补充需求）

**触发**：dispatch 进行中（implement/review/fix 任意一栈），用户侧产生相关讨论需回填 overall/spec/plan 文档。本 P3 运行期实证（用户其他项目遇到）：CDD 派发后专题讨论需回填，无指导时直接回填 → 树脏 → 下一 review 入口门 BLOCKED——「不做则卡关」与「做了堵关」两难。

**裁决（协议，两案比较后 hot-context 胜出）**：
1. **回填窗口 = 当前 dispatch 返回即刻**（热上下文，不延迟到全循环 implement→review→fix 闭合）——延迟闭环会丢决策热上下文、回填易遗忘；「等环闭合再回填」为落选案（用户实测裁决记录）。
2. **硬条件：回填随独立 commit 落地**——review 入口门只读「树干净」，不看 range；回填 commit 后树净，下一 dispatch（如 review）放行。**未 commit 的回填 = 脏树 → 下一 review 入口门 BLOCKED**。
3. **ref 语义（无阻）**：回填 commit 落在 task-review range（BASE..HEAD）内 → 该任务 review 审回填 commit（changed-surface booking——CDD_WARN visible not block，scope axis 决，P3 实测 T3 fix 的 off-ledger booking）。回填改写当前任务自身 plan/spec 文案 → 仍走 Pending Acceptance（§2.2 fix 边界 · I6）或让 review 直审新文案，不 inline 应用。
4. **内容面边界**：回填 = 用户-编排者文档同步（sole-writer 语义）；engine findings 仍走 `cdd fix --findings` 信道，回填不替代 findings 应用。

**落点（消费者面五个 SKILL.md × emit）**——`cli-driven-development` + `writing-*` 四件（overall-spec / phase-spec / single-spec / plans）Invariants 表各增一条（编号按各表现状续排：cdd = I7 · overall = I3 · phase = I4 · single = I3 · plans = I4）：
```
**Mid-Flight Backfill** — a user-raised backfill of overall/spec/plan docs surfaced while a dispatch is in flight lands immediately when the current `cdd` call returns (hot context; no deferral to cycle close — deferral risks losing the decision), committed as its own change; the tree must be clean (backfill committed) before the next dispatch: an uncommitted backfill trips the next review's entry gate (dirty → BLOCKED). A backfill rewriting the current task's own plan/spec text routes per Pending Acceptance (sole-writer); otherwise it rides the moving ref and the next review audits it in-band (changed-surface booking, not a block).
```
+ `cli-driven-development` Engine Semantics 增一条：**Entry gate reads the tree, not the committed range** — the review entry gate checks working-tree cleanliness only (dirty → BLOCKED; dry-run → WARN). It does not assert that HEAD holds exactly the task's canonical commits, so a committed mid-flight backfill clears the gate. The subsequent review audits the widened range — off-ledger changes surface as a changed-surface CDD_WARN booking and the scope axis decides; visible, not a block.

**scope 限定**：五件 = cdd + writing-* 四件（用户裁决 B）；`brainstorming` / `finishing` / `report-issues` 不落（非 cdd dispatch 编排面）；repo 侧 `scripts/` 不受此规约（程序逻辑非指引）。

**验收**：五件 SKILL.md Invariants 表各含「Mid-Flight Backfill」（`grep -L "Mid-Flight Backfill" packages/osuperpowers/skills/{cli-driven-development,writing-overall-spec,writing-phase-spec,writing-single-spec,writing-plans}/SKILL.md` = 空）+ cdd 件含「Entry gate reads the tree」；`pnpm run emit` + `emit:check` 零 drift；`pnpm run validate` 全绿。

### Acceptance criteria

- AC1 **守卫退役零残留**：`scripts/validate/overall-consistency.ts` / `plan-spec-anchors.ts` / `__tests__/{overall-consistency,plan-spec-anchors}.test.ts` 删除；`grep -rE "overall-consistency|plan-spec-anchors" scripts/` 零命中（`-E` 交替，非 BRE 字面 `|`）；42 行逐案对照表由 P3 plan T2 落盘本 design（每条 repo 断言 → engine 对应用例:行 → 覆盖判定，证实零功能损失——本版未落表，T2 落表后收口复核）
- AC2 **engine 套件零产物 fixture**：`canary-dogfood.test.ts` 删除；`grep -r "2026-09-21-consumer-parity" packages/cdd-engine/src/**/__tests__/` 零命中（engine 测试面零本仓程序产物引用）；**`docs/osuperpowers` 布局字符串排除**——14 文件在 mkdtemp 临时仓复刻消费者等效布局属合法 fixture，不属产物引用（§2.2 排除口径）；canary 实证 = P3 文档链（P3 plan → p3 design → overall）经 P3 全程 dispatch 审计零失败（运行期实证，测试面自造链承载）
- AC3 **phase-id 语法 A 落地**：canonical overall.json **全部 8 处 phase-id 承载 pattern** 单点迁移 `^P\d+(\.\d+)*$`（issueInventory.row.phaseId · rowShape.idFormat · cells.dependency · hardEdge · softEdge · claimPatterns.designToken · phaseReference.single · range=single 派生 `\s*[-–—]\s*` 连接）+ description 全写 · engine 消费面（ownDesignToken / phaseIdFromPlan / designDocTail / split-phase 测试 `P1a`→`P2.1` 改造）零误伤 · 本仓存量文档零迁移 · engine 套件含语法新用例（P2.1 claim / P2.1-design / P2.1–P2.3 range / `…-p2.1.md` glob / **dependency cell `P2.1 -> P2.2` · hardEdge · softEdge**）
- AC4 **validate 净化**：12 → 11 块 · step 名全语义名零编号 anchor（**探针改前缀锚定/整串判定**：`(?:^| )\b(?:[0-9]+\.|5b\d*|5c|8-10)[. ]+[A-Za-z(]` 在 step name 面零残留——数字前缀步名全捕获、语义名零误报；node 断言「现名全命中 / 语义名全 miss」防白绿（`0. unified emit freshness (emit-check)`/`6. marketplace validate`/`7. scripts unit tests`/`12. overall consistency`/`5b`/`5c`/`8-10` 族 HIT，`emit freshness (checked against regenerated products)` 等语义名 miss——旧式 `[0-9]+[. ]`+尾 `\b` 失效：尾 `\b` 在「.」→「 」non-word→non-word 边界断、吞点后备选项失配即漏检）；或对每个 step 名整串 match 语义名正则——二选一，杜绝白绿）· ci-validate.test.mjs / pre-commit.test.ts 钉死值 11 同步 · index.ts / pre-commit.ts import 面清洁 · `pnpm run validate` 全绿
- AC5 **S3 残留改写**：overall 四条 + osuperpowers-plugin.md:116-120 + CLAUDE.md:47 + overall-spec SKILL:54 改写为 engine 执法位/历史时态表述；`grep "scripts/validate.*guard\|block 12.*consisten"` shipped docs/skills 面零现行主张（历史时态句允许）
- AC6 **consumer-sim**：`prepare: dev:stub` 钩子已移除（`pnpm publish` 不再重桩 dist——发布品 = 显式 build 产物）；先 `pnpm --filter @oscaner-skills/cdd-engine build`（真实 unbuild 产物，`dist/cli.mjs` 实测 71.7 kB）→ 包目录 `pnpm pack --pack-destination <out>`（备防 `--config.ignore-scripts=true`；实证失效不收：`--ignore-scripts` 旗标 / `npm_config_ignore_scripts` env / workspace root 相对路径 pack）→ **tarball 内容断言（防白绿）**：`dist/cli.mjs` grep stub 标识（`createJiti` / `node_modules/.pnpm`）零命中 **且** 字节数 > 10 kB（实测：桩 614 B、真实产物 71.7 kB——禁用「>100 kB」阈值，会误判真实产物）→ mkdtemp 临时仓安装（消费者布局，零仓内路径依赖；不读 `docs/osuperpowers/`、不引用本仓 node_modules——`dist/` = 显式 build 门生成的发布品机制，非前提假设）→ 安装链入口 `node <installed>/dist/cli.mjs`（或 `node_modules/.bin/cdd`）+ schema 目录落点（`<installed>/dist/documents/schema/` + `<installed>/templates/schema/`）可寻址实证 → 消费者链（`cdd help` + 5-command dry-run）在发布门与 PR 门可跑、输出消费者等效结果；fixture plan 二选一（临时仓派生 / `templates/` 内置由安装面读取）落 P3 plan 并实证；run.ts `smoke-cdd` 子命令语义 = consumer-sim
- AC7 **运维规范落档**：Program experience（或同族 maintainer 档）新增**八项**裁决条目（零产物 fixture · 零编号 anchor · 零 legacy 豁免 · phase-id 语法 A · 唯一执法面 · validate 11 块结构 · cdd 输出零过滤 · **docs-family 结果可见性 + 命令出口 exit.ts 单源（sequenced 于 §2.9 之后）**），英文主源、可 grep Verify
- AC8 **cdd 输出零过滤 + mid-flight backfill 落点（§2.8/§2.10）**：`grep -rE "cdd[^\"']{0,40}(tail|head|EXIT=|2>&1[[:space:]]*\|)" packages/osuperpowers/skills/*/SKILL.md` 零命中；SKILL.md 中 cdd 调用节点含「direct invocation — read full output；cdd 自身优化输出长度」表述（或确认既有表述已符合）；五件 SKILL.md（cdd + writing-* 四件）Invariants 表各含「Mid-Flight Backfill」条目 + cdd 件 Engine Semantics 含「Entry gate reads the tree, not the committed range」；`pnpm run emit` 后零 drift
- AC9 **docs-family 出口统一（§2.9）**：docs-family review/fix 完成后 stdout 含 result 面（`status:` 行；`cdd.test.ts` docs-family 断言面同步更新为断 stdout status/blocker/handoff）；`grep -rn "^\s*return;$" packages/cdd-engine/src/cli/*.ts` = 0（命令级裸 return 零命中）；`cli/*.ts` 出口统一走 `exit.ts` 族（`exitOkWith`/`exitWithCode`/`exitOk` 等，grep 实证 cli 层出口调用面 = exit.ts 单源）；exit table 0/1/2/3 不变；engine vitest 全绿
- AC10 **全链收口**：`pnpm run validate` 全绿（11 块，干净已提交树）· `emit:check` 零 drift · precommit 11 块绿灯 · engine vitest 全绿 · AC1–AC9 逐条可复核

## Section 3: Deviations from overall

| Overall assumption（v1.13） | Phase decision | Overall updated? |
|---|---|---|
| P3 scope「42 用例并入 engine 套件或删除」 | **全删零迁入**——判据面 engine 自造链测试已覆盖（P2 建），42 条 repo 断言逐案对照后证实零功能损失；「并入」= 搬瓜皮，双写 | Yes — v1.14（2026-09-22 grilling 合流） |
| P3 scope「本仓 own 程序四表合规 = 跑 engine lifecycle 审计同路径（validate 中可见）」 | **零接线**——不建 validate 四表 block；判据面唯一实现 = engine（dispatch 运行时 + 套件）；canary 回归运行期形态；validate「可见」改由「engine 套件即 validate 5b1 + 程序运行期实证」满足 | Yes — v1.14 |
| P3 scope「smoke-cdd 升级 consumer-sim 挂 release 门」 | 保留原裁（Q6）：release 门 + PR 门双挂；入口 = run.ts `smoke-cdd` 语义化 | 保持（v1.14 无变化） |
| null（新需求） | 2026-09-22 用户裁决新增：canonical phase-id 语法严格 A · steps 语义名零编号 anchor · 零产物 fixture · 运维规范落档 | Yes — v1.14 新增 |
| null（P3 补充需求，2026-09-22） | **skills 调用 cdd 输出零过滤**——禁止 `tail`/`head`/`2>&1 \|`/`EXIT=$?` 包装，cdd 已自身优化输出长度（§2.8）；P3 scope cell 同步列入 | Yes — v1.15 回填（P3 补充） |
| null（P3 补充需求，2026-09-22） | **docs-family 命令出口统一**——docs review 完成后 stdout result 面（`status:`/`blocker:`/`handoff:` 行，编排者可直读、不翻 handoff）；`cli/*.ts` 命令级出口统一走 `exit.ts` 族、禁裸 `return;`、exit table 0/1/2/3 不变（§2.9）+ **fix 边界条款**——review 后编排者只读 status/blocker 计数、findings 全文由 `cdd fix` fix-agent 消费、不得 inline 应用 findings（§2.2，defect②修复）；P3 scope cell 同步列入 | Yes — v1.16 回填（P3 补充） |
| null（P3 补充需求，2026-09-22） | **mid-flight backfill 协议**——当前 `cdd` dispatch 返回即刻回填（热上下文，不延迟到循环闭合）+ 回填随独立 commit 落地（else 下一 review 入口门 BLOCKED）+ 消费者面五个 SKILL.md（cdd + writing-* 四件）各增「Mid-Flight Backfill」条目 + cdd Engine Semantics 增「entry gate reads the tree, not the range」语义（§2.10）；P3 scope cell 同步列入 | Yes — v1.18 回填（P3 补充） |
| 依赖图 `P2 -> P3 -> P4` | 不变（P2 shipped → P3 可启；P4 依赖 consumer-sim 实测） | 保持 |

> `Overall updated?` 全为 Yes（v1.14 grilling 合流 + v1.15/v1.16 spec-review r1 回填；overall v1.17 探针修正 = **spec-review-4/fix-4**——AC4 探针改 `[A-Za-z(]` 正向后缀 + node 断言，change-history v1.17 条目头已标「spec-review-4 修正探针」）——无未登记偏差。
>
> **探针转义告警（防父面白绿）**：parent overall v1.17 的 P3 acceptance cell 与 change-history v1.17 条目中探针以 markdown 表格转义写入（`(?:^\| )\b(?:[0-9]+\.\|5b\d*\|5c\|8-10)[. ]+[A-Za-z(]`）——`\|` 形态无交替运算符，node 实测对纯步名与 `| 12. overall consistency |` 表行形式均零命中，照字面复制为验证 grep 即白绿；验证 grep 须先把 `\|` 还原为 `|`（还原后 = 本 design AC4 已被实证探针：现名全命中 / 语义名全 miss），或与 overall 同步换无 `|` 形态（整体修订时）。

## Section 4: Notes for downstream

- **P4（发布闭环）**：输入 = .changeset ×2（本程序 cdd-engine major + osuperpowers）版本化 + 旧程序 osuperpowers-overhaul ×9 changesets 版本化 + cdd-engine major breaking 发布面（P2 全部变更）+ **consumer-sim release 门实测通过**（P3 AC6 产物）+ pack 内容审计（cdd-engine `npm pack` 内容 = `dist/` + `templates/`（+ package.json；README/LICENSE 有则随包——files 面外 npm 自动携带面），**无 `skills/`**——`skills/` 属 osuperpowers 插件包面，若审计须单独列其包名；tarball 实际断言 = 真实 `dist/cli.mjs` + `templates/` + `dist/documents/schema/`，见 AC6；不含仓内 tests/、scripts/ 治理残件）。
- 本 phase 无「later phases 会处理」悬空项——所有跨 phase 移交均落上游 overall v1.17 或本 §4 指针。

## Section 5: Review

- **Baseline = committed tree**：进入 review 前工作树干净（entry gate）；review 读 dispatch 入口时的 committed tree。
- **Convergence**：blocker > 0 → fix 全部 findings → 重审；blocker = 0 → fix 全部（warn/nit 含）→ 停，不再审（Review Convergence，CLAUDE.md）。
- 本 spec 经 `cdd review --type spec --spec docs/osuperpowers/specs/2026-09-21-consumer-parity-p3-design.md` 单轮收敛。
