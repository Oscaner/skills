# os-engineering P3 阶段设计：薄封装 + 多 harness 发射

## Header

- **Version**: v1.0 · 2026-08-10
- **Status**: Draft
- **Author**: Oscaner Miao · Claude Code (Opus 4.8)
- **Parent program**: [os-engineering 整体设计 v1.7](2026-08-10-os-engineering-overall.md)
- **Depends on**: P1+P2（os-engineering 插件 + cli-\* + os-\* 家族 + cdd 引擎 + gate 模式感知已就位）

## §0 Incremental warning

> P3 增量只涉及本阶段。跨阶段约定以 overall v1.7 为准；冲突时 overall 优先。

## §1 Constraints pointer

不重复 overall 约定。P3 生效的约束：

- **终态边界**：superpowers-overrides = 触发路由器（plugin-root，claude+cursor，**无技能体**）；os-engineering = 技能 + 引擎 + gate + 全 harness emit
- 多 harness 发射仿 impeccable 模式（build.js + PROVIDERS，per-harness 副本）
- os-\* Read 上游 superpowers → 每 harness 连带就位上游技能
- `pnpm run validate` 每任务后 ALL PASS；零 sdd 残留（既有 5c）
- 提交信息 conventional commits，无 attribution

## §2 Design body

### 架构

superpowers-overrides 收缩为触发路由器（只做「上游 slash 触发 → os-\*/cli-\* 目标」的拦截与注入），spor-\* 全部删除；os-engineering 成为唯一承载（技能 + cdd 引擎 + gate + 全 harness 发射）。

```
superpowers-overrides/            os-engineering/
  overrides.manifest.json           skills/ (8 os-* + 4 cli-* + os-init)
  hooks/hooks.json (UserPrompt)     bin/ (cdd engine + gate 迁入)
  hooks/hooks-cursor.json           hooks/hooks.json (PreToolUse)
  bin/override-prompt-expansion.sh  docs/ templates/cdd/ tests/
  build/ (generator + generated)    scripts/build.js (多 harness 发射)
  (无 skills/)
```

### 组件

#### A. superpowers-overrides → 触发路由器

**A1. Manifest 目标表**（`overrides.manifest.json` 重构：`spor-<slug>` → 目标技能）：

| 上游触发 | 目标 |
|---|---|
| superpowers:brainstorming | os-engineering:os-brainstorming |
| superpowers:writing-plans | os-engineering:os-writing-plans |
| superpowers:subagent-driven-development | os-engineering:cli-driven-development |
| superpowers:executing-plans | os-engineering:os-executing-plans |
| superpowers:finishing-a-development-branch | os-engineering:os-finishing |
| superpowers:systematic-debugging | os-engineering:os-debugging |
| superpowers:test-driven-development | mattpocock-skills:tdd |
| superpowers:verification-before-completion | os-engineering:os-verification |
| superpowers:receiving-code-review | os-engineering:os-code-review |
| superpowers:using-git-worktrees | os-engineering:os-finishing（注入措辞与其它行相同「MUST invoke os-engineering:os-finishing」；worktree 拒绝由 os-finishing 内部 Rule: No Worktrees 承担） |

