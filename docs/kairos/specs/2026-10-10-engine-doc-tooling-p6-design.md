---
title: 引擎文档工具（Engine Doc-Tooling）— P6 设计：single-spec 骨架 + 命名统一 + kairos vitest
  迁移 + 过时文档清理
doc-type: phase-spec
version: v0.4
date: 2026-10-13
slug: 2026-10-10-engine-doc-tooling-p6
program: 2026-10-10-engine-doc-tooling
status: Draft
author: Oscar M. · Claude Opus 5（kairos:cdd-design [P6] 会话 · 用户裁定 · 2026-10-13）
---

## Design

本 phase 承接 P5 收口后的连续重构（程序五 phase 全收口后的续 phase · 2026-10-13 cdd-design [P6] 会话注册 D21 · grilling 六裁定 D22 全按推荐落定）。四项工作归一把刀：**文档写作/验证面继续向引擎声明化收敛**——① single-spec 变体从 free-form 升级为骨架化（引擎新增 `single-spec` doc 型 + `:::fill` 脚手架）· ② 命名统一（`single`→`single-spec` · `overall`→`overall-spec` · spec 三元组 `-spec` 后缀统一 · 词表值域层）· ③ kairos 测试面迁 vitest（与引擎同构 · P5 node:test 时代的最后一处 `node --test`）· ④ 过时文档清理 + 运维精简（root CLAUDE.md + maintainers 的 P5-stale 引用）。设计输入：kairos:cdd-design [P6] 会话（D21 注册 · D22 grilling 六裁定）· overall v2.18（D21）→ v2.19（命名统一裁定）→ v2.20（grilling 回填 · working → settled）· recon 报告（kairos 文档面 + 测试迁移面实证）。

### 1. 目标与边界
#### 1.1 设计输入与授权
- 设计输入：kairos:cdd-design [P6] 会话（D21 注册 · D22 grilling 六裁定 Q1→a / Q2→a / Q3→a / Q4→a / Q5→a / Q6→a · overall v2.20）· recon 报告（2026-10-13 · kairos 文档面零 outdated · stale 全在 root CLAUDE.md + maintainers 01/03 · 测试迁移面 11 文件 1862 行 · 子进程密集）
- **授权（D22 Q1→a · 词表值域层）**：命名统一落在 **doc-key 词表值域**（DocKey/DocType 类型值 · schema get 值域 · declare 注册表键 · skeleton 渲染分派 · judge 派生结果 · 消费面 skill 字面）· **物理文件名 `*-overall.md` 保持**（历史 4 份 overall + 全部引用零改名 · judge 派生改 `-overall.md → overall-spec` 映射）· `plan` 裸名不变 · `phase-spec` 不变
- **授权（D22 Q3→a · 轻量脚手架）**：single-spec 骨架 = 头块 + `:::fill` 槽位 + Change history 表 · **自由主体**（比 phase-spec `### N.` 双层大纲更自由）· 与 2026-09-28-cdd-review-contract-fix 形态对齐
- **不发布**（与 P1–P5 一致）：变更集归并落 pending · tag / publish = 独立动作

#### 1.2 四项工作的归因模型
- **两个 domain**：cdd-engine（引擎 · single-spec doc 型 + 命名统一字节面 + 测试 pins）与 kairos（six skills + 消费面字面 + 测试面 node:test→vitest + 文档清理）——命名统一横跨两域（引擎 doc-key 值域 + kairos skill 消费字面）
- **测试面划分（recon 实证）**：kairos 现有 11 test 文件（1862 行含 helpers）全部 `node:test`/`node:assert` · 零 `describe()` · 引擎 `pool: forks` vitest.config = 同构先例
- **文档视角（recon 实证）**：kairos 消费面无 outdated（README/base.md 均当前）· stale 在 **root CLAUDE.md**（3 处 P5 解散机制引用）+ **maintainers（2026-10-13 用户裁定：运维文档不事无巨细，五篇 48,555B 大量机制地图/叙述被实施与测试收编 → 激进收编为三篇 + index（~13KB · 项目本身即最好 sample））** · `docs/kairos/{specs,plans}` 为 frozen 历史面（grep-sweep DOC_ROOT_EXCLUDE_PATHS 显式排除 · 零动）
#### 1.3 非目标（冻结面）
- 领域 run（Lifecycle/PreFlight/Capsule/host）语义零动 · doc-contract 判定语义不变（gate 零例外）· `next:` 字面冻结 · 六命令功能语义不变 · **物理文件名 `*-overall.md` 不改名**（词表值域层授权边界）· `plan`/`phase-spec` 命名不变 · 引擎五面结构不重组（P6 不是在 P5 之上的又一整树重构）· 不发布 · 文档方法论语义不变

