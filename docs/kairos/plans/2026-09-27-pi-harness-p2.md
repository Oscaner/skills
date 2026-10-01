# Pi Harness P2 实施计划（Pi Harness P2 Implementation Plan）

**Spec:** [2026-09-27-pi-harness-p2-design.md](docs/kairos/specs/2026-09-27-pi-harness-p2-design.md)

- **Parent program**: [2026-09-27-pi-harness-overall.md v1.9](docs/kairos/specs/2026-09-27-pi-harness-overall.md)
- **Version**: v1.2 · 2026-09-29
- **Depends on**: P2 design v1.1 Approved（`87b4a57d`，D1–D7 锚点定案）
- **Base**: develop

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

- **Do**: 新建 `scripts/lib/harness-registry.ts`（共享域层，与 `scripts/lib/marketplace-utils.ts` 同级）——OOP 抽象：
  - `abstract class Harness`：`id`（`"claude"` | `"cursor"` | `"pi"`）· `product?: { rel: string }`（文件产物相对 contentRoot 路径；`undefined` = inline 分发）· `manifest(plugin, version): object`（构建 manifest 文档）· `sourceJson(osc): object | undefined`（source.json 描述子贡献；`undefined` = 不产生）· `validatePackage(pkg, ctx): void`（包面契约；默认 no-op）
  - `class CursorHarness extends Harness`：`product` = `{ rel: ".cursor-plugin/plugin.json" }`；`manifest` = 现 `cursorPluginManifest` 逻辑（字节 pin 保证与既有产物一致）；`sourceJson(osc)` = `{ emitMode: "plugin-root" }`（现 `FIRST_PARTY_CURSOR` 值迁入）
  - `class ClaudeHarness extends Harness`：`product` = `{ rel: ".claude-plugin/plugin.json" }`；`manifest` = 现 `claudePluginManifest` 逻辑（含 hooks non-canonical 语义 + noSkills 分支形态；字节 pin）；`sourceJson(osc)` = `osc.claude === undefined ? undefined : { ...osc.claude, keywords: osc.keywords ?? osc.claude?.keywords }`——缺省即省略 claude 顶层字段（`undefined` 被贡献循环 `if (d)` 跳过，与现 `if (osc.claude !== undefined)` 行为一致，防未来无 claude 字段的包落 `claude: {}` 漂移）；keyword 聚合是 D7 字节稳定的唯一调和点
  - `class PiHarness extends Harness`：`product` = `undefined`；`manifest` 不适用（throw 或不可达——由调用形态保证）；`sourceJson` = `undefined`；`validatePackage(pkg, ctx: { pkgRoot: string, expectedCount: number, countSkills: (dir: string) => number })` = P1 五断言折叠（keywords `pi-package` 字面 · `pi.skills` 非空 `./<path>` glob 形态 · 无 `extensions`/`prompts` · 每 glob 解析 `expectedCount` 个 SKILL.md · files 闭包静态 subset strip `./` `/` 前缀覆盖）——`pkgRoot` 支撑断言 4/5 的 disk 解析基准，计数经 ctx 注入
  - `class HarnessRegistry`：构造收 `Harness[]`；`all(): Harness[]` **固定迭代序 `[CursorHarness, ClaudeHarness, PiHarness]`**（source.json 行键序：cursor 第 3 位赋键、claude 经元数据块后赋键——序断言源）；`resolve(id): Harness` 未知 → throw（错误含 id 与可选包名）· `assertBidirectional(declarations: Record<string, string[]>): void`——注册表全行 ∈ 声明并集 ∧ 每声明 ∈ 注册表，违反列条目级报错（注册未接线 / 声明未注册）
  - `export const harnessRegistry = new HarnessRegistry([cursor, claude, pi])`（singleton，与 `sourceService`/`manifestService` 同级）
