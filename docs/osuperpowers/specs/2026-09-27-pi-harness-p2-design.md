# Pi Harness P2 — emit 分发注册表（Pi Harness P2: Emit Distribution Registry）— Phase Spec

- **Version**: v1.1 · 2026-09-29
- **Status**: Draft
- **Author**: [human] · Claude Opus 5 (1M context) (osuperpowers:brainstorming → writing-phase-spec)
- **Parent program**: [2026-09-27-pi-harness-overall.md v1.9](2026-09-27-pi-harness-overall.md)
- **Depends on**: P1（shipped · [p1-design v1.5](2026-09-27-pi-harness-p1-design.md)）

## Section 0: Incremental warning

本 spec 承诺恰好一个 phase（P2 emit 分发注册表）。若实施中发现需要拆分 / 重排 P2 的工作，不是本文件的局部编辑——phase inventory 行、依赖边、change-history 行必须先回填 parent overall（backfill-as-version）再继续。P2 之后的 phase（P3 engine 数据面 / P4 文档收口）各归其 spec；本 phase 的全部破坏性定案已于 overall v1.9 回填生效。

## Section 1: Constraints pointer

跨 phase 约定以 parent overall v1.9 为准（overall wins on conflict），本 phase 不重复表述，仅指针：
- **破坏性授权（2026-09-29，Constraints 登记）**：`oscaner-plugin` → `oscaner` key rename（发布面 breaking，changeset 记 breaking）+ `oscaner.harnesses` 全配送面语义 + P1 pi-package 守卫宿主迁移
- **Non-goal：注册表分层不破**——新注册表是 emit/脚本分发面产物，不合并 engine `harness-registry.json`（反向耦合破坏包边界）
- **Non-goal：source.json 面不扩 pi 条目**（它服务于 claude/cursor 两个 marketplace）——pi 描述子 undefined 即此语义的机器表达
- **D2 源侧手维护**：`pi` 字段 + 顶层 `keywords: ["pi-package"]` 与 `version`/`description`/`files` 同源；emit 产物面零新增 pi 文件（pi 的 manifest = 发布 package.json 的 `pi` 字段本体）
- **D4 检测链路归 P3**：本 phase 不触碰 engine 宿主检测面
- 开发期引擎直调 `node packages/cdd-engine/dist/cli.mjs`；spec 中文（Strategy B）；changeset/commit 纪律不因本 phase 变更

## Section 2: Design body

#### 2.1 目标与范围

P2 把 emit 分发面的"包侧声明 ↔ 实现"差距归零：`oscaner-plugin.harnesses` 死字段（harnessesNote 明言 no script consumes）转真消费，三处硬编码（`source.ts FIRST_PARTY_CURSOR` / `OsuperpowersEmitter` 无条件双写 / `manifests.ts` 两 builder）收编为一个 OOP 统一 `Harness` 抽象 + `HarnessRegistry`，三 harness（claude / cursor / pi）以多态表达各自的产物形态。用户前提（2026-09-29）抬升本 phase 为**抽象统一重构**：允许破坏性变更、高维 OOP、零技术债——D5 毗邻债（keywords fallback 链 + name-dispatch 单包分支）拉入本面一并清除。范围外：engine 数据面（Non-goal 分层）、source.json 产物 shape（D7 字节稳定）、`.github/ISSUE_TEMPLATE` / marketplace 文档产物。

#### 2.2 抽象与组件

锚点图例：R/Q = grilling 定案轮次锚点（R1 覆盖统一重构蓝图正文、Q1 覆盖 D6 rename）；D 编号连续、非必经枚举——仅列本文实际引用的定案，并内部消歧（每号恰指一义，不含 parent overall 的 D2/D4/D5 同号异义）。锚点仅供本 spec 内部溯源：

