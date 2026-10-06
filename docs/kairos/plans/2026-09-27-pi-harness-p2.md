# Pi Harness P2 实施计划（Pi Harness P2 Implementation Plan）

**Spec:** [2026-09-27-pi-harness-p2-design.md](docs/kairos/specs/2026-09-27-pi-harness-p2-design.md)

- **Parent program**: [2026-09-27-pi-harness-overall.md v1.9](docs/kairos/specs/2026-09-27-pi-harness-overall.md)
- **Version**: v1.2 · 2026-09-29
- **Depends on**: P2 design v1.1 Approved（`87b4a57d`，D1–D7 锚点定案）
- **Base**: develop

- **Interface 转录注记**: 各任务 `- **Consumes**: 刻意留空（树迁移 B 转录决策）——源 Do 散文未承载独立具名输入事实，consumes（Task 记录 interface 可选项）不填充；任务输入由 DependsOn/AtomicWith 声明边与 objective/steps 承载，consumer-parity p1–p4.1 因承接具名输入事实而全量填充。

## Constraints

### 口径

- **字节稳定口径（D7）**：`marketplace/source.json` 与 `.claude-plugin/plugin.json` / `.cursor-plugin/plugin.json` 字节与回填前（v1.8 世代）**完全一致**——重 emit 后 `git diff` 产物面零变化；唯一允许的产物变更 = 零（`source.json` 键序 name, contentRoot, cursor, [version/description/author/homepage/repository/license], claude, [hooks] 由 `Object.keys` 测试钉死）
- **声明接缝（C2）**：emit 侧与 validate 侧同读 `pkg.oscaner.harnesses` 同一声明集合——声明集**不经 source.json row 传递**（Non-goal「source.json 面不扩键」）；emitter 内部 `join(root, plugin.contentRoot, "package.json")` 回读
- **单一真相**：skills 计数单一真相 = `scripts/validate/osuperpowers.ts` 模块级 `EXPECTED` / `countSkillsWithMarkdown`（P1 已导出）；`PiHarness.validatePackage` 不 import validate 侧——计数与 `pkgRoot` 由调用侧 ctx 注入（防 lib→validate 反依赖）
- **零残留口径**：`oscaner-plugin` 零残留仅覆盖 live 面（CLAUDE.md / README 家族 / marketplace/README / scripts 源码与测试 / package.json）；`CHANGELOG.md` / `2026-09-13 overhaul family` 为历史豁免（Non-goal「历史记录不 retro-rename」）；`2026-09-27` specs/plans（overall 已随 v1.9 回填 / design / 本计划）的 rename 记录属冻结程序文档（Strategy B），非 live 面——不改不扫
- **lib 共享口径**：validate 侧新增消费仅限于 `scripts/lib`（`harness-registry.ts` + 迁移后的 `deriveFirstPartyNames`）——validate 不 import `scripts/emit`；`deriveFirstPartyNames`（包发现，非 harness 关注点）迁 `scripts/lib` 共享驻留，`ManifestService` 委托保留 emit 侧既有导出面

### commit 边界机制

- 实现提交按任务粒度（conventional commits，无 attribution trailers）
- spec/plan 文档仅由 orchestrator（Plan Sole Writer）与 cdd fix-agent 修改；implement agent 零文档修改权
- 产物重 emit 只发生在任务内原子变更之后（每个任务闭合时 `pnpm run emit:check` 必须 fresh；产物面零 diff 时无需额外产物提交）
- **pre-commit 无 fix 语义（C6）**：T6 迁移后 hook = `pnpm exec lint-staged` 单行——biome check（无 `--write`，staged TS 域）violation 即挡；`* → pnpm run precommit` catch-all 继续门控；`biome:fix` 仅手动自查（hook 不调）；T1–T5 期间旧 hook 仍生效（基线不变），T6 自身提交走新 hook 自证
- **changeset 义务**：P2 终验任务（T6）建 changeset——`@oscaner-skills/osuperpowers` breaking（`oscaner` key rename 发布面破坏性；0.x 下 bump 类型按 `.changeset/README.md` version scheme 判定，先读再判）

### Flow Atomicity

- 单任务原子：每个任务闭合前该任务面测试 + 相关 validate 面全绿；T2/T3 自适应字节 pin 回归（emit.test / harness-registry.test 的 `Object.keys` 序断言 + 产物字节 pin——任一 pin 破即是设计漂移信号，报告 orchestrator 判定而非"带伤闭合"）
- 串行 dispatch：T1→T2→T3→T4→T5，全 singleton 组（无 `## Task Groups` 合并）

