# 引擎文档工具（Engine Doc-Tooling）— P6 实施计划：single-spec 骨架 + 命名统一 + kairos vitest 迁移 + 过时文档清理
**Spec:** [2026-10-10-engine-doc-tooling-p6-design.md](../specs/2026-10-10-engine-doc-tooling-p6-design.md)
- **Parent program**: [引擎文档工具（Engine Doc-Tooling）Overall](../specs/2026-10-10-engine-doc-tooling-overall.md)
- **Version**: v0.1 · 2026-10-13

## Constraints

- 命名统一只落 **doc-key 词表值域层**（T1）：`overall`→`overall-spec` · `single`→`single-spec`（T2 新增 doc 型）· **物理文件名 `*-overall.md` 零改名**（judge 派生 `-overall.md → overall-spec` · 历史引用零 churn）· `plan`/`phase-spec` 命名不变 · `plan-graph`（显示型·非 doc-key）与 `phaseSpec`（输入别名）保留
- **single-spec 轻量脚手架**（T2）：header 五元组 + 主体 `:::fill` 槽位（背景与根因/设计裁定/验收/约束）+ Change history 表 · **无 `### N.` 双层大纲 · 无 Parent program 必填** · 结构 = 声明派生（by construction 绿）
- **kairos vitest 全镜像引擎**（T5/T6）：`pool: "forks"` · `maxWorkers: 1` · `fileParallelism: false` · `maxConcurrency: 2` · `testTimeout: 20000` · `include: ["tests/**/*.test.ts"]` · CI `pnpm -C packages/kairos test` 命令字面不变
- **零裸函数收编连带**（T7）：kairos tests **12 处**裸 `function` 全收 `const` 箭头（cdd-plan-spec.test.ts:24 · grep-sweep-regression.test.ts:26 · maintainers-docs.test.ts:59/63/71 · pi-install-smoke.test.ts:30 · pi-package.test.ts:21 · presentation-surface.test.ts:54/61/69/380/396）· `check:no-bare-functions` scope 扩 `packages/kairos/tests` · 头注自标与实际一致（helpers/words/skill-anatomy 头注已自称零裸函数纪律适用）
- **文档清理精确边界**（T8）：root CLAUDE.md 三处 P5-stale + maintainers 01:44（14→16）/03:32（17→16 · RETURN_JSON/DOCS_FIX 退役）+ maintainers README ledger 标题对齐 · **docs/kairos/{specs,plans} frozen 历史面零动** · 消费面 README/base.md 零 outdated 不改
- **语义契约保**：doc-contract 判定语义不变（gate 零例外）· 退出码表 / CDD_BLOCKED / `next:` 字面 / 领域 run 语义零动（字节更替为 deliberate re-anchor）
- **零残留**：填后 `:::fill` 零残留 · 非豁免 `<…>` 零残留 · EOF 全绿 · 不发布（变更集归并落 pending）

## Review Focus

- **`schema get single-spec` 无 `--output skeleton <target>` → 行为**：single-spec 类型合法但 target 必填（对齐 phase-spec/overall 语义）——孤儿 target 应报条件必填错误而非静默空跑。→ 测试钉在 T2 steps（通道表 value-domain + 条件必填 pin）。
- **`schema get bogus` 值域提示词表**：错误面 "available: …" 应为改后四 doc-key（`single-spec | phase-spec | overall-spec | plan`）而非旧 `overall`——语言提示与词表一并更替。→ 测试钉在 T1（schema get 值域 actor errors 字面重锚）。
- **历史 `*-overall.md` 文件评审**：judge 派生改 `-overall.md → overall-spec` 后，现存 4 份整体文档评审仍应过 gate（物理文件名未动 · 派生结果与词表对齐）。→ 测试钉在 T1（judge testimony `-overall.md` 派生 pin）。
- **vitest forks 池下子进程套件**：kairos 套件含 ~18+ spawn（grep-sweep）/pi/npm/tar spawn（pi-install-smoke）——`pool: "forks"` + `maxWorkers: 1` 承载，迁移后 77 用例全绿且无 OOM。→ 测试钉在 T6（`pnpm -C packages/kairos test` 全绿核对）。
- **`check:no-bare-functions` scope 扩后**：对每个既有文件再跑一次，12 处收编后零命中；残留裸 function 会让 CI no-bare-functions job 红。→ 测试钉在 T7（scope 扩后 grep 零命中 + 门禁命令字面扩）。

