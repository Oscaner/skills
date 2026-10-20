---
title: 引擎文档工具（Engine Doc-Tooling）— P15 实施计划：文档身份面统一为 front-matter `slug:`（board 路径入口 · 文件名推演与路径声明键整退）
doc-type: plan
version: v0.7
date: 2026-10-20
slug: 2026-10-10-engine-doc-tooling-p15
depends-on: P14（Done · v0.3 · hard——P14 全链闭合 · overall 依赖图 D59）；前置 = P15 design spec v0.5（三轮 review 关闭 + plan 面 backfill）
base: develop
---

## Constraints

- 七前提整评：破坏性许可、不保守不打补丁；OOP 统一零裸函数（身份判据落 `SlugIndex` 一个类，零新增裸函数）；禁止声明再抄（身份 = `slug:` · 归属 = phase-spec 的 `program:` · 类型 = `doc-type:` · 工作区钥 = `slug:`，各一处）；死码随改清理（Task 7 整段删除，不留空壳）；消费者只感「board 收路径 + 身份键改名」，引擎内部类名不进消费面；能收敛到既有面则不做平行子系统；不造轮子（零新依赖，扫描只用 `node:fs`）。
- 一事实一处：**禁止文件名第二套算法**；**禁止** overall 子清单数组与扫盘双真源（相位集只由 `program:` 归并派生）。
- major breaking · **零 legacy 双读**：旧 slug positional 与新路径入口不并存；旧路径键退役后不接受「兼容读」。
- 迁移期文件名派生**只允许**在 Task 1 / Task 8 的一次性脚本里，脚本**不入库**；写入后运行时零派生。
- 语料迁移（Task 1 · Task 8）**授权**改写 `docs/kairos/{specs,plans}` 全部文档（含本 phase 自己的 design / plan 两篇）的 **front-matter 键行**——正文与表格零改。这是 plan-freeze 的**声明式例外**：迁移是计划内的数据面操作，不是就地改稿。
- 冻结面零破：`next:` 字面形态（P5/P9）；退出码表 0/1/2 语义（board 三类拒绝面统一 exit 2 属既有形）；CDD_BLOCKED 通道**只**承载派发面硬门（exit 1），board 不入该通道；branch face 的 skill ref 与四轴零改（附录调研不施工）。
- D29 黑盒边界：消费 skill 只承载行为契约（读 `slug:` / 写 `slug:` / 写 `program:` / board 路径入口），零引擎内部类名与推演函数名。
- 引擎调用一律本地 `node packages/cdd-engine/src-next/bin.ts`；本计划为内部文档中文主源（Strategy B）；不发布，changeset 收尾到可发布态即止。
- **计划外前置提交（归属声明）**：child-prompt Bash 纪律（每条 Bash 命令必带 `timeout` 与硬上限 `CHILD_BASH_TIMEOUT_MS` · 禁无界循环）随本分支在实现期落地（提交 `bdfeff35` / `9f740c62`：`render/templates.ts` 的 `cl:bash-stall-limit` 重写 + `cl:no-infinite-loop` 新增 + 模板契约 `$version` 10 → 12 · `face/termination.ts` 的 `CHILD_BASH_TIMEOUT_MS`，changeset `p15-child-bash-discipline-clauses.md`）——用户在本 phase 会话中明确要求的消费面子契约收紧，先于本计划成文；**不计入 P15 任务面**，本行即其归属记录（分支配额内每一改动文件均可归因，无未声明面）。
- **未覆盖输入面（Review Focus，逐条已钉测试）**：① 文件名与 `slug:` 矛盾（`x-design.md` 内写 `slug: y`）→ 全链零文件名影响（Task 2 · 5 · 6）；② 同一 slug 出现两份**身份文档**（无论分居 specs / plans 两目录还是同一目录）→ BLOCKED；同 slug 的「一份身份文档 + 一份 plan」才是合法对（Task 2 · 5）；③ `--plan` 与 `--spec` 同 slug 异型 → 仍是一块板（取 `--spec` 板形）（Task 5）；④ phase-spec 的 `program:` 指向已改名 / 缺失的 overall → 硬 BLOCKED，不是 `(none)` 也不是崩溃（Task 4 判据 · Task 5 呈现）；⑤ 入口文档落在 docRoots 之外 → not-found 面 exit 2、stdout 零 `(BLOCKED)` 标记（Task 5）。

### Task 1: 语料身份键先行——全库声明 `slug:`（+ phase-spec 的 `program:`）
- **Objective**: `docs/kairos/specs/`（16 篇）与 `docs/kairos/plans/`（15 篇）每篇 front-matter 增 `slug:`；15 篇 phase-spec 另增 `program: 2026-10-10-engine-doc-tooling`。旧键（plan 的 `spec:` / `parent-program:` / `parent-version:`、phase-spec 的 `parent-program:`）本任务**不动**——引擎此刻尚未退役它们，双键并存是合法中间态。正文与表格零改。
- **Files**: `docs/kairos/specs/2026-10-10-engine-doc-tooling-overall.md`；`docs/kairos/specs/2026-10-10-engine-doc-tooling-p1-design.md` 至 `-p15-design.md`（15 篇 phase-spec）；`docs/kairos/plans/2026-10-10-engine-doc-tooling-p1.md` 至 `-p15.md`（15 篇 plan）。
- **Consumes**: 设计的 §2.1 合法形 `^(?=.{1,128}$)[A-Za-z0-9][A-Za-z0-9._-]*$`；§5 的迁移期一次性派生许可（文件名茎）。
- **Produces**: 31 篇文档的 `slug:`（overall = `2026-10-10-engine-doc-tooling`；phase-spec 与 plan = 同名茎 `2026-10-10-engine-doc-tooling-p1` … `-p15`）；15 篇 phase-spec 的 `program:` = `2026-10-10-engine-doc-tooling`。Task 3 / 5 / 6 / 8 消费这些值。
- **Steps**:
  - 写一次性迁移脚本（临时文件，**不提交**）：overall → 文件名茎去 `-overall`；`X-design.md` → `X`；plan `X.md` → `X`；在每篇 front-matter 的 `date:` 行后插入 `slug:`，phase-spec 再插 `program:` — checkable: 脚本跑完 `grep -L '^slug:' docs/kairos/specs/*.md docs/kairos/plans/*.md` 输出为空
  - 校验脚本输出：身份文档（overall + 15 篇 phase-spec）的 slug 两两不重；每篇 plan 的 slug 与其同名 phase-spec 相同；15 个 `program:` 值恒等且等于 overall 的 slug — checkable: 校验清单零异常行
  - 校验 diff 形状：只增 front-matter 键行 — checkable: `git diff -U0 -- docs/kairos | grep -E '^[+-]' | grep -vE '^(\+\+\+|---)' | grep -vE '^\+(slug|program):'` 输出为空
  - 抽两篇人工核对（本 phase 的 `-p15-design.md` 与 `-p15.md`）: `slug:` 紧跟 `date:`、phase-spec 的 `program:` 紧随 `slug:` — checkable: `sed -n '1,14p'` 两篇键位与顺序一致