### 顺序原则

- T1（C1 抽象模块独立建 + 字节 pin）→ T2（C4 包侧声明 + source.ts registry 派生，原子 rename 束）→ T3（C2 emitter 泛化 + C3 命名 + keywords 单源收编）→ T4（C5 validate 一致守卫 + P1 守卫折叠 + wiring）→ T5（文档 sweep + 零残留 + changeset + 终验）→ T6（提交门工具链：lint-staged + no-fix）
- T6 置末位：P2 验收的 commit 门条目以 T6 为验收主体（T5 终验不含提交门）；T6 自身提交走新 hook 自证
- 每任务 end-to-end：实现 → 该任务面测试绿 → `pnpm run emit:check` fresh → precommit 面绿

### 仓库纪律

- node：`fnm use`（.nvmrc v24）；引擎调用 `node packages/cdd-engine/dist/cli.mjs` 直调（`dev:stub` 后），不走 global cdd
- language policy：代码/测试 English-primary（本计划为 internal docs，中文豁免 Strategy B）；无 attribution trailers
- 消费面零程序叙事（iron rule）：SKILL.md / 消费者侧文件不带本程序 phase/issue 叙事
- 引擎 `.mjs` plane zero：新增测试用 `.test.ts`（vitest）/ `.test.mjs`（node:test），src 不落 `.mjs`


### Task 1: C1 Harness 抽象（scripts/lib/harness-registry.ts + 单测）

- **Objective**: C1 Harness 抽象（scripts/lib/harness-registry.ts + 单测）：Harness 五类 + registry 双射 + 字节 pin

- **Produces**: `scripts/lib/harness-registry.ts`（Harness/CursorHarness/ClaudeHarness/PiHarness/HarnessRegistry/harnessRegistry）+ `harness-registry.test.ts` 全绿；既有树零改动（ManifestService 两 builder 暂留）

- **Files**: scripts/lib/harness-registry.ts, scripts/lib/__tests__/harness-registry.test.ts

- **Steps**:
  1. 新建 `scripts/lib/harness-registry.ts`（域层）——`abstract class Harness`（id · product? · manifest · sourceJson · validatePackage）；`CursorHarness`（product `.cursor-plugin/plugin.json` · sourceJson `{emitMode: "plugin-root"}`）；`ClaudeHarness`（product `.claude-plugin/plugin.json` · sourceJson 聚合 keywords + 缺省即省略）；`PiHarness`（product undefined · sourceJson undefined · validatePackage = P1 五断言折叠，计数经 ctx 注入）；`HarnessRegistry`（all() 固定序 [cursor, claude, pi] · resolve 未知 throw · assertBidirectional）；`export const harnessRegistry` singleton — checkable: `harness-registry.ts` 含全导出；类面 Criterion ②（零裸函数导出）
  2. 新建 `harness-registry.test.ts`：resolve("bogus") throw · all() 迭代序 · assertBidirectional 两向 · Claude/Cursor manifest() 对 source.json 行逐字节 toEqual 现有产物（Object.keys 序含在 toEqual 内）· PiHarness.validatePackage 对活 package.json 五断言全过 + 临时破坏包 throw · sourceJson 描述子 · 派生行键序（Object.keys 严格序） — checkable: `harness-registry.test.ts` 全绿（vitest scripts unit glob 内）；字节 pin 与既有产物一致
  3. 验收：既有树零改动（ManifestService 两 builder 暂留——其删除归 T3，T1 字节 pin 保证两侧一致防漂移）；`pnpm run emit:check` 仍 fresh — checkable: 既有树零改动；`pnpm run emit:check` 仍 fresh

- **Acceptance**:
  - `scripts/lib/harness-registry.ts` 含 `Harness`/`CursorHarness`/`ClaudeHarness`/`PiHarness`/`HarnessRegistry`/`harnessRegistry` 全导出；`harness-registry.test.ts` 全绿（vitest scripts unit glob 内）；既有树零改动（ManifestService 两 builder 暂留——其删除归 T3，T1 字节 pin 保证两侧一致防漂移）；`pnpm run emit:check` 仍 fresh。


### Task 2: C4 包侧声明 + source.ts registry 派生（原子 rename 束）

- **Objective**: C4 包侧声明 + source.ts registry 派生（原子 rename 束）：oscaner key rename + deriveFirstPartyNames 迁移

- **Produces**: `oscaner-plugin` → `oscaner` key rename（harnesses 三含 / keywords 单源 / claude category / 零 harnessesNote）+ `scripts/lib/first-party.ts` + source.ts 经 registry 派生；重 emit 产物字节零变化（D7）