---

### Task 1: 命名统一——engine doc-key 词表 `overall` → `overall-spec`（deliberate byte sync）
**Files:**
- Modify: `packages/cdd-engine/src-next/contract/declare.ts`（DocType 并集 · OVERALL_ELEMENTS 锚 · registry 行键）
- Modify: `packages/cdd-engine/src-next/contract/project.ts`（DocKey 类型 · 五投影键）
- Modify: `packages/cdd-engine/src-next/contract/judge.ts`（DOC_KEYS 数组 · 派生 `-overall.md → overall-spec`）
- Modify: `packages/cdd-engine/src-next/render/skeleton.ts`（`case "overall"` → `case "overall-spec"` · `#renderOverall` → `#renderOverallSpec`）
- Modify: `packages/cdd-engine/src-next/face/declare.ts`（SCHEMA_TYPE_KEYS 值 `overall: "overall-spec"` · phaseSpec 别名行保留）
- Modify: `packages/cdd-engine/src-next/face/projection.ts`（投影键 `overall`→`overall-spec`）
- Test: `packages/cdd-engine/src-next/**/__tests__/`（doc/project/judge/cli/skeleton 测试字面 + 快照 `project.shape.overall.snap`/`project.schema.overall.snap` → `*.overall-spec.snap`）

**Interfaces:**
- Consumes: P5 产物（declare 注册表 · Projector 五投影 · judge 派生 · skeleton 分派）——只做键名字面更替，零结构/语义变化
- Produces: `DocKey = "single-spec" | "phase-spec" | "overall-spec" | "plan"`（与 T2 合体后的最终并集）· schema get 值域 `overall-spec` 可用 · judge 派生 `-overall.md → overall-spec`

- [ ] **Step 1: 更新 contract 面类型与注册键**
`contract/declare.ts` DocType 并集 `"overall"` → `"overall-spec"`（含 DOC_TYPE_VALUES）· `OVERALL_ELEMENTS` 常量锚位（declare.ts:162）与 registry 行键（declare.ts:863）字面改 `overall-spec` · `contract/project.ts` DocKey 并集 + 五投影 Record 键 + Projector `#projectAll` 记录键 全 `overall-spec`
- [ ] **Step 2: 更新 judge DOC_KEYS + 派生映射**
`contract/judge.ts:38` `DOC_KEYS = ["overall-spec", "plan", "phase-spec"]` · `judge.ts:101` 派生改 `path.basename(docPath).endsWith("-overall.md") ? "overall-spec" : "phase-spec"`
- [ ] **Step 3: 更新 skeleton 分派 + face 词表**
`render/skeleton.ts:112` `case "overall"` → `case "overall-spec"` · `#renderOverall` 方法名 `#renderOverallSpec`（docType 值分派同步）· `face/declare.ts:300` SCHEMA_TYPE_KEYS 值 `overall: "overall-spec"`（`phaseSpec: "phase-spec"` 别名行保留）· `face/projection.ts` SCHEMA_PRIMARY_KEYS 派生键同步
- [ ] **Step 4: 测试字面 + 快照重锚（deliberate）**
全部测试文件 + 快照 `project.shape.overall.snap`/`project.schema.overall.snap` → `*.overall-spec.snap`（重命名 + 内容键更新）· schema get errors 字面 "available: overall-spec, plan, phase-spec, plan-graph" 重锚
- [ ] **Step 5: 跑引擎套件核对全绿**
Run: `pnpm -C packages/cdd-engine test`（本地 = `pnpm exec vitest run`）
Expected: 全绿（命名统一 529 基线 + 本次重锚零残）
- [ ] **Step 6: 零 `overall` doc-key 残留 grep pin**
Run: `grep -rnE 'DocKey = .*overall|"overall", "plan"' packages/cdd-engine/src-next`
Expected: 零命中（`overall-spec` 全替换 · `-overall.md` 字面与 `phaseSpec` 别名豁免）
- [ ] **Step 7: Commit**
`git add packages/cdd-engine/src-next && git commit -m "refactor(cdd-engine): 命名统一 doc-key 词表——overall→overall-spec（deliberate byte sync）"`

