# 引擎文档工具（Engine Doc-Tooling）— P6 实施计划：single-spec 骨架 + 命名统一 + kairos vitest 迁移 + 过时文档清理
**Spec:** [2026-10-10-engine-doc-tooling-p6-design.md](../specs/2026-10-10-engine-doc-tooling-p6-design.md)
- **Parent program**: [引擎文档工具（Engine Doc-Tooling）Overall](../specs/2026-10-10-engine-doc-tooling-overall.md)
- **Version**: v0.2 · 2026-10-13

## Constraints

- 命名统一只落 **doc-key 词表值域层**（T1）：`overall`→`overall-spec` · `single`→`single-spec`（T2 新增 doc 型）· **物理文件名 `*-overall.md` 零改名**（judge 派生 `-overall.md → overall-spec` · 历史引用零 churn）· `plan`/`phase-spec` 命名不变 · `plan-graph`（显示型·非 doc-key）与 `phaseSpec`（输入别名）保留
- **single-spec 轻量脚手架**（T2）：header 五元组 + 主体 `:::fill` 槽位（背景与根因/设计裁定/验收/约束）+ Change history 表 · **无 `### N.` 双层大纲 · 无 Parent program 必填** · 结构 = 声明派生（by construction 绿）
- **kairos vitest 全镜像引擎**（T5/T6）：`pool: "forks"` · `maxWorkers: 1` · `fileParallelism: false` · `maxConcurrency: 2` · `testTimeout: 20000` · `include: ["tests/**/*.test.ts"]` · CI `pnpm -C packages/kairos test` 命令字面不变
- **零裸函数收编连带**（T7）：kairos tests **12 处**裸 `function` 全收 `const` 箭头（cdd-plan-spec.test.ts:24 · grep-sweep-regression.test.ts:26 · maintainers-docs.test.ts:59/63/71 · pi-install-smoke.test.ts:30 · pi-package.test.ts:21 · presentation-surface.test.ts:54/61/69/380/396）· `check:no-bare-functions` scope 扩 `packages/kairos/tests` · 头注自标与实际一致（helpers/words/skill-anatomy 头注已自称零裸函数纪律适用）
- **文档清理精确边界**（T8 · 用户裁定 2026-10-13 激进收编）：root CLAUDE.md 三处 P5-stale + **maintainers 五篇+index 48,555B → 三篇+index ~13KB（项目即 best sample）**：删 01-template-doctrine / 04-program-experience / 06-skill-node-discipline · 更名 02-naming-conventions→02-naming · 03-context-caching-doctrine→03-cache-doctrine · 01-doctrine 收编模板精髓+skill-node 原则+非机械项 · 退役名入 OLD_NAMES 防回移 · maintainers-docs.test 全套件重锚 · 消费面链接重指（CLAUDE.md:54 · kairos README 双文）· **docs/kairos/{specs,plans} frozen 历史面零动**
- **语义契约保**：doc-contract 判定语义不变（gate 零例外）· 退出码表 / CDD_BLOCKED / `next:` 字面 / 领域 run 语义零动（字节更替为 deliberate re-anchor）
- **零残留**：填后 `:::fill` 零残留 · 非豁免 `<…>` 零残留 · EOF 全绿 · 不发布（变更集归并落 pending）

### Task 1: 命名统一——engine doc-key 词表 `overall` → `overall-spec`（deliberate byte sync）
- **Objective**: 把引擎 doc-key 词表值域层全量改名——`DocKey = "single-spec" | "phase-spec" | "overall-spec" | "plan"`——declare 注册键（`OVERALL_ELEMENTS` → `OVERALL_SPEC_ELEMENTS` · registry 行键）· DocType 并集 · judge `DOC_KEYS` 数组 + 派生映射 `-overall.md → overall-spec` · skeleton 渲染分派 `case "overall"` → `"overall-spec"` · SCHEMA_TYPE_KEYS/投影键同步 · 引擎测试字面 + 快照 deliberate 重锚；物理文件名 `*-overall.md` 零改名 · `plan-graph` 显示型与 `phaseSpec` 输入别名保留
- **Files**:
  - Modify: `packages/cdd-engine/src-next/contract/declare.ts`（DocType 并集 · OVERALL_ELEMENTS 锚 declare.ts:162 · registry 行键 declare.ts:863）
  - Modify: `packages/cdd-engine/src-next/contract/project.ts`（DocKey 并集 project.ts:48 · Projector 记录键 #projectAll project.ts:377-383（:379 `overall` 字面）· 六投影 Record 型 265-275 经并集自动更替不需改）
  - Modify: `packages/cdd-engine/src-next/contract/judge.ts`（DOC_KEYS judge.ts:38 · 派生 `-overall.md → overall-spec` judge.ts:101）
  - Modify: `packages/cdd-engine/src-next/render/skeleton.ts`（`case "overall"` → `case "overall-spec"` skeleton.ts:112 · `#renderOverall` → `#renderOverallSpec`）
  - Modify: `packages/cdd-engine/src-next/face/declare.ts`（SCHEMA_TYPE_KEYS 行整行更名 `"overall-spec": "overall-spec"`（self-mapped · 与原行次序同位替换 · SCHEMA_PRIMARY_KEYS spelling===key 收列）face/declare.ts:300 · `phaseSpec` 别名行保留）
  - Verify: `packages/cdd-engine/src-next/face/projection.ts`（核对派生键零改动——SCHEMA_PRIMARY_KEYS/errors 全集由 face/declare.ts SCHEMA_TYPE_KEYS 运行期派生 · 该文件无 doc-key 投影字面）
  - Modify: `packages/cdd-engine/src-next/**/__tests__/`（doc/project/judge/cli/skeleton 测试字面 + 快照重命名）
  - Modify: `packages/cdd-engine/src-next/contract/__tests__/__snapshots__/project.shape.overall.snap` → `project.shape.overall-spec.snap`
  - Modify: `packages/cdd-engine/src-next/contract/__tests__/__snapshots__/project.schema.overall.snap` → `project.schema.overall-spec.snap`
