# 消费者面一致性（Consumer Parity）P3 实施计划 — 本仓校验面重建
**Spec:** [2026-09-21-consumer-parity-p3-design.md](docs/kairos/specs/2026-09-21-consumer-parity-p3-design.md)

- **Parent program**: [2026-09-21-consumer-parity-overall.md v1.17](../specs/2026-09-21-consumer-parity-overall.md)
- **Depends on**: P2（shipped，PR #272 `39ed65a8`）；P3 design v1.2 Approved（`db48a64e`，spec-review-5，blocker=0）
- **Base**: develop（finishing read-base 数据源；consumer-parity-p3 工作分支）

## Constraints

### 口径

P3 是**本仓校验面重建 phase（允许破坏性变更）**：repo 侧四表守卫整体退役（S1/S2 + 42 用例 + canary-dogfood）· validate 接线净化（零四表 block、steps 12→11、全语义名零编号 anchor）· canonical phase-id 语法严格 A（`^P\d+(\.\d+)*$`）· S3 残留簇改写 · consumer-sim 升级挂 release 门 · skills 输出零过滤 + fix 边界条款 · docs-family 命令出口统一（结果可见性 + exit.ts 出口单源）· 运维规范落档。**判据面唯一实现 = engine lifecycle（dispatch 运行时 + engine 套件）——repo 侧零第二触发点**；engine 判据不动，只删 repo 侧（C1/C3）。所有 engine 改动 `pnpm run validate` 11 块全绿 + `emit:check` 零 drift + engine vitest 全绿。engine 零文档写入（overall 回填由 orchestration 执行，closeout 折叠 S3 改写）。SKILL.md / docs / docs/maintainers 英文主源；本 plan 中文（Strategy B）。**changeset：P3 不建**——版本化发布归 P4（overall §4 输入 = `.changeset ×2`）；P3 对发作面（schema patterns / stdout 结果面 / prepare 移除）随既有 `consumer-parity-p2-major.md` changeset 在 P4 版本化（P4 若判定需补记，P4 任务承载）。

**计划期决策（design 授权 plan 定，记录第一类）**：
- D1（§2.6 fixture 二选一）→ **临时仓内生成**：consumer-sim 从安装面 schema/templates 派生一份合法 plan 写入 mkdtemp（不把 smoke-plan 移入 `templates/`——不向消费者包面塞 engine 测试 fixture；同时实证「schema→authoring」消费者路径）
- D2（§2.9 exit.ts 命名）→ 补 **`exitOkWith(resultLine: string): never`**（成功 + stdout 结果面一次调用）；result 面 line 由共享 helper 构建；docs-family review/fix 完成三处出口统一
- D3（AC4 探针二选一）→ **前缀锚定探针 + node 断言**落 `ci-validate.test.mjs`（探针 `(?:^| )\b(?:[0-9]+\.|5b\d*|5c|8-10)[. ]+[A-Za-z(]` 对 step-name 面零残留 + 现名全命中/语义名全 miss 防白绿）
- D4（§2.6 prepare 移除的接线变化）→ engine vitest 增 `globalSetup`（`dist/cli.mjs` 缺则显式 `dev:stub`，独立面自给；validate 5b0 已覆盖 CI 面）

### commit 边界机制

dispatch 两端门——入口门（进入 review 前工作树干净）+ 出口门（产生修改的 dispatch 后修改已提交）。跨任务连续性：T1 删除守卫与 index.ts/pre-commit.ts 接线改写**同任务原子化**（validate 每任务末保持全绿，中间不落红）；T4 schema pattern 迁移与 tokens/documents 消费迁移同任务闭环（engine 套件同任务末全绿）；T5/T8 编辑 SKILL.md/docs 后同任务内 `pnpm run emit` 重生成 + `emit:check`（emit 产物是派生物，禁止手改）。**overall 回填（v1.18）** = branch-review 前置义务（overall v1.12 时序模型）——T8 完成后才进 branch-review/finishing；S3 中 overall 四处改写折入同一回填。

### Flow Atomicity

八任务线性链、逐任务可独立验证：T1（守卫退役 + 接线净化）→ T2（42 行逐案对照表落盘）→ T3（canary-dogfood 删除）→ T4（phase-id 语法 A）→ T5（skills 零过滤 + fix 边界条款）→ T6（docs-family 出口统一）→ T7（consumer-sim）→ T8（S3 残留改写 + 运维规范落档 + 全链收口）。每任务引擎测试就近落（`src/**/__tests__/**/*.test.ts`）；任务间不放跨任务悬空项（发现即回填 spec/overall 再继续）。

