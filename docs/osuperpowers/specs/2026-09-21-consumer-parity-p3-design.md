# 消费者面一致性（Consumer Parity）— P3 Design Spec

- **Version**: v1.0 · 2026-09-22
- **Status**: Draft
- **Author**: [human] · Claude Opus 5 (1M context)
- **Parent program**: [2026-09-21-consumer-parity-overall.md](./2026-09-21-consumer-parity-overall.md) · v1.15
- **Depends on**: P2（shipped，PR #272 `39ed65a8`）；P2 design v1.4 Approved；grilling 合流（2026-09-22，v1.14 回填）

---

## Section 0: Incremental warning

> P3 增量仅限本 phase。跨 phase 约定见 [overall v1.15](./2026-09-21-consumer-parity-overall.md)；overall 冲突时 overall 胜。

本 spec 只做 **P3（本仓校验面重建）** 的设计增量：repo 侧四表守卫退役（S1/S2 + 42 用例 + `canary-dogfood.test.ts`）· validate 接线净化（steps 语义名、无四表 block、12→11 块）· canonical phase-id 语法 A · S3 残留簇改写 · F8a 盲区自消 · consumer-sim 升级挂 release 门 · 运维规范落档。engine 判据面（P2 产物）与发布动作（P4）不属于本 phase，仅以「已就绪输入 / 下流交接物」形式出现。

## Section 1: Constraints pointer

> 不重复 overall 约定；overall 冲突时 overall 胜。

引下列 overall v1.15 条目，不重述正文：
- **判据定式**（C1 可达性 / C2 结构性 / C3 退化——useless 必删、无历史叙述豁免）：overall v1.8 Cross-cutting「判据定式」段
- **Non-goals**：不新增 cdd CLI 子命令（唯一例外 `cdd help` 已于 P2 落地）· 不改 emit/marketplace/changeset 内部流水 · 不把本仓 GitHub issue 注册语义强加消费者 · 不改 README/CLAUDE.md harness 宣称类
- **约束**：允许 breaking · 唯一执法面 = engine lifecycle（本仓无 scripts 侧兜底）· spec/plan 结构定义同源派生（canonical schema 单源）· engine 零文档写入 · 本仓=canary（运行期形态）
- **语言**：Strategy B（spec/plan 中文）
- **2026-09-22 用户裁决（binding，v1.14/v1.15 回填）**：unit/e2e 测试 = 功能性验证，**零本仓产物为 fixture**（产物删即测试废 = 耦合病）· **零编号 anchor**（`5b0/5b1/5b/12.` 族退役，steps 语义名，不利运维）· **canonical phase-id 语法严格 A**（`^P\d+(\.\d+)*$` 点分分层，弃字母后缀）· **零 legacy 豁免死代码**（C3 直接命中）· 运维规范落档 docs/maintainers · **skills 调用 cdd 输出零过滤**（禁 `tail`/`head`/`2>&1 \|`/`EXIT=$?`——cdd 已自身优化输出长度，v1.15 补充）

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

**42 行逐案对照表（本 design 产物，P3 执行面复核）**：`scripts/validate/__tests__/` 的 42 条 repo 断言逐一映射到 engine 对应用例（文件:行），判定「判据面已由 engine 测试覆盖 → 删」——证实删面零功能损失。对照表**落盘本 design**（§2.1 后附表，overall v1.14 规约），P3 plan T2 只执行/复核，非笼统「并入或删除」。

### 2.2 canary 回归运行期本位（canary-dogfood.test.ts 删除）

**病灶**：P2 T6④ 把「本仓 = canary 自证」从**一次性发布期实证**做成**常驻测试**（硬编码 `docs/osuperpowers/specs/2026-09-21-*.md` 三条真实路径 + 断言存在 + 断言过审计）。产物删除/改名/程序完结归档 → 测试验证一个不存在的产品 = 死断言。

**处置**：删除 `canary-dogfood.test.ts` 整文件。其逐条断言的功能面已由自造链测试承载：
- lineage 解析（plan→design→overall）→ `documents.test.ts` face ④ + `parentOverallOf` 用例
- 四表合法 → 审计零失败 → `documents.test.ts`「fully audit-clean overall」用例
- plan-header 解析语义（taskNumberRe / Form-A Constraints）→ `documents.test.ts` + `plan-constraints.test.ts`
- schema 声明的 header 字段（Spec/Parent 标记）→ `documents.test.ts` schema-derivation 用例