| 锚点 | 定案内容 |
|---|---|
| D1 | 统一重构蓝图（R1）：三处硬编码（`source.ts FIRST_PARTY_CURSOR` / `OsuperpowersEmitter` 无条件双写 / `manifests.ts` 两 builder）收编为 `Harness` 抽象 + `HarnessRegistry`，声明驱动全配送面分发 |
| D2 | pi inline manifest（R1）：顶层 `pi` + `keywords: ["pi-package"]` 即分发形态，源侧手维护（与 parent overall D2 同义） |
| D3 | P1 守卫折叠（R1）：`checkPiPackageWellFormed` 五断言折叠进 `PiHarness.validatePackage`（block 5b 薄代理，断言面不变） |
| D4 | 检测链路归 P3（R1）：本 phase 不触碰 engine 宿主检测面（与 parent overall D4 同义） |
| D5 | 毗邻债清除（R1）：keywords 插件级单源（claude/cursor manifest keywords 同源于 `oscaner.keywords`，删除 `manifests.ts keywords()` fallback 链）+ 删 name-dispatch 单包分支（emitter 泛名） |
| D6 | `oscaner` key rename（Q1）：`oscaner-plugin` → `oscaner`（发布面 breaking，changeset 记 breaking） |
| D7 | 产物字节稳定（R1）：`source.json` 顶层 `claude` 字段与 row shape 字节和 v1.8 前一致（claude/cursor marketplace 消费者契约不动） |

**C1 Harness 抽象（R1）** — 新模块 `scripts/lib/harness-registry.ts`（共享域层——emit 与 validate 双侧消费；`scripts/lib/marketplace-utils.ts` 先例）：
- `abstract class Harness`：自持全部契约——
  - `id`（`claude` | `cursor` | `pi`，doc word = code word = engine token 对齐面）
  - `product?: { rel }`：文件产物相对 contentRoot 路径；`undefined` = inline 分发（无文件产物）
  - `manifest(plugin, version)`：构建该 harness 的 manifest 文档（claude/cursor 适用）
  - `sourceJson(osc): object | undefined`：source.json 插件行的描述子贡献；`undefined` = 不产生顶层字段（pi）
  - `validatePackage(pkg, ctx)`：包面契约校验（pi 适用；默认 no-op）
- `class ClaudeHarness`：`product` = `.claude-plugin/plugin.json`；`manifest` = 现 `claudePluginManifest` 逻辑收编；`sourceJson` = `osc.claude` override 聚合（字节稳定，见 C4）
- `class CursorHarness`：`product` = `.cursor-plugin/plugin.json`；`manifest` = 现 `cursorPluginManifest` 收编；`sourceJson` = `{ emitMode: "plugin-root" }`（现 `FIRST_PARTY_CURSOR` 常量迁入，常量删除）
- `class PiHarness`：`product` = `undefined`（D2：顶层 `pi` + `keywords` 即分发形态）；`manifest` 不适用；`sourceJson` = `undefined`（Non-goal：source.json 无 pi 条目）；`validatePackage(pkg, { pkgRoot, expectedCount, countSkills })` = P1 五断言折叠——**`pkgRoot`（相对包根的磁盘解析基准）与计数/计数函数由调用侧 ctx 注入**（P1 的 `EXPECTED`/`countSkillsWithMarkdown` 留在 `validate/osuperpowers.ts` 模块级导出，防 lib→validate 反依赖；`pkgRoot` 支撑断言 4 对 `./skills/*` 落盘解析 + 断言 5 files 闭包）
- `class HarnessRegistry`：`rows: Map<id, Harness>`；`resolve(id)` 未知 → throw（emit 时即 fail，emit:check 块 0 拦截）；`assertBidirectional(packageDecls)`——注册表全行 ∈ 声明并集 ∧ 每声明 ∈ 注册表（**注册未接线 → fail**，落实"增减即注册表一行接线"的 anti-white-green）
- `harnessRegistry` singleton 导出（与 `sourceService` / `manifestService` / `emitOrchestrator` 同级模式）