### 顺序原则

守卫删除与接线同任务（避免 validate 中间红）；42 行对照表在守卫删除后从 `git show HEAD^:` 读取（T2 起始 HEAD 恰为 T1 提交——两测试文件已被 T1 从 HEAD 树整体删除，`git show HEAD:` 报 path does not exist，须回退紧邻提交；文件已删，映射内容不变）；phase-id 语法 A 的 schema 迁移先于消费迁移（pattern 单源先行，tokens/documents 从新 pattern 派生，杜绝两代 token 并存）；skill/doc 面编辑先 emit 后验 drift；docs-family 出口统一（T6）先于运维规范第 8 项落档（T8）——结果面与出口实现在场才可落档（design §2.7 sequencing）；T7 的 `prepare` 移除先于 release.yml 插桩（consumer-sim 前置）；T8 = 收口（overall 回填 + 全量复核），此后仅剩 branch-review/finishing。每步 validate 保持全绿。

---


### Task 1: S1/S2 守卫退役 + validate 接线净化（design §2.1/§2.4 · AC1/AC4）

- **Objective**: S1/S2 守卫整体退役（overall-consistency · plan-spec-anchors）+ validate 接线净化（steps 12→11 全语义名 + 钉死面同步 + AC4 探针）
- **DependsOn**: none
- **AtomicWith**: none

- **Consumes**: design §2.1/§2.4 退役清单；`scripts/validate/` 现状接线（index.ts · pre-commit.ts · ci-validate.test.mjs 钉死面）

- **Produces**: steps 全语义名（emit freshness / osuperpowers plugin resolution / engine zero residue + channel audit / marketplace manifests validate / scripts unit tests / package version sync）；S1/S2 守卫零存在；AC4 探针（前缀锚定 + 防白绿 node 断言）

- **Files**: scripts/validate/overall-consistency.ts, scripts/validate/plan-spec-anchors.ts, scripts/validate/__tests__/overall-consistency.test.ts, scripts/validate/__tests__/plan-spec-anchors.test.ts, scripts/validate/index.ts, scripts/validate/pre-commit.ts, scripts/validate/__tests__/pre-commit.test.ts, packages/osuperpowers/tests/ci-validate.test.mjs

- **Steps**:
  1. **steps 语义名全改名**（按 design §2.4 表，仅改 `name` 字段不动 run 逻辑）——`emit-check.ts:18` `0. unified emit freshness (emit-check)` → `emit freshness (checked against regenerated products)`；`osuperpowers.ts:34` `5b. osuperpowers plugin validation` → `osuperpowers plugin resolution`；`:68` `5b. osuperpowers skills-count` → `osuperpowers skills inventory count`；`:77` `5b. node:test behavior` → `osuperpowers node:test behavior tree`；`:82` `5b. wiring guard: ci-validate.test.mjs` → `validate wiring guard (ci-validate.test.mjs)`；`engine.ts:20` `5b0. cdd-engine stub materialization (dev:stub)` → `cdd-engine dev stub materialization`；`:26` `5b1. cdd-engine Vitest engine suite` → `cdd-engine engine test suite (vitest)`；`residue.ts:1354` `5c. engine zero-residue + channel-audit grep` → `engine zero residue + channel audit`；`marketplace.ts:165` `6. marketplace validate` → `marketplace manifests validate`；`lib-tests.ts:15` `7. scripts unit tests (vitest)` → `scripts unit tests (vitest)`；`version-sync.ts:65` `8-10. version sync` → `package version sync` — checkable: steps 全语义名——`grep -rn "5b\.\|0\. unified\|12\. overall" scripts/validate/*.ts` 类探针零命中
  2. **整体删除** `scripts/validate/overall-consistency.ts`（543 行）、`scripts/validate/plan-spec-anchors.ts`（314 行）、`scripts/validate/__tests__/{overall-consistency,plan-spec-anchors}.test.ts`（27 + 15 用例） — checkable: `grep -rE "overall-consistency|plan-spec-anchors" scripts/` 零命中（`-E` 交替）
  3. **接线改写**——`index.ts`：删 `import { steps as overallConsistencySteps } from \"./overall-consistency.ts\"` + spread 面 + 顶部注释「Composes the 12 per-block」→ 11 + interleave 注释去「12 names」；`pre-commit.ts`：删 import + spread + 注释「12-block full suite」→ 11（残留 6 组 9 块；pre-commit.test.ts fullSteps=11 + excluded=[5b0,5b1] 互证） — checkable: `index.ts`/`pre-commit.ts` 无 `overallConsistencySteps` import；pre-commit.test.ts fullSteps=11
  4. **钉死面同步**——`ci-validate.test.mjs` 的 step-name 断言随改名（`s.name === "5b. osuperpowers plugin validation"` → `osuperpowers plugin resolution` 等）+「12. overall consistency step present」用例删（改断言无四表 block）+ `steps.length` 12 → 11；`pre-commit.test.ts` fullSteps 12 → 11 + 组成覆盖表改语义名 + subset 排除断言改新语义名 + `:18` first-step 名断言随改名（T1① 改名后必红——钉死面须同任务同步） — checkable: ci-validate.test.mjs / pre-commit.test.ts 钉死值 11 且无旧名断言
  5. **AC4 探针（D3，node 断言面）**——`ci-validate.test.mjs` 增用例：探针 `/(?:^| )\b(?:[0-9]+\.|5b\d*|5c|8-10)[. ]+[A-Za-z(]/` 对 `steps.map(s => s.name)` **全零命中**；**防白绿 node 断言**——旧名逐个 HIT、新语义名逐个 MISS — checkable: AC4 探针 node 断言绿（现名全命中 / 语义名全 miss）
  6. **F8a 盲区闭合**——守卫文件删除后 `grep -rn "\bH1\b" scripts/validate/` 仅余 residue.ts / residue.test.ts（守卫自身定义/测试）——`scripts/` 面不再持有 charter 退役词 H1 的使用 — checkable: F8a 实证（`\bH1\b` 仅守卫自身）+ `pnpm run validate` 全绿（11 块）· engine vitest 不受影响