### 2. single-spec 骨架（引擎 schema 面）
#### 2.1 single-spec doc 型新增（declare/contract 面）
- 引擎新增第四个 doc 型 **`single-spec`**：`declare.ts` 增 `single-spec` 元素注册表（独立于 phase-spec）· `DocKey`/`DocType` 类型并集扩 `"single-spec"` · Projector 投影/Schema/skeleton 面同扩 · **骨架 = 轻量脚手架（Q3→a）**：header 五元组（title / `- **Version**: v0.1 · <date>` / `**Status**: Draft` / `**Author**` / `- **Depends on**:`）+ 主体 `:::fill` 槽位（`## Background & root cause` / `## Design decisions` / `## Acceptance` / `## Constraints` —— 用户裁定 2026-10-13 英文标题）+ `## Change history` 表（header + separator + 首行 v0.1）
- 与 phase-spec 的差异点：**无 `### N.` 双层设计大纲**（single 是修复/裁决导向自由文档 · 硬套 phase 大纲是错位）· **无 `**Parent program**` 必填**（single 无父整体 · 独立程序形态）
- 注册表元素按 single 文档序排列（标题 · 版本行 · status · author · 主体段 · change history）· **slot-consumption 断言同款**（skeleton 渲染后逐注册锚探测 · 漂移 loud throw）
#### 2.2 schema get 值域并入
- `schema get single-spec --output skeleton <target>` 落位（对齐 phase-spec/overall 语义：target **必填** · 引擎直写目标 doc · 就地生成填 in place）· `--output json` 无需 target · SCHEMA_TYPE_KEYS（face/declare.ts:300）增 `single-spec: "single-spec"` 行
- did-you-mean 候选随命令树更新（`schema get s…` 前缀仍入候选）
- **doc-contract 判定**：single-spec 骨架 by construction 绿（结构 = 声明派生）· 填后 doc-contract 终判兜底（semantic 不变 · single 变体填后 doc-contract 判绿 · 可过 gate）
#### 2.3 cdd-spec-writer single-spec 变体「先 gen 后填」
- 消费面字面：`npx -y @oscaner-skills/cdd-engine@latest schema get single-spec --output skeleton <target path>` → 填 prose in place（与 phase-spec/overall 同款纪律 · I3/消费心智）
- 预提 self-review 同款：spec 覆盖 + 类型一致 + `:::fill` 零残留 + 非豁免 `<…>` 零残留（零残留 pin 保持）

