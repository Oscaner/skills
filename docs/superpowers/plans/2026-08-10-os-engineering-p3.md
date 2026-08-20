# engineering P3 实施计划：薄封装 + 多 harness 发射

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** superpowers-overrides 收缩为触发路由器（无技能体，spor-\* 全删，manifest 指向 os-\*/cli-\*）；engineering 承载技能 + 引擎 + gate + 全 harness 发射 + 独立版本化。

**Architecture:** overrides 的 manifest/hooks/expansion/自检表 retarget 到 os-\* 目标，spor-\* 全删；gate 迁 engineering；os-init 参数化；impeccable 模式 build.js 把 12 技能发射到 14 非 claude harness 目录 + （decision B：不 vendor 上游，Read-upstream 当可用） + per-harness self-check。

**Tech Stack:** Markdown、Bash、JSON、Node.js（build.js）；验证命令 `pnpm run validate`

## Global Constraints

- 终态边界：overrides = 触发路由器（plugin-root，claude+cursor，**无技能体**）；engineering = 技能 + 引擎 + gate + 全 harness emit
- 多 harness 发射仿 impeccable 模式（build.js + PROVIDERS，per-harness 副本）；`.agents/skills/` 一等目标
- os-\* Read 上游 → 每 harness 连带就位上游（build.js 整目录复制 `plugins/superpowers/skills/`）
- 语义规则名 + `#rule-<kebab>`；零 sdd 残留（5c）
- `pnpm run validate` 每任务后 ALL PASS；提交信息 conventional commits，无 attribution

---

## File Map

| 文件 | 操作 | Task |
|------|------|------|
| `plugins/superpowers-overrides/overrides.manifest.json` | Modify（目标表 → os-*/cli-*/mattpocock） | T1 |
| `plugins/superpowers-overrides/hooks/{hooks.json,hooks-cursor.json}` | Modify（注入 os-* 目标） | T1 |
| `plugins/superpowers-overrides/bin/override-prompt-expansion.sh` + cursor detect/enforce | Modify（retarget） | T1 |
| `plugins/superpowers-overrides/build/generated/{claude-self-check.md,cursor-self-check.mdc}` | Modify（表指向 os-*） | T1 |
| `plugins/superpowers-overrides/skills/spor-*`（14 个） | Delete | T2 |
| `plugins/superpowers-overrides/.claude-plugin/plugin.json` | Modify（skills/ 移除） | T2 |
| `plugins/engineering/tests/rule-reference.test.py` | Modify（仅语义模式） | T2 |
| `plugins/superpowers-overrides/tests/*`（validate-overrides-build / trigger-patterns） | Modify（spor-* 断言移除） | T1/T2 |
| `plugins/superpowers-overrides/bin/{cdd-orchestrator-gate.sh,cdd-session-activate.sh,override-claude-sdd-gate.sh,override-cursor-sdd-gate.sh}` | Move → engineering（adapters 改名 cdd） | T3 |
| `plugins/engineering/hooks/hooks.json` | Create（PreToolUse） | T3 |
| `plugins/engineering/skills/os-init/SKILL.md` | Create（参数化） | T4 |
| `plugins/superpowers-overrides/skills/spor-init/SKILL.md` | Delete | T4 |
| `scripts/version-packages.mjs` + `scripts/lib/version-utils.mjs` | Modify（双插件版本化） | T5 |
| `plugins/engineering/package.json` | Modify（版本接入 changeset + pi skills key） | T5 |
| `scripts/emit.mjs`（统一发射工具，扩 emit-marketplace） | Create/Modify（薄 manifest + GEMINI.md + .agents/skills + hooks + 版本同步） | T6 |
| `plugins/engineering/.{claude-plugin,cursor-plugin,codex-plugin,kimi-plugin}/plugin.json` + `gemini-extension.json` + `GEMINI.md` + `.agents/skills/` | Create（统一 emit 产物，已提交） | T6 |
| `marketplace/source.json` | Modify（删 engineering cursor wrapper emit） | T6 |
| `README.md` / `README.zh-CN.md` / `cross-harness-overrides.md` | Modify（边界 + 多 harness） | T7 |

---

### Task 1: 路由器 retarget（manifest + hooks + expansion + 自检表 → os-* 目标）

