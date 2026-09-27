---
"@oscaner-skills/osuperpowers": minor
---

P6 插件面收缩（osuperpowers minor）——两个 surface 变更合并发布：

- **能力宣称收缩（T1）**：README / README.zh-CN / CLAUDE.md 移除 8-harness 宣称，收敛为 claude / cursor-agent 两证实 harness + 中性「多 harness 可消费」；README.zh-CN 清理陈旧面（`docs/gate-install.md` 死引用 · 已删 harness 表 · 未证实 harness 行）；`oscaner-plugin.claude.keywords` 去 `droid`/`pi` + 死 `pi` manifest 字段删；`.agents/` emit 面移除（emit 产物集收敛 `.claude-plugin`/`.cursor-plugin`/marketplace/ISSUE_TEMPLATE）。
- **vendors 自维护面全撤（T2）**：submodule workflows（submodule-sync/bump）+ release `publish-vendor` 步 + `.gitmodules` 三条目 + `vendors/` 目录移除；`scripts/release/{publish-vendor,bump-submodule,submodule-tags,vendor-assembly,vendor-registry}` 整删；marketplace 产物收敛为 osuperpowers 单一 first-party 条目（`resolveVendorVersion` 连带删除，validate 13→12 块）；README/zh 插件表改指上游（保留三个官方安装命令引用）+ stale-lexicon 防回渗守卫。

> **Semver note**: 能力收缩 + vendors 撤除为散发的**消费者可见行为变更**（发现面 keywords / manifest 产物集 / README 宣称 / 安装维护指引），无新增破坏面——按 minor 发布。
