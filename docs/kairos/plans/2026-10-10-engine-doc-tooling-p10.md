---
title: 引擎文档工具（Engine Doc-Tooling）— P10 实施计划：文档头部 front-matter 化 + 登记表驱动正文解析统一
doc-type: plan
version: v0.4
date: 2026-10-17
spec: docs/kairos/specs/2026-10-10-engine-doc-tooling-p10-design.md
parent-program: ../specs/2026-10-10-engine-doc-tooling-overall.md
---

## Constraints

- 判定语义不变：`invariants.ts` 判压逻辑逐条不变——只换承载形态与提取通道；退出码表 0/1/2 · CDD_BLOCKED 通道 · 领域 run 语义 · `next:` 字面形态零变化。
- 两组分界唯一规范：结构化元数据（front-matter）→ 标准解析器（`yaml`）；markdown 正文骨架 → 登记表驱动轻量扫描。正文层不引 AST 解析器。
- 登记表唯一声明根：头部元素 `home: "frontmatter"`（anchor = YAML key）· 正文元素 home 提取器；零「头部单抽 schema」双模型。
- `yaml` 升 engine 运行时依赖（由仓库 devDep 升 cdd-engine `dependencies`）。
- 迁移 = 全量 · 零 legacy 兼容：迁移时刻在册的 21 篇一次性改写；消费者自行迁移；major breaking；不引入双格式头兼容层。
- H1 删除：`title:` 是唯一标题源，正文自 `## Document scope` / `## Design` 起。
- 两正交门裁定：`MAX_BODY_ELEMENTS`（正文 home）· `MAX_HEADER_ELEMENTS`（frontmatter/header home）——拆单一 `MAX_ELEMENTS`，具体数值本计划 Task 4 落定。
- 一次性迁移脚本裁定：跑完即删、不入仓；回环断言与形态 pin 进 engine suite（迁移结果由常驻测试守住）。
- D29 黑盒边界守约：消费面只同步头部形态表述，零引擎内部实现镜像。
- 门归属分域：引擎内部事实门进 engine suite；引擎 ⇄ 消费面对照门进 kairos suite。
- 中间态红窗口：T5–T8（登记表/anchor/骨架翻面而夹具与语料未迁）期间引擎套件预期红；波末全绿收口于 T8（夹具）与 T13（全量）。
- 波次结构：DependsOn 边即派发波（W1={1,2,3} · W2={4} · W3={5} · W4={6} · W5={7} · W6={8} · W7={9,11,12} · W8={10} · W9={13}），本计划 audit 覆盖九波、13 任务——T10 依赖 T9（readDocType 重指先于语料判压），波内序由边强制。
- 变更先回填 parent overall（backfill-as-version）——spec 阶段已 discharge（D48 语义回填 + 用户裁定 backfill 提交，见 spec Change history）；本 plan 为格式迁移、T10 保持 overall change-history 行字节不变，该约束对格式迁移不适用、无 owning task。
- 不发布：changeset（cdd-engine major breaking）落 pending；tag / publish = 独立动作。
- English-primary（SKILL.md / `docs/*.md`）· specs/plans 中文（Strategy B）· emit 产物派生（`pnpm run emit`）· EOF 恰一 newline。
- 本计划文件本身是 T10 迁移对象：头部保持旧 bullet 形态落盘，随迁移 wave 改写。

### Task 1: FrontMatterExtractor——head 提取器 + `yaml` 运行时依赖入位
- **Objective**: 在 contract 面新建 front-matter 提取链：`FrontMatterHead` 值对象（`value(key)` typed accessor + 12 具名 getter）+ `FrontMatterExtractor.split(content)`（薄 `---` fence 切分 → `yaml.parse` → typed head record），读 **RAW 原串**（不经 canonicalize）；`yaml` 由仓库 devDep 升 cdd-engine 运行时依赖。零裸函数、零新增正则。
- **Files**: Create `packages/cdd-engine/src-next/contract/frontmatter.ts` · Modify `packages/cdd-engine/package.json`（`yaml` 进 `dependencies`）· Test `packages/cdd-engine/src-next/contract/__tests__/frontmatter.test.ts`
- **Consumes**: 仓库既有 `yaml@^2.9.1`（`scripts/emit.ts` 与 `packages/kairos/tests/skill-anatomy.test.ts` 已同引擎使用）；spec §2.1 字段全集（12 键）· §2.2 形态裁定（fence 切分 + `yaml.parse`，不用 gray-matter 系）。
- **Produces**:
  - `class FrontMatterHead`：`value(key: string): string | null`（非标量 YAML 值回 `null`）+ 12 具名 getter：`title` · `docType` · `version` · `date` · `status` · `author` · `spec` · `parentProgram` · `parentVersion` · `dependsOn` · `base` · `issues`。
  - `class FrontMatterExtractor`：`static split(content: string): { head: FrontMatterHead; body: string }`——body = 第二个 `---` fence 之后的全部行；无 fence 时 head 值全 `null`、body = 原串。fence 内原文喂 `yaml.parse`，`yaml` 解析失败 → head 值全 `null`（不抛）。
  - 回归约定：提取结果与源串逐字一致（RAW 通道，Task 11 positive 用例钉住）。
- **Steps**:
  - `yaml` 入 cdd-engine `dependencies`（`"yaml": "^2.9.1"`）— checkable: `node -p "require('./packages/cdd-engine/package.json').dependencies.yaml"` 输出 `^2.9.1`。
  - 写 failing test（frontmatter.test.ts，三断言：① fence 切分——`split` 的 head/body 分界正确且无 fence 时 head 值全 null；② 非标量降级——`issues: [a, b]` → `value("issues") === null`；③ RAW 保真——`author` 值为 `[human]` 起首者读出与源串逐字相同）— checkable: `pnpm -C packages/cdd-engine test frontmatter` FAIL（模块未建）。
  - 实现 `FrontMatterHead.value` / 12 getters 与 `FrontMatterExtractor.split`（`yaml.parse` + fence 切分；零 `RegExp` 新建）— checkable: `tsc --noEmit -p packages/cdd-engine` 过。
  - 运行测试转绿 — checkable: `pnpm -C packages/cdd-engine test frontmatter` PASS。
  - 零裸函数 + 零新正则断言 — checkable: `grep -nE '^export function|^function' packages/cdd-engine/src-next/contract/frontmatter.ts` 零命中；`grep -nE 'RegExp|\\.match\\(|\\.split\\(|\\.replace\\(' packages/cdd-engine/src-next/contract/frontmatter.ts` 零命中。
- **Acceptance**: `yaml` 在 cdd-engine `dependencies`；提取器读 RAW、fence 切分成立；12 getters 与 §2.3 收编键一一对应；零裸函数零新正则。
- **DependsOn**: none

