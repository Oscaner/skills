# Pi Harness P1 实施计划（Pi Harness P1 Implementation Plan）

**Spec:** [2026-09-27-pi-harness-p1-design.md](docs/osuperpowers/specs/2026-09-27-pi-harness-p1-design.md)

- **Parent program**: [2026-09-27-pi-harness-overall.md v1.3](docs/osuperpowers/specs/2026-09-27-pi-harness-overall.md)
- **Version**: v1.0 · 2026-09-27
- **Depends on**: P1 design v1.1 Approved（`36e2e8f8`）
- **Base**: develop

## Constraints

### 口径

- **机制口径**：C4 本地安装旗标（`--local`/`--no-approve`）与建机目录 install 语义为**验证中机制**（spec v1.1 C4 verified-vs-probe 口径）——以实测为准；实测与 spec 描述不符 → 不符点作为该任务产出记录，交 orchestrator（Plan Sole Writer）判定 spec 回填后再继续，实现 agent 不改 spec/plan
- **单一真相**：skills 计数经既有 `checkOsuperpowersSkillsCount` 导出共享（EXPECTED）——守卫/测试行为断言不硬编码字面 8；字面 8 仅保留在 C4/C6 消费者可见验收中
- **闭包口径**：files 闭包 = 静态 subset（strip `./` 后目录/文件前缀覆盖判定），validate 循环零 pack 子进程；pack-truth 归 C4 smoke 解包处
- **零网络**：validate 站本地 install 流程不触网；验收两站中 validate 站零网络

### commit 边界机制

- 实现提交按任务粒度（conventional commits，无 attribution trailers）
- spec/plan 文档仅由 orchestrator（Plan Sole Writer）与 cdd fix-agent 修改；implement agent 零文档修改权
- `package.json#pi` 字段为源侧手维护（D2），本 phase 唯一被实现的 manifest 变更；emit 产物不手改（`pnpm run emit:check` 保持 fresh）
- **changeset 义务**：逐 phase 建 changeset（`pnpm run changeset`）——P1 = `@oscaner-skills/osuperpowers`（patch/minor 由 changeset 规则定）；用户若提醒即违例 → dogfood issue

### Flow Atomicity

- 单任务原子：Task 3 实测先行——实测结果与 spec 不符时该任务不"带伤闭合"，不符点以任务产出报告交 orchestrator 判定
- 串行 dispatch：T1→T2→T3→T4，全 singleton 组（无 `## Task Groups` 合并）

### 顺序原则

- T1（源字段+契约 pin）→ T2（一等守卫+命名 pin 升级）→ T3（安装 smoke）→ T4（release 站）：T2 断言 T1 字段、T3 消费 T1 清单形态 + pi 机制实测、T4 最后
- 每任务 end-to-end：实现 → 该任务面测试绿 → 相关 validate 面绿

### 仓库纪律

- node：`fnm use`（.nvmrc v24）；引擎调用 `node packages/cdd-engine/dist/cli.mjs` 直调（`dev:stub` 后），不走 global cdd
- language policy：代码/测试 English-primary（本计划为 internal docs，中文豁免 Strategy B）；无 attribution trailers
- 消费面零程序叙事（iron rule）：SKILL.md / 消费者侧文件不带本程序 phase/issue 叙事
- 引擎 `.mjs` plane zero：新增测试用 node:test `.test.mjs`，src 不落 `.mjs`

### Task 1: C1 源字段 + C3 契约 pin 测试（合并 C1+C3，共享 manifest 契约面）

- **Do**: 在 `packages/osuperpowers/package.json` 增源侧字段 `keywords: ["pi-package"]`（最小集，charter 定）与 `pi: { skills: ["./skills"] }`（D2 手维护；不触 emit 产物与 `.version-bump.json`）。新建 `packages/osuperpowers/tests/pi-package.test.mjs`（纯静态 fs + node:assert，零子进程零引擎依赖）断言活 package.json：`keywords` 含字面 `pi-package`；`pi.skills` deepEqual `["./skills"]`；`pi` 无 `extensions`/`prompts` 键（R0 不变式守门）；`./skills` 解析 EXPECTED 个 `SKILL.md`（EXPECTED 从 `scripts/validate/osuperpowers.ts` 导出计数复用，测试内不硬编码字面 8）；files 闭包静态规则成立（`pi` 声明路径展开集 ⊆ `pkg.files` 白名单展开集）。运行 `node --test packages/osuperpowers/tests/*.test.mjs` 确认新测试在 behavior glob 内通过。
- **验收**: `packages/osuperpowers/package.json` 含 `keywords: ["pi-package"]` 与 `pi: { skills: ["./skills"] }`（无 extensions/prompts）；`pi-package.test.mjs` 在 behavior glob 内通过；`pnpm run emit:check` 仍 fresh（零 emit 产物变更）。
- **注**: 闭包现状已实证（`npm pack --dry-run` 含 `skills/` 全 8 SKILL.md）——本任务不需改 `files`；manifest 契约 pin 即使守卫后续被误删仍独立失败（anti-white-green）。