- **Files**: packages/osuperpowers/package.json, scripts/lib/first-party.ts, scripts/emit/source.ts, scripts/emit/manifests.ts, scripts/emit/__tests__/emit.test.ts

- **Steps**:
  1. 原子束：`packages/osuperpowers/package.json` `oscaner-plugin` → **`oscaner`**（D6）；`oscaner.harnesses` = `["claude","cursor","pi"]`；`oscaner.keywords` = `["osuperpowers","cli","cdd","harness"]`；`oscaner.claude` = `{"category":"osuperpowers"}`；删除 `harnessesNote`；顶层 `pi`/`keywords`/`files` 不动 — checkable: `package.json` 以 `oscaner` 键声明（harnesses 三含 / keywords 单源 / claude category / 零 `harnessesNote`）
  2. `scripts/lib/` 新增 `first-party.ts` 固定导出 `deriveFirstPartyNames(packagesRoot)`（包发现，目录过滤 + `pkg.oscaner` 存在性门 + sort）；`manifests.ts` 现 `ManifestService.deriveFirstPartyNames` 迁出为委托 — checkable: `scripts/lib/first-party.ts` 存在且语义与现 manifests 实现一致（emit 既有测试面不变）
  3. `scripts/emit/source.ts`：删 `FIRST_PARTY_CURSOR`；`#deriveFirstParty` 读 `pkg.oscaner`；描述子贡献 = `for (const h of harnessRegistry.all()) { const d = h.sourceJson(osc); if (d) plugin[h.id] = d; }`（cursor 第 3 键 / claude license 后）；`osc.hooks` 传递面保留 — checkable: `source.ts` 零 `FIRST_PARTY_CURSOR` 引用、经 `harnessRegistry` 派生
  4. `emit.test.ts` fixture 键名 `oscaner` + 断言面向 harnessRegistry + source.json 顶层 `Object.keys` 序断言；验证：`pnpm run emit` → `git diff` 产物面**零变化** + `emit:check` fresh — checkable: `git diff` 确认重 emit 产物面字节零变化（D7）；`emit.test.ts` 全绿（含 Object.keys 序断言）；precommit 面绿

- **Acceptance**:
  - `packages/osuperpowers/package.json` 以 `oscaner` 键声明（harnesses 三含 / keywords 单源 / claude category / 零 `harnessesNote`）；`scripts/emit/source.ts` 零 `FIRST_PARTY_CURSOR` 引用、经 `harnessRegistry` 派生；`git diff` 确认重 emit 产物面字节零变化（D7）；`emit.test.ts` 全绿（含 `Object.keys` 序断言）；`pnpm run emit:check` fresh；precommit 面绿。


### Task 3: C2 emitter 泛化 + C3 命名 + keywords 单源收编

- **Objective**: C2 emitter 泛化 + C3 命名 + keywords 单源收编（PluginManifestEmitter + name-dispatch 删除 + 两 builder 删除）

- **Produces**: `scripts/emit/plugin-manifests.ts`（PluginManifestEmitter，声明集直读包侧 harnesses）；`all.ts` 零 name-dispatch；`manifests.ts` 仅余 deriveFirstPartyNames 委托 + generatedBanner

- **Files**: scripts/emit/plugin-manifests.ts, scripts/emit/all.ts, scripts/emit/manifests.ts, scripts/emit/__tests__/emit.test.ts, scripts/lib/__tests__/harness-registry.test.ts

- **Steps**:
  1. `scripts/emit/osuperpowers.ts` → **`scripts/emit/plugin-manifests.ts`**：`OsuperpowersEmitter` → `PluginManifestEmitter`；`emit` 改造：声明集直读包侧——`for (const id of pkg.oscaner.harnesses) { const h = harnessRegistry.resolve(id); if (h.product) writeJsonDoc(h.manifest(plugin, version)); }`——pi 的 `product === undefined` 天然跳过 — checkable: `plugin-manifests.ts` 存在且 `OsuperpowersEmitter`/`osuperpowersEmitter` 字样零残留
  2. `all.ts` 删 `if (plugin.name === "osuperpowers")` name-dispatch → 全 source.plugins × 声明 harness 通用循环 — checkable: `all.ts` 无 name-dispatch 分支
  3. `manifests.ts` 删除 `claudePluginManifest` / `cursorPluginManifest` / `keywords()`；语义变体断言（hooks non-canonical/canonical · cursor 永无 hooks · noSkills 分支）改直调 `ClaudeHarness.manifest` / `CursorHarness.manifest`，落 harness-registry.test.ts（防白绿） — checkable: `manifests.ts` 仅含 `deriveFirstPartyNames`（委托）+ `generatedBanner`；重 emit 产物字节零变化 + `emit:check` fresh；scripts unit 全绿