- **Acceptance**: 31 篇全带合法 `slug:`；15 篇 phase-spec 全带 `program:` 且值等于 overall slug；正文零改；旧键未动；临时脚本未入库。
- **DependsOn**: none

### Task 2: `SlugIndex`——身份索引单源
- **Objective**: 新增 `infra/slug-index.ts`：一次扫 `ENGINE_RUNTIME.docRoots`（specs + plans）下全部文档，读 front-matter 头，产出身份条目（path · rel · docType · slug · program · version · status · title）并按 slug 归并；暴露查表与违约判据（重复身份文档 / 重复 plan / 缺 `slug:` / 非法 `slug:` 值 / `program:` 命中 0 篇）。判据**一处**，board 与派发 pre-flight 都读它，零第二套实现。同时给 `FrontMatterHead` 补 `slug` / `program` 两个取值子（身份读取面）。
- **Files**: 新建 `packages/cdd-engine/src-next/infra/slug-index.ts`；新建 `packages/cdd-engine/src-next/infra/__tests__/slug-index.test.ts`；`packages/cdd-engine/src-next/contract/frontmatter.ts`（`slug` / `program` 取值子）；`packages/cdd-engine/src-next/contract/__tests__/frontmatter.test.ts`（取值子 pin）。
- **Consumes**: `ENGINE_RUNTIME.docRoots`（`infra/runtime.ts`）；`FrontMatterExtractor` / `FrontMatterHead`（`contract/frontmatter.ts`）；`DocKey` / `DOC_KEYS`（`contract/project.ts`）。
- **Produces**: `export class SlugIndex`（`static build(repoRoot: string, fs?: SlugScanFs): SlugIndex` · `readonly entries: readonly DocEntry[]` · `entryAt(rel)` · `identityDoc(slug)` · `planOf(slug)` · `phaseSpecsOf(programSlug)` · `overallOf(programSlug)` · `violations(): readonly SlugViolation[]` · `static isLegalSlug(value)` · `duplicatedRolesOf(slug)` · `slugVerdict(rel, slug)` · `insideDocRoots(rel)`）与 `DocEntry`（含 `title`，供板面旁注）/ `SlugViolation` 类型。`fs?: SlugScanFs` 注入缝 = 判定面的内存仓储入口（判定面不落盘即可跑）；`isLegalSlug` / `duplicatedRolesOf` / `slugVerdict` 是 board 与派发 pre-flight 共用的判定读法（branch-fix-1 把两处各自拼写的四路门收敛至此）；`insideDocRoots` 服务 §3.1 的 not-found 短路（豁免面零文档读取）。Task 4 / 5 / 6 消费。
- **Steps**:
  - 失败测试：temp repo 写 1 篇 overall + 2 篇 phase-spec（带 `program:`）+ 1 篇 plan，断言 `identityDoc` / `planOf` / `phaseSpecsOf` / `overallOf` / `entryAt` 的命中面与 rel 形 — checkable: 现状 `Cannot find module`
  - 失败测试（违约五型 + 合法一对）：同 slug 两份身份文档 → `duplicate-identity`；同 slug 两份 plan → `duplicate-plan`；无 `slug:` 的文档 → `missing-slug`；非法 `slug:` 值（`../x`）→ `invalid-slug`；`program:` 指向不存在的 overall → `missing-program-target`；spec + plan 同 slug → **零**违约 — checkable: 六例断言现状失败
  - 失败测试（未覆盖输入面 ① 与 ②）：文件 `x-design.md` 内写 `slug: y` → `identityDoc("y")` 命中且 `identityDoc("x")` 无；同 slug 文档分居 specs 与 plans 两目录时判据一致 — checkable: 该断言现状失败
  - 实现 `SlugIndex` + `DocEntry` + `SlugViolation`：一次 `readdirSync` 扫两目录、每篇读头一次（含 `title`）、按 slug 归并；零文件名推演（不读 basename 判类型）、零 `existsSync` 猜路径 — checkable: 上述断言全绿；类内 `readdirSync` 一处
  - `FrontMatterHead` 补 `get slug()` / `get program()`（转 `value("slug")` / `value("program")`），`frontmatter.test.ts` 补 pin — checkable: 新取值子断言绿、既有取值子零改
- **Acceptance**: 判据一处可复用；五类违约 + 合法性 + 文件名无关性全部有 pin；单次扫盘一个索引；零新依赖。
- **DependsOn**: none

