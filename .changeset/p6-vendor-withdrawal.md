---
"@oscaner-skills/osuperpowers": minor
---

P6 Task 2 vendors 自维护面全撤：

- **子模块加固**：删除两个 submodule workflows（submodule-sync / submodule-bump），release.yml 移除 `publish-vendor` / `release-vendor` 步与 `submodules: recursive` checkout，`.gitmodules` 三条目与 `vendors/` 三目录移除（B1/B2/B4/B6）。
- **release 家族整族删**：`publish-vendor` 子命令 + `scripts/release/{publish-vendor,bump-submodule,submodule-tags,vendor-assembly,vendor-registry}` 及其测试删除（B5）。
- **emit 读侧重构**：source.json 派生与 marketplace-utils 移除 vendor 条目/版本解析（`resolveVendorVersion` 连带删除，消解 v1.13 flake），marketplace 产物收敛为 osuperpowers 单一 first-party 条目；validate 套件 13→12 块（submodule 块删除）（B3/B7/B8/B9）。
- **文档改指上游**：CLAUDE.md「Vendored submodules」章节删除；README / README.zh-CN 插件表改标上游出处，仅保留三个官方安装命令引用（B10/B11）；stale-lexicon 增 `vendors/` · `publish-vendor` · `submodule` 语汇防回渗守卫（B12）。

> **semver 说明**：vendors 撤除为对散发的 marketplace/README 面的**消费者可见行为变更**（安装/维护指引改指上游，非 bug 修复）——按 minor 发布（无新增破坏面）。