- 新建 `scripts/lib/__tests__/harness-registry.test.ts`（vitest，自动进 scripts unit glob）：
  - `resolve("bogus")` throw（含 id 文本）· `all()` 迭代序 `[cursor, claude, pi]`
  - `assertBidirectional`：注册表有一行未被声明 → throw（注明该行 id）；声明含未注册 id → throw——两向各测
  - Claude/Cursor `manifest()` 对 `marketplace/source.json` 的 osuperpowers 行 + 0.2.0 版本逐字节 `toEqual` 现有 `.claude-plugin/plugin.json` / `.cursor-plugin/plugin.json` 产物（`Object.keys` 序含在 toEqual 内）
  - `PiHarness.validatePackage` 对活 `packages/osuperpowers/package.json`（ctx：`pkgRoot = packages/osuperpowers`、`expectedCount = 8`、`countSkills` 传 `countSkillsWithMarkdown` 同构实现或自建 dir-count）五断言全过；一个临时破坏包（如 `pi.skills` 含 `extensions` 或 files 闭包缺口）→ throw 实证
  - `sourceJson` 描述子：cursor → `{ emitMode: "plugin-root" }` · claude 输入 `{ claude: { category, keywords }, keywords: [...] }` 聚合保持两源值 · claude 缺 `claude` 字段 → `undefined`（被贡献循环跳过，缺省即省略）· pi → `undefined`
  - 派生行键序：以 registry 描述子 + 元数据块装配的 plugin row，`Object.keys(row)` 严格等于 `["name","contentRoot","cursor","version","description","author","homepage","repository","license","claude"]`（`hooks` 存在时为末位）——序断言像素级，非仅 JSON 语义
- **验收**: `scripts/lib/harness-registry.ts` 含 `Harness`/`CursorHarness`/`ClaudeHarness`/`PiHarness`/`HarnessRegistry`/`harnessRegistry` 全导出；`harness-registry.test.ts` 全绿（vitest scripts unit glob 内）；既有树零改动（ManifestService 两 builder 暂留——其删除归 T3，T1 字节 pin 保证两侧一致防漂移）；`pnpm run emit:check` 仍 fresh。
- **注**: builder 逻辑以 T1 的 harness 类为新真源（字节 pin 保证与 ManifestService 现实现一致）；两实现并存窗口内由字节 pin 双向约束，任何 drift 在 T1 即炸。

### Task 2: C4 包侧声明 + source.ts registry 派生（原子 rename 束）

- **Do**: 原子束（`oscaner` key rename + 消费点同 commit 切换——presence gate 翻转若与消费间不原子，deriveFirstPartyNames 丢包即 emit 产物消失）：
  - `packages/osuperpowers/package.json`：`oscaner-plugin` → **`oscaner`**（D6）；`oscaner.harnesses` = `["claude","cursor","pi"]`（D1 全配送面）；`oscaner.keywords` = `["osuperpowers","cli","cdd","harness"]`（D5 插件级单源，值取现 `oscaner-plugin.claude.keywords` 迁移）；`oscaner.claude` = `{ "category": "osuperpowers" }`；**删除 `harnessesNote`**。顶层 `pi` / `keywords: ["pi-package"]` / `files` 不动
  - `scripts/lib/` 新增独立 `first-party.ts`，固定导出 `deriveFirstPartyNames(packagesRoot): string[]`——包发现，非 harness 关注点，不与 `harness-registry.ts` 同模块合并（spec C2 职责分离）；语义 = 现 `scripts/emit/manifests.ts` 实现：目录过滤 + `pkg.oscaner` 存在性门 + sort；现 `ManifestService.deriveFirstPartyNames` 迁出为委托（emit 既有调用面/测试面不变）
  - `scripts/emit/source.ts`：删 `FIRST_PARTY_CURSOR` 常量；`#deriveFirstParty` 读 `pkg.oscaner`；描述子贡献 = `for (const h of harnessRegistry.all()) { const d = h.sourceJson(osc); if (d) plugin[h.id] = d; }`——cursor（第 3 键）/ claude（license 后）按序赋键：cursor 恒贡献（承接现无条件赋键语义）；claude 缺省即省略（`ClaudeHarness.sourceJson` 在 `osc.claude === undefined` 时返回 `undefined` 被 `if (d)` 跳过，与现 `if (osc.claude !== undefined)` 一致，防落 `claude: {}`）；`osc.claude` override 语义由 `ClaudeHarness.sourceJson` 聚合消化（不再行内展开）；`if (osc.hooks !== undefined) plugin.hooks = osc.hooks;` row 末位保留（C4「osc.hooks 传递面随行保留」）
  - `scripts/emit/manifests.ts`：`deriveFirstPartyNames` 改委托 lib 导出；`keywords()` 暂留（T3 删除）；`claudePluginManifest`/`cursorPluginManifest` 暂留（T3 删除，T1 pin 已约束一致）
  - `scripts/emit/__tests__/emit.test.ts`：fixture 键名 `oscaner`；断言面向 `harnessRegistry`（字节 pin 保持）；`source.json` 顶层 `Object.keys` 序断言加入
  - 验证：`pnpm run emit` → `git diff` 产物面（source.json / .claude-plugin / .cursor-plugin / marketplace docs）**零变化**；`pnpm run emit:check` fresh；vitest scripts unit 全绿
