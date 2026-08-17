# Tickets: os-engineering P6a — harness 前置检查 + cli-review

Break of the P6a implementation plan（[../plans/2026-08-10-os-engineering-p6a.md](../plans/2026-08-10-os-engineering-p6a.md)，spec [../specs/2026-08-10-os-engineering-p6a-design.md](../specs/2026-08-10-os-engineering-p6a-design.md)）into tracer-bullet tickets。每个 ticket 独立 demoable。

Work the **frontier**: any ticket whose blockers are all done. Frontier = T0 + T2 可同时开工；T1 等 T0，T3 等 T2，T4 等全部。

## T0 — skills-probe 探测库 + 12-harness config

**What to build:** 一个通用 per-harness 插件可用性探测库 + 配置驱动的 12-harness 通道分类（P6b §2.5 权威）。输入 harness 名，输出 `{ missing: [{plugin, installHint}], probeFailed }`（claude plugin-list / cursor 等 skill-dir / pi package-list，探测失败 fail-open）。独立于 engine，bin/utils 自包含。

**Blocked by:** None — can start immediately。

- [ ] `skills-probe.config.mjs`：`requiredPlugins`（superpowers / mattpocock-skills / engineering / superpowers-overrides）+ `channel`（install-and-use 8 = claude/cursor-agent/droid/grok/qoder/codex/gemini/pi；os-init 4 = opencode/trae/vibe/kiro）+ 每 harness 探测路径/installHint（pi hint 带 `npm:` 前缀）；删除 `piDirCopyPlugins` 例外
- [ ] `skills-probe.mjs`：`probeSkills(harness, { requiredPlugins, cwd, env })` 按 config 分派；CLI 抛错 → `probeFailed: true`
- [ ] 单测（mock `claude plugin list` / `pi list` / skill-dir glob）：claude installed-but-disabled 区分；probe 失败 fail-open；fixture 驱动
- [ ] `pnpm run validate` ALL PASS

## T1 — runner skills-missing gate（全 mode）

**What to build:** `runTask` 全 mode（implement/review/fix）进入嵌套 CLI 前加 skills-missing gate：安装即用通道缺失 → exit 3 + stderr 安装指引（不调嵌套 CLI）；os-init 通道缺失 → 提示 `os-init harness <name>`（非故障）；探测失败 → fail-open；plan/brief/templates 缺失 → BLOCKED exit 1（非 exit 3）。0/1/2 语义不动。

**Blocked by:** T0

- [ ] `runTask` 加 `opts.probeSkills` DI（默认 import `skills-probe.mjs`）；既有 9 个 runTask 测试传 fake probe（env 无关）
- [ ] gate 单测（noExit + capture）：implement 缺失 → exit 3 + stderr hint、不调嵌套 CLI；os-init → 提示；probeFailed → fail-open；brief/templates → exit 1
- [ ] `pnpm run validate` ALL PASS

## T2 — os-brainstorming spec review 走 cdd-exec

**What to build:** Rule 1（spec review）从 in-session subagent 派发改成每 pass 一次 fresh `cdd-exec` 调用；`review-dispatch.md` 补 cli review 模式映射（D1 零发现→跳过/否则并发、D2 中间 pass delta + Pass 3 恒 full、D3 findings-only；每 pass 新 cli 会话 = fresh）。review 模板仍从上游 Read-Upstream 解析，不新建。

**Blocked by:** None — can start immediately（cdd-exec 已存在）。

- [ ] os-brainstorming Rule 1 改写：每 pass 一次 `cdd-exec --harness claude --prompt "<模板 + pass 类别 + 文档路径>"`
- [ ] `review-dispatch.md`：D1/D2/D3 + fresh-pass 在 cli review 的映射（subagent-lifecycle「每 pass 新 agent」= 每 pass 新 cli 会话）
- [ ] `pnpm run emit` 再生成 `.agents/skills/engineering/os-brainstorming/SKILL.md`（不 drift）；validate ALL PASS

## T3 — os-writing-plans plan review 走 cdd-exec

**What to build:** Rule 2（plan review）同 T2 模式改经 `cdd-exec` 派发，复用同一 review-dispatch 映射与上游模板解析规则。plan-document-reviewer 模板来自上游 writing-plans。

**Blocked by:** T2

- [ ] os-writing-plans Rule 2 改写：3 类 pass 每 pass 一次 fresh `cdd-exec`
- [ ] `pnpm run emit` 再生成 emit 产物 SKILL.md（不 drift）；validate ALL PASS

## T4 — 文档 + 终检

**What to build:** CLAUDE.md 前置检查/exit-3 说明 + cdd-reference exit codes 表补 `3 = skills-missing`；对照 spec §2.6 验收逐条勾验。

**Blocked by:** T0, T1, T2, T3

- [ ] CLAUDE.md：前置检查（全 mode，缺失 exit 3 + 安装指引）一节 + skills-probe 引用
- [ ] cdd-reference.md：exit codes 表补 `3 = skills-missing`（区别于 2 = CLI-missing）
- [ ] 终检：`pnpm run validate && node --test packages/engineering/bin/utils/tests packages/engineering/bin/engine/tests` 全 PASS；spec §2.6 逐条勾验