### Task 2: single-spec doc 型 + 轻量脚手架（declare 注册表 + 三投影 + skeleton 渲染 + schema get 并入）
**Files:**
- Create: `packages/cdd-engine/src-next/contract/__tests__/__snapshots__/project.shape.single-spec.snap` + `project.schema.single-spec.snap`
- Modify: `packages/cdd-engine/src-next/contract/declare.ts`（`SINGLE_SPEC_ELEMENTS` 注册表 · DocType 并集已含 single-spec）
- Modify: `packages/cdd-engine/src-next/contract/project.ts`（DocKey 已并集 · SkeletonProjection/SchemaProjection 自动含单型）
- Modify: `packages/cdd-engine/src-next/render/skeleton.ts`（`#renderSingleSpec` · case 分派）
- Modify: `packages/cdd-engine/src-next/face/declare.ts`（SCHEMA_TYPE_KEYS 增 `single-spec: "single-spec"`）
- Modify: `packages/cdd-engine/src-next/face/cli.ts`（schema get `single-spec` 通道 · target 条件必填）
- Test: `packages/cdd-engine/src-next/render/__tests__/skeleton.test.ts` + `contract/__tests__/project.test.ts` + `face/__tests__/cli.test.ts`（新增 colocated pins）

**Interfaces:**
- Consumes: T1 的 `DocKey` 并集（single-spec 已并入类型）· P5 schema get 双渲染面（`--output json|skeleton` · target 条件必填机制）
- Produces: `schema get single-spec --output skeleton <target>`（直写目标 doc）· `schema get single-spec --output json`（schema 声明面）· doc-contract 判 single-spec 骨架 by construction 绿

- [ ] **Step 1: 写 failing 测试（skeleton 渲染 + 投影）**
在 `render/__tests__/skeleton.test.ts` 增：`schema get single-spec --output skeleton <tmp>` 渲染字节 = 期望轻量脚手架（header 五元组 + 主体 `:::fill` 槽位 + Change history 表 · 无 `### N.` · 无 Parent program）· `contract/__tests__/project.test.ts` 增 single-spec 投影形状（docType: "single-spec" · 注册元素集）
- [ ] **Step 2: 跑测试核对 FAIL**
Run: `pnpm exec vitest run packages/cdd-engine/src-next/render/__tests__/skeleton.test.ts packages/cdd-engine/src-next/contract/__tests__/project.test.ts`
Expected: FAIL（SkeletonAssembler 无 single-spec case）
- [ ] **Step 3: 新增 SINGLE_SPEC_ELEMENTS 注册表（declared 结构）**
`contract/declare.ts` 增 `SINGLE_SPEC_ELEMENTS`（标题 · 版本行 · status · author · `## 背景与根因`（prose 槽位锚）· `## 设计裁定` · `## 验收` · `## 约束` · Change history 表——**注册元素 = header 五元组 + 主体 fill 槽位 + change-history 行 · 无 `### N.`/Parent program**）· registry 增 `single-spec: { docType: "single-spec", elements: SINGLE_SPEC_ELEMENTS }`
- [ ] **Step 4: 实现 `#renderSingleSpec` + case 分派**
`render/skeleton.ts` `#compose` case 增 `"single-spec"` → `#renderSingleSpec(probe)`：pushHeader（header 槽位在投影序）· `## 背景与根因`/`## 设计裁定`/`## 验收`/`## 约束` 各 `- :::fill …` 槽位 · `## Change history` 表（HISTORY_HEADER + separator + 首行 v0.1）· slot-consumption 断言（`#assertConsumed`）覆盖 single-spec 全注册锚
- [ ] **Step 5: SCHEMA_TYPE_KEYS + cli 通道 + target 条件必填**
`face/declare.ts` SCHEMA_TYPE_KEYS 增 `single-spec: "single-spec"` · `face/cli.ts` schema get 通道接受 single-spec（`--output json` 无需 target · `--output skeleton <target>` target 必填——复用 P5 target 条件必填机制）· did-you-mean 候选自动随 SCHEMA_TYPE_KEYS 更新（`schema get single…` 前缀入候选）
- [ ] **Step 6: 跑测试核对 PASS + 全套件**
Run: `pnpm exec vitest run packages/cdd-engine/src-next/render/__tests__/skeleton.test.ts packages/cdd-engine/src-next/contract/__tests__/project.test.ts packages/cdd-engine/src-next/face/__tests__/cli.test.ts`
Expected: PASS（含新 single-spec pins）· 快照 `project.shape.single-spec.snap`/`project.schema.single-spec.snap` 生成
- [ ] **Step 7: 填后 doc-contract 判绿探针**
Run: 对用骨架生成的 single-spec 样例 `node packages/cdd-engine/src-next/bin.ts review --type spec --spec <样例路径>`（填全文 · 零 :::fill 残留）
Expected: doc-contract 判绿（结构保真 · 无 findings）
- [ ] **Step 8: Commit**
`git add packages/cdd-engine/src-next && git commit -m "feat(cdd-engine): single-spec doc 型 + 轻量脚手架——schema get single-spec --output skeleton"`

