# Pi Harness P1 实施计划（Pi Harness P1 Implementation Plan）

**Spec:** [2026-09-27-pi-harness-p1-design.md](docs/kairos/specs/2026-09-27-pi-harness-p1-design.md)

- **Parent program**: [2026-09-27-pi-harness-overall.md v1.3](docs/kairos/specs/2026-09-27-pi-harness-overall.md)
- **Version**: v1.5 · 2026-09-27
- **Depends on**: P1 design v1.5 Approved（`aac2acc6`，C6 删除 + unpin + 残留清扫）
- **Base**: develop

- **Interface 转录注记**: 各任务 `- **Consumes**: 刻意留空（树迁移 B 转录决策）——源 Do 散文未承载独立具名输入事实，consumes（Task 记录 interface 可选项）不填充；任务输入由 DependsOn/AtomicWith 声明边与 objective/steps 承载，consumer-parity p1–p4.1 因承接具名输入事实而全量填充。

## Constraints

### 口径

- **机制口径**：C4 本地安装旗标**已实测**（pi 0.87.1，T3 测量）：`--local` 写项目 `.pi/settings.json` 需 `--approve`（trust gate——`--no-approve` 与 `--local` 不兼容，exit 1 "Project is not trusted. Use --approve to modify local package config."，按项目信任不持久）→ smoke 一律 `--local --approve`；残余实测不符仍按 verified-vs-probe 口径交 orchestrator（Plan Sole Writer）判定 spec 回填后再继续，实现 agent 不改 spec/plan
- **pi 版本策略**：`@latest` 不固定版本——pi-package 契约须对移动 pi 生态验证；固定旧版 = 守卫随 pi 生态衰减失效（v1.4 裁定，validate CI 装配 + 测试提示命令一致）
- **A3 债吸收口径**：residue.ts A3 的 pi 分支为死代码（守卫前提"pi 在该 package.json 是死残留"被本程序整体取代）——整体退役，不设精确正则、不缩 scope、不盲放行；`\bdroid\b` 分支前提未变、保留；residue.test.ts 断言翻转为放行端态（pi 形 → false）并作新世界态 pin（droid 保持 true）
- **单一真相**：skills 计数单一真相 = `scripts/validate/osuperpowers.ts` 模块级 `EXPECTED`（T1 将 `checkOsuperpowersSkillsCount` 内局部 `const EXPECTED = 8` 提升至模块级并导出 count getter，函数体消费同源；既有实现该常量为函数内局部、无导出）——守卫/测试行为断言统一复用该导出、不硬编码字面 8；字面 8 仅保留在 C4 消费者可见验收与 T1 注闭包实测描述（现状实证、非行为断言，豁免）
- **闭包口径**：files 闭包 = 静态 subset（strip `./` 后目录/文件前缀覆盖判定），validate 循环零 pack 子进程；pack-truth 归 C4 smoke 解包处
- **零网络**：validate 站本地 install 流程不触网（单站验收）

### commit 边界机制

- 实现提交按任务粒度（conventional commits，无 attribution trailers）
- spec/plan 文档仅由 orchestrator（Plan Sole Writer）与 cdd fix-agent 修改；implement agent 零文档修改权
- `package.json#pi` 字段为源侧手维护（D2），本 phase 唯一被实现的 manifest 变更；emit 产物不手改（`pnpm run emit:check` 保持 fresh）
- **changeset 义务**：逐 phase 建 changeset（`pnpm run changeset`）——P1 = `@oscaner-skills/osuperpowers`（patch/minor 由 changeset 规则定）；用户若提醒即违例 → dogfood issue

### Flow Atomicity

- 单任务原子：Task 3 实测先行——实测结果与 spec 不符时该任务不"带伤闭合"，不符点以任务产出报告交 orchestrator 判定
- 串行 dispatch：T1→T2→T3→T4，全 singleton 组（无 `## Task Groups` 合并）

### 顺序原则

- T1（源字段+契约 pin）→ T2（一等守卫+命名 pin 升级）→ T3（安装 smoke）→ T4（C6 撤销 + 全局 unpin）：T2 断言 T1 字段、T3 消费 T1 清单形态 + pi 机制实测、T4 收尾回退（设计评审裁定 v1.4）
- 每任务 end-to-end：实现 → 该任务面测试绿 → 相关 validate 面绿

### 仓库纪律

- node：`fnm use`（.nvmrc v24）；引擎调用 `node packages/cdd-engine/dist/cli.mjs` 直调（`dev:stub` 后），不走 global cdd
- language policy：代码/测试 English-primary（本计划为 internal docs，中文豁免 Strategy B）；无 attribution trailers
- 消费面零程序叙事（iron rule）：SKILL.md / 消费者侧文件不带本程序 phase/issue 叙事
- 引擎 `.mjs` plane zero：新增测试用 node:test `.test.mjs`，src 不落 `.mjs`


### Task 1: C1 源字段 + C3 契约 pin 测试（合并 C1+C3，共享 manifest 契约面）