### Task 2: Home union 改名——`header` → `frontmatter`（retire，不并存）
- **Objective**: `declare.ts` 的 `Home` union（`:42-52`）与 `HOME_VALUES`（`:100-111`）中 `"header"` 改名为 `"frontmatter"`；23 处 `home: "header"` 用例随改；`PRESENCE_HOMES`（`invariants.ts:263-273`）同步换键。plan-wave 裁定（spec §5.1「改法二选一须显式裁定」）：**`declare.test.ts` 本地 `HOME_VALUES` 副本（`:41-52`）保副本、字面量改名 `"frontmatter"`**——副本是独立于 `declare.ts` 的刻意第二份声明（断言「registry home ⊂ 封闭词表」而非「registry home ⊂ 自身」），导入会令断言自我证真。
- **Files**: Modify `packages/cdd-engine/src-next/contract/declare.ts`（Home union · HOME_VALUES · 23 处 `home: "header"`）· Modify `packages/cdd-engine/src-next/contract/invariants.ts`（PRESENCE_HOMES）· Test `packages/cdd-engine/src-next/contract/__tests__/declare.test.ts`（本地副本改名）
- **Consumes**: spec §3.1「改名 retire、非并存」裁定。
- **Produces**: `Home` union 含 `"frontmatter"` 不含 `"header"`；`home: "frontmatter"` 为唯一头部 home 值；`PRESENCE_HOMES` 含 `"frontmatter"`；`declare.test.ts` 副本同步（`:113` home ∈ HOME_VALUES 断言对新副本成立）。
- **Steps**:
  - `Home` union 与 `HOME_VALUES` 的 `"header"` → `"frontmatter"`，23 处用例、`PRESENCE_HOMES`、declare.test.ts 本地副本同批改 — checkable: `grep -rn 'home: "header"' packages/cdd-engine/src-next` 零命中。
  - tsc 通过 — checkable: `tsc --noEmit -p packages/cdd-engine` 退出 0（副本 `as const satisfies readonly Home[]` 成立）。
  - 语义 pin — checkable: `pnpm -C packages/cdd-engine test declare` PASS（`:113` home 归属断言）。
- **Acceptance**: `"header"` 无 `home:` 用例残留、不出现于 union/HOME_VALUES/PRESENCE_HOMES；`"frontmatter"` 三处齐备；typecheck 通过。
- **DependsOn**: none

### Task 3: 正文 home 驱动泛型提取器——6 条手抄文法退役 + `#phaseId` 改写
- **Objective**: 在 contract 面建 home 驱动泛型提取器（每 home 一方法，读登记表该 home 的 anchor 集合，不硬编码字面量）；`doc.ts` 的锚定结构正则 `:382 /^### Task (\d+):/` · `:407 /^-\s+\*\*([A-Za-z ]+)\*\*:\s*(.*)$/` · `:425 /^-\s+(.*)$/` · `:676 /^### (\d+)\.\s+(.*)$/` · `:683 /^#### (\d+)\.(\d+)\s+(.*)$/` 与 `markerValue` 的 `:459 payload.replace(/^:\s*/, "")` 全部退役；`#phaseId` 的 `:576 /^P\d+(\.\d+)*$/.test(...)` 手抄文法改写为读 `sliceOf("Phase id token")?.valuePattern`（形态同 `sectionConforms` `:474-478`）。§6(b) 保留原语（heading-rank · table split · 链接文法 · 版本 token 文法 · 图边文法 · 已声明 valuePattern 的应用）本 task 零改动。
- **Files**: Create `packages/cdd-engine/src-next/contract/home-extractors.ts` · Modify `packages/cdd-engine/src-next/contract/doc.ts`（四个 `parse` 方法 :499/:599/:638/:717 的正文结构提取改走 home 提取器 · `markerLine`/`markerValue` 家族退休 · `#phaseId` :575-576 改写）· Test `packages/cdd-engine/src-next/contract/__tests__/doc.test.ts`（新增形状 pin：task-block/field/step 与 design-body 层级）
- **Consumes**: 登记表 anchor 与 home（结构知识唯一来源，D26）；spec §3.2 逐 home 规则 · §6(b) 保留集。
- **Produces**:
  - `home-extractors.ts` 五个提取器类，统一入口 `extract(registry, lines): Record<anchor, readonly string[]>`（anchor → 该元素出现行/段集合）：`TaskExtractor`（`### Task N:` 块头 + `- **Key**:` 字段 + `- ` 步骤行，泛型服务 `task-block`/`task-field`/`task-step` 三 home）· `DesignBodyExtractor`（`### N.` / `#### N.M` 编号标题）· `GraphExtractor`（`P1 -> P2` 边线）· `TableExtractor`（列头 + 数据行）· `HeadingScanner`（section/facet，heading rank 由 anchor `#` 数派生）。
  - `doc.ts` 四个 `parse` 的输出形状（`taskBlocks`/`graphEdges`/`sections` 与各字段）不变，来源换为 home 提取器。
- **Steps**:
  - 写 failing 形状 pin（doc.test.ts：一段真实语料片段 → task 块数/`Task N` id/字段键/design-body 层级）— checkable: `pnpm -C packages/cdd-engine test doc` 运行（当前正则实现仍绿指实现未接管，pin 断言目标形状）。
  - 建 `home-extractors.ts` 五类（读登记表该 home 分组与 anchor 集合）— checkable: `tsc --noEmit -p packages/cdd-engine` 过。
  - `doc.ts` 四个 `parse` 改调 home 提取器，删 6 条字面正则与 `markerLine`/`markerValue` 家族 — checkable: 退役集 6 条逐条 grep 零命中（`grep -nF '/^### Task (\\d+):/' contract/doc.ts` 等）。
  - `#phaseId` 改写为 `sliceOf("Phase id token")?.valuePattern` 判各 cell（形态同 `sectionConforms` `:474-478`）— checkable: `grep -Fn '/^P\\d+(\\.\\d+)*$/' contract/doc.ts` 零命中（字面只留登记表 `declare.ts:358-362`）。
  - 形状 pin + 全量转绿 — checkable: `pnpm -C packages/cdd-engine test doc` PASS。
- **Acceptance**: 结构 pin(a) 的 5 条锚定正则 + `:459` 零命中；`#phaseId` 字面文法归登记表单源；保留原语集原样存活（`doc.ts` 命中 ⊆ 6 原语）；四个 `parse` 输出形状不变。
- **DependsOn**: none

