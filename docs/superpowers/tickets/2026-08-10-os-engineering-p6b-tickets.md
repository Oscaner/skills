# Tickets: os-engineering P6b — 交付补齐（安装即用诚实化）

Break of the P6b implementation plan（[../plans/2026-08-10-os-engineering-p6b.md](../plans/2026-08-10-os-engineering-p6b.md)，spec [../specs/2026-08-10-os-engineering-p6b-design.md](../specs/2026-08-10-os-engineering-p6b-design.md)，parent overall v2.9）into tracer-bullet tickets。每个 ticket 独立 demoable。

Work the **frontier**: any ticket whose blockers are all done. Frontier = T0 + T3 可同时开工；T1/T2 等 T0；T4 等 T1（+ P6a 的 skills-probe config，若已 merge）；T5 等全部。

## T0 — vendored 装配顶层 pi（动态推导）

**What to build:** `publish-vendor.mjs` 为 vendored 包组装顶层 `pi` key，**动态探测不硬编码**：package.json 顶层 `pi`（superpowers 保留 extensions+skills）→ `.pi/skills/`（impeccable → `["./.pi/skills/impeccable"]`，pi 约定优先）→ `.claude-plugin/plugin.json` skills（mattpocock → 21 技能转 glob）→ 兜底 `skills/` glob。上游结构变更时装配自适应。

**Blocked by:** None — can start immediately。

- [ ] `derivePiKey(vendorRoot) → { skills?, extensions? }` 按序探测；`assemblePackageJson` 输出**顶层 `pi`**（非嵌套 `oscaner-plugin.pi`），保留 LICENSE
- [ ] 单测（fixture 优先，avoid fresh-clone 无 submodule）：
  - superpowers → 保留 `{ extensions: ["./.pi/extensions/superpowers.ts"], skills: ["./skills"] }`
  - mattpocock → `pi.skills` ≥ 21（对齐 plugin.json）
  - impeccable → `pi.skills` deepEqual `["./.pi/skills/impeccable"]`
- [ ] 更新既有 4 条 `oscaner-plugin` 断言（顶层 `pi` 取代嵌套）
- [ ] 装配 dry-run 产物含正确顶层 pi key；validate ALL PASS

## T1 — first-party 顶层 pi + gate/router TS extensions

**What to build:** emit 给 engineering / overrides 写顶层 `pi` key（engineering = skills + gate extension `./bin/gate/adapters/pi.ts`；overrides = router input extension `./bin/pi-router.ts`）。`pi.ts` 取代 `pi.mjs` 成为 pi 通道（pi 自动发现 `*.ts`）；router 触发映射对齐 overrides.manifest.json 全量（`/brainstorming` → `Skill(engineering:os-brainstorming)` 等，`/spor-*` 不再匹配）。保留 `oscaner-plugin` 字段不被破坏。

**Blocked by:** T0

- [ ] `piPackageKey()` 扩展支持 first-party `{ skills, extensions }`；emit 写顶层 `pi`（读 + 写，锁 `oscaner-plugin` 既有断言）
- [ ] `gate/adapters/pi.ts` 门决策（deny → `{block:true}`）；更新 emit.test.mjs 既有 `piPackageKey` 断言 `.mjs` → `.ts`
- [ ] `overrides/bin/pi-router.ts`：`on('input')` 检测 slash → transform 注入 `Skill(engineering:...)`
- [ ] `pi.ts`/`pi-router.ts` 单测 PASS；`pnpm run emit` fresh + validate ALL PASS

## T2 — mattpocock thin gemini-extension + 上游自带 error guard

**What to build:** vendored 装配为 mattpocock-skills 生成 **thin** `gemini-extension.json`（name/version + skills 目录 + GEMINI.md 引用，**无 BeforeTool hooks** —— skill-only 包，不复用带 gate hook 的 `geminiExtension()`）。装配前探测上游是否已自带 `gemini-extension.json` —— 有则**报错**（改用上游），不静默覆盖。