- **Consumes**: P5 产物（declare 注册表 · Projector 六投影 · judge 派生 · skeleton 分派）——只做键名字面更替，零结构/语义变化 · spec 授权（Q1→a 词表值域层 · 物理文件零改名）
- **Produces**: `DocKey` 并集（`single-spec | phase-spec | overall-spec | plan` · 与 T2 合体后的最终并集）· schema get doc-key 值域 `overall-spec` 可用 · judge 派生 `-overall.md → overall-spec` · 供 T3 重锚核对 / T4 消费面字面
- **Steps**:
  - 更新 contract 面类型与注册键——`contract/declare.ts` DocType 并集 `"overall"` → `"overall-spec"`（含 DOC_TYPE_VALUES）· `OVERALL_ELEMENTS` 常量与 registry 行键字面改 `overall-spec` · `contract/project.ts` DocKey 并集（project.ts:48）+ Projector 记录键（#projectAll project.ts:377-383 · :379 `overall` 字面）全 `overall-spec`（六投影 Record 型 265-275 经并集自动更替不需改） — checkable: declare.ts/project.ts 内 `"overall-spec"` 全量替换落位（`-overall.md` 字面豁免）
  - 更新 judge DOC_KEYS + 派生映射——`contract/judge.ts:38` `DOC_KEYS = ["overall-spec", "plan", "phase-spec"]` · `judge.ts:101` 派生改 `path.basename(docPath).endsWith("-overall.md") ? "overall-spec" : "phase-spec"` — checkable: judge.ts 派生结果与词表对齐（历史 `*-overall.md` 物理文件名零动）
  - 更新 skeleton 分派 + face 词表——`render/skeleton.ts:112` `case "overall"` → `case "overall-spec"` · `#renderOverall` 方法名 `#renderOverallSpec`（docType 值分派同步）· `face/declare.ts:300` SCHEMA_TYPE_KEYS 行整行更名 `"overall-spec": "overall-spec"`（self-mapped · 与原行次序同位替换 · `phaseSpec: "phase-spec"` 别名行保留）· `face/projection.ts` 核对派生键零改动（errors/SCHEMA_PRIMARY_KEYS 全集运行期自 face/declare.ts 派生 · 无 doc-key 投影字面） — checkable: skeleton/face 词表零 `overall` doc-key 字面（`-overall.md`/`phaseSpec` 豁免）
  - 测试字面 + 快照重锚（deliberate）——全部引擎测试文件 `"overall"` 字面 → `"overall-spec"` · 快照 `project.shape.overall.snap`/`project.schema.overall.snap` 重命名为 `*.overall-spec.snap`（重命名 + 内容键更新）· schema get errors 字面 `"available: overall-spec, plan, phase-spec, plan-graph"` 重锚 — checkable: 快照更名 + 内容键更新落盘 · errors 字面重锚
  - 跑引擎套件核对全绿 — checkable: `pnpm -C packages/cdd-engine test`（vitest run · 529 基线）exit 0 且命名统一重锚零残
  - 零 `overall` doc-key 残留 grep pin — checkable: `grep -rnE 'DocKey = .*"overall"|"overall", "plan"' packages/cdd-engine/src-next` 零命中（引号收口锚 · 不命中改名后 `"overall-spec"` 并集 · `-overall.md` 字面与 `phaseSpec` 别名豁免）
  - 提交为原子 commit（`refactor(cdd-engine): 命名统一 doc-key 词表——overall→overall-spec（deliberate byte sync）`） — checkable: git log 单原子
- **Acceptance**: schema get doc-key 值域 = `single-spec | phase-spec | overall-spec | plan`（errors 字面重锚 · plan-graph 显示型与 phaseSpec 输入别名保留）· judge 派生 `-overall.md → overall-spec` 后现存 4 份整体文档评审仍过 gate（物理文件名未动 · 派生结果与词表对齐）· 引擎 vitest 全绿 · 快照重锚 committed · EOF 恰一 newline
- **DependsOn**: none

### Task 2: single-spec doc 型 + 轻量脚手架（declare 注册表 + 三投影 + skeleton 渲染 + schema get 并入）
- **Objective**: 引擎新增第四个 doc 型 `single-spec`——`declare.ts` 增 `SINGLE_SPEC_ELEMENTS` 注册表（独立于 phase-spec）· DocKey/DocType 并集扩（T1 已含）· Projector/Schema/skeleton 三投影同扩 · `render/skeleton.ts` 增 `#renderSingleSpec` + case 分派 · SCHEMA_TYPE_KEYS 增 `single-spec: "single-spec"` · `schema get single-spec --output skeleton <target>` 直写目标 doc（target 必填 · 复用 P5 条件必填机制）· 骨架 = 轻量脚手架（header 五元组 + 主体 `:::fill` 槽位 + Change history 表 · 无 `### N.` 双层大纲 · 无 Parent program 必填）· slot-consumption 断言覆盖全注册锚
- **Files**:
  - Modify: `packages/cdd-engine/src-next/contract/declare.ts`（`SINGLE_SPEC_ELEMENTS` 注册表 · registry 增 `single-spec` 行）
  - Modify: `packages/cdd-engine/src-next/contract/project.ts`（DocKey 已并集 · SkeletonProjection/SchemaProjection 自动含单型——核对无缺）
  - Modify: `packages/cdd-engine/src-next/render/skeleton.ts`（`#renderSingleSpec` · case 分派）
  - Modify: `packages/cdd-engine/src-next/face/declare.ts`（SCHEMA_TYPE_KEYS 增 `single-spec: "single-spec"`）
  - Modify: `packages/cdd-engine/src-next/face/cli.ts`（schema get `single-spec` 通道 · target 条件必填）
  - Create: `packages/cdd-engine/src-next/contract/__tests__/__snapshots__/project.shape.single-spec.snap`
  - Create: `packages/cdd-engine/src-next/contract/__tests__/__snapshots__/project.schema.single-spec.snap`
  - Modify: `packages/cdd-engine/src-next/render/__tests__/skeleton.test.ts`（single-spec 渲染 pin）
  - Modify: `packages/cdd-engine/src-next/contract/__tests__/project.test.ts`（single-spec 投影 pin）
  - Modify: `packages/cdd-engine/src-next/face/__tests__/cli.test.ts`（schema get single-spec 通道 pin）