**C2 消费重接（R1）** — 三处硬编码收编：
- `source.ts #deriveFirstParty`：删 `FIRST_PARTY_CURSOR` 常量 → 描述子贡献经 `registry.all` **固定迭代序 `cursor → claude → pi`** 赋键；**row 键序显式钉死** = `name, contentRoot, cursor, [version/description/author/homepage/repository/license 与现字面量同序], claude, [hooks]`——cursor 贡献在元数据块前第三位赋键、claude 贡献在 `license` 后赋键（元数据块插于两者之间，`source.json` 字节与 v1.8 前一致）；pi 无描述子（source.json 零 pi 条目）。键序不由实现免检——§2.5 在 harness-registry.test / emit.test 加 `Object.keys` 序断言（不只 JSON 语义 pin）；`osc.hooks` 传递面随行保留（见 C4）
- 通用 emitter（`osuperpowers.ts` → 改名，见 C3）：**声明集直读包侧**——`for (const id of pkg.oscaner.harnesses) { const h = registry.resolve(id); if (h.product) this.writer.writeJsonDoc(outRoot, `${contentRoot}/${h.product.rel}`, h.manifest(plugin, version), generatedPaths); }`——声明集**不经 source.json row 传递**（Non-goal「source.json 面不扩键」+ D7 字节稳定），emit 侧与 validate 侧同读 `pkg.oscaner.harnesses` 同一声明集合；`plugin`（manifest 描述子：name/contentRoot/version/license 等）仍取派生 row，仅供 `h.manifest(plugin, version)` 消费；pi 的 `product === undefined` 天然跳过（D2 零文件产物由多态承载，非分支特判）
- `all.ts EmitService.emitAll`：删 `if (plugin.name === "osuperpowers")` 单包 name-dispatch → 全 plugin × 声明 harness 通用循环（现状仅 osuperpowers，语义即全量）
- `manifests.ts ManifestService`：两 builder 迁出至 harness 类；**保留** `deriveFirstPartyNames`（包发现，非 harness 关注点）+ `generatedBanner` export；`keywords()` fallback 链删除（见 C4）

**C3 命名（R1）**：`OsuperpowersEmitter` → `PluginManifestEmitter`，文件 `scripts/emit/osuperpowers.ts` → `scripts/emit/plugin-manifests.ts`，singleton `osuperpowersEmitter` → `pluginManifestEmitter`。doc word = code word：emitter 不再单包特化命名。

**C4 包侧声明（R1/Q1）** — `packages/osuperpowers/package.json` 一处编辑：
- `oscaner-plugin` → **`oscaner`**（D6，发布面 breaking——该键随 package.json 进 npm tarball，changeset 记 breaking）
- `oscaner.harnesses`：`["cursor"]` → **`["claude","cursor","pi"]`**（全配送面）；`harnessesNote` 字段删除（死字段退役）
- `oscaner.keywords`：插件级单源 `["osuperpowers","cli","cdd","harness"]`（D5——claude/cursor manifest 的 keywords 均从 `oscaner.keywords` 读，删除 `manifests.ts keywords()` 的 `plugin.claude?.keywords ?? plugin.claude?.tags` fallback 链）；`oscaner.claude` 保留 `category: "osuperpowers"`
- source.json 字节稳定（D7）：`ClaudeHarness.sourceJson` 聚合 `{ ...osc.claude, keywords: osc.keywords ?? osc.claude?.keywords }`——顶层 `claude` 字段字节与 v1.8 前一致，claude/cursor marketplace 消费者契约不动
- 顶层 `pi` / `keywords: ["pi-package"]` / `files` 不动（D2，P1 已交付）
- `osc.hooks` 传递面**随行保留**（非退役）：`#deriveFirstParty` 在 claude 贡献后落 `if (osc.hooks !== undefined) plugin.hooks = osc.hooks;`（row 末位键，与 claude/cursor 同序构造，D7 字节稳定）；claude 的 non-canonical hooks 语义（现 `claudePluginManifest` 逻辑）折入 `ClaudeHarness.manifest`；emit.test.ts 既有 hooks pin（L65-94）保持

**C5 validate 一致守卫（R1）** — 新 CheckBlock 落 `scripts/validate/marketplace.ts`（block 6，泛 first-party 机制）：
- 遍历 `deriveFirstPartyNames(packagesRoot)` 全集，读每包 `package.json`：
  1. `oscaner.harnesses` 每项 `registry.resolve(id)`（未知 harness id → fail，条目级报错含包名 + id）
  2. `registry.assertBidirectional(声明并集)`——注册表每行被 ≥1 包声明（注册未接线 → fail）
  3. 每 declared emit-harness（`h.product` 非空）→ `contentRoot/<h.product.rel>` 存在于磁盘
