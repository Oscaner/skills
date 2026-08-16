# os-engineering P6b Implementation Plan：交付补齐（安装即用诚实化）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让所有「声称安装即用」的 harness 真做到（pi key / gemini-extension / qoder-codex manifest）；os-init gates → per-harness `os-init harness`；grok 归安装即用。

**Architecture:** `publish-vendor.mjs` + `emit/manifests.mjs` 输出**顶层 `pi` key**（vendored 动态探测：package.json `pi` → plugin.json skills → `.pi/skills/` → 兜底 glob；first-party engineering = skills + gate `.ts`、overrides = router `.ts`）；vendored 装配为 mattpocock 生成 gemini-extension（上游自带则 error guard）；qoder/codex manifest 补全；`harness-detect` util（抽自 cdd-select）+ `os-init harness`（per-harness 多选 + manifest 全量同步）；grok 归安装即用。

**Tech Stack:** Node.js（`.mjs` + `node:test`）、TS（pi gate/router extensions）、emit 装配。

## Global Constraints

- **pi key 动态推导，不硬编码**：vendored 装配从实际结构推导（上游 package.json `pi` → `.claude-plugin/plugin.json` skills → `.pi/skills/` → 兜底 `skills/` glob）；上游结构变更自适应。
- **最终通道分类（P6b §2.5 权威）**：安装即用（claude/cursor-agent/droid/grok/qoder/codex/gemini/pi）+ os-init（opencode/trae/vibe/kiro）。
- **os-init harness**：只列已装 harness（harness-detect util）、多选、per-harness install、manifest 全量同步（**删除仅 manifest 追踪文件**，不询问）；`os-init gates` 弃用。
- **gemini-extension**：mattpocock 装配生成；上游自带则 error guard 报错。
- **pi gate extension .ts + overrides router .ts 在 P6b 交付**（非延迟）。
- `pnpm run validate` 每任务后 ALL PASS；conventional commits，无 attribution；禁 git worktree；零残留。

---

## File Structure

| 文件 | 责任 | Task |
|---|---|---|
| `scripts/lib/publish-vendor.mjs` | vendored 装配顶层 `pi` key（动态探测）+ gemini-extension（mattpocock）| T1/T3 |
| `scripts/lib/emit/manifests.mjs` | first-party emit 顶层 `pi` key（engineering/overrides）| T2 |
| `packages/engineering/bin/gate/adapters/pi.ts` | pi gate extension（.ts 版，import 门核心）| T2 |
| `packages/superpowers-overrides/bin/pi-router.ts` | pi `on('input')` 路由器（复刻 UserPromptExpansion）| T2 |
| `packages/engineering/.codex-plugin/` `.qoder-plugin/` | manifest 补全（skills + gate hooks 路径）| T4 |
| `packages/engineering/bin/utils/harness-detect.mjs` | 已装 harness 检测 util（抽自 cdd-select）| T5 |
| `packages/engineering/bin/os-init/install-gates.mjs` → `install-harness.mjs` | os-init harness（per-harness + manifest 全量同步）| T5 |
| `packages/engineering/skills/os-init/gates.md` | os-init gates → os-init harness 文档 | T5 |
| `CLAUDE.md` / `docs/gate-install.md` | pi 交付 / os-init harness / grok 安装即用 | T6 |

---

### Task 1: pi key 动态推导（vendored 装配）

**Files:**
- Modify: `scripts/lib/publish-vendor.mjs`
- Modify: `scripts/lib/emit/manifests.mjs`（`piPackageKey` 供装配）
- Test: `scripts/lib/publish-vendor.test.mjs`

**Interfaces:**
- Consumes: 无（vendored submodule 为数据源）
- Produces: `derivePiKey(vendorRoot) → { skills?, extensions? }`（动态探测）—— T2 复用

- [ ] **Step 1: 写失败测试**

`publish-vendor.test.mjs`：对真实 vendored 结构断言动态推导：
- superpowers → 保留上游 `pi`（extensions `./.pi/extensions/superpowers.ts` + skills）。
- mattpocock → 读 `.claude-plugin/plugin.json` skills 列表 → `pi.skills` glob/逐目录。
- impeccable → 扫 `.pi/skills/` → `pi.skills`。
- 装配输出**顶层 `pi` key**（非嵌套 `oscaner-plugin.pi`）。

```js
import { derivePiKey, assemblePackageJson } from "../publish-vendor.mjs";
test("mattpocock: derive pi.skills from plugin.json skills", () => {
  const pi = derivePiKey("vendors/mattpocock-skills");
  assert.ok(pi.skills.length >= 21); // 对齐 plugin.json 21 技能
});
test("superpowers: preserve upstream pi (extensions+skills)", () => {
  const pi = derivePiKey("vendors/superpowers");
  assert.deepEqual(pi, { extensions: ["./.pi/extensions/superpowers.ts"], skills: ["./skills"] });
});
```

- [ ] **Step 2: 跑测试确认 FAIL** → `node --test scripts/lib/publish-vendor.test.mjs`
- [ ] **Step 3: 实现动态推导**

