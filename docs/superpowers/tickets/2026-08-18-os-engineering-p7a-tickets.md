# Tickets: P7a 包目录改名 + 脚本适配

引用 plan: [docs/superpowers/plans/2026-08-18-os-engineering-p7a.md](../plans/2026-08-18-os-engineering-p7a.md)

P7a 是 P7 系列的第一个子阶段，将 `packages/engineering/` 和 `packages/superpowers-overrides/` 分别改名为 `packages/osuperpowers/` 和 `packages/osuperpowers-router/`，并同步更新所有脚本引用和测试断言。

## T1: 包目录改名 + 脚本适配 + 验证

**What to build:** 执行完整的目录改名、所有硬编码路径更新、manifest 重新生成，使 `pnpm run validate` 全绿通过。

**Blocked by:** None — can start immediately.

- [ ] Task 1: git mv 改名目录 + 更新 package.json
- [ ] Task 2: 更新 overrides.manifest.json source 路径（8 处）
- [ ] Task 3: 更新 scripts/emit.mjs（productRoots, productFiles, emitAll, assertVersionBump, emitAgentsSkillsCopy）
- [ ] Task 4: 更新 scripts/ci-validate.mjs（全部路径引用）
- [ ] Task 5: 更新 test 文件 + 其他脚本
- [ ] Task 6: pnpm run emit 重新生成 + pnpm run emit:check + pnpm run validate 全绿