- **Consumes**: T1 的 `DocKey` 并集（`single-spec` 已并入类型）· P5 schema get 双渲染面（`--output json|skeleton` · target 条件必填机制 · SCHEMA_TYPE_KEYS）· spec 授权（Q3→a 轻量脚手架 · 与 2026-09-28-cdd-review-contract-fix 形态对齐）
- **Produces**: `schema get single-spec --output skeleton <target>`（直写目标 doc）· `schema get single-spec --output json`（schema 声明面 · 无需 target）· doc-contract 判 single-spec 骨架 by construction 绿 · 供 T3 全量重锚核对
- **Steps**:
  - 写 failing 测试（skeleton 渲染 + 投影）——`render/__tests__/skeleton.test.ts` 增：single-spec 渲染字节 = 期望轻量脚手架（header 五元组 + 主体 `:::fill` 槽位 + Change history 表 · 无 `### N.` · 无 Parent program）· `contract/__tests__/project.test.ts` 增 single-spec 投影形状（docType: "single-spec" · 注册元素集）— checkable: 两测试含期望字节断言且当前红
  - 跑测试核对 FAIL — checkable: `pnpm exec vitest run packages/cdd-engine/src-next/render/__tests__/skeleton.test.ts packages/cdd-engine/src-next/contract/__tests__/project.test.ts` exit 非 0（SkeletonAssembler 无 single-spec case）
  - 新增 `SINGLE_SPEC_ELEMENTS` 注册表（declared 结构）——`contract/declare.ts` 增 `SINGLE_SPEC_ELEMENTS`（标题 · 版本行 · status · author · `- **Depends on**`（header 第五行 · 与 design spec L28 五元组一致）· `## 背景与根因`（prose 槽位锚）· `## 设计裁定` · `## 验收` · `## 约束` · Change history 行）· registry 增 `single-spec: { docType: "single-spec", elements: SINGLE_SPEC_ELEMENTS }` — checkable: 注册表元素按 single 文档序排列且零 `### N.`/Parent program 元素 · header 五元素全（含 Depends on）
  - 实现 `#renderSingleSpec` + case 分派——`render/skeleton.ts` `#compose` 增 `"single-spec"` case → `#renderSingleSpec(probe)`：pushHeader（header 槽位在投影序）· `## 背景与根因`/`## 设计裁定`/`## 验收`/`## 约束` 各 `- :::fill …` 槽位 · `## Change history` 表（HISTORY_HEADER + separator + 首行 v0.1）· `#assertConsumed` 覆盖 single-spec 全注册锚 — checkable: `#assertConsumed` 对 single-spec 投影零 unemitted/零 unregistered
  - SCHEMA_TYPE_KEYS + cli 通道 + target 条件必填——`face/declare.ts` SCHEMA_TYPE_KEYS 增 `single-spec: "single-spec"` · `face/cli.ts` schema get 通道接受 single-spec（`--output json` 无需 target · `--output skeleton <target>` target 必填——复用 P5 target 条件必填机制）· did-you-mean 候选自动随 SCHEMA_TYPE_KEYS 更新 — checkable: `schema get single-spec --output skeleton` 无 target 报条件必填错误（非静默空跑）
  - 跑测试核对 PASS + 全套件 — checkable: `pnpm exec vitest run packages/cdd-engine/src-next/render/__tests__/skeleton.test.ts packages/cdd-engine/src-next/contract/__tests__/project.test.ts packages/cdd-engine/src-next/face/__tests__/cli.test.ts` exit 0（含新 single-spec pins）· 快照 `project.shape.single-spec.snap`/`project.schema.single-spec.snap` 生成
  - 填后 doc-contract 判绿探针——用骨架生成 single-spec 样例并填全文（零 `:::fill` 残留）· `node packages/cdd-engine/src-next/bin.ts review --type spec --spec <样例路径>` — checkable: doc-contract 判绿（结构保真 · 无 findings · gate 零例外）
  - 提交为原子 commit（`feat(cdd-engine): single-spec doc 型 + 轻量脚手架——schema get single-spec --output skeleton`） — checkable: git log 单原子
- **Acceptance**: `schema get single-spec --output skeleton <target>` 直写目标 doc（target 必填 · 无 target → 条件必填错误而非静默空跑）· `--output json` 无需 target · 渲染字节 = header 五元组 + 主体 `:::fill` 槽位 + Change history 表（无 `### N.`/Parent program）· slot-consumption 断言全绿 · 填后 doc-contract 判绿（零 `:::fill` 残留 · semantic 不变）· did-you-mean 候选含 single-spec · EOF 恰一 newline
- **DependsOn**: 1

