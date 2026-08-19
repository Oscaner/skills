# Tickets: os-engineering P4a（发布架构 v2）

迁移到发布架构 v2 —— 目录 `packages/`（first-party）+ `vendors/`（上游 submodule 源），package.json 的 `oscaner-plugin` 字段为唯一元数据源，统一 pnpm workspace + changesets 发布，vendors 装配 republish。参见 [实施计划](../plans/2026-08-10-os-engineering-p4a.md) 与 [阶段 spec](../specs/2026-08-10-os-engineering-p4a-design.md)。

Work the **frontier**：T1 无阻塞；T2/T5/T6 依赖 T1；T3 依赖 T2；T4 依赖 T1/T2；T7 依赖 T3-T6。

## T1 目录迁移 packages/ + vendors/

**What to build:** 插件迁至 `packages/`（engineering/overrides）+ `vendors/`（3 submodule 源），路径/清单同步。

**Blocked by:** None — can start immediately.

- [ ] git mv first-party → packages/；submodules → vendors/（.gitmodules）
- [ ] source.json contentRoot + cursor.skills 字段 → packages//vendors/
- [ ] emit + marketplace-utils + submodule-tags + ci-validate + validate-version-sync + emit.test 路径更新
- [ ] pnpm-workspace（packages/* + vendors/*）+ pnpm install
- [ ] emit + validate ALL PASS

## T2 包即源（oscaner-plugin + source.json 派生）

**What to build:** package.json 的 `oscaner-plugin` 字段唯一元数据源；FIRST_PARTY_NAMES 派生；source.json 派生；emit 枚举 packages。

**Blocked by:** T1

- [ ] packages/*/package.json 加 oscaner-plugin（claude/contentRoot/harnesses/hooks/pi）+ 补全元数据（description/author/license）
- [ ] FIRST_PARTY_NAMES 从 packages/*（含 oscaner-plugin）推导
- [ ] emit 枚举 packages（不再 readSource）；source.json 派生（$schema/metadata/owner 常量）；ensurePiKey 读 oscaner-plugin.pi
- [ ] emit.test 更新 + validate ALL PASS

## T3 hooks 每 harness 注册

**What to build:** `oscaner-plugin.hooks` 每 harness 映射（claude/cursor），emit 生成 + manifest 注册。

**Blocked by:** T2

- [ ] emit 按 hooks 映射生成每 harness hooks + marketplace/plugin manifest 注册
- [ ] validate ALL PASS

## T4 统一发布（changesets first-party + release 链）

**What to build:** changesets 版本化/发布 first-party（engineering/overrides）；access public；release publish 步骤。

**Blocked by:** T1, T2

- [ ] version-packages.mjs 扩展 first-party；packages/*/package.json private:false
- [ ] changesets 键名新包名；access:public；release.yml `changeset publish`
- [ ] sync-overrides-versions 路径依赖 T6；dry-run

## T5 vendors 装配 republish

**What to build:** `scripts/publish-vendor.mjs` —— 构建期装配 `@oscaner-skills/{superpowers,mattpocock-skills,impeccable}`（保留 LICENSE + pi key + 版本源）。

**Blocked by:** T1

- [ ] publish-vendor.mjs（per-vendor contentRoot：impeccable→plugin/；版本源：impeccable→plugin.json truth）
- [ ] 装配 dry-run（scoped package.json + LICENSE + pi key）

## T6 submodule bump 链迁移

**What to build:** bump-submodule.mjs + sync-overrides-versions.mjs 路径 → vendors//packages/；workflows 验证。

**Blocked by:** T1

- [ ] bump-submodule.mjs + sync-overrides-versions.mjs 路径更新（SUBMODULE_PATHS 已 T1 处理）
- [ ] workflows（submodule-sync + bump-reusable）验证；bump dry-run

## T7 文档 + 终检

**What to build:** README/cross-harness/CLAUDE.md（目录/包名/hooks 矩阵/未来插件约定）；零残留 + validate ALL PASS。

**Blocked by:** T3-T6

- [ ] README 插件表（packages/vendors + 包名）+ hooks 矩阵 + 未来插件接入约定
- [ ] 零残留 grep（强制）+ `pnpm run emit && pnpm run validate` ALL PASS