### Task 3: 契约形状面——登记表键集 · `RefKind` 闭集 · 骨架 link 槽 · File paths 四面
- **Objective**: 四类登记表增 `slug:`（required · `refKind: "none"` · §2.1 的 `valuePattern`）；phase-spec 增 `program:`（required · `refKind: "slug-ref"`）；删 plan 的 `spec` / `parent-program` / `parent-version` 与 phase-spec 的 `parent-program` 五元素；`RefKind` 闭集删 `spec-ref` / `parent-program`、增 `slug-ref`；`Design spec cell` → `none`、`Design claim token` → `phase-id`；骨架 link 槽判据并入 `slug-ref` 并在 `FRONT_MATTER_LINKS` 补 `program:` 条目；`## File paths` 与 `File path row` 同批改 `optional`，hollow 表名过滤集收缩为三表。
- **Files**: `packages/cdd-engine/src-next/contract/declare.ts`；`packages/cdd-engine/src-next/contract/project.ts`；`packages/cdd-engine/src-next/render/skeleton.ts`；`packages/cdd-engine/src-next/contract/invariants.ts`（仅 `overallTableHeadings` 的名字集）；测试 `packages/cdd-engine/src-next/contract/__tests__/declare.test.ts`、`.../project.test.ts`、`.../structure-pin.test.ts`、`packages/cdd-engine/src-next/render/__tests__/skeleton.test.ts`；conforming fixture 同步 `.../judge.test.ts`、`packages/cdd-engine/src-next/session/__tests__/preflight.test.ts`、`packages/cdd-engine/src-next/face/__tests__/cli.test.ts`、`packages/cdd-engine/src-next/__tests__/smoke.integration.test.ts`。
- **Consumes**: 设计 §4.1（键集 + `RefKind` 三处同改）、§4.2（骨架槽类 · File paths 四面）。
- **Produces**: 新登记表行（`slug` 四处 · `program` 一处）；`RefKind` 含 `slug-ref`、无 `spec-ref` / `parent-program`；`FRONT_MATTER_LINKS.program`；四类骨架吐 `slug:` 槽、phase-spec 另吐 `program:` 槽；`## File paths` 与 `File path row` 均 `presence: "optional"`、hollow 过滤集 = `Issue inventory` / `Phase inventory` / `Change history`。
- **Steps**:
  - 翻新词表 pin：`declare.test.ts` 的 `REF_KIND_VALUES`（`:41`）· `HEADER_KEYS`（`:193`）· `KEY_VOCABULARY`（`:229`），`project.test.ts:42` 的 `REF_KINDS`，`structure-pin.test.ts:78` 的 `FRONTMATTER_KEYS` 全改到新词表 — checkable: 旧词表断言失败
  - 改 `RefKind` union（`declare.ts:29-38`）+ `REF_KIND_VALUES`（`:89-98`）+ 守卫（`:139-144` 逻辑不变）；删 plan 三元素（`:521-555`）与 phase-spec `parent-program`（`anchor: "parent-program"` `:780` · 元素 `:779-785`），四类各增 `slug` 行、phase-spec 增 `program` 行；`Design spec cell:397` → `none`、`Design claim token:471` → `phase-id` — checkable: `grep -rn '"spec-ref"\|"parent-program"' packages/cdd-engine/src-next --include=*.ts | grep -v __tests__` 只剩 Task 4 待改的链面消费点（`invariants.ts` / `doc.ts` / `frontmatter.ts`）；测试面残留（`judge.test.ts` / `lint.test.ts` / `doc.test.ts` 属 Task 4，其余在本任务 Files）随对应 pin 翻新退场
  - link 槽与骨架：`project.ts:595-599` 判据改为 `refKind === "slug-ref"`（两旧档删除）；`skeleton.ts` 的 `FRONT_MATTER_LINKS`（`:47-50`）删两条、增 `program:` 一条——尖括号形，括号内容取**本键值域形**（父 overall 的 slug，如 `<overall-slug>`），**不**沿用已退役路径键的路径范例（占位即消费者照抄样例；design §4.2）；`slug:` 落 `:::fill slug` content 槽 — checkable: skeleton 测试断言四类头含 `slug:` 槽、phase-spec 头含 `program:` 占位形
  - **占位豁免（AC「骨架占位不被硬门判」）**：把 `isPlaceholder`（现私有于 `FileExistenceInvariant`，`invariants.ts:1115`）上提到 `Invariant` 基类（既有消费点 `:1062` / `:1165` / `:1194` 不动），增 `:::fill` 形一支，成为占位契约的**单源**；`DomainInvariant` 的 front-matter 臂（`:484-500`）在判 `valuePattern` 前套同一豁免——否则骨架自产的 `slug: ':::fill slug'` 会被 §2.1 的严格模式判违约 — checkable: 骨架自产的 phase-spec 头（含 `slug:` / `program:` 占位）过 DomainInvariant 零 finding
  - **合法形 pin**：合法值（如 `2026-10-10-engine-doc-tooling-p15`）过；非法值 `.` · `..` · 含 `/` · 含 `\` · 含空白 · 空串 · 超 128 字符 · Windows 保留字符 → 各出一条 domain finding；`valuePattern` 源串覆盖 `.` / `..` 两目录逃逸值；board 面由 `SlugIndex` 的 `invalid-slug` 判据承载（Task 2 · Task 5 的呈现 pin） — checkable: 8 条非法值用例全绿
  - conforming fixture 补 `slug:`（`slug` 设 required 后引擎 suite 在 W2 收波即红）：`contract/__tests__/judge.test.ts` 的 `GOOD_OVERALL`（`:28-84`）· `session/__tests__/preflight.test.ts:66-77` 的 `planDoc` · `__tests__/smoke.integration.test.ts` 的 plan / phase-spec / overall 三 fixture；`face/__tests__/cli.test.ts` 的 conforming 族整体换头——`conformingPlan`（`:259-309`）增 `slug: p3` 并删 `spec:` / `parent-program:` / `parent-version:`，其两个桩 sibling（`:302` 的 `p3-design.md` / `p3-overall.md`）升为最小身份文档（`doc-type:` + `slug: p3` / `slug: p3-overall`，前者另写 `program: p3-overall`）；`conformingSpec`（`:443`）增 `slug: s1` 并以 `program: x-overall` 取代 `parent-program:`，其桩 sibling `x-overall.md`（`:486-488`）升为最小 overall 身份文档（`doc-type: overall-spec` + `slug: x-overall`）；`conformingOverall`（`:316`）增 `slug: o1-overall`（既有 `.kairos/cdd/o1-overall` 目录断言零改） — checkable: 上述 fixture 均带 `slug:`；`judge.test.ts` 的 conforming overall 用例零 findings；`cli.test.ts` 的 `conformingPlan` / `conformingSpec` 头各命中恰好一行 `^slug:`
  - File paths 四面：`declare.ts:223-229` 的 `## File paths` 与 `:434-440` 的 `File path row` 改 `presence: "optional"`；删 `skeleton.ts:172` 的段发射与 `:381-384` 的 `#filePathsTable`（连带 probe）；`invariants.ts:255` 名字集收缩为三表 — checkable: `schema get overall-spec --output skeleton` 产出的 overall 骨架无 `## File paths` 段；`#assertConsumed` 不抛
  - 自洽回归：骨架自产字节过自身 doc-type 与契约门（doc-type 门 `skeleton.test.ts:615` · 契约门 `:639`）— checkable: 两用例绿