### 3. 命名统一（single-spec + overall-spec 词表）
#### 3.1 词表值域层落点（Q1→a）
- `overall` → **`overall-spec`**：`DocKey = "single-spec" | "phase-spec" | "overall-spec" | "plan"` · declare 元素注册表键（`OVERALL_ELEMENTS` → `OVERALL_SPEC_ELEMENTS` 锚位 · declare.ts:162 · registry 行键 declare.ts:863）· schema get **doc-key 值域**（`single-spec | phase-spec | overall-spec | plan` · **plan-graph 显示型与 phaseSpec 输入别名保留**）· judge `DOC_KEYS` 数组（judge.ts:38）· skeleton 渲染分派（`case "overall"` → `case "overall-spec"` · render/skeleton.ts:112）· Projector 投影键（contract/project.ts:265-275）
- **judge 派生映射**（contract/judge.ts:101）：`-overall.md → overall` 改为 **`-overall.md → overall-spec`**——历史 4 份 `*-overall.md` 物理文件名不变 · 推导结果与词表对齐
- **`plan` 裸名**（Q2→a）· **`phase-spec` 不变**（已在 `-spec` 系内）
#### 3.2 测试 pins 处置（deliberate byte sync）
- 引擎测试锚全量翻新：`project.shape.overall.snap` / `project.schema.overall.snap` 快照 + cli.test.ts / project.test / judge.test 等文件内的 `"overall"` 字面 → `"overall-spec"` · **每处为 deliberate 重锚**（与 P1 usage 重写 P5 字节 major 同级）
- 新增 pinned：`schema get <type>` **doc-key 值域** = `single-spec | phase-spec | overall-spec | plan`（**plan-graph 显示型与 phaseSpec 输入别名保留** · 命名统一只改 doc-key 词表）· 消费面 skill 字面 `single`/`overall` 残留 grep pin（历史 doc 内引用豁免——frozen 历史面不扫）
#### 3.3 消费面 skill 字面同步
- cdd-spec-writer / cdd-design / cdd-plan 的 skill 文本变体名：`single` → `single-spec` · `overall` → `overall-spec`（目标参数 · 分派字面 · 出口措辞）· 行为树 pins（presentation-surface.test.ts）随更替
- **物理文件名与引用零改**（Q1→a 边界）：`docs/kairos/specs/*-overall.md` 4 份 + README 家族指它们的链接零动

### 4. kairos vitest 全量迁移 + 零裸函数收编
#### 4.1 配置（Q4→a · 完全镜像引擎）
- `packages/kairos/vitest.config.ts` 落位：`pool: "forks"`（node:test 兼容模式 · 回避 worker_threads 与 execa/git 子进程干扰——kairos suite 子进程密集 · recon 实证 grep-sweep ~18+ spawn · pi-install-smoke spawn pi/npm/tar）· `maxWorkers: 1` · `fileParallelism: false` · `maxConcurrency: 2` · `testTimeout: 20000` · `include: ["tests/**/*.test.ts"]`
- `packages/kairos/package.json#test` → `vitest run`（CI `pnpm -C packages/kairos test` 与 pr-validate.yml kairos-suite 命令字面不变）· vitest devDependency 落 kairos（workspace 对齐）
#### 4.2 测试文件迁移（11 文件 · 77 用例 · helpers 同迁）
- 全量 `import { test } from "node:test"` / `import assert from "node:assert/strict"` → vitest 词法等价（`import { describe, expect, test } from "vitest"` · `assert.strictEqual` → `expect(...).toBe(...)` 等按语义映射——46 assert.match · 39 assert.ok · 14 assert.equal · 11 assert.deepEqual · 7 assert.doesNotMatch · 4 assert.strictEqual · 1 assert.throws 全部对译）
- **零 `describe()` 现状保持选择**：suite 现为全扁平 `test()`（recon 实证）——迁移不强制结构重排（行为等价 · 最小 diff · 后续如需要再分层）
- helpers.ts 同迁（96 行 · 非测试文件零 node:test/assert import · execFileSync git/mkdtemp 保持）· `fixtures/whitespace.txt` 原样
#### 4.3 零裸函数收编（Q6→a · 连带）
- kairos tests 面 **12 处裸 `function` 全收 `const` 箭头**（recon 实证：cdd-plan-spec.test.ts:24 · grep-sweep-regression.test.ts:26 · maintainers-docs.test.ts:59/63/71 · pi-install-smoke.test.ts:30 · pi-package.test.ts:21 · presentation-surface.test.ts:54/61/69/380/396）· 使 helpers.ts/words.test.ts/skill-anatomy.test.ts 头注自标（"零裸函数适用本迁移面"）与实况一致
- `check:no-bare-functions`（root package.json script · 现只扫 engine + scripts）**scope 扩 `packages/kairos/tests`**——与引擎/scripts 两面对齐 · 门禁入 CI（no-bare-functions job 命令字面扩展）