- **Acceptance**:
  - `grep -rE "overall-consistency|plan-spec-anchors" scripts/` 零命中（`-E` 交替，非 BRE 字面 `|`）；`index.ts`/`pre-commit.ts` 无 `overallConsistencySteps` import；steps 全语义名（`grep -rn "\"5b\.\|0\. unified\|12\. overall" scripts/validate/*.ts` 零命中类探针绿）；ci-validate.test.mjs / pre-commit.test.ts 钉死值 11 且无旧名断言；AC4 探针 node 断言绿（现名全命中 / 语义名全 miss）；F8a 实证（`\bH1\b` 仅守卫自身）；`pnpm run validate` 全绿（11 块）· engine vitest 不受影响。


### Task 2: 42 行逐案对照表落盘（design §2.1 · AC1 后半）

- **Objective**: 42 行 repo 断言逐案恢复（git show HEAD^: 两测试文件）并逐案映射 engine 对应用例（file:line + 覆盖判定），落盘对照表
- **DependsOn**: none
- **AtomicWith**: none

- **Consumes**: T1 删除后的 HEAD 树（两测试文件已删）；`git show HEAD^:scripts/validate/__tests__/overall-consistency.test.ts`（27 条）与 plan-spec-anchors.test.ts（15 条）

- **Produces**: 42 行 markdown 对照表（附于 design §2.1 之后；列：repo case · engine case（file:line）· verdict）；design §2.1「落盘时点」句同步 ✔

- **Files**: docs/kairos/specs/2026-09-21-consumer-parity-p3-design.md（对照表落盘面）

- **Steps**:
  1. **42 条 repo 断言逐案恢复**——`git show HEAD^:scripts/validate/__tests__/overall-consistency.test.ts`（27 条）与 `git show HEAD^:scripts/validate/__tests__/plan-spec-anchors.test.ts`（15 条，T1 已将两文件从 HEAD 树删除、T2 起始 HEAD 恰为 T1 提交，故 `HEAD^` 回退紧邻提交取得——`git show HEAD:` 报 path does not exist），按 `it("…")`/`test("…")` 标题逐条列案 — checkable: 对照表 42 行 = 27 + 15 无缺漏（行数与标题枚举对账）
  2. **逐案映射 engine 对应用例**——每条 repo 断言 → engine 对应用例 `文件:行` + 覆盖判定（同判据面已由 engine 测试覆盖 → 删，零功能损失）。映射面 = design §2.1「唯一实现面」枚举：`rules/__tests__/documents.test.ts`（face ①–⑥ + row-shape + version ascending + split-phase）· `doc-contract-channels.test.ts`（dispatch 级四表 BLOCK）· `closeout.test.ts`（终态欠账 + 声明源→列双向）· `lifecycle-validation.test.ts`（lineage 触发 / 自审边界） — checkable: 每行含 engine 对应用例（file:line 存在性抽查）+ 覆盖判定；无「判据面未覆盖需迁入」行
  3. **落盘**——42 行 markdown 表附于本 design §2.1 之后（`## Appendix: 42-row cross-reference` 或同位置命名；单元格 `|` 按 `\|` 转义）；design §2.1「落盘时点 = P3 plan T2」句同步改「✔ 已落盘（P3 T2）」 — checkable: AC1 复核成立（删面零功能损失实证可复现）；`pnpm run validate` 全绿