- **Acceptance**: 登记表与 design §4.1 / §4.2 逐条一致；`RefKind` 三处同改；骨架自产字节过自家门（含 `slug:` / `program:` 占位豁免）；合法形与非法值双面有 pin；形状载体零第三处；历史 overall 保留 File paths 表与其 row 不报错；conforming fixture 已补 `slug:`。
- **DependsOn**: 1

### Task 4: 判定 / 链面——`ChainRoot` 收敛 · `slug-ref` 断言 · 旧链臂退役
- **Objective**: 链根按新身份面重建——plan 无父链（Class-B 臂退役）、phase-spec 的父锚改 `program:` 的 slug；`FileExistenceInvariant.chainLinks` 不再把 `program:` 当文件路径判（slug 非路径）；新增 `slug-ref` 断言面（值等于 docRoots 内某篇 overall 的 `slug:`，命中 0 篇 → 硬门；占位形沿用 `isPlaceholder` 豁免）；`CrossDocChainInvariant` 的 `planChain` Class-A 改为「同 slug 恰有一份身份文档」、`specChain` 保留而字段名与文案改 `program`；删 `FrontMatterHead` 的 `spec` / `parentProgram` 取值子。
- **Files**: `packages/cdd-engine/src-next/contract/doc.ts`（`ChainRoot` · `:681-683` / `:763-765` 链构造）；`packages/cdd-engine/src-next/contract/invariants.ts`（`chainLinks` `:1082-1112` · `planChain` `:1262-1291` · `specChain` `:1294-1310` · `classB` `:1313-1336`）；`packages/cdd-engine/src-next/contract/judge.ts`（策略族 + `ContractInput` 身份注入）；`packages/cdd-engine/src-next/contract/frontmatter.ts`（删旧取值子）；测试 `packages/cdd-engine/src-next/contract/__tests__/doc.test.ts`、`.../judge.test.ts`、`.../lint.test.ts`、`.../frontmatter.test.ts`、`packages/cdd-engine/src-next/face/__tests__/cli.test.ts`（conforming 族的 Class-A 正半）。
- **Consumes**: Task 2 的 `SlugIndex`；Task 3 的 `slug-ref` 档。
- **Produces**: `ChainRoot` 新面（`programLink: ChainLink | null` 取代 `parentLink`；`specLink` 退役；`parentTokens` 仅 phase-spec 保留）；`slug-ref` 判据（骨架占位豁免）；`planChain` / `specChain` 新臂。Task 5 / 6 消费 `chain` 面。
- **Steps**:
  - 失败测试（未覆盖输入面 ④ 的判据半）：phase-spec 的 `program:` 指向不存在的 overall → 恰一条 `slug-ref` finding；指向在册 overall slug → 零 finding；值形为占位（空串 / `Pending` / 尖括号形 / `:::fill`）→ 零 finding — checkable: 现状无该 finding
  - 失败测试：plan **无** `parent-program` / `parent-version` → 零 chain finding；plan 无同 slug 身份文档 → Class-A finding 字段 `slug`。正半由 Task 3 改造后的 `conformingPlan`（同 slug 的 `p3-design.md`）供——`cli.test.ts` 的 implement / review / fix doc-contract 用例在 W3 全绿；反半由去掉该身份文档的同 slug 态给出 — checkable: 旧断言（`planChain` 的 parent-program 文案 pin）翻新后失败；改造后的 fixture 过 `planChain` 零 finding、删其身份文档则出 Class-A finding（W3 红面的判据）
  - 改 `ChainRoot` 与 `doc.ts` 两处链构造（plan 面 `parentLink`/`parentTokens` 归零、phase-spec 面 `programLink` 承载 slug）；`chainLinks` 的 phase-spec 臂改指 `programLink` 且**不**进文件存在判 — checkable: `doc.test.ts:275` 的链断言按新面翻新后绿
  - 新增 `SlugRefInvariant`（具名策略，零裸函数）判 `program:` 对 docRoots 内 overall `slug:` 的命中，占位豁免沿用 `isPlaceholder`；`judge.ts` 策略族同批挂入，`ContractInput` 增身份来源 — checkable: 三条 `slug-ref` 用例全绿；`grep -rn 'isPlaceholder' packages/cdd-engine/src-next/contract/invariants.ts` 消费点数量与设计一致
  - 删 `FrontMatterHead.spec` / `.parentProgram`；`frontmatter.test.ts:51-52` 与 `lint.test.ts` 的 parent 面 pin 同步退役 — checkable: `grep -rn 'specLink\|parentProgram\|parentLink' packages/cdd-engine/src-next/contract --include=*.ts | grep -v __tests__` 零命中（`WorkScene.specLink` 等 `face/` 面 scene 字段保留，不入该 grep）
- **Acceptance**: 链面无 plan Class-B；`program:` 走 slug 查表且占位豁免；`spec:` / `parent-program:` 在契约面零残留（`scene.specLink` 属派发面字段，保留）；`ChainRoot` 单一定义无别名；未覆盖输入面 ④ 有判据 pin；`cli.test.ts` 的 conforming 族在 W3 无红面（同 slug 正半绿、无身份文档反半出 finding）。
- **DependsOn**: 2, 3