### Task 4: 元素数门拆分——`MAX_ELEMENTS` → `MAX_BODY_ELEMENTS` + `MAX_HEADER_ELEMENTS`
- **Objective**: 将单一 `MAX_ELEMENTS` 守卫（`declare.test.ts:55-96`，`:54` 是 `MIN_ELEMENTS = 20`）拆成两条正交门：**`MAX_BODY_ELEMENTS = 40`**（正文 home：section/facet/table/graph/task-*/design-body/conditional）· **`MAX_HEADER_ELEMENTS = 12`**（`frontmatter`/`header` home）。plan-wave 数值裁定（spec §2.3 授权实施 wave 定）：以 today overall 34 正文 / 5 头为基准 + 余量，落门 40 / 12；迁移后四型逐型 target total 42 / 31 / 27 / 16（`39−1+2+date+doc-type` · `28+3` · `25−1+3` · `13+3`）各自过双门——target 对账断言落 Task 5 元素数对账单（W3 登记表翻面后），本 task（W2）仅对 today 四型断言分侧计数。single-spec 16 < MIN 20 lightweight 豁免不变。
- **Files**: Modify `packages/cdd-engine/src-next/contract/__tests__/declare.test.ts`（MIN :54 · MAX :55-96 拆分）
- **Consumes**: Task 2（frontmatter home 名已立）；spec §2.3「元素数带上限」裁定（拆门、否决「抬 44」）。
- **Produces**: `MAX_BODY_ELEMENTS = 40` · `MAX_HEADER_ELEMENTS = 12`；对每型按 home 分侧计数断言：正文侧 ≤ 40、头部侧 ≤ 12；`\bMAX_ELEMENTS\b` 旧常量退休。
- **Steps**:
  - 拆分常量与断言（`MAX_ELEMENTS` 单计数 → 双常量 + 按 home 分侧计数的一对断言）— checkable: 拆分后 `pnpm -C packages/cdd-engine test declare` FAIL（旧单计数断言标注待删引用的失效——双门尚未接线）。
  - 全量替换旧常量引用并删旧——checkable: `grep -rn '\\bMAX_ELEMENTS\\b' packages/cdd-engine/src-next` 零命中。
  - 拆门机制对今日 live 计数验证：双常量接线 + 每型按 home 分侧计数（今日 overall 34 正文/5 头 · plan 22/6 · phase-spec 18/7 · single-spec 8/5，两侧各 ≤ 40 / ≤ 12）— checkable: `pnpm -C packages/cdd-engine test declare` PASS（双门对新常量成立）。**迁移后 42/31/27/16 的逐型对账不在本 task 断言**——它随 T5 改 declare.ts 才成立，由 T5 的「元素数对账单」步承接（见 T5）。
- **Acceptance**: 单门退休（`\bMAX_ELEMENTS\b` 零命中）、双门在册且对今日 live 计数判过；迁移后逐型对账 42/31/27/16 显式归 T5；single-spec lightweight 豁免保留。
- **DependsOn**: 2

### Task 5: 登记表翻面——23 行 header anchor 改 key + 11 新键 + Constraints 成对 + 投影四面涟漪 + 快照再生
- **Objective**: 按 §3.3 改名表把 23 行 header-home 元素 anchor **逐行**改为 YAML key 形态（21 改名 + 2 退休：overall `**Constraints**` 与 phase-spec `Depends on ref`）；新增 11 条 frontmatter key 行（`doc-type` ×4 · `date` ×4 · `parent-version` ×2 · `issues` ×1）；header 元素 `valuePattern` 全量重规格为 YAML 标量形状（plan-wave 裁定：**保留登记表 valuePattern、重规格为标量形态**——`version` → `^v\d+\.\d+$` · `date` → `^\d{4}-\d{2}-\d{2}$` · `status`/`doc-type` → 枚举元组 · 其余非空标量，DomainInvariant 由此判 head 值；择一方案「值形状判定整体移交 Extractor」不取——登记表仍为值形状唯一声明根，D26）；overall registry 新增 `## Constraints` section 行 + `Constraint delta bullet` body anchor 两行（成对声明）；投影四面（slices/schema/tokens/skeleton 分类键）对 `frontmatter`-home 改 key 查表；`project.test.ts` 五组 bullet-anchor 断言重锚。
- **Files**: Modify `packages/cdd-engine/src-next/contract/declare.ts`（改名表 · 11 新键 · `**Constraints**` :202-207 退休与新 section 两行 · `Depends on ref` :730-735 删除 · 全部 header valuePattern 重规格）· Modify `packages/cdd-engine/src-next/contract/project.ts`（`:422-461` schema/slices · `:464` tokens · `:497-522` skeleton · `:543-577` skeletonSlotOf——`frontmatter`-home 改用 YAML key 查表、对 header 腿停用 RegExp 编译）· Test `packages/cdd-engine/src-next/contract/__tests__/project.test.ts`（`:185-187` anchorPattern · `:310-327` link slot（`:318` home === "frontmatter"）· `:347-360` Status generator-truth · `:362-375` Version scaffold · `:377-386` truthAnchors 改用 key 形态或改写为 `declaredRegistries` 派生断言）
- **Consumes**: Task 2（frontmatter home）· Task 4（元素数双门）；spec §3.3 改名表 · §2.3 收编键表（逐型 presence · 129 标量对账）· §2.4 Constraints 成对声明。
- **Produces**: 登记表唯一声明根含全部头部事实（`home: "frontmatter"` 12 收编键 · 逐型 presence/valuePattern · overall 42 / plan 31 / phase-spec 27 / single-spec 16 元素）；`**Constraints**`/`Depends on ref` 退休；`## Constraints` + `Constraint delta bullet` 两行于 overall 在册（插在 `## Boundary rules` :252 与 `## Maintenance` :259 之间）。
- **Steps**:
  - 按 §3.3 表逐行改名 + 新增 11 键 + 2 退休 + overall Constraints 成对两行插入 — checkable: `grep -nE '\\*\\*(Version|Status|Author|Spec:|Parent program|Depends on|Base|Constraints)\\*\\*' contract/declare.ts` 零命中；`grep -n 'Depends on ref' contract/declare.ts` 零命中。
  - header 元素 `valuePattern` 重规格为 YAML 标量形状 — checkable: `pnpm -C packages/cdd-engine test declare` PASS（valuePattern 断言对新形状成立）。
  - 投影四面改 key 查表（slices 对 frontmatter-home 停用 RegExp 编译 · schema `pattern` 吐 front-matter 值形状 · tokens/skeletonSlotOf 分类键 = key）— checkable: `tsc --noEmit -p packages/cdd-engine` 过。
  - project.test.ts 五组断言重锚 — checkable: `pnpm -C packages/cdd-engine test project` PASS。
  - 逐型 presence/键集断言（plan 侧无 `status`/`author` 键、`issues` 仅 single-spec optional、`parent-version` optional）— checkable: declare.test.ts 断言与 §2.3 收编表逐条一致，PASS。
  - 元素数对账单 — checkable: `pnpm -C packages/cdd-engine test declare` PASS（每型 total 与 42/31/27/16 对表、过双门）。
- **Acceptance**: 23 行改名落定 + 11 键在册；`**Constraints**`/`Depends on ref` 零残留；overall registry 含 `## Constraints` 与 `Constraint delta bullet` 两行、`issues` 键在册（single-spec optional）；header valuePattern 全为标量形状。
- **DependsOn**: 2, 4