### Task 3: 引擎 vitest pins 收口（T1/T2 变更后的全量重锚核对）
**Files:**
- Modify: `packages/cdd-engine/src-next/**/__tests__/`（若有 T1/T2 未覆盖的 `"overall"`/`single` 字面）
- Test: `packages/cdd-engine/src-next/**/__tests__/`（全套件）

**Interfaces:**
- Consumes: T1 命名统一 + T2 single-spec doc 型（字节面已落）
- Produces: 引擎套件全绿（T1/T2 变更的完整回归面 · 快照重锚 comitted）

- [ ] **Step 1: grep 引擎测试面残留旧词表**
Run: `grep -rnE '"overall"|"single"' packages/cdd-engine/src-next/**/__tests__/`
Expected: 定位 T1/T2 后仍引用旧词表的字面（若有）
- [ ] **Step 2: 逐处 deliberate 重锚 + 跑全套件**
将上一步命中的每处改为 `overall-spec`/`single-spec`（快照/字面/pin 全数）· Run: `pnpm -C packages/cdd-engine test`
Expected: 全绿（T1/T2 + 本任务重锚后引擎 vitest 计数与基线一致）
- [ ] **Step 3: Commit**
`git add packages/cdd-engine && git commit -m "test(cdd-engine): 命名统一 + single-spec 后测试 pins 全量重锚"`

### Task 4: 消费面 skill 字面同步（single-spec / overall-spec 变体名）
**Files:**
- Modify: `packages/kairos/skills/cdd-spec-writer/SKILL.md`（description · author-spec 节点 · single/overall 变体字面）
- Modify: `packages/kairos/skills/cdd-design/SKILL.md`（description · size? 出口 · 分派字面 · cdd-spec-writer 引用变体名）
- Modify: `packages/kairos/skills/cdd-plan/SKILL.md`（handoff 引用变体名）
- Test: `packages/kairos/tests/presentation-surface.test.ts`（行为树 pins）

**Interfaces:**
- Consumes: T1/T2 的引擎字节面（schema get 值域 = single-spec|phase-spec|overall-spec|plan）
- Produces: 消费面 skill 字面与引擎词表一致 · 行为树 pins 同步

- [ ] **Step 1: cdd-spec-writer 变体字面更新**
SKILL.md 内 `single` → `single-spec` · `overall` → `overall-spec`（description 行 · author-spec 节点三变体 · 分派字面 `schema get single-spec --output skeleton <target path>` · `schema get overall-spec --output skeleton <target path>`）
- [ ] **Step 2: cdd-design / cdd-plan 字面更新**
`cdd-design/SKILL.md` size? 出口 `single` → `single-spec`（single-spec target）· `overall` → `overall-spec`（overall/charter target）· `cdd-plan/SKILL.md` 涉及变体名引用（如有）同更替
- [ ] **Step 3: 行为树 pins 翻新 + kairos 套件核对**
`presentation-surface.test.ts` pins（如有 `single`/`overall` 字面）→ `single-spec`/`overall-spec` · Run: `pnpm -C packages/kairos test`
Expected: 全绿（行为树 + 解剖 + 词面）
- [ ] **Step 4: 消费面残留 grep pin**
Run: `grep -rnE '变体（single|schema get overall|--- (single|overall) —' packages/kairos/skills/*/SKILL.md`
Expected: 零命中（frozen 历史 doc 内容豁免）
- [ ] **Step 5: Commit**
`git add packages/kairos/skills packages/kairos/tests/presentation-surface.test.ts && git commit -m "docs(kairos): 消费面 skill 字面同步——single-spec / overall-spec 变体名"`