### Task 5: board 面——路径入口 · 索引驱动节点解析
- **Objective**: `cdd board` 退役 slug positional，改挂既有 `--plan` / `--spec`（至少其一，缺 → usage exit 2）；板形由入口文档 `doc-type:` 决定（overall-spec → program 板；phase-spec / single-spec / plan → 节点板）；节点解析全部走 `SlugIndex`（overall ← `program:`；spec / plan ← 同 slug；相位集 ← `program:` 归并）；三类拒绝面统一 exit 2 且措辞互不混淆（入参冲突 / 入口不可解析 / 文档违约）；缺失类标 `slug: missing (BLOCKED)` 与 `program: missing (BLOCKED)`、重复类单列 `slug: duplicated (BLOCKED)`、非法值类标 `slug: invalid (BLOCKED)`；相位行主键由 P-id 改 `slug:`（旁注 `title:` 截断，取索引 `DocEntry.title`）；节点类型由索引 `docType` 判定，`#isOverallNode` 的 `/-overall$/` 判据、`-overall` 切片与 `${slug}-overall` 拼装（文件名文法）同批退役。
- **Files**: `packages/cdd-engine/src-next/face/declare.ts`（`:280-285` board 行）；`packages/cdd-engine/src-next/face/cli.ts`（`:351-353` action · `:365-379` `#runBoard`）；`packages/cdd-engine/src-next/face/board-view.ts`（`render` `:320-340` · `hasNode` `:297-306` · `#phaseBoard` `:346-406` · `#programBoard` `:413-459`）；测试 `packages/cdd-engine/src-next/face/__tests__/cli.test.ts`（`:3289-3342`）、`packages/cdd-engine/src-next/face/__tests__/board-view.test.ts`、`packages/cdd-engine/src-next/face/__tests__/preview.test.ts:345`。
- **Consumes**: Task 2 的 `SlugIndex`；Task 1 的语料 `slug:`（真实仓冒烟）。
- **Produces**: `board` 命令的 `keys: [plan, spec]` + 零 positional；`BoardView` 新入口（收索引 + 入口文档身份，不收 slug）；节点类型由 `docType` 判定、零 `-overall` 文件名文法；节点板与 program 板两形。
- **Steps**:
  - 翻新 board 三条 pin（`cli.test.ts:3311` / `:3325` / `:3336`）：入参改路径旗标；`a valid slug` 用例断言**板头 / 进度标记 / `next:` / legend 逐字节不变**；缺旗标 → usage exit 2；幽灵路径 → not-found exit 2 且 stdout 零 `(BLOCKED)` — checkable: 旧 positional 用例失败
  - 失败测试（未覆盖输入面 ③ 与 ⑤）：双旗标同 slug 异型 → 单板（取 `--spec` 板形）exit 0；双旗标异 slug → exit 2 且 stderr 并列两值；`--spec` 路径落在 docRoots 外 → not-found exit 2 — checkable: 三条新用例现状失败
  - 失败测试（违约五型 + 合法缺项）：缺 `slug:` 的节点文档 → 该行 `slug: missing (BLOCKED)` + exit 2；非法 `slug:` 值（`../x`）→ `slug: invalid (BLOCKED)` + exit 2（取值面即拒，不构造 workspace）；同 slug 两份身份文档 → `slug: duplicated (BLOCKED)` + exit 2；`program:` 指向缺失 overall → `program: missing (BLOCKED)` + exit 2（未覆盖输入面 ④ 的呈现半）；0 plan → `plan (none)` 且 exit 0；`--spec` 传 single-spec → `overall (none)` 且 exit 0；`--plan` 传无配对 spec 的 plan → `spec (none)` 且 exit 0 — checkable: 七例现状失败
  - 改 `board-view.ts`：`render` 入口改收索引与入口身份；`hasNode` 退役（并入入口可解析判，`face/cli.ts` 调用点同步）；节点与相位解析全部走索引，节点类型由 `docType` 判定（`#isOverallNode` / `-overall` 切片 / `${slug}-overall` 拼装退役）；`#programBoard` 相位行主键改 `slug:` + 旁注取 `DocEntry.title` — checkable: 上述用例全绿；`grep -rn '\-overall\$' packages/cdd-engine/src-next --include=*.ts | grep -v __tests__` 零命中、`grep -n -- '-overall' packages/cdd-engine/src-next/face/board-view.ts` 零命中；`board-view.test.ts` 的 render 系断言按新入口翻新后绿
  - 改 `face/declare.ts` board 行（`description` / `example` 同步改路径入口）+ `cli.ts#runBoard`（两旗标走 `#relativizePath`，零 positional 读取）— checkable: `grep -n 'positionals\[0\]' packages/cdd-engine/src-next/face/cli.ts` 对该命令零命中；`cdd board --help` 例行为路径入口
- **Acceptance**: 三类拒绝面措辞可区分且全 exit 2（board 不入 CDD_BLOCKED）；板形由 `doc-type:` 决定；缺失 / 重复 / 非法值标记互不混淆；`(none)` 降级态（0 plan · single-spec 的 overall · plan 无配对 spec）全 exit 0；节点类型零文件名文法；AC 的「与改前等价」字节清单不变、相位主键重锚属 deliberate pin 重锚；未覆盖输入面 ③ ④ ⑤ 有 pin。
- **DependsOn**: 1, 2