### Task 3: 引擎 vitest pins 收口（T1/T2 变更后的全量重锚核对）
- **Objective**: T1/T2 变更后对引擎测试面做全量重锚核对——`grep` 残留旧词表字面（`"overall"`/`"single"`），逐处 deliberate 重锚为 `overall-spec`/`single-spec`（快照/字面/pin 全数）· 跑全套件确认引擎 vitest 计数与基线一致（含新增 single-spec pins）
- **Files**:
  - Modify: `packages/cdd-engine/src-next/**/__tests__/`（若有 T1/T2 未覆盖的 `"overall"`/`"single"` 字面）
- **Consumes**: T1 命名统一 + T2 single-spec doc 型（字节面已落）· 引擎 vitest 基线（529）
- **Produces**: 引擎套件全绿（T1/T2 变更的完整回归面 · 快照重锚 committed）· 供 T9 全量验证
- **Steps**:
  - grep 引擎测试面残留旧词表 — checkable: `grep -rnE '"overall"|"single"' packages/cdd-engine/src-next/**/__tests__/` 输出全部落盘（供逐处重锚）
  - 逐处 deliberate 重锚 + 跑全套件——每处命中改为 `overall-spec`/`single-spec`（快照/字面/pin 全数）· `pnpm -C packages/cdd-engine test` — checkable: exit 0 且引擎 vitest 计数 = 基线 + 新增 pins（零残）
  - 提交为原子 commit（`test(cdd-engine): 命名统一 + single-spec 后测试 pins 全量重锚`） — checkable: git log 单原子
- **Acceptance**: `grep -rnE '"overall"|"single"' packages/cdd-engine/src-next/**/__tests__/` 零命中（`-overall.md`/`single-spec` 完整字面豁免）· 引擎 vitest 全绿（T1/T2 + 本任务重锚后）· EOF 恰一 newline
- **DependsOn**: 1, 2

### Task 4: 消费面 skill 字面同步（single-spec / overall-spec 变体名）
- **Objective**: 消费面 skill 字面与引擎词表一致——`cdd-spec-writer`/`cdd-design` 的变体名 `single` → `single-spec` · `overall` → `overall-spec`（目标参数 · 分派字面 · 出口措辞 · `schema get single-spec --output skeleton <target path>` / `schema get overall-spec --output skeleton <target path>`）· `cdd-plan` 变体字面零更替核对（recon 实证无 doc-key/命令字面）· 行为树 pins（presentation-surface.test.ts）零变体 pin 核对 · 物理文件名与历史引用零改（frozen 历史面豁免）
- **Files**:
  - Modify: `packages/kairos/skills/cdd-spec-writer/SKILL.md`（description · author-spec 节点 · single/overall 变体字面 · :3/:29/:37/:39 分派字面）
  - Modify: `packages/kairos/skills/cdd-design/SKILL.md`（description · size? 出口 · 分派字面 · digraph :26 变体名）
- **Consumes**: T1/T2 的引擎字节面（schema get doc-key 值域 = `single-spec|phase-spec|overall-spec|plan`）· spec 授权（Q1→a 消费面字面层 · 物理文件名零改）
- **Produces**: 消费面 skill 字面与引擎词表一致（cdd-spec-writer · cdd-design）· 行为树 pins 零变体核对（presentation-surface.test.ts · recon 实证）· 供 T9 全量验证
- **Steps**:
  - 更新 cdd-spec-writer 变体字面——SKILL.md description/author-spec 节点三变体 `single` → `single-spec` · `overall` → `overall-spec` · 分派字面 `schema get single-spec --output skeleton <target path>`/`schema get overall-spec --output skeleton <target path>` — checkable: SKILL.md 内 `schema get (single|overall)([^-]|$)` 裸字面零残（词边界锚 · `single-spec`/`overall-spec` 全更替）
  - 更新 cdd-design 字面——`cdd-design/SKILL.md` size? 出口 `single` → `single-spec`（single-spec target）· `overall` → `overall-spec`（overall/charter target）· `cdd-plan/SKILL.md` 零变体字面核对（recon 实证 · 不改） — checkable: cdd-design/SKILL.md 变体名与引擎词表一致（cdd-plan 零更替核对）
  - 行为树 pins 零变体核对 + kairos 套件核对——`presentation-surface.test.ts` 行为树 pins 零变体字面（recon 实证 · OLD_KAIROS_SKILL_NAMES :355-358 历史退名 `writing-*-spec` 未含 T1 改名面 · 零更替）· `pnpm -C packages/kairos test` — checkable: exit 0（行为树 + 解剖 + 词面全绿）
  - 消费面残留 grep pin — checkable: `grep -rnE '变体（single([^-]|$)|schema get overall( |$)|--- (single|overall) —' packages/kairos/skills/*/SKILL.md` 零命中（词边界锚 · frozen 历史 doc 内容豁免）
  - 提交为原子 commit（`docs(kairos): 消费面 skill 字面同步——single-spec / overall-spec 变体名`） — checkable: git log 单原子
- **Acceptance**: 消费面 skill 变体名 = `single-spec`/`overall-spec`（cdd-spec-writer/cdd-design SKILL.md 变体字面全更替 · cdd-plan 零变体字面核对不改）· 行为树 pins 零更替核对后 kairos 套件全绿 · 消费面残留 grep pin 零命中（frozen 历史面豁免）· EOF 恰一 newline
- **DependsOn**: 1, 2