### Task 6: 解析/判定/读点翻面——`parse(lines, head)` 双参 · 判定通道 typed record · 三处裸行版本读点 · `ChainLink.label` 退休 · INPUT_SPEC 双参
- **Objective**: §2.2/§1.3 的投递缝与判定通道翻面：四个 `parse(lines, head: FrontMatterHead | null = null)` 同签名，`ParsedDoc` 四型各增 `head`，`title` 改 `head?.title ?? ""`，`chainRoot` 的 `parentTokens`/`parentLink`/`specLink`/`dependsOn` 改读 head 标量（`parentTokens = head.parentVersion === null ? [] : [head.parentVersion]`）；`Contract.validate`（`judge.ts:93-112`）切分序 = RAW 原串先 `FrontMatterExtractor` 提取 → fence 后正文行再 canonicalize 成 `lines`，同一 `head` 同投 `parse(lines, head)` 与 `JudgeContext.head`；front-matter-home 元素的 presence/domain/`#headerVersion` 判改读 typed record（**不走** `lineCarries`/`occurrenceLines`）；三处裸行版本读点重指（`#headerVersion` `:944` · `#parentLineage` `:1236-1250` 改读 parent overall `head.version` · `gate.ts#docVersionOf` `:161-169`）；`ChainLink.label` 字段整面退休（`doc.ts:98-103` 值对象只带 `target`，`#linksOnLine` 停产 label）＋两处标签漂移判退休（`invariants.ts:1166` · `lint.ts#crossDocDriftWarns` `:234-242`）＋两文件用例改写为「漂移不再产 finding」；head-required 调用点 `face/cli.ts:773` 同批双参 parse。
- **Files**: Modify `packages/cdd-engine/src-next/contract/doc.ts`（parse 四覆写 · ParsedDoc 四型 · chainRoot :624/:701 · ChainLink :98-103 · `#linksOnLine`）· Modify `packages/cdd-engine/src-next/contract/judge.ts`（validate 切分序 + 双参投递）· Modify `packages/cdd-engine/src-next/contract/invariants.ts`（JudgeContext head :95-127 · presence/domain 通道 :276-299/:450-477 · `#headerVersion` :944 · `#parentLineage` :1236-1250 · 标签漂移判 :1166）· Modify `packages/cdd-engine/src-next/contract/lint.ts`（:234-242）· Modify `packages/cdd-engine/src-next/face/gate.ts`（:161-169）· Modify `packages/cdd-engine/src-next/face/cli.ts`（:773）· Test `contract/__tests__/judge.test.ts`（:623-632 改写零 finding）· `lint.test.ts`（:225-267 改写零 finding）· `doc.test.ts`（:147 title 断言重锚到 front-matter 头形态、断言不等于 `"---"`）· `face/__tests__/cli.test.ts`（:1785/:1819 INPUT_SPEC 保活）
- **Consumes**: Task 1（FrontMatterHead/Extractor）· Task 3（parse 输出形状稳定）· Task 5（anchor=key 登记表 + 判定所需 valuePattern 标量化）。
- **Produces**: `parse(lines, head)` 双参契约（`doc.ts` doc comment 写明「chainDocs 生产者必须双参 parse」· §2.2 投递缝 (3)）；`ParsedDoc.head` · `JudgeContext.head`；`ChainLink` 只带 `target` 的值对象；三处版本读点全走 head 标量；`cli.ts:773` 双参（`FrontMatterExtractor` 于 planText 原串 → fence 后行 × head → `parse`）。
- **Steps**:
  - 写 failing 判定 pin（judge.test.ts）：构造 front-matter 头，①缺 `status:` 键 → presence finding；②`status: Bogus` → domain finding — checkable: FAIL（当前行扫通道对 front-matter-home 无法正确判）。
  - `parse(lines, head)` 双参与 ParsedDoc.head / title / chain 读点迁移（doc.ts）— checkable: `grep -n 'const title = lines\\[0\\]' contract/doc.ts` 零命中。
  - validate 切分序 + JudgeContext.head 填充；front-matter-home 元素判序改 typed record（presence/domain/`#headerVersion`）— checkable: step 1 双 pin 转绿且 presence/domain 各产恰一 finding。
  - 三处裸行版本读点改 front-matter 标量（`#headerVersion` / `#parentLineage` 读 parent.head.version / `#docVersionOf`）— checkable: `grep -n '\\*\\*Version\\*\\*' contract/invariants.ts face/gate.ts` 零命中。
  - `ChainLink.label` 退休 + `#linksOnLine` 停产 label + 两处漂移判退休；lint/judge 漂移用例改写为「漂移不再产 finding」— checkable: `grep -n 'label' contract/doc.ts` 零命中（值对象只留 target）；`pnpm -C packages/cdd-engine test lint judge` PASS（改写后用例各断言零 finding）。
  - doc.test.ts:147 title 断言重锚 + cli.ts:773 双参 — checkable: `pnpm -C packages/cdd-engine test doc cli` PASS（`:1785/:1819` 的 `INPUT_SPEC: docs/kairos/specs/p3-design.md` 断言原样通过）。
- **Acceptance**: head-optional 六处调用点（cli.ts:508/:695/:805 · board-view.ts:558 · preflight.ts:153 · brief.ts:61）保持单参（默认 `null`）、head-required 一处（cli.ts:773）双参；判定通道对 front-matter-home 走 typed record；`ChainLink` 无 label；`**Version**` 两文件零残留；漂移判退休行为断言零 finding；`#parentLineage` 读 parent.head.version。
- **DependsOn**: 1, 3, 5