**canary 实证续存形态**：**程序运行期**——P3 自身的 plan/design/overall 文档链经 P3 全程（author → review → fix → backfill → branch-review）dispatch 被 engine 审计，零失败即为 canary 实证（P3 acceptance 字面）。**P3 不新增任何读本仓产物的测试**。

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

**形态**：`scripts/validate/smoke-cdd.ts` 重写为 consumer-sim——**消费者视角黑盒**。**pack 前提（review r1 实证）**：cdd-engine `files: ['dist/','templates/']` 且 `prepare: pnpm run dev:stub`——裸 `pnpm pack` 的 tarball 仅 7 文件（`dist/cli.mjs` 是 614B 的 jiti 桩，指向打包机绝对路径，非可独立运行产品；`smoke-plan.md` 不在 files 面）。**consumer-sim 必须先建真实产物再 pack**：
1. `pnpm --filter @oscaner-skills/cdd-engine build`（真实 unbuild 产物入 dist）→ `pnpm pack packages/cdd-engine` → tarball（含真实 `dist/cli.mjs` + `templates/`）
2. mkdtemp 临时仓 `npm install <tarball>`（消费者布局，零仓内路径依赖）
3. 消费者 cwd 跑安装的引擎链：`node <installed>/cli.mjs` + `cdd help`（发现通道实证：CLI 绝对目录 + schema 目录可寻址）
4. 5-command dry-run 链（implement / review task / fix task / review branch / fix branch）——**fixture plan 由临时仓内生成**（`smoke-plan.md` 不在 tarball——`src/cli/__tests__/fixtures/` 不属 files 面；consumer-sim 从 tarball 内置 schema/templates 派生一份合法 plan 写入临时仓，或把 smoke-plan 移入 `templates/`（files 含之）后由安装面读取——二选一在 P3 plan 定，本 design 明示两选项）
5. 断言每命令 return-block 契约（status/commits/artifacts/blocker/counters）
6. 输出消费者等效结果（不依赖 repo 布局、不依赖 `dist/` 预生成——pack 即发布品的语义改为「**先 build 后 pack，tarball = 发布品**」）

**入口**（run.ts `smoke-cdd` 子命令保留同名，语义 = consumer-sim；不新增子命令——Non-goal#1 尊重，`smoke-cdd` 是既有 repo 运维子命令非 cdd CLI 面）。

**挂点**（Q6 v1.14 裁）：
- **release 门**：`.github/workflows/release.yml` `release` job 内、`changesets/action` 之前插 `node scripts/run.ts smoke-cdd`——发布动作前黑盒跑消费者链
- **PR 门**：`pr-validate.yml` 现有 `node scripts/run.ts smoke-cdd` step 保留（快反馈）

**验收**：consumer-sim 在发布门可跑并输出消费者等效结果（pack → install → 消费者链全绿）；`npm pack` 内容 = 发布品即校验品。

### 2.7 运维规范落档（docs/maintainers）

grilling 六项裁决同步进运维文档（新 section 或 program-experience 条目扩展）：

1. **零产物 fixture**——unit/e2e = 功能性验证，不允许以本仓产物路径为测试 fixture（canary-dogfood 病灶）；canary 实证归运行期 dispatch
2. **零编号 anchor**——validate step 名 = 语义名，退役 `5b0/5b1/12.` 族（overhaul 内部编号不利运维）
3. **零 legacy 豁免死代码**——C3 命中即删（plan-spec-anchors Class C + isLegacyRef 豁免 = 本仓专属面，消费者零意义）
4. **phase-id 语法 A**——`P<digits>(.digits)*` 点分分层、弃字母/连字符，《拆子 phase 的命名纪律》
5. **唯一执法面**——四表判据 = engine lifecycle，repo 侧零第二触发点（结合 C1/C3）
6. **steps 语义名 + block 数 = 11** 的 validate 结构快照
7. **cdd 输出零过滤**——任何调用 cdd CLI 的 skill 禁止 `tail` / exit-code 包装 / `2>&1 |` 等过滤；cdd 已对输出做信息长度优化（2026-09-22 用户裁决，见 §2.8）

落点：`docs/maintainers/program-experience.md`（新条目 + `docs/maintainers/skill-authoring.md` 若涉 skill 面）——英文主源（Strategy B extension）。

