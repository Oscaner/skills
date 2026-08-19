# Tickets: P7b 技能目录改名 + 命名空间 + 文档更新

引用 plan: [docs/superpowers/plans/2026-08-18-os-engineering-p7b.md](../plans/2026-08-18-os-engineering-p7b.md)

P7b 是 P7 系列的第二个子阶段，将 9 个 `skills/os-*` 目录去掉 `os-` 前缀，更新所有引用（manifest/SKILL.md/脚本/文档），并验证 `pnpm run validate` 全绿。

## T1: 技能目录改名 + 命名空间 + 文档更新

**What to build:** 完成全部技能目录改名、manifest 引用更新、SKILL.md/脚本/文档引用更新，使 `pnpm run validate` 全绿通过。

**Blocked by:** P7a（包目录改名 + emit 脚本适配）已完成。

- [ ] Task 1: git mv 9 个 skills/os-* 目录去掉 os- 前缀
- [ ] Task 2: 更新 overrides.manifest.json 的 name/source 字段
- [ ] Task 3: 更新 SKILL.md/SKILL.zh-CN.md/spor.md/harness.md 内部引用
- [ ] Task 4: 更新 scripts/emit.mjs 的 emitAgentsSkillsCopy namespace
- [ ] Task 5: 更新全部文档文件（15+ .md 文件，按顺序执行替换规则）
- [ ] Task 6: pnpm run emit 重新生成 + pnpm run emit:check + pnpm run validate 全绿