- **Acceptance**:
  - 对照表 42 行 = 27 + 15 无缺漏（行数与标题枚举对账）；每行含 engine 对应用例（file:line 存在性抽查——`sed -n` 复验行号）+ 覆盖判定；无「判据面未覆盖需迁入」行（有则立即回填 design 再判——预期全「判据面已覆盖 → 删」）；`grep -rE "overall-consistency|plan-spec-anchors" scripts/` 仍零命中；`pnpm run validate` 全绿；AC1 复核成立（删面零功能损失实证可复现）。


### Task 3: canary-dogfood.test.ts 删除 + engine 套件零产物 fixture 实证（design §2.2 · AC2）

- **Objective**: 删除 canary-dogfood.test.ts（产物 fixture 耦合病）并实证 engine 套件零本仓产物 fixture
- **DependsOn**: none
- **AtomicWith**: none

- **Consumes**: `packages/cdd-engine/src/rules/__tests__/canary-dogfood.test.ts`（79 行，硬编码 `docs/osuperpowers/specs/2026-09-21-consumer-parity-*.md` 三条真实路径为 fixture）

- **Produces**: canary-dogfood 整件删除；零产物 fixture grep 零命中实证（`docs/osuperpowers` 布局字符串排除——mkdtemp 临时仓合成 fixture 合法保留）

- **Files**: packages/cdd-engine/src/rules/__tests__/canary-dogfood.test.ts

- **Steps**:
  1. 删除 `packages/cdd-engine/src/rules/__tests__/canary-dogfood.test.ts` 整文件（79 行，硬编码 `docs/osuperpowers/specs/2026-09-21-consumer-parity-*.md` 三条真实路径为 fixture——产物删即测试废的耦合病） — checkable: 文件从工作树消失（`git show HEAD:...canary-dogfood.test.ts` 存在、工作树无）
  2. **零产物 fixture 实证**——`grep -r "2026-09-21-consumer-parity" packages/cdd-engine/src/**/__tests__/` 零命中；排除口径复查：`docs/osuperpowers` **布局字符串**不属产物引用（14 文件在 mkdtemp 临时仓复刻消费者等效布局——合成 fixture 合法保留，design §2.2 排除口径明文） — checkable: grep `2026-09-21-consumer-parity packages/cdd-engine/src/**/__tests__/` 零命中
  3. engine vitest 全绿（`pnpm --filter @oscaner-skills/cdd-engine test`——既有自造链用例不依赖该文件）+ `pnpm run validate` 全绿 — checkable: engine vitest 全绿 + `pnpm run validate` 全绿

- **Acceptance**:
  - 文件从工作树消失（`git show HEAD:packages/cdd-engine/src/rules/__tests__/canary-dogfood.test.ts` 存在、工作树无）；grep `2026-09-21-consumer-parity packages/cdd-engine/src/**/__tests__/` 零命中；engine vitest 全绿；`pnpm run validate` 全绿。


### Task 4: canonical phase-id 语法严格 A（design §2.3 · AC3）

- **Objective**: canonical phase-id 语法严格 A 落地（overall.json 全 8 处 pattern 迁移 + description 全写 + engine 消费面改造 + split-phase 测试全量 P2.1 化）
- **DependsOn**: none
- **AtomicWith**: none

- **Consumes**: `packages/cdd-engine/src/documents/schema/overall.json` 现状 8 处 phase-id pattern；tokens.ts deriveDocTokens / documents.ts ownDesignToken / phaseIdFromPlan 消费面

- **Produces**: canonical 语法 `^P\d+(\.\d+)*$` 全 8 处 + description 全写；engine 消费面从新 pattern 派生；split-phase 测试 `P2.1` 化 + 依赖边新用例；本仓存量文档零迁移

- **Files**: packages/cdd-engine/src/documents/schema/overall.json, packages/cdd-engine/src/documents/tokens.ts, packages/cdd-engine/src/rules/documents.ts, packages/cdd-engine/src/documents/__tests__/tokens.test.ts, packages/cdd-engine/src/rules/__tests__/documents.test.ts