**Files:**
- Modify: `plugins/superpowers-overrides/overrides.manifest.json`
- Modify（由生成器重写）: `hooks/hooks.json` + `hooks/hooks-cursor.json` + `bin/override-prompt-expansion.sh` + cursor detect/enforce + `build/generated/*`
- Modify: `plugins/superpowers-overrides/tests/trigger-patterns.test.py` + `tests/validate-overrides-build.sh`

**Interfaces:**
- Consumes: 无
- Produces: 触发 → os-\*/cli-\*/mattpocock 目标映射生效；注入内容指向 os-* 目标

- [ ] **Step 1: 重写 `overrides.manifest.json` 目标表**

目标 `name` 从 `spor-<slug>` 改为目标技能，`overrides` 保持上游触发：

```json
{
  "$schema": "./build/overrides-manifest.schema.json",
  "plugin": "superpowers-overrides",
  "targets": [
    { "name": "engineering:os-brainstorming", "overrides": "superpowers:brainstorming", "source": "../engineering/skills/os-brainstorming" },
    { "name": "engineering:os-writing-plans", "overrides": "superpowers:writing-plans", "source": "../engineering/skills/os-writing-plans" },
    { "name": "engineering:cli-driven-development", "overrides": "superpowers:subagent-driven-development", "source": "../engineering/skills/cli-driven-development" },
    { "name": "engineering:os-executing-plans", "overrides": "superpowers:executing-plans", "source": "../engineering/skills/os-executing-plans" },
    { "name": "engineering:os-finishing", "overrides": "superpowers:finishing-a-development-branch", "source": "../engineering/skills/os-finishing" },
    { "name": "engineering:os-debugging", "overrides": "superpowers:systematic-debugging", "source": "../engineering/skills/os-debugging" },
    { "name": "mattpocock-skills:tdd", "overrides": "superpowers:test-driven-development", "source": null },
    { "name": "engineering:os-verification", "overrides": "superpowers:verification-before-completion", "source": "../engineering/skills/os-verification" },
    { "name": "engineering:os-code-review", "overrides": "superpowers:receiving-code-review", "source": "../engineering/skills/os-code-review" },
    { "name": "engineering:os-finishing", "overrides": "superpowers:using-git-worktrees", "source": "../engineering/skills/os-finishing" }
  ]
}
```

> 若 `source` 字段约束为 overrides 插件内路径（当前 schema 校验），改用 `target_plugin: "engineering"` + `target_skill: "os-brainstorming"` 等语义字段（修改 manifest schema + 生成器）；实现时以现有生成器读取逻辑为准扩展。

- [ ] **Step 1b: 放宽 manifest schema + manifest_targets.py（blocker）**

当前 `overrides-manifest.schema.json` 的 `name` 约束 `^spor-[a-z0-9-]+$`、`source` 约束 `^\./skills/`，且 `build/lib/manifest_targets.py` 有 `name.startswith("spor-")` 断言 —— 新目标表（`engineering:*` / `mattpocock-skills:tdd`、跨插件 source）会被硬拒。**同步修改**：

1. `overrides-manifest.schema.json`：`name` 允许插件限定名；`source` 允许跨插件（或加 `target_plugin` / `target_skill` 语义字段）；**`source` 允许 `null`（submodule 目标如 mattpocock tdd，无 overrides 内 source）**
2. `build/lib/manifest_targets.py`：删 spor- 前缀断言；`row["source"]` 可能为 `None` 时跳过 source 解析；按新字段解析目标
3. `validate-overrides-build.sh`：**四个** spor- 断言块全部移除/更新（不只「validate manifest sources」）：
   - 「validate manifest sources」：跨插件解析 source；`source` 为 null 的 submodule 目标豁免路径校验；不 crash
   - 「validate canonical skill names」：删 `name.startswith('spor-')` + `skills/<name>` 目录查找（目标跨插件）
   - JSON-schema fallback：删 `assert t['name'].startswith('spor-')`
   - 「validate plugin.json alignment」：`needed = {target names}` 不再 `<= declared spor-* dirs`（overrides 无技能体，此块改为校验 manifest 目标存在性）

- [ ] **Step 2: 更新生成器 + 重跑 `pnpm run generate:overrides`**

`build/generate-all.sh` / render 脚本的注入措辞从「MUST invoke superpowers-overrides:spor-<X>」改为「MUST invoke <目标>」（目标 = manifest name 字段，如 `engineering:os-brainstorming` / `mattpocock-skills:tdd`）。Cursor detect/enforce 指向新目标。

