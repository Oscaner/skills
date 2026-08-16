# Tickets: os-engineering P6a（harness 前置检查 + spec/plan review 走 cli review）

给 CDD 引擎加 skills-missing 前置检查（全 mode，缺上游插件提前 exit 3 + 安装指引）；spec/plan review 改经 cdd-exec 派发。源计划: [2026-08-10-os-engineering-p6a.md](../plans/2026-08-10-os-engineering-p6a.md)。

Work the **frontier**：T0 无阻塞；T1 依赖 T0；T2 无阻塞；T3 依赖 T2；T4 依赖 T0-T3。

## T0 skills-probe 探测库 + 配置

**What to build:** `bin/utils/skills-probe.mjs`（通用 per-harness 插件可用性探测：claude plugin list + enabledPlugins + 缓存 glob 区分未安装/禁用；cursor-agent/droid/pi/opencode skill-dir 或 package-list）+ `skills-probe.config.mjs`（配置驱动：required plugins + 每 harness 探测路径/安装指引）。

**Blocked by:** None — can start immediately.

- [ ] `probeSkills(harness, {requiredPlugins, cwd, env}) → {missing: [{plugin, installHint}], probeFailed}` 导出
- [ ] config 含 claude/cursor-agent/droid/pi/opencode 探测 + claude marketplace-add 前置 + pi 目录复制例外
- [ ] 单测全绿（缺失/已禁用/探测失败 fail-open）

## T1 runner skills-missing gate（全 mode exit 3）

**What to build:** `runTask` 全 mode（implement/review/fix）进入嵌套 CLI 前调 skills-probe（plan/brief/templates 就位 + 插件可用）；缺失 → exit 3 + stderr 安装指引；探测失败 fail-open；DI seam（opts.probeSkills）保持现有 runner 测试环境无关。

**Blocked by:** T0

- [ ] 全 mode exit 3 + stderr hint + 不调嵌套 CLI
- [ ] brief/templates 缺失检查
- [ ] probeFailed fail-open；0/1/2 语义不动
- [ ] 现有 runner.test.mjs 9 个调用传 probeSkills stub 保持环境无关

## T2 os-brainstorming cli-review

**What to build:** os-brainstorming Rule 1（spec review）改经 `cdd-exec` 派发（每 pass 一次 fresh cli 调用，prompt = reviewer 模板 + pass 类别 + 文档路径）；review-dispatch.md 补 cli review 模式 D1（零发现→跳过/否则并发）/D2/D3 映射；emit 再生成 `.agents/skills/` 镜像。

**Blocked by:** None

- [ ] Rule 1 改写（cdd-exec 派发 + D1-D3 引用）
- [ ] review-dispatch.md cli 映射
- [ ] `pnpm run emit` + validate（.agents/skills 不 drift）

## T3 os-writing-plans cli-review

**What to build:** os-writing-plans Rule 2（plan review）改经 `cdd-exec` 派发（复用 T2 的 review-dispatch 映射）；emit 再生成镜像。

**Blocked by:** T2

- [ ] Rule 2 改写（cdd-exec 派发 + 模板解析复用 Read-Upstream 路径规则）
- [ ] `pnpm run emit` + validate

## T4 文档 + 终检

**What to build:** CLAUDE.md / cdd-reference.md 补前置检查 + exit-3 说明；对照 spec §2.6 验收逐条勾验。

**Blocked by:** T0-T3

- [ ] CLAUDE.md / cdd-reference exit codes 表补 exit 3（skills-missing）
- [ ] `pnpm run validate` + 全部 node:test ALL PASS