`derivePiKey(vendorRoot)` 探测顺序：
1. `package.json` 顶层 `pi`（有 → 保留/合并上游 extensions+skills）
2. `.claude-plugin/plugin.json` skills 数组 → 转 `pi.skills`（glob 或逐目录）
3. `.pi/skills/` 目录 → `pi.skills`（pi 约定）
4. 兜底 glob `skills/`
`assemblePackageJson`：`out.pi = derivePiKey(...)`（顶层，非 `oscaner-plugin.pi`）；保留 LICENSE。

- [ ] **Step 4: 测试 PASS + validate**

```bash
node --test scripts/lib/publish-vendor.test.mjs && node scripts/publish-vendor.mjs --dry-run
pnpm run validate
```

Expected: 单测 PASS；装配 dry-run 产物含正确顶层 pi key；validate ALL PASS。

- [ ] **Step 5: 提交**

```bash
git add scripts/lib/publish-vendor.mjs scripts/lib/emit/manifests.mjs scripts/lib/publish-vendor.test.mjs
git commit -m "feat: pi key dynamic derivation in vendor assembly (top-level pi)"
```

---

### Task 2: first-party emit 顶层 pi key + 两个 TS extension

**Files:**
- Modify: `scripts/lib/emit/manifests.mjs`（`piPackageKey` 扩展 first-party）
- Create: `packages/engineering/bin/gate/adapters/pi.ts`（gate extension）
- Create: `packages/superpowers-overrides/bin/pi-router.ts`（router extension）
- Modify（生成）: `packages/engineering/package.json`、`packages/superpowers-overrides/package.json`（顶层 pi）
- Test: `scripts/lib/emit/emit.test.mjs`、`packages/engineering/bin/gate/tests/pi.test.mjs`、`packages/superpowers-overrides/tests/pi-router.test.mjs`

**Interfaces:**
- Consumes: T1（`derivePiKey` 模式）
- Produces: first-party 顶层 pi key + 两个 TS extension —— T5 os-init harness / T6 文档引用

- [ ] **Step 1: 写失败测试**

`emit.test.mjs`：engineering 发布包顶层 `pi` = `{ skills: ["./skills"], extensions: ["./bin/gate/adapters/pi.ts"] }`；overrides = `{ extensions: ["./bin/pi-router.ts"] }`。`pi.test.mjs`：gate adapter（.ts 版）deny → `{block:true}`（import 门核心）。`pi-router.test.mjs`：`on('input')` 检测 `/brainstorming` → transform 注入 `Skill(engineering:os-brainstorming)`。

- [ ] **Step 2: 跑测试确认 FAIL**
- [ ] **Step 3: 实现**

- `piPackageKey()` 扩展：支持 `{ skills, extensions }` 参数（first-party emit 传 engineering/overrides 的配置）。
- `gate/adapters/pi.ts`：port 自 `pi.mjs`（门决策），`.ts` 版（pi 自动发现 `*.ts`）。
- `overrides/bin/pi-router.ts`：`export function on(event, ctx)` —— `input` 事件检测 `/brainstorming` 等 → `{ action: "transform", text: "Skill(engineering:os-brainstorming) " + text }`；`/spor-*` 不再匹配。
- `emit` 写顶层 `pi` key 进 first-party package.json（发布时）。

- [ ] **Step 4: 测试 PASS + validate**

```bash
node --test scripts/lib/emit/emit.test.mjs packages/engineering/bin/gate/tests/pi.test.mjs packages/superpowers-overrides/tests/pi-router.test.mjs
pnpm run emit && pnpm run validate
```

Expected: 全 PASS；emit fresh；顶层 pi key 生成。

- [ ] **Step 5: 提交**

```bash
git add scripts packages/engineering/bin/gate/adapters/pi.ts packages/superpowers-overrides/bin/pi-router.ts
git commit -m "feat: first-party top-level pi key + gate/router TS extensions"
```

---

### Task 3: gemini mattpocock-extension 装配 + error guard

**Files:**
- Modify: `scripts/lib/publish-vendor.mjs`（mattpocock 装配生成 `gemini-extension.json`）
- Modify: `scripts/lib/emit/manifests.mjs`（`geminiExtension` 复用）
- Test: `scripts/lib/publish-vendor.test.mjs`

**Interfaces:**
- Consumes: T1（装配基座）
- Produces: mattpocock 的 `gemini-extension.json` → `gemini extensions install` 安装即用

- [ ] **Step 1: 写失败测试**

`publish-vendor.test.mjs`：mattpocock 装配产物含 `gemini-extension.json`（name/version + skills + GEMINI.md 引用）；**上游自带 `gemini-extension.json` 时装配报错**（不静默覆盖）。

- [ ] **Step 2: 跑测试确认 FAIL**
- [ ] **Step 3: 实现**