- **Objective**: C1 源字段（`keywords: ["pi-package"]` + `pi: { skills: ["./skills"] }`）+ C3 契约 pin 测试（合并 C1+C3，共享 manifest 契约面）+ A3 债吸收（residue pi 分支退役）
- **DependsOn**: none

- **Produces**: 源侧 pi 字段落位；`scripts/validate/osuperpowers.ts` 模块级 EXPECTED 导出；`pi-package.test.mjs` 通过 behavior glob；residue A3 pi 分支退役

- **Files**: packages/osuperpowers/package.json, scripts/validate/osuperpowers.ts, packages/osuperpowers/tests/pi-package.test.mjs, scripts/validate/residue.ts, scripts/validate/__tests__/residue.test.ts

- **Steps**:
  1. 在 `packages/osuperpowers/package.json` 增源侧字段 `keywords: ["pi-package"]`（最小集，charter 定）与 `pi: { skills: ["./skills"] }`（D2 手维护；不触 emit 产物与 `.version-bump.json`） — checkable: `package.json` 含 `keywords: ["pi-package"]` 与 `pi: { skills: ["./skills"] }`（无 extensions/prompts）
  2. 前置改动 `scripts/validate/osuperpowers.ts`：将 `checkOsuperpowersSkillsCount` 内局部 `const EXPECTED = 8` 提升为模块级并导出（或导出 count getter）、函数体消费同源 — checkable: 模块级 `EXPECTED` 已导出（T1 测试与 T2 守卫共享同一单一真相）
  3. 新建 `packages/osuperpowers/tests/pi-package.test.mjs`（纯静态 fs + node:assert，零子进程零引擎依赖）断言活 package.json：`keywords` 含字面 `pi-package`；`pi.skills` deepEqual `["./skills"]`；`pi` 无 `extensions`/`prompts` 键（R0 不变式守门）；`./skills` 解析 EXPECTED 个 `SKILL.md`（EXPECTED 从 validate 导出复用，测试内不硬编码 8）；files 闭包静态规则成立。运行 `node --test packages/osuperpowers/tests/*.test.mjs` 确认通过 — checkable: `pi-package.test.mjs` 在 behavior glob 内通过（计数断言取该导出、无字面 8）；`pnpm run emit:check` fresh（零 emit 产物变更）
  4. **A3 债吸收**：退役 `scripts/validate/residue.ts` A3 守卫的 pi 分支（`\bpi\b` 移除；label 改「droid keyword regression (A3 package.json)」）；`residue.test.ts` A3 套件同步——pi 形断言翻转为放行（false）端态 pin，`droid` 保持命中（true） — checkable: residue A3 套件 pi 放行端态 pin + droid 保持 true（新世界态 pin）

- **Acceptance**:
  - `packages/osuperpowers/package.json` 含 `keywords: ["pi-package"]` 与 `pi: { skills: ["./skills"] }`（无 extensions/prompts）；`scripts/validate/osuperpowers.ts` 模块级 `EXPECTED` 已导出（T1 测试与 T2 守卫共享同一单一真相）；`pi-package.test.mjs` 在 behavior glob 内通过（计数断言取该导出、无字面 8）；`pnpm run emit:check` 仍 fresh（零 emit 产物变更）。


### Task 2: C2 一等守卫 + C5 命名 pin 升级（合并 C2+C5，共享 validate 接线面）

- **Objective**: C2 一等守卫 `checkPiPackageWellFormed`（五断言）+ C5 命名 pin 升级（count pin → name-set）
- **DependsOn**: 1

- **Produces**: `checkPiPackageWellFormed(pkgRoot)` 五断言 + 新 CheckBlock step（validate + precommit 双面）；ci-validate/pre-commit count pin 升级 name-set

- **Files**: scripts/validate/osuperpowers.ts, packages/osuperpowers/tests/ci-validate.test.mjs, scripts/validate/__tests__/pre-commit.test.ts

- **Steps**:
  1. `scripts/validate/osuperpowers.ts` 增 `checkPiPackageWellFormed(pkgRoot)`（五断言：keywords 含 `pi-package`；`pi.skills` 非空 `string[]` 且每项 `./<path>` glob 形态；`pi` 无 extensions/prompts；`./skills` 解析 EXPECTED 个 `SKILL.md`——EXPECTED 复用既有计数导出、守卫内零硬编码字面；files 闭包静态 subset）+ 新 CheckBlock step「osuperpowers pi-package well-formed」入 `osuperpowersSteps` — checkable: validate 输出含新 CheckBlock 且对当前树全过（checkPiPackageWellFormed 五断言）
  2. 同步 `packages/osuperpowers/tests/ci-validate.test.mjs` 与 `scripts/validate/__tests__/pre-commit.test.ts` 的 count pin（`==11`）升级为 **name-set 断言**（逐一断言每个期望 step 名出现，含新 step；先读两文件全文核实既有断言内容避免重复/冲突） — checkable: `ci-validate.test.mjs` 与 `pre-commit.test.ts` 以 name-set（非 count）断言 validate steps（含「osuperpowers pi-package well-formed」）
  3. `pnpm run validate` 与 precommit 全绿（validate blocks 11→12） — checkable: `pnpm run validate` 全绿 + precommit 全绿