**Blocked by:** T0

- [ ] thin 生成器 `thinGeminiExtension(name, version, skillDirs)`（contextFileName: "GEMINI.md"）
- [ ] 上游自带 gemini-extension.json 时装配 throw（error guard）
- [ ] 单测 + 装配 dry-run 产物含 thin gemini-extension；validate ALL PASS

## T3 — codex/qoder manifest base 锁定 + adapter guard

**What to build:** 把 codex/qoder 的统一 **manifest-root-relative base** 锁定为契约（相对 `.codex-plugin/`/`.qoder-plugin/` 解析：`../bin/gate/adapters/{codex,qoder}.mjs` → 包根 `bin/`，与 `skills: "../skills/"`、`hooks: "./hooks/hooks.json"` 同一 base，不依赖 `PLUGIN_ROOT` 替换）；emit adapter 路径存在 guard（manifest-root 相对路径 → 绝对路径，断言存在且可执行，缺失报错不 emit 坏产物）。**`./bin/...` 是错误形式**（相对 manifest-root 会指向不存在的 `.codex-plugin/bin/...`）。

**Blocked by:** None — can start immediately。

- [ ] 单测锁 `../bin/...`（manifest-root resolve 到包根 bin/，绝对路径存在）；qoder 同
- [ ] adapter 路径存在 guard（codex/qoder），缺失报错
- [ ] `pnpm run emit && pnpm run validate` ALL PASS

## T4 — os-init harness（per-harness install + manifest 全量同步）+ 移除 os-init gates + 删 pi.mjs

**What to build:** `os-init harness` 取代 `os-init gates`：只列已装 harness（`harness-detect` util，`cli` 源 = `config.harnesses[h].cli ?? h`，cursor-agent = `"cursor-agent"`）→ 多选菜单 → per-harness install（安装即用通道 probe 缺失 → 安装指引；os-init 通道 → 写原生 gate config + 复制 skills + 信任）。manifest（`{ engineeringVersion, files: { path → { hash, source } } }`）全量同步：自动增删改，**删除仅限 `source:"os-init"` + on-disk hash 未变**（hash 变 = 用户改动 → 保留并报告）；版本 check 打印更新命令。移除 `os-init gates`（install-gates.mjs）并删除 legacy `pi.mjs`（T1 已由 `pi.ts` 取代）。

**Blocked by:** T1（+ P6a skills-probe config 若已 merge，否则本票内补扩展 12-harness config + 删 `piDirCopyPlugins`）

- [ ] `harness-detect.mjs`：`detectInstalledHarnesses(config)`（`command -v <cli>`，`cli` 源 = config `cli` 字段 ?? harness key）；cdd-select 复用（ship=full 映射，os-init 通道标「需初始化」）
- [ ] `install-harness.mjs`（取代 install-gates.mjs）：无参多选 / 显式指定；per-harness install；
- [ ] manifest 全量同步：新增/覆盖/删除自动；删除仅 source=os-init + hash 未变；用户改动保留并报告；版本 check
- [ ] 移除 `os-init gates`（install-gates.mjs 删除）+ 删除 `bin/gate/adapters/pi.mjs` + 更新 `bin/gate/configs/pi/README.md`（指向 `pi.ts`）
- [ ] 单测（harness-detect / install-harness / manifest sync / 多选）；validate ALL PASS

## T5 — 文档 + 终检

**What to build:** CLAUDE.md / docs/gate-install.md 反映：pi 交付（`@oscaner-skills/*` 顶层 pi）、os-init harness 用法、grok 归安装即用（marketplace）、最终通道矩阵。对照 spec §2.8 验收逐条勾验。

**Blocked by:** T0, T1, T2, T3, T4

- [ ] 文档：os-init harness 用法、pi 交付、grok 安装即用、通道矩阵（12 harness）
- [ ] 终检：`pnpm run validate` + 全 node:test ALL PASS；spec §2.8 逐条勾验