### Task 7: 骨架吐 front-matter 头——占位符三分类 + `#assertConsumed` 缩 body + Constraints 合成
- **Objective**: `SkeletonAssembler` 头部段改吐 front-matter（`yaml.stringify` 一次成块，独立行集、不走 slot/probe 通道、`#assertConsumed` 覆盖域收缩为 body slots）；§4.2 占位符三分类（link 型键 `spec`/`parent-program` 发 `<…>` 形态走 `isPlaceholder` 豁免 · content 型键 `title`/`author`/`base`/`depends-on` 发 `:::fill <key>` · `parent-version` **不发射**——optional shape-typed 键，`:::fill` 与 `<…>` 两形都过不了 `^v\d+\.\d+$`）；`#renderOverallSpec` 在 `skeleton.ts:163`(`## Boundary rules`) 与 `:164`(`## Maintenance`) 之间补 `## Constraints` + `Constraint delta bullet` 合成位（先补行后补 bullet 会触发 `#assertConsumed` 抛错——三处同序 tripwire）；骨架字节跑 `Contract.validate` 零 finding；死头字面量退休（`HEADER_FORMS` :32 · `LINK_SLOTS` :45 · `TRUTH_LINES["**Status**"]` :59 · `#headerLine` Status 分支 :287-289）；skeleton 测试 pin 改写（`:452-462` 重写为 front-matter 键序 · `:307-315`/`:390-399` 断言扩到 front-matter 块 · `:464-482` 用例体不改注释同步）。
- **Files**: Modify `packages/cdd-engine/src-next/render/skeleton.ts`（front-matter 行集发射 · `#assertConsumed` :130-144 body-only · `#renderOverallSpec` :154-166 补 Constraints · 死头字面量退休）· Modify `packages/cdd-engine/src-next/contract/project.ts`（`#projectDocSkeleton` :497-522 / `#skeletonSlotOf` :543-577 的 front-matter-home 分类键已为 key——配合渲染器独立发射）· Test `render/__tests__/skeleton.test.ts`
- **Consumes**: Task 5（登记表 frontmatter-home 槽位 = key · `doc-type`/`base` 在册）· Task 6（骨架自过 `Contract.validate` 走双参通道）。
- **Produces**: 四型 skeleton = front-matter 头（`yaml.parse` 键集与注册表 frontmatter-home 槽位一致）+ markdown body；骨架自过契约零 finding；`schema get <type> --output skeleton <target>` 输出 = front-matter 头 + body。
- **Steps**:
  - `#renderOverallSpec` 补 `## Constraints` + `Constraint delta bullet` 合成位（Boundary rules 与 Maintenance 之间，与登记表插入点同序）— checkable: 单独渲染 overall 骨架触发 `#assertConsumed` tripwire（「skeleton composition emits the unregistered anchor」）——只加 section 行不加 bullet 行的缺陷第一次显形。
  - 头部段改 `yaml.stringify` front-matter 行集（truth 键：`doc-type`/`version`/`date`/`status` · content 键 `:::fill <key>` · link 键 `<…>` · `parent-version` 省略）+ `#assertConsumed` 覆盖域收缩为 body slots + 死头字面量退休 — checkable: `pnpm -C packages/cdd-engine test skeleton` PASS（含 `:413-417` 四型 `#assertConsumed` 不抛的 tripwire 用例——注释点明其同时是 overall Constraints 三处同序 tripwire）。
  - 新增「骨架字节跑 `Contract.validate` 零 finding」pin（四型各 0）— checkable: 渲染四型逐型 validate 均 0 finding。
  - front-matter 块内 `:::fill` 断言（truth 键不得含 `:::fill` · content 键必须含）扩入 + `:452-462` 重写为 front-matter 键序（`doc-type` 与 `version` 相对次序）— checkable: `pnpm -C packages/cdd-engine test skeleton` PASS。
  - 死头字面量零残留 — checkable: `grep -n '\\*\\*Version\\*\\*:\\|\\*\\*Status\\*\\*' render/skeleton.ts` 零命中。
- **Acceptance**: 四型骨架 front-matter 头 + body 保留 · 占位符三分类落实（`parent-version` 不发射）· `#assertConsumed` body-only · Constraints 三处同序 · `**Version**`/`**Status**` 骨架零残留 · 骨架自过契约零 finding。
- **DependsOn**: 5, 6

### Task 8: 引擎夹具同批迁移——bullet 字面量三线并集 14 文件 + 4 不可见 plan 夹具 + CONFORMING_SPEC · 波末全绿
- **Objective**: §5.1 第一类 bullet 字面量夹具全量改 front-matter 头（Version 线 44 行/9 文件 · Doc type 线 77 行/5 文件 · 其余登记头字面量族并集 **14 个测试文件**，其中 **4 个只带 `**Spec:**` + `- **Parent program**:`、对 Version/Doc-type 两条 census 不可见**的 plan 夹具显式在册）；`preflight.test.ts` 的 `CONFORMING_SPEC`（`:120-149`）改 front-matter 头 + `## Design` 起始正文；**波末（T8 结束）恢复 engine 套件全绿**——T5 起登记表/anchor 翻面造成的红窗口在此关闭。
- **Files**: Modify 三线并集 14 个测试文件（`contract/__tests__/doc.test.ts` · `judge.test.ts` · `lint.test.ts` · `face/__tests__/board-view.test.ts` · `capsule.test.ts` · `cli.test.ts` · `render/__tests__/skeleton.test.ts` · `render.test.ts` · `smoke.integration.test.ts` · `session/__tests__/preflight.test.ts` · `graph.test.ts` · `run.test.ts` · `wave.test.ts`）——第 14 个由 grep 并集结果确认；头部夹具行改 front-matter 元组（`---` + 键值 + 正文），4 个 plan 夹具补 `version`/`date` 与 chain 字段。
- **Consumes**: Task 6（判定通道已读 typed record——夹具迁移后判官方可判）· Task 7（骨架已吐 front-matter——`CONFORMING_SPEC` 迁移后仍零结构 finding）。
- **Produces**: 全部夹具头部进 front-matter；`CONFORMING_SPEC` 在 front-matter 形态下维持「零结构 finding」；engine 套件全绿红线（T9/T10/T11/T12 均依赖它）。
- **Steps**:
  - 迁移前 census 基线复测（三线计数入此 task 记录）— checkable: `grep -rn --include=*.test.ts -F -- '- **Version**:' packages/cdd-engine/src-next` = 44 行/9 文件。
  - 14 文件头部夹具批量改写（含 4 个 plan 夹具补 `version`/`date`/`spec`/`parent-program` 键与正文 H1 删除）— checkable: 迁移后两条 census 零命中（`- **Version**:` 与 `- **Doc type**:` 各 0）。
  - `CONFORMING_SPEC` 改写 — checkable: `pnpm -C packages/cdd-engine test preflight` PASS（该向量零结构 finding，`readDocType` 从 front-matter 读回 `phase-spec`）。
  - 波末全绿 — checkable: `pnpm -C packages/cdd-engine test` 全 PASS（engine 套件恢复全绿，中间态红窗口关闭）。
- **Acceptance**: bullet 头测试夹具零残留（三线 grep 零命中）；4 个 `**Spec:**`/`- **Parent program**:` plan 夹具已进 front-matter；CONFORMING_SPEC 零 finding；engine 套件全绿。
- **DependsOn**: 6, 7

