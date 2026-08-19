---
"@oscaner-skills/osuperpowers": patch
"@oscaner-skills/osuperpowers-router": patch
---

osuperpowers P1 — 插件骨架 + cli-\* 家族 + droid/pi + cli 模式重组。

- engineering 插件创建：marketplace/source.json 注册、plugin.json、CI validate 接入。
- SDD harness 机制重组：声明式 harness registry（JSON：harness → cli_bin / invocation flags / output format / review_prefix / ship level）+ 单一通用 runner `cdd-run.sh`（`--harness <name> --task N --mode …` / `--plan`）；删除 per-harness 包装脚本与 stub 脚本。
- 新增 droid / pi 两个 full harness（stream-json 解析 / `--auto` 级别 / completion sentinel）。
- 全量 sdd → cdd 更名：`SDD_*` → `CDD_*` 环境变量、`cdd-common.sh`、`cdd-run.sh`、workspace `.superpowers/sdd/` → `.superpowers/cdd/`、`docs/cdd-reference.md`、`templates/cdd/`。
- 新增 cli-\* 技能：`cli-select`（已装 harness 列出 + 推荐）、`cli-task`（通用一次性派发）、`cli-driven-development`（三模式链）、`cli-code-review`。