- **验收**: `packages/osuperpowers/package.json` 以 `oscaner` 键声明（harnesses 三含 / keywords 单源 / claude category / 零 `harnessesNote`）；`scripts/emit/source.ts` 零 `FIRST_PARTY_CURSOR` 引用、经 `harnessRegistry` 派生；`git diff` 确认重 emit 产物面字节零变化（D7）；`emit.test.ts` 全绿（含 `Object.keys` 序断言）；`pnpm run emit:check` fresh；precommit 面绿。
- **注**: 本任务把 C4 声明与 source.ts 消费一次落定——`oscaner` 键在此 commit 起为唯一真源；emit 产物键序 drift 在 T1 序断言 + 本任务 `Object.keys` 断言双闸拦截。

### Task 3: C2 emitter 泛化 + C3 命名 + keywords 单源收编

- **Do**: 通用 emitter + 收编尾：
  - `scripts/emit/osuperpowers.ts` → **`scripts/emit/plugin-manifests.ts`**：`OsuperpowersEmitter` → `PluginManifestEmitter`，singleton 名 `pluginManifestEmitter`（C3 doc word = code word）。构造注入不变（MarketplaceService + ManifestService + EmitOrchestrator 现形态）。`emit(outRoot, plugin, generatedPaths)` 改造：**声明集直读包侧**——`const pkg = JSON.parse(readFileSync(join(root, plugin.contentRoot, "package.json")))`；`for (const id of pkg.oscaner.harnesses) { const h = harnessRegistry.resolve(id); if (h.product) this.writer.writeJsonDoc(outRoot, `${contentRoot}/${h.product.rel}`, h.manifest(plugin, version), generatedPaths); }`——pi 的 `product === undefined` 天然跳过（无分支特判）
  - `scripts/emit/all.ts`：删 `if (plugin.name === "osuperpowers")` name-dispatch → 全 `source.plugins` × 声明 harness 通用循环（osuperpowersEmitter 引用改 `pluginManifestEmitter`）
  - `scripts/emit/manifests.ts`：删除 `claudePluginManifest` / `cursorPluginManifest` / `keywords()`（fallback 链删除——D5 语义 = 声明缺失即缺省，不 throw 不 fallback）；`ManifestService` 仅留委托后的 `deriveFirstPartyNames`（lib 面）+ `generatedBanner` export。Claude/Cursor manifest 的 keywords 消费点 = 派生 row 的 `claude.keywords`（T1 `ClaudeHarness.sourceJson` 聚合过的单源值）——T1 `manifest()` 实现即此消费点，无需本任务改动
  - `scripts/emit/__tests__/emit.test.ts`：builder 级断言迁移目标定死（emit.test 现 L37-95 直调 builder 的断言随两 builder 删除移除；T1 harness-registry.test 仅字节 pin 默认形态，hooks/noSkills 语义不可丢）——语义变体断言（hooks non-canonical：自定义 `./hooks/claude.json` → `manifest.hooks` 保留 · canonical `./hooks/hooks.json` → 省略；cursor 永无 hooks 字段；`noSkills` 分支省略 skills 字段）改为直调 `ClaudeHarness.manifest` / `CursorHarness.manifest`，落 `scripts/lib/__tests__/harness-registry.test.ts`（承接 spec C4「既有 hooks pin（L65-94）保持」，防白绿）；默认形态断言已由 harness-registry.test 的逐字节 pin 覆盖，随 builder 删除移除；emitter 级断言改引用 `pluginManifestEmitter`
  - 验证：`pnpm run emit` → 产物面字节零变化（D7）；`grep -r "osuperpowersEmitter\|OsuperpowersEmitter" scripts/` 零命中；vitest scripts unit 全绿（emit.test 相应断言改引用 `pluginManifestEmitter`）
- **验收**: `scripts/emit/plugin-manifests.ts` 存在且 `OsuperpowersEmitter`/`osuperpowersEmitter` 字样零残留；`all.ts` 无 name-dispatch 分支；`manifests.ts` 仅含 `deriveFirstPartyNames`（委托）+ `generatedBanner`，`keywords()` 与两 builder 删除；重 emit 产物字节零变化 + `emit:check` fresh；scripts unit 全绿。
- **注**: 产物字节零变化 = 本任务全部改动的唯一回归判据（emitter 写法重构、builder 收编、name-dispatch 删除三者叠加不得扰动任何产物字节）。