**删 `/spor-*` matcher 家族（blocker）**：`render-claude-hooks.sh` 的 `cc_matcher_spor_slash`（生成 `/spor-<slug>` UserPromptExpansion block）与 `render-hook.sh` 的 `/{t.name}` case（T1 后会对 engineering:os-brainstorming 生成 bogus 模式）—— **全部删除**。spec A2 的 `^/spor-*` matcher 同步移除（过渡别名结束）。触发模式只保留 `^superpowers:` + 裸 `/<upstream-slug>`。

**路由器不写 pending（blocker）**：`render-hook.sh` + `render-cursor-hooks.sh` 里生成 `sdd_activate` / `sdd_session_key` 块（调 `${_plugin_root}/bin/cdd-session-activate.sh` 写 pending）—— spec B1 规定「overrides 路由器不写 pending」。**删除这些调用**，`sdd_activate` / `sdd_session_key` 变量改名/移除（避免 T7 零残留 grep 命中 `sdd_`）。pending 写入归 engineering（gate 迁入后）。

> 注：T1 与 T3 都编辑 `build/render-cursor-hooks.sh`（T1 删 pending block，T3 删 preToolUse gate 条目）—— T3 是对 T1 已改文件的后续编辑，重跑 generate 后生效。

- [ ] **Step 3: 更新触发测试 + 路由器测试**

`trigger-patterns.test.py`：注入内容断言改为目标技能（engineering:* / mattpocock-skills:tdd），触发模式（`^superpowers:` + 裸 `/<slug>`）保持。

**另 3 个路由器测试同步 retarget**：`override-prompt-expansion.test.sh` / `override-cursor-detect.test.sh` / `override-cursor-enforce.test.sh` 硬断言 `spor-brainstorming` 名、`superpowers-overrides:spor-*` 引用、`$ROOT/skills/spor-*` 路径 —— 全部改为 engineering:* / mattpocock-skills:tdd + engineering 技能路径。

**manifest 目标存在性校验**：T1 加一个跨插件目标存在性检查（每个目标解析到 `plugins/engineering/skills/<name>`；mattpocock tdd → `plugins/mattpocock-skills/skills/engineering/tdd/SKILL.md`（**嵌套路径**，非 `skills/tdd`）；缺失 → 报错），挂入 validate-overrides-build.sh / ci-validate。

- [ ] **Step 4: validate**

```bash
pnpm run generate:overrides
pnpm run validate
```

预期：注入指向 os-* 目标，触发测试通过，validate ALL PASS。

- [ ] **Step 5: 提交**

```bash
git add -A plugins/superpowers-overrides
git commit -m "refactor: retarget trigger router to os-*/cli-* targets"
```

---

### Task 2: 删除 spor-* + rule-reference 数字模式退役

**Files:**
- Delete: `plugins/superpowers-overrides/skills/spor-*`（14 个：8 薄指针 + 3 映射 + init + handoff-writer + controller-handoff）
- Modify: `plugins/superpowers-overrides/.claude-plugin/plugin.json`（skills/ 移除或置空）
- Modify: `plugins/engineering/tests/rule-reference.test.py`（仅语义模式）
- Modify: `plugins/superpowers-overrides/tests/validate-overrides-build.sh`（spor-* 断言移除）

**Interfaces:**
- Consumes: T1（触发已指向 os-*）
- Produces: overrides 无技能体；rule-reference 仅语义

- [ ] **Step 1: 删除 14 个 spor-* 技能**

```bash
cd plugins/superpowers-overrides/skills
git rm -r spor-brainstorming spor-writing-plans spor-subagent-driven-development spor-executing-plans \
  spor-finishing-a-development-branch spor-using-git-worktrees spor-systematic-debugging \
  spor-test-driven-development spor-verification-before-completion spor-receiving-code-review \
  spor-report-issue spor-init spor-handoff-writer spor-token-efficient-controller-handoff
```

- [ ] **Step 2: plugin.json skills/ 移除 + 生成 manifest 同步（blocker）**

`.claude-plugin/plugin.json`：删除 `"skills": "./skills/"`（overrides 无技能体；保留 `hooks` + `name` + `version`）。

**生成 manifest 同步**：`build/render-cursor-manifest.sh` + `build/render-codex-manifest.sh` 硬编码 `"skills": "./skills/"` —— 同步移除，重跑 `pnpm run generate:overrides` 重生成 `.cursor-plugin/plugin.json` + `.codex-plugin/plugin.json`；`manifest-harness.test.py` 的 `skills` 目录断言更新（无技能体 → 不再断言 skills 存在）。

