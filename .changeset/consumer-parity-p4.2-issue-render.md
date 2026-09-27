---
"@oscaner-skills/cdd-engine": minor
---

P4.2 consumer-parity 数据面单源收口：新纯渲染子命令 `cdd issue render` + finding-meta 权威迁移（非 breaking，minor）。

- **`cdd issue render` 纯渲染子命令（Non-goal #1 例外扩入——schema get 发现型 + issue render 纯渲染型双豁免）**：stdin findings JSON → stdout aggregate issue body，确定性渲染、零执法逻辑、无生命周期副作用；实现面 = P4.4 OOP 形态 `IssueReportRenderer` domain service + cli 条目路由（stdin JSON 结构校验失败 exit 1 + 违规字段路径）。report-issues 技能 I5 改「body 由 `cdd issue render` 直出」，pluginRoot-ascending 文件寻址机制删除——消费者不再就近找 `.claude-plugin/plugin.json` → scripts/。
- **finding-meta 权威迁 engine**：issue body 模板权威（原 `packages/osuperpowers/skills/report-issues/templates/finding-meta.json`）迁 cdd-engine `templates/` 面（`DOC_SCHEMA_NAMES` 不新增 doc-type——模板唯一消费者 = 渲染器，emit 经 repo → engine 方向 import，无发现型消费者）；emit issue-templates 生成改从 engine import，`emit:check` 零 drift。

> **Semver 说明**：新增子命令面 + 模板权威迁移为**新能力面**（非 breaking——既有面零变化）；cdd-engine 按 minor 发布，随 pending majors 一次集成发版至 **1.0.0**（0.1.0 基线 + 原生 major 集合 = 原生 changesets 自然产出）。