### Task 5: kairos vitest 配置落位（全镜像引擎）
**Files:**
- Create: `packages/kairos/vitest.config.ts`
- Modify: `packages/kairos/package.json`（`test` script → `vitest run` · devDependencies 增 vitest）
- Verify: `.github/workflows/pr-validate.yml`（kairos-suite job 命令字面不变——静态核对）

**Interfaces:**
- Consumes: 引擎 vitest.config 先例（P5）· root vitest.config（scripts/** 面无关）
- Produces: kairos 套件可 `vitest run` 执行 · CI 命令字面零改动

- [ ] **Step 1: 写 vitest.config.ts（镜像引擎四阈值）**
`packages/kairos/vitest.config.ts`：`pool: "forks"`（node:test 兼容 · 回避 worker_threads 与 execa/git 子进程干扰——kairos 套件子进程密集）· `maxWorkers: 1` · `fileParallelism: false` · `maxConcurrency: 2` · `testTimeout: 20000` · `include: ["tests/**/*.test.ts"]`
- [ ] **Step 2: package.json test script 切 vitest + devDependency**
`package.json#scripts.test` → `"vitest run"` · `devDependencies` 增 `vitest`（workspace 对齐 · 版本与引擎一致）· `files` 面不新增（vitest.config 非发布产物）
- [ ] **Step 3: 干跑核对命令字面 + 未迁移状态预期红**
Run: `pnpm -C packages/kairos test`
Expected: FAIL/SKIP（node:test 测试文件尚未迁移 · vitest include 覆盖 Tests/*.test.ts 但 suite 仍 node:test import → vitest 报错/空跑）——注：此步是配置先行核对，迁移实现在 T6
- [ ] **Step 4: Commit**
`git add packages/kairos/vitest.config.ts packages/kairos/package.json && git commit -m "chore(kairos): vitest 配置落位——镜像引擎 forks 池 + 四阈值"`

### Task 6: kairos 测试面全量迁移（11 文件 77 用例 + helpers）
**Files:**
- Modify: `packages/kairos/tests/*.test.ts`（11 文件全量）
- Modify: `packages/kairos/tests/helpers.ts`（无 import 变更 · 保持现有 const 箭头形态）
- Test: `packages/kairos/tests/`（全量 vitest 词法）

**Interfaces:**
- Consumes: T5 的 vitest.config（pool forks · include tests/**）· T4 前的行为树基线（77 用例语义）
- Produces: 迁移后 `pnpm -C packages/kairos test` 全绿（77 用例 · 字节 pins 等价/合规）· `node:test`/`node:assert` in kairos tests 零残留

- [ ] **Step 1: 逐个文件迁移 import 层**
11 个 test 文件：`import { test } from "node:test"` + `import assert from "node:assert/strict"` → vitest 词法（`import { describe, expect, test } from "vitest"`）。**零 `describe()` 现状保持**（suite 现为全扁平 `test()`——迁移不强制结构重排 · 行为等价 · 最小 diff）
- [ ] **Step 2: 断言 API 对译（recon 清单 A/B 对照）**
`assert.match`(46) → `expect(s).toMatch(re)` · `assert.ok`(39) → `expect(x).toBeTruthy()`（或 `not.toBeFalsy()` 按语义）· `assert.equal`(14) → `expect(x).toBe(y)` · `assert.deepEqual`(11) → `expect(x).toEqual(y)` · `assert.doesNotMatch`(7) → `expect(s).not.toMatch(re)` · `assert.strictEqual`(4) → `expect(x).toBe(y)` · `assert.throws`(1) → `expect(fn).toThrow()`（pi-install-smoke.test.ts:121）——逐处按 recon 清单核对
- [ ] **Step 3: helpers.ts 零 import 变更核对**
`helpers.ts` 无 node:test/assert import（recon 实证）——保持 const 箭头 + `execFileSync` git/mkdtemp（T7 若收编则同轮处理）
- [ ] **Step 4: 跑迁移后套件全绿 + 残留 grep**
Run: `pnpm -C packages/kairos test`
Expected: PASS（77 用例 · vitest run）
Run: `grep -rn "node:test\|node:assert" packages/kairos/tests`
Expected: 零命中
- [ ] **Step 5: Commit**
`git add packages/kairos/tests && git commit -m "refactor(kairos): 测试面 node:test → vitest 全量迁移（11 文件 77 用例）"`

### Task 7: kairos tests 零裸函数收编 + check:no-bare-functions scope 扩
**Files:**
- Modify: `packages/kairos/tests/cdd-plan-spec.test.ts:24` · `grep-sweep-regression.test.ts:26` · `maintainers-docs.test.ts:59/63/71` · `pi-install-smoke.test.ts:30` · `pi-package.test.ts:21` · `presentation-surface.test.ts:54/61/69/380/396`
- Modify: `package.json`（root · `check:no-bare-functions` script scope 增 `packages/kairos/tests`）
- Test: `packages/kairos/tests/`（收编后全绿）

**Interfaces:**
- Consumes: T6 迁移后的 kairos tests 面（12 处裸 function 待收）
- Produces: 12 处裸 `function` 全收 `const` 箭头 · `check:no-bare-functions` scope 扩后全树零命中 · 头注自标与实际一致

- [ ] **Step 1: 枚举 12 处裸 function 全收 `const` 箭头**
`cdd-plan-spec.test.ts:24` · `grep-sweep-regression.test.ts:26` · `maintainers-docs.test.ts:59/63/71` · `pi-install-smoke.test.ts:30` · `pi-package.test.ts:21` · `presentation-surface.test.ts:54/61/69/380/396` ——`function <name>(...)` → `const <name> = (...) =>`（this/hoisting 语义核对 · 纯 helper 无 this）
- [ ] **Step 2: 收编后跑 kairos 套件全绿**
Run: `pnpm -C packages/kairos test`
Expected: PASS（77 用例 · 收编无行为变化）
- [ ] **Step 3: check:no-bare-functions scope 扩 + 全树核对**
`package.json#scripts.check:no-bare-functions` 范围增 `packages/kairos/tests`（与 engine src-next + scripts 并列 · 同一正则 `^(export )?(async )?function `）· Run: `pnpm run check:no-bare-functions`
Expected: exit 0（12 处收编后零命中）
- [ ] **Step 4: 头注自标一致性核对**
`helpers.ts:7` · `words.test.ts:11` · `skill-anatomy.test.ts:12` 头注（"零裸函数适用本迁移面"）与实际一致（grep 零命中即证）
- [ ] **Step 5: Commit**
`git add packages/kairos/tests package.json && git commit -m "refactor(kairos): kairos tests 零裸函数收编——12 处收 const · check:no-bare-functions scope 扩"`

### Task 8: 过时文档清理 + 运维精简（root CLAUDE.md + maintainers）
**Files:**
- Modify: `CLAUDE.md`（:25 · :43 · :109 三处 P5-stale）
- Modify: `docs/maintainers/01-template-doctrine.md:44`（14 → 16 token 计数）
- Modify: `docs/maintainers/03-context-caching-doctrine.md:32`（17 → 16 · 五枚具名 token 校正 · RETURN_JSON/DOCS_FIX 退役单契约）
- Modify: `docs/maintainers/README.md`（P4.2 ledger 标题与 P5 内容对齐）
- Modify: `packages/kairos/tests/maintainers-docs.test.ts`（After 单元格随行数变化同步）

**Interfaces:**
- Consumes: P5 解散机制 ground truth（scripts/run.ts 仅 emit/emit-check/version-sync · scripts/validate.ts/guard 不存在）· recon 报告的 stale 逐行定位
- Produces: root CLAUDE.md 三处 P5-stale 改净 · maintainers 计数/退役事实修正 · maintainers-docs.test 随行同步全绿 · frozen 面零动

- [ ] **Step 1: root CLAUDE.md 三处 P5-stale 改写**
`:25` `CI runs node scripts/run.ts validate` → 原生链（root package.json validate）· `:43` `- scripts/run.ts validate — Node validation orchestration` → validate 原生链 + pr-validate.yml 矩阵 · `:109` `pnpm run precommit (node scripts/run.ts precommit · scripts/validate.ts)` → package.json 原生命令链（precommitSteps 表述改 + smoke-cdd 引用撤）
- [ ] **Step 2: maintainers 01:44 token 计数修正**
`01-template-doctrine.md:44` → "the 16 declared injection tokens (15 `round-context` + 1 `shell`)"（src-next/render/templates.ts:447-465 实测）
- [ ] **Step 3: maintainers 03:32 token/退役事实修正**
`03-context-caching-doctrine.md:32` → 16 tokens（15 round-context + 1 shell）· 五枚具名 token（HANDOFF_WRITE_GATE 等）校正为存活 token 集（render.test.ts 负断言对齐）· RETURN_JSON/DOCS_FIX → 单 return 契约（RETURN_STDOUT_BLOCK only · v1.9）· C1 行 "per return format" → 单契约
- [ ] **Step 4: maintainers README ledger 标题对齐**
`docs/maintainers/README.md` "P4.2 convergence ledger" → 对齐 P5 记录内容（标题/位置叙述更新 · After 字节断言由 maintainers-docs.test 沿守）
- [ ] **Step 5: maintainers-docs.test 随行同步 + 套件全绿**
`tests/maintainers-docs.test.ts` After 单元格（变动的 01/03/README 行数）随行更替 · Run: `pnpm -C packages/kairos test`
Expected: PASS（maintainers-docs.test After = 实况字节）
- [ ] **Step 6: frozen 面零动核对 + P5-stale 残留 grep**
Run: `grep -rn "scripts/run.ts validate\|scripts/validate.ts\|run.ts precommit\|smoke-cdd" CLAUDE.md docs/maintainers`
Expected: 零命中（docs/kairos/{specs,plans} 冻结历史面不计入）
- [ ] **Step 7: Commit**
`git add CLAUDE.md docs/maintainers packages/kairos/tests/maintainers-docs.test.ts && git commit -m "docs: 过时文档清理——root CLAUDE.md P5-stale 三处 + maintainers 计数/退役事实修正"`

### Task 9: 变更集归并 + 全量验证
**Files:**
- Create: `.changeset/<slug>.md`
- Verify: `pnpm run validate`（或等价 CI 原生序列）

**Interfaces:**
- Consumes: T1–T8 全部落地（引擎 + kairos + 文档净树）
- Produces: 变更集归并落 pending · `pnpm run validate`（或等价 CI 原生序列）ALL PASS · EOF 全绿 · 不发布

- [ ] **Step 1: 全量验证运行**
Run: `pnpm run validate`
Expected: ALL PASS（emit-check fresh · 引擎 vitest 全绿 · kairos vitest 77 全绿 · typecheck ×3 · version-sync · 零裸函数 grep 零命中（scope 扩后含 kairos tests）· EOF 全绿）
- [ ] **Step 2: 变更集归并**
`pnpm run changeset`（或手写 `.changeset/<slug>.md`）——cdd-engine（命名统一 + single-spec doc 型 · 语义面 = 新增能力/词表更替）· kairos（vitest 迁移 · patch）· 归并落 pending· 不发布
- [ ] **Step 3: Commit**
`git add .changeset packages && git commit -m "chore(cdd-engine,kairos): P6 变更集归并——命名统一 + single-spec 骨架 + kairos vitest 迁移（不发布）"`

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-10-13 | P6 实施计划 v0.1——single-spec 骨架 + 命名统一 + kairos vitest 迁移 + 过时文档清理（spec v0.1 Approved）：W1{T1 overall-spec 词表改名 · T5 kairos vitest 配置 · T8 文档清理} → W2{T2 single-spec doc 型 · T6 测试文件迁移} → W3{T4 消费面字面同步 · T7 零裸函数收编} → W4{T9 变更集} · T3 为引擎 pins 收口衔接 T1/T2；T1/T2/T5/T6 均带本地引擎/套件核对 · 不发布 | Oscar M. · Claude Opus 5（kairos:cdd-plan · 用户批准） |
