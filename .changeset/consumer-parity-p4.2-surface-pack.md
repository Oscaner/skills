---
"@oscaner-skills/osuperpowers": minor
---

P4.2 consumer-parity 宣讲定位面收尾 + pack 内容面清理（osuperpowers minor）。

- **宣讲定位面（repo 定位改述 cdd 方法论）**：README **三段式骨架（定位 → 理念 → 行为）**——定位句 `A cdd-first methodology: continuously-discovered development as the core discipline, AI coding skills as the distribution vehicle.`（**无 harness 字样**，harness 宣称面维持 P6 B1 中性「多 harness 可消费」，未来加 harness 零约束）+ cdd 理念导览章节（cdd 是什么 · 为什么这样设计 · 三种模式链 implement → review → fix · Review Convergence 等收敛纪律）+ osuperpowers 理念导览；行为面 = P4.1 重写成果原样承接；CLAUDE.md 定位句 + Non-goal #1 例外（schema get + issue render 双豁免零执法子命令）；zh mirror **三件全量同步**（根 + 两包 `README.zh-CN.md`，语言切换行 `[中文]` 维持不变）。
- **pack 内容面清理（数据面单源）**：包内 `scripts/` + `bin/` **整删**（`scripts/report-templates.mjs` 迁 engine、`scripts/render-yaml.mjs` 迁 repo 治理面、`bin/utils/exit.mjs` 死代码删除）+ `files` 白名单收敛 **7 项**（`skills/` · `.claude-plugin/` · `.cursor-plugin/` · `README.md` · `README.zh-CN.md` · `CHANGELOG.md` · `package.json`）——零 `tests/`、`bin/`、`scripts/`、`.superpowers/`、`.version-bump.json` 进包；report-issues I5 改「body 由 `cdd issue render` 直出」+ pluginRoot 寻址删除；emit repoint（issue-templates finding-meta 消费改从 engine import）、emit:check 零 drift。

> **Semver 说明**：宣讲面与包内容面为**消费者可见行为变更**（README/CLAUDE.md 宣称面改写 + 发布包 contents 收缩），按 minor 发布（P6 osuperpowers-surface 同尺度先例）；随 pending minors 折叠至 **0.2.0**（0.1.1 基线 + 原生 changesets minor 集合）。