- **validate 首次 import `scripts/lib`**：一致守卫按定义需对注册表实参比对（盲读产物会退化为无意义表面检查）；分层语义从"纯产物读者"升级为"产物读者 + 注册表契约消费方"
- P1 守卫关系（D3）：`checkPiPackageWellFormed` 的断言体折叠进 `PiHarness.validatePackage(pkg, { pkgRoot, expectedCount, countSkills })`；`validate/osuperpowers.ts` block 5b 步骤变薄代理（透传现 `checkPiPackageWellFormed` 的 `pkgRoot` 实参 `path.join(ROOT, "packages/osuperpowers")`，断言面不变）；`pi-package.test.mjs` import 的 `countSkillsWithMarkdown` / `EXPECTED` 留在原模块导出（**测试零冲击**）
- validate wiring name-set pin 更新：新 block 步骤名**只加入 `ci-validate.test.mjs` 的 `EXPECTED_VALIDATE_STEPS` name-set**（P1 C5 name-set 语义延续）；pre-commit 侧经 `...marketplaceSteps` 组合自动纳入——pre-commit.test.ts 系 `arrayContaining`（subset⊆full）＋ strict-exclusion（仅 exclude 两个 engine step）形态，无期望 step 集，新增 step 零改动

#### 2.3 数据流

`packages/osuperpowers/package.json`（`oscaner` 声明：harnesses 全配送面 + keywords 单源 + claude category）→ `harnessRegistry`（C1，emit/validate 双侧共享）→ `source.ts` 派生 source.json（**字节不变**）→ `PluginManifestEmitter` 按声明 harness 写 `.claude-plugin/` + `.cursor-plugin/`（**字节不变**）→ validate block 6 一致守卫（声明↔注册表双射 + 产物存在）＋ block 5b `PiHarness.validatePackage`（断言面不变）。

#### 2.4 错误与边界

- `registry.resolve(id)` 未知 harness → emit throw（`pnpm run emit` 与 `emit-check` 双fail；漂移守卫块 0 拦截）；一致守卫同断言在 validate 侧独立可达（双面防白绿）
- 一致守卫 fail → CheckBlock 结构化报错（包名 + 声明 id + 期望/实际）
- `oscaner.keywords` 缺失 → manifest 省略 keywords 字段（与既有无 keywords 行为一致）；不 throw，不 fallback（fallback 链删除的语义 = 声明缺失即缺省）
- `deriveFirstPartyNames` 已排无 `oscaner` 键的目录（现判据为 `pkg["oscaner-plugin"]` 存在性门，随 C4 rename 迁为 `pkg.oscaner` 存在性门，语义不变）
- 历史豁免：`CHANGELOG.md` / `2026-09-13 overhaul family` 保留 `oscaner-plugin` 原文（Non-goal「历史记录不 retro-rename」）；`pi-harness-overall.md` 已随 v1.9 回填更新

#### 2.5 测试

- 新增 `scripts/lib/__tests__/harness-registry.test.ts`（vitest，自动进 scripts unit glob）：resolve 未知 throw · assertBidirectional（注册未接线 / 声明未注册各 fail）· Claude/Cursor `manifest()` 字节对照现有 `.claude-plugin/plugin.json` / `.cursor-plugin/plugin.json` 产物 · PiHarness.validatePackage 五断言对活 package.json 全过 · sourceJson 描述子（cursor `{emitMode}` / claude override 聚合 / pi undefined）· deriveSource row 键序 `Object.keys` 断言（`cursor` 第三位、`claude` 末位）
- `scripts/emit/__tests__/emit.test.ts` 更新：fixture 键名 `oscaner`、断言面向 registry（产物字节 pin 保持）；source.json 顶层键序 `Object.keys` 序断言（像素级键位 pin，非仅 JSON 语义 pin）
- 新一致守卫 block + wiring name-set pin 更新（C5）
- `packages/osuperpowers/tests/pi-package.test.mjs` **零改**（import 面保留）
- 回归面：`precommit` 全绿 + `pnpm run validate` 全绿 + `pnpm run emit:check` 零漂移（重 emit 后提交产物）

