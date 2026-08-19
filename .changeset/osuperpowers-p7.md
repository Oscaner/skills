---
"@oscaner-skills/osuperpowers": patch
"@oscaner-skills/osuperpowers-router": patch
---

osuperpowers P7 — brand unification + legacy naming cleanup（`engineering` → `osuperpowers`）。

**P7a — 包目录改名 + emit 适配**：`packages/engineering` → `packages/osuperpowers`、`packages/superpowers-overrides` → `packages/osuperpowers-router`；package.json（name/repository.directory/description）、`scripts/emit.mjs`、`scripts/ci-validate.mjs`、emit tests 全部同步；`pnpm run emit` 重生成全派生 manifest。

**P7b — 技能目录改名 + 命名空间**：9 个 `skills/os-*` 目录去 `os-` 前缀（`os-brainstorming` → `brainstorming` 等）；命名空间统一 `osuperpowers:*`（router 目标表、SKILL.md 引用、`skills/init/` 自检表、`.agents/skills` 复制同步）；emit namespace 名更新。

**P7c — 版本管理 + 发布流水线**：`version-packages.mjs` 包名 → `@oscaner-skills/osuperpowers`；`release.yml` tag 前缀 → `osuperpowers-router@`/`osuperpowers@`；opencode config、issue templates 标签、GitHub labels、`.changeset/README.md` 残留引用清理；已消费 changeset 移除。

**P7d — 旧命名零技术债务清理**：emit 函数名（`engineeringClaudeHooks`/`engineeringCursorHooks`/`engineeringHooksFor`/`emitOsEngineering` → `osuperpowers*`）+ 元数据（category/keywords/description）；运行时 pending 根 `${TMPDIR}/osuperpowers/pending-cdd`（硬切，fail-open 安全）；harness 通道 `os-init` → `init`（hint 统一 `osuperpowers:init harness <name>`）；安装面 `bin/os-init` → `bin/init`、manifest `~/.osuperpowers/state/`、产物名 `osuperpowers.json`/`osuperpowers.ts`、`osuperpowersVersion`/`OSUPERPOWERS_VERSION`、vibe hook `osuperpowers-cdd-gate`；插件文档/技能体/router 文档全量清理（含删除 SUPERSEDED `sdd-h6-reference.md`）；验收车道重设计（`-i` token 模式 + 文件名扫描 + 白名单，替代易漏的逐行 `-v` grep）；历史 P7 文档 + overall spec 收尾（改名记录类文档映射表豁免）。