- **Steps**:
  1. **schema 单点迁移**——`overall.json` 全部 8 处 phase-id 承载 pattern 迁移 `^P\d+(\.\d+)*$`：issueInventory.row.phaseId / phaseInventory.rowShape.idFormat → `^P\d+(\.\d+)*$`；cells.dependency / hardEdge / softEdge / claimPatterns.designToken / phaseReference.single / range（single 派生 `\s*[-–—]\s*` 连接）。**description 全写**（canonical form / 点分子 phase 层级 / 字母后缀与连字符不合法 / 排序语义）——**不留旧语法并存** — checkable: canonical overall.json 全 8 处 pattern 迁移（`grep -n "P\\d+(?![0-9])\[a-z\]\?" .../overall.json` 零命中）+ description 全写
  2. **engine 消费面改造**——`tokens.ts deriveDocTokens`：phaseIdScanRe 构造链去 `[a-z]?` 字面、digit-run 捕获 `(\d+)` → `(\d+(?:\.\d+)*)`；claimPhaseRefToken / phaseTokenScanRe / designTokenScanRe / designDocTail 承接新 pattern；`documents.ts`：ownDesignToken 改 `"\\d+(?:\\.\\d+)*"` 替换、phaseIdFromPlan 改 segment 感知、相关注释语汇同步 — checkable: engine 消费面从新 pattern 派生、零硬编码第二处（grep）
  3. **测试改造（split-phase 族全量 `P2.1` 化）**——`documents.test.ts` face ①-④ chain 用例 + `tokens.test.ts` claim 断言改 `P2.1` / `P2.1–P2.3`（数字脊含点） — checkable: split-phase 测试全量 `P2.1` 化 + 依赖边新用例绿
  4. **新用例（语法初衷面 = 子 phase 依赖图）**——dependency cell `P2.1 -> P2.2` · hardEdge · softEdge · range `P2.1–P2.3` 端点包含 · `P2.1-design` 归属 · `…-p2.1.md` glob——落 `documents.test.ts` / `tokens.test.ts` — checkable: engine suite 新用例全绿；本仓存量文档零迁移（过 engine 审计零新增失败，canary）

- **Acceptance**:
  - canonical overall.json 全 8 处 pattern 迁移 + description 全写（`grep -n "P\\\\d+(?![0-9])\[a-z\]\?" packages/cdd-engine/src/documents/schema/overall.json` 零命中——旧语法并存禁止）；engine 消费面（tokens/documents）从新 pattern 派生、零硬编码第二处；split-phase 测试全量 `P2.1` 化 + 依赖边新用例绿；**本仓存量文档零迁移**（overall P1–P4 · 各 phase spec/plan 头全 bare——过 engine 审计零新增失败，canary：P1/P2/p3 文档链 dispatch 审计零误伤）；`pnpm run validate` 全绿 + engine vitest 全绿。


### Task 5: skills 调用 cdd 输出零过滤 + fix 边界条款 + mid-flight backfill 落点（design §2.8/§2.2/§2.10 · AC8）

- **Objective**: skills 调用 cdd 输出零过滤指引落地 + fix 边界条款（编排者只读 status/blocker、findings 交 fix-agent）+ mid-flight backfill 落点（五件 SKILL.md Invariants + entry-gate 句）
- **DependsOn**: none
- **AtomicWith**: none

- **Consumes**: design §2.8/§2.2/§2.10 措辞；八件 `packages/osuperpowers/skills/*/SKILL.md` 的 cdd 调用指引节点

- **Produces**: 零过滤指引（direct invocation — read the full stdout/stderr）；fix 边界条款；Mid-Flight Backfill Invariants × 5 + cli-driven-development Entry gate 句；emit 重生成零 drift

- **Files**: packages/osuperpowers/skills/cli-driven-development/SKILL.md, packages/osuperpowers/skills/writing-overall-spec/SKILL.md, packages/osuperpowers/skills/writing-phase-spec/SKILL.md, packages/osuperpowers/skills/writing-single-spec/SKILL.md, packages/osuperpowers/skills/writing-plans/SKILL.md, packages/osuperpowers/skills/brainstorming/SKILL.md, packages/osuperpowers/skills/finishing/SKILL.md, packages/osuperpowers/skills/report-issues/SKILL.md