### Acceptance criteria

- `packages/osuperpowers/package.json` 以 `oscaner` 键声明：`harnesses: ["claude","cursor","pi"]` + 插件级 `keywords` + claude `category`；`oscaner-plugin` / `harnessesNote` 零残留（历史豁免除外）
- `scripts/lib/harness-registry.ts` 交付：`Harness` 抽象 + `ClaudeHarness`/`CursorHarness`/`PiHarness` + `HarnessRegistry`（resolve 未知即 throw · assertBidirectional 双射）；`harness-registry.test.ts` 全过
- `source.ts` 删 `FIRST_PARTY_CURSOR`、经 registry 派生描述子；`marketplace/source.json` 字节与回填前一致（emit:check 零漂移）
- 通用 emitter 落地：`PluginManifestEmitter`（`plugin-manifests.ts`）+ `all.ts` 零 name-dispatch；重 emit 后 `.claude-plugin/plugin.json` / `.cursor-plugin/plugin.json` 字节与既有一致
- `manifests.ts` keywords fallback 链删除；claude/cursor manifest keywords 同源于 `oscaner.keywords`
- validate block 6 一致守卫全绿（对活树实测三断言：声明⊆注册表 · 注册⊆声明并集 · emit-harness 产物存在）
- P1 pi-package well-formed 在 `PiHarness.validatePackage` 宿主下全绿（block 5b 薄代理；`pi-package.test.mjs` 原样通过）
- 零残留：代码/文档/测试零 `oscaner-plugin`（CHANGELOG + 2026-09-13 family 历史豁免登记于 overall v1.9）
- `pnpm run validate` 全块全绿（新守卫在内）；changeset 建（breaking——osuperpowers 按 version scheme 判定）

## Section 3: Deviations from overall

| Overall assumption | Phase decision | Overall updated? |
|---|---|---|
| overall v1.8 `oscaner-plugin` 字段名（package-as-source SOT） | rename `oscaner`（发布面 breaking——键随 package.json 进 npm tarball，changeset 记 breaking；2026-09-29 破坏性授权） | Yes — v1.9 · 2026-09-29 |
| overall v1.8 P2「`harnesses` 死字段转真消费」（语义未定义，harnessesNote 明言 no script consumes） | 重定义为全配送面 `["claude","cursor","pi"]`；pi 零文件产物由 PiHarness 多态承载（D2 inline manifest）；harnessesNote 退役 | Yes — v1.9 · 2026-09-29 |
| overall v1.8 P1「pi-package well-formed = validate/osuperpowers.ts 独立 CheckBlock（五断言）」 | 五断言折叠进 `PiHarness.validatePackage`（断言集不变；计数 ctx 注入防 lib→validate 反依赖）；block 5b 薄代理 | Yes — v1.9 · 2026-09-29 |

无未回填偏差——全部 grilling 定案（D1–D7，编号见 §2.2 锚点图例）已随 overall v1.9 sync-before-write 落地。

## Section 4: Notes for downstream

- **P3（engine 数据面）**：命名统一 `cursor-agent` → `cursor`（engine 注册表 / 检测面 / validate pin 面）与 P2 emit 注册表三面 token（`claude` / `cursor` / `pi`）对齐；两注册表分层不破（Non-goal）——P3 不消费 `scripts/lib/harness-registry.ts`（这是 emit 分发面，非 spawn 契约面）
- **P4（文档·测试·收口）**：P2 的 `oscaner` key rename 是发布面 breaking——P4 CHANGELOG 文案记录 + 历史豁免清单注册（Non-goal「历史记录不 retro-rename」）；P4 命名 pin 测试可续挂 P2 一致守卫产物；`release.yml` 无 pi smoke（v1.4 裁定）
- **消费面残留**：`oscaner` 字段 = 新发布契约——已安装旧包的消费者升级路径（breaking config 键）提示归 P4 消费故事

## Section 5: Review

Fresh-subagent review passes on the committed baseline, then user review, then writing-plans. Review Convergence（I1）：blocker > 0 → fix 全 findings 后 re-review；blocker = 0 → fix 全 findings → done（不再 re-review）。Entry 前树必须 clean（engine entry gate）。