### Task 9: 死码收口 + 结构 pin——(a)(b)(d) 同一条用例 · doc.ts 命中总量 7
- **Objective**: §4.1 死头代码全部删除——`headerLines` 生产者（`doc.ts:363`）与四个 `parse` 消费点（:502/:602/:641/:720）· `markerLine`（:449-452）与其调用家族（:615/:617/:619 · :694/:696 · :733）· `markerValue`（:455-459 与 :626/:703/:740）· `doc.ts` 的 `ParsedDoc.title` 四处 `lines[0]`（已随 Task 6 title 走 head 标量，此处整删）· `face/board-view.ts` 的 `#headerLinesOf`（:641）/`#docTypeOf`（:655）/`readHeader` 两条裸读（:176-183，改读 `FrontMatterExtractor`）；§6 结构 pin **退役集 (a) + 保留集 (b) + 登记表侧 (d) 合进同一条用例**：退役 7 条（`:382 :407 :425 :459 :576 :676 :683`）逐条零命中 · 保留集 = 6 声明原语 / 7 落点（heading-rank :481 · table split :276+278 · 链接文法 :248 · 版本 token 文法 :261 · 图边文法 :539 · 已声明 valuePattern 的应用 :476+改写后 #phaseId）按**集合相等**断言（词表含 `.test(` 与 `.replace(`，断言对象是原语身份非行号）· (d) `home === "frontmatter"` 的 anchor 全集 ⊆ §3.3 key 集且无 bullet/heading 字面量、`Depends on ref` 零命中。**迁移后 `doc.ts` 原语命中总量 = 7**（= 6 原语 7 落点）。
- **Files**: Modify `packages/cdd-engine/src-next/contract/doc.ts`（死成员整删）· Modify `packages/cdd-engine/src-next/face/board-view.ts`（readHeader/readDocType 改读 front-matter · `#headerLinesOf`/`#docTypeOf` 退休）· Test Create `packages/cdd-engine/src-next/contract/__tests__/structure-pin.test.ts`（(a)(b)(d) 一条用例）
- **Consumes**: Task 6（`#parentLineage` 已改读 parent.head.version——`headerLines` 最后读者消失）· Task 8（夹具迁移后 shape 断言稳定）。
- **Produces**: 结构 pin 一条用例（退役集 + 保留集 + 登记表 key 集三断言同置，任一侧单看即实现的缺陷被互补断言捕获）；`doc.ts` 原语命中 = 7。
- **Steps**:
  - 死头成员整删（doc.ts headerLines/markerLine/markerValue 家族与消费点 · board-view `#headerLinesOf`/`#docTypeOf` · readHeader 裸读改 `FrontMatterExtractor`）— checkable: `tsc --noEmit -p packages/cdd-engine` 过；`grep -n 'headerLines\|markerLine\|markerValue' contract/doc.ts` 零命中。
  - 结构 pin 用例（(a) 退役 7 条零命中、(b) 保留 6 原语集合相等、词表含 `.test(`/`.replace(`、(d) frontmatter key 集）合成一条 — checkable: 新用例 PASS（退役集任一残留或保留集任一缺失即 FAIL）。
  - `doc.ts` 命中总量断言 = 7 — checkable: `grep -cE 'RegExp|\\.match\\(|\\.matchAll\\(|\\.split\\(|\\.test\\(|\\.replace\\(' contract/doc.ts` 输出 7。
- **Acceptance**: 死头成员生产符号零残留；结构 pin (a)(b)(d) 一条用例绿；doc.ts 原语命中恰 7（6 原语 7 落点）。
- **DependsOn**: 8

### Task 10: 语料一次性迁移——21 篇脚本跑完即删 · 五卡口 · 续行剥两格 · 单提交
- **Objective**: 写**一次性 Node 迁移脚本（不入仓·跑完即删）**，对迁移时刻在册的 **21 篇**（`docs/kairos/specs/*.md` 11 = 1 overall + 10 phase-spec design 含本 p10 design · `docs/kairos/plans/*.md` 10 = 9 + 本 p10 实施计划）执行 §5.1 迁移：头部元组 → front-matter（一律 `yaml.stringify` 发射、零拼串）、正文 H1 删、`parent-version` 从 4 条带 token 的 `**Parent program**` 行提取（无 token 的 15 条不产出该键）、overall `**Constraints**` 10 行续行（两格缩进）剥两格搬为 `## Constraints` 正文 bullet（落位 `## Boundary rules` 与 `## Maintenance` 之间 · 文案字节与行序零改）、非元组头部行逐字节透传（当前 0 条/0 篇）、`Issues` 收编分支（当前 0 条，由单元用例钉「旧形头行 → `issues:` 键」）。**五卡口**：`[` 起首 `author` 3 · 链接形 30 · 截断类 0 · 非元组头 0 · 续行 10 行/1 篇。回环断言 `yaml.parse(yaml.stringify(head))` 逐篇深相等。**迁移结果 = 一个独立 commit**（Mid-Flight Backfill 纪律 · §5.1 一次提交）。
- **Files**: Script：`.tmp-p10-migrate/`（一次性）· Modified `docs/kairos/specs/*.md`（11）+ `docs/kairos/plans/*.md`（10）· Test `packages/cdd-engine/src-next/contract/__tests__/corpus-form-pin.test.ts`（常驻：21 篇逐篇首行 `---` · `yaml.parse` 键集 = 各自 registry frontmatter-home 集 · 头部元组零命中 grep · 「迁移前后 finding 集合逐条同集」守真判据；脚本删除后由它守住 §5.1/§6 形态 pin）
- **Consumes**: Task 8（引擎套件全绿、判定面干净——迁移前后 finding 集合同集的判压基线成立）；**Task 9**（`BoardView.readDocType`/`readHeader` 重指 front-matter `doc-type`——迁移语料的判压与 board 视图都经它读型，T9 必须先于本 task）；**当前树干净**（本 plan 与前期 commit 已落，见 commit-plan）；p10 plan 自身迁移前的 0-finding 基线已在本 plan 自检阶段实测。
- **Produces**: 21 篇 front-matter 化落盘的单个 commit；语料形态 pin 常驻（脚本删除后持续守住迁移结果）；`parent-version` 4 条在册。
- **Steps**:
  - 写迁移脚本（globs 扫 21 篇 · 按注册表 frontmatter-home 键集发射 · 三类非法形状卡口计数 · 续行处理 · 非元组透传）— checkable: 干跑（`--dry-run`）输出三卡口 = 3 / 30 / 0。
  - 迁移 + 回环断言逐篇（`yaml.parse(yaml.stringify(head))` 与原 head record 深相等）— checkable: 21 篇回环全通；`[` 起首 3 处与链接形 30 处值 shape 正确且不丢字节（link 形按 §2.1 只保 target、label 主动退休）；产标量总计与 §5.1 对账 = 134（`version` 21 + `date` 21 + `status` 11 + `author` 11 + `parent-program` 20 + `depends-on` 13 + `spec` 10 + `base` 2 + `parent-version` 4 + `doc-type` 21）。
  - `**Constraints**` 续行剥两格搬移 + 落位 Boundary rules/Maintenance 之间 — checkable: `git diff` 该块逐行 `trimStart()` 后字节 diff 零差异（文案仅缩进）；迁移后 overall 的 `## Constraints` 体行全部命中 `^- `。
  - 非元组头部行透传核对 — checkable: 迁移前后非元组头集合逐行 diff 零差异（0 条/0 篇计数卡口）。
  - 迁移后逐篇 `Contract.validate` 零 finding + finding 集合同集判定（基线 0 → 迁移后 0）— checkable: 21 篇全部 0 finding。
  - 单元用例：`Issues` 收编分支（构造旧形 `Issues（收口时关闭）` 头行 → 迁移后落 `issues:` 键）— checkable: 用例 PASS。
  - 脚本删除 + 语料形态 pin 常驻入 engine suite + 单个 commit — checkable: `.tmp-p10-migrate/` 零残留；`git status` 只余迁移 diff；`git add docs/kairos + commit` 一次。
- **Acceptance**: 21 篇 front-matter 化（首行 `---` · yaml.parse 键集 = 注册表 frontmatter-home 集 · 引擎 board/review 判压全绿）；五卡口达标（3/30/0/0/10 行 1 篇）；脚本不入仓；一次性 commit；形态 pin 常驻。
- **DependsOn**: 8, 9