### Task 4: C5 validate 一致守卫 + P1 守卫折叠 + wiring name-set

- **Do**: validate 侧一致机制 + P1 守卫宿主迁移：
  - `scripts/validate/marketplace.ts`（block 6，泛 first-party）：新增 CheckBlock「emit harness registry consistency」——遍历 `deriveFirstPartyNames(join(root, "packages"))`（从 `scripts/lib` import），读每包 `package.json`：① `oscaner.harnesses` 每项 `harnessRegistry.resolve(id)`，未知 → fail（报错含包名 + id + 期望/实际）；② `harnessRegistry.assertBidirectional({ [pkgName]: pkg.oscaner.harnesses ?? [] })` 跨全部包声明（注册未接线 → fail）；③ 每 declared emit-harness（`h.product` 非空）→ `join(root, pkg.contentRoot, h.product.rel)` 存在于磁盘。**validate 首次 import `scripts/lib`**（`harnessRegistry` + `deriveFirstPartyNames`——"产物读者 + 注册表契约消费方"分层升级，见 spec C5）
  - `scripts/validate/osuperpowers.ts`：`checkPiPackageWellFormed(pkgRoot)` 五断言体折叠——改为薄代理透传 `PiHarness.validatePackage(pkg, { pkgRoot, expectedCount: EXPECTED, countSkills: countSkillsWithMarkdown })`（assertion 面不变，日志文案保留「osuperpowers pi-package well-formed」）；`countSkillsWithMarkdown` / `EXPECTED` 模块级导出保留
  - wiring name-set：`packages/osuperpowers/tests/ci-validate.test.mjs` 的 `EXPECTED_VALIDATE_STEPS` 增新 step 名「emit harness registry consistency」（P1 C5 name-set 语义延续）；`pre-commit.test.ts` 零改动（`arrayContaining` + strict-exclusion 形态，先读文件核实，若形态不符按实现修正并在任务产出说明）
  - 实测：对活树跑 `node scripts/validate/marketplace.ts`（或 runner 注入）→ 三断言全过；**deliberate-break 探针**：临时 mkdtemp 包目录（含 `oscaner` 键 + `harnesses: ["bogus"]`）注入 same-root 硬化测试或临时下断言 fail 实证一次后移除——实证「未知 harness → fail」与「注册未接线 → fail」（注册表一行临时从包声明剔除不可行——用测试内构造两包 fixture 断言双射两向失败）
  - `packages/osuperpowers/tests/pi-package.test.mjs` **零改**（import 面保留）确认通过
- **验收**: validate 输出含「emit harness registry consistency」且对当前树全过（三断言）；`checkPiPackageWellFormed` 五断言在 `PiHarness.validatePackage` 宿主下全绿（block 5b 薄代理 + 日志形态不变）；`pi-package.test.mjs` 原样通过；ci-validate name-set 含新 step；`pnpm run validate` 全绿 + precommit 全绿；deliberate-break 实证记录于任务产出（双射两向 + 未知 id 均 fail）。
- **注**: 零残留口径——P1 五断言文本仍由 `PiHarness` 唯一持有（spec D3）；本任务不触碰 engine 面（spec D4 归 P3）。

### Task 5: 文档 sweep + 零残留 + changeset + 终验收口

- **Do**: 文档面 rename + 收口：
  - `CLAUDE.md`（L13/L31/L33 三处 `oscaner-plugin` → `oscaner`）+ `README.md`（L114/L117/L144 三处）+ `README.zh-CN.md`（镜像同步，两文件一并改）+ `marketplace/README.md`（L3/L9 两处 + 字段清单更新为 `oscaner` 下 contentRoot/harnesses/keywords/claude）——**历史豁免 / 程序文档**：`packages/osuperpowers/CHANGELOG.md` / `2026-09-13 overhaul family` 原文保留；`2026-09-27` specs/plans（overall 已随 v1.9 回填 / design / 本计划）的 rename 记录属冻结程序文档，非 live 面——不改不扫
  - 零残留验证：grep 限定验收 live 面文件集（与 T5 验收的 live 面列举逐项对齐）——`grep -rn "oscaner-plugin" CLAUDE.md README.md README.zh-CN.md packages/osuperpowers/README.md packages/osuperpowers/README.zh-CN.md packages/cdd-engine/README.md packages/cdd-engine/README.zh-CN.md packages/osuperpowers/package.json marketplace/README.md scripts/ --include=*.ts --include=*.mjs --include=*.md --include=*.json` → 零命中；仓库其余（emit 产物 / .github / docs/osuperpowers 的 2026-09-27 specs 与 plans / CHANGELOG.md）不扫——specs/plans 的 rename 记录是冻结程序文档（零修改权），从命令范围排除即无「须零命中却无权改」的死角
  - changeset：读 `.changeset/README.md` version scheme → 建 `.changeset/<slug>.md`：`@oscaner-skills/osuperpowers` breaking（`oscaner` key rename + `oscaner.harnesses` 全配送面语义 + P1 守卫宿主迁移；0.x 下 bump 类型按 scheme 判定）
  - 终验：`pnpm run emit` + `pnpm run emit:check` fresh · `pnpm run validate` 全块全绿 · `pnpm run precommit` 全绿；确认产物面零 diff（D7）