- **Steps**:
  1. **零过滤表述落地**——全部编排 skill（八件 `packages/osuperpowers/skills/*/SKILL.md`）凡含 cdd 调用指引的节点增「**direct invocation — read the full stdout/stderr; cdd truncates its own output**（no `tail`/`head`/`2>&1 |`/`EXIT=$?` wrappers）」指引；现存含「capture」「last block」类表述若指过滤则删改 — checkable: AC8 grep 零命中——`grep -rE "cdd[^\"']{0,40}(tail|head|EXIT=|2>&1[[:space:]]*\|)" packages/osuperpowers/skills/*/SKILL.md` = 0
  2. **fix 边界条款（defect②修复）**——五件 skill 的 fix 节点 Do 补「review 后编排者**只读 status / blocker 计数**（stdout result 面，§2.9）；findings 全文由 `cdd fix` 的 fix-agent 经 `--findings <handoff>` 消费；编排者**不得**自行应用 findings as inline edits」 — checkable: 五件 fix 节点含 fix 边界条款措辞（grep「只读 status」或等价）
  3. **mid-flight backfill 落点（§2.10，2026-09-22 用户裁决）**——五件 SKILL.md Invariants 表各增一条「**Mid-Flight Backfill**」（编号按各表现状续排：cdd → I7 · writing-overall-spec → I3 · writing-phase-spec → I4 · writing-single-spec → I3 · writing-plans → I4；措辞 = design §2.10 英文原文）+ `cli-driven-development` Engine Semantics 增「**Entry gate reads the tree, not the committed range**」 — checkable: 五件 SKILL.md Invariants 表现在含「Mid-Flight Backfill」（grep -L = 空）且 cdd 件含「Entry gate reads the tree」
  4. **emit 重生成**——SKILL.md 是 emit 源：改后 `pnpm run emit` + `emit:check` 零 drift（`.claude-plugin/` / `.cursor-plugin/` / `marketplace/` / `.github/ISSUE_TEMPLATE/` 派生物随改） — checkable: `pnpm run emit` 后 `emit:check` 零 drift；`pnpm run validate` 全绿

- **Acceptance**:
  - AC8 grep 零命中——`grep -rE "cdd[^\"']{0,40}(tail|head|EXIT=|2>&1[[:space:]]*\|)" packages/osuperpowers/skills/*/SKILL.md` = 0；八个 SKILL.md 的 cdd 调用节点含直接调用表述（抽查：含 cdd 调用指引的节点数 ≥ 「read the full output」表述计数）；五件 fix 节点含 fix 边界条款措辞（grep「只读 status」或等价）；五件 SKILL.md Invariants 表现在含「Mid-Flight Backfill」（`grep -L "Mid-Flight Backfill" packages/osuperpowers/skills/{cli-driven-development,writing-overall-spec,writing-phase-spec,writing-single-spec,writing-plans}/SKILL.md` = 空）且 cdd 件含「Entry gate reads the tree」；`pnpm run emit` 后 `emit:check` 零 drift；`pnpm run validate` 全绿。


### Task 6: docs-family 命令出口统一 + exit.ts 出口单源（design §2.9 · AC9）

- **Objective**: docs-family 命令出口统一（exit.ts 增 exitOkWith + result-face 构建 + cli 双通道接线）+ 命令级裸 return 零命中
- **DependsOn**: none
- **AtomicWith**: none

- **Consumes**: design §2.9（D2）；`packages/cdd-engine/src/infra/exit.ts` 现状出口族；`cli/review.ts` / `cli/fix.ts` 的 docs 面裸 return 点

- **Produces**: `exitOkWith` 统一出口 + `docsResultFace`（status · blocker · handoff 单行）接入 docs review/fix；cdd.test.ts docs-family 断言面同步；cli 层出口 = exit.ts 单源

- **Files**: packages/cdd-engine/src/infra/exit.ts, packages/cdd-engine/src/cli/result-face.ts, packages/cdd-engine/src/cli/review.ts, packages/cdd-engine/src/cli/fix.ts, packages/cdd-engine/src/cli/__tests__/cdd.test.ts

