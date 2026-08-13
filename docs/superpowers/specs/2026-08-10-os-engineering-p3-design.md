# os-engineering P3 阶段设计：薄封装 + 多 harness 发射

## Header

- **Version**: v1.0 · 2026-08-10
- **Status**: Draft
- **Author**: Oscaner Miao · Claude Code (Opus 4.8)
- **Parent program**: [os-engineering 整体设计 v2.0](2026-08-10-os-engineering-overall.md)
- **Depends on**: P1+P2（engineering 插件 + cli-\* + os-\* 家族 + cdd 引擎 + gate 模式感知已就位）

## §0 Incremental warning

> P3 增量只涉及本阶段。跨阶段约定以 overall v2.0 为准；冲突时 overall 优先。

## §1 Constraints pointer

不重复 overall 约定。P3 生效的约束：

- **终态边界**：superpowers-overrides = 触发路由器（plugin-root，claude+cursor，**无技能体**）；engineering = 技能 + 引擎 + gate + 全 harness emit
- 多 harness 发射仿 impeccable 模式（build.js + PROVIDERS，per-harness 副本）
- os-\* Read 上游 superpowers **当可用时**（claude/cursor 带 superpowers 插件）；不可用则以自身 Rules 为完整流程 —— **不 vendor 上游**（决策 B）
- `pnpm run validate` 每任务后 ALL PASS；零 sdd 残留（既有 5c）
- 提交信息 conventional commits，无 attribution

## §2 Design body

### 架构

superpowers-overrides 收缩为触发路由器（只做「上游 slash 触发 → os-\*/cli-\* 目标」的拦截与注入），spor-\* 全部删除；engineering 成为唯一承载（技能 + cdd 引擎 + gate + 全 harness 发射）。

```
superpowers-overrides/            engineering/
  overrides.manifest.json           skills/ (8 os-* + 4 cli-* + os-init)
  hooks/hooks.json (UserPrompt)     bin/ (cdd engine + gate 迁入)
  hooks/hooks-cursor.json           hooks/hooks.json (PreToolUse)
  bin/override-prompt-expansion.sh  docs/ templates/cdd/ tests/
  build/ (generator + generated)    .claude-plugin/ .cursor-plugin/ .codex-plugin/
  (无 skills/)                      .kimi-plugin/ gemini-extension.json 等（统一 emit 产物）
```

（engineering 的薄 manifest / GEMINI.md / .agents/skills 由统一 emit 工具生成。）

### 组件

#### A. superpowers-overrides → 触发路由器

**A1. Manifest 目标表**（`overrides.manifest.json` 重构：`spor-<slug>` → 目标技能）：

| 上游触发 | 目标 |
|---|---|
| superpowers:brainstorming | engineering:os-brainstorming |
| superpowers:writing-plans | engineering:os-writing-plans |
| superpowers:subagent-driven-development | engineering:cli-driven-development |
| superpowers:executing-plans | engineering:os-executing-plans |
| superpowers:finishing-a-development-branch | engineering:os-finishing |
| superpowers:systematic-debugging | engineering:os-debugging |
| superpowers:test-driven-development | mattpocock-skills:tdd |
| superpowers:verification-before-completion | engineering:os-verification |
| superpowers:receiving-code-review | engineering:os-code-review |
| superpowers:using-git-worktrees | engineering:os-finishing（注入措辞与其它行相同「MUST invoke engineering:os-finishing」；worktree 拒绝由 os-finishing 内部 Rule: No Worktrees 承担） |