### Task 6: 派发面——工作区钥与 spec 链接自 front-matter
- **Objective**: `implement` / `review` / `fix` / `base` 的工作区目录键由 `Workspace.slugFromDoc`（文件名推演）改为读目标文档 front-matter 的 `slug:`；plan / branch 面的 `specLink` 由 plan 头 `spec:` 改为「同 slug 的身份文档」索引查表；派发目标缺 `slug:` → doc-contract 硬 BLOCKED（exit 1 + CDD_BLOCKED，措辞与缺 `doc-type:` 同级）；派发目标 slug 在 `SlugIndex` 命中 `duplicate-identity` / `duplicate-plan` → 同面硬 BLOCKED + exit 1；`base` 无 preflight gate，其缺 / 非法 `slug:` 在 `#runBase` 的同一 slug 解析点按派发面载体拒绝（exit 1 + CDD_BLOCKED）。
- **Files**: `packages/cdd-engine/src-next/face/cli.ts`（`#sceneOf` `:771-871` · 三处 slug 来源 `:801` / `:808` / `:831` · specLink `:833-840` · `#runBase` `:992-1017` 的 `Workspace.slugFromDoc` 站点 `:1009-1011`）；`packages/cdd-engine/src-next/session/preflight.ts`（`:196-233` doc-contract 分支）；`packages/cdd-engine/src-next/face/words.ts`（新 route word）；测试 `packages/cdd-engine/src-next/face/__tests__/cli.test.ts`（`planFor` head `:211-219` · `:1564` · `:1616` · `:1760` · `:1873` · base 面 `:3053` 起）、`packages/cdd-engine/src-next/session/__tests__/preflight.test.ts`。
- **Consumes**: Task 2 的 `SlugIndex`；Task 1 的语料 `slug:`。
- **Produces**: 工作区钥 = 文档 `slug:`（四 verb 与 board 同一把）；`scene.specLink` 由索引解析（repoRoot 相对形）；缺 `slug:` 与同 slug 多身份文档 / 多 plan 的派发面 BLOCKED 文案；base 面同一把钥匙与同一拒绝载体（exit 1 + CDD_BLOCKED）。
- **Steps**:
  - 失败测试（未覆盖输入面 ① 的派发半）：temp repo 的 plan 文件名为 `x-p1.md` 而头写 `slug: custom-key` → 工作区落在 `.kairos/cdd/custom-key/` — checkable: 现状落在 `x-p1`
  - 失败测试：`--plan` 指向的 plan 与 `--spec` 指向的 spec 各缺 `slug:` → 两条命令均 exit 1 + CDD_BLOCKED 文案含 `slug:` — checkable: 现状失败
  - 失败测试（AC「同 slug 多 plan 或多身份文档 → 硬 BLOCKED」的派发半）：temp repo 写两份同 slug 身份文档 → `--spec` 与 `--plan` 均 exit 1 + CDD_BLOCKED（文案含 duplicate，与缺 `slug:` 同面同形）；同 slug 两份 plan → 同形 — checkable: 现状失败
  - 失败测试：plan 头**无** `spec:`、盘上同 slug 有 phase-spec → 轮上下文 `INPUT_SPEC` 仍解析到该 spec 的 repoRoot 相对 token — checkable: 现状失败
  - 失败测试（base 半：同钥 + 拒绝载体）：`base set --plan` 的目标 plan 头写 `slug: custom-key` 而文件名 `x-p1.md` → 工件落 `.kairos/cdd/custom-key/base.json`；同一 plan 缺 `slug:` / 非法 `slug:`（`../x`）→ exit 1 + `CDD_BLOCKED` 文案含 `slug:`（`base get` 同判）— checkable: 现状落 `x-p1`、缺键与非法值均 exit 0
  - 改 `#sceneOf`：三处 slug 改读索引身份（零文件名推演）；specLink 改「同 slug 身份文档」+ `RepoRoot.relativize`；`preflight.ts` 的 doc-contract 分支在缺 `doc-type:` 判之后增设缺 `slug:` 判与 `SlugIndex.violations()` 的 `duplicate-identity` / `duplicate-plan` 判（同面同形）— checkable: 上述四组用例绿；`cli.test.ts:1873` 的工作区目录断言按新语义翻新后绿
  - 改 `#runBase`（`:992-1017`）：`new Workspace(…, Workspace.slugFromDoc(planPath))`（`:1009-1011`）改走与 `#sceneOf` 同一处 slug 读取；base 无 preflight gate，缺 / 非法 `slug:` 在解析点前置拒绝，载体 = 派发面形（exit 1 + `CDD_BLOCKED`）；`cli.test.ts` 的 `planFor` head（`:211-219`）补 `slug: p3`，既有 `.kairos/cdd/p3` 断言零改 — checkable: base 面两用例绿；`grep -rn 'slugFromDoc' packages/cdd-engine/src-next/face --include=*.ts | grep -v __tests__` 零命中
- **Acceptance**: 四 verb 与 board 同钥；`slugFromDoc` 在活面零调用；`implement` / `review` / `fix` 与 `base` 的缺 / 非法 `slug:` 均走 CDD_BLOCKED + exit 1（与 board 的 exit 2 分面）；path funnel 的 branded `RepoPath` 链零破。
- **DependsOn**: 1, 2

### Task 7: 退役文件名推演面
- **Objective**: 删除 `Workspace.slugFromDoc` / `phaseSuffixOf` / `docsOfSlug` / `#nearestOverall`、`PHASE_SUFFIX_CORE` / `PHASE_SUFFIX_TAIL` / `PHASE_SUFFIX_BARE`、`SlugDocs` 接口、`BoardView.scanPhases`，连同其全部测试（含 `__tests__/phase-suffix.guard.test.ts` 整文件）；`infra/runtime.ts` 与 `board-view.ts` 中引用旧推演的注释同步改写。
- **Files**: `packages/cdd-engine/src-next/infra/workspace.ts`；`packages/cdd-engine/src-next/face/board-view.ts`；`packages/cdd-engine/src-next/infra/runtime.ts`；删除 `packages/cdd-engine/src-next/__tests__/phase-suffix.guard.test.ts`；测试 `packages/cdd-engine/src-next/infra/__tests__/infra.test.ts`、`packages/cdd-engine/src-next/face/__tests__/board-view.test.ts`。
- **Consumes**: Task 5 / 6 已完成的换线（活面零调用）。
- **Produces**: `Workspace` 只剩根 / 路径 / IO 面；文件名推演符号与相位后缀文法在引擎零命中。
- **Steps**:
  - 删 `workspace.ts` 的六个符号与 `SlugDocs`；`infra.test.ts:246` 的 `slugFromDoc` 用例同批删 — checkable: typecheck 绿；`grep -rn 'slugFromDoc\|phaseSuffixOf\|docsOfSlug\|PHASE_SUFFIX' packages/cdd-engine --include=*.ts` 零命中
  - 删 `BoardView.scanPhases` 与其 `PHASE_SUFFIX_BARE` import；`board-view.test.ts` 的两个 `describe`（`:26` · `:105`，共 9 用例）整段删除 — checkable: `grep -rn 'scanPhases' packages/cdd-engine --include=*.ts` 零命中
  - 删 `__tests__/phase-suffix.guard.test.ts` 整文件；改写 `runtime.ts:17` 与 `board-view.ts` 头部引用旧算法的注释 — checkable: 文件不存在；注释人工核对零旧算法描述
  - 跑 `pnpm -C packages/cdd-engine test` — checkable: 全绿、零 skip / 零孤儿用例
- **Acceptance**: 文件名推演符号与相位后缀文法零残留；死码零遗留；注释与代码同实况；测试面无孤儿。
- **DependsOn**: 5, 6