**A2. hooks / expansion / 自检表**：UserPromptExpansion（`^superpowers:` / `/<upstream-slug>` / `^/spor-*`）→ `override-prompt-expansion.sh` 读 manifest 注入「MUST invoke <目标>」；自检表（build/generated/*）列目标。Cursor detect+enforce hooks 同步指向目标。

**A3. spor-\* 全部删除**：8 薄指针 + 3 映射 + spor-init + spor-handoff-writer + spor-token-efficient-controller-handoff（内容已迁 os-engineering docs）。`plugin.json` skills/ 置空（或移除）。

**A4. rule-reference 数字模式退役**：`rule-reference.test.py` 仅语义模式（overrides 无技能可校验）。

#### B. os-engineering → 技能 + 引擎 + gate + 全 harness emit

**B1. gate 迁入**：`cdd-orchestrator-gate.sh` + `cdd-session-activate.sh` + 2 adapters（随迁入**改名**为 `override-claude-cdd-gate.sh` / `override-cursor-cdd-gate.sh`，符合 sdd→cdd 更名约束）从 overrides 迁至 os-engineering `bin/`；os-engineering `hooks.json` 声明 **PreToolUse**（Write|Edit + Bash → gate）。**pending 路径共享**：`$TMPDIR/oscaner-superpowers-overrides/pending-cdd/<session_key>.json`（gate 与 cdd 引擎共用；overrides 路由器不写 pending）。overrides hooks.json 只剩 UserPromptExpansion。

**B2. os-init 落位**：`os-engineering/skills/os-init/SKILL.md` 参数化 —— `os-init spor` 写 superpowers 自检表（CLAUDE.md / .cursor rules，表指向 os-\*/cli-\*）；未来 `os-init <x>` 扩展。spor-init 删除。

**B3. 独立版本化**：os-engineering 从占位 0.1.0 接入 changeset；`version-packages.mjs` 扩展同时版本化 superpowers-overrides + os-engineering；release.yml/CI 适配。

**B4. 多 harness 发射（impeccable 模式）**：`os-engineering/scripts/build.js` + `lib/providers.js`（PROVIDERS 配置：每 harness configDir + transformer），把 skills/ 下 **12 技能**（8 os-\* + 4 cli-\*）发射到 harness 目录。**os-init 排除**（claude+cursor 专用的自检表安装工具，只存 `.claude/` + `.cursor/`，不随全 harness 发射）。**claude 用 `skills/` 源树（plugin.json 指向 `./skills/`，发射产物非 claude 用）**；build.js 发射到其余 harness 目录全集：

```
.cursor/  .gemini/  .pi/  .codex/  .agents/  .grok/  .opencode/
.trae/  .trae-cn/  .rovodev/  .qoder/  .github/  .vibe/  .kiro/
```

（**14 个非 claude harness**；`skills/` 即 claude 版，无 `.claude/skills/` 发射副本。）

- per-harness frontmatter 变换（仿 impeccable transformers）
- **上游协调**：build.js **整目录复制** `plugins/superpowers/skills/`（read submodule，不编辑）进各 harness 目录 → 每 harness 同时有 os-\* + 全部上游技能
- **去掉 cursor-plugins wrapper emit**：source.json 删 os-engineering 的 `cursor: {displayName, skills}` 配置

**B5. os-\* 技能内容**（多 harness 解析适配）：

- `{superpowers-plugin-root}` 解析器统一：**in-harness 副本优先**（cursor/gemini/pi 等 → `.cursor/.gemini/.pi/.../skills/superpowers`），失败回退兄弟插件根（claude → `$CLAUDE_PLUGIN_ROOT/../superpowers`）→ 再回退同仓库相对路径。单一优先级，无「或」并列。
- **非 claude+cursor harness 的触发**：build.js 向各 harness 目录写一个 self-check/README（如 `.cursor/rules/`、`.gemini/GEMINI.md`、`.pi/SYSTEM.md`），指引**直接调用 os-\***（`/os-brainstorming` 等，不经上游 slash 拦截——路由器 hooks 只存在于 claude+cursor）。文档同步说明。

#### C. 文档

- README / README.zh-CN / cross-harness-overrides.md 更新为「路由器 / 技能」边界 + 多 harness 发射说明
- 删除已删 spor-\* 的残留行

### 数据流

```
/brainstorming → overrides UserPromptExpansion hook → expansion 注入「MUST invoke os-engineering:os-brainstorming」
  → agent 调 Skill(os-engineering:os-brainstorming)
  → Rule: Read Upstream 解析 {superpowers-plugin-root}（每 harness）→ Read 上游 → 个人规则
```

### 错误处理

