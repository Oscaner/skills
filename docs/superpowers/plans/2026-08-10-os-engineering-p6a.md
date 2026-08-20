# os-engineering P6a Implementation Plan：harness 前置检查 + spec/plan review 走 cli review

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给 CDD 引擎加 skills-missing 前置检查（全 mode，缺上游插件提前 exit 3 + 安装指引）；spec/plan review 改经 cdd-exec 派发（替代 in-session subagent）。

**Architecture:** 新增 `bin/utils/skills-probe.mjs`（通用 per-harness 插件可用性探测库）+ `skills-probe.config.mjs`（配置驱动：required plugins + 每 harness 探测路径/安装指引）；`runner.mjs` `runTask` 全 mode 进入嵌套 CLI 前调 skills-probe（plan/brief/templates 就位 + 插件可用），缺失 → exit 3。os-brainstorming Rule 1 + os-writing-plans Rule 2 的 review passes 改经 `cdd-exec` 派发（每 pass 一次 fresh cli 调用），D1/D2/D3 按 review-dispatch 原文映射。

**Tech Stack:** Node.js（`.mjs` + `node:test`）、`child_process`（claude plugin list 等探测）、配置 JSON/`.mjs`。

## Global Constraints

- **skills-missing gate 契约**：安装即用通道缺失 → **exit 3**（区别于 CLI-missing exit 2 / BLOCKED exit 1）+ stderr 安装指引；**os-init 通道缺失 → 提示** `os-init harness <name>`（非故障）；探测本身失败（CLI 查询错/无权限）→ **fail-open allow**。
- **最终通道分类（P6b §2.5 权威）**：安装即用（claude/cursor-agent/droid/grok/qoder/codex/gemini/pi → exit 3）+ os-init（opencode/trae/vibe/kiro → 提示）。`skills-probe.config.mjs` 的 harnesses 集合 = **12 个**（8 安装即用 + 4 os-init，MUST 与 P6b §2.5 逐一一致）。
- **跨阶段依赖（P6a → P6b）**：pi 的 `package-list` probe 对 first-party（`@oscaner-skills/engineering` / `superpowers-overrides`）只有在 P6b emit 顶层 `pi` key 后才可解析（vendored 已有 pi / `.pi/skills/` 不受影响）。本阶段单测**用 mock `pi list` 输出**，不依赖真实 pi 包；执行顺序 P6b（T1/T2）先于 P6a 的 pi probe 真实生效。
- **exit-3 范围（钉死）**：仅 skills 插件缺失；plan/brief/templates 缺失 = **BLOCKED exit 1**（任务前置条件错误）。
- **required plugins 闭合集**（配置驱动）：`superpowers` + `mattpocock-skills` + `engineering` + `superpowers-overrides`。
- **cli review**：每 pass 一次 fresh `cdd-exec` 调用；D1（零发现→跳过后续/否则修复后并发）、D2（**仅 Pass 2 delta；Pass 3 恒 full**）、D3（findings-only）；review 模板位于上游 vendors/superpowers（Read-Upstream 解析，本阶段不新建）。
- `pnpm run validate` 每任务后 ALL PASS；conventional commits，无 attribution；禁 git worktree；零残留。

---

## File Structure

| 文件 | 责任 | Task |
|---|---|---|
| `bin/utils/skills-probe.mjs` | 通用 per-harness 插件可用性探测库（claude plugin list + 缓存 glob + enabledPlugins；cursor/droid/pi/opencode skill-dir glob）| T1 |
| `bin/utils/skills-probe.config.mjs` | 配置驱动：required plugins + 每 harness 探测路径/安装指引 | T1 |
| `bin/utils/tests/skills-probe.test.mjs` | 探测单测（mock harness CLI/路径，fixture）| T1 |
| `bin/engine/lib/runner.mjs` | `runTask` 全 mode 加 skills-missing gate（plan/brief/templates + skills-probe → exit 3 / fail-open）| T2 |
| `bin/engine/tests/skills-gate.test.mjs` | gate 单测（缺失 → exit 3；探测失败 → fail-open；0/1/2 语义不动）| T2 |
| `packages/engineering/skills/os-brainstorming/SKILL.md` | Rule 1 review passes 改经 `cdd-exec` 派发 | T3 |
| `packages/engineering/docs/review-dispatch.md` | D1（零发现→跳过/否则并发）+ D2/D3 + fresh-pass 在 cli review 的映射 | T3 |
| `packages/engineering/skills/os-writing-plans/SKILL.md` | Rule 2 review passes 改经 `cdd-exec` 派发 | T4 |
| `CLAUDE.md` / docs | `.sh`→`.mjs` 引用、前置检查/exit-3 说明 | T5 |