### Task 2: C2 一等守卫 + C5 命名 pin 升级（合并 C2+C5，共享 validate 接线面）

- **Do**: `scripts/validate/osuperpowers.ts` 增 `checkPiPackageWellFormed(pkgRoot)`（五断言：keywords 含 `pi-package`；`pi.skills` 非空 `string[]` 且每项 `./<path>` glob 形态；`pi` 无 extensions/prompts；`./skills` 解析 EXPECTED 个 `SKILL.md`——EXPECTED 复用既有计数导出，守卫内零硬编码字面；files 闭包静态 subset）+ 新 CheckBlock 步骤「osuperpowers pi-package well-formed」入 `osuperpowersSteps`（自动进 validate + precommit 双面）。同步 `packages/osuperpowers/tests/ci-validate.test.mjs`（~L170-172）与 `scripts/validate/__tests__/pre-commit.test.ts`（L43-51）的 count pin（`==11`）升级为 **name-set 断言**（逐一断言每个期望 step 名出现，含新 step；先读两文件全文核实既有断言内容，避免重复/冲突断言）。`pnpm run validate` 与 precommit 全绿（validate blocks 11→12）。
- **验收**: validate 输出含新 CheckBlock 且对当前树全过（checkPiPackageWellFormed 五断言）；`ci-validate.test.mjs` 与 `pre-commit.test.ts` 以 name-set（非 count）断言 validate steps（含「osuperpowers pi-package well-formed」）；`pnpm run validate` 全绿 + precommit 全绿。
- **注**: 守卫为静态检查（零子进程、零引擎依赖），与既有 `checkOsuperpowersSkillsCount` 同构；skills 计数与其共享单一真相（EXPECTED）。

### Task 3: C4 安装 smoke（R5 站①，含验证中机制实测）

- **Do**: 新建 `packages/osuperpowers/tests/pi-install-smoke.test.mjs`：流程 = `npm pack --pack-destination <mkdtemp>`（cwd `packages/osuperpowers`，产物动态定位不硬编码版本）→ tar 解包（剥离顶层包目录）→ 另建临时「项目」目录作 cwd → `pi install <解包绝对路径> --local --no-approve` → 断言三连：退出码 0 · 安装产物 `skills/` 含恰 8 个 `SKILL.md`（落点为实测确认路径）· 项目 `.pi/settings.json` 写入该包 source。**先实测验证中机制**（`--local`/`--no-approve` 旗标、本地目录 install 语义、产物落点——spec C4 口径）：实测与 spec 描述不符 → 不符点记录为任务产出并交 orchestrator 判定 spec 回填（Plan Sole Writer）。无 `pi` 二进制 → 断言 FAIL 且错误信息含 `npm i -g @earendil-works/pi-coding-agent`（零静默 skip）。`.github/actions/validate` 装配增 `npm i -g @earendil-works/pi-coding-agent` step（版本按 smoke 验收时实测为准）。
- **验收**: `pi-install-smoke.test.mjs` 在本机（pi 0.87.1）behavior glob 内通过：pack→解包→`pi install <dir> --local --no-approve` 退出 0 · 安装产物含恰 8 个 `SKILL.md` · 项目 `.pi/settings.json` 写入该包；缺 pi 路径失败信息含安装命令；`.github/actions/validate` 装配备 pi 安装 step。
- **注**: 本地目录 install 全流程零网络；断言落点与旗标以实测为准（C4 verified-vs-probe 口径）；`pi` 运行时技能清单无 CLI 内省，LLM 可见性不在本测试覆盖（残留记录）。

### Task 4: C6 release npm 路径 smoke（R5 站②）

- **Do**: `.github/workflows/release.yml` 在 release job 内、changesets action 之后增 smoke step：条件复用现「Detect publish-mode push」同款门控（`steps.changesets-status.outputs.has_changesets == 'false'`，changesets push 不发版、跳过 smoke）；临时项目 cwd → `pi install npm:@oscaner-skills/osuperpowers@<版本>`（版本取 changesets action `publishedPackages` output 中 `name === "@oscaner-skills/osuperpowers"` 条目的 `version`）→ 断言三连：退出 0 · 安装产物 `skills/` 恰 8 个 `SKILL.md` · 项目 `.pi/settings.json` 写入该包；workflow job 装配含 `npm i -g @earendil-works/pi-coding-agent`。
- **验收**: `release.yml` 含 publish-mode 门控的 npm 路径 pi smoke step（门控条件、`publishedPackages` 取版本、三断言齐全）；job 装配备 pi 安装。
- **注**: 真消费者路径（registry 发布物），证明分发不依赖仓库工作树；避免 changesets push 时旧版/404 假绿。