**A2. hooks / expansion / 自检表**：UserPromptExpansion（`^superpowers:` / `/<upstream-slug>`，**`^/spor-*` 过渡别名结束移除**）→ `override-prompt-expansion.sh` 读 manifest 注入「MUST invoke <目标>」；自检表（build/generated/*）列目标。Cursor detect+enforce hooks 同步指向目标。

**A3. spor-\* 全部删除**：8 薄指针 + 3 映射 + spor-init + spor-handoff-writer + spor-token-efficient-controller-handoff（内容已迁 engineering docs）。`plugin.json` skills/ 置空（或移除）。

**A4. rule-reference 数字模式退役**：`rule-reference.test.py` 仅语义模式（overrides 无技能可校验）。

#### B. engineering → 技能 + 引擎 + gate + 全 harness emit

**B1. gate 迁入**：`cdd-orchestrator-gate.sh` + `cdd-session-activate.sh` + 2 adapters（随迁入**改名**为 `override-claude-cdd-gate.sh` / `override-cursor-cdd-gate.sh`，符合 sdd→cdd 更名约束）从 overrides 迁至 engineering `bin/`；engineering `hooks.json` 声明 **PreToolUse**（Write|Edit + Bash → gate）。**pending 路径共享**：`$TMPDIR/oscaner-engineering/pending-cdd/<session_key>.json`（gate 与 cdd 引擎共用；overrides 路由器不写 shared `pending-cdd/` gate pending —— attach-detection pending 写 `$TMPDIR/oscaner-superpowers-overrides/pending`，是其自有机制）。overrides hooks.json 只剩 UserPromptExpansion。

**B2. os-init 落位**：`engineering/skills/os-init/SKILL.md` 参数化 —— `os-init spor` 写 superpowers 自检表（CLAUDE.md / .cursor rules，表指向 os-\*/cli-\*）；未来 `os-init <x>` 扩展。spor-init 删除。

**B3. 独立版本化**：engineering 从占位 0.1.0 接入 changeset；`version-packages.mjs` 扩展同时版本化 superpowers-overrides + engineering；release.yml/CI 适配。

**B4. 统一 emit 工具（superpowers 模式）**：仿 superpowers 插件结构 —— **canonical `skills/` + 薄 manifest 指向它**（不做 per-harness 技能副本）。`pnpm run emit`（统一工具，从 `marketplace/source.json` 生成 first-party 全部产物）：

- **engineering 薄 manifest**（各指向 `./skills/`）：
  - `.claude-plugin/plugin.json` + marketplace 条目（claude；grok 直接读）
  - `.cursor-plugin/plugin.json`（cursor）
  - `.codex-plugin/plugin.json`（codex）
  - `.kimi-plugin/plugin.json`（kimi，含 sessionStart + 工具映射散文）
  - `package.json` `pi` key（`pi: {skills: ["./skills"]}`，纯 skills 包，无 runtime 扩展）
  - `gemini-extension.json` + `GEMINI.md`（@-导入 skills/）
- `.agents/skills/` 共享副本（**仅 engineering skills**；codex/gemini/pi/qoder/opencode/copilot 等扫描；不 vendor 上游 superpowers）
- overrides 路由器 hooks（UserPromptExpansion）+ 自检表 + engineering PreToolUse hooks
- **版本同步**（仿 superpowers `.version-bump.json`：一个工具同步所有 manifest 的 version）
- **丢弃 rovo/vibe/kiro**（无原生安装器）

**去掉 cursor-plugins wrapper emit**：source.json 删 engineering 的 `cursor: {displayName, skills}` 配置（并入统一 emit 的 cursor manifest）。

**B5. os-\* 技能内容**（多 harness 解析适配）：

- `{superpowers-plugin-root}` 解析器统一：**Read upstream 当可用时**（claude `$CLAUDE_PLUGIN_ROOT/../superpowers`，回退 `<repo-root>/plugins/superpowers`）；**不可用（非 claude harness 无 superpowers）→ 以 os-* 自身 Rules 为完整流程**，不报错。
- **非 claude+cursor harness 的触发**：统一 emit 写 per-harness self-check/README（GEMINI.md / AGENTS.md / .pi/SYSTEM.md 等），指引**直接调用 os-\***（不经上游 slash 拦截——路由器 hooks 只存在于 claude+cursor）。文档同步说明。

#### C. 文档

- README / README.zh-CN / cross-harness-overrides.md 更新为「路由器 / 技能」边界 + 多 harness 发射说明
- 删除已删 spor-\* 的残留行

### 数据流

```
/brainstorming → overrides UserPromptExpansion hook → expansion 注入「MUST invoke engineering:os-brainstorming」
  → agent 调 Skill(engineering:os-brainstorming)
  → Rule: Read Upstream（当可用时 Read 上游 → 个人规则；不可用则以自身 Rules 为完整流程）
```

### 错误处理

| 场景 | 行为 |
|------|------|
| manifest 目标技能不存在 | expansion 报错 + 列出缺失 |
| 上游 superpowers 未就位某 harness | 非报错：os-\* 以自身 Rules 为完整流程（Read upstream 是增强非依赖） |
| 非 marketplace harness 触发 | 自检表/文档指引手动复制 |