---

### Task 1: `bin/utils/skills-probe.mjs` + config（探测库）

**Files:**
- Create: `packages/engineering/bin/utils/skills-probe.mjs`
- Create: `packages/engineering/bin/utils/skills-probe.config.mjs`
- Test: `packages/engineering/bin/utils/tests/skills-probe.test.mjs`

**Interfaces:**
- Consumes: 无（research 2026-08-16-harness-plugin-availability.md 为探测路径 SOT）
- Produces: `probeSkills(harness, { requiredPlugins, cwd, env }) → { missing: [{plugin, reason, installHint}], probeFailed: bool }` —— T2 runner 消费

- [ ] **Step 1: 写失败测试（fixture 驱动）**

`skills-probe.test.mjs`（`node:test`，mock PATH/CLI/路径）：
- claude：`claude plugin list --json` 输出 enabledPlugins 缺 superpowers → `missing` 含 superpowers + installHint `/plugin install superpowers@oscaner`；缓存 glob 有但 enabled 无 → missing（installed-but-disabled，hint 提示 enable）。
- cursor/droid：`.agents/skills/` 无 `superpowers/` → missing + hint「copy 到 .agents/skills/」。
- pi：`pi list` 无 `@oscaner-skills/superpowers` → missing + hint `pi install npm:@oscaner-skills/superpowers`（**对齐 `config.installHint` 的 `npm:` 前缀**；first-party 解析依赖 P6b 顶层 pi，本测试 mock `pi list` 输出独立跑）。
- probe 失败（`claude` CLI 报错）→ `probeFailed: true`（调用方 fail-open）。
- 探测顺序：CLI/list → glob（**env 层为 hook-context-only 扩展，P6a 不实现** —— 测试只断言 CLI→glob 两档）。

```js
import { probeSkills } from "../skills-probe.mjs";
import { config } from "../skills-probe.config.mjs";
test("claude: enabledPlugins 缺 superpowers → missing + install hint", async () => {
  const fake = fakeClaudePluginList({ enabled: ["engineering"] }); // mock claude plugin list
  const r = await probeSkills("claude", { requiredPlugins: config.requiredPlugins, env: fake.env });
  assert.ok(r.missing.some(m => m.plugin === "superpowers" && m.installHint.includes("/plugin install")));
});
```

- [ ] **Step 2: 跑测试确认 FAIL** → `node --test packages/engineering/bin/utils/tests/`
- [ ] **Step 3: 实现 `skills-probe.config.mjs`**

```js
export const config = {
  requiredPlugins: ["superpowers", "mattpocock-skills", "engineering", "superpowers-overrides"],
  // 最终通道分类（P6b §2.5 权威）：install-and-use → probe exit 3；os-init → 提示
  channel: {
    "install-and-use": ["claude", "cursor-agent", "droid", "grok", "qoder", "codex", "gemini", "pi"],
    "os-init": ["opencode", "trae", "vibe", "kiro"],
  },
  harnesses: {
    claude: { probe: "plugin-list", cacheGlob: "~/.claude/plugins/cache/oscaner-skills/<plugin>/*/skills/",
      installHint: (p) => `/plugin marketplace add Oscaner/skills && /plugin install ${p}@oscaner` },
    "cursor-agent": { probe: "skill-dir", dirs: [".agents/skills", ".cursor/skills"], installHint: () => "copy skills 到 .agents/skills/ 或装 marketplace" },
    droid: { probe: "skill-dir", dirs: [".agents/skills"], installHint: () => "copy skills 到 .agents/skills/" },
    grok: { probe: "plugin-list", installHint: () => "装 oscaner marketplace（grok 读 Claude marketplace）" },
    qoder: { probe: "skill-dir", dirs: [".agents/skills", ".qoder/skills"], installHint: () => "装 .qoder-plugin 或 copy skills" },
    codex: { probe: "skill-dir", dirs: [".agents/skills"], installHint: () => "装 .codex-plugin 或 copy skills" },
    gemini: { probe: "skill-dir", dirs: [".agents/skills", ".gemini/skills"], installHint: () => "gemini extensions install 或 copy skills" },
    pi: { probe: "package-list", installHint: (p) => `pi install npm:@oscaner-skills/${p}` },
    opencode: { probe: "skill-dir", dirs: [".opencode/skills", ".agents/skills"], installHint: () => "os-init harness opencode（copy skills）" },
    trae: { probe: "skill-dir", dirs: [".agents/skills", ".trae/skills"], installHint: () => "os-init harness trae" },
    vibe: { probe: "skill-dir", dirs: [".agents/skills", ".vibe/skills"], installHint: () => "os-init harness vibe" },
    kiro: { probe: "skill-dir", dirs: [".agents/skills", ".kiro/skills"], installHint: () => "os-init harness kiro" },
  },
};
```

