---
"@oscaner-skills/superpowers-overrides": patch
---

#49 — fix commit contract + H6 harness 统一。共享库 `bin/lib/sdd-common.sh` 承载 task/plan run-loop（`sdd_run_task` / `sdd_run_plan`），claude/cursor 壳瘦身为仅保留 CLI flags、review 前缀与 plan 的 task 脚本路径；新增 post-run commit gate（`sdd_validate_commit_contract`）：implement/fix 模式返回时工作区脏 → handoff 改写 `status: BLOCKED` + 退出非零（契约校验在 H1 之前，H1-from-handoff 读取改写后的状态）；非 git / git 报错 fail-open；H1-from-handoff、契约校验退出非零。