**ci-validate.sh 空目录 guard（blocker）**：`scripts/ci-validate.sh` 步骤 2 `for d in plugins/superpowers-overrides/skills/*/` 在 skills/ 删除后 glob 空目录 → `[ -f .../SKILL.md ]` 失败。加空目录 guard（skills/ 无子目录时跳过该循环），并更新任何断言 overrides skills 数的步骤（改为 0 或移除）。

- [ ] **Step 3: rule-reference 仅语义模式**

`plugins/engineering/tests/rule-reference.test.py`：删除数字模式分支（overrides 无技能可校验），入口只收 `engineering/skills:semantic`；`ALLOWLIST_NUM` 相关死条目清理。`validate-overrides-build.sh` / ci-validate 中 rule-reference 调用同步改单语义。

- [ ] **Step 4: validate**

```bash
pnpm run validate
```

预期：rule-reference 语义模式通过，validate ALL PASS（T1 已把 overrides 技能引用清空，删除后无悬挂）。

- [ ] **Step 5: 提交**

```bash
git add -A plugins/superpowers-overrides plugins/engineering/tests
git commit -m "refactor: delete spor-* skills, retire rule-reference numeric mode"
```

---

### Task 3: gate 迁入 engineering

**Files:**
- Move（改名）: `plugins/superpowers-overrides/bin/lib/cdd-orchestrator-gate.sh` → `plugins/engineering/bin/lib/cdd-orchestrator-gate.sh`
- Move（改名）: `plugins/superpowers-overrides/bin/cdd-session-activate.sh` → `plugins/engineering/bin/cdd-session-activate.sh`
- Move（改名）: `override-claude-sdd-gate.sh` / `override-cursor-sdd-gate.sh` → `plugins/engineering/bin/override-claude-cdd-gate.sh` / `override-cursor-cdd-gate.sh`
- Create: `plugins/engineering/hooks/hooks.json`（PreToolUse Write|Edit + Bash → cdd-orchestrator-gate）
- Create: `plugins/engineering/hooks/hooks-cursor.json`（cursor preToolUse → override-cursor-cdd-gate）
- Modify: `plugins/superpowers-overrides/hooks/hooks.json`（删 PreToolUse，只剩 UserPromptExpansion）
- Move: gate 测试（`sdd-gate-allow-deny-smoke.sh` / `override-*-gate.test.sh` / `sdd-gate-test-lib.sh`）→ engineering

**Interfaces:**
- Consumes: 无
- Produces: gate 在 engineering 生效；overrides 无 PreToolUse

- [ ] **Step 1: 迁移 + 改名 gate 脚本**

```bash
mkdir -p plugins/engineering/hooks
git mv plugins/superpowers-overrides/bin/lib/cdd-orchestrator-gate.sh plugins/engineering/bin/lib/cdd-orchestrator-gate.sh
git mv plugins/superpowers-overrides/bin/cdd-session-activate.sh plugins/engineering/bin/cdd-session-activate.sh
git mv plugins/superpowers-overrides/bin/override-claude-sdd-gate.sh plugins/engineering/bin/override-claude-cdd-gate.sh
git mv plugins/superpowers-overrides/bin/override-cursor-sdd-gate.sh plugins/engineering/bin/override-cursor-cdd-gate.sh
# 适配器内 lib source 路径同步（相对路径）
```

**生成器 hook 同步（blocker）**：`build/render-claude-hooks.sh` + `build/render-cursor-hooks.sh` 目前**生成** PreToolUse/preToolUse → override-*-sdd-gate.sh 条目 —— **从生成器删除这些 gate 条目**，重跑 `pnpm run generate:overrides` 重生成 overrides hooks.json（只余 UserPromptExpansion）与 hooks-cursor.json；`validate-overrides-build.sh` 的 PreToolUse 断言同步更新（gate hooks 归 engineering，不在 overrides 断言）。

- [ ] **Step 2: engineering hooks.json（PreToolUse）**