- 装配 mattpocock 前探测 `vendors/mattpocock-skills/gemini-extension.json` —— 有则 `throw`（「上游已自带，改用上游，停用装配生成」）。
- 无则用 `geminiExtension()`/`geminiMarkdown()`（P4b 已有）生成 `gemini-extension.json` + GEMINI.md 进装配产物。
- 验证：装配 dry-run 产物含 gemini-extension。

- [ ] **Step 4: 测试 PASS + validate**
- [ ] **Step 5: 提交** → `git commit -m "feat: gemini-extension for mattpocock assembly + upstream error guard"`

---

### Task 4: qoder/codex plugin manifest 补全

**Files:**
- Modify: `scripts/lib/emit/manifests.mjs`（`codexPluginManifest`/`qoderPluginManifest`）
- Modify（生成）: `packages/engineering/.codex-plugin/`、`.qoder-plugin/`
- Test: `scripts/lib/emit/emit.test.mjs`

**Interfaces:**
- Consumes: 无
- Produces: `.codex-plugin`/`.qoder-plugin` 真安装即用（skills + gate hooks 路径正确）

- [ ] **Step 1: 写失败测试**

`emit.test.mjs`：codex hooks 命令 = 插件根相对 `./bin/gate/adapters/codex.mjs`（非 `../bin/...`）；codex skills 路径正确；qoder manifest 含 skills + hooks（非 metadata-only）；adapter 路径存在 guard 触发。

- [ ] **Step 2: 跑测试确认 FAIL**
- [ ] **Step 3: 实现**

- `codexHooksJson`：命令改插件根相对 `./bin/gate/adapters/codex.mjs`（P4b I3 修复）；skills 路径对齐。
- `qoderPluginManifest`：补 `skills` + `hooks`（qoder 自动发现位置）+ interface。
- emit adapter 路径存在 guard（P4b 已加部分，补全形状）。

- [ ] **Step 4: `pnpm run emit && pnpm run validate`** → ALL PASS
- [ ] **Step 5: 提交** → `git commit -m "fix: codex/qoder plugin manifests genuinely install-and-use"`

---

### Task 5: harness-detect util + os-init harness（per-harness）

**Files:**
- Create: `packages/engineering/bin/utils/harness-detect.mjs`（抽自 cdd-select）
- Modify: `packages/engineering/bin/engine/cdd-select.mjs`（复用 util）
- Modify: `packages/engineering/bin/os-init/install-gates.mjs` → `install-harness.mjs`（per-harness + manifest 全量同步）
- Modify: `packages/engineering/skills/os-init/gates.md` → `harness.md`
- Delete: `os-init gates` 引用
- Test: `packages/engineering/bin/utils/tests/harness-detect.test.mjs`、`packages/engineering/bin/os-init/tests/install-harness.test.mjs`

**Interfaces:**
- Consumes: T1/T2（pi/TS extension）+ P6a（skills-probe 矩阵）
- Produces: `os-init harness`（per-harness 多选 + manifest 同步）—— T6 文档

- [ ] **Step 1: 写失败测试**

`harness-detect.test.mjs`：`detectInstalledHarnesses(config)` —— `command -v` 已装 harness 列表（源 = skills-probe.config 的 11 harness）。`install-harness.test.mjs`：per-harness install（安装即用 probe → 指引；os-init 通道 → 写 config+复制 skills）；manifest 全量同步（**删除仅 manifest 追踪文件**；版本 check）；多选交互；`os-init gates` 移除。

- [ ] **Step 2: 跑测试确认 FAIL**
- [ ] **Step 3: 实现**

- `harness-detect.mjs`：`detectInstalledHarnesses(config)`（`command -v <cli>`）；cdd-select + os-init harness 共用。
- `install-harness.mjs`：`os-init harness [h1,h2,...]` —— 无参多选菜单（只列已装）、显式指定；per-harness install（安装即用 probe→指引 / os-init 写 config+复制 skills）；manifest（`bin/os-init/state/<harness>.json`：engineeringVersion + files hash）全量同步（自动增删改，删除仅 manifest 追踪）。
- 移除 `os-init gates`（`install-gates.mjs` 删或改别名 → 移除）。

- [ ] **Step 4: 测试 PASS + validate**
- [ ] **Step 5: 提交** → `git commit -m "feat: os-init harness per-harness (harness-detect util + manifest full-sync)"`

---

### Task 6: 文档 + 终检

**Files:**
- Modify: `CLAUDE.md`、`docs/gate-install.md`（pi 交付 / os-init harness / grok 安装即用 / 通道矩阵）

**Interfaces:**
- Consumes: T1-T5
- Produces: 文档一致 + validate ALL PASS —— P6b 验收

- [ ] **Step 1: 文档更新**（os-init harness 用法、pi 交付（@oscaner-skills/* 顶层 pi）、grok 安装即用、最终通道矩阵）
- [ ] **Step 2: 终检**（对照 spec §2.8 验收逐条勾验；`pnpm run validate` + 全部 node:test）
- [ ] **Step 3: 提交** → `git commit -m "docs: P6b delivery — pi install-and-use, os-init harness, channel matrix"`