- [ ] **Step 4: 实现 `skills-probe.mjs`**

- `probeSkills(harness, { requiredPlugins, cwd, env })`：按 config.harnesses[harness].probe 分派。
- `plugin-list`（claude）：`execFileSync("claude", ["plugin", "list", "--json"])` → 解析 enabledPlugins；缺失 → `missing`（含 installed-but-disabled 区分 via 缓存 glob）。exec 抛错 → `probeFailed: true`（fail-open）。
- `skill-dir`（cursor/droid）：glob `dirs` 下 `superpowers/`、`mattpocock-skills/` 等子目录是否存在 → 缺失 → `missing` + installHint。
- `package-list`（pi）：`pi list` 输出含 `@oscaner-skills/<p>` → available。
- 版本 glob 不 pin；安装指引从 config.installHint 生成。

- [ ] **Step 5: 跑测试 PASS + validate**

```bash
node --test packages/engineering/bin/utils/tests/
pnpm run validate
```

Expected: 单测全 PASS；validate ALL PASS。

- [ ] **Step 6: 提交**

```bash
git add packages/engineering/bin/utils
git commit -m "feat: skills-probe — per-harness plugin availability probe + config"
```

---

### Task 2: runner.mjs 集成 skills-missing gate（全 mode）

**Files:**
- Modify: `packages/engineering/bin/engine/lib/runner.mjs`（`runTask` 加 gate）
- Test: `packages/engineering/bin/engine/tests/skills-gate.test.mjs`

**Interfaces:**
- Consumes: T1（`probeSkills` + config）
- Produces: 全 mode 前置检查 —— 缺失 exit 3 + 安装指引；探测失败 fail-open；plan/brief/templates 检查补全

- [ ] **Step 1: 写失败测试（DI seam + noExit + stderr 断言）**

`skills-gate.test.mjs`：
- **DI seam**：`runTask` 加 `opts.probeSkills`（对齐 `opts.registryPath` 先例）—— 测试注入 fake probeSkills；不设则默认 import `bin/utils/skills-probe.mjs`。**现有 runner.test.mjs 的 9 个 runTask 调用传 `opts.probeSkills: () => ({ missing: [], probeFailed: false })`**（或 env `CDD_SKIP_PROBE=1` 旁路），保持环境无关。
- **noExit: true**（对齐 runner.test.mjs 惯例）→ 返回 `{exitCode, h1}`，不 `process.exit`。
- **stderr 断言**：安装指引走 `finish` 的 `msg` → stderr（`CDD_BLOCKED:`），非 h1。用 `capture()` helper（stub process.exit + 捕获 stderr）。
- implement/review/fix 全 mode：fake probeSkills 返回 missing（安装即用通道）→ exit 3 + stderr 含 installHint，**不调嵌套 CLI**。
- **os-init 通道缺失 → 提示** `os-init harness <name>`（非 exit 3）。
- **brief/templates 缺失 → BLOCKED exit 1**（非 exit 3）。
- probeFailed → fail-open（exit 0，任务照跑）。
- 0/1/2 语义不动（registry ship gate 仍 exit 1/2；嵌套 CLI 失败仍 exit 1）。