### 2.8 skills 调用 cdd 输出零过滤（2026-09-22 用户裁决，P3 补充需求）

**裁决**：cdd CLI 已对命令输出做信息长度优化——任何 skill 在调用 cdd 时，**禁止 `| tail` / `| head` / `2>&1 |` / `; echo "EXIT=$?"` 等过滤包装**；编排者直读完整 stdout/stderr，cdd 自身裁剪。

**改动面**：全部编排 skill（`cli-driven-development` / `writing-*` 四件 / `brainstorming` / `finishing` / `report-issues`）中凡含 cdd 调用指引的节点：
- 删「capture last block」「tail the output」类表述（若存）
- 增「direct invocation — read the full output; cdd truncates its own output」指引（若缺）
- grep 实证：`packages/osuperpowers/skills/*/SKILL.md` 中 `\b(cdd|cdd-engine).*(tail|head|EXIT=)` 零命中

**scope 限定**：本需求针对 **skill 指引面**（SKILL.md 散文 + 节点 Do 措辞）；repo 侧 `scripts/`（run.ts/smoke-cdd）自身调用不受此规约约束（脚本内部 pipe 是程序逻辑，非指引）；不新增 CLI。rules 面（engine 黑盒）不涉。

**验收**：grep 零命中（见上）；`pnpm run validate` 全绿；emit 产物重生成（SKILL.md 是 emit 源）零 drift。

### Acceptance criteria

- AC1 **守卫退役零残留**：`scripts/validate/overall-consistency.ts` / `plan-spec-anchors.ts` / `__tests__/{overall-consistency,plan-spec-anchors}.test.ts` 删除；`grep -rE "overall-consistency|plan-spec-anchors" scripts/` 零命中（`-E` 交替，非 BRE 字面 `|`）；42 行逐案对照表落盘本 design（每条 repo 断言 → engine 对应用例:行 → 覆盖判定，证实零功能损失）
- AC2 **engine 套件零产物 fixture**：`canary-dogfood.test.ts` 删除；`grep -r "2026-09-21-consumer-parity" packages/cdd-engine/src/**/__tests__/` 零命中（engine 测试面零本仓程序产物引用）；**`docs/osuperpowers` 布局字符串排除**——14 文件在 mkdtemp 临时仓复刻消费者等效布局属合法 fixture，不属产物引用（§2.2 排除口径）；canary 实证 = P3 文档链（P3 plan → p3 design → overall）经 P3 全程 dispatch 审计零失败（运行期实证，测试面自造链承载）
- AC3 **phase-id 语法 A 落地**：canonical overall.json **全部 8 处 phase-id 承载 pattern** 单点迁移 `^P\d+(\.\d+)*$`（issueInventory.row.phaseId · rowShape.idFormat · cells.dependency · hardEdge · softEdge · claimPatterns.designToken · phaseReference.single · range=single 派生 `\s*[-–—]\s*` 连接）+ description 全写 · engine 消费面（ownDesignToken / phaseIdFromPlan / designDocTail / split-phase 测试 `P1a`→`P2.1` 改造）零误伤 · 本仓存量文档零迁移 · engine 套件含语法新用例（P2.1 claim / P2.1-design / P2.1–P2.3 range / `…-p2.1.md` glob / **dependency cell `P2.1 -> P2.2` · hardEdge · softEdge**）
- AC4 **validate 净化**：12 → 11 块 · step 名全语义名零编号 anchor（`\b(?:5b\d?|5c|12\.|8-10|7\.|6\.)\b` 在 step name 面零残留）· ci-validate.test.mjs / pre-commit.test.ts 钉死值 11 同步 · index.ts / pre-commit.ts import 面清洁 · `pnpm run validate` 全绿
- AC5 **S3 残留改写**：overall 四条 + osuperpowers-plugin.md:116-120 + CLAUDE.md:47 + overall-spec SKILL:54 改写为 engine 执法位/历史时态表述；`grep "scripts/validate.*guard\|block 12.*consisten"` shipped docs/skills 面零现行主张（历史时态句允许）
- AC6 **consumer-sim**：先 `pnpm --filter @oscaner-skills/cdd-engine build`（真实 unbuild 产物）→ `pnpm pack` → mkdtemp 临时仓安装 → 消费者链（`cdd help` + 5-command dry-run）在发布门与 PR 门可跑、输出消费者等效结果；tarball 内容断言（含真实 `dist/cli.mjs` + `templates/`）；fixture plan 二选一（临时仓派生 / `templates/` 内置由安装面读取）落 P3 plan 并实证；run.ts `smoke-cdd` 子命令语义 = consumer-sim；zero 仓内路径依赖（不读 `docs/osuperpowers/`、不依赖 `dist/` 预生成）
- AC7 **运维规范落档**：Program experience（或同族 maintainer 档）新增**七项**裁决条目（零产物 fixture · 零编号 anchor · 零 legacy 豁免 · phase-id 语法 A · 唯一执法面 · validate 11 块结构 · **cdd 输出零过滤**），英文主源、可 grep Verify
- AC8 **cdd 输出零过滤（§2.8）**：`grep -rE "cdd[^\"']{0,40}(tail|head|EXIT=|2>&1[[:space:]]*\|)" packages/osuperpowers/skills/*/SKILL.md` 零命中；SKILL.md 中 cdd 调用节点含「direct invocation — read full output；cdd 自身优化输出长度」表述（或确认既有表述已符合）；`pnpm run emit` 后零 drift
- AC9 **全链收口**：`pnpm run validate` 全绿（11 块，干净已提交树）· `emit:check` 零 drift · precommit 11 块绿灯 · engine vitest 全绿 · AC1–AC8 逐条可复核