- **Steps**:
  1. **exit.ts 补统一出口（D2）**——`export function exitOkWith(resultLine: string): never`（`process.stdout.write(resultLine + "\n")` + `throw new ExitRequested(0)` 语义）；exit table 0/1/2/3 不变 — checkable: exit.ts 含 `exitOkWith` 导出 + exit table 不变
  2. **result 面构建与接线**——共享 helper `docsResultFace(result, handoffPath)` → `status: <s> · blocker: <n> · handoff: <path>`；`cli/review.ts` docs review 完成改捕获返回值 → 裸 `return;` 处打印 result 面 + 出口；`cli/fix.ts` task fix 完成 → `exitOk()`、docs fix 尾 → 同捕获打印 face + exit.ts 出口 — checkable: docs-family review/fix 完成 stdout 含 result 面（`status:` 行可 grep；cdd.test.ts 断言面同步）
  3. **cdd.test.ts docs-family 断言面同步 + grep 实证**——dry-run review --type spec 用例断言 `status: APPROVED` / `· blocker: 0` / `· handoff:`；`grep -rn "^\s*return;$" packages/cdd-engine/src/cli/*.ts` = 0；cli 层出口调用面 = exit.ts 族单源（grep 实证） — checkable: `cli/*.ts` 命令级裸 return 零命中；exit.ts 族 = cli 层唯一出口调用面；validate 全绿

- **Acceptance**:
  - AC9——docs-family review/fix 完成 stdout 含 result 面（`status:` 行可 grep；cdd.test.ts docs-family 断言面已同步更新）；`cli/*.ts` 命令级裸 return 零命中；exit.ts 族 = cli 层唯一出口调用面（grep 实证）；exit table 0/1/2/3 不变；engine vitest 全绿 + `pnpm run validate` 全绿。


### Task 7: consumer-sim（smoke-cdd 升级 · 挂 release 门）（design §2.6 · AC6）

- **Objective**: consumer-sim（smoke-cdd 升级 · 挂 release 门）：prepare 钩子移除 + tarball 内容断言 + mkdtemp 消费者链 + 5-command dry-run 链
- **DependsOn**: none
- **AtomicWith**: none

- **Consumes**: design §2.6（AC6）；`packages/cdd-engine/package.json` prepare 钩子 / `scripts/validate/smoke-cdd.ts`（157 行）；`.github/workflows/release.yml` / `pr-validate.yml` 挂点

- **Produces**: prepare 移除（发布品 = 显式 build 门产物）；smoke-cdd 重写 = consumer-sim（build → pack → tarball 断言 → 临时仓 install → 消费者链 + fixture plan 临时仓生成）；release 门挂点

- **Files**: packages/cdd-engine/package.json, packages/cdd-engine/vitest.config.mjs, scripts/validate/smoke-cdd.ts, .github/workflows/release.yml, .github/workflows/pr-validate.yml

- **Steps**:
  1. **`prepare` 钩子移除**——`packages/cdd-engine/package.json` `scripts` 删 `"prepare": "pnpm run dev:stub"`（裸 pack/publish 不再触碰 dist——发布品 = 显式 build 门的真实产物） — checkable: prepare 已移除（package.json `grep -n prepare` 零命中）
  2. **接线变化登记（D4）**——engine vitest cli 黑盒用例（cdd.test.ts `CDD_MJS = packages/cdd-engine/dist/cli.mjs:20`）在 prepare 移除后不再自动桩化：`packages/cdd-engine/vitest.config.mjs` 增 `globalSetup`（`dist/cli.mjs` 缺失时 `execaSync pnpm -C packages/cdd-engine dev:stub`）+ vitest.config 注释登记 — checkable: engine vitest 全绿（globalSetup 兜底）
  3. **smoke-cdd.ts 重写 = consumer-sim**——(1) build（真实 unbuild 产物 71.7 kB）；(2) 包目录 pack（备防 `--config.ignore-scripts=true`）；(3) tarball 内容断言（stub 标识 `createJiti` / `node_modules/.pnpm` 零命中 **且** 字节数 > 10 kB；`templates/` 与 `dist/documents/schema/` 在场）；(4) mkdtemp 临时仓 `npm install <tarball>`；(5) 消费者链——安装链入口 + `cdd help`（schema 目录可寻址）+ **5-command dry-run 链**（fixture plan 临时仓内生成（D1））；(6) 逐命令断言 return-block 契约（status/commits/artifacts/blocker/counters） — checkable: tarball 内 stub 标识零命中 + 字节实证；consumer-sim PR 面 / release 门可跑（pack → install → 消费者链全绿 + fixture plan 临时仓生成 + 零仓内路径）
  4. **release 门挂点**——`.github/workflows/release.yml` `release` job 内、`changesets/action` 之前插 `node scripts/run.ts smoke-cdd`；`pr-validate.yml:17` 既有 step 保留（快反馈） — checkable: release.yml 含 smoke-cdd 门步；`node scripts/run.ts smoke-cdd` 全绿

