---
"@oscaner-skills/cdd-engine": minor
---

P4.2 consumer-parity 派生产物再生语义：`plan-constraints.md` 改为每次 implement dispatch（每 TG 起点）无条件再生（非 breaking，minor）。

- **去 generate-once**：`materializePlanConstraints` 删除既有文件早退——每次从 plan 声明的 Constraints source 重新提取并覆写 `plan-constraints.md`（同 plan 重写同字节 = 确定性保持；plan hash 锚保留在确定性 header 作 provenance，不再作 stale 判定）。implement pre-flight 同步删除 `existsSync` 存在性跳过，每 TG 起点必调 ⇒ mid-backfill 对 plan Constraints 的更新随下一次 dispatch 自动落到派生产物。
- **死代码即删**：`isPlanConstraintsStale`（含 `PLAN_HASH_RE`）随「无条件再生」成恒真而删除，src + tests 零残留。

> **Semver 说明**：CLI/字段面零变化，仅派生产物（`plan-constraints.md`，Do not edit 声明）的再生语义变更——非 breaking；cdd-engine 按 minor 发布，随 pending majors 一次集成发版至 **1.0.0**。