## Section 3: Deviations from overall

| Overall assumption（v1.13） | Phase decision | Overall updated? |
|---|---|---|
| P3 scope「42 用例并入 engine 套件或删除」 | **全删零迁入**——判据面 engine 自造链测试已覆盖（P2 建），42 条 repo 断言逐案对照后证实零功能损失；「并入」= 搬瓜皮，双写 | Yes — v1.14（2026-09-22 grilling 合流） |
| P3 scope「本仓 own 程序四表合规 = 跑 engine lifecycle 审计同路径（validate 中可见）」 | **零接线**——不建 validate 四表 block；判据面唯一实现 = engine（dispatch 运行时 + 套件）；canary 回归运行期形态；validate「可见」改由「engine 套件即 validate 5b1 + 程序运行期实证」满足 | Yes — v1.14 |
| P3 scope「smoke-cdd 升级 consumer-sim 挂 release 门」 | 保留原裁（Q6）：release 门 + PR 门双挂；入口 = run.ts `smoke-cdd` 语义化 | 保持（v1.14 无变化） |
| null（新需求） | 2026-09-22 用户裁决新增：canonical phase-id 语法严格 A · steps 语义名零编号 anchor · 零产物 fixture · 运维规范落档 | Yes — v1.14 新增 |
| null（P3 补充需求，2026-09-22） | **skills 调用 cdd 输出零过滤**——禁止 `tail`/`head`/`2>&1 |`/`EXIT=$?` 包装，cdd 已自身优化输出长度（§2.8）；P3 scope cell 同步列入 | Yes — v1.15 回填（P3 补充） |
| 依赖图 `P2 -> P3 -> P4` | 不变（P2 shipped → P3 可启；P4 依赖 consumer-sim 实测） | 保持 |

> `Overall updated?` 全为 Yes（v1.14 grilling 合流 + v1.15 spec-review r1 回填）——无未登记偏差。

## Section 4: Notes for downstream

- **P4（发布闭环）**：输入 = .changeset ×2（本程序 cdd-engine major + osuperpowers）版本化 + 旧程序 osuperpowers-overhaul ×9 changesets 版本化 + cdd-engine major breaking 发布面（P2 全部变更）+ **consumer-sim release 门实测通过**（P3 AC6 产物）+ pack 内容审计（`npm pack` 内容 = dist/templates/skills，不含仓内 tests/、scripts/ 治理残件）。
- 本 phase 无「later phases 会处理」悬空项——所有跨 phase 移交均落上游 overall v1.15 或本 §4 指针。

## Section 5: Review

- **Baseline = committed tree**：进入 review 前工作树干净（entry gate）；review 读 dispatch 入口时的 committed tree。
- **Convergence**：blocker > 0 → fix 全部 findings → 重审；blocker = 0 → fix 全部（warn/nit 含）→ 停，不再审（Review Convergence，CLAUDE.md）。
- 本 spec 经 `cdd review --type spec --spec docs/osuperpowers/specs/2026-09-21-consumer-parity-p3-design.md` 单轮收敛。