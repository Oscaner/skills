---
"@oscaner-skills/kairos": patch
---

cdd-report 的 `create-issue` 节点改用真实存在的 `gh issue create --label`（复数 `--labels` 不存在，会以 `unknown flag` 非零退出），并以 `gh label list` 预检目标仓库的标签面：默认标签集收窄为实际存在的 `cdd-engine`，缺失标签只降级标签集、不再让已过确认门的建单失败（issue #387）。