### 测试

- manifest 目标校验（触发 → 目标存在，含 mattpocock tdd / os-finishing 等）
- hooks 注入内容指向 os-\*（trigger-patterns 测试更新）
- gate 迁移后 PreToolUse 测试（engineering hooks 注册 + cdd-orchestrator-gate 生效）
- rule-reference 仅语义模式
- **统一 emit 工具 freshness**（CI：`pnpm run emit --check` 产物无 drift；薄 manifest / GEMINI.md / .agents/skills / hooks 全比对）
- 版本同步（.version-bump.json 式：所有 manifest version 一致）
- `pnpm run validate` ALL PASS

### 验收标准

- [ ] superpowers-overrides 无技能体（spor-\* 全删），manifest 目标表指向 os-\*/cli-\*/mattpocock tdd
- [ ] hooks/expansion/自检表指向 os-\* 目标，触发测试通过
- [ ] rule-reference 仅语义模式（数字模式退役）
- [ ] gate 全迁 engineering（bin + PreToolUse hooks），gate 测试通过
- [ ] os-init `os-init spor` 落位（参数化），写自检表指向 os-\*/cli-\*
- [ ] engineering 独立版本化（changeset + version-packages.mjs 扩展）
- [ ] **统一 emit 工具**：`pnpm run emit` 生成 first-party 全部产物 —— claude/cursor/codex/kimi/gemini/pi 薄 manifest（指向 skills/）+ GEMINI.md + `.agents/skills/` + overrides hooks + 版本同步；CI freshness；rovo/vibe/kiro 不发射
- [ ] cursor-plugins wrapper emit 移除
- [ ] README / cross-harness-overrides 文档更新
- [ ] `pnpm run validate` ALL PASS；零 sdd 残留

## §3 Deviations from overall

| Overall 假设 | 阶段决定 | Overall 已更新? |
|---|---|---|
| P3 为「薄封装」仅 hooks/生成器/自检表重写 | 扩为「薄封装 + 统一 emit」：engineering 的 per-harness 发射改为 **superpowers 模式**（薄 manifest 指向 skills/，非副本），统一 emit 工具从 source.json 生成 first-party 全部产物 | 是（v1.9 P3 行） |
| 原生清单归 P4 | 原生薄 manifest（claude/cursor/codex/kimi/gemini/pi）并入 P3 统一 emit；P4 缩为跨 harness gate adapters + 重运行时产物 | 是（v1.9 P4 行） |
| 发射 14 harness | 丢弃 rovo/vibe/kiro（无原生安装器），余 claude/cursor/codex/kimi/gemini/pi + grok（读 claude marketplace）+ .agents 共享 | 是（v1.9 P3 行） |

## §4 Notes for downstream（P4）

- **P4 = 跨 harness gate adapters + 重运行时产物**：
  - gate PreToolUse/BeforeTool adapters：Grok（最高优先）/ Qoder / Codex / Gemini（BeforeTool + 指纹信任）/ Vibe（pre_tool TOML）/ Kiro（PreToolUse JSON）；Copilot 因 matcher 忽略延后
  - 重运行时产物：opencode runtime 插件 / pi TS 扩展（engineering 纯 markdown 目前不需要）
  - Trae 原生 extension（格式待研）
- **统一 emit 工具是单一路径**：source.json 单一配置，一个 `pnpm run emit`（含 `--check` CI freshness + 版本同步）生成 first-party 全部产物
- **决策 B（P3 内）**：engineering **不 vendor 上游 superpowers** —— `.agents/skills/` 只含 engineering skills（不再整目录复制 `plugins/superpowers/skills/`）。os-\* Rule: Read Upstream 改为 **when-available**：claude/cursor 带 superpowers 插件 → Read 上游作基线；非 claude harness 无 superpowers → 以自身 Rules 为完整流程，不报错。os-\* 自身 Rules 是承重流程。
- **研究参考**：`docs/research/2026-08-10-harness-marketplace-hooks.md` + superpowers 插件结构（canonical skills/ + 薄 manifest 指向）

## §5 Review

Rule 1 passes（Completeness → Consistency & scope → Clarity & YAGNI）before user review and writing-plans。
