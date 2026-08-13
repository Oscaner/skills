# Tickets: engineering P3（薄封装 + 统一 emit）

superpowers-overrides 收缩为触发路由器（无技能体），engineering 承载技能 + 引擎 + gate + 统一 emit（superpowers 模式薄 manifest）。参见 [实施计划](../plans/2026-08-10-engineering-p3.md) 与 [阶段 spec](../specs/2026-08-10-engineering-p3-design.md)。

Work the **frontier**：T1 无阻塞；T2 依赖 T1；T3 依赖 T1/T2；T4 依赖 T2；T5 依赖 T4；T6 依赖 T5；T7 依赖 T3-T6。

## T1 路由器 retarget（manifest → os-*）

**What to build:** 触发路由器从 spor-* 指向 os-*/cli-*/mattpocock 目标；hooks/expansion/自检表指向新目标。

**Blocked by:** None — can start immediately.

- [ ] `overrides.manifest.json` 目标表 → engineering:* / mattpocock-skills:tdd（含 using-git-worktrees → os-finishing）
- [ ] schema + manifest_targets.py 放宽（spor- 约束移除、跨插件 source、null source）
- [ ] 生成器注入「MUST invoke <目标>」；删 `/spor-*` matcher；路由器不写 pending
- [ ] 触发/路由器测试（trigger-patterns + prompt-expansion/detect/enforce）retarget
- [ ] manifest 目标存在性校验（engineering/skills + mattpocock engineering/tdd）
- [ ] validate ALL PASS

## T2 删 spor-* + rule-reference 数字退役

**What to build:** overrides 无技能体；rule-reference 仅语义。

**Blocked by:** T1

- [ ] 删除 14 个 spor-* 技能
- [ ] plugin.json skills 移除 + 生成 manifest（cursor/codex）同步 + manifest-harness 测试
- [ ] ci-validate.sh 空 skills 目录 guard
- [ ] rule-reference.test.py 仅语义模式；validate-overrides-build 四块 spor- 断言移除
- [ ] validate ALL PASS

## T3 gate 迁入 engineering

**What to build:** gate 脚本 + adapters（改名 cdd）+ PreToolUse hooks 迁入 engineering；overrides 只剩 UserPromptExpansion。

**Blocked by:** T1, T2

- [ ] cdd-orchestrator-gate + cdd-session-activate + 2 adapters（override-claude/cursor-cdd-gate）迁入 + 生成器 hook 同步
- [ ] engineering hooks.json（PreToolUse）+ overrides hooks.json 只余 UserPromptExpansion
- [ ] gate 测试迁移 + line-budget 测试处置
- [ ] validate ALL PASS

## T4 os-init 参数化

**What to build:** `os-init spor` 写自检表（10 映射 + 版本戳），指向 os-*/cli-*。

**Blocked by:** T2

- [ ] os-init SKILL.md（参数化，自检表内容非 stub）
- [ ] ci-validate 技能数 13；dogfood 断言版本戳 engineering
- [ ] 提交

## T5 独立版本化

**What to build:** engineering 独立 semver + changeset；version-packages.mjs 双插件。

**Blocked by:** T4

- [ ] version-packages.mjs + version-utils.mjs 扩展双插件
- [ ] package.json + plugin.json version（SOT）+ source.json 同步
- [ ] release 链独立发版（engineering@0.1.x）

## T6 统一 emit 工具（superpowers 模式）

**What to build:** `pnpm run emit` 从 source.json 生成 first-party 全部产物 —— 薄 manifest 指向 skills/（claude/cursor/codex/kimi/gemini/pi）+ GEMINI.md + `.agents/skills/` + overrides hooks/自检表 + 版本同步；rovo/vibe/kiro 不发射。

**Blocked by:** T5

- [ ] scripts/emit.mjs（薄 manifest + GEMINI.md + .agents/skills + hooks + 版本同步 + --check）
- [ ] overrides 独立生成器并入；cursor-plugins wrapper emit 移除
- [ ] pi key（skills-only 包）；CI freshness
- [ ] validate ALL PASS

## T7 文档 + os-* 解析 + 终检

**What to build:** README/cross-harness 边界文档；os-* Read Upstream 兄弟插件根优先；零残留 + validate ALL PASS。

**Blocked by:** T3-T6

- [ ] README/README.zh-CN/cross-harness-overrides 更新（路由器/技能边界 + 统一 emit）
- [ ] 仓库 dogfood（os-init spor 更新项目自检表）
- [ ] os-* Read Upstream 解析适配（兄弟插件根优先）
- [ ] 零残留 grep + `pnpm run emit && pnpm run validate` ALL PASS