- **Acceptance**:
  - validate 输出含新 CheckBlock 且对当前树全过（checkPiPackageWellFormed 五断言）；`ci-validate.test.mjs` 与 `pre-commit.test.ts` 以 name-set（非 count）断言 validate steps（含「osuperpowers pi-package well-formed」）；`pnpm run validate` 全绿 + precommit 全绿。


### Task 3: C4 安装 smoke（R5 站①，含验证中机制实测）

- **Objective**: C4 安装 smoke（R5 站①，含验证中机制实测）：新建 pi-install-smoke.test.mjs + validate 装配 pi 安装 step
- **DependsOn**: 2

- **Produces**: `pi-install-smoke.test.mjs`（pack → 解包 → `pi install <dir> --local --approve` → 三连断言）；`.github/actions/validate` 增 `npm i -g @earendil-works/pi-coding-agent` step

- **Files**: packages/osuperpowers/tests/pi-install-smoke.test.mjs, .github/actions/validate/action.yml

- **Steps**:
  1. 新建 `packages/osuperpowers/tests/pi-install-smoke.test.mjs`：流程 = `npm pack --pack-destination <mkdtemp>`（cwd `packages/osuperpowers`）→ tar 解包（剥离顶层包目录）→ 另建临时「项目」目录作 cwd → `pi install <解包绝对路径> --local --approve` → 断言三连：退出码 0 · 安装产物 `skills/` 含恰 8 个 `SKILL.md` · 项目 `.pi/settings.json` 写入该包 source — checkable: `pi-install-smoke.test.mjs` 在本机（pi 0.87.1）behavior glob 内通过：pack→解包→`pi install <dir> --local --approve` 退出 0 · 安装产物含恰 8 个 `SKILL.md` · 项目 `.pi/settings.json` 写入该包
  2. 旗标已实测定案（0.87.1：`--local` 需 `--approve`，`--no-approve` 弃用）；其余机制（产物落点）以本任务实现期探针实测为准，实测与 spec 描述不符 → 不符点记录为任务产出并交 orchestrator 判定 spec 回填 — checkable: 无 `pi` 二进制 → 断言 FAIL 且错误信息含 `npm i -g @earendil-works/pi-coding-agent`（零静默 skip）
  3. `.github/actions/validate` 装配增 `npm i -g @earendil-works/pi-coding-agent` step（版本按 smoke 验收时实测为准） — checkable: `.github/actions/validate` 装配备 pi 安装 step

- **Acceptance**:
  - `pi-install-smoke.test.mjs` 在本机（pi 0.87.1）behavior glob 内通过：pack→解包→`pi install <dir> --local --approve` 退出 0 · 安装产物含恰 8 个 `SKILL.md` · 项目 `.pi/settings.json` 写入该包；缺 pi 路径失败信息含安装命令；`.github/actions/validate` 装配备 pi 安装 step。


### Task 4: C6 撤销 + 全局 unpin（设计评审裁定 v1.4）

- **Objective**: C6 撤销 + 全局 unpin（设计评审裁定 v1.4）：release smoke 站移除 + @latest 不固定版本
- **DependsOn**: 3

- **Produces**: release.yml 恢复 C6 前状态（pi smoke 段移除）；actions/validate pi install 改 `@latest`（理由注明）

- **Files**: .github/workflows/release.yml, .github/actions/validate/action.yml

- **Steps**:
  1. 撤销 C6 release 站：`.github/workflows/release.yml` 移除 smoke 段（pi install step + smoke step + 版本提取逻辑 + 相关 gate/if），恢复至 C6 前的 release 链状态（**先 `git show 9872cf2f^:.github/workflows/release.yml` 对照原始版保证精确还原，不留 smoke 残迹**） — checkable: `release.yml` 不再含 pi smoke（grep `pi install` 零命中）
  2. `.github/actions/validate` 装配的 pi install 改 `npm i -g @earendil-works/pi-coding-agent@latest`（删「Pinned to the version measured at smoke acceptance」注释，改注明 @latest 不固定版本的理由）；release.yml 中同款 pin 一并清理 — checkable: `.github/actions/validate` 装配含 `@latest`（grep `pi-coding-agent@` 版本字面零命中）
  3. `pnpm run validate` + precommit 全绿（不含其他 release 链变更——裁定依据：post-publish smoke = detect-only 无门控 + 内容与 C4 同构 + claude/cursor 无 post-publish smoke 一致性） — checkable: `pnpm run validate` + precommit 全绿

- **Acceptance**:
  - `release.yml` 不再含 pi smoke（grep `pi install` 零命中）；`.github/actions/validate` 装配含 `@latest`（grep `pi-coding-agent@` 版本字面零命中）；`pnpm run validate` + precommit 全绿。

## Change history

| Version | date | summary | author |
|---|---|---|---|
| v1.5 | 2026-09-27 | （迁移建档——版本谱系自 `**Version**` 头转录 · 原头未载变更摘要） | [human] |