| 场景 | 行为 |
|------|------|
| manifest 目标技能不存在 | expansion 报错 + 列出缺失 |
| 上游 superpowers 未就位某 harness | os-\* Read Upstream 报错 + 提示 emit 或解析路径 |
| 非 marketplace harness 触发 | 自检表/文档指引手动复制 |

### 测试

- manifest 目标校验（触发 → 目标存在，含 mattpocock tdd / os-finishing 等）
- hooks 注入内容指向 os-\*（trigger-patterns 测试更新）
- gate 迁移后 PreToolUse 测试（os-engineering hooks 注册 + cdd-orchestrator-gate 生效）
- rule-reference 仅语义模式
- build.js freshness（CI：发射产物无 drift）
- 上游协调（各 harness 目录含 **8 os-\* + 4 cli-\*** + 上游副本；os-init 仅 claude/cursor）
- `pnpm run validate` ALL PASS

### 验收标准

- [ ] superpowers-overrides 无技能体（spor-\* 全删），manifest 目标表指向 os-\*/cli-\*/mattpocock tdd
- [ ] hooks/expansion/自检表指向 os-\* 目标，触发测试通过
- [ ] rule-reference 仅语义模式（数字模式退役）
- [ ] gate 全迁 os-engineering（bin + PreToolUse hooks），gate 测试通过
- [ ] os-init `os-init spor` 落位（参数化），写自检表指向 os-\*/cli-\*
- [ ] os-engineering 独立版本化（changeset + version-packages.mjs 扩展）
- [ ] build.js 多 harness 发射（**12 技能 = 8 os-\* + 4 cli-\*** 到 **14 非 claude harness** 目录 + 上游整目录连带；os-init 排除只存 .claude/.cursor），CI freshness
- [ ] cursor-plugins wrapper emit 移除
- [ ] README / cross-harness-overrides 文档更新
- [ ] `pnpm run validate` ALL PASS；零 sdd 残留

## §3 Deviations from overall

| Overall 假设 | 阶段决定 | Overall 已更新? |
|---|---|---|
| P3 为「薄封装」仅 hooks/生成器/自检表重写 | 扩为「薄封装 + 多 harness 发射」：os-engineering 全量 impeccable 模式 build.js + 上游协调；overrides 终态为无技能体路由器 | 是（v1.7 P3 行） |

## §4 Notes for downstream（P4）

- **P4 = 原生 marketplace + 跨 harness gate**（研究结论：P3 纯目录复制无产品风险，P4 拆出协议级工作）：
  - 原生插件清单：Gemini（gemini-extension.json）、Codex（.codex-plugin）、Qoder（.qoder-plugin）、Pi（pi package）、Grok（[[marketplace.sources]]，可选）、Trae（extension，格式待研）
  - gate PreToolUse/BeforeTool adapters：Grok（最高优先，最接近 claude）/ Qoder（Claude-identical 事件名）/ Codex / Gemini（BeforeTool + 指纹信任）/ Vibe（pre_tool TOML）/ Kiro（PreToolUse JSON）；Copilot 因 matcher 忽略延后
  - 非 claude+cursor 路由扩展（仅当产品需求出现）
- **`.agents/skills/` 是一等发射目标**（9 harness 读取：Codex/Cursor/Gemini/Copilot/OpenCode/Pi/Rovo/Vibe/Grok）—— build.js 优先保证此目录完整
- **per-harness self-check/README**（B5）经研究确认为必要：路由器 hooks 仅 claude+cursor 存在，其余 harness 靠写进指令文件（GEMINI.md / AGENTS.md / .pi/SYSTEM.md / .trae/rules / .kiro/steering 等）的 self-check 表做主要执行
- 研究参考：`docs/research/2026-08-10-harness-marketplace-hooks.md`（每 harness marketplace/hooks/skill/指令文件矩阵 + per-harness 评估 + 源引用）

## §5 Review

Rule 1 passes（Completeness → Consistency & scope → Clarity & YAGNI）before user review and writing-plans。