### Task 8: 语料旧键退场
- **Objective**: `docs/kairos/{specs,plans}` 全量删除 plan 的 `spec:` / `parent-program:` / `parent-version:` 与 phase-spec 的 `parent-program:`；保留 `slug:` / `program:` / `depends-on:` / `base:` / `version:` 等其余键。正文与表格零改。
- **Files**: `docs/kairos/specs/2026-10-10-engine-doc-tooling-p1-design.md` 至 `-p15-design.md`（15 篇 phase-spec）；`docs/kairos/plans/2026-10-10-engine-doc-tooling-p1.md` 至 `-p15.md`（15 篇 plan）。
- **Consumes**: Task 3 / 4（登记表已删键、链面已换线）；Task 5（board 路径入口与索引驱动节点解析）；Task 6（specLink 已由索引解析）。
- **Produces**: 语料 front-matter 只剩新身份面；Task 9 的全量验证前提。
- **Steps**:
  - 写一次性删除脚本（临时，**不提交**）：按行精确匹配删上述键行（含 plan 的 `parent-version:`；`depends-on:` / `base:` 等保留）— checkable: **front-matter 作用域**零命中，按目录分判（判据只覆盖本任务授权的键行；正文与表格不在判据内）：`for f in docs/kairos/specs/*.md; do awk '/^---$/{n++; next} n==1' "$f" | grep -nE '^(spec|parent-program):' && echo "RESIDUE $f"; done` 输出为空（phase-spec 的 `parent-version:` 是保留键，不入本侧判据）；`for f in docs/kairos/plans/*.md; do awk '/^---$/{n++; next} n==1' "$f" | grep -nE '^(spec|parent-program|parent-version):' && echo "RESIDUE $f"; done` 输出为空。**不得**用整文件 `grep` 当判据——已废相位 `p10-design.md` 正文的 fenced yaml 示例（`:67-78`）含旧键行，属历史示例，按 Constraints 的窄授权不动
  - 校验 diff 形状：只删 front-matter 键行 — checkable: `git diff -U0 -- docs/kairos | grep -E '^[+-]' | grep -vE '^(\+\+\+|---)' | grep -vE '^-(spec|parent-program|parent-version):'` 输出为空
  - 真实仓冒烟：`node packages/cdd-engine/src-next/bin.ts board --spec docs/kairos/specs/2026-10-10-engine-doc-tooling-p15-design.md` 与 `--plan docs/kairos/plans/2026-10-10-engine-doc-tooling-p15.md` 各渲染一块节点板且 exit 0，`--spec docs/kairos/specs/2026-10-10-engine-doc-tooling-overall.md` 渲染 program 板且相位行主键为 slug — checkable: 三条命令 stdout 含板头 + `next:` 行，退出码 0
  - 抽两篇人工核对（本 phase 的 plan 与 spec 属同批）— checkable: `sed -n '1,14p'` 两篇均无旧键、`slug:` 在册
- **Acceptance**: 旧路径键在语料 **front-matter** 零残留（正文与表格按窄授权零改——历史示例不动）；真实仓 board 两入口皆绿；临时脚本未入库。
- **DependsOn**: 3, 4, 5, 6

### Task 9: 消费面同步 · changeset · 全量验证
- **Objective**: kairos skill 与引擎 README 的字面从旧身份面翻新——`cdd-plan` 的 plan 头 `spec:` 约定改 `slug:`（plan 从 spec 继承，并写明归属链 = 同 slug spec → `program:` → overall）；`cdd-report` 的程序归属链改为 `progress.json#plan` → `slug:` → spec → `program:` → overall；`cdd-dev/docs/base.md` 的「workspace slug 由文件名派生」描述改「读文档 front-matter `slug:`」；`cdd-design` / `cdd-spec-writer` 的 author 节点写明落盘写 `slug:`、phase-spec 另写 `program:`；引擎 README 的 board 行改路径入口，并按 design §5 补**消费者迁移说明**（major breaking · 零双读 · 旧 `.kairos/cdd/` 下按旧键命名的进度目录可手删）。补 changeset（cdd-engine **major** + kairos **minor**，不发布）并跑全量验证。
- **Files**: `packages/kairos/skills/cdd-plan/SKILL.md`；`packages/kairos/skills/cdd-report/SKILL.md`；`packages/kairos/skills/cdd-dev/docs/base.md`；`packages/kairos/skills/cdd-design/SKILL.md`；`packages/kairos/skills/cdd-spec-writer/SKILL.md`；`packages/cdd-engine/README.md`；`packages/cdd-engine/README.zh-CN.md`；`packages/kairos/tests/cdd-plan-spec.test.ts`；新建 `.changeset/p15-doc-identity-slug.md`。
- **Consumes**: Task 1–8 已合入的行为面。
- **Produces**: 消费面零旧键 / 零文件名派生措辞；changeset（双包在册）；`pnpm run validate` ALL PASS。
- **Steps**:
  - 翻新 `packages/kairos/tests/cdd-plan-spec.test.ts:31` 的 pin：`author-plan` 节点体仍须点到身份键与「plan 记录是程序链第一跳」，但改判 `slug:` 继承与归属链，不再要求 `spec:` — checkable: 旧 pin 失败、新 pin 绿
  - 改五处 skill 字面 + 两份 README（board 行 + 消费者迁移说明）；`board` 命令名与七命令词表零改 — checkable: `grep -rn 'board <slug>\|parent-program\|文件名派生\|slug resolution\|doc filename' packages/kairos/skills packages/cdd-engine/README.md packages/cdd-engine/README.zh-CN.md` 零命中；`presentation-surface.test.ts` 补一条迁移说明正向 pin（两份引擎 README 同时命中 `.kairos/cdd/` 与「旧键目录不复用 / 可手删（major breaking）」语义，EN 与 zh-CN 同断）；`packages/kairos/tests/presentation-surface.test.ts` 全绿
  - 非目标面复核：`schema get` 零新旗标（无 `--slug` / `--from-spec`）；branch face 的 skill ref 与四轴零改 — checkable: 本 phase 全部提交的 `--name-only` 并集不含 `packages/cdd-engine/src-next/face/host.ts`；`cdd schema get --help` 旗标集与改前一致
  - 新增 changeset（cdd-engine **major** · kairos **minor** · 不发布）— checkable: 文件存在且两包 bump 类型正确
  - D29 黑盒边界核对：消费 skill 字面只承载行为契约，零引擎内部类名与推演函数名 — checkable: `grep -rn 'SlugIndex\|SlugViolation\|slugFromDoc' packages/kairos/skills` 零命中
  - 跑 `pnpm -C packages/cdd-engine test` · `pnpm -C packages/kairos test` · `pnpm run validate` — checkable: 三命令全绿 / ALL PASS