### Task 11: 判定回归——版本血缘 / 父血缘 / presence / domain / RAW 五用例 + INPUT_SPEC 保活
- **Objective**: §6 判定回归 pin 落成常驻 engine suite——①版本血缘判 negative（`SelfBoundedInvariant`：头 `version:` 落在 Change-history 血缘之外仍产 finding，构造 front-matter 头 + 不含该版号的 Change-history 表）；②父血缘判 negative（Class-B：`parent-version:` token 不在 parent 血缘仍产 finding，单位级 `ContractInput` + 注入 `chainDocs`（`{parentLink.target → OverallParsed}`），走 `judge.ts:49/:106` 的 chainDocs 缝、`parse` 双参——生产接线（preflight 装配 chainDocs map）不在本 phase 面）；③presence negative（缺 `status:` 键 → presence finding）；④domain negative（`status: Bogus` → domain finding）——③④证明判定确走 `FrontMatterExtractor` typed record 而非被行扫真空满足；⑤RAW 提取 positive（head 值含已登记中文别名如 `组` 时，`Contract.validate` 提取结果与源串逐字相同、同用例正文仍 canonicalize，断言两侧）。**INPUT_SPEC 保活**（head-required 调用点的行为断言）：`cli.test.ts:1785` / `:1819` 仍解析出 `- \`INPUT_SPEC\`: docs/kairos/specs/p3-design.md`——用例体不改、随 `cli.ts:773` 双参迁移自动覆盖。
- **Files**: Modify `packages/cdd-engine/src-next/contract/__tests__/judge.test.ts`（①②③④⑤落点：invariants/judge suite）· Test `face/__tests__/cli.test.ts`（INPUT_SPEC 保活——用例体不改，Task 6 已量证）
- **Consumes**: Task 8（夹具全绿基线）· Task 6（判定通道已 typed record、chainDocs 双参缝形状已定）。
- **Produces**: 迁移后判压的常驻回归面（脚本删除后 §5.1/§6 的「判定仍触发」由它持续守住）；RAW 通道逐字保真被钉。
- **Steps**:
  - 版本血缘 negative — checkable: 构造 front-matter 头（`version: v9.9`）+ 不含该版号的 Change-history → `SelfBoundedInvariant` finding ≥1。
  - 父血缘 negative（chainDocs 双参缝注入）— checkable: `classB` finding ≥1 且 `:1216` 早退未现（`parentTokens` 非空）。
  - presence / domain negative 两条 — checkable: 缺 `status:` 键 → 恰一 presence finding；`status: Bogus` → 恰一 domain finding。
  - RAW positive — checkable: head 值含 `组` 时提取逐字同源 + 正文行 `TaskGraph 分组派生` 被 canonicalize 为 `分group派生`，两侧同用例断言。
  - INPUT_SPEC 保活 — checkable: `pnpm -C packages/cdd-engine test cli` PASS（`:1785`/:1819 断言原样为 `INPUT_SPEC: docs/kairos/specs/p3-design.md`）。
- **Acceptance**: 五用例 + INPUT_SPEC 保活全绿（engine suite）；`findings` 面行为断言（漂移零 finding）已在 Task 6 落定。
- **DependsOn**: 8

### Task 12: 消费面同步——skills + 引擎输出键化 + 两份 changeset + emit
- **Objective**: §5.2 消费面同步（major breaking · 零 legacy 兼容）：plan 头约定键化——`cdd-plan/SKILL.md:44`（原 `**Spec:**` on line 2 → `spec:` front-matter key，与 review `--spec` 指针同源）· `cdd-report/SKILL.md:37`（program-attribution 第一跳表述同步）· pin 测试 `packages/kairos/tests/cdd-plan-spec.test.ts:30-39` **重锚不删**；引擎输出同步——`words.ts:100-101` `routeWords.docType` BLOCKED 文案改 front-matter 表述（`doc-type:` 键 + 枚举）＋三处 pin 文案重锚（`cli.test.ts:1971` · `capsule.test.ts:279` · `preflight.test.ts:443`）· **finding 面键化**：`Finding.field` 十处 anchor 字面量（invariants.ts:901/911/1022/1024/1030/1161/1170/1180/1199/1225）值改 front-matter key 或 key 派生显示形、固定 message 去 `**…**`、五测试文件字段位引号字面量重锚至 key 形态（judge · project · doc · cli · lint 五文件，均在 T8 并集内；覆盖判据 = 重锚后套件全绿、遗留任一字段位 `**…**` 即 FAIL，弃裸计数）· `render/templates.ts:325` axesGuide 的 `**Spec:**` anchor 表述改「the plan's `spec` front-matter target」+ 同批 grep（迁移后引擎源码 `the plan's \`**Spec:**\` anchor` 零命中，不新增 prompt 文本 pin）· 两份 changeset（cdd-engine **major breaking** 落 pending · kairos skill 同步）· `pnpm run emit` 产物再生成。
- **Files**: Modify `packages/kairos/skills/cdd-plan/SKILL.md` · `packages/kairos/skills/cdd-report/SKILL.md` · `packages/kairos/tests/cdd-plan-spec.test.ts` · `packages/cdd-engine/src-next/face/words.ts`（:100-101）· `packages/cdd-engine/src-next/render/templates.ts`（:325）· `packages/cdd-engine/src-next/contract/invariants.ts`（Finding.field/message 键化）· 五测试文件字段位引号字面量断言重锚 · Changeset `.changeset/<slug>.md` ×2 · 再生成产物随 `pnpm run emit`
- **Consumes**: Task 5（anchor=key 在册）· Task 6（finding 面键化后的判定）· Task 7/8（skeleton 与夹具已 front-matter——BLOCKED 文案/pin 说的形态已换）。
- **Produces**: 消费面与引擎输出零 bullet 头字面量形态；BLOCKED 文案、axesGuide、skill 文本全部 front-matter 表述；changeset ×2（cdd-engine major 落 pending · kairos）；emit 产物 fresh。
- **Steps**:
  - skill 文本 + cdd-plan-spec pin 测试重锚 — checkable: `grep -n '\\*\\*Spec:\\*\\*' packages/kairos/skills packages/kairos/tests` 零命中（`spec:` 键形态替代）；`pnpm -C packages/kairos test cdd-plan-spec` PASS。
  - 引擎 BLOCKED 文案 + finding 面键化（words.ts · Finding.field/message · 字段位引号字面量断言重锚）— checkable: 非测试生产文件 grep 零残留（`grep -rnE '\\*\\*(Version|Status|Author|Spec:|Parent program|Depends on|Base)\\*\\*' packages/cdd-engine/src-next --include='*.ts'` 排除 `__tests__` 退役/改写清单外零命中）；三处 BLOCKED pin 文案同步 PASS。
  - axesGuide 改写 — checkable: `grep -rn 'the plan.s \\*\\*Spec:\\*\\* .anchor' packages/cdd-engine/src-next` 零命中。
  - changeset ×2 + emit — checkable: `.changeset/` 下两份新 md 内容正确（cdd-engine major breaking · kairos）；`pnpm run emit` + `pnpm run emit:check` 无漂移。
  - kairos suite 全绿 — checkable: `pnpm -C packages/kairos test` PASS。