### 5. 过时文档清理 + 运维精简
#### 5.1 root CLAUDE.md P5-stale 三处（Q5→a 精确边界）
- `CLAUDE.md:25` — `node scripts/run.ts validate`（该 verb 已随 validate 解散消亡 → 指向 root package.json validate 原生命令链）
- `CLAUDE.md:43` — `- scripts/run.ts validate — Node validation orchestration`（仓库布局行 → 删除/改写为 validate 原生链 + pr-validate.yml 矩阵）
- `CLAUDE.md:109` — `pnpm run precommit (node scripts/run.ts precommit, i.e. precommitSteps in scripts/validate.ts)`（两处过时：run.ts precommit verb + scripts/validate.ts 文件均已解散 → 改写为 package.json 原生命令链描述 · smoke-cdd 引用同步撤）
#### 5.2 maintainers 运维文档激进收编（用户裁定 2026-10-13 · 项目即 best sample）
- **家族形态**：五篇正文 + index（48,555B）→ **三篇正文 + index（~13KB）**——收编后 `01-doctrine.md`（模板 doctrine 精髓 + skill-node 原则 + 程序经验非机械项 ~8 条 + smoke-cdd 定位句 pin）· `02-naming.md`（术语注册表）· `03-cache-doctrine.md`（六公理 + C1–C7 契约），index 随新家族重写
- **删**：`01-template-doctrine.md`（10,866B —— 机制地图替代 doctrine）· `04-program-experience.md`（15,488B → 非机械项 ~8 条并入 01）· `06-skill-node-discipline.md`（1,900B 原则并入 01）· **更名** `02-naming-conventions.md → 02-naming.md` · `03-context-caching-doctrine.md → 03-cache-doctrine.md`
- **判定依据**：机制/测试已收编的事实从文档消失（`emit:check`/`validateTemplateStructure`/`maintainers-docs.test` 即 enforcement，文档复述即冗余）· 保留非机械强制的判断/公理/注册表（六公理 · C1–C7 · 术语仲裁 · banned 表 · 非机械经验项）· 测试 pin 重锚随家族更替（`maintainers-docs.test.ts` CONTENT_DOCS 集改 · smoke 句落 01 · ledger After 字节随真值）
- **测试改造**：`maintainers-docs.test.ts` 的 CONTENT_DOCS 集 = `[01-doctrine.md, 02-naming.md, 03-cache-doctrine.md]` · ledger 行随新家族（Before 存原值记录收编前字节）· 02 四词 pin 落新名 · **≤ 56,000 锚与 After==live 断言保持**
- **引用面同步**：`CLAUDE.md:54` template-doctrine 链接 → 新 01 · `packages/kairos/README(.zh).md` 的 program-experience/template-doctrine 链接 → 新家族名 · `04/06` 相关 references（12/13/19/24-25 内部链接）随文重指向
#### 5.3 frozen 历史面零动
- `docs/kairos/{specs,plans}` 不清理（recon 实证 grep-sweep 已显式排除 · 历史记录的 P5-stale 机制字面属合法留置）· 消费面 README/base.md 零 outdated 不需改

### 6. 发布姿态与变更集
- 不发布（与 P1–P5 一致）：cdd-engine 命名统一 + single-spec 新 doc 型为新增能力（kairos 迁移为测试面内部）· changeset 归并落 pending · 无独立 tag/publish

### Acceptance criteria