- **Acceptance**: 消费面零旧键措辞；两份引擎 README 的消费者迁移说明在册（`.kairos/cdd/` + 「旧键目录不复用 / 可手删（major breaking）」正向 pin）；D29 边界守住；changeset 双包在册且不发布；附录调研不进实现面、branch skill ref 零改；`validate` ALL PASS。
- **DependsOn**: 8

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-10-20 | 初稿——P15 九任务五波：W1 {T1 语料身份键先行 · T2 `SlugIndex` 索引单源} → W2 {T3 契约形状面 · T5 board 路径入口 · T6 派发面工作区钥} → W3 {T4 判定 / 链面 · T7 文件名推演面整退} → W4 {T8 语料旧键退场} → W5 {T9 消费面 + changeset + validate}；承 design v0.5 / D59。 | Oscaner M. · Claude（kairos:cdd-plan [P15]） |
| v0.2 | 2026-10-20 | plan-fix-1——review-1 findings 全修（14/14）：派发面 slug 唯一性硬门补 owner · 语料计数 15 plan / 31 篇 · Task 3 / 4 的 grep 判据收窄 · 节点板 `#isOverallNode` / `-overall` 退役归属 · `DocEntry.title` · 非法 `slug:` 双面 pin · fixture 涟漪进 W2 · 占位豁免单源上提 · 契约门 pin 校正 · Task 8 `DependsOn` 补 5。 | Oscaner M. · Claude（kairos:cdd-fix [P15]） |
| v0.3 | 2026-10-20 | plan-fix-2——review-2 findings 全修（4/4）：Task 6 补 base 半 owner（`#runBase` 同键读取 · 派发面拒绝载体 · `planFor` slug）· Task 3 / 4 的 conforming fixture 族换头与 Class-A 正半归属 · 词表 pin 按实测校正 · Task 9 README 迁移说明正向 pin。 | Oscaner M. · Claude（kairos:cdd-fix [P15]） |
| v0.4 | 2026-10-21 | **实现期 backfill（cdd-dev 会话 · W2 review-1 finding 5）**——Task 3 步骤 3 的骨架 `program:` 占位措辞由「尖括号占位形，与既有 link 占位同形」改为点明**值域形**（括号内容 = 父 overall 的 slug，如 `<overall-slug>`，不沿用已退役路径键的路径范例）；同步 design §4.2 v0.6 的口径收口。纯措辞裁定，任务面与波序不变。 | Oscaner M. · Claude（kairos:cdd-dev [P15] backfill） |
| v0.5 | 2026-10-21 | **实现期 backfill（cdd-dev 会话 · T8 implement 上报的计划内部冲突）**——Task 8 步骤 1 的零残留判据由整文件 `grep` 收窄为 **front-matter 作用域**（`awk` 取首个 `---` 块）：整文件 grep 会命中原 phase `p10-design.md` 正文 fenced yaml 示例里的旧键行（`:73`/`:74`），而删它们既超出本任务的窄授权（「**front-matter 键行**」）又违反同任务两处写明的「正文与表格零改」。判据是本条缺陷、语料不是——Acceptance 同步限定为 front-matter 零残留。判定方向与已记录的同类先例一致（design §1.2 pin 表、overall D59 行皆以历史叙述保留已退役形状） | Oscaner M. · Claude（kairos:cdd-dev [P15] backfill） |
| v0.6 | 2026-10-21 | **分支终审 S1/S7 上报面的 plan 回填（cdd-dev 会话 · branch-fix-1 上报）**——① **归属声明**（Constraints 新增条）：child-prompt Bash 纪律（`bdfeff35` / `9f740c62` · `CHILD_BASH_TIMEOUT_MS` · 模板契约 `$version` 10 → 12 · 自带 changeset）是用户本会话明确要求、先于本计划成文的消费面收紧，记明不计入 P15 任务面，本行即其归属记录（分支上每一改动文件均可归因）；未采用「拆独立分支」——那要改写已受审提交集，收益不抵风险。② **T2 `Produces` 补记实交 API**：`isLegalSlug` / `duplicatedRolesOf` / `slugVerdict` / `insideDocRoots` / `build(repoRoot, fs?: SlugScanFs)` 注入缝——三处均有生产读者，删不可行、漏记则 API 面与 brief 不符。③ 同轮 branch-fix-1 的代码面 findings（S2–S6：changeset 末行换行 · 四处作废注释 · 派发面 slug 门收敛进 `SlugIndex.slugVerdict` + `Words.slugRefusal` · `#programMissing` 复用 · not-found 短路）已落地于 `0963327b`，本行不重复其内容 | Oscaner M. · Claude（kairos:cdd-dev [P15] backfill） |
| v0.7 | 2026-10-21 | **closeout（cdd-close）——P15 全链闭合登记**：九任务五波全部交付（W1 {T1,T2} · W2 {T3,T5,T6} · W3 {T4,T7} · W4 {T8} · W5 {T9}；W1/W2/W3 各一轮 fix 收口——W1 implement `0eb3737c` · wave-review-1 1 nit → `0e239e5e`；W2 implement `fcbd3888` · 1 warn + 7 nit → `aff1a2df`；W3 implement `ce98f5b2` · 1 warn + 7 nit → `81f4c3a9`；W4 implement `83786c20` · W5 implement `bd125f0e` + `e2f5617d`，两波 review 均 APPROVED 零 fix） · 分支终审 branch-review-1 REVIEW_FIX（2 warn + 4 nit）→ branch-fix-1 `0963327b` APPROVED（其 S1/S7 两条 plan 面 findings 由编排者以 v0.6 回填收口） · 验收：`pnpm run validate` exit 0（cdd-engine 806/806 · kairos 87/87 · root 10/10 · typecheck ×3 · emit-check fresh · version-sync kairos 1.1.2 · cdd-engine 3.1.0 · 零裸函数）· changeset cdd-engine **major** + kairos **minor** pending · 不发布 · **未验证面（如实记录）**：本计划为内部文档、非发布面；未发布故无外部消费者实跑 | Oscaner M. · Claude（kairos:cdd-close · closeout-backfill · 2026-10-21） |