- **验收**: live 面（CLAUDE.md / README 家族 / marketplace/README / scripts 源码与测试 / package.json）零 `oscaner-plugin` 残留（grep 实证，历史豁免文件除外）；`README.zh-CN.md` 与 `README.md` 镜像同步（zh mirror sync checks 绿）；changeset 文件存在（breaking 声明）；`pnpm run validate` 全块全绿（emit freshness 在内）。
- **注**: 文档 sweep 不触 SKILL.md / docs/osuperpowers/specs 的 2026-09-13 family 与 CHANGELOG（历史豁免）；`oscaner` 新发布契约的消费者升级提示归 P4 消费故事（spec Section 4 残留），本 phase 不承接。

### Task 6: C6 提交门工具链（lint-staged · no-fix，2026-09-29 用户拍板并入）

- **Do**: 迁移提交门：
  - `.husky/pre-commit` 手写 shell（`pnpm biome:fix` autofix + re-stage 循环 + `pnpm run precommit`）→ **`pnpm exec lint-staged` 单行**（保留 shebang 头；手写 body 删除——re-stage 循环随无-fix 语义消亡，staged deletion 特判不再需要）
  - 新增根 **`lint-staged.config.mjs`**（用户指定文件名）：`"*.ts": ["biome check"]`（**无 `--write`**——staged TS 域 violation → biome 非零 → lint-staged 非零 → commit 拦截）+ `"*": ["pnpm run precommit"]`（validate 树无关子集 catch-all 继续门控，dedup 单跑）
  - `package.json`：新增 `lint-staged` devDependency（`pnpm add -D lint-staged`，落 lockfile）；`biome:fix` 脚本**保留**为手动自查命令，hook 不再调用
  - 重写 `scripts/validate/__tests__/biome-wiring.test.ts`（现 pin hook 内 `biome:fix`，见 L23-25）：改 pin 新形态——`.husky/pre-commit` 含 `lint-staged` 单行 · `lint-staged.config.mjs` 存在且 `*.ts` 任务为 `biome check`（**断言不含 `--write`**）· `*` catch-all 含 `pnpm run precommit`（validate 门控保留）；测试保留"格式/lint 脏树不可提交"的语义（no-fix 拦截即该语义新机器）
  - CLAUDE.md「Validation and commit flows」段 pre-commit 描述更新：hook = `pnpm exec lint-staged` · biome no-fix 检查（staged 域）· `pnpm run precommit` 树无关子集继续门控（T5 的 oscaner refs 编辑是 CLAUDE.md 另一区域，互不影响）
  - 验证：`pnpm exec lint-staged` 对当前 staged（无 violation）全绿；人为注入 format violation 的 staged 文件 → lint-staged 非零（实证拦截后还原，记录于任务产出）；本任务自身 commit 走新 hook 成功（自证）
- **验收**: `.husky/pre-commit` 内容 = `pnpm exec lint-staged`（单行，手写 biome/restage 零残留）；`lint-staged.config.mjs` 存在（`*.ts → biome check` 无 `--write` · `* → pnpm run precommit`）；`biome-wiring.test.ts` 重写全绿（pin no-fix + catch-all 保留）；`biome:fix` 保留手动、hook 零调用；staged TS violation 提交被拦实证一次（任务产出记录）；`pnpm run validate` 全块全绿（含新提交门）。
- **注**: 检查域从全仓 → staged TS 集（un-staged 脏文件不再挡 commit——lint-staged 本性；`pnpm run precommit` 全树门控兜底）；lint-staged 对无 staged 文件跳过（git 空提交侧天然不合法）；`prepare: "husky"` 脚本不动。