```json
{
  "hooks": {
    "PreToolUse": [
      { "matcher": "Write|Edit", "hooks": [{ "type": "command", "command": "${CLAUDE_PLUGIN_ROOT}/bin/override-claude-cdd-gate.sh" }] },
      { "matcher": "Bash", "hooks": [{ "type": "command", "command": "${CLAUDE_PLUGIN_ROOT}/bin/override-claude-cdd-gate.sh" }] }
    ]
  }
}
```

- [ ] **Step 3: overrides hooks.json 删 PreToolUse**

`plugins/superpowers-overrides/hooks/hooks.json` 只留 UserPromptExpansion 三个 matcher。

- [ ] **Step 4: gate 测试迁移**

`git mv` gate 测试到 engineering（`sdd-gate-allow-deny-smoke.sh` / `sdd-gate-test-lib.sh` / `override-claude-sdd-gate.test.sh` → `override-claude-cdd-gate.test.sh` / `override-cursor-sdd-gate.test.sh` → `override-cursor-cdd-gate.test.sh`），引用路径更新；ci-validate / validate-overrides-build 的 gate 测试调用改 engineering。

**`sdd-orchestrator-line-budget.test.sh` 处置**：该测试引用已删的 spor-*（薄指针化后 body 断言失效）—— 迁移到 engineering 并重定向到 os-executing-plans + engineering docs（若仍有预算意图），或删除（其内容已被 rule-reference 双模式覆盖）。二选一，保持 validate 绿。

- [ ] **Step 5: validate**

```bash
pnpm run validate
```

预期：gate 测试过（engineering 侧），overrides 路由器 hook 测试过，validate ALL PASS。

- [ ] **Step 6: 提交**

```bash
git add -A plugins/superpowers-overrides plugins/engineering scripts/ci-validate.sh
git commit -m "refactor: relocate orchestrator gate to engineering (PreToolUse hooks)"
```

---

### Task 4: os-init 落位（参数化）

**Files:**
- Create: `plugins/engineering/skills/os-init/SKILL.md`
- （spor-init 已在 T2 删除）

**Interfaces:**
- Consumes: T1（自检表指向 os-* 目标）
- Produces: `os-init spor` 写自检表到 CLAUDE.md / .cursor rules

- [ ] **Step 1: 创建 `engineering/skills/os-init/SKILL.md`**

```markdown
---
name: os-init
description: 参数化初始化工具。`os-init spor` 初始化 superpowers 自检表（写项目 CLAUDE.md / .cursor rules，表指向 os-*/cli-* 目标）。未来 `os-init <x>` 扩展其它目标。
---

# Osuperpowers Init

初始化各系统的自检表。

## Rules

### Rule: Parameterized

`os-init spor` → 写 superpowers 触发自检表（CLAUDE.md override-trigger 表 + .cursor rules），表项「上游触发 → Skill(engineering:os-* / mattpocock-skills:tdd)」。未来扩展 `os-init <x>`。

### Rule: Idempotent

重复运行覆盖自检表（保留用户手动追加的非冲突内容）。
```

- [ ] **Step 2: os-init 自检表内容（非 stub）**

os-init 生成的**自检表内容**（写进 CLAUDE.md / .cursor rules）：

```markdown
## engineering self-check

| Trigger | First tool call |
|---|---|
| `/brainstorming` | Skill(engineering:os-brainstorming) |
| `/writing-plans` | Skill(engineering:os-writing-plans) |
| `/subagent-driven-development` | Skill(engineering:cli-driven-development) |
| `/executing-plans` | Skill(engineering:os-executing-plans) |
| `/finishing-a-development-branch` | Skill(engineering:os-finishing) |
| `/systematic-debugging` | Skill(engineering:os-debugging) |
| `/test-driven-development` | Skill(mattpocock-skills:tdd) |
| `/verification-before-completion` | Skill(engineering:os-verification) |
| `/receiving-code-review` | Skill(engineering:os-code-review) |
| `/using-git-worktrees` | Skill(engineering:os-finishing) |
```

含版本戳 `<!-- engineering-version: <version> -->`（validate-overrides-build.sh 的 dogfood 断言读取；T5 版本化后同步）。自检表来源 = overrides manifest 目标表（单一 SOT）。

> **ci-validate 技能数断言**：os-init 加入后 engineering skills = **13**（12 发射 + os-init），ci-validate.sh 5b 的 EXPECTED 计数从 12 改为 13（或把 os-init 排除在计数外）。

- [ ] **Step 3: 提交**

```bash
git add plugins/engineering/skills/os-init
git commit -m "feat: add parameterized os-init skill (os-init spor)"
```