- **Acceptance**:
  - `scripts/emit/plugin-manifests.ts` 存在且 `OsuperpowersEmitter`/`osuperpowersEmitter` 字样零残留；`all.ts` 无 name-dispatch 分支；`manifests.ts` 仅含 `deriveFirstPartyNames`（委托）+ `generatedBanner`，`keywords()` 与两 builder 删除；重 emit 产物字节零变化 + `emit:check` fresh；scripts unit 全绿。


### Task 4: C5 validate 一致守卫 + P1 守卫折叠 + wiring name-set

- **Objective**: C5 validate 一致守卫 + P1 守卫折叠 + wiring name-set（emit harness registry consistency 三断言）

- **Produces**: `emit harness registry consistency` CheckBlock（resolve / assertBidirectional / product-exists 三断言）；`checkPiPackageWellFormed` 折叠为 PiHarness.validatePackage 薄代理；ci-validate name-set 增新 step 名

- **Files**: scripts/validate/marketplace.ts, scripts/validate/osuperpowers.ts, packages/osuperpowers/tests/ci-validate.test.mjs

- **Steps**:
  1. `scripts/validate/marketplace.ts`（block 6）新增 CheckBlock「emit harness registry consistency」——遍历 `deriveFirstPartyNames(join(root, "packages"))`，读每包 `package.json`：① `oscaner.harnesses` 每项 `harnessRegistry.resolve(id)` 未知 → fail；② `assertBidirectional` 跨全部包声明；③ 每 declared emit-harness（`h.product` 非空）→ product 路径存在于磁盘 — checkable: validate 输出含「emit harness registry consistency」且对当前树全过（三断言）；deliberate-break 探针实证（双射两向 + 未知 id 均 fail）
  2. `checkPiPackageWellFormed(pkgRoot)` 五断言体折叠——薄代理透传 `PiHarness.validatePackage(pkg, { pkgRoot, expectedCount: EXPECTED, countSkills: countSkillsWithMarkdown })`；`countSkillsWithMarkdown` / `EXPECTED` 模块级导出保留 — checkable: `checkPiPackageWellFormed` 五断言在 `PiHarness.validatePackage` 宿主下全绿（block 5b 薄代理 + 日志形态不变）
  3. wiring name-set：`ci-validate.test.mjs` `EXPECTED_VALIDATE_STEPS` 增新 step「emit harness registry consistency」；`pre-commit.test.ts` 零改动或按现状修正；`pi-package.test.mjs` 零改确认通过 — checkable: ci-validate name-set 含新 step；`pi-package.test.mjs` 原样通过；`pnpm run validate` 全绿 + precommit 全绿

- **Acceptance**:
  - validate 输出含「emit harness registry consistency」且对当前树全过（三断言）；`checkPiPackageWellFormed` 五断言在 `PiHarness.validatePackage` 宿主下全绿（block 5b 薄代理 + 日志形态不变）；`pi-package.test.mjs` 原样通过；ci-validate name-set 含新 step；`pnpm run validate` 全绿 + precommit 全绿；deliberate-break 实证记录于任务产出（双射两向 + 未知 id 均 fail）。


### Task 5: 文档 sweep + 零残留 + changeset + 终验收口

- **Objective**: 文档 sweep + 零残留 + changeset + 终验收口（oscaner-plugin → oscaner 词形清扫 7 文件 + changeset 建）

- **Produces**: live 面（CLAUDE.md / README 家族 / marketplace/README / scripts / package.json）零 `oscaner-plugin` 残留；changeset 文件（osuperpowers breaking）；终验（validate 全块 + precommit + emit:check fresh + D7 产物零 diff）

- **Files**: CLAUDE.md, README.md, README.zh-CN.md, marketplace/README.md, packages/osuperpowers/README.md, packages/osuperpowers/README.zh-CN.md, packages/cdd-engine/README.md, packages/cdd-engine/README.zh-CN.md