- `engine `single-spec` doc 型落地 ✓（declare 注册表增型 · DocKey/DocType 并集扩容 · Projector/schema/skeleton 三投影同扩 · `schema get single-spec --output skeleton <target>` 直写目标 doc（target 必填 · `:::fill` 槽位 + Change history 表）· `--output json` 记数面闭包 · did-you-mean 随命令树更新 · slot-consumption 断言全绿）`
- `single-spec 骨架 = 轻量脚手架 ✓（header 五元组 + 主体 fill 槽位 · 无 `### N.` 双层大纲 · 无 Parent program 必填 · 填后零 :::fill 残留 · 填后 doc-contract 判绿（semantic 不变 · gate 零例外））`
- `cdd-spec-writer single-spec 变体「先 gen 后填」✓（schema get single-spec --output skeleton 分派字面 · 预提 self-review 零残留 pin · I3/消费心智同款）`
- `命名统一词表落定 ✓（DocKey = single-spec | phase-spec | overall-spec | plan · schema get doc-key 值域 = 同四值（plan-graph 显示型与 phaseSpec 输入别名保留） · declare 注册键 · judge DOC_KEYS · skeleton 分派 · judge 派生 `-overall.md → overall-spec`）· 物理文件名 `*-overall.md` 零改名 · `plan`/`phase-spec` 命名不变 · 历史引用零 churn`
- `命名统一测试 pins 全量翻新 ✓（引擎快照 project.*.overall.snap → *.overall-spec.snap + cli/project/judge 等测试字面 deliberate 重锚 · 消费面 skill 变体名 single-spec/overall-spec · 行为树 pins 更替 · 消费面 `single`/`overall` 词表残留 grep pin 零命中（frozen 历史面豁免））`
- `kairos vitest 全量迁移 ✓（11 测试文件 77 用例 + helpers.ts 全迁 `vitest` 词法 · package.json test → vitest run · vitest.config.ts 落位（pool forks · maxWorkers 1 · fileParallelism false · maxConcurrency 2 · testTimeout 20000）· CI `pnpm -C packages/kairos test` 字面不变 · 迁移后 `node --test`/`node:test` in kairos tests 零残留（recon 基线 11 文件全 node:test））`
- `kairos tests 零裸函数收编 ✓（12 处裸 function 全收 const 箭头 · check:no-bare-functions scope 扩 packages/kairos/tests · 头注自标与实况一致 · no-bare-functions job 命令字面扩展全绿）`
- `过时文档清理 + 运维精简 ✓（root CLAUDE.md 三处 P5-stale 改净（run.ts validate / validate.ts / smoke-cdd 引用）· maintainers 五篇 + index 48,555B → 三篇 + index ~13KB（删 01-template-doctrine / 04-program-experience / 06-skill-node-discipline · 02-naming-conventions → 02-naming · 03-context-caching-doctrine → 03-cache-doctrine · 非机械项并入 01-doctrine）· maintainers-docs.test 全套件重锚全绿（CONTENT_DOCS 集 · smoke 句落 01 · ledger After==live 保持）· 消费面链接重指（CLAUDE.md:54 · kairos README 双文）· docs/kairos/{specs,plans} frozen 面零动）`
- `引擎 vitest 全绿（含新 single-spec + 命名统一 pins）· kairos suite 全绿（vitest run · 77 用例）· EOF 全绿 · `pnpm run validate`（或等价 CI 原生序列）ALL PASS · 不发布`

## Constraints