---

### Task 5: engineering 独立版本化

**Files:**
- Modify: `plugins/engineering/package.json`（版本接入 changeset）
- Modify: `scripts/version-packages.mjs` + `scripts/lib/version-utils.mjs`（双插件版本化）
- Modify: `marketplace/source.json`（engineering 版本同步）
- Modify（适配）: `.github/workflows/release.yml` / `ci.yml`

**Interfaces:**
- Consumes: 无
- Produces: engineering 独立 semver（0.1.x）经 changeset 发布

- [ ] **Step 1: version-packages.mjs 扩展双插件**

当前硬编码 `plugins/superpowers-overrides/package.json`。改为循环处理两个插件：superpowers-overrides（superpowers-相对 scheme）+ engineering（独立 semver）。`version-utils.mjs` 增加 engineering 的独立 semver 递增逻辑（minor/patch per changeset）。

- [ ] **Step 2: engineering package.json + source.json 版本**

`engineering/package.json` version 0.1.0（占位已有），接入 changeset 后 `pnpm changeset` 可递增。source.json 同步。**`.claude-plugin/plugin.json` 加 `version` 字段（0.1.0）作为 SOT**（os-init 自检表版本戳 + dogfood 断言读取；overrides 的 load_plugin_version 模式同理）。

- [ ] **Step 3: release 链适配**

`release.yml`：engineering **独立发版**（tag `engineering@0.1.x` + GitHub Release），与 superpowers-overrides 并行。单一路径，不做「与 overrides 同版本 PR」二选一。

- [ ] **Step 4: 提交**

```bash
git add -A scripts plugins/engineering/package.json marketplace/source.json .github
git commit -m "feat: independent versioning for engineering (changeset + release chain)"
```

---

### Task 6: 统一 emit 工具（superpowers 模式：薄 manifest 指向 skills/）

**Files:**
- Create/Modify: `scripts/emit.mjs`（统一发射工具；扩展现有 emit-marketplace.mjs 或并入）
- Create（emit 产物，已提交）: engineering 下 `.claude-plugin/` `.cursor-plugin/` `.codex-plugin/` `.kimi-plugin/` `gemini-extension.json` `GEMINI.md` `.agents/skills/`
- Modify: `plugins/engineering/package.json`（`pi` key：`{skills: ["./skills"]}`）
- Modify: `marketplace/source.json`（删 engineering 的 `cursor: {displayName, skills}` —— 去掉 cursor-plugins wrapper emit）
- Modify: `scripts/ci-validate.sh`（`pnpm run emit --check` freshness）
- Modify: `scripts/lib/version-utils.mjs` 或新增版本同步（仿 superpowers `.version-bump.json`）

**Interfaces:**
- Consumes: skills/ 源（12 技能 + os-init）+ T5 版本
- Produces: first-party 全部产物 —— claude/cursor/codex/kimi/gemini/pi 薄 manifest（指向 skills/）+ GEMINI.md + `.agents/skills/` + overrides hooks/自检表 + 版本同步

- [ ] **Step 1: 统一 emit 工具 `scripts/emit.mjs`**

从 `marketplace/source.json` 读 first-party 插件，生成全部产物：

```js
// 对每个 first-party 插件（superpowers-overrides, engineering）:
// 1. claude: .claude-plugin/plugin.json + marketplace 条目（grok 复用读）
// 2. cursor: .cursor-plugin/plugin.json（skills: "./skills/" 指向 canonical，无副本）
// 3. codex:  .codex-plugin/plugin.json（skills: "./skills/" + interface）
// 4. kimi:   .kimi-plugin/plugin.json（skills + sessionStart + 工具映射散文）
// 5. pi:     package.json "pi": {skills: ["./skills"]}（纯 skills 包，无 runtime 扩展）
// 6. gemini: gemini-extension.json（contextFileName: GEMINI.md）+ GEMINI.md（@-导入 skills/）
// 7. .agents/skills/: 共享副本（codex/gemini/pi/qoder/opencode 等扫描）
// 8. overrides: UserPromptExpansion hooks + 自检表（T1 逻辑并入）
// 9. engineering: PreToolUse hooks
// 10. 版本同步：所有 manifest version 一致（仿 superpowers .version-bump.json）
// --check 模式（CI freshness）：比较生成树与磁盘，drift → exit 1
```

- [ ] **Step 2: overrides 独立生成器并入**