### Task 5: kairos vitest 配置落位（全镜像引擎）
- **Objective**: `packages/kairos/vitest.config.ts` 落位（完全镜像引擎 P5 配置：`pool: "forks"` · `maxWorkers: 1` · `fileParallelism: false` · `maxConcurrency: 2` · `testTimeout: 20000` · `include: ["tests/**/*.test.ts"]`）· `package.json#test` → `vitest run` · vitest devDependency 落 kairos（workspace 对齐）· CI `pnpm -C packages/kairos test` 命令字面不变（静态核对）
- **Files**:
  - Create: `packages/kairos/vitest.config.ts`
  - Modify: `packages/kairos/package.json`（`test` script → `vitest run` · devDependencies 增 vitest）
  - Verify: `.github/workflows/pr-validate.yml`（kairos-suite job 命令字面——静态核对零改动）
- **Consumes**: 引擎 vitest.config 先例（P5 · pool forks + 四阈值）· spec 授权（Q4→a 全镜像引擎）
- **Produces**: kairos 套件可 `vitest run` 执行 · CI 命令字面零改动 · 供 T6 迁移
- **Steps**:
  - 写 `packages/kairos/vitest.config.ts`（镜像引擎四阈值）——`pool: "forks"`（node:test 兼容 · 回避 worker_threads 与 execa/git 子进程干扰——kairos 套件子进程密集）· `maxWorkers: 1` · `fileParallelism: false` · `maxConcurrency: 2` · `testTimeout: 20000` · `include: ["tests/**/*.test.ts"]` — checkable: 文件存在且与引擎 vitest.config 四阈值逐项一致
  - package.json test script 切 vitest + devDependency——`scripts.test` → `"vitest run"` · `devDependencies` 增 `vitest`（版本与引擎一致 · workspace 对齐）· `files` 面不新增（vitest.config 非发布产物） — checkable: package.json 字面落位
  - 干跑核对命令字面 + 未迁移状态预期红——`pnpm -C packages/kairos test` — checkable: FAIL/SKIP 且命中预期（vitest include 覆盖 tests/** 但 suite 仍 node:test import · 迁移实现在 T6）+ pr-validate.yml kairos-suite 命令字面零变
  - 提交为原子 commit（`chore(kairos): vitest 配置落位——镜像引擎 forks 池 + 四阈值`） — checkable: git log 单原子
- **Acceptance**: `packages/kairos/vitest.config.ts` 四阈值与引擎一致（pool forks · maxWorkers 1 · fileParallelism false · maxConcurrency 2 · testTimeout 20000）· `pnpm -C packages/kairos test` = `vitest run` · CI kairos-suite 命令字面零改动 · EOF 恰一 newline
- **DependsOn**: none

### Task 6: kairos 测试面全量迁移（11 文件 77 用例 + helpers）
- **Objective**: 11 个 test 文件 + helpers.ts 全量迁移 `node:test`/`node:assert` → vitest 词法——`import { test } from "node:test"` + `import assert from "node:assert/strict"` → `import { expect, test } from "vitest"`（只导入实际使用符号 · 零 `describe()` 现状故不含 describe）· 断言 API 按语义对译（46 assert.match · 39 assert.ok · 14 assert.equal · 11 assert.deepEqual · 7 assert.doesNotMatch · 4 assert.strictEqual · 1 assert.throws 全数对译）· **零 `describe()` 现状保持**（全扁平 `test()` · 不强制结构重排 · 行为等价 · 最小 diff）· 迁移后 `node:test`/`node:assert` in kairos tests 零残留
- **Files**:
  - Modify: `packages/kairos/tests/*.test.ts`（11 文件全量）
  - Modify: `packages/kairos/tests/helpers.ts`（无 import 变更 · 保持现有 const 箭头形态）
- **Consumes**: T5 的 vitest.config（pool forks · include tests/**）· 迁移前行为树基线（77 用例语义）· spec 授权（Q4→a 迁移面 = 11 文件 · Q5→a 消费面无 outdated）
- **Produces**: 迁移后 `pnpm -C packages/kairos test` 全绿（77 用例）· `node:test`/`node:assert` in kairos tests 零残留 · 供 T7 零裸函数收编
- **Steps**:
  - 逐个文件迁移 import 层——11 个 test 文件 `import { test } from "node:test"` + `import assert from "node:assert/strict"` → vitest 词法（`import { expect, test } from "vitest"`——只导入实际使用的符号 · 未来引入 describe 再补 import）· 零 `describe()` 现状保持 — checkable: 全部 import 层迁移 · describe 零引入
  - 断言 API 对译（recon 清单 A/B 对照）——`assert.match`(46) → `expect(s).toMatch(re)` · `assert.ok`(39) → `expect(x).toBeTruthy()` · `assert.equal`(14) → `expect(x).toBe(y)` · `assert.deepEqual`(11) → `expect(x).toEqual(y)` · `assert.doesNotMatch`(7) → `expect(s).not.toMatch(re)` · `assert.strictEqual`(4) → `expect(x).toBe(y)` · `assert.throws`(1) → `expect(fn).toThrow()`（pi-install-smoke.test.ts:120）— checkable: `grep -cE 'assert\.(match|ok|equal|deepEqual|doesNotMatch|strictEqual|throws)' packages/kairos/tests/*.test.ts` 零命中
  - helpers.ts 零 import 变更核对——`helpers.ts` 无 node:test/assert import（recon 实证）· 保持 const 箭头 + `execFileSync` git/mkdtemp — checkable: helpers.ts import 零变
  - 跑迁移后套件全绿 + 残留 grep — checkable: `pnpm -C packages/kairos test` exit 0（77 用例 · vitest run）· `grep -rn "node:test\|node:assert" packages/kairos/tests` 零命中
  - 提交为原子 commit（`refactor(kairos): 测试面 node:test → vitest 全量迁移（11 文件 77 用例）`） — checkable: git log 单原子
- **Acceptance**: `pnpm -C packages/kairos test`（vitest run）77 用例全绿（forks 池承载 ~18+ spawn 子进程套件无 OOM）· `node:test`/`node:assert` in kairos tests 零残留 · 断言 API 全数对译 · 零 `describe()` 结构保持 · 行为等价（测试语义零漂移）· EOF 恰一 newline
- **DependsOn**: 5

### Task 7: kairos tests 零裸函数收编 + check:no-bare-functions scope 扩
- **Objective**: kairos tests 面 **12 处**裸 `function` 全收 `const` 箭头（cdd-plan-spec.test.ts:24 · grep-sweep-regression.test.ts:26 · maintainers-docs.test.ts:59/63/71 · pi-install-smoke.test.ts:30 · pi-package.test.ts:21 · presentation-surface.test.ts:54/61/69/380/396）· root `check:no-bare-functions` scope 扩 `packages/kairos/tests`（与 engine src-next + scripts 并列）· 头注自标与实际一致（helpers/words/skill-anatomy 头注已自称零裸函数纪律适用）
- **Files**:
  - Modify: `packages/kairos/tests/cdd-plan-spec.test.ts:24`
  - Modify: `packages/kairos/tests/grep-sweep-regression.test.ts:26`
  - Modify: `packages/kairos/tests/maintainers-docs.test.ts:59/63/71`
  - Modify: `packages/kairos/tests/pi-install-smoke.test.ts:30`
  - Modify: `packages/kairos/tests/pi-package.test.ts:21`
  - Modify: `packages/kairos/tests/presentation-surface.test.ts:54/61/69/380/396`
  - Modify: `package.json`（root · `check:no-bare-functions` script scope 增 `packages/kairos/tests`）
- **Consumes**: T6 迁移后的 kairos tests 面（12 处裸 function 待收）· spec 授权（Q6→a 连带 · 12 处全收 const 箭头）
- **Produces**: 12 处裸 `function` 全收 `const` 箭头 · `check:no-bare-functions` scope 扩后全树零命中 · 头注自标一致 · 供 T9 全量验证（门禁入 CI）
- **Steps**:
  - 枚举 12 处裸 function 全收 `const` 箭头——`function <name>(...)` → `const <name> = (...) =>`（this/hoisting 语义核对 · 纯 helper 无 this）· 12 处逐一收编 — checkable: `grep -rnE '^(export )?(async )?function ' packages/kairos/tests` 零命中
  - 收编后跑 kairos 套件全绿 — checkable: `pnpm -C packages/kairos test` exit 0（77 用例 · 收编零行为变化）
  - `check:no-bare-functions` scope 扩 + 全树核对——root `package.json#scripts.check:no-bare-functions` 范围增 `packages/kairos/tests`（与 engine src-next + scripts 并列 · 同一正则 `^(export )?(async )?function `）· `pnpm run check:no-bare-functions` — checkable: exit 0（12 处收编后零命中 · scope 扩后门禁绿）
  - 头注自标一致性核对——`helpers.ts:7` · `words.test.ts:11` · `skill-anatomy.test.ts:12` 头注（"零裸函数适用本迁移面"）与实际一致 — checkable: 三头注声明与 grep 零命中实证吻合
  - 提交为原子 commit（`refactor(kairos): kairos tests 零裸函数收编——12 处收 const · check:no-bare-functions scope 扩`） — checkable: git log 单原子
- **Acceptance**: 12 处裸 `function` 全收 `const` 箭头（对每个既有文件再跑 `^(export )?(async )?function ` grep 零命中）· `check:no-bare-functions` scope 扩 `packages/kairos/tests` 后全树零命中（门禁入 CI · no-bare-functions job 命令字面扩展全绿）· kairos 套件全绿 · 头注自标一致 · EOF 恰一 newline
- **DependsOn**: 6

### Task 8: 过时文档清理 + 运维精简（root CLAUDE.md + maintainers 激进收编）
- **Objective**: root CLAUDE.md 三处 P5-stale 超时机制引用改净（:25 `node scripts/run.ts validate` · :43 仓库布局行 · :109 `pnpm run precommit`）· **maintainers 五篇正文 + index（48,555B）激进收编为三篇正文 + index（~13KB · 用户裁定 2026-10-13：运维文档不事无巨细 · 项目本身即 best sample）**——`01-template-doctrine.md`（10,866B · 模板机制地图/叙述）整体删除 · `04-program-experience.md`（15,488B · 程序经验叙述）删为非机械项并入 01 · `06-skill-node-discipline.md`（1,900B · 原则）并入 01 · `02-naming-conventions.md → 02-naming.md`（裁 §2 surfaces 机制地图/§3 migration 历史 · 保术语注册表）· `03-context-caching-doctrine.md → 03-cache-doctrine.md`（裁复述 · 保六公理 + C1-C7）· maintainers README index + ledger 随新家族重锚 · maintainers-docs.test.suite 全套件重锚（CONTENT_DOCS 集改 · smoke 句落 01-doctrine · After==live 保持）· 消费面链接重指（CLAUDE.md:54 · kairos README 双文）· **docs/kairos/{specs,plans} frozen 历史面零动**
- **Files**:
  - Modify: `CLAUDE.md`（:25 · :43 · :109 三处 P5-stale · :54 模板 doctrine 链接 → 01-doctrine.md）
  - Delete: `docs/maintainers/01-template-doctrine.md`（10,866B · §2-§10 机制地图/叙述 · R1-R5 精髓并入 01-doctrine.md）
  - Delete: `docs/maintainers/04-program-experience.md`（15,488B · 58 条 → 非机械项 ~8 条并入 01-doctrine.md）
  - Delete: `docs/maintainers/06-skill-node-discipline.md`（1,900B · 原则并入 01-doctrine.md）
  - Rename: `docs/maintainers/02-naming-conventions.md` → `02-naming.md`（裁 §1-§2 机制/历史 · 保 §3 术语注册表）
  - Rename: `docs/maintainers/03-context-caching-doctrine.md` → `03-cache-doctrine.md`（裁复述 · 保 §1 六公理 + §2 C1-C7）
  - Create: `docs/maintainers/01-doctrine.md`（~3KB · 模板 R1-R5 精髓 + skill-node 原则 + 程序经验非机械项 ~8 条 + smoke-cdd 定位句）
  - Modify: `docs/maintainers/README.md`（index + ledger 随新三篇重锚）
  - Modify: `packages/kairos/tests/maintainers-docs.test.ts`（CONTENT_DOCS = [01,02,03] · smoke 句 target 改 01-doctrine.md · 02 四词 pin 落新名 · ledger 断言保持）
  - Modify: `packages/kairos/README.md` + `packages/kairos/README.zh-CN.md`（04/06/01 链接重指向）
- **Consumes**: 用户裁定 2026-10-13（运维文档不事无巨细 · 项目即 best sample）· P5 解散机制 ground truth（`scripts/run.ts` 仅 emit/emit-check/version-sync · `scripts/validate.ts` 不存在）· 设计 spec v0.2 §5.2（收编边界）· 现 README ledger 的 Before 字节（P4.2→P5 表）· maintainers-docs.test 现断言机制（CONTENT_DOCS 集 · smoke 句 04 → 01 · After==live · ≤56,000）
- **Produces**: root CLAUDE.md 三处 P5-stale 改净 · maintainers 三篇 + index ~13KB（01-doctrine 收编精髓 · 02-naming 注册表 · 03-cache 公理契约）· maintainers-docs.test 全套件绿 · 消费面链接零碎 · frozen 面零动 · 供 T9 全量验证
- **Steps**:
  - 改写 root CLAUDE.md 三处——`:25` `CI runs node scripts/run.ts validate` → 原生命令链（root package.json validate）· `:43` `- scripts/run.ts validate — Node validation orchestration` → validate 原生链 + pr-validate.yml 矩阵 · `:109` `pnpm run precommit (node scripts/run.ts precommit · scripts/validate.ts)` → package.json 原生命令链描述（precommitSteps 表述改 + smoke-cdd 引用撤）· `:54` 模板 doctrine 链接 → `01-doctrine.md` — checkable: 三处改净且语义与 P5 解散后实况一致 · `grep -n "01-template-doctrine" CLAUDE.md` 零命中
  - 删除 `01-template-doctrine.md`（§2 五节点图 · §3 五层收敛 · §4 单面单文件 · §7 失效模式 · §10 范例表 = 机制地图/叙述；§5 R1-R5 规则 + §6 不变量 + §8 缓存集成 + §9 经验烘焙精髓 → 并入 01-doctrine.md） — checkable: `docs/maintainers/01-template-doctrine.md` 不存在 · R1-R5 与 I1-I4 在 01-doctrine.md 存活
  - 创建 `01-doctrine.md`（~8KB · 收编三篇精髓）——模板 doctrine（R1-R5 · I1-I4 · 缓存集成指针）：skill-node 原则（facts only · 四表面）；程序经验非机械项 ~8 条（如 27/30/37/38/41/43/54/58 → 从 04 精编）；**smoke-cdd 定位句**（`consumer-sim = the cdd-engine published-artifact consumer black-box`）必留（test pin） — checkable: 01-doctrine.md 存在 · smoke 定位句原样在 · 无 04/06 整篇复述
  - 更名收编 02——`02-naming-conventions.md → 02-naming.md`：裁 §2 应用面机制表（代码即 sample）· §3.3 migration 历史 + §3.5 保留词 → 简化；保 §3.4 banned 表 + §3.2 active terms（Review Convergence · REVIEW_FIX · TaskGroup · issue 四词 test pin 必须存活）· §3.1 仲裁规则 — checkable: `test "02-naming carries the P4.4 final-state terms"` 绿（CONTENT_DOCS 已改 02-naming.md）
  - 更名收编 03——`03-context-caching-doctrine.md → 03-cache-doctrine.md`：裁 §3-§6 叙述（机制已由 `validateTemplateStructure`/测试强制）；保 §1 六公理表 + §2 C1-C7 契约表（对齐单 return 契约 RETURN_STDOUT_BLOCK v1.9 · 16 tokens） — checkable: 03-cache-doctrine.md 含六公理 + C1-C7 全行 · 无 §5 registry 完整表复述
  - 重锚 `maintainers-docs.test.ts`——CONTENT_DOCS = `[01-doctrine.md, 02-naming.md, 03-cache-doctrine.md]` · smoke 句断言 target 改 `01-doctrine.md` · 02 四词测试文件路径改 `02-naming.md` · 头注（P4.2→P5 叙述）更新为三篇收编事实 · OLD_NAMES 扩展（01-template-doctrine / 02-naming-conventions / 04-program-experience / 06-skill-node-discipline / 03-context-caching-doctrine 入退役名表，活面零引用）· After==live + Total==sum + ≤56,000 断言保持 — checkable: `pnpm -C packages/kairos test` exit 0（maintainers-docs.test 全绿）
  - 重锚对 `docs/maintainers/README.md`——index 三行（01-doctrine · 02-naming · 03-cache）· ledger 表改三篇 + Before（旧字节回填 10,866/9,180/8,450 等）· After==live 真值 · 标题对齐 — checkable: ledger 三行 After == 实况字节 · Total == 行和
  - 消费面链接重指——`packages/kairos/README.md`:100 + `README.zh-CN.md`:102（program-experience/01-template-doctrine 链接 → 01-doctrine.md · 家族描述同步） · root README family 索引零碎 — checkable: `grep -rn "04-program-experience\|06-skill-node\|01-template-doctrine" packages/kairos/README.md packages/kairos/README.zh-CN.md README.md README.zh-CN.md packages/cdd-engine/README*.md` 零命中
  - frozen 面零动核对 + 残留 grep（T8 修改面文件级限定）— checkable: `grep -rn "04-program-experience\|06-skill-node\|01-template-doctrine\|02-naming-conventions\|03-context-caching-doctrine" docs/maintainers/ CLAUDE.md packages/kairos/README.md packages/kairos/README.zh-CN.md` 零命中（docs/kairos/{specs,plans} 冻结历史面不计入）
  - 提交为原子 commit（`docs: maintainers 运维文档激进收编——三篇 + index · 项目即 best sample`） — checkable: git log 单原子
- **Acceptance**: root CLAUDE.md 三处 P5-stale 改净（run.ts validate / validate.ts / smoke-cdd 引用零残）· maintainers 五篇+index 48,555B → **三篇+index ~13KB**（删 01-template-doctrine · 04-program-experience 非机械项并入 · 06-skill-node-discipline 原则并入 · 02/03 更名收编）· R1-R5/I1-I4/六公理/C1-C7/术语注册表/非机械项 全保 · smoke-cdd 定位句落 01-doctrine.md（test pin 重锚全绿）· maintainers-docs.test suite 全绿（CONTENT_DOCS 新集 · After==live · Total==sum · ≤56,000）· 消费面链接零碎（CLAUDE.md:54 · kairos README 双文）· docs/kairos/{specs,plans} frozen 面零动 · EOF 恰一 newline
- **DependsOn**: none

### Task 9: 变更集归并 + 全量验证
- **Objective**: 变更集归并落 pending（cdd-engine：命名统一 + single-spec doc 型；kairos：vitest 迁移 · 不发布）· 全量验证 `pnpm run validate`（或等价 CI 原生序列）ALL PASS——emit-check fresh · 引擎 vitest 全绿（含新 single-spec + 命名统一 pins）· kairos vitest 77 全绿 · typecheck ×3 · version-sync · 零裸函数 grep 零命中（scope 扩后含 kairos tests）· EOF 全绿
- **Files**:
  - Create: `.changeset/<slug>.md`
  - Verify: `pnpm run validate`（或等价 CI 原生序列）
- **Consumes**: T1–T8 全部落地（引擎 + kairos + 文档净树）· 消费面 perspective（变更集面向已发布消费者）
- **Produces**: 变更集归并落 pending · `pnpm run validate`（或等价 CI 原生序列）ALL PASS · EOF 全绿 · 不发布
- **Steps**:
  - 跑全量验证 — checkable: `pnpm run validate` ALL PASS（emit-check fresh · 引擎 vitest 全绿 · kairos vitest 77 全绿 · typecheck ×3 · version-sync · 零裸函数 grep 零命中（scope 扩后含 kairos tests）· EOF 全绿）
  - 变更集归并——`pnpm run changeset`（或手写 `.changeset/<slug>.md`）· cdd-engine（命名统一 + single-spec doc 型 · 语义面 = 新增能力/词表更替）· kairos（vitest 迁移 · patch）· 归并落 pending · 不发布 — checkable: `.changeset/<slug>.md` 存在且归并 pending
  - 提交为原子 commit（`chore(cdd-engine,kairos): P6 变更集归并——命名统一 + single-spec 骨架 + kairos vitest 迁移（不发布）`） — checkable: git log 单原子
- **Acceptance**: `pnpm run validate`（或等价 CI 原生序列）ALL PASS · 变更集归并落 pending（不发布 · tag/publish = 独立动作）· EOF 全绿 · 净树
- **DependsOn**: 1, 2, 3, 4, 5, 6, 7, 8

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.2 | 2026-10-13 | P6 实施计划 v0.2——T8 运维文档激进收编（用户裁定 2026-10-13 · spec v0.2 回填）：T8 由逐行事实修正改为 maintainers 五篇+index 48,555B → 三篇+index ~13KB 收编（删 01-template-doctrine · 04-program-experience 非机械项并入 · 06-skill-node-discipline 并入 · 02/03 更名收编 · 01-doctrine 收编精髓 + smoke 定位句）· 测试全套件重锚 · 消费面链接重指 · Constraints 同步 | Oscar M. · Claude Opus 5（kairos:cdd-plan 修订 · Plan Sole Writer） |
| v0.1 | 2026-10-13 | P6 实施计划 v0.1——single-spec 骨架 + 命名统一 + kairos vitest 迁移 + 过时文档清理（spec v0.1 Approved）：W1{T1 overall-spec 词表改名 · T5 kairos vitest 配置 · T8 文档清理} → W2{T2 single-spec doc 型 · T6 测试文件迁移} → W3{T3 引擎 pins 收口 · T4 消费面字面同步 · T7 零裸函数收编} → W4{T9 变更集} · 任务块全用骨架 task-field 形态（`- **Objective/Files/Consumes/Produces/Steps/Acceptance/DependsOn**:` · step 带 `— checkable:`）· 不发布 | Oscar M. · Claude Opus 5（kairos:cdd-plan · 用户批准） |