- **结构保真**：本骨架 = 声明面派生（`schema get phase-spec --output skeleton`）· 编辑器只填不重排——违反 = 保真破坏，视为 defect
- **命名统一词表值域层**（Q1→a）：`overall`→`overall-spec` 只落 doc-key 词表值域 · **物理文件名 `*-overall.md` 零改名** · `plan`/`phase-spec` 命名不变 · 每处字面为 deliberate（pin 重锚 + 锚同步）
- **single-spec 轻量脚手架**（Q3→a）：header 五元组 + 主体 fill 槽位 · 无 `### N.` 双层大纲 · 无 Parent program 必填 · 自由主体（与 2026-09-28-cdd-review-contract-fix 形态对齐）
- **kairos vitest 全镜像引擎**（Q4→a）：pool forks · maxWorkers 1 · fileParallelism false · maxConcurrency 2 · testTimeout 20000 · CI 命令字面不变
- **零裸函数收编连带**（Q6→a）：kairos tests 12 处裸 function 全收 const 箭头 · check:no-bare-functions scope 扩 · 头注自标一致化
- **文档清理精确边界**（Q5→a + 用户裁定 2026-10-13 激进收编）：root CLAUDE.md 三处 P5-stale + **maintainers 五篇+index 48,555B → 三篇+index ~13KB**（项目即 best sample · 删机制地图/叙述 · 保六公理/C1-C7/术语注册表/非机械项）· **frozen 历史面零动**（docs/kairos/{specs,plans} · grep-sweep 既排除）
- **语义契约保**：退出码表 / CDD_BLOCKED 通道 / doc-contract 判定 / `next:` 字面 / 领域 run 语义——语义不变（命名统一为 deliberate re-anchor · 非行为变更）
- **gate 零例外**：doc-contract 判定语义不变——single-spec 骨架 by construction 绿 · 填后终判兜底
- **不发布**：变更集归并落 pending · tag / publish = 独立动作

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.4 | 2026-10-13 | **P6 closeout（cdd-close）**：设计审查通过（spec review 链 v0.3 Approved）· 计划 v0.3 批准并实现全闭合——四 wave 实现链全绿（W1={1,5,8} single-spec 词表改名 + kairos vitest 配置 + 过时文档清理 → W2={2,6} single-spec doc 型 + 测试文件迁移 → W3={3,4,7} 引擎 pins 收口 + 消费面字面同步 + 零裸函数收编 → W4={9} 变更集）+ 分支终审 → 分支 fix 闭环（branch-review-1 blocker（T8 收编未落地）→ branch-fix：a988a489 单 spec 槽位英文化 + maintainers 三篇收编 · branch-review-2 3 findings（尺寸未达 + ledger Before 求和 + 标题重锚）→ 用户裁定继续精简 → branch-fix-2：7fb24351 maintainers 家族收敛至 13,479B ~13KB + Total Before 守卫 + 标题对齐三件全落地）· 编排器回填（I6 后置：spec/plan 由 v0.1 逐行事实修正 → v0.2 激进收编（用户裁定）→ v0.3 槽位英文化）· 验收全项交付（`pnpm run validate` exit 0 · typecheck ×3 · 引擎 vitest 532/532 · kairos 75/75 · emit-check fresh · version-sync kairos 0.2.0 · cdd-engine 1.0.0 · 零裸函数 grep 零命中 · EOF 全绿 · 不发布）· 父 overall v2.21 登记 P6 → Done | [human] · Claude Opus 5（kairos:cdd-close · closeout-backfill） |
| v0.3 | 2026-10-13 | P6 设计 v0.3——single-spec 槽位标题中文 → 英文（用户裁定 2026-10-13：对齐其他 doc 型 English-primary）：§2.1 槽位 `背景与根因/设计裁定/验收/约束` → `## Background & root cause` / `## Design decisions` / `## Acceptance` / `## Constraints` · plan T2 pin 同步 | Oscar M. · Claude Opus 5（kairos:cdd-design [P6] · 用户裁定） |
| v0.2 | 2026-10-13 | P6 设计 v0.2——运维文档激进收编（用户裁定 2026-10-13：运维文档不事无巨细 · 项目本身即最好 sample）：§5.2 由逐行事实修正改为 maintainers 五篇+index 48,555B → 三篇+index ~13KB 收编（删 01-template-doctrine / 04-program-experience / 06-skill-node-discipline · 更名 02/03 · 非机械项并入 01-doctrine）· Acceptance/Constraint/§1.2 recon 同步 | Oscar M. · Claude Opus 5（kairos:cdd-design [P6] · 用户裁定） |
| v0.1 | 2026-10-13 | P6 设计 v0.1——single-spec 骨架 + 命名统一 + kairos vitest 迁移 + 过时文档清理（D21 注册 · D22 grilling 六裁定）：① single-spec doc 型（轻量脚手架 · header + `:::fill` 槽位 + Change history 表 · schema get single-spec --output skeleton · cdd-spec-writer 先 gen 后填）· ② 命名统一词表值域层（overall→overall-spec · single→single-spec · plan/phase-spec 不变 · 物理文件名 `*-overall.md` 零改名 · judge 派生 `-overall.md → overall-spec`）· ③ kairos vitest 全量迁移（pool forks 镜像引擎 · 11 文件 77 用例 · helpers 同迁）+ 零裸函数收编（12 处收 const · check:no-bare-functions scope 扩）· ④ 过时文档清理（root CLAUDE.md 三处 + maintainers 01:44/03:32 + README ledger · frozen 面零动）· 不发布 · 单 phase-spec 收口 | Oscar M. · Claude Opus 5（kairos:cdd-design [P6] 会话 · 用户裁定 · 2026-10-13） |