- **Acceptance**:
  - AC6——`prepare` 已移除（package.json `grep -n prepare` 零命中）；`pnpm pack` 后 tarball 与工作树 dist 均保持真实产物（tarball 内 stub 标识零命中 + 字节实证）；consumer-sim PR 面 / release 门可跑（`node scripts/run.ts smoke-cdd` 全绿——pack → install → 消费者链全绿 + tarball 断言 + fixture plan 临时仓生成 + 零仓内路径）；`cdd help` 安装面 schema 目录可寻址实测；engine vitest 全绿（globalSetup 兜底）+ `pnpm run validate` 全绿。


### Task 8: S3 残留改写 + 运维规范落档 + 全链收口（design §2.5/§2.7 · AC5/AC7/AC10）

- **Objective**: S3 残留簇改写（engine 执法位 / 历史时态）+ 运维规范八项落档 + overall v1.18 回填 + 全链收口复核
- **DependsOn**: none
- **AtomicWith**: none

- **Consumes**: design §2.5/§2.7（AC5/AC7/AC10）；overall 四处现行 claim / `docs/maintainers/osuperpowers-plugin.md:116-120` / `CLAUDE.md:47` / `writing-overall-spec/SKILL.md:54`

- **Produces**: S3 改写落地（zero 现行主张 grep）；program-experience 八项条目；overall v1.18 四表回填一致；收口复核清单（AC1–AC10 逐条证据）

- **Files**: docs/kairos/specs/2026-09-21-consumer-parity-overall.md, docs/maintainers/program-experience.md, docs/maintainers/osuperpowers-plugin.md, CLAUDE.md, packages/osuperpowers/skills/writing-overall-spec/SKILL.md

- **Steps**:
  1. **S3 残留簇改写（engine 执法位 / 历史时态）**——overall 四处（cross-cutting「仍受 scripts/validate/overall-consistency.ts 机器校验直至 P3」→ 「本仓文档合规 = engine lifecycle 审计，无 repo 侧守卫」；Issue/Phase inventory P3 行逐验）+ `docs/maintainers/osuperpowers-plugin.md:116-120`（→ 引擎执法位表述 + 历史时态）+ `CLAUDE.md:47`（pre-commit 组成改 9 项语义名清单 + 全量 12 块 → 11 块）+ `writing-overall-spec/SKILL.md:54`（现时态 → 历史时态 + engine 位，改后 `pnpm run emit`） — checkable: AC5——`grep "scripts/validate.*guard\|block 12.*consisten"` shipped docs/skills 面零现行主张（历史时态句允许）
  2. **运维规范落档（八项）**——`docs/maintainers/program-experience.md` 增 consumer-parity 区段：1 零产物 fixture · 2 零编号 anchor · 3 零 legacy 豁免死代码 · 4 phase-id 语法 A · 5 唯一执法面 · 6 validate 11 块结构快照 · 7 cdd 输出零过滤 · 8 docs-family 结果可见性 + 命令出口 exit.ts 单源（第 8 项 sequencing：T6 实现在场后写入） — checkable: AC7——program-experience 八项条目英文主源、各自可 grep Verify
  3. **overall v1.18 回填（branch-review 前置义务）**——four-table sync：P3 Design-spec 列 `[Pending]→p3-design v1.2`、Implementation plan 列 `[Pending]→Done`、change-history v1.18 行；P3 acceptance cell 探针形态归一（还原 `\|`→`|` 防白绿） — checkable: overall v1.18 四表一致性（change-history 行与列态互证）
  4. **全量收口复核**——`pnpm run validate` 11 块全绿（干净已提交树）· `emit:check` 零 drift · precommit 绿灯 · engine vitest 全绿 · AC1–AC10 逐条复核清单交付 — checkable: AC10——validate 11 全绿 · emit:check 零 drift · precommit 9 绿灯 · engine vitest 全绿 · AC1–AC9 逐条复核清单交付

- **Acceptance**:
  - AC5——overall 四处 + osuperpowers-plugin.md + CLAUDE.md + SKILL:54 改写为 engine 执法位/历史时态；`grep "scripts/validate.*guard\|block 12.*consisten"` shipped docs/skills 面零现行主张（历史时态句允许）；AC7——program-experience 八项条目英文主源、各自可 grep Verify（第 8 项于本任务（T6 后）写入）；AC10——validate 11 全绿 · emit:check 零 drift · precommit 9 绿灯（pre-commit 子集 = 全量 11 − 5b0/5b1 = 9）· engine vitest 全绿 · AC1–AC9 逐条复核清单交付；overall v1.18 四表一致性（change-history 行与列态互证）。