```js
import { runTask } from "../lib/runner.mjs";
import { capture } from "./test-helpers.mjs"; // 复用 runner.test.mjs 的 capture（stub process.exit + 捕获 stderr）
test("implement: superpowers missing → exit 3 + stderr install hint, no CLI invoke", async () => {
  const missing = [{ plugin: "superpowers", installHint: "/plugin install superpowers@oscaner" }];
  const fakeProbe = async () => ({ missing, probeFailed: false });
  const r = await capture(() => runTask("claude", 1, { mode: "implement", probeSkills: fakeProbe, noExit: true, env: { ...process.env, CDD_WORKSPACE: "/tmp/p6a-test" } }));
  assert.equal(r.exitCode, 3);
  assert.match(r.stderr, /plugin install/);
});
```

- [ ] **Step 2: 跑测试确认 FAIL** → `node --test packages/engineering/bin/engine/tests/skills-gate.test.mjs`
- [ ] **Step 3: 集成到 `runTask`**（registry ship gate 后、**review-mode fixed-point 块之前**，保证全 mode exit-3 可达；`opts.probeSkills` DI，默认 import `bin/utils/skills-probe.mjs`）

```js
// 在 runTask(任意 mode) 的 registry ship gate + workspace 解析之后、review-mode fixed-point 块之前：
const probeFn = opts.probeSkills ?? defaultProbeSkills; // DI seam（对齐 opts.registryPath 先例）
const probe = await probeFn(harness, { requiredPlugins: config.requiredPlugins, cwd, env });
if (probe.probeFailed) {
  // fail-open：不阻塞（stderr 记录 probe 失败）
} else if (probe.missing.length > 0) {
  if (config.channel["install-and-use"].includes(harness)) {
    const hint = probe.missing.map(m => `${m.plugin}: ${m.installHint}`).join("\n");
    return finish(3, [], `missing required skills plugins:\n${hint}`, noExit); // exit 3（仅安装即用通道）
  }
  // os-init 通道 → 提示（非故障），照跑
  process.stderr.write(`os-init harness ${harness} 未运行（${probe.missing.length} 个上游插件缺失）—— 建议先初始化\n`);
}
// plan/brief/templates 就位检查（缺失 = finish(1, ..., "brief/templates missing", noExit) BLOCKED，非 exit 3；复用 templates.mjs root walk）
```

现有 runner.test.mjs 的 9 个 runTask 调用：传 `probeSkills: () => ({ missing: [], probeFailed: false })`（或统一 `CDD_SKIP_PROBE=1` 旁路）—— 保持环境无关（test PATH 有无 claude 都不影响）。

- [ ] **Step 4: 测试 PASS + validate**

```bash
node --test packages/engineering/bin/engine/tests/skills-gate.test.mjs
pnpm run validate
```

Expected: gate 测试全 PASS；validate ALL PASS（0/1/2 语义不受影响）。

- [ ] **Step 5: 提交**

```bash
git add packages/engineering/bin/engine/lib/runner.mjs packages/engineering/bin/engine/tests
git commit -m "feat: skills-missing gate — all-mode pre-check (exit 3 + install hints)"
```

---

### Task 3: os-brainstorming Rule 1 cli-review + review-dispatch 映射

**Files:**
- Modify: `packages/engineering/skills/os-brainstorming/SKILL.md`（Rule 1）
- Modify（emit 产物，`pnpm run emit` 重新生成）: `packages/engineering/.agents/skills/engineering/os-brainstorming/SKILL.md`
- Modify: `packages/engineering/docs/review-dispatch.md`（D1/D2/D3 在 cli review 的映射 + fresh-pass 独立性）

**Interfaces:**
- Consumes: 无（cdd-exec 已存在）
- Produces: spec review 经 cdd-exec 派发的规则（T4 os-writing-plans 复用同一 review-dispatch 映射）

- [ ] **Step 1: os-brainstorming Rule 1 改写**

Rule 1（spec review）：从「写出的 spec 用 fresh subagent 评审 passes」改为「**每 pass 一次 fresh `cdd-exec` 调用**」：

```markdown
### Rule: Spec Review via CLI
spec review 分 3 类 pass（completeness / consistency&scope / clarity&YAGNI），每 pass 一次 fresh `cdd-exec` 派发：
  cdd-exec --harness claude --prompt "<spec-document-reviewer 模板 + pass 类别 + 文档路径>"
派发纪律见 [review-dispatch.md](../docs/review-dispatch.md)（D1/D2/D3 + fresh-pass，原样映射到 cli）。
```

- [ ] **Step 2: review-dispatch.md 更新 D1 映射**