`superpowers-overrides/build/generate-all.sh` + render-\* 脚本的 hooks/自检表生成逻辑**并入 emit.mjs**（删除独立生成器；`pnpm run emit` 统一驱动）。

- [ ] **Step 3: 去掉 cursor-plugins wrapper emit**

`marketplace/source.json`：删 engineering 的 `cursor: {displayName, skills}`。重跑 emit → `cursor-plugins/engineering/` wrapper 不再生成（cursor 产物改由统一 emit 的 `.cursor-plugin/plugin.json` 提供）。

- [ ] **Step 4: 产物提交 + CI freshness**

emit 产物已提交（fresh-clone 可解析；--check CI 防漂移）；`ci-validate.sh` 加 `node scripts/emit.mjs --check`。

- [ ] **Step 5: 运行 + freshness**

```bash
pnpm run emit
node scripts/emit.mjs --check   # drift → 报错
pnpm run validate
```

- [ ] **Step 6: 提交**

```bash
git add scripts plugins/engineering/.claude-plugin plugins/engineering/.cursor-plugin plugins/engineering/.codex-plugin plugins/engineering/.kimi-plugin plugins/engineering/gemini-extension.json plugins/engineering/GEMINI.md plugins/engineering/.agents plugins/engineering/package.json marketplace/source.json scripts/ci-validate.sh
git commit -m "feat: unified emit tool — superpowers-model thin manifests + .agents/skills + version sync"
```

> 注：emit 产物已提交（fresh-clone 可解析），`--check` CI 防漂移。rovo/vibe/kiro 不发射（无原生安装器）。

---

### Task 7: 文档 + os-* 解析适配 + 终检

**Files:**
- Modify: `README.md` / `README.zh-CN.md` / `plugins/superpowers-overrides/docs/cross-harness-overrides.md`（路由器/技能边界 + 多 harness 发射说明）
- Modify: `plugins/engineering/skills/os-*/SKILL.md`（Read Upstream 解析适配 in-harness 优先）
- Modify: `scripts/ci-validate.sh`（终态校验）

**Interfaces:**
- Consumes: T1-T6
- Produces: 文档一致 + os-* 每 harness 解析 + validate ALL PASS

- [ ] **Step 1: README / cross-harness-overrides 更新**

- README 插件表：overrides = 触发路由器（无技能），engineering = 技能 + 引擎 + gate；删已删 spor-\* 行
- cross-harness-overrides.md：更新为「路由器（claude+cursor）+ engineering 多 harness 发射」模型，删 spor-\* 引用

- [ ] **Step 2: os-* Read Upstream 解析适配**

各 os-\* 的 Rule: Read Upstream 解析器改为统一优先级：**Read upstream 当可用时（非 claude harness 用自身 Rules 兜底）**（`.agents/.cursor/.gemini/.../skills/superpowers/<name>/SKILL.md`）→ 回退兄弟插件根（claude `$CLAUDE_PLUGIN_ROOT/../superpowers`）→ 回退同仓库相对路径。

- [ ] **Step 2b: 仓库 dogfood（os-init spor）**

对本仓库运行 `os-init spor`，把项目 CLAUDE.md / .cursor rules 的自检表更新为 os-\* 目标（当前表仍映射已删 spor-\*）；`validate-overrides-build.sh` 的 dogfood 断言版本戳改为 `engineering-version`。

- [ ] **Step 3: 终检**

```bash
# 零残留（范围：引擎 + 路由器可执行产物；排除 CHANGELOG.md / docs/superpowers 历史 / build/templates 上游 prose）
grep -rnE '\b(sdd_|_sdd_|SDD_|sdd-run-|spor-)' \
  plugins/engineering/bin plugins/engineering/skills \
  plugins/superpowers-overrides/bin plugins/superpowers-overrides/hooks \
  plugins/superpowers-overrides/build/generated 2>/dev/null || echo "OK — 无残留"
pnpm run emit
pnpm run validate
```

预期：ALL PASS（路由器 + gate + build.js freshness + rule-reference 语义 + 零残留）。

- [ ] **Step 4: 提交**

```bash
git add -A
git commit -m "docs: router/engine boundary + multi-harness emit docs; os-* per-harness resolver"
```

> 全 plan 完成后：overall v1.8 P3 行标完成（Rule 3e ship 时更新 overall + 变更历史）。


---


---


---


---


---


---