- **Acceptance**: 消费面/引擎输出零 bullet 头字面量形态；双 changeset 在册（不发布 · 落 pending）；emit 产物 fresh；kairos suite 全绿。
- **DependsOn**: 8

### Task 13: 全量验证收口 + AC 逐条对账
- **Objective**: 全量验证矩阵收口——`pnpm run validate`（emit:check · 根 vitest · kairos suite · engine 黑盒用例 · typecheck ×3 · version-sync · check:no-bare-functions）全通过；引擎 `board 2026-10-10-engine-doc-tooling-p10` 对在册 21 篇判压全绿；AC 逐条对账（一项一 owner pin，含 §2.3 129 标量 vs §5.1 对账 · 四型元素数 42/31/27/16 过双门 · 死头零残留 · 骨架自过契约 · 迁移同集 · 零裸函数 · EOF 恰一 newline · English-primary）。**本 phase 全绿终态**，不发布。
- **Files**: 无产物改动（纯验证/对账；若对账发现缺口 → 按失败面处理）
- **Consumes**: Task 9（结构 pin）· Task 10（语料落盘 + 形态 pin）· Task 11（判定回归）· Task 12（消费面 + changeset + emit）。
- **Produces**: 全绿基线 + AC 逐条对账记录（每条引用 owner task 的 pin 断言）；可发布态（不发布）。
- **Steps**:
  - `pnpm run validate` 全量 — checkable: 全 PASS（含 engine 黑盒用例套件）。
  - `node packages/cdd-engine/src-next/bin.ts board 2026-10-10-engine-doc-tooling-p10` — checkable: 21/21 零 finding。
  - AC 逐条对账（129 标量算术 · 元素数双门 · 结构/形态/判定 pin · 消费面形态）— checkable: 每条 AC 映射到所属 task 的 pin 断言且全绿。
  - 零裸函数 + EOF + English-primary 收口 — checkable: `grep -rnE '^export function|^function' packages/cdd-engine/src-next packages/kairos/skills` 零命中；每文件 EOF 恰一 newline；SKILL.md / `docs/*.md` 无中文。
  - 若对账出现非绿项 — checkable: 按 I1 fix 轮派发（engine `fix` 命令），完成后复跑本 task 全量验证至全绿。
- **Acceptance**: `pnpm run validate` ALL PASS · board 全绿 · AC 每一项有 owner pin 且绿 · 不发布。
- **DependsOn**: 9, 10, 11, 12

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.4 | 2026-10-18 | **front-matter 形态契约 backfill（D1/D2/D3 · github#341/#342 并入 P10 收尾 · 用户裁定 2026-10-18 立即独立一提交）**：engine 侧三面统一落地（standalone commits 96034c1 + 4aa973a）——① **D1 解析错误携位（#341）**：`FrontMatterExtractor.split` 捕获分支型化 `YAMLParseError`（经 `LineCounter` 喂 `linePos`）为 `FrontMatterParseError{line, column, reason, source}` 挂 head（`contract/frontmatter.ts`），pre-flight 报「not valid YAML: {reason} on line {line}, column {column}」BLOCK 而非误判「no doc-type」（`session/preflight.ts` · `face/words.ts` `routeWord "frontmatterParse"`）；② **D2 链接 target 形态见型（#342）**：`LinkTargetShape` 值类（`contract/invariants.ts`）一规则判——裸相对路径合法 / `[l](p)`·`://`·空白·`()[]<>` 拒绝，`LinkShapeInvariant`（kind `"link-shape"`）为唯一格式报告者、resolution 面静默 continue，`chainRoot` 不再以 `{target: 原始字符串}` 提交（`contract/judge.ts` 策略序）；③ **D3 骨架同源**：`render/skeleton.ts` 头部段改 `yaml` node API 焊接（`YAMLMap`+`Pair`+`Scalar` · content 槽 `Scalar.QUOTE_SINGLE` 强制单引号 · link 槽裸 `<docs/kairos/specs/…-overall.md>` 示例），占位符即头部形状规约。同步 spec v0.9（§2.1/§2.2/§4.2 · 版本键 v0.8→v0.9）· 本 plan 版本键 v0.3→v0.4 · changeset 并入 p10 frontmatter-head-major（单 major release）。 | Oscar M. · Claude Opus 5（orchestrator backfill · 2026-10-18） |
| v0.3 | 2026-10-18 | **backfill（Task 10 review-1 nit 收口 · 用户裁定 2026-10-18 立即独立一提交）**：Task 10 卡口算术对账更新至迁移时刻 census——链接形 28→30（parent-program 20 + spec 10）· 产标量 129→134（version/date/doc-type/spec/parent-program 各 +1 · 随本 p10 plan 自身在册成 21 篇）· 干跑三卡口 3/28/0→3/30/0 · 验收 3/28/0/0/10→3/30/0/0/10；与 corpus-form-pin census 一致。 | Oscar M. · Claude Opus 5（orchestrator backfill · 2026-10-18） |
| v0.2 | 2026-10-17 | **plan-fix-1（plan-review-1 findings 收口 · 2 warn + 2 nit · 零 blocker）**：① warn（buildability）——Task 4（W2）的 42/31/27/16 迁移后对账断言移出本 task（随 T5 改 declare.ts 才成立），步骤 3 只做双常量 + 分侧计数判 today live 计数（overall 34 正文/5 头 · plan 22/6 · phase-spec 18/7 · single-spec 8/5），消除 W2 红落在声明红窗口（T5–T8）之外的越窗断言；② warn（buildability）——Task 10 DependsOn 增 9（readDocType/readHeader 的 front-matter 重指向仅在 Task 9，须先于语料判压与 board 视图落位），Consumes 同步列 Task 9，波次随边重列（八波 → 九波：W7={9,11,12} · W8={10} · W9={13}）；③ nit（completeness）——Task 12 弃「24 处引号字面量」裸计数、改覆盖判据（judge · project · doc · cli · lint 五文件字段位引号字面量重锚至 key 形态，重锚后套件全绿、遗留任一字段位 `**…**` 即 FAIL），Objective/Files/Step 同位改写；④ nit（completeness）——Constraints「变更先回填 parent overall」标注 spec 阶段已 discharge（D48 语义回填 + 用户裁定 backfill 提交），对格式迁移不适用。 | Oscar M. · Claude Opus 5（kairos:cdd-plan [P10] plan-fix-1） |
| v0.1 | 2026-10-17 | 初稿：P10 实施计划——front-matter 迁移 13 任务 8 波（W1={1,2,3} · W2={4} · W3={5} · W4={6} · W5={7} · W6={8} · W7={9,10,11,12} · W8={13}）。源 spec v0.8；三条 plan-wave 裁定（declare.test.ts HOME_VALUES 副本保副本改名 · header valuePattern 保留在册重规格为标量形 · 双门数值 40/12）；中间态红窗口 T5–T8；本 plan 自身为 T10 迁移对象。 | Oscar M. · Claude Opus 5（kairos:cdd-plan [P10]） |