`review-dispatch.md`：在 D1/D2/D3 旁补「cli review 模式」注记 —— 每 pass 一次独立 `cdd-exec` 调用（无状态 fresh 嵌套会话），D1（零发现→后续跳过 / 否则修复后并发）、**D2（仅 Pass 2 限定 delta；Pass 3 恒 full-doc）**、D3（findings-only）原样。subagent-lifecycle「每 pass 新 agent」在 cli 模式 = 每 pass 新 cli 会话。review 模板位于上游 `vendors/superpowers/skills/{brainstorming,writing-plans}/`（os-brainstorming Rule: Read Upstream 解析路径，orchestrator Read 后内联进 `cdd-exec --prompt`）—— **本阶段不新建模板文件**。

- [ ] **Step 3: emit 再生成 + 测试 + validate**

```bash
pnpm run emit && pnpm run validate
```

Expected: `.agents/skills/engineering/os-brainstorming/SKILL.md` 随 emit 重新生成（`emit --check` 不 drift）；validate ALL PASS（os-brainstorming SKILL.md 语义规则校验通过；review-dispatch 引用一致）。

- [ ] **Step 4: 提交**

```bash
git add packages/engineering/skills/os-brainstorming/SKILL.md packages/engineering/.agents/skills/engineering/os-brainstorming/SKILL.md packages/engineering/docs/review-dispatch.md
git commit -m "refactor: os-brainstorming spec review via cdd-exec (cli review mode)"
```

---

### Task 4: os-writing-plans Rule 2 cli-review

**Files:**
- Modify: `packages/engineering/skills/os-writing-plans/SKILL.md`（Rule: Fresh-Subagent Review Passes）
- Modify（emit 产物）: `packages/engineering/.agents/skills/engineering/os-writing-plans/SKILL.md`

**Interfaces:**
- Consumes: T3（review-dispatch 已同步）
- Produces: plan review 经 cdd-exec 派发（复用同一映射）

- [ ] **Step 1: Rule: Fresh-Subagent Review Passes 改写**

Rule 2（plan review）同 T3 模式：3 类 pass（completeness&spec-alignment / task-decomposition / buildability&type-consistency），每 pass 一次 fresh `cdd-exec` 调用（prompt = plan-document-reviewer 模板 + pass 类别 + 文档路径；**模板解析复用 os-brainstorming Rule: Read Upstream 的路径规则**）。派发纪律引用 review-dispatch.md（同 os-brainstorming）。

- [ ] **Step 2: emit 再生成 + 测试 + validate**

```bash
pnpm run emit && pnpm run validate
```

Expected: `.agents/skills/engineering/os-writing-plans/SKILL.md` 重新生成（不 drift）；ALL PASS。

- [ ] **Step 3: 提交**

```bash
git add packages/engineering/skills/os-writing-plans/SKILL.md packages/engineering/.agents/skills/engineering/os-writing-plans/SKILL.md
git commit -m "refactor: os-writing-plans plan review via cdd-exec (cli review mode)"
```

---

### Task 5: 文档 + 终检

**Files:**
- Modify: `CLAUDE.md`（前置检查/exit-3 说明；`cdd-exec`/skills-probe 引用）
- Modify: `packages/engineering/docs/cdd-reference.md`（exit codes 表补 exit 3 skills-missing）

**Interfaces:**
- Consumes: T1-T4
- Produces: 文档一致 + validate ALL PASS —— P6a 验收

- [ ] **Step 1: CLAUDE.md / cdd-reference 更新**

CLAUDE.md：前置检查（全 mode，缺上游插件 exit 3 + 安装指引）一节；skills-probe 引用。cdd-reference.md：exit codes 表补 `3 = skills-missing`（区别于 2 = harness CLI missing）。

- [ ] **Step 2: 终检**

```bash
pnpm run validate && node --test packages/engineering/bin/utils/tests packages/engineering/bin/engine/tests
```

对照 spec §2.6 验收逐条勾验（全 mode exit 3 / probe 路径 / installed-vs-enabled / 配置驱动 / exit-3 无冲突 / utils 就位 / cli review D1-D3）。

- [ ] **Step 3: 提交**

```bash
git add CLAUDE.md packages/engineering/docs/cdd-reference.md
git commit -m "docs: P6a pre-check + exit-3 reference; skills-probe docs"
```