- **Steps**:
  1. 文档面 rename：`CLAUDE.md`（L13/L31/L33）、`README.md`（L114/L117/L144）、`README.zh-CN.md`（镜像）、`marketplace/README.md`（L3/L9 + 字段清单）`oscaner-plugin` → `oscaner`——**历史豁免 / 程序文档**：CHANGELOG / 2026-09-13 family / 2026-09-27 specs-plans 原文保留 — checkable: live 面零 `oscaner-plugin` 残留（grep 实证，历史豁免文件除外）
  2. 零残留验证：`grep -rn "oscaner-plugin" CLAUDE.md README.md README.zh-CN.md packages/osuperpowers/README.md packages/osuperpowers/README.zh-CN.md packages/cdd-engine/README.md packages/cdd-engine/README.zh-CN.md packages/osuperpowers/package.json marketplace/README.md scripts/ --include=*.ts --include=*.mjs --include=*.md --include=*.json` → 零命中 — checkable: live 面 grep 零命中（历史豁免除外）；`README.zh-CN.md` 与 `README.md` 镜像同步（zh mirror sync checks 绿）
  3. changeset：读 `.changeset/README.md` version scheme → 建 `.changeset/<slug>.md`：`@oscaner-skills/osuperpowers` breaking；终验：`pnpm run emit` + `emit:check` fresh · `pnpm run validate` 全块全绿 · precommit 全绿 · 产物面零 diff（D7） — checkable: changeset 文件存在（breaking 声明）；`pnpm run validate` 全块全绿（emit freshness 在内）

- **Acceptance**:
  - live 面（CLAUDE.md / README 家族 / marketplace/README / scripts 源码与测试 / package.json）零 `oscaner-plugin` 残留（grep 实证，历史豁免文件除外）；`README.zh-CN.md` 与 `README.md` 镜像同步（zh mirror sync checks 绿）；changeset 文件存在（breaking 声明）；`pnpm run validate` 全块全绿（emit freshness 在内）。


### Task 6: C6 提交门工具链（lint-staged · no-fix，2026-09-29 用户拍板并入）

- **Objective**: C6 提交门工具链（lint-staged · no-fix）：pre-commit 迁 `pnpm exec lint-staged` 单行 + biome no-fix 门

- **Produces**: `.husky/pre-commit` = `pnpm exec lint-staged` 单行；`lint-staged.config.mjs`（`*.ts → biome check` 无 `--write` · `* → pnpm run precommit`）；`biome-wiring.test.ts` 重写；lint-staged devDependency

- **Files**: .husky/pre-commit, lint-staged.config.mjs, package.json, scripts/validate/__tests__/biome-wiring.test.ts, CLAUDE.md

- **Steps**:
  1. `.husky/pre-commit` 手写 shell（`pnpm biome:fix` autofix + re-stage 循环 + `pnpm run precommit`）→ **`pnpm exec lint-staged` 单行**（保留 shebang 头；手写 body 删除——re-stage 循环随无-fix 语义消亡） — checkable: `.husky/pre-commit` 内容 = `pnpm exec lint-staged`（单行，手写 biome/restage 零残留）
  2. 新增根 `lint-staged.config.mjs`：`"*.ts": ["biome check"]`（**无 `--write`**）+ `"*": ["pnpm run precommit"]`；`package.json` 新增 `lint-staged` devDependency（落 lockfile）；`biome:fix` 脚本保留为手动自查命令 — checkable: `lint-staged.config.mjs` 存在（`*.ts → biome check` 无 `--write` · `* → pnpm run precommit`）；`biome:fix` 保留手动、hook 零调用
  3. 重写 `scripts/validate/__tests__/biome-wiring.test.ts`（pin 新形态——pre-commit 含 lint-staged 单行 · 配置断言不含 `--write` · catch-all 含 precommit；保留「格式/lint 脏树不可提交」语义） — checkable: `biome-wiring.test.ts` 重写全绿（pin no-fix + catch-all 保留）
  4. CLAUDE.md「Validation and commit flows」pre-commit 描述更新；验证：`pnpm exec lint-staged` 对当前 staged 全绿 + 人为注入 format violation 的 staged 文件被拦实证 + 本任务自身 commit 走新 hook 自证 — checkable: staged TS violation 提交被拦实证一次（任务产出记录）；`pnpm run validate` 全块全绿（含新提交门）

- **Acceptance**:
  - `.husky/pre-commit` 内容 = `pnpm exec lint-staged`（单行，手写 biome/restage 零残留）；`lint-staged.config.mjs` 存在（`*.ts → biome check` 无 `--write` · `* → pnpm run precommit`）；`biome-wiring.test.ts` 重写全绿（pin no-fix + catch-all 保留）；`biome:fix` 保留手动、hook 零调用；staged TS violation 提交被拦实证一次（任务产出记录）；`pnpm run validate` 全块全绿（含新提交门）。
